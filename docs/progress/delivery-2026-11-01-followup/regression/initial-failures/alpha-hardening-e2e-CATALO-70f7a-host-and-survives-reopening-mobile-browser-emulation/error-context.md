# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: alpha-hardening-e2e.spec.ts >> CATALOG-HARDEN-02: a catalog wall model publishes a wall host and survives reopening
- Location: tests/browser/alpha-hardening-e2e.spec.ts:44:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Подтвердить размещение', exact: true })
    - locator resolved to <button type="button">Подтвердить размещение</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <iframe src="about:blank" id="rspack-dev-server-client-overlay"></iframe> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <iframe src="about:blank" id="rspack-dev-server-client-overlay"></iframe> intercepts pointer events
    - retrying click action
      - waiting 100ms
    55 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <iframe src="about:blank" id="rspack-dev-server-client-overlay"></iframe> intercepts pointer events
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
      - group "Масштаб плана" [ref=e18]:
        - button "Приблизить" [ref=e19] [cursor=pointer]: +
        - button "Отдалить" [ref=e20] [cursor=pointer]: −
      - generic:
        - button "Вернуться к проектам" [ref=e21] [cursor=pointer]: ‹Назад
        - button "Переименовать проект Каталожное бра" [ref=e22] [cursor=pointer]:
          - generic [ref=e23]: Каталожное бра
        - status [ref=e24]: Сохранено
        - button "Открыть остальные действия" [ref=e25] [cursor=pointer]
        - generic [ref=e30]:
          - group "Переключить вид редактора" [ref=e31]:
            - button "План 2D" [pressed] [ref=e33] [cursor=pointer]: План
            - button "3D" [ref=e34] [cursor=pointer]
          - button "Настроить размеры" [disabled] [ref=e35]:
            - generic [ref=e38]: Размеры
      - navigation "Инструменты редактора" [ref=e39]:
        - generic [ref=e40]:
          - button "Добавить проём" [ref=e41] [cursor=pointer]
          - button "Рука и выбор" [pressed] [ref=e46] [cursor=pointer]
          - button "Свойства" [ref=e51] [cursor=pointer]
          - button "Предметы интерьера" [active] [ref=e55] [cursor=pointer]:
            - generic [ref=e59]: Предмет
      - group "История изменений" [ref=e60]:
        - 'button "Отменить действие: изменение плана" [ref=e61] [cursor=pointer]': ↶
        - button "Повторить действие" [disabled] [ref=e62]: ↷
      - complementary "Свойства выбранной стены" [ref=e63]:
        - generic [ref=e64]:
          - strong [ref=e68]: Свойства стены
          - button "Закрыть свойства стены" [ref=e69] [cursor=pointer]: Закрыть
        - status [ref=e70]:
          - strong [ref=e71]: Размещение настенного предмета
          - generic [ref=e72]: "Смещение от начала стены: 2050 мм · 220 мм × 280 мм"
          - group "Сторона размещения предмета" [ref=e73]:
            - button "Разместить на левой стороне стены" [pressed] [ref=e75] [cursor=pointer]: Слева
            - button "Разместить на правой стороне стены" [ref=e76] [cursor=pointer]: Справа
          - button "Подтвердить размещение" [ref=e77] [cursor=pointer]
          - button "Отменить" [ref=e78] [cursor=pointer]
        - button "Переместить стену жестом" [ref=e79] [cursor=pointer]
        - button "Удалить стену" [ref=e80] [cursor=pointer]
  - iframe [ref=e81]:
    - generic [ref=f1e2]:
      - generic [ref=f1e3]: "Uncaught runtime errors:"
      - button "Dismiss" [ref=f1e4] [cursor=pointer]: ×
      - generic [ref=f1e6]:
        - generic [ref=f1e7]: ERROR
        - generic [ref=f1e8]: ResizeObserver loop completed with undelivered notifications. at handleError (http://127.0.0.1:48174/vendors-node_modules_pnpm_react-dom_19_2_8_react_19_2_8_node_modules_react-dom_client_js-node-edba5a.js:3969:66) at http://127.0.0.1:48174/vendors-node_modules_pnpm_react-dom_19_2_8_react_19_2_8_node_modules_react-dom_client_js-node-edba5a.js:3987:13
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | import { installCatalogGatewayFake } from "./catalog-gateway-fake";
  3  | 
  4  | async function createRoom(page: Page, name: string) {
  5  | 	await installCatalogGatewayFake(page);
  6  | 	await page.goto("/");
  7  | 	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
  8  | 	await page.getByRole("textbox", { name: "Название проекта" }).fill(name);
  9  | 	await page
  10 | 		.getByRole("button", { name: "Создать проект", exact: true })
  11 | 		.click();
  12 | 	await page
  13 | 		.getByRole("button", { name: "Создать контур", exact: true })
  14 | 		.click();
  15 | 	await expect(
  16 | 		page.getByTestId("editor-top-bar").getByRole("status"),
  17 | 	).toHaveText("Сохранено");
  18 | }
  19 | 
  20 | test("CATALOG-HARDEN-01: catalog cards describe their real category and wall anchor", async ({
  21 | 	page,
  22 | }) => {
  23 | 	await createRoom(page, "Категории каталога");
  24 | 	await page
  25 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  26 | 		.click();
  27 | 	await page.getByRole("button", { name: "Сантехника", exact: true }).click();
  28 | 	const sink = page.getByRole("button", {
  29 | 		name: /Демонстрационная раковина —/,
  30 | 	});
  31 | 	await expect(sink.getByTestId("catalog-card-category")).toHaveText(
  32 | 		"Сантехника",
  33 | 	);
  34 | 	await page.getByRole("button", { name: "Освещение", exact: true }).click();
  35 | 	const sconce = page.getByRole("button", {
  36 | 		name: /Демонстрационное настенное бра —/,
  37 | 	});
  38 | 	await expect(sconce.getByTestId("catalog-card-category")).toHaveText(
  39 | 		"Освещение",
  40 | 	);
  41 | 	await expect(sconce.getByText("На стене", { exact: true })).toBeVisible();
  42 | });
  43 | 
  44 | test("CATALOG-HARDEN-02: a catalog wall model publishes a wall host and survives reopening", async ({
  45 | 	page,
  46 | }) => {
  47 | 	await createRoom(page, "Каталожное бра");
  48 | 	await page
  49 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  50 | 		.click();
  51 | 	await page.getByRole("button", { name: "Освещение", exact: true }).click();
  52 | 	await page
  53 | 		.getByRole("button", { name: /Демонстрационное настенное бра —/ })
  54 | 		.click();
  55 | 	await page
  56 | 		.getByRole("button", { name: "Показать на плане", exact: true })
  57 | 		.click();
  58 | 	await expect(
  59 | 		page.getByText("Размещение настенного предмета", { exact: true }),
  60 | 	).toBeVisible();
  61 | 	await page
  62 | 		.getByRole("button", { name: "Подтвердить размещение", exact: true })
> 63 | 		.click();
     |    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  64 | 	await expect(
  65 | 		page.getByTestId("editor-top-bar").getByRole("status"),
  66 | 	).toHaveText("Сохранено");
  67 | 	const wallInstances = () =>
  68 | 		page.evaluate(async () => {
  69 | 			const db = await new Promise<IDBDatabase>((resolve, reject) => {
  70 | 				const request = indexedDB.open("interiors-editor-projects");
  71 | 				request.onsuccess = () => resolve(request.result);
  72 | 				request.onerror = () => reject(request.error);
  73 | 			});
  74 | 			try {
  75 | 				return await new Promise<string>((resolve, reject) => {
  76 | 					const tx = db.transaction("revisions", "readonly");
  77 | 					const request = tx.objectStore("revisions").getAll();
  78 | 					request.onsuccess = () => resolve(JSON.stringify(request.result));
  79 | 					request.onerror = () => reject(request.error);
  80 | 				});
  81 | 			} finally {
  82 | 				db.close();
  83 | 			}
  84 | 		});
  85 | 	await expect.poll(wallInstances).toContain('\\"anchorClass\\":\\"wall\\"');
  86 | 	await page.reload();
  87 | 	await page
  88 | 		.getByRole("button", { name: "Открыть Каталожное бра", exact: true })
  89 | 		.click();
  90 | 	await expect(page.getByTestId("item-count")).toHaveText("1 предмет");
  91 | 	await expect(page.getByTestId("item-count")).toBeHidden();
  92 | 	await expect(page.getByTestId("wall-schematic-item")).toHaveCount(1);
  93 | });
  94 | 
```