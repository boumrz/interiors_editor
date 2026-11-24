import { describe, expect, it } from "@rstest/core";
import { BrowserRegisteredTransferDecoder } from "../adapters/portable-backup/browser-registered-transfer-decoder";
import {
	DurableProjectRepository,
	MemoryVersionedProjectStore,
} from "../adapters/persistence/durable-project-repository";
import { FencedProjectRepository } from "../adapters/persistence/fenced-project-repository";
import { canonicalProjectSerializer } from "../application/create-project";
import { ExportRuntimePortableBackupUseCase } from "../application/export-runtime-portable-backup";
import type { CustomAssetResourceStorePort } from "../application/ports";
import type { ImportPortableBackupStatus } from "../application/import-portable-backup";
import { validateRuntimeV1Project } from "../application/runtime-v1-project-validation";
import { createRegisteredRuntimePortablePorts } from "../adapters/portable-backup/registered-runtime-portable";
import { FflatePortableBackupDecoder } from "../adapters/portable-backup/fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../adapters/portable-backup/portable-backup-read-render-smoke";
import { unzipSync, zipSync } from "fflate";
import { createInitialProject } from "../domain/initial-project";
import type { CustomGlbAssetDefinition, Project } from "../domain/project";
import { exportRecoveryDraft } from "./project-recovery";
import {
	createSharedProjectController,
	type SharedProjectControllerDependencies,
} from "./shared-project-controller";

const instant = "2026-11-04T12:34:56.000Z";
async function sha256Bytes(bytes: Uint8Array): Promise<string> {
	const hash = await crypto.subtle.digest(
		"SHA-256",
		new Uint8Array(bytes).buffer,
	);
	return [...new Uint8Array(hash)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
const checksum = {
	sha256: (value: string) => sha256Bytes(new TextEncoder().encode(value)),
};

function fixture(overrides: Partial<SharedProjectControllerDependencies> = {}) {
	const store = new MemoryVersionedProjectStore({ nowEpochMs: () => 1000 });
	const durable = new DurableProjectRepository(store, checksum.sha256);
	const repository = new FencedProjectRepository(
		durable,
		store,
		"shared-test-owner",
	);
	const bytes = new Map<string, Uint8Array>();
	let nextId = 0;
	const resources: CustomAssetResourceStorePort = {
		read: async (hash) => bytes.get(hash)?.slice(),
		delete: async (hash) => {
			bytes.delete(hash);
		},
		writeIfAbsent: async (resource) => {
			if (bytes.has(resource.resourceHash)) return { kind: "already-present" };
			bytes.set(resource.resourceHash, resource.bytes.slice());
			return { kind: "stored" };
		},
	};
	const dependencies: SharedProjectControllerDependencies = {
		repository,
		resources,
		library: {
			list: async () => [],
			register: async (asset) => ({ kind: "registered", asset }),
		},
		pinStaging: {
			begin: async (resourceHashes) => ({
				leaseId: "test-pin",
				resourceHashes,
			}),
			markForPublication: async () => undefined,
			complete: async () => undefined,
			discard: async () => undefined,
		},
		checksum,
		binaryChecksum: { sha256Bytes },
		clock: { now: () => instant },
		ids: { next: () => `shared-${++nextId}` },
		storageEstimate: { estimateStorage: async () => ({}) },
		portable: {
			encoder: { encode: () => Uint8Array.of(80, 75) },
			decoder: {
				decode: async () => ({
					kind: "rejected",
					reasonCode: "PORTABLE_BACKUP_INVALID",
				}),
			},
			smoke: { verify: async () => true },
		},
		...overrides,
	};
	return {
		bytes,
		dependencies,
		durable,
		repository,
		store,
		runtime: createSharedProjectController(dependencies),
	};
}

describe("rename a project from the directory", () => {
	it("publishes exactly the selected card without entering the editor or changing geometry and other cards", async () => {
		const { runtime, repository } = fixture();
		const { controller } = runtime;
		const selected = await controller.create("Первая комната");
		if (selected.kind !== "durable") throw new Error("Selected project required");
		await controller.configureRectangularRoom({ widthMm: "4000", depthMm: "3000", heightMm: "2600" });
		const base = await repository.loadProject(selected.projectId);
		if (base.kind !== "durable") throw new Error("Base revision required");
		const other = await controller.create("Вторая комната");
		if (other.kind !== "durable") throw new Error("Second project required");
		await controller.showProjects();
		const screens: string[] = [];
		controller.subscribe(state => screens.push(state.kind));

		const result = await controller.renameProjectFromDirectory(selected.projectId, base.candidate.revision.revisionId, "  Гостиная  ");
		expect(result).toMatchObject({ kind: "durable", projectId: selected.projectId });
		if (result.kind !== "durable") throw new Error("Published revision required");
		expect(result.revisionId).not.toBe(base.candidate.revision.revisionId);
		expect(screens).toEqual(["projects"]);
		expect(controller.currentRevisionIdentity()).toBeUndefined();
		expect(controller.sessionHistory()).toEqual({ canUndo: false, canRedo: false });
		expect(controller.snapshot()).toMatchObject({
			kind: "projects",
			projects: expect.arrayContaining([
				expect.objectContaining({ projectId: selected.projectId, name: "Гостиная", revisionId: result.revisionId }),
				expect.objectContaining({ projectId: other.projectId, name: "Вторая комната", revisionId: other.revisionId }),
			]),
		});
		const after = await repository.loadProject(selected.projectId);
		expect(after).toMatchObject({ kind: "durable", candidate: { project: { ...base.candidate.project, name: "Гостиная" } } });
	});

	it("validates the card revision and keeps it read-only when another writer owns it", async () => {
		const { runtime, durable, store, repository } = fixture();
		const { controller } = runtime;
		const selected = await controller.create("Сохранённый проект");
		if (selected.kind !== "durable") throw new Error("Selected project required");
		await controller.showProjects();
		const hub = controller.snapshot();
		expect(await controller.renameProjectFromDirectory(selected.projectId, "obsolete", "New name")).toMatchObject({ kind: "stale-base" });
		expect(await controller.renameProjectFromDirectory(selected.projectId, selected.revisionId, "  ")).toMatchObject({ kind: "rejected", reasonCode: "PROJECT_NAME_REQUIRED" });
		const contender = new FencedProjectRepository(durable, store, "another-owner");
		await contender.takeOverWriterLease(selected.projectId);
		expect(await controller.renameProjectFromDirectory(selected.projectId, selected.revisionId, "New name")).toEqual({ kind: "read-only" });
		expect(controller.snapshot()).toBe(hub);
		expect(await repository.loadProject(selected.projectId)).toMatchObject({ kind: "durable", candidate: { revision: { revisionId: selected.revisionId } } });
	});

	it("allows opening a card for repair when pinned models prevent its rename", async () => {
		for (const damage of ["missing custom model", "corrupt catalog model"] as const) {
			const { bytes, repository, runtime } = fixture();
			const source = await sourceWithResource();
			const project = damage === "missing custom model" ? source.project : {
				...source.project,
				assetDefinitionRefs: [{
					...source.asset,
					catalogAssetId: "test-catalog-model",
					catalogEnvelopeHash: "a".repeat(64),
					catalogVersion: "test-catalog-v1",
					source: "CatalogVersion" as const,
				}],
			};
			const serializedProject = canonicalProjectSerializer.serialize(project);
			const revision = {
				projectId: project.projectId,
				revisionId: "saved-with-model",
				createdAt: instant,
				schemaVersion: 1 as const,
				serializedProject,
				checksum: await checksum.sha256(serializedProject),
			};
			bytes.set(source.hash, source.bytes);
			expect(await repository.publish({ project, revision })).toEqual({ kind: "durable" });
			if (damage === "missing custom model") bytes.delete(source.hash);
			else bytes.set(source.hash, new Uint8Array(source.bytes.byteLength).fill(9));

			const { controller } = runtime;
			await controller.showProjects();
			const hub = controller.snapshot();
			expect(await controller.renameProjectFromDirectory(project.projectId, revision.revisionId, "New title")).toEqual({
				kind: "resources-unavailable",
			});
			expect(controller.snapshot()).toBe(hub);
			expect(await controller.retryDirectoryProjectRename()).toEqual({ kind: "not-ready" });
			expect(await repository.loadProject(project.projectId)).toMatchObject({ kind: "durable", candidate: { project, revision } });
			await controller.openProject(project.projectId);
			expect(controller.snapshot().kind).toBe("recovery-needed");
		}
	});

	it("retains the exact candidate on failed publication and retries it in the directory", async () => {
		const { runtime, repository } = fixture();
		const { controller } = runtime;
		const selected = await controller.create("Первоначальное имя");
		if (selected.kind !== "durable") throw new Error("Selected project required");
		await controller.showProjects();
		const hub = controller.snapshot();
		const publish = repository.publishNextRevision.bind(repository);
		const attempted: string[] = [];
		repository.publishNextRevision = async (candidate, base) => {
			expect(base).toBe(selected.revisionId);
			attempted.push(candidate.revision.revisionId);
			return attempted.length === 1
				? { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" }
				: publish(candidate, base);
		};
		expect(await controller.renameProjectFromDirectory(selected.projectId, selected.revisionId, "Гостиная")).toEqual({
			kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED", retryAvailable: true,
		});
		expect(controller.snapshot()).toBe(hub);
		expect(await controller.renameProjectFromDirectory(selected.projectId, selected.revisionId, "Другой кандидат")).toEqual({ kind: "in-progress" });
		await controller.openProject(selected.projectId);
		expect(controller.snapshot()).toBe(hub);
		expect(await controller.retryDirectoryProjectRename()).toMatchObject({ kind: "durable", projectId: selected.projectId });
		expect(attempted).toEqual([attempted[0], attempted[0]]);
		expect(controller.snapshot()).toMatchObject({ kind: "projects", projects: [expect.objectContaining({ name: "Гостиная" })] });
	});

	it("keeps the directory visible and blocks concurrent commands while the rename is publishing", async () => {
		const { runtime, repository } = fixture();
		const { controller } = runtime;
		const selected = await controller.create("Сохранённый проект");
		if (selected.kind !== "durable") throw new Error("Selected project required");
		await controller.showProjects();
		const hub = controller.snapshot();
		let markStarted!: () => void;
		let releaseWrite!: () => void;
		const started = new Promise<void>((resolve) => { markStarted = resolve; });
		const release = new Promise<void>((resolve) => { releaseWrite = resolve; });
		const publish = repository.publishNextRevision.bind(repository);
		repository.publishNextRevision = async (candidate, base) => {
			markStarted();
			await release;
			return publish(candidate, base);
		};

		const rename = controller.renameProjectFromDirectory(selected.projectId, selected.revisionId, "Кухня");
		await started;
		try {
			expect(controller.hasPendingPublication()).toBe(true);
			expect(await controller.retryDirectoryProjectRename()).toEqual({ kind: "in-progress" });
			await controller.openProject(selected.projectId);
			controller.startNewProject();
			await controller.showProjects();
			expect(controller.snapshot()).toBe(hub);
		} finally {
			releaseWrite();
		}
		expect(await rename).toMatchObject({ kind: "durable", projectId: selected.projectId });
		expect(controller.hasPendingPublication()).toBe(false);
	});

	it("refreshes a stale card from storage without overwriting the newer project", async () => {
		const { runtime, dependencies, repository } = fixture();
		const { controller } = runtime;
		const selected = await controller.create("Название из списка");
		if (selected.kind !== "durable") throw new Error("Selected project required");
		await controller.showProjects();
		const writer = createSharedProjectController(dependencies).controller;
		await writer.openProject(selected.projectId);
		const external = await writer.renameProject("Актуальное название");
		if (external.kind !== "durable") throw new Error("Newer project required");

		expect(await controller.renameProjectFromDirectory(selected.projectId, selected.revisionId, "Устаревшая правка")).toEqual({
			kind: "stale-base", reasonCode: "STALE_BASE_REVISION",
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "projects",
			projects: [expect.objectContaining({ name: "Актуальное название", revisionId: external.revisionId })],
		});
		expect(await repository.loadProject(selected.projectId)).toMatchObject({
			kind: "durable", candidate: { revision: { revisionId: external.revisionId } },
		});
	});

	it("accepts the exact durable result after a failed write acknowledgement", async () => {
		const { runtime, repository } = fixture();
		const { controller } = runtime;
		const selected = await controller.create("До переименования");
		if (selected.kind !== "durable") throw new Error("Selected project required");
		await controller.showProjects();
		const publish = repository.publishNextRevision.bind(repository);
		repository.publishNextRevision = async (candidate, base) => {
			expect(await publish(candidate, base)).toEqual({ kind: "durable" });
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		};
		const result = await controller.renameProjectFromDirectory(selected.projectId, selected.revisionId, "После переименования");
		expect(result).toMatchObject({ kind: "durable", projectId: selected.projectId });
		expect(await controller.retryDirectoryProjectRename()).toEqual({ kind: "not-ready" });
		expect(controller.snapshot()).toMatchObject({ kind: "projects", projects: [expect.objectContaining({ name: "После переименования" })] });
	});
});

function staticGlb(): Uint8Array {
	const json = new TextEncoder().encode('{"asset":{"version":"2.0"}} ');
	const bytes = new Uint8Array(20 + json.byteLength);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.byteLength, true);
	view.setUint32(12, json.byteLength, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.set(json, 20);
	return bytes;
}

describe("registered feasibility composition", () => {
	it("supplies its actual resources to the chosen policy and retains the browser default when omitted", async () => {
		const original = fixture();
		let assessments = 0;
		const { runtime } = fixture({
			resources: original.dependencies.resources,
			portable: {
				...original.dependencies.portable,
				feasibility: {
					assess: async (_candidate, ports) => {
						assessments++;
						expect(ports?.resources).toBe(original.dependencies.resources);
						return {
							kind: "rejected",
							reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
						};
					},
				},
			},
		});
		await runtime.controller.create("Registered route");
		expect(runtime.controller.snapshot()).toMatchObject({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(assessments).toBe(1);
		await original.runtime.controller.create("Existing browser default");
		expect(original.runtime.controller.snapshot().kind).toBe("saved");
	});
});

async function sourceWithResource() {
	const bytes = staticGlb();
	const hash = await sha256Bytes(bytes);
	const asset: CustomGlbAssetDefinition = {
		assetDefinitionId: "custom-shared",
		byteLength: bytes.byteLength,
		depthMm: 100,
		displayName: "Local model",
		format: "glb",
		heightMm: 100,
		resourceHash: hash,
		widthMm: 100,
	};
	const project: Project = {
		...createInitialProject({
			createdAt: instant,
			levelId: "source-level",
			projectId: "source-project",
			name: "Imported model",
		}),
		assetDefinitionRefs: [asset],
	};
	return { asset, bytes, hash, project };
}

describe("shared Project controller composition", () => {
	it("rejects overlapping TMA floor commands before publication, including first and repeated model placement", async () => {
		const { bytes, runtime } = fixture({ floorItemCollisionPolicy: "reject" });
		const { controller } = runtime;
		await controller.open();
		expect(await controller.create("Strict item geometry")).toMatchObject({ kind: "durable" });
		expect(await controller.configureRectangularRoom({
			depthMm: "3000", heightMm: "2600", widthMm: "4000",
		})).toMatchObject({ kind: "durable" });
		const room = controller.snapshot();
		if (room.kind !== "saved" || room.project.schemaVersion !== 1) throw new Error("Expected a kept room");
		const roomId = room.project.level.rooms[0].roomId;
		const item = {
			color: "#416b91", depthMm: 300, heightMm: 800, label: "Стол", roomId,
			widthMm: 1000, xMm: 1200, zMm: 1200,
		};
		const obstacle = { ...item, label: "Стул", widthMm: 500, zMm: 1650 };
		expect(await controller.createParametricFloorItem(item)).toMatchObject({ kind: "durable" });
		expect(await controller.createParametricFloorItem(obstacle)).toMatchObject({ kind: "durable" });
		const before = controller.snapshot();
		const history = controller.sessionRetentionRoots();
		if (before.kind !== "saved") throw new Error("Expected two kept items");
		const assetInstanceId = before.project.assetInstances[0].assetInstanceId;
		const collision = { kind: "rejected", reasonCode: "ITEM_COLLISION" };

		expect(await controller.createParametricFloorItem(obstacle)).toEqual(collision);
		expect(await controller.moveParametricFloorItem({ assetInstanceId, xMm: 1200, zMm: 1650 })).toEqual(collision);
		expect(await controller.rotateParametricFloorItem({ assetInstanceId, exact: true, yawRadians: Math.PI / 2 })).toEqual(collision);
		expect(await controller.resizeParametricFloorItem({ assetInstanceId, widthMm: 1000, depthMm: 1000, heightMm: 800 })).toEqual(collision);

		const glbBytes = staticGlb();
		const asset = {
			assetDefinitionId: "test-local-glb",
			byteLength: glbBytes.byteLength,
			depthMm: 300,
			displayName: "GLB furnishing",
			format: "glb" as const,
			heightMm: 800,
			resourceHash: await sha256Bytes(glbBytes),
			widthMm: 500,
		};
		const imported = { asset, color: obstacle.color, roomId, glbBytes, xMm: 1200, zMm: 1650 };
		expect(await controller.createCustomGlbFloorItem(imported)).toEqual(collision);
		expect(bytes.size).toBe(0);
		expect(controller.snapshot()).toEqual(before);
		expect(controller.sessionRetentionRoots()).toEqual(history);

		expect(await controller.createCustomGlbFloorItem({ ...imported, xMm: 2800 })).toMatchObject({ kind: "durable" });
		expect(bytes.get(asset.resourceHash)).toEqual(glbBytes);
		const afterImport = controller.snapshot();
		expect(await controller.createParametricFloorItem({
			...obstacle, assetDefinitionId: asset.assetDefinitionId, xMm: 2800,
		})).toEqual(collision);
		expect(controller.snapshot()).toEqual(afterImport);
	});

	it("keeps existing overlapping Web projects readable and lets TMA repair and undo the overlap", async () => {
		const { runtime, dependencies } = fixture();
		const legacy = runtime.controller;
		await legacy.open();
		const created = await legacy.create("Old overlap");
		if (created.kind !== "durable") throw new Error("Project creation failed");
		await legacy.configureRectangularRoom({ depthMm: "3000", heightMm: "2600", widthMm: "4000" });
		const room = legacy.snapshot();
		if (room.kind !== "saved" || room.project.schemaVersion !== 1) throw new Error("Expected a kept room");
		const pose = {
			color: "#416b91", depthMm: 500, heightMm: 800, label: "Стул", roomId: room.project.level.rooms[0].roomId,
			widthMm: 500, xMm: 1200, zMm: 1200,
		};
		await legacy.createParametricFloorItem(pose);
		expect(await legacy.createParametricFloorItem(pose)).toMatchObject({
			kind: "durable", warnings: [{ kind: "item" }],
		});
		const before = legacy.snapshot();
		await legacy.showProjects();
		const strict = createSharedProjectController({ ...dependencies, floorItemCollisionPolicy: "reject" }).controller;
		await strict.openProject(created.projectId);
		expect(strict.snapshot()).toEqual(before);
		if (before.kind !== "saved" || before.project.schemaVersion !== 1) throw new Error("Legacy overlap unavailable");
		expect(validateRuntimeV1Project(before.project)).toMatchObject({ kind: "accepted" });
		const assetInstanceId = before.project.assetInstances[0].assetInstanceId;

		expect(await strict.moveParametricFloorItem({ assetInstanceId, xMm: 1300, zMm: 1200 })).toEqual({
			kind: "rejected", reasonCode: "ITEM_COLLISION",
		});
		expect(await strict.moveParametricFloorItem({ assetInstanceId, xMm: 2400, zMm: 1200 })).toMatchObject({ kind: "durable" });
		expect(await strict.undo()).toMatchObject({ kind: "durable" });
		expect(strict.snapshot()).toEqual(before);
		expect(await strict.redo()).toMatchObject({ kind: "durable" });
	});

	it("aligns saved windows as one undoable revision and reopens the corrected geometry", async () => {
		const { runtime, dependencies } = fixture();
		const { controller } = runtime;
		await controller.open();
		const created = await controller.create("Окна на разной высоте");
		if (created.kind !== "durable") throw new Error("Project creation failed");
		await controller.configureRectangularRoom({ depthMm: "3000", heightMm: "2600", widthMm: "4000" });
		const room = controller.snapshot();
		if (room.kind !== "saved" || room.project.schemaVersion !== 1) throw new Error("Expected a saved room");
		const { wallSegmentId } = room.project.level.wallSegments[0];
		for (const [offsetMm, sillMm] of [[700, 450], [2300, 1000]]) {
			expect(await controller.addWindowOpening({ wallSegmentId, heightMm: 1000, widthMm: 1000, offsetMm, sillMm }))
				.toMatchObject({ kind: "durable" });
		}
		const before = controller.snapshot();
		if (before.kind !== "saved" || before.project.schemaVersion !== 1) throw new Error("Expected saved windows");
		const { openingId } = before.project.level.openings[0];
		const align = { kind: "align-matching-windows", openingId } as const;
		expect(await controller.updateDoorOpening(align)).toMatchObject({ kind: "durable" });
		const after = controller.snapshot();
		if (after.kind !== "saved" || after.project.schemaVersion !== 1) throw new Error("Expected aligned durable windows");
		expect(after.project.level.openings.map(({ sillMm }) => sillMm)).toEqual([900, 900]);
		expect(await controller.updateDoorOpening(align)).toEqual({ kind: "unchanged" });
		expect(await controller.undo()).toMatchObject({ kind: "durable" });
		expect(controller.snapshot()).toEqual(before);
		expect(await controller.redo()).toMatchObject({ kind: "durable" });
		expect(controller.snapshot()).toEqual(after);
		await controller.showProjects();
		const reopened = createSharedProjectController(dependencies).controller;
		await reopened.openProject(created.projectId);
		expect(reopened.snapshot()).toEqual(after);
	});

	it("durably closes a room with an exact short tail, restores it through history and reopens it for independent deletion", async () => {
		const { runtime, dependencies } = fixture();
		const { controller } = runtime;
		await controller.open();
		const created = await controller.create("Room with retained tail");
		if (created.kind !== "durable") throw new Error("Project creation failed");
		for (const [start, end] of [
			[{ xMm: 0, zMm: 0 }, { xMm: 4001, zMm: 0 }],
			[{ xMm: 4000, zMm: 3000 }, { xMm: 0, zMm: 3000 }],
			[{ xMm: 0, zMm: 3000 }, { xMm: 0, zMm: 0 }],
		] as const) {
			expect(await controller.addGeneralWall({ start, end, thicknessMm: 100 })).toMatchObject({ kind: "durable" });
		}
		const before = controller.snapshot();
		expect(await controller.addGeneralWall({ start: { xMm: 4000, zMm: 0 }, end: { xMm: 4000, zMm: 3000 }, thicknessMm: 100 })).toMatchObject({ kind: "durable" });
		const closed = controller.snapshot();
		if (closed.kind !== "saved" || closed.project.schemaVersion !== 1) throw new Error("Room was not saved");
		expect(closed.project.level.rooms).toHaveLength(1);
		expect(closed.project.level.wallSegments).toHaveLength(5);
		expect(await controller.undo()).toMatchObject({ kind: "durable" });
		expect(controller.snapshot()).toEqual(before);
		expect(await controller.redo()).toMatchObject({ kind: "durable" });
		expect(controller.snapshot()).toEqual(closed);
		await controller.showProjects();
		const reopened = createSharedProjectController(dependencies).controller;
		await reopened.openProject(created.projectId);
		expect(reopened.snapshot()).toEqual(closed);
		const end = closed.project.level.vertices.find(vertex => vertex.xMm === 4001 && vertex.zMm === 0);
		const tail = closed.project.level.wallSegments.find(wall => wall.startVertexId === end?.vertexId || wall.endVertexId === end?.vertexId);
		if (!tail) throw new Error("Exact selectable tail missing");
		expect(await reopened.deleteGeneralWall({ wallSegmentId: tail.wallSegmentId, previewRevisionId: closed.revisionId })).toMatchObject({ kind: "durable" });
		const deleted = reopened.snapshot();
		if (deleted.kind !== "saved" || deleted.project.schemaVersion !== 1) throw new Error("Tail deletion failed");
		expect(deleted.project.level.rooms).toEqual(closed.project.level.rooms);
		expect(deleted.project.level.wallSegments).toHaveLength(4);
	});
	it("uses an explicit exact-object backup exporter without invoking the legacy envelope encoder", async () => {
		let exports = 0;
		const { runtime } = fixture({
			portable: {
				encoder: {
					encode: () => {
						throw new Error("Legacy formatter must remain unused");
					},
				},
				decoder: {
					decode: async () => ({
						kind: "rejected",
						reasonCode: "PORTABLE_BACKUP_INVALID",
					}),
				},
				smoke: { verify: async () => true },
				exporter: {
					execute: async (source) => {
						exports++;
						expect(source.project.name).toBe("Exact transfer");
						return {
							kind: "ready",
							bytes: Uint8Array.of(80, 75, 42),
							filename: "wire.interiors",
							mimeType: "application/zip",
						};
					},
				},
			},
		});
		await runtime.controller.create("Exact transfer");
		expect(await runtime.controller.exportPortableBackup()).toEqual({
			kind: "ready",
			bytes: Uint8Array.of(80, 75, 42),
			filename: "wire.interiors",
			mimeType: "application/zip",
		});
		expect(exports).toBe(1);
	});
	it("runs create, first room, rename, undo/redo, reopen and confirmed deletion through supplied ports", async () => {
		const { runtime, dependencies, repository } = fixture();
		const { controller } = runtime;
		await controller.open();
		expect(await controller.create("Shared plan")).toEqual({
			kind: "durable",
			projectId: "shared-2",
			revisionId: "shared-3",
		});
		expect(
			await controller.configureRectangularRoom({
				widthMm: "4000",
				depthMm: "3000",
				heightMm: "2600",
			}),
		).toMatchObject({ kind: "durable" });
		const roomRevision = controller.currentRevisionIdentity();
		expect(await controller.renameProject("Renamed plan")).toMatchObject({
			kind: "durable",
		});
		const renamedRevision = controller.currentRevisionIdentity();
		expect(controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
		expect(await controller.undo()).toEqual({
			kind: "durable",
			revisionId: roomRevision?.revisionId,
		});
		expect(controller.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Shared plan",
		});
		expect(await controller.redo()).toEqual({
			kind: "durable",
			revisionId: renamedRevision?.revisionId,
		});
		const localJson = await controller.exportProjectJson();
		if (localJson.kind !== "ready")
			throw new Error("Expected local JSON export");
		expect(JSON.parse(localJson.content)).toMatchObject({
			project: { projectId: "shared-2", name: "Renamed plan" },
		});
		const reopened = createSharedProjectController(dependencies).controller;
		await reopened.openProject("shared-2");
		expect(reopened.snapshot()).toMatchObject({
			kind: "saved",
			projectName: "Renamed plan",
			project: { createdAt: instant, level: { rooms: [{ heightMm: 2600 }] } },
		});
		expect(reopened.sessionHistory()).toEqual({
			canUndo: false,
			canRedo: false,
		});
		expect(await reopened.permanentlyDeleteCurrentProject()).toEqual({
			kind: "permanently-deleted",
		});
		expect(await repository.loadProject("shared-2")).toEqual({ kind: "empty" });
		expect(reopened.snapshot()).toMatchObject({
			kind: "projects",
			projects: [],
		});
	});

	it("pins and publishes a local custom model placement through the shared controller", async () => {
		const { runtime, repository, bytes } = fixture();
		const source = await sourceWithResource();
		await runtime.controller.create("Placement");
		await runtime.controller.configureRectangularRoom({
			widthMm: "4000",
			depthMm: "3000",
			heightMm: "2600",
		});
		const configured = await repository.loadProject("shared-2");
		if (
			configured.kind !== "durable" ||
			configured.candidate.project.schemaVersion !== 1
		)
			throw new Error("Expected configured room");
		expect(
			await runtime.controller.createCustomGlbFloorItem({
				asset: source.asset,
				glbBytes: source.bytes,
				roomId: configured.candidate.project.level.rooms[0].roomId,
				color: "#716796",
				xMm: 1000,
				zMm: 1000,
			}),
		).toMatchObject({ kind: "durable" });
		expect(bytes.get(source.hash)).toEqual(source.bytes);
		expect(await repository.loadProject("shared-2")).toMatchObject({
			kind: "durable",
			candidate: {
				project: {
					assetDefinitionRefs: [source.asset],
					assetInstances: [
						{
							assetDefinitionId: source.asset.assetDefinitionId,
							anchorClass: "floor",
						},
					],
				},
			},
		});
	});

	it("uses the dedicated recovery encoder when supplied and the portable encoder otherwise", async () => {
		const project = createInitialProject({
			createdAt: instant,
			projectId: "draft-source",
			levelId: "draft-level",
			name: "Unpublished draft",
		});
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const draft = await exportRecoveryDraft({
			project,
			revision: {
				projectId: project.projectId,
				revisionId: "unpublished",
				createdAt: instant,
				schemaVersion: 1,
				serializedProject,
				checksum: await checksum.sha256(serializedProject),
			},
		});
		if (draft.kind !== "ready")
			throw new Error("Expected local unpublished draft");
		for (const dedicated of [false, true]) {
			let encodes = 0;
			const encoder = {
				encode: (entries: Readonly<Record<string, Uint8Array>>) => {
					expect(entries["project/project.json"]).toBeInstanceOf(Uint8Array);
					encodes += 1;
					return Uint8Array.of(80, 75, 4);
				},
			};
			const { runtime } = fixture({
				portable: {
					encoder: dedicated
						? {
								encode: () => {
									throw new Error("Wrong recovery encoder");
								},
							}
						: encoder,
					...(dedicated ? { recoveryEncoder: encoder } : {}),
					decoder: {
						decode: async (bytes) => {
							expect(bytes).toEqual(Uint8Array.of(80, 75, 4));
							return {
								kind: "accepted",
								projectBytes: new TextEncoder().encode(serializedProject),
							};
						},
					},
					smoke: { verify: async () => true },
				},
			});
			expect(await runtime.controller.importRecoveryDraft(draft.bytes)).toEqual(
				{ kind: "durable", projectId: "shared-1", revisionId: "shared-2" },
			);
			expect(encodes).toBe(1);
		}
	});

	it("routes exact-resource repair to the dedicated recovery decoder or its portable fallback", async () => {
		const source = await sourceWithResource();
		const serializedProject = canonicalProjectSerializer.serialize(
			source.project,
		);
		for (const dedicated of [false, true]) {
			const calls: string[] = [];
			const { runtime, repository, bytes } = fixture({
				portable: {
					encoder: { encode: () => Uint8Array.of(80, 75) },
					decoder: {
						decode: async () => {
							calls.push("portable");
							return {
								kind: "rejected",
								reasonCode: "PORTABLE_BACKUP_INVALID",
							};
						},
					},
					...(dedicated
						? {
								recoveryDecoder: {
									decode: async () => {
										calls.push("recovery");
										return {
											kind: "rejected" as const,
											reasonCode: "PORTABLE_BACKUP_FUTURE_SCHEMA" as const,
										};
									},
								},
							}
						: {}),
					smoke: { verify: async () => true },
				},
			});
			bytes.set(source.hash, new Uint8Array(source.bytes.byteLength).fill(9));
			expect(
				await repository.publish({
					project: source.project,
					revision: {
						projectId: source.project.projectId,
						revisionId: "corrupt-resource-source",
						createdAt: instant,
						schemaVersion: 1,
						serializedProject,
						checksum: await checksum.sha256(serializedProject),
					},
				}),
			).toEqual({ kind: "durable" });
			await runtime.controller.openProject(source.project.projectId);
			expect(
				await runtime.controller.repairResourcesFromPortableBackup(
					Uint8Array.of(80, 75),
				),
			).toEqual({
				kind: "rejected",
				reasonCode: dedicated
					? "PORTABLE_BACKUP_FUTURE_SCHEMA"
					: "PORTABLE_BACKUP_INVALID",
			});
			expect(calls).toEqual([dedicated ? "recovery" : "portable"]);
		}
	});

	it("imports verified resources through injected codec, smoke and prepared pins, then exports those exact bytes", async () => {
		const source = await sourceWithResource();
		const events: string[] = [];
		const stored = new Map<string, Uint8Array>();
		let encoded: Readonly<Record<string, Uint8Array>> | undefined;
		const archive = Uint8Array.of(80, 75, 7);
		const { runtime, repository } = fixture({
			resources: {
				read: async (hash) => stored.get(hash)?.slice(),
				delete: async (hash) => {
					stored.delete(hash);
				},
				writeIfAbsent: async () => {
					throw new Error("Unprepared resource write");
				},
				writeIfAbsentPinned: async (resource, leaseId) => {
					expect(leaseId).toBe("prepared-pin");
					events.push("pin");
					stored.set(resource.resourceHash, resource.bytes.slice());
					return { kind: "stored" };
				},
			},
			pinStaging: {
				requiresPublicationContext: true,
				begin: async (resourceHashes, context) => {
					expect(context?.candidate).toMatchObject({
						project: { projectId: "shared-1" },
						revision: { projectId: "shared-1", checksum: expect.any(String) },
					});
					events.push("prepare");
					return { leaseId: "prepared-pin", resourceHashes };
				},
				markForPublication: async () => {
					events.push("mark");
				},
				complete: async () => {
					events.push("complete");
				},
				discard: async () => {
					events.push("discard");
				},
			},
			portable: {
				decoder: {
					decode: async (bytes) => {
						expect(bytes).toEqual(archive);
						events.push("decode");
						return {
							kind: "accepted",
							projectBytes: new TextEncoder().encode(
								canonicalProjectSerializer.serialize(source.project),
							),
							resources: [{ bytes: source.bytes, resourceHash: source.hash }],
						};
					},
				},
				encoder: {
					encode: (entries) => {
						encoded = entries;
						return archive.slice();
					},
				},
				smoke: {
					verify: async (project, resources) => {
						expect(project).toEqual(source.project);
						expect(resources).toEqual([
							{ bytes: source.bytes, resourceHash: source.hash },
						]);
						events.push("smoke");
						return true;
					},
				},
			},
		});
		expect(await runtime.controller.importPortableBackup(archive)).toEqual({
			kind: "durable",
			projectId: "shared-1",
			revisionId: "shared-2",
		});
		expect(events).toEqual([
			"decode",
			"smoke",
			"prepare",
			"pin",
			"mark",
			"complete",
		]);
		const saved = await repository.loadProject("shared-1");
		expect(saved).toMatchObject({
			kind: "durable",
			candidate: {
				project: { projectId: "shared-1", assetDefinitionRefs: [source.asset] },
			},
		});
		expect(await runtime.controller.exportProjectTransfer()).toMatchObject({
			kind: "ready",
			bytes: archive,
			filename: "Imported-model.interiors",
		});
		expect(encoded?.[`custom/${source.hash}.glb`]).toEqual(source.bytes);
		stored.set(source.hash, new Uint8Array(source.bytes.byteLength).fill(9));
		expect(await runtime.controller.exportPortableBackup()).toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
		});
		expect(
			await runtime.controller.renameProject("Must not publish corrupt bytes"),
		).toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(await repository.loadProject("shared-1")).toEqual(saved);
	});

	it("keeps resource validation on the retained publication port used by startup migration", async () => {
		const { runtime, repository } = fixture();
		const source = await sourceWithResource();
		const serializedProject = canonicalProjectSerializer.serialize(
			source.project,
		);
		expect(
			await runtime.publicationRepository.publish({
				project: source.project,
				revision: {
					projectId: source.project.projectId,
					revisionId: "migration-candidate",
					createdAt: instant,
					schemaVersion: 1,
					serializedProject,
					checksum: await checksum.sha256(serializedProject),
				},
			}),
		).toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(await repository.listProjects()).toEqual({ kind: "empty" });
	});

	it("keeps undo resources recoverable after restart without moving the current pointer on corruption", async () => {
		const { runtime, repository, bytes } = fixture();
		const source = await sourceWithResource();
		bytes.set(source.hash, source.bytes.slice());
		const serializedProject = canonicalProjectSerializer.serialize(
			source.project,
		);
		expect(
			await repository.publish({
				project: source.project,
				revision: {
					projectId: source.project.projectId,
					revisionId: "original-resource-revision",
					createdAt: instant,
					schemaVersion: 1,
					serializedProject,
					checksum: await checksum.sha256(serializedProject),
				},
			}),
		).toEqual({ kind: "durable" });
		await runtime.controller.openProject(source.project.projectId);
		expect(await runtime.controller.restartProject()).toMatchObject({
			kind: "durable",
		});
		const restarted = await repository.loadProject(source.project.projectId);
		expect(runtime.controller.sessionRetentionRoots().undo).toMatchObject([
			{ revision: { revisionId: "original-resource-revision" } },
		]);
		bytes.set(source.hash, new Uint8Array(source.bytes.byteLength).fill(9));
		expect(await runtime.controller.undo()).toEqual({
			kind: "history-resource-issue",
			resourceHashes: [source.hash],
		});
		expect(await repository.loadProject(source.project.projectId)).toEqual(
			restarted,
		);
		expect(runtime.controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
		bytes.set(source.hash, source.bytes.slice());
		expect(await runtime.controller.undo()).toEqual({
			kind: "durable",
			revisionId: "original-resource-revision",
		});
		expect(await runtime.controller.readCustomGlbResource(source.hash)).toEqual(
			source.bytes,
		);
	});

	it("keeps storage advice and the independent local library on their injected ports without startup effects", async () => {
		const source = await sourceWithResource();
		const effects: string[] = [];
		const assets: CustomGlbAssetDefinition[] = [];
		const { runtime, bytes } = fixture({
			library: {
				list: async () => assets,
				register: async (asset, resource) => {
					expect(resource.bytes).toEqual(source.bytes);
					effects.push("register");
					assets.push(asset);
					return { kind: "registered", asset };
				},
			},
			storageEstimate: {
				estimateStorage: async () => {
					effects.push("estimate");
					return { quotaBytes: 1000, usageBytes: 750 };
				},
				requestPersistentStorage: async () => {
					effects.push("request");
					return true;
				},
			},
		});
		expect(effects).toEqual([]);
		expect(
			await runtime.controller.registerCustomGlbLibraryAsset({
				asset: source.asset,
				glbBytes: source.bytes,
			}),
		).toEqual({ kind: "registered", asset: source.asset });
		expect(await runtime.controller.listCustomGlbLibraryAssets()).toEqual([
			source.asset,
		]);
		expect(bytes.size).toBe(0);
		expect(await runtime.controller.storagePressure()).toEqual({
			kind: "warning",
			quotaBytes: 1000,
			usageBytes: 750,
		});
		expect(await runtime.controller.requestPersistentStorage()).toEqual({
			kind: "granted",
		});
		expect(effects).toEqual(["register", "estimate", "request"]);
	});
});


const registeredPorts = () =>
	createRegisteredRuntimePortablePorts({ binaryChecksum: { sha256Bytes } });
const oldPortable = () => ({
	encoder: new FflatePortableBackupEncoder(),
	decoder: new FflatePortableBackupDecoder({ sha256Bytes }),
	smoke: new PortableBackupReadRenderSmokeCheck({ checksum: { sha256Bytes } }),
});
async function wireSource(
	project: Project,
	resources: readonly {
		readonly resourceHash: string;
		readonly bytes: Uint8Array;
	}[] = [],
) {
	const encoded = await registeredPorts().writer.encode({
		project,
		resources,
		createdAt: instant,
	});
	if (encoded.kind !== "encoded")
		throw new Error(`Wire fixture rejected: ${encoded.reasonCode}`);
	return encoded.bytes;
}

describe("explicit registered browser transfer import", () => {
	it("uses the same real repository, resources, pins and IDs while preserving the old import/export route", async () => {
		const source = await sourceWithResource();
		const wire = await wireSource(source.project, [
			{ resourceHash: source.hash, bytes: source.bytes },
		]);
		const registered = registeredPorts();
		const pins: string[] = [];
		const { runtime, repository, bytes } = fixture({
			portable: {
				...oldPortable(),
				registeredTransfer: {
					decoder: registered.decoder,
					smoke: registered.smoke,
				},
			},
			pinStaging: {
				begin: async (hashes) => {
					pins.push(`begin:${hashes.join(",")}`);
					return { leaseId: "registered-pin", resourceHashes: hashes };
				},
				markForPublication: async (_lease, candidate) => {
					pins.push(`mark:${candidate.projectId}`);
				},
				complete: async () => {
					pins.push("complete");
				},
				discard: async () => {
					pins.push("discard");
				},
			},
		});
		await runtime.controller.create("Existing browser Project");
		const original = await repository.loadProject("shared-2");
		const backup = await runtime.controller.exportPortableBackup();
		if (backup.kind !== "ready") throw new Error("Missing old export");
		expect(
			JSON.parse(
				new TextDecoder().decode(unzipSync(backup.bytes)["manifest.json"]),
			).projectSchemaId,
		).toBe("interiors.project/alpha-1");
		expect(await runtime.controller.importPortableBackup(wire)).toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_FUTURE_SCHEMA",
		});
		expect(await runtime.controller.importProjectTransfer(wire)).toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_FUTURE_SCHEMA",
		});
		const statuses: ImportPortableBackupStatus[] = [];
		const imported = await runtime.controller.importRegisteredPortableBackup(
			wire,
			{ onStatus: (status) => statuses.push(status) },
		);
		expect(imported.kind).toBe("durable");
		if (imported.kind !== "durable") throw new Error("Not imported");
		expect(imported.projectId).not.toBe(source.project.projectId);
		expect(imported.projectId).not.toBe("shared-2");
		expect(await repository.loadProject("shared-2")).toEqual(original);
		expect(await repository.loadProject(imported.projectId)).toMatchObject({
			kind: "durable",
			candidate: {
				project: {
					projectId: imported.projectId,
					assetDefinitionRefs: [source.asset],
				},
			},
		});
		expect(bytes.get(source.hash)).toEqual(source.bytes);
		expect(pins).toEqual([
			`begin:${source.hash}`,
			`mark:${imported.projectId}`,
			"complete",
		]);
		expect(statuses.map((status) => status.kind)).toEqual([
			"validating",
			"staging-resources",
			"staging-resources",
			"checking-render",
			"saving",
			"saved",
		]);
		expect(runtime.controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { projectId: imported.projectId },
		});
		expect(runtime.controller.sessionHistory()).toEqual({
			canUndo: false,
			canRedo: false,
		});
	});

	it("does not enable a registered action without its injected route", async () => {
		const { runtime } = fixture();
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				Uint8Array.of(80, 75),
			),
		).toEqual({ kind: "not-ready" });
	});

	it("shares the publication guard with ordinary imports, forwards cancellation and releases the guard after decoder failure", async () => {
		let release: () => void = () => undefined;
		const waiting = new Promise<void>((resolve) => {
			release = resolve;
		});
		const signal = { aborted: false };
		const statuses: ImportPortableBackupStatus[] = [];
		const { runtime, repository } = fixture({
			portable: {
				...oldPortable(),
				registeredTransfer: {
					decoder: {
						decode: async (_bytes, received) => {
							expect(received).toBe(signal);
							await waiting;
							throw new Error("Decoder unavailable");
						},
					},
					smoke: { verify: async () => true },
				},
			},
		});
		const pending = runtime.controller.importRegisteredPortableBackup(
			Uint8Array.of(80, 75),
			{ signal, onStatus: (status) => statuses.push(status) },
		);
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				Uint8Array.of(80, 75),
			),
		).toEqual({ kind: "in-progress" });
		expect(
			await runtime.controller.importPortableBackup(Uint8Array.of(80, 75)),
		).toEqual({ kind: "in-progress" });
		expect(statuses).toEqual([{ kind: "validating" }]);
		release();
		expect(await pending).toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(runtime.controller.snapshot()).toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		expect(await repository.listProjects()).toEqual({ kind: "empty" });
		expect(
			await runtime.controller.create("After failed decoder"),
		).toMatchObject({ kind: "durable" });
	});

	it("keeps canonical unknown-schema and cancellation refusals on the registered route", async () => {
		const project = createInitialProject({
			projectId: "source",
			levelId: "level",
			name: "Unknown schema",
			createdAt: instant,
		});
		const entries = unzipSync(await wireSource(project));
		const manifest = JSON.parse(
			new TextDecoder().decode(entries["manifest.json"]),
		);
		entries["manifest.json"] = new TextEncoder().encode(
			JSON.stringify({
				...manifest,
				projectSchemaId: "interiors.project/unknown",
			}),
		);
		const registered = registeredPorts();
		const { runtime, repository } = fixture({
			portable: {
				...oldPortable(),
				registeredTransfer: {
					decoder: registered.decoder,
					smoke: registered.smoke,
				},
			},
		});
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				zipSync(entries, { level: 0 }),
			),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				await wireSource(project),
				{ signal: { aborted: true } },
			),
		).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" });
		expect(await repository.listProjects()).toEqual({ kind: "empty" });
	});

	it("returns unavailable PPJ verification without falling back to the old decoder or publishing", async () => {
		const registered = registeredPorts();
		let oldDecodes = 0;
		const { runtime, repository } = fixture({
			portable: {
				...oldPortable(),
				decoder: {
					decode: async () => {
						oldDecodes++;
						return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
					},
				},
				registeredTransfer: {
					decoder: registered.decoder,
					smoke: registered.smoke,
				},
			},
		});
		const controls = {
			"manifest.json": new TextEncoder().encode(
				JSON.stringify({
					projectSchemaId: "interiors.project/alpha-1",
					projectSchemaVersion: 1,
					sourceProjectId: "p",
					canonicalProjectPath: "project/project.json",
				}),
			),
			"checksums.json": new TextEncoder().encode("[]"),
			"project/project.json": new TextEncoder().encode(
				'{"projectSchemaId":"interiors.project/alpha-1"}',
			),
		};
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				zipSync(controls, { level: 0 }),
			),
		).toEqual({ kind: "verification-unavailable" });
		expect(oldDecodes).toBe(0);
		expect(await repository.listProjects()).toEqual({ kind: "empty" });
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				new TextEncoder().encode("{}"),
			),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CONTAINER_UNSUPPORTED" });
		expect(oldDecodes).toBe(0);
	});

	it("preserves the browser feasibility default instead of trusting a policy supplied by the registered codec", async () => {
		const source = await sourceWithResource();
		const project = {
			...source.project,
			assetDefinitionRefs: [{ ...source.asset, displayName: "Model\ud800" }],
		};
		const wire = await wireSource(project, [
			{ resourceHash: source.hash, bytes: source.bytes },
		]);
		const registered = registeredPorts();
		const { runtime, repository } = fixture({
			portable: {
				...oldPortable(),
				registeredTransfer: {
					decoder: registered.decoder,
					smoke: registered.smoke,
				},
			},
		});
		const statuses: ImportPortableBackupStatus[] = [];
		expect(
			await runtime.controller.importRegisteredPortableBackup(wire, {
				onStatus: (status) => statuses.push(status),
			}),
		).toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(await repository.listProjects()).toEqual({ kind: "empty" });
		const failed = statuses.find((status) => status.kind === "persist-failed");
		if (failed?.candidate.project.schemaVersion !== 1)
			throw new Error("Missing failed V1 candidate");
		expect(failed.candidate.project.assetDefinitionRefs[0].displayName).toBe(
			"Model\ud800",
		);
	});
});

describe("explicit recovery formatter and export cancellation", () => {
	async function emptyDraft() {
		const project = createInitialProject({
			projectId: "draft-source",
			levelId: "draft-level",
			name: "Unpublished empty draft",
			createdAt: instant,
		});
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const candidate = {
			project,
			revision: {
				projectId: project.projectId,
				revisionId: "unpublished-revision",
				createdAt: instant,
				schemaVersion: 1 as const,
				serializedProject,
				checksum: await checksum.sha256(serializedProject),
			},
		};
		const draft = await exportRecoveryDraft(candidate, undefined, {
			sha256Bytes,
		});
		if (draft.kind !== "ready")
			throw new Error("Expected complete unpublished draft");
		return { candidate, draft };
	}
	it("packages the current recovery draft through the explicit exact-object writer before the registered new-project import", async () => {
		const { candidate, draft } = await emptyDraft();
		const before = draft.bytes.slice();
		for (const supplied of [false, true]) {
			const registered = registeredPorts();
			const packaged: Uint8Array[] = [];
			let writes = 0;
			const { runtime, repository } = fixture({
				portable: {
					...oldPortable(),
					decoder: registered.decoder,
					smoke: registered.smoke,
					...(supplied
						? {
								recoveryWriter: {
									encode: async (input, signal) => {
										writes++;
										expect(input).toEqual({
											project: candidate.project,
											createdAt: instant,
											resources: [],
										});
										const result = await registered.writer.encode(
											input,
											signal,
										);
										if (result.kind === "encoded") packaged.push(result.bytes);
										return result;
									},
								},
							}
						: {}),
				},
			});
			const progress: string[] = [];
			const result = await runtime.controller.importRecoveryDraft(draft.bytes, {
				onStatus: (status) => progress.push(status.kind),
			});
			expect(progress[0]).toBe("validating");
			if (!supplied) {
				expect(result).toEqual({
					kind: "rejected",
					reasonCode: "BACKUP_SCHEMA_UNREADABLE",
				});
				expect(writes).toBe(0);
				expect(await repository.listProjects()).toEqual({ kind: "empty" });
				continue;
			}
			expect(result).toEqual({
				kind: "durable",
				projectId: "shared-1",
				revisionId: "shared-2",
			});
			expect(writes).toBe(1);
			expect(
				JSON.parse(
					new TextDecoder().decode(unzipSync(packaged[0])["manifest.json"]),
				).projectSchemaId,
			).toBe("interiors.project/runtime-v1-wire");
			expect(await repository.loadProject("shared-1")).toMatchObject({
				kind: "durable",
				candidate: {
					project: { projectId: "shared-1", name: candidate.project.name },
				},
			});
			expect(runtime.controller.sessionHistory()).toEqual({
				canUndo: false,
				canRedo: false,
			});
		}
		expect(draft.bytes).toEqual(before);
	});

	it("preserves formatter refusal and availability without retrying the old recovery encoder", async () => {
		const { draft } = await emptyDraft();
		const registered = registeredPorts();
		for (const throws of [false, true]) {
			let fallback = 0;
			let decoded = 0;
			const { runtime, repository } = fixture({
				portable: {
					...oldPortable(),
					decoder: {
						decode: async (bytes, signal) => {
							decoded++;
							return registered.decoder.decode(bytes, signal);
						},
					},
					smoke: registered.smoke,
					recoveryEncoder: {
						encode: () => {
							fallback++;
							throw new Error("No fallback");
						},
					},
					recoveryWriter: {
						encode: async () => {
							if (throws) throw new Error("Formatter unavailable");
							return {
								kind: "rejected",
								reasonCode: "BACKUP_RESOURCE_MISSING",
							};
						},
					},
				},
			});
			expect(await runtime.controller.importRecoveryDraft(draft.bytes)).toEqual(
				throws
					? { kind: "not-ready" }
					: { kind: "rejected", reasonCode: "BACKUP_RESOURCE_MISSING" },
			);
			expect(fallback).toBe(0);
			expect(decoded).toBe(0);
			expect(await repository.listProjects()).toEqual({ kind: "empty" });
			// The publication guard was released even though no archive was accepted.
			expect(await runtime.controller.create("After refusal")).toMatchObject({
				kind: "durable",
			});
		}
	});

	it("passes the live cancellation signal to the recovery writer and prevents a late import", async () => {
		const { draft } = await emptyDraft();
		const registered = registeredPorts();
		const signal = { aborted: false };
		const progress: string[] = [];
		let decoded = 0;
		const { runtime, repository } = fixture({
			portable: {
				...oldPortable(),
				decoder: {
					decode: async (bytes, signal) => {
						decoded++;
						return registered.decoder.decode(bytes, signal);
					},
				},
				smoke: registered.smoke,
				recoveryWriter: {
					encode: async (input, received) => {
						expect(received).toBe(signal);
						const result = await registered.writer.encode(input, received);
						signal.aborted = true;
						return result;
					},
				},
			},
		});
		expect(
			await runtime.controller.importRecoveryDraft(draft.bytes, {
				signal,
				onStatus: (status) => progress.push(status.kind),
			}),
		).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" });
		expect(progress).toEqual(["validating"]);
		expect(decoded).toBe(0);
		expect(await repository.listProjects()).toEqual({ kind: "empty" });
	});

	it("does no validation or formatting when cancelled before recovery starts", async () => {
		const { draft } = await emptyDraft();
		const progress: string[] = [];
		let formats = 0;
		const { runtime } = fixture({
			portable: {
				...oldPortable(),
				recoveryWriter: {
					encode: async () => {
						formats++;
						return { kind: "rejected", reasonCode: "BACKUP_RESOURCE_MISSING" };
					},
				},
			},
		});
		expect(
			await runtime.controller.importRecoveryDraft(draft.bytes, {
				signal: { aborted: true },
				onStatus: (status) => progress.push(status.kind),
			}),
		).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" });
		expect(progress).toEqual([]);
		expect(formats).toBe(0);
	});

	it("does not enter the recovery formatter when cancellation arrives between verified decode and its caller continuation", async () => {
		const { draft } = await emptyDraft();
		const abort = new AbortController();
		let formats = 0;
		const { runtime, repository } = fixture({
			binaryChecksum: {
				sha256Bytes: async (bytes) => {
					const hash = await sha256Bytes(bytes);
					queueMicrotask(() => queueMicrotask(() => abort.abort()));
					return hash;
				},
			},
			portable: {
				...oldPortable(),
				recoveryWriter: {
					encode: async () => {
						formats++;
						return { kind: "rejected", reasonCode: "BACKUP_RESOURCE_MISSING" };
					},
				},
			},
		});
		expect(
			await runtime.controller.importRecoveryDraft(draft.bytes, {
				signal: abort.signal,
			}),
		).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" });
		expect(formats).toBe(0);
		expect(await repository.listProjects()).toEqual({ kind: "empty" });
	});

	it("retains legacy packaging refusal and exact registered resource spelling as distinct configured behavior", async () => {
		const source = await sourceWithResource();
		const upper = source.hash.toUpperCase();
		const project = {
			...source.project,
			assetDefinitionRefs: [{ ...source.asset, resourceHash: upper }],
		};
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const draft = await exportRecoveryDraft(
			{
				project,
				revision: {
					projectId: project.projectId,
					revisionId: "draft-upper",
					schemaVersion: 1,
					createdAt: instant,
					serializedProject,
					checksum: await checksum.sha256(serializedProject),
				},
			},
			{
				read: async (hash) =>
					hash === upper ? source.bytes.slice() : undefined,
			},
			{ sha256Bytes },
		);
		if (draft.kind !== "ready")
			throw new Error("Expected exact resource draft");
		for (const supplied of [false, true]) {
			const registered = registeredPorts();
			let calls = 0;
			const { runtime, repository, bytes } = fixture({
				portable: {
					...oldPortable(),
					decoder: registered.decoder,
					smoke: registered.smoke,
					...(supplied
						? {
								recoveryWriter: {
									encode: async (input, signal) => {
										calls++;
										expect(input.resources).toEqual([
											{ resourceHash: upper, bytes: source.bytes },
										]);
										expect(
											input.project.assetDefinitionRefs[0].resourceHash,
										).toBe(upper);
										return registered.writer.encode(input, signal);
									},
								},
							}
						: {}),
				},
			});
			const result = await runtime.controller.importRecoveryDraft(draft.bytes);
			if (supplied) {
				expect(result).toEqual({
					kind: "durable",
					projectId: "shared-1",
					revisionId: "shared-2",
				});
				expect(calls).toBe(1);
				expect(bytes.get(upper)).toEqual(source.bytes);
				expect(bytes.has(source.hash)).toBe(false);
			} else {
				expect(result).toEqual({
					kind: "rejected",
					reasonCode: "RECOVERY_DRAFT_INVALID",
				});
				expect(calls).toBe(0);
				expect(await repository.listProjects()).toEqual({ kind: "empty" });
			}
		}
	});

	it("keeps the old encoder exception reason and cancels its late completion before starting another import", async () => {
		const { draft } = await emptyDraft();
		for (const throws of [false, true]) {
			const signal = { aborted: false };
			const progress: string[] = [];
			const { runtime, repository } = fixture({
				portable: {
					...oldPortable(),
					recoveryEncoder: {
						encode: (entries) => {
							if (throws) throw new Error("Legacy encoder unavailable");
							const bytes = new FflatePortableBackupEncoder().encode(entries);
							signal.aborted = true;
							return bytes;
						},
					},
				},
			});
			expect(
				await runtime.controller.importRecoveryDraft(draft.bytes, {
					signal,
					onStatus: (status) => progress.push(status.kind),
				}),
			).toEqual({
				kind: "rejected",
				reasonCode: throws
					? "RECOVERY_DRAFT_INVALID"
					: "PORTABLE_BACKUP_CANCELLED",
			});
			expect(progress).toEqual(["validating"]);
			expect(await repository.listProjects()).toEqual({ kind: "empty" });
			expect(
				await runtime.controller.create("After legacy completion"),
			).toMatchObject({ kind: "durable" });
		}
	});

	it("forwards the live export cancellation after loading an unselected durable source", async () => {
		const { runtime, dependencies, repository } = fixture();
		await runtime.controller.create("Stored source");
		const registered = registeredPorts();
		const signal = { aborted: false };
		let writerCalls = 0;
		const formatter = new ExportRuntimePortableBackupUseCase({
			checksum,
			resources: dependencies.resources,
			smoke: registered.smoke,
			writer: {
				encode: async (input, received) => {
					writerCalls++;
					return registered.writer.encode(input, received);
				},
			},
		});
		const controller = createSharedProjectController({
			...dependencies,
			portable: { ...oldPortable(), exporter: formatter },
		}).controller;
		const stateBefore = controller.snapshot();
		const load = repository.loadProject.bind(repository);
		repository.loadProject = async (id) => {
			const value = await load(id);
			signal.aborted = true;
			return value;
		};
		expect(
			await controller.exportProjectTransfer("shared-2", { signal }),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
		expect(writerCalls).toBe(0);
		expect(controller.snapshot()).toEqual(stateBefore);
	});
});


it("blocks only private registered-import persistence retry while preserving the owned pending recovery candidate", async () => {
	const base = fixture(),
		registered = registeredPorts();
	let publications = 0;
	base.repository.publish = async () => {
		publications++;
		return { kind: "persist-failed", reasonCode: "PERSISTENCE_QUOTA_EXCEEDED" };
	};
	const gateway = new BrowserRegisteredTransferDecoder({
		decoder: registered.decoder,
		resources: base.dependencies.resources,
		binaryChecksum: { sha256Bytes },
	});
	const runtime = createSharedProjectController({
		...base.dependencies,
		ids: { next: () => crypto.randomUUID() },
		portable: {
			...oldPortable(),
			registeredTransfer: {
				decoder: gateway,
				smoke: registered.smoke,
				admission: gateway,
			},
		},
	});
	const source = createInitialProject({
			projectId: "owned-source",
			levelId: "level",
			name: "Verified source",
			createdAt: instant,
		}),
		wire = await wireSource(source);
	expect(
		await runtime.controller.importRegisteredPortableBackup(wire, {
			onStatus: (status) => {
				if (status.kind === "persist-failed") {
					Reflect.set(status, "candidate", {
						...status.candidate,
						project: {
							...status.candidate.project,
							name: "Observer forged candidate",
						},
					});
					throw new Error("Observer unavailable");
				}
			},
		}),
	).toEqual({
		kind: "persist-failed",
		reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
	});
	expect(runtime.controller.persistenceRetryPolicy()).toBe(
		"registered-transfer-reselection-required",
	);
	expect(runtime.controller.hasPendingPublication()).toBe(false);
	const roots = runtime.controller.sessionRetentionRoots();
	expect(roots.current).toBeUndefined();
	const draft = await runtime.controller.exportRecoveryDraft();
	expect(draft.kind).toBe("ready");
	if (draft.kind !== "ready") throw new Error("Pending source was discarded");
	expect(new TextDecoder().decode(draft.bytes)).toContain("Verified source");
	expect(new TextDecoder().decode(draft.bytes)).not.toContain(
		"Observer forged candidate",
	);
	await runtime.controller.retry();
	expect(publications).toBe(1);
	expect(await base.repository.listProjects()).toEqual({ kind: "empty" });
	expect(runtime.controller.snapshot().kind).toBe("persist-failed");
});

it("exposes publication pending synchronously while rename checksum is held before saving status", async () => {
	let held = false,
		release: () => void = () => undefined;
	const waiting = new Promise<void>((resolve) => {
		release = resolve;
	});
	const { runtime } = fixture({
		checksum: {
			sha256: async (value) => {
				if (held) await waiting;
				return checksum.sha256(value);
			},
		},
	});
	await runtime.controller.create("Before pending rename");
	held = true;
	const renamed = runtime.controller.renameProject("After pending rename");
	expect(runtime.controller.hasPendingPublication()).toBe(true);
	expect(runtime.controller.snapshot().kind).toBe("saved");
	release();
	expect(await renamed).toMatchObject({ kind: "durable" });
	expect(runtime.controller.hasPendingPublication()).toBe(false);
});

it("restores the prior browser state when the private proof becomes unavailable after saving starts", async () => {
	const base = fixture(),
		registered = registeredPorts();
	await base.runtime.controller.create("Existing source");
	const beforeRows = await base.repository.listProjects();
	const admission: import("../application/ports").PortableBackupImportAdmissionPort =
		{
			prepare: async (_decoded, source) => ({
				kind: "accepted",
				profile: {
					source,
					seal: async (candidate) => ({ kind: "accepted", candidate }),
					beforePublish: async () => ({ kind: "verification-unavailable" }),
				},
			}),
			isRetryBlocked: () => false,
		};
	const runtime = createSharedProjectController({
		...base.dependencies,
		portable: {
			...oldPortable(),
			registeredTransfer: { ...registered, admission },
		},
	});
	await runtime.controller.openProject("shared-2");
	const before = runtime.controller.snapshot(),
		wire = await wireSource(
			createInitialProject({
				projectId: "new-source",
				levelId: "level",
				name: "Transfer",
				createdAt: instant,
			}),
		);
	expect(await runtime.controller.importRegisteredPortableBackup(wire)).toEqual(
		{ kind: "verification-unavailable" },
	);
	expect(runtime.controller.snapshot()).toStrictEqual(before);
	expect(runtime.controller.hasPendingPublication()).toBe(false);
	expect(await base.repository.listProjects()).toStrictEqual(beforeRows);
});


it("the supplemental exporter reloads an owned Durable snapshot and keeps the legacy action separate", async () => {
	const base = fixture(),
		registered = registeredPorts(),
		seen: import("../application/ports").DurablePublicationCandidate[] = [];
	let reads = 0;
	const oldLoad = base.repository.loadProject.bind(base.repository);
	base.repository.loadProject = async (id) => {
		reads++;
		return oldLoad(id);
	};
	const runtime = createSharedProjectController({
		...base.dependencies,
		portable: {
			...oldPortable(),
			registeredTransfer: {
				...registered,
				exporter: {
					execute: async (candidate) => {
						seen.push(candidate);
						return {
							kind: "ready",
							bytes: Uint8Array.of(1),
							filename: "registered.interiors",
							mimeType: "application/zip",
						};
					},
				},
			},
		},
	});
	await runtime.controller.create("Durable empty plan");
	const before = runtime.controller.snapshot();
	const result = await runtime.controller.exportRegisteredProjectTransfer();
	expect(result.kind).toBe("ready");
	expect(reads).toBe(1);
	expect(seen).toHaveLength(1);
	expect(Object.isFrozen(seen[0].project.level)).toBe(true);
	expect(runtime.controller.snapshot()).toStrictEqual(before);
	expect((await runtime.controller.exportProjectTransfer()).kind).toBe("ready");
	expect(seen).toHaveLength(1);
});

it("supplemental export is optional and refuses unavailable, foreign or cancelled Durable proof without a fallback", async () => {
	const base = fixture();
	await base.runtime.controller.create("Original");
	expect(
		await base.runtime.controller.exportRegisteredProjectTransfer(),
	).toEqual({ kind: "not-ready" });
	let exports = 0;
	const runtime = createSharedProjectController({
		...base.dependencies,
		portable: {
			...oldPortable(),
			registeredTransfer: {
				...registeredPorts(),
				exporter: {
					execute: async () => {
						exports++;
						throw new Error("Must not export unproven source");
					},
				},
			},
		},
	});
	expect(
		await runtime.controller.exportRegisteredProjectTransfer("shared-2", {
			signal: { aborted: true },
		}),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	base.repository.loadProject = async () => {
		throw new Error("Database unavailable");
	};
	expect(
		await runtime.controller.exportRegisteredProjectTransfer("shared-2"),
	).toEqual({ kind: "verification-unavailable" });
	expect(exports).toBe(0);
});

it("uses the actual registered formatter for an empty Durable Plan and leaves a failed edit as separate recovery data", async () => {
	const { BrowserRegisteredProjectExporter } = await import(
		"../adapters/portable-backup/browser-registered-project-exporter"
	);
	const base = fixture(),
		registered = registeredPorts();
	let resourceReads = 0;
	const exporter = new BrowserRegisteredProjectExporter({
		checksum,
		smoke: registered.smoke,
		writer: registered.writer,
		readPinnedSnapshot: async () => {
			resourceReads++;
			throw new Error("Empty source may not touch blob storage");
		},
	});
	const runtime = createSharedProjectController({
		...base.dependencies,
		portable: {
			...oldPortable(),
			registeredTransfer: { ...registered, exporter },
		},
	});
	await runtime.controller.create("Stored empty source");
	const before = await base.repository.listProjects();
	base.repository.publishNextRevision = async () => ({
		kind: "persist-failed",
		reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
	});
	expect(
		await runtime.controller.renameProject("Unpublished edit"),
	).toMatchObject({ kind: "persist-failed" });
	const result = await runtime.controller.exportRegisteredProjectTransfer();
	expect(result.kind).toBe("ready");
	if (result.kind !== "ready") throw new Error("No supplemental wire");
	const decoded = await registered.decoder.decode(result.bytes);
	expect(decoded.kind).toBe("accepted");
	if (decoded.kind !== "accepted") throw new Error("No strict wire read");
	expect(decoded.projectMember?.project).toMatchObject({
		name: "Stored empty source",
		level: { rooms: [], vertices: [] },
	});
	expect(resourceReads).toBe(0);
	expect(await base.repository.listProjects()).toStrictEqual(before);
	expect((await runtime.controller.exportRecoveryDraft()).kind).toBe("ready");
	expect(runtime.controller.snapshot().kind).toBe("persist-failed");
});

it("the additional exporter requires the actual selected source and forwards cancellation without touching a foreign row", async () => {
	const base = fixture(),
		registered = registeredPorts(),
		ready = {
			kind: "ready" as const,
			bytes: Uint8Array.of(1),
			filename: "wire.interiors",
			mimeType: "application/zip" as const,
		};
	let exports = 0,
		loads = 0;
	const signal = { aborted: false };
	const runtime = createSharedProjectController({
		...base.dependencies,
		portable: {
			...oldPortable(),
			registeredTransfer: {
				...registered,
				exporter: {
					execute: async () => {
						exports++;
						return ready;
					},
				},
			},
		},
	});
	expect(await runtime.controller.exportRegisteredProjectTransfer()).toEqual({
		kind: "not-ready",
	});
	await runtime.controller.create("Actual source");
	const originalLoad = base.repository.loadProject.bind(base.repository),
		stored = await originalLoad("shared-2");
	if (stored.kind !== "durable") throw new Error("Missing stored fixture");
	base.repository.loadProject = async () => {
		loads++;
		return stored;
	};
	signal.aborted = true;
	expect(
		await runtime.controller.exportRegisteredProjectTransfer("shared-2", {
			signal,
		}),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	expect(loads).toBe(0);
	signal.aborted = false;
	for (const options of [undefined, {}, { signal }])
		expect(
			await runtime.controller.exportRegisteredProjectTransfer(
				"shared-2",
				options,
			),
		).toEqual(ready);
 const foreignProject=structuredClone(stored),foreignRevision=structuredClone(stored);Reflect.set(foreignProject.candidate.project,"projectId","foreign");Reflect.set(foreignRevision.candidate.revision,"projectId","foreign");
 for(const loaded of [{kind:"empty" as const},{kind:"recovery-needed" as const,reasonCode:"PERSISTENCE_CORRUPT" as const},foreignProject,foreignRevision]) {
		base.repository.loadProject = async () => loaded;
		const before = exports;
		expect(
			await runtime.controller.exportRegisteredProjectTransfer("shared-2"),
		).toEqual({ kind: "verification-unavailable" });
		expect(exports).toBe(before);
	}
	const unsupported = structuredClone(stored);
	Reflect.set(unsupported.candidate.revision, "schemaVersion", 2);
	base.repository.loadProject = async () => unsupported;
	expect(
		await runtime.controller.exportRegisteredProjectTransfer("shared-2"),
	).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" });
	base.repository.loadProject = async () => {
		signal.aborted = true;
		return stored;
	};
	const before = exports;
	expect(
		await runtime.controller.exportRegisteredProjectTransfer("shared-2", {
			signal,
		}),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	expect(exports).toBe(before);
});

it("discarding late supplemental export outcomes preserves cancellation and leaves controller state unchanged", async () => {
	const base = fixture(),
		registered = registeredPorts(),
		signal = { aborted: false };
	let throwing = false;
	const runtime = createSharedProjectController({
		...base.dependencies,
		portable: {
			...oldPortable(),
			registeredTransfer: {
				...registered,
				exporter: {
					execute: async () => {
						signal.aborted = true;
						if (throwing) throw new Error("Interrupted formatter");
						return {
							kind: "ready",
							bytes: Uint8Array.of(1),
							filename: "wire.interiors",
							mimeType: "application/zip",
						};
					},
				},
			},
		},
	});
	await runtime.controller.create("Stored source");
	const before = runtime.controller.snapshot();
	for (const mode of [false, true]) {
		throwing = mode;
		signal.aborted = false;
		expect(
			await runtime.controller.exportRegisteredProjectTransfer(undefined, {
				signal,
			}),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
		expect(runtime.controller.snapshot()).toStrictEqual(before);
	}
	signal.aborted = false;
	throwing = true;
	expect(
		await runtime.controller.exportRegisteredProjectTransfer(undefined, {}),
	).toEqual({ kind: "verification-unavailable" });
	expect(runtime.controller.snapshot()).toStrictEqual(before);
});
