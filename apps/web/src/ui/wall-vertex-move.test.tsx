import { describe, expect, it } from "@rstest/core";
import type { Vertex, WallSegment } from "../domain/project";
import {
	isWallMoveGestureSupported,
	pointForWallVertexMove,
	wallVertexMoveAxisFor,
} from "./wall-vertex-move";

const vertices: readonly Vertex[] = [
	{ vertexId: "east", xMm: 4000, zMm: 2000 },
	{ vertexId: "corner", xMm: 2000, zMm: 2000 },
	{ vertexId: "south", xMm: 2000, zMm: 4000 },
];

const walls: readonly WallSegment[] = [
	{
		endVertexId: "corner",
		startVertexId: "east",
		thicknessMm: 100,
		wallSegmentId: "wall-east",
	},
	{
		endVertexId: "south",
		startVertexId: "corner",
		thicknessMm: 100,
		wallSegmentId: "wall-south",
	},
];

describe("closed-room vertex movement projection", () => {
	it("exposes the shared 45-degree line for an equal-leg cardinal corner", () => {
		const axis = wallVertexMoveAxisFor("corner", walls, vertices);

		expect(axis).toEqual({
			anchor: { vertexId: "east", xMm: 4000, zMm: 2000 },
			kind: "diagonal-falling",
		});
	});

	it("snaps a touch candidate to the origin-relative 100 mm grid on that line", () => {
		const axis = wallVertexMoveAxisFor("corner", walls, vertices);
		if (!axis) throw new Error("Expected a movable corner");

		expect(
			pointForWallVertexMove(
				axis,
				{ xMm: 3030, zMm: 2960 },
				{ xMm: 2000, zMm: 2000 },
			),
		).toEqual({ xMm: 3000, zMm: 3000 });
	});

	it("keeps the 100 mm grid relative to an off-grid original vertex", () => {
		expect(
			pointForWallVertexMove(
				{ kind: "horizontal" },
				{ xMm: 186, zMm: 999 },
				{ xMm: 37, zMm: 100 },
			),
		).toEqual({ xMm: 137, zMm: 100 });
		expect(
			pointForWallVertexMove(
				{ kind: "horizontal" },
				{ xMm: 188, zMm: 999 },
				{ xMm: 37, zMm: 100 },
			),
		).toEqual({ xMm: 237, zMm: 100 });
		expect(
			pointForWallVertexMove(
				{ kind: "vertical" },
				{ xMm: 999, zMm: 451 },
				{ xMm: 73, zMm: 202 },
			),
		).toEqual({ xMm: 73, zMm: 402 });
	});

	it("keeps an unequal cardinal corner unavailable instead of approximating it", () => {
		const unequalVertices: readonly Vertex[] = vertices.map((vertex) =>
			vertex.vertexId === "east" ? { ...vertex, xMm: 5000 } : vertex,
		);

		expect(
			wallVertexMoveAxisFor("corner", walls, unequalVertices),
		).toBeUndefined();
	});

	it("projects the mirrored equal-leg corner on its rising 45-degree line", () => {
		const mirroredVertices: readonly Vertex[] = vertices.map((vertex) =>
			vertex.vertexId === "south" ? { ...vertex, zMm: 0 } : vertex,
		);
		const axis = wallVertexMoveAxisFor("corner", walls, mirroredVertices);

		expect(axis).toEqual({
			anchor: { vertexId: "east", xMm: 4000, zMm: 2000 },
			kind: "diagonal-rising",
		});
		if (!axis) throw new Error("Expected a mirrored movable corner");
		expect(
			pointForWallVertexMove(
				axis,
				{ xMm: 3020, zMm: 980 },
				{ xMm: 2000, zMm: 2000 },
			),
		).toEqual({ xMm: 3000, zMm: 1000 });
	});

	it("keeps a degree-three junction unavailable even when two arms have equal legs", () => {
		const junctionVertices: readonly Vertex[] = [
			...vertices,
			{ vertexId: "west", xMm: 0, zMm: 2000 },
		];
		const junctionWalls: readonly WallSegment[] = [
			...walls,
			{
				endVertexId: "corner",
				startVertexId: "west",
				thicknessMm: 100,
				wallSegmentId: "wall-west",
			},
		];

		expect(
			wallVertexMoveAxisFor("corner", junctionWalls, junctionVertices),
		).toBeUndefined();
	});

	it("does not reinterpret a mixed horizontal and diagonal corner as a shared axis", () => {
		const mixedVertices: readonly Vertex[] = [
			{ vertexId: "corner", xMm: 0, zMm: 0 },
			{ vertexId: "horizontal", xMm: 2000, zMm: 0 },
			{ vertexId: "diagonal", xMm: 1000, zMm: 1000 },
		];
		const mixedWalls: readonly WallSegment[] = [
			{
				endVertexId: "horizontal",
				startVertexId: "corner",
				thicknessMm: 100,
				wallSegmentId: "horizontal-wall",
			},
			{
				endVertexId: "diagonal",
				startVertexId: "corner",
				thicknessMm: 100,
				wallSegmentId: "diagonal-wall",
			},
		];

		expect(
			wallVertexMoveAxisFor("corner", mixedWalls, mixedVertices),
		).toBeUndefined();
	});
});

describe("whole-wall gesture availability", () => {
	it("allows a cardinal wall with only a perpendicular neighbour", () => {
		expect(isWallMoveGestureSupported("wall-east", walls, vertices)).toBe(true);
		expect(isWallMoveGestureSupported("missing", walls, vertices)).toBe(false);
	});

	it("hides the gesture when a cardinal endpoint has a collinear continuation", () => {
		const continuedVertices: readonly Vertex[] = [
			...vertices,
			{ vertexId: "west", xMm: 0, zMm: 2000 },
		];
		const continuedWalls: readonly WallSegment[] = [
			...walls,
			{
				endVertexId: "corner",
				startVertexId: "west",
				thicknessMm: 100,
				wallSegmentId: "wall-west",
			},
		];

		expect(
			isWallMoveGestureSupported(
				"wall-east",
				continuedWalls,
				continuedVertices,
			),
		).toBe(false);
	});

	it("allows only a detached 45-degree wall", () => {
		const diagonalVertices: readonly Vertex[] = [
			{ vertexId: "a", xMm: 500, zMm: 200 },
			{ vertexId: "b", xMm: 1500, zMm: 1200 },
			{ vertexId: "c", xMm: 2500, zMm: 1200 },
			{ vertexId: "d", xMm: 4000, zMm: 5000 },
			{ vertexId: "e", xMm: 5000, zMm: 5000 },
		];
		const diagonal: WallSegment = {
			endVertexId: "b",
			startVertexId: "a",
			thicknessMm: 100,
			wallSegmentId: "diagonal",
		};

		const unrelated: WallSegment = {
			endVertexId: "e",
			startVertexId: "d",
			thicknessMm: 100,
			wallSegmentId: "unrelated",
		};

		expect(
			isWallMoveGestureSupported(
				"diagonal",
				[diagonal, unrelated],
				diagonalVertices,
			),
		).toBe(true);
		expect(
			isWallMoveGestureSupported(
				"diagonal",
				[
					diagonal,
					{
						endVertexId: "c",
						startVertexId: "b",
						thicknessMm: 100,
						wallSegmentId: "attached",
					},
				],
				diagonalVertices,
			),
		).toBe(false);
	});

	it("rejects a missing, incomplete, zero-length or arbitrary-angle Wall", () => {
		const fixtureVertices: readonly Vertex[] = [
			{ vertexId: "a", xMm: 500, zMm: 200 },
			{ vertexId: "b", xMm: 500, zMm: 200 },
			{ vertexId: "c", xMm: 1700, zMm: 900 },
		];
		const zero: WallSegment = {
			endVertexId: "b",
			startVertexId: "a",
			thicknessMm: 100,
			wallSegmentId: "zero",
		};
		const arbitrary: WallSegment = {
			...zero,
			endVertexId: "c",
			wallSegmentId: "arbitrary",
		};

		expect(
			isWallMoveGestureSupported("missing", [zero], fixtureVertices),
		).toBe(false);
		expect(isWallMoveGestureSupported("zero", [zero], fixtureVertices)).toBe(
			false,
		);
		expect(
			isWallMoveGestureSupported("arbitrary", [arbitrary], fixtureVertices),
		).toBe(false);
		expect(
			isWallMoveGestureSupported(
				"arbitrary",
				[arbitrary],
				fixtureVertices.slice(0, 1),
			),
		).toBe(false);
	});

	it("rejects a vertical Wall with a collinear neighbour in either host direction", () => {
		const verticalVertices: readonly Vertex[] = [
			{ vertexId: "a", xMm: 300, zMm: 200 },
			{ vertexId: "b", xMm: 300, zMm: 1200 },
			{ vertexId: "c", xMm: 300, zMm: 2000 },
		];
		const selected: WallSegment = {
			endVertexId: "b",
			startVertexId: "a",
			thicknessMm: 100,
			wallSegmentId: "vertical",
		};

		for (const neighbour of [
			{
				endVertexId: "c",
				startVertexId: "b",
				thicknessMm: 100,
				wallSegmentId: "forward",
			},
			{
				endVertexId: "b",
				startVertexId: "c",
				thicknessMm: 100,
				wallSegmentId: "reversed",
			},
		] satisfies readonly WallSegment[]) {
			expect(
				isWallMoveGestureSupported(
					"vertical",
					[selected, neighbour],
					verticalVertices,
				),
			).toBe(false);
		}
	});

	it("allows a detached vertical Wall and ignores unrelated complete Walls", () => {
		const fixtureVertices: readonly Vertex[] = [
			{ vertexId: "a", xMm: 300, zMm: 200 },
			{ vertexId: "b", xMm: 300, zMm: 1200 },
			{ vertexId: "c", xMm: 2000, zMm: 2400 },
			{ vertexId: "d", xMm: 2600, zMm: 2400 },
		];
		const selected: WallSegment = {
			endVertexId: "b",
			startVertexId: "a",
			thicknessMm: 100,
			wallSegmentId: "vertical",
		};
		const unrelated: WallSegment = {
			endVertexId: "d",
			startVertexId: "c",
			thicknessMm: 100,
			wallSegmentId: "unrelated",
		};

		expect(
			isWallMoveGestureSupported(
				"vertical",
				[selected, unrelated],
				fixtureVertices,
			),
		).toBe(true);
	});

	it("keeps a reversed perpendicular neighbour supported and fails closed on a missing neighbour vertex", () => {
		const fixtureVertices: readonly Vertex[] = [
			{ vertexId: "a", xMm: 300, zMm: 200 },
			{ vertexId: "b", xMm: 300, zMm: 1200 },
			{ vertexId: "c", xMm: 1000, zMm: 1200 },
		];
		const selected: WallSegment = {
			endVertexId: "b",
			startVertexId: "a",
			thicknessMm: 100,
			wallSegmentId: "vertical",
		};
		const reversedPerpendicular: WallSegment = {
			endVertexId: "b",
			startVertexId: "c",
			thicknessMm: 100,
			wallSegmentId: "perpendicular",
		};
		const missingNeighbour: WallSegment = {
			...reversedPerpendicular,
			startVertexId: "missing",
			wallSegmentId: "missing-neighbour",
		};

		expect(
			isWallMoveGestureSupported(
				"vertical",
				[selected, reversedPerpendicular],
				fixtureVertices,
			),
		).toBe(true);
		expect(
			isWallMoveGestureSupported(
				"vertical",
				[selected, missingNeighbour],
				fixtureVertices,
			),
		).toBe(false);
	});
});
