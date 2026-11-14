# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scoped-public-admission-e2e.check.ts >> SCOPED-INPUT-domain: invalid incoming candidate cannot publish or mutate any native store
- Location: tests/browser/scoped-public-admission-e2e.check.ts:40:2

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 1

  Object {
-   "kind": "persist-failed",
-   "reasonCode": "PERSISTENCE_WRITE_FAILED",
+   "kind": "durable",
  }
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
  1   | import {
  2   | 	expect,
  3   | 	test,
  4   | 	type Page,
  5   | } from "../verification/scoped-protocol-native-test";
  6   | import type {} from "./telegram-storage-harness";
  7   | 
  8   | const allStores = [
  9   | 	"scope-metadata",
  10  | 	"projects",
  11  | 	"revisions",
  12  | 	"staging",
  13  | 	"writer-fences",
  14  | 	"publication-attempts",
  15  | 	"pin-staging-leases",
  16  | 	"resources",
  17  | 	"library",
  18  | ];
  19  | async function snapshot(page: Page) {
  20  | 	return page.evaluate(
  21  | 		async (names) =>
  22  | 			Promise.all(
  23  | 				names.map(async (store) => ({
  24  | 					store,
  25  | 					rows: await window.__telegramProjectHarness.rows("a", store),
  26  | 				})),
  27  | 			),
  28  | 		allStores,
  29  | 	);
  30  | }
  31  | 
  32  | test.beforeEach(async ({ page }) => {
  33  | 	await page.goto("/");
  34  | 	await page.evaluate(() =>
  35  | 		window.__telegramProjectHarness.create("a", "a", "owner-a"),
  36  | 	);
  37  | });
  38  | 
  39  | for (const mode of ["checksum", "domain"] as const) {
  40  | 	test(`SCOPED-INPUT-${mode}: invalid incoming candidate cannot publish or mutate any native store`, async ({
  41  | 		page,
  42  | 	}) => {
  43  | 		expect(
  44  | 			await page.evaluate(() =>
  45  | 				window.__telegramProjectHarness.publishFixture("a", "kept", "kept-r1"),
  46  | 			),
  47  | 		).toEqual({ kind: "durable" });
  48  | 		const healthy = await page.evaluate(() =>
  49  | 			window.__telegramProjectHarness.load("a", "kept"),
  50  | 		);
  51  | 		const before = await snapshot(page);
  52  | 		const result = await page.evaluate(
  53  | 			(mode) =>
  54  | 				window.__telegramProjectHarness.publishInvalidIncoming("a", mode),
  55  | 			mode,
  56  | 		);
  57  | 		expect(result.checksumMatches).toBe(mode === "domain");
  58  | 		expect(result.validation.kind).toBe(
  59  | 			mode === "domain" ? "rejected" : "accepted",
  60  | 		);
> 61  | 		expect(result.publication).toEqual({
      |                              ^ Error: expect(received).toEqual(expected) // deep equality
  62  | 			kind: "persist-failed",
  63  | 			reasonCode: "PERSISTENCE_WRITE_FAILED",
  64  | 		});
  65  | 		expect(result.sourceAfter).toEqual(result.sourceBefore);
  66  | 		expect(await snapshot(page)).toEqual(before);
  67  | 		expect(
  68  | 			await page.evaluate(() =>
  69  | 				window.__telegramProjectHarness.load("a", "kept"),
  70  | 			),
  71  | 		).toEqual(healthy);
  72  | 		const modes = await page.evaluate(
  73  | 			() => window.__telegramScopeHarness.durabilityModes,
  74  | 		);
  75  | 		expect(modes.length).toBeGreaterThan(0);
  76  | 		expect(modes.every((value) => value === "strict")).toBe(true);
  77  | 	});
  78  | }
  79  | 
  80  | test("SCOPED-LOSS: fresh and healthy runtime has no false loss, a real takeover reports loss once without releasing its fence", async ({
  81  | 	page,
  82  | 	context,
  83  | }) => {
  84  | 	expect(
  85  | 		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
  86  | 	).toBe(false);
  87  | 	expect(
  88  | 		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
  89  | 	).toBe(false);
  90  | 	expect(
  91  | 		await page.evaluate(() =>
  92  | 			window.__telegramProjectHarness.publishFixture("a", "kept", "kept-r1"),
  93  | 		),
  94  | 	).toEqual({ kind: "durable" });
  95  | 	expect(
  96  | 		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
  97  | 	).toBe(false);
  98  | 	const other = await context.newPage();
  99  | 	await other.goto("/");
  100 | 	await other.evaluate(() =>
  101 | 		window.__telegramProjectHarness.create("b", "a", "owner-b"),
  102 | 	);
  103 | 	expect(
  104 | 		await other.evaluate(() =>
  105 | 			window.__telegramProjectHarness.takeover("b", "kept"),
  106 | 		),
  107 | 	).toMatchObject({ kind: "writable" });
  108 | 	const before = await snapshot(page);
  109 | 	expect(
  110 | 		await page.evaluate(() =>
  111 | 			window.__telegramProjectHarness.publishFixture(
  112 | 				"a",
  113 | 				"kept",
  114 | 				"denied-r2",
  115 | 				"kept-r1",
  116 | 			),
  117 | 		),
  118 | 	).toMatchObject({ kind: "persist-failed" });
  119 | 	expect(
  120 | 		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
  121 | 	).toBe(true);
  122 | 	expect(
  123 | 		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
  124 | 	).toBe(false);
  125 | 	expect(
  126 | 		await page.evaluate(() =>
  127 | 			window.__telegramProjectHarness.access("a", "kept"),
  128 | 		),
  129 | 	).toMatchObject({ kind: "read-only" });
  130 | 	expect(await snapshot(page)).toEqual(before);
  131 | 	expect(
  132 | 		await other.evaluate(() =>
  133 | 			window.__telegramProjectHarness.publishFixture(
  134 | 				"b",
  135 | 				"kept",
  136 | 				"kept-r2",
  137 | 				"kept-r1",
  138 | 			),
  139 | 		),
  140 | 	).toEqual({ kind: "durable" });
  141 | 	expect(
  142 | 		await other.evaluate(() => window.__telegramProjectHarness.lost("b")),
  143 | 	).toBe(false);
  144 | 	expect(
  145 | 		await page.evaluate(() =>
  146 | 			window.__telegramProjectHarness.load("a", "kept"),
  147 | 		),
  148 | 	).toMatchObject({
  149 | 		kind: "durable",
  150 | 		candidate: { revision: { revisionId: "kept-r2" } },
  151 | 	});
  152 | });
  153 | 
```