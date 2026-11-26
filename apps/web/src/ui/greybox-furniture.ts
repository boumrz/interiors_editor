/**
 * Local procedural placeholders only. They deliberately carry no remote asset
 * identity or resource bytes, so choosing one is still just a parametric item
 * draft until the user places it on the plan.
 */
export interface GreyboxFurniturePreset {
	readonly category: GreyboxFurnitureCategory;
  readonly color: string;
  readonly depthMm: string;
  readonly heightMm: string;
  readonly id: 'bed' | 'bedside-table' | 'chair' | 'dresser' | 'sofa' | 'table' | 'wardrobe';
  readonly label: string;
  readonly widthMm: string;
}

/** Honest local grouping for procedural furniture; never a remote SKU category. */
export type GreyboxFurnitureCategory =
	| "seating"
	| "sleep"
	| "storage"
	| "tables";

export interface GreyboxFurnitureFilter {
	readonly category: GreyboxFurnitureCategory | "all";
	readonly query: string;
}

export const greyboxFurniturePresets: readonly GreyboxFurniturePreset[] = [
  { category: 'tables', color: '#a76a3b', depthMm: '700', heightMm: '750', id: 'table', label: 'Стол', widthMm: '1200' },
  { category: 'seating', color: '#416b91', depthMm: '500', heightMm: '900', id: 'chair', label: 'Стул', widthMm: '500' },
  { category: 'sleep', color: '#716796', depthMm: '2000', heightMm: '500', id: 'bed', label: 'Кровать', widthMm: '1600' },
  { category: 'sleep', color: '#8c6e4c', depthMm: '400', heightMm: '600', id: 'bedside-table', label: 'Тумбочка', widthMm: '500' },
  { category: 'storage', color: '#835a45', depthMm: '500', heightMm: '900', id: 'dresser', label: 'Комод', widthMm: '1200' },
  { category: 'storage', color: '#536d62', depthMm: '600', heightMm: '2200', id: 'wardrobe', label: 'Шкаф', widthMm: '1200' },
  { category: 'seating', color: '#536d62', depthMm: '900', heightMm: '850', id: 'sofa', label: 'Диван', widthMm: '2200' }
];

/**
 * Searches the local declared index only. A query never invokes a gateway or
 * manufactures a fallback asset, keeping the offline catalogue honest.
 */
export function filterGreyboxFurniturePresets(
	presets: readonly GreyboxFurniturePreset[],
	filter: GreyboxFurnitureFilter,
): readonly GreyboxFurniturePreset[] {
	const query = filter.query.trim().toLocaleLowerCase("ru");
	return presets.filter((preset) => {
		if (filter.category !== "all" && preset.category !== filter.category) {
			return false;
		}
		if (query === "") return true;
		const searchable = [
			preset.label,
			preset.widthMm,
			preset.depthMm,
			preset.heightMm,
		].join(" ").toLocaleLowerCase("ru");
		return searchable.includes(query);
	});
}
