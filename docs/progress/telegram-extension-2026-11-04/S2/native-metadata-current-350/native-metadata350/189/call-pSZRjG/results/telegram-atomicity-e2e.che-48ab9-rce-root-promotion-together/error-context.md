# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-atomicity-e2e.check.ts >> TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together
- Location: tests/browser/telegram-atomicity-e2e.check.ts:5:1

# Error details

```
Test timeout of 10000ms exceeded.
```

```
Error: page.evaluate: Test timeout of 10000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
  1   | // @ts-nocheck
  2   | import { expect, test } from "../verification/scoped-protocol-native-test";
  3   | import type {} from "./telegram-storage-harness";
  4   | 
  5   | test("TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together", async ({
  6   | 	page,
  7   | }) => {
  8   | 	await page.goto("/");
  9   | 	await page.evaluate(() =>
  10  | 		window.__telegramProjectHarness.create("a", "a", "owner-a"),
  11  | 	);
> 12  | 	await page.evaluate(() =>
      |             ^ Error: page.evaluate: Test timeout of 10000ms exceeded.
  13  | 		window.__telegramProjectHarness.prepareResource(
  14  | 			"a",
  15  | 			"first",
  16  | 			"p1",
  17  | 			"r1",
  18  | 			[71, 72, 73],
  19  | 		),
  20  | 	);
  21  | 	await page.evaluate(() =>
  22  | 		window.__telegramProjectHarness.writePrepared("a", "first"),
  23  | 	);
  24  | 	await page.evaluate(() =>
  25  | 		window.__telegramProjectHarness.abortNextProjectPointer(),
  26  | 	);
  27  | 	expect(
  28  | 		await page.evaluate(() =>
  29  | 			window.__telegramProjectHarness.publishPrepared("a", "first"),
  30  | 		),
  31  | 	).toMatchObject({ kind: "persist-failed" });
  32  | 	expect(
  33  | 		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
  34  | 	).toEqual({ kind: "empty" });
  35  | 	expect(
  36  | 		await page.evaluate(() =>
  37  | 			window.__telegramProjectHarness.rows("a", "publication-attempts"),
  38  | 		),
  39  | 	).toMatchObject([{ state: "prepared" }]);
  40  | 	expect(
  41  | 		await page.evaluate(() =>
  42  | 			window.__telegramProjectHarness.rows("a", "resources"),
  43  | 		),
  44  | 	).toMatchObject([{ durable: false, roots: [expect.any(String)] }]);
  45  | 	expect(
  46  | 		await page.evaluate(() =>
  47  | 			window.__telegramProjectHarness.resourceBytes("a", "first"),
  48  | 		),
  49  | 	).toEqual([71, 72, 73]);
  50  | 	expect(
  51  | 		await page.evaluate(() =>
  52  | 			window.__telegramProjectHarness.publishPrepared("a", "first"),
  53  | 		),
  54  | 	).toEqual({ kind: "durable" });
  55  | });
  56  | 
  57  | test("TMA-ATOMIC-02: cancel abort after native byte deletion rolls back no-publish, stage, Revision, lease and bytes", async ({
  58  | 	page,
  59  | }) => {
  60  | 	await page.goto("/");
  61  | 	await page.evaluate(() =>
  62  | 		window.__telegramProjectHarness.create("a", "a", "owner-a"),
  63  | 	);
  64  | 	await page.evaluate(() =>
  65  | 		window.__telegramProjectHarness.prepareResource(
  66  | 			"a",
  67  | 			"first",
  68  | 			"p1",
  69  | 			"r1",
  70  | 			[74, 75, 76],
  71  | 		),
  72  | 	);
  73  | 	await page.evaluate(() =>
  74  | 		window.__telegramProjectHarness.writePrepared("a", "first"),
  75  | 	);
  76  | 	const names = [
  77  | 		"staging",
  78  | 		"revisions",
  79  | 		"publication-attempts",
  80  | 		"pin-staging-leases",
  81  | 	];
  82  | 	const before = await page.evaluate(
  83  | 		async (names) =>
  84  | 			Promise.all(
  85  | 				names.map((name) => window.__telegramProjectHarness.rows("a", name)),
  86  | 			),
  87  | 		names,
  88  | 	);
  89  | 	await page.evaluate(() =>
  90  | 		window.__telegramProjectHarness.abortNextMutation("resources", "delete"),
  91  | 	);
  92  | 	await expect(
  93  | 		page.evaluate(() =>
  94  | 			window.__telegramProjectHarness.discardPrepared("a", "first"),
  95  | 		),
  96  | 	).rejects.toThrow();
  97  | 	expect(
  98  | 		await page.evaluate(
  99  | 			async (names) =>
  100 | 				Promise.all(
  101 | 					names.map((name) => window.__telegramProjectHarness.rows("a", name)),
  102 | 				),
  103 | 			names,
  104 | 		),
  105 | 	).toEqual(before);
  106 | 	expect(
  107 | 		await page.evaluate(() =>
  108 | 			window.__telegramProjectHarness.resourceBytes("a", "first"),
  109 | 		),
  110 | 	).toEqual([74, 75, 76]);
  111 | 	await page.evaluate(() =>
  112 | 		window.__telegramProjectHarness.discardPrepared("a", "first"),
```