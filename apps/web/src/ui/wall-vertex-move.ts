import type { Vertex, WallSegment } from "../domain/project";

export interface WallVertexMovePoint {
	readonly xMm: number;
	readonly zMm: number;
}

export type WallVertexMoveAxis =
	| { readonly kind: "horizontal" }
	| { readonly kind: "vertical" }
	| {
			readonly anchor: WallVertexMovePoint;
			readonly kind: "diagonal-falling" | "diagonal-rising";
	  };

type IncidentDirection =
	| { readonly anchor: Vertex; readonly kind: "horizontal" }
	| { readonly anchor: Vertex; readonly kind: "vertical" }
	| {
			readonly anchor: Vertex;
			readonly kind: "diagonal-falling" | "diagonal-rising";
	  };

const MOVE_GESTURE_GRID_MM = 100;

export function snapWallMoveDeltaMm(deltaMm: number): number {
	return Math.round(deltaMm / MOVE_GESTURE_GRID_MM) * MOVE_GESTURE_GRID_MM;
}

function incidentDirection(
	vertexId: string,
	wall: WallSegment,
	verticesById: ReadonlyMap<string, Vertex>,
): IncidentDirection | undefined {
	const start = verticesById.get(wall.startVertexId);
	const end = verticesById.get(wall.endVertexId);
	const anchor = verticesById.get(
		wall.startVertexId === vertexId ? wall.endVertexId : wall.startVertexId,
	);
	if (!start || !end || !anchor) return undefined;
	if (start.zMm === end.zMm && start.xMm !== end.xMm) {
		return { anchor, kind: "horizontal" };
	}
	if (start.xMm === end.xMm && start.zMm !== end.zMm) {
		return { anchor, kind: "vertical" };
	}
	const deltaX = end.xMm - start.xMm;
	const deltaZ = end.zMm - start.zMm;
	if (deltaX === 0 || Math.abs(deltaX) !== Math.abs(deltaZ)) {
		return undefined;
	}
	return {
		anchor,
		kind:
			Math.sign(deltaX) === Math.sign(deltaZ)
				? "diagonal-rising"
				: "diagonal-falling",
	};
}

/**
 * Returns the single continuous Alpha direction that keeps every incident
 * segment at 0/45/90 degrees. In addition to inline/detached vertices, an
 * equal-leg cardinal corner may snap onto the 45-degree line shared by its
 * two opposite anchors. Other mixed corners and junctions remain unavailable.
 */
export function wallVertexMoveAxisFor(
	vertexId: string,
	walls: readonly WallSegment[],
	vertices: readonly Vertex[],
): WallVertexMoveAxis | undefined {
	const attachedWalls = walls.filter(
		(wall) => wall.startVertexId === vertexId || wall.endVertexId === vertexId,
	);
	if (attachedWalls.length === 0) return undefined;
	const verticesById = new Map(
		vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const directions = attachedWalls.map((wall) =>
		incidentDirection(vertexId, wall, verticesById),
	);
	if (directions.some((direction) => direction === undefined)) return undefined;
	if (directions.every((direction) => direction?.kind === "horizontal")) {
		return { kind: "horizontal" };
	}
	if (directions.every((direction) => direction?.kind === "vertical")) {
		return { kind: "vertical" };
	}
	const first = directions[0];
	if (
		(first?.kind === "diagonal-rising" ||
			first?.kind === "diagonal-falling") &&
		directions.every((direction) => direction?.kind === first.kind)
	) {
		return { anchor: first.anchor, kind: first.kind };
	}
	if (directions.length !== 2) return undefined;
	const second = directions[1];
	if (
		!first ||
		!second ||
		!([first.kind, second.kind].includes("horizontal") &&
			[first.kind, second.kind].includes("vertical"))
	) {
		return undefined;
	}
	const deltaX = second.anchor.xMm - first.anchor.xMm;
	const deltaZ = second.anchor.zMm - first.anchor.zMm;
	if (deltaX === 0 || Math.abs(deltaX) !== Math.abs(deltaZ)) {
		return undefined;
	}
	return {
		anchor: first.anchor,
		kind:
			Math.sign(deltaX) === Math.sign(deltaZ)
				? "diagonal-rising"
				: "diagonal-falling",
	};
}

export function pointForWallVertexMove(
	axis: WallVertexMoveAxis,
	point: WallVertexMovePoint,
	original: WallVertexMovePoint,
): WallVertexMovePoint {
	if (axis.kind === "horizontal") {
		return {
			xMm: original.xMm + snapWallMoveDeltaMm(point.xMm - original.xMm),
			zMm: original.zMm,
		};
	}
	if (axis.kind === "vertical") {
		return {
			xMm: original.xMm,
			zMm: original.zMm + snapWallMoveDeltaMm(point.zMm - original.zMm),
		};
	}
	const deltaMm = snapWallMoveDeltaMm(
		axis.kind === "diagonal-rising"
			? (point.xMm - axis.anchor.xMm + point.zMm - axis.anchor.zMm) / 2
			: (point.xMm - axis.anchor.xMm - (point.zMm - axis.anchor.zMm)) / 2,
	);
	return {
		xMm: axis.anchor.xMm + deltaMm,
		zMm:
			axis.anchor.zMm + (axis.kind === "diagonal-rising" ? deltaMm : -deltaMm),
	};
}

/** Mirrors the domain's narrow whole-wall move contract before exposing it. */
export function isWallMoveGestureSupported(
	wallSegmentId: string,
	walls: readonly WallSegment[],
	vertices: readonly Vertex[],
): boolean {
	const selected = walls.find(
		(wall) => wall.wallSegmentId === wallSegmentId,
	);
	if (!selected) return false;
	const verticesById = new Map(
		vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const start = verticesById.get(selected.startVertexId);
	const end = verticesById.get(selected.endVertexId);
	if (!start || !end) return false;
	const deltaX = end.xMm - start.xMm;
	const deltaZ = end.zMm - start.zMm;
	if (deltaX === 0 && deltaZ === 0) return false;
	if (deltaX !== 0 && deltaZ !== 0) {
		if (Math.abs(deltaX) !== Math.abs(deltaZ)) return false;
		return [selected.startVertexId, selected.endVertexId].every(
			(vertexId) =>
				walls.filter(
					(wall) =>
						wall.startVertexId === vertexId || wall.endVertexId === vertexId,
				).length === 1,
		);
	}
	return !walls.some((wall) => {
		if (wall.wallSegmentId === selected.wallSegmentId) return false;
		const sharedVertexId = [
			selected.startVertexId,
			selected.endVertexId,
		].find(
			(vertexId) =>
				wall.startVertexId === vertexId || wall.endVertexId === vertexId,
		);
		if (!sharedVertexId) return false;
		const shared = verticesById.get(sharedVertexId);
		const other = verticesById.get(
			wall.startVertexId === sharedVertexId
				? wall.endVertexId
				: wall.startVertexId,
		);
		if (!shared || !other) return true;
		return (
			deltaX * (other.zMm - shared.zMm) ===
			deltaZ * (other.xMm - shared.xMm)
		);
	});
}
