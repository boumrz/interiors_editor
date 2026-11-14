import type { ExportPortableBackupResult } from "../application/export-portable-backup";
import type {
	CancellationSignalPort,
	ProjectSourceRecoveryPort,
	ProjectStorageNamespace,
	ProjectStorageSourceStatus,
	ProjectSummary,
} from "../application/ports";

/** Query/export addressing only; it is never a Project or archive member. */
export interface BrowserReadonlyProjectAddress {
	readonly storageNamespace: ProjectStorageNamespace;
	readonly projectId: string;
	readonly revisionId: string;
}
export interface BrowserReadonlyProjectsDirectory {
	readonly kind: "projects";
	readonly projects: readonly (ProjectSummary & {
		readonly storageNamespace: ProjectStorageNamespace;
	})[];
	readonly storageSources: readonly ProjectStorageSourceStatus[];
	readonly recoveryNeeded?: true;
}
/** A trusted read admission supplies no controller or mutation capability. */
export interface BrowserReadonlyProjectsPort {
	readonly signal: AbortSignal;
	getSourceSignal(namespace: ProjectStorageNamespace): AbortSignal | undefined;
	getSourceRecovery(
		namespace: ProjectStorageNamespace,
	): ProjectSourceRecoveryPort | undefined;
	readDirectory(): Promise<BrowserReadonlyProjectsDirectory>;
	exportBackup(
		address: BrowserReadonlyProjectAddress,
		format: "legacy" | "registered",
		signal?: CancellationSignalPort,
	): Promise<
		ExportPortableBackupResult | { readonly kind: "verification-unavailable" }
	>;
}
