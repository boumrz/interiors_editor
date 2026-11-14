# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rotation-dome-e2e.spec.ts >> ROTATION-DOME-08: window blur cancels the draft without a Revision and the next rotation starts cleanly
- Location: tests/browser/rotation-dome-e2e.spec.ts:529:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByTestId('three-dimensional-item-preview')
Expected: "нет"
Received: "поворот:5.498"
Timeout:  1000ms

Call log:
  - Expect "toHaveText" with timeout 1000ms
  - waiting for getByTestId('three-dimensional-item-preview')
    12 × locator resolved to <output hidden="" data-testid="three-dimensional-item-preview">поворот:5.498</output>
       - unexpected value "поворот:5.498"

```

```yaml
- main:
  - region "3D вид комнаты":
    - img "3D вид комнаты": 3D-визуализация требует WebGL2.
    - status: 315°
    - img "Полусфера поворота предмета в 3D"
    - group "Поворот предмета":
      - button "Повернуть предмет на 45° против часовой стрелки": ↶
      - text: Поворот
      - button "Повернуть предмет на 45° по часовой стрелке": ↷
    - region "Управление видом 3D":
      - button "Предметы интерьера": Предмет
      - group "Режим стен 3D":
        - text: Режим стен 3D
        - button "Авто cutaway" [pressed]: Авто
        - button "Показать все стены": Все стены
    - status: Продолжите поворот или отмените правку.
  - button "Вернуться к проектам": ‹Назад
  - button "Переименовать проект Полусфера поворота": Полусфера поворота
  - status: Предпросмотр — не сохранено
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
  498 | 		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
  499 | 			"нет",
  500 | 		);
  501 | 		await cdp.send("Input.dispatchTouchEvent", {
  502 | 			type: "touchStart",
  503 | 			touchPoints: [at(-45)],
  504 | 		});
  505 | 		await cdp.send("Input.dispatchTouchEvent", {
  506 | 			type: "touchMove",
  507 | 			touchPoints: [at(0)],
  508 | 		});
  509 | 		await page
  510 | 			.getByTestId("three-dimensional-canvas")
  511 | 			.evaluate((canvas) =>
  512 | 				canvas.dispatchEvent(
  513 | 					new Event("webglcontextlost", { cancelable: true }),
  514 | 				),
  515 | 			);
  516 | 		await cdp.send("Input.dispatchTouchEvent", {
  517 | 			type: "touchEnd",
  518 | 			touchPoints: [],
  519 | 		});
  520 | 		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
  521 | 			"нет",
  522 | 		);
  523 | 	} finally {
  524 | 		await cdp.detach();
  525 | 	}
  526 | 	expect(await revisions(page)).toBe(before);
  527 | });
  528 | 
  529 | test("ROTATION-DOME-08: window blur cancels the draft without a Revision and the next rotation starts cleanly", async ({
  530 | 	page,
  531 | }) => {
  532 | 	await openItem(page);
  533 | 	const before = await revisions(page);
  534 | 	const { at } = await touchPointsForDome(page);
  535 | 	const cdp = await page.context().newCDPSession(page);
  536 | 	try {
  537 | 		await cdp.send("Input.dispatchTouchEvent", {
  538 | 			type: "touchStart",
  539 | 			touchPoints: [at(-45)],
  540 | 		});
  541 | 		await cdp.send("Input.dispatchTouchEvent", {
  542 | 			type: "touchMove",
  543 | 			touchPoints: [at(0)],
  544 | 		});
  545 | 		await expect(
  546 | 			page.getByTestId("three-dimensional-item-preview"),
  547 | 		).toContainText("поворот");
  548 | 		await page.evaluate(() => window.dispatchEvent(new Event("blur")));
> 549 | 		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
      |                                                                    ^ Error: expect(locator).toHaveText(expected) failed
  550 | 			"нет",
  551 | 			{ timeout: 1000 },
  552 | 		);
  553 | 		await cdp.send("Input.dispatchTouchEvent", {
  554 | 			type: "touchEnd",
  555 | 			touchPoints: [],
  556 | 		});
  557 | 		expect(await revisions(page)).toBe(before);
  558 | 		await cdp.send("Input.dispatchTouchEvent", {
  559 | 			type: "touchStart",
  560 | 			touchPoints: [at(-45)],
  561 | 		});
  562 | 		await cdp.send("Input.dispatchTouchEvent", {
  563 | 			type: "touchMove",
  564 | 			touchPoints: [at(45)],
  565 | 		});
  566 | 		await cdp.send("Input.dispatchTouchEvent", {
  567 | 			type: "touchEnd",
  568 | 			touchPoints: [],
  569 | 		});
  570 | 		await expect.poll(() => revisions(page)).toBe(before + 1);
  571 | 		await expect(
  572 | 			page.getByTestId("three-dimensional-rotation-angle"),
  573 | 		).toHaveText("270°");
  574 | 	} finally {
  575 | 		await cdp.detach();
  576 | 	}
  577 | });
  578 | 
  579 | test("ROTATION-DOME-09: placement leaves no toast over a cancellable and durable rotation", async ({ page }) => {
  580 | 	await openItem(page);
  581 | 	const toast = page.getByTestId("item-placement-durable-status");
  582 | 	await expect(toast).toBeHidden();
  583 | 	const before = await revisions(page);
  584 | 	const { at } = await touchPointsForDome(page);
  585 | 	const cdp = await page.context().newCDPSession(page);
  586 | 	let active = false;
  587 | 	try {
  588 | 		active = true;
  589 | 		await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[at(75)]});
  590 | 		await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[at(30)]});
  591 | 		await expect(page.getByTestId("three-dimensional-item-preview")).toContainText("поворот");
  592 | 		await expect(toast).toBeHidden();
  593 | 		await cdp.send("Input.dispatchTouchEvent", {type:"touchCancel",touchPoints:[]});
  594 | 		active = false;
  595 | 		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText("нет");
  596 | 		expect(await revisions(page)).toBe(before);
  597 | 		active = true;
  598 | 		await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[at(75)]});
  599 | 		await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[at(30)]});
  600 | 		await expect(page.getByTestId("three-dimensional-item-preview")).toContainText("поворот");
  601 | 		await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
  602 | 		active = false;
  603 | 		await expect.poll(() => revisions(page)).toBe(before + 1);
  604 | 		await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText("45°");
  605 | 		await expect(toast).toBeHidden();
  606 | 	} finally {
  607 | 		if (active && !page.isClosed()) await cdp.send("Input.dispatchTouchEvent", {type:"touchCancel",touchPoints:[]});
  608 | 		await cdp.detach();
  609 | 	}
  610 | });
  611 | 
```