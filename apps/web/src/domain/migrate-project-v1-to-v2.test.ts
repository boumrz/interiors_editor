import { describe, expect, it } from "@rstest/core";

import { migrateProjectV1ToV2 } from "./migrate-project-v1-to-v2";
import { isFloorSchematicAssetInstance, type Project } from "./project";

function valueAt<T>(values: readonly T[], index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error(`Expected a value at index ${index}`);
	}
	return value;
}

function partitionedProject(): Project {
	return {
		assetDefinitionRefs: [],
		assetInstances: [
			{
				anchorClass: "floor",
				assetInstanceId: "item-table",
				color: "#8b5a2b",
				depthMm: 800,
				heightMm: 750,
				label: "Стол",
				roomId: "room-left",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1500,
			},
		],
		createdAt: "2026-08-06T09:10:00.000Z",
		level: {
			levelId: "level-1",
			openings: [],
			rooms: [
				{
					faceFingerprint: "grid:0:2000:0:3000:100",
					heightMm: 2600,
					roomId: "room-left",
				},
				{
					faceFingerprint: "grid:2000:4000:0:3000:100",
					heightMm: 2800,
					roomId: "room-right",
				},
			],
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 2000, zMm: 0 },
				{ vertexId: "c", xMm: 4000, zMm: 0 },
				{ vertexId: "d", xMm: 4000, zMm: 3000 },
				{ vertexId: "e", xMm: 2000, zMm: 3000 },
				{ vertexId: "f", xMm: 0, zMm: 3000 },
			],
			wallSegments: [
				{
					endVertexId: "a",
					startVertexId: "f",
					thicknessMm: 100,
					wallSegmentId: "wall-left",
				},
				{
					endVertexId: "b",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "wall-bottom-left",
				},
				{
					endVertexId: "c",
					startVertexId: "b",
					thicknessMm: 100,
					wallSegmentId: "wall-bottom-right",
				},
				{
					endVertexId: "d",
					startVertexId: "c",
					thicknessMm: 100,
					wallSegmentId: "wall-right",
				},
				{
					endVertexId: "e",
					startVertexId: "d",
					thicknessMm: 100,
					wallSegmentId: "wall-top-right",
				},
				{
					endVertexId: "f",
					startVertexId: "e",
					thicknessMm: 100,
					wallSegmentId: "wall-top-left",
				},
				{
					endVertexId: "e",
					startVertexId: "b",
					thicknessMm: 100,
					wallSegmentId: "wall-divider",
				},
			],
		},
		lifecycle: "active",
		name: "План",
		projectId: "project-1",
		schemaVersion: 1,
		updatedAt: "2026-08-06T09:11:00.000Z",
	};
}

function rectangleProject(
	faceFingerprint = "rectangular:4000:3000:100",
): Project {
	return {
		assetDefinitionRefs: [],
		assetInstances: [],
		createdAt: "2026-08-06T09:10:00.000Z",
		level: {
			levelId: "level-1",
			openings: [],
			rooms: [{ faceFingerprint, heightMm: 2600, roomId: "room-1" }],
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 4000, zMm: 0 },
				{ vertexId: "c", xMm: 4000, zMm: 3000 },
				{ vertexId: "d", xMm: 0, zMm: 3000 },
			],
			wallSegments: [
				{
					endVertexId: "b",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "wall-bottom",
				},
				{
					endVertexId: "c",
					startVertexId: "b",
					thicknessMm: 100,
					wallSegmentId: "wall-right",
				},
				{
					endVertexId: "d",
					startVertexId: "c",
					thicknessMm: 100,
					wallSegmentId: "wall-top",
				},
				{
					endVertexId: "a",
					startVertexId: "d",
					thicknessMm: 100,
					wallSegmentId: "wall-left",
				},
			],
		},
		lifecycle: "active",
		name: "Комната",
		projectId: "project-1",
		schemaVersion: 1,
		updatedAt: "2026-08-06T09:11:00.000Z",
	};
}

function emptyProject(): Project {
	return {
		assetDefinitionRefs: [],
		assetInstances: [],
		createdAt: "2026-08-06T09:10:00.000Z",
		level: {
			levelId: "level-1",
			openings: [],
			rooms: [],
			vertices: [],
			wallSegments: [],
		},
		lifecycle: "active",
		name: "Пустой",
		projectId: "project-empty",
		schemaVersion: 1,
		updatedAt: "2026-08-06T09:10:00.000Z",
	};
}

describe("migrateProjectV1ToV2", () => {
	it("preserves canonical geometry and item host only when every legacy room matches exactly one derived face", () => {
		const source = partitionedProject();

		expect(migrateProjectV1ToV2(source)).toEqual({
			kind: "accepted",
			project: {
				assetDefinitionRefs: [],
				assetInstances: [
					{
						anchorClass: "floor",
						assetInstanceId: "item-table",
						color: "#8b5a2b",
						depthMm: 800,
						heightMm: 750,
						label: "Стол",
						roomId: "room-left",
						widthMm: 1200,
						xMm: 1000,
						zMm: 1500,
					},
				],
				createdAt: "2026-08-06T09:10:00.000Z",
				level: {
					levelId: "level-1",
					openings: [],
					roomMetadata: [
						{
							faceFingerprint: "orthogonal-face:0:0|0:3000|2000:3000|2000:0",
							heightMm: 2600,
							roomId: "room-left",
						},
						{
							faceFingerprint:
								"orthogonal-face:2000:0|2000:3000|4000:3000|4000:0",
							heightMm: 2800,
							roomId: "room-right",
						},
					],
					vertices: source.level.vertices,
					wallSegments: source.level.wallSegments,
				},
				lifecycle: "active",
				name: "План",
				projectId: "project-1",
				schemaVersion: 2,
				updatedAt: "2026-08-06T09:11:00.000Z",
			},
		});
		expect(source.level.rooms.map((room) => room.faceFingerprint)).toEqual([
			"grid:0:2000:0:3000:100",
			"grid:2000:4000:0:3000:100",
		]);
	});

	it.each([
		["rectangular starter", "rectangular:4000:3000:100"],
		["detached loop", "loop:0:4000:0:3000:100"],
	])(
		"replaces the %s descriptor with the derived face fingerprint",
		(_description, faceFingerprint) => {
			const result = migrateProjectV1ToV2(rectangleProject(faceFingerprint));

			expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
			if (result.kind !== "accepted") {
				throw new Error("Expected legacy rectangle to migrate");
			}
			expect(result.project.level.roomMetadata).toEqual([
				{
					faceFingerprint: "orthogonal-face:0:0|0:3000|4000:3000|4000:0",
					heightMm: 2600,
					roomId: "room-1",
				},
			]);
			expect(result.project.schemaVersion).toBe(2);
		},
	);

	it("migrates an empty v1 plan without inventing a Room or Face", () => {
		const result = migrateProjectV1ToV2(emptyProject());

		expect(result).toEqual({
			kind: "accepted",
			project: {
				assetDefinitionRefs: [],
				assetInstances: [],
				createdAt: "2026-08-06T09:10:00.000Z",
				level: {
					levelId: "level-1",
					openings: [],
					roomMetadata: [],
					vertices: [],
					wallSegments: [],
				},
				lifecycle: "active",
				name: "Пустой",
				projectId: "project-empty",
				schemaVersion: 2,
				updatedAt: "2026-08-06T09:10:00.000Z",
			},
		});
	});

	it("recognizes historical partition descriptors through the same derived-face reconciliation", () => {
		const source = partitionedProject();
		const historicalPartition: Project = {
			...source,
			level: {
				...source.level,
				rooms: [
					{
						...valueAt(source.level.rooms, 0),
						faceFingerprint: "partition:vertical:left:4000:3000:2000:100",
					},
					{
						...valueAt(source.level.rooms, 1),
						faceFingerprint: "partition:vertical:right:4000:3000:2000:100",
					},
				],
			},
		};

		const result = migrateProjectV1ToV2(historicalPartition);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			throw new Error("Expected historical partition descriptors to migrate");
		}
		expect(
			result.project.level.roomMetadata.map((room) => room.roomId),
		).toEqual(["room-left", "room-right"]);
	});

	it("rejects a legacy descriptor that cannot map one-to-one to a derived Face without changing v1", () => {
		const source = partitionedProject();
		const corrupted: Project = {
			...source,
			level: {
				...source.level,
				rooms: [
					valueAt(source.level.rooms, 0),
					{
						...valueAt(source.level.rooms, 1),
						faceFingerprint: "grid:2000:4000:0:3001:100",
					},
				],
			},
		};
		const before = JSON.stringify(corrupted);

		expect(migrateProjectV1ToV2(corrupted)).toEqual({
			kind: "rejected",
			reasonCode: "ROOM_FACE_RECONCILIATION_AMBIGUOUS",
		});
		expect(JSON.stringify(corrupted)).toBe(before);
	});

	it("rejects multiple Room metadata records for one derived Face", () => {
		const source = partitionedProject();
		const duplicateMapping: Project = {
			...source,
			level: {
				...source.level,
				rooms: [
					valueAt(source.level.rooms, 0),
					{ ...valueAt(source.level.rooms, 0), roomId: "room-duplicate" },
				],
			},
		};

		expect(migrateProjectV1ToV2(duplicateMapping)).toEqual({
			kind: "rejected",
			reasonCode: "ROOM_FACE_RECONCILIATION_AMBIGUOUS",
		});
	});

	it("rejects a descriptor whose claimed wall thickness differs from the canonical boundary", () => {
		const source = rectangleProject("loop:0:4000:0:3000:101");

		expect(migrateProjectV1ToV2(source)).toEqual({
			kind: "rejected",
			reasonCode: "ROOM_FACE_RECONCILIATION_AMBIGUOUS",
		});
	});

	it("rejects an item that cannot retain its current room host instead of silently rehosting it", () => {
		const source = partitionedProject();
		const item = valueAt(source.assetInstances, 0);
		if (!isFloorSchematicAssetInstance(item))
			throw new Error("Expected a floor item");
		const invalidHost: Project = {
			...source,
			assetInstances: [{ ...item, xMm: 1700 }],
		};

		expect(migrateProjectV1ToV2(invalidHost)).toEqual({
			kind: "rejected",
			reasonCode: "ITEM_HOST_UNRESOLVABLE",
		});
	});

	it("rejects an item whose retained host ID is absent even when its world position fits another Face", () => {
		const source = partitionedProject();
		const item = valueAt(source.assetInstances, 0);
		if (!isFloorSchematicAssetInstance(item))
			throw new Error("Expected a floor item");
		const missingHost: Project = {
			...source,
			assetInstances: [{ ...item, roomId: "room-missing", xMm: 3000 }],
		};

		expect(migrateProjectV1ToV2(missingHost)).toEqual({
			kind: "rejected",
			reasonCode: "ITEM_HOST_UNRESOLVABLE",
		});
	});

	it("keeps a floor item when its footprint is exactly flush with the finished inner wall boundary", () => {
		const source = partitionedProject();
		const item = valueAt(source.assetInstances, 0);
		if (!isFloorSchematicAssetInstance(item))
			throw new Error("Expected a floor item");
		const flushHost: Project = {
			...source,
			assetInstances: [
				{ ...item, depthMm: 800, widthMm: 800, xMm: 1550, zMm: 1500 },
			],
		};

		const result = migrateProjectV1ToV2(flushHost);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			throw new Error("Expected the exact host boundary to remain valid");
		}
		expect(result.project.assetInstances[0]).toEqual(
			expect.objectContaining({ roomId: "room-left", xMm: 1550 }),
		);
	});

	it("propagates a rejected derived-face result rather than accepting non-orthogonal v1 geometry", () => {
		const source = rectangleProject();
		const nonOrthogonal: Project = {
			...source,
			level: {
				...source.level,
				wallSegments: source.level.wallSegments.map((wall) =>
					wall.wallSegmentId === "wall-bottom"
						? { ...wall, endVertexId: "c" }
						: wall,
				),
			},
		};

		expect(migrateProjectV1ToV2(nonOrthogonal)).toEqual({
			kind: "rejected",
			reasonCode: "NON_ORTHOGONAL_WALL",
		});
	});
});
