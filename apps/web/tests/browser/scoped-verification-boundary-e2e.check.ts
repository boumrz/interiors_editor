import { expect, test } from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";

for (const mode of [
	"expiry-exact",
	"expiry-after",
	"resource-version",
] as const) {
	test(`SCOPED-VERIFY-${mode}: a verified digest cannot authorize a stale fence or changed resource generation`, async ({
		page,
	}) => {
		await page.goto("/");
		await page.evaluate(() => {
			window.__telegramProjectHarness.create("a", "a", "owner-a");
			window.__telegramProjectHarness.setNow("a", 1000);
		});
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.publishFixture("a", "kept", "kept-r1"),
			),
		).toEqual({ kind: "durable" });
		const healthy = await page.evaluate(() =>
			window.__telegramProjectHarness.load("a", "kept"),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.prepareResource(
				"a",
				"boundary",
				"candidate",
				"candidate-r1",
				[11, 12, 13],
			),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.writePrepared("a", "boundary"),
		);
		await page.evaluate(
			(mode) =>
				window.__telegramProjectHarness.armVerificationBoundary(
					"a",
					"a",
					"boundary",
					mode,
				),
			mode,
		);
		const outcome = await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "boundary"),
		);
		const proof = await page.evaluate(() =>
			window.__telegramProjectHarness.verificationBoundaryProof("boundary"),
		);
		if (!proof)
			throw new Error("Actual resource digest boundary was not reached");
		expect(proof.digestMatches).toBe(true);
		if (mode === "resource-version") {
			expect(proof.afterVersion).not.toBe(proof.beforeVersion);
			expect(typeof proof.afterVersion).toBe("string");
		} else {
			expect(proof.verificationNow).toBe(
				proof.writerExpiry + (mode === "expiry-after" ? 1 : 0),
			);
		}
		expect(outcome).toMatchObject({ kind: "persist-failed" });
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.protocolSnapshot("a"),
			),
		).toEqual(proof.afterFaultSnapshot);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.load("a", "kept"),
			),
		).toEqual(healthy);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.load("a", "candidate"),
			),
		).toEqual({ kind: "empty" });
		const modes = await page.evaluate(
			() => window.__telegramScopeHarness.durabilityModes,
		);
		expect(modes.length).toBeGreaterThan(0);
		expect(modes.every((value) => value === "strict")).toBe(true);
	});
}
