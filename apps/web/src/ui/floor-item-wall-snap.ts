import {
	resolveOrthogonalPlanFaces,
	type PlanFacePointMm,
} from "../domain/derived-orthogonal-plan-faces";
import {
	type FloorItemFootprint,
	findParametricFloorItemCollisionTargets,
	findRoomForFloorItem,
	floorItemFootprintCorners,
} from "../domain/parametric-item";
import type { Project } from "../domain/project";

type Axis = "xMm" | "zMm";
type FootprintSize = Omit<FloorItemFootprint, "xMm" | "zMm">;

export type FloorItemWallSnap = (input: {
	readonly target: PlanFacePointMm;
	readonly fallback?: PlanFacePointMm;
	readonly footprint: FootprintSize;
	readonly assetInstanceId?: string;
	readonly axis?: Axis;
}) => PlanFacePointMm;

type ContactEdge = {
	readonly roomId: string;
	readonly axis: Axis;
	readonly across: Axis;
	readonly at: number;
	readonly from: number;
	readonly to: number;
	readonly interior: number;
};

type Contact = {
	readonly edge: ContactEdge;
	readonly center: number;
	readonly distance: number;
	readonly tangentOffsets: readonly number[];
};

const GEOMETRY_EPSILON_MM = 1e-7;
const CONTACT_RADIUS_MM = 75;

/** Prefer an exact integer-mm fit at an inner wall face within the gesture's contact range. */
export function createFloorItemWallSnap(project: Project): FloorItemWallSnap {
	const derived = resolveOrthogonalPlanFaces(project);
	const edges =
		derived.kind === "accepted"
			? derived.plan.rooms.flatMap(contactEdgesForRoom)
			: [];
	return ({ target, fallback, footprint, assetInstanceId, axis }) => {
		const base = fallback ?? {
			xMm: Math.round(target.xMm),
			zMm: Math.round(target.zMm),
		};
		const corners = floorItemFootprintCorners({ ...footprint, xMm: 0, zMm: 0 });
		const contacts = edges
			.flatMap((edge) => {
				if (axis !== undefined && edge.axis !== axis) return [];
				const offsets = corners.map((corner) => corner[edge.axis]);
				const limit =
					edge.interior > 0 ? Math.min(...offsets) : Math.max(...offsets);
				const exactCenter = edge.at - limit;
				const center = Math.round(exactCenter);
				const distance = Math.abs(target[edge.axis] - center);
				// Odd or diagonal footprints can need a non-integral center. A
				// rounded candidate would either leave a gap or enter the wall.
				if (
					Math.abs(center - exactCenter) > GEOMETRY_EPSILON_MM ||
					distance > CONTACT_RADIUS_MM
				)
					return [];
				const tangentOffsets = corners
					.filter(
						(corner) =>
							Math.abs(corner[edge.axis] - limit) <= GEOMETRY_EPSILON_MM,
					)
					.map((corner) => corner[edge.across]);
				const contact = { edge, center, distance, tangentOffsets };
				return touchesEdge(contact, base) ? [contact] : [];
			})
			.sort((a, b) => a.distance - b.distance);
		const isValid = (point: PlanFacePointMm, roomId: string) => {
			const input = { ...footprint, ...point };
			return (
				findRoomForFloorItem(project, input) === roomId &&
				findParametricFloorItemCollisionTargets(
					project,
					input,
					assetInstanceId,
				).every((collision) => collision.kind !== "wall")
			);
		};
		const first = contacts[0];
		const perpendicular =
			first &&
			contacts.find(
				(contact) =>
					contact.edge.axis !== first.edge.axis &&
					contact.edge.roomId === first.edge.roomId,
			);
		if (first && perpendicular) {
			const corner = {
				...base,
				[first.edge.axis]: first.center,
				[perpendicular.edge.axis]: perpendicular.center,
			};
			if (
				touchesEdge(first, corner) &&
				touchesEdge(perpendicular, corner) &&
				isValid(corner, first.edge.roomId)
			)
				return corner;
		}
		for (const contact of contacts) {
			const point = { ...base, [contact.edge.axis]: contact.center };
			if (isValid(point, contact.edge.roomId)) return point;
		}
		return base;
	};
}

function touchesEdge(
	{ edge, tangentOffsets }: Contact,
	center: PlanFacePointMm,
): boolean {
	const at = center[edge.across];
	return (
		at + Math.min(...tangentOffsets) <= edge.to + GEOMETRY_EPSILON_MM &&
		at + Math.max(...tangentOffsets) >= edge.from - GEOMETRY_EPSILON_MM
	);
}

function contactEdgesForRoom(room: {
	readonly roomId: string;
	readonly usableFloorPolygonMm?: readonly PlanFacePointMm[];
	readonly usableFloorTilesMm: readonly {
		minXmm: number;
		maxXmm: number;
		minZmm: number;
		maxZmm: number;
	}[];
}): readonly ContactEdge[] {
	const rectangle =
		room.usableFloorTilesMm.length === 1
			? room.usableFloorTilesMm[0]
			: undefined;
	const polygon =
		room.usableFloorPolygonMm ??
		(rectangle
			? [
					{ xMm: rectangle.minXmm, zMm: rectangle.minZmm },
					{ xMm: rectangle.maxXmm, zMm: rectangle.minZmm },
					{ xMm: rectangle.maxXmm, zMm: rectangle.maxZmm },
					{ xMm: rectangle.minXmm, zMm: rectangle.maxZmm },
				]
			: []);
	const segments = polygon.map(
		(start, index) => [start, polygon[(index + 1) % polygon.length]] as const,
	);
	const winding = Math.sign(
		segments.reduce(
			(area, [start, end]) => area + start.xMm * end.zMm - end.xMm * start.zMm,
			0,
		),
	);
	if (winding === 0) return [];
	return segments.flatMap(([start, end]) => {
		const dx = end.xMm - start.xMm;
		const dz = end.zMm - start.zMm;
		// A diagonal usable face does not supply an exact axis-aligned snap.
		const axis =
			dx === 0 && dz !== 0 ? "xMm" : dz === 0 && dx !== 0 ? "zMm" : undefined;
		if (axis === undefined) return [];
		const across = axis === "xMm" ? "zMm" : "xMm";
		return [
			{
				roomId: room.roomId,
				axis,
				across,
				at: start[axis],
				from: Math.min(start[across], end[across]),
				to: Math.max(start[across], end[across]),
				interior: winding * Math.sign(axis === "xMm" ? -dz : dx),
			},
		];
	});
}
