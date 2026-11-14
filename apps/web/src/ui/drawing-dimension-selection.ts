import type { DrawingDimension } from "./drawing-dimensions";

type Point = DrawingDimension["startMm"];

/** Applied after category filters: only an entire visible chain can cover its own axis total. */
export function selectDrawingDimensions(
	dimensions: readonly DrawingDimension[],
): readonly DrawingDimension[] {
	const unique = new Map<string, DrawingDimension>();
	for (const dimension of [...dimensions].sort((a, b) => compare(a.id, b.id))) {
		const key = JSON.stringify([
			dimension.kind,
			dimension.reference,
			dimension.direction,
			dimension.wallSegmentId,
			dimension.openingId,
			dimension.roomId,
			orderedPoints(dimension.startMm, dimension.endMm),
			dimension.valueMm,
		]);
		if (!unique.has(key)) unique.set(key, dimension);
	}
	const candidates = [...unique.values()];
	const selected = candidates.filter(
		(dimension) =>
			dimension.kind !== "wall" || !coveredByChain(dimension, candidates),
	);
	const localLanes = selected.map((dimension) => {
		if (dimension.kind === "opening" || dimension.kind === "pier")
			return withLane(dimension, 0);
		if (dimension.kind !== "wall") return dimension;
		const hasChain = selected.some(
			(value) =>
				(value.kind === "opening" || value.kind === "pier") &&
				value.wallSegmentId === dimension.wallSegmentId &&
				value.reference === dimension.reference &&
				value.preferredSide === dimension.preferredSide,
		);
		return withLane(dimension, hasChain ? 1 : 0);
	});
	return localLanes.map((dimension) =>
		dimension.kind !== "overall"
			? dimension
			: withLane(
					dimension,
					1 +
						Math.max(
							-1,
							...localLanes
								.filter(
									(value) =>
										value.kind !== "overall" &&
										value.kind !== "room-clear" &&
										value.preferredSide === dimension.preferredSide,
								)
								.map((value) => value.lane),
						),
				),
	);
}

function withLane(dimension: DrawingDimension, lane: number): DrawingDimension {
	return dimension.lane === lane ? dimension : { ...dimension, lane };
}

function coveredByChain(
	wall: DrawingDimension,
	dimensions: readonly DrawingDimension[],
): boolean {
	if (
		!wall.wallSegmentId ||
		wall.reference !== "axis" ||
		wall.direction !== "aligned"
	)
		return false;
	const [start, end] = orderedPoints(wall.startMm, wall.endMm);
	const length = Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm);
	if (!Number.isFinite(length) || length <= 0) return false;
	const pieces = dimensions
		.filter(
			(value) =>
				(value.kind === "pier" || value.kind === "opening") &&
				value.wallSegmentId === wall.wallSegmentId &&
				value.reference === wall.reference &&
				value.direction === wall.direction,
		)
		.map((value) => ({
			value,
			points: orderedPoints(value.startMm, value.endMm),
		}))
		.sort((a, b) => comparePoints(a.points[0], b.points[0]));
	if (pieces.length === 0) return false;
	let cursor = start;
	for (const {
		value,
		points: [first, second],
	} of pieces) {
		if (
			!samePoint(cursor, first) ||
			!onLine(first, start, end, length) ||
			!onLine(second, start, end, length) ||
			comparePoints(first, second) >= 0 ||
			!Number.isFinite(value.valueMm) ||
			value.valueMm <= 0 ||
			Math.abs(
				Math.hypot(second.xMm - first.xMm, second.zMm - first.zMm) -
					value.valueMm,
			) > 1e-7
		)
			return false;
		cursor = second;
	}
	return samePoint(cursor, end);
}

function onLine(
	point: Point,
	start: Point,
	end: Point,
	length: number,
): boolean {
	// A diagonal's derived anchors contain floating-point sqrt(2); endpoints still match exactly.
	return (
		Math.abs(
			(point.xMm - start.xMm) * (end.zMm - start.zMm) -
				(point.zMm - start.zMm) * (end.xMm - start.xMm),
		) /
			length <=
		1e-7
	);
}
function samePoint(a: Point, b: Point): boolean {
	return a.xMm === b.xMm && a.zMm === b.zMm;
}
function comparePoints(a: Point, b: Point): number {
	return a.xMm - b.xMm || a.zMm - b.zMm;
}
function orderedPoints(a: Point, b: Point): readonly [Point, Point] {
	return comparePoints(a, b) <= 0 ? [a, b] : [b, a];
}
function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}
