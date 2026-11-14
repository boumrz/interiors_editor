import { describe, expect, it } from "@rstest/core";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import {
	assessBrowserBackupRepresentability,
	verifyBrowserBackupCandidate,
} from "../../application/browser-backup-representability";
import type { Project } from "../../domain/project";
import { createInitialProject } from "../../domain/initial-project";
import { copyProject } from "../../domain/copy-project";
import { canonicalProjectSerializer } from "../../application/create-project";
import type {
	CustomAssetResourceStorePort,
	PublicationCandidate,
} from "../../application/ports";
import { BrowserRegisteredTransferDecoder } from "./browser-registered-transfer-decoder";
const instant = "2026-11-04T12:00:00.000Z";
const checksum = {
	sha256Bytes: async (bytes: Uint8Array) =>
		[
			...new Uint8Array(
				await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
			),
		]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join(""),
};
const initial = () =>
	createInitialProject({
		projectId: "source",
		levelId: "level",
		name: "Source",
		createdAt: instant,
	});
async function fixture(upper = false) {
	const bytes = Uint8Array.of(1, 2, 3),
		lower = await checksum.sha256Bytes(bytes),
		hash = upper ? lower.toUpperCase() : lower,
		project = {
			...initial(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "model",
					displayName: "Model",
					format: "glb" as const,
					resourceHash: hash,
					byteLength: bytes.length,
					widthMm: 100,
					depthMm: 100,
					heightMm: 100,
				},
			],
		};
	const decoded = {
		kind: "accepted" as const,
		projectBytes: Uint8Array.of(123, 125),
		projectMember: { format: "runtime-v1-wire" as const, project },
		resources: [{ resourceHash: hash, bytes }],
	};
	const stored = new Map<string, Uint8Array>(),
		effects: string[] = [];
	const resources: CustomAssetResourceStorePort = {
		read: async (key) => {
			effects.push(`read:${key}`);
			return stored.get(key)?.slice();
		},
		delete: async () => {
			throw new Error("No destructive cleanup");
		},
		writeIfAbsent: async (resource) => {
			stored.set(resource.resourceHash, resource.bytes.slice());
			return { kind: "stored" };
		},
		protectExistingResource: async (key) => {
			effects.push(`protect:${key}`);
			return stored.has(key);
		},
	};
	const gateway = new BrowserRegisteredTransferDecoder({
		decoder: { decode: async () => decoded },
		resources,
		binaryChecksum: checksum,
	});
	return { gateway, decoded, project, bytes, hash, stored, effects, resources };
}
async function candidate(
	project: ReturnType<typeof initial>,
): Promise<PublicationCandidate> {
	const next = {
			...project,
			projectId: "12345678-1234-4234-9234-123456789abc",
			updatedAt: instant,
		},
		serializedProject = canonicalProjectSerializer.serialize(next);
	return {
		project: next,
		revision: {
			projectId: next.projectId,
			revisionId: "abcdef01-1234-4234-9234-123456789abc",
			createdAt: instant,
			schemaVersion: 1,
			serializedProject,
			checksum: await checksum.sha256Bytes(
				new TextEncoder().encode(serializedProject),
			),
		},
	};
}

describe("private browser registered-import profile", () => {
	it("preserves prior canonical rejection and unavailable verification by exact identity", async () => {
		for (const result of [
			{
				kind: "rejected" as const,
				reasonCode: "BACKUP_CHECKSUM_MISMATCH" as const,
			},
			{ kind: "verification-unavailable" as const },
		]) {
			Object.defineProperty(result, "resources", {
				get: () => {
					throw new Error("Must not inspect rejected resources");
				},
			});
			const gateway = new BrowserRegisteredTransferDecoder({
				decoder: { decode: async () => result },
				binaryChecksum: checksum,
				resources: {
					read: async () => {
						throw new Error("No resource read");
					},
				},
			});
			expect(
				await gateway.decode(Uint8Array.of(80, 75), { aborted: true }),
			).toBe(result);
		}
	});
	it("admits only its own registered result and rejects valid Upper source before destination storage", async () => {
		const actual = await fixture(true);
		const decoded = await actual.gateway.decode(Uint8Array.of(80, 75));
		if (decoded.kind !== "accepted") throw new Error("Missing source");
		expect(
			await actual.gateway.prepare(
				{ ...decoded },
				actual.project,
				actual.decoded.resources,
			),
		).toEqual({ kind: "verification-unavailable" });
		expect(
			await actual.gateway.prepare(
				decoded,
				actual.project,
				actual.decoded.resources,
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
		expect(actual.effects).toEqual([]);
	});
	it("seals one exact immutable candidate and protects/rereads pinned bytes before the existing publisher may run", async () => {
		const actual = await fixture(),
			decoded = await actual.gateway.decode(Uint8Array.of(80, 75));
		if (decoded.kind !== "accepted") throw new Error("Missing source");
		const admitted = await actual.gateway.prepare(
			decoded,
			copyProject(actual.project),
			actual.decoded.resources,
		);
		if (admitted.kind !== "accepted")
			throw new Error("Source not representable");
		const sealed = await admitted.profile.seal(
			await candidate(admitted.profile.source),
		);
		if (sealed.kind !== "accepted") throw new Error("Candidate not valid");
		expect(Object.isFrozen(sealed.candidate)).toBe(true);
		expect(
			Object.isFrozen(sealed.candidate.project.assetDefinitionRefs[0]),
		).toBe(true);
		expect(actual.gateway.isRetryBlocked(sealed.candidate)).toBe(true);
		expect(actual.gateway.isRetryBlocked({ ...sealed.candidate })).toBe(false);
		actual.stored.set(actual.hash, actual.bytes.slice());
		expect(await admitted.profile.beforePublish(sealed.candidate)).toEqual({
			kind: "accepted",
		});
		expect(actual.effects).toEqual([
			`protect:${actual.hash}`,
			`read:${actual.hash}`,
		]);
		expect(
			await admitted.profile.beforePublish({ ...sealed.candidate }),
		).toEqual({ kind: "verification-unavailable" });
		expect(
			await admitted.profile.seal(await candidate(admitted.profile.source)),
		).toEqual({ kind: "verification-unavailable" });
	});
	it("refuses missing, wrong or replaced pinned bytes and unavailable protection without classifying a source file as corrupt", async () => {
		for (const bad of [
			undefined,
			Uint8Array.of(1, 2),
			Uint8Array.of(1, 2, 4),
		]) {
			const actual = await fixture(),
				decoded = await actual.gateway.decode(Uint8Array.of(80, 75));
			if (decoded.kind !== "accepted") throw new Error("Missing source");
			const admitted = await actual.gateway.prepare(
				decoded,
				actual.project,
				actual.decoded.resources,
			);
			if (admitted.kind !== "accepted") throw new Error("Missing profile");
			const sealed = await admitted.profile.seal(
				await candidate(admitted.profile.source),
			);
			if (sealed.kind !== "accepted") throw new Error("Missing seal");
			if (bad) actual.stored.set(actual.hash, bad);
			expect(await admitted.profile.beforePublish(sealed.candidate)).toEqual({
				kind: "verification-unavailable",
			});
		}
		const actual = await fixture();
		const gateway = new BrowserRegisteredTransferDecoder({
			decoder: { decode: async () => actual.decoded },
			resources: { read: async () => actual.bytes },
			binaryChecksum: checksum,
		});
		const decoded = await gateway.decode(Uint8Array.of(80, 75));
		if (decoded.kind !== "accepted") throw new Error("Missing source");
		expect(
			await gateway.prepare(decoded, actual.project, actual.decoded.resources),
		).toEqual({ kind: "verification-unavailable" });
	});
	it("returns unavailable on adapter exceptions and preserves monotonic cancellation before each write phase", async () => {
		const broken = new BrowserRegisteredTransferDecoder({
			decoder: {
				decode: async () => {
					throw new Error("Unavailable decoder");
				},
			},
			resources: { read: async () => undefined },
			binaryChecksum: checksum,
		});
		expect(await broken.decode(Uint8Array.of(80, 75))).toEqual({
			kind: "verification-unavailable",
		});
		const actual = await fixture(),
			decoded = await actual.gateway.decode(Uint8Array.of(80, 75));
		if (decoded.kind !== "accepted") throw new Error("Missing source");
		expect(
			await actual.gateway.prepare(
				decoded,
				actual.project,
				actual.decoded.resources,
				{ aborted: true },
			),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
		expect(actual.effects).toEqual([]);
	});
});

function room(): Project {
	let id = 0;
	const result = configureRectangularRoom(
		createInitialProject({
			createdAt: instant,
			levelId: "level",
			name: "Legacy 😀",
			projectId: "source",
		}),
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		{ next: () => `geometry-${++id}` },
		instant,
	);
	if (result.kind !== "accepted") throw new Error("Bad room");
	return result.project;
}
const rejected = {
	kind: "rejected",
	reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
};
it("proves the shared raw-depth boundary while preserving admitted nested variants exactly", async () => {
	const { validateRuntimeV1Project } = await import(
		"../../application/runtime-v1-project-validation"
	);
	const { encodeRuntimeV1Project } = await import(
		"./runtime-v1-wire"
	);
	const { parsePpjA1JsonBytes } = await import(
		"../../domain/ppj-a1-lossless-json"
	);
	for (const depth of [5, 6]) {
		const source = room(),
			project = {
				...source,
				assetInstances: [
					{
						assetInstanceId: "chair",
						anchorClass: "floor" as const,
						roomId: source.level.rooms[0].roomId,
						label: "Chair",
						xMm: 1500,
						zMm: 1500,
						widthMm: 500,
						depthMm: 500,
						heightMm: 500,
						color: "#716796",
					},
				],
			};
		let variant: unknown = "alpha-violet";
		for (let index = 0; index < depth; index++) variant = [variant];
		Object.defineProperty(project.assetInstances[0], "colorVariantId", {
			value: variant,
			enumerable: true,
		});
		expect(validateRuntimeV1Project(project).kind).toBe("accepted");
		const wire = encodeRuntimeV1Project(project);
		expect(wire.kind).toBe(depth === 5 ? "encoded" : "rejected");
		const oldBytes = new TextEncoder().encode(
			canonicalProjectSerializer.serialize(project),
		);
		expect(parsePpjA1JsonBytes(oldBytes).kind).toBe(
			depth === 5 ? "accepted" : "rejected",
		);
		const assessed = await assessBrowserBackupRepresentability(
			project,
			[],
			checksum,
		);
		expect(assessed.kind).toBe(depth === 5 ? "representable" : "rejected");
		if (depth === 6) expect(assessed).toEqual(rejected);
	}
});

it("measures the complete 600-vertex/300-wall open drawing through both actual member formats", async () => {
	const source = createInitialProject({
		createdAt: instant,
		levelId: "open-level",
		name: "Bounded open drawing",
		projectId: "source",
	});
	const ids = Array.from({ length: 600 }, (_, index) =>
		`${index}:`.padEnd(256, "v"),
	);
	const project = {
		...source,
		level: {
			...source.level,
			vertices: ids.map((vertexId, index) => ({
				vertexId,
				xMm: Math.floor(index / 2) * 200 + (index % 2) * 100,
				zMm: 0,
			})),
			wallSegments: Array.from({ length: 300 }, (_, index) => ({
				wallSegmentId: `wall-${index}`,
				startVertexId: ids[index * 2],
				endVertexId: ids[index * 2 + 1],
				thicknessMm: 100,
			})),
		},
	};
	const { validateRuntimeV1Project } = await import(
		"../../application/runtime-v1-project-validation"
	);
	const { encodeRuntimeV1Project } = await import(
		"./runtime-v1-wire"
	);
	expect(validateRuntimeV1Project(project).kind).toBe("accepted");
	const encoded = encodeRuntimeV1Project(project);
	expect(encoded.kind).toBe("encoded");
	if (encoded.kind !== "encoded") throw new Error("Wire corpus not valid");
	const { parsePpjA1JsonBytes } = await import(
		"../../domain/ppj-a1-lossless-json"
	);
	const actualOldBytes = new TextEncoder().encode(
		canonicalProjectSerializer.serialize(project),
	);
	expect(parsePpjA1JsonBytes(actualOldBytes).kind).toBe("accepted");
	const result = await assessBrowserBackupRepresentability(
		project,
		[],
		checksum,
	);
	expect(result.kind).toBe("representable");
	if (result.kind !== "representable")
		throw new Error("Maximal open drawing rejected");
	expect(
		await verifyBrowserBackupCandidate(
			await candidate(project),
			result.proof,
			[],
			checksum,
		),
	).toEqual({ kind: "accepted" });
	console.info(
		JSON.stringify({
			corpus: "max-vertices-and-walls-open-drawing",
			vertices: 600,
			walls: 300,
			idUtf8Bytes: 256,
			repeatedVertexIdBytes: 600 * 256 * 2,
			wireProjectBytes: encoded.bytes.length,
			oldProjectBytes: actualOldBytes.length,
			postIdMaximumProjectBytes: result.proof.maximumProjectByteLength,
			result: "representable",
		}),
	);
});
