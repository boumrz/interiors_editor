import { parsePpjA1JsonBytes } from "../domain/ppj-a1-lossless-json";
import { isReleaseManifest, type ReleaseManifest, type ReleaseRuntimeCapabilities } from "./release-startup";

declare const approvedTelegramRelease: unique symbol;
export interface ApprovedTelegramRelease {
	readonly [approvedTelegramRelease]: true;
	readonly manifest: ReleaseManifest;
	readonly entryPath: string;
}

const approvals = new WeakSet<object>();

/** This permit belongs to the loaded HTML and script, never a fetched newer manifest. */
export function isApprovedTelegramRelease(value: unknown): value is ApprovedTelegramRelease {
	return !!value && typeof value === "object" && approvals.has(value);
}

/** Embedded build metadata is small and duplicate-free; no network or storage is touched. */
export function parseTelegramReleaseCapsule(raw: string | undefined): unknown {
	if (typeof raw !== "string" || raw.length > 16 * 1024) return undefined;
	const bytes = new TextEncoder().encode(raw);
	if (bytes.byteLength > 16 * 1024 || parsePpjA1JsonBytes(bytes).kind !== "accepted") return undefined;
	try { return JSON.parse(raw) as unknown; } catch { return undefined; }
}

export function approveTelegramRelease(input: {
	readonly capsule: unknown;
	readonly loadedEntryPath: string;
	readonly capabilities: ReleaseRuntimeCapabilities;
	readonly secureContext: boolean;
	readonly webLocks: boolean;
	readonly hasControllingWorker: boolean;
	readonly workerManifest: unknown;
}): { readonly kind: "approved"; readonly approval: ApprovedTelegramRelease } | { readonly kind: "rejected"; readonly reason: "release-incompatible" | "storage-unavailable" } {
	if (!input.secureContext || !input.webLocks || !input.capabilities.indexeddb) return { kind: "rejected", reason: "storage-unavailable" };
	const capsule = input.capsule;
	if (!record(capsule) || Object.keys(capsule).length !== 3 || capsule.deliveryTarget !== "telegram" || typeof capsule.entryPath !== "string" || !/^\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.js$/.test(capsule.entryPath) || capsule.entryPath !== input.loadedEntryPath || !isReleaseManifest(capsule.manifest)) return { kind: "rejected", reason: "release-incompatible" };
	const manifest = capsule.manifest;
	// This runtime implements only V1; declaring another writable schema cannot
	// grant a capability that the shipped code does not have.
	if (![manifest.projectSchemas, manifest.assetSchemas, manifest.catalogSchemas].every((range) => range.readable.every((version) => version === 1) && range.writable.length === 1 && range.writable[0] === 1) || !manifest.minimumCapabilities.every((capability) => input.capabilities[capability])) return { kind: "rejected", reason: "release-incompatible" };
	if (input.hasControllingWorker ? !isReleaseManifest(input.workerManifest) || JSON.stringify(input.workerManifest) !== JSON.stringify(manifest) : input.workerManifest !== undefined) return { kind: "rejected", reason: "release-incompatible" };
	const copy: ReleaseManifest = Object.freeze({
		appBuildId: manifest.appBuildId,
		assetSchemas: freezeRange(manifest.assetSchemas),
		catalogSchemas: freezeRange(manifest.catalogSchemas),
		minimumCapabilities: Object.freeze([...manifest.minimumCapabilities]),
		projectSchemas: freezeRange(manifest.projectSchemas),
		version: 1,
		workerProtocolVersion: 1,
	});
	// The private WeakSet is the runtime proof; copying or deserializing metadata
	// cannot reconstruct a permit. The assertion adds only the unexported brand.
	const approval = Object.freeze({ manifest: copy, entryPath: capsule.entryPath }) as ApprovedTelegramRelease;
	approvals.add(approval);
	return { kind: "approved", approval };
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function freezeRange(range: ReleaseManifest["projectSchemas"]): ReleaseManifest["projectSchemas"] { return Object.freeze({ readable: Object.freeze([...range.readable]), writable: Object.freeze([...range.writable]) }); }
