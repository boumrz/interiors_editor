# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scoped-composition-owner-e2e.check.ts >> SCOPED-OWNER: mutable composition options cannot lend another live writer identity to an existing runtime
- Location: tests/browser/scoped-composition-owner-e2e.check.ts:4:1

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
-   "kind": "persist-failed",
+   "kind": "durable",
  }
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
  1  | import { expect, test } from "../verification/scoped-protocol-native-test";
  2  | import type {} from "./telegram-storage-harness";
  3  | 
  4  | test("SCOPED-OWNER: mutable composition options cannot lend another live writer identity to an existing runtime", async ({
  5  | 	page,
  6  | 	context,
  7  | }) => {
  8  | 	await page.goto("/");
  9  | 	await page.evaluate(() =>
  10 | 		window.__telegramProjectHarness.create("a", "a", "owner-a"),
  11 | 	);
  12 | 	const other = await context.newPage();
  13 | 	await other.goto("/");
  14 | 	await other.evaluate(() =>
  15 | 		window.__telegramProjectHarness.create("b", "a", "owner-b"),
  16 | 	);
  17 | 	expect(
  18 | 		await other.evaluate(() =>
  19 | 			window.__telegramProjectHarness.publishFixture("b", "kept", "kept-r1"),
  20 | 		),
  21 | 	).toEqual({ kind: "durable" });
  22 | 	const snapshot = () =>
  23 | 		page.evaluate(async () =>
  24 | 			Promise.all(
  25 | 				[
  26 | 					"scope-metadata",
  27 | 					"projects",
  28 | 					"revisions",
  29 | 					"staging",
  30 | 					"writer-fences",
  31 | 					"publication-attempts",
  32 | 					"pin-staging-leases",
  33 | 					"resources",
  34 | 					"library",
  35 | 				].map(async (store) => ({
  36 | 					store,
  37 | 					rows: await window.__telegramProjectHarness.rows("a", store),
  38 | 				})),
  39 | 			),
  40 | 		);
  41 | 	const before = await snapshot();
  42 | 	await page.evaluate(() =>
  43 | 		window.__telegramProjectHarness.changeCompositionOwner("a", "owner-b"),
  44 | 	);
  45 | 	expect(
  46 | 		await page.evaluate(() =>
  47 | 			window.__telegramProjectHarness.publishFixture(
  48 | 				"a",
  49 | 				"kept",
  50 | 				"unconfirmed-r2",
  51 | 				"kept-r1",
  52 | 			),
  53 | 		),
> 54 | 	).toMatchObject({ kind: "persist-failed" });
     |    ^ Error: expect(received).toMatchObject(expected)
  55 | 	expect(await snapshot()).toEqual(before);
  56 | 	expect(
  57 | 		await page.evaluate(() =>
  58 | 			window.__telegramProjectHarness.access("a", "kept"),
  59 | 		),
  60 | 	).toMatchObject({ kind: "read-only" });
  61 | 	expect(
  62 | 		await other.evaluate(() =>
  63 | 			window.__telegramProjectHarness.publishFixture(
  64 | 				"b",
  65 | 				"kept",
  66 | 				"kept-r2",
  67 | 				"kept-r1",
  68 | 			),
  69 | 		),
  70 | 	).toEqual({ kind: "durable" });
  71 | 	expect(
  72 | 		await page.evaluate(() =>
  73 | 			window.__telegramProjectHarness.load("a", "kept"),
  74 | 		),
  75 | 	).toMatchObject({
  76 | 		kind: "durable",
  77 | 		candidate: { revision: { revisionId: "kept-r2" } },
  78 | 	});
  79 | 	const modes = await page.evaluate(
  80 | 		() => window.__telegramScopeHarness.durabilityModes,
  81 | 	);
  82 | 	expect(modes.length).toBeGreaterThan(0);
  83 | 	expect(modes.every((mode) => mode === "strict")).toBe(true);
  84 | });
  85 | 
```