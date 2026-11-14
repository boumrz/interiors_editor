# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-creation-refinements-e2e.spec.ts >> CREATION-06: rejected room resizing cannot consume an armed Wall tool when history later publishes another revision
- Location: tests/browser/editor-creation-refinements-e2e.spec.ts:423:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Стена', exact: true })
    - locator resolved to <button type="button" aria-label="Стена" aria-pressed="false" class="@interiors/web-src_ui_AppShell_module_css-dockAction @interiors/web-src_ui_AppShell_module_css-wallDockAction">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="@interiors/web-src_ui_EditorLeaveGuard_module_css-overlay">…</div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="@interiors/web-src_ui_EditorLeaveGuard_module_css-overlay">…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    55 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="@interiors/web-src_ui_EditorLeaveGuard_module_css-overlay">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e4]:
      - img "План помещения" [ref=e5]:
        - generic [ref=e7]:
          - generic [ref=e11] [cursor=pointer]
          - generic [ref=e13] [cursor=pointer]
          - generic [ref=e15] [cursor=pointer]
          - generic [ref=e17] [cursor=pointer]
        - generic:
          - 'generic "Помещение в чистоте: 4000 мм"': "4000"
          - 'generic "Помещение в чистоте: 3000 мм"': "3000"
      - group "Масштаб плана" [ref=e18]:
        - button "Приблизить" [ref=e19] [cursor=pointer]: +
        - button "Отдалить" [ref=e20] [cursor=pointer]: −
      - generic:
        - button "Вернуться к проектам" [ref=e21] [cursor=pointer]: ‹Назад
        - button "Переименовать проект Режим после создания" [ref=e22] [cursor=pointer]:
          - generic [ref=e23]: Режим после создания
        - status [ref=e24]: Предпросмотр — не сохранено
        - button "Открыть остальные действия" [ref=e25] [cursor=pointer]
        - generic [ref=e30]:
          - group "Переключить вид редактора" [ref=e31]:
            - button "План 2D" [pressed] [ref=e33] [cursor=pointer]: План
            - button "3D" [ref=e34] [cursor=pointer]
          - button "Настроить размеры" [ref=e35] [cursor=pointer]:
            - generic [ref=e38]: Размеры
      - navigation "Инструменты редактора" [ref=e39]:
        - generic [ref=e40]:
          - button "Комната" [ref=e41] [cursor=pointer]
          - button "Рука и выбор" [pressed] [ref=e45] [cursor=pointer]
          - button "Стена" [ref=e50] [cursor=pointer]
          - button "Предметы интерьера" [ref=e54] [cursor=pointer]:
            - generic [ref=e58]: Предмет
      - group "История изменений" [ref=e59]:
        - 'button "Отменить действие: изменение плана" [ref=e60] [cursor=pointer]': ↶
        - button "Повторить действие" [disabled] [ref=e61]: ↷
      - button "Помещения" [ref=e62] [cursor=pointer]
      - complementary "Точные размеры плана" [ref=e65]:
        - generic [ref=e67]:
          - heading "Размеры плана" [level=2] [ref=e68]
          - button "Скрыть размеры плана" [ref=e69] [cursor=pointer]: ×
        - generic [ref=e70]:
          - generic [ref=e71]:
            - generic [ref=e72]:
              - generic [ref=e73]: Ширина, мм
              - textbox "Ширина, мм" [invalid] [ref=e74]: "0"
            - generic [ref=e75]:
              - generic [ref=e76]: Глубина, мм
              - textbox "Глубина, мм" [invalid] [ref=e77]: "3000"
            - generic [ref=e78]:
              - generic [ref=e79]: Высота, мм
              - textbox "Высота, мм" [invalid] [ref=e80]: "2600"
          - alert [ref=e81]: Введите целые положительные миллиметры.
          - button "Применить размеры" [ref=e82] [cursor=pointer]
        - generic [ref=e83]:
          - generic [ref=e84]:
            - term [ref=e85]: Площадь
            - definition [ref=e86]: 12,00 м²
          - generic [ref=e87]:
            - term [ref=e88]: Высота
            - definition [ref=e89]: 2600 мм
          - generic [ref=e90]:
            - term [ref=e91]: Периметр
            - definition [ref=e92]: 14000 мм
      - button "Размеры плана" [expanded] [ref=e93] [cursor=pointer]
  - alertdialog "Несохранённая правка" [ref=e97]:
    - heading "Продолжить правку?" [level=2] [ref=e98]
    - paragraph [ref=e99]: Правка ещё не сохранена. Продолжите работу или явно отмените её.
    - generic [ref=e100]:
      - button "Продолжить" [active] [ref=e101] [cursor=pointer]
      - button "Отменить правку" [ref=e102] [cursor=pointer]
```

# Test source

```ts
  343 | 		name: "Создать макетный предмет",
  344 | 		exact: true,
  345 | 	});
  346 | 	await composer.getByLabel("Название макетного предмета").fill("Один стол");
  347 | 	await composer.getByLabel("Ширина макетного предмета, мм").fill("800");
  348 | 	await composer.getByLabel("Глубина макетного предмета, мм").fill("500");
  349 | 	await composer
  350 | 		.getByRole("button", { name: "Начать размещение", exact: true })
  351 | 		.click();
  352 | 	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
  353 | 		"data-active-tool",
  354 | 		"item",
  355 | 	);
  356 | 	const face = await page.getByTestId("room-face").boundingBox();
  357 | 	if (!face) throw new Error("Expected the room for furniture placement");
  358 | 	await page.mouse.click(face.x + face.width / 2, face.y + face.height / 2);
  359 | 	await expect(page.getByTestId("item-placement-confirm")).toBeEnabled();
  360 | 	await page.getByTestId("item-placement-confirm").click();
  361 | 	await expect(page.getByTestId("schematic-item")).toHaveCount(1);
  362 | 	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
  363 | 		"data-active-tool",
  364 | 		"select",
  365 | 	);
  366 | 	await expect(page.getByTestId("item-placement-action-dock")).toHaveCount(0);
  367 | 	await expect
  368 | 		.poll(async () => (await snapshot(page)).revisions)
  369 | 		.toBe(before.revisions + 1);
  370 | 	const durable = await snapshot(page);
  371 | 	await page.mouse.click(face.x + face.width / 4, face.y + face.height / 4);
  372 | 	await expect(page.getByTestId("item-placement-preview")).toHaveCount(0);
  373 | 	expect(await snapshot(page)).toEqual(durable);
  374 | });
  375 | 
  376 | async function undoFromCanvas(page: Page) {
  377 | 	const undo = page.getByRole("button", {
  378 | 		name: /^Отменить (действие|создание|изменение)/,
  379 | 	});
  380 | 	await expect(undo).toBeVisible();
  381 | 	await undo.click();
  382 | 	await expect(
  383 | 		page.getByTestId("editor-top-bar").getByRole("status"),
  384 | 	).toHaveText("Сохранено");
  385 | }
  386 | 
  387 | async function beginPlaceholder(page: Page) {
  388 | 	await page
  389 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  390 | 		.click();
  391 | 	const catalog = page.getByRole("dialog", {
  392 | 		name: "Предметы интерьера",
  393 | 		exact: true,
  394 | 	});
  395 | 	await catalog
  396 | 		.getByTestId("catalog-authoring")
  397 | 		.getByText("Импорт модели", { exact: true })
  398 | 		.click();
  399 | 	await catalog
  400 | 		.getByRole("button", { name: "Создать макетный предмет", exact: true })
  401 | 		.click();
  402 | 	const composer = catalog.getByRole("form", {
  403 | 		name: "Создать макетный предмет",
  404 | 		exact: true,
  405 | 	});
  406 | 	await composer
  407 | 		.getByLabel("Название макетного предмета")
  408 | 		.fill("Несохранённый стол");
  409 | 	await composer.getByLabel("Ширина макетного предмета, мм").fill("800");
  410 | 	await composer.getByLabel("Глубина макетного предмета, мм").fill("500");
  411 | 	await composer
  412 | 		.getByRole("button", { name: "Начать размещение", exact: true })
  413 | 		.click();
  414 | }
  415 | 
  416 | async function chooseRoomCentre(page: Page) {
  417 | 	const face = await page.getByTestId("room-face").boundingBox();
  418 | 	if (!face) throw new Error("Expected the current usable room");
  419 | 	await page.mouse.click(face.x + face.width / 2, face.y + face.height / 2);
  420 | 	await expect(page.getByTestId("item-placement-confirm")).toBeEnabled();
  421 | }
  422 | 
  423 | test("CREATION-06: rejected room resizing cannot consume an armed Wall tool when history later publishes another revision", async ({
  424 | 	page,
  425 | }) => {
  426 | 	await createRoom(page);
  427 | 	const before = await snapshot(page);
  428 | 	await page
  429 | 		.getByRole("button", { name: "Размеры плана", exact: true })
  430 | 		.click();
  431 | 	const sheet = page.getByTestId("plan-dimensions-sheet");
  432 | 	await sheet.getByLabel("Ширина, мм", { exact: true }).fill("0");
  433 | 	await sheet
  434 | 		.getByRole("button", { name: "Применить размеры", exact: true })
  435 | 		.click();
  436 | 	await expect(sheet.getByRole("alert")).toContainText(
  437 | 		"Введите целые положительные миллиметры",
  438 | 	);
  439 | 	expect(await snapshot(page)).toEqual(before);
  440 | 	await sheet
  441 | 		.getByRole("button", { name: "Скрыть размеры плана", exact: true })
  442 | 		.click();
> 443 | 	await page.getByRole("button", { name: "Стена", exact: true }).click();
      |                                                                 ^ Error: locator.click: Test timeout of 30000ms exceeded.
  444 | 	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
  445 | 		"data-active-tool",
  446 | 		"wall",
  447 | 	);
  448 | 	await undoFromCanvas(page);
  449 | 	await expect(page.getByTestId("wall-segment")).toHaveCount(0);
  450 | 	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
  451 | 		"data-active-tool",
  452 | 		"wall",
  453 | 	);
  454 | 	expect((await snapshot(page)).revisions).toBe(before.revisions);
  455 | });
  456 | 
  457 | test("CREATION-07: an accepted floor publication failure consumes the placement surface while exact recovery and one retry remain available", async ({
  458 | 	page,
  459 | }) => {
  460 | 	await createRoom(page);
  461 | 	await beginPlaceholder(page);
  462 | 	await chooseRoomCentre(page);
  463 | 	const before = await snapshot(page);
  464 | 	await page.evaluate(() => {
  465 | 		const original = IDBObjectStore.prototype.put;
  466 | 		IDBObjectStore.prototype.put = function (...args) {
  467 | 			if (this.name === "revisions") {
  468 | 				IDBObjectStore.prototype.put = original;
  469 | 				throw new DOMException("Floor creation quota", "QuotaExceededError");
  470 | 			}
  471 | 			return original.apply(this, args);
  472 | 		};
  473 | 	});
  474 | 	await page.getByTestId("item-placement-confirm").click();
  475 | 	const retry = page.getByRole("button", {
  476 | 		name: "Повторить сохранение",
  477 | 		exact: true,
  478 | 	});
  479 | 	await expect(retry).toBeVisible();
  480 | 	await expect(page.getByTestId("item-placement-action-dock")).toHaveCount(0);
  481 | 	await expect(page.getByTestId("item-placement-preview")).toHaveCount(0);
  482 | 	await expect(
  483 | 		page.getByRole("button", {
  484 | 			name: "Отменить размещение предмета",
  485 | 			exact: true,
  486 | 		}),
  487 | 	).toHaveCount(0);
  488 | 	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
  489 | 		"data-active-tool",
  490 | 		"select",
  491 | 	);
  492 | 	await expect(
  493 | 		page.getByTestId("editor-top-bar").getByRole("status"),
  494 | 	).not.toHaveText("Сохранено");
  495 | 	expect(await snapshot(page)).toEqual(before);
  496 | 	const downloaded = page.waitForEvent("download");
  497 | 	await page
  498 | 		.getByRole("button", { name: "Скачать несохранённую правку", exact: true })
  499 | 		.click();
  500 | 	const stream = await (await downloaded).createReadStream();
  501 | 	if (!stream)
  502 | 		throw new Error("Expected the exact pending floor recovery file");
  503 | 	const decoder = new TextDecoder();
  504 | 	let text = "";
  505 | 	for await (const chunk of stream as AsyncIterable<Uint8Array>)
  506 | 		text += decoder.decode(chunk, { stream: true });
  507 | 	text += decoder.decode();
  508 | 	const recovery = JSON.parse(text) as {
  509 | 		format: string;
  510 | 		durability: string;
  511 | 		candidate: PublicationCandidate;
  512 | 	};
  513 | 	expect(recovery.format).toBe("interiors-recovery-draft");
  514 | 	expect(recovery.durability).toBe("unpublished");
  515 | 	expect(recovery.candidate.project.assetInstances).toHaveLength(1);
  516 | 	expect(recovery.candidate.project.assetInstances[0]?.label).toBe(
  517 | 		"Несохранённый стол",
  518 | 	);
  519 | 	expect(recovery.candidate.revision.revisionId).not.toBe(before.revisionId);
  520 | 	expect(JSON.parse(recovery.candidate.revision.serializedProject)).toEqual(
  521 | 		recovery.candidate.project,
  522 | 	);
  523 | 	expect(await snapshot(page)).toEqual(before);
  524 | 	await retry.click();
  525 | 	await expect
  526 | 		.poll(async () => (await snapshot(page)).revisions)
  527 | 		.toBe(before.revisions + 1);
  528 | 	const saved = await snapshot(page);
  529 | 	expect(saved.revisionId).toBe(recovery.candidate.revision.revisionId);
  530 | 	expect(saved.project).toEqual(recovery.candidate.project);
  531 | 	await expect(page.getByTestId("schematic-item")).toHaveCount(1);
  532 | 	await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
  533 | 		"data-active-tool",
  534 | 		"select",
  535 | 	);
  536 | 	await expect(retry).toHaveCount(0);
  537 | });
  538 | 
  539 | test("CREATION-08: failure before GLB pinning retains a cancellable user draft and cannot arm a later history publication", async ({
  540 | 	page,
  541 | }) => {
  542 | 	await createRoom(page);
  543 | 	const before = await snapshot(page);
```