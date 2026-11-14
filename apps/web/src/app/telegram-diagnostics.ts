import { isReleaseManifest } from "./release-startup";

type Capability = boolean | "not-checked";
type SchemaRange =
	| Readonly<{ readable: readonly number[]; writable: readonly number[] }>
	| "unknown";
export type TelegramDiagnosticPhase =
	| "checking"
	| "configuration"
	| "release"
	| "sdk"
	| "verification"
	| "storage"
	| "editor"
	| "readonly"
	| "closed";
export interface TelegramDiagnosticRecord {
	readonly version: 1;
	readonly target: "telegram";
	readonly appBuildId: string;
	readonly schemas: Readonly<{
		project: SchemaRange;
		asset: SchemaRange;
		catalog: SchemaRange;
	}>;
	readonly catalogVersion: string;
	readonly capabilities: Readonly<{
		indexeddb: Capability;
		webgl2: Capability;
		secureContext: boolean;
		webLocks: boolean;
	}>;
	readonly phase: TelegramDiagnosticPhase;
	readonly reason: string;
}
const reasons = new Set([
	"checking",
	"configuration-invalid",
	"release-incompatible",
	"storage-unavailable",
	"storage-failed",
	"unsupported-host",
	"sdk-load-failed",
	"timeout",
	"cancelled",
	"disposed",
	"invalid-timeout",
	"invalid-configuration",
	"malformed-init-data",
	"invalid-identity",
	"invalid-clock",
	"expired-launch",
	"invalid-signature",
	"unsupported-crypto",
	"ready",
	"read-only",
	"sdk-ready-failed",
	"catalog-unavailable",
	"catalog-envelope-invalid",
	"source-unavailable",
	"backup-unavailable",
	"file-unavailable",
	"webgl-unavailable",
	"unclassified",
]);
const phases = new Set<TelegramDiagnosticPhase>([
	"checking",
	"configuration",
	"release",
	"sdk",
	"verification",
	"storage",
	"editor",
	"readonly",
	"closed",
]);
const technicalVersion = (value: unknown, fallback: string) =>
	typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
		? value
		: fallback;
const capability = (value: unknown): Capability =>
	typeof value === "boolean" ? value : "not-checked";
function range(value: {
	readable: readonly number[];
	writable: readonly number[];
}): SchemaRange {
	if (value.readable.length > 16 || value.writable.length > 16)
		return "unknown";
	return Object.freeze({
		readable: Object.freeze([...value.readable]),
		writable: Object.freeze([...value.writable]),
	});
}
function releaseSummary(value: unknown) {
	try {
		if (isReleaseManifest(value))
			return {
				appBuildId: technicalVersion(value.appBuildId, "unknown"),
				schemas: Object.freeze({
					project: range(value.projectSchemas),
					asset: range(value.assetSchemas),
					catalog: range(value.catalogSchemas),
				}),
			};
	} catch {
		/* An invalid diagnostic input cannot expose the raw exception. */
	}
	return {
		appBuildId: "unknown",
		schemas: Object.freeze({
			project: "unknown",
			asset: "unknown",
			catalog: "unknown",
		} as const),
	};
}

/** Local in-memory technical record only. No SDK object, identity, file or Project is retained. */
export function createTelegramDiagnostics(context: {
	readonly manifest: unknown;
	readonly secureContext: boolean;
	readonly webLocks: boolean;
}) {
	const release = releaseSummary(context.manifest),
		listeners = new Set<() => void>();
	const { secureContext, webLocks } = context;
	let closed = false;
	const initial = (): TelegramDiagnosticRecord =>
		Object.freeze({
			version: 1,
			target: "telegram",
			...release,
			catalogVersion: "not-observed",
			capabilities: Object.freeze({
				indexeddb: "not-checked",
				webgl2: "not-checked",
				secureContext,
				webLocks,
			}),
			phase: "checking",
			reason: "checking",
		});
	let current = initial();
	const publish = (record: TelegramDiagnosticRecord) => {
		current = Object.freeze(record);
		for (const listener of [...listeners]) {
			if (!listeners.has(listener)) continue;
			try {
				listener();
			} catch {
				/* Diagnostics do not affect admission or other observers. */
			}
		}
	};
	return {
		snapshot: () => current,
		subscribe(listener: () => void) {
			if (closed) return () => undefined;
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		update(value: {
			readonly phase: TelegramDiagnosticPhase;
			readonly reason: string;
			readonly capabilities?: {
				readonly indexeddb: boolean;
				readonly webgl2: boolean;
			};
			readonly catalogVersion?: string;
		}) {
			if (closed) return;
			publish({
				...current,
				phase: phases.has(value.phase) ? value.phase : "checking",
				reason: reasons.has(value.reason) ? value.reason : "unclassified",
				...(value.capabilities
					? {
							capabilities: Object.freeze({
								...current.capabilities,
								indexeddb: capability(value.capabilities.indexeddb),
								webgl2: capability(value.capabilities.webgl2),
							}),
						}
					: {}),
				...(value.catalogVersion === undefined
					? {}
					: {
							catalogVersion: technicalVersion(
								value.catalogVersion,
								"unavailable",
							),
						}),
			});
		},
		reset() {
			if (!closed) publish(initial());
		},
		close() {
			if (closed) return;
			closed = true;
			publish({ ...current, phase: "closed", reason: "disposed" });
			listeners.clear();
		},
	};
}
