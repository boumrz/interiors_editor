import {
	isReleaseManifest,
	type ReleaseManifest,
	type ReleaseRuntimeCapabilities,
} from "./release-startup";

declare const approvedReadableTelegramRelease: unique symbol;
/** Permits only existing V1 reads/exports; it grants no writer or renderer. */
export interface ApprovedReadableTelegramRelease {
	readonly [approvedReadableTelegramRelease]: true;
	readonly manifest: ReleaseManifest;
	readonly entryPath: string;
}
const approvals = new WeakSet<object>();
export function isApprovedReadableTelegramRelease(
	value: unknown,
): value is ApprovedReadableTelegramRelease {
	return !!value && typeof value === "object" && approvals.has(value);
}

/** Actual loaded-shell metadata only. This function performs no storage work. */
export function approveReadableTelegramRelease(input: {
	readonly capsule: unknown;
	readonly loadedEntryPath: string;
	readonly capabilities: ReleaseRuntimeCapabilities;
	readonly secureContext: boolean;
	readonly webLocks?: boolean | undefined;
	readonly hasControllingWorker: boolean;
	readonly workerManifest: unknown;
}):
	| {
			readonly kind: "approved";
			readonly approval: ApprovedReadableTelegramRelease;
	  }
	| {
			readonly kind: "rejected";
			readonly reason: "release-incompatible" | "storage-unavailable";
	  } {
	if (!input.secureContext || !input.capabilities.indexeddb)
		return { kind: "rejected", reason: "storage-unavailable" };
	const capsule = input.capsule;
	if (
		!record(capsule) ||
		Object.keys(capsule).length !== 3 ||
		capsule.deliveryTarget !== "telegram" ||
		typeof capsule.entryPath !== "string" ||
		/^\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.js$/.exec(capsule.entryPath)?.[0] !==
			capsule.entryPath ||
		capsule.entryPath !== input.loadedEntryPath ||
		!isReleaseManifest(capsule.manifest)
	)
		return { kind: "rejected", reason: "release-incompatible" };
	const manifest = capsule.manifest;
	if (
		![
			manifest.projectSchemas,
			manifest.assetSchemas,
			manifest.catalogSchemas,
		].every((range) => range.readable.includes(1))
	)
		return { kind: "rejected", reason: "release-incompatible" };
	if (
		input.hasControllingWorker
			? !isReleaseManifest(input.workerManifest) ||
				JSON.stringify(input.workerManifest) !== JSON.stringify(manifest)
			: input.workerManifest !== undefined
	)
		return { kind: "rejected", reason: "release-incompatible" };
	const copy: ReleaseManifest = Object.freeze({
		appBuildId: manifest.appBuildId,
		assetSchemas: freezeRange(manifest.assetSchemas),
		catalogSchemas: freezeRange(manifest.catalogSchemas),
		minimumCapabilities: Object.freeze([...manifest.minimumCapabilities]),
		projectSchemas: freezeRange(manifest.projectSchemas),
		version: 1,
		workerProtocolVersion: 1,
	});
	// The WeakSet is runtime provenance; the assertion adds only a private brand.
	const approval = Object.freeze({
		manifest: copy,
		entryPath: capsule.entryPath,
	}) as ApprovedReadableTelegramRelease;
	approvals.add(approval);
	return { kind: "approved", approval };
}
function record(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function freezeRange(
	range: ReleaseManifest["projectSchemas"],
): ReleaseManifest["projectSchemas"] {
	return Object.freeze({
		readable: Object.freeze([...range.readable]),
		writable: Object.freeze([...range.writable]),
	});
}
