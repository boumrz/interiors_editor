import {
	wallBodiesForProjection,
	clipWallBodyToInterval,
	type WallBodyProjection,
} from "./wall-body-projection";
import {
	type AxisAlignedRectMm,
	type DerivedOrthogonalWall,
	resolveOrthogonalPlanFaces,
} from "../../domain/derived-orthogonal-plan-faces";
import { resolveProjectV2Plan } from "../../domain/derived-project-v2-plan";
import type {
	Project,
	Vertex,
	WallOpening,
	WallSchematicAssetInstance,
	WallSegment,
} from "../../domain/project";
import type { ProjectV2 } from "../../domain/project-v2";
import { wallOpeningIntervalMm } from "../../domain/wall-opening";

const MM_PER_SCENE_METRE = 1000;
const FLOOR_THICKNESS_MM = 40;

/**
 * Alpha catalogue semantics projected only into disposable 3D greyboxes.
 * The canonical Project still stores the user-facing label, not a renderer
 * classification, so later catalogue assets can replace these silhouettes.
 */
export type FurnitureGreyboxKind =
	| "generic"
	| "table"
	| "chair"
	| "bed"
	| "storage"
	| "sofa";

export interface SceneBox {
	/** Joined physical wall prism, in scene coordinates; absent for ordinary boxes. */
	readonly wallFootprintM?: readonly {
		readonly xM: number;
		readonly zM: number;
	}[];
	readonly centerXM: number;
	readonly centerYM: number;
	readonly centerZM: number;
	readonly widthM: number;
	readonly heightM: number;
	readonly depthM: number;
	/** Positive angles rotate local +Z toward world +X around the vertical axis. */
	readonly yawRadians?: number;
	/** Present only on projected floor assets; never becomes renderer state. */
	readonly assetInstanceId?: string;
	/** Present only for an instance of a pinned local GLB resource. */
	readonly assetDefinitionId?: string;
	/** Stable host class for a disposable item projection. */
	readonly assetAnchor?: "floor" | "wall";
	readonly wall?: {
		readonly wallSegmentId: string;
		readonly exteriorNormal?: {
			readonly x: number;
			readonly z: number;
		};
	};
	/** Present only on a derived usable Room floor; never mesh-owned identity. */
	readonly floor?: {
		readonly roomId: string;
	};
	readonly material?: {
		readonly colorHex: string;
		readonly furnitureKind: FurnitureGreyboxKind;
	};
}

/** An exact non-rectangular usable floor, derived from the canonical PlanGraph. */
export interface SceneFloorPolygon {
	readonly floor: {
		readonly roomId: string;
	};
	readonly heightM: number;
	readonly vertices: readonly {
		readonly xM: number;
		readonly zM: number;
	}[];
}

export interface WallItemPlanFootprint {
	readonly centerXMm: number;
	readonly centerZMm: number;
	readonly corners: readonly {
		readonly xMm: number;
		readonly zMm: number;
	}[];
	readonly yawRadians: number;
}

type WallItemPlanProjectionInput = Pick<
	WallSchematicAssetInstance,
	"depthMm" | "offsetMm" | "side" | "widthMm"
>;

/**
 * Opaque optional runtime metadata. The Alpha raw-WebGL2 adapter deliberately
 * ignores it and renders the canonical item dimensions as a greybox instead.
 */
export interface CustomGlbSceneModel {
	readonly assetDefinitionId: string;
}

export interface RectangularRoomWebGlScene {
	/** The full component envelope used exclusively to frame the disposable camera. */
	readonly cameraBounds: {
		readonly centerXM: number;
		readonly centerZM: number;
		readonly widthM: number;
		readonly depthM: number;
	};
	readonly dimensions: {
		readonly widthMm: number;
		readonly depthMm: number;
		readonly heightMm: number;
	};
	/** Each derived room face owns its floor; empty space between components stays empty. */
	readonly floors: readonly SceneBox[];
	/** Present only when a Room's usable floor cannot be represented as boxes. */
	readonly floorPolygons?: readonly SceneFloorPolygon[];
	readonly walls: readonly SceneBox[];
	readonly items: readonly SceneBox[];
	/** Optional resource metadata; never an engine object or a render instruction. */
	readonly customGlbModels?: readonly CustomGlbSceneModel[];
}

/**
 * Projects either durable geometry schema through its derived-plan resolver.
 * The returned boxes remain disposable WebGL state; neither resolver accepts
 * room metadata as a substitute for canonical vertices and wall segments.
 */
export function projectRectangularRoomForWebGl(
	project: Project | ProjectV2,
): RectangularRoomWebGlScene | undefined {
	const resolved =
		project.schemaVersion === 2
			? resolveProjectV2Plan(project)
			: resolveOrthogonalPlanFaces(project);
	if (resolved.kind === "rejected") {
		return undefined;
	}
	const { plan } = resolved;
	if (
		project.level.vertices.length === 0 ||
		project.level.wallSegments.length === 0 ||
		plan.rooms.length === 0
	) {
		return undefined;
	}
	const vertexById = new Map(
		project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const wallProjectionById = new Map(
		plan.walls.map((wall) => [wall.wallSegmentId, wall]),
	);
	const xValues = project.level.vertices.map((vertex) => vertex.xMm);
	const zValues = project.level.vertices.map((vertex) => vertex.zMm);
	const minimumXmm = Math.min(...xValues);
	const maximumXmm = Math.max(...xValues);
	const minimumZmm = Math.min(...zValues);
	const maximumZmm = Math.max(...zValues);
	const outerWidthMm = maximumXmm - minimumXmm;
	const outerDepthMm = maximumZmm - minimumZmm;
	const usableFloorPoints = plan.rooms.flatMap((room) => [
		...room.usableFloorTilesMm.flatMap((tile) => [
			{ xMm: tile.minXmm, zMm: tile.minZmm },
			{ xMm: tile.maxXmm, zMm: tile.maxZmm },
		]),
		...(room.usableFloorPolygonMm ?? []),
	]);
	if (usableFloorPoints.length === 0) return undefined;
	const usableMinimumXmm = Math.min(
		...usableFloorPoints.map((point) => point.xMm),
	);
	const usableMaximumXmm = Math.max(
		...usableFloorPoints.map((point) => point.xMm),
	);
	const usableMinimumZmm = Math.min(
		...usableFloorPoints.map((point) => point.zMm),
	);
	const usableMaximumZmm = Math.max(
		...usableFloorPoints.map((point) => point.zMm),
	);
	const usableWidthMm = usableMaximumXmm - usableMinimumXmm;
	const usableDepthMm = usableMaximumZmm - usableMinimumZmm;
	const heightMm = Math.max(...plan.rooms.map((room) => room.heightMm));
	if (
		!Number.isSafeInteger(outerWidthMm) ||
		!Number.isSafeInteger(outerDepthMm) ||
		!Number.isFinite(usableWidthMm) ||
		!Number.isFinite(usableDepthMm) ||
		!Number.isSafeInteger(heightMm) ||
		outerWidthMm <= 0 ||
		outerDepthMm <= 0 ||
		usableWidthMm <= 0 ||
		usableDepthMm <= 0 ||
		heightMm <= 0
	) {
		return undefined;
	}
	const outerWidthM = metres(outerWidthMm);
	const outerDepthM = metres(outerDepthMm);
	const centerXM = outerWidthM / 2;
	const centerZM = outerDepthM / 2;
	const floors = plan.rooms.flatMap((room) =>
		room.usableFloorTilesMm.map((tile) =>
			floorForTile(tile, minimumXmm, minimumZmm, room.roomId),
		),
	);
	const floorPolygons = plan.rooms.flatMap((room) =>
		room.usableFloorPolygonMm && room.usableFloorPolygonMm.length >= 3
			? [
					floorPolygonFor(
						room.usableFloorPolygonMm,
						minimumXmm,
						minimumZmm,
						room.roomId,
					),
				]
			: [],
	);
	const doorThresholdFloors = project.level.openings.flatMap((opening) => {
		if (opening.kind !== "Door" || opening.sillMm !== 0) return [];
		const wall = project.level.wallSegments.find(
			(candidate) => candidate.wallSegmentId === opening.wallSegmentId,
		);
		const start = wall ? vertexById.get(wall.startVertexId) : undefined;
		const end = wall ? vertexById.get(wall.endVertexId) : undefined;
		return wall && start && end
			? doorThresholdFloorFor(opening, wall, start, end, minimumXmm, minimumZmm)
			: [];
	});
	const wallBodies = new Map(
		wallBodiesForProjection(project.level).map((body) => [
			body.wallSegmentId,
			body,
		]),
	);
	const wallBoxes = project.level.wallSegments.map((wall) => {
		const start = vertexById.get(wall.startVertexId);
		const end = vertexById.get(wall.endVertexId);
		const projection = wallProjectionById.get(wall.wallSegmentId);
		if (!start || !end || !projection) {
			return [];
		}
		return wallBoxesForProjection({
			body: wallBodies.get(wall.wallSegmentId),
			end,
			minimumXmm,
			minimumZmm,
			openings: project.level.openings.filter(
				(opening) => opening.wallSegmentId === wall.wallSegmentId,
			),
			projection,
			start,
			wall,
		});
	});
	if (
		wallBoxes.some((boxes) => boxes.length === 0) ||
		(floors.length === 0 && floorPolygons.length === 0)
	) {
		return undefined;
	}
	const walls = wallBoxes.flat();
	const items = project.assetInstances.flatMap((item) => {
		if (item.anchorClass === "wall") {
			const wall = project.level.wallSegments.find(
				(candidate) => candidate.wallSegmentId === item.wallSegmentId,
			);
			const start = wall ? vertexById.get(wall.startVertexId) : undefined;
			const end = wall ? vertexById.get(wall.endVertexId) : undefined;
			if (!wall || !start || !end) return [];
			const box = wallItemBoxForProjection(
				item,
				wall,
				start,
				end,
				minimumXmm,
				minimumZmm,
			);
			return box ? [box] : [];
		}
		const yawRadians = yawRadiansForAsset(item);
		return [
			{
				...(!("assetDefinitionId" in item) ||
				item.assetDefinitionId === undefined
					? {}
					: { assetDefinitionId: item.assetDefinitionId }),
				centerXM: metres(item.xMm - minimumXmm),
				centerYM: metres(item.heightMm) / 2,
				centerZM: metres(item.zMm - minimumZmm),
				depthM: metres(item.depthMm),
				heightM: metres(item.heightMm),
				material: {
					colorHex: item.color,
					furnitureKind: furnitureKindFor(item.label),
				},
				assetAnchor: "floor" as const,
				assetInstanceId: item.assetInstanceId,
				widthM: metres(item.widthMm),
				...(yawRadians === undefined ? {} : { yawRadians }),
			},
		];
	});
	return {
		cameraBounds: {
			centerXM,
			centerZM,
			depthM: outerDepthM,
			widthM: outerWidthM,
		},
		dimensions: { depthMm: usableDepthMm, heightMm, widthMm: usableWidthMm },
		floors: [...floors, ...doorThresholdFloors],
		...(floorPolygons.length === 0 ? {} : { floorPolygons }),
		items,
		walls,
	};
}

/** Projects a wall-local asset only at render time; canonical state never gains scene coordinates. */
function wallItemBoxForProjection(
	item: Extract<
		Project["assetInstances"][number],
		{ readonly anchorClass: "wall" }
	>,
	wall: WallSegment,
	start: Vertex,
	end: Vertex,
	minimumXmm: number,
	minimumZmm: number,
): SceneBox | undefined {
	const footprint = wallItemPlanFootprintForProjection(item, wall, start, end);
	if (!footprint) return undefined;
	return {
		...(!item.assetDefinitionId
			? {}
			: { assetDefinitionId: item.assetDefinitionId }),
		assetAnchor: "wall",
		assetInstanceId: item.assetInstanceId,
		centerXM: metres(footprint.centerXMm - minimumXmm),
		centerYM: metres(item.elevationMm),
		centerZM: metres(footprint.centerZMm - minimumZmm),
		depthM: metres(item.depthMm),
		heightM: metres(item.heightMm),
		material: {
			colorHex: item.color,
			furnitureKind: furnitureKindFor(item.label),
		},
		widthM: metres(item.widthMm),
		yawRadians: footprint.yawRadians,
	};
}

/**
 * Derives a wall-local item's disposable plan footprint from its semantic
 * address. Both Plan and WebGL projections use this one calculation, so a
 * persisted left/right host never becomes a renderer-only convention.
 */
export function wallItemPlanFootprintForProjection(
	item: WallItemPlanProjectionInput,
	wall: WallSegment,
	start: Vertex,
	end: Vertex,
): WallItemPlanFootprint | undefined {
	const directionXMm = end.xMm - start.xMm;
	const directionZMm = end.zMm - start.zMm;
	const lengthMm = Math.hypot(directionXMm, directionZMm);
	if (!Number.isFinite(lengthMm) || lengthMm <= 0 || item.offsetMm > lengthMm) {
		return undefined;
	}
	const tangentX = directionXMm / lengthMm;
	const tangentZ = directionZMm / lengthMm;
	const leftNormalX = -tangentZ;
	const leftNormalZ = tangentX;
	const sideMultiplier = item.side === "left" ? 1 : -1;
	const sideOffsetMm =
		sideMultiplier * (wall.thicknessMm / 2 + item.depthMm / 2);
	const centerXMm =
		start.xMm + tangentX * item.offsetMm + leftNormalX * sideOffsetMm;
	const centerZMm =
		start.zMm + tangentZ * item.offsetMm + leftNormalZ * sideOffsetMm;
	const halfWidthMm = item.widthMm / 2;
	const halfDepthMm = item.depthMm / 2;
	const corner = (tangentMultiplier: number, normalMultiplier: number) => ({
		xMm:
			centerXMm +
			tangentX * tangentMultiplier * halfWidthMm +
			leftNormalX * normalMultiplier * halfDepthMm,
		zMm:
			centerZMm +
			tangentZ * tangentMultiplier * halfWidthMm +
			leftNormalZ * normalMultiplier * halfDepthMm,
	});
	return {
		centerXMm,
		centerZMm,
		corners: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)],
		yawRadians: yawRadiansForWall(start, end),
	};
}

/**
 * A door/window is not a decorative overlay in 3D: its host wall is split
 * into solid pieces around the durable opening interval. The opening's offset
 * is measured along the canonical start→end direction, so this also works
 * when the source wall was drawn in reverse.
 */
function wallBoxesForProjection(input: {
	readonly body: WallBodyProjection | undefined;
	readonly end: Vertex;
	readonly minimumXmm: number;
	readonly minimumZmm: number;
	readonly openings: readonly WallOpening[];
	readonly projection: DerivedOrthogonalWall;
	readonly start: Vertex;
	readonly wall: WallSegment;
}): readonly SceneBox[] {
	const {
		body,
		end,
		minimumXmm,
		minimumZmm,
		openings,
		projection,
		start,
		wall,
	} = input;
	const lengthMm = Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm);
	if (
		!Number.isFinite(lengthMm) ||
		lengthMm <= 0 ||
		!Number.isSafeInteger(projection.heightMm) ||
		projection.heightMm <= 0
	) {
		return [];
	}
	const solidBox = (
		startMm: number,
		endMm: number,
		sillMm: number,
		heightMm: number,
	): SceneBox | undefined => {
		const segmentLengthMm = endMm - startMm;
		if (segmentLengthMm <= 0 || heightMm <= 0) {
			return undefined;
		}
		const centreOffsetMm = startMm + segmentLengthMm / 2;
		const factor = centreOffsetMm / lengthMm;
		const centerXmm = start.xMm + (end.xMm - start.xMm) * factor;
		const centerZmm = start.zMm + (end.zMm - start.zMm) * factor;
		const horizontal = start.zMm === end.zMm;
		const diagonal = !horizontal && start.xMm !== end.xMm;
		return {
			...(body
				? {
						wallFootprintM: clipWallBodyToInterval(body, startMm, endMm).map(
							(point) => ({
								xM: metres(point.xMm - minimumXmm),
								zM: metres(point.zMm - minimumZmm),
							}),
						),
					}
				: {}),
			centerXM: metres(centerXmm - minimumXmm),
			centerYM: metres(sillMm + heightMm / 2),
			centerZM: metres(centerZmm - minimumZmm),
			depthM: metres(
				diagonal
					? wall.thicknessMm
					: horizontal
						? wall.thicknessMm
						: segmentLengthMm,
			),
			heightM: metres(heightMm),
			wall: projection.exteriorNormal
				? {
						exteriorNormal: projection.exteriorNormal,
						wallSegmentId: wall.wallSegmentId,
					}
				: { wallSegmentId: wall.wallSegmentId },
			widthM: metres(
				diagonal
					? segmentLengthMm
					: horizontal
						? segmentLengthMm
						: wall.thicknessMm,
			),
			...(diagonal ? { yawRadians: yawRadiansForWall(start, end) } : {}),
		};
	};

	const sortedOpenings = openings
		.map((opening) => ({ interval: wallOpeningIntervalMm(opening), opening }))
		.filter(
			({ interval, opening }) =>
				Number.isFinite(interval.startMm) &&
				Number.isFinite(interval.endMm) &&
				interval.startMm >= 0 &&
				interval.endMm <= lengthMm &&
				interval.startMm < interval.endMm &&
				opening.sillMm >= 0 &&
				opening.heightMm > 0 &&
				opening.sillMm + opening.heightMm <= projection.heightMm,
		)
		.sort((first, second) => first.interval.startMm - second.interval.startMm);
	const hasOverlappingOpenings = sortedOpenings.some((candidate, index) => {
		const previous = index > 0 ? sortedOpenings[index - 1] : undefined;
		return (
			previous !== undefined &&
			candidate.interval.startMm < previous.interval.endMm
		);
	});
	if (sortedOpenings.length !== openings.length || hasOverlappingOpenings) {
		const unsplit = solidBox(0, lengthMm, 0, projection.heightMm);
		return unsplit ? [unsplit] : [];
	}

	const boxes: SceneBox[] = [];
	let cursorMm = 0;
	for (const { interval, opening } of sortedOpenings) {
		const before = solidBox(cursorMm, interval.startMm, 0, projection.heightMm);
		if (before) {
			boxes.push(before);
		}
		const below = solidBox(interval.startMm, interval.endMm, 0, opening.sillMm);
		if (below) {
			boxes.push(below);
		}
		const aboveHeightMm =
			projection.heightMm - opening.sillMm - opening.heightMm;
		const above = solidBox(
			interval.startMm,
			interval.endMm,
			opening.sillMm + opening.heightMm,
			aboveHeightMm,
		);
		if (above) {
			boxes.push(above);
		}
		cursorMm = interval.endMm;
	}
	const after = solidBox(cursorMm, lengthMm, 0, projection.heightMm);
	if (after) {
		boxes.push(after);
	}
	return boxes;
}

function floorForTile(
	bounds: AxisAlignedRectMm,
	minimumXmm: number,
	minimumZmm: number,
	roomId: string,
): SceneBox {
	return {
		centerXM: metres((bounds.minXmm + bounds.maxXmm) / 2 - minimumXmm),
		centerYM: 0,
		centerZM: metres((bounds.minZmm + bounds.maxZmm) / 2 - minimumZmm),
		depthM: metres(bounds.maxZmm - bounds.minZmm),
		heightM: metres(FLOOR_THICKNESS_MM),
		floor: { roomId },
		widthM: metres(bounds.maxXmm - bounds.minXmm),
	};
}

function floorPolygonFor(
	vertices: readonly { readonly xMm: number; readonly zMm: number }[],
	minimumXmm: number,
	minimumZmm: number,
	roomId: string,
): SceneFloorPolygon {
	return {
		floor: { roomId },
		heightM: metres(FLOOR_THICKNESS_MM),
		vertices: vertices.map((vertex) => ({
			xM: metres(vertex.xMm - minimumXmm),
			zM: metres(vertex.zMm - minimumZmm),
		})),
	};
}

/** A ground-level doorway has a continuous floor across the wall thickness. */
function doorThresholdFloorFor(
	opening: WallOpening,
	wall: WallSegment,
	start: Vertex,
	end: Vertex,
	minimumXmm: number,
	minimumZmm: number,
): readonly SceneBox[] {
	const interval = wallOpeningIntervalMm(opening);
	const lengthMm = Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm);
	if (
		!Number.isFinite(interval.startMm) ||
		!Number.isFinite(interval.endMm) ||
		interval.startMm < 0 ||
		interval.endMm > lengthMm ||
		interval.startMm >= interval.endMm
	)
		return [];
	const centreOffsetMm = (interval.startMm + interval.endMm) / 2;
	const factor = centreOffsetMm / lengthMm;
	const horizontal = start.zMm === end.zMm;
	const diagonal = !horizontal && start.xMm !== end.xMm;
	const centerXmm = start.xMm + (end.xMm - start.xMm) * factor;
	const centerZmm = start.zMm + (end.zMm - start.zMm) * factor;
	return [
		{
			centerXM: metres(centerXmm - minimumXmm),
			centerYM: 0,
			centerZM: metres(centerZmm - minimumZmm),
			depthM: metres(
				diagonal
					? wall.thicknessMm
					: horizontal
						? wall.thicknessMm
						: interval.endMm - interval.startMm,
			),
			heightM: metres(FLOOR_THICKNESS_MM),
			widthM: metres(
				diagonal
					? interval.endMm - interval.startMm
					: horizontal
						? interval.endMm - interval.startMm
						: wall.thicknessMm,
			),
			...(diagonal ? { yawRadians: yawRadiansForWall(start, end) } : {}),
		},
	];
}

function yawRadiansForWall(start: Vertex, end: Vertex): number {
	const yaw = Math.atan2(start.zMm - end.zMm, end.xMm - start.xMm);
	return yaw < 0 ? yaw + Math.PI * 2 : yaw;
}

function metres(valueMm: number): number {
	return valueMm / MM_PER_SCENE_METRE;
}

function yawRadiansForAsset(asset: object): number | undefined {
	const yawStep = (asset as { readonly yawStep?: unknown }).yawStep;
	if (
		typeof yawStep === "number" &&
		Number.isInteger(yawStep) &&
		yawStep >= 0 &&
		yawStep <= 7
	) {
		const stepYawRadians = (yawStep * Math.PI) / 4;
		return stepYawRadians === 0 ? undefined : stepYawRadians;
	}
	const yawRadians = (asset as { readonly yawRadians?: unknown }).yawRadians;
	if (
		typeof yawRadians !== "number" ||
		!Number.isFinite(yawRadians) ||
		yawRadians < 0 ||
		yawRadians >= Math.PI * 2
	) {
		return undefined;
	}
	const legacyStep = ((Math.round(yawRadians / (Math.PI / 4)) % 8) + 8) % 8;
	const legacyYawRadians = (legacyStep * Math.PI) / 4;
	return legacyYawRadians === 0 ? undefined : legacyYawRadians;
}

function furnitureKindFor(label: string): FurnitureGreyboxKind {
	const normalized = label.toLocaleLowerCase("ru-RU");
	if (/стол|table/.test(normalized)) {
		return "table";
	}
	if (/стул|кресл|chair|armchair/.test(normalized)) {
		return "chair";
	}
	if (/кроват|bed/.test(normalized)) {
		return "bed";
	}
	if (/шкаф|комод|тумб|storage|cabinet|wardrobe|dresser/.test(normalized)) {
		return "storage";
	}
	if (/диван|sofa|couch|seating/.test(normalized)) {
		return "sofa";
	}
	return "generic";
}
