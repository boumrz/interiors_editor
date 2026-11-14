import type { StoredCurrent } from "../adapters/persistence/durable-project-repository";
import type { DurablePublicationCandidate } from "../application/ports";

export type ReleaseCapability = "indexeddb" | "webgl2";

export interface ReleaseManifest {
	readonly appBuildId: string;
	readonly assetSchemas: {
		readonly readable: readonly number[];
		readonly writable: readonly number[];
	};
	readonly catalogSchemas: {
		readonly readable: readonly number[];
		readonly writable: readonly number[];
	};
	readonly minimumCapabilities: readonly ReleaseCapability[];
	readonly projectSchemas: {
		readonly readable: readonly number[];
		readonly writable: readonly number[];
	};
	readonly version: 1;
	readonly workerProtocolVersion: 1;
}

export interface ReleaseRuntimeCapabilities {
	readonly indexeddb: boolean;
	readonly webgl2: boolean;
}

export interface ReleaseRecoveryRecord {
	readonly projectId?: string;
	readonly serializedProject?: string;
}

export type ReleaseStartupOutcome =
	| { readonly kind: "writable" }
	| { readonly kind: "migration-in-progress" }
	| {
			readonly kind: "read-only/exportable";
			readonly recovery: ReleaseRecoveryRecord;
	  };

export interface ReleaseStartupInput {
	readonly capabilities: ReleaseRuntimeCapabilities;
	readonly hasControllingWorker?: boolean;
	readonly onModeChange?: (mode: ReleaseStartupOutcome["kind"]) => void;
	readonly shellManifest: unknown;
	readonly workerManifest: unknown | undefined;
}

export interface ReleaseMigration {
	readonly fromProjectSchema: number;
	readonly migrate: (
		source: DurablePublicationCandidate,
	) => Promise<DurablePublicationCandidate>;
	readonly toProjectSchema: number;
}

export interface ReleaseMigrationPublication {
	publishMigration(
		publication: {
			readonly candidate: DurablePublicationCandidate;
			readonly expectedBaseRevisionId: string;
		},
	): Promise<{ readonly kind: "durable" | "persist-failed" }>;
}

interface CurrentReader {
	readCurrent(): Promise<StoredCurrent>;
}

interface ReleaseStartupDependencies {
	readonly migrations?: readonly ReleaseMigration[];
	readonly publishMigration?: ReleaseMigrationPublication["publishMigration"];
	/** Completes durable cross-store cleanup before any controller gets a write path. */
	readonly reconcileBeforeWrite?: () => Promise<void>;
}

function includesVersion(versions: readonly number[], candidate: number): boolean {
	return versions.includes(candidate);
}

function isPositiveSafeInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isSchemaVersion(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasUniqueVersions(versions: readonly number[]): boolean {
	return new Set(versions).size === versions.length;
}

function isVersionRange(value: unknown): value is readonly number[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every(isPositiveSafeInteger) &&
		hasUniqueVersions(value)
	);
}

function isCapability(value: unknown): value is ReleaseCapability {
	return value === "indexeddb" || value === "webgl2";
}

/** Reject malformed startup metadata before it can grant a write path. */
export function isReleaseManifest(value: unknown): value is ReleaseManifest {
	if (!value || typeof value !== "object") return false;
	const manifest = value as Partial<ReleaseManifest>;
	return (
		manifest.version === 1 &&
		typeof manifest.appBuildId === "string" &&
		manifest.appBuildId.length > 0 &&
		manifest.workerProtocolVersion === 1 &&
		Array.isArray(manifest.minimumCapabilities) &&
		manifest.minimumCapabilities.every(isCapability) &&
		new Set(manifest.minimumCapabilities).size ===
			manifest.minimumCapabilities.length &&
		!!manifest.assetSchemas &&
		isVersionRange(manifest.assetSchemas.readable) &&
		isVersionRange(manifest.assetSchemas.writable) &&
		manifest.assetSchemas.writable.every((version) =>
			manifest.assetSchemas?.readable.includes(version),
		) &&
		!!manifest.projectSchemas &&
		isVersionRange(manifest.projectSchemas.readable) &&
		isVersionRange(manifest.projectSchemas.writable) &&
		manifest.projectSchemas.writable.every((version) =>
			manifest.projectSchemas?.readable.includes(version),
		) &&
		!!manifest.catalogSchemas &&
		isVersionRange(manifest.catalogSchemas.readable) &&
		isVersionRange(manifest.catalogSchemas.writable) &&
		manifest.catalogSchemas.writable.every((version) =>
			manifest.catalogSchemas?.readable.includes(version),
		)
	);
}

function manifestsAgree(
	shell: ReleaseManifest,
	worker: ReleaseManifest | undefined,
): boolean {
	if (!worker) return true;
	return JSON.stringify(shell) === JSON.stringify(worker);
}

function capabilitiesMeet(
	manifest: ReleaseManifest,
	capabilities: ReleaseRuntimeCapabilities,
): boolean {
	return manifest.minimumCapabilities.every((capability) => capabilities[capability]);
}

function recoveryRecord(current: StoredCurrent): ReleaseRecoveryRecord {
	if (current.kind !== "candidate") return {};
	const candidate = current.candidate as unknown as {
		readonly project?: { readonly projectId?: unknown };
		readonly revision?: { readonly serializedProject?: unknown };
	};
	return {
		...(typeof candidate.project?.projectId === "string"
			? { projectId: candidate.project.projectId }
			: {}),
		...(typeof candidate.revision?.serializedProject === "string"
			? { serializedProject: candidate.revision.serializedProject }
			: {}),
	};
}

function candidateProjectSchema(
	candidate: DurablePublicationCandidate,
): number | undefined {
	const untrusted = candidate as unknown as {
		readonly project?: { readonly schemaVersion?: unknown };
		readonly revision?: { readonly schemaVersion?: unknown };
	};
	const projectVersion = untrusted.project?.schemaVersion;
	const revisionVersion = untrusted.revision?.schemaVersion;
	return isSchemaVersion(projectVersion) && projectVersion === revisionVersion
		? projectVersion
		: undefined;
}

/**
 * Checks the release boundary before ProjectController can expose editing.
 * The source candidate is read-only throughout migration; only the injected
 * fenced publisher may move the current pointer after a complete replacement
 * candidate is ready.
 */
export class ReleaseStartupCoordinator {
	public constructor(
		private readonly store: CurrentReader,
		private readonly dependencies: ReleaseStartupDependencies = {},
	) {}

	public async handshake(
		input: ReleaseStartupInput,
	): Promise<ReleaseStartupOutcome> {
		try {
			await this.dependencies.reconcileBeforeWrite?.();
		} catch {
			const outcome: ReleaseStartupOutcome = {
				kind: "read-only/exportable",
				recovery: {},
			};
			input.onModeChange?.(outcome.kind);
			return outcome;
		}
		const shellManifest = isReleaseManifest(input.shellManifest)
			? input.shellManifest
			: undefined;
		const workerManifest = isReleaseManifest(input.workerManifest)
			? input.workerManifest
			: undefined;
		const current = await this.store.readCurrent();
		const readonly = (): ReleaseStartupOutcome => {
			const outcome: ReleaseStartupOutcome = {
				kind: "read-only/exportable",
				recovery: recoveryRecord(current),
			};
			input.onModeChange?.(outcome.kind);
			return outcome;
		};

		if (
			!shellManifest ||
			(input.hasControllingWorker === true && !workerManifest) ||
			!manifestsAgree(shellManifest, workerManifest) ||
			!capabilitiesMeet(shellManifest, input.capabilities)
		) {
			return readonly();
		}
		if (current.kind === "empty") {
			input.onModeChange?.("writable");
			return { kind: "writable" };
		}
		// A corrupt global pointer has no candidate bytes to validate or export at
		// this boundary. The established Project controller owns that recovery
		// state and must still expose unaffected Project cards; do not turn one
		// bad pointer into a global startup lockout.
		if (current.kind === "corrupt") {
			input.onModeChange?.("writable");
			return { kind: "writable" };
		}
		if (current.kind !== "candidate") return readonly();

		const sourceSchema = candidateProjectSchema(current.candidate);
		if (sourceSchema === undefined) return readonly();
		if (includesVersion(shellManifest.projectSchemas.writable, sourceSchema)) {
			input.onModeChange?.("writable");
			return { kind: "writable" };
		}

		const migration = this.dependencies.migrations?.find(
			(candidate) =>
				candidate.fromProjectSchema === sourceSchema &&
				includesVersion(shellManifest.projectSchemas.writable, candidate.toProjectSchema),
		);
		if (!migration) return readonly();

		input.onModeChange?.("migration-in-progress");
		if (!this.dependencies.publishMigration) {
			return { kind: "migration-in-progress" };
		}
		try {
			const migrated = await migration.migrate(current.candidate);
			if (candidateProjectSchema(migrated) !== migration.toProjectSchema) {
				return readonly();
			}
			const publication = await this.dependencies.publishMigration({
				candidate: migrated,
				expectedBaseRevisionId: current.candidate.revision.revisionId,
			});
			if (publication.kind !== "durable") return readonly();
			input.onModeChange?.("writable");
			return { kind: "writable" };
		} catch {
			return readonly();
		}
	}
}
