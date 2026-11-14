import { describe, expect, it } from "@rstest/core";
import { createThreeWallMesh } from "./three-webgl2-room-renderer";
import {
	wallPrismVerticesFor,
	wallCornerOutlineDrawsFor,
	wallJointOutlineDrawsFor,
} from "./webgl2-room-renderer";
import type { SceneBox } from "./rectangular-room-projection";

const solid = (): SceneBox => ({
	centerXM: 2,
	centerZM: 3,
	centerYM: 1.6,
	widthM: 4,
	depthM: 0.1,
	heightM: 2.4,
	yawRadians: Math.PI / 4,
	wall: { wallSegmentId: "wall" },
	wallFootprintM: [
		{ xM: -0.05, zM: 2.95 },
		{ xM: 4.05, zM: 2.95 },
		{ xM: 4.05, zM: 3.05 },
		{ xM: 0, zM: 3.05 },
	],
});
describe("physical wall meshes", () => {
	it("keeps an ordinary box wall's translation, yaw and dimensions when no footprint is provided", () => {
		const mesh = createThreeWallMesh({ ...solid(), wallFootprintM: undefined });
		mesh.geometry.computeBoundingBox();
		expect(mesh.geometry.boundingBox?.min.x).toBe(-2);
		expect(mesh.geometry.boundingBox?.max.y).toBeCloseTo(1.2);
		expect(mesh.geometry.boundingBox?.max.z).toBeCloseTo(0.05);
		expect(mesh.position.toArray()).toEqual([2, 1.6, 3]);
		expect(mesh.rotation.y).toBe(Math.PI / 4);
		expect(mesh.castShadow).toBe(false);
		expect(mesh.receiveShadow).toBe(true);
		mesh.geometry.dispose();
	});
	it("extrudes the shared footprint at the wall height without rotating scene coordinates twice", () => {
		const mesh = createThreeWallMesh(solid());
		mesh.geometry.computeBoundingBox();
		const bounds = mesh.geometry.boundingBox;
		expect(bounds?.min.x).toBeCloseTo(-0.05);
		expect(bounds?.max.x).toBeCloseTo(4.05);
		expect(bounds?.min.z).toBeCloseTo(2.95);
		expect(bounds?.max.z).toBeCloseTo(3.05);
		expect((bounds?.min.y ?? 0) + mesh.position.y).toBeCloseTo(0.4);
		expect((bounds?.max.y ?? 0) + mesh.position.y).toBeCloseTo(2.8);
		expect(mesh.rotation.y).toBe(0);
		mesh.geometry.dispose();
	});
	it("the raw WebGL fallback extrudes the same corner and sill without a box-only gap", () => {
		const vertices = wallPrismVerticesFor(solid());
		const axis = (offset: number) =>
			[...vertices].filter((_, index) => index % 3 === offset);
		expect(vertices.length).toBe(108);
		expect(Math.min(...axis(0))).toBeCloseTo(-0.05);
		expect(Math.max(...axis(0))).toBeCloseTo(4.05);
		expect(Math.min(...axis(1))).toBeCloseTo(0.4);
		expect(Math.max(...axis(1))).toBeCloseTo(2.8);
		expect(
			wallPrismVerticesFor({ ...solid(), wallFootprintM: undefined }),
		).toHaveLength(0);
	});
	it("does not add protruding decorative posts or box caps over a joined physical wall", () => {
		expect(wallCornerOutlineDrawsFor(solid())).toEqual([]);
		expect(
			wallJointOutlineDrawsFor([
				solid(),
				{ ...solid(), widthM: 0.1, depthM: 4 },
			]),
		).toEqual([]);
	});
});
