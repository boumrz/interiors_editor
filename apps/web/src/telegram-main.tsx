/** Explicit Telegram entry: no PWA registration, cleanup or browser singleton. */
const element = document.getElementById("root");
if (!element) throw new Error("Telegram editor root is missing");
const retry = document.getElementById("telegram-retry"),
	exit = document.getElementById("telegram-exit"),
	status = document.getElementById("telegram-loading-status");
let generation = 0;
async function load() {
	const current = ++generation;
	retry?.setAttribute("hidden", "");
	element?.firstElementChild?.setAttribute("aria-busy", "true");
	if (status) status.textContent = "Загружаем редактор…";
	try {
		const application = await import("./app/telegram-editor-app");
		if (current !== generation || !element) return;
		application.mountTelegramBrowserEditor(element);
	} catch {
		if (current !== generation) return;
		element?.firstElementChild?.setAttribute("aria-busy", "false");
		if (status) status.textContent =
			"Не удалось загрузить редактор. Повторите запуск.";
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
