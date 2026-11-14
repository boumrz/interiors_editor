export interface EditorViewport {
	readonly panX: number;
	readonly panY: number;
	readonly zoom: number;
}

export interface WorldBounds {
	readonly maxXMm: number;
	readonly maxZMm: number;
	readonly minXMm: number;
	readonly minZMm: number;
}

export interface WorldProjection {
	readonly canvasHeight: number;
	readonly canvasWidth: number;
	readonly originCanvasX: number;
	readonly originCanvasY: number;
	readonly originWorldXMm: number;
	readonly originWorldZMm: number;
	readonly pixelsPerMm: number;
}

export interface ClientPoint {
	readonly clientX: number;
	readonly clientY: number;
}

export interface CanvasClientBounds {
	readonly height: number;
	readonly left: number;
	readonly top: number;
	readonly width: number;
}

export interface CanvasSize {
	readonly canvasHeight: number;
	readonly canvasWidth: number;
}

/** Returns whether a wall centreline has any visible point inside the view. */
export function drawingSegmentIntersectsWorldBounds(
	start: { readonly xMm: number; readonly zMm: number },
	end: { readonly xMm: number; readonly zMm: number },
	bounds: WorldBounds,
): boolean {
	const dx = end.xMm - start.xMm;
	const dz = end.zMm - start.zMm;
	let enter = 0;
	let exit = 1;
	const clip = (p: number, q: number): boolean => {
		if (p === 0) return q >= 0;
		const ratio = q / p;
		if (p < 0) {
			if (ratio > exit) return false;
			enter = Math.max(enter, ratio);
			return true;
		}
		if (ratio < enter) return false;
		exit = Math.min(exit, ratio);
		return true;
	};

	return (
		clip(-dx, start.xMm - bounds.minXMm) &&
		clip(dx, bounds.maxXMm - start.xMm) &&
		clip(-dz, start.zMm - bounds.minZMm) &&
		clip(dz, bounds.maxZMm - start.zMm) &&
		enter <= exit
	);
}

const MIN_ZOOM = 0.55;
const DEFAULT_MAX_ZOOM = 3;
export const MINIMUM_TOUCH_TARGET_PX = 44;

export const initialEditorViewport: EditorViewport = {
	panX: 0,
	panY: 0,
	zoom: 1,
};

/** Converts browser CSS pixels into the SVG viewBox coordinate system. */
export function canvasPointFromClient(
	point: ClientPoint,
	bounds: CanvasClientBounds,
	canvas: CanvasSize,
): { readonly x: number; readonly y: number } {
	const scale = Math.min(
		bounds.width / Math.max(1, canvas.canvasWidth),
		bounds.height / Math.max(1, canvas.canvasHeight),
	);
	const renderedWidth = canvas.canvasWidth * scale;
	const renderedHeight = canvas.canvasHeight * scale;
	const originX = bounds.left + (bounds.width - renderedWidth) / 2;
	const originY = bounds.top + (bounds.height - renderedHeight) / 2;

	return {
		x: (point.clientX - originX) / scale,
		y: (point.clientY - originY) / scale,
	};
}

export function panEditorViewport(
	viewport: EditorViewport,
	deltaX: number,
	deltaY: number,
): EditorViewport {
	return {
		...viewport,
		panX: viewport.panX + deltaX,
		panY: viewport.panY + deltaY,
	};
}

/**
 * Keeps deep zoom proportional to the plan projection. A fixed 3x ceiling is
 * enough for an ordinary room, but leaves a 100 mm construction cell only a
 * few pixels wide when a 40 m plan is fitted to a phone.
 */
export function maximumEditorZoomForGrid(
	pixelsPerMm: number,
	gridStepMm: number,
): number {
	return Math.max(
		DEFAULT_MAX_ZOOM,
		MINIMUM_TOUCH_TARGET_PX / (pixelsPerMm * gridStepMm),
	);
}

export function zoomEditorViewport(
	viewport: EditorViewport,
	scale: number,
	maximumZoom = DEFAULT_MAX_ZOOM,
): EditorViewport {
	return {
		...viewport,
		zoom: Math.max(MIN_ZOOM, Math.min(maximumZoom, viewport.zoom * scale)),
	};
}

/**
 * Zooms while keeping a point in the visible canvas fixed on screen.  The
 * editor uses the canvas centre for gestures and wheel zoom so the drawing
 * never appears to flee toward the SVG's top-left origin.
 */
export function zoomEditorViewportAround(
	viewport: EditorViewport,
	scale: number,
	focus: { readonly x: number; readonly y: number },
	maximumZoom = DEFAULT_MAX_ZOOM,
): EditorViewport {
	const next = zoomEditorViewport(viewport, scale, maximumZoom);
	const effectiveScale = next.zoom / viewport.zoom;
	return {
		...next,
		panX: focus.x - (focus.x - viewport.panX) * effectiveScale,
		panY: focus.y - (focus.y - viewport.panY) * effectiveScale,
	};
}

/** A pinch is anchored to the fingers, including their simultaneous pan. */
export function pinchEditorViewport(
	viewport: EditorViewport,
	scale: number,
	initialCentre: { readonly x: number; readonly y: number },
	currentCentre: { readonly x: number; readonly y: number },
	maximumZoom: number,
): EditorViewport {
	return panEditorViewport(
		zoomEditorViewportAround(viewport, scale, initialCentre, maximumZoom),
		currentCentre.x - initialCentre.x,
		currentCentre.y - initialCentre.y,
	);
}

export function visibleWorldBounds(
	viewport: EditorViewport,
	projection: WorldProjection,
): WorldBounds {
	const worldXAtCanvas = (canvasX: number) =>
		projection.originWorldXMm +
		((canvasX - viewport.panX) / viewport.zoom - projection.originCanvasX) /
			projection.pixelsPerMm;
	const worldZAtCanvas = (canvasY: number) =>
		projection.originWorldZMm +
		((canvasY - viewport.panY) / viewport.zoom - projection.originCanvasY) /
			projection.pixelsPerMm;

	return {
		maxXMm: worldXAtCanvas(projection.canvasWidth),
		maxZMm: worldZAtCanvas(projection.canvasHeight),
		minXMm: worldXAtCanvas(0),
		minZMm: worldZAtCanvas(0),
	};
}
