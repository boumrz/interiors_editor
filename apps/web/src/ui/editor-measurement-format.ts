import {
	formatAreaMm2 as formatDomainArea,
	formatLengthMm as formatDomainLength,
} from "../domain/measurement-format";
import { editorLanguage } from "./editor-language";

export function formatLengthMm(
	value: Parameters<typeof formatDomainLength>[0],
): string {
	const label = formatDomainLength(value);
	return editorLanguage() === "en" ? label.replace(/ мм$/, " mm") : label;
}

export function formatAreaMm2(
	value: Parameters<typeof formatDomainArea>[0],
): string {
	const label = formatDomainArea(value);
	return editorLanguage() === "en"
		? label.replace(",", ".").replace(/ м²$/, " m²")
		: label;
}
