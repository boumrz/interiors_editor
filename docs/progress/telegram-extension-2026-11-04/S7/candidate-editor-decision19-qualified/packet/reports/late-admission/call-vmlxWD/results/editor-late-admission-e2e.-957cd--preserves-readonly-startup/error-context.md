# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-late-admission-e2e.check.ts >> LATE-ADMISSION-04 unspecified admission preserves readonly startup
- Location: tests/browser/editor-late-admission-e2e.check.ts:75:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('late-readonly')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('late-readonly')

```

```yaml
- main:
  - region "Проекты":
    - heading "Проекты" [level=1]
    - paragraph: Планы на этом устройстве
    - button "Новый проект"
    - button "Импортировать проект"
    - button "Импортировать проект"
    - button "Восстановить несохранённую правку"
    - region "Пустой список проектов":
      - strong: Пока нет проектов
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | declare const process: {
  3   | 	readonly env: Readonly<Record<string, string | undefined>>;
  4   | };
  5   | 
  6   | test.beforeEach(async ({ page }, testInfo) => {
  7   | 	await page.goto("/");
  8   | 	await page.waitForFunction(() => !!window.__lateAdmission);
  9   | 	const actual = await page.evaluate(() => window.__lateAdmissionSubject);
  10  | 	await testInfo.attach("actual-editor-subject", {
  11  | 		body: JSON.stringify(actual),
  12  | 		contentType: "application/json",
  13  | 	});
  14  | 	if (
  15  | 		!actual ||
  16  | 		actual.sha256 !== process.env.LATE_ADMISSION_EXPECT_SHA ||
  17  | 		actual.instrumented !==
  18  | 			(process.env.LATE_ADMISSION_EXPECT_INSTRUMENTED === "true") ||
  19  | 		actual.localActive !== (process.env.__STRYKER_ACTIVE_MUTANT__ ?? null) ||
  20  | 		(process.env.__STRYKER_ACTIVE_MUTANT__ && !actual.instrumented)
  21  | 	)
  22  | 		throw new Error(
  23  | 			"LATE_ADMISSION_PROOF_INVALID: actual module SHA/local namespace mismatch",
  24  | 		);
  25  | });
  26  | const busy = '[aria-label="Проверка совместимости обновления"]';
  27  | 
  28  | test("LATE-ADMISSION-01 promotes a settled readonly screen after trusted admission without another handshake", async ({
  29  | 	page,
  30  | }) => {
  31  | 	await page.evaluate(() => window.__lateAdmission.mount(false));
  32  | 	await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  33  | 	await page.evaluate(() =>
  34  | 		window.__lateAdmission.resolve("read-only/exportable"),
  35  | 	);
  36  | 	await expect(page.getByTestId("late-readonly")).toBeVisible();
  37  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(true));
  38  | 	await expect(page.getByTestId("project-hub")).toBeVisible();
  39  | 	await expect(page.getByTestId("late-readonly")).toHaveCount(0);
  40  | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  41  | 		reads: 1,
  42  | 		handshakes: 1,
  43  | 	});
  44  | });
  45  | 
  46  | test("LATE-ADMISSION-02 revokes and restores a settled writable screen without another handshake", async ({
  47  | 	page,
  48  | }) => {
  49  | 	await page.evaluate(() => window.__lateAdmission.mount(true));
  50  | 	await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  51  | 	await expect(page.getByTestId("project-hub")).toBeVisible();
  52  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(false));
  53  | 	await expect(page.getByTestId("late-readonly")).toBeVisible();
  54  | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  55  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(true));
  56  | 	await expect(page.getByTestId("project-hub")).toBeVisible();
  57  | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  58  | 		reads: 1,
  59  | 		handshakes: 1,
  60  | 	});
  61  | });
  62  | 
  63  | test("LATE-ADMISSION-03 unspecified admission preserves writable startup", async ({
  64  | 	page,
  65  | }) => {
  66  | 	await page.evaluate(() => window.__lateAdmission.mount(undefined));
  67  | 	await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  68  | 	await expect(page.getByTestId("project-hub")).toBeVisible();
  69  | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  70  | 		reads: 1,
  71  | 		handshakes: 1,
  72  | 	});
  73  | });
  74  | 
  75  | test("LATE-ADMISSION-04 unspecified admission preserves readonly startup", async ({
  76  | 	page,
  77  | }) => {
  78  | 	await page.evaluate(() => window.__lateAdmission.mount(undefined));
  79  | 	await page.evaluate(() =>
  80  | 		window.__lateAdmission.resolve("read-only/exportable"),
  81  | 	);
> 82  | 	await expect(page.getByTestId("late-readonly")).toBeVisible();
      |                                                  ^ Error: expect(locator).toBeVisible() failed
  83  | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  84  | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  85  | 		reads: 1,
  86  | 		handshakes: 1,
  87  | 	});
  88  | });
  89  | 
  90  | test("LATE-ADMISSION-05 neither checking nor migration is bypassed by admission", async ({
  91  | 	page,
  92  | }) => {
  93  | 	await page.evaluate(() => window.__lateAdmission.mount(true));
  94  | 	await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  95  | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  96  | 	await page.evaluate(() =>
  97  | 		window.__lateAdmission.resolve("migration-in-progress"),
  98  | 	);
  99  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(false));
  100 | 	await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  101 | 	await page.evaluate(() => window.__lateAdmission.setAdmission(true));
  102 | 	await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  103 | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  104 | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  105 | 		reads: 1,
  106 | 		handshakes: 1,
  107 | 	});
  108 | });
  109 | 
  110 | test("LATE-ADMISSION-06 explicit denial overrides a writable startup result", async ({
  111 | 	page,
  112 | }) => {
  113 | 	await page.evaluate(() => window.__lateAdmission.mount(false));
  114 | 	await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  115 | 	await expect(page.getByTestId("late-readonly")).toBeVisible();
  116 | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  117 | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  118 | 		reads: 1,
  119 | 		handshakes: 1,
  120 | 	});
  121 | });
  122 | 
  123 | test("LATE-ADMISSION-07 explicit denial after writable startup uses empty recovery without a fabricated download", async ({
  124 | 	page,
  125 | }) => {
  126 | 	await page.evaluate(() => window.__lateAdmission.mount(false, false));
  127 | 	await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  128 | 	await expect(
  129 | 		page.getByRole("heading", { name: "Безопасное восстановление проекта" }),
  130 | 	).toBeVisible();
  131 | 	await expect(
  132 | 		page.getByText("Доступной для экспорта читаемой копии не найдено."),
  133 | 	).toBeVisible();
  134 | 	await expect(
  135 | 		page.getByRole("button", { name: "Скачать копию для восстановления" }),
  136 | 	).toHaveCount(0);
  137 | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  138 | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  139 | 		reads: 1,
  140 | 		handshakes: 1,
  141 | 	});
  142 | });
  143 | 
  144 | test("LATE-ADMISSION-08 unspecified admission retains the exact original recovery download", async ({
  145 | 	page,
  146 | }) => {
  147 | 	const raw = ' {\n"future":true,"name":"Пример"\n}\n';
  148 | 	await page.evaluate(() => window.__lateAdmission.mount(undefined, false));
  149 | 	await page.evaluate(
  150 | 		(value) =>
  151 | 			window.__lateAdmission.resolve("read-only/exportable", {
  152 | 				projectId: "preserved-source",
  153 | 				serializedProject: value,
  154 | 			}),
  155 | 		raw,
  156 | 	);
  157 | 	await expect(
  158 | 		page.getByRole("heading", { name: "Безопасное восстановление проекта" }),
  159 | 	).toBeVisible();
  160 | 	const downloadPromise = page.waitForEvent("download");
  161 | 	await page
  162 | 		.getByRole("button", { name: "Скачать копию для восстановления" })
  163 | 		.click();
  164 | 	const download = await downloadPromise;
  165 | 	expect(download.suggestedFilename()).toBe("preserved-source-recovery.json");
  166 | 	const stream = await download.createReadStream();
  167 | 	if (!stream)
  168 | 		throw new Error(
  169 | 			"LATE_ADMISSION_PROOF_INVALID: local download stream unavailable",
  170 | 		);
  171 | 	const decoder = new TextDecoder();
  172 | 	let actual = "";
  173 | 	for await (const chunk of stream)
  174 | 		actual += decoder.decode(chunk, { stream: true });
  175 | 	actual += decoder.decode();
  176 | 	expect(actual).toBe(raw);
  177 | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  178 | 		reads: 1,
  179 | 		handshakes: 1,
  180 | 	});
  181 | });
  182 | 
```