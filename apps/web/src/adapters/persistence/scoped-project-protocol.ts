import type {
	BinaryChecksumPort,
	DurablePublicationCandidate,
	ChecksumPort,
	WriterTakeoverRequirementStorePort,
} from "../../application/ports";
import type { SessionHistoryRootSnapshot } from "../../application/session-retention-project-repository";

export type ScopedProjectStoreName =
	| "scope-metadata"
	| "projects"
	| "revisions"
	| "staging"
	| "writer-fences"
	| "publication-attempts"
	| "pin-staging-leases"
	| "resources"
	| "library";

/** One host-owned, serialized capability. The adapter owns its identity and lifetime. */
export interface ScopedProjectAccess {
	readonly scope: string;
	readonly signal: AbortSignal;
	reserveId(kind: "attempt" | "lease"): Promise<string>;
	transact<T>(
		names: readonly ScopedProjectStoreName[],
		mode: "readonly" | "readwrite",
		operation: (transaction: IDBTransaction) => Promise<T>,
	): Promise<T>;
}

export interface ScopedProjectStore {
	run<T>(operation: (access: ScopedProjectAccess) => Promise<T>): Promise<T>;
}

export interface ScopedWriterRecord {
	readonly scope: string;
	readonly projectId: string;
	readonly ownerId: string;
	readonly fencingToken: number;
	readonly expiresAtEpochMs: number;
	readonly deleted: boolean;
}

export interface ScopedWriterRequest {
	readonly scope: string;
	readonly projectId: string;
	readonly ownerId: string;
	readonly nowEpochMs: number;
	readonly durationMs: number;
	readonly explicitTakeover: boolean;
}

/** These callbacks are supplied only by trusted host composition, never by a file. */
export interface ScopedProjectProtocol {
	readPinnedBlob?(blob: Blob): Promise<ArrayBuffer>;
	/** Optional host-owned identity proof inside the same native new-Revision transaction. */
	assertNewRevisionIdentity?(
		transaction: IDBTransaction,
		candidate: DurablePublicationCandidate,
	): Promise<void>;
	operationIdPrefix(scope: string, kind: "attempt" | "lease"): string;
	decideWriterLease(
		request: ScopedWriterRequest,
		stored: unknown,
	):
		| { readonly kind: "acquired"; readonly writer: ScopedWriterRecord }
		| { readonly kind: "held-by-another-writer" };
}

export interface ScopedProjectRepositoryDependencies {
	readonly ownerId: string;
	readonly takeoverRequirements: WriterTakeoverRequirementStorePort;
	readonly nowEpochMs: () => number;
	readonly checksum: ChecksumPort;
	readonly binaryChecksum: BinaryChecksumPort;
	readonly sessionRoots?: () => SessionHistoryRootSnapshot;
}
