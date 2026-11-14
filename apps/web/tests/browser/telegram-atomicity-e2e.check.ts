import { expect, test } from "@playwright/test";
import type {} from "./telegram-storage-harness";

test("TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together", async ({
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
			[71, 72, 73],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.abortNextProjectPointer(),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "first"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toEqual({ kind: "empty" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "publication-attempts"),
		),
	).toMatchObject([{ state: "prepared" }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "resources"),
		),
	).toMatchObject([{ durable: false, roots: [expect.any(String)] }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([71, 72, 73]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "first"),
		),
	).toEqual({ kind: "durable" });
});

test("TMA-ATOMIC-02: cancel abort after native byte deletion rolls back no-publish, stage, Revision, lease and bytes", async ({
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
			[74, 75, 76],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	const names = [
		"staging",
		"revisions",
		"publication-attempts",
		"pin-staging-leases",
	];
	const before = await page.evaluate(
		async (names) =>
			Promise.all(
				names.map((name) => window.__telegramProjectHarness.rows("a", name)),
			),
		names,
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.abortNextMutation("resources", "delete"),
	);
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.discardPrepared("a", "first"),
		),
	).rejects.toThrow();
	expect(
		await page.evaluate(
			async (names) =>
				Promise.all(
					names.map((name) => window.__telegramProjectHarness.rows("a", name)),
				),
			names,
		),
	).toEqual(before);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([74, 75, 76]);
	await page.evaluate(() =>
		window.__telegramProjectHarness.discardPrepared("a", "first"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toBeUndefined();
});

test("TMA-ATOMIC-03: interrupted adoption retains the exact old roots under the new fence and retries explicitly", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() => {
		window.__telegramProjectHarness.create("a", "a", "owner-a");
		window.__telegramProjectHarness.create("b", "a", "owner-b");
	});
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"first",
			"p1",
			"r2",
			[77, 78, 79],
			"r1",
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	const journal = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "publication-attempts"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.abortNextMutation("resources", "delete"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.takeover("b", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "publication-attempts"),
		),
	).toEqual(journal);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "writer-fences"),
		),
	).toMatchObject([{ ownerId: "owner-b", fencingToken: 2 }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([77, 78, 79]);
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.discardPrepared("a", "first"),
		),
	).rejects.toThrow();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.takeover("b", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 3 });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toBeUndefined();
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("b", "p1")),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r1" } },
	});
});

test("TMA-ATOMIC-04: deletion abort after a native Revision delete preserves the Project and all owned revisions", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
	);
	const revisions = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "revisions"),
	);
	const metadata = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "scope-metadata"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.abortNextMutation("revisions", "delete"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.deleteProject("a", "p1"),
		),
	).toEqual({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toEqual(revisions);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "scope-metadata"),
		),
	).toEqual(metadata);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r2" } },
	});
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "writer-fences"),
		),
	).toMatchObject([{ fencingToken: 1, deleted: false }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.deleteProject("a", "p1"),
		),
	).toEqual({ kind: "permanently-deleted" });
});
