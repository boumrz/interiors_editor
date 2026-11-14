import { describe, expect, it } from "@rstest/core";

import type {
	PublicationCandidate,
	V2PublicationCandidate,
} from "../../application/ports";
import { serializeProjectV2Canonically } from "../../domain/project-v2-codec";
import { SessionRetentionProjectRepository } from "../../application/session-retention-project-repository";
import {
	DurableProjectRepository,
	MemoryVersionedProjectStore,
	type VersionedProjectStore,
} from "./durable-project-repository";
import { FencedProjectRepository } from "./fenced-project-repository";

const candidate: PublicationCandidate = {
	project: {
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
		lifecycle: "active",
		name: "Первый план",
		projectId: "project-1",
		schemaVersion: 1,
		updatedAt: "2026-08-05T14:15:16.000Z",
	},
	revision: {
		checksum: "sum:valid",
		createdAt: "2026-08-05T14:15:16.000Z",
		projectId: "project-1",
		revisionId: "revision-1",
		schemaVersion: 1,
		serializedProject:
			'{"schemaVersion":1,"projectId":"project-1","name":"Первый план","createdAt":"2026-08-05T14:15:16.000Z","updatedAt":"2026-08-05T14:15:16.000Z","lifecycle":"active","level":{"levelId":"level-1","vertices":[],"wallSegments":[],"rooms":[],"openings":[]},"assetInstances":[],"assetDefinitionRefs":[]}',
	},
};

const v2Candidate: V2PublicationCandidate = (() => {
	const project = {
		assetDefinitionRefs: [] as const,
		assetInstances: [] as const,
		createdAt: "2026-08-06T13:40:00.000Z",
		level: {
			levelId: "level-1",
			openings: [] as const,
			roomMetadata: [] as const,
			vertices: [] as const,
			wallSegments: [] as const,
		},
		lifecycle: "active" as const,
		name: "v2 пустой план",
		projectId: "project-v2",
		schemaVersion: 2 as const,
		updatedAt: "2026-08-06T13:40:00.000Z",
	};
	return {
		project,
		revision: {
			checksum: "sum:v2",
			createdAt: project.updatedAt,
			projectId: project.projectId,
			revisionId: "revision-v2",
			schemaVersion: 2,
			serializedProject: serializeProjectV2Canonically(project),
		},
	};
})();

describe("DurableProjectRepository", () => {
	it("reports and consumes writer loss when another context holds the initial publication lease", async () => {
		const store = new MemoryVersionedProjectStore();
		const durable = new DurableProjectRepository(store, async () => "sum:valid");
		const first = new FencedProjectRepository(durable, store, "owner-a");
		const second = new FencedProjectRepository(durable, store, "owner-b");
		expect(await first.publish(candidate)).toEqual({ kind: "durable" });
		expect(await second.publish(candidate)).toEqual({ kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
		expect(second.consumeLostWriterLease()).toBe(true);
		expect(second.consumeLostWriterLease()).toBe(false);
		expect(await durable.loadCurrent()).toEqual({ kind: "durable", candidate });
	});
	it("does not let the legacy publication entry discard an explicit base", async () => {
		const store = new MemoryVersionedProjectStore();
		const durable = new DurableProjectRepository(store, async () => "sum:valid");
		expect(await durable.publish(candidate)).toEqual({ kind: "durable" });
		const repository = new FencedProjectRepository(durable, store, "writer-a");
		const next = { ...candidate, revision: { ...candidate.revision, revisionId: "revision-late" } };
		expect(await repository.publish(next, "obsolete-base")).toEqual({ kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
		expect(await durable.loadCurrent()).toEqual({ kind: "durable", candidate });
		expect(await durable.publish(next, "obsolete-base")).toEqual({ kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
		expect(await durable.loadCurrent()).toEqual({ kind: "durable", candidate });
		const retained = new SessionRetentionProjectRepository(repository, { snapshot: () => ({ current: candidate, undo: [], redo: [] }) });
		expect(await retained.publish(next, "obsolete-base")).toEqual({ kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
		expect(await durable.loadCurrent()).toEqual({ kind: "durable", candidate });
	});

	it("permanently deletes an explicitly requested active Project and its directory card", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "durable",
		});

		await expect(
			repository.permanentlyDeleteProject(candidate.project.projectId),
		).resolves.toEqual({ kind: "permanently-deleted" });
		await expect(
			repository.loadProject(candidate.project.projectId),
		).resolves.toEqual({
			kind: "empty",
		});
	});

	it("does not change an active Project when the direct-delete target is missing", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "durable",
		});

		await expect(
			repository.permanentlyDeleteProject("missing-project"),
		).resolves.toEqual({
			kind: "not-found",
		});
		await expect(
			repository.loadProject(candidate.project.projectId),
		).resolves.toEqual({
			kind: "durable",
			candidate,
		});
	});

	it("keeps the Project readable when direct deletion storage fails", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await repository.publish(candidate);
		Object.defineProperty(store, "permanentlyDeleteProject", {
			value: async () => {
				throw new Error("IndexedDB unavailable");
			},
		});

		await expect(
			repository.permanentlyDeleteProject(candidate.project.projectId),
		).resolves.toEqual({ kind: "persist-failed" });
		await expect(
			repository.loadProject(candidate.project.projectId),
		).resolves.toEqual({
			kind: "durable",
			candidate,
		});
	});

	it("fails closed when storage cannot offer direct deletion", async () => {
		const unsupported = new MemoryVersionedProjectStore();
		Object.defineProperties(unsupported, {
			permanentlyDeleteProject: { value: undefined },
		});
		const unsupportedRepository = new DurableProjectRepository(
			unsupported,
			async () => "sum:valid",
		);

		await expect(
			unsupportedRepository.permanentlyDeleteProject(
				candidate.project.projectId,
			),
		).resolves.toEqual({ kind: "persist-failed" });

		const unavailable = new MemoryVersionedProjectStore();
		Object.defineProperties(unavailable, {
			permanentlyDeleteProject: {
				value: async () => {
					throw new Error("offline");
				},
			},
		});
		const unavailableRepository = new DurableProjectRepository(
			unavailable,
			async () => "sum:valid",
		);

		await expect(
			unavailableRepository.permanentlyDeleteProject(
				candidate.project.projectId,
			),
		).resolves.toEqual({ kind: "persist-failed" });
	});

	it("lists durable project cards newest first without depending on browser record order", async () => {
		const newerProject: PublicationCandidate = {
			project: {
				...candidate.project,
				name: "Второй план",
				projectId: "project-2",
				updatedAt: "2026-08-06T14:15:16.000Z",
			},
			revision: {
				...candidate.revision,
				createdAt: "2026-08-06T14:15:16.000Z",
				projectId: "project-2",
				revisionId: "revision-2",
				serializedProject:
					'{"schemaVersion":1,"projectId":"project-2","name":"Второй план","createdAt":"2026-08-05T14:15:16.000Z","updatedAt":"2026-08-06T14:15:16.000Z","lifecycle":"active","level":{"levelId":"level-1","vertices":[],"wallSegments":[],"rooms":[],"openings":[]},"assetInstances":[],"assetDefinitionRefs":[]}',
			},
		};
		const repository = new DurableProjectRepository(
			new MemoryVersionedProjectStore(),
			async (serializedProject) =>
				serializedProject === candidate.revision.serializedProject
					? "sum:valid"
					: serializedProject === newerProject.revision.serializedProject
						? "sum:newer"
						: "sum:invalid",
		);
		const validNewerProject = {
			...newerProject,
			revision: { ...newerProject.revision, checksum: "sum:newer" },
		};

		await expect(repository.publish(validNewerProject)).resolves.toEqual({
			kind: "durable",
		});
		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "durable",
		});

		await expect(repository.listProjects()).resolves.toEqual({
			kind: "populated",
			projects: [
				{
					name: "Второй план",
					projectId: "project-2",
					revisionId: "revision-2",
					updatedAt: "2026-08-06T14:15:16.000Z",
				},
				{
					name: "Первый план",
					projectId: "project-1",
					revisionId: "revision-1",
					updatedAt: "2026-08-05T14:15:16.000Z",
				},
			],
		});
	});

	it("opens only the selected durable Project and does not substitute another current pointer", async () => {
		const secondProject: PublicationCandidate = {
			project: {
				...candidate.project,
				name: "Второй план",
				projectId: "project-2",
			},
			revision: {
				...candidate.revision,
				checksum: "sum:second",
				projectId: "project-2",
				revisionId: "revision-2",
				serializedProject:
					'{"schemaVersion":1,"projectId":"project-2","name":"Второй план","createdAt":"2026-08-05T14:15:16.000Z","updatedAt":"2026-08-05T14:15:16.000Z","lifecycle":"active","level":{"levelId":"level-1","vertices":[],"wallSegments":[],"rooms":[],"openings":[]},"assetInstances":[],"assetDefinitionRefs":[]}',
			},
		};
		const repository = new DurableProjectRepository(
			new MemoryVersionedProjectStore(),
			async (serializedProject) =>
				serializedProject === candidate.revision.serializedProject
					? "sum:valid"
					: serializedProject === secondProject.revision.serializedProject
						? "sum:second"
						: "sum:invalid",
		);

		await repository.publish(candidate);
		await repository.publish(secondProject);

		await expect(repository.loadProject("project-1")).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		await expect(repository.loadProject("unknown-project")).resolves.toEqual({
			kind: "empty",
		});
	});

	it("treats a checksummed v1 record with a malformed Project shape as recovery-needed", async () => {
		const malformedProject = {
			assetDefinitionRefs: [],
			assetInstances: [],
			createdAt: "2026-08-05T14:15:16.000Z",
			lifecycle: "active",
			name: "Повреждённый план",
			projectId: "project-malformed",
			schemaVersion: 1,
			updatedAt: "2026-08-05T14:15:16.000Z",
		};
		const malformedCandidate = {
			project: malformedProject,
			revision: {
				checksum: "sum:malformed",
				createdAt: malformedProject.updatedAt,
				projectId: malformedProject.projectId,
				revisionId: "revision-malformed",
				schemaVersion: 1,
				serializedProject: JSON.stringify(malformedProject),
			},
		} as unknown as PublicationCandidate;
		const store: VersionedProjectStore = {
			discardStaging: async () => undefined,
			publishCurrentPointer: async () => "published",
			readAllCurrent: async () => [
				{ kind: "candidate", candidate: malformedCandidate },
			],
			readCurrent: async () => ({
				kind: "candidate",
				candidate: malformedCandidate,
			}),
			readCurrentForProject: async () => ({
				kind: "candidate",
				candidate: malformedCandidate,
			}),
			readStaging: async () => undefined,
			readStagingForRecovery: async () => [],
			writeStaging: async () => undefined,
		};
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:malformed",
		);

		await expect(repository.listProjects()).resolves.toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
		await expect(
			repository.loadProject(malformedProject.projectId),
		).resolves.toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("rejects a rename candidate made from a stale base revision without replacing the current Durable Revision", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const renamedProject = {
			...candidate.project,
			name: "Переименованный план",
			updatedAt: "2026-08-05T14:20:16.000Z",
		};
		const replacement: PublicationCandidate = {
			project: renamedProject,
			revision: {
				...candidate.revision,
				createdAt: renamedProject.updatedAt,
				revisionId: "revision-rename",
				serializedProject: JSON.stringify(renamedProject),
			},
		};

		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "durable",
		});
		await expect(
			repository.publishNextRevision(replacement, "revision-stale"),
		).resolves.toEqual({
			kind: "stale-base",
		});
		await expect(
			repository.loadProject(candidate.project.projectId),
		).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		await expect(
			store.readStaging(candidate.project.projectId),
		).resolves.toBeUndefined();
	});

	it("retains a readable project card and raises recovery-needed for a different dangling pointer", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await repository.publish(candidate);
		await store.seedDanglingCurrentPointer(
			"project-missing",
			"revision-missing",
		);

		await expect(repository.listProjects()).resolves.toEqual({
			kind: "populated",
			projects: [
				{
					name: "Первый план",
					projectId: "project-1",
					revisionId: "revision-1",
					updatedAt: "2026-08-05T14:15:16.000Z",
				},
			],
			recoveryNeeded: true,
		});
		await expect(repository.loadProject("project-missing")).resolves.toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("reports a lost writer lease when takeover wins between preflight and fenced pointer publication", async () => {
		const store = new MemoryVersionedProjectStore();
		const durable = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const delegate = {
			loadCurrent: () => durable.loadCurrent(),
			publish: (next: PublicationCandidate) => durable.publish(next),
			publishWithWriterLease: async (
				next: PublicationCandidate,
				lease: import("../../application/ports").WriterLease,
			) => {
				await store.takeOverWriterLease(next.project.projectId, "controller-b");
				return durable.publishWithWriterLease(next, lease);
			},
			recover: () => durable.recover(),
		};
		const repository = new FencedProjectRepository(
			delegate,
			store,
			"controller-a",
		);

		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(repository.consumeLostWriterLease()).toBe(true);
		await expect(durable.loadCurrent()).resolves.toEqual({ kind: "empty" });
	});

	it("mirrors IndexedDB lease expiry and fencing-token renewal in memory", async () => {
		let nowEpochMs = 1_000;
		const store = new MemoryVersionedProjectStore({
			nowEpochMs: () => nowEpochMs,
			writerLeaseDurationMs: 100,
		});

		const first = await store.acquireWriterLease("project-1", "phone-a");
		expect(first).toMatchObject({
			kind: "acquired",
			lease: { expiresAtEpochMs: 1_100, fencingToken: 1 },
		});
		nowEpochMs = 1_050;
		await expect(
			store.acquireWriterLease("project-1", "phone-a"),
		).resolves.toMatchObject({
			kind: "acquired",
			lease: { expiresAtEpochMs: 1_150, fencingToken: 1 },
		});
		await expect(
			store.acquireWriterLease("project-1", "phone-b"),
		).resolves.toEqual({ kind: "held-by-another-writer" });
		nowEpochMs = 1_150;
		const second = await store.acquireWriterLease("project-1", "phone-b");
		expect(second).toMatchObject({
			kind: "acquired",
			lease: { expiresAtEpochMs: 1_250, fencingToken: 2 },
		});
		if (first.kind !== "acquired") {
			throw new Error("Expected the first lease acquisition");
		}
		await expect(store.isWriterLeaseCurrent(first.lease)).resolves.toBe(false);
		if (second.kind !== "acquired") {
			throw new Error("Expected the expired lease replacement");
		}
		await expect(
			store.isWriterLeaseCurrent({ ...second.lease, fencingToken: 1 }),
		).resolves.toBe(false);
		await expect(
			store.isWriterLeaseCurrent({ ...second.lease, ownerId: "phone-c" }),
		).resolves.toBe(false);
		nowEpochMs = second.lease.expiresAtEpochMs;
		await expect(store.isWriterLeaseCurrent(second.lease)).resolves.toBe(false);
		await expect(
			store.acquireWriterLease("project-1", second.lease.ownerId),
		).resolves.toMatchObject({
			kind: "acquired",
			lease: { expiresAtEpochMs: 1_350, fencingToken: 3 },
		});
	});

	it("requires explicit takeover after a restart first observes another writer", async () => {
		let nowEpochMs = 1_000;
		const requiredProjectIds = new Set<string>();
		const takeoverRequirements = {
			requiresExplicitTakeover: (projectId: string) =>
				requiredProjectIds.has(projectId),
			requireExplicitTakeover: (projectId: string) => {
				requiredProjectIds.add(projectId);
			},
			clearExplicitTakeoverRequirement: (projectId: string) => {
				requiredProjectIds.delete(projectId);
			},
		};
		const store = new MemoryVersionedProjectStore({
			nowEpochMs: () => nowEpochMs,
			writerLeaseDurationMs: 100,
		});
		const firstContext = new FencedProjectRepository(
			new DurableProjectRepository(store, async () => "sum:valid"),
			store,
			"phone-a",
		);
		const restartedContext = new FencedProjectRepository(
			new DurableProjectRepository(store, async () => "sum:valid"),
			store,
			"phone-b",
			takeoverRequirements,
		);
		const directCommandContext = new FencedProjectRepository(
			new DurableProjectRepository(store, async () => "sum:valid"),
			store,
			"phone-c",
		);

		await expect(
			firstContext.inspectWriterAccess(candidate.project.projectId),
		).resolves.toMatchObject({ kind: "writable" });
		await expect(
			restartedContext.inspectWriterAccess(candidate.project.projectId),
		).resolves.toEqual({ kind: "read-only", reasonCode: "WRITER_LEASE_HELD" });
		await expect(directCommandContext.publish(candidate)).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});

		nowEpochMs = 1_100;
		await expect(
			directCommandContext.inspectWriterAccess(candidate.project.projectId),
		).resolves.toEqual({ kind: "read-only", reasonCode: "WRITER_LEASE_HELD" });
		const reloadedContext = new FencedProjectRepository(
			new DurableProjectRepository(store, async () => "sum:valid"),
			store,
			"phone-b",
			takeoverRequirements,
		);
		await expect(
			reloadedContext.inspectWriterAccess(candidate.project.projectId),
		).resolves.toEqual({ kind: "read-only", reasonCode: "WRITER_LEASE_HELD" });
		await expect(reloadedContext.publish(candidate)).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		await expect(
			reloadedContext.takeOverWriterLease(candidate.project.projectId),
		).resolves.toMatchObject({ kind: "writable" });
		await expect(reloadedContext.publish(candidate)).resolves.toEqual({
			kind: "durable",
		});
	});

	it("never publishes a stale writer's staging candidate under the current writer fence", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const staleCandidate: PublicationCandidate = {
			...candidate,
			revision: { ...candidate.revision, revisionId: "revision-stale" },
		};
		const currentCandidate: PublicationCandidate = {
			...candidate,
			revision: { ...candidate.revision, revisionId: "revision-current" },
		};
		const firstLease = await store.acquireWriterLease(
			candidate.project.projectId,
			"controller-a",
		);
		if (firstLease.kind !== "acquired") {
			throw new Error("Expected the first writer lease");
		}
		const currentLease = await store.takeOverWriterLease(
			candidate.project.projectId,
			"controller-b",
		);
		const readStaging = store.readStaging.bind(store);
		Object.defineProperty(store, "readStaging", {
			value: async (projectId: string) => {
				await store.writeStaging(staleCandidate);
				return readStaging(projectId);
			},
		});

		await expect(
			repository.publishWithWriterLease(currentCandidate, currentLease),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		await expect(repository.loadCurrent()).resolves.toEqual({ kind: "empty" });
	});

	it("rejects a stale fencing token at the current-pointer boundary without replacing the Durable Revision", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await repository.publish(candidate);
		const acquired = await store.acquireWriterLease(
			"project-1",
			"controller-a",
		);
		if (acquired.kind !== "acquired") {
			throw new Error("Expected the first writer lease");
		}
		await store.takeOverWriterLease("project-1", "controller-b");
		const replacement: PublicationCandidate = {
			...candidate,
			revision: {
				...candidate.revision,
				revisionId: "revision-2",
			},
		};

		await expect(
			repository.publishWithWriterLease(replacement, acquired.lease),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		expect(store.events()).toContain("fence-rejected");
	});

	it("rejects an expired lease at the in-memory pointer boundary", async () => {
		let nowEpochMs = 1_000;
		const store = new MemoryVersionedProjectStore({
			nowEpochMs: () => nowEpochMs,
			writerLeaseDurationMs: 100,
		});
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await repository.publish(candidate);
		const acquired = await store.acquireWriterLease("project-1", "phone-a");
		if (acquired.kind !== "acquired") {
			throw new Error("Expected the initial writer lease");
		}
		const replacement: PublicationCandidate = {
			...candidate,
			revision: { ...candidate.revision, revisionId: "revision-expired" },
		};
		await store.writeStaging(replacement);
		await expect(
			store.publishCurrentPointer(replacement, acquired.lease),
		).resolves.toBe("published");
		await store.writeStaging(replacement);
		await expect(
			store.publishCurrentPointer(replacement, {
				...acquired.lease,
				ownerId: "phone-b",
			}),
		).rejects.toThrow(
			"Writer fence is no longer current before pointer publication",
		);
		await store.writeStaging(replacement);
		await expect(
			store.publishCurrentPointer(replacement, {
				...acquired.lease,
				fencingToken: acquired.lease.fencingToken + 1,
			}),
		).rejects.toThrow(
			"Writer fence is no longer current before pointer publication",
		);
		await store.writeStaging(replacement);
		nowEpochMs = acquired.lease.expiresAtEpochMs;

		await expect(
			store.publishCurrentPointer(replacement, acquired.lease),
		).rejects.toThrow(
			"Writer fence is no longer current before pointer publication",
		);
		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate: replacement,
		});
	});

	it("rejects a stale writer lease before direct permanent deletion and keeps the Project readable", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await repository.publish(candidate);
		const acquired = await store.acquireWriterLease(
			"project-1",
			"controller-a",
		);
		if (acquired.kind !== "acquired") {
			throw new Error("Expected the first writer lease");
		}
		await store.takeOverWriterLease("project-1", "controller-b");

		await expect(
			repository.permanentlyDeleteProject("project-1", acquired.lease),
		).resolves.toEqual({ kind: "persist-failed" });
		await expect(repository.loadProject("project-1")).resolves.toEqual({
			kind: "durable",
			candidate,
		});
	});

	it("strictly decodes a v2 document before publishing its pointer", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(store, async (value) =>
			value === v2Candidate.revision.serializedProject
				? "sum:v2"
				: "sum:invalid",
		);

		await expect(repository.publish(v2Candidate)).resolves.toEqual({
			kind: "durable",
		});
		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate: v2Candidate,
		});
	});

	it("accepts a semantically equal v2 candidate even when its in-memory graph member order is non-canonical", async () => {
		const project = {
			assetDefinitionRefs: [] as const,
			assetInstances: [] as const,
			createdAt: "2026-08-06T13:41:00.000Z",
			level: {
				levelId: "level-1",
				openings: [] as const,
				roomMetadata: [
					{
						faceFingerprint: "orthogonal-face:0:0|0:3100|4100:3100|4100:0",
						heightMm: 2600,
						roomId: "room-1",
					},
				],
				vertices: [
					{ vertexId: "v-4", xMm: 0, zMm: 3100 },
					{ vertexId: "v-3", xMm: 4100, zMm: 3100 },
					{ vertexId: "v-2", xMm: 4100, zMm: 0 },
					{ vertexId: "v-1", xMm: 0, zMm: 0 },
				],
				wallSegments: [
					{
						endVertexId: "v-4",
						startVertexId: "v-3",
						thicknessMm: 100,
						wallSegmentId: "wall-3",
					},
					{
						endVertexId: "v-1",
						startVertexId: "v-4",
						thicknessMm: 100,
						wallSegmentId: "wall-4",
					},
					{
						endVertexId: "v-3",
						startVertexId: "v-2",
						thicknessMm: 100,
						wallSegmentId: "wall-2",
					},
					{
						endVertexId: "v-2",
						startVertexId: "v-1",
						thicknessMm: 100,
						wallSegmentId: "wall-1",
					},
				],
			},
			lifecycle: "active" as const,
			name: "Неупорядоченный v2",
			projectId: "project-v2-unsorted",
			schemaVersion: 2 as const,
			updatedAt: "2026-08-06T13:41:00.000Z",
		};
		const serializedProject = serializeProjectV2Canonically(project);
		const candidate: V2PublicationCandidate = {
			project,
			revision: {
				checksum: "sum:v2-unsorted",
				createdAt: project.updatedAt,
				projectId: project.projectId,
				revisionId: "revision-v2-unsorted",
				schemaVersion: 2,
				serializedProject,
			},
		};
		const repository = new DurableProjectRepository(
			new MemoryVersionedProjectStore(),
			async (value) =>
				value === serializedProject ? "sum:v2-unsorted" : "sum:invalid",
		);

		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "durable",
		});
	});

	it("writes staging, validates it, then atomically publishes the current pointer", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(store, async (value) =>
			value === candidate.revision.serializedProject
				? "sum:valid"
				: "sum:invalid",
		);

		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "durable",
		});
		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		expect(store.events()).toEqual([
			"staging-write",
			"staging-validate",
			"pointer-publish",
		]);
	});

	it("keeps interrupted staging inert during ordinary reads and discards it only on explicit recovery", async () => {
		const store = new MemoryVersionedProjectStore({ failAt: "before-pointer" });
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);

		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		await expect(repository.loadCurrent()).resolves.toEqual({ kind: "empty" });
		await expect(
			store.readStaging(candidate.project.projectId),
		).resolves.toEqual(candidate);
		await expect(repository.recover()).resolves.toEqual({ kind: "recovered" });
		await expect(
			store.readStaging(candidate.project.projectId),
		).resolves.toBeUndefined();
		expect(store.events()).toContain("fault:before-pointer");
		expect(store.events()).toContain("recovery-discard-staging");
	});

	it("keeps the previous Durable Revision readable when a replacement revision fails before pointer publication", async () => {
		const store = new MemoryVersionedProjectStore({ failAt: "before-pointer" });
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await store.seedPublishedPointerWithResidualStaging(candidate);
		const replacement: PublicationCandidate = {
			...candidate,
			revision: {
				...candidate.revision,
				createdAt: "2026-08-05T14:17:16.000Z",
				revisionId: "revision-2",
			},
		};

		await expect(repository.publish(replacement)).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
	});

	it("classifies a quota failure without replacing the previous Durable Revision", async () => {
		const store = new MemoryVersionedProjectStore({
			failAt: "before-pointer-quota",
		});
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await store.seedPublishedPointerWithResidualStaging(candidate);
		const replacement: PublicationCandidate = {
			...candidate,
			revision: {
				...candidate.revision,
				createdAt: "2026-08-05T14:17:16.000Z",
				revisionId: "revision-quota",
			},
		};

		const publication = await repository.publish(replacement);
		expect(store.events()).toContain("fault:before-pointer-quota");
		expect(publication).toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
		});
		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
	});

	it("does not mistake a non-DOM quota-like storage fault for quota exhaustion", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		Object.defineProperty(store, "publishCurrentPointer", {
			value: async () => {
				throw "not a quota error";
			},
		});

		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
	});

	it("retains both the last Durable Revision and unrelated in-flight staging during a read", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await repository.publish(candidate);
		await store.seedInterruptedStaging({
			...candidate,
			revision: { ...candidate.revision, revisionId: "revision-interrupted" },
		});

		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		await expect(
			store.readStaging(candidate.project.projectId),
		).resolves.toMatchObject({
			revision: { revisionId: "revision-interrupted" },
		});
	});

	it("keeps a pointer-published revision readable without deleting residual staging", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await store.seedPublishedPointerWithResidualStaging(candidate);

		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		await expect(
			store.readStaging(candidate.project.projectId),
		).resolves.toEqual(candidate);
	});

	it("does not mutate staged revisions while reading the last Durable Revision", async () => {
		const firstOrphan: PublicationCandidate = {
			...candidate,
			project: { ...candidate.project, projectId: "project-orphan-1" },
			revision: {
				...candidate.revision,
				projectId: "project-orphan-1",
				revisionId: "revision-orphan-1",
			},
		};
		const secondOrphan: PublicationCandidate = {
			...candidate,
			project: { ...candidate.project, projectId: "project-orphan-2" },
			revision: {
				...candidate.revision,
				projectId: "project-orphan-2",
				revisionId: "revision-orphan-2",
			},
		};
		const discardedProjectIds: string[] = [];
		const store = {
			discardStaging: async (projectId: string) => {
				discardedProjectIds.push(projectId);
			},
			publishCurrentPointer: async () => undefined,
			readCurrent: async () => ({ kind: "candidate" as const, candidate }),
			readStaging: async () => undefined,
			readStagingForRecovery: async () => [firstOrphan, secondOrphan],
			writeStaging: async () => undefined,
		} as unknown as VersionedProjectStore;
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);

		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		expect(discardedProjectIds).toEqual([]);
	});

	it("preserves independently staged work while retaining the current candidate", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const firstOrphan: PublicationCandidate = {
			...candidate,
			project: { ...candidate.project, projectId: "project-orphan-1" },
			revision: {
				...candidate.revision,
				projectId: "project-orphan-1",
				revisionId: "revision-orphan-1",
			},
		};
		const secondOrphan: PublicationCandidate = {
			...candidate,
			project: { ...candidate.project, projectId: "project-orphan-2" },
			revision: {
				...candidate.revision,
				projectId: "project-orphan-2",
				revisionId: "revision-orphan-2",
			},
		};

		await expect(repository.publish(candidate)).resolves.toEqual({
			kind: "durable",
		});
		await store.seedInterruptedStaging(firstOrphan);
		await store.seedInterruptedStaging(secondOrphan);

		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate,
		});
		await expect(
			store.readStaging(firstOrphan.project.projectId),
		).resolves.toEqual(firstOrphan);
		await expect(
			store.readStaging(secondOrphan.project.projectId),
		).resolves.toEqual(secondOrphan);
		expect(
			store.events().filter((event) => event === "recovery-discard-staging"),
		).toHaveLength(0);
	});

	it("removes every staged orphan when explicit local recovery is requested", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const firstOrphan: PublicationCandidate = {
			...candidate,
			project: { ...candidate.project, projectId: "project-orphan-1" },
			revision: {
				...candidate.revision,
				projectId: "project-orphan-1",
				revisionId: "revision-orphan-1",
			},
		};
		const secondOrphan: PublicationCandidate = {
			...candidate,
			project: { ...candidate.project, projectId: "project-orphan-2" },
			revision: {
				...candidate.revision,
				projectId: "project-orphan-2",
				revisionId: "revision-orphan-2",
			},
		};
		await store.seedInterruptedStaging(firstOrphan);
		await store.seedInterruptedStaging(secondOrphan);

		await expect(repository.recover()).resolves.toEqual({ kind: "recovered" });
		await expect(
			store.readStaging(firstOrphan.project.projectId),
		).resolves.toBeUndefined();
		await expect(
			store.readStaging(secondOrphan.project.projectId),
		).resolves.toBeUndefined();
	});

	it("treats a current pointer without its Revision as recovery-needed, never as an empty first run", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		await store.seedDanglingCurrentPointer(
			candidate.project.projectId,
			candidate.revision.revisionId,
		);

		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "recovery-needed",
			reasonCode: "PERSISTENCE_CORRUPT",
		});
	});

	it("rejects a checksum-valid revision when its separately supplied Project differs from the serialized snapshot", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(
			store,
			async () => "sum:valid",
		);
		const tamperedCandidate: PublicationCandidate = {
			...candidate,
			project: { ...candidate.project, name: "Подменённое имя" },
		};

		await expect(repository.publish(tamperedCandidate)).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		await expect(repository.loadCurrent()).resolves.toEqual({ kind: "empty" });
	});
});
