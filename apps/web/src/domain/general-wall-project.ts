import {
	type AddWallSegmentInput,
	type AddWallSegmentResult,
	addWallSegment,
} from "./add-wall-segment";
import {
	type DeleteWallSegmentResult,
	deleteWallSegments,
} from "./delete-wall-segment";
import {
	type DerivedOrthogonalFace,
	deriveBoundedOrthogonalFaces,
	type PlanGraph,
} from "./derive-plan-faces";
import { resolveOrthogonalPlanFaces } from "./derived-orthogonal-plan-faces";
import { reverseDoorOpeningOrientation } from "./door-opening-orientation";
import { projectOpeningsRemainValid } from "./door-opening-project";
import {
	findRoomForFloorItem,
	floorItemFootprintIntersectsWall,
} from "./parametric-item";
import { isWallSchematicAssetPlacementValid } from "./parametric-wall-item";
import {
	type FloorSchematicAssetInstance,
	isFloorSchematicAssetInstance,
	isWallSchematicAssetInstance,
	type Project,
	type Room,
	type SchematicAssetInstance,
	type Vertex,
	type WallOpening,
	type WallSchematicAssetInstance,
	type WallSegment,
} from "./project";
import { wallOpeningIntervalMm } from "./wall-opening";
import {
	otherEndpoint,
	type UninterruptedWallRun,
	uninterruptedWallRunForGraph,
	verticesAreCollinear,
} from "./wall-runs";

export type { UninterruptedWallRun } from "./wall-runs";

const DEFAULT_ROOM_HEIGHT_MM = 2600;
const MAX_EDITABLE_WALL_THICKNESS_MM = 1000;
const MIN_EDITABLE_WALL_THICKNESS_MM = 20;

interface IdSource {
	next(): string;
}

interface Bounds {
	readonly maxXMm: number;
	readonly maxZMm: number;
	readonly minXMm: number;
	readonly minZMm: number;
}

interface FaceInsets {
	readonly maxXMm: number;
	readonly maxZMm: number;
	readonly minXMm: number;
	readonly minZMm: number;
}

type RectangularFace = {
	readonly bounds: Bounds;
	readonly insets: FaceInsets;
	/** A polygon keeps its derived envelope only for deterministic ordering. */
	readonly key: string;
	readonly kind: "polygonal" | "rectangular";
	readonly source: DerivedOrthogonalFace;
	readonly thicknessMm: number;
};

interface SourceRoom {
	readonly face: RectangularFace;
	readonly room: Room;
}

interface PlannedTargetFace {
	readonly contributors: readonly SourceRoom[];
	readonly face: RectangularFace;
}

interface MaterializedTargetFace {
	readonly face: RectangularFace;
	readonly room: Room;
}

interface SplitOpeningRehost {
	readonly opening: WallOpening;
	readonly target: "head" | "tail" | "unaffected";
}

interface SplitWallItemRehost {
	readonly item: WallSchematicAssetInstance;
	readonly target: "head" | "tail" | "unaffected";
}

interface AddedWallHostSuccessor {
	readonly endDistanceMm: number;
	readonly startDistanceMm: number;
	readonly wall: WallSegment;
}

export type GeneralWallProjectMutationReason =
	| Extract<AddWallSegmentResult, { readonly kind: "rejected" }>["reasonCode"]
	| Extract<
			DeleteWallSegmentResult,
			{ readonly kind: "rejected" }
	  >["reasonCode"]
	| "INVALID_RESULTING_PROJECT"
	| "INVALID_SOURCE_PROJECT"
	| "INVALID_DIMENSION"
	| "ITEM_HOST_UNRESOLVABLE"
	| "OPENING_CONFLICT_STALE"
	| "OPENING_HOST_UNRESOLVABLE"
	| "PROJECT_BOUNDS_EXCEEDED"
	| "ROOM_METADATA_CONFLICT_STALE"
	| "WALL_DELETION_CONFLICT_STALE"
	| "ROOM_HEIGHT_CONFLICT"
	| "ROOM_USABLE_AREA_COLLAPSE"
	| "USABLE_POLYGON_COLLAPSED"
	| "UNSUPPORTED_FACE_SHAPE"
	| "UNSUPPORTED_WALL_THICKNESS"
	| "WALL_DELETION_CONFLICT"
	| "WALL_ADD_CONFLICT_STALE"
	| "WALL_DOOR_OPENING_COLLISION"
	| "WALL_ITEM_COLLISION"
	| "WALL_NOT_MOVABLE"
	| "WALL_POSITION_UNCHANGED"
	| "WALL_RUN_SELECTION_STALE"
	| "WALL_SPLIT_CONFLICT_STALE"
	| "WALL_SPLIT_POINT_INVALID"
	| "VERTEX_NOT_FOUND"
	| "VERTEX_NOT_DELETABLE"
	| "VERTEX_NOT_MOVABLE"
	| "VERTEX_POSITION_UNCHANGED";

interface GeneralWallSelectionInput {
	readonly wallSegmentId: string;
	/** Ordered complete run shown for the selected wall. */
	readonly wallRunSegmentIds?: readonly string[];
}

export interface ChangeGeneralWallThicknessInput
	extends GeneralWallSelectionInput {
	readonly thicknessMm: number;
}

/** Reverses the canonical local direction of one stable WallSegment. */
export interface ReverseGeneralWallInput {
	readonly wallSegmentId: string;
}

/** A signed exact-mm translation used only by the touch-constrained wall route. */
export interface WallTranslationMm {
	readonly xMm: number;
	readonly zMm: number;
}

/**
 * Moves a straight wall parallel to itself, preserving all its vertex IDs.
 * Cardinal walls use their single normal coordinate; a 45-degree wall uses an
 * equally exact two-axis normal translation so no user-facing coordinate form
 * is required.
 */
export type MoveGeneralWallInput = GeneralWallSelectionInput &
	(
		| {
				readonly positionMm: number;
				readonly translationMm?: never;
		  }
		| {
				readonly positionMm?: never;
				readonly translationMm: WallTranslationMm;
		  }
	);

/** Moves one existing graph Vertex; all attached alpha wall directions stay cardinal. */
export interface MoveGeneralVertexInput {
	readonly vertexId: string;
	readonly xMm: number;
	readonly zMm: number;
}

/** Removes only a redundant inline graph Vertex by merging its two wall pieces. */
export interface DeleteGeneralVertexInput {
	readonly vertexId: string;
}

/** Pure UI/domain eligibility for the one supported redundant-Vertex route. */
export function isGeneralVertexDeletionEligible(
	source: Project,
	vertexId: string,
): boolean {
	const vertex = source.level.vertices.find(
		(candidate) => candidate.vertexId === vertexId,
	);
	if (!vertex) return false;
	const incident = source.level.wallSegments.filter(
		(wall) => wall.startVertexId === vertexId || wall.endVertexId === vertexId,
	);
	const first = incident[0];
	const second = incident[1];
	if (
		!first ||
		!second ||
		incident.length !== 2 ||
		first.thicknessMm !== second.thicknessMm ||
		source.level.openings.some(
			(opening) =>
				opening.wallSegmentId === first.wallSegmentId ||
				opening.wallSegmentId === second.wallSegmentId,
		)
	) {
		return false;
	}
	const verticesById = new Map(
		source.level.vertices.map((candidate) => [candidate.vertexId, candidate]),
	);
	const firstOtherId = otherEndpoint(first, vertexId);
	const secondOtherId = otherEndpoint(second, vertexId);
	const firstOther = firstOtherId ? verticesById.get(firstOtherId) : undefined;
	const secondOther = secondOtherId
		? verticesById.get(secondOtherId)
		: undefined;
	return Boolean(
		firstOther &&
			secondOther &&
			verticesAreCollinear(firstOther, vertex, secondOther),
	);
}

/** Splits a selected alpha segment at one exact point chosen by the gesture route. */
export type SplitGeneralWallInput =
	| {
			readonly pointMm?: never;
			readonly positionMm: number;
			readonly wallSegmentId: string;
	  }
	| {
			readonly pointMm: { readonly xMm: number; readonly zMm: number };
			readonly positionMm?: never;
			readonly wallSegmentId: string;
	  };

export type GeneralWallProjectMutationResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode: GeneralWallProjectMutationReason;
			readonly affected?: GeneralWallProjectMutationAffectedReference;
	  };

/** A rejection may safely name only the stable semantic resource that needs correction. */
export type GeneralWallProjectMutationAffectedReference =
	| { readonly assetInstanceId: string; readonly kind: "floor-item" }
	| { readonly assetInstanceId: string; readonly kind: "wall-item" }
	| { readonly kind: "opening"; readonly openingId: string };

/** An exact split point can cut one or more existing Opening intervals. */
export type WallSplitOpeningConflictPreview =
	| { readonly kind: "none"; readonly wallSegmentId: string }
	| {
			readonly kind: "conflict";
			readonly openingIds: readonly string[];
			readonly wallSegmentId: string;
	  };

/** A user-approved destructive outcome for only the Openings cut by one split. */
export type SplitGeneralWallOpeningResolutionInput = SplitGeneralWallInput & {
	readonly openingIds: readonly string[];
};

/** Exact hosted resources whose intervals are cut by one proposed Wall split. */
export type WallSplitHostConflictPreview =
	| { readonly kind: "none"; readonly wallSegmentId: string }
	| {
			readonly itemIds: readonly string[];
			readonly kind: "conflict";
			readonly openingIds: readonly string[];
			readonly wallSegmentId: string;
	  };

/** A refreshed, explicit delete outcome for every host cut by one Wall split. */
export type SplitGeneralWallHostResolutionInput = SplitGeneralWallInput & {
	readonly itemIds: readonly string[];
	readonly openingIds: readonly string[];
};

/** Hosted resources whose stable wall address is cut by a proposed AddWall T/X contact. */
export type WallAddHostConflictPreview =
	| { readonly kind: "none" }
	| {
			readonly itemIds: readonly string[];
			readonly kind: "conflict";
			readonly openingIds: readonly string[];
	  };

/** A refreshed, explicit delete outcome for every host cut by AddWall. */
export type AddGeneralWallHostResolutionInput = AddWallSegmentInput & {
	readonly itemIds: readonly string[];
	readonly openingIds: readonly string[];
};

/** An allocation-free description of the exact Opening records a wall deletion would affect. */
export type WallDeletionOpeningConflictPreview =
	| { readonly kind: "none"; readonly wallSegmentId: string }
	| {
			readonly kind: "conflict";
			readonly openingIds: readonly string[];
			readonly wallSegmentId: string;
	  };

export type DeleteGeneralWallInput = GeneralWallSelectionInput;

/** The displayed wall stops at every corner, branch and thickness transition. */
export function uninterruptedWallRun(
	source: Project,
	wallSegmentId: string,
): UninterruptedWallRun | undefined {
	return uninterruptedWallRunForGraph(source.level, wallSegmentId);
}

function confirmedWallRun(
	source: Project,
	input: GeneralWallSelectionInput,
): UninterruptedWallRun | undefined {
	const confirmedIds = input.wallRunSegmentIds;
	if (confirmedIds === undefined) return undefined;
	const run = uninterruptedWallRun(source, input.wallSegmentId);
	return run &&
		run.wallSegmentIds.length === confirmedIds.length &&
		confirmedIds.every((id, index) => run.wallSegmentIds[index] === id)
		? run
		: undefined;
}

function selectedWallSegmentIds(
	source: Project,
	input: GeneralWallSelectionInput,
): readonly string[] | undefined {
	return input.wallRunSegmentIds === undefined
		? [input.wallSegmentId]
		: confirmedWallRun(source, input)?.wallSegmentIds;
}

/**
 * The complete, allocation-free consequence preview for deleting a wall.
 * `itemIds` contains floor items that cannot be hosted by exactly one
 * resulting derived Room and wall items directly hosted by the deleted
 * segment. Other wall-local addresses remain untouched.
 */
export type WallDeletionConflictPreview =
	| { readonly kind: "none"; readonly wallSegmentId: string }
	| {
			readonly itemIds: readonly string[];
			readonly kind: "conflict";
			readonly openingIds: readonly string[];
			readonly roomMetadataConflicts?: readonly RoomMetadataMergeConflict[];
			readonly roomIds: readonly string[];
			readonly wallSegmentId: string;
	  };

/** A deletion can merge several source Rooms into one derived face. */
export interface RoomMetadataMergeConflict {
	readonly retainedRoomIds: readonly string[];
	readonly targetFaceKey: string;
}

export interface DeleteGeneralWallRoomMetadataResolution {
	readonly retainedRoomId: string;
	readonly targetFaceKey: string;
}

type GeneralWallProjectAccepted = Extract<
	GeneralWallProjectMutationResult,
	{ readonly kind: "accepted" }
>;

/**
 * A narrow recovery result for projects saved while the first free-wall route
 * still persisted only the graph. It never repairs arbitrary metadata: it
 * acts solely when there is no Room, no hosted asset and no Opening to
 * reinterpret, and the existing graph already proves rectangular faces.
 */
export type MissingRoomsReconciliationResult = {
	readonly changed: boolean;
	readonly kind: "accepted";
	readonly project: Project;
};

/**
 * Materializes Room metadata from an already closed PlanGraph that has none.
 * This is intentionally idempotent and leaves open, non-rectangular, or
 * otherwise unsupported graphs untouched for the user to continue editing.
 */
export function reconcileMissingRoomsFromPlanGraph(
	source: Project,
	ids: IdSource,
	updatedAt: string,
): MissingRoomsReconciliationResult {
	if (
		source.level.rooms.length !== 0 ||
		source.assetInstances.length !== 0 ||
		source.level.openings.length !== 0
	) {
		return unchanged(source);
	}
	const targetFaces = facesForGraph(graphOf(source));
	if (targetFaces.kind === "rejected" || targetFaces.faces.length === 0) {
		return unchanged(source);
	}
	const planned = planAddedFaces([], targetFaces.faces);
	if (planned.kind === "rejected") {
		return unchanged(source);
	}
	const projectionProbe: Project = {
		...source,
		level: {
			...source.level,
			rooms: planned.faces.map(({ face }, index) => ({
				faceFingerprint: gridFingerprint(face),
				heightMm: DEFAULT_ROOM_HEIGHT_MM,
				roomId: `__reconcile_probe_${index}`,
			})),
		},
	};
	if (resolveOrthogonalPlanFaces(projectionProbe).kind === "rejected") {
		return unchanged(source);
	}
	const triangle = firstTriangularFaceForEmptyProject(source, graphOf(source));
	if (triangle) {
		const accepted = acceptedInitialTriangleProject(
			source,
			graphOf(source),
			triangle,
			ids.next(),
			updatedAt,
		);
		return accepted.kind === "accepted"
			? reconciled(accepted)
			: unchanged(source);
	}
	const rooms = materializeAddedRooms(planned.faces, ids);
	const accepted = acceptedProject(source, graphOf(source), rooms, updatedAt);
	return accepted.kind === "accepted"
		? reconciled(accepted)
		: unchanged(source);
}

/**
 * Adds one explicit cardinal segment to the V1 PlanGraph. The command does
 * not infer a divider from a click: it receives both endpoints, proves the
 * resulting faces and item hosts with disposable IDs, then materializes IDs
 * only for an accepted Project mutation.
 *
 * Detached walls intentionally remain valid even though the legacy V1 plan
 * projection does not yet render walls without a face owner. The root route
 * can therefore adopt this command before replacing that projection.
 */
export function addGeneralWallToProject(
	source: Project,
	input: AddWallSegmentInput,
	ids: IdSource,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return sourceProject;
	}
	const intersectedOpening = firstOpeningIntersectedByWall(input, source);
	if (intersectedOpening) {
		return reject("WALL_DOOR_OPENING_COLLISION", {
			kind: "opening",
			openingId: intersectedOpening.openingId,
		});
	}

	const addInput = addInputForProject(source, input);
	const preview = addWallSegment(graphOf(source), addInput, previewIds());
	if (preview.kind === "rejected") {
		return preview;
	}
	const intersectedFloorItem = firstFloorItemIntersectedByWall(
		input,
		source.assetInstances,
	);
	if (intersectedFloorItem) {
		return reject("WALL_ITEM_COLLISION", {
			assetInstanceId: intersectedFloorItem.assetInstanceId,
			kind: "floor-item",
		});
	}
	const previewWallItems = rehostWallItemsAfterAddedGraph(
		source,
		preview.graph,
	);
	if (previewWallItems.kind === "rejected") {
		return reject("WALL_ITEM_COLLISION", {
			assetInstanceId: previewWallItems.assetInstanceId,
			kind: "wall-item",
		});
	}
	const previewOpenings = rehostOpeningsAfterAddedGraph(source, preview.graph);
	if (previewOpenings.kind === "rejected") {
		return reject("WALL_DOOR_OPENING_COLLISION", {
			kind: "opening",
			openingId: previewOpenings.opening.openingId,
		});
	}
	const previewTriangle = firstTriangularFaceForEmptyProject(
		source,
		preview.graph,
	);
	if (previewTriangle) {
		const applied = addWallSegment(graphOf(source), addInput, ids);
		if (applied.kind === "rejected") {
			return applied;
		}
		const materializedTriangle = firstTriangularFaceForEmptyProject(
			source,
			applied.graph,
		);
		return materializedTriangle
			? acceptedInitialTriangleProject(
					source,
					applied.graph,
					materializedTriangle,
					ids.next(),
					updatedAt,
				)
			: reject("INVALID_RESULTING_PROJECT");
	}

	const targetFaces = facesForGraph(preview.graph);
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	const planned = planAddedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return planned;
	}
	// The source inspection already proved the full footprint of items whose Room stays intact.
	const retainedFloorHostRoomIds = new Set<string>();
	for (const {
		contributors: [previous],
		face,
	} of planned.faces) {
		if (previous && sameFace(previous.face, face)) {
			retainedFloorHostRoomIds.add(previous.room.roomId);
		}
	}
	const itemsWithChangedRooms = source.assetInstances.filter(
		(item) =>
			isFloorSchematicAssetInstance(item) &&
			!retainedFloorHostRoomIds.has(item.roomId),
	);
	if (!itemsFitExactlyOneTarget(itemsWithChangedRooms, planned.faces)) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}

	const applied = addWallSegment(graphOf(source), addInput, ids);
	if (applied.kind === "rejected") {
		return applied;
	}
	// The preview graph has disposable segment IDs, but the materialized graph
	// has real IDs. Re-derive from that graph before persisting Room metadata so
	// each face points at the actual canonical wall identity.
	const materializedFaces = facesForGraph(applied.graph);
	if (materializedFaces.kind === "rejected") {
		return materializedFaces;
	}
	const materializedPlan = planAddedFaces(
		sourceProject.faces,
		materializedFaces.faces,
	);
	if (materializedPlan.kind === "rejected") {
		return materializedPlan;
	}
	const rooms = materializeAddedRooms(materializedPlan.faces, ids);
	const wallItems = rehostWallItemsAfterAddedGraph(source, applied.graph);
	const openings = rehostOpeningsAfterAddedGraph(source, applied.graph);
	if (wallItems.kind === "rejected" || openings.kind === "rejected") {
		throw new Error(
			"A proven wall-host reconciliation changed while IDs were materialized",
		);
	}
	return acceptedProject(
		{
			...source,
			assetInstances: wallItems.assetInstances,
			level: { ...source.level, openings: openings.openings },
		},
		applied.graph,
		rooms,
		updatedAt,
		retainedFloorHostRoomIds,
	);
}

/**
 * Allocation-free preview for an exact T/X contact that would cut a durable
 * wall-local address. A plain collision remains a rejection; only resources
 * whose host has no unique successor are offered as an explicit consequence.
 */
export function previewWallAddHostConflict(
	source: Project,
	input: AddWallSegmentInput,
): WallAddHostConflictPreview {
	const preview = addWallSegment(
		graphOf(source),
		addInputForProject(source, input),
		previewIds(),
	);
	if (preview.kind === "rejected") return { kind: "none" };
	const itemIds = source.assetInstances
		.filter(
			(item): item is WallSchematicAssetInstance =>
				isWallSchematicAssetInstance(item) &&
				!successorForHostedInterval(
					wallHostSuccessorsAfterAdd(source, preview.graph, item.wallSegmentId),
					item.offsetMm,
					item.widthMm,
				),
		)
		.map((item) => item.assetInstanceId)
		.sort();
	const openingIds = source.level.openings
		.filter(
			(opening) =>
				!successorForHostedInterval(
					wallHostSuccessorsAfterAdd(
						source,
						preview.graph,
						opening.wallSegmentId,
					),
					opening.offsetMm,
					opening.widthMm,
				),
		)
		.map((opening) => opening.openingId)
		.sort();
	return itemIds.length === 0 && openingIds.length === 0
		? { kind: "none" }
		: { itemIds, kind: "conflict", openingIds };
}

/** Rechecks the exact AddWall host consequence before one normal mutation. */
export function addGeneralWallToProjectWithHostResolution(
	source: Project,
	input: AddGeneralWallHostResolutionInput,
	ids: IdSource,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const preview = previewWallAddHostConflict(source, input);
	if (
		preview.kind !== "conflict" ||
		!sameItemIds(preview.itemIds, input.itemIds) ||
		!sameOpeningIds(preview.openingIds, input.openingIds)
	) {
		return reject("WALL_ADD_CONFLICT_STALE");
	}
	const removedItemIds = new Set(input.itemIds);
	const removedOpeningIds = new Set(input.openingIds);
	return addGeneralWallToProject(
		{
			...source,
			assetInstances: source.assetInstances.filter(
				(item) => !removedItemIds.has(item.assetInstanceId),
			),
			level: {
				...source.level,
				openings: source.level.openings.filter(
					(opening) => !removedOpeningIds.has(opening.openingId),
				),
			},
		},
		input,
		ids,
		updatedAt,
	);
}

/**
 * Deletes a segment or the displayed confirmed run, including an exterior
 * wall. Rooms are derived from the surviving graph; dependent items
 * make the deletion reject rather than becoming orphaned silently.
 */
export function deleteGeneralWallFromProject(
	source: Project,
	input: DeleteGeneralWallInput,
	updatedAt: string,
	preserveDoorHinges = false,
): GeneralWallProjectMutationResult {
	const preview = previewWallDeletionConflict(source, input);
	if (
		preview.kind === "conflict" &&
		(preview.roomMetadataConflicts?.length ?? 0) > 0
	) {
		return reject("WALL_DELETION_CONFLICT");
	}
	return deleteGeneralWallCandidate(
		source,
		input,
		updatedAt,
		preserveDoorHinges,
	);
}

function deleteGeneralWallCandidate(
	source: Project,
	input: DeleteGeneralWallInput,
	updatedAt: string,
	preserveDoorHinges: boolean,
): GeneralWallProjectMutationResult {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return sourceProject;
	}
	const wallSegmentIds = selectedWallSegmentIds(source, input);
	if (!wallSegmentIds) return reject("WALL_DELETION_CONFLICT_STALE");
	if (hasWallItemHostedBy(source.assetInstances, wallSegmentIds)) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}

	const deleted = deleteWallSegments(graphOf(source), wallSegmentIds);
	if (deleted.kind === "rejected") {
		return deleted;
	}
	const rehostedSource = rehostWallResourcesAfterDeletionNormalization(
		source,
		deleted.graph,
		new Set(wallSegmentIds),
		preserveDoorHinges,
	);
	if (rehostedSource.kind === "rejected") return rehostedSource;
	const targetFaces = facesForGraph(deleted.graph);
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	const planned = planDeletedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return planned;
	}
	if (
		!floorItemsHaveExactlyOneLineageTarget(
			rehostedSource.project.assetInstances,
			sourceProject.faces,
			planned.faces,
		)
	) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const accepted = acceptedProjectByRoomLineage(
		rehostedSource.project,
		deleted.graph,
		sourceProject.faces,
		planned.faces,
		materializeDeletedRooms(planned.faces),
		updatedAt,
	);
	if (accepted.kind !== "accepted") return accepted;
	return !projectOpeningsRemainValid(accepted.project)
		? reject("OPENING_HOST_UNRESOLVABLE")
		: accepted;
}

/**
 * Lists only Openings directly hosted by the selected canonical WallSegment.
 * It is pure: a preview allocates neither identities nor a command/history
 * resource, and confirmation must compare the list again against its fresh
 * base Project.
 */
export function previewOpeningConflictForWallDeletion(
	source: Project,
	input: DeleteGeneralWallInput,
): WallDeletionOpeningConflictPreview {
	const wallSegmentIds = selectedWallSegmentIds(source, input) ?? [];
	const openingIds = source.level.openings
		.filter((opening) => wallSegmentIds.includes(opening.wallSegmentId))
		.map((opening) => opening.openingId)
		.sort();
	return openingIds.length === 0
		? { kind: "none", wallSegmentId: input.wallSegmentId }
		: { kind: "conflict", openingIds, wallSegmentId: input.wallSegmentId };
}

/**
 * Lists every explicit deletion outcome a wall command requires before it can
 * publish. It is intentionally a pure preflight: no IDs, Revision, history
 * resource or autosave candidate is created while the user can still cancel.
 */
export function previewWallDeletionConflict(
	source: Project,
	input: DeleteGeneralWallInput,
): WallDeletionConflictPreview {
	const wallSegmentIds = selectedWallSegmentIds(source, input) ?? [];
	const openingIds = source.level.openings
		.filter((opening) => wallSegmentIds.includes(opening.wallSegmentId))
		.map((opening) => opening.openingId)
		.sort();
	const itemIds = orphanedItemIdsAfterWallDeletion(source, wallSegmentIds);
	const roomIds = affectedRoomIdsAfterWallDeletion(source, wallSegmentIds);
	const roomMetadataConflicts = roomMetadataConflictsAfterWallDeletion(
		source,
		wallSegmentIds,
	);
	return openingIds.length === 0 &&
		itemIds.length === 0 &&
		roomIds.length === 0 &&
		roomMetadataConflicts.length === 0
		? { kind: "none", wallSegmentId: input.wallSegmentId }
		: {
				itemIds,
				kind: "conflict",
				openingIds,
				...(roomMetadataConflicts.length > 0 ? { roomMetadataConflicts } : {}),
				roomIds,
				wallSegmentId: input.wallSegmentId,
			};
}

/**
 * Applies the explicit `delete` outcome of a previously previewed wall
 * conflict as one Project candidate. Any changed host/Opening set makes the
 * choice stale and leaves the source untouched; the normal topology mutation
 * still revalidates Rooms, Items and every remaining Opening before publish.
 */
export function deleteGeneralWallWithOpeningResolution(
	source: Project,
	input: DeleteGeneralWallInput & {
		readonly openingIds: readonly string[];
	},
	updatedAt: string,
	preserveDoorHinges = false,
): GeneralWallProjectMutationResult {
	const preview = previewOpeningConflictForWallDeletion(source, input);
	if (
		preview.kind !== "conflict" ||
		!sameOpeningIds(preview.openingIds, input.openingIds)
	) {
		return reject("OPENING_CONFLICT_STALE");
	}
	const candidate: Project = {
		...source,
		level: {
			...source.level,
			openings: source.level.openings.filter(
				(opening) => !input.openingIds.includes(opening.openingId),
			),
		},
	};
	return deleteGeneralWallCandidate(
		candidate,
		input,
		updatedAt,
		preserveDoorHinges,
	);
}

/**
 * Applies the explicit delete outcome for all current wall consequences as a
 * single Project candidate. A refreshed preview must match both sets exactly;
 * otherwise a changed base cannot lose an Opening or Item by accident.
 */
export function deleteGeneralWallWithConsequenceResolution(
	source: Project,
	input: DeleteGeneralWallInput & {
		readonly itemIds: readonly string[];
		readonly openingIds: readonly string[];
		readonly roomIds: readonly string[];
		readonly roomMetadataResolutions?: readonly DeleteGeneralWallRoomMetadataResolution[];
	},
	updatedAt: string,
	preserveDoorHinges = false,
): GeneralWallProjectMutationResult {
	const preview = previewWallDeletionConflict(source, input);
	if (
		preview.kind !== "conflict" ||
		!sameOpeningIds(preview.openingIds, input.openingIds) ||
		!sameItemIds(preview.itemIds, input.itemIds) ||
		!sameRoomIds(preview.roomIds, input.roomIds)
	) {
		return reject("WALL_DELETION_CONFLICT_STALE");
	}
	const roomMetadataConflicts = preview.roomMetadataConflicts ?? [];
	if (
		!matchesRoomMetadataMergeResolutions(
			roomMetadataConflicts,
			input.roomMetadataResolutions,
		)
	) {
		return reject("ROOM_METADATA_CONFLICT_STALE");
	}
	const candidate: Project = {
		...source,
		assetInstances: source.assetInstances.filter(
			(item) => !input.itemIds.includes(item.assetInstanceId),
		),
		level: {
			...source.level,
			openings: source.level.openings.filter(
				(opening) => !input.openingIds.includes(opening.openingId),
			),
		},
	};
	const deleted = deleteGeneralWallCandidate(
		candidate,
		input,
		updatedAt,
		preserveDoorHinges,
	);
	return deleted.kind === "rejected" || roomMetadataConflicts.length === 0
		? deleted
		: applyDeletedRoomMetadataResolution(
				source,
				deleted.project,
				roomMetadataConflicts,
				input.roomMetadataResolutions ?? [],
			);
}

/**
 * Changes the body width of the selected wall without moving its
 * centerline or turning wall height into an editable wall property. The rooms
 * remain derived faces: their identity, height and centerline fingerprint are
 * retained while their usable insets are recomputed from the edited graph.
 */
export function changeGeneralWallThickness(
	source: Project,
	input: ChangeGeneralWallThicknessInput,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return sourceProject;
	}
	if (!Number.isSafeInteger(input.thicknessMm) || input.thicknessMm <= 0) {
		return reject("INVALID_DIMENSION");
	}
	if (!isEditableWallThickness(input.thicknessMm)) {
		return reject("PROJECT_BOUNDS_EXCEEDED");
	}
	if (
		!source.level.wallSegments.some(
			(wall) => wall.wallSegmentId === input.wallSegmentId,
		)
	) {
		return reject("WALL_NOT_FOUND");
	}
	const segmentIds = selectedWallSegmentIds(source, input);
	if (!segmentIds) return reject("WALL_RUN_SELECTION_STALE");
	const affectedWallIds = new Set(segmentIds);

	const graph: PlanGraph = {
		...graphOf(source),
		wallSegments: source.level.wallSegments.map((wall) =>
			affectedWallIds.has(wall.wallSegmentId)
				? { ...wall, thicknessMm: input.thicknessMm }
				: wall,
		),
	};
	if (!wallSegmentsRemainUsable(graph, graphOf(source))) {
		return reject("TOO_SHORT_WALL");
	}
	const targetFaces = facesForGraph(graph);
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	const planned = planAddedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return planned;
	}
	const rooms = materializeWallThicknessOnlyRooms(planned.faces);
	if (rooms.kind === "rejected") {
		return rooms;
	}
	const accepted = acceptedWallThicknessProject(
		source,
		graph,
		rooms.rooms,
		updatedAt,
	);
	if (accepted.kind !== "accepted") return accepted;
	if (
		accepted.project.level.rooms.length > 0 &&
		resolveOrthogonalPlanFaces(accepted.project).kind === "rejected"
	) {
		return reject("USABLE_POLYGON_COLLAPSED");
	}
	if (!movedProjectItemHostsRemainValid(accepted.project)) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const wallItemCollision = wallItemCollisionRejection(accepted.project);
	if (wallItemCollision) {
		return wallItemCollision;
	}
	const checksStationaryWalls =
		input.wallRunSegmentIds !== undefined &&
		accepted.project.level.openings.some((opening) =>
			affectedWallIds.has(opening.wallSegmentId),
		);
	for (const wall of graph.wallSegments) {
		const affected = affectedWallIds.has(wall.wallSegmentId);
		// A wider run can collide with another wall's Opening. An Opening in
		// the run also grows thicker, so it may collide with a stationary wall.
		if (!affected && !checksStationaryWalls) continue;
		const intersectedOpening = openingIntersectedByWallHostedByAnotherWall(
			accepted.project,
			wall.wallSegmentId,
			affected ? undefined : affectedWallIds,
		);
		if (intersectedOpening) {
			return reject("WALL_DOOR_OPENING_COLLISION", {
				kind: "opening",
				openingId: intersectedOpening.openingId,
			});
		}
	}
	return !projectOpeningsRemainValid(accepted.project)
		? reject("OPENING_HOST_UNRESOLVABLE")
		: accepted;
}

/**
 * Reverses a selected WallSegment without changing its centreline, durable
 * identity or derived Room faces. Opening and wall-item addresses are local
 * to the canonical start→end direction, so they are reflected along the
 * segment; left/right properties are flipped to retain their world position.
 */
export function reverseGeneralWall(
	source: Project,
	input: ReverseGeneralWallInput,
	updatedAt: string,
	preserveDoorHinges = false,
): GeneralWallProjectMutationResult {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return sourceProject;
	}
	const wall = source.level.wallSegments.find(
		(candidate) => candidate.wallSegmentId === input.wallSegmentId,
	);
	if (!wall) {
		return reject("WALL_NOT_FOUND");
	}
	const verticesById = new Map(
		source.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const start = verticesById.get(wall.startVertexId);
	const end = verticesById.get(wall.endVertexId);
	const lengthMm = start && end ? flooredWallLengthMm(start, end) : undefined;
	if (lengthMm === undefined) {
		return reject("INVALID_SOURCE_PROJECT");
	}
	const graph: PlanGraph = {
		vertices: source.level.vertices,
		wallSegments: source.level.wallSegments.map((candidate) =>
			candidate.wallSegmentId === wall.wallSegmentId
				? {
						...candidate,
						endVertexId: candidate.startVertexId,
						startVertexId: candidate.endVertexId,
					}
				: candidate,
		),
	};
	const targetFaces = facesForGraph(graph);
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	if (!targetFaces.faces.every(hasUsableFloorArea)) {
		return reject("ROOM_USABLE_AREA_COLLAPSE");
	}
	const planned = planMovedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return planned;
	}
	if (!itemsFitExactlyOneTarget(source.assetInstances, planned.faces)) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const rooms = materializeThicknessChangedRooms(planned.faces);
	if (rooms.kind === "rejected") {
		return rooms;
	}
	const reoriented: Project = {
		...source,
		assetInstances: source.assetInstances.map((item) =>
			isWallSchematicAssetInstance(item) &&
			item.wallSegmentId === wall.wallSegmentId
				? {
						...item,
						offsetMm: lengthMm - item.offsetMm,
						side: item.side === "left" ? ("right" as const) : ("left" as const),
					}
				: item,
		),
		level: {
			...source.level,
			openings: source.level.openings.map((opening) =>
				reverseWallOpening(
					opening,
					wall.wallSegmentId,
					lengthMm,
					preserveDoorHinges,
				),
			),
		},
	};
	const accepted = acceptedProject(reoriented, graph, rooms.rooms, updatedAt);
	return accepted.kind === "accepted" &&
		!projectOpeningsRemainValid(accepted.project)
		? reject("OPENING_HOST_UNRESOLVABLE")
		: accepted;
}

/**
 * Creates a stable shared Vertex inside one selected alpha wall. The first
 * piece retains the selected segment ID; the second receives one new ID. An
 * Opening host cannot be reinterpreted by this topology-only operation, so it
 * must use the later Opening-aware relocation flow instead.
 */
export function splitGeneralWall(
	source: Project,
	input: SplitGeneralWallInput,
	ids: IdSource,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return sourceProject;
	}
	const wall = source.level.wallSegments.find(
		(candidate) => candidate.wallSegmentId === input.wallSegmentId,
	);
	if (!wall) {
		return reject("WALL_NOT_FOUND");
	}
	if (!projectOpeningsRemainValid(source)) {
		return reject("OPENING_HOST_UNRESOLVABLE");
	}
	const verticesById = new Map(
		source.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const start = verticesById.get(wall.startVertexId);
	const end = verticesById.get(wall.endVertexId);
	if (!start || !end) {
		return reject("INVALID_SOURCE_PROJECT");
	}
	const point = splitPointForInput(start, end, input);
	if (!point) return reject("WALL_SPLIT_POINT_INVALID");
	const openingRehost = rehostOpeningsForSplit(
		source.level.openings,
		wall,
		start,
		end,
		point,
	);
	if (!openingRehost) {
		return reject("OPENING_HOST_UNRESOLVABLE");
	}
	const wallItemRehost = rehostWallItemsForSplit(
		source.assetInstances,
		wall,
		start,
		end,
		point,
	);
	if (!wallItemRehost) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const previewGraph = splitWallGraph(
		source,
		wall,
		point,
		"__split_vertex__",
		"__split_tail__",
	);
	if (!wallSegmentsRemainUsable(previewGraph, graphOf(source))) {
		return reject("TOO_SHORT_WALL");
	}
	const targetFaces = facesForGraph(previewGraph);
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	const planned = planAddedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return planned;
	}
	if (
		!itemsFitExactlyOneTarget(
			source.assetInstances.filter(isFloorSchematicAssetInstance),
			planned.faces,
		)
	) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const splitVertexId = ids.next();
	const tailWallSegmentId = ids.next();
	const splitGraph = splitWallGraph(
		source,
		wall,
		point,
		splitVertexId,
		tailWallSegmentId,
	);
	const materializedFaces = facesForGraph(splitGraph);
	if (materializedFaces.kind === "rejected") {
		return materializedFaces;
	}
	const materializedPlan = planAddedFaces(
		sourceProject.faces,
		materializedFaces.faces,
	);
	if (materializedPlan.kind === "rejected") {
		return materializedPlan;
	}
	const rooms = materializeThicknessChangedRooms(materializedPlan.faces);
	if (rooms.kind === "rejected") {
		return rooms;
	}
	const accepted = acceptedProject(
		{
			...source,
			assetInstances: source.assetInstances.map((asset) => {
				if (isFloorSchematicAssetInstance(asset)) return asset;
				const rehost = wallItemRehost.find(
					(candidate) =>
						candidate.item.assetInstanceId === asset.assetInstanceId,
				);
				if (!rehost) return asset;
				return rehost.target === "tail"
					? { ...rehost.item, wallSegmentId: tailWallSegmentId }
					: rehost.item;
			}),
			level: {
				...source.level,
				openings: openingRehost.map(({ opening, target }) =>
					target === "tail"
						? { ...opening, wallSegmentId: tailWallSegmentId }
						: opening,
				),
			},
		},
		splitGraph,
		rooms.rooms,
		updatedAt,
	);
	return accepted.kind === "accepted" &&
		!projectOpeningsRemainValid(accepted.project)
		? reject("OPENING_HOST_UNRESOLVABLE")
		: accepted;
}

/**
 * Shows only the Opening IDs whose interval is crossed by the proposed split.
 * An Opening entirely on one successor is intentionally absent: its host is
 * preserved by `splitGeneralWall` without any destructive decision.
 */
export function previewOpeningConflictForWallSplit(
	source: Project,
	input: SplitGeneralWallInput,
): WallSplitOpeningConflictPreview {
	const wall = source.level.wallSegments.find(
		(candidate) => candidate.wallSegmentId === input.wallSegmentId,
	);
	const verticesById = new Map(
		source.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const start = wall ? verticesById.get(wall.startVertexId) : undefined;
	const end = wall ? verticesById.get(wall.endVertexId) : undefined;
	const point =
		start && end ? splitPointForInput(start, end, input) : undefined;
	if (!wall || !start || !end || !point) {
		return { kind: "none", wallSegmentId: input.wallSegmentId };
	}
	const lengths = splitHostLengths(start, end, point);
	const openingIds = source.level.openings
		.filter((opening) => {
			if (opening.wallSegmentId !== wall.wallSegmentId) return false;
			const interval = wallOpeningIntervalMm(opening);
			return (
				interval.endMm > lengths.headLengthMm &&
				interval.startMm < lengths.tailStartMm
			);
		})
		.map((opening) => opening.openingId)
		.sort();
	return openingIds.length === 0
		? { kind: "none", wallSegmentId: wall.wallSegmentId }
		: { kind: "conflict", openingIds, wallSegmentId: wall.wallSegmentId };
}

/**
 * Lists every hosted resource whose interval crosses the proposed split. This
 * is a pure preview: cancel cannot allocate IDs or create a Project candidate.
 */
export function previewWallSplitHostConflict(
	source: Project,
	input: SplitGeneralWallInput,
): WallSplitHostConflictPreview {
	const wall = source.level.wallSegments.find(
		(candidate) => candidate.wallSegmentId === input.wallSegmentId,
	);
	const verticesById = new Map(
		source.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const start = wall ? verticesById.get(wall.startVertexId) : undefined;
	const end = wall ? verticesById.get(wall.endVertexId) : undefined;
	if (!wall || !start || !end) {
		return { kind: "none", wallSegmentId: input.wallSegmentId };
	}
	const point = splitPointForInput(start, end, input);
	if (!point) {
		return { kind: "none", wallSegmentId: input.wallSegmentId };
	}
	const lengths = splitHostLengths(start, end, point);
	const openingPreview = previewOpeningConflictForWallSplit(source, input);
	const headLength2 = lengths.headLengthMm * 2;
	const tailStart2 = lengths.tailStartMm * 2;
	const itemIds = source.assetInstances
		.filter(
			(item): item is WallSchematicAssetInstance =>
				isWallSchematicAssetInstance(item) &&
				item.wallSegmentId === wall.wallSegmentId &&
				item.offsetMm * 2 + item.widthMm > headLength2 &&
				item.offsetMm * 2 - item.widthMm < tailStart2,
		)
		.map((item) => item.assetInstanceId)
		.sort();
	const openingIds =
		openingPreview.kind === "conflict" ? openingPreview.openingIds : [];
	return itemIds.length === 0 && openingIds.length === 0
		? { kind: "none", wallSegmentId: input.wallSegmentId }
		: {
				itemIds,
				kind: "conflict",
				openingIds,
				wallSegmentId: input.wallSegmentId,
			};
}

/**
 * Rechecks and applies one complete destructive host outcome immediately
 * before the normal split validator and ID allocation path.
 */
export function splitGeneralWallWithHostResolution(
	source: Project,
	input: SplitGeneralWallHostResolutionInput,
	ids: IdSource,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const preview = previewWallSplitHostConflict(source, input);
	if (
		preview.kind !== "conflict" ||
		!sameOpeningIds(preview.openingIds, input.openingIds) ||
		!sameItemIds(preview.itemIds, input.itemIds)
	) {
		return reject("WALL_SPLIT_CONFLICT_STALE");
	}
	const removedItemIds = new Set(input.itemIds);
	const removedOpeningIds = new Set(input.openingIds);
	return splitGeneralWall(
		{
			...source,
			assetInstances: source.assetInstances.filter(
				(item) => !removedItemIds.has(item.assetInstanceId),
			),
			level: {
				...source.level,
				openings: source.level.openings.filter(
					(opening) => !removedOpeningIds.has(opening.openingId),
				),
			},
		},
		input,
		ids,
		updatedAt,
	);
}

/**
 * Rechecks the exact split conflict immediately before one atomic publication.
 * The caller must nominate every and only the intersected Opening, so a stale
 * preview cannot delete an Opening that was moved in a newer Revision.
 */
export function splitGeneralWallWithOpeningResolution(
	source: Project,
	input: SplitGeneralWallOpeningResolutionInput,
	ids: IdSource,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const preview = previewOpeningConflictForWallSplit(source, input);
	if (
		preview.kind !== "conflict" ||
		preview.wallSegmentId !== input.wallSegmentId ||
		!sameOpeningIds(preview.openingIds, input.openingIds)
	) {
		return reject("OPENING_CONFLICT_STALE");
	}
	const removedOpeningIds = new Set(input.openingIds);
	return splitGeneralWall(
		{
			...source,
			level: {
				...source.level,
				openings: source.level.openings.filter(
					(opening) => !removedOpeningIds.has(opening.openingId),
				),
			},
		},
		input,
		ids,
		updatedAt,
	);
}

/**
 * Repositions the selected straight Wall in exact millimetres. All vertices
 * along the confirmed run move along its normal. Only walls outside the run
 * count as neighbours of its endpoints.
 */
export function moveGeneralWall(
	source: Project,
	input: MoveGeneralWallInput,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return sourceProject;
	}
	const wall = source.level.wallSegments.find(
		(candidate) => candidate.wallSegmentId === input.wallSegmentId,
	);
	if (!wall) {
		return reject("WALL_NOT_FOUND");
	}
	const run = confirmedWallRun(source, input);
	if (!run && input.wallRunSegmentIds !== undefined) {
		return reject("WALL_RUN_SELECTION_STALE");
	}
	const movedWallIds = new Set(run?.wallSegmentIds ?? [wall.wallSegmentId]);
	const movedVertexIds = new Set<string>();
	const neighbouringWalls: WallSegment[] = [];
	for (const segment of source.level.wallSegments) {
		if (movedWallIds.has(segment.wallSegmentId)) {
			movedVertexIds.add(segment.startVertexId);
			movedVertexIds.add(segment.endVertexId);
		} else {
			neighbouringWalls.push(segment);
		}
	}
	const boundary = {
		...wall,
		startVertexId: run?.startVertexId ?? wall.startVertexId,
		endVertexId: run?.endVertexId ?? wall.endVertexId,
	};
	const verticesById = new Map(
		source.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const start = verticesById.get(boundary.startVertexId);
	const end = verticesById.get(boundary.endVertexId);
	if (!start || !end) {
		return reject("INVALID_SOURCE_PROJECT");
	}
	if (input.translationMm !== undefined) {
		const translation = input.translationMm;
		const deltaX = end.xMm - start.xMm;
		const deltaZ = end.zMm - start.zMm;
		const isDiagonal =
			deltaX !== 0 && deltaZ !== 0 && Math.abs(deltaX) === Math.abs(deltaZ);
		if (
			!isDiagonal ||
			!Number.isSafeInteger(translation.xMm) ||
			!Number.isSafeInteger(translation.zMm) ||
			Math.abs(translation.xMm) > 100_000 ||
			Math.abs(translation.zMm) > 100_000 ||
			(translation.xMm === 0 && translation.zMm === 0)
		) {
			return reject("WALL_NOT_MOVABLE");
		}
		const hasRisingDirection = Math.sign(deltaX) === Math.sign(deltaZ);
		if (
			translation.xMm === 0 ||
			translation.zMm === 0 ||
			(hasRisingDirection
				? translation.xMm !== -translation.zMm
				: translation.xMm !== translation.zMm) ||
			!bothTranslatedEndpointsStayInBounds(start, end, translation) ||
			hasCollinearDiagonalNeighborAtEitherEndpoint(
				neighbouringWalls,
				verticesById,
				boundary,
			)
		) {
			return reject("WALL_NOT_MOVABLE");
		}
		const graph: PlanGraph = {
			vertices: source.level.vertices.map((vertex) =>
				movedVertexIds.has(vertex.vertexId)
					? {
							...vertex,
							xMm: vertex.xMm + translation.xMm,
							zMm: vertex.zMm + translation.zMm,
						}
					: vertex,
			),
			wallSegments: source.level.wallSegments,
		};
		return materializeMovedWallProject(
			source,
			sourceProject.faces,
			graph,
			updatedAt,
		);
	}
	if (!Number.isSafeInteger(input.positionMm)) {
		return reject("INVALID_DIMENSION");
	}
	if (Math.abs(input.positionMm) > 100_000) {
		return reject("PROJECT_BOUNDS_EXCEEDED");
	}
	const vertical = start.xMm === end.xMm;
	const horizontal = start.zMm === end.zMm;
	if (vertical === horizontal) {
		return reject("WALL_NOT_MOVABLE");
	}
	const existingPosition = vertical ? start.xMm : start.zMm;
	if (input.positionMm === existingPosition) {
		return reject("WALL_POSITION_UNCHANGED");
	}
	if (
		hasCollinearNeighborAtEitherEndpoint(
			neighbouringWalls,
			verticesById,
			boundary,
			vertical,
		)
	) {
		return reject("WALL_NOT_MOVABLE");
	}
	const graph: PlanGraph = {
		vertices: source.level.vertices.map((vertex) =>
			movedVertexIds.has(vertex.vertexId)
				? vertical
					? { ...vertex, xMm: input.positionMm }
					: { ...vertex, zMm: input.positionMm }
				: vertex,
		),
		wallSegments: source.level.wallSegments,
	};
	return materializeMovedWallProject(
		source,
		sourceProject.faces,
		graph,
		updatedAt,
	);
}

function materializeMovedWallProject(
	source: Project,
	sourceFaces: readonly SourceRoom[],
	graph: PlanGraph,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const targetFaces = facesForGraph(graph);
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	if (hasReversedWallDirection(graphOf(source), graph)) {
		return reject("INVALID_RESULTING_PROJECT");
	}
	const planned = reconcileParallelWallMoveFaces(
		sourceFaces,
		targetFaces.faces,
	);
	if (!planned) return reject("INVALID_RESULTING_PROJECT");
	const rooms = materializeThicknessChangedRooms(planned);
	if (rooms.kind === "rejected") {
		return rooms;
	}
	const accepted = acceptedProjectByRoomLineage(
		source,
		graph,
		sourceFaces,
		planned,
		rooms.rooms,
		updatedAt,
	);
	if (accepted.kind !== "accepted") return accepted;
	if (
		rooms.rooms.length > 0 &&
		resolveOrthogonalPlanFaces(accepted.project).kind === "rejected"
	) {
		return reject("ROOM_USABLE_AREA_COLLAPSE");
	}
	if (!wallSegmentsRemainUsable(graph, graphOf(source))) {
		return reject("TOO_SHORT_WALL");
	}
	if (!movedProjectItemHostsRemainValid(accepted.project)) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const wallItemCollision = wallItemCollisionRejection(accepted.project);
	if (wallItemCollision) {
		return wallItemCollision;
	}
	// Moving a host also moves its Opening. Check all final wall bodies so a
	// stationary wall cannot silently occupy the moved hole either.
	for (const candidate of accepted.project.level.wallSegments) {
		const intersectedOpening = openingIntersectedByWallHostedByAnotherWall(
			accepted.project,
			candidate.wallSegmentId,
		);
		if (intersectedOpening) {
			return reject("WALL_DOOR_OPENING_COLLISION", {
				kind: "opening",
				openingId: intersectedOpening.openingId,
			});
		}
	}
	return !projectOpeningsRemainValid(accepted.project)
		? reject("OPENING_HOST_UNRESOLVABLE")
		: accepted;
}

/**
 * Repositions one shared canonical Vertex in exact millimetres. This narrow
 * command accepts only moves that leave every attached segment in the alpha
 * 0/45/90-degree set and the whole plan derivable. It therefore supports an
 * inline split Vertex (or an endpoint of a detached straight wall) without
 * silently introducing an arbitrary angle, tearing a junction, or orphaning
 * a hosted resource.
 */
export function moveGeneralVertex(
	source: Project,
	input: MoveGeneralVertexInput,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return sourceProject;
	}
	if (!Number.isSafeInteger(input.xMm) || !Number.isSafeInteger(input.zMm)) {
		return reject("INVALID_DIMENSION");
	}
	if (Math.abs(input.xMm) > 100_000 || Math.abs(input.zMm) > 100_000) {
		return reject("PROJECT_BOUNDS_EXCEEDED");
	}
	const vertex = source.level.vertices.find(
		(candidate) => candidate.vertexId === input.vertexId,
	);
	if (!vertex) {
		return reject("VERTEX_NOT_FOUND");
	}
	if (vertex.xMm === input.xMm && vertex.zMm === input.zMm) {
		return reject("VERTEX_POSITION_UNCHANGED");
	}
	const graph: PlanGraph = {
		vertices: source.level.vertices.map((candidate) =>
			candidate.vertexId === input.vertexId
				? { ...candidate, xMm: input.xMm, zMm: input.zMm }
				: candidate,
		),
		wallSegments: source.level.wallSegments,
	};
	if (!incidentWallSegmentsRemainAlphaConstrained(graph, input.vertexId)) {
		return reject("VERTEX_NOT_MOVABLE");
	}
	if (!wallSegmentsRemainUsable(graph, graphOf(source))) {
		return reject("TOO_SHORT_WALL");
	}
	const targetFaces = facesForGraph(graph);
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	if (
		!targetFaces.faces.every(
			(face) => face.kind === "polygonal" || hasUsableFloorArea(face),
		)
	) {
		return reject("ROOM_USABLE_AREA_COLLAPSE");
	}
	const planned = planMovedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return planned;
	}
	if (!itemsFitExactlyOneTarget(source.assetInstances, planned.faces)) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const rooms = materializeThicknessChangedRooms(planned.faces);
	if (rooms.kind === "rejected") {
		return rooms;
	}
	const accepted = acceptedProject(source, graph, rooms.rooms, updatedAt);
	if (accepted.kind !== "accepted") return accepted;
	if (resolveOrthogonalPlanFaces(accepted.project).kind === "rejected") {
		return reject("ROOM_USABLE_AREA_COLLAPSE");
	}
	if (!movedProjectItemHostsRemainValid(accepted.project)) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const wallItemCollision = wallItemCollisionRejection(accepted.project);
	if (wallItemCollision) {
		return wallItemCollision;
	}
	return !projectOpeningsRemainValid(accepted.project)
		? reject("OPENING_HOST_UNRESOLVABLE")
		: accepted;
}

/**
 * Removes a split-only inline Vertex without changing a room boundary. This is
 * intentionally narrower than general topology deletion: corners, junctions,
 * unequal wall bodies and Opening hosts all reject before any Project state is
 * materialized. The first segment keeps its durable ID, matching the inverse
 * of `splitGeneralWall`.
 */
export function deleteGeneralVertex(
	source: Project,
	input: DeleteGeneralVertexInput,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return sourceProject;
	}
	const vertex = source.level.vertices.find(
		(candidate) => candidate.vertexId === input.vertexId,
	);
	if (!vertex) {
		return reject("VERTEX_NOT_FOUND");
	}
	if (!isGeneralVertexDeletionEligible(source, input.vertexId)) {
		return reject("VERTEX_NOT_DELETABLE");
	}
	const incident = source.level.wallSegments.filter(
		(wall) =>
			wall.startVertexId === input.vertexId ||
			wall.endVertexId === input.vertexId,
	);
	const first = incident[0];
	const second = incident[1];
	if (!first || !second) {
		return reject("VERTEX_NOT_DELETABLE");
	}
	const verticesById = new Map(
		source.level.vertices.map((candidate) => [candidate.vertexId, candidate]),
	);
	const firstOtherId = otherEndpoint(first, input.vertexId);
	const secondOtherId = otherEndpoint(second, input.vertexId);
	const firstOther = firstOtherId ? verticesById.get(firstOtherId) : undefined;
	const secondOther = secondOtherId
		? verticesById.get(secondOtherId)
		: undefined;
	if (!firstOther || !secondOther) {
		return reject("VERTEX_NOT_DELETABLE");
	}
	const mergedFirst =
		first.startVertexId === input.vertexId
			? { ...first, startVertexId: secondOther.vertexId }
			: { ...first, endVertexId: secondOther.vertexId };
	const graph: PlanGraph = {
		vertices: source.level.vertices.filter(
			(candidate) => candidate.vertexId !== input.vertexId,
		),
		wallSegments: source.level.wallSegments.flatMap((wall) =>
			wall.wallSegmentId === second.wallSegmentId
				? []
				: wall.wallSegmentId === first.wallSegmentId
					? [mergedFirst]
					: [wall],
		),
	};
	const targetFaces = facesForGraph(graph);
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	const planned = planMovedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return planned;
	}
	const rehostedItems = rehostWallItemsForMergedVertex(
		source.assetInstances,
		first,
		second,
		mergedFirst,
		verticesById,
	);
	if (!rehostedItems) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const rehostedProject: Project = {
		...source,
		assetInstances: rehostedItems,
		level: {
			...source.level,
			vertices: graph.vertices,
			wallSegments: graph.wallSegments,
		},
	};
	if (
		!rehostedItems.every(
			(item) =>
				isFloorSchematicAssetInstance(item) ||
				isWallSchematicAssetPlacementValid(rehostedProject, item),
		)
	) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	const rooms = materializeThicknessChangedRooms(planned.faces);
	if (rooms.kind === "rejected") {
		return rooms;
	}
	const accepted = acceptedProjectByRoomLineage(
		rehostedProject,
		graph,
		sourceProject.faces,
		planned.faces,
		rooms.rooms,
		updatedAt,
	);
	if (accepted.kind !== "accepted") return accepted;
	if (resolveOrthogonalPlanFaces(accepted.project).kind === "rejected") {
		return reject("ROOM_USABLE_AREA_COLLAPSE");
	}
	if (!movedProjectItemHostsRemainValid(accepted.project)) {
		return reject("ITEM_HOST_UNRESOLVABLE");
	}
	return !projectOpeningsRemainValid(accepted.project)
		? reject("OPENING_HOST_UNRESOLVABLE")
		: accepted;
}

function graphOf(project: Project): PlanGraph {
	return {
		vertices: project.level.vertices,
		wallSegments: project.level.wallSegments,
	};
}

/**
 * A Door's missing legacy swingSide projects as right. Reversal writes the
 * opposite explicit value so the physical opening direction is retained even
 * after a later serializer no longer needs that backwards-compatible default.
 */
function reverseWallOpening(
	opening: WallOpening,
	wallSegmentId: string,
	lengthMm: number,
	preserveDoorHinges: boolean,
): WallOpening {
	if (opening.wallSegmentId !== wallSegmentId) {
		return opening;
	}
	if (opening.kind === "Window") {
		return { ...opening, offsetMm: lengthMm - opening.offsetMm };
	}
	return {
		...reverseDoorOpeningOrientation(opening, preserveDoorHinges),
		offsetMm: lengthMm - opening.offsetMm,
	};
}

/**
 * An inline merge keeps the first segment's identity. Wall-local items on its
 * removed neighbour move to that survivor by their physical position along
 * the combined centreline; a reversed local direction also reverses side.
 */
function rehostWallItemsForMergedVertex(
	items: readonly SchematicAssetInstance[],
	first: WallSegment,
	second: WallSegment,
	mergedFirst: WallSegment,
	verticesById: ReadonlyMap<string, Vertex>,
): readonly SchematicAssetInstance[] | undefined {
	const rehosted: SchematicAssetInstance[] = [];
	for (const item of items) {
		if (!isWallSchematicAssetInstance(item)) {
			rehosted.push(item);
			continue;
		}
		const sourceWall =
			item.wallSegmentId === first.wallSegmentId
				? first
				: item.wallSegmentId === second.wallSegmentId
					? second
					: undefined;
		if (!sourceWall) {
			rehosted.push(item);
			continue;
		}
		const next = rehostWallItemBetweenHosts(
			item,
			sourceWall,
			mergedFirst,
			verticesById,
		);
		if (!next) return undefined;
		rehosted.push(next);
	}
	return rehosted;
}

function rehostWallItemBetweenHosts(
	item: WallSchematicAssetInstance,
	sourceWall: WallSegment,
	targetWall: WallSegment,
	verticesById: ReadonlyMap<string, Vertex>,
): WallSchematicAssetInstance | undefined {
	const transformed = wallLocalHostTransform(
		sourceWall,
		targetWall,
		item.offsetMm,
		verticesById,
	);
	return transformed
		? {
				...item,
				offsetMm: transformed.offsetMm,
				side: transformed.sameDirection
					? item.side
					: item.side === "left"
						? "right"
						: "left",
				wallSegmentId: targetWall.wallSegmentId,
			}
		: undefined;
}

function rehostOpeningBetweenHosts(
	opening: WallOpening,
	sourceWall: WallSegment,
	targetWall: WallSegment,
	verticesById: ReadonlyMap<string, Vertex>,
	preserveDoorHinges: boolean,
): WallOpening | undefined {
	const transformed = wallLocalHostTransform(
		sourceWall,
		targetWall,
		opening.offsetMm,
		verticesById,
	);
	if (!transformed) return undefined;
	if (opening.kind === "Window" || transformed.sameDirection) {
		return {
			...opening,
			offsetMm: transformed.offsetMm,
			wallSegmentId: targetWall.wallSegmentId,
		};
	}
	return {
		...reverseDoorOpeningOrientation(opening, preserveDoorHinges),
		offsetMm: transformed.offsetMm,
		wallSegmentId: targetWall.wallSegmentId,
	};
}

function wallLocalHostTransform(
	sourceWall: WallSegment,
	targetWall: WallSegment,
	offsetMm: number,
	verticesById: ReadonlyMap<string, Vertex>,
): { readonly offsetMm: number; readonly sameDirection: boolean } | undefined {
	const sourceStart = verticesById.get(sourceWall.startVertexId);
	const sourceEnd = verticesById.get(sourceWall.endVertexId);
	const targetStart = verticesById.get(targetWall.startVertexId);
	const targetEnd = verticesById.get(targetWall.endVertexId);
	if (!sourceStart || !sourceEnd || !targetStart || !targetEnd)
		return undefined;
	const sourceLengthMm = flooredWallLengthMm(sourceStart, sourceEnd);
	if (sourceLengthMm === undefined) return undefined;
	const sourceDeltaX = BigInt(sourceEnd.xMm - sourceStart.xMm);
	const sourceDeltaZ = BigInt(sourceEnd.zMm - sourceStart.zMm);
	const targetDeltaX = BigInt(targetEnd.xMm - targetStart.xMm);
	const targetDeltaZ = BigInt(targetEnd.zMm - targetStart.zMm);
	const sameDirection =
		sourceDeltaX * targetDeltaX + sourceDeltaZ * targetDeltaZ > 0n;
	const distanceToSourceOriginMm = distanceMmAllowingZero(
		targetStart,
		sameDirection ? sourceStart : sourceEnd,
	);
	return {
		offsetMm:
			distanceToSourceOriginMm +
			(sameDirection ? offsetMm : sourceLengthMm - offsetMm),
		sameDirection,
	};
}

function rehostWallResourcesAfterDeletionNormalization(
	source: Project,
	targetGraph: PlanGraph,
	removedWallSegmentIds: ReadonlySet<string>,
	preserveDoorHinges: boolean,
): GeneralWallProjectMutationResult {
	const verticesById = new Map(
		source.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const replacementBySourceWallId = new Map<string, WallSegment>();
	for (const sourceWall of source.level.wallSegments) {
		if (removedWallSegmentIds.has(sourceWall.wallSegmentId)) continue;
		const sourceStart = verticesById.get(sourceWall.startVertexId);
		const sourceEnd = verticesById.get(sourceWall.endVertexId);
		if (!sourceStart || !sourceEnd) {
			return reject("INVALID_SOURCE_PROJECT");
		}
		const replacements = targetGraph.wallSegments.filter((targetWall) => {
			if (targetWall.thicknessMm !== sourceWall.thicknessMm) return false;
			const targetStart = verticesById.get(targetWall.startVertexId);
			const targetEnd = verticesById.get(targetWall.endVertexId);
			return Boolean(
				targetStart &&
					targetEnd &&
					pointLiesOnClosedSegment(sourceStart, targetStart, targetEnd) &&
					pointLiesOnClosedSegment(sourceEnd, targetStart, targetEnd),
			);
		});
		if (replacements.length !== 1 || !replacements[0]) {
			return reject("INVALID_RESULTING_PROJECT");
		}
		replacementBySourceWallId.set(sourceWall.wallSegmentId, replacements[0]);
	}

	const assetInstances: SchematicAssetInstance[] = [];
	for (const item of source.assetInstances) {
		if (!isWallSchematicAssetInstance(item)) {
			assetInstances.push(item);
			continue;
		}
		const sourceWall = source.level.wallSegments.find(
			(wall) => wall.wallSegmentId === item.wallSegmentId,
		);
		const targetWall = sourceWall
			? replacementBySourceWallId.get(sourceWall.wallSegmentId)
			: undefined;
		const rehosted =
			sourceWall && targetWall
				? rehostWallItemBetweenHosts(item, sourceWall, targetWall, verticesById)
				: undefined;
		if (!rehosted) return reject("ITEM_HOST_UNRESOLVABLE");
		assetInstances.push(rehosted);
	}

	const openings: WallOpening[] = [];
	for (const opening of source.level.openings) {
		const sourceWall = source.level.wallSegments.find(
			(wall) => wall.wallSegmentId === opening.wallSegmentId,
		);
		const targetWall = sourceWall
			? replacementBySourceWallId.get(sourceWall.wallSegmentId)
			: undefined;
		const rehosted =
			sourceWall && targetWall
				? rehostOpeningBetweenHosts(
						opening,
						sourceWall,
						targetWall,
						verticesById,
						preserveDoorHinges,
					)
				: undefined;
		if (!rehosted) return reject("OPENING_HOST_UNRESOLVABLE");
		openings.push(rehosted);
	}
	return {
		kind: "accepted",
		project: {
			...source,
			assetInstances,
			level: { ...source.level, openings },
		},
	};
}

function splitWallGraph(
	source: Project,
	wall: WallSegment,
	point: { readonly xMm: number; readonly zMm: number },
	vertexId: string,
	tailWallSegmentId: string,
): PlanGraph {
	return {
		vertices: [
			...source.level.vertices,
			{ vertexId, xMm: point.xMm, zMm: point.zMm },
		],
		wallSegments: source.level.wallSegments.flatMap((candidate) =>
			candidate.wallSegmentId !== wall.wallSegmentId
				? [candidate]
				: [
						{
							...candidate,
							endVertexId: vertexId,
						},
						{
							...candidate,
							startVertexId: vertexId,
							wallSegmentId: tailWallSegmentId,
						},
					],
		),
	};
}

function splitPointForInput(
	start: Vertex,
	end: Vertex,
	input: SplitGeneralWallInput,
): { readonly xMm: number; readonly zMm: number } | undefined {
	const vertical = start.xMm === end.xMm;
	const horizontal = start.zMm === end.zMm;
	if (input.pointMm === undefined) {
		if (
			vertical === horizontal ||
			!Number.isSafeInteger(input.positionMm) ||
			input.positionMm <=
				(vertical
					? Math.min(start.zMm, end.zMm)
					: Math.min(start.xMm, end.xMm)) ||
			input.positionMm >=
				(vertical ? Math.max(start.zMm, end.zMm) : Math.max(start.xMm, end.xMm))
		) {
			return undefined;
		}
		return vertical
			? { xMm: start.xMm, zMm: input.positionMm }
			: { xMm: input.positionMm, zMm: start.zMm };
	}
	const point = input.pointMm;
	if (vertical) {
		return Number.isSafeInteger(point.xMm) &&
			Number.isSafeInteger(point.zMm) &&
			point.xMm === start.xMm &&
			point.zMm > Math.min(start.zMm, end.zMm) &&
			point.zMm < Math.max(start.zMm, end.zMm)
			? point
			: undefined;
	}
	if (horizontal) {
		return Number.isSafeInteger(point.xMm) &&
			Number.isSafeInteger(point.zMm) &&
			point.zMm === start.zMm &&
			point.xMm > Math.min(start.xMm, end.xMm) &&
			point.xMm < Math.max(start.xMm, end.xMm)
			? point
			: undefined;
	}
	const deltaX = end.xMm - start.xMm;
	const deltaZ = end.zMm - start.zMm;
	const pointDeltaX = point.xMm - start.xMm;
	const pointDeltaZ = point.zMm - start.zMm;
	const isStrictlyWithin =
		Math.abs(pointDeltaX) < Math.abs(deltaX) &&
		Math.abs(pointDeltaZ) < Math.abs(deltaZ);
	return Number.isSafeInteger(point.xMm) &&
		Number.isSafeInteger(point.zMm) &&
		Math.abs(point.xMm) <= 100_000 &&
		Math.abs(point.zMm) <= 100_000 &&
		Math.abs(deltaX) === Math.abs(deltaZ) &&
		pointDeltaX !== 0 &&
		pointDeltaZ !== 0 &&
		isStrictlyWithin &&
		pointDeltaX * deltaZ === pointDeltaZ * deltaX
		? point
		: undefined;
}

/**
 * Rebinds every wall-local item after AddWallSegment normalizes one or more
 * exact T/X contacts. The source interval must fit one and only one canonical
 * successor; a cut interval fails before persistent IDs are allocated.
 */
function rehostWallItemsAfterAddedGraph(
	source: Project,
	targetGraph: PlanGraph,
):
	| {
			readonly assetInstances: readonly SchematicAssetInstance[];
			readonly kind: "accepted";
	  }
	| { readonly assetInstanceId: string; readonly kind: "rejected" } {
	const rehosted: SchematicAssetInstance[] = [];
	for (const item of source.assetInstances) {
		if (!isWallSchematicAssetInstance(item)) {
			rehosted.push(item);
			continue;
		}
		const successors = wallHostSuccessorsAfterAdd(
			source,
			targetGraph,
			item.wallSegmentId,
		);
		const successor = successorForHostedInterval(
			successors,
			item.offsetMm,
			item.widthMm,
		);
		if (!successor) {
			return { assetInstanceId: item.assetInstanceId, kind: "rejected" };
		}
		rehosted.push({
			...item,
			offsetMm: item.offsetMm - successor.startDistanceMm,
			wallSegmentId: successor.wall.wallSegmentId,
		});
	}
	return { assetInstances: rehosted, kind: "accepted" };
}

/** Openings use the same exact successor rule and preserve physical swing. */
function rehostOpeningsAfterAddedGraph(
	source: Project,
	targetGraph: PlanGraph,
):
	| { readonly kind: "accepted"; readonly openings: readonly WallOpening[] }
	| { readonly kind: "rejected"; readonly opening: WallOpening } {
	const rehosted: WallOpening[] = [];
	for (const opening of source.level.openings) {
		const successors = wallHostSuccessorsAfterAdd(
			source,
			targetGraph,
			opening.wallSegmentId,
		);
		const successor = successorForHostedInterval(
			successors,
			opening.offsetMm,
			opening.widthMm,
		);
		if (!successor) return { kind: "rejected", opening };
		rehosted.push({
			...opening,
			offsetMm: opening.offsetMm - successor.startDistanceMm,
			wallSegmentId: successor.wall.wallSegmentId,
		});
	}
	return { kind: "accepted", openings: rehosted };
}

function successorForHostedInterval(
	successors: readonly AddedWallHostSuccessor[],
	offsetMm: number,
	widthMm: number,
): AddedWallHostSuccessor | undefined {
	const intervalStart2 = offsetMm * 2 - widthMm;
	const intervalEnd2 = offsetMm * 2 + widthMm;
	return successors.find(
		(successor) =>
			successor.startDistanceMm * 2 <= intervalStart2 &&
			successor.endDistanceMm * 2 >= intervalEnd2,
	);
}

function wallHostSuccessorsAfterAdd(
	source: Project,
	targetGraph: PlanGraph,
	wallSegmentId: string,
): readonly AddedWallHostSuccessor[] {
	const sourceWall = source.level.wallSegments.find(
		(wall) => wall.wallSegmentId === wallSegmentId,
	);
	const sourceVertices = new Map(
		source.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const targetVertices = new Map(
		targetGraph.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const sourceStart = sourceWall
		? sourceVertices.get(sourceWall.startVertexId)
		: undefined;
	const sourceEnd = sourceWall
		? sourceVertices.get(sourceWall.endVertexId)
		: undefined;
	if (!sourceWall || !sourceStart || !sourceEnd) {
		return [];
	}

	return targetGraph.wallSegments.flatMap((wall) => {
		const start = targetVertices.get(wall.startVertexId);
		const end = targetVertices.get(wall.endVertexId);
		if (
			wall.thicknessMm !== sourceWall.thicknessMm ||
			!start ||
			!end ||
			!pointLiesOnClosedSegment(start, sourceStart, sourceEnd) ||
			!pointLiesOnClosedSegment(end, sourceStart, sourceEnd)
		) {
			return [];
		}
		const startFromSourceMm = distanceMmAllowingZero(sourceStart, start);
		const endFromSourceMm = distanceMmAllowingZero(sourceStart, end);
		return [
			{
				endDistanceMm: Math.max(startFromSourceMm, endFromSourceMm),
				startDistanceMm: Math.min(startFromSourceMm, endFromSourceMm),
				wall,
			},
		];
	});
}

function pointLiesOnClosedSegment(
	point: Pick<Vertex, "xMm" | "zMm">,
	start: Pick<Vertex, "xMm" | "zMm">,
	end: Pick<Vertex, "xMm" | "zMm">,
): boolean {
	const deltaX = BigInt(end.xMm - start.xMm);
	const deltaZ = BigInt(end.zMm - start.zMm);
	const pointX = BigInt(point.xMm - start.xMm);
	const pointZ = BigInt(point.zMm - start.zMm);
	const dot = pointX * deltaX + pointZ * deltaZ;
	return (
		pointX * deltaZ === pointZ * deltaX &&
		dot >= 0n &&
		dot <= deltaX * deltaX + deltaZ * deltaZ
	);
}

function distanceMmAllowingZero(
	first: Pick<Vertex, "xMm" | "zMm">,
	second: Pick<Vertex, "xMm" | "zMm">,
): number {
	return Math.floor(Math.hypot(second.xMm - first.xMm, second.zMm - first.zMm));
}

/**
 * A split preserves an Opening only when its complete interval has exactly one
 * successor. The head keeps the selected Wall ID; the tail receives the
 * allocated successor ID after the allocation-free preview succeeds. An
 * Opening cut by the proposed point has no safe lineage, so the caller must
 * surface its explicit conflict instead of silently shrinking or deleting it.
 */
function rehostOpeningsForSplit(
	openings: readonly WallOpening[],
	wall: WallSegment,
	start: Vertex,
	end: Vertex,
	point: { readonly xMm: number; readonly zMm: number },
): readonly SplitOpeningRehost[] | undefined {
	const lengths = splitHostLengths(start, end, point);

	const rehosted: SplitOpeningRehost[] = [];
	for (const opening of openings) {
		if (opening.wallSegmentId !== wall.wallSegmentId) {
			rehosted.push({ opening, target: "unaffected" });
			continue;
		}
		const interval = wallOpeningIntervalMm(opening);
		if (interval.endMm <= lengths.headLengthMm) {
			rehosted.push({ opening, target: "head" });
			continue;
		}
		if (interval.startMm >= lengths.tailStartMm) {
			rehosted.push({
				opening: {
					...opening,
					offsetMm: opening.offsetMm - lengths.tailStartMm,
				},
				target: "tail",
			});
			continue;
		}
		return undefined;
	}
	return rehosted;
}

/**
 * A wall item follows the same interval rule as an Opening: a wholly head or
 * tail-local address has exactly one successor; a cut through its footprint
 * has none and must not create a partial topology revision.
 */
function rehostWallItemsForSplit(
	items: readonly SchematicAssetInstance[],
	wall: WallSegment,
	start: Vertex,
	end: Vertex,
	point: { readonly xMm: number; readonly zMm: number },
): readonly SplitWallItemRehost[] | undefined {
	const lengths = splitHostLengths(start, end, point);

	const rehosted: SplitWallItemRehost[] = [];
	for (const item of items) {
		if (!isWallSchematicAssetInstance(item)) continue;
		if (item.wallSegmentId !== wall.wallSegmentId) {
			rehosted.push({ item, target: "unaffected" });
			continue;
		}
		const intervalStart2 = item.offsetMm * 2 - item.widthMm;
		const intervalEnd2 = item.offsetMm * 2 + item.widthMm;
		const headLength2 = lengths.headLengthMm * 2;
		const tailStart2 = lengths.tailStartMm * 2;
		if (intervalEnd2 <= headLength2) {
			rehosted.push({ item, target: "head" });
			continue;
		}
		if (intervalStart2 >= tailStart2) {
			rehosted.push({
				item: {
					...item,
					offsetMm: item.offsetMm - lengths.tailStartMm,
				},
				target: "tail",
			});
			continue;
		}
		return undefined;
	}
	return rehosted;
}

function splitHostLengths(
	start: Pick<Vertex, "xMm" | "zMm">,
	end: Pick<Vertex, "xMm" | "zMm">,
	point: Pick<Vertex, "xMm" | "zMm">,
): { readonly headLengthMm: number; readonly tailStartMm: number } {
	const sourceLengthMm = distanceMmAllowingZero(start, end);
	const headLengthMm = distanceMmAllowingZero(start, point);
	const tailLengthMm = distanceMmAllowingZero(point, end);
	return {
		headLengthMm,
		tailStartMm: sourceLengthMm - tailLengthMm,
	};
}

/** Conservatively matches the integer host interval used by durable Openings. */
function flooredWallLengthMm(
	start: Pick<Vertex, "xMm" | "zMm">,
	end: Pick<Vertex, "xMm" | "zMm">,
): number | undefined {
	const lengthMm = Math.floor(
		Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm),
	);
	return Number.isSafeInteger(lengthMm) && lengthMm > 0 ? lengthMm : undefined;
}

function hasCollinearNeighborAtEitherEndpoint(
	walls: readonly WallSegment[],
	verticesById: ReadonlyMap<string, Vertex>,
	selected: WallSegment,
	selectedIsVertical: boolean,
): boolean {
	return walls.some((candidate) => {
		if (candidate.wallSegmentId === selected.wallSegmentId) {
			return false;
		}
		const sharedVertexId = [selected.startVertexId, selected.endVertexId].find(
			(vertexId) =>
				candidate.startVertexId === vertexId ||
				candidate.endVertexId === vertexId,
		);
		if (!sharedVertexId) {
			return false;
		}
		const shared = verticesById.get(sharedVertexId);
		const otherVertexId =
			candidate.startVertexId === sharedVertexId
				? candidate.endVertexId
				: candidate.startVertexId;
		const other = verticesById.get(otherVertexId);
		return Boolean(
			shared &&
				other &&
				(selectedIsVertical
					? other.xMm === shared.xMm
					: other.zMm === shared.zMm),
		);
	});
}

function bothTranslatedEndpointsStayInBounds(
	start: Vertex,
	end: Vertex,
	translation: WallTranslationMm,
): boolean {
	return [start, end].every((vertex) => {
		const xMm = vertex.xMm + translation.xMm;
		const zMm = vertex.zMm + translation.zMm;
		return (
			Number.isSafeInteger(xMm) &&
			Number.isSafeInteger(zMm) &&
			Math.abs(xMm) <= 100_000 &&
			Math.abs(zMm) <= 100_000
		);
	});
}

function hasCollinearDiagonalNeighborAtEitherEndpoint(
	walls: readonly WallSegment[],
	verticesById: ReadonlyMap<string, Vertex>,
	selected: WallSegment,
): boolean {
	const selectedStart = verticesById.get(selected.startVertexId);
	const selectedEnd = verticesById.get(selected.endVertexId);
	if (!selectedStart || !selectedEnd) return true;
	const selectedDeltaX = selectedEnd.xMm - selectedStart.xMm;
	const selectedDeltaZ = selectedEnd.zMm - selectedStart.zMm;
	return walls.some((candidate) => {
		if (candidate.wallSegmentId === selected.wallSegmentId) return false;
		const sharedVertexId = [selected.startVertexId, selected.endVertexId].find(
			(vertexId) =>
				candidate.startVertexId === vertexId ||
				candidate.endVertexId === vertexId,
		);
		if (!sharedVertexId) return false;
		const otherVertexId =
			candidate.startVertexId === sharedVertexId
				? candidate.endVertexId
				: candidate.startVertexId;
		const shared = verticesById.get(sharedVertexId);
		const other = verticesById.get(otherVertexId);
		if (!shared || !other) return true;
		const candidateDeltaX = other.xMm - shared.xMm;
		const candidateDeltaZ = other.zMm - shared.zMm;
		return (
			selectedDeltaX * candidateDeltaZ === selectedDeltaZ * candidateDeltaX
		);
	});
}

function incidentWallSegmentsRemainAlphaConstrained(
	graph: PlanGraph,
	vertexId: string,
): boolean {
	const verticesById = new Map(
		graph.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const incident = graph.wallSegments.filter(
		(wall) => wall.startVertexId === vertexId || wall.endVertexId === vertexId,
	);
	return (
		incident.length > 0 &&
		incident.every((wall) => {
			const start = verticesById.get(wall.startVertexId);
			const end = verticesById.get(wall.endVertexId);
			if (!start || !end) return false;
			const deltaX = end.xMm - start.xMm;
			const deltaZ = end.zMm - start.zMm;
			return (
				(deltaX === 0 && deltaZ !== 0) ||
				(deltaZ === 0 && deltaX !== 0) ||
				(deltaX !== 0 && deltaZ !== 0 && Math.abs(deltaX) === Math.abs(deltaZ))
			);
		})
	);
}

function hasReversedWallDirection(
	source: PlanGraph,
	target: PlanGraph,
): boolean {
	const sourceVertices = new Map(
		source.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const targetVertices = new Map(
		target.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	return source.wallSegments.some(({ startVertexId, endVertexId }) => {
		const sourceStart = sourceVertices.get(startVertexId);
		const sourceEnd = sourceVertices.get(endVertexId);
		const targetStart = targetVertices.get(startVertexId);
		const targetEnd = targetVertices.get(endVertexId);
		if (!sourceStart || !sourceEnd || !targetStart || !targetEnd) return true;
		// A negative dot product means the endpoints now point back across their former wall direction.
		return (
			(sourceEnd.xMm - sourceStart.xMm) * (targetEnd.xMm - targetStart.xMm) +
				(sourceEnd.zMm - sourceStart.zMm) * (targetEnd.zMm - targetStart.zMm) <
			0
		);
	});
}

function wallSegmentsRemainUsable(
	graph: PlanGraph,
	source: PlanGraph,
): boolean {
	const verticesById = new Map(
		graph.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const sourceVertices = new Map(
		source.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const sourceWalls = new Map(
		source.wallSegments.map((wall) => [wall.wallSegmentId, wall]),
	);
	return graph.wallSegments.every((wall) => {
		const start = verticesById.get(wall.startVertexId);
		const end = verticesById.get(wall.endVertexId);
		if (!start || !end) return false;
		const lengthSquared =
			(end.xMm - start.xMm) ** 2 + (end.zMm - start.zMm) ** 2;
		if (lengthSquared > wall.thicknessMm ** 2) return true;
		const previous = sourceWalls.get(wall.wallSegmentId);
		if (!previous) return false;
		const previousStart = sourceVertices.get(previous.startVertexId);
		const previousEnd = sourceVertices.get(previous.endVertexId);
		if (!previousStart || !previousEnd) return false;
		const previousLengthSquared =
			(previousEnd.xMm - previousStart.xMm) ** 2 +
			(previousEnd.zMm - previousStart.zMm) ** 2;
		// A retained contact fragment may stay or improve. Explicit edits cannot
		// create a short wall or make an existing short fragment less usable.
		return (
			previousLengthSquared > 0 &&
			previousLengthSquared <= previous.thicknessMm ** 2 &&
			lengthSquared >= previousLengthSquared &&
			wall.thicknessMm <= previous.thicknessMm
		);
	});
}

function addInputForProject(
	source: Project,
	input: AddWallSegmentInput,
): AddWallSegmentInput {
	return {
		...input,
		nonMergeableWallSegmentIds: stableInlineWallSegmentIds(source),
	};
}

/** Existing degree-two joints are explicit topology, not add-time cleanup. */
function stableInlineWallSegmentIds(source: Project): readonly string[] {
	const wallsAtVertex = new Map<string, WallSegment[]>();
	for (const wall of source.level.wallSegments) {
		for (const vertexId of [wall.startVertexId, wall.endVertexId]) {
			const walls = wallsAtVertex.get(vertexId) ?? [];
			walls.push(wall);
			wallsAtVertex.set(vertexId, walls);
		}
	}
	const protectedIds = new Set<string>();
	for (const walls of wallsAtVertex.values()) {
		if (walls.length !== 2) continue;
		for (const wall of walls) protectedIds.add(wall.wallSegmentId);
	}
	return [...protectedIds];
}

function movedProjectItemHostsRemainValid(project: Project): boolean {
	return project.assetInstances.every((item) =>
		isWallSchematicAssetInstance(item)
			? isWallSchematicAssetPlacementValid(project, item)
			: findRoomForFloorItem(project, item) === item.roomId,
	);
}

function wallItemCollisionRejection(
	project: Project,
): RejectedMutation | undefined {
	const floorItem = firstFloorItemIntersectedByProjectWall(project);
	return floorItem
		? reject("WALL_ITEM_COLLISION", {
				assetInstanceId: floorItem.assetInstanceId,
				kind: "floor-item",
			})
		: undefined;
}

function firstFloorItemIntersectedByProjectWall(
	project: Project,
): FloorSchematicAssetInstance | undefined {
	const verticesById = new Map(
		project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	for (const wall of project.level.wallSegments) {
		const start = verticesById.get(wall.startVertexId);
		const end = verticesById.get(wall.endVertexId);
		if (!start || !end) return undefined;
		const floorItem = firstFloorItemIntersectedByWall(
			{
				end: { xMm: end.xMm, zMm: end.zMm },
				start: { xMm: start.xMm, zMm: start.zMm },
				thicknessMm: wall.thicknessMm,
			},
			project.assetInstances,
		);
		if (floorItem) return floorItem;
	}
	return undefined;
}

function openingIntersectedByWallHostedByAnotherWall(
	project: Project,
	wallSegmentId: string,
	openingHostFilter?: ReadonlySet<string>,
): WallOpening | undefined {
	const wall = project.level.wallSegments.find(
		(candidate) => candidate.wallSegmentId === wallSegmentId,
	);
	const start = wall
		? project.level.vertices.find(
				(vertex) => vertex.vertexId === wall.startVertexId,
			)
		: undefined;
	const end = wall
		? project.level.vertices.find(
				(vertex) => vertex.vertexId === wall.endVertexId,
			)
		: undefined;
	if (!wall || !start || !end) return undefined;
	return firstOpeningIntersectedByWall(
		{
			end: { xMm: end.xMm, zMm: end.zMm },
			start: { xMm: start.xMm, zMm: start.zMm },
			thicknessMm: wall.thicknessMm,
		},
		project,
		wallSegmentId,
		openingHostFilter,
	);
}

function inspectSourceProject(
	project: Project,
):
	| { readonly kind: "accepted"; readonly faces: readonly SourceRoom[] }
	| RejectedMutation {
	const faces = facesForGraph(graphOf(project));
	if (faces.kind === "rejected") {
		return reject("INVALID_SOURCE_PROJECT");
	}
	if (
		project.level.rooms.length !== faces.faces.length ||
		!hasUniqueValidRoomMetadata(project.level.rooms)
	) {
		return reject("INVALID_SOURCE_PROJECT");
	}

	const context = boundsContext(faces.faces);
	const assignedFaces = new Set<string>();
	const sourceFaces: SourceRoom[] = [];
	for (const room of project.level.rooms) {
		const matches = faces.faces.filter((face) =>
			roomMatchesFace(room, face, context),
		);
		const face = matches[0];
		if (!face || matches.length !== 1 || assignedFaces.has(face.key)) {
			return reject("INVALID_SOURCE_PROJECT");
		}
		assignedFaces.add(face.key);
		sourceFaces.push({ face, room });
	}
	if (
		assignedFaces.size !== faces.faces.length ||
		!hasValidHostedItems(project, project.assetInstances, sourceFaces)
	) {
		return reject("INVALID_SOURCE_PROJECT");
	}
	return { faces: sourceFaces, kind: "accepted" };
}

/**
 * The first supported non-rectangular Room is deliberately narrow: a clean,
 * three-segment, 45-degree triangle. It has no hosted content to re-home and
 * its exact derived fingerprint is enough to keep the durable Room tied to
 * the PlanGraph without inventing a rectangular envelope.
 */
function firstTriangularFaceForEmptyProject(
	source: Project,
	graph: PlanGraph,
): DerivedOrthogonalFace | undefined {
	if (
		source.level.rooms.length !== 0 ||
		source.level.openings.length !== 0 ||
		source.assetInstances.length !== 0 ||
		graph.wallSegments.length !== 3
	) {
		return undefined;
	}
	const derived = deriveBoundedOrthogonalFaces(graph);
	if (derived.kind === "rejected" || derived.faces.length !== 1) {
		return undefined;
	}
	const face = derived.faces[0];
	if (!face) {
		return undefined;
	}
	if (
		face.vertices.length !== 3 ||
		face.boundaryWallSegmentIds.length !== 3 ||
		new Set(face.boundaryWallSegmentIds).size !== 3
	) {
		return undefined;
	}
	const boundaryWallIds = new Set(face.boundaryWallSegmentIds);
	return graph.wallSegments.every(
		(wall) =>
			boundaryWallIds.has(wall.wallSegmentId) &&
			Number.isSafeInteger(wall.thicknessMm) &&
			wall.thicknessMm > 0,
	)
		? face
		: undefined;
}

function facesForGraph(
	graph: PlanGraph,
):
	| { readonly kind: "accepted"; readonly faces: readonly RectangularFace[] }
	| RejectedMutation {
	const derived = deriveBoundedOrthogonalFaces(graph);
	if (derived.kind === "rejected") {
		return reject("INVALID_RESULTING_PROJECT");
	}
	const wallsById = new Map(
		graph.wallSegments.map((wall) => [wall.wallSegmentId, wall]),
	);
	const verticesById = new Map(
		graph.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const faces: RectangularFace[] = [];
	for (const face of derived.faces) {
		const rectangle = rectangleFor(face, wallsById, verticesById);
		if (rectangle) {
			faces.push(rectangle);
			continue;
		}
		const polygon = polygonalFaceFor(face, wallsById);
		if (!polygon) {
			return reject("UNSUPPORTED_FACE_SHAPE");
		}
		faces.push(polygon);
	}
	return { faces: faces.sort(compareFaces), kind: "accepted" };
}

function rectangleFor(
	face: DerivedOrthogonalFace,
	wallsById: ReadonlyMap<string, WallSegment>,
	verticesById: ReadonlyMap<
		string,
		{ readonly xMm: number; readonly zMm: number }
	>,
): RectangularFace | undefined {
	const minXMm = Math.min(...face.vertices.map((vertex) => vertex.xMm));
	const maxXMm = Math.max(...face.vertices.map((vertex) => vertex.xMm));
	const minZMm = Math.min(...face.vertices.map((vertex) => vertex.zMm));
	const maxZMm = Math.max(...face.vertices.map((vertex) => vertex.zMm));
	const bounds = { maxXMm, maxZMm, minXMm, minZMm };
	const corners = new Set([
		coordinateKey(minXMm, minZMm),
		coordinateKey(minXMm, maxZMm),
		coordinateKey(maxXMm, minZMm),
		coordinateKey(maxXMm, maxZMm),
	]);
	if (
		!isPositiveBounds(bounds) ||
		!face.vertices.every(
			(vertex) =>
				corners.has(coordinateKey(vertex.xMm, vertex.zMm)) ||
				vertex.xMm === minXMm ||
				vertex.xMm === maxXMm ||
				vertex.zMm === minZMm ||
				vertex.zMm === maxZMm,
		) ||
		![...corners].every((corner) =>
			face.vertices.some(
				(vertex) => coordinateKey(vertex.xMm, vertex.zMm) === corner,
			),
		)
	) {
		return undefined;
	}
	const insets = faceInsetsFor(face, bounds, wallsById, verticesById);
	if (!insets) {
		return undefined;
	}
	return {
		bounds,
		insets,
		kind: "rectangular",
		key: faceKey(bounds, insets),
		source: face,
		thicknessMm: Math.max(
			insets.minXMm,
			insets.maxXMm,
			insets.minZMm,
			insets.maxZMm,
		),
	};
}

function polygonalFaceFor(
	face: DerivedOrthogonalFace,
	wallsById: ReadonlyMap<string, WallSegment>,
): RectangularFace | undefined {
	if (face.vertices.length < 3) {
		return undefined;
	}
	const walls = face.boundaryWallSegmentIds.map((wallSegmentId) =>
		wallsById.get(wallSegmentId),
	);
	if (
		!walls.every(
			(wall) =>
				wall && Number.isSafeInteger(wall.thicknessMm) && wall.thicknessMm > 0,
		)
	) {
		return undefined;
	}
	const bounds = {
		maxXMm: Math.max(...face.vertices.map((vertex) => vertex.xMm)),
		maxZMm: Math.max(...face.vertices.map((vertex) => vertex.zMm)),
		minXMm: Math.min(...face.vertices.map((vertex) => vertex.xMm)),
		minZMm: Math.min(...face.vertices.map((vertex) => vertex.zMm)),
	};
	if (!isPositiveBounds(bounds)) {
		return undefined;
	}
	const thicknessMm = Math.max(...walls.map((wall) => wall?.thicknessMm ?? 0));
	return {
		bounds,
		insets: {
			maxXMm: thicknessMm,
			maxZMm: thicknessMm,
			minXMm: thicknessMm,
			minZMm: thicknessMm,
		},
		kind: "polygonal",
		key: face.fingerprint,
		source: face,
		thicknessMm,
	};
}

function faceInsetsFor(
	face: DerivedOrthogonalFace,
	bounds: Bounds,
	wallsById: ReadonlyMap<string, WallSegment>,
	verticesById: ReadonlyMap<
		string,
		{ readonly xMm: number; readonly zMm: number }
	>,
): FaceInsets | undefined {
	const values: { -readonly [K in keyof FaceInsets]?: number } = {};
	for (const wallSegmentId of face.boundaryWallSegmentIds) {
		const wall = wallsById.get(wallSegmentId);
		const start = wall ? verticesById.get(wall.startVertexId) : undefined;
		const end = wall ? verticesById.get(wall.endVertexId) : undefined;
		if (
			!wall ||
			!start ||
			!end ||
			!Number.isSafeInteger(wall.thicknessMm) ||
			wall.thicknessMm <= 0
		) {
			return undefined;
		}
		const side = wallSideForBounds(start, end, bounds);
		if (
			!side ||
			(values[side] !== undefined && values[side] !== wall.thicknessMm)
		) {
			return undefined;
		}
		values[side] = wall.thicknessMm;
	}
	return values.minXMm !== undefined &&
		values.maxXMm !== undefined &&
		values.minZMm !== undefined &&
		values.maxZMm !== undefined
		? (values as FaceInsets)
		: undefined;
}

function wallSideForBounds(
	start: { readonly xMm: number; readonly zMm: number },
	end: { readonly xMm: number; readonly zMm: number },
	bounds: Bounds,
): keyof FaceInsets | undefined {
	if (start.xMm === end.xMm) {
		return start.xMm === bounds.minXMm
			? "minXMm"
			: start.xMm === bounds.maxXMm
				? "maxXMm"
				: undefined;
	}
	if (start.zMm === end.zMm) {
		return start.zMm === bounds.minZMm
			? "minZMm"
			: start.zMm === bounds.maxZMm
				? "maxZMm"
				: undefined;
	}
	return undefined;
}

function planAddedFaces(
	sourceFaces: readonly SourceRoom[],
	targetFaces: readonly RectangularFace[],
):
	| { readonly kind: "accepted"; readonly faces: readonly PlannedTargetFace[] }
	| RejectedMutation {
	const unchangedSources = new Set(
		sourceFaces.filter(({ face }) =>
			targetFaces.some((target) => sameFace(face, target)),
		),
	);
	const faces: PlannedTargetFace[] = [];
	for (const target of targetFaces) {
		const contributors = sourceFaces.filter((source) =>
			unchangedSources.has(source)
				? sameFace(source.face, target)
				: containsFace(source.face, target),
		);
		if (contributors.length > 1) {
			return reject("INVALID_RESULTING_PROJECT");
		}
		faces.push({ contributors, face: target });
	}
	if (
		!sourceFaces.every((source) =>
			faces.some((target) => target.contributors.includes(source)),
		)
	) {
		return reject("INVALID_RESULTING_PROJECT");
	}
	return { faces, kind: "accepted" };
}

/** A parallel wall move keeps the segment IDs that identify each room boundary. */
function reconcileParallelWallMoveFaces(
	sourceFaces: readonly SourceRoom[],
	targetFaces: readonly RectangularFace[],
): readonly PlannedTargetFace[] | undefined {
	if (sourceFaces.length !== targetFaces.length) return undefined;
	// The derived face exposes its unique boundary IDs in canonical order.
	const boundaryKey = (face: RectangularFace) =>
		JSON.stringify(face.source.boundaryWallSegmentIds);
	const unmatchedByBoundary = new Map(
		sourceFaces.map((source) => [boundaryKey(source.face), source]),
	);
	const planned: PlannedTargetFace[] = [];
	for (const face of targetFaces) {
		const key = boundaryKey(face);
		const previous = unmatchedByBoundary.get(key);
		if (!previous) return undefined;
		unmatchedByBoundary.delete(key);
		planned.push({ contributors: [previous], face });
	}
	return planned;
}

/** Reconcile edits that can change boundary segment IDs using unique greatest face overlap. */
function planMovedFaces(
	sourceFaces: readonly SourceRoom[],
	targetFaces: readonly RectangularFace[],
):
	| { readonly kind: "accepted"; readonly faces: readonly PlannedTargetFace[] }
	| RejectedMutation {
	if (sourceFaces.length !== targetFaces.length) {
		return reject("INVALID_RESULTING_PROJECT");
	}
	const assignedSourceRoomIds = new Set<string>();
	const faces: PlannedTargetFace[] = [];
	for (const target of targetFaces) {
		const overlaps = sourceFaces
			.map((source) => ({ area: overlapArea(source.face, target), source }))
			.filter((candidate) => candidate.area > 0)
			.sort(
				(first, second) =>
					second.area - first.area ||
					compareText(first.source.room.roomId, second.source.room.roomId),
			);
		const selected = overlaps[0];
		const next = overlaps[1];
		if (
			!selected ||
			selected.area === next?.area ||
			assignedSourceRoomIds.has(selected.source.room.roomId)
		) {
			return reject("INVALID_RESULTING_PROJECT");
		}
		assignedSourceRoomIds.add(selected.source.room.roomId);
		faces.push({ contributors: [selected.source], face: target });
	}
	return assignedSourceRoomIds.size === sourceFaces.length
		? { faces, kind: "accepted" }
		: reject("INVALID_RESULTING_PROJECT");
}

function overlapArea(first: RectangularFace, second: RectangularFace): number {
	const width =
		Math.min(first.bounds.maxXMm, second.bounds.maxXMm) -
		Math.max(first.bounds.minXMm, second.bounds.minXMm);
	const depth =
		Math.min(first.bounds.maxZMm, second.bounds.maxZMm) -
		Math.max(first.bounds.minZMm, second.bounds.minZMm);
	return width > 0 && depth > 0 ? width * depth : 0;
}

function planDeletedFaces(
	sourceFaces: readonly SourceRoom[],
	targetFaces: readonly RectangularFace[],
):
	| { readonly kind: "accepted"; readonly faces: readonly PlannedTargetFace[] }
	| RejectedMutation {
	const faces: PlannedTargetFace[] = [];
	for (const target of targetFaces) {
		const contributors = sourceFaces.filter((source) =>
			containsFace(target, source.face),
		);
		if (contributors.length === 0) {
			return reject("INVALID_RESULTING_PROJECT");
		}
		faces.push({ contributors, face: target });
	}
	return { faces, kind: "accepted" };
}

function orphanedItemIdsAfterWallDeletion(
	source: Project,
	wallSegmentIds: readonly string[],
): readonly string[] {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return [];
	}
	const deleted = deleteWallSegments(graphOf(source), wallSegmentIds);
	if (deleted.kind === "rejected") {
		return [];
	}
	const targetFaces = facesForGraph(deleted.graph);
	if (targetFaces.kind === "rejected") {
		return [];
	}
	const planned = planDeletedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return [];
	}
	const orphanedFloorItemIds = source.assetInstances
		.filter((item) => {
			if (!isFloorSchematicAssetInstance(item)) return false;
			const sourceFace = sourceProject.faces.find(
				(candidate) => candidate.room.roomId === item.roomId,
			);
			return (
				!sourceFace ||
				planned.faces.filter((target) =>
					target.contributors.includes(sourceFace),
				).length !== 1
			);
		})
		.map((item) => item.assetInstanceId);
	return [
		...orphanedFloorItemIds,
		...source.assetInstances
			.filter(
				(item) =>
					isWallSchematicAssetInstance(item) &&
					wallSegmentIds.includes(item.wallSegmentId),
			)
			.map((item) => item.assetInstanceId),
	].sort();
}

function affectedRoomIdsAfterWallDeletion(
	source: Project,
	wallSegmentIds: readonly string[],
): readonly string[] {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return [];
	}
	const deleted = deleteWallSegments(graphOf(source), wallSegmentIds);
	if (deleted.kind === "rejected") {
		return [];
	}
	const targetFaces = facesForGraph(deleted.graph);
	if (targetFaces.kind === "rejected") {
		return [];
	}
	const planned = planDeletedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return [];
	}
	return sourceProject.faces
		.filter((sourceFace) => {
			const targets = planned.faces.filter((target) =>
				target.contributors.includes(sourceFace),
			);
			const target = targets[0];
			return (
				targets.length !== 1 ||
				!target ||
				target.contributors.length !== 1 ||
				!sameFace(sourceFace.face, target.face)
			);
		})
		.map((sourceFace) => sourceFace.room.roomId)
		.sort();
}

function roomMetadataConflictsAfterWallDeletion(
	source: Project,
	wallSegmentIds: readonly string[],
): readonly RoomMetadataMergeConflict[] {
	const sourceProject = inspectSourceProject(source);
	if (sourceProject.kind === "rejected") {
		return [];
	}
	const deleted = deleteWallSegments(graphOf(source), wallSegmentIds);
	if (deleted.kind === "rejected") {
		return [];
	}
	const targetFaces = facesForGraph(deleted.graph);
	if (targetFaces.kind === "rejected") {
		return [];
	}
	const planned = planDeletedFaces(sourceProject.faces, targetFaces.faces);
	if (planned.kind === "rejected") {
		return [];
	}
	return planned.faces
		.filter((target) => target.contributors.length > 1)
		.map((target) => ({
			retainedRoomIds: target.contributors
				.map((contributor) => contributor.room.roomId)
				.sort(compareText),
			targetFaceKey: target.face.key,
		}))
		.sort((first, second) =>
			compareText(first.targetFaceKey, second.targetFaceKey),
		);
}

function materializeAddedRooms(
	plannedFaces: readonly PlannedTargetFace[],
	ids: IdSource,
): readonly MaterializedTargetFace[] {
	const result: MaterializedTargetFace[] = [];
	const mustNormalizeLegacyStarterFingerprint = plannedFaces.length > 1;
	const byParentRoomId = new Map<string | undefined, PlannedTargetFace[]>();
	for (const planned of plannedFaces) {
		const parentRoomId = planned.contributors[0]?.room.roomId;
		const group = byParentRoomId.get(parentRoomId) ?? [];
		group.push(planned);
		byParentRoomId.set(parentRoomId, group);
	}
	for (const [parentRoomId, group] of byParentRoomId) {
		const sorted = [...group].sort((first, second) =>
			compareFaces(first.face, second.face),
		);
		sorted.forEach((planned, index) => {
			const source = planned.contributors[0];
			const unchanged =
				source !== undefined && sameFace(source.face, planned.face);
			const roomId = parentRoomId && index === 0 ? parentRoomId : ids.next();
			result.push({
				face: planned.face,
				room:
					unchanged && roomId === source?.room.roomId
						? {
								...source.room,
								...(mustNormalizeLegacyStarterFingerprint &&
								isLegacyStarterFingerprint(source.room.faceFingerprint)
									? { faceFingerprint: gridFingerprint(planned.face) }
									: {}),
							}
						: roomId === source?.room.roomId
							? {
									...source.room,
									faceFingerprint: gridFingerprint(planned.face),
								}
							: {
									faceFingerprint: gridFingerprint(planned.face),
									heightMm:
										source?.room.heightMm ?? defaultRoomHeight(plannedFaces),
									roomId,
								},
			});
		});
	}
	return result.sort(compareMaterializedFaces);
}

function matchesRoomMetadataMergeResolutions(
	conflicts: readonly RoomMetadataMergeConflict[],
	resolutions: readonly DeleteGeneralWallRoomMetadataResolution[] | undefined,
): boolean {
	if (conflicts.length === 0) {
		return resolutions === undefined || resolutions.length === 0;
	}
	if (!resolutions || conflicts.length !== resolutions.length) {
		return false;
	}
	const seenTargets = new Set<string>();
	return resolutions.every((resolution) => {
		if (seenTargets.has(resolution.targetFaceKey)) {
			return false;
		}
		seenTargets.add(resolution.targetFaceKey);
		const conflict = conflicts.find(
			(candidate) => candidate.targetFaceKey === resolution.targetFaceKey,
		);
		return Boolean(
			conflict?.retainedRoomIds.includes(resolution.retainedRoomId),
		);
	});
}

function applyDeletedRoomMetadataResolution(
	source: Project,
	deleted: Project,
	conflicts: readonly RoomMetadataMergeConflict[],
	resolutions: readonly DeleteGeneralWallRoomMetadataResolution[],
): GeneralWallProjectMutationResult {
	const targetFaces = facesForGraph(graphOf(deleted));
	if (targetFaces.kind === "rejected") {
		return targetFaces;
	}
	const sourceRoomsById = new Map(
		source.level.rooms.map((room) => [room.roomId, room]),
	);
	const roomEntries = roomEntriesByFaceKey(
		deleted.level.rooms,
		targetFaces.faces,
	);
	if (!roomEntries) {
		return reject("INVALID_RESULTING_PROJECT");
	}

	const replacementByRoomId = new Map<string, Room>();
	const remappedRoomIds = new Map<string, string>();
	for (const conflict of conflicts) {
		const resolution = resolutions.find(
			(candidate) => candidate.targetFaceKey === conflict.targetFaceKey,
		);
		const selectedRoom = resolution
			? sourceRoomsById.get(resolution.retainedRoomId)
			: undefined;
		const face = targetFaces.faces.find(
			(candidate) => candidate.key === conflict.targetFaceKey,
		);
		const materializedRoom = roomEntries.get(conflict.targetFaceKey);
		if (
			!resolution ||
			!selectedRoom ||
			!face ||
			!materializedRoom ||
			!conflict.retainedRoomIds.includes(selectedRoom.roomId)
		) {
			return reject("INVALID_RESULTING_PROJECT");
		}
		replacementByRoomId.set(materializedRoom.roomId, {
			...selectedRoom,
			faceFingerprint: gridFingerprint(face),
		});
		if (materializedRoom.roomId !== selectedRoom.roomId) {
			remappedRoomIds.set(materializedRoom.roomId, selectedRoom.roomId);
		}
	}

	const rooms = deleted.level.rooms.map(
		(room) => replacementByRoomId.get(room.roomId) ?? room,
	);
	if (new Set(rooms.map((room) => room.roomId)).size !== rooms.length) {
		return reject("INVALID_RESULTING_PROJECT");
	}
	return {
		kind: "accepted",
		project: {
			...deleted,
			assetInstances: deleted.assetInstances.map((asset) =>
				isFloorSchematicAssetInstance(asset)
					? {
							...asset,
							roomId: remappedRoomIds.get(asset.roomId) ?? asset.roomId,
						}
					: asset,
			),
			level: { ...deleted.level, rooms },
		},
	};
}

function roomEntriesByFaceKey(
	rooms: readonly Room[],
	faces: readonly RectangularFace[],
): ReadonlyMap<string, Room> | undefined {
	const context = boundsContext(faces);
	const entries = new Map<string, Room>();
	for (const room of rooms) {
		const matches = faces.filter((face) =>
			roomMatchesFace(room, face, context),
		);
		const face = matches[0];
		if (!face || matches.length !== 1 || entries.has(face.key)) {
			return undefined;
		}
		entries.set(face.key, room);
	}
	return entries.size === faces.length ? entries : undefined;
}

function isLegacyStarterFingerprint(value: string): boolean {
	return /^rectangular:(?:0|[1-9]\d*):(?:0|[1-9]\d*):(?:0|[1-9]\d*)$/.test(
		value,
	);
}

function materializeDeletedRooms(
	plannedFaces: readonly PlannedTargetFace[],
): readonly MaterializedTargetFace[] {
	return plannedFaces
		.map((planned) => {
			const source = [...planned.contributors].sort(compareSourceRooms)[0];
			if (!source) {
				throw new Error(
					"A deletion plan must retain at least one source room per target face",
				);
			}
			return {
				face: planned.face,
				room:
					sameFace(source.face, planned.face) &&
					planned.contributors.length === 1
						? source.room
						: {
								...source.room,
								faceFingerprint: gridFingerprint(planned.face),
							},
			};
		})
		.sort(compareMaterializedFaces);
}

function materializeThicknessChangedRooms(
	plannedFaces: readonly PlannedTargetFace[],
):
	| {
			readonly kind: "accepted";
			readonly rooms: readonly MaterializedTargetFace[];
	  }
	| RejectedMutation {
	const rooms: MaterializedTargetFace[] = [];
	for (const planned of plannedFaces) {
		const source = planned.contributors[0];
		if (!source || planned.contributors.length !== 1) {
			return reject("INVALID_RESULTING_PROJECT");
		}
		rooms.push({
			face: planned.face,
			room: sameFace(source.face, planned.face)
				? source.room
				: {
						...source.room,
						faceFingerprint: gridFingerprint(planned.face),
					},
		});
	}
	return { kind: "accepted", rooms: rooms.sort(compareMaterializedFaces) };
}

function materializeWallThicknessOnlyRooms(
	plannedFaces: readonly PlannedTargetFace[],
):
	| {
			readonly kind: "accepted";
			readonly rooms: readonly MaterializedTargetFace[];
	  }
	| RejectedMutation {
	const rooms: MaterializedTargetFace[] = [];
	for (const planned of plannedFaces) {
		const source = planned.contributors[0];
		if (!source || planned.contributors.length !== 1) {
			return reject("INVALID_RESULTING_PROJECT");
		}
		rooms.push({ face: planned.face, room: source.room });
	}
	return { kind: "accepted", rooms: rooms.sort(compareMaterializedFaces) };
}

function acceptedProject(
	source: Project,
	graph: PlanGraph,
	rooms: readonly MaterializedTargetFace[],
	updatedAt: string,
	retainedFloorHostRoomIds?: ReadonlySet<string>,
): GeneralWallProjectMutationResult {
	const roomByFaceKey = new Map(
		rooms.map((entry) => [entry.face.key, entry.room]),
	);
	const assetInstances = source.assetInstances.map((asset) => {
		if (
			!isFloorSchematicAssetInstance(asset) ||
			retainedFloorHostRoomIds?.has(asset.roomId)
		) {
			return asset;
		}
		const hosts = rooms.filter((entry) => footprintFitsFace(asset, entry.face));
		const room = hosts[0]?.room;
		if (!room || hosts.length !== 1) {
			throw new Error(
				"A proven item host was not materialized with the wall mutation",
			);
		}
		return { ...asset, roomId: room.roomId };
	});
	if (roomByFaceKey.size !== rooms.length) {
		return reject("INVALID_RESULTING_PROJECT");
	}
	const project: Project = {
		...source,
		assetInstances,
		level: {
			...source.level,
			rooms: rooms.map((entry) => entry.room),
			vertices: graph.vertices,
			wallSegments: graph.wallSegments,
		},
		updatedAt,
	};
	return {
		kind: "accepted",
		project,
	};
}

function acceptedProjectByRoomLineage(
	source: Project,
	graph: PlanGraph,
	sourceFaces: readonly SourceRoom[],
	plannedFaces: readonly PlannedTargetFace[],
	rooms: readonly MaterializedTargetFace[],
	updatedAt: string,
): GeneralWallProjectMutationResult {
	const roomByFaceKey = new Map(
		rooms.map((entry) => [entry.face.key, entry.room]),
	);
	if (roomByFaceKey.size !== rooms.length) {
		return reject("INVALID_RESULTING_PROJECT");
	}
	const assetInstances: SchematicAssetInstance[] = [];
	for (const asset of source.assetInstances) {
		if (!isFloorSchematicAssetInstance(asset)) {
			assetInstances.push(asset);
			continue;
		}
		const sourceFace = sourceFaces.find(
			(candidate) => candidate.room.roomId === asset.roomId,
		);
		const targets = sourceFace
			? plannedFaces.filter((target) =>
					target.contributors.includes(sourceFace),
				)
			: [];
		const room = targets[0]
			? roomByFaceKey.get(targets[0].face.key)
			: undefined;
		if (!sourceFace || targets.length !== 1 || !room) {
			return reject("ITEM_HOST_UNRESOLVABLE");
		}
		assetInstances.push({ ...asset, roomId: room.roomId });
	}
	return {
		kind: "accepted",
		project: {
			...source,
			assetInstances,
			level: {
				...source.level,
				rooms: rooms.map((entry) => entry.room),
				vertices: graph.vertices,
				wallSegments: graph.wallSegments,
			},
			updatedAt,
		},
	};
}

/**
 * A thickness-only command cannot change centreline face lineage. Durable host
 * addresses therefore stay byte-for-byte stable and are checked against the
 * exact recomputed usable polygons after materialization. The conservative
 * polygon envelope is never authoritative for a rotated floor item here.
 */
function acceptedWallThicknessProject(
	source: Project,
	graph: PlanGraph,
	rooms: readonly MaterializedTargetFace[],
	updatedAt: string,
): GeneralWallProjectMutationResult {
	if (new Set(rooms.map((entry) => entry.face.key)).size !== rooms.length) {
		return reject("INVALID_RESULTING_PROJECT");
	}
	return {
		kind: "accepted",
		project: {
			...source,
			assetInstances: source.assetInstances,
			level: {
				...source.level,
				rooms: rooms.map((entry) => entry.room),
				vertices: graph.vertices,
				wallSegments: graph.wallSegments,
			},
			updatedAt,
		},
	};
}

function acceptedInitialTriangleProject(
	source: Project,
	graph: PlanGraph,
	face: DerivedOrthogonalFace,
	roomId: string,
	updatedAt: string,
): GeneralWallProjectMutationResult {
	if (
		source.level.rooms.length !== 0 ||
		source.level.openings.length !== 0 ||
		source.assetInstances.length !== 0 ||
		!roomId
	) {
		return reject("INVALID_RESULTING_PROJECT");
	}
	return {
		kind: "accepted",
		project: {
			...source,
			level: {
				...source.level,
				rooms: [
					{
						faceFingerprint: face.fingerprint,
						heightMm: DEFAULT_ROOM_HEIGHT_MM,
						roomId,
					},
				],
				vertices: graph.vertices,
				wallSegments: graph.wallSegments,
			},
			updatedAt,
		},
	};
}

function reconciled(
	accepted: GeneralWallProjectAccepted,
): MissingRoomsReconciliationResult {
	return { changed: true, kind: "accepted", project: accepted.project };
}

function unchanged(source: Project): MissingRoomsReconciliationResult {
	return { changed: false, kind: "accepted", project: source };
}

function hasUniqueValidRoomMetadata(rooms: readonly Room[]): boolean {
	const ids = new Set<string>();
	for (const room of rooms) {
		if (
			!room.roomId ||
			ids.has(room.roomId) ||
			!room.faceFingerprint ||
			!Number.isSafeInteger(room.heightMm) ||
			room.heightMm <= 0
		) {
			return false;
		}
		ids.add(room.roomId);
	}
	return true;
}

function hasValidHostedItems(
	project: Project,
	items: readonly SchematicAssetInstance[],
	sourceFaces: readonly SourceRoom[],
): boolean {
	const ids = new Set<string>();
	for (const item of items) {
		if (isWallSchematicAssetInstance(item)) {
			if (
				!item.assetInstanceId ||
				ids.has(item.assetInstanceId) ||
				!isWallSchematicAssetPlacementValid(project, item)
			) {
				return false;
			}
			ids.add(item.assetInstanceId);
			continue;
		}
		const source = sourceFaces.find(
			(candidate) => candidate.room.roomId === item.roomId,
		);
		const valid =
			item.anchorClass === "floor" &&
			Boolean(item.assetInstanceId) &&
			!ids.has(item.assetInstanceId) &&
			item.label.trim().length > 0 &&
			/^#[0-9a-fA-F]{6}$/.test(item.color) &&
			[item.xMm, item.zMm, item.widthMm, item.depthMm, item.heightMm].every(
				Number.isSafeInteger,
			) &&
			item.widthMm > 0 &&
			item.depthMm > 0 &&
			item.heightMm > 0;
		if (
			!valid ||
			!source ||
			findRoomForFloorItem(project, item) !== item.roomId
		) {
			return false;
		}
		ids.add(item.assetInstanceId);
	}
	return true;
}

function itemsFitExactlyOneTarget(
	items: readonly SchematicAssetInstance[],
	targets: readonly PlannedTargetFace[],
): boolean {
	return items.every(
		(item) =>
			!isFloorSchematicAssetInstance(item) ||
			targets.filter((target) => footprintFitsFace(item, target.face))
				.length === 1,
	);
}

function floorItemsHaveExactlyOneLineageTarget(
	items: readonly SchematicAssetInstance[],
	sourceFaces: readonly SourceRoom[],
	targets: readonly PlannedTargetFace[],
): boolean {
	return items.every((item) => {
		if (!isFloorSchematicAssetInstance(item)) return true;
		const sourceFace = sourceFaces.find(
			(candidate) => candidate.room.roomId === item.roomId,
		);
		return Boolean(
			sourceFace &&
				targets.filter((target) => target.contributors.includes(sourceFace))
					.length === 1,
		);
	});
}

function hasWallItemHostedBy(
	items: readonly SchematicAssetInstance[],
	wallSegmentIds: readonly string[],
): boolean {
	return items.some(
		(item) =>
			isWallSchematicAssetInstance(item) &&
			wallSegmentIds.includes(item.wallSegmentId),
	);
}

function footprintFitsFace(
	item: Pick<
		FloorSchematicAssetInstance,
		"depthMm" | "widthMm" | "xMm" | "zMm"
	>,
	face: RectangularFace,
): boolean {
	const minX2 = BigInt(face.bounds.minXMm) * 2n + BigInt(face.insets.minXMm);
	const maxX2 = BigInt(face.bounds.maxXMm) * 2n - BigInt(face.insets.maxXMm);
	const minZ2 = BigInt(face.bounds.minZMm) * 2n + BigInt(face.insets.minZMm);
	const maxZ2 = BigInt(face.bounds.maxZMm) * 2n - BigInt(face.insets.maxZMm);
	const itemMinX2 = BigInt(item.xMm) * 2n - BigInt(item.widthMm);
	const itemMaxX2 = BigInt(item.xMm) * 2n + BigInt(item.widthMm);
	const itemMinZ2 = BigInt(item.zMm) * 2n - BigInt(item.depthMm);
	const itemMaxZ2 = BigInt(item.zMm) * 2n + BigInt(item.depthMm);
	return (
		itemMinX2 >= minX2 &&
		itemMaxX2 <= maxX2 &&
		itemMinZ2 >= minZ2 &&
		itemMaxZ2 <= maxZ2
	);
}

function hasUsableFloorArea(face: RectangularFace): boolean {
	if (face.kind === "polygonal") return false;
	return (
		face.bounds.minXMm * 2 + face.insets.minXMm <
			face.bounds.maxXMm * 2 - face.insets.maxXMm &&
		face.bounds.minZMm * 2 + face.insets.minZMm <
			face.bounds.maxZMm * 2 - face.insets.maxZMm
	);
}

function isEditableWallThickness(value: number): boolean {
	return (
		Number.isSafeInteger(value) &&
		value >= MIN_EDITABLE_WALL_THICKNESS_MM &&
		value <= MAX_EDITABLE_WALL_THICKNESS_MM
	);
}

function firstFloorItemIntersectedByWall(
	input: AddWallSegmentInput,
	items: readonly SchematicAssetInstance[],
): FloorSchematicAssetInstance | undefined {
	return items.find(
		(item): item is FloorSchematicAssetInstance =>
			isFloorSchematicAssetInstance(item) &&
			wallBodyIntersectsItem(input, item),
	);
}

function wallBodyIntersectsItem(
	input: AddWallSegmentInput,
	item: FloorSchematicAssetInstance,
): boolean {
	return floorItemFootprintIntersectsWall(item, input);
}

/**
 * Doorways are literal holes in a wall body, rather than merely a 2D symbol.
 * A new wall may meet an existing wall at a jamb, but it may never occupy the
 * positive-area doorway rectangle; doing so would leave an impossible Opening
 * record after the next durable revision.
 */
function firstOpeningIntersectedByWall(
	input: AddWallSegmentInput,
	project: Project,
	excludedHostWallSegmentId?: string,
	openingHostFilter?: ReadonlySet<string>,
): WallOpening | undefined {
	const candidate = doubledWallBounds(input);
	if (!candidate) {
		return undefined;
	}
	const verticesById = new Map(
		project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const wallsById = new Map(
		project.level.wallSegments.map((wall) => [wall.wallSegmentId, wall]),
	);
	return project.level.openings.find((opening) => {
		if (
			opening.wallSegmentId === excludedHostWallSegmentId ||
			(openingHostFilter && !openingHostFilter.has(opening.wallSegmentId))
		)
			return false;
		const wall = wallsById.get(opening.wallSegmentId);
		const start = wall ? verticesById.get(wall.startVertexId) : undefined;
		const end = wall ? verticesById.get(wall.endVertexId) : undefined;
		const openingBounds =
			wall && start && end
				? doubledDoorOpeningBounds(opening, wall, start, end)
				: undefined;
		return openingBounds
			? boundsPositivelyOverlap(candidate, openingBounds)
			: false;
	});
}

function doubledWallBounds(input: AddWallSegmentInput): Bounds | undefined {
	if (
		!Number.isSafeInteger(input.thicknessMm) ||
		input.thicknessMm <= 0 ||
		!Number.isSafeInteger(input.start.xMm) ||
		!Number.isSafeInteger(input.start.zMm) ||
		!Number.isSafeInteger(input.end.xMm) ||
		!Number.isSafeInteger(input.end.zMm) ||
		(input.start.xMm !== input.end.xMm && input.start.zMm !== input.end.zMm)
	) {
		return undefined;
	}
	return {
		maxXMm: Math.max(input.start.xMm, input.end.xMm) * 2 + input.thicknessMm,
		maxZMm: Math.max(input.start.zMm, input.end.zMm) * 2 + input.thicknessMm,
		minXMm: Math.min(input.start.xMm, input.end.xMm) * 2 - input.thicknessMm,
		minZMm: Math.min(input.start.zMm, input.end.zMm) * 2 - input.thicknessMm,
	};
}

function doubledDoorOpeningBounds(
	opening: Project["level"]["openings"][number],
	wall: WallSegment,
	start: { readonly xMm: number; readonly zMm: number },
	end: { readonly xMm: number; readonly zMm: number },
): Bounds | undefined {
	const horizontal = start.zMm === end.zMm;
	const vertical = start.xMm === end.xMm;
	if (!horizontal && !vertical) {
		return undefined;
	}
	const lengthMm = horizontal
		? Math.abs(end.xMm - start.xMm)
		: Math.abs(end.zMm - start.zMm);
	if (!Number.isSafeInteger(lengthMm) || lengthMm <= 0) {
		return undefined;
	}
	const interval = wallOpeningIntervalMm(opening);
	if (interval.startMm < 0 || interval.endMm > lengthMm) {
		return undefined;
	}
	const direction = horizontal
		? Math.sign(end.xMm - start.xMm)
		: Math.sign(end.zMm - start.zMm);
	if (direction === 0) {
		return undefined;
	}
	const intervalStart2 = opening.offsetMm * 2 - opening.widthMm;
	const intervalEnd2 = opening.offsetMm * 2 + opening.widthMm;
	if (horizontal) {
		const firstX2 = start.xMm * 2 + direction * intervalStart2;
		const secondX2 = start.xMm * 2 + direction * intervalEnd2;
		return {
			maxXMm: Math.max(firstX2, secondX2),
			maxZMm: start.zMm * 2 + wall.thicknessMm,
			minXMm: Math.min(firstX2, secondX2),
			minZMm: start.zMm * 2 - wall.thicknessMm,
		};
	}
	const firstZ2 = start.zMm * 2 + direction * intervalStart2;
	const secondZ2 = start.zMm * 2 + direction * intervalEnd2;
	return {
		maxXMm: start.xMm * 2 + wall.thicknessMm,
		maxZMm: Math.max(firstZ2, secondZ2),
		minXMm: start.xMm * 2 - wall.thicknessMm,
		minZMm: Math.min(firstZ2, secondZ2),
	};
}

function boundsPositivelyOverlap(first: Bounds, second: Bounds): boolean {
	return (
		first.minXMm < second.maxXMm &&
		first.maxXMm > second.minXMm &&
		first.minZMm < second.maxZMm &&
		first.maxZMm > second.minZMm
	);
}

function roomMatchesFace(
	room: Room,
	face: RectangularFace,
	context: Bounds | undefined,
): boolean {
	if (face.kind === "polygonal") {
		return room.faceFingerprint === face.key;
	}
	const grid2 =
		/^grid2:(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (grid2) {
		return grid2BoundsMatch(face, grid2);
	}
	const grid =
		/^grid:(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (grid) {
		return gridBoundsMatch(face, grid);
	}
	const loop =
		/^loop:(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (loop) {
		return gridBoundsMatch(face, loop);
	}
	const rectangular =
		/^rectangular:((?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (rectangular) {
		const [, widthRaw, depthRaw] = rectangular;
		return (
			equalInteger(widthRaw, face.bounds.maxXMm - face.bounds.minXMm) &&
			equalInteger(depthRaw, face.bounds.maxZMm - face.bounds.minZMm)
		);
	}
	const partition =
		/^partition:(vertical|horizontal):(left|right|top|bottom):((?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (!partition || !context) {
		return false;
	}
	const [, orientation, side, widthRaw, depthRaw, offsetRaw] = partition;
	if (
		!equalInteger(widthRaw, context.maxXMm - context.minXMm) ||
		!equalInteger(depthRaw, context.maxZMm - context.minZMm)
	) {
		return false;
	}
	const offsetMm = safeInteger(offsetRaw);
	if (offsetMm === undefined) {
		return false;
	}
	const expected = expectedPartitionBounds(
		orientation,
		side,
		context,
		offsetMm,
	);
	return expected !== undefined && sameBounds(expected, face.bounds);
}

function gridBoundsMatch(
	face: RectangularFace,
	match: RegExpExecArray,
): boolean {
	const [, minXRaw, maxXRaw, minZRaw, maxZRaw] = match;
	return (
		equalInteger(minXRaw, face.bounds.minXMm) &&
		equalInteger(maxXRaw, face.bounds.maxXMm) &&
		equalInteger(minZRaw, face.bounds.minZMm) &&
		equalInteger(maxZRaw, face.bounds.maxZMm)
	);
}

function grid2BoundsMatch(
	face: RectangularFace,
	match: RegExpExecArray,
): boolean {
	const [, minXRaw, maxXRaw, minZRaw, maxZRaw] = match;
	return (
		equalInteger(minXRaw, face.bounds.minXMm) &&
		equalInteger(maxXRaw, face.bounds.maxXMm) &&
		equalInteger(minZRaw, face.bounds.minZMm) &&
		equalInteger(maxZRaw, face.bounds.maxZMm)
	);
}

function expectedPartitionBounds(
	orientation: string | undefined,
	side: string | undefined,
	context: Bounds,
	offsetMm: number,
): Bounds | undefined {
	if (orientation === "vertical") {
		return side === "left"
			? { ...context, maxXMm: context.minXMm + offsetMm }
			: side === "right"
				? { ...context, minXMm: context.minXMm + offsetMm }
				: undefined;
	}
	if (orientation === "horizontal") {
		return side === "top"
			? { ...context, maxZMm: context.minZMm + offsetMm }
			: side === "bottom"
				? { ...context, minZMm: context.minZMm + offsetMm }
				: undefined;
	}
	return undefined;
}

function containsFace(
	container: RectangularFace,
	child: RectangularFace,
): boolean {
	if (sameFace(container, child)) {
		return true;
	}
	if (container.kind === "polygonal") {
		return faceBoundaryPoints(child).every((point) =>
			pointLiesOnPolygonBoundary(point, container.source.vertices),
		);
	}
	return (
		child.bounds.minXMm >= container.bounds.minXMm &&
		child.bounds.maxXMm <= container.bounds.maxXMm &&
		child.bounds.minZMm >= container.bounds.minZMm &&
		child.bounds.maxZMm <= container.bounds.maxZMm
	);
}

function faceBoundaryPoints(
	face: RectangularFace,
): readonly { readonly xMm: number; readonly zMm: number }[] {
	if (face.kind === "polygonal") return face.source.vertices;
	return [
		{ xMm: face.bounds.minXMm, zMm: face.bounds.minZMm },
		{ xMm: face.bounds.minXMm, zMm: face.bounds.maxZMm },
		{ xMm: face.bounds.maxXMm, zMm: face.bounds.minZMm },
		{ xMm: face.bounds.maxXMm, zMm: face.bounds.maxZMm },
	];
}

function pointLiesOnPolygonBoundary(
	point: { readonly xMm: number; readonly zMm: number },
	polygon: readonly { readonly xMm: number; readonly zMm: number }[],
): boolean {
	return polygon.some((start, index) => {
		const end = polygon[(index + 1) % polygon.length];
		if (end === undefined) return false;
		const orientation =
			BigInt(end.xMm - start.xMm) * BigInt(point.zMm - start.zMm) -
			BigInt(end.zMm - start.zMm) * BigInt(point.xMm - start.xMm);
		return (
			orientation === 0n &&
			point.xMm >= Math.min(start.xMm, end.xMm) &&
			point.xMm <= Math.max(start.xMm, end.xMm) &&
			point.zMm >= Math.min(start.zMm, end.zMm) &&
			point.zMm <= Math.max(start.zMm, end.zMm)
		);
	});
}

function sameFace(first: RectangularFace, second: RectangularFace): boolean {
	if (first.kind === "polygonal" || second.kind === "polygonal") {
		return first.kind === second.kind && first.key === second.key;
	}
	return (
		sameBounds(first.bounds, second.bounds) &&
		sameInsets(first.insets, second.insets)
	);
}

function sameInsets(first: FaceInsets, second: FaceInsets): boolean {
	return (
		first.minXMm === second.minXMm &&
		first.maxXMm === second.maxXMm &&
		first.minZMm === second.minZMm &&
		first.maxZMm === second.maxZMm
	);
}

function hasUniformInsets(face: RectangularFace): boolean {
	return (
		face.insets.minXMm === face.insets.maxXMm &&
		face.insets.minXMm === face.insets.minZMm &&
		face.insets.minXMm === face.insets.maxZMm
	);
}

function sameOpeningIds(
	actual: readonly string[],
	expected: readonly string[],
): boolean {
	if (actual.length !== expected.length) {
		return false;
	}
	const remaining = new Set(actual);
	return (
		remaining.size === actual.length &&
		expected.every((openingId) => remaining.delete(openingId)) &&
		remaining.size === 0
	);
}

function sameItemIds(
	expected: readonly string[],
	actual: readonly string[],
): boolean {
	return (
		expected.length === actual.length &&
		new Set(actual).size === actual.length &&
		expected.every((itemId) => actual.includes(itemId))
	);
}

function sameRoomIds(
	expected: readonly string[],
	actual: readonly string[],
): boolean {
	return (
		expected.length === actual.length &&
		new Set(actual).size === actual.length &&
		expected.every((roomId) => actual.includes(roomId))
	);
}

function sameBounds(first: Bounds, second: Bounds): boolean {
	return (
		first.minXMm === second.minXMm &&
		first.maxXMm === second.maxXMm &&
		first.minZMm === second.minZMm &&
		first.maxZMm === second.maxZMm
	);
}

function boundsContext(faces: readonly RectangularFace[]): Bounds | undefined {
	const first = faces[0]?.bounds;
	return first
		? faces.slice(1).reduce<Bounds>(
				(context, face) => ({
					maxXMm: Math.max(context.maxXMm, face.bounds.maxXMm),
					maxZMm: Math.max(context.maxZMm, face.bounds.maxZMm),
					minXMm: Math.min(context.minXMm, face.bounds.minXMm),
					minZMm: Math.min(context.minZMm, face.bounds.minZMm),
				}),
				first,
			)
		: undefined;
}

function defaultRoomHeight(faces: readonly PlannedTargetFace[]): number {
	const heights = faces.flatMap((face) =>
		face.contributors.map((source) => source.room.heightMm),
	);
	return heights.length === 0 ? DEFAULT_ROOM_HEIGHT_MM : Math.max(...heights);
}

function gridFingerprint(face: RectangularFace): string {
	if (face.kind === "polygonal") {
		return face.key;
	}
	const { bounds, insets } = face;
	return hasUniformInsets(face)
		? `grid:${bounds.minXMm}:${bounds.maxXMm}:${bounds.minZMm}:${bounds.maxZMm}:${insets.minXMm}`
		: `grid2:${bounds.minXMm}:${bounds.maxXMm}:${bounds.minZMm}:${bounds.maxZMm}:${insets.minXMm}:${insets.maxXMm}:${insets.minZMm}:${insets.maxZMm}`;
}

function faceKey(bounds: Bounds, insets: FaceInsets): string {
	return `${bounds.minXMm}:${bounds.maxXMm}:${bounds.minZMm}:${bounds.maxZMm}:${insets.minXMm}:${insets.maxXMm}:${insets.minZMm}:${insets.maxZMm}`;
}

function isPositiveBounds(bounds: Bounds): boolean {
	return (
		[bounds.minXMm, bounds.maxXMm, bounds.minZMm, bounds.maxZMm].every(
			Number.isSafeInteger,
		) &&
		bounds.minXMm < bounds.maxXMm &&
		bounds.minZMm < bounds.maxZMm
	);
}

function equalInteger(raw: string | undefined, expected: number): boolean {
	return safeInteger(raw) === expected;
}

function safeInteger(raw: string | undefined): number | undefined {
	if (!raw || !/^-?(?:0|[1-9]\d*)$/.test(raw)) {
		return undefined;
	}
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : undefined;
}

function coordinateKey(xMm: number, zMm: number): string {
	return `${xMm}:${zMm}`;
}

function compareFaces(first: RectangularFace, second: RectangularFace): number {
	return (
		first.bounds.minZMm - second.bounds.minZMm ||
		first.bounds.minXMm - second.bounds.minXMm ||
		first.bounds.maxZMm - second.bounds.maxZMm ||
		first.bounds.maxXMm - second.bounds.maxXMm ||
		first.insets.minXMm - second.insets.minXMm ||
		first.insets.maxXMm - second.insets.maxXMm ||
		first.insets.minZMm - second.insets.minZMm ||
		first.insets.maxZMm - second.insets.maxZMm
	);
}

function compareMaterializedFaces(
	first: MaterializedTargetFace,
	second: MaterializedTargetFace,
): number {
	return (
		compareFaces(first.face, second.face) ||
		compareText(first.room.roomId, second.room.roomId)
	);
}

function compareSourceRooms(first: SourceRoom, second: SourceRoom): number {
	return compareText(first.room.roomId, second.room.roomId);
}

function compareText(first: string, second: string): number {
	return first < second ? -1 : first > second ? 1 : 0;
}

function previewIds(): IdSource {
	let index = 0;
	return { next: () => `__general_wall_preview_${index++}` };
}

type RejectedMutation = {
	readonly kind: "rejected";
	readonly reasonCode: GeneralWallProjectMutationReason;
	readonly affected?: GeneralWallProjectMutationAffectedReference;
};

function reject(
	reasonCode: GeneralWallProjectMutationReason,
	affected?: GeneralWallProjectMutationAffectedReference,
): RejectedMutation {
	return affected === undefined
		? { kind: "rejected", reasonCode }
		: { affected, kind: "rejected", reasonCode };
}
