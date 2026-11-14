# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rotation-dome-e2e.spec.ts >> ROTATION-DOME-05: short enlarged phone keeps cap and step buttons clear of header and camera deck
- Location: tests/browser/rotation-dome-e2e.spec.ts:346:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('three-dimensional-rotation-gizmo')
Expected: "true"
Received: "false"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('three-dimensional-rotation-gizmo')
    14 × locator resolved to <svg width="200" height="128" viewBox="0 0 200 128" data-rotation-active="false" aria-label="Полусфера поворота предмета в 3D" data-testid="three-dimensional-rotation-gizmo" class="@interiors/web-src_ui_RoomScene3d_module_css-rotationGizmo">…</svg>
       - unexpected value "false"

```

```yaml
- img "Полусфера поворота предмета в 3D"
```

# Test source

```ts
  297 | 		await cdp.detach();
  298 | 	}
  299 | 	await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
  300 | 		"нет",
  301 | 	);
  302 | 	expect(await revisions(page)).toBe(before);
  303 | });
  304 | 
  305 | test("ROTATION-DOME-04: Escape and pointer cancellation discard the draft without history", async ({
  306 | 	page,
  307 | }) => {
  308 | 	await openItem(page);
  309 | 	const before = await revisions(page);
  310 | 	const { at } = await touchPointsForDome(page);
  311 | 	const cdp = await page.context().newCDPSession(page);
  312 | 	try {
  313 | 		for (const cancel of ["escape", "pointercancel"]) {
  314 | 			await cdp.send("Input.dispatchTouchEvent", {
  315 | 				type: "touchStart",
  316 | 				touchPoints: [at(-45)],
  317 | 			});
  318 | 			await cdp.send("Input.dispatchTouchEvent", {
  319 | 				type: "touchMove",
  320 | 				touchPoints: [at(0)],
  321 | 			});
  322 | 			await expect(
  323 | 				page.getByTestId("three-dimensional-item-preview"),
  324 | 			).toContainText("поворот");
  325 | 			if (cancel === "escape") {
  326 | 				await page.keyboard.press("Escape");
  327 | 				await cdp.send("Input.dispatchTouchEvent", {
  328 | 					type: "touchEnd",
  329 | 					touchPoints: [],
  330 | 				});
  331 | 			} else
  332 | 				await cdp.send("Input.dispatchTouchEvent", {
  333 | 					type: "touchCancel",
  334 | 					touchPoints: [],
  335 | 				});
  336 | 			await expect(
  337 | 				page.getByTestId("three-dimensional-item-preview"),
  338 | 			).toHaveText("нет");
  339 | 		}
  340 | 	} finally {
  341 | 		await cdp.detach();
  342 | 	}
  343 | 	expect(await revisions(page)).toBe(before);
  344 | });
  345 | 
  346 | test("ROTATION-DOME-05: short enlarged phone keeps cap and step buttons clear of header and camera deck", async ({
  347 | 	page,
  348 | }) => {
  349 | 	await openItem(page);
  350 | 	await page.setViewportSize({ width: 360, height: 480 });
  351 | 	await page.evaluate(() => {
  352 | 		document.documentElement.style.fontSize = "200%";
  353 | 	});
  354 | 	const controls = [
  355 | 		page.getByTestId("three-dimensional-rotation-gizmo"),
  356 | 		page.getByRole("button", {
  357 | 			name: "Повернуть предмет на 45° против часовой стрелки",
  358 | 			exact: true,
  359 | 		}),
  360 | 		page.getByRole("button", {
  361 | 			name: "Повернуть предмет на 45° по часовой стрелке",
  362 | 			exact: true,
  363 | 		}),
  364 | 	];
  365 | 	await expect.poll(async () => {
  366 | 		const [header, deck, ...boxes] = await Promise.all([
  367 | 			page.getByTestId("editor-top-bar").boundingBox(),
  368 | 			page.getByTestId("three-dimensional-view-controls").boundingBox(),
  369 | 			...controls.map((control) => control.boundingBox()),
  370 | 		]);
  371 | 		return !!header && !!deck && boxes.every((box) => box !== null && box.y >= header.y + header.height && box.y + box.height <= deck.y && box.x >= 0 && box.x + box.width <= 360);
  372 | 	}).toBe(true);
  373 | 	// Raw CDP input bypasses Playwright's normal stable-element actionability.
  374 | 	// A resize can fit the camera again after the containment check has passed.
  375 | 	const stableDome = await page
  376 | 		.getByTestId("three-dimensional-rotation-gizmo")
  377 | 		.elementHandle();
  378 | 	if (!stableDome) throw new Error("Expected the visible rotation control");
  379 | 	await stableDome.waitForElementState("stable");
  380 | 	const { at } = await touchPointsForDome(page);
  381 | 	expect(await page.evaluate(
  382 | 		(point) => document.elementFromPoint(point.x, point.y)?.getAttribute("data-testid"),
  383 | 		at(75),
  384 | 	)).toBe("three-dimensional-rotation-hit-area");
  385 | 	const cdp = await page.context().newCDPSession(page);
  386 | 	try {
  387 | 		await cdp.send("Input.dispatchTouchEvent", {
  388 | 			type: "touchStart",
  389 | 			touchPoints: [at(75)],
  390 | 		});
  391 | 		await cdp.send("Input.dispatchTouchEvent", {
  392 | 			type: "touchMove",
  393 | 			touchPoints: [at(0)],
  394 | 		});
  395 | 		await expect(
  396 | 			page.getByTestId("three-dimensional-rotation-gizmo"),
> 397 | 		).toHaveAttribute("data-rotation-active", "true");
      |     ^ Error: expect(locator).toHaveAttribute(expected) failed
  398 | 		await expect.poll(async () => {
  399 | 			const [cancel, deck] = await Promise.all([
  400 | 				page.getByRole("button", { name: "Отменить поворот", exact: true }).boundingBox(),
  401 | 				page.getByTestId("three-dimensional-view-controls").boundingBox(),
  402 | 			]);
  403 | 			return !!cancel && !!deck && cancel.y + cancel.height <= deck.y;
  404 | 		}).toBe(true);
  405 | 		await page.screenshot({
  406 | 			path: test.info().outputPath("rotation-dome-short-active.png"),
  407 | 		});
  408 | 	} finally {
  409 | 		if (!page.isClosed())
  410 | 			await cdp.send("Input.dispatchTouchEvent", {
  411 | 				type: "touchCancel",
  412 | 				touchPoints: [],
  413 | 			});
  414 | 		await cdp.detach();
  415 | 	}
  416 | });
  417 | 
  418 | test("ROTATION-DOME-06: a locked selected item exposes no transform target while camera inspection remains available", async ({
  419 | 	page,
  420 | }) => {
  421 | 	await openItem(page);
  422 | 	await page.getByRole("button", { name: "План 2D", exact: true }).click();
  423 | 	await page
  424 | 		.getByRole("button", { name: "Открыть остальные действия", exact: true })
  425 | 		.click();
  426 | 	await page
  427 | 		.getByRole("button", { name: "Параметры выбранного предмета", exact: true })
  428 | 		.click();
  429 | 	await page
  430 | 		.getByRole("button", { name: "Заблокировать предмет", exact: true })
  431 | 		.click();
  432 | 	await expect(
  433 | 		page.getByTestId("editor-top-bar").getByRole("status"),
  434 | 	).toHaveText("Сохранено");
  435 | 	await page.getByRole("button", { name: "3D", exact: true }).click();
  436 | 	await expect(
  437 | 		page.getByTestId("three-dimensional-rotation-gizmo"),
  438 | 	).toHaveCount(0);
  439 | 	const before = await revisions(page);
  440 | 	const canvas = await page
  441 | 		.getByTestId("three-dimensional-canvas")
  442 | 		.boundingBox();
  443 | 	if (!canvas) throw new Error("Expected the 3D canvas");
  444 | 	const camera = await page
  445 | 		.getByTestId("three-dimensional-camera")
  446 | 		.textContent();
  447 | 	const exposed = await page
  448 | 		.getByTestId("three-dimensional-canvas")
  449 | 		.evaluate((element) => {
  450 | 			const box = element.getBoundingClientRect();
  451 | 			for (const [xRatio, yRatio] of [
  452 | 				[0.9, 0.12],
  453 | 				[0.15, 0.2],
  454 | 				[0.7, 0.3],
  455 | 			]) {
  456 | 				const point = {
  457 | 					x: box.left + box.width * xRatio,
  458 | 					y: box.top + box.height * yRatio,
  459 | 				};
  460 | 				if (document.elementFromPoint(point.x, point.y) === element)
  461 | 					return point;
  462 | 			}
  463 | 			throw new Error("Expected an exposed camera target");
  464 | 		});
  465 | 	await page.mouse.move(exposed.x, exposed.y);
  466 | 	await page.mouse.down();
  467 | 	await page.mouse.move(exposed.x - 35, exposed.y + 10, { steps: 5 });
  468 | 	await page.mouse.up();
  469 | 	await expect(page.getByTestId("three-dimensional-camera")).not.toHaveText(
  470 | 		camera ?? "",
  471 | 	);
  472 | 	expect(await revisions(page)).toBe(before);
  473 | });
  474 | 
  475 | test("ROTATION-DOME-07: explicit cancel and lost WebGL never publish a live rotation", async ({
  476 | 	page,
  477 | }) => {
  478 | 	await openItem(page);
  479 | 	const before = await revisions(page);
  480 | 	const { at } = await touchPointsForDome(page);
  481 | 	const cdp = await page.context().newCDPSession(page);
  482 | 	try {
  483 | 		await cdp.send("Input.dispatchTouchEvent", {
  484 | 			type: "touchStart",
  485 | 			touchPoints: [at(-45)],
  486 | 		});
  487 | 		await cdp.send("Input.dispatchTouchEvent", {
  488 | 			type: "touchMove",
  489 | 			touchPoints: [at(0)],
  490 | 		});
  491 | 		await page
  492 | 			.getByRole("button", { name: "Отменить поворот", exact: true })
  493 | 			.click();
  494 | 		await cdp.send("Input.dispatchTouchEvent", {
  495 | 			type: "touchEnd",
  496 | 			touchPoints: [],
  497 | 		});
```