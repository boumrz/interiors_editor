import {
  addWallSegment,
  type AddWallSegmentInput,
  type AddWallSegmentResult
} from './add-wall-segment';
import { deriveBoundedOrthogonalFaces, type DerivedOrthogonalFace, type PlanGraph } from './derive-plan-faces';
import type { FloorSchematicAssetInstanceV2, ProjectV2, RoomMetadataV2 } from './project-v2';

const DEFAULT_ROOM_HEIGHT_MM = 2600;

interface IdSource {
  next(): string;
}

interface RectangularFace {
  readonly fingerprint: string;
  readonly maxXMm: number;
  readonly maxZMm: number;
  readonly minXMm: number;
  readonly minZMm: number;
}

interface SourcePlan {
  readonly facesByFingerprint: ReadonlyMap<string, RectangularFace>;
  readonly metadataByRoomId: ReadonlyMap<string, RoomMetadataV2>;
  readonly metadataByFingerprint: ReadonlyMap<string, RoomMetadataV2>;
  readonly thicknessMm: number | undefined;
}

interface TargetFace {
  readonly face: RectangularFace;
  readonly parent?: RoomMetadataV2;
}

interface PlannedMutation {
  readonly itemTargetFingerprintById: ReadonlyMap<string, string>;
  readonly kind: 'planned';
  readonly targetFaces: readonly TargetFace[];
}

export type AddWallToProjectV2Result =
  | { readonly kind: 'accepted'; readonly project: ProjectV2 }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | Extract<AddWallSegmentResult, { readonly kind: 'rejected' }>['reasonCode']
        | 'INVALID_SOURCE_PROJECT'
        | 'ITEM_HOST_UNRESOLVABLE'
        | 'UNSUPPORTED_FACE_SHAPE'
        | 'UNSUPPORTED_WALL_THICKNESS';
    };

/**
 * Applies a cardinal free-wall command to v2 without recreating geometry from
 * Room metadata. The command first proves the entire resulting graph and
 * every affected item host using disposable IDs, then allocates persistent
 * graph/room IDs exactly once for the accepted mutation.
 */
export function addWallToProjectV2(
  source: ProjectV2,
  input: AddWallSegmentInput,
  ids: IdSource,
  updatedAt: string
): AddWallToProjectV2Result {
  // V2 is a compatibility-only route whose room reconciliation remains
  // rectangular. Keep its historical cardinal contract isolated while V1
  // progressively supports free 45-degree walls.
  if (input.start.xMm !== input.end.xMm && input.start.zMm !== input.end.zMm) {
    return reject('UNSUPPORTED_DIRECTION');
  }
  const sourcePlan = validateSource(source);
  if (!sourcePlan) {
    return reject('INVALID_SOURCE_PROJECT');
  }

  const preview = addWallSegment(graphOf(source), input, previewIds());
  if (preview.kind === 'rejected') {
    return preview;
  }
  const planned = planMutation(source, sourcePlan, preview.graph);
  if (planned.kind === 'rejected') {
    return planned;
  }

  const applied = addWallSegment(graphOf(source), input, ids);
  if (applied.kind === 'rejected') {
    return applied;
  }
  const derived = rectangularFacesFor(applied.graph);
  if (!derived) {
    return reject('UNSUPPORTED_FACE_SHAPE');
  }
  const roomIdsByFingerprint = materializeRoomIds(planned.targetFaces, ids);
  const roomMetadata = derived.map((face) => {
    const target = planned.targetFaces.find((candidate) => candidate.face.fingerprint === face.fingerprint);
    const roomId = roomIdsByFingerprint.get(face.fingerprint);
    if (!target || !roomId) {
      throw new Error('A proven v2 wall plan changed while persistent IDs were materialized');
    }
    return {
      faceFingerprint: face.fingerprint,
      heightMm: target.parent?.heightMm ?? defaultRoomHeight(source),
      roomId
    };
  });
  return {
    kind: 'accepted',
    project: {
      ...source,
      assetInstances: source.assetInstances.map((asset) => {
        const targetFingerprint = planned.itemTargetFingerprintById.get(asset.assetInstanceId);
        const roomId = targetFingerprint ? roomIdsByFingerprint.get(targetFingerprint) : undefined;
        if (!roomId) {
          throw new Error('A proven item host was not materialized with the v2 wall command');
        }
        return { ...asset, roomId };
      }),
      level: {
        ...source.level,
        roomMetadata,
        vertices: applied.graph.vertices,
        wallSegments: applied.graph.wallSegments
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
  if (!faces) {
    return undefined;
  }
  const thicknessMm = commonEvenWallThickness(project.level.wallSegments);
  if (project.level.wallSegments.length > 0 && thicknessMm === undefined) {
    return undefined;
  }
  const facesByFingerprint = new Map(faces.map((face) => [face.fingerprint, face]));
  const metadataByRoomId = new Map<string, RoomMetadataV2>();
  const metadataByFingerprint = new Map<string, RoomMetadataV2>();
  for (const metadata of project.level.roomMetadata) {
    if (
      !metadata.roomId ||
      !metadata.faceFingerprint ||
      !Number.isSafeInteger(metadata.heightMm) ||
      metadata.heightMm <= 0 ||
      metadataByRoomId.has(metadata.roomId) ||
      metadataByFingerprint.has(metadata.faceFingerprint) ||
      !facesByFingerprint.has(metadata.faceFingerprint)
    ) {
      return undefined;
    }
    metadataByRoomId.set(metadata.roomId, metadata);
    metadataByFingerprint.set(metadata.faceFingerprint, metadata);
  }
  if (metadataByFingerprint.size !== faces.length) {
    return undefined;
  }
  const usableThicknessMm = thicknessMm ?? 0;
  const assetIds = new Set<string>();
  for (const asset of project.assetInstances) {
    const metadata = metadataByRoomId.get(asset.roomId);
    const face = metadata ? facesByFingerprint.get(metadata.faceFingerprint) : undefined;
    if (!isValidAsset(asset, assetIds) || !face || !footprintFitsFace(asset, face, usableThicknessMm)) {
      return undefined;
    }
    assetIds.add(asset.assetInstanceId);
  }
  return { facesByFingerprint, metadataByFingerprint, metadataByRoomId, thicknessMm };
}

function planMutation(
  source: ProjectV2,
  sourcePlan: SourcePlan,
  previewGraph: PlanGraph
): PlannedMutation | Extract<AddWallToProjectV2Result, { readonly kind: 'rejected' }> {
  const faces = rectangularFacesFor(previewGraph);
  if (!faces) {
    return reject('UNSUPPORTED_FACE_SHAPE');
  }
  const thicknessMm = commonEvenWallThickness(previewGraph.wallSegments);
  if (!thicknessMm) {
    return reject('UNSUPPORTED_WALL_THICKNESS');
  }
  const targets = faces.map((face) => ({ face, parent: parentForFace(face, sourcePlan) }));
  if (!sourcePlanIsPreserved(sourcePlan, targets)) {
    return reject('INVALID_SOURCE_PROJECT');
  }
  const itemTargetFingerprintById = new Map<string, string>();
  for (const asset of source.assetInstances) {
    const sourceMetadata = sourcePlan.metadataByRoomId.get(asset.roomId);
    if (!sourceMetadata) {
      return reject('ITEM_HOST_UNRESOLVABLE');
    }
    const fits = targets.filter((target) =>
      target.parent?.roomId === sourceMetadata.roomId && footprintFitsFace(asset, target.face, thicknessMm)
    );
    const target = fits[0];
    if (!target || fits.length !== 1) {
      return reject('ITEM_HOST_UNRESOLVABLE');
    }
    itemTargetFingerprintById.set(asset.assetInstanceId, target.face.fingerprint);
  }
  return { itemTargetFingerprintById, kind: 'planned', targetFaces: targets };
}

function parentForFace(face: RectangularFace, sourcePlan: SourcePlan): RoomMetadataV2 | undefined {
  const exact = sourcePlan.metadataByFingerprint.get(face.fingerprint);
  if (exact) {
    return exact;
  }
  const parents = [...sourcePlan.facesByFingerprint.values()]
    .filter((candidate) => containsFace(candidate, face))
    .map((candidate) => sourcePlan.metadataByFingerprint.get(candidate.fingerprint))
    .filter((metadata): metadata is RoomMetadataV2 => metadata !== undefined);
  return parents.length === 1 ? parents[0] : undefined;
}

function sourcePlanIsPreserved(sourcePlan: SourcePlan, targets: readonly TargetFace[]): boolean {
  return [...sourcePlan.metadataByFingerprint.values()].every((metadata) =>
    targets.some((target) => target.parent?.roomId === metadata.roomId)
  );
}

function materializeRoomIds(
  targets: readonly TargetFace[],
  ids: IdSource
): ReadonlyMap<string, string> {
  const groupedByParent = new Map<string | undefined, TargetFace[]>();
  for (const target of targets) {
    const key = target.parent?.roomId;
    const group = groupedByParent.get(key) ?? [];
    group.push(target);
    groupedByParent.set(key, group);
  }
  const roomIds = new Map<string, string>();
  for (const [parentRoomId, group] of groupedByParent) {
    const sorted = [...group].sort((first, second) => compareText(first.face.fingerprint, second.face.fingerprint));
    sorted.forEach((target, index) => {
      roomIds.set(target.face.fingerprint, index === 0 && parentRoomId ? parentRoomId : ids.next());
    });
  }
  return roomIds;
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
  if (
    minXMm >= maxXMm ||
    minZMm >= maxZMm ||
    !face.vertices.every((vertex) => corners.has(coordinateKey(vertex.xMm, vertex.zMm)))
  ) {
    return undefined;
  }
  return { fingerprint: face.fingerprint, maxXMm, maxZMm, minXMm, minZMm };
}

function commonEvenWallThickness(
  walls: readonly { readonly thicknessMm: number }[]
): number | undefined {
  const first = walls[0]?.thicknessMm;
  if (first === undefined) {
    return undefined;
  }
  return Number.isSafeInteger(first) && first > 0 && first % 2 === 0 && walls.every((wall) => wall.thicknessMm === first)
    ? first
    : undefined;
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

function defaultRoomHeight(source: ProjectV2): number {
  return source.level.roomMetadata.length === 0
    ? DEFAULT_ROOM_HEIGHT_MM
    : Math.max(...source.level.roomMetadata.map((metadata) => metadata.heightMm));
}

function previewIds(): IdSource {
  let index = 0;
  return { next: () => `__v2_preview_${index++}` };
}

function coordinateKey(xMm: number, zMm: number): string {
  return `${xMm}:${zMm}`;
}

function compareText(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function reject(
  reasonCode: Extract<AddWallToProjectV2Result, { readonly kind: 'rejected' }>['reasonCode']
): Extract<AddWallToProjectV2Result, { readonly kind: 'rejected' }> {
  return { kind: 'rejected', reasonCode };
}
