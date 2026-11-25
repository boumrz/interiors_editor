import { expect, test } from "@rstest/core";
import { isProductMetric } from "./editor-product-metrics";

test("accepts only approved editor metrics and rejects data-bearing or unknown values", () => {
	for (const code of [
		"editor_entry", "project_created", "saved_project_opened", "room_created",
		"backup_prepared", "backup_handoff_requested", "backup_imported",
		"wall_added", "wall_moved", "opening_added", "item_placed", "item_color_changed",
		"view_3d_ready", "undo_committed", "redo_committed",
		"geometry_rejected", "item_collision", "opening_conflict",
		"save_quota", "save_failed", "storage_unavailable", "resource_missing", "resource_corrupt",
		"scene_unavailable", "scene_context_lost", "backup_invalid", "backup_incompatible",
		"backup_import_failed", "backup_export_failed", "backup_handoff_failed",
	]) expect(isProductMetric(code)).toBe(true);
	for (const input of [
		undefined, null, 0, true, {}, ["wall_added"], "unknown", "toString", "__proto__",
		"wall_added ", "WALL_ADDED", "wall_added?name=MyRoom", "wall_added/NewRoom",
	]) expect(isProductMetric(input)).toBe(false);
});
