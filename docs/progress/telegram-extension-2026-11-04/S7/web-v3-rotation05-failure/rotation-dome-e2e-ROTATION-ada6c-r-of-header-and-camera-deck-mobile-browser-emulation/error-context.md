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

Locator: getByTestId('three-dimensional-rotation-gizmo')
Expected: "true"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('three-dimensional-rotation-gizmo')

```

```yaml
- main:
  - region "3D вид комнаты":
    - img "3D вид комнаты": 3D-визуализация требует WebGL2.
    - button "Вернуть обзор 3D": Обзор
    - region "Управление видом 3D":
      - button "Предметы интерьера": Предмет
      - group "Режим стен 3D":
        - text: Режим стен 3D
        - button "Авто cutaway" [pressed]: Авто
        - button "Показать все стены": Все стены
  - button "Вернуться к проектам": ‹Назад
  - button "Переименовать проект Полусфера поворота": Полусфера поворота
  - status: Сохранено
  - button "Открыть остальные действия"
  - group "Переключить вид редактора":
    - text: Переключить вид редактора
    - button "План 2D": План
    - button "3D" [pressed]
  - navigation "Инструменты редактора"
  - group "История изменений":
    - 'button "Отменить действие: добавление предмета"': ↶
    - button "Повторить действие" [disabled]: ↷
```

# Test source

```ts
  286 | 			camera ?? "",
  287 | 		);
  288 | 		await cdp.send("Input.dispatchTouchEvent", {
  289 | 			type: "touchEnd",
  290 | 			touchPoints: [second],
  291 | 		});
  292 | 		await cdp.send("Input.dispatchTouchEvent", {
  293 | 			type: "touchEnd",
  294 | 			touchPoints: [],
  295 | 		});
  296 | 	} finally {
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
  373 | 	const { at } = await touchPointsForDome(page);
  374 | 	const cdp = await page.context().newCDPSession(page);
  375 | 	try {
  376 | 		await cdp.send("Input.dispatchTouchEvent", {
  377 | 			type: "touchStart",
  378 | 			touchPoints: [at(75)],
  379 | 		});
  380 | 		await cdp.send("Input.dispatchTouchEvent", {
  381 | 			type: "touchMove",
  382 | 			touchPoints: [at(0)],
  383 | 		});
  384 | 		await expect(
  385 | 			page.getByTestId("three-dimensional-rotation-gizmo"),
> 386 | 		).toHaveAttribute("data-rotation-active", "true");
      |     ^ Error: expect(locator).toHaveAttribute(expected) failed
  387 | 		await expect.poll(async () => {
  388 | 			const [cancel, deck] = await Promise.all([
  389 | 				page.getByRole("button", { name: "Отменить поворот", exact: true }).boundingBox(),
  390 | 				page.getByTestId("three-dimensional-view-controls").boundingBox(),
  391 | 			]);
  392 | 			return !!cancel && !!deck && cancel.y + cancel.height <= deck.y;
  393 | 		}).toBe(true);
  394 | 		await page.screenshot({
  395 | 			path: test.info().outputPath("rotation-dome-short-active.png"),
  396 | 		});
  397 | 	} finally {
  398 | 		if (!page.isClosed())
  399 | 			await cdp.send("Input.dispatchTouchEvent", {
  400 | 				type: "touchCancel",
  401 | 				touchPoints: [],
  402 | 			});
  403 | 		await cdp.detach();
  404 | 	}
  405 | });
  406 | 
  407 | test("ROTATION-DOME-06: a locked selected item exposes no transform target while camera inspection remains available", async ({
  408 | 	page,
  409 | }) => {
  410 | 	await openItem(page);
  411 | 	await page.getByRole("button", { name: "План 2D", exact: true }).click();
  412 | 	await page
  413 | 		.getByRole("button", { name: "Открыть остальные действия", exact: true })
  414 | 		.click();
  415 | 	await page
  416 | 		.getByRole("button", { name: "Параметры выбранного предмета", exact: true })
  417 | 		.click();
  418 | 	await page
  419 | 		.getByRole("button", { name: "Заблокировать предмет", exact: true })
  420 | 		.click();
  421 | 	await expect(
  422 | 		page.getByTestId("editor-top-bar").getByRole("status"),
  423 | 	).toHaveText("Сохранено");
  424 | 	await page.getByRole("button", { name: "3D", exact: true }).click();
  425 | 	await expect(
  426 | 		page.getByTestId("three-dimensional-rotation-gizmo"),
  427 | 	).toHaveCount(0);
  428 | 	const before = await revisions(page);
  429 | 	const canvas = await page
  430 | 		.getByTestId("three-dimensional-canvas")
  431 | 		.boundingBox();
  432 | 	if (!canvas) throw new Error("Expected the 3D canvas");
  433 | 	const camera = await page
  434 | 		.getByTestId("three-dimensional-camera")
  435 | 		.textContent();
  436 | 	const exposed = await page
  437 | 		.getByTestId("three-dimensional-canvas")
  438 | 		.evaluate((element) => {
  439 | 			const box = element.getBoundingClientRect();
  440 | 			for (const [xRatio, yRatio] of [
  441 | 				[0.9, 0.12],
  442 | 				[0.15, 0.2],
  443 | 				[0.7, 0.3],
  444 | 			]) {
  445 | 				const point = {
  446 | 					x: box.left + box.width * xRatio,
  447 | 					y: box.top + box.height * yRatio,
  448 | 				};
  449 | 				if (document.elementFromPoint(point.x, point.y) === element)
  450 | 					return point;
  451 | 			}
  452 | 			throw new Error("Expected an exposed camera target");
  453 | 		});
  454 | 	await page.mouse.move(exposed.x, exposed.y);
  455 | 	await page.mouse.down();
  456 | 	await page.mouse.move(exposed.x - 35, exposed.y + 10, { steps: 5 });
  457 | 	await page.mouse.up();
  458 | 	await expect(page.getByTestId("three-dimensional-camera")).not.toHaveText(
  459 | 		camera ?? "",
  460 | 	);
  461 | 	expect(await revisions(page)).toBe(before);
  462 | });
  463 | 
  464 | test("ROTATION-DOME-07: explicit cancel and lost WebGL never publish a live rotation", async ({
  465 | 	page,
  466 | }) => {
  467 | 	await openItem(page);
  468 | 	const before = await revisions(page);
  469 | 	const { at } = await touchPointsForDome(page);
  470 | 	const cdp = await page.context().newCDPSession(page);
  471 | 	try {
  472 | 		await cdp.send("Input.dispatchTouchEvent", {
  473 | 			type: "touchStart",
  474 | 			touchPoints: [at(-45)],
  475 | 		});
  476 | 		await cdp.send("Input.dispatchTouchEvent", {
  477 | 			type: "touchMove",
  478 | 			touchPoints: [at(0)],
  479 | 		});
  480 | 		await page
  481 | 			.getByRole("button", { name: "Отменить поворот", exact: true })
  482 | 			.click();
  483 | 		await cdp.send("Input.dispatchTouchEvent", {
  484 | 			type: "touchEnd",
  485 | 			touchPoints: [],
  486 | 		});
```