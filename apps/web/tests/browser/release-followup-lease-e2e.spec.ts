import { expect, type Page, test } from "@playwright/test";
import type { Project } from "../../src/domain/project";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function durableState(page: Page) {
	return page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<{
				project: Project;
				pointers: readonly unknown[];
				revisions: readonly unknown[];
			}>((resolve, reject) => {
				const transaction = database.transaction(
					["projects", "revisions"],
					"readonly",
				);
				const pointers = transaction.objectStore("projects").getAll();
				const revisions = transaction.objectStore("revisions").getAll();
				transaction.oncomplete = () => {
					const current = revisions.result.find(
						(record) =>
							record.candidate.revision.revisionId ===
							pointers.result[0]?.currentRevisionId,
					);
					if (!current) return reject(new Error("Expected a durable Project"));
					resolve({
						project: current.candidate.project,
						pointers: pointers.result,
						revisions: revisions.result,
					});
				};
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			database.close();
		}
	});
}

async function takeOverEditing(page: Page) {
	await page
		.getByRole("button", { name: "Взять редактирование на себя", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Подтвердить перехват", exact: true })
		.click();
	await expect(page.getByTestId("writer-lease-notice")).toHaveCount(0);
}

for (const kind of ["Door", "Window"] as const) {
	test(`FOLLOWUP-LEASE-${kind}: writer takeover retires an unconfirmed opening move without changing the Project`, async ({
		page,
	}) => {
		await installCatalogGatewayFake(page);
		await page.goto("/");
		const projectName = `Перемещение ${kind} в двух окнах`;
		await page
			.getByRole("button", { name: "Новый проект", exact: true })
			.click();
		await page
			.getByRole("textbox", { name: "Название проекта" })
			.fill(projectName);
		await page
			.getByRole("button", { name: "Создать проект", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Создать контур", exact: true })
			.click();
		await expect(page.getByTestId("room-face")).toHaveCount(1);
		await page
			.getByRole("button", { name: "Рука и выбор", exact: true })
			.click();
		await page.getByTestId("wall-segment").first().click();
		await page
			.getByRole("button", { name: "Добавить проём", exact: true })
			.click();
		if (kind === "Window")
			await page.getByRole("button", { name: "Окно", exact: true }).click();
		await page.getByRole("button", { name: "Добавить", exact: true }).click();
		await expect(
			page.getByTestId(kind === "Window" ? "window-opening" : "door-opening"),
		).toHaveCount(1);
		await expect(
			page.getByTestId("editor-top-bar").getByRole("status"),
		).toHaveText("Сохранено");
		const before = await durableState(page);
		expect(before.project.level.openings).toHaveLength(1);
		expect(before.project.level.openings[0]?.kind).toBe(kind);
		const handle = page.getByTestId("opening-move-handle");
		await handle.focus();
		await page.keyboard.press("ArrowRight");
		const confirmation = page.getByRole("dialog", {
			name:
				kind === "Window"
					? "Подтвердить перемещение окна"
					: "Подтвердить перемещение проёма",
			exact: true,
		});
		await expect(confirmation).toBeVisible();
		await expect(
			confirmation.getByRole("button", { name: "Подтвердить", exact: true }),
		).toBeEnabled();
		expect(await durableState(page)).toEqual(before);

		const other = await page.context().newPage();
		await installCatalogGatewayFake(other);
		await other.goto("/");
		await other
			.getByRole("button", { name: `Открыть ${projectName}`, exact: true })
			.click();
		await expect(other.getByTestId("writer-lease-notice")).toBeVisible();
		await takeOverEditing(other);
		await page.bringToFront();
		await page.evaluate(() =>
			document.dispatchEvent(new Event("visibilitychange")),
		);
		await expect(page.getByTestId("writer-lease-notice")).toBeVisible();
		expect(await durableState(page)).toEqual(before);
		await expect(confirmation).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Стена", exact: true }),
		).toBeDisabled();

		await takeOverEditing(page);
		await expect(confirmation).toHaveCount(0);
		expect(await durableState(page)).toEqual(before);
		// Taking the lease back never restores the discarded offset. A new move
		// remains available and can be cancelled without publishing a Revision.
		await handle.focus();
		await page.keyboard.press("ArrowRight");
		await expect(confirmation).toBeVisible();
		await confirmation
			.getByRole("button", { name: "Отмена", exact: true })
			.click();
		await expect(confirmation).toHaveCount(0);
		expect(await durableState(page)).toEqual(before);
	});
}
