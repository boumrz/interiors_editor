import { expect, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";
import { clickRectangularRoomCentre } from "./room-geometry-fixture";

test("LIBRARY-HARDEN-01: removing a custom card persists and explicit re-import restores it without changing the project", async ({
	page,
}) => {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Своя библиотека");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	const glb = await page.request.get("/catalog/evidence-floor-vase.glb");
	expect(glb.ok()).toBeTruthy();
	const buffer = await glb.body();
	const importModel = async (place = false) => {
		await page.getByText("Импорт модели", { exact: true }).click();
		await page
			.getByTestId("custom-glb-import-input")
			.setInputFiles({
				name: "Моя ваза.glb",
				mimeType: "model/gltf-binary",
				buffer,
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
		if (place) {
			await expect(page.getByTestId("item-placement-confirm")).toBeEnabled();
			await page.getByTestId("item-placement-confirm").click();
			await expect(page.getByTestId("item-count")).toHaveText("1 предмет");
		} else await page.getByTestId("item-placement-cancel").click();
	};
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await importModel(true);
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await expect(page.getByTestId("custom-catalog-card")).toHaveCount(1);
	await page
		.getByRole("button", { name: "Убрать Моя ваза из каталога", exact: true })
		.click();
	await expect(page.getByTestId("custom-catalog-card")).toHaveCount(0);
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Своя библиотека", exact: true })
		.click();
	await expect(page.getByTestId("item-count")).toHaveText("1 предмет");
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await expect(page.getByTestId("custom-catalog-card")).toHaveCount(0);
	await importModel();
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await expect(page.getByTestId("custom-catalog-card")).toHaveCount(1);
});
