import { describe, expect, it } from "@rstest/core";

import {
	assetPlacementHostKind,
	isStableAssetPlacement,
	type StableAssetPlacement,
} from "./asset-placement";

describe("stable asset placement contract", () => {
	it("accepts only integer-mm room or semantic-wall host addresses", () => {
		const floor = {
			anchorClass: "floor",
			elevationMm: 0,
			roomId: "room-1",
			xMm: 1800,
			zMm: 1200,
		} satisfies StableAssetPlacement;
		const wall = {
			anchorClass: "wall",
			elevationMm: 1450,
			offsetMm: 1800,
			side: "left",
			wallSegmentId: "wall-1",
		} satisfies StableAssetPlacement;

		expect(isStableAssetPlacement(floor)).toBe(true);
		expect(isStableAssetPlacement(wall)).toBe(true);
		expect(isStableAssetPlacement({ ...wall, side: "right" })).toBe(true);
		expect(assetPlacementHostKind(floor)).toBe("room");
		expect(assetPlacementHostKind(wall)).toBe("wall");
	});

	it("refuses free renderer transforms, non-integer positions and ambiguous wall sides", () => {
		expect(
			isStableAssetPlacement({
				anchorClass: "wall",
				offsetMm: 1800,
				side: "left",
				wallSegmentId: "wall-1",
			}),
		).toBe(false);
		expect(
			isStableAssetPlacement({
				anchorClass: "wall",
				elevationMm: 1450,
				offsetMm: 1800,
				side: "left",
			}),
		).toBe(false);
		expect(
			isStableAssetPlacement({
				anchorClass: "wall",
				elevationMm: 1450,
				offsetMm: 1800,
				side: "front",
				wallSegmentId: "wall-1",
			}),
		).toBe(false);
		expect(
			isStableAssetPlacement({
				anchorClass: "ceiling",
				dropMm: 200,
				roomId: "room-1",
				xMm: 1800,
				zMm: 1200,
			}),
		).toBe(false);
		expect(
			isStableAssetPlacement({
				anchorClass: "wall",
				elevationMm: 1450,
				offsetMm: 1800,
				side: "left",
				wallSegmentId: "wall-1",
				worldX: 3.2,
			}),
		).toBe(false);
	});
});
