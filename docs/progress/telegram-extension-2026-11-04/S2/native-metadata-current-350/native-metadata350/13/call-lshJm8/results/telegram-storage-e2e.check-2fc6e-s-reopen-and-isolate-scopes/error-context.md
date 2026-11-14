# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-01: native contexts reserve durable unique IDs, reopen and isolate scopes
- Location: tests/browser/telegram-storage-e2e.check.ts:303:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
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
  258 | 	).toEqual({ version: 1, stores: ["scope-metadata", "unknown-data"] });
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
> 325 | 	expect(results.every((result) => result.kind === "reserved")).toBe(true);
      |                                                                ^ Error: expect(received).toBe(expected) // Object.is equality
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
  359 | 	await page.evaluate(() => window.__telegramScopeHarness.close("reopened"));
  360 | 	expect(
  361 | 		await page.evaluate(() => window.__telegramScopeHarness.activeHandles),
  362 | 	).toBe(1);
  363 | 	expect(
  364 | 		await second.evaluate(() => window.__telegramScopeHarness.activeHandles),
  365 | 	).toBe(0);
  366 | 	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
  367 | });
  368 | 
  369 | test("TMA-STORAGE-02: unsupported or queued/revoked lock never opens storage", async ({
  370 | 	page,
  371 | 	context,
  372 | }) => {
  373 | 	for (const capability of [
  374 | 		"no-locks",
  375 | 		"insecure",
  376 | 		"lock-fails",
  377 | 		"close-after-lock",
  378 | 	] as const) {
  379 | 		await page.evaluate(
  380 | 			(value) => window.__telegramScopeHarness.create(value, "a", value),
  381 | 			capability,
  382 | 		);
  383 | 		expect(
  384 | 			await page.evaluate(
  385 | 				(value) => window.__telegramScopeHarness.reserve(value, "attempt"),
  386 | 				capability,
  387 | 			),
  388 | 		).toMatchObject({ kind: "failed" });
  389 | 	}
  390 | 	expect(
  391 | 		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
  392 | 	).toBe(0);
  393 | 	const holder = await context.newPage();
  394 | 	await holder.goto("/");
  395 | 	await holder.evaluate(() => window.__telegramScopeHarness.hold("a"));
  396 | 	await page.evaluate(() =>
  397 | 		window.__telegramScopeHarness.create("waiting", "a"),
  398 | 	);
  399 | 	const pending = page.evaluate(() =>
  400 | 		window.__telegramScopeHarness.reserve("waiting", "attempt"),
  401 | 	);
  402 | 	await expect
  403 | 		.poll(
  404 | 			async () =>
  405 | 				(await page.evaluate(() => navigator.locks.query())).pending?.length,
  406 | 		)
  407 | 		.toBe(1);
  408 | 	expect(
  409 | 		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
  410 | 	).toBe(0);
  411 | 	await page.evaluate(() => window.__telegramScopeHarness.close("waiting"));
  412 | 	expect(await pending).toMatchObject({ kind: "failed" });
  413 | 	await holder.evaluate(() => window.__telegramScopeHarness.release());
  414 | 	expect(
  415 | 		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
  416 | 	).toBe(0);
  417 | });
  418 | 
  419 | test("TMA-STORAGE-03: counter remains exact above 2^53 and never wraps uint64", async ({
  420 | 	page,
  421 | }) => {
  422 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  423 | 	await page.evaluate(() =>
  424 | 		window.__telegramScopeHarness.reserve("store", "attempt"),
  425 | 	);
```