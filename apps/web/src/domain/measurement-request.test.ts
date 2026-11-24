import { describe, expect, it } from "@rstest/core";

import { configureRectangularRoom } from "./rectangular-room";
import { createInitialProject } from "./initial-project";
import { createParametricFloorItem } from "./parametric-item";
import { measureDistance, measureFloorItemClearance } from "./measurement-request";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function fixtureProject() {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-28T20:00:00.000Z",
			levelId: "level-1",
			name: "Измерения",
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
		"2026-08-28T20:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected a rectangular measurement fixture");
	}
	const placed = createParametricFloorItem(
		configured.project,
		{
			color: "#a76a3b",
			depthMm: 500,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1000,
			xMm: 1000,
			zMm: 1500,
		},
		ids("item-1"),
		"2026-08-28T20:02:00.000Z",
	);
	if (placed.kind !== "accepted") {
		throw new Error("Expected a placed floor item");
	}
	return placed.project;
}

describe("revision-bound item footprint measurements", () => {
	it("measures the closest canonical footprint-to-wall distance without a mutation", () => {
		const project = fixtureProject();

		expect(
			measureDistance(project, {
				baseRevisionChecksum: "checksum-1",
				baseRevisionId: "revision-1",
				operation: "Distance",
				projectId: project.projectId,
				targets: [
					{ assetInstanceId: "item-1", kind: "ItemFootprintBoundary" },
					{ kind: "WallCenterline", wallSegmentId: "wall-4" },
				],
			}, {
				checksum: "checksum-1",
				projectId: project.projectId,
				revisionId: "revision-1",
			}),
		).toEqual({
			closestSourcePointMm: { xMm: 500, zMm: 1250 },
			closestTargetPointMm: { xMm: 0, zMm: 1250 },
			distanceMm: 500,
			kind: "measured",
		});
	});

	it("fails closed as stale instead of retargeting a measurement to a later revision", () => {
		const project = fixtureProject();

		expect(
			measureDistance(project, {
				baseRevisionChecksum: "checksum-1",
				baseRevisionId: "revision-1",
				operation: "Distance",
				projectId: project.projectId,
				targets: [
					{ assetInstanceId: "item-1", kind: "ItemFootprintBoundary" },
					{ kind: "WallCenterline", wallSegmentId: "wall-4" },
				],
			}, {
				checksum: "checksum-2",
				projectId: project.projectId,
				revisionId: "revision-2",
			}),
		).toEqual({ kind: "stale" });
	});
});

const wardrobe = { xMm: 800, zMm: 1600, widthMm: 600, depthMm: 1200 };
const bed = { xMm: 2700, zMm: 2000, widthMm: 1600, depthMm: 2000 };
const rectangularFloor = [
	{ xMm: 0, zMm: 0 },
	{ xMm: 6000, zMm: 0 },
	{ xMm: 6000, zMm: 4000 },
	{ xMm: 0, zMm: 4000 },
];

describe("draft furniture clearance", () => {
	it("measures the selected pair before and after an exact move or rotation", () => {
		const initial = measureFloorItemClearance(wardrobe, bed, rectangularFloor, []);
		expect(initial).toEqual({
			kind: "gap",
			distanceMm: 800,
			start: { xMm: 1100, zMm: 1000 },
			end: { xMm: 1900, zMm: 1000 },
		});
		expect(measureFloorItemClearance({ ...wardrobe, xMm: 1000 }, bed, rectangularFloor, [])).toMatchObject({
			kind: "gap", distanceMm: 600,
		});
		expect(measureFloorItemClearance({ ...wardrobe, yawMilliDeg: 90_000 }, bed, rectangularFloor, [])).toMatchObject({
			kind: "gap", distanceMm: 500,
		});
		const rotated = measureFloorItemClearance({ ...wardrobe, yawMilliDeg: 37_500 }, bed, rectangularFloor, []);
		expect(rotated.kind).toBe("gap");
		if (rotated.kind === "gap") expect(Math.round(rotated.distanceMm)).toBe(497);
	});

	it("distinguishes contact, overlap, containment, and less than a millimetre", () => {
		expect(measureFloorItemClearance({ ...wardrobe, xMm: 1600 }, bed, rectangularFloor, []).kind).toBe("touch");
		expect(measureFloorItemClearance({ ...wardrobe, xMm: 1601 }, bed, rectangularFloor, []).kind).toBe("overlap");
		expect(measureFloorItemClearance({ ...wardrobe, xMm: 2700, zMm: 2200 }, bed, rectangularFloor, []).kind).toBe("overlap");
		const near = { ...wardrobe, widthMm: 601, xMm: 1599 };
		expect(measureFloorItemClearance(near, bed, rectangularFloor, [])).toMatchObject({ kind: "gap", distanceMm: 0.5 });
	});

	it("marks an obstruction across the selected segment, including an outlet from a concave room", () => {
		const obstacle = { xMm: 1500, zMm: 1000, widthMm: 300, depthMm: 200 };
		expect(measureFloorItemClearance(wardrobe, bed, rectangularFloor, [obstacle]).kind).toBe("blocked");
		expect(measureFloorItemClearance(wardrobe, bed, rectangularFloor, [{ ...obstacle, zMm: 400 }]).kind).toBe("gap");
		const cutoutFloor = [
			{ xMm: 0, zMm: 0 }, { xMm: 1250, zMm: 0 },
			{ xMm: 1250, zMm: 1500 }, { xMm: 1750, zMm: 1500 },
			{ xMm: 1750, zMm: 0 }, { xMm: 6000, zMm: 0 },
			{ xMm: 6000, zMm: 4000 }, { xMm: 0, zMm: 4000 },
		];
		expect(measureFloorItemClearance(wardrobe, bed, cutoutFloor, []).kind).toBe("blocked");
	});

	it("measures a diagonal as Euclidean distance between facing corners", () => {
		const first = { xMm: 500, zMm: 500, widthMm: 200, depthMm: 200 };
		const second = { ...first, xMm: 1000, zMm: 1100 };
		expect(measureFloorItemClearance(first, second, rectangularFloor, [])).toMatchObject({ kind: "gap", distanceMm: 500 });
	});
});

it("requires two available contours and a usable floor", () => {
	const missing = { kind: "target-unavailable" };
	const invalid = { ...bed, zMm: Number.NaN };
	expect(measureFloorItemClearance(wardrobe, invalid, rectangularFloor, [])).toEqual(missing);
	expect(measureFloorItemClearance(invalid, bed, rectangularFloor, [])).toEqual(missing);
	expect(measureFloorItemClearance(wardrobe, bed, [], [])).toEqual(missing);
	expect(measureFloorItemClearance(wardrobe, bed, rectangularFloor.filter((_, index) => index !== 2), []).kind).toBe("gap");
});

it("uses the rotated bounds of a third item and excludes endpoint-only contact", () => {
	const first = { xMm: 500, zMm: 500, widthMm: 200, depthMm: 200 };
	const second = { ...first, xMm: 1000, zMm: 1100 };
	const onLine = { ...first, xMm: 750, zMm: 800, widthMm: 20, depthMm: 300, yawMilliDeg: 37_500 };
	const beyondEnd = { ...first, xMm: 1000, zMm: 1100 };
	const nearEnd = { ...first, xMm: 900, zMm: 1000, widthMm: 5, depthMm: 5 };
	const away = { ...onLine, zMm: 1100, depthMm: 100 };
	expect(measureFloorItemClearance(first, second, rectangularFloor, [onLine]).kind).toBe("blocked");
	expect(measureFloorItemClearance(first, second, rectangularFloor, [beyondEnd]).kind).toBe("gap");
	expect(measureFloorItemClearance(first, second, rectangularFloor, [nearEnd]).kind).toBe("blocked");
	expect(measureFloorItemClearance(first, second, rectangularFloor, [away]).kind).toBe("gap");
});
