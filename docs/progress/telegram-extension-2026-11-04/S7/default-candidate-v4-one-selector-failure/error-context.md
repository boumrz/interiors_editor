# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> CATALOG-E2E-04 / RECOVERY-E2E-01: missing exact custom resources stay blocked across catalog outage and exact repair creates no Revision
- Location: tests/browser/project-e2e.spec.ts:2651:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Проекты' })
Expected: visible
Error: strict mode violation: getByRole('heading', { name: 'Проекты' }) resolved to 2 elements:
    1) <h1 tabindex="-1" id="projects-heading">Проекты</h1> aka getByTestId('project-hub').getByRole('heading', { name: 'Проекты' })
    2) <h2 id="browser-readonly-heading">Проекты только для выгрузки</h2> aka getByRole('heading', { name: 'Проекты только для выгрузки' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Проекты' })

```

# Page snapshot

```yaml
- main [ref=f2e3]:
  - region [ref=f2e4]:
    - generic [ref=f2e5]:
      - heading "Проекты" [active] [level=1] [ref=f2e6]
      - paragraph [ref=f2e7]: Планы на этом устройстве
    - generic [ref=f2e8]:
      - button "Новый проект" [ref=f2e9] [cursor=pointer]
      - button "Импортировать проект" [ref=f2e10]
      - button "Импортировать проект" [ref=f2e11] [cursor=pointer]
      - button "Импорт файла для переноса" [ref=f2e12] [cursor=pointer]
    - button "Восстановить несохранённую правку" [ref=f2e13] [cursor=pointer]
    - region "Локальные хранилища" [ref=f2e14]:
      - status [ref=f2e15]: Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явный импорт создаст текущую область после проверки файла.
      - group [ref=f2e16]:
        - generic "Старая версия не видит перенесённые проекты" [ref=f2e17]
    - list [ref=f2e18]:
      - listitem [ref=f2e19]:
        - button "Открыть Атомарное восстановление" [ref=f2e20] [cursor=pointer]:
          - generic [ref=f2e24]:
            - strong [ref=f2e25]: Атомарное восстановление
            - generic [ref=f2e26]: На этом устройстве · обычное хранилище
            - generic [ref=f2e27]: Изменён · 6 нояб., 01:26
        - button "Удалить проект Атомарное восстановление" [ref=f2e28] [cursor=pointer]
        - group [ref=f2e31]:
          - generic "Действия для Атомарное восстановление" [ref=f2e32] [cursor=pointer]: •••
```

# Test source

```ts
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
  230 | 	await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();
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
> 280 | 	await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
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
  331 | 	return page.evaluate(
  332 | 		() =>
  333 | 			new Promise<number[]>((resolve, reject) => {
  334 | 				const request = window.indexedDB.open("interiors-editor-custom-assets");
  335 | 				request.onerror = () => reject(request.error);
  336 | 				request.onsuccess = () => {
  337 | 					const database = request.result;
  338 | 					const transaction = database.transaction("resources", "readonly");
  339 | 					const resources = transaction.objectStore("resources").getAll();
  340 | 					let firstBytes: number[] | undefined;
  341 | 					resources.onsuccess = () => {
  342 | 						const first = resources.result[0] as
  343 | 							| { readonly bytes: ArrayBuffer }
  344 | 							| undefined;
  345 | 						firstBytes = first
  346 | 							? Array.from(new Uint8Array(first.bytes))
  347 | 							: undefined;
  348 | 					};
  349 | 					transaction.oncomplete = () => {
  350 | 						database.close();
  351 | 						if (!firstBytes) {
  352 | 							reject(new Error("Expected one stored custom asset resource"));
  353 | 							return;
  354 | 						}
  355 | 						resolve(firstBytes);
  356 | 					};
  357 | 					transaction.onerror = () => reject(transaction.error);
  358 | 				};
  359 | 			}),
  360 | 	);
  361 | }
  362 | 
  363 | async function readFirstCustomAssetRecord(page: Page): Promise<{
  364 | 	readonly bytes: readonly number[];
  365 | 	readonly resourceHash: string;
  366 | }> {
  367 | 	return page.evaluate(
  368 | 		() =>
  369 | 			new Promise((resolve, reject) => {
  370 | 				const request = window.indexedDB.open("interiors-editor-custom-assets");
  371 | 				request.onerror = () => reject(request.error);
  372 | 				request.onsuccess = () => {
  373 | 					const database = request.result;
  374 | 					const transaction = database.transaction("resources", "readonly");
  375 | 					const resources = transaction.objectStore("resources").getAll();
  376 | 					resources.onsuccess = () => {
  377 | 						const first = resources.result[0] as
  378 | 							| { readonly bytes: ArrayBuffer; readonly resourceHash: string }
  379 | 							| undefined;
  380 | 						if (!first) {
```