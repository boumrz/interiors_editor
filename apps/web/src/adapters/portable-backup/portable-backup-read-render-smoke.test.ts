import { describe, expect, it } from "@rstest/core";

import { createInitialProject } from "../../domain/initial-project";
import type { Project } from "../../domain/project";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import { validateCatalogMedia } from "../catalog/catalog-media-validator";
import { PortableBackupReadRenderSmokeCheck } from "./portable-backup-read-render-smoke";

describe("PortableBackupReadRenderSmokeCheck", () => {
	it("proves a staged canonical room can be read and projected into the disposable 2D/3D scene before publication", async () => {
		const project = rectangularProject();
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: { sha256Bytes: async () => "unused" },
		});

		await expect(smoke.verify(project, [])).resolves.toBe(true);
	});

	it("accepts an honest open 2D drawing that has no derived Room or 3D scene yet", async () => {
		const project = createInitialProject({
			createdAt: "2026-08-26T08:00:00.000Z",
			levelId: "open-level",
			name: "Открытый план",
			projectId: "open-project",
		});
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: { sha256Bytes: async () => "unused" },
		});

		await expect(smoke.verify(project, [])).resolves.toBe(true);
	});

	it("uses an isolated clean profile instead of letting already-pinned production bytes satisfy the smoke", async () => {
		const bytes = minimalStaticGlb();
		const resourceHash = "a".repeat(64);
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: { sha256Bytes: async () => resourceHash },
		});

		await expect(
			smoke.verify(projectWithResource(bytes.byteLength, resourceHash), []),
		).resolves.toBe(false);
		await expect(
			smoke.verify(projectWithResource(bytes.byteLength, resourceHash), [
				{ bytes, resourceHash },
			]),
		).resolves.toBe(true);
	});

	it("rejects a valid staged GLB whose byte length differs from its Project definition", async () => {
		const bytes = minimalStaticGlb();
		const resourceHash = "a".repeat(64);
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: { sha256Bytes: async () => resourceHash },
		});

		await expect(
			smoke.verify(projectWithResource(bytes.byteLength + 1, resourceHash), [
				{ bytes, resourceHash },
			]),
		).resolves.toBe(false);
	});

	it.each([
		["missing bytes", undefined, "a".repeat(64)],
		["malformed GLB", Uint8Array.of(1, 2, 3, 4), "a".repeat(64)],
		["wrong immutable hash", minimalStaticGlb(), "b".repeat(64)],
	])(
		"rejects %s before the imported Project can publish",
		async (_label, bytes, digest) => {
			const resourceHash = "a".repeat(64);
			const project: Project = {
				...rectangularProject(),
				assetDefinitionRefs: [
					{
						assetDefinitionId: "custom-model",
						byteLength: bytes?.byteLength ?? minimalStaticGlb().byteLength,
						depthMm: 500,
						displayName: "Модель",
						format: "glb",
						heightMm: 500,
						resourceHash,
						widthMm: 500,
					},
				],
			};
			const smoke = new PortableBackupReadRenderSmokeCheck({
				checksum: { sha256Bytes: async () => digest },
			});

			await expect(
				smoke.verify(project, bytes ? [{ bytes, resourceHash }] : []),
			).resolves.toBe(false);
		},
	);

	it("rejects canonical metadata that cannot recreate its derived room projection", async () => {
		const project = rectangularProject();
		const broken: Project = {
			...project,
			level: {
				...project.level,
				rooms: project.level.rooms.map((room) => ({
					...room,
					faceFingerprint: "not-the-derived-face",
				})),
			},
		};
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: { sha256Bytes: async () => "unused" },
		});

		await expect(smoke.verify(broken, [])).resolves.toBe(false);
	});
});

function rectangularProject(): Project {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-26T08:00:00.000Z",
			levelId: "level-import-smoke",
			name: "Импорт",
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
		throw new Error("Expected rectangular import fixture");
	}
	return configured.project;
}

function projectWithResource(
	byteLength: number,
	resourceHash: string,
): Project {
	return {
		...rectangularProject(),
		assetDefinitionRefs: [
			{
				assetDefinitionId: "custom-model",
				byteLength,
				depthMm: 500,
				displayName: "Модель",
				format: "glb",
				heightMm: 500,
				resourceHash,
				widthMm: 500,
			},
		],
	};
}

function minimalStaticGlb(): Uint8Array {
	const json = new TextEncoder().encode('{"asset":{"version":"2.0"}} ');
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

const portableResourcePolicy = {
	maximumInputBytes: 50 * 1024 * 1024,
	hashComparison: "sha256-bits" as const,
};

function paddedGlb(totalBytes: number): Uint8Array {
	const json = new TextEncoder().encode(
		JSON.stringify({
			asset: { version: "2.0" },
			buffers: [{ byteLength: totalBytes - 128 }],
			scenes: [{ nodes: [] }],
		}),
	);
	const jsonLength = Math.ceil(json.byteLength / 4) * 4;
	const binaryLength = totalBytes - 28 - jsonLength;
	const actualJson = new TextEncoder().encode(
		JSON.stringify({
			asset: { version: "2.0" },
			buffers: [{ byteLength: binaryLength }],
			scenes: [{ nodes: [] }],
		}),
	);
	if (
		Math.ceil(actualJson.byteLength / 4) * 4 !== jsonLength ||
		binaryLength % 4
	)
		throw new Error("Expected aligned fixture");
	const bytes = new Uint8Array(totalBytes);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, totalBytes, true);
	view.setUint32(12, jsonLength, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.set(actualJson, 20);
	bytes.fill(0x20, 20 + actualJson.byteLength, 20 + jsonLength);
	view.setUint32(20 + jsonLength, binaryLength, true);
	view.setUint32(24 + jsonLength, 0x004e4942, true);
	return bytes;
}
async function hash(bytes: Uint8Array): Promise<string> {
	return [
		...new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
		),
	]
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}

describe.sequential("explicit portable resource smoke policy", () => {
	it("does not silently reinterpret an unknown explicit hash policy", () => {
		const policy = { ...portableResourcePolicy };
		Object.defineProperty(policy, "hashComparison", { value: "unknown" });
		expect(
			() =>
				new PortableBackupReadRenderSmokeCheck({
					checksum: { sha256Bytes: async () => "unused" },
					resourcePolicy: policy,
				}),
		).toThrow(RangeError);
	});
	it("keeps experimental/catalog/default smoke at 25 MiB while technically checking portable 50 MiB", async () => {
		const resourceHash = "a".repeat(64);
		const checksum = { sha256Bytes: async () => resourceHash };
		const old = new PortableBackupReadRenderSmokeCheck({ checksum });
		const portable = new PortableBackupReadRenderSmokeCheck({
			checksum,
			resourcePolicy: portableResourcePolicy,
		});
		for (const inputBytes of [
			25 * 1024 * 1024,
			25 * 1024 * 1024 + 4,
			50 * 1024 * 1024,
		]) {
			const bytes = paddedGlb(inputBytes);
			const project = projectWithResource(bytes.byteLength, resourceHash);
			expect(await portable.verify(project, [{ bytes, resourceHash }])).toBe(
				true,
			);
			expect(await old.verify(project, [{ bytes, resourceHash }])).toBe(
				inputBytes <= 25 * 1024 * 1024,
			);
			expect(validateCatalogMedia("model/gltf-binary", bytes).kind).toBe(
				inputBytes <= 25 * 1024 * 1024 ? "accepted" : "rejected",
			);
		}
	});
	it("captures an explicit bounded policy and rejects invalid trusted policy before use", async () => {
		for (const maximumInputBytes of [
			0,
			-1,
			1.5,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			50 * 1024 * 1024 + 1,
		])
			expect(
				() =>
					new PortableBackupReadRenderSmokeCheck({
						checksum: { sha256Bytes: async () => "unused" },
						resourcePolicy: { ...portableResourcePolicy, maximumInputBytes },
					}),
			).toThrow(RangeError);
		const policy = { ...portableResourcePolicy, maximumInputBytes: 4 };
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: { sha256Bytes: async () => "a".repeat(64) },
			resourcePolicy: policy,
		});
		policy.maximumInputBytes = 50 * 1024 * 1024;
		const bytes = minimalStaticGlb();
		expect(
			await smoke.verify(
				projectWithResource(bytes.byteLength, "a".repeat(64)),
				[{ bytes, resourceHash: "a".repeat(64) }],
			),
		).toBe(false);
	});
	it("rejects an oversized profile before snapshot copies or hash calls", async () => {
		const bytes = new Uint8Array(50 * 1024 * 1024 + 1);
		let copies = 0,
			hashes = 0;
		Object.defineProperty(bytes, "slice", {
			value() {
				copies++;
				throw new Error("Must not copy oversized bytes");
			},
		});
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: {
				sha256Bytes: async () => {
					hashes++;
					return "a".repeat(64);
				},
			},
			resourcePolicy: portableResourcePolicy,
		});
		expect(
			await smoke.verify(
				projectWithResource(bytes.byteLength, "a".repeat(64)),
				[{ bytes, resourceHash: "a".repeat(64) }],
			),
		).toBe(false);
		expect(copies).toBe(0);
		expect(hashes).toBe(0);
	});
	it("checks the entire profile's entry and summed byte budgets before copying its first resource", async () => {
		let copies = 0,
			hashes = 0;
		const tiny = minimalStaticGlb();
		Object.defineProperty(tiny, "slice", {
			value() {
				copies++;
				throw new Error("Must precheck the whole profile");
			},
		});
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: {
				sha256Bytes: async () => {
					hashes++;
					return "a".repeat(64);
				},
			},
			resourcePolicy: portableResourcePolicy,
		});
		const many = Array.from({ length: 901 }, (_, index) => ({
			bytes: tiny,
			resourceHash: index.toString(16).padStart(64, "0"),
		}));
		expect(await smoke.verify(rectangularProject(), many)).toBe(false);
		const full = new Uint8Array(50 * 1024 * 1024);
		const rest = full.subarray(0, 30 * 1024 * 1024 + 1);
		for (const bytes of [full, rest])
			Object.defineProperty(bytes, "slice", {
				value() {
					copies++;
					throw new Error("Must precheck summed bytes");
				},
			});
		expect(
			await smoke.verify(
				rectangularProject(),
				[full, full, full, rest].map((bytes, index) => ({
					bytes,
					resourceHash: index.toString(16).padStart(64, "0"),
				})),
			),
		).toBe(false);
		expect(copies).toBe(0);
		expect(hashes).toBe(0);
	});
	it("retains the inclusive 180 MiB budget before archive case-alias deduplication", async () => {
		const full = paddedGlb(50 * 1024 * 1024);
		const rest = paddedGlb(30 * 1024 * 1024);
		const resources = [
			{ resourceHash: "a".repeat(64), bytes: full },
			{ resourceHash: "A".repeat(64), bytes: full },
			{ resourceHash: "aA".repeat(32), bytes: full },
			{ resourceHash: "b".repeat(64), bytes: rest },
		];
		const first = projectWithResource(
			full.byteLength,
			resources[0].resourceHash,
		);
		const project: Project = {
			...first,
			assetDefinitionRefs: resources.map((resource, index) => ({
				...first.assetDefinitionRefs[0],
				assetDefinitionId: `budget-model-${index}`,
				byteLength: resource.bytes.byteLength,
				resourceHash: resource.resourceHash,
			})),
		};
		let hashes = 0;
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: {
				sha256Bytes: async (bytes) => {
					hashes++;
					return bytes.byteLength === full.byteLength
						? "a".repeat(64)
						: "b".repeat(64);
				},
			},
			resourcePolicy: portableResourcePolicy,
		});
		expect(await smoke.verify(project, resources)).toBe(true);
		expect(hashes).toBe(4);
	});
	it("verifies every original case-alias key independently by SHA256 bits without rewriting Project keys", async () => {
		const bytes = minimalStaticGlb();
		const lower = await hash(bytes);
		const upper = lower.toUpperCase();
		const first = projectWithResource(bytes.byteLength, lower);
		const project = {
			...first,
			assetDefinitionRefs: [
				first.assetDefinitionRefs[0],
				{
					...first.assetDefinitionRefs[0],
					assetDefinitionId: "upper-key",
					resourceHash: upper,
				},
			],
		};
		const before = structuredClone(project);
		let digests = 0;
		const checksum = {
			sha256Bytes: async (value: Uint8Array) => {
				digests++;
				return (await hash(value)).toUpperCase();
			},
		};
		const portable = new PortableBackupReadRenderSmokeCheck({
			checksum,
			resourcePolicy: portableResourcePolicy,
		});
		const old = new PortableBackupReadRenderSmokeCheck({ checksum });
		const resources = [
			{ resourceHash: lower, bytes },
			{ resourceHash: upper, bytes: bytes.slice() },
		];
		expect(await portable.verify(project, resources)).toBe(true);
		expect(digests).toBe(2);
		expect(project).toEqual(before);
		expect(
			project.assetDefinitionRefs.map((value) => value.resourceHash),
		).toEqual([lower, upper]);
		expect(await old.verify(first, [resources[0]])).toBe(false);
		expect(await portable.verify(project, [resources[0]])).toBe(false);
		const changed = bytes.slice();
		changed[changed.length - 1] = 0x09;
		expect(
			await portable.verify(project, [
				resources[0],
				{ resourceHash: upper, bytes: changed },
			]),
		).toBe(false);
		expect(await portable.verify(project, [resources[0], resources[0]])).toBe(
			false,
		);
		expect(
			await portable.verify(first, [
				resources[0],
				{ resourceHash: lower, bytes: bytes.slice() },
			]),
		).toBe(false);
	});
	it("does not accept malformed digest strings or a changed digest bit as a case alias", async () => {
		const bytes = minimalStaticGlb();
		const expected = await hash(bytes);
		for (const digest of [
			expected.slice(1),
			`${expected}0`,
			`${expected}\n`,
			`g${expected.slice(1)}`,
			`${expected[0] === "0" ? "1" : "0"}${expected.slice(1)}`,
			`${expected.slice(0, -1)}${expected.endsWith("0") ? "1" : "0"}`,
		]) {
			const smoke = new PortableBackupReadRenderSmokeCheck({
				checksum: { sha256Bytes: async () => digest },
				resourcePolicy: portableResourcePolicy,
			});
			expect(
				await smoke.verify(projectWithResource(bytes.byteLength, expected), [
					{ resourceHash: expected, bytes },
				]),
			).toBe(false);
		}
	});

	it("rejects a non-64-character expected hash even when its first 256 bits match", async () => {
		const bytes = minimalStaticGlb();
		const digest = await hash(bytes);
		for (const resourceHash of [`${digest}0`, `${digest}\n`]) {
			const smoke = new PortableBackupReadRenderSmokeCheck({
				checksum: { sha256Bytes: async () => digest },
				resourcePolicy: portableResourcePolicy,
			});
			expect(
				await smoke.verify(
					projectWithResource(bytes.byteLength, resourceHash),
					[{ bytes, resourceHash }],
				),
			).toBe(false);
		}
	});
	it("keeps the cold profile local, snapshots exact input bytes across an async digest and never carries bytes to the next smoke", async () => {
		const bytes = minimalStaticGlb();
		const resourceHash = await hash(bytes);
		const project = projectWithResource(bytes.byteLength, resourceHash);
		const before = structuredClone(project);
		let entered: (() => void) | undefined, release: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: {
				sha256Bytes: async (value) => {
					entered?.();
					await hold;
					return hash(value);
				},
			},
			resourcePolicy: portableResourcePolicy,
		});
		const result = smoke.verify(project, [{ resourceHash, bytes }]);
		const firstResult = await Promise.race([
			started.then(() => "hash-started"),
			result.then(() => "completed-before-hash"),
		]);
		expect(firstResult).toBe("hash-started");
		bytes.fill(9);
		release?.();
		expect(await result).toBe(true);
		expect(project).toEqual(before);
		expect(await smoke.verify(project, [])).toBe(false);
	});
	it("retains the existing malformed/static/security and derived-room refusals in the explicit policy", async () => {
		const resourceHash = "a".repeat(64);
		let hashes = 0;
		const smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: {
				sha256Bytes: async () => {
					hashes++;
					return resourceHash;
				},
			},
			resourcePolicy: portableResourcePolicy,
		});
		const malformed = minimalStaticGlb();
		new DataView(malformed.buffer).setUint32(4, 3, true);
		expect(
			await smoke.verify(
				projectWithResource(malformed.byteLength, resourceHash),
				[{ resourceHash, bytes: malformed }],
			),
		).toBe(false);
		expect(hashes).toBe(0);
		const project = rectangularProject();
		expect(
			await smoke.verify(
				{
					...project,
					level: {
						...project.level,
						rooms: project.level.rooms.map((room) => ({
							...room,
							faceFingerprint: "wrong",
						})),
					},
				},
				[],
			),
		).toBe(false);
	});
});
