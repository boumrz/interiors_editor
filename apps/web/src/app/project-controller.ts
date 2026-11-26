import { applyInteriorCommand as draftInteriorCommand, type InteriorCommand, type InteriorMutation, selectedInteriorLayoutId, supportedGuestsFor } from "../domain/interior-project";
import { findRoomForFloorItem } from "../domain/parametric-item";
import { publishProjectMutation } from "../application/project-mutation-publication";
import type { ClockPort, ChecksumPort, IdPort, ProjectSerializerPort } from "../application/ports";
import {copyProject} from "../domain/copy-project";
import {freezeBrowserBackupValue} from "../application/browser-backup-representability";
import type { ProductMetric, ProductMetricSink } from "../application/editor-product-metrics";
import type {
	AddConstrainedPartitionStatus,
	AddConstrainedPartitionUseCase,
	AddConstrainedPartitionUseCaseResult,
} from "../application/add-constrained-partition";
import type {
	AddWallToProjectV2Status,
	AddWallToProjectV2UseCase,
	AddWallToProjectV2UseCaseResult,
} from "../application/add-wall-to-project-v2";
import type {
	ConfigureRectangularRoomStatus,
	ConfigureRectangularRoomUseCase,
	ConfigureRectangularRoomUseCaseResult,
} from "../application/configure-rectangular-room";
import type {
	CreateCustomGlbItemInputWithBytes,
	CreateCustomGlbFloorItemStatus,
	CreateCustomGlbFloorItemUseCase,
	CreateCustomGlbFloorItemUseCaseResult,
} from "../application/create-custom-glb-floor-item";
import type {
	CreateParametricFloorItemStatus,
	CreateParametricFloorItemUseCase,
	CreateParametricFloorItemUseCaseResult,
} from "../application/create-parametric-floor-item";
import type {
	CreateParametricFloorItemV2Status,
	CreateParametricFloorItemV2UseCase,
	CreateParametricFloorItemV2UseCaseResult,
} from "../application/create-parametric-floor-item-v2";
import type {
	CreateParametricWallItemStatus,
	CreateParametricWallItemUseCase,
	CreateParametricWallItemUseCaseResult,
} from "../application/create-parametric-wall-item";
import type {
	CreateProjectResult,
	CreateProjectStatus,
	CreateProjectUseCase,
} from "../application/create-project";
import type {
	CreateRectangularRoomLoopStatus,
	CreateRectangularRoomLoopUseCase,
	CreateRectangularRoomLoopUseCaseResult,
} from "../application/create-rectangular-room-loop";
import type {
	DeleteConstrainedWallStatus,
	DeleteConstrainedWallUseCase,
	DeleteConstrainedWallUseCaseResult,
} from "../application/delete-constrained-wall";
import type {
	DeleteParametricFloorItemStatus,
	DeleteParametricFloorItemUseCase,
	DeleteParametricFloorItemUseCaseResult,
} from "../application/delete-parametric-floor-item";
import type {
	DeleteParametricFloorItemV2Status,
	DeleteParametricFloorItemV2UseCase,
	DeleteParametricFloorItemV2UseCaseResult,
} from "../application/delete-parametric-floor-item-v2";
import type {
	DeleteParametricWallItemStatus,
	DeleteParametricWallItemUseCase,
	DeleteParametricWallItemUseCaseResult,
} from "../application/delete-parametric-wall-item";
import type {
	DeleteWallFromProjectV2Input,
	DeleteWallFromProjectV2Status,
	DeleteWallFromProjectV2UseCase,
	DeleteWallFromProjectV2UseCaseResult,
} from "../application/delete-wall-from-project-v2";
import type {
	AddDoorOpeningToProjectUseCase,
	AddWindowOpeningToProjectUseCase,
	DeleteDoorOpeningFromProjectUseCase,
	DoorOpeningProjectMutationStatus,
	DoorOpeningProjectMutationUseCaseResult,
	MoveDoorOpeningInProjectUseCase,
	UpdateDoorOpeningInProjectUseCase,
	UpdateDoorOpeningInProjectUseCaseResult,
} from "../application/door-opening-project";
import type {
	ExpandOrthogonalGridStatus,
	ExpandOrthogonalGridUseCase,
	ExpandOrthogonalGridUseCaseResult,
} from "../application/expand-orthogonal-grid";
import type {
	ExportLocalProjectJsonResult,
	ExportLocalProjectJsonUseCase,
} from "../application/export-local-project-json";
import {
	type ExportPortableBackupResult,
	ExportPortableBackupUseCase,
} from "../application/export-portable-backup";
import type {
	AddGeneralWallToProjectUseCase,
	ChangeGeneralWallThicknessUseCase,
	DeleteGeneralVertexUseCase,
	DeleteGeneralWallFromProjectUseCase,
	GeneralWallProjectMutationStatus,
	GeneralWallProjectMutationUseCaseResult,
	MoveGeneralVertexUseCase,
	MoveGeneralWallUseCase,
	ReverseGeneralWallUseCase,
	SplitGeneralWallUseCase,
} from "../application/general-wall-project-mutations";
import type {
	ImportLocalProjectJsonResult,
	ImportLocalProjectJsonStatus,
	ImportLocalProjectJsonUseCase,
} from "../application/import-local-project-json";
import type {
	ImportPortableBackupResult,
	ImportPortableBackupStatus,
	ImportPortableBackupUseCase,
} from "../application/import-portable-backup";
import type {
	MigrateProjectV1ToV2Status,
	MigrateProjectV1ToV2UseCase,
	MigrateProjectV1ToV2UseCaseResult,
} from "../application/migrate-project-v1-to-v2";
import type {
	MoveParametricFloorItemStatus,
	MoveParametricFloorItemUseCase,
	MoveParametricFloorItemUseCaseResult,
} from "../application/move-parametric-floor-item";
import type {
	MoveParametricFloorItemV2Status,
	MoveParametricFloorItemV2UseCase,
	MoveParametricFloorItemV2UseCaseResult,
} from "../application/move-parametric-floor-item-v2";
import type {
	MoveParametricWallItemStatus,
	MoveParametricWallItemUseCase,
	MoveParametricWallItemUseCaseResult,
} from "../application/move-parametric-wall-item";
import type {
	BinaryChecksumPort,
	CancellationSignalPort,
	CustomAssetLibraryPort,
	CustomAssetResourceStorePort,
	DurablePublicationCandidate,
	NextRevisionPublicationResult,
	ProjectDeletionPort,
	ProjectDirectoryPort,
	ProjectDirectoryResult,
	ProjectOpenOptions,
	ProjectStorageOwnerOptions,
	ProjectStorageSourceStatus,
	ProjectTransferExportOptions,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	PublicationCandidate,
	PortableBackupArchiveWriterPort,
	PortableBackupImportAdmissionPort,
	PublicationFailureReason,
	StorageEstimatePort,
	V2PublicationCandidate,
	WriterAccess,
	WriterLeaseControllerPort,
} from "../application/ports";
import type {
	RecolorParametricFloorItemStatus,
	RecolorParametricFloorItemUseCase,
	RecolorParametricFloorItemUseCaseResult,
} from "../application/recolor-parametric-floor-item";
import type {
	RecolorParametricWallItemStatus,
	RecolorParametricWallItemUseCase,
	RecolorParametricWallItemUseCaseResult,
} from "../application/recolor-parametric-wall-item";
import type {
	RecoverUnresolvedCustomGlbReferencesStatus,
	RecoverUnresolvedCustomGlbReferencesUseCase,
	RecoverUnresolvedCustomGlbReferencesUseCaseResult,
} from "../application/recover-unresolved-custom-glb-references";
import type {
	RegisterCustomGlbLibraryAssetInput,
	RegisterCustomGlbLibraryAssetResult,
	RegisterCustomGlbLibraryAssetUseCase,
} from "../application/register-custom-glb-library-asset";
import type {
	RenameProjectStatus,
	RenameProjectUseCase,
	RenameProjectUseCaseResult,
} from "../application/rename-project";
import type {
	ResizeParametricFloorItemStatus,
	ResizeParametricFloorItemUseCase,
	ResizeParametricFloorItemUseCaseResult,
} from "../application/resize-parametric-floor-item";
import type {
	ResizeParametricFloorItemV2Status,
	ResizeParametricFloorItemV2UseCase,
	ResizeParametricFloorItemV2UseCaseResult,
} from "../application/resize-parametric-floor-item-v2";
import type {
	RestartProjectStatus,
	RestartProjectUseCase,
	RestartProjectUseCaseResult,
} from "../application/restart-project";
import type {
	RotateParametricFloorItemStatus,
	RotateParametricFloorItemUseCase,
	RotateParametricFloorItemUseCaseResult,
} from "../application/rotate-parametric-floor-item";
import type {
	SetParametricFloorItemLockStatus,
	SetParametricFloorItemLockUseCase,
	SetParametricFloorItemLockUseCaseResult,
} from "../application/set-parametric-floor-item-lock";
import type {
	SetParametricWallItemLockStatus,
	SetParametricWallItemLockUseCase,
	SetParametricWallItemLockUseCaseResult,
} from "../application/set-parametric-wall-item-lock";
import {
	assessStoragePressure,
	type PersistentStorageRequest,
	type StoragePressure,
} from "../application/storage-pressure";
import type {
	UpdateRoomPropertiesStatus,
	UpdateRoomPropertiesUseCase,
	UpdateRoomPropertiesUseCaseResult,
} from "../application/update-room-properties";
import type { AddWallSegmentInput } from "../domain/add-wall-segment";
import type {
	ConstrainedPartitionInput,
	DeleteConstrainedWallInput,
	OrthogonalGridExpansionInput,
} from "../domain/constrained-partition";
import type {
	AddGeneralWallHostResolutionInput,
	ChangeGeneralWallThicknessInput,
	DeleteGeneralWallRoomMetadataResolution,
	MoveGeneralVertexInput,
	MoveGeneralWallInput,
	ReverseGeneralWallInput,
	SplitGeneralWallHostResolutionInput,
	SplitGeneralWallInput,
	SplitGeneralWallOpeningResolutionInput,
} from "../domain/general-wall-project";
import type {
	DeleteParametricFloorItemInput,
	MoveParametricFloorItemInput,
	ParametricFloorItemInput,
	RecolorParametricFloorItemInput,
	ResizeParametricFloorItemInput,
	SetParametricFloorItemLockInput,
	SetParametricFloorItemYawInput,
} from "../domain/parametric-item";
import type {
	MoveParametricWallItemInput,
	ParametricWallItemInput,
	RecolorParametricWallItemInput,
	SetParametricWallItemLockInput,
} from "../domain/parametric-wall-item";
import type { CustomGlbAssetDefinition, Project } from "../domain/project";
import { sameSha256ResourceHashBits } from "../domain/resource-hash";
import type { ProjectV2 } from "../domain/project-v2";
import { decodeRecoveryDraft, exportRecoveryDraft, recoveryReadOnlyProjection, type DecodeRecoveryDraftResult, type ExportRecoveryDraftResult } from "./project-recovery";
import { canonicalProjectSerializer } from "../application/create-project";
import type { RectangularRoomInput } from "../domain/rectangular-room";
import type { RectangularRoomLoopInput } from "../domain/rectangular-room-loop";
import type {
	ResolveRoomHeightOpeningConflictInput,
	UpdateRoomPropertiesInput,
} from "../domain/update-room-properties";
import type {
	AddDoorOpeningInput,
	AddWindowOpeningInput,
} from "../domain/wall-opening";
import type { UpdateProjectWallOpeningInput } from "../domain/door-opening-project";

type EditorProject = Project | ProjectV2;

export type ProjectScreenState =
	| { readonly kind: "loading" }
	| { readonly kind: "first-run" }
	| {
			readonly kind: "projects";
			readonly projects: readonly import("../application/ports").ProjectSummary[];
			readonly storageSources?: readonly ProjectStorageSourceStatus[];
			readonly recoveryNeeded?: true;
	  }
	| {
			readonly kind: "saving";
			readonly project?: EditorProject;
			readonly revisionId?: string;
	  }
	| {
			readonly kind: "saved";
			readonly project: EditorProject;
			readonly projectName: string;
			readonly revisionId: string;
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: PublicationFailureReason;
			readonly project?: EditorProject;
			readonly revisionId?: string;
	  }
	| {
			readonly kind: "recovery-needed";
			readonly reasonCode: "PERSISTENCE_CORRUPT";
	  }
	| {
			readonly kind: "history-recovery-needed";
			readonly project: EditorProject;
			readonly projectName: string;
			readonly resourceHashes: readonly string[];
			readonly revisionId: string;
	  };

export interface SessionHistorySnapshot {
	readonly canRedo: boolean;
	readonly canUndo: boolean;
}

export interface SessionHistoryCommandLabels {
	readonly redoActionLabel: string | undefined;
	readonly undoActionLabel: string | undefined;
}

export type SessionHistoryResult =
	| { readonly kind: "durable"; readonly revisionId: string }
	| { readonly kind: "stale-base" }
	| { readonly kind: "empty-history" | "in-progress" | "not-ready" }
	| WriterLeaseLostResult
	| {
			readonly kind: "history-resource-issue";
			readonly resourceHashes: readonly string[];
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: PublicationFailureReason;
	  };

function supportsNextRevisionPublication(
	repository: ProjectRepositoryPort,
): repository is ProjectRepositoryPort & ProjectRevisionPublicationPort {
	return (
		"publishNextRevision" in repository &&
		typeof repository.publishNextRevision === "function"
	);
}

/** A non-mutating integrity pass over the current durable revision and both session branches. */
export type SessionHistoryIntegrityResult =
	| { readonly kind: "healthy" }
	| {
			readonly kind: "history-resource-issue";
			readonly resourceHashes: readonly string[];
	  }
	| { readonly kind: "current-resource-issue" }
	| { readonly kind: "in-progress" | "not-ready" };

/** An explicit boundary is allowed only after the current durable state is revalidated. */
export type DiscardSessionHistoryResult =
	| { readonly kind: "discarded" }
	| {
			readonly kind:
				| "current-resource-issue"
				| "in-progress"
				| "not-ready"
				| "read-only"
				| "writer-lease-lost";
	  };

export type ProjectDeletionResult =
	| {
			readonly kind: "permanently-deleted" | "not-found" | "persist-failed";
	  }
	| {
			readonly kind:
				| "in-progress"
				| "not-ready"
				| "read-only"
				| "writer-lease-lost";
	  };

type DirectoryRenameResult =
	| Exclude<RenameProjectUseCaseResult, { readonly kind: "persist-failed" }>
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: PublicationFailureReason;
			readonly retryAvailable: boolean;
	  }
	| WriterLeaseLostResult
	| { readonly kind: "in-progress" | "not-ready" | "read-only" | "resources-unavailable" };

type DirectoryRenameAttempt = {
	readonly candidate: PublicationCandidate;
	readonly baseRevisionId: string;
};

export type CustomGlbResourceRepairResult =
	| { readonly kind: "recovered"; readonly resourceHash: string }
	| { readonly kind: "repaired"; readonly resourceHash: string }
	| { readonly kind: "rejected"; readonly reasonCode: "RESOURCE_HASH_MISMATCH" }
	| { readonly kind: "in-progress" | "not-ready" | "persist-failed" };

export type CustomGlbResourceBatchRepairResult =
	| { readonly kind: "recovered"; readonly resourceHashes: readonly string[] }
	| { readonly kind: "repaired"; readonly resourceHashes: readonly string[] }
	| { readonly kind: "rejected"; readonly reasonCode: "RESOURCE_HASH_MISMATCH" }
	| { readonly kind: "in-progress" | "not-ready" | "persist-failed" };

export type RemoveUnresolvedCustomGlbReferencesResult =
	| RecoverUnresolvedCustomGlbReferencesUseCaseResult
	| WriterLeaseLostResult
	| { readonly kind: "in-progress" | "not-ready" | "stale-recovery" }
	| {
			readonly kind: "reopen-failed";
			readonly reasonCode: "PERSISTENCE_CORRUPT";
	  };

export interface RecoveryCustomGlbRemovalSummary {
	readonly affectedAssetDefinitionCount: number;
	readonly affectedAssetInstanceCount: number;
}

/** A mutation was rejected before durable publication because this context lost its fence. */
export type WriterLeaseLostResult = {
	readonly kind: "writer-lease-lost";
	readonly reasonCode: "WRITER_LEASE_LOST";
};

type MutationPublicationStatus =
	| { readonly kind: "saving" }
	| { readonly kind: "saved"; readonly candidate: DurablePublicationCandidate }
	| {
			readonly candidate: DurablePublicationCandidate;
			readonly kind: "stale-base";
			readonly reasonCode: "STALE_BASE_REVISION";
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: PublicationFailureReason;
			readonly candidate: DurablePublicationCandidate;
	  };

function isV1Candidate(
	candidate: DurablePublicationCandidate | undefined,
): candidate is PublicationCandidate {
	return (
		candidate?.project.schemaVersion === 1 &&
		candidate.revision.schemaVersion === 1
	);
}

function isV2Candidate(
	candidate: DurablePublicationCandidate | undefined,
): candidate is V2PublicationCandidate {
	return (
		candidate?.project.schemaVersion === 2 &&
		candidate.revision.schemaVersion === 2
	);
}

function isPortableProjectArchive(bytes: Uint8Array): boolean {
	return (
		bytes.byteLength >= 4 &&
		bytes[0] === 0x50 &&
		bytes[1] === 0x4b &&
		(bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
		(bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
	);
}

function supportsProjectDeletion(
	directory: ProjectDirectoryPort,
): directory is ProjectDirectoryPort & ProjectDeletionPort {
	return (
		"permanentlyDeleteProject" in directory &&
		typeof directory.permanentlyDeleteProject === "function"
	);
}

function sameResourceHashSet(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((resourceHash) => right.includes(resourceHash))
	);
}

type PendingHistoryTravel = {
	readonly direction: "redo" | "undo";
	readonly source: DurablePublicationCandidate;
	readonly target: DurablePublicationCandidate;
};

function describeForwardHistoryCommand(
	previous: DurablePublicationCandidate,
	candidate: DurablePublicationCandidate,
): string {
	if (previous.project.name !== candidate.project.name) {
		return "переименование проекта";
	}

	const previousItems = new Map(
		previous.project.assetInstances.map((item) => [item.assetInstanceId, item]),
	);
	const candidateItems = new Map(
		candidate.project.assetInstances.map((item) => [item.assetInstanceId, item]),
	);
	if (
		[...previousItems.keys()].some((itemId) => !candidateItems.has(itemId))
	) {
		return "удаление предмета";
	}
	if (
		[...candidateItems.keys()].some((itemId) => !previousItems.has(itemId))
	) {
		return "добавление предмета";
	}

	for (const [itemId, previousItem] of previousItems) {
		const candidateItem = candidateItems.get(itemId);
		if (!candidateItem || previousItem === candidateItem) continue;
		const wasLocked = "locked" in previousItem && previousItem.locked === true;
		const isLocked =
			"locked" in candidateItem && candidateItem.locked === true;
		if (wasLocked !== isLocked) {
			return isLocked ? "блокировка предмета" : "разблокировка предмета";
		}
		return "изменение предмета";
	}

	return "изменение плана";
}

/**
 * The current revision remains healthy; only this named session target cannot
 * be restored. It is intentionally process-local and never becomes Project
 * or Revision data.
 */
type ResourceProductMetric = Extract<
	ProductMetric,
	"resource_missing" | "resource_corrupt" | "storage_unavailable"
>;

type HistoryResourceIssue = {
	readonly direction: "redo" | "undo";
	readonly resourceHashes: readonly string[];
	readonly targetRevisionId: string;
};

export interface ProjectTransferExporter {
	execute(
		candidate: DurablePublicationCandidate,
		signal?: CancellationSignalPort,
	): Promise<ExportPortableBackupResult>;
}

export interface RegisteredProjectTransferExporter {
	execute(
		candidate: DurablePublicationCandidate,
		signal?: CancellationSignalPort,
	): Promise<
		ExportPortableBackupResult | { readonly kind: "verification-unavailable" }
	>;
}

/**
 * Product-only PlanGraph mutations. They are deliberately injected after the
 * quarantined V2 fixture dependencies so existing fixture construction cannot
 * accidentally enable them, while production has one explicit canonical path.
 */
export interface CanonicalPlanGraphMutationUseCases {
	readonly roomInterior?: {
		readonly clock: ClockPort;
		readonly checksum: ChecksumPort;
		readonly ids: IdPort;
		readonly serializer: ProjectSerializerPort;
	};
	/** Explicit composition choices, never inferred from an import file. */
	readonly registeredPortableBackupImporter?: ImportPortableBackupUseCase;
	readonly registeredPortableBackupExporter?: RegisteredProjectTransferExporter;
	readonly registeredPortableBackupAdmission?: PortableBackupImportAdmissionPort;
	readonly recoveryPortableBackupWriter?: PortableBackupArchiveWriterPort;
	readonly addDoorOpening?: AddDoorOpeningToProjectUseCase;
	readonly addWindowOpening?: AddWindowOpeningToProjectUseCase;
	readonly addGeneralWall?: AddGeneralWallToProjectUseCase;
	readonly createCustomGlbFloorItem?: CreateCustomGlbFloorItemUseCase;
	readonly createParametricWallItem?: CreateParametricWallItemUseCase;
	readonly changeGeneralWallThickness?: ChangeGeneralWallThicknessUseCase;
	readonly reverseGeneralWall?: ReverseGeneralWallUseCase;
	readonly moveGeneralWall?: MoveGeneralWallUseCase;
	readonly moveGeneralVertex?: MoveGeneralVertexUseCase;
	readonly moveParametricWallItem?: MoveParametricWallItemUseCase;
	readonly recolorWallItem?: RecolorParametricWallItemUseCase;
	readonly setParametricWallItemLock?: SetParametricWallItemLockUseCase;
	readonly setParametricFloorItemLock?: SetParametricFloorItemLockUseCase;
	readonly deleteGeneralVertex?: DeleteGeneralVertexUseCase;
	readonly splitGeneralWall?: SplitGeneralWallUseCase;
	readonly deleteDoorOpening?: DeleteDoorOpeningFromProjectUseCase;
	readonly moveDoorOpening?: MoveDoorOpeningInProjectUseCase;
	readonly updateDoorOpening?: UpdateDoorOpeningInProjectUseCase;
	readonly deleteGeneralWall?: DeleteGeneralWallFromProjectUseCase;
	readonly deleteParametricWallItem?: DeleteParametricWallItemUseCase;
	readonly recolorFloorItem?: RecolorParametricFloorItemUseCase;
	readonly recoverUnresolvedCustomGlbReferences?: RecoverUnresolvedCustomGlbReferencesUseCase;
	readonly renameProject?: RenameProjectUseCase;
	readonly rotateFloorItem?: RotateParametricFloorItemUseCase;
	readonly restartProject?: RestartProjectUseCase;
	readonly updateRoomProperties?: UpdateRoomPropertiesUseCase;
}

export class ProjectController {
	private openInFlight: Promise<void> | undefined;
	private navigationRequestId = 0;
	private publicationActive = false;
	private state: ProjectScreenState = { kind: "loading" };
	private readonly productMetricListeners = new Set<ProductMetricSink>();
	private readonly pendingProductMetrics = new WeakMap<DurablePublicationCandidate, ProductMetric>();
	private pending: DurablePublicationCandidate | undefined;
	private pendingForwardPrevious: DurablePublicationCandidate | undefined;
	/** An exact-base command such as rename must retain its CAS precondition on retry. */
	private pendingForwardExpectedBaseRevisionId: string | undefined;
	private pendingHistoryTravel: PendingHistoryTravel | undefined;
	private historyResourceIssue: HistoryResourceIssue | undefined;
	private current: DurablePublicationCandidate | undefined;
	private readonly redoStack: DurablePublicationCandidate[] = [];
	private readonly undoStack: DurablePublicationCandidate[] = [];
	private integrityRefresh?: {
		readonly current: DurablePublicationCandidate;
		readonly result: Promise<SessionHistoryIntegrityResult>;
	};
	/** Command copy is session-only metadata, keyed by a history root revision. */
	private readonly historyCommandLabels = new Map<string, string>();
	private readonly listeners = new Set<(state: ProjectScreenState) => void>();
	private recoveryCustomGlbResourceHashes: readonly string[] = [];
	private recoveryCandidate: PublicationCandidate | undefined;
	private writerLeaseAccess: WriterAccess = { kind: "not-ready" };
	private lostWriterLeaseResultPending = false;
	private writerLeaseRecoveryCopy: DurablePublicationCandidate | undefined;

	/**
	 * A failed candidate is a live publication boundary, not merely a status
	 * banner. Until retry/recovery resolves it, every new persistable command is
	 * denied centrally so it cannot replace or discard the exact candidate.
	 */
	private get publicationInFlight(): boolean {
		return (
			this.publicationActive ||
			this.directoryRenameUnsettled ||
			this.pending !== undefined ||
			this.pendingHistoryTravel !== undefined
		);
	}

	private set publicationInFlight(active: boolean) {
		this.publicationActive = active;
	}

	private directoryRenameActive = false;
	private pendingDirectoryRename?: DirectoryRenameAttempt;

	private get directoryRenameUnsettled(): boolean {
		return this.directoryRenameActive || this.pendingDirectoryRename !== undefined;
	}

	public constructor(
		private readonly createProject: CreateProjectUseCase,
		private readonly repository: ProjectRepositoryPort<PublicationFailureReason>,
		private readonly configureRoom?: ConfigureRectangularRoomUseCase,
		private readonly addPartition?: AddConstrainedPartitionUseCase,
		private readonly createFloorItem?: CreateParametricFloorItemUseCase,
		private readonly moveFloorItem?: MoveParametricFloorItemUseCase,
		private readonly expandGrid?: ExpandOrthogonalGridUseCase,
		private readonly resizeFloorItem?: ResizeParametricFloorItemUseCase,
		private readonly deleteFloorItem?: DeleteParametricFloorItemUseCase,
		private readonly deleteWall?: DeleteConstrainedWallUseCase,
		private readonly createRoomLoop?: CreateRectangularRoomLoopUseCase,
		private readonly migrateToV2?: MigrateProjectV1ToV2UseCase,
		private readonly addFreeWallV2?: AddWallToProjectV2UseCase,
		private readonly deleteFreeWallV2?: DeleteWallFromProjectV2UseCase,
		private readonly createFloorItemV2?: CreateParametricFloorItemV2UseCase,
		private readonly moveFloorItemV2?: MoveParametricFloorItemV2UseCase,
		private readonly resizeFloorItemV2?: ResizeParametricFloorItemV2UseCase,
		private readonly deleteFloorItemV2?: DeleteParametricFloorItemV2UseCase,
		/**
		 * V2 is an isolated legacy characterization family, never the product
		 * editor route. Tests must opt in explicitly while canonical PlanGraph
		 * commands are still being built against TCC-A1.
		 */
		private readonly enableLegacyV2FixtureMode = false,
		private readonly canonicalPlanGraphMutations: CanonicalPlanGraphMutationUseCases = {},
		private readonly writerLeases?: WriterLeaseControllerPort,
		private readonly projectDirectory?: ProjectDirectoryPort,
		private readonly importLocalProjectJson?: ImportLocalProjectJsonUseCase,
		private readonly exportLocalProjectJson?: ExportLocalProjectJsonUseCase,
		/** Read-only lookup for renderer projections; resource bytes never enter Project state. */
		private readonly customAssetResources?: CustomAssetResourceStorePort,
		/** Verifies that immutable local bytes still match the durable resource address. */
		private readonly binaryChecksum?: BinaryChecksumPort,
		private readonly customAssetLibrary?: CustomAssetLibraryPort,
		private readonly registerCustomGlbLibraryAssetUseCase?: RegisterCustomGlbLibraryAssetUseCase,
		private readonly storageEstimates?: StorageEstimatePort,
		private readonly exportPortableBackupUseCase?: ProjectTransferExporter,
		private readonly importPortableBackupUseCase?: ImportPortableBackupUseCase,
		private readonly recoveryPortableBackupDecoder?: import("../application/ports").PortableBackupDecoderPort,
		private readonly recoveryPortableBackupEncoder?: import("../application/ports").PortableBackupEncoderPort,
		private readonly probePinnedResourceByteLength?: (hash: string) => Promise<number | undefined>,
	) {}

	private readonly activeRoomLayouts = new Map<string, string>();

	public roomInteriorEnabled(): boolean {
		return this.canonicalPlanGraphMutations.roomInterior !== undefined;
	}

	public selectRoomLayout(roomId: string, layoutId: string): void {
		if (this.current?.project.schemaVersion === 1 && this.current.project.roomLayouts?.some(
			layout => layout.roomId === roomId && layout.layoutId === layoutId,
		)) this.activeRoomLayouts.set(roomId, layoutId);
	}

	public previewInteriorCommand(command: InteriorCommand): InteriorMutation {
		const current = this.current;
		if (!isV1Candidate(current) || !this.roomInteriorEnabled()) {
			return { kind: "rejected", reasonCode: "INTERIOR_TARGET_INVALID" };
		}
		let next = 0;
		return draftInteriorCommand(current.project, command, { next: () => `preview-interior-${++next}` },
			current.project.updatedAt, this.activeRoomLayouts);
	}

	public updateRoomFloorFinish(input: Omit<Extract<InteriorCommand, { kind: "set-floor-finish" }>, "kind">) {
		return this.applyInteriorCommand({ kind: "set-floor-finish", ...input });
	}

	public updateWallSideFinish(input: Omit<Extract<InteriorCommand, { kind: "set-wall-finish" }>, "kind">) {
		return this.applyInteriorCommand({ kind: "set-wall-finish", ...input });
	}

	public async applyInteriorCommand(command: InteriorCommand) {
		const current = this.current;
		const ports = this.canonicalPlanGraphMutations.roomInterior;
		if (!isV1Candidate(current) || !ports) return { kind: "not-ready" } as const;
		if (this.publicationInFlight) return { kind: "in-progress" } as const;
		const draft = draftInteriorCommand(current.project, command, ports.ids, ports.clock.now(), this.activeRoomLayouts);
		if (draft.kind !== "accepted") return draft;
		this.publicationInFlight = true;
		try {
			const result = await publishProjectMutation(
				draft.project, { ...ports, repository: this.repository },
				(status) => this.acceptMutationStatus(status, current,
					command.kind === "place-decor-on-floor" && !command.sourceAssetInstanceId ? "item_placed" : undefined),
				current.revision.revisionId,
			);
			if (result.kind === "durable" && command.kind === "room-layout" && draft.nextActiveLayoutId) {
				this.selectRoomLayout(command.command.roomId, draft.nextActiveLayoutId);
				return { ...result, nextActiveLayoutId: draft.nextActiveLayoutId };
			}
			return result;
		} catch {
			this.setState({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" } as const;
		} finally {
			this.publicationInFlight = false;
		}
	}

	private layoutForPlacement(project: Project, roomId: string): string | undefined {
		return selectedInteriorLayoutId(project, roomId, this.activeRoomLayouts);
	}

	public snapshot(): ProjectScreenState {
		return this.state;
	}

	/** Session-only history intentionally contains durable revisions, not commands or portable data. */
	public sessionHistory(): SessionHistorySnapshot {
		return {
			canRedo: this.redoStack.length > 0,
			canUndo: this.undoStack.length > 0,
		};
	}

	/** Ephemeral UI copy for the two available session-history operations. */
	public sessionHistoryCommandLabels(): SessionHistoryCommandLabels {
		const undo = this.undoStack.at(-1);
		const redo = this.redoStack.at(-1);
		const undoCommand = undo
			? this.historyCommandLabels.get(undo.revision.revisionId)
			: undefined;
		const redoCommand = redo
			? this.historyCommandLabels.get(redo.revision.revisionId)
			: undefined;
		return {
			redoActionLabel: redoCommand
				? `Повторить действие: ${redoCommand}`
				: undefined,
			undoActionLabel: undoCommand
				? `Отменить действие: ${undoCommand}`
				: undefined,
		};
	}

	/** Immutable identity for transient projections such as MeasurementRequest. */
	public currentRevisionIdentity():
		| {
				readonly checksum: string;
				readonly projectId: string;
				readonly revisionId: string;
		  }
		| undefined {
		const current = this.current;
		return current
			? {
					checksum: current.revision.checksum,
					projectId: current.project.projectId,
					revisionId: current.revision.revisionId,
				}
			: undefined;
	}

	/**
	 * Read-only roots for publication admission. Copies prevent a persistence
	 * adapter from changing session history before durable publication succeeds.
	 */
	public sessionRetentionRoots() {
		const recoveryRoots =
			this.writerLeaseRecoveryCopy &&
			!this.undoStack.some(
				(candidate) =>
					candidate.revision.revisionId ===
					this.writerLeaseRecoveryCopy?.revision.revisionId,
			)
				? [this.writerLeaseRecoveryCopy]
				: [];
		return {
			current: this.current ?? this.recoveryCandidate,
			redo: [...this.redoStack],
			undo: [...this.undoStack, ...recoveryRoots],
		};
	}

	/**
	 * Rechecks immutable resource bytes for the current durable Project and all
	 * in-memory undo/redo roots. It changes no Project or Revision and ignores
	 * a stale result if another controller operation started while bytes were
	 * being read.
	 */
	public async refreshSessionHistoryIntegrity(): Promise<SessionHistoryIntegrityResult> {
		const current = this.current;
		if (!current) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		const probe = this.probePinnedResourceByteLength;
		const resourceMetrics = new Set<ResourceProductMetric>();
		if (!probe) {
			return this.scanSessionHistoryIntegrity(
				current,
				(candidate) => this.unresolvedPinnedCustomGlbResourceHashes(candidate, resourceMetrics),
				resourceMetrics,
			);
		}
		if (this.integrityRefresh?.current === current) return this.integrityRefresh.result;

		// Deduplicate exact storage addresses within one sweep, including undo/redo.
		// Each new sweep must read again so it can detect a real loss after resume.
		const proofs = new Map<string, Promise<number | undefined>>();
		const ambiguousResourceCandidates = new Set<DurablePublicationCandidate>();
		const result = this.scanSessionHistoryIntegrity(current, async (candidate) => {
			if (!isV1Candidate(candidate)) return [];
			const invalid = await Promise.all(
				candidate.project.assetDefinitionRefs.map(async (asset) => {
					let proof = proofs.get(asset.resourceHash);
					if (!proof) {
						proof = probe(asset.resourceHash);
						proofs.set(asset.resourceHash, proof);
					}
					const length = await proof;
					if (length === asset.byteLength) return undefined;
					if (length === undefined) ambiguousResourceCandidates.add(candidate);
					else resourceMetrics.add("resource_corrupt");
					return asset.resourceHash;
				}),
			);
			return [...new Set(invalid.filter((hash) => hash !== undefined))];
		}, resourceMetrics, () => {
			if (ambiguousResourceCandidates.size === 0 || this.productMetricListeners.size === 0) return;
			// The probe cannot distinguish absence from invalid bytes. Classification
			// must never delay displaying the already established recovery state.
			const visibleRecovery = this.state;
			const observers = [...this.productMetricListeners];
			void this.reportAmbiguousResourceMetrics(
				ambiguousResourceCandidates, visibleRecovery, resourceMetrics, observers,
			);
		}).catch((): SessionHistoryIntegrityResult => {
			// A failed read proves neither corruption nor recovery. Publication
			// and destructive repair still run their independent exact checks.
			return { kind: "not-ready" };
		});
		const refresh = { current, result };
		this.integrityRefresh = refresh;
		try {
			return await result;
		} finally {
			if (this.integrityRefresh === refresh) this.integrityRefresh = undefined;
		}
	}

	private async scanSessionHistoryIntegrity(
		current: DurablePublicationCandidate,
		check: (candidate: DurablePublicationCandidate) => Promise<readonly string[]>,
		resourceMetrics: ReadonlySet<ResourceProductMetric>,
		reportAmbiguousResources?: () => void,
	): Promise<SessionHistoryIntegrityResult> {
		const currentResourceHashes = await check(current);
		if (this.current !== current || this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		if (currentResourceHashes.length > 0) {
			this.enterCurrentResourceRecovery(current, currentResourceHashes);
			for (const metric of resourceMetrics) this.emitProductMetric(metric);
			reportAmbiguousResources?.();
			return { kind: "current-resource-issue" };
		}

		const historyTargets = [
			...this.undoStack.map((target) => ({
				direction: "undo" as const,
				target,
			})),
			...this.redoStack.map((target) => ({
				direction: "redo" as const,
				target,
			})),
		];
		const missingResourceHashes = new Set<string>();
		let firstIssue: HistoryResourceIssue | undefined;
		for (const { direction, target } of historyTargets) {
			const resourceHashes = await check(target);
			if (this.current !== current || this.publicationInFlight) {
				return { kind: "in-progress" };
			}
			if (resourceHashes.length === 0) continue;
			for (const resourceHash of resourceHashes) {
				missingResourceHashes.add(resourceHash);
			}
			firstIssue ??= {
				direction,
				resourceHashes,
				targetRevisionId: target.revision.revisionId,
			};
		}
		if (firstIssue) {
			const resourceHashes = [...missingResourceHashes];
			this.enterHistoryResourceRecovery(current, {
				...firstIssue,
				resourceHashes,
			});
			for (const metric of resourceMetrics) this.emitProductMetric(metric);
			reportAmbiguousResources?.();
			return { kind: "history-resource-issue", resourceHashes };
		}

		this.historyResourceIssue = undefined;
		if (this.state.kind === "history-recovery-needed") {
			this.setDurableState(current);
		}
		return { kind: "healthy" };
	}

	private async reportAmbiguousResourceMetrics(
		candidates: ReadonlySet<DurablePublicationCandidate>,
		visibleRecovery: ProjectScreenState,
		reported: ReadonlySet<ResourceProductMetric>,
		observers: readonly ProductMetricSink[],
	): Promise<void> {
		const exactMetrics = new Set<ResourceProductMetric>();
		await Promise.all(
			[...candidates].map((candidate) =>
				this.unresolvedPinnedCustomGlbResourceHashes(candidate, exactMetrics),
			),
		);
		if (this.state !== visibleRecovery) return;
		const activeObservers = observers.filter((observer) => this.productMetricListeners.has(observer));
		for (const metric of exactMetrics) {
			if (!reported.has(metric)) this.emitProductMetric(metric, activeObservers);
		}
	}

	/** Presentation can show this separately from durable Project state. */
	public writerAccess(): WriterAccess {
		return this.writerLeaseAccess;
	}

	/** Unpublished work retained only for local read-only preview after fence loss. */
	public writerRecoveryCopy(): DurablePublicationCandidate | undefined {
		return this.writerLeaseRecoveryCopy;
	}

	/** Exports exactly the unpublished candidate, never a substitute durable snapshot. */
	public exportRecoveryDraft(): Promise<ExportRecoveryDraftResult | { readonly kind: "not-ready" }> {
		const candidate = this.pendingHistoryTravel?.target ?? this.pending ?? this.writerLeaseRecoveryCopy;
		return candidate ? exportRecoveryDraft(candidate, this.customAssetResources, this.binaryChecksum) : Promise.resolve({ kind: "not-ready" });
	}

	/** Explicitly restores a complete unpublished draft only as a new local Project. */
	public async importRecoveryDraft(
		bytes: Uint8Array,
		options?: {
			readonly signal?: CancellationSignalPort;
			readonly onStatus?: (status: ImportPortableBackupStatus) => void;
		},
	): Promise<
		| ImportPortableBackupResult
		| Extract<DecodeRecoveryDraftResult, { readonly kind: "rejected" }>
		| { readonly kind: "not-ready" | "in-progress" }
	> {
		if (options?.signal?.aborted)
			return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" };
		const checksum = this.binaryChecksum;
		const encoder = this.recoveryPortableBackupEncoder;
		const writer =
			this.canonicalPlanGraphMutations.recoveryPortableBackupWriter;
		if (!checksum || (!writer && !encoder) || !this.importPortableBackupUseCase)
			return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		let archive: Uint8Array;
		try {
			options?.onStatus?.({ kind: "validating" });
			const decoded = await decodeRecoveryDraft(
				bytes,
				checksum,
				options?.signal,
			);
			if (decoded.kind === "cancelled" || options?.signal?.aborted)
				return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" };
			if (decoded.kind === "rejected") return decoded;
			if (writer) {
				if (decoded.candidate.project.schemaVersion !== 1)
					return { kind: "rejected", reasonCode: "RECOVERY_DRAFT_INVALID" };
				const packaged = await writer.encode(
					{
						project: decoded.candidate.project,
						resources: decoded.resources,
						createdAt: decoded.candidate.revision.createdAt,
					},
					options?.signal,
				);
				if (options?.signal?.aborted)
					return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" };
				if (packaged.kind === "rejected") return packaged;
				archive = packaged.bytes;
			} else if (encoder) {
				const exactResources = new Map(
					decoded.resources.map((resource) => [
						resource.resourceHash,
						resource.bytes,
					]),
				);
				const exporter = new ExportPortableBackupUseCase({
					binaryChecksum: checksum,
					checksum: {
						sha256: (text) =>
							checksum.sha256Bytes(new TextEncoder().encode(text)),
					},
					encoder,
					resources: { read: async (hash) => exactResources.get(hash) },
					serializer: canonicalProjectSerializer,
				});
				const packaged = await exporter.execute(decoded.candidate);
				if (options?.signal?.aborted)
					return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" };
				if (packaged.kind === "rejected")
					return { kind: "rejected", reasonCode: "RECOVERY_DRAFT_INVALID" };
				archive = packaged.bytes;
			} else return { kind: "not-ready" };
		} catch {
			return writer
				? { kind: "not-ready" }
				: { kind: "rejected", reasonCode: "RECOVERY_DRAFT_INVALID" };
		} finally {
			this.publicationInFlight = false;
		}
		return this.importPortableBackup(archive, options);
	}

	/** Disposable, immutable geometry for a visibly read-only recovery screen. */
	public recoveryReadOnlyProject(): Project | undefined {
		return this.recoveryCandidate ? recoveryReadOnlyProjection(this.recoveryCandidate.project, this.recoveryCustomGlbResourceHashes) : undefined;
	}

	/**
	 * Reads the browser's advisory capacity estimate. It never claims to prevent
	 * browser or OS eviction, and callers can safely refresh it at any time.
	 */
	public async storagePressure(): Promise<StoragePressure> {
		if (!this.storageEstimates) return { kind: "unavailable" };
		try {
			return assessStoragePressure(
				await this.storageEstimates.estimateStorage(),
			);
		} catch {
			return { kind: "unavailable" };
		}
	}

	/**
	 * Browser persistence can be requested only from an explicit user action.
	 * It is advisory rather than a durability guarantee, so a refused or missing
	 * capability remains visible to presentation instead of blocking a Project.
	 */
	public async requestPersistentStorage(): Promise<PersistentStorageRequest> {
		const storageEstimates = this.storageEstimates;
		if (!storageEstimates?.requestPersistentStorage) {
			return { kind: "unavailable" };
		}
		try {
			const granted = await storageEstimates.requestPersistentStorage();
			if (granted === true) return { kind: "granted" };
			if (granted === false) return { kind: "not-granted" };
			return { kind: "unavailable" };
		} catch {
			return { kind: "unavailable" };
		}
	}

	/**
	 * Resolves only immutable bytes addressed by a durable asset definition.
	 * A missing resource is deliberately observable to presentation so it can
	 * leave the Project read-only/recoverable rather than substituting a model.
	 */
	public readCustomGlbResource(
		resourceHash: string,
	): Promise<Uint8Array | undefined> {
		return (
			this.customAssetResources?.read(resourceHash) ??
			Promise.resolve(undefined)
		);
	}

	/** The reusable custom catalogue is local-only and intentionally not Project state. */
	public listCustomGlbLibraryAssets(): Promise<
		readonly CustomGlbAssetDefinition[]
	> {
		return this.customAssetLibrary?.list() ?? Promise.resolve([]);
	}

	public listRemovedCustomGlbLibraryResourceHashes(): Promise<readonly string[]> {
		return this.customAssetLibrary?.listRemovedResourceHashes?.() ?? Promise.resolve([]);
	}

	/** Removes only the device-local card; referenced Project/history resources remain intact. */
	public async removeCustomGlbLibraryAsset(assetDefinitionId: string): Promise<{ readonly kind: "removed" | "not-found" | "not-ready" | "persist-failed" }> {
		const library = this.customAssetLibrary;
		if (!library?.remove) return { kind: "not-ready" };
		try { return await library.remove(assetDefinitionId); }
		catch { return { kind: "persist-failed" }; }
	}

	public async registerCustomGlbLibraryAsset(
		input: RegisterCustomGlbLibraryAssetInput,
	): Promise<
		RegisterCustomGlbLibraryAssetResult | { readonly kind: "not-ready" }
	> {
		const useCase = this.registerCustomGlbLibraryAssetUseCase;
		return useCase ? useCase.execute(input) : { kind: "not-ready" };
	}

	/**
	 * Repairs only a resource whose computed digest matches a durable reference
	 * captured during the current recovery state. The Project itself is never
	 * mutated by this operation; reopening remains the final integrity check.
	 * Multiple distinct digests require a batch selection; aliases are replaced atomically.
	 */
	public async repairCustomGlbResource(
		bytes: Uint8Array,
	): Promise<CustomGlbResourceRepairResult> {
		const repairBytes = bytes.slice();
		const expectedResourceHashes = [
			...new Set(this.recoveryCustomGlbResourceHashes),
		];
		if (
			this.historyResourceIssue ||
			(expectedResourceHashes.length > 1 &&
				this.distinctResourceHashDigests(expectedResourceHashes).length === 1)
		) {
			const result = await this.repairCustomGlbResources([repairBytes]);
			return result.kind === "recovered" || result.kind === "repaired"
				? { kind: result.kind, resourceHash: result.resourceHashes[0] ?? "" }
				: result;
		}
		const replacement = this.customAssetResources?.writeReplacing;
		const checksum = this.binaryChecksum;
		const expectedLengths = this.expectedRepairResourceByteLengths(
			expectedResourceHashes,
		);
		if (
			expectedResourceHashes.length === 0 ||
			!replacement ||
			!checksum ||
			!expectedLengths
		)
			return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			if (this.distinctResourceHashDigests(expectedResourceHashes).length !== 1)
				return { kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" };
			let digest: string;
			try {
				digest = await checksum.sha256Bytes(repairBytes);
			} catch {
				return { kind: "not-ready" };
			}
			const resourceHash = expectedResourceHashes[0];
			const lengths = expectedLengths.get(resourceHash);
			if (
				!sameSha256ResourceHashBits(resourceHash, digest) ||
				!lengths ||
				[...lengths].some((length) => length !== repairBytes.length)
			)
				return { kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" };
			try {
				await replacement.call(this.customAssetResources, {
					bytes: repairBytes,
					resourceHash,
				});
				await this.finishExactResourceRepair();
			} catch {
				this.current = undefined;
				this.writerLeaseAccess = { kind: "not-ready" };
				this.setState({
					kind: "recovery-needed",
					reasonCode: "PERSISTENCE_CORRUPT",
				});
				return { kind: "persist-failed" };
			}
			return this.snapshot().kind === "saved"
				? { kind: "recovered", resourceHash }
				: { kind: "repaired", resourceHash };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/**
	 * Replaces every resource captured during the current recovery state in one
	 * transaction. The selection must contain one exact GLB per distinct digest and restore every
	 * captured raw resource address; only a reopened, fully verified Project exits
	 * recovery-needed.
	 */
	public async repairCustomGlbResources(
		sourceBytes: readonly Uint8Array[],
	): Promise<CustomGlbResourceBatchRepairResult> {
		const replacement = this.customAssetResources?.writeReplacingBatch;
		const checksum = this.binaryChecksum;
		const expectedResourceHashes = [
			...new Set(
				this.historyResourceIssue?.resourceHashes ??
					this.recoveryCustomGlbResourceHashes,
			),
		];
		const expectedDigests = this.distinctResourceHashDigests(
			expectedResourceHashes,
		);
		const expectedLengths = this.expectedRepairResourceByteLengths(
			expectedResourceHashes,
		);
		if (
			expectedResourceHashes.length === 0 ||
			!replacement ||
			!checksum ||
			!expectedLengths
		)
			return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			let validated: readonly {
				readonly bytes: Uint8Array;
				readonly resourceHash: string;
			}[];
			try {
				const snapshots = sourceBytes.map((bytes) => bytes.slice());
				validated = await Promise.all(
					snapshots.map(async (bytes) => ({
						bytes,
						resourceHash: await checksum.sha256Bytes(bytes),
					})),
				);
				if (
					validated.length !== expectedDigests.length ||
					expectedDigests.some(
						(hash) =>
							!validated.some((resource) =>
								sameSha256ResourceHashBits(hash, resource.resourceHash),
							),
					) ||
					expectedResourceHashes.some((hash) => {
						const resource = validated.find((entry) =>
							sameSha256ResourceHashBits(hash, entry.resourceHash),
						);
						const lengths = expectedLengths.get(hash);
						return (
							!resource ||
							!lengths ||
							[...lengths].some((length) => length !== resource.bytes.length)
						);
					})
				)
					return { kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" };
			} catch {
				// An unavailable verifier cannot prove that the selected set is exact.
				return { kind: "not-ready" };
			}
			try {
				const replacementResources = expectedResourceHashes.map(
					(resourceHash) => {
						const resource = validated.find((entry) =>
							sameSha256ResourceHashBits(resourceHash, entry.resourceHash),
						);
						if (!resource)
							throw new Error(
								"A validated custom GLB resource was unavailable for recovery.",
							);
						return { bytes: resource.bytes.slice(), resourceHash };
					},
				);
				await replacement.call(this.customAssetResources, replacementResources);
				await this.finishExactResourceRepair();
			} catch {
				this.current = undefined;
				this.writerLeaseAccess = { kind: "not-ready" };
				this.setState({
					kind: "recovery-needed",
					reasonCode: "PERSISTENCE_CORRUPT",
				});
				return { kind: "persist-failed" };
			}
			return this.snapshot().kind === "saved"
				? { kind: "recovered", resourceHashes: expectedResourceHashes }
				: { kind: "repaired", resourceHashes: expectedResourceHashes };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Uses an integrity-checked backup as an exact-byte source, never imports its Project. */
	public async repairResourcesFromPortableBackup(
		bytes: Uint8Array,
	): Promise<
		| CustomGlbResourceBatchRepairResult
		| Extract<ImportPortableBackupResult, { readonly kind: "rejected" }>
	> {
		const decoder = this.recoveryPortableBackupDecoder;
		const expected = [
			...new Set(
				this.historyResourceIssue?.resourceHashes ??
					this.recoveryCustomGlbResourceHashes,
			),
		];
		if (!decoder || expected.length === 0) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		const requestId = this.navigationRequestId;
		this.publicationInFlight = true;
		let decoded: Awaited<ReturnType<typeof decoder.decode>>;
		try {
			decoded = await decoder.decode(bytes.slice());
		} catch {
			return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
		} finally {
			this.publicationInFlight = false;
		}
		if (!this.isCurrentNavigationRequest(requestId))
			return { kind: "not-ready" };
		if (decoded.kind === "rejected") return decoded;
		if (decoded.kind === "verification-unavailable")
			return { kind: "not-ready" };
		const resources = decoded.resources ?? [];
		const selected: Uint8Array[] = [];
		for (const hash of this.distinctResourceHashDigests(expected)) {
			const entry = resources.find((resource) =>
				sameSha256ResourceHashBits(hash, resource.resourceHash),
			);
			if (!entry)
				return { kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" };
			selected.push(entry.bytes);
		}
		return this.repairCustomGlbResources(selected);
	}

	/**
	 * Publishes the deletion-only current-Project part of a RecoveryChangeSet.
	 * The caller cannot choose a subset: every still-unresolved custom reference
	 * from the captured durable snapshot must disappear together.
	 */
	public async removeUnresolvedCustomGlbReferences(): Promise<RemoveUnresolvedCustomGlbReferencesResult> {
		const useCase =
			this.canonicalPlanGraphMutations.recoverUnresolvedCustomGlbReferences;
		const recoveryCandidate = this.recoveryCandidate;
		const expectedResourceHashes = [
			...new Set(this.recoveryCustomGlbResourceHashes),
		];
		if (!useCase || !recoveryCandidate || expectedResourceHashes.length === 0) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			let revalidatedResourceHashes: readonly string[] | undefined;
			try {
				revalidatedResourceHashes =
					await this.verifiedUnresolvedPinnedCustomGlbResourceHashes(
						recoveryCandidate,
					);
			} catch {
				return { kind: "not-ready" };
			}
			if (
				!revalidatedResourceHashes ||
				!sameResourceHashSet(revalidatedResourceHashes, expectedResourceHashes)
			) {
				await this.openRecoveredProject(recoveryCandidate.project.projectId);
				return { kind: "stale-recovery" };
			}
			const result = await useCase.execute(
				recoveryCandidate,
				expectedResourceHashes,
				(status) =>
					this.acceptRecoveryChangeSetStatus(status, recoveryCandidate),
			);
			if (result.kind === "durable") {
				this.clearSessionHistory();
				await this.openRecoveredProject(recoveryCandidate.project.projectId);
				return this.snapshot().kind === "saved"
					? result
					: { kind: "reopen-failed", reasonCode: "PERSISTENCE_CORRUPT" };
			}
			if (result.kind === "stale-base") {
				await this.openRecoveredProject(recoveryCandidate.project.projectId);
				return result;
			}
			if (
				result.kind === "persist-failed" &&
				(this.lostWriterLeaseResultPending || this.recordLostWriterLease())
			) {
				this.lostWriterLeaseResultPending = false;
				return { kind: "writer-lease-lost", reasonCode: "WRITER_LEASE_LOST" };
			}
			this.current = undefined;
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return result;
		} catch {
			this.current = undefined;
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** A recovery-only, safe diagnostic; it exposes no Project bytes or mutable state. */
	public recoveryCustomGlbRemovalSummary():
		| RecoveryCustomGlbRemovalSummary
		| undefined {
		const candidate = this.recoveryCandidate;
		const unresolvedResourceHashes = new Set(
			this.recoveryCustomGlbResourceHashes,
		);
		if (!candidate || unresolvedResourceHashes.size === 0) {
			return undefined;
		}
		const affectedDefinitionIds = new Set(
			candidate.project.assetDefinitionRefs
				.filter((definition) =>
					unresolvedResourceHashes.has(definition.resourceHash),
				)
				.map((definition) => definition.assetDefinitionId),
		);
		return {
			affectedAssetDefinitionCount: affectedDefinitionIds.size,
			affectedAssetInstanceCount: candidate.project.assetInstances.filter(
				(item) =>
					item.assetDefinitionId !== undefined &&
					affectedDefinitionIds.has(item.assetDefinitionId),
			).length,
		};
	}

	/**
	 * Explicitly replaces another context's project-scoped fence. There is no
	 * implicit handoff: callers must opt in and then reload the durable base.
	 */
	public async takeOverWriterLease(): Promise<WriterAccess> {
		const target = this.current ?? this.recoveryCandidate;
		if (!target || !this.writerLeases) {
			return { kind: "not-ready" };
		}
		try {
			const access = await this.writerLeases.takeOverWriterLease(
				target.project.projectId,
			);
			if (access.kind !== "writable") {
				this.writerLeaseAccess = access;
				return access;
			}
			this.writerLeaseAccess = access;
			this.lostWriterLeaseResultPending = false;
			await this.openRecoveredProject(target.project.projectId);
		} catch {
			return this.writerLeaseAccess;
		}
		return this.writerLeaseAccess;
	}

	/** Rechecks ownership when a phone tab resumes and reloads the Durable base. */
	public async refreshWriterLeaseAccess(): Promise<WriterAccess> {
		const requestId = this.navigationRequestId;
		const target = this.current ?? this.recoveryCandidate;
		if (!target || !this.writerLeases) {
			return { kind: "not-ready" };
		}
		const mayReloadTarget = () =>
			this.isCurrentNavigationRequest(requestId) &&
			(this.current ?? this.recoveryCandidate) === target &&
			!this.publicationInFlight;
		try {
			const previousAccess = this.writerLeaseAccess;
			// A context that opened behind another writer stays read-only until the
			// user explicitly takes over. In particular, the UI heartbeat must not
			// silently acquire an expired foreign fence after a process restart.
			const access =
				previousAccess.kind === "read-only"
					? previousAccess
					: await this.writerLeases.inspectWriterAccess(
							target.project.projectId,
						);
			if (!this.isCurrentNavigationRequest(requestId)) {
				return this.writerLeaseAccess;
			}
			this.writerLeaseAccess = access;
			if (access.kind !== "read-only") {
				if (previousAccess.kind !== access.kind && this.current) {
					// Writer readiness says nothing about publication. In particular,
					// the first heartbeat must preserve a pending save or its failure.
					this.setState({ ...this.state });
				}
				return access;
			}
			if (previousAccess.kind !== access.kind) {
				this.setState({ ...this.state });
			}
			// A lease refresh may update access while unpublished work stays live.
			// Never replace its failure/saving state or a newer committed command.
			if (!mayReloadTarget()) return this.writerLeaseAccess;
			const loaded = this.projectDirectory
				? await this.projectDirectory.loadProject(target.project.projectId)
				: await this.repository.loadCurrent();
			if (
				loaded.kind === "durable" &&
				loaded.candidate.project.projectId === target.project.projectId &&
				mayReloadTarget()
			) {
				await this.acceptOpenedCandidate(
					loaded.candidate,
					requestId,
					mayReloadTarget,
				);
			}
			return this.writerLeaseAccess;
		} catch {
			return this.writerLeaseAccess;
		}
	}

	public subscribe(listener: (state: ProjectScreenState) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	public subscribeProductMetrics(listener: ProductMetricSink): () => void {
		this.productMetricListeners.add(listener);
		return () => this.productMetricListeners.delete(listener);
	}

	private emitProductMetric(
		metric: ProductMetric,
		observers: Iterable<ProductMetricSink> = this.productMetricListeners,
	): void {
		for (const listener of observers) {
			try { listener(metric); } catch { /* An observer cannot affect the editor. */ }
		}
	}

	public open(): Promise<void> {
		if (this.directoryRenameUnsettled) return Promise.resolve();
		if (this.openInFlight) {
			return this.openInFlight;
		}
		const requestId = this.beginNavigationRequest();
		const opening = this.projectDirectory
			? this.openProjectDirectory(requestId)
			: this.openCurrentProject(requestId);
		this.openInFlight = opening;
		void opening.finally(() => {
			if (this.openInFlight === opening) {
				this.openInFlight = undefined;
			}
		});
		return opening;
	}

	private async openCurrentProject(requestId: number): Promise<void> {
		this.clearSessionHistory();
		this.clearRecoveryCustomGlbResourceState();
		try {
			const loaded = await this.repository.loadCurrent();
			if (!this.isCurrentNavigationRequest(requestId)) {
				return;
			}
			if (loaded.kind === "durable") {
				await this.acceptOpenedCandidate(loaded.candidate, requestId);
				return;
			}
			this.current = undefined;
			this.writerLeaseAccess = { kind: "not-ready" };
			this.setState(loaded.kind === "empty" ? { kind: "first-run" } : loaded);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
		}
	}

	/** Returns to the local picker without changing any durable Project. */
	public async showProjects(): Promise<void> {
		if (!this.projectDirectory || this.directoryRenameUnsettled) {
			return;
		}
		await this.openProjectDirectory(this.beginNavigationRequest());
	}

	/** Deletes the explicitly confirmed card while keeping the Projects hub open. */
	public async permanentlyDeleteProjectFromDirectory(
		projectId: string,
		_options?: ProjectStorageOwnerOptions,
	): Promise<ProjectDeletionResult> {
		if (this.publicationInFlight) return { kind: "in-progress" };
		const directory = this.projectDirectory;
		const hub = this.snapshot();
		if (!directory || !supportsProjectDeletion(directory) || hub.kind !== "projects") {
			return { kind: "not-ready" };
		}
		if (!hub.projects.some((project) => project.projectId === projectId)) {
			return { kind: "not-found" };
		}
		const requestId = this.beginNavigationRequest();
		this.publicationInFlight = true;
		try {
			const loaded = await directory.loadProject(projectId);
			if (!this.isCurrentNavigationRequest(requestId)) return { kind: "not-ready" };
			if (loaded.kind === "empty") return { kind: "not-found" };
			if (
				loaded.kind !== "durable" ||
				loaded.candidate.project.projectId !== projectId ||
				loaded.candidate.revision.projectId !== projectId
			) return { kind: "not-ready" };
			const access = await this.inspectWriterAccess(loaded.candidate);
			if (!this.isCurrentNavigationRequest(requestId)) return { kind: "not-ready" };
			if (access.kind === "read-only") return { kind: "read-only" };
			if (this.writerLeases && access.kind !== "writable") return { kind: "not-ready" };
			const result = await directory.permanentlyDeleteProject(projectId);
			if (this.writerLeases?.consumeLostWriterLease()) return { kind: "writer-lease-lost" };
			if (result.kind === "permanently-deleted" && this.isCurrentNavigationRequest(requestId)) {
				this.setState({
					...hub,
					projects: hub.projects.filter((project) => project.projectId !== projectId),
				});
			}
			return result;
		} catch {
			return { kind: "persist-failed" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/**
	 * A named confirmation is required by presentation before this direct route.
	 * The durable adapter removes metadata only after its fenced transaction;
	 * shared resource cleanup remains global GC work.
	 */
	public async permanentlyDeleteCurrentProject(): Promise<ProjectDeletionResult> {
		const directory = this.projectDirectory;
		const current = this.current;
		if (!directory || !current || !supportsProjectDeletion(directory)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) return { kind: "in-progress" };
		if (this.writerLeaseAccess.kind === "read-only")
			return { kind: "read-only" };
		try {
			const result = await directory.permanentlyDeleteProject(
				current.project.projectId,
			);
			if (this.recordLostWriterLease()) {
				return { kind: "writer-lease-lost" };
			}
			if (result.kind !== "permanently-deleted") {
				return result;
			}
			await this.openProjectDirectory(this.beginNavigationRequest());
			return result;
		} catch {
			return { kind: "persist-failed" };
		}
	}

	/** Starts a separate new Project flow; existing durable cards remain intact. */
	public startNewProject(): void {
		if (this.directoryRenameUnsettled) return;
		this.beginNavigationRequest();
		this.clearSessionHistory();
		this.clearRecoveryCustomGlbResourceState();
		this.current = undefined;
		this.writerLeaseAccess = { kind: "not-ready" };
		this.setState({ kind: "first-run" });
	}

	/** Loads only the current Durable Revision named by the selected card. */
	public openProject(
		projectId: string,
		options?: ProjectOpenOptions,
	): Promise<void> {
		return this.openStoredProject(projectId, options?.initialAction !== "rename");
	}

	private async openStoredProject(projectId: string, userSelected: boolean): Promise<void> {
		if (!this.projectDirectory || this.directoryRenameUnsettled) {
			return;
		}
		const requestId = this.beginNavigationRequest();
		this.clearSessionHistory();
		this.clearRecoveryCustomGlbResourceState();
		this.current = undefined;
		this.writerLeaseAccess = { kind: "not-ready" };
		this.setState({ kind: "loading" });
		try {
			const loaded = await this.projectDirectory.loadProject(projectId);
			if (!this.isCurrentNavigationRequest(requestId)) {
				return;
			}
			if (loaded.kind === "durable") {
				await this.acceptOpenedCandidate(loaded.candidate, requestId);
				if (userSelected && this.isCurrentNavigationRequest(requestId) &&
					this.current === loaded.candidate && this.writerAccess().kind === "writable") {
					this.emitProductMetric("saved_project_opened");
				}
				return;
			}
			this.setState(
				loaded.kind === "recovery-needed"
					? loaded
					: { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" },
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
		}
	}

	private async openProjectDirectory(requestId: number): Promise<void> {
		const directory = this.projectDirectory;
		if (!directory) {
			return this.openCurrentProject(requestId);
		}
		this.clearSessionHistory();
		this.clearRecoveryCustomGlbResourceState();
		this.current = undefined;
		this.writerLeaseAccess = { kind: "not-ready" };
		this.setState({ kind: "loading" });
		try {
			const result = await directory.listProjects();
			if (!this.isCurrentNavigationRequest(requestId)) {
				return;
			}
			this.acceptProjectDirectory(result);
		} catch {
			if (this.isCurrentNavigationRequest(requestId)) {
				this.setState({
					kind: "recovery-needed",
					reasonCode: "PERSISTENCE_CORRUPT",
				});
			}
		}
	}

	private acceptProjectDirectory(result: ProjectDirectoryResult): void {
		if (result.kind === "empty") {
			this.setState({ kind: "projects", projects: [] });
			return;
		}
		if (result.kind === "populated") {
			this.setState({
				kind: "projects",
				projects: result.projects,
				...(result.recoveryNeeded ? { recoveryNeeded: true as const } : {}),
			});
			return;
		}
		this.setState(result);
	}

	private enterCurrentResourceRecovery(
		candidate: DurablePublicationCandidate,
		unresolvedResourceHashes: readonly string[],
	): void {
		this.historyResourceIssue = undefined;
		this.recoveryCustomGlbResourceHashes = unresolvedResourceHashes;
		this.recoveryCandidate = isV1Candidate(candidate) ? candidate : undefined;
		this.current = undefined;
		this.setState({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	}

	private enterHistoryResourceRecovery(
		current: DurablePublicationCandidate,
		issue: HistoryResourceIssue,
	): void {
		this.historyResourceIssue = issue;
		this.setState({
			kind: "history-recovery-needed",
			project: current.project,
			projectName: current.project.name,
			resourceHashes: issue.resourceHashes,
			revisionId: current.revision.revisionId,
		});
	}

	/**
	 * A durable Project may reference immutable custom-resource bytes outside
	 * its revision. Never silently substitute a greybox when that exact local
	 * resource is gone: the Project remains recoverable but cannot be edited.
	 */
	private async acceptOpenedCandidate(
		candidate: DurablePublicationCandidate,
		requestId: number,
		mayAccept: () => boolean = () => true,
	): Promise<void> {
		const resourceMetrics = new Set<ResourceProductMetric>();
		const unresolvedResourceHashes =
			await this.unresolvedPinnedCustomGlbResourceHashes(candidate, resourceMetrics);
		if (!this.isCurrentNavigationRequest(requestId) || !mayAccept()) {
			return;
		}
		// A refreshed read-only candidate must not turn an expired foreign lease
		// into this context's writer lease. Only takeOverWriterLease may do that.
		const writerAccess =
			this.writerLeaseAccess.kind === "read-only"
				? this.writerLeaseAccess
				: await this.inspectWriterAccess(candidate);
		if (!this.isCurrentNavigationRequest(requestId) || !mayAccept()) {
			return;
		}
		this.writerLeaseAccess = writerAccess;
		if (unresolvedResourceHashes.length > 0) {
			this.enterCurrentResourceRecovery(candidate, unresolvedResourceHashes);
			for (const metric of resourceMetrics) this.emitProductMetric(metric);
			return;
		}
		this.clearRecoveryCustomGlbResourceState();
		this.current = candidate;
		this.setDurableState(candidate);
	}

	private async unresolvedPinnedCustomGlbResourceHashes(
		candidate: DurablePublicationCandidate,
		resourceMetrics?: Set<ResourceProductMetric>,
	): Promise<readonly string[]> {
		if (
			!isV1Candidate(candidate) ||
			candidate.project.assetDefinitionRefs.length === 0
		) {
			return [];
		}
		if (!this.customAssetResources || !this.binaryChecksum) {
			resourceMetrics?.add("storage_unavailable");
			return [
				...new Set(
					candidate.project.assetDefinitionRefs.map(
						(asset) => asset.resourceHash,
					),
				),
			];
		}
		try {
			return (
				(await this.verifiedUnresolvedPinnedCustomGlbResourceHashes(
					candidate,
					resourceMetrics,
				)) ?? []
			);
		} catch {
			resourceMetrics?.add("storage_unavailable");
			return [
				...new Set(
					candidate.project.assetDefinitionRefs.map(
						(asset) => asset.resourceHash,
					),
				),
			];
		}
	}

	/** Returns undefined when no verifier exists; read/checksum errors stay observable to destructive recovery. */
	private async verifiedUnresolvedPinnedCustomGlbResourceHashes(
		candidate: PublicationCandidate,
		resourceMetrics?: Set<ResourceProductMetric>,
	): Promise<readonly string[] | undefined> {
		const resourceStore = this.customAssetResources;
		const checksum = this.binaryChecksum;
		if (!resourceStore || !checksum) {
			return undefined;
		}
		const resourcesAreExact = await Promise.all(
			candidate.project.assetDefinitionRefs.map(async (asset) => {
				const bytes = await resourceStore.read(asset.resourceHash);
				if (!bytes) {
					resourceMetrics?.add("resource_missing");
					return false;
				}
				const isExact = bytes.byteLength === asset.byteLength && sameSha256ResourceHashBits(
					asset.resourceHash,
					await checksum.sha256Bytes(bytes),
				);
				if (!isExact) resourceMetrics?.add("resource_corrupt");
				return isExact;
			}),
		);
		return [
			...new Set(
				candidate.project.assetDefinitionRefs
					.filter((_, index) => !resourcesAreExact[index])
					.map((asset) => asset.resourceHash),
			),
		];
	}

	/** Compare digest bits only to group a repair file; never use a group key as a storage address. */
	private distinctResourceHashDigests(
		hashes: readonly string[],
	): readonly string[] {
		const digests: string[] = [];
		for (const hash of hashes)
			if (
				!digests.some((existing) => sameSha256ResourceHashBits(existing, hash))
			)
				digests.push(hash);
		return digests;
	}

	/** A repair must satisfy every retained reference to the original raw key, including Undo/Redo. */
	private expectedRepairResourceByteLengths(
		hashes: readonly string[],
	): ReadonlyMap<string, ReadonlySet<number>> | undefined {
		const lengths = new Map(hashes.map((hash) => [hash, new Set<number>()]));
		for (const candidate of [
			this.current,
			this.recoveryCandidate,
			...this.undoStack,
			...this.redoStack,
		]) {
			if (!isV1Candidate(candidate)) continue;
			for (const definition of candidate.project.assetDefinitionRefs)
				lengths.get(definition.resourceHash)?.add(definition.byteLength);
		}
		return [...lengths.values()].some((values) => values.size === 0)
			? undefined
			: lengths;
	}

	private openRecoveredProject(
		recoveryProjectId: string | undefined,
	): Promise<void> {
		return this.projectDirectory && recoveryProjectId
			? this.openStoredProject(recoveryProjectId, false)
			: this.open();
	}

	/** Exact byte repair does not create a new session boundary or silently drop undo roots. */
	private async finishExactResourceRepair(): Promise<void> {
		const source = this.current ?? this.recoveryCandidate;
		if (!source) return;
		const requestId = this.navigationRequestId;
		const loaded = this.projectDirectory ? await this.projectDirectory.loadProject(source.project.projectId) : await this.repository.loadCurrent();
		if (!this.isCurrentNavigationRequest(requestId) || loaded.kind !== "durable" || loaded.candidate.project.projectId !== source.project.projectId || loaded.candidate.revision.revisionId !== source.revision.revisionId) return;
		await this.acceptOpenedCandidate(loaded.candidate, requestId);
		const current = this.current;
		if (!current || !this.isCurrentNavigationRequest(requestId)) return;
		const missing = new Set<string>();
		let issue: HistoryResourceIssue | undefined;
		for (const { direction, target } of [ ...this.undoStack.map((target) => ({ direction: "undo" as const, target })), ...this.redoStack.map((target) => ({ direction: "redo" as const, target })) ]) {
			const hashes = await this.unresolvedPinnedCustomGlbResourceHashes(target);
			if (!this.isCurrentNavigationRequest(requestId)) return;
			if (hashes.length === 0) continue;
			for (const hash of hashes) missing.add(hash);
			issue ??= { direction, targetRevisionId: target.revision.revisionId, resourceHashes: hashes };
		}
		if (issue) this.enterHistoryResourceRecovery(current, { ...issue, resourceHashes: [...missing] });
		else { this.historyResourceIssue = undefined; this.setDurableState(current); }
	}

	private clearRecoveryCustomGlbResourceState(): void {
		this.recoveryCustomGlbResourceHashes = [];
		this.recoveryCandidate = undefined;
	}

	public async create(
		name: string,
	): Promise<CreateProjectResult | WriterLeaseLostResult> {
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return this.withWriterLeaseOutcome(
				await this.createProject.execute(name, (status) =>
					this.acceptStatus(status),
				),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/**
	 * Creates a separate local project from a fully validated transfer file.
	 * The source project stays untouched, and the imported project starts a new
	 * session-history boundary after its durable pointer is published.
	 */
	public async importProjectJson(
		bytes: Uint8Array,
	): Promise<
		| ImportLocalProjectJsonResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		if (!this.importLocalProjectJson) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await this.importLocalProjectJson.execute(bytes, (status) =>
				this.acceptImportedProjectStatus(status),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/**
	 * Imports a fully checked Portable Backup only as a new local Project. The
	 * existing directory remains untouched until the imported candidate publishes.
	 */
	public importPortableBackup(
		bytes: Uint8Array,
		options?: {
			readonly onStatus?: (status: ImportPortableBackupStatus) => void;
			readonly signal?: CancellationSignalPort;
		},
	): Promise<
		ImportPortableBackupResult | { readonly kind: "in-progress" | "not-ready" }
	> {
		return this.executePortableBackupImport(
			this.importPortableBackupUseCase,
			bytes,
			options,
		);
	}

	/** The caller explicitly selected registered transfer; a refusal never retries another decoder. */
	public importRegisteredPortableBackup(
		bytes: Uint8Array,
		options?: {
			readonly onStatus?: (status: ImportPortableBackupStatus) => void;
			readonly signal?: CancellationSignalPort;
		},
	): Promise<
		ImportPortableBackupResult | { readonly kind: "in-progress" | "not-ready" }
	> {
		return this.executePortableBackupImport(
			this.canonicalPlanGraphMutations.registeredPortableBackupImporter,
			bytes,
			options,
			this.canonicalPlanGraphMutations.registeredPortableBackupAdmission,
		);
	}

	private async executePortableBackupImport(
		useCase: ImportPortableBackupUseCase | undefined,
		bytes: Uint8Array,
		options?: {
			readonly onStatus?: (status: ImportPortableBackupStatus) => void;
			readonly signal?: CancellationSignalPort;
		},
		admission?: PortableBackupImportAdmissionPort,
	): Promise<
		ImportPortableBackupResult | { readonly kind: "in-progress" | "not-ready" }
	> {
		if (!useCase) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		const previousState = this.state;
		this.publicationInFlight = true;
		try {
			const result = await useCase.execute(
				bytes,
				(status) => {
					if (admission) {
						const ownedStatus = { ...status };
						try {
							options?.onStatus?.(status);
						} catch {
							/* An observer cannot change a verified import's outcome. */
						}
						this.acceptImportedProjectStatus(ownedStatus, "backup_imported");
					} else {
						options?.onStatus?.(status);
						this.acceptImportedProjectStatus(status, "backup_imported");
					}
				},
				options?.signal,
			);
			if (
				admission &&
				this.state.kind === "saving" &&
				result.kind !== "durable" &&
				result.kind !== "persist-failed"
			)
				this.setState(previousState);
			return result;
		} catch {
			if (admission) {
				if (this.state.kind === "saving") this.setState(previousState);
				return { kind: "verification-unavailable" };
			}
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/**
	 * Imports the one visible Project transfer file. The byte signature, rather
	 * than a filename supplied by the operating system, selects the complete
	 * archive route; every other file stays on the resource-free JSON boundary.
	 */
	public async importProjectTransfer(
		bytes: Uint8Array,
		options?: {
			readonly onPortableStatus?: (status: ImportPortableBackupStatus) => void;
			readonly signal?: CancellationSignalPort;
		},
	): Promise<
		| ImportLocalProjectJsonResult
		| ImportPortableBackupResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		return isPortableProjectArchive(bytes)
			? this.importPortableBackup(bytes, {
					onStatus: options?.onPortableStatus,
					signal: options?.signal,
				})
			: this.importProjectJson(bytes);
	}

	/** Reads a durable snapshot only; export never changes the selected project or history. */
	public async exportProjectJson(
		projectId?: string,
	): Promise<ExportLocalProjectJsonResult | { readonly kind: "not-ready" }> {
		if (!this.exportLocalProjectJson) {
			return { kind: "not-ready" };
		}
		const source = await this.loadProjectTransferSource(projectId);
		return source
			? this.exportLocalProjectJson.execute(source)
			: { kind: "not-ready" };
	}

	/** Builds a complete local bundle only; export never changes session state. */
	public async exportPortableBackup(
		projectId?: string,
	): Promise<ExportPortableBackupResult | { readonly kind: "not-ready" }> {
		if (!this.exportPortableBackupUseCase) {
			return { kind: "not-ready" };
		}
		const source = await this.loadProjectTransferSource(projectId);
		return source
			? this.exportPortableBackupUseCase.execute(source)
			: { kind: "not-ready" };
	}

	/**
	 * Exports the one visible Project transfer as a self-contained Portable
	 * Backup. A resource-free snapshot uses the same container as a Project with
	 * referenced bytes, so the user-visible action never silently downgrades to
	 * the narrower JSON interchange format.
	 */
	public async exportProjectTransfer(
		projectId?: string,
		options?: ProjectTransferExportOptions,
	): Promise<ExportPortableBackupResult | { readonly kind: "not-ready" }> {
		const source = await this.loadProjectTransferSource(projectId);
		if (!source) return { kind: "not-ready" };

		return this.exportPortableBackupUseCase
			? this.exportPortableBackupUseCase.execute(source, options?.signal)
			: { kind: "not-ready" };
	}

	/** Additional explicit format: always reload the selected actual Durable row. */
	public async exportRegisteredProjectTransfer(
		projectId?: string,
		options?: ProjectTransferExportOptions,
	): Promise<
		| ExportPortableBackupResult
		| { readonly kind: "not-ready" }
		| { readonly kind: "verification-unavailable" }
	> {
		const exporter =
				this.canonicalPlanGraphMutations.registeredPortableBackupExporter,
			selected = projectId ?? this.current?.project.projectId;
		if (!exporter || !selected || !this.projectDirectory)
			return { kind: "not-ready" };
		if (options?.signal?.aborted)
			return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
		try {
			const loaded = await this.projectDirectory.loadProject(selected);
			if (options?.signal?.aborted)
				return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
			if (
				loaded.kind !== "durable" ||
				loaded.candidate.project.projectId !== selected ||
				loaded.candidate.revision.projectId !== selected
			)
				return { kind: "verification-unavailable" };
			if (!isV1Candidate(loaded.candidate))
				return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" };
			const owned = {
				project: copyProject(loaded.candidate.project),
				revision: { ...loaded.candidate.revision },
			};
			freezeBrowserBackupValue(owned);
			const result = await exporter.execute(owned, options?.signal);
			return options?.signal?.aborted
				? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
				: result;
		} catch {
			return options?.signal?.aborted
				? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
				: { kind: "verification-unavailable" };
		}
	}

	private async loadProjectTransferSource(
		projectId: string | undefined,
	): Promise<DurablePublicationCandidate | undefined> {
		const current = this.current;
		if (
			current &&
			(projectId === undefined || projectId === current.project.projectId)
		) {
			return current;
		}
		if (!projectId || !this.projectDirectory) return undefined;
		const loaded = await this.projectDirectory.loadProject(projectId);
		return loaded.kind === "durable" ? loaded.candidate : undefined;
	}

	/** Publishes a rename against the selected card without entering an editor session. */
	public async renameProjectFromDirectory(
		projectId: string,
		baseRevisionId: string,
		name: string,
	): Promise<DirectoryRenameResult> {
		if (this.publicationInFlight) return { kind: "in-progress" };
		const directory = this.projectDirectory;
		const useCase = this.canonicalPlanGraphMutations.renameProject;
		const hub = this.snapshot();
		if (!directory || !useCase || hub.kind !== "projects") return { kind: "not-ready" };
		const card = hub.projects.find(project => project.projectId === projectId);
		if (!card) return { kind: "not-ready" };
		if (card.revisionId !== baseRevisionId)
			return { kind: "stale-base", reasonCode: "STALE_BASE_REVISION" };
		this.directoryRenameActive = true;
		try {
			const loaded = await directory.loadProject(projectId);
			if (loaded.kind !== "durable" || !isV1Candidate(loaded.candidate) ||
				loaded.candidate.project.projectId !== projectId || loaded.candidate.revision.projectId !== projectId)
				return { kind: "not-ready" };
			if (loaded.candidate.revision.revisionId !== baseRevisionId) {
				this.updateDirectoryCard(loaded.candidate);
				return { kind: "stale-base", reasonCode: "STALE_BASE_REVISION" };
			}
			const writer = await this.inspectWriterAccess(loaded.candidate);
			if (writer.kind !== "writable") return { kind: writer.kind };
			let attempt: DirectoryRenameAttempt | undefined;
			const result = await useCase.execute(loaded.candidate, name, status => {
				if (status.kind !== "saving") attempt = { candidate: status.candidate, baseRevisionId };
			});
			return await this.finishDirectoryRename(result, attempt);
		} catch {
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED", retryAvailable: false };
		} finally {
			this.directoryRenameActive = false;
		}
	}

	public async retryDirectoryProjectRename(): Promise<DirectoryRenameResult> {
		if (this.directoryRenameActive) return { kind: "in-progress" };
		const attempt = this.pendingDirectoryRename;
		if (!attempt || this.snapshot().kind !== "projects") return { kind: "not-ready" };
		this.directoryRenameActive = true;
		try {
			const result = await this.publishNextRevision(attempt.candidate, attempt.baseRevisionId);
			return await this.finishDirectoryRename(
				result.kind === "durable"
					? {
						kind: "durable",
						projectId: attempt.candidate.project.projectId,
						revisionId: attempt.candidate.revision.revisionId,
					}
					: result.kind === "stale-base"
						? { kind: "stale-base", reasonCode: "STALE_BASE_REVISION" }
						: result,
				attempt,
			);
		} catch {
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED", retryAvailable: true };
		} finally {
			this.directoryRenameActive = false;
		}
	}

	private async finishDirectoryRename(
		result: RenameProjectUseCaseResult,
		attempt: DirectoryRenameAttempt | undefined,
	): Promise<DirectoryRenameResult> {
		if (this.writerLeases?.consumeLostWriterLease()) {
			this.pendingDirectoryRename = undefined;
			return { kind: "writer-lease-lost", reasonCode: "WRITER_LEASE_LOST" };
		}
		this.pendingDirectoryRename = undefined;
		if (result.kind === "persist-failed") {
			if (attempt && this.projectDirectory) {
				const expected = attempt.candidate.revision;
				// A lost acknowledgement does not make a verified durable rename pending.
				const latest = await this.projectDirectory.loadProject(expected.projectId).catch(() => undefined);
				if (latest?.kind === "durable" &&
					latest.candidate.project.projectId === expected.projectId &&
					latest.candidate.revision.projectId === expected.projectId &&
					latest.candidate.revision.revisionId === expected.revisionId &&
					latest.candidate.revision.checksum === expected.checksum &&
					latest.candidate.revision.serializedProject === expected.serializedProject) {
					this.updateDirectoryCard(latest.candidate);
					return { kind: "durable", projectId: expected.projectId, revisionId: expected.revisionId };
				}
				if (latest?.kind === "durable" && latest.candidate.revision.revisionId === attempt.baseRevisionId &&
					result.reasonCode !== "PERSISTENCE_QUOTA_EXCEEDED") {
					const missingResources = await this.verifiedUnresolvedPinnedCustomGlbResourceHashes(attempt.candidate)
						.catch(() => undefined);
					if (missingResources?.length) return { kind: "resources-unavailable" };
				}
			}
			if (result.reasonCode === "PERSISTENCE_WRITE_FAILED" || result.reasonCode === "PERSISTENCE_QUOTA_EXCEEDED") {
				this.pendingDirectoryRename = attempt;
			}
			return { ...result, retryAvailable: this.pendingDirectoryRename !== undefined };
		}
		if (result.kind === "durable" && attempt) this.updateDirectoryCard(attempt.candidate);
		if (result.kind === "stale-base" && attempt && this.projectDirectory) {
			const latest = await this.projectDirectory.loadProject(attempt.candidate.project.projectId);
			if (latest.kind === "durable") this.updateDirectoryCard(latest.candidate);
		}
		return result;
	}

	private updateDirectoryCard(candidate: DurablePublicationCandidate): void {
		const hub = this.snapshot();
		if (hub.kind !== "projects") return;
		const projects = hub.projects.map(card => card.projectId === candidate.project.projectId
			? { ...card, revisionId: candidate.revision.revisionId, name: candidate.project.name, updatedAt: candidate.project.updatedAt }
			: card);
		projects.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt) || first.projectId.localeCompare(second.projectId));
		this.setState({ ...hub, projects });
	}

	/** Renaming creates the next exact-base revision and becomes undoable only when publication is durable. */
	public async renameProject(
		name: string,
		_options?: ProjectStorageOwnerOptions,
	): Promise<
		| RenameProjectUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.renameProject;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return this.withWriterLeaseOutcome(
				await useCase.execute(current, name, (status: RenameProjectStatus) =>
					this.acceptRenameStatus(status, current),
				),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async configureRectangularRoom(
		input: RectangularRoomInput,
	): Promise<
		| ConfigureRectangularRoomUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!this.configureRoom || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return this.withWriterLeaseOutcome(
				await this.configureRoom.execute(current, input, (status) =>
					this.acceptRoomStatus(status, current),
				),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async addConstrainedPartition(
		input: ConstrainedPartitionInput,
	): Promise<
		| AddConstrainedPartitionUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!this.addPartition || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await this.addPartition.execute(current, input, (status) =>
				this.acceptPartitionStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async createParametricFloorItem(
		input: ParametricFloorItemInput,
	): Promise<
		| CreateParametricFloorItemUseCaseResult
		| CreateParametricFloorItemV2UseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!current || (!isV1Candidate(current) && !isV2Candidate(current))) {
			return { kind: "not-ready" };
		}
		if (isV1Candidate(current) && !this.createFloorItem) {
			return { kind: "not-ready" };
		}
		if (
			isV2Candidate(current) &&
			(!this.enableLegacyV2FixtureMode || !this.createFloorItemV2)
		) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		if (isV1Candidate(current) && this.roomInteriorEnabled()) {
			const layoutId = this.layoutForPlacement(current.project, input.roomId);
			if (layoutId !== undefined) input = { ...input, roomLayoutId: layoutId };
		}
		this.publicationInFlight = true;
		try {
			return isV1Candidate(current)
				? ((await this.createFloorItem?.execute(current, input, (status) =>
						this.acceptFloorItemStatus(status, current),
					)) ?? { kind: "not-ready" })
				: ((await this.createFloorItemV2?.execute(
						current,
						input,
						(status: CreateParametricFloorItemV2Status) =>
							this.acceptMutationStatus(status, current),
					)) ?? { kind: "not-ready" });
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Creates a wall-local primitive through the fenced durable revision route. */
	public async createParametricWallItem(
		input: ParametricWallItemInput,
	): Promise<
		| CreateParametricWallItemUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.createParametricWallItem;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			const result = await useCase.execute(
				current,
				input,
				(status: CreateParametricWallItemStatus) =>
					this.acceptMutationStatus(status, current, "item_placed"),
			);
			if (result.kind === "stale-base") {
				await this.reloadCurrentDurableRevision(current);
			}
			return this.withWriterLeaseOutcome(result);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Moves a wall item in the local millimetre coordinates of its stable host. */
	public async moveParametricWallItem(
		input: MoveParametricWallItemInput,
	): Promise<
		| MoveParametricWallItemUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.moveParametricWallItem;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: MoveParametricWallItemStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Persists one declared local colour variant for a selected wall asset. */
	public async recolorParametricWallItem(
		input: RecolorParametricWallItemInput,
	): Promise<
		| RecolorParametricWallItemUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.recolorWallItem;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			const result = await useCase.execute(
				current,
				input,
				(status: RecolorParametricWallItemStatus) =>
					this.acceptMutationStatus(status, current, "item_color_changed"),
			);
			if (result.kind === "stale-base") {
				await this.reloadCurrentDurableRevision(current);
			}
			return this.withWriterLeaseOutcome(result);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async deleteParametricWallItem(input: {
		readonly assetInstanceId: string;
	}): Promise<
		| DeleteParametricWallItemUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.deleteParametricWallItem;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: DeleteParametricWallItemStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Changes only the explicit accidental-edit guard of one wall-local item. */
	public async setParametricWallItemLock(
		input: SetParametricWallItemLockInput,
	): Promise<
		| SetParametricWallItemLockUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.setParametricWallItemLock;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: SetParametricWallItemLockStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Changes only the explicit accidental-edit guard of one floor-hosted item. */
	public async setParametricFloorItemLock(
		input: SetParametricFloorItemLockInput,
	): Promise<
		| SetParametricFloorItemLockUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.setParametricFloorItemLock;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: SetParametricFloorItemLockStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Pins a validated local GLB and creates its first durable floor instance. */
	public async createCustomGlbFloorItem(
		input: CreateCustomGlbItemInputWithBytes,
		options?: { readonly signal?: CancellationSignalPort },
	): Promise<
		| CreateCustomGlbFloorItemUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.createCustomGlbFloorItem;
		if (!isV1Candidate(current) || !useCase) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		if (this.roomInteriorEnabled() && !("anchorClass" in input)) {
			const layoutId = this.layoutForPlacement(current.project, input.roomId);
			if (layoutId !== undefined) input = { ...input, roomLayoutId: layoutId };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: CreateCustomGlbFloorItemStatus) =>
					this.acceptMutationStatus(status, current, "item_placed"),
				options?.signal,
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async moveParametricFloorItem(
		input: MoveParametricFloorItemInput,
	): Promise<
		| MoveParametricFloorItemUseCaseResult
		| MoveParametricFloorItemV2UseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!current || (!isV1Candidate(current) && !isV2Candidate(current))) {
			return { kind: "not-ready" };
		}
		if (isV1Candidate(current) && !this.moveFloorItem) {
			return { kind: "not-ready" };
		}
		if (
			isV2Candidate(current) &&
			(!this.enableLegacyV2FixtureMode || !this.moveFloorItemV2)
		) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		if (isV1Candidate(current) && this.roomInteriorEnabled()) {
			const floor = current.project.assetInstances.find(item => item.assetInstanceId === input.assetInstanceId);
			if (floor?.anchorClass === "floor" && current.project.roomLayouts?.length) {
				const roomId = findRoomForFloorItem(current.project, { ...floor, ...input });
				if (roomId) input = { ...input, roomLayoutId: this.layoutForPlacement(current.project, roomId) };
			}
		}
		this.publicationInFlight = true;
		try {
			return isV1Candidate(current)
				? ((await this.moveFloorItem?.execute(current, input, (status) =>
						this.acceptMovedFloorItemStatus(status, current),
					)) ?? { kind: "not-ready" })
				: ((await this.moveFloorItemV2?.execute(
						current,
						input,
						(status: MoveParametricFloorItemV2Status) =>
							this.acceptMutationStatus(status, current),
					)) ?? { kind: "not-ready" });
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async expandOrthogonalGrid(
		input: OrthogonalGridExpansionInput,
	): Promise<
		| ExpandOrthogonalGridUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!this.expandGrid || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await this.expandGrid.execute(current, input, (status) =>
				this.acceptExpandedGridStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async resizeParametricFloorItem(
		input: ResizeParametricFloorItemInput,
	): Promise<
		| ResizeParametricFloorItemUseCaseResult
		| ResizeParametricFloorItemV2UseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!current || (!isV1Candidate(current) && !isV2Candidate(current))) {
			return { kind: "not-ready" };
		}
		if (isV1Candidate(current) && !this.resizeFloorItem) {
			return { kind: "not-ready" };
		}
		if (
			isV2Candidate(current) &&
			(!this.enableLegacyV2FixtureMode || !this.resizeFloorItemV2)
		) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return isV1Candidate(current)
				? ((await this.resizeFloorItem?.execute(current, input, (status) =>
						this.acceptResizedFloorItemStatus(status, current),
					)) ?? { kind: "not-ready" })
				: ((await this.resizeFloorItemV2?.execute(
						current,
						input,
						(status: ResizeParametricFloorItemV2Status) =>
							this.acceptMutationStatus(status, current),
					)) ?? { kind: "not-ready" });
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async deleteParametricFloorItem(
		input: DeleteParametricFloorItemInput,
	): Promise<
		| DeleteParametricFloorItemUseCaseResult
		| DeleteParametricFloorItemV2UseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!current || (!isV1Candidate(current) && !isV2Candidate(current))) {
			return { kind: "not-ready" };
		}
		if (isV1Candidate(current) && !this.deleteFloorItem) {
			return { kind: "not-ready" };
		}
		if (
			isV2Candidate(current) &&
			(!this.enableLegacyV2FixtureMode || !this.deleteFloorItemV2)
		) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		if (isV1Candidate(current) && supportedGuestsFor(current.project, input.assetInstanceId).length > 0) {
			return { kind: "rejected", reasonCode: "ITEM_LOCKED" };
		}
		this.publicationInFlight = true;
		try {
			return isV1Candidate(current)
				? ((await this.deleteFloorItem?.execute(current, input, (status) =>
						this.acceptDeletedFloorItemStatus(status, current),
					)) ?? { kind: "not-ready" })
				: ((await this.deleteFloorItemV2?.execute(
						current,
						input,
						(status: DeleteParametricFloorItemV2Status) =>
							this.acceptMutationStatus(status, current),
					)) ?? { kind: "not-ready" });
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async deleteConstrainedWall(
		input: DeleteConstrainedWallInput,
	): Promise<
		| DeleteConstrainedWallUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!this.deleteWall || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await this.deleteWall.execute(current, input, (status) =>
				this.acceptDeletedWallStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Product route: persists the user's explicit segment endpoints as one V1 PlanGraph mutation. */
	public async addGeneralWall(
		input: AddWallSegmentInput,
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.addGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current, "wall_added"),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Resolves a refreshed explicit host-delete outcome for an AddWall T/X contact. */
	public async resolveHostConflictAndAddGeneralWall(
		input: AddGeneralWallHostResolutionInput,
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.addGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.resolveHostConflict(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current, "wall_added"),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Deletes the selected edge or its confirmed uninterrupted run. */
	public async deleteGeneralWall(input: {
		readonly previewRevisionId: string;
		readonly wallSegmentId: string;
		readonly wallRunSegmentIds?: readonly string[];
	}): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.deleteGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (current.revision.revisionId !== input.previewRevisionId) {
			return { kind: "stale-base", reasonCode: "STALE_BASE_REVISION" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			const result = await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
			if (result.kind === "stale-base") {
				await this.reloadCurrentDurableRevision(current);
			}
			return this.withWriterLeaseOutcome(result);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Applies a fresh, explicit delete outcome for a previously previewed Opening conflict. */
	public async resolveOpeningConflictAndDeleteWall(input: {
		readonly openingIds: readonly string[];
		readonly wallSegmentId: string;
	}): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.deleteGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Applies the full, freshly rechecked wall-deletion consequence outcome in one Revision. */
	public async resolveWallDeletionConflict(input: {
		readonly itemIds: readonly string[];
		readonly openingIds: readonly string[];
		readonly previewRevisionId: string;
		readonly roomIds: readonly string[];
		readonly roomMetadataResolutions?: readonly DeleteGeneralWallRoomMetadataResolution[];
		readonly wallSegmentId: string;
		readonly wallRunSegmentIds?: readonly string[];
	}): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.deleteGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (current.revision.revisionId !== input.previewRevisionId) {
			return { kind: "stale-base", reasonCode: "STALE_BASE_REVISION" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			const result = await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
			if (result.kind === "stale-base") {
				await this.reloadCurrentDurableRevision(current);
			}
			return this.withWriterLeaseOutcome(result);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Changes the selected wall width and re-derives its rooms. */
	public async changeGeneralWallThickness(
		input: ChangeGeneralWallThicknessInput,
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.changeGeneralWallThickness;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Product route: reverses one wall's canonical local direction in-place. */
	public async reverseGeneralWall(
		input: ReverseGeneralWallInput,
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.reverseGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Moves the selected straight wall parallel to itself. */
	public async moveGeneralWall(
		input: MoveGeneralWallInput,
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.moveGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current, "wall_moved"),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Product route: moves one canonical graph Vertex only after topology validation. */
	public async moveGeneralVertex(
		input: MoveGeneralVertexInput,
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.moveGeneralVertex;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Product route: removes one proven redundant inline graph Vertex. */
	public async deleteGeneralVertex(input: {
		readonly previewRevisionId: string;
		readonly vertexId: string;
	}): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.deleteGeneralVertex;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (current.revision.revisionId !== input.previewRevisionId) {
			return { kind: "stale-base", reasonCode: "STALE_BASE_REVISION" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			const result = await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
			if (result.kind === "stale-base") {
				await this.reloadCurrentDurableRevision(current);
			}
			return this.withWriterLeaseOutcome(result);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Product route: splits one selected straight wall at an exact coordinate. */
	public async splitGeneralWall(
		input: SplitGeneralWallInput,
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.splitGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Resolves a refreshed explicit Opening-delete outcome for one wall split. */
	public async resolveOpeningConflictAndSplitWall(
		input: SplitGeneralWallOpeningResolutionInput,
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.splitGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.resolveOpeningConflict(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Resolves a refreshed complete host-delete outcome for one wall split. */
	public async resolveHostConflictAndSplitWall(
		input: SplitGeneralWallHostResolutionInput & {
			readonly previewRevisionId: string;
		},
	): Promise<
		| GeneralWallProjectMutationUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.splitGeneralWall;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (current.revision.revisionId !== input.previewRevisionId) {
			return { kind: "stale-base", reasonCode: "STALE_BASE_REVISION" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			const result = await useCase.resolveHostConflict(
				current,
				input,
				(status: GeneralWallProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
			if (result.kind === "stale-base") {
				await this.reloadCurrentDurableRevision(current);
			}
			return this.withWriterLeaseOutcome(result);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Persists name, type and height of one existing derived Room. */
	public async updateRoomProperties(
		input: UpdateRoomPropertiesInput,
	): Promise<
		| UpdateRoomPropertiesUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.updateRoomProperties;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: UpdateRoomPropertiesStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/**
	 * Publishes an explicit resolution for a Room-height Opening conflict. This
	 * is intentionally separate from the normal metadata edit so a future UI
	 * must first show the pure preview and cannot silently alter an Opening.
	 */
	public async resolveRoomHeightOpeningConflict(
		input: ResolveRoomHeightOpeningConflictInput,
	): Promise<
		| UpdateRoomPropertiesUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.updateRoomProperties;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.resolveOpeningConflict(
				current,
				input,
				(status: UpdateRoomPropertiesStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Persists one declared local colour variant for the selected floor asset. */
	public async recolorParametricFloorItem(
		input: RecolorParametricFloorItemInput,
	): Promise<
		| RecolorParametricFloorItemUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.recolorFloorItem;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			const result = await useCase.execute(
				current,
				input,
				(status: RecolorParametricFloorItemStatus) =>
					this.acceptMutationStatus(status, current, "item_color_changed"),
			);
			if (result.kind === "stale-base") {
				await this.reloadCurrentDurableRevision(current);
			}
			return this.withWriterLeaseOutcome(result);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Turns a selected floor asset to an explicit continuous yaw. */
	public async rotateParametricFloorItem(
		input: SetParametricFloorItemYawInput,
	): Promise<
		| RotateParametricFloorItemUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.rotateFloorItem;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: RotateParametricFloorItemStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Publishes a fresh empty plan while retaining the prior revision for Undo. */
	public async restartProject(): Promise<
		| RestartProjectUseCaseResult
		| WriterLeaseLostResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.restartProject;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return this.withWriterLeaseOutcome(
				await useCase.execute(current, (status: RestartProjectStatus) =>
					this.acceptMutationStatus(status, current),
				),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Adds a Door only to the explicitly selected durable wall host. */
	public async addDoorOpening(
		input: AddDoorOpeningInput,
	): Promise<
		| DoorOpeningProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.addDoorOpening;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: DoorOpeningProjectMutationStatus) =>
					this.acceptMutationStatus(status, current, "opening_added"),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Adds a Window only to the explicitly selected durable wall host. */
	public async addWindowOpening(
		input: AddWindowOpeningInput,
	): Promise<
		| DoorOpeningProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.addWindowOpening;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: DoorOpeningProjectMutationStatus) =>
					this.acceptMutationStatus(status, current, "opening_added"),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Removes only the selected durable Opening host record. */
	public async deleteDoorOpening(input: {
		readonly openingId: string;
	}): Promise<
		| DoorOpeningProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.deleteDoorOpening;
		if (!useCase || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: DoorOpeningProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Moves a selected Door along its existing durable wall host. */
	public async moveDoorOpening(input: {
		readonly openingId: string;
		readonly offsetMm: number;
	}): Promise<
		| DoorOpeningProjectMutationUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.moveDoorOpening;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: DoorOpeningProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Publishes an Opening edit or a matching-window alignment. */
	public async updateDoorOpening(
		input: UpdateProjectWallOpeningInput,
	): Promise<
		| UpdateDoorOpeningInProjectUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		const useCase = this.canonicalPlanGraphMutations.updateDoorOpening;
		if (!useCase || !isV1Candidate(current)) return { kind: "not-ready" };
		if (this.publicationInFlight) return { kind: "in-progress" };
		this.publicationInFlight = true;
		try {
			return await useCase.execute(
				current,
				input,
				(status: DoorOpeningProjectMutationStatus) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async createRectangularRoomLoop(
		input: RectangularRoomLoopInput,
	): Promise<
		| CreateRectangularRoomLoopUseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (!this.createRoomLoop || !isV1Candidate(current)) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await this.createRoomLoop.execute(current, input, (status) =>
				this.acceptRoomLoopStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Legacy fixture-only migration. It is not a product or canonical PlanGraph route. */
	public async migrateToFreePlan(): Promise<
		| MigrateProjectV1ToV2UseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (
			!this.enableLegacyV2FixtureMode ||
			!this.migrateToV2 ||
			!isV1Candidate(current)
		) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await this.migrateToV2.execute(
				current,
				(status: MigrateProjectV1ToV2Status) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Legacy fixture-only V2 wall mutation; production must use the future AD-22 route. */
	public async addFreeWall(
		input: AddWallSegmentInput,
	): Promise<
		| AddWallToProjectV2UseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (
			!this.enableLegacyV2FixtureMode ||
			!this.addFreeWallV2 ||
			!isV2Candidate(current)
		) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await this.addFreeWallV2.execute(
				current,
				input,
				(status: AddWallToProjectV2Status) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	/** Legacy fixture-only V2 deletion; production must use the future AD-22 route. */
	public async deleteFreeWall(
		input: DeleteWallFromProjectV2Input,
	): Promise<
		| DeleteWallFromProjectV2UseCaseResult
		| { readonly kind: "in-progress" | "not-ready" }
	> {
		const current = this.current;
		if (
			!this.enableLegacyV2FixtureMode ||
			!this.deleteFreeWallV2 ||
			!isV2Candidate(current)
		) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			return await this.deleteFreeWallV2.execute(
				current,
				input,
				(status: DeleteWallFromProjectV2Status) =>
					this.acceptMutationStatus(status, current),
			);
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	public hasPendingPublication(): boolean {
		return this.publicationActive || this.directoryRenameActive;
	}

	/** Actual retained retry target; the failure view may still display the previous Durable Project. */
	public pendingPublicationIdentity(): {
		readonly projectId: string;
		readonly revisionId: string;
		readonly checksum: string;
	} | undefined {
		const candidate = this.pendingHistoryTravel?.target ?? this.pending;
		return candidate ? {
			projectId: candidate.project.projectId,
			revisionId: candidate.revision.revisionId,
			checksum: candidate.revision.checksum,
		} : undefined;
	}

	public persistenceRetryPolicy():
		| "allowed"
		| "registered-transfer-reselection-required" {
		return !this.pendingHistoryTravel &&
			this.pending &&
			this.canonicalPlanGraphMutations.registeredPortableBackupAdmission?.isRetryBlocked(
				this.pending,
			)
			? "registered-transfer-reselection-required"
			: "allowed";
	}

	public async retry(): Promise<void> {
		if (this.persistenceRetryPolicy() !== "allowed") return;
		const historyTravel = this.pendingHistoryTravel;
		const pending = historyTravel?.target ?? this.pending;
		if (!pending || this.publicationActive) {
			return;
		}
		this.publicationInFlight = true;
		this.setState({
			kind: "saving",
			project: this.current?.project,
			revisionId: this.current?.revision.revisionId,
		});
		try {
			if (historyTravel) {
				const publication = await this.publishNextRevision(
					historyTravel.target,
					historyTravel.source.revision.revisionId,
					"history",
				);
				if (publication.kind === "stale-base") {
					this.setDurableState(historyTravel.source);
					return;
				}
				if (publication.kind === "persist-failed") {
					if (this.recordLostWriterLease(historyTravel.target)) {
						return;
					}
					this.setState({
						...publication,
						project: historyTravel.source.project,
						revisionId: historyTravel.source.revision.revisionId,
					});
					return;
				}
				this.completeHistoryTravel(historyTravel);
				this.pendingHistoryTravel = undefined;
				return;
			}
			const expectedBaseRevisionId = this.pendingForwardExpectedBaseRevisionId;
			const publication =
				expectedBaseRevisionId === undefined || !supportsNextRevisionPublication(this.repository)
					? await this.repository.publish(pending, expectedBaseRevisionId)
					: await this.publishNextRevision(pending, expectedBaseRevisionId);
			if (publication.kind === "stale-base") {
				const previous = this.pendingForwardPrevious;
				this.pending = undefined;
				this.pendingForwardPrevious = undefined;
				this.pendingForwardExpectedBaseRevisionId = undefined;
				if (previous) {
					this.setDurableState(previous);
					await this.reloadCurrentDurableRevision(previous);
				}
				return;
			}
			if (publication.kind === "persist-failed") {
				if (this.recordLostWriterLease(pending)) {
					return;
				}
				this.setState({
					...publication,
					project: this.current?.project,
					revisionId: this.current?.revision.revisionId,
				});
				return;
			}
			const previous = this.pendingForwardPrevious;
			const metric = this.pendingProductMetrics.get(pending);
			this.pendingProductMetrics.delete(pending);
			this.pending = undefined;
			this.pendingForwardPrevious = undefined;
			this.pendingForwardExpectedBaseRevisionId = undefined;
			if (previous) {
				this.completeForwardPublication(previous, pending, metric);
			} else {
				this.current = pending;
				this.setDurableState(pending);
				if (metric) this.emitProductMetric(metric);
			}
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
		} finally {
			this.publicationInFlight = false;
		}
	}

	public async recover(): Promise<void> {
		try {
			await this.repository.recover();
			await this.open();
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
		}
	}

	public async undo(): Promise<SessionHistoryResult> {
		return this.travelSessionHistory("undo");
	}

	public async redo(): Promise<SessionHistoryResult> {
		return this.travelSessionHistory("redo");
	}

	/**
	 * Deliberately forgets this tab's undo/redo roots after a history-only
	 * resource failure. It never publishes or rewrites the current Project;
	 * the manifest and writer fence are rechecked before the in-memory boundary
	 * is changed.
	 */
	public async discardSessionHistory(): Promise<DiscardSessionHistoryResult> {
		const current = this.current;
		if (!current || !this.historyResourceIssue || !this.writerLeases) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		this.publicationInFlight = true;
		try {
			const unresolvedResourceHashes =
				await this.unresolvedPinnedCustomGlbResourceHashes(current);
			if (unresolvedResourceHashes.length > 0) {
				return { kind: "current-resource-issue" };
			}
			const writerAccess = await this.inspectWriterAccess(current);
			this.writerLeaseAccess = writerAccess;
			if (writerAccess.kind !== "writable") {
				return { kind: "read-only" };
			}
			if (this.recordLostWriterLease()) {
				return { kind: "writer-lease-lost" };
			}
			if (
				this.current !== current ||
				this.historyResourceIssue === undefined ||
				this.historyResourceIssue.targetRevisionId ===
					current.revision.revisionId
			) {
				return { kind: "not-ready" };
			}
			this.clearSessionHistory();
			this.setDurableState(current);
			return { kind: "discarded" };
		} catch {
			// A discarded history must never be the fallback when current integrity
			// or its fence could not be re-proven.
			return { kind: "not-ready" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	private acceptStatus(status: CreateProjectStatus): void {
		if (status.kind === "saving") {
			this.setState({ kind: "saving" });
			return;
		}
		if (status.kind === "persist-failed") {
			if (this.recordLostWriterLease(status.candidate)) {
				return;
			}
			this.pending = status.candidate;
			this.pendingProductMetrics.set(status.candidate, "project_created");
			this.pendingForwardPrevious = undefined;
			this.pendingForwardExpectedBaseRevisionId = undefined;
			this.setState(status);
			return;
		}
		this.clearSessionHistory();
		this.current = status.candidate;
		this.setDurableState(status.candidate);
		this.emitProductMetric("project_created");
		this.pending = undefined;
		this.pendingForwardPrevious = undefined;
		this.pendingForwardExpectedBaseRevisionId = undefined;
	}

	private acceptImportedProjectStatus(
		status: ImportLocalProjectJsonStatus | ImportPortableBackupStatus,
		metric?: "backup_imported",
	): void {
		if (
			status.kind === "validating" ||
			status.kind === "staging-resources" ||
			status.kind === "checking-render"
		) {
			return;
		}
		if (status.kind === "saving") {
			const current = this.current;
			this.setState(
				current
					? {
							kind: "saving",
							project: current.project,
							revisionId: current.revision.revisionId,
						}
					: { kind: "saving" },
			);
			return;
		}
		if (status.kind === "persist-failed") {
			if (this.recordLostWriterLease(status.candidate)) {
				return;
			}
			this.pending = status.candidate;
			if (metric) this.pendingProductMetrics.set(status.candidate, metric);
			this.pendingForwardPrevious = undefined;
			this.pendingForwardExpectedBaseRevisionId = undefined;
			const current = this.current;
			this.setState(
				current
					? {
							...status,
							project: current.project,
							revisionId: current.revision.revisionId,
						}
					: status,
			);
			return;
		}
		this.clearSessionHistory();
		this.current = status.candidate;
		this.setDurableState(status.candidate);
		if (metric) this.emitProductMetric(metric);
		this.pending = undefined;
		this.pendingForwardPrevious = undefined;
		this.pendingForwardExpectedBaseRevisionId = undefined;
	}

	private acceptRoomStatus(
		status: ConfigureRectangularRoomStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous, "room_created");
	}

	private acceptRenameStatus(
		status: RenameProjectStatus,
		previous: PublicationCandidate,
	): void {
		if (status.kind === "saving") {
			this.setState({
				kind: "saving",
				project: previous.project,
				revisionId: previous.revision.revisionId,
			});
			return;
		}
		if (status.kind === "stale-base") {
			// Keep the last known durable projection. The form owns the local
			// explanation/retry affordance; no unpublished candidate enters history.
			this.setDurableState(previous);
			return;
		}
		if (status.kind === "persist-failed") {
			if (this.recordLostWriterLease(status.candidate)) {
				return;
			}
			this.pending = status.candidate;
			this.pendingForwardPrevious = previous;
			this.pendingForwardExpectedBaseRevisionId = previous.revision.revisionId;
			this.setState({
				...status,
				project: previous.project,
				revisionId: previous.revision.revisionId,
			});
			return;
		}
		this.completeForwardPublication(previous, status.candidate);
	}

	private acceptPartitionStatus(
		status: AddConstrainedPartitionStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous);
	}

	private acceptFloorItemStatus(
		status: CreateParametricFloorItemStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous, "item_placed");
	}

	private acceptMovedFloorItemStatus(
		status: MoveParametricFloorItemStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous);
	}

	private acceptExpandedGridStatus(
		status: ExpandOrthogonalGridStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous);
	}

	private acceptResizedFloorItemStatus(
		status: ResizeParametricFloorItemStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous);
	}

	private acceptDeletedFloorItemStatus(
		status: DeleteParametricFloorItemStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous);
	}

	private acceptDeletedWallStatus(
		status: DeleteConstrainedWallStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous);
	}

	private acceptRecoveryChangeSetStatus(
		status: RecoverUnresolvedCustomGlbReferencesStatus,
		previous: PublicationCandidate,
	): void {
		if (status.kind === "saving") {
			this.setState({
				kind: "saving",
				project: previous.project,
				revisionId: previous.revision.revisionId,
			});
			return;
		}
		if (
			status.kind === "persist-failed" &&
			this.recordLostWriterLease(status.candidate)
		) {
			return;
		}
		this.current = undefined;
		this.setState({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	}

	private acceptRoomLoopStatus(
		status: CreateRectangularRoomLoopStatus,
		previous: PublicationCandidate,
	): void {
		this.acceptMutationStatus(status, previous, "room_created");
	}

	private acceptMutationStatus(
		status: MutationPublicationStatus,
		previous: DurablePublicationCandidate,
		metric?: ProductMetric,
	): void {
		if (status.kind === "saving") {
			this.setState({
				kind: "saving",
				project: previous.project,
				revisionId: previous.revision.revisionId,
			});
			return;
		}
		if (status.kind === "stale-base") {
			this.setDurableState(previous);
			return;
		}
		if (status.kind === "persist-failed") {
			if (this.recordLostWriterLease(status.candidate)) {
				return;
			}
			this.pending = status.candidate;
			if (metric) this.pendingProductMetrics.set(status.candidate, metric);
			this.pendingForwardPrevious = previous;
			this.pendingForwardExpectedBaseRevisionId = previous.revision.revisionId;
			this.setState({
				...status,
				project: previous.project,
				revisionId: previous.revision.revisionId,
			});
			return;
		}
		this.completeForwardPublication(previous, status.candidate, metric);
	}

	/**
	 * A CAS rejection proves that the controller snapshot is no longer current.
	 * Reload the exact Project pointer before returning control to a destructive
	 * preview so Plan and 3D cannot keep presenting an obsolete Durable base.
	 */
	private async reloadCurrentDurableRevision(
		previous: DurablePublicationCandidate,
	): Promise<void> {
		const requestId = this.navigationRequestId;
		try {
			const loaded = this.projectDirectory
				? await this.projectDirectory.loadProject(previous.project.projectId)
				: await this.repository.loadCurrent();
			if (
				!this.isCurrentNavigationRequest(requestId) ||
				loaded.kind !== "durable" ||
				loaded.candidate.project.projectId !== previous.project.projectId
			) {
				return;
			}
			this.clearSessionHistory();
			await this.acceptOpenedCandidate(loaded.candidate, requestId);
		} catch {
			// The last known Durable Revision remains visible if a fresh read fails.
		}
	}

	private completeForwardPublication(
		previous: DurablePublicationCandidate,
		candidate: DurablePublicationCandidate,
		metric?: ProductMetric,
	): void {
		this.undoStack.push(previous);
		this.historyCommandLabels.set(
			previous.revision.revisionId,
			describeForwardHistoryCommand(previous, candidate),
		);
		this.redoStack.length = 0;
		this.current = candidate;
		this.pending = undefined;
		this.pendingForwardPrevious = undefined;
		this.pendingForwardExpectedBaseRevisionId = undefined;
		this.setDurableState(candidate);
		if (!metric) return;
		if (metric === "item_color_changed") {
			const oldColors = new Map(previous.project.assetInstances.map((item) => [item.assetInstanceId, item.color]));
			if (!candidate.project.assetInstances.some((item) => oldColors.get(item.assetInstanceId) !== item.color)) return;
		}
		if (metric !== "room_created") this.emitProductMetric(metric);
		if ((metric === "room_created" || metric === "wall_added") && isV1Candidate(previous) && isV1Candidate(candidate)) {
			const previousRoomIds = new Set(previous.project.level.rooms.map((room) => room.roomId));
			if (candidate.project.level.rooms.some((room) => !previousRoomIds.has(room.roomId))) this.emitProductMetric("room_created");
		}
	}

	private async travelSessionHistory(
		direction: "redo" | "undo",
	): Promise<SessionHistoryResult> {
		if (!this.current) {
			return { kind: "not-ready" };
		}
		if (this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		const target =
			direction === "undo" ? this.undoStack.at(-1) : this.redoStack.at(-1);
		if (!target) {
			return { kind: "empty-history" };
		}
		const source = this.current;
		const resourceMetrics = new Set<ResourceProductMetric>();
		const unresolvedResourceHashes =
			await this.unresolvedPinnedCustomGlbResourceHashes(target, resourceMetrics);
		if (this.current !== source || this.publicationInFlight) {
			return { kind: "in-progress" };
		}
		if (unresolvedResourceHashes.length > 0) {
			this.enterHistoryResourceRecovery(source, {
				direction,
				resourceHashes: unresolvedResourceHashes,
				targetRevisionId: target.revision.revisionId,
			});
			for (const metric of resourceMetrics) this.emitProductMetric(metric);
			return {
				kind: "history-resource-issue",
				resourceHashes: unresolvedResourceHashes,
			};
		}
		this.publicationInFlight = true;
		this.setState({
			kind: "saving",
			project: source.project,
			revisionId: source.revision.revisionId,
		});
		try {
			const publication = await this.publishNextRevision(
				target,
				source.revision.revisionId,
				"history",
			);
			if (publication.kind === "stale-base") {
				this.pendingHistoryTravel = { direction, source, target };
				this.setDurableState(source);
				return publication;
			}
			if (publication.kind === "persist-failed") {
				if (this.recordLostWriterLease(target)) {
					return {
						kind: "writer-lease-lost",
						reasonCode: "WRITER_LEASE_LOST",
					};
				}
				this.pendingHistoryTravel = { direction, source, target };
				this.setState({
					...publication,
					project: source.project,
					revisionId: source.revision.revisionId,
				});
				return publication;
			}
			this.completeHistoryTravel({ direction, source, target });
			return { kind: "durable", revisionId: target.revision.revisionId };
		} catch {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		} finally {
			this.publicationInFlight = false;
		}
	}

	private publishNextRevision(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId: string,
		intent?: "history",
	): Promise<NextRevisionPublicationResult> {
		return supportsNextRevisionPublication(this.repository)
			? this.repository.publishNextRevision(candidate, expectedBaseRevisionId, intent)
			: Promise.resolve({
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_WRITE_FAILED",
				});
	}

	private completeHistoryTravel(travel: PendingHistoryTravel): void {
		const sourceStack =
			travel.direction === "undo" ? this.undoStack : this.redoStack;
		const destinationStack =
			travel.direction === "undo" ? this.redoStack : this.undoStack;
		const target = sourceStack.pop();
		if (target?.revision.revisionId !== travel.target.revision.revisionId) {
			throw new Error(
				"Session history changed while publication was in flight",
			);
		}
		const commandLabel = this.historyCommandLabels.get(
			travel.target.revision.revisionId,
		);
		destinationStack.push(travel.source);
		if (commandLabel) {
			this.historyCommandLabels.set(
				travel.source.revision.revisionId,
				commandLabel,
			);
		}
		this.current = travel.target;
		this.historyResourceIssue = undefined;
		this.setDurableState(travel.target);
		this.emitProductMetric(travel.direction === "undo" ? "undo_committed" : "redo_committed");
	}

	private clearSessionHistory(): void {
		this.undoStack.length = 0;
		this.redoStack.length = 0;
		this.historyCommandLabels.clear();
		this.pending = undefined;
		this.pendingForwardPrevious = undefined;
		this.pendingForwardExpectedBaseRevisionId = undefined;
		this.pendingHistoryTravel = undefined;
		this.historyResourceIssue = undefined;
		this.writerLeaseRecoveryCopy = undefined;
	}

	private beginNavigationRequest(): number {
		this.navigationRequestId += 1;
		return this.navigationRequestId;
	}

	private isCurrentNavigationRequest(requestId: number): boolean {
		return requestId === this.navigationRequestId;
	}

	private async inspectWriterAccess(
		candidate: DurablePublicationCandidate,
	): Promise<WriterAccess> {
		return this.writerLeases
			? await this.writerLeases.inspectWriterAccess(candidate.project.projectId)
			: { kind: "not-ready" };
	}

	/**
	 * Use cases intentionally retain their persistence-failure vocabulary. The
	 * controller upgrades the fence-specific adapter signal into a stable public
	 * outcome, drops the unpublished candidate, and restores the last durable
	 * revision as the only current Project state.
	 */
	private withWriterLeaseOutcome<Result>(
		result: Result,
	): Result | WriterLeaseLostResult {
		if (!this.lostWriterLeaseResultPending && !this.recordLostWriterLease()) {
			return result;
		}
		this.lostWriterLeaseResultPending = false;
		return { kind: "writer-lease-lost", reasonCode: "WRITER_LEASE_LOST" };
	}

	private recordLostWriterLease(
		recoveryCopy?: DurablePublicationCandidate,
	): boolean {
		if (!this.writerLeases?.consumeLostWriterLease()) {
			return false;
		}
		this.lostWriterLeaseResultPending = true;
		this.writerLeaseRecoveryCopy =
			recoveryCopy ??
			this.pendingHistoryTravel?.target ??
			this.pending ??
			this.writerLeaseRecoveryCopy;
		this.pending = undefined;
		this.pendingForwardPrevious = undefined;
		this.pendingForwardExpectedBaseRevisionId = undefined;
		this.pendingHistoryTravel = undefined;
		this.writerLeaseAccess = {
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		};
		if (this.current) {
			this.setDurableState(this.current);
		} else if (this.recoveryCandidate) {
			this.setState({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
		} else {
			this.setState({ kind: "first-run" });
		}
		return true;
	}

	private setDurableState(candidate: DurablePublicationCandidate): void {
		this.setState({
			kind: "saved",
			project: candidate.project,
			projectName: candidate.project.name,
			revisionId: candidate.revision.revisionId,
		});
	}

	private setState(state: ProjectScreenState): void {
		this.state = state;
		this.listeners.forEach((listener) => {
			listener(this.state);
		});
	}
}
