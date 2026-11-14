import { resolveOrthogonalPlanFaces } from "./derived-orthogonal-plan-faces";
import { floorItemFootprintCorners } from "./parametric-item";
import {
	type FloorSchematicAssetInstance,
	isFloorSchematicAssetInstance,
	type Project,
	type Vertex,
} from "./project";

export type MeasurementTarget =
	| { readonly assetInstanceId: string; readonly kind: "ItemFootprintBoundary" }
	| { readonly kind: "PlanPoint"; readonly xMm: number; readonly zMm: number }
	| { readonly kind: "RoomInnerBoundary"; readonly roomId: string }
	| { readonly kind: "VertexPoint"; readonly vertexId: string }
	| { readonly kind: "WallCenterline"; readonly wallSegmentId: string };

/**
 * A request has no Project persistence role. Its immutable revision identity
 * prevents a later plan from silently retargeting a visible measurement.
 */
export interface MeasurementRequest {
	readonly baseRevisionChecksum: string;
	readonly baseRevisionId: string;
	readonly operation: "Distance";
	readonly projectId: string;
	readonly targets: readonly [MeasurementTarget, MeasurementTarget];
}

export interface MeasurementRevisionIdentity {
	readonly checksum: string;
	readonly projectId: string;
	readonly revisionId: string;
}

export type DistanceMeasurementResult =
	| {
			readonly closestSourcePointMm: PlanPoint;
			readonly closestTargetPointMm: PlanPoint;
			readonly distanceMm: number;
			readonly kind: "measured";
	  }
	| { readonly kind: "stale" }
	| { readonly kind: "target-unavailable" };

interface PlanPoint {
	readonly xMm: number;
	readonly zMm: number;
}

interface Segment {
	readonly end: PlanPoint;
	readonly start: PlanPoint;
}

type ResolvedMeasurementTarget =
	| { readonly kind: "boundary"; readonly segments: readonly Segment[] }
	| { readonly kind: "point"; readonly point: PlanPoint };

interface ClosestPoints {
	readonly distanceMm: number;
	readonly sortKey: string;
	readonly source: PlanPoint;
	readonly target: PlanPoint;
}

export function measureDistance(
	project: Project,
	request: MeasurementRequest,
	currentRevision: MeasurementRevisionIdentity,
): DistanceMeasurementResult {
	if (
		request.projectId !== project.projectId ||
		request.projectId !== currentRevision.projectId ||
		request.baseRevisionId !== currentRevision.revisionId ||
		request.baseRevisionChecksum !== currentRevision.checksum
	) {
		return { kind: "stale" };
	}

	const [sourceTarget, targetTarget] = request.targets;
	const source = sourceTarget
		? resolveMeasurementTarget(project, sourceTarget)
		: undefined;
	const target = targetTarget
		? resolveMeasurementTarget(project, targetTarget)
		: undefined;
	if (!source || !target) return { kind: "target-unavailable" };

	const closest = closestPointsBetween(source, target);
	return closest
		? {
				closestSourcePointMm: closest.source,
				closestTargetPointMm: closest.target,
				distanceMm: closest.distanceMm,
				kind: "measured",
			}
		: { kind: "target-unavailable" };
}

function resolveMeasurementTarget(
	project: Project,
	target: MeasurementTarget,
): ResolvedMeasurementTarget | undefined {
	switch (target.kind) {
		case "PlanPoint":
			return isSafePlanPoint(target) ? { kind: "point", point: target } : undefined;
		case "VertexPoint": {
			const vertex = project.level.vertices.find(
				(candidate) => candidate.vertexId === target.vertexId,
			);
			return vertex ? { kind: "point", point: vertex } : undefined;
		}
		case "WallCenterline": {
			const wall = project.level.wallSegments.find(
				(candidate) => candidate.wallSegmentId === target.wallSegmentId,
			);
			if (!wall) return undefined;
			const vertices = verticesForWall(project.level.vertices, wall);
			return vertices ? { kind: "boundary", segments: [vertices] } : undefined;
		}
		case "ItemFootprintBoundary": {
			const item = project.assetInstances.find(
				(candidate): candidate is FloorSchematicAssetInstance =>
					candidate.assetInstanceId === target.assetInstanceId &&
					isFloorSchematicAssetInstance(candidate),
			);
			return item
				? boundaryForPolygon(floorItemFootprintCorners(item))
				: undefined;
		}
		case "RoomInnerBoundary": {
			const derived = resolveOrthogonalPlanFaces(project);
			if (derived.kind !== "accepted") return undefined;
			const room = derived.plan.rooms.find(
				(candidate) => candidate.roomId === target.roomId,
			);
			if (!room) return undefined;
			if (room.usableFloorPolygonMm) {
				return boundaryForPolygon(room.usableFloorPolygonMm);
			}
			const tile = room.usableFloorTilesMm[0];
			return tile && room.usableFloorTilesMm.length === 1
				? boundaryForPolygon([
						{ xMm: tile.minXmm, zMm: tile.minZmm },
						{ xMm: tile.maxXmm, zMm: tile.minZmm },
						{ xMm: tile.maxXmm, zMm: tile.maxZmm },
						{ xMm: tile.minXmm, zMm: tile.maxZmm },
					])
				: undefined;
		}
	}
}

function verticesForWall(
	vertices: readonly Vertex[],
	wall: {
		readonly endVertexId: string;
		readonly startVertexId: string;
	},
): Segment | undefined {
	const start = vertices.find(
		(vertex) => vertex.vertexId === wall.startVertexId,
	);
	const end = vertices.find((vertex) => vertex.vertexId === wall.endVertexId);
	return start && end && !samePoint(start, end) ? { end, start } : undefined;
}

function boundaryForPolygon(
	points: readonly PlanPoint[],
): ResolvedMeasurementTarget | undefined {
	if (points.length < 3 || !points.every(isSafePlanPoint)) return undefined;
	const segments = points.flatMap((start, index) => {
		const end = points[(index + 1) % points.length];
		return end && !samePoint(start, end) ? [{ end, start }] : [];
	});
	return segments.length > 0 ? { kind: "boundary", segments } : undefined;
}

function closestPointsBetween(
	source: ResolvedMeasurementTarget,
	target: ResolvedMeasurementTarget,
): ClosestPoints | undefined {
	if (source.kind === "point" && target.kind === "point") {
		return closestPointPair(source.point, target.point, "point:point");
	}
	if (source.kind === "point" && target.kind === "boundary") {
		return closestPointToBoundary(source.point, target.segments, "source-point");
	}
	if (source.kind === "boundary" && target.kind === "point") {
		const reversed = closestPointToBoundary(
			target.point,
			source.segments,
			"target-point",
		);
		return reversed
			? {
					distanceMm: reversed.distanceMm,
					sortKey: reversed.sortKey,
					source: reversed.target,
					target: reversed.source,
				}
			: undefined;
	}

	if (source.kind !== "boundary" || target.kind !== "boundary") {
		return undefined;
	}
	const candidates = source.segments.flatMap((sourceSegment, sourceIndex) =>
		target.segments.flatMap((targetSegment, targetIndex) =>
			closestPointsBetweenSegments(
				sourceSegment,
				targetSegment,
				`${sourceIndex.toString().padStart(4, "0")}:${targetIndex
					.toString()
					.padStart(4, "0")}`,
			),
		),
	);
	return nearestCandidate(candidates);
}

function closestPointToBoundary(
	point: PlanPoint,
	segments: readonly Segment[],
	prefix: string,
): ClosestPoints | undefined {
	return nearestCandidate(
		segments.map((segment, index) => {
			const target = closestPointOnSegment(point, segment);
			return closestPointPair(point, target, `${prefix}:${index}`);
		}),
	);
}

function closestPointsBetweenSegments(
	source: Segment,
	target: Segment,
	prefix: string,
): readonly ClosestPoints[] {
	if (segmentsIntersect(source, target)) {
		const point = intersectionPoint(source, target) ?? source.start;
		return [closestPointPair(point, point, `${prefix}:intersection`)];
	}
	return [
		closestPointPair(
			source.start,
			closestPointOnSegment(source.start, target),
			`${prefix}:source-start`,
		),
		closestPointPair(
			source.end,
			closestPointOnSegment(source.end, target),
			`${prefix}:source-end`,
		),
		(() => {
			const sourcePoint = closestPointOnSegment(target.start, source);
			return closestPointPair(sourcePoint, target.start, `${prefix}:target-start`);
		})(),
		(() => {
			const sourcePoint = closestPointOnSegment(target.end, source);
			return closestPointPair(sourcePoint, target.end, `${prefix}:target-end`);
		})(),
	];
}

function closestPointPair(
	source: PlanPoint,
	target: PlanPoint,
	sortKey: string,
): ClosestPoints {
	return {
		distanceMm: Math.hypot(source.xMm - target.xMm, source.zMm - target.zMm),
		sortKey,
		source,
		target,
	};
}

function nearestCandidate(
	candidates: readonly ClosestPoints[],
): ClosestPoints | undefined {
	return candidates.reduce<ClosestPoints | undefined>((nearest, candidate) => {
		if (!nearest || candidate.distanceMm < nearest.distanceMm - 1e-9) {
			return candidate;
		}
		return Math.abs(candidate.distanceMm - nearest.distanceMm) <= 1e-9 &&
			candidate.sortKey < nearest.sortKey
			? candidate
			: nearest;
	}, undefined);
}

function closestPointOnSegment(point: PlanPoint, segment: Segment): PlanPoint {
	const deltaX = segment.end.xMm - segment.start.xMm;
	const deltaZ = segment.end.zMm - segment.start.zMm;
	const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
	if (lengthSquared === 0) return segment.start;
	const position = Math.max(
		0,
		Math.min(
			1,
			((point.xMm - segment.start.xMm) * deltaX +
				(point.zMm - segment.start.zMm) * deltaZ) /
				lengthSquared,
		),
	);
	return {
		xMm: segment.start.xMm + deltaX * position,
		zMm: segment.start.zMm + deltaZ * position,
	};
}

function segmentsIntersect(first: Segment, second: Segment): boolean {
	const firstEnd = orientation(first.start, first.end, second.end);
	const firstStart = orientation(first.start, first.end, second.start);
	const secondEnd = orientation(second.start, second.end, first.end);
	const secondStart = orientation(second.start, second.end, first.start);
	if (
		Math.abs(firstStart) <= 1e-9 && onSegment(second.start, first) ||
		Math.abs(firstEnd) <= 1e-9 && onSegment(second.end, first) ||
		Math.abs(secondStart) <= 1e-9 && onSegment(first.start, second) ||
		Math.abs(secondEnd) <= 1e-9 && onSegment(first.end, second)
	) {
		return true;
	}
	return (
		(Math.sign(firstStart) !== Math.sign(firstEnd)) &&
		(Math.sign(secondStart) !== Math.sign(secondEnd))
	);
}

function intersectionPoint(first: Segment, second: Segment): PlanPoint | undefined {
	const firstDeltaX = first.end.xMm - first.start.xMm;
	const firstDeltaZ = first.end.zMm - first.start.zMm;
	const secondDeltaX = second.end.xMm - second.start.xMm;
	const secondDeltaZ = second.end.zMm - second.start.zMm;
	const denominator = firstDeltaX * secondDeltaZ - firstDeltaZ * secondDeltaX;
	if (Math.abs(denominator) <= 1e-9) return undefined;
	const startDeltaX = second.start.xMm - first.start.xMm;
	const startDeltaZ = second.start.zMm - first.start.zMm;
	const factor =
		(startDeltaX * secondDeltaZ - startDeltaZ * secondDeltaX) / denominator;
	return {
		xMm: first.start.xMm + firstDeltaX * factor,
		zMm: first.start.zMm + firstDeltaZ * factor,
	};
}

function orientation(first: PlanPoint, second: PlanPoint, point: PlanPoint): number {
	return (
		(second.xMm - first.xMm) * (point.zMm - first.zMm) -
		(second.zMm - first.zMm) * (point.xMm - first.xMm)
	);
}

function onSegment(point: PlanPoint, segment: Segment): boolean {
	return (
		point.xMm >= Math.min(segment.start.xMm, segment.end.xMm) - 1e-9 &&
		point.xMm <= Math.max(segment.start.xMm, segment.end.xMm) + 1e-9 &&
		point.zMm >= Math.min(segment.start.zMm, segment.end.zMm) - 1e-9 &&
		point.zMm <= Math.max(segment.start.zMm, segment.end.zMm) + 1e-9
	);
}

function samePoint(first: PlanPoint, second: PlanPoint): boolean {
	return first.xMm === second.xMm && first.zMm === second.zMm;
}

function isSafePlanPoint(point: PlanPoint): boolean {
	return Number.isFinite(point.xMm) && Number.isFinite(point.zMm);
}
