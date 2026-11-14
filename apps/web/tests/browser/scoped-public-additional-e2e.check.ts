import { expect, test } from "../verification/scoped-protocol-native-test";
import type {} from "../verification/scoped-public-additional-harness";

const timer = globalThis.setTimeout,
	clearTimer = globalThis.clearTimeout;
async function complete<T>(operation: Promise<T>): Promise<T> {
	let handle: ReturnType<typeof setTimeout> | undefined;
	const result = await Promise.race([
		operation.then(
			(value) => ({ kind: "fulfilled" as const, value }),
			(reason) => ({ kind: "rejected" as const, reason }),
		),
		new Promise<{ kind: "pending" }>((resolve) => {
			handle = timer(() => resolve({ kind: "pending" }), 2500);
		}),
	]).finally(() => {
		if (handle !== undefined) clearTimer(handle);
	});
	expect(result.kind).toBe("fulfilled");
	if (result.kind !== "fulfilled")
		throw new Error("Public protocol operation did not complete");
	return result.value;
}
for (const mode of [
	"prepared-other",
	"published-other",
	"prepared-library",
] as const)
	test(`COMMON-ADDITIONAL-SHARED-${mode}: takeover preserves independent resource roots`, async ({
		page,
	}) => {
		await page.goto("/");
		const r = await complete(
			page.evaluate(
				(mode) => window.scopedAdditional.sharedTakeover(mode),
				mode,
			),
		);
		expect(r.takeover.kind).toBe("writable");
		expect(r.bytesAfterTakeover).toEqual([101, 102, 103]);
		expect(r.rootsAfterTakeover).toEqual(r.expectedOtherRoots);
		expect(r.otherDataAfter).toEqual(r.otherDataBefore);
		if (mode === "prepared-library") {
			expect(r.libraryBefore.length).toBeGreaterThan(0);
			expect(r.libraryAfter).toEqual(r.libraryBefore);
			expect(r.durableAfterTakeover).toBe(true);
		} else {
			expect(r.otherPublication).toEqual({ kind: "durable" });
			expect(r.otherCurrent).toMatchObject({
				kind: "durable",
				candidate: { revision: { revisionId: "other-r1" } },
			});
		}
		if (mode === "published-other") {
			expect(r.firstCurrent).toMatchObject({
				kind: "durable",
				candidate: { revision: { revisionId: "first-r1" } },
			});
			expect(r.durableAfterTakeover).toBe(true);
		}
	});
for (const field of ["attempt", "revision", "stage", "pin"] as const)
	test(`COMMON-ADDITIONAL-RECONCILE-${field}: late native snapshot change never authorizes cleanup`, async ({
		page,
	}) => {
		await page.goto("/");
		const r = await complete(
			page.evaluate(
				(field) => window.scopedAdditional.takeoverSnapshotCas(field),
				field,
			),
		);
		expect(r.snapshotObserved).toBe(true);
		expect(r.faultCount).toBe(1);
		expect(r.observedDigest).toBe(r.expectedDigest);
		expect(r.refused).toEqual({ kind: "not-ready" });
		expect(r.afterRefusal).toEqual(r.afterFault);
		expect(r.bytesAfterRefusal).toEqual([101, 102, 103]);
		expect(r.currentAfterRefusal).toMatchObject({
			kind: "durable",
			candidate: { revision: { revisionId: "base-r1" } },
		});
		expect(r.retry.kind).toBe("writable");
		expect(r.finalCurrent).toMatchObject({
			kind: "durable",
			candidate: { revision: { revisionId: "base-r1" } },
		});
	});
for (const mode of ["existing-no-base", "absent-with-base"] as const)
	test(`COMMON-ADDITIONAL-BASE-${mode}: a missing predecessor proof cannot create or replace a Project`, async ({
		page,
	}) => {
		await page.goto("/");
		const r = await complete(
			page.evaluate((mode) => window.scopedAdditional.missingBase(mode), mode),
		);
		expect(r.refused.kind).toBe("persist-failed");
		expect(r.afterData).toEqual(r.beforeData);
		expect(r.identityAfter).toEqual(r.identityBefore);
		expect(BigInt(r.counterAfter) >= BigInt(r.counterBefore)).toBe(true);
		expect(r.positive).toEqual({ kind: "durable" });
	});
for (const field of [
	"project",
	"revision",
	"checksum",
	"serialization",
	"intent",
] as const)
	test(`COMMON-ADDITIONAL-HISTORY-${field}: original creation must match before history staging`, async ({
		page,
	}) => {
		await page.goto("/");
		const r = await complete(
			page.evaluate(
				(field) => window.scopedAdditional.historyCreation(field),
				field,
			),
		);
		expect(r.refused.kind).toBe("persist-failed");
		expect(r.afterData).toEqual(r.beforeData);
		expect(r.currentAfterRefusal).toMatchObject({
			kind: "durable",
			candidate: { revision: { revisionId: "history-r2" } },
		});
		expect(r.positive).toEqual({ kind: "durable" });
		expect(r.finalCurrent).toMatchObject({
			kind: "durable",
			candidate: { revision: { revisionId: "history-r1" } },
		});
	});
test("COMMON-ADDITIONAL-STAGE: published journal plus another prepared attempt cannot authorize an extra stage", async ({
	page,
}) => {
	await page.goto("/");
	const r = await complete(
		page.evaluate(() => window.scopedAdditional.knownPublishedExtraStage()),
	);
	expect(r.access).toEqual({ kind: "not-ready" });
	expect(r.takeover).toEqual({ kind: "not-ready" });
	expect(r.after).toEqual(r.before);
	expect(r.restored.kind).toBe("writable");
	expect(r.bytes).toEqual([101, 102, 103]);
});
for (const field of ["extra", "deleted", "negative-clock"] as const)
	test(`COMMON-ADDITIONAL-FENCE-${field}: a late invalid writer fact requires explicit takeover`, async ({
		page,
	}) => {
		await page.goto("/");
		const r = await complete(
			page.evaluate((field) => window.scopedAdditional.lateFence(field), field),
		);
		expect(r.faultCount).toBe(1);
		expect(r.observedDigest).toBe(r.expectedDigest);
		expect(r.refused.kind).toBe("persist-failed");
		expect(r.afterRefusal).toEqual(r.afterFault);
		expect(r.lost).toBe(true);
		expect(r.lostAgain).toBe(false);
		expect(r.blocked.kind).toBe("persist-failed");
		expect(r.blockedAfter).toEqual(r.blockedBefore);
		expect(r.takeover.kind).toBe("writable");
		expect(r.positive).toEqual({ kind: "durable" });
	});
test("COMMON-ADDITIONAL-EPOCH-ZERO: zero is a valid writer epoch and can publish durably", async ({
	page,
}) => {
	await page.goto("/");
	const r = await complete(
		page.evaluate(() => window.scopedAdditional.zeroEpoch()),
	);
	expect(r.published).toEqual({ kind: "durable" });
	expect(r.current).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "zero-r1" } },
	});
});

test("COMMON-ADDITIONAL-FOREIGN-CREATION: cleaning the last owned root does not garbage-collect another lease's bytes", async ({
	page,
}) => {
	await page.goto("/");
	const result = await complete(
		page.evaluate(() =>
			window.scopedAdditional.foreignCreationSurvivesLastRootCleanup(),
		),
	);
	expect(result.originLease).not.toBe(result.consumerLease);
	expect(result.beforeCreationLease).toBe(result.originLease);
	expect(result.beforeRoots).toEqual([result.consumerLease]);
	expect(result.beforeDurable).toBe(false);
	expect(result.takeover.kind).toBe("writable");
	expect(result.bytesAfter).toEqual([101, 102, 103]);
	expect(result.resourceAfter).toEqual(result.expectedResourceAfter);
	expect(result.originAfter).toEqual(result.originBefore);
	expect(result.metadataAfter.identity).toEqual(result.metadataBefore.identity);
	expect(
		BigInt(result.metadataAfter.counter) >= BigInt(result.metadataBefore.counter),
	).toBe(true);
	expect(result.consumerAfter).toEqual({ kind: "empty" });
});
