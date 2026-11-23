import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("a future receipt and a failed save cannot unlock editing", async ({
	page,
}) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			"interiors:web:license:2026-11-22.2",
			"2099-01-01T00:00:00.000Z",
		);
		Storage.prototype.setItem = () => {
			throw new Error("Storage unavailable");
		};
	});
	await page.goto("/");
	await page
		.getByRole("button", { name: "Принять лицензионное соглашение" })
		.click({ timeout: 4000 });
	await expect(page.getByRole("alert")).toContainText("сохранить");
	await expect(page.getByRole("button", { name: "Новый проект" })).toHaveCount(
		0,
	);
	await expect(
		page.getByRole("button", { name: "Выгрузить сохранённые проекты" }),
	).toBeVisible();
});

test("read both documents before work, export without accepting, then open settings after accepting", async ({
	page,
}) => {
	await page.goto("/");
	const accept = page.getByRole("button", {
		name: "Принять лицензионное соглашение",
	});
	await expect(accept).toBeVisible();
	await expect(page.getByRole("button", { name: "Новый проект" })).toHaveCount(
		0,
	);
	for (const name of [
		"Политика конфиденциальности",
		"Лицензионное соглашение",
	]) {
		await page.getByRole("link", { name, exact: true }).click();
		const doc = page.getByRole("dialog", { name: "Чтение документа" });
		await expect(doc.getByRole("heading", { level: 1 })).toContainText(name);
		await doc.getByRole("button", { name: "Назад" }).click();
		await expect(page.getByRole("link", { name, exact: true })).toBeFocused();
		await expect(accept).toBeVisible();
	}
	await page
		.getByRole("button", { name: "Выгрузить сохранённые проекты" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Просмотр проектов" }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Новый проект" })).toHaveCount(
		0,
	);
	await page.getByRole("button", { name: "Назад к документам" }).click();
	await accept.click();
	await expect(
		page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(accept).toHaveCount(0);
	const openSettings = page.getByRole("button", { name: "Настройки", exact: true });
	await openSettings.click();
	const settings = page.getByRole("dialog", { name: "Настройки" });
	await expect(
		settings.getByRole("link", { name: "Политика конфиденциальности" }),
	).toBeVisible();
	await expect(
		settings.getByRole("link", { name: "Лицензионное соглашение" }),
	).toBeVisible();
	await expect(settings.getByRole("button", { name: "Разрешить" })).toHaveCount(
		0,
	);
	const header = settings.locator("header");
	const closeSettings = header.getByRole("button", { name: "Закрыть настройки" });
	await expect(header.getByRole("heading", { name: "Настройки" })).toBeVisible();
	const closeBounds = await closeSettings.boundingBox();
	expect(closeBounds?.width).toBeGreaterThanOrEqual(44);
	expect(closeBounds?.height).toBeGreaterThanOrEqual(44);
	await closeSettings.click();
	await expect(openSettings).toBeFocused();
	await expect(
		page.getByRole("button", { name: "Новый проект" }),
	).toBeVisible();
});

test("a previously saved project can be downloaded before accepting the new edition", async ({
	page,
}) => {
	await page.goto("/");
	await page
		.getByRole("button", { name: "Принять лицензионное соглашение" })
		.click();
	await page.getByRole("button", { name: "Новый проект" }).click();
	await page.getByLabel("Название проекта").fill("Проверка архива");
	await page.getByRole("button", { name: "Создать проект" }).click();
	await expect(
		page.getByRole("status").filter({ hasText: "Сохранено" }).first(),
	).toBeVisible();
	const openEditorMenu = page.getByRole("button", { name: "Открыть остальные действия" });
	await openEditorMenu.click();
	await page.getByRole("button", { name: "Настройки", exact: true }).click();
	const settings = page.getByRole("dialog", { name: "Настройки" });
	await settings
		.getByRole("link", { name: "Политика конфиденциальности" })
		.click();
	await page
		.getByRole("dialog", { name: "Чтение документа" })
		.getByRole("button", { name: "Назад" })
		.click();
	await settings.getByRole("button", { name: "Закрыть настройки" }).click();
	await expect(openEditorMenu).toBeFocused();
	await page.evaluate(() =>
		localStorage.removeItem("interiors:web:license:2026-11-22.2"),
	);
	await page.reload();
	await page
		.getByRole("button", { name: "Выгрузить сохранённые проекты" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Проверка архива" }),
	).toBeVisible();
	await page.getByRole("button", { name: /Подготовить полный архив/ }).click();
	const download = page.waitForEvent("download");
	await page.getByRole("button", { name: "Скачать файл" }).click();
	expect(await (await download).failure()).toBe(null);
	await expect(page.getByRole("button", { name: "Новый проект" })).toHaveCount(
		0,
	);
});

test("a missing copy of the license leaves export available", async ({
	page,
}) => {
	await page.goto("/");
	await page
		.getByRole("button", { name: "Принять лицензионное соглашение" })
		.waitFor();
	await page.evaluate(() => {
		document.getElementById("legal-documents-2026-11-22.2")?.remove();
	});
	await page
		.getByRole("button", { name: "Принять лицензионное соглашение" })
		.click();
	await expect(page.getByRole("alert")).toContainText("текст");
	await expect(
		page.getByRole("button", { name: "Выгрузить сохранённые проекты" }),
	).toBeVisible();
});

test("a saved acceptance only opens the editor when the current edition is readable", async ({
	page,
}) => {
	await page.addInitScript(() =>
		localStorage.setItem(
			"interiors:web:license:2026-11-22.2",
			new Date().toISOString(),
		),
	);
	await page.route("**/", async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replace(
			'id="legal-documents-2026-11-22.2"',
			'id="unavailable-document"',
		);
		await route.fulfill({ response, body });
	});
	await page.goto("/");
	await expect(
		page.getByRole("button", { name: "Выгрузить сохранённые проекты" }),
	).toBeVisible({ timeout: 3500 });
	await expect(page.getByRole("button", { name: "Новый проект" })).toHaveCount(
		0,
	);
});
