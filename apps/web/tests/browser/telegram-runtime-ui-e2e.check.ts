import { expect, type Locator, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";
import type {} from "./telegram-runtime-ui-harness";
import { encryptProjectTransfer } from "../../src/adapters/telegram/encrypted-project-transfer";
import { openEditorCatalog, openOpeningDetailsOnSelectedWall } from "./telegram-entry-support";
import { projectRectangularRoomForWebGl } from "../../src/adapters/renderer/rectangular-room-projection";
import { canvasPointForFloor, canvasPointForSceneItem } from "../../src/ui/three-dimensional-floor-interaction";
import { clickRectangularRoomPoint } from "./room-geometry-fixture";

async function start(page: Page, scope: "a" | "b") {
	await page.evaluate(async (scope) => {
		await window.__telegramRuntimeUi.initialize();
		await window.__telegramRuntimeUi.mount(scope);
	}, scope);
	await expect(
		page.getByRole("button", { name: "Новый проект", exact: true }),
	).toBeVisible();
}
async function saved(page: Page) {
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
}
async function createRoom(page: Page, name: string) {
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill(name);
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("textbox", { name: "Ширина, мм", exact: true })
		.fill("4000");
	await page
		.getByRole("textbox", { name: "Глубина, мм", exact: true })
		.fill("3000");
	await page
		.getByRole("textbox", { name: "Высота, мм", exact: true })
		.fill("2800");
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await saved(page);
}
async function dimensions(page: Page) {
	await page
		.getByRole("button", { name: "Настроить размеры", exact: true })
		.click();
	return page.getByRole("dialog", { name: "Размеры", exact: true });
}
async function open(page: Page, name: string) {
	await page
		.getByRole("button", { name: `Открыть ${name}`, exact: true })
		.click();
	await saved(page);
}
const browser = (page: Page) =>
	page.evaluate(() => window.__telegramRuntimeUi.browserSnapshot());
const rows = (page: Page, scope: "a" | "b") =>
	page.evaluate(
		(scope) => window.__telegramRuntimeUi.semanticRows(scope),
		scope,
	);
async function currentProject(page: Page) {
	return page.evaluate(() => {
		const state = window.__telegramRuntimeUi.state();
		if (
			!("project" in state) ||
			!state.project ||
			state.project.schemaVersion !== 1
		)
			throw new Error("No actual saved V1 Project");
		return state.project;
	});
}
test.beforeEach(async ({ page, baseURL }, info) => {
	if (!baseURL) throw new Error("Missing isolated fixture origin");
	const allowedOrigin = new URL(baseURL).origin;
	await page.route("**/*", (route) =>
		new URL(route.request().url()).origin === allowedOrigin
			? route.continue()
			: route.abort(),
	);
	await page.goto("/");
	expect(await page.evaluate(() => Reflect.get(globalThis, "__stryker__")?.activeMutant)).toBe(info.project.metadata.activeMutant);
	await page.evaluate(() => window.__telegramRuntimeUi.initialize());
});
test.afterEach(async ({ page }) => {
	await page
		.evaluate(() => window.__telegramRuntimeUi.dispose())
		.catch(() => undefined);
});

test("TMA-UI-01: real EditorApp creates a durable rectangle and reload reopens its exact scoped Revision", async ({
	page,
}) => {
	const preserved = await browser(page);
	await start(page, "a");
	await createRoom(page, "UI rectangle A");
	const before = await rows(page, "a");
	const source = await currentProject(page);
	expect(before.revisions).toHaveLength(2);
	expect(source.level.rooms[0]?.heightMm).toBe(2800);
	expect(Math.max(...source.level.vertices.map((vertex) => vertex.xMm))).toBe(
		4100,
	);
	await page.reload();
	await start(page, "a");
	await open(page, "UI rectangle A");
	expect(await currentProject(page)).toEqual(source);
	expect(await rows(page, "a")).toEqual(before);
	expect(await browser(page)).toEqual(preserved);
});

test("TMA-ADD-OPENING: the ordinary plan adds a door or window at the specified position", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact"));
	await createRoom(page, "Проёмы на плане");
	const dock = page.getByTestId("editor-action-dock");
	await expect(dock.getByRole("button")).toHaveText(["Комната", "Стена", "Добавить", "Выбор"]);
	const add = dock.getByRole("button", { name: "Добавить", exact: true });
	await add.click();
	const chooser = page.getByRole("dialog", { name: "Добавить", exact: true });
	await expect(chooser.getByRole("button", { name: "Предмет", exact: true })).toBeVisible();
	await chooser.getByRole("button", { name: "Дверь", exact: true }).click();
	await expect(chooser).toBeHidden();
	const picking = page.getByTestId("opening-host-picker");
	await expect(picking).toBeVisible();
	await expect(page.locator('[data-testid="wall-segment"][data-opening-host="true"]')).toHaveCount(4);
	await page.getByTestId("wall-segment").first().click();
	const candidate = page.getByTestId("opening-creation-draft");
	await expect(candidate).toBeVisible();
	await expect(page.getByTestId("opening-creation-preview")).toBeVisible();
	expect((await currentProject(page)).level.openings).toEqual([]);
	await candidate.getByRole("button", { name: "Параметры", exact: true }).click();
	await candidate.getByRole("textbox", { name: "Смещение вдоль стены, мм" }).fill("1300");
	await candidate.getByRole("button", { name: "Подтвердить", exact: true }).click();
	await saved(page);
	const [door] = (await currentProject(page)).level.openings;
	expect(door).toMatchObject({ kind: "Door", offsetMm: 1300 });
	await page.getByTestId("wall-segment").first().click();
	await expect(page.getByRole("button", { name: "Добавить проём", exact: true })).toHaveCount(0);
	await expect(add).toBeVisible();

	await dock.getByRole("button", { name: "Выбор и перемещение", exact: true }).click();
	await add.click();
	await chooser.getByRole("button", { name: "Окно", exact: true }).click();
	await picking.getByRole("button", { name: "Выбрать стену", exact: true }).click();
	await page.getByRole("button", { name: /^Стена 2 ·/ }).click();
	await expect(candidate).toBeVisible();
	await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
	await page.getByRole("button", { name: "Продолжить", exact: true }).click();
	await candidate.getByRole("button", { name: "Параметры", exact: true }).click();
	await expect(candidate.getByRole("textbox", { name: "Высота подоконника, мм" })).toHaveCount(0);
	await candidate.getByRole("button", { name: "Подтвердить", exact: true }).click();
	await saved(page);
	expect((await currentProject(page)).level.openings).toEqual([door, expect.objectContaining({ kind: "Window", sillMm: 900 })]);
});

for (const [kind, width] of [["Дверь", 900], ["Окно", 1200]] as const) {
test(`TMA-MOVE-OPENING: ${kind} follows its dimension and saves one revision at release`, async ({ page }, info) => {
	await page.setViewportSize({ width: 320, height: 740 });
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "authoring"));
	await createRoom(page, "Перемещение проёма");
	await page.getByTestId("wall-segment").first().click();
	await page.getByTestId("editor-action-dock").getByRole("button", { name: "Добавить", exact: true }).click();
	await page.getByRole("dialog", { name: "Добавить", exact: true }).getByRole("button", { name: kind, exact: true }).click();
	await page.getByTestId("opening-creation-draft").getByRole("button", { name: "Подтвердить", exact: true }).click();
	await saved(page);
	const baseline = await currentProject(page);
	const before = await rows(page, "a");
	const handle = page.getByTestId("opening-move-handle");
	const contact = await handle.boundingBox();
	if (!contact) throw new Error("Opening move handle is missing");
	const x = contact.x + contact.width / 2;
	const y = contact.y + contact.height / 2;
	if (kind === "Дверь") {
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 20, y, { steps: 4 });
		await expect(page.getByTestId("opening-drag-dimension")).toBeVisible();
		await page.getByTestId("plan-canvas").dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse", isPrimary: true });
		await page.mouse.up();
		await expect(page.getByTestId("opening-drag-dimension")).toHaveCount(0);
		expect(await rows(page, "a")).toEqual(before);

		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 125, y, { steps: 5 });
		await expect(page.getByTestId("opening-move-feedback")).toBeVisible();
		await page.mouse.up();
		await expect(page.getByTestId("opening-drag-dimension")).toHaveCount(0);
		await expect(page.getByText("Проём не помещается в границы выбранной стены.", { exact: true })).toBeVisible();
		expect(await rows(page, "a")).toEqual(before);
	}
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + 12, y, { steps: 2 });
	const edges = page.getByTestId("opening-preview-edges");
	await expect(edges.locator("circle")).toHaveCount(2);
	const dimension = page.getByTestId("opening-drag-dimension");
	await expect(dimension).toHaveText(String(width));
	await expect(page.getByText("Проём не помещается в границы выбранной стены.", { exact: true })).toHaveCount(0);
	const startX = (await dimension.boundingBox())?.x ?? 0;
	await page.mouse.move(x + 30, y, { steps: 4 });
	await expect.poll(async () => (await dimension.boundingBox())?.x ?? 0).toBeGreaterThan(startX + 4);
	const jambs = await edges.locator("circle").evaluateAll(nodes => nodes.map(node => {
		const rect = node.getBoundingClientRect();
		return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
	}));
	const labelBounds = await dimension.boundingBox();
	if (!labelBounds || jambs.length !== 2) throw new Error("Missing dimension marks");
	expect(Math.abs(labelBounds.x + labelBounds.width / 2 - (jambs[0].x + jambs[1].x) / 2)).toBeLessThan(1);
	expect(labelBounds.y + labelBounds.height).toBeLessThan(jambs[0].y);
	await page.screenshot({ path: info.outputPath("opening-drag-dimension.png") });
	await expect(page.getByRole("button", { name: "Параметры", exact: true })).toBeHidden();
	expect(await rows(page, "a")).toEqual(before);
	await page.mouse.up();
	await saved(page);
	await expect(page.getByTestId("opening-move-confirmation")).toHaveCount(0);
	await expect(edges).toHaveCount(0);
	const [original] = baseline.level.openings;
	const [moved] = (await currentProject(page)).level.openings;
	expect(moved?.offsetMm).toBeGreaterThan(original.offsetMm);
	expect(moved).toEqual({ ...original, offsetMm: moved?.offsetMm });
	expect((await rows(page, "a")).revisions).toHaveLength(before.revisions.length + 1);
	await page.getByRole("button", { name: /^Отменить действие/ }).click();
	await saved(page);
	expect((await currentProject(page)).level.openings).toEqual(baseline.level.openings);
});
}

test("TMA-UI-02: full A→B→A remount keeps Projects/preferences isolated and leaves real browser data/cache/preferences untouched", async ({
	page,
}) => {
	const preserved = await browser(page);
	await start(page, "a");
	await createRoom(page, "UI scope A");
	const beforeA = await rows(page, "a");
	let dialog = await dimensions(page);
	await expect(
		dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true }),
	).not.toBeChecked();
	await dialog
		.getByRole("checkbox", { name: "Внешние габариты", exact: true })
		.check();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	await start(page, "b");
	await expect(
		page.getByRole("button", { name: "Открыть UI scope A", exact: true }),
	).toHaveCount(0);
	await createRoom(page, "UI scope B");
	const beforeB = await rows(page, "b");
	dialog = await dimensions(page);
	await expect(
		dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true }),
	).not.toBeChecked();
	await dialog.getByRole("tab", { name: "Проёмы", exact: true }).click();
	await dialog
		.getByRole("checkbox", { name: "Ширина проёмов", exact: true })
		.check();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	await start(page, "a");
	await expect(
		page.getByRole("button", { name: "Открыть UI scope B", exact: true }),
	).toHaveCount(0);
	await open(page, "UI scope A");
	dialog = await dimensions(page);
	await expect(
		dialog.getByRole("checkbox", { name: "Внешние габариты", exact: true }),
	).toBeChecked();
	await dialog.getByRole("tab", { name: "Проёмы", exact: true }).click();
	await expect(
		dialog.getByRole("checkbox", { name: "Ширина проёмов", exact: true }),
	).not.toBeChecked();
	expect(await rows(page, "a")).toEqual(beforeA);
	expect(await rows(page, "b")).toEqual(beforeB);
	expect(await browser(page)).toEqual(preserved);
});

async function prepared(page: Page) {
	const fixture = await page.evaluate(() =>
		window.__telegramRuntimeUi.prepareUpperCustom("a"),
	);
	expect(fixture.resourceHash).toBe(fixture.actualDigest.toUpperCase());
	expect(fixture.resourceHash).not.toBe(fixture.actualDigest);
	expect(fixture.pinnedBytes).toEqual(fixture.sourceBytes);
	await page.evaluate(() => window.__telegramRuntimeUi.mountPrepared("a"));
	await open(page, "Uppercase local model");
	return fixture;
}
test("TMA-UI-03: a real pinned raw-UPPER resource hydrates its visible custom catalogue card", async ({
	page,
}, info) => {
	const fixture = await prepared(page);
	await info.attach("actual-upper-pin", {
		contentType: "application/json",
		body: JSON.stringify(fixture),
	});
	await openEditorCatalog(page);
	await page.getByRole("button", { name: "Кастомное", exact: true }).click();
	const card = page.getByRole("button", {
		name: /Local upper triangle.*Кастомное/,
	});
	await expect(card).toBeVisible();
	await expect(card).toBeEnabled();
	expect(await rows(page, "a")).toEqual(fixture.before);
});
test("TMA-UI-04: the actual 3D resource path renders the pinned raw-UPPER GLB without changing Project rows", async ({
	page,
}, info) => {
	const fixture = await prepared(page);
	await info.attach("actual-upper-pin", {
		contentType: "application/json",
		body: JSON.stringify(fixture),
	});
	await page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "3D", exact: true })
		.click();
	await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
	await expect(
		page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	expect(await rows(page, "a")).toEqual(fixture.before);
	await info.attach("actual-scoped-3d", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
});

test("TMA-UI-RESOURCE-01: a transient scoped GLB read retries, while a checksum mismatch still enters recovery", async ({ page }) => {
	const preserved = await browser(page);
	const fixture = await page.evaluate(async () => {
		const prepared = await window.__telegramRuntimeUi.prepareUpperCustom("a");
		window.__telegramRuntimeUi.mountPreparedNavigable("a");
		return prepared;
	});
	await open(page, "Uppercase local model");
	const before = await rows(page, "a");
	const key = "tmaTransientResourceReads";
	await page.evaluate(({ byteLength, key }) => {
		const read = Blob.prototype.arrayBuffer;
		let count = 0;
		Reflect.set(window, key, count);
		Blob.prototype.arrayBuffer = function () {
			if (this.size === byteLength) {
				Reflect.set(window, key, ++count);
				if (count === 1) {
					return Promise.reject(new DOMException("Synthetic file read failure", "NotReadableError"));
				}
				Blob.prototype.arrayBuffer = read;
			}
			return read.call(this);
		};
		for (let index = 0; index < 4; index++) {
			document.dispatchEvent(new Event("visibilitychange"));
		}
	}, { byteLength: fixture.byteLength, key });
	await expect.poll(() => page.evaluate((key) => Reflect.get(window, key), key)).toBe(2);
	await saved(page);
	await expect(page.getByTestId("resource-recovery-projection-notice")).toHaveCount(0);
	expect(await rows(page, "a")).toEqual(before);

	await page.evaluate(async ({ byteLength, resourceHash }) => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(`interiors-editor-projects:tma-v1-${"a".repeat(64)}`);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = database.transaction("resources", "readwrite");
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
				const resources = transaction.objectStore("resources");
				const request = resources.get(resourceHash);
				request.onsuccess = () => {
					if (!request.result) {
						transaction.abort();
						return;
					}
					resources.put({ ...request.result, blob: new Blob([new Uint8Array(byteLength)]) });
				};
			});
		} finally {
			database.close();
		}
		document.dispatchEvent(new Event("visibilitychange"));
	}, { byteLength: fixture.byteLength, resourceHash: fixture.resourceHash });
	await expect(page.getByRole("heading", { name: "Проект требует восстановления", exact: true })).toBeVisible();
	expect(await rows(page, "a")).toEqual(before);
	expect(await browser(page)).toEqual(preserved);
});

test("TMA-UI-RESOURCE-02: opening a project retries one unreadable pinned blob", async ({ page }) => {
	const { byteLength } = await page.evaluate(async () => {
		const fixture = await window.__telegramRuntimeUi.prepareUpperCustom("a");
		window.__telegramRuntimeUi.mountPreparedNavigable("a");
		return fixture;
	});
	const before = await rows(page, "a");
	await page.evaluate((size) => {
		const read = Blob.prototype.arrayBuffer;
		Blob.prototype.arrayBuffer = function () {
			if (this.size === size) {
				Blob.prototype.arrayBuffer = read;
				Reflect.set(window, "pinnedBlobReadInterrupted", true);
				return Promise.reject(new DOMException("Transient fixture read", "NotReadableError"));
			}
			return read.call(this);
		};
	}, byteLength);
	await open(page, "Uppercase local model");
	expect(await page.evaluate(() => Reflect.get(window, "pinnedBlobReadInterrupted"))).toBe(true);
	expect((await currentProject(page)).assetInstances).toHaveLength(1);
	expect(await rows(page, "a")).toEqual(before);
});

test("TMA-EXACT-YAW: exact 2D placement restores in 3D and in the compatible runtime", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact"));
	await createRoom(page, "Точный поворот");
	await openEditorCatalog(page);
	await page.getByRole("dialog", { name: "Предметы интерьера" }).getByRole("button", { name: /^Стул / }).click();
	await expect(page.getByTestId("tma-placement-color")).toHaveCount(0);
	await clickRectangularRoomPoint(page, { x: 0.42, y: 0.48 });
	const placement = page.getByTestId("item-placement-action-dock");
	const exactAngle = placement.locator('input[inputmode="decimal"]');
	await exactAngle.fill("37,5");
	await exactAngle.press("Enter");
	await expect(exactAngle).toHaveValue(/37[.,]5/);
	await page.getByRole("button", { name: "Повернуть размещаемый предмет влево на 1°", exact: true }).click();
	await expect(exactAngle).toHaveValue(/38[.,]5/, { timeout: 1500 });
	await page.getByRole("button", { name: "Повернуть размещаемый предмет вправо на 1°", exact: true }).click();
	await expect(exactAngle).toHaveValue(/37[.,]5/);
	const before = await rows(page, "a");
	await page.getByRole("button", { name: "3D", exact: true }).click();
	const scenePlacement = page.getByTestId("three-dimensional-item-placement-preview");
	await expect(scenePlacement).toHaveAttribute("data-placement-valid", "true");
	await expect(page.getByRole("textbox", { name: "Поворот предмета в 3D, градусы" })).toHaveValue(/37[.,]5/);
	const track = page.getByTestId("three-dimensional-rotation-track");
	await expect(track).toHaveAttribute("d", /A73 73.*A73 73/);
	const ring = await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();
	if (!ring) throw new Error("Expected the 3D rotation ring");
	const confirm = page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true });
	const center = { x: ring.x + ring.width / 2, y: ring.y + ring.height / 2 };
	const radius = ring.width * 73 / 200;
	await confirm.focus();
	await page.mouse.move(center.x, center.y - radius);
	await page.mouse.down();
	await page.mouse.move(center.x + radius * 0.35, center.y - radius * 0.94, { steps: 4 });
	await expect(confirm).toBeDisabled();
	await page.keyboard.press("Enter");
	expect(await rows(page, "a")).toEqual(before);
	await page.mouse.up();
	const sceneAngle = page.getByRole("textbox", { name: "Поворот предмета в 3D, градусы" });
	await expect(sceneAngle).not.toHaveValue(/^(?:0|37[.,]5|45|90|135|180|225|270|315)$/);
	await sceneAngle.fill("37,5");
	await sceneAngle.press("Enter");
	await expect(page.getByTestId("tma-placement-color")).toBeVisible();
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("Expected mobile viewport");
	await page.setViewportSize({ width: 740, height: 360 });
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	await expect.poll(async () => {
		const [gizmo, header, sheet] = await Promise.all([
			track.boundingBox(),
			page.getByTestId("editor-top-bar").boundingBox(),
			page.getByTestId("three-dimensional-item-placement-menu").boundingBox(),
		]);
		return Boolean(gizmo && header && sheet && gizmo.y >= header.y + header.height - 2 && gizmo.y + gizmo.height <= sheet.y + 2);
	}).toBe(true);
	await confirm.scrollIntoViewIfNeeded();
	await expect(confirm).toBeEnabled();
	await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
	await page.setViewportSize(viewport);
	expect(await rows(page, "a")).toEqual(before);
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await saved(page);
	const durable = (await currentProject(page)).assetInstances[0];
	expect(durable).toHaveProperty("yawMilliDeg", 37500);
	expect(durable).not.toHaveProperty("yawStep");
	await page.reload();
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "compatible"));
	await open(page, "Точный поворот");
	expect((await currentProject(page)).assetInstances[0]).toEqual(durable);
	await page.getByTestId("schematic-item").click();
	const properties = page.getByTestId("selected-item-inspector");
	await properties.getByRole("button", { name: "Развернуть панель предмета", exact: true }).click();
	await properties.getByRole("tab", { name: "До стен", exact: true }).click();
	const left = properties.getByRole("textbox", { name: "Слева, мм", exact: true });
	const next = Number(await left.inputValue()) + 20;
	await left.fill(String(next));
	await left.press("Enter");
	await saved(page);
	expect((await currentProject(page)).assetInstances[0]).toMatchObject({ yawMilliDeg: 37500 });
	await expect(left).toHaveValue(String(next));
});

async function expectBalancedRotationRow(left: Locator, angle: Locator, right: Locator, snap: Locator) {
	await expect(angle).toBeInViewport({ ratio: 1 });
	const [first, field, input, last, toggle] = await Promise.all([left.boundingBox(), angle.locator("..").boundingBox(), angle.boundingBox(), right.boundingBox(), snap.boundingBox()]);
	if (!first || !field || !input || !last || !toggle) throw new Error("Missing rotation row controls");
	const leftGap = field.x - first.x - first.width;
	const rightGap = last.x - field.x - field.width;
	const toggleGap = toggle.x - last.x - last.width;
	for (const control of [first, field, last, toggle]) {
		expect.soft(control.width).toBeGreaterThanOrEqual(44);
		expect.soft(control.height).toBeGreaterThanOrEqual(44);
	}
	expect.soft(last.width).toBeCloseTo(first.width, 1);
	expect.soft(toggle.width).toBeCloseTo(first.width, 1);
	expect.soft(last.height).toBeCloseTo(first.height, 1);
	expect.soft(field.height).toBeCloseTo(first.height, 1);
	expect.soft(toggle.height).toBeCloseTo(first.height, 1);
	expect.soft(field.y).toBeCloseTo(first.y, 1);
	expect.soft(last.y).toBeCloseTo(first.y, 1);
	expect.soft(toggle.y).toBeCloseTo(first.y, 1);
	expect.soft(leftGap).toBeGreaterThanOrEqual(4);
	expect.soft(rightGap).toBeCloseTo(leftGap, 1);
	expect.soft(toggleGap).toBeCloseTo(leftGap, 1);
	expect.soft(input.x + input.width / 2).toBeCloseTo(field.x + field.width / 2, 1);
	expect.soft(await angle.evaluate((input) => getComputedStyle(input).textAlign)).toBe("center");
}

async function expectRotationRowWhileEditing(page: Page, left: Locator, angle: Locator, right: Locator, snap: Locator) {
	const cancel = page.getByRole("button", { name: "Отменить ввод угла", exact: true });
	const apply = page.getByRole("button", { name: "Применить угол", exact: true });
	const before = await angle.inputValue();
	const stepMode = await snap.getAttribute("aria-pressed");
	await expect(angle).toBeInViewport({ ratio: 1 });
	const idle = await angle.boundingBox();
	for (const arrow of [left, right]) {
		expect.soft(await arrow.evaluate((button) => Number.parseFloat(getComputedStyle(button).fontSize))).toBeLessThanOrEqual(22);
	}
	await angle.fill("359,999");
	await expect.soft(left).toBeHidden({ timeout: 800 });
	await expect.soft(right).toBeHidden({ timeout: 800 });
	await expectBalancedRotationRow(cancel, angle, apply, snap);
	for (const action of [cancel, apply]) {
		const icon = action.locator("svg");
		await expect.soft(icon).toBeVisible({ timeout: 800 });
		if (await icon.isVisible()) {
			const size = await icon.boundingBox();
			expect.soft(size?.width).toBeLessThanOrEqual(22);
			expect.soft(size?.height).toBeLessThanOrEqual(22);
		}
	}
	const editing = await angle.boundingBox();
	expect.soft(editing?.x).toBe(idle?.x);
	expect.soft(editing?.width).toBe(idle?.width);
	await cancel.click();
	await expect(angle).toHaveValue(before);
	await expect(snap).toHaveAttribute("aria-pressed", stepMode ?? "false");
	await expect(left).toBeVisible();
	await expect(right).toBeVisible();
}

async function expectEditorMenuKeepsItsHeaderRow(page: Page) {
	const header = page.getByTestId("editor-top-bar");
	await expect.poll(async () => {
		const [back, menu, views] = await Promise.all([
			header.getByRole("button", { name: "Назад", exact: true }).boundingBox(),
			header.getByRole("button", { name: "Открыть остальные действия", exact: true }).boundingBox(),
			header.getByTestId("editor-view-switch").boundingBox(),
		]);
		if (!back || !menu || !views) return false;
		const backCentre = back.y + back.height / 2;
		const menuCentre = menu.y + menu.height / 2;
		return Math.abs(backCentre - menuCentre) <= 2 && menu.y + menu.height <= views.y;
	}).toBe(true);
}

test("TMA-ROTATION-SPACING: four rotation controls stay on one row in Plan and 3D", async ({ page }) => {
	test.setTimeout(60_000);
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact"));
	await createRoom(page, "Геометрия поворота");
	await openEditorCatalog(page);
	await page.getByRole("dialog", { name: "Предметы интерьера" }).getByRole("button", { name: /^Стул / }).click();
	await clickRectangularRoomPoint(page, { x: 0.42, y: 0.48 });
	const planLeft = page.getByRole("button", { name: "Повернуть размещаемый предмет влево на 1°", exact: true });
	const planAngle = page.getByRole("textbox", { name: "Угол размещаемого предмета, градусы", exact: true });
	const planRight = page.getByRole("button", { name: "Повернуть размещаемый предмет вправо на 1°", exact: true });
	const snap = page.getByRole("button", { name: "Шаг 45°", exact: true });
	const sceneLeft = page.getByRole("button", { name: "Повернуть предмет на 1° против часовой стрелки", exact: true });
	const sceneAngle = page.getByRole("textbox", { name: "Поворот предмета в 3D, градусы", exact: true });
	const sceneRight = page.getByRole("button", { name: "Повернуть предмет на 1° по часовой стрелке", exact: true });
	const layouts = [
		{ width: 390, height: 844, colorScheme: "light", fontSize: "" },
		{ width: 320, height: 780, colorScheme: "dark", fontSize: "200%" },
		{ width: 1024, height: 800, colorScheme: "light", fontSize: "" },
	] as const;
	async function setRotationLayout({ width, height, colorScheme, fontSize }: typeof layouts[number]) {
		await page.setViewportSize({ width, height });
		await page.emulateMedia({ colorScheme });
		await page.evaluate(({ colorScheme, fontSize }) => {
			const styles = document.documentElement.style;
			styles.fontSize = fontSize;
			styles.colorScheme = colorScheme;
			for (const [role, darkValue] of Object.entries({
				"--canvas": "#17212b",
				"--surface": "#1f2c36",
				"--ink": "#f5f7fa",
				"--line": "#3b4c59",
			})) {
				styles.setProperty(role, colorScheme === "dark" ? darkValue : "");
			}
		}, { colorScheme, fontSize });
	}
	for (const layout of layouts) {
		await setRotationLayout(layout);
		await expectBalancedRotationRow(planLeft, planAngle, planRight, snap);
		if (layout.width <= 390) await expectRotationRowWhileEditing(page, planLeft, planAngle, planRight, snap);
		await page.getByRole("button", { name: "3D", exact: true }).click();
		await expectBalancedRotationRow(sceneLeft, sceneAngle, sceneRight, snap);
		if (layout.width <= 390) await expectRotationRowWhileEditing(page, sceneLeft, sceneAngle, sceneRight, snap);
		await page.getByRole("button", { name: "План 2D", exact: true }).click();
	}
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await saved(page);
	await page.getByTestId("schematic-item").click();
	const selectedPlanLeft = page.getByRole("button", { name: "Повернуть выбранный предмет влево на 1°", exact: true });
	const selectedPlanAngle = page.getByRole("textbox", { name: "Угол поворота выбранного предмета, градусы", exact: true });
	const selectedPlanRight = page.getByRole("button", { name: "Повернуть выбранный предмет вправо на 1°", exact: true });
	for (const layout of layouts) {
		await setRotationLayout(layout);
		if (layout.width === 320) await expectEditorMenuKeepsItsHeaderRow(page);
		await expectBalancedRotationRow(selectedPlanLeft, selectedPlanAngle, selectedPlanRight, snap);
		if (layout.width <= 390) await expectRotationRowWhileEditing(page, selectedPlanLeft, selectedPlanAngle, selectedPlanRight, snap);
		await page.getByRole("button", { name: "3D", exact: true }).click();
		await expectBalancedRotationRow(sceneLeft, sceneAngle, sceneRight, snap);
		if (layout.width <= 390) await expectRotationRowWhileEditing(page, sceneLeft, sceneAngle, sceneRight, snap);
		await page.getByRole("button", { name: "План 2D", exact: true }).click();
	}
});

async function expectRotationStepButton(button: Locator, pressed: boolean) {
	await expect(button).toHaveAttribute("aria-pressed", String(pressed));
	const icon = button.locator("svg");
	await expect(icon).toBeVisible();
	const iconBounds = await icon.boundingBox();
	expect(iconBounds?.width).toBe(30);
	expect(iconBounds?.height).toBe(30);
	await expect(icon.locator("path").first()).toBeVisible();
	await expect(icon.locator("text")).toHaveText("45°");
	await expect(button).toHaveText("45°");
	expect(await icon.evaluate((element) => {
		const orbit = element.querySelector("path")?.getBBox();
		const label = element.querySelector("text")?.getBBox();
		return Boolean(orbit && label && label.width > 0 && label.height > 0 &&
			label.x >= orbit.x && label.y >= orbit.y &&
			label.x + label.width <= orbit.x + orbit.width &&
			label.y + label.height <= orbit.y + orbit.height);
	})).toBe(true);
	const bounds = await button.boundingBox();
	expect(bounds?.height).toBeGreaterThanOrEqual(44);
	expect(bounds?.width).toBeGreaterThanOrEqual(44);
}

test("TMA-ROTATION-EXPLICIT: angle drafts and snap mode work across plan, 3D and the keyboard", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact"));
	await createRoom(page, "Режим вращения");
	await openEditorCatalog(page);
	await page.getByRole("dialog", { name: "Предметы интерьера" }).getByRole("button", { name: /^Стул / }).click();
	await clickRectangularRoomPoint(page, { x: 0.45, y: 0.5 });
	const placement = page.getByTestId("item-placement-action-dock");
	const angle = placement.getByRole("textbox", { name: "Угол размещаемого предмета, градусы" });
	const apply = page.getByRole("button", { name: "Применить угол", exact: true });
	const cancel = page.getByRole("button", { name: "Отменить ввод угла", exact: true });
	const snap = page.getByRole("button", { name: "Шаг 45°", exact: true });
	const before = await rows(page, "a");
	await angle.fill("37,5");
	await placement.getByRole("heading").click();
	await expect(angle).toHaveValue("37,5");
	await expect(apply).toBeVisible();
	await snap.press("Space");
	await expect(snap).toHaveAttribute("aria-pressed", "true");
	await expect(angle).toHaveValue("37,5");
	expect(await rows(page, "a")).toEqual(before);
	await cancel.click();
	await expect(angle).toHaveValue("0");
	await expect(snap).toHaveAttribute("aria-pressed", "true");
	await snap.press("Space");
	await angle.fill("37,5");
	await apply.click();
	await expect(angle).toHaveValue("37.5");
	await expectRotationStepButton(snap, false);
	await snap.press("Space");
	await expectRotationStepButton(snap, true);
	await expect(angle).toHaveValue("37.5");
	await placement.getByRole("button", { name: "Повернуть размещаемый предмет влево на 45°", exact: true }).click();
	await expect(angle).toHaveValue("45");
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expectRotationStepButton(snap, true);
	const sceneAngle = page.getByRole("textbox", { name: "Поворот предмета в 3D, градусы" });
	await expect(sceneAngle).toHaveValue("45");
	await sceneAngle.fill("270");
	await page.evaluate(() => {
		const style = document.documentElement.style;
		style.setProperty("--editor-viewport-height", "420px");
		style.setProperty("--editor-keyboard-inset", "240px");
	});
	for (const control of [sceneAngle, apply, cancel]) {
		await expect(control).toBeInViewport();
		const box = await control.boundingBox();
		expect(box && box.y + box.height).toBeLessThanOrEqual(420);
	}
	await apply.click();
	await expect(sceneAngle).toHaveValue("270");
	expect(await rows(page, "a")).toEqual(before);
	await page.evaluate(() => {
		const style = document.documentElement.style;
		style.removeProperty("--editor-viewport-height");
		style.removeProperty("--editor-keyboard-inset");
	});
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await saved(page);
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page.getByTestId("schematic-item").click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	const placed = await rows(page, "a");
	await sceneAngle.fill("брак");
	await apply.click();
	await expect(page.getByRole("alert")).toContainText("Укажите угол");
	await sceneAngle.fill("271,125");
	await page.evaluate(() => {
		const style = document.documentElement.style;
		style.setProperty("--editor-viewport-height", "390px");
		style.setProperty("--editor-keyboard-inset", "270px");
	});
	for (const control of [sceneAngle, apply, cancel]) {
		await expect(control).toBeInViewport();
		const box = await control.boundingBox();
		expect(box && box.y + box.height).toBeLessThanOrEqual(390);
	}
	await cancel.click();
	await expect(sceneAngle).toHaveValue("270");
	expect(await rows(page, "a")).toEqual(placed);
});

async function selectExactChair(page: Page, name: string) {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact"));
	await createRoom(page, name);
	await openEditorCatalog(page);
	await page.getByRole("dialog", { name: "Предметы интерьера" }).getByRole("button", { name: /^Стул / }).click();
	await clickRectangularRoomPoint(page, { x: 0.44, y: 0.48 });
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await saved(page);
	await page.getByTestId("schematic-item").click();
}

async function setRotationVisibleHeight(page: Page, height?: number) {
	await page.evaluate((visible) => {
		const styles = document.documentElement.style;
		if (visible === undefined) {
			styles.removeProperty("--editor-viewport-height");
			styles.removeProperty("--editor-keyboard-inset");
			return;
		}
		styles.setProperty("--editor-viewport-height", `${visible}px`);
		styles.setProperty("--editor-keyboard-inset", `${innerHeight - visible}px`);
	}, height);
}

test("TMA-SELECTED-ROTATION: a selected Plan item offers exact angle and shared step mode outside Properties", async ({ page }) => {
	await selectExactChair(page, "Поворот выбранного предмета");
	const panel = page.getByTestId("two-dimensional-rotation-editor");
	const ring = page.getByTestId("two-dimensional-rotation-track");
	const angleLabel = "Угол поворота выбранного предмета, градусы";
	const angle = panel.getByRole("textbox", { name: angleLabel, exact: true });
	const snap = panel.getByRole("button", { name: "Шаг 45°", exact: true });
	await expect(ring).toBeVisible();
	await expect(angle).toBeVisible();
	await expect(angle).toHaveValue("0");
	await expectRotationStepButton(snap, false);
	await expect.poll(async () => {
		const [controls, track, header, footer] = await Promise.all([
			panel.boundingBox(), ring.boundingBox(), page.getByTestId("editor-top-bar").boundingBox(),
			page.getByRole("navigation", { name: "Инструменты редактора" }).boundingBox(),
		]);
		if (!controls || !track || !header || !footer) return false;
		const horizontalOffset = Math.abs(controls.x + controls.width / 2 - track.x - track.width / 2);
		return horizontalOffset <= 44 && controls.y >= header.y + header.height &&
			controls.y + controls.height <= footer.y;
	}).toBe(true);

	const inspector = page.getByTestId("selected-item-inspector");
	if (await inspector.isVisible()) {
		await page.getByRole("button", { name: "Развернуть панель предмета", exact: true }).click();
	} else {
		const properties = page.getByRole("button", { name: "Параметры выбранного предмета", exact: true });
		if (!await properties.isVisible()) {
			await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
		}
		await properties.click();
	}
	await inspector.getByRole("tab", { name: "До стен", exact: true }).click();
	await expect(inspector.getByRole("textbox", { name: "Слева, мм", exact: true })).toBeVisible();
	await expect(inspector.getByRole("textbox", { name: angleLabel, exact: true })).toHaveCount(0);
	await expect(inspector.getByRole("button", { name: "Шаг 45°", exact: true })).toHaveCount(0);
	await inspector.getByRole("button", { name: "Скрыть панель предмета", exact: true }).click();

	const before = await rows(page, "a");
	await snap.press("Space");
	await expect(snap).toHaveAttribute("aria-pressed", "true");
	await angle.fill("37,125");
	await angle.press("Tab");
	await expect(angle).toHaveValue("37,125");
	expect(await rows(page, "a")).toEqual(before);
	const header = await page.getByTestId("editor-top-bar").boundingBox();
	if (!header) throw new Error("No Plan header");
	const outside = { x: 22, y: header.y + header.height + 52 };
	expect(await page.getByTestId("plan-canvas").evaluate((canvas, point) => {
		const target = document.elementFromPoint(point.x, point.y);
		return !!target && canvas.contains(target) && !target.closest("[data-item-id],[data-wall-id]");
	}, outside)).toBe(true);
	await page.mouse.click(outside.x, outside.y);
	await expect(angle).toHaveValue("37,125");
	expect(await rows(page, "a")).toEqual(before);

	await angle.focus();
	await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
	const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(angle).toBeFocused();
	await expect(angle).toHaveValue("37,125");
	await angle.press("Escape");
	await expect(angle).toHaveValue("0");
	expect(await rows(page, "a")).toEqual(before);

	await angle.fill("37,125");
	const apply = panel.getByRole("button", { name: "Применить угол", exact: true });
	const cancel = panel.getByRole("button", { name: "Отменить ввод угла", exact: true });
	await setRotationVisibleHeight(page, 390);
	for (const control of [angle, apply, cancel]) {
		await expect.poll(async () => {
			const bounds = await control.boundingBox();
			return Boolean(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 390);
		}).toBe(true);
		await control.click({ trial: true });
	}
	await cancel.click();
	await setRotationVisibleHeight(page);
	await expect(angle).toHaveValue("0");
	expect(await rows(page, "a")).toEqual(before);
	await angle.fill("37,125");
	await apply.click();
	await expect.poll(async () => (await currentProject(page)).assetInstances[0]).toHaveProperty("yawMilliDeg", 37125);
	await saved(page);
	expect((await rows(page, "a")).revisions).toHaveLength(before.revisions.length + 1);

	await snap.press("Space");
	await expect(snap).toHaveAttribute("aria-pressed", "false");
	await panel.getByRole("button", { name: "Повернуть выбранный предмет влево на 1°", exact: true }).click();
	await expect.poll(async () => (await currentProject(page)).assetInstances[0]).toHaveProperty("yawMilliDeg", 38125);
	await saved(page);
	await expect(angle).toHaveValue("38.125");
	await page.getByRole("group", { name: "История изменений" }).getByRole("button", { name: /^Отменить действие/ }).click();
	await expect.poll(async () => (await currentProject(page)).assetInstances[0]).toHaveProperty("yawMilliDeg", 37125);
	await saved(page);
	await page.getByTestId("schematic-item").click();
	await expect(angle).toHaveValue("37.125");
	await snap.press("Space");
	await expect(snap).toHaveAttribute("aria-pressed", "true");

	await page.getByRole("button", { name: "3D", exact: true }).click();
	const scene = page.getByTestId("three-dimensional-rotation-editor");
	await expect(scene.getByRole("textbox", { name: "Поворот предмета в 3D, градусы", exact: true })).toHaveValue("37.125");
	await expectRotationStepButton(scene.getByRole("button", { name: "Шаг 45°", exact: true }), true);
});

test("TMA-SELECTED-ROTATION-DOCK: 3D rotation stays clear of the footer through interaction and keyboard resize", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await selectExactChair(page, "Панель выбранного предмета в 3D");
	await page.getByRole("button", { name: "3D", exact: true }).click();
	const footer = page.getByTestId("three-dimensional-view-controls");
	const angle = page.getByRole("textbox", { name: "Поворот предмета в 3D, градусы", exact: true });
	const panel = page.getByRole("group", { name: "Поворот предмета", exact: true });
	const apply = panel.getByRole("button", { name: "Применить угол", exact: true });
	const cancel = panel.getByRole("button", { name: "Отменить ввод угла", exact: true });
	const camera = page.getByTestId("three-dimensional-camera");
	const footerAction = footer.getByRole("button", { name: "Предметы интерьера", exact: true });
	await expect(angle).toBeEnabled();
	const cameraBefore = await camera.textContent();
	const itemColor = (await currentProject(page)).assetInstances[0]?.color;
	if (!itemColor) throw new Error("Missing durable color for the selected chair");
	const expectMobileFooterAppearance = async (rows: 1 | 2) => {
		const actions = footer.getByRole("button");
		await expect(actions).toHaveCount(4);
		const matching = await footer.evaluate((element, { savedColor, rows }) => {
			const buttons = [...element.querySelectorAll("button")].filter((button) => button.getClientRects().length > 0);
			const bounds = buttons.map((button) => button.getBoundingClientRect());
			const icons = buttons.map((button) => button.querySelector(':scope > svg, :scope > span[aria-hidden="true"]'));
			const glyphs = icons.map((icon) => icon?.getBoundingClientRect());
			const swatch = icons[3];
			if (!swatch || bounds.length !== 4) return false;
			const columns = 4 / rows;
			const aligned = bounds.every((box, index) => {
				const row = Math.floor(index / columns);
				const column = index % columns;
				const rowStart = bounds[row * columns];
				return Math.abs(box.y - rowStart.y) <= 1 &&
					Math.abs(box.x - bounds[column].x) <= 1 &&
					(column === 0 || box.x >= bounds[index - 1].right) &&
					(row === 0 || rowStart.y >= bounds[0].bottom);
			});
			const reference = document.createElement("span");
			reference.style.backgroundColor = savedColor;
			return aligned && bounds.every((box) => box.width >= 44 && box.height >= 44 &&
				Math.abs(box.width - bounds[0].width) <= 1 && Math.abs(box.height - bounds[0].height) <= 1) &&
				glyphs.every((glyph) => glyph && glyph.width >= 20 && glyph.height >= 20 &&
					glyph.width <= 26 && glyph.height <= 26) &&
				getComputedStyle(swatch).backgroundColor === reference.style.backgroundColor;
		}, { savedColor: itemColor, rows });
		expect(matching).toBe(true);
	};
	let visibleHeight = 844;
	const expectClearFooter = async () => {
		await expect.poll(async () => {
			const [rotation, controls] = await Promise.all([
				page.getByTestId("three-dimensional-rotation-editor").boundingBox(), footer.boundingBox(),
			]);
			return Boolean(rotation && controls && rotation.y >= 0 &&
				controls.y - rotation.y - rotation.height >= 7.95 &&
				controls.y + controls.height <= visibleHeight + 1);
		}).toBe(true);
		await footerAction.click({ trial: true });
	};
	await expectClearFooter();
	await expectMobileFooterAppearance(1);

	await angle.focus();
	await expectClearFooter();
	const step = panel.getByRole("button", { name: "Повернуть предмет на 1° против часовой стрелки", exact: true });
	await step.click();
	await expect(angle).toHaveValue("1");
	await saved(page);
	await expectClearFooter();
	const before = await rows(page, "a");
	const ring = await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();
	if (!ring) throw new Error("The selected 3D item has no rotation ring");
	const centre = { x: ring.x + ring.width / 2, y: ring.y + ring.height / 2 };
	const radius = ring.width * 73 / 200;
	await page.mouse.move(centre.x, centre.y - radius);
	await page.mouse.down();
	await page.mouse.move(centre.x + radius * 0.4, centre.y - radius * 0.92, { steps: 4 });
	await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(/^поворот:/);
	await expectClearFooter();
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(angle).toHaveValue("1");
	expect(await rows(page, "a")).toEqual(before);

	await angle.fill("37,5");
	visibleHeight = 390;
	await setRotationVisibleHeight(page, visibleHeight);
	await expectClearFooter();
	await apply.click({ trial: true });
	await cancel.click({ trial: true });
	await cancel.click();
	await expect(angle).toHaveValue("1");
	expect(await rows(page, "a")).toEqual(before);
	await expectClearFooter();

	await angle.fill("37,5");
	await apply.click();
	await expect.poll(async () => (await currentProject(page)).assetInstances[0]).toHaveProperty("yawMilliDeg", 37500);
	await saved(page);
	await expectClearFooter();
	await setRotationVisibleHeight(page);
	visibleHeight = 844;
	await expectClearFooter();
	await expect(page.getByTestId("three-dimensional-rotation-editor")).toBeVisible();
	await expect(camera).toHaveText(cameraBefore ?? "");
	await expect(page.getByTestId("three-dimensional-item-selection-frame")).toBeVisible();
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	await expectMobileFooterAppearance(2);
	await page.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });

	await page.setViewportSize({ width: 1024, height: 800 });
	await expect.poll(async () => {
		const [rotation, controls] = await Promise.all([panel.boundingBox(), footer.boundingBox()]);
		if (!rotation || !controls) return false;
		return rotation.y + rotation.height < controls.y || controls.y + controls.height < rotation.y;
	}).toBe(true);
	await footerAction.click({ trial: true });
	await angle.click({ trial: true });
});

test("TMA-EXACT-TRANSFER: Undo, Redo and a compatible runtime preserve exact yaw and pinned GLB bytes", async ({ page }) => {
	test.setTimeout(60_000);
	const preserved = await browser(page);
	const fixture = await page.evaluate(async () => {
		const model = await window.__telegramRuntimeUi.prepareUpperCustom("a");
		await window.__telegramRuntimeUi.mountNavigable("a", true, "exact");
		return model;
	});
	await open(page, "Uppercase local model");
	const original = await currentProject(page);
	await page.getByTestId("schematic-item").click();
	const angle = page.getByTestId("two-dimensional-rotation-editor").getByRole("textbox", { name: "Угол поворота выбранного предмета, градусы", exact: true });
	await angle.fill("37,5");
	await angle.press("Enter");
	await saved(page);
	const rotated = await currentProject(page);
	expect(rotated.assetInstances[0]).toHaveProperty("yawMilliDeg", 37500);
	expect(rotated.assetDefinitionRefs).toEqual(original.assetDefinitionRefs);
	const history = page.getByRole("group", { name: "История изменений" });
	await history.getByRole("button", { name: /^Отменить действие/ }).click();
	await expect.poll(async () => (await currentProject(page)).assetInstances).toEqual(original.assetInstances);
	await saved(page);
	await history.getByRole("button", { name: /^Повторить действие/ }).click();
	await expect.poll(async () => (await currentProject(page)).assetInstances).toEqual(rotated.assetInstances);
	await saved(page);

	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "compatible"));
	await open(page, "Uppercase local model");
	const source = await currentProject(page);
	const sourceRows = await rows(page, "a");
	expect(source.assetInstances).toEqual(rotated.assetInstances);
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	await page.getByRole("button", { name: "Экспортировать проект", exact: true }).click();
	await page.getByRole("button", { name: "Передать файл", exact: true }).click();
	await expect(page.getByText(/Проверьте файл вне приложения/)).toBeVisible();
	const file = await page.evaluate(() => window.__telegramRuntimeUi.sharedFile(0));
	expect(file.name).toMatch(/\.interiors$/);
	expect(file.mimeType).toBe("application/zip");
	const entries = unzipSync(Uint8Array.from(file.bytes));
	const manifest = new TextDecoder().decode(entries["manifest.json"]);
	expect(JSON.parse(manifest)).toMatchObject({ projectSchemaId: "interiors.project/runtime-v1-floor-yaw", projectSchemaVersion: 1 });
	expect(entries[`custom/${fixture.actualDigest}.glb`]).toEqual(Uint8Array.from(fixture.sourceBytes));

	// This separate scope has no cached model. Upgrade storage before selecting the exact file in the compatible runtime.
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("b", true, "exact"));
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("b", true, "compatible"));
	await expect(page.getByLabel("Импортировать проект", { exact: true })).toBeAttached();
	expect((await rows(page, "b")).projects).toHaveLength(0);
	await page.evaluate(() => window.__telegramRuntimeUi.reselectSharedFile(0));
	await saved(page);
	const imported = await currentProject(page);
	expect(imported.projectId).not.toBe(source.projectId);
	expect(imported.assetInstances).toEqual(source.assetInstances);
	expect(imported.assetDefinitionRefs).toEqual(source.assetDefinitionRefs);
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1");
	expect(await rows(page, "a")).toEqual(sourceRows);
	expect(await browser(page)).toEqual(preserved);
});

test("TMA-DOOR-HINGE-TRANSFER: rollback keeps the saved hinge and v3 refuses its archive until a v4 upgrade", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "compatible"));
	await createRoom(page, "Петли и копия");
	const oldRows = await rows(page, "a");
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "authoring"));
	await open(page, "Петли и копия");
	expect(await rows(page, "a")).toEqual(oldRows);
	await page.getByTestId("wall-segment").first().click();
	const opening = await openOpeningDetailsOnSelectedWall(page);
	await opening.getByRole("group", { name: "Петли" }).getByRole("button", { name: "Справа", exact: true }).click();
	await opening.getByRole("button", { name: "Подтвердить", exact: true }).click();
	await expect(opening).toHaveCount(0);
	const placed = (await currentProject(page)).level.openings;
	expect(placed).toEqual([expect.objectContaining({ hingeEnd: "end" })]);
	const currentRows = await rows(page, "a");

	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "compatible"));
	await open(page, "Петли и копия");
	expect((await currentProject(page)).level.openings).toEqual(placed);
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	await page.getByRole("button", { name: "Экспортировать проект", exact: true }).click();
	await page.getByRole("button", { name: "Передать файл", exact: true }).click();
	await expect(page.getByText(/Проверьте файл вне приложения/)).toBeVisible();
	const file = await page.evaluate(() => window.__telegramRuntimeUi.sharedFile(0));
	const entries = unzipSync(Uint8Array.from(file.bytes));
	const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
	expect(manifest).toMatchObject({ projectSchemaId: "interiors.project/runtime-v1-door-hinge", projectSchemaVersion: 1 });

	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("b", true, "exact", "compatible"));
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
	const targetBefore = await rows(page, "b");
	await page.evaluate(() => window.__telegramRuntimeUi.reselectSharedFile(0));
	await expect(page.getByText(/backup создан более новой версией/)).toBeVisible();
	expect(await rows(page, "b")).toEqual(targetBefore);

	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("b", true, "exact", "authoring"));
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
	await page.evaluate(() => window.__telegramRuntimeUi.reselectSharedFile(0));
	await saved(page);
	expect((await currentProject(page)).level.openings).toEqual(placed);
	expect(await rows(page, "a")).toEqual(currentRows);
});

test("TMA-UI-GUIDES-01: placement distances use the rotated footprint and remain a draft", async ({ page }) => {
	await page.evaluate(async () => {
		await window.__telegramRuntimeUi.prepareUpperCustom("a");
		window.__telegramRuntimeUi.mountPreparedNavigable("a");
	});
	await open(page, "Uppercase local model");
	const before = await rows(page, "a");
	await openEditorCatalog(page);
	await page.getByRole("button", { name: /Local upper triangle.*Кастомное/ }).click();
	await page.getByRole("button", { name: "Разместить на плане", exact: true }).click();
	await clickRectangularRoomPoint(page, { x: 0.32, y: 0.52 });
		const sideField = (side: string) => page.getByRole("textbox", { name: `${side}, мм`, exact: true });
	const left = sideField("Слева");
	const right = sideField("Справа");
	const top = sideField("Сверху");
	const bottom = sideField("Снизу");
	await expect(page.getByTestId("item-wall-distances")).toHaveCount(4);
	for (const [field, value] of [[left, "900"], [right, "2400"], [top, "1250"], [bottom, "1150"]] as const) {
		await expect(field).toHaveValue(value);
	}
	await left.fill("1001");
	await left.press("Enter");
	await expect(left).toHaveValue("1001");
	await expect(right).toHaveValue("2299");
	await expect(top).toHaveValue("1250");
	await left.fill("900");
	await left.press("Enter");
	await page.getByRole("button", { name: "Повернуть размещаемый предмет вправо на 45°", exact: true }).click();
	for (const [field, value] of [[left, "826"], [right, "2326"], [top, "1126"], [bottom, "1026"]] as const) {
		await expect(field).toHaveValue(value);
	}
	await page.getByRole("button", { name: "Отменить размещение предмета", exact: true }).click();
	await expect(left).toHaveCount(0);
	await expect(page.getByTestId("item-wall-distances")).toHaveCount(0);
	expect(await rows(page, "a")).toEqual(before);
});

for (const firstContact of ["ring", "floor"] as const) {
	test(`TMA-UI-PLAN-PAN: a second finger takes over a placement ${firstContact} drag`, async ({ page }) => {
		await page.evaluate(async () => {
			await window.__telegramRuntimeUi.prepareUpperCustom("a");
			window.__telegramRuntimeUi.mountPreparedNavigable("a");
		});
		await open(page, "Uppercase local model");
		const before = await rows(page, "a");
		await openEditorCatalog(page);
		await page.getByRole("button", { name: /Local upper triangle.*Кастомное/ }).click();
		await page.getByRole("button", { name: "Разместить на плане", exact: true }).click();
		await clickRectangularRoomPoint(page, { x: 0.42, y: 0.48 });
		const preview = page.getByTestId("item-placement-preview").locator("polygon").first();
		const originalPose = await preview.getAttribute("points");
		const plan = page.getByTestId("plan-content");
		const originalCamera = await plan.getAttribute("transform");
		const ring = page.getByRole("slider", { name: "Повернуть размещаемый предмет" });
		const ringBox = await ring.boundingBox();
		const dockBox = await page.getByTestId("item-placement-action-dock").boundingBox();
		if (!ringBox || !dockBox) throw new Error("Missing placement controls");
		const x = ringBox.x + ringBox.width / 2;
		const y = ringBox.y + ringBox.height / 2;
		const first = firstContact === "ring"
			? { id: 61, x, y: ringBox.y }
			: { id: 61, x: x - 100, y: Math.min(y - 35, dockBox.y - 32) };
		const moved = firstContact === "ring"
			? { ...first, x: ringBox.x + ringBox.width, y }
			: { ...first, y: first.y - 24 };
		const second = { id: 62, x: x + 50, y: Math.min(y - 75, dockBox.y - 24) };
		const cdp = await page.context().newCDPSession(page);
		try {
			await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
			await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [moved] });
			await expect(preview).not.toHaveAttribute("points", originalPose ?? "");
			await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [moved, second] });
			const translated = [moved, second].map((point) => ({ ...point, x: point.x + 35, y: point.y - 24 }));
			await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: translated });
			await expect.soft(plan).not.toHaveAttribute("transform", originalCamera ?? "", { timeout: 1500 });
			const firstCameraMove = await plan.getAttribute("transform");
			const [translatedFirst, translatedSecond] = translated;
			const nextTranslation = [{ ...translatedFirst, x: translatedFirst.x + 22, y: translatedFirst.y - 12 }, translatedSecond];
			await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: nextTranslation });
			await expect.soft(plan).not.toHaveAttribute("transform", firstCameraMove ?? "", { timeout: 1500 });
			await expect.soft(preview).toHaveAttribute("points", originalPose ?? "", { timeout: 1500 });
			const remaining = nextTranslation[firstContact === "ring" ? 0 : 1];
			await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [remaining] });
			await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...remaining, x: remaining.x + 12 }] });
			await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
			await expect.soft(preview).toHaveAttribute("points", originalPose ?? "", { timeout: 1500 });
			await expect(page.getByTestId("item-placement-confirm")).toBeEnabled();
			expect(await rows(page, "a")).toEqual(before);
		} finally {
			await cdp.detach();
		}
	});
}

test("TMA-UI-PLAN-RING: selected floor item exposes its rotation track and handle before dragging", async ({ page }) => {
	await page.evaluate(async () => {
		await window.__telegramRuntimeUi.prepareUpperCustom("a");
		window.__telegramRuntimeUi.mountPreparedNavigable("a");
	});
	await open(page, "Uppercase local model");
	const item = page.getByTestId("schematic-item");
	await item.click();
	const ring = page.getByLabel("Кольцо поворота предмета");
	await expect(ring).toBeVisible();
	await expect(ring).not.toHaveCSS("opacity", "0", { timeout: 1500 });
	await expect(page.locator("[data-rotation-handle]")).not.toHaveCSS("opacity", "0");
	await expect(page.getByTestId("two-dimensional-rotation-hit-area")).toHaveCSS("stroke-width", "44px");
	const box = await ring.boundingBox();
	if (!box) throw new Error("Missing selected rotation ring");
	const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	const first = { id: 31, x: centre.x, y: box.y };
	const turned = { ...first, x: box.x + box.width, y: centre.y };
	const second = { id: 32, x: centre.x - 70, y: centre.y - 75 };
	const before = await rows(page, "a");
	const itemGroup = item.locator("..");
	const pose = await itemGroup.getAttribute("transform");
	const plan = page.getByTestId("plan-content");
	const camera = await plan.getAttribute("transform");
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
		await expect(itemGroup).toHaveAttribute("transform", pose ?? "");
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [turned] });
		await expect(itemGroup).not.toHaveAttribute("transform", pose ?? "");
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [turned, second] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [turned, second].map((point) => ({ ...point, x: point.x + 35, y: point.y - 24 })) });
		await expect(plan).not.toHaveAttribute("transform", camera ?? "");
		await expect(itemGroup).toHaveAttribute("transform", pose ?? "");
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		expect(await rows(page, "a")).toEqual(before);
	} finally {
		await cdp.detach();
	}
});

test("TMA-UI-05: actual export prepares a local File before a fresh handoff gesture and reselects it through the registered importer", async ({
	page,
}, info) => {
	const preserved = await browser(page);
	await start(page, "a");
	await createRoom(page, "UI local transfer");
	const source = await currentProject(page);
	const before = await rows(page, "a");
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Экспортировать проект", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Передать файл", exact: true }),
	).toBeVisible();
	expect(
		await page.evaluate(() => window.__telegramRuntimeUi.sharedFileCount()),
	).toBe(0);
	expect(await rows(page, "a")).toEqual(before);
	await page
		.getByRole("button", { name: "Передать файл", exact: true })
		.click();
	await expect(page.getByText(/Проверьте файл вне приложения/)).toBeVisible();
	expect(
		await page.evaluate(() => window.__telegramRuntimeUi.sharedFileCount()),
	).toBe(1);
	const file = await page.evaluate(() =>
		window.__telegramRuntimeUi.sharedFile(0),
	);
	expect(file.name).toMatch(/\.interiors$/);
	expect(file.mimeType).toBe("application/zip");
	expect(file.bytes.length).toBeGreaterThan(0);
	await info.attach("actual-local-export", {
		contentType: "application/json",
		body: JSON.stringify(file),
	});
	await page.getByRole("button", { name: "Закрыть", exact: true }).click();
	await expect(
		page.getByRole("complementary", { name: "Передача файла", exact: true }),
	).toHaveCount(0);
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page.getByRole("button", { name: "Проекты", exact: true }).click();
	await expect(
		page.getByLabel("Импортировать проект", { exact: true }),
	).toBeAttached();
	await page.evaluate(() => window.__telegramRuntimeUi.reselectSharedFile(0));
	await expect
		.poll(async () => {
			const state = await page.evaluate(() =>
				window.__telegramRuntimeUi.state(),
			);
			return "project" in state ? state.project?.projectId : undefined;
		})
		.not.toBe(source.projectId);
	await saved(page);
	const imported = await currentProject(page);
	expect(imported.projectId).not.toBe(source.projectId);
	expect(imported.level).toEqual(source.level);
	expect(await browser(page)).toEqual(preserved);
});


test("TMA-UI-06: a complete empty recovery draft uses the actual scoped registered writer and restores a new Project", async ({ page }) => {
	await start(page, "a");
	const preserved = await browser(page);
	const restored = await page.evaluate(() => window.__telegramRuntimeUi.restoreEmptyRecoveryDraft());
	expect(restored.result.kind).toBe("durable");
	expect(restored.sourceUnchanged).toBe(true);
	const state = restored.state;
	expect(state.kind).toBe("saved");
	if (state.kind !== "saved") throw new Error("Expected restored Project");
	expect(state.project.projectId).not.toBe(restored.sourceProject.projectId);
	expect(state.project.level).toEqual(restored.sourceProject.level);
	expect(state.project.assetDefinitionRefs).toEqual([]);
	expect((await rows(page, "a")).projects).toHaveLength(1);
	expect(await browser(page)).toEqual(preserved);
});


test("TMA-UI-07: ordinary Telegram file transfer never dispatches non-ZIP data to the old browser JSON importer", async ({ page }) => {
	await start(page, "a");
	const before = await rows(page, "a");
	await page.evaluate(() => window.__telegramRuntimeUi.reselectUnregisteredProjectJson());
	await expect(page.getByText("Не удалось проверить файл проекта. Существующие проекты не изменены.", { exact: true })).toBeVisible({ timeout: 4000 });
	expect(await rows(page, "a")).toEqual(before);
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
});


test("TMA-UI-08: host Back preserves raw rename input, caret and the native dialog until explicit discard", async ({ page }, info) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a"));
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
	await createRoom(page, "Raw Back Project");
	const before = await rows(page, "a");
	await page.getByRole("button", { name: "Переименовать проект Raw Back Project", exact: true }).click();
	const input = page.getByRole("textbox", { name: "Новое название проекта", exact: true });
	const raw = "  009 План  ";
	await input.fill(raw);
	await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(2, 5, "forward"));
	await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
	const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
	await expect(guard).toBeVisible({ timeout: 4000 });
	await info.attach("retained-raw-dialog", { body: await page.screenshot(), contentType: "image/png" });
	await expect(input).toHaveValue(raw);
	expect(await page.evaluate(() => window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
	const keep = guard.getByRole("button", { name: "Продолжить", exact: true });
	const discard = guard.getByRole("button", { name: "Отменить правку", exact: true });
	await expect(keep).toBeFocused();
	await page.keyboard.press("Tab"); await expect(discard).toBeFocused();
	await page.keyboard.press("Tab"); await expect(keep).toBeFocused();
	await page.keyboard.press("Shift+Tab"); await expect(discard).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(guard).toHaveCount(0);
	await expect(input).toBeFocused();
	expect(await input.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd, element.selectionDirection])).toEqual([2, 5, "forward"]);
	await expect(input).toHaveValue(raw);
	expect(await rows(page, "a")).toEqual(before);
	await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
	await expect(guard).toBeVisible();
	await guard.getByRole("button", { name: "Отменить правку", exact: true }).click();
	await expect(guard).toHaveCount(0);
	expect((await currentProject(page)).name).toBe("Raw Back Project");
	expect(await rows(page, "a")).toEqual(before);
});


test("TMA-UI-09: a modal close cannot blur-publish a valid raw angle and Back handles explicit discard", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.prepareUpperCustom("a"));
	await page.evaluate(() => window.__telegramRuntimeUi.mountPreparedNavigable("a"));
	await open(page, "Uppercase local model");
	await page.getByTestId("schematic-item").click();
	const inspector = page.getByTestId("selected-item-inspector");
	if (!(await inspector.isVisible())) {
		const action = page.getByRole("button", { name: "Параметры выбранного предмета", exact: true });
		if (!(await action.isVisible())) await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
		await action.click();
	} else if ((await inspector.getAttribute("data-inspector-expanded")) !== "true") {
		await page.getByRole("button", { name: "Развернуть панель предмета", exact: true }).click();
	}
	const input = page.getByRole("textbox", { name: "Угол поворота выбранного предмета, градусы", exact: true });
	await expect(input).toBeEnabled();
	await input.fill(" 45 ");
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Предпросмотр — не сохранено");
	const before = await rows(page, "a");
	const back = page.locator('[data-editor-host-back="back"][aria-label="Назад"]');
	expect(await back.evaluate((element) => !!element.closest("[inert]"))).toBe(true);
	await inspector.getByRole("button", { name: "Скрыть панель предмета", exact: true }).click();
	const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
	await expect(guard).toBeVisible({ timeout: 4000 });
	expect(await rows(page, "a")).toEqual(before);
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(input).toBeFocused();
	await expect(input).toHaveValue(" 45 ");
	expect(await rows(page, "a")).toEqual(before);
	await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
	await expect(guard).toBeVisible();
	await guard.getByRole("button", { name: "Отменить правку", exact: true }).click();
	await expect(input).toHaveValue("0");
	expect(await rows(page, "a")).toEqual(before);
});


async function navigableRoom(page: Page, name: string) {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a"));
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
	await createRoom(page, name);
}
test("TMA-UI-10: Back preserves room raw height and type, while explicit discard resets fields without a Revision", async ({ page }) => {
	await navigableRoom(page, "Room raw Back");
	await page.getByRole("button", { name: "Помещения", exact: true }).click();
	const directory = page.getByRole("dialog", { name: "Помещения", exact: true });
	const height = directory.getByRole("textbox", { name: "Высота помещения, мм", exact: true });
	const type = directory.getByRole("combobox", { name: "Тип помещения", exact: true });
	const originalHeight = await height.inputValue(), originalType = await type.inputValue();
	await height.fill(" 02x ");
	await type.selectOption("living-room");
	await height.focus();
	const before = await rows(page, "a");
	await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
	const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
	await expect(guard).toBeVisible({ timeout: 4000 });
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(height).toHaveValue(" 02x "); await expect(type).toHaveValue("living-room");
	await expect(height).toBeFocused(); expect(await rows(page, "a")).toEqual(before);
	await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
	await expect(guard).toBeVisible();
	await guard.getByRole("button", { name: "Отменить правку", exact: true }).click();
	await expect(height).toHaveValue(originalHeight); await expect(type).toHaveValue(originalType);
	expect(await rows(page, "a")).toEqual(before);
});
test("TMA-UI-11: one host Back closes the clean dimension dialog and retains the editor and its focus", async ({ page }) => {
	await navigableRoom(page, "Clean panel Back");
	const trigger = page.getByRole("button", { name: "Настроить размеры", exact: true });
	await trigger.click();
	const dialog = page.getByRole("dialog", { name: "Размеры", exact: true });
	await expect(dialog).toBeVisible();
	const before = await rows(page, "a");
	await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
	await expect(dialog).toHaveCount(0);
	await expect(page.getByTestId("editor-workspace")).toBeVisible({ timeout: 4000 });
	await expect(trigger).toBeFocused();
	expect(await rows(page, "a")).toEqual(before);
	expect(await page.evaluate(() => window.__telegramRuntimeUi.hostBackListenerCount())).toBe(1);
	await page.evaluate(() => window.__telegramRuntimeUi.dispose());
	expect(await page.evaluate(() => window.__telegramRuntimeUi.hostBackListenerCount())).toBe(0);
});


test("TMA-UI-12: host Back synchronously revokes the actual Plan drag before a queued pointerup and Resume never revives it", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.prepareUpperCustom("a"));
	await page.evaluate(() => window.__telegramRuntimeUi.mountPreparedNavigable("a"));
	await open(page, "Uppercase local model");
	const item = page.getByTestId("schematic-item");
	const box = await item.boundingBox();
	if (!box) throw new Error("No actual rendered item");
	let x = box.x + box.width / 2, y = box.y + box.height / 2;
	const baseline = await rows(page, "a");
	await page.mouse.move(x, y); await page.mouse.down();
	await page.mouse.move(x + 12, y, { steps: 3 }); await page.mouse.up();
	await expect.poll(async () => (await rows(page, "a")).revisions.length).toBe(baseline.revisions.length + 1);
	const movedBox = await item.boundingBox();
	if (!movedBox) throw new Error("No moved actual item");
	x = movedBox.x + movedBox.width / 2; y = movedBox.y + movedBox.height / 2;
	const before = await rows(page, "a");
	await page.mouse.move(x, y); await page.mouse.down();
	await page.mouse.move(x + 18, y + 8, { steps: 4 });
	await page.evaluate(({ x, y }) => {
		window.__telegramRuntimeUi.hostBack();
		const svg = document.querySelector('[data-testid="schematic-item"]')?.closest('svg');
		if (!svg) throw new Error("No actual Plan SVG");
		svg.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: y, buttons: 0 }));
	}, { x: x + 18, y: y + 8 });
	const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
	await expect(guard).toBeVisible({ timeout: 4000 });
	await expect.poll(() => page.evaluate(() => window.__telegramRuntimeUi.hasActivePublication())).toBe(false);
	expect(await rows(page, "a")).toEqual(before);
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await page.mouse.up();
	expect(await rows(page, "a")).toEqual(before);
});


test("TMA-UI-13: first-run name is retained by both Back controls until explicit discard", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a"));
 await page.getByRole("button", { name: "Новый проект", exact: true }).click();
 const input=page.getByRole("textbox", {name:"Название проекта",exact:true});
 await input.fill("  000 Мой план  ");
 await input.evaluate((el:HTMLInputElement)=>el.setSelectionRange(3,7,"forward"));
 const before=await rows(page,"a");
 await page.getByRole("button",{name:"Вернуться к проектам",exact:true}).click();
 const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});
 await expect(guard).toBeVisible({timeout:4000});
 await guard.getByRole("button",{name:"Продолжить",exact:true}).click();
 await expect(input).toHaveValue("  000 Мой план  "); await expect(input).toBeFocused();
 expect(await input.evaluate((el:HTMLInputElement)=>[el.selectionStart,el.selectionEnd])).toEqual([3,7]);
 expect(await rows(page,"a")).toEqual(before);
 await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 await guard.getByRole("button",{name:"Отменить правку",exact:true}).click();
 await expect(input).toHaveValue(""); expect(await rows(page,"a")).toEqual(before);
 await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 await expect(page.getByTestId("project-hub")).toBeVisible();
});

test("TMA-UI-14: starter contour raw dimensions survive Continue and discard resets without saving", async ({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.mountNavigable("a"));
 await page.getByRole("button",{name:"Новый проект",exact:true}).click();
 await page.getByRole("textbox",{name:"Название проекта",exact:true}).fill("Starter raw");
 await page.getByRole("button",{name:"Создать проект",exact:true}).click();
 const width=page.getByRole("textbox",{name:"Ширина, мм",exact:true});
 await expect(width).toBeVisible(); const initial=await width.inputValue();
 await width.fill(" 04x "); await width.focus(); const before=await rows(page,"a");
 await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});
 await expect(guard).toBeVisible({timeout:4000});
 await guard.getByRole("button",{name:"Продолжить",exact:true}).click();
 await expect(width).toHaveValue(" 04x "); await expect(width).toBeFocused();
 expect(await rows(page,"a")).toEqual(before);
 await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 await guard.getByRole("button",{name:"Отменить правку",exact:true}).click();
 await expect(width).toHaveValue(initial); expect(await rows(page,"a")).toEqual(before);
});


test("TMA-UI-15: catalog composer raw text survives its close button and explicit discard creates no data", async ({page})=>{
 await navigableRoom(page,"Composer raw");
 await openEditorCatalog(page);
 const catalog=page.getByRole("dialog",{name:"Предметы интерьера",exact:true});
 await catalog.locator("summary").click();
 await catalog.getByRole("button",{name:"Создать макетный предмет",exact:true}).click();
 const input=catalog.getByRole("textbox",{name:"Название макетного предмета",exact:true});
 const initial=await input.inputValue(); await input.fill("  001 Комод  "); await input.focus(); const before=await rows(page,"a");
 await catalog.getByRole("button",{name:"Закрыть предметы интерьера",exact:true}).click();
 const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});
 await expect(guard).toBeVisible({timeout:4000});
 await guard.getByRole("button",{name:"Продолжить",exact:true}).click();
 await expect(input).toHaveValue("  001 Комод  "); await expect(input).toBeFocused();
 await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 await guard.getByRole("button",{name:"Отменить правку",exact:true}).click();
 await expect(input).toHaveValue(initial); expect(await rows(page,"a")).toEqual(before);
});

test("TMA-UI-16: room panel own close follows the same raw-field guard as host Back",async({page})=>{
 await navigableRoom(page,"Own panel close"); await page.getByRole("button",{name:"Помещения",exact:true}).click();
 const directory=page.getByRole("dialog",{name:"Помещения",exact:true});
 const input=directory.getByRole("textbox",{name:"Высота помещения, мм",exact:true});
 await input.fill("009x"); await input.focus(); const before=await rows(page,"a");
 await directory.getByRole("button",{name:"Закрыть помещения",exact:true}).click();
 const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});
 await expect(guard).toBeVisible({timeout:4000}); await guard.getByRole("button",{name:"Продолжить",exact:true}).click();
 await expect(input).toBeFocused(); await expect(input).toHaveValue("009x"); expect(await rows(page,"a")).toEqual(before);
});


test("TMA-UI-17: Back before the Saving status preserves the dispatched rename and never offers discard",async({page})=>{
 await navigableRoom(page,"Before checksum"); const before=await rows(page,"a");
 await page.getByRole("button",{name:"Переименовать проект Before checksum",exact:true}).click();
 await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("Held real rename");
 await page.evaluate(()=>window.__telegramRuntimeUi.holdPublicationChecksum("Held real rename"));
 await page.getByRole("button",{name:"Сохранить",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.checksumIsHeld())).toBe(true);
 expect(await page.evaluate(()=>window.__telegramRuntimeUi.state().kind)).toBe("saved");
 await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 await expect(page.getByText("Дождитесь завершения текущего действия. Сохраняемая правка не отменена.",{exact:true})).toBeVisible({timeout:4000});
 await expect(page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true})).toHaveCount(0);
 expect(await rows(page,"a")).toEqual(before);
 await page.evaluate(()=>window.__telegramRuntimeUi.releasePublicationChecksum());
 await saved(page); await expect(page.getByRole("button",{name:"Переименовать проект Held real rename",exact:true})).toBeVisible();
 expect((await rows(page,"a")).revisions).toHaveLength(before.revisions.length+1);
 await expect(page.getByTestId("editor-workspace")).toBeVisible();
});

test("TMA-OPENING-SAVE-FOCUS: publishing a new opening retains keyboard focus inside its modal", async ({ page }) => {
	await navigableRoom(page, "Сохранение проёма");
	const before = await rows(page, "a");
	await page.getByTestId("wall-segment").first().click();
	const sheet = await openOpeningDetailsOnSelectedWall(page);
	const submit = sheet.getByRole("button", { name: "Подтвердить", exact: true });
	await submit.focus();
	await page.evaluate(() => window.__telegramRuntimeUi.holdScopeLock("a"));
	try {
		await page.keyboard.press("Enter");
		await expect(submit).toBeDisabled();
		await expect(sheet).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(sheet).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(page.getByText("Дождитесь завершения текущего действия. Сохраняемая правка не отменена.", { exact: true })).toBeVisible();
		await expect(sheet).toBeVisible();
		await expect(page.getByRole("alertdialog")).toHaveCount(0);
	} finally {
		await page.evaluate(() => window.__telegramRuntimeUi.releaseScopeLock());
	}
	await expect(sheet).toHaveCount(0);
	await saved(page);
	expect((await rows(page, "a")).revisions).toHaveLength(before.revisions.length + 1);
});

/** Uses the actual current Project, camera and layout; no synthetic scene/controller. */async function currentSceneFloorContact(page: Page, xMm: number, zMm: number) {
 await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
 await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
 const [project, cameraText, bounds] = await Promise.all([
  currentProject(page), page.getByTestId("three-dimensional-camera").textContent(), page.getByTestId("three-dimensional-canvas").boundingBox(),
 ]);
 const scene = projectRectangularRoomForWebGl(project);
 const values = cameraText?.split(":").map(Number);
 if (!scene || !bounds || !values || values.length !== 5 || !values.every(Number.isFinite)) throw new Error("No actual current 3D floor projection");
 const [azimuthRadians, elevationRadians, distance, panXM, panZM] = values;
 const originX = Math.min(...project.level.vertices.map((vertex) => vertex.xMm));
 const originZ = Math.min(...project.level.vertices.map((vertex) => vertex.zMm));
 const point = canvasPointForFloor(scene, { azimuthRadians, elevationRadians, distance, panXM, panZM }, bounds, { xM: (xMm - originX) / 1000, zM: (zMm - originZ) / 1000 });
 if (!point) throw new Error("No visible projected floor contact");
 return { x: bounds.x + point.x, y: bounds.y + point.y };
}
async function beginActualSceneMove(page: Page, from: { xMm: number; zMm: number }, to: { xMm: number; zMm: number }) {
 const start = await currentSceneFloorContact(page, from.xMm, from.zMm);
 const end = await currentSceneFloorContact(page, to.xMm, to.zMm);
 expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-testid"), start)).toBe("three-dimensional-canvas");
 await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 5 });
 await expect(page.getByTestId("three-dimensional-item-preview")).toContainText("перемещение:");
}

test("TMA-UI-SCENE-01: actual scoped 3D move is suspended by Root Back, retains world pose on Continue and publishes only a fresh contact", async ({ page }) => {
 const preserved = await browser(page);
 await page.evaluate(() => window.__telegramRuntimeUi.prepareUpperCustom("a"));
 await page.evaluate(() => window.__telegramRuntimeUi.mountPreparedNavigable("a"));
 await open(page, "Uppercase local model");
 await page.getByTestId("schematic-item").click();
 await page.getByTestId("editor-view-switch").getByRole("button", { name: "3D", exact: true }).click();
 await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1");
 const initial = await currentProject(page);
 const originalItem = initial.assetInstances.find((item) => item.anchorClass === "floor");
 if (originalItem?.anchorClass !== "floor") throw new Error("No actual selected floor item");
 const baseline = await rows(page, "a");
 // First prove that this native gesture really reaches a Durable scoped Revision.
 await beginActualSceneMove(page, originalItem, { xMm: originalItem.xMm + 180, zMm: originalItem.zMm });
 await page.mouse.up();
 await expect.poll(async () => (await rows(page, "a")).revisions.length).toBe(baseline.revisions.length + 1);
 const moved = await currentProject(page);
 const movedItem = moved.assetInstances.find((item) => item.assetInstanceId === originalItem.assetInstanceId);
 if (movedItem?.anchorClass !== "floor") throw new Error("No actual moved floor item");
 expect(movedItem.xMm).not.toBe(originalItem.xMm);
 const before = await rows(page, "a");
 await beginActualSceneMove(page, movedItem, { xMm: movedItem.xMm + 240, zMm: movedItem.zMm + 120 });
 const preview = page.getByTestId("three-dimensional-item-preview");
 const pose = await preview.textContent();
 if (!pose?.startsWith("перемещение:")) throw new Error("No actual raw move pose");
 await page.evaluate(() => window.__telegramRuntimeUi.hostBack());
 const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
 await expect(guard).toBeVisible({ timeout: 4000 });
 await expect(preview).toHaveText(pose);
 // A real captured pointerup must stay revoked while the root guard owns focus.
 await page.mouse.up();
 expect(await rows(page, "a")).toEqual(before);
 await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
 await expect(preview).toHaveText(pose);
 await expect(page.getByTestId("three-dimensional-rotation-gizmo")).toBeVisible();
 expect(await rows(page, "a")).toEqual(before);
 const [, x, z] = pose.split(":");
 if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(z))) throw new Error("Invalid retained world pose");
 const originX = Math.min(...moved.level.vertices.map((vertex) => vertex.xMm));
 const originZ = Math.min(...moved.level.vertices.map((vertex) => vertex.zMm));
 const retained = { xMm: Number(x) * 1000 + originX, zMm: Number(z) * 1000 + originZ };
 await beginActualSceneMove(page, retained, { xMm: retained.xMm + 160, zMm: retained.zMm });
 await page.mouse.up();
 await expect.poll(async () => (await rows(page, "a")).revisions.length).toBe(before.revisions.length + 1);
 expect((await currentProject(page)).assetDefinitionRefs).toEqual(moved.assetDefinitionRefs);
 expect(await browser(page)).toEqual(preserved);
});


test("TMA-UI-18: item inspector own collapse cannot blur-publish its valid raw angle",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a")); await page.evaluate(()=>window.__telegramRuntimeUi.mountPreparedNavigable("a")); await open(page,"Uppercase local model"); await page.getByTestId("schematic-item").click();
 const inspector=page.getByTestId("selected-item-inspector");
 if(!(await inspector.isVisible())){const action=page.getByRole("button",{name:"Параметры выбранного предмета",exact:true});if(!(await action.isVisible()))await page.getByRole("button",{name:"Открыть остальные действия",exact:true}).click();await action.click();}
 else if((await inspector.getAttribute("data-inspector-expanded"))!=="true")await page.getByRole("button",{name:"Развернуть панель предмета",exact:true}).click();
 const input=page.getByRole("textbox",{name:"Угол поворота выбранного предмета, градусы",exact:true});await input.fill(" 45 ");const before=await rows(page,"a");
 await page.getByRole("button",{name:"Скрыть панель предмета",exact:true}).click();
 const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});await expect(guard).toBeVisible({timeout:4000});expect(await rows(page,"a")).toEqual(before);
 await guard.getByRole("button",{name:"Продолжить",exact:true}).click();await expect(input).toBeFocused();await expect(input).toHaveValue(" 45 ");expect(await rows(page,"a")).toEqual(before);
});


test("TMA-UI-19: Back keeps a failed real candidate and recovery export until explicit retry creates one Revision",async({page})=>{
 await navigableRoom(page,"Quota before rename");const before=await rows(page,"a");
 await page.getByRole("button",{name:"Переименовать проект Quota before rename",exact:true}).click();
 await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("Retained quota rename");
 await page.evaluate(()=>window.__telegramRuntimeUi.failNextScopedProjectWrite());
 await page.getByRole("button",{name:"Сохранить",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.state().kind)).toBe("persist-failed");
 const failed=await rows(page,"a");
 expect(failed.projects).toEqual(before.projects);
 for (const prior of before.revisions) expect(failed.revisions).toContainEqual(prior);
 expect((await currentProject(page)).name).toBe("Quota before rename");
 await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 await expect(page.getByText("Правка не сохранена. Повторите сохранение или экспортируйте данные для восстановления.",{exact:true})).toBeVisible({timeout:4000});
 await expect(page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true})).toHaveCount(0);
 expect(await rows(page,"a")).toEqual(failed);
 await page.getByTestId("rename-project-sheet").getByRole("button",{name:"Отмена",exact:true}).click();
 const notice=page.getByTestId("persistence-failure-notice"); await expect(notice).toBeVisible();
 await notice.getByRole("button",{name:"Скачать несохранённую правку",exact:true}).click();
 const transfer=page.getByRole("complementary",{name:"Передача файла",exact:true});await expect(transfer.getByRole("heading",{name:"Несохранённая правка",exact:true})).toBeVisible();
 await expect(transfer.getByRole("button",{name:"Передать файл",exact:true})).toBeVisible();
 expect(await rows(page,"a")).toEqual(failed);
 await transfer.getByRole("button",{name:"Закрыть",exact:true}).click();
 await notice.getByRole("button",{name:"Повторить сохранение",exact:true}).click();
 await saved(page); expect((await currentProject(page)).name).toBe("Retained quota rename");
 expect((await rows(page,"a")).revisions).toHaveLength(before.revisions.length+1);
});


test("TMA-UI-20: host viewport and safe-area hooks fit the actual editor and revoke an old contact after live resize",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a")); await page.evaluate(()=>window.__telegramRuntimeUi.mountPreparedNavigable("a")); await open(page,"Uppercase local model");
 const item=page.getByTestId("schematic-item");const box=await item.boundingBox();if(!box)throw new Error("No actual item");
 const before=await rows(page,"a");const x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+18,y+10,{steps:4});
 await page.evaluate(()=>{const s=document.documentElement.style;s.setProperty("--editor-viewport-height","480px");s.setProperty("--editor-safe-area-top","32px");s.setProperty("--editor-safe-area-bottom","24px");});
 await expect.poll(()=>page.getByTestId("editor-workspace").evaluate(el=>el.getBoundingClientRect().height)).toBe(480);
 const header=page.getByTestId("editor-top-bar");expect(await header.evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThanOrEqual(32);
 const dock=page.getByTestId("editor-action-dock");const d=await dock.boundingBox();if(!d)throw new Error("No actual dock");expect(d.y+d.height).toBeLessThanOrEqual(480);
 await page.mouse.up();expect(await rows(page,"a")).toEqual(before);
});

test("TMA-UI-21: at360px and200percent text the guarded native dialog keeps both choices inside the visible host viewport",async({page},info)=>{
 await page.setViewportSize({width:360,height:640});await navigableRoom(page,"200% text");
 await page.evaluate(()=>{document.documentElement.style.fontSize="200%";document.documentElement.style.setProperty("--editor-viewport-height","480px");});
 await page.getByRole("button",{name:"Переименовать проект 200% text",exact:true}).click();
 await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("  Большой текст  ");await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});await expect(guard).toBeVisible();
 for(const name of ["Продолжить","Отменить правку"]){const b=guard.getByRole("button",{name,exact:true});await b.scrollIntoViewIfNeeded();const size=await b.evaluate(el=>({box:el.getBoundingClientRect().toJSON(),scroll:el.scrollWidth,client:el.clientWidth,font:parseFloat(getComputedStyle(el).fontSize)}));expect(size.font).toBeGreaterThanOrEqual(32);expect(size.scroll).toBeLessThanOrEqual(size.client+1);expect(size.box.x).toBeGreaterThanOrEqual(0);expect(size.box.right).toBeLessThanOrEqual(360);expect(size.box.bottom).toBeLessThanOrEqual(480);expect(size.box.height).toBeGreaterThanOrEqual(44);}
 await info.attach("360px-200percent-host-viewport",{body:await page.screenshot(),contentType:"image/png"});
 await guard.getByRole("button",{name:"Продолжить",exact:true}).click();await expect(page.getByRole("textbox",{name:"Новое название проекта",exact:true})).toHaveValue("  Большой текст  ");
});


test("TMA-UI-22: host deactivation revokes a queued Plan release and reactivation requires a fresh contact",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a"));await page.evaluate(()=>window.__telegramRuntimeUi.mountPreparedNavigable("a"));await open(page,"Uppercase local model");
 const item=page.getByTestId("schematic-item"),box=await item.boundingBox();if(!box)throw new Error("No actual item");const x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+18,y+10,{steps:4});const before=await rows(page,"a");
 await page.evaluate(({x,y})=>{window.__telegramRuntimeUi.setHostActivity(false);document.querySelector('[data-testid="schematic-item"]')?.closest('svg')?.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,pointerId:1,pointerType:"mouse",isPrimary:true,clientX:x,clientY:y,buttons:0}));},{x:x+18,y:y+10});
 await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.hasActivePublication())).toBe(false);expect(await rows(page,"a")).toEqual(before);
 await page.evaluate(()=>window.__telegramRuntimeUi.setHostActivity(true));await page.mouse.up();expect(await rows(page,"a")).toEqual(before);
 expect(await page.evaluate(()=>window.__telegramRuntimeUi.hostLifecycleListenerCount())).toBe(1);await page.evaluate(()=>window.__telegramRuntimeUi.dispose());expect(await page.evaluate(()=>window.__telegramRuntimeUi.hostLifecycleListenerCount())).toBe(0);
});


test("TMA-UI-23: exact unverified private source uses explicit readonly selection and a distinct fresh File gesture", async ({ page }) => {
	const preserved = await browser(page);
	await start(page, "a");
	await createRoom(page, "Source recovery only");
	const serializedProject = ' \n{"schemaVersion":999,"raw":"' + String.fromCharCode(0xd800) + '\u0000"}  ';
	await page.evaluate((text) => window.__telegramRuntimeUi.corruptCurrentSource("a", text), serializedProject);
	await expect(page.getByRole("heading", { name: "Проект требует восстановления", exact: true })).toBeVisible();
	const before = await rows(page, "a");
	const panel = page.getByRole("complementary", { name: "Непроверенные исходники", exact: true });
	await expect(panel).toBeVisible();
	await expect(panel.getByRole("button", { name: "Подготовить исходник записи 1", exact: true })).toHaveCount(0);
	await panel.getByRole("button", { name: "Показать записи", exact: true }).click();
	await panel.getByRole("button", { name: "Подготовить исходник записи 1", exact: true }).click();
	const file = page.getByRole("complementary", { name: "Передача файла", exact: true });
	await expect(file.getByRole("heading", { name: "Непроверенная исходная запись", exact: true })).toBeVisible();
	expect(await page.evaluate(() => window.__telegramRuntimeUi.sharedFileCount())).toBe(0);
	await file.getByRole("button", { name: "Передать файл", exact: true }).click();
	await expect.poll(() => page.evaluate(() => window.__telegramRuntimeUi.sharedFileCount())).toBe(1);
	const handed = await page.evaluate(() => window.__telegramRuntimeUi.sharedFile(0));
	expect(handed.name).toBe("project.interiors-source.json");
	expect(handed.mimeType).toBe("application/json");
	const envelope = JSON.parse(new TextDecoder().decode(new Uint8Array(handed.bytes)));
	expect(envelope).toEqual({ purpose: "interiors-editor-unverified-source", version: 1, kind: "unverified-source", projectId: Reflect.get(before.projects[0] as object, "projectId"), revisionId: Reflect.get(before.projects[0] as object, "currentRevisionId"), serializedProject });
	await expect(file).toContainText("этот файл не восстанавливает проект автоматически");
	expect(await rows(page, "a")).toEqual(before);
	expect(await browser(page)).toEqual(preserved);
});


test("TMA-UI-24: inactive host captures focused raw angle before blur and never turns it into a saved mutation",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a"));await page.evaluate(()=>window.__telegramRuntimeUi.mountPreparedNavigable("a"));await open(page,"Uppercase local model");await page.getByTestId("schematic-item").click();
 const inspector=page.getByTestId("selected-item-inspector");if(!(await inspector.isVisible())){const action=page.getByRole("button",{name:"Параметры выбранного предмета",exact:true});if(!(await action.isVisible()))await page.getByRole("button",{name:"Открыть остальные действия",exact:true}).click();await action.click();}else if((await inspector.getAttribute("data-inspector-expanded"))!=="true")await page.getByRole("button",{name:"Развернуть панель предмета",exact:true}).click();
 const angle=inspector.getByRole("textbox",{name:"Угол поворота выбранного предмета, градусы",exact:true});await angle.fill("17.50");const before=await rows(page,"a");
 await page.evaluate(()=>window.__telegramRuntimeUi.setHostActivity(false));await angle.evaluate(element=>(element as HTMLInputElement).blur());
 await expect(angle).toHaveValue("17.50");expect(await rows(page,"a")).toEqual(before);
 await page.evaluate(()=>window.__telegramRuntimeUi.setHostActivity(true));await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
 const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});await expect(guard).toBeVisible();expect(await rows(page,"a")).toEqual(before);
 await guard.getByRole("button",{name:"Продолжить",exact:true}).click();await expect(angle).toHaveValue("17.50");expect(await rows(page,"a")).toEqual(before);
});

test("TMA-UI-25: a layout-only host event invalidates the old Plan release without a Project command",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a"));await page.evaluate(()=>window.__telegramRuntimeUi.mountPreparedNavigable("a"));await open(page,"Uppercase local model");
 const item=page.getByTestId("schematic-item");await item.click();const box=await item.boundingBox();if(!box)throw new Error("Actual placed model missing");const before=await rows(page,"a");
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+15,{steps:3});
 await page.evaluate(()=>window.__telegramRuntimeUi.changeHostLayout());await page.mouse.up();expect(await rows(page,"a")).toEqual(before);
});

test("TMA-UI-26: closing the page during an actual uncommitted save reopens the last exact Durable Revision",async({page,context})=>{
 await navigableRoom(page,"Last durable before abrupt close");const before=await rows(page,"a"),preserved=await browser(page),url=page.url();
 await page.getByRole("button",{name:"Переименовать проект Last durable before abrupt close",exact:true}).click();
 await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("Uncommitted after close");
 await page.evaluate(()=>window.__telegramRuntimeUi.holdPublicationChecksum("Uncommitted after close"));
 await page.getByRole("button",{name:"Сохранить",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.checksumIsHeld())).toBe(true);
 await page.close({runBeforeUnload:false});
 const reopened=await context.newPage();
 try{
  await reopened.goto(url);await start(reopened,"a");await reopened.getByRole("button",{name:"Открыть Last durable before abrupt close",exact:true}).click();
  await expect.poll(()=>reopened.evaluate(()=>{const state=window.__telegramRuntimeUi.state();return "project" in state ? state.project?.name : undefined;})).toBe("Last durable before abrupt close");
  expect(await rows(reopened,"a")).toEqual(before);expect(await browser(reopened)).toEqual(preserved);
  await expect(reopened.getByRole("button",{name:"Переименовать проект Uncommitted after close",exact:true})).toHaveCount(0);
 }finally{await reopened.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await reopened.close();}
});


test("TMA-UI-27: an oversized actual local GLB is refused before reading bytes and without Project changes",async({page})=>{
 await navigableRoom(page,"Bounded local GLB");const before=await rows(page,"a");
 await openEditorCatalog(page);await page.getByTestId("catalog-authoring").locator("summary").click();
 await page.evaluate(()=>window.__telegramRuntimeUi.selectModelFile("glb",25*1024*1024+1));
 await expect(page.getByText("Одна GLB-модель ограничена 25 MiB, чтобы её можно было хранить и открыть на телефоне.",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(0);expect(await rows(page,"a")).toEqual(before);
});
test("TMA-UI-28: embedded Telegram exposes static GLB only and rejects a queued FBX selection without conversion or reads",async({page})=>{
 await navigableRoom(page,"Static GLB only");const before=await rows(page,"a");
 await openEditorCatalog(page);await page.getByTestId("catalog-authoring").locator("summary").click();
 await expect(page.getByRole("button",{name:"Выбрать FBX или ZIP",exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Выбрать GLB",exact:true})).toBeVisible();
 await page.evaluate(()=>window.__telegramRuntimeUi.selectModelFile("fbx",1));
 await expect(page.getByText(/^Преобразуем /)).toHaveCount(0);expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(0);expect(await rows(page,"a")).toEqual(before);
});


test("TMA-UI-29: Back requires an explicit discard for an actual fence-loss recovery candidate",async({page,context})=>{
 await navigableRoom(page,"Fence recovery base");
 await page.getByRole("button",{name:"Переименовать проект Fence recovery base",exact:true}).click();await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("Retained fence candidate");
 await page.evaluate(()=>window.__telegramRuntimeUi.holdPublicationChecksum("Retained fence candidate"));await page.getByRole("button",{name:"Сохранить",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.checksumIsHeld())).toBe(true);
 const foreign=await context.newPage();
 try{
  await foreign.goto(page.url());await foreign.evaluate(async()=>{await window.__telegramRuntimeUi.initialize();await window.__telegramRuntimeUi.mountConcurrentNavigable("a");});await foreign.getByRole("button",{name:"Открыть Fence recovery base",exact:true}).click();
  await foreign.getByRole("button",{name:"Взять редактирование на себя",exact:true}).click();await foreign.getByRole("button",{name:"Подтвердить",exact:true}).click();await expect(foreign.getByTestId("writer-lease-notice")).toHaveCount(0);
  await page.evaluate(()=>window.__telegramRuntimeUi.releasePublicationChecksum());
  await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");
  await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  const durable=await rows(page,"a");
  const panel=await dimensions(page);await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(panel).toHaveCount(0);expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");
  await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
  const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});await expect(guard).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  await guard.getByRole("button",{name:"Продолжить",exact:true}).click();expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");expect(await rows(page,"a")).toEqual(durable);
  await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await guard.getByRole("button",{name:"Отменить правку",exact:true}).click();await expect(page.getByTestId("project-hub")).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBeUndefined();expect(await rows(page,"a")).toEqual(durable);
  await page.getByRole("button",{name:"Открыть Fence recovery base",exact:true}).click();await expect(page.getByTestId("writer-lease-notice")).toBeVisible();await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(page.getByTestId("project-hub")).toBeVisible();await expect(guard).toHaveCount(0);
 }finally{await foreign.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await foreign.close();}
});


test("TMA-UI-30: host Back waits while an explicit native writer takeover is queued behind the real scope lock",async({page,context})=>{
 await navigableRoom(page,"Queued writer takeover");const before=await rows(page,"a"),foreign=await context.newPage();
 try{
  await foreign.goto(page.url());await foreign.evaluate(async()=>{await window.__telegramRuntimeUi.initialize();await window.__telegramRuntimeUi.mountConcurrentNavigable("a");});
  await foreign.getByRole("button",{name:"Открыть Queued writer takeover",exact:true}).click();await foreign.getByRole("button",{name:"Взять редактирование на себя",exact:true}).click();
  await page.evaluate(()=>window.__telegramRuntimeUi.holdScopeLock("a"));await foreign.getByRole("button",{name:"Подтвердить",exact:true}).click();await expect(foreign.getByRole("button",{name:"Перехватываем редактирование…",exact:true})).toBeDisabled();
  await foreign.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(foreign.getByText("Дождитесь завершения текущего действия. Сохраняемая правка не отменена.",{exact:true})).toBeVisible();
  await expect(foreign.getByTestId("project-hub")).toHaveCount(0);await expect(foreign.getByRole("alertdialog",{name:"Несохранённая правка",exact:true})).toHaveCount(0);expect(await foreign.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  await page.evaluate(()=>window.__telegramRuntimeUi.releaseScopeLock());await expect(foreign.getByTestId("writer-lease-notice")).toHaveCount(0);expect(await rows(foreign,"a")).toEqual(before);
 }finally{await page.evaluate(()=>window.__telegramRuntimeUi.releaseScopeLock()).catch(()=>undefined);await foreign.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await foreign.close();}
});


test("TMA-UI-31: exact repair bounds precede every File read or storage write and a supported exact GLB restores the same Revision",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a"));await page.evaluate(()=>window.__telegramRuntimeUi.removeCurrentResource("a"));
 await page.getByRole("button",{name:"Открыть Uppercase local model",exact:true}).click();
 await expect(page.getByRole("button",{name:"Восстановить исходные GLB",exact:true})).toBeVisible();
 const before=await rows(page,"a"),all=await page.evaluate(()=>window.__telegramRuntimeUi.allScopedRows("a"));
 for(const sizes of [[50*1024*1024+1],Array.from({length:901},()=>1)]){
  await page.evaluate(sizes=>window.__telegramRuntimeUi.selectRepairFiles(sizes),sizes);
  await expect(page.getByText("Выбранный набор GLB превышает допустимые ограничения. Проект не изменён.",{exact:true})).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(0);expect(await page.evaluate(()=>window.__telegramRuntimeUi.allScopedRows("a"))).toEqual(all);
 }
 await page.evaluate(()=>window.__telegramRuntimeUi.selectRepairFiles());await saved(page);expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(1);expect(await rows(page,"a")).toEqual(before);
});

for (const format of ["plain", "encrypted"] as const) {
	test(`TMA-UI-RESOURCE-03: ${format} backup restores exact models without creating a project`, async ({ page }) => {
		const fixture = await page.evaluate(async () => {
			const fixture = await window.__telegramRuntimeUi.prepareUpperCustom("a");
			window.__telegramRuntimeUi.mountPreparedNavigable("a");
			return fixture;
		});
		await open(page, "Uppercase local model");
		const project = await currentProject(page);
		const archive = Uint8Array.from(await page.evaluate(() => window.__telegramRuntimeUi.currentBackupBytes()));
		const password = "backup-fixture-password";
		const backup = format === "encrypted" ? await encryptProjectTransfer(archive, password) : { kind: "plain" as const, bytes: archive };
		if (backup.kind === "rejected") throw new Error("Expected an encrypted backup fixture");

		await page.evaluate(() => window.__telegramRuntimeUi.removeCurrentResource("a"));
		await page.getByRole("button", { name: "Открыть Uppercase local model", exact: true }).click();
		await expect(page.getByRole("button", { name: "Восстановить модели из резервной копии", exact: true })).toBeVisible();
		const before = await rows(page, "a");
		const chooser = page.getByLabel("Выбрать резервную копию для восстановления моделей", { exact: true });
		const selectBackup = () => page.evaluate((bytes) => window.__telegramRuntimeUi.selectRepairBackup(bytes), [...backup.bytes]);
		await selectBackup();
		if (format === "encrypted") {
			const dialog = page.getByRole("dialog", { name: "Пароль файла проекта", exact: true });
			const field = dialog.getByLabel("Пароль, заданный при экспорте", { exact: true });
			const restore = dialog.getByRole("button", { name: "Восстановить", exact: true });
			await expect(dialog).toBeVisible();
			await expect(chooser).not.toHaveAttribute("accept");
			await field.fill("incorrect-fixture-password");
			await restore.click();
			await expect(dialog.getByRole("alert")).toContainText("Пароль неверен");
			expect(await rows(page, "a")).toEqual(before);
			await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
			await expect(dialog).toHaveCount(0);
			expect(await rows(page, "a")).toEqual(before);
			await selectBackup();
			await field.fill(password);
			await restore.click();
			await expect(dialog).toHaveCount(0);
		}
		await saved(page);
		expect(await currentProject(page)).toEqual(project);
		expect(await rows(page, "a")).toEqual(before);
		const repaired = await page.evaluate(() => window.__telegramRuntimeUi.allScopedRows("a"));
		expect(repaired).toMatchObject({ resources: [{ resourceHash: fixture.resourceHash, blob: { blobBytes: fixture.sourceBytes } }] });
	});
}


test("TMA-UI-32: a one-mm retained wall remains touch-selectable and independently deletable without losing its room", async ({ page }) => {
	// Keep the closing wall after the tiny tail in canonical SVG order: an
	// overlapping DOM hit alone must not be enough to pass the selection check.
	await page.evaluate(() => {
		let sequence = 0;
		Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => `00000000-0000-4000-8000-${(++sequence).toString(16).padStart(12, "0")}` });
	});
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a"));
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill("Короткий остаток");
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await saved(page);
	for (const [start, end] of [
		[{ xMm: 0, zMm: 0 }, { xMm: 4001, zMm: 0 }],
		[{ xMm: 4000, zMm: 3000 }, { xMm: 0, zMm: 3000 }],
		[{ xMm: 0, zMm: 3000 }, { xMm: 0, zMm: 0 }],
		[{ xMm: 4000, zMm: 0 }, { xMm: 4000, zMm: 3000 }],
	] as const) await page.evaluate(({ start, end }) => window.__telegramRuntimeUi.addWall({ start, end, thicknessMm: 100 }), { start, end });
	await saved(page);
	const exported = await currentProject(page);
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	await page.getByRole("button", { name: "Экспортировать проект", exact: true }).click();
	await page.getByRole("button", { name: "Передать файл", exact: true }).click();
	await expect(page.getByText(/Проверьте файл вне приложения/)).toBeVisible();
	await page.getByRole("button", { name: "Закрыть", exact: true }).click();
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	await page.getByRole("button", { name: "Проекты", exact: true }).click();
	await expect(page.getByTestId("project-hub")).toBeVisible();
	await page.evaluate(() => window.__telegramRuntimeUi.reselectSharedFile(0));
	await saved(page);
	const source = await currentProject(page);
	expect(source.projectId).not.toBe(exported.projectId);
	expect(source.level).toEqual(exported.level);
	const tailEnd = source.level.vertices.find(vertex => vertex.xMm === 4001 && vertex.zMm === 0);
	const tail = source.level.wallSegments.find(wall => wall.startVertexId === tailEnd?.vertexId || wall.endVertexId === tailEnd?.vertexId);
	if (!tail) throw new Error("Missing exact one-mm tail");
	await page.getByRole("button", { name: "Приблизить", exact: true }).click();
	const hit = page.locator(`[data-testid="wall-segment"][data-wall-id="${tail.wallSegmentId}"]`);
	const box = await hit.boundingBox();
	if (!box) throw new Error("Missing wall touch target");
	expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
	expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
	for (const zoomOut of [false, true]) {
		if (zoomOut) for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Отдалить", exact: true }).click();
		for (const offsetX of [0, 20]) {
			await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
			const point = await page.locator(`[data-testid="wall-line"][data-wall-id="${tail.wallSegmentId}"]`).evaluate(line => {
				const element = line as SVGLineElement;
				const matrix = element.getScreenCTM();
				if (!matrix) throw new Error("Missing plan projection");
				const point = new DOMPoint((element.x1.baseVal.value + element.x2.baseVal.value) / 2, (element.y1.baseVal.value + element.y2.baseVal.value) / 2).matrixTransform(matrix);
				return { x: point.x, y: point.y };
			});
			if (offsetX !== 0) {
				const rawHit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-wall-id]")?.getAttribute("data-wall-id"), { x: point.x + offsetX, y: point.y + 0.1 });
				expect(rawHit).toBeTruthy();
				expect(rawHit).not.toBe(tail.wallSegmentId);
			}
			await page.touchscreen.tap(point.x + offsetX, point.y + (offsetX === 0 ? 0 : 0.1));
			await expect(hit.locator("..").getByTestId("wall-body")).toHaveAttribute("data-selected", "true");
		}
	}
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	const inspector = page.getByTestId("selected-wall-inspector");
	await inspector.getByRole("button", { name: "Удалить стену", exact: true }).click();
	await expect(inspector).toHaveCount(0);
	await page.getByRole("dialog", { name: "Удалить стену", exact: true }).getByRole("button", { name: "Удалить стену", exact: true }).click();
	await expect.poll(async () => (await currentProject(page)).level.wallSegments.length).toBe(4);
	await saved(page);
	const deleted = await currentProject(page);
	expect(deleted.level.wallSegments).toHaveLength(4);
	expect(deleted.level.rooms).toEqual(source.level.rooms);
	expect(deleted.level.vertices.some(vertex => vertex.vertexId === tailEnd?.vertexId)).toBe(false);
});

test("TMA-WALL-CONTINUITY: legacy inline edges share a fill, selection and one undoable deletion", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a"));
	await createRoom(page, "Цельная стена");
	const source = await currentProject(page);
	const top = source.level.wallSegments.find(wall => [wall.startVertexId, wall.endVertexId].every(id =>
		source.level.vertices.find(vertex => vertex.vertexId === id)?.zMm === 0));
	if (!top) throw new Error("Expected top wall");
	await page.evaluate(wallId => window.__telegramRuntimeUi.splitWall(wallId, { xMm: 2000, zMm: 0 }), top.wallSegmentId);
	await saved(page);
	const split = await currentProject(page);
	const segments = split.level.wallSegments.filter(wall => [wall.startVertexId, wall.endVertexId].every(id =>
		split.level.vertices.find(vertex => vertex.vertexId === id)?.zMm === 0));
	expect(segments).toHaveLength(2);
	await expect(page.getByTestId("continuous-wall-fill")).toHaveCount(1);
	for (const wall of segments) {
		await page.locator(`[data-testid="wall-segment"][data-wall-id="${wall.wallSegmentId}"]`).click();
		for (const part of segments) {
			await expect(page.locator(`[data-testid="wall-body"][data-wall-id="${part.wallSegmentId}"]`)).toHaveAttribute("data-selected", "true");
		}
	}
	const before = await rows(page, "a");
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	await page.getByTestId("selected-wall-inspector").getByRole("button", { name: "Удалить стену", exact: true }).click();
	await page.getByRole("dialog", { name: "Удалить стену", exact: true }).getByRole("button", { name: "Удалить стену", exact: true }).click();
	await saved(page);
	const current = await currentProject(page);
	expect(current.level.wallSegments).toHaveLength(3);
	expect((await rows(page, "a")).revisions).toHaveLength(before.revisions.length + 1);
	await page.getByRole("group", { name: "История изменений" }).getByRole("button", { name: /^Отменить действие/ }).click();
	await expect(page.getByTestId("continuous-wall-fill")).toHaveCount(1);
});

test("TMA-WALL-CONSEQUENCES: room merge describes human choices and closes without publishing", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a"));
	await createRoom(page, "Объединение помещений");
	const source = await currentProject(page);
	const [start, end] = source.level.wallSegments.flatMap(wall => {
		const a = source.level.vertices.find(vertex => vertex.vertexId === wall.startVertexId);
		const b = source.level.vertices.find(vertex => vertex.vertexId === wall.endVertexId);
		return a && b && a.zMm === b.zMm ? [{ xMm: (a.xMm + b.xMm) / 2, zMm: a.zMm }] : [];
	});
	if (!start || !end) throw new Error("Expected rectangle boundaries");
	await page.evaluate(({ start, end }) => window.__telegramRuntimeUi.addWall({ start, end, thicknessMm: 100 }), { start, end });
	await saved(page);
	const project = await currentProject(page);
	const before = await rows(page, "a");
	await page.locator('[data-testid="wall-segment"][data-wall-kind="interior"]').click();
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	await page.getByTestId("selected-wall-inspector").getByRole("button", { name: "Удалить стену", exact: true }).click();
	const sheet = page.getByRole("dialog", { name: "Удалить стену", exact: true });
	await expect(sheet).toBeVisible();
	await expect(sheet.getByRole("heading", { name: "Удалить стену", exact: true })).toBeVisible();
	await expect(sheet.getByText(/объединятся/i)).toBeVisible();
	for (const room of project.level.rooms) await expect(sheet).not.toContainText(room.roomId);
	await expect(sheet.getByTestId("wall-deletion-metadata-0")).toHaveAccessibleName(/Другое/);
	await expect(sheet.getByTestId("wall-deletion-metadata-1")).toHaveAccessibleName(/Другое/);
	await sheet.getByRole("button", { name: "Закрыть удаление стены", exact: true }).click();
	await expect(sheet).toHaveCount(0);
	expect(await rows(page, "a")).toEqual(before);
	await page.getByTestId("selected-wall-inspector").getByRole("button", { name: "Удалить стену", exact: true }).click();
	const merge = sheet.getByRole("button", { name: "Объединить помещения", exact: true });
	await expect(merge).toBeDisabled();
	await sheet.getByTestId("wall-deletion-metadata-1").click();
	await merge.click();
	await expect.poll(async () => (await currentProject(page)).level.rooms.length).toBe(1);
	expect((await rows(page, "a")).revisions).toHaveLength(before.revisions.length + 1);
});

test("TMA-UI-33: cancelling the plain wall-move confirmation preserves the durable Project", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a"));
	await createRoom(page, "Проверка переноса");
	const source = await currentProject(page);
	const horizontal = source.level.wallSegments.flatMap(wall => {
		const start = source.level.vertices.find(vertex => vertex.vertexId === wall.startVertexId);
		const end = source.level.vertices.find(vertex => vertex.vertexId === wall.endVertexId);
		return start && end && start.zMm === end.zMm ? [{ xMm: (start.xMm + end.xMm) / 2, zMm: start.zMm }] : [];
	});
	if (horizontal.length !== 2) throw new Error("Expected rectangle boundaries");
	await page.evaluate(({ start, end }) => window.__telegramRuntimeUi.addWall({ start, end, thicknessMm: 100 }), { start: horizontal[0], end: horizontal[1] });
	await saved(page);
	const before = await rows(page, "a");
	const divider = page.locator('[data-testid="wall-segment"][data-wall-kind="interior"]');
	await divider.click();
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	await page.getByRole("button", { name: "Переместить стену жестом", exact: true }).click();
	const box = await divider.boundingBox();
	if (!box) throw new Error("Missing movable wall");
	const start = { x: box.x + box.width / 2, y: box.y + Math.min(36, box.height / 2) };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x - 30, start.y, { steps: 6 });
	await page.mouse.up();
	const draft = page.getByTestId("wall-move-draft");
	await expect(draft).toBeVisible();
	await expect(draft.getByRole("button", { name: "Подтвердить", exact: true })).toBeVisible();
	await draft.getByRole("button", { name: "Отменить", exact: true }).click();
	await expect(draft).toHaveCount(0);
	expect(await rows(page, "a")).toEqual(before);
});

test("BROWSER-DIRECTORY-UI-01: qualified same-ID card actions retain their selected owner at the shared UI boundary", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract());
 const card = page.locator('[data-project-storage="browser-registered"]');
 await expect(card.getByRole("button", { name: /^Открыть / })).toBeVisible();
 await card.getByRole("button", { name: /^Открыть / }).click();
 await card.locator("summary").click();
 await card.getByRole("button", { name: /^Экспортировать проект / }).click();
 await card.getByRole("button", { name: /^Экспорт файла для переноса:/ }).click();
 await card.getByRole("button", { name: /^Удалить проект / }).click();
 await page.getByRole("dialog", { name: "Удалить проект", exact: true }).getByRole("button", { name: "Удалить навсегда", exact: true }).click();
 const calls = await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls());
 expect(calls.map(call => [call.method, call.arguments[0], call.arguments[1]])).toEqual([
  ["openProject", "same-id", { storageNamespace: "browser-registered" }],
  ["export", "same-id", { storageNamespace: "browser-registered" }],
  ["registered-export", "same-id", { storageNamespace: "browser-registered" }],
  ["delete", "same-id", { storageNamespace: "browser-registered" }],
 ]);
 await card.locator("summary").click();
 await card.getByRole("button", { name: /^Переименовать / }).click();
 await expect(page.getByRole("textbox", { name: "Новое название проекта", exact: true })).toHaveValue("Перенесённый план");
 const rename = (await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).at(-1);
 expect(rename).toEqual({ method: "openProject", arguments: ["same-id", { storageNamespace: "browser-registered", initialAction: "rename" }] });
});

test("BROWSER-DIRECTORY-UI-02: an opaque instance change remounts same-ID editor state and retains only the new rename intent", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract());
 await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Первая копия"));
 const input = page.getByRole("textbox", { name: "Новое название проекта", exact: true });
 await expect(input).toHaveValue("Первая копия"); await input.fill("  Старый сырой черновик  ");
 await input.evaluate(element => { Object.defineProperty(window, "__priorRename", { value: element, configurable: true }); });
 await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Другая копия с тем же ID"));
 await expect(input).toHaveValue("Другая копия с тем же ID");
 expect(await page.evaluate(() => (window as unknown as { __priorRename: Element }).__priorRename.isConnected)).toBe(false);
});

test("BROWSER-DIRECTORY-UI-03: the ordinary unqualified Web card preserves its single-argument open contract", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(false));
 await page.getByRole("button", { name: "Открыть Одинаковый план", exact: true }).click();
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([{ method: "openProject", arguments: ["same-id"] }]);
});

test("BROWSER-DIRECTORY-UI-04: unavailable source is not called empty and explicit retry refreshes the directory", async ({ page }) => {
 await page.setViewportSize({ width: 360, height: 800 });
 await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
 // Deliberately publish after the render snapshot but before observer registration.
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, true));
 await expect(page.getByText("Часть проектов сейчас недоступна", { exact: true })).toBeVisible();
 await expect(page.getByText("Пока нет проектов", { exact: true })).toHaveCount(0);
 await page.getByRole("button", { name: "Повторить проверку локальных хранилищ", exact: true }).click();
 await expect(page.locator('[data-project-storage]')).toHaveCount(2);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.getByText("Старая версия не видит перенесённые проекты", { exact: true }).click();
 await expect(page.getByText(/^Проекты из хранилища для переноса не отображаются в старой версии/)).toBeVisible();
 await page.screenshot({ path: test.info().outputPath("qualified-directory-360-200.png"), fullPage: true });
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([{ method: "showProjects", arguments: [] }]);
});


test("BROWSER-DIRECTORY-UI-05: browser protection confirms an owned recovery copy without pretending to be Telegram", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, true));
 await expect(page.getByTestId("project-hub")).toBeVisible();
 await page.evaluate(() => window.__telegramRuntimeUi.directoryRecoveryExit());
 await expect(page.getByTestId("editor-top-bar")).toBeVisible();
 expect(await page.locator('[data-editor-host="telegram"]').count()).toBe(0);
 await page.getByTestId("editor-top-bar").getByRole("button", { name: "Вернуться к проектам", exact: true }).click();
 const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
 await expect(guard).toBeVisible();
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([]);
 await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
 await expect(guard).toHaveCount(0); await expect(page.getByTestId("editor-top-bar")).toBeVisible();
 await page.getByTestId("editor-top-bar").getByRole("button", { name: "Вернуться к проектам", exact: true }).click();
 await guard.getByRole("button", { name: "Отменить правку", exact: true }).click();
 await expect(page.getByTestId("project-hub")).toBeVisible();
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([{ method: "confirmedDiscard", arguments: ["Несохранённая копия"] }]);
});


test("BROWSER-PROTECTION-01: optional browser navigation cannot blur-publish a valid raw angle before confirmation", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.prepareUpperCustom("a"));
	await page.evaluate(() => window.__telegramRuntimeUi.mountPreparedBrowserProtected("a"));
	await open(page, "Uppercase local model");
	await page.getByTestId("schematic-item").click();
	const inspector = page.getByTestId("selected-item-inspector");
	if (!(await inspector.isVisible())) {
		const action = page.getByRole("button", { name: "Параметры выбранного предмета", exact: true });
		if (!(await action.isVisible())) await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
		await action.click();
	} else if ((await inspector.getAttribute("data-inspector-expanded")) !== "true") {
		await page.getByRole("button", { name: "Развернуть панель предмета", exact: true }).click();
	}
	const input = page.getByRole("textbox", { name: "Угол поворота выбранного предмета, градусы", exact: true });
	await expect(input).toBeEnabled();
	await input.fill(" 45 ");
	await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(1, 3, "forward"));
	const before = await rows(page, "a");
	expect(await page.locator('[data-editor-host="telegram"]').count()).toBe(0);
 await page.getByTestId("editor-top-bar").getByRole("button", { name: "Вернуться к проектам", exact: true }).click();
	const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
	try { await expect(guard).toBeVisible({ timeout: 4000 }); } catch (error) {
 await test.info().attach("actual-preblur-state", { body: JSON.stringify({ before, after: await rows(page, "a"), state: await page.evaluate(() => window.__telegramRuntimeUi.state()) }), contentType: "application/json" }); throw error;
 }
	expect(await rows(page, "a")).toEqual(before);
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(input).toBeFocused();
	await expect(input).toHaveValue(" 45 ");
 expect(await input.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd, element.selectionDirection])).toEqual([1, 3, "forward"]);
 await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Предпросмотр — не сохранено");
	expect(await rows(page, "a")).toEqual(before);
	await page.getByTestId("editor-top-bar").getByRole("button", { name: "Вернуться к проектам", exact: true }).click();
	await expect(guard).toBeVisible();
	await guard.getByRole("button", { name: "Отменить правку", exact: true }).click();
	await expect(input).toHaveValue("0");
	expect(await rows(page, "a")).toEqual(before);
});



test("BROWSER-PROTECTION-02: protected browser Back revokes an actual Plan drag before its queued release", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.prepareUpperCustom("a"));
	await page.evaluate(() => window.__telegramRuntimeUi.mountPreparedBrowserProtected("a"));
	await open(page, "Uppercase local model");
	const item = page.getByTestId("schematic-item");
	const box = await item.boundingBox();
	if (!box) throw new Error("No actual rendered item");
	let x = box.x + box.width / 2, y = box.y + box.height / 2;
	const baseline = await rows(page, "a");
	await page.mouse.move(x, y); await page.mouse.down();
	await page.mouse.move(x + 12, y, { steps: 3 }); await page.mouse.up();
	await expect.poll(async () => (await rows(page, "a")).revisions.length).toBe(baseline.revisions.length + 1);
	const movedBox = await item.boundingBox();
	if (!movedBox) throw new Error("No moved actual item");
	x = movedBox.x + movedBox.width / 2; y = movedBox.y + movedBox.height / 2;
	const before = await rows(page, "a");
	await page.mouse.move(x, y); await page.mouse.down();
	await page.mouse.move(x + 18, y + 8, { steps: 4 });
	await page.evaluate(({ x, y }) => {
		const back = document.querySelector<HTMLButtonElement>('[data-testid="editor-top-bar"] button[aria-label="Вернуться к проектам"]'); if (!back) throw new Error("Missing actual browser Back"); back.click();
		const svg = document.querySelector('[data-testid="schematic-item"]')?.closest('svg');
		if (!svg) throw new Error("No actual Plan SVG");
		svg.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: y, buttons: 0 }));
	}, { x: x + 18, y: y + 8 });
	const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
	await expect(guard).toBeVisible({ timeout: 4000 });
	await expect.poll(() => page.evaluate(() => window.__telegramRuntimeUi.hasActivePublication())).toBe(false);
	expect(await rows(page, "a")).toEqual(before);
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await page.mouse.up();
	expect(await rows(page, "a")).toEqual(before);
});


test("BROWSER-PROTECTION-03: protected browser Back retains the actual 3D pose and requires a fresh contact", async ({ page }) => {
 const preserved = await browser(page);
 await page.evaluate(() => window.__telegramRuntimeUi.prepareUpperCustom("a"));
 await page.evaluate(() => window.__telegramRuntimeUi.mountPreparedBrowserProtected("a"));
 await open(page, "Uppercase local model");
 await page.getByTestId("schematic-item").click();
 await page.getByTestId("editor-view-switch").getByRole("button", { name: "3D", exact: true }).click();
 await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1");
 const initial = await currentProject(page);
 const originalItem = initial.assetInstances.find((item) => item.anchorClass === "floor");
 if (originalItem?.anchorClass !== "floor") throw new Error("No actual selected floor item");
 const baseline = await rows(page, "a");
 // First prove that this native gesture really reaches a Durable scoped Revision.
 await beginActualSceneMove(page, originalItem, { xMm: originalItem.xMm + 180, zMm: originalItem.zMm });
 await page.mouse.up();
 await expect.poll(async () => (await rows(page, "a")).revisions.length).toBe(baseline.revisions.length + 1);
 const moved = await currentProject(page);
 const movedItem = moved.assetInstances.find((item) => item.assetInstanceId === originalItem.assetInstanceId);
 if (movedItem?.anchorClass !== "floor") throw new Error("No actual moved floor item");
 expect(movedItem.xMm).not.toBe(originalItem.xMm);
 const before = await rows(page, "a");
 await beginActualSceneMove(page, movedItem, { xMm: movedItem.xMm + 240, zMm: movedItem.zMm + 120 });
 const preview = page.getByTestId("three-dimensional-item-preview");
 const pose = await preview.textContent();
 if (!pose?.startsWith("перемещение:")) throw new Error("No actual raw move pose");
 await page.evaluate(() => { const back = document.querySelector<HTMLButtonElement>('[data-testid="editor-top-bar"] button[aria-label="Вернуться к проектам"]'); if (!back) throw new Error("Missing actual browser Back"); back.click(); });
 const guard = page.getByRole("alertdialog", { name: "Несохранённая правка", exact: true });
 await expect(guard).toBeVisible({ timeout: 4000 });
 await expect(preview).toHaveText(pose);
 // A real captured pointerup must stay revoked while the root guard owns focus.
 await page.mouse.up();
 expect(await rows(page, "a")).toEqual(before);
 await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
 await expect(preview).toHaveText(pose);
 await expect(page.getByTestId("three-dimensional-rotation-gizmo")).toBeVisible();
 expect(await rows(page, "a")).toEqual(before);
 const [, x, z] = pose.split(":");
 if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(z))) throw new Error("Invalid retained world pose");
 const originX = Math.min(...moved.level.vertices.map((vertex) => vertex.xMm));
 const originZ = Math.min(...moved.level.vertices.map((vertex) => vertex.zMm));
 const retained = { xMm: Number(x) * 1000 + originX, zMm: Number(z) * 1000 + originZ };
 await beginActualSceneMove(page, retained, { xMm: retained.xMm + 160, zMm: retained.zMm });
 await page.mouse.up();
 await expect.poll(async () => (await rows(page, "a")).revisions.length).toBe(before.revisions.length + 1);
 expect((await currentProject(page)).assetDefinitionRefs).toEqual(moved.assetDefinitionRefs);
 expect(await browser(page)).toEqual(preserved);
});


test("BROWSER-DIRECTORY-UI-06: a retained history target behind Saved blocks navigation and ordinary editing but leaves recovery available", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, true));
 await expect(page.getByTestId("project-hub")).toBeVisible();
 await page.evaluate(() => window.__telegramRuntimeUi.directoryPendingHistoryExit());
 await expect(page.getByTestId("editor-top-bar")).toBeVisible();
 await page.getByTestId("editor-top-bar").getByRole("button", { name: "Вернуться к проектам", exact: true }).click();
 await expect(page.getByText("Правка не сохранена. Повторите сохранение или экспортируйте данные для восстановления.", { exact: true })).toBeVisible();
 await expect(page.getByTestId("project-hub")).toHaveCount(0);
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([]);
 await expect(page.getByRole("button", { name: "Переименовать проект План с ожидающей историей", exact: true })).toBeDisabled();
 await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Правка не сохранена");
 const recovery = page.getByTestId("retained-publication-notice").getByRole("button", { name: "Скачать копию для восстановления", exact: true });
 await expect(recovery).toBeEnabled(); await recovery.click();
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([{ method: "recovery-export", arguments: [] }]);
 await expect(page.getByRole("alert")).toHaveText("Не удалось подготовить несохранённую правку. Повторите попытку.");
});


test("BROWSER-DIRECTORY-UI-07: legacy readonly admission disables its creation and writes while exports and the private editor remain available", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, true, false));
 await expect(page.getByTestId("project-hub")).toBeVisible(); await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeDisabled();
 const legacy = page.locator('[data-project-storage="legacy"]'), registered = page.locator('[data-project-storage="browser-registered"]');
 await expect(legacy.getByRole("button", { name: /^Открыть / })).toBeDisabled(); await legacy.locator("summary").click(); await expect(legacy.getByRole("button", { name: /^Удалить проект / })).toBeDisabled(); await expect(legacy.getByRole("button", { name: /^Переименовать / })).toBeDisabled();
 await expect(legacy.getByRole("button", { name: /^Экспорт файла для переноса:/ })).toBeEnabled();
 await expect(registered.getByRole("button", { name: /^Открыть / })).toBeEnabled();
 await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Private still available", false, "browser-registered"));
 await expect(page.getByRole("button", { name: "Переименовать проект Private still available", exact: true })).toBeEnabled();
 await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Legacy readonly", false, "legacy"));
 await expect(page.getByRole("button", { name: "Переименовать проект Legacy readonly", exact: true })).toBeDisabled();
});


test("BROWSER-DIRECTORY-UI-08: healthy private editor keeps an explicit exact unverified legacy source download available", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, true, false));
 await expect(page.getByTestId("project-hub")).toBeVisible();
 const source = { projectId: "legacy\udfff", serializedProject: 'bad-json:{"name":"\ud800"}\u0000' };
 await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Private healthy", false, "browser-registered"));
 const canvas = page.locator("#editor-canvas"), beforeCanvas = await canvas.boundingBox();
 await page.evaluate((record) => window.__telegramRuntimeUi.setLegacyDirectoryRecovery(record), source);
 const panel = page.getByTestId("legacy-startup-recovery"); await expect(panel).toBeVisible();
 expect(await canvas.boundingBox()).toEqual(beforeCanvas); await panel.locator("summary").click(); expect(await canvas.boundingBox()).toEqual(beforeCanvas);
 await expect(page.getByRole("button", { name: "Переименовать проект Private healthy", exact: true })).toBeEnabled();
 await page.evaluate(()=>{const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),record:{created:{url:string;mime:string}[];revoked:string[]}={created:[],revoked:[]};Reflect.set(globalThis,"__legacySourceUrls",record);URL.createObjectURL=object=>{const url=create(object);record.created.push({url,mime:object instanceof Blob?object.type:""});return url;};URL.revokeObjectURL=url=>{record.revoked.push(url);revoke(url);};});
 const downloadPromise = page.waitForEvent("download");
 await panel.getByRole("button", { name: "Сохранить исходную запись", exact: true }).click();
 const download = await downloadPromise; expect(download.suggestedFilename()).toBe("project.interiors-source.json");
 const path = await download.path(); if (!path) throw new Error("Missing actual browser download");
 const fsName = "node:fs/promises"; const { readFile } = await import(fsName);
 expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ purpose: "interiors-editor-unverified-source", version: 1, kind: "unverified-source", projectId: source.projectId, revisionId: "", serializedProject: source.serializedProject });
 const created=await page.evaluate(()=>Reflect.get(globalThis,"__legacySourceUrls").created as {url:string;mime:string}[]);expect(created).toHaveLength(1);expect(created[0].mime).toBe("application/json");await expect.poll(()=>page.evaluate(()=>Reflect.get(globalThis,"__legacySourceUrls").revoked as string[])).toEqual([created[0].url]);
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([]);
});

for (const change of ["changed", "closed", "same-text-new-project", "same-project-new-text"] as const) test(`BROWSER-DIRECTORY-UI-09-${change}: a late legacy recovery action never downloads a replaced or closed source`, async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, true, false));
 await expect(page.getByTestId("project-hub")).toBeVisible();
 await page.evaluate(() => window.__telegramRuntimeUi.setLegacyDirectoryRecovery({ projectId: "legacy-A", serializedProject: "original-A" }));
 const panel = page.getByTestId("legacy-startup-recovery"); await expect(panel).toBeVisible();
 const downloads: string[] = []; page.on("download", (download) => downloads.push(download.suggestedFilename()));
 await page.evaluate((change) => window.__telegramRuntimeUi.setLegacyDirectoryRecovery(change === "closed" ? undefined : { projectId: change === "same-project-new-text" ? "legacy-A" : "legacy-B", serializedProject: change === "same-text-new-project" ? "original-A" : "changed-B" }, false), change);
 await panel.getByRole("button", { name: "Сохранить исходную запись", exact: true }).click();
 if (change === "closed") await expect(panel).toHaveCount(0);
 else await expect(panel.getByRole("alert")).toHaveText("Исходная запись изменилась. Проверьте её и повторите скачивание.");
 expect(downloads).toEqual([]); expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([]);
});


test("BROWSER-DIRECTORY-UI-10: late source admission updates visible capabilities without remounting a private rename draft", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, true, true));
 await expect(page.getByTestId("project-hub")).toBeVisible(); const create = page.getByRole("button", { name: "Новый проект", exact: true });
 await expect(create).toBeEnabled();
 await page.evaluate(() => window.__telegramRuntimeUi.updateDirectorySourceAdmission(false, { projectId: "late-legacy", serializedProject: "late source" }));
 await expect(create).toBeDisabled(); await expect(page.getByTestId("legacy-startup-recovery")).toBeVisible();
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([]);
 await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Private source event", true, "browser-registered"));
 const input = page.getByRole("textbox", { name: "Новое название проекта", exact: true }); await expect(input).toBeVisible(); await input.fill("Сырой незавершённый ввод");
 await input.evaluate((node) => (node as HTMLInputElement).setSelectionRange(2, 6));
 const originalInput = await input.elementHandle();
 await page.evaluate(() => window.__telegramRuntimeUi.updateDirectorySourceAdmission(true, undefined));
 await expect(page.getByTestId("legacy-startup-recovery")).toHaveCount(0); await expect(input).toBeVisible(); await expect(input).toHaveValue("Сырой незавершённый ввод");
 expect(await input.evaluate((node) => [(node as HTMLInputElement).selectionStart, (node as HTMLInputElement).selectionEnd])).toEqual([2, 6]);
 expect(await originalInput?.evaluate((node) => node.isConnected)).toBe(true);
 expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([]);
});


for (const denial of ["blob", "encoding"] as const) test(`BROWSER-DIRECTORY-UI-11-${denial}: local source preparation failure remains visible without changing the private editor`, async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, true, false));
 await expect(page.getByTestId("project-hub")).toBeVisible();
 await page.evaluate(() => window.__telegramRuntimeUi.setLegacyDirectoryRecovery({ projectId: "legacy", serializedProject: "source remains exact" }));
 await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Healthy private", false, "browser-registered"));
 await expect(page.getByTestId("legacy-startup-recovery")).toBeVisible();
 await page.getByTestId("legacy-startup-recovery").locator("summary").click();
 const downloads: string[] = []; page.on("download", (download) => downloads.push(download.suggestedFilename()));
 await page.evaluate((denial) => {
  if (denial === "blob") URL.createObjectURL = () => { throw new Error("Controlled local blob refusal"); };
  else TextEncoder.prototype.encode = () => { throw new RangeError("Controlled local encoding refusal"); };
 }, denial);
 await page.getByTestId("legacy-startup-recovery").getByRole("button", { name: "Сохранить исходную запись", exact: true }).click();
 await expect(page.getByTestId("legacy-startup-recovery").getByRole("alert")).toHaveText("Не удалось скачать исходную запись. Повторите попытку.");
 await expect(page.getByRole("button", { name: "Переименовать проект Healthy private", exact: true })).toBeEnabled();
 expect(downloads).toEqual([]); expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([]);
});


test("BROWSER-DIRECTORY-UI-12: all-readonly startup renders its two qualified copies and prepares only the selected export",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.mountDirectoryContract(true,false,false,false,true));await expect(page.getByRole("heading",{name:"Просмотр проектов",exact:true})).toBeVisible();expect(await page.getByRole("button",{name:/Создать|Удалить|Импортировать|Открыть проект/}).count()).toBe(0);
 const registered=page.getByRole("button",{name:/^Подготовить файл для переноса:.*хранилище для переноса/});await registered.click();await expect(page.getByRole("heading",{name:"Полный архив подготовлен",exact:true})).toBeVisible();const calls=await page.evaluate(()=>window.__telegramRuntimeUi.directoryContractCalls());expect(calls.filter(row=>row.method==="readonly-export")).toEqual([{method:"readonly-export",arguments:[{storageNamespace:"browser-registered",projectId:"same-id",revisionId:"same-revision"},"registered"]}]);expect(calls.some(row=>["openProject","export","registered-export","delete","rename"].includes(row.method))).toBe(false);
 const downloaded=page.waitForEvent("download", {timeout:5000});await page.getByRole("button",{name:"Скачать файл",exact:true}).click();await expect(downloaded).resolves.toBeDefined();expect((await downloaded).suggestedFilename()).toBe("ui-only.interiors");await page.evaluate(()=>window.__telegramRuntimeUi.abortReadonlyDirectorySource("legacy"));await expect(page.getByRole("button",{name:"Скачать файл",exact:true})).toBeVisible();await page.evaluate(()=>window.__telegramRuntimeUi.abortReadonlyDirectorySource("browser-registered"));await expect(page.getByRole("button",{name:"Скачать файл",exact:true})).toHaveCount(0);
});
test("BROWSER-DIRECTORY-UI-13: all-readonly raw source uses a distinct file and stays usable on a narrow enlarged view",async({page})=>{
 await page.setViewportSize({width:360,height:740});await page.evaluate(()=>window.__telegramRuntimeUi.mountDirectoryContract(true,false,false,false,true));await expect(page.getByRole("heading",{name:"Просмотр проектов",exact:true})).toBeVisible();await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});const sources=page.getByRole("region",{name:/^Непроверенные исходники:.*обычное хранилище/});await sources.getByRole("button",{name:"Показать записи",exact:true}).click();await sources.getByRole("button",{name:"Подготовить исходник записи 1",exact:true}).click();await expect(page.getByRole("heading",{name:"Непроверенный исходник",exact:true})).toBeVisible();const download=page.waitForEvent("download", {timeout:5000});await page.getByRole("button",{name:"Скачать файл",exact:true}).click();await expect(download).resolves.toBeDefined();expect((await download).suggestedFilename()).toBe("project.interiors-source.json");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await page.evaluate(()=>window.__telegramRuntimeUi.directoryContractCalls())).some(row=>row.method==="readonly-export")).toBe(false);
});


test("BROWSER-DIRECTORY-UI-14: healthy private authoring keeps the separate legacy backup-only section truthful",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.mountDirectoryContract(true,false,false,false,"partial"));await expect(page.getByTestId("project-hub")).toBeVisible();const supplemental=page.getByRole("region",{name:"Проекты только для выгрузки",exact:true});await expect(supplemental).toBeVisible();await expect(supplemental.getByRole("button",{name:/Открыть|Переименовать|Удалить|Импортировать/})).toHaveCount(0);expect(await supplemental.getByRole("button",{name:/^Подготовить полный архив:/}).count()).toBe(1);await expect(page.getByText("Часть проектов сейчас недоступна",{exact:true})).toHaveCount(0);await supplemental.getByRole("button",{name:/^Подготовить файл для переноса:/}).click();await expect(supplemental.getByRole("button",{name:"Скачать файл",exact:true})).toBeVisible();const exports=(await page.evaluate(()=>window.__telegramRuntimeUi.directoryContractCalls())).filter(row=>row.method==="readonly-export");expect(exports).toEqual([{method:"readonly-export",arguments:[{storageNamespace:"legacy",projectId:"same-id",revisionId:"same-revision"},"registered"]}]);await expect(page.getByRole("main")).toHaveCount(1);await supplemental.screenshot({path:test.info().outputPath("backup-only.png")});const privateCard=page.locator('[data-project-storage="browser-registered"]');await privateCard.locator("summary").click();await privateCard.getByRole("button",{name:/^Переименовать /}).click();const name=page.getByRole("textbox",{name:"Новое название проекта",exact:true});await name.fill("Здоровый черновик");await expect(supplemental).toHaveCount(0);const retained=await name.elementHandle();await page.evaluate(()=>window.__telegramRuntimeUi.updateDirectorySourceAdmission(false,undefined));expect(await name.elementHandle()).not.toBeNull();expect(await name.evaluate((element,prior)=>element===prior,retained)).toBe(true);await expect(name).toHaveValue("Здоровый черновик");
});


test("BROWSER-DIRECTORY-UI-15: two writable sources do not query or display the dormant backup-only reader",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.mountDirectoryContract(true,false,false,true,"writable"));await expect(page.getByTestId("project-hub")).toBeVisible();await expect(page.getByRole("heading",{name:"Проекты только для выгрузки",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:/^Подготовить полный архив:/})).toHaveCount(0);expect(await page.locator("[data-project-storage]").count()).toBe(2);expect((await page.evaluate(()=>window.__telegramRuntimeUi.directoryContractCalls())).some(call=>call.method==="readonly-list")).toBe(false);
});


test("BROWSER-DIRECTORY-UI-16: a corrupt record in a writable source retains explicit raw export beside healthy editable cards",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.mountDirectoryContract(true,false,false,true,"corrupt"));await expect(page.getByTestId("project-hub")).toBeVisible();const recovery=page.getByRole("region",{name:"Исходные записи для восстановления",exact:true});await expect(recovery).toBeVisible();expect(await page.locator("[data-project-storage]").count()).toBe(2);await expect(recovery.getByRole("button",{name:/^Подготовить полный архив:/})).toHaveCount(0);const legacy=recovery.getByRole("region",{name:/^Непроверенные исходники:.*обычное хранилище/});await legacy.getByRole("button",{name:"Показать записи",exact:true}).click();await legacy.getByRole("button",{name:"Подготовить исходник записи 1",exact:true}).click();await expect(recovery.getByRole("region",{name:"Подготовленный файл",exact:true}).getByText("На этом устройстве · обычное хранилище",{exact:true})).toBeVisible();const source=recovery.getByRole("region",{name:/^Непроверенные исходники:.*хранилище для переноса/});await source.getByRole("button",{name:"Показать записи",exact:true}).click();await source.getByRole("button",{name:"Подготовить исходник записи 1",exact:true}).click();await expect(recovery.getByRole("heading",{name:"Непроверенный исходник",exact:true})).toBeVisible();await expect(recovery.getByRole("region",{name:"Подготовленный файл",exact:true}).getByText("На этом устройстве · хранилище для переноса",{exact:true})).toBeVisible();const download=page.waitForEvent("download", {timeout:5000});await recovery.getByRole("button",{name:"Скачать файл",exact:true}).click();await expect(download).resolves.toBeDefined();const path=await(await download).path();if(!path)throw new Error("Missing actual local raw file");const fsName="node:fs/promises",fs=await import(fsName);expect(JSON.parse(await fs.readFile(path,"utf8"))).toMatchObject({purpose:"interiors-editor-unverified-source",projectId:"broken-private",revisionId:"broken-rev",serializedProject:"bad-private-raw"});const card=page.locator('[data-project-storage="browser-registered"]');await expect(card.getByRole("button",{name:/^Открыть /})).toBeEnabled();expect((await page.evaluate(()=>window.__telegramRuntimeUi.directoryContractCalls())).some(call=>call.method==="readonly-export")).toBe(false);
});


test("BROWSER-DIRECTORY-UI-17: browser runtime-owned navigation protection reaches the common editor without caller duplication",async({page})=>{
 await page.evaluate(()=>window.__telegramRuntimeUi.mountDirectoryContract(true,false,"runtime"));await expect(page.getByTestId("project-hub")).toBeVisible();await page.evaluate(()=>window.__telegramRuntimeUi.directoryRecoveryExit());await page.getByTestId("editor-top-bar").getByRole("button",{name:"Вернуться к проектам",exact:true}).click();const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});await expect(guard).toBeVisible();await guard.getByRole("button",{name:"Отменить правку",exact:true}).click();await expect(page.getByTestId("project-hub")).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.directoryContractCalls())).toEqual([{method:"confirmedDiscard",arguments:["Несохранённая копия"]}]);
});


// A read-only source already owns its raw recovery in the backup-only section.
// The extra recovery panel belongs only to writable sources, even in a mixed hub.
test("BROWSER-DIRECTORY-UI-18: mixed source recovery keeps each unverified record in exactly its owning section", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, false, true, "partial-corrupt"));
 await expect(page.getByTestId("project-hub")).toBeVisible();
 const backup = page.getByRole("region", { name: "Проекты только для выгрузки", exact: true });
 const recovery = page.getByRole("region", { name: "Исходные записи для восстановления", exact: true });
 await expect(backup).toBeVisible(); await expect(recovery).toBeVisible();
 await expect(backup.getByRole("region", { name: /^Непроверенные исходники:.*обычное хранилище/ })).toHaveCount(1);
 await expect(backup.getByRole("region", { name: /^Непроверенные исходники:.*хранилище для переноса/ })).toHaveCount(0);
 await expect(recovery.getByRole("region", { name: /^Непроверенные исходники:.*обычное хранилище/ })).toHaveCount(0);
 const privateSource = recovery.getByRole("region", { name: /^Непроверенные исходники:.*хранилище для переноса/ });
 await expect(privateSource).toHaveCount(1);
 await privateSource.getByRole("button", { name: "Показать записи", exact: true }).click();
 await privateSource.getByRole("button", { name: "Подготовить исходник записи 1", exact: true }).click();
 await expect(recovery.getByRole("heading", { name: "Непроверенный исходник", exact: true })).toBeVisible();
 await expect(backup.getByRole("button", { name: "Скачать файл", exact: true })).toHaveCount(0);
 await expect(page.locator('[data-project-storage="browser-registered"]').getByRole("button", { name: /^Открыть / })).toBeEnabled();
 expect((await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).some(call => call.method === "readonly-export")).toBe(false);
});


test("BROWSER-DIRECTORY-UI-19: a complete browser archive uses its legacy owner, blocks both preparation actions and releases its real download URL", async ({ page }) => {
 await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, false, false, false, true));
 await expect(page.getByRole("heading", { name: "Просмотр проектов", exact: true })).toBeVisible();
 await page.evaluate(() => {
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  const observed: { created: { url: string; mime: string; size: number }[]; revoked: string[] } = { created: [], revoked: [] };
  Reflect.set(globalThis, "__readonlyDownloadUrls", observed);
  URL.createObjectURL = value => { const url = create(value); if (value instanceof Blob) observed.created.push({ url, mime: value.type, size: value.size }); return url; };
  URL.revokeObjectURL = url => { observed.revoked.push(url); revoke(url); };
  window.__telegramRuntimeUi.pauseDirectoryReadonlyExport();
 });
 const complete = page.getByRole("button", { name: /^Подготовить полный архив:.*обычное хранилище/ });
 await expect(complete).toBeVisible(); await expect(complete).toBeEnabled(); await complete.click({ timeout: 5_000 });
 const preparations = page.getByRole("button", { name: /^Подготовить (полный архив|файл для переноса):/ });
 await expect(preparations).toHaveCount(4);
 for (const button of await preparations.all()) await expect(button).toBeDisabled();
 await expect(page.getByText("Готовим проверенный архив…", { exact: true })).toBeVisible();
 expect((await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).filter(call => call.method === "readonly-export")).toEqual([{ method: "readonly-export", arguments: [{ storageNamespace: "legacy", projectId: "same-id", revisionId: "same-revision" }, "legacy"] }]);
 await page.evaluate(() => window.__telegramRuntimeUi.releaseDirectoryReadonlyExport());
 await expect(page.getByRole("heading", { name: "Полный архив подготовлен", exact: true })).toBeVisible();
 for (const button of await preparations.all()) await expect(button).toBeEnabled();
 const received = page.waitForEvent("download", { timeout: 5_000 });
 const downloadButton = page.getByRole("button", { name: "Скачать файл", exact: true });
 await expect(downloadButton).toBeEnabled(); await downloadButton.click({ timeout: 5_000 }); await expect(received).resolves.toBeDefined();
 const download = await received, path = await download.path(); if (!path) throw new Error("No real controlled UI download");
 expect(download.suggestedFilename()).toBe("ui-only.interiors");
 const fsName = "node:fs/promises", fs = await import(fsName) as { readFile(path: string): Promise<Uint8Array> };
 expect(Array.from(await fs.readFile(path))).toEqual([1, 2, 3]);
 const created = await page.evaluate(() => (Reflect.get(globalThis, "__readonlyDownloadUrls") as { created: { url: string; mime: string; size: number }[] }).created);
 expect(created).toHaveLength(1); expect(created[0]).toMatchObject({ mime: "application/zip", size: 3 });
 await expect.poll(() => page.evaluate(() => (Reflect.get(globalThis, "__readonlyDownloadUrls") as { revoked: string[] }).revoked)).toEqual([created[0].url]);
});

test("TMA-UI-SCENE-02: 3D updates at fixed viewport size preserve the drawing buffer", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a"));
	await createRoom(page, "3D drawing buffer");
	const durableRows = await rows(page, "a");
	await page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "3D", exact: true })
		.click();
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics"))
		.toContainText(/стандартное качество|облегчённое качество/);
	const canvas = page.getByTestId("three-dimensional-canvas");
	const size = (element: HTMLCanvasElement) => ({
		backingWidth: element.width,
		backingHeight: element.height,
		logicalWidth: element.clientWidth,
		logicalHeight: element.clientHeight,
	});
	await canvas.evaluate(async (element) => {
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
		const writes: MutationRecord[] = [];
		const observer = new MutationObserver((records) => writes.push(...records));
		observer.observe(element, { attributes: true, attributeFilter: ["width", "height"] });
		Reflect.set(element, "drawingBufferAudit", { observer, writes });
	});
	const before = await canvas.evaluate(size);
	await page.getByRole("button", { name: "Показать все стены", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-cutaway"))
		.toHaveText("Все стены показаны");
	const writes = await canvas.evaluate(async (element) => {
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
		const audit = Reflect.get(element, "drawingBufferAudit") as {
			observer: MutationObserver;
			writes: MutationRecord[];
		};
		audit.observer.disconnect();
		return audit.writes.map((record) => record.attributeName);
	});
	expect(await canvas.evaluate(size)).toEqual(before);
	expect(writes).toEqual([]);
	const pixelRatio = before.backingWidth / before.logicalWidth;
	await page.setViewportSize({ width: 430, height: 844 });
	await expect.poll(async () => {
		const after = await canvas.evaluate(size);
		return after.logicalWidth !== before.logicalWidth &&
			Math.abs(after.backingWidth - Math.floor(after.logicalWidth * pixelRatio)) <= 1 &&
			Math.abs(after.backingHeight - Math.floor(after.logicalHeight * pixelRatio)) <= 1;
	}).toBe(true);
	expect(await rows(page, "a")).toEqual(durableRows);
});

test("TMA-ITEM-PALETTE: a legacy wall light has concise dimension labels and reflowing color choices", async ({ page }) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true));
	await createRoom(page, "Подсветка");
	const wall = (await currentProject(page)).level.wallSegments[0];
	if (!wall) throw new Error("Missing wall");
	await page.evaluate(id => window.__telegramRuntimeUi.addExistingWallLight(id), wall.wallSegmentId);
	await saved(page);
	await page.locator(`[data-testid="wall-segment"][data-wall-id="${wall.wallSegmentId}"]`).click({ force: true });
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	const inspector = page.getByTestId("selected-wall-inspector");
	await expect(inspector.getByText("Смещение вдоль стены, мм", { exact: true })).toBeVisible();
	await expect(inspector.getByText("Высота центра, мм", { exact: true })).toBeVisible();
	const lock = inspector.getByRole("button", { name: "Заблокировать настенный предмет", exact: true });
	const remove = inspector.getByRole("button", { name: "Удалить настенный предмет", exact: true });
	for (const [control, foreground] of [[lock, "var(--ink)"], [remove, "var(--editor-host-danger, var(--danger))"]] as const) {
		const [actual, reference] = await control.evaluate((el, ink) => {
			const probe = document.createElement("span");
			probe.style.color = ink;
			probe.style.backgroundColor = "var(--surface)";
			el.append(probe);
			const styled = getComputedStyle(el), themed = getComputedStyle(probe);
			const result = [[styled.color, styled.backgroundColor], [themed.color, themed.backgroundColor]];
			probe.remove();
			return result;
		}, foreground);
		expect(actual).toEqual(reference);
	}
	await lock.click();
	const unlock = inspector.getByRole("button", { name: "Разблокировать настенный предмет", exact: true });
	await expect(unlock).toHaveAttribute("aria-pressed", "true");
	await expect(remove).toBeDisabled();
	await unlock.click();
	await expect(remove).toBeEnabled();
	await expect(inspector.getByTestId("tma-wall-item-color")).toHaveCount(0);
	await inspector.getByRole("button", { name: "Закрыть свойства стены", exact: true }).click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	const scene = projectRectangularRoomForWebGl(await currentProject(page));
	const item = scene?.items.find((choice) => choice.assetAnchor === "wall");
	if (!scene || !item) throw new Error("Missing visible wall item");
	const canvas = page.getByTestId("three-dimensional-canvas");
	const bounds = await canvas.boundingBox();
	if (!bounds) throw new Error("Missing scene canvas");
	const [azimuthRadians, elevationRadians, distance, panXM, panZM] =
		(await page.getByTestId("three-dimensional-camera").textContent() ?? "").split(":").map(Number);
	if (azimuthRadians === undefined || elevationRadians === undefined || distance === undefined || panXM === undefined || panZM === undefined)
		throw new Error("Expected the live camera");
	const point = canvasPointForSceneItem(scene, { azimuthRadians, elevationRadians, distance, panXM, panZM }, bounds, item);
	if (!point) throw new Error("Missing wall item projection");
	await page.mouse.click(bounds.x + point.x, bounds.y + point.y);
	const control = page.getByTestId("tma-selected-item-color").getByRole("button", { name: /^Цвет/ });
	await expect(control).toBeVisible();
	const canvasBeforePalette = await canvas.boundingBox();
	await control.click();
	const palette = page.getByRole("dialog", { name: "Цвет предмета" });
	await expect(palette.getByRole("button", { pressed: true })).toHaveAccessibleName("Глубокий синий");
	expect(await palette.evaluate((dialog) => dialog.matches(":modal"))).toBe(true);
	const paletteBottomInset = () => palette.evaluate((dialog) => window.innerHeight - dialog.getBoundingClientRect().bottom);
	await expect.poll(paletteBottomInset).toBeGreaterThanOrEqual(0);
	await expect.poll(paletteBottomInset).toBeLessThanOrEqual(24);
	expect(await canvas.boundingBox()).toEqual(canvasBeforePalette);
	await palette.getByRole("button", { name: /Орех/ }).click();
	await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
	await saved(page);
	await expect(control).toHaveAccessibleName(/Орех/i);
});

test("TMA-NOV23-INSPECTOR: numeric blur saves a single field and color is chosen in 3D", async ({ page }) => {
	await selectExactChair(page, "Параметры стула");
	const inspector = page.getByTestId("selected-item-inspector");
	await inspector.getByRole("button", { name: "Развернуть панель предмета" }).click();
	const tabs = inspector.getByRole("tab");
	await expect(tabs).toHaveText(["Размеры", "До стен", "Настройки"]);
	await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
	const width = inspector.getByRole("textbox", { name: "Ширина выбранного предмета, мм" });
	const depth = inspector.getByRole("textbox", { name: "Глубина выбранного предмета, мм" });
	const original = (await currentProject(page)).assetInstances[0];
	const before = await rows(page, "a");
	await width.fill("550");
	expect(await rows(page, "a")).toEqual(before);
	await depth.focus();
	await saved(page);
	expect((await currentProject(page)).assetInstances[0]).toMatchObject({ widthMm: 550 });
	await expect(inspector.getByRole("button", { name: "Применить размеры" })).toHaveCount(0);
	await depth.fill("0");
	await width.focus();
	await expect(depth).toHaveAttribute("aria-invalid", "true");
	expect((await currentProject(page)).assetInstances[0]).toMatchObject({ depthMm: original?.depthMm });
	await width.fill("560");
	await depth.focus();
	await expect.poll(async () => (await currentProject(page)).assetInstances[0]).toHaveProperty("widthMm", 560);
	await expect(depth).toHaveValue("0");
	await depth.press("Escape");
	await expect(depth).toHaveValue(String(original?.depthMm));
	await saved(page);
	const resized = await rows(page, "a");
	await width.fill("560");
	await width.press("Enter");
	await expect(width).toHaveValue("560");
	expect(await rows(page, "a")).toEqual(resized);
	await tabs.nth(1).click();
	const left = inspector.getByRole("textbox", { name: "Слева, мм" });
	await left.focus();
	await expect(page.locator('[data-testid="item-wall-distances"][data-side="left"]')).toHaveAttribute("data-focused", "true");
	const movedDistance = String(Number(await left.inputValue()) + 50);
	const oldPosition = (await currentProject(page)).assetInstances[0];
	await left.fill(movedDistance);
	await inspector.getByRole("textbox", { name: "Справа, мм" }).focus();
	await saved(page);
	expect((await currentProject(page)).assetInstances[0]).not.toEqual(oldPosition);
	await expect(left).toHaveValue(movedDistance);
	const positioned = await rows(page, "a");
	await expect(inspector.getByRole("button", { name: /^Цвет/ })).toHaveCount(0);
	await tabs.nth(2).click();
	const deletion = inspector.getByRole("button", { name: "Удалить предмет", exact: true });
	await deletion.click();
	await page.getByRole("dialog", { name: "Удалить предмет?" }).getByRole("button", { name: "Отменить" }).click();
	await expect(deletion).toBeFocused();
	expect(await rows(page, "a")).toEqual(positioned);
	await tabs.first().click();
	await expect(width).toHaveValue("560");
	await expect(inspector.getByRole("button", { name: /^Цвет/ })).toHaveCount(0);
	await inspector.getByRole("button", { name: "Скрыть панель предмета" }).click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await page.getByRole("button", { name: /^Цвет/ }).click();
	const palette = page.getByRole("dialog", { name: "Цвет предмета" });
	await expect(palette).toBeVisible();
	await palette.getByRole("button", { name: "Орех", exact: true }).click();
	await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
	await saved(page);
	expect((await currentProject(page)).assetInstances[0]).toMatchObject({ widthMm: 560, colorVariantId: "alpha-walnut" });
});

test("TMA-PROPERTY-SHEET: furniture tabs keep the same bottom geometry and top hit layer", async ({ page }) => {
	await selectExactChair(page, "Единая геометрия параметров");
	await page.setViewportSize({ width: 360, height: 740 });
	const inspector = page.getByTestId("selected-item-inspector");
	await inspector.getByRole("button", { name: "Развернуть панель предмета" }).click();
	const shellEdges = () => inspector.evaluate((element) => {
		const { top, bottom, left, right } = element.getBoundingClientRect();
		return [top, bottom, left, right].map(Math.round);
	});
	await expect.poll(() => inspector.evaluate((element) => element.getAnimations().every(animation => animation.playState !== "running"))).toBe(true);
	const originalEdges = await shellEdges();
	for (const name of ["До стен", "Настройки", "Размеры"]) {
		await inspector.getByRole("tab", { name }).click();
		await expect(inspector).toHaveAttribute("aria-modal", "true");
		await expect.poll(shellEdges).toEqual(originalEdges);
		await expect(inspector.getByRole("button", { name: "Развернуть", exact: true })).toHaveCount(0);
		expect(await inspector.evaluate((element) => {
			const { left, top, width, height } = element.getBoundingClientRect();
			return element.parentElement === element.closest("main") &&
				[20, width / 2, width - 20].every(x =>
					element.contains(document.elementFromPoint(left + x, top + height / 2)));
		})).toBe(true);
	}
});

test("TMA-WALL-SHEET: wall properties share the fixed bottom anchor and aligned opening values", async ({ page }, info) => {
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "authoring"));
	await createRoom(page, "Шторка свойств стены");
	const wall = page.getByTestId("wall-segment").first();
	await wall.click();
	const opening = await openOpeningDetailsOnSelectedWall(page);
	await opening.getByRole("button", { name: "Подтвердить", exact: true }).click();
	await saved(page);
	await page.setViewportSize({ width: 360, height: 740 });
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	const wallSheet = page.getByTestId("selected-wall-inspector");
	await expect(wallSheet.getByRole("button", { name: "Развернуть", exact: true })).toHaveCount(0);
	await expect(wallSheet).toHaveAttribute("aria-modal", "true");
	await expect.poll(() => wallSheet.evaluate((element) => element.getAnimations().every(animation => animation.playState !== "running"))).toBe(true);
	const frame = await wallSheet.boundingBox();
	if (!frame) throw new Error("Missing wall sheet layout");
	expect(Math.abs(frame.y + frame.height - 728)).toBeLessThan(2);
	const openingWidth = wallSheet.getByTestId("wall-opening-width");
	await expect(openingWidth.getByText("Ширина дверного проёма", { exact: true })).toBeVisible();
	const label = await openingWidth.locator("dt").boundingBox();
	const value = await openingWidth.locator("dd").boundingBox();
	if (!label || !value) throw new Error("Missing opening dimension row");
	expect(value.x - label.x - label.width).toBeGreaterThanOrEqual(7);
	expect(await wallSheet.evaluate((element) => {
		const { left, top, width } = element.getBoundingClientRect();
		return element.contains(document.elementFromPoint(left + width / 2, top + 30));
	})).toBe(true);
	await page.screenshot({ path: info.outputPath("wall-properties-360.png") });
	await wallSheet.getByRole("button", { name: "Закрыть свойства стены" }).click();
	await expect(wallSheet).toBeHidden();
});

test("TMA-NOV23-COPY: a locked exact item duplicates into the current 3D view", async ({ page }) => {
	await selectExactChair(page, "Точная копия");
	const scene = page.getByRole("button", { name: "3D", exact: true });
	await scene.click();
	await page.getByRole("button", { name: /^Цвет/ }).click();
	await page.getByRole("button", { name: "Орех", exact: true }).click();
	await page.getByRole("dialog").getByRole("button", { name: "Подтвердить", exact: true }).click();
	await saved(page);
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	const angle = page.getByRole("textbox", { name: "Угол поворота выбранного предмета, градусы" });
	await angle.fill("37,5");
	await angle.press("Enter");
	await saved(page);
	const inspector = page.getByTestId("selected-item-inspector");
	await inspector.getByRole("button", { name: "Развернуть панель предмета" }).click();
	await inspector.getByRole("tab", { name: "Настройки" }).click();
	await inspector.getByRole("button", { name: "Заблокировать предмет" }).click();
	await saved(page);
	const original = (await currentProject(page)).assetInstances[0];
	expect(original).toMatchObject({ locked: true, yawMilliDeg: 37_500, colorVariantId: "alpha-walnut" });
	const before = await rows(page, "a");
	await inspector.getByRole("button", { name: "Скрыть панель предмета" }).click();
	await scene.click();
	await page.getByRole("button", { name: "Дублировать", exact: true }).click();
	await expect(scene).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("textbox", { name: "Поворот предмета в 3D, градусы" })).toHaveValue(/37[.,]5/);
	expect(await rows(page, "a")).toEqual(before);
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await clickRectangularRoomPoint(page, { x: 0.76, y: 0.66 });
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await saved(page);
	const [unchanged, duplicate] = (await currentProject(page)).assetInstances;
	expect(unchanged).toEqual(original);
	expect(duplicate).toMatchObject({ widthMm: original?.widthMm, yawMilliDeg: 37_500, colorVariantId: "alpha-walnut" });
	expect(duplicate).not.toHaveProperty("locked");
	expect(duplicate?.assetInstanceId).not.toBe(original?.assetInstanceId);
});

test("TMA-NOV23-CLEARANCE: TMA omits the pair picker and retains wall distances during placement and move", async ({ page }) => {
	await selectExactChair(page, "Зазор между предметами");
	await openEditorCatalog(page);
	await page.getByRole("dialog", { name: "Предметы интерьера" }).getByRole("button", { name: /^Стул / }).click();
	await clickRectangularRoomPoint(page, { x: 0.78, y: 0.48 });
	await expect(page.getByTestId("item-wall-distances").first()).toBeVisible();
	await expect(page.getByRole("button", { name: "Измерить до предмета", exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await saved(page);
	const [first, second] = (await currentProject(page)).assetInstances;
	if (!first || !second) throw new Error("Expected a pair of chairs");
	const source = page.locator(`[data-item-id="${first.assetInstanceId}"] [data-testid="schematic-item"]`);
	await source.click();
	await expect(page.getByRole("button", { name: "Измерить до предмета", exact: true })).toHaveCount(0);
	const base = await rows(page, "a");
	const bounds = await source.boundingBox();
	if (!bounds) throw new Error("Expected a selectable item");
	const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + 20, start.y, { steps: 4 });
	await expect(page.getByTestId("item-wall-distances").first()).toBeVisible();
	await page.mouse.up();
	await saved(page);
	await expect(page.getByRole("button", { name: "Подтвердить перемещение", exact: true })).toHaveCount(0);
	expect((await rows(page, "a")).revisions).toHaveLength(base.revisions.length + 1);
	expect((await currentProject(page)).assetInstances[0]).not.toEqual(first);
});
