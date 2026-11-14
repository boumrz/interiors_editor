import { AddConstrainedPartitionUseCase } from "../application/add-constrained-partition";
import { ConfigureRectangularRoomUseCase } from "../application/configure-rectangular-room";
import { CreateCustomGlbFloorItemUseCase } from "../application/create-custom-glb-floor-item";
import { CreateParametricFloorItemUseCase } from "../application/create-parametric-floor-item";
import { CreateParametricWallItemUseCase } from "../application/create-parametric-wall-item";
import {
	CreateProjectUseCase,
	canonicalProjectSerializer,
} from "../application/create-project";
import { DeleteConstrainedWallUseCase } from "../application/delete-constrained-wall";
import { DeleteParametricFloorItemUseCase } from "../application/delete-parametric-floor-item";
import { DeleteParametricWallItemUseCase } from "../application/delete-parametric-wall-item";
import {
	AddDoorOpeningToProjectUseCase,
	AddWindowOpeningToProjectUseCase,
	DeleteDoorOpeningFromProjectUseCase,
	MoveDoorOpeningInProjectUseCase,
	UpdateDoorOpeningInProjectUseCase,
} from "../application/door-opening-project";
import { ExpandOrthogonalGridUseCase } from "../application/expand-orthogonal-grid";
import { ExportLocalProjectJsonUseCase } from "../application/export-local-project-json";
import { ExportPortableBackupUseCase } from "../application/export-portable-backup";
import {
	AddGeneralWallToProjectUseCase,
	ChangeGeneralWallThicknessUseCase,
	DeleteGeneralVertexUseCase,
	DeleteGeneralWallFromProjectUseCase,
	MoveGeneralVertexUseCase,
	MoveGeneralWallUseCase,
	ReverseGeneralWallUseCase,
	SplitGeneralWallUseCase,
} from "../application/general-wall-project-mutations";
import { ImportLocalProjectJsonUseCase } from "../application/import-local-project-json";
import { ImportPortableBackupUseCase } from "../application/import-portable-backup";
import { MoveParametricFloorItemUseCase } from "../application/move-parametric-floor-item";
import { MoveParametricWallItemUseCase } from "../application/move-parametric-wall-item";
import { RecolorParametricFloorItemUseCase } from "../application/recolor-parametric-floor-item";
import { RecolorParametricWallItemUseCase } from "../application/recolor-parametric-wall-item";
import { RecoverUnresolvedCustomGlbReferencesUseCase } from "../application/recover-unresolved-custom-glb-references";
import { RegisterCustomGlbLibraryAssetUseCase } from "../application/register-custom-glb-library-asset";
import { RenameProjectUseCase } from "../application/rename-project";
import { ResizeParametricFloorItemUseCase } from "../application/resize-parametric-floor-item";
import { RestartProjectUseCase } from "../application/restart-project";
import { RotateParametricFloorItemUseCase } from "../application/rotate-parametric-floor-item";
import { SetParametricWallItemLockUseCase } from "../application/set-parametric-wall-item-lock";
import { SetParametricFloorItemLockUseCase } from "../application/set-parametric-floor-item-lock";
import { SessionRetentionProjectRepository } from "../application/session-retention-project-repository";
import { UpdateRoomPropertiesUseCase } from "../application/update-room-properties";
import type {
	BinaryChecksumPort,
	ChecksumPort,
	ClockPort,
	IdPort,
	CustomAssetLibraryPort,
	CustomAssetResourceStorePort,
	PinStagingLeasePort,
	PortableBackupEncoderPort,
	PortableBackupDecoderPort,
	PortableBackupSmokeCheckPort,
	PortableBackupArchiveWriterPort,
	PortableBackupImportAdmissionPort,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	ProjectDirectoryPort,
	ProjectDeletionPort,
	WriterLeaseControllerPort,
	StorageEstimatePort,
} from "../application/ports";
import {
	ProjectController,
	type ProjectTransferExporter,
	type RegisteredProjectTransferExporter,
} from "./project-controller";
import type { BackupFeasibilityPolicyPort } from "../application/backup-feasibility-policy";

export type SharedProjectRepository = ProjectRepositoryPort &
	ProjectRevisionPublicationPort &
	ProjectDirectoryPort &
	ProjectDeletionPort &
	WriterLeaseControllerPort;

export interface SharedProjectControllerDependencies {
	readonly repository: SharedProjectRepository;
	readonly resources: CustomAssetResourceStorePort;
	readonly library: CustomAssetLibraryPort;
	readonly pinStaging: PinStagingLeasePort;
	readonly checksum: ChecksumPort;
	readonly binaryChecksum: BinaryChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly storageEstimate: StorageEstimatePort;
	readonly portable: {
		readonly feasibility?: BackupFeasibilityPolicyPort;
		/** Explicit registered object formatter; the browser keeps its existing default. */
		readonly exporter?: ProjectTransferExporter;
		readonly encoder: PortableBackupEncoderPort;
		readonly decoder: PortableBackupDecoderPort;
		readonly smoke: PortableBackupSmokeCheckPort;
		readonly recoveryEncoder?: PortableBackupEncoderPort;
		readonly recoveryDecoder?: PortableBackupDecoderPort;
		/** Additional user-selected ingress; the default browser route and policy stay separate. */
		readonly registeredTransfer?: {
			readonly exporter?: RegisteredProjectTransferExporter;
			readonly decoder?: PortableBackupDecoderPort;
			readonly smoke: PortableBackupSmokeCheckPort;
			readonly admission?: PortableBackupImportAdmissionPort;
		};
		readonly recoveryWriter?: PortableBackupArchiveWriterPort;
	};
}

/** One controller owns its session roots; each host supplies its own local adapters. */
export function createSharedProjectController(
	dependencies: SharedProjectControllerDependencies,
) {
	const {
		repository,
		resources,
		library,
		pinStaging,
		checksum,
		binaryChecksum,
		clock,
		ids,
		storageEstimate,
		portable,
	} = dependencies;
	const publicationRepository = new SessionRetentionProjectRepository(
		repository,
		{
			snapshot: () => controller.sessionRetentionRoots(),
		},
		{ binaryChecksum, resources },
		portable.feasibility,
	);
	const mutationDependencies = {
		checksum,
		clock,
		ids,
		repository: publicationRepository,
		serializer: canonicalProjectSerializer,
	};
	const portableImportDependencies = {
		binaryChecksum,
		checksum,
		clock,
		ids,
		pinStaging,
		repository: publicationRepository,
		resources,
		serializer: canonicalProjectSerializer,
	};
	const controller = new ProjectController(
		new CreateProjectUseCase(mutationDependencies),
		publicationRepository,
		new ConfigureRectangularRoomUseCase(mutationDependencies),
		new AddConstrainedPartitionUseCase(mutationDependencies),
		new CreateParametricFloorItemUseCase(mutationDependencies),
		new MoveParametricFloorItemUseCase(mutationDependencies),
		new ExpandOrthogonalGridUseCase(mutationDependencies),
		new ResizeParametricFloorItemUseCase(mutationDependencies),
		new DeleteParametricFloorItemUseCase(mutationDependencies),
		new DeleteConstrainedWallUseCase(mutationDependencies),
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		false,
		{
			registeredPortableBackupImporter: portable.registeredTransfer?.decoder
				? new ImportPortableBackupUseCase({
						...portableImportDependencies,
						decoder: portable.registeredTransfer.decoder,
						smoke: portable.registeredTransfer.smoke,
						admission: portable.registeredTransfer.admission,
					})
				: undefined,
			registeredPortableBackupAdmission: portable.registeredTransfer?.admission,
			registeredPortableBackupExporter: portable.registeredTransfer?.exporter,
			recoveryPortableBackupWriter: portable.recoveryWriter,
			setParametricFloorItemLock: new SetParametricFloorItemLockUseCase(
				mutationDependencies,
			),
			setParametricWallItemLock: new SetParametricWallItemLockUseCase(
				mutationDependencies,
			),
			moveParametricWallItem: new MoveParametricWallItemUseCase(
				mutationDependencies,
			),
			deleteParametricWallItem: new DeleteParametricWallItemUseCase(
				mutationDependencies,
			),
			createParametricWallItem: new CreateParametricWallItemUseCase(
				mutationDependencies,
			),
			renameProject: new RenameProjectUseCase(mutationDependencies),
			updateRoomProperties: new UpdateRoomPropertiesUseCase(
				mutationDependencies,
			),
			addDoorOpening: new AddDoorOpeningToProjectUseCase(mutationDependencies),
			addWindowOpening: new AddWindowOpeningToProjectUseCase(
				mutationDependencies,
			),
			createCustomGlbFloorItem: new CreateCustomGlbFloorItemUseCase({
				...mutationDependencies,
				backupFeasibility: portable.feasibility,
				binaryChecksum,
				pinStaging,
				resources,
			}),
			addGeneralWall: new AddGeneralWallToProjectUseCase(mutationDependencies),
			changeGeneralWallThickness: new ChangeGeneralWallThicknessUseCase(
				mutationDependencies,
			),
			reverseGeneralWall: new ReverseGeneralWallUseCase(mutationDependencies),
			moveGeneralWall: new MoveGeneralWallUseCase(mutationDependencies),
			moveGeneralVertex: new MoveGeneralVertexUseCase(mutationDependencies),
			deleteGeneralVertex: new DeleteGeneralVertexUseCase(mutationDependencies),
			splitGeneralWall: new SplitGeneralWallUseCase(mutationDependencies),
			deleteDoorOpening: new DeleteDoorOpeningFromProjectUseCase(
				mutationDependencies,
			),
			moveDoorOpening: new MoveDoorOpeningInProjectUseCase(
				mutationDependencies,
			),
			updateDoorOpening: new UpdateDoorOpeningInProjectUseCase(
				mutationDependencies,
			),
			deleteGeneralWall: new DeleteGeneralWallFromProjectUseCase(
				mutationDependencies,
			),
			recolorFloorItem: new RecolorParametricFloorItemUseCase(
				mutationDependencies,
			),
			recolorWallItem: new RecolorParametricWallItemUseCase(
				mutationDependencies,
			),
			rotateFloorItem: new RotateParametricFloorItemUseCase(
				mutationDependencies,
			),
			restartProject: new RestartProjectUseCase(mutationDependencies),
			recoverUnresolvedCustomGlbReferences:
				new RecoverUnresolvedCustomGlbReferencesUseCase(mutationDependencies),
		},
		repository,
		repository,
		new ImportLocalProjectJsonUseCase(mutationDependencies),
		new ExportLocalProjectJsonUseCase({
			checksum,
			serializer: canonicalProjectSerializer,
		}),
		resources,
		binaryChecksum,
		library,
		new RegisterCustomGlbLibraryAssetUseCase({
			binaryChecksum,
			library,
		}),
		storageEstimate,
		portable.exporter ??
			new ExportPortableBackupUseCase({
				binaryChecksum,
				checksum,
				encoder: portable.encoder,
				resources,
				serializer: canonicalProjectSerializer,
			}),
		new ImportPortableBackupUseCase({
			...portableImportDependencies,
			decoder: portable.decoder,
			smoke: portable.smoke,
		}),
		portable.recoveryDecoder ?? portable.decoder,
		portable.recoveryEncoder ?? portable.encoder,
	);
	return { controller, publicationRepository };
}
