import { resolveOrthogonalPlanFaces } from "./derived-orthogonal-plan-faces";
import { resolveSupportedPlacements } from "./interior-support";
import { floorItemFootprintIntersectsDoorSwing, footprintsOverlap } from "./parametric-item";
import {
	isFloorSchematicAssetInstance,
	isWallSchematicAssetInstance,
	type Project,
	type Vertex,
	type WallSegment,
} from "./project";
import { orientedWallFootprint, slidingDoorSweepFor } from "./sliding-door-geometry";
import type { UpdateWallOpeningInput } from "./wall-opening";
import {
	type AddDoorOpeningInput,
	type AddDoorOpeningResult,
	type AddWindowOpeningInput,
	addDoorOpening,
	addWindowOpening,
	type DeleteWallOpeningResult,
	deleteWallOpening,
	moveWallOpening,
	PREFERRED_WINDOW_SILL_MM,
	type UpdateWallOpeningResult,
	updateWallOpening,
	type WallOpening,
	type WallOpeningHost,
	type WallOpeningState,
	wallItemObstructsOpening,
	type WindowOpening,
} from "./wall-opening";

interface IdSource {
	next(): string;
}

export type DoorOpeningProjectMutationResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| Extract<AddDoorOpeningResult, { readonly kind: "rejected" }>
	| Extract<DeleteWallOpeningResult, { readonly kind: "rejected" }>
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "INVALID_WALL_HOST"
				| "DOOR_CLEARANCE_COLLISION"
				| "WALL_OPENING_COLLISION";
	  };

export type UpdateProjectWallOpeningInput = UpdateWallOpeningInput | {
	readonly kind: "align-matching-windows";
	readonly openingId: string;
};

/**
 * Adds a durable Door only after resolving the selected concrete wall's
 * length and safe height from the PlanGraph. A shared wall uses the shorter
 * adjacent Room height, while its renderer can still use the taller envelope.
 */
export function addDoorOpeningToProject(
	project: Project,
	input: AddDoorOpeningInput,
	ids: IdSource,
	updatedAt: string,
): DoorOpeningProjectMutationResult {
	const wallHosts = wallOpeningHostsForProject(project);
	if (!wallHosts) {
		return { kind: "rejected", reasonCode: "INVALID_WALL_HOST" };
	}
	const added = addDoorOpening(
		{ openings: project.level.openings, wallHosts },
		input,
		{ next: () => "" },
	);
	if (added.kind === "rejected") {
		return added;
	}
	if (!openingsKeepFloorItemsClear(project, added.openings)) {
		return { kind: "rejected", reasonCode: "DOOR_CLEARANCE_COLLISION" };
	}
	if (!openingsKeepWallItemsClear(project, added.openings)) {
		return { kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			level: { ...project.level, openings: added.openings.map((opening, index) =>
				index === project.level.openings.length ? { ...opening, openingId: ids.next() } : opening) },
			updatedAt,
		},
	};
}

/** Adds a Window only after its canonical wall host and height are derived. */
export function addWindowOpeningToProject(
	project: Project,
	input: AddWindowOpeningInput,
	ids: IdSource,
	updatedAt: string,
): DoorOpeningProjectMutationResult {
	const wallHosts = wallOpeningHostsForProject(project);
	if (!wallHosts) {
		return { kind: "rejected", reasonCode: "INVALID_WALL_HOST" };
	}
	const added = addWindowOpening(
		{ openings: project.level.openings, wallHosts },
		input,
		ids,
	);
	if (added.kind === "rejected") {
		return added;
	}
	if (!openingsKeepWallItemsClear(project, added.openings)) {
		return { kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			level: { ...project.level, openings: added.openings },
			updatedAt,
		},
	};
}

/** Removes only one opening host record; its canonical WallSegment is unchanged. */
export function deleteDoorOpeningFromProject(
	project: Project,
	input: { readonly openingId: string },
	updatedAt: string,
): DoorOpeningProjectMutationResult {
	const deleted = deleteWallOpening(project.level.openings, input.openingId);
	if (deleted.kind === "rejected") {
		return deleted;
	}
	return {
		kind: "accepted",
		project: {
			...project,
			level: { ...project.level, openings: deleted.openings },
			updatedAt,
		},
	};
}

/** Moves one existing durable Door along its original canonical wall host. */
export function moveDoorOpeningInProject(
	project: Project,
	input: { readonly openingId: string; readonly offsetMm: number },
	updatedAt: string,
): DoorOpeningProjectMutationResult {
	const wallHosts = wallOpeningHostsForProject(project);
	if (!wallHosts) {
		return { kind: "rejected", reasonCode: "INVALID_WALL_HOST" };
	}
	const moved = moveWallOpening(
		{ openings: project.level.openings, wallHosts },
		input,
	);
	if (moved.kind === "rejected") {
		return moved;
	}
	if (!openingsKeepFloorItemsClear(project, moved.openings)) {
		return { kind: "rejected", reasonCode: "DOOR_CLEARANCE_COLLISION" };
	}
	if (!openingsKeepWallItemsClear(project, moved.openings)) {
		return { kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			level: { ...project.level, openings: moved.openings },
			updatedAt,
		},
	};
}

/** Edits an Opening or aligns matching Window sills in one Project update. */
export function updateDoorOpeningInProject(
	project: Project,
	input: UpdateProjectWallOpeningInput,
	updatedAt: string,
): DoorOpeningProjectMutationResult {
	const wallHosts = wallOpeningHostsForProject(project);
	if (!wallHosts) {
		return { kind: "rejected", reasonCode: "INVALID_WALL_HOST" };
	}
	const state = { openings: project.level.openings, wallHosts };
	const updated = "kind" in input
		? alignMatchingWindowSills(state, input.openingId)
		: updateWallOpening(state, input);
	if (updated.kind === "rejected") {
		return updated;
	}
	if (updated.openings === state.openings) {
		return { kind: "accepted", project };
	}
	if (!openingsKeepFloorItemsClear(project, updated.openings)) {
		return { kind: "rejected", reasonCode: "DOOR_CLEARANCE_COLLISION" };
	}
	if (!openingsKeepWallItemsClear(project, updated.openings)) {
		return { kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			level: { ...project.level, openings: updated.openings },
			updatedAt,
		},
	};
}

/** A Window can explicitly align equal-size peers on its canonical wall. */
export function windowsWithMixedSillsOnSameWall(
	openings: readonly WallOpening[],
	openingId: string,
): readonly WindowOpening[] {
	const selected = openings.find((opening) => opening.openingId === openingId);
	if (selected?.kind !== "Window") return [];
	const matching = openings.filter((opening): opening is WindowOpening =>
		opening.kind === "Window" &&
		opening.wallSegmentId === selected.wallSegmentId &&
		opening.widthMm === selected.widthMm &&
		opening.heightMm === selected.heightMm,
	);
	return matching.some((opening) => opening.sillMm !== selected.sillMm) ? matching : [];
}

function alignMatchingWindowSills(state: WallOpeningState, openingId: string): UpdateWallOpeningResult {
	const matching = windowsWithMixedSillsOnSameWall(state.openings, openingId);
	const first = matching[0];
	if (!first) return { kind: "accepted", openings: state.openings };
	const host = state.wallHosts.find((wall) => wall.wallSegmentId === first.wallSegmentId);
	if (!host) return { kind: "rejected", reasonCode: "WALL_NOT_FOUND" };
	const sillMm = Math.min(PREFERRED_WINDOW_SILL_MM, host.heightMm - first.heightMm);
	let openings = state.openings;
	for (const window of matching) {
		const updated = updateWallOpening({ ...state, openings }, { openingId: window.openingId, sillMm });
		if (updated.kind === "rejected") return updated;
		openings = updated.openings;
	}
	return { kind: "accepted", openings };
}

/**
 * Revalidates every durable Opening against the current canonical PlanGraph.
 * Topology commands call this before publication so an Opening can never
 * remain attached to a deleted wall or a wall that no longer has a valid
 * derived host.
 */
export function projectOpeningsRemainValid(project: Project): boolean {
	if (project.level.openings.length === 0) {
		return true;
	}
	const wallHosts = wallOpeningHostsForProject(project);
	if (!wallHosts) {
		return false;
	}
	const openingIds = new Set<string>();
	for (const opening of project.level.openings) {
		if (!opening.openingId || openingIds.has(opening.openingId)) {
			return false;
		}
		openingIds.add(opening.openingId);
		const revalidated =
			opening.kind === "Door"
				? addDoorOpening(
						{
							openings: project.level.openings.filter(
								(candidate) => candidate.openingId !== opening.openingId,
							),
							wallHosts,
						},
						opening,
						{ next: () => "validated-opening" },
					)
				: addWindowOpening(
						{
							openings: project.level.openings.filter(
								(candidate) => candidate.openingId !== opening.openingId,
							),
							wallHosts,
						},
						opening,
						{ next: () => "validated-opening" },
					);
		if (revalidated.kind === "rejected") {
			return false;
		}
	}
	return (
		openingsKeepFloorItemsClear(project, project.level.openings) &&
		openingsKeepWallItemsClear(project, project.level.openings)
	);
}

function openingsKeepWallItemsClear(
	project: Project,
	openings: readonly Project["level"]["openings"][number][],
): boolean {
	return openings.every((opening) => project.assetInstances.every((item) =>
		!isWallSchematicAssetInstance(item) || !wallItemObstructsOpening(item, opening)));
}

function openingsKeepFloorItemsClear(
	project: Project,
	openings: readonly Project["level"]["openings"][number][],
): boolean {
	const verticesById = indexVertices(project.level.vertices);
	if (!verticesById) return false;
	const guests = project.supportedItems?.length ? resolveSupportedPlacements(project) : [];
	return openings.every((opening) => {
		if (opening.kind !== "Door" || (opening.variant !== "sliding" && opening.sillMm !== 0)) return true;
		const wall = project.level.wallSegments.find(
			(candidate) => candidate.wallSegmentId === opening.wallSegmentId,
		);
		const start = wall ? verticesById.get(wall.startVertexId) : undefined;
		const end = wall ? verticesById.get(wall.endVertexId) : undefined;
		if (!wall || !start || !end) return false;
		const slider = slidingDoorSweepFor(opening, wall, start, end);
		if (!slider) return project.assetInstances.every((item) => !isFloorSchematicAssetInstance(item) ||
			!floorItemFootprintIntersectsDoorSwing(item, opening, start, end));
		if (guests.some((guest) => guest.bottomMm < slider.topMm && guest.topMm > slider.bottomMm &&
			footprintsOverlap(guest, slider.footprint))) return false;
		for (const other of project.level.wallSegments) {
			if (other.wallSegmentId === wall.wallSegmentId) continue;
			const a = verticesById.get(other.startVertexId);
			const b = verticesById.get(other.endVertexId);
			if (!a || !b) return false;
			if (footprintsOverlap(slider.footprint, orientedWallFootprint(a, b, other.thicknessMm))) return false;
		}
		return project.assetInstances.every((item) => !isFloorSchematicAssetInstance(item) ||
			item.heightMm <= slider.bottomMm || !footprintsOverlap(item, slider.footprint));
	});
}

/** Derived opening hosts are intentionally disposable; only the Opening stores its host address. */
export function wallOpeningHostsForProject(
	project: Project,
): readonly WallOpeningHost[] | undefined {
	const resolved = resolveOrthogonalPlanFaces(project);
	if (resolved.kind === "rejected") {
		return undefined;
	}
	const verticesById = indexVertices(project.level.vertices);
	const wallsById = indexWalls(project.level.wallSegments);
	if (!verticesById || !wallsById) {
		return undefined;
	}
	const hosts: WallOpeningHost[] = [];
	for (const wallProjection of resolved.plan.walls) {
		const wall = wallsById.get(wallProjection.wallSegmentId);
		const lengthMm = wall ? wallLengthMm(wall, verticesById) : undefined;
		if (lengthMm === undefined) {
			return undefined;
		}
		const adjacentRoomHeights = resolved.plan.rooms
			.filter((room) =>
				room.boundaryWallSegmentIds.includes(wallProjection.wallSegmentId),
			)
			.map((room) => room.heightMm);
		const heightMm =
			adjacentRoomHeights.length === 0
				? wallProjection.heightMm
				: Math.min(...adjacentRoomHeights);
		if (!Number.isSafeInteger(heightMm) || heightMm <= 0) {
			return undefined;
		}
		hosts.push({
			heightMm,
			usableLengthMm: lengthMm,
			wallSegmentId: wallProjection.wallSegmentId,
		});
	}
	return hosts;
}

function indexVertices(
	vertices: readonly Vertex[],
): ReadonlyMap<string, Vertex> | undefined {
	const result = new Map<string, Vertex>();
	for (const vertex of vertices) {
		if (!vertex.vertexId || result.has(vertex.vertexId)) {
			return undefined;
		}
		result.set(vertex.vertexId, vertex);
	}
	return result;
}

function indexWalls(
	walls: readonly WallSegment[],
): ReadonlyMap<string, WallSegment> | undefined {
	const result = new Map<string, WallSegment>();
	for (const wall of walls) {
		if (!wall.wallSegmentId || result.has(wall.wallSegmentId)) {
			return undefined;
		}
		result.set(wall.wallSegmentId, wall);
	}
	return result;
}

function wallLengthMm(
	wall: WallSegment,
	verticesById: ReadonlyMap<string, Vertex>,
): number | undefined {
	const start = verticesById.get(wall.startVertexId);
	const end = verticesById.get(wall.endVertexId);
	if (!start || !end) {
		return undefined;
	}
	const deltaXMm = end.xMm - start.xMm;
	const deltaZMm = end.zMm - start.zMm;
	// The durable wall endpoints are integer millimetres, while a 45-degree
	// length is irrational. The PlanGraph resolver has already admitted only
	// cardinal/45-degree walls; openings keep their integer-mm address, so a
	// floored interval remains strictly within the actual physical segment.
	const lengthMm = Math.floor(Math.hypot(deltaXMm, deltaZMm));
	return Number.isSafeInteger(lengthMm) && lengthMm > 0 ? lengthMm : undefined;
}
