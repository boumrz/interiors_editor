# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-07: version change closes the old generation and older schema refuses writing
- Location: tests/browser/telegram-storage-e2e.check.ts:637:1

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
  622 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  623 | 		),
  624 | 	).toMatchObject({ kind: "failed" });
  625 | 	expect(
  626 | 		(await page.evaluate(() => indexedDB.databases())).some(
  627 | 			(db) => db.name === `interiors-editor-projects:${scopeA}`,
  628 | 		),
  629 | 	).toBe(false);
  630 | 	expect(
  631 | 		await page.evaluate(() =>
  632 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  633 | 		),
  634 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:1` });
  635 | });
  636 | 
  637 | test("TMA-STORAGE-07: version change closes the old generation and older schema refuses writing", async ({
  638 | 	page,
  639 | }) => {
  640 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  641 | 	await page.evaluate(() =>
  642 | 		window.__telegramScopeHarness.reserve("store", "attempt"),
  643 | 	);
> 644 | 	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
      |             ^ Error: page.evaluate: Test timeout of 10000ms exceeded.
  645 | 	expect(
  646 | 		await page.evaluate(() =>
  647 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  648 | 		),
  649 | 	).toMatchObject({ kind: "failed" });
  650 | 	await page.evaluate(() =>
  651 | 		window.__telegramScopeHarness.create("old-client", "a"),
  652 | 	);
  653 | 	expect(
  654 | 		await page.evaluate(() =>
  655 | 			window.__telegramScopeHarness.reserve("old-client", "lease"),
  656 | 		),
  657 | 	).toMatchObject({ kind: "failed" });
  658 | 	expect(
  659 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  660 | 	).toContainEqual({ key: "counter", lastReserved: "1" });
  661 | });
  662 | 
  663 | test("TMA-STORAGE-08: rejected open aborts late initialization and retries without reset", async ({
  664 | 	page,
  665 | }) => {
  666 | 	await page.evaluate(() =>
  667 | 		window.__telegramScopeHarness.create("store", "a", "blocked-open"),
  668 | 	);
  669 | 	expect(
  670 | 		await page.evaluate(() =>
  671 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  672 | 		),
  673 | 	).toMatchObject({ kind: "failed" });
  674 | 	await page.evaluate(() => window.__telegramScopeHarness.settleOpens());
  675 | 	expect(
  676 | 		(await page.evaluate(() => indexedDB.databases())).some(
  677 | 			(db) => db.name === `interiors-editor-projects:${scopeA}`,
  678 | 		),
  679 | 	).toBe(false);
  680 | 	expect(
  681 | 		await page.evaluate(() =>
  682 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  683 | 		),
  684 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:attempt:1` });
  685 | });
  686 | 
  687 | test("TMA-STORAGE-09: reservation requires actual strict durability and rejects relaxed fallback", async ({
  688 | 	page,
  689 | }) => {
  690 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  691 | 	expect(
  692 | 		await page.evaluate(() =>
  693 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  694 | 		),
  695 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:attempt:1` });
  696 | 	expect(
  697 | 		await page.evaluate(() => window.__telegramScopeHarness.durabilityModes),
  698 | 	).toEqual(["strict"]);
  699 | 	await page.evaluate(() =>
  700 | 		window.__telegramScopeHarness.relaxNextTransaction(),
  701 | 	);
  702 | 	expect(
  703 | 		await page.evaluate(() =>
  704 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  705 | 		),
  706 | 	).toMatchObject({ kind: "failed" });
  707 | 	expect(
  708 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  709 | 	).toContainEqual({ key: "counter", lastReserved: "1" });
  710 | 	expect(
  711 | 		await page.evaluate(() =>
  712 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  713 | 		),
  714 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
  715 | });
  716 | 
  717 | test("TMA-STORAGE-10: revoke pending native open aborts late initialization", async ({
  718 | 	page,
  719 | }) => {
  720 | 	await page.evaluate(() =>
  721 | 		window.__telegramScopeHarness.create("store", "a", "close-on-open"),
  722 | 	);
  723 | 	expect(
  724 | 		await page.evaluate(() =>
  725 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  726 | 		),
  727 | 	).toMatchObject({ kind: "failed" });
  728 | 	await page.evaluate(() => window.__telegramScopeHarness.awaitClose("store"));
  729 | 	await page.evaluate(() => window.__telegramScopeHarness.settleOpens());
  730 | 	expect(
  731 | 		(await page.evaluate(() => indexedDB.databases())).some(
  732 | 			(db) => db.name === `interiors-editor-projects:${scopeA}`,
  733 | 		),
  734 | 	).toBe(false);
  735 | 	expect(
  736 | 		await page.evaluate(() =>
  737 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  738 | 		),
  739 | 	).toMatchObject({ kind: "failed" });
  740 | 	expect(
  741 | 		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
  742 | 	).toBe(1);
  743 | });
  744 | 
```