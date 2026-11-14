import { expect, type Page } from "@playwright/test";

export async function savedBrowserRecords(page: Page) {
	return page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onupgradeneeded = () => {
				request.transaction?.abort();
				reject(new Error("Expected the existing browser database"));
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			const transaction = database.transaction(
				["projects", "revisions", "staging"], "readonly",
			);
			const rows = (store: string) => new Promise<unknown[]>((resolve, reject) => {
				const request = transaction.objectStore(store).getAll();
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const [projects, revisions, staging] = await Promise.all([
				rows("projects"), rows("revisions"), rows("staging"),
			]);
			return {
				version: database.version,
				stores: Array.from(database.objectStoreNames),
				projects, revisions, staging,
			};
		} finally {
			database.close();
		}
	});
}

export async function createSavedBrowserRoom(page: Page, name: string) {
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByLabel("Название проекта").fill(name);
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByRole("button", { name: "Создать контур", exact: true }).click();
	await expect(page.getByTestId("plan-width")).toHaveText("4000 мм");
	await expect(page.getByTestId("project-durability-status")).toContainText("Сохранено локально");
}

export async function openSavedBrowserRoom(page: Page, name: string, width = 4000) {
	await page.getByRole("button", { name: `Открыть ${name}`, exact: true }).click();
	await expect(page.getByTestId("plan-width")).toHaveText(`${width} мм`);
	await expect(page.getByTestId("project-durability-status")).toContainText("Сохранено локально");
}
