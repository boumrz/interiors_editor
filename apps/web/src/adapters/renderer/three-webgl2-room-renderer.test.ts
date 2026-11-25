import { describe, expect, it } from "@rstest/core";
import {
	BoxGeometry,
	Color,
	Group,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	Vector3,
	Texture,
} from "three";

import type { SceneBox } from "./rectangular-room-projection";
import {
	DARK_ROOM_SURFACE_COLORS,
	roomMaterialColors,
	THREE_DIMENSIONAL_ROOM_LIGHTING,
	THREE_DIMENSIONAL_ROOM_PALETTE,
	THREE_DIMENSIONAL_ROOM_SURFACE_COLORS,
} from "./three-dimensional-room-palette";
import {
	cloneRuntimeRootAsNeutralClay,
	createThreeGreyboxItemGroup,
	pickThreeSceneItem,
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

	it("keeps floor, walls and surface details distinct against the shared dark plan canvas", () => {
		const theme = { colorScheme: "dark", background: "#1d252c" } as const;
		const background = perceivedBrightness(theme.background);
		const three = roomMaterialColors(theme);
		const fallback = DARK_ROOM_SURFACE_COLORS;
		for (const [floor, wall] of [[three.floor, three.wall], [fallback.floorLightBoard, fallback.interiorWall]] as const) {
			const floorBrightness = perceivedBrightness(floor);
			const wallBrightness = perceivedBrightness(wall);
			expect(floorBrightness - background).toBeGreaterThan(0.18);
			expect(wallBrightness - floorBrightness).toBeGreaterThan(0.06);
			expect(wallBrightness).toBeLessThan(0.5);
		}
		for (const color of Object.values(fallback)) {
			expect(color[3]).toBe(1);
			expect(color.slice(0, 3).every((channel) => channel > 0 && channel < 0.55)).toBe(true);
		}
		const contrast = (surface: keyof typeof fallback, adjacent: keyof typeof fallback) =>
			perceivedBrightness(fallback[surface]) - perceivedBrightness(fallback[adjacent]);
		expect(contrast("floorLightBoard", "floorDarkBoard")).toBeGreaterThan(0.015);
		expect(contrast("interiorWall", "exteriorWall")).toBeGreaterThan(0.03);
		expect(contrast("exteriorWall", "baseboard")).toBeGreaterThan(0.04);
		expect(contrast("baseboard", "wallOutline")).toBeGreaterThan(0.08);
		expect(contrast("wallUpperWash", "interiorWall")).toBeGreaterThan(0.025);
		const lightMaterials = { floor: THREE_DIMENSIONAL_ROOM_PALETTE.floor, wall: THREE_DIMENSIONAL_ROOM_PALETTE.wall };
		expect(roomMaterialColors({ ...theme, colorScheme: "light" })).toMatchObject(lightMaterials);
		expect(roomMaterialColors()).toMatchObject(lightMaterials);
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

describe("picking drawn 3D surfaces", () => {
	const view = new PerspectiveCamera(60, 1.2, 0.1, 100);
	view.position.set(0, 0, 8);
	view.lookAt(0, 0, 0);
	view.updateMatrixWorld();

	const boxAt = (x: number, z: number) => {
		const mesh = new Mesh(new BoxGeometry(1, 1, 0.5), new MeshStandardMaterial());
		mesh.position.set(x, 0, z);
		mesh.updateMatrixWorld();
		return mesh;
	};

	it("picks the closest visible mesh across asset order and also selects an exposed rear surface", () => {
		const front = { root: boxAt(0, 3), assetInstanceId: "front" };
		const rear = { root: boxAt(0.65, 0), assetInstanceId: "rear" };
		const overlap = new Vector3(0.18, 0, 3.25).project(view);
		const exposed = new Vector3(1.04, 0, 0.25).project(view);

		expect(pickThreeSceneItem(view, overlap, [rear, front])).toBe("front");
		expect(pickThreeSceneItem(view, overlap, [front, rear])).toBe("front");
		expect(pickThreeSceneItem(view, exposed, [rear, front])).toBe("rear");
		expect(pickThreeSceneItem(view, { x: 0.7, y: 0 }, [rear, front])).toBeUndefined();
	});

	it("respects near and far planes towards the sides of the image", () => {
		const camera = new PerspectiveCamera(60, 1.2, 0.5, 5);
		camera.updateMatrixWorld();
		const beforeNear = { root: boxAt(0, -0.2), assetInstanceId: "clipped" };
		const nearHit = { root: boxAt(0, -0.8), assetInstanceId: "after-near" };
		const side = { root: boxAt(2.5, -4.9), assetInstanceId: "within-far" };
		const contact = new Vector3(2.5, 0, -4.65).project(camera);
		expect(pickThreeSceneItem(camera, { x: 0, y: 0 }, [beforeNear, nearHit])).toBe("after-near");
		expect(pickThreeSceneItem(camera, contact, [side])).toBe("within-far");
		side.root.position.z -= 0.7;
		side.root.updateMatrixWorld();
		expect(pickThreeSceneItem(camera, contact, [side])).toBeUndefined();
	});

	it("passes through an empty gap in a nested item and rejects depth-writing walls", () => {
		const frontGroup = new Group();
		frontGroup.position.z = 3;
		frontGroup.add(boxAt(-0.8, 0), boxAt(0.8, 0));
		frontGroup.updateMatrixWorld();
		const rear = boxAt(0, 0);
		const wall = boxAt(0, 5);
		const wallGroup = new Group();
		wallGroup.add(wall);
		wallGroup.updateMatrixWorld();
		const surfaces = [{ root: frontGroup, assetInstanceId: "shelf" }, { root: rear, assetInstanceId: "visible-through-gap" }, { root: wallGroup }];
		const centre = { x: 0, y: 0 };

		expect(pickThreeSceneItem(view, centre, surfaces)).toBeUndefined();
		wall.material.depthWrite = false;
		expect(pickThreeSceneItem(view, centre, surfaces)).toBe("visible-through-gap");
		wall.material.depthWrite = true;
		wallGroup.visible = false;
		expect(pickThreeSceneItem(view, centre, surfaces)).toBe("visible-through-gap");
	});
});
