import { describe, expect, it, rstest } from "@rstest/core";
import { alphaBackupFeasibilityLimits } from "../../application/backup-feasibility-policy";
import {
	decryptProjectTransfer,
	encryptProjectTransfer,
	isEncryptedProjectTransfer,
	isProjectTransferPasswordValid,
	MAX_ENCRYPTED_PROJECT_TRANSFER_BYTES,
	MAX_PROJECT_TRANSFER_PLAINTEXT_BYTES,
} from "./encrypted-project-transfer";

const password = " кафе 🧩 café ";
const archive = new Uint8Array([0x50, 0x4b, 3, 4, 7, 8, 0, 255]);
const magic = new TextEncoder().encode("INTENC1\n");

// Independent Node crypto vector with salt 00..0f and IV 10..1b.
const knownAnswer = Uint8Array.from(
	"494e54454e43310a000102030405060708090a0b0c0d0e0f101112131415161718191a1ba9764419027957a1bca185bc376cea4a119d228d4852c0e2".match(/../g) ?? [],
	(pair) => Number.parseInt(pair, 16),
);

describe("Android encrypted project transfer", () => {
	it("encrypts portable backup bytes with independent salt and IV for every export", async () => {
		const [first, second] = await Promise.all([
			encryptProjectTransfer(archive, password),
			encryptProjectTransfer(archive, password),
		]);
		if (first.kind !== "encrypted" || second.kind !== "encrypted") {
			throw new Error("The archive could not be encrypted");
		}
		expect(isEncryptedProjectTransfer(first.bytes)).toBe(true);
		expect(isEncryptedProjectTransfer(archive)).toBe(false);
		expect(first.bytes.slice(0, 8)).toEqual(magic);
		expect(first.bytes.byteLength).toBe(archive.byteLength + 52);
		expect(first.bytes.slice(8, 24)).not.toEqual(second.bytes.slice(8, 24));
		expect(first.bytes.slice(24, 36)).not.toEqual(second.bytes.slice(24, 36));
		expect(first.bytes.slice(36, 44)).not.toEqual(archive);
		expect(await decryptProjectTransfer(first.bytes, password)).toEqual({
			kind: "decrypted",
			bytes: archive,
		});
	});

	it("reads the independent AES-GCM vector and requires the exact UTF-8 password", async () => {
		expect(await decryptProjectTransfer(knownAnswer, password)).toEqual({
			kind: "decrypted",
			bytes: archive,
		});
		for (const changedPassword of [password.trimStart(), password.normalize("NFD")]) {
			expect(await decryptProjectTransfer(knownAnswer, changedPassword)).toEqual({
				kind: "rejected",
				reasonCode: "TRANSFER_AUTHENTICATION_FAILED",
			});
		}
	});

	it("rejects modified salt, IV, payload and tag without yielding plaintext", async () => {
		for (const offset of [8, 24, 36, knownAnswer.length - 1]) {
			const modified = knownAnswer.slice();
			modified[offset] ^= 1;
			expect(await decryptProjectTransfer(modified, password)).toEqual({
				kind: "rejected",
				reasonCode: "TRANSFER_AUTHENTICATION_FAILED",
			});
		}
	});

	it("bounds files at the canonical export ceiling plus encryption overhead", async () => {
		const limit = alphaBackupFeasibilityLimits.maxContainerBytes;
		expect(MAX_PROJECT_TRANSFER_PLAINTEXT_BYTES).toBe(limit);
		expect(MAX_ENCRYPTED_PROJECT_TRANSFER_BYTES).toBe(limit + 52);
		const oversized = new Uint8Array(limit + 53);
		oversized.set(magic);
		expect(await encryptProjectTransfer(oversized.subarray(0, limit + 1), "")).toEqual({
			kind: "rejected",
			reasonCode: "TRANSFER_TOO_LARGE",
		});
		expect(await decryptProjectTransfer(oversized, "")).toEqual({
			kind: "rejected",
			reasonCode: "TRANSFER_TOO_LARGE",
		});
		expect(await encryptProjectTransfer(oversized.subarray(0, limit), "")).toEqual({
			kind: "rejected",
			reasonCode: "INVALID_TRANSFER_PASSWORD",
		});
		expect(await decryptProjectTransfer(oversized.subarray(0, limit + 52), "")).toEqual({
			kind: "rejected",
			reasonCode: "INVALID_TRANSFER_PASSWORD",
		});
	});

	it("identifies an incomplete encrypted archive and rejects invalid versions and empty archives", async () => {
		expect(isEncryptedProjectTransfer(magic)).toBe(true);
		expect(isEncryptedProjectTransfer(magic.subarray(0, 7))).toBe(false);
		const wrongVersion = knownAnswer.slice();
		wrongVersion[6] = 0x32;
		for (const invalid of [knownAnswer.subarray(0, 52), wrongVersion, archive]) {
			expect(await decryptProjectTransfer(invalid, password)).toEqual({
				kind: "rejected",
				reasonCode: "INVALID_ENCRYPTED_TRANSFER",
			});
		}
		expect(await encryptProjectTransfer(new Uint8Array(), password)).toEqual({
			kind: "rejected",
			reasonCode: "INVALID_ENCRYPTED_TRANSFER",
		});
	});

	it("counts Unicode code points and rejects strings that have no exact UTF-8 representation", () => {
		expect(isProjectTransferPasswordValid("🔑".repeat(11))).toBe(false);
		expect(isProjectTransferPasswordValid("🔑".repeat(12))).toBe(true);
		expect(isProjectTransferPasswordValid("я".repeat(256))).toBe(true);
		expect(isProjectTransferPasswordValid("я".repeat(257))).toBe(false);
		expect(isProjectTransferPasswordValid(`${password}\uD800`)).toBe(false);
		expect(isProjectTransferPasswordValid(`${password}\uDFFF`)).toBe(false);
	});

	it("captures the selected archive before asynchronous password derivation", async () => {
		const source = knownAnswer.slice();
		const decrypting = decryptProjectTransfer(source, password);
		source.fill(0);
		expect(await decrypting).toEqual({ kind: "decrypted", bytes: archive });
	});

	it("reports unavailable Web Crypto separately from an incorrect password or a damaged file", async () => {
		rstest.stubGlobal("crypto", undefined);
		try {
			for (const result of await Promise.all([
				encryptProjectTransfer(archive, password),
				decryptProjectTransfer(knownAnswer, password),
			])) {
				expect(result).toEqual({ kind: "rejected", reasonCode: "TRANSFER_CRYPTO_UNAVAILABLE" });
			}
		} finally {
			rstest.unstubAllGlobals();
		}
		const encrypt = rstest.spyOn(crypto.subtle, "encrypt").mockRejectedValue(new TypeError());
		const decrypt = rstest.spyOn(crypto.subtle, "decrypt").mockRejectedValue(new TypeError());
		try {
			for (const result of await Promise.all([
				encryptProjectTransfer(archive, password),
				decryptProjectTransfer(knownAnswer, password),
			])) {
				expect(result).toEqual({ kind: "rejected", reasonCode: "TRANSFER_CRYPTO_UNAVAILABLE" });
			}
		} finally {
			encrypt.mockRestore();
			decrypt.mockRestore();
		}
	});

	it("does not hand late encryption or decryption results to a cancelled caller", async () => {
		const aborted = AbortSignal.abort();
		const active = new AbortController();
		const encrypting = encryptProjectTransfer(archive, password, active.signal);
		const decrypting = decryptProjectTransfer(knownAnswer, password, active.signal);
		active.abort();
		for (const result of await Promise.all([
			encryptProjectTransfer(archive, password, aborted),
			decryptProjectTransfer(knownAnswer, password, aborted),
			encrypting,
			decrypting,
		])) {
			expect(result).toEqual({ kind: "rejected", reasonCode: "TRANSFER_CANCELLED" });
		}
	});

	it("discards the result if the user cancels during the native cipher operation", async () => {
		const active = new AbortController();
		const nativeDecrypt = crypto.subtle.decrypt.bind(crypto.subtle);
		const decrypt = rstest.spyOn(crypto.subtle, "decrypt").mockImplementation(async (...args) => {
			const decrypted = await nativeDecrypt(...args);
			active.abort();
			return decrypted;
		});
		try {
			expect(await decryptProjectTransfer(knownAnswer, password, active.signal)).toEqual({
				kind: "rejected",
				reasonCode: "TRANSFER_CANCELLED",
			});
		} finally {
			decrypt.mockRestore();
		}
	});
});
