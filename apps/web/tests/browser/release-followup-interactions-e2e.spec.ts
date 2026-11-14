import { expect, type Page, test } from "@playwright/test";
import type { WallOpening } from "../../src/domain/project";

async function createPlan(page: Page) {
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Проверка взаимодействий");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(page.getByTestId("room-face")).toHaveCount(1);
}

async function savedOpening(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<{ revisions: number; opening: WallOpening }>(
				(resolve, reject) => {
					const tx = db.transaction(["projects", "revisions"], "readonly");
					const projects = tx.objectStore("projects").getAll();
					const revisions = tx.objectStore("revisions").getAll();
					tx.oncomplete = () => {
						const current = revisions.result.find(
							(record) =>
								record.candidate.revision.revisionId ===
								projects.result[0]?.currentRevisionId,
						);
						if (!current?.candidate.project.level.openings[0])
							return reject(new Error("Expected a durable opening"));
						resolve({
							revisions: revisions.result.length,
							opening: current.candidate.project.level.openings[0],
						});
					};
					tx.onerror = () => reject(tx.error);
				},
			);
		} finally {
			db.close();
		}
	});
}

test("FOLLOWUP-MENU: actions overlay the editor, trap focus and close without shifting its layout", async ({
	page,
}) => {
	await createPlan(page);
	const trigger = page.getByRole("button", {
		name: "Открыть остальные действия",
		exact: true,
	});
	const header = page.getByTestId("editor-top-bar");
	const dock = page.getByTestId("editor-action-dock");
	const before = {
		header: await header.boundingBox(),
		dock: await dock.boundingBox(),
	};
	await trigger.click();
	const menu = page.getByRole("dialog", {
		name: "Остальные действия редактора",
		exact: true,
	});
	await expect(menu).toBeVisible();
	expect(await menu.evaluate((element) => element.matches(":modal"))).toBe(
		true,
	);
	expect(await header.boundingBox()).toEqual(before.header);
	expect(await dock.boundingBox()).toEqual(before.dock);
	for (let index = 0; index < 9; index++) {
		await page.keyboard.press("Tab");
		expect(
			await menu.evaluate((element) =>
				element.contains(document.activeElement),
			),
		).toBe(true);
	}
	await page.keyboard.press("Escape");
	await expect(menu).not.toBeVisible();
	await expect(trigger).toBeFocused();
	await trigger.click();
	await page.mouse.click(2, 2);
	await expect(menu).not.toBeVisible();
	await expect(trigger).toBeFocused();
	expect(await dock.boundingBox()).toEqual(before.dock);
	await trigger.click();
	await menu
		.getByRole("button", { name: "Размеры плана", exact: true })
		.click();
	const dimensions = page.getByRole("complementary", {
		name: "Точные размеры плана",
		exact: true,
	});
	await expect(dimensions).toBeVisible();
	await expect(dimensions).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(dimensions).not.toBeVisible();
	await expect(trigger).toBeFocused();
});

test("FOLLOWUP-WALL-PROPERTIES: selection is quiet, properties own deletion and reversal is absent", async ({
	page,
}) => {
	await createPlan(page);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
	const properties = page.getByTestId("selected-wall-inspector");
	const dock = page.getByTestId("editor-action-dock");
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page.mouse.click(5, 500);
	await expect(
		page.getByRole("dialog", {
			name: "Остальные действия редактора",
			exact: true,
		}),
	).not.toBeVisible();
	await expect(
		page.locator('[data-testid="wall-body"][data-selected="true"]'),
	).toHaveCount(1);
	await expect(properties).toHaveCount(0);
	await expect(
		dock.getByRole("button", { name: "Удалить", exact: true }),
	).toHaveCount(0);
	await dock.getByRole("button", { name: "Свойства", exact: true }).click();
	await expect(properties).toBeVisible();
	await expect(
		properties.getByRole("button", { name: "Удалить стену", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Развернуть стену", exact: true }),
	).toHaveCount(0);
	await properties
		.getByRole("button", { name: "Закрыть свойства стены", exact: true })
		.click();
	await expect(properties).toHaveCount(0);
	await expect(
		dock.getByRole("button", { name: "Свойства", exact: true }),
	).toBeFocused();
	await dock.getByRole("button", { name: "Свойства", exact: true }).click();
	await properties
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await expect(page.getByTestId("wall-segment")).toHaveCount(4);
	await page
		.getByRole("button", {
			name: "Удалить стену и изменить 1 помещение",
			exact: true,
		})
		.click();
	await expect(page.getByTestId("wall-segment")).toHaveCount(3);
	await page
		.getByRole("group", { name: "История изменений" })
		.getByRole("button", { name: /^Отменить/ })
		.click();
	await expect(page.getByTestId("wall-segment")).toHaveCount(4);
});

for (const kind of ["Door", "Window"] as const) {
	test(`FOLLOWUP-OPENING-${kind}: moving only confirms position, preserves sizes and cancels without a revision`, async ({
		page,
	}) => {
		await createPlan(page);
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
		const before = await savedOpening(page);
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
		expect(
			await confirmation.evaluate((element) => element.matches(":modal")),
		).toBe(true);
		await expect(confirmation.locator("input, select, textarea")).toHaveCount(
			0,
		);
		await expect(page.getByTestId("opening-draft")).toHaveCount(0);
		expect(await savedOpening(page)).toEqual(before);
		await confirmation
			.getByRole("button", { name: "Отмена", exact: true })
			.click();
		await expect(confirmation).toHaveCount(0);
		expect(await savedOpening(page)).toEqual(before);
		await handle.focus();
		await page.keyboard.press("ArrowRight");
		await expect(confirmation).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(confirmation).toHaveCount(0);
		expect(await savedOpening(page)).toEqual(before);
		await handle.focus();
		await page.keyboard.press("ArrowRight");
		await confirmation
			.getByRole("button", { name: "Подтвердить", exact: true })
			.click();
		await expect(confirmation).toHaveCount(0);
		await expect
			.poll(() => savedOpening(page))
			.toEqual({
				revisions: before.revisions + 1,
				opening: { ...before.opening, offsetMm: before.opening.offsetMm + 100 },
			});
		await page
			.getByRole("group", { name: "История изменений" })
			.getByRole("button", { name: /^Отменить/ })
			.click();
		await expect
			.poll(async () => (await savedOpening(page)).opening)
			.toEqual(before.opening);
		await page.reload();
		await page
			.getByRole("button", {
				name: "Открыть Проверка взаимодействий",
				exact: true,
			})
			.click();
		await expect(page.getByTestId("editor-workspace")).toBeVisible();
		expect((await savedOpening(page)).opening).toEqual(before.opening);
		await expect(page.getByRole("dialog")).toHaveCount(0);
	});
}
