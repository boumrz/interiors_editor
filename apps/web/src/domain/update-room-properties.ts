import { wallOpeningHostsForProject } from "./door-opening-project";
import { resolveSupportedPlacements } from "./interior-support";
import type { Project, RoomType } from "./project";
import { updateWallOpening } from "./wall-opening";

export const ROOM_PROPERTY_HEIGHT_MAX_MM = 10_000;
export const ROOM_PROPERTY_HEIGHT_MIN_MM = 500;

export const roomTypes: readonly RoomType[] = [
	"living-room",
	"bedroom",
	"kitchen",
	"bathroom",
	"hallway",
	"office",
	"storage",
	"other",
];

export interface UpdateRoomPropertiesInput {
	readonly heightMm: number;
	/** Omission preserves legacy metadata, including an absent name. */
	readonly name?: string;
	readonly roomId: string;
	/** Kept as string at the ingress boundary so invalid values can be rejected. */
	readonly type: string;
}

export type UpdateRoomPropertiesResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode: "ROOM_HEIGHT_SUPPORTED_ITEM_CONFLICT";
			readonly assetInstanceId: string;
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "ROOM_HEIGHT_INVALID"
				| "ROOM_HEIGHT_OPENING_CONFLICT"
				| "ROOM_HEIGHT_OPENING_CONFLICT_STALE"
				| "ROOM_HEIGHT_OPENING_RESOLUTION_INVALID"
				| "ROOM_NAME_REQUIRED"
				| "ROOM_NOT_FOUND"
				| "ROOM_TYPE_INVALID";
	  };

export type RoomHeightOpeningConflictPreview =
	| { readonly kind: "none"; readonly roomId: string }
	| {
			readonly kind: "conflict";
			readonly openingIds: readonly string[];
			readonly roomId: string;
	  }
	| Extract<UpdateRoomPropertiesResult, { readonly kind: "rejected" }>;

export type RoomHeightOpeningResolution =
	| {
			readonly heightMm: number;
			readonly kind: "resize";
			readonly openingId: string;
	  }
	| { readonly kind: "delete"; readonly openingId: string };

export interface ResolveRoomHeightOpeningConflictInput
	extends UpdateRoomPropertiesInput {
	readonly openingResolutions: readonly RoomHeightOpeningResolution[];
}

/**
 * Performs the allocation-free preflight for a Room height edit. A lower
 * Room height may reduce the derived height of every adjacent wall, so no Opening
 * is silently clipped or left outside its host. The returned IDs are a fresh
 * conflict set that a later explicit outcome must recheck before publication.
 */
export function previewRoomHeightOpeningConflict(
	source: Project,
	input: UpdateRoomPropertiesInput,
): RoomHeightOpeningConflictPreview {
	const candidate = updateRoomPropertiesCandidate(
		source,
		input,
		source.updatedAt,
	);
	if (candidate.kind === "rejected") {
		return candidate;
	}
	const obstructingItem = candidate.project.supportedItems?.length
		? resolveSupportedPlacements(candidate.project).find((placed) => placed.roomId === input.roomId && placed.topMm > input.heightMm)
		: undefined;
	if (obstructingItem) {
		return { kind: "rejected", reasonCode: "ROOM_HEIGHT_SUPPORTED_ITEM_CONFLICT", assetInstanceId: obstructingItem.item.assetInstanceId };
	}
	const hosts = wallOpeningHostsForProject(candidate.project);
	const openingIds =
		hosts === undefined
			? candidate.project.level.openings
					.map((opening) => opening.openingId)
					.sort()
			: candidate.project.level.openings
					.filter(
						(opening) =>
							updateWallOpening(
								{
									openings: candidate.project.level.openings,
									wallHosts: hosts,
								},
								{ openingId: opening.openingId },
							).kind === "rejected",
					)
					.map((opening) => opening.openingId)
					.sort();
	return openingIds.length === 0
		? { kind: "none", roomId: input.roomId }
		: { kind: "conflict", openingIds, roomId: input.roomId };
}

/**
 * Changes durable user metadata of exactly one derived Room. Geometry is not
 * accepted at this boundary, so neither measurements nor wall dimensions can
 * accidentally become an independent editable source of truth.
 */
export function updateRoomProperties(
	source: Project,
	input: UpdateRoomPropertiesInput,
	updatedAt: string,
): UpdateRoomPropertiesResult {
	const preview = previewRoomHeightOpeningConflict(source, input);
	if (preview.kind === "rejected") {
		return preview;
	}
	if (preview.kind === "conflict") {
		return { kind: "rejected", reasonCode: "ROOM_HEIGHT_OPENING_CONFLICT" };
	}
	return updateRoomPropertiesCandidate(source, input, updatedAt);
}

/**
 * Re-enters a previously previewed Room-height conflict. The exact conflict set
 * is matched again against the fresh Project; only explicit resize/delete
 * outcomes may form the one accepted candidate. This keeps a cancelled or
 * stale preview outside durable history and prevents a hidden Opening edit.
 */
export function resolveRoomHeightOpeningConflict(
	source: Project,
	input: ResolveRoomHeightOpeningConflictInput,
	updatedAt: string,
): UpdateRoomPropertiesResult {
	const preview = previewRoomHeightOpeningConflict(source, input);
	if (preview.kind === "rejected") {
		return preview;
	}
	if (
		preview.kind !== "conflict" ||
		!sameOpeningIds(
			preview.openingIds,
			input.openingResolutions.map((resolution) => resolution.openingId),
		)
	) {
		return {
			kind: "rejected",
			reasonCode: "ROOM_HEIGHT_OPENING_CONFLICT_STALE",
		};
	}
	const prepared = updateRoomPropertiesCandidate(source, input, updatedAt);
	if (prepared.kind === "rejected") {
		return prepared;
	}

	let project = prepared.project;
	for (const resolution of input.openingResolutions) {
		if (resolution.kind === "delete") {
			project = {
				...project,
				level: {
					...project.level,
					openings: project.level.openings.filter(
						(opening) => opening.openingId !== resolution.openingId,
					),
				},
			};
			continue;
		}
		const wallHosts = wallOpeningHostsForProject(project);
		if (!wallHosts) {
			return {
				kind: "rejected",
				reasonCode: "ROOM_HEIGHT_OPENING_RESOLUTION_INVALID",
			};
		}
		const resized = updateWallOpening(
			{ openings: project.level.openings, wallHosts },
			{ heightMm: resolution.heightMm, openingId: resolution.openingId },
		);
		if (resized.kind === "rejected") {
			return {
				kind: "rejected",
				reasonCode: "ROOM_HEIGHT_OPENING_RESOLUTION_INVALID",
			};
		}
		project = {
			...project,
			level: { ...project.level, openings: resized.openings },
		};
	}

	const rechecked = previewRoomHeightOpeningConflict(project, input);
	return rechecked.kind === "none"
		? { kind: "accepted", project }
		: {
				kind: "rejected",
				reasonCode: "ROOM_HEIGHT_OPENING_RESOLUTION_INVALID",
			};
}

function updateRoomPropertiesCandidate(
	source: Project,
	input: UpdateRoomPropertiesInput,
	updatedAt: string,
): UpdateRoomPropertiesResult {
	const name = input.name?.trim();
	if (name === "") {
		return { kind: "rejected", reasonCode: "ROOM_NAME_REQUIRED" };
	}
	const type = input.type;
	if (!isRoomType(type)) {
		return { kind: "rejected", reasonCode: "ROOM_TYPE_INVALID" };
	}
	if (!isEditableRoomHeight(input.heightMm)) {
		return { kind: "rejected", reasonCode: "ROOM_HEIGHT_INVALID" };
	}
	if (!source.level.rooms.some((room) => room.roomId === input.roomId)) {
		return { kind: "rejected", reasonCode: "ROOM_NOT_FOUND" };
	}

	const project: Project = {
		...source,
		level: {
			...source.level,
			rooms: source.level.rooms.map((room) =>
				room.roomId === input.roomId
					? {
							...room,
							heightMm: input.heightMm,
							...(name === undefined ? {} : { name }),
							type,
						}
					: room,
			),
		},
		updatedAt,
	};
	return { kind: "accepted", project };
}

function isEditableRoomHeight(value: number): boolean {
	return (
		Number.isSafeInteger(value) &&
		value >= ROOM_PROPERTY_HEIGHT_MIN_MM &&
		value <= ROOM_PROPERTY_HEIGHT_MAX_MM
	);
}

function isRoomType(value: string): value is RoomType {
	return roomTypes.includes(value as RoomType);
}

function sameOpeningIds(
	expected: readonly string[],
	actual: readonly string[],
): boolean {
	return (
		expected.length === actual.length &&
		new Set(actual).size === actual.length &&
		expected.every((openingId) => actual.includes(openingId))
	);
}
