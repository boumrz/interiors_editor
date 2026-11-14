import { describe, expect, it } from '@rstest/core';

import { greyboxPreviewPartsFor } from './greybox-catalog-preview';

describe('greyboxPreviewPartsFor', () => {
  it('uses a recognisable bounded silhouette for every local built-in instead of a generic box', () => {
    expect(greyboxPreviewPartsFor('bed').map((part) => part.role)).toEqual([
      'bed-base', 'mattress', 'headboard'
    ]);
    expect(greyboxPreviewPartsFor('table').map((part) => part.role)).toEqual([
      'tabletop', 'leg', 'leg', 'leg', 'leg'
    ]);
    expect(greyboxPreviewPartsFor('sofa').map((part) => part.role)).toEqual([
      'body', 'seat', 'back', 'arm', 'arm'
    ]);
  });

  it('keeps the material layers and exact shapes that distinguish each built-in preview', () => {
    expect(greyboxPreviewPartsFor('bed')).toEqual([
      { height: 30, role: 'bed-base', tone: 'base', width: 72, x: 14, y: 57 },
      { height: 24, role: 'mattress', tone: 'highlight', width: 68, x: 16, y: 37 },
      { height: 52, role: 'headboard', tone: 'shadow', width: 12, x: 12, y: 18 }
    ]);
    expect(greyboxPreviewPartsFor('table')).toEqual([
      { height: 14, role: 'tabletop', tone: 'highlight', width: 70, x: 15, y: 35 },
      { height: 42, role: 'leg', tone: 'base', width: 8, x: 20, y: 48 },
      { height: 42, role: 'leg', tone: 'base', width: 8, x: 72, y: 48 },
      { height: 22, role: 'leg', tone: 'shadow', width: 8, x: 28, y: 60 },
      { height: 22, role: 'leg', tone: 'shadow', width: 8, x: 64, y: 60 }
    ]);
    expect(greyboxPreviewPartsFor('chair')).toEqual([
      { height: 18, role: 'seat', tone: 'highlight', width: 48, x: 26, y: 52 },
      { height: 33, role: 'leg', tone: 'base', width: 7, x: 30, y: 67 },
      { height: 33, role: 'leg', tone: 'base', width: 7, x: 63, y: 67 },
      { height: 24, role: 'leg', tone: 'shadow', width: 7, x: 37, y: 75 },
      { height: 24, role: 'leg', tone: 'shadow', width: 7, x: 56, y: 75 }
    ]);
    expect(greyboxPreviewPartsFor('sofa')).toEqual([
      { height: 35, role: 'body', tone: 'base', width: 70, x: 15, y: 55 },
      { height: 20, role: 'seat', tone: 'highlight', width: 54, x: 23, y: 43 },
      { height: 40, role: 'back', tone: 'shadow', width: 70, x: 15, y: 18 },
      { height: 38, role: 'arm', tone: 'base', width: 12, x: 13, y: 45 },
      { height: 38, role: 'arm', tone: 'base', width: 12, x: 75, y: 45 }
    ]);
    for (const id of ['bedside-table', 'dresser', 'wardrobe'] as const) {
      expect(greyboxPreviewPartsFor(id)).toEqual([
        { height: 55, role: 'body', tone: 'base', width: 66, x: 17, y: 30 },
        { height: 8, role: 'drawer', tone: 'highlight', width: 56, x: 22, y: 42 },
        { height: 8, role: 'drawer', tone: 'highlight', width: 56, x: 22, y: 57 },
        { height: 8, role: 'drawer', tone: 'highlight', width: 56, x: 22, y: 72 }
      ]);
    }
  });

  it('keeps every preview part inside a normalized 3D card frame', () => {
    for (const presetId of ['bed', 'bedside-table', 'chair', 'dresser', 'sofa', 'table', 'wardrobe'] as const) {
      const parts = greyboxPreviewPartsFor(presetId);
      expect(parts.length).toBeGreaterThan(0);
      parts.forEach((part) => {
        expect(part.height).toBeGreaterThan(0);
        expect(part.width).toBeGreaterThan(0);
        expect(part.x).toBeGreaterThanOrEqual(0);
        expect(part.y).toBeGreaterThanOrEqual(0);
        expect(part.x + part.width).toBeLessThanOrEqual(100);
        expect(part.y + part.height).toBeLessThanOrEqual(100);
      });
    }
  });
});
