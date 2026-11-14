import { describe, expect, it } from "@rstest/core";
import {
	CreateProjectUseCase,
	canonicalProjectSerializer,
} from "../application/create-project";
import { RenameProjectUseCase } from "../application/rename-project";
import { RestartProjectUseCase } from "../application/restart-project";
import { ConfigureRectangularRoomUseCase } from "../application/configure-rectangular-room";
import { CreateCustomGlbFloorItemUseCase } from "../application/create-custom-glb-floor-item";
import { ImportPortableBackupUseCase } from "../application/import-portable-backup";
import { ExportPortableBackupUseCase } from "../application/export-portable-backup";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { FflatePortableBackupDecoder } from "../adapters/portable-backup/fflate-portable-backup-decoder";
import type {
	CustomAssetResourceStorePort,
	CustomAssetLibraryPort,
	BinaryChecksumPort,
	DurablePublicationCandidate,
	PortableBackupDecoderPort,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	PublicationCandidate,
} from "../application/ports";
import { createInitialProject } from "../domain/initial-project";
import { ProjectController } from "./project-controller";

const resourceHash = "a".repeat(64);
const resourceBytes = Uint8Array.of(1, 2, 3);

function source(withResource = false): PublicationCandidate {
	const project = {
		...createInitialProject({
			createdAt: "2026-10-24T10:00:00.000Z",
			levelId: "level",
			name: "План",
			projectId: "project",
		}),
		assetDefinitionRefs: withResource
			? [
					{
						assetDefinitionId: "model",
						byteLength: 3,
						depthMm: 100,
						displayName: "Модель",
						format: "glb" as const,
						heightMm: 100,
						widthMm: 100,
						resourceHash,
					},
				]
			: [],
	};
	return {
		project,
		revision: {
			checksum: "b".repeat(64),
			createdAt: project.updatedAt,
			projectId: project.projectId,
			revisionId: "revision-original",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(project),
		},
	};
}

function session(
	options: {
		candidate?: PublicationCandidate;
		failPublish?: boolean;
		resourcePresent?: boolean;
		decoder?: PortableBackupDecoderPort;
		restore?: boolean;
		binaryChecksum?: BinaryChecksumPort;
		library?: CustomAssetLibraryPort;
		missingRecoveryCapability?: "checksum" | "encoder" | "importer";
		missingBatchRepair?: boolean;
	loadCurrent?: ProjectRepositoryPort["loadCurrent"];
	} = {},
) {
	let current: DurablePublicationCandidate = options.candidate ?? source();
	const publications: DurablePublicationCandidate[] = [];
	const resourceMap = new Map<string, Uint8Array>(
		options.resourcePresent ? [[resourceHash, resourceBytes.slice()]] : [],
	);
	const writes: string[][] = [];
	const batchReplacement: NonNullable<CustomAssetResourceStorePort["writeReplacingBatch"]> = async (batch) => {
		writes.push(batch.map((entry) => entry.resourceHash));
		for (const entry of batch) resourceMap.set(entry.resourceHash, entry.bytes.slice());
	};
	const resources: CustomAssetResourceStorePort = {
		read: async (hash) => resourceMap.get(hash)?.slice(),
		delete: async (hash) => {
			resourceMap.delete(hash);
		},
		writeIfAbsent: async (resource) => {
			if (resourceMap.has(resource.resourceHash))
				return { kind: "already-present" };
			resourceMap.set(resource.resourceHash, resource.bytes.slice());
			return { kind: "stored" };
		},
		...(options.missingBatchRepair ? {} : { writeReplacingBatch: batchReplacement }),
		writeReplacing: async (resource) => {
			writes.push([resource.resourceHash]);
			resourceMap.set(resource.resourceHash, resource.bytes.slice());
		},
	};
	const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
		loadCurrent: options.loadCurrent ?? (async () => ({ kind: "durable", candidate: current })),
		recover: async () => ({ kind: "recovered" }),
		publish: async (candidate) => {
			publications.push(candidate);
			if (options.failPublish)
				return {
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				};
			current = candidate;
			return { kind: "durable" };
		},
		publishNextRevision: async (candidate, expected) => {
			if (expected !== current.revision.revisionId)
				return { kind: "stale-base" };
			publications.push(candidate);
			if (options.failPublish)
				return {
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				};
			current = candidate;
			return { kind: "durable" };
		},
	};
	let id = 0;
	const dependencies = {
		checksum: { sha256: async () => "b".repeat(64) },
		clock: { now: () => "2026-10-24T10:01:00.000Z" },
		ids: { next: () => `new-${++id}` },
		repository,
		serializer: canonicalProjectSerializer,
	};
	const args: ConstructorParameters<typeof ProjectController> = [
		new CreateProjectUseCase(dependencies),
		repository,
	];
	args[19] = {
		renameProject: new RenameProjectUseCase(dependencies),
		restartProject: new RestartProjectUseCase(dependencies),
	};
	args[2] = new ConfigureRectangularRoomUseCase(dependencies);
	args[24] = resources;
	args[25] = options.binaryChecksum ?? {
		sha256Bytes: async (bytes) =>
			bytes.length === 3 && bytes[0] === 1 && bytes[1] === 2 && bytes[2] === 3
				? resourceHash
				: "b".repeat(64),
	};
	args[31] = options.decoder;
	args[19] = {
		...args[19],
		createCustomGlbFloorItem: new CreateCustomGlbFloorItemUseCase({
			...dependencies,
			resources,
			binaryChecksum: args[25],
		}),
	};
	args[26] = options.library;
	if (options.restore && args[25]) {
		args[29] = new ExportPortableBackupUseCase({
			...dependencies,
			binaryChecksum: args[25],
			resources,
			encoder: new FflatePortableBackupEncoder(),
		});
		args[30] = new ImportPortableBackupUseCase({
			...dependencies,
			binaryChecksum: args[25],
			resources,
			decoder: new FflatePortableBackupDecoder(args[25]),
			smoke: { verify: async () => true },
		});
		args[32] = new FflatePortableBackupEncoder();
	}
	if (options.missingRecoveryCapability === "checksum") args[25] = undefined;
	if (options.missingRecoveryCapability === "encoder") args[32] = undefined;
	if (options.missingRecoveryCapability === "importer") args[30] = undefined;
	return {
		controller: new ProjectController(...args),
		publications,
		resourceMap,
		writes,
		current: () => current,
		replaceDurablePointer: (candidate: DurablePublicationCandidate) => {
			current = candidate;
		},
	};
}

const realBinaryChecksum: BinaryChecksumPort = {
	sha256Bytes: async (bytes) =>
		[
			...new Uint8Array(
				await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
			),
		]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join(""),
};

function withExactResources(
	references: readonly {
		readonly resourceHash: string;
		readonly byteLength: number;
	}[],
): PublicationCandidate {
	const base = source();
	const project = {
		...base.project,
		assetDefinitionRefs: references.map((reference, index) => ({
			assetDefinitionId: `model-${index}`,
			byteLength: reference.byteLength,
			depthMm: 100,
			displayName: `Model ${index}`,
			format: "glb" as const,
			heightMm: 100,
			widthMm: 100,
			resourceHash: reference.resourceHash,
		})),
	};
	return {
		project,
		revision: {
			...base.revision,
			serializedProject: canonicalProjectSerializer.serialize(project),
		},
	};
}

describe("controller recovery actions", () => {
	it("keeps the single-file mismatch reason for distinct digests even if no batch capability exists", async () => {
		const first = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const second = await realBinaryChecksum.sha256Bytes(Uint8Array.of(4, 5, 6));
		const app = session({ candidate: withExactResources([first, second].map((resourceHash) => ({ resourceHash, byteLength: 3 }))), binaryChecksum: realBinaryChecksum, missingBatchRepair: true });
		await app.controller.open();
		expect(await app.controller.repairCustomGlbResource(resourceBytes)).toEqual({ kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" });
		expect(app.writes).toEqual([]);
		expect(app.publications).toEqual([]);
	});

	it("preserves the single-resource repaired result shape when history bytes are repaired but durable reopening is unavailable", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const hashes = [lower.toUpperCase(), lower];
		const candidate = withExactResources(hashes.map((resourceHash) => ({ resourceHash, byteLength: 3 })));
		let available = true;
		let current: () => DurablePublicationCandidate = () => candidate;
		const app = session({ candidate, binaryChecksum: realBinaryChecksum, loadCurrent: async () => available ? { kind: "durable", candidate: current() } : { kind: "empty" } });
		current = app.current;
		for (const hash of hashes) app.resourceMap.set(hash, resourceBytes.slice());
		await app.controller.open();
		expect((await app.controller.restartProject()).kind).toBe("durable");
		for (const hash of hashes) app.resourceMap.delete(hash);
		expect(await app.controller.refreshSessionHistoryIntegrity()).toEqual({ kind: "history-resource-issue", resourceHashes: hashes });
		available = false;
		expect(await app.controller.repairCustomGlbResource(resourceBytes)).toEqual({ kind: "repaired", resourceHash: hashes[0] });
		expect(app.writes).toEqual([hashes]);
		expect(app.publications).toHaveLength(1);
	});

	it("retains ordinary single-key repair when no atomic batch port exists", async () => {
		const upper = (
			await realBinaryChecksum.sha256Bytes(resourceBytes)
		).toUpperCase();
		const app = session({
			candidate: withExactResources([{ resourceHash: upper, byteLength: 3 }]),
			binaryChecksum: realBinaryChecksum,
			missingBatchRepair: true,
		});
		await app.controller.open();
		expect(await app.controller.repairCustomGlbResource(resourceBytes)).toEqual(
			{ kind: "recovered", resourceHash: upper },
		);
		expect(app.writes).toEqual([[upper]]);
		expect([...app.resourceMap.keys()]).toEqual([upper]);
	});

	it("owns batch file bytes before asynchronous SHA verification and preserves the verified payload", async () => {
		const upper = (
			await realBinaryChecksum.sha256Bytes(resourceBytes)
		).toUpperCase();
		let release: () => void = () => undefined;
		let arrived: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const started = new Promise<void>((resolve) => {
			arrived = resolve;
		});
		let first = true;
		const checksum: BinaryChecksumPort = {
			sha256Bytes: async (bytes) => {
				const hash = await realBinaryChecksum.sha256Bytes(bytes);
				if (first) {
					first = false;
					arrived();
					await gate;
				}
				return hash;
			},
		};
		const app = session({
			candidate: withExactResources([{ resourceHash: upper, byteLength: 3 }]),
			binaryChecksum: checksum,
		});
		await app.controller.open();
		const input = resourceBytes.slice();
		const repair = app.controller.repairCustomGlbResources([input]);
		await started;
		input.fill(9);
		release();
		expect(await repair).toEqual({
			kind: "recovered",
			resourceHashes: [upper],
		});
		expect(app.resourceMap.get(upper)).toEqual(resourceBytes);
		expect(app.publications).toEqual([]);
	});

	it("gives the canonical decoder owned backup bytes before it can asynchronously inspect them", async () => {
		const hash = await realBinaryChecksum.sha256Bytes(resourceBytes);
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const app = session({
			candidate: withExactResources([{ resourceHash: hash, byteLength: 3 }]),
			binaryChecksum: realBinaryChecksum,
			decoder: {
				decode: async (owned) => {
					await gate;
					return owned[0] === 80
						? {
								kind: "accepted",
								projectBytes: new Uint8Array(),
								resources: [{ resourceHash: hash, bytes: resourceBytes }],
							}
						: { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
				},
			},
		});
		await app.controller.open();
		const sourceBytes = Uint8Array.of(80, 75);
		const repair =
			app.controller.repairResourcesFromPortableBackup(sourceBytes);
		sourceBytes.fill(0);
		release();
		expect(await repair).toEqual({ kind: "recovered", resourceHashes: [hash] });
		expect(app.writes).toEqual([[hash]]);
		expect(app.publications).toEqual([]);
	});

	it("does not repair a newly opened Project from an older backup request even when its missing raw hash is the same", async () => {
		const hash = (
			await realBinaryChecksum.sha256Bytes(resourceBytes)
		).toUpperCase();
		const candidate = withExactResources([
			{ resourceHash: hash, byteLength: 3 },
		]);
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const app = session({
			candidate,
			binaryChecksum: realBinaryChecksum,
			decoder: {
				decode: async () => {
					await gate;
					return {
						kind: "accepted",
						projectBytes: new Uint8Array(),
						resources: [{ resourceHash: hash, bytes: resourceBytes }],
					};
				},
			},
		});
		await app.controller.open();
		const repair = app.controller.repairResourcesFromPortableBackup(
			Uint8Array.of(80, 75),
		);
		const project = {
			...candidate.project,
			projectId: "other-project",
			name: "Other",
		};
		const other = {
			project,
			revision: {
				...candidate.revision,
				projectId: project.projectId,
				revisionId: "other-revision",
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		app.replaceDurablePointer(other);
		await app.controller.open();
		release();
		expect(await repair).toEqual({ kind: "not-ready" });
		expect(app.writes).toEqual([]);
		expect(app.publications).toEqual([]);
		expect(app.current()).toBe(other);
		expect(app.controller.snapshot().kind).toBe("recovery-needed");
	});

	it("does not fall back to individual writes when aliases require an unavailable atomic batch port", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const hashes = [lower, lower.toUpperCase()];
		const app = session({
			candidate: withExactResources(
				hashes.map((resourceHash) => ({ resourceHash, byteLength: 3 })),
			),
			binaryChecksum: realBinaryChecksum,
			missingBatchRepair: true,
		});
		await app.controller.open();
		expect(await app.controller.repairCustomGlbResource(resourceBytes)).toEqual(
			{ kind: "not-ready" },
		);
		expect(app.writes).toEqual([]);
		expect(app.resourceMap.size).toBe(0);
		expect(app.publications).toEqual([]);
	});

	it("rechecks exact SHA and length for backup aliases and never replaces out-of-scope addresses", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const upper = lower.toUpperCase();
		const outside = Uint8Array.of(7, 8, 9);
		const outsideHash = await realBinaryChecksum.sha256Bytes(outside);
		for (const kind of [
			"healthy-extra",
			"corrupt",
			"wrong-length",
			"wrong-descriptor",
		] as const) {
			const candidate = withExactResources([
				{ resourceHash: upper, byteLength: kind === "wrong-length" ? 4 : 3 },
			]);
			const app = session({
				candidate,
				binaryChecksum: realBinaryChecksum,
				decoder: {
					decode: async () => ({
						kind: "accepted",
						projectBytes: new Uint8Array(),
						resources: [
							{
								resourceHash: kind === "wrong-descriptor" ? outsideHash : lower,
								bytes:
									kind === "corrupt" ? Uint8Array.of(3, 2, 1) : resourceBytes,
							},
							{ resourceHash: outsideHash, bytes: outside },
						],
					}),
				},
			});
			await app.controller.open();
			expect(
				await app.controller.repairResourcesFromPortableBackup(
					Uint8Array.of(80, 75),
				),
			).toEqual(
				kind === "healthy-extra"
					? { kind: "recovered", resourceHashes: [upper] }
					: { kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" },
			);
			expect(app.writes).toEqual(kind === "healthy-extra" ? [[upper]] : []);
			expect(app.resourceMap.has(outsideHash)).toBe(false);
			expect(app.resourceMap.has(lower)).toBe(false);
			expect(app.publications).toEqual([]);
		}
	});

	it("repairs a Redo-only resource with its real SHA without publishing another Revision or dropping Redo", async () => {
		const json =
			'{"asset":{"version":"2.0"},"buffers":[{"byteLength":0}],"scenes":[{"nodes":[]}]}';
		const jsonLength = Math.ceil(json.length / 4) * 4;
		const bytes = new Uint8Array(20 + jsonLength);
		const view = new DataView(bytes.buffer);
		view.setUint32(0, 0x46546c67, true);
		view.setUint32(4, 2, true);
		view.setUint32(8, bytes.length, true);
		view.setUint32(12, jsonLength, true);
		view.setUint32(16, 0x4e4f534a, true);
		bytes.set(new TextEncoder().encode(json), 20);
		bytes.fill(32, 20 + json.length);
		const hash = await realBinaryChecksum.sha256Bytes(bytes);
		const app = session({ binaryChecksum: realBinaryChecksum });
		await app.controller.open();
		expect(
			(
				await app.controller.configureRectangularRoom({
					depthMm: "4000",
					heightMm: "2600",
					widthMm: "5000",
				})
			).kind,
		).toBe("durable");
		const configured = app.current().project;
		if (configured.schemaVersion !== 1) throw new Error("Expected V1 room");
		const roomId = configured.level.rooms[0]?.roomId;
		if (!roomId) throw new Error("No room");
		expect(
			(
				await app.controller.createCustomGlbFloorItem({
					asset: {
						assetDefinitionId: "redo-model",
						resourceHash: hash,
						byteLength: bytes.length,
						format: "glb",
						displayName: "Redo model",
						widthMm: 100,
						depthMm: 100,
						heightMm: 100,
					},
					glbBytes: bytes,
					color: "#716796",
					roomId,
					xMm: 2000,
					zMm: 2000,
				})
			).kind,
		).toBe("durable");
		expect((await app.controller.undo()).kind).toBe("durable");
		const count = app.publications.length;
		app.resourceMap.delete(hash);
		expect(await app.controller.refreshSessionHistoryIntegrity()).toEqual({
			kind: "history-resource-issue",
			resourceHashes: [hash],
		});
		expect(await app.controller.repairCustomGlbResources([bytes])).toEqual({
			kind: "recovered",
			resourceHashes: [hash],
		});
		expect(app.writes).toEqual([[hash]]);
		expect(app.publications).toHaveLength(count);
		expect(app.controller.sessionHistory().canRedo).toBe(true);
		expect((await app.controller.redo()).kind).toBe("durable");
		expect(app.controller.snapshot().kind).toBe("saved");
	});

	it("repairs local raw aliases from one canonical backup decoder result without publishing or normalizing its source keys", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const upper = lower.toUpperCase();
		const at = lower.search(/[a-f]/);
		const mixed = upper.slice(0, at) + lower[at] + upper.slice(at + 1);
		const expected = [upper, mixed];
		let decodes = 0;
		const candidate = withExactResources(
			expected.map((resourceHash) => ({
				resourceHash,
				byteLength: resourceBytes.length,
			})),
		);
		const app = session({
			candidate,
			binaryChecksum: realBinaryChecksum,
			decoder: {
				decode: async () => {
					decodes++;
					return {
						kind: "accepted",
						projectBytes: new Uint8Array(),
						resources: [{ resourceHash: lower, bytes: resourceBytes }],
					};
				},
			},
		});
		await app.controller.open();
		expect(
			await app.controller.repairResourcesFromPortableBackup(
				Uint8Array.of(80, 75),
			),
		).toEqual({ kind: "recovered", resourceHashes: expected });
		expect(decodes).toBe(1);
		expect(app.writes).toEqual([expected]);
		for (const hash of expected)
			expect(app.resourceMap.get(hash)).toEqual(resourceBytes);
		expect(app.resourceMap.has(lower)).toBe(false);
		expect(app.publications).toEqual([]);
		expect(app.current()).toBe(candidate);
	});

	it("keeps unavailable canonical backup verification separate from corrupt-schema reasons without any fallback", async () => {
		const hash = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const candidate = withExactResources([
			{ resourceHash: hash, byteLength: resourceBytes.length },
		]);
		let decodes = 0;
		const app = session({
			candidate,
			binaryChecksum: realBinaryChecksum,
			decoder: {
				decode: async () => {
					decodes++;
					return { kind: "verification-unavailable" };
				},
			},
		});
		await app.controller.open();
		expect(
			await app.controller.repairResourcesFromPortableBackup(
				Uint8Array.of(80, 75),
			),
		).toEqual({ kind: "not-ready" });
		expect(decodes).toBe(1);
		expect(app.writes).toEqual([]);
		expect(app.publications).toEqual([]);
		expect(app.controller.snapshot().kind).toBe("recovery-needed");
	});

	it("restores uppercase-only references at their original address through single and batch repair", async () => {
		const upper = (
			await realBinaryChecksum.sha256Bytes(resourceBytes)
		).toUpperCase();
		for (const kind of ["single", "batch"] as const) {
			const candidate = withExactResources([
				{ resourceHash: upper, byteLength: resourceBytes.length },
			]);
			const app = session({ candidate, binaryChecksum: realBinaryChecksum });
			await app.controller.open();
			expect(
				await (kind === "single"
					? app.controller.repairCustomGlbResource(resourceBytes)
					: app.controller.repairCustomGlbResources([resourceBytes])),
			).toEqual(
				kind === "single"
					? { kind: "recovered", resourceHash: upper }
					: { kind: "recovered", resourceHashes: [upper] },
			);
			expect([...app.resourceMap.keys()]).toEqual([upper]);
			expect(app.writes).toEqual([[upper]]);
			expect(app.publications).toEqual([]);
		}
	});

	it("rejects one file for two distinct digests and requires exactly one verified file per digest in a batch", async () => {
		const other = Uint8Array.of(4, 5, 6);
		const outside = Uint8Array.of(7, 8, 9);
		const firstHash = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const secondHash = (
			await realBinaryChecksum.sha256Bytes(other)
		).toUpperCase();
		const hashes = [firstHash.toUpperCase(), firstHash, secondHash];
		for (const files of [
			[resourceBytes],
			[resourceBytes, resourceBytes],
			[resourceBytes, outside],
			[resourceBytes, other, outside],
		]) {
			const app = session({
				candidate: withExactResources(
					hashes.map((resourceHash) => ({ resourceHash, byteLength: 3 })),
				),
				binaryChecksum: realBinaryChecksum,
			});
			await app.controller.open();
			expect(
				await app.controller.repairCustomGlbResource(resourceBytes),
			).toEqual({ kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" });
			expect(await app.controller.repairCustomGlbResources(files)).toEqual({
				kind: "rejected",
				reasonCode: "RESOURCE_HASH_MISMATCH",
			});
			expect(app.writes).toEqual([]);
			expect(app.publications).toEqual([]);
		}
		const app = session({
			candidate: withExactResources(
				hashes.map((resourceHash) => ({ resourceHash, byteLength: 3 })),
			),
			binaryChecksum: realBinaryChecksum,
		});
		await app.controller.open();
		expect(
			await app.controller.repairCustomGlbResources([other, resourceBytes]),
		).toEqual({ kind: "recovered", resourceHashes: hashes });
		expect(app.writes).toEqual([hashes]);
		expect(app.resourceMap.get(firstHash)).toEqual(resourceBytes);
		expect(app.resourceMap.get(firstHash.toUpperCase())).toEqual(resourceBytes);
		expect(app.resourceMap.get(secondHash)).toEqual(other);
		expect(app.publications).toEqual([]);
	});

	it("does not replace any alias when its recorded length cannot be satisfied by the exact digest file", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const upper = lower.toUpperCase();
		for (const references of [
			[{ resourceHash: upper, byteLength: 4 }],
			[
				{ resourceHash: lower, byteLength: 3 },
				{ resourceHash: upper, byteLength: 4 },
			],
			[
				{ resourceHash: upper, byteLength: 3 },
				{ resourceHash: upper, byteLength: 4 },
			],
		]) {
			for (const kind of ["single", "batch"] as const) {
				const app = session({
					candidate: withExactResources(references),
					binaryChecksum: realBinaryChecksum,
				});
				await app.controller.open();
				expect(
					await (kind === "single"
						? app.controller.repairCustomGlbResource(resourceBytes)
						: app.controller.repairCustomGlbResources([resourceBytes])),
				).toEqual({ kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" });
				expect(app.writes).toEqual([]);
				expect(app.publications).toEqual([]);
				expect(app.resourceMap.size).toBe(0);
				expect(app.controller.snapshot().kind).toBe("recovery-needed");
			}
		}
	});

	it("rejects malformed non-SHA keys and a wrong same-length file without alias guessing", async () => {
		const hash = await realBinaryChecksum.sha256Bytes(resourceBytes);
		for (const raw of [
			hash.toUpperCase(),
			` ${hash}`,
			hash.slice(1),
			"g".repeat(64),
		]) {
			const app = session({
				candidate: withExactResources([{ resourceHash: raw, byteLength: 3 }]),
				binaryChecksum: realBinaryChecksum,
			});
			await app.controller.open();
			expect(
				await app.controller.repairCustomGlbResources([Uint8Array.of(3, 2, 1)]),
			).toEqual({ kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" });
			if (raw !== hash.toUpperCase())
				expect(
					await app.controller.repairCustomGlbResource(resourceBytes),
				).toEqual({ kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" });
			expect(app.writes).toEqual([]);
			expect(app.publications).toEqual([]);
		}
	});

	it("repairs exact aliases across current and Undo roots without creating another Revision or losing Undo", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const upper = lower.toUpperCase();
		const hashes = [lower, upper];
		const candidate = withExactResources(
			hashes.map((resourceHash) => ({ resourceHash, byteLength: 3 })),
		);
		const app = session({ candidate, binaryChecksum: realBinaryChecksum });
		for (const hash of hashes) app.resourceMap.set(hash, resourceBytes.slice());
		await app.controller.open();
		expect((await app.controller.renameProject("Следующая ревизия")).kind).toBe(
			"durable",
		);
		app.resourceMap.delete(upper);
		expect(await app.controller.refreshSessionHistoryIntegrity()).toEqual({
			kind: "current-resource-issue",
		});
		expect(await app.controller.repairCustomGlbResource(resourceBytes)).toEqual(
			{ kind: "recovered", resourceHash: upper },
		);
		expect(app.writes).toEqual([[upper]]);
		expect(app.publications).toHaveLength(1);
		expect(app.controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
		expect(await app.controller.undo()).toMatchObject({
			kind: "durable",
			revisionId: "revision-original",
		});
		expect(app.controller.snapshot().kind).toBe("saved");
	});

	it("repairs Undo-only aliases as one digest while retaining the healthy current Project and its Redo path", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const upper = lower.toUpperCase();
		const hashes = [upper, lower];
		const candidate = withExactResources(
			hashes.map((resourceHash) => ({ resourceHash, byteLength: 3 })),
		);
		const app = session({ candidate, binaryChecksum: realBinaryChecksum });
		for (const hash of hashes) app.resourceMap.set(hash, resourceBytes.slice());
		await app.controller.open();
		expect((await app.controller.restartProject()).kind).toBe("durable");
		for (const hash of hashes) app.resourceMap.delete(hash);
		expect(await app.controller.refreshSessionHistoryIntegrity()).toEqual({
			kind: "history-resource-issue",
			resourceHashes: hashes,
		});
		expect(await app.controller.repairCustomGlbResource(resourceBytes)).toEqual(
			{ kind: "recovered", resourceHash: upper },
		);
		expect(app.writes).toEqual([hashes]);
		expect(app.publications).toHaveLength(1);
		expect(await app.controller.undo()).toMatchObject({
			kind: "durable",
			revisionId: "revision-original",
		});
		expect(app.controller.sessionHistory()).toEqual({
			canUndo: false,
			canRedo: true,
		});
		expect(app.controller.snapshot().kind).toBe("saved");
	});

	it("accepts uppercase SHA bits only at the exact persisted resource key and still rejects missing, corrupt, or wrong-length bytes", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const upper = lower.toUpperCase();
		expect(upper).not.toBe(lower);
		for (const kind of [
			"healthy",
			"lower-key-only",
			"corrupt",
			"wrong-length",
			"metadata-length",
		] as const) {
			const candidate = withExactResources([
				{
					resourceHash: upper,
					byteLength: kind === "metadata-length" ? 4 : resourceBytes.length,
				},
			]);
			const app = session({ candidate, binaryChecksum: realBinaryChecksum });
			app.resourceMap.set(
				kind === "lower-key-only" ? lower : upper,
				kind === "corrupt"
					? Uint8Array.of(1, 2, 4)
					: kind === "wrong-length"
						? resourceBytes.slice(1)
						: resourceBytes.slice(),
			);
			await app.controller.open();
			expect(app.controller.snapshot().kind).toBe(
				kind === "healthy" ? "saved" : "recovery-needed",
			);
			expect(app.writes).toEqual([]);
			expect(app.publications).toEqual([]);
			expect(app.current()).toBe(candidate);
		}
	});

	it("repairs all exact raw aliases from one verified file in one batch without creating a Revision", async () => {
		const lower = await realBinaryChecksum.sha256Bytes(resourceBytes);
		const upper = lower.toUpperCase();
		const at = lower.search(/[a-f]/);
		const mixed = upper.slice(0, at) + lower[at] + upper.slice(at + 1);
		const hashes = [upper, lower, mixed];
		expect(new Set(hashes).size).toBe(3);
		const candidate = withExactResources(
			hashes.map((resourceHash) => ({
				resourceHash,
				byteLength: resourceBytes.length,
			})),
		);
		const app = session({ candidate, binaryChecksum: realBinaryChecksum });
		await app.controller.open();
		expect(app.controller.snapshot().kind).toBe("recovery-needed");
		expect(await app.controller.repairCustomGlbResource(resourceBytes)).toEqual(
			{ kind: "recovered", resourceHash: upper },
		);
		expect(app.writes).toEqual([hashes]);
		for (const hash of hashes)
			expect(app.resourceMap.get(hash)).toEqual(resourceBytes);
		expect(app.controller.snapshot().kind).toBe("saved");
		expect(app.publications).toEqual([]);
		expect(app.current()).toBe(candidate);
	});

	for (const repairKind of ["single", "batch", "backup"] as const) {
		it(`repairs current corruption after a prior history issue through ${repairKind}, then restores the history issue without losing Undo`, async () => {
			const json = '{"asset":{"version":"2.0"},"buffers":[{"byteLength":0}],"scenes":[{"nodes":[]}]}';
			const jsonLength = Math.ceil(json.length / 4) * 4;
			const bytes = new Uint8Array(20 + jsonLength);
			const view = new DataView(bytes.buffer);
			view.setUint32(0, 0x46546c67, true);
			view.setUint32(4, 2, true);
			view.setUint32(8, bytes.byteLength, true);
			view.setUint32(12, jsonLength, true);
			view.setUint32(16, 0x4e4f534a, true);
			bytes.set(new TextEncoder().encode(json), 20);
			bytes.fill(0x20, 20 + json.length);
			const currentHash = "b".repeat(64);
			const app = session({
				candidate: source(true),
				resourcePresent: true,
				decoder: { decode: async () => ({
					kind: "accepted", projectBytes: new Uint8Array(),
					resources: [{ resourceHash: currentHash, bytes }, { resourceHash, bytes: resourceBytes }],
				}) },
			});
			await app.controller.open();
			expect((await app.controller.restartProject()).kind).toBe("durable");
			expect((await app.controller.configureRectangularRoom({ depthMm: "4000", heightMm: "2600", widthMm: "5000" })).kind).toBe("durable");
			const configured = app.current().project;
			if (configured.schemaVersion !== 1) throw new Error("Expected V1 room");
			const room = configured.level.rooms[0];
			if (!room) throw new Error("Expected the configured room");
			expect((await app.controller.createCustomGlbFloorItem({
				asset: { assetDefinitionId: "current-model", resourceHash: currentHash, byteLength: bytes.length, format: "glb", displayName: "Current model", widthMm: 100, depthMm: 100, heightMm: 100 },
				glbBytes: bytes, color: "#716796", roomId: room.roomId, xMm: 2000, zMm: 2000,
			})).kind).toBe("durable");
			app.resourceMap.delete(resourceHash);
			expect(await app.controller.refreshSessionHistoryIntegrity()).toEqual({ kind: "history-resource-issue", resourceHashes: [resourceHash] });
			app.resourceMap.delete(currentHash);
			expect(await app.controller.refreshSessionHistoryIntegrity()).toEqual({ kind: "current-resource-issue" });
			expect(app.controller.snapshot().kind).toBe("recovery-needed");
			const repair = async (exactBytes: Uint8Array) => repairKind === "single"
				? app.controller.repairCustomGlbResource(exactBytes)
				: repairKind === "batch"
					? app.controller.repairCustomGlbResources([exactBytes])
					: app.controller.repairResourcesFromPortableBackup(Uint8Array.of(80, 75));
			expect(await repair(bytes)).toEqual(repairKind === "single" ? { kind: "repaired", resourceHash: currentHash } : { kind: "repaired", resourceHashes: [currentHash] });
			expect(app.controller.snapshot()).toMatchObject({ kind: "history-recovery-needed", resourceHashes: [resourceHash] });
			expect(app.writes).toEqual([[currentHash]]);
			expect(await repair(resourceBytes)).toMatchObject({ kind: "recovered" });
			expect(app.controller.snapshot().kind).toBe("saved");
			expect(app.publications).toHaveLength(3);
			expect((await app.controller.undo()).kind).toBe("durable");
			expect((await app.controller.undo()).kind).toBe("durable");
			expect(await app.controller.undo()).toMatchObject({ kind: "durable", revisionId: "revision-original" });
		});
	}
	it("reports missing recovery capabilities and unavailable/failing library removal without mutating a Project", async () => {
		for (const missingRecoveryCapability of [
			"checksum",
			"encoder",
			"importer",
		] as const) {
			const app = session({ restore: true, missingRecoveryCapability });
			await expect(
				app.controller.importRecoveryDraft(Uint8Array.of(0)),
			).resolves.toEqual({ kind: "not-ready" });
			expect(app.publications).toEqual([]);
		}
		await expect(
			session().controller.removeCustomGlbLibraryAsset("missing"),
		).resolves.toEqual({ kind: "not-ready" });
		const app = session({
			library: {
				list: async () => [],
				register: async (asset) => ({ asset, kind: "registered" }),
				remove: async () => {
					throw new Error("quota");
				},
			},
		});
		await app.controller.open();
		const before = app.controller.snapshot();
		await expect(
			app.controller.removeCustomGlbLibraryAsset("missing"),
		).resolves.toEqual({ kind: "persist-failed" });
		expect(app.controller.snapshot()).toEqual(before);
		expect(app.publications).toEqual([]);
	});

	it("serializes draft restoration, reports validation/save progress, and restores embedded bytes as a separate project", async () => {
		const failed = session({
			candidate: source(true),
			resourcePresent: true,
			failPublish: true,
		});
		await failed.controller.open();
		await failed.controller.renameProject("Pending model");
		const draft = await failed.controller.exportRecoveryDraft();
		if (draft.kind !== "ready") throw new Error("Expected draft");
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const app = session({
			restore: true,
			binaryChecksum: {
				sha256Bytes: async (bytes) => {
					await gate;
					return bytes.length === 3 ? resourceHash : "b".repeat(64);
				},
			},
		});
		await app.controller.open();
		const statuses: string[] = [];
		const importing = app.controller.importRecoveryDraft(draft.bytes, {
			onStatus: (status) => statuses.push(status.kind),
		});
		await expect(
			app.controller.importRecoveryDraft(draft.bytes),
		).resolves.toEqual({ kind: "in-progress" });
		release();
		await expect(importing).resolves.toMatchObject({ kind: "durable" });
		expect(statuses[0]).toBe("validating");
		expect(statuses).toContain("saving");
		expect(statuses.at(-1)).toBe("saved");
		expect(app.current().project.assetDefinitionRefs[0]?.resourceHash).toBe(
			resourceHash,
		);
		await expect(
			app.controller.readCustomGlbResource(resourceHash),
		).resolves.toEqual(resourceBytes);
	});

	it("keeps incomplete recovery files distinct from invalid input and releases the publication guard after rejection", async () => {
		const app = session({ restore: true });
		await app.controller.open();
		const file = {
			format: "interiors-recovery-draft",
			formatVersion: 1,
			durability: "unpublished",
			completeResources: false,
			candidate: source(),
			resources: [],
			missingResourceHashes: [resourceHash],
		};
		await expect(
			app.controller.importRecoveryDraft(
				new TextEncoder().encode(JSON.stringify(file)),
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_INCOMPLETE",
		});
		await expect(
			app.controller.importRecoveryDraft(Uint8Array.of(0)),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_INVALID",
		});
		expect(app.publications).toEqual([]);
	});

	it("repairs a single history resource through the single-file API and rejects a different immutable address", async () => {
		const app = session({ candidate: source(true), resourcePresent: true });
		await app.controller.open();
		await app.controller.restartProject();
		app.resourceMap.delete(resourceHash);
		await app.controller.refreshSessionHistoryIntegrity();
		await expect(
			app.controller.repairCustomGlbResource(Uint8Array.of(9, 9, 9)),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		await expect(
			app.controller.repairCustomGlbResource(resourceBytes),
		).resolves.toEqual({ kind: "recovered", resourceHash });
		expect(app.controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
	});

	it("keeps history read-only if a second referenced resource disappears during exact repair, then restores both branches safely", async () => {
		const original = source(true);
		const first = original.project.assetDefinitionRefs[0];
		if (!first) throw new Error("Expected resource");
		const secondHash = "b".repeat(64);
		const secondBytes = Uint8Array.of(4, 5, 6);
		const project = {
			...original.project,
			assetDefinitionRefs: [
				first,
				{
					...first,
					assetDefinitionId: "second-model",
					resourceHash: secondHash,
				},
			],
		};
		const app = session({
			candidate: {
				project,
				revision: {
					...original.revision,
					serializedProject: canonicalProjectSerializer.serialize(project),
				},
			},
			resourcePresent: true,
		});
		app.resourceMap.set(secondHash, secondBytes);
		await app.controller.open();
		await app.controller.restartProject();
		app.resourceMap.delete(resourceHash);
		await app.controller.refreshSessionHistoryIntegrity();
		app.resourceMap.delete(secondHash);
		await expect(
			app.controller.repairCustomGlbResources([resourceBytes]),
		).resolves.toEqual({ kind: "repaired", resourceHashes: [resourceHash] });
		expect(app.controller.snapshot()).toMatchObject({
			kind: "history-recovery-needed",
			resourceHashes: [secondHash],
		});
		expect(app.controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
		await expect(
			app.controller.repairCustomGlbResource(secondBytes),
		).resolves.toEqual({ kind: "recovered", resourceHash: secondHash });
		await expect(app.controller.undo()).resolves.toMatchObject({
			kind: "durable",
			revisionId: "revision-original",
		});
	});

	it("rejects wrong current resource bytes and concurrent batch repair before replacement", async () => {
		const app = session({ candidate: source(true) });
		await app.controller.open();
		await expect(
			app.controller.repairCustomGlbResource(Uint8Array.of(9, 9, 9)),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		expect(app.writes).toEqual([]);
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const blocked = session({
			candidate: source(true),
			binaryChecksum: {
				sha256Bytes: async () => {
					await gate;
					return resourceHash;
				},
			},
		});
		await blocked.controller.open();
		const repair = blocked.controller.repairCustomGlbResources([resourceBytes]);
		await expect(
			blocked.controller.repairCustomGlbResources([resourceBytes]),
		).resolves.toEqual({ kind: "in-progress" });
		await expect(
			blocked.controller.repairCustomGlbResource(resourceBytes),
		).resolves.toEqual({ kind: "in-progress" });
		release();
		await expect(repair).resolves.toMatchObject({ kind: "recovered" });
	});

	it("never treats a different durable Project or Revision as the successful reopen of an exact repair", async () => {
		for (const changed of ["project", "revision"]) {
			let release: () => void = () => undefined;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			const app = session({
				candidate: source(true),
				binaryChecksum: {
					sha256Bytes: async () => {
						await gate;
						return resourceHash;
					},
				},
			});
			await app.controller.open();
			const repair = app.controller.repairCustomGlbResources([resourceBytes]);
			const other = source();
			app.replaceDurablePointer(
				changed === "project"
					? {
							project: { ...other.project, projectId: "other-project" },
							revision: { ...other.revision, projectId: "other-project" },
						}
					: {
							...other,
							revision: { ...other.revision, revisionId: "other-revision" },
						},
			);
			release();
			await expect(repair).resolves.toEqual({
				kind: "repaired",
				resourceHashes: [resourceHash],
			});
			expect(app.controller.snapshot().kind).toBe("recovery-needed");
			expect(app.publications).toEqual([]);
		}
	});

	it("reports verified bytes as repaired when the durable pointer becomes unavailable during reopening", async () => {
		let available=true;let release:()=>void=()=>undefined;const gate=new Promise<void>(resolve=>{release=resolve;});const candidate=source(true);
		const app=session({candidate,loadCurrent:async()=>available?{kind:"durable",candidate}:{kind:"empty"},binaryChecksum:{sha256Bytes:async()=>{await gate;return resourceHash;}}});await app.controller.open();
		const repair=app.controller.repairCustomGlbResources([resourceBytes]);available=false;release();
		await expect(repair).resolves.toEqual({kind:"repaired",resourceHashes:[resourceHash]});expect(app.controller.snapshot().kind).toBe("recovery-needed");
	});

	it("fails safely without a backup source, on decoder failure, and when navigation changes during decoding", async () => {
		const absent = session({ candidate: source(true) });
		await absent.controller.open();
		await expect(
			absent.controller.repairResourcesFromPortableBackup(Uint8Array.of(0)),
		).resolves.toEqual({ kind: "not-ready" });
		const broken = session({
			candidate: source(true),
			decoder: {
				decode: async () => {
					throw new Error("broken archive");
				},
			},
		});
		await broken.controller.open();
		await expect(
			broken.controller.repairResourcesFromPortableBackup(Uint8Array.of(0)),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
		await expect(
			broken.controller.repairCustomGlbResources([resourceBytes]),
		).resolves.toMatchObject({ kind: "recovered" });
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const navigating = session({
			candidate: source(true),
			decoder: {
				decode: async () => {
					await gate;
					return {
						kind: "accepted",
						projectBytes: new Uint8Array(),
						resources: [{ resourceHash, bytes: resourceBytes }],
					};
				},
			},
		});
		await navigating.controller.open();
		const repair = navigating.controller.repairResourcesFromPortableBackup(
			Uint8Array.of(0),
		);
		await expect(
			navigating.controller.repairResourcesFromPortableBackup(Uint8Array.of(0)),
		).resolves.toEqual({ kind: "in-progress" });
		navigating.replaceDurablePointer(source());
		await navigating.controller.open();
		release();
		await expect(repair).resolves.toEqual({ kind: "not-ready" });
		expect(navigating.writes).toEqual([]);
	});
	it("removes only a library card while the referenced project, backup and undo remain healthy", async () => {
		const asset = source(true).project.assetDefinitionRefs[0];
		if (!asset) throw new Error("Expected asset");
		let removed = false;
		const library: CustomAssetLibraryPort = {
			list: async () => (removed ? [] : [asset]),
			register: async () => ({ asset, kind: "already-present" }),
			remove: async (id) => {
				if (removed || id !== asset.assetDefinitionId)
					return { kind: "not-found" };
				removed = true;
				return { kind: "removed" };
			},
		};
		const app = session({
			candidate: source(true),
			resourcePresent: true,
			restore: true,
			library,
		});
		await app.controller.open();
		const before = app.controller.snapshot();
		await expect(
			app.controller.removeCustomGlbLibraryAsset(asset.assetDefinitionId),
		).resolves.toEqual({ kind: "removed" });
		await expect(app.controller.listCustomGlbLibraryAssets()).resolves.toEqual(
			[],
		);
		expect(app.controller.snapshot()).toEqual(before);
		expect(app.publications).toEqual([]);
		await expect(app.controller.exportProjectTransfer()).resolves.toMatchObject(
			{ kind: "ready" },
		);
		await expect(
			app.controller.refreshSessionHistoryIntegrity(),
		).resolves.toEqual({ kind: "healthy" });
		await app.controller.restartProject();
		await expect(app.controller.undo()).resolves.toMatchObject({
			kind: "durable",
			revisionId: "revision-original",
		});
		await expect(
			app.controller.readCustomGlbResource(resourceHash),
		).resolves.toEqual(resourceBytes);
		await expect(
			app.controller.removeCustomGlbLibraryAsset(asset.assetDefinitionId),
		).resolves.toEqual({ kind: "not-found" });
	});
	it("hashes and writes one immutable repair snapshot even if the caller mutates its source during verification", async () => {
		let finish: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const app = session({
			candidate: source(true),
			binaryChecksum: {
				sha256Bytes: async () => {
					await gate;
					return resourceHash;
				},
			},
		});
		await app.controller.open();
		const input = resourceBytes.slice();
		const repairing = app.controller.repairCustomGlbResource(input);
		input.fill(9);
		finish();
		await expect(repairing).resolves.toEqual({
			kind: "recovered",
			resourceHash,
		});
		expect(app.resourceMap.get(resourceHash)).toEqual(resourceBytes);
	});
	it("exports failed pending work while the durable project and retry candidate stay intact", async () => {
		const app = session({ failPublish: true });
		await app.controller.open();
		await expect(app.controller.exportRecoveryDraft()).resolves.toEqual({
			kind: "not-ready",
		});
		await app.controller.renameProject("Новая версия");
		const state = app.controller.snapshot();
		const result = await app.controller.exportRecoveryDraft();
		if (result.kind !== "ready") throw new Error("Expected exact draft");
		const draft = JSON.parse(new TextDecoder().decode(result.bytes));
		expect(draft.candidate.project.name).toBe("Новая версия");
		expect(draft.candidate).toEqual(app.publications[0]);
		expect(app.current().project.name).toBe("План");
		expect(app.controller.snapshot()).toEqual(state);
		expect(app.publications).toHaveLength(1);
	});

	it("shows a detached read-only geometry projection only while current resource recovery is required", async () => {
		const app = session({ candidate: source(true) });
		await app.controller.open();
		const preview = app.controller.recoveryReadOnlyProject();
		expect(preview?.name).toBe("План");
		expect(preview?.assetDefinitionRefs).toEqual([]);
		expect(Object.isFrozen(preview?.level)).toBe(true);
		expect(app.current().project.assetDefinitionRefs).toHaveLength(1);
		await expect(app.controller.renameProject("Forbidden")).resolves.toEqual({
			kind: "not-ready",
		});
		expect(app.publications).toEqual([]);
	});

	it("repairs a history-only resource atomically without discarding Undo or publishing a revision", async () => {
		const app = session({ candidate: source(true), resourcePresent: true });
		await app.controller.open();
		await app.controller.restartProject();
		app.resourceMap.delete(resourceHash);
		await expect(
			app.controller.refreshSessionHistoryIntegrity(),
		).resolves.toEqual({
			kind: "history-resource-issue",
			resourceHashes: [resourceHash],
		});
		await expect(
			app.controller.repairCustomGlbResources([resourceBytes]),
		).resolves.toEqual({ kind: "recovered", resourceHashes: [resourceHash] });
		expect(app.controller.snapshot().kind).toBe("saved");
		expect(app.controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
		expect(app.writes).toEqual([[resourceHash]]);
		expect(app.publications).toHaveLength(1);
		await expect(app.controller.undo()).resolves.toMatchObject({
			kind: "durable",
			revisionId: "revision-original",
		});
	});

	it("repairs history-only references from a Portable Backup without replacing its current project", async () => {
		const app = session({
			candidate: source(true),
			resourcePresent: true,
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: new Uint8Array(),
					resources: [
						{ resourceHash, bytes: resourceBytes },
						{ resourceHash: "c".repeat(64), bytes: Uint8Array.of(4) },
					],
				}),
			},
		});
		await app.controller.open();
		await app.controller.restartProject();
		const revision = app.current().revision.revisionId;
		app.resourceMap.delete(resourceHash);
		await app.controller.refreshSessionHistoryIntegrity();
		await expect(
			app.controller.repairResourcesFromPortableBackup(Uint8Array.of(80, 75)),
		).resolves.toEqual({ kind: "recovered", resourceHashes: [resourceHash] });
		expect(app.controller.snapshot()).toMatchObject({
			kind: "saved",
			revisionId: revision,
		});
		expect(app.controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
		expect(app.writes).toEqual([[resourceHash]]);
		expect(app.resourceMap.has("c".repeat(64))).toBe(false);
		expect(app.publications).toHaveLength(1);
	});

	it("passes through backup validation rejection and never writes resources", async () => {
		const app = session({
			candidate: source(true),
			decoder: {
				decode: async () => ({
					kind: "rejected",
					reasonCode: "PORTABLE_BACKUP_CHECKSUM_MISMATCH",
				}),
			},
		});
		await app.controller.open();
		await expect(
			app.controller.repairResourcesFromPortableBackup(Uint8Array.of(80, 75)),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CHECKSUM_MISMATCH",
		});
		expect(app.writes).toEqual([]);
	});

	it("uses a verified Portable Backup solely to repair exact missing bytes, preserving the project identity", async () => {
		const decoder: PortableBackupDecoderPort = {
			decode: async () => ({
				kind: "accepted",
				projectBytes: new TextEncoder().encode(
					source(true).revision.serializedProject,
				),
				resources: [{ resourceHash, bytes: resourceBytes }],
			}),
		};
		const app = session({ candidate: source(true), decoder });
		await app.controller.open();
		await expect(
			app.controller.repairResourcesFromPortableBackup(Uint8Array.of(80, 75)),
		).resolves.toEqual({ kind: "recovered", resourceHashes: [resourceHash] });
		expect(app.current().revision.revisionId).toBe("revision-original");
		expect(app.controller.snapshot().kind).toBe("saved");
		expect(app.publications).toEqual([]);
		expect(app.writes).toEqual([[resourceHash]]);
	});

	it("retains both current and undo roots after exact repair of corruption in the current project", async () => {
		const app = session({ candidate: source(true), resourcePresent: true });
		await app.controller.open();
		await app.controller.renameProject("Следующая ревизия");
		app.resourceMap.delete(resourceHash);
		await expect(
			app.controller.refreshSessionHistoryIntegrity(),
		).resolves.toEqual({ kind: "current-resource-issue" });
		await expect(
			app.controller.repairCustomGlbResources([resourceBytes]),
		).resolves.toMatchObject({ kind: "recovered" });
		expect(app.controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
		expect(app.publications).toHaveLength(1);
		await expect(app.controller.undo()).resolves.toMatchObject({
			kind: "durable",
			revisionId: "revision-original",
		});
	});

	it("rejects a backup with corrupt exact-address bytes without replacing anything", async () => {
		const app = session({
			candidate: source(true),
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: new Uint8Array(),
					resources: [{ resourceHash, bytes: Uint8Array.of(3, 2, 1) }],
				}),
			},
		});
		await app.controller.open();
		await expect(
			app.controller.repairResourcesFromPortableBackup(new Uint8Array()),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		expect(app.writes).toEqual([]);
		expect(app.controller.snapshot().kind).toBe("recovery-needed");
	});

	it("rejects an incomplete or invalid backup before any replacement and keeps recovery available", async () => {
		const app = session({
			candidate: source(true),
			decoder: {
				decode: async () => ({
					kind: "accepted",
					projectBytes: new Uint8Array(),
					resources: [],
				}),
			},
		});
		await app.controller.open();
		await expect(
			app.controller.repairResourcesFromPortableBackup(new Uint8Array()),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RESOURCE_HASH_MISMATCH",
		});
		expect(app.writes).toEqual([]);
		expect(app.controller.snapshot().kind).toBe("recovery-needed");
	});

	it("restores an exact recovery draft as a separate project through the ordinary verified backup import", async () => {
		const failed = session({ failPublish: true });
		await failed.controller.open();
		await failed.controller.renameProject("Несохранённая планировка");
		const draft = await failed.controller.exportRecoveryDraft();
		if (draft.kind !== "ready") throw new Error("Expected pending draft");
		const app = session({ restore: true });
		await app.controller.open();
		const original = app.current();
		await expect(
			app.controller.importRecoveryDraft(draft.bytes),
		).resolves.toMatchObject({ kind: "durable", projectId: "new-1" });
		expect(original.project.projectId).toBe("project");
		expect(original.project.name).toBe("План");
		expect(app.current().project.projectId).not.toBe(
			original.project.projectId,
		);
		expect(app.current().project.name).toBe("Несохранённая планировка");
		expect(app.controller.sessionHistory()).toEqual({
			canRedo: false,
			canUndo: false,
		});
	});

	it("cancels recovery restoration before validation and after asynchronous verification without creating a project", async () => {
		const failed = session({ failPublish: true });
		await failed.controller.open();
		await failed.controller.renameProject("Draft");
		const draft = await failed.controller.exportRecoveryDraft();
		if (draft.kind !== "ready") throw new Error("Expected draft");
		const before = session({ restore: true });
		await before.controller.open();
		await expect(
			before.controller.importRecoveryDraft(draft.bytes, {
				signal: { aborted: true },
			}),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
		expect(before.publications).toEqual([]);
		const signal = { aborted: false };
		const after = session({
			restore: true,
			binaryChecksum: {
				sha256Bytes: async () => {
					signal.aborted = true;
					return "b".repeat(64);
				},
			},
		});
		await after.controller.open();
		await expect(
			after.controller.importRecoveryDraft(draft.bytes, { signal }),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
		expect(after.publications).toEqual([]);
		expect(after.current().project.projectId).toBe("project");
	});
});
