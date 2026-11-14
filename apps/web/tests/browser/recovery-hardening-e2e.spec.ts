import { expect, test, type Page } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function room(page: Page) {
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill("Исходная сохранённая версия");
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByRole("button", { name: "Создать контур", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
}

test("RECOVERY-HARDEN-01: an unpublished change exports separately and restores as a new project", async ({ page }) => {
	await room(page);
	await page.evaluate(() => {
		const control = (window as unknown as { __interiorsTestControl: { setFault(point: "before-pointer"): void } }).__interiorsTestControl;
		control.setFault("before-pointer");
	});
	await page.getByRole("button", { name: "Переименовать проект Исходная сохранённая версия", exact: true }).click();
	const rename = page.getByRole("dialog", { name: "Переименовать проект", exact: true });
	await rename.getByRole("textbox", { name: "Новое название проекта", exact: true }).fill("Несохраненная восстановленная правка");
	await rename.getByRole("button", { name: "Сохранить название", exact: true }).click();
	await expect(rename.getByRole("button", { name: "Повторить сохранение", exact: true })).toBeVisible();
	await rename.getByRole("button", { name: "Отмена", exact: true }).click();
	const downloadEvent = page.waitForEvent("download");
	await page.getByRole("button", { name: "Скачать несохранённую правку", exact: true }).click();
	const download = await downloadEvent;
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Expected recovery file stream");
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(new Uint8Array(chunk));
  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const draft = JSON.parse(new TextDecoder().decode(bytes));
	expect(draft.format).toBe("interiors-recovery-draft");
	expect(draft.durability).toBe("unpublished");
	expect(draft.candidate.project.name).toBe("Несохраненная восстановленная правка");
	await page.reload();
	await expect(page.getByRole("button", { name: "Открыть Исходная сохранённая версия", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Восстановить несохранённую правку", exact: true }).click();
  await page.getByLabel("Выбрать файл несохранённой правки").evaluate((input, data) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data.bytes)], data.name, {type:"application/json"}));
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event("change", {bubbles:true}));
  }, {bytes:Array.from(bytes),name:download.suggestedFilename()});
	await expect(page.getByRole("button", { name: "Переименовать проект Несохраненная восстановленная правка", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Вернуться к проектам", exact: true }).click();
	await expect(page.getByRole("button", { name: "Открыть Исходная сохранённая версия", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Открыть Несохраненная восстановленная правка", exact: true })).toBeVisible();
});

test("RECOVERY-HARDEN-02: exact backup repair keeps the durable revision and restores a read-only project", async ({ page }) => {
	await installCatalogGatewayFake(page);
	await room(page);
	await page.getByRole("button", { name: "Предметы интерьера", exact: true }).click();
	await page.getByRole("button", { name: "Аксессуары", exact: true }).click();
	await page.getByRole("button", { name: /Демонстрационная ваза —/ }).click();
	await page.getByRole("button", { name: "Показать на плане", exact: true }).click();
	const face = await page.getByTestId("room-face").first().boundingBox();
	const canvas = await page.getByTestId("plan-canvas").boundingBox();
	if (!face || !canvas) throw new Error("Expected the derived room");
	await page.getByTestId("plan-canvas").click({ position: { x: face.x + face.width / 2 - canvas.x, y: face.y + face.height / 2 - canvas.y } });
	await page.getByTestId("item-placement-confirm").click();
	await expect(page.getByTestId("item-count")).toHaveText("1 предмет");
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	const downloadEvent = page.waitForEvent("download");
	await page.getByRole("button", { name: "Экспортировать проект", exact: true }).click();
	const backup = await downloadEvent;
	const stream = await backup.createReadStream();
	if (!stream) throw new Error("Expected a complete backup");
	const chunks: Uint8Array[] = [];
	for await (const chunk of stream) chunks.push(new Uint8Array(chunk));
	const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
	const before = await currentRevision(page);
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-custom-assets");
			request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("resources", "readwrite");
			const store = tx.objectStore("resources");
			const request = store.getAll();
			request.onsuccess = () => { for (const record of request.result) store.put({ ...record, bytes: new Uint8Array([0]).buffer }); };
			tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
		});
		db.close();
	});
	await page.reload();
	await page.getByRole("button", { name: "Открыть Исходная сохранённая версия", exact: true }).click();
	await expect(page.getByTestId("resource-recovery-projection-notice")).toBeVisible();
	await expect(page.getByRole("button", { name: "Стена", exact: true })).toBeDisabled();
	await page.getByLabel("Выбрать резервную копию для восстановления моделей").evaluate((input, data) => {
		const transfer = new DataTransfer();
		transfer.items.add(new File([new Uint8Array(data)], "repair.interiors", { type: "application/octet-stream" }));
		(input as HTMLInputElement).files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, Array.from(bytes));
	await expect(page.getByTestId("resource-recovery-projection-notice")).not.toBeVisible();
	await expect(page.getByRole("button", { name: "Стена", exact: true })).toBeEnabled();
	expect(await currentRevision(page)).toBe(before);
});

async function currentRevision(page: Page): Promise<string> {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
		});
		try { return await new Promise<string>((resolve, reject) => {
			const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
			request.onsuccess = () => resolve(request.result[0]?.currentRevisionId ?? ""); request.onerror = () => reject(request.error);
		}); } finally { db.close(); }
	});
}
