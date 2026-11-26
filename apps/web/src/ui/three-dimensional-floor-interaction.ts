import type { RectangularRoomWebGlScene, SceneBox } from "../adapters/renderer/rectangular-room-projection";
import { cameraEyeAndTargetFor, type WebGl2SceneHit } from "../adapters/renderer/webgl2-room-renderer-shared";
import type { ThreeDimensionalViewport } from "./three-dimensional-viewport";

export interface CanvasSize {
	readonly height: number;
	readonly width: number;
}

export interface ThreeDimensionalFloorPoint {
	readonly xM: number;
	readonly zM: number;
}

interface Vector3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

interface CanvasPoint {
	readonly x: number;
	readonly y: number;
}

/**
 * Mirrors the renderer camera math to map a screen contact to the floor. The
	 * result is disposable UI geometry; the caller converts it to canonical mm
 * and still publishes through the ordinary item command.
 */
export function floorPointForCanvas(
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	point: { readonly x: number; readonly y: number },
): ThreeDimensionalFloorPoint | undefined {
	return pointOnHorizontalSurfaceForCanvas(scene, camera, size, point, 0);
}

export function pointOnHorizontalSurfaceForCanvas(
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	point: { readonly x: number; readonly y: number },
	heightM: number,
): ThreeDimensionalFloorPoint | undefined {
	if (size.width <= 0 || size.height <= 0) return undefined;
	const basis = cameraBasis(scene, camera);
	const direction = rayForCanvasPoint(basis, size, point);
	if (Math.abs(direction.y) < 1e-9) return undefined;
	const floorDistance = (heightM - basis.eye.y) / direction.y;
	if (!Number.isFinite(floorDistance) || floorDistance < 0) return undefined;
	return {
		xM: basis.eye.x + direction.x * floorDistance,
		zM: basis.eye.z + direction.z * floorDistance,
	};
}

export interface SceneSupportSurface {
	readonly hostId: string;
	readonly heightM: number;
	readonly outline: readonly ThreeDimensionalFloorPoint[];
}

/** Resolve a named contact plane only when that surface is visible on the rendered ray. */
export function supportSurfaceAtCanvasPoint<Surface extends SceneSupportSurface>(
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	point: CanvasPoint,
	surfaces: readonly Surface[],
	hit: WebGl2SceneHit | undefined,
): { readonly surface: Surface; readonly point: ThreeDimensionalFloorPoint } | undefined {
	if (!hit?.assetInstanceId || size.width <= 0 || size.height <= 0) return undefined;
	const basis = cameraBasis(scene, camera);
	const ray = rayForCanvasPoint(basis, size, point);
	if (ray.y >= -1e-9) return undefined;
	for (const surface of surfaces) {
		if (surface.hostId !== hit.assetInstanceId) continue;
		const distanceM = (surface.heightM - basis.eye.y) / ray.y;
		// The canonical surface is rounded to mm. Keep the tolerance close to
		// the plate so a hit on its front edge or a higher shelf cannot select it.
		if (Math.abs(distanceM - hit.distanceM) > Math.min(0.02, 0.0012 / Math.abs(ray.y))) continue;
		const xM = basis.eye.x + distanceM * ray.x;
		const zM = basis.eye.z + distanceM * ray.z;
		if (surface.outline.every((from, index, outline) => {
			const to = outline[(index + 1) % outline.length];
			return to !== undefined && (to.xM - from.xM) * (zM - from.zM) - (to.zM - from.zM) * (xM - from.xM) >= -1e-7;
		})) return { surface, point: { xM, zM } };
	}
	return undefined;
}

/** Projects a ground point for a CSS overlay anchored to a selected 3D item. */
export function canvasPointForFloor(
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	point: ThreeDimensionalFloorPoint,
): CanvasPoint | undefined {
	return canvasPointForWorld(scene, camera, size, { x: point.xM, y: 0, z: point.zM });
}

export function canvasPointForSceneItem(
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	item: SceneBox,
): CanvasPoint | undefined {
	return canvasPointForWorld(scene, camera, size, {
		x: item.centerXM, y: item.centerYM, z: item.centerZM,
	});
}

export function canvasPointForWorld(
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	point: Vector3,
): CanvasPoint | undefined {
	if (size.width <= 0 || size.height <= 0) return undefined;
	const basis = cameraBasis(scene, camera);
	const relative = { x: point.x - basis.eye.x, y: point.y - basis.eye.y, z: point.z - basis.eye.z };
	const forwardDistance = dot(relative, basis.forward);
	if (forwardDistance <= 1e-6) return undefined;
	const tangent = Math.tan(Math.PI / 6);
	const ndcX = dot(relative, basis.right) / (forwardDistance * tangent * (size.width / size.height));
	const ndcY = dot(relative, basis.up) / (forwardDistance * tangent);
	return {
		x: ((ndcX + 1) / 2) * size.width,
		y: ((1 - ndcY) / 2) * size.height,
	};
}

/**
 * Projects the complete canonical floor envelope of a selected item for a
 * passive 3D selection frame. Returning nothing is intentional when one
 * corner cannot be projected: a partial polygon would misrepresent the item.
 */
export function projectedItemFootprintFor(
	item: SceneBox,
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
): readonly CanvasPoint[] | undefined {
	const footprint: CanvasPoint[] = [];
	for (const corner of itemFloorCornersFor(item)) {
		const projected = canvasPointForFloor(scene, camera, size, corner);
		if (!projected) return undefined;
		footprint.push(projected);
	}
	return footprint;
}

export function floorItemAtPoint(
	items: readonly SceneBox[],
	point: ThreeDimensionalFloorPoint,
): SceneBox | undefined {
	return [...items]
		.reverse()
		.find((item) => {
			if (!item.assetInstanceId) return false;
			const yaw = item.yawRadians ?? 0;
			const dx = point.xM - item.centerXM;
			const dz = point.zM - item.centerZM;
			const localX = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
			const localZ = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
			return Math.abs(localX) <= item.widthM / 2 && Math.abs(localZ) <= item.depthM / 2;
		});
}

/**
 * Resolves only a derived usable floor tile back to its durable Room id. Door
 * threshold filler and any untagged renderer floor intentionally do not pick
 * a Room, so a mesh order can never become selection state.
 */
export function roomIdAtFloorPoint(
	floors: readonly SceneBox[],
	point: ThreeDimensionalFloorPoint,
): string | undefined {
	return floors.find(
		(floor) =>
			floor.floor?.roomId !== undefined &&
			Math.abs(point.xM - floor.centerXM) <= floor.widthM / 2 &&
			Math.abs(point.zM - floor.centerZM) <= floor.depthM / 2,
	)?.floor?.roomId;
}

/** Picks a usable floor face only where an opaque surface does not hide it. */
export function visibleRoomFloorAtCanvasPoint(
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	point: CanvasPoint,
	hit: WebGl2SceneHit | undefined,
): (ThreeDimensionalFloorPoint & { readonly roomId: string }) | undefined {
	if (hit?.assetInstanceId !== undefined) return undefined;
	const floorPoint = floorPointForCanvas(scene, camera, size, point);
	if (!floorPoint) return undefined;
	const { eye } = cameraEyeAndTargetFor(scene, camera);
	const distanceM = Math.hypot(eye[0] - floorPoint.xM, eye[1], eye[2] - floorPoint.zM);
	if (hit && hit.distanceM + 0.002 < distanceM) return undefined;
	const roomId = roomIdAtFloorPoint(scene.floors, floorPoint) ?? scene.floorPolygons?.find(
		floor => floor.floor.roomId && pointInFloorPolygon(floorPoint, floor.vertices),
	)?.floor.roomId;
	return roomId === undefined ? undefined : { ...floorPoint, roomId };
}

function pointInFloorPolygon(point: ThreeDimensionalFloorPoint, vertices: readonly ThreeDimensionalFloorPoint[]): boolean {
	let inside = false;
	let previous = vertices.at(-1);
	if (!previous) return false;
	for (const vertex of vertices) {
		if ((vertex.zM > point.zM) !== (previous.zM > point.zM) &&
			point.xM < vertex.xM + (point.zM - vertex.zM) * (previous.xM - vertex.xM) / (previous.zM - vertex.zM)) inside = !inside;
		previous = vertex;
	}
	return inside;
}

/**
 * Selects a visible floor asset by its projected footprint instead of making
 * an unselected object depend on a second, perfectly floor-aligned tap.
 * The radius includes the whole projected plan footprint and an 84px phone
 * target, while still ignoring distant empty canvas for camera orbit.
 */
export function floorItemAtScreenPoint(
	items: readonly SceneBox[],
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	point: { readonly x: number; readonly y: number },
): SceneBox | undefined {
	return [...items].reverse().find((item) => {
		if (!item.assetInstanceId) return false;
		const centre = canvasPointForFloor(scene, camera, size, {
			xM: item.centerXM,
			zM: item.centerZM,
		});
		return (
			centre !== undefined &&
			Math.hypot(point.x - centre.x, point.y - centre.y) <=
				projectedItemTouchRadius(item, scene, camera, size, centre)
		);
	});
}

function cameraBasis(scene: RectangularRoomWebGlScene, camera: ThreeDimensionalViewport) {
	const { eye: [x, y, z], target } = cameraEyeAndTargetFor(scene, camera);
	const eye = { x, y, z };
	const forward = normalize({ x: target[0] - x, y: target[1] - y, z: target[2] - z });
	const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
	const up = cross(right, forward);
	return { eye, forward, right, up };
}

function rayForCanvasPoint(
	basis: ReturnType<typeof cameraBasis>,
	size: CanvasSize,
	point: CanvasPoint,
): Vector3 {
	const ndcX = (point.x / size.width) * 2 - 1;
	const ndcY = 1 - (point.y / size.height) * 2;
	const tangent = Math.tan(Math.PI / 6);
	return normalize(add(basis.forward, add(
		scale(basis.right, ndcX * (size.width / size.height) * tangent),
		scale(basis.up, ndcY * tangent),
	)));
}

function projectedItemTouchRadius(
	item: SceneBox,
	scene: RectangularRoomWebGlScene,
	camera: ThreeDimensionalViewport,
	size: CanvasSize,
	centre: { readonly x: number; readonly y: number },
): number {
	const corners = itemFloorCornersFor(item);
	return Math.max(
		84,
		...corners.flatMap((corner) => {
			const projected = canvasPointForFloor(scene, camera, size, corner);
			return projected
				? [Math.hypot(projected.x - centre.x, projected.y - centre.y)]
				: [];
		}),
	);
}

/** Canonical local corners ordered around the item's visible floor footprint. */
function itemFloorCornersFor(item: SceneBox): readonly ThreeDimensionalFloorPoint[] {
	const yawRadians = item.yawRadians ?? 0;
	const cosine = Math.cos(yawRadians);
	const sine = Math.sin(yawRadians);
	return [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1],
	].map(([widthSign, depthSign]) => {
		const localX = (item.widthM / 2) * widthSign;
		const localZ = (item.depthM / 2) * depthSign;
		return {
			xM: item.centerXM + cosine * localX + sine * localZ,
			zM: item.centerZM - sine * localX + cosine * localZ,
		};
	});
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
