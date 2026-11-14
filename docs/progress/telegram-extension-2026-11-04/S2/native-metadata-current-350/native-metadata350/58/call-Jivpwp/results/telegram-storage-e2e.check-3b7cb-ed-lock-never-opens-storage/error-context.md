# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-02: unsupported or queued/revoked lock never opens storage
- Location: tests/browser/telegram-storage-e2e.check.ts:369:1

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
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
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
> 388 | 		).toMatchObject({ kind: "failed" });
      |     ^ Error: expect(received).toMatchObject(expected)
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
  426 | 	await page.evaluate(() =>
  427 | 		window.__telegramScopeHarness.edit("a", {
  428 | 			key: "counter",
  429 | 			lastReserved: "9007199254740992",
  430 | 		}),
  431 | 	);
  432 | 	expect(
  433 | 		await page.evaluate(() =>
  434 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  435 | 		),
  436 | 	).toEqual({
  437 | 		kind: "reserved",
  438 | 		id: `tma-v1:${scopeA}:lease:9007199254740993`,
  439 | 	});
  440 | 	await page.evaluate(() =>
  441 | 		window.__telegramScopeHarness.edit("a", {
  442 | 			key: "counter",
  443 | 			lastReserved: "18446744073709551614",
  444 | 		}),
  445 | 	);
  446 | 	expect(
  447 | 		await page.evaluate(() =>
  448 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  449 | 		),
  450 | 	).toEqual({
  451 | 		kind: "reserved",
  452 | 		id: `tma-v1:${scopeA}:attempt:18446744073709551615`,
  453 | 	});
  454 | 	expect(
  455 | 		await page.evaluate(() =>
  456 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  457 | 		),
  458 | 	).toMatchObject({ kind: "failed" });
  459 | 	expect(
  460 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  461 | 	).toContainEqual({ key: "counter", lastReserved: "18446744073709551615" });
  462 | });
  463 | 
  464 | test("TMA-STORAGE-04: corrupt or missing metadata is retained and never reset", async ({
  465 | 	page,
  466 | }) => {
  467 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  468 | 	await page.evaluate(() =>
  469 | 		window.__telegramScopeHarness.reserve("store", "attempt"),
  470 | 	);
  471 | 	for (const value of [
  472 | 		0,
  473 | 		null,
  474 | 		[],
  475 | 		"",
  476 | 		"01",
  477 | 		"00",
  478 | 		"-1",
  479 | 		"1.5",
  480 | 		"1e3",
  481 | 		"1\n",
  482 | 		"1 ",
  483 | 		" 1",
  484 | 		"18446744073709551616",
  485 | 		"99999999999999999999999",
  486 | 	]) {
  487 | 		await page.evaluate(
  488 | 			(lastReserved) =>
```