import { describe, expect, it } from "@rstest/core";
import {
	DurableProjectRepository,
	MemoryVersionedProjectStore,
} from "../adapters/persistence/durable-project-repository";
import { FencedProjectRepository } from "../adapters/persistence/fenced-project-repository";
import { AddConstrainedPartitionUseCase } from "../application/add-constrained-partition";
import { AddWallToProjectV2UseCase } from "../application/add-wall-to-project-v2";
import { ConfigureRectangularRoomUseCase } from "../application/configure-rectangular-room";
import { CreateParametricFloorItemUseCase } from "../application/create-parametric-floor-item";
import { CreateParametricFloorItemV2UseCase } from "../application/create-parametric-floor-item-v2";
import {
	CreateProjectUseCase,
	canonicalProjectSerializer,
} from "../application/create-project";
import { CreateRectangularRoomLoopUseCase } from "../application/create-rectangular-room-loop";
import { DeleteConstrainedWallUseCase } from "../application/delete-constrained-wall";
import { DeleteParametricFloorItemUseCase } from "../application/delete-parametric-floor-item";
import { DeleteParametricFloorItemV2UseCase } from "../application/delete-parametric-floor-item-v2";
import { DeleteWallFromProjectV2UseCase } from "../application/delete-wall-from-project-v2";
import { ExpandOrthogonalGridUseCase } from "../application/expand-orthogonal-grid";
import type { ExportLocalProjectJsonUseCase } from "../application/export-local-project-json";
import type { ExportPortableBackupUseCase } from "../application/export-portable-backup";
import {
	AddGeneralWallToProjectUseCase,
	ChangeGeneralWallThicknessUseCase,
	type GeneralWallProjectMutationStatus,
} from "../application/general-wall-project-mutations";
import type { ImportLocalProjectJsonUseCase } from "../application/import-local-project-json";
import type { ImportPortableBackupUseCase } from "../application/import-portable-backup";
import { MigrateProjectV1ToV2UseCase } from "../application/migrate-project-v1-to-v2";
import { MoveParametricFloorItemV2UseCase } from "../application/move-parametric-floor-item-v2";
import type {
	BinaryChecksumPort,
	ChecksumPort,
	ClockPort,
	CustomAssetResourceStorePort,
	DurablePublicationCandidate,
	IdPort,
	ProjectDeletionPort,
	ProjectDirectoryPort,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	PublicationCandidate,
	StorageEstimatePort,
	V2PublicationCandidate,
	WriterLeaseControllerPort,
} from "../application/ports";
import { RecolorParametricFloorItemUseCase } from "../application/recolor-parametric-floor-item";
import { RecoverUnresolvedCustomGlbReferencesUseCase } from "../application/recover-unresolved-custom-glb-references";
import { RenameProjectUseCase } from "../application/rename-project";
import { ResizeParametricFloorItemUseCase } from "../application/resize-parametric-floor-item";
import { ResizeParametricFloorItemV2UseCase } from "../application/resize-parametric-floor-item-v2";
import { UpdateRoomPropertiesUseCase } from "../application/update-room-properties";
import { addGeneralWallToProject } from "../domain/general-wall-project";
import { createInitialProject } from "../domain/initial-project";
import { migrateProjectV1ToV2 } from "../domain/migrate-project-v1-to-v2";
import type { Project } from "../domain/project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import {
	type CanonicalPlanGraphMutationUseCases,
	ProjectController,
	type ProjectScreenState,
} from "./project-controller";

const clock: ClockPort = { now: () => "2026-08-05T14:15:16.000Z" };

function ids(): IdPort {
	let index = 0;
	return {
		next: () =>
			["level-1", "project-1", "revision-1"][index++] ?? `extra-${index}`,
	};
}

function createController(
	repository: ProjectRepositoryPort,
	checksum: ChecksumPort = { sha256: async () => "sum:valid" },
	directory?: ProjectDirectoryPort,
	renameProject?: RenameProjectUseCase,
	importLocalProjectJson?: ImportLocalProjectJsonUseCase,
	exportLocalProjectJson?: ExportLocalProjectJsonUseCase,
	customAssetResources?: CustomAssetResourceStorePort,
	binaryChecksum?: BinaryChecksumPort,
	recoverUnresolvedCustomGlbReferences?: RecoverUnresolvedCustomGlbReferencesUseCase,
	writerLeases?: WriterLeaseControllerPort,
	storageEstimates?: StorageEstimatePort,
	exportPortableBackup?: ExportPortableBackupUseCase,
	importPortableBackup?: ImportPortableBackupUseCase,
	probePinnedResourceByteLength?: (hash: string) => Promise<number | undefined>,
): ProjectController {
	return new ProjectController(
		new CreateProjectUseCase({
			checksum,
			clock,
			ids: ids(),
			repository,
			serializer: canonicalProjectSerializer,
		}),
		repository,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		false,
		{ renameProject, recoverUnresolvedCustomGlbReferences },
		writerLeases,
		directory,
		importLocalProjectJson,
		exportLocalProjectJson,
		customAssetResources,
		binaryChecksum,
		undefined,
		undefined,
		storageEstimates,
		exportPortableBackup,
		importPortableBackup,
		undefined,
		undefined,
		probePinnedResourceByteLength,
	);
}

function createCanonicalMutationController(
	repository: ProjectRepositoryPort,
	canonicalPlanGraphMutations: CanonicalPlanGraphMutationUseCases,
): ProjectController {
	return new ProjectController(
		new CreateProjectUseCase({
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: ids(),
			repository,
			serializer: canonicalProjectSerializer,
		}),
		repository,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		false,
		canonicalPlanGraphMutations,
	);
}

const binaryChecksumForTest: BinaryChecksumPort = {
	sha256Bytes: async (bytes) => {
		if (bytes.byteLength !== 64) return "0".repeat(64);
		if (bytes.every((byte) => byte === 0x61)) return "a".repeat(64);
		if (bytes.every((byte) => byte === 0x62)) return "b".repeat(64);
		return "c".repeat(64);
	},
};

function directoryCandidate(
	projectId: string,
	name: string,
	revisionId: string,
): PublicationCandidate {
	const project = createInitialProject({
		createdAt: "2026-08-15T14:00:00.000Z",
		levelId: `level-${projectId}`,
		name,
		projectId,
	});
	return {
		project,
		revision: {
			checksum: `sum:${revisionId}`,
			createdAt: project.updatedAt,
			projectId,
			revisionId,
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(project),
		},
	};
}

function directDeletionDirectory(
	candidate: PublicationCandidate,
	permanentlyDeleteProject: ProjectDeletionPort["permanentlyDeleteProject"],
): ProjectDirectoryPort & ProjectDeletionPort {
	const summary = {
		name: candidate.project.name,
		projectId: candidate.project.projectId,
		revisionId: candidate.revision.revisionId,
		updatedAt: candidate.project.updatedAt,
	};
	return {
		listProjects: async () => ({ kind: "populated", projects: [summary] }),
		loadProject: async () => ({ kind: "durable", candidate }),
		permanentlyDeleteProject,
	};
}

function deferredDirectoryResult<Result>() {
	let release: ((result: Result) => void) | undefined;
	const promise = new Promise<Result>((resolve) => {
		release = resolve;
	});
	return { promise, resolve: (result: Result) => release?.(result) };
}

function customResourceCandidate(
	projectId: string,
	name: string,
	revisionId: string,
): PublicationCandidate {
	const candidate = directoryCandidate(projectId, name, revisionId);
	return {
		...candidate,
		project: {
			...candidate.project,
			assetDefinitionRefs: [
				{
					assetDefinitionId: "custom-armchair",
					byteLength: 64,
					depthMm: 900,
					displayName: "Кресло",
					format: "glb" as const,
					heightMm: 900,
					resourceHash: "a".repeat(64),
					widthMm: 1000,
				},
			],
		},
	};
}

function legacyV2Candidate(): V2PublicationCandidate {
	const idValues = [
		"v-1",
		"v-2",
		"v-3",
		"v-4",
		"wall-1",
		"wall-2",
		"wall-3",
		"wall-4",
		"room-1",
	];
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-06T13:00:00.000Z",
			levelId: "level-1",
			name: "Legacy V2",
			projectId: "project-v2",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		{ next: () => idValues.shift() ?? "unexpected" },
		"2026-08-06T13:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected a V1 legacy fixture");
	}
	const migrated = migrateProjectV1ToV2(configured.project);
	if (migrated.kind !== "accepted") {
		throw new Error("Expected a V2 legacy fixture");
	}
	return {
		project: migrated.project,
		revision: {
			checksum: "sum:legacy-v2",
			createdAt: migrated.project.updatedAt,
			projectId: migrated.project.projectId,
			revisionId: "revision-v2",
			schemaVersion: 2,
			serializedProject: canonicalProjectSerializer.serialize(migrated.project),
		},
	};
}

describe("ProjectController", () => {
	it("retries a failed creation through explicit create even when the repository also supports CAS", async () => {
		let creates = 0;
		let changes = 0;
		const bases: Array<string | undefined> = [];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }), recover: async () => ({ kind: "recovered" }),
			publish: async (_candidate, base) => { bases.push(base); creates += 1; return creates === 1 ? { kind: "persist-failed", reasonCode: "PERSISTENCE_QUOTA_EXCEEDED" } : { kind: "durable" }; },
			publishNextRevision: async () => { changes += 1; return { kind: "stale-base" }; },
		};
		const controller = createController(repository);
		const metrics: string[] = [];
		const unsubscribeMetrics = controller.subscribeProductMetrics((metric) => metrics.push(metric));
		await controller.open();
		expect(metrics).toEqual([]);
		await controller.create("Новый план");
		expect(controller.snapshot().kind).toBe("persist-failed");
		expect(metrics).toEqual([]);
		await controller.retry();
		expect(controller.snapshot().kind).toBe("saved");
		await controller.retry();
		expect(metrics).toEqual(["project_created"]);
		unsubscribeMetrics();
		expect(creates).toBe(2);
		expect(changes).toBe(0);
		expect(bases).toEqual([undefined, undefined]);
	});
	it("keeps the failed first-room command bound to its original base on retry", async () => {
		const source = directoryCandidate("project-base", "Первый план", "opened-base");
		const bases: Array<string | undefined> = [];
		const retryBases: string[] = [];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: source }),
			recover: async () => ({ kind: "recovered" }),
			publish: async (_candidate, base) => { bases.push(base); return { kind: "persist-failed", reasonCode: "PERSISTENCE_QUOTA_EXCEEDED" }; },
			publishNextRevision: async (_candidate, base) => { retryBases.push(base); return { kind: "durable" }; },
		};
		const dependencies = { checksum: { sha256: async () => "sum:valid" }, clock, ids: ids(), serializer: canonicalProjectSerializer, repository };
		const controller = new ProjectController(new CreateProjectUseCase(dependencies), repository, new ConfigureRectangularRoomUseCase(dependencies));
		const metrics: string[] = [];
		controller.subscribeProductMetrics((metric) => metrics.push(metric));
		await controller.open();
		expect(await controller.configureRectangularRoom({ widthMm: "4000", depthMm: "3000", heightMm: "2600" })).toEqual({ kind: "persist-failed", reasonCode: "PERSISTENCE_QUOTA_EXCEEDED" });
		expect(bases).toEqual(["opened-base"]);
		expect(controller.snapshot().kind).toBe("persist-failed");
		expect(metrics).toEqual([]);
		await controller.retry();
		expect(retryBases).toEqual(["opened-base"]);
		expect(bases).toEqual(["opened-base"]);
		expect(controller.snapshot().kind).toBe("saved");
		expect(metrics).toEqual(["room_created"]);
	});

	it("reports advisory local-storage pressure without inventing a capacity after an estimate failure", async () => {
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				estimateStorage: async () => ({ quotaBytes: 1_000, usageBytes: 900 }),
			},
		);

		expect(await controller.storagePressure()).toEqual({
			kind: "critical",
			quotaBytes: 1_000,
			usageBytes: 900,
		});

		const unavailableController = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				estimateStorage: async () => {
					throw new Error("Storage estimate unavailable");
				},
			},
		);

		expect(await unavailableController.storagePressure()).toEqual({
			kind: "unavailable",
		});
	});

	it("requests persistent browser storage only after explicit user intent and keeps a refusal visible", async () => {
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		let requests = 0;
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				estimateStorage: async () => ({ quotaBytes: 1_000, usageBytes: 900 }),
				requestPersistentStorage: async () => {
					requests += 1;
					return false;
				},
			} as StorageEstimatePort & {
				readonly requestPersistentStorage: () => Promise<boolean>;
			},
		);

		expect(await controller.requestPersistentStorage()).toEqual({
			kind: "not-granted",
		});
		expect(requests).toBe(1);

		const grantedController = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				estimateStorage: async () => ({ quotaBytes: 1_000, usageBytes: 900 }),
				requestPersistentStorage: async () => true,
			} as StorageEstimatePort & {
				readonly requestPersistentStorage: () => Promise<boolean>;
			},
		);
		expect(await grantedController.requestPersistentStorage()).toEqual({
			kind: "granted",
		});

		const unavailableController = createController(repository);
		expect(await unavailableController.requestPersistentStorage()).toEqual({
			kind: "unavailable",
		});
	});

	it("opens a project with a missing pinned custom GLB only as recovery-needed, including the directory route", async () => {
		const candidate = customResourceCandidate(
			"project-with-resource",
			"Кресло в комнате",
			"revision-resource",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [
					{
						name: candidate.project.name,
						projectId: candidate.project.projectId,
						revisionId: candidate.revision.revisionId,
						updatedAt: candidate.project.updatedAt,
					},
				],
			}),
			loadProject: async () => ({ kind: "durable", candidate }),
		};
		const resources: CustomAssetResourceStorePort = {
			delete: async () => undefined,
			read: async () => undefined,
			writeIfAbsent: async () => ({ kind: "stored" }),
		};

		const directController = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			resources,
		);
		await directController.open();
		expect(directController.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(directController.sessionRetentionRoots()).toEqual({
			current: candidate,
			redo: [],
			undo: [],
		});
		expect(directController.writerAccess()).toEqual({ kind: "not-ready" });

		const directoryController = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			resources,
		);
		await directoryController.openProject(candidate.project.projectId);
		expect(directoryController.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(directoryController.writerAccess()).toEqual({ kind: "not-ready" });

		const firstResource = candidate.project.assetDefinitionRefs[0];
		if (!firstResource) {
			throw new Error(
				"Expected the custom-resource fixture to include its first asset.",
			);
		}
		const secondResourceHash = "b".repeat(64);
		const partlyMissingCandidate: PublicationCandidate = {
			...candidate,
			project: {
				...candidate.project,
				assetDefinitionRefs: [
					...candidate.project.assetDefinitionRefs,
					{
						...firstResource,
						assetDefinitionId: "custom-table",
						resourceHash: secondResourceHash,
					},
				],
			},
		};
		const controllerWithOneOfTwoResources = createController(
			{
				loadCurrent: async () => ({
					kind: "durable",
					candidate: partlyMissingCandidate,
				}),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async (resourceHash) =>
					resourceHash === firstResource.resourceHash
						? new Uint8Array(64).fill(0x61)
						: undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest,
		);
		await controllerWithOneOfTwoResources.open();
		expect(controllerWithOneOfTwoResources.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});

		const controllerWithoutAResourceStore = createController(repository);
		await controllerWithoutAResourceStore.open();
		expect(controllerWithoutAResourceStore.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});

		const loadedHashes: string[] = [];
		const fullyAvailableController = createController(
			{
				loadCurrent: async () => ({
					kind: "durable",
					candidate: partlyMissingCandidate,
				}),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async (resourceHash) => {
					loadedHashes.push(resourceHash);
					return new Uint8Array(64).fill(
						resourceHash === firstResource.resourceHash ? 0x61 : 0x62,
					);
				},
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest,
		);
		await fullyAvailableController.open();
		expect(fullyAvailableController.snapshot()).toMatchObject({
			kind: "saved",
			projectName: partlyMissingCandidate.project.name,
			revisionId: partlyMissingCandidate.revision.revisionId,
		});
		expect(loadedHashes.sort()).toEqual(
			[firstResource.resourceHash, secondResourceHash].sort(),
		);
	});

	it("treats present custom-resource bytes with the wrong content as recovery-needed", async () => {
		const candidate = customResourceCandidate(
			"project-with-corrupt-resource",
			"Повреждённое кресло",
			"revision-corrupt-resource",
		);
		const controller = createController(
			{
				loadCurrent: async () => ({ kind: "durable", candidate }),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => new Uint8Array(64).fill(0x7f),
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest,
		);

		const metrics: string[] = [];
		controller.subscribeProductMetrics((metric) => metrics.push(metric));
		await controller.open();

		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(controller.writerAccess()).toEqual({ kind: "not-ready" });
		expect(metrics).toEqual(["resource_corrupt"]);
	});

	it("shows integrity recovery before optional resource classification and drops detached observers", async () => {
		const candidate = customResourceCandidate("plan", "План", "revision");
		let completeRead: ((bytes: Uint8Array | undefined) => void) | undefined;
		let deferRead = false;
		const controller = createController(
			{
				loadCurrent: async () => ({ kind: "durable", candidate }),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined, undefined, undefined, undefined, undefined,
			{
				delete: async () => undefined,
				read: async () => deferRead
					? new Promise((resolve) => { completeRead = resolve; })
					: new Uint8Array(64).fill(0x61),
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest, undefined, undefined, undefined, undefined, undefined,
			async () => undefined,
		);
		await controller.open();
		deferRead = true;
		const report: string[] = [];
		const unsubscribe = controller.subscribeProductMetrics((metric) => report.push(metric));
		await expect(controller.refreshSessionHistoryIntegrity()).resolves.toEqual({ kind: "current-resource-issue" });
		expect(controller.snapshot()).toMatchObject({ kind: "recovery-needed" });
		expect(completeRead).toBeDefined();
		expect(report).toEqual([]);

		unsubscribe();
		const newReport: string[] = [];
		controller.subscribeProductMetrics((metric) => newReport.push(metric));
		completeRead?.(new Uint8Array(64).fill(0x7f));
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		expect(report).toEqual([]);
		expect(newReport).toEqual([]);
	});

	it("keeps the legacy one-file repair path from partially writing a multi-resource recovery set", async () => {
		const candidate = customResourceCandidate(
			"project-for-exact-repair",
			"Кресло для восстановления",
			"revision-for-exact-repair",
		);
		const firstResource = candidate.project.assetDefinitionRefs[0];
		if (!firstResource) {
			throw new Error(
				"Expected the custom-resource fixture to include its first asset.",
			);
		}
		const secondResourceHash = "b".repeat(64);
		const candidateWithTwoResources: PublicationCandidate = {
			...candidate,
			project: {
				...candidate.project,
				assetDefinitionRefs: [
					...candidate.project.assetDefinitionRefs,
					{
						...firstResource,
						assetDefinitionId: "custom-table",
						displayName: "Стол",
						resourceHash: secondResourceHash,
					},
				],
			},
		};
		const storedResources = new Map<string, Uint8Array>([
			[firstResource.resourceHash, new Uint8Array(64).fill(0x7f)],
		]);
		const replacements: string[][] = [];
		const resources = {
			delete: async () => undefined,
			read: async (resourceHash: string) => storedResources.get(resourceHash),
			writeIfAbsent: async () => ({ kind: "stored" as const }),
			writeReplacing: async () => {
				throw new Error(
					"Multi-resource recovery must not fall back to one-file writes.",
				);
			},
			writeReplacingBatch: async (
				batch: readonly {
					readonly bytes: Uint8Array;
					readonly resourceHash: string;
				}[],
			) => {
				replacements.push(batch.map((resource) => resource.resourceHash));
				for (const resource of batch) {
					storedResources.set(resource.resourceHash, resource.bytes.slice());
				}
			},
		};
		const controller = createController(
			{
				loadCurrent: async () => ({
					kind: "durable",
					candidate: candidateWithTwoResources,
				}),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			resources,
			binaryChecksumForTest,
		);

		await controller.open();
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});

		await expect(
			controller.repairCustomGlbResource(new Uint8Array(64).fill(0x63)),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		expect(replacements).toEqual([]);

		await expect(
			controller.repairCustomGlbResource(new Uint8Array(64).fill(0x61)),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(replacements).toEqual([]);

		await expect(
			controller.repairCustomGlbResources([
				new Uint8Array(64).fill(0x61),
				new Uint8Array(64).fill(0x62),
			]),
		).resolves.toEqual({
			kind: "recovered",
			resourceHashes: [firstResource.resourceHash, secondResourceHash],
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: candidateWithTwoResources.revision.revisionId,
		});
		expect(replacements).toEqual([
			[firstResource.resourceHash, secondResourceHash],
		]);
	});

	it("atomically recovers every pinned custom GLB only when the selected batch is complete and exact", async () => {
		const candidate = customResourceCandidate(
			"project-for-batch-recovery",
			"Набор для восстановления",
			"revision-for-batch-recovery",
		);
		const firstResource = candidate.project.assetDefinitionRefs[0];
		if (!firstResource) {
			throw new Error(
				"Expected the custom-resource fixture to include its first asset.",
			);
		}
		const secondResourceHash = "b".repeat(64);
		const candidateWithTwoResources: PublicationCandidate = {
			...candidate,
			project: {
				...candidate.project,
				assetDefinitionRefs: [
					...candidate.project.assetDefinitionRefs,
					{
						...firstResource,
						assetDefinitionId: "custom-table",
						displayName: "Стол",
						resourceHash: secondResourceHash,
					},
				],
			},
		};
		const storedResources = new Map<string, Uint8Array>([
			[firstResource.resourceHash, new Uint8Array(64).fill(0x7f)],
		]);
		const batches: {
			readonly bytes: Uint8Array;
			readonly resourceHash: string;
		}[][] = [];
		let receivedBatch:
			| readonly { readonly bytes: Uint8Array; readonly resourceHash: string }[]
			| undefined;
		const resources = {
			delete: async () => undefined,
			read: async (resourceHash: string) => storedResources.get(resourceHash),
			writeIfAbsent: async () => ({ kind: "stored" as const }),
			writeReplacing: async () => {
				throw new Error(
					"Batch recovery must not fall back to one-file writes.",
				);
			},
			writeReplacingBatch: async (
				batch: readonly {
					readonly bytes: Uint8Array;
					readonly resourceHash: string;
				}[],
			) => {
				receivedBatch = batch;
				batches.push(
					batch.map((resource) => ({
						bytes: resource.bytes.slice(),
						resourceHash: resource.resourceHash,
					})),
				);
				for (const resource of batch) {
					storedResources.set(resource.resourceHash, resource.bytes.slice());
				}
			},
		};
		const controller = createController(
			{
				loadCurrent: async () => ({
					kind: "durable",
					candidate: candidateWithTwoResources,
				}),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			resources,
			binaryChecksumForTest,
		);

		await controller.open();
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: false,
		});

		await expect(
			controller.repairCustomGlbResources([new Uint8Array(64).fill(0x61)]),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		await expect(
			controller.repairCustomGlbResources([
				new Uint8Array(64).fill(0x61),
				new Uint8Array(64).fill(0x61),
			]),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		await expect(
			controller.repairCustomGlbResources([
				new Uint8Array(64).fill(0x61),
				new Uint8Array(64).fill(0x62),
				new Uint8Array(64).fill(0x61),
			]),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		await expect(
			controller.repairCustomGlbResources([
				new Uint8Array(64).fill(0x61),
				new Uint8Array(64).fill(0x63),
			]),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		expect(batches).toEqual([]);
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});

		const firstBytes = new Uint8Array(64).fill(0x61);
		const secondBytes = new Uint8Array(64).fill(0x62);
		await expect(
			controller.repairCustomGlbResources([secondBytes, firstBytes]),
		).resolves.toEqual({
			kind: "recovered",
			resourceHashes: [firstResource.resourceHash, secondResourceHash],
		});
		expect(batches).toEqual([
			[
				{
					bytes: new Uint8Array(64).fill(0x61),
					resourceHash: firstResource.resourceHash,
				},
				{
					bytes: new Uint8Array(64).fill(0x62),
					resourceHash: secondResourceHash,
				},
			],
		]);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: candidateWithTwoResources.revision.revisionId,
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: false,
		});

		firstBytes.fill(0x63);
		secondBytes.fill(0x63);
		expect(receivedBatch).toEqual([
			{
				bytes: new Uint8Array(64).fill(0x61),
				resourceHash: firstResource.resourceHash,
			},
			{
				bytes: new Uint8Array(64).fill(0x62),
				resourceHash: secondResourceHash,
			},
		]);
		expect(storedResources.get(firstResource.resourceHash)).toEqual(
			new Uint8Array(64).fill(0x61),
		);
		expect(storedResources.get(secondResourceHash)).toEqual(
			new Uint8Array(64).fill(0x62),
		);
	});

	it("keeps the project in recovery-needed when atomic custom-resource storage fails", async () => {
		const candidate = customResourceCandidate(
			"project-for-batch-write-failure",
			"Набор с ошибкой записи",
			"revision-for-batch-write-failure",
		);
		const firstResource = candidate.project.assetDefinitionRefs[0];
		if (!firstResource) {
			throw new Error(
				"Expected the custom-resource fixture to include its first asset.",
			);
		}
		const candidateWithTwoResources: PublicationCandidate = {
			...candidate,
			project: {
				...candidate.project,
				assetDefinitionRefs: [
					...candidate.project.assetDefinitionRefs,
					{
						...firstResource,
						assetDefinitionId: "custom-table",
						displayName: "Стол",
						resourceHash: "b".repeat(64),
					},
				],
			},
		};
		let batchWriteCalls = 0;
		const controller = createController(
			{
				loadCurrent: async () => ({
					kind: "durable",
					candidate: candidateWithTwoResources,
				}),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" as const }),
				writeReplacingBatch: async () => {
					batchWriteCalls += 1;
					throw new Error("IndexedDB batch write failed");
				},
			},
			binaryChecksumForTest,
		);

		await controller.open();
		await expect(
			controller.repairCustomGlbResources([
				new Uint8Array(64).fill(0x61),
				new Uint8Array(64).fill(0x62),
			]),
		).resolves.toEqual({ kind: "persist-failed" });
		expect(batchWriteCalls).toBe(1);
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(controller.writerAccess()).toEqual({ kind: "not-ready" });
	});

	it("asks the batch only for unresolved resources and preserves already healthy local bytes", async () => {
		const candidate = customResourceCandidate(
			"project-for-unresolved-recovery",
			"Частичное восстановление",
			"revision-for-unresolved-recovery",
		);
		const firstResource = candidate.project.assetDefinitionRefs[0];
		if (!firstResource) {
			throw new Error(
				"Expected the custom-resource fixture to include its first asset.",
			);
		}
		const secondResourceHash = "b".repeat(64);
		const candidateWithTwoResources: PublicationCandidate = {
			...candidate,
			project: {
				...candidate.project,
				assetDefinitionRefs: [
					...candidate.project.assetDefinitionRefs,
					{
						...firstResource,
						assetDefinitionId: "custom-table",
						displayName: "Стол",
						resourceHash: secondResourceHash,
					},
				],
			},
		};
		const storedResources = new Map<string, Uint8Array>([
			[firstResource.resourceHash, new Uint8Array(64).fill(0x61)],
		]);
		const batches: string[][] = [];
		const controller = createController(
			{
				loadCurrent: async () => ({
					kind: "durable",
					candidate: candidateWithTwoResources,
				}),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async (resourceHash) => storedResources.get(resourceHash),
				writeIfAbsent: async () => ({ kind: "stored" as const }),
				writeReplacingBatch: async (batch) => {
					batches.push(batch.map((resource) => resource.resourceHash));
					for (const resource of batch) {
						storedResources.set(resource.resourceHash, resource.bytes.slice());
					}
				},
			},
			binaryChecksumForTest,
		);

		await controller.open();
		await expect(
			controller.repairCustomGlbResources([
				new Uint8Array(64).fill(0x61),
				new Uint8Array(64).fill(0x62),
			]),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		await expect(
			controller.repairCustomGlbResources([new Uint8Array(64).fill(0x62)]),
		).resolves.toEqual({
			kind: "recovered",
			resourceHashes: [secondResourceHash],
		});
		expect(batches).toEqual([[secondResourceHash]]);
		expect(storedResources.get(firstResource.resourceHash)).toEqual(
			new Uint8Array(64).fill(0x61),
		);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: candidateWithTwoResources.revision.revisionId,
		});
	});

	it("reopens the repaired directory card instead of returning to a multi-project picker", async () => {
		const candidate = customResourceCandidate(
			"project-for-directory-recovery",
			"Проект для восстановления",
			"revision-for-directory-recovery",
		);
		const otherCandidate = directoryCandidate(
			"other-project",
			"Другой проект",
			"other-revision",
		);
		const openedProjectIds: string[] = [];
		const storedResources = new Map<string, Uint8Array>();
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [candidate, otherCandidate].map((entry) => ({
					name: entry.project.name,
					projectId: entry.project.projectId,
					revisionId: entry.revision.revisionId,
					updatedAt: entry.project.updatedAt,
				})),
			}),
			loadProject: async (projectId) => {
				openedProjectIds.push(projectId);
				return {
					kind: "durable" as const,
					candidate:
						projectId === candidate.project.projectId
							? candidate
							: otherCandidate,
				};
			},
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async (resourceHash) => storedResources.get(resourceHash),
				writeIfAbsent: async () => ({ kind: "stored" as const }),
				writeReplacingBatch: async (batch) => {
					for (const resource of batch) {
						storedResources.set(resource.resourceHash, resource.bytes.slice());
					}
				},
			},
			binaryChecksumForTest,
		);

		await controller.openProject(candidate.project.projectId);
		await expect(
			controller.repairCustomGlbResources([new Uint8Array(64).fill(0x61)]),
		).resolves.toEqual({
			kind: "recovered",
			resourceHashes: [candidate.project.assetDefinitionRefs[0]?.resourceHash],
		});
		expect(openedProjectIds).toEqual([
			candidate.project.projectId,
			candidate.project.projectId,
		]);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: candidate.project.name,
			revisionId: candidate.revision.revisionId,
		});
	});

	it("requires an equipped verifier and batch store, and exposes an incomplete batch write as repaired", async () => {
		const candidate = customResourceCandidate(
			"project-for-batch-ready-state",
			"Набор для проверки",
			"revision-for-batch-ready-state",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const noBatchStore = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" as const }),
				writeReplacing: async () => undefined,
			},
			binaryChecksumForTest,
		);
		await noBatchStore.open();
		await expect(
			noBatchStore.repairCustomGlbResources([new Uint8Array(64).fill(0x61)]),
		).resolves.toEqual({ kind: "not-ready" });

		const checksumFailure = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" as const }),
				writeReplacingBatch: async () => undefined,
			},
			{
				sha256Bytes: async () =>
					Promise.reject(new Error("SHA-256 unavailable")),
			},
		);
		await checksumFailure.open();
		await expect(
			checksumFailure.repairCustomGlbResources([new Uint8Array(64).fill(0x61)]),
		).resolves.toEqual({ kind: "not-ready" });

		let batchWriteCalls = 0;
		const incompleteWrite = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" as const }),
				writeReplacingBatch: async () => {
					batchWriteCalls += 1;
				},
			},
			binaryChecksumForTest,
		);
		await incompleteWrite.open();
		await expect(
			incompleteWrite.repairCustomGlbResources([new Uint8Array(64).fill(0x61)]),
		).resolves.toEqual({
			kind: "repaired",
			resourceHashes: [candidate.project.assetDefinitionRefs[0]?.resourceHash],
		});
		expect(batchWriteCalls).toBe(1);
		expect(incompleteWrite.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("refuses custom-resource repair outside an equipped recovery state", async () => {
		const cleanController = createController({
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		});
		await expect(
			cleanController.repairCustomGlbResource(new Uint8Array(64).fill(0x61)),
		).resolves.toEqual({ kind: "not-ready" });

		const candidate = customResourceCandidate(
			"project-without-repair-port",
			"Кресло без repair port",
			"revision-without-repair-port",
		);
		const withoutRepairPort = createController(
			{
				loadCurrent: async () => ({ kind: "durable", candidate }),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest,
		);
		await withoutRepairPort.open();
		await expect(
			withoutRepairPort.repairCustomGlbResource(new Uint8Array(64).fill(0x61)),
		).resolves.toEqual({ kind: "not-ready" });

		const withoutChecksum = createController(
			{
				loadCurrent: async () => ({ kind: "durable", candidate }),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
				writeReplacing: async () => undefined,
			},
		);
		await withoutChecksum.open();
		await expect(
			withoutChecksum.repairCustomGlbResource(new Uint8Array(64).fill(0x61)),
		).resolves.toEqual({ kind: "not-ready" });
	});

	it("keeps recovery-needed when hashing or storing repair bytes fails and copies accepted bytes", async () => {
		const candidate = customResourceCandidate(
			"project-with-repair-failure",
			"Кресло с ошибкой repair",
			"revision-with-repair-failure",
		);
		const checksumFailure = createController(
			{
				loadCurrent: async () => ({ kind: "durable", candidate }),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
				writeReplacing: async () => undefined,
			},
			{
				sha256Bytes: async () =>
					Promise.reject(new Error("SHA-256 unavailable")),
			},
		);
		await checksumFailure.open();
		await expect(
			checksumFailure.repairCustomGlbResource(new Uint8Array(64).fill(0x61)),
		).resolves.toEqual({ kind: "not-ready" });

		const writeFailure = createController(
			{
				loadCurrent: async () => ({ kind: "durable", candidate }),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
				writeReplacing: async () =>
					Promise.reject(new Error("IndexedDB write failed")),
			},
			binaryChecksumForTest,
		);
		await writeFailure.open();
		await expect(
			writeFailure.repairCustomGlbResource(new Uint8Array(64).fill(0x61)),
		).resolves.toEqual({ kind: "persist-failed" });
		expect(writeFailure.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(writeFailure.writerAccess()).toEqual({ kind: "not-ready" });

		let storedBytes: Uint8Array | undefined;
		const byteCopyController = createController(
			{
				loadCurrent: async () => ({ kind: "durable", candidate }),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => storedBytes,
				writeIfAbsent: async () => ({ kind: "stored" }),
				writeReplacing: async ({ bytes }) => {
					storedBytes = bytes;
				},
			},
			binaryChecksumForTest,
		);
		await byteCopyController.open();
		const acceptedBytes = new Uint8Array(64).fill(0x61);
		await expect(
			byteCopyController.repairCustomGlbResource(acceptedBytes),
		).resolves.toEqual({
			kind: "recovered",
			resourceHash: candidate.project.assetDefinitionRefs[0]?.resourceHash,
		});
		acceptedBytes.fill(0x63);
		expect(storedBytes).toEqual(new Uint8Array(64).fill(0x61));
		await expect(
			byteCopyController.repairCustomGlbResource(new Uint8Array(64).fill(0x61)),
		).resolves.toEqual({ kind: "not-ready" });
	});

	it("exposes custom GLB bytes only through the injected local resource store", async () => {
		const resourceBytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);
		const resources: CustomAssetResourceStorePort = {
			delete: async () => undefined,
			read: async (resourceHash) =>
				resourceHash === "a".repeat(64) ? resourceBytes : undefined,
			writeIfAbsent: async () => ({ kind: "stored" }),
		};
		const controller = createController(
			{
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" }),
				recover: async () => ({ kind: "recovered" }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			resources,
		);

		await expect(
			controller.readCustomGlbResource("a".repeat(64)),
		).resolves.toEqual(resourceBytes);
		await expect(
			controller.readCustomGlbResource("b".repeat(64)),
		).resolves.toBeUndefined();
	});

	it("publishes one confirmed RecoveryChangeSet from the captured current Project and starts a fresh session boundary", async () => {
		const base = customResourceCandidate(
			"project-removal-recovery",
			"Удаление недоступных моделей",
			"revision-removal-base",
		);
		const brokenDefinition = base.project.assetDefinitionRefs[0];
		if (!brokenDefinition) {
			throw new Error(
				"Expected the custom-resource fixture to include its first asset.",
			);
		}
		const candidate: PublicationCandidate = {
			...base,
			project: {
				...base.project,
				assetInstances: [
					{
						anchorClass: "floor",
						assetDefinitionId: brokenDefinition.assetDefinitionId,
						assetInstanceId: "item-broken-chair",
						color: "#416b91",
						depthMm: brokenDefinition.depthMm,
						heightMm: brokenDefinition.heightMm,
						label: brokenDefinition.displayName,
						roomId: "room-1",
						widthMm: brokenDefinition.widthMm,
						xMm: 1500,
						zMm: 1500,
					},
					{
						anchorClass: "floor",
						assetInstanceId: "item-built-in",
						color: "#416b91",
						depthMm: 600,
						heightMm: 700,
						label: "Тумба",
						roomId: "room-1",
						widthMm: 700,
						xMm: 2600,
						zMm: 1500,
					},
				],
			},
		};
		let current = candidate;
		const published: Array<{
			readonly candidate: PublicationCandidate;
			readonly expectedBaseRevisionId: string;
		}> = [];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async (next, expectedBaseRevisionId) => {
				published.push({
					candidate: next as PublicationCandidate,
					expectedBaseRevisionId,
				});
				current = next as PublicationCandidate;
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const resources: CustomAssetResourceStorePort = {
			delete: async () => undefined,
			read: async () => undefined,
			writeIfAbsent: async () => ({ kind: "stored" }),
		};
		const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
			checksum: { sha256: async () => "sum:removal-recovered" },
			clock,
			ids: { next: () => "revision-removal-recovered" },
			repository,
			serializer: canonicalProjectSerializer,
		});
		const controller = createController(
			repository,
			{ sha256: async () => "sum:controller" },
			undefined,
			undefined,
			undefined,
			undefined,
			resources,
			binaryChecksumForTest,
			useCase,
		);

		await controller.open();
		expect(controller.recoveryCustomGlbRemovalSummary()).toEqual({
			affectedAssetDefinitionCount: 1,
			affectedAssetInstanceCount: 1,
		});
		await expect(
			controller.removeUnresolvedCustomGlbReferences(),
		).resolves.toEqual({
			kind: "durable",
			projectId: candidate.project.projectId,
			revisionId: "revision-removal-recovered",
		});
		expect(published).toEqual([
			{
				candidate: expect.objectContaining({
					project: expect.objectContaining({
						assetDefinitionRefs: [],
						assetInstances: [
							expect.objectContaining({ assetInstanceId: "item-built-in" }),
						],
					}),
				}),
				expectedBaseRevisionId: candidate.revision.revisionId,
			},
		]);
		expect(controller.snapshot()).toEqual(
			expect.objectContaining({
				kind: "saved",
				revisionId: "revision-removal-recovered",
			}),
		);
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: false,
		});
		await expect(controller.undo()).resolves.toEqual({ kind: "empty-history" });
		expect(controller.recoveryCustomGlbRemovalSummary()).toBeUndefined();
	});

	it("fails closed instead of publishing a RecoveryChangeSet when the captured hash set changes", async () => {
		const candidate = customResourceCandidate(
			"project-stale-removal",
			"Устаревшее восстановление",
			"revision-stale-removal",
		);
		let resourceAvailable = false;
		let published = 0;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => {
				published += 1;
				return { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const resources: CustomAssetResourceStorePort = {
			delete: async () => undefined,
			read: async () =>
				resourceAvailable ? new Uint8Array(64).fill(0x61) : undefined,
			writeIfAbsent: async () => ({ kind: "stored" }),
		};
		const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
			checksum: { sha256: async () => "sum:must-not-publish" },
			clock,
			ids: { next: () => "revision-must-not-exist" },
			repository,
			serializer: canonicalProjectSerializer,
		});
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			resources,
			binaryChecksumForTest,
			useCase,
		);

		await controller.open();
		resourceAvailable = true;
		await expect(
			controller.removeUnresolvedCustomGlbReferences(),
		).resolves.toEqual({ kind: "stale-recovery" });
		expect(published).toBe(0);
		expect(controller.snapshot()).toEqual(
			expect.objectContaining({ kind: "saved" }),
		);
	});

	it("keeps recovery read-only when the canonical RecoveryChangeSet use case is unavailable", async () => {
		const candidate = customResourceCandidate(
			"project-removal-not-ready",
			"Недоступное восстановление",
			"revision-removal-not-ready",
		);
		let published = 0;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => {
				published += 1;
				return { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest,
		);

		await controller.open();
		expect(controller.recoveryCustomGlbRemovalSummary()).toEqual({
			affectedAssetDefinitionCount: 1,
			affectedAssetInstanceCount: 0,
		});
		await expect(
			controller.removeUnresolvedCustomGlbReferences(),
		).resolves.toEqual({ kind: "not-ready" });
		expect(published).toBe(0);
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("fails closed before publication when exact-byte verification throws during RecoveryChangeSet confirmation", async () => {
		const candidate = customResourceCandidate(
			"project-removal-scan-error",
			"Ошибка проверки",
			"revision-removal-scan-error",
		);
		let published = 0;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => {
				published += 1;
				return { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
			checksum: { sha256: async () => "sum:must-not-publish" },
			clock,
			ids: { next: () => "revision-must-not-exist" },
			repository,
			serializer: canonicalProjectSerializer,
		});
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => {
					throw new Error("IndexedDB read failed");
				},
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest,
			useCase,
		);

		await controller.open();
		await expect(
			controller.removeUnresolvedCustomGlbReferences(),
		).resolves.toEqual({ kind: "not-ready" });
		expect(published).toBe(0);
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("does not expose stale-base or persistence-failed RecoveryChangeSets as saved revisions", async () => {
		for (const publication of [
			{
				kind: "stale-base" as const,
				expected: { kind: "stale-base", reasonCode: "STALE_BASE_REVISION" },
			},
			{
				kind: "persist-failed" as const,
				reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
				expected: {
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_WRITE_FAILED",
				},
			},
		]) {
			const candidate = customResourceCandidate(
				`project-removal-${publication.kind}`,
				`Результат ${publication.kind}`,
				`revision-removal-${publication.kind}`,
			);
			let published = 0;
			const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort =
				{
					loadCurrent: async () => ({ kind: "durable", candidate }),
					publish: async () => ({ kind: "durable" }),
					publishNextRevision: async () => {
						published += 1;
						return publication.kind === "stale-base"
							? { kind: "stale-base" as const }
							: {
									kind: "persist-failed" as const,
									reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
								};
					},
					recover: async () => ({ kind: "recovered" }),
				};
			const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
				checksum: { sha256: async () => "sum:failed-recovery" },
				clock,
				ids: { next: () => `revision-next-${publication.kind}` },
				repository,
				serializer: canonicalProjectSerializer,
			});
			const controller = createController(
				repository,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				{
					delete: async () => undefined,
					read: async () => undefined,
					writeIfAbsent: async () => ({ kind: "stored" }),
				},
				binaryChecksumForTest,
				useCase,
			);

			await controller.open();
			await expect(
				controller.removeUnresolvedCustomGlbReferences(),
			).resolves.toEqual(publication.expected);
			expect(published).toBe(1);
			expect(controller.snapshot()).toEqual({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			expect(controller.sessionHistory()).toEqual({
				canRedo: false,
				canUndo: false,
			});
		}
	});

	it("rejects a same-sized but different revalidated hash set without publishing a RecoveryChangeSet", async () => {
		const base = customResourceCandidate(
			"project-removal-different-set",
			"Другой набор хешей",
			"revision-removal-different-set",
		);
		const originalDefinition = base.project.assetDefinitionRefs[0];
		if (!originalDefinition) {
			throw new Error(
				"Expected the custom-resource fixture to include its first asset.",
			);
		}
		const secondHash = "b".repeat(64);
		const thirdHash = "c".repeat(64);
		const candidate: PublicationCandidate = {
			...base,
			project: {
				...base.project,
				assetDefinitionRefs: [
					originalDefinition,
					{
						...originalDefinition,
						assetDefinitionId: "custom-table",
						resourceHash: secondHash,
					},
					{
						...originalDefinition,
						assetDefinitionId: "custom-lamp",
						resourceHash: thirdHash,
					},
				],
			},
		};
		const resources = new Map<string, Uint8Array | undefined>([
			[thirdHash, new Uint8Array(64).fill(0x63)],
		]);
		let published = 0;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => {
				published += 1;
				return { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
			checksum: { sha256: async () => "sum:must-not-publish" },
			clock,
			ids: { next: () => "revision-must-not-exist" },
			repository,
			serializer: canonicalProjectSerializer,
		});
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async (resourceHash) => resources.get(resourceHash),
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest,
			useCase,
		);

		await controller.open();
		resources.set(
			originalDefinition.resourceHash,
			new Uint8Array(64).fill(0x61),
		);
		resources.set(thirdHash, undefined);
		await expect(
			controller.removeUnresolvedCustomGlbReferences(),
		).resolves.toEqual({ kind: "stale-recovery" });
		expect(published).toBe(0);
	});

	it("does not let exact-byte repair race a confirmed RecoveryChangeSet", async () => {
		const candidate = customResourceCandidate(
			"project-recovery-operation-lock",
			"Взаимное исключение",
			"revision-recovery-operation-lock",
		);
		let published = 0;
		let checksumCalls = 0;
		let resolveChecksum: ((resourceHash: string) => void) | undefined;
		const storedResources = new Map<string, Uint8Array>();
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => {
				published += 1;
				return { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
			checksum: { sha256: async () => "sum:must-not-publish" },
			clock,
			ids: { next: () => "revision-must-not-exist" },
			repository,
			serializer: canonicalProjectSerializer,
		});
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async (resourceHash) => storedResources.get(resourceHash),
				writeIfAbsent: async () => ({ kind: "stored" }),
				writeReplacing: async ({ bytes, resourceHash }) => {
					storedResources.set(resourceHash, bytes.slice());
				},
			},
			{
				sha256Bytes: async () => {
					checksumCalls += 1;
					return checksumCalls === 1
						? new Promise<string>((resolve) => {
								resolveChecksum = resolve;
							})
						: "a".repeat(64);
				},
			},
			useCase,
		);

		await controller.open();
		const repair = controller.repairCustomGlbResource(
			new Uint8Array(64).fill(0x61),
		);
		if (!resolveChecksum) {
			throw new Error(
				"Expected exact-byte repair to begin checksum verification.",
			);
		}
		await expect(
			controller.removeUnresolvedCustomGlbReferences(),
		).resolves.toEqual({ kind: "in-progress" });
		expect(published).toBe(0);
		resolveChecksum("a".repeat(64));
		await expect(repair).resolves.toEqual({
			kind: "recovered",
			resourceHash: "a".repeat(64),
		});
	});

	it("does not report RecoveryChangeSet success when the required integrity reopen fails", async () => {
		const candidate = customResourceCandidate(
			"project-reopen-failure",
			"Неудачная проверка после удаления",
			"revision-reopen-failure",
		);
		let loads = 0;
		let published = 0;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => {
				loads += 1;
				if (loads === 1) {
					return { kind: "durable" as const, candidate };
				}
				throw new Error("IndexedDB reopen failed");
			},
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => {
				published += 1;
				return { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
			checksum: { sha256: async () => "sum:reopen-failure" },
			clock,
			ids: { next: () => "revision-published-before-reopen-failure" },
			repository,
			serializer: canonicalProjectSerializer,
		});
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			binaryChecksumForTest,
			useCase,
		);

		await controller.open();
		const result = await controller.removeUnresolvedCustomGlbReferences();
		expect(result.kind).not.toBe("durable");
		expect(published).toBe(1);
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("exports a chosen directory card without opening or mutating another project", async () => {
		const current = directoryCandidate(
			"project-current",
			"Текущий план",
			"revision-current",
		);
		const remoteCard = directoryCandidate(
			"project-card",
			"План для передачи",
			"revision-card",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [
					{
						name: current.project.name,
						projectId: current.project.projectId,
						revisionId: current.revision.revisionId,
						updatedAt: current.project.updatedAt,
					},
					{
						name: remoteCard.project.name,
						projectId: remoteCard.project.projectId,
						revisionId: remoteCard.revision.revisionId,
						updatedAt: remoteCard.project.updatedAt,
					},
				],
			}),
			loadProject: async (projectId) =>
				projectId === remoteCard.project.projectId
					? { kind: "durable", candidate: remoteCard }
					: projectId === current.project.projectId
						? { kind: "durable", candidate: current }
						: { kind: "empty" },
		};
		const exportLocalProjectJson = {
			execute: async (candidate: PublicationCandidate) => ({
				content: candidate.project.projectId,
				filename: "project.interiors.json",
				kind: "ready" as const,
				mimeType: "application/json" as const,
			}),
		} as unknown as ExportLocalProjectJsonUseCase;
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			exportLocalProjectJson,
		);

		await controller.open();
		await controller.openProject("project-current");
		await expect(controller.exportProjectJson("project-card")).resolves.toEqual(
			{
				content: "project-card",
				filename: "project.interiors.json",
				kind: "ready",
				mimeType: "application/json",
			},
		);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Текущий план",
			revisionId: "revision-current",
		});
	});

	it("exports a selected durable Project as a Portable Backup without changing the active session", async () => {
		const current = directoryCandidate(
			"project-current",
			"Текущий план",
			"revision-current",
		);
		const remoteCard = directoryCandidate(
			"project-card",
			"План для передачи",
			"revision-card",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "populated", projects: [] }),
			loadProject: async (projectId) =>
				projectId === remoteCard.project.projectId
					? { kind: "durable", candidate: remoteCard }
					: projectId === current.project.projectId
						? { kind: "durable", candidate: current }
						: { kind: "empty" },
		};
		const exportPortableBackup = {
			execute: async (candidate: PublicationCandidate) => ({
				bytes: Uint8Array.from([1, 2, 3]),
				filename: `${candidate.project.projectId}.interiors`,
				kind: "ready" as const,
				mimeType: "application/zip" as const,
			}),
		} as unknown as ExportPortableBackupUseCase;
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			exportPortableBackup,
		);

		await controller.open();
		await controller.openProject("project-current");
		await expect(
			controller.exportProjectTransfer("project-card"),
		).resolves.toEqual({
			bytes: Uint8Array.from([1, 2, 3]),
			filename: "project-card.interiors",
			kind: "ready",
			mimeType: "application/zip",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Текущий план",
			revisionId: "revision-current",
		});
	});

	it("uses the visible project export route to emit a self-contained Portable Backup even when JSON could carry the snapshot", async () => {
		const current = directoryCandidate(
			"project-current",
			"Текущий план",
			"revision-current",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		let jsonExports = 0;
		const exportLocalProjectJson = {
			execute: async () => {
				jsonExports += 1;
				return {
					content: "resource-free-json",
					filename: "project-current.interiors.json",
					kind: "ready" as const,
					mimeType: "application/json" as const,
				};
			},
		} as unknown as ExportLocalProjectJsonUseCase;
		const exportPortableBackup = {
			execute: async () => ({
				bytes: Uint8Array.from([1, 2, 3]),
				filename: "project-current.interiors",
				kind: "ready" as const,
				mimeType: "application/zip" as const,
			}),
		} as unknown as ExportPortableBackupUseCase;
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			exportLocalProjectJson,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			exportPortableBackup,
		);

		await controller.open();
		await expect(controller.exportProjectTransfer()).resolves.toEqual({
			bytes: Uint8Array.from([1, 2, 3]),
			filename: "project-current.interiors",
			kind: "ready",
			mimeType: "application/zip",
		});
		expect(jsonExports).toBe(0);
	});

	it("fails the visible export route closed when no durable source or Portable Backup exporter is available", async () => {
		let exports = 0;
		const emptyRepository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const exportPortableBackup = {
			execute: async () => {
				exports += 1;
				return {
					bytes: Uint8Array.of(1),
					filename: "unexpected.interiors",
					kind: "ready" as const,
					mimeType: "application/zip" as const,
				};
			},
		} as unknown as ExportPortableBackupUseCase;
		const withoutSource = createController(
			emptyRepository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			exportPortableBackup,
		);

		await withoutSource.open();
		await expect(withoutSource.exportProjectTransfer()).resolves.toEqual({
			kind: "not-ready",
		});
		expect(exports).toBe(0);

		const current = directoryCandidate(
			"project-current",
			"Текущий план",
			"revision-current",
		);
		const withoutExporter = createController({
			...emptyRepository,
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
		});
		await withoutExporter.open();
		await expect(withoutExporter.exportProjectTransfer()).resolves.toEqual({
			kind: "not-ready",
		});
	});

	it("routes a ZIP-signature project transfer through the self-contained importer instead of JSON", async () => {
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const importedBy: string[] = [];
		const portableStatuses: string[] = [];
		const cancellation = { aborted: false };
		let receivedCancellation: { readonly aborted: boolean } | undefined;
		const importLocalProjectJson = {
			execute: async () => {
				importedBy.push("json");
				return {
					kind: "rejected" as const,
					reasonCode: "PROJECT_JSON_INVALID" as const,
				};
			},
		} as unknown as ImportLocalProjectJsonUseCase;
		const importPortableBackup = {
			execute: async (
				_bytes: Uint8Array,
				onStatus: (status: { readonly kind: "validating" }) => void,
				signal: { readonly aborted: boolean } | undefined,
			) => {
				importedBy.push("archive");
				receivedCancellation = signal;
				onStatus({ kind: "validating" });
				return {
					kind: "rejected" as const,
					reasonCode: "PORTABLE_BACKUP_INVALID" as const,
				};
			},
		} as unknown as ImportPortableBackupUseCase;
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			importLocalProjectJson,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			importPortableBackup,
		);

		await expect(
			controller.importProjectTransfer(
				Uint8Array.from([0x50, 0x4b, 0x03, 0x04]),
				{
					onPortableStatus: (status) => portableStatuses.push(status.kind),
					signal: cancellation,
				},
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
		expect(importedBy).toEqual(["archive"]);
		expect(portableStatuses).toEqual(["validating"]);
		expect(receivedCancellation).toBe(cancellation);
	});

	it("reports a Portable Backup import only when the exact failed candidate is durably retried", async () => {
		const candidate = directoryCandidate("imported-plan", "Импортированный план", "imported-revision");
		const published: DurablePublicationCandidate[] = [];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (attempt) => {
				published.push(attempt);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createController(
			repository, undefined, undefined, undefined, undefined, undefined,
			undefined, undefined, undefined, undefined, undefined, undefined,
			{
				execute: async (_bytes, onStatus) => {
					onStatus({ kind: "validating" });
					onStatus({ kind: "saving" });
					onStatus({ candidate, kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
					return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
				},
			} as ImportPortableBackupUseCase,
		);
		const metrics: string[] = [];
		controller.subscribeProductMetrics((metric) => metrics.push(metric));
		await controller.open();
		await expect(controller.importPortableBackup(new Uint8Array())).resolves.toMatchObject({ kind: "persist-failed" });
		expect(metrics).toEqual([]);
		await controller.retry();
		expect(published).toEqual([candidate]);
		expect(metrics).toEqual(["backup_imported"]);
	});

	it("opens an imported file as a new durable Project and drops prior session history", async () => {
		const current = directoryCandidate(
			"project-current",
			"Текущий план",
			"revision-current",
		);
		const imported = directoryCandidate(
			"project-imported",
			"Импортированный план",
			"revision-imported",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const importLocalProjectJson = {
			execute: async (
				_bytes: Uint8Array,
				onStatus: (
					status: import("../application/import-local-project-json").ImportLocalProjectJsonStatus,
				) => void,
			) => {
				onStatus({ kind: "saving" });
				onStatus({ candidate: imported, kind: "saved" });
				return {
					kind: "durable" as const,
					projectId: imported.project.projectId,
					revisionId: imported.revision.revisionId,
				};
			},
		} as ImportLocalProjectJsonUseCase;
		const controller = createController(
			repository,
			undefined,
			undefined,
			undefined,
			importLocalProjectJson,
		);

		await controller.open();
		await expect(
			controller.importProjectJson(new Uint8Array([123, 125])),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-imported",
			revisionId: "revision-imported",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Импортированный план",
			revisionId: "revision-imported",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: false,
		});
	});

	it("adds the prior durable Project revision to session history only after rename is published", async () => {
		const first = directoryCandidate("project-1", "Первый план", "revision-1");
		const renamed: PublicationCandidate = {
			project: {
				...first.project,
				name: "План кухни",
				updatedAt: "2026-08-15T14:01:00.000Z",
			},
			revision: {
				...first.revision,
				createdAt: "2026-08-15T14:01:00.000Z",
				revisionId: "revision-2",
			},
		};
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [
					{
						name: first.project.name,
						projectId: first.project.projectId,
						revisionId: first.revision.revisionId,
						updatedAt: first.project.updatedAt,
					},
				],
			}),
			loadProject: async () => ({ kind: "durable", candidate: first }),
		};
		const renameProject = {
			execute: async (
				_base: PublicationCandidate,
				_name: string,
				onStatus: (
					status: import("../application/rename-project").RenameProjectStatus,
				) => void,
			) => {
				onStatus({ kind: "saving" });
				onStatus({ kind: "saved", candidate: renamed });
				return {
					kind: "durable" as const,
					projectId: "project-1",
					revisionId: "revision-2",
				};
			},
		} as unknown as RenameProjectUseCase;
		const controller = createController(
			repository,
			undefined,
			directory,
			renameProject,
		);
		const observedStates: ProjectScreenState[] = [];
		controller.subscribe((state) => observedStates.push(state));

		await controller.open();
		await controller.openProject(first.project.projectId);
		await expect(controller.renameProject("План кухни")).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "План кухни",
			revisionId: "revision-2",
		});
		expect(observedStates).toContainEqual({
			kind: "saving",
			project: first.project,
			revisionId: "revision-1",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
		expect(controller.sessionHistoryCommandLabels()).toEqual({
			redoActionLabel: undefined,
			undoActionLabel: "Отменить действие: переименование проекта",
		});

		await expect(controller.undo()).resolves.toEqual({
			kind: "durable",
			revisionId: "revision-1",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Первый план",
			revisionId: "revision-1",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: false,
		});
		expect(controller.sessionHistoryCommandLabels()).toEqual({
			redoActionLabel: "Повторить действие: переименование проекта",
			undoActionLabel: undefined,
		});

		await expect(controller.redo()).resolves.toEqual({
			kind: "durable",
			revisionId: "revision-2",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "План кухни",
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
	});

	it("keeps both active history branches intact when a rename loses its base or becomes a retry candidate", async () => {
		const first = directoryCandidate("project-1", "Первый план", "revision-1");
		const second: PublicationCandidate = {
			project: {
				...first.project,
				name: "Второй план",
				updatedAt: "2026-08-15T14:01:00.000Z",
			},
			revision: {
				...first.revision,
				createdAt: "2026-08-15T14:01:00.000Z",
				revisionId: "revision-2",
			},
		};
		const third: PublicationCandidate = {
			project: {
				...first.project,
				name: "Третий план",
				updatedAt: "2026-08-15T14:02:00.000Z",
			},
			revision: {
				...first.revision,
				createdAt: "2026-08-15T14:02:00.000Z",
				revisionId: "revision-3",
			},
		};
		const staleCandidate: PublicationCandidate = {
			project: {
				...first.project,
				name: "Устаревшее имя",
				updatedAt: "2026-08-15T14:01:00.000Z",
			},
			revision: { ...first.revision, revisionId: "revision-stale" },
		};
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [
					{
						name: first.project.name,
						projectId: first.project.projectId,
						revisionId: first.revision.revisionId,
						updatedAt: first.project.updatedAt,
					},
				],
			}),
			loadProject: async () => ({ kind: "durable", candidate: first }),
		};
		const renameProject = {
			execute: async (
				_base: PublicationCandidate,
				name: string,
				onStatus: (
					status: import("../application/rename-project").RenameProjectStatus,
				) => void,
			) => {
				onStatus({ kind: "saving" });
				if (name === "Второй план") {
					onStatus({ candidate: second, kind: "saved" });
					return {
						kind: "durable" as const,
						projectId: "project-1",
						revisionId: "revision-2",
					};
				}
				if (name === "Третий план") {
					onStatus({ candidate: third, kind: "saved" });
					return {
						kind: "durable" as const,
						projectId: "project-1",
						revisionId: "revision-3",
					};
				}
				if (name === "Незакреплённое имя") {
					onStatus({
						candidate: staleCandidate,
						kind: "persist-failed",
						reasonCode: "PERSISTENCE_WRITE_FAILED",
					});
					return {
						kind: "persist-failed" as const,
						reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
					};
				}
				onStatus({
					candidate: staleCandidate,
					kind: "stale-base",
					reasonCode: "STALE_BASE_REVISION",
				});
				return {
					kind: "stale-base" as const,
					reasonCode: "STALE_BASE_REVISION" as const,
				};
			},
		} as RenameProjectUseCase;
		const controller = createController(
			repository,
			undefined,
			directory,
			renameProject,
		);

		await controller.open();
		await controller.openProject(first.project.projectId);
		await controller.renameProject("Второй план");
		await controller.renameProject("Третий план");
		await expect(controller.undo()).resolves.toEqual({
			kind: "durable",
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: true,
		});

		await expect(controller.renameProject("Устаревшее имя")).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Второй план",
			revisionId: "revision-2",
		});
		await expect(
			controller.renameProject("Незакреплённое имя"),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			project: { name: "Второй план" },
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: true,
		});
	});

	it("retains a quota-failed rename as an exact-base retry target", async () => {
		const current = directoryCandidate(
			"project-1",
			"Исходный план",
			"revision-1",
		);
		const renamed: PublicationCandidate = {
			project: {
				...current.project,
				name: "Переименованный план",
				updatedAt: "2026-08-28T18:00:00.000Z",
			},
			revision: {
				...current.revision,
				createdAt: "2026-08-28T18:00:00.000Z",
				revisionId: "revision-2",
			},
		};
		const retryAttempts: Array<{
			candidate: DurablePublicationCandidate;
			expectedBaseRevisionId: string;
		}> = [];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async (candidate, expectedBaseRevisionId) => {
				retryAttempts.push({ candidate, expectedBaseRevisionId });
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		let renameExecutions = 0;
		const renameProject = {
			execute: async (
				_base: PublicationCandidate,
				_name: string,
				onStatus: (
					status: import("../application/rename-project").RenameProjectStatus,
				) => void,
			) => {
				renameExecutions += 1;
				onStatus({ kind: "saving" });
				onStatus({
					candidate: renamed,
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				});
				return {
					kind: "persist-failed" as const,
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED" as const,
				};
			},
		} as RenameProjectUseCase;
		const controller = createController(
			repository,
			undefined,
			undefined,
			renameProject,
		);

		await controller.open();
		await expect(
			controller.renameProject("Переименованный план"),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			project: { name: "Исходный план" },
			revisionId: "revision-1",
		});
		await expect(
			controller.renameProject("Не должен начаться"),
		).resolves.toEqual({
			kind: "in-progress",
		});
		expect(renameExecutions).toBe(1);

		await controller.retry();
		expect(retryAttempts).toEqual([
			{ candidate: renamed, expectedBaseRevisionId: "revision-1" },
		]);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Переименованный план",
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
	});

	it("keeps a failed rename retry fenced until its CAS base becomes stale", async () => {
		const current = directoryCandidate(
			"project-1",
			"Исходный план",
			"revision-1",
		);
		const renamed: PublicationCandidate = {
			project: {
				...current.project,
				name: "Конфликтующее имя",
				updatedAt: "2026-08-28T18:01:00.000Z",
			},
			revision: {
				...current.revision,
				createdAt: "2026-08-28T18:01:00.000Z",
				revisionId: "revision-2",
			},
		};
		const retryResults = [
			{
				kind: "persist-failed" as const,
				reasonCode: "PERSISTENCE_QUOTA_EXCEEDED" as const,
			},
			{ kind: "stale-base" as const },
		];
		const retryBases: string[] = [];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async (_candidate, expectedBaseRevisionId) => {
				retryBases.push(expectedBaseRevisionId);
				return retryResults.shift() ?? { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const renameProject = {
			execute: async (
				_base: PublicationCandidate,
				_name: string,
				onStatus: (
					status: import("../application/rename-project").RenameProjectStatus,
				) => void,
			) => {
				onStatus({ kind: "saving" });
				onStatus({
					candidate: renamed,
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				});
				return {
					kind: "persist-failed" as const,
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED" as const,
				};
			},
		} as RenameProjectUseCase;
		const controller = createController(
			repository,
			undefined,
			undefined,
			renameProject,
		);

		await controller.open();
		await controller.renameProject("Конфликтующее имя");
		await controller.retry();
		expect(controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			project: { name: "Исходный план" },
			revisionId: "revision-1",
		});
		await expect(controller.renameProject("Пока ждём")).resolves.toEqual({
			kind: "in-progress",
		});

		await controller.retry();
		expect(retryBases).toEqual(["revision-1", "revision-1"]);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Исходный план",
			revisionId: "revision-1",
		});
	});

	it("turns a lost writer lease during a failed rename into a read-only outcome", async () => {
		const current = directoryCandidate(
			"project-1",
			"Исходный план",
			"revision-1",
		);
		const rejectedCandidate: PublicationCandidate = {
			project: { ...current.project, name: "Неподтверждённое имя" },
			revision: { ...current.revision, revisionId: "revision-2" },
		};
		let leaseWasLost = false;
		const writerLeases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => {
				const lost = leaseWasLost;
				leaseWasLost = false;
				return lost;
			},
			inspectWriterAccess: async () => ({ kind: "writable" }),
			takeOverWriterLease: async () => ({ kind: "writable" }),
		};
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: current }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const renameProject = {
			execute: async (
				_base: PublicationCandidate,
				_name: string,
				onStatus: (
					status: import("../application/rename-project").RenameProjectStatus,
				) => void,
			) => {
				onStatus({ kind: "saving" });
				leaseWasLost = true;
				onStatus({
					candidate: rejectedCandidate,
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_WRITE_FAILED",
				});
				return {
					kind: "persist-failed" as const,
					reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
				};
			},
		} as RenameProjectUseCase;
		const controller = createController(
			repository,
			undefined,
			undefined,
			renameProject,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			writerLeases,
		);

		await controller.open();
		await expect(
			controller.renameProject("Неподтверждённое имя"),
		).resolves.toEqual({
			kind: "writer-lease-lost",
			reasonCode: "WRITER_LEASE_LOST",
		});
		expect(controller.writerAccess()).toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Исходный план",
			revisionId: "revision-1",
		});
	});

	it("shows the durable project directory, then opens only the card the user selected", async () => {
		const first = directoryCandidate("project-1", "Первый план", "revision-1");
		const second = directoryCandidate("project-2", "Второй план", "revision-2");
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [
					{
						name: first.project.name,
						projectId: "project-1",
						revisionId: "revision-1",
						updatedAt: first.project.updatedAt,
					},
					{
						name: second.project.name,
						projectId: "project-2",
						revisionId: "revision-2",
						updatedAt: second.project.updatedAt,
					},
				],
			}),
			loadProject: async (projectId) =>
				projectId === "project-2"
					? { kind: "durable", candidate: second }
					: { kind: "durable", candidate: first },
		};
		let writable = true;
		const controller = createController(
			repository, undefined, directory, undefined, undefined, undefined,
			undefined, undefined, undefined,
			{
				consumeLostWriterLease: () => false,
				inspectWriterAccess: async () => writable
					? { kind: "writable", fencingToken: 1 }
					: { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" },
				takeOverWriterLease: async () => ({ kind: "writable", fencingToken: 2 }),
			},
		);
		const metrics: string[] = [];
		controller.subscribeProductMetrics((metric) => metrics.push(metric));

		await controller.open();
		expect(controller.snapshot()).toEqual({
			kind: "projects",
			projects: [
				{
					name: "Первый план",
					projectId: "project-1",
					revisionId: "revision-1",
					updatedAt: first.project.updatedAt,
				},
				{
					name: "Второй план",
					projectId: "project-2",
					revisionId: "revision-2",
					updatedAt: second.project.updatedAt,
				},
			],
		});

		await controller.openProject("project-2");
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { name: "Второй план", projectId: "project-2" },
			revisionId: "revision-2",
		});
		expect(metrics.splice(0)).toEqual(["saved_project_opened"]);

		await controller.showProjects();
		await controller.openProject("project-1", { initialAction: "rename" });
		expect(metrics).toEqual([]);

		await controller.showProjects();
		writable = false;
		await controller.openProject("project-1");
		expect(metrics).toEqual([]);
	});

	it("opens an empty local directory as the Projects hub instead of a creation flow", async () => {
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: async () => ({ kind: "empty" }),
		};
		const controller = createController(repository, undefined, directory);

		await controller.open();

		expect(controller.snapshot()).toEqual({
			kind: "projects",
			projects: [],
		});
	});

	it("keeps a sole local Project visible for explicit selection on cold open", async () => {
		const only = directoryCandidate(
			"project-only",
			"Единственный план",
			"revision-only",
		);
		let loadProjectCalls = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [
					{
						name: only.project.name,
						projectId: only.project.projectId,
						revisionId: only.revision.revisionId,
						updatedAt: only.project.updatedAt,
					},
				],
			}),
			loadProject: async () => {
				loadProjectCalls += 1;
				return { kind: "durable", candidate: only };
			},
		};
		const controller = createController(repository, undefined, directory);

		await controller.open();

		expect(controller.snapshot()).toEqual({
			kind: "projects",
			projects: [
				{
					name: "Единственный план",
					projectId: "project-only",
					revisionId: "revision-only",
					updatedAt: only.project.updatedAt,
				},
			],
		});
		expect(loadProjectCalls).toBe(0);
	});

	it("keeps healthy cards visible when another local Project needs recovery", async () => {
		const healthy = directoryCandidate(
			"project-healthy",
			"Здоровый план",
			"revision-healthy",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [
					{
						name: healthy.project.name,
						projectId: healthy.project.projectId,
						revisionId: healthy.revision.revisionId,
						updatedAt: healthy.project.updatedAt,
					},
				],
				recoveryNeeded: true,
			}),
			loadProject: async () => ({ kind: "durable", candidate: healthy }),
		};
		const controller = createController(repository, undefined, directory);

		await controller.open();

		expect(controller.snapshot()).toEqual({
			kind: "projects",
			projects: [
				{
					name: "Здоровый план",
					projectId: "project-healthy",
					revisionId: "revision-healthy",
					updatedAt: healthy.project.updatedAt,
				},
			],
			recoveryNeeded: true,
		});
	});

	it("keeps a corrupt project directory outside the ordinary Projects hub", async () => {
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			}),
			loadProject: async () => ({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			}),
		};
		const controller = createController(repository, undefined, directory);

		await controller.open();

		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("permanently deletes the opened Project and returns to the empty Projects hub", async () => {
		const repository = new DurableProjectRepository(
			new MemoryVersionedProjectStore(),
			async () => "sum:valid",
		);
		const controller = createController(repository, undefined, repository);
		await expect(controller.create("Удаляемый план")).resolves.toMatchObject({
			kind: "durable",
		});
		await expect(controller.permanentlyDeleteCurrentProject()).resolves.toEqual(
			{ kind: "permanently-deleted" },
		);
		expect(controller.snapshot()).toEqual({ kind: "projects", projects: [] });
	});

	it("deletes only the confirmed directory Project without opening an editor or changing another revision", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const selectedBase = directoryCandidate(
			"selected",
			"Удаляемый",
			"revision-selected",
		);
		const retainedBase = directoryCandidate(
			"retained",
			"Остаётся",
			"revision-retained",
		);
		const selected = {
			...selectedBase,
			revision: { ...selectedBase.revision, checksum: "sum:valid" },
		};
		const retained = {
			...retainedBase,
			revision: { ...retainedBase.revision, checksum: "sum:valid" },
		};
		await expect(repository.publish(selected)).resolves.toEqual({
			kind: "durable",
		});
		await expect(repository.publish(retained)).resolves.toEqual({
			kind: "durable",
		});
		const controller = createController(repository, undefined, repository);
		await controller.open();
		const states: ProjectScreenState[] = [];
		controller.subscribe((state) => states.push(state));

		await expect(
			controller.permanentlyDeleteProjectFromDirectory("selected"),
		).resolves.toEqual({ kind: "permanently-deleted" });

		expect(controller.snapshot()).toMatchObject({
			kind: "projects",
			projects: [{ projectId: "retained" }],
		});
		expect(states.every((state) => state.kind === "projects")).toBe(true);
		await expect(repository.loadProject("selected")).resolves.toEqual({
			kind: "empty",
		});
		await expect(repository.loadProject("retained")).resolves.toEqual({
			kind: "durable",
			candidate: retained,
		});
	});

	it("keeps directory deletion read-only after observing another writer, even after its lease expires", async () => {
		const time = { now: 1000 };
		const store = new MemoryVersionedProjectStore({
			nowEpochMs: () => time.now,
		});
		const durable = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const target = directoryCandidate(
			"selected",
			"Чужой активный проект",
			"valid",
		);
		await durable.publish(target);
		const first = new FencedProjectRepository(durable, store, "first");
		const second = new FencedProjectRepository(durable, store, "second");
		await first.inspectWriterAccess(target.project.projectId);
		const controller = createController(
			second,
			undefined,
			second,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			second,
		);
		await controller.open();
		const hub = controller.snapshot();

		await expect(
			controller.permanentlyDeleteProjectFromDirectory("selected"),
		).resolves.toEqual({ kind: "read-only" });
		time.now += 10_000;
		await expect(
			controller.permanentlyDeleteProjectFromDirectory("selected"),
		).resolves.toEqual({ kind: "read-only" });
		expect(controller.snapshot()).toEqual(hub);
		await expect(durable.loadProject("selected")).resolves.toEqual({
			kind: "durable",
			candidate: target,
		});
	});

	it("refuses directory deletion when the named target cannot be loaded and validated", async () => {
		const target = directoryCandidate("selected", "Подтверждённый", "valid");
		const other = directoryCandidate("other", "Другой", "valid");
		const outcomes: ReadonlyArray<
			readonly [import("../application/ports").ProjectLoadResult, string]
		> = [
			[{ kind: "empty" }, "not-found"],
			[
				{ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" },
				"not-ready",
			],
			[{ kind: "durable", candidate: other }, "not-ready"],
			[
				{ kind: "durable", candidate: { ...target, project: other.project } },
				"not-ready",
			],
			[
				{
					kind: "durable",
					candidate: {
						...target,
						revision: { ...target.revision, projectId: "other" },
					},
				},
				"not-ready",
			],
		];
		for (const [loaded, expectedKind] of outcomes) {
			const deleted: string[] = [];
			const directory = {
				...directDeletionDirectory(target, async (projectId) => {
					deleted.push(projectId);
					return { kind: "permanently-deleted" };
				}),
				loadProject: async () => loaded,
			};
			const controller = createController(
				new DurableProjectRepository(
					new MemoryVersionedProjectStore(),
					async () => "sum:valid",
				),
				undefined,
				directory,
			);
			await controller.open();
			const hub = controller.snapshot();

			await expect(
				controller.permanentlyDeleteProjectFromDirectory("selected"),
			).resolves.toEqual({ kind: expectedKind });
			expect(deleted).toEqual([]);
			expect(controller.snapshot()).toEqual(hub);
		}
	});

	it("keeps directory cards after a failed deletion or target read", async () => {
		const target = directoryCandidate("selected", "Сохраняемый", "valid");
		for (const failure of [
			"load",
			"delete",
			"not-found",
			"persist-failed",
		] as const) {
			const directory = {
				...directDeletionDirectory(target, async () => {
					if (failure === "delete") throw new Error("write failed");
					return {
						kind:
							failure === "not-found"
								? ("not-found" as const)
								: ("persist-failed" as const),
					};
				}),
				loadProject: async () => {
					if (failure === "load") throw new Error("read failed");
					return { kind: "durable" as const, candidate: target };
				},
			};
			const controller = createController(
				new DurableProjectRepository(
					new MemoryVersionedProjectStore(),
					async () => "sum:valid",
				),
				undefined,
				directory,
			);
			await controller.open();
			const hub = controller.snapshot();

			await expect(
				controller.permanentlyDeleteProjectFromDirectory("selected"),
			).resolves.toEqual({
				kind: failure === "not-found" ? "not-found" : "persist-failed",
			});
			expect(controller.snapshot()).toEqual(hub);
		}
	});

	it("does not delete a target when navigation changes during its directory validation", async () => {
		const target = directoryCandidate("selected", "Подтверждённый", "valid");
		const pending =
			deferredDirectoryResult<
				import("../application/ports").ProjectLoadResult
			>();
		const deleted: string[] = [];
		const directory = {
			...directDeletionDirectory(target, async (projectId) => {
				deleted.push(projectId);
				return { kind: "permanently-deleted" };
			}),
			loadProject: async () => pending.promise,
		};
		const inspected: string[] = [];
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async (projectId) => {
				inspected.push(projectId);
				return { kind: "writable" };
			},
			takeOverWriterLease: async () => {
				throw new Error("No automatic takeover");
			},
		};
		const controller = createController(
			new DurableProjectRepository(
				new MemoryVersionedProjectStore(),
				async () => "sum:valid",
			),
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);
		await controller.open();
		const deleting =
			controller.permanentlyDeleteProjectFromDirectory("selected");
		controller.startNewProject();
		pending.resolve({ kind: "durable", candidate: target });

		await expect(deleting).resolves.toEqual({ kind: "not-ready" });
		expect(deleted).toEqual([]);
		expect(inspected).toEqual([]);
		expect(controller.snapshot()).toEqual({ kind: "first-run" });
	});

	it("serializes directory deletion against another delete or publication", async () => {
		const target = directoryCandidate("selected", "Подтверждённый", "valid");
		const pending =
			deferredDirectoryResult<
				import("../application/ports").ProjectLoadResult
			>();
		const deleted: string[] = [];
		const directory = {
			...directDeletionDirectory(target, async (projectId) => {
				deleted.push(projectId);
				return { kind: "permanently-deleted" };
			}),
			loadProject: async () => pending.promise,
		};
		const controller = createController(
			new DurableProjectRepository(
				new MemoryVersionedProjectStore(),
				async () => "sum:valid",
			),
			undefined,
			directory,
		);
		await controller.open();
		const deleting =
			controller.permanentlyDeleteProjectFromDirectory("selected");

		await expect(
			controller.permanentlyDeleteProjectFromDirectory("selected"),
		).resolves.toEqual({ kind: "in-progress" });
		await expect(controller.create("Другой")).resolves.toEqual({
			kind: "in-progress",
		});
		pending.resolve({ kind: "durable", candidate: target });
		await expect(deleting).resolves.toEqual({ kind: "permanently-deleted" });
		expect(deleted).toEqual(["selected"]);
		expect(controller.snapshot()).toEqual({ kind: "projects", projects: [] });
	});

	it("limits confirmed directory deletion to an available card in the hub", async () => {
		const target = directoryCandidate("selected", "Подтверждённый", "valid");
		const deleted: string[] = [];
		const directory = directDeletionDirectory(target, async (projectId) => {
			deleted.push(projectId);
			return { kind: "permanently-deleted" };
		});
		const repository = new DurableProjectRepository(
			new MemoryVersionedProjectStore(),
			async () => "sum:valid",
		);
		const controller = createController(repository, undefined, directory);
		await expect(
			controller.permanentlyDeleteProjectFromDirectory("selected"),
		).resolves.toEqual({ kind: "not-ready" });
		await controller.open();
		await expect(
			controller.permanentlyDeleteProjectFromDirectory("unknown"),
		).resolves.toEqual({ kind: "not-found" });
		await controller.openProject("selected");
		await expect(
			controller.permanentlyDeleteProjectFromDirectory("selected"),
		).resolves.toEqual({ kind: "not-ready" });
		expect(deleted).toEqual([]);
	});

	it("preserves the directory hub when a fence is lost just before confirmed deletion", async () => {
		const store = new MemoryVersionedProjectStore();
		const durable = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const target = directoryCandidate("selected", "Не удалён", "valid");
		await durable.publish(target);
		const fenced = new FencedProjectRepository(durable, store, "first");
		const directory: ProjectDirectoryPort & ProjectDeletionPort = {
			listProjects: () => fenced.listProjects(),
			loadProject: (projectId) => fenced.loadProject(projectId),
			permanentlyDeleteProject: async (projectId) => {
				await store.takeOverWriterLease(projectId, "other-context");
				return fenced.permanentlyDeleteProject(projectId);
			},
		};
		const controller = createController(
			fenced,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			fenced,
		);
		await controller.open();
		const hub = controller.snapshot();

		await expect(
			controller.permanentlyDeleteProjectFromDirectory("selected"),
		).resolves.toEqual({ kind: "writer-lease-lost" });
		expect(controller.snapshot()).toEqual(hub);
		await expect(durable.loadProject("selected")).resolves.toEqual({
			kind: "durable",
			candidate: target,
		});
	});

	it("refuses directory deletion without an equipped delete capability or ready writer", async () => {
		const target = directoryCandidate("selected", "Не удалён", "valid");
		const deleted: string[] = [];
		const directory = directDeletionDirectory(target, async (projectId) => {
			deleted.push(projectId);
			return { kind: "permanently-deleted" };
		});
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async () => ({ kind: "not-ready" }),
			takeOverWriterLease: async () => {
				throw new Error("No automatic takeover");
			},
		};
		const repository = new DurableProjectRepository(
			new MemoryVersionedProjectStore(),
			async () => "sum:valid",
		);
		const unreadyWriter = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);
		const queryOnly = createController(repository, undefined, {
			listProjects: directory.listProjects,
			loadProject: directory.loadProject,
		});
		for (const controller of [unreadyWriter, queryOnly]) {
			await controller.open();
			const hub = controller.snapshot();
			await expect(
				controller.permanentlyDeleteProjectFromDirectory("selected"),
			).resolves.toEqual({ kind: "not-ready" });
			expect(controller.snapshot()).toEqual(hub);
		}
		expect(deleted).toEqual([]);
	});

	it("does not delete or overwrite newer navigation after delayed directory writer inspection", async () => {
		const target = directoryCandidate("selected", "Не удалён", "valid");
		const deleted: string[] = [];
		const inspection =
			deferredDirectoryResult<import("../application/ports").WriterAccess>();
		const inspecting = deferredDirectoryResult<void>();
		const directory = directDeletionDirectory(target, async (projectId) => {
			deleted.push(projectId);
			return { kind: "permanently-deleted" };
		});
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async () => {
				inspecting.resolve();
				return inspection.promise;
			},
			takeOverWriterLease: async () => {
				throw new Error("No automatic takeover");
			},
		};
		const repository = new DurableProjectRepository(
			new MemoryVersionedProjectStore(),
			async () => "sum:valid",
		);
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);
		await controller.open();
		const deleting =
			controller.permanentlyDeleteProjectFromDirectory("selected");
		await inspecting.promise;
		controller.startNewProject();
		inspection.resolve({ kind: "writable" });

		await expect(deleting).resolves.toEqual({ kind: "not-ready" });
		expect(deleted).toEqual([]);
		expect(controller.snapshot()).toEqual({ kind: "first-run" });
	});

	it("fails closed when the opened Project directory cannot delete Projects", async () => {
		const candidate = directoryCandidate(
			"project-1",
			"Открытый план",
			"revision-1",
		);
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "populated", projects: [] }),
			loadProject: async () => ({ kind: "durable", candidate }),
		};
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createController(repository, undefined, directory);

		await controller.openProject(candidate.project.projectId);
		await expect(controller.permanentlyDeleteCurrentProject()).resolves.toEqual(
			{
				kind: "not-ready",
			},
		);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { projectId: candidate.project.projectId },
		});
	});

	it("keeps the Project open when direct deletion reports not-found", async () => {
		const candidate = directoryCandidate(
			"project-1",
			"Открытый план",
			"revision-1",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createController(
			repository,
			undefined,
			directDeletionDirectory(candidate, async () => ({ kind: "not-found" })),
		);

		await controller.openProject(candidate.project.projectId);
		await expect(controller.permanentlyDeleteCurrentProject()).resolves.toEqual(
			{
				kind: "not-found",
			},
		);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { projectId: candidate.project.projectId },
		});
	});

	it("keeps the Project open when direct deletion fails", async () => {
		const candidate = directoryCandidate(
			"project-1",
			"Открытый план",
			"revision-1",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createController(
			repository,
			undefined,
			directDeletionDirectory(candidate, async () => {
				throw new Error("IndexedDB write failed");
			}),
		);

		await controller.openProject(candidate.project.projectId);
		await expect(controller.permanentlyDeleteCurrentProject()).resolves.toEqual(
			{
				kind: "persist-failed",
			},
		);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { projectId: candidate.project.projectId },
		});
	});

	it("refuses direct deletion for a read-only Project", async () => {
		const candidate = directoryCandidate(
			"project-1",
			"Открытый план",
			"revision-1",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		let deletionCalls = 0;
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async () => ({
				kind: "read-only",
				reasonCode: "WRITER_LEASE_HELD",
			}),
			takeOverWriterLease: async () => ({
				kind: "read-only",
				reasonCode: "WRITER_LEASE_HELD",
			}),
		};
		const controller = createController(
			repository,
			undefined,
			directDeletionDirectory(candidate, async () => {
				deletionCalls += 1;
				return { kind: "permanently-deleted" };
			}),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);

		await controller.openProject(candidate.project.projectId);
		await expect(controller.permanentlyDeleteCurrentProject()).resolves.toEqual(
			{
				kind: "read-only",
			},
		);
		expect(deletionCalls).toBe(0);
	});

	it("reports a lost writer lease after a direct-deletion request", async () => {
		const candidate = directoryCandidate(
			"project-1",
			"Открытый план",
			"revision-1",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		let leaseWasLost = false;
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => leaseWasLost,
			inspectWriterAccess: async () => ({ kind: "writable" }),
			takeOverWriterLease: async () => ({ kind: "writable" }),
		};
		const controller = createController(
			repository,
			undefined,
			directDeletionDirectory(candidate, async () => ({
				kind: "permanently-deleted",
			})),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);

		await controller.openProject(candidate.project.projectId);
		leaseWasLost = true;
		await expect(controller.permanentlyDeleteCurrentProject()).resolves.toEqual(
			{
				kind: "writer-lease-lost",
			},
		);
		expect(controller.writerAccess()).toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
	});

	it("keeps the latest selected Project open when an earlier card request resolves last", async () => {
		const first = directoryCandidate("project-1", "Первый план", "revision-1");
		const second = directoryCandidate("project-2", "Второй план", "revision-2");
		let releaseFirstLoad: (() => void) | undefined;
		const firstLoad = new Promise<
			import("../application/ports").ProjectLoadResult
		>((resolve) => {
			releaseFirstLoad = () => resolve({ kind: "durable", candidate: first });
		});
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: (projectId) =>
				projectId === first.project.projectId
					? firstLoad
					: Promise.resolve({ kind: "durable", candidate: second }),
		};
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createController(repository, undefined, directory);

		const firstOpen = controller.openProject(first.project.projectId);
		const secondOpen = controller.openProject(second.project.projectId);
		await secondOpen;
		releaseFirstLoad?.();
		await firstOpen;

		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { projectId: second.project.projectId },
			revisionId: second.revision.revisionId,
		});
	});

	it("does not let a resumed writer refresh replace a newer Project navigation", async () => {
		const first = directoryCandidate("project-1", "Первый план", "revision-1");
		const second = directoryCandidate("project-2", "Второй план", "revision-2");
		let firstLoadCount = 0;
		let releaseRefresh: (() => void) | undefined;
		const delayedRefresh = new Promise<void>((resolve) => {
			releaseRefresh = resolve;
		});
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: async (projectId) => {
				if (projectId === second.project.projectId) {
					return { kind: "durable", candidate: second };
				}
				firstLoadCount += 1;
				if (firstLoadCount > 1) await delayedRefresh;
				return { kind: "durable", candidate: first };
			},
		};
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async (projectId) =>
				projectId === first.project.projectId && firstLoadCount > 0
					? { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" }
					: { kind: "writable" },
			takeOverWriterLease: async () => ({ kind: "writable" }),
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);

		await controller.openProject(first.project.projectId);
		const refresh = controller.refreshWriterLeaseAccess();
		await controller.openProject(second.project.projectId);
		releaseRefresh?.();
		await refresh;

		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { projectId: second.project.projectId },
			revisionId: second.revision.revisionId,
		});
	});

	it("does not let delayed lease inspection mark a newer Project navigation read-only", async () => {
		const first = directoryCandidate("project-1", "Первый план", "revision-1");
		const second = directoryCandidate("project-2", "Второй план", "revision-2");
		let inspectionCount = 0;
		let releaseRefreshInspection: (() => void) | undefined;
		let reportRefreshInspectionStarted: (() => void) | undefined;
		const refreshInspectionStarted = new Promise<void>((resolve) => {
			reportRefreshInspectionStarted = resolve;
		});
		const delayedRefreshInspection = new Promise<void>((resolve) => {
			releaseRefreshInspection = resolve;
		});
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: async (projectId) => ({
				kind: "durable",
				candidate: projectId === first.project.projectId ? first : second,
			}),
		};
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async (projectId) => {
				inspectionCount += 1;
				if (projectId === first.project.projectId && inspectionCount === 2) {
					reportRefreshInspectionStarted?.();
					await delayedRefreshInspection;
					return { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" };
				}
				return { kind: "writable" };
			},
			takeOverWriterLease: async () => ({ kind: "writable" }),
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);

		await controller.openProject(first.project.projectId);
		const refresh = controller.refreshWriterLeaseAccess();
		await refreshInspectionStarted;
		await controller.openProject(second.project.projectId);
		releaseRefreshInspection?.();
		await refresh;

		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { projectId: second.project.projectId },
			revisionId: second.revision.revisionId,
		});
		expect(controller.writerAccess()).toEqual({ kind: "writable" });
	});

	it("ignores a resumed writer refresh that loads a different Project", async () => {
		const first = directoryCandidate("project-1", "Первый план", "revision-1");
		const second = directoryCandidate("project-2", "Второй план", "revision-2");
		let loadCount = 0;
		let inspectionCount = 0;
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: async () => {
				loadCount += 1;
				return {
					kind: "durable",
					candidate: loadCount === 1 ? first : second,
				};
			},
		};
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async () => {
				inspectionCount += 1;
				return inspectionCount === 1
					? { kind: "writable" }
					: { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" };
			},
			takeOverWriterLease: async () => ({ kind: "writable" }),
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);

		await controller.openProject(first.project.projectId);
		await controller.refreshWriterLeaseAccess();

		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { projectId: first.project.projectId },
			revisionId: first.revision.revisionId,
		});
	});

	for (const phase of ["saving", "persist-failed"] as const) {
		it(`keeps ${phase} visible when the first writer heartbeat confirms access, then retries the pending change`, async () => {
			let releasePublication: (() => void) | undefined;
			let signalPublication: (() => void) | undefined;
			const started = new Promise<void>((resolve) => {
				signalPublication = resolve;
			});
			const held = new Promise<void>((resolve) => {
				releasePublication = resolve;
			});
			let attempts = 0;
			const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort =
				{
					loadCurrent: async () => ({ kind: "empty" }),
					publish: async () => ({ kind: "durable" }),
					recover: async () => ({ kind: "recovered" }),
					publishNextRevision: async () => {
						if (++attempts > 1) return { kind: "durable" };
						signalPublication?.();
						await held;
						return {
							kind: "persist-failed",
							reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
						};
					},
				};
			const rename = new RenameProjectUseCase({
				checksum: { sha256: async () => "sum:renamed" },
				clock,
				ids: { next: () => "renamed-revision" },
				repository,
				serializer: canonicalProjectSerializer,
			});
			const leases: WriterLeaseControllerPort = {
				consumeLostWriterLease: () => false,
				inspectWriterAccess: async () => ({ kind: "writable" }),
				takeOverWriterLease: async () => ({ kind: "writable" }),
			};
			const controller = createController(
				repository,
				undefined,
				undefined,
				rename,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				leases,
			);
			await controller.create("Исходный план");
			expect(controller.writerAccess()).toEqual({ kind: "not-ready" });
			const renaming = controller.renameProject("Новый план");
			await started;
			if (phase === "persist-failed") {
				releasePublication?.();
				await renaming;
			}
			await expect(controller.refreshWriterLeaseAccess()).resolves.toEqual({
				kind: "writable",
			});
			expect(controller.snapshot()).toMatchObject({
				kind: phase,
				project: { name: "Исходный план" },
				revisionId: "revision-1",
			});
			releasePublication?.();
			await renaming;
			await controller.retry();
			expect(controller.snapshot()).toMatchObject({
				kind: "saved",
				project: { name: "Новый план" },
				revisionId: "renamed-revision",
			});
		});
	}

	it("does not reload a resumed Project while the same context still owns its writer lease", async () => {
		const existing = directoryCandidate(
			"project-1",
			"Общий план",
			"revision-1",
		);
		let loadCount = 0;
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: async () => {
				loadCount += 1;
				return { kind: "durable", candidate: existing };
			},
		};
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async () => ({ kind: "writable" }),
			takeOverWriterLease: async () => ({ kind: "writable" }),
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);

		await controller.openProject(existing.project.projectId);
		const announcedAccess: string[] = [];
		controller.subscribe(() =>
			announcedAccess.push(controller.writerAccess().kind),
		);
		await expect(controller.refreshWriterLeaseAccess()).resolves.toEqual({
			kind: "writable",
		});

		expect(loadCount).toBe(1);
		expect(announcedAccess).toEqual([]);
	});

	it("keeps a read-only writer lease read-only until explicit takeover", async () => {
		const existing = directoryCandidate(
			"project-1",
			"Общий план",
			"revision-1",
		);
		let inspectionCount = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: async () => ({ kind: "durable", candidate: existing }),
		};
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async () => {
				inspectionCount += 1;
				return inspectionCount === 1
					? { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" }
					: { kind: "writable", fencingToken: 2 };
			},
			takeOverWriterLease: async () => ({ kind: "writable" }),
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);
		await controller.openProject(existing.project.projectId);
		const announcedAccess: string[] = [];
		controller.subscribe(() =>
			announcedAccess.push(controller.writerAccess().kind),
		);

		await expect(controller.refreshWriterLeaseAccess()).resolves.toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});

		expect(controller.writerAccess()).toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
		expect(inspectionCount).toBe(1);
		expect(announcedAccess).not.toContain("writable");
	});

	it("keeps a second controller read-only and preserves the first durable revision while its writer lease is held", async () => {
		const store = new MemoryVersionedProjectStore();
		const firstRepository = new FencedProjectRepository(
			new DurableProjectRepository(store, async () => "sum:valid"),
			store,
			"controller-a",
		);
		const secondRepository = new FencedProjectRepository(
			new DurableProjectRepository(store, async () => "sum:valid"),
			store,
			"controller-b",
		);
		const firstDependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: ids(),
			repository: firstRepository,
			serializer: canonicalProjectSerializer,
		};
		const secondIds = [
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		const secondDependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => secondIds.shift() ?? "unexpected-second-id" },
			repository: secondRepository,
			serializer: canonicalProjectSerializer,
		};
		const first = new ProjectController(
			new CreateProjectUseCase(firstDependencies),
			firstRepository,
			new ConfigureRectangularRoomUseCase(firstDependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{},
			firstRepository,
		);
		const second = new ProjectController(
			new CreateProjectUseCase(secondDependencies),
			secondRepository,
			new ConfigureRectangularRoomUseCase(secondDependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{},
			secondRepository,
		);

		await first.open();
		await first.create("Общий план");
		await second.open();

		expect(second.writerAccess()).toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
		await expect(
			second.configureRectangularRoom({
				depthMm: "3000",
				heightMm: "2600",
				widthMm: "4000",
			}),
		).resolves.toEqual({
			kind: "writer-lease-lost",
			reasonCode: "WRITER_LEASE_LOST",
		});
		expect(second.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: "revision-1",
		});
		expect(second.writerRecoveryCopy()).toMatchObject({
			revision: { revisionId: "revision-2" },
		});
		expect(
			second
				.sessionRetentionRoots()
				.undo.map((candidate) => candidate.revision.revisionId),
		).toEqual(["revision-2"]);
		await expect(firstRepository.loadCurrent()).resolves.toMatchObject({
			kind: "durable",
			candidate: { revision: { revisionId: "revision-1" } },
		});
	});

	it("atomically grants an unowned existing Project to only one simultaneous opener", async () => {
		const existing = directoryCandidate(
			"project-existing",
			"План после обновления",
			"revision-existing",
		);
		const store = new MemoryVersionedProjectStore();
		const durable = new DurableProjectRepository(
			store,
			async () => existing.revision.checksum,
		);
		await expect(durable.publish(existing)).resolves.toEqual({
			kind: "durable",
		});
		const firstRepository = new FencedProjectRepository(
			new DurableProjectRepository(
				store,
				async () => existing.revision.checksum,
			),
			store,
			"controller-a",
		);
		const secondRepository = new FencedProjectRepository(
			new DurableProjectRepository(
				store,
				async () => existing.revision.checksum,
			),
			store,
			"controller-b",
		);
		const controllerFor = (repository: FencedProjectRepository) =>
			createController(
				repository,
				{ sha256: async () => existing.revision.checksum },
				repository,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				repository,
			);
		const first = controllerFor(firstRepository);
		const second = controllerFor(secondRepository);

		await Promise.all([
			first.openProject(existing.project.projectId),
			second.openProject(existing.project.projectId),
		]);

		expect(
			[first.writerAccess().kind, second.writerAccess().kind].sort(),
		).toEqual(["read-only", "writable"]);
	});

	it("keeps a lost history draft recoverable, refreshes the durable base, and clears the loss marker after takeover", async () => {
		const store = new MemoryVersionedProjectStore();
		const firstRepository = new FencedProjectRepository(
			new DurableProjectRepository(store, async () => "sum:valid"),
			store,
			"controller-a",
		);
		const secondRepository = new FencedProjectRepository(
			new DurableProjectRepository(store, async () => "sum:valid"),
			store,
			"controller-b",
		);
		const firstIds = ids();
		const secondIds = [
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		const firstDependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: firstIds,
			repository: firstRepository,
			serializer: canonicalProjectSerializer,
		};
		const secondDependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => secondIds.shift() ?? "unexpected-second-id" },
			repository: secondRepository,
			serializer: canonicalProjectSerializer,
		};
		const first = new ProjectController(
			new CreateProjectUseCase(firstDependencies),
			firstRepository,
			new ConfigureRectangularRoomUseCase(firstDependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{},
			firstRepository,
		);
		const second = new ProjectController(
			new CreateProjectUseCase(secondDependencies),
			secondRepository,
			new ConfigureRectangularRoomUseCase(secondDependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{},
			secondRepository,
		);

		await first.open();
		await first.create("Общий план");
		await expect(
			first.configureRectangularRoom({
				depthMm: "3000",
				heightMm: "2600",
				widthMm: "4000",
			}),
		).resolves.toMatchObject({ kind: "durable" });
		const durableBeforeTakeover = await firstRepository.loadCurrent();
		expect(first.sessionHistory()).toEqual({ canRedo: false, canUndo: true });
		await second.open();
		await expect(second.takeOverWriterLease()).resolves.toEqual({
			kind: "writable",
			fencingToken: 2,
		});
		await expect(
			first.configureRectangularRoom({
				depthMm: "3100",
				heightMm: "2650",
				widthMm: "4200",
			}),
		).resolves.toMatchObject({
			kind: "writer-lease-lost",
			reasonCode: "WRITER_LEASE_LOST",
		});
		const forwardRecoveryCopy = first.writerRecoveryCopy();
		expect(forwardRecoveryCopy).toBeDefined();
		expect(
			first
				.sessionRetentionRoots()
				.undo.map((candidate) => candidate.revision.revisionId),
		).toEqual(["revision-1", forwardRecoveryCopy?.revision.revisionId]);

		await expect(first.undo()).resolves.toEqual({
			kind: "writer-lease-lost",
			reasonCode: "WRITER_LEASE_LOST",
		});
		await expect(firstRepository.loadCurrent()).resolves.toEqual(
			durableBeforeTakeover,
		);
		expect(first.writerRecoveryCopy()).toMatchObject({
			revision: { revisionId: "revision-1" },
		});
		expect(first.sessionHistory()).toEqual({ canRedo: false, canUndo: true });
		expect(
			first
				.sessionRetentionRoots()
				.undo.map((candidate) => candidate.revision.revisionId),
		).toEqual(["revision-1"]);

		const secondPublication = await second.configureRectangularRoom({
			depthMm: "3200",
			heightMm: "2700",
			widthMm: "4500",
		});
		expect(secondPublication).toMatchObject({ kind: "durable" });
		if (secondPublication.kind !== "durable") {
			throw new Error("Expected the takeover owner to publish");
		}

		await expect(first.refreshWriterLeaseAccess()).resolves.toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
		expect(first.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: secondPublication.revisionId,
		});
		await expect(first.takeOverWriterLease()).resolves.toEqual({
			kind: "writable",
			fencingToken: 3,
		});
		await expect(
			first.configureRectangularRoom({
				depthMm: "3400",
				heightMm: "2800",
				widthMm: "5000",
			}),
		).resolves.toMatchObject({ kind: "durable" });
	});

	it("keeps takeover failure read-only and returns an accessible controller outcome", async () => {
		const existing = directoryCandidate(
			"project-1",
			"Общий план",
			"revision-1",
		);
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: existing }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({
				kind: "populated",
				projects: [
					{
						name: existing.project.name,
						projectId: existing.project.projectId,
						revisionId: existing.revision.revisionId,
						updatedAt: existing.project.updatedAt,
					},
				],
			}),
			loadProject: async () => ({ kind: "durable", candidate: existing }),
		};
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async () => ({
				kind: "read-only",
				reasonCode: "WRITER_LEASE_HELD",
			}),
			takeOverWriterLease: async () => {
				throw new Error("IndexedDB takeover failed");
			},
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);
		await controller.openProject(existing.project.projectId);

		await expect(controller.takeOverWriterLease()).resolves.toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: existing.revision.revisionId,
		});
	});

	it("keeps a read-only takeover outcome without reloading the Project", async () => {
		const existing = directoryCandidate(
			"project-1",
			"Общий план",
			"revision-1",
		);
		let loadCount = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: existing }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: async () => {
				loadCount += 1;
				return { kind: "durable", candidate: existing };
			},
		};
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			inspectWriterAccess: async () => ({
				kind: "read-only",
				reasonCode: "WRITER_LEASE_HELD",
			}),
			takeOverWriterLease: async () => ({
				kind: "read-only",
				reasonCode: "WRITER_LEASE_HELD",
			}),
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			leases,
		);
		await controller.openProject(existing.project.projectId);

		await expect(controller.takeOverWriterLease()).resolves.toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});

		expect(loadCount).toBe(1);
	});
	it("opens a pre-fix closed manual plan exactly as its Durable Revision was stored", async () => {
		let project = createInitialProject({
			createdAt: "2026-08-13T08:40:00.000Z",
			levelId: "level-1",
			name: "Контур",
			projectId: "project-1",
		});
		const wallIds = [
			"v-1",
			"v-2",
			"wall-1",
			"v-3",
			"wall-2",
			"v-4",
			"wall-3",
			"wall-4",
			"room-original",
		];
		for (const wall of [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 3000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 0, zMm: 3000 }, start: { xMm: 4000, zMm: 3000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 3000 } },
		]) {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				{ next: () => wallIds.shift() ?? "unexpected-wall-id" },
				"2026-08-13T08:41:00.000Z",
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a closed manual fixture");
			}
			project = added.project;
		}
		const stale = { ...project, level: { ...project.level, rooms: [] } };
		const staleCandidate: PublicationCandidate = {
			project: stale,
			revision: {
				checksum: "stale",
				createdAt: stale.updatedAt,
				projectId: stale.projectId,
				revisionId: "revision-stale",
				schemaVersion: 1,
				serializedProject: canonicalProjectSerializer.serialize(stale),
			},
		};
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: staleCandidate }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const repairIds = ["room-repaired", "revision-repaired"];
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => repairIds.shift() ?? "unexpected-repair-id" },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{},
		);

		await controller.open();

		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: "revision-stale",
			project: { level: { rooms: [] } },
		});
		expect(published).toHaveLength(0);
	});

	it("coalesces concurrent opens without creating a new Durable Revision", async () => {
		let project = createInitialProject({
			createdAt: "2026-08-13T08:40:00.000Z",
			levelId: "level-1",
			name: "Контур",
			projectId: "project-1",
		});
		const wallIds = [
			"v-1",
			"v-2",
			"wall-1",
			"v-3",
			"wall-2",
			"v-4",
			"wall-3",
			"wall-4",
			"room-original",
		];
		for (const wall of [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 3000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 0, zMm: 3000 }, start: { xMm: 4000, zMm: 3000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 3000 } },
		]) {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				{ next: () => wallIds.shift() ?? "unexpected-wall-id" },
				"2026-08-13T08:41:00.000Z",
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a closed manual fixture");
			}
			project = added.project;
		}
		const stale = { ...project, level: { ...project.level, rooms: [] } };
		const staleCandidate: PublicationCandidate = {
			project: stale,
			revision: {
				checksum: "stale",
				createdAt: stale.updatedAt,
				projectId: stale.projectId,
				revisionId: "revision-stale",
				schemaVersion: 1,
				serializedProject: canonicalProjectSerializer.serialize(stale),
			},
		};
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: staleCandidate }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const repairIds = ["room-repaired", "revision-repaired"];
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => repairIds.shift() ?? "unexpected-repair-id" },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{},
		);

		const firstOpen = controller.open();
		const secondOpen = controller.open();
		await Promise.all([firstOpen, secondOpen]);

		expect(published).toHaveLength(0);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: "revision-stale",
			project: { level: { rooms: [] } },
		});
	});

	it("travels only through successfully published durable revisions during the active session", async () => {
		const historyIntents: Array<Array<string | undefined>> = [];
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			publishNextRevision: async (candidate, _base, ...intents: Array<string | undefined>) => {
				historyIntents.push(intents);
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: sharedIds,
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
		await expect(controller.undo()).resolves.toEqual({
			kind: "durable",
			revisionId: "revision-1",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { level: { vertices: [] } },
			revisionId: "revision-1",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: false,
		});

		await expect(controller.redo()).resolves.toEqual({
			kind: "durable",
			revisionId: "revision-2",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { level: { rooms: [{ roomId: "room-1" }] } },
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
		expect(published.map((candidate) => candidate.revision.revisionId)).toEqual(
			["revision-1", "revision-2", "revision-1", "revision-2"],
		);
		expect(historyIntents).toEqual([["history"], ["history"]]);
	});

	it("keeps history intact across retry failures and fails closed when retry loses its writer lease", async () => {
		let historyPublishCount = 0;
		const historyIntents: Array<string | undefined> = [];
		let writerLeaseWasLost = false;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }) as const,
			publishNextRevision: async (_candidate, _base, intent) => {
				historyIntents.push(intent);
				historyPublishCount += 1;
				return historyPublishCount < 3
					? ({
							kind: "persist-failed",
							reasonCode: "PERSISTENCE_WRITE_FAILED",
						} as const)
					: historyPublishCount === 3
						? ({ kind: "durable" } as const)
						: ({
								kind: "persist-failed",
								reasonCode: "PERSISTENCE_WRITE_FAILED",
							} as const);
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: sharedIds,
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
		);
		(
			controller as unknown as { writerLeases: WriterLeaseControllerPort }
		).writerLeases = {
			consumeLostWriterLease: () => writerLeaseWasLost,
			inspectWriterAccess: async () => ({ kind: "writable" }),
			takeOverWriterLease: async () => ({ kind: "writable" }),
		};

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		await expect(controller.undo()).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			project: { level: { rooms: [{ roomId: "room-1" }] } },
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
		await expect(
			controller.configureRectangularRoom({
				depthMm: "3000",
				heightMm: "2600",
				widthMm: "4200",
			}),
		).resolves.toEqual({ kind: "in-progress" });
		expect(historyPublishCount).toBe(1);

		await controller.retry();
		expect(controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			project: { level: { rooms: [{ roomId: "room-1" }] } },
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});

		await controller.retry();
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { level: { vertices: [] } },
			revisionId: "revision-1",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: false,
		});

		await expect(controller.redo()).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		writerLeaseWasLost = true;
		await controller.retry();
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: "revision-1",
		});
		expect(controller.writerAccess()).toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
		expect(controller.writerRecoveryCopy()).toMatchObject({
			revision: { revisionId: "revision-2" },
		});
		expect(historyIntents.length).toBeGreaterThan(1);
		expect(new Set(historyIntents)).toEqual(new Set(["history"]));
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: false,
		});
	});

	it("keeps Undo history intact when the captured base becomes stale, including retry", async () => {
		const expectedBaseRevisionIds: string[] = [];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" as const }),
			publishNextRevision: async (_candidate, expectedBaseRevisionId) => {
				expectedBaseRevisionIds.push(expectedBaseRevisionId);
				return { kind: "stale-base" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		await expect(controller.undo()).resolves.toEqual({ kind: "stale-base" });
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});

		await controller.retry();
		expect(expectedBaseRevisionIds).toEqual(["revision-2", "revision-2"]);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
	});

	it("fails closed without a CAS-capable repository and preserves the Undo branch", async () => {
		let publishCount = 0;
		const repository = {
			loadCurrent: async () => ({ kind: "empty" as const }),
			publish: async () => {
				publishCount += 1;
				return { kind: "durable" as const };
			},
			publishNextRevision: undefined,
			recover: async () => ({ kind: "recovered" as const }),
		} as unknown as ProjectRepositoryPort;
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		await expect(controller.undo()).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(publishCount).toBe(2);
		expect(controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			revisionId: "revision-2",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
	});

	it("keeps a healthy current Project durable when only an undo revision has a missing resource, then discards both branches only after rechecking the current manifest and writer fence", async () => {
		const current = customResourceCandidate(
			"project-history-resource",
			"Текущий план",
			"revision-current",
		);
		const missingHistoryResourceHash = "b".repeat(64);
		const historyOnlyBroken = {
			...current,
			project: {
				...current.project,
				assetDefinitionRefs: current.project.assetDefinitionRefs.map(
					(asset) => ({
						...asset,
						resourceHash: missingHistoryResourceHash,
					}),
				),
			},
			revision: {
				...current.revision,
				revisionId: "revision-history-only-broken",
			},
		};
		let publishCount = 0;
		let currentResourceAvailable = true;
		let historyResourceAvailable = false;
		let writerFenceChecks = 0;
		let writerIsWritable = true;
		const controller = createController(
			{
				loadCurrent: async () => ({ kind: "durable", candidate: current }),
				publish: async () => {
					publishCount += 1;
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" as const }),
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				delete: async () => undefined,
				read: async (resourceHash) => {
					if (
						currentResourceAvailable &&
						resourceHash ===
							current.project.assetDefinitionRefs[0]?.resourceHash
					) {
						return new Uint8Array(64).fill(0x61);
					}
					if (
						historyResourceAvailable &&
						resourceHash === missingHistoryResourceHash
					) {
						return new Uint8Array(64).fill(0x62);
					}
					return undefined;
				},
				writeIfAbsent: async () => ({ kind: "stored" as const }),
			},
			binaryChecksumForTest,
			undefined,
			{
				consumeLostWriterLease: () => false,
				inspectWriterAccess: async () => {
					writerFenceChecks += 1;
					return writerIsWritable
						? { kind: "writable" as const, fencingToken: 7 }
						: { kind: "read-only" as const, reasonCode: "WRITER_LEASE_HELD" };
				},
				takeOverWriterLease: async () => ({
					kind: "writable" as const,
					fencingToken: 8,
				}),
			},
		);

		await controller.open();
		writerFenceChecks = 0;
		(
			controller as unknown as {
				undoStack: PublicationCandidate[];
			}
		).undoStack.push(historyOnlyBroken);

		const metrics: string[] = [];
		controller.subscribeProductMetrics((metric) => metrics.push(metric));
		await expect(controller.refreshSessionHistoryIntegrity()).resolves.toEqual({
			kind: "history-resource-issue",
			resourceHashes: [missingHistoryResourceHash],
		});
		expect(metrics.splice(0)).toEqual(["resource_missing"]);
		expect(controller.snapshot()).toMatchObject({
			kind: "history-recovery-needed",
			resourceHashes: [missingHistoryResourceHash],
			revisionId: "revision-current",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
		expect(publishCount).toBe(0);
		await expect(controller.undo()).resolves.toEqual({
			kind: "history-resource-issue",
			resourceHashes: [missingHistoryResourceHash],
		});
		expect(metrics).toEqual(["resource_missing"]);

		historyResourceAvailable = true;
		await expect(controller.refreshSessionHistoryIntegrity()).resolves.toEqual({
			kind: "healthy",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: "revision-current",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});

		const historyStacks = controller as unknown as {
			redoStack: PublicationCandidate[];
			undoStack: PublicationCandidate[];
		};
		const redoTarget = historyStacks.undoStack.pop();
		if (!redoTarget) {
			throw new Error("Expected a durable undo target for the redo scan.");
		}
		historyStacks.redoStack.push(redoTarget);
		historyResourceAvailable = false;
		await expect(controller.refreshSessionHistoryIntegrity()).resolves.toEqual({
			kind: "history-resource-issue",
			resourceHashes: [missingHistoryResourceHash],
		});
		await expect(controller.redo()).resolves.toEqual({
			kind: "history-resource-issue",
			resourceHashes: [missingHistoryResourceHash],
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "history-recovery-needed",
			resourceHashes: [missingHistoryResourceHash],
			revisionId: "revision-current",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: false,
		});
		expect(publishCount).toBe(0);

		currentResourceAvailable = false;
		await expect(controller.discardSessionHistory()).resolves.toEqual({
			kind: "current-resource-issue",
		});
		expect(writerFenceChecks).toBe(0);
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: false,
		});

		currentResourceAvailable = true;
		writerIsWritable = false;
		await expect(controller.discardSessionHistory()).resolves.toEqual({
			kind: "read-only",
		});
		expect(writerFenceChecks).toBe(1);
		expect(controller.sessionHistory()).toEqual({
			canRedo: true,
			canUndo: false,
		});

		writerIsWritable = true;
		await expect(controller.discardSessionHistory()).resolves.toEqual({
			kind: "discarded",
		});
		expect(writerFenceChecks).toBe(2);
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: false,
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: "revision-current",
		});
		expect(publishCount).toBe(0);

		currentResourceAvailable = false;
		await expect(controller.refreshSessionHistoryIntegrity()).resolves.toEqual({
			kind: "current-resource-issue",
		});
		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(publishCount).toBe(0);
	});

	it("publishes a selected floor-item deletion through the durable controller boundary", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"item-1",
			"revision-3",
			"revision-4",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: sharedIds,
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			new CreateParametricFloorItemUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			new DeleteParametricFloorItemUseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await controller.createParametricFloorItem({
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 1500,
			zMm: 1500,
		});

		await expect(
			controller.deleteParametricFloorItem({ assetInstanceId: "item-1" }),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-4",
		});
		expect(published).toHaveLength(4);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { assetInstances: [] },
			revisionId: "revision-4",
		});
	});

	it("keeps the previous durable revision visible when floor-item deletion cannot persist, then retries its candidate", async () => {
		let publishCount = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCount += 1;
				return publishCount === 4
					? ({
							kind: "persist-failed",
							reasonCode: "PERSISTENCE_WRITE_FAILED",
						} as const)
					: ({ kind: "durable" } as const);
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"item-1",
			"revision-3",
			"revision-4",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: sharedIds,
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			new CreateParametricFloorItemUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			new DeleteParametricFloorItemUseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await controller.createParametricFloorItem({
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 1500,
			zMm: 1500,
		});

		await expect(
			controller.deleteParametricFloorItem({ assetInstanceId: "item-1" }),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			project: {
				assetInstances: [
					expect.objectContaining({ assetInstanceId: "item-1" }),
				],
			},
			revisionId: "revision-3",
		});
		await controller.retry();
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { assetInstances: [] },
			revisionId: "revision-4",
		});
	});

	it("blocks a rename until retry publishes the exact quota-failed candidate", async () => {
		let publishCount = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCount += 1;
				return publishCount === 2
					? ({
							kind: "persist-failed",
							reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
						} as const)
					: ({ kind: "durable" } as const);
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: ids(),
			repository,
			serializer: canonicalProjectSerializer,
		};
		let renameExecutions = 0;
		const renameProject = {
			execute: async () => {
				renameExecutions += 1;
				throw new Error(
					"A pending candidate must block a replacement mutation.",
				);
			},
		} as unknown as RenameProjectUseCase;
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{ renameProject },
		);

		await controller.open();
		await controller.create("Квартира");
		await expect(
			controller.configureRectangularRoom({
				depthMm: "3000",
				heightMm: "2600",
				widthMm: "4700",
			}),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
		});

		await expect(controller.renameProject("Потерянное имя")).resolves.toEqual({
			kind: "in-progress",
		});
		expect(renameExecutions).toBe(0);
		expect(publishCount).toBe(2);

		await controller.retry();
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { name: "Квартира" },
		});
		expect(publishCount).toBe(3);
	});

	it("publishes an internal divider deletion through the durable controller boundary", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"vertex-top",
			"vertex-bottom",
			"wall-top-right",
			"wall-bottom-left",
			"wall-divider",
			"room-right",
			"revision-3",
			"revision-4",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: sharedIds,
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			new AddConstrainedPartitionUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			new DeleteConstrainedWallUseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await controller.addConstrainedPartition({
			offsetMm: 2000,
			orientation: "vertical",
		});
		const saved = controller.snapshot();
		if (saved.kind !== "saved") {
			throw new Error("Expected partitioned Project");
		}
		const verticesById = new Map(
			saved.project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
		);
		const divider = saved.project.level.wallSegments.find((wall) => {
			const start = verticesById.get(wall.startVertexId);
			const end = verticesById.get(wall.endVertexId);
			return start?.xMm === 2000 && end?.xMm === 2000;
		});
		if (!divider) {
			throw new Error("Expected divider");
		}

		await expect(
			controller.deleteConstrainedWall({
				wallSegmentId: divider.wallSegmentId,
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-4",
		});
		expect(published).toHaveLength(4);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				level: {
					rooms: [
						{
							roomId: "room-1",
							faceFingerprint: "grid:0:4100:0:3100:100",
							heightMm: 2600,
						},
					],
				},
			},
			revisionId: "revision-4",
		});
	});

	it("publishes a selected placeholder resize through the same durable controller boundary", async () => {
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"item-1",
			"revision-3",
			"revision-4",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const useCaseDependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: sharedIds,
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(useCaseDependencies),
			repository,
			new ConfigureRectangularRoomUseCase(useCaseDependencies),
			undefined,
			new CreateParametricFloorItemUseCase(useCaseDependencies),
			undefined,
			undefined,
			new ResizeParametricFloorItemUseCase(useCaseDependencies),
		);

		await controller.open();
		await controller.create("Гостиная");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await controller.createParametricFloorItem({
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 1500,
			zMm: 1500,
		});
		await expect(
			controller.resizeParametricFloorItem({
				assetInstanceId: "item-1",
				depthMm: 900,
				heightMm: 900,
				widthMm: 1400,
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-4",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				assetInstances: [
					{
						assetInstanceId: "item-1",
						depthMm: 900,
						heightMm: 900,
						widthMm: 1400,
					},
				],
			},
			revisionId: "revision-4",
		});
	});

	it("publishes an outer grid expansion through the durable controller boundary", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"vertex-top",
			"vertex-bottom",
			"wall-top-right",
			"wall-bottom-left",
			"wall-divider",
			"room-right",
			"revision-3",
			"vertex-new-top",
			"vertex-new-bottom",
			"wall-new-top",
			"wall-new-bottom",
			"wall-new-right",
			"room-extension",
			"revision-4",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
			repository,
			new ConfigureRectangularRoomUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
			new AddConstrainedPartitionUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
			undefined,
			undefined,
			new ExpandOrthogonalGridUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await controller.addConstrainedPartition({
			offsetMm: 2000,
			orientation: "vertical",
		});
		await expect(
			controller.expandOrthogonalGrid({ amountMm: 1000, side: "right" }),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-4",
		});
		expect(published).toHaveLength(4);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				level: {
					rooms: [
						{ roomId: "room-1" },
						{ roomId: "room-right" },
						{ roomId: "room-extension" },
					],
				},
			},
			revisionId: "revision-4",
		});
	});

	it("publishes a detached rectangular room loop through the durable controller boundary", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"v-5",
			"v-6",
			"v-7",
			"v-8",
			"wall-5",
			"wall-6",
			"wall-7",
			"wall-8",
			"room-2",
			"revision-3",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: sharedIds,
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			new CreateRectangularRoomLoopUseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		await expect(
			controller.createRectangularRoomLoop({
				maxXMm: 7100,
				maxZMm: 6600,
				minXMm: 5000,
				minZMm: 5000,
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});

		expect(published).toHaveLength(3);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				level: {
					rooms: [
						{ roomId: "room-1" },
						{
							faceFingerprint: "loop:5000:7100:5000:6600:100",
							heightMm: 2600,
							roomId: "room-2",
						},
					],
				},
			},
			revisionId: "revision-3",
		});
	});

	it("leaves the current durable revision intact when the requested room loop overlaps it", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: sharedIds,
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			new CreateRectangularRoomLoopUseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		await expect(
			controller.createRectangularRoomLoop({
				maxXMm: 5000,
				maxZMm: 2000,
				minXMm: 4099,
				minZMm: 1000,
			}),
		).resolves.toEqual({ kind: "rejected", reasonCode: "ROOM_OVERLAP" });

		expect(published).toHaveLength(2);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { level: { rooms: [{ roomId: "room-1" }] } },
			revisionId: "revision-2",
		});
	});

	it("publishes an accepted partition through the same durable controller boundary", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"vertex-top",
			"vertex-bottom",
			"wall-top-right",
			"wall-bottom-left",
			"wall-divider",
			"room-right",
			"revision-3",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
			repository,
			new ConfigureRectangularRoomUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
			new AddConstrainedPartitionUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
		);

		await controller.open();
		await controller.create("Гостиная");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await expect(
			controller.addConstrainedPartition({
				offsetMm: 2000,
				orientation: "vertical",
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});
		expect(published).toHaveLength(3);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				level: { rooms: [{ roomId: "room-1" }, { roomId: "room-right" }] },
			},
			revisionId: "revision-3",
		});
	});

	it("publishes a rectangular plan through the controller and exposes the new durable Revision", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
			repository,
			new ConfigureRectangularRoomUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		expect(published).toHaveLength(2);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				level: { rooms: [{ heightMm: 2600 }], vertices: expect.any(Array) },
				projectId: "project-1",
			},
			revisionId: "revision-2",
		});
	});

	it("admits only one creation while the first command has yielded before its saving status", async () => {
		let releaseChecksum: (() => void) | undefined;
		const checksumGate = new Promise<string>((resolve) => {
			releaseChecksum = () => resolve("sum:valid");
		});
		const delayedChecksum: ChecksumPort = {
			sha256: async () => checksumGate,
		};
		let publications = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publications += 1;
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createController(repository, delayedChecksum);

		const first = controller.create("Квартира");
		const second = controller.create("Квартира");
		if (!releaseChecksum) {
			throw new Error("Checksum gate was not initialized");
		}
		releaseChecksum();

		await expect(first).resolves.toMatchObject({ kind: "durable" });
		await expect(second).resolves.toEqual({ kind: "in-progress" });
		expect(publications).toBe(1);
	});

	it("maps an unavailable local repository during open to recovery-needed instead of leaving loading", async () => {
		const controller = createController({
			loadCurrent: async () => {
				throw new Error("IndexedDB open failed");
			},
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		});

		await controller.open();

		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("keeps recovery-needed visible when local recovery itself fails", async () => {
		const controller = createController({
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (_candidate: PublicationCandidate) => ({
				kind: "durable",
			}),
			recover: async () => {
				throw new Error("IndexedDB recovery failed");
			},
		});

		await controller.recover();

		expect(controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("keeps the last durable editor revision visible while retrying a failed replacement", async () => {
		const initialProject: Project = {
			assetDefinitionRefs: [],
			assetInstances: [],
			createdAt: "2026-08-05T14:15:16.000Z",
			level: {
				levelId: "level-1",
				openings: [],
				rooms: [],
				vertices: [],
				wallSegments: [],
			},
			lifecycle: "active" as const,
			name: "Квартира",
			projectId: "project-1",
			schemaVersion: 1 as const,
			updatedAt: "2026-08-05T14:15:16.000Z",
		};
		const initial: PublicationCandidate = {
			project: initialProject,
			revision: {
				checksum: "sum:valid",
				createdAt: initialProject.updatedAt,
				projectId: initialProject.projectId,
				revisionId: "revision-1",
				schemaVersion: 1,
				serializedProject: canonicalProjectSerializer.serialize(initialProject),
			},
		};
		let publishCount = 0;
		let releaseRetry: (() => void) | undefined;
		const retryGate = new Promise<void>((resolve) => {
			releaseRetry = resolve;
		});
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: initial }),
			publish: async () => {
				publishCount += 1;
				if (publishCount === 1) {
					return {
						kind: "persist-failed",
						reasonCode: "PERSISTENCE_WRITE_FAILED",
					} as const;
				}
				await retryGate;
				return { kind: "durable" } as const;
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
		];
		let index = 0;
		const sharedIds: IdPort = {
			next: () => idValues[index++] ?? `extra-${index}`,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
			repository,
			new ConfigureRectangularRoomUseCase({
				checksum: { sha256: async () => "sum:valid" },
				clock,
				ids: sharedIds,
				repository,
				serializer: canonicalProjectSerializer,
			}),
		);

		await controller.open();
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		const retry = controller.retry();
		// A repeated tap on the visible retry action must join the active
		// publication instead of racing a second write for the same revision.
		const duplicateRetry = controller.retry();

		expect(controller.snapshot()).toMatchObject({
			kind: "saving",
			project: initialProject,
			revisionId: "revision-1",
		});
		if (!releaseRetry) {
			throw new Error("Retry gate was not initialized");
		}
		releaseRetry();
		await Promise.all([retry, duplicateRetry]);
		expect(publishCount).toBe(2);
	});

	it("publishes a free-wall deletion after v1 is migrated and then partitioned through the v2 controller path", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			publishNextRevision: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"revision-3",
			"v-bottom",
			"v-top",
			"bottom-tail",
			"top-tail",
			"divider",
			"room-right",
			"revision-4",
			"revision-5",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			new MigrateProjectV1ToV2UseCase(dependencies),
			new AddWallToProjectV2UseCase(dependencies),
			new DeleteWallFromProjectV2UseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			true,
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await controller.migrateToFreePlan();
		await controller.addFreeWall({
			end: { xMm: 2050, zMm: 3100 },
			start: { xMm: 2050, zMm: 0 },
			thicknessMm: 100,
		});

		await expect(
			controller.deleteFreeWall({ wallSegmentId: "divider" }),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-5",
		});
		expect(published).toHaveLength(5);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				schemaVersion: 2,
				level: {
					roomMetadata: [{ roomId: "room-1", heightMm: 2600 }],
					wallSegments: expect.arrayContaining([
						expect.objectContaining({ wallSegmentId: "wall-1" }),
					]),
				},
			},
			revisionId: "revision-5",
		});
	});

	it("keeps free-wall deletion unavailable until a v2 Durable Revision exists", async () => {
		let publications = 0;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publications += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => {
				publications += 1;
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: ids(),
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			new DeleteWallFromProjectV2UseCase(dependencies),
		);

		await controller.open();
		await controller.create("Квартира");

		await expect(
			controller.deleteFreeWall({ wallSegmentId: "wall-1" }),
		).resolves.toEqual({ kind: "not-ready" });
		expect(publications).toBe(1);
	});

	it("keeps create, move, resize, and delete of a greybox durable after v1 migrates to v2", async () => {
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"revision-3",
			"item-1",
			"revision-4",
			"revision-5",
			"revision-6",
			"revision-7",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			new MigrateProjectV1ToV2UseCase(dependencies),
			undefined,
			undefined,
			new CreateParametricFloorItemV2UseCase(dependencies),
			new MoveParametricFloorItemV2UseCase(dependencies),
			new ResizeParametricFloorItemV2UseCase(dependencies),
			new DeleteParametricFloorItemV2UseCase(dependencies),
			true,
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await controller.migrateToFreePlan();

		await expect(
			controller.createParametricFloorItem({
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 900,
				xMm: 1500,
				zMm: 1500,
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-4",
		});
		await expect(
			controller.moveParametricFloorItem({
				assetInstanceId: "item-1",
				xMm: 2200,
				zMm: 1500,
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-5",
		});
		await expect(
			controller.resizeParametricFloorItem({
				assetInstanceId: "item-1",
				depthMm: 800,
				heightMm: 800,
				widthMm: 1000,
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-6",
		});
		await expect(
			controller.deleteParametricFloorItem({ assetInstanceId: "item-1" }),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-7",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { assetInstances: [], schemaVersion: 2 },
			revisionId: "revision-7",
		});
	});

	it("fails closed for every persisted V2 fixture mutation even when experimental adapters are injected", async () => {
		const legacy = legacyV2Candidate();
		let publications = 0;
		let forbiddenExecutions = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ candidate: legacy, kind: "durable" }),
			publish: async () => {
				publications += 1;
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: ids(),
			repository,
			serializer: canonicalProjectSerializer,
		};
		const forbiddenUseCase = <UseCase>() =>
			({
				execute: async () => {
					forbiddenExecutions += 1;
					throw new Error("A quarantined V2 adapter must never execute");
				},
			}) as unknown as UseCase;
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			forbiddenUseCase<AddWallToProjectV2UseCase>(),
			forbiddenUseCase<DeleteWallFromProjectV2UseCase>(),
			forbiddenUseCase<CreateParametricFloorItemV2UseCase>(),
			forbiddenUseCase<MoveParametricFloorItemV2UseCase>(),
			forbiddenUseCase<ResizeParametricFloorItemV2UseCase>(),
			forbiddenUseCase<DeleteParametricFloorItemV2UseCase>(),
		);

		await controller.open();

		await expect(
			controller.addFreeWall({
				end: { xMm: 2000, zMm: 3000 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			}),
		).resolves.toEqual({ kind: "not-ready" });
		await expect(
			controller.deleteFreeWall({ wallSegmentId: "wall-1" }),
		).resolves.toEqual({ kind: "not-ready" });
		await expect(
			controller.createParametricFloorItem({
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 900,
				xMm: 1500,
				zMm: 1500,
			}),
		).resolves.toEqual({ kind: "not-ready" });
		await expect(
			controller.moveParametricFloorItem({
				assetInstanceId: "item-1",
				xMm: 1800,
				zMm: 1500,
			}),
		).resolves.toEqual({ kind: "not-ready" });
		await expect(
			controller.resizeParametricFloorItem({
				assetInstanceId: "item-1",
				depthMm: 800,
				heightMm: 800,
				widthMm: 1000,
			}),
		).resolves.toEqual({ kind: "not-ready" });
		await expect(
			controller.deleteParametricFloorItem({ assetInstanceId: "item-1" }),
		).resolves.toEqual({ kind: "not-ready" });
		expect(publications).toBe(0);
		expect(forbiddenExecutions).toBe(0);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { schemaVersion: 2 },
		});
	});

	it("does not migrate a V1 project when only a quarantined migration adapter is available", async () => {
		let forbiddenExecutions = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: ids(),
			repository,
			serializer: canonicalProjectSerializer,
		};
		const forbiddenMigration = {
			execute: async () => {
				forbiddenExecutions += 1;
				throw new Error("A quarantined V2 migration must never execute");
			},
		} as unknown as MigrateProjectV1ToV2UseCase;
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			forbiddenMigration,
		);

		await controller.open();
		await controller.create("Квартира");

		await expect(controller.migrateToFreePlan()).resolves.toEqual({
			kind: "not-ready",
		});
		expect(forbiddenExecutions).toBe(0);
	});

	it("routes an explicitly drawn exterior wall through the canonical v1 mutation boundary", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			publishNextRevision: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"free-start",
			"free-end",
			"free-wall",
			"revision-3",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{ addGeneralWall: new AddGeneralWallToProjectUseCase(dependencies) },
		);

		const metrics: string[] = [];
		controller.subscribeProductMetrics((metric) => metrics.push(metric));
		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		await expect(
			controller.addGeneralWall({
				end: { xMm: 6500, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});
		expect(published.at(-1)?.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ wallSegmentId: "free-wall" }),
			]),
		);
		expect(metrics).toEqual(["project_created", "room_created", "wall_added"]);
		await controller.undo();
		await controller.redo();
		expect(metrics.slice(3)).toEqual(["undo_committed", "redo_committed"]);

		const exteriorRoomCorners = [
			{ xMm: 6500, zMm: 5000 },
			{ xMm: 6500, zMm: 6500 },
			{ xMm: 5000, zMm: 6500 },
			{ xMm: 5000, zMm: 5000 },
		];
		metrics.length = 0;
		for (const [index, end] of exteriorRoomCorners.slice(1).entries()) {
			const start = exteriorRoomCorners[index];
			if (!start) throw new Error("Expected contiguous exterior walls.");
			await expect(controller.addGeneralWall({ start, end, thicknessMm: 100 }))
				.resolves.toMatchObject({ kind: "durable" });
		}
		expect(metrics).toEqual(["wall_added", "wall_added", "wall_added", "room_created"]);
	});

	it("routes an automatic Room-height split through one durable revision", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			publishNextRevision: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"divider-bottom",
			"divider-top",
			"bottom-tail",
			"top-tail",
			"divider",
			"room-left",
			"revision-3",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{ addGeneralWall: new AddGeneralWallToProjectUseCase(dependencies) },
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2750",
			widthMm: "4000",
		});

		await expect(
			controller.addGeneralWall({
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});
		const candidate = published.at(-1);
		if (candidate?.project.schemaVersion !== 1) {
			throw new Error("Expected the V1 wall-split publication");
		}
		expect(candidate.project.level.rooms).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ heightMm: 2750, roomId: "room-left" }),
				expect.objectContaining({ heightMm: 2750, roomId: "room-1" }),
			]),
		);
	});

	it("routes a selected wall-thickness edit through the canonical v1 mutation boundary", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			publishNextRevision: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"revision-3",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
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
				changeGeneralWallThickness: new ChangeGeneralWallThicknessUseCase(
					dependencies,
				),
			},
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		await expect(
			controller.changeGeneralWallThickness({
				thicknessMm: 200,
				wallSegmentId: "wall-1",
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});
		const candidate = published.at(-1);
		if (candidate?.project.schemaVersion !== 1) {
			throw new Error("Expected the V1 wall-thickness publication");
		}
		expect(candidate.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ thicknessMm: 200, wallSegmentId: "wall-1" }),
			]),
		);
		expect(candidate.project.level.rooms).toEqual([
			expect.objectContaining({ heightMm: 2600, roomId: "room-1" }),
		]);
	});

	it("publishes selected Room properties and keeps that revision in undo history", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			publishNextRevision: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"revision-3",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			false,
			{ updateRoomProperties: new UpdateRoomPropertiesUseCase(dependencies) },
		);

		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});

		await expect(
			controller.updateRoomProperties({
				heightMm: 2700,
				name: "Кухня",
				roomId: "room-1",
				type: "kitchen",
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				level: {
					rooms: [
						expect.objectContaining({
							heightMm: 2700,
							name: "Кухня",
							type: "kitchen",
						}),
					],
				},
			},
			revisionId: "revision-3",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
		expect(published).toHaveLength(3);
	});

	it("publishes a declared item color through the canonical controller boundary and records Undo", async () => {
		const published: import("../application/ports").DurablePublicationCandidate[] =
			[];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async (candidate) => {
				published.push(candidate);
				return { kind: "durable" };
			},
			publishNextRevision: async (candidate, expectedBaseRevisionId) => {
				expect(expectedBaseRevisionId).toBe(published.at(-1)?.revision.revisionId);
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const idValues = [
			"level-1",
			"project-1",
			"revision-1",
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
			"revision-2",
			"item-1",
			"revision-3",
			"revision-4",
		];
		let index = 0;
		const dependencies = {
			checksum: { sha256: async () => "sum:valid" },
			clock,
			ids: { next: () => idValues[index++] ?? `extra-${index}` },
			repository,
			serializer: canonicalProjectSerializer,
		};
		const controller = new ProjectController(
			new CreateProjectUseCase(dependencies),
			repository,
			new ConfigureRectangularRoomUseCase(dependencies),
			undefined,
			new CreateParametricFloorItemUseCase(dependencies),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
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
				recolorFloorItem: new RecolorParametricFloorItemUseCase(dependencies),
			} as never,
		);
		const recoloringController = controller as typeof controller & {
			recolorParametricFloorItem(input: {
				readonly assetInstanceId: string;
				readonly variantId: "alpha-blue";
			}): Promise<unknown>;
		};

		const metrics: string[] = [];
		controller.subscribeProductMetrics((metric) => metrics.push(metric));
		await controller.open();
		await controller.create("Квартира");
		await controller.configureRectangularRoom({
			depthMm: "3000",
			heightMm: "2600",
			widthMm: "4000",
		});
		await controller.createParametricFloorItem({
			color: "#a76a3b",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 1500,
			zMm: 1500,
		});

		await expect(
			recoloringController.recolorParametricFloorItem({
				assetInstanceId: "item-1",
				variantId: "alpha-blue",
			}),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-4",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			project: {
				assetInstances: [
					expect.objectContaining({
						assetInstanceId: "item-1",
						color: "#416b91",
						colorVariantId: "alpha-blue",
					}),
				],
			},
			revisionId: "revision-4",
		});
		expect(controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: true,
		});
		expect(published).toHaveLength(4);
		expect(metrics).toEqual(["project_created", "room_created", "item_placed", "item_color_changed"]);
		await expect(recoloringController.recolorParametricFloorItem({
			assetInstanceId: "item-1",
			variantId: "alpha-blue",
		})).resolves.toMatchObject({ kind: "durable" });
		expect(metrics).toHaveLength(4);
	});

	it("reloads the actual Durable Revision after a deletion CAS rejects the previewed base", async () => {
		const previewed = directoryCandidate(
			"project-1",
			"Просмотренная версия",
			"revision-previewed",
		);
		const current: PublicationCandidate = {
			project: {
				...previewed.project,
				name: "Актуальная версия",
				updatedAt: "2026-08-15T14:05:00.000Z",
			},
			revision: {
				...previewed.revision,
				createdAt: "2026-08-15T14:05:00.000Z",
				revisionId: "revision-current",
			},
		};
		let loads = 0;
		let executions = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({
				kind: "durable",
				candidate: loads++ === 0 ? previewed : current,
			}),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createCanonicalMutationController(repository, {
			deleteGeneralWall: {
				execute: async (
					base: PublicationCandidate,
					_input: { readonly wallSegmentId: string },
					onStatus: (status: GeneralWallProjectMutationStatus) => void,
				) => {
					executions += 1;
					onStatus({
						candidate: base,
						kind: "stale-base",
						reasonCode: "STALE_BASE_REVISION",
					});
					return {
						kind: "stale-base",
						reasonCode: "STALE_BASE_REVISION",
					};
				},
			} as never,
		});

		await controller.open();
		await expect(
			controller.deleteGeneralWall({
				previewRevisionId: "revision-previewed",
				wallSegmentId: "wall-1",
			}),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(executions).toBe(1);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Актуальная версия",
			revisionId: "revision-current",
		});
		await expect(
			controller.deleteGeneralWall({
				previewRevisionId: "revision-previewed",
				wallSegmentId: "wall-1",
			}),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(executions).toBe(1);
	});

	it("does not confirm a wall-split host removal after its preview revision changed", async () => {
		const previewed = directoryCandidate(
			"project-1",
			"Просмотренная версия",
			"revision-previewed",
		);
		let executions = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: previewed }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createCanonicalMutationController(repository, {
			splitGeneralWall: {
				resolveHostConflict: async () => {
					executions += 1;
					return {
						kind: "durable" as const,
						projectId: "project-1",
						revisionId: "revision-unexpected",
					};
				},
			} as never,
		});

		await controller.open();
		await expect(
			controller.resolveHostConflictAndSplitWall({
				itemIds: ["panel-1"],
				openingIds: [],
				pointMm: { xMm: 2000, zMm: 0 },
				previewRevisionId: "revision-other",
				wallSegmentId: "wall-1",
			}),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(executions).toBe(0);
	});

	it("reloads the actual Durable Revision after a wall-panel CAS rejection", async () => {
		const previewed = directoryCandidate(
			"project-1",
			"Просмотренная версия",
			"revision-previewed",
		);
		const current: PublicationCandidate = {
			project: {
				...previewed.project,
				name: "Актуальная версия",
				updatedAt: "2026-08-15T14:05:00.000Z",
			},
			revision: {
				...previewed.revision,
				createdAt: "2026-08-15T14:05:00.000Z",
				revisionId: "revision-current",
			},
		};
		let loads = 0;
		let executions = 0;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({
				kind: "durable",
				candidate: loads++ === 0 ? previewed : current,
			}),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const controller = createCanonicalMutationController(repository, {
			createParametricWallItem: {
				execute: async (
					base: PublicationCandidate,
					_input: unknown,
					onStatus: (
						status: import("../application/create-parametric-wall-item").CreateParametricWallItemStatus,
					) => void,
				) => {
					executions += 1;
					onStatus({
						candidate: base,
						kind: "stale-base",
						reasonCode: "STALE_BASE_REVISION",
					});
					return {
						kind: "stale-base" as const,
						reasonCode: "STALE_BASE_REVISION" as const,
					};
				},
			} as never,
		});

		await controller.open();
		await expect(
			controller.createParametricWallItem({
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2000,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			}),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(executions).toBe(1);
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Актуальная версия",
			revisionId: "revision-current",
		});
	});
});

function leaseRefreshGate() {
	let release = () => {};
	let entered = () => {};
	const blocked = new Promise<void>((resolve) => {
		release = resolve;
	});
	const reached = new Promise<void>((resolve) => {
		entered = resolve;
	});
	return {
		reached: async () => {
			let timeout: ReturnType<typeof setTimeout> | undefined;
			try {
				await Promise.race([
					reached,
					new Promise<void>((_, reject) => {
						timeout = setTimeout(
							() =>
								reject(
									new Error("Expected controlled boundary was not reached"),
								),
							1000,
						);
					}),
				]);
			} finally {
				if (timeout !== undefined) clearTimeout(timeout);
			}
		},
		release: () => release(),
		wait: async () => {
			entered();
			await blocked;
		},
	};
}

async function pendingLeaseRefreshFixture(
	options: {
		readonly boundary?: "inspection" | "load" | "resources";
		readonly heldPublication?: boolean;
		readonly publishes?: boolean;
		readonly failAt?: "inspection" | "load";
	} = {},
) {
	const pause = leaseRefreshGate(),
		publicationPause = leaseRefreshGate(),
		resourceBytes = Uint8Array.of(1, 2, 3);
	const binaryChecksum: BinaryChecksumPort = {
		sha256Bytes: async (bytes) => {
			const module = "node:crypto";
			const native: {
				createHash(kind: string): {
					update(bytes: Uint8Array): { digest(kind: string): string };
				};
			} = await import(module);
			return native.createHash("sha256").update(bytes).digest("hex");
		},
	};
	const resourceHash = await binaryChecksum.sha256Bytes(resourceBytes),
		base = directoryCandidate(
			"project-1",
			"Durable before lease loss",
			"revision-1",
		);
	const original: PublicationCandidate =
		options.boundary === "resources"
			? {
					...base,
					project: {
						...base.project,
						assetDefinitionRefs: [
							{
								assetDefinitionId: "local-model",
								displayName: "Local model",
								resourceHash,
								byteLength: 3,
								format: "glb",
								widthMm: 100,
								depthMm: 100,
								heightMm: 100,
							},
						],
					},
				}
			: base;
	let durable: DurablePublicationCandidate = original,
		loads = 0,
		inspections = 0,
		reads = 0,
		publications = 0;
	const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
		loadCurrent: async () => ({ kind: "durable", candidate: durable }),
		publish: async () => ({ kind: "durable" }),
		recover: async () => ({ kind: "recovered" }),
		publishNextRevision: async (candidate) => {
			publications++;
			if (options.heldPublication) await publicationPause.wait();
			if (options.publishes) {
				durable = candidate;
				return { kind: "durable" };
			}
			return {
				kind: "persist-failed",
				reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
			};
		},
	};
	const directory: ProjectDirectoryPort = {
		listProjects: async () => ({ kind: "empty" }),
		loadProject: async () => {
			const captured = durable;
			if (++loads === 2) {
				if (options.failAt === "load")
					throw new Error("Controlled directory unavailable");
				if (options.boundary === "load") await pause.wait();
			}
			return { kind: "durable", candidate: captured };
		},
	};
	const leases: WriterLeaseControllerPort = {
		consumeLostWriterLease: () => false,
		inspectWriterAccess: async () => {
			if (++inspections === 1) return { kind: "writable" };
			if (options.failAt === "inspection")
				throw new Error("Controlled lease inspection unavailable");
			if (options.boundary === "inspection") await pause.wait();
			return { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" };
		},
		takeOverWriterLease: async () => ({ kind: "writable" }),
	};
	const resources: CustomAssetResourceStorePort = {
		delete: async () => {
			throw new Error("Lease refresh must not delete resources");
		},
		writeIfAbsent: async () => {
			throw new Error("Lease refresh must not write resources");
		},
		read: async (hash) => {
			expect(hash).toBe(resourceHash);
			if (++reads === 2 && options.boundary === "resources") await pause.wait();
			return resourceBytes.slice();
		},
	};
	const rename = new RenameProjectUseCase({
		repository,
		checksum: {
			sha256: async (text) =>
				binaryChecksum.sha256Bytes(new TextEncoder().encode(text)),
		},
		clock,
		ids: { next: () => "pending-rename-revision" },
		serializer: canonicalProjectSerializer,
	});
	const controller = createController(
		repository,
		undefined,
		directory,
		rename,
		undefined,
		undefined,
		resources,
		binaryChecksum,
		undefined,
		leases,
	);
	await controller.openProject(original.project.projectId);
	return {
		controller,
		original,
		repository,
		pause,
		publicationPause,
		counts: () => ({ loads, reads, publications }),
	};
}

for (const phase of ["saving", "persist-failed"] as const) {
	it(`keeps ${phase} and the exact recovery draft visible when a resumed lease becomes read-only`, async () => {
		const fixture = await pendingLeaseRefreshFixture({ heldPublication: true }),
			{ controller } = fixture;
		const renaming = controller.renameProject("Unpublished retained rename");
		await fixture.publicationPause.reached();
		if (phase === "persist-failed") {
			fixture.publicationPause.release();
			await renaming;
		}
		const announced: { kind: ProjectScreenState["kind"]; access: string }[] =
			[];
		const unsubscribe = controller.subscribe((state) =>
			announced.push({
				kind: state.kind,
				access: controller.writerAccess().kind,
			}),
		);
		await expect(controller.refreshWriterLeaseAccess()).resolves.toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: phase,
			project: { name: fixture.original.project.name },
			revisionId: "revision-1",
		});
		expect(controller.hasPendingPublication()).toBe(phase === "saving");
		expect(announced.some((event) => event.kind === "saved")).toBe(false);
		expect(announced).toContainEqual({ kind: phase, access: "read-only" });
		expect(fixture.counts().loads).toBe(1);
		fixture.publicationPause.release();
		await renaming;
		expect(controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
		});
		expect(
			await controller.renameProject("Must not replace retained work"),
		).toEqual({ kind: "in-progress" });
		const recovery = await controller.exportRecoveryDraft();
		expect(recovery.kind).toBe("ready");
		if (recovery.kind !== "ready")
			throw new Error("Lost unpublished recovery draft");
		expect(JSON.parse(new TextDecoder().decode(recovery.bytes))).toMatchObject({
			durability: "unpublished",
			candidate: {
				project: { name: "Unpublished retained rename" },
				revision: { revisionId: "pending-rename-revision" },
			},
		});
		expect(await fixture.repository.loadCurrent()).toEqual({
			kind: "durable",
			candidate: fixture.original,
		});
		unsubscribe();
	});
}

for (const boundary of ["inspection", "load", "resources"] as const) {
	it(`does not hide a quota-failed rename that starts during delayed readonly ${boundary}`, async () => {
		const fixture = await pendingLeaseRefreshFixture({ boundary }),
			{ controller } = fixture;
		const refreshing = controller.refreshWriterLeaseAccess();
		await fixture.pause.reached();
		await controller.renameProject("Retained after delayed refresh");
		const failed = controller.snapshot();
		expect(failed.kind).toBe("persist-failed");
		fixture.pause.release();
		await refreshing;
		expect(controller.snapshot()).toStrictEqual(failed);
		expect(controller.writerAccess()).toEqual({
			kind: "read-only",
			reasonCode: "WRITER_LEASE_HELD",
		});
		const recovery = await controller.exportRecoveryDraft();
		if (recovery.kind !== "ready")
			throw new Error("Lost delayed recovery draft");
		expect(JSON.parse(new TextDecoder().decode(recovery.bytes))).toMatchObject({
			candidate: { project: { name: "Retained after delayed refresh" } },
		});
	});
}

for (const boundary of ["load", "resources"] as const) {
	it(`does not replace a newer durable command with the stale result of readonly ${boundary}`, async () => {
		const fixture = await pendingLeaseRefreshFixture({
				boundary,
				publishes: true,
			}),
			{ controller } = fixture;
		const refreshing = controller.refreshWriterLeaseAccess();
		await fixture.pause.reached();
		await controller.renameProject("New durable after refresh began");
		const saved = controller.snapshot();
		expect(saved).toMatchObject({
			kind: "saved",
			projectName: "New durable after refresh began",
			revisionId: "pending-rename-revision",
		});
		fixture.pause.release();
		await refreshing;
		expect(controller.snapshot()).toStrictEqual(saved);
		expect(controller.hasPendingPublication()).toBe(false);
		expect(await fixture.repository.loadCurrent()).toMatchObject({
			kind: "durable",
			candidate: { project: { name: "New durable after refresh began" } },
		});
	});
}

it("returns stable not-ready lease refresh when no current Project or writer controller exists", async () => {
	const repository: ProjectRepositoryPort = {
		loadCurrent: async () => ({ kind: "empty" }),
		publish: async () => ({ kind: "durable" }),
		recover: async () => ({ kind: "recovered" }),
	};
	const controller = createController(repository);
	expect(await controller.refreshWriterLeaseAccess()).toEqual({
		kind: "not-ready",
	});
	await controller.create("Durable without writer service");
	expect(await controller.refreshWriterLeaseAccess()).toEqual({
		kind: "not-ready",
	});
	expect(controller.snapshot()).toMatchObject({
		kind: "saved",
		projectName: "Durable without writer service",
	});
});

it("announces newly writable access to subscribers while preserving the existing durable status", async () => {
	const repository: ProjectRepositoryPort = {
		loadCurrent: async () => ({ kind: "empty" }),
		publish: async () => ({ kind: "durable" }),
		recover: async () => ({ kind: "recovered" }),
	};
	const leases: WriterLeaseControllerPort = {
		consumeLostWriterLease: () => false,
		inspectWriterAccess: async () => ({ kind: "writable" }),
		takeOverWriterLease: async () => ({ kind: "writable" }),
	};
	const controller = createController(
		repository,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		leases,
	);
	await controller.create("Existing durable status");
	const before = controller.snapshot(),
		announced: { state: ProjectScreenState; access: string }[] = [];
	controller.subscribe((state) =>
		announced.push({ state, access: controller.writerAccess().kind }),
	);
	expect(await controller.refreshWriterLeaseAccess()).toEqual({
		kind: "writable",
	});
	expect(announced).toContainEqual({ state: before, access: "writable" });
	expect(controller.snapshot()).toStrictEqual(before);
});

for (const failAt of ["inspection", "load"] as const) {
	it(`keeps the existing project and truthful writer outcome when resumed ${failAt} throws`, async () => {
		const fixture = await pendingLeaseRefreshFixture({ failAt }),
			{ controller } = fixture;
		const before = controller.snapshot();
		expect(await controller.refreshWriterLeaseAccess()).toEqual(
			failAt === "inspection"
				? { kind: "writable" }
				: { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" },
		);
		expect(controller.snapshot()).toStrictEqual(before);
		expect(await fixture.repository.loadCurrent()).toEqual({
			kind: "durable",
			candidate: fixture.original,
		});
	});
}

for (const boundary of ["resources", "inspection"] as const) {
	it(`revokes a stale ordinary open across delayed ${boundary} without acquiring or replacing the newly selected Project`, async () => {
		const pause = leaseRefreshGate(),
			bytes = Uint8Array.of(8, 9),
			inspections: string[] = [];
		const binaryChecksum: BinaryChecksumPort = {
			sha256Bytes: async (value) =>
				Array.from(
					new Uint8Array(
						await crypto.subtle.digest("SHA-256", new Uint8Array(value).buffer),
					),
					(byte) => byte.toString(16).padStart(2, "0"),
				).join(""),
		};
		const hash = await binaryChecksum.sha256Bytes(bytes),
			original = directoryCandidate("first", "First Project", "revision-first"),
			second = directoryCandidate(
				"second",
				"Selected second Project",
				"revision-second",
			);
		const first: PublicationCandidate =
			boundary === "resources"
				? {
						...original,
						project: {
							...original.project,
							assetDefinitionRefs: [
								{
									assetDefinitionId: "model",
									displayName: "Model",
									format: "glb",
									resourceHash: hash,
									byteLength: bytes.length,
									widthMm: 100,
									heightMm: 100,
									depthMm: 100,
								},
							],
						},
					}
				: original;
		const repository: ProjectRepositoryPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const directory: ProjectDirectoryPort = {
			listProjects: async () => ({ kind: "empty" }),
			loadProject: async (id) => ({
				kind: "durable",
				candidate: id === "first" ? first : second,
			}),
		};
		const leases: WriterLeaseControllerPort = {
			consumeLostWriterLease: () => false,
			takeOverWriterLease: async () => ({ kind: "writable" }),
			inspectWriterAccess: async (id) => {
				inspections.push(id);
				if (id === "first" && boundary === "inspection") await pause.wait();
				return { kind: "writable" };
			},
		};
		const resources: CustomAssetResourceStorePort = {
			read: async () => {
				await pause.wait();
				return bytes.slice();
			},
			delete: async () => {
				throw new Error("No deletion during open");
			},
			writeIfAbsent: async () => {
				throw new Error("No resource write during open");
			},
		};
		const controller = createController(
			repository,
			undefined,
			directory,
			undefined,
			undefined,
			undefined,
			resources,
			binaryChecksum,
			undefined,
			leases,
		);
		const opening = controller.openProject("first");
		await pause.reached();
		await controller.openProject("second");
		const selected = controller.snapshot();
		expect(selected).toMatchObject({
			kind: "saved",
			projectName: "Selected second Project",
		});
		pause.release();
		await opening;
		expect(controller.snapshot()).toStrictEqual(selected);
		expect(inspections).toEqual(
			boundary === "resources" ? ["second"] : ["first", "second"],
		);
	});
}
