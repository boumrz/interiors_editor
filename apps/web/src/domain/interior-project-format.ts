import { type Project, type SupportedSchematicAssetInstance } from "./project";

export const floorFinishIds = ["light-oak", "matte-floor-tile", "plain-floor"] as const;
export const wallFinishIds = ["warm-white-paint", "sand-paint", "muted-green-paint", "neutral-wall-tile"] as const;
export const supportedPresetIds = ["planter", "table-lamp", "book", "vase"] as const;
export const floorCatalogPresetIds = [
	"armchair", "chair", "sofa", "corner-sofa", "ottoman",
	"coffee-table", "table", "desk", "bed", "single-bed",
	"bedside-table", "dresser", "wardrobe", "open-shelf", "tv-stand", "kitchen-floor-unit",
	"washer", "slim-washer", "dryer", "fridge", "dishwasher", "stove",
	"bath", "toilet", "shower", "vanity", "floor-lamp", "rug", "coat-rack",
	...supportedPresetIds,
] as const;

export function projectUsesInteriorDetails(project: {
	readonly level: Project["level"];
	readonly supportedItems?: readonly unknown[];
	readonly assetInstances: readonly { readonly anchorClass: string; readonly catalogPreset?: unknown }[];
}): boolean {
	return Boolean(project.supportedItems?.length ||
		project.level.rooms.some(room => room.floorFinish !== undefined) ||
		project.level.wallSegments.some(wall => wall.profile !== undefined || wall.sideFinishes !== undefined) ||
		project.level.openings.some(opening => opening.kind === "Door" ? opening.variant !== undefined : opening.sections !== undefined) ||
		project.assetInstances.some(asset => asset.anchorClass === "floor" && asset.catalogPreset !== undefined));
}

export function projectUsesCustomWallColors(project: Pick<Project, "level">): boolean {
	return project.level.wallSegments.some(
		({ sideFinishes }) => sideFinishes?.left?.version === 2 || sideFinishes?.right?.version === 2,
	);
}

export function interiorSchemaVersionFor(project: Project): Project["interiorSchemaVersion"] {
	if (projectUsesCustomWallColors(project)) return 2;
	return projectUsesInteriorDetails(project) ? 1 : undefined;
}

type SupportContext = { readonly roomId: string; readonly layoutId?: string };

/** Storage-only witness, derived from the authoritative host before serialization. */
export function supportContextFor(
	item: Pick<SupportedSchematicAssetInstance, "supportAssetInstanceId">,
	project: Pick<Project, "assetInstances">,
): SupportContext {
	const host = project.assetInstances.find(
		(asset) => asset.assetInstanceId === item.supportAssetInstanceId,
	);
	if (host?.anchorClass !== "floor") throw new Error("Unsupported project host");
	return {
		roomId: host.roomId,
		...(host.roomLayoutId === undefined ? {} : { layoutId: host.roomLayoutId }),
	};
}
