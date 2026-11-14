import { expect, type Page, test } from "@playwright/test";
import type { WallOpening } from "../../src/domain/project";

async function openingSnapshot(page: Page) {
	return page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<{
				revisions: number;
				opening: WallOpening | undefined;
				openingCount: number;
			}>((resolve, reject) => {
				const transaction = database.transaction(
					["projects", "revisions"],
					"readonly",
				);
				const projects = transaction.objectStore("projects").getAll();
				const revisions = transaction.objectStore("revisions").getAll();
				transaction.oncomplete = () => {
					const current = revisions.result.find(
						(record) =>
							record.candidate.revision.revisionId ===
							projects.result[0]?.currentRevisionId,
					);
					if (!current) return reject(new Error("Expected the saved project"));
					const openings = current.candidate.project.level.openings;
					resolve({
						revisions: revisions.result.length,
						opening: openings[0],
						openingCount: openings.length,
					});
				};
				transaction.onerror = () => reject(transaction.error);
			});
		} finally {
			database.close();
		}
	});
}

test("REL-16-RECOVERY: a confirmed window move belongs to recovery after quota failure and retry publishes it once", async ({
	page,
}) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Окно после сбоя");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
	await page
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	await page.getByRole("button", { name: "Окно", exact: true }).click();
	await page.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect(page.getByTestId("window-opening")).toHaveCount(1);
	const before = await openingSnapshot(page);
	if (!before.opening) throw new Error("Expected the saved window");
	await page.getByTestId("opening-move-handle").focus();
	await page.keyboard.press("ArrowRight");
	const draft = page.getByRole("dialog", {
		name: "Подтвердить перемещение окна",
		exact: true,
	});
	await expect(draft).toBeVisible();
	await expect(draft.locator("input, select, textarea")).toHaveCount(0);
	expect(await openingSnapshot(page)).toEqual(before);
	await page.evaluate(() => {
		const original = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === "revisions") {
				IDBObjectStore.prototype.put = original;
				throw new DOMException("Window recovery quota", "QuotaExceededError");
			}
			return original.apply(this, args);
		};
	});
	await draft.getByRole("button", { name: "Подтвердить", exact: true }).click();
	const failure = page.getByTestId("persistence-failure-notice");
	await expect(failure).toBeVisible();
	expect(await openingSnapshot(page)).toEqual(before);
	// The exact accepted candidate now belongs to the controller's retry flow,
	// so there must be no second, cancellable confirmation of the same move.
	await expect(draft).toHaveCount(0);
	await expect(page.getByTestId("opening-draft")).toHaveCount(0);
	await failure
		.getByRole("button", { name: "Повторить сохранение", exact: true })
		.click();
	await expect(failure).toHaveCount(0);
	await expect
		.poll(async () => (await openingSnapshot(page)).revisions)
		.toBe(before.revisions + 1);
	expect((await openingSnapshot(page)).opening).toEqual({
		...before.opening,
		offsetMm: before.opening.offsetMm + 100,
	});
	await expect(draft).toHaveCount(0);
	await expect(page.getByTestId("opening-draft")).toHaveCount(0);
	const undo = page
		.getByRole("group", { name: "История изменений" })
		.getByRole("button", { name: /^Отменить/ });
	await expect(undo).toBeEnabled();
	await undo.click();
	await expect
		.poll(async () => (await openingSnapshot(page)).opening?.offsetMm)
		.toBe(before.opening.offsetMm);
});

for (const kind of ["Door", "Window"] as const) {
	test(`REL-16-RECOVERY-CREATE-${kind}: a confirmed opening creation transfers its exact candidate to retry without a duplicate modal`, async ({
		page,
	}) => {
		await page.goto("/");
		await page
			.getByRole("button", { name: "Новый проект", exact: true })
			.click();
		await page
			.getByRole("textbox", { name: "Название проекта" })
			.fill(`Создание ${kind}`);
		await page
			.getByRole("button", { name: "Создать проект", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Создать контур", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Рука и выбор", exact: true })
			.click();
		await page.getByTestId("wall-segment").first().click();
		await page
			.getByRole("button", { name: "Добавить проём", exact: true })
			.click();
		if (kind === "Window")
			await page.getByRole("button", { name: "Окно", exact: true }).click();
		const draft = page.getByTestId("opening-creation-draft");
		await draft
			.getByRole("textbox", { name: "Ширина, мм", exact: true })
			.fill(kind === "Window" ? "1300" : "1000");
		const before = await openingSnapshot(page);
		expect(before.openingCount).toBe(0);
		await page.evaluate(() => {
			const original = IDBObjectStore.prototype.put;
			IDBObjectStore.prototype.put = function (...args) {
				if (this.name === "revisions") {
					IDBObjectStore.prototype.put = original;
					throw new DOMException(
						"Opening creation quota",
						"QuotaExceededError",
					);
				}
				return original.apply(this, args);
			};
		});
		await draft.getByRole("button", { name: "Добавить", exact: true }).click();
		const failure = page.getByTestId("persistence-failure-notice");
		await expect(failure).toBeVisible();
		expect(await openingSnapshot(page)).toEqual(before);
		await expect(draft).toHaveCount(0);
		const downloadEvent = page.waitForEvent("download");
		await failure
			.getByRole("button", {
				name: "Скачать несохранённую правку",
				exact: true,
			})
			.click();
		const download = await downloadEvent;
		const stream = await download.createReadStream();
		if (!stream) throw new Error("Expected the exact recovery candidate");
		const decoder = new TextDecoder();
		let recoveryText = "";
		for await (const chunk of stream as AsyncIterable<Uint8Array>)
			recoveryText += decoder.decode(chunk, { stream: true });
		recoveryText += decoder.decode();
		const recovery = JSON.parse(recoveryText) as {
			candidate: { project: { level: { openings: readonly WallOpening[] } } };
		};
		expect(recovery.candidate.project.level.openings).toHaveLength(1);
		const candidateOpening = recovery.candidate.project.level.openings[0];
		expect(candidateOpening).toMatchObject({
			kind,
			widthMm: kind === "Window" ? 1300 : 1000,
		});
		await failure
			.getByRole("button", { name: "Повторить сохранение", exact: true })
			.click();
		await expect(failure).toHaveCount(0);
		await expect
			.poll(async () => (await openingSnapshot(page)).revisions)
			.toBe(before.revisions + 1);
		const after = await openingSnapshot(page);
		expect(after.openingCount).toBe(1);
		expect(after.opening).toEqual(candidateOpening);
		await expect(draft).toHaveCount(0);
		await expect(page.getByTestId("opening-draft")).toHaveCount(0);
		await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
			"data-active-tool",
			"select",
		);
		const undo = page
			.getByRole("group", { name: "История изменений" })
			.getByRole("button", { name: /^Отменить/ });
		await expect(undo).toBeEnabled();
		await undo.click();
		await expect
			.poll(async () => (await openingSnapshot(page)).openingCount)
			.toBe(0);
	});
}
