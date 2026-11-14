# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-readonly-source-e2e.check.ts >> TMA-READONLY-MIXED-01: one healthy and one genuine corrupt Project retain a partial directory and exact unverified source
- Location: tests/browser/telegram-readonly-source-e2e.check.ts:5:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 0

@@ -6,7 +6,6 @@
        "projectId": "readonly-project",
        "revisionId": "readonly-revision",
        "updatedAt": "2026-11-05T00:00:00.000Z",
      },
    ],
-   "recoveryNeeded": true,
  }
```

# Page snapshot

```yaml
- main [ref=e2]: Native IndexedDB readonly source proof.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import type {} from './telegram-readonly-source-harness';
  3   | declare const process: { readonly env: Readonly<Record<string, string | undefined>> };
  4   | 
  5   | test('TMA-READONLY-MIXED-01: one healthy and one genuine corrupt Project retain a partial directory and exact unverified source', async ({ page }) => {
  6   |  const { healthy, corrupt, rawCorruptSource } = await page.evaluate(() => window.__telegramReadonlySource.seedMixedDirectory());
  7   |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  8   |  await page.evaluate(() => window.__telegramReadonlySource.start());
> 9   |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [healthy], recoveryNeeded: true });
      |                                                                            ^ Error: expect(received).toEqual(expected) // deep equality
  10  |  const sources = await page.evaluate(() => window.__telegramReadonlySource.listSources());
  11  |  expect(sources).toHaveLength(2);
  12  |  expect(sources).toEqual(expect.arrayContaining([
  13  |   { kind: 'unverified-source', projectId: healthy.projectId, revisionId: healthy.revisionId },
  14  |   { kind: 'unverified-source', projectId: corrupt.projectId, revisionId: corrupt.revisionId },
  15  |  ]));
  16  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), corrupt)).toEqual({ kind: 'unverified-source', projectId: corrupt.projectId, revisionId: corrupt.revisionId, serializedProject: rawCorruptSource });
  17  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), healthy)).toMatchObject({ kind: 'ready', decoded: { kind: 'accepted', projectMember: { format: 'runtime-v1-wire', project: { projectId: healthy.projectId } } } });
  18  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), corrupt)).toEqual({ kind: 'rejected', reasonCode: 'PORTABLE_BACKUP_RESOURCES_UNAVAILABLE' });
  19  |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  20  |  await page.evaluate(() => window.__telegramReadonlySource.dispose());
  21  | });
  22  | 
  23  | test('TMA-READONLY-MIXED-02: an actual numeric native Project key is reported as partial and never exposed as a source address', async ({ page }) => {
  24  |  const healthy = await page.evaluate(() => window.__telegramReadonlySource.seedNumericProjectKey());
  25  |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  26  |  await page.evaluate(() => window.__telegramReadonlySource.start());
  27  |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [healthy], recoveryNeeded: true });
  28  |  expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([{ kind: 'unverified-source', projectId: healthy.projectId, revisionId: healthy.revisionId }]);
  29  |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  30  |  await page.evaluate(() => window.__telegramReadonlySource.dispose());
  31  | });
  32  | 
  33  | test.beforeEach(async ({ page }, testInfo) => {
  34  |  await page.goto('/');
  35  |  const expected = JSON.parse(process.env.TMA_READONLY_SUBJECTS ?? "null") as Record<string, { sha: string; instrumented: boolean }> | null;
  36  |  const actual = await page.evaluate(() => Object.fromEntries(Object.entries(window.__telegramReadonlySource.loaded() ?? {}).map(([key, value]) => [key, { sha: value.sha, instrumented: value.instrumented, active: value.readActive() }])));
  37  |  let valid = false;
  38  |  try {
  39  |   expect(expected).not.toBeNull();
  40  |   expect(Object.keys(actual).sort()).toEqual(["telegram-readonly-project-snapshot", "telegram-readonly-project-source"]);
  41  |   for (const [key, value] of Object.entries(expected ?? {})) {
  42  |    expect(actual[key]).toEqual({ ...value, active: value.instrumented ? process.env.__STRYKER_ACTIVE_MUTANT__ ?? null : null });
  43  |   }
  44  |   valid = true;
  45  |  } catch (error) {
  46  |   throw new Error(`READONLY_PROOF_INVALID: actual subject activation failed for ${testInfo.title}`, { cause: error });
  47  |  } finally {
  48  |   await testInfo.attach("readonly-activation", { body: JSON.stringify({ title: testInfo.title, valid, expected, actual, active: process.env.__STRYKER_ACTIVE_MUTANT__ ?? null }), contentType: "application/json" });
  49  |  }
  50  | });
  51  | 
  52  | test('TMA-READONLY-01: a genuine published Project is listed and exported with exact current bytes using only readonly native transactions', async ({ page }) => {
  53  |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  54  |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  55  |  expect(await page.evaluate(() => window.__telegramReadonlySource.start())).toMatchObject({ aborted: false, transactions: [] });
  56  |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: 'populated', projects: [initial] });
  57  |  const result = await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial);
  58  |  expect(result).toMatchObject({ kind: 'ready', mimeType: 'application/zip', decoded: { kind: 'accepted', projectMember: { format: 'runtime-v1-wire', project: { projectId: initial.projectId, name: initial.name } } } });
  59  |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  60  |  const modes = await page.evaluate(() => window.__telegramReadonlySource.modes());
  61  |  expect(modes.length).toBeGreaterThan(0);
  62  |  expect(modes.every(value => value.mode === 'readonly')).toBe(true);
  63  |  expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
  64  | });
  65  | 
  66  | for (const fault of ["creation-missing", "creation-prepared", "creation-checksum", "creation-receipt-id", "creation-scope", "revision-schema", "manifest-sparse"] as const) {
  67  |  test(`TMA-READONLY-02: ${fault} stays unverified while exact current source remains recoverable without any write`, async ({ page }) => {
  68  |   const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  69  |   await page.evaluate(fault => window.__telegramReadonlySource.tamper(fault), fault);
  70  |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  71  |   await page.evaluate(() => window.__telegramReadonlySource.start());
  72  |   expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
  73  |   expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([{ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId }]);
  74  |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toMatchObject({ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId });
  75  |   expect(await page.evaluate(({ projectId }) => window.__telegramReadonlySource.read(projectId, "stale"), initial)).toBeUndefined();
  76  |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  77  |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  78  |  });
  79  | }
  80  | for (const fault of ["pointer-scope", "pointer-revision-stale", "revision-missing", "revision-scope", "revision-project", "candidate-project", "candidate-revision"] as const) {
  81  |  test(`TMA-READONLY-03: ${fault} cannot reveal borrowed raw bytes or a healthy Project`, async ({ page }) => {
  82  |   const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  83  |   await page.evaluate(fault => window.__telegramReadonlySource.tamper(fault), fault);
  84  |   const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  85  |   await page.evaluate(() => window.__telegramReadonlySource.start());
  86  |   expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
  87  |   expect(await page.evaluate(() => window.__telegramReadonlySource.listSources())).toEqual([]);
  88  |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toBeUndefined();
  89  |   expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  90  |   expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  91  |  });
  92  | }
  93  | test("TMA-READONLY-04: corrupt source preserves every original UTF16 code unit and remains separate from a complete backup", async ({ page }) => {
  94  |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
  95  |  await page.evaluate(() => window.__telegramReadonlySource.tamper("corrupt-string"));
  96  |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  97  |  await page.evaluate(() => window.__telegramReadonlySource.start());
  98  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial)).toEqual({ kind: "unverified-source", projectId: initial.projectId, revisionId: initial.revisionId, serializedProject: " \u0000raw-corrupt\ud800😀\n" });
  99  |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
  100 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  101 | });
  102 | test("TMA-READONLY-05: complete registered export preserves native signed-zero, own undefined, nested variants, finite legacy yaw and lone UTF16 identity", async ({ page }) => {
  103 |  const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ legacyValues: true }));
  104 |  const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
  105 |  await page.evaluate(() => window.__telegramReadonlySource.start());
  106 |  expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
  107 |  expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary)).toMatchObject({ kind: "ready", decoded: { kind: "accepted", projectMember: { format: "runtime-v1-wire", project: { projectId: "readonly-project\ud800" } } }, fidelity: { negativeZero: true, ownUndefinedName: true, ownUndefinedVariant: true, rawYaw: 0.5, nestedVariant: [["alpha-blue"]] } });
  108 |  expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
  109 | });
```