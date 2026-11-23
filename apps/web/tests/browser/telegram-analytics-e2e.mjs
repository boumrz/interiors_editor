import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { signedExample } from "./telegram-entry-signed-fixture.ts";

const license = "Принять лицензионное соглашение";
const entered = "Новый проект";
const opens = "/stats/tma-open-v2",
	repeats = "/stats/tma-repeat-v2";
const historical = new Date(1733584787000),
	current = new Date("2026-11-22T12:00:00Z");

async function expectSheetFrame(page, dialog) {
	await expect(dialog).toBeVisible();
	await expect.poll(() => dialog.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		return Math.round(window.innerHeight - bounds.bottom);
	})).toBe(12);
	expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
	const bounds = await dialog.boundingBox();
	expect(Math.round(bounds.x)).toBe(Math.round(page.viewportSize().width - bounds.x - bounds.width));
}

async function expectBottomSheet(page, dialog, title) {
	await expectSheetFrame(page, dialog);
	await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeFocused();
}

async function expectProjectGrid(page) {
	await page.setViewportSize({ width: 422, height: 760 });
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill("Проверка отступов");
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByTestId("editor-top-bar").getByRole("button", { name: "Назад", exact: true }).click();
	const open = page.getByRole("button", { name: "Открыть Проверка отступов", exact: true });
	await expect(open).toBeVisible();
	const preview = open.locator("svg");
	const remove = page.getByRole("button", { name: "Удалить проект Проверка отступов", exact: true });
	const more = page.locator('summary[aria-label="Действия для Проверка отступов"]');
	const create = page.getByRole("button", { name: "Новый проект", exact: true });
	const importProject = page.getByTestId("project-hub-actions").locator("button").filter({ hasText: "Импортировать проект" });
	const controls = await Promise.all([create, importProject, remove, more, preview].map((locator) => locator.boundingBox()));
	const [a, b, deletion, menu, icon] = controls;
	expect(a.width).toBeCloseTo(b.width, 0);
	expect(a.height).toBeCloseTo(b.height, 0);
	expect(deletion.height).toBeCloseTo(menu.height, 0);
	expect(deletion.y + deletion.height / 2).toBeCloseTo(menu.y + menu.height / 2, 0);
	expect(icon.y + icon.height / 2).toBeCloseTo(deletion.y + deletion.height / 2, 0);
	const previewSize = await preview.evaluate(({ parentElement }) => {
		const bounds = parentElement.getBoundingClientRect();
		return { width: bounds.width, height: bounds.height };
	});
	expect(previewSize.width).toBeCloseTo(previewSize.height, 0);
	await page.mouse.move(1, 1);
	const background = () => open.evaluate((element) => getComputedStyle(element).backgroundColor);
	const rest = await background();
	await open.hover();
	expect(await background()).toBe(rest);
	await page.setViewportSize({ width: 320, height: 568 });
	await expect(open).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
	const [first, second] = await Promise.all([create.boundingBox(), importProject.boundingBox()]);
	expect(first.x).toBeCloseTo(second.x, 0);
	expect(first.width).toBeCloseTo(second.width, 0);
	await remove.click();
	const confirmation = page.getByRole("dialog", { name: "Удалить проект", exact: true });
	await expectSheetFrame(page, confirmation);
	await expect(confirmation.getByRole("button", { name: "Отменить", exact: true })).toBeFocused();
	await confirmation.getByRole("button", { name: "Закрыть подтверждение", exact: true }).click();
	await expect(remove).toBeFocused();
	await open.click();
	await page.getByRole("button", { name: "Переименовать проект Проверка отступов", exact: true }).click();
	const rename = page.getByRole("dialog", { name: "Переименовать проект", exact: true });
	await expectSheetFrame(page, rename);
	await rename.getByRole("button", { name: "Закрыть переименование", exact: true }).click();
	await expect(rename).not.toBeVisible();
}

export async function verifyAnalytics({ editorOrigin, browserType }) {
	const browser = await browserType.launch(
		browserType.name() === "chromium" ? { channel: "chrome" } : {},
	);
	const sent = [],
		external = [],
		cloud = [];
	async function device() {
		const ctx = await browser.newContext({
			serviceWorkers: "block",
			viewport: { width: 390, height: 760 },
		});
		await ctx.addCookies([
			{ url: editorOrigin, name: "private", value: "for-editor-only" },
		]);
		await ctx.exposeBinding("oldCloudCall", (_, value) => cloud.push(value));
		await ctx.addInitScript(() => {
			window.TelegramWebviewProxy = {
				postEvent(name) {
					if (name === "web_app_invoke_custom_method")
						void window.oldCloudCall(name);
				},
			};
		});
		await ctx.route("**/*", async (route) => {
			const r = route.request(),
				u = new URL(r.url());
			if (u.origin !== editorOrigin) {
				external.push(u.origin);
				return route.abort();
			}
			if (!u.pathname.startsWith("/stats/")) return route.continue();
			assert([opens, repeats].includes(u.pathname));
			assert.equal(r.method(), "POST");
			assert.equal(r.postData(), null);
			assert.equal(u.search, "");
			const headers = await r.allHeaders();
			assert.equal(headers.cookie, undefined);
			assert.equal(headers.referer, undefined);
			assert.equal(headers.authorization, undefined);
			assert.equal(headers["x-interiors-stats"], "1");
			sent.push(u.pathname);
			return route.fulfill({ status: 204, body: "" });
		});
		return ctx;
	}
	async function boot(ctx, signed = true) {
		const page = await ctx.newPage();
		// Public Telegram sample is genuinely signed in 2024. Advance only the browser clock once the gate appears.
		await page.clock.setFixedTime(historical);
		const hash = new URLSearchParams({
			tgWebAppData: signed ? signedExample : "invalid",
			tgWebAppVersion: "8.0",
			tgWebAppPlatform: "ios",
		});
		await page.goto(editorOrigin + "/?local-marker=private#" + hash);
		if (signed) {
			await expect(page.getByRole("button", { name: license })).toBeVisible();
			await page.clock.setFixedTime(current);
		}
		return page;
	}
	async function statistics(page) {
		await page.getByRole("button", { name: "Настройки статистики", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Статистика", exact: true });
		await expectBottomSheet(page, dialog, "Статистика");
		await expect(dialog).toContainText("Статистика помогает улучшать сервис.");
		await expect(dialog).not.toContainText(/открыти|Telegram ID/i);
		return dialog;
	}
	async function editorStatistics(page) {
		await page.getByRole("button", { name: "Настройки", exact: true }).click();
		const settings = page.getByRole("dialog", { name: "Настройки", exact: true });
		await expectBottomSheet(page, settings, "Настройки");
		const documents = settings.getByRole("navigation", { name: "Документы приложения" });
		const action = settings.getByRole("button", { name: "Настройки статистики", exact: true });
		const [links, footer] = await Promise.all([documents.boundingBox(), action.boundingBox()]);
		expect(links.x).toBeCloseTo(footer.x, 0);
		expect(links.width).toBeCloseTo(footer.width, 0);
		return statistics(page);
	}
	async function closeDialog(dialog, name = "Закрыть статистику") {
		await dialog.getByRole("button", { name, exact: true }).click();
		await expect(dialog).not.toBeVisible();
	}
	const repeatSwitch = (dialog) => dialog.getByRole("switch", {
		name: "Разрешить дополнительную статистику",
	});
	async function accept(page) {
		await page.getByRole("button", { name: license }).click();
		await expect(page.getByRole("button", { name: entered })).toBeVisible();
	}
	try {
		const a = await device(),
			invalid = await boot(a, false);
		await expect(
			invalid.getByRole("heading", { name: "Не удалось открыть редактор" }),
		).toBeVisible();
		await invalid.close();
		assert.deepEqual(sent, []);
		const off = await boot(a);
		await expect(off.getByRole("button", { name: "Настройки", exact: true })).toHaveCount(0);
		const pre = await statistics(off);
		const total = pre.getByRole("switch", {
			name: "Делиться статистикой",
		});
		await expect(total).toBeChecked();
		await expect(pre.getByRole("region", { name: "Дополнительная статистика" })).toBeVisible();
		await expect(repeatSwitch(pre)).not.toBeChecked();
		await pre.getByRole("button", { name: "Отказаться", exact: true }).click();
		await expect(pre.getByRole("button", { name: "Отказаться", exact: true })).toHaveCount(0);
		await expect(repeatSwitch(pre)).not.toBeChecked();
		await total.click();
		await expect(total).not.toBeChecked();
		await expect(pre).toContainText("Статистика выключена");
		await closeDialog(pre);
		await expect(off.getByRole("button", { name: "Настройки статистики", exact: true })).toBeFocused();
		await accept(off);
		assert.deepEqual(sent, []);
		await off.close();
		const same = await boot(a);
		await accept(same);
		assert.deepEqual(sent, []);
		await expectProjectGrid(same);
		await a.close();
		const b = await device(),
			first = await boot(b);
		const preFirst = await statistics(first);
		const consent = preFirst.getByRole("link", { name: "Согласие на дополнительную статистику" });
		await consent.click();
		await expect(first.locator("dialog[data-legal-reader]")).toBeVisible();
		await first.locator("dialog[data-legal-reader] [data-legal-back]").click();
		await expect(consent).toBeFocused();
		assert.deepEqual(sent, []);
		await repeatSwitch(preFirst).click();
		await expect(repeatSwitch(preFirst)).toBeChecked();
		await closeDialog(preFirst);
		await accept(first);
		await expect.poll(() => sent.slice()).toEqual([opens]);
		await first.close();
		const replay = await boot(b);
		await accept(replay);
		const rep = await editorStatistics(replay);
		await expect(repeatSwitch(rep)).toBeChecked();
		assert.deepEqual(sent, [opens]);
		await closeDialog(rep);
		const settings = replay.getByRole("dialog", { name: "Настройки", exact: true });
		await expect(settings.getByRole("button", { name: "Настройки статистики" })).toBeFocused();
		await closeDialog(settings, "Закрыть настройки");
		await expect(replay.getByRole("button", { name: "Настройки", exact: true })).toBeFocused();
		// Seed the previous entry's verified second locally. A second distinct real signature is unavailable
		// in the published Telegram sample. The next admission still verifies the genuine signature.
		await replay.evaluate(() => {
			const k = Object.keys(localStorage).find((k) =>
				k.endsWith(":statistics:2026-11-22.2"),
			);
			if (!k) throw Error("Missing device baseline");
			const row = JSON.parse(localStorage.getItem(k));
			row.lastOpen--;
			row.baseline--;
			localStorage.setItem(k, JSON.stringify(row));
		});
		await replay.close();
		const again = await boot(b);
		await accept(again);
		await expect.poll(() => sent.slice()).toEqual([opens, opens, repeats]);
		const panel = await editorStatistics(again);
		await repeatSwitch(panel).click();
		await expect(repeatSwitch(panel)).not.toBeChecked();
		assert.deepEqual(sent, [opens, opens, repeats]);
		await b.close();
		const c = await device(),
			fresh = await boot(c);
		await accept(fresh);
		await expect
			.poll(() => sent.slice())
			.toEqual([opens, opens, repeats, opens]);
		await c.close();
		const d = await device(),
			readonly = await boot(d);
		await readonly.getByText("Уже есть сохранённые проекты?", { exact: true }).click();
		await readonly
			.getByRole("button", {
				name: "Посмотреть сохранённые проекты",
			})
			.click();
		await expect(
			readonly.getByRole("button", { name: "Настройки", exact: true }),
		).toBeVisible();
		await d.close();
		assert.deepEqual(sent, [opens, opens, repeats, opens]);
		assert.deepEqual(cloud, []);
		assert.deepEqual(external, []);
		console.log(
			"PASS",
			browserType.name(),
			"ordinary release: pre-entry opt-out, local consent and baseline, replay, empty counters, readonly, withdrawal, isolated device.",
		);
	} finally {
		await browser.close();
	}
}
