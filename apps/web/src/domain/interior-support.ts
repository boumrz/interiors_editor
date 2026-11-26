import { alphaParametricItemColorVariantFor } from "./item-color-variant";
import {
	physicalFootprintWithinRoom,
	floorItemFootprintCorners,
	footprintsOverlap,
	type FloorItemFootprint,
	yawRadiansFor,
} from "./parametric-item";
import { slidingDoorSweepFor } from "./sliding-door-geometry";
import type {
	CatalogPresetReference,
	FloorSchematicAssetInstance,
	Project,
	SupportedSchematicAssetInstance,
	WallSchematicAssetInstance,
} from "./project";

type Span = readonly [number, number];
interface SurfaceTemplate {
	readonly x: Span;
	readonly z: Span;
	readonly y: Span;
	readonly radiusMm: number;
	readonly roundedOutline?: true;
}

const whole = [0, 1] as const;
export const supportTopTemplates = {
	table: { x: whole, z: whole, y: [0.939, 1], radiusMm: 12 },
	desk: { x: whole, z: whole, y: [0.934, 1], radiusMm: 11 },
	"coffee-table": { x: [0.0065, 0.9935], z: [0.0105, 0.9895], y: [0.898, 1], radiusMm: 0, roundedOutline: true },
	"bedside-table": { x: whole, z: whole, y: [0.94, 1], radiusMm: 9 },
	dresser: { x: whole, z: [0, 0.986], y: [0.944, 1], radiusMm: 9 },
	"tv-stand": { x: whole, z: whole, y: [0.884, 1], radiusMm: 12 },
} as const satisfies Record<string, SurfaceTemplate>;

export const shelfTemplate = {
	x: [0.075, 0.925],
	z: [0.018, 0.982],
	radiusMm: 7,
	levels: [[0.085, 0.123], [0.294, 0.332], [0.503, 0.541], [0.712, 0.75], [0.962, 1]],
} as const;

const guestBaseRatio = {
	planter: 0.61,
	"table-lamp": 0.96,
	book: 1,
	vase: 0.64,
} as const;

// Older catalog items stored these exact labels as their only built-in identity.
const legacyPresetByLabel = new Map<string, string>([
	["Стол", "table"],
	["Письменный стол", "desk"],
	["Журнальный столик", "coffee-table"],
	["Тумбочка", "bedside-table"],
	["Комод", "dresser"],
	["Тумба под телевизор", "tv-stand"],
	["Стеллаж", "open-shelf"],
	["Кашпо", "planter"],
	["Настольная лампа", "table-lamp"],
	["Книга", "book"],
	["Ваза", "vase"],
]);

function floorPresetFor(item: FloorSchematicAssetInstance): CatalogPresetReference | undefined {
	if (item.assetDefinitionId !== undefined) return undefined;
	if (item.catalogPreset !== undefined) return item.catalogPreset.version === 1 ? item.catalogPreset : undefined;
	const presetId = legacyPresetByLabel.get(item.label);
	return presetId === undefined ? undefined : { presetId, version: 1 };
}

export function isSupportedDecorPreset(id: string): id is keyof typeof guestBaseRatio {
	return Object.hasOwn(guestBaseRatio, id);
}

function isTopPreset(id: string): id is keyof typeof supportTopTemplates {
	return Object.hasOwn(supportTopTemplates, id);
}

export function floorDecorPresetFor(item: FloorSchematicAssetInstance): CatalogPresetReference | undefined {
	const preset = floorPresetFor(item);
	return preset && isSupportedDecorPreset(preset.presetId) ? preset : undefined;
}

export function supportHostPresetFor(host: FloorSchematicAssetInstance): CatalogPresetReference | undefined {
	const preset = floorPresetFor(host);
	return preset && (isTopPreset(preset.presetId) || preset.presetId === "open-shelf") ? preset : undefined;
}

export function supportsCatalogSurface(presetId: string, surfaceKey: string): boolean {
	return (isTopPreset(presetId) && surfaceKey === "top")
		|| (presetId === "open-shelf" && /^shelf-[1-5]$/.test(surfaceKey));
}

/** Scaling the plate and the contact uses the same integer Y planes. */
export function supportPlateY(y: Span, heightMm: number): Span {
	return [Math.round(heightMm * y[0]), Math.round(heightMm * y[1])];
}

export interface SupportSurface {
	readonly key: string;
	readonly heightMm: number;
	readonly ceilingMm?: number;
	readonly minXMm: number;
	readonly maxXMm: number;
	readonly minZMm: number;
	readonly maxZMm: number;
	readonly radiusXMm: number;
	readonly radiusZMm: number;
}

export function supportSurfacesFor(host: FloorSchematicAssetInstance): readonly SupportSurface[] {
	const preset = supportHostPresetFor(host);
	if (!preset) return [];
	const id = preset.presetId;
	const surface = (key: string, template: SurfaceTemplate, ceiling?: number): SupportSurface => {
		const [bottom, heightMm] = supportPlateY(template.y, host.heightMm);
		const width = host.widthMm * (template.x[1] - template.x[0]);
		const depth = host.depthMm * (template.z[1] - template.z[0]);
		const radius = Math.min(template.radiusMm, Math.min(width, depth, heightMm - bottom) * 0.45);
		const borderInset = template.roundedOutline ? 0 : radius;
		return {
			key, heightMm,
			...(ceiling === undefined ? {} : { ceilingMm: ceiling }),
			minXMm: host.widthMm * (template.x[0] - 0.5) + borderInset,
			maxXMm: host.widthMm * (template.x[1] - 0.5) - borderInset,
			minZMm: host.depthMm * (template.z[0] - 0.5) + borderInset,
			maxZMm: host.depthMm * (template.z[1] - 0.5) - borderInset,
			radiusXMm: template.roundedOutline ? width * 0.12 : 0,
			radiusZMm: template.roundedOutline ? depth * 0.12 : 0,
		};
	};
	if (isTopPreset(id)) return [surface("top", supportTopTemplates[id])];
	if (id !== "open-shelf") return [];
	return shelfTemplate.levels.map((y, index) => {
		const higher = shelfTemplate.levels[index + 1];
		return surface(`shelf-${index + 1}`, { ...shelfTemplate, y }, higher && supportPlateY(higher, host.heightMm)[0]);
	});
}

export interface SupportedPlacement extends FloorItemFootprint {
	readonly item: SupportedSchematicAssetInstance;
	readonly host: FloorSchematicAssetInstance;
	readonly roomId: string;
	readonly roomLayoutId?: string;
	readonly yawMilliDeg: number;
	readonly bottomMm: number;
	readonly topMm: number;
}

export interface SupportAddress {
	readonly supportAssetInstanceId: string;
	readonly supportSurfaceKey: string;
	readonly offsetXMm: number;
	readonly offsetZMm: number;
	readonly relativeYawMilliDeg: number;
}

function supportedPose(
	item: SupportedSchematicAssetInstance,
	host: FloorSchematicAssetInstance,
	surface: SupportSurface,
): SupportedPlacement {
	const yaw = yawRadiansFor(host);
	const cosine = Math.cos(yaw);
	const sine = Math.sin(yaw);
	return {
		item, host, roomId: host.roomId,
		...(host.roomLayoutId === undefined ? {} : { roomLayoutId: host.roomLayoutId }),
		xMm: host.xMm + cosine * item.offsetXMm + sine * item.offsetZMm,
		zMm: host.zMm - sine * item.offsetXMm + cosine * item.offsetZMm,
		yawMilliDeg: ((Math.round(yaw * 180_000 / Math.PI) + item.relativeYawMilliDeg) % 360_000 + 360_000) % 360_000,
		widthMm: item.widthMm, depthMm: item.depthMm,
		bottomMm: surface.heightMm, topMm: surface.heightMm + item.heightMm,
	};
}

function floorHosts(project: Project): ReadonlyMap<string, FloorSchematicAssetInstance> {
	return new Map(project.assetInstances.flatMap((item) => item.anchorClass === "floor" ? [[item.assetInstanceId, item] as const] : []));
}

export function resolveSupportedPlacements(project: Project): readonly SupportedPlacement[] {
	const hosts = floorHosts(project);
	return (project.supportedItems ?? []).flatMap((item) => {
		const host = hosts.get(item.supportAssetInstanceId);
		if (host?.catalogPreset?.version !== 1) return [];
		const surface = supportSurfacesFor(host).find(candidate => candidate.key === item.supportSurfaceKey);
		return surface ? [supportedPose(item, host, surface)] : [];
	});
}

const epsilon = 1e-7;

export function supportedDecorBasePoints(id: string, baseFootprint: FloorItemFootprint): readonly { readonly xMm: number; readonly zMm: number }[] {
	if (!isSupportedDecorPreset(id)) return [];
	const ratio = guestBaseRatio[id];
	const base = { ...baseFootprint, widthMm: baseFootprint.widthMm * ratio, depthMm: baseFootprint.depthMm * ratio };
	const angle = yawRadiansFor(base);
	return id === "book" ? floorItemFootprintCorners(base) : Array.from({ length: 20 }, (_, index) => {
		const theta = index * Math.PI / 10;
		const x = Math.cos(theta) * base.widthMm / 2;
		const z = Math.sin(theta) * base.depthMm / 2;
		return {
			xMm: base.xMm + Math.cos(angle) * x + Math.sin(angle) * z,
			zMm: base.zMm - Math.sin(angle) * x + Math.cos(angle) * z,
		};
	});
}

function containedBase(item: SupportedSchematicAssetInstance, surface: SupportSurface): boolean {
	const points = supportedDecorBasePoints(item.catalogPreset.presetId, {
		xMm: item.offsetXMm, zMm: item.offsetZMm, widthMm: item.widthMm, depthMm: item.depthMm, yawMilliDeg: item.relativeYawMilliDeg,
	});
	return points.length > 0 && points.every(({ xMm, zMm }) => {
		if (xMm < surface.minXMm - epsilon || xMm > surface.maxXMm + epsilon
			|| zMm < surface.minZMm - epsilon || zMm > surface.maxZMm + epsilon) return false;
		if (surface.radiusXMm === 0 || surface.radiusZMm === 0) return true;
		const x = Math.max(surface.minXMm + surface.radiusXMm - xMm, xMm - surface.maxXMm + surface.radiusXMm, 0) / surface.radiusXMm;
		const z = Math.max(surface.minZMm + surface.radiusZMm - zMm, zMm - surface.maxZMm + surface.radiusZMm, 0) / surface.radiusZMm;
		return x * x + z * z <= 1 + epsilon;
	});
}

interface Volume extends FloorItemFootprint {
	readonly bottomMm: number;
	readonly topMm: number;
}

function volumesOverlap(first: Volume, second: Volume): boolean {
	return first.topMm > second.bottomMm + epsilon && second.topMm > first.bottomMm + epsilon && footprintsOverlap(first, second);
}

function wallObjectVolume(project: Project, item: WallSchematicAssetInstance): Volume | undefined {
	const wall = project.level.wallSegments.find((segment) => segment.wallSegmentId === item.wallSegmentId);
	const start = wall && project.level.vertices.find((vertex) => vertex.vertexId === wall.startVertexId);
	const end = wall && project.level.vertices.find((vertex) => vertex.vertexId === wall.endVertexId);
	if (!wall || !start || !end) return undefined;
	const dx = end.xMm - start.xMm;
	const dz = end.zMm - start.zMm;
	const length = Math.hypot(dx, dz);
	if (length === 0) return undefined;
	const normal = (wall.thicknessMm + item.depthMm) / 2 * (item.side === "left" ? 1 : -1);
	return {
		continuousYaw: true,
		yawRadians: -Math.atan2(dz, dx),
		xMm: start.xMm + (dx * item.offsetMm - dz * normal) / length,
		zMm: start.zMm + (dz * item.offsetMm + dx * normal) / length,
		widthMm: item.widthMm, depthMm: item.depthMm,
		bottomMm: item.elevationMm - item.heightMm / 2,
		topMm: item.elevationMm + item.heightMm / 2,
	};
}

export function supportedItemConflict(project: Project): string | undefined {
	const guests = project.supportedItems ?? [];
	if (guests.length === 0) return undefined;
	const knownIds = new Set(project.assetInstances.map((item) => item.assetInstanceId));
	const placements = resolveSupportedPlacements(project);
	if (placements.length !== guests.length) return guests.find(guest => !placements.some(value => value.item === guest))?.assetInstanceId ?? "";
	const walls = project.assetInstances.flatMap((item) => {
		const body = item.anchorClass === "wall" && wallObjectVolume(project, item);
		return body ? [body] : [];
	});
	const slides = project.level.openings.flatMap((opening) => {
		if (opening.kind !== "Door" || opening.variant !== "sliding") return [];
		const wall = project.level.wallSegments.find((item) => item.wallSegmentId === opening.wallSegmentId);
		const start = wall && project.level.vertices.find(item => item.vertexId === wall.startVertexId);
		const end = wall && project.level.vertices.find(item => item.vertexId === wall.endVertexId);
		const sweep = wall && start && end && slidingDoorSweepFor(opening, wall, start, end);
		return sweep ? [{ ...sweep.footprint, bottomMm: sweep.bottomMm, topMm: sweep.topMm }] : [];
	});
	for (const [index, guest] of placements.entries()) {
		const { item, host } = guest;
		const room = project.level.rooms.find((candidate) => candidate.roomId === host.roomId);
		const surface = supportSurfacesFor(host).find((candidate) => candidate.key === item.supportSurfaceKey);
		if (knownIds.has(item.assetInstanceId) || item.assetInstanceId.trim() === "" || item.label.trim() === ""
			|| item.catalogPreset.version !== 1 || item.anchorClass !== "support"
			|| !/^#[0-9a-fA-F]{6}$/.test(item.color)
			|| (item.colorVariantId !== undefined && alphaParametricItemColorVariantFor(item.colorVariantId)?.color !== item.color)
			|| ![item.widthMm, item.depthMm, item.heightMm, item.offsetXMm, item.offsetZMm, item.relativeYawMilliDeg].every(Number.isSafeInteger)
			|| Math.min(item.widthMm, item.depthMm, item.heightMm) < 1
			|| item.relativeYawMilliDeg < 0 || item.relativeYawMilliDeg >= 360_000
			|| !surface || !room || !containedBase(item, surface)
			|| guest.topMm > Math.min(room.heightMm, surface.ceilingMm ?? Infinity)
			|| !physicalFootprintWithinRoom(project, host.roomId, guest)
			|| project.assetInstances.some(other => other.anchorClass === "floor" && other.assetInstanceId !== host.assetInstanceId
				&& other.roomId === host.roomId && other.roomLayoutId === host.roomLayoutId
				&& volumesOverlap(guest, { ...other, bottomMm: 0, topMm: other.heightMm }))
			|| walls.some(wall => volumesOverlap(guest, wall))
			|| slides.some(door => volumesOverlap(guest, door))
			|| placements.slice(0, index).some(other => other.roomId === host.roomId && other.roomLayoutId === host.roomLayoutId
				&& volumesOverlap(guest, other))
		) return item.assetInstanceId;
		knownIds.add(item.assetInstanceId);
	}
	return undefined;
}

export function validateSupportedItems(project: Project): boolean {
	return supportedItemConflict(project) === undefined;
}

export function floorItemSupportConflict(
	candidate: Project,
	previous?: Project,
	editedHostId?: string,
): { readonly kind: "rejected"; readonly reasonCode: "ITEM_COLLISION" | "ITEM_LOCKED"; readonly conflictAssetInstanceId: string } | undefined {
	const lockedGuest = previous?.supportedItems?.find(
		item => item.supportAssetInstanceId === editedHostId && item.locked,
	);
	if (lockedGuest) return { kind: "rejected", reasonCode: "ITEM_LOCKED", conflictAssetInstanceId: lockedGuest.assetInstanceId };
	const conflictAssetInstanceId = supportedItemConflict(candidate);
	return conflictAssetInstanceId === undefined ? undefined
		: { kind: "rejected", reasonCode: "ITEM_COLLISION", conflictAssetInstanceId };
}
