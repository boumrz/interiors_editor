# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> RECOVERY-E2E-01: cancelled removal keeps the prior Revision and confirmed RecoveryChangeSet publishes exactly one next Revision
- Location: tests/browser/project-e2e.spec.ts:2878:1

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
  - Expect "toContainText" with timeout 20000ms
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
      - paragraph [ref=f1e33]: "Размещённых предметов: 1. Недоступных описаний моделей: 1."
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
      - button "Переименовать проект Удаление недоступной модели" [disabled] [ref=f1e58]:
        - generic [ref=f1e59]: Удаление недоступной модели
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
  2874 | 		.toBe(revisionCountBeforeRecovery);
  2875 | 	await session.context.close();
  2876 | });
  2877 | 
  2878 | test("RECOVERY-E2E-01: cancelled removal keeps the prior Revision and confirmed RecoveryChangeSet publishes exactly one next Revision", async ({
  2879 | 	page: _page,
  2880 | }, testInfo) => {
  2881 | 	test.slow();
  2882 | 	const session = await openPersistentPhone(
  2883 | 		testInfo,
  2884 | 		"recovery-changeset-removal",
  2885 | 	);
  2886 | 	await session.page.goto("/");
  2887 | 	await createProject(session.page, "Удаление недоступной модели");
  2888 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  2889 | 
  2890 | 	await session.page
  2891 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  2892 | 		.click();
  2893 | 	const catalogue = session.page.getByRole("dialog", {
  2894 | 		name: "Предметы интерьера",
  2895 | 	});
  2896 | 	await revealCatalogAuthoring(catalogue);
  2897 | 	await catalogue
  2898 | 		.getByTestId("custom-glb-import-input")
  2899 | 		.evaluate((input, bytes) => {
  2900 | 			const transfer = new DataTransfer();
  2901 | 			transfer.items.add(
  2902 | 				new File([new Uint8Array(bytes)], "remove-in-recovery.glb", {
  2903 | 					type: "model/gltf-binary",
  2904 | 				}),
  2905 | 			);
  2906 | 			(input as HTMLInputElement).files = transfer.files;
  2907 | 			input.dispatchEvent(new Event("change", { bubbles: true }));
  2908 | 		}, Array.from(centimetreSketchfabGlb()));
  2909 | 	await expect(catalogue.getByTestId("custom-glb-preview")).toBeVisible({
  2910 | 		timeout: 15_000,
  2911 | 	});
  2912 | 	await catalogue
  2913 | 		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
  2914 | 		.click();
  2915 | 	await clickRectangularRoomCentre(session.page);
  2916 | 	await session.page.getByTestId("item-placement-confirm").click();
  2917 | 	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
  2918 | 
  2919 | 	const revisionBeforeRecovery = await currentProjectRevisionId(session.page);
  2920 | 	const revisionCountBeforeRecovery = await durableRevisionCount(session.page);
  2921 | 	await deleteAllCustomAssetResources(session.page);
  2922 | 	await session.page.reload();
  2923 | 	await openProjectCard(
  2924 | 		session.page,
  2925 | 		"Удаление недоступной модели",
  2926 | 		"recovery",
  2927 | 	);
> 2928 | 	await expect(session.page.getByRole("status")).toContainText(
       |                                                 ^ Error: expect(locator).toContainText(expected) failed
  2929 | 		"Нужно восстановление",
  2930 | 		{ timeout: 20_000 },
  2931 | 	);
  2932 | 	await expect(
  2933 | 		session.page.getByText("Размещённых предметов: 1"),
  2934 | 	).toBeVisible();
  2935 | 	await session.page
  2936 | 		.getByRole("button", { name: "Удалить все недоступные модели" })
  2937 | 		.click();
  2938 | 	await expect(
  2939 | 		session.page.getByRole("button", {
  2940 | 			name: "Подтвердить удаление всех недоступных моделей",
  2941 | 		}),
  2942 | 	).toBeVisible();
  2943 | 	await session.page.getByRole("button", { name: "Отмена" }).click();
  2944 | 	await expect(
  2945 | 		session.page.getByRole("button", {
  2946 | 			name: "Подтвердить удаление всех недоступных моделей",
  2947 | 		}),
  2948 | 	).toHaveCount(0);
  2949 | 	await expect(session.page.getByRole("status")).toContainText(
  2950 | 		"Нужно восстановление",
  2951 | 	);
  2952 | 	await expect
  2953 | 		.poll(() => currentProjectRevisionId(session.page))
  2954 | 		.toBe(revisionBeforeRecovery);
  2955 | 	await expect
  2956 | 		.poll(() => durableRevisionCount(session.page))
  2957 | 		.toBe(revisionCountBeforeRecovery);
  2958 | 	await session.page
  2959 | 		.getByRole("button", { name: "Удалить все недоступные модели" })
  2960 | 		.click();
  2961 | 	await session.page
  2962 | 		.getByRole("button", {
  2963 | 			name: "Подтвердить удаление всех недоступных моделей",
  2964 | 		})
  2965 | 		.click();
  2966 | 
  2967 | 	await expect(session.page.getByRole("status")).toContainText("Сохранено");
  2968 | 	await expect(session.page.getByTestId("item-count")).toHaveText(
  2969 | 		"0 предметов",
  2970 | 	);
  2971 | 	await expect(
  2972 | 		session.page.getByRole("button", { name: "Стена", exact: true }),
  2973 | 	).toBeEnabled();
  2974 | 	await expect
  2975 | 		.poll(() => currentProjectRevisionId(session.page))
  2976 | 		.not.toBe(revisionBeforeRecovery);
  2977 | 	await expect
  2978 | 		.poll(() => durableRevisionCount(session.page))
  2979 | 		.toBe(revisionCountBeforeRecovery + 1);
  2980 | 	await expect(readAllCustomAssetResources(session.page)).resolves.toHaveLength(
  2981 | 		0,
  2982 | 	);
  2983 | 	await session.context.close();
  2984 | });
  2985 | 
  2986 | test("PROJECT-E2E-04C: direct Sketchfab FBX-derived GLB suggests metre dimensions instead of 100× centimetre bounds", async ({
  2987 | 	page: _page,
  2988 | }, testInfo) => {
  2989 | 	const session = await openPersistentPhone(
  2990 | 		testInfo,
  2991 | 		"direct-sketchfab-glb-scale",
  2992 | 	);
  2993 | 	await session.page.goto("/");
  2994 | 	await createProject(session.page, "Нормализация GLB");
  2995 | 	await session.page
  2996 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  2997 | 		.click();
  2998 | 	const catalogue = session.page.getByRole("dialog", {
  2999 | 		name: "Предметы интерьера",
  3000 | 	});
  3001 | 	await revealCatalogAuthoring(catalogue);
  3002 | 	await catalogue
  3003 | 		.getByTestId("custom-glb-import-input")
  3004 | 		.evaluate((input, bytes) => {
  3005 | 			const transfer = new DataTransfer();
  3006 | 			transfer.items.add(
  3007 | 				new File([new Uint8Array(bytes)], "white-armchair-fbx-1k-9mb.glb", {
  3008 | 					type: "model/gltf-binary",
  3009 | 				}),
  3010 | 			);
  3011 | 			(input as HTMLInputElement).files = transfer.files;
  3012 | 			input.dispatchEvent(new Event("change", { bubbles: true }));
  3013 | 		}, Array.from(centimetreSketchfabGlb()));
  3014 | 
  3015 | 	await expect(catalogue.getByLabel("Ширина, мм")).toHaveValue("2000");
  3016 | 	await expect(catalogue.getByLabel("Глубина, мм")).toHaveValue("2000");
  3017 | 	await expect(catalogue.getByLabel("Высота, мм")).toHaveValue("2000");
  3018 | 	await expect(catalogue.getByTestId("custom-glb-preview")).toBeVisible();
  3019 | 	await session.context.close();
  3020 | });
  3021 | 
  3022 | test("PROJECT-E2E-04D: a verified import remains in Custom and can be placed into a different local project", async ({
  3023 | 	page: _page,
  3024 | }, testInfo) => {
  3025 | 	const session = await openPersistentPhone(testInfo, "shared-custom-library");
  3026 | 	await session.page.goto("/");
  3027 | 	await createProject(session.page, "Первый каталог");
  3028 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
```