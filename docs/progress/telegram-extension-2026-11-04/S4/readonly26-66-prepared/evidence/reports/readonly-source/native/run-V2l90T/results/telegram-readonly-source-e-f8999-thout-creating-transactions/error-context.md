# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-readonly-source-e2e.check.ts >> TMA-READONLY-12: synchronous revocation cancels a queued native scope lock without creating transactions
- Location: tests/browser/telegram-readonly-source-e2e.check.ts:253:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "resolved"
Received: "pending"

Call Log:
- Timeout 2000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e2]: Native IndexedDB readonly source proof.
```

# Test source

```ts
  162 |  });
  163 | }
  164 | test("TMA-READONLY-04: corrupt source preserves every original UTF16 code unit and remains separate from a complete backup", async ({ page }) => {
  165 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  166 |  await page.evaluate(() => window.__telegramReadonlySource.tamper("corrupt-string"));
  167 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  168 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  169 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toEqual({ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId, serializedProject: " \u0000raw-corrupt\ud800😀\n" });
  170 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  171 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  172 | });
  173 | test("TMA-READONLY-05: complete registered export preserves native signed-zero, own undefined, nested variants, finite legacy yaw and lone UTF16 identity", async ({ page }) => {
  174 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ legacyValues: true }));
  175 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  176 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  177 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
  178 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toMatchObject({ kind: "ready", decoded: { kind: "accepted", projectMember: { format: "runtime-v1-wire", project: { projectId: "readonly-project\ud800" } } }, fidelity: { negativeZero: true, ownUndefinedName: true, ownUndefinedVariant: true, rawYaw: 0.5, nestedVariant: [["alpha-blue"]] } });
  179 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  180 | });
  181 | test("TMA-READONLY-06: complete backup contains each original hash alias with independently verified exact Blob bytes", async ({ page }) => {
  182 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ aliases: true }));
  183 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  184 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  185 |  const result = await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary);
  186 |  expect(result).toMatchObject({ kind: "ready", decoded: { kind: "accepted", resources: expect.arrayContaining(initial.hashes.map(resourceHash => ({ resourceHash, bytes: initial.originalBytes }))) } });
  187 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  188 | });
  189 | for (const fault of ["missing", "corrupt"] as const) {
  190 |  test(`TMA-READONLY-07: ${fault} bytes under only one original alias prevent complete backup without changing healthy source or rows`, async ({ page }) => {
  191 |   const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ aliases: true }));
  192 |   await page.evaluate(({ fault, hash }) => fault === "missing" ? window.__telegramReadonlySource.removeResource(hash) : window.__telegramReadonlySource.corruptResource(hash), { fault, hash: initial.hashes[1] });
  193 |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  194 |   await page.evaluate(() => window.__telegramReadonlySource.start());
  195 |   expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
  196 |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toMatchObject({ kind: "unverified-source", serializedProject: initial.serializedProject });
  197 |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  198 |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  199 |  });
  200 | }
  201 | test("TMA-READONLY-08: final source CAS refuses an array-length change while initial checksum verification is held", async ({ page }) => {
  202 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  203 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  204 |  await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
  205 |  await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startExport(projectId, revisionId), initial);
  206 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
  207 |  await page.evaluate(() => window.__telegramReadonlySource.tamper("item-sparse"));
  208 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  209 |  await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
  210 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" } });
  211 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  212 | });
  213 | for (const fault of ["counter-missing", "counter-overflow", "counter-rollback", "identity-scope"] as const) {
  214 |  test(`TMA-READONLY-09: ${fault} permanently revokes the old source even after exact external restoration`, async ({ page }) => {
  215 |   const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  216 |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  217 |   await page.evaluate(() => window.__telegramReadonlySource.start());
  218 |   expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
  219 |   await page.evaluate(fault => window.__telegramReadonlySource.metadata(fault), fault);
  220 |   const corrupted = await page.evaluate(() => window.__telegramReadonlySource.rows());
  221 |   await page.evaluate(() => window.__telegramReadonlySource.startList());
  222 |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  223 |   expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  224 |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(corrupted);
  225 |   await page.evaluate(values => window.__telegramReadonlySource.replaceRows(values as Record<string, readonly unknown[]>), before);
  226 |   await page.evaluate(() => window.__telegramReadonlySource.startList());
  227 |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  228 |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
  229 |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  230 |  });
  231 | }
  232 | test("TMA-READONLY-10: absent storage without inventory is aborted at native version zero and never provisioned", async ({ page }) => {
  233 |  expect(await page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
  234 |  await page.evaluate(() => window.__telegramReadonlySource.start({ omitInventory: true }));
  235 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "empty" });
  236 |  expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([]);
  237 |  expect(await page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
  238 |  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  239 | });
  240 | for (const version of [1, 3]) {
  241 |  test(`TMA-READONLY-11: native schema version ${version} is refused without upgrade or data mutation`, async ({ page }) => {
  242 |   if (version === 3) await page.evaluate(() => window.__telegramReadonlySource.seed());
  243 |   expect(await page.evaluate(version => window.__telegramReadonlySource.version(version), version)).toBe(version);
  244 |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  245 |   await page.evaluate(() => window.__telegramReadonlySource.start({ omitInventory: true }));
  246 |   await page.evaluate(() => window.__telegramReadonlySource.startList());
  247 |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  248 |   expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  249 |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  250 |   expect((await page.evaluate(() => window.__telegramReadonlySource.databases()))[0]?.version).toBe(version);
  251 |  });
  252 | }
  253 | test("TMA-READONLY-12: synchronous revocation cancels a queued native scope lock without creating transactions", async ({ page }) => {
  254 |  await page.evaluate(() => window.__telegramReadonlySource.seed());
  255 |  await page.evaluate(() => window.__telegramReadonlySource.holdLock());
  256 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  257 |  await page.evaluate(() => window.__telegramReadonlySource.startList());
  258 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.readerLockQueued())).toBe(true);
  259 |  expect(await page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("pending");
  260 |  expect(await page.evaluate(() => window.__telegramReadonlySource.beginDispose())).toEqual({ aborted: true, state: "pending" });
  261 |  try {
> 262 |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.disposalState()), { timeout: 2000 }).toBe("resolved");
      |                                                                                                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  263 |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  264 |   expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  265 |  } finally {
  266 |   await page.evaluate(() => window.__telegramReadonlySource.releaseLock());
  267 |   await page.evaluate(() => window.__telegramReadonlySource.dispose());
  268 |  }
  269 |  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  270 | });
  271 | test("TMA-READONLY-13: a late genuine native open after bounded disposal only closes its own handle and cannot start a query", async ({ page }) => {
  272 |  await page.evaluate(() => window.__telegramReadonlySource.seed());
  273 |  await page.evaluate(() => window.__telegramReadonlySource.start({ omitInventory: true, holdOpen: true }));
  274 |  await page.evaluate(() => window.__telegramReadonlySource.startList());
  275 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.openHeld())).toBe(true);
  276 |  expect(await page.evaluate(() => window.__telegramReadonlySource.beginDispose())).toEqual({ aborted: true, state: "pending" });
  277 |  try {
  278 |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.disposalState()), { timeout: 2000 }).toBe("resolved");
  279 |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  280 |   expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  281 |  } finally {
  282 |   await page.evaluate(() => window.__telegramReadonlySource.releaseOpen());
  283 |   await page.evaluate(() => window.__telegramReadonlySource.dispose());
  284 |  }
  285 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.lateHandleClosed())).toBe(true);
  286 |  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
  287 | });
  288 | test("TMA-READONLY-14: revocation during a real metadata request drains its native abort before dispose resolves", async ({ page }) => {
  289 |  await page.evaluate(() => window.__telegramReadonlySource.seed());
  290 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  291 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  292 |  const result = await page.evaluate(() => window.__telegramReadonlySource.abortMetadataRead());
  293 |  expect(result.result).toBe("rejected"); expect(result.aborted).toBe(true);
  294 |  expect(result.lifecycle).toContain("revoke-in-native-request"); expect(result.lifecycle).toContain("native-abort"); expect(result.lifecycle).toContain("dispose-resolved");
  295 |  expect(result.lifecycle.indexOf("native-abort")).toBeLessThan(result.lifecycle.indexOf("dispose-resolved"));
  296 |  expect(result.transactions.every(value => value.mode === "readonly" && value.final !== undefined)).toBe(true);
  297 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  298 | });
  299 | 
  300 | 
  301 | test("TMA-READONLY-15: prepared-only orphan roots are never promoted into healthy Projects or silently reconciled", async ({ page }) => {
  302 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ resources: true, preparedOnly: true }));
  303 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  304 |  expect(before).toMatchObject({ projects: [], "pin-staging-leases": [expect.anything()], "publication-attempts": [expect.objectContaining({ state: "prepared" })] });
  305 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  306 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "empty" });
  307 |  expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([]);
  308 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toBeUndefined();
  309 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  310 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  311 | });
  312 | 
  313 | test("TMA-READONLY-16: native versionchange synchronously revokes the live source and never grants a stale handle after upgrade", async ({ page }) => {
  314 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  315 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  316 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
  317 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  318 |  expect(await page.evaluate(() => window.__telegramReadonlySource.version(3))).toBe(3);
  319 |  expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  320 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
  321 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  322 | });
  323 | 
  324 | 
  325 | test("TMA-READONLY-N01: the explicit no-locks profile exports exact complete alias resources without any writer or changing transaction", async ({ page }) => {
  326 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ aliases: true }));
  327 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  328 |  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
  329 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
  330 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toMatchObject({ kind: "ready", decoded: { kind: "accepted", resources: expect.arrayContaining(initial.hashes.map(resourceHash => ({ resourceHash, bytes: initial.originalBytes }))) } });
  331 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  332 |  expect((await page.evaluate(() => window.__telegramReadonlySource.modes())).every(value => value.mode === "readonly")).toBe(true);
  333 | });
  334 | 
  335 | test("TMA-READONLY-N02: a genuine concurrent writer advances the pointer while no-locks checksum is held and the old export fails its final CAS", async ({ page }) => {
  336 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ keepWriter: true }));
  337 |  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
  338 |  await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
  339 |  await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startExport(projectId, revisionId), initial.summary);
  340 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
  341 |  const current = await page.evaluate(() => window.__telegramReadonlySource.publishNext());
  342 |  expect(current.revisionId).not.toBe(initial.summary.revisionId);
  343 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  344 |  await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
  345 |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" } });
  346 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toBeUndefined();
  347 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [current] });
  348 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
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
```