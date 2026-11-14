# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-workspace-e2e.spec.ts >> PANEL-E2E-04: Plan validation and its open state do not leak into another Project
- Location: tests/browser/editor-workspace-e2e.spec.ts:12984:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Проекты' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Проекты' })

```

```yaml
- main:
  - img "План помещения": 4000 3000
  - group "Масштаб плана":
    - button "Приблизить": +
    - button "Отдалить": −
  - button "Вернуться к проектам": ‹Назад
  - button "Переименовать проект Второй план": Второй план
  - status: Предпросмотр — не сохранено
  - button "Открыть остальные действия"
  - group "Переключить вид редактора":
    - text: Переключить вид редактора
    - button "План 2D" [pressed]: План
    - button "3D"
  - button "Настроить размеры": Размеры
  - navigation "Инструменты редактора":
    - button "Комната"
    - button "Рука и выбор" [pressed]
    - button "Стена"
    - button "Предметы интерьера": Предмет
  - group "История изменений":
    - 'button "Отменить действие: изменение плана"': ↶
    - button "Повторить действие" [disabled]: ↷
  - button "Помещения"
  - complementary "Точные размеры плана":
    - heading "Размеры плана" [level=2]
    - button "Скрыть размеры плана": ×
    - text: Ширина, мм
    - textbox "Ширина, мм" [invalid]: "4000"
    - text: Глубина, мм
    - textbox "Глубина, мм" [invalid]: "3000"
    - text: Высота, мм
    - textbox "Высота, мм" [invalid]: "0"
    - alert: Введите целые положительные миллиметры.
    - button "Применить размеры"
    - term: Площадь
    - definition: 12,00 м²
    - term: Высота
    - definition: 2600 мм
    - term: Периметр
    - definition: 14000 мм
  - button "Размеры плана" [expanded]
- alertdialog "Несохранённая правка":
  - heading "Продолжить правку?" [level=2]
  - paragraph: Правка ещё не сохранена. Продолжите работу или явно отмените её.
  - button "Продолжить"
  - button "Отменить правку"
```

# Test source

```ts
  91  | 	}
  92  | 	throw new Error("Expected an exposed 3D canvas point outside the inspector");
  93  | }
  94  | 
  95  | async function openPersistentPhone(
  96  | 	testInfo: TestInfo,
  97  | 	suffix: string,
  98  | 	options: {
  99  | 		readonly freshProfile?: boolean;
  100 | 		readonly installCatalogFake?: boolean;
  101 | 		readonly serviceWorkers?: "allow" | "block";
  102 | 	} = {},
  103 | ) {
  104 | 	const profileSuffix = options.freshProfile
  105 | 		? `${suffix}-${Date.now()}-${Math.random()}`
  106 | 		: suffix;
  107 | 	const context = await chromium.launchPersistentContext(
  108 | 		testInfo.outputPath(`profile-${profileSuffix}`),
  109 | 		{
  110 | 			...devices["iPhone 13"],
  111 | 			channel: "chrome",
  112 | 			colorScheme: "light",
  113 | 			locale: "ru-RU",
  114 | 			serviceWorkers: options.serviceWorkers ?? "block",
  115 | 		},
  116 | 	);
  117 | 	const page = context.pages()[0] ?? (await context.newPage());
  118 | 	if (options.installCatalogFake !== false)
  119 | 		await installCatalogGatewayFake(page);
  120 | 	return { context, page };
  121 | }
  122 | 
  123 | type EditorOption =
  124 | 	| "План 2D"
  125 | 	| "3D"
  126 | 	| "Рука и выбор"
  127 | 	| "Стена"
  128 | 	| "Предметы интерьера";
  129 | 
  130 | /**
  131 |  * View mode is intentionally separated from authoring tools: it stays visible
  132 |  * in the compact top bar, while the three frequent creation tools stay in the
  133 |  * persistent action dock.
  134 |  */
  135 | async function chooseEditorOption(page: Page, name: EditorOption) {
  136 | 	if (name === "План 2D" || name === "3D") {
  137 | 		const option = page
  138 | 			.getByTestId("editor-view-switch")
  139 | 			.getByRole("button", { name, exact: true });
  140 | 		await expect(option).toBeEnabled();
  141 | 		await option.click();
  142 | 		return;
  143 | 	}
  144 | 	const rail = page.getByRole("navigation", { name: "Инструменты редактора" });
  145 | 	const option = rail.getByRole("button", { name, exact: true });
  146 | 	if (name === "Предметы интерьера" && !(await option.isVisible())) {
  147 | 		await page
  148 | 			.getByRole("button", { name: "Открыть остальные действия" })
  149 | 			.click();
  150 | 		const catalog = page
  151 | 			.getByRole("dialog", { name: "Остальные действия редактора" })
  152 | 			.getByRole("button", { name, exact: true });
  153 | 		// A completed placement can clear the wall selection between the first
  154 | 		// visibility read and opening this menu. Follow the now-visible route.
  155 | 		await expect
  156 | 			.poll(
  157 | 				async () => (await catalog.isVisible()) || (await option.isVisible()),
  158 | 			)
  159 | 			.toBe(true);
  160 | 		if (await catalog.isVisible()) {
  161 | 			await expect(catalog).toBeEnabled();
  162 | 			await catalog.click();
  163 | 			return;
  164 | 		}
  165 | 		await page
  166 | 			.getByRole("button", { name: "Закрыть остальные действия", exact: true })
  167 | 			.click();
  168 | 	}
  169 | 	// Selecting a wall intentionally replaces the construction action with
  170 | 	// “Свойства” in the compact dock. Returning to drawing is still a direct
  171 | 	// two-tap phone flow: clear the selection, then choose “Стена”.
  172 | 	if (name === "Стена" && !(await option.isVisible())) {
  173 | 		const select = rail.getByRole("button", {
  174 | 			name: "Рука и выбор",
  175 | 			exact: true,
  176 | 		});
  177 | 		await expect(select).toBeEnabled();
  178 | 		await select.click();
  179 | 	}
  180 | 	await expect(option).toBeEnabled();
  181 | 	await option.click();
  182 | }
  183 | 
  184 | async function startNewProject(page: Page, name: string) {
  185 | 	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
  186 | 	await page.getByLabel("Название проекта").fill(name);
  187 | 	await page.getByRole("button", { name: "Создать проект" }).click();
  188 | }
  189 | 
  190 | async function openProjectFromHub(page: Page, name: string) {
> 191 | 	await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  192 | 	await page
  193 | 		.getByRole("button", { name: `Открыть ${name}`, exact: true })
  194 | 		.click();
  195 | 	await expect(page.getByTestId("editor-workspace")).toBeVisible();
  196 | }
  197 | 
  198 | async function choosePreloadedCatalogAsset(
  199 | 	page: Page,
  200 | 	label = "Деревянный комод",
  201 | 	autoConfirmPlacement = true,
  202 | ) {
  203 | 	await chooseEditorOption(page, "Предметы интерьера");
  204 | 	const catalog = page.getByRole("dialog", { name: "Предметы интерьера" });
  205 | 	await catalog
  206 | 		.getByRole("button", { name: new RegExp(`^${label} —`) })
  207 | 		.click();
  208 | 	const place = catalog.getByRole("button", {
  209 | 		name: "Показать на плане",
  210 | 	});
  211 | 	await expect(place).toBeEnabled({ timeout: 30_000 });
  212 | 	if (autoConfirmPlacement) {
  213 | 		// Most pre-existing scenarios are about the command after placement, not
  214 | 		// the confirmation affordance itself. Arm this observer *before* opening
  215 | 		// the preview: a fast catalog path can synchronously mount the confirm
  216 | 		// control, which otherwise leaves this helper waiting for an event that
  217 | 		// already happened. The dedicated preview scenario below exercises the
  218 | 		// real ✓/× interaction.
  219 | 		await page.evaluate(() => {
  220 | 			const observer = new MutationObserver(() => {
  221 | 				const confirm = document.querySelector<SVGGElement>(
  222 | 					'[data-testid="item-placement-confirm"]',
  223 | 				);
  224 | 				if (!confirm || confirm.getAttribute("aria-disabled") === "true")
  225 | 					return;
  226 | 				observer.disconnect();
  227 | 				confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  228 | 			});
  229 | 			observer.observe(document.body, {
  230 | 				childList: true,
  231 | 				subtree: true,
  232 | 				attributes: true,
  233 | 				attributeFilter: ["aria-disabled"],
  234 | 			});
  235 | 		});
  236 | 	}
  237 | 	await place.click();
  238 | 	await expect(catalog).toHaveCount(0, { timeout: 30_000 });
  239 | }
  240 | 
  241 | /** Legacy command scenarios retain their helper name while exercising a real
  242 |  * bundled resource instead of a procedural placeholder. */
  243 | async function chooseBuiltInGreybox(
  244 | 	page: Page,
  245 | 	label = "Стол",
  246 | 	autoConfirmPlacement = true,
  247 | ) {
  248 | 	return choosePreloadedCatalogAsset(
  249 | 		page,
  250 | 		label === "Стол" ? "Деревянный комод" : label,
  251 | 		autoConfirmPlacement,
  252 | 	);
  253 | }
  254 | 
  255 | async function chooseFloorPlaceholder(page: Page, label: string) {
  256 | 	await chooseEditorOption(page, "Предметы интерьера");
  257 | 	const catalog = page.getByRole("dialog", { name: "Предметы интерьера" });
  258 | 	await catalog.getByTestId("catalog-authoring").locator("summary").click();
  259 | 	await catalog
  260 | 		.getByRole("button", { name: "Создать макетный предмет" })
  261 | 		.click();
  262 | 	const composer = catalog.getByRole("form", {
  263 | 		name: "Создать макетный предмет",
  264 | 	});
  265 | 	await composer.getByLabel("Название макетного предмета").fill(label);
  266 | 	await composer.getByLabel("Ширина макетного предмета, мм").fill("800");
  267 | 	await composer.getByLabel("Глубина макетного предмета, мм").fill("422");
  268 | 	await composer.getByLabel("Высота макетного предмета, мм").fill("868");
  269 | 	await composer.getByRole("button", { name: "Начать размещение" }).click();
  270 | 	await expect(catalog).toHaveCount(0);
  271 | }
  272 | 
  273 | async function expandSelectedItemInspector(page: Page) {
  274 | 	const inspector = page.getByTestId("selected-item-inspector");
  275 | 	if (await inspector.isVisible()) {
  276 | 		if ((await inspector.getAttribute("data-inspector-expanded")) === "true") {
  277 | 			return;
  278 | 		}
  279 | 		const toggle = page.getByRole("button", {
  280 | 			name: "Развернуть панель предмета",
  281 | 		});
  282 | 		await expect(toggle).toBeVisible();
  283 | 		await toggle.click();
  284 | 		return;
  285 | 	}
  286 | 	const action = page.getByRole("button", {
  287 | 		name: "Параметры выбранного предмета",
  288 | 	});
  289 | 	if (!(await action.isVisible())) {
  290 | 		await page
  291 | 			.getByRole("button", { name: "Открыть остальные действия" })
```