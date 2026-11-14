import { expect, it } from "@rstest/core";
import {
	DurableProjectRepository,
	MemoryVersionedProjectStore,
} from "../adapters/persistence/durable-project-repository";
import { FencedProjectRepository } from "../adapters/persistence/fenced-project-repository";
import { createInitialProject } from "../domain/initial-project";
import { canonicalProjectSerializer } from "../application/create-project";
import { createSharedProjectController } from "./shared-project-controller";

async function fixture(history: { stale?: boolean } = {}) {
	const fault: { failAt?: "before-pointer-quota" } = {};
	const store = new MemoryVersionedProjectStore(fault);
	const checksum = {
		sha256: async (text: string) =>
			[
				...new Uint8Array(
					await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
				),
			]
				.map((byte) => byte.toString(16).padStart(2, "0"))
				.join(""),
	};
	const repository = new FencedProjectRepository(
		new DurableProjectRepository(store, checksum.sha256),
		store,
		"owner",
	);
	const publishNext = repository.publishNextRevision.bind(repository);
	repository.publishNextRevision = (candidate, expected, intent) =>
		history.stale && intent === "history"
			? Promise.resolve({ kind: "stale-base" })
			: publishNext(candidate, expected, intent);
	const source = createInitialProject({
		projectId: "source-B",
		levelId: "source-level",
		name: "Imported B",
		createdAt: "2026-11-04T12:00:00.000Z",
	});
	let next = 0;
	const { controller } = createSharedProjectController({
		repository,
		checksum,
		binaryChecksum: { sha256Bytes: async () => "0".repeat(64) },
		ids: { next: () => `id-${++next}` },
		clock: { now: () => "2026-11-05T00:00:00.000Z" },
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
			requiresPublicationContext: true,
			begin: async () => {
				throw new Error("Empty project needs no pin");
			},
			markForPublication: async () => undefined,
			complete: async () => undefined,
			discard: async () => undefined,
		},
		portable: {
			encoder: { encode: () => new Uint8Array() },
			decoder: {
				decode: async () => ({
					kind: "rejected",
					reasonCode: "PORTABLE_BACKUP_INVALID",
				}),
			},
			smoke: { verify: async () => true },
			registeredTransfer: {
				decoder: {
					decode: async () => ({
						kind: "accepted",
						projectBytes: new TextEncoder().encode(
							canonicalProjectSerializer.serialize(source),
						),
						projectMember: { format: "runtime-v1-wire", project: source },
					}),
				},
				smoke: { verify: async () => true },
			},
		},
	});
	return { controller, fault };
}

it("reports actual retained import B while the failure screen intentionally still displays prior Durable A; its projection cannot mutate pending work", async () => {
	const { controller, fault } = await fixture();
	expect(controller.pendingPublicationIdentity()).toBeUndefined();
	const a = await controller.create("Durable A");
	if (a.kind !== "durable") throw new Error("Missing A");
	expect(controller.pendingPublicationIdentity()).toBeUndefined();
	fault.failAt = "before-pointer-quota";
	expect(
		(await controller.importRegisteredPortableBackup(Uint8Array.of(80, 75)))
			.kind,
	).toBe("persist-failed");
	expect(controller.snapshot()).toMatchObject({
		kind: "persist-failed",
		project: { projectId: a.projectId, name: "Durable A" },
		revisionId: a.revisionId,
	});
	const identity = controller.pendingPublicationIdentity();
	if (!identity) throw new Error("Missing pending B");
	expect(identity.projectId).not.toBe(a.projectId);
	expect(identity.revisionId).not.toBe(a.revisionId);
	expect(identity.checksum).toMatch(/^[a-f0-9]{64}$/);
	const before = { ...identity };
	Object.assign(identity, {
		projectId: "forged",
		revisionId: "forged",
		checksum: "forged",
	});
	expect(controller.pendingPublicationIdentity()).toEqual(before);
	expect(controller.pendingPublicationIdentity()).not.toBe(identity);
	fault.failAt = undefined;
	await controller.retry();
	expect(controller.snapshot()).toMatchObject({
		kind: "saved",
		project: { projectId: before.projectId, name: "Imported B" },
		revisionId: before.revisionId,
	});
	expect(controller.pendingPublicationIdentity()).toBeUndefined();
});

it("reports the actual failed history target rather than its still-displayed current source", async () => {
	const { controller, fault } = await fixture();
	const first = await controller.create("R1");
	if (first.kind !== "durable") throw new Error("Missing R1");
	await controller.renameProject("R2");
	const second = controller.currentRevisionIdentity();
	if (!second) throw new Error("Missing R2");
	fault.failAt = "before-pointer-quota";
	expect((await controller.undo()).kind).toBe("persist-failed");
	expect(controller.snapshot()).toMatchObject({
		kind: "persist-failed",
		revisionId: second.revisionId,
	});
	expect(controller.pendingPublicationIdentity()).toMatchObject({
		projectId: first.projectId,
		revisionId: first.revisionId,
	});
	fault.failAt = undefined;
	await controller.retry();
	expect(controller.snapshot()).toMatchObject({
		kind: "saved",
		revisionId: first.revisionId,
	});
	expect(controller.pendingPublicationIdentity()).toBeUndefined();
});

it("retains the exact history retry target after a controlled public-port stale-base reply although the screen returns to the saved source", async () => {
	const history: { stale?: boolean } = {};
	const { controller, fault } = await fixture(history);
	const first = await controller.create("R1");
	if (first.kind !== "durable") throw new Error("Missing R1");
	await controller.renameProject("R2");
	const second = controller.currentRevisionIdentity();
	if (!second) throw new Error("Missing R2");
	fault.failAt = "before-pointer-quota";
	expect((await controller.undo()).kind).toBe("persist-failed");
	const target = controller.pendingPublicationIdentity();
	expect(target?.revisionId).toBe(first.revisionId);
	fault.failAt = undefined;
	history.stale = true;
	await controller.retry();
	expect(controller.snapshot()).toMatchObject({
		kind: "saved",
		revisionId: second.revisionId,
		project: { name: "R2" },
	});
	expect(controller.hasPendingPublication()).toBe(false);
	expect(controller.pendingPublicationIdentity()).toEqual(target);
	expect(await controller.renameProject("Must retain pending history")).toEqual(
		{ kind: "in-progress" },
	);
	const recovery = await controller.exportRecoveryDraft();
	expect(recovery.kind).toBe("ready");
	if (recovery.kind !== "ready") throw new Error("Missing retained draft");
	const data: unknown = JSON.parse(new TextDecoder().decode(recovery.bytes));
	expect(data).toMatchObject({
		candidate: {
			project: { name: "R1" },
			revision: { revisionId: first.revisionId },
		},
	});
});
