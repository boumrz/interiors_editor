import { expect, test, type Page } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function createRoom(page: Page, name: string) {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill(name);
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
}

test("CATALOG-HARDEN-01: catalog cards describe their real category and wall anchor", async ({
	page,
}) => {
	await createRoom(page, "Категории каталога");
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await page.getByRole("button", { name: "Сантехника", exact: true }).click();
	const sink = page.getByRole("button", {
		name: /Демонстрационная раковина —/,
	});
	await expect(sink.getByTestId("catalog-card-category")).toHaveText(
		"Сантехника",
	);
	await page.getByRole("button", { name: "Освещение", exact: true }).click();
	const sconce = page.getByRole("button", {
		name: /Демонстрационное настенное бра —/,
	});
	await expect(sconce.getByTestId("catalog-card-category")).toHaveText(
		"Освещение",
	);
	await expect(sconce.getByText("На стене", { exact: true })).toBeVisible();
});

test("CATALOG-HARDEN-02: a catalog wall model publishes a wall host and survives reopening", async ({
	page,
}) => {
	await createRoom(page, "Каталожное бра");
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await page.getByRole("button", { name: "Освещение", exact: true }).click();
	await page
		.getByRole("button", { name: /Демонстрационное настенное бра —/ })
		.click();
	await page
		.getByRole("button", { name: "Показать на плане", exact: true })
		.click();
	await expect(
		page.getByText("Размещение настенного предмета", { exact: true }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Подтвердить размещение", exact: true })
		.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	const wallInstances = () =>
		page.evaluate(async () => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open("interiors-editor-projects");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			try {
				return await new Promise<string>((resolve, reject) => {
					const tx = db.transaction("revisions", "readonly");
					const request = tx.objectStore("revisions").getAll();
					request.onsuccess = () => resolve(JSON.stringify(request.result));
					request.onerror = () => reject(request.error);
				});
			} finally {
				db.close();
			}
		});
	await expect.poll(wallInstances).toContain('\\"anchorClass\\":\\"wall\\"');
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Каталожное бра", exact: true })
		.click();
	await expect(page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(page.getByTestId("item-count")).toBeHidden();
	await expect(page.getByTestId("wall-schematic-item")).toHaveCount(1);
});
