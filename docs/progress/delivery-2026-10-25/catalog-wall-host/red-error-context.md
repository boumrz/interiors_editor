# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-workspace-e2e.spec.ts >> ITEM-E2E-04E: a catalog model over a legacy same-side wall panel shows a warning and requires explicit durable confirmation
- Location: tests/browser/editor-workspace-e2e.spec.ts:8566:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "ed797747-6393-470d-b635-308261875f66"
Received: "11c16699-5992-42c3-a66e-de65e641e2a5"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=f1e3]:
  - generic [ref=f1e4]:
    - img "Точный 2D план комнаты" [ref=f1e5]:
      - generic [ref=f1e7]:
        - generic [ref=f1e11] [cursor=pointer]
        - generic [ref=f1e13] [cursor=pointer]
        - generic [ref=f1e15] [cursor=pointer]
        - generic [ref=f1e17] [cursor=pointer]
        - 'generic "Настенный предмет: Настенная панель"'
        - 'generic "Комната: 4000 мм × 3000 мм, 12,00 м², Периметр: 14000 мм"'
      - generic:
        - 'generic "Помещение в чистоте: 4000 мм"': "4000"
        - 'generic "Помещение в чистоте: 3000 мм"': "3000"
        - 'generic "Стена по осям: 3100 мм"': "3100"
        - 'generic "Стена по осям: 4100 мм"': "4100"
        - 'generic "Стена по осям: 4100 мм"': "4100"
        - 'generic "Стена по осям: 3100 мм"': "3100"
        - 'generic "Общий размер наружный габарит: 4200 мм"': "4200"
        - 'generic "Общий размер наружный габарит: 3200 мм"': "3200"
      - generic:
        - generic: 1100 мм
        - generic: +Z
    - complementary "Обозначения размеров" [ref=f1e18]:
      - group [ref=f1e19]:
        - generic "Размеры в миллиметрах" [ref=f1e20] [cursor=pointer]
        - generic [ref=f1e21]:
          - generic [ref=f1e22]: Стены и цепочки — по осям
          - generic [ref=f1e23]: Помещения — в чистоте
          - generic [ref=f1e24]: Общие размеры — наружный габарит
          - generic [ref=f1e25]: Для тесных размеров увеличьте или сдвиньте план. Обозначения можно свернуть.
    - generic:
      - button "Вернуться к проектам" [ref=f1e26] [cursor=pointer]: ‹Назад
      - button "Переименовать проект Пересечение настенных панелей" [ref=f1e27] [cursor=pointer]:
        - generic [ref=f1e28]: Пересечение настенных панелей
      - status [ref=f1e29]: Сохранено
      - button "Открыть остальные действия" [ref=f1e30] [cursor=pointer]
      - group "Переключить вид редактора" [ref=f1e35]:
        - button "План 2D" [pressed] [ref=f1e37] [cursor=pointer]: План
        - button "3D" [ref=f1e38] [cursor=pointer]
    - navigation "Инструменты редактора" [ref=f1e39]:
      - generic [ref=f1e40]:
        - button "Добавить проём" [ref=f1e41] [cursor=pointer]
        - button "Рука и выбор" [pressed] [ref=f1e46] [cursor=pointer]
        - button "Свойства" [ref=f1e51] [cursor=pointer]
        - button "Удалить" [ref=f1e55] [cursor=pointer]
    - generic: 1 предмет
    - complementary "Свойства выбранной стены" [ref=f1e56]:
      - generic [ref=f1e57]:
        - strong [ref=f1e61]: Стена
        - button "Развернуть панель стены" [expanded] [ref=f1e62] [cursor=pointer]: Свернуть параметры
      - status [ref=f1e63]:
        - strong [ref=f1e64]: Размещение настенного предмета
        - generic [ref=f1e65]: "Смещение от начала стены: 1550 мм · 220 мм × 280 мм"
        - group "Сторона размещения предмета" [ref=f1e66]:
          - button "Разместить на левой стороне стены" [pressed] [ref=f1e68] [cursor=pointer]: Слева
          - button "Разместить на правой стороне стены" [ref=f1e69] [cursor=pointer]: Справа
        - button "Подтвердить размещение" [ref=f1e70] [cursor=pointer]
        - button "Отменить" [ref=f1e71] [cursor=pointer]
      - button "Развернуть стену" [disabled] [ref=f1e72]
      - button "Переместить стену жестом" [ref=f1e73] [cursor=pointer]
      - button "Разделить стену жестом" [ref=f1e74] [cursor=pointer]
      - button "Удалить стену" [ref=f1e75] [cursor=pointer]
```

# Test source

```ts
  8498 | 		false,
  8499 | 	);
  8500 | 	await session.page
  8501 | 		.getByRole("button", { name: "Подтвердить размещение", exact: true })
  8502 | 		.click();
  8503 | 	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
  8504 | 	const [source] = await durableWallItems(session.page);
  8505 | 	if (!source) throw new Error("Expected the source wall panel");
  8506 | 	await session.page
  8507 | 		.getByRole("button", { name: "Заблокировать настенный предмет" })
  8508 | 		.click();
  8509 | 	await expect
  8510 | 		.poll(async () => (await durableWallItems(session.page))[0]?.locked)
  8511 | 		.toBe(true);
  8512 | 	const revisionsBeforeDuplicate = await durableRevisionCount(session.page);
  8513 | 
  8514 | 	const duplicate = session.page.getByRole("button", {
  8515 | 		name: "Дублировать настенный предмет",
  8516 | 		exact: true,
  8517 | 	});
  8518 | 	await expect(duplicate).toBeEnabled();
  8519 | 	await duplicate.click();
  8520 | 	await expect(
  8521 | 		session.page.getByText("Размещение настенного предмета"),
  8522 | 	).toBeVisible();
  8523 | 	await expect(
  8524 | 		session.page.getByText(
  8525 | 			`Смещение от начала стены: ${source.offsetMm + source.widthMm} мм`,
  8526 | 		),
  8527 | 	).toBeVisible();
  8528 | 	expect(await durableRevisionCount(session.page)).toBe(
  8529 | 		revisionsBeforeDuplicate,
  8530 | 	);
  8531 | 	await expect
  8532 | 		.poll(() => durableWallItems(session.page))
  8533 | 		.toEqual([expect.objectContaining({ ...source, locked: true })]);
  8534 | 
  8535 | 	await session.page
  8536 | 		.getByRole("button", { name: "Подтвердить размещение" })
  8537 | 		.click();
  8538 | 	await expect
  8539 | 		.poll(() => durableRevisionCount(session.page))
  8540 | 		.toBe(revisionsBeforeDuplicate + 1);
  8541 | 	const copies = await durableWallItems(session.page);
  8542 | 	expect(copies).toHaveLength(2);
  8543 | 	expect(copies.map((item) => item.assetInstanceId)).toEqual(
  8544 | 		expect.arrayContaining([source.assetInstanceId]),
  8545 | 	);
  8546 | 	const copy = copies.find(
  8547 | 		(item) => item.assetInstanceId !== source.assetInstanceId,
  8548 | 	);
  8549 | 	expect(
  8550 | 		copies.find((item) => item.assetInstanceId === source.assetInstanceId),
  8551 | 	).toEqual(expect.objectContaining({ locked: true }));
  8552 | 	expect(copy).toEqual(
  8553 | 		expect.objectContaining({
  8554 | 			side: source.side,
  8555 | 			wallSegmentId: source.wallSegmentId,
  8556 | 			widthMm: source.widthMm,
  8557 | 		}),
  8558 | 	);
  8559 | 	expect(Math.abs((copy?.offsetMm ?? source.offsetMm) - source.offsetMm)).toBe(
  8560 | 		source.widthMm,
  8561 | 	);
  8562 | 	expect(copy?.locked).toBeUndefined();
  8563 | 	await session.context.close();
  8564 | });
  8565 | 
  8566 | test("ITEM-E2E-04E: a catalog model over a legacy same-side wall panel shows a warning and requires explicit durable confirmation", async ({
  8567 | 	page: _page,
  8568 | }, testInfo) => {
  8569 | 	const session = await openPersistentPhone(
  8570 | 		testInfo,
  8571 | 		"editor-wall-item-overlap",
  8572 | 	);
  8573 | 	await session.page.goto("/");
  8574 | 	await startNewProject(session.page, "Пересечение настенных панелей");
  8575 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  8576 | 	await chooseEditorOption(session.page, "Рука и выбор");
  8577 | 	const wallIds = await session.page.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]').evaluateAll(walls => walls.map(wall => wall.getAttribute("data-wall-id")));
  8578 | 	// Choose an explicit non-default host; a lost selection must never pass by chance.
  8579 | 	const selectedHostId = wallIds.filter((id): id is string => id !== null).sort().at(-1);
  8580 | 	if (!selectedHostId || wallIds.length < 2) throw new Error("Expected distinct wall host choices");
  8581 | 	const exteriorWall = session.page.locator(`[data-testid="wall-segment"][data-wall-id="${selectedHostId}"]`);
  8582 | 	await exteriorWall.click();
  8583 | 	await expandSelectedWallInspector(session.page);
  8584 | 	const revisionsBeforePanel = await durableRevisionCount(session.page);
  8585 | 	await loadLegacyWallPanelFixture(session.page);
  8586 | 	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
  8587 | 	await expect
  8588 | 		.poll(() => durableRevisionCount(session.page))
  8589 | 		.toBe(revisionsBeforePanel + 1);
  8590 | 
  8591 | 	const [legacyPanel] = await durableWallItems(session.page);
  8592 | 	if (!legacyPanel) throw new Error("Expected the exact legacy wall host");
  8593 | 	await choosePreloadedCatalogAsset(
  8594 | 		session.page,
  8595 | 		"Демонстрационное настенное бра",
  8596 | 		false,
  8597 | 	);
> 8598 | 	await expect.poll(() => selectedFixtureWallId(session.page)).toBe(legacyPanel.wallSegmentId);
       |                                                               ^ Error: expect(received).toBe(expected) // Object.is equality
  8599 | 	await expect(
  8600 | 		session.page.getByTestId("wall-item-placement-affected-target"),
  8601 | 	).toHaveText(
  8602 | 		"Конфликтующий предмет: «Настенная панель». Измените смещение или сторону.",
  8603 | 	);
  8604 | 	await expect(
  8605 | 		session.page.getByTestId("wall-item-placement-warning"),
  8606 | 	).toHaveText(
  8607 | 		"Предупреждение: предметы пересекаются. Подтвердите, чтобы сохранить это предупреждение.",
  8608 | 	);
  8609 | 	await expect(
  8610 | 		session.page.getByRole("button", { name: "Подтвердить размещение" }),
  8611 | 	).toBeEnabled();
  8612 | 	await session.page
  8613 | 		.getByRole("button", { name: "Подтвердить размещение" })
  8614 | 		.click();
  8615 | 	await expect
  8616 | 		.poll(() => durableRevisionCount(session.page))
  8617 | 		.toBe(revisionsBeforePanel + 2);
  8618 | 	await expect.poll(() => durableWallItems(session.page)).toHaveLength(2);
  8619 | 
  8620 | 	await session.context.close();
  8621 | });
  8622 | 
  8623 | test("ITEM-E2E-04F: duplicating a catalog wall model does not start an impossible preview", async ({
  8624 | 	page: _page,
  8625 | }, testInfo) => {
  8626 | 	const session = await openPersistentPhone(
  8627 | 		testInfo,
  8628 | 		"editor-wall-item-safe-duplicate",
  8629 | 	);
  8630 | 	await session.page.goto("/");
  8631 | 	await startNewProject(session.page, "Безопасная копия настенной панели");
  8632 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  8633 | 	await chooseEditorOption(session.page, "Рука и выбор");
  8634 | 	const exteriorWall = session.page
  8635 | 		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
  8636 | 		.first();
  8637 | 	await exteriorWall.click();
  8638 | 	await expandSelectedWallInspector(session.page);
  8639 | 	await choosePreloadedCatalogAsset(
  8640 | 		session.page,
  8641 | 		"Демонстрационное настенное бра",
  8642 | 		false,
  8643 | 	);
  8644 | 	await session.page
  8645 | 		.getByRole("button", { name: "Подтвердить размещение", exact: true })
  8646 | 		.click();
  8647 | 	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
  8648 | 	const [source] = await durableWallItems(session.page);
  8649 | 	if (!source) throw new Error("Expected source wall panel");
  8650 | 
  8651 | 	const sourceOffset = session.page.getByLabel(
  8652 | 		"Смещение настенного предмета «Демонстрационное настенное бра», мм",
  8653 | 	);
  8654 | 	await sourceOffset.fill(String(source.widthMm));
  8655 | 	await sourceOffset.blur();
  8656 | 	await expect
  8657 | 		.poll(async () => (await durableWallItems(session.page))[0]?.offsetMm)
  8658 | 		.toBe(source.widthMm);
  8659 | 
  8660 | 	await choosePreloadedCatalogAsset(
  8661 | 		session.page,
  8662 | 		"Демонстрационное настенное бра",
  8663 | 		false,
  8664 | 	);
  8665 | 	await session.page
  8666 | 		.getByRole("button", { name: "Подтвердить размещение", exact: true })
  8667 | 		.click();
  8668 | 	await expect.poll(() => durableWallItems(session.page)).toHaveLength(2);
  8669 | 	const wallItemOffsets = session.page.getByLabel(
  8670 | 		"Смещение настенного предмета «Демонстрационное настенное бра», мм",
  8671 | 	);
  8672 | 	await wallItemOffsets.nth(1).fill(String(source.widthMm * 2));
  8673 | 	await wallItemOffsets.nth(1).blur();
  8674 | 	await expect
  8675 | 		.poll(async () => (await durableWallItems(session.page))[1]?.offsetMm)
  8676 | 		.toBe(source.widthMm * 2);
  8677 | 	const revisionsBeforeDuplicate = await durableRevisionCount(session.page);
  8678 | 
  8679 | 	await session.page
  8680 | 		.getByRole("button", {
  8681 | 			name: "Дублировать настенный предмет",
  8682 | 			exact: true,
  8683 | 		})
  8684 | 		.first()
  8685 | 		.click();
  8686 | 	await expect(
  8687 | 		session.page.getByText(
  8688 | 			"На этой стене нет места для безопасной копии предмета.",
  8689 | 		),
  8690 | 	).toBeVisible();
  8691 | 	await expect(
  8692 | 		session.page.getByText("Размещение настенного предмета"),
  8693 | 	).toHaveCount(0);
  8694 | 	expect(await durableRevisionCount(session.page)).toBe(
  8695 | 		revisionsBeforeDuplicate,
  8696 | 	);
  8697 | 	await expect
  8698 | 		.poll(() => durableWallItems(session.page))
```