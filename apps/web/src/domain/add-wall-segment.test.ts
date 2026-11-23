import { describe, expect, it } from "@rstest/core";

import { addWallSegment } from "./add-wall-segment";
import {
	deriveBoundedOrthogonalFaces,
	type PlanGraph,
} from "./derive-plan-faces";
import { exactMeasurement } from "./exact-quadratic-surd";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function idsThatMustNotAllocate() {
	return {
		next: () => {
			throw new Error("Rejected topology must not allocate an identity");
		},
	};
}

function rectangleGraph(): PlanGraph {
	return {
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
				wallSegmentId: "left",
			},
		],
	};
}

describe("addWallSegment", () => {
	it.each([
		[
			"a non-positive thickness",
			{
				end: { xMm: 1000, zMm: 0 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 0,
			},
			"INVALID_DIMENSION",
		],
		[
			"a coordinate outside the project boundary",
			{
				end: { xMm: 100_000, zMm: 0 },
				start: { xMm: 100_001, zMm: 0 },
				thicknessMm: 100,
			},
			"PROJECT_BOUNDS_EXCEEDED",
		],
		[
			"equal endpoints",
			{
				end: { xMm: 500, zMm: 500 },
				start: { xMm: 500, zMm: 500 },
				thicknessMm: 100,
			},
			"ZERO_LENGTH",
		],
	] as const)(
		"rejects %s with the canonical geometry reason before allocating an identity",
		(_case, input, reasonCode) => {
			expect(
				addWallSegment(
					{ vertices: [], wallSegments: [] },
					input,
					idsThatMustNotAllocate(),
				),
			).toEqual({ kind: "rejected", reasonCode });
		},
	);

	it("rejects a malformed source graph before allocating an identity", () => {
		expect(
			addWallSegment(
				{
					vertices: [
						{ vertexId: "a", xMm: 0, zMm: 0 },
						{ vertexId: "duplicate", xMm: 0, zMm: 0 },
					],
					wallSegments: [],
				},
				{
					end: { xMm: 1000, zMm: 0 },
					start: { xMm: 0, zMm: 0 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_PLAN_GRAPH" });
	});

	it("materializes an isolated exact integer-mm segment without inventing a Room face", () => {
		const result = addWallSegment(
			{ vertices: [], wallSegments: [] },
			{
				end: { xMm: 1125, zMm: -275 },
				start: { xMm: 125, zMm: -275 },
				thicknessMm: 100,
			},
			ids("vertex-start", "vertex-end", "wall-1"),
		);

		expect(result).toEqual({
			graph: {
				vertices: [
					{ vertexId: "vertex-start", xMm: 125, zMm: -275 },
					{ vertexId: "vertex-end", xMm: 1125, zMm: -275 },
				],
				wallSegments: [
					{
						endVertexId: "vertex-end",
						startVertexId: "vertex-start",
						thicknessMm: 100,
						wallSegmentId: "wall-1",
					},
				],
			},
			kind: "accepted",
		});
	});

	it("keeps a valid candidate when the source already owns the old disposable preview ID", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "b", xMm: 1000, zMm: 0 },
				],
				wallSegments: [
					{
						endVertexId: "b",
						startVertexId: "a",
						thicknessMm: 100,
						wallSegmentId: "__candidate_new_wall__",
					},
				],
			},
			{
				end: { xMm: 3000, zMm: 0 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("new-start", "new-end", "new-wall"),
		);

		expect(result.kind).toBe("accepted");
	});

	it.each([
		["an empty identity", ["", "new-end", "new-wall"]],
		["a duplicate vertex identity", ["same", "same", "new-wall"]],
	])("rejects %s returned by the materializing ID source", (_case, values) => {
		expect(
			addWallSegment(
				{ vertices: [], wallSegments: [] },
				{
					end: { xMm: 1000, zMm: 0 },
					start: { xMm: 0, zMm: 0 },
					thicknessMm: 100,
				},
				ids(...values),
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_PLAN_GRAPH" });
	});

	it("rejects a new Wall identity that collides with an existing Wall", () => {
		expect(
			addWallSegment(
				{
					vertices: [
						{ vertexId: "a", xMm: 0, zMm: 0 },
						{ vertexId: "b", xMm: 1000, zMm: 0 },
					],
					wallSegments: [
						{
							endVertexId: "b",
							startVertexId: "a",
							thicknessMm: 100,
							wallSegmentId: "existing-wall",
						},
					],
				},
				{
					end: { xMm: 3000, zMm: 0 },
					start: { xMm: 2000, zMm: 0 },
					thicknessMm: 100,
				},
				ids("new-start", "new-end", "existing-wall"),
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_PLAN_GRAPH" });
	});

	it("rejects a new Vertex identity that collides with an existing Vertex", () => {
		expect(
			addWallSegment(
				{
					vertices: [{ vertexId: "existing-vertex", xMm: 0, zMm: 0 }],
					wallSegments: [],
				},
				{
					end: { xMm: 3000, zMm: 0 },
					start: { xMm: 2000, zMm: 0 },
					thicknessMm: 100,
				},
				ids("existing-vertex", "new-end", "new-wall"),
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_PLAN_GRAPH" });
	});

	it("rejects duplicate Wall identities emitted for two new pieces", () => {
		expect(
			addWallSegment(
				{
					vertices: [
						{ vertexId: "a", xMm: 0, zMm: 0 },
						{ vertexId: "b", xMm: 1000, zMm: 0 },
					],
					wallSegments: [
						{
							endVertexId: "b",
							startVertexId: "a",
							thicknessMm: 100,
							wallSegmentId: "horizontal",
						},
					],
				},
				{
					end: { xMm: 500, zMm: 500 },
					start: { xMm: 500, zMm: -500 },
					thicknessMm: 100,
				},
				ids(
					"candidate-start",
					"contact",
					"candidate-end",
					"horizontal-split",
					"duplicate-wall",
					"duplicate-wall",
				),
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_PLAN_GRAPH" });
	});

	it.each([1, 100])(
		"retains an exact contact %i mm from an endpoint of a 100-mm Wall",
		(contactXMm) => {
			expect(
				addWallSegment(
					{
						vertices: [
							{ vertexId: "a", xMm: 0, zMm: 0 },
							{ vertexId: "b", xMm: 1000, zMm: 0 },
						],
						wallSegments: [
							{
								endVertexId: "b",
								startVertexId: "a",
								thicknessMm: 100,
								wallSegmentId: "horizontal",
							},
						],
					},
					{
						end: { xMm: contactXMm, zMm: 500 },
						start: { xMm: contactXMm, zMm: -500 },
						thicknessMm: 100,
					},
					ids("v-start", "v-contact", "v-end", "split", "new-1", "new-2"),
				),
			).toEqual(expect.objectContaining({ kind: "accepted", graph: expect.objectContaining({
				wallSegments: expect.arrayContaining([{ wallSegmentId: "horizontal", startVertexId: "a", endVertexId: "v-contact", thicknessMm: 100 }]),
				vertices: expect.arrayContaining([{ vertexId: "v-contact", xMm: contactXMm, zMm: 0 }]),
			}) }));
		},
	);

	it("retains a candidate contact piece equal to Wall thickness", () => {
		expect(
			addWallSegment(
				{
					vertices: [
						{ vertexId: "a", xMm: 0, zMm: 0 },
						{ vertexId: "b", xMm: 1000, zMm: 0 },
					],
					wallSegments: [
						{
							endVertexId: "b",
							startVertexId: "a",
							thicknessMm: 100,
							wallSegmentId: "horizontal",
						},
					],
				},
				{
					end: { xMm: 500, zMm: 1000 },
					start: { xMm: 500, zMm: -100 },
					thicknessMm: 100,
				},
				ids("v-start", "v-contact", "v-end", "split", "new-1", "new-2"),
			),
		).toEqual(expect.objectContaining({ kind: "accepted", graph: expect.objectContaining({
			wallSegments: expect.arrayContaining([{ wallSegmentId: "new-1", startVertexId: "v-start", endVertexId: "v-contact", thicknessMm: 100 }]),
		}) }));
	});

	it("accepts the adjacent exact contact once every resulting piece exceeds Wall thickness", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "b", xMm: 1000, zMm: 0 },
				],
				wallSegments: [
					{
						endVertexId: "b",
						startVertexId: "a",
						thicknessMm: 100,
						wallSegmentId: "horizontal",
					},
				],
			},
			{
				end: { xMm: 101, zMm: 500 },
				start: { xMm: 101, zMm: -500 },
				thicknessMm: 100,
			},
			ids("v-start", "v-contact", "v-end", "split", "new-1", "new-2"),
		);

		expect(result.kind).toBe("accepted");
	});

	it("materializes an isolated exact 45-degree wall without inventing a Room face", () => {
		const result = addWallSegment(
			{ vertices: [], wallSegments: [] },
			{
				end: { xMm: 1125, zMm: 725 },
				start: { xMm: 125, zMm: -275 },
				thicknessMm: 100,
			},
			ids("vertex-start", "vertex-end", "wall-45"),
		);

		expect(result).toEqual({
			graph: {
				vertices: [
					{ vertexId: "vertex-start", xMm: 125, zMm: -275 },
					{ vertexId: "vertex-end", xMm: 1125, zMm: 725 },
				],
				wallSegments: [
					{
						endVertexId: "vertex-end",
						startVertexId: "vertex-start",
						thicknessMm: 100,
						wallSegmentId: "wall-45",
					},
				],
			},
			kind: "accepted",
		});
	});

	it("reuses an existing endpoint and only allocates the new endpoint and wall", () => {
		const graph: PlanGraph = {
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 1000, zMm: 0 },
			],
			wallSegments: [
				{
					endVertexId: "b",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "base",
				},
			],
		};

		const result = addWallSegment(
			graph,
			{
				end: { xMm: 0, zMm: 900 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("vertex-new", "wall-new"),
		);

		expect(result).toEqual(
			expect.objectContaining({
				graph: expect.objectContaining({
					vertices: [
						{ vertexId: "a", xMm: 0, zMm: 0 },
						{ vertexId: "b", xMm: 1000, zMm: 0 },
						{ vertexId: "vertex-new", xMm: 0, zMm: 900 },
					],
					wallSegments: expect.arrayContaining([
						{
							endVertexId: "vertex-new",
							startVertexId: "a",
							thicknessMm: 100,
							wallSegmentId: "wall-new",
						},
					]),
				}),
				kind: "accepted",
			}),
		);
	});

	it("keeps a bounded rectangular room valid when a 45-degree wall branches from its corner", () => {
		const result = addWallSegment(
			rectangleGraph(),
			{
				end: { xMm: -1000, zMm: -1000 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("diagonal-end", "diagonal-wall"),
		);

		expect(result).toEqual(
			expect.objectContaining({
				kind: "accepted",
				graph: expect.objectContaining({
					wallSegments: expect.arrayContaining([
						{
							endVertexId: "diagonal-end",
							startVertexId: "a",
							thicknessMm: 100,
							wallSegmentId: "diagonal-wall",
						},
					]),
				}),
			}),
		);
		if (result.kind !== "accepted") return;
		expect(deriveBoundedOrthogonalFaces(result.graph)).toEqual(
			expect.objectContaining({
				faces: [expect.objectContaining({ areaMm2: exactMeasurement(12_000_000n) })],
				kind: "accepted",
			}),
		);
	});

	it("closes an exact 45-degree triangular Plan face without allocating a rectangular substitute", () => {
		const result = addWallSegment(
			{
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
				],
			},
			{
				end: { xMm: 0, zMm: 0 },
				start: { xMm: 2000, zMm: 2000 },
				thicknessMm: 100,
			},
			ids("diagonal"),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "a",
					startVertexId: "c",
					thicknessMm: 100,
					wallSegmentId: "diagonal",
				},
			]),
		);
		expect(deriveBoundedOrthogonalFaces(result.graph)).toEqual(
			expect.objectContaining({
				faces: [
					expect.objectContaining({
						areaMm2: exactMeasurement(2_000_000n),
						vertices: [
							{ xMm: 0, zMm: 0 },
							{ xMm: 2000, zMm: 0 },
							{ xMm: 2000, zMm: 2000 },
						],
					}),
				],
				kind: "accepted",
			}),
		);
	});

	it("normalizes an exact 45-degree branch into a wall body without changing its rectangular Room", () => {
		const result = addWallSegment(
			rectangleGraph(),
			{
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 1000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids(
				"diagonal-start",
				"bottom-contact",
				"bottom-tail",
				"diagonal-wall",
			),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "diagonal-start", xMm: 1000, zMm: 1000 },
				{ vertexId: "bottom-contact", xMm: 2000, zMm: 0 },
			]),
		);
		expect(result.graph.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "bottom-contact",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "bottom",
				},
				{
					endVertexId: "b",
					startVertexId: "bottom-contact",
					thicknessMm: 100,
					wallSegmentId: "bottom-tail",
				},
				{
					endVertexId: "bottom-contact",
					startVertexId: "diagonal-start",
					thicknessMm: 100,
					wallSegmentId: "diagonal-wall",
				},
			]),
		);
		expect(deriveBoundedOrthogonalFaces(result.graph)).toEqual(
			expect.objectContaining({
				faces: [expect.objectContaining({ areaMm2: exactMeasurement(12_000_000n) })],
				kind: "accepted",
			}),
		);
	});

	it("rejects a diagonal X-contact at a half-millimetre before allocating an identity", () => {
		const graph: PlanGraph = {
			vertices: [
				{ vertexId: "southwest", xMm: 0, zMm: 0 },
				{ vertexId: "northeast", xMm: 2000, zMm: 2000 },
			],
			wallSegments: [
				{
					endVertexId: "northeast",
					startVertexId: "southwest",
					thicknessMm: 100,
					wallSegmentId: "existing-diagonal",
				},
			],
		};

		expect(
			addWallSegment(
				graph,
				{
					end: { xMm: 2001, zMm: -1000 },
					start: { xMm: 0, zMm: 1001 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "DIAGONAL_WALL_CONTACT_UNSUPPORTED",
		});
	});

	it("normalizes an exact diagonal X-contact into one shared integer-mm vertex", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "southwest", xMm: 0, zMm: 0 },
					{ vertexId: "northeast", xMm: 2000, zMm: 2000 },
				],
				wallSegments: [
					{
						endVertexId: "northeast",
						startVertexId: "southwest",
						thicknessMm: 100,
						wallSegmentId: "existing-diagonal",
					},
				],
			},
			{
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 0, zMm: 2000 },
				thicknessMm: 100,
			},
			ids(
				"northwest",
				"center",
				"southeast",
				"existing-tail",
				"candidate-first",
				"candidate-second",
			),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.vertices).toEqual(
			expect.arrayContaining([{ vertexId: "center", xMm: 1000, zMm: 1000 }]),
		);
		expect(result.graph.wallSegments).toHaveLength(4);
		expect(
			result.graph.wallSegments.filter(
				(wall) =>
					wall.startVertexId === "center" || wall.endVertexId === "center",
			),
		).toHaveLength(4);
		expect(deriveBoundedOrthogonalFaces(result.graph)).toEqual({
			faces: [],
			kind: "accepted",
		});
	});

	it("normalizes an exact diagonal X-contact when its line denominator is negative", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "southwest", xMm: 0, zMm: 0 },
					{ vertexId: "northeast", xMm: 2000, zMm: 2000 },
				],
				wallSegments: [
					{
						endVertexId: "northeast",
						startVertexId: "southwest",
						thicknessMm: 100,
						wallSegmentId: "existing-diagonal",
					},
				],
			},
			{
				end: { xMm: 0, zMm: 2000 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"northwest",
				"center",
				"southeast",
				"existing-tail",
				"candidate-first",
				"candidate-second",
			),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.vertices).toEqual(
			expect.arrayContaining([{ vertexId: "center", xMm: 1000, zMm: 1000 }]),
		);
		expect(result.graph.wallSegments).toHaveLength(4);
	});

	it("normalizes a shifted exact diagonal X-contact without treating coordinates as vectors", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "southwest", xMm: 500, zMm: 300 },
					{ vertexId: "northeast", xMm: 2500, zMm: 2300 },
				],
				wallSegments: [
					{
						endVertexId: "northeast",
						startVertexId: "southwest",
						thicknessMm: 100,
						wallSegmentId: "shifted-diagonal",
					},
				],
			},
			{
				end: { xMm: 2500, zMm: 300 },
				start: { xMm: 500, zMm: 2300 },
				thicknessMm: 100,
			},
			ids(
				"northwest",
				"center",
				"southeast",
				"shifted-diagonal-tail",
				"candidate-first",
				"candidate-second",
			),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "center", xMm: 1500, zMm: 1300 },
			]),
		);
		expect(result.graph.wallSegments).toHaveLength(4);
		expect(
			result.graph.wallSegments.filter(
				(wall) =>
					wall.startVertexId === "center" || wall.endVertexId === "center",
			),
		).toHaveLength(4);
	});

	it("extends a diagonal at its endpoint without treating a zero-length touch as overlap", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "southwest", xMm: 0, zMm: 0 },
					{ vertexId: "joint", xMm: 1000, zMm: 1000 },
				],
				wallSegments: [
					{
						endVertexId: "joint",
						startVertexId: "southwest",
						thicknessMm: 100,
						wallSegmentId: "existing-diagonal",
					},
				],
			},
			{
				end: { xMm: 2000, zMm: 2000 },
				start: { xMm: 1000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("new-end", "new-wall"),
		);

		expect(result).toEqual({
			graph: {
				vertices: [
					{ vertexId: "southwest", xMm: 0, zMm: 0 },
					{ vertexId: "new-end", xMm: 2000, zMm: 2000 },
				],
				wallSegments: [
					{
						endVertexId: "new-end",
						startVertexId: "southwest",
						thicknessMm: 100,
						wallSegmentId: "existing-diagonal",
					},
				],
			},
			kind: "accepted",
		});
	});

	it("rejects a positive diagonal overlap before allocating an identity", () => {
		expect(
			addWallSegment(
				{
					vertices: [
						{ vertexId: "southwest", xMm: 0, zMm: 0 },
						{ vertexId: "northeast", xMm: 2000, zMm: 2000 },
					],
					wallSegments: [
						{
							endVertexId: "northeast",
							startVertexId: "southwest",
							thicknessMm: 100,
							wallSegmentId: "existing-diagonal",
						},
					],
				},
				{
					end: { xMm: 3000, zMm: 3000 },
					start: { xMm: 1000, zMm: 1000 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "DIAGONAL_WALL_CONTACT_UNSUPPORTED",
		});
	});

	it("rejects a non-45-degree candidate before allocating a topology identity", () => {
		expect(
			addWallSegment(
				{ vertices: [], wallSegments: [] },
				{
					end: { xMm: 1000, zMm: 500 },
					start: { xMm: 0, zMm: 0 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "UNSUPPORTED_DIRECTION" });
	});

	it("normalizes a candidate T-contact by splitting the crossed wall at one shared vertex", () => {
		const result = addWallSegment(
			rectangleGraph(),
			{
				end: { xMm: 2000, zMm: 1200 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("vertex-contact", "vertex-end", "bottom-tail", "wall-divider"),
		);
		if (result.kind !== "accepted") {
			throw new Error("Expected T contact to be normalized");
		}

		expect(result.graph.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "vertex-contact", xMm: 2000, zMm: 0 },
				{ vertexId: "vertex-end", xMm: 2000, zMm: 1200 },
			]),
		);
		expect(result.graph.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "vertex-contact",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "bottom",
				},
				{
					endVertexId: "b",
					startVertexId: "vertex-contact",
					thicknessMm: 100,
					wallSegmentId: "bottom-tail",
				},
				{
					endVertexId: "vertex-end",
					startVertexId: "vertex-contact",
					thicknessMm: 100,
					wallSegmentId: "wall-divider",
				},
			]),
		);
		expect(deriveBoundedOrthogonalFaces(result.graph)).toEqual(
			expect.objectContaining({
				faces: [
					expect.objectContaining({
						fingerprint: "orthogonal-face:0:0|0:3000|4000:3000|4000:0",
					}),
				],
				kind: "accepted",
			}),
		);
	});

	it("normalizes an exact X contact into one central vertex and four canonical wall pieces", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "left", xMm: 0, zMm: 1000 },
					{ vertexId: "right", xMm: 2000, zMm: 1000 },
				],
				wallSegments: [
					{
						endVertexId: "right",
						startVertexId: "left",
						thicknessMm: 100,
						wallSegmentId: "horizontal",
					},
				],
			},
			{
				end: { xMm: 1000, zMm: 2000 },
				start: { xMm: 1000, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"vertex-top",
				"vertex-cross",
				"vertex-bottom",
				"horizontal-tail",
				"vertical-top",
				"vertical-bottom",
			),
		);
		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}

		const cross = result.graph.vertices.find(
			(vertex) => vertex.xMm === 1000 && vertex.zMm === 1000,
		);
		expect(cross?.vertexId).toBe("vertex-cross");
		expect(result.graph.wallSegments).toHaveLength(4);
		expect(
			result.graph.wallSegments.filter(
				(wall) =>
					wall.startVertexId === "vertex-cross" ||
					wall.endVertexId === "vertex-cross",
			),
		).toHaveLength(4);
		expect(deriveBoundedOrthogonalFaces(result.graph)).toEqual({
			faces: [],
			kind: "accepted",
		});
	});

	it("creates two derived faces when a full divider crosses the existing boundary at both ends", () => {
		const result = addWallSegment(
			rectangleGraph(),
			{
				end: { xMm: 2000, zMm: 3000 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"vertex-bottom",
				"vertex-top",
				"bottom-tail",
				"top-tail",
				"divider-bottom",
				"divider-top",
			),
		);
		if (result.kind !== "accepted") {
			throw new Error("Expected full divider to be accepted");
		}

		const faces = deriveBoundedOrthogonalFaces(result.graph);
		expect(faces).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (faces.kind !== "accepted") {
			throw new Error("Expected derived faces");
		}
		expect(faces.faces).toHaveLength(2);
		expect(result.graph.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "vertex-top",
					startVertexId: "vertex-bottom",
					thicknessMm: 100,
					wallSegmentId: "divider-bottom",
				},
			]),
		);
	});

	it("rejects an outward extension that positively overlaps an existing wall before allocation", () => {
		expect(
			addWallSegment(
				rectangleGraph(),
				{
					end: { xMm: 5000, zMm: 0 },
					start: { xMm: 2000, zMm: 0 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "COLLINEAR_OVERLAP" });
	});

	it("rejects an endpoint extension no longer than its thickness before allocation", () => {
		expect(
			addWallSegment(
				{
					...rectangleGraph(),
					wallSegments: rectangleGraph().wallSegments.map((wall) => ({
						...wall,
						thicknessMm: 300,
					})),
				},
				{
					end: { xMm: 4200, zMm: 0 },
					start: { xMm: 4000, zMm: 0 },
					thicknessMm: 300,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
	});

	it("rejects a reversed outward gesture that positively overlaps an existing wall", () => {
		expect(
			addWallSegment(
				rectangleGraph(),
				{
					end: { xMm: 2000, zMm: 0 },
					start: { xMm: 5000, zMm: 0 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "COLLINEAR_OVERLAP" });
	});

	it("coalesces adjacent detached pieces of one straight wall into one canonical segment", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "joint", xMm: 1000, zMm: 0 },
				],
				wallSegments: [
					{
						endVertexId: "joint",
						startVertexId: "a",
						thicknessMm: 100,
						wallSegmentId: "base",
					},
				],
			},
			{
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 1000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("extension-end", "extension-wall"),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph).toEqual({
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "extension-end", xMm: 2000, zMm: 0 },
			],
			wallSegments: [
				{
					endVertexId: "extension-end",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "base",
				},
			],
		});
	});

	it("keeps a split when the existing segment is protected by a hosted opening", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "joint", xMm: 1000, zMm: 0 },
				],
				wallSegments: [
					{
						endVertexId: "joint",
						startVertexId: "a",
						thicknessMm: 100,
						wallSegmentId: "door-host",
					},
				],
			},
			{
				end: { xMm: 2000, zMm: 0 },
				nonMergeableWallSegmentIds: ["door-host"],
				start: { xMm: 1000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("extension-end", "extension-wall"),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "joint",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "door-host",
				},
				{
					endVertexId: "extension-end",
					startVertexId: "joint",
					thicknessMm: 100,
					wallSegmentId: "extension-wall",
				},
			]),
		);
	});

	it("does not coalesce adjacent walls that intentionally use different thicknesses", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "joint", xMm: 1000, zMm: 0 },
				],
				wallSegments: [
					{
						endVertexId: "joint",
						startVertexId: "a",
						thicknessMm: 100,
						wallSegmentId: "thin",
					},
				],
			},
			{
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 1000, zMm: 0 },
				thicknessMm: 200,
			},
			ids("extension-end", "thick-extension"),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "joint",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "thin",
				},
				{
					endVertexId: "extension-end",
					startVertexId: "joint",
					thicknessMm: 200,
					wallSegmentId: "thick-extension",
				},
			]),
		);
	});

	it("does not erase a protected second segment while normalizing an older contiguous pair", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "joint", xMm: 1000, zMm: 0 },
					{ vertexId: "b", xMm: 2000, zMm: 0 },
				],
				wallSegments: [
					{
						endVertexId: "joint",
						startVertexId: "a",
						thicknessMm: 100,
						wallSegmentId: "plain",
					},
					{
						endVertexId: "b",
						startVertexId: "joint",
						thicknessMm: 100,
						wallSegmentId: "door-host",
					},
				],
			},
			{
				end: { xMm: 6000, zMm: 0 },
				nonMergeableWallSegmentIds: ["door-host"],
				start: { xMm: 5000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("new-start", "new-end", "new-wall"),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "joint",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "plain",
				},
				{
					endVertexId: "b",
					startVertexId: "joint",
					thicknessMm: 100,
					wallSegmentId: "door-host",
				},
			]),
		);
		expect(result.graph.vertices).toEqual(
			expect.arrayContaining([{ vertexId: "joint", xMm: 1000, zMm: 0 }]),
		);
	});

	it("does not coalesce a collinear wall through a T junction", () => {
		const result = addWallSegment(
			{
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "joint", xMm: 1000, zMm: 0 },
					{ vertexId: "b", xMm: 2000, zMm: 0 },
					{ vertexId: "branch", xMm: 1000, zMm: 1000 },
				],
				wallSegments: [
					{
						endVertexId: "joint",
						startVertexId: "a",
						thicknessMm: 100,
						wallSegmentId: "left",
					},
					{
						endVertexId: "b",
						startVertexId: "joint",
						thicknessMm: 100,
						wallSegmentId: "right",
					},
					{
						endVertexId: "branch",
						startVertexId: "joint",
						thicknessMm: 100,
						wallSegmentId: "branch",
					},
				],
			},
			{
				end: { xMm: 3000, zMm: 0 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("extension-end", "extension-wall"),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.graph.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "joint",
					startVertexId: "a",
					thicknessMm: 100,
					wallSegmentId: "left",
				},
				{
					endVertexId: "extension-end",
					startVertexId: "joint",
					thicknessMm: 100,
					wallSegmentId: "right",
				},
			]),
		);
		expect(result.graph.vertices).toEqual(
			expect.arrayContaining([{ vertexId: "joint", xMm: 1000, zMm: 0 }]),
		);
	});

	it.each([
		[
			"a collinear overlap",
			{
				end: { xMm: 3000, zMm: 0 },
				start: { xMm: 1000, zMm: 0 },
				thicknessMm: 100,
			},
			"COLLINEAR_OVERLAP",
		],
		[
			"a too-short wall",
			{
				end: { xMm: 100, zMm: 0 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			"TOO_SHORT_WALL",
		],
	])(
		"rejects %s before allocating an identity",
		(_description, input, reasonCode) => {
			expect(
				addWallSegment(rectangleGraph(), input, idsThatMustNotAllocate()),
			).toEqual({ kind: "rejected", reasonCode });
		},
	);
});
