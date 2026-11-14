# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-09: reservation requires actual strict durability and rejects relaxed fallback
- Location: tests/browser/telegram-storage-e2e.check.ts:687:1

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
  644 | 	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
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
> 706 | 	).toMatchObject({ kind: "failed" });
      |    ^ Error: expect(received).toMatchObject(expected)
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
  745 | test("TMA-STORAGE-11: revoked reopen closes its late native handle and preserves metadata", async ({
  746 | 	page,
  747 | }) => {
  748 | 	await page.evaluate(() => window.__telegramScopeHarness.create("seed", "a"));
  749 | 	await page.evaluate(() =>
  750 | 		window.__telegramScopeHarness.reserve("seed", "attempt"),
  751 | 	);
  752 | 	await page.evaluate(() => window.__telegramScopeHarness.close("seed"));
  753 | 	await page.evaluate(() =>
  754 | 		window.__telegramScopeHarness.create("late", "a", "close-on-open"),
  755 | 	);
  756 | 	expect(
  757 | 		await page.evaluate(() =>
  758 | 			window.__telegramScopeHarness.reserve("late", "lease"),
  759 | 		),
  760 | 	).toMatchObject({ kind: "failed" });
  761 | 	await page.evaluate(() => window.__telegramScopeHarness.awaitClose("late"));
  762 | 	await page.evaluate(() => window.__telegramScopeHarness.settleOpens());
  763 | 	expect(
  764 | 		await page.evaluate(() => window.__telegramScopeHarness.activeHandles),
  765 | 	).toBe(0);
  766 | 	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
  767 | 	expect(
  768 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  769 | 	).toContainEqual({ key: "counter", lastReserved: "1" });
  770 | });
  771 | 
  772 | test("TMA-STORAGE-12: close from native put-success drains commit and rejects queued work", async ({
  773 | 	page,
  774 | }) => {
  775 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  776 | 	await page.evaluate(() =>
  777 | 		window.__telegramScopeHarness.reserve("store", "attempt"),
  778 | 	);
  779 | 	await page.evaluate(() =>
  780 | 		window.__telegramScopeHarness.closeOnCounterRequest("store"),
  781 | 	);
  782 | 	const results = await page.evaluate(() =>
  783 | 		Promise.all([
  784 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  785 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  786 | 		]),
  787 | 	);
  788 | 	expect(results[0]).toEqual({
  789 | 		kind: "reserved",
  790 | 		id: `tma-v1:${scopeA}:attempt:2`,
  791 | 	});
  792 | 	expect(results[1]).toMatchObject({ kind: "failed" });
  793 | 	await page.evaluate(() => window.__telegramScopeHarness.awaitClose("store"));
  794 | 	expect(
  795 | 		await page.evaluate(() => window.__telegramScopeHarness.lifecycle),
  796 | 	).toEqual(["request-success", "tx-complete", "closed"]);
  797 | 	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
  798 | 	expect(
  799 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  800 | 	).toContainEqual({ key: "counter", lastReserved: "2" });
  801 | });
  802 | 
  803 | test("TMA-STORAGE-13: admitted upgrade drains but revoke prevents a following reservation", async ({
  804 | 	page,
  805 | }) => {
  806 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
```