import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 320, height: 670 } });

async function savedProject(page) {
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	return page.evaluate(() => window.__telegramRuntimeUi.state().project);
}

test("merging rooms explicitly chooses a floor finish and publishes once", async ({ page, baseURL }) => {
	const origin = new URL(baseURL).origin;
	await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
	await page.goto("/");
	await page.evaluate(async () => {
		await window.__telegramRuntimeUi.initialize();
		await window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "authoring", "authoring");
	});
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill("Пол при объединении");
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Ширина, мм", exact: true }).fill("4000");
	await page.getByRole("textbox", { name: "Глубина, мм", exact: true }).fill("3000");
	await page.getByRole("textbox", { name: "Высота, мм", exact: true }).fill("2800");
	await page.getByRole("button", { name: "Создать контур", exact: true }).click();
	await savedProject(page);
	await page.evaluate(() => window.__telegramRuntimeUi.addWall({
		start: { xMm: 2050, zMm: 0 }, end: { xMm: 2050, zMm: 3100 }, thicknessMm: 100,
	}));
	const divided = await savedProject(page);
	const [oakRoom, tileRoom] = divided.level.rooms;
	await page.evaluate(async ([oakId, tileId]) => {
		await window.__telegramRuntimeUi.authorInterior({ kind: "set-floor-finish", roomId: oakId, finish: { presetId: "light-oak", version: 1 } });
		await window.__telegramRuntimeUi.authorInterior({ kind: "set-floor-finish", roomId: tileId, finish: { presetId: "matte-floor-tile", version: 1 } });
	}, [oakRoom.roomId, tileRoom.roomId]);
	await savedProject(page);
	const rows = () => page.evaluate(() => window.__telegramRuntimeUi.semanticRows("a"));
	const before = await rows();
	const divider = page.locator('[data-testid="wall-segment"][data-wall-kind="interior"]');
	await divider.click();
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	const removeWall = page.getByTestId("selected-wall-inspector").getByRole("button", { name: "Удалить стену", exact: true });
	const sheet = page.getByRole("dialog", { name: "Удалить стену", exact: true });
	await removeWall.click();
	await expect(sheet.getByRole("button", { name: /Светлый дуб.*Комната 1/ })).toBeVisible();
	await expect(sheet.getByRole("button", { name: /Матовая плитка.*Комната 2/ })).toBeVisible();
	await sheet.getByRole("button", { name: "Закрыть удаление стены", exact: true }).click();
	await expect(sheet).toHaveCount(0);
	expect(await rows()).toEqual(before);
	await removeWall.click();
	const merge = sheet.getByRole("button", { name: "Объединить помещения", exact: true });
	await expect(merge).toBeDisabled();
	await sheet.getByRole("group", { name: "Какие тип и высоту сохранить?" }).getByRole("button", { name: /Комната 1/ }).click();
	await expect(merge).toBeDisabled();
	await sheet.getByRole("button", { name: /Матовая плитка.*Комната 2/ }).click();
	await merge.click();
	await expect.poll(async () => (await savedProject(page)).level.rooms).toMatchObject([
		{ roomId: oakRoom.roomId, floorFinish: { presetId: "matte-floor-tile", version: 1 } },
	]);
	expect((await rows()).revisions).toHaveLength(before.revisions.length + 1);
});
