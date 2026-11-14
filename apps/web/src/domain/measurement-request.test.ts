import { describe, expect, it } from "@rstest/core";

import { configureRectangularRoom } from "./rectangular-room";
import { createInitialProject } from "./initial-project";
import { createParametricFloorItem } from "./parametric-item";
import { measureDistance } from "./measurement-request";

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
