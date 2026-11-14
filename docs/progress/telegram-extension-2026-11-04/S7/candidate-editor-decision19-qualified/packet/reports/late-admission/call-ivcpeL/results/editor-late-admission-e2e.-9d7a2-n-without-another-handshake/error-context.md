# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-late-admission-e2e.check.ts >> LATE-ADMISSION-01 promotes a settled readonly screen after trusted admission without another handshake
- Location: tests/browser/editor-late-admission-e2e.check.ts:26:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: locator('[aria-label="Проверка совместимости обновления"]')
Expected: "true"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for locator('[aria-label="Проверка совместимости обновления"]')

```

```yaml
- main: Только чтение
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | declare const process: { readonly env: Readonly<Record<string, string | undefined>> };
  3   | 
  4   | test.beforeEach(async ({ page }, testInfo) => {
  5   | 	await page.goto("/");
  6   | 	await page.waitForFunction(() => !!window.__lateAdmission);
  7   | 	const actual = await page.evaluate(() => window.__lateAdmissionSubject);
  8   | 	await testInfo.attach("actual-editor-subject", {
  9   | 		body: JSON.stringify(actual),
  10  | 		contentType: "application/json",
  11  | 	});
  12  | 	if (
  13  | 		!actual ||
  14  | 		actual.sha256 !== process.env.LATE_ADMISSION_EXPECT_SHA ||
  15  | 		actual.instrumented !==
  16  | 			(process.env.LATE_ADMISSION_EXPECT_INSTRUMENTED === "true") ||
  17  | 		actual.localActive !== (process.env.__STRYKER_ACTIVE_MUTANT__ ?? null) ||
  18  | 		(process.env.__STRYKER_ACTIVE_MUTANT__ && !actual.instrumented)
  19  | 	)
  20  | 		throw new Error(
  21  | 			"LATE_ADMISSION_PROOF_INVALID: actual module SHA/local namespace mismatch",
  22  | 		);
  23  | });
  24  | const busy = '[aria-label="Проверка совместимости обновления"]';
  25  | 
  26  | test("LATE-ADMISSION-01 promotes a settled readonly screen after trusted admission without another handshake", async ({
  27  | 	page,
  28  | }) => {
  29  | 	await page.evaluate(() => window.__lateAdmission.mount(false));
> 30  | 	await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
      |                                   ^ Error: expect(locator).toHaveAttribute(expected) failed
  31  | 	await page.evaluate(() =>
  32  | 		window.__lateAdmission.resolve("read-only/exportable"),
  33  | 	);
  34  | 	await expect(page.getByTestId("late-readonly")).toBeVisible();
  35  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(true));
  36  | 	await expect(page.getByTestId("project-hub")).toBeVisible();
  37  | 	await expect(page.getByTestId("late-readonly")).toHaveCount(0);
  38  | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  39  | 		reads: 1,
  40  | 		handshakes: 1,
  41  | 	});
  42  | });
  43  | 
  44  | test("LATE-ADMISSION-02 revokes and restores a settled writable screen without another handshake", async ({
  45  | 	page,
  46  | }) => {
  47  | 	await page.evaluate(() => window.__lateAdmission.mount(true));
  48  | 	await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  49  | 	await expect(page.getByTestId("project-hub")).toBeVisible();
  50  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(false));
  51  | 	await expect(page.getByTestId("late-readonly")).toBeVisible();
  52  | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  53  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(true));
  54  | 	await expect(page.getByTestId("project-hub")).toBeVisible();
  55  | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  56  | 		reads: 1,
  57  | 		handshakes: 1,
  58  | 	});
  59  | });
  60  | 
  61  | test("LATE-ADMISSION-03 unspecified admission preserves writable startup", async ({
  62  | 	page,
  63  | }) => {
  64  | 	await page.evaluate(() => window.__lateAdmission.mount(undefined));
  65  | 	await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  66  | 	await expect(page.getByTestId("project-hub")).toBeVisible();
  67  | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  68  | 		reads: 1,
  69  | 		handshakes: 1,
  70  | 	});
  71  | });
  72  | 
  73  | test("LATE-ADMISSION-04 unspecified admission preserves readonly startup", async ({
  74  | 	page,
  75  | }) => {
  76  | 	await page.evaluate(() => window.__lateAdmission.mount(undefined));
  77  | 	await page.evaluate(() =>
  78  | 		window.__lateAdmission.resolve("read-only/exportable"),
  79  | 	);
  80  | 	await expect(page.getByTestId("late-readonly")).toBeVisible();
  81  | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  82  | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  83  | 		reads: 1,
  84  | 		handshakes: 1,
  85  | 	});
  86  | });
  87  | 
  88  | test("LATE-ADMISSION-05 neither checking nor migration is bypassed by admission", async ({
  89  | 	page,
  90  | }) => {
  91  | 	await page.evaluate(() => window.__lateAdmission.mount(true));
  92  | 	await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  93  | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  94  | 	await page.evaluate(() =>
  95  | 		window.__lateAdmission.resolve("migration-in-progress"),
  96  | 	);
  97  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(false));
  98  | 	await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  99  | 	await page.evaluate(() => window.__lateAdmission.setAdmission(true));
  100 | 	await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  101 | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  102 | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  103 | 		reads: 1,
  104 | 		handshakes: 1,
  105 | 	});
  106 | });
  107 | 
  108 | test("LATE-ADMISSION-06 explicit denial overrides a writable startup result", async ({
  109 | 	page,
  110 | }) => {
  111 | 	await page.evaluate(() => window.__lateAdmission.mount(false));
  112 | 	await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  113 | 	await expect(page.getByTestId("late-readonly")).toBeVisible();
  114 | 	await expect(page.getByTestId("project-hub")).toHaveCount(0);
  115 | 	expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({
  116 | 		reads: 1,
  117 | 		handshakes: 1,
  118 | 	});
  119 | });
  120 | 
```