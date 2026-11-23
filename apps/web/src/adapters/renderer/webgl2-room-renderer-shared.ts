import type { Object3D } from "three";

import { greyboxShapeTemplates, type AdditionalGreyboxKind } from "./greybox-shape-templates";

import type {
	RectangularRoomWebGlScene,
	SceneBox,
} from "./rectangular-room-projection";

/** Shared disposable projection calculations; independent of either renderer implementation. */
export interface WebGl2SceneRenderer {
	render(
		camera?: WebGl2Camera,
		cutawayMode?: WebGl2CutawayMode,
		scene?: RectangularRoomWebGlScene,
	): void;
	/** Replaces only decoded local model roots; shell/camera state stays live. */
	updateRuntimeModels?(runtimeModels: WebGl2RuntimeModels): void;
	dispose(): void;
}

export interface WebGl2OrbitCamera {
	readonly azimuthRadians: number;
	readonly elevationRadians: number;
	readonly distance: number;
	readonly panXM: number;
	readonly panZM: number;
}

export type WebGl2Camera = WebGl2OrbitCamera;

export type WebGl2CutawayMode = "auto" | "show-all";

/** Rendering quality is an ephemeral projection setting, never Project state. */
export type WebGl2RendererQualityTier = "standard" | "reduced";

/**
 * Already-decoded local resources passed across the renderer boundary. These
 * are disposable source roots, never Project state or a network fetch route.
 */
export interface WebGl2RuntimeModel {
	readonly root: Object3D;
	readonly sourceDimensionsM: {
		readonly depthM: number;
		readonly heightM: number;
		readonly widthM: number;
	};
}

export type WebGl2RuntimeModels = Readonly<Record<string, WebGl2RuntimeModel>>;

const CUTAWAY_ENTER_FACING_DOT = 0.3;
const CUTAWAY_EXIT_FACING_DOT = 0.1;
const CUTAWAY_FACING_TIE_EPSILON = 0.000_001;
const CUTAWAY_FACADE_NORMAL_SIMILARITY = 0.999;
const CUTAWAY_FACADE_SUPPORT_TOLERANCE_M = 0.025;

interface CutawayFacadeCandidate {
	readonly facingDot: number;
	readonly normal: {
		readonly x: number;
		readonly z: number;
	};
	readonly supportM: number;
	readonly wallSegmentId: string;
}

/**
 * Returns only named exterior walls which face the live camera. The lower exit
 * threshold keeps the opening stable while an orbit gesture crosses a corner.
 */
export function hiddenWallSegmentIdsForCutaway(
	scene: RectangularRoomWebGlScene,
	camera: WebGl2Camera,
	previousHiddenWallSegmentIds: ReadonlySet<string> = new Set<string>(),
	cutawayMode: WebGl2CutawayMode = "auto",
): ReadonlySet<string> {
	if (cutawayMode === "show-all") {
		return new Set<string>();
	}
	const { eye } = cameraEyeAndTargetFor(scene, camera);
	const cameraToPlanCentre = {
		x: eye[0] - scene.cameraBounds.centerXM,
		z: eye[2] - scene.cameraBounds.centerZM,
	};
	const cameraToPlanCentreLength = Math.hypot(
		cameraToPlanCentre.x,
		cameraToPlanCentre.z,
	);
	if (cameraToPlanCentreLength <= Number.EPSILON) {
		return new Set<string>();
	}
	const cameraDirection = {
		x: cameraToPlanCentre.x / cameraToPlanCentreLength,
		z: cameraToPlanCentre.z / cameraToPlanCentreLength,
	};
	const candidates = scene.walls.flatMap((wall) => {
		const wallIdentity = wall.wall;
		const normal = normalizedExteriorNormal(wallIdentity?.exteriorNormal);
		if (!wallIdentity || !normal) return [];
		return [
			{
				facingDot: normal.x * cameraDirection.x + normal.z * cameraDirection.z,
				normal,
				supportM: exteriorSupportFor(wall, normal),
				wallSegmentId: wallIdentity.wallSegmentId,
			},
		];
	});
	const previousCandidate = candidates.find((candidate) =>
		previousHiddenWallSegmentIds.has(candidate.wallSegmentId),
	);
	const nearestCandidate = candidates.reduce<
		CutawayFacadeCandidate | undefined
	>((winner, candidate) => {
		if (candidate.facingDot <= CUTAWAY_ENTER_FACING_DOT) return winner;
		if (!winner) return candidate;
		return candidate.facingDot >
			winner.facingDot + CUTAWAY_FACING_TIE_EPSILON ||
			(Math.abs(candidate.facingDot - winner.facingDot) <=
				CUTAWAY_FACING_TIE_EPSILON &&
				candidate.supportM > winner.supportM)
			? candidate
			: winner;
	}, undefined);
	// A current opening stays intact while an orbit gesture crosses a corner;
	// when it leaves the exit sector, pick one complete nearest facade anew.
	const visibleFacade =
		previousCandidate && previousCandidate.facingDot > CUTAWAY_EXIT_FACING_DOT
			? previousCandidate
			: nearestCandidate;
	if (!visibleFacade) return new Set<string>();
	return new Set(
		candidates
			.filter((candidate) => sameCutawayFacade(candidate, visibleFacade))
			.map((candidate) => candidate.wallSegmentId),
	);
}

function normalizedExteriorNormal(
	normal: { readonly x: number; readonly z: number } | undefined,
): { readonly x: number; readonly z: number } | undefined {
	if (!normal) return undefined;
	const length = Math.hypot(normal.x, normal.z);
	if (length <= Number.EPSILON) return undefined;
	return { x: normal.x / length, z: normal.z / length };
}

/**
 * A facade is an exterior support plane, not every individual wall box. The
 * width/depth projection keeps this true for the alpha 45-degree wall poses.
 */
function exteriorSupportFor(
	wall: SceneBox,
	normal: { readonly x: number; readonly z: number },
): number {
	const yawRadians = sceneBoxYawRadians(wall);
	const localXAxis = { x: Math.cos(yawRadians), z: -Math.sin(yawRadians) };
	const localZAxis = { x: Math.sin(yawRadians), z: Math.cos(yawRadians) };
	const halfProjection =
		(Math.abs(normal.x * localXAxis.x + normal.z * localXAxis.z) *
			wall.widthM) /
			2 +
		(Math.abs(normal.x * localZAxis.x + normal.z * localZAxis.z) *
			wall.depthM) /
			2;
	return normal.x * wall.centerXM + normal.z * wall.centerZM + halfProjection;
}

function sameCutawayFacade(
	first: CutawayFacadeCandidate,
	second: CutawayFacadeCandidate,
): boolean {
	return (
		first.normal.x * second.normal.x + first.normal.z * second.normal.z >=
			CUTAWAY_FACADE_NORMAL_SIMILARITY &&
		Math.abs(first.supportM - second.supportM) <=
			CUTAWAY_FACADE_SUPPORT_TOLERANCE_M
	);
}

export function cameraEyeAndTargetFor(
	scene: RectangularRoomWebGlScene,
	camera: WebGl2Camera,
): {
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
} {
	const extent = Math.max(scene.cameraBounds.widthM, scene.cameraBounds.depthM);
	const target: readonly [number, number, number] = [
		scene.cameraBounds.centerXM + camera.panXM,
		(scene.dimensions.heightMm / 1000) * 0.22,
		scene.cameraBounds.centerZM + camera.panZM,
	];
	const horizontalDistance =
		extent * camera.distance * Math.cos(camera.elevationRadians);
	return {
		eye: [
			target[0] + Math.cos(camera.azimuthRadians) * horizontalDistance,
			target[1] + extent * camera.distance * Math.sin(camera.elevationRadians),
			target[2] + Math.sin(camera.azimuthRadians) * horizontalDistance,
		],
		target,
	};
}

export type FurnitureGreyboxRole =
	| "body"
	| "tabletop"
	| "leg"
	| "seat"
	| "back"
	| "bed-base"
	| "mattress"
	| "headboard"
	| "drawer"
	| "arm";

export interface FurnitureGreyboxPart {
	readonly box: SceneBox;
	readonly role: FurnitureGreyboxRole;
	readonly tone: "base" | "highlight" | "shadow";
}

const DETAIL_CLEARANCE_M = 0.003;

export function furnitureGreyboxPartsFor(
	item: SceneBox,
	detailed: boolean,
): readonly FurnitureGreyboxPart[] {
	const furnitureKind = item.material?.furnitureKind;
	if (!detailed || !furnitureKind || furnitureKind === "generic") {
		return [part("body", item)];
	}
	if (isAdditionalGreyboxKind(furnitureKind)) {
		return greyboxShapeTemplates[furnitureKind].map(([x, y, z, width, height, depth, tone]) => part("body", {
			...sceneBoxAtLocalOffset(item, (x + width / 2 - 0.5) * item.widthM, (z + depth / 2 - 0.5) * item.depthM),
			centerYM: bottomOf(item) + (y + height / 2) * item.heightM,
			widthM: width * item.widthM,
			heightM: height * item.heightM,
			depthM: depth * item.depthM,
		}, tone));
	}
	if (furnitureKind === "table") {
		return tablePartsFor(item);
	}
	if (furnitureKind === "chair") {
		return chairPartsFor(item);
	}
	if (furnitureKind === "bed") {
		return bedPartsFor(item);
	}
	if (furnitureKind === "storage") {
		return storagePartsFor(item);
	}
	if (furnitureKind === "bath") {
		const floorHeight = item.heightM * 0.29;
		const rimHeight = item.heightM - floorHeight;
		const rimWidth = item.widthM * 0.12;
		const rimDepth = item.depthM * 0.15;
		const rimCenterY = bottomOf(item) + floorHeight + rimHeight / 2;
		return [
			part("body", { ...item, heightM: floorHeight, centerYM: bottomOf(item) + floorHeight / 2 }, "shadow"),
			...[-1, 1].map((side) => part("body", {
				...sceneBoxAtLocalOffset(item, side * (item.widthM - rimWidth) / 2, 0),
				widthM: rimWidth,
				heightM: rimHeight,
				centerYM: rimCenterY,
			}, "highlight")),
			...[-1, 1].map((side) => part("body", {
				...sceneBoxAtLocalOffset(item, 0, side * (item.depthM - rimDepth) / 2),
				widthM: item.widthM - 2 * rimWidth,
				depthM: rimDepth,
				heightM: rimHeight,
				centerYM: rimCenterY,
			}, "highlight")),
		];
	}
	if (furnitureKind === "washer" || furnitureKind === "mirror" || furnitureKind === "sconce") {
		const frontDepth = item.depthM * 0.14;
		const front = sceneBoxAtLocalOffset(item, 0, (item.depthM - frontDepth) / 2);
		const body = sceneBoxAtLocalOffset(item, 0, -frontDepth / 2);
		return [
			part("body", { ...body, depthM: item.depthM - frontDepth }),
			part("body", {
				...front,
				widthM: item.widthM * (furnitureKind === "washer" ? 0.57 : 0.82),
				heightM: item.heightM * (furnitureKind === "washer" ? 0.49 : 0.82),
				depthM: frontDepth,
			}, furnitureKind === "washer" ? "shadow" : "highlight"),
		];
	}
	return sofaPartsFor(item);
}

function isAdditionalGreyboxKind(kind: string): kind is AdditionalGreyboxKind {
	return Object.hasOwn(greyboxShapeTemplates, kind);
}

function tablePartsFor(item: SceneBox): readonly FurnitureGreyboxPart[] {
	const bottomYM = bottomOf(item);
	const tabletopHeightM = item.heightM * 0.12;
	const legHeightM = Math.max(
		0.01,
		item.heightM - tabletopHeightM - DETAIL_CLEARANCE_M,
	);
	const legWidthM = detailThickness(item.widthM, 0.1, 0.07);
	const legDepthM = detailThickness(item.depthM, 0.1, 0.07);
	const parts: FurnitureGreyboxPart[] = [
		part(
			"tabletop",
			{
				...item,
				centerYM: bottomYM + item.heightM - tabletopHeightM / 2,
				heightM: tabletopHeightM,
			},
			"highlight",
		),
	];
	for (const offsetX of [-1, 1]) {
		for (const offsetZ of [-1, 1]) {
			parts.push(
				part("leg", {
					...sceneBoxAtLocalOffset(
						item,
						offsetX * (item.widthM / 2 - legWidthM / 2),
						offsetZ * (item.depthM / 2 - legDepthM / 2),
					),
					centerYM: bottomYM + legHeightM / 2,
					depthM: legDepthM,
					heightM: legHeightM,
					widthM: legWidthM,
				}),
			);
		}
	}
	return parts;
}

function chairPartsFor(item: SceneBox): readonly FurnitureGreyboxPart[] {
	const bottomYM = bottomOf(item);
	const legHeightM = item.heightM * 0.42;
	const seatHeightM = item.heightM * 0.13;
	const backHeightM = Math.max(
		0.01,
		item.heightM - legHeightM - seatHeightM - DETAIL_CLEARANCE_M * 2,
	);
	const legWidthM = detailThickness(item.widthM, 0.1, 0.06);
	const legDepthM = detailThickness(item.depthM, 0.1, 0.06);
	const parts: FurnitureGreyboxPart[] = [
		part(
			"seat",
			{
				...item,
				centerYM: bottomYM + legHeightM + DETAIL_CLEARANCE_M + seatHeightM / 2,
				depthM: item.depthM * 0.76,
				heightM: seatHeightM,
				widthM: item.widthM * 0.78,
			},
			"highlight",
		),
	];
	for (const offsetX of [-1, 1]) {
		for (const offsetZ of [-1, 1]) {
			parts.push(
				part("leg", {
					...sceneBoxAtLocalOffset(
						item,
						offsetX * (item.widthM / 2 - legWidthM / 2),
						offsetZ * (item.depthM / 2 - legDepthM / 2),
					),
					centerYM: bottomYM + legHeightM / 2,
					depthM: legDepthM,
					heightM: legHeightM,
					widthM: legWidthM,
				}),
			);
		}
	}
	return [
		...parts,
		part(
			"back",
			{
				...sceneBoxAtLocalOffset(
					item,
					0,
					item.depthM / 2 - detailThickness(item.depthM, 0.22, 0.18) / 2,
				),
				centerYM:
					bottomYM +
					legHeightM +
					DETAIL_CLEARANCE_M * 2 +
					seatHeightM +
					backHeightM / 2,
				depthM: detailThickness(item.depthM, 0.22, 0.18),
				heightM: backHeightM,
				widthM: item.widthM * 0.82,
			},
			"shadow",
		),
	];
}

function bedPartsFor(item: SceneBox): readonly FurnitureGreyboxPart[] {
	const bottomYM = bottomOf(item);
	const baseHeightM = item.heightM * 0.24;
	const mattressHeightM = item.heightM * 0.45;
	const headboardDepthM = detailThickness(item.depthM, 0.1, 0.12);
	const sleepingDepthM = Math.max(
		0.02,
		item.depthM - headboardDepthM - DETAIL_CLEARANCE_M,
	);
	const sleepingCentreZM = -(headboardDepthM + DETAIL_CLEARANCE_M) / 2;
	const headboardHeightM = Math.max(
		0.02,
		item.heightM - baseHeightM - DETAIL_CLEARANCE_M,
	);
	return [
		part("bed-base", {
			...sceneBoxAtLocalOffset(item, 0, sleepingCentreZM),
			centerYM: bottomYM + baseHeightM / 2,
			depthM: sleepingDepthM,
			heightM: baseHeightM,
		}),
		part(
			"mattress",
			{
				...sceneBoxAtLocalOffset(item, 0, sleepingCentreZM),
				centerYM:
					bottomYM + baseHeightM + DETAIL_CLEARANCE_M + mattressHeightM / 2,
				depthM: sleepingDepthM,
				heightM: mattressHeightM,
				widthM: item.widthM * 0.9,
			},
			"highlight",
		),
		part(
			"headboard",
			{
				...sceneBoxAtLocalOffset(
					item,
					0,
					item.depthM / 2 - headboardDepthM / 2,
				),
				centerYM:
					bottomYM + baseHeightM + DETAIL_CLEARANCE_M + headboardHeightM / 2,
				depthM: headboardDepthM,
				heightM: headboardHeightM,
			},
			"shadow",
		),
	];
}

function storagePartsFor(item: SceneBox): readonly FurnitureGreyboxPart[] {
	const bottomYM = bottomOf(item);
	const drawerDepthM = detailThickness(item.depthM, 0.06, 0.05);
	const drawerHeightM = item.heightM * 0.16;
	const carcassDepthM = Math.max(
		0.02,
		item.depthM - drawerDepthM - DETAIL_CLEARANCE_M,
	);
	const carcassCentreZM = -(drawerDepthM + DETAIL_CLEARANCE_M) / 2;
	return [
		part("body", {
			...sceneBoxAtLocalOffset(item, 0, carcassCentreZM),
			depthM: carcassDepthM,
		}),
		...[0.22, 0.5, 0.78].map((verticalOffset) =>
			part(
				"drawer",
				{
					...sceneBoxAtLocalOffset(item, 0, item.depthM / 2 - drawerDepthM / 2),
					centerYM: bottomYM + item.heightM * verticalOffset,
					depthM: drawerDepthM,
					heightM: drawerHeightM,
					widthM: item.widthM * 0.82,
				},
				"highlight",
			),
		),
	];
}

function sofaPartsFor(item: SceneBox): readonly FurnitureGreyboxPart[] {
	const bottomYM = bottomOf(item);
	const baseHeightM = item.heightM * 0.28;
	const seatHeightM = item.heightM * 0.18;
	const backHeightM = item.heightM - baseHeightM - seatHeightM;
	const armWidthM = detailThickness(item.widthM, 0.14, 0.14);
	const backDepthM = detailThickness(item.depthM, 0.18, 0.2);
	const armHeightM = baseHeightM + seatHeightM;
	const coreWidthM = Math.max(
		0.02,
		item.widthM - armWidthM * 2 - DETAIL_CLEARANCE_M * 2,
	);
	const seatWidthM = Math.min(item.widthM * 0.74, coreWidthM);
	const armDepthM = Math.max(0.02, item.depthM * 0.58);
	return [
		part("body", {
			...item,
			centerYM: bottomYM + baseHeightM / 2,
			heightM: baseHeightM,
			widthM: coreWidthM,
		}),
		part(
			"seat",
			{
				...sceneBoxAtLocalOffset(item, 0, -item.depthM * 0.08),
				centerYM: bottomYM + baseHeightM + seatHeightM / 2,
				depthM: item.depthM * 0.62,
				heightM: seatHeightM,
				widthM: seatWidthM,
			},
			"highlight",
		),
		part(
			"back",
			{
				...sceneBoxAtLocalOffset(item, 0, item.depthM / 2 - backDepthM / 2),
				centerYM: bottomYM + baseHeightM + seatHeightM + backHeightM / 2,
				depthM: backDepthM,
				heightM: backHeightM,
			},
			"shadow",
		),
		...[-1, 1].map((offsetX) =>
			part(
				"arm",
				{
					...sceneBoxAtLocalOffset(
						item,
						offsetX * (item.widthM / 2 - armWidthM / 2),
						-item.depthM * 0.06,
					),
					centerYM: bottomYM + armHeightM / 2,
					depthM: armDepthM,
					heightM: armHeightM,
					widthM: armWidthM,
				},
				"base",
			),
		),
	];
}

function part(
	role: FurnitureGreyboxRole,
	box: SceneBox,
	tone: FurnitureGreyboxPart["tone"] = "base",
): FurnitureGreyboxPart {
	return { box, role, tone };
}

function bottomOf(item: SceneBox): number {
	return item.centerYM - item.heightM / 2;
}

function detailThickness(
	extentM: number,
	fraction: number,
	maximumM: number,
): number {
	return Math.min(
		maximumM,
		Math.max(Math.min(0.02, extentM), extentM * fraction),
	);
}

/**
 * Places a furniture detail in the item's local floor plane, preserving the
 * same yaw as its parent. The detail consequently follows the item rather
 * than merely rotating around its own centre.
 */
function sceneBoxAtLocalOffset(
	item: SceneBox,
	localXM: number,
	localZM: number,
): SceneBox {
	const yawRadians = sceneBoxYawRadians(item);
	const cosine = Math.cos(yawRadians);
	const sine = Math.sin(yawRadians);
	return {
		...item,
		centerXM: item.centerXM + cosine * localXM + sine * localZM,
		centerZM: item.centerZM - sine * localXM + cosine * localZM,
	};
}

export function sceneBoxYawRadians(box: SceneBox): number {
	return typeof box.yawRadians === "number" && Number.isFinite(box.yawRadians)
		? box.yawRadians
		: 0;
}
