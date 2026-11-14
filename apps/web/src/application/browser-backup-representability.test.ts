import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { copyProject } from "../domain/copy-project";
import type { Project } from "../domain/project";
import { canonicalProjectSerializer } from "./create-project";
import {
	assessBrowserBackupRepresentability,
	verifyBrowserBackupCandidate,
	sameBrowserBackupValue,
	freezeBrowserBackupValue,
	isBrowserBackupResourceHash,
	sameBrowserBackupResourceBytes,
	browserBackupUtf8ByteLength,
	encodeBrowserBackupUtf8,
} from "./browser-backup-representability";

const instant = "2026-11-04T12:00:00.000Z";
const cryptoModule = "node:crypto";
const checksum = {
	sha256Bytes: async (bytes: Uint8Array) => {
		const native: {
			createHash(type: string): {
				update(bytes: Uint8Array): { digest(encoding: "hex"): string };
			};
		} = await import(cryptoModule);
		return native.createHash("sha256").update(bytes).digest("hex");
	},
};
function cancellation() {
	const signal = { aborted: false };
	return {
		signal,
		abort: () => {
			signal.aborted = true;
		},
	};
}

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
async function candidate(project: Project) {
	const value = {
		...project,
		projectId: "12345678-1234-4234-9234-123456789abc",
		updatedAt: "+010000-01-01T00:00:00.000Z",
	};
	const serializedProject = canonicalProjectSerializer.serialize(value);
	return {
		project: value,
		revision: {
			projectId: value.projectId,
			revisionId: "abcdef01-1234-4234-9234-123456789abc",
			schemaVersion: 1 as const,
			createdAt: value.updatedAt,
			serializedProject,
			checksum: await checksum.sha256Bytes(await nativeUtf8(serializedProject)),
		},
	};
}
const rejected = {
	kind: "rejected",
	reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
};

describe("bounded exact browser legacy representability", () => {
	it("accepts ordinary optional metadata, Unicode and finite yaw without normalizing the input", async () => {
		const source = room(),
			project = {
				...source,
				assetInstances: [
					{
						assetInstanceId: "chair",
						anchorClass: "floor" as const,
						roomId: source.level.rooms[0].roomId,
						label: "Chair 😀",
						xMm: 1500,
						zMm: 1500,
						widthMm: 500,
						depthMm: 500,
						heightMm: 500,
						color: "#716796",
						yawRadians: 0.5,
						locked: true as const,
					},
				],
			};
		const before = copyProject(project),
			result = await assessBrowserBackupRepresentability(project, [], checksum);
		expect(result.kind).toBe("representable");
		expect(project).toEqual(before);
		if (result.kind !== "representable")
			throw new Error("Ordinary source rejected");
		expect(result.proof.project).not.toBe(project);
		expect(Object.isFrozen(result.proof.project.level.vertices)).toBe(true);
		const actual = await candidate(project);
		expect(
			await verifyBrowserBackupCandidate(actual, result.proof, [], checksum),
		).toEqual({ kind: "accepted" });
		const item = actual.project.assetInstances[0];
		if (item.anchorClass !== "floor") throw new Error("Expected floor item");
		expect(item.yawRadians).toBe(0.5);
	});
	it("refuses negative zero, own undefined, lone UTF16 and array properties rather than silently losing them", async () => {
		for (const mutation of [
			(p: Project) =>
				Object.defineProperty(p.level.vertices[0], "xMm", {
					value: -0,
					enumerable: true,
					configurable: true,
				}),
			(p: Project) =>
				Object.defineProperty(p.level.rooms[0], "name", {
					value: undefined,
					enumerable: true,
					configurable: true,
				}),
			(p: Project) =>
				Object.defineProperty(p.level, "levelId", {
					value: "level-\ud800",
					enumerable: true,
					configurable: true,
				}),
			(p: Project) =>
				Object.defineProperty(p.assetInstances, "named", {
					value: "retained",
					enumerable: true,
					configurable: true,
				}),
			(p: Project) =>
				Object.defineProperty(p.level.vertices, Symbol("metadata"), {
					value: "retained",
					enumerable: true,
					configurable: true,
				}),
		]) {
			const project = room();
			mutation(project);
			const before = copyProject(project);
			expect(
				await assessBrowserBackupRepresentability(project, [], checksum),
			).toEqual(rejected);
			expect(sameBrowserBackupValue(project, before)).toBe(true);
		}
	});
	it("rejects unsupported keys and duplicate raw references while preserving registered source spelling", async () => {
		const bytes = Uint8Array.of(1, 2, 3, 4),
			lower = await checksum.sha256Bytes(bytes);
		for (const hashes of [
			[lower.toUpperCase()],
			[lower.slice(0, 4).toUpperCase() + lower.slice(4)],
			[lower, lower],
			[lower, lower.toUpperCase()],
		]) {
			const project = {
				...room(),
				assetDefinitionRefs: hashes.map((resourceHash, index) => ({
					assetDefinitionId: `model-${index}`,
					displayName: "Model",
					format: "glb" as const,
					resourceHash,
					byteLength: bytes.byteLength,
					widthMm: 100,
					depthMm: 100,
					heightMm: 100,
				})),
			};
			const resources = hashes.map((resourceHash) => ({
				resourceHash,
				bytes: bytes.slice(),
			}));
			let hashesRead = 0;
			expect(
				await assessBrowserBackupRepresentability(project, resources, {
					sha256Bytes: async (value) => {
						hashesRead++;
						return checksum.sha256Bytes(value);
					},
				}),
			).toEqual(
				new Set(hashes).size === hashes.length
					? rejected
					: { kind: "verification-unavailable" },
			);
			expect(hashesRead).toBe(0);
			expect(
				project.assetDefinitionRefs.map((item) => item.resourceHash),
			).toEqual(hashes);
		}
	});
	it("uses exact lowercase bytes and refuses missing, changed, wrong-length and unavailable resources", async () => {
		const bytes = Uint8Array.of(1, 2, 3, 4),
			hash = await checksum.sha256Bytes(bytes),
			project = {
				...room(),
				assetDefinitionRefs: [
					{
						assetDefinitionId: "model",
						displayName: "Model",
						format: "glb" as const,
						resourceHash: hash,
						byteLength: bytes.byteLength,
						widthMm: 100,
						depthMm: 100,
						heightMm: 100,
					},
				],
			};
		expect(
			(
				await assessBrowserBackupRepresentability(
					project,
					[{ resourceHash: hash, bytes }],
					checksum,
				)
			).kind,
		).toBe("representable");
		for (const resources of [
			[],
			[{ resourceHash: hash, bytes: bytes.subarray(0, 3) }],
			[{ resourceHash: hash, bytes: Uint8Array.of(1, 2, 3, 5) }],
		])
			expect(
				await assessBrowserBackupRepresentability(project, resources, checksum),
			).toEqual(rejected);
		expect(
			await assessBrowserBackupRepresentability(
				project,
				[{ resourceHash: hash, bytes }],
				{
					sha256Bytes: async () => {
						throw new Error("Unavailable digest");
					},
				},
			),
		).toEqual({ kind: "verification-unavailable" });
	});
	it("binds the post-ID candidate to exact source contents, metadata, serializer and checksum", async () => {
		const source = room(),
			result = await assessBrowserBackupRepresentability(source, [], checksum);
		if (result.kind !== "representable") throw new Error("Bad source");
		const valid = await candidate(source);
		expect(
			await verifyBrowserBackupCandidate(valid, result.proof, [], checksum),
		).toEqual({ kind: "accepted" });
		for (const changed of [
			{ ...valid, project: { ...valid.project, name: "Changed" } },
			{ ...valid, project: { ...valid.project, projectId: source.projectId } },
			{
				...valid,
				project: { ...valid.project, projectId: "not-a-native-uuid" },
			},
			{ ...valid, revision: { ...valid.revision, checksum: "f".repeat(64) } },
			{ ...valid, revision: { ...valid.revision, createdAt: instant } },
			{
				...valid,
				revision: {
					...valid.revision,
					serializedProject: `${valid.revision.serializedProject} `,
				},
			},
		])
			expect(
				await verifyBrowserBackupCandidate(changed, result.proof, [], checksum),
			).toEqual(rejected);
	});
	it("distinguishes exact structured values independently of JSON equality", () => {
		expect(JSON.stringify({ value: -0 })).toBe(JSON.stringify({ value: 0 }));
		expect(sameBrowserBackupValue({ value: -0 }, { value: 0 })).toBe(false);
		expect(sameBrowserBackupValue({ value: undefined }, {})).toBe(false);
		expect(sameBrowserBackupValue(["charcoal"], [["charcoal"]])).toBe(false);
		const array = [1];
		Object.defineProperty(array, "tag", { value: "kept", enumerable: false });
		expect(sameBrowserBackupValue(array, [1])).toBe(false);
		expect(sameBrowserBackupValue("\ud800", "\ufffd")).toBe(false);
		expect(sameBrowserBackupValue({ a: [0.5, "😀"] }, { a: [0.5, "😀"] })).toBe(
			true,
		);
	});
});

it("cancels source representability before work and between bounded resource digests", async () => {
	const before = cancellation();
	before.abort();
	expect(
		await assessBrowserBackupRepresentability(
			room(),
			[],
			checksum,
			before.signal,
		),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	const resources = await Promise.all(
		[Uint8Array.of(1, 2), Uint8Array.of(3, 4)].map(async (bytes) => ({
			resourceHash: await checksum.sha256Bytes(bytes),
			bytes,
		})),
	);
	const source = {
		...room(),
		assetDefinitionRefs: resources.map((resource, index) => ({
			assetDefinitionId: `model-${index}`,
			displayName: "Model",
			format: "glb" as const,
			resourceHash: resource.resourceHash,
			byteLength: resource.bytes.length,
			widthMm: 100,
			depthMm: 100,
			heightMm: 100,
		})),
	};
	const abort = cancellation();
	let hashes = 0;
	expect(
		await assessBrowserBackupRepresentability(
			source,
			resources,
			{
				sha256Bytes: async (bytes) => {
					hashes++;
					const result = await checksum.sha256Bytes(bytes);
					abort.abort();
					return result;
				},
			},
			abort.signal,
		),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	expect(hashes).toBe(1);
});

it("preserves nested VariantValue exactly when both existing serializer and reader represent it", async () => {
	const source = room();
	const project = {
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
	Object.defineProperty(project.assetInstances[0], "colorVariantId", {
		value: [["alpha-violet"]],
		enumerable: true,
	});
	const represented = await assessBrowserBackupRepresentability(
		project,
		[],
		checksum,
	);
	expect(represented.kind).toBe("representable");
	if (represented.kind !== "representable")
		throw new Error("Representable nested variant rejected");
	expect(
		Reflect.get(represented.proof.project.assetInstances[0], "colorVariantId"),
	).toStrictEqual([["alpha-violet"]]);
	expect(
		await verifyBrowserBackupCandidate(
			await candidate(project),
			represented.proof,
			[],
			checksum,
		),
	).toEqual({ kind: "accepted" });
	expect(
		Reflect.get(project.assetInstances[0], "colorVariantId"),
	).toStrictEqual([["alpha-violet"]]);
});

it("preserves cancellation if the checksum adapter aborts and throws", async () => {
	const bytes = Uint8Array.of(1),
		hash = await checksum.sha256Bytes(bytes),
		project = {
			...room(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "model",
					displayName: "Model",
					format: "glb" as const,
					resourceHash: hash,
					byteLength: 1,
					widthMm: 100,
					depthMm: 100,
					heightMm: 100,
				},
			],
		};
	const signal = cancellation();
	expect(
		await assessBrowserBackupRepresentability(
			project,
			[{ resourceHash: hash, bytes }],
			{
				sha256Bytes: async () => {
					signal.abort();
					throw new Error("Interrupted digest");
				},
			},
			signal.signal,
		),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
});

it("requires full lowercase ASCII hash spelling and exact structured own values", () => {
	const lower = "ab".repeat(32);
	for (const value of [lower])
		expect(isBrowserBackupResourceHash(value)).toBe(true);
	for (const value of [
		lower.toUpperCase(),
		`!${lower}`,
		`${lower}!`,
		lower.slice(1),
		lower + "a",
		"é".repeat(64),
	])
		expect(isBrowserBackupResourceHash(value)).toBe(false);
	for (const [a, b] of [
		[null, {}],
		[{}, null],
		[1, {}],
		[{}, 1],
		[{ a: 1 }, { b: 1 }],
		[{ a: 1, b: 2 }, { a: 1 }],
		[true, false],
	])
		expect(sameBrowserBackupValue(a, b)).toBe(false);
	const likeArray = {};
	Object.defineProperty(likeArray, "length", { value: 0 });
	expect(sameBrowserBackupValue([], likeArray)).toBe(false);
	const getter = {};
	Object.defineProperty(getter, "a", {
		get: () => {
			throw new Error("Never invoke source accessors");
		},
		enumerable: true,
	});
	expect(sameBrowserBackupValue(getter, { a: undefined })).toBe(false);
	expect(sameBrowserBackupValue({ a: undefined }, getter)).toBe(false);
	expect(() => freezeBrowserBackupValue(getter)).toThrow();
	const left: { self?: unknown } = {},
		right: { self?: unknown } = {};
	left.self = left;
	right.self = right;
	expect(sameBrowserBackupValue(left, right)).toBe(true);
	freezeBrowserBackupValue(left);
	expect(Object.isFrozen(left)).toBe(true);
	freezeBrowserBackupValue(null);
	freezeBrowserBackupValue(1);
	const resource = { resourceHash: lower, bytes: Uint8Array.of(1, 2, 3) };
	expect(sameBrowserBackupResourceBytes([resource], [resource])).toBe(true);
	for (const a of [
		[],
		[resource, resource],
		[{ resourceHash: "b".repeat(64), bytes: resource.bytes }],
		[{ ...resource, bytes: Uint8Array.of(1, 2) }],
		[{ ...resource, bytes: Uint8Array.of(1, 2, 4) }],
	])
		expect(sameBrowserBackupResourceBytes(a, [resource])).toBe(false);
	expect(sameBrowserBackupResourceBytes([resource], [resource, resource])).toBe(
		false,
	);
});

it("proves conservative native identity/time byte growth with actual Unicode encoding boundaries", async () => {
	for (const value of [
		"\u007f",
		"\u0080",
		"\u07ff",
		"\u0800",
		"\uffff",
		"😀",
		"Unicode Ж",
	]) {
		const source = room(),
			project = { ...source, level: { ...source.level, levelId: value } },
			result = await assessBrowserBackupRepresentability(project, [], checksum);
		expect(result.kind).toBe("representable");
		if (result.kind !== "representable")
			throw new Error("Legacy Unicode not represented");
		expect(result.proof.maximumProjectByteLength).toBe(
			(await nativeUtf8(canonicalProjectSerializer.serialize(project)))
				.byteLength + 33,
		);
		expect(
			await verifyBrowserBackupCandidate(
				await candidate(project),
				result.proof,
				[],
				checksum,
			),
		).toEqual({ kind: "accepted" });
	}
});

it("binds every actual generated identity, source value, exact resource and future bound independently", async () => {
	const source = room(),
		represented = await assessBrowserBackupRepresentability(
			source,
			[],
			checksum,
		);
	if (represented.kind !== "representable") throw new Error("No source proof");
	const valid = await candidate(source);
	for (const projectId of [
		"!12345678-1234-4234-9234-123456789abc",
		"12345678-1234-4234-9234-123456789abc!",
	]) {
		const project = { ...valid.project, projectId },
			serializedProject = canonicalProjectSerializer.serialize(project);
		expect(
			await verifyBrowserBackupCandidate(
				{
					project,
					revision: {
						...valid.revision,
						projectId,
						serializedProject,
						checksum: await checksum.sha256Bytes(
							await nativeUtf8(serializedProject),
						),
					},
				},
				represented.proof,
				[],
				checksum,
			),
		).toEqual(rejected);
	}
	for (const revision of [
		{ ...valid.revision, projectId: "foreign" },
		{ ...valid.revision, revisionId: "!abcdef01-1234-4234-9234-123456789abc" },
		{ ...valid.revision, revisionId: "abcdef01-1234-4234-9234-123456789abc!" },
	])
		expect(
			await verifyBrowserBackupCandidate(
				{ ...valid, revision },
				represented.proof,
				[],
				checksum,
			),
		).toEqual(rejected);
	const wrongSchema = { ...valid.revision };
	Reflect.set(wrongSchema, "schemaVersion", 2);
	expect(
		await verifyBrowserBackupCandidate(
			{ ...valid, revision: wrongSchema },
			represented.proof,
			[],
			checksum,
		),
	).toEqual(rejected);
	const project = { ...valid.project, name: "Different source" },
		serializedProject = canonicalProjectSerializer.serialize(project);
	expect(
		await verifyBrowserBackupCandidate(
			{
				project,
				revision: {
					...valid.revision,
					serializedProject,
					checksum: await checksum.sha256Bytes(
						await nativeUtf8(serializedProject),
					),
				},
			},
			represented.proof,
			[],
			checksum,
		),
	).toEqual(rejected);
	expect(
		await verifyBrowserBackupCandidate(
			valid,
			{ ...represented.proof, maximumProjectByteLength: 1 },
			[],
			checksum,
		),
	).toEqual(rejected);
	const bytes = Uint8Array.of(1, 2, 3),
		resourceHash = await checksum.sha256Bytes(bytes),
		resources = [{ resourceHash, bytes }],
		resourceProject = {
			...source,
			assetDefinitionRefs: [
				{
					assetDefinitionId: "m",
					displayName: "Model",
					format: "glb" as const,
					resourceHash,
					byteLength: 3,
					widthMm: 100,
					depthMm: 100,
					heightMm: 100,
				},
			],
		},
		resourceProof = await assessBrowserBackupRepresentability(
			resourceProject,
			resources,
			checksum,
		);
	if (resourceProof.kind !== "representable")
		throw new Error("No resource proof");
	const actual = await candidate(resourceProject);
	expect(
		await verifyBrowserBackupCandidate(
			actual,
			resourceProof.proof,
			[{ resourceHash, bytes: Uint8Array.of(1, 2, 4) }],
			checksum,
		),
	).toEqual(rejected);
	const wrongDigest = {
		sha256Bytes: async (value: Uint8Array) =>
			value.length === 3 ? "f".repeat(64) : checksum.sha256Bytes(value),
	};
	expect(
		await verifyBrowserBackupCandidate(
			actual,
			resourceProof.proof,
			resources,
			wrongDigest,
		),
	).toEqual(rejected);
	for (const phase of [
		"before",
		"project",
		"resource",
		"throw-project",
		"throw-resource",
	]) {
		const cancelled = cancellation();
		if (phase === "before") cancelled.abort();
		const digests = {
			sha256Bytes: async (value: Uint8Array) => {
				if ((value.length === 3) === phase.endsWith("resource")) {
					cancelled.abort();
					if (phase.startsWith("throw")) throw new Error("Cancelled digest");
				}
				return checksum.sha256Bytes(value);
			},
		};
		expect(
			await verifyBrowserBackupCandidate(
				actual,
				resourceProof.proof,
				resources,
				digests,
				cancelled.signal,
			),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	}
	expect(
		await verifyBrowserBackupCandidate(valid, represented.proof, [], {
			sha256Bytes: async () => {
				throw new Error("Digest unavailable");
			},
		}),
	).toEqual({ kind: "verification-unavailable" });
});

const bufferModule = "node:buffer";
async function nativeUtf8(value: string): Promise<Uint8Array> {
	const native: {
		Buffer: { from(value: string, encoding: "utf8"): Uint8Array };
	} = await import(bufferModule);
	return new Uint8Array(native.Buffer.from(value, "utf8"));
}

it("matches the native UTF8 oracle for counting and exact output across scalar and lone UTF16 boundaries", async () => {
	for (const value of [
		"",
		"A",
		"\u007f",
		"\u0080",
		"\u07ff",
		"\u0800",
		"\uffff",
		"😀",
		"\u0000",
		"\ud7ff",
		"\ud800\udc00",
		"\ud800\udfff",
		"\udbff\udc00",
		"\udbff\udfff",
		"\udc00\udc00",
		"\ud7ff\udc00",
		"\udbff\udbff",
		"\ud800\ue000",
		"\udbff\uffff",
		"\ud800",
		"\udfff",
		"\ud800A\udfff",
		"A😀Ж\ud800z".repeat(16384),
	]) {
		const expected = await nativeUtf8(value);
		expect(browserBackupUtf8ByteLength(value)).toBe(expected.byteLength);
		const encoded = encodeBrowserBackupUtf8(value);
		expect(encoded.byteLength).toBe(expected.byteLength);
		expect(encoded.every((byte, index) => byte === expected[index])).toBe(true);
		expect(encoded.byteLength).toBe(browserBackupUtf8ByteLength(value));
	}
	const value = "Ж😀".repeat(1048576),
		expected = await nativeUtf8(value);
	expect(browserBackupUtf8ByteLength(value)).toBe(6291456);
	const encoded = encodeBrowserBackupUtf8(value);
	expect(encoded.byteLength).toBe(expected.byteLength);
	expect(encoded.every((byte, index) => byte === expected[index])).toBe(true);
});

it("refuses an actual native UUID source identity reuse and preserves bytes against a mutating checksum port", async () => {
	const source = {
			...room(),
			projectId: "12345678-1234-4234-9234-123456789abc",
		},
		represented = await assessBrowserBackupRepresentability(
			source,
			[],
			checksum,
		);
	if (represented.kind !== "representable") throw new Error("No source");
	expect(
		await verifyBrowserBackupCandidate(
			await candidate(source),
			represented.proof,
			[],
			checksum,
		),
	).toEqual(rejected);
	const bytes = Uint8Array.of(1, 2, 3),
		resourceHash = await checksum.sha256Bytes(bytes),
		project = {
			...room(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "m",
					displayName: "Model",
					format: "glb" as const,
					resourceHash,
					byteLength: 3,
					widthMm: 100,
					depthMm: 100,
					heightMm: 100,
				},
			],
		},
		resources = [{ resourceHash, bytes }];
	expect(
		(
			await assessBrowserBackupRepresentability(project, resources, {
				sha256Bytes: async (input) => {
					const digest = await checksum.sha256Bytes(input);
					input.fill(9);
					return digest;
				},
			})
		).kind,
	).toBe("representable");
	expect(bytes).toStrictEqual(Uint8Array.of(1, 2, 3));
});

it("rejects extra right-hand own data and duplicate right-hand resource addresses in equal-sized snapshots", () => {
	const symbol = Symbol("retained");
	for (const right of [
		{ a: 1, b: 2 },
		{ a: 1, [symbol]: 2 },
	]) {
		expect(sameBrowserBackupValue({ a: 1 }, right)).toBe(false);
		expect(sameBrowserBackupValue(right, { a: 1 })).toBe(false);
	}
	const first = { resourceHash: "a".repeat(64), bytes: Uint8Array.of(1, 2) },
		second = { resourceHash: "b".repeat(64), bytes: Uint8Array.of(3, 4) };
	expect(sameBrowserBackupResourceBytes([first, second], [second, first])).toBe(
		true,
	);
	expect(sameBrowserBackupResourceBytes([first, second], [first, first])).toBe(
		false,
	);
	expect(sameBrowserBackupResourceBytes([first, first], [first, first])).toBe(
		false,
	);
});
