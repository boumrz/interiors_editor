import { resolveOrthogonalPlanFaces, type PlanFacePointMm } from "../domain/derived-orthogonal-plan-faces";
import { exactMeasurement, exactMeasurementToNumber, isExactMeasurement, subtractExactMeasurements, type ExactMeasurement, type MeasurementValue } from "../domain/exact-quadratic-surd";
import { formatLengthMm } from "../domain/measurement-format";
import type { Project, WallSegment } from "../domain/project";
import { wallOpeningIntervalMm } from "../domain/wall-opening";

export type DrawingDimension = {
	readonly id: string;
	readonly kind: "wall" | "opening" | "pier" | "overall" | "room-clear";
	readonly startMm: PlanFacePointMm;
	readonly endMm: PlanFacePointMm;
	readonly label: string;
	/** Unrounded derived length; this projection must never become geometry input. */
	readonly valueMm: number;
	readonly reference: "axis" | "clear" | "outer";
	readonly direction: "x" | "z" | "aligned";
	readonly lane: number;
	readonly preferredSide: "top" | "right" | "bottom" | "left";
	readonly wallSegmentId?: string;
	readonly openingId?: string;
	readonly roomId?: string;
};

type DrawingWall = {
	readonly wall: WallSegment;
	readonly start: PlanFacePointMm;
	readonly end: PlanFacePointMm;
	readonly length: ExactMeasurement;
	readonly lengthMm: number;
};

type DimensionInput = Omit<DrawingDimension, "startMm" | "endMm" | "label" | "valueMm"> & {
	readonly startMm: PlanFacePointMm;
	readonly endMm: PlanFacePointMm;
	readonly value: MeasurementValue;
};

/**
 * DrawingDimensions-RU V1: annotations only, bounded to the alpha projection
 * budget. Axis chains are explicitly named "по осям" in display preferences.
 * Screen-space line offsets, ticks, text collisions and gestures belong to UI.
 */
export function drawingDimensionsFor(project: Project): readonly DrawingDimension[] {
	const { wallSegments, rooms, openings, vertices } = project.level;
	if (wallSegments.length > 300 || rooms.length > 50 || openings.length > 200) return [];
	const vertexById = new Map(vertices.map(vertex => [vertex.vertexId, vertex]));
	const walls: DrawingWall[] = [];
	for (const wall of [...wallSegments].sort((a, b) => compareText(a.wallSegmentId, b.wallSegmentId))) {
		const start = vertexById.get(wall.startVertexId);
		const end = vertexById.get(wall.endVertexId);
		if (!start || !end || ![start.xMm, start.zMm, end.xMm, end.zMm, wall.thicknessMm].every(Number.isSafeInteger) || wall.thicknessMm <= 0) continue;
		const dx = Math.abs(end.xMm - start.xMm);
		const dz = Math.abs(end.zMm - start.zMm);
		if (![dx, dz].every(Number.isSafeInteger) || (dx === 0 && dz === 0) || (dx !== 0 && dz !== 0 && dx !== dz)) continue;
		const length = dx === dz ? exactMeasurement(0n, BigInt(dx)) : exactMeasurement(BigInt(dx + dz));
		const lengthMm = exactMeasurementToNumber(length);
		if (lengthMm > Number.MAX_SAFE_INTEGER) continue;
		walls.push({ wall, start, end, length, lengthMm });
	}
	if (walls.length === 0) return [];
	const centers = walls.flatMap(wall => [wall.start, wall.end]);
	const center = centerOf(centers);
	const result: DrawingDimension[] = [];
	for (const wall of walls) {
		const preferredSide = sideFor(wall.start, wall.end, center);
		const chain = openingChain(project, wall, preferredSide);
		result.push(dimension({ id: JSON.stringify(["wall", wall.wall.wallSegmentId]), kind: "wall", wallSegmentId: wall.wall.wallSegmentId, startMm: wall.start, endMm: wall.end, value: wall.length, reference: "axis", direction: "aligned", lane: chain.length > 0 ? 1 : 0, preferredSide }), ...chain);
	}
	// A missing/unsupported wall cannot prove the full rendered envelope or Room.
	if (walls.length === wallSegments.length) {
		result.push(...outerDimensions(walls, result));
		const resolved = resolveOrthogonalPlanFaces(project);
		if (resolved.kind === "accepted") {
			for (const room of [...resolved.plan.rooms].sort((a, b) => compareText(a.roomId, b.roomId))) {
				const tile = room.usableFloorTilesMm[0];
				const polygon = room.usableFloorPolygonMm;
				if (tile && room.usableFloorTilesMm.length === 1) {
					const start = { xMm: tile.minXmm, zMm: tile.minZmm };
					result.push(roomEdge(room.roomId, start, { xMm: tile.maxXmm, zMm: tile.minZmm }, "top"), roomEdge(room.roomId, start, { xMm: tile.minXmm, zMm: tile.maxZmm }, "left"));
				} else if (polygon) {
					const roomCenter = centerOf(polygon);
					for (let index = 0; index < polygon.length; index += 1) {
						const start = polygon[index];
						const end = polygon[(index + 1) % polygon.length];
						if (!start || !end || (start.xMm === end.xMm && start.zMm === end.zMm)) continue;
						result.push(roomEdge(room.roomId, start, end, sideFor(start, end, roomCenter)));
					}
				}
			}
		}
	}
	return result;
}

function openingChain(project: Project, source: DrawingWall, preferredSide: DrawingDimension["preferredSide"]): DrawingDimension[] {
	const openings = project.level.openings.filter(opening => opening.wallSegmentId === source.wall.wallSegmentId);
	if (openings.length === 0) return [];
	const intervals = openings.map(opening => ({ opening, ...wallOpeningIntervalMm(opening) })).sort((a, b) => a.startMm - b.startMm || compareText(a.opening.openingId, b.opening.openingId));
	let previousEnd = 0;
	for (const interval of intervals) {
		if (![interval.opening.offsetMm, interval.opening.widthMm].every(Number.isSafeInteger) || interval.opening.widthMm <= 0 || interval.startMm < previousEnd || interval.endMm > source.lengthMm) return [];
		previousEnd = interval.endMm;
	}
	const result: DrawingDimension[] = [];
	previousEnd = 0;
	for (const interval of intervals) {
		if (interval.startMm > previousEnd) result.push(pier(source, previousEnd, interval.startMm, preferredSide));
		result.push(dimension({ id: JSON.stringify(["opening", interval.opening.openingId]), kind: "opening", openingId: interval.opening.openingId, wallSegmentId: source.wall.wallSegmentId, startMm: pointAlong(source, interval.startMm), endMm: pointAlong(source, interval.endMm), value: interval.opening.widthMm, reference: "axis", direction: "aligned", lane: 0, preferredSide }));
		previousEnd = interval.endMm;
	}
	if (previousEnd < source.lengthMm) result.push(pier(source, previousEnd, source.lengthMm, preferredSide, source.length));
	return result.sort((a, b) => a.startMm.xMm - b.startMm.xMm || a.startMm.zMm - b.startMm.zMm);
}

function pier(source: DrawingWall, start: number, end: number, preferredSide: DrawingDimension["preferredSide"], exactEnd?: ExactMeasurement): DrawingDimension {
	const startMm = pointAlong(source, start);
	const endMm = pointAlong(source, end);
	const ordered = orderedPoints(startMm, endMm);
	return dimension({ id: JSON.stringify(["pier", source.wall.wallSegmentId, ordered]), kind: "pier", wallSegmentId: source.wall.wallSegmentId, startMm, endMm, value: exactEnd ? subtractExactMeasurements(exactEnd, halfMillimetres(start)) : end - start, reference: "axis", direction: "aligned", lane: 0, preferredSide });
}

function pointAlong(source: DrawingWall, distanceMm: number): PlanFacePointMm {
	return { xMm: source.start.xMm + (source.end.xMm - source.start.xMm) / source.lengthMm * distanceMm, zMm: source.start.zMm + (source.end.zMm - source.start.zMm) / source.lengthMm * distanceMm };
}

function outerDimensions(walls: readonly DrawingWall[], axesAndChains: readonly DrawingDimension[]): DrawingDimension[] {
	// Matches the editor's final SVG butt-cap stroke. Do not add square end caps.
	const points = walls.flatMap(({ wall, start, end, lengthMm }) => {
		const xOffset = -(end.zMm - start.zMm) / lengthMm * wall.thicknessMm / 2;
		const zOffset = (end.xMm - start.xMm) / lengthMm * wall.thicknessMm / 2;
		return [start, end].flatMap(point => [{ xMm: point.xMm - xOffset, zMm: point.zMm - zOffset }, { xMm: point.xMm + xOffset, zMm: point.zMm + zOffset }]);
	});
	return (["x", "z"] as const).map(direction => {
		const coordinate = direction === "x" ? "xMm" : "zMm";
		const startMm = extreme(points, coordinate, 1);
		const endMm = extreme(points, coordinate, -1);
		const preferredSide = direction === "x" ? "top" : "left";
		const lane = 1 + Math.max(0, ...axesAndChains.filter(value => value.kind === "wall" && value.preferredSide === preferredSide).map(value => value.lane));
		return dimension({ id: JSON.stringify(["overall", direction]), kind: "overall", startMm, endMm, value: endMm[coordinate] - startMm[coordinate], reference: "outer", direction, lane, preferredSide });
	});
}

function extreme(points: readonly PlanFacePointMm[], coordinate: "xMm" | "zMm", sign: 1 | -1): PlanFacePointMm {
	const other = coordinate === "xMm" ? "zMm" : "xMm";
	return points.reduce((best, point) => point[coordinate] * sign < best[coordinate] * sign || (point[coordinate] === best[coordinate] && point[other] < best[other]) ? point : best);
}

function roomEdge(roomId: string, startMm: PlanFacePointMm, endMm: PlanFacePointMm, preferredSide: DrawingDimension["preferredSide"]): DrawingDimension {
	return dimension({ id: JSON.stringify(["room-clear", roomId, orderedPoints(startMm, endMm)]), kind: "room-clear", roomId, startMm, endMm, value: Math.hypot(endMm.xMm - startMm.xMm, endMm.zMm - startMm.zMm), reference: "clear", direction: "aligned", lane: 0, preferredSide });
}

function dimension({ value, startMm, endMm, ...fields }: DimensionInput): DrawingDimension {
	const [first, second] = fields.direction === "aligned" ? orderedPoints(startMm, endMm) : [startMm, endMm];
	return { ...fields, startMm: { xMm: first.xMm, zMm: first.zMm }, endMm: { xMm: second.xMm, zMm: second.zMm }, valueMm: isExactMeasurement(value) ? exactMeasurementToNumber(value) : value, label: formatLengthMm(value).slice(0, -3) };
}

function orderedPoints(first: PlanFacePointMm, second: PlanFacePointMm): readonly [PlanFacePointMm, PlanFacePointMm] {
	return first.xMm < second.xMm || (first.xMm === second.xMm && first.zMm <= second.zMm) ? [first, second] : [second, first];
}

function centerOf(points: readonly PlanFacePointMm[]): PlanFacePointMm {
	return { xMm: (extreme(points, "xMm", 1).xMm + extreme(points, "xMm", -1).xMm) / 2, zMm: (extreme(points, "zMm", 1).zMm + extreme(points, "zMm", -1).zMm) / 2 };
}

function sideFor(start: PlanFacePointMm, end: PlanFacePointMm, center: PlanFacePointMm): DrawingDimension["preferredSide"] {
	return start.xMm === end.xMm ? (start.xMm <= center.xMm ? "left" : "right") : ((start.zMm + end.zMm) / 2 <= center.zMm ? "top" : "bottom");
}

function halfMillimetres(value: number): ExactMeasurement {
	return exactMeasurement(BigInt(value * 2), 0n, 2n);
}

function compareText(first: string, second: string): number {
	return first < second ? -1 : first > second ? 1 : 0;
}
