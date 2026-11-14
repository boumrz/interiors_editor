import {
	expect,
	test,
	type Page,
} from "@playwright/test";
import type {} from "./telegram-storage-harness";

const allStores = [
	"scope-metadata",
	"projects",
	"revisions",
	"staging",
	"writer-fences",
	"publication-attempts",
	"pin-staging-leases",
	"resources",
	"library",
];
async function snapshot(page: Page) {
	return page.evaluate(
		async (names) =>
			Promise.all(
				names.map(async (store) => ({
					store,
					rows: await window.__telegramProjectHarness.rows("a", store),
				})),
			),
		allStores,
	);
}

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
});

for (const mode of ["checksum", "domain"] as const) {
	test(`SCOPED-INPUT-${mode}: invalid incoming candidate cannot publish or mutate any native store`, async ({
		page,
	}) => {
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.publishFixture("a", "kept", "kept-r1"),
			),
		).toEqual({ kind: "durable" });
		const healthy = await page.evaluate(() =>
			window.__telegramProjectHarness.load("a", "kept"),
		);
		const before = await snapshot(page);
		const result = await page.evaluate(
			(mode) =>
				window.__telegramProjectHarness.publishInvalidIncoming("a", mode),
			mode,
		);
		expect(result.checksumMatches).toBe(mode === "domain");
		expect(result.validation.kind).toBe(
			mode === "domain" ? "rejected" : "accepted",
		);
		expect(result.publication).toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(result.sourceAfter).toEqual(result.sourceBefore);
		expect(await snapshot(page)).toEqual(before);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.load("a", "kept"),
			),
		).toEqual(healthy);
		const modes = await page.evaluate(
			() => window.__telegramScopeHarness.durabilityModes,
		);
		expect(modes.length).toBeGreaterThan(0);
		expect(modes.every((value) => value === "strict")).toBe(true);
	});
}

test("SCOPED-LOSS: fresh and healthy runtime has no false loss, a real takeover reports loss once without releasing its fence", async ({
	page,
	context,
}) => {
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
	).toBe(false);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
	).toBe(false);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "kept", "kept-r1"),
		),
	).toEqual({ kind: "durable" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
	).toBe(false);
	const other = await context.newPage();
	await other.goto("/");
	await other.evaluate(() =>
		window.__telegramProjectHarness.create("b", "a", "owner-b"),
	);
	expect(
		await other.evaluate(() =>
			window.__telegramProjectHarness.takeover("b", "kept"),
		),
	).toMatchObject({ kind: "writable" });
	const before = await snapshot(page);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture(
				"a",
				"kept",
				"denied-r2",
				"kept-r1",
			),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
	).toBe(true);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.lost("a")),
	).toBe(false);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "kept"),
		),
	).toMatchObject({ kind: "read-only" });
	expect(await snapshot(page)).toEqual(before);
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
		await other.evaluate(() => window.__telegramProjectHarness.lost("b")),
	).toBe(false);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.load("a", "kept"),
		),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "kept-r2" } },
	});
});
