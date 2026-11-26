import { describe, expect, it } from "@rstest/core";
import { PerspectiveCamera, Vector3 } from "three";

import type { RectangularRoomWebGlScene, SceneBox } from "./rectangular-room-projection";
import { clipWallBodyToInterval, wallBodiesForProjection } from "./wall-body-projection";
import { pickProceduralSceneHit, pickProceduralSceneItem } from "./webgl2-item-picking";
import { cameraEyeAndTargetFor } from "./webgl2-room-renderer-shared";

const item: SceneBox = {
	assetInstanceId: "item", centerXM: 2, centerYM: 0.375, centerZM: 1.5,
	depthM: 0.8, heightM: 0.75, widthM: 1.2,
};
const scene: RectangularRoomWebGlScene = {
	cameraBounds: { centerXM: 2, centerZM: 1.5, depthM: 3, widthM: 4 },
	dimensions: { depthMm: 3000, heightMm: 2600, widthMm: 4000 },
	floors: [], items: [item], walls: [],
};
const camera = { azimuthRadians: 0, distance: 2.1, elevationRadians: 0.22, panXM: 0, panZM: 0 };
const aspect = 4 / 3;
const view = new PerspectiveCamera(60, aspect, 0.1, 100);
const { eye, target } = cameraEyeAndTargetFor(scene, camera);
view.position.set(...eye);
view.lookAt(...target);
view.updateMatrixWorld();
const centre = new Vector3(item.centerXM, item.centerYM, item.centerZM).project(view);
const wall = {
	centerXM: 3, centerYM: 1.5, centerZM: 1.5, depthM: 1, heightM: 3, widthM: 0.2,
	wall: { wallSegmentId: "opaque" },
	wallFootprintM: [
		{ xM: 2.9, zM: 1 }, { xM: 3.1, zM: 1 },
		{ xM: 3.1, zM: 2 }, { xM: 2.9, zM: 2 },
	],
} satisfies SceneBox;

describe("procedural renderer item picking", () => {
	it("retains the named shelf planes for a support target in a reduced fallback scene", () => {
		const shelf: SceneBox = {
			...item, assetInstanceId: "shelf", material: { colorHex: "#b8b4aa", furnitureKind: "catalog:open-shelf" },
			centerYM: 0.9, heightM: 1.8, widthM: 0.8, depthM: 0.35, showSupportLevels: true,
		};
		const project = { ...scene, items: [shelf] };
		const orbit = { ...camera, azimuthRadians: Math.PI / 2, distance: 0.33, elevationRadians: 0.27 };
		const nearView = new PerspectiveCamera(60, aspect, 0.1, 100);
		const viewpoint = cameraEyeAndTargetFor(project, orbit);
		nearView.position.set(...viewpoint.eye);
		nearView.lookAt(...viewpoint.target);
		nearView.updateMatrixWorld();
		const lowerShelf = new Vector3(2, 0.598, 1.64);
		const hit = pickProceduralSceneHit(project, orbit, aspect, lowerShelf.clone().project(nearView), undefined, false);
		expect(hit).toEqual({ assetInstanceId: "shelf", distanceM: expect.closeTo(nearView.position.distanceTo(lowerShelf), 5) });
	});

	it("returns metric distance to a tabletop and identifies a nearer room occluder", () => {
		const tabletop = new Vector3(item.centerXM, item.centerYM + item.heightM / 2, item.centerZM);
		const projected = tabletop.clone().project(view);
		const hit = pickProceduralSceneHit(scene, camera, aspect, projected, undefined, false);
		expect(hit).toEqual({ assetInstanceId: "item", distanceM: expect.closeTo(view.position.distanceTo(tabletop), 5) });
		const obstruction = pickProceduralSceneHit({ ...scene, walls: [wall] }, camera, aspect, projected, undefined, false);
		expect(obstruction?.assetInstanceId).toBeUndefined();
		expect(obstruction?.distanceM).toBeLessThan(hit?.distanceM ?? 0);
	});

	it("picks the front item at a shared screen position independent of their list order", () => {
		const front = { ...item, assetInstanceId: "front", centerXM: 3.1, centerYM: 0.63 };
		const pick = (items: readonly SceneBox[]) => pickProceduralSceneItem({ ...scene, items }, camera, aspect, centre, undefined, true);
		expect(pick([item, front])).toBe("front");
		expect(pick([front, item])).toBe("front");
		expect(pickProceduralSceneItem(scene, camera, aspect, { x: 0.6, y: centre.y }, undefined, true)).toBeUndefined();
	});

	it("follows the true horizontal projection at a rotated, zoomed camera and different canvas widths", () => {
		const orbit = { ...camera, azimuthRadians: 0.57, distance: 1.3, panZM: 0.3 };
		const narrow = { ...item, centerXM: 2.8, centerZM: 0.8, depthM: 0.14, widthM: 0.14 };
		const fixture = { ...scene, items: [narrow] };
		const viewpoint = cameraEyeAndTargetFor(fixture, orbit);
		for (const ratio of [0.64, 1.7]) {
			const projectedCamera = new PerspectiveCamera(60, ratio, 0.1, 100);
			projectedCamera.position.set(...viewpoint.eye);
			projectedCamera.lookAt(...viewpoint.target);
			projectedCamera.updateMatrixWorld();
			const contact = new Vector3(narrow.centerXM, narrow.centerYM, narrow.centerZM).project(projectedCamera);
			expect(pickProceduralSceneItem(fixture, orbit, ratio, contact, undefined, true)).toBe("item");
			expect(pickProceduralSceneItem(fixture, orbit, ratio, { x: contact.x + 0.12, y: contact.y }, undefined, true)).toBeUndefined();
		}
	});

	it("clips an oblique contact to the camera planes and rejects a zero-sized viewport", () => {
		const contact = { x: 0.77, y: 0.45 };
		const forward = view.getWorldDirection(new Vector3());
		const ray = new Vector3(contact.x, contact.y, -1).unproject(view).sub(view.position).normalize();
		const assetAtDepth = (depth: number, extent: number) => {
			const position = view.position.clone().addScaledVector(ray, depth / ray.dot(forward));
			return { ...item, centerXM: position.x, centerYM: position.y, centerZM: position.z, depthM: extent, heightM: extent, widthM: extent };
		};
		const pick = (box: SceneBox) => pickProceduralSceneItem({ ...scene, items: [box] }, camera, aspect, contact, undefined, false);
		expect(pick(assetAtDepth(0.087, 0.004))).toBeUndefined();
		expect(pick(assetAtDepth(0.099, 0.013))).toBe("item");
		expect(pick(assetAtDepth(95, 0.2))).toBe("item");
		expect(pick(assetAtDepth(101, 0.2))).toBeUndefined();
		expect(pickProceduralSceneItem(scene, camera, 0, centre, undefined, true)).toBeUndefined();
	});

	it("uses the drawn furniture detail level and leaves the area under a tabletop unselected", () => {
		const table = { ...item, material: { colorHex: "#b8b4aa", furnitureKind: "table" } } satisfies SceneBox;
		const projected = { ...scene, items: [table] };
		expect(pickProceduralSceneItem(projected, camera, aspect, centre, undefined, true)).toBeUndefined();
		expect(pickProceduralSceneItem(projected, camera, aspect, centre, undefined, false)).toBe("item");
	});

	it("uses only visible wall bodies and excludes walls behind the target", () => {
		const rear = { ...wall, wallFootprintM: wall.wallFootprintM.map((point) => ({ ...point, xM: point.xM - 2 })) };
		const low = { ...wall, centerYM: 0.2, heightM: 0.4 };
		const pick = (blocker: SceneBox, hidden?: ReadonlySet<string>) =>
			pickProceduralSceneItem({ ...scene, walls: [blocker] }, camera, aspect, centre, hidden, true);
		expect(pick(wall)).toBeUndefined();
		expect(pick(wall, new Set(["opaque"]))).toBe("item");
		expect(pick(rear)).toBe("item");
		expect(pick(low)).toBe("item");
	});

	it("intersects a diagonal wall and its clipped jamb on the same plan geometry", () => {
		const [body] = wallBodiesForProjection({
			vertices: [
				{ vertexId: "start", xMm: 2300, zMm: 900 },
				{ vertexId: "end", xMm: 3800, zMm: 2400 },
			],
			wallSegments: [{ wallSegmentId: "diagonal", startVertexId: "start", endVertexId: "end", thicknessMm: 100 }],
		});
		if (!body) throw new Error("Expected a physical diagonal wall");
		const pick = (polygon: typeof body.polygonMm) => pickProceduralSceneItem({
			...scene,
			walls: [{ ...wall, wallFootprintM: polygon.map((point) => ({ xM: point.xMm / 1000, zM: point.zMm / 1000 })) }],
		}, camera, aspect, centre, undefined, true);
		expect(pick(body.polygonMm)).toBeUndefined();
		expect(pick(clipWallBodyToInterval(body, 1300, body.lengthMm))).toBe("item");
	});

	it("selects a wall item through glass and blocks an opaque angled opening part", () => {
		const opening = {
			wallSegmentId: "opaque",
			box: { centerXM: 3, centerYM: 0.95, centerZM: 1.9, depthM: 0.08, heightM: 1.5, widthM: 1.2, yawRadians: Math.PI / 4 },
		};
		const pick = (role: "glass" | "leaf", hidden?: ReadonlySet<string>) => pickProceduralSceneItem({
			...scene, items: [{ ...item, assetAnchor: "wall" }],
			openingParts: [{ ...opening, role }],
		}, camera, aspect, centre, hidden, true);
		expect(pick("glass")).toBe("item");
		expect(pick("leaf")).toBeUndefined();
		expect(pick("leaf", new Set(["opaque"]))).toBe("item");
	});
});
