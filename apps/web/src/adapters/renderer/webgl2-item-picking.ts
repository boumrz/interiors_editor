import type { CatalogProfile } from "./catalog-model-parts";
import { catalogProfileGeometry } from "./catalog-profile-geometry";
import type { RectangularRoomWebGlScene, SceneBox } from "./rectangular-room-projection";
import { cameraEyeAndTargetFor, furnitureGreyboxPartsFor, type NormalizedCanvasPoint, wallSideAtHit, type WebGl2Camera, type WebGl2SceneHit } from "./webgl2-room-renderer-shared";

interface Vector3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

export function pickProceduralSceneItem(
	scene: RectangularRoomWebGlScene,
	camera: WebGl2Camera,
	aspect: number,
	point: NormalizedCanvasPoint,
	hiddenWallSegmentIds: ReadonlySet<string> | undefined,
	detailedFurniture: boolean,
): string | undefined {
	return pickProceduralSceneHit(scene, camera, aspect, point, hiddenWallSegmentIds, detailedFurniture)?.assetInstanceId;
}

/** Intersects the same oriented furniture parts and opaque wall bodies as the procedural renderer. */
export function pickProceduralSceneHit(
	scene: RectangularRoomWebGlScene,
	camera: WebGl2Camera,
	aspect: number,
	point: NormalizedCanvasPoint,
	hiddenWallSegmentIds: ReadonlySet<string> | undefined,
	detailedFurniture: boolean,
	includeGlazing = false,
): WebGl2SceneHit | undefined {
	if (!(aspect > 0)) return undefined;
	const { eye: [x, y, z], target } = cameraEyeAndTargetFor(scene, camera);
	const eye = { x, y, z };
	const forward = normalize({ x: target[0] - x, y: target[1] - y, z: target[2] - z });
	const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
	const up = cross(right, forward);
	const tangent = Math.tan(Math.PI / 6);
	const ray = normalize(add(forward, add(scale(right, point.x * aspect * tangent), scale(up, point.y * tangent))));
	const forwardComponent = dot(ray, forward);
	const near = 0.1 / forwardComponent;
	const far = 100 / forwardComponent;
	let closestDistance = far;
	let closest: WebGl2SceneHit | undefined;
	for (const wall of scene.walls) {
		const wallSegmentId = wall.wall?.wallSegmentId;
		if (wallSegmentId !== undefined && hiddenWallSegmentIds?.has(wallSegmentId)) continue;
		const distanceM = rayDistanceToBox(eye, ray, wall, near);
		if (distanceM >= closestDistance) continue;
		closestDistance = distanceM;
		closest = { distanceM, wallSegmentId, wallSide: wallSideAtHit(wall, add(eye, scale(ray, distanceM)), eye) };
	}
	for (const part of scene.openingParts ?? []) {
		if (hiddenWallSegmentIds?.has(part.wallSegmentId) || (part.role === "glass" && !includeGlazing)) continue;
		const distanceM = rayDistanceToBox(eye, ray, part.box, near);
		if (distanceM >= closestDistance) continue;
		closest = { distanceM, openingId: part.openingId };
		closestDistance = distanceM;
	}
	for (const item of scene.items) {
		for (const { box, opacity, profile } of furnitureGreyboxPartsFor(item, detailedFurniture)) {
			if (opacity !== undefined) continue;
			const boundsDistance = rayDistanceToBox(eye, ray, box, near);
			if (!Number.isFinite(boundsDistance)) continue;
			const distance = profile ? rayDistanceToProfile(eye, ray, box, profile, near) : boundsDistance;
			if (distance < closestDistance) {
				closestDistance = distance;
				closest = { distanceM: distance, assetInstanceId: item.assetInstanceId };
			}
		}
	}
	return closest;
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

function rayDistanceToProfile(eye: Vector3, direction: Vector3, box: SceneBox, profile: CatalogProfile, near: number): number {
	const yaw = box.yawRadians ?? 0;
	const cosine = Math.cos(yaw);
	const sine = Math.sin(yaw);
	const toLocal = ({ x, y, z }: Vector3): Vector3 => ({
		x: (cosine * x - sine * z) / box.widthM,
		y: y / box.heightM,
		z: (sine * x + cosine * z) / box.depthM,
	});
	const origin = toLocal({ x: eye.x - box.centerXM, y: eye.y - box.centerYM, z: eye.z - box.centerZM });
	const ray = toLocal(direction);
	const { positions, indices } = catalogProfileGeometry(profile);
	const vertex = (index: number): Vector3 => ({
		x: positions[index * 3] ?? 0,
		y: positions[index * 3 + 1] ?? 0,
		z: positions[index * 3 + 2] ?? 0,
	});
	let closest = Infinity;
	for (let index = 0; index < indices.length; index += 3) {
		const a = vertex(indices[index] ?? 0);
		const edge1 = add(vertex(indices[index + 1] ?? 0), scale(a, -1));
		const edge2 = add(vertex(indices[index + 2] ?? 0), scale(a, -1));
		const p = cross(ray, edge2);
		const determinant = dot(edge1, p);
		if (Math.abs(determinant) < 1e-9) continue;
		const offset = add(origin, scale(a, -1));
		const u = dot(offset, p) / determinant;
		if (u < 0 || u > 1) continue;
		const q = cross(offset, edge1);
		const v = dot(ray, q) / determinant;
		if (v < 0 || u + v > 1) continue;
		const distance = dot(edge2, q) / determinant;
		if (distance >= near) closest = Math.min(closest, distance);
	}
	return closest;
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
