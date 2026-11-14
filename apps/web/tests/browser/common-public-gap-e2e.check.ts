import type {} from "../verification/common-public-gap-harness";
import { expect, test } from "../verification/common205-native-test";

function preservesTechnical(
	before: {
		counter: string;
		counterKeys: string[];
		identityRows: readonly unknown[];
		count: number;
	},
	after: {
		counter: string;
		counterKeys: string[];
		identityRows: readonly unknown[];
		count: number;
	},
) {
	expect(before.count).toBe(2);
	expect(after.count).toBe(2);
	expect(after.identityRows).toEqual(before.identityRows);
	expect(before.counterKeys).toEqual(["key", "lastReserved"]);
	expect(after.counterKeys).toEqual(before.counterKeys);
	expect(before.counter).toMatch(/^(0|[1-9][0-9]*)$/);
	expect(after.counter).toMatch(/^(0|[1-9][0-9]*)$/);
	expect(BigInt(after.counter) >= BigInt(before.counter)).toBe(true);
}
test("COMMON-GAP-QUOTA: real native abort before prepare commit preserves R1 and reports quota, then healthy retry publishes", async ({
	page,
}) => {
	await page.goto("/");
	const result = await page.evaluate(() =>
		window.commonPublicGaps.quotaBeforeCommit(),
	);
	preservesTechnical(result.technicalBefore, result.technicalAfter);
	expect(result.writeFaults).toBe(1);
	expect(result.actualAborts).toBe(1);
	expect(result.refused).toEqual({
		kind: "persist-failed",
		reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
	});
	expect(result.after.filter((row) => row.name !== "scope-metadata")).toEqual(
		result.before.filter((row) => row.name !== "scope-metadata"),
	);
	expect(result.current.kind).toBe("durable");
	if (result.current.kind === "durable")
		expect(result.current.candidate.revision.revisionId).toBe("r1");
	expect(result.retry).toEqual({ kind: "durable" });
	expect(result.reopened.kind).toBe("durable");
	if (result.reopened.kind === "durable")
		expect(result.reopened.candidate.revision.revisionId).toBe("r2");
});
test("COMMON-GAP-UNMARKED: exact prepared resource cannot publish before explicit mark; same candidate then succeeds", async ({
	page,
}) => {
	await page.goto("/");
	const result = await page.evaluate(() =>
		window.commonPublicGaps.unmarkedPublication(),
	);
	expect(result.refused.kind).toBe("persist-failed");
	expect(result.after).toEqual(result.before);
	expect(result.current.kind).toBe("durable");
	if (result.current.kind === "durable")
		expect(result.current.candidate.revision.revisionId).toBe("r1");
	expect(result.retry).toEqual({ kind: "durable" });
	expect(result.reopened.kind).toBe("durable");
	if (result.reopened.kind === "durable")
		expect(result.reopened.candidate.revision.revisionId).toBe("r2");
});
for (const mode of ["pointer-scope", "lease-project", "attempt-lease"] as const)
	test(`COMMON-GAP-LINK-${mode}: marking requires exact native Project, lease and attempt links without changing any row`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await page.evaluate(
			(mode) => window.commonPublicGaps.pinLink(mode),
			mode,
		);
		expect(result.refused.kind).toBe("rejected");
		expect(result.after).toEqual(result.before);
		expect(result.healthy).toEqual({ kind: "durable" });
		expect(result.reopened.kind).toBe("durable");
		if (result.reopened.kind === "durable")
			expect(result.reopened.candidate.revision.revisionId).toBe("r2");
	});

for (const mode of ["stage-schema", "stage-project"] as const)
	test(`COMMON-GAP-PREPARED-${mode}: same-owner acquisition refuses noncurrent unreadable staging without changing rows`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await page.evaluate(
			(mode) => window.commonPublicGaps.sameOwnerPrepared(mode),
			mode,
		);
		expect(result.refused).toEqual({ kind: "not-ready" });
		expect(result.after).toEqual(result.before);
		expect(result.healthy.kind).toBe("writable");
	});
test("COMMON-GAP-COHERENT-OWNER: changed native attempt and fence owner do not authorize stale in-memory owner to mark", async ({
	page,
}) => {
	await page.goto("/");
	const result = await page.evaluate(() =>
		window.commonPublicGaps.changedStoredOwner(),
	);
	expect(result.refused.kind).toBe("rejected");
	expect(result.after).toEqual(result.before);
	expect(result.healthy).toEqual({ kind: "durable" });
});
for (const mode of [
	"lease-attempt",
	"lease-project",
	"revision-project",
] as const)
	test(`COMMON-GAP-POST-ACQUIRE-${mode}: native corruption after real acquisition commit cannot authorize recovery cleanup`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await page.evaluate(
			(mode) => window.commonPublicGaps.afterAcquisition(mode),
			mode,
		);
		expect(result.faults).toBe(1);
		expect(result.faultedSnapshot).toBeDefined();
		expect(result.refused).toEqual({ kind: "not-ready" });
		expect(result.after).toEqual(result.faultedSnapshot);
		expect(result.current.kind).toBe("durable");
		if (result.current.kind === "durable")
			expect(result.current.candidate.revision.revisionId).toBe("r1");
	});

test("COMMON-GAP-HISTORY-PROTOCOL: noncurrent creation protocol changed after real acquisition cannot authorize history publication", async ({
	page,
}) => {
	await page.goto("/");
	const result = await page.evaluate(() =>
		window.commonPublicGaps.historyCreationProtocol(),
	);
	expect(result.technicalFault).toBeDefined();
	if (result.technicalFault)
		preservesTechnical(result.technicalFault, result.technicalAfter);
	expect(result.faults).toBe(1);
	expect(result.faultedSnapshot).toBeDefined();
	expect(result.refused.kind).toBe("persist-failed");
	expect(result.after.filter((row) => row.name !== "scope-metadata")).toEqual(
		result.faultedSnapshot?.filter((row) => row.name !== "scope-metadata"),
	);
	expect(result.current.kind).toBe("durable");
	if (result.current.kind === "durable")
		expect(result.current.candidate.revision.revisionId).toBe("r2");
});
test("COMMON-GAP-PUBLISHED-MARK: published journal cannot retain an unmarked pin and renew writer authority", async ({
	page,
}) => {
	await page.goto("/");
	const result = await page.evaluate(() =>
		window.commonPublicGaps.publishedPinAuthorization(),
	);
	expect(result.refused).toEqual({ kind: "not-ready" });
	expect(result.after).toEqual(result.before);
	expect(result.healthy.kind).toBe("writable");
});

for (const mode of ["project", "revision"] as const)
	test(`COMMON-GAP-MARK-${mode}: publication parameters cannot authorize a different prepared identity`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await page.evaluate(
			(mode) => window.commonPublicGaps.wrongPublication(mode),
			mode,
		);
		expect(result.refused.kind).toBe("rejected");
		expect(result.after).toEqual(result.before);
		expect(result.healthy).toEqual({ kind: "durable" });
	});
for (const mode of ["scope", "candidate"] as const)
	test(`COMMON-GAP-LATE-REVISION-${mode}: native target mutation after actual resource hashing refuses publication atomically`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await page.evaluate(
			(mode) => window.commonPublicGaps.lateRevision(mode),
			mode,
		);
		expect(result.faults).toBe(1);
		expect(result.faultedSnapshot).toBeDefined();
		expect(result.refused.kind).toBe("persist-failed");
		expect(result.after).toEqual(result.faultedSnapshot);
		expect(result.current.kind).toBe("durable");
		if (result.current.kind === "durable")
			expect(result.current.candidate.revision.revisionId).toBe("r1");
		expect(result.stillExists).toBe(true);
		expect(result.healthy).toEqual({ kind: "durable" });
	});

for (const mode of ["receipt", "scope", "protocol"] as const)
	test(`COMMON-GAP-OLD-JOURNAL-${mode}: noncurrent published receipt and identity remain authoritative before writer renewal`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await page.evaluate(
			(mode) => window.commonPublicGaps.noncurrentJournal(mode),
			mode,
		);
		expect(result.refused).toEqual({ kind: "not-ready" });
		expect(result.after).toEqual(result.before);
		expect(result.current.kind).toBe("durable");
		if (result.current.kind === "durable")
			expect(result.current.candidate.revision.revisionId).toBe("r2");
		expect(result.healthy.kind).toBe("writable");
	});
test("COMMON-GAP-OLD-ACK: lost acknowledgement retry after R3 still requires exact R2 receipt without rewinding", async ({
	page,
}) => {
	await page.goto("/");
	const result = await page.evaluate(() =>
		window.commonPublicGaps.noncurrentAcknowledgement(),
	);
	expect(result.acknowledgementLosses).toBe(1);
	expect(result.acknowledgedCommitSnapshot).toBeDefined();
	expect(result.lost.kind).toBe("persist-failed");
	expect(result.actuallyCommitted.kind).toBe("durable");
	expect(result.faults).toBe(1);
	expect(result.faultedSnapshot).toBeDefined();
	expect(result.refused.kind).toBe("persist-failed");
	expect(result.after).toEqual(result.faultedSnapshot);
	expect(result.current.kind).toBe("durable");
	if (result.current.kind === "durable")
		expect(result.current.candidate.revision.revisionId).toBe("r3");
	expect(result.retried).toEqual({ kind: "durable" });
	expect(result.afterRetry).toEqual(result.beforeRetry);
});
for (const mode of ["ordinary", "ambiguous-creator"] as const)
	test(`COMMON-GAP-HISTORY-RETAIN-${mode}: cancelled history attempt cannot delete its original Durable Revision`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await page.evaluate(
			(mode) => window.commonPublicGaps.failedHistory(mode),
			mode,
		);
		expect(result.beforeProtected).toBeDefined();
		expect(result.afterProtected).toEqual(result.beforeProtected);
		expect(["prepared", "no-publish"]).toContain(result.historyAfter?.state);
		expect(result.aborts).toBe(1);
		expect(result.failed.kind).toBe("persist-failed");
		expect(result.history.intent).toBe("history");
		expect(result.surviving).toBeDefined();
		if (mode === "ordinary") {
			expect(result.takeover.kind).toBe("writable");
			expect(result.surviving).toEqual(result.original);
		} else {
			expect(result.faults).toBe(1);
			expect(result.surviving?.creationAttemptId).toBe(
				result.history.attemptId,
			);
		}
		expect(result.current.kind).toBe("durable");
		if (result.current.kind === "durable")
			expect(result.current.candidate.revision.revisionId).toBe("r2");
		expect(result.recovery.kind).toBe("writable");
		expect(result.retry).toEqual({ kind: "durable" });
		expect(result.reopened.kind).toBe("durable");
		if (result.reopened.kind === "durable")
			expect(result.reopened.candidate.revision.revisionId).toBe("r1");
	});
for (const mode of [
	"prepared-without-lease",
	"no-publish-without-lease",
] as const)
	test(`COMMON-GAP-ORPHAN-PIN-${mode}: an actual journal without backlink cannot authorize an added pin`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await page.evaluate(
			(mode) => window.commonPublicGaps.orphanPin(mode),
			mode,
		);
		expect(result.refused).toEqual({ kind: "not-ready" });
		expect(result.after).toEqual(result.before);
		expect(result.healthy.kind).toBe("writable");
		if (mode === "prepared-without-lease") expect(result.aborts).toBe(1);
	});
