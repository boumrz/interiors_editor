# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-readonly-source-e2e.check.ts >> TMA-READONLY-MIXED-01: one healthy and one genuine corrupt Project retain a partial directory and exact unverified source
- Location: tests/browser/telegram-readonly-source-e2e.check.ts:76:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: {"kind": "unverified-source", "projectId": "readonly-project-b", "revisionId": "readonly-revision-b", "serializedProject": "{\"schemaVersion\":1,\"projectId\":\"readonly-project-b\",\"name\":\"Recoverable second Project\",\"createdAt\":\"2026-11-05T00:00:00.000Z\",\"updatedAt\":\"2026-11-05T00:00:00.000Z\",\"lifecycle\":\"active\",\"level\":{\"levelId\":\"readonly-level\",\"vertices\":[],\"wallSegments\":[],\"rooms\":[],\"openings\":[]},\"assetInstances\":[],\"assetDefinitionRefs\":[]}"}
Received: undefined
```

# Test source

```ts
  1   | import { test, expect } from '../verification/telegram-readonly-bounded-native-test';
  2   | import type {} from './telegram-readonly-source-harness';
  3   | declare const process: { readonly pid: number; readonly env: Readonly<Record<string, string | undefined>> };
  4   | 
  5   | for (const fault of ["identity-extra", "identity-missing", "identity-version", "identity-array", "counter-extra", "counter-number", "counter-empty", "counter-leading-zero", "counter-negative", "counter-fraction", "counter-array", "metadata-extra"] as const) {
  6   |  test(`TMA-READONLY-METADATA: native ${fault} refuses access, retains every field and permanently revokes the old generation`, async ({ page }) => {
  7   |   const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  8   |   const original = await page.evaluate(() => window.__telegramReadonlySource.rows());
  9   |   await page.evaluate(() => window.__telegramReadonlySource.start());
  10  |   expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
  11  |   await page.evaluate(fault => window.__telegramReadonlySource.metadataShapeFault(fault), fault);
  12  |   const exactCorruptShape = await page.evaluate(() => window.__telegramReadonlySource.metadataShapeEvidence());
  13  |   if (fault.endsWith("-array")) expect(exactCorruptShape).toEqual(expect.arrayContaining([expect.objectContaining({ array: true, keys: fault === "identity-array" ? ["key", "protocolVersion", "scope"] : ["key", "lastReserved"] })]));
  14  |   await page.evaluate(() => window.__telegramReadonlySource.startList());
  15  |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  16  |   expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  17  |   expect(await page.evaluate(() => window.__telegramReadonlySource.metadataShapeEvidence())).toEqual(exactCorruptShape);
  18  |   await page.evaluate(values => window.__telegramReadonlySource.replaceRows(values as Record<string, readonly unknown[]>), original);
  19  |   await page.evaluate(() => window.__telegramReadonlySource.startList());
  20  |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  21  |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(original);
  22  |   await page.evaluate(() => window.__telegramReadonlySource.dispose());
  23  |  });
  24  | }
  25  | test("TMA-READONLY-METADATA-MAX: the exact maximum uint64 counter remains readable without reserving or changing any record", async ({ page }) => {
  26  |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  27  |  await page.evaluate(() => window.__telegramReadonlySource.setMaximumCounter());
  28  |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  29  |  await page.evaluate(() => window.__telegramReadonlySource.start());
  30  |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
  31  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toMatchObject({ kind: "ready", decoded: { kind: "accepted" } });
  32  |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  33  |  expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(false);
  34  |  await page.evaluate(() => window.__telegramReadonlySource.dispose());
  35  | });
  36  | for (const fault of ["keypath", "array-keypath", "out-of-line", "autoincrement", "index", "missing-store", "extra-store"] as const) {
  37  |  test(`TMA-READONLY-SCHEMA: native v2 ${fault} is refused without schema repair or changing persisted records`, async ({ page }) => {
  38  |   await page.evaluate(() => window.__telegramReadonlySource.seed());
  39  |   await page.evaluate(fault => window.__telegramReadonlySource.schemaFault(fault), fault);
  40  |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  41  |   await page.evaluate(() => window.__telegramReadonlySource.start());
  42  |   await page.evaluate(() => window.__telegramReadonlySource.startList());
  43  |   await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
  44  |   expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
  45  |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  46  |   expect(await page.evaluate(() => window.__telegramReadonlySource.upgrades())).toEqual([]);
  47  |   const modes = await page.evaluate(() => window.__telegramReadonlySource.modes());
  48  |   expect(modes.every(value => value.mode === "readonly" && (value.final === "complete" || value.final === "abort"))).toBe(true);
  49  |   await page.evaluate(() => window.__telegramReadonlySource.dispose());
  50  |  });
  51  | }
  52  | 
  53  | 
  54  | test("TMA-READONLY-CALLER-CANCEL: a file-only abort drains held verification without a late CAS and preserves a live source for the next complete export", async ({ page }) => {
  55  |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ resources: true }));
  56  |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  57  |  await page.evaluate(() => window.__telegramReadonlySource.start({ coordination: "native-readonly-snapshot", omitLocks: true }));
  58  |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
  59  |  await page.evaluate(() => window.__telegramReadonlySource.holdChecksum());
  60  |  await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.startFileExport(projectId, revisionId), initial.summary);
  61  |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.checksumEntered())).toBe(true);
  62  |  const startedTransactions = await page.evaluate(() => window.__telegramReadonlySource.modes());
  63  |  expect(startedTransactions.every(value => value.mode === "readonly" && value.final === "complete")).toBe(true);
  64  |  await page.evaluate(() => window.__telegramReadonlySource.abortFileExport());
  65  |  expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(false);
  66  |  expect(await page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("pending");
  67  |  await page.evaluate(() => window.__telegramReadonlySource.releaseChecksum());
  68  |  await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation())).toEqual({ status: "fulfilled", value: { kind: "rejected", reasonCode: "BACKUP_CANCELLED" } });
  69  |  expect(await page.evaluate(() => window.__telegramReadonlySource.modes())).toEqual(startedTransactions);
  70  |  expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(false);
  71  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toMatchObject({ kind: "ready", decoded: { kind: "accepted", resources: [{ resourceHash: initial.hashes[0], bytes: initial.originalBytes }] } });
  72  |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  73  |  await page.evaluate(() => window.__telegramReadonlySource.dispose());
  74  | });
  75  | 
  76  | test('TMA-READONLY-MIXED-01: one healthy and one genuine corrupt Project retain a partial directory and exact unverified source', async ({ page }) => {
  77  |  const { healthy, corrupt, rawCorruptSource } = await page.evaluate(() => window.__telegramReadonlySource.seedMixedDirectory());
  78  |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  79  |  await page.evaluate(() => window.__telegramReadonlySource.start());
  80  |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [healthy], recoveryNeeded: true });
  81  |  const sources = await page.evaluate(() => window.__telegramReadonlySource.listSources());
  82  |  expect(sources).toHaveLength(2);
  83  |  expect(sources).toEqual(expect.arrayContaining([
  84  |   { kind: 'unverified-source', projectId: healthy.projectId, revisionId: healthy.revisionId },
  85  |   { kind: 'unverified-source', projectId: corrupt.projectId, revisionId: corrupt.revisionId },
  86  |  ]));
> 87  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), corrupt)).toEqual({ kind: 'unverified-source', projectId: corrupt.projectId, revisionId: corrupt.revisionId, serializedProject: rawCorruptSource });
      |                                                                                                                                   ^ Error: expect(received).toEqual(expected) // deep equality
  88  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), healthy)).toMatchObject({ kind: 'ready', decoded: { kind: 'accepted', projectMember: { format: 'runtime-v1-wire', project: { projectId: healthy.projectId } } } });
  89  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), corrupt)).toEqual({ kind: 'rejected', reasonCode: 'PORTABLE_BACKUP_RESOURCES_UNAVAILABLE' });
  90  |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  91  |  await page.evaluate(() => window.__telegramReadonlySource.dispose());
  92  | });
  93  | 
  94  | test('TMA-READONLY-MIXED-02: an actual numeric native Project key is reported as partial and never exposed as a source address', async ({ page }) => {
  95  |  const healthy = await page.evaluate(() => window.__telegramReadonlySource.seedNumericProjectKey());
  96  |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  97  |  await page.evaluate(() => window.__telegramReadonlySource.start());
  98  |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [healthy], recoveryNeeded: true });
  99  |  expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([{ kind: 'unverified-source', projectId: healthy.projectId, revisionId: healthy.revisionId }]);
  100 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  101 |  await page.evaluate(() => window.__telegramReadonlySource.dispose());
  102 | });
  103 | 
  104 | test.beforeEach(async ({ page }, testInfo) => {
  105 |  await page.goto('/');
  106 |  const expected = JSON.parse(process.env.TMA_READONLY_SUBJECTS ?? "null") as Record<string, { sha: string; instrumented: boolean }> | null;
  107 |  const actual = await page.evaluate(() => Object.fromEntries(Object.entries(window.__telegramReadonlySource.loaded() ?? {}).map(([key, value]) => [key, { sha: value.sha, instrumented: value.instrumented, active: value.readActive() }])));
  108 |  let valid = false;
  109 |  try {
  110 |   expect(expected).not.toBeNull();
  111 |   expect(Object.keys(actual).sort()).toEqual(["telegram-readonly-project-snapshot", "telegram-readonly-project-source"]);
  112 |   for (const [key, value] of Object.entries(expected ?? {})) {
  113 |    expect(actual[key]).toEqual({ ...value, active: value.instrumented ? process.env.__STRYKER_ACTIVE_MUTANT__ ?? null : null });
  114 |   }
  115 |   valid = true;
  116 |  } catch (error) {
  117 |   throw new Error(`READONLY_PROOF_INVALID: actual subject activation failed for ${testInfo.title}`, { cause: error });
  118 |  } finally {
  119 |   await testInfo.attach("readonly-activation", { body: JSON.stringify({ membership: await page.evaluate(() => Object.fromEntries(Object.entries(window.__telegramReadonlySource.loaded() ?? {}).map(([key, value]) => [key, value.localIDs.includes(value.readActive() ?? "__no_active__")]))), testId: testInfo.testId, file: testInfo.file, pid: process.pid, title: testInfo.title, valid, expected, actual, active: process.env.__STRYKER_ACTIVE_MUTANT__ ?? null }), contentType: "application/json" });
  120 |  }
  121 | });
  122 | 
  123 | test('TMA-READONLY-01: a genuine published Project is listed and exported with exact current bytes using only readonly native transactions', async ({ page }) => {
  124 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  125 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  126 |  expect(await page.evaluate(() => window.__telegramReadonlySource.start())).toMatchObject({ aborted: false, transactions: [] });
  127 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [initial] });
  128 |  const result = await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial);
  129 |  expect(result).toMatchObject({ kind: 'ready', mimeType: 'application/zip', decoded: { kind: 'accepted', projectMember: { format: 'runtime-v1-wire', project: { projectId: initial.projectId, name: initial.name } } } });
  130 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  131 |  const modes = await page.evaluate(() => window.__telegramReadonlySource.modes());
  132 |  expect(modes.length).toBeGreaterThan(0);
  133 |  expect(modes.every(value => value.mode === 'readonly')).toBe(true);
  134 |  expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
  135 | });
  136 | 
  137 | for (const fault of ["creation-missing", "creation-prepared", "creation-checksum", "creation-receipt-id", "creation-scope", "revision-schema", "manifest-sparse"] as const) {
  138 |  test(`TMA-READONLY-02: ${fault} stays unverified while exact current source remains recoverable without any write`, async ({ page }) => {
  139 |   const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  140 |   await page.evaluate(fault => window.__telegramReadonlySource.tamper(fault), fault);
  141 |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  142 |   await page.evaluate(() => window.__telegramReadonlySource.start());
  143 |   expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
  144 |   expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([{ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId }]);
  145 |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toMatchObject({ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId });
  146 |   expect(await page.evaluate(({ projectId }) => window.__telegramReadonlySource.read(projectId, "stale"), initial)).toBeUndefined();
  147 |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  148 |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  149 |  });
  150 | }
  151 | for (const fault of ["pointer-scope", "pointer-revision-stale", "revision-missing", "revision-scope", "revision-project", "candidate-project", "candidate-revision"] as const) {
  152 |  test(`TMA-READONLY-03: ${fault} cannot reveal borrowed raw bytes or a healthy Project`, async ({ page }) => {
  153 |   const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  154 |   await page.evaluate(fault => window.__telegramReadonlySource.tamper(fault), fault);
  155 |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  156 |   await page.evaluate(() => window.__telegramReadonlySource.start());
  157 |   expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
  158 |   expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([]);
  159 |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toBeUndefined();
  160 |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  161 |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
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
```