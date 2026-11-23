import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { ItemWallDistanceFields } from "./ItemWallDistances";
import type { DerivedOrthogonalRoomFace } from "../domain/derived-orthogonal-plan-faces";
import { itemWallDistancePositionFor, itemWallDistancesFor } from "./item-wall-distances";

const room: DerivedOrthogonalRoomFace = {
	boundaryWallSegmentIds: [],
	faceTilesMm: [],
	heightMm: 2600,
	roomId: "room",
	usableFloorAreaMm2: 12_000_000,
	usableFloorPerimeterMm: 14_000,
	usableFloorTilesMm: [{ minXmm: 0, maxXmm: 4000, minZmm: 0, maxZmm: 3000 }],
};
const item = { xMm: 1000, zMm: 1000, widthMm: 1000, depthMm: 500 };

describe("exact item wall clearance", () => {
	it.each([
		["left", 700, { xMm: 1200, zMm: 1000 }],
		["right", 0, { xMm: 3500, zMm: 1000 }],
		["top", 733, { xMm: 1000, zMm: 983 }],
		["bottom", 1001, { xMm: 1000, zMm: 1749 }],
	] as const)("changes only the %s axis to give the entered value", (side, value, expected) => {
		const result = itemWallDistancePositionFor([room], item, side, value);
		expect(result).toEqual({ roomId: room.roomId, ...expected });
		expect(itemWallDistancesFor([room], { ...item, ...expected }).find((entry) => entry.side === side)?.distanceMm).toBe(value);
	});

	it("keeps an unchanged displayed value stationary for a rotated item", () => {
		const rotated = { ...item, yawStep: 1 as const };
		const original = itemWallDistancesFor([room], rotated).find((entry) => entry.side === "left");
		expect(original).toBeDefined();
		expect(itemWallDistancePositionFor([room], rotated, "left", Math.round(original?.distanceMm ?? -1))).toEqual({
			roomId: room.roomId, xMm: item.xMm, zMm: item.zMm,
		});
	});

	it("rejects invalid input and a target that would cross a boundary", () => {
		for (const value of [-1, 0.5, 4500, Infinity]) {
			expect(itemWallDistancePositionFor([room], item, "left", value)).toBeUndefined();
		}
		expect(itemWallDistancePositionFor([], item, "left", 700)).toBeUndefined();
	});

	it("does not jump across a gap in the room cross-section", () => {
		const split = { ...room, usableFloorTilesMm: [...room.usableFloorTilesMm, {
			minXmm: 5000, maxXmm: 7000, minZmm: 0, maxZmm: 3000,
		}] };
		expect(itemWallDistancePositionFor([split], item, "left", 5200)).toBeUndefined();
	});
});

it("offers four named fields with their current values and a shared unit", () => {
	const html = renderToStaticMarkup(
		<ItemWallDistanceFields distances={itemWallDistancesFor([room], item)} onApply={() => true} />,
	);
	expect(html).toContain('aria-label="Слева, мм"');
	expect(html).toContain('aria-label="Справа, мм"');
	expect(html).toContain('aria-label="Сверху, мм"');
	expect(html).toContain('aria-label="Снизу, мм"');
	for (const value of [500, 2500, 750, 1750]) expect(html).toContain(`value="${value}"`);
});
