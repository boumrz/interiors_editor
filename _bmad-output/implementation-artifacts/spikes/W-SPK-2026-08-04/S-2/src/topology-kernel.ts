/**
 * Disposable S-2 evidence kernel.
 *
 * This module deliberately models only candidate topology behavior. It is not
 * production code and does not decide the unresolved Product/UX/Architecture
 * policies recorded in the geometry contract.
 */

export type PointMm = {
  xMm: number;
  zMm: number;
};

export type Vertex = PointMm & {
  id: string;
};

export type WallSegment = {
  id: string;
  startVertexId: string;
  endVertexId: string;
  thicknessMm: number;
};

export type Revision = {
  schemaVersion: 1;
  vertices: readonly Vertex[];
  walls: readonly WallSegment[];
};

export type ReasonCode =
  | "ZERO_LENGTH"
  | "DUPLICATE_SEGMENT"
  | "UNSUPPORTED_DIRECTION"
  | "AMBIGUOUS_INTERSECTION"
  | "COLLINEAR_OVERLAP"
  | "INVALID_DIMENSION"
  | "PROJECT_BOUNDS_EXCEEDED"
  | "POLICY_REQUIRED"
  | "MERGE_NOT_COLLINEAR"
  | "WALL_NOT_FOUND"
  | "ROOM_IDENTITY_AMBIGUOUS"
  | "OPENING_OUT_OF_BOUNDS"
  | "SERIALIZATION_INVALID";

export type CreateRectangleCommand = {
  kind: "CreateRectangle";
  innerWidthMm: number;
  innerDepthMm: number;
  wallThicknessMm: number;
};

export type AddWallSegmentCommand = {
  kind: "AddWallSegment";
  wallId: string;
  start: PointMm;
  end: PointMm;
  thicknessMm: number;
  /** Explicit experiment input. It is not an adopted product policy. */
  xIntersectionPolicy: "reject" | "split";
};

export type MergeCollinearSegmentsCommand = {
  kind: "MergeCollinearSegments";
  firstWallId: string;
  secondWallId: string;
  mergedWallId: string;
  /** Automatic merge stays forbidden in the experiment. */
  mergePolicy: "manual-only";
};

export type TopologyCommand =
  | CreateRectangleCommand
  | AddWallSegmentCommand
  | MergeCollinearSegmentsCommand;

export type DerivedFace = {
  faceFingerprint: string;
  boundaryVertexIds: readonly string[];
  areaMm2: number;
  usableWidthMm?: number;
  usableDepthMm?: number;
};

export type RestoreRevisionInverse = {
  kind: "RestoreRevision";
  revision: Revision;
};

export type RejectedResult = {
  ok: false;
  revision: Revision;
  reason: ReasonCode;
};

export type ValidatedResult = {
  ok: true;
  revision: Revision;
  derivedFaces: readonly DerivedFace[];
  inverse: RestoreRevisionInverse;
};

export type ApplyResult = RejectedResult | ValidatedResult;

export type DeserializeResult =
  | { ok: true; revision: Revision }
  | { ok: false; reason: "SERIALIZATION_INVALID" };

export type RoomIdentityCandidate = {
  roomId: string;
  faceFingerprint: string;
};

export type RoomReconciliationCandidate =
  | { kind: "matched"; inheritedRoomIds: readonly string[] }
  | {
      kind: "ambiguous";
      reason: "ROOM_IDENTITY_AMBIGUOUS";
      inheritedRoomIds: readonly string[];
    };

export type OpeningInput = {
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  sillMm: number;
};

export type OpeningFitInput = {
  wallLengthMm: number;
  adjacentRoomHeightsMm: readonly [number, number];
  opening: OpeningInput;
};

export type OpeningFitResult =
  | {
      ok: true;
      wallHeightMm: number;
      openingHeightLimitMm: number;
    }
  | { ok: false; reason: "OPENING_OUT_OF_BOUNDS" };

const MAX_ABSOLUTE_COORDINATE_MM = 100_000;
const MIN_WALL_LENGTH_MM = 50;
const MIN_WALL_THICKNESS_MM = 20;
const MAX_WALL_THICKNESS_MM = 1_000;

type Intersection =
  | { kind: "none" }
  | { kind: "collinear-overlap" }
  | { kind: "non-integer" }
  | { kind: "point"; point: PointMm };

type SplitByWallId = ReadonlyMap<string, readonly PointMm[]>;

type HalfEdge = {
  key: string;
  wallId: string;
  fromVertexId: string;
  toVertexId: string;
};

export const createEmptyRevision = (): Revision => freezeRevision({
  schemaVersion: 1,
  vertices: [],
  walls: [],
});

export const applyCommand = (revision: Revision, command: unknown): ApplyResult => {
  if (!isRevisionLike(revision)) {
    return reject(createEmptyRevision(), "SERIALIZATION_INVALID");
  }

  if (!isRecord(command) || typeof command.kind !== "string") {
    return reject(revision, "POLICY_REQUIRED");
  }

  if (command.kind === "CreateRectangle") {
    return applyCreateRectangle(revision, command);
  }

  if (command.kind === "AddWallSegment") {
    return applyAddWallSegment(revision, command);
  }

  if (command.kind === "MergeCollinearSegments") {
    return applyMergeCollinearSegments(revision, command);
  }

  return reject(revision, "POLICY_REQUIRED");
};

export const applyInverse = (inverse: RestoreRevisionInverse): Revision => inverse.revision;

export const serializeRevision = (revision: Revision): string => {
  const vertices = [...revision.vertices]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, xMm, zMm }) => ({ id, xMm, zMm }));
  const walls = [...revision.walls]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, startVertexId, endVertexId, thicknessMm }) => ({
      id,
      startVertexId,
      endVertexId,
      thicknessMm,
    }));

  return JSON.stringify({ schemaVersion: 1, vertices, walls });
};

export const deserializeRevision = (serialized: string): DeserializeResult => {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.vertices) || !Array.isArray(parsed.walls)) {
      return { ok: false, reason: "SERIALIZATION_INVALID" };
    }

    const vertices = parsed.vertices.map(parseVertex);
    const walls = parsed.walls.map(parseWall);
    if (vertices.some((vertex) => vertex === undefined) || walls.some((wall) => wall === undefined)) {
      return { ok: false, reason: "SERIALIZATION_INVALID" };
    }

    const revision = freezeRevision({
      schemaVersion: 1,
      vertices: vertices as Vertex[],
      walls: walls as WallSegment[],
    });
    if (validateRevision(revision) !== undefined) {
      return { ok: false, reason: "SERIALIZATION_INVALID" };
    }

    return { ok: true, revision };
  } catch {
    return { ok: false, reason: "SERIALIZATION_INVALID" };
  }
};

export const reconcileRoomIdentityCandidates = (
  previousRooms: readonly RoomIdentityCandidate[],
  nextFaces: readonly DerivedFace[],
): RoomReconciliationCandidate => {
  const previousRoom = previousRooms[0];
  const nextFace = nextFaces[0];
  if (
    previousRooms.length === 1 &&
    nextFaces.length === 1 &&
    previousRoom !== undefined &&
    nextFace !== undefined &&
    previousRoom.faceFingerprint === nextFace.faceFingerprint
  ) {
    return { kind: "matched", inheritedRoomIds: [previousRoom.roomId] };
  }

  return {
    kind: "ambiguous",
    reason: "ROOM_IDENTITY_AMBIGUOUS",
    inheritedRoomIds: [],
  };
};

export const evaluateOpeningFit = (input: OpeningFitInput): OpeningFitResult => {
  const { opening } = input;
  const [firstRoomHeightMm, secondRoomHeightMm] = input.adjacentRoomHeightsMm;
  const openingHeightLimitMm = Math.min(firstRoomHeightMm, secondRoomHeightMm);
  const wallHeightMm = Math.max(firstRoomHeightMm, secondRoomHeightMm);

  if (
    !isPositiveSafeInteger(input.wallLengthMm) ||
    !isPositiveSafeInteger(firstRoomHeightMm) ||
    !isPositiveSafeInteger(secondRoomHeightMm) ||
    !isSafeInteger(opening.offsetMm) ||
    !isPositiveSafeInteger(opening.widthMm) ||
    !isPositiveSafeInteger(opening.heightMm) ||
    !isSafeInteger(opening.sillMm) ||
    opening.offsetMm < 0 ||
    opening.sillMm < 0 ||
    opening.offsetMm + opening.widthMm > input.wallLengthMm ||
    opening.sillMm + opening.heightMm > openingHeightLimitMm
  ) {
    return { ok: false, reason: "OPENING_OUT_OF_BOUNDS" };
  }

  return { ok: true, wallHeightMm, openingHeightLimitMm };
};

const applyCreateRectangle = (revision: Revision, command: Record<string, unknown>): ApplyResult => {
  const innerWidthMm = command.innerWidthMm;
  const innerDepthMm = command.innerDepthMm;
  const wallThicknessMm = command.wallThicknessMm;

  if (
    revision.vertices.length !== 0 ||
    revision.walls.length !== 0 ||
    !isPositiveSafeInteger(innerWidthMm) ||
    !isPositiveSafeInteger(innerDepthMm) ||
    !isWallThickness(wallThicknessMm)
  ) {
    return reject(revision, "INVALID_DIMENSION");
  }

  const outerWidthMm = innerWidthMm + wallThicknessMm;
  const outerDepthMm = innerDepthMm + wallThicknessMm;
  if (outerWidthMm > MAX_ABSOLUTE_COORDINATE_MM || outerDepthMm > MAX_ABSOLUTE_COORDINATE_MM) {
    return reject(revision, "PROJECT_BOUNDS_EXCEEDED");
  }

  const candidate = freezeRevision({
    schemaVersion: 1,
    vertices: [
      { id: "v-1", xMm: 0, zMm: 0 },
      { id: "v-2", xMm: outerWidthMm, zMm: 0 },
      { id: "v-3", xMm: outerWidthMm, zMm: outerDepthMm },
      { id: "v-4", xMm: 0, zMm: outerDepthMm },
    ],
    walls: [
      { id: "w-1", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: wallThicknessMm },
      { id: "w-2", startVertexId: "v-2", endVertexId: "v-3", thicknessMm: wallThicknessMm },
      { id: "w-3", startVertexId: "v-3", endVertexId: "v-4", thicknessMm: wallThicknessMm },
      { id: "w-4", startVertexId: "v-4", endVertexId: "v-1", thicknessMm: wallThicknessMm },
    ],
  });

  return accept(revision, candidate);
};

const applyAddWallSegment = (revision: Revision, command: Record<string, unknown>): ApplyResult => {
  const wallId = command.wallId;
  const start = parsePoint(command.start);
  const end = parsePoint(command.end);
  const thicknessMm = command.thicknessMm;
  const xIntersectionPolicy = command.xIntersectionPolicy;

  if (xIntersectionPolicy !== "reject" && xIntersectionPolicy !== "split") {
    return reject(revision, "POLICY_REQUIRED");
  }
  if (typeof wallId !== "string" || wallId.length === 0 || revision.walls.some((wall) => wall.id === wallId)) {
    return reject(revision, "INVALID_DIMENSION");
  }
  if (start === undefined || end === undefined || !isWallThickness(thicknessMm)) {
    return reject(revision, "INVALID_DIMENSION");
  }
  if (!isWithinProjectBounds(start) || !isWithinProjectBounds(end)) {
    return reject(revision, "PROJECT_BOUNDS_EXCEEDED");
  }
  if (samePoint(start, end)) {
    return reject(revision, "ZERO_LENGTH");
  }
  if (!isAllowedDirection(start, end)) {
    return reject(revision, "UNSUPPORTED_DIRECTION");
  }
  if (segmentLengthStep(start, end) < MIN_WALL_LENGTH_MM) {
    return reject(revision, "INVALID_DIMENSION");
  }

  const existingPoints = pointsByVertexId(revision);
  for (const wall of revision.walls) {
    const wallStart = existingPoints.get(wall.startVertexId);
    const wallEnd = existingPoints.get(wall.endVertexId);
    if (wallStart === undefined || wallEnd === undefined) {
      return reject(revision, "SERIALIZATION_INVALID");
    }
    if (sameUndirectedSegment(start, end, wallStart, wallEnd)) {
      return reject(revision, "DUPLICATE_SEGMENT");
    }
  }

  const existingSplits = new Map<string, PointMm[]>();
  const newSplits: PointMm[] = [];
  for (const wall of revision.walls) {
    const wallStart = existingPoints.get(wall.startVertexId);
    const wallEnd = existingPoints.get(wall.endVertexId);
    if (wallStart === undefined || wallEnd === undefined) {
      return reject(revision, "SERIALIZATION_INVALID");
    }

    const intersection = intersectSegments(start, end, wallStart, wallEnd);
    if (intersection.kind === "collinear-overlap") {
      return reject(revision, "COLLINEAR_OVERLAP");
    }
    if (intersection.kind === "non-integer") {
      return reject(revision, "AMBIGUOUS_INTERSECTION");
    }
    if (intersection.kind === "none") {
      continue;
    }

    const isInteriorOfNew = !samePoint(intersection.point, start) && !samePoint(intersection.point, end);
    const isInteriorOfExisting = !samePoint(intersection.point, wallStart) && !samePoint(intersection.point, wallEnd);
    if (isInteriorOfNew && isInteriorOfExisting && xIntersectionPolicy === "reject") {
      return reject(revision, "AMBIGUOUS_INTERSECTION");
    }
    if (isInteriorOfExisting) {
      addUniquePoint(existingSplits, wall.id, intersection.point);
    }
    if (isInteriorOfNew) {
      addUniquePointToArray(newSplits, intersection.point);
    }
  }

  const vertexDraft = revision.vertices.map(copyVertex);
  const vertexIdsByPoint = new Map(vertexDraft.map((vertex) => [pointKey(vertex), vertex.id]));
  const ensureVertex = (point: PointMm): string => {
    const known = vertexIdsByPoint.get(pointKey(point));
    if (known !== undefined) {
      return known;
    }
    const id = nextVertexId(vertexDraft);
    vertexDraft.push({ id, xMm: point.xMm, zMm: point.zMm });
    vertexIdsByPoint.set(pointKey(point), id);
    return id;
  };

  ensureVertex(start);
  ensureVertex(end);
  for (const points of existingSplits.values()) {
    for (const point of points) {
      ensureVertex(point);
    }
  }
  for (const point of newSplits) {
    ensureVertex(point);
  }

  const wallDraft: WallSegment[] = [];
  for (const existingWall of revision.walls) {
    const splitPoints = existingSplits.get(existingWall.id) ?? [];
    if (splitPoints.length === 0) {
      wallDraft.push(copyWall(existingWall));
      continue;
    }

    const wallStart = existingPoints.get(existingWall.startVertexId)!;
    const wallEnd = existingPoints.get(existingWall.endVertexId)!;
    const chain = [wallStart, ...sortPointsAlongSegment(splitPoints, wallStart, wallEnd), wallEnd];
    wallDraft.push(...wallPieces(existingWall.id, chain, existingWall.thicknessMm, ensureVertex));
  }

  const newChain = [start, ...sortPointsAlongSegment(newSplits, start, end), end];
  wallDraft.push(...wallPieces(wallId, newChain, thicknessMm, ensureVertex));

  const candidate = freezeRevision({
    schemaVersion: 1,
    vertices: vertexDraft,
    walls: wallDraft,
  });
  const validationReason = validateRevision(candidate);
  return validationReason === undefined ? accept(revision, candidate) : reject(revision, validationReason);
};

const applyMergeCollinearSegments = (revision: Revision, command: Record<string, unknown>): ApplyResult => {
  const firstWallId = command.firstWallId;
  const secondWallId = command.secondWallId;
  const mergedWallId = command.mergedWallId;
  if (command.mergePolicy !== "manual-only") {
    return reject(revision, "POLICY_REQUIRED");
  }
  if (
    typeof firstWallId !== "string" ||
    typeof secondWallId !== "string" ||
    typeof mergedWallId !== "string" ||
    mergedWallId.length === 0 ||
    firstWallId === secondWallId ||
    revision.walls.some((wall) => wall.id === mergedWallId)
  ) {
    return reject(revision, "INVALID_DIMENSION");
  }

  const first = revision.walls.find((wall) => wall.id === firstWallId);
  const second = revision.walls.find((wall) => wall.id === secondWallId);
  if (first === undefined || second === undefined) {
    return reject(revision, "WALL_NOT_FOUND");
  }
  if (first.thicknessMm !== second.thicknessMm) {
    return reject(revision, "MERGE_NOT_COLLINEAR");
  }

  const firstVertexIds = [first.startVertexId, first.endVertexId];
  const secondVertexIds = [second.startVertexId, second.endVertexId];
  const sharedVertexIds = firstVertexIds.filter((id) => secondVertexIds.includes(id));
  if (sharedVertexIds.length !== 1) {
    return reject(revision, "MERGE_NOT_COLLINEAR");
  }
  const sharedVertexId = sharedVertexIds[0]!;
  const firstOuterVertexId = firstVertexIds.find((id) => id !== sharedVertexId)!;
  const secondOuterVertexId = secondVertexIds.find((id) => id !== sharedVertexId)!;
  const points = pointsByVertexId(revision);
  const shared = points.get(sharedVertexId);
  const firstOuter = points.get(firstOuterVertexId);
  const secondOuter = points.get(secondOuterVertexId);
  if (shared === undefined || firstOuter === undefined || secondOuter === undefined) {
    return reject(revision, "SERIALIZATION_INVALID");
  }

  const firstVector = vector(shared, firstOuter);
  const secondVector = vector(shared, secondOuter);
  if (cross(firstVector, secondVector) !== 0 || dot(firstVector, secondVector) >= 0 || !isAllowedDirection(firstOuter, secondOuter)) {
    return reject(revision, "MERGE_NOT_COLLINEAR");
  }

  const walls = revision.walls
    .filter((wall) => wall.id !== firstWallId && wall.id !== secondWallId)
    .map(copyWall);
  walls.push({
    id: mergedWallId,
    startVertexId: firstOuterVertexId,
    endVertexId: secondOuterVertexId,
    thicknessMm: first.thicknessMm,
  });
  const stillUsedVertexIds = new Set(walls.flatMap((wall) => [wall.startVertexId, wall.endVertexId]));
  const vertices = revision.vertices
    .filter((vertex) => stillUsedVertexIds.has(vertex.id))
    .map(copyVertex);
  const candidate = freezeRevision({ schemaVersion: 1, vertices, walls });
  const validationReason = validateRevision(candidate);
  return validationReason === undefined ? accept(revision, candidate) : reject(revision, validationReason);
};

const accept = (beforeRevision: Revision, revision: Revision): ValidatedResult => ({
  ok: true,
  revision,
  derivedFaces: deriveFaces(revision),
  inverse: { kind: "RestoreRevision", revision: beforeRevision },
});

const reject = (revision: Revision, reason: ReasonCode): RejectedResult => ({ ok: false, revision, reason });

const freezeRevision = (revision: { schemaVersion: 1; vertices: readonly Vertex[]; walls: readonly WallSegment[] }): Revision =>
  Object.freeze({
    schemaVersion: 1,
    vertices: Object.freeze(revision.vertices.map((vertex) => Object.freeze(copyVertex(vertex)))),
    walls: Object.freeze(revision.walls.map((wall) => Object.freeze(copyWall(wall)))),
  });

const copyVertex = (vertex: Vertex): Vertex => ({ id: vertex.id, xMm: vertex.xMm, zMm: vertex.zMm });

const copyWall = (wall: WallSegment): WallSegment => ({
  id: wall.id,
  startVertexId: wall.startVertexId,
  endVertexId: wall.endVertexId,
  thicknessMm: wall.thicknessMm,
});

const parseVertex = (value: unknown): Vertex | undefined => {
  if (!isRecord(value) || typeof value.id !== "string" || !isSafeInteger(value.xMm) || !isSafeInteger(value.zMm)) {
    return undefined;
  }
  return { id: value.id, xMm: value.xMm, zMm: value.zMm };
};

const parseWall = (value: unknown): WallSegment | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.startVertexId !== "string" ||
    typeof value.endVertexId !== "string" ||
    !isSafeInteger(value.thicknessMm)
  ) {
    return undefined;
  }
  return {
    id: value.id,
    startVertexId: value.startVertexId,
    endVertexId: value.endVertexId,
    thicknessMm: value.thicknessMm,
  };
};

const parsePoint = (value: unknown): PointMm | undefined => {
  if (!isRecord(value) || !isSafeInteger(value.xMm) || !isSafeInteger(value.zMm)) {
    return undefined;
  }
  return { xMm: value.xMm, zMm: value.zMm };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isRevisionLike = (revision: unknown): revision is Revision => {
  if (
    !isRecord(revision) ||
    revision.schemaVersion !== 1 ||
    !Array.isArray(revision.vertices) ||
    !Array.isArray(revision.walls)
  ) {
    return false;
  }

  for (const vertex of revision.vertices) {
    if (parseVertex(vertex) === undefined) {
      return false;
    }
  }
  for (const wall of revision.walls) {
    if (parseWall(wall) === undefined) {
      return false;
    }
  }

  return validateRevision(revision as Revision) === undefined;
};

const isSafeInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);

const isPositiveSafeInteger = (value: unknown): value is number => isSafeInteger(value) && value > 0;

const isWallThickness = (value: unknown): value is number =>
  isSafeInteger(value) && value >= MIN_WALL_THICKNESS_MM && value <= MAX_WALL_THICKNESS_MM;

const isWithinProjectBounds = (point: PointMm): boolean =>
  Math.abs(point.xMm) <= MAX_ABSOLUTE_COORDINATE_MM && Math.abs(point.zMm) <= MAX_ABSOLUTE_COORDINATE_MM;

const samePoint = (left: PointMm, right: PointMm): boolean => left.xMm === right.xMm && left.zMm === right.zMm;

const pointKey = (point: PointMm): string => `${point.xMm}:${point.zMm}`;

const vector = (from: PointMm, to: PointMm): PointMm => ({ xMm: to.xMm - from.xMm, zMm: to.zMm - from.zMm });

const cross = (left: PointMm, right: PointMm): number => left.xMm * right.zMm - left.zMm * right.xMm;

const dot = (left: PointMm, right: PointMm): number => left.xMm * right.xMm + left.zMm * right.zMm;

const isAllowedDirection = (start: PointMm, end: PointMm): boolean => {
  const deltaX = Math.abs(end.xMm - start.xMm);
  const deltaZ = Math.abs(end.zMm - start.zMm);
  return deltaX === 0 || deltaZ === 0 || deltaX === deltaZ;
};

const segmentLengthStep = (start: PointMm, end: PointMm): number => Math.max(Math.abs(end.xMm - start.xMm), Math.abs(end.zMm - start.zMm));

const sameUndirectedSegment = (start: PointMm, end: PointMm, otherStart: PointMm, otherEnd: PointMm): boolean =>
  (samePoint(start, otherStart) && samePoint(end, otherEnd)) || (samePoint(start, otherEnd) && samePoint(end, otherStart));

const pointsByVertexId = (revision: Revision): ReadonlyMap<string, PointMm> =>
  new Map(revision.vertices.map((vertex) => [vertex.id, { xMm: vertex.xMm, zMm: vertex.zMm }]));

const nextVertexId = (vertices: readonly Vertex[]): string => {
  const maxId = vertices.reduce((max, vertex) => {
    const match = /^v-(\d+)$/.exec(vertex.id);
    return match === null ? max : Math.max(max, Number(match[1]));
  }, 0);
  return `v-${maxId + 1}`;
};

const addUniquePoint = (splitByWallId: Map<string, PointMm[]>, wallId: string, point: PointMm): void => {
  const points = splitByWallId.get(wallId) ?? [];
  addUniquePointToArray(points, point);
  splitByWallId.set(wallId, points);
};

const addUniquePointToArray = (points: PointMm[], point: PointMm): void => {
  if (!points.some((existing) => samePoint(existing, point))) {
    points.push({ xMm: point.xMm, zMm: point.zMm });
  }
};

const wallPieces = (
  sourceWallId: string,
  chain: readonly PointMm[],
  thicknessMm: number,
  ensureVertex: (point: PointMm) => string,
): WallSegment[] => {
  const pieces = chain.slice(0, -1).map((start, index) => {
    const end = chain[index + 1]!;
    return {
      id: chain.length === 2 ? sourceWallId : `${sourceWallId}@${index}`,
      startVertexId: ensureVertex(start),
      endVertexId: ensureVertex(end),
      thicknessMm,
    };
  });
  return pieces;
};

const sortPointsAlongSegment = (points: readonly PointMm[], start: PointMm, end: PointMm): PointMm[] => {
  const delta = vector(start, end);
  return [...points].sort((left, right) => projectionNumerator(left, start, delta) - projectionNumerator(right, start, delta));
};

const projectionNumerator = (point: PointMm, start: PointMm, delta: PointMm): number =>
  (point.xMm - start.xMm) * delta.xMm + (point.zMm - start.zMm) * delta.zMm;

const intersectSegments = (start: PointMm, end: PointMm, otherStart: PointMm, otherEnd: PointMm): Intersection => {
  const ray = vector(start, end);
  const otherRay = vector(otherStart, otherEnd);
  const startDelta = vector(start, otherStart);
  const denominator = crossBigInt(ray, otherRay);
  if (denominator === 0n) {
    return crossBigInt(startDelta, ray) === 0n && collinearInteriorsOverlap(start, end, otherStart, otherEnd)
      ? { kind: "collinear-overlap" }
      : { kind: "none" };
  }

  const firstParameterNumerator = crossBigInt(startDelta, otherRay);
  const secondParameterNumerator = crossBigInt(startDelta, ray);
  if (!isParameterOnSegment(firstParameterNumerator, denominator) || !isParameterOnSegment(secondParameterNumerator, denominator)) {
    return { kind: "none" };
  }

  const xNumerator = BigInt(start.xMm) * denominator + BigInt(ray.xMm) * firstParameterNumerator;
  const zNumerator = BigInt(start.zMm) * denominator + BigInt(ray.zMm) * firstParameterNumerator;
  if (xNumerator % denominator !== 0n || zNumerator % denominator !== 0n) {
    return { kind: "non-integer" };
  }

  return {
    kind: "point",
    point: {
      xMm: Number(xNumerator / denominator),
      zMm: Number(zNumerator / denominator),
    },
  };
};

const crossBigInt = (left: PointMm, right: PointMm): bigint =>
  BigInt(left.xMm) * BigInt(right.zMm) - BigInt(left.zMm) * BigInt(right.xMm);

const isParameterOnSegment = (numerator: bigint, denominator: bigint): boolean =>
  denominator > 0n
    ? numerator >= 0n && numerator <= denominator
    : numerator <= 0n && numerator >= denominator;

const collinearInteriorsOverlap = (start: PointMm, end: PointMm, otherStart: PointMm, otherEnd: PointMm): boolean =>
  isStrictlyInside(otherStart, start, end) ||
  isStrictlyInside(otherEnd, start, end) ||
  isStrictlyInside(start, otherStart, otherEnd) ||
  isStrictlyInside(end, otherStart, otherEnd);

const isStrictlyInside = (point: PointMm, start: PointMm, end: PointMm): boolean =>
  !samePoint(point, start) && !samePoint(point, end) && pointOnSegment(point, start, end);

const pointOnSegment = (point: PointMm, start: PointMm, end: PointMm): boolean => {
  const startToPoint = vector(start, point);
  const startToEnd = vector(start, end);
  return (
    cross(startToPoint, startToEnd) === 0 &&
    point.xMm >= Math.min(start.xMm, end.xMm) &&
    point.xMm <= Math.max(start.xMm, end.xMm) &&
    point.zMm >= Math.min(start.zMm, end.zMm) &&
    point.zMm <= Math.max(start.zMm, end.zMm)
  );
};

const validateRevision = (revision: Revision): ReasonCode | undefined => {
  if (revision.schemaVersion !== 1) {
    return "SERIALIZATION_INVALID";
  }
  const vertexIds = new Set<string>();
  const coordinateKeys = new Set<string>();
  for (const vertex of revision.vertices) {
    if (
      vertexIds.has(vertex.id) ||
      coordinateKeys.has(pointKey(vertex)) ||
      !isWithinProjectBounds(vertex)
    ) {
      return "SERIALIZATION_INVALID";
    }
    vertexIds.add(vertex.id);
    coordinateKeys.add(pointKey(vertex));
  }

  const points = pointsByVertexId(revision);
  const wallIds = new Set<string>();
  for (const wall of revision.walls) {
    const start = points.get(wall.startVertexId);
    const end = points.get(wall.endVertexId);
    if (wallIds.has(wall.id) || start === undefined || end === undefined || !isWallThickness(wall.thicknessMm)) {
      return "SERIALIZATION_INVALID";
    }
    if (samePoint(start, end)) {
      return "ZERO_LENGTH";
    }
    if (!isAllowedDirection(start, end)) {
      return "UNSUPPORTED_DIRECTION";
    }
    if (segmentLengthStep(start, end) < MIN_WALL_LENGTH_MM) {
      return "INVALID_DIMENSION";
    }
    if (
      revision.vertices.some(
        (vertex) => isStrictlyInside(vertex, start, end),
      )
    ) {
      return "AMBIGUOUS_INTERSECTION";
    }
    wallIds.add(wall.id);
  }

  for (let index = 0; index < revision.walls.length; index += 1) {
    const wall = revision.walls[index]!;
    const start = points.get(wall.startVertexId)!;
    const end = points.get(wall.endVertexId)!;
    for (const otherWall of revision.walls.slice(index + 1)) {
      const otherStart = points.get(otherWall.startVertexId)!;
      const otherEnd = points.get(otherWall.endVertexId)!;
      if (sameUndirectedSegment(start, end, otherStart, otherEnd)) {
        return "DUPLICATE_SEGMENT";
      }
      const intersection = intersectSegments(start, end, otherStart, otherEnd);
      if (intersection.kind === "collinear-overlap" || intersection.kind === "non-integer") {
        return "SERIALIZATION_INVALID";
      }
      if (intersection.kind === "point") {
        const knownVertex = revision.vertices.some((vertex) => samePoint(vertex, intersection.point));
        if (!knownVertex) {
          return "AMBIGUOUS_INTERSECTION";
        }
      }
    }
  }

  return undefined;
};

const deriveFaces = (revision: Revision): readonly DerivedFace[] => {
  const points = pointsByVertexId(revision);
  const outgoing = new Map<string, HalfEdge[]>();
  for (const wall of revision.walls) {
    const forward = halfEdge(wall.id, wall.startVertexId, wall.endVertexId);
    const reverse = halfEdge(wall.id, wall.endVertexId, wall.startVertexId);
    appendHalfEdge(outgoing, forward);
    appendHalfEdge(outgoing, reverse);
  }
  for (const [vertexId, edges] of outgoing) {
    const origin = points.get(vertexId)!;
    edges.sort((left, right) => {
      const leftPoint = points.get(left.toVertexId)!;
      const rightPoint = points.get(right.toVertexId)!;
      return directionIndex(origin, leftPoint) - directionIndex(origin, rightPoint) || left.key.localeCompare(right.key);
    });
  }

  const visited = new Set<string>();
  const faces: DerivedFace[] = [];
  for (const edge of [...outgoing.values()].flat()) {
    if (visited.has(edge.key)) {
      continue;
    }
    const boundary = walkFace(edge, outgoing, visited);
    if (boundary === undefined || boundary.length < 3) {
      continue;
    }
    const boundaryPoints = boundary.map((vertexId) => points.get(vertexId)!);
    const signedDoubleArea = signedDoubleAreaMm2(boundaryPoints);
    if (signedDoubleArea <= 0) {
      continue;
    }
    faces.push(makeDerivedFace(boundary, boundaryPoints, signedDoubleArea, revision));
  }

  return faces.sort((left, right) => left.faceFingerprint.localeCompare(right.faceFingerprint));
};

const halfEdge = (wallId: string, fromVertexId: string, toVertexId: string): HalfEdge => ({
  key: `${wallId}:${fromVertexId}>${toVertexId}`,
  wallId,
  fromVertexId,
  toVertexId,
});

const appendHalfEdge = (outgoing: Map<string, HalfEdge[]>, edge: HalfEdge): void => {
  const current = outgoing.get(edge.fromVertexId) ?? [];
  current.push(edge);
  outgoing.set(edge.fromVertexId, current);
};

const directionIndex = (from: PointMm, to: PointMm): number => {
  const deltaX = Math.sign(to.xMm - from.xMm);
  const deltaZ = Math.sign(to.zMm - from.zMm);
  const byDirection = new Map<string, number>([
    ["1:0", 0],
    ["1:1", 1],
    ["0:1", 2],
    ["-1:1", 3],
    ["-1:0", 4],
    ["-1:-1", 5],
    ["0:-1", 6],
    ["1:-1", 7],
  ]);
  return byDirection.get(`${deltaX}:${deltaZ}`) ?? Number.MAX_SAFE_INTEGER;
};

const walkFace = (
  firstEdge: HalfEdge,
  outgoing: ReadonlyMap<string, readonly HalfEdge[]>,
  visited: Set<string>,
): string[] | undefined => {
  const boundary: string[] = [];
  let edge = firstEdge;
  const maxSteps = Math.max(1, [...outgoing.values()].reduce((count, edges) => count + edges.length, 0) + 1);
  for (let step = 0; step < maxSteps; step += 1) {
    if (visited.has(edge.key) && edge.key !== firstEdge.key) {
      return undefined;
    }
    visited.add(edge.key);
    boundary.push(edge.fromVertexId);
    const nextEdges = outgoing.get(edge.toVertexId);
    if (nextEdges === undefined) {
      return undefined;
    }
    const reverseIndex = nextEdges.findIndex(
      (candidate) => candidate.wallId === edge.wallId && candidate.toVertexId === edge.fromVertexId,
    );
    if (reverseIndex < 0) {
      return undefined;
    }
    const next = nextEdges[(reverseIndex - 1 + nextEdges.length) % nextEdges.length];
    if (next === undefined) {
      return undefined;
    }
    edge = next;
    if (edge.key === firstEdge.key) {
      return boundary;
    }
  }
  return undefined;
};

const signedDoubleAreaMm2 = (boundary: readonly PointMm[]): number =>
  boundary.reduce((area, point, index) => {
    const next = boundary[(index + 1) % boundary.length]!;
    return area + point.xMm * next.zMm - point.zMm * next.xMm;
  }, 0);

const makeDerivedFace = (
  boundaryVertexIds: readonly string[],
  boundary: readonly PointMm[],
  signedDoubleArea: number,
  revision: Revision,
): DerivedFace => {
  const centerlineAreaMm2 = signedDoubleArea / 2;
  const fingerprint = normalizeFaceFingerprint(boundary);
  const rectangleMetrics = deriveAxisAlignedRectangleMetrics(boundaryVertexIds, boundary, revision);
  if (rectangleMetrics === undefined) {
    return { faceFingerprint: fingerprint, boundaryVertexIds, areaMm2: centerlineAreaMm2 };
  }
  return {
    faceFingerprint: fingerprint,
    boundaryVertexIds,
    areaMm2: rectangleMetrics.usableWidthMm * rectangleMetrics.usableDepthMm,
    usableWidthMm: rectangleMetrics.usableWidthMm,
    usableDepthMm: rectangleMetrics.usableDepthMm,
  };
};

const normalizeFaceFingerprint = (boundary: readonly PointMm[]): string => {
  const candidates = boundary.map((_, startIndex) =>
    boundary
      .slice(startIndex)
      .concat(boundary.slice(0, startIndex))
      .map((point) => `${point.xMm},${point.zMm}`)
      .join("|"),
  );
  return candidates.sort()[0] ?? "";
};

const deriveAxisAlignedRectangleMetrics = (
  boundaryVertexIds: readonly string[],
  boundary: readonly PointMm[],
  revision: Revision,
): { usableWidthMm: number; usableDepthMm: number } | undefined => {
  if (boundary.length !== 4 || new Set(boundary.map((point) => point.xMm)).size !== 2 || new Set(boundary.map((point) => point.zMm)).size !== 2) {
    return undefined;
  }
  const thicknesses: number[] = [];
  for (let index = 0; index < boundaryVertexIds.length; index += 1) {
    const from = boundaryVertexIds[index]!;
    const to = boundaryVertexIds[(index + 1) % boundaryVertexIds.length]!;
    const wall = revision.walls.find(
      (candidate) =>
        (candidate.startVertexId === from && candidate.endVertexId === to) ||
        (candidate.startVertexId === to && candidate.endVertexId === from),
    );
    if (wall === undefined) {
      return undefined;
    }
    thicknesses.push(wall.thicknessMm);
  }
  if (new Set(thicknesses).size !== 1) {
    return undefined;
  }
  const thicknessMm = thicknesses[0]!;
  const widthMm = Math.max(...boundary.map((point) => point.xMm)) - Math.min(...boundary.map((point) => point.xMm));
  const depthMm = Math.max(...boundary.map((point) => point.zMm)) - Math.min(...boundary.map((point) => point.zMm));
  const usableWidthMm = widthMm - thicknessMm;
  const usableDepthMm = depthMm - thicknessMm;
  return usableWidthMm > 0 && usableDepthMm > 0 ? { usableWidthMm, usableDepthMm } : undefined;
};
