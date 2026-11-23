import { RuntimePortableBackupCodec } from "../../src/adapters/portable-backup/runtime-portable-backup-codec";
import { validateRuntimeV1Project } from "../../src/application/runtime-v1-project-validation";
import { expect, type Page, type Locator, test } from "@playwright/test";
import {
	audit,
	installEntryAudit,
	semanticRows,
} from "./telegram-entry-support";
import { signedExample, fixtureEditionTime } from "./telegram-entry-signed-fixture";
import { licenseRevision } from "../../src/app/license-receipt";
import { clickRectangularRoomCentre, clickRectangularRoomPoint } from "./room-geometry-fixture";
const sdkURL = "**/telegram-sdk/telegram-web-app.124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908.js";
async function noStorage(page: Page, expectedReady = 0) {
	const observed = await audit(page);
	expect(observed.opens).toEqual([]);
	expect(
		observed.deletes +
			observed.registrations +
			observed.unregisters +
			observed.cacheDeletes,
	).toBe(0);
	expect(observed.ready).toBe(expectedReady);
	expect(observed.contexts).toBe(observed.releasedContexts);
}
async function signed(page: Page, firstUse = false) {
	await page.clock.setFixedTime(new Date(fixtureEditionTime));
	await installEntryAudit(page, "signed", signedExample, firstUse);
}
async function createRoom(page: Page, name: string) {
	await expect(
		page.getByRole("button", { name: "Новый проект", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill(name);
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("textbox", { name: "Ширина, мм", exact: true })
		.fill("4100");
	await page
		.getByRole("textbox", { name: "Глубина, мм", exact: true })
		.fill("3200");
	await page
		.getByRole("textbox", { name: "Высота, мм", exact: true })
		.fill("2700");
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
}
test.beforeEach(async ({ page, baseURL }) => {
	if (!baseURL) throw new Error("Missing isolated Telegram target origin");
	await page.request.post(`${baseURL}/__entry-proof/activate-base`);
	const environment = await page.request
		.get(`${baseURL}/__entry-proof/environment`)
		.then((response) => response.json());
	const allowed = new Set([new URL(baseURL).origin, environment.emptyOrigin]);
	await page.route("**/*", (route) =>
		allowed.has(new URL(route.request().url()).origin)
			? route.continue()
			: route.abort(),
	);
});

test("TMA-UI-POLISH-01: healthy Projects has only user actions and a readable blue New Project label", async ({ page }, info) => {
	await signed(page);
	await page.setViewportSize({ width: 320, height: 640 });
	await page.goto("/");
	const hub = page.getByTestId("project-hub");
	await expect(hub).toBeVisible();
	await expect(page.getByText("Данные для проверки", { exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Восстановить несохранённую правку", exact: true })).toHaveCount(0);
	const create = hub.getByRole("button", { name: "Новый проект", exact: true });
	for (const scheme of ["light", "dark"]) {
		await page.evaluate((colorScheme) => {
			window.__telegramEntryProof.host.patch({ colorScheme });
			window.__telegramEntryProof.host.emit("themeChanged");
		}, scheme);
		const presentation = await create.evaluate((element) => {
			const style = getComputedStyle(element);
			const probe = document.createElement("span");
			probe.style.color = "var(--editor-host-primary)";
			element.append(probe);
			const primary = getComputedStyle(probe).color;
			probe.remove();
			return { color: style.color, background: style.backgroundColor, primary, radius: style.borderRadius, height: element.getBoundingClientRect().height };
		});
		expect(presentation.color).toBe(presentation.primary);
		expect(presentation.background).not.toBe(presentation.color);
		expect(presentation.radius).toBe("12px");
		expect(presentation.height).toBeGreaterThanOrEqual(44);
		await page.screenshot({ path: info.outputPath(`projects-${scheme}-320.png`) });
	}
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("TMA-UI-POLISH-02: project menu keeps its trigger and shows a single flat list with separate targets", async ({ page }, info) => {
	await signed(page);
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto("/");
	await createRoom(page, "Проверка меню");
	await page.getByRole("button", { name: "Назад", exact: true }).click();
	const before = await semanticRows(page);
	const card = page.getByTestId("project-directory").locator("li").first();
	const trigger = card.locator("summary");
	const deletion = card.getByRole("button", { name: "Удалить проект Проверка меню", exact: true });
	const triggerBefore = await trigger.boundingBox();
	const deleteBox = await deletion.boundingBox();
	if (!triggerBefore || !deleteBox) throw new Error("Expected separate directory actions");
	expect(triggerBefore.x - deleteBox.x - deleteBox.width).toBeGreaterThanOrEqual(8);
	await trigger.click();
	await expect(trigger.locator("span")).toBeVisible();
	await expect(card.getByRole("button", { name: "Переименовать Проверка меню", exact: true })).toBeVisible();
	expect(await trigger.boundingBox()).toEqual(triggerBefore);
	expect(await trigger.evaluate(element => getComputedStyle(element, "::before").content)).toBe("none");
	const rename = card.getByRole("button", { name: "Переименовать Проверка меню", exact: true });
	await expect(rename).toHaveCSS("border-top-width", "0px");
	await expect(card).toHaveCSS("border-radius", "12px");
	await expect(trigger).toHaveCSS("border-radius", "12px");
	const actions = card.locator("details > div");
	const actionBox = await actions.boundingBox();
	const cardBox = await card.boundingBox();
	if (!actionBox || !cardBox) throw new Error("Expected a full-width action list");
	expect(cardBox.width - actionBox.width).toBeLessThanOrEqual(24);
	await actions.click({ position: { x: 4, y: 4 } });
	await expect(rename).toBeVisible();
	await page.screenshot({ path: info.outputPath("project-menu-360.png") });
	await rename.focus();
	await page.keyboard.press("Escape");
	await expect(rename).toBeHidden();
	await expect(trigger).toBeFocused();
	expect(await semanticRows(page)).toEqual(before);
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	await trigger.click();
	await expect(rename).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.getByRole("heading", { name: "Проекты", exact: true }).click();
	await expect(rename).toBeHidden();
});

test("TMA-UI-POLISH-03: destructive confirmation uses two plain actions and cancellation preserves the Project", async ({ page }, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Проверка подтверждения");
	await page.getByRole("button", { name: "Назад", exact: true }).click();
	const before = await semanticRows(page);
	await page.getByRole("button", { name: "Удалить проект Проверка подтверждения", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Удалить проект", exact: true });
	await expect(dialog.getByRole("button", { name: "Подтвердить", exact: true })).toBeVisible();
	await expect(dialog.getByRole("button", { name: "Отменить", exact: true })).toBeVisible();
	await expect(dialog).toContainText("Это действие нельзя отменить");
	await expect(dialog.getByRole("button", { name: "Подтвердить" })).toHaveCSS("background-color", "rgb(25, 118, 185)");
	await expect(dialog.getByRole("button", { name: "Отменить" })).not.toHaveCSS("background-color", "rgb(25, 118, 185)");
	await expect(dialog).toHaveCSS("border-radius", "12px");
	await page.screenshot({ path: info.outputPath("confirmation-390.png") });
	await dialog.getByRole("button", { name: "Отменить", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	expect(await semanticRows(page)).toEqual(before);
});

async function expectTmaModalBottom(dialog: Locator) {
	await expect(dialog).toBeVisible();
	expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
	await expect.poll(() => dialog.evaluate((element) => {
		const hostHeight = Number.parseFloat(getComputedStyle(element).getPropertyValue("--editor-viewport-height"));
		const visibleHeight = Math.min(window.innerHeight, hostHeight || window.innerHeight);
		const measurement = document.createElement("span");
		measurement.style.cssText = "position:fixed;visibility:hidden;height:max(12px,var(--editor-safe-area-bottom,env(safe-area-inset-bottom,0px)))";
		element.append(measurement);
		const safePadding = measurement.getBoundingClientRect().height;
		measurement.remove();
		return Math.round(visibleHeight - element.getBoundingClientRect().bottom - safePadding);
	})).toBe(0);
}

test("TMA-CONFIRM: moving a door keeps a compact modal bottom sheet in the visible safe area", async ({ page }) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Проверка проёма");
	await page.getByTestId("wall-segment").first().click();
	await page.getByRole("button", { name: "Добавить проём" }).click();
	await page.getByRole("button", { name: "Дверь", exact: true }).click();
	await page.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Новый проём", exact: true })).toHaveCount(0);
	const handle = page.getByTestId("opening-move-handle");
	await handle.focus();
	await expect(handle).toBeFocused();
	await handle.press("ArrowRight");
	const dialog = page.getByTestId("opening-move-confirmation");
	await expect(dialog).toBeVisible();
	const before = await semanticRows(page);
	for (const width of [390, 320]) {
		await page.setViewportSize({ width, height: 745 });
		await expectTmaModalBottom(dialog);
		const bounds = await dialog.boundingBox();
		expect(bounds!.height).toBeLessThan(210);
		expect(bounds!.x).toBeCloseTo(12, 0);
		expect(bounds!.width).toBeCloseTo(width - 24, 0);
		for (const button of await dialog.getByRole("button").all()) {
			const box = await button.boundingBox();
			expect(box!.height).toBeGreaterThanOrEqual(44);
			expect(box!.height).toBeLessThan(60);
		}
	}
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	await dialog.getByRole("button", { name: "Отменить" }).click();
	await expect(dialog).toHaveCount(0);
	expect(await semanticRows(page)).toEqual(before);
});

test("TMA-UI-POLISH-04: editor surfaces share rounded controls with separate touch targets across screen sizes", async ({ page }, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Проверка интерфейса");
	for (const width of [320, 390, 768, 820]) {
		await page.setViewportSize({ width, height: 844 });
		const itemLabel = page.getByRole("button", { name: "Предметы интерьера", exact: true }).locator("span");
		expect(await itemLabel.evaluate(element => element.getBoundingClientRect().height <= Number.parseFloat(getComputedStyle(element).lineHeight) + 1)).toBe(true);
		const dockRows = await page.getByTestId("editor-action-dock").getByRole("button").evaluateAll(elements => elements.map(element => Math.round(element.getBoundingClientRect().y)));
		expect(new Set(dockRows).size).toBe(1);
		if (width >= 560) await expect(page.getByRole("button", { name: "Размеры плана", exact: true })).toHaveCSS("border-radius", "12px");
		const history = page.getByRole("group", { name: "История изменений", exact: true });
		const historyButtons = history.getByRole("button");
		await expect(history).toHaveCSS("border-radius", "12px");
		const undo = await historyButtons.nth(0).boundingBox();
		const redo = await historyButtons.nth(1).boundingBox();
		if (!undo || !redo) throw new Error("Expected reachable history actions");
		expect(redo.x - undo.x - undo.width).toBeGreaterThanOrEqual(8);
		await page.getByRole("button", { name: "Настроить размеры", exact: true }).click();
		const dimensions = page.getByRole("dialog", { name: "Размеры", exact: true });
		await expect(dimensions).toHaveCSS("border-radius", "12px");
		await expect(dimensions.getByRole("tab").first()).toHaveCSS("border-radius", "12px");
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.screenshot({ path: info.outputPath(`dimensions-${width}.png`) });
		await page.keyboard.press("Escape");
		await page.screenshot({ path: info.outputPath(`editor-${width}.png`) });
	}
	await page.setViewportSize({ width: 320, height: 844 });
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const targets = await page.getByTestId("editor-workspace").getByRole("button").evaluateAll(elements => elements
		.filter(element => element.getClientRects().length > 0)
		.map(element => ({ name: element.getAttribute("aria-label") ?? element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
	for (const target of targets) {
		expect(target.width, target.name ?? "button").toBeGreaterThanOrEqual(44);
		expect(target.height, target.name ?? "button").toBeGreaterThanOrEqual(44);
	}
	await page.screenshot({ path: info.outputPath("editor-320-enlarged-text.png") });
});

test("TMA-UI-POLISH-05: keyboard menus remain exclusive and deleting from an open menu keeps the intended target", async ({ page }) => {
	const pageErrors: string[] = [];
	page.on("pageerror", error => pageErrors.push(error.message));
	await signed(page);
	await page.setViewportSize({ width: 320, height: 640 });
	await page.goto("/");
	for (const name of ["Первый план", "Второй план"]) {
		await createRoom(page, name);
		await page.getByRole("button", { name: "Назад", exact: true }).click();
	}
	const before = await semanticRows(page);
	const cards = page.getByTestId("project-directory").locator("li");
	const first = cards.nth(0).locator("summary");
	const second = cards.nth(1).locator("summary");
	await first.focus();
	await page.keyboard.press("Enter");
	await expect(first.locator("..")).toHaveAttribute("open", "");
	await second.focus();
	await page.keyboard.press("Enter");
	await expect(first.locator("..")).not.toHaveAttribute("open", "");
	await expect(second.locator("..")).toHaveAttribute("open", "");
	const deletion = cards.nth(1).getByRole("button", { name: /^Удалить проект / });
	const targetName = (await deletion.getAttribute("aria-label"))?.replace(/^Удалить проект /, "");
	if (!targetName) throw new Error("Deletion must name its selected Project");
	await deletion.click();
	const dialog = page.getByRole("dialog", { name: "Удалить проект", exact: true });
	await expect(dialog).toContainText(targetName);
	await dialog.getByRole("button", { name: "Отменить", exact: true }).click();
	await expect(second.locator("..")).not.toHaveAttribute("open", "");
	expect(await semanticRows(page)).toEqual(before);
	expect(pageErrors).toEqual([]);
});
test("TMA-ENTRY-01: an empty deployment keeps a Web link and retry/exit without SDK or DB", async ({
	page,
	baseURL,
}) => {
	const environment = await page.request
		.get(`${baseURL}/__entry-proof/environment`)
		.then((response) => response.json());
	await installEntryAudit(page, "invalid");
	await page.goto(environment.emptyOrigin);
	await expect(
		page.getByText(
			"Этот Telegram-редактор пока не настроен. Можно открыть веб-редактор.",
		),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Открыть веб-редактор" }),
	).toHaveAttribute("href", "https://example.invalid/editor");
	await page
		.getByRole("button", { name: "Повторить запуск", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Выйти", exact: true }),
	).toBeVisible();
	expect((await audit(page)).sdkReads).toBe(0);
	await noStorage(page);
});
test("TMA-CATALOG-LOCAL-01: signed Telegram offers floor presets and opens its own GLB library offline", async ({ page }) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Локальный каталог");
	await page.context().setOffline(true);
	await page.getByRole("navigation", { name: "Инструменты редактора" }).getByRole("button", { name: "Предметы интерьера", exact: true }).click();
	const catalog = page.getByRole("dialog", { name: "Предметы интерьера" });
	for (const name of ["Стул", "Шкаф", "Ванна", "Стиральная машина"]) {
		await expect(catalog.getByRole("button", { name: new RegExp(`^${name} `) })).toBeVisible();
	}
	for (const name of ["Угловой диван", "Унитаз", "Холодильник", "Торшер", "Ковёр"]) {
		await expect(catalog.getByRole("button", { name: new RegExp(`^${name} `) })).toBeVisible();
	}
	await expect(catalog.locator("[data-greybox-preset]")).toHaveCount(30);
	for (const name of ["Настенный светильник", "Зеркало", "Раковина", "Кухонная вытяжка", "Настенная полка"]) {
		await expect(catalog.getByRole("button", { name: new RegExp(`^${name} `) })).toHaveCount(0);
	}
	await expect(catalog.getByText(/На пол|На стену/)).toHaveCount(0);
	await catalog.getByRole("button", { name: "Техника", exact: true }).click();
	await expect(catalog.getByRole("button", { name: /^Холодильник / })).toBeVisible();
	await expect(catalog.getByRole("button", { name: /^Торшер / })).toHaveCount(0);
	await catalog.getByRole("button", { name: "Все", exact: true }).click();
	const search = catalog.getByPlaceholder("Найти предмет");
	await search.fill("зеркало");
	await expect(catalog.getByRole("status")).toHaveText("Подходящих предметов нет.");
	await expect(catalog.locator("[data-greybox-preset]")).toHaveCount(0);
	await catalog.getByRole("button", { name: "Очистить поиск", exact: true }).click();
	await expect(catalog.getByRole("button", { name: /^Стул / })).toBeVisible();
	await expect(catalog.getByText("Каталог временно недоступен", { exact: true })).toHaveCount(0);
	await expect(catalog.locator('img[src^="data:image/png"]').first()).toBeVisible();
	const sections = catalog.getByRole("tablist", { name: "Разделы каталога" });
	const presets = sections.getByRole("tab", { name: "Предметы", exact: true });
	const own = sections.getByRole("tab", { name: "Мои модели", exact: true });
	for (const tab of [presets, own]) {
		expect(await tab.evaluate(element => {
			const panel = document.getElementById(element.getAttribute("aria-controls") ?? "");
			return panel?.getAttribute("role") === "tabpanel" && panel.getAttribute("aria-labelledby") === element.id;
		})).toBe(true);
	}
	await expect(presets).toHaveAttribute("aria-selected", "true");
	await catalog.getByRole("button", { name: "Техника", exact: true }).click();
	await search.fill("холодильник");
	const headerPosition = await sections.boundingBox();
	const searchPosition = await search.boundingBox();
	await own.click();
	await expect(own).toHaveAttribute("aria-selected", "true");
	await expect(catalog.getByTestId("catalog-title")).toHaveText("Каталог");
	await expect(search).toHaveValue("холодильник");
	expect(await sections.boundingBox()).toEqual(headerPosition);
	expect(await search.boundingBox()).toEqual(searchPosition);
	await expect(catalog.getByRole("button", { name: /^Холодильник / })).toHaveCount(0);
	await own.press("ArrowLeft");
	await expect(presets).toBeFocused();
	await expect(catalog.getByRole("button", { name: "Техника", exact: true })).toHaveAttribute("aria-pressed", "true");
	await expect(catalog.getByRole("button", { name: /^Холодильник / })).toBeVisible();
	await catalog.getByRole("button", { name: "Очистить поиск", exact: true }).click();
	const chooser = page.waitForEvent("filechooser");
	await catalog.getByRole("button", { name: "Импортировать свой GLB", exact: true }).click();
	const fileInput = await chooser;
	await expect(own).toHaveAttribute("aria-selected", "true");
	expect(await fileInput.element().getAttribute("accept")).toContain(".glb");
	await fileInput.setFiles([]);
	await expect(catalog.getByText("Нет своих моделей", { exact: true })).toBeVisible();
	await expect(catalog.getByTestId("preloaded-catalog-card")).toHaveCount(0);
	await presets.click();

	await catalog.getByRole("button", { name: /^Стул / }).click();
	await clickRectangularRoomCentre(page);
	await expect(page.getByTestId("item-placement-preview")).toHaveAttribute("data-placement-valid", "true");
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	const saved = await semanticRows(page);
	expect(saved.revisions).toContainEqual(expect.objectContaining({
		candidate: expect.objectContaining({ project: expect.objectContaining({
			assetInstances: [expect.objectContaining({ label: "Стул", anchorClass: "floor" })],
		}) }),
	}));
	await page.context().setOffline(false);
	await page.reload();
	await page.getByRole("button", { name: "Открыть Локальный каталог", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	expect(await semanticRows(page)).toEqual(saved);
});

test("TMA-ITEM-FLUSH-01: a cabinet can be placed at an exact inner wall face between grid lines", async ({ page }) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Шкаф у стены");
	const before = await semanticRows(page);
	await page.getByRole("button", { name: "Предметы интерьера", exact: true }).click();
	await page.getByRole("dialog", { name: "Предметы интерьера", exact: true }).getByRole("button", { name: /^Шкаф / }).click();
	const color = page.getByTestId("tma-placement-color");
	await expect(color).toHaveCount(0);
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await color.getByRole("button", { name: /^Цвет/ }).click();
	await page.getByRole("dialog", { name: "Цвет предмета" }).getByRole("button", { name: "Ягодный красный" }).click();
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await expect(color).toHaveCount(0);
	await clickRectangularRoomPoint(page, { x: 0.16, y: 0.5 });
	await expect(page.getByTestId("item-placement-preview")).toHaveAttribute("data-placement-valid", "true");
	const leftDistance = page.getByRole("textbox", { name: "Слева, мм", exact: true });
	await expect(leftDistance).toHaveValue("0");
	const environment = await page.request
		.get("/__entry-proof/environment")
		.then((response) => response.json());
	expect(typeof environment.exactFloorYaw).toBe("boolean");
	const rotationStep = environment.exactFloorYaw ? 1 : 45;
	await page.getByRole("button", { name: `Повернуть размещаемый предмет вправо на ${rotationStep}°`, exact: true }).click();
	await expect(leftDistance).not.toHaveValue("0");
	await page.getByRole("button", { name: `Повернуть размещаемый предмет влево на ${rotationStep}°`, exact: true }).click();
	await expect(leftDistance).toHaveValue("0");
	expect(await semanticRows(page)).toEqual(before);
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	const placed = await semanticRows(page);
	expect(placed.revisions).toHaveLength(before.revisions.length + 1);
	expect(placed.revisions).toContainEqual(expect.objectContaining({
		candidate: expect.objectContaining({ project: expect.objectContaining({
			assetInstances: [expect.objectContaining({ label: "Шкаф", widthMm: 1200, xMm: 650 })],
		}) }),
	}));
	await page.getByTestId("schematic-item").click();
	const propertiesColor = page.getByTestId("tma-selected-item-color");
	await expect(propertiesColor).toHaveCount(0);
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(propertiesColor.getByRole("button", { name: /^Цвет.*Ягодный/ })).toBeVisible();
	await page.reload();
	await page.getByRole("button", { name: "Открыть Шкаф у стены", exact: true }).click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	expect(await semanticRows(page)).toEqual(placed);
});

test("TMA-SHEETS: selected floor properties open from the bottom and isolate the editor", async ({ page }, info) => {
	await page.setViewportSize({ width: 390, height: 700 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Свойства стола");
	const button = (name: string) => page.getByRole("button", { name, exact: true });
	await button("Предметы интерьера").click();
	await page.getByRole("dialog", { name: "Предметы интерьера" }).getByRole("button", { name: /^Стул / }).click();
	await clickRectangularRoomCentre(page);
	await button("Подтвердить размещение предмета").click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	await page.getByTestId("schematic-item").click();
	const trigger = page.getByTestId("selected-item-inspector").getByRole("button", { name: "Развернуть панель предмета" });
	await trigger.click();
	const sheet = page.getByRole("dialog", { name: "Свойства выбранного предмета" });
	await expect(sheet).toBeVisible();
	await expect.poll(async () => {
		const box = await sheet.boundingBox();
		return !!box && box.x >= 12 && box.x + box.width <= 378
			&& box.y + box.height >= 682 && box.y + box.height <= 688;
	}).toBe(true);
	expect(await page.getByTestId("editor-top-bar").evaluate((element) => !!element.closest("[inert]"))).toBe(true);
	const close = sheet.getByRole("button", { name: "Скрыть панель предмета" });
	await expect(close).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(sheet.getByRole("button", { name: "Удалить предмет" })).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(close).toBeFocused();
	await info.attach("selected-floor-properties", { body: await page.screenshot(), contentType: "image/png" });
	await page.setViewportSize({ width: 320, height: 520 });
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	await expect.poll(async () => {
		const box = await sheet.boundingBox();
		return !!box && box.x >= 12 && box.x + box.width <= 308
			&& box.y >= 30 && box.y + box.height <= 508;
	}).toBe(true);
	await expect(close).toBeInViewport();
	await expect(sheet.getByRole("button", { name: "Удалить предмет" })).not.toBeInViewport();
	await sheet.getByRole("button", { name: "Удалить предмет" }).scrollIntoViewIfNeeded();
	await expect(sheet.getByRole("button", { name: "Удалить предмет" })).toBeInViewport();
	await expect(close).toBeInViewport();
	await page.setViewportSize({ width: 390, height: 700 });
	await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
	await page.keyboard.press("Escape");
	await expect(sheet).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await trigger.click();
	const angle = sheet.getByRole("textbox", { name: "Угол поворота выбранного предмета, градусы" });
	await angle.fill("15,5");
	const before = await semanticRows(page);
	await close.click();
	const guard = page.getByRole("alertdialog", { name: "Несохранённая правка" });
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(angle).toBeFocused();
	await expect(angle).toHaveValue("15,5");
	expect(await semanticRows(page)).toEqual(before);
	await page.evaluate(() => window.__telegramEntryProof.host.emit("backButtonClicked"));
	await guard.getByRole("button", { name: "Отменить правку", exact: true }).click();
	await expect(angle).toHaveValue("0");
	await page.evaluate(() => window.__telegramEntryProof.host.emit("backButtonClicked"));
	await expect(sheet).toHaveCount(0);
	await expect(trigger).toBeFocused();
});

test("TMA-ENTRY-02: a rejected launch reveals committed recovery UI without opening any namespace", async ({
	page,
}) => {
	await installEntryAudit(page, "invalid");
	await page.goto("/");
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	await expect.poll(async () => (await audit(page)).ready).toBe(1);
	expect(await page.evaluate(() => window.__telegramEntryProof.host.calls)).toEqual(["recovery-ready"]);
	await noStorage(page, 1);
	await page.getByRole("button", { name: "Повторить запуск", exact: true }).click();
	await expect.poll(async () => (await audit(page)).ready).toBe(2);
	expect(await page.evaluate(() => window.__telegramEntryProof.host.calls)).toEqual(["recovery-ready", "recovery-ready"]);
	await noStorage(page, 2);
	await page.getByRole("button", { name: "Выйти", exact: true }).click();
	await expect.poll(async () => (await audit(page)).closed).toBe(1);
});
test("TMA-ENTRY-03: a foreign loaded-shell capsule is rejected before reading SDK", async ({
	page,
}) => {
	await installEntryAudit(page, "invalid");
	await page.route(
		(url) => url.pathname === "/",
		async (route) => {
			const original = await route.fetch();
			const html = (await original.text()).replace(
				/("entryPath":")\/telegram\.[A-Za-z0-9_-]+\.js"/,
				'$1/telegram.foreign.js"',
			);
			await route.fulfill({ response: original, body: html });
		},
	);
	await page.goto("/");
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	expect((await audit(page)).sdkReads).toBe(0);
	await noStorage(page);
});
test("TMA-ENTRY-04: an existing real controlling worker with unavailable manifest is retained and blocks launch", async ({
	page,
}) => {
	await installEntryAudit(page, "invalid");
	await page.goto("/");
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	await page.evaluate(() => window.__telegramEntryProof.installWorker());
	await page.reload();
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
		true,
	);
	expect((await audit(page)).sdkReads).toBe(0);
	await noStorage(page);
});
test("TMA-ENTRY-05: blocked SDK leaves loading and offers a finite fresh retry", async ({
	page,
}) => {
	let requests = 0;
	await installEntryAudit(page, "missing");
	await page.route(sdkURL, (route) => {
		requests++;
		return route.abort();
	});
	await page.goto("/");
	await expect(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	).toBeVisible();
	expect(requests).toBe(1);
	await page
		.getByRole("button", { name: "Повторить запуск", exact: true })
		.click();
	await expect.poll(() => requests).toBe(2);
	await expect(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	).toBeVisible();
	await noStorage(page);
});
test("TMA-ENTRY-06: a stalled native script times out, and its late failure cannot create runtime", async ({
	page,
}) => {
	await installEntryAudit(page, "missing");
	await page.clock.install();
	let stalled: Parameters<Parameters<Page["route"]>[1]>[0] | undefined;
	await page.route(sdkURL, (route) => {
		stalled = route;
	});
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await expect.poll(() => !!stalled).toBe(true);
	await page.clock.runFor(10_001);
	await expect(page.getByText(/Telegram не ответил вовремя/)).toBeVisible();
	await stalled?.abort();
	await noStorage(page);
});
test("TMA-ENTRY-07: real signed native bootstrap and shared factory save and reopen the exact local rectangle", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Actual Telegram entry");
	const before = await semanticRows(page);
	expect(before.revisions).toHaveLength(2);
	const observed = await audit(page);
	expect(observed.ready).toBe(1);
	expect(observed.opens.length).toBeGreaterThan(0);
	expect(
		observed.opens.every((name) =>
			/^interiors-editor-projects:tma-v1-[0-9a-f]{64}$/.test(name),
		),
	).toBe(true);
	expect(
		observed.registrations +
			observed.unregisters +
			observed.deletes +
			observed.cacheDeletes,
	).toBe(0);
	await page.clock.setFixedTime(new Date(fixtureEditionTime + 6_000));
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Actual Telegram entry", exact: true })
		.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	expect(await semanticRows(page)).toEqual(before);
});
for (const direction of ["release", "rollback"] as const)
	test(`TMA-ENTRY-${direction === "release" ? "08" : "09"}: old loaded shell resolves its pending application module after ${direction}`, async ({
		page,
		baseURL,
	}, info) => {
		const environment = await page.request
			.get(`${baseURL}/__entry-proof/environment`)
			.then((response) => response.json());
		if (direction === "rollback")
			await page.request.post(`${baseURL}/__entry-proof/activate-next`);
		const oldApplicationPath: string =
			direction === "release"
				? environment.baseApplicationPath
				: environment.nextApplicationPath;
		await signed(page);
		let held: Parameters<Parameters<Page["route"]>[1]>[0] | undefined;
		await page.route(
			(url) => url.pathname === oldApplicationPath,
			(route) => {
				held = route;
			},
		);
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await expect.poll(() => !!held).toBe(true);
		expect((await audit(page)).opens).toEqual([]);
		const old = await page.request
			.get("/release-set.json")
			.then((response) => response.json());
		await page.request.post(
			`${baseURL}/__entry-proof/${direction === "release" ? "activate-next" : "activate-base"}`,
		);
		const active = await page.request
			.get("/release-set.json")
			.then((response) => response.json());
		expect(active.appBuildId).not.toBe(old.appBuildId);
		expect(
			active.assets.some(
				(asset: { path: string }) => asset.path === oldApplicationPath,
			),
		).toBe(false);
		await held?.continue();
		await createRoom(page, `Old ${direction} client`);
		const before = await semanticRows(page);
		await page
			.getByTestId("editor-view-switch")
			.getByRole("button", { name: "3D", exact: true })
			.click();
		await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
		expect(await semanticRows(page)).toEqual(before);
		const observed = await page.request
			.get(`${baseURL}/__entry-proof/environment`)
			.then((response) => response.json());
		expect(
			observed.served.some(
				(entry: { path: string; activeBuildId: string }) =>
					entry.path === oldApplicationPath &&
					entry.activeBuildId === active.appBuildId,
			),
		).toBe(true);
		const embedded = await page.evaluate(
			() =>
				JSON.parse(
					document.getElementById("telegram-loaded-release")?.textContent ??
						"null",
				).manifest.appBuildId,
		);
		expect(embedded).toBe(old.appBuildId);
		expect((await audit(page)).ready).toBe(1);
		await info.attach(`old-client-${direction}-3d`, {
			body: await page.screenshot(),
			contentType: "image/png",
		});
		await info.attach("retained-application-boundary", {
			body: JSON.stringify({
				oldApplicationPath,
				oldBuild: old.appBuildId,
				activeBuild: active.appBuildId,
				embeddedBuild: embedded,
				physicalTelegram: false,
				threeWasAlreadyStatic: true,
			}),
			contentType: "application/json",
		});
	});
test("TMA-ENTRY-10: a missing application chunk gives retry and Web fallback without a partial runtime", async ({
	page,
}) => {
	await installEntryAudit(page, "invalid");
	let blocked = true;
	await page.route(
		(url) => /^\/[0-9]+\.[a-z0-9]+\.js$/.test(url.pathname),
		(route) => (blocked ? route.abort() : route.continue()),
	);
	await page.goto("/");
	await expect(page.getByText(/Не удалось загрузить редактор/)).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Открыть веб-редактор" }),
	).toBeVisible();
	await noStorage(page);
	blocked = false;
	await page
		.getByRole("button", { name: "Повторить запуск", exact: true })
		.click();
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	await expect.poll(async () => (await audit(page)).ready).toBe(1);
	await noStorage(page, 1);
});
test("TMA-ENTRY-11: a verified SDK ready failure revokes admission and offers retry before any database opens", async ({
	page,
}) => {
	await page.clock.setFixedTime(new Date(fixtureEditionTime));
	await installEntryAudit(page, "signed-ready-fails", signedExample);
	await page.goto("/");
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	).toBeVisible();
	const observed = await audit(page);
	expect(observed.ready).toBe(1);
	expect(observed.opens).toEqual([]);
	expect(
		observed.registrations +
			observed.unregisters +
			observed.deletes +
			observed.cacheDeletes,
	).toBe(0);
});

test("TMA-HOST-01: actual SDK stable viewport, overlapping insets and keyboard resize preserve the exact Project", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Host layout");
	const before = await semanticRows(page);
	const initialHeight = await page.evaluate(() =>
		Math.min(700, innerHeight, visualViewport?.height ?? innerHeight),
	);
	expect(
		await page.evaluate(() =>
			parseFloat(
				document.documentElement.style.getPropertyValue(
					"--editor-viewport-height",
				),
			),
		),
	).toBe(initialHeight);
	expect(
		await page.evaluate(() =>
			document.documentElement.style.getPropertyValue("--editor-safe-area-top"),
		),
	).toBe("max(env(safe-area-inset-top, 0px), 30px)");
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({
			viewportHeight: 500,
			viewportStableHeight: 500,
		});
		window.__telegramEntryProof.host.emit("viewportChanged", {
			isStateStable: false,
		});
	});
	expect(
		await page.evaluate(() =>
			parseFloat(
				document.documentElement.style.getPropertyValue(
					"--editor-viewport-height",
				),
			),
		),
	).toBe(initialHeight);
	await page.setViewportSize({ width: 360, height: 420 });
	await expect
		.poll(() =>
			page.evaluate(() =>
				parseFloat(
					document.documentElement.style.getPropertyValue(
						"--editor-viewport-height",
					),
				),
			),
		)
		.toBeLessThanOrEqual(420);
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("viewportChanged", {
			isStateStable: true,
		}),
	);
	expect(await semanticRows(page)).toEqual(before);
});
test("TMA-KEYBOARD-01: numeric entry keeps the plan in place above the keyboard", async ({ page }) => {
	await signed(page);
	await page.setViewportSize({ width: 390, height: 800 });
	await page.goto("/");
	await page.evaluate(() => { document.documentElement.style.fontSize = "14px"; });
	await createRoom(page, "Keyboard plan");
	await page.getByTestId("wall-segment").first().click();
	const wall = page.getByTestId("wall-line").first();
	const position = () => wall.evaluate(element => {
		const box = element.getBoundingClientRect();
		return [box.left, box.top, box.width, box.height].map(Math.round);
	});
	const original = await position();
	const revision = await semanticRows(page);
	await page.getByRole("button", { name: "Добавить проём", exact: true }).click();
	const sheet = page.getByRole("dialog", { name: "Новый проём" });
	const width = sheet.getByRole("textbox", { name: "Ширина, мм", exact: true });
	expect(await width.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
	await width.fill("980");
	await page.setViewportSize({ width: 390, height: 465 });
	await expect(page.getByTestId("editor-workspace")).toHaveCSS("height", "465px");
	await expect.poll(position).toEqual(original);
	await expect(width).toBeFocused();
	await expect(width).toHaveValue("980");
	const submit = sheet.getByRole("button", { name: "Добавить", exact: true });
	await submit.scrollIntoViewIfNeeded();
	expect(await submit.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(465);
	await page.setViewportSize({ width: 390, height: 800 });
	await expect.poll(position).toEqual(original);
	await page.setViewportSize({ width: 650, height: 420 });
	await expect.poll(position).not.toEqual(original);
	expect(await semanticRows(page)).toEqual(revision);
});

test("TMA-KEYBOARD-02: 3D framing survives keyboard entry in the rename dialog", async ({ page }) => {
	await signed(page);
	await page.setViewportSize({ width: 390, height: 800 });
	await page.goto("/");
	await createRoom(page, "Keyboard scene");
	await page.getByRole("button", { name: "3D", exact: true }).click();
	const canvas = page.getByTestId("three-dimensional-canvas");
	await expect(canvas).toBeVisible();
	await page.getByRole("button", { name: "Переименовать проект Keyboard scene" }).click();
	const field = page.getByRole("textbox", { name: "Новое название проекта" });
	await field.fill("Новая комната");
	const height = () => canvas.evaluate(el => el.getBoundingClientRect().height);
	const original = await height();
	await page.setViewportSize({ width: 390, height: 450 });
	await expect(page.getByTestId("editor-workspace")).toHaveCSS("height", "450px");
	await expect.poll(height).toBe(original);
	await expect(field).toBeFocused();
	await page.setViewportSize({ width: 390, height: 800 });
	await expect.poll(height).toBe(original);
});

test("TMA-HOST-02: dark host theme keeps actual room controls readable without changing any Revision", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Host theme");
	const before = await semanticRows(page);
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({
			colorScheme: "dark",
			themeParams: { bg_color: "#ffffff", text_color: "#ffffff" },
		});
		window.__telegramEntryProof.host.emit("themeChanged");
	});
	await page.getByTestId("wall-segment").first().click();
	await page
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Новый проём", exact: true });
	await expect(dialog).toBeVisible();
	expect(
		await dialog
			.locator("form")
			.evaluate((element) => getComputedStyle(element).backgroundColor),
	).toBe("rgb(31, 44, 54)");
	const colors = await dialog
		.getByRole("textbox", { name: "Ширина, мм", exact: true })
		.evaluate((input) => {
			const colors = [];
			for (const element of [
				input,
				input.closest("label"),
				input.parentElement,
			]) {
				if (!element) continue;
				const fg = getComputedStyle(element).color;
				let current: Element | null = element,
					bg = "";
				while (current) {
					const value = getComputedStyle(current).backgroundColor;
					if (value !== "rgba(0, 0, 0, 0)" && value !== "transparent") {
						bg = value;
						break;
					}
					current = current.parentElement;
				}
				colors.push({ fg, bg });
			}
			return colors;
		});
	function luminance(raw: string) {
		const components = raw.match(/[\d.]+/g);
		if (!components || components.length < 3)
			throw new Error("Expected computed RGB color");
		const rgb = components
			.slice(0, 3)
			.map(Number)
			.map((n) => {
				const c = n / 255;
				return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
			});
		return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
	}
	for (const { fg, bg } of colors) {
		const a = luminance(fg),
			b = luminance(bg);
		expect(
			(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
			`${fg} on ${bg}`,
		).toBeGreaterThanOrEqual(4.5);
	}
	expect(await semanticRows(page)).toEqual(before);
});
test("TMA-HOST-03: actual SDK Back preserves raw room draft and fresh focus until explicit discard", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Host Back");
	await page.getByRole("button", { name: "Помещения", exact: true }).click();
	const directory = page.getByRole("dialog", {
			name: "Помещения",
			exact: true,
		}),
		input = directory.getByRole("textbox", {
			name: "Высота помещения, мм",
			exact: true,
		});
	await input.fill(" 02x ");
	await input.focus();
	const before = await semanticRows(page);
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	const guard = page.getByRole("alertdialog", {
		name: "Несохранённая правка",
		exact: true,
	});
	await expect(guard).toBeVisible();
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(input).toHaveValue(" 02x ");
	await expect(input).toBeFocused();
	expect(await semanticRows(page)).toEqual(before);
	expect(
		await page.evaluate(
			() => window.__telegramEntryProof.host.listeners().backButtonClicked,
		),
	).toBe(1);
});
test("TMA-HOST-04: observable changed launch drains the mounted runtime and removes every host listener without changing saved data", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Host replacement");
	const before = await semanticRows(page);
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({
			initData: "unsigned replacement",
		});
		window.__telegramEntryProof.host.emit("activated");
	});
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	expect(
		await page.evaluate(() =>
			Object.values(window.__telegramEntryProof.host.listeners()).every(
				(value) => value === 0,
			),
		),
	).toBe(true);
	expect(
		await page.evaluate(() =>
			document.documentElement.style.getPropertyValue(
				"--editor-viewport-height",
			),
		),
	).toBe("");
	expect(await semanticRows(page)).toEqual(before);
	expect((await audit(page)).deletes).toBe(0);
});

test("TMA-THEME-01: canonical dark Plan remains readable and theme switches preserve raw field, focus, caret and exact rows", async ({
	page,
}, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Canonical dark Plan");
	const before = await semanticRows(page);
	const geometry = () =>
		page.getByTestId("plan-canvas").evaluate((svg) => ({
			viewBox: svg.getAttribute("viewBox"),
			walls: [...svg.querySelectorAll('[data-testid="wall-segment"]')].map(
				(wall) => ({
					id: wall.getAttribute("data-wall-id"),
					d: wall.getAttribute("d"),
					points: wall.getAttribute("points"),
				}),
			),
		}));
	const oldGeometry = await geometry();
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({ colorScheme: "dark" });
		window.__telegramEntryProof.host.emit("themeChanged");
	});
	const colors = await page.getByTestId("plan-canvas").evaluate((svg) => {
		const room = svg.querySelector('[data-testid="room-face"]');
		if (!room) throw new Error("Expected real Room projection");
		const background = getComputedStyle(room).fill;
		const labels = [
			...svg.querySelectorAll(
				'[data-testid="room-measurement"] text,[data-testid="drawing-dimensions"] text',
			),
		]
			.filter(
				(element) =>
					element.textContent?.trim() &&
					element.getClientRects().length > 0 &&
					getComputedStyle(element).visibility !== "hidden",
			)
			.map((element) => ({
				text: element.textContent,
				color: getComputedStyle(element).fill,
			}));
		return { background, labels };
	});
	expect(colors.background).toBe("rgb(29, 37, 44)");
	expect(colors.labels.length).toBeGreaterThan(0);
	function luminance(raw: string) {
		const components = raw.match(/[\d.]+/g);
		if (!components || components.length < 3)
			throw new Error(`Expected computed color ${raw}`);
		const rgb = components
			.slice(0, 3)
			.map(Number)
			.map((n) => {
				const c = n / 255;
				return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
			});
		return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
	}
	for (const label of colors.labels) {
		const a = luminance(label.color),
			b = luminance(colors.background);
		expect(
			(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
			label.text ?? "",
		).toBeGreaterThanOrEqual(4.5);
	}
	expect(await geometry()).toEqual(oldGeometry);
	await info.attach("dark-plan-contrast", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	await page.getByRole("button", { name: "Помещения", exact: true }).click();
	const input = page
		.getByRole("dialog", { name: "Помещения", exact: true })
		.getByRole("textbox", { name: "Высота помещения, мм", exact: true });
	await input.fill(" 02x ");
	await input.evaluate((element: HTMLInputElement) => {
		element.focus();
		element.setSelectionRange(1, 4, "backward");
	});
	for (const scheme of ["light", "dark"]) {
		await page.evaluate((colorScheme) => {
			window.__telegramEntryProof.host.patch({ colorScheme });
			window.__telegramEntryProof.host.emit("themeChanged");
		}, scheme);
		await expect(input).toHaveValue(" 02x ");
		await expect(input).toBeFocused();
		expect(
			await input.evaluate((element: HTMLInputElement) => [
				element.selectionStart,
				element.selectionEnd,
				element.selectionDirection,
			]),
		).toEqual([1, 4, "backward"]);
		expect(await semanticRows(page)).toEqual(before);
	}
});

async function readableControls(surface: Locator) {
	const contrasts = await surface.evaluate((element) => {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Expected color parser");
		const rgba = (value: string) => {
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = value;
			context.fillRect(0, 0, 1, 1);
			return [...context.getImageData(0, 0, 1, 1).data].map((n, i) =>
				i === 3 ? n / 255 : n,
			);
		};
		const luminance = (rgb: number[]) => {
			const c = rgb.slice(0, 3).map((n) => {
				const x = n / 255;
				return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
		};
		return [
			...element.querySelectorAll(
				"h1,h2,h3,strong,label,button,input,select,p,span",
			),
		]
			.filter(
				(node) =>
					(node.tagName !== "SPAN" || !!node.textContent?.trim()) &&
					node.getClientRects().length > 0 &&
					!node.hasAttribute("disabled") &&
					getComputedStyle(node).visibility !== "hidden" &&
					getComputedStyle(node).opacity !== "0",
			)
			.map((node) => {
				const foreground = rgba(getComputedStyle(node).color),
					layers: number[][] = [];
				let ancestor: Element | null = node;
				while (ancestor) {
					layers.push(rgba(getComputedStyle(ancestor).backgroundColor));
					ancestor = ancestor.parentElement;
				}
				let background = [255, 255, 255, 1];
				for (const layer of layers.reverse())
					background = layer
						.slice(0, 3)
						.map((n, i) => n * layer[3] + background[i] * (1 - layer[3]))
						.concat(1);
				const a = luminance(foreground),
					b = luminance(background);
				return {
					text: (node.textContent ?? node.getAttribute("aria-label") ?? "")
						.trim()
						.slice(0, 90),
					foreground,
					background,
					ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
				};
			});
	});
	expect(contrasts.length).toBeGreaterThan(0);
	for (const color of contrasts)
		expect(color.ratio, JSON.stringify(color)).toBeGreaterThanOrEqual(4.5);
}
test("TMA-THEME-02: actual dark dimension, rename, leave, catalog and local-file surfaces retain readable controls", async ({
	page,
}, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Dark surfaces");
	const before = await semanticRows(page);
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({ colorScheme: "dark" });
		window.__telegramEntryProof.host.emit("themeChanged");
	});
	await page
		.getByRole("button", { name: "Настроить размеры", exact: true })
		.click();
	const dimensions = page.getByRole("dialog", { name: "Размеры", exact: true });
	await expect(dimensions).toBeVisible();
	await readableControls(dimensions);
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	await expect(dimensions).not.toBeVisible();
	await page
		.getByRole("button", {
			name: "Переименовать проект Dark surfaces",
			exact: true,
		})
		.click();
	const rename = page.getByTestId("rename-project-sheet");
	await expect(rename).toBeVisible();
	await readableControls(rename);
	const input = rename.getByRole("textbox", {
		name: "Новое название проекта",
		exact: true,
	});
	await input.fill("  000 Темно  ");
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	const guard = page.getByRole("alertdialog", {
		name: "Несохранённая правка",
		exact: true,
	});
	await expect(guard).toBeVisible();
	await readableControls(guard);
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(input).toHaveValue("  000 Темно  ");
	await expect(input).toBeFocused();
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	await guard
		.getByRole("button", { name: "Отменить правку", exact: true })
		.click();
	await expect(rename).not.toBeVisible();
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalog = page
		.getByTestId("catalog-title")
		.locator("xpath=ancestor::*[@role='dialog'][1]");
	await expect(catalog).toBeVisible();
	await readableControls(catalog);
	await info.attach("dark-catalog-contrast", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	await page
		.getByRole("button", { name: "Закрыть предметы интерьера", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Экспортировать проект", exact: true })
		.click();
	const transfer = page.getByRole("complementary", {
		name: "Передача файла",
		exact: true,
	});
	await expect(
		transfer.getByRole("button", { name: "Передать файл", exact: true }),
	).toBeVisible();
	await readableControls(transfer);
	await transfer.getByRole("button", { name: "Закрыть", exact: true }).click();
	expect(await semanticRows(page)).toEqual(before);
});
test("TMA-THEME-03: actual dark 3D controls preserve a readable surface and the exact durable model", async ({
	page,
}, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Dark 3D controls");
	const before = await semanticRows(page);
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({ colorScheme: "dark" });
		window.__telegramEntryProof.host.emit("themeChanged");
	});
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
	await readableControls(page.getByTestId("editor-workspace"));
	await info.attach("dark-3d-controls", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	expect(await semanticRows(page)).toEqual(before);
});

async function allScopedRecords(page: Page) {
	return page.evaluate(async () => {
		const name = window.__telegramEntryProof.audit.opens.find((value) =>
			value.startsWith("interiors-editor-projects:tma-v1-"),
		);
		if (!name) throw new Error("Expected actual native scope");
		return new Promise<Record<string, unknown[]>>((resolve, reject) => {
			const opening = indexedDB.open(name);
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => {
				const db = opening.result,
					names = Array.from(db.objectStoreNames),
					transaction = db.transaction(names, "readonly"),
					records: Record<string, unknown[]> = {};
				for (const store of names) {
					const request = transaction.objectStore(store).getAll();
					request.onsuccess = () => {
						records[store] = request.result;
					};
				}
				transaction.oncomplete = () => {
					db.close();
					resolve(records);
				};
				transaction.onabort = () => {
					db.close();
					reject(transaction.error);
				};
			};
		});
	});
}
test("TMA-ENTRY-12: actual scoped source recovery exports an unverified exact UTF16 record beside a healthy Project", async ({
	page,
}) => {
	await signed(page);
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "canShare", {
			value: () => true,
			configurable: true,
		});
		Object.defineProperty(navigator, "share", {
			value: async (input: { files?: File[] }) => {
				const file = input.files?.[0];
				if (!file) throw new Error("Expected local source File");
				Reflect.set(window, "__sourceFileProof", {
					name: file.name,
					bytes: [...new Uint8Array(await file.arrayBuffer())],
				});
			},
			configurable: true,
		});
	});
	await page.goto("/");
	await createRoom(page, "Healthy source neighbour");
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page.getByRole("button", { name: "Проекты", exact: true }).click();
	await createRoom(page, "Unverified source record");
	const raw = "  \u0000 \ud800 \udfff \ud83d\ude80\n{future data}\t  ";
	await page.evaluate(async (raw) => {
		const name = window.__telegramEntryProof.audit.opens.find((value) =>
			value.startsWith("interiors-editor-projects:tma-v1-"),
		);
		if (!name) throw new Error("Expected actual scoped native store");
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open(name);
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => {
				const db = opening.result,
					transaction = db.transaction(["projects", "revisions"], "readwrite"),
					request = transaction.objectStore("projects").getAll();
				request.onsuccess = () => {
					const pointer = request.result.find(
						(row) => row.name === "Unverified source record",
					);
					if (!pointer) throw new Error("Expected actual Project pointer");
					const revision = transaction
						.objectStore("revisions")
						.get(pointer.currentRevisionId);
					revision.onsuccess = () => {
						const row = revision.result;
						row.candidate.project.schemaVersion = 999;
						row.candidate.revision.serializedProject = raw;
						transaction.objectStore("revisions").put(row);
					};
				};
				transaction.oncomplete = () => {
					db.close();
					resolve();
				};
				transaction.onabort = () => {
					db.close();
					reject(transaction.error);
				};
			};
		});
	}, raw);
	const before = await semanticRows(page),
		allBefore = await allScopedRecords(page);
	await page.clock.setFixedTime(new Date(fixtureEditionTime + 6_000));
	await page.reload();
	await expect(
		page.getByRole("button", {
			name: "Открыть Healthy source neighbour",
			exact: true,
		}),
	).toBeVisible();
	const sources = page.getByRole("complementary", {
		name: "Непроверенные исходники",
		exact: true,
	});
	await expect(sources).toBeVisible();
	await sources
		.getByRole("button", { name: "Показать записи", exact: true })
		.click();
	await sources
		.getByRole("button", { name: "Подготовить исходник записи 1", exact: true })
		.click();
	const file = page.getByRole("complementary", {
		name: "Передача файла",
		exact: true,
	});
	await expect(
		file.getByRole("heading", {
			name: "Непроверенная исходная запись",
			exact: true,
		}),
	).toBeVisible();
	expect(
		await page.evaluate(() => Reflect.get(window, "__sourceFileProof")),
	).toBeUndefined();
	await file
		.getByRole("button", { name: "Передать файл", exact: true })
		.click();
	await expect
		.poll(() =>
			page.evaluate(
				() => Reflect.get(window, "__sourceFileProof") !== undefined,
			),
		)
		.toBe(true);
	const captured = await page.evaluate(
		() =>
			Reflect.get(window, "__sourceFileProof") as {
				name: string;
				bytes: number[];
			},
	);
	expect(captured.name.endsWith(".interiors-source.json")).toBe(true);
	const wrapper = JSON.parse(
		new TextDecoder().decode(Uint8Array.from(captured.bytes)),
	);
	expect(wrapper.purpose).toBe("interiors-editor-unverified-source");
	expect(wrapper.kind).toBe("unverified-source");
	expect(wrapper.serializedProject).toBe(raw);
	expect(await semanticRows(page)).toEqual(before);
	expect(await allScopedRecords(page)).toEqual(allBefore);
	expect((await audit(page)).deletes).toBe(0);
	await expect(file.getByRole("status")).toContainText(
		"не подтверждает его сохранность",
	);
});

async function installReadonlyEntryDelivery(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "canShare", {
			configurable: true,
			value: () => true,
		});
		Object.defineProperty(navigator, "share", {
			configurable: true,
			value: async (input: { files?: File[] }) => {
				const file = input.files?.[0];
				if (!file) throw new Error("Missing actual local readonly file");
				Reflect.set(window, "__readonlyEntryFile", {
					name: file.name,
					bytes: [...new Uint8Array(await file.arrayBuffer())],
				});
			},
		});
	});
}
async function disableEntryLocksOnNextLoad(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "locks", {
			configurable: true,
			value: undefined,
		});
		const modes: string[] = [];
		Reflect.set(window, "__readonlyEntryModes", modes);
		const transaction = IDBDatabase.prototype.transaction;
		IDBDatabase.prototype.transaction = function (...args) {
			modes.push(args[1] ?? "readonly");
			return Reflect.apply(transaction, this, args);
		};
	});
}
async function capturedReadonlyEntryFile(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(
				() => Reflect.get(window, "__readonlyEntryFile") !== undefined,
			),
		)
		.toBe(true);
	return page.evaluate(
		() =>
			Reflect.get(window, "__readonlyEntryFile") as {
				name: string;
				bytes: number[];
			},
	);
}
test("TMA-ENTRY-13: actual signed readonly entry exports the existing exact room without Web Locks or any native write", async ({
	page,
}) => {
	await signed(page);
	await installReadonlyEntryDelivery(page);
	await page.goto("/");
	await createRoom(page, "Readonly exact room");
	const before = await allScopedRecords(page);
	const pointer = before.projects[0] as { currentRevisionId: string };
	const revision = before.revisions.find(
		(value) =>
			(value as { revisionId: string }).revisionId ===
			pointer.currentRevisionId,
	) as { candidate: { project: import("../../src/domain/project").Project } };
	await disableEntryLocksOnNextLoad(page);
	await page.clock.setFixedTime(new Date(fixtureEditionTime + 6_000));
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Просмотр проектов", exact: true }),
	).toBeVisible();
	const records = page.getByRole("region", {
		name: "Проверенные записи",
		exact: true,
	});
	await expect(records).toContainText("Readonly exact room");
	await expect(
		page.getByRole("button", { name: "Новый проект", exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Удалить проект", exact: true }),
	).toHaveCount(0);
	await records
		.getByRole("button", { name: "Подготовить файл проекта", exact: true })
		.click();
	const delivery = page.getByRole("complementary", {
		name: "Передача файла",
		exact: true,
	});
	await expect(
		delivery.getByRole("button", { name: "Передать файл", exact: true }),
	).toBeEnabled();
	expect(
		await page.evaluate(() => Reflect.get(window, "__readonlyEntryFile")),
	).toBeUndefined();
	await delivery
		.getByRole("button", { name: "Передать файл", exact: true })
		.click();
	const file = await capturedReadonlyEntryFile(page);
	expect(file.name.endsWith(".interiors")).toBe(true);
	const codec = new RuntimePortableBackupCodec(
		{
			sha256Bytes: async (bytes) =>
				Array.from(
					new Uint8Array(
						await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
					),
					(byte) => byte.toString(16).padStart(2, "0"),
				).join(""),
		},
		validateRuntimeV1Project,
	);
	const decoded = await codec.decode(Uint8Array.from(file.bytes));
	expect(decoded.kind).toBe("decoded");
	if (decoded.kind !== "decoded")
		throw new Error(
			"Actual readonly entry did not return a complete verified archive",
		);
	expect(decoded.schema).toBe("runtime-v1-wire");
	expect(decoded.decodedProject).toEqual(revision.candidate.project);
	expect(decoded.resources).toEqual([]);
	expect(await allScopedRecords(page)).toEqual(before);
	const modes = await page.evaluate(
		() => Reflect.get(window, "__readonlyEntryModes") as string[],
	);
	expect(modes.length).toBeGreaterThan(0);
	expect(modes.every((mode) => mode === "readonly")).toBe(true);
	expect((await audit(page)).ready).toBe(1);
	expect(
		(await audit(page)).deletes +
			(await audit(page)).registrations +
			(await audit(page)).unregisters +
			(await audit(page)).cacheDeletes,
	).toBe(0);
	await expect(delivery.getByRole("status")).toContainText(
		"Проверьте файл вне приложения",
	);
});
test("TMA-ENTRY-14: actual readonly entry preserves a corrupt original source and its healthy neighbour without native writes", async ({
	page,
}) => {
	await signed(page);
	await installReadonlyEntryDelivery(page);
	await page.goto("/");
	await createRoom(page, "Readonly healthy neighbour");
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page.getByRole("button", { name: "Проекты", exact: true }).click();
	await createRoom(page, "Readonly corrupt record");
	const raw = "  \u0000 \ud800 \udfff \ud83d\ude80\n{future data}\t  ";
	await page.evaluate(async (raw) => {
		const name = window.__telegramEntryProof.audit.opens.find((value) =>
			value.startsWith("interiors-editor-projects:tma-v1-"),
		);
		if (!name) throw new Error("Missing actual scope");
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open(name);
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => {
				const db = opening.result,
					transaction = db.transaction(["projects", "revisions"], "readwrite"),
					request = transaction.objectStore("projects").getAll();
				request.onsuccess = () => {
					const pointer = request.result.find(
						(row) => row.name === "Readonly corrupt record",
					);
					if (!pointer) throw new Error("Missing selected Project");
					const read = transaction
						.objectStore("revisions")
						.get(pointer.currentRevisionId);
					read.onsuccess = () => {
						const row = read.result;
						row.candidate.project.schemaVersion = 999;
						row.candidate.revision.serializedProject = raw;
						transaction.objectStore("revisions").put(row);
					};
				};
				transaction.oncomplete = () => {
					db.close();
					resolve();
				};
				transaction.onabort = () => {
					db.close();
					reject(transaction.error);
				};
			};
		});
	}, raw);
	const before = await allScopedRecords(page);
	const ordinal =
		before.projects.findIndex(
			(value) => (value as { name: string }).name === "Readonly corrupt record",
		) + 1;
	expect(ordinal).toBeGreaterThan(0);
	await disableEntryLocksOnNextLoad(page);
	await page.clock.setFixedTime(new Date(fixtureEditionTime + 6_000));
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Просмотр проектов", exact: true }),
	).toBeVisible();
	const healthy = page.getByRole("region", {
		name: "Проверенные записи",
		exact: true,
	});
	await expect(healthy).toContainText("Readonly healthy neighbour");
	await expect(healthy).not.toContainText("Readonly corrupt record");
	const sources = page.getByRole("complementary", {
		name: "Непроверенные исходники",
		exact: true,
	});
	await sources
		.getByRole("button", { name: "Показать записи", exact: true })
		.click();
	await sources
		.getByRole("button", {
			name: `Подготовить исходник записи ${ordinal}`,
			exact: true,
		})
		.click();
	const delivery = page.getByRole("complementary", {
		name: "Передача файла",
		exact: true,
	});
	await expect(
		delivery.getByRole("heading", {
			name: "Непроверенная исходная запись",
			exact: true,
		}),
	).toBeVisible();
	expect(
		await page.evaluate(() => Reflect.get(window, "__readonlyEntryFile")),
	).toBeUndefined();
	await delivery
		.getByRole("button", { name: "Передать файл", exact: true })
		.click();
	const file = await capturedReadonlyEntryFile(page);
	const wrapper = JSON.parse(
		new TextDecoder().decode(Uint8Array.from(file.bytes)),
	);
	expect(file.name.endsWith(".interiors-source.json")).toBe(true);
	expect(wrapper.kind).toBe("unverified-source");
	expect(wrapper.serializedProject).toBe(raw);
	expect(await allScopedRecords(page)).toEqual(before);
	expect(
		(
			await page.evaluate(
				() => Reflect.get(window, "__readonlyEntryModes") as string[],
			)
		).every((mode) => mode === "readonly"),
	).toBe(true);
});
test("TMA-ENTRY-15: readonly signed startup with absent storage never provisions a database or offers writer controls", async ({
	page,
}) => {
	await signed(page);
	await disableEntryLocksOnNextLoad(page);
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Просмотр проектов", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Проверенные записи", exact: true }),
	).toHaveCount(0);
	await expect(
		page
			.getByRole("status")
			.filter({
				hasText: "В этом локальном контексте пока нет проверенных проектов.",
			}),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Подготовить файл проекта", exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Новый проект", exact: true }),
	).toHaveCount(0);
	expect(
		(await page.evaluate(() => indexedDB.databases())).filter((value) =>
			value.name?.startsWith("interiors-editor-projects:tma-v1-"),
		),
	).toEqual([]);
	expect((await audit(page)).opens).toEqual([]);
	expect((await audit(page)).ready).toBe(1);
	expect((await audit(page)).deletes).toBe(0);
});

test("TMA-OPENINGS: create, flip and reopen a door beside a framed window in Plan and 3D", async ({ page }, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Дверь и окно");
	await page.getByTestId("wall-segment").first().click();
	await page.getByRole("button", { name: "Добавить проём" }).click();
	const dialog = page.getByTestId("opening-creation-draft");
	await dialog.getByRole("button", { name: "Влево" }).click();
	const previewLeaf = page.getByTestId("opening-creation-preview").getByTestId("door-leaf");
	expect(Number(await previewLeaf.getAttribute("y2"))).toBeGreaterThan(0);
	await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
	const door = page.getByTestId("door-opening");
	expect(Number(await door.getByTestId("door-leaf").getAttribute("y2"))).toBeGreaterThan(0);
	await door.getByTestId("opening-move-handle").click();
	await page.getByRole("button", { name: "Параметры", exact: true }).click();
	const edit = page.getByTestId("opening-draft");
	await expect(edit.getByRole("button", { name: "Влево" })).toHaveAttribute("aria-pressed", "true");
	await edit.getByRole("button", { name: "Вправо" }).click();
	expect(Number(await door.getByTestId("door-leaf").getAttribute("y2"))).toBeLessThan(0);
	await edit.getByRole("button", { name: "Сохранить проём" }).click();
	await expect(edit).toBeHidden();

	await clickRectangularRoomPoint(page, { x: 0.25, y: 0.4 });
	await page.getByTestId("wall-segment").last().click();
	await page.getByRole("button", { name: "Добавить проём" }).click();
	await dialog.getByRole("button", { name: "Окно", exact: true }).click();
	await expect(dialog.getByRole("group", { name: "Направление открывания" })).toHaveCount(0);
	await expect(page.getByTestId("window-frame")).toBeVisible();
	await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect(page.getByTestId("window-opening").getByTestId("window-opening-pane")).toHaveCount(2);

	await page.getByRole("button", { name: "Назад", exact: true }).click();
	await page.getByRole("button", { name: "Открыть Дверь и окно", exact: true }).click();
	expect(Number(await door.getByTestId("door-leaf").getAttribute("y2"))).toBeLessThan(0);
	await expect(page.getByTestId("window-frame")).toBeVisible();
	const windowHandle = page.getByTestId("window-opening").getByTestId("opening-move-handle");
	const dot = windowHandle.locator("xpath=following-sibling::*[local-name()='circle']");
	await expect(dot).toHaveCSS("opacity", "0");
	await windowHandle.focus();
	await page.keyboard.press("Tab");
	await page.keyboard.press("Shift+Tab");
	await expect(dot).toHaveCSS("opacity", "1");
	await clickRectangularRoomCentre(page);
	await page.screenshot({ path: info.outputPath("opening-templates-plan.png") });
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
	await page.screenshot({ path: info.outputPath("opening-templates-3d.png") });
});

test("TMA-SCENE-PALETTE: opening the color chooser preserves the placement draft, camera and equal-sized scene actions", async ({
	page,
}, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Палитра 3D");
	const button = (name: string) =>
		page.getByRole("button", { name, exact: true });
	const scene = page.getByTestId("three-dimensional-canvas");
	const boundsOf = async (element: Locator) => {
		const box = await element.boundingBox();
		if (!box) throw new Error(`Expected a visible bounding box for ${element}`);
		return box;
	};
	await button("Предметы интерьера").click();
	await page
		.getByRole("dialog", { name: "Предметы интерьера" })
		.getByRole("button", { name: /^Стул / })
		.click();
	await button("3D").click();
	await expect(scene).toBeVisible();
	const placement = page.getByTestId("tma-placement-color");
	const choice = placement.getByRole("button", { name: /^Цвет/ });
	await expect(choice).toBeVisible({ timeout: 1500 });
	const bounds = await boundsOf(scene);
	await choice.click();
	const palette = page.getByRole("dialog", {
		name: "Цвет предмета",
		exact: true,
	});
	await expect(palette).toBeVisible();
	await expect(
		palette.getByRole("button", { name: "Тёплое дерево" }),
	).toBeVisible();
	await expect(palette.getByRole("button", { pressed: true })).toBeFocused();
	expect(await boundsOf(scene)).toEqual(bounds);
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	await expect(palette).toBeHidden();
	await expect(choice).toBeFocused();
	await expect(
		page.getByTestId("three-dimensional-item-placement-menu"),
	).toBeVisible();
	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await choice.click();
	await palette.getByRole("button", { name: /Лесной зелёный/ }).click();
	await expect(palette).toBeHidden();
	await expect(choice).toHaveAccessibleName(/Лесной зелёный/);
	await page.setViewportSize({ width: 740, height: 360 });
	const landscapeDock = page.getByTestId("three-dimensional-item-placement-menu");
	await expect.poll(async () => {
		const box = await boundsOf(landscapeDock);
		return box.y >= 0 && box.y + box.height <= 360;
	}).toBe(true);
	const landscapePlacement = await boundsOf(landscapeDock);
	await choice.click();
	await expectTmaModalBottom(palette);
	const landscapePalette = await boundsOf(palette);
	expect(landscapePalette.height).toBeGreaterThan(90);
	expect(await boundsOf(landscapeDock)).toEqual(landscapePlacement);
	await palette.getByRole("button", { name: /Ягод/ }).scrollIntoViewIfNeeded();
	await page.keyboard.press("Escape");
	await expect(choice).toBeFocused();
	await page.setViewportSize({ width: 390, height: 700 });
	await button("План 2D").click();
	await clickRectangularRoomCentre(page);
	await button("Подтвердить размещение предмета").click();
	await page.getByTestId("schematic-item").click();
	await button("3D").click();
	const deck = page.getByTestId("three-dimensional-view-controls");
	const color = deck.getByRole("button", { name: /^Цвет/ });
	for (const [w, h, scale, theme] of [
		[320, 680, 100, "light"],
		[375, 700, 100, "light"],
		[390, 700, 100, "dark"],
		[320, 680, 200, "dark"],
		[740, 360, 100, "light"],
		[768, 900, 100, "dark"],
	] as const) {
		await page.setViewportSize({ width: w, height: h });
		await page.evaluate(
			({ scale, theme }) => {
				document.documentElement.style.fontSize = `${scale}%`;
				const host = window.__telegramEntryProof.host;
				host.patch({
					colorScheme: theme,
					safeAreaInset: { top: 0, bottom: 18, left: 12, right: 12 },
				});
				host.emit("themeChanged");
				host.emit("safeAreaChanged");
			},
			{ scale, theme },
		);
		await expect(color).toBeVisible();
		if (w <= 559)
			await expect
				.poll(async () => {
					const header = await boundsOf(page.getByTestId("editor-top-bar"));
					const deckBox = await boundsOf(deck);
					const canvas = await boundsOf(scene);
					return Math.max(
						Math.abs(canvas.y - header.y - header.height),
						Math.abs(canvas.y + canvas.height - deckBox.y),
					);
				})
				.toBeLessThan(1.1);
		await page.evaluate(
			() =>
				new Promise<void>((r) =>
					requestAnimationFrame(() => requestAnimationFrame(() => r())),
				),
		);
		const boxes = await Promise.all([
			boundsOf(deck.getByRole("button", { name: "Предметы интерьера" })),
			boundsOf(deck.getByRole("button", { name: "Авто cutaway" })),
			boundsOf(deck.getByRole("button", { name: "Показать все стены" })),
			boundsOf(color),
		]);
		for (const box of boxes) {
			expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1.1);
			expect(box.height).toBe(boxes[0].height);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}
		const before = await boundsOf(scene);
		const toolbar = await boundsOf(deck);
		await color.click();
		await expectTmaModalBottom(palette);
		const pop = await boundsOf(palette);
		expect(pop.height).toBeGreaterThan(90);
		if (w === 375 || w === 390) {
			const violet = palette.getByRole("button", { name: "Мягкий фиолетовый" });
			const lines = await violet
				.locator("span")
				.last()
				.evaluate((label) => {
					const range = document.createRange();
					range.selectNodeContents(label);
					return range.getClientRects().length;
				});
			expect(lines).toBe(1);
			expect(pop.height).toBeLessThanOrEqual(235);
			await expect(
				palette.getByRole("button", { name: /Лесной зелёный/ }),
			).toHaveText("✓Зелёный");
		}
		await info.attach(`palette-metrics-${w}-${scale}.json`, {
			body: JSON.stringify({
				scene: before,
				toolbar,
				palette: pop,
				buttons: boxes,
			}),
			contentType: "application/json",
		});
		if (w === 390 || w === 740 || scale === 200)
			await page.screenshot({
				path: info.outputPath(`palette-${w}-${scale}.png`),
			});
		expect(pop.x).toBeGreaterThanOrEqual(12);
		expect(pop.x + pop.width).toBeLessThanOrEqual(w - 12);
		expect(await boundsOf(scene)).toEqual(before);
		expect(await boundsOf(deck)).toEqual(toolbar);
		await page.keyboard.press("Escape");
		await expect(palette).toBeHidden();
		await expect(color).toBeFocused();
	}
	await color.click();
	await palette.getByRole("button", { name: /Глубокий синий/ }).click();
	await expect(palette).toBeHidden();
	const confirm = page.getByRole("dialog", {
		name: "Подтвердить вариант цвета",
	});
	await confirm.getByRole("button", { name: "Отменить", exact: true }).click();
	await expect(color).toBeFocused();
	await expect(color).toHaveAccessibleName(/Лесной зелёный/);
});

test("TMA-LEGAL: first-use documents, independent settings and preserved older projects", async ({ page }) => {
	await signed(page, true);
	const measuredRequests: string[] = [];
	page.on("request", request => {
		if (new URL(request.url()).pathname.startsWith("/stats/")) measuredRequests.push(request.url());
	});
	await installReadonlyEntryDelivery(page);
	await page.goto("/");
	const entry = page.getByRole("region", { name: "Перед началом работы" });
	await expect(entry).toBeVisible();
	await expect(entry.getByText(/22 ноября 2026/)).toBeVisible();
	expect((await audit(page)).opens).toEqual([]);
	const policy = entry.getByRole("link", { name: "Политика конфиденциальности", exact: true });
	await policy.click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(policy).toBeFocused();
	await expect(entry.getByRole("button", { name: "Настройки", exact: true })).toHaveCount(0);
	await expect(page.getByRole("navigation", { name: "Документы приложения", includeHidden: true })).toHaveCount(1);
	await expect(entry).toContainText("Статистика помогает улучшать сервис.");
	await expect(entry).not.toContainText(/подсч[её]т|открыти[йя]/i);
	const panel = page.getByRole("dialog", { name: "Настройки", exact: true });
	const disclosure = entry.getByText("Уже есть сохранённые проекты?", { exact: true });
	const savedProjects = entry.getByRole("button", { name: "Посмотреть сохранённые проекты" });
	await expect(disclosure).toBeVisible();
	await expect(savedProjects).toBeHidden();
	const preferences = entry.getByRole("button", { name: "Настройки статистики", exact: true });
	await preferences.click();
	const stats = page.getByRole("dialog", { name: "Статистика", exact: true });
	const aggregate = stats.getByRole("switch", { name: "Делиться статистикой" });
	await expect(aggregate).toBeChecked();
	await aggregate.click();
	await expect(aggregate).not.toBeChecked();
	await expect(stats.getByText("Статистика выключена.")).toBeVisible();
	await stats.getByRole("button", { name: "Закрыть статистику" }).click();
	await expect(preferences).toBeFocused();
	await page.evaluate(() => window.__telegramEntryProof.host.emit("settingsButtonClicked"));
	await expect(stats).toBeVisible();
	await expect(panel).toHaveCount(0);
	await page.evaluate(() => window.__telegramEntryProof.host.emit("backButtonClicked"));
	await expect(stats).toBeHidden();
	await expect(entry).toBeVisible();
	expect(await page.evaluate(() => window.__telegramEntryProof.host.calls
		.filter(call => call === "show" || call === "hide").at(-1))).toBe("show");
	expect(measuredRequests).toEqual([]);
	const accept = entry.getByRole("button", { name: "Принять лицензионное соглашение" });
	await expect(entry.getByRole("button", { name: "Продолжить", exact: true })).toHaveCount(0);
	await accept.click();
	const hub = page.getByTestId("project-hub");
	await expect(hub).toBeVisible();
	const settings = page.getByRole("button", { name: "Настройки", exact: true });
	await settings.click();
	await expect(panel.getByRole("link")).toHaveCount(3);
	await panel.getByRole("button", { name: "Настройки статистики" }).click();
	await expect(aggregate).not.toBeChecked();
	await stats.getByRole("button", { name: "Закрыть статистику" }).click();
	expect(measuredRequests).toEqual([]);
	await expect(panel.getByText(/22 ноября 2026/)).toBeVisible();
	const consent = panel.getByRole("link", { name: "Согласие на дополнительную статистику" });
	await consent.click();
	await page.evaluate(() => window.__telegramEntryProof.host.emit("backButtonClicked"));
	await expect(consent).toBeFocused();
	await panel.getByRole("button", { name: "Закрыть настройки" }).click();
	await expect(settings).toBeFocused();
	await page.evaluate(() => window.__telegramEntryProof.host.emit("settingsButtonClicked"));
	await expect(panel).toBeVisible();
	await page.evaluate(() => window.__telegramEntryProof.host.emit("backButtonClicked"));
	await expect(panel).not.toBeVisible();
	await page.reload();
	await expect(hub).toBeVisible();
	await createRoom(page, "Прежний проект");
	await page.evaluate(revision => {
		for (const key of Object.keys(localStorage)) {
			if (key.endsWith(`:license:${revision}`)) {
				localStorage.setItem(key.replace(revision, "2026-11-22"), localStorage.getItem(key) ?? "");
				localStorage.removeItem(key);
			}
		}
	}, licenseRevision);
	await page.reload();
	await expect(entry).toBeVisible();
	await page.clock.setFixedTime(new Date(fixtureEditionTime + 600_000));
	await disclosure.click();
	await expect(entry).toContainText("Без принятия соглашения можно посмотреть свои проекты и скачать их копии.");
	await savedProjects.click();
	await expect(page.getByRole("heading", { name: "Просмотр проектов" })).toBeVisible();
	const records = page.getByRole("region", { name: "Проверенные записи" });
	await expect(records).toContainText("Прежний проект");
	await records.getByRole("button", { name: "Подготовить файл проекта" }).click();
	await page.getByRole("button", { name: "Передать файл" }).click();
	const file = await capturedReadonlyEntryFile(page);
	expect(file.name).toMatch(/\.interiors$/);
	expect(file.bytes.length).toBeGreaterThan(0);
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toHaveCount(0);
	await settings.click();
	await expect(panel.getByRole("link")).toHaveCount(3);
});
