import { wallOpeningHostsForProject } from "./door-opening-project";
import {
	alphaParametricItemColorVariantFor,
	type ItemColorVariantId,
} from "./item-color-variant";
import type {
	Project,
	WallOpening,
	WallSchematicAssetInstance,
} from "./project";
import { wallOpeningIntervalMm } from "./wall-opening";

export type ParametricWallItemInput = {
	readonly assetDefinitionId?: string;
	readonly color: string;
	readonly depthMm: number;
	readonly elevationMm: number;
	readonly heightMm: number;
	readonly label: string;
	readonly offsetMm: number;
	readonly side: "left" | "right";
	readonly wallSegmentId: string;
	readonly widthMm: number;
};

export type MoveParametricWallItemInput = {
	readonly assetInstanceId: string;
	readonly elevationMm: number;
	readonly offsetMm: number;
};

export type SetParametricWallItemLockInput = {
	readonly assetInstanceId: string;
	readonly locked: boolean;
};

export type RecolorParametricWallItemInput = {
	readonly assetInstanceId: string;
	readonly variantId: ItemColorVariantId;
};

interface IdSource {
	next(): string;
}

export type ParametricWallItemPlacementRejectionReason =
	| "ASSET_DEFINITION_NOT_PINNED"
	| "INVALID_DIMENSION"
	| "OUTSIDE_WALL_HOST"
	| "WALL_OPENING_COLLISION"
	| "WALL_HOST_NOT_FOUND";

export type ParametricWallItemPlacementWarning = {
	readonly assetInstanceId: string;
	readonly kind: "wall-item";
};

export type ParametricWallItemPlacementAssessment =
	| {
			readonly kind: "accepted";
			readonly warnings?: readonly ParametricWallItemPlacementWarning[];
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode: ParametricWallItemPlacementRejectionReason;
	  };

export type CreateParametricWallItemResult =
	| {
			readonly kind: "accepted";
			readonly project: Project;
			readonly warnings?: readonly ParametricWallItemPlacementWarning[];
	  }
	| Extract<ParametricWallItemPlacementAssessment, { readonly kind: "rejected" }>;

export type DeleteParametricWallItemResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode: "WALL_ITEM_LOCKED" | "WALL_ITEM_NOT_FOUND";
	  };

export type SetParametricWallItemLockResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "WALL_ITEM_LOCK_STATE_UNCHANGED"
				| "WALL_ITEM_NOT_FOUND";
	  };

export type MoveParametricWallItemResult =
	| {
			readonly kind: "accepted";
			readonly project: Project;
			readonly warnings?: readonly ParametricWallItemPlacementWarning[];
	  }
	| Extract<ParametricWallItemPlacementAssessment, { readonly kind: "rejected" }>
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "INVALID_WALL_POSITION"
				| "WALL_ITEM_NOT_FOUND"
				| "WALL_ITEM_LOCKED";
	  };

export type RecolorParametricWallItemResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "ITEM_COLOR_NOT_SUPPORTED"
				| "ITEM_COLOR_UNSUPPORTED"
				| "WALL_ITEM_LOCKED"
				| "WALL_ITEM_NOT_FOUND";
	  };

/**
 * A first wall-mounted primitive. Its location is a WallSegment-relative
 * offset/elevation only; no scene position is accepted or persisted.
 */
export function createParametricWallItem(
	project: Project,
	input: ParametricWallItemInput,
	ids: IdSource,
	updatedAt: string,
): CreateParametricWallItemResult {
	const assessment = assessParametricWallItemPlacement(project, input);
	if (assessment.kind === "rejected") return assessment;
	const item: WallSchematicAssetInstance = {
		anchorClass: "wall",
		...(input.assetDefinitionId === undefined
			? {}
			: { assetDefinitionId: input.assetDefinitionId }),
		assetInstanceId: ids.next(),
		color: input.color,
		depthMm: input.depthMm,
		elevationMm: input.elevationMm,
		heightMm: input.heightMm,
		label: input.label,
		offsetMm: input.offsetMm,
		side: input.side,
		wallSegmentId: input.wallSegmentId,
		widthMm: input.widthMm,
	};
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: [...project.assetInstances, item],
			updatedAt,
		},
		...(assessment.warnings === undefined
			? {}
			: { warnings: assessment.warnings }),
	};
}

/**
 * Gives every wall-local placement flow the same observable rule before a
 * preview or a durable command is created. Exact edge contact remains valid.
 */
export function assessParametricWallItemPlacement(
	project: Project,
	input: ParametricWallItemInput,
	excludedAssetInstanceId?: string,
): ParametricWallItemPlacementAssessment {
	if (
		input.assetDefinitionId !== undefined &&
		!project.assetDefinitionRefs.some(
			(definition) => definition.assetDefinitionId === input.assetDefinitionId,
		)
	) {
		return { kind: "rejected", reasonCode: "ASSET_DEFINITION_NOT_PINNED" };
	}
	if (!hasValidInput(input)) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	const host = wallOpeningHostsForProject(project)?.find(
		(candidate) => candidate.wallSegmentId === input.wallSegmentId,
	);
	if (!host) {
		return { kind: "rejected", reasonCode: "WALL_HOST_NOT_FOUND" };
	}
	if (!fitsHost(input, host.usableLengthMm, host.heightMm)) {
		return { kind: "rejected", reasonCode: "OUTSIDE_WALL_HOST" };
	}
	if (
		project.level.openings.some((opening) =>
			wallItemIntersectsOpening(input, opening),
		)
	) {
		return { kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" };
	}
	const overlappingItem = wallItemOverlappingExisting(
		project,
		input,
		excludedAssetInstanceId,
	);
	if (overlappingItem) {
		return {
			kind: "accepted",
			warnings: [
				{ assetInstanceId: overlappingItem.assetInstanceId, kind: "wall-item" },
			],
		};
	}
	return { kind: "accepted" };
}

/**
 * Lets topology commands verify an already durable wall-local address without
 * converting it into a renderer-space position.
 */
export function isWallSchematicAssetPlacementValid(
	project: Project,
	item: WallSchematicAssetInstance,
): boolean {
	return (
		assessParametricWallItemPlacement(project, item, item.assetInstanceId)
			.kind === "accepted"
	);
}

/**
 * Moves a wall item only in the local address system of its existing host.
 * Rehosting and renderer/world transforms are intentionally outside this command.
 */
export function moveParametricWallItem(
	project: Project,
	input: MoveParametricWallItemInput,
	updatedAt: string,
): MoveParametricWallItemResult {
	const target = project.assetInstances.find(
		(item): item is WallSchematicAssetInstance =>
			item.anchorClass === "wall" &&
			item.assetInstanceId === input.assetInstanceId,
	);
	if (!target) return { kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" };
	if (target.locked) return { kind: "rejected", reasonCode: "WALL_ITEM_LOCKED" };
	if (!hasValidWallPosition(input)) {
		return { kind: "rejected", reasonCode: "INVALID_WALL_POSITION" };
	}
	const moved = { ...target, ...input };
	const assessment = assessParametricWallItemPlacement(
		project,
		moved,
		target.assetInstanceId,
	);
	if (assessment.kind === "rejected") return assessment;
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.map((item) =>
				item.assetInstanceId === target.assetInstanceId ? moved : item,
			),
			updatedAt,
		},
		...(assessment.warnings === undefined
			? {}
			: { warnings: assessment.warnings }),
	};
}

/**
 * Replaces only a declared local presentation variant. The immutable
 * wall-relative host address and dimensions deliberately stay untouched.
 */
export function recolorParametricWallItem(
	project: Project,
	input: RecolorParametricWallItemInput,
	updatedAt: string,
): RecolorParametricWallItemResult {
	const target = project.assetInstances.find(
		(item): item is WallSchematicAssetInstance =>
			item.anchorClass === "wall" &&
			item.assetInstanceId === input.assetInstanceId,
	);
	if (!target) return { kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" };
	if (target.locked) return { kind: "rejected", reasonCode: "WALL_ITEM_LOCKED" };
	if (
		target.assetDefinitionId !== undefined &&
		project.assetDefinitionRefs.some(
			(definition) => definition.assetDefinitionId === target.assetDefinitionId,
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
			assetInstances: project.assetInstances.map((item) =>
				item.assetInstanceId === target.assetInstanceId &&
				item.anchorClass === "wall"
					? {
							...item,
							color: variant.color,
							colorVariantId: variant.variantId,
						}
					: item,
			),
			updatedAt,
		},
	};
}

/**
 * Persists only the explicit interaction guard. A missing flag remains an
 * unlocked legacy-compatible state, so unlocking removes the marker instead
 * of rewriting unrelated placement data.
 */
export function setParametricWallItemLock(
	project: Project,
	input: SetParametricWallItemLockInput,
	updatedAt: string,
): SetParametricWallItemLockResult {
	const target = project.assetInstances.find(
		(item): item is WallSchematicAssetInstance =>
			item.anchorClass === "wall" &&
			item.assetInstanceId === input.assetInstanceId,
	);
	if (!target) return { kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" };
	if ((target.locked === true) === input.locked) {
		return { kind: "rejected", reasonCode: "WALL_ITEM_LOCK_STATE_UNCHANGED" };
	}
	const updated = input.locked
		? { ...target, locked: true as const }
		: withoutLock(target);
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

/** Removes one wall-hosted item without making a floor command own a wall asset. */
export function deleteParametricWallItem(
	project: Project,
	input: { readonly assetInstanceId: string },
	updatedAt: string,
): DeleteParametricWallItemResult {
	const target = project.assetInstances.find(
		(item): item is WallSchematicAssetInstance =>
			item.assetInstanceId === input.assetInstanceId && item.anchorClass === "wall",
	);
	if (!target) return { kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" };
	if (target.locked) return { kind: "rejected", reasonCode: "WALL_ITEM_LOCKED" };
	return {
		kind: "accepted",
		project: {
			...project,
			assetInstances: project.assetInstances.filter(
				(item) => item.assetInstanceId !== target.assetInstanceId,
			),
			updatedAt,
		},
	};
}

function withoutLock(item: WallSchematicAssetInstance): WallSchematicAssetInstance {
	const { locked: _locked, ...unlocked } = item;
	return unlocked;
}

function wallItemIntersectsOpening(
	item: ParametricWallItemInput,
	opening: WallOpening,
): boolean {
	if (item.wallSegmentId !== opening.wallSegmentId) return false;
	const openingInterval = wallOpeningIntervalMm(opening);
	const itemHalfWidthMm = item.widthMm / 2;
	const itemHalfHeightMm = item.heightMm / 2;
	return (
		item.offsetMm - itemHalfWidthMm < openingInterval.endMm &&
		item.offsetMm + itemHalfWidthMm > openingInterval.startMm &&
		item.elevationMm - itemHalfHeightMm < opening.sillMm + opening.heightMm &&
		item.elevationMm + itemHalfHeightMm > opening.sillMm
	);
}

function wallItemOverlappingExisting(
	project: Project,
	candidate: ParametricWallItemInput,
	excludedAssetInstanceId?: string,
): WallSchematicAssetInstance | undefined {
	return project.assetInstances.find(
		(item): item is WallSchematicAssetInstance =>
			item.anchorClass === "wall" &&
			item.assetInstanceId !== excludedAssetInstanceId &&
			wallItemsOverlap(candidate, item),
	);
}

function wallItemsOverlap(
	first: ParametricWallItemInput,
	second: WallSchematicAssetInstance,
): boolean {
	if (
		first.wallSegmentId !== second.wallSegmentId ||
		first.side !== second.side
	) {
		return false;
	}
	const firstHalfWidthMm = first.widthMm / 2;
	const secondHalfWidthMm = second.widthMm / 2;
	const firstHalfHeightMm = first.heightMm / 2;
	const secondHalfHeightMm = second.heightMm / 2;
	return (
		first.offsetMm - firstHalfWidthMm < second.offsetMm + secondHalfWidthMm &&
		first.offsetMm + firstHalfWidthMm > second.offsetMm - secondHalfWidthMm &&
		first.elevationMm - firstHalfHeightMm <
			second.elevationMm + secondHalfHeightMm &&
		first.elevationMm + firstHalfHeightMm >
			second.elevationMm - secondHalfHeightMm
	);
}

function fitsHost(
	input: ParametricWallItemInput,
	usableLengthMm: number,
	hostHeightMm: number,
): boolean {
	const halfWidthMm = input.widthMm / 2;
	const halfHeightMm = input.heightMm / 2;
	return (
		input.offsetMm - halfWidthMm >= 0 &&
		input.offsetMm + halfWidthMm <= usableLengthMm &&
		input.elevationMm - halfHeightMm >= 0 &&
		input.elevationMm + halfHeightMm <= hostHeightMm
	);
}

function hasValidInput(input: ParametricWallItemInput): boolean {
	return (
		input.label.trim().length > 0 &&
		/^#[0-9a-f]{6}$/i.test(input.color) &&
		(input.side === "left" || input.side === "right") &&
		[
			input.depthMm,
			input.elevationMm,
			input.heightMm,
			input.offsetMm,
			input.widthMm,
		].every((value) => Number.isSafeInteger(value) && value >= 0) &&
		input.depthMm > 0 &&
		input.heightMm > 0 &&
		input.widthMm > 0 &&
		input.wallSegmentId.trim().length > 0
	);
}

function hasValidWallPosition(input: MoveParametricWallItemInput): boolean {
	return (
		Number.isSafeInteger(input.elevationMm) &&
		Number.isSafeInteger(input.offsetMm) &&
		input.elevationMm >= 0 &&
		input.offsetMm >= 0
	);
}
