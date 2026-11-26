import { floorCatalogPresetIds, interiorSchemaVersionFor } from "./interior-project-format";
import { alphaParametricItemColorVariantFor, type ItemColorVariantId } from "./item-color-variant";
import { floorFinishColors, isWallFinish } from "./interior-materials";
import { floorDecorPresetFor, isSupportedDecorPreset, supportedItemConflict, supportHostPresetFor, type SupportAddress } from "./interior-support";
import {
	createParametricFloorItem, deleteParametricFloorItem, findRoomForFloorItem,
	floorItemFootprintsCollide, type ParametricFloorItemInput,
} from "./parametric-item";
import type {
	FloorFinishId, FloorSchematicAssetInstance, Project, SupportedSchematicAssetInstance,
	SurfaceFinish, WallFinish, WallSide,
} from "./project";
import { applyRoomLayoutCommand, projectRoomLayoutView, type RoomLayoutCommand, validateRoomLayouts } from "./room-layouts";
import { sameSurfaceFinish } from "./wall-surface-metadata";

const floorPresetIds = new Set<string>(floorCatalogPresetIds);

export function isInteriorFloorPreset(presetId: string): boolean {
	return floorPresetIds.has(presetId);
}

export function normalizeInteriorProject(project: Project): Project {
	const { interiorSchemaVersion, supportedItems, roomLayouts, ...base } = project;
	const version = interiorSchemaVersionFor(project);
	if (interiorSchemaVersion === version
		&& (supportedItems === undefined || supportedItems.length > 0)
		&& (roomLayouts === undefined || roomLayouts.length > 0)) return project;
	return {
		...base,
		...(version === undefined ? {} : { interiorSchemaVersion: version }),
		...(supportedItems?.length ? { supportedItems } : {}),
		...(roomLayouts?.length ? { roomLayouts } : {}),
	};
}

interface FloorTarget {
	readonly roomId: string;
	readonly xMm: number;
	readonly zMm: number;
	readonly yawMilliDeg?: number;
}

export type SupportTarget = SupportAddress | FloorTarget;
type DecorAppearance = Pick<SupportedSchematicAssetInstance, "catalogPreset" | "label" | "color" | "colorVariantId" | "widthMm" | "depthMm" | "heightMm">;
type NewDecor = DecorAppearance & SupportAddress;

export type InteriorCommand =
	| { readonly kind: "set-floor-finish"; readonly roomId: string; readonly finish?: SurfaceFinish<FloorFinishId> }
	| { readonly kind: "set-wall-finish"; readonly wallSegmentId: string; readonly side: WallSide; readonly finish?: WallFinish }
	| { readonly kind: "bind-preset"; readonly assetInstanceId: string; readonly presetId: string }
	| { readonly kind: "place-supported"; readonly item: NewDecor; readonly sourceAssetInstanceId?: string }
	| { readonly kind: "place-decor-on-floor"; readonly item: DecorAppearance; readonly target: FloorTarget; readonly sourceAssetInstanceId?: string }
	| { readonly kind: "move-supported" | "copy-supported"; readonly assetInstanceId: string; readonly target: SupportTarget }
	| { readonly kind: "delete-supported"; readonly assetInstanceId: string }
	| { readonly kind: "set-supported-lock"; readonly assetInstanceId: string; readonly locked: boolean }
	| { readonly kind: "recolor-supported"; readonly assetInstanceId: string; readonly variantId: ItemColorVariantId }
	| { readonly kind: "resize-supported"; readonly assetInstanceId: string; readonly widthMm: number; readonly depthMm: number; readonly heightMm: number }
	| { readonly kind: "delete-furniture"; readonly assetInstanceId: string; readonly rehome?: Readonly<Record<string, SupportTarget>> }
	| { readonly kind: "copy-furniture"; readonly assetInstanceId: string; readonly target: FloorTarget }
	| { readonly kind: "room-layout"; readonly command: RoomLayoutCommand };

export interface InteriorConflict {
	readonly kind: "rejected";
	readonly reasonCode: "INTERIOR_TARGET_INVALID" | "INTERIOR_ITEM_LOCKED" | "INTERIOR_ITEM_CONFLICT" | "INTERIOR_REHOME_REQUIRED";
	readonly conflictAssetInstanceId?: string;
}

export type InteriorMutation =
	| { readonly kind: "accepted"; readonly project: Project; readonly nextActiveLayoutId?: string }
	| { readonly kind: "unchanged"; readonly project: Project }
	| InteriorConflict;

const invalidTarget: InteriorConflict = { kind: "rejected", reasonCode: "INTERIOR_TARGET_INVALID" };

function itemConflict(assetInstanceId: string, reasonCode: InteriorConflict["reasonCode"] = "INTERIOR_ITEM_CONFLICT"): InteriorConflict {
	return { kind: "rejected", reasonCode, conflictAssetInstanceId: assetInstanceId };
}

export function projectInteriorView(project: Project, preferences: ReadonlyMap<string, string>): Project {
	if (!project.roomLayouts?.length) return project;
	const visible = projectRoomLayoutView(project, preferences);
	if (visible.kind !== "accepted") return project;
	const allowedHosts = new Set(visible.assetInstances.map(item => item.assetInstanceId));
	return {
		...project,
		assetInstances: visible.assetInstances,
		...(project.supportedItems === undefined ? {} : {
			supportedItems: project.supportedItems.filter(item => allowedHosts.has(item.supportAssetInstanceId)),
		}),
	};
}

export function selectedInteriorLayoutId(project: Project, roomId: string, preferences: ReadonlyMap<string, string>): string | undefined {
	const visible = projectRoomLayoutView(project, preferences);
	return visible.kind === "accepted" ? visible.activeLayouts.get(roomId)?.layoutId : undefined;
}

function validFloorTarget(project: Project, footprint: ParametricFloorItemInput, ownId?: string): boolean {
	return findRoomForFloorItem(project, footprint) === footprint.roomId
		&& !project.assetInstances.some(other => other.anchorClass === "floor"
			&& other.assetInstanceId !== ownId && other.roomId === footprint.roomId && other.roomLayoutId === footprint.roomLayoutId
			&& floorItemFootprintsCollide(footprint, other));
}

export function applyInteriorCommand(
	project: Project,
	command: InteriorCommand,
	ids: { readonly next: () => string },
	updatedAt: string,
	preferences: ReadonlyMap<string, string> = new Map(),
): InteriorMutation {
	const guests = project.supportedItems ?? [];
	const currentGuest = "assetInstanceId" in command ? guests.find(guest => guest.assetInstanceId === command.assetInstanceId) : undefined;
	if (currentGuest?.locked && command.kind !== "copy-supported" && command.kind !== "set-supported-lock") return itemConflict(currentGuest.assetInstanceId, "INTERIOR_ITEM_LOCKED");
	const used = new Set([...project.assetInstances, ...guests].map(item => item.assetInstanceId));

	const allocate = () => {
		const id = ids.next();
		if (!id || used.has(id)) return undefined;
		used.add(id);
		return id;
	};
	const withGuests = (source: Project, items: readonly SupportedSchematicAssetInstance[]) => ({ ...source, supportedItems: items });
	const mutate = (candidate: Project): InteriorMutation => {
		const conflict = supportedItemConflict(candidate);
		return conflict === undefined && validateRoomLayouts(candidate).kind === "accepted"
			? { kind: "accepted", project: normalizeInteriorProject({ ...candidate, updatedAt }) }
			: itemConflict(conflict ?? "");
	};
	const changed = mutate;
	const existingFloor = (id: string) => project.assetInstances.find(
		(item): item is FloorSchematicAssetInstance => item.anchorClass === "floor" && item.assetInstanceId === id,
	);

	function placeGuest(source: Project, guest: DecorAppearance & { readonly assetInstanceId: string }, target: SupportTarget): Project | undefined {
		if ("supportAssetInstanceId" in target) {
			const host = source.assetInstances.find(item => item.assetInstanceId === target.supportAssetInstanceId);
			if (host?.anchorClass !== "floor" || selectedInteriorLayoutId(source, host.roomId, preferences) !== host.roomLayoutId) return undefined;
			// Once attached, the placement relies on the saved preset instead of the legacy label.
			const catalogPreset = host.catalogPreset === undefined ? supportHostPresetFor(host) : undefined;
			const base = catalogPreset
				? { ...source, assetInstances: source.assetInstances.map(item => item === host ? { ...host, catalogPreset } : item) }
				: source;
			return withGuests(base, [...(source.supportedItems ?? []), {
				...guest, ...target, anchorClass: "support",
				// Canonical JSON stores a single representation of zero.
				offsetXMm: target.offsetXMm + 0, offsetZMm: target.offsetZMm + 0,
				relativeYawMilliDeg: target.relativeYawMilliDeg + 0,
			}]);
		}
		const roomLayoutId = selectedInteriorLayoutId(source, target.roomId, preferences);
		const input = {
			label: guest.label, widthMm: guest.widthMm, heightMm: guest.heightMm, depthMm: guest.depthMm,
			color: guest.color, catalogPreset: guest.catalogPreset,
			...(guest.colorVariantId === undefined ? {} : { colorVariantId: guest.colorVariantId }),
			...target, xMm: target.xMm + 0, zMm: target.zMm + 0,
			...(roomLayoutId === undefined ? {} : { roomLayoutId }),
		};
		if (!validFloorTarget(source, input)) return undefined;
		const scoped = projectInteriorView(source, preferences);
		const result = createParametricFloorItem(scoped, input, { next: () => guest.assetInstanceId }, updatedAt, "reject");
		const floor = result.kind === "accepted" && result.project.assetInstances.at(-1);
		if (!floor || floor.anchorClass !== "floor") return undefined;
		return {
			...source,
			assetInstances: [...source.assetInstances, floor],
		};
	}

	switch (command.kind) {
		case "set-floor-finish": {
			const room = project.level.rooms.find(value => value.roomId === command.roomId);
			const finish = command.finish;
			if (!room || (finish && (finish.version !== 1 || !Object.hasOwn(floorFinishColors, finish.presetId)))) return invalidTarget;
			if (room.floorFinish?.presetId === finish?.presetId) return { kind: "unchanged", project };
			const { floorFinish: _, ...base } = room;
			const next = finish ? { ...base, floorFinish: finish } : base;
			return changed({ ...project, level: { ...project.level, rooms: project.level.rooms.map(item => item === room ? next : item) } });
		}
		case "set-wall-finish": {
			const wall = project.level.wallSegments.find(value => value.wallSegmentId === command.wallSegmentId);
			const { side, finish } = command;
			if (!wall || (side !== "left" && side !== "right")
				|| (finish !== undefined && !isWallFinish(finish))) return invalidTarget;
			if (sameSurfaceFinish(wall.sideFinishes?.[side], finish)) return { kind: "unchanged", project };
			const { sideFinishes: old, ...base } = wall;
			const sides = { ...old };
			if (finish) sides[side] = finish;
			else delete sides[side];
			const next = sides.left || sides.right ? { ...base, sideFinishes: sides } : base;
			return changed({ ...project, level: { ...project.level, wallSegments: project.level.wallSegments.map(item => item === wall ? next : item) } });
		}
		case "bind-preset": {
			const item = existingFloor(command.assetInstanceId);
			if (!item || item.assetDefinitionId !== undefined || !isInteriorFloorPreset(command.presetId)) return invalidTarget;
			if (item.locked) return itemConflict(item.assetInstanceId, "INTERIOR_ITEM_LOCKED");
			if (item.catalogPreset?.presetId === command.presetId) return { kind: "unchanged", project };
			return changed({ ...project, assetInstances: project.assetInstances.map(value => value === item
				? { ...item, catalogPreset: { presetId: command.presetId, version: 1 } } : value) });
		}
		case "place-supported":
		case "place-decor-on-floor": {
			const source = command.sourceAssetInstanceId === undefined ? undefined : existingFloor(command.sourceAssetInstanceId);
			const newPreset = command.item.catalogPreset?.presetId;
			if (!newPreset || !isSupportedDecorPreset(newPreset) || (command.sourceAssetInstanceId !== undefined &&
				(!source || floorDecorPresetFor(source)?.presetId !== newPreset))) return invalidTarget;
			if (source?.locked) return itemConflict(source.assetInstanceId, "INTERIOR_ITEM_LOCKED");
			const id = source?.assetInstanceId ?? allocate();
			if (!id) return invalidTarget;
			const original = source ? {
				label: source.label, color: source.color,
				...(source.colorVariantId === undefined ? {} : { colorVariantId: source.colorVariantId }),
				widthMm: source.widthMm, depthMm: source.depthMm, heightMm: source.heightMm,
			} : {};
			const guest = { ...command.item, ...original, assetInstanceId: id };
			const target = command.kind === "place-supported" ? command.item : command.target;
			const base = source ? { ...project, assetInstances: project.assetInstances.filter(item => item !== source) } : project;
			const candidate = placeGuest(base, guest, target);
			return candidate ? changed(candidate) : invalidTarget;
		}
		case "move-supported":
		case "copy-supported": {
			if (!currentGuest) return invalidTarget;
			const id = command.kind === "copy-supported" ? allocate() : currentGuest.assetInstanceId;
			if (!id) return invalidTarget;
			const { locked: _, ...unlocked } = currentGuest;
			const guest = { ...unlocked, assetInstanceId: id };
			const source = command.kind === "copy-supported" ? project : withGuests(project, guests.filter(item => item !== currentGuest));
			const candidate = placeGuest(source, guest, command.target);
			return candidate ? changed(candidate) : itemConflict(currentGuest.assetInstanceId);
		}
		case "delete-supported":
			return currentGuest ? changed(withGuests(project, guests.filter(item => item !== currentGuest))) : invalidTarget;
		case "set-supported-lock": {
			if (!currentGuest) return invalidTarget;
			if (Boolean(currentGuest.locked) === command.locked) return { kind: "unchanged", project };
			const { locked: _, ...unlocked } = currentGuest;
			const next: SupportedSchematicAssetInstance = command.locked ? { ...unlocked, locked: true } : unlocked;
			return changed(withGuests(project, guests.map(item => item === currentGuest ? next : item)));
		}
		case "resize-supported":
		case "recolor-supported": {
			if (!currentGuest) return invalidTarget;
			const variant = command.kind === "recolor-supported" ? alphaParametricItemColorVariantFor(command.variantId) : undefined;
			if (command.kind === "recolor-supported" && !variant) return invalidTarget;
			const next = command.kind === "resize-supported" ? {
				...currentGuest, widthMm: command.widthMm, depthMm: command.depthMm, heightMm: command.heightMm,
			} : { ...currentGuest, color: variant?.color ?? currentGuest.color, colorVariantId: command.variantId };
			return changed(withGuests(project, guests.map(item => item === currentGuest ? next : item)));
		}
		case "delete-furniture": {
			const host = existingFloor(command.assetInstanceId);
			if (!host) return invalidTarget;
			const children = guests.filter(item => item.supportAssetInstanceId === host.assetInstanceId);
			const locked = (host.locked ? host : children.find(item => item.locked));
			if (locked) return itemConflict(locked.assetInstanceId, "INTERIOR_ITEM_LOCKED");
			const removed = deleteParametricFloorItem(project, { assetInstanceId: host.assetInstanceId }, updatedAt);
			if (removed.kind !== "accepted") return invalidTarget;
			let candidate: Project = withGuests(removed.project, guests.filter(item => item.supportAssetInstanceId !== host.assetInstanceId));
			if (command.rehome !== undefined) {
				for (const guest of children) {
					const target = command.rehome[guest.assetInstanceId];
					const next = target && placeGuest(candidate, guest, target);
					if (!next) return itemConflict(guest.assetInstanceId, "INTERIOR_REHOME_REQUIRED");
					candidate = next;
				}
			}
			return changed(candidate);
		}
		case "copy-furniture": {
			const source = existingFloor(command.assetInstanceId);
			const id = allocate();
			if (!source || !id) return invalidTarget;
			const { locked: _, roomLayoutId: __, yawStep: ___, yawRadians: ____, ...unlocked } = source;
			const layoutId = selectedInteriorLayoutId(project, command.target.roomId, preferences);
			const copy = {
				...unlocked, ...command.target, assetInstanceId: id,
				...(layoutId === undefined ? {} : { roomLayoutId: layoutId }),
			};
			if (!validFloorTarget(project, copy)) return itemConflict(source.assetInstanceId);
			const copies: SupportedSchematicAssetInstance[] = [];
			for (const guest of guests.filter(item => item.supportAssetInstanceId === source.assetInstanceId)) {
				const newId = allocate();
				if (!newId) return invalidTarget;
				const { locked: _, ...unlockedGuest } = guest;
				copies.push({ ...unlockedGuest, assetInstanceId: newId, supportAssetInstanceId: id });
			}
			return changed({ ...project, assetInstances: [...project.assetInstances, copy], supportedItems: [...guests, ...copies] });
		}
		case "room-layout": {
			const result = applyRoomLayoutCommand(project, command.command, ids, updatedAt);
			if (result.kind === "rejected") return invalidTarget;
			if (result.kind === "unchanged") return result;
			const accepted = mutate(result.project);
			return accepted.kind === "accepted" && result.nextActiveLayoutId !== undefined
				? { ...accepted, nextActiveLayoutId: result.nextActiveLayoutId } : accepted;
		}
	}
}

export function supportedGuestsFor(project: Project, assetInstanceId: string): readonly SupportedSchematicAssetInstance[] {
	return (project.supportedItems ?? []).filter(item => item.supportAssetInstanceId === assetInstanceId);
}
