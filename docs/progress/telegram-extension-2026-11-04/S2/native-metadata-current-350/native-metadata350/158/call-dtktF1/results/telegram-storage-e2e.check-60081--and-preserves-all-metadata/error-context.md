# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-21: an unknown v1 store prevents upgrade and preserves all metadata
- Location: tests/browser/telegram-storage-e2e.check.ts:238:1

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
      "unknown-data",
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
  249 | 		window.__telegramScopeHarness.create("unknown", "a"),
  250 | 	);
  251 | 	expect(
  252 | 		await page.evaluate(() =>
  253 | 			window.__telegramScopeHarness.reserve("unknown", "lease"),
  254 | 		),
  255 | 	).toMatchObject({ kind: "failed" });
  256 | 	expect(
  257 | 		await page.evaluate(() => window.__telegramScopeHarness.schema("a")),
> 258 | 	).toEqual({ version: 1, stores: ["scope-metadata", "unknown-data"] });
      |    ^ Error: expect(received).toEqual(expected) // deep equality
  259 | 	expect(
  260 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  261 | 	).toEqual(before);
  262 | });
  263 | 
  264 | test("TMA-STORAGE-22: extra metadata records are not silently promoted or removed by upgrade", async ({
  265 | 	page,
  266 | }) => {
  267 | 	await page.goto("/");
  268 | 	const records = [
  269 | 		{ key: "identity", protocolVersion: 1, scope: scopeA },
  270 | 		{ key: "counter", lastReserved: "42" },
  271 | 		{ key: "unknown-root", payload: "must-stay" },
  272 | 	];
  273 | 	await page.evaluate(
  274 | 		(records) => window.__telegramScopeHarness.seedMetadataV1("a", records),
  275 | 		records,
  276 | 	);
  277 | 	await page.evaluate(() =>
  278 | 		window.__telegramScopeHarness.create("unknown", "a"),
  279 | 	);
  280 | 	expect(
  281 | 		await page.evaluate(() =>
  282 | 			window.__telegramScopeHarness.reserve("unknown", "lease"),
  283 | 		),
  284 | 	).toMatchObject({ kind: "failed" });
  285 | 	expect(
  286 | 		await page.evaluate(() => window.__telegramScopeHarness.schema("a")),
  287 | 	).toEqual({ version: 1, stores: ["scope-metadata"] });
  288 | 	expect(
  289 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  290 | 	).toEqual([records[1], records[0], records[2]]);
  291 | });
  292 | 
  293 | test.beforeEach(async ({ page }, testInfo) => {
  294 | 	await page.goto("/");
  295 | 	// Prove the native browser receives the active Stryker mutant before imports.
  296 | 	expect(
  297 | 		await page.evaluate(
  298 | 			() => Reflect.get(globalThis, "__stryker__")?.activeMutant,
  299 | 		),
  300 | 	).toBe(testInfo.project.metadata.activeMutant);
  301 | });
  302 | 
  303 | test("TMA-STORAGE-01: native contexts reserve durable unique IDs, reopen and isolate scopes", async ({
  304 | 	page,
  305 | 	context,
  306 | }) => {
  307 | 	const second = await context.newPage();
  308 | 	await second.goto("/");
  309 | 	await page.evaluate(() => window.__telegramScopeHarness.create("first", "a"));
  310 | 	await second.evaluate(() =>
  311 | 		window.__telegramScopeHarness.create("second", "a"),
  312 | 	);
  313 | 	const results = await Promise.all(
  314 | 		Array.from({ length: 20 }, (_, index) =>
  315 | 			(index % 2 ? page : second).evaluate(
  316 | 				async ({ name, kind }) =>
  317 | 					window.__telegramScopeHarness.reserve(name, kind),
  318 | 				{
  319 | 					name: index % 2 ? "first" : "second",
  320 | 					kind: index % 3 ? ("attempt" as const) : ("lease" as const),
  321 | 				},
  322 | 			),
  323 | 		),
  324 | 	);
  325 | 	expect(results.every((result) => result.kind === "reserved")).toBe(true);
  326 | 	const ids = results.flatMap((result) =>
  327 | 		result.kind === "reserved" ? [result.id] : [],
  328 | 	);
  329 | 	expect(new Set(ids).size).toBe(20);
  330 | 	expect(
  331 | 		ids.map((id) => Number(id.split(":").at(-1))).sort((a, b) => a - b),
  332 | 	).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  333 | 	await page.evaluate(() => window.__telegramScopeHarness.close("first"));
  334 | 	await page.evaluate(() =>
  335 | 		window.__telegramScopeHarness.create("reopened", "a"),
  336 | 	);
  337 | 	expect(
  338 | 		await page.evaluate(() =>
  339 | 			window.__telegramScopeHarness.reserve("reopened", "lease"),
  340 | 		),
  341 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:21` });
  342 | 	await page.evaluate(() =>
  343 | 		window.__telegramScopeHarness.create("other-scope", "b"),
  344 | 	);
  345 | 	expect(
  346 | 		await page.evaluate(() =>
  347 | 			window.__telegramScopeHarness.reserve("other-scope", "attempt"),
  348 | 		),
  349 | 	).toMatchObject({
  350 | 		kind: "reserved",
  351 | 		id: `tma-v1:tma-v1-${"b".repeat(64)}:attempt:1`,
  352 | 	});
  353 | 	expect(
  354 | 		(await page.evaluate(() => indexedDB.databases())).some(
  355 | 			(db) => db.name === "interiors-editor-projects",
  356 | 		),
  357 | 	).toBe(false);
  358 | 	await second.evaluate(() => window.__telegramScopeHarness.close("second"));
```