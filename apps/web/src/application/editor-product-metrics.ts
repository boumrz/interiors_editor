const productMetrics = [
	"editor_entry",
	"project_created",
	"saved_project_opened",
	"room_created",
	"backup_prepared",
	"backup_handoff_requested",
	"backup_imported",
	"wall_added",
	"wall_moved",
	"opening_added",
	"item_placed",
	"item_color_changed",
	"view_3d_ready",
	"undo_committed",
	"redo_committed",
	"geometry_rejected",
	"item_collision",
	"opening_conflict",
	"save_quota",
	"save_failed",
	"storage_unavailable",
	"resource_missing",
	"resource_corrupt",
	"scene_unavailable",
	"scene_context_lost",
	"backup_invalid",
	"backup_incompatible",
	"backup_import_failed",
	"backup_export_failed",
	"backup_handoff_failed",
] as const;

export type ProductMetric = (typeof productMetrics)[number];
export type ProductMetricSink = (metric: ProductMetric) => void;

const knownCodes = new Set<string>(productMetrics);

export function isProductMetric(value: unknown): value is ProductMetric {
	return typeof value === "string" && knownCodes.has(value);
}
