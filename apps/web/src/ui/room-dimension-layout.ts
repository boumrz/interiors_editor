export interface RoomDimensionLayoutInput {
  readonly height: number;
  readonly labelWidth: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface KeyedRoomDimensionLayoutInput extends RoomDimensionLayoutInput {
  readonly key: string;
}

export type RoomDimensionLayout =
  | { readonly centerX: number; readonly centerY: number; readonly kind: 'inside' }
  | {
      readonly centerX: number;
      readonly centerY: number;
      readonly kind: 'outside';
      readonly leader: { readonly x1: number; readonly x2: number; readonly y1: number; readonly y2: number };
    };

const HORIZONTAL_CLEARANCE_PX = 12;
const VERTICAL_CLEARANCE_PX = 38;
const OUTSIDE_GAP_PX = 15;

/**
 * Places a two-line room annotation without treating a wall as label space.
 * This is a projection layout only: it never changes a room or its metrics.
 */
export function roomDimensionLayout(input: RoomDimensionLayoutInput): RoomDimensionLayout {
  if (
    input.width >= input.labelWidth + HORIZONTAL_CLEARANCE_PX &&
    input.height >= VERTICAL_CLEARANCE_PX
  ) {
    return {
      centerX: input.x + input.width / 2,
      centerY: input.y + input.height / 2,
      kind: 'inside'
    };
  }
  const anchorX = input.x + input.width;
  const anchorY = input.y;
  return {
    centerX: anchorX + OUTSIDE_GAP_PX + input.labelWidth / 2,
    centerY: anchorY - 6,
    kind: 'outside',
    leader: {
      x1: anchorX,
      x2: anchorX + OUTSIDE_GAP_PX,
      y1: anchorY,
      y2: anchorY - 6
    }
  };
}

/**
 * Allocates exterior labels in stable rows. Room geometry remains untouched;
 * only cramped annotations move so none of their two-line texts overlap.
 */
export function roomDimensionLayouts(
  inputs: readonly KeyedRoomDimensionLayoutInput[]
): ReadonlyMap<string, RoomDimensionLayout> {
  const result = new Map<string, RoomDimensionLayout>();
  const occupiedOutsideRows: { readonly y: number }[] = [];
  for (const input of [...inputs].sort((first, second) => first.y - second.y || first.x - second.x || first.key.localeCompare(second.key))) {
    const layout = roomDimensionLayout(input);
    if (layout.kind === 'inside') {
      result.set(input.key, layout);
      continue;
    }
    const row = occupiedOutsideRows.filter((occupied) => Math.abs(occupied.y - layout.centerY) < VERTICAL_CLEARANCE_PX).length;
    const offsetY = row * (VERTICAL_CLEARANCE_PX - 4);
    const allocated: RoomDimensionLayout = {
      ...layout,
      centerY: layout.centerY - offsetY,
      leader: {
        ...layout.leader,
        y2: layout.leader.y2 - offsetY
      }
    };
    occupiedOutsideRows.push({ y: allocated.centerY });
    result.set(input.key, allocated);
  }
  return result;
}
