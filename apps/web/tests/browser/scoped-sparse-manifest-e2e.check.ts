import { expect, test } from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";

test("SCOPED-SPARSE-MANIFEST: a native sparse metadata array cannot become the exact published empty manifest", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => window.__telegramProjectHarness.create("a", "a", "owner-a"));
	expect(await page.evaluate(() => window.__telegramProjectHarness.publishFixture("a", "sparse-project", "sparse-r1"))).toEqual({ kind: "durable" });
	expect((await page.evaluate(() => window.__telegramProjectHarness.load("a", "sparse-project"))).kind).toBe("durable");
	const fault = await page.evaluate(() => window.__telegramProjectHarness.sparseCurrentManifest("a", "sparse-r1"));
	expect(fault.nativeLength).toBe(1);
	expect(fault.nativeOwnKeys).toEqual([]);
	const before = await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"));
	expect(await page.evaluate(() => window.__telegramProjectHarness.load("a", "sparse-project"))).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
	expect(await page.evaluate(() => window.__telegramProjectHarness.recover("a"))).toEqual({ kind: "recovered" });
	expect(await page.evaluate(() => window.__telegramProjectHarness.readRecoverySource("a", "sparse-project", "sparse-r1"))).toEqual({ kind: "unverified-source", projectId: "sparse-project", revisionId: "sparse-r1", serializedProject: fault.originalSource });
	expect(await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(before);
});
