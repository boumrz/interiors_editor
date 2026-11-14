import type { Project, Room, Vertex, WallSegment } from './project';
import { STARTER_WALL_THICKNESS_MM } from './rectangular-room';

const PROJECT_COORDINATE_LIMIT_MM = 100_000;

export interface RectangularRoomLoopInput {
  readonly maxXMm: number;
  readonly maxZMm: number;
  readonly minXMm: number;
  readonly minZMm: number;
}

export interface RectangularRoomLoopBounds {
  /**
   * The concrete PlanGraph edges that bound this derived rectangular face,
   * ordered clockwise from its minimum-Z edge. This is a derived linkage, not
   * a second persisted room representation.
   */
  readonly boundaryWallSegmentIds: readonly [string, string, string, string];
  readonly maxXMm: number;
  readonly maxZMm: number;
  readonly minXMm: number;
  readonly minZMm: number;
  readonly room: Room;
  readonly thicknessMm: number;
}

interface RectangularRoomLoopGeometry {
  readonly maxXMm: number;
  readonly maxZMm: number;
  readonly minXMm: number;
  readonly minZMm: number;
  readonly room: Room;
  readonly thicknessMm: number;
}

interface IdSource {
  next(): string;
}

export type CreateRectangularRoomLoopResult =
  | { readonly kind: 'accepted'; readonly project: Project }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | 'INVALID_DIMENSION'
        | 'PLAN_TOPOLOGY_UNSUPPORTED'
        | 'PROJECT_BOUNDS_EXCEEDED'
        | 'ROOM_NOT_DETACHED'
        | 'ROOM_OVERLAP';
    };

/**
 * Adds an independent, axis-aligned face to the PlanGraph. The draft remains
 * deliberately detached in this increment: an attachment needs graph edge
 * splitting and is a separate topology command, not a hidden side effect.
 */
export function createRectangularRoomLoop(
  project: Project,
  input: RectangularRoomLoopInput,
  ids: IdSource,
  updatedAt: string
): CreateRectangularRoomLoopResult {
  const existingLoops = rectangularRoomLoopBounds(project);
  if (!existingLoops) {
    return { kind: 'rejected', reasonCode: 'PLAN_TOPOLOGY_UNSUPPORTED' };
  }
  const thicknessMm = existingLoops[0]?.thicknessMm;
  if (!thicknessMm || !isValidLoopInput(input, thicknessMm)) {
    return { kind: 'rejected', reasonCode: 'INVALID_DIMENSION' };
  }
  if (coordinatesExceedProjectBounds(input)) {
    return { kind: 'rejected', reasonCode: 'PROJECT_BOUNDS_EXCEEDED' };
  }
  const overlap = existingLoops.some((existing) => interiorsOverlap(existing, input));
  if (overlap) {
    return { kind: 'rejected', reasonCode: 'ROOM_OVERLAP' };
  }
  if (existingLoops.some((existing) => rectanglesTouch(existing, input))) {
    return { kind: 'rejected', reasonCode: 'ROOM_NOT_DETACHED' };
  }

  const corners = cornersFor(input, ids);
  const wallSegments = wallsForCorners(corners, thicknessMm, ids);
  const room: Room = {
    faceFingerprint: loopFingerprint(input, thicknessMm),
    heightMm: existingLoops[0]?.room.heightMm ?? 0,
    roomId: ids.next()
  };
  return {
    kind: 'accepted',
    project: {
      ...project,
      level: {
        ...project.level,
        rooms: [...existingLoops.map((loop) => ({
          ...loop.room,
          faceFingerprint: loopFingerprint(loop, loop.thicknessMm)
        })), room],
        vertices: [...project.level.vertices, ...corners],
        wallSegments: [...project.level.wallSegments, ...wallSegments]
      },
      updatedAt
    }
  };
}

/**
 * Resolves the rectangular room faces that this alpha topology can safely
 * project and host. The legacy singleton starter fingerprint is converted to
 * the same bounds without rewriting a Project during a read.
 */
export function rectangularRoomLoopBounds(project: Project): readonly RectangularRoomLoopBounds[] | undefined {
  const thicknessMm = project.level.wallSegments[0]?.thicknessMm ?? STARTER_WALL_THICKNESS_MM;
  if (
    project.level.rooms.length === 0 ||
    !Number.isSafeInteger(thicknessMm) ||
    thicknessMm <= 0 ||
    project.level.wallSegments.some((wall) => wall.thicknessMm !== thicknessMm)
  ) {
    return undefined;
  }
  const bounds = project.level.rooms.map((room) => boundsForRoom(project, room, thicknessMm));
  if (bounds.some((roomBounds) => !roomBounds)) {
    return undefined;
  }
  const resolved = bounds as readonly RectangularRoomLoopGeometry[];
  if (!resolved.every((first, firstIndex) =>
    resolved.slice(firstIndex + 1).every((second) => !rectanglesTouch(first, second))
  )) {
    return undefined;
  }
  return linkRoomBoundaries(project, resolved);
}

export function rectangularRoomLoopBoundsForRoom(
  project: Project,
  roomId: string
): RectangularRoomLoopBounds | undefined {
  return rectangularRoomLoopBounds(project)?.find((bounds) => bounds.room.roomId === roomId);
}

function boundsForRoom(
  project: Project,
  room: Room,
  thicknessMm: number
): RectangularRoomLoopGeometry | undefined {
  if (!room.roomId || !Number.isSafeInteger(room.heightMm) || room.heightMm <= 0) {
    return undefined;
  }
  const loop = /^loop:(0|-?[1-9]\d*):(0|-?[1-9]\d*):(0|-?[1-9]\d*):(0|-?[1-9]\d*):([1-9]\d*)$/.exec(room.faceFingerprint);
  if (loop) {
    const [, minXRaw, maxXRaw, minZRaw, maxZRaw, thicknessRaw] = loop;
    const parsedThicknessMm = Number(thicknessRaw);
    const bounds = {
      maxXMm: Number(maxXRaw),
      maxZMm: Number(maxZRaw),
      minXMm: Number(minXRaw),
      minZMm: Number(minZRaw),
      room,
      thicknessMm: parsedThicknessMm
    };
    return parsedThicknessMm === thicknessMm && isRectangleBounds(bounds) ? bounds : undefined;
  }
  const starter = /^rectangular:(\d+):(\d+):(\d+)$/.exec(room.faceFingerprint);
  if (!starter || project.level.rooms.length !== 1 || project.level.vertices.length === 0) {
    return undefined;
  }
  const [, widthRaw, depthRaw, starterThicknessRaw] = starter;
  const xCoordinates = project.level.vertices.map((vertex) => vertex.xMm);
  const zCoordinates = project.level.vertices.map((vertex) => vertex.zMm);
  const bounds = {
    maxXMm: Math.max(...xCoordinates),
    maxZMm: Math.max(...zCoordinates),
    minXMm: Math.min(...xCoordinates),
    minZMm: Math.min(...zCoordinates),
    room,
    thicknessMm: Number(starterThicknessRaw)
  };
  return Number(widthRaw) === bounds.maxXMm - bounds.minXMm &&
    Number(depthRaw) === bounds.maxZMm - bounds.minZMm &&
    bounds.thicknessMm === thicknessMm &&
    isRectangleBounds(bounds)
    ? bounds
    : undefined;
}

/**
 * This small topology subset supports only detached four-edge rectangles. A
 * fingerprint alone is never enough: every derived face must be linked to one
 * concrete edge for each side, and those edges/vertices may not be reused by
 * another loop or hidden auxiliary topology.
 */
function linkRoomBoundaries(
  project: Project,
  boundsByRoom: readonly RectangularRoomLoopGeometry[]
): readonly RectangularRoomLoopBounds[] | undefined {
  if (
    project.level.vertices.length !== boundsByRoom.length * 4 ||
    project.level.wallSegments.length !== boundsByRoom.length * 4
  ) {
    return undefined;
  }
  const vertexById = verticesById(project.level.vertices);
  const vertexByCoordinate = verticesByCoordinate(project.level.vertices);
  if (!vertexById || !vertexByCoordinate) {
    return undefined;
  }
  const wallSegmentIndex = indexValidWallSegments(project.level.wallSegments, vertexById);
  if (!wallSegmentIndex) {
    return undefined;
  }

  const usedVertexIds = new Set<string>();
  const usedWallSegmentIds = new Set<string>();
  const linked: RectangularRoomLoopBounds[] = [];
  for (const bounds of boundsByRoom) {
    const corners = cornersForBounds(bounds, vertexByCoordinate);
    if (!corners) {
      return undefined;
    }
    const boundaryWallSegmentIds = boundaryWallSegmentIdsForCorners(corners, project.level.wallSegments);
    if (!boundaryWallSegmentIds) {
      return undefined;
    }
    if (
      corners.some((corner) => usedVertexIds.has(corner.vertexId)) ||
      boundaryWallSegmentIds.some((wallSegmentId) => usedWallSegmentIds.has(wallSegmentId))
    ) {
      return undefined;
    }
    for (const corner of corners) {
      usedVertexIds.add(corner.vertexId);
    }
    for (const wallSegmentId of boundaryWallSegmentIds) {
      usedWallSegmentIds.add(wallSegmentId);
    }
    linked.push({ ...bounds, boundaryWallSegmentIds });
  }
  return usedVertexIds.size === vertexById.size && usedWallSegmentIds.size === wallSegmentIndex.size
    ? linked
    : undefined;
}

function verticesById(vertices: readonly Vertex[]): ReadonlyMap<string, Vertex> | undefined {
  const result = new Map<string, Vertex>();
  for (const vertex of vertices) {
    if (
      !vertex.vertexId ||
      result.has(vertex.vertexId) ||
      !Number.isSafeInteger(vertex.xMm) ||
      !Number.isSafeInteger(vertex.zMm) ||
      Math.abs(vertex.xMm) > PROJECT_COORDINATE_LIMIT_MM ||
      Math.abs(vertex.zMm) > PROJECT_COORDINATE_LIMIT_MM
    ) {
      return undefined;
    }
    result.set(vertex.vertexId, vertex);
  }
  return result;
}

function verticesByCoordinate(vertices: readonly Vertex[]): ReadonlyMap<string, Vertex> | undefined {
  const result = new Map<string, Vertex>();
  for (const vertex of vertices) {
    const key = coordinateKey(vertex.xMm, vertex.zMm);
    if (result.has(key)) {
      return undefined;
    }
    result.set(key, vertex);
  }
  return result;
}

function indexValidWallSegments(
  walls: readonly WallSegment[],
  vertexById: ReadonlyMap<string, Vertex>
): ReadonlyMap<string, WallSegment> | undefined {
  const result = new Map<string, WallSegment>();
  for (const wall of walls) {
    const start = vertexById.get(wall.startVertexId);
    const end = vertexById.get(wall.endVertexId);
    if (
      !wall.wallSegmentId ||
      result.has(wall.wallSegmentId) ||
      !start ||
      !end ||
      start.vertexId === end.vertexId
    ) {
      return undefined;
    }
    result.set(wall.wallSegmentId, wall);
  }
  return result;
}

function cornersForBounds(
  bounds: RectangularRoomLoopGeometry,
  vertexByCoordinate: ReadonlyMap<string, Vertex>
): readonly [Vertex, Vertex, Vertex, Vertex] | undefined {
  const first = vertexByCoordinate.get(coordinateKey(bounds.minXMm, bounds.minZMm));
  const second = vertexByCoordinate.get(coordinateKey(bounds.maxXMm, bounds.minZMm));
  const third = vertexByCoordinate.get(coordinateKey(bounds.maxXMm, bounds.maxZMm));
  const fourth = vertexByCoordinate.get(coordinateKey(bounds.minXMm, bounds.maxZMm));
  return first && second && third && fourth ? [first, second, third, fourth] : undefined;
}

function boundaryWallSegmentIdsForCorners(
  corners: readonly [Vertex, Vertex, Vertex, Vertex],
  walls: readonly WallSegment[]
): readonly [string, string, string, string] | undefined {
  const [first, second, third, fourth] = corners;
  const firstWall = uniqueWallForEdge(first, second, walls);
  const secondWall = uniqueWallForEdge(second, third, walls);
  const thirdWall = uniqueWallForEdge(third, fourth, walls);
  const fourthWall = uniqueWallForEdge(fourth, first, walls);
  if (!firstWall || !secondWall || !thirdWall || !fourthWall) {
    return undefined;
  }
  const boundaryWallSegmentIds: readonly [string, string, string, string] = [
    firstWall.wallSegmentId,
    secondWall.wallSegmentId,
    thirdWall.wallSegmentId,
    fourthWall.wallSegmentId
  ];
  return new Set(boundaryWallSegmentIds).size === 4 ? boundaryWallSegmentIds : undefined;
}

function uniqueWallForEdge(
  first: Vertex,
  second: Vertex,
  walls: readonly WallSegment[]
): WallSegment | undefined {
  const matches = walls.filter((wall) =>
    (wall.startVertexId === first.vertexId && wall.endVertexId === second.vertexId) ||
    (wall.startVertexId === second.vertexId && wall.endVertexId === first.vertexId)
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function coordinateKey(xMm: number, zMm: number): string {
  return `${xMm}:${zMm}`;
}

function isValidLoopInput(input: RectangularRoomLoopInput, thicknessMm: number): boolean {
  return [input.minXMm, input.maxXMm, input.minZMm, input.maxZMm].every(Number.isSafeInteger) &&
    input.maxXMm - input.minXMm > thicknessMm && input.maxZMm - input.minZMm > thicknessMm;
}

function coordinatesExceedProjectBounds(input: RectangularRoomLoopInput): boolean {
  return [input.minXMm, input.maxXMm, input.minZMm, input.maxZMm].some((coordinate) =>
    Math.abs(coordinate) > PROJECT_COORDINATE_LIMIT_MM
  );
}

function isRectangleBounds(bounds: Omit<RectangularRoomLoopGeometry, 'room'>): boolean {
  return [bounds.minXMm, bounds.maxXMm, bounds.minZMm, bounds.maxZMm, bounds.thicknessMm]
    .every(Number.isSafeInteger) &&
    !coordinatesExceedProjectBounds(bounds) &&
    bounds.thicknessMm > 0 &&
    bounds.maxXMm - bounds.minXMm > bounds.thicknessMm &&
    bounds.maxZMm - bounds.minZMm > bounds.thicknessMm;
}

function interiorsOverlap(
  first: Pick<RectangularRoomLoopBounds, 'maxXMm' | 'maxZMm' | 'minXMm' | 'minZMm'>,
  second: RectangularRoomLoopInput
): boolean {
  return Math.max(first.minXMm, second.minXMm) < Math.min(first.maxXMm, second.maxXMm) &&
    Math.max(first.minZMm, second.minZMm) < Math.min(first.maxZMm, second.maxZMm);
}

function rectanglesTouch(
  first: Pick<RectangularRoomLoopBounds, 'maxXMm' | 'maxZMm' | 'minXMm' | 'minZMm'>,
  second: RectangularRoomLoopInput
): boolean {
  return Math.max(first.minXMm, second.minXMm) <= Math.min(first.maxXMm, second.maxXMm) &&
    Math.max(first.minZMm, second.minZMm) <= Math.min(first.maxZMm, second.maxZMm);
}

function cornersFor(input: RectangularRoomLoopInput, ids: IdSource): readonly [Vertex, Vertex, Vertex, Vertex] {
  return [
    { vertexId: ids.next(), xMm: input.minXMm, zMm: input.minZMm },
    { vertexId: ids.next(), xMm: input.maxXMm, zMm: input.minZMm },
    { vertexId: ids.next(), xMm: input.maxXMm, zMm: input.maxZMm },
    { vertexId: ids.next(), xMm: input.minXMm, zMm: input.maxZMm }
  ];
}

function wallsForCorners(
  corners: readonly [Vertex, Vertex, Vertex, Vertex],
  thicknessMm: number,
  ids: IdSource
): readonly [WallSegment, WallSegment, WallSegment, WallSegment] {
  const [first, second, third, fourth] = corners;
  return [
    { endVertexId: second.vertexId, startVertexId: first.vertexId, thicknessMm, wallSegmentId: ids.next() },
    { endVertexId: third.vertexId, startVertexId: second.vertexId, thicknessMm, wallSegmentId: ids.next() },
    { endVertexId: fourth.vertexId, startVertexId: third.vertexId, thicknessMm, wallSegmentId: ids.next() },
    { endVertexId: first.vertexId, startVertexId: fourth.vertexId, thicknessMm, wallSegmentId: ids.next() }
  ];
}

function loopFingerprint(
  bounds: Pick<RectangularRoomLoopBounds, 'maxXMm' | 'maxZMm' | 'minXMm' | 'minZMm'>,
  thicknessMm: number
): string {
  return `loop:${bounds.minXMm}:${bounds.maxXMm}:${bounds.minZMm}:${bounds.maxZMm}:${thicknessMm}`;
}
