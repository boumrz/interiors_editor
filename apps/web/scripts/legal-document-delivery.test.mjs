import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
				"/legal/" + edition + "/" + name + ".html",
				"public, max-age=31536000, immutable",
			],
		]) {
			const response = await fetch(origin + url);
			assert.equal(response.status, 200, url);
			assert.match(response.headers.get("content-type"), /text\/html/);
			assert.equal(response.headers.get("cache-control"), cache);
			assert.equal(await response.text(), body);
		}
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
				`/legal/${edition}/privacy-policy.html`,
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
