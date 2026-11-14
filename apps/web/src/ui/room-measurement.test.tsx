import { describe, expect, it } from "@rstest/core";

import { roomMeasurementFor } from "./room-measurement";

describe("roomMeasurementFor", () => {
	it("derives readable inner dimensions, area and perimeter from the usable room projection", () => {
		expect(
			roomMeasurementFor({
				boundaryWallSegmentIds: ["wall-1", "wall-2", "wall-3", "wall-4"],
				faceTilesMm: [{ maxXmm: 4100, maxZmm: 3100, minXmm: 0, minZmm: 0 }],
				heightMm: 2600,
				roomId: "room-1",
				usableFloorAreaMm2: 12_000_000,
				usableFloorPerimeterMm: 14_000,
				usableFloorTilesMm: [
					{ maxXmm: 4050, maxZmm: 3050, minXmm: 50, minZmm: 50 },
				],
			}),
		).toEqual({
			areaMm2: 12_000_000,
			centerXMm: 2050,
			centerZMm: 1550,
			depthMm: 3000,
			heightMm: 2600,
			kind: "rectangular",
			perimeterMm: 14_000,
			widthMm: 4000,
		});
	});

	it("does not invent a rectangular width and depth for a non-rectangular room decomposition", () => {
		expect(
			roomMeasurementFor({
				boundaryWallSegmentIds: ["wall-1"],
				faceTilesMm: [],
				heightMm: 2600,
				roomId: "room-l",
				usableFloorAreaMm2: 1,
				usableFloorPerimeterMm: 1,
				usableFloorTilesMm: [
					{ maxXmm: 1000, maxZmm: 1000, minXmm: 0, minZmm: 0 },
					{ maxXmm: 2000, maxZmm: 1000, minXmm: 1000, minZmm: 500 },
				],
			}),
		).toBeUndefined();
	});

	it("derives exact area and perimeter from a concave usable polygon without inventing rectangular dimensions", () => {
		expect(
			roomMeasurementFor({
				boundaryWallSegmentIds: [
					"wall-1",
					"wall-2",
					"wall-3",
					"wall-4",
					"wall-5",
					"wall-6",
				],
				facePolygonMm: [
					{ xMm: 0, zMm: 0 },
					{ xMm: 0, zMm: 4000 },
					{ xMm: 2000, zMm: 4000 },
					{ xMm: 2000, zMm: 2000 },
					{ xMm: 4000, zMm: 2000 },
					{ xMm: 4000, zMm: 0 },
				],
				faceTilesMm: [],
				heightMm: 2600,
				roomId: "room-l",
				usableFloorAreaMm2: 11_210_000,
				usableFloorPerimeterMm: 15_600,
				usableFloorPolygonMm: [
					{ xMm: 50, zMm: 50 },
					{ xMm: 50, zMm: 3950 },
					{ xMm: 1950, zMm: 3950 },
					{ xMm: 1950, zMm: 1950 },
					{ xMm: 3950, zMm: 1950 },
					{ xMm: 3950, zMm: 50 },
				],
				usableFloorTilesMm: [],
			}),
		).toEqual({
			areaMm2: 11_210_000,
			centerXMm: 1661.0169491525423,
			centerZMm: 1661.0169491525423,
			heightMm: 2600,
			kind: "polygonal",
			perimeterMm: 15_600,
		});
	});

	it("keeps exact half-millimetre derived measurements for odd and unequal wall thicknesses", () => {
		expect(
			roomMeasurementFor({
				boundaryWallSegmentIds: ["wall-1", "wall-2", "wall-3", "wall-4"],
				faceTilesMm: [{ maxXmm: 4000, maxZmm: 3000, minXmm: 0, minZmm: 0 }],
				heightMm: 2600,
				roomId: "room-odd",
				usableFloorAreaMm2: 11_305_150.5,
				usableFloorPerimeterMm: 13_597,
				usableFloorTilesMm: [
					{ maxXmm: 3949.5, maxZmm: 2949.5, minXmm: 50.5, minZmm: 50 },
				],
			}),
		).toEqual({
			areaMm2: 11_305_150.5,
			centerXMm: 2000,
			centerZMm: 1499.75,
			depthMm: 2899.5,
			heightMm: 2600,
			kind: "rectangular",
			perimeterMm: 13_597,
			widthMm: 3899,
		});
	});

	it("keeps fractional square millimetres for an odd-thickness polygon projection", () => {
		expect(
			roomMeasurementFor({
				boundaryWallSegmentIds: ["wall-1", "wall-2", "wall-3", "wall-4"],
				facePolygonMm: [
					{ xMm: 0, zMm: 0 },
					{ xMm: 4, zMm: 0 },
					{ xMm: 4, zMm: 4 },
					{ xMm: 0, zMm: 4 },
				],
				faceTilesMm: [],
				heightMm: 2600,
				roomId: "room-odd-polygon",
				usableFloorAreaMm2: 12.25,
				usableFloorPerimeterMm: 14,
				usableFloorPolygonMm: [
					{ xMm: 0.5, zMm: 0 },
					{ xMm: 4, zMm: 0 },
					{ xMm: 4, zMm: 3.5 },
					{ xMm: 0.5, zMm: 3.5 },
				],
				usableFloorTilesMm: [],
			}),
		).toEqual({
			areaMm2: 12.25,
			centerXMm: 2.25,
			centerZMm: 1.75,
			heightMm: 2600,
			kind: "polygonal",
			perimeterMm: 14,
		});
	});

	it("rejects zero and unsafe presentation extents instead of drawing a misleading label", () => {
		const room = (tile: {
			readonly maxXmm: number;
			readonly maxZmm: number;
			readonly minXmm: number;
			readonly minZmm: number;
		}) =>
			roomMeasurementFor({
				boundaryWallSegmentIds: ["wall-1"],
				faceTilesMm: [tile],
				heightMm: 2600,
				roomId: "room-invalid",
				usableFloorAreaMm2: 1,
				usableFloorPerimeterMm: 1,
				usableFloorTilesMm: [tile],
			});
		expect(
			room({ maxXmm: 0, maxZmm: 1000, minXmm: 0, minZmm: 0 }),
		).toBeUndefined();
		expect(
			room({ maxXmm: 1000, maxZmm: 0, minXmm: 0, minZmm: 0 }),
		).toBeUndefined();
		expect(
			room({
				maxXmm: Number.MAX_SAFE_INTEGER,
				maxZmm: 2,
				minXmm: 0,
				minZmm: 0,
			}),
		).toBeUndefined();
	});
});
