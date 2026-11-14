import { expect, test } from "@playwright/test";
import type {} from "./telegram-storage-harness";

test("TMA-RESOURCE-07: a different repository owner cannot mark, pin, cancel or complete another owner's exact lease", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() => {
		window.__telegramProjectHarness.create("a", "a", "owner-a");
		window.__telegramProjectHarness.create("b", "a", "owner-b");
	});
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"first",
			"p1",
			"r1",
			[61, 62, 63],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	const stages = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "staging"),
	);
	const journal = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "publication-attempts"),
	);
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.discardPrepared("b", "first"),
		),
	).rejects.toThrow();
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.writePrepared("b", "first"),
		),
	).rejects.toThrow();
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("b", "first"),
		),
	).rejects.toThrow();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "staging"),
		),
	).toEqual(stages);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "publication-attempts"),
		),
	).toEqual(journal);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([61, 62, 63]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "first"),
		),
	).toEqual({ kind: "durable" });
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.completePrepared("b", "first"),
		),
	).rejects.toThrow();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "pin-staging-leases"),
		),
	).toHaveLength(1);
	await page.evaluate(() =>
		window.__telegramProjectHarness.completePrepared("a", "first"),
	);
});

test("TMA-RESOURCE-01: the immutable publication journal precedes bytes and commits their exact manifest with the pointer", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	const lease = await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"first",
			"p1",
			"r1",
			[1, 2, 3],
		),
	);
	expect(lease.resourceHashes).toHaveLength(1);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "resources"),
		),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "publication-attempts"),
		),
	).toMatchObject([
		{
			state: "prepared",
			projectId: "p1",
			revisionId: "r1",
			resourceManifest: [
				{ resourceHash: lease.resourceHashes[0], byteLength: 3 },
			],
		},
	]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.writePrepared("a", "first"),
		),
	).toEqual({ kind: "stored" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "first"),
		),
	).toEqual({ kind: "durable" });
	await page.evaluate(() =>
		window.__telegramProjectHarness.completePrepared("a", "first"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([1, 2, 3]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "publication-attempts"),
		),
	).toMatchObject([
		{
			state: "published",
			receipt: {
				revisionId: "r1",
				resourceManifest: [
					{ resourceHash: lease.resourceHashes[0], byteLength: 3 },
				],
			},
		},
	]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "pin-staging-leases"),
		),
	).toEqual([]);
});

test("TMA-RESOURCE-02: a second prepared consumer protects the same bytes from the first cancellation", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"first",
			"p1",
			"r1",
			[4, 5, 6],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"second",
			"p2",
			"r2",
			[4, 5, 6],
		),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.writePrepared("a", "second"),
		),
	).toEqual({ kind: "already-present" });
	await page.evaluate(() =>
		window.__telegramProjectHarness.discardPrepared("a", "first"),
	);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toEqual({ kind: "empty" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "second"),
		),
	).toEqual([4, 5, 6]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "second"),
		),
	).toEqual({ kind: "durable" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "publication-attempts"),
		),
	).toMatchObject([{ state: "no-publish" }, { state: "published" }]);
});

test("TMA-RESOURCE-03: cancellation closes only its attempt and cannot publish or reuse its lease afterward", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"first",
			"p1",
			"r1",
			[7, 8, 9],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.discardPrepared("a", "first"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toBeUndefined();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "staging"),
		),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toEqual([]);
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.writePrepared("a", "first"),
		),
	).rejects.toThrow();
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "first"),
		),
	).rejects.toThrow();
});

test("TMA-RESOURCE-04: takeover refuses the old writer's cleanup and adopts its complete unpublished attempt", async ({
	page,
	context,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"first",
			"p1",
			"r2",
			[10, 11, 12],
			"r1",
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	const second = await context.newPage();
	await second.goto("/");
	await second.evaluate(() =>
		window.__telegramProjectHarness.create("b", "a", "owner-b"),
	);
	expect(
		await second.evaluate(() =>
			window.__telegramProjectHarness.takeover("b", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 2 });
	// Adoption already removed this exact lease; the old cancellation is an inert retry.
	await page.evaluate(() =>
		window.__telegramProjectHarness.discardPrepared("a", "first"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "publication-attempts"),
		),
	).toMatchObject([{ state: "published" }, { state: "no-publish" }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "staging"),
		),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toBeUndefined();
	expect(
		await second.evaluate(() =>
			window.__telegramProjectHarness.load("b", "p1"),
		),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r1" } },
	});
});

test("TMA-RESOURCE-05: a receipt survives a later pointer and startup does not guess publication from the current Revision", async ({
	page,
	context,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"first",
			"p1",
			"r1",
			[13, 14, 15],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "first"),
		),
	).toEqual({ kind: "durable" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
		),
	).toEqual({ kind: "durable" });
	const second = await context.newPage();
	await second.goto("/");
	await second.evaluate(() =>
		window.__telegramProjectHarness.create("b", "a", "owner-b"),
	);
	expect(
		await second.evaluate(() =>
			window.__telegramProjectHarness.takeover("b", "p1"),
		),
	).toMatchObject({ kind: "writable" });
	expect(
		await second.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "pin-staging-leases"),
		),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([13, 14, 15]);
	expect(
		await second.evaluate(() =>
			window.__telegramProjectHarness.load("b", "p1"),
		),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r2" } },
	});
});

test("TMA-RESOURCE-06: cancellation winning before the second protection requires fresh verified admission", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"first",
			"p1",
			"r1",
			[16, 17, 18],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"second",
			"p2",
			"r2",
			[16, 17, 18],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.discardPrepared("a", "first"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "second"),
		),
	).toBeUndefined();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "second"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.writePrepared("a", "second"),
		),
	).toEqual({ kind: "stored" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "second"),
		),
	).toEqual({ kind: "durable" });
});
