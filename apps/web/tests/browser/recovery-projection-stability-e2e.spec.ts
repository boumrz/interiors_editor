import { expect, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";
import { clickRectangularRoomCentre } from "./room-geometry-fixture";

test("RECOVERY-PROJECTION-01: missing model recovery keeps a stable read-only view without a render loop", async ({
	page,
}) => {
	const renderErrors: string[] = [];
	page.on("console", (message) => {
		if (
			message.type() === "error" &&
			message.text().includes("Maximum update depth")
		) {
			renderErrors.push(message.text());
		}
	});
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Стабильное восстановление");
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
		name: "Исходная ваза.glb",
		mimeType: "model/gltf-binary",
		buffer: await glb.body(),
	});
	await page
		.getByRole("textbox", { name: "Название модели", exact: true })
		.fill("Исходная ваза");
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
	await page
		.getByRole("button", { name: "Вернуться к проектам", exact: true })
		.click();
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-custom-assets");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction("resources", "readwrite");
				const store = tx.objectStore("resources");
				const request = store.getAll();
				request.onsuccess = () => {
					for (const record of request.result)
						store.put({ ...record, bytes: new Uint8Array([0]).buffer });
				};
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		} finally {
			db.close();
		}
	});
	await page.reload();
	await page
		.getByRole("button", {
			name: "Открыть Стабильное восстановление",
			exact: true,
		})
		.click();
	const notice = page.getByTestId("resource-recovery-projection-notice");
	await expect(notice).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Стена", exact: true }),
	).toBeDisabled();
	// Observe an idle recovery view long enough for React's passive-effect guard to report loops.
	await page
		.waitForEvent("console", {
			predicate: (message) =>
				message.type() === "error" &&
				message.text().includes("Maximum update depth"),
			timeout: 1000,
		})
		.catch(() => undefined);
	expect(renderErrors).toEqual([]);
	await notice
		.getByRole("button", { name: "Вернуться к проектам", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
});
