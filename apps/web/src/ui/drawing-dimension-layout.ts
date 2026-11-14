import type { DrawingDimension } from "./drawing-dimensions";

export interface ScreenPoint {
	readonly x: number;
	readonly y: number;
}
export interface ScreenRect extends ScreenPoint {
	readonly width: number;
	readonly height: number;
}
export interface ScreenSegment {
	readonly start: ScreenPoint;
	readonly end: ScreenPoint;
}

export interface DrawingDimensionLayoutOptions {
	readonly projectPoint: (
		point: DrawingDimension["startMm"],
	) => ScreenPoint | undefined;
	/** Exposed SVG coordinates, excluding the measured header/dock if they cover the canvas. */
	readonly bounds: ScreenRect;
	readonly obstacles?: readonly ScreenRect[];
	/** Physical wall polygons constrain glyphs and leaders, while allowing constructive witness contact. */
	readonly contentObstacles?: readonly (readonly ScreenPoint[])[];
	readonly measureText?: (label: string) => {
		readonly width: number;
		readonly height: number;
	};
}

export type DrawingDimensionLayout =
	| {
			readonly kind: "placed";
			readonly dimension: DrawingDimension;
			readonly baseline: ScreenSegment | undefined;
			readonly extensionLines: readonly ScreenSegment[];
			readonly ticks: readonly ScreenSegment[];
			readonly textPoint: ScreenPoint;
			/** Centre-aligned SVG text; use dominant-baseline="central". */
			readonly textRotationDegrees: number;
			readonly labelBounds: ScreenRect;
			readonly labelPolygon: readonly ScreenPoint[];
			readonly leader?: ScreenSegment;
			readonly crowded: boolean;
			readonly crowdingReason?: "label-overlap";
			readonly clipped: boolean;
	  }
	| {
			readonly kind: "unavailable";
			readonly dimension: DrawingDimension;
			readonly reason:
				| "invalid-canvas-bounds"
				| "projection-unavailable"
				| "collapsed-projection"
				| "invalid-text-size";
	  }
	| {
			readonly kind: "offscreen";
			readonly dimension: DrawingDimension;
			readonly reason:
				| "outside-canvas"
				| "label-does-not-fit"
				| "layout-conflict";
	  };

type Placed = Extract<DrawingDimensionLayout, { readonly kind: "placed" }>;

type Projected = {
	readonly kind: "projected";
	readonly dimension: DrawingDimension;
	readonly start: ScreenPoint;
	readonly end: ScreenPoint;
	readonly tangent: ScreenPoint;
	readonly normal: ScreenPoint;
	readonly readingNormal: ScreenPoint;
	readonly angle: number;
	readonly size: { readonly width: number; readonly height: number };
};
type Occupied = {
	readonly layouts: readonly Placed[];
	readonly obstacles: readonly ScreenRect[];
	readonly contentObstacles: readonly (readonly ScreenPoint[])[];
};
const GAP = 4;
const EPSILON = 1e-8;

/** Whole chains share one baseline; an impossible group stays undisplayed rather than crowded. */
export function layoutDrawingDimensions(
	dimensions: readonly DrawingDimension[],
	options: DrawingDimensionLayoutOptions,
): readonly DrawingDimensionLayout[] {
	const groups = new Map<string, DrawingDimension[]>();
	const priority = (value: DrawingDimension) =>
		value.kind === "room-clear"
			? 0
			: value.kind === "opening" || value.kind === "pier"
				? 1
				: value.kind === "overall"
					? 2
					: 3;
	const factsPerRoom = new Map<string | undefined, number>();
	const ranked = [...dimensions]
		.sort((a, b) => compare(a.id, b.id))
		.map((dimension) => {
			const roomRank =
				dimension.kind === "room-clear"
					? (factsPerRoom.get(dimension.roomId) ?? 0)
					: 0;
			if (dimension.kind === "room-clear")
				factsPerRoom.set(dimension.roomId, roomRank + 1);
			return { dimension, roomRank };
		})
		.sort(
			(a, b) =>
				priority(a.dimension) - priority(b.dimension) ||
				a.roomRank - b.roomRank ||
				compare(a.dimension.id, b.dimension.id),
		);
	for (const { dimension } of ranked) {
		const key =
			(dimension.kind === "opening" || dimension.kind === "pier") &&
			dimension.wallSegmentId
				? JSON.stringify([
						"chain",
						dimension.wallSegmentId,
						dimension.reference,
						dimension.direction,
						dimension.preferredSide,
					])
				: JSON.stringify(["single", dimension.id]);
		const group = groups.get(key) ?? [];
		group.push(dimension);
		groups.set(key, group);
	}
	const accepted: Placed[] = [];
	const result: DrawingDimensionLayout[] = [];
	for (const group of groups.values()) {
		const projected = group.map((dimension) =>
			projectDimension(dimension, options),
		);
		const failure = projected.find((value) => value.kind !== "projected");
		if (failure) {
			result.push(
				...projected.map((value) =>
					value.kind === "projected" ? conflict(value.dimension) : value,
				),
			);
			continue;
		}
		const prepared = projected.filter(
			(value): value is Projected => value.kind === "projected",
		);
		const placed = placeGroup(prepared, options.bounds, {
			layouts: accepted,
			obstacles: options.obstacles ?? [],
			contentObstacles: options.contentObstacles ?? [],
		});
		if (placed) {
			result.push(...placed);
			accepted.push(...placed);
		} else result.push(...group.map(conflict));
	}
	return result;
}

function projectDimension(
	dimension: DrawingDimension,
	options: DrawingDimensionLayoutOptions,
): Projected | DrawingDimensionLayout {
	const unavailable = (
		reason: Extract<DrawingDimensionLayout, { kind: "unavailable" }>["reason"],
	): DrawingDimensionLayout => ({ kind: "unavailable", dimension, reason });
	if (!validRect(options.bounds)) return unavailable("invalid-canvas-bounds");
	let start: ScreenPoint | undefined;
	let end: ScreenPoint | undefined;
	let axisEnd: ScreenPoint | undefined;
	try {
		start = options.projectPoint(dimension.startMm);
		end = options.projectPoint(dimension.endMm);
		axisEnd =
			dimension.direction === "aligned"
				? end
				: options.projectPoint(
						dimension.direction === "x"
							? { xMm: dimension.endMm.xMm, zMm: dimension.startMm.zMm }
							: { xMm: dimension.startMm.xMm, zMm: dimension.endMm.zMm },
					);
	} catch {
		return unavailable("projection-unavailable");
	}
	if (!validPoint(start) || !validPoint(end) || !validPoint(axisEnd))
		return unavailable("projection-unavailable");
	const dx = axisEnd.x - start.x;
	const dy = axisEnd.y - start.y;
	const length = Math.hypot(dx, dy);
	if (!Number.isFinite(length)) return unavailable("projection-unavailable");
	if (length < EPSILON) return unavailable("collapsed-projection");
	if (!clipSegment({ start, end }, options.bounds))
		return { kind: "offscreen", dimension, reason: "outside-canvas" };
	let size: { readonly width: number; readonly height: number };
	try {
		size = options.measureText?.(dimension.label) ?? {
			width: dimension.label.length * 14 * 0.62 + 8,
			height: 18,
		};
	} catch {
		return unavailable("invalid-text-size");
	}
	if (
		![size.width, size.height].every(
			(value) => Number.isFinite(value) && value > 0,
		)
	)
		return unavailable("invalid-text-size");
	const sign = dx < 0 || (dx === 0 && dy < 0) ? -1 : 1;
	const tangent = { x: (dx / length) * sign, y: (dy / length) * sign };
	const rawNormal = { x: -tangent.y, y: tangent.x };
	const side = dimension.preferredSide;
	const preferred =
		side === "top"
			? { x: 0, y: -1 }
			: side === "bottom"
				? { x: 0, y: 1 }
				: side === "left"
					? { x: -1, y: 0 }
					: { x: 1, y: 0 };
	const normalSign =
		(dot(rawNormal, preferred) < 0 ? -1 : 1) *
		(dimension.kind === "room-clear" ? -1 : 1);
	const normal = { x: rawNormal.x * normalSign, y: rawNormal.y * normalSign };
	let angle = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI;
	if (angle >= 90) angle -= 180;
	const radians = (angle * Math.PI) / 180;
	const readingNormal = { x: Math.sin(radians), y: -Math.cos(radians) };
	const box = polygonBounds(textPolygon({ x: 0, y: 0 }, size, angle));
	if (box.width > options.bounds.width || box.height > options.bounds.height)
		return { kind: "offscreen", dimension, reason: "label-does-not-fit" };
	return {
		kind: "projected",
		dimension,
		start,
		end,
		tangent,
		normal,
		readingNormal,
		angle,
		size,
	};
}

function placeGroup(
	group: readonly Projected[],
	bounds: ScreenRect,
	occupied: Occupied,
): readonly Placed[] | undefined {
	const first = group[0];
	if (!first) return undefined;
	const normal = first.normal;
	const lane = Math.max(0, ...group.map((value) => value.dimension.lane));
	// On the inward side the readable number can face its usable-room boundary.
	// Reserve its full measured height, the text gap and eight pixels beyond it.
	const baseOffset =
		first.dimension.kind === "room-clear"
			? Math.max(24, ...group.map((value) => value.size.height + GAP + 8))
			: 32;
	const ordered = [...group].sort(
		(a, b) =>
			dot(a.start, first.tangent) - dot(b.start, first.tangent) ||
			compare(a.dimension.id, b.dimension.id),
	);
	for (let extraLane = 0; extraLane < 6; extraLane++) {
		const offset = baseOffset + (lane + extraLane) * 28;
		const plane =
			Math.max(
				...group.flatMap((value) => [
					dot(value.start, normal),
					dot(value.end, normal),
				]),
			) + offset;
		const frames = ordered.map((value) =>
			frameFor(value, normal, plane, bounds),
		);
		if (frames.some((frame) => !frame)) continue;
		const validFrames = frames.filter(
			(frame): frame is Placed => frame !== undefined,
		);
		const lines = validFrames.flatMap(segmentsFor);
		if (
			lines.some(
				(line) =>
					occupied.obstacles.some((rect) =>
						lineHitsPolygon(line, rectPolygon(rect)),
					) ||
					occupied.layouts.some(
						(layout) =>
							lineHitsPolygon(line, expandedLabel(layout)) ||
							(!sameClearRoom(first.dimension, layout.dimension) &&
								segmentsFor(layout).some((other) => crosses(line, other))),
					),
			)
		)
			continue;
		const labels: Placed[] = [];
		let failed = false;
		for (let index = 0; index < ordered.length; index++) {
			const source = ordered[index];
			const frame = validFrames[index];
			if (!source || !frame) {
				failed = true;
				break;
			}
			const label = placeLabel(source, frame, bounds, lines, occupied, labels);
			if (!label) {
				failed = true;
				break;
			}
			labels.push(label);
		}
		if (!failed) return labels;
	}
	return undefined;
}

function frameFor(
	source: Projected,
	normal: ScreenPoint,
	plane: number,
	bounds: ScreenRect,
): Placed | undefined {
	const first = add(source.start, normal, plane - dot(source.start, normal));
	const second = add(source.end, normal, plane - dot(source.end, normal));
	const baseline = { start: first, end: second };
	const clippedBaseline = clipSegment(baseline, bounds);
	if (!clippedBaseline) return undefined;
	const extensions = [
		{ start: add(source.start, normal, GAP), end: add(first, normal, 6) },
		{ start: add(source.end, normal, GAP), end: add(second, normal, 6) },
	];
	// The tick's handedness follows the normalized line, independently of its placement side.
	const tickDirection = {
		x: (source.tangent.x + source.tangent.y) * Math.SQRT1_2,
		y: (source.tangent.y - source.tangent.x) * Math.SQRT1_2,
	};
	const ticks = [first, second].map((point) => ({
		start: add(point, tickDirection, -5),
		end: add(point, tickDirection, 5),
	}));
	const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
	return {
		kind: "placed",
		dimension: source.dimension,
		baseline: clippedBaseline,
		extensionLines: clippedSegments(extensions, bounds),
		ticks: clippedSegments(ticks, bounds),
		textPoint: middle,
		textRotationDegrees: source.angle,
		labelBounds: { ...middle, width: 0, height: 0 },
		labelPolygon: [],
		crowded: false,
		clipped:
			!sameSegment(baseline, clippedBaseline) ||
			[...extensions, ...ticks].some(
				(line) => !sameSegment(line, clipSegment(line, bounds)),
			),
	};
}

function placeLabel(
	source: Projected,
	frame: Placed,
	bounds: ScreenRect,
	groupLines: readonly ScreenSegment[],
	occupied: Occupied,
	siblings: readonly Placed[],
): Placed | undefined {
	if (!frame.baseline) return undefined;
	// Retain the un-clipped witness midpoint: clipping must not invent a measurement origin.
	const plane = dot(frame.baseline.start, source.normal);
	const first = add(
		source.start,
		source.normal,
		plane - dot(source.start, source.normal),
	);
	const second = add(
		source.end,
		source.normal,
		plane - dot(source.end, source.normal),
	);
	const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
	const short =
		Math.hypot(second.x - first.x, second.y - first.y) < source.size.width + 12;
	const others = [...occupied.layouts, ...siblings];
	for (let textRow = 0; textRow < 3; textRow++) {
		for (const shift of [
			0,
			-(source.size.width + 12),
			source.size.width + 12,
		]) {
			const textPoint = add(
				add(
					middle,
					source.readingNormal,
					source.size.height / 2 + GAP + textRow * (source.size.height + 8),
				),
				source.tangent,
				shift,
			);
			const polygon = textPolygon(textPoint, source.size, source.angle);
			const box = polygonBounds(polygon);
			if (!insideRect(box, bounds)) continue;
			if (
				source.dimension.kind === "room-clear" &&
				polygon.some(
					(point) =>
						dot(point, source.normal) -
							Math.max(
								dot(source.start, source.normal),
								dot(source.end, source.normal),
							) <
						8 - EPSILON,
				)
			)
				continue;
			const protectedPolygon = textPolygon(
				textPoint,
				{ width: source.size.width + GAP, height: source.size.height + GAP },
				source.angle,
			);
			if (
				occupied.obstacles.some((rect) =>
					polygonsOverlap(protectedPolygon, rectPolygon(rect)),
				) ||
				occupied.contentObstacles.some((polygon) =>
					polygonsOverlap(protectedPolygon, polygon),
				) ||
				others.some((other) =>
					polygonsOverlap(protectedPolygon, expandedLabel(other)),
				) ||
				[...groupLines, ...others.flatMap(segmentsFor)].some((line) =>
					lineHitsPolygon(line, protectedPolygon),
				)
			)
				continue;
			const leader =
				short || shift !== 0 || textRow !== 0
					? leaderToLabel(middle, textPoint, source.size, source.angle)
					: undefined;
			if (
				leader &&
				(occupied.obstacles.some((rect) =>
					lineHitsPolygon(leader, rectPolygon(rect)),
				) ||
					occupied.contentObstacles.some((polygon) =>
						lineHitsPolygon(leader, polygon),
					) ||
					others.some((other) =>
						lineHitsPolygon(leader, expandedLabel(other)),
					) ||
					[...groupLines, ...others.flatMap(segmentsFor)].some((line) =>
						crosses(leader, line),
					))
			)
				continue;
			return {
				...frame,
				textPoint,
				labelBounds: box,
				labelPolygon: polygon,
				...(leader ? { leader } : {}),
			};
		}
	}
	return undefined;
}

function leaderToLabel(
	start: ScreenPoint,
	center: ScreenPoint,
	size: { readonly width: number; readonly height: number },
	angle: number,
): ScreenSegment | undefined {
	const dx = start.x - center.x;
	const dy = start.y - center.y;
	const distance = Math.hypot(dx, dy);
	if (distance < EPSILON) return undefined;
	const direction = { x: dx / distance, y: dy / distance };
	const radians = (angle * Math.PI) / 180;
	const along = Math.abs(
		direction.x * Math.cos(radians) + direction.y * Math.sin(radians),
	);
	const across = Math.abs(
		-direction.x * Math.sin(radians) + direction.y * Math.cos(radians),
	);
	const edge =
		Math.min(
			along > EPSILON ? size.width / 2 / along : Infinity,
			across > EPSILON ? size.height / 2 / across : Infinity,
		) + 2;
	return edge >= distance
		? undefined
		: { start, end: add(center, direction, edge) };
}

function conflict(dimension: DrawingDimension): DrawingDimensionLayout {
	return { kind: "offscreen", dimension, reason: "layout-conflict" };
}
function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}
function sameClearRoom(a: DrawingDimension, b: DrawingDimension): boolean {
	return (
		a.kind === "room-clear" &&
		b.kind === "room-clear" &&
		a.roomId !== undefined &&
		a.roomId === b.roomId
	);
}
function segmentsFor(layout: Placed): readonly ScreenSegment[] {
	return [
		...layout.extensionLines,
		...layout.ticks,
		...(layout.baseline ? [layout.baseline] : []),
		...(layout.leader ? [layout.leader] : []),
	];
}
function textPolygon(
	center: ScreenPoint,
	size: { readonly width: number; readonly height: number },
	angle: number,
): readonly ScreenPoint[] {
	const radians = (angle * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return (
		[
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1],
		] as const
	).map(([x, y]) => ({
		x: center.x + ((x * size.width) / 2) * cos - ((y * size.height) / 2) * sin,
		y: center.y + ((x * size.width) / 2) * sin + ((y * size.height) / 2) * cos,
	}));
}
function polygonBounds(points: readonly ScreenPoint[]): ScreenRect {
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
function expandedLabel(layout: Placed): readonly ScreenPoint[] {
	const radians = (layout.textRotationDegrees * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return layout.labelPolygon.map((point) => {
		const dx = point.x - layout.textPoint.x;
		const dy = point.y - layout.textPoint.y;
		const localX = dx * cos + dy * sin;
		const localY = -dx * sin + dy * cos;
		return {
			x: point.x + Math.sign(localX) * 2 * cos - Math.sign(localY) * 2 * sin,
			y: point.y + Math.sign(localX) * 2 * sin + Math.sign(localY) * 2 * cos,
		};
	});
}
function rectPolygon(rect: ScreenRect): readonly ScreenPoint[] {
	return [
		{ x: rect.x, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y + rect.height },
		{ x: rect.x, y: rect.y + rect.height },
	];
}
function insideRect(a: ScreenRect, b: ScreenRect): boolean {
	return (
		a.x >= b.x - EPSILON &&
		a.y >= b.y - EPSILON &&
		a.x + a.width <= b.x + b.width + EPSILON &&
		a.y + a.height <= b.y + b.height + EPSILON
	);
}
function polygonsOverlap(
	a: readonly ScreenPoint[],
	b: readonly ScreenPoint[],
): boolean {
	for (const polygon of [a, b])
		for (let index = 0; index < polygon.length; index++) {
			const start = polygon[index];
			const end = polygon[(index + 1) % polygon.length];
			if (!start || !end) continue;
			const axis = { x: -(end.y - start.y), y: end.x - start.x };
			const first = a.map((point) => dot(point, axis));
			const second = b.map((point) => dot(point, axis));
			if (
				Math.max(...first) <= Math.min(...second) + EPSILON ||
				Math.max(...second) <= Math.min(...first) + EPSILON
			)
				return false;
		}
	return true;
}
function lineHitsPolygon(
	line: ScreenSegment,
	polygon: readonly ScreenPoint[],
): boolean {
	if (pointInPolygon(line.start, polygon) || pointInPolygon(line.end, polygon))
		return true;
	return polygon.some((start, index) => {
		const end = polygon[(index + 1) % polygon.length];
		return end !== undefined && intersects(line, { start, end });
	});
}
function pointInPolygon(
	point: ScreenPoint,
	polygon: readonly ScreenPoint[],
): boolean {
	let sign = 0;
	for (let index = 0; index < polygon.length; index++) {
		const start = polygon[index];
		const end = polygon[(index + 1) % polygon.length];
		if (!start || !end) return false;
		const cross =
			(end.x - start.x) * (point.y - start.y) -
			(end.y - start.y) * (point.x - start.x);
		if (Math.abs(cross) < EPSILON) continue;
		if (sign && Math.sign(cross) !== sign) return false;
		sign = Math.sign(cross);
	}
	return polygon.length > 0;
}
function intersects(a: ScreenSegment, b: ScreenSegment): boolean {
	const dx = a.end.x - a.start.x;
	const dy = a.end.y - a.start.y;
	const ex = b.end.x - b.start.x;
	const ey = b.end.y - b.start.y;
	const denominator = dx * ey - dy * ex;
	if (Math.abs(denominator) < EPSILON) return false;
	const x = b.start.x - a.start.x;
	const y = b.start.y - a.start.y;
	const t = (x * ey - y * ex) / denominator;
	const u = (x * dy - y * dx) / denominator;
	return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON;
}
/** Shared end joints and collinear strokes are intentional; foreign interior crossings are not. */
function crosses(a: ScreenSegment, b: ScreenSegment): boolean {
	if (!intersects(a, b)) return false;
	const dx = a.end.x - a.start.x;
	const dy = a.end.y - a.start.y;
	const ex = b.end.x - b.start.x;
	const ey = b.end.y - b.start.y;
	const denominator = dx * ey - dy * ex;
	const x = b.start.x - a.start.x;
	const y = b.start.y - a.start.y;
	const t = (x * ey - y * ex) / denominator;
	const u = (x * dy - y * dx) / denominator;
	return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON;
}

function validPoint(value: ScreenPoint | undefined): value is ScreenPoint {
	return (
		value !== undefined && Number.isFinite(value.x) && Number.isFinite(value.y)
	);
}
function validRect(value: ScreenRect): boolean {
	return (
		[
			value.x,
			value.y,
			value.width,
			value.height,
			value.x + value.width,
			value.y + value.height,
		].every(Number.isFinite) &&
		value.width > 0 &&
		value.height > 0
	);
}
function dot(a: ScreenPoint, b: ScreenPoint): number {
	return a.x * b.x + a.y * b.y;
}
function add(
	point: ScreenPoint,
	direction: ScreenPoint,
	amount: number,
): ScreenPoint {
	return {
		x: point.x + direction.x * amount,
		y: point.y + direction.y * amount,
	};
}
function sameSegment(a: ScreenSegment, b: ScreenSegment | undefined): boolean {
	return (
		b !== undefined &&
		a.start.x === b.start.x &&
		a.start.y === b.start.y &&
		a.end.x === b.end.x &&
		a.end.y === b.end.y
	);
}
function clippedSegments(
	lines: readonly ScreenSegment[],
	bounds: ScreenRect,
): readonly ScreenSegment[] {
	return lines.flatMap((line) => {
		const clipped = clipSegment(line, bounds);
		return clipped ? [clipped] : [];
	});
}

/** Liang–Barsky clipping retains the true endpoints separately; ticks are never added at clip boundaries. */
function clipSegment(
	line: ScreenSegment,
	bounds: ScreenRect,
): ScreenSegment | undefined {
	const dx = line.end.x - line.start.x;
	const dy = line.end.y - line.start.y;
	let from = 0;
	let to = 1;
	for (const [p, q] of [
		[-dx, line.start.x - bounds.x],
		[dx, bounds.x + bounds.width - line.start.x],
		[-dy, line.start.y - bounds.y],
		[dy, bounds.y + bounds.height - line.start.y],
	]) {
		if (p === 0) {
			if (q < 0) return undefined;
			continue;
		}
		const ratio = q / p;
		if (p < 0) from = Math.max(from, ratio);
		else to = Math.min(to, ratio);
		if (from > to) return undefined;
	}
	return {
		start: { x: line.start.x + dx * from, y: line.start.y + dy * from },
		end: { x: line.start.x + dx * to, y: line.start.y + dy * to },
	};
}
