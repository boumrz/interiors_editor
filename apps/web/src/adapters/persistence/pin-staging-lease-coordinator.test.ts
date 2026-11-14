import { describe, expect, it } from "@rstest/core";

import type {
	CustomAssetResource,
	PinStagingLease,
	PinStagingPublication,
} from "../../application/ports";
import { PinStagingLeaseCoordinator } from "./pin-staging-lease-coordinator";

describe("PinStagingLeaseCoordinator", () => {
	it("uses the injected lease identity exactly and otherwise requires the secure platform generator", async () => {
		const journal=memoryJournal();
		const dependencies={journal,resources:memoryResources(new Map()),isPublicationPublished:async()=>false};
		const injected=new PinStagingLeaseCoordinator({...dependencies,nextLeaseId:()=>"exact-injected-lease"});
		await expect(injected.begin(["a".repeat(64)])).resolves.toEqual({leaseId:"exact-injected-lease",resourceHashes:["a".repeat(64)]});
		const descriptor=Object.getOwnPropertyDescriptor(globalThis,"crypto");
		try {
			Object.defineProperty(globalThis,"crypto",{configurable:true,value:{randomUUID:()=>"platform-lease"}});
			await expect(new PinStagingLeaseCoordinator(dependencies).begin(["b".repeat(64)])).resolves.toEqual({leaseId:"platform-lease",resourceHashes:["b".repeat(64)]});
			Object.defineProperty(globalThis,"crypto",{configurable:true,value:undefined});
			await expect(new PinStagingLeaseCoordinator(dependencies).begin(["c".repeat(64)])).rejects.toThrow("Secure random UUID generation is unavailable");
		} finally { if(descriptor)Object.defineProperty(globalThis,"crypto",descriptor);else Reflect.deleteProperty(globalThis,"crypto"); }
	});
	it("retains unproven roots at startup and cleans them only through explicit owner discard", async () => {
		const resourceHash = "a".repeat(64);
		const resources = new Map<string, Uint8Array>([
			[resourceHash, Uint8Array.of(1, 2, 3, 4)],
		]);
		const journal = memoryJournal();
		const published = new Set<string>();
		const coordinator = new PinStagingLeaseCoordinator({
			isPublicationPublished: async (publication) =>
				published.has(`${publication.projectId}:${publication.revisionId}`),
			journal,
			resources: memoryResources(resources),
			nextLeaseId: () => "lease-1",
		});

		const lease = await coordinator.begin([resourceHash]);
		expect(await journal.list()).toEqual([{ ...lease }]);
		await coordinator.markForPublication(lease, {
			projectId: "imported-project",
			revisionId: "revision-imported",
		});

		await coordinator.reconcile();
		expect(resources.has(resourceHash)).toBe(true);
		expect(await journal.list()).toEqual([{ ...lease, publication: { projectId: "imported-project", revisionId: "revision-imported" } }]);
		await coordinator.discard(lease);
		expect(resources.has(resourceHash)).toBe(false);
		expect(await journal.list()).toEqual([]);

		resources.set(resourceHash, Uint8Array.of(1, 2, 3, 4));
		const publishedLease = await coordinator.begin([resourceHash]);
		await coordinator.markForPublication(publishedLease, {
			projectId: "published-project",
			revisionId: "revision-published",
		});
		published.add("published-project:revision-published");

		await coordinator.reconcile();
		expect(resources.get(resourceHash)).toEqual(Uint8Array.of(1, 2, 3, 4));
		expect(await journal.list()).toEqual([]);
	});

	it("retains the journal if no-publish cleanup fails, so restart can retry without an unrooted delete", async () => {
		const resourceHash = "b".repeat(64);
		const journal = memoryJournal();
		const coordinator = new PinStagingLeaseCoordinator({
			isPublicationPublished: async () => false,
			journal,
			resources: {
				delete: async () => { throw new Error("storage unavailable"); },
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" as const }),
			},
			nextLeaseId: () => "lease-2",
		});

		const lease = await coordinator.begin([resourceHash]);
		await expect(coordinator.discard(lease)).rejects.toThrow("storage unavailable");
		await expect(journal.list()).resolves.toEqual([{ ...lease }]);
	});

	it("fails closed for a legacy journal record that names an already durable Project but no target revision", async () => {
		const resourceHash = "c".repeat(64);
		const resources = new Map<string, Uint8Array>([
			[resourceHash, Uint8Array.of(5, 6, 7, 8)],
		]);
		const journal = memoryJournal();
		const coordinator = new PinStagingLeaseCoordinator({
			isPublicationPublished: async () => true,
			journal,
			resources: memoryResources(resources),
			nextLeaseId: () => "legacy-lease",
		});

		const lease = await coordinator.begin([resourceHash]);
		await journal.create({
			...lease,
			// Records written before revision identity was added must not get a
			// successful reconciliation merely because a Project id still exists.
			projectId: "existing-project",
		} as PinStagingLease);

		await coordinator.reconcile();
		expect(resources.has(resourceHash)).toBe(true);
		expect(await journal.list()).toEqual([{ ...lease, projectId: "existing-project" }]);
	});

	it("does not mistake another durable revision of the same Project for the staged publication", async () => {
		const resourceHash = "d".repeat(64);
		const resources = new Map<string, Uint8Array>([
			[resourceHash, Uint8Array.of(9, 10, 11, 12)],
		]);
		const journal = memoryJournal();
		const coordinator = new PinStagingLeaseCoordinator({
			isPublicationPublished: async (publication) =>
				publication.projectId === "existing-project" &&
				publication.revisionId === "old-revision",
			journal,
			resources: memoryResources(resources),
			nextLeaseId: () => "wrong-revision-lease",
		});

		const lease = await coordinator.begin([resourceHash]);
		await coordinator.markForPublication(lease, {
			projectId: "existing-project",
			revisionId: "planned-revision",
		});

		await coordinator.reconcile();
		expect(resources.has(resourceHash)).toBe(true);
		expect(await journal.list()).toEqual([{ ...lease, publication: { projectId: "existing-project", revisionId: "planned-revision" } }]);
	});

	it("cannot delete another live context's bytes during mark/publish or a retained failed publication", async () => {
		const resourceHash = "f".repeat(64);
		const resources = new Map([[resourceHash, Uint8Array.of(8, 9, 10)]]);
		const journal = memoryJournal();
		let release: () => void = () => undefined;
		const checkpoint = new Promise<void>((resolve) => { release = resolve; });
		let published = false;
		const first = new PinStagingLeaseCoordinator({ journal, resources: memoryResources(resources), nextLeaseId: () => "live-writer", isPublicationPublished: async () => published, afterMarkForPublication: () => checkpoint });
		const second = new PinStagingLeaseCoordinator({ journal, resources: memoryResources(resources), isPublicationPublished: async () => published });
		const lease = await first.begin([resourceHash]);
		const marking = first.markForPublication(lease, { projectId: "live-project", revisionId: "pending-revision" });
		await second.reconcile();
		expect(resources.get(resourceHash)).toEqual(Uint8Array.of(8, 9, 10));
		expect(await journal.list()).toHaveLength(1);
		release();
		await marking;
		// A publication failure leaves this exact candidate pending for retry.
		await second.reconcile();
		expect(resources.get(resourceHash)).toEqual(Uint8Array.of(8, 9, 10));
		expect(await journal.list()).toHaveLength(1);
		published = true;
		await second.reconcile();
		expect(await journal.list()).toEqual([]);
		expect(resources.get(resourceHash)).toEqual(Uint8Array.of(8, 9, 10));
	});

	it("does not leave the mark-to-publication crash checkpoint before the journal record is durable", async () => {
		const resourceHash = "e".repeat(64);
		const journal = memoryJournal();
		let checkpointCalls = 0;
		const coordinator = new PinStagingLeaseCoordinator({
			afterMarkForPublication: async () => {
				checkpointCalls += 1;
			},
			isPublicationPublished: async () => false,
			journal,
			resources: memoryResources(new Map([[resourceHash, Uint8Array.of(13)]])),
			nextLeaseId: () => "checkpoint-lease",
		} as never);

		const lease = await coordinator.begin([resourceHash]);
		await coordinator.markForPublication(lease, {
			projectId: "project-checkpoint",
			revisionId: "revision-checkpoint",
		});

		expect(checkpointCalls).toBe(1);
		expect(await journal.list()).toEqual([
			{
				...lease,
				publication: {
					projectId: "project-checkpoint",
					revisionId: "revision-checkpoint",
				},
			},
		]);
	});
});

function memoryJournal() {
	const records = new Map<
		string,
		PinStagingLease & {
			readonly projectId?: string;
			readonly publication?: PinStagingPublication;
		}
	>();
	return {
		create: async (lease: PinStagingLease) => { records.set(lease.leaseId, { ...lease }); },
		list: async () => [...records.values()].map((lease) => ({ ...lease })),
		markForPublication: async (
			leaseId: string,
			publication: PinStagingPublication,
		) => {
			const lease = records.get(leaseId);
			if (!lease) throw new Error("missing lease");
			records.set(leaseId, { ...lease, publication });
		},
		remove: async (leaseId: string) => { records.delete(leaseId); },
	};
}

function memoryResources(records: Map<string, Uint8Array>) {
	return {
		delete: async (resourceHash: string) => { records.delete(resourceHash); },
		read: async (resourceHash: string) => records.get(resourceHash)?.slice(),
		writeIfAbsent: async (resource: CustomAssetResource) => {
			if (records.has(resource.resourceHash)) return { kind: "already-present" as const };
			records.set(resource.resourceHash, resource.bytes.slice());
			return { kind: "stored" as const };
		},
	};
}
