import { catalogDecorModels } from "./catalog-decor-models";
import { catalogSeatingModels } from "./catalog-seating-models";
import { catalogCaseworkModels } from "./catalog-casework-models";
import { catalogFixtures } from "./catalog-fixture-models";
import { catalogPartBuilder } from "./catalog-model-parts";
import type { SceneBox } from "./rectangular-room-projection";

const models = { ...catalogDecorModels,
	...catalogSeatingModels,
	...catalogCaseworkModels,
	...catalogFixtures,
};
type CatalogPresetId = keyof typeof models;
export type CatalogFurnitureKind = `catalog:${CatalogPresetId}`;

function isCatalogPresetId(id: string): id is CatalogPresetId {
	return Object.hasOwn(models, id);
}

export function catalogFurnitureKindForPreset(
	id: string,
): CatalogFurnitureKind | undefined {
	return isCatalogPresetId(id) ? `catalog:${id}` : undefined;
}

export function catalogPartsFor(item: SceneBox, kind: string) {
	if (!kind.startsWith("catalog:")) return undefined;
	const id = kind.slice("catalog:".length);
	return isCatalogPresetId(id)
		? models[id](catalogPartBuilder(item))
		: undefined;
}

export function furnitureFrontFacesNegativeZ(
	kind: string | undefined,
): boolean {
	return (
		kind === "two-seat-sofa" ||
		kind === "sofa" ||
		kind === "chair" ||
		kind === "bed" ||
		kind === "catalog:armchair" ||
		kind === "catalog:chair" ||
		kind === "catalog:bed" ||
		kind === "catalog:single-bed"
	);
}
