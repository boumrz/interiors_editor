import { expect, type Page, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

const preferenceKey = "interiors.editor.dimension-visibility.v1";
const groups = [
	["Внутренние размеры", "room-clear", 2],
	["Внешние габариты", "overall", 2],
	["Ширина проёмов", "opening", 1],
] as const;

async function createPlan(page: Page, name = "Фильтр размеров") {
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
	await expect(page.getByTestId("room-face")).toHaveCount(1);
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
}

async function openFilter(page: Page) {
	await page
		.getByRole("button", { name: "Настроить размеры", exact: true })
		.click();
	return page.getByRole("dialog", { name: "Размеры", exact: true });
}

async function durableSnapshot(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			const read = (name: string) =>
				new Promise<unknown[]>((resolve, reject) => {
					const request = db
						.transaction(name, "readonly")
						.objectStore(name)
						.getAll();
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
			const projects = (await read("projects")) as {
				currentRevisionId: string;
			}[];
			const revisions = (await read("revisions")) as {
				revisionId: string;
				candidate: unknown;
			}[];
			return {
				projects,
				revisions,
				currentRevision: revisions.find(
					(value) => value.revisionId === projects[0]?.currentRevisionId,
				),
			};
		} finally {
			db.close();
		}
	});
}

test("FILTER-01: internal-only default and each independent group leave geometry and durable history intact", async ({
	page,
}) => {
	await createPlan(page);
	const dimensions = page.getByTestId("drawing-dimensions");
	await expect(dimensions.locator("[data-dimension-kind]")).toHaveCount(2);
	await expect(
		dimensions.locator('[data-dimension-kind="room-clear"]'),
	).toHaveCount(2);
	await expect(page.getByTestId("drawing-dimension-legend")).toHaveCount(0);
	await expect(page.getByTestId("plan-reference-markers")).toHaveCount(0);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	await expect(
		page.getByRole("button", {
			name: "Настроить размеры",
			exact: true,
			includeHidden: true,
		}),
	).toBeDisabled();
	await page
		.getByRole("dialog", { name: "Новый проём", exact: true })
		.getByRole("button", { name: "Добавить", exact: true })
		.click();
	await expect(page.getByTestId("opening-move-handle")).toBeVisible();
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	const baseline = await durableSnapshot(page);
	const face = await page.getByTestId("room-face").boundingBox();
	const transform = await page
		.getByTestId("plan-content")
		.getAttribute("transform");
	const dialog = await openFilter(page);
	for (const [label, kind, count] of groups) {
		await dialog
			.getByRole("tab", {
				name: kind === "opening" ? "Проёмы" : "Помещения",
				exact: true,
			})
			.click();
		await dialog
			.getByRole("button", { name: "Скрыть всё", exact: true })
			.click();
		await dialog.getByRole("checkbox", { name: label, exact: true }).check();
		await expect(dimensions.locator("[data-dimension-kind]")).toHaveCount(
			count,
		);
		await expect(
			dimensions.locator(`[data-dimension-kind="${kind}"]`),
		).toHaveCount(count);
		await expect(
			dimensions.locator(
				`[data-dimension-kind]:not([data-dimension-kind="${kind}"])`,
			),
		).toHaveCount(0);
	}
	await dialog
		.getByRole("button", { name: "Показать всё", exact: true })
		.click();
	for (const [label, kind] of groups) {
		await dialog
			.getByRole("tab", {
				name: kind === "opening" ? "Проёмы" : "Помещения",
				exact: true,
			})
			.click();
		await expect(
			dialog.getByRole("checkbox", { name: label, exact: true }),
		).toBeChecked();
	}
	expect(
		await dimensions.locator("[data-dimension-kind]").count(),
	).toBeLessThanOrEqual(5);
	await expect(
		dimensions.locator("[data-dimension-crowded], [data-dimension-clipped]"),
	).toHaveCount(0);
	await dialog.getByRole("button", { name: "Скрыть всё", exact: true }).click();
	await expect(dimensions.locator("[data-dimension-kind]")).toHaveCount(0);
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	expect(await page.getByTestId("room-face").boundingBox()).toEqual(face);
	expect(await page.getByTestId("plan-content").getAttribute("transform")).toBe(
		transform,
	);
	expect(await durableSnapshot(page)).toEqual(baseline);
	await page.getByTestId("opening-move-handle").focus();
	await page.keyboard.press("ArrowRight");
	expect(await durableSnapshot(page)).toEqual(baseline);
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Подтвердить", exact: true })
		.click();
	await expect
		.poll(async () => (await durableSnapshot(page)).revisions.length)
		.toBe(baseline.revisions.length + 1);
	await expect(dimensions.locator("[data-dimension-kind]")).toHaveCount(0);
});

test("FILTER-02: all-off survives reload, another project, 3D and Undo", async ({
	page,
}) => {
	await createPlan(page);
	const dialog = await openFilter(page);
	await dialog.getByRole("button", { name: "Скрыть всё", exact: true }).click();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Фильтр размеров", exact: true })
		.click();
	await expect(page.locator("[data-dimension-kind]")).toHaveCount(0);
	await page
		.getByRole("button", { name: "Вернуться к проектам", exact: true })
		.click();
	await createPlan(page, "Второй план");
	await expect(page.locator("[data-dimension-kind]")).toHaveCount(0);
	const undo = page.getByRole("button", { name: /^Отменить действие/ });
	await expect(undo).toBeVisible();
	await undo.click();
	await expect(page.locator("[data-dimension-kind]")).toHaveCount(0);
	const redo = page.getByRole("button", { name: /^Повторить действие/ });
	await expect(redo).toBeVisible();
	await redo.click();
	await expect(page.locator("[data-dimension-kind]")).toHaveCount(0);
	const reopened = await openFilter(page);
	for (const [label, kind] of groups) {
		await reopened
			.getByRole("tab", {
				name: kind === "opening" ? "Проёмы" : "Помещения",
				exact: true,
			})
			.click();
		await expect(
			reopened.getByRole("checkbox", { name: label, exact: true }),
		).not.toBeChecked();
	}
});

for (const [name, value] of [
	["corrupt", "{"],
	["future", JSON.stringify({ version: 2, visible: {} })],
	["denied", "denied"],
] as const) {
	test(`FILTER-03 ${name}: unavailable preferences use internal-only and remain operable`, async ({
		page,
	}) => {
		await page.addInitScript(
			({ key, initial }) => {
				if (initial === "denied") {
					const { getItem, setItem } = Storage.prototype;
					Storage.prototype.getItem = function (name) {
						if (name === key) throw new DOMException("Unavailable", "SecurityError");
						return getItem.call(this, name);
					};
					Storage.prototype.setItem = function (name, next) {
						if (name === key) throw new DOMException("Unavailable", "SecurityError");
						setItem.call(this, name, next);
					};
				} else localStorage.setItem(key, initial);
			},
			{ key: preferenceKey, initial: value },
		);
		await createPlan(page);
		await expect(
			page.locator('[data-dimension-kind="room-clear"]'),
		).toHaveCount(2);
		await expect(page.locator('[data-dimension-kind="wall"]')).toHaveCount(0);
		const dialog = await openFilter(page);
		await dialog
			.getByRole("checkbox", { name: "Внешние габариты", exact: true })
			.check();
		await expect(page.locator('[data-dimension-kind="overall"]')).toHaveCount(
			2,
		);
	});
}

test("FILTER-05: placement keeps identity and cancel before the first point without instructions", async ({
	page,
}) => {
	await createPlan(page);
	const baseline = await durableSnapshot(page);
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
		.fill("Кресло для проверки");
	await composer
		.getByRole("button", { name: "Начать размещение", exact: true })
		.click();
	await expect(page.getByTestId("item-draft-hint")).toHaveCount(0);
	await expect(page.getByTestId("item-placement-identity")).toHaveText(
		"Кресло для проверки",
	);
	await expect(page.getByTestId("item-placement-feedback")).toHaveCount(0);
	await expect(page.getByTestId("item-placement-confirm")).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Настроить размеры", exact: true }),
	).toBeDisabled();
	await page.getByTestId("item-placement-cancel").click();
	await expect(page.getByTestId("item-placement-action-dock")).toHaveCount(0);
	expect(await durableSnapshot(page)).toEqual(baseline);
});

test("PLACEMENT-2D-01: rotate before installation, show the control immediately and publish the same pose once", async ({
	page,
}) => {
	await createPlan(page);
	const baseline = await durableSnapshot(page);
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
		.fill("Поворот до установки");
	await composer.getByLabel("Ширина макетного предмета, мм").fill("1200");
	await composer.getByLabel("Глубина макетного предмета, мм").fill("400");
	await composer
		.getByRole("button", { name: "Начать размещение", exact: true })
		.click();
	await page
		.getByRole("button", {
			name: "Повернуть размещаемый предмет вправо на 45°",
			exact: true,
		})
		.click();
	await expect(page.getByTestId("item-placement-angle")).toHaveText("45°");
	const face = await page.getByTestId("room-face").boundingBox();
	if (!face) throw new Error("Expected actual room geometry");
	await page.mouse.click(face.x + face.width / 2, face.y + face.height / 2);
	const handle = page.getByTestId("item-placement-rotation-handle");
	await expect(handle).toBeVisible();
	const ring = await handle.evaluate((element) => {
		if (!(element instanceof SVGCircleElement))
			throw new Error("Expected rotation circle");
		const matrix = element.getScreenCTM();
		if (!matrix) throw new Error("Expected actual plan transform");
		const center = new DOMPoint(
			element.cx.baseVal.value,
			element.cy.baseVal.value,
		).matrixTransform(matrix);
		const edge = new DOMPoint(
			element.cx.baseVal.value + element.r.baseVal.value,
			element.cy.baseVal.value,
		).matrixTransform(matrix);
		return { x: center.x, y: center.y, radius: edge.x - center.x };
	});
	const input = await page.context().newCDPSession(page);
	const touch = (x: number, y: number) => ({ x, y, id: 8 });
	await input.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [touch(ring.x, ring.y + ring.radius)],
	});
	await input.send("Input.dispatchTouchEvent", {
		type: "touchMove",
		touchPoints: [touch(ring.x + ring.radius, ring.y)],
	});
	await expect(page.getByTestId("item-placement-angle")).toHaveText("135°");
	await input.send("Input.dispatchTouchEvent", {
		type: "touchCancel",
		touchPoints: [],
	});
	await expect(page.getByTestId("item-placement-angle")).toHaveText("45°");
	expect(await durableSnapshot(page)).toEqual(baseline);
	await input.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [touch(ring.x, ring.y + ring.radius)],
	});
	await input.send("Input.dispatchTouchEvent", {
		type: "touchMove",
		touchPoints: [touch(ring.x + ring.radius, ring.y)],
	});
	await input.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
	await expect(page.getByTestId("item-placement-angle")).toHaveText("135°");
	await handle.focus();
	await page.keyboard.press("ArrowLeft");
	await expect(page.getByTestId("item-placement-angle")).toHaveText("90°");
	expect(await durableSnapshot(page)).toEqual(baseline);
	await page.getByTestId("item-placement-confirm").click();
	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect
		.poll(async () => (await durableSnapshot(page)).revisions.length)
		.toBe(baseline.revisions.length + 1);
	const snapshot = await durableSnapshot(page);
	expect(snapshot.currentRevision).toMatchObject({
		candidate: { project: { assetInstances: [{ yawStep: 2 }] } },
	});
	await expect(
		page.getByTestId("schematic-item").locator(".."),
	).toHaveAttribute("transform", /^rotate\(-90 /);
	await page.getByTestId("schematic-item").click();
	await expect(
		page.getByText("Нажмите «Параметры», чтобы раскрыть настройки.", {
			exact: true,
		}),
	).toHaveCount(0);
});

for (const viewport of [
	{ width: 320, height: 568 },
	{ width: 360, height: 480 },
	{ width: 430, height: 932 },
	{ width: 852, height: 393 },
]) {
	test(`FILTER-04 ${viewport.width}x${viewport.height}: accessible sheet fits enlarged text and restores focus`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		await createPlan(page);
		await page.addStyleTag({ content: "html { font-size:200% !important; }" });
		const dialog = await openFilter(page);
		for (const [label, kind] of groups) {
			await dialog
				.getByRole("tab", {
					name: kind === "opening" ? "Проёмы" : "Помещения",
					exact: true,
				})
				.click();
			const target = dialog
				.getByRole("checkbox", { name: label, exact: true })
				.locator("..");
			expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44);
		}
		expect(
			await dialog.evaluate(
				(element) => element.scrollWidth <= element.clientWidth,
			),
		).toBe(true);
		for (let index = 0; index < 12; index++) {
			await page.keyboard.press("Tab");
			expect(
				await dialog.evaluate((element) =>
					element.contains(document.activeElement),
				),
			).toBe(true);
		}
		await page.keyboard.press("Escape");
		await expect(dialog).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Настроить размеры", exact: true }),
		).toBeFocused();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
	});
}

test("FILTER-06: legacy axial preferences stay retired and main tabs have keyboard navigation", async ({
	page,
}) => {
	await page.addInitScript(
		({ key }) =>
			localStorage.setItem(
				key,
				JSON.stringify({
					version: 1,
					visible: {
						wall: true,
						pier: true,
						opening: true,
						overall: true,
						"room-clear": false,
					},
				}),
			),
		{ key: preferenceKey },
	);
	await createPlan(page);
	await expect(
		page.locator('[data-dimension-kind="wall"], [data-dimension-kind="pier"]'),
	).toHaveCount(0);
	await expect(page.locator('[data-dimension-kind="overall"]')).toHaveCount(2);
	const dialog = await openFilter(page);
	await expect(dialog.getByText("Стены по осям", { exact: true })).toHaveCount(
		0,
	);
	await expect(
		dialog.getByText("Простенки по осям", { exact: true }),
	).toHaveCount(0);
	const rooms = dialog.getByRole("tab", { name: "Помещения", exact: true });
	const openings = dialog.getByRole("tab", { name: "Проёмы", exact: true });
	await expect(rooms).toHaveAttribute("aria-selected", "true");
	await expect(
		dialog.getByRole("tabpanel", { name: "Помещения", exact: true }),
	).toBeVisible();
	await rooms.focus();
	await page.keyboard.press("ArrowRight");
	await expect(openings).toBeFocused();
	await expect(openings).toHaveAttribute("aria-selected", "true");
	await expect(
		dialog.getByRole("tabpanel", { name: "Проёмы", exact: true }),
	).toBeVisible();
	await expect(
		dialog.getByRole("checkbox", { name: "Ширина проёмов", exact: true }),
	).toBeChecked();
	await page.keyboard.press("ArrowRight");
	await expect(rooms).toBeFocused();
	await page.keyboard.press("ArrowLeft");
	await expect(openings).toBeFocused();
	await page.keyboard.press("Home");
	await expect(rooms).toBeFocused();
	await page.keyboard.press("End");
	await expect(openings).toBeFocused();
	await dialog
		.getByRole("button", { name: "Показать всё", exact: true })
		.click();
	await expect(
		page.locator('[data-dimension-kind="wall"], [data-dimension-kind="pier"]'),
	).toHaveCount(0);
	const stored = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? "null"),
		preferenceKey,
	);
	expect(stored.visible).toEqual({
		wall: false,
		pier: false,
		opening: true,
		overall: true,
		"room-clear": true,
	});
});
