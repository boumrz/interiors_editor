import { editorLanguage } from "./editor-language";

/**
 * Formats an item count with the Russian noun form used by both editor views.
 * The input is normally an array length, but handling all integers keeps the
 * formatter safe for catalog and summary surfaces too.
 */
export function itemCountCopy(count: number): string {
	if (editorLanguage() === "en")
		return `${count} ${Math.abs(count) === 1 ? "item" : "items"}`;
	const mod100 = Math.abs(count) % 100;
	const mod10 = Math.abs(count) % 10;
	const noun =
		mod100 >= 11 && mod100 <= 14
			? "предметов"
			: mod10 === 1
				? "предмет"
				: mod10 >= 2 && mod10 <= 4
					? "предмета"
					: "предметов";

	return `${count} ${noun}`;
}
