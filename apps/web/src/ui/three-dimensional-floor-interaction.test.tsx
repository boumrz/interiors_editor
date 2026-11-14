import { describe, expect, it } from "@rstest/core";

import type { RectangularRoomWebGlScene } from "../adapters/renderer/rectangular-room-projection";
import { initialThreeDimensionalViewport } from "./three-dimensional-viewport";
import {
	canvasPointForFloor,
	floorItemAtScreenPoint,
	floorItemAtPoint,
	floorPointForCanvas,
	projectedItemFootprintFor,
	roomIdAtFloorPoint,
} from "./three-dimensional-floor-interaction";

const scene: RectangularRoomWebGlScene = {
	cameraBounds: { centerXM: 2, centerZM: 1.5, depthM: 3, widthM: 4 },
	dimensions: { depthMm: 3000, heightMm: 2600, widthMm: 4000 },
	floors: [],
	items: [
		{
			assetInstanceId: "item-1",
			centerXM: 2,
			centerYM: 0.375,
			centerZM: 1.5,
			depthM: 0.8,
			heightM: 0.75,
			widthM: 1.2,
		},
	],
	walls: [],
};

describe("three-dimensional floor interaction", () => {
	it("round-trips a floor point through the live camera projection", () => {
		const size = { height: 600, width: 800 };
		const projected = canvasPointForFloor(
			scene,
			initialThreeDimensionalViewport,
			size,
			{ xM: 2, zM: 1.5 },
		);
		if (!projected) throw new Error("Expected an on-screen point");

		expect(
			floorPointForCanvas(
				scene,
				initialThreeDimensionalViewport,
				size,
				projected,
			),
		).toEqual(
			expect.objectContaining({
				xM: expect.closeTo(2, 4),
				zM: expect.closeTo(1.5, 4),
			}),
		);
	});

	it("hits only the directly tapped projected item footprint", () => {
		expect(
			floorItemAtPoint(scene.items, { xM: 2, zM: 1.5 })?.assetInstanceId,
		).toBe("item-1");
		expect(floorItemAtPoint(scene.items, { xM: 3.5, zM: 2.5 })).toBeUndefined();
	});

	it("gives an unselected item a forgiving first-tap target across its visible footprint", () => {
		const size = { height: 600, width: 800 };
		const projected = canvasPointForFloor(
			scene,
			initialThreeDimensionalViewport,
			size,
			{ xM: 2, zM: 1.5 },
		);
		if (!projected) throw new Error("Expected an on-screen item centre");

		expect(
			floorItemAtScreenPoint(
				scene.items,
				scene,
				initialThreeDimensionalViewport,
				size,
				{ x: projected.x + 55, y: projected.y - 40 },
			)?.assetInstanceId,
		).toBe("item-1");
		expect(
			floorItemAtScreenPoint(
				scene.items,
				scene,
				initialThreeDimensionalViewport,
				size,
				{ x: projected.x + 260, y: projected.y - 180 },
			),
		).toBeUndefined();
	});

	it("projects the four canonical corners of a rotated selected item in perimeter order", () => {
		const item = {
			...scene.items[0],
			centerXM: 2,
			centerZM: 1.5,
			yawRadians: Math.PI / 4,
		};
		if (!item) throw new Error("Expected an item fixture");

		const footprint = projectedItemFootprintFor(
			item,
			scene,
			initialThreeDimensionalViewport,
			{ height: 600, width: 800 },
		);
		if (!footprint) throw new Error("Expected every visible item corner");

		expect(footprint).toHaveLength(4);
		const canonicalCorners = [
			{ xM: 1.2928932188, zM: 1.6414213562 },
			{ xM: 2.1414213562, zM: 0.7928932188 },
			{ xM: 2.7071067812, zM: 1.3585786438 },
			{ xM: 1.8585786438, zM: 2.2071067812 },
		];
		for (const [index, corner] of canonicalCorners.entries()) {
			const projectedCorner = footprint[index];
			if (!projectedCorner) throw new Error("Expected a projected corner");
			const roundTripped = floorPointForCanvas(
				scene,
				initialThreeDimensionalViewport,
				{ height: 600, width: 800 },
				projectedCorner,
			);
			expect(roundTripped).toEqual(
				expect.objectContaining({
					xM: expect.closeTo(corner.xM, 4),
					zM: expect.closeTo(corner.zM, 4),
				}),
			);
		}
	});

	it("does not create a partial selection frame when the overlay has no canvas size", () => {
		const item = scene.items[0];
		if (!item) throw new Error("Expected an item fixture");

		expect(
			projectedItemFootprintFor(
				item,
				scene,
				initialThreeDimensionalViewport,
				{ height: 0, width: 800 },
			),
		).toBeUndefined();
	});

	it("resolves a tapped 3D floor tile to its stable derived Room id, never to a mesh index", () => {
		const floors: RectangularRoomWebGlScene["floors"] = [
			{
				centerXM: 1,
				centerYM: 0,
				centerZM: 1,
				depthM: 2,
				floor: { roomId: "room-left" },
				heightM: 0.04,
				widthM: 2,
			},
			{
				centerXM: 3,
				centerYM: 0,
				centerZM: 1,
				depthM: 2,
				floor: { roomId: "room-right" },
				heightM: 0.04,
				widthM: 2,
			},
		];

		expect(roomIdAtFloorPoint(floors, { xM: 0.5, zM: 1 })).toBe("room-left");
		expect(roomIdAtFloorPoint(floors, { xM: 3.5, zM: 1 })).toBe("room-right");
		expect(roomIdAtFloorPoint(floors, { xM: 4.5, zM: 1 })).toBeUndefined();
	});
});
