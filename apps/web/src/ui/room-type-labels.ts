import type { RoomType } from "../domain/project";

/** One room vocabulary for the directory, plan and conflict choices. */
export const roomTypeLabels: Readonly<Record<RoomType, string>> = {
	bathroom: "Ванная",
	bedroom: "Спальня",
	hallway: "Коридор",
	kitchen: "Кухня",
	"living-room": "Гостиная",
	office: "Кабинет",
	other: "Другое",
	storage: "Кладовая",
};
