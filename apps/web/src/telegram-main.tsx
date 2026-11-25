import { languageForTelegram } from "./adapters/telegram/editor-language";
import { legalArchivePath, type LegalDocumentName } from "./app/legal-release";
import { copy, setEditorLanguage } from "./ui/editor-language";

/** Explicit Telegram entry: no PWA registration, cleanup or browser singleton. */
const element = document.getElementById("root");
if (!element) throw new Error("Telegram editor root is missing");
const retry = document.getElementById("telegram-retry"),
	exit = document.getElementById("telegram-exit"),
	status = document.getElementById("telegram-loading-status");
const language = languageForTelegram(undefined, navigator.language);
setEditorLanguage(language);
document.documentElement.lang = language;
if (language === "en") {
	const heading = document.getElementById("telegram-loading-heading");
	if (heading) heading.textContent = "Opening the editor";
	if (retry) retry.textContent = "Try again";
	if (exit) exit.textContent = "Exit";
	const legalLinks: ReadonlyArray<readonly [LegalDocumentName, string]> = [
		["privacy-policy", "Privacy policy"],
		["license-agreement", "License agreement"],
		["analytics-consent", "Consent for statistics on repeat opens"],
	];
	const legalNavigation = element.querySelector("nav");
	legalNavigation?.setAttribute("aria-label", "App documents");
	for (const [name, label] of legalLinks) {
		const link = legalNavigation?.querySelector<HTMLAnchorElement>(`[href="/legal/${name}.html"]`);
		if (link) {
			link.textContent = label;
			link.href = legalArchivePath(name);
		}
	}
	for (const link of element.querySelectorAll<HTMLAnchorElement>("main > p > a")) {
		link.textContent = new URL(link.href).hostname === "t.me" ? "Open in Telegram" : "Open the web editor";
	}
}
let generation = 0;
async function load() {
	const current = ++generation;
	retry?.setAttribute("hidden", "");
	element?.firstElementChild?.setAttribute("aria-busy", "true");
	if (status) status.textContent = copy("Загружаем редактор…", "Loading the editor…");
	try {
		const application = await import("./app/telegram-editor-app");
		if (current !== generation || !element) return;
		application.mountTelegramBrowserEditor(element);
	} catch {
		if (current !== generation) return;
		element?.firstElementChild?.setAttribute("aria-busy", "false");
		if (status) status.textContent =
			copy("Не удалось загрузить редактор. Повторите запуск.", "The editor could not load. Try again.");
		retry?.removeAttribute("hidden");
	}
}
retry?.addEventListener("click", () => void load());
exit?.addEventListener("click", () => {
	generation++;
	window.close();
});
void load();

export {};
