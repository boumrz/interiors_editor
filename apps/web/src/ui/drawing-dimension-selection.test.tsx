import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import {
	drawingDimensionsFor,
	type DrawingDimension,
} from "./drawing-dimensions";
import { selectDrawingDimensions } from "./drawing-dimension-selection";

function room(withDoor = false) {
	let next = 0;
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-10-25T10:00:00.000Z",
			levelId: "level",
			name: "Размеры",
			projectId: "project",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		{ next: () => `fixture-${next++}` },
		"2026-10-25T10:01:00.000Z",
	);
	if (configured.kind !== "accepted") throw new Error("Expected a valid room");
	const wallSegmentId = configured.project.level.wallSegments[0].wallSegmentId;
	return withDoor
		? {
				...configured.project,
				level: {
					...configured.project.level,
					openings: [
						{
							openingId: "door",
							wallSegmentId,
							offsetMm: 2000,
							widthMm: 800,
							heightMm: 2000,
							sillMm: 0,
							kind: "Door" as const,
							swingSide: "right" as const,
						},
					],
				},
			}
		: configured.project;
}

function annotation(changes: Partial<DrawingDimension> = {}): DrawingDimension {
	return {
		id: "wall",
		kind: "wall",
		wallSegmentId: "host",
		reference: "axis",
		direction: "aligned",
		lane: 1,
		preferredSide: "top",
		startMm: { xMm: 100, zMm: 100 },
		endMm: { xMm: 1100, zMm: 100 },
		label: "1000",
		valueMm: 1000,
		...changes,
	};
}

function chain(): readonly DrawingDimension[] {
	return [
		annotation(),
		annotation({
			id: "left",
			kind: "pier",
			lane: 0,
			endMm: { xMm: 200, zMm: 100 },
			label: "100",
			valueMm: 100,
		}),
		annotation({
			id: "door",
			kind: "opening",
			openingId: "opening",
			lane: 0,
			startMm: { xMm: 200, zMm: 100 },
			endMm: { xMm: 1000, zMm: 100 },
			label: "800",
			valueMm: 800,
		}),
		annotation({
			id: "right",
			kind: "pier",
			lane: 0,
			startMm: { xMm: 1000, zMm: 100 },
			label: "100",
			valueMm: 100,
		}),
	];
}

describe("minimal semantic drawing dimensions", () => {
	it("keeps a full-host opening as the only member of its covered axis chain", () => {
		const host = annotation();
		const opening = {
			...host,
			id: "opening",
			kind: "opening" as const,
			openingId: "door",
			lane: 7,
		};
		expect(selectDrawingDimensions([host, opening])).toEqual([
			{ ...opening, lane: 0 },
		]);
	});
	it("reserves chain lanes only for the matching host, reference and side", () => {
		const total = annotation({ lane: 9 });
		const opening = annotation({
			id: "opening",
			kind: "opening",
			openingId: "door",
			endMm: { xMm: 600, zMm: 100 },
			valueMm: 500,
			lane: 7,
		});
		const pier = annotation({
			id: "pier",
			kind: "pier",
			endMm: { xMm: 600, zMm: 100 },
			valueMm: 500,
			lane: 8,
		});
		for (const piece of [opening, pier]) {
			const selected = selectDrawingDimensions([total, piece]);
			expect(selected.find((value) => value.id === "wall")?.lane).toBe(1);
			expect(selected.find((value) => value.id === piece.id)?.lane).toBe(0);
			for (const changes of [
				{ wallSegmentId: "another-host" },
				{ reference: "clear" as const },
				{ preferredSide: "bottom" as const },
			]) {
				expect(
					selectDrawingDimensions([total, { ...piece, ...changes }]).find(
						(value) => value.id === "wall",
					)?.lane,
				).toBe(0);
			}
		}
		const outer = annotation({
			id: "outer",
			kind: "overall",
			reference: "outer",
			lane: 9,
		});
		expect(
			selectDrawingDimensions([
				outer,
				annotation({
					kind: "room-clear",
					reference: "clear",
					roomId: "room",
					lane: 8,
				}),
			]).find((value) => value.id === "outer")?.lane,
		).toBe(0);
		expect(
			selectDrawingDimensions([
				outer,
				annotation({ preferredSide: "bottom" }),
			]).find((value) => value.id === "outer")?.lane,
		).toBe(0);
	});
	it("requires exact adjoining anchors and an axis-aligned reference contract for coverage", () => {
		for (const changes of [
			{ reference: "clear" as const },
			{ direction: "x" as const },
			{ wallSegmentId: undefined },
		]) {
			expect(
				selectDrawingDimensions(
					chain().map((value) => ({ ...value, ...changes })),
				).some((value) => value.id === "wall"),
			).toBe(true);
		}
		const discontinuous = chain().map((value) =>
			value.id === "door"
				? {
						...value,
						startMm: { ...value.startMm, zMm: value.startMm.zMm + 1e-8 },
					}
				: value,
		);
		expect(
			selectDrawingDimensions(discontinuous).some(
				(value) => value.id === "wall",
			),
		).toBe(true);
	});
	it("compacts visible external lanes after filtering and removing a covered total", () => {
		const source = drawingDimensionsFor(room(true));
		const before = JSON.stringify(source);
		const all = selectDrawingDimensions(source);
		expect(
			all.find((value) => value.kind === "overall" && value.direction === "x")
				?.lane,
		).toBe(1);
		for (const kind of ["wall", "overall"] as const) {
			const selected = selectDrawingDimensions(
				source.filter((value) => value.kind === kind),
			);
			expect(selected.every((value) => value.lane === 0)).toBe(true);
		}
		expect(JSON.stringify(source)).toBe(before);
	});
	it("covers the complete chain on reversed vertical and all signed diagonal hosts", () => {
		for (const [xMm, zMm] of [
			[0, 4100],
			[0, -4100],
			[3000, 3000],
			[3000, -3000],
			[-3000, 3000],
			[-3000, -3000],
		]) {
			const initial = room();
			const project = {
				...initial,
				level: {
					...initial.level,
					rooms: [],
					vertices: [
						{ vertexId: "a", xMm: 200, zMm: -100 },
						{ vertexId: "b", xMm: 200 + xMm, zMm: -100 + zMm },
					],
					wallSegments: [
						{
							wallSegmentId: "host",
							startVertexId: "a",
							endVertexId: "b",
							thicknessMm: 100,
						},
					],
					openings: [
						{
							openingId: "opening",
							kind: "Door" as const,
							wallSegmentId: "host",
							offsetMm: 2000,
							widthMm: 800,
							heightMm: 2000,
							sillMm: 0,
							swingSide: "right" as const,
						},
					],
				},
			};
			const selected = selectDrawingDimensions(drawingDimensionsFor(project));
			expect(selected).toHaveLength(5);
			expect(selected.some((value) => value.kind === "wall")).toBe(false);
		}
	});
	it("keeps all distinct wall, clear and outer references on an unoccupied rectangle", () => {
		const selected = selectDrawingDimensions(drawingDimensionsFor(room()));
		expect(selected).toHaveLength(8);
		expect(selected.filter((value) => value.kind === "wall")).toHaveLength(4);
		expect(
			selected.filter((value) => value.reference === "clear"),
		).toHaveLength(2);
		expect(
			selected.filter((value) => value.reference === "outer"),
		).toHaveLength(2);
	});

	it("removes only the standalone axis total covered by a complete visible opening chain", () => {
		const source = drawingDimensionsFor(room(true));
		expect(source).toHaveLength(11);
		const selected = selectDrawingDimensions(source);
		expect(selected).toHaveLength(10);
		expect(selected.filter((value) => value.kind === "wall")).toHaveLength(3);
		expect(
			selected.filter(
				(value) => value.kind === "opening" || value.kind === "pier",
			),
		).toHaveLength(3);
	});

	it("re-evaluates coverage after filters without dropping an uncovered wall total", () => {
		for (const omitted of ["left", "door", "right"]) {
			const visible = chain().filter((value) => value.id !== omitted);
			expect(
				selectDrawingDimensions(visible).find((value) => value.id === "wall"),
			).toBeDefined();
		}
		expect(
			selectDrawingDimensions(chain()).find((value) => value.id === "wall"),
		).toBeUndefined();
	});

	it("does not use equal values or neighbouring physical bases as coverage", () => {
		for (const changed of [
			{ reference: "clear" as const },
			{ wallSegmentId: "different-host" },
			{ startMm: { xMm: 200, zMm: 101 }, endMm: { xMm: 1000, zMm: 101 } },
			{ startMm: { xMm: 199, zMm: 100 } },
			{ startMm: { xMm: 201, zMm: 100 } },
		]) {
			const source = chain().map((value) =>
				value.id === "door" ? { ...value, ...changed } : value,
			);
			expect(
				selectDrawingDimensions(source).find((value) => value.id === "wall"),
			).toBeDefined();
		}
		const source = chain();
		expect(
			selectDrawingDimensions([
				...source,
				annotation({
					id: "clear",
					kind: "room-clear",
					reference: "clear",
					roomId: "room",
				}),
				annotation({ id: "outer", kind: "overall", reference: "outer" }),
			]).map((value) => value.id),
		).toEqual(expect.arrayContaining(["clear", "outer"]));
	});

	it("retains the total when coverage uses an incompatible axis, invalid interval or bent chain", () => {
		for (const changes of [
			{ direction: "x" as const },
			{ valueMm: 0 },
			{ valueMm: -800 },
			{ valueMm: Number.NaN },
			{ valueMm: Number.POSITIVE_INFINITY },
			{ valueMm: 799.9 },
			{ endMm: { xMm: 200, zMm: 100 }, valueMm: 0 },
		]) {
			const source = chain().map((value) =>
				value.id === "door" ? { ...value, ...changes } : value,
			);
			expect(
				selectDrawingDimensions(source).some((value) => value.id === "wall"),
			).toBe(true);
		}
		const bent = chain().map((value) =>
			value.id === "door"
				? {
						...value,
						endMm: { xMm: 1000, zMm: 200 },
						valueMm: Math.hypot(800, 100),
					}
				: value.id === "right"
					? {
							...value,
							startMm: { xMm: 1000, zMm: 200 },
							valueMm: Math.hypot(100, 100),
						}
					: value,
		);
		expect(
			selectDrawingDimensions(bent).some((value) => value.id === "wall"),
		).toBe(true);
		for (const changes of [
			{ reference: "clear" as const },
			{ direction: "x" as const },
			{ wallSegmentId: undefined },
		]) {
			const source = chain().map((value) =>
				value.id === "wall" ? { ...value, ...changes } : value,
			);
			expect(
				selectDrawingDimensions(source).some((value) => value.id === "wall"),
			).toBe(true);
		}
	});

	it("deduplicates reversed anchors but preserves unequal unrounded physical values", () => {
		const source = annotation({ id: "a" });
		const reversed = {
			...source,
			id: "z",
			startMm: source.endMm,
			endMm: source.startMm,
		};
		expect(
			selectDrawingDimensions([reversed, source]).map((value) => value.id),
		).toEqual(["a"]);
		expect(
			selectDrawingDimensions([
				source,
				{ ...source, id: "fraction", valueMm: 1000.1 },
			]),
		).toHaveLength(2);
	});

	it("deduplicates the same fact independently of IDs but retains another room or host", () => {
		const source = Object.freeze([
			annotation({ id: "b" }),
			annotation({ id: "a" }),
			annotation({ id: "another-host", wallSegmentId: "other" }),
			annotation({ id: "another-room", roomId: "other-room" }),
		]);
		const before = JSON.stringify(source);
		expect(selectDrawingDimensions(source).map((value) => value.id)).toEqual([
			"a",
			"another-host",
			"another-room",
		]);
		expect(selectDrawingDimensions([...source].reverse())).toEqual(
			selectDrawingDimensions(source),
		);
		expect(JSON.stringify(source)).toBe(before);
	});
});
