# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-18: prevented-default native write error cannot expose an unpersisted ID
- Location: tests/browser/telegram-storage-e2e.check.ts:960:1

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
  874 | 		),
  875 | 	).toBe(0);
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
> 974 | 	).toMatchObject({ kind: "failed" });
      |    ^ Error: expect(received).toMatchObject(expected)
  975 | 	expect(
  976 | 		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
  977 | 	).toContainEqual({ key: "counter", lastReserved: "1" });
  978 | 	expect(
  979 | 		await page.evaluate(() =>
  980 | 			window.__telegramScopeHarness.reserve("store", "lease"),
  981 | 		),
  982 | 	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
  983 | });
  984 | 
```