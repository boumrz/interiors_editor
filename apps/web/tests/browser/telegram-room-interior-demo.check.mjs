import { expect, devices, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { projectRectangularRoomForWebGl } from "../../src/adapters/renderer/rectangular-room-projection";
import { canvasPointForSceneItem } from "../../src/ui/three-dimensional-floor-interaction";
import { roomInteriorDemoName, roomInteriorDemoObservations } from "./room-interior-demo-fixture";
import { clickRectangularRoomCentre, clickRectangularRoomPoint } from "./room-geometry-fixture";
import { openEditorCatalog } from "./telegram-entry-support";

async function boot(page, baseURL, scope) {
	const origin = new URL(baseURL).origin;
	await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
	await page.goto("/");
	await page.evaluate(async value => {
		await window.__telegramRuntimeUi.initialize();
		await window.__telegramRuntimeUi.mountNavigable(value, true, "exact", "authoring", "authoring");
	}, scope);
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
}

async function currentProject(page) {
	const state = await page.evaluate(() => window.__telegramRuntimeUi.state());
	if (state.kind !== "saved" || state.project.schemaVersion !== 1) throw Error(`Expected a saved room, got ${state.kind}`);
	return state.project;
}

async function orbit(page, canvas, horizontal, vertical) {
	const bounds = await canvas.boundingBox();
	if (!bounds) throw Error("No camera viewport");
	const x = bounds.x + 28;
	const y = bounds.y + bounds.height * 0.43;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + horizontal, y + vertical, { steps: 5 });
	await page.mouse.up();
}

async function enlargeDetail(page, bounds, point) {
	const session = await page.context().newCDPSession(page);
	const x = bounds.x + bounds.width / 2;
	const y = bounds.y + bounds.height * 0.48;
	const panX = (bounds.width / 2 - point.x) * 0.32;
	const panY = (bounds.height * 0.48 - point.y) * 0.11;
	const contacts = (radius, fraction) => [
		{ id: 1, x: x - radius + panX * fraction, y: y + panY * fraction },
		{ id: 2, x: x + radius + panX * fraction, y: y + panY * fraction },
	];
	try {
		await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: contacts(40, 0) });
		for (const fraction of [0.25, 0.5, 0.75, 1]) {
			await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: contacts(40 + 34 * fraction, fraction) });
		}
		await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	} finally {
		await session.detach();
	}
}

async function captureRoom(page, output) {
	const zoom = page.getByRole("button", { name: "Приблизить", exact: true });
	await zoom.click();
	await expect(page.getByTestId("window-frame")).toHaveCount(2);
	await expect(page.getByTestId("door-swing")).toHaveCount(1);
	await page.screenshot({ path: join(output, "01-plan.png"), scale: "css" });
	const errors = [];
	page.on("pageerror", error => console.error(error.stack ?? error.message));
	page.on("console", message => {
		if (message.type() === "error" && /WebGL|Shader Error/.test(message.text())) errors.push(message.text());
	});
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
	const canvas = page.getByTestId("three-dimensional-canvas");
	await expect(canvas).toBeVisible();
	await page.screenshot({ path: join(output, "02-room-3d.png"), scale: "css" });
	const project = await currentProject(page);
	const scene = projectRectangularRoomForWebGl(project);
	const bounds = await canvas.boundingBox();
	const viewport = page.viewportSize();
	if (!scene || !bounds || !viewport) throw Error("No mobile room framing");
	for (const [presetId, name, yOffset] of [["planter", "03-planter-on-nightstand.png", -0.18], ["book", "04-book-on-shelf.png", 0.06]]) {
		if (presetId === "book") {
			await page.getByRole("button", { name: "План 2D", exact: true }).click();
			await page.getByRole("button", { name: "3D", exact: true }).click();
			await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
			await orbit(page, canvas, 144, -48);
		}
		const id = project.supportedItems?.find(item => item.catalogPreset.presetId === presetId)?.assetInstanceId;
		const box = scene.items.find(item => item.assetInstanceId === id);
		async function position() {
			const [azimuthRadians, elevationRadians, distance, panXM, panZM] = (await page.getByTestId("three-dimensional-camera").textContent())?.trim().split(":").map(Number) ?? [];
			const camera = { azimuthRadians, elevationRadians, distance, panXM: panXM ?? 0, panZM: panZM ?? 0 };
			const point = box && canvasPointForSceneItem(scene, camera, bounds, { ...box, centerYM: box.centerYM + yOffset });
			if (!point) throw Error(`Cannot frame ${presetId}`);
			return point;
		}
		await enlargeDetail(page, bounds, await position());
		const point = await position();
		const width = 176;
		const height = 170;
		const x = Math.max(0, Math.min(viewport.width - width, bounds.x + point.x - width / 2));
		const y = Math.max(0, Math.min(viewport.height - height, bounds.y + point.y - height / 2));
		await page.screenshot({ path: join(output, name), clip: { x, y, width, height }, scale: "css",
			style: '[aria-label="Вернуть обзор 3D"], [aria-label="История изменений"] { visibility: hidden; }',
		});
	}
	expect(errors).toEqual([]);
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
}

async function checkSliderAndRestore(page, output, original) {
	const arrow = page.getByTestId("door-slide-arrow");
	await expect(arrow).toBeVisible();
	const sign = await arrow.evaluate(path => {
		const parent = path.parentElement;
		const matrix = parent.getScreenCTM();
		const track = parent.querySelector('[data-testid="door-slide"]');
		const trackMiddleX = Number(track.getAttribute("x2")) / 2;
		const trackY = Number(track.getAttribute("y1"));
		const arrowX = Number(path.getAttribute("d").match(/H(-?[0-9.]+)/)[1]);
		const center = new DOMPoint(trackMiddleX, 0).matrixTransform(matrix);
		const tip = new DOMPoint(arrowX, trackY).matrixTransform(matrix);
		return { pointsSouth: tip.y > center.y, onInteriorSide: tip.x > center.x };
	});
	expect(sign).toEqual({ pointsSouth: true, onInteriorSide: true });
	await expect(page.getByTestId("door-swing")).toHaveCount(0);
	await page.screenshot({ path: join(output, "05-sliding-door.png"), scale: "css" });
	const undo = page.getByRole("button", { name: /^Отменить действие/ });
	for (let index = 0; index < 4; index++) {
		await expect(undo).toBeEnabled();
		await undo.click();
		await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	}
	await expect.poll(() => currentProject(page)).toEqual(original);
	const redo = page.getByRole("button", { name: /^Повторить действие/ });
	await expect(redo).toBeEnabled();
	await redo.click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	await expect.poll(async () => roomInteriorDemoObservations(await currentProject(page)).world
		.find(item => item.label === "Кашпо")).toMatchObject({ xMm: 4200, zMm: 3790, bottomMm: 600 });
	await undo.click();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	await expect.poll(() => currentProject(page)).toEqual(original);
	return sign;
}

test("TMA-INTERIOR-DEMO: the authored living room exports and reopens in a fresh local profile", async ({ page, browser, baseURL }, info) => {
	test.setTimeout(100_000);
	if (!baseURL) throw Error("Missing isolated TMA origin");
	const output = process.env.TMA_ROOM_PROOF_OUTPUT ?? info.outputPath("living-room");
	await mkdir(output, { recursive: true });
	await boot(page, baseURL, "a");
	const built = await page.evaluate(() => window.__telegramRuntimeUi.createRoomInteriorDemo());
	expect(built).toMatchObject({
		roomCount: 1, areaMm2: 23_100_000, floorCount: 6, floorFinish: "light-oak",
		guestNames: ["Кашпо", "Ваза", "Настольная лампа", "Книга"],
	});
	expect([...built.axisThicknesses].sort()).toEqual([100, 100, 200, 200]);
	const source = await currentProject(page);
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	await page.getByRole("button", { name: "Экспортировать проект", exact: true }).click();
	const share = page.getByRole("button", { name: "Передать файл", exact: true });
	await expect(share).toBeVisible();
	await share.click();
	const file = await page.evaluate(() => window.__telegramRuntimeUi.sharedFile(0));
	expect(file.name).toMatch(/\.interiors$/);
	expect(file.mimeType).toBe("application/zip");
	const bytes = Uint8Array.from(file.bytes);
	expect(Object.keys(unzipSync(bytes))).toContain("manifest.json");
	const interiorsPath = join(output, `${roomInteriorDemoName}.interiors`);
	await writeFile(interiorsPath, bytes);
	await page.evaluate(() => window.__telegramRuntimeUi.dispose());

	const context = await browser.newContext({ ...devices["iPhone 13"], baseURL });
	try {
		const clean = await context.newPage();
		await boot(clean, baseURL, "b");
		await expect(clean.getByRole("button", { name: `Открыть ${roomInteriorDemoName}`, exact: true })).toHaveCount(0);
		await clean.getByLabel("Импортировать проект", { exact: true }).setInputFiles(interiorsPath);
		await expect(clean.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
		const restored = await currentProject(clean);
		expect(restored.projectId).not.toBe(source.projectId);
		expect(restored.level).toEqual(source.level);
		expect(restored.assetInstances).toEqual(source.assetInstances);
		expect(restored.supportedItems).toEqual(source.supportedItems);
		await clean.reload();
		await clean.evaluate(() => window.__telegramRuntimeUi.mountNavigable("b", true, "exact", "authoring", "authoring"));
		await clean.getByRole("button", { name: `Открыть ${roomInteriorDemoName}`, exact: true }).click();
		await expect(clean.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
		expect(await currentProject(clean)).toEqual(restored);
		await captureRoom(clean, output);
		const edits = await clean.evaluate(() => window.__telegramRuntimeUi.runRoomInteriorDemoEdits());
		expect(edits.amended).toMatchObject({ floorFinish: "matte-floor-tile" });
		expect(edits.amended.openings).toContainEqual(expect.objectContaining({ kind: "Door", variant: "sliding", slideSide: "left", slideDirection: "toward-start" }));
		const planSign = await checkSliderAndRestore(clean, output, restored);
		await writeFile(join(output, "demo-results.json"), JSON.stringify({
			exportedBytes: bytes.byteLength, source: built, imported: roomInteriorDemoObservations(restored), edits, planSign, undoRestoredExactSnapshot: true, redoRestoredTurn: true,
			context: "Chromium mobile viewport; independent browser profile",
		}, null, 2));
	} finally {
		await context.close();
	}
});

test("TMA-INTERIOR-RUG: furniture stays selectable over a rug placed in 3D", async ({ page, baseURL }) => {
	if (!baseURL) throw Error("Missing isolated TMA origin");
	await boot(page, baseURL, "a");
	const projectName = "Ковёр под столиком";
	const saved = page.getByTestId("editor-top-bar").getByRole("status");
	const confirm = page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true });
	const choosePreset = async (name) => {
		await openEditorCatalog(page);
		await page.getByRole("dialog", { name: "Предметы интерьера" }).getByRole("button", { name }).click();
	};
	const tapScenePoint = async (scene, model) => {
		const [azimuthRadians, elevationRadians, distance, panXM, panZM] = (await page.getByTestId("three-dimensional-camera").textContent()).trim().split(":").map(Number);
		const bounds = await page.getByTestId("three-dimensional-canvas").boundingBox();
		if (!scene || !bounds) throw Error("Expected a camera viewport");
		const point = canvasPointForSceneItem(scene, { azimuthRadians, elevationRadians, distance, panXM, panZM }, bounds, model);
		if (!point) throw Error("Expected to reach the projected target");
		await page.touchscreen.tap(bounds.x + point.x, bounds.y + point.y);
	};
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill(projectName);
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Ширина, мм", exact: true }).fill("4800");
	await page.getByRole("textbox", { name: "Глубина, мм", exact: true }).fill("3800");
	await page.getByRole("button", { name: "Создать контур", exact: true }).click();
	await expect(saved).toHaveText("Сохранено");
	await choosePreset(/^Журнальный столик /);
	await clickRectangularRoomCentre(page);
	await confirm.click();
	await expect(saved).toHaveText("Сохранено");
	const original = await currentProject(page);
	const [table] = original.assetInstances;
	const roomScene = projectRectangularRoomForWebGl(original);
	const tableModel = roomScene?.items.find(item => item.assetInstanceId === table.assetInstanceId);
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
	await choosePreset(/^Ковёр /);
	if (!tableModel) throw Error("Expected the rendered table");
	await tapScenePoint(roomScene, { ...tableModel, centerYM: 0 });
	await expect(confirm).toBeEnabled();
	await confirm.click();
	await expect(saved).toHaveText("Сохранено");
	const withRug = await currentProject(page);
	const [unchangedTable, rug] = withRug.assetInstances;
	expect(unchangedTable).toEqual(table);
	expect(rug.catalogPreset.presetId).toBe("rug");
	expect(Math.abs(rug.xMm - table.xMm)).toBeLessThan(80);
	expect(Math.abs(rug.zMm - table.zMm)).toBeLessThan(80);
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await clickRectangularRoomCentre(page);
	await expect(page.getByRole("button", { name: "Выбрать предмет «Журнальный столик»", exact: true })).toHaveAttribute("aria-pressed", "true");
	await choosePreset(/^Торшер /);
	await clickRectangularRoomPoint(page, { x: 0.62, y: 0.65 });
	await expect(confirm).toBeEnabled();
	await confirm.click();
	await expect(saved).toHaveText("Сохранено");
	const scene = await currentProject(page);
	const [first, second, lamp] = scene.assetInstances;
	expect(first).toEqual(table);
	expect(second).toEqual(rug);
	expect(lamp.catalogPreset.presetId).toBe("floor-lamp");
	expect(Math.abs(lamp.xMm - rug.xMm)).toBeLessThan(rug.widthMm / 2);
	expect(Math.abs(lamp.zMm - rug.zMm)).toBeLessThan(rug.depthMm / 2);

	const placement = page.getByTestId("interior-supported-placement");
	const confirmDecor = placement.getByRole("button", { name: "Подтвердить", exact: true });
	const rugScene = projectRectangularRoomForWebGl(scene);
	const rugModel = rugScene?.items.find(item => item.assetInstanceId === rug.assetInstanceId);
	if (!rugModel) throw Error("Expected the rendered rug");

	await choosePreset(/^Ваза /);
	await expect(confirmDecor).toBeDisabled();
	await clickRectangularRoomPoint(page, { x: 0.62, y: 0.34 });
	await expect(placement.getByRole("status")).toHaveText("Пол · Место выбрано");
	expect(await currentProject(page)).toEqual(scene);
	await confirmDecor.click();
	await expect(saved).toHaveText("Сохранено");
	const withVase = await currentProject(page);
	const vase = withVase.assetInstances.at(-1);
	expect(vase).toMatchObject({ anchorClass: "floor", catalogPreset: { presetId: "vase" } });
	expect(Math.abs(vase.xMm - rug.xMm)).toBeLessThan(rug.widthMm / 2);
	expect(Math.abs(vase.zMm - rug.zMm)).toBeLessThan(rug.depthMm / 2);

	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
	await choosePreset(/^Книга /);
	await expect(confirmDecor).toBeDisabled();
	await tapScenePoint(rugScene, { ...rugModel, centerXM: rugModel.centerXM - 0.58, centerZM: rugModel.centerZM + 0.58 });
	await expect(placement.getByRole("status")).toHaveText("Пол · Место выбрано");
	expect(await currentProject(page)).toEqual(withVase);
	await confirmDecor.click();
	await expect(saved).toHaveText("Сохранено");
	const finished = await currentProject(page);
	const book = finished.assetInstances.at(-1);
	expect(book).toMatchObject({ anchorClass: "floor", catalogPreset: { presetId: "book" } });
	expect(Math.abs(book.xMm - rug.xMm)).toBeLessThan(rug.widthMm / 2);
	expect(Math.abs(book.zMm - rug.zMm)).toBeLessThan(rug.depthMm / 2);

	await page.reload();
	await page.evaluate(() => window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "authoring", "authoring"));
	await page.getByRole("button", { name: `Открыть ${projectName}`, exact: true }).click();
	await expect(saved).toHaveText("Сохранено");
	expect(await currentProject(page)).toEqual(finished);
});
