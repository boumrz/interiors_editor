import { installAnalyticsDocument } from "./app/telegram-analytics-document";

const raw = document.getElementById("telegram-analytics-config")?.textContent;
if (raw) {
	try {
		installAnalyticsDocument(window, JSON.parse(raw));
	} catch {
		/* A malformed optional document stays inert. */
	}
}
