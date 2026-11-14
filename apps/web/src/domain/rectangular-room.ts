import type { Project, Room, Vertex, WallSegment } from './project';

export const STARTER_WALL_THICKNESS_MM = 100;
const PROJECT_COORDINATE_LIMIT_MM = 100_000;
const ROOM_HEIGHT_LIMIT_MM = 10_000;

export interface RectangularRoomInput {
  readonly widthMm: string;
  readonly depthMm: string;
  readonly heightMm: string;
}

export interface RectangularRoomMetrics {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
  readonly perimeterMm: number;
  readonly areaMm2: number;
}

export type ConfigureRectangularRoomResult =
  | { readonly kind: 'accepted'; readonly project: Project; readonly metrics: RectangularRoomMetrics }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | 'INVALID_DIMENSION'
        | 'PROJECT_BOUNDS_EXCEEDED'
        | 'PLAN_NOT_RECTANGULAR_STARTER';
    };

interface IdSource {
  next(): string;
}

interface ParsedDimensions {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
  readonly outerWidthMm: number;
  readonly outerDepthMm: number;
}

type DimensionParseResult =
  | { readonly kind: 'parsed'; readonly dimensions: ParsedDimensions }
  | { readonly kind: 'rejected'; readonly reasonCode: 'INVALID_DIMENSION' | 'PROJECT_BOUNDS_EXCEEDED' };

export function configureRectangularRoom(
  project: Project,
  input: RectangularRoomInput,
  ids: IdSource,
  updatedAt: string
): ConfigureRectangularRoomResult {
  const parsedDimensions = parseDimensions(input);
  if (parsedDimensions.kind === 'rejected') {
    return parsedDimensions;
  }
  const { dimensions } = parsedDimensions;

  if (isEmptyLevel(project)) {
    return {
      kind: 'accepted',
      metrics: metricsFor(dimensions),
      project: withRectangle(project, dimensions, createRectangleIds(ids), updatedAt)
    };
  }

  const existingIds = existingRectangleIds(project);
  if (!existingIds) {
    return { kind: 'rejected', reasonCode: 'PLAN_NOT_RECTANGULAR_STARTER' };
  }
  return {
    kind: 'accepted',
    metrics: metricsFor(dimensions),
    project: withRectangle(project, dimensions, existingIds, updatedAt)
  };
}

export function deriveRectangularRoomMetrics(project: Project): RectangularRoomMetrics | undefined {
  const existingIds = existingRectangleIds(project);
  if (!existingIds) {
    return undefined;
  }
  const first = project.level.vertices[0];
  const second = project.level.vertices[1];
  const third = project.level.vertices[2];
  const room = project.level.rooms[0];
  if (!first || !second || !third || !room) {
    return undefined;
  }
  const widthMm = second.xMm - first.xMm - STARTER_WALL_THICKNESS_MM;
  const depthMm = third.zMm - second.zMm - STARTER_WALL_THICKNESS_MM;
  const metrics = metricsFor({ depthMm, heightMm: room.heightMm, widthMm });
  return isPositiveSafeInteger(widthMm) &&
    isPositiveSafeInteger(depthMm) &&
    isPositiveSafeInteger(room.heightMm) &&
    Number.isSafeInteger(metrics.perimeterMm) &&
    Number.isSafeInteger(metrics.areaMm2)
    ? metrics
    : undefined;
}

function parseDimensions(input: RectangularRoomInput): DimensionParseResult {
  const widthMm = parsePositiveSafeInteger(input.widthMm);
  const depthMm = parsePositiveSafeInteger(input.depthMm);
  const heightMm = parsePositiveSafeInteger(input.heightMm);
  if (widthMm === undefined || depthMm === undefined || heightMm === undefined) {
    return { kind: 'rejected', reasonCode: 'INVALID_DIMENSION' };
  }
  const outerWidthMm = widthMm + STARTER_WALL_THICKNESS_MM;
  const outerDepthMm = depthMm + STARTER_WALL_THICKNESS_MM;
  const metrics = metricsFor({ depthMm, heightMm, widthMm });
  if (
    !Number.isSafeInteger(outerWidthMm) ||
    !Number.isSafeInteger(outerDepthMm) ||
    !Number.isSafeInteger(metrics.perimeterMm) ||
    !Number.isSafeInteger(metrics.areaMm2)
  ) {
    return { kind: 'rejected', reasonCode: 'INVALID_DIMENSION' };
  }
  if (
    outerWidthMm > PROJECT_COORDINATE_LIMIT_MM ||
    outerDepthMm > PROJECT_COORDINATE_LIMIT_MM ||
    heightMm > ROOM_HEIGHT_LIMIT_MM
  ) {
    return { kind: 'rejected', reasonCode: 'PROJECT_BOUNDS_EXCEEDED' };
  }
  return {
    dimensions: { depthMm, heightMm, outerDepthMm, outerWidthMm, widthMm },
    kind: 'parsed'
  };
}

function parsePositiveSafeInteger(raw: string): number | undefined {
  if (!/^-?(?:0|[1-9][0-9]*)$/.test(raw)) {
    return undefined;
  }
  const value = raw === '-0' ? 0 : Number(raw);
  return isPositiveSafeInteger(value) ? value : undefined;
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function metricsFor(dimensions: Pick<ParsedDimensions, 'widthMm' | 'depthMm' | 'heightMm'>): RectangularRoomMetrics {
  const perimeterMm = 2 * (dimensions.widthMm + dimensions.depthMm);
  const areaMm2 = dimensions.widthMm * dimensions.depthMm;
  return {
    areaMm2,
    depthMm: dimensions.depthMm,
    heightMm: dimensions.heightMm,
    perimeterMm,
    widthMm: dimensions.widthMm
  };
}

function isEmptyLevel(project: Project): boolean {
  return project.level.vertices.length === 0 &&
    project.level.wallSegments.length === 0 &&
    project.level.rooms.length === 0 &&
    project.level.openings.length === 0;
}

interface RectangleIds {
  readonly vertexIds: readonly [string, string, string, string];
  readonly wallSegmentIds: readonly [string, string, string, string];
  readonly roomId: string;
}

export interface RectangularRoomStarter {
  readonly outerWidthMm: number;
  readonly outerDepthMm: number;
  readonly room: Room;
  readonly vertexIds: readonly [string, string, string, string];
  readonly wallSegmentIds: readonly [string, string, string, string];
}

export function readRectangularRoomStarter(project: Project): RectangularRoomStarter | undefined {
  const ids = existingRectangleIds(project);
  const second = project.level.vertices[1];
  const third = project.level.vertices[2];
  const room = project.level.rooms[0];
  if (!ids || !second || !third || !room) {
    return undefined;
  }
  return {
    outerDepthMm: third.zMm,
    outerWidthMm: second.xMm,
    room,
    vertexIds: ids.vertexIds,
    wallSegmentIds: ids.wallSegmentIds
  };
}

function createRectangleIds(ids: IdSource): RectangleIds {
  return {
    vertexIds: [ids.next(), ids.next(), ids.next(), ids.next()],
    wallSegmentIds: [ids.next(), ids.next(), ids.next(), ids.next()],
    roomId: ids.next()
  };
}

function existingRectangleIds(project: Project): RectangleIds | undefined {
  const { rooms, vertices, wallSegments } = project.level;
  if (vertices.length !== 4 || wallSegments.length !== 4 || rooms.length !== 1) {
    return undefined;
  }
  const vertexIds = vertices.map((vertex) => vertex.vertexId);
  const wallSegmentIds = wallSegments.map((wall) => wall.wallSegmentId);
  if (
    vertexIds.some((id) => !id) ||
    wallSegmentIds.some((id) => !id) ||
    !rooms[0]?.roomId ||
    new Set(vertexIds).size !== 4 ||
    new Set(wallSegmentIds).size !== 4 ||
    wallSegments.some((wall) => wall.thicknessMm !== STARTER_WALL_THICKNESS_MM)
  ) {
    return undefined;
  }
  const [first, second, third, fourth] = vertices;
  const [firstWall, secondWall, thirdWall, fourthWall] = wallSegments;
  if (!first || !second || !third || !fourth || !firstWall || !secondWall || !thirdWall || !fourthWall) {
    return undefined;
  }
  const expectedEdges = [
    [first.vertexId, second.vertexId],
    [second.vertexId, third.vertexId],
    [third.vertexId, fourth.vertexId],
    [fourth.vertexId, first.vertexId]
  ];
  const matchesEdges = wallSegments.every(
    (wall, index) =>
      wall.startVertexId === expectedEdges[index]?.[0] &&
      wall.endVertexId === expectedEdges[index]?.[1]
  );
  const isCanonicalRectangle =
    first.xMm === 0 &&
    first.zMm === 0 &&
    second.xMm > STARTER_WALL_THICKNESS_MM &&
    second.xMm <= PROJECT_COORDINATE_LIMIT_MM &&
    second.zMm === 0 &&
    third.xMm === second.xMm &&
    third.zMm > STARTER_WALL_THICKNESS_MM &&
    third.zMm <= PROJECT_COORDINATE_LIMIT_MM &&
    fourth.xMm === 0 &&
    fourth.zMm === third.zMm &&
    rooms[0].heightMm > 0 &&
    rooms[0].heightMm <= ROOM_HEIGHT_LIMIT_MM &&
    rooms[0].faceFingerprint ===
      `rectangular:${second.xMm}:${third.zMm}:${STARTER_WALL_THICKNESS_MM}`;
  return matchesEdges && isCanonicalRectangle
    ? {
        roomId: rooms[0].roomId,
        vertexIds: [first.vertexId, second.vertexId, third.vertexId, fourth.vertexId],
        wallSegmentIds: [
          firstWall.wallSegmentId,
          secondWall.wallSegmentId,
          thirdWall.wallSegmentId,
          fourthWall.wallSegmentId
        ]
      }
    : undefined;
}

function withRectangle(
  project: Project,
  dimensions: ParsedDimensions,
  ids: RectangleIds,
  updatedAt: string
): Project {
  const vertices: readonly Vertex[] = [
    { vertexId: ids.vertexIds[0], xMm: 0, zMm: 0 },
    { vertexId: ids.vertexIds[1], xMm: dimensions.outerWidthMm, zMm: 0 },
    { vertexId: ids.vertexIds[2], xMm: dimensions.outerWidthMm, zMm: dimensions.outerDepthMm },
    { vertexId: ids.vertexIds[3], xMm: 0, zMm: dimensions.outerDepthMm }
  ];
  const wallSegments: readonly WallSegment[] = [
    createWall(ids.wallSegmentIds[0], ids.vertexIds[0], ids.vertexIds[1]),
    createWall(ids.wallSegmentIds[1], ids.vertexIds[1], ids.vertexIds[2]),
    createWall(ids.wallSegmentIds[2], ids.vertexIds[2], ids.vertexIds[3]),
    createWall(ids.wallSegmentIds[3], ids.vertexIds[3], ids.vertexIds[0])
  ];
  const rooms: readonly Room[] = [
    {
      faceFingerprint: `rectangular:${dimensions.outerWidthMm}:${dimensions.outerDepthMm}:${STARTER_WALL_THICKNESS_MM}`,
      heightMm: dimensions.heightMm,
      roomId: ids.roomId
    }
  ];
  return {
    ...project,
    level: { ...project.level, rooms, vertices, wallSegments },
    updatedAt
  };
}

function createWall(
  wallSegmentId: string,
  startVertexId: string,
  endVertexId: string
): WallSegment {
  return { endVertexId, startVertexId, thicknessMm: STARTER_WALL_THICKNESS_MM, wallSegmentId };
}
