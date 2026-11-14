import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { DrawingDimensions } from "./DrawingDimensions";
import {
	type DrawingDimensionLayout,
	layoutDrawingDimensions,
	type ScreenRect,
} from "./drawing-dimension-layout";
import type { DrawingDimension } from "./drawing-dimensions";

const bounds = { x: 0, y: 0, width: 500, height: 700 };
const identity = (point: DrawingDimension["startMm"]) => ({
	x: point.xMm,
	y: point.zMm,
});
const dimension = (
	changes: Partial<DrawingDimension> = {},
): DrawingDimension => ({
	id: "wall",
	kind: "wall",
	startMm: { xMm: 100, zMm: 200 },
	endMm: { xMm: 300, zMm: 200 },
	label: "200",
	valueMm: 200,
	reference: "axis",
	direction: "aligned",
	lane: 0,
	preferredSide: "top",
	...changes,
});
function placed(result: DrawingDimensionLayout) {
	if (result.kind !== "placed")
		throw new Error(`Expected placed annotation: ${result.kind}`);
	return result;
}
const overlap = (a: ScreenRect, b: ScreenRect) =>
	a.x < b.x + b.width &&
	a.x + a.width > b.x &&
	a.y < b.y + b.height &&
	a.y + a.height > b.y;

function openingChain() {
	return [
		dimension({
			id: "pier-left",
			kind: "pier",
			wallSegmentId: "host",
			startMm: { xMm: 100, zMm: 300 },
			endMm: { xMm: 160, zMm: 300 },
			valueMm: 60,
			label: "60",
		}),
		dimension({
			id: "opening",
			kind: "opening",
			wallSegmentId: "host",
			openingId: "door",
			startMm: { xMm: 160, zMm: 300 },
			endMm: { xMm: 240, zMm: 300 },
			valueMm: 80,
			label: "80",
		}),
		dimension({
			id: "pier-right",
			kind: "pier",
			wallSegmentId: "host",
			startMm: { xMm: 240, zMm: 300 },
			endMm: { xMm: 300, zMm: 300 },
			valueMm: 60,
			label: "60",
		}),
	];
}

describe("screen-space drawing dimensions", () => {
	it("gives adjacent narrow rooms one clear fact each before another room takes a second fact", () => {
		const clear = (
			id: string,
			roomId: string,
			startMm: DrawingDimension["startMm"],
			endMm: DrawingDimension["endMm"],
			preferredSide: "top" | "left",
		) =>
			dimension({
				id,
				roomId,
				startMm,
				endMm,
				preferredSide,
				kind: "room-clear",
				reference: "clear",
			});
		const source = [
			clear(
				"a-x",
				"room-a",
				{ xMm: 50, zMm: 200 },
				{ xMm: 150, zMm: 200 },
				"top",
			),
			clear(
				"a-z",
				"room-a",
				{ xMm: 50, zMm: 200 },
				{ xMm: 50, zMm: 500 },
				"left",
			),
			clear(
				"b-x",
				"room-b",
				{ xMm: 160, zMm: 200 },
				{ xMm: 260, zMm: 200 },
				"top",
			),
			clear(
				"b-z",
				"room-b",
				{ xMm: 160, zMm: 200 },
				{ xMm: 160, zMm: 500 },
				"left",
			),
		];
		const options = {
			projectPoint: identity,
			bounds: { x: 0, y: 0, width: 280, height: 740 },
			measureText: () => ({ width: 48, height: 26 }),
			obstacles: [
				{ x: 40, y: 250, width: 100, height: 200 },
				{ x: 180, y: 250, width: 100, height: 200 },
			],
		};
		const result = layoutDrawingDimensions(source, options);
		const visible = result.filter((value) => value.kind === "placed");
		expect(new Set(visible.map((value) => value.dimension.roomId))).toEqual(
			new Set(["room-a", "room-b"]),
		);
		expect(visible.map((value) => value.dimension.id)).toEqual(["a-x", "b-x"]);
		expect(layoutDrawingDimensions([...source].reverse(), options)).toEqual(
			result,
		);
	});
	it("keeps external labels and their displaced leaders out of a physical wall body", () => {
		const wall = [
			{ x: 50, y: 190 },
			{ x: 350, y: 190 },
			{ x: 350, y: 225 },
			{ x: 50, y: 225 },
		];
		const result = placed(
			layoutDrawingDimensions([dimension({ preferredSide: "bottom" })], {
				projectPoint: identity,
				bounds,
				contentObstacles: [wall],
				measureText: () => ({ width: 48, height: 18 }),
			})[0],
		);
		expect(result.labelBounds.y).toBeGreaterThanOrEqual(225);
		if (result.leader) {
			for (let sample = 0; sample <= 100; sample++) {
				const ratio = sample / 100;
				const x =
					result.leader.start.x +
					(result.leader.end.x - result.leader.start.x) * ratio;
				const y =
					result.leader.start.y +
					(result.leader.end.y - result.leader.start.y) * ratio;
				expect(x > 50 && x < 350 && y > 190 && y < 225).toBe(false);
			}
		}
	});
	it("uses the actual diagonal wall polygon instead of its bounding rectangle", () => {
		const wall = [
			{ x: 96, y: 104 },
			{ x: 296, y: 304 },
			{ x: 304, y: 296 },
			{ x: 104, y: 96 },
		];
		const source = [
			dimension({
				startMm: { xMm: 150, zMm: 200 },
				endMm: { xMm: 250, zMm: 200 },
			}),
		];
		const options = {
			projectPoint: identity,
			bounds,
			measureText: () => ({ width: 48, height: 18 }),
		};
		const expected = layoutDrawingDimensions(source, options).map(placed);
		expect(
			layoutDrawingDimensions(source, { ...options, contentObstacles: [wall] }),
		).toEqual(expected);
	});
	it("retains constructive witness strokes through their own wall while keeping its label outside", () => {
		const wall = [
			{ x: 90, y: 190 },
			{ x: 110, y: 190 },
			{ x: 110, y: 210 },
			{ x: 90, y: 210 },
		];
		const result = placed(
			layoutDrawingDimensions([dimension()], {
				projectPoint: identity,
				bounds,
				contentObstacles: [wall],
				measureText: () => ({ width: 48, height: 18 }),
			})[0],
		);
		expect(
			result.extensionLines.some(
				(line) =>
					line.start.x === 100 &&
					Math.max(line.start.y, line.end.y) > 190 &&
					Math.min(line.start.y, line.end.y) < 210,
			),
		).toBe(true);
		expect(result.labelBounds.y + result.labelBounds.height).toBeLessThan(190);
	});
	it("keeps the full clear-span glyph inside its usable boundary with eight pixels of free space at every font size", () => {
		const diagonal = Math.SQRT1_2;
		const fixtures = [
			{
				startMm: { xMm: 100, zMm: 200 },
				endMm: { xMm: 300, zMm: 200 },
				preferredSide: "top" as const,
				inward: { x: 0, y: 1 },
			},
			{
				startMm: { xMm: 100, zMm: 400 },
				endMm: { xMm: 300, zMm: 400 },
				preferredSide: "bottom" as const,
				inward: { x: 0, y: -1 },
			},
			{
				startMm: { xMm: 100, zMm: 200 },
				endMm: { xMm: 100, zMm: 400 },
				preferredSide: "left" as const,
				inward: { x: 1, y: 0 },
			},
			{
				startMm: { xMm: 400, zMm: 200 },
				endMm: { xMm: 400, zMm: 400 },
				preferredSide: "right" as const,
				inward: { x: -1, y: 0 },
			},
			{
				startMm: { xMm: 100, zMm: 200 },
				endMm: { xMm: 300, zMm: 400 },
				preferredSide: "top" as const,
				inward: { x: -diagonal, y: diagonal },
			},
			{
				startMm: { xMm: 100, zMm: 400 },
				endMm: { xMm: 300, zMm: 200 },
				preferredSide: "top" as const,
				inward: { x: diagonal, y: diagonal },
			},
		];
		for (const height of [18, 26, 40]) {
			for (const { inward, ...fixture } of fixtures) {
				for (const spanScale of [1, 0.1]) {
					const source = dimension({
						...fixture,
						endMm: {
							xMm:
								fixture.startMm.xMm +
								(fixture.endMm.xMm - fixture.startMm.xMm) * spanScale,
							zMm:
								fixture.startMm.zMm +
								(fixture.endMm.zMm - fixture.startMm.zMm) * spanScale,
						},
						kind: "room-clear",
						reference: "clear",
						roomId: "room",
					});
					const candidate = layoutDrawingDimensions([source], {
						projectPoint: identity,
						bounds,
						measureText: () => ({ width: 48, height }),
					})[0];
					if (spanScale < 1 && candidate.kind !== "placed") {
						expect(candidate).toMatchObject({
							kind: "offscreen",
							reason: "layout-conflict",
						});
						continue;
					}
					const result = placed(candidate);
					for (const point of result.labelPolygon) {
						expect(
							(point.x - source.startMm.xMm) * inward.x +
								(point.y - source.startMm.zMm) * inward.y,
						).toBeGreaterThanOrEqual(8 - 1e-7);
					}
				}
			}
		}
	});
	it("retains a clear number in a compact canvas that has room for its measured glyph and witnesses", () => {
		for (const height of [26, 40]) {
			const source = dimension({
				kind: "room-clear",
				reference: "clear",
				roomId: "room",
			});
			const result = placed(
				layoutDrawingDimensions([source], {
					projectPoint: identity,
					bounds: { x: 0, y: 200, width: 500, height: height + 18 },
					measureText: () => ({ width: 48, height }),
				})[0],
			);
			expect(result.clipped).toBe(false);
			for (const point of result.labelPolygon)
				expect(point.y).toBeGreaterThanOrEqual(208 - 1e-7);
		}
	});
	it("keeps semantic priority when only one competing group can fit", () => {
		for (const [high, low] of [
			["room-clear", "opening"],
			["opening", "overall"],
			["overall", "wall"],
		] as const) {
			const source = [
				dimension({
					id: "a-low",
					kind: low,
					preferredSide: "top",
					startMm: { xMm: 100, zMm: 100 },
					endMm: { xMm: 200, zMm: 100 },
				}),
				dimension({
					id: "z-high",
					kind: high,
					preferredSide: high === "room-clear" ? "bottom" : "top",
					startMm: { xMm: 100, zMm: 100 },
					endMm: { xMm: 200, zMm: 100 },
				}),
			];
			const results = layoutDrawingDimensions(source, {
				projectPoint: identity,
				bounds: { x: 0, y: 40, width: 300, height: 100 },
				measureText: () => ({ width: 40, height: 18 }),
			});
			expect(
				results
					.filter((value) => value.kind === "placed")
					.map((value) => value.dimension.id),
			).toEqual(["z-high"]);
		}
	});

	it("rejects only the invalid projection or font component without returning invented SVG coordinates", () => {
		const source = dimension({ direction: "x", endMm: { xMm: 300, zMm: 240 } });
		for (const invalid of [
			{ xMm: 100, zMm: 200 },
			{ xMm: 300, zMm: 240 },
			{ xMm: 300, zMm: 200 },
		]) {
			const result = layoutDrawingDimensions([source], {
				bounds,
				projectPoint: (point) =>
					point.xMm === invalid.xMm && point.zMm === invalid.zMm
						? undefined
						: identity(point),
			});
			expect(result[0]).toMatchObject({
				kind: "unavailable",
				reason: "projection-unavailable",
			});
		}
		for (const changes of [
			{ x: Number.NaN },
			{ y: Infinity },
			{ width: -1 },
			{ height: 0 },
			{ height: Infinity },
		]) {
			expect(
				layoutDrawingDimensions([source], {
					projectPoint: identity,
					bounds: { ...bounds, ...changes },
				})[0],
			).toMatchObject({ kind: "unavailable", reason: "invalid-canvas-bounds" });
		}
		for (const size of [
			{ width: 0, height: 18 },
			{ width: -1, height: 18 },
			{ width: Infinity, height: 18 },
			{ width: 40, height: 0 },
			{ width: 40, height: Number.NaN },
			{ width: 40, height: Infinity },
		]) {
			expect(
				layoutDrawingDimensions([source], {
					projectPoint: identity,
					bounds,
					measureText: () => size,
				})[0],
			).toMatchObject({ kind: "unavailable", reason: "invalid-text-size" });
		}
		expect(
			layoutDrawingDimensions([source], {
				bounds,
				projectPoint: () => {
					throw new Error("Projection offline");
				},
			})[0],
		).toMatchObject({ kind: "unavailable", reason: "projection-unavailable" });
	});

	it("renders only placed annotations with their numeric text, references and honest clipping state", () => {
		const source = openingChain();
		const layouts = layoutDrawingDimensions(source, {
			projectPoint: identity,
			bounds,
		});
		const html = renderToStaticMarkup(<DrawingDimensions layouts={layouts} />);
		expect(html).toContain('data-dimension-kind="opening"');
		expect(html).toContain('data-dimension-reference="axis"');
		expect(html).toContain('aria-label="Проём по осям: 80 мм"');
		expect(html).toContain(">80</text>");
		expect(html).toContain('transform="rotate(0 ');
		expect(html).not.toContain("data-dimension-crowded");
		expect(html).not.toContain("data-dimension-clipped");
		const reversedSegments = layouts.map((value) =>
			value.kind !== "placed"
				? value
				: {
						...value,
						extensionLines: value.extensionLines.map((line) => ({
							start: line.end,
							end: line.start,
						})),
						ticks: value.ticks.map((line) => ({
							start: line.end,
							end: line.start,
						})),
					},
		);
		expect(
			renderToStaticMarkup(
				<DrawingDimensions layouts={[...layouts, ...reversedSegments]} />,
			).match(/<line\s/g),
		).toHaveLength(11);
		const unavailable = layoutDrawingDimensions(source, {
			projectPoint: identity,
			bounds,
			obstacles: [bounds],
		});
		const empty = renderToStaticMarkup(
			<DrawingDimensions layouts={unavailable} />,
		);
		expect(empty).not.toContain("<text");
		expect(empty).not.toContain("<line");
		const clipped = layoutDrawingDimensions(
			[dimension({ startMm: { xMm: -50, zMm: 200 } })],
			{ projectPoint: identity, bounds },
		);
		expect(
			renderToStaticMarkup(<DrawingDimensions layouts={clipped} />),
		).toContain('data-dimension-clipped="true"');
		const short = placed(
			layoutDrawingDimensions([dimension({ endMm: { xMm: 120, zMm: 200 } })], {
				projectPoint: identity,
				bounds,
				measureText: () => ({ width: 48, height: 18 }),
			})[0],
		);
		expect(short.leader).toBeDefined();
		expect(
			renderToStaticMarkup(<DrawingDimensions layouts={[short]} />).match(
				/<line\s/g,
			),
		).toHaveLength(6);
		expect(
			renderToStaticMarkup(
				<DrawingDimensions layouts={[{ ...short, baseline: undefined }]} />,
			).match(/<line\s/g),
		).toHaveLength(5);
	});

	it("keeps actual glyph geometry clear of every foreign stroke in a dense signed-angle corpus", () => {
		const size = { width: 48, height: 18 };
		const fixtures = [
			[
				dimension({ id: "horizontal" }),
				dimension({
					id: "vertical",
					preferredSide: "left",
					startMm: { xMm: 232, zMm: 100 },
					endMm: { xMm: 232, zMm: 500 },
				}),
			],
			Array.from({ length: 12 }, (_, index) =>
				dimension({
					id: `dense-${index}`,
					startMm: { xMm: 140 + index * 8, zMm: 280 },
					endMm: {
						xMm: 340 - index * 7,
						zMm: index % 2 ? 480 - index * 7 : 280,
					},
					preferredSide: index % 2 ? "left" : "top",
				}),
			),
			openingChain(),
			...[-90, -45, 0, 45].flatMap((degrees) => {
				const radians = (degrees * Math.PI) / 180;
				const rotate = (point: DrawingDimension["startMm"]) => ({
					xMm: 300 + ((point.xMm - 200) / 2) * Math.cos(radians),
					zMm: 300 + ((point.xMm - 200) / 2) * Math.sin(radians),
				});
				return (["top", "bottom"] as const).map((preferredSide) =>
					[openingChain()[0]].map((value) => ({
						...value,
						preferredSide,
						startMm: rotate(value.startMm),
						endMm: rotate(value.endMm),
					})),
				);
			}),
		];
		for (const fixture of fixtures) {
			const results = layoutDrawingDimensions(fixture, {
				projectPoint: identity,
				bounds: { x: 0, y: 0, width: 700, height: 700 },
				measureText: () => size,
			}).filter(
				(value): value is Extract<DrawingDimensionLayout, { kind: "placed" }> =>
					value.kind === "placed",
			);
			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				expect(result.labelPolygon).toHaveLength(4);
				const points = result.labelPolygon;
				expect(
					Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
				).toBeCloseTo(size.width, 7);
				expect(
					Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y),
				).toBeCloseTo(size.height, 7);
				expect(points.reduce((sum, point) => sum + point.x, 0) / 4).toBeCloseTo(
					result.textPoint.x,
					8,
				);
				expect(points.reduce((sum, point) => sum + point.y, 0) / 4).toBeCloseTo(
					result.textPoint.y,
					8,
				);
				for (const point of points) {
					expect(point.x).toBeGreaterThanOrEqual(result.labelBounds.x - 1e-7);
					expect(point.x).toBeLessThanOrEqual(
						result.labelBounds.x + result.labelBounds.width + 1e-7,
					);
					expect(point.y).toBeGreaterThanOrEqual(result.labelBounds.y - 1e-7);
					expect(point.y).toBeLessThanOrEqual(
						result.labelBounds.y + result.labelBounds.height + 1e-7,
					);
				}
				const radians = (result.textRotationDegrees * Math.PI) / 180;
				if (result.leader) {
					const endX = result.leader.end.x - result.textPoint.x;
					const endY = result.leader.end.y - result.textPoint.y;
					const gap = Math.hypot(
						Math.max(
							0,
							Math.abs(endX * Math.cos(radians) + endY * Math.sin(radians)) -
								size.width / 2,
						),
						Math.max(
							0,
							Math.abs(-endX * Math.sin(radians) + endY * Math.cos(radians)) -
								size.height / 2,
						),
					);
					expect(gap).toBeGreaterThan(0);
					expect(gap).toBeLessThanOrEqual(2 + 1e-7);
					for (let sample = 0; sample <= 100; sample++) {
						const ratio = sample / 100;
						const x =
							result.leader.start.x +
							(result.leader.end.x - result.leader.start.x) * ratio -
							result.textPoint.x;
						const y =
							result.leader.start.y +
							(result.leader.end.y - result.leader.start.y) * ratio -
							result.textPoint.y;
						const inside =
							Math.abs(x * Math.cos(radians) + y * Math.sin(radians)) <
								size.width / 2 &&
							Math.abs(-x * Math.sin(radians) + y * Math.cos(radians)) <
								size.height / 2;
						expect(inside).toBe(false);
					}
				}
				for (const other of results.filter((value) => value !== result)) {
					for (const line of [
						...other.extensionLines,
						...other.ticks,
						...(other.baseline ? [other.baseline] : []),
						...(other.leader ? [other.leader] : []),
					]) {
						const samples = Math.ceil(
							Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) *
								2,
						);
						for (let sample = 0; sample <= samples; sample++) {
							const ratio = samples === 0 ? 0 : sample / samples;
							const x =
								line.start.x +
								(line.end.x - line.start.x) * ratio -
								result.textPoint.x;
							const y =
								line.start.y +
								(line.end.y - line.start.y) * ratio -
								result.textPoint.y;
							const inside =
								Math.abs(x * Math.cos(radians) + y * Math.sin(radians)) <
									size.width / 2 &&
								Math.abs(-x * Math.sin(radians) + y * Math.cos(radians)) <
									size.height / 2;
							expect(inside).toBe(false);
						}
					}
				}
			}
			const strokes = (value: (typeof results)[number]) => [
				...value.extensionLines,
				...value.ticks,
				...(value.baseline ? [value.baseline] : []),
				...(value.leader ? [value.leader] : []),
			];
			const orientation = (
				a: { x: number; y: number },
				b: { x: number; y: number },
				c: { x: number; y: number },
			) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
			for (let first = 0; first < results.length; first++) {
				for (let second = first + 1; second < results.length; second++) {
					const a = results[first];
					const b = results[second];
					if (
						a.dimension.wallSegmentId &&
						a.dimension.wallSegmentId === b.dimension.wallSegmentId &&
						a.dimension.reference === b.dimension.reference
					)
						continue;
					for (const lineA of strokes(a)) {
						for (const lineB of strokes(b)) {
							const crosses =
								orientation(lineA.start, lineA.end, lineB.start) *
									orientation(lineA.start, lineA.end, lineB.end) <
									-1e-7 &&
								orientation(lineB.start, lineB.end, lineA.start) *
									orientation(lineB.start, lineB.end, lineA.end) <
									-1e-7;
							expect(crosses).toBe(false);
						}
					}
				}
			}
		}
	});
	it("allows constructive clear-span joints only for the same identified room", () => {
		const horizontal = dimension({
			id: "a",
			kind: "room-clear",
			reference: "clear",
			roomId: "room",
			startMm: { xMm: 100, zMm: 300 },
			endMm: { xMm: 300, zMm: 300 },
			preferredSide: "top",
		});
		const vertical = dimension({
			id: "b",
			kind: "room-clear",
			reference: "clear",
			roomId: "room",
			startMm: { xMm: 100, zMm: 300 },
			endMm: { xMm: 100, zMm: 500 },
			preferredSide: "left",
		});
		const place = (other: DrawingDimension) =>
			layoutDrawingDimensions([horizontal, other], {
				projectPoint: identity,
				bounds,
				measureText: () => ({ width: 48, height: 18 }),
			}).filter((value) => value.kind === "placed");
		expect(place(vertical)).toHaveLength(2);
		expect(place({ ...vertical, roomId: "other-room" })).toHaveLength(1);
		const { roomId: _roomId, ...unowned } = vertical;
		expect(place(unowned)).toHaveLength(1);
	});
	it("separates adjacent short-span glyphs even when no foreign stroke crosses either glyph", () => {
		for (const degrees of [-90, -45, 0, 45]) {
			const radians = (degrees * Math.PI) / 180;
			const results = layoutDrawingDimensions(
				[
					dimension({
						id: "a",
						startMm: { xMm: 100, zMm: 300 },
						endMm: { xMm: 120, zMm: 300 },
					}),
					dimension({
						id: "b",
						startMm: { xMm: 135, zMm: 300 },
						endMm: { xMm: 155, zMm: 300 },
					}),
				],
				{
					bounds: { x: 0, y: 0, width: 700, height: 700 },
					projectPoint: (point) => ({
						x: 300 + (point.xMm - 130) * Math.cos(radians),
						y: 300 + (point.xMm - 130) * Math.sin(radians),
					}),
					measureText: () => ({ width: 48, height: 18 }),
				},
			).map(placed);
			expect(results).toHaveLength(2);
			const [first, second] = results;
			const angle = (first.textRotationDegrees * Math.PI) / 180;
			const dx = second.textPoint.x - first.textPoint.x;
			const dy = second.textPoint.y - first.textPoint.y;
			expect(
				Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)) >= 48 - 1e-7 ||
					Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) >= 18 - 1e-7,
			).toBe(true);
		}
	});
	it("moves an entire opening chain to one common baseline when one label hits chrome", () => {
		const results = layoutDrawingDimensions(openingChain(), {
			projectPoint: identity,
			bounds,
			measureText: () => ({ width: 48, height: 18 }),
			obstacles: [70, 130, 190].map((x) => ({
				x: x - 2,
				y: 245,
				width: 4,
				height: 20,
			})),
		}).map(placed);
		expect(results).toHaveLength(3);
		expect(
			new Set(
				results.flatMap((value) => [
					value.baseline?.start.y,
					value.baseline?.end.y,
				]),
			).size,
		).toBe(1);
		expect(results.every((value) => !value.crowded)).toBe(true);
	});

	it("renders each shared jamb extension and tick once across the whole chain", () => {
		const layouts = layoutDrawingDimensions(openingChain(), {
			projectPoint: identity,
			bounds,
		});
		const html = renderToStaticMarkup(<DrawingDimensions layouts={layouts} />);
		// Three baselines plus one extension and one tick for each of four real anchors.
		expect(html.match(/<line\s/g)).toHaveLength(11);
		expect(html.match(/<text\s/g)).toHaveLength(3);
		expect(renderToStaticMarkup(<DrawingDimensions layouts={layouts} />)).toBe(
			html,
		);
	});

	it("does not publish a partial chain when a member's text cannot be verified", () => {
		const layouts = layoutDrawingDimensions(openingChain(), {
			projectPoint: identity,
			bounds,
			measureText: (label) => ({
				width: label === "80" ? Number.NaN : 30,
				height: 18,
			}),
		});
		expect(layouts).toHaveLength(3);
		expect(layouts.every((value) => value.kind !== "placed")).toBe(true);
	});

	it("keeps short-span leaders outside their own readable glyph box", () => {
		const result = placed(
			layoutDrawingDimensions(
				[
					dimension({
						startMm: { xMm: 190, zMm: 300 },
						endMm: { xMm: 210, zMm: 300 },
						label: "20",
						valueMm: 20,
					}),
				],
				{
					projectPoint: identity,
					bounds,
					measureText: () => ({ width: 48, height: 18 }),
				},
			)[0],
		);
		if (!result.leader)
			throw new Error("Expected the short span's explicit leader");
		const end = result.leader.end;
		expect(
			end.x < result.labelBounds.x ||
				end.x > result.labelBounds.x + result.labelBounds.width ||
				end.y < result.labelBounds.y ||
				end.y > result.labelBounds.y + result.labelBounds.height,
		).toBe(true);
		expect(result.textPoint.y + 9).toBeLessThan(
			(result.baseline?.start.y ?? 0) - 4,
		);
		for (let sample = 0; sample <= 100; sample++) {
			const ratio = sample / 100;
			const x = result.leader.start.x + (end.x - result.leader.start.x) * ratio;
			const y = result.leader.start.y + (end.y - result.leader.start.y) * ratio;
			expect(
				Math.abs(x - result.textPoint.x) < 24 &&
					Math.abs(y - result.textPoint.y) < 9,
			).toBe(false);
		}
		expect(
			Math.hypot(
				Math.max(0, Math.abs(end.x - result.textPoint.x) - 24),
				Math.max(0, Math.abs(end.y - result.textPoint.y) - 9),
			),
		).toBeCloseTo(2, 7);
	});
	it("connects a sideways displaced short label to its own span without crossing its glyph", () => {
		const result = placed(
			layoutDrawingDimensions(
				[
					dimension({
						startMm: { xMm: 190, zMm: 300 },
						endMm: { xMm: 210, zMm: 300 },
					}),
				],
				{
					projectPoint: identity,
					bounds,
					measureText: () => ({ width: 48, height: 18 }),
					obstacles: [{ x: 198, y: 120, width: 4, height: 145 }],
				},
			)[0],
		);
		if (!result.leader)
			throw new Error("The displaced number needs an explicit leader");
		expect(Math.abs(result.textPoint.x - 200)).toBeGreaterThanOrEqual(60);
		expect(result.leader.start).toEqual({ x: 200, y: 268 });
		const end = result.leader.end;
		const gap = Math.hypot(
			Math.max(0, Math.abs(end.x - result.textPoint.x) - 24),
			Math.max(0, Math.abs(end.y - result.textPoint.y) - 9),
		);
		expect(gap).toBeGreaterThan(0);
		expect(gap).toBeLessThanOrEqual(2 + 1e-7);
		for (let sample = 0; sample <= 100; sample++) {
			const ratio = sample / 100;
			const x = result.leader.start.x + (end.x - result.leader.start.x) * ratio;
			const y = result.leader.start.y + (end.y - result.leader.start.y) * ratio;
			expect(
				Math.abs(x - result.textPoint.x) < 24 &&
					Math.abs(y - result.textPoint.y) < 9,
			).toBe(false);
		}
	});

	it("does not mirror the tick's handedness when the lane switches sides", () => {
		for (const [dx, dy] of [
			[200, 0],
			[0, 200],
			[200, 200],
			[200, -200],
		]) {
			const vectors = (["top", "bottom", "left", "right"] as const).map(
				(preferredSide) => {
					const result = placed(
						layoutDrawingDimensions(
							[
								dimension({
									startMm: { xMm: 200, zMm: 300 },
									endMm: { xMm: 200 + dx, zMm: 300 + dy },
									preferredSide,
								}),
							],
							{
								projectPoint: identity,
								bounds: { x: -500, y: -500, width: 2000, height: 2000 },
							},
						)[0],
					);
					const tick = result.ticks[0];
					if (!tick) throw new Error("Expected a real endpoint tick");
					const x = tick.end.x - tick.start.x;
					const y = tick.end.y - tick.start.y;
					expect(
						Math.abs(x * dx + y * dy) / (Math.hypot(x, y) * Math.hypot(dx, dy)),
					).toBeCloseTo(Math.SQRT1_2, 8);
					return [Number(x.toFixed(8)), Number(y.toFixed(8))];
				},
			);
			expect(
				vectors.every(
					(vector) => JSON.stringify(vector) === JSON.stringify(vectors[0]),
				),
			).toBe(true);
		}
	});

	it("rejects a complete chain if its primitives cannot avoid an obstructed interval", () => {
		const results = layoutDrawingDimensions(openingChain(), {
			projectPoint: identity,
			bounds,
			obstacles: [{ x: 110, y: 0, width: 60, height: 700 }],
		});
		expect(results).toHaveLength(3);
		expect(
			results.every(
				(value) =>
					value.kind === "offscreen" && value.reason === "layout-conflict",
			),
		).toBe(true);
	});

	it("does not clamp a number to the wrong side when its baseline cannot fit the viewport", () => {
		const results = layoutDrawingDimensions(
			[
				dimension({
					startMm: { xMm: 100, zMm: 20 },
					endMm: { xMm: 300, zMm: 20 },
				}),
			],
			{ projectPoint: identity, bounds },
		);
		expect(results[0]).toMatchObject({
			kind: "offscreen",
			reason: "layout-conflict",
		});
	});
	it("keeps the entire readable text above horizontal, vertical and signed diagonal baselines on either placement side", () => {
		for (const [dx, dy] of [
			[200, 0],
			[0, 200],
			[200, 200],
			[200, -200],
		]) {
			for (const preferredSide of ["top", "bottom", "left", "right"] as const) {
				for (const reversed of [false, true]) {
					const first = { xMm: 150, zMm: 300 };
					const second = { xMm: 150 + dx, zMm: 300 + dy };
					const source = dimension({
						startMm: reversed ? second : first,
						endMm: reversed ? first : second,
						preferredSide,
					});
					const result = placed(
						layoutDrawingDimensions([source], {
							projectPoint: identity,
							bounds: { x: -500, y: -500, width: 1500, height: 1500 },
							measureText: () => ({ width: 48, height: 18 }),
						})[0],
					);
					if (!result.baseline) throw new Error("Expected a visible baseline");
					const angle = (result.textRotationDegrees * Math.PI) / 180;
					const normal = { x: Math.sin(angle), y: -Math.cos(angle) };
					const distance =
						(result.textPoint.x - result.baseline.start.x) * normal.x +
						(result.textPoint.y - result.baseline.start.y) * normal.y;
					expect(distance - 9).toBeGreaterThanOrEqual(4 - 1e-8);
				}
			}
		}
	});
	it("rejects overflowing projections and canvas edges without returning non-finite SVG positions", () => {
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: (point) => ({
					x: point.xMm === 100 ? -1e308 : 1e308,
					y: 200,
				}),
				bounds,
			})[0].kind,
		).toBe("unavailable");
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: identity,
				bounds: { x: 1e308, y: 0, width: 1e308, height: 700 },
			})[0].kind,
		).toBe("unavailable");
	});

	it("returns explicit text-size and insufficient-space outcomes instead of clipped or missing numbers", () => {
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: identity,
				bounds,
				measureText: () => ({ width: Number.NaN, height: 18 }),
			})[0],
		).toMatchObject({ kind: "unavailable", reason: "invalid-text-size" });
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: identity,
				bounds,
				measureText: () => {
					throw new Error("font unavailable");
				},
			})[0].kind,
		).toBe("unavailable");
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: identity,
				bounds,
				measureText: () => ({ width: 600, height: 18 }),
			})[0],
		).toMatchObject({ kind: "offscreen", reason: "label-does-not-fit" });
	});
	it("projects an x span onto one horizontal baseline even when witness anchors have different z coordinates", () => {
		const source = dimension({
			direction: "x",
			startMm: { xMm: 100, zMm: 200 },
			endMm: { xMm: 300, zMm: 240 },
		});
		const result = placed(
			layoutDrawingDimensions([source], { projectPoint: identity, bounds })[0],
		);
		expect(result.baseline).toEqual({
			start: { x: 100, y: 168 },
			end: { x: 300, y: 168 },
		});
		expect(result.extensionLines).toEqual([
			{ start: { x: 100, y: 196 }, end: { x: 100, y: 162 } },
			{ start: { x: 300, y: 236 }, end: { x: 300, y: 162 } },
		]);
		expect(result.dimension).toBe(source);
		expect(result.textRotationDegrees).toBe(0);
	});

	it("projects a z span vertically without treating different witness x coordinates as a diagonal measurement", () => {
		const source = dimension({
			direction: "z",
			preferredSide: "left",
			startMm: { xMm: 140, zMm: 100 },
			endMm: { xMm: 220, zMm: 300 },
		});
		const result = placed(
			layoutDrawingDimensions([source], { projectPoint: identity, bounds })[0],
		);
		expect(result.baseline).toEqual({
			start: { x: 108, y: 100 },
			end: { x: 108, y: 300 },
		});
		expect(result.textRotationDegrees).toBe(-90);
	});

	it("uses the transformed world axis rather than assuming an unrotated projection", () => {
		const source = dimension({
			direction: "x",
			startMm: { xMm: 100, zMm: 200 },
			endMm: { xMm: 300, zMm: 240 },
			preferredSide: "right",
		});
		const result = placed(
			layoutDrawingDimensions([source], {
				projectPoint: (point) => ({ x: point.zMm, y: point.xMm }),
				bounds,
			})[0],
		);
		expect(result.baseline?.start.x).toBe(result.baseline?.end.x);
		expect(result.baseline?.start.y).toBe(100);
		expect(result.baseline?.end.y).toBe(300);
	});

	it("keeps offsets and ten-pixel ticks constant under zoom and puts clear spans inward", () => {
		for (const scale of [0.5, 1, 2]) {
			const projectPoint = (p: DrawingDimension["startMm"]) => ({
				x: p.xMm * scale,
				y: p.zMm * scale + 100,
			});
			const source = dimension();
			const result = placed(
				layoutDrawingDimensions([source], {
					projectPoint,
					bounds: { ...bounds, width: 900, height: 900 },
				})[0],
			);
			expect(
				projectPoint(source.startMm).y - (result.baseline?.start.y ?? 0),
			).toBe(32);
			for (const tick of result.ticks)
				expect(
					Math.hypot(tick.end.x - tick.start.x, tick.end.y - tick.start.y),
				).toBeCloseTo(10, 9);
			const clear = placed(
				layoutDrawingDimensions(
					[dimension({ kind: "room-clear", reference: "clear" })],
					{ projectPoint, bounds: { ...bounds, width: 900, height: 900 } },
				)[0],
			);
			expect(
				(clear.baseline?.start.y ?? 0) - projectPoint(source.startMm).y,
			).toBeGreaterThanOrEqual(18 + 4 + 8);
		}
	});

	it("keeps diagonal text readable in either endpoint order and preserves the original measurement label", () => {
		for (const reversed of [false, true]) {
			const source = dimension({
				startMm: reversed ? { xMm: 300, zMm: 300 } : { xMm: 100, zMm: 100 },
				endMm: reversed ? { xMm: 100, zMm: 100 } : { xMm: 300, zMm: 300 },
				label: "283",
				valueMm: Math.SQRT2 * 200,
			});
			const result = placed(
				layoutDrawingDimensions([source], {
					projectPoint: identity,
					bounds,
				})[0],
			);
			expect(result.textRotationDegrees).toBe(45);
			expect(result.dimension.label).toBe("283");
		}
	});

	it("spreads labels deterministically around existing labels and real chrome obstacles", () => {
		const obstacle = { x: 140, y: 145, width: 120, height: 30 };
		const source = [
			dimension({
				id: "b",
				startMm: { xMm: 100, zMm: 400 },
				endMm: { xMm: 300, zMm: 400 },
			}),
			dimension({ id: "a" }),
		];
		const result = layoutDrawingDimensions(source, {
			projectPoint: identity,
			bounds,
			obstacles: [obstacle],
		}).map(placed);
		expect(result.every((value) => !overlap(value.labelBounds, obstacle))).toBe(
			true,
		);
		expect(overlap(result[0].labelBounds, result[1].labelBounds)).toBe(false);
		expect(
			layoutDrawingDimensions([...source].reverse(), {
				projectPoint: identity,
				bounds,
				obstacles: [obstacle],
			}),
		).toEqual(result);
	});

	it("refuses a crowded annotation when no collision-free layout exists", () => {
		const result = layoutDrawingDimensions([dimension()], {
			projectPoint: identity,
			bounds,
			obstacles: [bounds],
		})[0];
		expect(result).toMatchObject({
			kind: "offscreen",
			reason: "layout-conflict",
		});
	});

	it("clips lines without fabricating an endpoint tick at the canvas edge", () => {
		const source = dimension({
			startMm: { xMm: -50, zMm: 200 },
			endMm: { xMm: 200, zMm: 200 },
		});
		const result = placed(
			layoutDrawingDimensions([source], { projectPoint: identity, bounds })[0],
		);
		expect(result.baseline).toEqual({
			start: { x: 0, y: 168 },
			end: { x: 200, y: 168 },
		});
		expect(result.ticks).toHaveLength(1);
		expect(result.extensionLines).toHaveLength(1);
		expect(result.clipped).toBe(true);
		expect(result.dimension.startMm.xMm).toBe(-50);
	});

	it("reports offscreen, collapsed and unavailable projections instead of inventing screen coordinates", () => {
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: () => undefined,
				bounds,
			})[0],
		).toMatchObject({ kind: "unavailable", reason: "projection-unavailable" });
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: () => ({ x: 10, y: 10 }),
				bounds,
			})[0],
		).toMatchObject({ kind: "unavailable", reason: "collapsed-projection" });
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: () => ({ x: Number.NaN, y: 10 }),
				bounds,
			})[0].kind,
		).toBe("unavailable");
		expect(
			layoutDrawingDimensions(
				[
					dimension({
						startMm: { xMm: -300, zMm: -200 },
						endMm: { xMm: -100, zMm: -200 },
					}),
				],
				{ projectPoint: identity, bounds },
			)[0],
		).toMatchObject({ kind: "offscreen", reason: "outside-canvas" });
		expect(
			layoutDrawingDimensions([dimension()], {
				projectPoint: identity,
				bounds: { ...bounds, width: 0 },
			})[0].kind,
		).toBe("unavailable");
	});

	it("keeps a truthful collision-free subset of eight references when phone lanes are too tight", () => {
		const sources = [
			dimension({
				id: "top",
				startMm: { xMm: 0, zMm: 0 },
				endMm: { xMm: 4100, zMm: 0 },
				label: "4100",
				valueMm: 4100,
			}),
			dimension({
				id: "bottom",
				startMm: { xMm: 0, zMm: 3100 },
				endMm: { xMm: 4100, zMm: 3100 },
				preferredSide: "bottom",
				label: "4100",
				valueMm: 4100,
			}),
			dimension({
				id: "left",
				startMm: { xMm: 0, zMm: 0 },
				endMm: { xMm: 0, zMm: 3100 },
				preferredSide: "left",
				label: "3100",
				valueMm: 3100,
			}),
			dimension({
				id: "right",
				startMm: { xMm: 4100, zMm: 0 },
				endMm: { xMm: 4100, zMm: 3100 },
				preferredSide: "right",
				label: "3100",
				valueMm: 3100,
			}),
			dimension({
				id: "clear-x",
				kind: "room-clear",
				roomId: "room",
				reference: "clear",
				startMm: { xMm: 50, zMm: 50 },
				endMm: { xMm: 4050, zMm: 50 },
				label: "4000",
				valueMm: 4000,
			}),
			dimension({
				id: "clear-z",
				kind: "room-clear",
				roomId: "room",
				reference: "clear",
				startMm: { xMm: 50, zMm: 50 },
				endMm: { xMm: 50, zMm: 3050 },
				preferredSide: "left",
				label: "3000",
				valueMm: 3000,
			}),
			dimension({
				id: "overall-x",
				kind: "overall",
				reference: "outer",
				direction: "x",
				lane: 1,
				startMm: { xMm: -50, zMm: 0 },
				endMm: { xMm: 4150, zMm: 0 },
				label: "4200",
				valueMm: 4200,
			}),
			dimension({
				id: "overall-z",
				kind: "overall",
				reference: "outer",
				direction: "z",
				lane: 1,
				preferredSide: "left",
				startMm: { xMm: 0, zMm: -50 },
				endMm: { xMm: 0, zMm: 3150 },
				label: "3200",
				valueMm: 3200,
			}),
		];
		const viewport = { x: 0, y: 140, width: 393, height: 592 };
		const before = JSON.stringify(sources);
		const layouts = layoutDrawingDimensions(Object.freeze(sources), {
			projectPoint: (point) => ({
				x: 80 + point.xMm * 0.056,
				y: 250 + point.zMm * 0.056,
			}),
			bounds: viewport,
		});
		expect(layouts).toHaveLength(8);
		const results = layouts.filter(
			(value): value is Extract<DrawingDimensionLayout, { kind: "placed" }> =>
				value.kind === "placed",
		);
		expect(results.length).toBeGreaterThanOrEqual(4);
		expect(
			layouts
				.filter((value) => value.kind === "offscreen")
				.every((value) => value.reason === "layout-conflict"),
		).toBe(true);
		expect(results.every((result) => !result.crowded)).toBe(true);
		for (const { labelBounds: box } of results) {
			expect(box.x).toBeGreaterThanOrEqual(viewport.x);
			expect(box.y).toBeGreaterThanOrEqual(viewport.y);
			expect(box.x + box.width).toBeLessThanOrEqual(393);
			expect(box.y + box.height).toBeLessThanOrEqual(732);
		}
		expect(JSON.stringify(sources)).toBe(before);
	});
});
