# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-late-admission-e2e.check.ts >> LATE-ADMISSION-01 promotes a settled readonly screen after trusted admission without another handshake
- Location: tests/browser/editor-late-admission-e2e.check.ts:9:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('project-hub')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('project-hub')

```

```yaml
- main: Только чтение
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test.beforeEach(async ({ page }) => {
  4  |  await page.goto("/");
  5  |  await page.waitForFunction(() => !!window.__lateAdmission);
  6  | });
  7  | const busy = '[aria-label="Проверка совместимости обновления"]';
  8  | 
  9  | test("LATE-ADMISSION-01 promotes a settled readonly screen after trusted admission without another handshake", async ({ page }) => {
  10 |  await page.evaluate(() => window.__lateAdmission.mount(false));
  11 |  await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  12 |  await page.evaluate(() => window.__lateAdmission.resolve("read-only/exportable"));
  13 |  await expect(page.getByTestId("late-readonly")).toBeVisible();
  14 |  await page.evaluate(() => window.__lateAdmission.setAdmission(true));
> 15 |  await expect(page.getByTestId("project-hub")).toBeVisible();
     |                                                ^ Error: expect(locator).toBeVisible() failed
  16 |  await expect(page.getByTestId("late-readonly")).toHaveCount(0);
  17 |  expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({ reads: 1, handshakes: 1 });
  18 | });
  19 | 
  20 | test("LATE-ADMISSION-02 revokes and restores a settled writable screen without another handshake", async ({ page }) => {
  21 |  await page.evaluate(() => window.__lateAdmission.mount(true));
  22 |  await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  23 |  await expect(page.getByTestId("project-hub")).toBeVisible();
  24 |  await page.evaluate(() => window.__lateAdmission.setAdmission(false));
  25 |  await expect(page.getByTestId("late-readonly")).toBeVisible();
  26 |  await expect(page.getByTestId("project-hub")).toHaveCount(0);
  27 |  await page.evaluate(() => window.__lateAdmission.setAdmission(true));
  28 |  await expect(page.getByTestId("project-hub")).toBeVisible();
  29 |  expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({ reads: 1, handshakes: 1 });
  30 | });
  31 | 
  32 | test("LATE-ADMISSION-03 unspecified admission preserves writable startup", async ({ page }) => {
  33 |  await page.evaluate(() => window.__lateAdmission.mount(undefined));
  34 |  await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  35 |  await expect(page.getByTestId("project-hub")).toBeVisible();
  36 |  expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({ reads: 1, handshakes: 1 });
  37 | });
  38 | 
  39 | test("LATE-ADMISSION-04 unspecified admission preserves readonly startup", async ({ page }) => {
  40 |  await page.evaluate(() => window.__lateAdmission.mount(undefined));
  41 |  await page.evaluate(() => window.__lateAdmission.resolve("read-only/exportable"));
  42 |  await expect(page.getByTestId("late-readonly")).toBeVisible();
  43 |  await expect(page.getByTestId("project-hub")).toHaveCount(0);
  44 |  expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({ reads: 1, handshakes: 1 });
  45 | });
  46 | 
  47 | test("LATE-ADMISSION-05 neither checking nor migration is bypassed by admission", async ({ page }) => {
  48 |  await page.evaluate(() => window.__lateAdmission.mount(true));
  49 |  await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  50 |  await expect(page.getByTestId("project-hub")).toHaveCount(0);
  51 |  await page.evaluate(() => window.__lateAdmission.resolve("migration-in-progress"));
  52 |  await page.evaluate(() => window.__lateAdmission.setAdmission(false));
  53 |  await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  54 |  await page.evaluate(() => window.__lateAdmission.setAdmission(true));
  55 |  await expect(page.locator(busy)).toHaveAttribute("aria-busy", "true");
  56 |  await expect(page.getByTestId("project-hub")).toHaveCount(0);
  57 |  expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({ reads: 1, handshakes: 1 });
  58 | });
  59 | 
  60 | test("LATE-ADMISSION-06 explicit denial overrides a writable startup result", async ({ page }) => {
  61 |  await page.evaluate(() => window.__lateAdmission.mount(false));
  62 |  await page.evaluate(() => window.__lateAdmission.resolve("writable"));
  63 |  await expect(page.getByTestId("late-readonly")).toBeVisible();
  64 |  await expect(page.getByTestId("project-hub")).toHaveCount(0);
  65 |  expect(await page.evaluate(() => window.__lateAdmission.stats())).toEqual({ reads: 1, handshakes: 1 });
  66 | });
  67 | 
```