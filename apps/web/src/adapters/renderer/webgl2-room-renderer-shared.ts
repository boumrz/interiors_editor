import type { Object3D } from "three";

import type { CatalogProfile } from "./catalog-model-parts";
import { catalogPartsFor } from "./catalog-models";
import { greyboxShapeTemplates, type AdditionalGreyboxKind } from "./greybox-shape-templates";

import type {
	ExteriorCutawayEdge,
	RectangularRoomWebGlScene,
	SceneBox,
} from "./rectangular-room-projection";
import type { RoomRenderTheme } from "./three-dimensional-room-palette";

/** Shared disposable projection calculations; independent of either renderer implementation. */
export interface WebGl2SceneRenderer {
	render(
		camera?: WebGl2Camera,
		cutawayMode?: WebGl2CutawayMode,
		scene?: RectangularRoomWebGlScene,
		theme?: RoomRenderTheme,
	): void;
	/** Selects an item from the most recently drawn frame. */
	pickItem?(point: NormalizedCanvasPoint): string | undefined;
	/** Returns the nearest opaque surface on the same ray, including room geometry. */
	pickHit?(point: NormalizedCanvasPoint): WebGl2SceneHit | undefined;
	/** Replaces only decoded local model roots; shell/camera state stays live. */
	updateRuntimeModels?(runtimeModels: WebGl2RuntimeModels): void;
	dispose(): void;
}

/** Clip-space coordinates where the canvas spans [-1, 1] on both axes. */
export interface NormalizedCanvasPoint {
	readonly x: number;
	readonly y: number;
}

export interface WebGl2SceneHit {
	readonly distanceM: number;
	readonly assetInstanceId?: string | undefined;
}

export interface WebGl2OrbitCamera {
	readonly azimuthRadians: number;
	readonly elevationRadians: number;
	readonly distance: number;
	readonly panXM: number;
	readonly panZM: number;
}

export type WebGl2Camera = WebGl2OrbitCamera;

export type WebGl2CutawayMode = "auto" | "auto-sector" | "show-all";

export interface WebGl2WallCutaway {
	readonly hiddenWallSegmentIds: ReadonlySet<string>;
	readonly sector?: number;
}

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
	readonly normal: {
		readonly x: number;
		readonly z: number;
	};
	readonly supportM: number;
	readonly vertexIds?: readonly [string, string];
	readonly wallSegmentId: string;
}

const SECTOR_SIZE = Math.PI / 4;
const SECTOR_HYSTERESIS = Math.PI / 60;
const SECTOR_SUPPORT_ROUNDING_M = 0.000_001;

/**
 * View state belongs to a renderer instance. Remember the last classified sector
 * even when an irregular plan offers no wall to hide in that sector.
 */
export function wallCutawayForCamera(
	scene: RectangularRoomWebGlScene,
	camera: WebGl2Camera,
	mode: WebGl2CutawayMode,
	previous?: WebGl2WallCutaway,
): WebGl2WallCutaway {
	if (mode !== "auto-sector") {
		return { hiddenWallSegmentIds: hiddenWallSegmentIdsForCutaway(scene, camera, previous?.hiddenWallSegmentIds, mode) };
	}
	const { eye } = cameraEyeAndTargetFor(scene, camera);
	const x = eye[0] - scene.cameraBounds.centerXM;
	const z = eye[2] - scene.cameraBounds.centerZM;
	if (Math.hypot(x, z) <= Number.EPSILON) {
		return { hiddenWallSegmentIds: new Set() };
	}
	const sector = orbitSectorFor(Math.atan2(z, x), previous?.sector);
	return {
		hiddenWallSegmentIds: scene.exteriorCutawayEdges
			? frontContourForSector(scene.exteriorCutawayEdges, sector)
			: new Set(sectorFacadesFor(cutawayFacadesFor(scene), sector).map(facade => facade.wallSegmentId)),
		sector,
	};
}

function orbitSectorFor(angle: number, previous: number | undefined): number {
	if (previous !== undefined) {
		const delta = angle - previous * SECTOR_SIZE;
		const distance = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
		if (distance <= SECTOR_SIZE / 2 + SECTOR_HYSTERESIS) return previous;
	}
	// Resolve exact half-way values in the same direction despite trigonometric round-off.
	return Math.floor(angle / SECTOR_SIZE + 0.5 + Number.EPSILON);
}

interface ProjectedExteriorEdge {
	readonly min: number;
	readonly max: number;
	readonly depthAtMin: number;
	readonly depthAtMax: number;
	readonly wallSegmentId: string;
}

const frontContourCache = new WeakMap<
	readonly ExteriorCutawayEdge[],
	Map<number, ReadonlySet<string>>
>();

function frontContourForSector(
	edges: readonly ExteriorCutawayEdge[],
	sector: number,
): ReadonlySet<string> {
	const bySector = frontContourCache.get(edges) ?? new Map<number, ReadonlySet<string>>();
	frontContourCache.set(edges, bySector);
	const cached = bySector.get(sector);
	if (cached) return cached;

	const directionX = Math.cos(sector * SECTOR_SIZE);
	const directionZ = Math.sin(sector * SECTOR_SIZE);
	const lateral = ({ xM, zM }: ExteriorCutawayEdge["start"]) => zM * directionX - xM * directionZ;
	const depth = ({ xM, zM }: ExteriorCutawayEdge["start"]) => xM * directionX + zM * directionZ;
	const front = edges.flatMap(edge => {
		const facing = edge.normal.x * directionX + edge.normal.z * directionZ;
		if (facing <= CUTAWAY_ENTER_FACING_DOT * Math.hypot(edge.normal.x, edge.normal.z)) return [];
		const startLateral = lateral(edge.start);
		const endLateral = lateral(edge.end);
		if (Math.abs(startLateral - endLateral) <= SECTOR_SUPPORT_ROUNDING_M) return [];
		const startsAtMin = startLateral < endLateral;
		return [{
			min: startsAtMin ? startLateral : endLateral,
			max: startsAtMin ? endLateral : startLateral,
			depthAtMin: depth(startsAtMin ? edge.start : edge.end),
			depthAtMax: depth(startsAtMin ? edge.end : edge.start),
			wallSegmentId: edge.wallSegmentId,
		}];
	});
	const hidden = new Set(
		front.filter(edge => hasExposedSpan(edge, front)).map(edge => edge.wallSegmentId),
	);
	bySector.set(sector, hidden);
	return hidden;
}

function hasExposedSpan(
	edge: ProjectedExteriorEdge,
	front: readonly ProjectedExteriorEdge[],
): boolean {
	const covered = front.flatMap(other => {
		if (other === edge) return [];
		const min = Math.max(edge.min, other.min);
		const max = Math.min(edge.max, other.max);
		if (max - min <= SECTOR_SUPPORT_ROUNDING_M) return [];
		// Canonical centerlines never cross inside their intervals. Depth order at
		// the midpoint therefore holds throughout an overlap of positive length.
		const midpoint = (min + max) / 2;
		return edgeDepthAt(other, midpoint) > edgeDepthAt(edge, midpoint) + SECTOR_SUPPORT_ROUNDING_M
			? [{ min, max }]
			: [];
	}).sort((first, second) => first.min - second.min);

	let exposedFrom = edge.min;
	for (const { min, max } of covered) {
		if (min > exposedFrom + SECTOR_SUPPORT_ROUNDING_M) return true;
		exposedFrom = Math.max(exposedFrom, max);
	}
	return edge.max > exposedFrom + SECTOR_SUPPORT_ROUNDING_M;
}

function edgeDepthAt(edge: ProjectedExteriorEdge, position: number): number {
	const t = (position - edge.min) / (edge.max - edge.min);
	return edge.depthAtMin + t * (edge.depthAtMax - edge.depthAtMin);
}

function sectorFacadesFor(
	candidates: readonly CutawayFacadeCandidate[],
	sector: number,
): readonly CutawayFacadeCandidate[] {
	if (sector % 2 !== 0) {
		const first = facingFacade(candidates, sector - 1);
		const second = facingFacade(candidates, sector + 1);
		const firstVertices = new Set(first.flatMap((facade) => facade.vertexIds ?? []));
		if (second.some((facade) => facade.vertexIds?.some((vertex) => firstVertices.has(vertex)))) {
			return [...first, ...second];
		}
	}
	return facingFacade(candidates, sector);
}

function facingFacade(
	candidates: readonly CutawayFacadeCandidate[],
	sector: number,
): readonly CutawayFacadeCandidate[] {
	const x = Math.cos(sector * SECTOR_SIZE);
	const z = Math.sin(sector * SECTOR_SIZE);
	const facing = (facade: CutawayFacadeCandidate) => facade.normal.x * x + facade.normal.z * z;
	const best = candidates.reduce<CutawayFacadeCandidate | undefined>((winner, candidate) => {
		const score = facing(candidate);
		if (score <= CUTAWAY_ENTER_FACING_DOT) return winner;
		if (!winner) return candidate;
		const difference = score - facing(winner);
		if (Math.abs(difference) > CUTAWAY_FACING_TIE_EPSILON) return difference > 0 ? candidate : winner;
		// For parallel outward normals only the forward support plane is eligible.
		if (sameExteriorDirection(candidate, winner)) {
			return candidate.supportM > winner.supportM ? candidate : winner;
		}
		// A tie between different directions cannot depend on segment order.
		const axisDifference = candidate.normal.x - winner.normal.x || candidate.normal.z - winner.normal.z;
		return axisDifference > 0 ? candidate : winner;
	}, undefined);
	return best ? candidates.filter((candidate) => sameCutawayFacade(candidate, best, SECTOR_SUPPORT_ROUNDING_M)) : [];
}

function cutawayFacadesFor(
	scene: RectangularRoomWebGlScene,
): CutawayFacadeCandidate[] {
	return scene.walls.flatMap((wall) => {
		const identity = wall.wall;
		const normal = normalizedExteriorNormal(identity?.exteriorNormal);
		if (!identity || !normal) return [];
		return [{
			normal,
			supportM: exteriorSupportFor(wall, normal),
			vertexIds: identity.vertexIds,
			wallSegmentId: identity.wallSegmentId,
		}];
	});
}

/**
 * Returns only named exterior walls which face the live camera. The lower exit
 * threshold keeps the opening stable while an orbit gesture crosses a corner.
 */
export function hiddenWallSegmentIdsForCutaway(
	scene: RectangularRoomWebGlScene,
	camera: WebGl2Camera,
	previousHiddenWallSegmentIds: ReadonlySet<string> = new Set<string>(),
	cutawayMode: Exclude<WebGl2CutawayMode, "auto-sector"> = "auto",
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
	const candidates = cutawayFacadesFor(scene).map((facade) => ({
		...facade,
		facingDot: facade.normal.x * cameraDirection.x + facade.normal.z * cameraDirection.z,
	}));
	const previousCandidate = candidates.find((candidate) =>
		previousHiddenWallSegmentIds.has(candidate.wallSegmentId),
	);
	const nearestCandidate = candidates.reduce<(typeof candidates)[number] | undefined>((winner, candidate) => {
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
	supportToleranceM = CUTAWAY_FACADE_SUPPORT_TOLERANCE_M,
): boolean {
	return sameExteriorDirection(first, second) &&
		Math.abs(first.supportM - second.supportM) <= supportToleranceM;
}

function sameExteriorDirection(
	first: CutawayFacadeCandidate,
	second: CutawayFacadeCandidate,
): boolean {
	return first.normal.x * second.normal.x + first.normal.z * second.normal.z >=
		CUTAWAY_FACADE_NORMAL_SIMILARITY;
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
	| "arm"
	| "detail";

export interface FurnitureGreyboxPart {
	readonly box: SceneBox;
	readonly role: FurnitureGreyboxRole;
	readonly tone: "base" | "highlight" | "shadow" | "trim" | "foot";
	readonly edgeRadiusM?: number;
	readonly fixedColor?: string;
	readonly profile?: CatalogProfile;
	readonly opacity?: number;
}

export const SOFA_FOOT_COLOR = "#343735";
const DETAIL_CLEARANCE_M = 0.003;

export function furnitureGreyboxPartsFor(
	item: SceneBox,
	detailed: boolean,
): readonly FurnitureGreyboxPart[] {
	const furnitureKind = item.material?.furnitureKind;
	if ((!detailed && !item.showSupportLevels) || !furnitureKind || furnitureKind === "generic") {
		return [part("body", item)];
	}
	const catalogParts = catalogPartsFor(item, furnitureKind);
	if (catalogParts) return catalogParts;
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
	return furnitureKind === "two-seat-sofa" ? twoSeatSofaPartsFor(item) : sofaPartsFor(item);
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

/** Two seat pads, one continuous back facing -Z and four inset block feet. */
function twoSeatSofaPartsFor(item: SceneBox): readonly FurnitureGreyboxPart[] {
	const { widthM, depthM, heightM } = item;
	const arm = Math.min(0.16, widthM * 0.12);
	const seam = Math.min(0.014, widthM * 0.015);
	const seatWidth = (widthM - 2 * arm - 3 * seam) / 2;
	const footWidth = Math.min(0.105, arm);
	const footDepthFraction = Math.min(0.105 / depthM, 0.16);
	const sideSigns = [-1, 1];
	// In metres across the seat; as fractions of the envelope from floor to top and front to back.
	function section(
		role: FurnitureGreyboxRole, x: number, width: number,
		[bottom, top]: readonly [number, number],
		[front, rear]: readonly [number, number],
		edgeRadiusM: number, tone: FurnitureGreyboxPart["tone"] = "base",
	): FurnitureGreyboxPart {
		const box = sceneBoxAtLocalOffset(item, x, ((front + rear) / 2 - 0.5) * depthM);
		return {
			role, tone, edgeRadiusM,
			box: {
				...box,
				widthM: width,
				heightM: (top - bottom) * heightM,
				depthM: (rear - front) * depthM,
				centerYM: bottomOf(item) + ((bottom + top) / 2) * heightM,
			},
		};
	}
	return [
		section("body", 0, widthM - 2 * arm, [0.12, 0.33], [0.012, 0.82], 0.022, "shadow"),
		section("back", 0, widthM, [0.12, 1], [0.82, 1], 0.048),
		...sideSigns.map(side =>
			section("arm", side * (widthM - arm) / 2, arm, [0.12, 0.73], [0, 0.82], 0.032)),
		...sideSigns.map(side =>
			section("seat", side * (seatWidth + seam) / 2, seatWidth, [0.33, 0.54], [0, 0.82], 0.034)),
		...sideSigns.flatMap(side => [0.075, 0.925 - footDepthFraction].map(front =>
			section("leg", side * (widthM / 2 - arm * 0.75), footWidth,
				[0, 0.12], [front, front + footDepthFraction], 0, "foot"))),
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
