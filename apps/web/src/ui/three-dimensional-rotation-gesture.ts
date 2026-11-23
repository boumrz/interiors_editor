import {
	floorYawFieldsForRadians,
	yawRadiansFor,
} from "../domain/parametric-item";
import { normalizeYawRadians } from "./rotation-angle";

interface Point {
	readonly x: number;
	readonly y: number;
}

export interface RotationDomeGesture {
	readonly assetInstanceId: string;
	readonly exact: boolean;
	readonly pointerId: number;
	readonly initialYawRadians: number;
	readonly initialPointerAngle: number;
	readonly yawRadians: number;
}

/** A grab records a reference direction; it never assigns that direction to the item. */
export function beginRotationDomeGesture(input: {
	readonly assetInstanceId: string;
	readonly exact?: boolean;
	readonly pointerId: number;
	readonly yawRadians: number;
	readonly point: Point;
	readonly centre: Point;
}): RotationDomeGesture {
	const yawRadians = input.yawRadians;
	return {
		assetInstanceId: input.assetInstanceId,
		exact: input.exact ?? false,
		pointerId: input.pointerId,
		initialYawRadians: yawRadians,
		initialPointerAngle: angleFor(input.point, input.centre),
		yawRadians,
	};
}

/** Only the final canonical pose is published. */
export function moveRotationDomeGesture(
	gesture: RotationDomeGesture,
	point: Point,
	centre: Point,
): RotationDomeGesture {
	// Crossing the clear centre has no stable angular direction.
	if (Math.hypot(point.x - centre.x, point.y - centre.y) < 24) return gesture;
	const angle = angleFor(point, centre);
	const yawRadians = gesture.initialYawRadians - (angle - gesture.initialPointerAngle);
	return {
		...gesture,
		yawRadians: gesture.exact
			? normalizeYawRadians(yawRadians)
			: yawRadiansFor(floorYawFieldsForRadians(yawRadians, false)),
	};
}

export function rotationDomeGestureHasChanged(
	gesture: RotationDomeGesture,
): boolean {
	return (
		yawRadiansFor(floorYawFieldsForRadians(gesture.yawRadians, gesture.exact)) !==
		yawRadiansFor(floorYawFieldsForRadians(gesture.initialYawRadians, gesture.exact))
	);
}

function angleFor(point: Point, centre: Point): number {
	return Math.atan2(point.x - centre.x, centre.y - point.y);
}
