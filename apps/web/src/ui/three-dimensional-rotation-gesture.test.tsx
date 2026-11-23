import { describe, expect, it } from "@rstest/core";
import {
	beginRotationDomeGesture,
	moveRotationDomeGesture,
	rotationDomeGestureHasChanged,
} from "./three-dimensional-rotation-gesture";

const centre = { x: 120, y: 140 };
const at = (degrees: number, radius = 73) => ({
	x: centre.x + Math.sin((degrees * Math.PI) / 180) * radius,
	y: centre.y - Math.cos((degrees * Math.PI) / 180) * radius,
});

describe("relative floor-item rotation dome", () => {
	it("does not visually snap a legacy exact angle on a stationary grab or publish a zero-step jitter", () => {
		const gesture = beginRotationDomeGesture({
			assetInstanceId: "legacy",
			pointerId: 9,
			yawRadians: Math.PI / 10,
			point: at(0),
			centre,
		});
		expect(gesture.yawRadians).toBe(Math.PI / 10);
		expect(rotationDomeGestureHasChanged(gesture)).toBe(false);
		expect(
			rotationDomeGestureHasChanged(
				moveRotationDomeGesture(gesture, at(5), centre),
			),
		).toBe(false);
	});
	it("keeps the exact selected step when grabbed in any sector", () => {
		for (const degrees of [-170, -90, 0, 73, 179]) {
			const gesture = beginRotationDomeGesture({
				assetInstanceId: "chair",
				pointerId: 7,
				yawRadians: Math.PI / 2,
				point: at(degrees),
				centre,
			});
			expect(gesture.yawRadians).toBe(Math.PI / 2);
			expect(rotationDomeGestureHasChanged(gesture)).toBe(false);
		}
	});

	it("adds clockwise and counterclockwise deltas to the original yaw and wraps", () => {
		const gesture = beginRotationDomeGesture({
			assetInstanceId: "chair",
			pointerId: 7,
			yawRadians: Math.PI / 2,
			point: at(40),
			centre,
		});
		expect(moveRotationDomeGesture(gesture, at(85), centre).yawRadians).toBe(
			Math.PI / 4,
		);
		expect(moveRotationDomeGesture(gesture, at(55), centre).yawRadians).toBe(Math.PI / 2);
		expect(moveRotationDomeGesture(gesture, at(-50), centre).yawRadians).toBe(
			Math.PI,
		);
		const across = beginRotationDomeGesture({
			assetInstanceId: "chair",
			pointerId: 7,
			yawRadians: 0,
			point: at(170),
			centre,
		});
		expect(moveRotationDomeGesture(across, at(-145), centre).yawRadians).toBe(
			(7 * Math.PI) / 4,
		);
	});

	it("moves and settles between legacy steps, including when crossing zero", () => {
		const start = beginRotationDomeGesture({
			assetInstanceId: "chair",
			pointerId: 7,
			yawRadians: 0,
			point: at(179),
			centre,
			exact: true,
		});
		const moved = moveRotationDomeGesture(start, at(-168.5), centre);
		expect(moved.yawRadians).toBeCloseTo(347.5 * Math.PI / 180);
		expect(rotationDomeGestureHasChanged(moved)).toBe(true);
		expect(rotationDomeGestureHasChanged(moveRotationDomeGesture(moved, at(179), centre))).toBe(false);
	});

	it("ignores a tap, small jitter, a return to origin and an exact complete turn", () => {
		const origin = beginRotationDomeGesture({
			assetInstanceId: "chair",
			pointerId: 7,
			yawRadians: Math.PI / 4,
			point: at(0),
			centre,
		});
		expect(
			rotationDomeGestureHasChanged(
				moveRotationDomeGesture(origin, at(10), centre),
			),
		).toBe(false);
		const changed = moveRotationDomeGesture(origin, at(90), centre);
		expect(rotationDomeGestureHasChanged(changed)).toBe(true);
		expect(
			rotationDomeGestureHasChanged(
				moveRotationDomeGesture(changed, at(0), centre),
			),
		).toBe(false);
		let complete = origin;
		for (const degrees of [90, 180, 270, 360])
			complete = moveRotationDomeGesture(complete, at(degrees), centre);
		expect(rotationDomeGestureHasChanged(complete)).toBe(false);
	});

	it("does not jump when a captured pointer crosses the clear move target in the centre", () => {
		const origin = beginRotationDomeGesture({
			assetInstanceId: "chair",
			pointerId: 7,
			yawRadians: Math.PI / 4,
			point: at(0),
			centre,
		});
		const centreCrossing = moveRotationDomeGesture(origin, centre, centre);
		expect(centreCrossing).toEqual(origin);
		const after = moveRotationDomeGesture(centreCrossing, at(45, 250), centre);
		expect(after.yawRadians).toBe(0);
		expect(
			moveRotationDomeGesture(
				origin,
				{ x: centre.x + 23, y: centre.y },
				centre,
			),
		).toEqual(origin);
		expect(
			moveRotationDomeGesture(origin, { x: centre.x + 24, y: centre.y }, centre)
				.yawRadians,
		).toBe((7 * Math.PI) / 4);
	});
});
