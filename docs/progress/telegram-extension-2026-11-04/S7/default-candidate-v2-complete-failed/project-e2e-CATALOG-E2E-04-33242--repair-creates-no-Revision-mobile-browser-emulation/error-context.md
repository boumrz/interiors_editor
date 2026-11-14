# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> CATALOG-E2E-04 / RECOVERY-E2E-01: missing exact custom resources stay blocked across catalog outage and exact repair creates no Revision
- Location: tests/browser/project-e2e.spec.ts:2651:1

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
      - paragraph [ref=f1e33]: "Размещённых предметов: 2. Недоступных описаний моделей: 2."
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
      - button "Переименовать проект Атомарное восстановление" [disabled] [ref=f1e58]:
        - generic [ref=f1e59]: Атомарное восстановление
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
  2719 | 	await expect(firstCatalogue.getByTestId("custom-glb-preview")).toBeVisible();
  2720 | 	await firstCatalogue.getByLabel("Ширина, мм").fill("500");
  2721 | 	await firstCatalogue.getByLabel("Глубина, мм").fill("500");
  2722 | 	await firstCatalogue.getByLabel("Высота, мм").fill("500");
  2723 | 	await firstCatalogue
  2724 | 		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
  2725 | 		.click();
  2726 | 	await clickRectangularRoomCentre(session.page);
  2727 | 	await session.page.getByTestId("item-placement-confirm").click();
  2728 | 	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
  2729 | 
  2730 | 	await session.page
  2731 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  2732 | 		.click();
  2733 | 	const secondCatalogue = session.page.getByRole("dialog", {
  2734 | 		name: "Предметы интерьера",
  2735 | 	});
  2736 | 	await revealCatalogAuthoring(secondCatalogue);
  2737 | 	await secondCatalogue
  2738 | 		.getByRole("button", { name: "Другой файл", exact: true })
  2739 | 		.click();
  2740 | 	await secondCatalogue
  2741 | 		.getByTestId("custom-glb-import-input")
  2742 | 		.evaluate((input, bytes) => {
  2743 | 			const transfer = new DataTransfer();
  2744 | 			transfer.items.add(
  2745 | 				new File([new Uint8Array(bytes)], "second-recovery.glb", {
  2746 | 					type: "model/gltf-binary",
  2747 | 				}),
  2748 | 			);
  2749 | 			(input as HTMLInputElement).files = transfer.files;
  2750 | 			input.dispatchEvent(new Event("change", { bubbles: true }));
  2751 | 		}, Array.from(alternateCentimetreSketchfabGlb()));
  2752 | 	await expect(
  2753 | 		secondCatalogue
  2754 | 			.getByRole("region", { name: "Импорт своей GLB-модели" })
  2755 | 			.getByTestId("custom-glb-preview"),
  2756 | 	).toBeVisible();
  2757 | 	await secondCatalogue.getByLabel("Ширина, мм").fill("500");
  2758 | 	await secondCatalogue.getByLabel("Глубина, мм").fill("500");
  2759 | 	await secondCatalogue.getByLabel("Высота, мм").fill("500");
  2760 | 	await secondCatalogue
  2761 | 		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
  2762 | 		.click();
  2763 | 	await placeSelectedAssetInAnyUsableRoomPoint();
  2764 | 	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");
  2765 | 
  2766 | 	const revisionBeforeRecovery = await currentProjectRevisionId(session.page);
  2767 | 	const revisionCountBeforeRecovery = await durableRevisionCount(session.page);
  2768 | 	const exactBytes = await readAllCustomAssetResources(session.page);
  2769 | 	expect(exactBytes).toHaveLength(2);
  2770 | 	await deleteAllCustomAssetResources(session.page);
  2771 | 	await session.page.reload();
  2772 | 	await openProjectCard(session.page, "Атомарное восстановление", "recovery");
> 2773 | 	await expect(session.page.getByRole("status")).toContainText(
       |                                                 ^ Error: expect(locator).toContainText(expected) failed
  2774 | 		"Нужно восстановление",
  2775 | 	);
  2776 | 	await expect(
  2777 | 		session.page.getByRole("heading", {
  2778 | 			name: "Проект требует восстановления",
  2779 | 		}),
  2780 | 	).toBeVisible();
  2781 | 	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
  2782 | 	const recoveryScreen = session.page.getByTestId("project-recovery-screen");
  2783 | 	await expect(recoveryScreen).toContainText("Размещённых предметов: 2");
  2784 | 	await expect(
  2785 | 		recoveryScreen.getByRole("button", {
  2786 | 			name: "Восстановить исходные GLB",
  2787 | 			exact: true,
  2788 | 		}),
  2789 | 	).toHaveCSS("background-color", "rgb(25, 118, 185)");
  2790 | 	await session.page.screenshot({
  2791 | 		path: testInfo.outputPath("safety-resource-recovery.png"),
  2792 | 		scale: "css",
  2793 | 	});
  2794 | 	const reachableDiagnostic = await session.page
  2795 | 		.getByTestId("resource-recovery-diagnostic")
  2796 | 		.innerText();
  2797 | 	await session.page.route("**/catalog-api/**", (route) =>
  2798 | 		route.abort("failed"),
  2799 | 	);
  2800 | 	await session.page.reload();
  2801 | 	await openProjectCard(session.page, "Атомарное восстановление", "recovery");
  2802 | 	await expect(session.page.getByRole("status")).toContainText(
  2803 | 		"Нужно восстановление",
  2804 | 	);
  2805 | 	await expect(
  2806 | 		session.page.getByTestId("resource-recovery-diagnostic"),
  2807 | 	).toHaveText(reachableDiagnostic);
  2808 | 	const repairInput = session.page.getByLabel(
  2809 | 		"Выбрать исходные GLB-модели для восстановления",
  2810 | 	);
  2811 | 	await expect(repairInput).toHaveAttribute("multiple", "");
  2812 | 
  2813 | 	await repairInput.evaluate((input, bytes) => {
  2814 | 		const transfer = new DataTransfer();
  2815 | 		transfer.items.add(
  2816 | 			new File([new Uint8Array(bytes)], "only-one.glb", {
  2817 | 				type: "model/gltf-binary",
  2818 | 			}),
  2819 | 		);
  2820 | 		(input as HTMLInputElement).files = transfer.files;
  2821 | 		input.dispatchEvent(new Event("change", { bubbles: true }));
  2822 | 	}, exactBytes[0]);
  2823 | 	await expect(session.page.getByRole("alert")).toContainText(
  2824 | 		"точный набор исходных GLB",
  2825 | 	);
  2826 | 	await expect(readAllCustomAssetResources(session.page)).resolves.toHaveLength(
  2827 | 		0,
  2828 | 	);
  2829 | 	await expect
  2830 | 		.poll(() => currentProjectRevisionId(session.page))
  2831 | 		.toBe(revisionBeforeRecovery);
  2832 | 	await expect
  2833 | 		.poll(() => durableRevisionCount(session.page))
  2834 | 		.toBe(revisionCountBeforeRecovery);
  2835 | 
  2836 | 	await session.page.evaluate(() => {
  2837 | 		const original = File.prototype.arrayBuffer;
  2838 | 		File.prototype.arrayBuffer = async function () {
  2839 | 			await new Promise((resolve) => window.setTimeout(resolve, 1000));
  2840 | 			return original.call(this);
  2841 | 		};
  2842 | 	});
  2843 | 	await repairInput.evaluate((input, bytesList) => {
  2844 | 		const transfer = new DataTransfer();
  2845 | 		for (const [index, bytes] of bytesList.entries()) {
  2846 | 			transfer.items.add(
  2847 | 				new File([new Uint8Array(bytes)], `exact-${index}.glb`, {
  2848 | 					type: "model/gltf-binary",
  2849 | 				}),
  2850 | 			);
  2851 | 		}
  2852 | 		(input as HTMLInputElement).files = transfer.files;
  2853 | 		input.dispatchEvent(new Event("change", { bubbles: true }));
  2854 | 	}, exactBytes);
  2855 | 	await expect(
  2856 | 		recoveryScreen.getByRole("button", { name: "Вернуться к проектам" }),
  2857 | 	).toBeDisabled();
  2858 | 	await expect(
  2859 | 		session.page.getByRole("button", {
  2860 | 			name: "Повторить проверку",
  2861 | 			exact: true,
  2862 | 		}),
  2863 | 	).toBeDisabled();
  2864 | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  2865 | 	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");
  2866 | 	await expect(readAllCustomAssetResources(session.page)).resolves.toHaveLength(
  2867 | 		2,
  2868 | 	);
  2869 | 	await expect
  2870 | 		.poll(() => currentProjectRevisionId(session.page))
  2871 | 		.toBe(revisionBeforeRecovery);
  2872 | 	await expect
  2873 | 		.poll(() => durableRevisionCount(session.page))
```