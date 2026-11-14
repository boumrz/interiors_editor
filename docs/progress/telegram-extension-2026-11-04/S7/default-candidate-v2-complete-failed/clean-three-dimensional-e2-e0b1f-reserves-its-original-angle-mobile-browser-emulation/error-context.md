# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: clean-three-dimensional-e2e.spec.ts >> CLEAN-3D-06: context loss cancels an active placement rotation and preserves its original angle
- Location: tests/browser/clean-three-dimensional-e2e.spec.ts:276:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByTestId('three-dimensional-placement-rotation-angle')
Expected: "0°"
Received: "315°"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for getByTestId('three-dimensional-placement-rotation-angle')
    14 × locator resolved to <output aria-live="polite" data-testid="three-dimensional-placement-rotation-angle">315°</output>
       - unexpected value "315°"

```

```yaml
- status: 315°
```

# Test source

```ts
  191 | async function beginBedPlacement(page: Page) {
  192 | 	await page.getByTestId("three-dimensional-camera-deck").getByRole("button", { name: "Предметы интерьера", exact: true }).click();
  193 | 	const catalog = page.getByRole("dialog", { name: "Предметы интерьера", exact: true });
  194 | 	await catalog.getByRole("button", { name: /^Кровать —/ }).click();
  195 | 	const place = catalog.getByRole("button", { name: "Показать на плане", exact: true });
  196 | 	await expect(place).toBeEnabled();
  197 | 	await place.click();
  198 | 	await expect(catalog).toHaveCount(0);
  199 | }
  200 | 
  201 | test("CLEAN-3D-04: draft rotation precedes a point, survives view changes, cancels cleanly and publishes only with placement", async ({ page }) => {
  202 | 	await openRoom(page);
  203 | 	await beginBedPlacement(page);
  204 | 	const before = (await durableSnapshot(page)).count;
  205 | 	const menu = page.getByTestId("three-dimensional-item-placement-menu");
  206 | 	const angle = page.getByTestId("three-dimensional-placement-rotation-angle");
  207 | 	const counterclockwise = menu.getByRole("button", { name: "Повернуть предмет на 45° против часовой стрелки", exact: true });
  208 | 	await expect(angle).toHaveText("0°");
  209 | 	await counterclockwise.click();
  210 | 	await counterclockwise.click();
  211 | 	await expect(angle).toHaveText("90°");
  212 | 	await expect(page.getByTestId("three-dimensional-rotation-dome")).toHaveCount(0);
  213 | 	expect((await durableSnapshot(page)).count).toBe(before);
  214 | 	await page.getByRole("button", { name: "План 2D", exact: true }).click();
  215 | 	await page.getByRole("button", { name: "3D", exact: true }).click();
  216 | 	await expect(angle).toHaveText("90°");
  217 | 	await tap(page, await floorPoint(page, 0.5));
  218 | 	await expect(menu).toHaveAttribute("data-placement-state", "ready");
  219 | 	await expect(page.getByTestId("three-dimensional-rotation-dome")).toBeVisible();
  220 | 	const gizmo = page.getByTestId("three-dimensional-rotation-gizmo");
  221 | 	const bounds = await gizmo.boundingBox();
  222 | 	if (!bounds) throw new Error("Expected the initial draft rotation dome");
  223 | 	const at = (degrees: number) => ({ id: 601, x: bounds.x + 100 + Math.sin(degrees * Math.PI / 180) * 73, y: bounds.y + 100 - Math.cos(degrees * Math.PI / 180) * 73 });
  224 | 	const cdp = await page.context().newCDPSession(page);
  225 | 	try {
  226 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(-45)] });
  227 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(0)] });
  228 | 		await expect(angle).toHaveText("45°");
  229 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  230 | 		await expect(angle).toHaveText("90°");
  231 | 		expect((await durableSnapshot(page)).count).toBe(before);
  232 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(-45)] });
  233 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(0)] });
  234 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  235 | 	} finally {
  236 | 		await cdp.detach();
  237 | 	}
  238 | 	await expect(angle).toHaveText("45°");
  239 | 	expect((await durableSnapshot(page)).count).toBe(before);
  240 | 	await menu.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).click();
  241 | 	await expect(menu).toHaveCount(0);
  242 | 	await expect.poll(async () => (await durableSnapshot(page)).count).toBe(before + 1);
  243 | 	const item = (await durableSnapshot(page)).project.assetInstances[0];
  244 | 	expect(item && "yawStep" in item ? item.yawStep : undefined).toBe(1);
  245 | 	await page.reload();
  246 | 	await page.getByRole("button", { name: "Открыть Чистый 3D", exact: true }).click();
  247 | 	await page.getByTestId("schematic-item").click();
  248 | 	await page.getByRole("button", { name: "3D", exact: true }).click();
  249 | 	await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText("45°");
  250 | });
  251 | 
  252 | test("CLEAN-3D-05: a rotated draft revalidates its complete footprint and cancel keeps the Durable Revision untouched", async ({ page }) => {
  253 | 	await openRoom(page);
  254 | 	await beginBedPlacement(page);
  255 | 	const before = (await durableSnapshot(page)).count;
  256 | 	const menu = page.getByTestId("three-dimensional-item-placement-menu");
  257 | 	await tap(page, await floorPoint(page, 0.5, 0.25));
  258 | 	await expect(menu).toHaveAttribute("data-placement-state", "ready");
  259 | 	const footprint = page.getByTestId("three-dimensional-item-selection-frame").locator("polygon");
  260 | 	const unrotatedFootprint = await footprint.getAttribute("points");
  261 | 	await menu.getByRole("button", { name: "Повернуть предмет на 45° против часовой стрелки", exact: true }).click();
  262 | 	await expect(page.getByTestId("three-dimensional-placement-rotation-angle")).toHaveText("45°");
  263 | 	await expect(footprint).not.toHaveAttribute("points", unrotatedFootprint ?? "");
  264 | 	await expect(menu).toHaveAttribute("data-placement-state", "choose-another-point");
  265 | 	await expect(menu.getByTestId("three-dimensional-item-placement-status")).toBeVisible();
  266 | 	await expect(menu.getByRole("button", { name: "Подтвердить размещение предмета", exact: true })).toBeDisabled();
  267 | 	expect((await durableSnapshot(page)).count).toBe(before);
  268 | 	await menu.getByRole("button", { name: "Отменить размещение предмета", exact: true }).click();
  269 | 	await expect(menu).toHaveCount(0);
  270 | 	expect((await durableSnapshot(page)).count).toBe(before);
  271 | 	await beginBedPlacement(page);
  272 | 	await expect(page.getByTestId("three-dimensional-placement-rotation-angle")).toHaveText("0°");
  273 | 	await menu.getByRole("button", { name: "Отменить размещение предмета", exact: true }).click();
  274 | });
  275 | 
  276 | test("CLEAN-3D-06: context loss cancels an active placement rotation and preserves its original angle", async ({ page }) => {
  277 | 	await openRoom(page);
  278 | 	await beginBedPlacement(page);
  279 | 	await tap(page, await floorPoint(page, 0.5));
  280 | 	const before = (await durableSnapshot(page)).count;
  281 | 	const angle = page.getByTestId("three-dimensional-placement-rotation-angle");
  282 | 	const cap = await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();
  283 | 	if (!cap) throw new Error("Expected the placement cap");
  284 | 	const at = (degrees: number) => ({ id: 701, x: cap.x + 100 + Math.sin(degrees * Math.PI / 180) * 73, y: cap.y + 100 - Math.cos(degrees * Math.PI / 180) * 73 });
  285 | 	const cdp = await page.context().newCDPSession(page);
  286 | 	try {
  287 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(-45)] });
  288 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(0)] });
  289 | 		await expect(angle).toHaveText("315°");
  290 | 		await page.getByTestId("three-dimensional-canvas").evaluate((canvas) => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
> 291 | 		await expect(angle).toHaveText("0°");
      |                       ^ Error: expect(locator).toHaveText(expected) failed
  292 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  293 | 	} finally {
  294 | 		await cdp.detach();
  295 | 	}
  296 | 	expect((await durableSnapshot(page)).count).toBe(before);
  297 | 	await page.getByTestId("three-dimensional-canvas").evaluate((canvas) => canvas.dispatchEvent(new Event("webglcontextrestored")));
  298 | 	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
  299 | 	await expect(angle).toHaveText("0°");
  300 | 	await page.getByRole("button", { name: "Отменить размещение предмета", exact: true }).click();
  301 | });
  302 | 
  303 | async function observeWebGl(page: Page, forceRawFallback = false) {
  304 | 	await page.addInitScript((raw) => {
  305 | 		const original = HTMLCanvasElement.prototype.getContext;
  306 | 		Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  307 | 			configurable: true,
  308 | 			value: function(this: HTMLCanvasElement, kind: string, attributes?: WebGLContextAttributes) {
  309 | 				const context = Reflect.apply(original, this, [kind, attributes]) as WebGL2RenderingContext | null;
  310 | 				if (kind !== "webgl2" || !context || this.dataset.observedGl) return context;
  311 | 				this.dataset.observedGl = "true";
  312 | 				this.dataset.arrays = "0";
  313 | 				this.dataset.elements = "0";
  314 | 				this.dataset.threeAttempts = "0";
  315 | 				const arrays = context.drawArrays.bind(context);
  316 | 				const elements = context.drawElements.bind(context);
  317 | 				context.drawArrays = (...args) => { this.dataset.arrays = String(Number(this.dataset.arrays) + 1); arrays(...args); };
  318 | 				context.drawElements = (...args) => { this.dataset.elements = String(Number(this.dataset.elements) + 1); elements(...args); };
  319 | 				if (raw) context.getContextAttributes = () => { this.dataset.threeAttempts = String(Number(this.dataset.threeAttempts) + 1); throw new Error("Three initialization unavailable fixture"); };
  320 | 				return context;
  321 | 			},
  322 | 		});
  323 | 	}, forceRawFallback);
  324 | }
  325 | 
  326 | async function frameHash(page: Page) {
  327 | 	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  328 | 	const png = await page.getByTestId("three-dimensional-canvas").screenshot({ scale: "css" });
  329 | 	return page.evaluate(async (bytes) => {
  330 | 		const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
  331 | 		const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
  332 | 		const context = surface.getContext("2d");
  333 | 		if (!context) throw new Error("Expected a pixel comparison surface");
  334 | 		context.drawImage(bitmap, 0, 0);
  335 | 		bitmap.close();
  336 | 		const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
  337 | 		return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(pixels)))].map((value) => value.toString(16).padStart(2, "0")).join("");
  338 | 	}, Array.from(new Uint8Array(png)));
  339 | }
  340 | 
  341 | async function loseAndRestoreContext(page: Page) {
  342 | 	const canvas = page.getByTestId("three-dimensional-canvas");
  343 | 	await canvas.evaluate((element) => {
  344 | 		const context = (element as HTMLCanvasElement).getContext("webgl2");
  345 | 		const extension = context?.getExtension("WEBGL_lose_context");
  346 | 		if (!extension) throw new Error("Expected the real WebGL context-loss extension");
  347 | 		Object.assign(element, { cleanTestContextExtension: extension });
  348 | 		extension.loseContext();
  349 | 	});
  350 | 	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("контекст потерян");
  351 | 	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  352 | 	await canvas.evaluate((element) => (element as HTMLCanvasElement & { cleanTestContextExtension: WEBGL_lose_context }).cleanTestContextExtension.restoreContext());
  353 | 	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
  354 | }
  355 | 
  356 | test("CLEAN-3D-07: an empty room uses the same Three room pipeline before and after its first GLB", async ({ page }, testInfo) => {
  357 | 	await observeWebGl(page);
  358 | 	await openRoom(page);
  359 | 	const canvas = page.getByTestId("three-dimensional-canvas");
  360 | 	await expect.poll(async () => Number(await canvas.getAttribute("data-elements"))).toBeGreaterThan(0);
  361 | 	// Physical joined walls use Three ExtrudeGeometry, which legitimately draws
  362 | 	// non-indexed vertices. Engine identity and actual indexed room draws still
  363 | 	// distinguish the stable Three pipeline from the procedural fallback.
  364 | 	await expect(canvas).toHaveAttribute("data-engine", /^three\.js r\d+$/);
  365 | 	const rendererEngine = await canvas.getAttribute("data-engine") ?? "";
  366 | 	const before = (await durableSnapshot(page)).count;
  367 | 	const emptyFrame = await frameHash(page);
  368 | 	await canvas.screenshot({ path: testInfo.outputPath("empty-room.png"), scale: "css" });
  369 | 	const cameraBeforeOrbit = await page.getByTestId("three-dimensional-camera").textContent();
  370 | 	const orbitStart = await floorPoint(page, 0.5);
  371 | 	await drag(page, orbitStart, { x: orbitStart.x + 34, y: orbitStart.y - 18 });
  372 | 	await expect(page.getByTestId("three-dimensional-camera")).not.toHaveText(cameraBeforeOrbit ?? "");
  373 | 	const bounds = await canvas.boundingBox();
  374 | 	if (!bounds) throw new Error("Expected the empty room canvas");
  375 | 	const cdp = await page.context().newCDPSession(page);
  376 | 	try {
  377 | 		const first = { id: 801, x: bounds.x + bounds.width / 2 - 30, y: bounds.y + bounds.height / 2 };
  378 | 		const second = { id: 802, x: first.x + 60, y: first.y };
  379 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
  380 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, x: first.x + 26, y: first.y + 12 }, { ...second, x: second.x + 2, y: second.y + 12 }] });
  381 | 		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  382 | 	} finally {
  383 | 		await cdp.detach();
  384 | 	}
  385 | 	await expect(page.getByRole("button", { name: "Вернуть обзор 3D", exact: true })).toBeVisible();
  386 | 	await page.getByRole("button", { name: "Вернуть обзор 3D", exact: true }).click();
  387 | 	await page.getByRole("button", { name: "Показать все стены", exact: true }).click();
  388 | 	await page.setViewportSize({ width: 852, height: 393 });
  389 | 	await expect.poll(async () => Number(await canvas.getAttribute("data-elements"))).toBeGreaterThan(0);
  390 | 	await page.setViewportSize({ width: 393, height: 852 });
  391 | 	await page.getByRole("button", { name: "План 2D", exact: true }).click();
```