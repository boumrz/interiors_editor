import type {
	BinaryChecksumPort,
	ChecksumPort,
	ClockPort,
	IdPort,
	StorageEstimatePort,
	WriterTakeoverRequirementStorePort,
} from "../application/ports";

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

type BrowserUuidCrypto = {
	readonly getRandomValues: (bytes: Uint8Array) => Uint8Array;
	readonly randomUUID?: () => string;
};

/**
 * `crypto.randomUUID()` is secure-context-only in some mobile browsers. A
 * same-Wi-Fi HTTP preview still has `getRandomValues`, so retain UUIDv4
 * identity generation instead of making the editor blank on that origin.
 */
export function browserRandomUuid(
	crypto: BrowserUuidCrypto = window.crypto as unknown as BrowserUuidCrypto,
): string {
	if (typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytesToHex(bytes);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const browserClock: ClockPort = {
	now: () => new Date().toISOString(),
};

export const browserIds: IdPort = {
	next: () => browserRandomUuid(),
};

const WRITER_OWNER_SESSION_KEY = "interiors-editor-writer-owner";
const WRITER_TAKEOVER_REQUIREMENT_SESSION_KEY_PREFIX =
	"interiors-editor-writer-takeover-required:";

interface BrowserWriterOwnerContext {
	readonly crypto?: BrowserUuidCrypto;
	readonly navigationType?: PerformanceNavigationTiming["type"];
	readonly sessionStorage?: Pick<Storage, "getItem" | "setItem">;
}

interface BrowserWriterTakeoverRequirementsContext {
	readonly sessionStorage?: Pick<Storage, "getItem" | "setItem">;
}

/**
 * A reload belongs to the same browser editing context, whereas another tab
 * gets a different `sessionStorage` namespace. Keeping this identity there
 * lets a normal reload continue the existing writer lease without making two
 * simultaneously open contexts share a fence.
 */
export function browserWriterOwnerId(
	context: BrowserWriterOwnerContext = {},
): string {
	const storage = context.sessionStorage ?? window.sessionStorage;
	const navigationType =
		context.navigationType ??
		(
			window.performance.getEntriesByType("navigation")[0] as
				| PerformanceNavigationTiming
				| undefined
		)?.type;
	const existing = storage.getItem(WRITER_OWNER_SESSION_KEY);
	// sessionStorage survives reload, but browsers may copy it into a duplicated
	// or opener-created tab. Only a real reload may continue the same fence.
	if (existing && navigationType === "reload") {
		return existing;
	}
	const ownerId = browserRandomUuid(
		context.crypto ?? (window.crypto as unknown as BrowserUuidCrypto),
	);
	storage.setItem(WRITER_OWNER_SESSION_KEY, ownerId);
	return ownerId;
}

/**
 * Session storage is scoped to one browser context and survives ordinary
 * reloads. That makes it the right boundary for an observed foreign writer:
 * an expired lease still needs a deliberate takeover acknowledgement.
 */
export function browserWriterTakeoverRequirements(
	context: BrowserWriterTakeoverRequirementsContext = {},
): WriterTakeoverRequirementStorePort {
	const storage = context.sessionStorage ?? window.sessionStorage;
	const keyFor = (projectId: string) =>
		`${WRITER_TAKEOVER_REQUIREMENT_SESSION_KEY_PREFIX}${projectId}`;
	return {
		requiresExplicitTakeover: (projectId) =>
			storage.getItem(keyFor(projectId)) === "required",
		requireExplicitTakeover: (projectId) => {
			storage.setItem(keyFor(projectId), "required");
		},
		clearExplicitTakeoverRequirement: (projectId) => {
			storage.setItem(keyFor(projectId), "cleared");
		},
	};
}

export const browserChecksum: ChecksumPort = {
	sha256: async (value) => {
		const bytes = new TextEncoder().encode(value);
		const digest = await window.crypto.subtle.digest("SHA-256", bytes);
		return bytesToHex(new Uint8Array(digest));
	},
};

export const browserBinaryChecksum: BinaryChecksumPort = {
	sha256Bytes: async (bytes) => {
		// Copy into a regular ArrayBuffer: a generic Uint8Array may be backed by
		// SharedArrayBuffer, which WebCrypto deliberately does not accept.
		const input = new Uint8Array(bytes.byteLength);
		input.set(bytes);
		const digest = await window.crypto.subtle.digest("SHA-256", input.buffer);
		return bytesToHex(new Uint8Array(digest));
	},
};

/** StorageManager estimates are advisory; unsupported and failing browsers stay explicit. */
export const browserStorageEstimate: StorageEstimatePort = {
	estimateStorage: async () => {
		try {
			const estimate = await navigator.storage?.estimate?.();
			return {
				quotaBytes: estimate?.quota,
				usageBytes: estimate?.usage,
			};
		} catch {
			return {};
		}
	},
	requestPersistentStorage: async () => {
		try {
			return await navigator.storage?.persist?.();
		} catch {
			return undefined;
		}
	},
};
