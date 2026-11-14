import { completedFacadeOperation } from "./browser-facade-test-support";
import { expect, it } from "@rstest/core";
import {
	DurableProjectRepository,
	MemoryVersionedProjectStore,
} from "../adapters/persistence/durable-project-repository";
import { FencedProjectRepository } from "../adapters/persistence/fenced-project-repository";
import { FflatePortableBackupDecoder } from "../adapters/portable-backup/fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../adapters/portable-backup/portable-backup-read-render-smoke";
import { createRegisteredRuntimePortablePorts } from "../adapters/portable-backup/registered-runtime-portable";
import { createInitialProject } from "../domain/initial-project";
import { encodeLocalProjectJson } from "../domain/project-json-transfer";
import { createBrowserProjectControllerFacade } from "./browser-project-controller-facade";
import { decodeRecoveryDraft } from "./project-recovery";
import { createSharedProjectController } from "./shared-project-controller";

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		Uint8Array.from(bytes).buffer,
	);
	return Array.from(new Uint8Array(digest), (value) =>
		value.toString(16).padStart(2, "0"),
	).join("");
}
const checksum = {
	sha256: (text: string) => sha256Bytes(new TextEncoder().encode(text)),
};
const instant = "2026-11-05T00:00:00.000Z";

/** Actual shared controller, publication, archive, checksum and recovery algorithms; memory persistence only. */
function actualCore(prefix: string) {
	const failure: { failAt?: "before-pointer-quota"; nowEpochMs: () => number } =
		{ nowEpochMs: () => 1000 };
	const store = new MemoryVersionedProjectStore(failure);
	const repository = new FencedProjectRepository(
		new DurableProjectRepository(store, checksum.sha256),
		store,
		`${prefix}-writer`,
	);
	const registered = createRegisteredRuntimePortablePorts({
		binaryChecksum: { sha256Bytes },
	});
	let id = 0;
	const { controller } = createSharedProjectController({
		repository,
		checksum,
		binaryChecksum: { sha256Bytes },
		clock: { now: () => instant },
		ids: { next: () => `${prefix}-${++id}` },
		storageEstimate: { estimateStorage: async () => ({}) },
		resources: {
			read: async () => undefined,
			delete: async () => undefined,
			writeIfAbsent: async () => ({ kind: "stored" }),
		},
		library: {
			list: async () => [],
			register: async (asset) => ({ kind: "registered", asset }),
		},
		pinStaging: {
			begin: async (resourceHashes) => ({
				leaseId: `${prefix}-pins`,
				resourceHashes,
			}),
			markForPublication: async () => undefined,
			complete: async () => undefined,
			discard: async () => undefined,
		},
		portable: {
			encoder: new FflatePortableBackupEncoder(),
			decoder: new FflatePortableBackupDecoder({ sha256Bytes }),
			smoke: new PortableBackupReadRenderSmokeCheck({
				checksum: { sha256Bytes },
			}),
			registeredTransfer: {
				decoder: registered.decoder,
				smoke: registered.smoke,
			},
			recoveryWriter: registered.writer,
		},
	});
	return { controller, repository, registered, failure, store };
}

it("exposes actual retained import B failure even when the shared Core displays its previous Durable A", async () => {
	const legacy = actualCore("legacy"),
		privateCore = actualCore("registered");
	const createdA = await privateCore.controller.create(
		"Prior private Durable A",
	);
	if (createdA.kind !== "durable")
		throw new Error("Actual prior A was not saved");
	const prior = await privateCore.repository.loadProject(createdA.projectId);
	const facade = createBrowserProjectControllerFacade({
		legacy: legacy.controller,
		registered: {
			controller: privateCore.controller,
			readDirectory: async () => ({
				kind: "available",
				directory: await privateCore.repository.listProjects(),
			}),
			dispose: async () => undefined,
		},
	});
	await completedFacadeOperation(facade.controller.open());
	await completedFacadeOperation(facade.controller.openProject(createdA.projectId, {
		storageNamespace: "browser-registered",
	}));
	const preImportView = facade.getEditorInstanceSnapshot();
	const source = createInitialProject({
		projectId: "source-b",
		levelId: "source-level",
		name: "Imported pending B",
		createdAt: instant,
	});
	const archive = await privateCore.registered.writer.encode({
		project: source,
		resources: [],
		createdAt: instant,
	});
	if (archive.kind !== "encoded")
		throw new Error("Actual registered archive was not prepared");
	privateCore.failure.failAt = "before-pointer-quota";
	const result = await completedFacadeOperation(facade.controller.importRegisteredPortableBackup(
		archive.bytes,
	));
	expect(result.kind).toBe("persist-failed");
	const coreState = privateCore.controller.snapshot();
	expect(coreState.kind).toBe("persist-failed");
	if (coreState.kind !== "persist-failed")
		throw new Error("Actual Core did not retain failure");
	expect(coreState.project?.projectId).toBe(createdA.projectId);
	const visible = facade.controller.snapshot();
	expect(visible.kind).toBe("persist-failed");
	if (visible.kind !== "persist-failed")
		throw new Error("Facade hid the real pending import");
	expect(visible.project?.projectId).toBe(createdA.projectId);
	const recovery = await completedFacadeOperation(facade.controller.exportRecoveryDraft());
	expect(recovery.kind).toBe("ready");
	if (recovery.kind !== "ready")
		throw new Error("Retained B is not exportable");
	const decoded = await decodeRecoveryDraft(recovery.bytes, { sha256Bytes });
	expect(decoded.kind).toBe("accepted");
	if (decoded.kind !== "accepted")
		throw new Error("Actual recovery file was not readable");
	expect(decoded.candidate.project.name).toBe("Imported pending B");
	expect(decoded.candidate.project.projectId).not.toBe(createdA.projectId);
	expect(
		await privateCore.repository.loadProject(createdA.projectId),
	).toStrictEqual(prior);
	const retained = privateCore.controller.pendingPublicationIdentity();
	expect(retained).toBeDefined();
	expect(
		(await completedFacadeOperation(facade.controller.renameProject("Must not replace pending B"))).kind,
	).toBe("not-ready");
	expect(privateCore.controller.pendingPublicationIdentity()).toEqual(retained);
	const previousView = facade.getEditorInstanceSnapshot();
	privateCore.failure.failAt = undefined;
	await completedFacadeOperation(facade.controller.retry());
	const saved = facade.controller.snapshot();
	expect(saved.kind).toBe("saved");
	if (saved.kind !== "saved")
		throw new Error("Retry did not select its authorized B");
	expect(saved.project.projectId).toBe(retained?.projectId);
	expect(saved.project.name).toBe("Imported pending B");
	expect(facade.getEditorInstanceSnapshot().key).not.toBe(previousView.key);
	expect(
		await previousView.controller?.renameProject("Stale A callback"),
	).toEqual({ kind: "not-ready" });
	expect(privateCore.controller.pendingPublicationIdentity()).toBeUndefined();
 expect(await preImportView.controller?.renameProject("Late pre-import A callback")).toEqual({ kind: "not-ready" });
 expect(privateCore.controller.snapshot()).toMatchObject({ kind: "saved", project: { name: "Imported pending B" } });
	expect(
		await privateCore.repository.loadProject(createdA.projectId),
	).toStrictEqual(prior);
});

it("exposes a retained first import without inventing a displayed Durable Project", async () => {
	const legacy = actualCore("empty-legacy"),
		privateCore = actualCore("empty-private");
	const facade = createBrowserProjectControllerFacade({
		legacy: legacy.controller,
		registered: {
			controller: privateCore.controller,
			readDirectory: async () => ({
				kind: "available",
				directory: await privateCore.repository.listProjects(),
			}),
			dispose: async () => undefined,
		},
	});
	await completedFacadeOperation(facade.controller.open());
	const source = createInitialProject({
		projectId: "source-only",
		levelId: "level",
		name: "First pending",
		createdAt: instant,
	});
	const archive = await privateCore.registered.writer.encode({
		project: source,
		resources: [],
		createdAt: instant,
	});
	if (archive.kind !== "encoded") throw new Error("Missing archive");
	privateCore.failure.failAt = "before-pointer-quota";
	expect(
		(await completedFacadeOperation(facade.controller.importRegisteredPortableBackup(archive.bytes)))
			.kind,
	).toBe("persist-failed");
	const visible = facade.controller.snapshot();
	expect(visible.kind).toBe("persist-failed");
	if (visible.kind !== "persist-failed")
		throw new Error("Missing pending view");
	expect(visible.project).toBeUndefined();
	const recovery = await completedFacadeOperation(facade.controller.exportRecoveryDraft());
	expect(recovery.kind).toBe("ready");
	const instance = facade.getEditorInstanceSnapshot();
	await completedFacadeOperation(facade.controller.showProjects());
	expect(facade.getEditorInstanceSnapshot()).toBe(instance);
	privateCore.failure.failAt = undefined;
	await completedFacadeOperation(facade.controller.retry());
	expect(facade.controller.snapshot()).toMatchObject({
		kind: "saved",
		project: { name: "First pending" },
	});
});

it("adopts actual fence-loss import B while displaying A and discards only the exact explicitly confirmed B", async () => {
	const legacy = actualCore("loss-legacy"),
		privateCore = actualCore("loss-private");
	const a = await privateCore.controller.create("Durable A");
	if (a.kind !== "durable") throw new Error("Missing A");
	const prior = await privateCore.repository.loadProject(a.projectId);
	const facade = createBrowserProjectControllerFacade({
		legacy: legacy.controller,
		registered: {
			controller: privateCore.controller,
			readDirectory: async () => ({
				kind: "available",
				directory: await privateCore.repository.listProjects(),
			}),
			dispose: async () => undefined,
		},
	});
	await completedFacadeOperation(facade.controller.open());
	await completedFacadeOperation(facade.controller.openProject(a.projectId, {
		storageNamespace: "browser-registered",
	}));
	const publish = privateCore.repository.publish.bind(privateCore.repository);
	privateCore.repository.publish = async (candidate, base) => {
		await privateCore.store.acquireWriterLease(
			candidate.project.projectId,
			"competing-writer",
		);
		return publish(candidate, base);
	};
	const source = createInitialProject({
		projectId: "source-loss",
		levelId: "level",
		name: "Lost writer B",
		createdAt: instant,
	});
	const archive = await privateCore.registered.writer.encode({
		project: source,
		resources: [],
		createdAt: instant,
	});
	if (archive.kind !== "encoded") throw new Error("Missing archive");
	expect(
		(await completedFacadeOperation(facade.controller.importRegisteredPortableBackup(archive.bytes)))
			.kind,
	).toBe("persist-failed");
	expect(facade.controller.snapshot()).toMatchObject({
		kind: "saved",
		project: { projectId: a.projectId },
	});
	const copy = facade.controller.writerRecoveryCopy();
	expect(copy?.project.name).toBe("Lost writer B");
	if (!copy) throw new Error("Missing lost-writer B");
	expect(copy.project.projectId).not.toBe(a.projectId);
	expect((await completedFacadeOperation(facade.controller.exportRecoveryDraft())).kind).toBe("ready");
	expect((await completedFacadeOperation(facade.controller.renameProject("Do not replace B"))).kind).toBe(
		"not-ready",
	);
	expect(
		await completedFacadeOperation(facade.discardWriterRecoveryAndShowProjects(structuredClone(copy))),
	).toBe(false);
	expect(privateCore.controller.writerRecoveryCopy()).toBe(copy);
	expect(await completedFacadeOperation(facade.discardWriterRecoveryAndShowProjects(copy))).toBe(true);
	expect(privateCore.controller.writerRecoveryCopy()).toBeUndefined();
	expect(facade.controller.snapshot().kind).toBe("projects");
	expect(await privateCore.repository.loadProject(a.projectId)).toStrictEqual(
		prior,
	);
});

for (const method of ["importProjectJson", "importProjectTransfer"] as const) {
	for (const failureMode of ["quota", "writer-loss"] as const) {
		it(`retains actual legacy JSON B through ${method}/${failureMode} while another namespace A was selected`, async () => {
			const legacy = actualCore(`json-legacy-${method}-${failureMode}`),
				privateCore = actualCore(`json-private-${method}-${failureMode}`);
			const d = await legacy.controller.create("Legacy Durable D"),
				a = await privateCore.controller.create("Private Durable A");
			if (d.kind !== "durable" || a.kind !== "durable")
				throw new Error("Missing actual prior projects");
			const beforeD = await legacy.repository.loadProject(d.projectId),
				beforeA = await privateCore.repository.loadProject(a.projectId);
			const facade = createBrowserProjectControllerFacade({
				legacy: legacy.controller,
				registered: {
					controller: privateCore.controller,
					readDirectory: async () => ({
						kind: "available",
						directory: await privateCore.repository.listProjects(),
					}),
					dispose: async () => undefined,
				},
			});
			await completedFacadeOperation(facade.controller.open());
			await completedFacadeOperation(facade.controller.openProject(a.projectId, {
				storageNamespace: "browser-registered",
			}));
			const oldPrivateView = facade.getEditorInstanceSnapshot();
			const source = createInitialProject({
				projectId: "old-json-source",
				levelId: "level",
				name: "Imported old JSON B",
				createdAt: instant,
			});
			const file = new TextEncoder().encode(
				await encodeLocalProjectJson(source, checksum.sha256),
			);
			if (failureMode === "quota")
				legacy.failure.failAt = "before-pointer-quota";
			else {
				const publish = legacy.repository.publish.bind(legacy.repository);
				legacy.repository.publish = async (candidate, base) => {
					await legacy.store.acquireWriterLease(
						candidate.project.projectId,
						"another-context",
					);
					return publish(candidate, base);
				};
			}
			expect((await facade.controller[method](file)).kind).toBe(
				"persist-failed",
			);
			expect(facade.getEditorInstanceSnapshot().storageNamespace).toBe(
				"legacy",
			);
			expect(facade.getEditorInstanceSnapshot().key).not.toBe(
				oldPrivateView.key,
			);
			const recovery = await completedFacadeOperation(facade.controller.exportRecoveryDraft());
			expect(recovery.kind).toBe("ready");
			if (recovery.kind !== "ready") throw new Error("Missing real B recovery");
			const decoded = await decodeRecoveryDraft(recovery.bytes, {
				sha256Bytes,
			});
			expect(decoded.kind).toBe("accepted");
			if (decoded.kind !== "accepted")
				throw new Error("Invalid real recovery archive");
			expect(decoded.candidate.project.name).toBe("Imported old JSON B");
			expect(decoded.candidate.project.projectId).not.toBe(d.projectId);
			expect(await legacy.repository.loadProject(d.projectId)).toStrictEqual(
				beforeD,
			);
			expect(
				await privateCore.repository.loadProject(a.projectId),
			).toStrictEqual(beforeA);
			if (failureMode === "quota") {
				legacy.failure.failAt = undefined;
				await completedFacadeOperation(facade.controller.retry());
				expect(facade.controller.snapshot()).toMatchObject({
					kind: "saved",
					project: { name: "Imported old JSON B" },
				});
			} else {
				const copy = facade.controller.writerRecoveryCopy();
				expect(copy?.project.projectId).toBe(
					decoded.candidate.project.projectId,
				);
				expect(await completedFacadeOperation(facade.discardWriterRecoveryAndShowProjects(copy))).toBe(
					true,
				);
			}
			expect(
				await oldPrivateView.controller?.renameProject(
					"Late private A callback",
				),
			).toEqual({ kind: "not-ready" });
		});
	}
}

for (const namespace of ["legacy", "browser-registered"] as const) {
	it(`performs an actual owner-qualified rename only in the selected ${namespace} repository`, async () => {
		const legacy = actualCore(`qualified-legacy-${namespace}`),
			privateCore = actualCore(`qualified-private-${namespace}`);
		const a = await legacy.controller.create("Legacy original"),
			b = await privateCore.controller.create("Private original");
		if (a.kind !== "durable" || b.kind !== "durable")
			throw new Error("Missing actual source projects");
		const beforeA = await legacy.repository.loadProject(a.projectId),
			beforeB = await privateCore.repository.loadProject(b.projectId);
		const facade = createBrowserProjectControllerFacade({
			legacy: legacy.controller,
			registered: {
				controller: privateCore.controller,
				readDirectory: async () => ({
					kind: "available",
					directory: await privateCore.repository.listProjects(),
				}),
				dispose: async () => undefined,
			},
		});
		await completedFacadeOperation(facade.controller.open());
		await completedFacadeOperation(facade.controller.openProject(
			namespace === "legacy" ? a.projectId : b.projectId,
			{ storageNamespace: namespace },
		));
		expect(
			facade.getEditorInstanceSnapshot().requestedRenameProjectId,
		).toBeUndefined();
		expect(
			(
				await completedFacadeOperation(facade.controller.renameProject("Authorized selected owner", {
					storageNamespace: namespace,
				}))
			).kind,
		).toBe("durable");
		expect(facade.controller.snapshot()).toMatchObject({
			kind: "saved",
			project: { name: "Authorized selected owner" },
		});
		const other =
			namespace === "legacy"
				? await privateCore.repository.loadProject(b.projectId)
				: await legacy.repository.loadProject(a.projectId);
		expect(other).toStrictEqual(namespace === "legacy" ? beforeB : beforeA);
	});
}
