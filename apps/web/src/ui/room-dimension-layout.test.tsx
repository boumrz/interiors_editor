import { describe, expect, it } from '@rstest/core';

import { roomDimensionLayout, roomDimensionLayouts } from './room-dimension-layout';

describe('roomDimensionLayout', () => {
  it('keeps dimensions inside a room only when their two-line annotation has clearance', () => {
    expect(roomDimensionLayout({ height: 84, labelWidth: 72, width: 120, x: 20, y: 30 })).toEqual({
      centerX: 80,
      centerY: 72,
      kind: 'inside'
    });
  });

  it('moves a cramped dimension outside with a leader instead of drawing it over a wall', () => {
    expect(roomDimensionLayout({ height: 28, labelWidth: 72, width: 54, x: 20, y: 30 })).toEqual({
      centerX: 125,
      centerY: 24,
      kind: 'outside',
      leader: { x1: 74, x2: 89, y1: 30, y2: 24 }
    });
  });

  it('treats the exact clearance edge as usable, while either missing axis keeps the label outside', () => {
    expect(roomDimensionLayout({ height: 38, labelWidth: 72, width: 84, x: 0, y: 0 }).kind).toBe('inside');
    expect(roomDimensionLayout({ height: 37, labelWidth: 72, width: 84, x: 0, y: 0 }).kind).toBe('outside');
    expect(roomDimensionLayout({ height: 38, labelWidth: 72, width: 72, x: 0, y: 0 }).kind).toBe('outside');
  });

  it('stacks cramped room callouts into separate readable outside rows', () => {
    const layouts = roomDimensionLayouts([
      { height: 28, key: 'room-a', labelWidth: 72, width: 54, x: 20, y: 30 },
      { height: 28, key: 'room-b', labelWidth: 72, width: 54, x: 20, y: 30 }
    ]);

    expect(layouts.get('room-a')).toEqual(expect.objectContaining({ kind: 'outside', centerY: 24 }));
    expect(layouts.get('room-b')).toEqual(expect.objectContaining({ kind: 'outside', centerY: -10 }));
  });
});
