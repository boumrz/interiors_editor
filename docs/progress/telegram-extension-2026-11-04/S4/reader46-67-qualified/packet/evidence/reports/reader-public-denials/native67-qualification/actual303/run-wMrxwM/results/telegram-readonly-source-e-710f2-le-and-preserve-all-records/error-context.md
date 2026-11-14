# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-readonly-source-e2e.check.ts >> TMA-READONLY-HANDLES: repeated public reads dispose every actual owned native handle and preserve all records
- Location: tests/browser/telegram-readonly-source-e2e.check.ts:440:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 2
```

# Test source

```ts
  349 | });
  350 | 
  351 | test("TMA-READONLY-N03: no-locks raw proof CAS also refuses a new sparse item slot before readiness", async ({ page }) => {
  352 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  353 |  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
  354 |  await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
  355 |  await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startExport(projectId, revisionId), initial);
  356 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
  357 |  await page.evaluate(() => window.__telegramReadonlySource.tamper("item-sparse"));
  358 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  359 |  await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
  360 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" } });
  361 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  362 | });
  363 | 
  364 | test("TMA-READONLY-N04: no-locks metadata abort still drains the genuine native final event before disposal", async ({ page }) => {
  365 |  await page.evaluate(() => window.__telegramReadonlySource.seed());
  366 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  367 |  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
  368 |  const result = await page.evaluate(() => window.__telegramReadonlySource.abortMetadataRead());
  369 |  expect(result.result).toBe("rejected"); expect(result.aborted).toBe(true);
  370 |  expect(result.lifecycle).toContain("native-abort"); expect(result.lifecycle).toContain("dispose-resolved");
  371 |  expect(result.lifecycle.indexOf("native-abort")).toBeLessThan(result.lifecycle.indexOf("dispose-resolved"));
  372 |  expect(result.transactions.every(value => value.mode === "readonly" && value.final !== undefined)).toBe(true);
  373 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  374 | });
  375 | 
  376 | test("TMA-READONLY-N05: no-locks disposal revokes synchronously but drains the held verifier and cannot classify its late result as ready", async ({ page }) => {
  377 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  378 |  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
  379 |  await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
  380 |  await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startExport(projectId, revisionId), initial);
  381 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
  382 |  expect(await page.evaluate(() => window.__telegramReadonlySource.beginDispose())).toEqual({ aborted: true, state: "pending" });
  383 |  expect(await page.evaluate(() => window.__telegramReadonlySource.disposalState())).toBe("pending");
  384 |  await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
  385 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "BACKUP_CANCELLED" } });
  386 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.disposalState())).toBe("resolved");
  387 |  expect((await page.evaluate(() => window.__telegramReadonlySource.modes())).every(value => value.final !== undefined)).toBe(true);
  388 | });
  389 | 
  390 | test("TMA-READONLY-N06: no-locks absent storage without inventory is aborted at native v0 without provisioning", async ({ page }) => {
  391 |  expect(await page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
  392 |  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true, omitInventory: true }));
  393 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "empty" });
  394 |  expect(await page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
  395 |  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  396 | });
  397 | 
  398 | 
  399 | for (const mode of ["sparse", "extra"] as const) {
  400 |  test(`TMA-READONLY-17: native ${mode} resource lease roots cannot prove complete backup and remain untouched`, async ({ page }) => {
  401 |   const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ resources: true }));
  402 |   await page.evaluate(({ hash, mode }) => window.__telegramReadonlySource.corruptResourceRoots(hash, mode), { hash: initial.hashes[0], mode });
  403 |   expect(await page.evaluate(hash => window.__telegramReadonlySource.resourceRootsShape(hash), initial.hashes[0])).toEqual(mode === "sparse" ? { length: 1, keys: [], hasZero: false } : { length: 1, keys: ["0", "extra"], hasZero: true });
  404 |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  405 |   await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
  406 |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  407 |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  408 |  });
  409 | }
  410 | 
  411 | 
  412 | test("TMA-READONLY-18: a timed-out old native open cannot replace or close a later admitted reader handle", async ({ page }) => {
  413 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  414 |  await page.evaluate(() => window.__telegramReadonlySource.start({ holdOpen: true, omitInventory: true, openTimeoutMs: 100 }));
  415 |  await page.evaluate(() => window.__telegramReadonlySource.startList());
  416 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.openHeld())).toBe(true);
  417 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  418 |  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  419 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
  420 |  await page.evaluate(() => window.__telegramReadonlySource.releaseOpen());
  421 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.lateHandleClosed())).toBe(true);
  422 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
  423 | });
  424 | 
  425 | test("TMA-READONLY-19: a genuine native open queued behind blocked deletion times out and its late v0 event still aborts without reprovision", async ({ page }) => {
  426 |  await page.evaluate(() => window.__telegramReadonlySource.seed());
  427 |  await page.evaluate(() => window.__telegramReadonlySource.blockDeletion());
  428 |  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true, omitInventory: true, openTimeoutMs: 100 }));
  429 |  await page.evaluate(() => window.__telegramReadonlySource.startList());
  430 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  431 |  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  432 |  expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
  433 |  await page.evaluate(() => window.__telegramReadonlySource.releaseDeletion());
  434 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.upgrades())).toEqual([{ oldVersion: 0, newVersion: 1, final: "abort" }]);
  435 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
  436 |  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  437 | });
  438 | 
  439 | 
  440 | test("TMA-READONLY-HANDLES: repeated public reads dispose every actual owned native handle and preserve all records", async ({ page }) => {
  441 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture());
  442 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  443 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  444 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
  445 |  expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([{ kind: "unverified-source", projectId: initial.summary.projectId, revisionId: initial.summary.revisionId }]);
  446 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toEqual({ kind: "unverified-source", projectId: initial.summary.projectId, revisionId: initial.summary.revisionId, serializedProject: initial.serializedProject });
  447 |  expect((await page.evaluate(() => window.__telegramReadonlySource.handleLifetime())).opened).toBeGreaterThan(0);
  448 |  expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
> 449 |  expect((await page.evaluate(() => window.__telegramReadonlySource.handleLifetime())).unclosed).toBe(0);
      |                                                                                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  450 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  451 |  expect((await page.evaluate(() => window.__telegramReadonlySource.modes())).every(value => value.mode === "readonly" && value.final !== undefined)).toBe(true);
  452 | });
  453 | 
```