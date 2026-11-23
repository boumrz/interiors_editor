import { describe, expect, it } from "@rstest/core";
import { nearestWallAtPoint, wallHitPath } from "./editor-plan-presentation";

const walls = [
	{ wallSegmentId: "bottom", start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, targetWidth: 44 },
	{ wallSegmentId: "tail", start: { x: 100, y: 0 }, end: { x: 101, y: 0 }, targetWidth: 44 },
	{ wallSegmentId: "closer", start: { x: 100, y: 0 }, end: { x: 100, y: 100 }, targetWidth: 44 },
] as const;

describe("touch selection of exact wall fragments", () => {
	it.each([
		[{ x: 0, y: 0 }, { x: 1, y: 0 }],
		[{ x: 0, y: 0 }, { x: 0, y: -1 }],
		[{ x: 1, y: 1 }, { x: 0, y: 0 }],
		[{ x: 17, y: 23 }, { x: 20, y: 23 }],
		[{ x: 13, y: 21 }, { x: 13, y: 17 }],
		[{ x: 19, y: 25 }, { x: 17, y: 23 }],
	] as const)("keeps both touch dimensions at least 44 px for %j to %j", (start, end) => {
		const coordinates = (wallHitPath(start, end, 44).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
		const xs = coordinates.filter((_, index) => index % 2 === 0);
		const ys = coordinates.filter((_, index) => index % 2 === 1);
		expect(coordinates).toHaveLength(8);
		expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(44);
		expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(44);
		expect(Math.abs(xs.reduce((area, x, index) => area + x * ys[(index + 1) % 4] - ys[index] * xs[(index + 1) % 4], 0)) / 2).toBeCloseTo(44 * 44, 6);
		expect(xs.reduce((sum, x) => sum + x, 0) / 4).toBeCloseTo((start.x + end.x) / 2, 6);
		expect(ys.reduce((sum, y) => sum + y, 0) / 4).toBeCloseTo((start.y + end.y) / 2, 6);
	});

	it("keeps a long wall's endpoints exact while adding its full perpendicular touch width", () => {
		expect(wallHitPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 44)).toBe("M 0 22 L 100 22 L 100 -22 L 0 -22 Z");
	});
	it.each([
		[{ x: 100.5, y: 0 }, "tail"],
		[{ x: 110, y: -10 }, "tail"],
		[{ x: 50, y: 1 }, "bottom"],
		[{ x: 100, y: 50 }, "closer"],
	] as const)("chooses the closest real segment at %j regardless of paint order", (point, expected) => {
		expect(nearestWallAtPoint(point, walls)).toBe(expected);
		expect(nearestWallAtPoint(point, [...walls].reverse())).toBe(expected);
		expect(nearestWallAtPoint(point, walls, "closer")).toBe(expected);
		const translated = walls.map(wall => ({ ...wall, start: { x: wall.start.x - 300, y: wall.start.y + 400 }, end: { x: wall.end.x - 300, y: wall.end.y + 400 } }));
		expect(nearestWallAtPoint({ x: point.x - 300, y: point.y + 400 }, translated)).toBe(expected);
	});

	it("preserves the actual hit when real centerlines tie", () => {
		for (const wall of walls) expect(nearestWallAtPoint({ x: 100, y: 0 }, walls, wall.wallSegmentId)).toBe(wall.wallSegmentId);
	});

	it("includes the full target boundary and excludes points beyond it", () => {
		expect(nearestWallAtPoint({ x: 122.5, y: 22 }, [walls[1]])).toBe("tail");
		expect(nearestWallAtPoint({ x: 122.501, y: 22 }, [walls[1]])).toBeUndefined();
		expect(nearestWallAtPoint({ x: 122.5, y: 22.001 }, [walls[1]])).toBeUndefined();
		expect(nearestWallAtPoint({ x: -0.001, y: 0 }, [walls[0]])).toBeUndefined();
	});

	it("selects diagonal fragments and keeps their neighbours accessible", () => {
		const diagonal = { wallSegmentId: "diagonal", start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, targetWidth: 44 };
		expect(nearestWallAtPoint({ x: 0.5, y: 0.5 }, [walls[0], diagonal], "bottom")).toBe("diagonal");
		expect(nearestWallAtPoint({ x: 20, y: 0 }, [walls[0], diagonal])).toBe("bottom");
	});

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("ignores an invalid target width %s without a drawing or selectable wall", (targetWidth) => {
		expect(wallHitPath(walls[1].start, walls[1].end, targetWidth)).toBe("");
		expect(nearestWallAtPoint({ x: 100.5, y: 0 }, [{ ...walls[1], targetWidth }])).toBeUndefined();
	});

	it.each([Number.NaN, Number.POSITIVE_INFINITY])("does not turn an unavailable coordinate %s into a selection", (coordinate) => {
		expect(nearestWallAtPoint({ x: coordinate, y: 0 }, walls)).toBeUndefined();
		expect(nearestWallAtPoint({ x: 0, y: coordinate }, walls)).toBeUndefined();
	});

	it("ignores zero-length and unavailable segments", () => {
		for (const end of [{ x: 100, y: 0 }, { x: Number.NaN, y: 0 }]) {
			expect(wallHitPath(walls[1].start, end, 44)).toBe("");
			expect(nearestWallAtPoint({ x: 100, y: 0 }, [{ ...walls[1], end }])).toBeUndefined();
		}
		expect(nearestWallAtPoint({ x: 0, y: 0 }, [])).toBeUndefined();
	});
});
