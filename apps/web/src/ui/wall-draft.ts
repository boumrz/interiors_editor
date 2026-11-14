import { PLAN_GRID_STEP_MM } from "../domain/constrained-partition";

/**
 * A small, intentional construction magnet: two grid cells are close enough
 * to finish a junction on a phone, while a user can still draw a genuinely
 * parallel wall beside an existing one.
 */
export const WALL_JOIN_TARGET_HALF_SIZE_CSS_PX = 12;

export interface WallDraftPoint {
	readonly xMm: number;
	readonly zMm: number;
}

export interface WallDraftSegment {
	readonly end: WallDraftPoint;
	readonly start: WallDraftPoint;
}

/** Remove covered spans and accidental overshoot, preserving an explicit wall
 * endpoint across interior partitions. Exact numeric commands bypass this aid. */
export function normalizeWallGestureDraft(
	start: WallDraftPoint,
	end: WallDraftPoint,
	walls: readonly WallDraftSegment[],
): WallDraftSegment | undefined {
	if (
		![start.xMm, start.zMm, end.xMm, end.zMm].every(Number.isSafeInteger) ||
		!exactWallDirection(start, end)
	)
		return undefined;
	const dx = end.xMm - start.xMm;
	const dz = end.zMm - start.zMm;
	const parameter = (point: WallDraftPoint) =>
		dx !== 0 ? (point.xMm - start.xMm) / dx : (point.zMm - start.zMm) / dz;
	const collinear = (point: WallDraftPoint) =>
		(point.xMm - start.xMm) * dz === (point.zMm - start.zMm) * dx;
	const covered = walls
		.filter((wall) => collinear(wall.start) && collinear(wall.end))
		.map((wall) => ({
			from: Math.max(0, Math.min(parameter(wall.start), parameter(wall.end))),
			to: Math.min(1, Math.max(parameter(wall.start), parameter(wall.end))),
		}))
		.filter((interval) => interval.to > interval.from)
		.sort((a, b) => a.from - b.from || a.to - b.to);
	let from = 0;
	let to = 1;
	for (const interval of covered) {
		if (interval.from > from) {
			to = interval.from;
			break;
		}
		from = Math.max(from, interval.to);
	}
	if (from >= to) return undefined;
	if (!walls.some((wall) => isPointOnSegment(end, wall))) {
		for (const wall of walls) {
			const contact = exactRaySegmentIntersection(start, end, wall);
			if (!contact) continue;
			const at = parameter(contact);
			if (at > from && at < to) to = at;
		}
	}
	const at = (value: number): WallDraftPoint => ({
		xMm: Math.round(start.xMm + dx * value),
		zMm: Math.round(start.zMm + dz * value),
	});
	return { start: at(from), end: at(to) };
}

export interface WallDraftStartSnapOptions {
	readonly radiusMm: number;
	/** A pointer that already hit a wall body may deliberately request its full join radius. */
	readonly wallBodyRadiusMm?: number;
	readonly vertices: readonly WallDraftPoint[];
	readonly wallSegments: readonly WallDraftSegment[];
}

export interface WallDraftEndSnapOptions {
	readonly radiusMm: number;
	readonly vertices?: readonly WallDraftPoint[];
	readonly wallSegments: readonly WallDraftSegment[];
}

export interface WallDraftAlignmentGuide {
	readonly from: WallDraftPoint;
	readonly to: WallDraftPoint;
}

interface CardinalDirection {
	readonly x: -1 | 0 | 1;
	readonly z: -1 | 0 | 1;
}

export type WallDraftDirection =
	| "E"
	| "NE"
	| "N"
	| "NW"
	| "W"
	| "SW"
	| "S"
	| "SE";

export interface ConstrainedWallDraft {
	readonly direction: WallDraftDirection;
	readonly end: WallDraftPoint;
}

export function wallJoinTargetRadiusMm(
	pixelsPerMm: number,
): number | undefined {
	return Number.isFinite(pixelsPerMm) && pixelsPerMm > 0
		? WALL_JOIN_TARGET_HALF_SIZE_CSS_PX / pixelsPerMm
		: undefined;
}

export function isWallDraftConfirmable(
	start: WallDraftPoint,
	end: WallDraftPoint,
	thicknessMm: number,
): boolean {
	if (
		!Number.isSafeInteger(start.xMm) ||
		!Number.isSafeInteger(start.zMm) ||
		!Number.isSafeInteger(end.xMm) ||
		!Number.isSafeInteger(end.zMm) ||
		!Number.isSafeInteger(thicknessMm) ||
		thicknessMm <= 0
	) {
		return false;
	}
	const deltaX = end.xMm - start.xMm;
	const deltaZ = end.zMm - start.zMm;
	return deltaX ** 2 + deltaZ ** 2 > thicknessMm ** 2;
}

interface ConstrainedDirection extends CardinalDirection {
	readonly direction: WallDraftDirection;
	readonly lengthFactor: 1 | typeof Math.SQRT2;
}

const cardinalDirections: readonly CardinalDirection[] = [
	{ x: 1, z: 0 },
	{ x: 0, z: -1 },
	{ x: -1, z: 0 },
	{ x: 0, z: 1 },
];

const constrainedDirections: readonly ConstrainedDirection[] = [
	{ direction: "E", lengthFactor: 1, x: 1, z: 0 },
	{ direction: "NE", lengthFactor: Math.SQRT2, x: 1, z: -1 },
	{ direction: "N", lengthFactor: 1, x: 0, z: -1 },
	{ direction: "NW", lengthFactor: Math.SQRT2, x: -1, z: -1 },
	{ direction: "W", lengthFactor: 1, x: -1, z: 0 },
	{ direction: "SW", lengthFactor: Math.SQRT2, x: -1, z: 1 },
	{ direction: "S", lengthFactor: 1, x: 0, z: 1 },
	{ direction: "SE", lengthFactor: Math.SQRT2, x: 1, z: 1 },
];

/**
 * Creates the one allowed alpha-direction candidate from a raw gesture. The
 * endpoint is always on the origin-relative 100-mm construction grid: for a
 * diagonal, both coordinate deltas use the same exact integer step.
 */
export function snapConstrainedWallDraft(
	origin: WallDraftPoint,
	candidate: WallDraftPoint,
	stepMm = PLAN_GRID_STEP_MM,
): ConstrainedWallDraft | undefined {
	if (
		!Number.isSafeInteger(origin.xMm) ||
		!Number.isSafeInteger(origin.zMm) ||
		!Number.isFinite(candidate.xMm) ||
		!Number.isFinite(candidate.zMm) ||
		!Number.isSafeInteger(stepMm) ||
		stepMm <= 0
	) {
		return undefined;
	}
	const deltaX = candidate.xMm - origin.xMm;
	const deltaZ = candidate.zMm - origin.zMm;
	if (deltaX === 0 && deltaZ === 0) {
		return undefined;
	}
	const direction = constrainedDirections.reduce((best, current) => {
		const currentProjection =
			(deltaX * current.x + deltaZ * current.z) / current.lengthFactor;
		const bestProjection =
			(deltaX * best.x + deltaZ * best.z) / best.lengthFactor;
		return currentProjection > bestProjection ? current : best;
	});
	const directedCoordinateDistanceMm =
		direction.x !== 0 && direction.z !== 0
			? (deltaX * direction.x + deltaZ * direction.z) / 2
			: deltaX * direction.x + deltaZ * direction.z;
	const steps = Math.max(
		1,
		Math.floor((directedCoordinateDistanceMm + stepMm / 2) / stepMm),
	);
	const end = {
		xMm: origin.xMm + direction.x * steps * stepMm,
		zMm: origin.zMm + direction.z * steps * stepMm,
	};
	return Number.isSafeInteger(end.xMm) && Number.isSafeInteger(end.zMm)
		? { direction: direction.direction, end }
		: undefined;
}

/**
 * Produces the transient cardinal construction candidate from a gesture
 * origin. The visual grid may be panned or use another display density, so
 * this deliberately never rounds the origin itself onto global coordinates.
 */
export function snapCardinalWallDraft(
	origin: WallDraftPoint,
	candidate: WallDraftPoint,
	stepMm = PLAN_GRID_STEP_MM,
): WallDraftPoint | undefined {
	if (
		!Number.isSafeInteger(origin.xMm) ||
		!Number.isSafeInteger(origin.zMm) ||
		!Number.isFinite(candidate.xMm) ||
		!Number.isFinite(candidate.zMm) ||
		!Number.isSafeInteger(stepMm) ||
		stepMm <= 0
	) {
		return undefined;
	}
	const deltaX = candidate.xMm - origin.xMm;
	const deltaZ = candidate.zMm - origin.zMm;
	if (deltaX === 0 && deltaZ === 0) {
		return undefined;
	}
	const direction = cardinalDirections.reduce((best, current) => {
		const currentProjection = deltaX * current.x + deltaZ * current.z;
		const bestProjection = deltaX * best.x + deltaZ * best.z;
		return currentProjection > bestProjection ? current : best;
	});
	const directedDistanceMm = deltaX * direction.x + deltaZ * direction.z;
	const steps = Math.max(
		1,
		Math.floor((directedDistanceMm + stepMm / 2) / stepMm),
	);
	const xMm = origin.xMm + direction.x * steps * stepMm;
	const zMm = origin.zMm + direction.z * steps * stepMm;
	return Number.isSafeInteger(xMm) && Number.isSafeInteger(zMm)
		? { xMm, zMm }
		: undefined;
}

/** Chooses the closest existing corner within the construction magnet radius. */
export function snapWallDraftStart(
	candidate: WallDraftPoint,
	options: WallDraftStartSnapOptions,
): WallDraftPoint {
	if (
		!Number.isFinite(options.radiusMm) ||
		options.radiusMm < 0 ||
		(options.wallBodyRadiusMm !== undefined &&
			(!Number.isFinite(options.wallBodyRadiusMm) ||
				options.wallBodyRadiusMm < 0))
	) {
		return candidate;
	}
	const vertex = nearestPoint(candidate, options.vertices, options.radiusMm);
	if (vertex) {
		return vertex;
	}
	const wallBodyRadiusMm = Math.min(
		options.radiusMm,
		options.wallBodyRadiusMm ?? options.radiusMm / 2,
	);
	const wallProjections = options.wallSegments.map((wall) =>
		closestPointOnSegment(candidate, wall),
	);
	return (
		nearestPoint(candidate, wallProjections, wallBodyRadiusMm) ?? candidate
	);
}

/**
 * Finishes a cardinal wall on a nearby perpendicular segment if possible;
 * otherwise it keeps the normal relative-grid endpoint. This makes a drawn
 * segment topologically joinable without requiring pixel-perfect input.
 */
export function snapWallDraftEnd(
	start: WallDraftPoint,
	candidate: WallDraftPoint,
	options: WallDraftEndSnapOptions,
	stepMm = PLAN_GRID_STEP_MM,
): WallDraftPoint | undefined {
	if (!Number.isFinite(options.radiusMm) || options.radiusMm < 0) {
		return undefined;
	}
	const cardinal = snapCardinalWallDraft(start, candidate, stepMm);
	if (!cardinal) {
		return undefined;
	}
	const joins = options.wallSegments.flatMap((wall) => {
		const intersection = exactRaySegmentIntersection(start, cardinal, wall);
		return intersection ? [intersection] : [];
	});
	const alignedVertices = (options.vertices ?? []).filter(
		(vertex) =>
			(start.xMm === cardinal.xMm
				? vertex.xMm === start.xMm
				: vertex.zMm === start.zMm) && isForwardTarget(start, cardinal, vertex),
	);
	const targets = [...joins, ...alignedVertices];
	return (
		nearestPoint(candidate, targets, options.radiusMm) ??
		nearestPoint(cardinal, targets, options.radiusMm) ??
		cardinal
	);
}

/**
 * Creates the visible 0/45/90-degree draft used by the Wall gesture. Cardinal
 * directions retain the established endpoint/intersection magnet. A diagonal
 * may close only onto an existing exact 45-degree corner; wall-body contacts
 * stay on the relative grid until they have equivalent topology normalization.
 */
export function snapConstrainedWallDraftEnd(
	start: WallDraftPoint,
	candidate: WallDraftPoint,
	options: WallDraftEndSnapOptions,
	stepMm = PLAN_GRID_STEP_MM,
): ConstrainedWallDraft | undefined {
	if (!Number.isFinite(options.radiusMm) || options.radiusMm < 0) {
		return undefined;
	}
	const constrained = snapConstrainedWallDraft(start, candidate, stepMm);
	if (!constrained) {
		return undefined;
	}
	const exactCorner = nearestExactCorner(
		start,
		candidate,
		options.vertices ?? [],
		options.radiusMm,
	);
	if (exactCorner) {
		return exactCorner;
	}
	if (
		constrained.direction === "NE" ||
		constrained.direction === "NW" ||
		constrained.direction === "SW" ||
		constrained.direction === "SE"
	) {
		const diagonalCorners = (options.vertices ?? []).filter((vertex) =>
			hasExactDirection(start, vertex, constrained.direction),
		);
		const diagonalCorner =
			nearestPoint(candidate, diagonalCorners, options.radiusMm) ??
			nearestPoint(constrained.end, diagonalCorners, options.radiusMm);
		const diagonalContacts = options.wallSegments.flatMap((wall) => {
			const intersection = exactRaySegmentIntersection(
				start,
				constrained.end,
				wall,
			);
			return intersection ? [intersection] : [];
		});
		const diagonalContact =
			nearestPoint(candidate, diagonalContacts, options.radiusMm) ??
			nearestPoint(constrained.end, diagonalContacts, options.radiusMm);
		return diagonalCorner
			? { direction: constrained.direction, end: diagonalCorner }
			: diagonalContact
				? { direction: constrained.direction, end: diagonalContact }
				: constrained;
	}
	const end = snapWallDraftEnd(start, candidate, options, stepMm);
	return end ? { direction: constrained.direction, end } : undefined;
}

/**
 * A close touch on a visible corner means "join this corner" even when the
 * short final gesture is measured a few millimetres closer to a cardinal
 * direction. The chosen vertex must still form one of the alpha directions.
 */
function nearestExactCorner(
	start: WallDraftPoint,
	candidate: WallDraftPoint,
	vertices: readonly WallDraftPoint[],
	radiusMm: number,
): ConstrainedWallDraft | undefined {
	if (!Number.isFinite(radiusMm) || radiusMm < 0) return undefined;
	return vertices
		.flatMap((end) => {
			const direction = exactWallDirection(start, end);
			return direction ? [{ direction, end }] : [];
		})
		.map((corner) => ({
			corner,
			distanceSquared: squaredDistance(candidate, corner.end),
		}))
		.filter(({ distanceSquared }) => distanceSquared <= radiusMm ** 2)
		.sort(
			(first, second) =>
				first.distanceSquared - second.distanceSquared ||
				first.corner.end.xMm - second.corner.end.xMm ||
				first.corner.end.zMm - second.corner.end.zMm,
		)[0]?.corner;
}

function hasExactDirection(
	start: WallDraftPoint,
	end: WallDraftPoint,
	direction: WallDraftDirection,
): boolean {
	return exactWallDirection(start, end) === direction;
}

function exactWallDirection(
	start: WallDraftPoint,
	end: WallDraftPoint,
): WallDraftDirection | undefined {
	const deltaX = end.xMm - start.xMm;
	const deltaZ = end.zMm - start.zMm;
	if (deltaX === 0 && deltaZ === 0) {
		return undefined;
	}
	if (deltaX === 0) return deltaZ < 0 ? "N" : "S";
	if (deltaZ === 0) return deltaX < 0 ? "W" : "E";
	if (Math.abs(deltaX) !== Math.abs(deltaZ)) return undefined;
	if (deltaX > 0) return deltaZ < 0 ? "NE" : "SE";
	return deltaZ < 0 ? "NW" : "SW";
}

/**
 * A visual-only PowerPoint-style guide from the raw pointer to the magnetic
 * endpoint. The guide never participates in the persisted graph, so a user
 * can still freely draw when no alignment is useful.
 */
export function wallDraftAlignmentGuide(
	_start: WallDraftPoint,
	rawEnd: WallDraftPoint,
	snappedEnd: WallDraftPoint,
	options?: WallDraftEndSnapOptions,
): WallDraftAlignmentGuide | undefined {
	const joinedExistingTarget =
		options !== undefined &&
		((options.vertices ?? []).some(
			(vertex) =>
				vertex.xMm === snappedEnd.xMm && vertex.zMm === snappedEnd.zMm,
		) ||
			options.wallSegments.some((wall) => isPointOnSegment(snappedEnd, wall)));
	return !joinedExistingTarget ||
		(rawEnd.xMm === snappedEnd.xMm && rawEnd.zMm === snappedEnd.zMm)
		? undefined
		: { from: rawEnd, to: snappedEnd };
}

function nearestPoint(
	candidate: WallDraftPoint,
	points: readonly WallDraftPoint[],
	radiusMm: number,
): WallDraftPoint | undefined {
	if (!Number.isFinite(radiusMm) || radiusMm < 0) {
		return undefined;
	}
	const radiusSquared = radiusMm ** 2;
	return points
		.map((point) => ({
			distanceSquared: squaredDistance(candidate, point),
			point,
		}))
		.filter(({ distanceSquared }) => distanceSquared <= radiusSquared)
		.sort(
			(first, second) =>
				first.distanceSquared - second.distanceSquared ||
				first.point.xMm - second.point.xMm ||
				first.point.zMm - second.point.zMm,
		)[0]?.point;
}

function exactRaySegmentIntersection(
	start: WallDraftPoint,
	end: WallDraftPoint,
	wall: WallDraftSegment,
): WallDraftPoint | undefined {
	if (
		![start, end, wall.start, wall.end].every(
			(point) =>
				Number.isSafeInteger(point.xMm) && Number.isSafeInteger(point.zMm),
		)
	) {
		return undefined;
	}
	const rayX = BigInt(end.xMm - start.xMm);
	const rayZ = BigInt(end.zMm - start.zMm);
	const wallX = BigInt(wall.end.xMm - wall.start.xMm);
	const wallZ = BigInt(wall.end.zMm - wall.start.zMm);
	let denominator = rayX * wallZ - rayZ * wallX;
	if (denominator === 0n) {
		return undefined;
	}
	const offsetX = BigInt(wall.start.xMm - start.xMm);
	const offsetZ = BigInt(wall.start.zMm - start.zMm);
	let rayNumerator = offsetX * wallZ - offsetZ * wallX;
	let wallNumerator = offsetX * rayZ - offsetZ * rayX;
	if (denominator < 0n) {
		denominator = -denominator;
		rayNumerator = -rayNumerator;
		wallNumerator = -wallNumerator;
	}
	if (rayNumerator <= 0n || wallNumerator < 0n || wallNumerator > denominator) {
		return undefined;
	}
	const xNumerator = BigInt(start.xMm) * denominator + rayX * rayNumerator;
	const zNumerator = BigInt(start.zMm) * denominator + rayZ * rayNumerator;
	if (xNumerator % denominator !== 0n || zNumerator % denominator !== 0n) {
		return undefined;
	}
	const xMm = Number(xNumerator / denominator);
	const zMm = Number(zNumerator / denominator);
	return Number.isSafeInteger(xMm) && Number.isSafeInteger(zMm)
		? { xMm, zMm }
		: undefined;
}

function isPointOnSegment(
	point: WallDraftPoint,
	segment: WallDraftSegment,
): boolean {
	return (
		(segment.end.xMm - segment.start.xMm) * (point.zMm - segment.start.zMm) ===
			(segment.end.zMm - segment.start.zMm) * (point.xMm - segment.start.xMm) &&
		between(point.xMm, segment.start.xMm, segment.end.xMm) &&
		between(point.zMm, segment.start.zMm, segment.end.zMm)
	);
}

function between(value: number, first: number, second: number): boolean {
	return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function squaredDistance(
	first: WallDraftPoint,
	second: WallDraftPoint,
): number {
	return (first.xMm - second.xMm) ** 2 + (first.zMm - second.zMm) ** 2;
}

function closestPointOnSegment(
	point: WallDraftPoint,
	segment: WallDraftSegment,
): WallDraftPoint {
	const deltaX = segment.end.xMm - segment.start.xMm;
	const deltaZ = segment.end.zMm - segment.start.zMm;
	const lengthSquared = deltaX ** 2 + deltaZ ** 2;
	if (lengthSquared === 0) {
		return segment.start;
	}
	const parameter = clamp(
		((point.xMm - segment.start.xMm) * deltaX +
			(point.zMm - segment.start.zMm) * deltaZ) /
			lengthSquared,
		0,
		1,
	);
	if (deltaX === 0) {
		return {
			xMm: segment.start.xMm,
			zMm: Math.round(segment.start.zMm + parameter * deltaZ),
		};
	}
	if (deltaZ === 0) {
		return {
			xMm: Math.round(segment.start.xMm + parameter * deltaX),
			zMm: segment.start.zMm,
		};
	}
	if (Math.abs(deltaX) === Math.abs(deltaZ)) {
		const step = Math.round(parameter * Math.abs(deltaX));
		return {
			xMm: segment.start.xMm + Math.sign(deltaX) * step,
			zMm: segment.start.zMm + Math.sign(deltaZ) * step,
		};
	}
	return {
		xMm: Math.round(segment.start.xMm + parameter * deltaX),
		zMm: Math.round(segment.start.zMm + parameter * deltaZ),
	};
}

function isForwardTarget(
	start: WallDraftPoint,
	end: WallDraftPoint,
	target: WallDraftPoint,
): boolean {
	return (
		(target.xMm - start.xMm) * (end.xMm - start.xMm) +
			(target.zMm - start.zMm) * (end.zMm - start.zMm) >
		0
	);
}

function clamp(value: number, first: number, second: number): number {
	return Math.max(
		Math.min(first, second),
		Math.min(Math.max(first, second), value),
	);
}
