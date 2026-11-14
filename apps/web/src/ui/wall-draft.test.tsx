import { describe, expect, it } from "@rstest/core";

import {
	isWallDraftConfirmable,
	snapCardinalWallDraft,
	snapConstrainedWallDraft,
	snapConstrainedWallDraftEnd,
	snapWallDraftEnd,
	snapWallDraftStart,
	wallDraftAlignmentGuide,
	wallJoinTargetRadiusMm,
} from "./wall-draft";

describe("snapCardinalWallDraft", () => {
	it("quantizes a free gesture to each of the four 45-degree diagonals in the local construction grid", () => {
		expect(
			snapConstrainedWallDraft({ xMm: 100, zMm: 100 }, { xMm: 280, zMm: -70 }),
		).toEqual({ direction: "NE", end: { xMm: 300, zMm: -100 } });
		expect(
			snapConstrainedWallDraft({ xMm: 100, zMm: 100 }, { xMm: -80, zMm: -70 }),
		).toEqual({ direction: "NW", end: { xMm: -100, zMm: -100 } });
		expect(
			snapConstrainedWallDraft({ xMm: 100, zMm: 100 }, { xMm: -80, zMm: 270 }),
		).toEqual({ direction: "SW", end: { xMm: -100, zMm: 300 } });
		expect(
			snapConstrainedWallDraft({ xMm: 100, zMm: 100 }, { xMm: 280, zMm: 270 }),
		).toEqual({ direction: "SE", end: { xMm: 300, zMm: 300 } });
	});

	it("keeps cardinal directions and their local 100-mm steps when they are closer than a diagonal", () => {
		expect(
			snapConstrainedWallDraft(
				{ xMm: -350, zMm: 125 },
				{ xMm: -180, zMm: 126 },
			),
		).toEqual({ direction: "E", end: { xMm: -150, zMm: 125 } });
		expect(
			snapConstrainedWallDraft({ xMm: 0, zMm: 0 }, { xMm: 1, zMm: 0 }),
		).toEqual({ direction: "E", end: { xMm: 100, zMm: 0 } });
		expect(
			snapConstrainedWallDraft({ xMm: 0, zMm: 0 }, { xMm: 0, zMm: -180 }),
		).toEqual({ direction: "N", end: { xMm: 0, zMm: -200 } });
		expect(
			snapConstrainedWallDraft({ xMm: 0, zMm: 0 }, { xMm: -180, zMm: 0 }),
		).toEqual({ direction: "W", end: { xMm: -200, zMm: 0 } });
		expect(
			snapConstrainedWallDraft({ xMm: 0, zMm: 0 }, { xMm: 0, zMm: 180 }),
		).toEqual({ direction: "S", end: { xMm: 0, zMm: 200 } });
	});

	it("uses the documented clockwise direction order to break an exact E/NE gesture tie", () => {
		expect(
			snapConstrainedWallDraft(
				{ xMm: 0, zMm: 0 },
				{ xMm: 1000, zMm: -(Math.SQRT2 - 1) * 1000 },
			),
		).toEqual({ direction: "E", end: { xMm: 1000, zMm: 0 } });
	});

	it("refuses absent, non-finite and unsafe construction gestures before a draft can be created", () => {
		expect(
			snapConstrainedWallDraft({ xMm: 0, zMm: 0 }, { xMm: 0, zMm: 0 }),
		).toBeUndefined();
		expect(
			snapConstrainedWallDraft({ xMm: 0, zMm: 0 }, { xMm: Number.NaN, zMm: 0 }),
		).toBeUndefined();
		expect(
			snapConstrainedWallDraft({ xMm: 0, zMm: 0 }, { xMm: 100, zMm: 0 }, 0),
		).toBeUndefined();
		expect(
			snapConstrainedWallDraft({ xMm: 0, zMm: 0 }, { xMm: 100, zMm: 0 }, 50.5),
		).toBeUndefined();
		expect(
			snapConstrainedWallDraft(
				{ xMm: Number.MAX_SAFE_INTEGER - 50, zMm: 0 },
				{ xMm: Number.MAX_SAFE_INTEGER, zMm: 0 },
			),
		).toBeUndefined();
	});

	it("keeps the wall magnet deliberately tight so a parallel nearby wall remains drawable", () => {
		const radiusMm = 150;
		expect(
			snapWallDraftStart(
				{ xMm: 2000, zMm: 151 },
				{
					radiusMm,
					vertices: [],
					wallSegments: [
						{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 2000, zMm: 151 });
		expect(
			snapWallDraftStart(
				{ xMm: 2000, zMm: 100 },
				{
					radiusMm,
					vertices: [],
					wallSegments: [
						{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 2000, zMm: 100 });
		expect(
			snapWallDraftStart(
				{ xMm: 2000, zMm: 100 },
				{
					radiusMm,
					vertices: [],
					wallBodyRadiusMm: radiusMm,
					wallSegments: [
						{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 2000, zMm: 0 });
	});

	it("keeps the same 12 CSS-pixel target half-size across zoom levels", () => {
		expect(wallJoinTargetRadiusMm(0.08)).toBe(150);
		expect(wallJoinTargetRadiusMm(0.16)).toBe(75);
		expect(wallJoinTargetRadiusMm(0)).toBeUndefined();
		expect(wallJoinTargetRadiusMm(-0.08)).toBeUndefined();
		expect(wallJoinTargetRadiusMm(Number.NaN)).toBeUndefined();
		expect(wallJoinTargetRadiusMm(Number.POSITIVE_INFINITY)).toBeUndefined();
	});

	it("allows confirmation only when the snapped centreline is longer than its thickness", () => {
		expect(
			isWallDraftConfirmable(
				{ xMm: 0, zMm: 0 },
				{ xMm: 99, zMm: 0 },
				100,
			),
		).toBe(false);
		expect(
			isWallDraftConfirmable(
				{ xMm: 0, zMm: 0 },
				{ xMm: 100, zMm: 0 },
				100,
			),
		).toBe(false);
		expect(
			isWallDraftConfirmable(
				{ xMm: 0, zMm: 0 },
				{ xMm: 101, zMm: 0 },
				100,
			),
		).toBe(true);
		expect(
			isWallDraftConfirmable(
				{ xMm: 100, zMm: 200 },
				{ xMm: 200, zMm: 200 },
				100,
			),
		).toBe(false);
		expect(
			isWallDraftConfirmable(
				{ xMm: 100, zMm: 200 },
				{ xMm: 100, zMm: 300 },
				100,
			),
		).toBe(false);
		expect(
			isWallDraftConfirmable(
				{ xMm: 0, zMm: 0 },
				{ xMm: 100, zMm: 100 },
				100,
			),
		).toBe(true);
	});

	it.each([
		[{ xMm: Number.NaN, zMm: 0 }, { xMm: 200, zMm: 0 }, 100],
		[{ xMm: 0, zMm: 0.5 }, { xMm: 200, zMm: 0 }, 100],
		[{ xMm: 0, zMm: 0 }, { xMm: Number.MAX_SAFE_INTEGER + 1, zMm: 0 }, 100],
		[{ xMm: 0, zMm: 0 }, { xMm: 200, zMm: Number.POSITIVE_INFINITY }, 100],
		[{ xMm: 0, zMm: 0 }, { xMm: 200, zMm: 0 }, 0],
		[{ xMm: 0, zMm: 0 }, { xMm: 200, zMm: 0 }, -1],
		[{ xMm: 0, zMm: 0 }, { xMm: 200, zMm: 0 }, 50.5],
	])(
		"never confirms unsafe or non-positive construction input %#",
		(start, end, thicknessMm) => {
			expect(isWallDraftConfirmable(start, end, thicknessMm)).toBe(false);
		},
	);
	it("snaps relative to the gesture origin instead of the global visual grid", () => {
		expect(
			snapCardinalWallDraft({ xMm: -350, zMm: 125 }, { xMm: -180, zMm: 126 }),
		).toEqual({ xMm: -150, zMm: 125 });
	});

	it("uses the declared east-before-north tie break for an equal diagonal gesture", () => {
		expect(
			snapCardinalWallDraft({ xMm: 100, zMm: 100 }, { xMm: 300, zMm: -100 }),
		).toEqual({ xMm: 300, zMm: 100 });
	});

	it("keeps a non-zero construction length while refusing an absent or non-finite gesture", () => {
		expect(
			snapCardinalWallDraft({ xMm: 0, zMm: 0 }, { xMm: 1, zMm: 0 }),
		).toEqual({ xMm: 100, zMm: 0 });
		expect(
			snapCardinalWallDraft({ xMm: 0, zMm: 0 }, { xMm: 0, zMm: 0 }),
		).toBeUndefined();
		expect(
			snapCardinalWallDraft({ xMm: 0, zMm: 0 }, { xMm: Number.NaN, zMm: 0 }),
		).toBeUndefined();
	});

	it("magnetically starts at a nearby existing wall corner before applying the relative grid", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 4040, zMm: 55 },
				{
					radiusMm: 100,
					vertices: [
						{ xMm: 0, zMm: 0 },
						{ xMm: 4100, zMm: 0 },
					],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 4100, zMm: 0 });
	});

	it("magnetically starts at the nearest point of a nearby existing wall", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 2050, zMm: 40 },
				{
					radiusMm: 100,
					vertices: [],
					wallSegments: [
						{ end: { xMm: 4100, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 2050, zMm: 0 });
	});

	it("prefers an eligible existing vertex over a closer wall-body projection", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 20, zMm: 10 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 0, zMm: 0 }],
					wallBodyRadiusMm: 100,
					wallSegments: [
						{ end: { xMm: 1000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 0, zMm: 0 });
	});

	it("projects a nearby start onto the exact body of a 45-degree wall", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 520, zMm: 480 },
				{
					radiusMm: 100,
					vertices: [],
					wallBodyRadiusMm: 100,
					wallSegments: [
						{
							end: { xMm: 1000, zMm: 1000 },
							start: { xMm: 0, zMm: 0 },
						},
					],
				},
			),
		).toEqual({ xMm: 500, zMm: 500 });
	});

	it("ignores a negative wall-body radius instead of squaring it into eligibility", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 500, zMm: 20 },
				{
					radiusMm: 100,
					vertices: [],
					wallBodyRadiusMm: -100,
					wallSegments: [
						{ end: { xMm: 1000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 500, zMm: 20 });
	});

	it("treats zero as an exact-only radius and rejects non-finite snap configuration", () => {
		const vertex = { xMm: 500, zMm: 20 };
		expect(
			snapWallDraftStart(vertex, {
				radiusMm: 0,
				vertices: [vertex],
				wallSegments: [],
			}),
		).toEqual(vertex);
		expect(
			snapWallDraftStart(vertex, {
				radiusMm: Number.NaN,
				vertices: [vertex],
				wallSegments: [],
			}),
		).toEqual(vertex);
		expect(
			snapWallDraftStart(
				{ xMm: 500, zMm: 20 },
				{
					radiusMm: 100,
					vertices: [],
					wallBodyRadiusMm: Number.NaN,
					wallSegments: [
						{ end: { xMm: 1000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 500, zMm: 20 });
	});

	it.each([
		[Number.NaN, undefined],
		[Number.POSITIVE_INFINITY, undefined],
		[-1, undefined],
		[100, Number.POSITIVE_INFINITY],
		[100, -1],
	])(
		"leaves a nearby start untouched for invalid radii %#",
		(radiusMm, wallBodyRadiusMm) => {
			const candidate = { xMm: 10, zMm: 10 };
			expect(
				snapWallDraftStart(candidate, {
					radiusMm,
					vertices: [{ xMm: 0, zMm: 0 }],
					wallBodyRadiusMm,
					wallSegments: [
						{ end: { xMm: 1000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				}),
			).toEqual(candidate);
		},
	);

	it("chooses the nearest eligible wall body regardless of source order", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 500, zMm: 30 },
				{
					radiusMm: 100,
					vertices: [],
					wallBodyRadiusMm: 100,
					wallSegments: [
						{ end: { xMm: 1000, zMm: 80 }, start: { xMm: 0, zMm: 80 } },
						{ end: { xMm: 1000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 500, zMm: 0 });
	});

	it("keeps the radius boundary inclusive and resolves equal-distance corners deterministically", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 100, zMm: 0 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 0, zMm: 0 }],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 0, zMm: 0 });
		expect(
			snapWallDraftStart(
				{ xMm: 0, zMm: 0 },
				{
					radiusMm: 20,
					vertices: [
						{ xMm: 10, zMm: 0 },
						{ xMm: -10, zMm: 0 },
					],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: -10, zMm: 0 });
		expect(
			snapWallDraftStart(
				{ xMm: 0, zMm: 0 },
				{
					radiusMm: 20,
					vertices: [
						{ xMm: 0, zMm: 10 },
						{ xMm: 0, zMm: -10 },
					],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 0, zMm: -10 });
	});

	it("projects a nearby start onto a vertical wall body", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 20, zMm: 600 },
				{
					radiusMm: 100,
					vertices: [],
					wallBodyRadiusMm: 100,
					wallSegments: [
						{ end: { xMm: 0, zMm: 1000 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 0, zMm: 600 });
	});

	it("treats a zero-length wall body as its one exact point", () => {
		expect(
			snapWallDraftStart(
				{ xMm: 10, zMm: 10 },
				{
					radiusMm: 20,
					vertices: [],
					wallBodyRadiusMm: 20,
					wallSegments: [
						{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 0, zMm: 0 });
	});

	it("projects onto a reversed falling diagonal and clamps beyond its endpoint", () => {
		const wall = {
			end: { xMm: 0, zMm: 1000 },
			start: { xMm: 1000, zMm: 0 },
		};
		expect(
			snapWallDraftStart(
				{ xMm: 520, zMm: 520 },
				{
					radiusMm: 100,
					vertices: [],
					wallBodyRadiusMm: 100,
					wallSegments: [wall],
				},
			),
		).toEqual({ xMm: 500, zMm: 500 });
		expect(
			snapWallDraftStart(
				{ xMm: 1050, zMm: -50 },
				{
					radiusMm: 100,
					vertices: [],
					wallBodyRadiusMm: 100,
					wallSegments: [wall],
				},
			),
		).toEqual({ xMm: 1000, zMm: 0 });
	});

	it("magnetically finishes a cardinal draft at the crossing of a nearby perpendicular wall", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 1500 },
				{ xMm: 4040, zMm: 1502 },
				{
					radiusMm: 100,
					wallSegments: [
						{ end: { xMm: 4100, zMm: 3000 }, start: { xMm: 4100, zMm: 0 } },
					],
				},
			),
		).toEqual({ xMm: 4100, zMm: 1500 });
	});

	it("retains a cardinal magnetic join while exposing the 0/45/90-degree draft direction", () => {
		expect(
			snapConstrainedWallDraftEnd(
				{ xMm: 0, zMm: 1500 },
				{ xMm: 4040, zMm: 1502 },
				{
					radiusMm: 100,
					wallSegments: [
						{ end: { xMm: 4100, zMm: 3000 }, start: { xMm: 4100, zMm: 0 } },
					],
				},
			),
		).toEqual({ direction: "E", end: { xMm: 4100, zMm: 1500 } });
	});

	it("keeps an exact 45-degree end on the origin-relative construction grid", () => {
		expect(
			snapConstrainedWallDraftEnd(
				{ xMm: 100, zMm: 100 },
				{ xMm: 280, zMm: -70 },
				{ radiusMm: 100, wallSegments: [] },
			),
		).toEqual({ direction: "NE", end: { xMm: 300, zMm: -100 } });
	});

	it("magnetically closes a 45-degree wall on a nearby exact diagonal corner", () => {
		expect(
			snapConstrainedWallDraftEnd(
				{ xMm: 1950, zMm: 1950 },
				{ xMm: 70, zMm: 70 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 0, zMm: 0 }],
					wallSegments: [],
				},
			),
		).toEqual({ direction: "NW", end: { xMm: 0, zMm: 0 } });
	});

	it("prefers a nearby exact 45-degree corner over a slightly imprecise cardinal touch gesture", () => {
		expect(
			snapConstrainedWallDraftEnd(
				{ xMm: 200, zMm: 200 },
				{ xMm: 140, zMm: 0 },
				{
					radiusMm: 150,
					vertices: [{ xMm: 0, zMm: 0 }],
					wallSegments: [],
				},
			),
		).toEqual({ direction: "NW", end: { xMm: 0, zMm: 0 } });
	});

	it("preserves each of the four 45-degree directions when closing on a corner", () => {
		const start = { xMm: 1000, zMm: 1000 };
		[
			{ direction: "NE", end: { xMm: 2000, zMm: 0 } },
			{ direction: "NW", end: { xMm: 0, zMm: 0 } },
			{ direction: "SE", end: { xMm: 2000, zMm: 2000 } },
			{ direction: "SW", end: { xMm: 0, zMm: 2000 } },
		].forEach(({ direction, end }) => {
			expect(
				snapConstrainedWallDraftEnd(start, end, {
					radiusMm: 100,
					vertices: [end],
					wallSegments: [],
				}),
			).toEqual({ direction, end });
		});
	});

	it("uses the raw pointer position to join a perpendicular wall before grid rounding moves it away", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 2050, zMm: 0 },
				{ xMm: 2052, zMm: 3040 },
				{
					radiusMm: 100,
					wallSegments: [
						{ end: { xMm: 4100, zMm: 3100 }, start: { xMm: 0, zMm: 3100 } },
					],
				},
			),
		).toEqual({ xMm: 2050, zMm: 3100 });
	});

	it("uses the raw pointer hit when the rounded endpoint has already left the target radius", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 2050, zMm: 0 },
				{ xMm: 2052, zMm: 3140 },
				{
					radiusMm: 50,
					wallSegments: [
						{ end: { xMm: 4100, zMm: 3160 }, start: { xMm: 0, zMm: 3160 } },
					],
				},
			),
		).toEqual({ xMm: 2050, zMm: 3160 });
	});

	it("never reverses a cardinal draft onto a target behind its start", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 40, zMm: 0 },
				{
					radiusMm: 150,
					wallSegments: [
						{ end: { xMm: -10, zMm: 100 }, start: { xMm: -10, zMm: -100 } },
					],
				},
			),
		).toEqual({ xMm: 100, zMm: 0 });
	});

	it("does not join the draft to its own start or to a vertically-behind target", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 40, zMm: 0 },
				{
					radiusMm: 150,
					vertices: [{ xMm: 0, zMm: 0 }],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 100, zMm: 0 });
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 0, zMm: 40 },
				{
					radiusMm: 150,
					vertices: [{ xMm: 0, zMm: -10 }],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 0, zMm: 100 });
	});

	it("ignores nearby vertices that are not aligned with the cardinal ray", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 4040, zMm: 55 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 4100, zMm: 50 }],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 4000, zMm: 0 });
	});

	it("chooses the nearest aligned endpoint instead of the first supplied endpoint", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 4040, zMm: 0 },
				{
					radiusMm: 100,
					vertices: [
						{ xMm: 4100, zMm: 0 },
						{ xMm: 4000, zMm: 0 },
					],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 4000, zMm: 0 });
	});

	it("joins a forward vertical draft from a shifted origin", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 100, zMm: 200 },
				{ xMm: 102, zMm: 4240 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 100, zMm: 4300 }],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 100, zMm: 4300 });
	});

	it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
		"rejects an invalid finish radius %#",
		(radiusMm) => {
			expect(
				snapWallDraftEnd(
					{ xMm: 0, zMm: 0 },
					{ xMm: 140, zMm: 0 },
					{ radiusMm, wallSegments: [] },
				),
			).toBeUndefined();
			expect(
				snapConstrainedWallDraftEnd(
					{ xMm: 0, zMm: 0 },
					{ xMm: 140, zMm: 0 },
					{ radiusMm, wallSegments: [] },
				),
			).toBeUndefined();
		},
	);

	it("rejects an invalid cardinal construction step", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 100, zMm: 0 },
				{ radiusMm: 100, wallSegments: [] },
				0,
			),
		).toBeUndefined();
	});

	it("ignores a ray-origin contact and a line contact outside the wall body", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 40, zMm: 0 },
				{
					radiusMm: 150,
					wallSegments: [
						{ end: { xMm: 0, zMm: 100 }, start: { xMm: 0, zMm: -100 } },
					],
				},
			),
		).toEqual({ xMm: 100, zMm: 0 });
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 140, zMm: 0 },
				{
					radiusMm: 20,
					wallSegments: [
						{ end: { xMm: 150, zMm: 20 }, start: { xMm: 150, zMm: 10 } },
					],
				},
			),
		).toEqual({ xMm: 100, zMm: 0 });
	});

	it("ignores parallel, unsafe and opposite-side out-of-body wall contacts", () => {
		const expected = { xMm: 100, zMm: 0 };
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 140, zMm: 0 },
				{
					radiusMm: 20,
					wallSegments: [
						{ end: { xMm: 200, zMm: 10 }, start: { xMm: 100, zMm: 10 } },
					],
				},
			),
		).toEqual(expected);
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 140, zMm: 0 },
				{
					radiusMm: 20,
					wallSegments: [
						{
							end: { xMm: Number.POSITIVE_INFINITY, zMm: 20 },
							start: { xMm: 150, zMm: -20 },
						},
					],
				},
			),
		).toEqual(expected);
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 140, zMm: 0 },
				{
					radiusMm: 20,
					wallSegments: [
						{ end: { xMm: 150, zMm: -10 }, start: { xMm: 150, zMm: -20 } },
					],
				},
			),
		).toEqual(expected);
	});

	it("joins a cardinal draft to the exact integer contact on a diagonal wall", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 500, zMm: 0 },
				{ xMm: 502, zMm: 520 },
				{
					radiusMm: 50,
					wallSegments: [
						{
							end: { xMm: 1000, zMm: 1050 },
							start: { xMm: 0, zMm: 50 },
						},
					],
				},
			),
		).toEqual({ xMm: 500, zMm: 550 });
	});

	it("keeps exact endpoint contacts and reversed wall orientation eligible", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 500, zMm: 0 },
				{ xMm: 500, zMm: 520 },
				{
					radiusMm: 50,
					wallSegments: [
						{
							end: { xMm: 500, zMm: 550 },
							start: { xMm: 1000, zMm: 1050 },
						},
					],
				},
			),
		).toEqual({ xMm: 500, zMm: 550 });
		expect(
			snapWallDraftEnd(
				{ xMm: 500, zMm: 0 },
				{ xMm: 500, zMm: 520 },
				{
					radiusMm: 50,
					wallSegments: [
						{
							end: { xMm: 1000, zMm: 1050 },
							start: { xMm: 500, zMm: 550 },
						},
					],
				},
			),
		).toEqual({ xMm: 500, zMm: 550 });
	});

	it("keeps the grid candidate when two diagonals meet only at a half-millimetre", () => {
		expect(
			snapConstrainedWallDraftEnd(
				{ xMm: 0, zMm: 1 },
				{ xMm: 480, zMm: 481 },
				{
					radiusMm: 100,
					wallSegments: [
						{
							end: { xMm: 1000, zMm: 0 },
							start: { xMm: 0, zMm: 1000 },
						},
					],
				},
			),
		).toEqual({ direction: "SE", end: { xMm: 500, zMm: 501 } });
	});

	it("joins a diagonal draft to an exact existing wall-body contact", () => {
		expect(
			snapConstrainedWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 530, zMm: 530 },
				{
					radiusMm: 40,
					wallSegments: [
						{ end: { xMm: 1000, zMm: 550 }, start: { xMm: 0, zMm: 550 } },
					],
				},
			),
		).toEqual({ direction: "SE", end: { xMm: 550, zMm: 550 } });
	});

	it.each([
		["NE", { xMm: 0, zMm: 1000 }, { xMm: 530, zMm: 470 }],
		["NW", { xMm: 1000, zMm: 1000 }, { xMm: 470, zMm: 470 }],
		["SW", { xMm: 1000, zMm: 0 }, { xMm: 470, zMm: 530 }],
		["SE", { xMm: 0, zMm: 0 }, { xMm: 530, zMm: 530 }],
	] as const)(
		"joins the %s diagonal ray to the exact wall-body contact",
		(direction, start, candidate) => {
			expect(
				snapConstrainedWallDraftEnd(start, candidate, {
					radiusMm: 40,
					wallSegments: [
						{ end: { xMm: 1000, zMm: 500 }, start: { xMm: 0, zMm: 500 } },
					],
				}),
			).toEqual({ direction, end: { xMm: 500, zMm: 500 } });
		},
	);

	it("does not snap a diagonal draft to a nearby off-direction vertex", () => {
		expect(
			snapConstrainedWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 530, zMm: 530 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 550, zMm: 500 }],
					wallSegments: [],
				},
			),
		).toEqual({ direction: "SE", end: { xMm: 500, zMm: 500 } });
	});

	it("rejects an invalid construction step before considering an exact corner", () => {
		expect(
			snapConstrainedWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 100, zMm: 0 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 100, zMm: 0 }],
					wallSegments: [],
				},
				0,
			),
		).toBeUndefined();
	});

	it("magnetically finishes at a nearby aligned wall endpoint", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 0, zMm: 0 },
				{ xMm: 4040, zMm: 55 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 4100, zMm: 0 }],
					wallSegments: [],
				},
			),
		).toEqual({ xMm: 4100, zMm: 0 });
	});

	it("keeps a free endpoint on the relative grid when no join target is nearby", () => {
		expect(
			snapWallDraftEnd(
				{ xMm: 4100, zMm: 0 },
				{ xMm: 4960, zMm: 40 },
				{ radiusMm: 100, wallSegments: [] },
			),
		).toEqual({ xMm: 5000, zMm: 0 });
	});

	it("exposes a dashed construction guide only when magnetic alignment changed the endpoint", () => {
		expect(
			wallDraftAlignmentGuide(
				{ xMm: 0, zMm: 1500 },
				{ xMm: 4040, zMm: 1502 },
				{ xMm: 4100, zMm: 1500 },
				{
					radiusMm: 100,
					wallSegments: [
						{ end: { xMm: 4100, zMm: 3000 }, start: { xMm: 4100, zMm: 0 } },
					],
				},
			),
		).toEqual({ from: { xMm: 4040, zMm: 1502 }, to: { xMm: 4100, zMm: 1500 } });
		expect(
			wallDraftAlignmentGuide(
				{ xMm: 0, zMm: 0 },
				{ xMm: 5000, zMm: 0 },
				{ xMm: 5000, zMm: 0 },
			),
		).toBeUndefined();
		expect(
			wallDraftAlignmentGuide(
				{ xMm: 0, zMm: 0 },
				{ xMm: 960, zMm: 40 },
				{ xMm: 1000, zMm: 0 },
				{ radiusMm: 100, wallSegments: [] },
			),
		).toBeUndefined();
		expect(
			wallDraftAlignmentGuide(
				{ xMm: 0, zMm: 0 },
				{ xMm: 1000, zMm: 1000 },
				{ xMm: 1000, zMm: 1000 },
				{
					radiusMm: 100,
					vertices: [{ xMm: 1000, zMm: 1000 }],
					wallSegments: [],
				},
			),
		).toBeUndefined();
	});

	it("shows a guide for a real vertex join even when one raw coordinate already matches", () => {
		const options = {
			radiusMm: 100,
			vertices: [{ xMm: 1000, zMm: 1000 }],
			wallSegments: [],
		};
		expect(
			wallDraftAlignmentGuide(
				{ xMm: 0, zMm: 0 },
				{ xMm: 1000, zMm: 900 },
				{ xMm: 1000, zMm: 1000 },
				options,
			),
		).toEqual({
			from: { xMm: 1000, zMm: 900 },
			to: { xMm: 1000, zMm: 1000 },
		});
		expect(
			wallDraftAlignmentGuide(
				{ xMm: 0, zMm: 0 },
				{ xMm: 900, zMm: 1000 },
				{ xMm: 1000, zMm: 1000 },
				options,
			),
		).toEqual({
			from: { xMm: 900, zMm: 1000 },
			to: { xMm: 1000, zMm: 1000 },
		});
	});

	it("does not claim a vertex or wall-body guide for coordinate-only coincidences", () => {
		expect(
			wallDraftAlignmentGuide(
				{ xMm: 0, zMm: 0 },
				{ xMm: 940, zMm: 940 },
				{ xMm: 1000, zMm: 1000 },
				{
					radiusMm: 100,
					vertices: [
						{ xMm: 1000, zMm: 2000 },
						{ xMm: 2000, zMm: 1000 },
					],
					wallSegments: [
						{ end: { xMm: 500, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
					],
				},
			),
		).toBeUndefined();
	});

	it("does not show a guide for a collinear point beyond either wall endpoint", () => {
		const wall = {
			end: { xMm: 500, zMm: 0 },
			start: { xMm: 0, zMm: 0 },
		};
		for (const snappedEnd of [
			{ xMm: -100, zMm: 0 },
			{ xMm: 1000, zMm: 0 },
		]) {
			expect(
				wallDraftAlignmentGuide(
					{ xMm: 0, zMm: 0 },
					{ xMm: snappedEnd.xMm + 10, zMm: 10 },
					snappedEnd,
					{ radiusMm: 100, wallSegments: [wall] },
				),
			).toBeUndefined();
		}
	});
});
