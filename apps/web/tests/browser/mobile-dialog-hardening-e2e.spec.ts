import { expect, test, type Page } from "@playwright/test";

async function createRoom(page: Page) {
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill("Мобильные диалоги");
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByRole("button", { name: "Создать контур", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
}

test("MOBILE-DIALOG-01: rename isolates keyboard focus, fits a short enlarged viewport and returns focus", async ({ page }) => {
	await createRoom(page);
	const trigger = page.getByRole("button", { name: "Переименовать проект Мобильные диалоги", exact: true });
	await trigger.click();
	const dialog = page.getByRole("dialog", { name: "Переименовать проект", exact: true });
	const name = dialog.getByRole("textbox", { name: "Новое название проекта", exact: true });
	await expect(name).toBeFocused();
	await page.getByRole("button", { name: "3D", exact: true }).evaluate(element => element.focus());
	await expect(name).toBeFocused();
	await page.setViewportSize({ width: 360, height: 480 });
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	const box = await dialog.boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("Expected rename modal");
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.y + box.height).toBeLessThanOrEqual(481);
	await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
	await expect(trigger).toBeFocused();
});

test("MOBILE-DIALOG-02: restart has modal keyboard isolation and escape preserves the room", async ({ page }) => {
	await createRoom(page);
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	await page.getByRole("button", { name: "Начать заново", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Начать проект заново", exact: true });
	const cancel = dialog.getByRole("button", { name: "Оставить чертёж", exact: true });
	await expect(cancel).toBeFocused();
	await page.getByRole("button", { name: "3D", exact: true }).evaluate(element => element.focus());
	await expect(cancel).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("button", { name: "3D", exact: true })).toBeEnabled();
});

test("MOBILE-LAYOUT-01: enlarged phone controls fit without clipping their text or overlapping the canvas", async ({ page }) => {
	await createRoom(page);
	await page.setViewportSize({ width: 360, height: 480 });
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	const header = page.getByTestId("editor-top-bar");
	const metrics = await header.evaluate(element => {
		const rect = element.getBoundingClientRect();
		return { left: rect.left, right: rect.right, bottom: rect.bottom,
			clipped: [...element.querySelectorAll("button,[role=status]")].filter(control => control.scrollHeight > control.clientHeight + 1).map(control => control.textContent) };
	});
	expect(metrics.left).toBeGreaterThanOrEqual(0);
	expect(metrics.right).toBeLessThanOrEqual(361);
	expect(metrics.clipped).toEqual([]);
	const controls = page.getByTestId("editor-action-dock").getByRole("button");
	for (const button of await controls.all()) {
		if (!(await button.isVisible())) continue;
		const bounds = await button.boundingBox();
		if (!bounds) throw new Error("Expected a visible dock target");
		expect(bounds.width).toBeGreaterThanOrEqual(44);
		expect(bounds.height).toBeGreaterThanOrEqual(44);
		expect(bounds.y + bounds.height).toBeLessThanOrEqual(481);
	}
});
