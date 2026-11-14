# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> CATALOG-E2E-05 / PROJECT-E2E-03D: an offline self-contained project transfer restores its exact pinned GLB without a remote fetch
- Location: tests/browser/project-e2e.spec.ts:1937:1

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
  - button "Переименовать проект Модель для бэкапа": Модель для бэкапа
  - status: Предпросмотр — не сохранено
  - button "Открыть остальные действия" [expanded]
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
  - dialog "Остальные действия редактора":
    - text: Ещё
    - button "Закрыть остальные действия": Закрыть
    - button "Размеры плана"
    - button "Проекты"
    - button "Экспортировать проект"
    - button "Экспорт файла для переноса"
    - button "Начать заново"
    - button "Удалить проект"
    - alertdialog "Несохранённая правка":
      - heading "Продолжить правку?" [level=2]
      - paragraph: Правка ещё не сохранена. Продолжите работу или явно отмените её.
      - button "Продолжить"
      - button "Отменить правку"
  - group "История изменений":
    - 'button "Отменить действие: добавление предмета"': ↶
    - button "Повторить действие" [disabled]: ↷
  - button "Помещения"
  - button "Размеры плана"
```

# Test source

```ts
  130 | 	await page
  131 | 		.getByTestId("editor-top-bar")
  132 | 		.locator("button")
  133 | 		.first()
  134 | 		.evaluate((button) => button.focus());
  135 | 	await expect(cancel).toBeFocused();
  136 | 	await page.mouse.click(24, 24);
  137 | 	await expect(dialog).toBeVisible();
  138 | }
  139 | 
  140 | async function expectCompactConfirmation(
  141 | 	page: Page,
  142 | 	dialog: Locator,
  143 | 	screenshotPath: string,
  144 | ): Promise<void> {
  145 | 	await page.setViewportSize({ width: 360, height: 480 });
  146 | 	await page.evaluate(() => {
  147 | 		document.documentElement.style.fontSize = "200%";
  148 | 	});
  149 | 	const box = await dialog.boundingBox();
  150 | 	if (!box) throw new Error("Expected a visible confirmation");
  151 | 	expect(box.y).toBeGreaterThanOrEqual(0);
  152 | 	expect(box.y + box.height).toBeLessThanOrEqual(480);
  153 | 	for (const button of await dialog.getByRole("button").all()) {
  154 | 		await button.scrollIntoViewIfNeeded();
  155 | 		const target = await button.boundingBox();
  156 | 		if (!target) throw new Error("Expected a reachable confirmation action");
  157 | 		expect(target.height).toBeGreaterThanOrEqual(44);
  158 | 		expect(target.width).toBeGreaterThanOrEqual(44);
  159 | 		expect(target.x).toBeGreaterThanOrEqual(0);
  160 | 		expect(target.x + target.width).toBeLessThanOrEqual(360);
  161 | 		expect(target.y).toBeGreaterThanOrEqual(0);
  162 | 		expect(target.y + target.height).toBeLessThanOrEqual(480);
  163 | 	}
  164 | 	expect(
  165 | 		await dialog.evaluate(
  166 | 			(element) => element.scrollWidth <= element.clientWidth,
  167 | 		),
  168 | 	).toBe(true);
  169 | 	await page.screenshot({ path: screenshotPath, scale: "css" });
  170 | 	await page.evaluate(() => {
  171 | 		document.documentElement.style.fontSize = "";
  172 | 	});
  173 | 	await page.setViewportSize({ width: 393, height: 852 });
  174 | }
  175 | 
  176 | async function pausePinStagingMark(page: Page): Promise<void> {
  177 | 	await waitForTestControl(page);
  178 | 	await page.evaluate(() => {
  179 | 		const control = (
  180 | 			window as unknown as { __interiorsTestControl?: InteriorsTestControl }
  181 | 		).__interiorsTestControl;
  182 | 		if (!control) {
  183 | 			throw new Error("Expected the Interiors test control");
  184 | 		}
  185 | 		control.pausePinStagingMark();
  186 | 	});
  187 | }
  188 | 
  189 | async function releasePinStagingMark(page: Page): Promise<void> {
  190 | 	await waitForTestControl(page);
  191 | 	await page.evaluate(() => {
  192 | 		const control = (
  193 | 			window as unknown as { __interiorsTestControl?: InteriorsTestControl }
  194 | 		).__interiorsTestControl;
  195 | 		if (!control) {
  196 | 			throw new Error("Expected the Interiors test control");
  197 | 		}
  198 | 		control.releasePinStagingMark();
  199 | 	});
  200 | }
  201 | 
  202 | async function openPersistentPhone(testInfo: TestInfo, suffix: string) {
  203 | 	const context = await chromium.launchPersistentContext(
  204 | 		testInfo.outputPath(`profile-${suffix}`),
  205 | 		{
  206 | 			...devices["iPhone 13"],
  207 | 			channel: "chrome",
  208 | 			colorScheme: "light",
  209 | 			locale: "ru-RU",
  210 | 			serviceWorkers: "block",
  211 | 		},
  212 | 	);
  213 | 	const page = context.pages()[0] ?? (await context.newPage());
  214 | 	await installCatalogGatewayFake(page);
  215 | 	return { context, page };
  216 | }
  217 | 
  218 | async function openProjectDirectoryActions(
  219 | 	page: Page,
  220 | 	projectName: string,
  221 | ): Promise<void> {
  222 | 	await page
  223 | 		.locator(`summary[aria-label="Действия для ${projectName}"]`)
  224 | 		.click();
  225 | }
  226 | 
  227 | async function openProjectDirectory(page: Page): Promise<void> {
  228 | 	await openEditorSecondaryActions(page);
  229 | 	await page.getByRole("button", { name: "Проекты", exact: true }).click();
> 230 | 	await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  231 | }
  232 | 
  233 | async function openEditorSecondaryActions(page: Page): Promise<void> {
  234 | 	const trigger = page.getByRole("button", {
  235 | 		name: "Открыть остальные действия",
  236 | 	});
  237 | 	if ((await trigger.getAttribute("aria-expanded")) !== "true") {
  238 | 		await trigger.click();
  239 | 	}
  240 | 	await expect(trigger).toHaveAttribute("aria-expanded", "true");
  241 | }
  242 | 
  243 | async function revealCatalogAuthoring(catalogue: Locator): Promise<void> {
  244 | 	const authoring = catalogue.getByTestId("catalog-authoring");
  245 | 	if ((await authoring.getAttribute("open")) !== "") {
  246 | 		await authoring.getByText("Импорт модели", { exact: true }).click();
  247 | 	}
  248 | 	await expect(authoring).toHaveAttribute("open", "");
  249 | }
  250 | 
  251 | /**
  252 |  * Project creation is an explicit route from the cold-start hub. Keeping this
  253 |  * as a public UI flow prevents browser scenarios from accidentally relying on
  254 |  * a legacy auto-open of the sole local Project.
  255 |  */
  256 | async function startNewProject(page: Page): Promise<void> {
  257 | 	await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();
  258 | 	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
  259 | 	await expect(
  260 | 		page.getByRole("heading", { name: "Новый проект" }),
  261 | 	).toBeVisible();
  262 | }
  263 | 
  264 | async function submitNewProject(page: Page, name: string): Promise<void> {
  265 | 	await page.getByLabel("Название проекта").fill(name);
  266 | 	await page.getByRole("button", { name: "Создать проект" }).click();
  267 | }
  268 | 
  269 | async function createProject(page: Page, name: string): Promise<void> {
  270 | 	await startNewProject(page);
  271 | 	await submitNewProject(page, name);
  272 | 	await expect(page.getByTestId("editor-workspace")).toBeVisible();
  273 | }
  274 | 
  275 | async function openProjectCard(
  276 | 	page: Page,
  277 | 	projectName: string,
  278 | 	destination: "editor" | "recovery" = "editor",
  279 | ): Promise<void> {
  280 | 	await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();
  281 | 	await page.getByRole("button", { name: `Открыть ${projectName}` }).click();
  282 | 	await expect(
  283 | 		destination === "editor"
  284 | 			? page.getByTestId("editor-workspace")
  285 | 			: page.getByRole("heading", { name: "Проект требует восстановления" }),
  286 | 	).toBeVisible();
  287 | }
  288 | 
  289 | async function openPersistentShortPhone(testInfo: TestInfo, suffix: string) {
  290 | 	const context = await chromium.launchPersistentContext(
  291 | 		testInfo.outputPath(`profile-${suffix}`),
  292 | 		{
  293 | 			...devices["iPhone 13"],
  294 | 			channel: "chrome",
  295 | 			colorScheme: "light",
  296 | 			locale: "ru-RU",
  297 | 			serviceWorkers: "block",
  298 | 			viewport: { height: 568, width: 320 },
  299 | 		},
  300 | 	);
  301 | 	const page = context.pages()[0] ?? (await context.newPage());
  302 | 	await installCatalogGatewayFake(page);
  303 | 	return { context, page };
  304 | }
  305 | 
  306 | async function chooseCorruptPortableBackup(
  307 | 	page: Page,
  308 | 	name: string,
  309 | ): Promise<void> {
  310 | 	await page
  311 | 		.getByLabel("Импортировать проект")
  312 | 		.evaluate((element, fileName) => {
  313 | 			const input = element as HTMLInputElement;
  314 | 			const transfer = new DataTransfer();
  315 | 			transfer.items.add(
  316 | 				new File(
  317 | 					[Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 1, 2, 3])],
  318 | 					fileName,
  319 | 					{ type: "application/zip" },
  320 | 				),
  321 | 			);
  322 | 			Object.defineProperty(input, "files", {
  323 | 				configurable: true,
  324 | 				value: transfer.files,
  325 | 			});
  326 | 			input.dispatchEvent(new Event("change", { bubbles: true }));
  327 | 		}, name);
  328 | }
  329 | 
  330 | async function readFirstCustomAssetResource(page: Page): Promise<number[]> {
```