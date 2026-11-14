import { describe, expect, it } from "@rstest/core";

import { CreateCustomGlbFloorItemUseCase } from "./create-custom-glb-floor-item";
import { RegisterCustomGlbLibraryAssetUseCase } from "./register-custom-glb-library-asset";
import { canonicalProjectSerializer } from "./create-project";
import type {
	BinaryChecksumPort,
	ChecksumPort,
	ClockPort,
	CustomAssetLibraryPort,
	CustomAssetResourceStorePort,
	DurablePublicationCandidate,
	IdPort,
	PinStagingLeasePort,
	ProjectRepositoryPort,
	PublicationCandidate,
} from "./ports";
import { createInitialProject } from "../domain/initial-project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { createParametricWallItem } from "../domain/parametric-wall-item";
import type { BackupFeasibilityPolicyPort } from "./backup-feasibility-policy";

function ids(...values: string[]): IdPort {
	let index = 0;
	return { next: () => values[index++] ?? `generated-${index}` };
}

function baseCandidate(): PublicationCandidate {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-15T20:25:00.000Z",
			levelId: "level-1",
			name: "GLB project",
			projectId: "project-1",
		}),
		{ depthMm: "4000", heightMm: "2600", widthMm: "5000" },
		ids("v1", "v2", "v3", "v4", "w1", "w2", "w3", "w4", "room-1"),
		"2026-08-15T20:26:00.000Z",
	);
	if (configured.kind !== "accepted") throw new Error("Expected room fixture");
	return {
		project: configured.project,
		revision: {
			checksum: "base",
			createdAt: configured.project.updatedAt,
			projectId: configured.project.projectId,
			revisionId: "revision-1",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(
				configured.project,
			),
		},
	};
}

function staticGlb(): Uint8Array {
	const json =
		'{"asset":{"version":"2.0"},"buffers":[{"byteLength":0}],"scenes":[{"nodes":[]}]}';
	const length = Math.ceil(json.length / 4) * 4;
	const bytes = new Uint8Array(20 + length);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.byteLength, true);
	view.setUint32(12, length, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.set(
		[...json].map((character) => character.charCodeAt(0)),
		20,
	);
	bytes.fill(0x20, 20 + json.length);
	return bytes;
}

const resourceHash = "b".repeat(64);

function input(bytes = staticGlb()) {
	return {
		asset: {
			assetDefinitionId: "custom-armchair",
			byteLength: bytes.byteLength,
			depthMm: 900,
			displayName: "Кресло Sketchfab",
			format: "glb" as const,
			heightMm: 900,
			resourceHash,
			widthMm: 1000,
		},
		color: "#716796",
		glbBytes: bytes,
		roomId: "room-1",
		xMm: 2500,
		zMm: 1900,
	};
}

describe("CreateCustomGlbFloorItemUseCase", () => {
	it("keeps selected model metadata stable while its bytes are checked", async () => {
		const selected = input();
		const name = selected.asset.displayName;
		const stored = new Map<string, Uint8Array>();
		const useCase = createUseCaseFor({
			binaryChecksum: {
				sha256Bytes: async () => {
					selected.asset.displayName = "Later form value";
					return resourceHash;
				},
			},
			resources: {
				read: async (key) => stored.get(key),
				delete: async (key) => {
					stored.delete(key);
				},
				writeIfAbsent: async (resource) => {
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				recover: async () => ({ kind: "recovered" }),
				publish: async (candidate) => {
					expect(candidate.project.assetDefinitionRefs[0].displayName).toBe(
						name,
					);
					return { kind: "durable" };
				},
			},
		});
		expect(
			(await useCase.execute(baseCandidate(), selected, () => undefined)).kind,
		).toBe("durable");
	});
	it("keeps local library metadata and explicit restore intent stable across an asynchronous digest", async () => {
		const selected = { ...input(), restoreRemoved: false };
		const name = selected.asset.displayName;
		const useCase = new RegisterCustomGlbLibraryAssetUseCase({
			binaryChecksum: {
				sha256Bytes: async () => {
					selected.asset.displayName = "Later form value";
					selected.restoreRemoved = true;
					return resourceHash;
				},
			},
			library: {
				list: async () => [],
				register: async (asset, resource, options) => {
					expect(asset.displayName).toBe(name);
					expect(resource.resourceHash).toBe(resourceHash);
					expect(options?.restoreRemoved).toBe(false);
					return { kind: "registered", asset };
				},
			},
		});
		expect((await useCase.execute(selected)).kind).toBe("registered");
	});
	it("pins and publishes a verified case alias at its original raw resource key", async () => {
		const rawHash = resourceHash.toUpperCase();
		const bytes = staticGlb();
		const stored = new Map<string, Uint8Array>();
		const useCase = createUseCaseFor({
			resources: {
				read: async (key) => stored.get(key),
				delete: async (key) => {
					stored.delete(key);
				},
				writeIfAbsent: async (resource) => {
					stored.set(resource.resourceHash, resource.bytes.slice());
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				recover: async () => ({ kind: "recovered" }),
				publish: async (candidate) => {
					expect(candidate.project.assetDefinitionRefs[0].resourceHash).toBe(
						rawHash,
					);
					return { kind: "durable" };
				},
			},
		});
		expect(
			(
				await useCase.execute(
					baseCandidate(),
					{
						...input(bytes),
						asset: { ...input(bytes).asset, resourceHash: rawHash },
					},
					() => undefined,
				)
			).kind,
		).toBe("durable");
		expect([...stored.keys()]).toEqual([rawHash]);
		expect(stored.get(rawHash)).toEqual(bytes);
	});
	it("registers exact case aliases in the local library without rewriting the resource key", async () => {
		const rawHash = resourceHash.toUpperCase();
		const bytes = staticGlb();
		let calls = 0;
		const useCase = libraryUseCaseFor({
			list: async () => [],
			register: async (asset, resource) => {
				calls++;
				expect(asset.resourceHash).toBe(rawHash);
				expect(resource.resourceHash).toBe(rawHash);
				return { kind: "registered", asset };
			},
		});
		expect(
			(
				await useCase.execute({
					asset: { ...input(bytes).asset, resourceHash: rawHash },
					glbBytes: bytes,
				})
			).kind,
		).toBe("registered");
		expect(calls).toBe(1);
	});
	it("uses the registered resource feasibility policy before publication and cleans only its newly staged bytes on refusal", async () => {
		const stored = new Map<string, Uint8Array>();
		let published = 0;
		let assessed = 0;
		const resources: CustomAssetResourceStorePort = {
			read: async (hash) => stored.get(hash),
			delete: async (hash) => {
				stored.delete(hash);
			},
			writeIfAbsent: async (resource) => {
				stored.set(resource.resourceHash, resource.bytes.slice());
				return { kind: "stored" };
			},
		};
		const useCase = createUseCaseFor({
			resources,
			backupFeasibility: {
				assess: async (candidate, ports) => {
					assessed++;
					expect(candidate.project.assetDefinitionRefs[0].resourceHash).toBe(
						resourceHash,
					);
					expect(ports?.resources).toBe(resources);
					expect(stored.size).toBe(1);
					return {
						kind: "rejected",
						reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
					};
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				recover: async () => ({ kind: "recovered" }),
				publish: async () => {
					published++;
					return { kind: "durable" };
				},
			},
		});
		expect(
			await useCase.execute(baseCandidate(), input(), () => undefined),
		).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(assessed).toBe(1);
		expect(published).toBe(0);
		expect(stored.size).toBe(0);
	});
	it("refuses a strong substrate with no atomic pinned-write capability before beginning a journal or writing bytes", async () => {
		const events: string[] = [];
		const useCase = createUseCaseFor({
			pinStaging: {
				requiresPublicationContext: true,
				begin: async () => {
					events.push("begin");
					return { leaseId: "lease", resourceHashes: [resourceHash] };
				},
				markForPublication: async () => undefined,
				complete: async () => undefined,
				discard: async () => {
					events.push("discard");
				},
			},
			resources: {
				delete: async () => {
					events.push("delete");
				},
				read: async () => undefined,
				writeIfAbsent: async () => {
					events.push("unsafe-write");
					return { kind: "stored" };
				},
			},
		});
		expect(
			await useCase.execute(baseCandidate(), input(), () => undefined),
		).toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(events).toEqual([]);
	});
	it("provides the exact candidate and opened base before a strong pin adapter may store bytes", async () => {
		const stored = new Map<string, Uint8Array>();
		const contexts: unknown[] = [];
		const lease = { leaseId: "strong-lease", resourceHashes: [resourceHash] };
		const pinStaging = {
			requiresPublicationContext: true as const,
			begin: async (_hashes: readonly string[], ...arguments_: unknown[]) => {
				const context = arguments_[0];
				expect(context).toMatchObject({
					expectedBaseRevisionId: "revision-1",
					candidate: {
						project: {
							projectId: baseCandidate().project.projectId,
							assetDefinitionRefs: [
								{ resourceHash, byteLength: staticGlb().byteLength },
							],
						},
						revision: {
							projectId: baseCandidate().project.projectId,
							serializedProject: expect.any(String),
							checksum: expect.any(String),
						},
					},
				});
				contexts.push(context);
				return lease;
			},
			markForPublication: async () => undefined,
			complete: async () => undefined,
			discard: async () => undefined,
		};
		const useCase = createUseCaseFor({
			pinStaging,
			resources: {
				delete: async () => undefined,
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async () => {
					throw new Error("Unjournaled write forbidden");
				},
				writeIfAbsentPinned: async (resource, leaseId) => {
					expect(contexts).toHaveLength(1);
					expect(leaseId).toBe(lease.leaseId);
					stored.set(resource.resourceHash, resource.bytes.slice());
					return { kind: "stored" };
				},
			},
		});
		expect(
			await useCase.execute(baseCandidate(), input(), () => undefined),
		).toMatchObject({ kind: "durable" });
		expect(stored.get(resourceHash)).toEqual(staticGlb());
	});
	it("rejects initial cancellation, malformed bytes, declared-byte mismatches and invalid hosts before pinning or publication", async () => {
		for (const scenario of [
			{
				value: input(),
				signal: { aborted: true },
				expected: { kind: "cancelled" },
			},
			{
				value: input(Uint8Array.of(0)),
				signal: undefined,
				expected: { kind: "rejected", reasonCode: "MALFORMED_GLTF" },
			},
			{
				value: {
					...input(),
					asset: { ...input().asset, byteLength: staticGlb().byteLength + 1 },
				},
				signal: undefined,
				expected: {
					kind: "rejected",
					reasonCode: "CUSTOM_ASSET_BYTES_MISMATCH",
				},
			},
			{
				value: { ...input(), roomId: "absent-room" },
				signal: undefined,
				expected: { kind: "rejected", reasonCode: "INVALID_DIMENSION" },
			},
		]) {
			const writes: string[] = [];
			const useCase = createUseCaseFor({
				resources: {
					read: async () => undefined,
					delete: async () => undefined,
					writeIfAbsent: async () => {
						writes.push("write");
						return { kind: "stored" };
					},
				},
				repository: {
					loadCurrent: async () => ({ kind: "empty" }),
					recover: async () => ({ kind: "recovered" }),
					publish: async () => {
						writes.push("publish");
						return { kind: "durable" };
					},
				},
			});
			await expect(
				useCase.execute(
					baseCandidate(),
					scenario.value,
					(status) => writes.push(status.kind),
					scenario.signal,
				),
			).resolves.toEqual(scenario.expected);
			expect(writes).toEqual([]);
		}
	});
	it("pins the exact preflighted snapshot when caller bytes change during digest verification", async () => {
		const original = staticGlb();
		const mutable = original.slice();
		const stored = new Map<string, Uint8Array>();
		let finish: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const useCase = createUseCaseFor({
			binaryChecksum: {
				sha256Bytes: async () => {
					await gate;
					return resourceHash;
				},
			},
			resources: {
				delete: async () => undefined,
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async (resource) => {
					stored.set(resource.resourceHash, resource.bytes.slice());
					return { kind: "stored" };
				},
			},
		});
		const placing = useCase.execute(
			baseCandidate(),
			input(mutable),
			() => undefined,
		);
		mutable.fill(0);
		finish();
		await expect(placing).resolves.toMatchObject({ kind: "durable" });
		expect(stored.get(resourceHash)).toEqual(original);
	});
	it("keeps a new custom-resource pin journaled until its durable floor placement publishes", async () => {
		const events: string[] = [];
		const stored = new Map<string, Uint8Array>();
		const statuses: unknown[] = [];
		const lease = {
			leaseId: "lease-floor-placement",
			resourceHashes: [resourceHash],
		};
		const useCase = createUseCaseFor({
			pinStaging: {
				begin: async (hashes) => {
					events.push(`begin:${hashes.join(",")}`);
					return lease;
				},
				complete: async (completedLease) => {
					events.push(`complete:${completedLease.leaseId}`);
				},
				discard: async (discardedLease) => {
					events.push(`discard:${discardedLease.leaseId}`);
				},
				markForPublication: async (markedLease, publication) => {
					events.push(
						`mark:${markedLease.leaseId}:${publication.projectId}:${publication.revisionId}`,
					);
				},
			},
			resources: {
				delete: async () => undefined,
				read: async (resourceHash) => stored.get(resourceHash),
				writeIfAbsent: async () => {
					events.push("unsafe-write");
					return { kind: "stored" as const };
				},
				writeIfAbsentPinned: async (resource, leaseId) => {
					events.push(`pin:${leaseId}:${resource.resourceHash}`);
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => {
					events.push("publish");
					return { kind: "durable" };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(baseCandidate(), input(), (status) =>
				statuses.push(status),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(statuses).toEqual([
			{ kind: "saving" },
			expect.objectContaining({
				kind: "saved",
				candidate: expect.objectContaining({
					project: expect.objectContaining({ projectId: "project-1" }),
					revision: expect.objectContaining({ revisionId: "revision-2" }),
				}),
			}),
		]);
		expect(events).toEqual([
			`begin:${resourceHash}`,
			`pin:${lease.leaseId}:${resourceHash}`,
			`mark:${lease.leaseId}:project-1:revision-2`,
			"publish",
			`complete:${lease.leaseId}`,
		]);
	});

	it("rejects an infeasible backup candidate before publication and disposes its staged pin", async () => {
		const events: string[] = [];
		const lease = {
			leaseId: "lease-infeasible-floor-placement",
			resourceHashes: [resourceHash],
		};
		const source = baseCandidate();
		const useCase = createUseCaseFor({
			pinStaging: {
				begin: async () => lease,
				complete: async () => {
					events.push("complete");
				},
				discard: async (discardedLease) => {
					events.push(`discard:${discardedLease.leaseId}`);
				},
				markForPublication: async () => {
					events.push("mark");
				},
			},
			resources: {
				delete: async () => {
					events.push("unsafe-delete");
				},
				read: async () => undefined,
				writeIfAbsent: async () => {
					events.push("unsafe-write");
					return { kind: "stored" as const };
				},
				writeIfAbsentPinned: async () => {
					events.push("pin");
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => {
					events.push("publish");
					return { kind: "durable" };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});
		const incompatibleBase: PublicationCandidate = {
			...source,
			project: {
				...source.project,
				assetDefinitionRefs: [
					{
						...input().asset,
						assetDefinitionId: "existing-incompatible-resource",
						byteLength: input().asset.byteLength + 1,
					},
				],
			},
		};

		await expect(
			useCase.execute(incompatibleBase, input(), () => undefined),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(events).toEqual(["pin", `discard:${lease.leaseId}`]);
	});

	it("does not publish an item when its staged pin cannot enter the publication hand-off", async () => {
		const events: string[] = [];
		const stored = new Map<string, Uint8Array>();
		const lease = {
			leaseId: "lease-mark-failure",
			resourceHashes: [resourceHash],
		};
		const useCase = createUseCaseFor({
			pinStaging: {
				begin: async () => lease,
				complete: async () => {
					events.push("complete");
				},
				discard: async (discardedLease) => {
					events.push(`discard:${discardedLease.leaseId}`);
				},
				markForPublication: async () => {
					events.push("mark");
					throw new Error("journal unavailable");
				},
			},
			resources: {
				delete: async () => undefined,
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async () => {
					events.push("unsafe-write");
					return { kind: "stored" as const };
				},
				writeIfAbsentPinned: async (resource, leaseId) => {
					events.push(`pin:${leaseId}`);
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => {
					events.push("publish");
					return { kind: "durable" };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(baseCandidate(), input(), () => undefined),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(events).toEqual([
			`pin:${lease.leaseId}`,
			"mark",
			`discard:${lease.leaseId}`,
		]);
	});

	it("keeps an already durable placement successful when journal completion is deferred to recovery", async () => {
		const events: string[] = [];
		const stored = new Map<string, Uint8Array>();
		const lease = {
			leaseId: "lease-completion-failure",
			resourceHashes: [resourceHash],
		};
		const useCase = createUseCaseFor({
			pinStaging: {
				begin: async () => lease,
				complete: async () => {
					events.push("complete");
					throw new Error("journal unavailable");
				},
				discard: async () => {
					events.push("discard");
				},
				markForPublication: async () => {
					events.push("mark");
				},
			},
			resources: {
				delete: async () => undefined,
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async () => ({ kind: "stored" as const }),
				writeIfAbsentPinned: async (resource) => {
					events.push("pin");
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => {
					events.push("publish");
					return { kind: "durable" };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(baseCandidate(), input(), () => undefined),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(events).toEqual(["pin", "mark", "publish", "complete"]);
	});

	it("cancels a pin admission that is waiting between its journal mark and publication", async () => {
		const events: string[] = [];
		const stored = new Map<string, Uint8Array>();
		const lease = {
			leaseId: "lease-cancelled-floor-placement",
			resourceHashes: [resourceHash],
		};
		let releaseMark: (() => void) | undefined;
		let markStarted: (() => void) | undefined;
		const marked = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			releaseMark = resolve;
		});
		const cancellation = { aborted: false };
		const useCase = createUseCaseFor({
			pinStaging: {
				begin: async () => lease,
				complete: async () => {
					events.push("complete");
				},
				discard: async (discardedLease) => {
					events.push(`discard:${discardedLease.leaseId}`);
				},
				markForPublication: async () => {
					events.push("mark");
					markStarted?.();
					await gate;
				},
			},
			resources: {
				delete: async () => undefined,
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async () => ({ kind: "stored" as const }),
				writeIfAbsentPinned: async (resource) => {
					events.push("pin");
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => {
					events.push("publish");
					return { kind: "durable" };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		const result = useCase.execute(
			baseCandidate(),
			input(),
			() => undefined,
			cancellation,
		);
		await marked;
		cancellation.aborted = true;
		releaseMark?.();

		await expect(result).resolves.toEqual({ kind: "cancelled" });
		expect(events).toEqual(["pin", "mark", `discard:${lease.leaseId}`]);
	});

	it("pins validated GLB bytes before a durable revision references its new custom definition", async () => {
		const events: string[] = [];
		const stored = new Map<string, Uint8Array>();
		const useCase = createUseCaseFor({
			resources: {
				delete: async (hash) => {
					events.push(`delete:${hash}`);
					stored.delete(hash);
				},
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async (resource) => {
					events.push(`write:${resource.resourceHash}`);
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async (candidate) => {
					events.push(
						`publish:${candidate.project.assetDefinitionRefs[0]?.resourceHash}`,
					);
					return { kind: "durable" };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(baseCandidate(), input(), () => undefined),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(events).toEqual([
			`write:${resourceHash}`,
			`publish:${resourceHash}`,
		]);
		expect(stored.get(resourceHash)).toEqual(staticGlb());
	});

	it("does not store any bytes when the GLB does not match the declared resource hash", async () => {
		let writes = 0;
		const useCase = createUseCaseFor({
			resources: {
				delete: async () => undefined,
				read: async () => undefined,
				writeIfAbsent: async () => {
					writes += 1;
					return { kind: "stored" as const };
				},
			},
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{
					...input(),
					asset: { ...input().asset, resourceHash: "c".repeat(64) },
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		expect(writes).toBe(0);
	});

	it("retains exact pending bytes for retry and recovery export when durable publication fails", async () => {
		const events: string[] = [];
		const stored = new Map<string, Uint8Array>();
		const statuses: unknown[] = [];
		const useCase = createUseCaseFor({
			resources: {
				delete: async (hash) => {
					events.push(`delete:${hash}`);
					stored.delete(hash);
				},
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async (resource) => {
					events.push("write");
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" as const };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({
					kind: "persist-failed" as const,
					reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
				}),
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(baseCandidate(), input(), (status) =>
				statuses.push(status),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(events).toEqual(["write"]);
		expect(statuses).toEqual([
			{ kind: "saving" },
			expect.objectContaining({
				kind: "persist-failed",
				reasonCode: "PERSISTENCE_WRITE_FAILED",
				candidate: expect.objectContaining({
					project: expect.objectContaining({
						assetDefinitionRefs: [expect.objectContaining({ resourceHash })],
					}),
				}),
			}),
		]);
		expect(stored.get(resourceHash)).toEqual(staticGlb());
	});

	it("keeps the marked pin lease and exposes the complete candidate when publication throws", async () => {
		const events: string[] = [];
		const stored = new Map<string, Uint8Array>();
		const candidates: PublicationCandidate[] = [];
		const useCase = createUseCaseFor({
			pinStaging: {
				begin: async () => ({
					leaseId: "pending-resource",
					resourceHashes: [resourceHash],
				}),
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
			resources: {
				delete: async (hash) => {
					stored.delete(hash);
					events.push("delete");
				},
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async (resource) => {
					stored.set(resource.resourceHash, resource.bytes.slice());
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				recover: async () => ({ kind: "recovered" }),
				publish: async () => {
					throw new Error("publication failed");
				},
			},
		});
		await expect(
			useCase.execute(baseCandidate(), input(), (status) => {
				if (status.kind === "persist-failed") candidates.push(status.candidate);
			}),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(events).toEqual(["mark"]);
		expect(candidates).toHaveLength(1);
		expect(candidates[0]?.project.assetDefinitionRefs[0]?.resourceHash).toBe(
			resourceHash,
		);
		expect(stored.get(resourceHash)).toEqual(staticGlb());
	});
});

describe("RegisterCustomGlbLibraryAssetUseCase", () => {
	it("rejects invalid metadata after exact byte verification without registering a catalog card", async () => {
		let registrations = 0;
		const useCase = libraryUseCaseFor({
			list: async () => [],
			register: async (asset) => {
				registrations++;
				return { asset, kind: "registered" };
			},
		});
		await expect(
			useCase.execute({
				asset: { ...input().asset, widthMm: 0 },
				glbBytes: staticGlb(),
			}),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "INVALID_CUSTOM_ASSET_DEFINITION",
		});
		expect(registrations).toBe(0);
	});
	it("restores a removed catalog card only for explicit reimport and snapshots bytes before asynchronous verification", async () => {
		const observed: { restore?: boolean; bytes: Uint8Array }[] = [];
		let finish: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const library: CustomAssetLibraryPort = {
			list: async () => [],
			register: async (asset, resource, options) => {
				observed.push({
					restore: options?.restoreRemoved,
					bytes: resource.bytes.slice(),
				});
				return { asset, kind: "registered" };
			},
		};
		const useCase = new RegisterCustomGlbLibraryAssetUseCase({
			binaryChecksum: {
				sha256Bytes: async () => {
					await gate;
					return resourceHash;
				},
			},
			library,
		});
		const bytes = staticGlb();
		const registering = useCase.execute({
			asset: input(bytes).asset,
			glbBytes: bytes,
			restoreRemoved: true,
		});
		bytes.fill(0);
		finish();
		await expect(registering).resolves.toMatchObject({ kind: "registered" });
		expect(observed).toEqual([{ restore: true, bytes: staticGlb() }]);
		await useCase.execute({ asset: input().asset, glbBytes: staticGlb() });
		expect(observed[1]?.restore).toBe(false);
	});
	it("adds exact verified GLB bytes to the shared custom library without creating a Project revision", async () => {
		const events: string[] = [];
		let registeredBytes: Uint8Array | undefined;
		const useCase = libraryUseCaseFor({
			list: async () => [],
			register: async (asset, resource) => {
				events.push(`register:${asset.resourceHash}:${resource.resourceHash}`);
				registeredBytes = resource.bytes;
				return { asset, kind: "registered" };
			},
		});
		const bytes = staticGlb();

		await expect(
			useCase.execute({ asset: input(bytes).asset, glbBytes: bytes }),
		).resolves.toEqual({
			asset: input(bytes).asset,
			kind: "registered",
		});
		expect(events).toEqual([`register:${resourceHash}:${resourceHash}`]);
		expect(registeredBytes).toEqual(bytes);
		expect(registeredBytes).not.toBe(bytes);
		bytes.fill(0x7f);
		expect(registeredBytes).toEqual(staticGlb());
	});

	it("uses the existing shared card on a repeated exact import instead of replacing its metadata", async () => {
		const original = input().asset;
		const existing = {
			...original,
			displayName: "Первое название",
			widthMm: 850,
		};
		const useCase = libraryUseCaseFor({
			list: async () => [existing],
			register: async (_asset, resource) => {
				expect(resource.resourceHash).toBe(resourceHash);
				return { asset: existing, kind: "already-present" };
			},
		});

		await expect(
			useCase.execute({
				asset: { ...original, displayName: "Позднее название", widthMm: 1200 },
				glbBytes: staticGlb(),
			}),
		).resolves.toEqual({ asset: existing, kind: "already-present" });
	});

	it("does not create a shared card when declared metadata or bytes do not identify the verified GLB", async () => {
		let registrations = 0;
		const useCase = libraryUseCaseFor({
			list: async () => [],
			register: async () => {
				registrations += 1;
				return { asset: input().asset, kind: "registered" };
			},
		});

		await expect(
			useCase.execute({
				asset: { ...input().asset, resourceHash: "c".repeat(64) },
				glbBytes: staticGlb(),
			}),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		await expect(
			useCase.execute({
				asset: { ...input().asset, byteLength: staticGlb().byteLength + 1 },
				glbBytes: staticGlb(),
			}),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "CUSTOM_ASSET_BYTES_MISMATCH",
		});
		await expect(
			useCase.execute({
				asset: input().asset,
				glbBytes: new Uint8Array([0x00]),
			}),
		).resolves.toEqual({ kind: "rejected", reasonCode: "MALFORMED_GLTF" });
		expect(registrations).toBe(0);
	});

	it("reports a local storage failure without pretending that the card exists", async () => {
		let registrations = 0;
		const rejectingLibrary = libraryUseCaseFor({
			list: async () => [],
			register: async () => {
				registrations += 1;
				throw new Error("quota");
			},
		});

		await expect(
			rejectingLibrary.execute({ asset: input().asset, glbBytes: staticGlb() }),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(registrations).toBe(1);
	});
});

function createUseCaseFor(overrides: {
	readonly backupFeasibility?: BackupFeasibilityPolicyPort;
	readonly binaryChecksum?: BinaryChecksumPort;
	readonly pinStaging?: PinStagingLeasePort;
	readonly repository?: ProjectRepositoryPort;
	readonly resources: CustomAssetResourceStorePort;
}) {
	return new CreateCustomGlbFloorItemUseCase({
		backupFeasibility: overrides.backupFeasibility,
		binaryChecksum:
			overrides.binaryChecksum ??
			({ sha256Bytes: async () => resourceHash } as BinaryChecksumPort),
		checksum: { sha256: async () => "revision-sum" } as ChecksumPort,
		clock: { now: () => "2026-08-15T20:27:00.000Z" } as ClockPort,
		ids: ids("instance-1", "revision-2"),
		repository: overrides.repository ?? {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => ({ kind: "durable" as const }),
			recover: async () => ({ kind: "recovered" }),
		},
		pinStaging: overrides.pinStaging,
		resources: overrides.resources,
		serializer: canonicalProjectSerializer,
	});
}

function libraryUseCaseFor(
	library: CustomAssetLibraryPort,
): RegisterCustomGlbLibraryAssetUseCase {
	return new RegisterCustomGlbLibraryAssetUseCase({
		binaryChecksum: {
			sha256Bytes: async () => resourceHash,
		} as BinaryChecksumPort,
		library,
	});
}

describe("durable resource-backed wall model", () => {
	it("pins exact bytes and publishes the stable wall address with catalog identity", async () => {
		const bytes = staticGlb();
		const stored = new Map<string, Uint8Array>();
		const published: DurablePublicationCandidate[] = [];
		const useCase = createUseCaseFor({
			resources: {
				delete: async (hash) => {
					stored.delete(hash);
				},
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async (resource) => {
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" };
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				recover: async () => ({ kind: "recovered" }),
				publish: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" };
				},
			},
		});
		const asset = {
			...input(bytes).asset,
			widthMm: 220,
			depthMm: 190,
			heightMm: 280,
			source: "CatalogVersion" as const,
			catalogAssetId: "sconce",
			catalogVersion: "alpha-2026-08-30",
			catalogEnvelopeHash: "c".repeat(64),
		};
		const result = await useCase.execute(
			baseCandidate(),
			{
				anchorClass: "wall",
				asset,
				glbBytes: bytes,
				color: "#716796",
				wallSegmentId: "w1",
				side: "left",
				offsetMm: 1000,
				elevationMm: 1500,
			},
			() => undefined,
		);
		expect(result.kind).toBe("durable");
		expect(published).toHaveLength(1);
		expect(published[0]?.project.assetInstances[0]).toEqual(
			expect.objectContaining({
				anchorClass: "wall",
				wallSegmentId: "w1",
				offsetMm: 1000,
				elevationMm: 1500,
			}),
		);
		expect(published[0]?.project.assetDefinitionRefs[0]).toEqual(asset);
		expect(stored.get(resourceHash)).toEqual(bytes);
	});

	it("returns an accepted wall-panel overlap warning after the exact model placement becomes durable", async () => {
		const base = baseCandidate();
		const panel = createParametricWallItem(
			base.project,
			{
				color: "#716796",
				label: "Existing panel",
				widthMm: 220,
				depthMm: 190,
				heightMm: 280,
				wallSegmentId: "w1",
				side: "left",
				offsetMm: 1000,
				elevationMm: 1500,
			},
			ids("existing-panel"),
			base.project.updatedAt,
		);
		if (panel.kind !== "accepted")
			throw new Error("Expected existing wall-panel fixture");
		const stored = new Map<string, Uint8Array>();
		const useCase = createUseCaseFor({
			resources: {
				delete: async () => undefined,
				read: async (hash) => stored.get(hash),
				writeIfAbsent: async (resource) => {
					stored.set(resource.resourceHash, resource.bytes);
					return { kind: "stored" };
				},
			},
		});
		const bytes = staticGlb();
		const result = await useCase.execute(
			{
				...base,
				project: panel.project,
				revision: {
					...base.revision,
					serializedProject: canonicalProjectSerializer.serialize(
						panel.project,
					),
				},
			},
			{
				anchorClass: "wall",
				asset: {
					...input(bytes).asset,
					widthMm: 220,
					depthMm: 190,
					heightMm: 280,
				},
				glbBytes: bytes,
				color: "#716796",
				wallSegmentId: "w1",
				side: "left",
				offsetMm: 1000,
				elevationMm: 1500,
			},
			() => undefined,
		);
		expect(result).toMatchObject({
			kind: "durable",
			warnings: [{ kind: "wall-item", assetInstanceId: "existing-panel" }],
		});
	});
});
