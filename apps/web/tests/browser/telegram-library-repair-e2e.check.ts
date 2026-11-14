import { expect, test } from "@playwright/test";
import type {} from "./telegram-storage-harness";

test("TMA-LIBRARY-01: atomic library registration protects a prepared resource from cancellation and card removal preserves bytes", async ({
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
			[31, 32, 33],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "first"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.registerPreparedLibrary("a", "first"),
		),
	).toMatchObject({ kind: "registered" });
	await page.evaluate(() =>
		window.__telegramProjectHarness.discardPrepared("a", "first"),
	);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.library("a")),
	).toMatchObject([{ assetDefinitionId: "custom" }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.removeLibrary("a", "custom"),
		),
	).toEqual({ kind: "removed" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.library("a")),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([31, 32, 33]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.registerPreparedLibrary("a", "first"),
		),
	).toMatchObject({ kind: "suppressed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.registerPreparedLibrary(
				"a",
				"first",
				true,
			),
		),
	).toMatchObject({ kind: "registered" });
});

test("TMA-REPAIR-01: exact batch repair covers current and history roots atomically without making a new Revision", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	for (const value of [
		{ key: "first", revision: "r1", bytes: [41, 42, 43], base: undefined },
		{ key: "second", revision: "r2", bytes: [44, 45, 46], base: "r1" },
	]) {
		await page.evaluate(
			(v) =>
				window.__telegramProjectHarness.prepareResource(
					"a",
					v.key,
					"p1",
					v.revision,
					v.bytes,
					v.base,
				),
			value,
		);
		await page.evaluate(
			(key) => window.__telegramProjectHarness.writePrepared("a", key),
			value.key,
		);
		expect(
			await page.evaluate(
				(key) => window.__telegramProjectHarness.publishPrepared("a", key),
				value.key,
			),
		).toEqual({ kind: "durable" });
	}
	await page.evaluate(() =>
		window.__telegramProjectHarness.repairRoots("a", "a", "r2", ["r1"]),
	);
	const revisions = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "revisions"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.corruptPreparedResource("a", "first"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.corruptPreparedResource("a", "second"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.repairPrepared("a", ["first", "second"]),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([41, 42, 43]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "second"),
		),
	).toEqual([44, 45, 46]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toEqual(revisions);
});

test("TMA-REPAIR-02: unrelated bytes or a stale writer cannot replace even one member of a repair batch", async ({
	page,
	context,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	for (const value of [
		{ key: "first", project: "p1", revision: "r1", bytes: [51, 52, 53] },
		{ key: "foreign", project: "p2", revision: "r2", bytes: [54, 55, 56] },
	]) {
		await page.evaluate(
			(v) =>
				window.__telegramProjectHarness.prepareResource(
					"a",
					v.key,
					v.project,
					v.revision,
					v.bytes,
				),
			value,
		);
		await page.evaluate(
			(key) => window.__telegramProjectHarness.writePrepared("a", key),
			value.key,
		);
		await page.evaluate(
			(key) => window.__telegramProjectHarness.publishPrepared("a", key),
			value.key,
		);
	}
	await page.evaluate(() =>
		window.__telegramProjectHarness.repairRoots("a", "a", "r1", []),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.corruptPreparedResource("a", "first"),
	);
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.repairPrepared("a", ["first", "foreign"]),
		),
	).rejects.toThrow();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([99, 99, 99]);
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
	await expect(
		page.evaluate(() =>
			window.__telegramProjectHarness.repairPrepared("a", ["first"]),
		),
	).rejects.toThrow();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "first"),
		),
	).toEqual([99, 99, 99]);
});
