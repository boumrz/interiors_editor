import type { RectangularRoomWebGlScene, SceneBox } from "./rectangular-room-projection";
import { cameraEyeAndTargetFor, furnitureGreyboxPartsFor, type NormalizedCanvasPoint, type WebGl2Camera } from "./webgl2-room-renderer-shared";

interface Vector3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

/** Intersects the same oriented furniture parts and opaque wall bodies as the procedural renderer. */
export function pickProceduralSceneItem(
	scene: RectangularRoomWebGlScene,
	camera: WebGl2Camera,
	aspect: number,
	point: NormalizedCanvasPoint,
	hiddenWallSegmentIds: ReadonlySet<string> | undefined,
	detailedFurniture: boolean,
): string | undefined {
	if (!(aspect > 0) || scene.items.length === 0) return undefined;
	const { eye: [x, y, z], target } = cameraEyeAndTargetFor(scene, camera);
	const eye = { x, y, z };
	const forward = normalize({ x: target[0] - x, y: target[1] - y, z: target[2] - z });
	const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
	const up = cross(right, forward);
	const tangent = Math.tan(Math.PI / 6);
	const ray = normalize(add(forward, add(scale(right, point.x * aspect * tangent), scale(up, point.y * tangent))));
	const forwardComponent = dot(ray, forward);
	const near = 0.1 / forwardComponent;
	let closestDistance = 100 / forwardComponent;
	for (const wall of scene.walls) {
		if (!wall.wall || !hiddenWallSegmentIds?.has(wall.wall.wallSegmentId)) {
			closestDistance = Math.min(closestDistance, rayDistanceToBox(eye, ray, wall, near));
		}
	}
	for (const part of scene.openingParts ?? []) {
		if (part.role !== "glass" && !hiddenWallSegmentIds?.has(part.wallSegmentId)) {
			closestDistance = Math.min(closestDistance, rayDistanceToBox(eye, ray, part.box, near));
		}
	}
	let closestItem: string | undefined;
	for (const item of scene.items) {
		for (const { box } of furnitureGreyboxPartsFor(item, detailedFurniture)) {
			const distance = rayDistanceToBox(eye, ray, box, near);
			if (distance < closestDistance) {
				closestDistance = distance;
				closestItem = item.assetInstanceId;
			}
		}
	}
	return closestItem;
}

function rayDistanceToBox(origin: Vector3, direction: Vector3, box: SceneBox, near: number): number {
	let enters = 0;
	let exits = Infinity;
	const clip = (offset: number, rate: number) => {
		if (Math.abs(rate) < 1e-9) return offset >= 0;
		const distance = -offset / rate;
		if (rate > 0) enters = Math.max(enters, distance);
		else exits = Math.min(exits, distance);
		return enters <= exits;
	};
	const clipAxis = (position: number, rate: number, halfSize: number) =>
		clip(halfSize + position, rate) && clip(halfSize - position, -rate);
	if (!clipAxis(origin.y - box.centerYM, direction.y, box.heightM / 2)) {
		return Infinity;
	}
	if (box.wallFootprintM) {
		// Wall body projection and opening clipping preserve a convex, CCW footprint.
		let from = box.wallFootprintM.at(-1);
		if (!from) return Infinity;
		for (const to of box.wallFootprintM) {
			const dx = to.xM - from.xM;
			const dz = to.zM - from.zM;
			const offset = dx * (origin.z - from.zM) - dz * (origin.x - from.xM);
			const rate = dx * direction.z - dz * direction.x;
			if (!clip(offset, rate)) {
				return Infinity;
			}
			from = to;
		}
	} else {
		const yaw = box.yawRadians ?? 0;
		const cos = Math.cos(yaw);
		const sin = Math.sin(yaw);
		const rotateToLocal = (x: number, z: number) => [cos * x - sin * z, sin * x + cos * z] as const;
		const [x, z] = rotateToLocal(origin.x - box.centerXM, origin.z - box.centerZM);
		const [dx, dz] = rotateToLocal(direction.x, direction.z);
		if (!clipAxis(x, dx, box.widthM / 2) || !clipAxis(z, dz, box.depthM / 2)) return Infinity;
	}
	if (enters >= near) return enters;
	return exits >= near ? exits : Infinity;
}

function add(first: Vector3, second: Vector3): Vector3 {
	return { x: first.x + second.x, y: first.y + second.y, z: first.z + second.z };
}

function scale(vector: Vector3, factor: number): Vector3 {
	return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

function cross(first: Vector3, second: Vector3): Vector3 {
	return {
		x: first.y * second.z - first.z * second.y,
		y: first.z * second.x - first.x * second.z,
		z: first.x * second.y - first.y * second.x,
	};
}

function dot(first: Vector3, second: Vector3): number {
	return first.x * second.x + first.y * second.y + first.z * second.z;
}

function normalize(vector: Vector3): Vector3 {
	const length = Math.hypot(vector.x, vector.y, vector.z);
	return length > 0 ? scale(vector, 1 / length) : { x: 0, y: 0, z: 0 };
}
