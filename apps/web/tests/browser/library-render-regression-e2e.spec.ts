import { expect, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";
import { clickRectangularRoomCentre } from "./room-geometry-fixture";

test("LIBRARY-RENDER-01: removing a reusable card keeps its placed model rendered after reopening", async ({
	page,
}) => {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Модель без карточки");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	const glb = await page.request.get("/catalog/evidence-floor-vase.glb");
	expect(glb.ok()).toBeTruthy();
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await page.getByText("Импорт модели", { exact: true }).click();
	await page.getByTestId("custom-glb-import-input").setInputFiles({
		name: "Моя ваза.glb",
		mimeType: "model/gltf-binary",
		buffer: await glb.body(),
	});
	await page
		.getByRole("textbox", { name: "Название модели", exact: true })
		.fill("Моя ваза");
	await page
		.getByRole("button", {
			name: "Добавить в «Кастомное» и разместить",
			exact: true,
		})
		.click();
	await clickRectangularRoomCentre(page);
	await expect(page.getByTestId("item-placement-confirm")).toBeEnabled();
	await page.getByTestId("item-placement-confirm").click();
	await expect(page.getByTestId("item-count")).toHaveText("1 предмет");
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(
		page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Убрать Моя ваза из каталога", exact: true })
		.click();
	await expect(page.getByTestId("custom-catalog-card")).toHaveCount(0);
	await expect(
		page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Модель без карточки", exact: true })
		.click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(
		page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await expect(page.getByTestId("item-count")).toHaveText("1 предмет");
});
