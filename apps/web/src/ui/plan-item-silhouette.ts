export type PlanItemSilhouetteKind =
	| "bed"
	| "chair"
	| "generic"
	| "sofa"
	| "storage"
	| "table";

/**
 * Relative SVG paths inside a 100×100 item envelope. The enclosing footprint
 * remains authoritative for size and collision; these are line-only cues for
 * reading a plan at a glance.
 */
export function planItemSilhouettePathsFor(
	kind: PlanItemSilhouetteKind,
): readonly string[] {
	switch (kind) {
		case "sofa":
			return [
				"M 7 16 H 93",
				"M 7 34 H 93",
				"M 23 34 V 85",
				"M 77 34 V 85",
			];
		case "chair":
			return ["M 18 18 H 82 V 82 H 18 Z", "M 27 18 V 38 H 73 V 18"];
		case "table":
			return ["M 12 12 H 88 V 88 H 12 Z", "M 22 22 H 78 V 78 H 22 Z"];
		case "bed":
			return ["M 0 24 H 100", "M 12 24 V 47 H 88 V 24", "M 12 55 H 88"];
		case "storage":
			return ["M 33 0 V 100", "M 67 0 V 100", "M 33 50 H 67"];
		case "generic":
			return [];
	}
}

/**
 * Keeps the 2D editor readable as a floor drawing without making the plan a
 * second asset-modeling system. The label already travels with every durable
 * catalog/custom instance, so this only selects an illustrative silhouette.
 */
export function planItemSilhouetteKindFor(label: string): PlanItemSilhouetteKind {
	const normalized = label.toLocaleLowerCase("ru-RU");
	if (/стол|table/.test(normalized)) return "table";
	if (/стул|кресл|chair|armchair/.test(normalized)) return "chair";
	if (/кроват|bed/.test(normalized)) return "bed";
	if (/шкаф|комод|тумб|storage|cabinet|wardrobe|dresser/.test(normalized)) {
		return "storage";
	}
	if (/диван|sofa|couch|seating/.test(normalized)) return "sofa";
	return "generic";
}
