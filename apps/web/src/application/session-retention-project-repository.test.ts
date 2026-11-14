import { describe, expect, it } from "@rstest/core";

import { createInitialProject } from "../domain/initial-project";
import type { CustomGlbAssetDefinition } from "../domain/project";
import type {
	DurablePublicationCandidate,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
} from "./ports";
import {
	SessionRetentionProjectRepository,
	type SessionHistoryRootsPort,
} from "./session-retention-project-repository";

function asset(
	resourceHash: string,
	byteLength: number,
): CustomGlbAssetDefinition {
	return {
		assetDefinitionId: `definition:${resourceHash}`,
		byteLength,
		depthMm: 100,
		displayName: resourceHash,
		format: "glb",
		heightMm: 100,
		resourceHash,
		widthMm: 100,
	};
}

function candidate(
	revisionId: string,
	resources: readonly CustomGlbAssetDefinition[],
	projectId = "project-1",
): DurablePublicationCandidate {
	const createdAt = "2026-08-22T12:00:00.000Z";
	const project = createInitialProject({
		createdAt,
		levelId: "level-1",
		name: "План",
		projectId,
	});
	return {
		project: { ...project, assetDefinitionRefs: resources },
		revision: {
			checksum: `checksum:${revisionId}`,
			createdAt,
			projectId: project.projectId,
			revisionId,
			schemaVersion: 1,
			serializedProject: "{}",
		},
	};
}

describe("SessionRetentionProjectRepository", () => {
	it("assesses and publishes one owned exact snapshot across asynchronous callbacks", async () => {
		const source = candidate("next", []);
		const originalName = source.project.name;
		let assessed: DurablePublicationCandidate | undefined;
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			recover: async () => ({ kind: "recovered" }),
			publish: async (publication) => {
				expect(publication).toBe(assessed);
				expect(publication.project.name).toBe(originalName);
				return { kind: "durable" };
			},
			publishNextRevision: async () => ({ kind: "durable" }),
		};
		const repository = new SessionRetentionProjectRepository(
			delegate,
			{ snapshot: () => ({ current: undefined, undo: [], redo: [] }) },
			undefined,
			{
				assess: async (publication) => {
					assessed = publication;
					Object.defineProperty(source.project, "name", {
						value: "Caller changed alias",
					});
					await Promise.resolve();
					return { kind: "accepted" };
				},
			},
		);
		expect(await repository.publish(source)).toEqual({ kind: "durable" });
		expect(assessed).not.toBe(source);
	});
	it("uses the registered feasibility assessment with the actual resource ports before ordinary or history publication", async () => {
		const source = candidate("next", []);
		const events: string[] = [];
		const resources = {
			binaryChecksum: { sha256Bytes: async () => "unused" },
			resources: { read: async () => undefined },
		};
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			recover: async () => ({ kind: "recovered" }),
			publish: async () => {
				events.push("publish");
				return { kind: "durable" };
			},
			publishNextRevision: async () => {
				events.push("history");
				return { kind: "durable" };
			},
		};
		const repository = new SessionRetentionProjectRepository(
			delegate,
			{ snapshot: () => ({ current: undefined, undo: [], redo: [] }) },
			resources,
			{
				assess: async (candidate, ports) => {
					expect(candidate).toEqual(source);
					expect(ports).toBe(resources);
					events.push("assessment");
					return {
						kind: "rejected",
						reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
					};
				},
			},
		);
		expect(await repository.publish(source)).toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(
			await repository.publishNextRevision(source, "base", "history"),
		).toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(events).toEqual(["assessment", "assessment"]);
	});
	it("retains the exact publication base through asynchronous resource and history admission", async () => {
		const bases: Array<string | undefined> = [];
		const intents: Array<string | undefined> = [];
		const source = candidate("current", []);
		const next = candidate("next", []);
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: source }),
			recover: async () => ({ kind: "recovered" }),
			publish: async (_candidate, base) => {
				bases.push(base);
				return { kind: "durable" };
			},
			publishNextRevision: async (_candidate, _base, intent) => {
				intents.push(intent);
				return { kind: "durable" };
			},
		};
		const repository = new SessionRetentionProjectRepository(delegate, {
			snapshot: () => ({ current: source, undo: [], redo: [] }),
		});
		expect(await repository.publish(next, "opened-base")).toEqual({
			kind: "durable",
		});
		expect(bases).toEqual(["opened-base"]);
		expect(
			await repository.publishNextRevision(next, "opened-base", "history"),
		).toEqual({ kind: "durable" });
		expect(intents).toEqual(["history"]);
	});

	it("rejects a new Project before publication when its referenced resource cannot fit a Portable Backup", async () => {
		let publishCalls = 0;
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCalls += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const repository = new SessionRetentionProjectRepository(delegate, {
			snapshot: () => ({ current: undefined, redo: [], undo: [] }),
		});

		await expect(
			repository.publish(
				candidate(
					"revision-too-large-for-backup",
					[asset("hash:too-large", 50 * 1024 * 1024 + 1)],
					"project-new",
				),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(publishCalls).toBe(0);
	});

	it("rejects a referenced resource before publication when its exact pinned bytes are unavailable", async () => {
		let publishCalls = 0;
		const resourceHash = "a".repeat(64);
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCalls += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const repository = new SessionRetentionProjectRepository(
			delegate,
			{ snapshot: () => ({ current: undefined, redo: [], undo: [] }) },
			{
				binaryChecksum: { sha256Bytes: async () => resourceHash },
				resources: { read: async () => undefined },
			},
		);

		await expect(
			repository.publish(
				candidate(
					"revision-missing-pinned-resource",
					[asset(resourceHash, 4)],
					"project-pinned-resource",
				),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(publishCalls).toBe(0);
	});

	it("publishes only when every referenced resource has the exact pinned bytes and digest", async () => {
		const resourceHash = "b".repeat(64);
		const bytes = Uint8Array.of(1, 2, 3, 4);
		const outcomes = await Promise.all(
			[
				{ bytes, digest: resourceHash },
				{ bytes: Uint8Array.of(1, 2, 3), digest: resourceHash },
				{ bytes, digest: "c".repeat(64) },
			].map(async ({ bytes: storedBytes, digest }) => {
				let publishCalls = 0;
				const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort =
					{
						loadCurrent: async () => ({ kind: "empty" }),
						publish: async () => {
							publishCalls += 1;
							return { kind: "durable" };
						},
						publishNextRevision: async () => ({ kind: "durable" }),
						recover: async () => ({ kind: "recovered" }),
					};
				const repository = new SessionRetentionProjectRepository(
					delegate,
					{ snapshot: () => ({ current: undefined, redo: [], undo: [] }) },
					{
						binaryChecksum: { sha256Bytes: async () => digest },
						resources: { read: async () => storedBytes },
					},
				);
				const result = await repository.publish(
					candidate(
						`revision-pin-${digest.slice(0, 1)}-${storedBytes.byteLength}`,
						[asset(resourceHash, 4)],
						`project-pin-${digest.slice(0, 1)}-${storedBytes.byteLength}`,
					),
				);
				return { publishCalls, result };
			}),
		);

		expect(outcomes).toEqual([
			{ publishCalls: 1, result: { kind: "durable" } },
			{
				publishCalls: 0,
				result: {
					kind: "persist-failed",
					reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
				},
			},
			{
				publishCalls: 0,
				result: {
					kind: "persist-failed",
					reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
				},
			},
		]);
	});

	it("admits exact Portable Backup resource boundaries and rejects a total payload one byte above them", async () => {
		let publishCalls = 0;
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCalls += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const repository = new SessionRetentionProjectRepository(delegate, {
			snapshot: () => ({ current: undefined, redo: [], undo: [] }),
		});
		const megabyte = 1024 * 1024;
		const exactEnvelope = [45, 45, 45, 45].map((size, index) =>
			asset(`hash:exact-${index}`, size * megabyte),
		);

		await expect(
			repository.publish(
				candidate(
					"revision-exact-backup-envelope",
					exactEnvelope,
					"project-exact",
				),
			),
		).resolves.toEqual({ kind: "durable" });
		await expect(
			repository.publish(
				candidate(
					"revision-over-backup-envelope",
					[...exactEnvelope, asset("hash:one-byte-over", 1)],
					"project-over",
				),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(publishCalls).toBe(1);
	});

	it("rejects malformed canonical Project bytes before a durable pointer can move", async () => {
		let publishCalls = 0;
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCalls += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const repository = new SessionRetentionProjectRepository(delegate, {
			snapshot: () => ({ current: undefined, redo: [], undo: [] }),
		});
		const malformed = candidate("revision-malformed-canonical-bytes", []);

		await expect(
			repository.publish({
				...malformed,
				revision: { ...malformed.revision, serializedProject: "{" },
			} as DurablePublicationCandidate),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(publishCalls).toBe(0);
	});

	it("rejects before publishing when the prospective command would evict neither active redo roots nor their resources", async () => {
		const current = candidate("revision-current", [asset("hash:current", 8)]);
		const redo = [candidate("revision-redo", [asset("hash:redo", 1)])];
		const roots: SessionHistoryRootsPort = {
			snapshot: () => ({
				current,
				limits: { maxResourceBytes: 10, maxResourceEntries: 3 },
				redo,
				undo: [],
			}),
		};
		let publishCalls = 0;
		let publishNextRevisionCalls = 0;
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCalls += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => {
				publishNextRevisionCalls += 1;
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const repository = new SessionRetentionProjectRepository(delegate, roots);

		await expect(
			repository.publish(candidate("revision-next", [asset("hash:next", 2)])),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_HISTORY_RESOURCE_LIMIT",
		});
		expect(publishCalls).toBe(0);
		await expect(
			repository.publishNextRevision(
				candidate("revision-next-cas", [asset("hash:next", 2)]),
				current.revision.revisionId,
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_HISTORY_RESOURCE_LIMIT",
		});
		expect(publishNextRevisionCalls).toBe(0);
		expect(redo).toEqual([candidate("revision-redo", [asset("hash:redo", 1)])]);
	});

	it("delegates an admitted command and read-only repository operations unchanged", async () => {
		const current = candidate("revision-current", [asset("hash:current", 4)]);
		const durable = candidate("revision-durable", [asset("hash:current", 4)]);
		let publishCalls = 0;
		let publishNextRevisionCalls = 0;
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "durable", candidate: durable }),
			publish: async () => {
				publishCalls += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => {
				publishNextRevisionCalls += 1;
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const repository = new SessionRetentionProjectRepository(delegate, {
			snapshot: () => ({
				current,
				limits: { maxResourceBytes: 10, maxResourceEntries: 2 },
				redo: [],
				undo: [],
			}),
		});

		await expect(
			repository.publish(candidate("revision-next", [asset("hash:next", 2)])),
		).resolves.toEqual({
			kind: "durable",
		});
		await expect(
			repository.publishNextRevision(
				candidate("revision-next-cas", [asset("hash:next", 2)]),
				current.revision.revisionId,
			),
		).resolves.toEqual({ kind: "durable" });
		await expect(repository.loadCurrent()).resolves.toEqual({
			kind: "durable",
			candidate: durable,
		});
		await expect(repository.recover()).resolves.toEqual({ kind: "recovered" });
		expect(publishCalls).toBe(1);
		expect(publishNextRevisionCalls).toBe(1);
	});

	it("does not apply an active Project history envelope to a separate project boundary", async () => {
		const current = candidate("revision-current", [asset("hash:current", 8)]);
		let publishCalls = 0;
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCalls += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => ({ kind: "durable" }),
			recover: async () => ({ kind: "recovered" }),
		};
		const repository = new SessionRetentionProjectRepository(delegate, {
			snapshot: () => ({
				current,
				limits: { maxResourceBytes: 10, maxResourceEntries: 3 },
				redo: [candidate("revision-redo", [asset("hash:redo", 1)])],
				undo: [],
			}),
		});

		await expect(
			repository.publish(
				candidate(
					"revision-new-project",
					[asset("hash:new-project", 2)],
					"project-2",
				),
			),
		).resolves.toEqual({ kind: "durable" });
		expect(publishCalls).toBe(1);
	});

	it("also gates a recovery candidate before its durable publication", async () => {
		const recoveryCandidate = candidate("revision-recovery", [
			asset("hash:unresolved", 8),
		]);
		let publishNextRevisionCalls = 0;
		const delegate: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" }),
			publishNextRevision: async () => {
				publishNextRevisionCalls += 1;
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const repository = new SessionRetentionProjectRepository(delegate, {
			snapshot: () => ({
				current: recoveryCandidate,
				limits: { maxResourceBytes: 5, maxResourceEntries: 1 },
				redo: [],
				undo: [],
			}),
		});

		await expect(
			repository.publishNextRevision(
				candidate("revision-recovery-change", []),
				recoveryCandidate.revision.revisionId,
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PROJECT_HISTORY_RESOURCE_LIMIT",
		});
		expect(publishNextRevisionCalls).toBe(0);
	});
});
