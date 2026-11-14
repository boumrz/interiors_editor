import { expect, test } from "@playwright/test";
import type {} from "./telegram-storage-harness";

test("SCOPED-OWNER: mutable composition options cannot lend another live writer identity to an existing runtime", async ({
	page,
	context,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	const other = await context.newPage();
	await other.goto("/");
	await other.evaluate(() =>
		window.__telegramProjectHarness.create("b", "a", "owner-b"),
	);
	expect(
		await other.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("b", "kept", "kept-r1"),
		),
	).toEqual({ kind: "durable" });
	const snapshot = () =>
		page.evaluate(async () =>
			Promise.all(
				[
					"scope-metadata",
					"projects",
					"revisions",
					"staging",
					"writer-fences",
					"publication-attempts",
					"pin-staging-leases",
					"resources",
					"library",
				].map(async (store) => ({
					store,
					rows: await window.__telegramProjectHarness.rows("a", store),
				})),
			),
		);
	const before = await snapshot();
	await page.evaluate(() =>
		window.__telegramProjectHarness.changeCompositionOwner("a", "owner-b"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture(
				"a",
				"kept",
				"unconfirmed-r2",
				"kept-r1",
			),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(await snapshot()).toEqual(before);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "kept"),
		),
	).toMatchObject({ kind: "read-only" });
	expect(
		await other.evaluate(() =>
			window.__telegramProjectHarness.publishFixture(
				"b",
				"kept",
				"kept-r2",
				"kept-r1",
			),
		),
	).toEqual({ kind: "durable" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.load("a", "kept"),
		),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "kept-r2" } },
	});
	const modes = await page.evaluate(
		() => window.__telegramScopeHarness.durabilityModes,
	);
	expect(modes.length).toBeGreaterThan(0);
	expect(modes.every((mode) => mode === "strict")).toBe(true);
});
