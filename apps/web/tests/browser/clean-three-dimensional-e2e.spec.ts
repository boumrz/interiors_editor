import { expect, type Page, test } from "@playwright/test";
import { projectRectangularRoomForWebGl } from "../../src/adapters/renderer/rectangular-room-projection";
import type { Project } from "../../src/domain/project";
import { canvasPointForFloor } from "../../src/ui/three-dimensional-floor-interaction";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function openRoom(page: Page) {
	await page.setViewportSize({ width: 393, height: 852 });
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByLabel("Название проекта").fill("Чистый 3D");
	await page.getByRole("button", { name: "Создать проект", exact: true }).click();
	await page.getByRole("button", { name: "Создать контур", exact: true }).click();
	await expect(page.getByTestId("project-durability-status")).toHaveText("Сохранено локально");
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
}

async function durableSnapshot(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<{ count: number; project: Project }>((resolve, reject) => {
				const tx = db.transaction(["projects", "revisions"], "readonly");
				const pointers = tx.objectStore("projects").getAll();
				const revisions = tx.objectStore("revisions").getAll();
				tx.oncomplete = () => {
					const current = revisions.result.find((record) => record.candidate.revision.revisionId === pointers.result[0]?.currentRevisionId);
					if (!current) return reject(new Error("Expected the current Durable Revision"));
					resolve({ count: revisions.result.length, project: current.candidate.project });
				};
				tx.onerror = () => reject(tx.error);
			});
		} finally {
			db.close();
		}
	});
}

async function floorPoint(page: Page, horizontalFraction: number, verticalFraction = 0.5) {
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	const [{ project }, cameraText, bounds] = await Promise.all([
		durableSnapshot(page),
		page.getByTestId("three-dimensional-camera").textContent(),
		page.getByTestId("three-dimensional-canvas").boundingBox(),
	]);
	const scene = projectRectangularRoomForWebGl(project);
	const floor = scene?.floors[0];
	if (!scene || !floor || !bounds || !cameraText) throw new Error("Expected the current floor projection");
	const [azimuthRadians = 0, elevationRadians = 0, distance = 0, panXM = 0, panZM = 0] = cameraText.split(":").map(Number);
	const point = canvasPointForFloor(scene, { azimuthRadians, elevationRadians, distance, panXM, panZM }, bounds, {
		xM: floor.centerXM + floor.widthM * (horizontalFraction - 0.5),
		zM: floor.centerZM + floor.depthM * (verticalFraction - 0.5),
	});
	if (!point) throw new Error("Expected a projected floor contact");
	return { x: bounds.x + point.x, y: bounds.y + point.y };
}

async function tap(page: Page, point: { x: number; y: number }) {
	expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-testid"), point)).toBe("three-dimensional-canvas");
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 501, ...point }] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	} finally {
		await cdp.detach();
	}
}

async function drag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
	expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-testid"), start)).toBe("three-dimensional-canvas");
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 502, ...start }] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 502, ...end }] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	} finally {
		await cdp.detach();
	}
}

async function expectCleanScene(page: Page) {
	const scene = page.getByRole("region", { name: "3D вид комнаты", exact: true });
	for (const id of ["three-dimensional-cutaway-notice", "three-dimensional-gesture-hint", "three-dimensional-orientation-axis"]) {
		await expect(scene.getByTestId(id)).toHaveCount(0);
	}
	for (const id of ["three-dimensional-cutaway", "three-dimensional-renderer-diagnostics", "three-dimensional-camera", "three-dimensional-custom-glb-status"]) {
		await expect(scene.getByTestId(id)).toBeHidden();
	}
	await expect(scene.getByText("Проверяем модель для 3D", { exact: true })).toHaveCount(0);
	await expect(scene.getByRole("complementary", { name: "GLB-модель предмета в 3D" })).toHaveCount(0);
}

test("CLEAN-3D-01: the clean resting scene retains cutaway controls and recoverable WebGL errors without changing a Revision", async ({ page }) => {
	await openRoom(page);
	const before = (await durableSnapshot(page)).count;
	await expectCleanScene(page);
	await page.getByRole("button", { name: "Показать все стены", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-cutaway")).toHaveText("Все стены показаны");
	await expect(page.getByRole("button", { name: "Показать все стены", exact: true })).toHaveAttribute("aria-pressed", "true");
	await expectCleanScene(page);
	const canvas = page.getByTestId("three-dimensional-canvas");
	await canvas.evaluate((element) => element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
	const scene = page.getByRole("region", { name: "3D вид комнаты", exact: true });
	await expect(scene.getByRole("status")).toContainText("Графический контекст потерян");
	await expect(scene.getByRole("button", { name: "Повторить 3D", exact: true })).toBeVisible();
	await canvas.evaluate((element) => element.dispatchEvent(new Event("webglcontextrestored")));
	await expect(scene.getByRole("status")).toHaveCount(0);
	await expectCleanScene(page);
	expect((await durableSnapshot(page)).count).toBe(before);
});

test("CLEAN-3D-02: placement keeps identity and invalid feedback while positive prompts and successful model cards stay absent", async ({ page }) => {
	await openRoom(page);
	await page.getByTestId("three-dimensional-camera-deck").getByRole("button", { name: "Предметы интерьера", exact: true }).click();
	const catalog = page.getByRole("dialog", { name: "Предметы интерьера", exact: true });
	await catalog.getByRole("button", { name: /^Кровать —/ }).click();
	const place = catalog.getByRole("button", { name: "Показать на плане", exact: true });
	await expect(place).toBeEnabled();
	await place.click();
	await expect(catalog).toHaveCount(0);
	await page.setViewportSize({ width: 360, height: 480 });
	await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
	const menu = page.getByTestId("three-dimensional-item-placement-menu");
	const confirm = menu.getByRole("button", { name: "Подтвердить размещение предмета", exact: true });
	await expect(menu).toHaveAttribute("data-placement-state", "choose-point");
	await expect(menu.getByTestId("three-dimensional-item-placement-identity")).toHaveText("Кровать");
	await expect(page.getByTestId("three-dimensional-item-placement-status")).toHaveCount(0);
	await expect(confirm).toBeDisabled();
	const before = (await durableSnapshot(page)).count;
	const invalidPoint = await floorPoint(page, 0.5, 0.12);
	await tap(page, invalidPoint);
	await expect(menu).toHaveAttribute("data-placement-state", "choose-another-point");
	await expect(page.getByTestId("three-dimensional-item-placement-status")).toHaveText("Выберите другое место");
	await expect(page.getByTestId("three-dimensional-item-placement-status")).toBeVisible();
	await expect(confirm).toBeDisabled();
	await expect.poll(async () => {
		const [cap, header, controls] = await Promise.all([page.getByTestId("three-dimensional-rotation-gizmo").boundingBox(), page.getByTestId("editor-top-bar").boundingBox(), menu.boundingBox()]);
		return !!cap && !!header && !!controls && cap.y >= header.y + header.height - 1 && cap.y + cap.height <= controls.y + 1;
	}).toBe(true);
	expect((await durableSnapshot(page)).count).toBe(before);
	await drag(page, invalidPoint, await floorPoint(page, 0.5));
	await expect(menu).toHaveAttribute("data-placement-state", "ready");
	await expect(page.getByTestId("three-dimensional-item-placement-status")).toHaveCount(0);
	await expect(page.getByTestId("three-dimensional-item-placement-preview")).toBeHidden();
	await expect(confirm).toBeEnabled();
	await menu.getByRole("button", { name: "Повернуть предмет на 45° против часовой стрелки", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-placement-rotation-angle")).toHaveText("45°");
	await menu.getByRole("button", { name: "Повернуть предмет на 45° по часовой стрелке", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-placement-rotation-angle")).toHaveText("0°");
	expect((await durableSnapshot(page)).count).toBe(before);
	await confirm.click();
	await expect(menu).toHaveCount(0);
	await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1");
	await expectCleanScene(page);
	expect((await durableSnapshot(page)).count).toBe(before + 1);
	await page.setViewportSize({ width: 393, height: 852 });
	await page.evaluate(() => { document.documentElement.style.fontSize = "100%"; });
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("schematic-item").click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-rotation-dome")).toBeVisible();
	await expect(page.getByRole("button", { name: "Повернуть предмет на 45° по часовой стрелке", exact: true })).toBeEnabled();
	await expectCleanScene(page);
});

test("CLEAN-3D-03: exhausted renderer recovery still exposes the explicit 2D fallback", async ({ page }) => {
	await openRoom(page);
	const before = (await durableSnapshot(page)).count;
	await expectCleanScene(page);
	await page.getByTestId("three-dimensional-canvas").evaluate((canvas) => {
		Object.defineProperty(canvas, "getContext", { configurable: true, value: () => null });
		canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
		canvas.dispatchEvent(new Event("webglcontextrestored"));
	});
	const fallback = page.getByRole("button", { name: "Открыть точный план 2D", exact: true });
	await expect(fallback).toBeVisible();
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("восстановление исчерпано");
	await fallback.click();
	await expect(page.getByTestId("plan-canvas")).toBeVisible();
	expect((await durableSnapshot(page)).count).toBe(before);
});

async function beginBedPlacement(page: Page) {
	await page.getByTestId("three-dimensional-camera-deck").getByRole("button", { name: "Предметы интерьера", exact: true }).click();
	const catalog = page.getByRole("dialog", { name: "Предметы интерьера", exact: true });
	await catalog.getByRole("button", { name: /^Кровать —/ }).click();
	const place = catalog.getByRole("button", { name: "Показать на плане", exact: true });
	await expect(place).toBeEnabled();
	await place.click();
	await expect(catalog).toHaveCount(0);
}

test("CLEAN-3D-04: draft rotation precedes a point, survives view changes, cancels cleanly and publishes only with placement", async ({ page }) => {
	await openRoom(page);
	await beginBedPlacement(page);
	const before = (await durableSnapshot(page)).count;
	const menu = page.getByTestId("three-dimensional-item-placement-menu");
	const angle = page.getByTestId("three-dimensional-placement-rotation-angle");
	const counterclockwise = menu.getByRole("button", { name: "Повернуть предмет на 45° против часовой стрелки", exact: true });
	await expect(angle).toHaveText("0°");
	await counterclockwise.click();
	await counterclockwise.click();
	await expect(angle).toHaveText("90°");
	await expect(page.getByTestId("three-dimensional-rotation-dome")).toHaveCount(0);
	expect((await durableSnapshot(page)).count).toBe(before);
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(angle).toHaveText("90°");
	await tap(page, await floorPoint(page, 0.5));
	await expect(menu).toHaveAttribute("data-placement-state", "ready");
	await expect(page.getByTestId("three-dimensional-rotation-dome")).toBeVisible();
	const gizmo = page.getByTestId("three-dimensional-rotation-gizmo");
	const bounds = await gizmo.boundingBox();
	if (!bounds) throw new Error("Expected the initial draft rotation dome");
	const at = (degrees: number) => ({ id: 601, x: bounds.x + 100 + Math.sin(degrees * Math.PI / 180) * 73, y: bounds.y + 100 - Math.cos(degrees * Math.PI / 180) * 73 });
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(-45)] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(0)] });
		await expect(angle).toHaveText("45°");
		await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
		await expect(angle).toHaveText("90°");
		expect((await durableSnapshot(page)).count).toBe(before);
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(-45)] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(0)] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	} finally {
		await cdp.detach();
	}
	await expect(angle).toHaveText("45°");
	expect((await durableSnapshot(page)).count).toBe(before);
	await menu.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await expect(menu).toHaveCount(0);
	await expect.poll(async () => (await durableSnapshot(page)).count).toBe(before + 1);
	const item = (await durableSnapshot(page)).project.assetInstances[0];
	expect(item && "yawStep" in item ? item.yawStep : undefined).toBe(1);
	await page.reload();
	await page.getByRole("button", { name: "Открыть Чистый 3D", exact: true }).click();
	await page.getByTestId("schematic-item").click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText("45°");
});

test("CLEAN-3D-05: a rotated draft revalidates its complete footprint and cancel keeps the Durable Revision untouched", async ({ page }) => {
	await openRoom(page);
	await beginBedPlacement(page);
	const before = (await durableSnapshot(page)).count;
	const menu = page.getByTestId("three-dimensional-item-placement-menu");
	await tap(page, await floorPoint(page, 0.5, 0.25));
	await expect(menu).toHaveAttribute("data-placement-state", "ready");
	const footprint = page.getByTestId("three-dimensional-item-selection-frame").locator("polygon");
	const unrotatedFootprint = await footprint.getAttribute("points");
	await menu.getByRole("button", { name: "Повернуть предмет на 45° против часовой стрелки", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-placement-rotation-angle")).toHaveText("45°");
	await expect(footprint).not.toHaveAttribute("points", unrotatedFootprint ?? "");
	await expect(menu).toHaveAttribute("data-placement-state", "choose-another-point");
	await expect(menu.getByTestId("three-dimensional-item-placement-status")).toBeVisible();
	await expect(menu.getByRole("button", { name: "Подтвердить размещение предмета", exact: true })).toBeDisabled();
	expect((await durableSnapshot(page)).count).toBe(before);
	await menu.getByRole("button", { name: "Отменить размещение предмета", exact: true }).click();
	await expect(menu).toHaveCount(0);
	expect((await durableSnapshot(page)).count).toBe(before);
	await beginBedPlacement(page);
	await expect(page.getByTestId("three-dimensional-placement-rotation-angle")).toHaveText("0°");
	await menu.getByRole("button", { name: "Отменить размещение предмета", exact: true }).click();
});

test("CLEAN-3D-06: context loss cancels an active placement rotation and preserves its original angle", async ({ page }) => {
	await openRoom(page);
	await beginBedPlacement(page);
	await tap(page, await floorPoint(page, 0.5));
	const before = (await durableSnapshot(page)).count;
	const angle = page.getByTestId("three-dimensional-placement-rotation-angle");
	const cap = await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();
	if (!cap) throw new Error("Expected the placement cap");
	const at = (degrees: number) => ({ id: 701, x: cap.x + 100 + Math.sin(degrees * Math.PI / 180) * 73, y: cap.y + 100 - Math.cos(degrees * Math.PI / 180) * 73 });
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(-45)] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(0)] });
		await expect(angle).toHaveText("315°");
		await page.getByTestId("three-dimensional-canvas").evaluate((canvas) => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
		await expect(angle).toHaveText("0°");
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	} finally {
		await cdp.detach();
	}
	expect((await durableSnapshot(page)).count).toBe(before);
	await page.getByTestId("three-dimensional-canvas").evaluate((canvas) => canvas.dispatchEvent(new Event("webglcontextrestored")));
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
	await expect(angle).toHaveText("0°");
	await page.getByRole("button", { name: "Отменить размещение предмета", exact: true }).click();
});

async function observeWebGl(page: Page, forceRawFallback = false) {
	await page.addInitScript((raw) => {
		const original = HTMLCanvasElement.prototype.getContext;
		Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
			configurable: true,
			value: function(this: HTMLCanvasElement, kind: string, attributes?: WebGLContextAttributes) {
				const context = Reflect.apply(original, this, [kind, attributes]) as WebGL2RenderingContext | null;
				if (kind !== "webgl2" || !context || this.dataset.observedGl) return context;
				this.dataset.observedGl = "true";
				this.dataset.arrays = "0";
				this.dataset.elements = "0";
				this.dataset.threeAttempts = "0";
				const arrays = context.drawArrays.bind(context);
				const elements = context.drawElements.bind(context);
				context.drawArrays = (...args) => { this.dataset.arrays = String(Number(this.dataset.arrays) + 1); arrays(...args); };
				context.drawElements = (...args) => { this.dataset.elements = String(Number(this.dataset.elements) + 1); elements(...args); };
				if (raw) context.getContextAttributes = () => { this.dataset.threeAttempts = String(Number(this.dataset.threeAttempts) + 1); throw new Error("Three initialization unavailable fixture"); };
				return context;
			},
		});
	}, forceRawFallback);
}

async function frameHash(page: Page) {
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	const png = await page.getByTestId("three-dimensional-canvas").screenshot({ scale: "css" });
	return page.evaluate(async (bytes) => {
		const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
		const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
		const context = surface.getContext("2d");
		if (!context) throw new Error("Expected a pixel comparison surface");
		context.drawImage(bitmap, 0, 0);
		bitmap.close();
		const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
		return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(pixels)))].map((value) => value.toString(16).padStart(2, "0")).join("");
	}, Array.from(new Uint8Array(png)));
}

async function loseAndRestoreContext(page: Page) {
	const canvas = page.getByTestId("three-dimensional-canvas");
	await canvas.evaluate((element) => {
		const context = (element as HTMLCanvasElement).getContext("webgl2");
		const extension = context?.getExtension("WEBGL_lose_context");
		if (!extension) throw new Error("Expected the real WebGL context-loss extension");
		Object.assign(element, { cleanTestContextExtension: extension });
		extension.loseContext();
	});
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("контекст потерян");
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	await canvas.evaluate((element) => (element as HTMLCanvasElement & { cleanTestContextExtension: WEBGL_lose_context }).cleanTestContextExtension.restoreContext());
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
}

test("CLEAN-3D-07: an empty room uses the same Three room pipeline before and after its first GLB", async ({ page }, testInfo) => {
	await observeWebGl(page);
	await openRoom(page);
	const canvas = page.getByTestId("three-dimensional-canvas");
	await expect.poll(async () => Number(await canvas.getAttribute("data-elements"))).toBeGreaterThan(0);
	// Physical joined walls use Three ExtrudeGeometry, which legitimately draws
	// non-indexed vertices. Engine identity and actual indexed room draws still
	// distinguish the stable Three pipeline from the procedural fallback.
	await expect(canvas).toHaveAttribute("data-engine", /^three\.js r\d+$/);
	const rendererEngine = await canvas.getAttribute("data-engine") ?? "";
	const before = (await durableSnapshot(page)).count;
	const emptyFrame = await frameHash(page);
	await canvas.screenshot({ path: testInfo.outputPath("empty-room.png"), scale: "css" });
	const cameraBeforeOrbit = await page.getByTestId("three-dimensional-camera").textContent();
	const orbitStart = await floorPoint(page, 0.5);
	await drag(page, orbitStart, { x: orbitStart.x + 34, y: orbitStart.y - 18 });
	await expect(page.getByTestId("three-dimensional-camera")).not.toHaveText(cameraBeforeOrbit ?? "");
	const bounds = await canvas.boundingBox();
	if (!bounds) throw new Error("Expected the empty room canvas");
	const cdp = await page.context().newCDPSession(page);
	try {
		const first = { id: 801, x: bounds.x + bounds.width / 2 - 30, y: bounds.y + bounds.height / 2 };
		const second = { id: 802, x: first.x + 60, y: first.y };
		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, x: first.x + 26, y: first.y + 12 }, { ...second, x: second.x + 2, y: second.y + 12 }] });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	} finally {
		await cdp.detach();
	}
	await expect(page.getByRole("button", { name: "Вернуть обзор 3D", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Вернуть обзор 3D", exact: true }).click();
	await page.getByRole("button", { name: "Показать все стены", exact: true }).click();
	await page.setViewportSize({ width: 852, height: 393 });
	await expect.poll(async () => Number(await canvas.getAttribute("data-elements"))).toBeGreaterThan(0);
	await page.setViewportSize({ width: 393, height: 852 });
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect.poll(async () => Number(await canvas.getAttribute("data-elements"))).toBeGreaterThan(0);
	await loseAndRestoreContext(page);
	await expect(canvas).toHaveAttribute("data-engine", rendererEngine);
	expect((await durableSnapshot(page)).count).toBe(before);
	await beginBedPlacement(page);
	await tap(page, await floorPoint(page, 0.5));
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1");
	await expect.poll(async () => Number(await canvas.getAttribute("data-elements"))).toBeGreaterThan(0);
	await expect(canvas).toHaveAttribute("data-engine", rendererEngine);
	await canvas.screenshot({ path: testInfo.outputPath("furnished-room.png"), scale: "css" });
	expect((await durableSnapshot(page)).count).toBe(before + 1);
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page.getByTestId("schematic-item").click();
	await page.getByRole("button", { name: "Открыть остальные действия", exact: true }).click();
	await page.getByRole("button", { name: "Параметры выбранного предмета", exact: true }).click();
	await page.getByRole("button", { name: "Удалить предмет", exact: true }).click();
	await expect.poll(async () => (await durableSnapshot(page)).project.assetInstances.length).toBe(0);
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect.poll(async () => Number(await canvas.getAttribute("data-elements"))).toBeGreaterThan(0);
	await expect(canvas).toHaveAttribute("data-engine", rendererEngine);
	expect(await frameHash(page)).toBe(emptyFrame);
	expect((await durableSnapshot(page)).count).toBe(before + 2);
});

test("CLEAN-3D-08: the raw fallback stays selected and redraws a full clean frame after foreign WebGL state", async ({ page }) => {
	await observeWebGl(page, true);
	await openRoom(page);
	const before = (await durableSnapshot(page)).count;
	const canvas = page.getByTestId("three-dimensional-canvas");
	await expect.poll(async () => Number(await canvas.getAttribute("data-arrays"))).toBeGreaterThan(0);
	const attempts = await canvas.getAttribute("data-three-attempts");
	await page.getByRole("button", { name: "Показать все стены", exact: true }).click();
	const completeFrame = await frameHash(page);
	await page.getByRole("button", { name: "Авто cutaway", exact: true }).click();
	expect(await frameHash(page)).not.toBe(completeFrame);
	await canvas.evaluate((element) => {
		const context = (element as HTMLCanvasElement).getContext("webgl2");
		if (!context) throw new Error("Expected the real fallback context");
		context.enable(context.SCISSOR_TEST);
		context.scissor(0, 0, 1, 1);
		context.depthMask(false);
		context.colorMask(false, false, false, false);
		context.enable(context.BLEND);
		context.enable(context.CULL_FACE);
		context.enable(context.STENCIL_TEST);
		context.bindFramebuffer(context.FRAMEBUFFER, context.createFramebuffer());
	});
	await page.getByRole("button", { name: "Показать все стены", exact: true }).click();
	expect(await frameHash(page)).toBe(completeFrame);
	await expect(canvas).toHaveAttribute("data-three-attempts", attempts ?? "");
	await expect(canvas).toHaveAttribute("data-elements", "0");
	await page.setViewportSize({ width: 360, height: 480 });
	await page.setViewportSize({ width: 393, height: 852 });
	await loseAndRestoreContext(page);
	expect(await frameHash(page)).toBe(completeFrame);
	expect((await durableSnapshot(page)).count).toBe(before);
});
