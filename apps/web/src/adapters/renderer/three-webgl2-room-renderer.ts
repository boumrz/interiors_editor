import {
	ACESFilmicToneMapping,
	AmbientLight,
	Box3,
	BoxGeometry,
	Color,
	DoubleSide,
	DirectionalLight,
	HemisphereLight,
	ExtrudeGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	PCFSoftShadowMap,
	PerspectiveCamera,
	Scene,
	SRGBColorSpace,
	Shape,
	Vector3,
	Vector2,
	WebGLRenderer,
	type Material,
	type Object3D,
} from "three";

import { GLASS_OPACITY, OPENING_FINISH } from "./opening-template";
import type {
	RectangularRoomWebGlScene,
	SceneBox,
	SceneFloorPolygon,
} from "./rectangular-room-projection";
import {
	THREE_DIMENSIONAL_ROOM_LIGHTING,
	THREE_DIMENSIONAL_ROOM_PALETTE,
} from "./three-dimensional-room-palette";
import {
	cameraEyeAndTargetFor,
	furnitureGreyboxPartsFor,
	hiddenWallSegmentIdsForCutaway,
	type WebGl2Camera,
	type WebGl2CutawayMode,
	type WebGl2RendererQualityTier,
	type WebGl2RuntimeModel,
	type WebGl2RuntimeModels,
	type WebGl2SceneRenderer,
} from "./webgl2-room-renderer-shared";

interface ItemNode {
	readonly greyboxAppearanceKey: string | undefined;
	readonly assetDefinitionId: string | undefined;
	readonly group: Group;
	readonly runtime: boolean;
	readonly runtimeModel: WebGl2RuntimeModel | undefined;
}

/**
 * Presentation-only tones for the disposable 3D projection. The quiet shell
 * keeps the room legible on a small phone, while the warm floor preserves the
 * immediate sense of orientation familiar from interior-planning tools.
 */
export { THREE_DIMENSIONAL_ROOM_PALETTE } from "./three-dimensional-room-palette";

/**
 * Decoded catalogue geometry remains useful for its silhouette, but the phone
 * editor deliberately presents it as a quiet clay study rather than a
 * photorealistic product render. These values touch only disposable clones.
 */
export const THREE_DIMENSIONAL_RUNTIME_CLAY = {
	color: "#899296",
	roughness: 0.88,
} as const;

/**
 * A disposable Three scene on the same WebGL2 context as the baseline room
 * renderer.  GLB bytes have already crossed validation and pinning before a
 * source root reaches this adapter; the adapter owns only its cloned GPU scene.
 */
export function createThreeWebGl2RoomSceneRenderer(
	context: WebGL2RenderingContext,
	scene: RectangularRoomWebGlScene,
	qualityTier: WebGl2RendererQualityTier,
	runtimeModels: WebGl2RuntimeModels,
	resizeDrawingBufferOnChangeOnly = false,
): WebGl2SceneRenderer {
	const canvas = context.canvas as HTMLCanvasElement;
	const renderer = new WebGLRenderer({
		alpha: false,
		antialias: qualityTier === "standard",
		canvas,
		context,
		preserveDrawingBuffer: false,
	});
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = qualityTier === "standard";
	renderer.shadowMap.type = PCFSoftShadowMap;
	let drawingBufferSize: { width: number; height: number; pixelRatio: number } | undefined;
	const threeScene = new Scene();
	threeScene.background = new Color(THREE_DIMENSIONAL_ROOM_PALETTE.background);
	threeScene.add(
		new AmbientLight(
			THREE_DIMENSIONAL_ROOM_LIGHTING.ambient.color,
			THREE_DIMENSIONAL_ROOM_LIGHTING.ambient.intensity,
		),
	);
	threeScene.add(
		new HemisphereLight(
			THREE_DIMENSIONAL_ROOM_LIGHTING.skylight.skyColor,
			THREE_DIMENSIONAL_ROOM_LIGHTING.skylight.groundColor,
			THREE_DIMENSIONAL_ROOM_LIGHTING.skylight.intensity,
		),
	);
	const directional = new DirectionalLight(
		THREE_DIMENSIONAL_ROOM_LIGHTING.key.color,
		THREE_DIMENSIONAL_ROOM_LIGHTING.key.intensity,
	);
	directional.position.set(...THREE_DIMENSIONAL_ROOM_LIGHTING.key.position);
	directional.castShadow = qualityTier === "standard";
	directional.shadow.bias = -0.0003;
	directional.shadow.normalBias = 0.006;
	directional.shadow.mapSize.set(512, 512);
	directional.shadow.radius = 3;
	const fill = new DirectionalLight(
		THREE_DIMENSIONAL_ROOM_LIGHTING.fill.color,
		THREE_DIMENSIONAL_ROOM_LIGHTING.fill.intensity,
	);
	fill.position.set(...THREE_DIMENSIONAL_ROOM_LIGHTING.fill.position);
	threeScene.add(directional, directional.target, fill);
	const camera = new PerspectiveCamera(60, 1, 0.1, 100);
	const roomGroup = new Group();
	const itemGroup = new Group();
	threeScene.add(roomGroup, itemGroup);
	const wallGroups = new Map<string, Group[]>();
	const itemNodes = new Map<string, ItemNode>();
	let activeScene = scene;
	let activeRuntimeModels = runtimeModels;
	let hiddenWallSegmentIds = new Set<string>();

	for (const floor of scene.floors) {
		roomGroup.add(
			boxMesh(floor, THREE_DIMENSIONAL_ROOM_PALETTE.floor, "floor"),
		);
	}
	for (const floor of scene.floorPolygons ?? []) {
		roomGroup.add(polygonFloorMesh(floor));
	}
	const addWallPart = (part: Mesh, wallSegmentId?: string) => {
		const wallGroup = new Group();
		wallGroup.add(part);
		roomGroup.add(wallGroup);
		if (wallSegmentId) {
			wallGroups.set(wallSegmentId, [
				...(wallGroups.get(wallSegmentId) ?? []),
				wallGroup,
			]);
		}
	};
	for (const wall of scene.walls) addWallPart(createThreeWallMesh(wall), wall.wall?.wallSegmentId);
	for (const { box, role, wallSegmentId } of scene.openingParts ?? []) {
		const mesh = boxMesh(box, OPENING_FINISH[role], "wall");
		if (role === "glass") {
			mesh.material.transparent = true;
			mesh.material.opacity = GLASS_OPACITY;
			mesh.material.depthWrite = false;
			mesh.material.roughness = 0.25;
		}
		addWallPart(mesh, wallSegmentId);
	}
	syncItems(scene.items, itemGroup, itemNodes, activeRuntimeModels);

	return {
		dispose: () => {
			for (const node of itemNodes.values()) disposeItemNode(node);
			itemNodes.clear();
			disposeRoomGroup(roomGroup);
			renderer.dispose();
		},
		render: (
			viewport = initialWebGl2Camera,
			cutawayMode: WebGl2CutawayMode = "auto",
			sceneOverride = scene,
		) => {
			activeScene = sceneOverride;
			const pixelRatio = Math.min(
				qualityTier === "reduced" ? 1 : 2,
				window.devicePixelRatio || 1,
			);
			const width = Math.max(1, canvas.clientWidth);
			const height = Math.max(1, canvas.clientHeight);
			if (!resizeDrawingBufferOnChangeOnly) {
				renderer.setPixelRatio(pixelRatio);
				renderer.setSize(width, height, false);
			} else if (
				drawingBufferSize?.width !== width ||
				drawingBufferSize.height !== height ||
				drawingBufferSize.pixelRatio !== pixelRatio
			) {
				// Three's setPixelRatio also calls setSize, which resets the canvas buffer.
				renderer.setDrawingBufferSize(width, height, pixelRatio);
				drawingBufferSize = { width, height, pixelRatio };
			}
			camera.aspect = width / height;
			configureKeyShadow(directional, activeScene);
			const viewpoint = cameraEyeAndTargetFor(activeScene, viewport);
			camera.position.set(...viewpoint.eye);
			camera.lookAt(...viewpoint.target);
			camera.updateProjectionMatrix();
			hiddenWallSegmentIds = new Set(
				hiddenWallSegmentIdsForCutaway(
					activeScene,
					viewport,
					hiddenWallSegmentIds,
					cutawayMode,
				),
			);
			for (const [wallSegmentId, groups] of wallGroups) {
				for (const group of groups) {
					group.visible = !hiddenWallSegmentIds.has(wallSegmentId);
				}
			}
			syncItems(activeScene.items, itemGroup, itemNodes, activeRuntimeModels);
			renderer.render(threeScene, camera);
		},
		updateRuntimeModels: (nextRuntimeModels) => {
			activeRuntimeModels = nextRuntimeModels;
			syncItems(activeScene.items, itemGroup, itemNodes, activeRuntimeModels);
		},
	};
}

const initialWebGl2Camera: WebGl2Camera = {
	azimuthRadians: 0,
	distance: 2.1,
	elevationRadians: 1,
	panXM: 0,
	panZM: 0,
};

function syncItems(
	items: readonly SceneBox[],
	itemGroup: Group,
	itemNodes: Map<string, ItemNode>,
	runtimeModels: WebGl2RuntimeModels,
): void {
	const currentIds = new Set<string>();
	for (const [index, item] of items.entries()) {
		const id = item.assetInstanceId ?? `preview:${index}`;
		currentIds.add(id);
		const runtime = item.assetDefinitionId
			? runtimeModels[item.assetDefinitionId]
			: undefined;
		const material = item.material;
		const greyboxAppearanceKey = !runtime && material?.refreshGreyboxAppearance
			? [material.furnitureKind, material.colorHex, item.widthM, item.depthM, item.heightM].join(":")
			: undefined;
		const current = itemNodes.get(id);
		if (
			!current ||
			current.assetDefinitionId !== item.assetDefinitionId ||
			current.runtime !== (runtime !== undefined) ||
			current.runtimeModel !== runtime ||
			current.greyboxAppearanceKey !== greyboxAppearanceKey
		) {
			if (current) disposeItemNode(current);
			const group = runtime
				? runtimeItemGroup(item, runtime.root, runtime.sourceDimensionsM)
				: createThreeGreyboxItemGroup(item);
			itemGroup.add(group);
			itemNodes.set(id, {
				greyboxAppearanceKey,
				assetDefinitionId: item.assetDefinitionId,
				group,
				runtime: runtime !== undefined,
				runtimeModel: runtime,
			});
			continue;
		}
		updateItemPose(current.group, item);
	}
	for (const [id, node] of itemNodes) {
		if (currentIds.has(id)) continue;
		disposeItemNode(node);
		itemNodes.delete(id);
	}
}

function runtimeItemGroup(
	item: SceneBox,
	root: Object3D,
	sourceDimensionsM: {
		readonly depthM: number;
		readonly heightM: number;
		readonly widthM: number;
	},
): Group {
	const anchor = new Group();
	const instance = cloneRuntimeRootAsNeutralClay(root);
	const bounds = new Box3().setFromObject(instance);
	const centre = bounds.getCenter(new Vector3());
	instance.scale.set(
		item.widthM / sourceDimensionsM.widthM,
		item.heightM / sourceDimensionsM.heightM,
		item.depthM / sourceDimensionsM.depthM,
	);
	instance.position.set(
		-centre.x * instance.scale.x,
		-bounds.min.y * instance.scale.y,
		-centre.z * instance.scale.z,
	);
	anchor.add(instance);
	updateItemPose(anchor, item);
	return anchor;
}

/**
 * Builds a disposable multi-part Three.js greybox from the same procedural
 * furniture vocabulary as the fallback WebGL2 renderer. Parts stay in the
 * item's local envelope; the parent alone owns the projected world pose.
 */
export function createThreeGreyboxItemGroup(item: SceneBox): Group {
	const group = new Group();
	const localItem: SceneBox = {
		...item,
		centerXM: 0,
		centerYM: item.heightM / 2,
		centerZM: 0,
		yawRadians: 0,
	};
	for (const part of furnitureGreyboxPartsFor(localItem, true)) {
		const mesh = boxMesh(
			part.box,
			furnitureToneColor(item.material?.colorHex, part.tone),
		);
		mesh.name = `greybox:${part.role}`;
		group.add(mesh);
	}
	updateItemPose(group, item);
	return group;
}

function furnitureToneColor(
	colorHex: string | undefined,
	tone: "base" | "highlight" | "shadow",
): string {
	const color = new Color(colorHex ?? "#b8b4aa");
	if (tone === "highlight") {
		color.lerp(new Color("#ffffff"), 0.14);
	}
	if (tone === "shadow") {
		color.lerp(new Color("#1f2933"), 0.12);
	}
	return `#${color.getHexString()}`;
}

function updateItemPose(group: Group, item: SceneBox): void {
	group.position.set(
		item.centerXM,
		item.centerYM - item.heightM / 2,
		item.centerZM,
	);
	group.rotation.y = item.yawRadians ?? 0;
}

export type ThreeDimensionalShadowRole = "floor" | "item" | "wall";

/** The floor receives soft item contact; static shell pieces stay shadow-free. */
export function threeDimensionalShadowFlagsFor(
	role: ThreeDimensionalShadowRole,
): { readonly castShadow: boolean; readonly receiveShadow: boolean } {
	return {
		castShadow: role === "item",
		receiveShadow: true,
	};
}

function polygonFloorMesh(floor: SceneFloorPolygon): Mesh {
	const shape = new Shape(
		floor.vertices.map((vertex) => new Vector2(vertex.xM, vertex.zM)),
	);
	const geometry = new ExtrudeGeometry(shape, {
		bevelEnabled: false,
		depth: floor.heightM,
	});
	geometry.rotateX(Math.PI / 2);
	const mesh = new Mesh(
		geometry,
		new MeshStandardMaterial({
			color: THREE_DIMENSIONAL_ROOM_PALETTE.floor,
			roughness: 0.72,
			side: DoubleSide,
		}),
	);
	mesh.position.y = floor.heightM / 2;
	const shadowFlags = threeDimensionalShadowFlagsFor("floor");
	mesh.castShadow = shadowFlags.castShadow;
	mesh.receiveShadow = shadowFlags.receiveShadow;
	return mesh;
}

export function createThreeWallMesh(wall: SceneBox): Mesh {
	return boxMesh(wall, THREE_DIMENSIONAL_ROOM_PALETTE.wall, "wall");
}

function boxMesh(
	box: SceneBox,
	color: string,
	shadowRole: ThreeDimensionalShadowRole = "item",
) {
	const geometry = box.wallFootprintM
		? new ExtrudeGeometry(
				new Shape(
					box.wallFootprintM.map((point) => new Vector2(point.xM, point.zM)),
				),
				{ bevelEnabled: false, depth: box.heightM },
			)
		: new BoxGeometry(box.widthM, box.heightM, box.depthM);
	if (box.wallFootprintM) geometry.rotateX(Math.PI / 2);
	const mesh = new Mesh(
		geometry,
		new MeshStandardMaterial({ color, roughness: 0.76 }),
	);
	if (box.wallFootprintM) mesh.position.y = box.centerYM + box.heightM / 2;
	else {
		mesh.position.set(box.centerXM, box.centerYM, box.centerZM);
		mesh.rotation.y = box.yawRadians ?? 0;
	}
	const shadowFlags = threeDimensionalShadowFlagsFor(shadowRole);
	mesh.castShadow = shadowFlags.castShadow;
	mesh.receiveShadow = shadowFlags.receiveShadow;
	return mesh;
}

/**
 * Keeps a decoded GLB's geometry while removing texture/product-render
 * treatment from its disposable projection. The cached source root remains
 * untouched for recovery, export and later clone requests.
 */
export function cloneRuntimeRootAsNeutralClay(root: Object3D): Object3D {
	const clone = root.clone(true);
	clone.traverse((node) => {
		const mesh = node as Mesh;
		if (!("geometry" in mesh) || !("material" in mesh)) return;
		mesh.geometry = mesh.geometry.clone();
		const materials = asMaterials(mesh.material).map(
			materialForNeutralRuntimeClay,
		);
		mesh.material = Array.isArray(mesh.material)
			? materials
			: (materials[0] ?? materialForNeutralRuntimeClay(mesh.material));
		const shadowFlags = threeDimensionalShadowFlagsFor("item");
		mesh.castShadow = shadowFlags.castShadow;
		mesh.receiveShadow = shadowFlags.receiveShadow;
	});
	return clone;
}

function materialForNeutralRuntimeClay(source: Material): MeshStandardMaterial {
	const material = new MeshStandardMaterial({
		color: THREE_DIMENSIONAL_RUNTIME_CLAY.color,
		metalness: 0,
		roughness: THREE_DIMENSIONAL_RUNTIME_CLAY.roughness,
		side: source.side,
	});
	material.name = source.name;
	return material;
}

/** Keeps the soft key shadow focused on the current disposable room envelope. */
function configureKeyShadow(
	light: DirectionalLight,
	scene: RectangularRoomWebGlScene,
): void {
	if (!light.castShadow) return;
	const extent = Math.max(
		scene.cameraBounds.widthM,
		scene.cameraBounds.depthM,
		scene.dimensions.heightMm / 1000,
	);
	const range = Math.max(3, extent * 1.3);
	light.target.position.set(
		scene.cameraBounds.centerXM,
		0,
		scene.cameraBounds.centerZM,
	);
	light.target.updateMatrixWorld();
	light.shadow.camera.bottom = -range;
	light.shadow.camera.left = -range;
	light.shadow.camera.near = 0.1;
	light.shadow.camera.right = range;
	light.shadow.camera.top = range;
	light.shadow.camera.far = range * 5;
	light.shadow.camera.updateProjectionMatrix();
}

function disposeItemNode(node: ItemNode): void {
	node.group.removeFromParent();
	if (!node.runtime) {
		disposeRoomGroup(node.group);
		return;
	}
	node.group.traverse((child) => {
		const mesh = child as Mesh;
		if (!("geometry" in mesh) || !("material" in mesh)) return;
		mesh.geometry.dispose();
		for (const material of asMaterials(mesh.material)) material.dispose();
	});
}

function disposeRoomGroup(group: Group): void {
	group.traverse((child) => {
		const mesh = child as Mesh;
		if (!("geometry" in mesh) || !("material" in mesh)) return;
		mesh.geometry.dispose();
		for (const material of asMaterials(mesh.material)) material.dispose();
	});
	group.removeFromParent();
}

function asMaterials(
	material: Material | readonly Material[],
): readonly Material[] {
	return "isMaterial" in material ? [material] : material;
}
