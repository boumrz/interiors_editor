import { expect, type Page, test } from "@playwright/test";
import type { PublicationCandidate } from "../../src/application/ports";
import type { Project } from "../../src/domain/project";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function createRoom(page: Page) {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Режим после создания");
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

async function snapshot(
	page: Page,
): Promise<{ project: Project; revisions: number; revisionId: string }> {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			const read = (store: string) =>
				new Promise<unknown[]>((resolve, reject) => {
					const request = db
						.transaction(store, "readonly")
						.objectStore(store)
						.getAll();
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
			const projects = (await read("projects")) as {
				currentRevisionId: string;
			}[];
			const revisions = (await read("revisions")) as {
				revisionId: string;
				candidate: { project: Project };
			}[];
			const current = revisions.find(
				(revision) => revision.revisionId === projects[0]?.currentRevisionId,
			);
			if (!current) throw new Error("Expected one durable test Project");
			return {
				project: current.candidate.project,
				revisionId: current.revisionId,
				revisions: revisions.length,
			};
		} finally {
			db.close();
		}
	});
}

async function wallEnds(page: Page, index: number) {
	return page
		.getByTestId("wall-line")
		.nth(index)
		.evaluate((element) => {
			if (!(element instanceof SVGLineElement))
				throw new Error("Expected wall geometry");
			const matrix = element.getScreenCTM();
			if (!matrix) throw new Error("Expected wall projection");
			const point = (x: number, y: number) => {
				const result = new DOMPoint(x, y).matrixTransform(matrix);
				return { x: result.x, y: result.y };
			};
			return {
				start: point(element.x1.baseVal.value, element.y1.baseVal.value),
				end: point(element.x2.baseVal.value, element.y2.baseVal.value),
			};
		});
}

async function touchDrag(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
) {
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ id: 1, ...from }],
		});
		for (let step = 1; step <= 6; step++)
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [
					{
						id: 1,
						x: from.x + ((to.x - from.x) * step) / 6,
						y: from.y + ((to.y - from.y) * step) / 6,
					},
				],
			});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
}

async function drawDivider(page: Page) {
	await page.getByRole("button", { name: "Стена", exact: true }).click();
	const top = await wallEnds(page, 0);
	const bottom = await wallEnds(page, 2);
	await touchDrag(
		page,
		{ x: (top.start.x + top.end.x) / 2, y: (top.start.y + top.end.y) / 2 },
		{
			x: (bottom.start.x + bottom.end.x) / 2,
			y: (bottom.start.y + bottom.end.y) / 2,
		},
	);
	await expect(page.getByTestId("wall-draft-actions")).toBeVisible();
	await page
		.getByRole("button", { name: "Подтвердить стену", exact: true })
		.click();
}

test("CREATION-01: a durable wall returns to Hand and the next real touch pans without creating another wall", async ({
	page,
}) => {
	await createRoom(page);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	const before = await snapshot(page);
	await drawDivider(page);
	await expect
		.poll(async () => (await snapshot(page)).revisions)
		.toBe(before.revisions + 1);
	await expect(page.getByTestId("wall-segment")).toHaveCount(7);
	const canvas = page.getByTestId("plan-canvas");
	await expect(canvas).toHaveAttribute("data-active-tool", "select");
	const durable = await snapshot(page);
	const face = await page.getByTestId("room-face").first().boundingBox();
	if (!face) throw new Error("Expected a room for the next pan");
	const transform = await page
		.getByTestId("plan-content")
		.getAttribute("transform");
	await touchDrag(
		page,
		{ x: face.x + face.width / 2, y: face.y + face.height / 2 },
		{ x: face.x + face.width / 2 + 28, y: face.y + face.height / 2 + 18 },
	);
	await expect(page.getByTestId("plan-content")).not.toHaveAttribute(
		"transform",
		transform ?? "",
	);
	expect(await snapshot(page)).toEqual(durable);
	await expect(page.getByTestId("wall-draft")).toHaveCount(0);
});

test("CREATION-02: failed wall publication preserves its exact recovery candidate and wall mode until retry becomes durable and returns to Hand", async ({
	page,
}) => {
	await createRoom(page);
	const before = await snapshot(page);
	await page.evaluate(() => {
		const original = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === "revisions") {
				IDBObjectStore.prototype.put = original;
				throw new DOMException("Creation test quota", "QuotaExceededError");
			}
			return original.apply(this, args);
		};
	});
	await drawDivider(page);
	const retry = page.getByRole("button", {
		name: "Повторить сохранение",
		exact: true,
	});
	await expect(retry).toBeVisible();
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"wall",
	);
	// The controller owns this exact retry candidate; it is no longer a cancellable wall draft.
	await expect(page.getByTestId("wall-draft")).toHaveCount(0);
	expect(await snapshot(page)).toEqual(before);
	const downloaded = page.waitForEvent("download");
	await page
		.getByRole("button", { name: "Скачать несохранённую правку", exact: true })
		.click();
	const download = await downloaded;
	expect(download.suggestedFilename()).toMatch(/\.interiors-recovery\.json$/);
	const stream = await download.createReadStream();
	if (!stream) throw new Error("Expected the exact pending recovery file");
	const decoder = new TextDecoder();
	let text = "";
	for await (const chunk of stream as AsyncIterable<Uint8Array>)
		text += decoder.decode(chunk, { stream: true });
	text += decoder.decode();
	const recovery = JSON.parse(text) as {
		format: string;
		durability: string;
		candidate: PublicationCandidate;
	};
	expect(recovery.format).toBe("interiors-recovery-draft");
	expect(recovery.durability).toBe("unpublished");
	expect(recovery.candidate.project.level.wallSegments).toHaveLength(7);
	expect(recovery.candidate.revision.revisionId).not.toBe(before.revisionId);
	expect(JSON.parse(recovery.candidate.revision.serializedProject)).toEqual(
		recovery.candidate.project,
	);
	expect(await snapshot(page)).toEqual(before);
	await retry.click();
	await expect
		.poll(async () => (await snapshot(page)).revisions)
		.toBe(before.revisions + 1);
	await expect(page.getByTestId("wall-segment")).toHaveCount(7);
	const saved = await snapshot(page);
	expect(saved.revisionId).toBe(recovery.candidate.revision.revisionId);
	expect(saved.project).toEqual(recovery.candidate.project);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect(page.getByTestId("wall-draft")).toHaveCount(0);
});

test("CREATION-03: new and edited Windows expose no sill control while exact default sill survives size editing and reopening", async ({
	page,
}) => {
	await createRoom(page);
	await page.getByTestId("wall-segment").first().click();
	await page
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	await page
		.getByRole("dialog", { name: "Новый проём", exact: true })
		.getByRole("button", { name: "Окно", exact: true })
		.click();
	const creation = page.getByRole("dialog", {
		name: "Новое окно",
		exact: true,
	});
	await expect(creation).toBeVisible();
	await expect(
		creation.getByRole("textbox", { name: /подоконник|нижняя отметка/i }),
	).toHaveCount(0);
	const before = await snapshot(page);
	await creation.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect(page.getByTestId("window-opening")).toHaveCount(1);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect
		.poll(async () => (await snapshot(page)).project.level.openings[0]?.sillMm)
		.toBe(900);
	expect((await snapshot(page)).revisions).toBe(before.revisions + 1);
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	await page
		.getByRole("button", { name: "Изменить окно", exact: true })
		.click();
	const edit = page.getByTestId("opening-draft");
	await expect(
		edit.getByRole("textbox", { name: /подоконник|нижняя отметка/i }),
	).toHaveCount(0);
	await edit
		.getByRole("textbox", { name: "Ширина окна, мм", exact: true })
		.fill("1300");
	await edit
		.getByRole("button", { name: "Сохранить окно", exact: true })
		.click();
	await expect(edit).toHaveCount(0);
	await expect
		.poll(async () => (await snapshot(page)).project.level.openings[0])
		.toMatchObject({ widthMm: 1300, sillMm: 900 });
	const saved = await snapshot(page);
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Режим после создания", exact: true })
		.click();
	expect(await snapshot(page)).toEqual(saved);
});

test("CREATION-04: adding a Door returns to Hand and publishes its exact floor-level opening once", async ({
	page,
}) => {
	await createRoom(page);
	await page.getByTestId("wall-segment").first().click();
	const before = await snapshot(page);
	await page
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	await page
		.getByRole("dialog", { name: "Новый проём", exact: true })
		.getByRole("button", { name: "Добавить", exact: true })
		.click();
	await expect(page.getByTestId("door-opening")).toHaveCount(1);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect
		.poll(async () => (await snapshot(page)).revisions)
		.toBe(before.revisions + 1);
	expect((await snapshot(page)).project.level.openings[0]).toMatchObject({
		kind: "Door",
		sillMm: 0,
		widthMm: 900,
	});
});

test("CREATION-05: confirmed furniture placement returns to Hand with no armed second creation", async ({
	page,
}) => {
	await createRoom(page);
	const before = await snapshot(page);
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalog = page.getByRole("dialog", {
		name: "Предметы интерьера",
		exact: true,
	});
	await catalog
		.getByTestId("catalog-authoring")
		.getByText("Импорт модели", { exact: true })
		.click();
	await catalog
		.getByRole("button", { name: "Создать макетный предмет", exact: true })
		.click();
	const composer = catalog.getByRole("form", {
		name: "Создать макетный предмет",
		exact: true,
	});
	await composer.getByLabel("Название макетного предмета").fill("Один стол");
	await composer.getByLabel("Ширина макетного предмета, мм").fill("800");
	await composer.getByLabel("Глубина макетного предмета, мм").fill("500");
	await composer
		.getByRole("button", { name: "Начать размещение", exact: true })
		.click();
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"item",
	);
	const face = await page.getByTestId("room-face").boundingBox();
	if (!face) throw new Error("Expected the room for furniture placement");
	await page.mouse.click(face.x + face.width / 2, face.y + face.height / 2);
	await expect(page.getByTestId("item-placement-confirm")).toBeEnabled();
	await page.getByTestId("item-placement-confirm").click();
	await expect(page.getByTestId("schematic-item")).toHaveCount(1);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect(page.getByTestId("item-placement-action-dock")).toHaveCount(0);
	await expect
		.poll(async () => (await snapshot(page)).revisions)
		.toBe(before.revisions + 1);
	const durable = await snapshot(page);
	await page.mouse.click(face.x + face.width / 4, face.y + face.height / 4);
	await expect(page.getByTestId("item-placement-preview")).toHaveCount(0);
	expect(await snapshot(page)).toEqual(durable);
});

async function undoFromCanvas(page: Page) {
	const undo = page.getByRole("button", {
		name: /^Отменить (действие|создание|изменение)/,
	});
	await expect(undo).toBeVisible();
	await undo.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
}

async function beginPlaceholder(page: Page) {
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalog = page.getByRole("dialog", {
		name: "Предметы интерьера",
		exact: true,
	});
	await catalog
		.getByTestId("catalog-authoring")
		.getByText("Импорт модели", { exact: true })
		.click();
	await catalog
		.getByRole("button", { name: "Создать макетный предмет", exact: true })
		.click();
	const composer = catalog.getByRole("form", {
		name: "Создать макетный предмет",
		exact: true,
	});
	await composer
		.getByLabel("Название макетного предмета")
		.fill("Несохранённый стол");
	await composer.getByLabel("Ширина макетного предмета, мм").fill("800");
	await composer.getByLabel("Глубина макетного предмета, мм").fill("500");
	await composer
		.getByRole("button", { name: "Начать размещение", exact: true })
		.click();
}

async function chooseRoomCentre(page: Page) {
	const face = await page.getByTestId("room-face").boundingBox();
	if (!face) throw new Error("Expected the current usable room");
	await page.mouse.click(face.x + face.width / 2, face.y + face.height / 2);
	await expect(page.getByTestId("item-placement-confirm")).toBeEnabled();
}

test("CREATION-06: rejected room resizing cannot consume an armed Wall tool when history later publishes another revision", async ({
	page,
}) => {
	await createRoom(page);
	const before = await snapshot(page);
	await page
		.getByRole("button", { name: "Размеры плана", exact: true })
		.click();
	const sheet = page.getByTestId("plan-dimensions-sheet");
	await sheet.getByLabel("Ширина, мм", { exact: true }).fill("0");
	await sheet
		.getByRole("button", { name: "Применить размеры", exact: true })
		.click();
	await expect(sheet.getByRole("alert")).toContainText(
		"Введите целые положительные миллиметры",
	);
	expect(await snapshot(page)).toEqual(before);
	await sheet
		.getByRole("button", { name: "Скрыть размеры плана", exact: true })
		.click();
	await page.getByRole("button", { name: "Стена", exact: true }).click();
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"wall",
	);
	await undoFromCanvas(page);
	await expect(page.getByTestId("wall-segment")).toHaveCount(0);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"wall",
	);
	expect((await snapshot(page)).revisions).toBe(before.revisions);
});

test("CREATION-07: an accepted floor publication failure consumes the placement surface while exact recovery and one retry remain available", async ({
	page,
}) => {
	await createRoom(page);
	await beginPlaceholder(page);
	await chooseRoomCentre(page);
	const before = await snapshot(page);
	await page.evaluate(() => {
		const original = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === "revisions") {
				IDBObjectStore.prototype.put = original;
				throw new DOMException("Floor creation quota", "QuotaExceededError");
			}
			return original.apply(this, args);
		};
	});
	await page.getByTestId("item-placement-confirm").click();
	const retry = page.getByRole("button", {
		name: "Повторить сохранение",
		exact: true,
	});
	await expect(retry).toBeVisible();
	await expect(page.getByTestId("item-placement-action-dock")).toHaveCount(0);
	await expect(page.getByTestId("item-placement-preview")).toHaveCount(0);
	await expect(
		page.getByRole("button", {
			name: "Отменить размещение предмета",
			exact: true,
		}),
	).toHaveCount(0);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).not.toHaveText("Сохранено");
	expect(await snapshot(page)).toEqual(before);
	const downloaded = page.waitForEvent("download");
	await page
		.getByRole("button", { name: "Скачать несохранённую правку", exact: true })
		.click();
	const stream = await (await downloaded).createReadStream();
	if (!stream)
		throw new Error("Expected the exact pending floor recovery file");
	const decoder = new TextDecoder();
	let text = "";
	for await (const chunk of stream as AsyncIterable<Uint8Array>)
		text += decoder.decode(chunk, { stream: true });
	text += decoder.decode();
	const recovery = JSON.parse(text) as {
		format: string;
		durability: string;
		candidate: PublicationCandidate;
	};
	expect(recovery.format).toBe("interiors-recovery-draft");
	expect(recovery.durability).toBe("unpublished");
	expect(recovery.candidate.project.assetInstances).toHaveLength(1);
	expect(recovery.candidate.project.assetInstances[0]?.label).toBe(
		"Несохранённый стол",
	);
	expect(recovery.candidate.revision.revisionId).not.toBe(before.revisionId);
	expect(JSON.parse(recovery.candidate.revision.serializedProject)).toEqual(
		recovery.candidate.project,
	);
	expect(await snapshot(page)).toEqual(before);
	await retry.click();
	await expect
		.poll(async () => (await snapshot(page)).revisions)
		.toBe(before.revisions + 1);
	const saved = await snapshot(page);
	expect(saved.revisionId).toBe(recovery.candidate.revision.revisionId);
	expect(saved.project).toEqual(recovery.candidate.project);
	await expect(page.getByTestId("schematic-item")).toHaveCount(1);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect(retry).toHaveCount(0);
});

test("CREATION-08: failure before GLB pinning retains a cancellable user draft and cannot arm a later history publication", async ({
	page,
}) => {
	await createRoom(page);
	const before = await snapshot(page);
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalog = page.getByRole("dialog", {
		name: "Предметы интерьера",
		exact: true,
	});
	await catalog.getByRole("button", { name: /^Кровать —/ }).click();
	const place = catalog.getByRole("button", {
		name: "Показать на плане",
		exact: true,
	});
	await expect(place).toBeEnabled();
	await place.click();
	await chooseRoomCentre(page);
	await page.evaluate(() => {
		const original = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === "resources") {
				IDBObjectStore.prototype.put = original;
				throw new DOMException("GLB pin quota", "QuotaExceededError");
			}
			return original.apply(this, args);
		};
	});
	await page.getByTestId("item-placement-confirm").click();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Предпросмотр — не сохранено");
	await expect(page.getByTestId("project-durability-status")).toHaveText(
		"Сохранено локально",
	);
	await expect(page.getByTestId("item-placement-action-dock")).toBeVisible();
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"item",
	);
	await expect(
		page.getByRole("button", {
			name: "Скачать несохранённую правку",
			exact: true,
		}),
	).toHaveCount(0);
	expect(await snapshot(page)).toEqual(before);
	await page
		.getByRole("button", { name: "Отменить размещение предмета", exact: true })
		.click();
	await page.getByRole("button", { name: "Стена", exact: true }).click();
	await undoFromCanvas(page);
	await expect(page.getByTestId("wall-segment")).toHaveCount(0);
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"wall",
	);
});
