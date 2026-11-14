import { test, expect, withReaderPublicBody as withReaderBodyProof } from "../verification/reader-public-regressions-native-test";
import type {} from "./telegram-readonly-source-harness";
import type {} from "./telegram-readonly-public-regressions-harness";

test("TMA-READONLY-PUBLIC-01: renaming the native counter key cannot preserve an admitted metadata identity", withReaderBodyProof(async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seed());
 const original = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial] });
 const renamed = await page.evaluate(() => window.__telegramReadonlyCounterMatrix.renameCounterKey());
 expect(renamed.keys).toEqual(["a-counter", "identity"]);
 expect(renamed.records).toHaveLength(2);
 const counter = renamed.records[0] as { key: string; lastReserved: string };
 const originalCounter = ((original as Record<string, readonly unknown[]>)["scope-metadata"] as { key: string; lastReserved?: string }[]).find(value => value.key === "counter");
 expect(originalCounter).toBeDefined();
 expect(counter).toEqual({ key: "a-counter", lastReserved: originalCounter?.lastReserved });
 const corrupted = await page.evaluate(() => window.__telegramReadonlySource.rows());
 expect({ ...(corrupted as Record<string, unknown>), "scope-metadata": (original as Record<string, unknown>)["scope-metadata"] }).toEqual(original);
 await page.evaluate(() => window.__telegramReadonlySource.startList());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
 expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(corrupted);
 await page.evaluate(values => window.__telegramReadonlySource.replaceRows(values as Record<string, readonly unknown[]>), original);
 await page.evaluate(() => window.__telegramReadonlySource.startList());
 await expect.poll(() => page.evaluate(() => window.__telegramReadonlySource.operation()?.status)).toBe("rejected");
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(original);
 expect((await page.evaluate(() => window.__telegramReadonlySource.modes())).every(value => value.mode === "readonly" && value.final !== undefined)).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
}));

test("TMA-READONLY-PUBLIC-02: a wrong expected Revision refuses complete backup while the exact current Revision remains exportable", withReaderBodyProof(async ({ page }) => {
 const initial = await page.evaluate(() => window.__telegramReadonlySource.seedFixture({ resources: true }));
 const before = await page.evaluate(() => window.__telegramReadonlySource.rows());
 await page.evaluate(() => window.__telegramReadonlySource.start());
 expect(await page.evaluate(() => window.__telegramReadonlySource.list())).toEqual({ kind: "populated", projects: [initial.summary] });
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, `${revisionId}-not-current`), initial.summary)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" });
 expect(await page.evaluate(() => window.__telegramReadonlySource.signal())).toBe(false);
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 expect(await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.read(projectId, revisionId), initial.summary)).toEqual({ kind: "unverified-source", projectId: initial.summary.projectId, revisionId: initial.summary.revisionId, serializedProject: initial.serializedProject });
 const exported = await page.evaluate(({ projectId, revisionId }) => window.__telegramReadonlySource.export(projectId, revisionId), initial.summary);
 expect(exported).toMatchObject({ kind: "ready", decoded: { kind: "accepted", projectMember: { format: "runtime-v1-wire", project: { projectId: initial.summary.projectId } } } });
 expect(exported).toMatchObject({ kind: "ready", decoded: { resources: expect.arrayContaining(initial.hashes.map(resourceHash => ({ resourceHash, bytes: initial.originalBytes }))) } });
 expect(await page.evaluate(() => window.__telegramReadonlySource.rows())).toEqual(before);
 expect((await page.evaluate(() => window.__telegramReadonlySource.modes())).every(value => value.mode === "readonly" && value.final !== undefined)).toBe(true);
 expect(await page.evaluate(() => window.__telegramReadonlySource.dispose())).toEqual({ aborted: true });
}));
