export interface ThreeDimensionalViewport {
  readonly azimuthRadians: number;
  readonly elevationRadians: number;
  readonly distance: number;
  readonly panXM: number;
  readonly panZM: number;
}

/** The renderer-only room envelope needed to compose an initial 3D camera. */
export interface ThreeDimensionalRoomEnvelope {
  readonly cameraBounds: {
    readonly depthM: number;
    readonly widthM: number;
  };
  readonly dimensions: {
    readonly heightMm: number;
  };
}

export interface ThreeDimensionalViewportSize {
  readonly height: number;
  readonly width: number;
}

const MIN_DISTANCE = 0.7;
const MAX_DISTANCE = 3.4;
const MIN_ELEVATION = 0.22;
const MAX_ELEVATION = 1.25;
const CAMERA_VERTICAL_FOV_RADIANS = Math.PI / 3;
// Keep a calm gutter around the shell and clear the persistent phone deck.
// These are presentation-only framing margins, never spatial Project data.
const FRAME_HORIZONTAL_OCCUPANCY = 0.96;
const FRAME_VERTICAL_OCCUPANCY = 0.78;
const SELECTED_ITEM_INITIAL_FOCUS_DISTANCE = 0.4;

export const initialThreeDimensionalViewport: ThreeDimensionalViewport = {
	// Open along the room's compact axis: a wide multi-room shell then uses the
	// tall dimension of a portrait phone rather than being shrunk to fit its
	// narrow width. Auto cutaway still removes exactly one complete facade.
	azimuthRadians: 0,
	distance: 2.1,
	elevationRadians: 1,
  panXM: 0,
  panZM: 0
};

/**
 * A portrait phone is narrow horizontally, so open along the longer envelope
 * dimension and keep the compact one across the screen. A square keeps the
 * stable +X default; item selection may deliberately override this first pose.
 */
export function initialThreeDimensionalViewportForRoom(
	room: Pick<ThreeDimensionalRoomEnvelope, "cameraBounds">,
): ThreeDimensionalViewport {
	const { depthM, widthM } = room.cameraBounds;
	if (
		!Number.isFinite(depthM) ||
		!Number.isFinite(widthM) ||
		depthM <= Number.EPSILON ||
		widthM <= Number.EPSILON ||
		depthM <= widthM
	) {
		return initialThreeDimensionalViewport;
	}
	return {
		...initialThreeDimensionalViewport,
		azimuthRadians: Math.PI / 2,
		// A tall shell is viewed along its depth. A slightly higher eye uses the
		// phone's vertical scene window without turning the overview into a plan.
		elevationRadians: 1.15,
	};
}

/**
 * Chooses the complete exterior facade nearest an already selected floor item.
 * This is only the first disposable camera pose: later item selection and
 * every camera gesture keep the current view unchanged.
 */
export function initialThreeDimensionalViewportForSelectedItem(
	roomCentre: { readonly centerXM: number; readonly centerZM: number },
	selectedItem:
		| { readonly centerXM: number; readonly centerZM: number }
		| undefined,
	fallback: ThreeDimensionalViewport = initialThreeDimensionalViewport,
): ThreeDimensionalViewport {
	if (
		selectedItem === undefined ||
		![
			roomCentre.centerXM,
			roomCentre.centerZM,
			selectedItem.centerXM,
			selectedItem.centerZM,
		].every(Number.isFinite)
	) {
		return fallback;
	}

	const deltaX = selectedItem.centerXM - roomCentre.centerXM;
	const deltaZ = selectedItem.centerZM - roomCentre.centerZM;
	if (
		Math.abs(deltaX) <= Number.EPSILON &&
		Math.abs(deltaZ) <= Number.EPSILON
	) {
		return fallback;
	}
	const azimuthRadians =
		Math.abs(deltaX) >= Math.abs(deltaZ)
			? deltaX >= 0
				? 0
				: Math.PI
			: deltaZ >= 0
				? Math.PI / 2
				: -Math.PI / 2;

	return { ...fallback, azimuthRadians };
}

/**
 * Turns the fitted initial room camera into a readable item-inspection pose.
 * The target is the canonical item's centre, but the result is still only
 * disposable presentation state: an explicit return to overview deliberately
 * restores the full-room camera instead.
 */
export function focusThreeDimensionalViewportOnSelectedItem(
	viewport: ThreeDimensionalViewport,
	roomCentre: { readonly centerXM: number; readonly centerZM: number },
	selectedItem:
		| { readonly centerXM: number; readonly centerZM: number }
		| undefined,
): ThreeDimensionalViewport {
	if (
		selectedItem === undefined ||
		![
			viewport.distance,
			roomCentre.centerXM,
			roomCentre.centerZM,
			selectedItem.centerXM,
			selectedItem.centerZM,
		].every(Number.isFinite)
	) {
		return viewport;
	}

	return {
		...viewport,
		distance: Math.max(
			MIN_DISTANCE,
			Math.min(
				MAX_DISTANCE,
				viewport.distance * SELECTED_ITEM_INITIAL_FOCUS_DISTANCE,
			),
		),
		panXM: selectedItem.centerXM - roomCentre.centerXM,
		panZM: selectedItem.centerZM - roomCentre.centerZM,
	};
}

/**
 * Fits the projected room shell to the canvas that is actually available.
 * `distance` remains dimensionless so the camera continues to scale with the
 * canonical room envelope, while this calculation accounts for portrait
 * aspect ratio, elevation and room height before the first paint settles.
 */
export function fitThreeDimensionalViewport(
  viewport: ThreeDimensionalViewport,
  room: ThreeDimensionalRoomEnvelope,
  canvas: ThreeDimensionalViewportSize,
): ThreeDimensionalViewport {
  if (
    !Number.isFinite(canvas.width) ||
    !Number.isFinite(canvas.height) ||
    canvas.width <= 0 ||
    canvas.height <= 0
  ) {
    return viewport;
  }

  const extent = Math.max(room.cameraBounds.widthM, room.cameraBounds.depthM);
  const heightM = room.dimensions.heightMm / 1000;
  if (
    !Number.isFinite(extent) ||
    !Number.isFinite(heightM) ||
    extent <= Number.EPSILON ||
    heightM <= Number.EPSILON
  ) {
    return viewport;
  }

  const aspect = canvas.width / canvas.height;
  const verticalTangent =
    Math.tan(CAMERA_VERTICAL_FOV_RADIANS / 2) * FRAME_VERTICAL_OCCUPANCY;
  const horizontalTangent = verticalTangent * aspect *
    (FRAME_HORIZONTAL_OCCUPANCY / FRAME_VERTICAL_OCCUPANCY);
  if (verticalTangent <= Number.EPSILON || horizontalTangent <= Number.EPSILON) {
    return viewport;
  }

  const cosineAzimuth = Math.cos(viewport.azimuthRadians);
  const sineAzimuth = Math.sin(viewport.azimuthRadians);
  const cosineElevation = Math.cos(viewport.elevationRadians);
  const sineElevation = Math.sin(viewport.elevationRadians);
  const forward = {
    x: -cosineAzimuth * cosineElevation,
    y: -sineElevation,
    z: -sineAzimuth * cosineElevation,
  };
  const right = { x: sineAzimuth, y: 0, z: -cosineAzimuth };
  const up = {
    x: -cosineAzimuth * sineElevation,
    y: cosineElevation,
    z: -sineAzimuth * sineElevation,
  };
  const targetToFloorM = heightM * 0.22;
  let requiredCameraDistanceM = extent * MIN_DISTANCE;

  for (const xM of [
    -room.cameraBounds.widthM / 2 - viewport.panXM,
    room.cameraBounds.widthM / 2 - viewport.panXM,
  ]) {
    for (const yM of [-targetToFloorM, heightM - targetToFloorM]) {
      for (const zM of [
        -room.cameraBounds.depthM / 2 - viewport.panZM,
        room.cameraBounds.depthM / 2 - viewport.panZM,
      ]) {
        const forwardOffset =
          forward.x * xM + forward.y * yM + forward.z * zM;
        const horizontalOffset = Math.abs(right.x * xM + right.z * zM);
        const verticalOffset = Math.abs(
          up.x * xM + up.y * yM + up.z * zM,
        );
        requiredCameraDistanceM = Math.max(
          requiredCameraDistanceM,
          horizontalOffset / horizontalTangent - forwardOffset,
          verticalOffset / verticalTangent - forwardOffset,
        );
      }
    }
  }

  const fittedDistance = requiredCameraDistanceM / extent;
  return {
    ...viewport,
    distance: Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, fittedDistance)),
  };
}

export function orbitThreeDimensionalViewport(
  viewport: ThreeDimensionalViewport,
  deltaX: number,
  deltaY: number
): ThreeDimensionalViewport {
  return {
    ...viewport,
    azimuthRadians: viewport.azimuthRadians + deltaX * 0.01,
    elevationRadians: Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, viewport.elevationRadians + deltaY * 0.01))
  };
}

export function zoomThreeDimensionalViewport(
  viewport: ThreeDimensionalViewport,
  scale: number
): ThreeDimensionalViewport {
  return {
    ...viewport,
    distance: Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, viewport.distance / scale))
  };
}

export function panThreeDimensionalViewport(
  viewport: ThreeDimensionalViewport,
  deltaX: number,
  deltaY: number
): ThreeDimensionalViewport {
  // Translate the camera target along its screen right/up axes.  Moving the
  // target opposite to a horizontal finger drag makes the scene follow that
  // drag instead of feeling inverted; the vertical component follows the
  // projected camera-up direction on the floor.
  const rightX = Math.sin(viewport.azimuthRadians);
  const rightZ = -Math.cos(viewport.azimuthRadians);
  const upX = -Math.cos(viewport.azimuthRadians);
  const upZ = -Math.sin(viewport.azimuthRadians);
  return {
    ...viewport,
    panXM: viewport.panXM + (-rightX * deltaX + upX * deltaY) * 0.01,
    panZM: viewport.panZM + (-rightZ * deltaX + upZ * deltaY) * 0.01
  };
}
