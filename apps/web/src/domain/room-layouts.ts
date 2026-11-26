import {
	type FloorSchematicAssetInstance,
	isFloorSchematicAssetInstance,
	type Project,
	type WallSchematicAssetInstance,
} from "./project";
import { validateProjectName } from "./project-name-policy";
import { isSha256ResourceHash } from "./resource-hash";
import { hasOnlyUnicodeScalarValues } from "./unicode-scalar-values";

type RoomLayoutSlot = "A" | "B";

interface RoomLayoutViewEntry {
	readonly layoutId?: string;
	readonly name: string;
	readonly roomId: string;
	readonly slot: RoomLayoutSlot;
}

export interface RoomLayout extends RoomLayoutViewEntry {
	readonly layoutId: string;
}

type RoomLayoutFloorItem = FloorSchematicAssetInstance & {
	readonly roomLayoutId?: string;
};

type RoomLayoutAsset = RoomLayoutFloorItem | WallSchematicAssetInstance;

/** Local candidate model. Publication requires the AD-40 codec and fencing. */
export interface RoomLayoutProject extends Project {
	readonly assetInstances: readonly RoomLayoutAsset[];
	readonly roomLayouts?: readonly RoomLayout[];
}

export type RoomLayoutCommand =
	| { readonly kind: "create-second"; readonly roomId: string }
	| { readonly kind: "rename"; readonly layoutId?: string; readonly name: string; readonly roomId: string }
	| { readonly kind: "delete"; readonly layoutId: string; readonly roomId: string };

type RoomLayoutStateRejection = {
	readonly kind: "rejected";
	readonly reasonCode: "ROOM_LAYOUT_STATE_INVALID";
};

type RoomLayoutCommandResult =
	| {
			readonly kind: "accepted";
			readonly project: RoomLayoutProject;
			readonly nextActiveLayoutId?: string;
	  }
	| { readonly kind: "unchanged"; readonly project: RoomLayoutProject }
	| RoomLayoutStateRejection
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "ROOM_LAYOUT_ID_CONFLICT"
				| "ROOM_LAYOUT_LAST"
				| "ROOM_LAYOUT_LIMIT"
				| "ROOM_LAYOUT_NAME_INVALID"
				| "ROOM_LAYOUT_NOT_FOUND"
				| "ROOM_LAYOUT_ROOM_NOT_FOUND";
	  };

export type RoomLayoutView = {
	readonly kind: "accepted";
	readonly activeLayouts: ReadonlyMap<string, RoomLayoutViewEntry>;
	readonly assetInstances: readonly RoomLayoutAsset[];
};

const invalidState = { kind: "rejected", reasonCode: "ROOM_LAYOUT_STATE_INVALID" } as const;

function validId(value: string): boolean {
	return value.trim().length > 0 && hasOnlyUnicodeScalarValues(value);
}

function defaultName(slot: RoomLayoutSlot): string {
	return `Вариант ${slot}`;
}

function isFloorItem(item: RoomLayoutAsset): item is RoomLayoutFloorItem {
	return isFloorSchematicAssetInstance(item);
}

function roomLayoutIndex(project: RoomLayoutProject): Map<string, RoomLayout[]> | undefined {
	const rooms = new Map(project.level.rooms.map(room => [room.roomId, [] as RoomLayout[]]));
	if (rooms.size !== project.level.rooms.length) return undefined;

	const layoutsById = new Map<string, RoomLayout>();
	for (const layout of project.roomLayouts ?? []) {
		const roomLayouts = rooms.get(layout.roomId);
		const name = validateProjectName(layout.name);
		if (
			!roomLayouts ||
			!validId(layout.layoutId) ||
			layoutsById.has(layout.layoutId) ||
			(layout.slot !== "A" && layout.slot !== "B") ||
			roomLayouts.some(existing => existing.slot === layout.slot) ||
			name.kind !== "valid" ||
			name.name !== layout.name
		) return undefined;
		roomLayouts.push(layout);
		layoutsById.set(layout.layoutId, layout);
	}

	const definitionIds = new Set<string>();
	const resourceLengths = new Map<string, number>();
	for (const definition of project.assetDefinitionRefs) {
		const knownLength = resourceLengths.get(definition.resourceHash);
		if (
			!validId(definition.assetDefinitionId) ||
			definitionIds.has(definition.assetDefinitionId) ||
			!isSha256ResourceHash(definition.resourceHash) ||
			!Number.isSafeInteger(definition.byteLength) ||
			definition.byteLength <= 0 ||
			(knownLength !== undefined && knownLength !== definition.byteLength)
		) return undefined;
		definitionIds.add(definition.assetDefinitionId);
		resourceLengths.set(definition.resourceHash, definition.byteLength);
	}

	const assetIds = new Set<string>();
	for (const item of project.assetInstances) {
		if (
			!validId(item.assetInstanceId) ||
			assetIds.has(item.assetInstanceId) ||
			(item.assetDefinitionId !== undefined && !definitionIds.has(item.assetDefinitionId))
		) return undefined;
		assetIds.add(item.assetInstanceId);
		if (!isFloorItem(item)) {
			if ("roomLayoutId" in item) return undefined;
			continue;
		}
		const roomLayouts = rooms.get(item.roomId);
		if (!roomLayouts) return undefined;
		if (item.roomLayoutId === undefined) {
			if (roomLayouts.length > 0) return undefined;
		} else if (layoutsById.get(item.roomLayoutId)?.roomId !== item.roomId) {
			return undefined;
		}
	}
	return rooms;
}

export function validateRoomLayouts(
	project: RoomLayoutProject,
): { readonly kind: "accepted" } | RoomLayoutStateRejection {
	return roomLayoutIndex(project) ? { kind: "accepted" } : invalidState;
}

/** Projection for selection, rendering and collision queries. Keep the source for writes. */
export function projectRoomLayoutView(
	project: RoomLayoutProject,
	preferredLayoutIds: ReadonlyMap<string, string>,
): RoomLayoutView | RoomLayoutStateRejection {
	const rooms = roomLayoutIndex(project);
	if (!rooms) return invalidState;
	const activeLayouts = new Map<string, RoomLayoutViewEntry>();
	for (const [roomId, layouts] of rooms) {
		const preferredId = preferredLayoutIds.get(roomId);
		const selected = layouts.find(layout => layout.layoutId === preferredId)
			?? layouts.find(layout => layout.slot === "A")
			?? layouts[0]
			?? { name: defaultName("A"), roomId, slot: "A" };
		activeLayouts.set(roomId, selected);
	}
	return {
		kind: "accepted",
		activeLayouts,
		assetInstances: project.assetInstances.filter(item =>
			!isFloorItem(item) || item.roomLayoutId === activeLayouts.get(item.roomId)?.layoutId,
		),
	};
}

/** Match the current backup contract: preserve definition keys and exact hash spellings. */
export function requiredRoomLayoutResourceHashes(project: RoomLayoutProject): readonly string[] {
	return [...new Set(project.assetDefinitionRefs.map(definition => definition.resourceHash))];
}

/** Draft a whole-Project candidate from the last Durable snapshot. */
export function applyRoomLayoutCommand(
	project: RoomLayoutProject,
	command: RoomLayoutCommand,
	ids: { readonly next: () => string },
	updatedAt: string,
): RoomLayoutCommandResult {
	const rooms = roomLayoutIndex(project);
	if (!rooms) return invalidState;
	const layouts = rooms.get(command.roomId);
	if (!layouts) return { kind: "rejected", reasonCode: "ROOM_LAYOUT_ROOM_NOT_FOUND" };
	const persistedLayouts = project.roomLayouts ?? [];

	if (command.kind === "delete") {
		if (!layouts.some(layout => layout.layoutId === command.layoutId)) {
			return { kind: "rejected", reasonCode: "ROOM_LAYOUT_NOT_FOUND" };
		}
		const survivor = layouts.find(layout => layout.layoutId !== command.layoutId);
		if (!survivor) return { kind: "rejected", reasonCode: "ROOM_LAYOUT_LAST" };
		return {
			kind: "accepted",
			nextActiveLayoutId: survivor.layoutId,
			project: {
				...project,
				assetInstances: project.assetInstances.filter(item =>
					!isFloorItem(item) || item.roomLayoutId !== command.layoutId,
				),
				...(project.supportedItems === undefined ? {} : {
					supportedItems: project.supportedItems.filter(guest => !project.assetInstances.some(item =>
						isFloorItem(item) && item.roomLayoutId === command.layoutId && item.assetInstanceId === guest.supportAssetInstanceId,
					)),
				}),
				roomLayouts: persistedLayouts.filter(layout => layout.layoutId !== command.layoutId),
				updatedAt,
			},
		};
	}

	const usedIds = new Set([
		...persistedLayouts.map(layout => layout.layoutId),
		...project.assetInstances.map(item => item.assetInstanceId),
		...(project.supportedItems ?? []).map(item => item.assetInstanceId),
	]);
	const allocateId = () => {
		const id = ids.next();
		if (!validId(id) || usedIds.has(id)) return undefined;
		usedIds.add(id);
		return id;
	};
	const materialize = (layoutId: string) => project.assetInstances.map(item =>
		isFloorItem(item) && item.roomId === command.roomId ? { ...item, roomLayoutId: layoutId } : item,
	);

	if (command.kind === "rename") {
		const current = layouts.find(layout => layout.layoutId === command.layoutId);
		if (!current && (layouts.length > 0 || command.layoutId !== undefined)) {
			return { kind: "rejected", reasonCode: "ROOM_LAYOUT_NOT_FOUND" };
		}
		const name = validateProjectName(command.name);
		if (name.kind !== "valid") return { kind: "rejected", reasonCode: "ROOM_LAYOUT_NAME_INVALID" };
		if (name.name === (current?.name ?? defaultName("A"))) return { kind: "unchanged", project };
		if (current) {
			return {
				kind: "accepted",
				project: {
					...project,
					roomLayouts: persistedLayouts.map(layout =>
						layout.layoutId === current.layoutId ? { ...layout, name: name.name } : layout,
					),
					updatedAt,
				},
			};
		}
		const layoutId = allocateId();
		if (!layoutId) return { kind: "rejected", reasonCode: "ROOM_LAYOUT_ID_CONFLICT" };
		return {
			kind: "accepted",
			project: {
				...project,
				assetInstances: materialize(layoutId),
				roomLayouts: [...persistedLayouts, { layoutId, name: name.name, roomId: command.roomId, slot: "A" }],
				updatedAt,
			},
		};
	}

	if (layouts.length === 2) return { kind: "rejected", reasonCode: "ROOM_LAYOUT_LIMIT" };
	const current = layouts[0];
	const sourceId = current?.layoutId ?? allocateId();
	const cloneId = allocateId();
	if (!sourceId || !cloneId) return { kind: "rejected", reasonCode: "ROOM_LAYOUT_ID_CONFLICT" };
	const originals = current ? project.assetInstances : materialize(sourceId);
	const copies: RoomLayoutFloorItem[] = [];
	const copiedHostIds = new Map<string, string>();
	for (const item of originals) {
		if (!isFloorItem(item) || item.roomLayoutId !== sourceId) continue;
		const assetInstanceId = allocateId();
		if (!assetInstanceId) return { kind: "rejected", reasonCode: "ROOM_LAYOUT_ID_CONFLICT" };
		copies.push({ ...item, assetInstanceId, roomLayoutId: cloneId });
		copiedHostIds.set(item.assetInstanceId, assetInstanceId);
	}
	const supportedCopies = [];
	for (const guest of project.supportedItems ?? []) {
		const hostId = copiedHostIds.get(guest.supportAssetInstanceId);
		if (!hostId) continue;
		const assetInstanceId = allocateId();
		if (!assetInstanceId) return { kind: "rejected", reasonCode: "ROOM_LAYOUT_ID_CONFLICT" };
		supportedCopies.push({ ...guest, assetInstanceId, supportAssetInstanceId: hostId });
	}
	const source: RoomLayout = current ?? {
		layoutId: sourceId,
		name: defaultName("A"),
		roomId: command.roomId,
		slot: "A",
	};
	const nextSlot = source.slot === "A" ? "B" : "A";
	const clone: RoomLayout = {
		layoutId: cloneId,
		name: defaultName(nextSlot),
		roomId: command.roomId,
		slot: nextSlot,
	};
	return {
		kind: "accepted",
		nextActiveLayoutId: cloneId,
		project: {
			...project,
			assetInstances: [...originals, ...copies],
			...(project.supportedItems === undefined ? {} : {
				supportedItems: [...project.supportedItems, ...supportedCopies],
			}),
			roomLayouts: current ? [...persistedLayouts, clone] : [...persistedLayouts, source, clone],
			updatedAt,
		},
	};
}
