import { expect, type Page, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function createPlan(page: Page) {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Размерный план");
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

test("DRAWING-01: passive dimensions distinguish clear and outside lengths while retired axes remain absent", async ({
	page,
}) => {
	await createPlan(page);
	const before = await revisionCount(page);
	const dimensions = page.getByTestId("drawing-dimensions");
	await expect(dimensions).toBeVisible();
	await expect(dimensions.locator("[data-dimension-clipped]")).toHaveCount(0);
	await expect(page.getByTestId("drawing-dimension-legend")).toHaveCount(0);
	await expect(dimensions.locator('[data-dimension-kind="wall"]')).toHaveCount(
		0,
	);
	await showAllDimensions(page);
	await expect(
		dimensions.locator(
			'[data-dimension-kind="wall"], [data-dimension-kind="pier"]',
		),
	).toHaveCount(0);
	await showDimensionGroups(page, ["Внешние габариты"]);
	await expect(
		dimensions.locator('[data-dimension-kind="overall"]'),
	).toHaveCount(2);
	await expect(
		dimensions.locator('[data-dimension-reference="outer"] text').first(),
	).toHaveText(/4200|3200/);
	expect(
		new Set(
			await dimensions
				.locator('[data-dimension-kind="overall"] text')
				.allTextContents(),
		),
	).toEqual(new Set(["4200", "3200"]));
	await showDimensionGroups(page, ["Внутренние размеры"]);
	await expect(
		dimensions.locator('[data-dimension-kind="room-clear"]'),
	).toHaveCount(2);
	await expect(
		dimensions.locator('[data-dimension-reference="clear"] text').first(),
	).toHaveText(/4000|3000/);
	expect(
		new Set(
			await dimensions
				.locator('[data-dimension-kind="room-clear"] text')
				.allTextContents(),
		),
	).toEqual(new Set(["4000", "3000"]));
	await expect(
		page.getByRole("button", { name: "Измерить", exact: true }),
	).toHaveCount(0);
	const labels = await dimensions.locator("text").allTextContents();
	expect(labels.every((label) => /^\d+(?:[ ,.]\d+)*$/.test(label))).toBe(true);
	await expect(dimensions).toHaveAttribute("pointer-events", "none");
	expect(await revisionCount(page)).toBe(before);
});

test("DRAWING-02: exact opening width follows a confirmed keyboard move and remains passive during zoom", async ({
	page,
}) => {
	await createPlan(page);
	await showAllDimensions(page);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	await page
		.getByRole("dialog", { name: "Новый проём", exact: true })
		.getByRole("button", { name: "Добавить", exact: true })
		.click();
	const dimensions = page.getByTestId("drawing-dimensions");
	await expect(
		dimensions.locator('[data-dimension-kind="opening"] text'),
	).toHaveText("900");
	await expect(
		dimensions.locator(
			'[data-dimension-kind="wall"], [data-dimension-kind="pier"]',
		),
	).toHaveCount(0);
	const before = await openingState(page);
	await page.getByTestId("opening-move-handle").focus();
	await page.keyboard.press("ArrowRight");
	const confirmation = page.getByRole("dialog", {
		name: "Подтвердить перемещение проёма",
		exact: true,
	});
	await expect(confirmation).toBeVisible();
	expect(await openingState(page)).toEqual(before);
	await confirmation
		.getByRole("button", { name: "Подтвердить", exact: true })
		.click();
	await expect
		.poll(() => openingState(page))
		.toEqual({
			...before,
			offsetMm: before.offsetMm + 100,
			revisions: before.revisions + 1,
		});
	await expect(
		dimensions.locator('[data-dimension-kind="opening"] text'),
	).toHaveText("900");
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	const numeric = await dimensions.locator("text").allTextContents();
	const face = await page.getByTestId("room-face").first().boundingBox();
	if (!face) throw new Error("Expected room for a canvas zoom gesture");
	await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2);
	await page.mouse.wheel(0, -100);
	await expect
		.poll(() => dimensions.locator("text").allTextContents())
		.toEqual(numeric);
});

async function revisionCount(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const r = indexedDB.open("interiors-editor-projects");
			r.onsuccess = () => resolve(r.result);
			r.onerror = () => reject(r.error);
		});
		try {
			return await new Promise<number>((resolve, reject) => {
				const r = db
					.transaction("revisions", "readonly")
					.objectStore("revisions")
					.count();
				r.onsuccess = () => resolve(r.result);
				r.onerror = () => reject(r.error);
			});
		} finally {
			db.close();
		}
	});
}
async function undo(page: Page) {
	const undo = page.getByRole("button", { name: /^Отменить действие/ });
	await expect(undo).toBeVisible();
	await undo.click();
}
async function openingState(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<{
				offsetMm: number;
				widthMm: number;
				revisions: number;
			}>((resolve, reject) => {
				const tx = db.transaction(["projects", "revisions"], "readonly");
				const projects = tx.objectStore("projects").getAll();
				const revisions = tx.objectStore("revisions").getAll();
				tx.oncomplete = () => {
					const revision = revisions.result.find(
						(value) =>
							value.revisionId === projects.result[0]?.currentRevisionId,
					);
					const opening = revision?.candidate.project.level.openings[0];
					if (!opening) return reject(new Error("Expected durable opening"));
					resolve({
						offsetMm: opening.offsetMm,
						widthMm: opening.widthMm,
						revisions: revisions.result.length,
					});
				};
				tx.onerror = () => reject(tx.error);
			});
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
				throw new Error("Expected SVG wall");
			const matrix = element.getScreenCTM();
			if (!matrix) throw new Error("Expected plan transform");
			const point = (x: string | null, y: string | null) => {
				const p = new DOMPoint(Number(x), Number(y)).matrixTransform(matrix);
				return { x: p.x, y: p.y };
			};
			return {
				start: point(element.getAttribute("x1"), element.getAttribute("y1")),
				end: point(element.getAttribute("x2"), element.getAttribute("y2")),
			};
		});
}

test("DRAWING-03 (MEASURE-02 replacement): narrow enlarged plan recomputes clear room dimensions after partition Undo", async ({
	page,
}) => {
	await page.setViewportSize({ width: 360, height: 740 });
	await createPlan(page);
	await page.getByRole("button", { name: "Стена", exact: true }).click();
	const top = await wallEnds(page, 0);
	const bottom = await wallEnds(page, 2);
	const from = {
		x: (top.start.x + top.end.x) / 2,
		y: (top.start.y + top.end.y) / 2,
	};
	const to = {
		x: (bottom.start.x + bottom.end.x) / 2,
		y: (bottom.start.y + bottom.end.y) / 2,
	};
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
	const clear = page
		.getByTestId("drawing-dimensions")
		.locator('[data-dimension-kind="room-clear"]');
	await expect
		.poll(() =>
			clear.evaluateAll(
				(elements) =>
					new Set(
						elements.map(
							(element) =>
								JSON.parse(
									element.getAttribute("data-dimension-id") ?? "[]",
								)[1],
						),
					).size,
			),
		)
		.toBe(2);
	expect(await clear.count()).toBeLessThanOrEqual(4);
	await expect(
		page
			.getByTestId("drawing-dimensions")
			.locator("[data-dimension-crowded], [data-dimension-clipped]"),
	).toHaveCount(0);
	const before = await revisionCount(page);
	await page.addStyleTag({ content: "html { font-size:200% !important; }" });
	await expect
		.poll(() =>
			clear.evaluateAll(
				(elements) =>
					new Set(
						elements.map(
							(element) =>
								JSON.parse(
									element.getAttribute("data-dimension-id") ?? "[]",
								)[1],
						),
					).size,
			),
		)
		.toBe(2);
	expect(await clear.count()).toBeLessThanOrEqual(4);
	await expect(
		page
			.getByTestId("drawing-dimensions")
			.locator("[data-dimension-crowded], [data-dimension-clipped]"),
	).toHaveCount(0);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	expect(await revisionCount(page)).toBe(before);
	await page.addStyleTag({ content: "html { font-size:100% !important; }" });
	await undo(page);
	await expect(clear).toHaveCount(2);
	await expect(clear.locator("text").first()).toHaveText(/4000|3000/);
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Размерный план", exact: true })
		.click();
	await expect(clear).toHaveCount(2);
});

async function placePlaceholder(page: Page, ratio: number) {
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
		.fill("Одинаковое имя");
	await composer.getByLabel("Ширина макетного предмета, мм").fill("400");
	await composer.getByLabel("Глубина макетного предмета, мм").fill("400");
	await composer
		.getByRole("button", { name: "Начать размещение", exact: true })
		.click();
	const face = await page.getByTestId("room-face").first().boundingBox();
	if (!face) throw new Error("Expected room face");
	await page.mouse.click(face.x + face.width * ratio, face.y + face.height / 2);
	await page.getByTestId("item-placement-confirm").click();
}

test("DRAWING-04 (MEASURE-03 replacement): same-name items retain identity while passive dimensions survive 3D, Plan and Undo", async ({
	page,
}) => {
	await createPlan(page);
	await placePlaceholder(page, 0.25);
	await placePlaceholder(page, 0.75);
	await expect(page.getByTestId("schematic-item")).toHaveCount(2);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	const items = page.getByTestId("schematic-item");
	const ids = await items.evaluateAll((elements) =>
		elements.map((element) =>
			element.closest("[data-item-id]")?.getAttribute("data-item-id"),
		),
	);
	expect(ids[0]).toBeTruthy();
	expect(ids[1]).toBeTruthy();
	expect(ids[0]).not.toBe(ids[1]);
	const labels = await page
		.getByTestId("drawing-dimensions")
		.locator("text")
		.allTextContents();
	const before = await revisionCount(page);
	await items.first().click();
	await page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "3D", exact: true })
		.click();
	await expect(page.getByRole("button", { name: /Измерить/ })).toHaveCount(0);
	await page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "План 2D", exact: true })
		.click();
	await expect
		.poll(() =>
			page.getByTestId("drawing-dimensions").locator("text").allTextContents(),
		)
		.toEqual(labels);
	expect(await revisionCount(page)).toBe(before);
	await undo(page);
	await expect(items).toHaveCount(1);
	await expect
		.poll(() =>
			page.getByTestId("drawing-dimensions").locator("text").allTextContents(),
		)
		.toEqual(labels);
});

test("DRAWING-05 (MEASURE-04 replacement): dimension graphics permit wall deletion and quota retry preserves the last durable plan", async ({
	page,
}) => {
	await createPlan(page);
	await showDimensionGroups(page, ["Внутренние размеры", "Внешние габариты"]);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
	const before = await revisionCount(page);
	await page.evaluate(() => {
		const original = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === "revisions") {
				IDBObjectStore.prototype.put = original;
				throw new DOMException("Test storage failure", "QuotaExceededError");
			}
			return original.apply(this, args);
		};
	});
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Свойства", exact: true })
		.click();
	await page
		.getByTestId("selected-wall-inspector")
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await page
		.getByTestId("opening-conflict-preview")
		.getByRole("button", { name: /^Удалить стену/ })
		.click();
	const retry = page.getByRole("button", {
		name: "Повторить сохранение",
		exact: true,
	});
	await expect(retry).toBeVisible();
	expect(await revisionCount(page)).toBe(before);
	await retry.click();
	await expect(
		page
			.getByTestId("drawing-dimensions")
			.locator(
				'[data-dimension-kind="wall"], [data-dimension-kind="pier"], [data-dimension-kind="room-clear"]',
			),
	).toHaveCount(0);
	await expect(page.getByTestId("wall-segment")).toHaveCount(3);
	expect(await revisionCount(page)).toBe(before + 1);
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
});

test("DRAWING-06: short enlarged screen opens display settings without a legend or camera movement", async ({
	page,
}) => {
	await page.setViewportSize({ width: 360, height: 480 });
	await createPlan(page);
	await page.addStyleTag({ content: "html {font-size:200% !important;}" });
	const before = await page
		.getByTestId("plan-content")
		.getAttribute("transform");
	await showAllDimensions(page);
	await expect(page.getByTestId("drawing-dimension-legend")).toHaveCount(0);
	await expect(
		page.getByTestId("drawing-dimensions").locator("text").first(),
	).toBeVisible();
	expect(await page.getByTestId("plan-content").getAttribute("transform")).toBe(
		before,
	);
	await expect(
		page.getByRole("button", { name: "Настроить размеры", exact: true }),
	).toBeFocused();
});

test("DRAWING-07: opening width stays exact with no retired wall or pier dimensions", async ({
	page,
}) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await createPlan(page);
	await showAllDimensions(page);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	await page
		.getByRole("dialog", { name: "Новый проём", exact: true })
		.getByRole("button", { name: "Добавить", exact: true })
		.click();
	const dimensions = page.getByTestId("drawing-dimensions");
	await expect(
		dimensions.locator('[data-dimension-kind="opening"] text'),
	).toHaveText("900");
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	const before = await openingState(page);
	await expect(
		dimensions.locator(
			'[data-dimension-kind="wall"], [data-dimension-kind="pier"]',
		),
	).toHaveCount(0);
	await expect(
		dimensions.locator("[data-dimension-crowded], [data-dimension-clipped]"),
	).toHaveCount(0);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await showDimensionGroups(page, ["Ширина проёмов"]);
	await expect(dimensions.locator("[data-dimension-kind]")).toHaveCount(1);
	await expect(dimensions.locator("text")).toHaveText("900");
	const rows = await dimensions
		.locator("line")
		.evaluateAll((elements) =>
			elements
				.filter(
					(line): line is SVGLineElement =>
						line instanceof SVGLineElement &&
						Math.abs(line.y1.baseVal.value - line.y2.baseVal.value) < 1e-6,
				)
				.map((line) => line.y1.baseVal.value),
		);
	expect(rows).toHaveLength(1);
	await expect(dimensions).toHaveAttribute("pointer-events", "none");
	expect(await openingState(page)).toEqual(before);
});

async function showDimensionGroups(page: Page, labels: readonly string[]) {
	await page
		.getByRole("button", { name: "Настроить размеры", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Размеры", exact: true });
	await dialog.getByRole("button", { name: "Скрыть всё", exact: true }).click();
	for (const label of labels) {
		await dialog
			.getByRole("tab", {
				name: label === "Ширина проёмов" ? "Проёмы" : "Помещения",
				exact: true,
			})
			.click();
		await dialog.getByRole("checkbox", { name: label, exact: true }).check();
	}
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
}

async function showAllDimensions(page: Page) {
	await page
		.getByRole("button", { name: "Настроить размеры", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Размеры", exact: true });
	await dialog
		.getByRole("button", { name: "Показать всё", exact: true })
		.click();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
}

for (const fontSize of [14, 28]) {
	test(`DRAWING-${fontSize === 14 ? "08" : "09"}: actual ${fontSize}px glyphs never overlap another number or a drawing line`, async ({
		page,
	}) => {
		await createPlan(page);
		await showAllDimensions(page);
		if (fontSize !== 14) {
			await page.addStyleTag({
				content: `[data-testid="drawing-dimensions"] text { font-size:${fontSize}px !important; }`,
			});
			await page.setViewportSize({ width: 394, height: 852 });
		}
		await page.evaluate(() => document.fonts.ready);
		await expect
			.poll(async () =>
				page.getByTestId("drawing-dimensions").evaluate((root) => {
					const labels = [...root.querySelectorAll("text")].map((element) =>
						element.getBoundingClientRect(),
					);
					if (labels.length < 2) return false;
					for (let first = 0; first < labels.length; first++)
						for (let second = first + 1; second < labels.length; second++) {
							const a = labels[first],
								b = labels[second];
							if (
								a.left < b.right &&
								b.left < a.right &&
								a.top < b.bottom &&
								b.top < a.bottom
							)
								return false;
						}
					for (const wall of root
						.closest("svg")
						?.querySelectorAll<SVGLineElement>('[data-testid="wall-line"]') ??
						[]) {
						const box = wall.getBoundingClientRect();
						const matrix = wall.getScreenCTM();
						if (!matrix) return false;
						const halfStroke =
							(Number.parseFloat(getComputedStyle(wall).strokeWidth) *
								Math.hypot(matrix.a, matrix.b)) /
							2;
						for (const label of labels)
							if (
								label.left < box.right + halfStroke + 2 &&
								label.right > box.left - halfStroke - 2 &&
								label.top < box.bottom + halfStroke + 2 &&
								label.bottom > box.top - halfStroke - 2
							)
								return false;
					}
					for (const element of root.querySelectorAll("line")) {
						const matrix = element.getScreenCTM();
						if (!matrix) return false;
						const start = new DOMPoint(
							element.x1.baseVal.value,
							element.y1.baseVal.value,
						).matrixTransform(matrix);
						const end = new DOMPoint(
							element.x2.baseVal.value,
							element.y2.baseVal.value,
						).matrixTransform(matrix);
						for (const label of labels) {
							let from = 0,
								to = 1;
							const dx = end.x - start.x,
								dy = end.y - start.y;
							const edges = [
								[-dx, start.x - label.left + 2],
								[dx, label.right + 2 - start.x],
								[-dy, start.y - label.top + 2],
								[dy, label.bottom + 2 - start.y],
							];
							let intersects = true;
							for (const [p, q] of edges) {
								if (p === 0) {
									if (q < 0) intersects = false;
									continue;
								}
								const ratio = q / p;
								if (p < 0) from = Math.max(from, ratio);
								else to = Math.min(to, ratio);
							}
							if (intersects && from <= to) return false;
						}
					}
					return true;
				}),
			)
			.toBe(true);
	});
}
