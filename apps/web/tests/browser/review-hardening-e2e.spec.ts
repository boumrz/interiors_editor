import { expect, test, type Page } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function createRoom(page: Page) {
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill("Независимый обзор");
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByRole("button", { name: "Создать контур", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
}

async function downloadBytes(page: Page): Promise<Uint8Array> {
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	const event = page.waitForEvent("download");
	await page.getByRole("button", { name: "Экспортировать проект", exact: true }).click();
	const stream = await (await event).createReadStream();
	if (!stream) throw new Error("Expected a complete backup stream");
	const chunks: Uint8Array[] = [];
	for await (const chunk of stream) chunks.push(new Uint8Array(chunk));
	const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
	return bytes;
}

async function placeDraft(page: Page) {
	const face = await page.getByTestId("room-face").first().boundingBox();
	const canvas = await page.getByTestId("plan-canvas").boundingBox();
	if (!face || !canvas) throw new Error("Expected the usable room and plan canvas");
	await page.getByTestId("plan-canvas").click({position: {x: face.x + face.width / 2 - canvas.x, y: face.y + face.height / 2 - canvas.y}});
	await page.getByTestId("item-placement-confirm").click();
	await expect(page.getByTestId("item-count")).toHaveText("1 предмет");
}

test("REVIEW-HARDEN-01: exact resource repair disables navigation and rechecks until the selected backup settles", async ({ page }) => {
	await installCatalogGatewayFake(page);
	await createRoom(page);
	await page.getByRole("button", { name: "Предметы интерьера", exact: true }).click();
	await page.getByRole("button", { name: "Аксессуары", exact: true }).click();
	await page.getByRole("button", { name: /Демонстрационная ваза —/ }).click();
	await page.getByRole("button", { name: "Показать на плане", exact: true }).click();
	await placeDraft(page);
	const bytes = await downloadBytes(page);
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-custom-assets");
			request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("resources", "readwrite");
			const store = tx.objectStore("resources");
			const request = store.getAll();
			request.onsuccess = () => { for (const record of request.result) store.put({...record, bytes: new Uint8Array([0]).buffer}); };
			tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
		});
		db.close();
	});
	await page.reload();
	await page.getByRole("button", { name: "Открыть Независимый обзор", exact: true }).click();
	const notice = page.getByTestId("resource-recovery-projection-notice");
	await expect(notice).toBeVisible();
	await page.evaluate(() => {
		const state = window as unknown as { __reviewFileReadStarted?: boolean; __reviewReleaseFileRead?: () => void };
		const original = File.prototype.arrayBuffer;
		const gate = new Promise<void>((resolve) => { state.__reviewReleaseFileRead = resolve; });
		File.prototype.arrayBuffer = function () {
			if (this.name !== "repair.interiors") return original.call(this);
			state.__reviewFileReadStarted = true;
			return gate.then(() => original.call(this));
		};
	});
	await page.getByLabel("Выбрать резервную копию для восстановления моделей").evaluate((input, data) => {
		const transfer = new DataTransfer();
		transfer.items.add(new File([new Uint8Array(data)], "repair.interiors", {type: "application/octet-stream"}));
		(input as HTMLInputElement).files = transfer.files;
		input.dispatchEvent(new Event("change", {bubbles: true}));
	}, Array.from(bytes));
	await expect.poll(() => page.evaluate(() => (window as unknown as { __reviewFileReadStarted?: boolean }).__reviewFileReadStarted)).toBe(true);
	try {
		await expect(notice.getByRole("button", { name: "Повторить проверку", exact: true })).toBeDisabled({timeout: 1000});
		await expect(notice.getByRole("button", { name: "Вернуться к проектам", exact: true })).toBeDisabled();
		await expect(page.getByTestId("editor-top-bar").getByRole("button", { name: "Вернуться к проектам", exact: true })).toBeDisabled();
	} finally {
		await page.evaluate(() => (window as unknown as { __reviewReleaseFileRead?: () => void }).__reviewReleaseFileRead?.());
	}
	await expect(notice).not.toBeVisible();
	await expect(page.getByRole("button", { name: "Стена", exact: true })).toBeEnabled();
});

test("REVIEW-HARDEN-02: a fresh item color confirmation does not inherit an earlier invalid-dimension error", async ({ page }) => {
	await installCatalogGatewayFake(page);
	await createRoom(page);
	await page.getByRole("button", { name: "Предметы интерьера", exact: true }).click();
	const catalog = page.getByRole("dialog", { name: "Предметы интерьера", exact: true });
	await catalog.getByTestId("catalog-authoring").getByText("Импорт модели", { exact: true }).click();
	await catalog.getByRole("button", { name: "Создать макетный предмет", exact: true }).click();
	const composer = catalog.getByRole("form", { name: "Создать макетный предмет", exact: true });
	await composer.getByLabel("Название макетного предмета").fill("Проверка цвета");
	await composer.getByRole("button", { name: "Начать размещение", exact: true }).click();
	await placeDraft(page);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("schematic-item").click();
	const inspector = page.getByTestId("selected-item-inspector");
	if (!(await inspector.isVisible())) {
		const action = page.getByRole("button", { name: "Параметры выбранного предмета", exact: true });
		if (!(await action.isVisible())) await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
		await action.click();
		await expect(inspector).toBeVisible();
	} else if ((await inspector.getAttribute("data-inspector-expanded")) !== "true") {
		await page.getByRole("button", { name: "Развернуть панель предмета", exact: true }).click();
	}
	const width = page.getByLabel("Ширина выбранного предмета, мм");
	await width.fill("0");
	await width.press("Enter");
	await expect(page.locator("#dimension-error")).toBeVisible();
	await page.getByRole("button", { name: "Выбрать вариант цвета предмета Глубокий синий", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Подтвердить вариант цвета", exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("alert")).toHaveCount(0);
	await dialog.getByRole("button", { name: "Отменить вариант", exact: true }).click();
});
