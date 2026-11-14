import { expect, test } from "../verification/scoped-protocol-native-test";
import type {} from "../verification/scoped-public-protocol-edges-harness";

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
test("SCOPED-PUBLIC-COMMIT-ACK: real committed publication with lost acknowledgement retries exact receipt without another ID", async ({
	page,
}) => {
	await page.goto("/");
	const result = await complete(page.evaluate(() =>
		window.scopedProtocolEdges.publicationAcknowledgementLoss(),
	));
	expect(result.healthy).toEqual({ kind: "durable" });
	expect(result.refused.kind).toBe("persist-failed");
	expect(result.acknowledgementLosses).toBe(1);
	expect(result.committedSnapshot).toHaveLength(9);
	expect(result.committedSnapshot).toEqual(result.beforeRetry);
	expect(result.committed.kind).toBe("durable");
	if (result.committed.kind === "durable")
		expect(result.committed.candidate.project.name).toBe("Public r2");
	expect(result.retried).toEqual({ kind: "durable" });
	expect(result.afterRetry).toEqual(result.beforeRetry);
	expect(result.normalAfterFault).toEqual({ kind: "durable" });
	expect(result.current.kind).toBe("durable");
});
test("SCOPED-PUBLIC-PIN-COMPLETE: completing an unpublished lease refuses without cancellation or row loss", async ({
	page,
}) => {
	await page.goto("/");
	const result = await complete(page.evaluate(() =>
		window.scopedProtocolEdges.unpublishedComplete(),
	));
	expect(result.denied).toEqual({ kind: "rejected" });
	expect(result.after).toEqual(result.before);
	expect(result.before).toHaveLength(9);
	expect(result.published).toEqual({ kind: "durable" });
	expect(result.current.kind).toBe("durable");
	expect(result.resource).toEqual([91, 92, 93]);
});
test("SCOPED-PUBLIC-RESOURCE-PORTS: single exact repair and removed-library hashes preserve byte ownership", async ({
	page,
}) => {
	await page.goto("/");
	const result = await complete(page.evaluate(() =>
		window.scopedProtocolEdges.singleRepairAndRemovedHashes(),
	));
	expect(result.registered.kind).toBe("registered");
	expect(result.beforeRemoved).toEqual([]);
	expect(result.removed).toEqual({ kind: "removed" });
	expect(result.removedHashes).toEqual([result.expectedHash]);
	expect(result.listedAfterRemove).toEqual([]);
	expect(result.restored.kind).toBe("registered");
	expect(result.afterRestored).toEqual([]);
	// Repository durability proves the committed Revision. Byte readiness is a
	// separate application check; exercise its actual resource port here.
	expect(result.missingResource).toBe(true);
	expect(result.damaged).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r2" } },
	});
	expect(result.denied).toEqual({ kind: "rejected" });
	expect(result.afterDenied).toEqual(result.before);
	expect(result.before).toHaveLength(9);
	expect(result.repaired).toEqual({ kind: "resolved", value: undefined });
	expect(result.current.kind).toBe("durable");
	if (result.current.kind === "durable")
		expect(result.current.candidate.revision.revisionId).toBe("r2");
	expect(result.resource).toEqual([91, 92, 93]);
});
for (const field of ["version", "roots", "durable", "creationLeaseId"] as const)
	test(`SCOPED-PUBLIC-PUBLISH-RESOURCE-${field}: native mutation after real byte verification refuses atomically`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await complete(page.evaluate(
			(field) => window.scopedProtocolEdges.publicationResourceCas(field),
			field,
		));
		expect(result.observedDigest).toBe(result.expectedDigest);
		expect(result.faultSnapshot).toHaveLength(9);
		expect(result.after).toEqual(result.faultSnapshot);
		expect(result.refused.kind).toBe("persist-failed");
		expect(result.currentBeforeRepair.kind).toBe("durable");
		if (result.currentBeforeRepair.kind === "durable")
			expect(result.currentBeforeRepair.candidate.project.name).toBe(
				"Public r1",
			);
		expect(result.retried).toEqual({ kind: "durable" });
		expect(result.current.kind).toBe("durable");
		expect(result.resource).toEqual([91, 92, 93]);
	});
for (const field of ["scope", "ownerId", "fencingToken"] as const)
	test(`SCOPED-PUBLIC-PUBLISH-WRITER-${field}: native fence loss during verification persists explicit takeover before retry`, async ({
		page,
	}) => {
		await page.goto("/");
		const result = await complete(page.evaluate(
			(field) => window.scopedProtocolEdges.publicationWriterCas(field),
			field,
		));
		expect(result.observedDigest).toBe(result.expectedDigest);
		expect(result.faultSnapshot).toHaveLength(9);
		expect(result.after).toEqual(result.faultSnapshot);
		expect(result.refused.kind).toBe("persist-failed");
		expect(result.notification).toBe(true);
		expect(result.consumed).toBe(false);
		expect(result.blocked.kind).toBe("persist-failed");
		expect(result.afterBlocked).toEqual(result.blockedBefore);
		expect(result.recreatedBlocked.kind).toBe("persist-failed");
		expect(result.afterRecreatedBlocked).toEqual(result.recreatedBlockedBefore);
		expect(result.resourceBeforeTakeover).toEqual([91, 92, 93]);
		expect(result.takenOver.kind).toBe("writable");
		expect(result.positive).toEqual({ kind: "durable" });
		expect(result.current.kind).toBe("durable");
	});
