import type {
	DerivedOrthogonalRoomFace,
	PlanFacePointMm,
} from "../domain/derived-orthogonal-plan-faces";
import {
	type FloorItemFootprint,
	floorItemFootprintCorners,
} from "../domain/parametric-item";

type Axis = "xMm" | "zMm";
type Interval = readonly [start: number, end: number];
type Side = "left" | "right" | "top" | "bottom";

export interface ItemWallDistance {
	readonly side: Side;
	readonly start: PlanFacePointMm;
	readonly end: PlanFacePointMm;
	readonly distanceMm: number;
}

const epsilonMm = 1e-7;
const axes = [
	{ along: "xMm", across: "zMm", negative: "left", positive: "right" },
	{ along: "zMm", across: "xMm", negative: "top", positive: "bottom" },
] as const;

/** A single cross-section of the authoritative usable floor, in plan units. */
function polygonSection(
	polygon: readonly PlanFacePointMm[],
	center: PlanFacePointMm,
	along: Axis,
	across: Axis,
): Interval | undefined {
	const crossings: number[] = [];
	const alignedEdges: Interval[] = [];
	let previous = polygon.at(-1);
	if (!previous) return undefined;
	for (const next of polygon) {
		const from = previous[across] - center[across];
		const to = next[across] - center[across];
		if (Math.abs(from) <= epsilonMm && Math.abs(to) <= epsilonMm) {
			alignedEdges.push([
				Math.min(previous[along], next[along]),
				Math.max(previous[along], next[along]),
			]);
		} else if (from > epsilonMm !== to > epsilonMm) {
			crossings.push(
				previous[along] -
					(from * (next[along] - previous[along])) / (to - from),
			);
		}
		previous = next;
	}
	crossings.sort((a, b) => a - b);
	const distinctCrossings: number[] = [];
	for (const crossing of crossings) {
		const previousCrossing = distinctCrossings.at(-1);
		if (
			previousCrossing !== undefined &&
			Math.abs(crossing - previousCrossing) <= epsilonMm
		) {
			distinctCrossings.pop();
		} else {
			distinctCrossings.push(crossing);
		}
	}
	const coordinate = center[along];
	for (let index = 0; index + 1 < distinctCrossings.length; index += 2) {
		const start = distinctCrossings[index];
		const end = distinctCrossings[index + 1];
		if (
			start === undefined ||
			end === undefined ||
			coordinate <= start ||
			coordinate >= end
		)
			continue;
		let first = start;
		let last = end;
		for (const [edgeStart, edgeEnd] of alignedEdges) {
			if (edgeStart <= coordinate && coordinate <= edgeEnd) return undefined;
			if (edgeEnd < coordinate) first = Math.max(first, edgeEnd);
			if (edgeStart > coordinate) last = Math.min(last, edgeStart);
		}
		return [first, last];
	}
	return undefined;
}

function tileSection(
	room: DerivedOrthogonalRoomFace,
	center: PlanFacePointMm,
	along: Axis,
	across: Axis,
): Interval | undefined {
	const before: Interval[] = [];
	const after: Interval[] = [];
	for (const tile of room.usableFloorTilesMm) {
		const x: Interval = [tile.minXmm, tile.maxXmm];
		const z: Interval = [tile.minZmm, tile.maxZmm];
		const [min, max] = across === "xMm" ? x : z;
		const span = along === "xMm" ? x : z;
		if (min < center[across] && center[across] <= max) before.push(span);
		if (min <= center[across] && center[across] < max) after.push(span);
	}
	// Two-sided coverage crosses internal seams and stops at an exposed edge.
	const first = intervalContaining(before, center[along]);
	const second = intervalContaining(after, center[along]);
	return first && second
		? [Math.max(first[0], second[0]), Math.min(first[1], second[1])]
		: undefined;
}

function intervalContaining(
	intervals: Interval[],
	coordinate: number,
): Interval | undefined {
	intervals.sort((a, b) => a[0] - b[0]);
	let start = Infinity;
	let end = -Infinity;
	for (const [nextStart, nextEnd] of intervals) {
		if (nextStart > end + epsilonMm) {
			if (coordinate > start && coordinate < end) return [start, end];
			start = nextStart;
		}
		end = Math.max(end, nextEnd);
	}
	return coordinate > start && coordinate < end ? [start, end] : undefined;
}

export function itemWallDistancesFor(
	rooms: readonly DerivedOrthogonalRoomFace[],
	footprint: FloorItemFootprint,
): readonly ItemWallDistance[] {
	const corners = floorItemFootprintCorners(footprint);
	for (const room of rooms) {
		const sections = axes.map(({ along, across }) =>
			room.usableFloorPolygonMm
				? polygonSection(room.usableFloorPolygonMm, footprint, along, across)
				: tileSection(room, footprint, along, across),
		);
		if (sections.some((section) => !section)) continue;
		return axes.flatMap(({ along, across, negative, positive }, index) => {
			const wall = sections[index];
			const edge = polygonSection(corners, footprint, along, across);
			if (!wall || !edge) return [];
			const center = { xMm: footprint.xMm, zMm: footprint.zMm };
			return (
				[
					[negative, 0, -1],
					[positive, 1, 1],
				] as const
			).map(([side, index, sign]) => ({
				side,
				start: { ...center, [along]: edge[index] },
				end: { ...center, [along]: wall[index] },
				distanceMm: (wall[index] - edge[index]) * sign,
			}));
		});
	}
	return [];
}

/** Invert one displayed measurement within the same usable room section. */
export function itemWallDistancePositionFor(
	rooms: readonly DerivedOrthogonalRoomFace[],
	footprint: FloorItemFootprint,
	side: ItemWallDistance["side"],
	valueMm: number,
): (PlanFacePointMm & { readonly roomId: string }) | undefined {
	if (!Number.isSafeInteger(valueMm) || valueMm < 0) return undefined;
	const axis = axes.find(({ negative, positive }) => side === negative || side === positive);
	if (!axis) return undefined;

	for (const room of rooms) {
		const original = itemWallDistancesFor([room], footprint).find((entry) => entry.side === side);
		if (!original) continue;
		const sign = side === axis.negative ? 1 : -1;
		const coordinate = footprint[axis.along] + Math.round((valueMm - original.distanceMm) * sign);
		if (!Number.isSafeInteger(coordinate)) return undefined;
		const candidate = { ...footprint, [axis.along]: coordinate };
		const updated = itemWallDistancesFor([room], candidate).find((entry) => entry.side === side);
		if (
			!updated ||
			Math.abs(original.end[axis.along] - updated.end[axis.along]) > epsilonMm ||
			updated.distanceMm < -epsilonMm ||
			Math.round(updated.distanceMm) !== valueMm
		)
			return undefined;
		return { xMm: candidate.xMm, zMm: candidate.zMm, roomId: room.roomId };
	}
	return undefined;
}
