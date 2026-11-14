# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-30-out-of-line: unsupported v1 schema refuses before upgrade commit
- Location: tests/browser/telegram-storage-e2e.check.ts:54:2

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 9

  Object {
    "stores": Array [
+     "library",
+     "pin-staging-leases",
+     "projects",
+     "publication-attempts",
+     "resources",
+     "revisions",
      "scope-metadata",
+     "staging",
+     "writer-fences",
    ],
-   "version": 1,
+   "version": 2,
  }
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]: Native storage test harness
```

# Test source

```ts
  1   | // @ts-nocheck
  2   | import { expect, test } from "../verification/scoped-protocol-native-test";
  3   | import type {} from "./telegram-storage-harness";
  4   | 
  5   | const scopeA = `tma-v1-${"a".repeat(64)}`;
  6   | 
  7   | test("TMA-STORAGE-27: generic transactions return their committed result and abort successful writes on callback failure", async ({ page }) => {
  8   | 	await page.goto("/");
  9   | 	await page.evaluate(() => window.__telegramScopeHarness.create("generic", "a"));
  10  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "committed"))).toEqual({ kind: "completed", result: { scope: scopeA, row: "test-marker" } });
  11  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readonly"))).toEqual({ kind: "completed", result: { scope: scopeA, row: { resourceHash: "test-marker", value: "committed" } } });
  12  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "must-roll-back", true))).toEqual({ kind: "failed" });
  13  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.rows("a", "library"))).toEqual([{ resourceHash: "test-marker", value: "committed" }]);
  14  | 	await page.evaluate(() => window.__telegramScopeHarness.relaxNextTransaction());
  15  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "must-not-write"))).toEqual({ kind: "failed" });
  16  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.rows("a", "library"))).toEqual([{ resourceHash: "test-marker", value: "committed" }]);
  17  | });
  18  | 
  19  | test("TMA-STORAGE-28: callback failure and pending drain revoke escaped composite access", async ({ page }) => {
  20  | 	await page.goto("/");
  21  | 	await page.evaluate(() => window.__telegramScopeHarness.create("generic", "a"));
  22  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.callbackThrowAndLateReserve("generic"))).toBe("denied");
  23  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.lateAccessDuringDrain("generic"))).toBe("denied");
  24  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.wrongInnerKind("generic"))).toBe("denied");
  25  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.records("a"))).toContainEqual({ key: "counter", lastReserved: "0" });
  26  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.rows("a", "library"))).toEqual([{ resourceHash: "test-marker", value: "drained" }]);
  27  | });
  28  | 
  29  | test("TMA-STORAGE-29: generic access rejects malformed metadata without requiring ID reservation and reads an exhausted healthy scope", async ({ page }) => {
  30  | 	await page.goto("/");
  31  | 	await page.evaluate(() => window.__telegramScopeHarness.create("generic", "a"));
  32  | 	await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "original"));
  33  | 	const identity = { key: "identity", protocolVersion: 1, scope: scopeA };
  34  | 	const counter = { key: "counter", lastReserved: "0" };
  35  | 	for (const records of [
  36  | 		[{ ...identity, scope: `tma-v1-${"b".repeat(64)}` }, counter],
  37  | 		[identity, counter, { key: "unknown-root" }],
  38  | 		[{ ...identity, key: "imposter-identity" }, counter],
  39  | 		[identity, { ...counter, key: "imposter-counter" }],
  40  | 		[identity, { ...counter, lastReserved: "18446744073709551616" }],
  41  | 	]) {
  42  | 		await page.evaluate((records) => window.__telegramScopeHarness.replaceMetadata("a", records), records);
  43  | 		const before = await page.evaluate(() => window.__telegramScopeHarness.records("a"));
  44  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "must-not-write"))).toEqual({ kind: "failed" });
  45  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.records("a"))).toEqual(before);
  46  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.rows("a", "library"))).toEqual([{ resourceHash: "test-marker", value: "original" }]);
  47  | 	}
  48  | 	await page.evaluate((identity) => window.__telegramScopeHarness.replaceMetadata("a", [identity, { key: "counter", lastReserved: "18446744073709551615" }]), identity);
  49  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readonly"))).toMatchObject({ kind: "completed", result: { row: { value: "original" } } });
  50  | 	expect(await page.evaluate(() => window.__telegramScopeHarness.reserve("generic", "attempt"))).toMatchObject({ kind: "failed" });
  51  | });
  52  | 
  53  | for (const shape of ["out-of-line", "auto-increment", "index"] as const) {
  54  | 	test(`TMA-STORAGE-30-${shape}: unsupported v1 schema refuses before upgrade commit`, async ({ page }) => {
  55  | 		await page.goto("/");
  56  | 		await page.evaluate((shape) => window.__telegramScopeHarness.seedMetadataV1("a", undefined, false, shape), shape);
  57  | 		const before = await page.evaluate(() => window.__telegramScopeHarness.records("a"));
  58  | 		await page.evaluate(() => window.__telegramScopeHarness.create("foreign", "a"));
  59  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.reserve("foreign", "attempt"))).toMatchObject({ kind: "failed" });
> 60  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.schema("a"))).toEqual({ version: 1, stores: ["scope-metadata"] });
      |                                                                                ^ Error: expect(received).toEqual(expected) // deep equality
  61  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.records("a"))).toEqual(before);
  62  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.activeHandles)).toBe(0);
  63  | 	});
  64  | }
  65  | 
  66  | for (const shape of ["store", "index"] as const) {
  67  | 	test(`TMA-STORAGE-31-${shape}: unsupported v2 inventory preserves metadata and closes its handle`, async ({ page }) => {
  68  | 		await page.goto("/");
  69  | 		await page.evaluate((shape) => window.__telegramScopeHarness.seedUnknownVersion2("a", shape), shape);
  70  | 		const before = await page.evaluate(() => window.__telegramScopeHarness.records("a"));
  71  | 		await page.evaluate(() => window.__telegramScopeHarness.create("foreign", "a"));
  72  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.reserve("foreign", "attempt"))).toMatchObject({ kind: "failed" });
  73  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.records("a"))).toEqual(before);
  74  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.activeHandles)).toBe(0);
  75  | 	});
  76  | }
  77  | const version2Stores = [
  78  | 	"library",
  79  | 	"pin-staging-leases",
  80  | 	"projects",
  81  | 	"publication-attempts",
  82  | 	"resources",
  83  | 	"revisions",
  84  | 	"scope-metadata",
  85  | 	"staging",
  86  | 	"writer-fences",
  87  | ];
  88  | 
  89  | test("TMA-STORAGE-23: a composite operation reserves IDs without recursively acquiring its lock", async ({
  90  | 	page,
  91  | }) => {
  92  | 	await page.goto("/");
  93  | 	await page.evaluate(() =>
  94  | 		window.__telegramScopeHarness.create("composite", "a"),
  95  | 	);
  96  | 	expect(
  97  | 		await page.evaluate(() =>
  98  | 			window.__telegramScopeHarness.compositeReservations("composite"),
  99  | 		),
  100 | 	).toEqual([`tma-v1:${scopeA}:attempt:1`, `tma-v1:${scopeA}:lease:2`]);
  101 | 	expect(
  102 | 		await page.evaluate(() =>
  103 | 			window.__telegramScopeHarness.reserve("composite", "attempt"),
  104 | 		),
  105 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:attempt:3` });
  106 | });
  107 | 
  108 | test("TMA-STORAGE-24: abandoned failed transactions reject the enclosing operation and escaped access cannot write", async ({
  109 | 	page,
  110 | }) => {
  111 | 	await page.goto("/");
  112 | 	await page.evaluate(() =>
  113 | 		window.__telegramScopeHarness.create("composite", "a"),
  114 | 	);
  115 | 	await page.evaluate(() =>
  116 | 		window.__telegramScopeHarness.reserve("composite", "attempt"),
  117 | 	);
  118 | 	expect(
  119 | 		await page.evaluate(() =>
  120 | 			window.__telegramScopeHarness.failingUnawaitedTransaction("composite"),
  121 | 		),
  122 | 	).toBe("failed");
  123 | 	expect(
  124 | 		await page.evaluate(() =>
  125 | 			window.__telegramScopeHarness.escapedTransaction("composite"),
  126 | 		),
  127 | 	).toBe("failed");
  128 | 	expect(
  129 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  130 | 	).toContainEqual({ key: "counter", lastReserved: "1" });
  131 | });
  132 | 
  133 | test("TMA-STORAGE-25: correct store names with a foreign key schema cannot issue IDs", async ({
  134 | 	page,
  135 | }) => {
  136 | 	await page.goto("/");
  137 | 	await page.evaluate(() => window.__telegramScopeHarness.seedBadVersion2("a"));
  138 | 	const before = await page.evaluate(() =>
  139 | 		window.__telegramScopeHarness.records("a"),
  140 | 	);
  141 | 	await page.evaluate(() =>
  142 | 		window.__telegramScopeHarness.create("foreign", "a"),
  143 | 	);
  144 | 	expect(
  145 | 		await page.evaluate(() =>
  146 | 			window.__telegramScopeHarness.reserve("foreign", "attempt"),
  147 | 		),
  148 | 	).toMatchObject({ kind: "failed" });
  149 | 	expect(
  150 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  151 | 	).toEqual(before);
  152 | });
  153 | 
  154 | test("TMA-STORAGE-26: unknown metadata in an existing v2 database blocks reservation without mutation", async ({
  155 | 	page,
  156 | }) => {
  157 | 	await page.goto("/");
  158 | 	await page.evaluate(() =>
  159 | 		window.__telegramScopeHarness.create("existing", "a"),
  160 | 	);
```