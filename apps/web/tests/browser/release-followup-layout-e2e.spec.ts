import { expect, type Locator, type Page, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

const viewports = [
	{ width: 320, height: 568, font: 100 },
	{ width: 390, height: 844, font: 100 },
	{ width: 430, height: 932, font: 200 },
	{ width: 360, height: 480, font: 200 },
];

async function setLayout(page: Page, layout: (typeof viewports)[number]) {
	await page.setViewportSize(layout);
	await page.evaluate((font) => {
		document.documentElement.style.fontSize = `${font}%`;
	}, layout.font);
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
}

async function createProject(page: Page) {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByLabel("Название проекта", { exact: true })
		.fill("Проверка интерфейса");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
}

async function createRoom(page: Page) {
	await createProject(page);
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(page.getByTestId("room-face")).toHaveCount(1);
}

async function expectSeparated(first: Locator, second: Locator) {
	const a = await first.boundingBox();
	const b = await second.boundingBox();
	if (!a || !b) throw new Error("Expected visible independent UI surfaces");
	expect(
		a.x + a.width <= b.x ||
			b.x + b.width <= a.x ||
			a.y + a.height <= b.y ||
			b.y + b.height <= a.y,
	).toBe(true);
}

async function expectTouchable(control: Locator, rounded = false) {
	await control.scrollIntoViewIfNeeded();
	const bounds = await control.boundingBox();
	if (!bounds) throw new Error("Expected a rendered control");
	expect(bounds.height).toBeGreaterThanOrEqual(44);
	expect(bounds.width).toBeGreaterThanOrEqual(44);
	if (rounded)
		expect(
			await control.evaluate((element) =>
				parseFloat(getComputedStyle(element).borderTopLeftRadius),
			),
		).toBeGreaterThanOrEqual(10);
	expect(
		await control.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			return [0.2, 0.5, 0.8].every((x) =>
				[0.2, 0.5, 0.8].every((y) => {
					const hit = document.elementFromPoint(
						rect.x + rect.width * x,
						rect.y + rect.height * y,
					);
					return hit === element || (hit !== null && element.contains(hit));
				}),
			);
		}),
	).toBe(true);
	if (await control.evaluate((element) => element.tagName === "BUTTON")) {
		expect(
			await control.evaluate((element) => {
				const bounds = element.getBoundingClientRect();
				const range = document.createRange();
				range.selectNodeContents(element);
				return [...range.getClientRects()].every(
					(rect) =>
						rect.left >= bounds.left &&
						rect.right <= bounds.right &&
						rect.top >= bounds.top &&
						rect.bottom <= bounds.bottom,
				);
			}),
		).toBe(true);
	}
}

async function expectNoHorizontalScroll(surface: Locator) {
	expect(
		await surface.evaluate(
			(element) => element.scrollWidth <= element.clientWidth + 1,
		),
	).toBe(true);
}

async function drawWallDraft(page: Page) {
	await page.getByRole("button", { name: "Стена", exact: true }).click();
	const room = await page.getByTestId("room-face").first().boundingBox();
	if (!room) throw new Error("Expected a room to draw inside");
	const cdp = await page.context().newCDPSession(page);
	const from = { x: room.x + room.width * 0.5, y: room.y + room.height * 0.25 };
	const to = { x: from.x, y: room.y + room.height * 0.65 };
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ id: 431, ...from }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ id: 431, ...to }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
	await expect(page.getByTestId("wall-draft-actions")).toBeVisible();
}

for (const layout of viewports) {
	const label = `${layout.width}x${layout.height} ${layout.font}%`;
	test(`FOLLOW-UI-01 ${label}: project creation has separated rounded controls and leaves canvas tools clear`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize(layout);
		await page.goto("/");
		await setLayout(page, layout);
		const create = page.getByRole("button", {
			name: "Новый проект",
			exact: true,
		});
		await expectTouchable(create, true);
		await create.click();
		const form = page
			.locator("form")
			.filter({ has: page.getByLabel("Название проекта", { exact: true }) });
		const input = form.getByLabel("Название проекта", { exact: true });
		const submit = form.getByRole("button", {
			name: "Создать проект",
			exact: true,
		});
		await expectTouchable(input, true);
		await expectTouchable(submit, true);
		const inputBounds = await input.boundingBox(),
			submitBounds = await submit.boundingBox();
		if (!inputBounds || !submitBounds)
			throw new Error("Expected separated creation controls");
		expect(
			submitBounds.y - inputBounds.y - inputBounds.height,
		).toBeGreaterThanOrEqual(12);
		await page.screenshot({
			path: testInfo.outputPath("new-project.png"),
			scale: "css",
		});
		await input.fill("Новый интерьер");
		await submit.click();
		const contour = page.getByRole("form", {
			name: "Размеры стартового контура",
			exact: true,
		});
		for (const field of await contour.getByRole("textbox").all())
			await expectTouchable(field, true);
		await expectTouchable(
			contour.getByRole("button", { name: "Создать контур", exact: true }),
			true,
		);
		await expectSeparated(
			contour,
			page.getByRole("group", { name: "История изменений", exact: true }),
		);
		await expectSeparated(
			contour,
			page.getByRole("navigation", {
				name: "Инструменты редактора",
				exact: true,
			}),
		);
		await expectNoHorizontalScroll(contour);
		await page.screenshot({
			path: testInfo.outputPath("initial-contour.png"),
			scale: "css",
		});
	});

	test(`FOLLOW-UI-03 ${label}: wall confirmation uses consistent actions without occluding history`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: layout.width, height: 844 });
		await createRoom(page);
		await drawWallDraft(page);
		await setLayout(page, layout);
		const confirmation = page.getByTestId("wall-draft-actions");
		await expectSeparated(
			confirmation,
			page.getByRole("group", { name: "История изменений", exact: true }),
		);
		await expectSeparated(confirmation, page.getByTestId("editor-top-bar"));
		await expectTouchable(
			confirmation.getByRole("button", {
				name: "Подтвердить стену",
				exact: true,
			}),
			true,
		);
		await expectTouchable(
			confirmation.getByRole("button", { name: "Отменить стену", exact: true }),
			true,
		);
		await expectNoHorizontalScroll(confirmation);
		await page.screenshot({
			path: testInfo.outputPath("wall-confirmation.png"),
			scale: "css",
		});
		await confirmation
			.getByRole("button", { name: "Отменить стену", exact: true })
			.click();
		await expect(confirmation).toHaveCount(0);
		await expect(page.getByTestId("wall-segment")).toHaveCount(4);
	});

	test(`FOLLOW-UI-04 ${label}: menu is a separate surface with readable actions and stable editor layout`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: layout.width, height: 844 });
		await createRoom(page);
		await setLayout(page, layout);
		const header = page.getByTestId("editor-top-bar");
		const dock = page.getByTestId("editor-action-dock");
		const headerBefore = await header.boundingBox(),
			dockBefore = await dock.boundingBox();
		await page
			.getByRole("button", { name: "Открыть остальные действия", exact: true })
			.click();
		const menu = page.locator("#editor-secondary-actions");
		await expect(menu).toBeVisible();
		expect(await header.boundingBox()).toEqual(headerBefore);
		expect(await dock.boundingBox()).toEqual(dockBefore);
		await expectNoHorizontalScroll(menu);
		for (const action of await menu.getByRole("button").all())
			if ((await action.isVisible()) && (await action.isEnabled()))
				await expectTouchable(action, true);
		await page.screenshot({
			path: testInfo.outputPath("editor-menu.png"),
			scale: "css",
		});
		await menu
			.getByRole("button", { name: "Закрыть остальные действия", exact: true })
			.click();
		await expect(menu).toBeHidden();
		await expect(
			page.getByRole("button", {
				name: "Открыть остальные действия",
				exact: true,
			}),
		).toBeFocused();
	});
}

test("FOLLOW-UI-02: transient errors use a uniform outline without a decorative accent side", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 360, height: 640 });
	await createProject(page);
	await page
		.getByRole("textbox", { name: "Ширина, мм", exact: true })
		.fill("0");
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	const notice = page.getByTestId("transient-notification");
	await expect(notice).toBeVisible();
	expect(
		await notice.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				widths: [
					style.borderTopWidth,
					style.borderRightWidth,
					style.borderBottomWidth,
					style.borderLeftWidth,
				],
				colors: [
					style.borderTopColor,
					style.borderRightColor,
					style.borderBottomColor,
					style.borderLeftColor,
				],
			};
		}),
	).toEqual({
		widths: ["1px", "1px", "1px", "1px"],
		colors: [
			"rgb(184, 183, 178)",
			"rgb(184, 183, 178)",
			"rgb(184, 183, 178)",
			"rgb(184, 183, 178)",
		],
	});
	await expectTouchable(
		notice.getByRole("button", { name: "Закрыть уведомление", exact: true }),
	);
	await page.screenshot({
		path: testInfo.outputPath("notification.png"),
		scale: "css",
	});
	await notice
		.getByRole("button", { name: "Закрыть уведомление", exact: true })
		.click();
	await expect(notice).toHaveCount(0);
});

for (const width of [320, 430]) {
	test(`FOLLOW-UI-05 ${width}px 200%: room, dimension and catalog forms retain readable independent controls`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width, height: 844 });
		await createRoom(page);
		await setLayout(page, { width, height: 844, font: 200 });
		await page.getByRole("button", { name: "Комната", exact: true }).click();
		const room = page.getByRole("dialog", { name: "Помещения", exact: true });
		await expectTouchable(
			room.getByRole("button", { name: "Закрыть помещения", exact: true }),
		);
		const type = room.getByRole("combobox", {
			name: "Тип помещения",
			exact: true,
		});
		await expectTouchable(type, true);
		expect(
			await type.evaluate((element) =>
				parseFloat(getComputedStyle(element).paddingRight),
			),
		).toBeGreaterThanOrEqual(36);
		await expectTouchable(
			room.getByLabel("Высота помещения, мм", { exact: true }),
			true,
		);
		await expectTouchable(
			room.getByRole("button", { name: "Сохранить помещение", exact: true }),
			true,
		);
		await expectNoHorizontalScroll(room);
		await page.screenshot({
			path: testInfo.outputPath("room-properties.png"),
			scale: "css",
		});
		await room
			.getByRole("button", { name: "Закрыть помещения", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Настроить размеры", exact: true })
			.click();
		const filters = page.getByRole("dialog", { name: "Размеры", exact: true });
		await expectTouchable(
			filters.getByRole("button", {
				name: "Закрыть настройки размеров",
				exact: true,
			}),
		);
		for (const tab of await filters.getByRole("tab").all())
			await expectTouchable(tab, true);
		await filters.getByRole("tab", { name: "Проёмы", exact: true }).click();
		await expectNoHorizontalScroll(filters);
		await page.screenshot({
			path: testInfo.outputPath("dimension-filters.png"),
			scale: "css",
		});
		await page.keyboard.press("Escape");
		await page
			.getByRole("button", { name: "Предметы интерьера", exact: true })
			.click();
		const catalog = page.getByRole("dialog", {
			name: "Предметы интерьера",
			exact: true,
		});
		await expectTouchable(
			catalog.getByRole("button", {
				name: "Закрыть предметы интерьера",
				exact: true,
			}),
		);
		await expectNoHorizontalScroll(catalog);
		for (const category of await catalog
			.getByTestId("catalog-category-filter")
			.all())
			await expectTouchable(category, true);
		await catalog.getByTestId("catalog-authoring").locator("summary").click();
		await catalog
			.getByRole("button", { name: "Создать макетный предмет", exact: true })
			.click();
		const composer = catalog.getByRole("form", {
			name: "Создать макетный предмет",
			exact: true,
		});
		for (const input of await composer.locator("input:not([type=color])").all())
			await expectTouchable(input, true);
		await expectTouchable(
			composer.getByRole("button", { name: "Начать размещение", exact: true }),
			true,
		);
		await expectNoHorizontalScroll(composer);
		await page.screenshot({
			path: testInfo.outputPath("catalog-composer.png"),
			scale: "css",
		});
	});
}

for (const layout of [viewports[0], viewports[3]]) {
	if (!layout) continue;
	test(`FOLLOW-UI-07 ${layout.width}x${layout.height} ${layout.font}%: explicit wall properties stay below the header with clear actions`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: layout.width, height: 844 });
		await createRoom(page);
		await page
			.getByRole("button", { name: "Рука и выбор", exact: true })
			.click();
		await page.getByTestId("wall-segment").first().click();
		await page.getByRole("button", { name: "Свойства", exact: true }).click();
		await setLayout(page, layout);
		const properties = page.getByTestId("selected-wall-inspector");
		await expectSeparated(
			page.getByRole("group", { name: "История изменений", exact: true }),
			page.getByTestId("editor-action-dock"),
		);
		await expectSeparated(properties, page.getByTestId("editor-top-bar"));
		await expectSeparated(
			properties,
			page.getByRole("group", { name: "История изменений", exact: true }),
		);
		for (const action of await properties.getByRole("button").all())
			await expectTouchable(action, true);
		await expectNoHorizontalScroll(properties);
		await page.screenshot({
			path: testInfo.outputPath("wall-properties.png"),
			scale: "css",
		});
		await properties
			.getByRole("button", { name: "Закрыть свойства стены", exact: true })
			.click();
		await expect(properties).toHaveCount(0);
	});

	test(`FOLLOW-UI-06 ${layout.width}x${layout.height} ${layout.font}%: opening move confirmation is compact centered and has clear primary and cancel actions`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: layout.width, height: 844 });
		await createRoom(page);
		await page
			.getByRole("button", { name: "Рука и выбор", exact: true })
			.click();
		await page.getByTestId("wall-segment").first().click();
		await page
			.getByRole("button", { name: "Добавить проём", exact: true })
			.click();
		await page.getByRole("button", { name: "Окно", exact: true }).click();
		await page.getByRole("button", { name: "Добавить", exact: true }).click();
		await expect(page.getByTestId("window-opening")).toHaveCount(1);
		await setLayout(page, layout);
		await page.getByTestId("opening-move-handle").focus();
		await page.keyboard.press("ArrowRight");
		const dialog = page.getByRole("dialog", {
			name: "Подтвердить перемещение окна",
			exact: true,
		});
		await expect(dialog).toBeVisible();
		await expect(dialog.locator("input, select, textarea")).toHaveCount(0);
		const bounds = await dialog.boundingBox();
		if (!bounds) throw new Error("Expected a centered confirmation");
		expect(
			Math.abs(bounds.x + bounds.width / 2 - layout.width / 2),
		).toBeLessThanOrEqual(1);
		expect(
			Math.abs(bounds.y + bounds.height / 2 - layout.height / 2),
		).toBeLessThanOrEqual(1);
		const confirm = dialog.getByRole("button", {
			name: "Подтвердить",
			exact: true,
		});
		const cancel = dialog.getByRole("button", { name: "Отмена", exact: true });
		await expectTouchable(confirm, true);
		expect(
			await confirm.evaluate((element) => {
				const range = document.createRange();
				range.selectNodeContents(element);
				return range.getClientRects().length;
			}),
		).toBe(1);
		await expectTouchable(cancel, true);
		expect(
			await confirm.evaluate(
				(element) => getComputedStyle(element).backgroundColor,
			),
		).not.toBe(
			await cancel.evaluate(
				(element) => getComputedStyle(element).backgroundColor,
			),
		);
		await expectNoHorizontalScroll(dialog);
		await page.screenshot({
			path: testInfo.outputPath("opening-move-confirmation.png"),
			scale: "css",
		});
		await cancel.click();
		await expect(dialog).toHaveCount(0);
	});
}

test("FOLLOW-UI-08: enlarged text keeps history and zoom glyphs inside their touch targets", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 360, height: 844 });
	await createRoom(page);
	await setLayout(page, { width: 360, height: 480, font: 200 });
	for (const name of ["История изменений", "Масштаб плана"]) {
		for (const button of await page
			.getByRole("group", { name, exact: true })
			.getByRole("button")
			.all()) {
			await expectTouchable(button, true);
		}
	}
	await page.screenshot({
		path: testInfo.outputPath("history-zoom-glyphs.png"),
		scale: "css",
	});
});

for (const layout of [viewports[0], viewports[3]]) {
	if (!layout) continue;
	test(`FOLLOW-UI-09 ${layout.width}x${layout.height} ${layout.font}%: storage cleanup and starter contour remain reachable together`, async ({
		page,
	}, testInfo) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator.storage, "estimate", {
				configurable: true,
				value: async () => ({ quota: 1000, usage: 900 }),
			});
		});
		await page.setViewportSize({ width: layout.width, height: 844 });
		await createProject(page);
		await setLayout(page, layout);
		const notice = page.getByTestId("storage-pressure");
		const contour = page.getByRole("form", {
			name: "Размеры стартового контура",
			exact: true,
		});
		await expect(notice).toBeVisible();
		const stack = contour.locator("..");
		await expectSeparated(stack, page.getByTestId("editor-top-bar"));
		await expectSeparated(
			stack,
			page.getByRole("group", { name: "История изменений", exact: true }),
		);
		await expectNoHorizontalScroll(stack);
		await expectSeparated(notice, contour);
		const cleanup = notice.getByRole("button", {
			name: "Освободить место в кэше",
			exact: true,
		});
		await expectTouchable(cleanup, true);
		await cleanup.click();
		await expect(page.getByTestId("browse-cache-cleanup-status")).toBeVisible();
		await page.screenshot({
			path: testInfo.outputPath("storage-cleanup.png"),
			scale: "css",
		});
		for (const field of await contour.getByRole("textbox").all())
			await expectTouchable(field, true);
		const create = contour.getByRole("button", {
			name: "Создать контур",
			exact: true,
		});
		await expectTouchable(create, true);
		await expectNoHorizontalScroll(contour);
		await page.screenshot({
			path: testInfo.outputPath("storage-and-contour.png"),
			scale: "css",
		});
		await create.click();
		await expect(page.getByTestId("room-face")).toHaveCount(1);
	});
}
