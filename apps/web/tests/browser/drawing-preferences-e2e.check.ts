import { expect, type Page, test } from "@playwright/test";
import type {} from "./drawing-preferences-harness";

function preferences(overall: boolean, opening = false, roomClear = true) {
	return JSON.stringify({ version: 1, visible: {
		wall: false, opening, pier: false, overall, "room-clear": roomClear,
	} });
}
async function start(page: Page, scope: "a" | "b" | "browser", faults: { read?: boolean; write?: boolean } = {}) {
	await page.evaluate(({ scope, faults }) => window.__drawingPreferencesFixture.mount(scope, faults), { scope, faults });
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
}
async function createRoom(page: Page) {
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill("Проверка настроек");
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByRole("button", { name: "Создать контур", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
}
async function reopen(page: Page) {
	await page.getByRole("button", { name: "Открыть Проверка настроек", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
}
async function filter(page: Page) {
	await page.getByRole("button", { name: "Настроить размеры", exact: true }).click();
	return page.getByRole("dialog", { name: "Размеры", exact: true });
}
const snapshot = (page: Page) => page.evaluate(() => window.__drawingPreferencesFixture.durableSnapshot());

test("PREFS-01: injected A→B→A preferences survive UI recreation and leave durable rows and browser preference untouched", async ({ page }) => {
	await page.goto("/");
	const browserRaw = preferences(true, true, false);
	await page.evaluate(({ a, b, browserRaw }) => {
		window.__drawingPreferencesFixture.setRaw("a", a);
		window.__drawingPreferencesFixture.setRaw("b", b);
		window.__drawingPreferencesFixture.setBrowserRaw(browserRaw);
	}, { a: preferences(false), b: preferences(false, true, false), browserRaw });
	await start(page, "a"); await createRoom(page);
	const before = await snapshot(page);
	let dialog = await filter(page);
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).not.toBeChecked();
	await dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true }).check();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	expect(await snapshot(page)).toEqual(before);
	await start(page, "b"); await reopen(page); dialog = await filter(page);
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).not.toBeChecked();
	await expect(dialog.getByRole("checkbox", { name: "Внутренние размеры", exact: true })).not.toBeChecked();
	await dialog.getByRole("tab", { name: "Проёмы", exact: true }).click();
	await expect(dialog.getByRole("checkbox", { name: "Ширина проёмов", exact: true })).toBeChecked();
	await dialog.getByRole("checkbox", { name: "Ширина проёмов", exact: true }).uncheck();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	await start(page, "a"); await reopen(page); dialog = await filter(page);
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).toBeChecked();
	await expect(dialog.getByRole("checkbox", { name: "Внутренние размеры", exact: true })).toBeChecked();
	const inspected = await page.evaluate(() => window.__drawingPreferencesFixture.inspect());
	expect(inspected.reads).toEqual(["a", "b", "a"]);
	expect(inspected.writes.map(value => value.scope)).toEqual(["a", "b"]);
	expect(inspected.stored.a).toBe(preferences(true));
	expect(inspected.stored.b).toBe(preferences(false, false, false));
	expect(inspected.browserReads).toBe(0); expect(inspected.browserWrites).toBe(0);
	expect(inspected.browserRaw).toBe(browserRaw); expect(await snapshot(page)).toEqual(before);
});

test("PREFS-02: failing injected read/write uses existing graceful defaults and never falls back to the global browser key", async ({ page }) => {
	await page.goto("/"); const browserRaw = preferences(true, true, false);
	await page.evaluate(raw => window.__drawingPreferencesFixture.setBrowserRaw(raw), browserRaw);
	await start(page, "a", { read: true, write: true }); await createRoom(page);
	const before = await snapshot(page); let dialog = await filter(page);
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).not.toBeChecked();
	await expect(dialog.getByRole("checkbox", { name: "Внутренние размеры", exact: true })).toBeChecked();
	await dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true }).check();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	await start(page, "a", { read: true, write: true }); await reopen(page); dialog = await filter(page);
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).not.toBeChecked();
	const inspected = await page.evaluate(() => window.__drawingPreferencesFixture.inspect());
	expect(inspected.reads).toEqual(["a", "a"]); expect(inspected.writes).toHaveLength(1);
	expect(inspected.browserReads).toBe(0); expect(inspected.browserWrites).toBe(0);
	expect(inspected.browserRaw).toBe(browserRaw); expect(await snapshot(page)).toEqual(before);
});

test("PREFS-03: omitted port retains the existing browser key, UI recreation and write behavior", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(raw => window.__drawingPreferencesFixture.setBrowserRaw(raw), preferences(true));
	await start(page, "browser"); await createRoom(page); const before = await snapshot(page);
	let dialog = await filter(page);
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).toBeChecked();
	await dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true }).uncheck();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	await start(page, "browser"); await reopen(page); dialog = await filter(page);
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).not.toBeChecked();
	const inspected = await page.evaluate(() => window.__drawingPreferencesFixture.inspect());
	expect(inspected.reads).toEqual([]); expect(inspected.writes).toEqual([]);
	expect(inspected.browserReads).toBe(2); expect(inspected.browserWrites).toBe(1);
	expect(inspected.browserRaw).toBe(preferences(false)); expect(await snapshot(page)).toEqual(before);
});

test("PREFS-04: replacing the preference provider for the same identity updates the mounted UI and writer binding", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(raw => {
		window.__drawingPreferencesFixture.setRaw("a", raw);
		window.__drawingPreferencesFixture.setBrowserRaw("untouched browser preference");
	}, preferences(false));
	await start(page, "a", { write: true }); await createRoom(page);
	const before = await snapshot(page); const dialog = await filter(page);
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).not.toBeChecked();
	await page.evaluate(raw => {
		window.__drawingPreferencesFixture.setRaw("a", raw);
		window.__drawingPreferencesFixture.replaceSameScopePort();
	}, preferences(true, false, false));
	await expect(dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true })).toBeChecked();
	await expect(dialog.getByRole("checkbox", { name: "Внутренние размеры", exact: true })).not.toBeChecked();
	await dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true }).uncheck();
	const inspected = await page.evaluate(() => window.__drawingPreferencesFixture.inspect());
	expect(inspected.reads).toEqual(["a", "a"]);
	expect(inspected.writes.map(value => value.scope)).toEqual(["a"]);
	expect(inspected.stored.a).toBe(preferences(false, false, false));
	expect(inspected.browserReads).toBe(0); expect(inspected.browserWrites).toBe(0);
	expect(inspected.browserRaw).toBe("untouched browser preference");
	expect(await snapshot(page)).toEqual(before);
});
