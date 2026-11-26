import { describe, expect, it } from "@rstest/core";

import type { RectangularRoomWebGlScene } from "../adapters/renderer/rectangular-room-projection";
import { cameraEyeAndTargetFor } from "../adapters/renderer/webgl2-room-renderer-shared";
import { initialThreeDimensionalViewport } from "./three-dimensional-viewport";
import {
	canvasPointForFloor,
	canvasPointForWorld,
	floorItemAtScreenPoint,
	floorItemAtPoint,
	floorPointForCanvas,
	projectedItemFootprintFor,
	roomIdAtFloorPoint,
	supportSurfaceAtCanvasPoint,
	visibleRoomFloorAtCanvasPoint,
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
	it("targets only an exposed room floor, excluding an opaque wall, occupied point and concave notch", () => {
		const size = { width: 360, height: 650 };
		const camera = initialThreeDimensionalViewport;
		const floor = { floor: { roomId: "room" }, heightM: 0.08, vertices: [
			{ xM: 0, zM: 0 }, { xM: 4, zM: 0 }, { xM: 4, zM: 1.5 },
			{ xM: 2, zM: 1.5 }, { xM: 2, zM: 3 }, { xM: 0, zM: 3 },
		] };
		const fixture = { ...scene, floorPolygons: [floor] };
		const point = { xM: 1.4, zM: 2 };
		const contact = canvasPointForFloor(fixture, camera, size, point);
		const notch = canvasPointForFloor(fixture, camera, size, { xM: 3, zM: 2.2 });
		if (!contact || !notch) throw new Error("Expected both floor positions in view");
		const { eye } = cameraEyeAndTargetFor(fixture, camera);
		const distanceM = Math.hypot(eye[0] - point.xM, eye[1], eye[2] - point.zM);
		const pick = (hit?: { distanceM: number; assetInstanceId?: string }) => visibleRoomFloorAtCanvasPoint(fixture, camera, size, contact, hit);
		expect(pick()).toMatchObject({ roomId: "room", xM: expect.closeTo(point.xM, 6), zM: expect.closeTo(point.zM, 6) });
		expect(pick({ distanceM })).toBeDefined();
		expect(pick({ distanceM, assetInstanceId: "book" })).toBeUndefined();
		expect(pick({ distanceM: distanceM - 0.02 })).toBeUndefined();
		expect(pick({ distanceM: distanceM - 0.2, assetInstanceId: "chair" })).toBeUndefined();
		expect(visibleRoomFloorAtCanvasPoint(fixture, camera, size, notch, undefined)).toBeUndefined();
		expect(visibleRoomFloorAtCanvasPoint(scene, camera, size, contact, undefined)).toBeUndefined();
		const tile = { widthM: 1, depthM: 1, heightM: 0.04, centerXM: 1.4, centerYM: 0, centerZM: 2 };
		expect(visibleRoomFloorAtCanvasPoint({ ...scene, floors: [tile] }, camera, size, contact, undefined)).toBeUndefined();
		expect(visibleRoomFloorAtCanvasPoint({ ...scene, floors: [{ ...tile, floor: { roomId: "room" } }] }, camera, size, contact, undefined))
			.toMatchObject({ roomId: "room", xM: expect.closeTo(point.xM, 6), zM: expect.closeTo(point.zM, 6) });
		expect(visibleRoomFloorAtCanvasPoint(fixture, camera, { width: 0, height: size.height }, contact, undefined)).toBeUndefined();
	});

	it("resolves a diagonal usable floor among unrelated room faces", () => {
		const size = { width: 360, height: 650 };
		const camera = initialThreeDimensionalViewport;
		const fixture = { ...scene, floorPolygons: [
			{ floor: { roomId: "unrelated" }, heightM: 0.04, vertices: [] },
			{ floor: { roomId: "diagonal" }, heightM: 0.04, vertices: [{ xM: 1, zM: 1 }, { xM: 3, zM: 1 }, { xM: 1, zM: 3 }] },
		] };
		const tap = (xM: number, zM: number) => {
			const point = canvasPointForFloor(fixture, camera, size, { xM, zM });
			if (!point) throw new Error("Expected on-screen contact");
			return visibleRoomFloorAtCanvasPoint(fixture, camera, size, point, undefined);
		};
		expect(tap(1.15, 2.67)?.roomId).toBe("diagonal");
		expect(tap(1.81, 1.97)?.roomId).toBe("diagonal");
		expect(tap(1.91, 2.1)).toBeUndefined();
		expect(tap(0.85, 1.5)).toBeUndefined();
	});

	it("chooses the touched lower shelf at a close orbit and rejects occluding furniture or an outer edge", () => {
		const size = { width: 340, height: 640 };
		const camera = { ...initialThreeDimensionalViewport, azimuthRadians: Math.PI / 2, elevationRadians: 0.27, distance: 0.33 };
		const target = { x: 2.11, y: 0.6, z: 1.65 };
		const contact = canvasPointForWorld(scene, camera, size, target);
		if (!contact) throw new Error("Expected visible shelf contact");
		const { eye } = cameraEyeAndTargetFor(scene, camera);
		const distanceM = Math.hypot(eye[0] - target.x, eye[1] - target.y, eye[2] - target.z);
		const outline = [{xM: 1.7, zM: 1.27}, {xM: 2.3, zM: 1.27}, {xM: 2.3, zM: 1.73}, {xM: 1.7, zM: 1.73}];
		const lower = { hostId: "shelf", key: "shelf-2", heightM: 0.6, outline };
		const upper = { ...lower, key: "shelf-3", heightM: 0.9 };
		const pick = (hit: { assetInstanceId?: string; distanceM: number } | undefined, point = contact) =>
			supportSurfaceAtCanvasPoint(scene, camera, size, point, [upper, lower], hit);
		expect(pick({ assetInstanceId: "shelf", distanceM })).toEqual({
			surface: lower, point: { xM: expect.closeTo(2.11, 5), zM: expect.closeTo(1.65, 5) },
		});
		expect(pick(undefined)).toBeUndefined();
		expect(pick({ assetInstanceId: "shelf", distanceM: distanceM + 0.0005 })?.surface).toBe(lower);
		expect(pick({ assetInstanceId: "shelf", distanceM: distanceM - 0.012 })).toBeUndefined();
		expect(pick({ assetInstanceId: "book", distanceM })).toBeUndefined();
		expect(pick({ distanceM: distanceM - 0.05 })).toBeUndefined();
		const hit = { assetInstanceId: "shelf", distanceM };
		const outsideOutline = outline.map(({ xM, zM }) => ({ xM, zM: zM - 0.15 }));
		expect(supportSurfaceAtCanvasPoint(scene, camera, size, contact, [{ ...lower, outline: outsideOutline }], hit)).toBeUndefined();
		const edgeOutline = outline.map(({ xM, zM }) => ({ xM, zM: zM - 0.08 }));
		expect(supportSurfaceAtCanvasPoint(scene, camera, size, contact, [{ ...lower, outline: edgeOutline }], hit)?.surface.key).toBe("shelf-2");
		const underside = { ...target, y: 1.2 };
		const undersideContact = canvasPointForWorld(scene, camera, size, underside);
		if (!undersideContact) throw new Error("Expected shelf underside on camera");
		expect(supportSurfaceAtCanvasPoint(scene, camera, size, undersideContact, [{ ...upper, heightM: underside.y }], {
			assetInstanceId: "shelf", distanceM: Math.hypot(eye[0] - underside.x, eye[1] - underside.y, eye[2] - underside.z),
		})).toBeUndefined();
	});

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
