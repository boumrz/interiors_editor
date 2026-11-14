export type OuterGridExpansionSide = 'bottom' | 'left' | 'right' | 'top';

export interface PlanBounds {
  readonly maxXMm: number;
  readonly maxZMm: number;
  readonly minXMm: number;
  readonly minZMm: number;
}

export interface PlanPoint {
  readonly xMm: number;
  readonly zMm: number;
}

export interface RectangularRoomDraft {
  readonly end: PlanPoint;
  readonly start: PlanPoint;
}

export interface OuterGridExpansionIntent {
  readonly amountMm: number;
  readonly side: OuterGridExpansionSide;
}

export interface V2RectangularRoomCandidate {
  readonly bounds: PlanBounds;
  readonly roomId: string;
}

export interface V2FullEdgeExtensionIntent extends OuterGridExpansionIntent {
  readonly roomId: string;
}

/**
 * Gesture coordinates are already snapped by the viewport. This helper only
 * normalizes their order and preserves integer-mm coordinates; it must not
 * encode the visual grid into the canonical room-loop command.
 */
export function rectangularRoomLoopInputForDraft(draft: RectangularRoomDraft): {
  readonly maxXMm: number;
  readonly maxZMm: number;
  readonly minXMm: number;
  readonly minZMm: number;
} | undefined {
  const minXMm = Math.min(draft.start.xMm, draft.end.xMm);
  const maxXMm = Math.max(draft.start.xMm, draft.end.xMm);
  const minZMm = Math.min(draft.start.zMm, draft.end.zMm);
  const maxZMm = Math.max(draft.start.zMm, draft.end.zMm);
  if (![minXMm, maxXMm, minZMm, maxZMm].every(Number.isSafeInteger) || minXMm === maxXMm || minZMm === maxZMm) {
    return undefined;
  }
  return { maxXMm, maxZMm, minXMm, minZMm };
}

export function deriveOuterGridExpansion(
  planBounds: PlanBounds,
  draft: RectangularRoomDraft
): OuterGridExpansionIntent | undefined {
  const minXMm = Math.min(draft.start.xMm, draft.end.xMm);
  const maxXMm = Math.max(draft.start.xMm, draft.end.xMm);
  const minZMm = Math.min(draft.start.zMm, draft.end.zMm);
  const maxZMm = Math.max(draft.start.zMm, draft.end.zMm);

  if (minZMm === planBounds.minZMm && maxZMm === planBounds.maxZMm) {
    if (minXMm === planBounds.maxXMm && maxXMm > planBounds.maxXMm) {
      return { amountMm: maxXMm - planBounds.maxXMm, side: 'right' };
    }
    if (maxXMm === planBounds.minXMm && minXMm < planBounds.minXMm) {
      return { amountMm: planBounds.minXMm - minXMm, side: 'left' };
    }
  }

  if (minXMm === planBounds.minXMm && maxXMm === planBounds.maxXMm) {
    if (minZMm === planBounds.maxZMm && maxZMm > planBounds.maxZMm) {
      return { amountMm: maxZMm - planBounds.maxZMm, side: 'bottom' };
    }
    if (maxZMm === planBounds.minZMm && minZMm < planBounds.minZMm) {
      return { amountMm: planBounds.minZMm - minZMm, side: 'top' };
    }
  }

  return undefined;
}

/**
 * Keeps V2 expansion scoped to one derived rectangular Room rather than the
 * complete project's bounds. The domain command independently revalidates
 * the room and its exterior wall before publishing a mutation.
 */
export function deriveV2FullEdgeExtensionIntent(
  rooms: readonly V2RectangularRoomCandidate[],
  draft: RectangularRoomDraft
): V2FullEdgeExtensionIntent | undefined {
  const candidates = rooms.flatMap((room) => {
    const expansion = deriveOuterGridExpansion(room.bounds, draft);
    return expansion ? [{ ...expansion, roomId: room.roomId }] : [];
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}
