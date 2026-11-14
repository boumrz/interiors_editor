import { describe, expect, it } from "@rstest/core";

import { canonicalProjectSerializer } from "./create-project";
import { ExportPortableBackupUseCase } from "./export-portable-backup";
import type { PublicationCandidate } from "./ports";

const candidate: PublicationCandidate = {
	project: {
		assetDefinitionRefs: [],
		assetInstances: [],
		createdAt: "2026-08-23T07:00:00.000Z",
		level: {
			levelId: "level-1",
			openings: [],
			rooms: [],
			vertices: [],
			wallSegments: [],
		},
		lifecycle: "active",
		name: "Кухня / вариант 1",
		projectId: "project-1",
		schemaVersion: 1,
		updatedAt: "2026-08-23T07:00:00.000Z",
	},
	revision: {
		checksum: "old-checksum",
		createdAt: "2026-08-23T07:00:00.000Z",
		projectId: "project-1",
		revisionId: "revision-1",
		schemaVersion: 1,
		serializedProject: "",
	},
};

function decodeUtf8(bytes: Uint8Array | undefined): string {
	if (!bytes) throw new Error("Expected archive entry");
	return decodeURIComponent(
		Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, "0")}`).join(
			"",
		),
	);
}

describe("ExportPortableBackupUseCase", () => {
	it("packages every verified custom GLB beside its canonical Project member", async () => {
		let entries: Readonly<Record<string, Uint8Array>> | undefined;
		const resourceHash = "a".repeat(64);
		const glbBytes = Uint8Array.from([0x67, 0x6c, 0x54, 0x46]);
		const useCase = new ExportPortableBackupUseCase({
			binaryChecksum: { sha256Bytes: async () => resourceHash },
			checksum: { sha256: async (value) => `checksum:${value.length}` },
			encoder: {
				encode: (nextEntries) => {
					entries = nextEntries;
					return Uint8Array.from([5, 8, 9]);
				},
			},
			resources: { read: async () => glbBytes } as never,
			serializer: canonicalProjectSerializer,
		});

		await expect(useCase.execute(withCustomGlb(candidate, resourceHash, glbBytes.byteLength))).resolves.toEqual({
			bytes: Uint8Array.from([5, 8, 9]),
			filename: "Кухня-вариант-1.interiors",
			kind: "ready",
			mimeType: "application/zip",
		});
		expect(entries?.[`custom/${resourceHash}.glb`]).toEqual(glbBytes);
		const manifest = JSON.parse(decodeUtf8(entries?.["manifest.json"])) as Record<string, unknown>;
		expect(manifest.entries).toEqual(expect.arrayContaining([
			expect.objectContaining({
				byteLength: glbBytes.byteLength,
				mediaType: "model/gltf-binary",
				path: `custom/${resourceHash}.glb`,
				sha256: resourceHash,
			}),
		]));
		expect(manifest.resources).toEqual([
			{ path: `custom/${resourceHash}.glb`, resourceHash },
		]);
		const checksums = JSON.parse(decodeUtf8(entries?.["checksums.json"])) as Record<string, unknown>;
		expect(checksums.entries).toEqual(expect.arrayContaining([
			{ path: `custom/${resourceHash}.glb`, sha256: resourceHash },
		]));
		glbBytes.fill(0x00);
		expect(entries?.[`custom/${resourceHash}.glb`]).toEqual(
			Uint8Array.from([0x67, 0x6c, 0x54, 0x46]),
		);
	});

	it("keeps catalog version identity beside the exact model bytes in a portable backup", async () => {
		let entries: Readonly<Record<string, Uint8Array>> | undefined;
		const resourceHash = "a".repeat(64);
		const glbBytes = Uint8Array.from([0x67, 0x6c, 0x54, 0x46]);
		const useCase = new ExportPortableBackupUseCase({
			binaryChecksum: { sha256Bytes: async () => resourceHash },
			checksum: { sha256: async (value) => `checksum:${value.length}` },
			encoder: {
				encode: (nextEntries) => {
					entries = nextEntries;
					return Uint8Array.of(1);
				},
			},
			resources: { read: async () => glbBytes } as never,
			serializer: canonicalProjectSerializer,
		});
		const source = withCustomGlb(candidate, resourceHash, glbBytes.byteLength);
		const catalogCandidate: PublicationCandidate = {
			...source,
			project: {
				...source.project,
				assetDefinitionRefs: source.project.assetDefinitionRefs.map(
					(definition) => ({
						...definition,
						catalogAssetId: "walnut-table",
						catalogEnvelopeHash: "b".repeat(64),
						catalogVersion: "alpha-2026-08-30",
						source: "CatalogVersion" as const,
					}),
				),
			},
		};

		await expect(useCase.execute(catalogCandidate)).resolves.toMatchObject({
			kind: "ready",
		});
		expect(entries?.[`custom/${resourceHash}.glb`]).toEqual(glbBytes);
		expect(
			JSON.parse(decodeUtf8(entries?.["project/project.json"])),
		).toMatchObject({
			assetDefinitionRefs: [
				{
					catalogAssetId: "walnut-table",
					catalogEnvelopeHash: "b".repeat(64),
					catalogVersion: "alpha-2026-08-30",
					resourceHash,
					source: "CatalogVersion",
				},
			],
		});
	});

	it("refuses an archive if a referenced custom GLB is missing, mismatched or unverified", async () => {
		const resourceHash = "a".repeat(64);
		const input = withCustomGlb(candidate, resourceHash, 4);
		for (const dependencies of [
			{ binaryChecksum: { sha256Bytes: async () => resourceHash }, resources: { read: async () => undefined } },
			{ binaryChecksum: { sha256Bytes: async () => resourceHash }, resources: { read: async () => Uint8Array.of(1, 2, 3) } },
			{ binaryChecksum: { sha256Bytes: async () => "b".repeat(64) }, resources: { read: async () => Uint8Array.of(1, 2, 3, 4) } },
			{ binaryChecksum: undefined, resources: { read: async () => Uint8Array.of(1, 2, 3, 4) } },
			{ binaryChecksum: { sha256Bytes: async () => resourceHash }, resources: undefined },
			{ binaryChecksum: { sha256Bytes: async () => resourceHash }, resources: { read: async () => { throw new Error("storage fault"); } } },
		]) {
			let encoded = false;
			const useCase = new ExportPortableBackupUseCase({
				...dependencies,
				checksum: { sha256: async () => "unused" },
				encoder: { encode: () => { encoded = true; return Uint8Array.of(1); } },
				serializer: canonicalProjectSerializer,
			} as never);

			await expect(useCase.execute(input)).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
			});
			expect(encoded).toBe(false);
		}
	});

	it("does not read pinned bytes when the required binary verifier is unavailable", async () => {
		let reads = 0;
		const useCase = new ExportPortableBackupUseCase({
			checksum: { sha256: async () => "unused" },
			encoder: { encode: () => Uint8Array.of(1) },
			resources: {
				read: async () => {
					reads += 1;
					return Uint8Array.of(1, 2, 3, 4);
				},
			},
			serializer: canonicalProjectSerializer,
		} as never);

		await expect(
			useCase.execute(withCustomGlb(candidate, "a".repeat(64), 4)),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
		});
		expect(reads).toBe(0);
	});

	it("orders multiple pinned resources deterministically by immutable hash", async () => {
		let entries: Readonly<Record<string, Uint8Array>> | undefined;
		const firstHash = "a".repeat(64);
		const secondHash = "b".repeat(64);
		const useCase = new ExportPortableBackupUseCase({
			binaryChecksum: {
				sha256Bytes: async (bytes: Uint8Array) =>
					bytes[0] === 0x61 ? firstHash : secondHash,
			},
			checksum: {
				sha256: async (value: string) => `checksum:${value.length}`,
			},
			encoder: {
				encode: (nextEntries: Readonly<Record<string, Uint8Array>>) => {
					entries = nextEntries;
					return Uint8Array.of(1);
				},
			},
			resources: {
				read: async (resourceHash: string) =>
					resourceHash === firstHash
						? Uint8Array.of(0x61)
						: Uint8Array.of(0x62),
			},
			serializer: canonicalProjectSerializer,
		} as never);
		const definition = (resourceHash: string) => ({
			assetDefinitionId: `definition-${resourceHash[0]}`,
			byteLength: 1,
			depthMm: 500,
			displayName: `Model ${resourceHash[0]}`,
			format: "glb" as const,
			heightMm: 500,
			resourceHash,
			widthMm: 500,
		});

		await expect(
			useCase.execute({
				...candidate,
				project: {
					...candidate.project,
					assetDefinitionRefs: [
						definition(secondHash),
						definition(firstHash),
					],
				},
			}),
		).resolves.toMatchObject({ kind: "ready" });
		expect(Object.keys(entries ?? {})).toEqual([
			"checksums.json",
			"manifest.json",
			"project/project.json",
			`custom/${firstHash}.glb`,
			`custom/${secondHash}.glb`,
		]);
		const manifest = JSON.parse(
			decodeUtf8(entries?.["manifest.json"]),
		) as { resources: readonly { resourceHash: string }[] };
		expect(manifest.resources.map((resource) => resource.resourceHash)).toEqual([
			firstHash,
			secondHash,
		]);
	});

	it("rejects an invalid technical custom-GLB descriptor before it reads or encodes a backup", async () => {
		let reads = 0;
		let encoded = false;
		const useCase = new ExportPortableBackupUseCase({
			binaryChecksum: { sha256Bytes: async () => "a".repeat(64) },
			checksum: { sha256: async () => "unused" },
			encoder: {
				encode: () => {
					encoded = true;
					return Uint8Array.of(1);
				},
			},
			resources: {
				delete: async () => undefined,
				read: async () => {
					reads += 1;
					return Uint8Array.of(1);
				},
				writeIfAbsent: async () => ({ kind: "stored" as const }),
			},
			serializer: canonicalProjectSerializer,
		});

		for (const [resourceHash, byteLength] of [
			["a".repeat(64).concat("0"), 1],
			["0".concat("a".repeat(64)), 1],
			["g".repeat(64), 1],
			["a".repeat(64), 0],
			["a".repeat(64), 1.5],
		] as const) {
			await expect(useCase.execute(withCustomGlb(candidate, resourceHash, byteLength))).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
			});
		}
		expect(reads).toBe(0);
		expect(encoded).toBe(false);
	});

	it("builds a complete resource-free .interiors bundle with canonical project, manifest and checksums", async () => {
		let entries: Readonly<Record<string, Uint8Array>> | undefined;
		const useCase = new ExportPortableBackupUseCase({
			checksum: { sha256: async (value) => `checksum:${value.length}` },
			encoder: {
				encode: (nextEntries) => {
					entries = nextEntries;
					return Uint8Array.from([8, 5, 3]);
				},
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(useCase.execute(candidate)).resolves.toEqual({
			bytes: Uint8Array.from([8, 5, 3]),
			filename: "Кухня-вариант-1.interiors",
			kind: "ready",
			mimeType: "application/zip",
		});
		expect(Object.keys(entries ?? {})).toEqual([
			"checksums.json",
			"manifest.json",
			"project/project.json",
		]);
		expect(decodeUtf8(entries?.["project/project.json"])).toBe(
			canonicalProjectSerializer.serialize(candidate.project),
		);
		const manifest = JSON.parse(
			decodeUtf8(entries?.["manifest.json"]),
		) as Record<string, unknown>;
		const projectEntry = entries?.["project/project.json"];
		expect(manifest).toEqual({
			backupFormat: "interiors-portable-backup",
			backupFormatVersion: 1,
			canonicalProjectPath: "project/project.json",
			complete: true,
			createdAt: "2026-08-23T07:00:00.000Z",
			entries: [
				{
					byteLength: projectEntry?.byteLength,
					mediaType: "application/json",
					path: "project/project.json",
					sha256: expect.stringMatching(/^checksum:/),
				},
			],
			projectSchemaId: "interiors.project/alpha-1",
			projectSchemaVersion: 1,
			requiredCapabilities: [],
			resources: [],
			sourceProjectId: "project-1",
		});
		const checksums = JSON.parse(
			decodeUtf8(entries?.["checksums.json"]),
		) as Record<string, unknown>;
		expect(checksums).toMatchObject({
			algorithm: "sha-256",
			entries: [
				{
					path: "project/project.json",
					sha256: expect.stringMatching(/^checksum:/),
				},
			],
		});
	});

	it("refuses to call a resource-free backup complete when exact model bytes are referenced", async () => {
		const encode = () => Uint8Array.from([1]);
		const useCase = new ExportPortableBackupUseCase({
			checksum: { sha256: async () => "unused" },
			encoder: { encode },
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute({
				...candidate,
				project: {
					...candidate.project,
					assetDefinitionRefs: [
						{
							assetDefinitionId: "model-1",
							byteLength: 1024,
							depthMm: 900,
							displayName: "Моя модель",
							format: "glb",
							heightMm: 800,
							resourceHash: "a".repeat(64),
							widthMm: 1000,
						},
					],
				},
			}),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
		});
	});

	it("rejects an unsupported project schema before it can create an archive", async () => {
		let encoded = false;
		const useCase = new ExportPortableBackupUseCase({
			checksum: { sha256: async () => "unused" },
			encoder: {
				encode: () => {
					encoded = true;
					return Uint8Array.from([1]);
				},
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute({
				...candidate,
				project: { ...candidate.project, schemaVersion: 2 } as never,
			}),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_UNSUPPORTED",
		});
		expect(encoded).toBe(false);
	});

	it("rejects an unsupported revision schema before it can create an archive", async () => {
		let encoded = false;
		const useCase = new ExportPortableBackupUseCase({
			checksum: { sha256: async () => "unused" },
			encoder: {
				encode: () => {
					encoded = true;
					return Uint8Array.from([1]);
				},
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute({
				...candidate,
				revision: { ...candidate.revision, schemaVersion: 2 } as never,
			}),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_UNSUPPORTED",
		});
		expect(encoded).toBe(false);
	});
});

function withCustomGlb(
	base: PublicationCandidate,
	resourceHash: string,
	byteLength: number,
): PublicationCandidate {
	return {
		...base,
		project: {
			...base.project,
			assetDefinitionRefs: [
				{
					assetDefinitionId: "model-1",
					byteLength,
					depthMm: 900,
					displayName: "Моя модель",
					format: "glb",
					heightMm: 800,
					resourceHash,
					widthMm: 1000,
				},
			],
		},
	};
}
