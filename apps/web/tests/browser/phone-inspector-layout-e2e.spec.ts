import { expect, type Page, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function selectedWall(page: Page) {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Инспектор");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
}

test("INSPECTOR-01: wall properties open explicitly with an aligned reachable close control", async ({
	page,
}) => {
	await selectedWall(page);
	const panel = page.getByTestId("selected-wall-inspector");
	await expect(panel).toHaveCount(0);
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Свойства", exact: true })
		.click();
	await expect(panel).toBeVisible();
	const button = panel.getByRole("button", {
		name: "Закрыть свойства стены",
		exact: true,
	});
	const icon = page.getByTestId("selected-wall-inspector-icon");
	const buttonBox = await button.boundingBox();
	const iconBox = await icon.boundingBox();
	if (!buttonBox || !iconBox) throw new Error("Expected visible wall header");
	expect(buttonBox.height).toBeGreaterThanOrEqual(44);
	expect(buttonBox.height).toBeLessThanOrEqual(52);
	expect(
		Math.abs(
			buttonBox.y + buttonBox.height / 2 - (iconBox.y + iconBox.height / 2),
		),
	).toBeLessThan(2);
	await expect(panel).not.toContainText("Выбранная стены");
	await button.click();
	await expect(panel).toHaveCount(0);
});

for (const viewport of [
	{ width: 360, height: 480 },
	{ width: 852, height: 393 },
	{ width: 393, height: 320 },
])
	test(`INSPECTOR-02 ${viewport.width}x${viewport.height}: enlarged opening form remains scrollable and buttons reachable`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		await selectedWall(page);
		await page
			.getByTestId("editor-action-dock")
			.getByRole("button", { name: "Добавить проём", exact: true })
			.click();
		const creation = page.getByRole("dialog", {
			name: "Новый проём",
			exact: true,
		});
		await creation.getByRole("button", { name: "Окно", exact: true }).click();
		const dialog = page.getByRole("dialog", {
			name: "Новое окно",
			exact: true,
		});
		await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
		const form = dialog.locator("form");
		const box = await form.boundingBox();
		if (!box) throw new Error("Expected form");
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		const cancel = dialog.getByRole("button", { name: "Отмена", exact: true });
		await cancel.scrollIntoViewIfNeeded();
		await expect(cancel).toBeInViewport();
		await cancel.click();
		await expect(dialog).not.toBeVisible();
	});
