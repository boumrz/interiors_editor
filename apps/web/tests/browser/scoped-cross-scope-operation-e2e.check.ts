import { expect, test } from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";

test("SCOPED-OPERATION-SCOPE: a valid receipt cannot lend its creation operation to another embedded scope", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => window.__telegramProjectHarness.create("a", "a", "owner-a"));
	expect(await page.evaluate(() => window.__telegramProjectHarness.publishFixture("a", "p", "r1"))).toEqual({ kind: "durable" });
	expect((await page.evaluate(() => window.__telegramProjectHarness.load("a", "p"))).kind).toBe("durable");
	const fault = await page.evaluate(() => window.__telegramProjectHarness.foreignCreationOperation("a", "p", "r1"));
	expect(fault.foreignAttemptId).not.toBe(fault.originalAttemptId);
	expect(fault.foreignAttemptId).not.toContain(String(fault.originalRowScope));
	const afterFault = await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"));
	expect(await page.evaluate(() => window.__telegramProjectHarness.load("a", "p"))).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
	expect(await page.evaluate(() => window.__telegramProjectHarness.readRecoverySource("a", "p", "r1"))).toEqual({ kind: "unverified-source", projectId: "p", revisionId: "r1", serializedProject: fault.originalSerializedProject });
	expect(await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(afterFault);
});
