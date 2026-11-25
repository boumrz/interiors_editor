import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { LegalDocumentsPlugin } from "./legal-documents-build.mjs";
import { createTelegramPreviewServer } from "./telegram-preview-server.mjs";

const web = fileURLToPath(new URL("../", import.meta.url));
const source = new URL("../../../docs/legal/", import.meta.url);
const names = ["privacy-policy", "license-agreement", "analytics-consent"];
const edition = "2026-11-22.2";
const privacyEdition = "2026-11-25.2";
const dailyProductArchive = {
	"privacy-policy.html": "025254e14393e6445ea474e137356cebf88a39a56ce6a944b1174f84b29c49ec",
	"product-analytics-consent.html": "504a6c161eb786a7c1705e8de5de8c04b9b7334561a4d3d0f131e29f94f251cf",
	"en/privacy-policy.html": "52e0a26a7147760d1cd6c15df2aac16be182b72b9cdd6ce9b3c623cb938dc176",
	"en/product-analytics-consent.html": "238be28553f579e94f4644ad194e2ef279498e1111597d8c61859c2954c6de67",
};

test("Telegram publishes the unmodified legal editions, provides prelaunch reading and permits saving without JavaScript", {
	timeout: 60_000,
}, async (t) => {
	const temporary = await mkdtemp(join(tmpdir(), "interiors-legal-delivery-"));
	t.after(() => rm(temporary, { recursive: true, force: true }));
	const output = join(temporary, "dist-telegram");
	const build = spawnSync(
		process.execPath,
		[
			"node_modules/@rspack/cli/bin/rspack.js",
			"build",
			"--mode",
			"production",
			"--config",
			"rspack.telegram.config.mjs",
		],
		{
			cwd: web,
			env: { ...process.env, INTERIORS_TELEGRAM_OUTPUT: output },
			encoding: "utf8",
			timeout: 45_000,
		},
	);
	assert.equal(build.status, 0, build.stdout + build.stderr);
	const preview = await createTelegramPreviewServer({ directory: output });
	t.after(() => preview.close());
	await new Promise((resolve) =>
		preview.server.listen(0, "127.0.0.1", resolve),
	);
	const origin = "http://127.0.0.1:" + preview.server.address().port;
	const browser = await chromium.launch({ channel: "chrome" });
	t.after(() => browser.close());
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	const api = [];
	page.on("request", (request) => api.push(request.url()));
	await page.goto(origin);
	for (const name of names) {
		const path = "/legal/" + name + ".html";
		const body = await readFile(new URL(name + ".html", source), "utf8");
		const anchor = page.locator('a[href="' + path + '"]');
		assert.equal(await anchor.count(), 1, "missing pre-launch link " + name);
		await anchor.click();
		assert.equal(await page.locator("h1").count(), 1);
		assert.equal(await page.locator("#root").count(), 0);
		await page.goBack();
		for (const [url, cache] of [
			[path, "no-store"],
			[
				"/legal/" + (name === "privacy-policy" ? privacyEdition : edition) + "/" + name + ".html",
				"public, max-age=31536000, immutable",
			],
		]) {
			const response = await fetch(origin + url);
			assert.equal(response.status, 200, url);
			assert.match(response.headers.get("content-type"), /text\/html/);
			assert.equal(response.headers.get("cache-control"), cache);
			assert.equal(await response.text(), body);
		}
		const englishPath = `/legal/${name === "privacy-policy" ? privacyEdition : edition}/en/${name}.html`;
		const englishResponse = await fetch(origin + englishPath);
		assert.equal(englishResponse.status, 200, englishPath);
		assert.equal(englishResponse.headers.get("cache-control"), "public, max-age=31536000, immutable");
		const english = await readFile(new URL(`en/${name}.html`, source), "utf8");
		assert.match(english, /<html lang="en">/);
		assert.equal(await englishResponse.text(), english);
		const localized = await page.locator(`[id="legal-documents-en-${edition}"]`).textContent();
		assert.equal(JSON.parse(localized)[name], english);
	}
	const retainedPrivacy = await fetch(origin + `/legal/${edition}/privacy-policy.html`);
	assert.equal(retainedPrivacy.status, 200);
	assert.match(retainedPrivacy.headers.get("cache-control"), /immutable/);
	assert.equal(await retainedPrivacy.text(), await readFile(new URL(`archive/${edition}/privacy-policy.html`, source), "utf8"));
	for (const [lang, segment] of [["ru", ""], ["en", "en/"]]) {
		const previousPath = `/legal/2026-11-24.1/${segment}privacy-policy.html`;
		const previous = await fetch(origin + previousPath);
		assert.equal(previous.status, 200, previousPath);
		assert.match(previous.headers.get("cache-control"), /immutable/);
		assert.equal(await previous.text(), await readFile(new URL(`archive/2026-11-24.1/${segment}privacy-policy.html`, source), "utf8"));
		const productPath = `/legal/${privacyEdition}/${segment}product-analytics-consent.html`;
		const product = await fetch(origin + productPath);
		assert.equal(product.status, 200, productPath);
		assert.match(product.headers.get("cache-control"), /immutable/);
		const consent = await readFile(new URL(`${segment}product-analytics-consent.html`, source), "utf8");
		assert.match(consent, new RegExp(`<html lang="${lang}">`));
		assert.match(consent, lang === "en" ? /two-hour interval/ : /двухчасового интервала/);
		assert.match(consent, new RegExp(`/legal/${privacyEdition.replace(".", "\\.")}/${segment}privacy-policy\\.html`));
		assert.equal(await product.text(), consent);
		const payload = await page.locator(`[id="legal-documents-${lang === "en" ? "en-" : ""}${edition}"]`).textContent();
		assert.equal(JSON.parse(payload)["product-analytics-consent"], consent);
	}
	const currentProduct = await fetch(origin + "/legal/product-analytics-consent.html");
	assert.equal(currentProduct.status, 200);
	assert.equal(currentProduct.headers.get("cache-control"), "no-store");
	for (const [name, digest] of Object.entries(dailyProductArchive)) {
		const path = `/legal/2026-11-25/${name}`;
		const previous = await fetch(origin + path);
		assert.equal(previous.status, 200, path);
		assert.equal(previous.headers.get("cache-control"), "public, max-age=31536000, immutable");
		assert.equal(createHash("sha256").update(Buffer.from(await previous.arrayBuffer())).digest("hex"), digest, path);
	}
	const supportPath = "/legal/2026-11-24/telegram-support-privacy.html";
	const support = await fetch(origin + supportPath);
	assert.equal(support.status, 200, supportPath);
	assert.match(support.headers.get("content-type"), /text\/html/);
	assert.equal(
		support.headers.get("cache-control"),
		"public, max-age=31536000, immutable",
	);
	assert.equal(
		await support.text(),
		await readFile(new URL("telegram-support-privacy.html", source), "utf8"),
	);
	await page.goto(origin + supportPath);
	assert.equal(
		await page.getByRole("heading", { level: 1, name: "Данные обращений в Telegram" }).count(),
		1,
	);
	assert.equal(await page.locator("#root").count(), 0);
	assert.equal(
		await page.getByRole("link", { name: "Политика конфиденциальности InteriorsEditor" }).getAttribute("href"),
		"/legal/privacy-policy.html",
	);
	const directSupportPath = "/legal/2026-11-24.2/telegram-support-privacy.html";
	const directSupport = await fetch(origin + directSupportPath);
	assert.equal(directSupport.status, 200, directSupportPath);
	assert.equal(directSupport.headers.get("cache-control"), "public, max-age=31536000, immutable");
	assert.equal(
		await directSupport.text(),
		await readFile(new URL("telegram-support-direct-privacy.html", source), "utf8"),
	);
	const englishSupportPath = "/legal/2026-11-24.2/en/telegram-support-privacy.html";
	const englishSupport = await fetch(origin + englishSupportPath);
	assert.equal(englishSupport.status, 200, englishSupportPath);
	assert.equal(await englishSupport.text(), await readFile(new URL("en/telegram-support-direct-privacy.html", source), "utf8"));
	assert.ok(
		api.every(
			(url) => new URL(url).origin === origin && !url.includes("/stats/"),
		),
	);
	assert.equal((await fetch(origin + "/legal/legal-review.md")).status, 404);
	await preview.activate(output);
});

test("the offline reader preserves the underlying screen with the same edition on local and HTTPS origins", {
	timeout: 60_000,
}, async (t) => {
	const { rspack } = await import("@rspack/core");
	const { default: configure } = await import("../rspack.shared.config.mjs");
	const config = configure({}, { mode: "production" });
	const temporary = await mkdtemp(join(tmpdir(), "interiors-legal-reader-"));
	t.after(() => rm(temporary, { recursive: true, force: true }));
	config.context = web;
	config.entry = "./tests/browser/legal-reader-fixture.tsx";
	config.output = { ...config.output, path: temporary };
	config.plugins = [
		new rspack.HtmlRspackPlugin({ templateContent: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>' }),
		new LegalDocumentsPlugin(),
	];
	const compiler = rspack(config);
	await new Promise((resolve, reject) =>
		compiler.run((err, stats) =>
			compiler.close(() => {
				if (err || stats.hasErrors())
					reject(err || new Error(stats.toString({ errors: true })));
				else resolve();
			}),
		),
	);
	const browser = await chromium.launch({ channel: "chrome" });
	t.after(() => browser.close());
	for (const origin of ["http://127.0.0.1:37773", "https://example.invalid"]) {
		const context = await browser.newContext();
		try {
			await context.route("**/*", async (route) => {
				const url = new URL(route.request().url());
				assert.equal(url.origin, origin);
				const path =
					url.pathname === "/" ? "index.html" : url.pathname.slice(1);
				await route.fulfill({ path: join(temporary, path) });
			});
			const page = await context.newPage();
			await page.goto(origin);
			assert.equal(await page.getByTestId("release").textContent(), edition);
			assert.equal(await page.getByTestId("readable").textContent(), "true");
			await page.getByRole("textbox").fill("сохранено");
			const link = page.getByRole("link", { name: "Прочитать политику" });
			assert.equal(
				await link.getAttribute("href"),
				`/legal/${privacyEdition}/privacy-policy.html`,
			);
			await context.unrouteAll();
			const unexpectedRequests = [];
			context.on("request", (request) =>
				unexpectedRequests.push(request.url()),
			);
			await context.setOffline(true);
			await link.click();
			const dialog = page.getByRole("dialog");
			await dialog
				.getByRole("heading", { level: 1, name: /Политика/ })
				.waitFor();
			assert.equal(await dialog.locator("iframe").count(), 0);
			await dialog
				.locator("footer")
				.getByRole("link", { name: /Лицензионное соглашение/ })
				.click();
			await dialog
				.getByRole("heading", { level: 1, name: /Лицензионное соглашение/ })
				.waitFor();
			const download = page.waitForEvent("download");
			await dialog.getByRole("link", { name: "Сохранить HTML" }).click();
			assert.equal(
				await readFile(await (await download).path(), "utf8"),
				await readFile(new URL("license-agreement.html", source), "utf8"),
			);
			await page.evaluate(() =>
				window.dispatchEvent(new Event("test-native-back")),
			);
			await dialog
				.getByRole("heading", { level: 1, name: /Политика/ })
				.waitFor();
			await dialog.getByRole("button", { name: "Назад", exact: true }).click();
			await dialog.waitFor({ state: "hidden" });
			assert.equal(await page.getByRole("textbox").inputValue(), "сохранено");
			assert.equal(
				await link.evaluate((el) => document.activeElement === el),
				true,
			);
			assert.deepEqual(
				unexpectedRequests.filter((url) => !url.startsWith("blob:")),
				[],
			);
		} finally {
			await context.close();
		}
	}
});
