import type { AssetAnchorClass } from "../domain/asset-placement";
import type {
	CatalogResourceDescriptor,
	VersionedCatalogAsset,
	VersionedCatalogPublication,
} from "../application/ports";
import { copy } from "./editor-language";

export type CatalogSection =
	| "accessories"
	| "appliances-electronics"
	| "furniture"
	| "lighting"
	| "plumbing";

export interface CatalogSectionDefinition {
	readonly icon: string;
	readonly id: CatalogSection;
	readonly label: string;
}

/** Alpha browse taxonomy. Empty sections stay visible instead of inventing assets. */
export const catalogSections: readonly CatalogSectionDefinition[] = [
	{
		icon: "▱",
		id: "furniture",
		get label() {
			return copy("Мебель", "Furniture");
		},
	},
	{
		icon: "◉",
		id: "plumbing",
		get label() {
			return copy("Сантехника", "Plumbing");
		},
	},
	{
		icon: "▣",
		id: "appliances-electronics",
		get label() {
			return copy("Техника и электроника", "Appliances & electronics");
		},
	},
	{
		icon: "✦",
		id: "lighting",
		get label() {
			return copy("Освещение", "Lighting");
		},
	},
	{
		icon: "◇",
		id: "accessories",
		get label() {
			return copy("Аксессуары", "Accessories");
		},
	},
];

export interface PreloadedGlbCatalogAsset {
	readonly anchorClass: AssetAnchorClass;
	/** Present only when this card comes from a verified VersionedCatalogPublication. */
	readonly catalogAssetId?: string;
	readonly catalogEnvelopeHash?: string;
	readonly catalogVersion?: string;
	readonly category: VersionedCatalogAsset["category"];
	readonly depthMm: number;
	readonly heightMm: number;
	readonly id: string;
	readonly label: string;
	readonly resource?: CatalogResourceDescriptor;
	readonly resourceUrl: string;
	readonly section: CatalogSection;
	readonly thumbnail?: CatalogResourceDescriptor;
	readonly thumbnailUrl: string;
	readonly variantCount?: number;
	readonly widthMm: number;
}

export interface PreloadedGlbCatalogFilter {
	readonly query: string;
	readonly section: CatalogSection | "all";
}

/**
 * Curated, application-owned catalogue resources. The compact thumbnail is
 * available immediately; exact GLB bytes are requested only for a deliberate
 * placement and then pinned into the user's local Project resource store.
 */
export const preloadedGlbCatalogAssets: readonly PreloadedGlbCatalogAsset[] = [
	{
		anchorClass: "floor",
		category: "seating",
		depthMm: 2221,
		heightMm: 944,
		id: "antique-sofa",
		label: "Антикварный кожаный диван",
		resourceUrl: "/catalog/antique-leather-sofa.glb",
		section: "furniture",
		thumbnailUrl: "/catalog/antique-leather-sofa.png",
		widthMm: 3445,
	},
	{
		anchorClass: "floor",
		category: "seating",
		depthMm: 814,
		heightMm: 828,
		id: "dining-armchair",
		label: "Обеденное кресло",
		resourceUrl: "/catalog/dining-armchair.glb",
		section: "furniture",
		thumbnailUrl: "/catalog/dining-armchair.png",
		widthMm: 831,
	},
	{
		anchorClass: "floor",
		category: "seating",
		depthMm: 709,
		heightMm: 1525,
		id: "ruined-chair",
		label: "Фактурное кресло",
		resourceUrl: "/catalog/ruined-chair.glb",
		section: "furniture",
		thumbnailUrl: "/catalog/ruined-chair.png",
		widthMm: 751,
	},
	{
		anchorClass: "floor",
		category: "sleep",
		depthMm: 1075,
		heightMm: 426,
		id: "single-bed",
		label: "Кровать",
		resourceUrl: "/catalog/single-bed.glb",
		section: "furniture",
		thumbnailUrl: "/catalog/single-bed.png",
		widthMm: 1769,
	},
	{
		anchorClass: "floor",
		category: "storage",
		depthMm: 600,
		heightMm: 2200,
		id: "scandinavian-closet",
		label: "Шкаф в скандинавском стиле",
		resourceUrl: "/catalog/scandinavian-closet.glb",
		section: "furniture",
		thumbnailUrl: "/catalog/scandinavian-closet.png",
		widthMm: 1200,
	},
];

const catalogCategorySearchTerms: Record<
	VersionedCatalogAsset["category"],
	string
> = {
	accessory: "аксессуары accessories",
	appliance: "техника appliance",
	electronics: "электроника electronics",
	lighting: "освещение lighting",
	plumbing: "сантехника plumbing",
	seating: "сиденья seating",
	sleep: "сон sleep",
	storage: "хранение storage",
	tables: "столы tables",
};

const catalogAnchorClassSearchTerms: Record<AssetAnchorClass, string> = {
	floor: "пол напольный floor",
	wall: "стена настенный wall",
};

const catalogSectionSearchTerms: Record<CatalogSection, string> = {
	accessories: "аксессуары accessories",
	"appliances-electronics":
		"техника электроника бытовая техника appliances electronics",
	furniture: "мебель furniture",
	lighting: "освещение свет lighting",
	plumbing: "сантехника plumbing",
};

const englishCatalogNames = new Map([
	["antique-sofa", "Antique leather sofa"],
	["dining-armchair", "Dining armchair"],
	["ruined-chair", "Textured armchair"],
	["single-bed", "Bed"],
	["scandinavian-closet", "Scandinavian wardrobe"],
]);

export function preloadedGlbCatalogLabelForDisplay(
	asset: Pick<PreloadedGlbCatalogAsset, "id" | "label">,
): string {
	return copy(asset.label, englishCatalogNames.get(asset.id) ?? asset.label);
}

export function filterPreloadedGlbCatalogAssets(
	assets: readonly PreloadedGlbCatalogAsset[],
	filter: PreloadedGlbCatalogFilter,
): readonly PreloadedGlbCatalogAsset[] {
	const query = filter.query.trim().toLocaleLowerCase("ru");
	return assets.filter((asset) => {
		if (filter.section !== "all" && filter.section !== asset.section) {
			return false;
		}
		if (query === "") return true;
		return [
			asset.label,
			englishCatalogNames.get(asset.id),
			asset.category,
			catalogCategorySearchTerms[asset.category],
			asset.section,
			catalogSectionSearchTerms[asset.section],
			asset.anchorClass,
			catalogAnchorClassSearchTerms[asset.anchorClass],
			asset.widthMm,
			asset.depthMm,
			asset.heightMm,
		]
			.join(" ")
			.toLocaleLowerCase("ru")
			.includes(query);
	});
}

const withdrawnAssetIds = new Set([
	"kursi-armchair",
	"wooden-cabinet",
	"zen-dining-chair",
]);

/** An older cached publication may still advertise a withdrawn model. */
export function catalogAssetsFromPublication(
	publication: VersionedCatalogPublication,
): readonly PreloadedGlbCatalogAsset[] {
	return publication.assets
		.filter((asset) => !withdrawnAssetIds.has(asset.assetId))
		.map((asset) => ({
			anchorClass: asset.anchorClass,
			catalogAssetId: asset.assetId,
			catalogEnvelopeHash: publication.envelopeHash,
			catalogVersion: publication.catalogVersion,
			category: asset.category,
			depthMm: asset.dimensionsMm.depth,
			heightMm: asset.dimensionsMm.height,
			id: asset.assetId,
			label: asset.label,
			resource: asset.resource,
			resourceUrl: catalogResourceUrl(asset.resource.sha256),
			section: asset.section,
			...(asset.thumbnail ? { thumbnail: asset.thumbnail } : {}),
			thumbnailUrl: asset.thumbnail
				? catalogResourceUrl(asset.thumbnail.sha256)
				: "",
			variantCount: asset.variantSlots.reduce(
				(count, slot) => count + slot.variants.length,
				0,
			),
			widthMm: asset.dimensionsMm.width,
		}));
}

function catalogResourceUrl(hash: string): string {
	return `/catalog-api/v1/resources/sha256/${hash}`;
}
