import { test, expect } from '../verification/telegram-readonly-bounded-native-test';
import type {} from './telegram-readonly-source-harness';
declare const process: { readonly pid: number; readonly env: Readonly<Record<string, string | undefined>> };

for (const fault of ["identity-extra", "identity-missing", "identity-version", "identity-array", "counter-extra", "counter-number", "counter-empty", "counter-leading-zero", "counter-negative", "counter-fraction", "counter-array", "metadata-extra"] as const) {
 test(`TMA-READONLY-METADATA: native ${fault} refuses access, retains every field and permanently revokes the old generation`, async ({ page }) => {
  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  const original = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.start());
  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
  await page.evaluate(fault => window.__telegramReadonlySource.metadataShapeFault(fault), fault);
  const exactCorruptShape = await page.evaluate(() => window.__telegramReadonlySource.metadataShapeEvidence());
  if (fault.endsWith("-array")) expect(exactCorruptShape).toEqual(expect.arrayContaining([expect.objectContaining({ array: true, keys: fault === "identity-array" ? ["key", "protocolVersion", "scope"] : ["key", "lastReserved"] })]));
  await page.evaluate(() => window.__telegramReadonlySource.startList());
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  expect(await page.evaluate(() => window.__telegramReadonlySource.metadataShapeEvidence())).toEqual(exactCorruptShape);
  await page.evaluate(values => window.__telegramReadonlySource.replaceRows(values as Record<string, readonly unknown[]>), original);
  await page.evaluate(() => window.__telegramReadonlySource.startList());
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(original);
  await page.evaluate(() => window.__telegramReadonlySource.dispose());
 });
}
test("TMA-READONLY-METADATA-MAX: the exact maximum uint64 counter remains readable without reserving or changing any record", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.setMaximumCounter());
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toMatchObject({ kind: "ready", decoded: { kind: "accepted" } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(false);
 await page.evaluate(() => window.__telegramReadonlySource.dispose());
});
for (const fault of ["keypath", "array-keypath", "out-of-line", "autoincrement", "index", "missing-store", "extra-store"] as const) {
 test(`TMA-READONLY-SCHEMA: native v2 ${fault} is refused without schema repair or changing persisted records`, async ({ page }) => {
  await page.evaluate(() => window.__telegramReadonlySource.seed());
  await page.evaluate(fault => window.__telegramReadonlySource.schemaFault(fault), fault);
  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.start());
  await page.evaluate(() => window.__telegramReadonlySource.startList());
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  expect(await page.evaluate(() => window.__telegramReadonlySource.upgrades())).toEqual([]);
  const modes = await page.evaluate(() => window.__telegramReadonlySource.modes());
  expect(modes.every(value => value.mode === "readonly" && (value.final === "complete" || value.final === "abort"))).toBe(true);
  await page.evaluate(() => window.__telegramReadonlySource.dispose());
 });
}


test("TMA-READONLY-CALLER-CANCEL: a file-only abort drains held verification without a late CAS and preserves a live source for the next complete export", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ resources: true }));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
 await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
 await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startFileExport(projectId, revisionId), initial.summary);
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
 const startedTransactions = await page.evaluate(() => window.__telegramReadonlySource.modes());
 expect(startedTransactions.every(value => value.mode === "readonly" && value.final === "complete")).toBe(true);
 await page.evaluate(() => window.__telegramReadonlySource.abortFileExport());
 expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(false);
 expect(await page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("pending");
 await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "BACKUP_CANCELLED" } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual(startedTransactions);
 expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(false);
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toMatchObject({ kind: "ready", decoded: { kind: "accepted", resources: [{ resourceHash: initial.hashes[0], bytes: initial.originalBytes }] } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 await page.evaluate(() => window.__telegramReadonlySource.dispose());
});

test('TMA-READONLY-MIXED-01: one healthy and one genuine corrupt Project retain a partial directory and exact unverified source', async ({ page }) => {
 const { healthy, corrupt, rawCorruptSource } = await page.evaluate(() => window.__telegramReadonlySource.seedMixedDirectory());
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [healthy], recoveryNeeded: true });
 const sources = await page.evaluate(() => window.__telegramReadonlySource.listSources());
 expect(sources).toHaveLength(2);
 expect(sources).toEqual(expect.arrayContaining([
  { kind: 'unverified-source', projectId: healthy.projectId, revisionId: healthy.revisionId },
  { kind: 'unverified-source', projectId: corrupt.projectId, revisionId: corrupt.revisionId },
 ]));
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), corrupt)).toEqual({ kind: 'unverified-source', projectId: corrupt.projectId, revisionId: corrupt.revisionId, serializedProject: rawCorruptSource });
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), healthy)).toMatchObject({ kind: 'ready', decoded: { kind: 'accepted', projectMember: { format: 'runtime-v1-wire', project: { projectId: healthy.projectId } } } });
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), corrupt)).toEqual({ kind: 'rejected', reasonCode: 'PORTABLE_BACKUP_RESOURCES_UNAVAILABLE' });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 await page.evaluate(() => window.__telegramReadonlySource.dispose());
});

test('TMA-READONLY-MIXED-02: an actual numeric native Project key is reported as partial and never exposed as a source address', async ({ page }) => {
 const healthy = await page.evaluate(() => window.__telegramReadonlySource.seedNumericProjectKey());
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [healthy], recoveryNeeded: true });
 expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([{ kind: 'unverified-source', projectId: healthy.projectId, revisionId: healthy.revisionId }]);
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 await page.evaluate(() => window.__telegramReadonlySource.dispose());
});

test.beforeEach(async ({ page }, testInfo) => {
 await page.goto('/');
 const expected = JSON.parse(process.env.TMA_READONLY_SUBJECTS ?? "null") as Record<string, { sha: string; instrumented: boolean }> | null;
 const actual = await page.evaluate(() => Object.fromEntries(Object.entries(window.__telegramReadonlySource.loaded() ?? {}).map(([key, value]) => [key, { sha: value.sha, instrumented: value.instrumented, active: value.readActive() }])));
 let valid = false;
 try {
  expect(expected).not.toBeNull();
  expect(Object.keys(actual).sort()).toEqual(["telegram-readonly-project-snapshot", "telegram-readonly-project-source"]);
  for (const [key, value] of Object.entries(expected ?? {})) {
   expect(actual[key]).toEqual({ ...value, active: value.instrumented ? process.env.__STRYKER_ACTIVE_MUTANT__ ?? null : null });
  }
  valid = true;
 } catch (error) {
  throw new Error(`READONLY_PROOF_INVALID: actual subject activation failed for ${testInfo.title}`, { cause: error });
 } finally {
  await testInfo.attach("readonly-activation", { body: JSON.stringify({ membership: await page.evaluate(() => Object.fromEntries(Object.entries(window.__telegramReadonlySource.loaded() ?? {}).map(([key, value]) => [key, value.localIDs.includes(value.readActive() ?? "__no_active__")]))), testId: testInfo.testId, file: testInfo.file, pid: process.pid, title: testInfo.title, valid, expected, actual, active: process.env.__STRYKER_ACTIVE_MUTANT__ ?? null }), contentType: "application/json" });
 }
});

test('TMA-READONLY-01: a genuine published Project is listed and exported with exact current bytes using only readonly native transactions', async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 expect(await page.evaluate(() => window.__telegramReadonlySource.start())).toMatchObject({ aborted: false, transactions: [] });
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [initial] });
 const result = await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial);
 expect(result).toMatchObject({ kind: 'ready', mimeType: 'application/zip', decoded: { kind: 'accepted', projectMember: { format: 'runtime-v1-wire', project: { projectId: initial.projectId, name: initial.name } } } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 const modes = await page.evaluate(() => window.__telegramReadonlySource.modes());
 expect(modes.length).toBeGreaterThan(0);
 expect(modes.every(value => value.mode === 'readonly')).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
});

for (const fault of ["creation-missing", "creation-prepared", "creation-checksum", "creation-receipt-id", "creation-scope", "revision-schema", "manifest-sparse"] as const) {
 test(`TMA-READONLY-02: ${fault} stays unverified while exact current source remains recoverable without any write`, async ({ page }) => {
  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  await page.evaluate(fault => window.__telegramReadonlySource.tamper(fault), fault);
  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.start());
  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
  expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([{ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId }]);
  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toMatchObject({ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId });
  expect(await page.evaluate(({ projectId }) => window.__telegramReadonlySource.read(projectId, "stale"), initial)).toBeUndefined();
  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 });
}
for (const fault of ["pointer-scope", "pointer-revision-stale", "revision-missing", "revision-scope", "revision-project", "candidate-project", "candidate-revision"] as const) {
 test(`TMA-READONLY-03: ${fault} cannot reveal borrowed raw bytes or a healthy Project`, async ({ page }) => {
  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  await page.evaluate(fault => window.__telegramReadonlySource.tamper(fault), fault);
  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.start());
  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
  expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([]);
  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toBeUndefined();
  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 });
}
test("TMA-READONLY-04: corrupt source preserves every original UTF16 code unit and remains separate from a complete backup", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.tamper("corrupt-string"));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toEqual({ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId, serializedProject: " \u0000raw-corrupt\ud800😀\n" });
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});
test("TMA-READONLY-05: complete registered export preserves native signed-zero, own undefined, nested variants, finite legacy yaw and lone UTF16 identity", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ legacyValues: true }));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toMatchObject({ kind: "ready", decoded: { kind: "accepted", projectMember: { format: "runtime-v1-wire", project: { projectId: "readonly-project\ud800" } } }, fidelity: { negativeZero: true, ownUndefinedName: true, ownUndefinedVariant: true, rawYaw: 0.5, nestedVariant: [["alpha-blue"]] } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});
test("TMA-READONLY-06: complete backup contains each original hash alias with independently verified exact Blob bytes", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ aliases: true }));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 const result = await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary);
 expect(result).toMatchObject({ kind: "ready", decoded: { kind: "accepted", resources: expect.arrayContaining(initial.hashes.map(resourceHash => ({ resourceHash, bytes: initial.originalBytes }))) } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});
for (const fault of ["missing", "corrupt"] as const) {
 test(`TMA-READONLY-07: ${fault} bytes under only one original alias prevent complete backup without changing healthy source or rows`, async ({ page }) => {
  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ aliases: true }));
  await page.evaluate(({ fault, hash }) => fault === "missing" ? window.__telegramReadonlySource.removeResource(hash) : window.__telegramReadonlySource.corruptResource(hash), { fault, hash: initial.hashes[1] });
  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.start());
  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toMatchObject({ kind: "unverified-source", serializedProject: initial.serializedProject });
  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 });
}
test("TMA-READONLY-08: final source CAS refuses an array-length change while initial checksum verification is held", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
 await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startExport(projectId, revisionId), initial);
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
 await page.evaluate(() => window.__telegramReadonlySource.tamper("item-sparse"));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});
for (const fault of ["counter-missing", "counter-overflow", "counter-rollback", "identity-scope"] as const) {
 test(`TMA-READONLY-09: ${fault} permanently revokes the old source even after exact external restoration`, async ({ page }) => {
  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.start());
  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
  await page.evaluate(fault => window.__telegramReadonlySource.metadata(fault), fault);
  const corrupted = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.startList());
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(corrupted);
  await page.evaluate(values => window.__telegramReadonlySource.replaceRows(values as Record<string, readonly unknown[]>), before);
  await page.evaluate(() => window.__telegramReadonlySource.startList());
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 });
}
test("TMA-READONLY-10: absent storage without inventory is aborted at native version zero and never provisioned", async ({ page }) => {
 expect(await page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
 await page.evaluate(() => window.__telegramReadonlySource.start({ omitInventory: true }));
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "empty" });
 expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([]);
 expect(await page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
 expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
});
for (const version of [1, 3]) {
 test(`TMA-READONLY-11: native schema version ${version} is refused without upgrade or data mutation`, async ({ page }) => {
  if (version === 3) await page.evaluate(() => window.__telegramReadonlySource.seed());
  expect(await page.evaluate(version => window.__telegramReadonlySource.version(version), version)).toBe(version);
  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.start({ omitInventory: true }));
  await page.evaluate(() => window.__telegramReadonlySource.startList());
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  expect((await page.evaluate(() => window.__telegramReadonlySource.databases()))[0]?.version).toBe(version);
 });
}
test("TMA-READONLY-12: synchronous revocation cancels a queued native scope lock without creating transactions", async ({ page }) => {
 await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.holdLock());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 await page.evaluate(() => window.__telegramReadonlySource.startList());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.readerLockQueued())).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("pending");
 expect(await page.evaluate(() => window.__telegramReadonlySource.beginDispose())).toEqual({ aborted: true, state: "pending" });
 try {
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.disposalState()), { timeout: 2000 }).toBe("resolved");
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
 } finally {
  await page.evaluate(() => window.__telegramReadonlySource.releaseLock());
  await page.evaluate(() => window.__telegramReadonlySource.dispose());
 }
 expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
});
test("TMA-READONLY-13: a late genuine native open after bounded disposal only closes its own handle and cannot start a query", async ({ page }) => {
 await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.start({ omitInventory: true, holdOpen: true }));
 await page.evaluate(() => window.__telegramReadonlySource.startList());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.openHeld())).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.beginDispose())).toEqual({ aborted: true, state: "pending" });
 try {
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.disposalState()), { timeout: 2000 }).toBe("resolved");
  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
 } finally {
  await page.evaluate(() => window.__telegramReadonlySource.releaseOpen());
  await page.evaluate(() => window.__telegramReadonlySource.dispose());
 }
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.lateHandleClosed())).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
});
test("TMA-READONLY-14: revocation during a real metadata request drains its native abort before dispose resolves", async ({ page }) => {
 await page.evaluate(() => window.__telegramReadonlySource.seed());
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 const result = await page.evaluate(() => window.__telegramReadonlySource.abortMetadataRead());
 expect(result.result).toBe("rejected"); expect(result.aborted).toBe(true);
 expect(result.lifecycle).toContain("revoke-in-native-request"); expect(result.lifecycle).toContain("native-abort"); expect(result.lifecycle).toContain("dispose-resolved");
 expect(result.lifecycle.indexOf("native-abort")).toBeLessThan(result.lifecycle.indexOf("dispose-resolved"));
 expect(result.transactions.every(value => value.mode === "readonly" && value.final !== undefined)).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});


test("TMA-READONLY-15: prepared-only orphan roots are never promoted into healthy Projects or silently reconciled", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ resources: true, preparedOnly: true }));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 expect(before).toMatchObject({ projects: [], "pin-staging-leases": [expect.anything()], "publication-attempts": [expect.objectContaining({ state: "prepared" })] });
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "empty" });
 expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([]);
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toBeUndefined();
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});

test("TMA-READONLY-16: native versionchange synchronously revokes the live source and never grants a stale handle after upgrade", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 expect(await page.evaluate(() => window.__telegramReadonlySource.version(3))).toBe(3);
 expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});


test("TMA-READONLY-N01: the explicit no-locks profile exports exact complete alias resources without any writer or changing transaction", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ aliases: true }));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toMatchObject({ kind: "ready", decoded: { kind: "accepted", resources: expect.arrayContaining(initial.hashes.map(resourceHash => ({ resourceHash, bytes: initial.originalBytes }))) } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 expect((await page.evaluate(() => window.__telegramReadonlySource.modes())).every(value => value.mode === "readonly")).toBe(true);
});

test("TMA-READONLY-N02: a genuine concurrent writer advances the pointer while no-locks checksum is held and the old export fails its final CAS", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ keepWriter: true }));
 await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
 await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
 await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startExport(projectId, revisionId), initial.summary);
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
 const current = await page.evaluate(() => window.__telegramReadonlySource.publishNext());
 expect(current.revisionId).not.toBe(initial.summary.revisionId);
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" } });
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toBeUndefined();
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [current] });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});

test("TMA-READONLY-N03: no-locks raw proof CAS also refuses a new sparse item slot before readiness", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
 await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
 await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startExport(projectId, revisionId), initial);
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
 await page.evaluate(() => window.__telegramReadonlySource.tamper("item-sparse"));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});

test("TMA-READONLY-N04: no-locks metadata abort still drains the genuine native final event before disposal", async ({ page }) => {
 await page.evaluate(() => window.__telegramReadonlySource.seed());
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
 const result = await page.evaluate(() => window.__telegramReadonlySource.abortMetadataRead());
 expect(result.result).toBe("rejected"); expect(result.aborted).toBe(true);
 expect(result.lifecycle).toContain("native-abort"); expect(result.lifecycle).toContain("dispose-resolved");
 expect(result.lifecycle.indexOf("native-abort")).toBeLessThan(result.lifecycle.indexOf("dispose-resolved"));
 expect(result.transactions.every(value => value.mode === "readonly" && value.final !== undefined)).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
});

test("TMA-READONLY-N05: no-locks disposal revokes synchronously but drains the held verifier and cannot classify its late result as ready", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
 await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
 await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startExport(projectId, revisionId), initial);
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.beginDispose())).toEqual({ aborted: true, state: "pending" });
 expect(await page.evaluate(() => window.__telegramReadonlySource.disposalState())).toBe("pending");
 await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "BACKUP_CANCELLED" } });
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.disposalState())).toBe("resolved");
 expect((await page.evaluate(() => window.__telegramReadonlySource.modes())).every(value => value.final !== undefined)).toBe(true);
});

test("TMA-READONLY-N06: no-locks absent storage without inventory is aborted at native v0 without provisioning", async ({ page }) => {
 expect(await page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
 await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true, omitInventory: true }));
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "empty" });
 expect(await page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
 expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
});


for (const mode of ["sparse", "extra"] as const) {
 test(`TMA-READONLY-17: native ${mode} resource lease roots cannot prove complete backup and remain untouched`, async ({ page }) => {
  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ resources: true }));
  await page.evaluate(({ hash, mode }) => window.__telegramReadonlySource.corruptResourceRoots(hash, mode), { hash: initial.hashes[0], mode });
  expect(await page.evaluate(hash => window.__telegramReadonlySource.resourceRootsShape(hash), initial.hashes[0])).toEqual(mode === "sparse" ? { length: 1, keys: [], hasZero: false } : { length: 1, keys: ["0", "extra"], hasZero: true });
  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 });
}


test("TMA-READONLY-18: a timed-out old native open cannot replace or close a later admitted reader handle", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.start({ holdOpen: true, omitInventory: true, openTimeoutMs: 100 }));
 await page.evaluate(() => window.__telegramReadonlySource.startList());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.openHeld())).toBe(true);
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
 expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
 await page.evaluate(() => window.__telegramReadonlySource.releaseOpen());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.lateHandleClosed())).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
});

test("TMA-READONLY-19: a genuine native open queued behind blocked deletion times out and its late v0 event still aborts without reprovision", async ({ page }) => {
 await page.evaluate(() => window.__telegramReadonlySource.seed());
 await page.evaluate(() => window.__telegramReadonlySource.blockDeletion());
 await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true, omitInventory: true, openTimeoutMs: 100 }));
 await page.evaluate(() => window.__telegramReadonlySource.startList());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
 expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
 expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
 await page.evaluate(() => window.__telegramReadonlySource.releaseDeletion());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.upgrades())).toEqual([{ oldVersion: 0, newVersion: 1, final: "abort" }]);
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.databases())).toEqual([]);
 expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual([]);
});


test("TMA-READONLY-HANDLES: repeated public reads dispose every actual owned native handle and preserve all records", async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture());
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
 expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([{ kind: "unverified-source", projectId: initial.summary.projectId, revisionId: initial.summary.revisionId }]);
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toEqual({ kind: "unverified-source", projectId: initial.summary.projectId, revisionId: initial.summary.revisionId, serializedProject: initial.serializedProject });
 expect((await page.evaluate(() => window.__telegramReadonlySource.handleLifetime())).opened).toBeGreaterThan(0);
 expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
 expect((await page.evaluate(() => window.__telegramReadonlySource.handleLifetime())).unclosed).toBe(0);
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 expect((await page.evaluate(() => window.__telegramReadonlySource.modes())).every(value => value.mode === "readonly" && value.final !== undefined)).toBe(true);
});
