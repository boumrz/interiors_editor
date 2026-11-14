import {
	rotationStepForYawRadians,
	yawRadiansFor,
} from "../domain/parametric-item";

interface Point {
	readonly x: number;
	readonly y: number;
}

export interface RotationDomeGesture {
	readonly assetInstanceId: string;
	readonly pointerId: number;
	readonly initialYawRadians: number;
	readonly initialPointerAngle: number;
	readonly yawRadians: number;
}

/** A grab records a reference direction; it never assigns that direction to the item. */
export function beginRotationDomeGesture(input: {
	readonly assetInstanceId: string;
	readonly pointerId: number;
	readonly yawRadians: number;
	readonly point: Point;
	readonly centre: Point;
}): RotationDomeGesture {
	const yawRadians = input.yawRadians;
	return {
		assetInstanceId: input.assetInstanceId,
		pointerId: input.pointerId,
		initialYawRadians: yawRadians,
		initialPointerAngle: angleFor(input.point, input.centre),
		yawRadians,
	};
}

/** The relative delta is periodic because only the final canonical yaw step is published. */
export function moveRotationDomeGesture(
	gesture: RotationDomeGesture,
	point: Point,
	centre: Point,
): RotationDomeGesture {
	// Crossing the clear centre has no stable angular direction.
	if (Math.hypot(point.x - centre.x, point.y - centre.y) < 24) return gesture;
	const angle = angleFor(point, centre);
	const angularDelta = angle - gesture.initialPointerAngle;
	return {
		...gesture,
		yawRadians: yawRadiansFor({
			yawStep: rotationStepForYawRadians(
				gesture.initialYawRadians - angularDelta,
			),
		}),
	};
}

export function rotationDomeGestureHasChanged(
	gesture: RotationDomeGesture,
): boolean {
	return (
		rotationStepForYawRadians(gesture.yawRadians) !==
		rotationStepForYawRadians(gesture.initialYawRadians)
	);
}

function angleFor(point: Point, centre: Point): number {
	return Math.atan2(point.x - centre.x, centre.y - point.y);
}
