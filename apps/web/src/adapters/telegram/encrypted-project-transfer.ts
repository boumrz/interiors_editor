import { alphaBackupFeasibilityLimits } from "../../application/backup-feasibility-policy";

const magic = new TextEncoder().encode("INTENC1\n");
const saltEnd = magic.byteLength + 16;
const headerBytes = saltEnd + 12;
const tagBytes = 16;
const overheadBytes = headerBytes + tagBytes;
const exportPasswordLength = 6;

export const MAX_PROJECT_TRANSFER_PLAINTEXT_BYTES = alphaBackupFeasibilityLimits.maxContainerBytes;
export const MAX_ENCRYPTED_PROJECT_TRANSFER_BYTES = MAX_PROJECT_TRANSFER_PLAINTEXT_BYTES + overheadBytes;

type TransferRejection = {
	readonly kind: "rejected";
	readonly reasonCode:
		| "INVALID_ENCRYPTED_TRANSFER"
		| "INVALID_TRANSFER_PASSWORD"
		| "TRANSFER_AUTHENTICATION_FAILED"
		| "TRANSFER_TOO_LARGE"
		| "TRANSFER_CRYPTO_UNAVAILABLE"
		| "TRANSFER_CANCELLED";
};

function rejected(reasonCode: TransferRejection["reasonCode"]): TransferRejection {
	return { kind: "rejected", reasonCode };
}

/** Magic is detected separately so truncated encrypted files cannot fall back to plain archive decoding. */
export function isEncryptedProjectTransfer(bytes: Uint8Array): boolean {
	return bytes.byteLength >= magic.byteLength && magic.every((byte, index) => bytes[index] === byte);
}

function projectTransferPasswordLength(password: string): number {
	let codePoints = 0;
	for (const character of password) {
		const point = character.codePointAt(0) ?? 0;
		// TextEncoder replaces lone surrogates. Reject them to keep the password mapping exact.
		if (point >= 0xd800 && point <= 0xdfff) return 0;
		if (++codePoints > 256) return 0;
	}
	return codePoints;
}

export function isProjectTransferExportPasswordValid(password: string): boolean {
	return projectTransferPasswordLength(password) === exportPasswordLength;
}

export function isProjectTransferPasswordValid(password: string): boolean {
	const length = projectTransferPasswordLength(password);
	// Earlier version 1 archives used 12 to 256 code points.
	return length === exportPasswordLength || length >= 12;
}

async function deriveTransferKey(
	subtle: SubtleCrypto,
	password: string,
	header: Uint8Array<ArrayBuffer>,
	usage: "encrypt" | "decrypt",
	signal: AbortSignal | undefined,
): Promise<CryptoKey | undefined> {
	const passwordBytes = new TextEncoder().encode(password);
	try {
		const material = await subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveKey"]);
		if (signal?.aborted) return undefined;
		return subtle.deriveKey({
			name: "PBKDF2",
			hash: "SHA-256",
			iterations: 600_000,
			salt: header.subarray(magic.byteLength, saltEnd),
		}, material, { name: "AES-GCM", length: 256 }, false, [usage]);
	} finally {
		passwordBytes.fill(0);
	}
}

function transferCipher(header: Uint8Array<ArrayBuffer>): AesGcmParams {
	return { name: "AES-GCM", iv: header.subarray(saltEnd), additionalData: header, tagLength: tagBytes * 8 };
}

export async function encryptProjectTransfer(
	bytes: Uint8Array,
	password: string,
	signal?: AbortSignal,
): Promise<{ readonly kind: "encrypted"; readonly bytes: Uint8Array<ArrayBuffer> } | TransferRejection> {
	if (signal?.aborted) return rejected("TRANSFER_CANCELLED");
	if (bytes.byteLength > MAX_PROJECT_TRANSFER_PLAINTEXT_BYTES) return rejected("TRANSFER_TOO_LARGE");
	if (bytes.byteLength === 0) return rejected("INVALID_ENCRYPTED_TRANSFER");
	if (!isProjectTransferExportPasswordValid(password)) return rejected("INVALID_TRANSFER_PASSWORD");
	const { crypto } = globalThis;
	if (!crypto?.subtle) return rejected("TRANSFER_CRYPTO_UNAVAILABLE");

	const envelope = new Uint8Array(overheadBytes + bytes.byteLength);
	const header = envelope.subarray(0, headerBytes);
	const plaintext = envelope.subarray(headerBytes, headerBytes + bytes.byteLength);
	header.set(magic);
	// Reuse the output allocation for the owned plaintext snapshot until encryption finishes.
	plaintext.set(bytes);
	let encrypted: ArrayBuffer;
	try {
		crypto.getRandomValues(header.subarray(magic.byteLength));
		const key = await deriveTransferKey(crypto.subtle, password, header, "encrypt", signal);
		if (signal?.aborted || !key) return rejected("TRANSFER_CANCELLED");
		encrypted = await crypto.subtle.encrypt(transferCipher(header), key, plaintext);
	} catch {
		return rejected(signal?.aborted ? "TRANSFER_CANCELLED" : "TRANSFER_CRYPTO_UNAVAILABLE");
	} finally {
		plaintext.fill(0);
	}
	if (signal?.aborted) return rejected("TRANSFER_CANCELLED");
	envelope.set(new Uint8Array(encrypted), headerBytes);
	return { kind: "encrypted", bytes: envelope };
}

export async function decryptProjectTransfer(
	bytes: Uint8Array,
	password: string,
	signal?: AbortSignal,
): Promise<{ readonly kind: "decrypted"; readonly bytes: Uint8Array<ArrayBuffer> } | TransferRejection> {
	if (signal?.aborted) return rejected("TRANSFER_CANCELLED");
	if (bytes.byteLength > MAX_ENCRYPTED_PROJECT_TRANSFER_BYTES) return rejected("TRANSFER_TOO_LARGE");
	if (bytes.byteLength <= overheadBytes || !isEncryptedProjectTransfer(bytes)) return rejected("INVALID_ENCRYPTED_TRANSFER");
	if (!isProjectTransferPasswordValid(password)) return rejected("INVALID_TRANSFER_PASSWORD");
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) return rejected("TRANSFER_CRYPTO_UNAVAILABLE");

	const envelope = bytes.slice();
	const header = envelope.subarray(0, headerBytes);
	try {
		const key = await deriveTransferKey(subtle, password, header, "decrypt", signal);
		if (signal?.aborted || !key) return rejected("TRANSFER_CANCELLED");
		const plaintext = new Uint8Array(await subtle.decrypt(transferCipher(header), key, envelope.subarray(headerBytes)));
		if (signal?.aborted) {
			plaintext.fill(0);
			return rejected("TRANSFER_CANCELLED");
		}
		return { kind: "decrypted", bytes: plaintext };
	} catch (error) {
		if (signal?.aborted) return rejected("TRANSFER_CANCELLED");
		return rejected(error instanceof DOMException && error.name === "OperationError"
			? "TRANSFER_AUTHENTICATION_FAILED"
			: "TRANSFER_CRYPTO_UNAVAILABLE");
	}
}
