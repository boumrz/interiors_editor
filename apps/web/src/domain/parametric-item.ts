import type { AddWallSegmentInput } from "./add-wall-segment";
import { resolveOrthogonalPlanFaces } from "./derived-orthogonal-plan-faces";
import { doorOpeningOrientation } from "./door-opening-orientation";
import {
	alphaParametricItemColorVariantFor,
	type ItemColorVariantId,
} from "./item-color-variant";
import type { WallOpening } from "./project";
import {
	type FloorSchematicAssetInstance,
	isFloorSchematicAssetInstance,
	type Project,
	type RotationStep,
	type SchematicAssetInstance,
} from "./project";
import { rectangularRoomLoopBoundsForRoom } from "./rectangular-room-loop";
import { slidingDoorSweepFor } from "./sliding-door-geometry";
import { wallOpeningIntervalMm } from "./wall-opening";

interface FloorItemCollisionIdentity {
	readonly assetDefinitionId?: string;
	readonly catalogPreset?: FloorSchematicAssetInstance["catalogPreset"];
	readonly label?: string;
	/** Model preview before its resource is registered in the Project. */
	readonly modelBacked?: true;
}

export interface ParametricFloorItemInput extends FloorItemCollisionIdentity {
	readonly colorVariantId?: string;
	readonly yawStep?: RotationStep;
	readonly yawMilliDeg?: number;
	readonly roomId: string;
	readonly roomLayoutId?: string;
	readonly label: string;
	readonly xMm: number;
	readonly zMm: number;
	readonly widthMm: number;
	readonly depthMm: number;
	readonly heightMm: number;
	readonly color: string;
}

interface IdSource {
	next(): string;
}

interface HostBounds {
	readonly minXmm: number;
	readonly maxXmm: number;
	readonly minZmm: number;
	readonly maxZmm: number;
}

interface HostPolygon {
	readonly polygonMm: readonly PlanPoint[];
}

type UsableRoomHost = HostBounds | HostPolygon;

export interface FloorItemFootprint {
	/**
	 * Internal-only geometry helper for a transient wall body. Durable item
	 * footprints never enable this flag.
	 */
	readonly continuousYaw?: true;
	readonly xMm: number;
	readonly zMm: number;
	readonly widthMm: number;
	readonly depthMm: number;
	readonly heightMm?: number;
	readonly roomLayoutId?: string;
	/** Undefined is the backwards-compatible durable spelling of yaw step 0. */
	readonly yawStep?: RotationStep;
	readonly yawMilliDeg?: number;
	readonly yawRadians?: number;
}

type FloorCollisionFootprint = FloorItemFootprint & FloorItemCollisionIdentity;

export interface MoveParametricFloorItemInput {
	readonly assetInstanceId: string;
	readonly roomLayoutId?: string;
	readonly xMm: number;
	readonly zMm: number;
}

export interface ResizeParametricFloorItemInput {
	readonly assetInstanceId: string;
	readonly depthMm: number;
	readonly heightMm: number;
	readonly widthMm: number;
}

/**
 * The alpha catalogue is procedural and local-only.  It nevertheless exposes
 * a finite, declared set of durable presentation variants: arbitrary CSS
 * strings must not silently become part of a project resource graph.
 */
export { alphaParametricItemColors } from "./item-color-variant";

export interface RecolorParametricFloorItemInput {
	readonly assetInstanceId: string;
	readonly variantId: ItemColorVariantId;
}

export type RecolorParametricFloorItemResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "ITEM_COLOR_NOT_SUPPORTED"
				| "ITEM_COLOR_UNSUPPORTED"
				| "ITEM_NOT_FOUND"
				| "ITEM_LOCKED";
	  };

export interface RotateParametricFloorItemInput {
	readonly assetInstanceId: string;
	/** One signed 45-degree right-handed step. */
	readonly deltaSteps: -1 | 1;
}

export interface SetParametricFloorItemYawInput {
	readonly assetInstanceId: string;
	/** A continuous right-handed angle in the half-open interval [0, 2π). */
	readonly yawRadians: number;
	readonly exact?: boolean;
}

export interface DeleteParametricFloorItemInput {
	readonly assetInstanceId: string;
}

export interface SetParametricFloorItemLockInput {
	readonly assetInstanceId: string;
	readonly locked: boolean;
}

export type SetParametricFloorItemLockResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode: "ITEM_NOT_FOUND" | "ITEM_LOCK_STATE_UNCHANGED";
	  };

export type CreateParametricFloorItemResult =
	| {
			readonly kind: "accepted";
			readonly project: Project;
			/** Retained geometry that the UI must continue to diagnose after an explicit warning confirmation. */
			readonly warnings?: readonly ParametricFloorItemPlacementWarning[];
	  }
	| {
			readonly kind: "rejected";
			readonly conflictAssetInstanceId?: string;
			readonly reasonCode:
				| "INVALID_DIMENSION"
				| "OUTSIDE_ROOM_HOST"
				| "ITEM_COLLISION"
				| "WALL_ITEM_COLLISION"
				| "DOOR_CLEARANCE_COLLISION"
				| "FIXED_ASSET_DIMENSIONS"
				| "ITEM_LOCKED";
	  };

/**
 * Pure placement preflight used by the editor's ghost item.  It shares the
 * exact durable geometry guards but intentionally neither allocates an ID nor
 * changes a Project revision.
 */
/** Semantic retained geometry the UI may mark during a placement preview. */
export type ParametricFloorItemCollisionTarget =
	| { readonly kind: "item"; readonly assetInstanceId: string }
	| { readonly kind: "wall"; readonly wallSegmentId: string }
	| { readonly kind: "door-clearance"; readonly openingId: string };

export type ParametricFloorItemPlacementWarning = Exclude<
	ParametricFloorItemCollisionTarget,
	{ readonly kind: "wall" }
>;

export type FloorItemCollisionPolicy = "warn" | "reject";

/**
 * An invalid preflight blocks the command. Warnings describe collisions the
 * active policy permits, such as door clearance.
 */
export type ParametricFloorItemPlacementAssessment =
	| { readonly kind: "valid" }
	| {
			readonly kind: "warning";
			readonly warnings: readonly ParametricFloorItemPlacementWarning[];
	  }
	| {
			readonly kind: "invalid";
			readonly reasonCode: Extract<
				CreateParametricFloorItemResult,
				{ readonly kind: "rejected" }
			>["reasonCode"];
	  };

export function assessParametricFloorItemPlacement(
	project: Project,
	input: ParametricFloorItemInput,
	excludedAssetInstanceId?: string,
	collisionPolicy: FloorItemCollisionPolicy = "warn",
): ParametricFloorItemPlacementAssessment {
	if (!hasValidInput(project, input)) {
		return { kind: "invalid", reasonCode: "INVALID_DIMENSION" };
	}
	const host = usableBoundsForRoom(project, input.roomId);
	if (!host || !isWithinUsableRoomHost(input, host)) {
		return { kind: "invalid", reasonCode: "OUTSIDE_ROOM_HOST" };
	}
	return assessFloorItemCollisions(
		project,
		input,
		excludedAssetInstanceId,
		collisionPolicy,
	);
}

/**
 * Exposes the first collision tier used by the placement policy without
 * allocating an item or mutating the Project. The preview can therefore make
 * the already-durable object visually identifiable without duplicating domain
 * geometry checks in the renderer.
 */
export function findParametricFloorItemCollisionTargets(
	project: Project,
	footprint: FloorCollisionFootprint,
	excludedAssetInstanceId?: string,
): readonly ParametricFloorItemCollisionTarget[] {
	if (!isValidFootprint(footprint)) return [];
	const items = floorItemCollisionItems(
		project,
		footprint,
		excludedAssetInstanceId,
	);
	const walls = floorItemCollisionWalls(project, footprint);
	const doors = floorItemDoorSwingCollisions(project, footprint);
	return [
		...items.map((item) => ({
			assetInstanceId: item.assetInstanceId,
			kind: "item" as const,
		})),
		...walls.map((wall) => ({
			kind: "wall" as const,
			wallSegmentId: wall.wallSegmentId,
		})),
		...doors.map((opening) => ({
			kind: "door-clearance" as const,
			openingId: opening.openingId,
		})),
	];
}

export type DeleteParametricFloorItemResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode: "ITEM_NOT_FOUND" | "ITEM_LOCKED";
	  };

export function createParametricFloorItem(
	project: Project,
	input: ParametricFloorItemInput,
	ids: IdSource,
	updatedAt: string,
	collisionPolicy: FloorItemCollisionPolicy = "warn",
): CreateParametricFloorItemResult {
	const placement = assessParametricFloorItemPlacement(project, input, undefined, collisionPolicy);
	if (placement.kind === "invalid") {
		return { kind: "rejected", reasonCode: placement.reasonCode };
	}
	const variant = input.colorVariantId === undefined
		? undefined
		: alphaParametricItemColorVariantFor(input.colorVariantId);
	const item: SchematicAssetInstance = {
		anchorClass: "floor",
		assetInstanceId: ids.next(),
		...(input.catalogPreset === undefined ? {} : { catalogPreset: input.catalogPreset }),
		...(input.assetDefinitionId === undefined
			? {}
			: { assetDefinitionId: input.assetDefinitionId }),
		color: input.color,
		...(variant === undefined ? {} : { colorVariantId: variant.variantId }),
		depthMm: input.depthMm,
		elevationMm: 0,
		heightMm: input.heightMm,
		label: input.label,
		roomId: input.roomId,
		...(input.roomLayoutId === undefined ? {} : { roomLayoutId: input.roomLayoutId }),
		widthMm: input.widthMm,
		xMm: input.xMm,
		...canonicalFloorYawFields(input),
		zMm: input.zMm,
	};
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: [...project.assetInstances, item],
			updatedAt,
		},
		...(placement.kind === "warning" ? { warnings: placement.warnings } : {}),
	};
}

/** Returns a host only when the complete footprint fits its usable room polygon. */
export function findRoomForFloorItem(
	project: Project,
	footprint: FloorItemFootprint,
): string | undefined {
	if (!isValidFootprint(footprint)) {
		return undefined;
	}
	return project.level.rooms.find((room) => {
		const host = usableBoundsForRoom(project, room.roomId);
		return host ? isWithinUsableRoomHost(footprint, host) : false;
	})?.roomId;
}

/** Derived supported positions may be fractional after rotating their local address. */
export function physicalFootprintWithinRoom(project: Project, roomId: string, footprint: FloorItemFootprint): boolean {
	if (![footprint.xMm, footprint.zMm, footprint.widthMm, footprint.depthMm].every(Number.isFinite) ||
		footprint.widthMm <= 0 || footprint.depthMm <= 0 || !hasValidFloorYaw(footprint)) return false;
	const host = usableBoundsForRoom(project, roomId);
	return host !== undefined && isWithinUsableRoomHost(footprint, host);
}

export function moveParametricFloorItem(
	project: Project,
	input: MoveParametricFloorItemInput,
	updatedAt: string,
	collisionPolicy: FloorItemCollisionPolicy = "warn",
): CreateParametricFloorItemResult {
	const item = project.assetInstances.find(
		(candidate) => candidate.assetInstanceId === input.assetInstanceId,
	);
	if (
		!item ||
		!isFloorSchematicAssetInstance(item) ||
		!isValidFootprint({
			depthMm: item.depthMm,
			widthMm: item.widthMm,
			xMm: input.xMm,
			yawRadians: item.yawRadians,
			yawStep: item.yawStep,
			yawMilliDeg: item.yawMilliDeg,
			zMm: input.zMm,
		})
	) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	if (item.locked) return { kind: "rejected", reasonCode: "ITEM_LOCKED" };
	const roomId = findRoomForFloorItem(project, {
		depthMm: item.depthMm,
		widthMm: item.widthMm,
		xMm: input.xMm,
		...canonicalFloorYawFields(item),
		zMm: input.zMm,
	});
	if (!roomId) {
		return { kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" };
	}
	const { roomLayoutId: formerLayoutId, ...base } = withoutLegacyYawRadians(item);
	const chosenLayoutId = input.roomLayoutId ?? (roomId === item.roomId ? formerLayoutId : undefined);
	if (!isLayoutForRoom(project, roomId, chosenLayoutId)) {
		return { kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" };
	}
	const moved = {
		...base,
		...(chosenLayoutId === undefined ? {} : { roomLayoutId: chosenLayoutId }),
		roomId,
		xMm: input.xMm,
		...canonicalFloorYawFields(item),
		zMm: input.zMm,
	};
	const placement = assessFloorItemCollisions(
		project,
		moved,
		item.assetInstanceId,
		collisionPolicy,
	);
	if (placement.kind === "invalid") {
		return { kind: "rejected", reasonCode: placement.reasonCode };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.map((candidate) =>
				candidate.assetInstanceId === item.assetInstanceId &&
				isFloorSchematicAssetInstance(candidate)
					? { ...moved, roomId }
					: candidate,
			),
			updatedAt,
		},
		...(placement.kind === "warning" ? { warnings: placement.warnings } : {}),
	};
}

/**
 * Commits the supplied pose after checking its rotated footprint and room host.
 */
export function setParametricFloorItemYaw(
	project: Project,
	input: SetParametricFloorItemYawInput,
	updatedAt: string,
	collisionPolicy: FloorItemCollisionPolicy = "warn",
): CreateParametricFloorItemResult {
	const item = project.assetInstances.find(
		(candidate) => candidate.assetInstanceId === input.assetInstanceId,
	);
	if (
		!item ||
		!isFloorSchematicAssetInstance(item) ||
		!isValidYawRadians(input.yawRadians) ||
		!isValidOptionalRotationStep(item.yawStep)
	) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	if (item.locked) return { kind: "rejected", reasonCode: "ITEM_LOCKED" };
	const rotated = {
		...withoutLegacyYawRadians(item),
		...floorYawFieldsForRadians(input.yawRadians, input.exact || item.yawMilliDeg !== undefined),
	};
	const roomId = findRoomForFloorItem(project, rotated);
	if (!roomId) {
		return { kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" };
	}
	const placement = assessFloorItemCollisions(
		project,
		rotated,
		item.assetInstanceId,
		collisionPolicy,
	);
	if (placement.kind === "invalid") {
		return { kind: "rejected", reasonCode: placement.reasonCode };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.map((candidate) =>
				candidate.assetInstanceId === item.assetInstanceId &&
				isFloorSchematicAssetInstance(candidate)
					? { ...rotated, roomId }
					: candidate,
			),
			updatedAt,
		},
		...(placement.kind === "warning" ? { warnings: placement.warnings } : {}),
	};
}

/** Changes only the declared parametric dimensions and preserves a valid room host. */
export function resizeParametricFloorItem(
	project: Project,
	input: ResizeParametricFloorItemInput,
	updatedAt: string,
	collisionPolicy: FloorItemCollisionPolicy = "warn",
): CreateParametricFloorItemResult {
	const item = project.assetInstances.find(
		(candidate) => candidate.assetInstanceId === input.assetInstanceId,
	);
	if (
		!item ||
		!isFloorSchematicAssetInstance(item) ||
		![input.widthMm, input.depthMm, input.heightMm].every(
			Number.isSafeInteger,
		) ||
		input.widthMm <= 0 ||
		input.depthMm <= 0 ||
		input.heightMm <= 0
	) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	if (item.locked) return { kind: "rejected", reasonCode: "ITEM_LOCKED" };
	if (item.assetDefinitionId !== undefined) {
		return { kind: "rejected", reasonCode: "FIXED_ASSET_DIMENSIONS" };
	}
	const resized = {
		...withoutLegacyYawRadians(item),
		depthMm: input.depthMm,
		heightMm: input.heightMm,
		widthMm: input.widthMm,
		...canonicalFloorYawFields(item),
	};
	const roomId = findRoomForFloorItem(project, resized);
	if (!roomId) {
		return { kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" };
	}
	const placement = assessFloorItemCollisions(
		project,
		resized,
		item.assetInstanceId,
		collisionPolicy,
	);
	if (placement.kind === "invalid") {
		return { kind: "rejected", reasonCode: placement.reasonCode };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.map((candidate) =>
				candidate.assetInstanceId === item.assetInstanceId &&
				isFloorSchematicAssetInstance(candidate)
					? { ...resized, roomId }
					: candidate,
			),
			updatedAt,
		},
		...(placement.kind === "warning" ? { warnings: placement.warnings } : {}),
	};
}

/**
 * Replaces only a declared local presentation variant. Geometry and the
 * stable host address are deliberately untouched, so no collision preflight
 * is required for a color-only change.
 */
export function recolorParametricFloorItem(
	project: Project,
	input: RecolorParametricFloorItemInput,
	updatedAt: string,
): RecolorParametricFloorItemResult {
	const item = project.assetInstances.find(
		(candidate) => candidate.assetInstanceId === input.assetInstanceId,
	);
	if (!item || !isFloorSchematicAssetInstance(item))
		return { kind: "rejected", reasonCode: "ITEM_NOT_FOUND" };
	if (item.locked) return { kind: "rejected", reasonCode: "ITEM_LOCKED" };
	if (
		item.assetDefinitionId !== undefined &&
		project.assetDefinitionRefs.some(
			(definition) => definition.assetDefinitionId === item.assetDefinitionId,
		)
	) {
		return { kind: "rejected", reasonCode: "ITEM_COLOR_NOT_SUPPORTED" };
	}
	const variant = alphaParametricItemColorVariantFor(input.variantId);
	if (!variant) {
		return { kind: "rejected", reasonCode: "ITEM_COLOR_UNSUPPORTED" };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.map((candidate) =>
				candidate.assetInstanceId === item.assetInstanceId &&
				isFloorSchematicAssetInstance(candidate)
					? {
							...withoutLegacyYawRadians(candidate),
							color: variant.color,
							colorVariantId: variant.variantId,
							...canonicalFloorYawFields(candidate),
						}
					: candidate,
			),
			updatedAt,
		},
	};
}

/**
 * Turns one floor item by exactly 45 degrees while preserving its anchor
 * point, room host and collision guarantees. `yawStep` is normalized modulo
 * eight so an old project with no field naturally starts at zero.
 */
export function rotateParametricFloorItem(
	project: Project,
	input: RotateParametricFloorItemInput,
	updatedAt: string,
	collisionPolicy: FloorItemCollisionPolicy = "warn",
): CreateParametricFloorItemResult {
	const item = project.assetInstances.find(
		(candidate) => candidate.assetInstanceId === input.assetInstanceId,
	);
	if (
		!item ||
		!isFloorSchematicAssetInstance(item) ||
		(input.deltaSteps !== -1 && input.deltaSteps !== 1) ||
		!isValidOptionalRotationStep(item.yawStep)
	) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	if (item.locked) return { kind: "rejected", reasonCode: "ITEM_LOCKED" };
	const yaw = floorYawFieldsForRadians(
		yawRadiansFor(item) + input.deltaSteps * Math.PI / 4,
		item.yawMilliDeg !== undefined,
	);
	const rotated = { ...withoutLegacyYawRadians(item), ...yaw };
	const roomId = findRoomForFloorItem(project, rotated);
	if (!roomId) {
		return { kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" };
	}
	const placement = assessFloorItemCollisions(
		project,
		rotated,
		item.assetInstanceId,
		collisionPolicy,
	);
	if (placement.kind === "invalid") {
		return { kind: "rejected", reasonCode: placement.reasonCode };
	}
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.map((candidate) =>
				candidate.assetInstanceId === item.assetInstanceId
					? { ...rotated, roomId }
					: candidate,
			),
			updatedAt,
		},
		...(placement.kind === "warning" ? { warnings: placement.warnings } : {}),
	};
}

/** Removes one stable asset instance without changing any other placed item. */
export function deleteParametricFloorItem(
	project: Project,
	input: DeleteParametricFloorItemInput,
	updatedAt: string,
): DeleteParametricFloorItemResult {
	const item = project.assetInstances.find(
		(candidate) =>
			candidate.assetInstanceId === input.assetInstanceId &&
			isFloorSchematicAssetInstance(candidate),
	);
	if (!item) {
		return { kind: "rejected", reasonCode: "ITEM_NOT_FOUND" };
	}
	if (item.locked) return { kind: "rejected", reasonCode: "ITEM_LOCKED" };
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.filter(
				(item) =>
					item.assetInstanceId !== input.assetInstanceId ||
					!isFloorSchematicAssetInstance(item),
			),
			updatedAt,
		},
	};
}

/**
 * Persists only the explicit accidental-edit guard. A missing marker remains
 * the backward-compatible unlocked state, so unlocking does not rewrite the
 * floor address, dimensions or presentation values.
 */
export function setParametricFloorItemLock(
	project: Project,
	input: SetParametricFloorItemLockInput,
	updatedAt: string,
): SetParametricFloorItemLockResult {
	const target = project.assetInstances.find(
		(item): item is FloorSchematicAssetInstance =>
			isFloorSchematicAssetInstance(item) &&
			item.assetInstanceId === input.assetInstanceId,
	);
	if (!target) return { kind: "rejected", reasonCode: "ITEM_NOT_FOUND" };
	if ((target.locked === true) === input.locked) {
		return { kind: "rejected", reasonCode: "ITEM_LOCK_STATE_UNCHANGED" };
	}
	const canonicalTarget = {
		...withoutLegacyYawRadians(target),
		...canonicalFloorYawFields(target),
	};
	const updated = input.locked
		? { ...canonicalTarget, locked: true as const }
		: withoutFloorItemLock(canonicalTarget);
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.map((item) =>
				item.assetInstanceId === target.assetInstanceId ? updated : item,
			),
			updatedAt,
		},
	};
}

function withoutFloorItemLock(
	item: FloorSchematicAssetInstance,
): FloorSchematicAssetInstance {
	const { locked: _locked, ...unlocked } = item;
	return unlocked;
}

function hasValidInput(
	project: Project,
	input: ParametricFloorItemInput,
): boolean {
	const numberValues = [
		input.xMm,
		input.zMm,
		input.widthMm,
		input.depthMm,
		input.heightMm,
	];
	if (
		numberValues.some((value) => !Number.isSafeInteger(value)) ||
		input.widthMm <= 0 ||
		input.depthMm <= 0 ||
		input.heightMm <= 0 ||
		!hasValidFloorYaw(input) ||
		!project.level.rooms.some((room) => room.roomId === input.roomId) ||
		!isLayoutForRoom(project, input.roomId, input.roomLayoutId) ||
		(input.assetDefinitionId !== undefined && input.catalogPreset !== undefined) ||
		(input.assetDefinitionId !== undefined &&
			!project.assetDefinitionRefs.some(
				(asset) => asset.assetDefinitionId === input.assetDefinitionId,
			)) ||
		input.label.trim().length === 0 ||
		!/^#[0-9a-fA-F]{6}$/.test(input.color) ||
		(input.colorVariantId !== undefined &&
			alphaParametricItemColorVariantFor(input.colorVariantId)?.color !== input.color)
	) {
		return false;
	}
	return true;
}

function isLayoutForRoom(project: Project, roomId: string, layoutId: string | undefined): boolean {
	const layouts = (project.roomLayouts ?? []).filter((layout) => layout.roomId === roomId);
	return layoutId === undefined ? layouts.length === 0 : layouts.some((layout) => layout.layoutId === layoutId);
}

function isWithinHostBounds(
	input: FloorItemFootprint,
	hostBounds: HostBounds,
): boolean {
	return floorItemFootprintCorners(input).every(
		(corner) =>
			corner.xMm >= hostBounds.minXmm - 1e-9 &&
			corner.xMm <= hostBounds.maxXmm + 1e-9 &&
			corner.zMm >= hostBounds.minZmm - 1e-9 &&
			corner.zMm <= hostBounds.maxZmm + 1e-9,
	);
}

function isWithinUsableRoomHost(
	input: FloorItemFootprint,
	host: UsableRoomHost,
): boolean {
	if (!("polygonMm" in host)) return isWithinHostBounds(input, host);
	const corners = floorItemFootprintCorners(input);
	return (
		corners.every((corner) => pointInSimplePolygon(corner, host.polygonMm)) &&
		corners.every((first, index) => {
			const second = corners[(index + 1) % corners.length];
			return (
				second !== undefined &&
				segmentIsInsidePolygon(first, second, host.polygonMm)
			);
		})
	);
}

function isValidFootprint(footprint: FloorItemFootprint): boolean {
	return (
		[footprint.xMm, footprint.zMm, footprint.widthMm, footprint.depthMm].every(
			Number.isSafeInteger,
		) &&
		footprint.widthMm > 0 &&
		footprint.depthMm > 0 &&
		hasValidFloorYaw(footprint)
	);
}

function assessFloorItemCollisions(
	project: Project,
	footprint: FloorCollisionFootprint,
	excludedAssetInstanceId: string | undefined,
	collisionPolicy: FloorItemCollisionPolicy,
): ParametricFloorItemPlacementAssessment {
	const targets = findParametricFloorItemCollisionTargets(
		project,
		footprint,
		excludedAssetInstanceId,
	);
	if (targets.some(target => target.kind === "wall")) {
		return { kind: "invalid", reasonCode: "WALL_ITEM_COLLISION" };
	}
	if (targets.some(target => target.kind === "door-clearance" && project.level.openings.some((opening) =>
		opening.openingId === target.openingId && opening.variant === "sliding"))) {
		return { kind: "invalid", reasonCode: "DOOR_CLEARANCE_COLLISION" };
	}
	const warnings = targets.filter(target => target.kind !== "wall");
	if (collisionPolicy === "reject" && warnings.some(target => target.kind === "item")) {
		return { kind: "invalid", reasonCode: "ITEM_COLLISION" };
	}
	return warnings.length > 0 ? { kind: "warning", warnings } : { kind: "valid" };
}

function floorItemCollisionItems(
	project: Project,
	footprint: FloorCollisionFootprint,
	excludedAssetInstanceId?: string,
): readonly FloorSchematicAssetInstance[] {
	return project.assetInstances.filter(
		(item): item is FloorSchematicAssetInstance =>
			isFloorSchematicAssetInstance(item) &&
			item.assetInstanceId !== excludedAssetInstanceId &&
			item.roomLayoutId === footprint.roomLayoutId &&
			floorItemFootprintsCollide(footprint, item),
	);
}

export function isFloorRug(item: FloorItemCollisionIdentity): boolean {
	if (item.assetDefinitionId !== undefined || item.modelBacked) return false;
	// Older Telegram catalog placements saved the canonical display label alone.
	return item.catalogPreset ? item.catalogPreset.presetId === "rug" : item.label === "Ковёр";
}

/** A rug can lie under floor furniture. Two objects on the same layer still collide. */
export function floorItemFootprintsCollide(first: FloorCollisionFootprint, second: FloorCollisionFootprint): boolean {
	return isFloorRug(first) === isFloorRug(second) && footprintsOverlap(first, second);
}

function floorItemCollisionWalls(
	project: Project,
	footprint: FloorItemFootprint,
) {
	const verticesById = new Map(
		project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	return project.level.wallSegments.filter((wall) => {
		const start = verticesById.get(wall.startVertexId);
		const end = verticesById.get(wall.endVertexId);
		if (!start || !end) {
			return true;
		}
		return floorItemFootprintIntersectsWall(footprint, {
			end: { xMm: end.xMm, zMm: end.zMm },
			start: { xMm: start.xMm, zMm: start.zMm },
			thicknessMm: wall.thicknessMm,
		});
	});
}

/** Door clearance comes from the same durable wall coordinates used to draw the opening. */
export function hasFloorItemDoorSwingCollision(
	project: Project,
	footprint: FloorItemFootprint,
): boolean {
	return floorItemDoorSwingCollisions(project, footprint).length > 0;
}

function floorItemDoorSwingCollisions(
	project: Project,
	footprint: FloorItemFootprint,
): readonly WallOpening[] {
	const verticesById = new Map(
		project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	return project.level.openings.filter((opening) => {
		if (opening.kind !== "Door" || (opening.variant !== "sliding" && opening.sillMm !== 0)) return false;
		const wall = project.level.wallSegments.find(
			(candidate) => candidate.wallSegmentId === opening.wallSegmentId,
		);
		const start = wall ? verticesById.get(wall.startVertexId) : undefined;
		const end = wall ? verticesById.get(wall.endVertexId) : undefined;
		if (!wall || !start || !end) return true;
		const slide = slidingDoorSweepFor(opening, wall, start, end);
		return slide ? slide.bottomMm < (footprint.heightMm ?? Infinity) &&
			footprintsOverlap(footprint, slide.footprint) : floorItemFootprintIntersectsDoorSwing(footprint, opening, start, end);
	});
}

export function floorItemFootprintIntersectsDoorSwing(
	footprint: FloorItemFootprint,
	opening: Pick<WallOpening, "kind" | "offsetMm" | "swingSide" | "hingeEnd" | "widthMm">,
	start: PlanPoint,
	end: PlanPoint,
): boolean {
	if (
		opening.kind !== "Door" ||
		!isValidFootprint(footprint) ||
		!Number.isFinite(opening.offsetMm) ||
		!Number.isFinite(opening.widthMm) ||
		opening.widthMm <= 0
	) {
		return false;
	}
	const lengthMm = Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm);
	if (!Number.isFinite(lengthMm) || lengthMm <= 0) return false;
	const interval = wallOpeningIntervalMm(opening);
	if (interval.startMm < 0 || interval.endMm > lengthMm) return false;
	const hostDirection = {
		xMm: (end.xMm - start.xMm) / lengthMm,
		zMm: (end.zMm - start.zMm) / lengthMm,
	};
	const { hingeAtEnd, swingSign } = doorOpeningOrientation(opening);
	const hingeOffset = hingeAtEnd ? interval.endMm : interval.startMm;
	const direction = hingeAtEnd
		? { xMm: -hostDirection.xMm, zMm: -hostDirection.zMm }
		: hostDirection;
	const pivot = {
		xMm: start.xMm + hostDirection.xMm * hingeOffset,
		zMm: start.zMm + hostDirection.zMm * hingeOffset,
	};
	const normal = {
		xMm: -hostDirection.zMm * swingSign,
		zMm: hostDirection.xMm * swingSign,
	};
	const corners = floorItemFootprintCorners(footprint);
	return (
		corners.some((point) =>
			pointInDoorSwing(point, pivot, direction, normal, opening.widthMm),
		) ||
		pointInConvexPolygon(pivot, corners) ||
		segmentIntersectsDoorSwing(
			corners,
			pivot,
			direction,
			normal,
			opening.widthMm,
		)
	);
}

function pointInDoorSwing(
	point: PlanPoint,
	pivot: PlanPoint,
	direction: PlanPoint,
	normal: PlanPoint,
	radiusMm: number,
): boolean {
	const xMm =
		(point.xMm - pivot.xMm) * direction.xMm +
		(point.zMm - pivot.zMm) * direction.zMm;
	const zMm =
		(point.xMm - pivot.xMm) * normal.xMm + (point.zMm - pivot.zMm) * normal.zMm;
	return xMm >= 0 && zMm >= 0 && xMm * xMm + zMm * zMm <= radiusMm * radiusMm;
}

function pointInConvexPolygon(
	point: PlanPoint,
	polygon: readonly PlanPoint[],
): boolean {
	let sign = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const first = polygon[index];
		const second = polygon[(index + 1) % polygon.length];
		if (!first || !second) return false;
		const cross =
			(second.xMm - first.xMm) * (point.zMm - first.zMm) -
			(second.zMm - first.zMm) * (point.xMm - first.xMm);
		if (Math.abs(cross) < 1e-9) continue;
		const nextSign = cross > 0 ? 1 : -1;
		if (sign !== 0 && sign !== nextSign) return false;
		sign = nextSign;
	}
	return true;
}

function pointInSimplePolygon(
	point: PlanPoint,
	polygon: readonly PlanPoint[],
): boolean {
	let inside = false;
	for (let index = 0; index < polygon.length; index += 1) {
		const first = polygon[index];
		const second = polygon[(index + 1) % polygon.length];
		if (!first || !second) return false;
		if (pointIsOnSegment(point, first, second)) return true;
		if (
			first.zMm > point.zMm !== second.zMm > point.zMm &&
			point.xMm <
				((second.xMm - first.xMm) * (point.zMm - first.zMm)) /
					(second.zMm - first.zMm) +
					first.xMm
		) {
			inside = !inside;
		}
	}
	return inside;
}

export function segmentIsInsidePolygon(
	start: PlanPoint,
	end: PlanPoint,
	polygon: readonly PlanPoint[],
): boolean {
	const breakpoints = [0, 1];
	for (let index = 0; index < polygon.length; index += 1) {
		const first = polygon[index];
		const second = polygon[(index + 1) % polygon.length];
		if (!first || !second) return false;
		const parameter = segmentIntersectionParameter(start, end, first, second);
		if (parameter !== undefined) breakpoints.push(parameter);
		for (const point of [first, second]) {
			if (pointIsOnSegment(point, start, end)) {
				const deltaX = end.xMm - start.xMm;
				const deltaZ = end.zMm - start.zMm;
				const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
				if (lengthSquared > 0) {
					breakpoints.push(
						((point.xMm - start.xMm) * deltaX +
							(point.zMm - start.zMm) * deltaZ) /
							lengthSquared,
					);
				}
			}
		}
	}
	const sorted = [
		...new Set(breakpoints.map((value) => Math.max(0, Math.min(1, value)))),
	].sort((first, second) => first - second);
	return sorted.every((value, index) => {
		const next = sorted[index + 1];
		if (next === undefined || next - value < 1e-9) return true;
		const midpoint = (value + next) / 2;
		return pointInSimplePolygon(
			{
				xMm: start.xMm + (end.xMm - start.xMm) * midpoint,
				zMm: start.zMm + (end.zMm - start.zMm) * midpoint,
			},
			polygon,
		);
	});
}

function segmentIntersectionParameter(
	firstStart: PlanPoint,
	firstEnd: PlanPoint,
	secondStart: PlanPoint,
	secondEnd: PlanPoint,
): number | undefined {
	const firstDeltaX = firstEnd.xMm - firstStart.xMm;
	const firstDeltaZ = firstEnd.zMm - firstStart.zMm;
	const secondDeltaX = secondEnd.xMm - secondStart.xMm;
	const secondDeltaZ = secondEnd.zMm - secondStart.zMm;
	const denominator = firstDeltaX * secondDeltaZ - firstDeltaZ * secondDeltaX;
	if (Math.abs(denominator) < 1e-9) return undefined;
	const originX = secondStart.xMm - firstStart.xMm;
	const originZ = secondStart.zMm - firstStart.zMm;
	const firstParameter =
		(originX * secondDeltaZ - originZ * secondDeltaX) / denominator;
	const secondParameter =
		(originX * firstDeltaZ - originZ * firstDeltaX) / denominator;
	return firstParameter >= -1e-9 &&
		firstParameter <= 1 + 1e-9 &&
		secondParameter >= -1e-9 &&
		secondParameter <= 1 + 1e-9
		? firstParameter
		: undefined;
}

function pointIsOnSegment(
	point: PlanPoint,
	start: PlanPoint,
	end: PlanPoint,
): boolean {
	const cross =
		(end.xMm - start.xMm) * (point.zMm - start.zMm) -
		(end.zMm - start.zMm) * (point.xMm - start.xMm);
	return (
		Math.abs(cross) < 1e-9 &&
		point.xMm >= Math.min(start.xMm, end.xMm) - 1e-9 &&
		point.xMm <= Math.max(start.xMm, end.xMm) + 1e-9 &&
		point.zMm >= Math.min(start.zMm, end.zMm) - 1e-9 &&
		point.zMm <= Math.max(start.zMm, end.zMm) + 1e-9
	);
}

function segmentIntersectsDoorSwing(
	corners: readonly PlanPoint[],
	pivot: PlanPoint,
	direction: PlanPoint,
	normal: PlanPoint,
	radiusMm: number,
): boolean {
	return corners.some((first, index) => {
		const second = corners[(index + 1) % corners.length];
		if (!second) return false;
		for (let step = 1; step < 8; step += 1) {
			const factor = step / 8;
			if (
				pointInDoorSwing(
					{
						xMm: first.xMm + (second.xMm - first.xMm) * factor,
						zMm: first.zMm + (second.zMm - first.zMm) * factor,
					},
					pivot,
					direction,
					normal,
					radiusMm,
				)
			)
				return true;
		}
		return false;
	});
}

/** Shared exact contact check for both wall placement and floor-item placement. */
export function floorItemFootprintIntersectsWall(
	footprint: FloorItemFootprint,
	wall: AddWallSegmentInput,
): boolean {
	if (!isValidFootprint(footprint) || !isValidWallBody(wall)) {
		return false;
	}
	const deltaX = wall.end.xMm - wall.start.xMm;
	const deltaZ = wall.end.zMm - wall.start.zMm;
	return footprintsOverlap(footprint, {
		depthMm: wall.thicknessMm,
		continuousYaw: true,
		widthMm: Math.hypot(deltaX, deltaZ),
		xMm: (wall.start.xMm + wall.end.xMm) / 2,
		yawRadians: -Math.atan2(deltaZ, deltaX),
		zMm: (wall.start.zMm + wall.end.zMm) / 2,
	});
}

function isValidWallBody(wall: AddWallSegmentInput): boolean {
	const deltaX = wall.end.xMm - wall.start.xMm;
	const deltaZ = wall.end.zMm - wall.start.zMm;
	return (
		Number.isSafeInteger(wall.thicknessMm) &&
		wall.thicknessMm > 0 &&
		[wall.start.xMm, wall.start.zMm, wall.end.xMm, wall.end.zMm].every(
			Number.isSafeInteger,
		) &&
		(deltaX !== 0 || deltaZ !== 0) &&
		(deltaX === 0 || deltaZ === 0 || Math.abs(deltaX) === Math.abs(deltaZ))
	);
}

export function footprintsOverlap(
	first: FloorItemFootprint,
	second: FloorItemFootprint,
): boolean {
	const firstCorners = floorItemFootprintCorners(first);
	const secondCorners = floorItemFootprintCorners(second);
	return ![
		...separatingAxes(firstCorners),
		...separatingAxes(secondCorners),
	].some((axis) => separatesAlong(axis, firstCorners, secondCorners));
}

interface PlanPoint {
	readonly xMm: number;
	readonly zMm: number;
}

export function yawRadiansFor(
	footprint: Pick<
		FloorItemFootprint,
		"continuousYaw" | "yawRadians" | "yawStep" | "yawMilliDeg"
	>,
): number {
	if (footprint.continuousYaw) return footprint.yawRadians ?? 0;
	if (footprint.yawMilliDeg !== undefined) return footprint.yawMilliDeg * Math.PI / 180_000;
	return ((rotationStepForFootprint(footprint) ?? 0) * Math.PI) / 4;
}

/** Maps a transient gesture angle to the closest declared 45-degree step. */
export function rotationStepForYawRadians(yawRadians: number): RotationStep {
	return normalizedRotationStep(Math.round(yawRadians / (Math.PI / 4)));
}

/**
 * A derived physical boundary for inspection and measurement. It is never a
 * persistent mesh or renderer approximation.
 */
export function floorItemFootprintCorners(
	footprint: FloorItemFootprint,
): readonly PlanPoint[] {
	const yawRadians = yawRadiansFor(footprint);
	const cosine = Math.cos(yawRadians);
	const sine = Math.sin(yawRadians);
	const halfWidthMm = footprint.widthMm / 2;
	const halfDepthMm = footprint.depthMm / 2;
	return [
		{ localXmm: -halfWidthMm, localZmm: -halfDepthMm },
		{ localXmm: halfWidthMm, localZmm: -halfDepthMm },
		{ localXmm: halfWidthMm, localZmm: halfDepthMm },
		{ localXmm: -halfWidthMm, localZmm: halfDepthMm },
	].map(({ localXmm, localZmm }) => ({
		xMm: footprint.xMm + cosine * localXmm + sine * localZmm,
		zMm: footprint.zMm - sine * localXmm + cosine * localZmm,
	}));
}

function separatingAxes(corners: readonly PlanPoint[]): readonly PlanPoint[] {
	return corners.map((corner, index) => {
		const next = corners[(index + 1) % corners.length];
		if (!next) {
			return { xMm: 0, zMm: 0 };
		}
		return { xMm: -(next.zMm - corner.zMm), zMm: next.xMm - corner.xMm };
	});
}

function separatesAlong(
	axis: PlanPoint,
	first: readonly PlanPoint[],
	second: readonly PlanPoint[],
): boolean {
	const firstProjection = projectionBounds(axis, first);
	const secondProjection = projectionBounds(axis, second);
	return (
		firstProjection.max <= secondProjection.min + 1e-9 ||
		secondProjection.max <= firstProjection.min + 1e-9
	);
}

function projectionBounds(
	axis: PlanPoint,
	corners: readonly PlanPoint[],
): { readonly min: number; readonly max: number } {
	const values = corners.map(
		(corner) => corner.xMm * axis.xMm + corner.zMm * axis.zMm,
	);
	return { max: Math.max(...values), min: Math.min(...values) };
}

function isValidOptionalRotationStep(
	value: unknown,
): value is RotationStep | undefined {
	return (
		value === undefined ||
		(typeof value === "number" &&
			Number.isInteger(value) &&
			value >= 0 &&
			value <= 7)
	);
}

function isValidYawRadians(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= 0 &&
		value < Math.PI * 2
	);
}

function rotationStepForFootprint(
	footprint: Pick<FloorItemFootprint, "yawRadians" | "yawStep">,
): RotationStep | undefined {
	if (footprint.yawStep !== undefined) return footprint.yawStep;
	return footprint.yawRadians === undefined
		? undefined
		: rotationStepForYawRadians(footprint.yawRadians);
}

export function isFloorYawMilliDegrees(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 360_000;
}

function hasValidFloorYaw(footprint: Pick<FloorItemFootprint, "yawStep" | "yawRadians" | "yawMilliDeg">): boolean {
	return footprint.yawMilliDeg !== undefined
		? isFloorYawMilliDegrees(footprint.yawMilliDeg) && footprint.yawStep === undefined && footprint.yawRadians === undefined
		: isValidOptionalRotationStep(footprint.yawStep) && (footprint.yawRadians === undefined || isValidYawRadians(footprint.yawRadians));
}

type FloorYawFields =
	| { readonly yawStep: RotationStep; readonly yawMilliDeg?: never }
	| { readonly yawMilliDeg: number; readonly yawStep?: never };

export function floorYawFieldsForRadians(yawRadians: number, exact: boolean): FloorYawFields {
	if (!exact) return { yawStep: rotationStepForYawRadians(yawRadians) };
	const milliDegrees = Math.round(yawRadians * 180_000 / Math.PI);
	return floorYawFieldsForMilliDegrees(((milliDegrees % 360_000) + 360_000) % 360_000);
}

function floorYawFieldsForMilliDegrees(milliDegrees: number): FloorYawFields {
	return milliDegrees % 45_000 === 0
		? { yawStep: normalizedRotationStep(milliDegrees / 45_000) }
		: { yawMilliDeg: milliDegrees };
}

function canonicalFloorYawFields(
	pose: Pick<FloorItemFootprint, "yawRadians" | "yawStep" | "yawMilliDeg">,
): FloorYawFields {
	return pose.yawMilliDeg === undefined
		? { yawStep: rotationStepForFootprint(pose) ?? 0 }
		: floorYawFieldsForMilliDegrees(pose.yawMilliDeg);
}

function withoutLegacyYawRadians(
	item: FloorSchematicAssetInstance,
): Omit<FloorSchematicAssetInstance, "yawRadians" | "yawStep" | "yawMilliDeg"> {
	const { yawRadians: _legacyYawRadians, yawStep: _yawStep, yawMilliDeg: _yawMilliDeg, ...canonicalItem } = item;
	return canonicalItem;
}

function normalizedRotationStep(value: number): RotationStep {
	return (((value % 8) + 8) % 8) as RotationStep;
}

function usableBoundsForRoom(
	project: Project,
	roomId: string,
): UsableRoomHost | undefined {
	const derived = resolveOrthogonalPlanFaces(project);
	const resolvedRoom =
		derived.kind === "accepted"
			? derived.plan.rooms.find((room) => room.roomId === roomId)
			: undefined;
	const resolvedTile = resolvedRoom?.usableFloorTilesMm[0];
	if (resolvedTile && resolvedRoom.usableFloorTilesMm.length === 1) {
		return resolvedTile;
	}
	const resolvedPolygon = resolvedRoom?.usableFloorPolygonMm;
	if (resolvedPolygon && resolvedPolygon.length >= 3) {
		return { polygonMm: resolvedPolygon };
	}
	const loopBounds = rectangularRoomLoopBoundsForRoom(project, roomId);
	if (loopBounds) {
		return inwardBounds(
			loopBounds.minXMm,
			loopBounds.maxXMm,
			loopBounds.minZMm,
			loopBounds.maxZMm,
			loopBounds.thicknessMm,
		);
	}
	const room = project.level.rooms.find(
		(candidate) => candidate.roomId === roomId,
	);
	const vertices = project.level.vertices;
	if (!room || vertices.length === 0) {
		return undefined;
	}
	const xValues = vertices.map((vertex) => vertex.xMm);
	const zValues = vertices.map((vertex) => vertex.zMm);
	const minXmm = Math.min(...xValues);
	const maxXmm = Math.max(...xValues);
	const minZmm = Math.min(...zValues);
	const maxZmm = Math.max(...zValues);
	const partition =
		/^partition:(vertical|horizontal):(left|right|top|bottom):(\d+):(\d+):(\d+):(\d+)$/.exec(
			room.faceFingerprint,
		);
	const rectangular = /^rectangular:(\d+):(\d+):(\d+)$/.exec(
		room.faceFingerprint,
	);
	const grid = /^grid:(-?\d+):(-?\d+):(-?\d+):(-?\d+):(\d+)$/.exec(
		room.faceFingerprint,
	);

	if (rectangular) {
		const [, outerWidthMm, outerDepthMm, thicknessMm] = rectangular.map(Number);
		return isMatchingRectangle(
			project,
			outerWidthMm,
			outerDepthMm,
			thicknessMm,
			minXmm,
			maxXmm,
			minZmm,
			maxZmm,
		)
			? inwardBounds(minXmm, maxXmm, minZmm, maxZmm, thicknessMm)
			: undefined;
	}
	if (grid) {
		const [, roomMinXraw, roomMaxXraw, roomMinZraw, roomMaxZraw, thicknessRaw] =
			grid;
		const roomMinXmm = Number(roomMinXraw);
		const roomMaxXmm = Number(roomMaxXraw);
		const roomMinZmm = Number(roomMinZraw);
		const roomMaxZmm = Number(roomMaxZraw);
		const thicknessMm = Number(thicknessRaw);
		return Number.isSafeInteger(roomMinXmm) &&
			Number.isSafeInteger(roomMaxXmm) &&
			Number.isSafeInteger(roomMinZmm) &&
			Number.isSafeInteger(roomMaxZmm) &&
			Number.isSafeInteger(thicknessMm) &&
			thicknessMm > 0 &&
			roomMinXmm >= minXmm &&
			roomMaxXmm <= maxXmm &&
			roomMinZmm >= minZmm &&
			roomMaxZmm <= maxZmm &&
			roomMinXmm < roomMaxXmm &&
			roomMinZmm < roomMaxZmm &&
			project.level.wallSegments.every(
				(wall) => wall.thicknessMm === thicknessMm,
			)
			? inwardBounds(
					roomMinXmm,
					roomMaxXmm,
					roomMinZmm,
					roomMaxZmm,
					thicknessMm,
				)
			: undefined;
	}
	if (!partition) {
		return undefined;
	}
	const [
		,
		orientation,
		side,
		outerWidthRaw,
		outerDepthRaw,
		offsetRaw,
		thicknessRaw,
	] = partition;
	const outerWidthMm = Number(outerWidthRaw);
	const outerDepthMm = Number(outerDepthRaw);
	const offsetMm = Number(offsetRaw);
	const thicknessMm = Number(thicknessRaw);
	if (
		(orientation !== "vertical" && orientation !== "horizontal") ||
		(side !== "left" &&
			side !== "right" &&
			side !== "top" &&
			side !== "bottom") ||
		!isMatchingRectangle(
			project,
			outerWidthMm,
			outerDepthMm,
			thicknessMm,
			minXmm,
			maxXmm,
			minZmm,
			maxZmm,
		)
	) {
		return undefined;
	}
	const bounds = inwardBounds(minXmm, maxXmm, minZmm, maxZmm, thicknessMm);
	const halfThicknessMm = thicknessMm / 2;
	if (orientation === "vertical") {
		const dividerXmm = minXmm + offsetMm;
		return side === "left"
			? { ...bounds, maxXmm: dividerXmm - halfThicknessMm }
			: side === "right"
				? { ...bounds, minXmm: dividerXmm + halfThicknessMm }
				: undefined;
	}
	const dividerZmm = minZmm + offsetMm;
	return side === "top"
		? { ...bounds, maxZmm: dividerZmm - halfThicknessMm }
		: side === "bottom"
			? { ...bounds, minZmm: dividerZmm + halfThicknessMm }
			: undefined;
}

function isMatchingRectangle(
	project: Project,
	outerWidthMm: number,
	outerDepthMm: number,
	thicknessMm: number,
	minXmm: number,
	maxXmm: number,
	minZmm: number,
	maxZmm: number,
): boolean {
	return (
		Number.isSafeInteger(outerWidthMm) &&
		Number.isSafeInteger(outerDepthMm) &&
		Number.isSafeInteger(thicknessMm) &&
		thicknessMm > 0 &&
		maxXmm - minXmm === outerWidthMm &&
		maxZmm - minZmm === outerDepthMm &&
		project.level.wallSegments.every((wall) => wall.thicknessMm === thicknessMm)
	);
}

function inwardBounds(
	minXmm: number,
	maxXmm: number,
	minZmm: number,
	maxZmm: number,
	thicknessMm: number,
): HostBounds {
	const halfThicknessMm = thicknessMm / 2;
	return {
		maxXmm: maxXmm - halfThicknessMm,
		maxZmm: maxZmm - halfThicknessMm,
		minXmm: minXmm + halfThicknessMm,
		minZmm: minZmm + halfThicknessMm,
	};
}
