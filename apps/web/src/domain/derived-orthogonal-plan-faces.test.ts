import { describe, expect, it } from "@rstest/core";

import { addConstrainedPartition } from "./constrained-partition";
import {
	type DerivedOrthogonalPlanFaces,
	resolveOrthogonalPlanFaces,
} from "./derived-orthogonal-plan-faces";
import { exactMeasurement, isExactMeasurement } from "./exact-quadratic-surd";
import { addGeneralWallToProject } from "./general-wall-project";
import { createInitialProject } from "./initial-project";
import type { Project } from "./project";
import { configureRectangularRoom } from "./rectangular-room";
import { createRectangularRoomLoop } from "./rectangular-room-loop";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function starterProject(): Project {
	const result = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-06T09:10:00.000Z",
			levelId: "level-1",
			name: "План квартиры",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids(
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
		),
		"2026-08-06T09:11:00.000Z",
	);
	if (result.kind !== "accepted") {
		throw new Error("Expected a starter room");
	}
	return result.project;
}

function diagonalTriangleProject(): Project {
	const source = createInitialProject({
		createdAt: "2026-08-23T13:00:00.000Z",
		levelId: "level-1",
		name: "Диагональная комната",
		projectId: "project-triangle",
	});
	return {
		...source,
		level: {
			...source.level,
			rooms: [
				{
					faceFingerprint: "orthogonal-face:0:0|2000:0|2000:2000",
					heightMm: 2600,
					roomId: "room-triangle",
				},
			],
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 2000, zMm: 0 },
				{ vertexId: "c", xMm: 2000, zMm: 2000 },
			],
			wallSegments: [
				{
					endVertexId: "b",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "bottom",
				},
				{
					endVertexId: "c",
					startVertexId: "b",
					thicknessMm: 100,
					wallSegmentId: "right",
				},
				{
					endVertexId: "a",
					startVertexId: "c",
					thicknessMm: 100,
					wallSegmentId: "diagonal",
				},
			],
		},
	};
}

function diagonalTrapezoidProject(): Project {
	const source = createInitialProject({
		createdAt: "2026-08-24T22:30:00.000Z",
		levelId: "level-1",
		name: "Диагональная трапеция",
		projectId: "project-trapezoid",
	});
	return {
		...source,
		level: {
			...source.level,
			rooms: [
				{
					faceFingerprint:
						"orthogonal-face:0:0|2000:2000|5000:2000|5000:0",
					heightMm: 2600,
					roomId: "room-trapezoid",
				},
			],
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 5000, zMm: 0 },
				{ vertexId: "c", xMm: 5000, zMm: 2000 },
				{ vertexId: "d", xMm: 2000, zMm: 2000 },
			],
			wallSegments: [
				{
					endVertexId: "b",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "bottom",
				},
				{
					endVertexId: "c",
					startVertexId: "b",
					thicknessMm: 100,
					wallSegmentId: "right",
				},
				{
					endVertexId: "d",
					startVertexId: "c",
					thicknessMm: 100,
					wallSegmentId: "top",
				},
				{
					endVertexId: "a",
					startVertexId: "d",
					thicknessMm: 100,
					wallSegmentId: "diagonal",
				},
			],
		},
	};
}

function concaveLProject(): Project {
	const source = createInitialProject({
		createdAt: "2026-08-28T06:00:00.000Z",
		levelId: "level-1",
		name: "Вогнутая комната",
		projectId: "project-concave-l",
	});
	return {
		...source,
		level: {
			...source.level,
			rooms: [
				{
					faceFingerprint:
						"orthogonal-face:0:0|0:4000|1000:4000|1000:1000|4000:1000|4000:0",
					heightMm: 2600,
					roomId: "room-concave-l",
				},
			],
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 4000, zMm: 0 },
				{ vertexId: "c", xMm: 4000, zMm: 1000 },
				{ vertexId: "d", xMm: 1000, zMm: 1000 },
				{ vertexId: "e", xMm: 1000, zMm: 4000 },
				{ vertexId: "f", xMm: 0, zMm: 4000 },
			],
			wallSegments: [
				{
					endVertexId: "b",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "bottom",
				},
				{
					endVertexId: "c",
					startVertexId: "b",
					thicknessMm: 100,
					wallSegmentId: "right-lower",
				},
				{
					endVertexId: "d",
					startVertexId: "c",
					thicknessMm: 100,
					wallSegmentId: "notch-bottom",
				},
				{
					endVertexId: "e",
					startVertexId: "d",
					thicknessMm: 100,
					wallSegmentId: "notch-left",
				},
				{
					endVertexId: "f",
					startVertexId: "e",
					thicknessMm: 100,
					wallSegmentId: "top-left",
				},
				{
					endVertexId: "a",
					startVertexId: "f",
					thicknessMm: 100,
					wallSegmentId: "left",
				},
			],
		},
	};
}

function mixedDirectionConcaveProject(): Project {
	const source = createInitialProject({
		createdAt: "2026-08-28T08:30:00.000Z",
		levelId: "level-1",
		name: "Вогнутая диагональная комната",
		projectId: "project-mixed-concave",
	});
	return {
		...source,
		level: {
			...source.level,
			rooms: [
				{
					faceFingerprint:
						"orthogonal-face:0:0|0:1000|2000:3000|2000:5000|5000:5000|5000:0",
					heightMm: 2600,
					roomId: "room-mixed-concave",
				},
			],
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 5000, zMm: 0 },
				{ vertexId: "c", xMm: 5000, zMm: 5000 },
				{ vertexId: "d", xMm: 2000, zMm: 5000 },
				{ vertexId: "e", xMm: 2000, zMm: 3000 },
				{ vertexId: "f", xMm: 0, zMm: 1000 },
			],
			wallSegments: [
				{ endVertexId: "b", startVertexId: "a", thicknessMm: 100, wallSegmentId: "bottom" },
				{ endVertexId: "c", startVertexId: "b", thicknessMm: 100, wallSegmentId: "right" },
				{ endVertexId: "d", startVertexId: "c", thicknessMm: 100, wallSegmentId: "top" },
				{ endVertexId: "e", startVertexId: "d", thicknessMm: 100, wallSegmentId: "notch" },
				{ endVertexId: "f", startVertexId: "e", thicknessMm: 100, wallSegmentId: "diagonal" },
				{ endVertexId: "a", startVertexId: "f", thicknessMm: 100, wallSegmentId: "left" },
			],
		},
	};
}

function acceptedPlan(
	result: ReturnType<typeof resolveOrthogonalPlanFaces>,
): DerivedOrthogonalPlanFaces {
	if (result.kind !== "accepted") {
		throw new Error(`Expected a resolved plan, got ${result.reasonCode}`);
	}
	return result.plan;
}

describe("resolveOrthogonalPlanFaces", () => {
	it("reports an empty v1 plan without inventing a room or a bounding envelope", () => {
		expect(
			resolveOrthogonalPlanFaces(
				createInitialProject({
					createdAt: "2026-08-06T09:10:00.000Z",
					levelId: "level-1",
					name: "Пустой план",
					projectId: "project-empty",
				}),
			),
		).toEqual({ kind: "rejected", reasonCode: "EMPTY_PLAN" });
	});

	it("resolves the legacy rectangular starter from concrete walls, with no fingerprint geometry source", () => {
		const plan = acceptedPlan(resolveOrthogonalPlanFaces(starterProject()));

		expect(plan).toEqual({
			rooms: [
				{
					boundaryWallSegmentIds: ["wall-1", "wall-2", "wall-3", "wall-4"],
					faceTilesMm: [{ maxXmm: 4100, maxZmm: 3100, minXmm: 0, minZmm: 0 }],
					heightMm: 2600,
					roomId: "room-1",
					usableFloorAreaMm2: exactMeasurement(12_000_000n),
					usableFloorPerimeterMm: exactMeasurement(14_000n),
					usableFloorTilesMm: [
						{ maxXmm: 4050, maxZmm: 3050, minXmm: 50, minZmm: 50 },
					],
				},
			],
			walls: [
				{
					exteriorNormal: { x: 0, z: -1 },
					heightMm: 2600,
					wallSegmentId: "wall-1",
				},
				{
					exteriorNormal: { x: 1, z: 0 },
					heightMm: 2600,
					wallSegmentId: "wall-2",
				},
				{
					exteriorNormal: { x: 0, z: 1 },
					heightMm: 2600,
					wallSegmentId: "wall-3",
				},
				{
					exteriorNormal: { x: -1, z: 0 },
					heightMm: 2600,
					wallSegmentId: "wall-4",
				},
			],
		});
	});

	it("projects a durable closed 45-degree triangle as its exact face and usable floor polygon", () => {
		const plan = acceptedPlan(
			resolveOrthogonalPlanFaces(diagonalTriangleProject()),
		);

		expect(plan.rooms).toEqual([
			expect.objectContaining({
				boundaryWallSegmentIds: ["bottom", "diagonal", "right"],
				facePolygonMm: [
					{ xMm: 0, zMm: 0 },
					{ xMm: 2000, zMm: 0 },
					{ xMm: 2000, zMm: 2000 },
				],
				faceTilesMm: [],
				heightMm: 2600,
				roomId: "room-triangle",
				usableFloorTilesMm: [],
			}),
		]);
		const usable = plan.rooms[0]?.usableFloorPolygonMm;
		expect(usable).toHaveLength(3);
		expect(usable?.[0]?.xMm).toBeCloseTo(50 * Math.SQRT2 + 50, 8);
		expect(usable?.[0]?.zMm).toBeCloseTo(50, 8);
		expect(usable?.[1]?.xMm).toBeCloseTo(1950, 8);
		expect(usable?.[1]?.zMm).toBeCloseTo(50, 8);
		expect(usable?.[2]?.xMm).toBeCloseTo(1950, 8);
		expect(usable?.[2]?.zMm).toBeCloseTo(1950 - 50 * Math.SQRT2, 8);
		expect(plan.rooms[0]?.usableFloorAreaMm2).toEqual(
			exactMeasurement(1_807_500n, -95_000n),
		);
		expect(plan.rooms[0]?.usableFloorPerimeterMm).toEqual(
			exactMeasurement(3_700n, 1_800n),
		);
		expect(plan.walls).toEqual([
			{
				exteriorNormal: { x: 0, z: -1 },
				heightMm: 2600,
				wallSegmentId: "bottom",
			},
			{
				exteriorNormal: { x: -1, z: 1 },
				heightMm: 2600,
				wallSegmentId: "diagonal",
			},
			{
				exteriorNormal: { x: 1, z: 0 },
				heightMm: 2600,
				wallSegmentId: "right",
			},
		]);
	});

	it("preserves Room identity when a 45-degree boundary is split at a shared Vertex", () => {
		const source = diagonalTriangleProject();
		const plan = acceptedPlan(
			resolveOrthogonalPlanFaces({
				...source,
				level: {
					...source.level,
					vertices: [
						...source.level.vertices,
						{ vertexId: "diagonal-split", xMm: 1000, zMm: 1000 },
					],
					wallSegments: [
						...source.level.wallSegments.filter(
							(wall) => wall.wallSegmentId !== "diagonal",
						),
						{
							endVertexId: "diagonal-split",
							startVertexId: "c",
							thicknessMm: 100,
							wallSegmentId: "diagonal-upper",
						},
						{
							endVertexId: "a",
							startVertexId: "diagonal-split",
							thicknessMm: 100,
							wallSegmentId: "diagonal-lower",
						},
					],
				},
			}),
		);

		expect(plan.rooms).toEqual([
			expect.objectContaining({
				facePolygonMm: [
					{ xMm: 0, zMm: 0 },
					{ xMm: 2000, zMm: 0 },
					{ xMm: 2000, zMm: 2000 },
				],
				heightMm: 2600,
				roomId: "room-triangle",
			}),
		]);
	});

	it("uses exact half-millimetre miter intersections for unequal odd triangle walls", () => {
		const source = diagonalTriangleProject();
		const project = {
			...source,
			level: {
				...source.level,
				wallSegments: source.level.wallSegments.map((wall) =>
					wall.wallSegmentId === "bottom"
						? { ...wall, thicknessMm: 101 }
						: wall,
				),
			},
		};

		const usable = acceptedPlan(resolveOrthogonalPlanFaces(project)).rooms[0]
			?.usableFloorPolygonMm;
		expect(usable).toHaveLength(3);
		expect(usable?.[0]?.xMm).toBeCloseTo(50 * Math.SQRT2 + 50.5, 8);
		expect(usable?.[0]?.zMm).toBeCloseTo(50.5, 8);
		expect(usable?.[1]?.xMm).toBeCloseTo(1950, 8);
		expect(usable?.[1]?.zMm).toBeCloseTo(50.5, 8);
		expect(usable?.[2]?.xMm).toBeCloseTo(1950, 8);
		expect(usable?.[2]?.zMm).toBeCloseTo(1950 - 50 * Math.SQRT2, 8);
	});

	it("projects a durable closed 45-degree trapezoid as its exact face and usable floor polygon", () => {
		const plan = acceptedPlan(
			resolveOrthogonalPlanFaces(diagonalTrapezoidProject()),
		);

		expect(plan.rooms).toEqual([
			expect.objectContaining({
				boundaryWallSegmentIds: ["bottom", "diagonal", "right", "top"],
				facePolygonMm: [
					{ xMm: 0, zMm: 0 },
					{ xMm: 2000, zMm: 2000 },
					{ xMm: 5000, zMm: 2000 },
					{ xMm: 5000, zMm: 0 },
				],
				faceTilesMm: [],
				heightMm: 2600,
				roomId: "room-trapezoid",
				usableFloorTilesMm: [],
			}),
		]);
		const usable = plan.rooms[0]?.usableFloorPolygonMm;
		expect(usable).toHaveLength(4);
		expect(usable?.[0]?.xMm).toBeCloseTo(50 + 50 * Math.SQRT2, 8);
		expect(usable?.[0]?.zMm).toBeCloseTo(50, 8);
		expect(usable?.[1]?.xMm).toBeCloseTo(2000 + 50 * (Math.SQRT2 - 1), 8);
		expect(usable?.[1]?.zMm).toBeCloseTo(1950, 8);
		expect(usable?.[2]?.xMm).toBeCloseTo(4950, 8);
		expect(usable?.[2]?.zMm).toBeCloseTo(1950, 8);
		expect(usable?.[3]?.xMm).toBeCloseTo(4950, 8);
		expect(usable?.[3]?.zMm).toBeCloseTo(50, 8);
		expect(plan.rooms[0]?.usableFloorAreaMm2).toEqual(
			exactMeasurement(7_505_000n, -95_000n),
		);
		expect(plan.rooms[0]?.usableFloorPerimeterMm).toEqual(
			exactMeasurement(9_800n, 1_800n),
		);
		expect(plan.walls).toEqual(
			expect.arrayContaining([
				{
					exteriorNormal: { x: -1, z: 1 },
					heightMm: 2600,
					wallSegmentId: "diagonal",
				},
			]),
		);
	});

	it("derives usable area and perimeter from the inward-offset concave boundary", () => {
		const room = acceptedPlan(resolveOrthogonalPlanFaces(concaveLProject()))
			.rooms[0];

		expect(room).toEqual(
			expect.objectContaining({
				roomId: "room-concave-l",
				usableFloorAreaMm2: exactMeasurement(6_210_000n),
				usableFloorPerimeterMm: exactMeasurement(15_600n),
			}),
		);
	});

	it("keeps exact usable metrics for a concave face joining cardinal and 45-degree walls", () => {
		const room = acceptedPlan(
			resolveOrthogonalPlanFaces(mixedDirectionConcaveProject()),
		).rooms[0];
		if (!room) throw new Error("Expected a mixed-direction concave room");

		expect(room.usableFloorPolygonMm).toHaveLength(6);
		expect(isExactMeasurement(room.usableFloorAreaMm2)).toBe(true);
		expect(isExactMeasurement(room.usableFloorPerimeterMm)).toBe(true);
	});

	it("fails closed when wall insets collapse a narrow concave recess", () => {
		expect(resolveOrthogonalPlanFaces(thinConcaveProject())).toEqual({
			kind: "rejected",
			reasonCode: "UNSUPPORTED_FACE_SHAPE",
		});
	});

	it("preserves detached loops as separate faces rather than inventing a floor over their empty gap", () => {
		const added = createRectangularRoomLoop(
			starterProject(),
			{ maxXMm: 7100, maxZMm: 6600, minXMm: 5000, minZMm: 5000 },
			ids(
				"v-5",
				"v-6",
				"v-7",
				"v-8",
				"wall-5",
				"wall-6",
				"wall-7",
				"wall-8",
				"room-2",
			),
			"2026-08-06T09:12:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a detached room loop");
		}

		const plan = acceptedPlan(resolveOrthogonalPlanFaces(added.project));

		expect(plan.rooms).toEqual([
			expect.objectContaining({
				faceTilesMm: [{ maxXmm: 4100, maxZmm: 3100, minXmm: 0, minZmm: 0 }],
				roomId: "room-1",
			}),
			expect.objectContaining({
				faceTilesMm: [
					{ maxXmm: 7100, maxZmm: 6600, minXmm: 5000, minZmm: 5000 },
				],
				roomId: "room-2",
			}),
		]);
		expect(plan.rooms.flatMap((room) => room.faceTilesMm)).toHaveLength(2);
		expect(plan.walls).toHaveLength(8);
		expect(plan.walls.every((wall) => wall.exteriorNormal !== undefined)).toBe(
			true,
		);
	});

	it("keeps an explicit detached wall visible without making it a fake room boundary", () => {
		const added = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 6500, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("free-start", "free-end", "free-wall"),
			"2026-08-12T10:03:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected an external wall fixture");
		}

		const plan = acceptedPlan(resolveOrthogonalPlanFaces(added.project));

		expect(plan.rooms).toEqual([expect.objectContaining({ roomId: "room-1" })]);
		expect(plan.walls).toEqual(
			expect.arrayContaining([{ heightMm: 2600, wallSegmentId: "free-wall" }]),
		);
	});

	it("keeps the shared-wall-height-opening-min golden projection at the taller 2700 mm Room height", () => {
		const partitioned = addConstrainedPartition(
			starterProject(),
			{ offsetMm: 2000, orientation: "vertical" },
			ids(
				"vertex-top",
				"vertex-bottom",
				"wall-top-right",
				"wall-bottom-left",
				"wall-divider",
				"room-right",
			),
			"2026-08-06T09:12:00.000Z",
		);
		if (partitioned.kind !== "accepted") {
			throw new Error("Expected a constrained partition");
		}
		const project = {
			...partitioned.project,
			level: {
				...partitioned.project.level,
				rooms: partitioned.project.level.rooms.map((room) => ({
					...room,
					heightMm: room.roomId === "room-right" ? 2700 : 2400,
				})),
			},
		};
		const dividerId = wallAt(project, 2000, 0, 2000, 3100);
		const plan = acceptedPlan(resolveOrthogonalPlanFaces(project));

		expect(plan.rooms).toEqual([
			expect.objectContaining({
				faceTilesMm: [{ maxXmm: 2000, maxZmm: 3100, minXmm: 0, minZmm: 0 }],
				roomId: "room-1",
				usableFloorTilesMm: [
					{ maxXmm: 1950, maxZmm: 3050, minXmm: 50, minZmm: 50 },
				],
			}),
			expect.objectContaining({
				faceTilesMm: [{ maxXmm: 4100, maxZmm: 3100, minXmm: 2000, minZmm: 0 }],
				roomId: "room-right",
				usableFloorTilesMm: [
					{ maxXmm: 4050, maxZmm: 3050, minXmm: 2050, minZmm: 50 },
				],
			}),
		]);
		expect(plan.walls.find((wall) => wall.wallSegmentId === dividerId)).toEqual(
			{
				heightMm: 2700,
				wallSegmentId: dividerId,
			},
		);
		expect(
			plan.walls.filter((wall) => wall.exteriorNormal !== undefined),
		).toHaveLength(6);
	});

	it("resolves every rectangular room face in a normalized T-shaped wall graph, not only a complete grid", () => {
		const vertical = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 2000, zMm: 3100 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"top-contact",
				"bottom-contact",
				"top-tail",
				"bottom-tail",
				"vertical-divider",
				"room-right",
			),
			"2026-08-13T00:10:00.000Z",
		);
		if (vertical.kind !== "accepted") {
			throw new Error("Expected the first divider to split the room");
		}
		const completed = addGeneralWallToProject(
			vertical.project,
			{
				end: { xMm: 4100, zMm: 1500 },
				start: { xMm: 2000, zMm: 1500 },
				thicknessMm: 100,
			},
			ids(
				"right-contact",
				"vertical-tail",
				"right-tail",
				"crossbar",
				"room-top-right",
				"room-bottom-right",
			),
			"2026-08-13T00:11:00.000Z",
		);
		if (completed.kind !== "accepted") {
			throw new Error(
				"Expected the second divider to create two more bounded rooms",
			);
		}

		const plan = acceptedPlan(resolveOrthogonalPlanFaces(completed.project));

		expect(plan.rooms.map((room) => room.roomId)).toEqual([
			"room-1",
			"room-right",
			"room-bottom-right",
		]);
		expect(plan.walls).toHaveLength(
			completed.project.level.wallSegments.length,
		);
	});

	it("is independent of persisted wall order and wall direction", () => {
		const project = starterProject();
		const reversed = {
			...project,
			level: {
				...project.level,
				wallSegments: [...project.level.wallSegments].reverse().map((wall) => ({
					...wall,
					endVertexId: wall.startVertexId,
					startVertexId: wall.endVertexId,
				})),
			},
		};

		expect(resolveOrthogonalPlanFaces(reversed)).toEqual(
			resolveOrthogonalPlanFaces(project),
		);
	});

	it.each([
		[
			"a mismatched legacy fingerprint",
			(project: Project) => ({
				...project,
				level: {
					...project.level,
					rooms: [
						{
							...project.level.rooms[0],
							faceFingerprint: "rectangular:999:3100:100",
						},
					],
				},
			}),
			"ROOM_FACE_RECONCILIATION_FAILED",
		],
		[
			"an unsplit grid wall",
			(project: Project) => {
				const partitioned = addConstrainedPartition(
					project,
					{ offsetMm: 2000, orientation: "vertical" },
					ids(
						"vertex-top",
						"vertex-bottom",
						"wall-top-right",
						"wall-bottom-left",
						"wall-divider",
						"room-right",
					),
					"2026-08-06T09:12:00.000Z",
				);
				if (partitioned.kind !== "accepted") {
					throw new Error("Expected a constrained partition");
				}
				return {
					...partitioned.project,
					level: {
						...partitioned.project.level,
						wallSegments: partitioned.project.level.wallSegments.filter(
							(wall) => wall.wallSegmentId !== "wall-divider",
						),
					},
				};
			},
			"ROOM_FACE_RECONCILIATION_FAILED",
		],
		[
			"a non-rectangular face with mismatched legacy metadata",
			() => nonRectangularProject(),
			"ROOM_FACE_RECONCILIATION_FAILED",
		],
	])(
		"rejects %s instead of falling back to a global envelope",
		(_description, makeProject, reasonCode) => {
			expect(resolveOrthogonalPlanFaces(makeProject(starterProject()))).toEqual(
				{ kind: "rejected", reasonCode },
			);
		},
	);
});

function wallAt(
	project: Project,
	startXmm: number,
	startZmm: number,
	endXmm: number,
	endZmm: number,
): string {
	const vertices = new Map(
		project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const wall = project.level.wallSegments.find((candidate) => {
		const start = vertices.get(candidate.startVertexId);
		const end = vertices.get(candidate.endVertexId);
		return Boolean(
			start &&
				end &&
				((start.xMm === startXmm &&
					start.zMm === startZmm &&
					end.xMm === endXmm &&
					end.zMm === endZmm) ||
					(start.xMm === endXmm &&
						start.zMm === endZmm &&
						end.xMm === startXmm &&
						end.zMm === startZmm)),
		);
	});
	if (!wall) {
		throw new Error("Expected wall");
	}
	return wall.wallSegmentId;
}

function nonRectangularProject(): Project {
	return {
		...starterProject(),
		level: {
			...starterProject().level,
			rooms: [
				{
					faceFingerprint: "loop:0:2000:0:2000:100",
					heightMm: 2600,
					roomId: "room-l",
				},
			],
			vertices: [
				{ vertexId: "v-1", xMm: 0, zMm: 0 },
				{ vertexId: "v-2", xMm: 2000, zMm: 0 },
				{ vertexId: "v-3", xMm: 2000, zMm: 1000 },
				{ vertexId: "v-4", xMm: 1000, zMm: 1000 },
				{ vertexId: "v-5", xMm: 1000, zMm: 2000 },
				{ vertexId: "v-6", xMm: 0, zMm: 2000 },
			],
			wallSegments: [
				{
					endVertexId: "v-2",
					startVertexId: "v-1",
					thicknessMm: 100,
					wallSegmentId: "wall-1",
				},
				{
					endVertexId: "v-3",
					startVertexId: "v-2",
					thicknessMm: 100,
					wallSegmentId: "wall-2",
				},
				{
					endVertexId: "v-4",
					startVertexId: "v-3",
					thicknessMm: 100,
					wallSegmentId: "wall-3",
				},
				{
					endVertexId: "v-5",
					startVertexId: "v-4",
					thicknessMm: 100,
					wallSegmentId: "wall-4",
				},
				{
					endVertexId: "v-6",
					startVertexId: "v-5",
					thicknessMm: 100,
					wallSegmentId: "wall-5",
				},
				{
					endVertexId: "v-1",
					startVertexId: "v-6",
					thicknessMm: 100,
					wallSegmentId: "wall-6",
				},
			],
		},
	};
}

function thinConcaveProject(): Project {
	const vertices = [
		{ vertexId: "thin-1", xMm: 0, zMm: 0 },
		{ vertexId: "thin-2", xMm: 400, zMm: 0 },
		{ vertexId: "thin-3", xMm: 400, zMm: 400 },
		{ vertexId: "thin-4", xMm: 250, zMm: 400 },
		{ vertexId: "thin-5", xMm: 250, zMm: 50 },
		{ vertexId: "thin-6", xMm: 150, zMm: 50 },
		{ vertexId: "thin-7", xMm: 150, zMm: 400 },
		{ vertexId: "thin-8", xMm: 0, zMm: 400 },
	] as const;
	return {
		...starterProject(),
		level: {
			...starterProject().level,
			rooms: [
				{
					faceFingerprint:
						"orthogonal-face:0:0|0:400|150:400|150:50|250:50|250:400|400:400|400:0",
					heightMm: 2600,
					roomId: "room-thin-concave",
				},
			],
			vertices,
			wallSegments: vertices.map((vertex, index) => ({
				endVertexId: vertices[(index + 1) % vertices.length]?.vertexId ?? "",
				startVertexId: vertex.vertexId,
				thicknessMm: 100,
				wallSegmentId: `thin-wall-${index + 1}`,
			})),
		},
	};
}
