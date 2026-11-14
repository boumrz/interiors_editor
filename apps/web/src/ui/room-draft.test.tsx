import { describe, expect, it } from '@rstest/core';

import {
  deriveOuterGridExpansion,
  deriveV2FullEdgeExtensionIntent,
  rectangularRoomLoopInputForDraft
} from './room-draft';

describe('rectangular room draft', () => {
  const planBounds = { maxXMm: 4000, maxZMm: 3000, minXMm: 0, minZMm: 0 };

  it('turns a snapped rectangle attached to the full right side into a grid expansion intent', () => {
    expect(deriveOuterGridExpansion(planBounds, {
      end: { xMm: 5000, zMm: 3000 },
      start: { xMm: 4000, zMm: 0 }
    })).toEqual({ amountMm: 1000, side: 'right' });
  });

  it('normalizes reverse drags and rejects a detached or partial rectangle without a mutation intent', () => {
    expect(deriveOuterGridExpansion(planBounds, {
      end: { xMm: -1000, zMm: 0 },
      start: { xMm: 0, zMm: 3000 }
    })).toEqual({ amountMm: 1000, side: 'left' });

    expect(deriveOuterGridExpansion(planBounds, {
      end: { xMm: 5000, zMm: 2800 },
      start: { xMm: 4000, zMm: 300 }
    })).toBeUndefined();
  });

  it('targets exactly the V2 room whose complete exterior side the draft extends', () => {
    const rooms = [
      { bounds: { maxXMm: 2000, maxZMm: 3000, minXMm: 0, minZMm: 0 }, roomId: 'room-left' },
      { bounds: { maxXMm: 4100, maxZMm: 3000, minXMm: 2000, minZMm: 0 }, roomId: 'room-right' }
    ];

    expect(deriveV2FullEdgeExtensionIntent(rooms, {
      end: { xMm: 5100, zMm: 3000 },
      start: { xMm: 4100, zMm: 0 }
    })).toEqual({ amountMm: 1000, roomId: 'room-right', side: 'right' });

    expect(deriveV2FullEdgeExtensionIntent(rooms, {
      end: { xMm: 2000, zMm: 1200 },
      start: { xMm: 0, zMm: 3000 }
    })).toBeUndefined();
  });

  it('turns a reverse drag into safe integer bounds for a detached room loop without imposing the gesture grid on the domain', () => {
    expect(rectangularRoomLoopInputForDraft({
      end: { xMm: 5000, zMm: 4100 },
      start: { xMm: 7200, zMm: 6600 }
    })).toEqual({ maxXMm: 7200, maxZMm: 6600, minXMm: 5000, minZMm: 4100 });

    expect(rectangularRoomLoopInputForDraft({
      end: { xMm: 5000.5, zMm: 4100 },
      start: { xMm: 7200, zMm: 6600 }
    })).toBeUndefined();
    expect(rectangularRoomLoopInputForDraft({
      end: { xMm: 5000, zMm: 4100 },
      start: { xMm: 5000, zMm: 6600 }
    })).toBeUndefined();
  });
});
