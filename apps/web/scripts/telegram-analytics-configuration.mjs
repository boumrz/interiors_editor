import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function returnStudyConfiguration(environment) {
	const file = new URL(
		"../../../docs/legal/analytics-consent.html",
		import.meta.url,
	);
	return {
		active: environment.INTERIORS_STOP_REPEAT_STUDY !== "1",
		digest: createHash("sha256").update(readFileSync(file)).digest("hex"),
	};
}
const loopback = /^http:\/\/127\.0\.0\.1:\d+$/;

export function validateAnalyticsCounter(value) {
	if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
		throw new Error("Expected a positive integer analytics counter ID");
	return Number(value);
}

export function validateAnalyticsEditorOrigin(value) {
	if (value !== "https://domiknote.ru" && !loopback.test(value))
		throw new Error(
			"Expected the Telegram editor origin or a loopback test server",
		);
	return value;
}

export function telegramAnalyticsConfiguration(environment) {
	for (const key of [
		"INTERIORS_TELEGRAM_ANALYTICS_DOCUMENT_URL",
		"INTERIORS_TELEGRAM_ANALYTICS_COUNTER_ID",
		"INTERIORS_TELEGRAM_ANALYTICS_TEST_LAUNCH_ONLY",
		"INTERIORS_TELEGRAM_USAGE_METRICS",
		"INTERIORS_LOCAL_RETURN_STUDY_FIXTURE",
	]) {
		if (environment[key])
			throw new Error("Retired Telegram analytics configuration: " + key);
	}
	return {};
}
