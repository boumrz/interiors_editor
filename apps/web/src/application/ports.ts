import type {
	CustomGlbAssetDefinition,
	Project,
	Revision,
} from "../domain/project";
import type { ProjectV2, RevisionV2 } from "../domain/project-v2";
import type { StorageEstimate } from "./storage-pressure";
import type { PortableBackupIngressReason } from "./portable-backup-reasons";

export interface ClockPort {
	now(): string;
}

export interface IdPort {
	next(): string;
}

export interface ProjectSerializerPort {
	serialize(project: Project | ProjectV2): string;
}

export interface ChecksumPort {
	sha256(value: string): Promise<string>;
}

/** Application-owned cancellation view; browser AbortSignal is one adapter. */
export interface CancellationSignalPort {
	readonly aborted: boolean;
}

/** A binary container adapter; application code owns which entries are complete. */
export interface PortableBackupEncoderPort {
	encode(entries: Readonly<Record<string, Uint8Array>>): Uint8Array;
}

/**
 * Opens only a complete, integrity-checked Portable Backup envelope. The
 * archive adapter owns container and manifest validation; its Project member
 * remains raw until the application validates and publishes a new identity.
 */
export interface PortableBackupDecoderPort {
	decode(
		archive: Uint8Array,
		signal?: CancellationSignalPort,
	): Promise<PortableBackupDecodeResult>;
}

export type PortableBackupDecodeResult =
	| {
			readonly kind: "accepted";
			readonly projectBytes: Uint8Array;
			/** Exact object owned by a fully validated registered V1 decoder. */
			readonly projectMember?: {
				readonly format: "runtime-v1-wire" | "runtime-v1-floor-yaw" | "runtime-v1-legacy";
				readonly project: unknown;
			};
			/** Omitted for older resource-free envelopes; every supplied byte is verified. */
			readonly resources?: readonly CustomAssetResource[];
	  }
	| { readonly kind: "verification-unavailable" }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "PORTABLE_BACKUP_CANCELLED"
				| "PORTABLE_BACKUP_CHECKSUM_MISMATCH"
				| "PORTABLE_BACKUP_FUTURE_SCHEMA"
				| "PORTABLE_BACKUP_LIMIT_EXCEEDED"
				| "PORTABLE_BACKUP_INVALID"
				| PortableBackupIngressReason;
	  };

/** Formats the exact durable object separately from its internal revision serializer. */
export interface PortableBackupArchiveWriterPort {
	encode(input: {
		readonly project: Project;
		readonly createdAt: string;
		readonly resources: readonly CustomAssetResource[];
	}, signal?: CancellationSignalPort): Promise<
		| { readonly kind: "encoded"; readonly bytes: Uint8Array; readonly mimeType: "application/zip" }
		| { readonly kind: "rejected"; readonly reasonCode: PortableBackupIngressReason }
	>;
}

/**
 * Reopens staged local resources and proves the canonical Project can rebuild
 * its disposable read/render projections before a new durable identity exists.
 */
export interface PortableBackupSmokeCheckPort {
	/**
	 * The imported archive's exact custom bytes form an isolated, disposable
	 * clean profile. A smoke check must not fall back to browser-pinned bytes.
	 */
	verify(
		project: Project,
		resources: readonly CustomAssetResource[],
	): Promise<boolean>;
}

/** Optional trusted destination profile; it never supplies a publication path. */
export type PortableBackupImportAdmissionFailure =
	| Extract<PortableBackupDecodeResult, { readonly kind: "rejected" }>
	| { readonly kind: "verification-unavailable" };

export interface PortableBackupImportProfilePort {
	readonly source: Project;
	/** Trusted destination identity lookup before Project serialization or Revision allocation. */
	selectProjectId?(
		proposedProjectId: string,
		signal?: CancellationSignalPort,
	): Promise<
		| PortableBackupImportAdmissionFailure
		| { readonly kind: "selected"; readonly projectId: string }
	>;
	seal(
		candidate: PublicationCandidate,
		signal?: CancellationSignalPort,
	): Promise<
		| PortableBackupImportAdmissionFailure
		| { readonly kind: "accepted"; readonly candidate: PublicationCandidate }
	>;
	beforePublish(
		candidate: PublicationCandidate,
		signal?: CancellationSignalPort,
	): Promise<
		PortableBackupImportAdmissionFailure | { readonly kind: "accepted" }
	>;
}

export interface PortableBackupImportAdmissionPort {
	prepare(
		decoded: Extract<PortableBackupDecodeResult, { readonly kind: "accepted" }>,
		source: Project,
		resources: readonly CustomAssetResource[],
		signal?: CancellationSignalPort,
	): Promise<
		| PortableBackupImportAdmissionFailure
		| {
				readonly kind: "accepted";
				readonly profile: PortableBackupImportProfilePort;
		  }
	>;
	isRetryBlocked(candidate: DurablePublicationCandidate): boolean;
}

/** Hashes untrusted binary resources without first turning them into a string. */
export interface BinaryChecksumPort {
	sha256Bytes(bytes: Uint8Array): Promise<string>;
}

/** Cancellable request seam; the browser AbortSignal satisfies this contract. */
export interface CatalogRequestSignalPort extends CancellationSignalPort {
	addEventListener(
		type: "abort",
		listener: () => void,
		options?: { readonly once?: boolean },
	): void;
	removeEventListener(type: "abort", listener: () => void): void;
}

export type CatalogResourceMediaType = "image/png" | "model/gltf-binary";

export interface CatalogResourceDescriptor {
	readonly byteLength: number;
	readonly mediaType: CatalogResourceMediaType;
	readonly sha256: string;
}

export interface VersionedCatalogVariant {
	readonly label: string;
	readonly resource: CatalogResourceDescriptor;
	readonly variantId: string;
}

export interface VersionedCatalogVariantSlot {
	readonly kind: "model-resource";
	readonly label: string;
	readonly slotId: string;
	readonly variants: readonly VersionedCatalogVariant[];
}

export interface VersionedCatalogAsset {
	readonly anchorClass: "floor" | "wall";
	readonly assetId: string;
	readonly category:
		| "accessory"
		| "appliance"
		| "electronics"
		| "lighting"
		| "plumbing"
		| "seating"
		| "sleep"
		| "storage"
		| "tables";
	readonly dimensionsMm: {
		readonly depth: number;
		readonly height: number;
		readonly width: number;
	};
	readonly frontDirection: "positive-z";
	readonly label: string;
	readonly resource: CatalogResourceDescriptor;
	readonly section:
		| "accessories"
		| "appliances-electronics"
		| "furniture"
		| "lighting"
		| "plumbing";
	readonly thumbnail?: CatalogResourceDescriptor;
	readonly variantSlots: readonly VersionedCatalogVariantSlot[];
}

export interface VersionedCatalogPublication {
	readonly assets: readonly VersionedCatalogAsset[];
	readonly catalogVersion: string;
	readonly envelopeHash: string;
	readonly publishedAt: string;
}

export type CatalogPublicationResult =
	| {
			readonly kind: "available";
			readonly publication: VersionedCatalogPublication;
	  }
	| { readonly kind: "cancelled" }
	| { readonly kind: "unavailable" }
	| {
			readonly kind: "invalid-envelope";
			readonly reasonCode: "CATALOG_ENVELOPE_SCHEMA_INVALID";
	  };

export type CatalogResourceResult =
	| {
			readonly bytes: Uint8Array;
			readonly kind: "available";
			readonly resourceHash: string;
	  }
	| { readonly kind: "cancelled" }
	| { readonly kind: "integrity-failed" }
	| { readonly kind: "unavailable" };

/** Read-only remote control-plane boundary. Project state never crosses it. */
export interface CatalogGatewayPort {
	currentPublication(
		signal?: CatalogRequestSignalPort,
	): Promise<CatalogPublicationResult>;
	resource(
		descriptor: CatalogResourceDescriptor,
		signal?: CatalogRequestSignalPort,
	): Promise<CatalogResourceResult>;
}

/** Browser-reported local capacity is advisory and must never be treated as an eviction guarantee. */
export interface StorageEstimatePort {
	estimateStorage(): Promise<StorageEstimate>;
	/**
	 * Called only after an explicit user action. `undefined` keeps unsupported
	 * or failing browser capability distinct from an explicit refusal.
	 */
	requestPersistentStorage?(): Promise<boolean | undefined>;
}

export interface CustomAssetResource {
	readonly bytes: Uint8Array;
	readonly resourceHash: string;
}

/**
 * A durable repository-local GC root for newly written exact resource bytes.
 * It is deliberately neither Project nor Revision state: one survives every
 * crash between a pin write and the final new-Project pointer outcome.
 */
export interface PinStagingLease {
	readonly leaseId: string;
	readonly resourceHashes: readonly string[];
}

/** The exact durable pointer a staging root is waiting to become. */
export interface PinStagingPublication {
	readonly projectId: string;
	readonly revisionId: string;
}

export interface PinStagingLeasePort {
	/** Strong substrates require the immutable publication identity before any bytes. */
	readonly requiresPublicationContext?: true;
	begin(resourceHashes: readonly string[], context?: {
		readonly candidate: DurablePublicationCandidate;
		readonly expectedBaseRevisionId?: string;
	}): Promise<PinStagingLease>;
	markForPublication(
		lease: PinStagingLease,
		publication: PinStagingPublication,
	): Promise<void>;
	complete(lease: PinStagingLease): Promise<void>;
	discard(lease: PinStagingLease): Promise<void>;
}

/** Immutable local resources are addressed by their verified SHA-256 digest. */
export interface CustomAssetResourceStorePort {
	delete(resourceHash: string): Promise<void>;
	read(resourceHash: string): Promise<Uint8Array | undefined>;
	/** Atomically protects an existing row from an earlier staging owner's cancellation. Never creates bytes. */
	protectExistingResource?(resourceHash: string): Promise<boolean>;
	writeIfAbsent(
		resource: CustomAssetResource,
	): Promise<{ readonly kind: "already-present" | "stored" }>;
	/**
	 * Cross-store import staging records the owning durable lease in the same
	 * transaction as a newly written byte record. This prevents recovery from
	 * ever deleting a same-hash byte another workflow won. An already-present
	 * result atomically protects the existing row from its earlier owner's cleanup.
	 */
	writeIfAbsentPinned?(
		resource: CustomAssetResource,
		leaseId: string,
	): Promise<{ readonly kind: "already-present" | "stored" }>;
	/** Deletes only a byte record still owned by this unresolved staging lease. */
	deletePinnedIfOwned?(resourceHash: string, leaseId: string): Promise<void>;
	/** Converts a staged byte root to the durable Project root after publication. */
	releasePinned?(resourceHash: string, leaseId: string): Promise<void>;
	/** Replaces bytes at an already verified immutable address in one local transaction. */
	writeReplacing?(resource: CustomAssetResource): Promise<void>;
	/** Replaces a complete verified recovery set in one local transaction. */
	writeReplacingBatch?(
		resources: readonly CustomAssetResource[],
	): Promise<void>;
}

/** A device-local, reusable catalogue of verified custom GLB definitions. */
export interface CustomAssetLibraryPort {
	list(): Promise<readonly CustomGlbAssetDefinition[]>;
	listRemovedResourceHashes?(): Promise<readonly string[]>;
	/** Hides only the local catalog card; Project/history/resource ownership is unchanged. */
	remove?(assetDefinitionId: string): Promise<{ readonly kind: "removed" | "not-found" }>;
	register(
		asset: CustomGlbAssetDefinition,
		resource: CustomAssetResource,
		options?: { readonly restoreRemoved?: boolean },
	): Promise<{
		readonly asset: CustomGlbAssetDefinition;
		readonly kind: "already-present" | "registered" | "suppressed";
	}>;
}

export interface PublicationCandidate {
	readonly project: Project;
	readonly revision: Revision;
}

/** A v2 candidate can coexist in the same versioned store with an older v1 revision. */
export interface V2PublicationCandidate {
	readonly project: ProjectV2;
	readonly revision: RevisionV2;
}

export type DurablePublicationCandidate =
	| PublicationCandidate
	| V2PublicationCandidate;

export type PublicationFailureReason =
	| "PERSISTENCE_WRITE_FAILED"
	| "PERSISTENCE_QUOTA_EXCEEDED"
	| "PROJECT_BACKUP_ENVELOPE_EXCEEDED"
	| "PROJECT_HISTORY_RESOURCE_LIMIT";

export type PublicationResult<
	FailureReason extends PublicationFailureReason = PublicationFailureReason,
> =
	| { readonly kind: "durable" }
	| { readonly kind: "persist-failed"; readonly reasonCode: FailureReason };

/**
 * A command that starts from an already-opened revision must use a
 * compare-and-swap rather than silently replacing a newer current pointer.
 */
export type NextRevisionPublicationResult<
	FailureReason extends PublicationFailureReason = PublicationFailureReason,
> =
	| { readonly kind: "durable" }
	| { readonly kind: "stale-base" }
	| { readonly kind: "persist-failed"; readonly reasonCode: FailureReason };

export interface ProjectRevisionPublicationPort<
	FailureReason extends PublicationFailureReason = PublicationFailureReason,
> {
	publishNextRevision(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId: string,
		/** History moves a pointer to an exact existing owned Revision without recreating it. */
		intent?: "history",
	): Promise<NextRevisionPublicationResult<FailureReason>>;
}

/**
 * A monotonic project-scoped fence. It is deliberately not serialized into a
 * Project or Revision: the persistence boundary owns writer coordination.
 */
export const WRITER_LEASE_DURATION_MS = 3_000;
export const WRITER_LEASE_HEARTBEAT_MS = 750;

export interface WriterLease {
	readonly expiresAtEpochMs: number;
	readonly fencingToken: number;
	readonly ownerId: string;
	readonly projectId: string;
}

export type WriterLeaseAcquisition =
	| { readonly kind: "acquired"; readonly lease: WriterLease }
	| { readonly kind: "held-by-another-writer" };

export interface WriterLeaseStorePort {
	acquireWriterLease(
		projectId: string,
		ownerId: string,
	): Promise<WriterLeaseAcquisition>;
	inspectWriterLease(projectId: string): Promise<WriterLease | undefined>;
	isWriterLeaseCurrent(lease: WriterLease): Promise<boolean>;
	takeOverWriterLease(projectId: string, ownerId: string): Promise<WriterLease>;
}

/**
 * A context-local, reload-stable acknowledgement gate. Once this context has
 * observed another writer, expiry alone must not silently promote it to a
 * writer; only the explicit confirmed takeover clears the gate.
 */
export interface WriterTakeoverRequirementStorePort {
	requiresExplicitTakeover(projectId: string): boolean;
	requireExplicitTakeover(projectId: string): void;
	clearExplicitTakeoverRequirement(projectId: string): void;
}

export type WriterAccess =
	| { readonly kind: "writable"; readonly fencingToken?: number }
	| { readonly kind: "read-only"; readonly reasonCode: "WRITER_LEASE_HELD" }
	| { readonly kind: "not-ready" };

/** Controller-facing capability; presentation remains intentionally separate. */
export interface WriterLeaseControllerPort {
	inspectWriterAccess(projectId: string): Promise<WriterAccess>;
	takeOverWriterLease(projectId: string): Promise<WriterAccess>;
	consumeLostWriterLease(): boolean;
}

export type ProjectLoadResult =
	| { readonly kind: "empty" }
	| {
			readonly kind: "durable";
			readonly candidate: DurablePublicationCandidate;
	  }
	| {
			readonly kind: "recovery-needed";
			readonly reasonCode: "PERSISTENCE_CORRUPT";
	  };

/** Trusted query/composition routing only; never a canonical Project or file member. */
export type ProjectStorageNamespace = "legacy" | "browser-registered";
export interface ProjectStorageOwnerOptions {
	readonly storageNamespace?: ProjectStorageNamespace;
}
export interface ProjectOpenOptions extends ProjectStorageOwnerOptions {
	readonly initialAction?: "rename";
}
export interface ProjectTransferExportOptions
	extends ProjectStorageOwnerOptions {
	readonly signal?: CancellationSignalPort;
}
export type ProjectStorageSourceStatus =
	| {
			readonly storageNamespace: ProjectStorageNamespace;
			readonly kind: "available" | "unavailable" | "recovery-required";
	  }
	| {
			readonly storageNamespace: "browser-registered";
			readonly kind: "not-provisioned";
			readonly history: "unknown";
	  };

/**
 * A privacy-safe card projection of one exact Durable Revision. It is query
 * output only: canonical Project data remains in the revision envelope.
 */
export interface ProjectSummary {
	readonly storageNamespace?: ProjectStorageNamespace;
	readonly name: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly updatedAt: string;
}

export type ProjectDirectoryResult =
	| { readonly kind: "empty" }
	| {
			readonly kind: "populated";
			readonly projects: readonly ProjectSummary[];
			/** A healthy card remains available while another stored record needs recovery. */
			readonly recoveryNeeded?: true;
	  }
	| {
			readonly kind: "recovery-needed";
			readonly reasonCode: "PERSISTENCE_CORRUPT";
	  };

/** Read-only project-directory query; mutations keep using ProjectRepositoryPort. */
export interface ProjectDirectoryPort {
	listProjects(): Promise<ProjectDirectoryResult>;
	loadProject(projectId: string): Promise<ProjectLoadResult>;
}

/** Original stored source for recovery; never an accepted Project or complete backup. */
export interface UnverifiedProjectSource {
	readonly kind: "unverified-source";
	readonly projectId: string;
	readonly revisionId: string;
	readonly serializedProject: string;
}

export interface ProjectSourceRecoveryPort {
	listRecoverySources(): Promise<readonly Omit<UnverifiedProjectSource, "serializedProject">[]>;
	/** Reads just the selected current source, refusing a changed pointer. */
	readRecoverySource(projectId: string, expectedRevisionId: string): Promise<UnverifiedProjectSource | undefined>;
}

/**
 * Explicit confirmed deletion removes one Project pointer and all of its owned
 * revisions. Shared immutable resource bytes remain a separate global-GC
 * concern, because another Project or library definition can still own them.
 */
export interface ProjectDeletionPort {
	permanentlyDeleteProject(
		projectId: string,
		lease?: WriterLease,
	): Promise<
		| { readonly kind: "permanently-deleted" | "not-found" }
		| { readonly kind: "persist-failed" }
	>;
}

export interface ProjectRepositoryPort<
	FailureReason extends PublicationFailureReason = PublicationFailureReason,
> {
	publish(
		candidate: DurablePublicationCandidate,
		/** Existing-Project commands bind to their opened base; omitted for create/import. */
		expectedBaseRevisionId?: string,
	): Promise<PublicationResult<FailureReason>>;
	loadCurrent(): Promise<ProjectLoadResult>;
	recover(): Promise<{ readonly kind: "recovered" }>;
}
