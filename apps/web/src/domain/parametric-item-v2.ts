import { resolveProjectV2Plan } from './derived-project-v2-plan';
import type {
  DeleteParametricFloorItemInput,
  MoveParametricFloorItemInput,
  ParametricFloorItemInput,
  ResizeParametricFloorItemInput
} from './parametric-item';
import type { FloorSchematicAssetInstanceV2, ProjectV2 } from './project-v2';

interface IdSource {
  next(): string;
}

type V2ItemResult =
  | { readonly kind: 'accepted'; readonly project: ProjectV2 }
  | { readonly kind: 'rejected'; readonly reasonCode: 'INVALID_DIMENSION' | 'ITEM_COLLISION' | 'OUTSIDE_ROOM_HOST' };

export type DeleteParametricFloorItemV2Result =
  | { readonly kind: 'accepted'; readonly project: ProjectV2 }
  | { readonly kind: 'rejected'; readonly reasonCode: 'ITEM_NOT_FOUND' };

export function createParametricFloorItemV2(
  project: ProjectV2,
  input: ParametricFloorItemInput,
  ids: IdSource,
  updatedAt: string
): V2ItemResult {
  if (!isValidInput(project, input)) {
    return reject('INVALID_DIMENSION');
  }
  const roomId = findRoomForFloorItemV2(project, input);
  if (!roomId || roomId !== input.roomId) {
    return reject('OUTSIDE_ROOM_HOST');
  }
  if (hasCollision(project, input)) {
    return reject('ITEM_COLLISION');
  }
  return {
    kind: 'accepted',
    project: {
      ...project,
      assetInstances: [...project.assetInstances, {
        anchorClass: 'floor',
        assetInstanceId: ids.next(),
        color: input.color,
        depthMm: input.depthMm,
		elevationMm: 0,
        heightMm: input.heightMm,
        label: input.label,
        roomId,
        widthMm: input.widthMm,
        xMm: input.xMm,
        zMm: input.zMm
      }],
      updatedAt
    }
  };
}

export function moveParametricFloorItemV2(
  project: ProjectV2,
  input: MoveParametricFloorItemInput,
  updatedAt: string
): V2ItemResult {
  const item = project.assetInstances.find((candidate) => candidate.assetInstanceId === input.assetInstanceId);
  if (!item || !isFiniteInteger(input.xMm) || !isFiniteInteger(input.zMm)) {
    return reject('INVALID_DIMENSION');
  }
  const moved = { ...item, xMm: input.xMm, zMm: input.zMm };
  const roomId = findRoomForFloorItemV2(project, moved);
  if (!roomId) {
    return reject('OUTSIDE_ROOM_HOST');
  }
  if (hasCollision(project, moved, item.assetInstanceId)) {
    return reject('ITEM_COLLISION');
  }
  return updateItem(project, item.assetInstanceId, { ...moved, roomId }, updatedAt);
}

export function resizeParametricFloorItemV2(
  project: ProjectV2,
  input: ResizeParametricFloorItemInput,
  updatedAt: string
): V2ItemResult {
  const item = project.assetInstances.find((candidate) => candidate.assetInstanceId === input.assetInstanceId);
  if (!item || ![input.widthMm, input.depthMm, input.heightMm].every(isPositiveInteger)) {
    return reject('INVALID_DIMENSION');
  }
  const resized = {
    ...item,
    depthMm: input.depthMm,
    heightMm: input.heightMm,
    widthMm: input.widthMm
  };
  const roomId = findRoomForFloorItemV2(project, resized);
  if (!roomId) {
    return reject('OUTSIDE_ROOM_HOST');
  }
  if (hasCollision(project, resized, item.assetInstanceId)) {
    return reject('ITEM_COLLISION');
  }
  return updateItem(project, item.assetInstanceId, { ...resized, roomId }, updatedAt);
}

export function deleteParametricFloorItemV2(
  project: ProjectV2,
  input: DeleteParametricFloorItemInput,
  updatedAt: string
): DeleteParametricFloorItemV2Result {
  if (!project.assetInstances.some((item) => item.assetInstanceId === input.assetInstanceId)) {
    return { kind: 'rejected', reasonCode: 'ITEM_NOT_FOUND' };
  }
  return {
    kind: 'accepted',
    project: {
      ...project,
      assetInstances: project.assetInstances.filter((item) => item.assetInstanceId !== input.assetInstanceId),
      updatedAt
    }
  };
}

/** Finds the sole v2 room whose usable derived floor tile fully contains the footprint. */
export function findRoomForFloorItemV2(
  project: ProjectV2,
  footprint: Pick<FloorSchematicAssetInstanceV2, 'depthMm' | 'widthMm' | 'xMm' | 'zMm'>
): string | undefined {
  if (!isValidFootprint(footprint)) {
    return undefined;
  }
  const resolved = resolveProjectV2Plan(project);
  if (resolved.kind === 'rejected') {
    return undefined;
  }
  const roomIds = resolved.plan.rooms
    .filter((room) => room.usableFloorTilesMm.some((tile) => footprintFitsTile(footprint, tile)))
    .map((room) => room.roomId);
  return roomIds.length === 1 ? roomIds[0] : undefined;
}

function updateItem(
  project: ProjectV2,
  assetInstanceId: string,
  updated: FloorSchematicAssetInstanceV2,
  updatedAt: string
): V2ItemResult {
  return {
    kind: 'accepted',
    project: {
      ...project,
      assetInstances: project.assetInstances.map((item) =>
        item.assetInstanceId === assetInstanceId ? updated : item
      ),
      updatedAt
    }
  };
}

function isValidInput(project: ProjectV2, input: ParametricFloorItemInput): boolean {
  return Boolean(input.roomId) &&
    input.label.trim().length > 0 &&
    /^#[0-9a-fA-F]{6}$/.test(input.color) &&
    [input.xMm, input.zMm, input.widthMm, input.depthMm, input.heightMm].every(isFiniteInteger) &&
    input.widthMm > 0 && input.depthMm > 0 && input.heightMm > 0 &&
    project.level.roomMetadata.some((room) => room.roomId === input.roomId);
}

function hasCollision(
  project: ProjectV2,
  footprint: Pick<FloorSchematicAssetInstanceV2, 'depthMm' | 'widthMm' | 'xMm' | 'zMm'>,
  excludedAssetInstanceId?: string
): boolean {
  return project.assetInstances.some((item) =>
    item.assetInstanceId !== excludedAssetInstanceId && footprintsOverlap(footprint, item)
  );
}

function footprintFitsTile(
  footprint: Pick<FloorSchematicAssetInstanceV2, 'depthMm' | 'widthMm' | 'xMm' | 'zMm'>,
  tile: { readonly maxXmm: number; readonly maxZmm: number; readonly minXmm: number; readonly minZmm: number }
): boolean {
  return footprint.xMm - footprint.widthMm / 2 >= tile.minXmm &&
    footprint.xMm + footprint.widthMm / 2 <= tile.maxXmm &&
    footprint.zMm - footprint.depthMm / 2 >= tile.minZmm &&
    footprint.zMm + footprint.depthMm / 2 <= tile.maxZmm;
}

function footprintsOverlap(
  first: Pick<FloorSchematicAssetInstanceV2, 'depthMm' | 'widthMm' | 'xMm' | 'zMm'>,
  second: Pick<FloorSchematicAssetInstanceV2, 'depthMm' | 'widthMm' | 'xMm' | 'zMm'>
): boolean {
  return first.xMm - first.widthMm / 2 < second.xMm + second.widthMm / 2 &&
    first.xMm + first.widthMm / 2 > second.xMm - second.widthMm / 2 &&
    first.zMm - first.depthMm / 2 < second.zMm + second.depthMm / 2 &&
    first.zMm + first.depthMm / 2 > second.zMm - second.depthMm / 2;
}

function isValidFootprint(
  footprint: Pick<FloorSchematicAssetInstanceV2, 'depthMm' | 'widthMm' | 'xMm' | 'zMm'>
): boolean {
  return [footprint.xMm, footprint.zMm, footprint.widthMm, footprint.depthMm].every(isFiniteInteger) &&
    footprint.widthMm > 0 && footprint.depthMm > 0;
}

function isFiniteInteger(value: number): boolean {
  return Number.isSafeInteger(value);
}

function isPositiveInteger(value: number): boolean {
  return isFiniteInteger(value) && value > 0;
}

function reject(reasonCode: Extract<V2ItemResult, { readonly kind: 'rejected' }>['reasonCode']): V2ItemResult {
  return { kind: 'rejected', reasonCode };
}
