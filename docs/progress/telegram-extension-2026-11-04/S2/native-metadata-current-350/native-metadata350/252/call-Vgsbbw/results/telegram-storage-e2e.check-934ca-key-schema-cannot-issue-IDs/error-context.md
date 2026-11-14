# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-25: correct store names with a foreign key schema cannot issue IDs
- Location: tests/browser/telegram-storage-e2e.check.ts:133:1

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
-   "kind": "failed",
+   "kind": "reserved",
  }
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]: Native storage test harness
```

# Test source

```ts
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
  60  | 		expect(await page.evaluate(() => window.__telegramScopeHarness.schema("a"))).toEqual({ version: 1, stores: ["scope-metadata"] });
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
> 148 | 	).toMatchObject({ kind: "failed" });
      |    ^ Error: expect(received).toMatchObject(expected)
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
  161 | 	await page.evaluate(() =>
  162 | 		window.__telegramScopeHarness.reserve("existing", "attempt"),
  163 | 	);
  164 | 	await page.evaluate(() =>
  165 | 		window.__telegramScopeHarness.edit("a", {
  166 | 			key: "unknown-root",
  167 | 			payload: "keep",
  168 | 		}),
  169 | 	);
  170 | 	const before = await page.evaluate(() =>
  171 | 		window.__telegramScopeHarness.records("a"),
  172 | 	);
  173 | 	expect(
  174 | 		await page.evaluate(() =>
  175 | 			window.__telegramScopeHarness.reserve("existing", "lease"),
  176 | 		),
  177 | 	).toMatchObject({ kind: "failed" });
  178 | 	expect(
  179 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  180 | 	).toEqual(before);
  181 | });
  182 | 
  183 | test("TMA-STORAGE-19: upgrades metadata v1 atomically while preserving the exact uint64 counter", async ({
  184 | 	page,
  185 | }) => {
  186 | 	await page.goto("/");
  187 | 	await page.evaluate(() => window.__telegramScopeHarness.seedMetadataV1("a"));
  188 | 	await page.evaluate(() =>
  189 | 		window.__telegramScopeHarness.create("upgraded", "a"),
  190 | 	);
  191 | 	expect(
  192 | 		await page.evaluate(() =>
  193 | 			window.__telegramScopeHarness.reserve("upgraded", "attempt"),
  194 | 		),
  195 | 	).toEqual({
  196 | 		kind: "reserved",
  197 | 		id: `tma-v1:${scopeA}:attempt:9007199254740994`,
  198 | 	});
  199 | 	expect(
  200 | 		await page.evaluate(() => window.__telegramScopeHarness.schema("a")),
  201 | 	).toEqual({ version: 2, stores: version2Stores });
  202 | 	expect(
  203 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  204 | 	).toEqual([
  205 | 		{ key: "counter", lastReserved: "9007199254740994" },
  206 | 		{ key: "identity", protocolVersion: 1, scope: scopeA },
  207 | 	]);
  208 | });
  209 | 
  210 | test("TMA-STORAGE-20: corrupt existing metadata aborts migration without adding stores or resetting bytes", async ({
  211 | 	page,
  212 | }) => {
  213 | 	await page.goto("/");
  214 | 	const records = [
  215 | 		{ key: "identity", protocolVersion: 1, scope: scopeA },
  216 | 		{ key: "counter", lastReserved: "broken-counter" },
  217 | 	];
  218 | 	await page.evaluate(
  219 | 		(records) => window.__telegramScopeHarness.seedMetadataV1("a", records),
  220 | 		records,
  221 | 	);
  222 | 	await page.evaluate(() =>
  223 | 		window.__telegramScopeHarness.create("corrupt", "a"),
  224 | 	);
  225 | 	expect(
  226 | 		await page.evaluate(() =>
  227 | 			window.__telegramScopeHarness.reserve("corrupt", "attempt"),
  228 | 		),
  229 | 	).toMatchObject({ kind: "failed" });
  230 | 	expect(
  231 | 		await page.evaluate(() => window.__telegramScopeHarness.schema("a")),
  232 | 	).toEqual({ version: 1, stores: ["scope-metadata"] });
  233 | 	expect(
  234 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  235 | 	).toEqual([records[1], records[0]]);
  236 | });
  237 | 
  238 | test("TMA-STORAGE-21: an unknown v1 store prevents upgrade and preserves all metadata", async ({
  239 | 	page,
  240 | }) => {
  241 | 	await page.goto("/");
  242 | 	await page.evaluate(() =>
  243 | 		window.__telegramScopeHarness.seedMetadataV1("a", undefined, true),
  244 | 	);
  245 | 	const before = await page.evaluate(() =>
  246 | 		window.__telegramScopeHarness.records("a"),
  247 | 	);
  248 | 	await page.evaluate(() =>
```