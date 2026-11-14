import { describe, expect, it } from "@rstest/core";

import type { Project } from "./project";
import {
	decodeLocalProjectJson,
	encodeLocalProjectJson,
} from "./project-json-transfer";

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
	return new Uint8Array(bytes);
}

const checksum = async (value: string): Promise<string> =>
	`checksum:${value.length}`;

function project(): Project {
	return {
		assetDefinitionRefs: [],
		assetInstances: [
			{
				anchorClass: "floor",
				assetInstanceId: "asset-table",
				color: "#8b5a2b",
				depthMm: 700,
				elevationMm: 0,
				heightMm: 750,
				label: "Стол",
				roomId: "room-main",
				widthMm: 1200,
				xMm: 1800,
				yawRadians: 0.5,
				zMm: 1200,
			},
		],
		createdAt: "2026-08-15T10:00:00.000Z",
		level: {
			levelId: "level-main",
			openings: [
				{
					heightMm: 2100,
					kind: "Door",
					offsetMm: 2000,
					openingId: "opening-door",
					sillMm: 0,
					swingSide: "left",
					wallSegmentId: "wall-bottom",
					widthMm: 900,
				},
			],
			rooms: [
				{
					faceFingerprint: "orthogonal-face:0:0|0:3000|4000:3000|4000:0",
					heightMm: 2600,
					name: "Гостиная",
					roomId: "room-main",
					type: "living-room",
				},
			],
			vertices: [
				{ vertexId: "vertex-a", xMm: 0, zMm: 0 },
				{ vertexId: "vertex-b", xMm: 4000, zMm: 0 },
				{ vertexId: "vertex-c", xMm: 4000, zMm: 3000 },
				{ vertexId: "vertex-d", xMm: 0, zMm: 3000 },
			],
			wallSegments: [
				{
					endVertexId: "vertex-b",
					startVertexId: "vertex-a",
					thicknessMm: 100,
					wallSegmentId: "wall-bottom",
				},
				{
					endVertexId: "vertex-c",
					startVertexId: "vertex-b",
					thicknessMm: 100,
					wallSegmentId: "wall-right",
				},
				{
					endVertexId: "vertex-d",
					startVertexId: "vertex-c",
					thicknessMm: 100,
					wallSegmentId: "wall-top",
				},
				{
					endVertexId: "vertex-a",
					startVertexId: "vertex-d",
					thicknessMm: 100,
					wallSegmentId: "wall-left",
				},
			],
		},
		lifecycle: "active",
		name: "План для передачи",
		projectId: "source-project",
		schemaVersion: 1,
		updatedAt: "2026-08-15T10:05:00.000Z",
	};
}

describe("local Project JSON transfer", () => {
	it("rejects a window that carries a door-only swing side", async () => {
		const malformedWindow = {
			...project(),
			level: {
				...project().level,
				openings: [
					{
						heightMm: 1200,
						kind: "Window",
						offsetMm: 2000,
						openingId: "opening-window",
						sillMm: 900,
						swingSide: "left",
						wallSegmentId: "wall-bottom",
						widthMm: 1200,
					},
				],
			},
		} as unknown as Project;
		const serialized = await encodeLocalProjectJson(malformedWindow, checksum);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it("round-trips a canonical local project with an explicit format version and checksum", async () => {
		const serialized = await encodeLocalProjectJson(project(), checksum);

		expect(JSON.parse(serialized)).toMatchObject({
			format: "interiors-editor-project-json",
			formatVersion: 1,
			projectChecksum: expect.stringMatching(/^checksum:/),
		});
		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "accepted",
			project: project(),
		});
	});

	it("requires every newly authored floor elevation to be the explicit grounded zero while reading legacy zero-equivalent items", async () => {
		const current = project();
		const invalid = {
			...current,
			assetInstances: [{ ...current.assetInstances[0], elevationMm: 1 }],
		} as unknown as Project;
		const invalidSerialized = await encodeLocalProjectJson(invalid, checksum);
		await expect(
			decodeLocalProjectJson(utf8Bytes(invalidSerialized), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});

		const currentItem = current.assetInstances[0];
		if (currentItem?.anchorClass !== "floor") {
			throw new Error("Expected a floor-item fixture");
		}
		const { elevationMm: _legacyElevation, ...legacyItem } = currentItem;
		const legacy: Project = { ...current, assetInstances: [legacyItem] };
		const legacySerialized = await encodeLocalProjectJson(legacy, checksum);
		await expect(
			decodeLocalProjectJson(utf8Bytes(legacySerialized), checksum),
		).resolves.toEqual({ kind: "accepted", project: legacy });
	});

	it.each([20, 101, 1000])(
		"round-trips a canonical %i mm wall thickness",
		async (thicknessMm) => {
			const source = {
				...project(),
				level: {
					...project().level,
					wallSegments: project().level.wallSegments.map((wall, index) =>
						index === 0 ? { ...wall, thicknessMm } : wall,
					),
				},
			};
			const serialized = await encodeLocalProjectJson(source, checksum);

			await expect(
				decodeLocalProjectJson(utf8Bytes(serialized), checksum),
			).resolves.toEqual({ kind: "accepted", project: source });
		},
	);

	it.each([19, 1001])(
		"rejects a persisted %i mm wall thickness outside the hard range",
		async (thicknessMm) => {
			const source = {
				...project(),
				level: {
					...project().level,
					wallSegments: project().level.wallSegments.map((wall, index) =>
						index === 0 ? { ...wall, thicknessMm } : wall,
					),
				},
			};
			const serialized = await encodeLocalProjectJson(source, checksum);

			await expect(
				decodeLocalProjectJson(utf8Bytes(serialized), checksum),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PROJECT_JSON_INVALID",
			});
		},
	);

	it("round-trips a stable item color variant and rejects a mismatched projection color", async () => {
		const source: Project = {
			...project(),
			assetInstances: [
				{
					...project().assetInstances[0],
					color: "#416b91",
					colorVariantId: "alpha-blue",
				},
				{
					anchorClass: "wall",
					assetInstanceId: "asset-panel",
					color: "#a76a3b",
					colorVariantId: "alpha-warm-wood",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Настенная панель",
					offsetMm: 2050,
					side: "left",
					wallSegmentId: "wall-bottom",
					widthMm: 900,
				},
			],
		};
		const serialized = await encodeLocalProjectJson(source, checksum);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({ kind: "accepted", project: source });

		const mismatched = await encodeLocalProjectJson(
			{
				...source,
				assetInstances: [
					{
						...source.assetInstances[0],
						color: "#a76a3b",
					},
				],
			},
			checksum,
		);
		await expect(
			decodeLocalProjectJson(utf8Bytes(mismatched), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});

		const mismatchedWall = await encodeLocalProjectJson(
			{
				...source,
				assetInstances: source.assetInstances.map((item) =>
					item.anchorClass === "wall" ? { ...item, color: "#416b91" } : item,
				),
			},
			checksum,
		);
		await expect(
			decodeLocalProjectJson(utf8Bytes(mismatchedWall), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});

		const unknownVariant = await encodeLocalProjectJson(
			{
				...source,
				assetInstances: [
					{
						...source.assetInstances[0],
						colorVariantId: "not-a-variant",
					},
				],
			} as unknown as Project,
			checksum,
		);
		await expect(
			decodeLocalProjectJson(utf8Bytes(unknownVariant), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});

		const unknownWallVariant = await encodeLocalProjectJson(
			{
				...source,
				assetInstances: [
					{
						...source.assetInstances[1],
						colorVariantId: "not-a-variant",
					},
				],
			} as unknown as Project,
			checksum,
		);
		await expect(
			decodeLocalProjectJson(utf8Bytes(unknownWallVariant), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it("rejects a declared local color variant on a GLB-backed item", async () => {
		const glbBackedVariant = {
			...project(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "catalog-table-1",
					byteLength: 1024,
					depthMm: 700,
					displayName: "Стол",
					format: "glb" as const,
					heightMm: 750,
					resourceHash: "a".repeat(64),
					widthMm: 1200,
				},
			],
			assetInstances: [
				{
					...project().assetInstances[0],
					assetDefinitionId: "catalog-table-1",
					color: "#416b91",
					colorVariantId: "alpha-blue",
				},
			],
		} as Project;
		const serialized = await encodeLocalProjectJson(glbBackedVariant, checksum);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it("round-trips the explicit true wall-item lock marker and rejects any other lock value", async () => {
		const lockedWallProject: Project = {
			...project(),
			assetInstances: [
				{
					anchorClass: "wall",
					assetInstanceId: "asset-panel",
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Настенная панель",
					locked: true,
					offsetMm: 2050,
					side: "left",
					wallSegmentId: "wall-bottom",
					widthMm: 900,
				},
			],
		};
		const serialized = await encodeLocalProjectJson(
			lockedWallProject,
			checksum,
		);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "accepted",
			project: lockedWallProject,
		});
		const invalidLock = serialized.replace('"locked":true', '"locked":false');
		await expect(
			decodeLocalProjectJson(utf8Bytes(invalidLock), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it("round-trips the explicit true floor-item lock marker and rejects any other lock value", async () => {
		const lockedFloorProject = {
			...project(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "catalog-table-1",
					byteLength: 1024,
					depthMm: 700,
					displayName: "Стол",
					format: "glb" as const,
					heightMm: 750,
					resourceHash: "a".repeat(64),
					widthMm: 1200,
				},
			],
			assetInstances: [
				{
					...project().assetInstances[0],
					assetDefinitionId: "catalog-table-1",
					locked: true,
				},
			],
		} as Project;
		const serialized = await encodeLocalProjectJson(
			lockedFloorProject,
			checksum,
		);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "accepted",
			project: lockedFloorProject,
		});
		const invalidLock = serialized.replace('"locked":true', '"locked":false');
		await expect(
			decodeLocalProjectJson(utf8Bytes(invalidLock), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it("round-trips technical custom-GLB metadata but rejects a retired legal usage declaration", async () => {
		const technicalCustomGlbProject: Project = {
			...project(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "catalog-table-1",
					byteLength: 1024,
					depthMm: 700,
					displayName: "Стол",
					format: "glb",
					heightMm: 750,
					resourceHash: "a".repeat(64),
					widthMm: 1200,
				},
			],
		};
		const serialized = await encodeLocalProjectJson(
			technicalCustomGlbProject,
			checksum,
		);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "accepted",
			project: technicalCustomGlbProject,
		});
		const retiredDeclaration = serialized.replace(
			'"widthMm":1200}',
			'"usageDeclaration":{"exactBytesInPrivateBackup":true,"localOptimization":true,"renderAndThumbnail":true,"renderedShare":true},"widthMm":1200}',
		);
		await expect(
			decodeLocalProjectJson(utf8Bytes(retiredDeclaration), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it("round-trips an exact versioned catalog origin but rejects partial catalog provenance", async () => {
		const catalogAssetProject = {
			...project(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "catalog-table-1",
					byteLength: 1024,
					catalogAssetId: "walnut-table",
					catalogEnvelopeHash: "b".repeat(64),
					catalogVersion: "alpha-2026-08-30",
					depthMm: 700,
					displayName: "Стол",
					format: "glb" as const,
					heightMm: 750,
					resourceHash: "a".repeat(64),
					source: "CatalogVersion",
					widthMm: 1200,
				},
			],
		} as unknown as Project;
		const serialized = await encodeLocalProjectJson(catalogAssetProject, checksum);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({ kind: "accepted", project: catalogAssetProject });

		const missingEnvelopeHash = serialized.replace(
			`"catalogEnvelopeHash":"${"b".repeat(64)}",`,
			"",
		);
		const invalidCatalogOrigins = [
			missingEnvelopeHash,
			serialized.replace('"catalogAssetId":"walnut-table"', '"catalogAssetId":""'),
			serialized.replace('"catalogAssetId":"walnut-table"', '"catalogAssetId":" walnut-table "'),
			serialized.replace('"catalogVersion":"alpha-2026-08-30"', '"catalogVersion":""'),
			serialized.replace('"catalogVersion":"alpha-2026-08-30"', '"catalogVersion":" alpha-2026-08-30 "'),
			serialized.replace('"source":"CatalogVersion"', '"source":"CustomAssetId"'),
			serialized.replace(`"catalogEnvelopeHash":"${"b".repeat(64)}"`, `"catalogEnvelopeHash":"${"b".repeat(63)}"`),
			serialized.replace(`"catalogEnvelopeHash":"${"b".repeat(64)}"`, `"catalogEnvelopeHash":"x${"b".repeat(64)}"`),
			serialized.replace(`"catalogEnvelopeHash":"${"b".repeat(64)}"`, `"catalogEnvelopeHash":"${"b".repeat(64)}x"`),
			serialized.replace(`"catalogEnvelopeHash":"${"b".repeat(64)}"`, `"catalogEnvelopeHash":["${"b".repeat(64)}"]`),
		];
		for (const invalidCatalogOrigin of invalidCatalogOrigins) {
			await expect(
				decodeLocalProjectJson(utf8Bytes(invalidCatalogOrigin), checksum),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PROJECT_JSON_INVALID",
			});
		}
	});

	it("keeps the wall-item lock extension strict without making its marker mandatory", async () => {
		const wallItem = {
			anchorClass: "wall" as const,
			assetDefinitionId: "catalog-panel-1",
			assetInstanceId: "asset-panel",
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Настенная панель",
			offsetMm: 2050,
			side: "left" as const,
			wallSegmentId: "wall-bottom",
			widthMm: 900,
		};
		const unlockedWallProject = {
			...project(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "catalog-panel-1",
					byteLength: 1024,
					depthMm: 50,
					displayName: "Настенная панель",
					format: "glb" as const,
					heightMm: 600,
					resourceHash: "a".repeat(64),
					widthMm: 900,
				},
			],
			assetInstances: [wallItem],
		} as Project;

		const serialized = await encodeLocalProjectJson(
			unlockedWallProject,
			checksum,
		);
		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "accepted",
			project: unlockedWallProject,
		});

		for (const malformedItem of [
			{ ...wallItem, assetInstanceId: "" },
			{ ...wallItem, assetDefinitionId: "" },
			{ ...wallItem, unexpected: "must-not-transfer" },
		]) {
			const malformedProject = {
				...project(),
				assetInstances: [malformedItem],
			} as unknown as Project;
			const malformed = await encodeLocalProjectJson(
				malformedProject,
				checksum,
			);
			await expect(
				decodeLocalProjectJson(utf8Bytes(malformed), checksum),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PROJECT_JSON_INVALID",
			});
		}
	});

	it("rejects a legacy project carrying a retired ceiling-hosted item without silently dropping it", async () => {
		const source = {
			...project(),
			assetInstances: [
				...project().assetInstances,
				{
					anchorClass: "ceiling",
					assetInstanceId: "asset-light",
					color: "#f3d57a",
					depthMm: 300,
					dropMm: 450,
					heightMm: 240,
					label: "Потолочный светильник",
					roomId: "room-main",
					widthMm: 300,
					xMm: 1800,
					yawStep: 0,
					zMm: 1200,
				},
			],
		} as unknown as Project;
		const serialized = await encodeLocalProjectJson(source, checksum);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it("does not reinterpret a retired ceiling host as a wall host", async () => {
		const source = {
			...project(),
			assetInstances: [
				{
					anchorClass: "ceiling",
					assetInstanceId: "asset-retired-light",
					color: "#f3d57a",
					depthMm: 300,
					dropMm: 450,
					elevationMm: 0,
					heightMm: 240,
					label: "Retired ceiling light",
					offsetMm: 0,
					roomId: "room-main",
					side: "left",
					wallSegmentId: "wall-bottom",
					widthMm: 300,
					xMm: 1800,
					yawStep: 0,
					zMm: 1200,
				},
			],
		} as unknown as Project;
		const serialized = await encodeLocalProjectJson(source, checksum);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it.each([
		[
			"unknown envelope member",
			(serialized: string) =>
				serialized.replace(
					'"projectChecksum"',
					'"unknown":true,"projectChecksum"',
				),
		],
		[
			"pretty-printed document",
			(serialized: string) =>
				JSON.stringify(JSON.parse(serialized), undefined, 2),
		],
		[
			"non-canonical geometry number",
			(serialized: string) => serialized.replace('"xMm":1800', '"xMm":1.8e3'),
		],
		[
			"duplicate coordinate",
			(serialized: string) =>
				serialized.replace('"xMm":4000,"zMm":0', '"xMm":0,"zMm":0'),
		],
		[
			"unknown item property",
			(serialized: string) =>
				serialized.replace(
					'"assetInstanceId":"asset-table"',
					'"assetInstanceId":"asset-table","debug":true',
				),
		],
	])("rejects %s before it can become a Project", async (_case, modify) => {
		const serialized = await encodeLocalProjectJson(project(), checksum);

		await expect(
			decodeLocalProjectJson(utf8Bytes(modify(serialized)), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_INVALID",
		});
	});

	it("rejects a canonical document whose integrity checksum does not match", async () => {
		const serialized = await encodeLocalProjectJson(project(), checksum);
		const tampered = serialized.replace(
			'"projectChecksum":"checksum:',
			'"projectChecksum":"tampered:',
		);

		await expect(
			decodeLocalProjectJson(utf8Bytes(tampered), checksum),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_JSON_CHECKSUM_MISMATCH",
		});
	});

	it("keeps a blank project transferable so a user can hand off work before closing a room", async () => {
		const blank: Project = {
			...project(),
			assetInstances: [],
			level: {
				levelId: "empty-level",
				openings: [],
				rooms: [],
				vertices: [],
				wallSegments: [],
			},
		};
		const serialized = await encodeLocalProjectJson(blank, checksum);

		await expect(
			decodeLocalProjectJson(utf8Bytes(serialized), checksum),
		).resolves.toEqual({
			kind: "accepted",
			project: blank,
		});
	});
});
