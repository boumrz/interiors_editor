import {
	type DerivedOrthogonalFace,
	deriveBoundedOrthogonalFaces,
} from "./derive-plan-faces";
import {
	absoluteExactMeasurement,
	addExactMeasurement,
	compareExactMeasurements,
	divideExactMeasurementByInteger,
	exactMeasurement,
	exactMeasurementToNumber,
	exactMeasurementWithSqrt2Factor,
	multiplyExactMeasurementByInteger,
	multiplyExactMeasurements,
	subtractExactMeasurements,
	type ExactMeasurement,
	type MeasurementValue,
} from "./exact-quadratic-surd";
import type { Project, Room, Vertex, WallSegment } from "./project";

/** A world-space outward normal for an axis-aligned wall segment. */
export interface AxisNormal {
	readonly x: -1 | 0 | 1;
	readonly z: -1 | 0 | 1;
}

/** Integer-millimetre rectangular tile used by the 2D and WebGL projections. */
export interface AxisAlignedRectMm {
	readonly maxXmm: number;
	readonly maxZmm: number;
	readonly minXmm: number;
	readonly minZmm: number;
}

/** Measurements derived from the usable Room boundary, never persisted. */
interface UsableFloorMetrics {
	readonly areaMm2: ExactMeasurement;
	readonly perimeterMm: ExactMeasurement;
}

/**
 * A room projection derived from the PlanGraph, never persisted as geometry.
 *
 * V1 only accepts rectangular bounded faces, but the plural tile fields keep
 * the read contract ready for a later non-rectangular decomposition without
 * making an envelope a second source of truth.
 */
export interface DerivedOrthogonalRoomFace {
	readonly boundaryWallSegmentIds: readonly string[];
	/** Present only when the canonical face is not safely representable as tiles. */
	readonly facePolygonMm?: readonly PlanFacePointMm[];
	readonly faceTilesMm: readonly AxisAlignedRectMm[];
	readonly heightMm: number;
	readonly roomId: string;
	readonly usableFloorAreaMm2: MeasurementValue;
	readonly usableFloorPerimeterMm: MeasurementValue;
	/** The inward-offset usable polygon for a non-rectangular canonical face. */
	readonly usableFloorPolygonMm?: readonly PlanFacePointMm[];
	readonly usableFloorTilesMm: readonly AxisAlignedRectMm[];
}

/** A disposable planar projection in canonical millimetres, never durable geometry. */
export interface PlanFacePointMm {
	readonly xMm: number;
	readonly zMm: number;
}

/**
 * A wall projection. Interior walls deliberately do not have an exterior
 * normal; the renderer can use this to make cutaway decisions from camera
 * direction without guessing from an enclosing envelope.
 */
export interface DerivedOrthogonalWall {
	readonly exteriorNormal?: AxisNormal;
	readonly heightMm: number;
	readonly wallSegmentId: string;
}

export interface DerivedOrthogonalPlanFaces {
	readonly rooms: readonly DerivedOrthogonalRoomFace[];
	readonly walls: readonly DerivedOrthogonalWall[];
}

export type ResolveOrthogonalPlanFacesResult =
	| { readonly kind: "accepted"; readonly plan: DerivedOrthogonalPlanFaces }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "EMPTY_PLAN"
				| "INVALID_ROOM_METADATA"
				| "PLAN_FACE_DERIVATION_REJECTED"
				| "ROOM_FACE_RECONCILIATION_FAILED"
				| "UNSUPPORTED_FACE_SHAPE"
				| "UNSUPPORTED_V1_TOPOLOGY"
				| "UNSUPPORTED_WALL_THICKNESS";
	  };

interface RectangularDerivedFace {
	readonly bounds: AxisAlignedRectMm;
	readonly insets: FaceInsets;
	readonly source: DerivedOrthogonalFace;
	readonly usableFloorMetrics: UsableFloorMetrics;
	readonly usableFloorTileMm: AxisAlignedRectMm;
}

interface PolygonalDerivedFace {
	readonly source: DerivedOrthogonalFace;
	readonly usableFloorMetrics: UsableFloorMetrics;
	readonly usableFloorPolygonMm: readonly PlanFacePointMm[];
}

interface BoundaryInsetEdge {
	readonly end: PlanFacePointMm;
	readonly start: PlanFacePointMm;
	readonly thicknessMm: number;
}

/** Exact counterpart of a disposable numeric point in the usable projection. */
interface ExactPlanFacePointMm extends PlanFacePointMm {
	readonly exactXMm: ExactMeasurement;
	readonly exactZMm: ExactMeasurement;
}

interface ShiftedInsetEdge {
	readonly deltaX: number;
	readonly deltaZ: number;
	readonly end: PlanFacePointMm;
	readonly insetMm: number;
	readonly point: ExactPlanFacePointMm;
	readonly start: PlanFacePointMm;
}

interface FaceInsets {
	readonly maxXmm: number;
	readonly maxZmm: number;
	readonly minXmm: number;
	readonly minZmm: number;
}

interface ResolvedRectangularRoomFace extends RectangularDerivedFace {
	readonly room: Room;
}

interface ResolvedPolygonalRoomFace extends PolygonalDerivedFace {
	readonly room: Room;
}

type RenderableDerivedFace = RectangularDerivedFace | PolygonalDerivedFace;
type ResolvedRoomFace = ResolvedRectangularRoomFace | ResolvedPolygonalRoomFace;

type ResolveFailure = Extract<
	ResolveOrthogonalPlanFacesResult,
	{ readonly kind: "rejected" }
>;

/**
 * Builds the current V1 planar-graph projection used by both 2D and 3D.
 *
 * Persisted `Room.faceFingerprint` values are reconciled against faces derived
 * from concrete vertices and walls; they never create or resize geometry. A
 * graph that cannot be proven to be a legacy rectangle, detached rectangles,
 * a complete constrained grid, or a simple alpha-direction polygon is
 * rejected instead of being rendered as a misleading global bounding box.
 */
export function resolveOrthogonalPlanFaces(
	project: Project,
): ResolveOrthogonalPlanFacesResult {
	if (
		project.level.wallSegments.length === 0 ||
		project.level.rooms.length === 0
	) {
		return reject("EMPTY_PLAN");
	}
	if (!hasSupportedWallThicknesses(project.level.wallSegments)) {
		return reject("UNSUPPORTED_WALL_THICKNESS");
	}
	if (!hasValidRooms(project.level.rooms)) {
		return reject("INVALID_ROOM_METADATA");
	}

	const derived = deriveBoundedOrthogonalFaces({
		vertices: project.level.vertices,
		wallSegments: project.level.wallSegments,
	});
	if (derived.kind === "rejected") {
		return reject("PLAN_FACE_DERIVATION_REJECTED");
	}
	if (derived.faces.length === 0) {
		return reject("EMPTY_PLAN");
	}
	if (derived.faces.length !== project.level.rooms.length) {
		return reject("ROOM_FACE_RECONCILIATION_FAILED");
	}

	const wallById = wallIndex(project.level.wallSegments);
	if (!wallById) {
		return reject("UNSUPPORTED_V1_TOPOLOGY");
	}
	const verticesById = vertexIndex(project.level.vertices);
	if (!verticesById) {
		return reject("UNSUPPORTED_V1_TOPOLOGY");
	}

	const renderableFaces: RenderableDerivedFace[] = [];
	for (const face of derived.faces) {
		const bounds = rectangleBoundsFor(face);
		const insets = bounds
			? faceInsetsFor(face, bounds, wallById, verticesById)
			: undefined;
		if (bounds && insets) {
			const usableFloorTileMm = usableFloorTileFor(bounds, insets);
			const usableFloorMetrics = usableFloorMetricsForTile(usableFloorTileMm);
			if (!hasUsableInterior(bounds, insets) || !usableFloorMetrics) {
				return reject("UNSUPPORTED_V1_TOPOLOGY");
			}
			renderableFaces.push({
				bounds,
				insets,
				source: face,
				usableFloorMetrics,
				usableFloorTileMm,
			});
			continue;
		}
		const polygon = polygonalFaceFor(face, wallById, verticesById);
		if (!polygon) {
			return reject("UNSUPPORTED_FACE_SHAPE");
		}
		renderableFaces.push(polygon);
	}

	const resolvedFaces = reconcileRooms(project.level.rooms, renderableFaces);
	if (!resolvedFaces) {
		return reject("ROOM_FACE_RECONCILIATION_FAILED");
	}

	const ownersByWallId = ownersForWalls(resolvedFaces);
	if (!ownersByWallId || !haveValidWallOwners(ownersByWallId)) {
		return reject("UNSUPPORTED_V1_TOPOLOGY");
	}

	// The canonical face walk has already proven every contact and cycle. Once
	// every bounded face is rectangular and matches one durable Room record,
	// it is a renderable plan — whether it forms a full grid, a T, or another
	// partial rectangular partition. Requiring a complete Cartesian grid here
	// made correctly closed rooms disappear from 2D and disabled 3D.

	const walls = resolveWalls(
		wallById,
		ownersByWallId,
		verticesById,
		Math.max(2600, ...resolvedFaces.map((face) => face.room.heightMm)),
	);
	if (!walls) {
		return reject("UNSUPPORTED_V1_TOPOLOGY");
	}
	return {
		kind: "accepted",
		plan: {
			rooms: resolvedFaces.map(roomFaceProjection).sort(compareRoomFaces),
			walls,
		},
	};
}

function hasSupportedWallThicknesses(walls: readonly WallSegment[]): boolean {
	return (
		walls.length > 0 &&
		walls.every(
			(wall) => Number.isSafeInteger(wall.thicknessMm) && wall.thicknessMm > 0,
		)
	);
}

function hasValidRooms(rooms: readonly Room[]): boolean {
	const roomIds = new Set<string>();
	for (const room of rooms) {
		if (
			!room.roomId ||
			roomIds.has(room.roomId) ||
			!room.faceFingerprint ||
			!Number.isSafeInteger(room.heightMm) ||
			room.heightMm <= 0
		) {
			return false;
		}
		roomIds.add(room.roomId);
	}
	return true;
}

function rectangleBoundsFor(
	face: DerivedOrthogonalFace,
): AxisAlignedRectMm | undefined {
	if (face.vertices.length !== 4) {
		return undefined;
	}
	const xCoordinates = face.vertices.map((vertex) => vertex.xMm);
	const zCoordinates = face.vertices.map((vertex) => vertex.zMm);
	const minXmm = Math.min(...xCoordinates);
	const maxXmm = Math.max(...xCoordinates);
	const minZmm = Math.min(...zCoordinates);
	const maxZmm = Math.max(...zCoordinates);
	const bounds = { maxXmm, maxZmm, minXmm, minZmm };
	if (!isPositiveRectangle(bounds)) {
		return undefined;
	}
	const expectedCorners = new Set([
		coordinateKey(minXmm, minZmm),
		coordinateKey(maxXmm, minZmm),
		coordinateKey(maxXmm, maxZmm),
		coordinateKey(minXmm, maxZmm),
	]);
	return face.vertices.every((vertex) =>
		expectedCorners.has(coordinateKey(vertex.xMm, vertex.zMm)),
	)
		? bounds
		: undefined;
}

function faceInsetsFor(
	face: DerivedOrthogonalFace,
	bounds: AxisAlignedRectMm,
	wallsById: ReadonlyMap<string, WallSegment>,
	verticesById: ReadonlyMap<string, Vertex>,
): FaceInsets | undefined {
	const values: { -readonly [K in keyof FaceInsets]?: number } = {};
	for (const wallSegmentId of face.boundaryWallSegmentIds) {
		const wall = wallsById.get(wallSegmentId);
		const start = wall ? verticesById.get(wall.startVertexId) : undefined;
		const end = wall ? verticesById.get(wall.endVertexId) : undefined;
		if (!wall || !start || !end || !hasSupportedWallThicknesses([wall])) {
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
	return values.minXmm !== undefined &&
		values.maxXmm !== undefined &&
		values.minZmm !== undefined &&
		values.maxZmm !== undefined
		? (values as FaceInsets)
		: undefined;
}

function wallSideForBounds(
	start: Vertex,
	end: Vertex,
	bounds: AxisAlignedRectMm,
): keyof FaceInsets | undefined {
	if (start.xMm === end.xMm) {
		return start.xMm === bounds.minXmm
			? "minXmm"
			: start.xMm === bounds.maxXmm
				? "maxXmm"
				: undefined;
	}
	if (start.zMm === end.zMm) {
		return start.zMm === bounds.minZmm
			? "minZmm"
			: start.zMm === bounds.maxZmm
				? "maxZmm"
				: undefined;
	}
	return undefined;
}

function isPositiveRectangle(bounds: AxisAlignedRectMm): boolean {
	return (
		Number.isSafeInteger(bounds.minXmm) &&
		Number.isSafeInteger(bounds.maxXmm) &&
		Number.isSafeInteger(bounds.minZmm) &&
		Number.isSafeInteger(bounds.maxZmm) &&
		bounds.minXmm < bounds.maxXmm &&
		bounds.minZmm < bounds.maxZmm
	);
}

function hasUsableInterior(
	bounds: AxisAlignedRectMm,
	insets: FaceInsets,
): boolean {
	return (
		2 * (bounds.maxXmm - bounds.minXmm) > insets.minXmm + insets.maxXmm &&
		2 * (bounds.maxZmm - bounds.minZmm) > insets.minZmm + insets.maxZmm
	);
}

function usableFloorTileFor(
	bounds: AxisAlignedRectMm,
	insets: FaceInsets,
): AxisAlignedRectMm {
	return {
		maxXmm: bounds.maxXmm - insets.maxXmm / 2,
		maxZmm: bounds.maxZmm - insets.maxZmm / 2,
		minXmm: bounds.minXmm + insets.minXmm / 2,
		minZmm: bounds.minZmm + insets.minZmm / 2,
	};
}

function usableFloorMetricsForTile(
	tile: AxisAlignedRectMm,
): UsableFloorMetrics | undefined {
	const widthMm = tile.maxXmm - tile.minXmm;
	const depthMm = tile.maxZmm - tile.minZmm;
	return Number.isFinite(widthMm) &&
		Number.isFinite(depthMm) &&
		Math.abs(widthMm) <= Number.MAX_SAFE_INTEGER &&
		Math.abs(depthMm) <= Number.MAX_SAFE_INTEGER &&
		widthMm > 0 &&
		depthMm > 0
		? usableFloorMetricsForExactAxisLengths(widthMm, depthMm)
		: undefined;
}

function usableFloorMetricsForExactAxisLengths(
	widthMm: number,
	depthMm: number,
): UsableFloorMetrics | undefined {
	const width = exactHalfMillimetres(widthMm);
	const depth = exactHalfMillimetres(depthMm);
	if (!width || !depth) return undefined;
	const areaMm2 = multiplyExactMeasurements(width, depth);
	const perimeterMm = multiplyExactMeasurementByInteger(
		addExactMeasurement(width, depth),
		2n,
	);
	return compareExactMeasurements(areaMm2, exactMeasurement(0n)) > 0 &&
		compareExactMeasurements(perimeterMm, exactMeasurement(0n)) > 0
		? { areaMm2, perimeterMm }
		: undefined;
}

function exactHalfMillimetres(valueMm: number): ExactMeasurement | undefined {
	const doubled = valueMm * 2;
	if (!Number.isSafeInteger(doubled)) return undefined;
	return exactMeasurement(BigInt(doubled), 0n, 2n);
}

function reconcileRooms(
	rooms: readonly Room[],
	faces: readonly RenderableDerivedFace[],
): readonly ResolvedRoomFace[] | undefined {
	const rectangularFaces = faces.filter(isRectangularDerivedFace);
	const context =
		rectangularFaces.length === 0 ? undefined : boundsContext(rectangularFaces);
	if (rectangularFaces.length > 0 && !context) return undefined;
	const matchedRoomIds = new Set<string>();
	const resolved: ResolvedRoomFace[] = [];
	for (const face of faces) {
		const matches = rooms.filter((room) =>
			isRectangularDerivedFace(face)
				? context !== undefined && roomMatchesFace(room, face, context)
				: room.faceFingerprint === face.source.fingerprint,
		);
		const room = matches.length === 1 ? matches[0] : undefined;
		if (!room || matchedRoomIds.has(room.roomId)) {
			return undefined;
		}
		matchedRoomIds.add(room.roomId);
		resolved.push({ ...face, room } as ResolvedRoomFace);
	}
	return matchedRoomIds.size === rooms.length ? resolved : undefined;
}

function isRectangularDerivedFace(
	face: RenderableDerivedFace | ResolvedRoomFace,
): face is RectangularDerivedFace | ResolvedRectangularRoomFace {
	return "bounds" in face;
}

function boundsContext(
	faces: readonly RectangularDerivedFace[],
): AxisAlignedRectMm | undefined {
	const first = faces[0]?.bounds;
	if (!first) {
		return undefined;
	}
	return faces.slice(1).reduce<AxisAlignedRectMm>(
		(context, face) => ({
			maxXmm: Math.max(context.maxXmm, face.bounds.maxXmm),
			maxZmm: Math.max(context.maxZmm, face.bounds.maxZmm),
			minXmm: Math.min(context.minXmm, face.bounds.minXmm),
			minZmm: Math.min(context.minZmm, face.bounds.minZmm),
		}),
		first,
	);
}

function roomMatchesFace(
	room: Room,
	face: RectangularDerivedFace,
	context: AxisAlignedRectMm,
): boolean {
	const { bounds } = face;
	const grid2 =
		/^grid2:(0|-?[1-9]\d*):(0|-?[1-9]\d*):(0|-?[1-9]\d*):(0|-?[1-9]\d*):([1-9]\d*):([1-9]\d*):([1-9]\d*):([1-9]\d*)$/.exec(
			room.faceFingerprint,
		);
	if (grid2) {
		const [, minXRaw, maxXRaw, minZRaw, maxZRaw] = grid2;
		return (
			equalIntegers(minXRaw, bounds.minXmm) &&
			equalIntegers(maxXRaw, bounds.maxXmm) &&
			equalIntegers(minZRaw, bounds.minZmm) &&
			equalIntegers(maxZRaw, bounds.maxZmm)
		);
	}
	const rectangular = /^rectangular:(\d+):(\d+):(\d+)$/.exec(
		room.faceFingerprint,
	);
	if (rectangular) {
		const [, widthRaw, depthRaw] = rectangular;
		return (
			equalIntegers(widthRaw, bounds.maxXmm - bounds.minXmm) &&
			equalIntegers(depthRaw, bounds.maxZmm - bounds.minZmm) &&
			sameBounds(bounds, context)
		);
	}

	const loop =
		/^loop:(0|-?[1-9]\d*):(0|-?[1-9]\d*):(0|-?[1-9]\d*):(0|-?[1-9]\d*):([1-9]\d*)$/.exec(
			room.faceFingerprint,
		);
	if (loop) {
		const [, minXRaw, maxXRaw, minZRaw, maxZRaw] = loop;
		return (
			equalIntegers(minXRaw, bounds.minXmm) &&
			equalIntegers(maxXRaw, bounds.maxXmm) &&
			equalIntegers(minZRaw, bounds.minZmm) &&
			equalIntegers(maxZRaw, bounds.maxZmm)
		);
	}

	const grid =
		/^grid:(0|-?[1-9]\d*):(0|-?[1-9]\d*):(0|-?[1-9]\d*):(0|-?[1-9]\d*):([1-9]\d*)$/.exec(
			room.faceFingerprint,
		);
	if (grid) {
		const [, minXRaw, maxXRaw, minZRaw, maxZRaw] = grid;
		return (
			equalIntegers(minXRaw, bounds.minXmm) &&
			equalIntegers(maxXRaw, bounds.maxXmm) &&
			equalIntegers(minZRaw, bounds.minZmm) &&
			equalIntegers(maxZRaw, bounds.maxZmm)
		);
	}

	const partition =
		/^partition:(vertical|horizontal):(left|right|top|bottom):(\d+):(\d+):(\d+):(\d+)$/.exec(
			room.faceFingerprint,
		);
	if (!partition) {
		return false;
	}
	const [, orientationRaw, sideRaw, widthRaw, depthRaw, offsetRaw] = partition;
	const orientation = partitionOrientation(orientationRaw);
	const side = partitionSide(sideRaw);
	if (!orientation || !side) {
		return false;
	}
	if (
		!equalIntegers(widthRaw, context.maxXmm - context.minXmm) ||
		!equalIntegers(depthRaw, context.maxZmm - context.minZmm)
	) {
		return false;
	}
	const offsetMm = Number(offsetRaw);
	if (!Number.isSafeInteger(offsetMm)) {
		return false;
	}
	const expected = partitionExpectedBounds(
		orientation,
		side,
		context,
		offsetMm,
	);
	return expected !== undefined && sameBounds(bounds, expected);
}

function partitionOrientation(
	value: string,
): "vertical" | "horizontal" | undefined {
	return value === "vertical" || value === "horizontal" ? value : undefined;
}

function partitionSide(
	value: string,
): "left" | "right" | "top" | "bottom" | undefined {
	return value === "left" ||
		value === "right" ||
		value === "top" ||
		value === "bottom"
		? value
		: undefined;
}

function partitionExpectedBounds(
	orientation: "vertical" | "horizontal",
	side: "left" | "right" | "top" | "bottom",
	context: AxisAlignedRectMm,
	offsetMm: number,
): AxisAlignedRectMm | undefined {
	if (orientation === "vertical") {
		if (side === "left") {
			return { ...context, maxXmm: context.minXmm + offsetMm };
		}
		if (side === "right") {
			return { ...context, minXmm: context.minXmm + offsetMm };
		}
		return undefined;
	}
	if (side === "top") {
		return { ...context, maxZmm: context.minZmm + offsetMm };
	}
	if (side === "bottom") {
		return { ...context, minZmm: context.minZmm + offsetMm };
	}
	return undefined;
}

function equalIntegers(raw: string, expected: number): boolean {
	const parsed = Number(raw);
	return Number.isSafeInteger(parsed) && parsed === expected;
}

function sameBounds(
	first: AxisAlignedRectMm,
	second: AxisAlignedRectMm,
): boolean {
	return (
		first.minXmm === second.minXmm &&
		first.maxXmm === second.maxXmm &&
		first.minZmm === second.minZmm &&
		first.maxZmm === second.maxZmm
	);
}

function wallIndex(
	walls: readonly WallSegment[],
): ReadonlyMap<string, WallSegment> | undefined {
	const indexed = new Map<string, WallSegment>();
	for (const wall of walls) {
		if (!wall.wallSegmentId || indexed.has(wall.wallSegmentId)) {
			return undefined;
		}
		indexed.set(wall.wallSegmentId, wall);
	}
	return indexed;
}

function ownersForWalls(
	faces: readonly ResolvedRoomFace[],
): ReadonlyMap<string, readonly ResolvedRoomFace[]> | undefined {
	const owners = new Map<string, ResolvedRoomFace[]>();
	for (const face of faces) {
		for (const wallSegmentId of face.source.boundaryWallSegmentIds) {
			const wallOwners = owners.get(wallSegmentId) ?? [];
			if (wallOwners.some((owner) => owner.room.roomId === face.room.roomId)) {
				return undefined;
			}
			wallOwners.push(face);
			owners.set(wallSegmentId, wallOwners);
		}
	}
	return owners;
}

function haveValidWallOwners(
	ownersByWallId: ReadonlyMap<string, readonly ResolvedRoomFace[]>,
): boolean {
	for (const owners of ownersByWallId.values()) {
		if (owners.length !== 1 && owners.length !== 2) {
			return false;
		}
	}
	return true;
}

function vertexIndex(
	vertices: readonly Vertex[],
): ReadonlyMap<string, Vertex> | undefined {
	const indexed = new Map<string, Vertex>();
	for (const vertex of vertices) {
		if (!vertex.vertexId || indexed.has(vertex.vertexId)) {
			return undefined;
		}
		indexed.set(vertex.vertexId, vertex);
	}
	return indexed;
}

function resolveWalls(
	wallById: ReadonlyMap<string, WallSegment>,
	ownersByWallId: ReadonlyMap<string, readonly ResolvedRoomFace[]>,
	verticesById: ReadonlyMap<string, Vertex>,
	detachedWallHeightMm: number,
): readonly DerivedOrthogonalWall[] | undefined {
	const walls: DerivedOrthogonalWall[] = [];
	for (const [wallSegmentId, wall] of wallById) {
		const owners = ownersByWallId.get(wallSegmentId) ?? [];
		if (owners.length === 0) {
			walls.push({ heightMm: detachedWallHeightMm, wallSegmentId });
			continue;
		}
		const heightMm = Math.max(...owners.map((owner) => owner.room.heightMm));
		if (owners.length === 2) {
			walls.push({ heightMm, wallSegmentId });
			continue;
		}
		const owner = owners[0];
		const normal = owner
			? isRectangularDerivedFace(owner)
				? exteriorNormalFor(owner.bounds, wall, verticesById)
				: exteriorNormalForFaceEdge(owner.source, wall, verticesById)
			: undefined;
		if (!normal) {
			return undefined;
		}
		walls.push({ exteriorNormal: normal, heightMm, wallSegmentId });
	}
	return walls.sort((first, second) =>
		compareText(first.wallSegmentId, second.wallSegmentId),
	);
}

function exteriorNormalFor(
	bounds: AxisAlignedRectMm | undefined,
	wall: WallSegment,
	verticesById: ReadonlyMap<string, Vertex>,
): AxisNormal | undefined {
	if (!bounds) {
		return undefined;
	}
	const start = verticesById.get(wall.startVertexId);
	const end = verticesById.get(wall.endVertexId);
	if (!start || !end) {
		return undefined;
	}
	// The PlanGraph face has already proven the segment bounds; at this point
	// only the rectangular side identifies its observer-relative exterior.
	if (start.xMm === end.xMm) {
		if (start.xMm === bounds.minXmm) {
			return { x: -1, z: 0 };
		}
		if (start.xMm === bounds.maxXmm) {
			return { x: 1, z: 0 };
		}
		return undefined;
	}
	if (start.zMm === end.zMm) {
		if (start.zMm === bounds.minZmm) {
			return { x: 0, z: -1 };
		}
		if (start.zMm === bounds.maxZmm) {
			return { x: 0, z: 1 };
		}
	}
	return undefined;
}

function exteriorNormalForFaceEdge(
	face: DerivedOrthogonalFace,
	wall: WallSegment,
	verticesById: ReadonlyMap<string, Vertex>,
): AxisNormal | undefined {
	const start = verticesById.get(wall.startVertexId);
	const end = verticesById.get(wall.endVertexId);
	if (!start || !end) return undefined;
	for (let index = 0; index < face.vertices.length; index += 1) {
		const first = face.vertices[index];
		const second = face.vertices[(index + 1) % face.vertices.length];
		if (
			!first ||
			!second ||
			!pointIsOnSegment(start, first, second) ||
			!pointIsOnSegment(end, first, second)
		) {
			continue;
		}
		const winding = signedTwiceArea(face.vertices);
		if (winding === 0) return undefined;
		const outwardMultiplier = winding > 0 ? 1 : -1;
		return {
			x: axisSign((second.zMm - first.zMm) * outwardMultiplier),
			z: axisSign((first.xMm - second.xMm) * outwardMultiplier),
		};
	}
	return undefined;
}

function roomFaceProjection(face: ResolvedRoomFace): DerivedOrthogonalRoomFace {
	if (!isRectangularDerivedFace(face)) {
		return {
			boundaryWallSegmentIds: [...face.source.boundaryWallSegmentIds].sort(
				compareText,
			),
			facePolygonMm: face.source.vertices.map(copyPoint),
			faceTilesMm: [],
			heightMm: face.room.heightMm,
			roomId: face.room.roomId,
			usableFloorAreaMm2: face.usableFloorMetrics.areaMm2,
			usableFloorPerimeterMm: face.usableFloorMetrics.perimeterMm,
			usableFloorPolygonMm: face.usableFloorPolygonMm.map(copyPoint),
			usableFloorTilesMm: [],
		};
	}
	return {
		boundaryWallSegmentIds: [...face.source.boundaryWallSegmentIds].sort(
			compareText,
		),
		faceTilesMm: [face.bounds],
		heightMm: face.room.heightMm,
		roomId: face.room.roomId,
		usableFloorAreaMm2: face.usableFloorMetrics.areaMm2,
		usableFloorPerimeterMm: face.usableFloorMetrics.perimeterMm,
		usableFloorTilesMm: [face.usableFloorTileMm],
	};
}

function polygonalFaceFor(
	face: DerivedOrthogonalFace,
	wallsById: ReadonlyMap<string, WallSegment>,
	verticesById: ReadonlyMap<string, Vertex>,
): PolygonalDerivedFace | undefined {
	if (face.vertices.length < 3) {
		return undefined;
	}
	const boundaryEdges: BoundaryInsetEdge[] = [];
	for (let index = 0; index < face.vertices.length; index += 1) {
		const first = face.vertices[index];
		const second = face.vertices[(index + 1) % face.vertices.length];
		if (!first || !second) return undefined;
		const pieces = boundaryPiecesForFaceEdge(
			first,
			second,
			face.boundaryWallSegmentIds,
			wallsById,
			verticesById,
		);
		if (!pieces) return undefined;
		boundaryEdges.push(...pieces);
	}
	const usableFloorPolygonMm = insetSimplePolygon(face.vertices, boundaryEdges);
	const usableFloorMetrics = usableFloorPolygonMm
		? usableFloorMetricsForPolygon(usableFloorPolygonMm)
		: undefined;
	return usableFloorPolygonMm && usableFloorMetrics
		? { source: face, usableFloorMetrics, usableFloorPolygonMm }
		: undefined;
}

function usableFloorMetricsForPolygon(
	polygon: readonly ExactPlanFacePointMm[],
): UsableFloorMetrics | undefined {
	let signedTwiceAreaMm2 = exactMeasurement(0n);
	let perimeterMm = exactMeasurement(0n);
	for (let index = 0; index < polygon.length; index += 1) {
		const first = polygon[index];
		const second = polygon[(index + 1) % polygon.length];
		if (!first || !second) return undefined;
		signedTwiceAreaMm2 = addExactMeasurement(
			signedTwiceAreaMm2,
			subtractExactMeasurements(
				multiplyExactMeasurements(first.exactXMm, second.exactZMm),
				multiplyExactMeasurements(first.exactZMm, second.exactXMm),
			),
		);
		const segmentLength = exactLengthForAlphaDirection(first, second);
		if (!segmentLength) return undefined;
		perimeterMm = addExactMeasurement(perimeterMm, segmentLength);
	}
	const areaMm2 = divideExactMeasurementByInteger(
		absoluteExactMeasurement(signedTwiceAreaMm2),
		2n,
	);
	return compareExactMeasurements(areaMm2, exactMeasurement(0n)) > 0 &&
		compareExactMeasurements(perimeterMm, exactMeasurement(0n)) > 0
		? { areaMm2, perimeterMm }
		: undefined;
}

function exactLengthForAlphaDirection(
	first: ExactPlanFacePointMm,
	second: ExactPlanFacePointMm,
): ExactMeasurement | undefined {
	const deltaX = subtractExactMeasurements(second.exactXMm, first.exactXMm);
	const deltaZ = subtractExactMeasurements(second.exactZMm, first.exactZMm);
	const zero = exactMeasurement(0n);
	if (compareExactMeasurements(deltaX, zero) === 0) {
		return absoluteExactMeasurement(deltaZ);
	}
	if (compareExactMeasurements(deltaZ, zero) === 0) {
		return absoluteExactMeasurement(deltaX);
	}
	if (
		compareExactMeasurements(
			absoluteExactMeasurement(deltaX),
			absoluteExactMeasurement(deltaZ),
		) === 0
	) {
		return exactMeasurementWithSqrt2Factor(absoluteExactMeasurement(deltaX));
	}
	return undefined;
}

function boundaryPiecesForFaceEdge(
	first: PlanFacePointMm,
	second: PlanFacePointMm,
	boundaryWallSegmentIds: readonly string[],
	wallsById: ReadonlyMap<string, WallSegment>,
	verticesById: ReadonlyMap<string, Vertex>,
): readonly BoundaryInsetEdge[] | undefined {
	const pieces = boundaryWallSegmentIds
		.flatMap((wallSegmentId) => {
			const wall = wallsById.get(wallSegmentId);
			const start = wall ? verticesById.get(wall.startVertexId) : undefined;
			const end = wall ? verticesById.get(wall.endVertexId) : undefined;
			if (
				!wall ||
				!start ||
				!end ||
				!pointIsOnSegment(start, first, second) ||
				!pointIsOnSegment(end, first, second)
			) {
				return [];
			}
			const startDistance = squaredDistance(first, start);
			const endDistance = squaredDistance(first, end);
			return [
				startDistance <= endDistance
					? {
							end: copyPoint(end),
							start: copyPoint(start),
							thicknessMm: wall.thicknessMm,
						}
					: {
							end: copyPoint(start),
							start: copyPoint(end),
							thicknessMm: wall.thicknessMm,
						},
			];
		})
		.sort(
			(firstPiece, secondPiece) =>
				squaredDistance(first, firstPiece.start) -
				squaredDistance(first, secondPiece.start),
		);
	if (
		pieces.length === 0 ||
		pieces.some(
			(piece) =>
				!Number.isSafeInteger(piece.thicknessMm) || piece.thicknessMm <= 0,
		) ||
		!samePoint(pieces[0]?.start, first) ||
		!samePoint(pieces.at(-1)?.end, second) ||
		pieces.some(
			(piece, index) =>
				index > 0 && !samePoint(pieces[index - 1]?.end, piece.start),
		)
	) {
		return undefined;
	}
	return pieces;
}

function insetSimplePolygon(
	vertices: readonly PlanFacePointMm[],
	boundaryEdges: readonly BoundaryInsetEdge[],
): readonly ExactPlanFacePointMm[] | undefined {
	if (vertices.length < 3 || boundaryEdges.length < vertices.length) {
		return undefined;
	}
	const orientation = signedTwiceArea(vertices);
	if (!Number.isFinite(orientation) || orientation === 0) return undefined;
	const inwardNormalSign = orientation > 0 ? 1 : -1;
	const shiftedEdges = boundaryEdges.map((edge) =>
		shiftedInsetEdgeFor(edge, inwardNormalSign),
	);
	if (shiftedEdges.some((edge) => edge === undefined)) return undefined;
	const resolvedEdges = shiftedEdges as readonly ShiftedInsetEdge[];
	const inset: ExactPlanFacePointMm[] = [];
	for (let index = 0; index < resolvedEdges.length; index += 1) {
		const edge = resolvedEdges[index];
		const previous =
			resolvedEdges[(index + resolvedEdges.length - 1) % resolvedEdges.length];
		if (!edge || !previous || !samePoint(previous.end, edge.start)) {
			return undefined;
		}
		const previousEnd = exactPointOffset(
			previous.point,
			previous.deltaX,
			previous.deltaZ,
		);
		if (!previousEnd) return undefined;
		const cross = previous.deltaX * edge.deltaZ - previous.deltaZ * edge.deltaX;
		if (Math.abs(cross) < 1e-9) {
			const sameDirection =
				previous.deltaX * edge.deltaX + previous.deltaZ * edge.deltaZ > 0;
			if (!sameDirection) return undefined;
			if (!samePoint(previousEnd, edge.point)) inset.push(previousEnd);
			inset.push(edge.point);
			continue;
		}
		const intersection = exactLineIntersection(previous, edge);
		if (!intersection) return undefined;
		const miterLengthMm = Math.hypot(
			intersection.xMm - edge.start.xMm,
			intersection.zMm - edge.start.zMm,
		);
		const miterCapMm = 4 * Math.max(previous.insetMm, edge.insetMm);
		if (miterLengthMm <= miterCapMm + 1e-9) {
			inset.push(intersection);
		} else {
			inset.push(previousEnd, edge.point);
		}
	}
	if (inset.length < 3 || !inset.every(isFinitePoint)) return undefined;
	const resolvedInset = withoutRedundantCollinearPoints(
		inset.filter((point, index) => !samePoint(inset[index - 1], point)),
	);
	const insetArea = signedTwiceArea(resolvedInset);
	return insetArea !== 0 &&
		Math.sign(insetArea) === Math.sign(orientation) &&
		Math.abs(insetArea) < Math.abs(orientation) &&
		isSimplePolygon(resolvedInset) &&
		resolvedInset.every((point) => pointIsInsideOrOnPolygon(point, vertices))
		? resolvedInset
		: undefined;
}

function shiftedInsetEdgeFor(
	edge: BoundaryInsetEdge,
	inwardNormalSign: -1 | 1,
): ShiftedInsetEdge | undefined {
	const deltaX = edge.end.xMm - edge.start.xMm;
	const deltaZ = edge.end.zMm - edge.start.zMm;
	if (
		!Number.isSafeInteger(deltaX) ||
		!Number.isSafeInteger(deltaZ) ||
		(deltaX === 0 && deltaZ === 0)
	) {
		return undefined;
	}
	const insetMm = edge.thicknessMm / 2;
	if (!Number.isFinite(insetMm) || insetMm <= 0) return undefined;
	const startX = exactMeasurement(BigInt(edge.start.xMm));
	const startZ = exactMeasurement(BigInt(edge.start.zMm));
	let shiftX: ExactMeasurement;
	let shiftZ: ExactMeasurement;
	if (deltaX === 0) {
		shiftX = exactMeasurement(
			-BigInt(inwardNormalSign * axisSign(deltaZ) * edge.thicknessMm),
			0n,
			2n,
		);
		shiftZ = exactMeasurement(0n);
	} else if (deltaZ === 0) {
		shiftX = exactMeasurement(0n);
		shiftZ = exactMeasurement(
			BigInt(inwardNormalSign * axisSign(deltaX) * edge.thicknessMm),
			0n,
			2n,
		);
	} else if (Math.abs(deltaX) === Math.abs(deltaZ)) {
		shiftX = exactMeasurement(
			0n,
			-BigInt(inwardNormalSign * axisSign(deltaZ) * edge.thicknessMm),
			4n,
		);
		shiftZ = exactMeasurement(
			0n,
			BigInt(inwardNormalSign * axisSign(deltaX) * edge.thicknessMm),
			4n,
		);
	} else {
		return undefined;
	}
	const point = exactPoint(
		addExactMeasurement(startX, shiftX),
		addExactMeasurement(startZ, shiftZ),
	);
	return point
		? { deltaX, deltaZ, end: edge.end, insetMm, point, start: edge.start }
		: undefined;
}

function exactPoint(
	exactXMm: ExactMeasurement,
	exactZMm: ExactMeasurement,
): ExactPlanFacePointMm | undefined {
	const xMm = exactMeasurementToNumber(exactXMm);
	const zMm = exactMeasurementToNumber(exactZMm);
	return Number.isFinite(xMm) && Number.isFinite(zMm)
		? { exactXMm, exactZMm, xMm, zMm }
		: undefined;
}

function exactPointOffset(
	point: ExactPlanFacePointMm,
	deltaX: number,
	deltaZ: number,
): ExactPlanFacePointMm | undefined {
	return exactPoint(
		addExactMeasurement(point.exactXMm, exactMeasurement(BigInt(deltaX))),
		addExactMeasurement(point.exactZMm, exactMeasurement(BigInt(deltaZ))),
	);
}

function withoutRedundantCollinearPoints(
	points: readonly ExactPlanFacePointMm[],
): readonly ExactPlanFacePointMm[] {
	let resolved = [...points];
	let changed = true;
	while (changed && resolved.length >= 3) {
		changed = false;
		const next = resolved.filter((point, index) => {
			const previous =
				resolved[(index + resolved.length - 1) % resolved.length];
			const following = resolved[(index + 1) % resolved.length];
			if (!previous || !following) return false;
			const incomingX = point.xMm - previous.xMm;
			const incomingZ = point.zMm - previous.zMm;
			const outgoingX = following.xMm - point.xMm;
			const outgoingZ = following.zMm - point.zMm;
			const cross = incomingX * outgoingZ - incomingZ * outgoingX;
			const dot = incomingX * outgoingX + incomingZ * outgoingZ;
			const keep = Math.abs(cross) >= 1e-9 || dot <= 0;
			if (!keep) changed = true;
			return keep;
		});
		resolved = next;
	}
	return resolved;
}

function squaredDistance(
	first: PlanFacePointMm,
	second: PlanFacePointMm,
): number {
	const deltaX = second.xMm - first.xMm;
	const deltaZ = second.zMm - first.zMm;
	return deltaX * deltaX + deltaZ * deltaZ;
}

function samePoint(
	first: PlanFacePointMm | undefined,
	second: PlanFacePointMm | undefined,
): boolean {
	return (
		first !== undefined &&
		second !== undefined &&
		Math.abs(first.xMm - second.xMm) < 1e-9 &&
		Math.abs(first.zMm - second.zMm) < 1e-9
	);
}

function isSimplePolygon(vertices: readonly PlanFacePointMm[]): boolean {
	for (let firstIndex = 0; firstIndex < vertices.length; firstIndex += 1) {
		const firstStart = vertices[firstIndex];
		const firstEnd = vertices[(firstIndex + 1) % vertices.length];
		if (!firstStart || !firstEnd) return false;
		for (
			let secondIndex = firstIndex + 1;
			secondIndex < vertices.length;
			secondIndex += 1
		) {
			const adjacent =
				secondIndex === firstIndex + 1 ||
				(firstIndex === 0 && secondIndex === vertices.length - 1);
			if (adjacent) continue;
			const secondStart = vertices[secondIndex];
			const secondEnd = vertices[(secondIndex + 1) % vertices.length];
			if (
				!secondStart ||
				!secondEnd ||
				segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)
			) {
				return false;
			}
		}
	}
	return true;
}

function pointIsInsideOrOnPolygon(
	point: PlanFacePointMm,
	polygon: readonly PlanFacePointMm[],
): boolean {
	let inside = false;
	for (let index = 0; index < polygon.length; index += 1) {
		const first = polygon[index];
		const second = polygon[(index + 1) % polygon.length];
		if (!first || !second) return false;
		if (pointIsOnSegment(point, first, second)) return true;
		if (
			first.zMm > point.zMm !== second.zMm > point.zMm &&
			point.xMm <
				((second.xMm - first.xMm) * (point.zMm - first.zMm)) /
					(second.zMm - first.zMm) +
					first.xMm
		) {
			inside = !inside;
		}
	}
	return inside;
}

function segmentsIntersect(
	firstStart: PlanFacePointMm,
	firstEnd: PlanFacePointMm,
	secondStart: PlanFacePointMm,
	secondEnd: PlanFacePointMm,
): boolean {
	const firstSideStart = crossProduct(firstStart, firstEnd, secondStart);
	const firstSideEnd = crossProduct(firstStart, firstEnd, secondEnd);
	const secondSideStart = crossProduct(secondStart, secondEnd, firstStart);
	const secondSideEnd = crossProduct(secondStart, secondEnd, firstEnd);
	if (
		Math.sign(firstSideStart) !== Math.sign(firstSideEnd) &&
		Math.sign(secondSideStart) !== Math.sign(secondSideEnd)
	) {
		return true;
	}
	return (
		(firstSideStart === 0 &&
			pointIsOnSegment(secondStart, firstStart, firstEnd)) ||
		(firstSideEnd === 0 && pointIsOnSegment(secondEnd, firstStart, firstEnd)) ||
		(secondSideStart === 0 &&
			pointIsOnSegment(firstStart, secondStart, secondEnd)) ||
		(secondSideEnd === 0 && pointIsOnSegment(firstEnd, secondStart, secondEnd))
	);
}

function pointIsOnSegment(
	point: PlanFacePointMm,
	start: PlanFacePointMm,
	end: PlanFacePointMm,
): boolean {
	return (
		crossProduct(start, end, point) === 0 &&
		point.xMm >= Math.min(start.xMm, end.xMm) &&
		point.xMm <= Math.max(start.xMm, end.xMm) &&
		point.zMm >= Math.min(start.zMm, end.zMm) &&
		point.zMm <= Math.max(start.zMm, end.zMm)
	);
}

function crossProduct(
	start: PlanFacePointMm,
	end: PlanFacePointMm,
	point: PlanFacePointMm,
): number {
	return (
		(end.xMm - start.xMm) * (point.zMm - start.zMm) -
		(end.zMm - start.zMm) * (point.xMm - start.xMm)
	);
}

function exactLineIntersection(
	first: ShiftedInsetEdge,
	second: ShiftedInsetEdge,
): ExactPlanFacePointMm | undefined {
	const determinant =
		BigInt(first.deltaX) * BigInt(second.deltaZ) -
		BigInt(first.deltaZ) * BigInt(second.deltaX);
	if (determinant === 0n) {
		const sameDirection =
			first.deltaX * second.deltaX + first.deltaZ * second.deltaZ > 0;
		return sameDirection && first.insetMm === second.insetMm
			? second.point
			: undefined;
	}
	const differenceX = subtractExactMeasurements(
		second.point.exactXMm,
		first.point.exactXMm,
	);
	const differenceZ = subtractExactMeasurements(
		second.point.exactZMm,
		first.point.exactZMm,
	);
	const scale = divideExactMeasurementByInteger(
		subtractExactMeasurements(
			multiplyExactMeasurementByInteger(
				differenceX,
				BigInt(second.deltaZ),
			),
			multiplyExactMeasurementByInteger(
				differenceZ,
				BigInt(second.deltaX),
			),
		),
		determinant,
	);
	return exactPoint(
		addExactMeasurement(
			first.point.exactXMm,
			multiplyExactMeasurementByInteger(scale, BigInt(first.deltaX)),
		),
		addExactMeasurement(
			first.point.exactZMm,
			multiplyExactMeasurementByInteger(scale, BigInt(first.deltaZ)),
		),
	);
}

function signedTwiceArea(points: readonly PlanFacePointMm[]): number {
	let twiceArea = 0;
	for (let index = 0; index < points.length; index += 1) {
		const first = points[index];
		const second = points[(index + 1) % points.length];
		if (!first || !second) return Number.NaN;
		twiceArea += first.xMm * second.zMm - first.zMm * second.xMm;
	}
	return twiceArea;
}

function isFinitePoint(
	point: PlanFacePointMm | undefined,
): point is PlanFacePointMm {
	return Boolean(
		point && Number.isFinite(point.xMm) && Number.isFinite(point.zMm),
	);
}

function axisSign(value: number): -1 | 0 | 1 {
	return value < 0 ? -1 : value > 0 ? 1 : 0;
}

function copyPoint(point: PlanFacePointMm): PlanFacePointMm {
	return { xMm: point.xMm, zMm: point.zMm };
}

function compareRoomFaces(
	first: DerivedOrthogonalRoomFace,
	second: DerivedOrthogonalRoomFace,
): number {
	const firstBounds = first.faceTilesMm[0];
	const secondBounds = second.faceTilesMm[0];
	if (!firstBounds || !secondBounds) {
		return compareText(first.roomId, second.roomId);
	}
	return (
		firstBounds.minZmm - secondBounds.minZmm ||
		firstBounds.minXmm - secondBounds.minXmm ||
		firstBounds.maxZmm - secondBounds.maxZmm ||
		firstBounds.maxXmm - secondBounds.maxXmm ||
		compareText(first.roomId, second.roomId)
	);
}

function coordinateKey(xMm: number, zMm: number): string {
	return `${xMm}:${zMm}`;
}

function compareText(first: string, second: string): number {
	return first < second ? -1 : first > second ? 1 : 0;
}

function reject(reasonCode: ResolveFailure["reasonCode"]): ResolveFailure {
	return { kind: "rejected", reasonCode };
}
