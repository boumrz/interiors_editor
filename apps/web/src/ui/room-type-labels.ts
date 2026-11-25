import type { RoomType } from "../domain/project";
import { copy } from "./editor-language";

/** One room vocabulary for the directory, plan and conflict choices. */
export const roomTypeLabels: Readonly<Record<RoomType, string>> = {
	get bathroom() {
		return copy("Ванная", "Bathroom");
	},
	get bedroom() {
		return copy("Спальня", "Bedroom");
	},
	get hallway() {
		return copy("Коридор", "Hallway");
	},
	get kitchen() {
		return copy("Кухня", "Kitchen");
	},
	get "living-room"() {
		return copy("Гостиная", "Living room");
	},
	get office() {
		return copy("Кабинет", "Office");
	},
	get other() {
		return copy("Другое", "Other");
	},
	get storage() {
		return copy("Кладовая", "Storage room");
	},
};
