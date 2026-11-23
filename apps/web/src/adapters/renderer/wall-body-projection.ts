import type { PlanGraph } from "../../domain/derive-plan-faces";
import type { Vertex, WallSegment } from "../../domain/project";
import { uninterruptedWallRuns } from "../../domain/wall-runs";

export interface WallBodyPoint {
	readonly xMm: number;
	readonly zMm: number;
}
export interface WallBodyProjection {
	readonly wallSegmentId: string;
	readonly start: WallBodyPoint;
	readonly end: WallBodyPoint;
	readonly lengthMm: number;
	readonly polygonMm: readonly WallBodyPoint[];
	readonly outlinesMm: readonly (readonly [WallBodyPoint, WallBodyPoint])[];
}

export interface WallFillRunProjection {
	readonly wallSegmentIds: readonly string[];
	readonly polygonsMm: readonly (readonly WallBodyPoint[])[];
}

/** Each output is one compound SVG fill; outlines and hit regions stay per edge. */
export function wallFillRunsForProjection(
	graph: PlanGraph,
	bodies: readonly WallBodyProjection[],
): readonly WallFillRunProjection[] {
	const polygonsById = new Map(
		bodies.map((body) => [body.wallSegmentId, body.polygonMm]),
	);
	return uninterruptedWallRuns(graph).flatMap(({ wallSegmentIds }) => {
		if (wallSegmentIds.length < 2) return [];
		const polygonsMm = wallSegmentIds.flatMap((id) => {
			const polygon = polygonsById.get(id);
			return polygon ? [polygon] : [];
		});
		return polygonsMm.length === wallSegmentIds.length
			? [{ wallSegmentIds, polygonsMm }]
			: [];
	});
}
interface Ray {
	readonly wallSegmentId: string;
	readonly dx: number;
	readonly dz: number;
	readonly half: number;
	readonly point: WallBodyPoint;
	left: WallBodyPoint;
	right: WallBodyPoint;
	readonly rawLeft: WallBodyPoint;
	readonly rawRight: WallBodyPoint;
}

/** Disposable physical wall footprints. Both renderers use the same miter
 * intersections; canonical endpoints, lengths and thickness are untouched. */
export function wallBodiesForProjection(graph: {
	readonly vertices: readonly Vertex[];
	readonly wallSegments: readonly WallSegment[];
}): readonly WallBodyProjection[] {
	const vertices = new Map(
		graph.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const rays = new Map<string, Ray[]>();
	const resolved = graph.wallSegments.flatMap((wall) => {
		const start = vertices.get(wall.startVertexId);
		const end = vertices.get(wall.endVertexId);
		if (!start || !end) return [];
		const lengthMm = Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm);
		if (!(lengthMm > 0) || !(wall.thicknessMm > 0)) return [];
		const ray = (point: Vertex, other: Vertex): Ray => {
			const dx = (other.xMm - point.xMm) / lengthMm;
			const dz = (other.zMm - point.zMm) / lengthMm;
			const half = wall.thicknessMm / 2;
			const left = { xMm: point.xMm + dz * half, zMm: point.zMm - dx * half };
			const right = { xMm: point.xMm - dz * half, zMm: point.zMm + dx * half };
			const value = {
				wallSegmentId: wall.wallSegmentId,
				dx,
				dz,
				half,
				point,
				left,
				right,
				rawLeft: left,
				rawRight: right,
			};
			rays.set(point.vertexId, [...(rays.get(point.vertexId) ?? []), value]);
			return value;
		};
		return [
			{
				wall,
				start,
				end,
				lengthMm,
				first: ray(start, end),
				last: ray(end, start),
			},
		];
	});
	for (const incident of rays.values()) {
		if (incident.length < 2) continue;
		incident.sort((a, b) => Math.atan2(a.dz, a.dx) - Math.atan2(b.dz, b.dx));
		for (let i = 0; i < incident.length; i++) {
			const first = incident[i];
			const second = incident[(i + 1) % incident.length];
			if (!first || !second) continue;
			const cross = first.dx * second.dz - first.dz * second.dx;
			if (Math.abs(cross) < 1e-9) continue;
			const offsetX = second.rawLeft.xMm - first.rawRight.xMm;
			const offsetZ = second.rawLeft.zMm - first.rawRight.zMm;
			const along = (offsetX * second.dz - offsetZ * second.dx) / cross;
			const intersection = {
				xMm: first.rawRight.xMm + first.dx * along,
				zMm: first.rawRight.zMm + first.dz * along,
			};
			// Same source-owned cap as usable room joins; no unbounded spikes.
			if (
				Math.hypot(
					intersection.xMm - first.point.xMm,
					intersection.zMm - first.point.zMm,
				) <=
				4 * Math.max(first.half, second.half) + 1e-9
			) {
				first.right = intersection;
				second.left = intersection;
			}
		}
	}
	return resolved.map(({ wall, start, end, lengthMm, first, last }) => ({
		wallSegmentId: wall.wallSegmentId,
		start,
		end,
		lengthMm,
		// Retain the original swept rectangle at T/X centers. Miters add only
		// corner material; they must not hollow out the shared junction.
		polygonMm: convexHull([
			first.left,
			first.right,
			last.left,
			last.right,
			first.rawLeft,
			first.rawRight,
			last.rawLeft,
			last.rawRight,
		]),
		outlinesMm: [
			[first.left, last.right],
			[last.left, first.right],
			...((rays.get(start.vertexId)?.length ?? 0) === 1
				? [[first.right, first.left] as const]
				: []),
			...((rays.get(end.vertexId)?.length ?? 0) === 1
				? [[last.right, last.left] as const]
				: []),
		],
	}));
}

/** Opening jambs clip the very same physical footprint, not a second width. */
export function clipWallBodyToInterval(
	body: WallBodyProjection,
	startMm: number,
	endMm: number,
): readonly WallBodyPoint[] {
	const dx = (body.end.xMm - body.start.xMm) / body.lengthMm;
	const dz = (body.end.zMm - body.start.zMm) / body.lengthMm;
	const along = (point: WallBodyPoint) =>
		(point.xMm - body.start.xMm) * dx + (point.zMm - body.start.zMm) * dz;
	const clip = (
		polygon: readonly WallBodyPoint[],
		boundary: number,
		direction: 1 | -1,
	): readonly WallBodyPoint[] =>
		polygon.flatMap((point, index) => {
			const previous = polygon[(index + polygon.length - 1) % polygon.length];
			if (!previous) return [];
			const a = (along(previous) - boundary) * direction;
			const b = (along(point) - boundary) * direction;
			const crossing = a < 0 !== b < 0;
			const intersection = crossing
				? [
						{
							xMm: previous.xMm + ((point.xMm - previous.xMm) * a) / (a - b),
							zMm: previous.zMm + ((point.zMm - previous.zMm) * a) / (a - b),
						},
					]
				: [];
			return b >= 0 ? [...intersection, point] : intersection;
		});
	const afterStart =
		startMm > 0 ? clip(body.polygonMm, startMm, 1) : body.polygonMm;
	return endMm < body.lengthMm ? clip(afterStart, endMm, -1) : afterStart;
}

function convexHull(
	points: readonly WallBodyPoint[],
): readonly WallBodyPoint[] {
	const sorted = [...points]
		.sort((a, b) => a.xMm - b.xMm || a.zMm - b.zMm)
		.filter(
			(point, index, array) =>
				index === 0 ||
				point.xMm !== array[index - 1]?.xMm ||
				point.zMm !== array[index - 1]?.zMm,
		);
	const half = (values: readonly WallBodyPoint[]) => {
		const hull: WallBodyPoint[] = [];
		for (const point of values) {
			while (hull.length >= 2) {
				const a = hull[hull.length - 2];
				const b = hull[hull.length - 1];
				if (
					!a ||
					!b ||
					(b.xMm - a.xMm) * (point.zMm - a.zMm) -
						(b.zMm - a.zMm) * (point.xMm - a.xMm) >
						1e-9
				)
					break;
				hull.pop();
			}
			hull.push(point);
		}
		return hull.slice(0, -1);
	};
	return [...half(sorted), ...half([...sorted].reverse())];
}
