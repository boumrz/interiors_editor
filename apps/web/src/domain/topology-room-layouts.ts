import { validateSupportedItems } from "./interior-support";
import { isFloorSchematicAssetInstance, type Project, type RoomLayout } from "./project";

export interface RoomLayoutLineage {
	readonly roomId: string;
	readonly predecessorRoomIds: readonly string[];
}

/** Layout and guest addresses are reconciled only after the topology chooses a target room. */
export function reconcileTopologyRoomLayouts(
	source: Project,
	target: Project,
	lineage: readonly RoomLayoutLineage[],
	ids?: { readonly next: () => string },
): Project | undefined {
	const originalLayouts = source.roomLayouts ?? [];
	if (originalLayouts.length === 0) return supportedGeometryIsValid(target) ? target : undefined;

	const originalLayoutById = new Map(originalLayouts.map((layout) => [layout.layoutId, layout]));
	const lineageByRoom = new Map(lineage.map((entry) => [entry.roomId, entry.predecessorRoomIds]));
	const layoutsByRoom = new Map<string, RoomLayout[]>();
	const allocated = new Set([
		...originalLayoutById.keys(),
		...source.assetInstances.map(({ assetInstanceId }) => assetInstanceId),
		...(source.supportedItems ?? []).map(({ assetInstanceId }) => assetInstanceId),
	]);
	const nextUnique = () => {
		const id = ids?.next();
		if (!id || allocated.has(id)) return undefined;
		allocated.add(id);
		return id;
	};

	for (const { roomId, predecessorRoomIds } of lineage) {
		const originals = predecessorRoomIds.map((id) => originalLayouts.filter((layout) => layout.roomId === id));
		const twoLayoutRooms = originals.filter((layouts) => layouts.length > 1);
		if (twoLayoutRooms.length > 1) return undefined;
		const retained = originalLayouts.filter((layout) => layout.roomId === roomId);
		const slots = twoLayoutRooms[0] ?? (retained.length > 0 ? retained : originals.find((layouts) => layouts.length > 0)) ?? [];
		const layouts: RoomLayout[] = [];
		for (const slot of slots) {
			const inherited = retained.find((layout) => layout.slot === slot.slot) ??
				(predecessorRoomIds.length > 1 ? slot : undefined);
			const layoutId = inherited?.layoutId ?? nextUnique();
			if (!layoutId) return undefined;
			layouts.push({ ...(inherited ?? slot), layoutId, roomId });
		}
		layoutsByRoom.set(roomId, layouts);
	}

	const sourceAssets = new Map(source.assetInstances.map((asset) => [asset.assetInstanceId, asset]));
	const copiesByHostId = new Map<string, string>();
	const assetInstances: Project["assetInstances"][number][] = [];
	for (const asset of target.assetInstances) {
		if (!isFloorSchematicAssetInstance(asset)) {
			assetInstances.push(asset);
			continue;
		}
		const original = sourceAssets.get(asset.assetInstanceId);
		const predecessors = lineageByRoom.get(asset.roomId);
		if (!original || !isFloorSchematicAssetInstance(original) || !predecessors?.includes(original.roomId)) return undefined;

		const layouts = layoutsByRoom.get(asset.roomId) ?? [];
		const originalLayout = original.roomLayoutId === undefined ? undefined : originalLayoutById.get(original.roomLayoutId);
		const chosen = layouts.find((layout) => layout.slot === (originalLayout?.slot ?? "A")) ?? layouts[0];
		const { roomLayoutId: _formerLayoutId, ...placed } = asset;
		assetInstances.push(chosen === undefined ? placed : { ...placed, roomLayoutId: chosen.layoutId });
		const originalHasTwo = originalLayouts.filter((layout) => layout.roomId === original.roomId).length > 1;
		const second = predecessors.length > 1 && !originalHasTwo
			? layouts.find((layout) => layout.layoutId !== chosen?.layoutId)
			: undefined;
		if (second) {
			const copyId = nextUnique();
			if (!copyId) return undefined;
			copiesByHostId.set(asset.assetInstanceId, copyId);
			assetInstances.push({ ...placed, assetInstanceId: copyId, roomLayoutId: second.layoutId });
		}
	}

	const supportedItems: NonNullable<Project["supportedItems"]>[number][] = [];
	for (const guest of target.supportedItems ?? []) {
		supportedItems.push(guest);
		const copiedHost = copiesByHostId.get(guest.supportAssetInstanceId);
		if (!copiedHost) continue;
		const copyId = nextUnique();
		if (!copyId) return undefined;
		supportedItems.push({ ...guest, assetInstanceId: copyId, supportAssetInstanceId: copiedHost });
	}
	const { roomLayouts: _formerLayouts, supportedItems: _formerGuests, ...base } = target;
	const roomLayouts = [...layoutsByRoom.values()].flat();
	const project: Project = {
		...base,
		assetInstances,
		...(roomLayouts.length === 0 ? {} : { roomLayouts }),
		...(supportedItems.length === 0 ? {} : { supportedItems }),
	};
	return supportedGeometryIsValid(project) ? project : undefined;
}

function supportedGeometryIsValid(project: Project): boolean {
	return !project.supportedItems?.length || validateSupportedItems(project);
}
