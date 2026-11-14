import { deriveBoundedOrthogonalFaces, type DerivedOrthogonalFace } from './derive-plan-faces';
import type {
  AxisAlignedRectMm,
  AxisNormal,
  DerivedOrthogonalPlanFaces,
  DerivedOrthogonalRoomFace,
  DerivedOrthogonalWall
} from './derived-orthogonal-plan-faces';
import {
  addExactMeasurement,
  exactMeasurement,
  multiplyExactMeasurementByInteger,
  multiplyExactMeasurements
} from './exact-quadratic-surd';
import type { ProjectV2, RoomMetadataV2 } from './project-v2';

const DEFAULT_ROOM_HEIGHT_MM = 2600;

type ResolveFailure = {
  readonly kind: 'rejected';
  readonly reasonCode:
    | 'PLAN_FACE_DERIVATION_REJECTED'
    | 'ROOM_FACE_RECONCILIATION_FAILED'
    | 'UNSUPPORTED_FACE_SHAPE'
    | 'UNSUPPORTED_WALL_THICKNESS';
};

export type ResolveProjectV2PlanResult =
  | { readonly kind: 'accepted'; readonly plan: DerivedOrthogonalPlanFaces }
  | ResolveFailure;

interface RectangularFace {
  readonly boundaryWallSegmentIds: readonly string[];
  readonly bounds: AxisAlignedRectMm;
  readonly fingerprint: string;
}

/**
 * Creates an ephemeral 2D/3D projection for a v2 PlanGraph. Room metadata
 * is matched by a face fingerprint; it never provides the face geometry.
 * Open wall graphs are valid editing states and intentionally project no
 * floor until a bounded face is actually closed.
 */
export function resolveProjectV2Plan(project: ProjectV2): ResolveProjectV2PlanResult {
  const thicknessMm = commonEvenThickness(project.level.wallSegments);
  if (project.level.wallSegments.length > 0 && thicknessMm === undefined) {
    return reject('UNSUPPORTED_WALL_THICKNESS');
  }
  const derived = deriveBoundedOrthogonalFaces({
    vertices: project.level.vertices,
    wallSegments: project.level.wallSegments
  });
  if (derived.kind === 'rejected') {
    return reject('PLAN_FACE_DERIVATION_REJECTED');
  }
  const faces: RectangularFace[] = [];
  for (const face of derived.faces) {
    const rectangle = rectangleFor(face);
    if (!rectangle) {
      return reject('UNSUPPORTED_FACE_SHAPE');
    }
    faces.push(rectangle);
  }
  const metadataByFingerprint = metadataIndex(project.level.roomMetadata);
  if (!metadataByFingerprint || metadataByFingerprint.size !== faces.length) {
    return reject('ROOM_FACE_RECONCILIATION_FAILED');
  }
  const roomByFaceFingerprint = new Map<string, RoomMetadataV2>();
  for (const face of faces) {
    const room = metadataByFingerprint.get(face.fingerprint);
    if (!room) {
      return reject('ROOM_FACE_RECONCILIATION_FAILED');
    }
    roomByFaceFingerprint.set(face.fingerprint, room);
  }
  const verticesById = new Map(project.level.vertices.map((vertex) => [vertex.vertexId, vertex]));
  const ownersByWallId = ownersForFaces(faces, roomByFaceFingerprint);
  if (!ownersByWallId) {
    return reject('ROOM_FACE_RECONCILIATION_FAILED');
  }
  const fallbackHeightMm = Math.max(
    DEFAULT_ROOM_HEIGHT_MM,
    ...project.level.roomMetadata.map((room) => room.heightMm)
  );
  const walls: DerivedOrthogonalWall[] = [];
  for (const wall of project.level.wallSegments) {
    const owners = ownersByWallId.get(wall.wallSegmentId) ?? [];
    const heightMm = owners.length === 0
      ? fallbackHeightMm
      : Math.max(...owners.map((owner) => owner.room.heightMm));
    if (owners.length === 1) {
      const owner = owners[0];
      if (!owner) {
        return reject('ROOM_FACE_RECONCILIATION_FAILED');
      }
      const normal = exteriorNormalFor(owner.face.bounds, wall, verticesById);
      if (!normal) {
        return reject('ROOM_FACE_RECONCILIATION_FAILED');
      }
      walls.push({ exteriorNormal: normal, heightMm, wallSegmentId: wall.wallSegmentId });
    } else {
      walls.push({ heightMm, wallSegmentId: wall.wallSegmentId });
    }
  }
  const usableInsetMm = (thicknessMm ?? 0) / 2;
  const rooms = faces.map((face) => {
    const room = roomByFaceFingerprint.get(face.fingerprint);
    if (!room) {
      throw new Error('A verified v2 room disappeared while creating its projection');
    }
    const usableFloorTileMm = {
      maxXmm: face.bounds.maxXmm - usableInsetMm,
      maxZmm: face.bounds.maxZmm - usableInsetMm,
      minXmm: face.bounds.minXmm + usableInsetMm,
      minZmm: face.bounds.minZmm + usableInsetMm
    };
    const usableWidthMm = usableFloorTileMm.maxXmm - usableFloorTileMm.minXmm;
    const usableDepthMm = usableFloorTileMm.maxZmm - usableFloorTileMm.minZmm;
    const usableWidth = exactMeasurement(BigInt(usableWidthMm));
    const usableDepth = exactMeasurement(BigInt(usableDepthMm));
    return {
      boundaryWallSegmentIds: face.boundaryWallSegmentIds,
      faceTilesMm: [face.bounds],
      heightMm: room.heightMm,
      roomId: room.roomId,
      usableFloorAreaMm2: multiplyExactMeasurements(usableWidth, usableDepth),
      usableFloorPerimeterMm: multiplyExactMeasurementByInteger(
        addExactMeasurement(usableWidth, usableDepth),
        2n
      ),
      usableFloorTilesMm: [usableFloorTileMm]
    } satisfies DerivedOrthogonalRoomFace;
  }).sort((first, second) => compareText(first.roomId, second.roomId));
  return { kind: 'accepted', plan: { rooms, walls } };
}

function commonEvenThickness(walls: readonly { readonly thicknessMm: number }[]): number | undefined {
  const first = walls[0]?.thicknessMm;
  if (first === undefined) {
    return undefined;
  }
  return Number.isSafeInteger(first) && first > 0 && first % 2 === 0 && walls.every((wall) => wall.thicknessMm === first)
    ? first
    : undefined;
}

function rectangleFor(face: DerivedOrthogonalFace): RectangularFace | undefined {
  if (face.vertices.length !== 4) {
    return undefined;
  }
  const minXmm = Math.min(...face.vertices.map((vertex) => vertex.xMm));
  const maxXmm = Math.max(...face.vertices.map((vertex) => vertex.xMm));
  const minZmm = Math.min(...face.vertices.map((vertex) => vertex.zMm));
  const maxZmm = Math.max(...face.vertices.map((vertex) => vertex.zMm));
  const bounds = { maxXmm, maxZmm, minXmm, minZmm };
  const corners = new Set([
    coordinateKey(minXmm, minZmm),
    coordinateKey(minXmm, maxZmm),
    coordinateKey(maxXmm, minZmm),
    coordinateKey(maxXmm, maxZmm)
  ]);
  return minXmm < maxXmm && minZmm < maxZmm &&
    face.vertices.every((vertex) => corners.has(coordinateKey(vertex.xMm, vertex.zMm)))
    ? {
        boundaryWallSegmentIds: [...face.boundaryWallSegmentIds].sort(compareText),
        bounds,
        fingerprint: face.fingerprint
      }
    : undefined;
}

function metadataIndex(
  metadata: readonly RoomMetadataV2[]
): ReadonlyMap<string, RoomMetadataV2> | undefined {
  const byFingerprint = new Map<string, RoomMetadataV2>();
  const roomIds = new Set<string>();
  for (const room of metadata) {
    if (
      !room.roomId ||
      !room.faceFingerprint ||
      roomIds.has(room.roomId) ||
      byFingerprint.has(room.faceFingerprint) ||
      !Number.isSafeInteger(room.heightMm) ||
      room.heightMm <= 0
    ) {
      return undefined;
    }
    roomIds.add(room.roomId);
    byFingerprint.set(room.faceFingerprint, room);
  }
  return byFingerprint;
}

function ownersForFaces(
  faces: readonly RectangularFace[],
  roomsByFingerprint: ReadonlyMap<string, RoomMetadataV2>
): ReadonlyMap<string, readonly { readonly face: RectangularFace; readonly room: RoomMetadataV2 }[]> | undefined {
  const owners = new Map<string, Array<{ readonly face: RectangularFace; readonly room: RoomMetadataV2 }>>();
  for (const face of faces) {
    const room = roomsByFingerprint.get(face.fingerprint);
    if (!room) {
      return undefined;
    }
    for (const wallSegmentId of face.boundaryWallSegmentIds) {
      const existing = owners.get(wallSegmentId) ?? [];
      if (existing.some((owner) => owner.room.roomId === room.roomId)) {
        return undefined;
      }
      existing.push({ face, room });
      owners.set(wallSegmentId, existing);
    }
  }
  return owners;
}

function exteriorNormalFor(
  bounds: AxisAlignedRectMm,
  wall: { readonly endVertexId: string; readonly startVertexId: string },
  verticesById: ReadonlyMap<string, { readonly xMm: number; readonly zMm: number }>
): AxisNormal | undefined {
  const start = verticesById.get(wall.startVertexId);
  const end = verticesById.get(wall.endVertexId);
  if (!start || !end) {
    return undefined;
  }
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

function coordinateKey(xMm: number, zMm: number): string {
  return `${xMm}:${zMm}`;
}

function compareText(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function reject(reasonCode: ResolveFailure['reasonCode']): ResolveFailure {
  return { kind: 'rejected', reasonCode };
}
