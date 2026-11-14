# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> PROJECT-E2E-04B: a Sketchfab-style FBX ZIP carries its texture sidecars into placement and exact-repairs a corrupted custom resource
- Location: tests/browser/project-e2e.spec.ts:2446:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('status')
Expected substring: "Нужно восстановление"
Error: strict mode violation: getByRole('status') resolved to 4 elements:
    1) <p role="status">Проверяем локальные записи…</p> aka getByText('Проверяем локальные записи…')
    2) <p role="status">Покажите записи, чтобы выбрать исходные данные дл…</p> aka getByLabel('Непроверенные исходники: На этом устройстве · обычное хранилище').getByText('Покажите записи, чтобы выбрать исходные данные для отдельного файла')
    3) <p role="status">Покажите записи, чтобы выбрать исходные данные дл…</p> aka getByLabel('Непроверенные исходники: На этом устройстве · хранилище для переноса').getByText('Покажите записи, чтобы выбрать исходные данные для отдельного файла')
    4) <span role="status" aria-live="polite" class="@interiors/web-src_ui_AppShell_module_css-editorSaveState">Нужно восстановление</span> aka getByTestId('editor-top-bar').getByText('Нужно восстановление')

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('status')

```

# Page snapshot

```yaml
- main [ref=f1e3]:
  - region [ref=f1e4]:
    - generic [ref=f1e5]:
      - generic [ref=f1e6]:
        - paragraph [ref=f1e7]: Локальные данные
        - heading "Исходные записи для восстановления" [level=2] [ref=f1e8]
        - paragraph [ref=f1e9]: Непроверенные записи можно выгрузить отдельно. Доступные проекты остаются в обычном списке; исходник не является полным архивом.
      - button "Обновить список" [ref=f1e10] [cursor=pointer]
      - region "Локальные хранилища" [ref=f1e11]:
        - status [ref=f1e12]: Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явный импорт создаст текущую область после проверки файла.
        - group [ref=f1e13]:
          - generic "Старая версия не видит перенесённые проекты" [ref=f1e14] [cursor=pointer]
      - 'region "Непроверенные исходники: На этом устройстве · обычное хранилище" [ref=f1e15]':
        - paragraph [ref=f1e16]: На этом устройстве · обычное хранилище
        - complementary "Непроверенные исходники" [ref=f1e17]:
          - heading "Непроверенные исходники" [level=2] [ref=f1e18]
          - paragraph [ref=f1e19]: Исходные данные записи можно выгрузить отдельно. Это не полный backup и не восстановленный проект.
          - button "Показать записи" [ref=f1e20] [cursor=pointer]
          - status [ref=f1e21]: Покажите записи, чтобы выбрать исходные данные для отдельного файла.
      - 'region "Непроверенные исходники: На этом устройстве · хранилище для переноса" [ref=f1e22]':
        - paragraph [ref=f1e23]: На этом устройстве · хранилище для переноса
        - complementary "Непроверенные исходники" [ref=f1e24]:
          - heading "Непроверенные исходники" [level=2] [ref=f1e25]
          - paragraph [ref=f1e26]: Исходные данные записи можно выгрузить отдельно. Это не полный backup и не восстановленный проект.
          - button "Показать записи" [ref=f1e27] [cursor=pointer]
          - status [ref=f1e28]: Покажите записи, чтобы выбрать исходные данные для отдельного файла.
  - complementary [ref=f1e29]:
    - generic [ref=f1e30]:
      - heading "Проект требует восстановления" [level=2] [ref=f1e31]
      - paragraph [ref=f1e32]: Редактирование остановлено. Показана проверенная геометрия только для просмотра. Недоступные модели временно скрыты; сохранённый проект не изменён.
      - paragraph [ref=f1e33]: "Размещённых предметов: 2. Недоступных описаний моделей: 1."
      - generic [ref=f1e34]:
        - button "Восстановить исходные GLB" [ref=f1e35] [cursor=pointer]
        - button "Восстановить модели из резервной копии" [ref=f1e36] [cursor=pointer]
      - button "Удалить все недоступные модели" [ref=f1e37] [cursor=pointer]
      - button "Повторить проверку" [ref=f1e38] [cursor=pointer]
      - button "Вернуться к проектам" [ref=f1e39] [cursor=pointer]
  - generic [ref=f1e40]:
    - img "План помещения" [ref=f1e41]:
      - generic [ref=f1e43]:
        - generic [ref=f1e47] [cursor=pointer]
        - generic [ref=f1e49] [cursor=pointer]
        - generic [ref=f1e51] [cursor=pointer]
        - generic [ref=f1e53] [cursor=pointer]
      - generic:
        - 'generic "Помещение в чистоте: 4000 мм"': "4000"
        - 'generic "Помещение в чистоте: 3000 мм"': "3000"
    - group "Масштаб плана" [ref=f1e54]:
      - button "Приблизить" [ref=f1e55] [cursor=pointer]: +
      - button "Отдалить" [ref=f1e56] [cursor=pointer]: −
    - generic:
      - button "Вернуться к проектам" [ref=f1e57] [cursor=pointer]: ‹Назад
      - button "Переименовать проект FBX сразу в план" [disabled] [ref=f1e58]:
        - generic [ref=f1e59]: FBX сразу в план
      - status [ref=f1e60]: Нужно восстановление
      - button "Открыть остальные действия" [ref=f1e61] [cursor=pointer]
      - generic [ref=f1e66]:
        - group "Переключить вид редактора" [ref=f1e67]:
          - button "План 2D" [pressed] [ref=f1e69] [cursor=pointer]: План
          - button "3D" [ref=f1e70] [cursor=pointer]
        - button "Настроить размеры" [ref=f1e71] [cursor=pointer]:
          - generic [ref=f1e74]: Размеры
    - navigation "Инструменты редактора" [ref=f1e75]:
      - generic [ref=f1e76]:
        - button "Комната" [disabled] [ref=f1e77]
        - button "Рука и выбор" [pressed] [ref=f1e81] [cursor=pointer]
        - button "Стена" [disabled] [ref=f1e86]
        - button "Предметы интерьера" [disabled] [ref=f1e90]:
          - generic [ref=f1e94]: Предмет
    - group "История изменений" [ref=f1e95]:
      - button "Отменить действие" [disabled] [ref=f1e96]: ↶
      - button "Повторить действие" [disabled] [ref=f1e97]: ↷
    - button "Помещения" [ref=f1e98] [cursor=pointer]
    - button "Размеры плана" [ref=f1e101] [cursor=pointer]
    - button "Восстановить проверку" [ref=f1e104] [cursor=pointer]
```

# Test source

```ts
  2518 | 		session.page.getByRole("button", {
  2519 | 			name: "Переименовать проект FBX сразу в план",
  2520 | 		}),
  2521 | 	).toBeVisible();
  2522 | 	await expect(
  2523 | 		session.page.getByRole("button", { name: "Размеры плана" }),
  2524 | 	).toBeVisible();
  2525 | 
  2526 | 	await session.page
  2527 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  2528 | 		.click();
  2529 | 	const catalogue = session.page.getByRole("dialog", {
  2530 | 		name: "Предметы интерьера",
  2531 | 	});
  2532 | 	await revealCatalogAuthoring(catalogue);
  2533 | 	await catalogue
  2534 | 		.getByLabel("Выбрать FBX и текстуры для локального преобразования")
  2535 | 		.setInputFiles([
  2536 | 			{
  2537 | 				// Playwright's public type calls this a Buffer, but the workspace keeps
  2538 | 				// browser tests free of Node globals. Its protocol consumes toString('base64').
  2539 | 				buffer: {
  2540 | 					toString: () =>
  2541 | 						"UEsDBBQAAAAIACQ4EF2Yoe4RHQAAABsAAAAhAAAAc291cmNlL0NoYWlyV2hpdGUgKF9CbGVuZCkgMUsuZmJ4806sTEksSlRwc4pQcMrMSyyqVFBgkGJ4IcPAAABQSwMEFAAAAAgAJDgQXRvfBaUDAAAAAQAAACkAAAB0ZXh0dXJlcy9NYWluUGlsbG93XzFLLUJhc2VDb2xvci5qcGcuanBlZ2MEAFBLAwQUAAAACAAkOBBdoY4MPAMAAAABAAAAJAAAAHRleHR1cmVzL01haW5QaWxsb3dfMUstTm9ybWFsR0wuanBlZ2MCAFBLAwQUAAAACAAkOBBdN74LSwMAAAABAAAAJQAAAHRleHR1cmVzL1BpbGxvd18xSy1CYXNlQ29sb3IuanBnLmpwZWdjBgBQSwMEFAAAAAgAJDgQXZQrb9UDAAAAAQAAACMAAAB0ZXh0dXJlcy9Xb29kXzFLLUJhc2VDb2xvci5qcGcuanBlZ2MBAFBLAQIUABQAAAAIACQ4EF2Yoe4RHQAAABsAAAAhAAAAAAAAAAAAAAAAAAAAAABzb3VyY2UvQ2hhaXJXaGl0ZSAoX0JsZW5kKSAxSy5mYnhQSwECFAAUAAAACAAkOBBdG98FpQMAAAABAAAAKQAAAAAAAAAAAAAAAABcAAAAdGV4dHVyZXMvTWFpblBpbGxvd18xSy1CYXNlQ29sb3IuanBnLmpwZWdQSwECFAAUAAAACAAkOBBdoY4MPAMAAAABAAAAJAAAAAAAAAAAAAAAAACmAAAAdGV4dHVyZXMvTWFpblBpbGxvd18xSy1Ob3JtYWxHTC5qcGVnUEsBAhQAFAAAAAgAJDgQXTe+C0sDAAAAAQAAACUAAAAAAAAAAAAAAAAA6wAAAHRleHR1cmVzL1BpbGxvd18xSy1CYXNlQ29sb3IuanBnLmpwZWdQSwECFAAUAAAACAAkOBBdlCtv1QMAAAABAAAAIwAAAAAAAAAAAAAAAAAxAQAAdGV4dHVyZXMvV29vZF8xSy1CYXNlQ29sb3IuanBnLmpwZWdQSwUGAAAAAAUABQCcAQAAdQEAAAAA",
  2542 | 				} as never,
  2543 | 				mimeType: "application/zip",
  2544 | 				name: "white-armchair-fbx-1k-9mb.zip",
  2545 | 			},
  2546 | 		]);
  2547 | 
  2548 | 	await expect(
  2549 | 		catalogue.getByText("Преобразуем white-armchair-fbx-1k-9mb.zip локально…"),
  2550 | 	).toBeVisible();
  2551 | 	await expect(
  2552 | 		catalogue.getByText(
  2553 | 			"Конвертировано из FBX: source/ChairWhite (_Blend) 1K.fbx",
  2554 | 		),
  2555 | 	).toBeVisible();
  2556 | 	await expect(
  2557 | 		catalogue.getByRole("button", {
  2558 | 			name: "Добавить в «Кастомное» и разместить",
  2559 | 		}),
  2560 | 	).toBeVisible();
  2561 | 	await expect(
  2562 | 		catalogue.getByRole("button", { name: "Скачать GLB" }),
  2563 | 	).toHaveCount(0);
  2564 | 	const addAndPlace = catalogue.getByRole("button", {
  2565 | 		name: "Добавить в «Кастомное» и разместить",
  2566 | 	});
  2567 | 	const [catalogueBox, addAndPlaceBox] = await Promise.all([
  2568 | 		catalogue.boundingBox(),
  2569 | 		addAndPlace.boundingBox(),
  2570 | 	]);
  2571 | 	if (!catalogueBox || !addAndPlaceBox) {
  2572 | 		throw new Error(
  2573 | 			"Expected a visible catalogue action in the phone viewport.",
  2574 | 		);
  2575 | 	}
  2576 | 	expect(addAndPlaceBox.y).toBeGreaterThanOrEqual(catalogueBox.y);
  2577 | 	expect(addAndPlaceBox.y + addAndPlaceBox.height).toBeLessThanOrEqual(
  2578 | 		catalogueBox.y + catalogueBox.height,
  2579 | 	);
  2580 | 	await addAndPlace.click();
  2581 | 	await expect(catalogue).toHaveCount(0);
  2582 | 	await clickRectangularRoomCentre(session.page);
  2583 | 	await session.page.getByTestId("item-placement-confirm").click();
  2584 | 	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
  2585 | 
  2586 | 	await session.page
  2587 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  2588 | 		.click();
  2589 | 	await expect(
  2590 | 		catalogue.getByRole("button", { name: "Кастомное", exact: true }),
  2591 | 	).toBeVisible();
  2592 | 	const customCategoryBounds = await catalogue
  2593 | 		.getByRole("button", { name: "Кастомное", exact: true })
  2594 | 		.boundingBox();
  2595 | 	expect(customCategoryBounds?.height).toBeGreaterThanOrEqual(44);
  2596 | 	await catalogue
  2597 | 		.getByRole("button", { name: "Кастомное", exact: true })
  2598 | 		.click();
  2599 | 	await expect(catalogue.getByTestId("custom-catalog-card")).toHaveCount(1);
  2600 | 	await expect(
  2601 | 		catalogue
  2602 | 			.getByTestId("custom-catalog-card")
  2603 | 			.getByTestId("custom-glb-preview"),
  2604 | 	).toBeVisible();
  2605 | 	await catalogue.getByTestId("custom-catalog-card").click();
  2606 | 	await catalogue.getByRole("button", { name: "Разместить на плане" }).click();
  2607 | 	await clickRectangularRoomPoint(session.page, { x: 0.22, y: 0.25 });
  2608 | 	await expect(
  2609 | 		session.page.getByTestId("item-placement-preview"),
  2610 | 	).toHaveAttribute("data-placement-valid", "true");
  2611 | 	await session.page.getByTestId("item-placement-confirm").click();
  2612 | 	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");
  2613 | 
  2614 | 	const exactResourceBytes = await readFirstCustomAssetResource(session.page);
  2615 | 	await corruptFirstCustomAssetResource(session.page);
  2616 | 	await session.page.reload();
  2617 | 	await openProjectCard(session.page, "FBX сразу в план", "recovery");
> 2618 | 	await expect(session.page.getByRole("status")).toContainText(
       |                                                 ^ Error: expect(locator).toContainText(expected) failed
  2619 | 		"Нужно восстановление",
  2620 | 	);
  2621 | 	await expect(
  2622 | 		session.page.getByRole("heading", {
  2623 | 			name: "Проект требует восстановления",
  2624 | 		}),
  2625 | 	).toBeVisible();
  2626 | 	await expect(
  2627 | 		session.page.getByTestId("resource-recovery-diagnostic"),
  2628 | 	).toContainText("Редактирование остановлено");
  2629 | 	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
  2630 | 	const repairInput = session.page.getByLabel(
  2631 | 		"Выбрать исходные GLB-модели для восстановления",
  2632 | 	);
  2633 | 	await expect(repairInput).toHaveCount(1);
  2634 | 	await expect(repairInput).toHaveAttribute("multiple", "");
  2635 | 	await repairInput.evaluate((input, bytes) => {
  2636 | 		const transfer = new DataTransfer();
  2637 | 		transfer.items.add(
  2638 | 			new File([new Uint8Array(bytes)], "точная-модель.glb", {
  2639 | 				type: "model/gltf-binary",
  2640 | 			}),
  2641 | 		);
  2642 | 		(input as HTMLInputElement).files = transfer.files;
  2643 | 		input.dispatchEvent(new Event("change", { bubbles: true }));
  2644 | 	}, exactResourceBytes);
  2645 | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  2646 | 	await expect(session.page.getByRole("status")).toContainText("Сохранено");
  2647 | 	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");
  2648 | 	await session.context.close();
  2649 | });
  2650 | 
  2651 | test("CATALOG-E2E-04 / RECOVERY-E2E-01: missing exact custom resources stay blocked across catalog outage and exact repair creates no Revision", async ({
  2652 | 	page: _page,
  2653 | }, testInfo) => {
  2654 | 	const session = await openPersistentPhone(
  2655 | 		testInfo,
  2656 | 		"batch-custom-resource-recovery",
  2657 | 	);
  2658 | 	await session.page.goto("/");
  2659 | 	await createProject(session.page, "Атомарное восстановление");
  2660 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  2661 | 
  2662 | 	const placeSelectedAssetInAnyUsableRoomPoint = async () => {
  2663 | 		const [planBox, roomBox] = await Promise.all([
  2664 | 			session.page.getByTestId("plan-canvas").boundingBox(),
  2665 | 			session.page.getByTestId("room-face").boundingBox(),
  2666 | 		]);
  2667 | 		if (!planBox || !roomBox) {
  2668 | 			throw new Error(
  2669 | 				"Expected an interactive plan and its room face for custom-resource recovery.",
  2670 | 			);
  2671 | 		}
  2672 | 		const confirm = session.page.getByTestId("item-placement-confirm");
  2673 | 		const attempts: Array<readonly [number, number, string | null]> = [];
  2674 | 		for (const [horizontal, vertical] of [
  2675 | 			[0.5, 0.5],
  2676 | 			[0.2, 0.2],
  2677 | 			[0.8, 0.2],
  2678 | 			[0.2, 0.8],
  2679 | 			[0.8, 0.8],
  2680 | 		] as const) {
  2681 | 			await session.page.getByTestId("plan-canvas").click({
  2682 | 				position: {
  2683 | 					x: roomBox.x - planBox.x + roomBox.width * horizontal,
  2684 | 					y: roomBox.y - planBox.y + roomBox.height * vertical,
  2685 | 				},
  2686 | 			});
  2687 | 			await session.page.waitForTimeout(100);
  2688 | 			const disabled = await confirm.getAttribute("aria-disabled");
  2689 | 			attempts.push([horizontal, vertical, disabled]);
  2690 | 			if (disabled !== "true") {
  2691 | 				await confirm.click();
  2692 | 				return;
  2693 | 			}
  2694 | 		}
  2695 | 		throw new Error(
  2696 | 			`Expected a usable room point for the selected custom model: ${JSON.stringify({ attempts, planBox, roomBox })}`,
  2697 | 		);
  2698 | 	};
  2699 | 
  2700 | 	await session.page
  2701 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  2702 | 		.click();
  2703 | 	const firstCatalogue = session.page.getByRole("dialog", {
  2704 | 		name: "Предметы интерьера",
  2705 | 	});
  2706 | 	await revealCatalogAuthoring(firstCatalogue);
  2707 | 	await firstCatalogue
  2708 | 		.getByTestId("custom-glb-import-input")
  2709 | 		.evaluate((input, bytes) => {
  2710 | 			const transfer = new DataTransfer();
  2711 | 			transfer.items.add(
  2712 | 				new File([new Uint8Array(bytes)], "first-recovery.glb", {
  2713 | 					type: "model/gltf-binary",
  2714 | 				}),
  2715 | 			);
  2716 | 			(input as HTMLInputElement).files = transfer.files;
  2717 | 			input.dispatchEvent(new Event("change", { bubbles: true }));
  2718 | 		}, Array.from(centimetreSketchfabGlb()));
```