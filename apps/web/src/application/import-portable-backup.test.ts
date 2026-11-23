import { describe, expect, it } from "@rstest/core";

import {
	DurableProjectRepository,
	MemoryVersionedProjectStore,
} from "../adapters/persistence/durable-project-repository";
import { copyProject } from "../domain/copy-project";
import { createInitialProject } from "../domain/initial-project";
import type { Project } from "../domain/project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { canonicalProjectSerializer } from "./create-project";
import { PinStagingLeaseCoordinator } from "../adapters/persistence/pin-staging-lease-coordinator";
import type { PinStagingLeaseRecord } from "../adapters/persistence/pin-staging-lease-coordinator";
import {
	type ImportPortableBackupStatus,
	ImportPortableBackupUseCase,
} from "./import-portable-backup";

function sourceProject(): Project {
	return {
		assetDefinitionRefs: [],
		assetInstances: [],
		createdAt: "2026-08-23T07:00:00.000Z",
		level: {
			levelId: "source-level",
			openings: [],
			rooms: [],
			vertices: [],
			wallSegments: [],
		},
		lifecycle: "active",
		name: "Portable transfer",
		projectId: "source-project",
		schemaVersion: 1,
		updatedAt: "2026-08-23T07:00:00.000Z",
	};
}

const checksum = async (value: string): Promise<string> =>
	`checksum:${value.length}`;

const smokeAccepts = {
	verify: async () => true,
};

describe("ImportPortableBackupUseCase", () => {
	it("admits an exact floor angle only from the precise registered project member", async () => {
		const base = rectangularSourceProject();
		const floor = {
			assetInstanceId: "turned", anchorClass: "floor" as const, roomId: base.level.rooms[0].roomId,
			label: "Turned", xMm: 1000, zMm: 1000, widthMm: 400, depthMm: 500, heightMm: 600,
			color: "#ABCDEF",
		};
		const precise: Project = { ...base, assetInstances: [{ ...floor, yawMilliDeg: 37500 }] };
		const ordinary: Project = { ...base, assetInstances: [{ ...floor, yawStep: 1 }] };
		const scenarios = [
			{ format: undefined, source: precise, allowed: false },
			{ format: "runtime-v1-wire", source: precise, allowed: false },
			{ format: "runtime-v1-legacy", source: precise, allowed: false },
			{ format: "runtime-v1-floor-yaw", source: precise, allowed: true },
			{ format: "runtime-v1-floor-yaw", source: ordinary, allowed: false },
			{ format: "runtime-v1-wire", source: ordinary, allowed: true },
			{ format: "runtime-v1-legacy", source: ordinary, allowed: true },
			{ format: "unregistered", source: ordinary, allowed: false },
		];
		for (const { format, source, allowed } of scenarios) {
			const store = new MemoryVersionedProjectStore();
			const repository = new DurableProjectRepository(store, checksum);
			const projectMember = { format: "runtime-v1-wire", project: source } as const;
			Reflect.set(projectMember, "format", format);
			let allocated = 0;
			const importer = new ImportPortableBackupUseCase({
				decoder: { decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					...(format ? { projectMember } : {}),
				}) },
				checksum: { sha256: checksum }, clock: { now: () => "2026-11-22T12:00:00.000Z" },
				ids: { next: () => ["precise-copy", "precise-revision"][allocated++] },
				serializer: canonicalProjectSerializer, repository, smoke: smokeAccepts,
			});
			const result = await importer.execute(Uint8Array.of(80, 75), () => undefined);
			if (!allowed) {
				expect(result).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" });
				expect(allocated).toBe(0);
				continue;
			}
			expect(result).toEqual({ kind: "durable", projectId: "precise-copy", revisionId: "precise-revision" });
			const saved = await repository.loadProject("precise-copy");
			expect(saved).toMatchObject({ kind: "durable", candidate: { project: {
				projectId: "precise-copy", assetInstances: source.assetInstances,
			} } });
		}
	});

	it("preserves an unverified-format handoff as unavailable before IDs, smoke, pins or publication", async () => {
		const effects: string[] = [];
		const useCase = new ImportPortableBackupUseCase({
			decoder: { decode: async () => ({ kind: "verification-unavailable" as const }) },
			checksum: { sha256: async () => { effects.push("checksum"); return "checksum"; } }, clock: { now: () => { effects.push("clock"); return "now"; } }, ids: { next: () => { effects.push("id"); return "id"; } }, serializer: canonicalProjectSerializer,
			smoke: { verify: async () => { effects.push("smoke"); return true; } }, repository: { loadCurrent: async () => ({ kind: "empty" }), recover: async () => ({ kind: "recovered" }), publish: async () => { effects.push("publish"); return { kind: "durable" }; } },
		});
		expect(await useCase.execute(Uint8Array.of(80, 75), () => undefined)).toEqual({ kind: "verification-unavailable" });
		expect(effects).toEqual([]);
	});
	it("publishes the decoder's exact registered V1 object without a lossy JSON parse and keeps original source values", async () => {
		const base = rectangularSourceProject();
		const source: Project = { ...base, projectId: "source-\ud800", level: { ...base.level, vertices: base.level.vertices.map((vertex, index) => index === 0 ? { ...vertex, xMm: -0 } : vertex), rooms: base.level.rooms.map((room) => ({ ...room, name: undefined })) } };
		const store = new MemoryVersionedProjectStore(); const repository = new DurableProjectRepository(store, checksum);
		let allocated = 0;
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum }, clock: { now: () => "2026-11-04T12:00:00.000Z" }, ids: { next: () => ["new-project", "new-revision"][allocated++] }, serializer: canonicalProjectSerializer, repository,
			decoder: { decode: async () => ({ kind: "accepted", projectBytes: Uint8Array.of(123, 125), projectMember: { format: "runtime-v1-wire" as const, project: source } }) },
			smoke: { verify: async (project) => { expect(allocated).toBe(0); expect(Object.is(project.level.vertices[0].xMm, -0)).toBe(true); expect(Object.hasOwn(project.level.rooms[0], "name")).toBe(true); return true; } },
			pinStaging: { requiresPublicationContext: true, begin: async () => { throw new Error("No resource pin is needed"); }, markForPublication: async () => undefined, complete: async () => undefined, discard: async () => undefined },
		});
		expect(await useCase.execute(Uint8Array.of(80, 75), () => undefined)).toEqual({ kind: "durable", projectId: "new-project", revisionId: "new-revision" });
		const loaded = await repository.loadProject("new-project"); if (loaded.kind !== "durable" || loaded.candidate.project.schemaVersion !== 1) throw new Error("Expected exact imported Project");
		expect(Object.is(loaded.candidate.project.level.vertices[0].xMm, -0)).toBe(true);
		expect(Object.hasOwn(loaded.candidate.project.level.rooms[0], "name")).toBe(true);
		expect(loaded.candidate.project.createdAt).toBe(source.createdAt);
		expect(source.projectId).toBe("source-\ud800"); expect(Object.is(source.level.vertices[0].xMm, -0)).toBe(true);
	});
	it("prepares a verified new Project identity before a strong adapter can pin or protect imported bytes", async () => {
		const hash = "a".repeat(64);
		const bytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(hash, bytes.byteLength);
		const stored = new Map<string, Uint8Array>();
		const events: string[] = [];
		let nextId = 0;
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum }, binaryChecksum: { sha256Bytes: async () => hash }, clock: { now: () => "2026-11-04T12:00:00.000Z" }, ids: { next: () => ["import-project", "import-revision"][nextId++] }, serializer: canonicalProjectSerializer,
			decoder: { decode: async () => ({ kind: "accepted", projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)), resources: [{ resourceHash: hash, bytes }] }) },
			smoke: { verify: async () => { events.push("smoke"); return true; } },
			pinStaging: { requiresPublicationContext: true, begin: async (_hashes, context) => { expect(context).toMatchObject({ candidate: { project: { projectId: "import-project", createdAt: source.createdAt, assetDefinitionRefs: source.assetDefinitionRefs }, revision: { revisionId: "import-revision", projectId: "import-project", checksum: expect.any(String) } } }); expect(context?.expectedBaseRevisionId).toBeUndefined(); events.push("prepare"); return { leaseId: "prepared-import", resourceHashes: [hash] }; }, markForPublication: async () => { events.push("mark"); }, complete: async () => { events.push("complete"); }, discard: async () => { events.push("discard"); } },
			resources: { read: async (hash) => stored.get(hash), delete: async () => { throw new Error("Unconditional delete forbidden"); }, writeIfAbsent: async () => { throw new Error("Unjournaled pin forbidden"); }, writeIfAbsentPinned: async (resource, leaseId) => { expect(leaseId).toBe("prepared-import"); expect(events).toEqual(["smoke", "prepare"]); events.push("pin"); stored.set(resource.resourceHash, resource.bytes.slice()); return { kind: "stored" }; } },
			repository: { loadCurrent: async () => ({ kind: "empty" }), recover: async () => ({ kind: "recovered" }), publish: async () => { events.push("publish"); return { kind: "durable" }; } },
		});
		expect(await useCase.execute(Uint8Array.of(80, 75), () => undefined)).toEqual({ kind: "durable", projectId: "import-project", revisionId: "import-revision" });
		expect(events).toEqual(["smoke", "prepare", "pin", "mark", "publish", "complete"]);
		expect(stored.get(hash)).toEqual(bytes);
	});
	it("protects an exact existing resource before publication so its first staging owner cannot delete the imported Project's bytes", async () => {
		const hash = "a".repeat(64);
		const bytes = minimalStaticGlb();
		const records = new Map<string, PinStagingLeaseRecord>();
		let resource: { bytes: Uint8Array; owner?: string } | undefined = { bytes, owner: "first-writer" };
		const journal = { create: async (lease: PinStagingLeaseRecord) => { records.set(lease.leaseId, lease); }, list: async () => [...records.values()], remove: async (id: string) => { records.delete(id); }, markForPublication: async () => undefined };
		const store = { read: async () => resource?.bytes.slice(), delete: async () => { resource = undefined; }, writeIfAbsent: async () => ({ kind: "already-present" as const }), protectExistingResource: async () => { if (!resource) return false; resource = { bytes: resource.bytes }; return true; }, deletePinnedIfOwned: async (_hash: string, owner: string) => { if (resource?.owner === owner) resource = undefined; } };
		const first = new PinStagingLeaseCoordinator({ journal, resources: store, nextLeaseId: () => "first-writer", isPublicationPublished: async () => false });
		const lease = await first.begin([hash]);
		const second = new PinStagingLeaseCoordinator({ journal, resources: store, nextLeaseId: () => "second-writer", isPublicationPublished: async () => false });
		let published = false;
		const useCase = new ImportPortableBackupUseCase({ checksum: { sha256: checksum }, binaryChecksum: { sha256Bytes: async () => hash }, clock: { now: () => "2026-10-24T10:00:00.000Z" }, ids: { next: () => "imported" }, serializer: canonicalProjectSerializer, smoke: smokeAccepts, pinStaging: second, resources: store, decoder: { decode: async () => ({ kind: "accepted", projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(sourceWithCustomGlb(hash, bytes.byteLength))), resources: [{ resourceHash: hash, bytes }] }) }, repository: { publish: async () => { published = true; return { kind: "durable" }; } } as never });
		await expect(useCase.execute(Uint8Array.of(80, 75), () => undefined)).resolves.toMatchObject({ kind: "durable" });
		await first.discard(lease);
		expect(published).toBe(true);
		expect(resource?.bytes).toEqual(bytes);
		expect(await journal.list()).toEqual([]);
	});
	it("pins every decoder-verified custom GLB before publishing its separate imported Project", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(store, checksum);
		const resourceHash = "a".repeat(64);
		const resourceBytes = Uint8Array.of(0x67, 0x6c, 0x54, 0x46);
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const resources = new Map<string, Uint8Array>();
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-23T08:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			repository,
			resources: {
				delete: async (hash) => { resources.delete(hash); },
				read: async () => undefined,
				writeIfAbsent: async (resource) => {
					resources.set(resource.resourceHash, resource.bytes.slice());
					return { kind: "stored" };
				},
			},
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(useCase.execute(Uint8Array.of(7), () => undefined)).resolves.toEqual({
			kind: "durable",
			projectId: "imported-project",
			revisionId: "imported-revision",
		});
		expect(resources.get(resourceHash)).toEqual(resourceBytes);
		await expect(repository.loadProject("imported-project")).resolves.toEqual({
			kind: "durable",
			candidate: expect.objectContaining({
				project: expect.objectContaining({ assetDefinitionRefs: source.assetDefinitionRefs }),
			}),
		});
	});

	it("preserves catalog version identity with the exact pinned bytes across portable-backup import", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(store, checksum);
		const resourceHash = "a".repeat(64);
		const resourceBytes = Uint8Array.of(0x67, 0x6c, 0x54, 0x46);
		const custom = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const source = {
			...custom,
			assetDefinitionRefs: custom.assetDefinitionRefs.map((definition) => ({
				...definition,
				catalogAssetId: "walnut-table",
				catalogEnvelopeHash: "b".repeat(64),
				catalogVersion: "alpha-2026-08-30",
				source: "CatalogVersion",
			})),
		} as unknown as Project;
		const resources = new Map<string, Uint8Array>();
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-30T08:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted" as const,
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			repository,
			resources: {
				delete: async (hash) => { resources.delete(hash); },
				read: async () => undefined,
				writeIfAbsent: async (resource) => {
					resources.set(resource.resourceHash, resource.bytes.slice());
					return { kind: "stored" as const };
				},
			},
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(useCase.execute(Uint8Array.of(7), () => undefined)).resolves.toEqual({
			kind: "durable",
			projectId: "imported-project",
			revisionId: "imported-revision",
		});
		expect(resources.get(resourceHash)).toEqual(resourceBytes);
		await expect(repository.loadProject("imported-project")).resolves.toEqual({
			kind: "durable",
			candidate: expect.objectContaining({
				project: expect.objectContaining({
					assetDefinitionRefs: [
						expect.objectContaining({
							catalogAssetId: "walnut-table",
							catalogEnvelopeHash: "b".repeat(64),
							catalogVersion: "alpha-2026-08-30",
							resourceHash,
							source: "CatalogVersion",
						}),
					],
				}),
			}),
		});
	});

	it("records a recoverable pin-staging lease before writing archive bytes and closes it only after publication", async () => {
		const resourceHash = "a".repeat(64);
		const resourceBytes = Uint8Array.of(0x67, 0x6c, 0x54, 0x46);
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const events: string[] = [];
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-23T08:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			pinStaging: {
				begin: async (hashes) => {
					events.push(`lease:${hashes.join(",")}`);
					return { leaseId: "lease-1", resourceHashes: hashes };
				},
				complete: async () => { events.push("lease:complete"); },
				discard: async () => { events.push("lease:discard"); },
				markForPublication: async (_lease, publication) => {
					events.push(
						`lease:publish:${publication.projectId}:${publication.revisionId}`,
					);
				},
			},
			repository: {
				publish: async () => {
					events.push("publish");
					return { kind: "durable" as const };
				},
			} as never,
			resources: {
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async (resource) => {
					events.push(`write:${resource.resourceHash}`);
					return { kind: "stored" as const };
				},
			},
			serializer: canonicalProjectSerializer,
			smoke: { verify: async () => true },
		});

		await expect(useCase.execute(Uint8Array.of(7), () => undefined)).resolves.toEqual({
			kind: "durable",
			projectId: "imported-project",
			revisionId: "imported-revision",
		});
		expect(events).toEqual([
			`lease:${resourceHash}`,
			`write:${resourceHash}`,
			"lease:publish:imported-project:imported-revision",
			"publish",
			"lease:complete",
		]);
	});

	it("rejects unmatched decoder resources before pinning bytes or allocating an imported identity", async () => {
		const resourceHash = "a".repeat(64);
		const source = sourceWithCustomGlb(resourceHash, 4);
		let writes = 0;
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "must-not-be-used" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: Uint8Array.of(1, 2, 3, 4), resourceHash: "b".repeat(64) }],
				}),
			},
			ids: { next: () => "must-not-be-used" },
			repository: { publish: async () => ({ kind: "durable" }) } as never,
			resources: {
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => { writes += 1; return { kind: "stored" }; },
			},
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(useCase.execute(Uint8Array.of(7), () => undefined)).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
		expect(writes).toBe(0);
	});

	it("retains exact staged custom bytes for the failed candidate's retry and recovery export", async () => {
		const resourceHash = "a".repeat(64);
		const source = sourceWithCustomGlb(resourceHash, 4);
		const events: string[] = [];
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-23T08:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: Uint8Array.of(1, 2, 3, 4), resourceHash }],
				}),
			},
			ids: { next: () => "imported-id" },
			repository: {
				publish: async () => ({ kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" }),
			} as never,
			resources: {
				delete: async (hash) => { events.push(`delete:${hash}`); },
				read: async () => undefined,
				writeIfAbsent: async (resource) => {
					events.push(`write:${resource.resourceHash}`);
					return { kind: "stored" };
				},
			},
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(useCase.execute(Uint8Array.of(7), () => undefined)).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(events).toEqual([`write:${resourceHash}`]);
	});

	it("keeps the marked resource root and reports an exact retry candidate when publication throws", async () => {
		const hash = "a".repeat(64);
		const bytes = Uint8Array.of(1, 2, 3, 4);
		const events: string[] = [];
		const statuses: ImportPortableBackupStatus[] = [];
		const source = sourceWithCustomGlb(hash, bytes.byteLength);
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum }, clock: { now: () => "2026-10-24T10:00:00.000Z" }, ids: { next: () => "new-id" }, serializer: canonicalProjectSerializer, smoke: smokeAccepts,
			decoder: { decode: async () => ({ kind: "accepted", projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)), resources: [{ resourceHash: hash, bytes }] }) },
			pinStaging: { begin: async () => ({ leaseId: "pending-import", resourceHashes: [hash] }), markForPublication: async () => { events.push("mark"); }, complete: async () => { events.push("complete"); }, discard: async () => { events.push("discard"); } },
			resources: { read: async () => undefined, writeIfAbsent: async () => ({ kind: "stored" }), delete: async () => { events.push("delete"); } },
			repository: { publish: async () => { throw new Error("publication unavailable"); } } as never,
		});
		await expect(useCase.execute(Uint8Array.of(80, 75), (status) => statuses.push(status))).resolves.toEqual({ kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
		expect(events).toEqual(["mark"]);
		expect(statuses.at(-1)).toMatchObject({ kind: "persist-failed", candidate: { project: { projectId: "new-id", assetDefinitionRefs: [{ resourceHash: hash }] } } });
	});

	it("publishes a verified resource-free backup as a new Project without touching the source identity", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(store, checksum);
		const source = sourceProject();
		const input = Uint8Array.from([3, 1, 4]);
		let receivedArchive: Uint8Array | undefined;
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-23T08:00:00.000Z" },
			decoder: {
				decode: async (archive) => {
					receivedArchive = archive;
					return {
						kind: "accepted",
						projectBytes: utf8Bytes(
							canonicalProjectSerializer.serialize(source),
						),
					};
				},
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			repository,
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});
		const statuses: string[] = [];

		await expect(
			useCase.execute(input, (status) => statuses.push(status.kind)),
		).resolves.toEqual({
			kind: "durable",
			projectId: "imported-project",
			revisionId: "imported-revision",
		});
		expect(receivedArchive).toEqual(input);
		expect(statuses).toEqual([
			"validating",
			"staging-resources",
			"checking-render",
			"saving",
			"saved",
		]);
		await expect(repository.loadProject("source-project")).resolves.toEqual({
			kind: "empty",
		});
		await expect(repository.loadProject("imported-project")).resolves.toEqual({
			kind: "durable",
			candidate: expect.objectContaining({
				project: expect.objectContaining({
					createdAt: "2026-08-23T07:00:00.000Z",
					projectId: "imported-project",
					updatedAt: "2026-08-23T08:00:00.000Z",
				}),
				revision: expect.objectContaining({
					projectId: "imported-project",
					revisionId: "imported-revision",
				}),
			}),
		});
	});

	it("publishes a new identity without changing any canonical integer-millimetre geometry seen by the prepublication smoke", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(store, checksum);
		const source = rectangularSourceProject();
		const smokeLevels: Project["level"][] = [];
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-26T09:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			repository,
			serializer: canonicalProjectSerializer,
			smoke: {
				verify: async (project) => {
					smokeLevels.push(project.level);
					return true;
				},
			},
		});

		await expect(
			useCase.execute(Uint8Array.of(7), () => undefined),
		).resolves.toMatchObject({
			kind: "durable",
			projectId: "imported-project",
		});
		expect(smokeLevels).toEqual([source.level]);
		const loaded = await repository.loadProject("imported-project");
		expect(loaded).toMatchObject({
			kind: "durable",
			candidate: { project: { level: source.level } },
		});
	});

	it("does not publish or allocate an identity when archive verification rejects", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(store, checksum);
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "must-not-be-used" },
			decoder: {
				decode: async () => ({
					kind: "rejected",
					reasonCode: "PORTABLE_BACKUP_CHECKSUM_MISMATCH",
				}),
			},
			ids: { next: () => "must-not-be-used" },
			repository,
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(
			useCase.execute(Uint8Array.from([9]), () => undefined),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CHECKSUM_MISMATCH",
		});
		await expect(repository.listProjects()).resolves.toEqual({ kind: "empty" });
		expect(store.events()).toEqual([]);
	});

	it("does not publish when the archive passes container checks but its Project member is not canonical", async () => {
		const store = new MemoryVersionedProjectStore();
		const repository = new DurableProjectRepository(store, checksum);
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "must-not-be-used" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes('{"projectId":"source-project"}'),
				}),
			},
			ids: { next: () => "must-not-be-used" },
			repository,
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(
			useCase.execute(Uint8Array.from([9]), () => undefined),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
		await expect(repository.listProjects()).resolves.toEqual({ kind: "empty" });
		expect(store.events()).toEqual([]);
	});

	it("rejects a structurally invalid or noncanonical Project member before it allocates a new identity", async () => {
		const source = sourceProject();
		const cases = [
			canonicalProjectSerializer.serialize({ ...source, name: "" }),
			JSON.stringify(source, null, 2),
		];

		for (const serializedProject of cases) {
			const store = new MemoryVersionedProjectStore();
			const repository = new DurableProjectRepository(store, checksum);
			const useCase = new ImportPortableBackupUseCase({
				checksum: { sha256: checksum },
				clock: { now: () => "must-not-be-used" },
				decoder: {
					decode: async () => ({
						kind: "accepted",
						projectBytes: utf8Bytes(serializedProject),
					}),
				},
				ids: { next: () => "must-not-be-used" },
				repository,
				serializer: canonicalProjectSerializer,
				smoke: smokeAccepts,
			});

			await expect(
				useCase.execute(Uint8Array.from([9]), () => undefined),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PORTABLE_BACKUP_INVALID",
			});
			await expect(repository.listProjects()).resolves.toEqual({
				kind: "empty",
			});
			expect(store.events()).toEqual([]);
		}
	});

	it("reports persistence failure after validation without presenting a Durable Revision", async () => {
		const source = sourceProject();
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-23T08:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			repository: {
				publish: async () => ({
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_WRITE_FAILED",
				}),
			} as never,
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});
		const statuses: string[] = [];

		await expect(
			useCase.execute(Uint8Array.from([3]), (status) =>
				statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(statuses).toEqual([
			"validating",
			"staging-resources",
			"checking-render",
			"saving",
			"persist-failed",
		]);
	});

	it("cancels before identity allocation, removes newly staged bytes and never runs the smoke or publication", async () => {
		const cancellation = { aborted: false };
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const events: string[] = [];
		const statuses: string[] = [];
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "must-not-be-used" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: { next: () => { throw new Error("must not allocate"); } },
			repository: {
				publish: async () => { throw new Error("must not publish"); },
			} as never,
			resources: {
				delete: async (hash) => { events.push(`delete:${hash}`); },
				read: async () => undefined,
				writeIfAbsent: async (resource) => {
					events.push(`write:${resource.resourceHash}`);
					cancellation.aborted = true;
					return { kind: "stored" };
				},
			},
			serializer: canonicalProjectSerializer,
			smoke: {
				verify: async () => { throw new Error("must not smoke"); },
			},
		});

		await expect(
			useCase.execute(
				Uint8Array.of(7),
				(status) => statuses.push(status.kind),
				cancellation,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
		expect(events).toEqual([`write:${resourceHash}`, `delete:${resourceHash}`]);
		expect(statuses).toEqual(["validating", "staging-resources"]);
	});

	it("removes staged bytes when the clean local read/render smoke fails before publication", async () => {
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const events: string[] = [];
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "must-not-be-used" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: { next: () => { throw new Error("must not allocate"); } },
			repository: {
				publish: async () => { throw new Error("must not publish"); },
			} as never,
			resources: {
				delete: async (hash) => { events.push(`delete:${hash}`); },
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			serializer: canonicalProjectSerializer,
			smoke: { verify: async () => false },
		});

		await expect(
			useCase.execute(Uint8Array.of(7), () => undefined),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
		expect(events).toEqual([`delete:${resourceHash}`]);
	});

	it("honours cancellation both before decoder work and immediately after decode", async () => {
		const preCancelled = { aborted: true };
		let decodeCalls = 0;
		const beforeDecode = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "must-not-be-used" },
			decoder: {
				decode: async () => {
					decodeCalls += 1;
					return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
				},
			},
			ids: { next: () => "must-not-be-used" },
			repository: { publish: async () => ({ kind: "durable" }) } as never,
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});
		await expect(
			beforeDecode.execute(Uint8Array.of(7), () => undefined, preCancelled),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
		expect(decodeCalls).toBe(0);

		const afterDecodeSignal = { aborted: false };
		const afterDecode = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "must-not-be-used" },
			decoder: {
				decode: async () => {
					afterDecodeSignal.aborted = true;
					return {
						kind: "accepted",
						projectBytes: utf8Bytes(
							canonicalProjectSerializer.serialize(sourceProject()),
						),
					} as const;
				},
			},
			ids: { next: () => "must-not-be-used" },
			repository: { publish: async () => ({ kind: "durable" }) } as never,
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});
		await expect(
			afterDecode.execute(
				Uint8Array.of(7),
				() => undefined,
				afterDecodeSignal,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
	});

	it("cancels after render smoke but before durable publication, compensating staged bytes", async () => {
		const cancellation = { aborted: false };
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const events: string[] = [];
		const statuses: string[] = [];
		let publications = 0;
		const useCase = new ImportPortableBackupUseCase({
			checksum: {
				sha256: async (value) => {
					cancellation.aborted = true;
					return checksum(value);
				},
			},
			clock: { now: () => "2026-08-28T15:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			pinStaging: {
				begin: async (hashes) => {
					events.push(`lease:${hashes.join(",")}`);
					return { leaseId: "lease-cancel", resourceHashes: hashes };
				},
				complete: async () => undefined,
				discard: async () => { events.push("lease:discard"); },
				markForPublication: async () => undefined,
			},
			repository: {
				publish: async () => {
					publications += 1;
					return { kind: "durable" };
				},
			} as never,
			resources: {
				delete: async (hash) => {
					events.push(`delete:${hash}`);
				},
				read: async () => undefined,
				writeIfAbsent: async (resource) => {
					events.push(`write:${resource.resourceHash}`);
					return { kind: "stored" };
				},
			},
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(
			useCase.execute(
				Uint8Array.of(7),
				(status) => statuses.push(status.kind),
				cancellation,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
		expect(events).toEqual([
			`lease:${resourceHash}`,
			`write:${resourceHash}`,
			"lease:discard",
		]);
		expect(publications).toBe(0);
		expect(statuses).toContain("checking-render");
		expect(statuses).not.toContain("saving");
	});

	it("cancels if the user aborts while the durable pin lease is being marked for publication", async () => {
		const cancellation = { aborted: false };
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const events: string[] = [];
		const statuses: string[] = [];
		let publications = 0;
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-28T16:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			pinStaging: {
				begin: async (hashes) => {
					events.push(`lease:${hashes.join(",")}`);
					return { leaseId: "lease-before-publish", resourceHashes: hashes };
				},
				complete: async () => undefined,
				discard: async () => { events.push("lease:discard"); },
				markForPublication: async () => {
					events.push("lease:marked");
					cancellation.aborted = true;
				},
			},
			repository: {
				publish: async () => {
					publications += 1;
					return { kind: "durable" as const };
				},
			} as never,
			resources: {
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async (resource) => {
					events.push(`write:${resource.resourceHash}`);
					return { kind: "stored" as const };
				},
			},
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(
			useCase.execute(
				Uint8Array.of(7),
				(status) => statuses.push(status.kind),
				cancellation,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
		expect(publications).toBe(0);
		expect(events).toEqual([
			`lease:${resourceHash}`,
			`write:${resourceHash}`,
			"lease:marked",
			"lease:discard",
		]);
		expect(statuses).not.toContain("saving");
	});

	it("cancels if the UI aborts synchronously when import enters its saving status", async () => {
		const cancellation = { aborted: false };
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const events: string[] = [];
		let publications = 0;
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-28T16:01:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected-id";
				})(),
			},
			pinStaging: {
				begin: async (hashes) => ({
					leaseId: "lease-saving-status",
					resourceHashes: hashes,
				}),
				complete: async () => undefined,
				discard: async () => { events.push("lease:discard"); },
				markForPublication: async () => { events.push("lease:marked"); },
			},
			repository: {
				publish: async () => {
					publications += 1;
					return { kind: "durable" as const };
				},
			} as never,
			resources: {
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" as const }),
			},
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(
			useCase.execute(
				Uint8Array.of(7),
				(status) => {
					if (status.kind === "saving") cancellation.aborted = true;
				},
				cancellation,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
		expect(publications).toBe(0);
		expect(events).toEqual(["lease:marked", "lease:discard"]);
	});

	it("classifies an unavailable or failing resource store without allocating an identity", async () => {
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		for (const resources of [
			undefined,
			{
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => {
					throw new Error("quota");
				},
			},
		]) {
			const useCase = new ImportPortableBackupUseCase({
				checksum: { sha256: checksum },
				clock: { now: () => "must-not-be-used" },
				decoder: {
					decode: async () => ({
						kind: "accepted",
						projectBytes: utf8Bytes(
							canonicalProjectSerializer.serialize(source),
						),
						resources: [{ bytes: resourceBytes, resourceHash }],
					}),
				},
				ids: { next: () => { throw new Error("must not allocate"); } },
				repository: {
					publish: async () => { throw new Error("must not publish"); },
				} as never,
				resources,
				serializer: canonicalProjectSerializer,
				smoke: smokeAccepts,
			});

			await expect(
				useCase.execute(Uint8Array.of(7), () => undefined),
			).resolves.toEqual({
				kind: "persist-failed",
				reasonCode: "PERSISTENCE_WRITE_FAILED",
			});
		}
	});

	it("distinguishes cancellation at staging entry, after staging and after smoke while compensating only stored bytes", async () => {
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		for (const cancellationPoint of [
			"staging-entry",
			"staged",
			"smoke",
		] as const) {
			const signal = { aborted: false };
			const events: string[] = [];
			const useCase = new ImportPortableBackupUseCase({
				checksum: { sha256: checksum },
				clock: { now: () => "must-not-be-used" },
				decoder: {
					decode: async () => ({
						kind: "accepted",
						projectBytes: utf8Bytes(
							canonicalProjectSerializer.serialize(source),
						),
						resources: [{ bytes: resourceBytes, resourceHash }],
					}),
				},
				ids: { next: () => { throw new Error("must not allocate"); } },
				repository: {
					publish: async () => { throw new Error("must not publish"); },
				} as never,
				resources: {
					delete: async (hash) => { events.push(`delete:${hash}`); },
					read: async () => undefined,
					writeIfAbsent: async (resource) => {
						events.push(`write:${resource.resourceHash}`);
						return { kind: "stored" };
					},
				},
				serializer: canonicalProjectSerializer,
				smoke: {
					verify: async () => {
						if (cancellationPoint === "smoke") signal.aborted = true;
						return true;
					},
				},
			});

			await expect(
				useCase.execute(
					Uint8Array.of(7),
					(status) => {
						if (
							status.kind === "staging-resources" &&
							((cancellationPoint === "staging-entry" && status.completed === 0) ||
								(cancellationPoint === "staged" && status.completed === 1))
						) {
							signal.aborted = true;
						}
					},
					signal,
				),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PORTABLE_BACKUP_CANCELLED",
			});
			expect(events).toEqual(
				cancellationPoint === "staging-entry"
					? []
					: [`write:${resourceHash}`, `delete:${resourceHash}`],
			);
		}
	});

	it("treats a throwing read/render smoke as validation failure and clears its staged bytes", async () => {
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		const deleted: string[] = [];
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "must-not-be-used" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [{ bytes: resourceBytes, resourceHash }],
				}),
			},
			ids: { next: () => { throw new Error("must not allocate"); } },
			repository: { publish: async () => ({ kind: "durable" }) } as never,
			resources: {
				delete: async (hash) => { deleted.push(hash); },
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			serializer: canonicalProjectSerializer,
			smoke: { verify: async () => { throw new Error("cannot render"); } },
		});

		await expect(
			useCase.execute(Uint8Array.of(7), () => undefined),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
		expect(deleted).toEqual([resourceHash]);
	});

	it("accepts only an already-present resource that can prove exact length and hash", async () => {
		const resourceHash = "a".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlb(resourceHash, resourceBytes.byteLength);
		for (const existing of [
			{ bytes: resourceBytes, checksum: resourceHash, durable: true, protection: true },
			{ bytes: resourceBytes, checksum: resourceHash, durable: false, protection: undefined },
			{ bytes: resourceBytes, checksum: resourceHash, durable: false, protection: false },
			{ bytes: undefined, checksum: resourceHash, durable: false, protection: true },
			{ bytes: resourceBytes.slice(0, -1), checksum: resourceHash, durable: false, protection: true },
			{ bytes: resourceBytes, checksum: "b".repeat(64), durable: false, protection: true },
			{ bytes: resourceBytes, checksum: resourceHash, durable: false, protection: true, throwRead: true },
		] as const) {
			let publications = 0;
			const useCase = new ImportPortableBackupUseCase({
				binaryChecksum: { sha256Bytes: async () => existing.checksum },
				checksum: { sha256: checksum },
				clock: { now: () => "2026-08-26T09:00:00.000Z" },
				decoder: {
					decode: async () => ({
						kind: "accepted",
						projectBytes: utf8Bytes(
							canonicalProjectSerializer.serialize(source),
						),
						resources: [{ bytes: resourceBytes, resourceHash }],
					}),
				},
				ids: {
					next: (() => {
						const values = ["imported-project", "imported-revision"];
						return () => values.shift() ?? "unexpected";
					})(),
				},
				repository: {
					publish: async () => {
						publications += 1;
						return { kind: "durable" };
					},
				} as never,
				resources: {
					delete: async () => undefined,
					read: async () => {
						if ("throwRead" in existing) throw new Error("Resource store unavailable");
						return existing.bytes?.slice();
					},
					protectExistingResource: existing.protection === undefined ? undefined : async () => existing.protection,
					writeIfAbsent: async () => ({ kind: "already-present" }),
				},
				serializer: canonicalProjectSerializer,
				smoke: smokeAccepts,
			});

			const result = await useCase.execute(Uint8Array.of(7), () => undefined);
			if (existing.durable) expect(result.kind).toBe("durable");
			else expect(result).toEqual({ kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
			expect(publications).toBe(existing.durable ? 1 : 0);
		}
	});

	it("reports exact resource-stage progress before the smoke and publication phases", async () => {
		const firstHash = "a".repeat(64);
		const secondHash = "b".repeat(64);
		const resourceBytes = minimalStaticGlb();
		const source = sourceWithCustomGlbs([
			[firstHash, resourceBytes.byteLength],
			[secondHash, resourceBytes.byteLength],
		]);
		const statuses: ImportPortableBackupStatus[] = [];
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-08-26T09:00:00.000Z" },
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					resources: [
						{ bytes: resourceBytes, resourceHash: firstHash },
						{ bytes: resourceBytes, resourceHash: secondHash },
					],
				}),
			},
			ids: {
				next: (() => {
					const values = ["imported-project", "imported-revision"];
					return () => values.shift() ?? "unexpected";
				})(),
			},
			repository: { publish: async () => ({ kind: "durable" }) } as never,
			resources: {
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => ({ kind: "stored" }),
			},
			serializer: canonicalProjectSerializer,
			smoke: smokeAccepts,
		});

		await expect(
			useCase.execute(Uint8Array.of(7), (status) => statuses.push(status)),
		).resolves.toMatchObject({ kind: "durable" });
		expect(statuses).toEqual([
			{ kind: "validating" },
			{ completed: 0, kind: "staging-resources", total: 2 },
			{ completed: 1, kind: "staging-resources", total: 2 },
			{ completed: 2, kind: "staging-resources", total: 2 },
			{ kind: "checking-render" },
			{ kind: "saving" },
			expect.objectContaining({ kind: "saved" }),
		]);
	});
});

function utf8Bytes(value: string): Uint8Array {
	const bytes: number[] = [];
	for (const character of value) {
		const codePoint = character.codePointAt(0);
		if (codePoint === undefined) continue;
		if (codePoint <= 0x7f) bytes.push(codePoint);
		else if (codePoint <= 0x7ff)
			bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
		else if (codePoint <= 0xffff)
			bytes.push(
				0xe0 | (codePoint >> 12),
				0x80 | ((codePoint >> 6) & 0x3f),
				0x80 | (codePoint & 0x3f),
			);
		else
			bytes.push(
				0xf0 | (codePoint >> 18),
				0x80 | ((codePoint >> 12) & 0x3f),
				0x80 | ((codePoint >> 6) & 0x3f),
				0x80 | (codePoint & 0x3f),
			);
	}
	return Uint8Array.from(bytes);
}

function sourceWithCustomGlb(resourceHash: string, byteLength: number): Project {
	return {
		...sourceProject(),
		assetDefinitionRefs: [
			{
				assetDefinitionId: "custom-model",
				byteLength,
				depthMm: 900,
				displayName: "Моя модель",
				format: "glb",
				heightMm: 800,
				resourceHash,
				widthMm: 1000,
			},
		],
	};
}

function sourceWithCustomGlbs(
	resources: readonly (readonly [resourceHash: string, byteLength: number])[],
): Project {
	return {
		...sourceProject(),
		assetDefinitionRefs: resources.map(([resourceHash, byteLength], index) => ({
			assetDefinitionId: `custom-model-${index}`,
			byteLength,
			depthMm: 900,
			displayName: `Моя модель ${index + 1}`,
			format: "glb",
			heightMm: 800,
			resourceHash,
			widthMm: 1000,
		})),
	};
}

function rectangularSourceProject(): Project {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-26T08:00:00.000Z",
			levelId: "level-import",
			name: "Точная геометрия",
			projectId: "source-project",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		{
			next: (() => {
				const values = [
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
				return () => values.shift() ?? "unexpected";
			})(),
		},
		"2026-08-26T08:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected exact rectangular source");
	}
	return configured.project;
}

function minimalStaticGlb(): Uint8Array {
	const json = utf8Bytes('{"asset":{"version":"2.0"}} ');
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

it("an opt-in destination admission refuses only after smoke and before identities or pin staging", async () => {
	for (const outcome of [
		{
			kind: "rejected" as const,
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED" as const,
		},
		{ kind: "verification-unavailable" as const },
	]) {
		const events: string[] = [];
		const source = sourceProject();
		let id = 0;
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-11-04T12:00:00.000Z" },
			ids: {
				next: () => {
					events.push("id");
					return `new-${++id}`;
				},
			},
			serializer: canonicalProjectSerializer,
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
					projectMember: { format: "runtime-v1-wire", project: source },
				}),
			},
			smoke: {
				verify: async () => {
					events.push("smoke");
					return true;
				},
			},
			admission: {
				prepare: async () => {
					events.push("admission");
					return outcome;
				},
				isRetryBlocked: () => false,
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				recover: async () => ({ kind: "recovered" }),
				publish: async () => {
					events.push("publish");
					return { kind: "durable" };
				},
			},
		});
		expect(
			await useCase.execute(Uint8Array.of(80, 75), () => undefined),
		).toEqual(outcome);
		expect(events).toEqual(["smoke", "admission"]);
	}
});

it("an opt-in profile seals the actual candidate before staging and verifies it immediately before the ordinary publication", async () => {
	const events: string[] = [],
		source = sourceProject(),
		owned = copyProject(source);
	let id = 0;
	let sealed: import("./ports").PublicationCandidate | undefined;
	const useCase = new ImportPortableBackupUseCase({
		checksum: { sha256: checksum },
		clock: {
			now: () => {
				events.push("clock");
				return "2026-11-04T12:00:00.000Z";
			},
		},
		ids: {
			next: () => {
				events.push("id");
				return `new-${++id}`;
			},
		},
		serializer: canonicalProjectSerializer,
		decoder: {
			decode: async () => ({
				kind: "accepted",
				projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
				projectMember: { format: "runtime-v1-wire", project: source },
			}),
		},
		smoke: {
			verify: async () => {
				events.push("smoke");
				return true;
			},
		},
		admission: {
			prepare: async () => {
				events.push("admission");
				return {
					kind: "accepted",
					profile: {
						source: owned,
						seal: async (candidate: import("./ports").PublicationCandidate) => {
							events.push("seal");
							expect(candidate.project.level).toBe(owned.level);
							Object.freeze(candidate.project);
							Object.freeze(candidate.revision);
							Object.freeze(candidate);
							sealed = candidate;
							return { kind: "accepted", candidate };
						},
						beforePublish: async (
							candidate: import("./ports").PublicationCandidate,
						) => {
							events.push("proof");
							expect(candidate).toBe(sealed);
							return { kind: "accepted" };
						},
					},
				};
			},
			isRetryBlocked: () => false,
		},
		repository: {
			loadCurrent: async () => ({ kind: "empty" }),
			recover: async () => ({ kind: "recovered" }),
			publish: async (candidate) => {
				events.push("publish");
				expect(candidate).toBe(sealed);
				expect(Object.isFrozen(candidate.project)).toBe(true);
				return { kind: "durable" };
			},
		},
	});
	expect(
		await useCase.execute(Uint8Array.of(80, 75), (status) => {
			if (status.kind === "staging-resources") {
				expect(events).toContain("seal");
				events.push("staging");
			}
			if (status.kind === "saving") events.push("saving");
		}),
	).toMatchObject({ kind: "durable" });
	expect(events).toEqual([
		"smoke",
		"admission",
		"clock",
		"id",
		"id",
		"seal",
		"staging",
		"saving",
		"proof",
		"publish",
	]);
});

it("opt-in admission preserves cancellation when smoke or a later admission adapter throws", async () => {
	for (const failure of ["smoke", "admission"]) {
		const signal = { aborted: false };
		let allocated = 0;
		const source = sourceProject();
		const useCase = new ImportPortableBackupUseCase({
			checksum: { sha256: checksum },
			clock: { now: () => "2026-11-04T12:00:00.000Z" },
			ids: {
				next: () => {
					allocated++;
					return "id";
				},
			},
			serializer: canonicalProjectSerializer,
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: utf8Bytes(canonicalProjectSerializer.serialize(source)),
				}),
			},
			smoke: {
				verify: async () => {
					if (failure === "smoke") {
						signal.aborted = true;
						throw new Error("Smoke cancelled");
					}
					return true;
				},
			},
			admission: {
				prepare: async () => {
					signal.aborted = true;
					throw new Error("Admission cancelled");
				},
				isRetryBlocked: () => false,
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				recover: async () => ({ kind: "recovered" }),
				publish: async () => {
					throw new Error("No publication");
				},
			},
		});
		expect(
			await useCase.execute(Uint8Array.of(80, 75), () => undefined, signal),
		).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" });
		expect(allocated).toBe(0);
	}
});
