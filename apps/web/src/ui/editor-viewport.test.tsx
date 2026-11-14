import { describe, expect, it } from '@rstest/core';

import {
  canvasPointFromClient,
  drawingSegmentIntersectsWorldBounds,
  initialEditorViewport,
  maximumEditorZoomForGrid,
  panEditorViewport,
  visibleWorldBounds,
  zoomEditorViewport,
  zoomEditorViewportAround
} from './editor-viewport';

describe('editor viewport', () => {

  it('recognises a drawing as visible when even a single wall segment crosses the viewport', () => {
    const viewport = {
      maxXMm: 1000,
      maxZMm: 1000,
      minXMm: 0,
      minZMm: 0
    };

    expect(drawingSegmentIntersectsWorldBounds(
      { xMm: -400, zMm: 500 },
      { xMm: 1400, zMm: 500 },
      viewport
    )).toBe(true);
    expect(drawingSegmentIntersectsWorldBounds(
      { xMm: -400, zMm: -300 },
      { xMm: -20, zMm: -10 },
      viewport
    )).toBe(false);
  });
  it('maps a touch position into SVG viewBox coordinates before panning or snapping', () => {
    expect(canvasPointFromClient(
      { clientX: 195, clientY: 419 },
      { height: 734, left: 0, top: 52, width: 390 },
      { canvasHeight: 370, canvasWidth: 440 }
    )).toEqual({ x: 220, y: 185 });
  });

  it('maps through the centered SVG letterbox instead of stretching touch coordinates', () => {
    const point = canvasPointFromClient(
      { clientX: 195, clientY: 254 },
      { height: 554, left: 0, top: 52, width: 390 },
      { canvasHeight: 370, canvasWidth: 440 }
    );

    expect(point.x).toBe(220);
    expect(point.y).toBeCloseTo(100.384615, 5);
  });

  it('pans the transient viewport without changing its zoom', () => {
    expect(panEditorViewport(initialEditorViewport, 48, -31)).toEqual({
      panX: 48,
      panY: -31,
      zoom: 1
    });
  });

  it('clamps a pinch zoom to a useful touch-editor range while preserving the current pan', () => {
    const panned = panEditorViewport(initialEditorViewport, 24, -12);

    expect(zoomEditorViewport(panned, 9)).toEqual({ panX: 24, panY: -12, zoom: 3 });
    expect(zoomEditorViewport(panned, 0.1)).toEqual({ panX: 24, panY: -12, zoom: 0.55 });
  });

  it('lets a 100 mm construction cell reach one 44 px touch target on a 40 m phone plan', () => {
    const panned = panEditorViewport(initialEditorViewport, 24, -12);
    const maximumZoom = maximumEditorZoomForGrid(0.0088, 100);

    expect(maximumZoom).toBe(50);
    expect(zoomEditorViewport(panned, 100, maximumZoom)).toEqual({
      panX: 24,
      panY: -12,
      zoom: 50
    });
    expect(zoomEditorViewportAround(
      { ...panned, zoom: 2 },
      100,
      { x: 220, y: 185 },
      maximumZoom
    )).toEqual({ panX: -4680, panY: -4740, zoom: 50 });
    expect(0.0088 * 100 * maximumZoom).toBe(44);
  });

  it('keeps the established 3x editor limit when the construction cell is already touch-usable', () => {
    expect(maximumEditorZoomForGrid(0.2, 100)).toBe(3);
  });

  it('zooms around the visible canvas centre instead of the SVG origin', () => {
    const viewport = panEditorViewport(initialEditorViewport, 24, -12);

    expect(
      zoomEditorViewportAround(viewport, 2, { x: 220, y: 185 })
    ).toEqual({ panX: -172, panY: -209, zoom: 2 });

    // Clamping must preserve the focus point using the effective zoom factor.
    expect(
      zoomEditorViewportAround(viewport, 9, { x: 220, y: 185 })
    ).toEqual({ panX: -368, panY: -406, zoom: 3 });
  });

  it('derives visible world bounds outside a plan while the transient canvas is panned and zoomed', () => {
    expect(visibleWorldBounds(
      { panX: 20, panY: -10, zoom: 2 },
      {
        canvasHeight: 300,
        canvasWidth: 400,
        originCanvasX: 100,
        originCanvasY: 50,
        originWorldXMm: 0,
        originWorldZMm: 0,
        pixelsPerMm: 0.1
      }
    )).toEqual({
      maxXMm: 900,
      maxZMm: 1050,
      minXMm: -1100,
      minZMm: -450
    });
  });
});
