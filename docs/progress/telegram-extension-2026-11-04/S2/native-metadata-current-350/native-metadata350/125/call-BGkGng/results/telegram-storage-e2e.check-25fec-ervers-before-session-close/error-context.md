# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-16: completed and failed opens release cancellation observers before session close
- Location: tests/browser/telegram-storage-e2e.check.ts:862:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
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
  807 | 	await page.evaluate(() =>
  808 | 		window.__telegramScopeHarness.closeOnCounterRequest("store", true),
  809 | 	);
  810 | 	expect(
  811 | 		await page.evaluate(() =>
  812 | 			window.__telegramScopeHarness.reserve("store", "attempt"),
  813 | 		),
  814 | 	).toMatchObject({ kind: "failed" });
  815 | 	await page.evaluate(() => window.__telegramScopeHarness.awaitClose("store"));
  816 | 	expect(
  817 | 		await page.evaluate(() => window.__telegramScopeHarness.lifecycle),
  818 | 	).toEqual(["request-success", "tx-complete", "closed"]);
  819 | 	expect(
  820 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  821 | 	).toContainEqual({ key: "counter", lastReserved: "0" });
  822 | 	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
  823 | });
  824 | 
  825 | test("TMA-STORAGE-14: controlled read fault rejects and releases scope lock without an ID", async ({
  826 | 	page,
  827 | }) => {
  828 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  829 | 	await page.evaluate(() =>
  830 | 		window.__telegramScopeHarness.reserve("store", "attempt"),
  831 | 	);
  832 | 	await page.evaluate(() => window.__telegramScopeHarness.failNextRead());
  833 | 	expect(
  834 | 		await page.evaluate(() =>
  835 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  836 | 		),
  837 | 	).toMatchObject({ kind: "failed" });
  838 | 	expect(
  839 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  840 | 	).toContainEqual({ key: "counter", lastReserved: "1" });
  841 | 	expect(
  842 | 		await page.evaluate(() =>
  843 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  844 | 		),
  845 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
  846 | });
  847 | 
  848 | test("TMA-STORAGE-15: an unknown operation kind cannot initialize or reserve in a scope", async ({
  849 | 	page,
  850 | }) => {
  851 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  852 | 	expect(
  853 | 		await page.evaluate(() =>
  854 | 			window.__telegramScopeHarness.reserve("store", "unknown" as "attempt"),
  855 | 		),
  856 | 	).toMatchObject({ kind: "failed" });
  857 | 	expect(
  858 | 		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
  859 | 	).toBe(0);
  860 | });
  861 | 
  862 | test("TMA-STORAGE-16: completed and failed opens release cancellation observers before session close", async ({
  863 | 	page,
  864 | }) => {
  865 | 	await page.evaluate(() =>
  866 | 		window.__telegramScopeHarness.create("normal", "a"),
  867 | 	);
  868 | 	await page.evaluate(() =>
  869 | 		window.__telegramScopeHarness.reserve("normal", "attempt"),
  870 | 	);
  871 | 	expect(
  872 | 		await page.evaluate(
  873 | 			() => window.__telegramScopeHarness.retainedAbortCallbacks,
  874 | 		),
> 875 | 	).toBe(0);
      |    ^ Error: expect(received).toBe(expected) // Object.is equality
  876 | 	await page.evaluate(() => window.__telegramScopeHarness.close("normal"));
  877 | 	await page.evaluate(() =>
  878 | 		window.__telegramScopeHarness.create("retry", "a", "blocked-open"),
  879 | 	);
  880 | 	expect(
  881 | 		await page.evaluate(() =>
  882 | 			window.__telegramScopeHarness.reserve("retry", "lease"),
  883 | 		),
  884 | 	).toMatchObject({ kind: "failed" });
  885 | 	await page.evaluate(() => window.__telegramScopeHarness.settleOpens());
  886 | 	expect(
  887 | 		await page.evaluate(() => window.__telegramScopeHarness.activeHandles),
  888 | 	).toBe(0);
  889 | 	expect(
  890 | 		await page.evaluate(
  891 | 			() => window.__telegramScopeHarness.retainedAbortCallbacks,
  892 | 		),
  893 | 	).toBe(0);
  894 | 	expect(
  895 | 		await page.evaluate(() =>
  896 | 			window.__telegramScopeHarness.reserve("retry", "lease"),
  897 | 		),
  898 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
  899 | 	expect(
  900 | 		await page.evaluate(
  901 | 			() => window.__telegramScopeHarness.retainedAbortCallbacks,
  902 | 		),
  903 | 	).toBe(0);
  904 | 	expect(
  905 | 		await page.evaluate(() => window.__telegramScopeHarness.activeHandles),
  906 | 	).toBe(1);
  907 | });
  908 | 
  909 | test("TMA-STORAGE-17: whole array records with valid-looking fields remain corrupt and unchanged", async ({
  910 | 	page,
  911 | }) => {
  912 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  913 | 	await page.evaluate(() =>
  914 | 		window.__telegramScopeHarness.reserve("store", "attempt"),
  915 | 	);
  916 | 	for (const key of ["identity", "counter"] as const) {
  917 | 		await page.evaluate(
  918 | 			async ({ key, scope }) => {
  919 | 				await window.__telegramScopeHarness.edit("a", {
  920 | 					key: "identity",
  921 | 					protocolVersion: 1,
  922 | 					scope,
  923 | 				});
  924 | 				const record =
  925 | 					key === "identity"
  926 | 						? Object.assign([], { key, protocolVersion: 1, scope })
  927 | 						: Object.assign([], { key, lastReserved: "1" });
  928 | 				await window.__telegramScopeHarness.edit("a", record);
  929 | 			},
  930 | 			{ key, scope: scopeA },
  931 | 		);
  932 | 		expect(
  933 | 			await page.evaluate(
  934 | 				async (key) =>
  935 | 					(await window.__telegramScopeHarness.records("a")).some(
  936 | 						(record) =>
  937 | 							Array.isArray(record) && Reflect.get(record, "key") === key,
  938 | 					),
  939 | 				key,
  940 | 			),
  941 | 		).toBe(true);
  942 | 		expect(
  943 | 			await page.evaluate(() =>
  944 | 				window.__telegramScopeHarness.reserve("store", "lease"),
  945 | 			),
  946 | 		).toMatchObject({ kind: "failed" });
  947 | 		expect(
  948 | 			await page.evaluate(
  949 | 				async (key) =>
  950 | 					(await window.__telegramScopeHarness.records("a")).some(
  951 | 						(record) =>
  952 | 							Array.isArray(record) && Reflect.get(record, "key") === key,
  953 | 					),
  954 | 				key,
  955 | 			),
  956 | 		).toBe(true);
  957 | 	}
  958 | });
  959 | 
  960 | test("TMA-STORAGE-18: prevented-default native write error cannot expose an unpersisted ID", async ({
  961 | 	page,
  962 | }) => {
  963 | 	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
  964 | 	await page.evaluate(() =>
  965 | 		window.__telegramScopeHarness.reserve("store", "attempt"),
  966 | 	);
  967 | 	await page.evaluate(() =>
  968 | 		window.__telegramScopeHarness.preventDefaultWriteFailure(),
  969 | 	);
  970 | 	expect(
  971 | 		await page.evaluate(() =>
  972 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  973 | 		),
  974 | 	).toMatchObject({ kind: "failed" });
  975 | 	expect(
```