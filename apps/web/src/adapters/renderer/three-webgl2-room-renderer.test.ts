import { describe, expect, it } from "@rstest/core";
import {
	BoxGeometry,
	Color,
	Group,
	Mesh,
	MeshStandardMaterial,
	Texture,
} from "three";

import type { SceneBox } from "./rectangular-room-projection";
import {
	THREE_DIMENSIONAL_ROOM_LIGHTING,
	THREE_DIMENSIONAL_ROOM_PALETTE,
	THREE_DIMENSIONAL_ROOM_SURFACE_COLORS,
} from "./three-dimensional-room-palette";
import {
	cloneRuntimeRootAsNeutralClay,
	createThreeGreyboxItemGroup,
	THREE_DIMENSIONAL_RUNTIME_CLAY,
	threeDimensionalShadowFlagsFor,
} from "./three-webgl2-room-renderer";

const chair: SceneBox = {
	assetAnchor: "floor",
	assetInstanceId: "chair-1",
	centerXM: 2.4,
	centerYM: 0.55,
	centerZM: 1.7,
	depthM: 0.78,
	heightM: 1.1,
	material: { colorHex: "#557A95", furnitureKind: "chair" },
	widthM: 0.82,
	yawRadians: Math.PI / 3,
};

function perceivedBrightness(
	color: string | readonly [number, number, number, number],
): number {
	const channels =
		typeof color === "string"
			? [
				Number.parseInt(color.slice(1, 3), 16) / 255,
				Number.parseInt(color.slice(3, 5), 16) / 255,
				Number.parseInt(color.slice(5, 7), 16) / 255,
			]
			: color;
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

describe("3D room presentation", () => {
	it("turns a decoded GLB clone into neutral clay without mutating its source materials", () => {
		const sourceTexture = new Texture();
		const sourceMaterial = new MeshStandardMaterial({
			color: "#24140b",
			map: sourceTexture,
			metalness: 0.85,
			metalnessMap: sourceTexture,
			normalMap: sourceTexture,
			roughness: 0.12,
			roughnessMap: sourceTexture,
		});
		const sourceMesh = new Mesh(new BoxGeometry(1, 1, 1), sourceMaterial);
		const sourceRoot = new Group();
		sourceRoot.add(sourceMesh);

		const clayRoot = cloneRuntimeRootAsNeutralClay(sourceRoot);
		const clayMesh = clayRoot.children[0] as Mesh<
			BoxGeometry,
			MeshStandardMaterial
		>;

		expect(clayMesh).not.toBe(sourceMesh);
		expect(clayMesh.geometry).not.toBe(sourceMesh.geometry);
		expect(clayMesh.material).not.toBe(sourceMaterial);
		expect(clayMesh.material.color.getHexString()).toBe(
			new Color(THREE_DIMENSIONAL_RUNTIME_CLAY.color).getHexString(),
		);
		expect(clayMesh.material.map).toBeNull();
		expect(clayMesh.material.metalnessMap).toBeNull();
		expect(clayMesh.material.normalMap).toBeNull();
		expect(clayMesh.material.roughnessMap).toBeNull();
		expect(clayMesh.material.metalness).toBe(0);
		expect(clayMesh.material.roughness).toBe(
			THREE_DIMENSIONAL_RUNTIME_CLAY.roughness,
		);
		expect(sourceMaterial.color.getHexString()).toBe("24140b");
		expect(sourceMaterial.map).toBe(sourceTexture);
		expect(sourceMaterial.metalnessMap).toBe(sourceTexture);
		expect(sourceMaterial.normalMap).toBe(sourceTexture);
		expect(sourceMaterial.roughnessMap).toBe(sourceTexture);
		expect(sourceMaterial.metalness).toBe(0.85);
		expect(sourceMaterial.roughness).toBe(0.12);

		clayMesh.geometry.dispose();
		clayMesh.material.dispose();
		sourceMesh.geometry.dispose();
		sourceMaterial.dispose();
		sourceTexture.dispose();
	});

	it("uses shadows as a contact cue for items without throwing architectural wall silhouettes across the floor", () => {
		expect(threeDimensionalShadowFlagsFor("floor")).toEqual({
			castShadow: false,
			receiveShadow: true,
		});
		expect(threeDimensionalShadowFlagsFor("wall")).toEqual({
			castShadow: false,
			receiveShadow: true,
		});
		expect(threeDimensionalShadowFlagsFor("item")).toEqual({
			castShadow: true,
			receiveShadow: true,
		});
	});

	it("keeps the shared room shell in distinct depth planes without a washed-out fill light", () => {
		const threeBackground = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_PALETTE.background,
		);
		const threeFloor = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_PALETTE.floor,
		);
		const threeWall = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_PALETTE.wall,
		);
		const fallbackBackground = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.background,
		);
		const fallbackFloor = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorLightBoard,
		);
		const fallbackFloorDark = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorDarkBoard,
		);
		const fallbackWall = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.interiorWall,
		);
		const fallbackExteriorWall = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.exteriorWall,
		);
		const fallbackUpperWash = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.wallUpperWash,
		);
		const fallbackBaseboard = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.baseboard,
		);
		const fallbackOutline = perceivedBrightness(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.wallOutline,
		);

		// A phone-sized 3D view needs visible separation between background,
		// floor and walls in both the Three and raw WebGL2 projections.
		expect(threeBackground - threeFloor).toBeGreaterThanOrEqual(0.08);
		expect(threeFloor - threeWall).toBeGreaterThanOrEqual(0.07);
		expect(fallbackBackground - fallbackFloor).toBeGreaterThanOrEqual(0.08);
		expect(fallbackFloor - fallbackWall).toBeGreaterThanOrEqual(0.07);
		expect(fallbackFloor - fallbackFloorDark).toBeGreaterThanOrEqual(0.03);
		expect(fallbackWall - fallbackExteriorWall).toBeGreaterThanOrEqual(0.06);
		expect(fallbackUpperWash - fallbackWall).toBeGreaterThanOrEqual(0.06);
		expect(fallbackExteriorWall - fallbackBaseboard).toBeGreaterThanOrEqual(0.06);
		expect(fallbackBaseboard - fallbackOutline).toBeGreaterThanOrEqual(0.35);
		expect(THREE_DIMENSIONAL_ROOM_LIGHTING.ambient.intensity).toBeLessThanOrEqual(1);
		expect(THREE_DIMENSIONAL_ROOM_LIGHTING.fill.intensity).toBeLessThanOrEqual(0.55);
		expect(THREE_DIMENSIONAL_ROOM_LIGHTING.key.intensity).toBeGreaterThanOrEqual(2);
		expect(THREE_DIMENSIONAL_ROOM_LIGHTING.skylight.intensity).toBeLessThanOrEqual(0.7);
		expect(
		perceivedBrightness(THREE_DIMENSIONAL_ROOM_LIGHTING.ambient.color),
	).toBeGreaterThanOrEqual(0.99);
		expect(
		perceivedBrightness(THREE_DIMENSIONAL_ROOM_LIGHTING.key.color),
	).toBeGreaterThanOrEqual(0.99);
		expect(
		perceivedBrightness(THREE_DIMENSIONAL_ROOM_LIGHTING.fill.color),
	).toBeGreaterThanOrEqual(0.9);
		expect(
		perceivedBrightness(THREE_DIMENSIONAL_ROOM_LIGHTING.skylight.skyColor) -
			perceivedBrightness(THREE_DIMENSIONAL_ROOM_LIGHTING.skylight.groundColor),
	).toBeGreaterThanOrEqual(0.12);
	});
});

describe("createThreeGreyboxItemGroup", () => {
	it("turns a classified chair into local neutral parts while its parent retains the canonical pose", () => {
		const group = createThreeGreyboxItemGroup(chair);
		const meshes = group.children as Mesh<BoxGeometry, MeshStandardMaterial>[];
		const epsilon = 0.000000001;

		expect(group.position.toArray()).toEqual([
			chair.centerXM,
			chair.centerYM - chair.heightM / 2,
			chair.centerZM,
		]);
		expect(group.rotation.y).toBeCloseTo(chair.yawRadians ?? 0, 8);
		expect(meshes.map((mesh) => mesh.name)).toEqual([
			"greybox:seat",
			"greybox:leg",
			"greybox:leg",
			"greybox:leg",
			"greybox:leg",
			"greybox:back",
		]);
		const base = new Color("#557A95");
		const highlight = base.clone().lerp(new Color("#ffffff"), 0.14);
		const shadow = base.clone().lerp(new Color("#1f2933"), 0.12);
		expect(meshes.map((mesh) => mesh.material.color.getHexString())).toEqual([
			highlight.getHexString(),
			base.getHexString(),
			base.getHexString(),
			base.getHexString(),
			base.getHexString(),
			shadow.getHexString(),
		]);
		expect(meshes.every((mesh) => mesh.castShadow)).toBe(true);
		expect(meshes.every((mesh) => mesh.receiveShadow)).toBe(true);

		for (const mesh of meshes) {
			const parameters = mesh.geometry.parameters;
			const widthM = parameters.width as number;
			const heightM = parameters.height as number;
			const depthM = parameters.depth as number;
			expect(mesh.position.x - widthM / 2).toBeGreaterThanOrEqual(
				-chair.widthM / 2 - epsilon,
			);
			expect(mesh.position.x + widthM / 2).toBeLessThanOrEqual(
				chair.widthM / 2 + epsilon,
			);
			expect(mesh.position.y - heightM / 2).toBeGreaterThanOrEqual(-epsilon);
			expect(mesh.position.y + heightM / 2).toBeLessThanOrEqual(
				chair.heightM + epsilon,
			);
			expect(mesh.position.z - depthM / 2).toBeGreaterThanOrEqual(
				-chair.depthM / 2 - epsilon,
			);
			expect(mesh.position.z + depthM / 2).toBeLessThanOrEqual(
				chair.depthM / 2 + epsilon,
			);
		}
	});

	it("keeps an unclassified item as one canonical neutral box", () => {
		const group = createThreeGreyboxItemGroup({
			...chair,
			material: { colorHex: "#557A95", furnitureKind: "generic" },
		});

		expect(group.children.map((child) => child.name)).toEqual(["greybox:body"]);
	});

	it("uses the neutral fallback when a disposable projection has no material metadata", () => {
		const group = createThreeGreyboxItemGroup({
			...chair,
			material: undefined,
		});
		const [mesh] = group.children as Mesh<BoxGeometry, MeshStandardMaterial>[];
		if (!mesh) throw new Error("Expected one fallback greybox mesh");

		expect(mesh.name).toBe("greybox:body");
		expect(mesh.material.color.getHexString()).toBe(
			new Color("#b8b4aa").getHexString(),
		);
	});
});
