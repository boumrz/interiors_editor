import { describe, expect, it } from "@rstest/core";
import { unzipSync, zipSync } from "fflate";
import type {
	BinaryChecksumPort,
	CustomAssetResource,
} from "../../application/ports";
import { canonicalProjectSerializer } from "../../application/create-project";
import { ImportPortableBackupUseCase } from "../../application/import-portable-backup";
import { createInitialProject } from "../../domain/initial-project";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import type { Project } from "../../domain/project";
import { createRegisteredRuntimePortablePorts } from "./registered-runtime-portable";
import { RuntimePortableBackupCodec } from "./runtime-portable-backup-codec";

const instant = "2026-11-04T12:00:00.000Z";
const utf8 = (text: string) => new TextEncoder().encode(text);
const checksum: BinaryChecksumPort = {
	async sha256Bytes(bytes) {
		return [
			...new Uint8Array(
				await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
			),
		]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
	},
};

function project(): Project {
	let next = 0;
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: instant,
			projectId: "p\ud800",
			levelId: "level",
			name: "Exact source",
		}),
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		{ next: () => `id-${++next}` },
		instant,
	);
	if (configured.kind !== "accepted")
		throw new Error("Expected valid Room fixture");
	return configured.project;
}

function glb(label = "self-authored"): Uint8Array {
	const text = JSON.stringify({
		asset: { version: "2.0", generator: label },
		buffers: [{ byteLength: 0 }],
		scenes: [{ nodes: [] }],
	});
	const size = Math.ceil(text.length / 4) * 4;
	const bytes = new Uint8Array(20 + size);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.byteLength, true);
	view.setUint32(12, size, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.fill(0x20, 20);
	bytes.set(utf8(text), 20);
	return bytes;
}

function sizedGlb(byteLength: number, randomBinary = false): Uint8Array {
	let binaryLength = byteLength - 128;
	let text = "";
	let jsonLength = 0;
	for (let pass = 0; pass < 4; pass++) {
		text = JSON.stringify({
			asset: { version: "2.0" },
			buffers: [{ byteLength: binaryLength }],
			scenes: [{ nodes: [] }],
		});
		jsonLength = Math.ceil(text.length / 4) * 4;
		binaryLength = byteLength - 28 - jsonLength;
	}
	const bytes = new Uint8Array(byteLength);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, byteLength, true);
	view.setUint32(12, jsonLength, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.fill(0x20, 20, 20 + jsonLength);
	bytes.set(utf8(text), 20);
	view.setUint32(20 + jsonLength, binaryLength, true);
	view.setUint32(24 + jsonLength, 0x004e4942, true);
	if (randomBinary) {
		let state = 123456789;
		for (let index = 28 + jsonLength; index < bytes.length; index++) {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
			bytes[index] = state >>> 24;
		}
	}
	return bytes;
}

function ppjCandidate(): Uint8Array {
	return zipSync(
		{
			"manifest.json": utf8(
				JSON.stringify({
					projectSchemaId: "interiors.project/alpha-1",
					projectSchemaVersion: 1,
					sourceProjectId: "p",
					canonicalProjectPath: "project/project.json",
					futureTechnicalDescriptor: { unresolved: true },
				}),
			),
			"checksums.json": utf8('[{"undeterminedLedgerGrammar":true}]'),
			"project/project.json": utf8(
				'{"projectSchemaId":"interiors.project/alpha-1","schemaVersion":1,"projectId":"p","unvalidated":true}',
			),
			[`catalog/${"a".repeat(64)}.asset`]: new Uint8Array([9]),
		},
		{ level: 0 },
	);
}

function withResources(
	source: Project,
	resources: readonly CustomAssetResource[],
): Project {
	return {
		...source,
		assetDefinitionRefs: resources.map((resource, index) => ({
			assetDefinitionId: `model-${index}`,
			displayName: "Self-authored",
			format: "glb",
			widthMm: 500,
			depthMm: 500,
			heightMm: 800,
			byteLength: resource.bytes.byteLength,
			resourceHash: resource.resourceHash,
		})),
	};
}

async function archive(
	source: unknown,
	resources: readonly CustomAssetResource[] = [],
): Promise<Uint8Array> {
	// Fixture producer deliberately bypasses domain admission to construct hostile
	// envelopes for the real registered boundary, never for product publication.
	const encoded = await new RuntimePortableBackupCodec(checksum, () => ({
		kind: "accepted",
	})).encode({ project: source, createdAt: instant, resources });
	if (encoded.kind !== "encoded")
		throw new Error(`Fixture envelope rejected: ${encoded.kind}`);
	return encoded.bytes;
}

async function candidate(source: Project) {
	const serializedProject = canonicalProjectSerializer.serialize(source);
	return {
		project: source,
		revision: {
			schemaVersion: 1 as const,
			projectId: source.projectId,
			revisionId: "revision",
			createdAt: instant,
			serializedProject,
			checksum: await checksum.sha256Bytes(utf8(serializedProject)),
		},
	};
}

describe("registered runtime portable ports", () => {
	it("keeps a precise floor angle and exact GLB bytes through the new registered archive", async () => {
		const bytes = glb();
		const resourceHash = await checksum.sha256Bytes(bytes);
		const resources = [{ resourceHash, bytes }];
		const base = withResources(project(), resources);
		const source: Project = {
			...base,
			assetInstances: [{
				anchorClass: "floor", assetInstanceId: "turned", roomId: base.level.rooms[0].roomId,
				label: "Turned", xMm: 1500, zMm: 1500, widthMm: 500, depthMm: 500,
				heightMm: 800, color: "#ABCDEF", assetDefinitionId: "model-0", yawMilliDeg: 37500,
			}],
		};
		const ports = createRegisteredRuntimePortablePorts({ binaryChecksum: checksum });
		const encoded = await ports.writer.encode({ project: source, createdAt: instant, resources });
		expect(encoded.kind).toBe("encoded");
		if (encoded.kind !== "encoded") throw new Error("Precise floor archive rejected");
		const entries = unzipSync(encoded.bytes);
		const decoder = new TextDecoder();
		const projectSchemaId = "interiors.project/runtime-v1-floor-yaw";
		const manifest = JSON.parse(decoder.decode(entries["manifest.json"]));
		expect(manifest).toMatchObject({ projectSchemaId, projectSchemaVersion: 1 });
		expect(JSON.parse(decoder.decode(entries["project/project.json"]))).toMatchObject({ projectSchemaId });
		expect(await ports.decoder.decode(encoded.bytes)).toMatchObject({
			kind: "accepted", projectMember: { format: "runtime-v1-floor-yaw", project: source }, resources,
		});
		expect(await ports.smoke.verify(source, resources)).toBe(true);
		expect(await ports.feasibility.assess(await candidate(source), {
			binaryChecksum: checksum,
			resources: { read: async (hash) => hash === resourceHash ? bytes : undefined },
		})).toEqual({ kind: "accepted" });
		manifest.projectSchemaId = "interiors.project/runtime-v1-wire";
		entries["manifest.json"] = utf8(JSON.stringify(manifest));
		expect(await ports.decoder.decode(zipSync(entries, { level: 0 }))).toEqual({
			kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE",
		});
	});

	it("roundtrips the exact wire object and bytes without the internal serializer", async () => {
		const base = project();
		const source: Project = {
			...base,
			level: {
				...base.level,
				vertices: base.level.vertices.map((vertex, index) =>
					index === 0 ? { ...vertex, xMm: -0 } : vertex,
				),
				rooms: base.level.rooms.map((room) => ({ ...room, name: undefined })),
			},
		};
		const before = structuredClone(source);
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		const encoded = await ports.writer.encode({
			project: source,
			createdAt: instant,
			resources: [],
		});
		expect(encoded.kind).toBe("encoded");
		if (encoded.kind !== "encoded")
			throw new Error("Expected exact wire envelope");
		const original = encoded.bytes.slice();
		const decoded = await ports.decoder.decode(encoded.bytes);
		expect(decoded.kind).toBe("accepted");
		if (decoded.kind !== "accepted")
			throw new Error("Expected registered decoder");
		expect(decoded.projectMember).toStrictEqual({
			format: "runtime-v1-wire",
			project: source,
		});
		expect(decoded.projectBytes).toEqual(
			unzipSync(encoded.bytes)["project/project.json"],
		);
		expect(decoded.resources).toEqual([]);
		expect(Object.is(source.level.vertices[0]?.xMm, -0)).toBe(true);
		expect(source).toStrictEqual(before);
		expect(encoded.bytes).toEqual(original);
		expect(await ports.smoke.verify(source, [])).toBe(true);
	});

	it("preserves exact hash aliases and independent decoded resource ownership", async () => {
		const bytes = glb();
		const lower = await checksum.sha256Bytes(bytes);
		const upper = lower.toUpperCase();
		expect(upper).not.toBe(lower);
		const resources = [
			{ resourceHash: lower, bytes },
			{ resourceHash: upper, bytes: bytes.slice() },
		];
		const source = withResources(project(), resources);
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		const encoded = await ports.writer.encode({
			project: source,
			createdAt: instant,
			resources,
		});
		if (encoded.kind !== "encoded") throw new Error("Expected alias envelope");
		const original = encoded.bytes.slice();
		const decoded = await ports.decoder.decode(encoded.bytes);
		if (decoded.kind !== "accepted" || !decoded.resources)
			throw new Error("Expected owned alias resources");
		expect(decoded.projectMember).toStrictEqual({
			format: "runtime-v1-wire",
			project: source,
		});
		expect(decoded.resources.map((resource) => resource.resourceHash)).toEqual([
			upper,
			lower,
		]);
		expect(await ports.smoke.verify(source, decoded.resources)).toBe(true);
		const firstAlias = decoded.resources[0];
		if (!firstAlias) throw new Error("Expected first owned alias");
		firstAlias.bytes[0] = 0;
		expect(decoded.resources[1]?.bytes).toEqual(bytes);
		expect(encoded.bytes).toEqual(original);
		const corrupt = [
			{ resourceHash: lower, bytes },
			{ resourceHash: upper, bytes: glb("another-byte-source") },
		];
		expect(
			await ports.writer.encode({
				project: withResources(project(), corrupt),
				createdAt: instant,
				resources: corrupt,
			}),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CHECKSUM_MISMATCH" });
	});

	it("retains domain failure before malformed GLB/resource hashes on encode and decode", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const hash = await checksum.sha256Bytes(bytes);
		const base = withResources(project(), [{ resourceHash: hash, bytes }]);
		const source = {
			...base,
			level: {
				...base.level,
				vertices: base.level.vertices.map((vertex, index) =>
					index === 0 ? { ...vertex, xMm: 123 } : vertex,
				),
			},
		};
		const original = await archive(source, [{ resourceHash: hash, bytes }]);
		const hashed: number[] = [];
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: {
				async sha256Bytes(value) {
					hashed.push(value.length);
					return checksum.sha256Bytes(value);
				},
			},
		});
		expect(
			await ports.writer.encode({
				project: source,
				createdAt: instant,
				resources: [{ resourceHash: hash, bytes }],
			}),
		).toEqual({ kind: "rejected", reasonCode: "NON_ORTHOGONAL_WALL" });
		expect(hashed).toEqual([]);
		expect(await ports.decoder.decode(original)).toEqual({
			kind: "rejected",
			reasonCode: "NON_ORTHOGONAL_WALL",
		});
		expect(hashed).not.toContain(bytes.length);
	});

	it("maps a registered legacy V1 member explicitly without guessing PPJ or rewriting the original", async () => {
		const source = { ...project(), projectId: "legacy-source" };
		const entries = unzipSync(await archive(source));
		const bytes = utf8(canonicalProjectSerializer.serialize(source));
		const hash = await checksum.sha256Bytes(bytes);
		const manifest = JSON.parse(
			new TextDecoder().decode(entries["manifest.json"]),
		);
		manifest.projectSchemaId = "interiors.project/alpha-1";
		manifest.entries[0].byteLength = bytes.length;
		manifest.entries[0].sha256 = hash;
		entries["project/project.json"] = bytes;
		entries["manifest.json"] = utf8(JSON.stringify(manifest));
		entries["checksums.json"] = utf8(
			JSON.stringify({
				algorithm: "sha-256",
				entries: [{ path: "project/project.json", sha256: hash }],
			}),
		);
		const original = zipSync(entries, { level: 0 });
		const before = original.slice();
		const decoded = await createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		}).decoder.decode(original);
		expect(decoded.kind).toBe("accepted");
		if (decoded.kind !== "accepted")
			throw new Error("Expected registered legacy route");
		expect(decoded.projectMember).toStrictEqual({
			format: "runtime-v1-legacy",
			project: source,
		});
		expect(decoded.projectBytes).toEqual(bytes);
		expect(original).toEqual(before);
	});

	it("preserves every unaccepted PPJ candidate as verification-unavailable without any V1 hash fallback", async () => {
		const original = ppjCandidate();
		const before = original.slice();
		let hashes = 0;
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: {
				async sha256Bytes(bytes) {
					hashes++;
					return checksum.sha256Bytes(bytes);
				},
			},
		});
		expect(await ports.decoder.decode(original)).toEqual({
			kind: "verification-unavailable",
		});
		expect(original).toEqual(before);
		expect(hashes).toBe(0);
	});

	it("preserves actual container and checksum reasons without relabeling trusted implementation failures", async () => {
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		const entries = unzipSync(await archive(project()));
		entries["project/project.json"][0] = 63;
		expect(await ports.decoder.decode(zipSync(entries, { level: 0 }))).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_CHECKSUM_MISMATCH",
		});
		expect(await ports.decoder.decode(new Uint8Array([1, 2, 3]))).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_CONTAINER_UNSUPPORTED",
		});
		const failure = new Error("Controlled checksum implementation failure");
		const broken = createRegisteredRuntimePortablePorts({
			binaryChecksum: {
				async sha256Bytes() {
					throw failure;
				},
			},
		});
		expect(await broken.decoder.decode(await archive(project()))).toEqual({ kind: "verification-unavailable" });
		await expect(
			broken.writer.encode({
				project: project(),
				createdAt: instant,
				resources: [],
			}),
		).rejects.toBe(failure);
	});
	it("preserves verifier unavailability through the common importer before IDs or publication", async () => {
		const effects: string[] = [];
		const ports = createRegisteredRuntimePortablePorts({ binaryChecksum: { sha256Bytes: async () => { throw new Error("Verifier temporarily unavailable"); } } });
		const importer = new ImportPortableBackupUseCase({ decoder: ports.decoder, checksum: { sha256: async () => { effects.push("checksum"); return "unused"; } }, clock: { now: () => { effects.push("clock"); return instant; } }, ids: { next: () => { effects.push("id"); return "new"; } }, serializer: canonicalProjectSerializer, smoke: ports.smoke, repository: { loadCurrent: async () => ({ kind: "empty" }), recover: async () => ({ kind: "recovered" }), publish: async () => { effects.push("publish"); return { kind: "durable" }; } } });
		expect(await importer.execute(await archive(project()), () => undefined)).toEqual({ kind: "verification-unavailable" }); expect(effects).toEqual([]);
	});

	it("keeps custom GLB security rejection reasons after healthy Project admission", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const hash = await checksum.sha256Bytes(bytes);
		const resources = [{ resourceHash: hash, bytes }];
		const source = withResources(project(), resources);
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		expect(
			await ports.writer.encode({
				project: source,
				createdAt: instant,
				resources,
			}),
		).toEqual({ kind: "rejected", reasonCode: "MALFORMED_GLTF" });
		expect(
			await ports.decoder.decode(await archive(source, resources)),
		).toEqual({ kind: "rejected", reasonCode: "MALFORMED_GLTF" });
		expect(await ports.smoke.verify(source, resources)).toBe(false);
	});

	it("checks GLB security for every verified resource after an earlier resource passes", async () => {
		const good = glb();
		const bad = new Uint8Array([9, 8, 7]);
		const resources = [
			{ resourceHash: await checksum.sha256Bytes(good), bytes: good },
			{ resourceHash: await checksum.sha256Bytes(bad), bytes: bad },
		];
		const source = withResources(project(), resources);
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		expect(
			await ports.writer.encode({
				project: source,
				createdAt: instant,
				resources,
			}),
		).toEqual({ kind: "rejected", reasonCode: "MALFORMED_GLTF" });
		expect(
			await ports.decoder.decode(await archive(source, resources)),
		).toEqual({ kind: "rejected", reasonCode: "MALFORMED_GLTF" });
	});

	it("admits exactly25MiB and rejects a larger custom declaration before GLB parse or resource hashing", async () => {
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		const bytes = sizedGlb(25 * 1024 * 1024);
		const resourceHash = await checksum.sha256Bytes(bytes);
		const resources = [{ resourceHash, bytes }];
		const source = withResources(project(), resources);
		const encoded = await ports.writer.encode({
			project: source,
			createdAt: instant,
			resources,
		});
		expect(encoded.kind).toBe("encoded");
		if (encoded.kind !== "encoded")
			throw new Error("Inclusive25MiB boundary rejected");
		expect((await ports.decoder.decode(encoded.bytes)).kind).toBe("accepted");
		expect(await ports.smoke.verify(source, resources)).toBe(true);
		// Invalid oversized GLB proves size precedes its malformed chunk grammar.
		const large = new Uint8Array(25 * 1024 * 1024 + 1);
		const largeHash = await checksum.sha256Bytes(large);
		const oversized = [{ resourceHash: largeHash, bytes: large }];
		const oversizedProject = withResources(project(), oversized);
		let resourceHashes = 0;
		const guarded = createRegisteredRuntimePortablePorts({
			binaryChecksum: {
				async sha256Bytes(value) {
					if (value.length === large.length) resourceHashes++;
					return checksum.sha256Bytes(value);
				},
			},
		});
		expect(
			await guarded.writer.encode({
				project: oversizedProject,
				createdAt: instant,
				resources: oversized,
			}),
		).toEqual({ kind: "rejected", reasonCode: "GLB_FILE_BYTES_LIMIT" });
		expect(
			await guarded.decoder.decode(await archive(oversizedProject, oversized)),
		).toEqual({ kind: "rejected", reasonCode: "GLB_FILE_BYTES_LIMIT" });
		expect(resourceHashes).toBe(0);
		expect(await guarded.smoke.verify(oversizedProject, oversized)).toBe(false);
	});

	it("maps real native and live plain cancellation without accepting an archive or invoking a preaborted checksum", async () => {
		const bytes = await archive(project());
		let hashes = 0;
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: {
				async sha256Bytes(value) {
					hashes++;
					return checksum.sha256Bytes(value);
				},
			},
		});
		const native = new AbortController();
		native.abort();
		for (const signal of [native.signal, { aborted: true }]) {
			expect(await ports.decoder.decode(bytes, signal)).toEqual({
				kind: "rejected",
				reasonCode: "BACKUP_CANCELLED",
			});
			expect(
				await ports.writer.encode(
					{ project: project(), createdAt: instant, resources: [] },
					signal,
				),
			).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
		}
		expect(hashes).toBe(0);
		for (const nativeSource of [true, false]) {
			const control = new AbortController();
			const plain = { aborted: false };
			const signal = nativeSource ? control.signal : plain;
			const live = createRegisteredRuntimePortablePorts({
				binaryChecksum: {
					async sha256Bytes(value) {
						const digest = await checksum.sha256Bytes(value);
						if (nativeSource) control.abort();
						else plain.aborted = true;
						return digest;
					},
				},
			});
			expect(await live.decoder.decode(bytes, signal)).toEqual({
				kind: "rejected",
				reasonCode: "BACKUP_CANCELLED",
			});
		}
	});

	it("cancels native and polled live sources during the real asynchronous DEFLATE resource iterator", async () => {
		const bytes = sizedGlb(512 * 1024, true);
		const resourceHash = await checksum.sha256Bytes(bytes);
		const resources = [{ resourceHash, bytes }];
		const source = withResources(project(), resources);
		const compressed = zipSync(unzipSync(await archive(source, resources)), {
			level: 6,
		});
		expect(
			(
				await createRegisteredRuntimePortablePorts({
					binaryChecksum: checksum,
				}).decoder.decode(compressed)
			).kind,
		).toBe("accepted");
		for (const nativeSource of [true, false]) {
			const control = new AbortController();
			const plain = { aborted: false };
			const signal = nativeSource ? control.signal : plain;
			let hashes = 0;
			const ports = createRegisteredRuntimePortablePorts({
				binaryChecksum: {
					async sha256Bytes(value) {
						hashes++;
						const digest = await checksum.sha256Bytes(value);
						if (hashes === 1)
							setTimeout(() => {
								if (nativeSource) control.abort();
								else plain.aborted = true;
							}, 0);
						return digest;
					},
				},
			});
			expect(await ports.decoder.decode(compressed, signal)).toEqual({
				kind: "rejected",
				reasonCode: "BACKUP_CANCELLED",
			});
			expect(hashes).toBe(1); // Project verified; resource inflate cancelled before its checksum.
		}
	});

	it("retains owned snapshots when the caller mutates its Project, resource or archive during hashing", async () => {
		const bytes = glb();
		const beforeBytes = bytes.slice();
		const hash = await checksum.sha256Bytes(bytes);
		const source = withResources(project(), [{ resourceHash: hash, bytes }]);
		const beforeProject = structuredClone(source);
		let changed = false;
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: {
				async sha256Bytes(value) {
					if (!changed) {
						changed = true;
						bytes.fill(0);
						Reflect.set(source, "name", "Caller changed source");
					}
					return checksum.sha256Bytes(value);
				},
			},
		});
		const encoded = await ports.writer.encode({
			project: source,
			createdAt: instant,
			resources: [{ resourceHash: hash, bytes }],
		});
		if (encoded.kind !== "encoded")
			throw new Error("Owned source snapshot was not retained");
		const raw = encoded.bytes;
		const decoder = createRegisteredRuntimePortablePorts({
			binaryChecksum: {
				async sha256Bytes(value) {
					raw.fill(0);
					return checksum.sha256Bytes(value);
				},
			},
		});
		const decoded = await decoder.decoder.decode(raw);
		if (decoded.kind !== "accepted")
			throw new Error("Owned archive snapshot was not retained");
		expect(decoded.projectMember).toStrictEqual({
			format: "runtime-v1-wire",
			project: beforeProject,
		});
		expect(decoded.resources).toEqual([
			{ resourceHash: hash, bytes: beforeBytes },
		]);
	});

	it("assesses the registered wire member instead of applying PPJ grammar to the internal Revision string", async () => {
		const base = project();
		const source = {
			...base,
			level: {
				...base.level,
				rooms: base.level.rooms.map((room) => ({ ...room, name: undefined })),
				vertices: base.level.vertices.map((vertex, index) =>
					index === 0 ? { ...vertex, xMm: -0 } : vertex,
				),
			},
		};
		const value = await candidate(source);
		const before = structuredClone(value);
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		expect(
			await ports.feasibility.assess(value, {
				binaryChecksum: checksum,
				resources: {
					async read() {
						return undefined;
					},
				},
			}),
		).toEqual({ kind: "accepted" });
		expect(value).toStrictEqual(before);
	});

	it("requires actual resource and checksum ports even when the Project references no resource", async () => {
		const value = await candidate(project());
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		expect(await ports.feasibility.assess(value)).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		for (const key of ["binaryChecksum", "resources"] as const) {
			const binding = {
				binaryChecksum: checksum,
				resources: {
					async read() {
						return undefined;
					},
				},
			};
			Reflect.set(binding, key, undefined);
			expect(await ports.feasibility.assess(value, binding)).toEqual({
				kind: "rejected",
				reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
			});
		}
		const binding = {
			binaryChecksum: { ...checksum },
			resources: {
				async read() {
					return undefined;
				},
			},
		};
		Reflect.set(binding.binaryChecksum, "sha256Bytes", "not-a-function");
		expect(await ports.feasibility.assess(value, binding)).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
	});

	it("feasibility checks supplied actual resource ports by exact raw alias keys and rejects wrong bytes", async () => {
		const bytes = glb();
		const lower = await checksum.sha256Bytes(bytes);
		const upper = lower.toUpperCase();
		const resources = [
			{ resourceHash: lower, bytes },
			{ resourceHash: upper, bytes: bytes.slice() },
		];
		const value = await candidate(withResources(project(), resources));
		const reads: string[] = [];
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		expect(
			await ports.feasibility.assess(value, {
				binaryChecksum: checksum,
				resources: {
					async read(hash) {
						reads.push(hash);
						return resources.find((item) => item.resourceHash === hash)?.bytes;
					},
				},
			}),
		).toEqual({ kind: "accepted" });
		expect(reads).toEqual([lower, upper]);
		expect(
			await ports.feasibility.assess(value, {
				binaryChecksum: checksum,
				resources: {
					async read(hash) {
						return hash === lower ? bytes : undefined;
					},
				},
			}),
		).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(
			await ports.feasibility.assess(value, {
				binaryChecksum: checksum,
				resources: {
					async read() {
						return glb("wrong exact bytes");
					},
				},
			}),
		).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
	});

	it("feasibility rejects a nonmember, invalid Plan or inadmissible custom declaration before reading pinned bytes", async () => {
		const source = project();
		const badMember = { ...source };
		Reflect.set(badMember, "extension", true);
		const hiddenMember = { ...source };
		Object.defineProperty(hiddenMember, "name", {
			value: source.name,
			enumerable: false,
		});
		const symbolicMember = { ...source };
		Reflect.set(symbolicMember, Symbol("outside closed wire grammar"), true);
		const badPlan = {
			...source,
			level: {
				...source.level,
				vertices: source.level.vertices.map((vertex, index) =>
					index === 0 ? { ...vertex, xMm: 123 } : vertex,
				),
			},
		};
		const oversize = {
			...source,
			assetDefinitionRefs: [
				{
					assetDefinitionId: "model",
					displayName: "Model",
					format: "glb" as const,
					widthMm: 500,
					depthMm: 500,
					heightMm: 800,
					resourceHash: "a".repeat(64),
					byteLength: 25 * 1024 * 1024 + 1,
				},
			],
		};
		let reads = 0;
		const ports = createRegisteredRuntimePortablePorts({
			binaryChecksum: checksum,
		});
		for (const project of [
			badMember,
			hiddenMember,
			symbolicMember,
			badPlan,
			oversize,
		]) {
			expect(
				await ports.feasibility.assess(await candidate(project), {
					binaryChecksum: checksum,
					resources: {
						async read() {
							reads++;
							return undefined;
						},
					},
				}),
			).toEqual({
				kind: "rejected",
				reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
			});
		}
		expect(reads).toBe(0);
	});
});
