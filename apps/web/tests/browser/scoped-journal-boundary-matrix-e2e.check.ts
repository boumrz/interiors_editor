import { expect, test } from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";

const faults = [
	"current-receipt-checksum", "current-receipt-revision", "current-receipt-manifest", "current-receipt-extra",
	"current-journal-version", "current-journal-owner-number", "current-journal-fence-zero", "current-journal-base-number", "current-journal-extra",
	"pending-owner-binding", "pending-fence-binding", "pending-stage-scope", "pending-stage-base", "pending-stage-owner", "pending-stage-checksum",
	"pending-journal-no-publish", "pending-pin-project", "pending-pin-empty-hashes", "pending-pin-marked-number",
] as const;

test("SCOPED-JOURNAL-MATRIX: each uncertain receipt or pending ownership fact is quarantined without changing any stored value", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => {
		window.__telegramProjectHarness.create("a", "a", "owner-a");
		window.__telegramProjectHarness.setNow("a", 1000);
	});
	expect(await page.evaluate(() => window.__telegramProjectHarness.publishFixture("a", "matrix-project", "matrix-r1"))).toEqual({ kind: "durable" });
	const healthy = await page.evaluate(() => window.__telegramProjectHarness.load("a", "matrix-project"));
	expect(healthy.kind).toBe("durable");
	// These opaque fixture bytes prove storage ownership only, not GLB security or rendering.
	await page.evaluate(() => window.__telegramProjectHarness.prepareResource("a", "matrix", "matrix-project", "matrix-r2", [21, 22, 23], "matrix-r1"));
	await page.evaluate(() => window.__telegramProjectHarness.writePrepared("a", "matrix"));
	await page.evaluate(() => window.__telegramProjectHarness.abortNextProjectPointer());
	expect(await page.evaluate(() => window.__telegramProjectHarness.publishPrepared("a", "matrix"))).toMatchObject({ kind: "persist-failed" });
	expect(await page.evaluate(() => window.__telegramProjectHarness.access("a", "matrix-project"))).toEqual({ kind: "writable", fencingToken: 1 });
	const fixture = await page.evaluate(() => window.__telegramProjectHarness.captureProtocolMatrix("matrix", "a"));
	expect(fixture.publishedAttemptId).not.toBe(fixture.preparedAttemptId);
	const baseline = await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"));
	for (const fault of faults) {
		await test.step(fault, async () => {
			await page.evaluate(() => window.__telegramProjectHarness.restoreProtocolMatrix("matrix"));
			expect(await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(baseline);
			const mutation = await page.evaluate(fault => window.__telegramProjectHarness.applyProtocolMatrixFault("matrix", fault), fault);
			expect(mutation.replicatedOneLogicalField).toBe(fault === "pending-owner-binding" || fault === "pending-fence-binding");
			const afterFault = await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"));
			expect(afterFault).not.toEqual(baseline);
			expect(await page.evaluate(() => window.__telegramProjectHarness.recover("a"))).toEqual({ kind: "recovered" });
			expect(await page.evaluate(() => window.__telegramProjectHarness.load("a", "matrix-project"))).toEqual(fault.startsWith("current-") ? { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" } : healthy);
			expect(await page.evaluate(() => window.__telegramProjectHarness.access("a", "matrix-project"))).toEqual({ kind: "not-ready" });
			expect(await page.evaluate(() => window.__telegramProjectHarness.readRecoverySource("a", "matrix-project", "matrix-r1"))).toEqual({ kind: "unverified-source", projectId: "matrix-project", revisionId: "matrix-r1", serializedProject: fixture.currentSource });
			expect(await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(afterFault);
			expect(await page.evaluate(() => window.__telegramProjectHarness.resourceBytes("a", "matrix"))).toEqual([21, 22, 23]);
		});
	}
	await page.evaluate(() => window.__telegramProjectHarness.restoreProtocolMatrix("matrix"));
	expect(await page.evaluate(() => window.__telegramProjectHarness.access("a", "matrix-project"))).toEqual({ kind: "writable", fencingToken: 1 });
	expect(await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(baseline);
});
