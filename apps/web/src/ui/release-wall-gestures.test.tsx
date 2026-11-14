import { describe, expect, it } from "@rstest/core";
import { normalizeWallGestureDraft } from "./wall-draft";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { createInitialProject } from "../domain/initial-project";
import { addDoorOpeningToProject } from "../domain/door-opening-project";
import { addGeneralWallToProject } from "../domain/general-wall-project";
import {
	pinchEditorViewport,
	maximumEditorZoomForGrid,
} from "./editor-viewport";

const point = (xMm: number, zMm = 0) => ({ xMm, zMm });
const segment = (x1: number, z1: number, x2: number, z2: number) => ({
	start: point(x1, z1),
	end: point(x2, z2),
});

describe("release wall construction gestures", () => {
	it("preserves an explicit boundary endpoint while crossing interior partitions in either direction", () => {
		const walls = [
			segment(0, 0, 0, 3000),
			segment(2000, 0, 2000, 3000),
			segment(4000, 0, 4000, 3000),
		];
		expect(
			normalizeWallGestureDraft(point(0, 1500), point(4000, 1500), walls),
		).toEqual(segment(0, 1500, 4000, 1500));
		expect(
			normalizeWallGestureDraft(point(4000, 1500), point(0, 1500), walls),
		).toEqual(segment(4000, 1500, 0, 1500));
		expect(
			normalizeWallGestureDraft(point(0, 0), point(4000, 4000), [
				segment(2000, 0, 2000, 5000),
				segment(3000, 5000, 5000, 3000),
			]),
		).toEqual(segment(0, 0, 4000, 4000));
		// A distant segment on the same infinite line is not an intentional target.
		expect(
			normalizeWallGestureDraft(point(0, 1500), point(4000, 1500), [
				segment(2000, 0, 2000, 3000),
				segment(4000, 2000, 4000, 3000),
			]),
		).toEqual(segment(0, 1500, 2000, 1500));
	});
	it("submits the whole boundary-to-boundary crossbar to the domain to make four rooms", () => {
		let ordinal = 0;
		const ids = { next: () => `crossbar-id-${ordinal++}` };
		const base = createInitialProject({
			createdAt: "2026-11-01T00:00:00.000Z",
			levelId: "crossbar-level",
			name: "Crossbar",
			projectId: "crossbar",
		});
		const rectangle = configureRectangularRoom(
			base,
			{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
			ids,
			"2026-11-01T00:00:01.000Z",
		);
		if (rectangle.kind !== "accepted") throw new Error("rectangle");
		const divided = addGeneralWallToProject(
			rectangle.project,
			{ start: point(2050, 0), end: point(2050, 3100), thicknessMm: 100 },
			ids,
			"2026-11-01T00:00:02.000Z",
		);
		if (divided.kind !== "accepted") throw new Error(divided.reasonCode);
		expect(divided.project.level.rooms).toHaveLength(2);
		const vertices = new Map(
			divided.project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
		);
		const walls = divided.project.level.wallSegments.map((wall) => {
			const start = vertices.get(wall.startVertexId);
			const end = vertices.get(wall.endVertexId);
			if (!start || !end) throw new Error("wall endpoints");
			return { start, end };
		});
		const normalized = normalizeWallGestureDraft(
			point(0, 1550),
			point(4100, 1550),
			walls,
		);
		if (!normalized) throw new Error("crossbar");
		const result = addGeneralWallToProject(
			divided.project,
			{ ...normalized, thicknessMm: 100 },
			ids,
			"2026-11-01T00:00:03.000Z",
		);
		if (result.kind !== "accepted") throw new Error(result.reasonCode);
		expect(result.project.level.rooms).toHaveLength(4);
		expect(result.project.level.wallSegments).toHaveLength(12);
	});
	it("ignores collinear walls beyond the gesture and diagonal branches touching only the origin", () => {
		expect(
			normalizeWallGestureDraft(point(0), point(5000), [
				segment(6000, 0, 7000, 0),
			]),
		).toEqual(segment(0, 0, 5000, 0));
		expect(
			normalizeWallGestureDraft(point(0), point(5000), [
				segment(0, 0, 1000, 1000),
			]),
		).toEqual(segment(0, 0, 5000, 0));
	});
	it("sends only the free extension through full domain validation and preserves the existing opening host", () => {
		const ids = (() => {
			let ordinal = 0;
			return { next: () => `release-id-${ordinal++}` };
		})();
		const base = createInitialProject({
			createdAt: "2026-11-01T00:00:00.000Z",
			levelId: "level",
			name: "Host",
			projectId: "host",
		});
		const rectangle = configureRectangularRoom(
			base,
			{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
			ids,
			"2026-11-01T00:00:01.000Z",
		);
		if (rectangle.kind !== "accepted") throw new Error("rectangle");
		const wall = rectangle.project.level.wallSegments[0];
		if (!wall) throw new Error("wall");
		const withDoor = addDoorOpeningToProject(
			rectangle.project,
			{
				wallSegmentId: wall.wallSegmentId,
				widthMm: 900,
				heightMm: 2100,
				sillMm: 0,
				offsetMm: 2050,
			},
			ids,
			"2026-11-01T00:00:02.000Z",
		);
		if (withDoor.kind !== "accepted") throw new Error("door");
		const vertices = new Map(
			withDoor.project.level.vertices.map((v) => [v.vertexId, v]),
		);
		const walls = withDoor.project.level.wallSegments.map((w) => {
			const start = vertices.get(w.startVertexId);
			const end = vertices.get(w.endVertexId);
			if (!start || !end) throw new Error("wall endpoints");
			return { start, end };
		});
		const normalized = normalizeWallGestureDraft(
			point(2000),
			point(5100),
			walls,
		);
		expect(normalized).toEqual(segment(4100, 0, 5100, 0));
		if (!normalized) throw new Error("extension");
		const result = addGeneralWallToProject(
			withDoor.project,
			{ ...normalized, thicknessMm: 100 },
			ids,
			"2026-11-01T00:00:03.000Z",
		);
		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") throw new Error(result.reasonCode);
		expect(result.project.level.openings).toEqual(
			withDoor.project.level.openings,
		);
		expect(
			result.project.level.wallSegments.find(
				(w) => w.wallSegmentId === wall.wallSegmentId,
			),
		).toEqual(wall);
	});
	it("normalizes translated vertical gestures in either direction and sorts covered intervals", () => {
		expect(
			normalizeWallGestureDraft(point(700, 500), point(700, 5500), [
				segment(700, 2500, 700, 3500),
				segment(700, 1000, 700, 2500),
				segment(700, 0, 700, 1000),
				segment(700, 4500, 700, 5000),
			]),
		).toEqual(segment(700, 3500, 700, 4500));
		expect(
			normalizeWallGestureDraft(point(700, 3500), point(700, -2000), [
				segment(700, 4000, 700, 1000),
			]),
		).toEqual(segment(700, 1000, 700, -2000));
		expect(
			normalizeWallGestureDraft(point(700, 500), point(700, 5500), [
				segment(700, 0, 700, 500),
				segment(700, 5500, 700, 6000),
				segment(700, 6000, 700, 7000),
			]),
		).toEqual(segment(700, 500, 700, 5500));
	});
	it("stops after a covered prefix at an exact wall contact without mistaking a slanted wall for collinear coverage", () => {
		expect(
			normalizeWallGestureDraft(point(100, 300), point(4100, 300), [
				segment(100, 300, 1100, 300),
				segment(1100, -1000, 1100, 1000),
				segment(3100, -1000, 3100, 1000),
			]),
		).toEqual(segment(1100, 300, 3100, 300));
		expect(
			normalizeWallGestureDraft(point(100, 300), point(4100, 300), [
				segment(2100, 300, 3100, 1300),
			]),
		).toEqual(segment(100, 300, 2100, 300));
	});
	it("closes at the first crossed wall even when the finger travels beyond it", () => {
		expect(
			normalizeWallGestureDraft(point(0), point(5000), [
				segment(3000, -1000, 3000, 1000),
				segment(4000, -1000, 4000, 1000),
			]),
		).toEqual(segment(0, 0, 3000, 0));
	});
	it("removes a covered prefix without changing the existing wall", () => {
		const walls = [segment(0, 0, 3000, 0)];
		expect(normalizeWallGestureDraft(point(2000), point(5000), walls)).toEqual(
			segment(3000, 0, 5000, 0),
		);
		expect(walls).toEqual([segment(0, 0, 3000, 0)]);
	});
	it("trims reversed and diagonal extensions with exact integer endpoints", () => {
		expect(
			normalizeWallGestureDraft(point(2000), point(-2000), [
				segment(3000, 0, 0, 0),
			]),
		).toEqual(segment(0, 0, -2000, 0));
		expect(
			normalizeWallGestureDraft(point(1000, 1000), point(4000, 4000), [
				segment(2000, 2000, 0, 0),
			]),
		).toEqual(segment(2000, 2000, 4000, 4000));
		expect(
			normalizeWallGestureDraft(point(0, 0), point(4000, 4000), [
				segment(2500, 0, 2500, 5000),
			]),
		).toEqual(segment(0, 0, 2500, 2500));
	});
	it("keeps one contiguous free interval and creates no duplicate for a fully covered gesture", () => {
		expect(
			normalizeWallGestureDraft(point(0), point(5000), [
				segment(0, 0, 1000, 0),
				segment(3000, 0, 4000, 0),
			]),
		).toEqual(segment(1000, 0, 3000, 0));
		expect(
			normalizeWallGestureDraft(point(2000), point(1000), [
				segment(0, 0, 3000, 0),
			]),
		).toBeUndefined();
		expect(normalizeWallGestureDraft(point(0), point(0), [])).toBeUndefined();
	});
	it("does not connect disjoint walls, round a fractional diagonal contact or change an exact endpoint", () => {
		expect(
			normalizeWallGestureDraft(point(0), point(5000), [
				segment(2000, 100, 4000, 100),
			]),
		).toEqual(segment(0, 0, 5000, 0));
		expect(
			normalizeWallGestureDraft(point(0), point(501, 501), [
				segment(0, 501, 501, 0),
			]),
		).toEqual(segment(0, 0, 501, 501));
		expect(
			normalizeWallGestureDraft(point(0), point(5000), [
				segment(5000, -100, 5000, 100),
			]),
		).toEqual(segment(0, 0, 5000, 0));
	});
	it("does not accept invalid coordinate or direction input", () => {
		expect(
			normalizeWallGestureDraft(point(Number.NaN), point(2000), []),
		).toBeUndefined();
		expect(
			normalizeWallGestureDraft(point(0), point(2000, 1000), []),
		).toBeUndefined();
	});
});

describe("phone drawing camera", () => {
	it("keeps the world point between the fingers under their moving midpoint", () => {
		const next = pinchEditorViewport(
			{ panX: 20, panY: -10, zoom: 2 },
			3,
			{ x: 100, y: 150 },
			{ x: 120, y: 180 },
			20,
		);
		expect(next).toEqual({ panX: -120, panY: -300, zoom: 6 });
		expect(next.panX + 40 * next.zoom).toBe(120);
		expect(next.panY + 80 * next.zoom).toBe(180);
	});
	it("preserves the focal point at the zoom ceiling and keeps a large-plan grid touchable", () => {
		const next = pinchEditorViewport(
			{ panX: 0, panY: 0, zoom: 2 },
			100,
			{ x: 90, y: 120 },
			{ x: 90, y: 120 },
			3,
		);
		expect(next).toEqual({ panX: -45, panY: -60, zoom: 3 });
		expect(
			maximumEditorZoomForGrid(0.005, 100) * 0.005 * 100,
		).toBeGreaterThanOrEqual(44);
	});
});
