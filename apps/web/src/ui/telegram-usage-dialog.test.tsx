import { test, expect } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import {
	createUsageMetrics,
	deviceStatisticsStore,
} from "../app/telegram-usage-metrics";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import { TelegramUsageDialog } from "./telegram-usage-dialog";
import { setEditorLanguage } from "./editor-language";

test("settings describe the purpose of sharing statistics and keep the optional consent separate", async () => {
	const data = new Map<string, string>();
	const storage = () => ({
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => {
			data.set(k, v);
		},
		removeItem: (k: string) => {
			data.delete(k);
		},
	});
	const model = createUsageMetrics({
		store: deviceStatisticsStore(
			"tma-v1-test" as VerifiedTelegramScope,
			storage,
			storage,
		),
		clock: () => Date.UTC(2026, 10, 22, 12),
		studyActive: () => true,
		formDigest: "a".repeat(64),
		readable: async () => true,
		signal: new AbortController().signal,
		lock: (work) => work(),
		send: () => {},
	});
	await model.openSettings();
	let html = renderToStaticMarkup(<TelegramUsageDialog metrics={model} />);
	expect(html).toContain("Статистика помогает улучшать сервис.");
	expect(html).toMatch(/<header\b[^>]*>.*<h2\b[^>]*>Статистика<\/h2>.*aria-label="Закрыть статистику".*<\/header>/);
	expect(html).not.toContain(">Закрыть</button>");
	expect(html).toMatch(/<button\b(?=[^>]*role="switch")(?=[^>]*aria-checked="true")[^>]*>Делиться статистикой/);
	expect(html).toMatch(
		/<section aria-labelledby="([^"]+)"><h3 id="\1">Дополнительная статистика<\/h3>/,
	);
	expect(html).not.toMatch(/открыти|Telegram ID/i);
	expect(html).toContain("Согласие на дополнительную статистику");
	expect(html).toMatch(/<button\b(?=[^>]*role="switch")(?=[^>]*aria-checked="false")(?=[^>]*aria-label="Разрешить дополнительную статистику")[^>]*>Разрешить/);
	expect(html).toContain("Отказаться");
	await model.choose(true);
	html = renderToStaticMarkup(<TelegramUsageDialog metrics={model} />);
	expect(html).toMatch(/<button\b(?=[^>]*role="switch")(?=[^>]*aria-checked="true")(?=[^>]*aria-label="Разрешить дополнительную статистику")/);
	expect(html).not.toContain("Отказаться");
	await model.setAggregate(false);
	html = renderToStaticMarkup(<TelegramUsageDialog metrics={model} />);
	expect(html).toContain("Статистика выключена");
	expect(html).not.toContain('aria-label="Разрешить дополнительную статистику"');
});

test("English settings offer independent editor use and error consent and link the current English form", async () => {
	const data = new Map<string, string>();
	const storage = () => ({
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => { data.set(key, value); },
		removeItem: (key: string) => { data.delete(key); },
	});
	const now = Date.UTC(2026, 10, 25, 12);
	const model = createUsageMetrics({
		store: deviceStatisticsStore("tma-v1-test" as VerifiedTelegramScope, storage, storage),
		clock: () => now,
		launch: now / 1000,
		platform: "ios",
		product: { readable: () => true },
		studyActive: () => true,
		formDigest: "a".repeat(64),
		readable: async () => true,
		signal: new AbortController().signal,
		lock: (work) => work(),
		send: () => {},
	});
	setEditorLanguage("en");
	try {
		await model.openSettings();
		let html = renderToStaticMarkup(<TelegramUsageDialog metrics={model} />);
		expect(html).toContain('href="/legal/2026-11-25/en/product-analytics-consent.html"');
		expect(html).toMatch(/<button\b(?=[^>]*role="switch")(?=[^>]*aria-checked="false")(?=[^>]*aria-label="Allow usage and error analytics")/);
		await model.chooseProduct(true);
		html = renderToStaticMarkup(<TelegramUsageDialog metrics={model} />);
		expect(html).toMatch(/<button\b(?=[^>]*role="switch")(?=[^>]*aria-checked="true")(?=[^>]*aria-label="Allow usage and error analytics")/);
		expect(html).toMatch(/<button\b(?=[^>]*role="switch")(?=[^>]*aria-checked="false")(?=[^>]*aria-label="Allow additional analytics")/);
	} finally {
		setEditorLanguage("ru");
	}
});
