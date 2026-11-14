export interface StorageEstimate {
	readonly quotaBytes?: number;
	readonly usageBytes?: number;
}

export type StoragePressure =
	| { readonly kind: "unavailable" }
	| {
			readonly kind: "healthy" | "warning" | "critical";
			readonly quotaBytes: number;
			readonly usageBytes: number;
	  };

/**
 * An explicit user-requested storage-protection result. Even a grant remains
 * advisory: browser and OS eviction can still happen, so it never replaces a
 * Portable Backup.
 */
export type PersistentStorageRequest =
	| { readonly kind: "granted" }
	| { readonly kind: "not-granted" }
	| { readonly kind: "unavailable" };

const WARNING_USAGE_FRACTION = 0.7;
const CRITICAL_USAGE_FRACTION = 0.9;

/**
 * Browser storage estimates are advisory, not eviction guarantees. Keep a
 * missing or malformed value visible as unavailable rather than deriving a
 * fictional amount of safe local capacity.
 */
export function assessStoragePressure(
	estimate: StorageEstimate,
): StoragePressure {
	const { quotaBytes, usageBytes } = estimate;
	if (
		!isStorageByteCount(quotaBytes) ||
		!isStorageByteCount(usageBytes) ||
		quotaBytes === 0
	) {
		return { kind: "unavailable" };
	}
	if (usageBytes >= quotaBytes * CRITICAL_USAGE_FRACTION) {
		return { kind: "critical", quotaBytes, usageBytes };
	}
	if (usageBytes >= quotaBytes * WARNING_USAGE_FRACTION) {
		return { kind: "warning", quotaBytes, usageBytes };
	}
	return { kind: "healthy", quotaBytes, usageBytes };
}

function isStorageByteCount(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
