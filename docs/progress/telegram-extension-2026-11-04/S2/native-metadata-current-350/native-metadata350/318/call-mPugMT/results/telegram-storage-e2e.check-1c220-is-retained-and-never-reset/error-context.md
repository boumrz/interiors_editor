# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-04: corrupt or missing metadata is retained and never reset
- Location: tests/browser/telegram-storage-e2e.check.ts:464:1

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
  489 | 				window.__telegramScopeHarness.edit("a", {
  490 | 					key: "counter",
  491 | 					lastReserved,
  492 | 				}),
  493 | 			value,
  494 | 		);
  495 | 		expect(
  496 | 			await page.evaluate(() =>
  497 | 				window.__telegramScopeHarness.reserve("store", "attempt"),
  498 | 			),
  499 | 		).toMatchObject({ kind: "failed" });
  500 | 		expect(
  501 | 			await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  502 | 		).toContainEqual({ key: "counter", lastReserved: value });
  503 | 	}
  504 | 	await page.evaluate(() =>
  505 | 		window.__telegramScopeHarness.edit("a", {
  506 | 			key: "counter",
  507 | 			lastReserved: "7",
  508 | 		}),
  509 | 	);
  510 | 	await page.evaluate(() =>
  511 | 		window.__telegramScopeHarness.edit("a", {
  512 | 			key: "counter",
  513 | 			lastReserved: "7",
  514 | 			extra: true,
  515 | 		}),
  516 | 	);
  517 | 	expect(
  518 | 		await page.evaluate(() =>
  519 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  520 | 		),
> 521 | 	).toMatchObject({ kind: "failed" });
      |    ^ Error: expect(received).toMatchObject(expected)
  522 | 	await page.evaluate(() =>
  523 | 		window.__telegramScopeHarness.edit("a", {
  524 | 			key: "counter",
  525 | 			lastReserved: "7",
  526 | 		}),
  527 | 	);
  528 | 	for (const record of [
  529 | 		{ key: "identity", protocolVersion: 2, scope: scopeA },
  530 | 		{ key: "identity", protocolVersion: 1, scope: "wrong" },
  531 | 		{ key: "identity", protocolVersion: 1, scope: scopeA, extra: true },
  532 | 	]) {
  533 | 		await page.evaluate(
  534 | 			(value) => window.__telegramScopeHarness.edit("a", value),
  535 | 			record,
  536 | 		);
  537 | 		expect(
  538 | 			await page.evaluate(() =>
  539 | 				window.__telegramScopeHarness.reserve("store", "lease"),
  540 | 			),
  541 | 		).toMatchObject({ kind: "failed" });
  542 | 	}
  543 | 	await page.evaluate(
  544 | 		(scope) =>
  545 | 			window.__telegramScopeHarness.edit("a", {
  546 | 				key: "identity",
  547 | 				protocolVersion: 1,
  548 | 				scope,
  549 | 			}),
  550 | 		scopeA,
  551 | 	);
  552 | 	await page.evaluate(() =>
  553 | 		window.__telegramScopeHarness.edit("a", {}, "counter"),
  554 | 	);
  555 | 	expect(
  556 | 		await page.evaluate(() =>
  557 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  558 | 		),
  559 | 	).toMatchObject({ kind: "failed" });
  560 | 	await page.evaluate(() =>
  561 | 		window.__telegramScopeHarness.edit("a", {
  562 | 			key: "counter",
  563 | 			lastReserved: "7",
  564 | 		}),
  565 | 	);
  566 | 	await page.evaluate(() =>
  567 | 		window.__telegramScopeHarness.edit("a", {}, "identity"),
  568 | 	);
  569 | 	expect(
  570 | 		await page.evaluate(() =>
  571 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  572 | 		),
  573 | 	).toMatchObject({ kind: "failed" });
  574 | 	await page.evaluate(() => window.__telegramScopeHarness.close("store"));
  575 | 	await page.evaluate(() =>
  576 | 		window.__telegramScopeHarness.create("reopen-corrupt", "a"),
  577 | 	);
  578 | 	expect(
  579 | 		await page.evaluate(() =>
  580 | 			window.__telegramScopeHarness.reserve("reopen-corrupt", "attempt"),
  581 | 		),
  582 | 	).toMatchObject({ kind: "failed" });
  583 | 	expect(
  584 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  585 | 	).toEqual([{ key: "counter", lastReserved: "7" }]);
  586 | });
  587 | 
  588 | test("TMA-STORAGE-05: abort after a successful put returns no ID and rolls back atomically", async ({
  589 | 	page,
  590 | }) => {
  591 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  592 | 	await page.evaluate(() =>
  593 | 		window.__telegramScopeHarness.reserve("store", "attempt"),
  594 | 	);
  595 | 	await page.evaluate(() =>
  596 | 		window.__telegramScopeHarness.abortNextCounterWrite(),
  597 | 	);
  598 | 	expect(
  599 | 		await page.evaluate(() =>
  600 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  601 | 		),
  602 | 	).toMatchObject({ kind: "failed" });
  603 | 	expect(
  604 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  605 | 	).toContainEqual({ key: "counter", lastReserved: "1" });
  606 | 	expect(
  607 | 		await page.evaluate(() =>
  608 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  609 | 		),
  610 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
  611 | });
  612 | 
  613 | test("TMA-STORAGE-06: initialization rollback leaves no half marker and retries safely", async ({
  614 | 	page,
  615 | }) => {
  616 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  617 | 	await page.evaluate(() =>
  618 | 		window.__telegramScopeHarness.abortInitialization(),
  619 | 	);
  620 | 	expect(
  621 | 		await page.evaluate(() =>
```