import { deleteWallSegment, type DeleteWallSegmentResult } from './delete-wall-segment';
import { deriveBoundedOrthogonalFaces, type DerivedOrthogonalFace, type PlanGraph } from './derive-plan-faces';
import type { FloorSchematicAssetInstanceV2, ProjectV2, RoomMetadataV2 } from './project-v2';
import type { Vertex, WallSegment } from './project';

interface RectangularFace {
  readonly fingerprint: string;
  readonly maxXMm: number;
  readonly maxZMm: number;
  readonly minXMm: number;
  readonly minZMm: number;
}

interface SourcePlan {
  readonly facesByFingerprint: ReadonlyMap<string, RectangularFace>;
  readonly metadataByFaceFingerprint: ReadonlyMap<string, RoomMetadataV2>;
}

interface PlannedFace {
  readonly face: RectangularFace;
  readonly retainedRoom: RoomMetadataV2;
}

interface PlannedMutation {
  readonly itemRoomIdByAssetId: ReadonlyMap<string, string>;
  readonly kind: 'planned';
  readonly faces: readonly PlannedFace[];
}

export type DeleteWallFromProjectV2Result =
  | { readonly kind: 'accepted'; readonly project: ProjectV2 }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | Extract<DeleteWallSegmentResult, { readonly kind: 'rejected' }>['reasonCode']
        | 'INVALID_RESULTING_PROJECT'
        | 'INVALID_SOURCE_PROJECT'
        | 'ITEM_HOST_UNRESOLVABLE'
        | 'ROOM_HEIGHT_CONFLICT'
        | 'UNSUPPORTED_FACE_SHAPE'
        | 'UNSUPPORTED_WALL_THICKNESS';
    };

/**
 * Deletes one v2 wall while retaining only metadata that can be reattached to
 * a face derived from the resulting PlanGraph.  A merged room must have one
 * canonical height; furniture is rehosted only after its whole footprint is
 * proved to fit exactly one resulting usable room.
 */
export function deleteWallFromProjectV2(
  source: ProjectV2,
  input: { readonly wallSegmentId: string },
  updatedAt: string
): DeleteWallFromProjectV2Result {
  const sourcePlan = validateSource(source);
  if (!sourcePlan) {
    return reject('INVALID_SOURCE_PROJECT');
  }

  const graphResult = deleteWallSegment(graphOf(source), input.wallSegmentId);
  if (graphResult.kind === 'rejected') {
    return graphResult;
  }
  const compactedGraph = coalesceRedundantVertices(graphResult.graph);
  if (deriveBoundedOrthogonalFaces(compactedGraph).kind === 'rejected') {
    return reject('INVALID_RESULTING_PROJECT');
  }
  const planned = planMutation(source, sourcePlan, compactedGraph);
  if (planned.kind === 'rejected') {
    return planned;
  }

  return {
    kind: 'accepted',
    project: {
      ...source,
      assetInstances: source.assetInstances.map((asset) => {
        const roomId = planned.itemRoomIdByAssetId.get(asset.assetInstanceId);
        if (!roomId) {
          throw new Error('A proven v2 item host disappeared while deleting a wall');
        }
        return { ...asset, roomId };
      }),
      level: {
        ...source.level,
        roomMetadata: planned.faces.map(({ face, retainedRoom }) => ({
          faceFingerprint: face.fingerprint,
          heightMm: retainedRoom.heightMm,
          roomId: retainedRoom.roomId
        })),
        vertices: compactedGraph.vertices,
        wallSegments: compactedGraph.wallSegments
      },
      updatedAt
    }
  };
}

function graphOf(project: ProjectV2): PlanGraph {
  return { vertices: project.level.vertices, wallSegments: project.level.wallSegments };
}

function validateSource(project: ProjectV2): SourcePlan | undefined {
  const faces = rectangularFacesFor(graphOf(project));
  const thicknessMm = commonEvenWallThickness(project.level.wallSegments);
  if (!faces || thicknessMm === undefined) {
    return undefined;
  }
  const facesByFingerprint = new Map(faces.map((face) => [face.fingerprint, face]));
  const metadataByFaceFingerprint = new Map<string, RoomMetadataV2>();
  const metadataByRoomId = new Map<string, RoomMetadataV2>();
  for (const metadata of project.level.roomMetadata) {
    if (
      !metadata.roomId ||
      !metadata.faceFingerprint ||
      !Number.isSafeInteger(metadata.heightMm) ||
      metadata.heightMm <= 0 ||
      metadataByFaceFingerprint.has(metadata.faceFingerprint) ||
      metadataByRoomId.has(metadata.roomId) ||
      !facesByFingerprint.has(metadata.faceFingerprint)
    ) {
      return undefined;
    }
    metadataByFaceFingerprint.set(metadata.faceFingerprint, metadata);
    metadataByRoomId.set(metadata.roomId, metadata);
  }
  if (metadataByFaceFingerprint.size !== faces.length) {
    return undefined;
  }

  const assetIds = new Set<string>();
  for (const asset of project.assetInstances) {
    const metadata = metadataByRoomId.get(asset.roomId);
    const face = metadata ? facesByFingerprint.get(metadata.faceFingerprint) : undefined;
    if (!isValidAsset(asset, assetIds) || !face || !footprintFitsFace(asset, face, thicknessMm)) {
      return undefined;
    }
    assetIds.add(asset.assetInstanceId);
  }
  if (hasAssetCollision(project.assetInstances)) {
    return undefined;
  }
  return { facesByFingerprint, metadataByFaceFingerprint };
}

function planMutation(
  source: ProjectV2,
  sourcePlan: SourcePlan,
  resultingGraph: PlanGraph
): PlannedMutation | Extract<DeleteWallFromProjectV2Result, { readonly kind: 'rejected' }> {
  const faces = rectangularFacesFor(resultingGraph);
  const thicknessMm = commonEvenWallThickness(resultingGraph.wallSegments);
  if (!faces) {
    return reject('UNSUPPORTED_FACE_SHAPE');
  }
  if (resultingGraph.wallSegments.length > 0 && thicknessMm === undefined) {
    return reject('UNSUPPORTED_WALL_THICKNESS');
  }

  const plannedFaces: PlannedFace[] = [];
  for (const face of faces) {
    const contributors = [...sourcePlan.facesByFingerprint.values()]
      .filter((sourceFace) => containsFace(face, sourceFace))
      .map((sourceFace) => sourcePlan.metadataByFaceFingerprint.get(sourceFace.fingerprint))
      .filter((metadata): metadata is RoomMetadataV2 => metadata !== undefined)
      .sort((first, second) => compareText(first.roomId, second.roomId));
    if (contributors.length === 0) {
      return reject('INVALID_RESULTING_PROJECT');
    }
    if (new Set(contributors.map((metadata) => metadata.heightMm)).size !== 1) {
      return reject('ROOM_HEIGHT_CONFLICT');
    }
    const retainedRoom = contributors[0];
    if (!retainedRoom) {
      return reject('INVALID_RESULTING_PROJECT');
    }
    plannedFaces.push({ face, retainedRoom });
  }

  const itemRoomIdByAssetId = new Map<string, string>();
  for (const asset of source.assetInstances) {
    const hosts = thicknessMm === undefined
      ? []
      : plannedFaces.filter(({ face }) => footprintFitsFace(asset, face, thicknessMm));
    const host = hosts[0];
    if (!host || hosts.length !== 1) {
      return reject('ITEM_HOST_UNRESOLVABLE');
    }
    itemRoomIdByAssetId.set(asset.assetInstanceId, host.retainedRoom.roomId);
  }
  return { faces: plannedFaces, itemRoomIdByAssetId, kind: 'planned' };
}

function rectangularFacesFor(graph: PlanGraph): readonly RectangularFace[] | undefined {
  const derived = deriveBoundedOrthogonalFaces(graph);
  if (derived.kind === 'rejected') {
    return undefined;
  }
  const faces: RectangularFace[] = [];
  for (const face of derived.faces) {
    const rectangle = rectangleFor(face);
    if (!rectangle) {
      return undefined;
    }
    faces.push(rectangle);
  }
  return faces;
}

function rectangleFor(face: DerivedOrthogonalFace): RectangularFace | undefined {
  if (face.vertices.length !== 4) {
    return undefined;
  }
  const minXMm = Math.min(...face.vertices.map((vertex) => vertex.xMm));
  const maxXMm = Math.max(...face.vertices.map((vertex) => vertex.xMm));
  const minZMm = Math.min(...face.vertices.map((vertex) => vertex.zMm));
  const maxZMm = Math.max(...face.vertices.map((vertex) => vertex.zMm));
  const corners = new Set([
    coordinateKey(minXMm, minZMm),
    coordinateKey(minXMm, maxZMm),
    coordinateKey(maxXMm, minZMm),
    coordinateKey(maxXMm, maxZMm)
  ]);
  return minXMm < maxXMm && minZMm < maxZMm &&
    face.vertices.every((vertex) => corners.has(coordinateKey(vertex.xMm, vertex.zMm)))
    ? { fingerprint: face.fingerprint, maxXMm, maxZMm, minXMm, minZMm }
    : undefined;
}

function commonEvenWallThickness(
  walls: readonly { readonly thicknessMm: number }[]
): number | undefined {
  const first = walls[0]?.thicknessMm;
  return first !== undefined &&
    Number.isSafeInteger(first) && first > 0 && first % 2 === 0 &&
    walls.every((wall) => wall.thicknessMm === first)
    ? first
    : undefined;
}

/**
 * Adding a T-contact splits the touched wall. Once its branch is removed,
 * keeping the two artificial pieces would leak topology noise into every
 * future command. Collapse only degree-two collinear joins of equal thickness
 * and retain the first segment's durable ID and list position.
 */
function coalesceRedundantVertices(graph: PlanGraph): PlanGraph {
  let vertices = [...graph.vertices];
  let wallSegments = [...graph.wallSegments];
  let changed = true;
  while (changed) {
    changed = false;
    const verticesById = new Map(vertices.map((vertex) => [vertex.vertexId, vertex]));
    for (const vertex of vertices) {
      const incident = wallSegments.filter((wall) =>
        wall.startVertexId === vertex.vertexId || wall.endVertexId === vertex.vertexId
      );
      const merged = incident.length === 2
        ? mergeCollinearWalls(incident[0], incident[1], vertex, verticesById)
        : undefined;
      if (!merged) {
        continue;
      }
      const first = incident[0];
      const second = incident[1];
      if (!first || !second) {
        continue;
      }
      wallSegments = wallSegments
        .filter((wall) => wall.wallSegmentId !== second.wallSegmentId)
        .map((wall) => wall.wallSegmentId === first.wallSegmentId ? merged : wall);
      vertices = vertices.filter((candidate) => candidate.vertexId !== vertex.vertexId);
      changed = true;
      break;
    }
  }
  return { vertices, wallSegments };
}

function mergeCollinearWalls(
  first: WallSegment | undefined,
  second: WallSegment | undefined,
  joinedAt: Vertex,
  verticesById: ReadonlyMap<string, Vertex>
): WallSegment | undefined {
  if (!first || !second || first.thicknessMm !== second.thicknessMm) {
    return undefined;
  }
  const firstOtherVertexId = otherEndpoint(first, joinedAt.vertexId);
  const secondOtherVertexId = otherEndpoint(second, joinedAt.vertexId);
  const firstOther = firstOtherVertexId ? verticesById.get(firstOtherVertexId) : undefined;
  const secondOther = secondOtherVertexId ? verticesById.get(secondOtherVertexId) : undefined;
  if (!firstOther || !secondOther || !areCollinear(firstOther, joinedAt, secondOther)) {
    return undefined;
  }
  return first.startVertexId === joinedAt.vertexId
    ? { ...first, startVertexId: secondOther.vertexId }
    : { ...first, endVertexId: secondOther.vertexId };
}

function otherEndpoint(wall: WallSegment, vertexId: string): string | undefined {
  if (wall.startVertexId === vertexId) {
    return wall.endVertexId;
  }
  if (wall.endVertexId === vertexId) {
    return wall.startVertexId;
  }
  return undefined;
}

function areCollinear(first: Vertex, joinedAt: Vertex, second: Vertex): boolean {
  return (first.xMm === joinedAt.xMm && joinedAt.xMm === second.xMm) ||
    (first.zMm === joinedAt.zMm && joinedAt.zMm === second.zMm);
}

function containsFace(container: RectangularFace, child: RectangularFace): boolean {
  return child.minXMm >= container.minXMm && child.maxXMm <= container.maxXMm &&
    child.minZMm >= container.minZMm && child.maxZMm <= container.maxZMm;
}

function footprintFitsFace(
  asset: Pick<FloorSchematicAssetInstanceV2, 'depthMm' | 'widthMm' | 'xMm' | 'zMm'>,
  face: RectangularFace,
  thicknessMm: number
): boolean {
  const halfThicknessMm = thicknessMm / 2;
  return asset.xMm - asset.widthMm / 2 >= face.minXMm + halfThicknessMm &&
    asset.xMm + asset.widthMm / 2 <= face.maxXMm - halfThicknessMm &&
    asset.zMm - asset.depthMm / 2 >= face.minZMm + halfThicknessMm &&
    asset.zMm + asset.depthMm / 2 <= face.maxZMm - halfThicknessMm;
}

function isValidAsset(
  asset: FloorSchematicAssetInstanceV2,
  assetIds: ReadonlySet<string>
): boolean {
  return asset.anchorClass === 'floor' &&
    Boolean(asset.assetInstanceId) &&
    !assetIds.has(asset.assetInstanceId) &&
    Boolean(asset.roomId) &&
    asset.label.trim().length > 0 &&
    /^#[0-9a-fA-F]{6}$/.test(asset.color) &&
    [asset.xMm, asset.zMm, asset.widthMm, asset.depthMm, asset.heightMm].every(Number.isSafeInteger) &&
    asset.widthMm > 0 && asset.depthMm > 0 && asset.heightMm > 0;
}

function hasAssetCollision(assets: readonly FloorSchematicAssetInstanceV2[]): boolean {
  return assets.some((asset, index) => assets.slice(index + 1).some((other) =>
    asset.xMm - asset.widthMm / 2 < other.xMm + other.widthMm / 2 &&
    asset.xMm + asset.widthMm / 2 > other.xMm - other.widthMm / 2 &&
    asset.zMm - asset.depthMm / 2 < other.zMm + other.depthMm / 2 &&
    asset.zMm + asset.depthMm / 2 > other.zMm - other.depthMm / 2
  ));
}

function coordinateKey(xMm: number, zMm: number): string {
  return `${xMm}:${zMm}`;
}

function compareText(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function reject(
  reasonCode: Extract<DeleteWallFromProjectV2Result, { readonly kind: 'rejected' }>['reasonCode']
): Extract<DeleteWallFromProjectV2Result, { readonly kind: 'rejected' }> {
  return { kind: 'rejected', reasonCode };
}
