import { expect, test } from "@playwright/test";
import {
	createSavedBrowserRoom,
	openSavedBrowserRoom,
	savedBrowserRecords,
} from "./browser-host-fixture";

declare global {
	interface Window {
		__s1WriterWrites: string[];
	}
}

test("HOST-S1-01: browser StrictMode keeps one writer, exact data and editing without Telegram", async ({ page }) => {
	const pageErrors: string[] = [];
	const telegramRequests: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	await page.route("https://telegram.org/**", async (route) => {
		telegramRequests.push(route.request().url());
		await route.abort();
	});
	await page.addInitScript(() => {
		const writes: string[] = [];
		Object.defineProperty(window, "__s1WriterWrites", { value: writes });
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string) {
			if (this === window.sessionStorage && key === "interiors-editor-writer-owner") {
				writes.push(value);
			}
			setItem.call(this, key, value);
		};
		Object.defineProperty(window, "Telegram", {
			configurable: true,
			get: () => { throw new Error("Browser entry must not depend on Telegram"); },
		});
	});
	await page.goto("/");
	await createSavedBrowserRoom(page, "Host boundary S1");
	const owner = await page.evaluate(() => sessionStorage.getItem("interiors-editor-writer-owner"));
	expect(owner).toMatch(/^[a-f0-9-]{36}$/);
	expect(await page.evaluate(() => window.__s1WriterWrites)).toEqual([owner]);
	const before = await savedBrowserRecords(page);
	expect(before.version).toBe(3);
	expect(before.stores).toEqual([
		"pin-staging-leases", "projects", "revisions", "staging", "writer-leases",
	]);
	expect(before.projects).toHaveLength(1);
	expect(before.revisions).toHaveLength(2);
	expect(before.staging).toEqual([]);

	await page.reload();
	await openSavedBrowserRoom(page, "Host boundary S1");
	expect(await page.evaluate(() => sessionStorage.getItem("interiors-editor-writer-owner"))).toBe(owner);
	expect(await page.evaluate(() => window.__s1WriterWrites)).toEqual([]);
	expect(await savedBrowserRecords(page)).toEqual(before);

	await page.getByRole("button", { name: "Размеры плана", exact: true }).click();
	await page.getByLabel("Ширина, мм").fill("4300");
	await page.getByRole("button", { name: "Применить размеры", exact: true }).click();
	await expect(page.getByTestId("plan-width")).toHaveText("4300 мм");
	await expect(page.getByTestId("project-durability-status")).toContainText("Сохранено локально");
	const changed = await savedBrowserRecords(page);
	expect(changed.revisions).toHaveLength(3);
	expect(changed.revisions).toEqual(expect.arrayContaining(before.revisions));
	expect(changed.staging).toEqual([]);
	await page.reload();
	await openSavedBrowserRoom(page, "Host boundary S1", 4300);
	expect(await savedBrowserRecords(page)).toEqual(changed);
	expect(pageErrors).toEqual([]);
	expect(telegramRequests).toEqual([]);
});
