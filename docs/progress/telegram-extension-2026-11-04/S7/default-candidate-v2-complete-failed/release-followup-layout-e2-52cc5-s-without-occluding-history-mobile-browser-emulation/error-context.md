# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: release-followup-layout-e2e.spec.ts >> FOLLOW-UI-03 360x480 200%: wall confirmation uses consistent actions without occluding history
- Location: tests/browser/release-followup-layout-e2e.spec.ts:199:2

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('wall-draft-actions')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('wall-draft-actions')

```

```yaml
- main:
  - img "План помещения": 4000 3000
  - group "Масштаб плана":
    - button "Приблизить": +
    - button "Отдалить": −
  - button "Вернуться к проектам": ‹Назад
  - button "Переименовать проект Проверка интерфейса": Проверка интерфейса
  - status: Предпросмотр — не сохранено
  - button "Открыть остальные действия"
  - group "Переключить вид редактора":
    - text: Переключить вид редактора
    - button "План 2D" [pressed]: План
    - button "3D"
  - button "Настроить размеры" [disabled]: Размеры
  - navigation "Инструменты редактора":
    - button "Комната"
    - button "Рука и выбор"
    - button "Стена" [pressed]
    - button "Предметы интерьера": Предмет
  - group "История изменений":
    - 'button "Отменить действие: изменение плана"': ↶
    - button "Повторить действие" [disabled]: ↷
```

# Test source

```ts
  31  | 	await page
  32  | 		.getByRole("button", { name: "Создать проект", exact: true })
  33  | 		.click();
  34  | }
  35  | 
  36  | async function createRoom(page: Page) {
  37  | 	await createProject(page);
  38  | 	await page
  39  | 		.getByRole("button", { name: "Создать контур", exact: true })
  40  | 		.click();
  41  | 	await expect(page.getByTestId("room-face")).toHaveCount(1);
  42  | }
  43  | 
  44  | async function expectSeparated(first: Locator, second: Locator) {
  45  | 	const a = await first.boundingBox();
  46  | 	const b = await second.boundingBox();
  47  | 	if (!a || !b) throw new Error("Expected visible independent UI surfaces");
  48  | 	expect(
  49  | 		a.x + a.width <= b.x ||
  50  | 			b.x + b.width <= a.x ||
  51  | 			a.y + a.height <= b.y ||
  52  | 			b.y + b.height <= a.y,
  53  | 	).toBe(true);
  54  | }
  55  | 
  56  | async function expectTouchable(control: Locator, rounded = false) {
  57  | 	await control.scrollIntoViewIfNeeded();
  58  | 	const bounds = await control.boundingBox();
  59  | 	if (!bounds) throw new Error("Expected a rendered control");
  60  | 	expect(bounds.height).toBeGreaterThanOrEqual(44);
  61  | 	expect(bounds.width).toBeGreaterThanOrEqual(44);
  62  | 	if (rounded)
  63  | 		expect(
  64  | 			await control.evaluate((element) =>
  65  | 				parseFloat(getComputedStyle(element).borderTopLeftRadius),
  66  | 			),
  67  | 		).toBeGreaterThanOrEqual(10);
  68  | 	expect(
  69  | 		await control.evaluate((element) => {
  70  | 			const rect = element.getBoundingClientRect();
  71  | 			return [0.2, 0.5, 0.8].every((x) =>
  72  | 				[0.2, 0.5, 0.8].every((y) => {
  73  | 					const hit = document.elementFromPoint(
  74  | 						rect.x + rect.width * x,
  75  | 						rect.y + rect.height * y,
  76  | 					);
  77  | 					return hit === element || (hit !== null && element.contains(hit));
  78  | 				}),
  79  | 			);
  80  | 		}),
  81  | 	).toBe(true);
  82  | 	if (await control.evaluate((element) => element.tagName === "BUTTON")) {
  83  | 		expect(
  84  | 			await control.evaluate((element) => {
  85  | 				const bounds = element.getBoundingClientRect();
  86  | 				const range = document.createRange();
  87  | 				range.selectNodeContents(element);
  88  | 				return [...range.getClientRects()].every(
  89  | 					(rect) =>
  90  | 						rect.left >= bounds.left &&
  91  | 						rect.right <= bounds.right &&
  92  | 						rect.top >= bounds.top &&
  93  | 						rect.bottom <= bounds.bottom,
  94  | 				);
  95  | 			}),
  96  | 		).toBe(true);
  97  | 	}
  98  | }
  99  | 
  100 | async function expectNoHorizontalScroll(surface: Locator) {
  101 | 	expect(
  102 | 		await surface.evaluate(
  103 | 			(element) => element.scrollWidth <= element.clientWidth + 1,
  104 | 		),
  105 | 	).toBe(true);
  106 | }
  107 | 
  108 | async function drawWallDraft(page: Page) {
  109 | 	await page.getByRole("button", { name: "Стена", exact: true }).click();
  110 | 	const room = await page.getByTestId("room-face").first().boundingBox();
  111 | 	if (!room) throw new Error("Expected a room to draw inside");
  112 | 	const cdp = await page.context().newCDPSession(page);
  113 | 	const from = { x: room.x + room.width * 0.5, y: room.y + room.height * 0.25 };
  114 | 	const to = { x: from.x, y: room.y + room.height * 0.65 };
  115 | 	try {
  116 | 		await cdp.send("Input.dispatchTouchEvent", {
  117 | 			type: "touchStart",
  118 | 			touchPoints: [{ id: 431, ...from }],
  119 | 		});
  120 | 		await cdp.send("Input.dispatchTouchEvent", {
  121 | 			type: "touchMove",
  122 | 			touchPoints: [{ id: 431, ...to }],
  123 | 		});
  124 | 		await cdp.send("Input.dispatchTouchEvent", {
  125 | 			type: "touchEnd",
  126 | 			touchPoints: [],
  127 | 		});
  128 | 	} finally {
  129 | 		await cdp.detach();
  130 | 	}
> 131 | 	await expect(page.getByTestId("wall-draft-actions")).toBeVisible();
      |                                                       ^ Error: expect(locator).toBeVisible() failed
  132 | }
  133 | 
  134 | for (const layout of viewports) {
  135 | 	const label = `${layout.width}x${layout.height} ${layout.font}%`;
  136 | 	test(`FOLLOW-UI-01 ${label}: project creation has separated rounded controls and leaves canvas tools clear`, async ({
  137 | 		page,
  138 | 	}, testInfo) => {
  139 | 		await page.setViewportSize(layout);
  140 | 		await page.goto("/");
  141 | 		await setLayout(page, layout);
  142 | 		const create = page.getByRole("button", {
  143 | 			name: "Новый проект",
  144 | 			exact: true,
  145 | 		});
  146 | 		await expectTouchable(create, true);
  147 | 		await create.click();
  148 | 		const form = page
  149 | 			.locator("form")
  150 | 			.filter({ has: page.getByLabel("Название проекта", { exact: true }) });
  151 | 		const input = form.getByLabel("Название проекта", { exact: true });
  152 | 		const submit = form.getByRole("button", {
  153 | 			name: "Создать проект",
  154 | 			exact: true,
  155 | 		});
  156 | 		await expectTouchable(input, true);
  157 | 		await expectTouchable(submit, true);
  158 | 		const inputBounds = await input.boundingBox(),
  159 | 			submitBounds = await submit.boundingBox();
  160 | 		if (!inputBounds || !submitBounds)
  161 | 			throw new Error("Expected separated creation controls");
  162 | 		expect(
  163 | 			submitBounds.y - inputBounds.y - inputBounds.height,
  164 | 		).toBeGreaterThanOrEqual(12);
  165 | 		await page.screenshot({
  166 | 			path: testInfo.outputPath("new-project.png"),
  167 | 			scale: "css",
  168 | 		});
  169 | 		await input.fill("Новый интерьер");
  170 | 		await submit.click();
  171 | 		const contour = page.getByRole("form", {
  172 | 			name: "Размеры стартового контура",
  173 | 			exact: true,
  174 | 		});
  175 | 		for (const field of await contour.getByRole("textbox").all())
  176 | 			await expectTouchable(field, true);
  177 | 		await expectTouchable(
  178 | 			contour.getByRole("button", { name: "Создать контур", exact: true }),
  179 | 			true,
  180 | 		);
  181 | 		await expectSeparated(
  182 | 			contour,
  183 | 			page.getByRole("group", { name: "История изменений", exact: true }),
  184 | 		);
  185 | 		await expectSeparated(
  186 | 			contour,
  187 | 			page.getByRole("navigation", {
  188 | 				name: "Инструменты редактора",
  189 | 				exact: true,
  190 | 			}),
  191 | 		);
  192 | 		await expectNoHorizontalScroll(contour);
  193 | 		await page.screenshot({
  194 | 			path: testInfo.outputPath("initial-contour.png"),
  195 | 			scale: "css",
  196 | 		});
  197 | 	});
  198 | 
  199 | 	test(`FOLLOW-UI-03 ${label}: wall confirmation uses consistent actions without occluding history`, async ({
  200 | 		page,
  201 | 	}, testInfo) => {
  202 | 		await page.setViewportSize({ width: layout.width, height: 844 });
  203 | 		await createRoom(page);
  204 | 		await drawWallDraft(page);
  205 | 		await setLayout(page, layout);
  206 | 		const confirmation = page.getByTestId("wall-draft-actions");
  207 | 		await expectSeparated(
  208 | 			confirmation,
  209 | 			page.getByRole("group", { name: "История изменений", exact: true }),
  210 | 		);
  211 | 		await expectSeparated(confirmation, page.getByTestId("editor-top-bar"));
  212 | 		await expectTouchable(
  213 | 			confirmation.getByRole("button", {
  214 | 				name: "Подтвердить стену",
  215 | 				exact: true,
  216 | 			}),
  217 | 			true,
  218 | 		);
  219 | 		await expectTouchable(
  220 | 			confirmation.getByRole("button", { name: "Отменить стену", exact: true }),
  221 | 			true,
  222 | 		);
  223 | 		await expectNoHorizontalScroll(confirmation);
  224 | 		await page.screenshot({
  225 | 			path: testInfo.outputPath("wall-confirmation.png"),
  226 | 			scale: "css",
  227 | 		});
  228 | 		await confirmation
  229 | 			.getByRole("button", { name: "Отменить стену", exact: true })
  230 | 			.click();
  231 | 		await expect(confirmation).toHaveCount(0);
```