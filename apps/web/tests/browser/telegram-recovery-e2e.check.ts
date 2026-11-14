import { expect, test } from "@playwright/test";
import type {} from "./telegram-storage-harness";

test("TMA-RECOVERY-04: unsupported stored source stays exportable without blocking healthy cards or changing any durable record", async ({ page }) => {
	await page.goto("/"); await page.evaluate(() => window.__telegramProjectHarness.create("a", "a", "owner-a"));
	await page.evaluate(() => window.__telegramProjectHarness.publishFixture("a", "p1", "r1"));
	await page.evaluate(() => window.__telegramProjectHarness.publishFixture("a", "p2", "r2"));
	const serializedProject = await page.evaluate(() => window.__telegramProjectHarness.futureRevision("a", "r1"));
	const names = ["projects", "revisions", "publication-attempts", "writer-fences", "scope-metadata"];
	const before = await page.evaluate(async (names) => Promise.all(names.map((name) => window.__telegramProjectHarness.rows("a", name))), names);
	expect(await page.evaluate(() => window.__telegramProjectHarness.recoverySources("a"))).toEqual([{ kind: "unverified-source", projectId: "p1", revisionId: "r1" }]);
	expect(await page.evaluate(() => window.__telegramProjectHarness.readRecoverySource("a", "p1", "r1"))).toEqual({ kind: "unverified-source", projectId: "p1", revisionId: "r1", serializedProject });
	expect(await page.evaluate(() => window.__telegramProjectHarness.readRecoverySource("a", "p1", "stale"))).toBeUndefined();
	expect(await page.evaluate(() => window.__telegramProjectHarness.list("a"))).toMatchObject({ kind: "populated", recoveryNeeded: true, projects: [{ projectId: "p2" }] });
	expect(await page.evaluate(async (names) => Promise.all(names.map((name) => window.__telegramProjectHarness.rows("a", name))), names)).toEqual(before);
});

test("TMA-RECOVERY-03: an unregistered journal field remains uninterpreted and cannot authorize write or deletion", async ({
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
		window.__telegramProjectHarness.unknownJournalField("a", "r1"),
	);
	const journal = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "publication-attempts"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.takeover("a", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.deleteProject("a", "p1"),
		),
	).toEqual({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "publication-attempts"),
		),
	).toEqual(journal);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({
		kind: "recovery-needed",
		reasonCode: "PERSISTENCE_CORRUPT",
	});
});

test("TMA-RECOVERY-01: unknown staging is retained and blocks only its Project while startup stays read-only", async ({
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
		window.__telegramProjectHarness.publishFixture("a", "p2", "r2"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.unknownStage("a", "p1"),
	);
	const stages = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "staging"),
	);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.recover("a")),
	).toEqual({ kind: "recovered" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.takeover("a", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r3", "r1"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "staging"),
		),
	).toEqual(stages);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p2", "r4", "r2"),
		),
	).toEqual({ kind: "durable" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r1" } },
	});
});

test("TMA-RECOVERY-02: confirmed Project deletion keeps the counter and permanent fence tombstone and cannot reuse IDs", async ({
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
			[21, 22, 23],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishPrepared("a", "first"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p2", "r3"),
	);
	const metadata = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "scope-metadata"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.deleteProject("a", "p1"),
		),
	).toEqual({ kind: "permanently-deleted" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toEqual({ kind: "empty" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toMatchObject([{ projectId: "p2", revisionId: "r3" }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "scope-metadata"),
		),
	).toEqual(metadata);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "writer-fences"),
		),
	).toMatchObject([
		{ projectId: "p1", fencingToken: 1, deleted: true },
		{ projectId: "p2", deleted: false },
	]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([21, 22, 23]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r4"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.takeover("a", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p2")),
	).toMatchObject({ kind: "durable" });
});
