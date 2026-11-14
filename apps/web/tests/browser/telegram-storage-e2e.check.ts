import { expect, test } from "@playwright/test";
import type {} from "./telegram-storage-harness";

const scopeA = `tma-v1-${"a".repeat(64)}`;

test("TMA-STORAGE-27: generic transactions return their committed result and abort successful writes on callback failure", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => window.__telegramScopeHarness.create("generic", "a"));
	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "committed"))).toEqual({ kind: "completed", result: { scope: scopeA, row: "test-marker" } });
	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readonly"))).toEqual({ kind: "completed", result: { scope: scopeA, row: { resourceHash: "test-marker", value: "committed" } } });
	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "must-roll-back", true))).toEqual({ kind: "failed" });
	expect(await page.evaluate(() => window.__telegramScopeHarness.rows("a", "library"))).toEqual([{ resourceHash: "test-marker", value: "committed" }]);
	await page.evaluate(() => window.__telegramScopeHarness.relaxNextTransaction());
	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "must-not-write"))).toEqual({ kind: "failed" });
	expect(await page.evaluate(() => window.__telegramScopeHarness.rows("a", "library"))).toEqual([{ resourceHash: "test-marker", value: "committed" }]);
});

test("TMA-STORAGE-28: callback failure and pending drain revoke escaped composite access", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => window.__telegramScopeHarness.create("generic", "a"));
	expect(await page.evaluate(() => window.__telegramScopeHarness.callbackThrowAndLateReserve("generic"))).toBe("denied");
	expect(await page.evaluate(() => window.__telegramScopeHarness.lateAccessDuringDrain("generic"))).toBe("denied");
	expect(await page.evaluate(() => window.__telegramScopeHarness.wrongInnerKind("generic"))).toBe("denied");
	expect(await page.evaluate(() => window.__telegramScopeHarness.records("a"))).toContainEqual({ key: "counter", lastReserved: "0" });
	expect(await page.evaluate(() => window.__telegramScopeHarness.rows("a", "library"))).toEqual([{ resourceHash: "test-marker", value: "drained" }]);
});

test("TMA-STORAGE-29: generic access rejects malformed metadata without requiring ID reservation and reads an exhausted healthy scope", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => window.__telegramScopeHarness.create("generic", "a"));
	await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "original"));
	const identity = { key: "identity", protocolVersion: 1, scope: scopeA };
	const counter = { key: "counter", lastReserved: "0" };
	for (const records of [
		[{ ...identity, scope: `tma-v1-${"b".repeat(64)}` }, counter],
		[identity, counter, { key: "unknown-root" }],
		[{ ...identity, key: "imposter-identity" }, counter],
		[identity, { ...counter, key: "imposter-counter" }],
		[identity, { ...counter, lastReserved: "18446744073709551616" }],
	]) {
		await page.evaluate((records) => window.__telegramScopeHarness.replaceMetadata("a", records), records);
		const before = await page.evaluate(() => window.__telegramScopeHarness.records("a"));
		expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readwrite", "must-not-write"))).toEqual({ kind: "failed" });
		expect(await page.evaluate(() => window.__telegramScopeHarness.records("a"))).toEqual(before);
		expect(await page.evaluate(() => window.__telegramScopeHarness.rows("a", "library"))).toEqual([{ resourceHash: "test-marker", value: "original" }]);
	}
	await page.evaluate((identity) => window.__telegramScopeHarness.replaceMetadata("a", [identity, { key: "counter", lastReserved: "18446744073709551615" }]), identity);
	expect(await page.evaluate(() => window.__telegramScopeHarness.genericMarker("generic", "readonly"))).toMatchObject({ kind: "completed", result: { row: { value: "original" } } });
	expect(await page.evaluate(() => window.__telegramScopeHarness.reserve("generic", "attempt"))).toMatchObject({ kind: "failed" });
});

for (const shape of ["out-of-line", "auto-increment", "index"] as const) {
	test(`TMA-STORAGE-30-${shape}: unsupported v1 schema refuses before upgrade commit`, async ({ page }) => {
		await page.goto("/");
		await page.evaluate((shape) => window.__telegramScopeHarness.seedMetadataV1("a", undefined, false, shape), shape);
		const before = await page.evaluate(() => window.__telegramScopeHarness.records("a"));
		await page.evaluate(() => window.__telegramScopeHarness.create("foreign", "a"));
		expect(await page.evaluate(() => window.__telegramScopeHarness.reserve("foreign", "attempt"))).toMatchObject({ kind: "failed" });
		expect(await page.evaluate(() => window.__telegramScopeHarness.schema("a"))).toEqual({ version: 1, stores: ["scope-metadata"] });
		expect(await page.evaluate(() => window.__telegramScopeHarness.records("a"))).toEqual(before);
		expect(await page.evaluate(() => window.__telegramScopeHarness.activeHandles)).toBe(0);
	});
}

for (const shape of ["store", "index"] as const) {
	test(`TMA-STORAGE-31-${shape}: unsupported v2 inventory preserves metadata and closes its handle`, async ({ page }) => {
		await page.goto("/");
		await page.evaluate((shape) => window.__telegramScopeHarness.seedUnknownVersion2("a", shape), shape);
		const before = await page.evaluate(() => window.__telegramScopeHarness.records("a"));
		await page.evaluate(() => window.__telegramScopeHarness.create("foreign", "a"));
		expect(await page.evaluate(() => window.__telegramScopeHarness.reserve("foreign", "attempt"))).toMatchObject({ kind: "failed" });
		expect(await page.evaluate(() => window.__telegramScopeHarness.records("a"))).toEqual(before);
		expect(await page.evaluate(() => window.__telegramScopeHarness.activeHandles)).toBe(0);
	});
}
const version2Stores = [
	"library",
	"pin-staging-leases",
	"projects",
	"publication-attempts",
	"resources",
	"revisions",
	"scope-metadata",
	"staging",
	"writer-fences",
];

test("TMA-STORAGE-23: a composite operation reserves IDs without recursively acquiring its lock", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("composite", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.compositeReservations("composite"),
		),
	).toEqual([`tma-v1:${scopeA}:attempt:1`, `tma-v1:${scopeA}:lease:2`]);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("composite", "attempt"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:attempt:3` });
});

test("TMA-STORAGE-24: abandoned failed transactions reject the enclosing operation and escaped access cannot write", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("composite", "a"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("composite", "attempt"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.failingUnawaitedTransaction("composite"),
		),
	).toBe("failed");
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.escapedTransaction("composite"),
		),
	).toBe("failed");
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "1" });
});

test("TMA-STORAGE-25: correct store names with a foreign key schema cannot issue IDs", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() => window.__telegramScopeHarness.seedBadVersion2("a"));
	const before = await page.evaluate(() =>
		window.__telegramScopeHarness.records("a"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("foreign", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("foreign", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toEqual(before);
});

test("TMA-STORAGE-26: unknown metadata in an existing v2 database blocks reservation without mutation", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("existing", "a"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("existing", "attempt"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {
			key: "unknown-root",
			payload: "keep",
		}),
	);
	const before = await page.evaluate(() =>
		window.__telegramScopeHarness.records("a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("existing", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toEqual(before);
});

test("TMA-STORAGE-19: upgrades metadata v1 atomically while preserving the exact uint64 counter", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() => window.__telegramScopeHarness.seedMetadataV1("a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("upgraded", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("upgraded", "attempt"),
		),
	).toEqual({
		kind: "reserved",
		id: `tma-v1:${scopeA}:attempt:9007199254740994`,
	});
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.schema("a")),
	).toEqual({ version: 2, stores: version2Stores });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toEqual([
		{ key: "counter", lastReserved: "9007199254740994" },
		{ key: "identity", protocolVersion: 1, scope: scopeA },
	]);
});

test("TMA-STORAGE-20: corrupt existing metadata aborts migration without adding stores or resetting bytes", async ({
	page,
}) => {
	await page.goto("/");
	const records = [
		{ key: "identity", protocolVersion: 1, scope: scopeA },
		{ key: "counter", lastReserved: "broken-counter" },
	];
	await page.evaluate(
		(records) => window.__telegramScopeHarness.seedMetadataV1("a", records),
		records,
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("corrupt", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("corrupt", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.schema("a")),
	).toEqual({ version: 1, stores: ["scope-metadata"] });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toEqual([records[1], records[0]]);
});

test("TMA-STORAGE-21: an unknown v1 store prevents upgrade and preserves all metadata", async ({
	page,
}) => {
	await page.goto("/");
	await page.evaluate(() =>
		window.__telegramScopeHarness.seedMetadataV1("a", undefined, true),
	);
	const before = await page.evaluate(() =>
		window.__telegramScopeHarness.records("a"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("unknown", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("unknown", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.schema("a")),
	).toEqual({ version: 1, stores: ["scope-metadata", "unknown-data"] });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toEqual(before);
});

test("TMA-STORAGE-22: extra metadata records are not silently promoted or removed by upgrade", async ({
	page,
}) => {
	await page.goto("/");
	const records = [
		{ key: "identity", protocolVersion: 1, scope: scopeA },
		{ key: "counter", lastReserved: "42" },
		{ key: "unknown-root", payload: "must-stay" },
	];
	await page.evaluate(
		(records) => window.__telegramScopeHarness.seedMetadataV1("a", records),
		records,
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("unknown", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("unknown", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.schema("a")),
	).toEqual({ version: 1, stores: ["scope-metadata"] });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toEqual([records[1], records[0], records[2]]);
});

test.beforeEach(async ({ page }, testInfo) => {
	await page.goto("/");
	// Prove the native browser receives the active Stryker mutant before imports.
	expect(
		await page.evaluate(
			() => Reflect.get(globalThis, "__stryker__")?.activeMutant,
		),
	).toBe(testInfo.project.metadata.activeMutant);
});

test("TMA-STORAGE-01: native contexts reserve durable unique IDs, reopen and isolate scopes", async ({
	page,
	context,
}) => {
	const second = await context.newPage();
	await second.goto("/");
	await page.evaluate(() => window.__telegramScopeHarness.create("first", "a"));
	await second.evaluate(() =>
		window.__telegramScopeHarness.create("second", "a"),
	);
	const results = await Promise.all(
		Array.from({ length: 20 }, (_, index) =>
			(index % 2 ? page : second).evaluate(
				async ({ name, kind }) =>
					window.__telegramScopeHarness.reserve(name, kind),
				{
					name: index % 2 ? "first" : "second",
					kind: index % 3 ? ("attempt" as const) : ("lease" as const),
				},
			),
		),
	);
	expect(results.every((result) => result.kind === "reserved")).toBe(true);
	const ids = results.flatMap((result) =>
		result.kind === "reserved" ? [result.id] : [],
	);
	expect(new Set(ids).size).toBe(20);
	expect(
		ids.map((id) => Number(id.split(":").at(-1))).sort((a, b) => a - b),
	).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
	await page.evaluate(() => window.__telegramScopeHarness.close("first"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("reopened", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("reopened", "lease"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:21` });
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("other-scope", "b"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("other-scope", "attempt"),
		),
	).toMatchObject({
		kind: "reserved",
		id: `tma-v1:tma-v1-${"b".repeat(64)}:attempt:1`,
	});
	expect(
		(await page.evaluate(() => indexedDB.databases())).some(
			(db) => db.name === "interiors-editor-projects",
		),
	).toBe(false);
	await second.evaluate(() => window.__telegramScopeHarness.close("second"));
	await page.evaluate(() => window.__telegramScopeHarness.close("reopened"));
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.activeHandles),
	).toBe(1);
	expect(
		await second.evaluate(() => window.__telegramScopeHarness.activeHandles),
	).toBe(0);
	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
});

test("TMA-STORAGE-02: unsupported or queued/revoked lock never opens storage", async ({
	page,
	context,
}) => {
	for (const capability of [
		"no-locks",
		"insecure",
		"lock-fails",
		"close-after-lock",
	] as const) {
		await page.evaluate(
			(value) => window.__telegramScopeHarness.create(value, "a", value),
			capability,
		);
		expect(
			await page.evaluate(
				(value) => window.__telegramScopeHarness.reserve(value, "attempt"),
				capability,
			),
		).toMatchObject({ kind: "failed" });
	}
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
	).toBe(0);
	const holder = await context.newPage();
	await holder.goto("/");
	await holder.evaluate(() => window.__telegramScopeHarness.hold("a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("waiting", "a"),
	);
	const pending = page.evaluate(() =>
		window.__telegramScopeHarness.reserve("waiting", "attempt"),
	);
	await expect
		.poll(
			async () =>
				(await page.evaluate(() => navigator.locks.query())).pending?.length,
		)
		.toBe(1);
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
	).toBe(0);
	await page.evaluate(() => window.__telegramScopeHarness.close("waiting"));
	expect(await pending).toMatchObject({ kind: "failed" });
	await holder.evaluate(() => window.__telegramScopeHarness.release());
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
	).toBe(0);
});

test("TMA-STORAGE-03: counter remains exact above 2^53 and never wraps uint64", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("store", "attempt"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {
			key: "counter",
			lastReserved: "9007199254740992",
		}),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toEqual({
		kind: "reserved",
		id: `tma-v1:${scopeA}:lease:9007199254740993`,
	});
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {
			key: "counter",
			lastReserved: "18446744073709551614",
		}),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toEqual({
		kind: "reserved",
		id: `tma-v1:${scopeA}:attempt:18446744073709551615`,
	});
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "18446744073709551615" });
});

test("TMA-STORAGE-04: corrupt or missing metadata is retained and never reset", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("store", "attempt"),
	);
	for (const value of [
		0,
		null,
		[],
		"",
		"01",
		"00",
		"-1",
		"1.5",
		"1e3",
		"1\n",
		"1 ",
		" 1",
		"18446744073709551616",
		"99999999999999999999999",
	]) {
		await page.evaluate(
			(lastReserved) =>
				window.__telegramScopeHarness.edit("a", {
					key: "counter",
					lastReserved,
				}),
			value,
		);
		expect(
			await page.evaluate(() =>
				window.__telegramScopeHarness.reserve("store", "attempt"),
			),
		).toMatchObject({ kind: "failed" });
		expect(
			await page.evaluate(() => window.__telegramScopeHarness.records("a")),
		).toContainEqual({ key: "counter", lastReserved: value });
	}
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {
			key: "counter",
			lastReserved: "7",
		}),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {
			key: "counter",
			lastReserved: "7",
			extra: true,
		}),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {
			key: "counter",
			lastReserved: "7",
		}),
	);
	for (const record of [
		{ key: "identity", protocolVersion: 2, scope: scopeA },
		{ key: "identity", protocolVersion: 1, scope: "wrong" },
		{ key: "identity", protocolVersion: 1, scope: scopeA, extra: true },
	]) {
		await page.evaluate(
			(value) => window.__telegramScopeHarness.edit("a", value),
			record,
		);
		expect(
			await page.evaluate(() =>
				window.__telegramScopeHarness.reserve("store", "lease"),
			),
		).toMatchObject({ kind: "failed" });
	}
	await page.evaluate(
		(scope) =>
			window.__telegramScopeHarness.edit("a", {
				key: "identity",
				protocolVersion: 1,
				scope,
			}),
		scopeA,
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {}, "counter"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {
			key: "counter",
			lastReserved: "7",
		}),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.edit("a", {}, "identity"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() => window.__telegramScopeHarness.close("store"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("reopen-corrupt", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("reopen-corrupt", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toEqual([{ key: "counter", lastReserved: "7" }]);
});

test("TMA-STORAGE-05: abort after a successful put returns no ID and rolls back atomically", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("store", "attempt"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.abortNextCounterWrite(),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "1" });
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
});

test("TMA-STORAGE-06: initialization rollback leaves no half marker and retries safely", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.abortInitialization(),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		(await page.evaluate(() => indexedDB.databases())).some(
			(db) => db.name === `interiors-editor-projects:${scopeA}`,
		),
	).toBe(false);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:1` });
});

test("TMA-STORAGE-07: version change closes the old generation and older schema refuses writing", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("store", "attempt"),
	);
	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("old-client", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("old-client", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "1" });
});

test("TMA-STORAGE-08: rejected open aborts late initialization and retries without reset", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("store", "a", "blocked-open"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() => window.__telegramScopeHarness.settleOpens());
	expect(
		(await page.evaluate(() => indexedDB.databases())).some(
			(db) => db.name === `interiors-editor-projects:${scopeA}`,
		),
	).toBe(false);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:attempt:1` });
});

test("TMA-STORAGE-09: reservation requires actual strict durability and rejects relaxed fallback", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:attempt:1` });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.durabilityModes),
	).toEqual(["strict"]);
	await page.evaluate(() =>
		window.__telegramScopeHarness.relaxNextTransaction(),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "1" });
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
});

test("TMA-STORAGE-10: revoke pending native open aborts late initialization", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("store", "a", "close-on-open"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() => window.__telegramScopeHarness.awaitClose("store"));
	await page.evaluate(() => window.__telegramScopeHarness.settleOpens());
	expect(
		(await page.evaluate(() => indexedDB.databases())).some(
			(db) => db.name === `interiors-editor-projects:${scopeA}`,
		),
	).toBe(false);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
	).toBe(1);
});

test("TMA-STORAGE-11: revoked reopen closes its late native handle and preserves metadata", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("seed", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("seed", "attempt"),
	);
	await page.evaluate(() => window.__telegramScopeHarness.close("seed"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("late", "a", "close-on-open"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("late", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() => window.__telegramScopeHarness.awaitClose("late"));
	await page.evaluate(() => window.__telegramScopeHarness.settleOpens());
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.activeHandles),
	).toBe(0);
	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "1" });
});

test("TMA-STORAGE-12: close from native put-success drains commit and rejects queued work", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("store", "attempt"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.closeOnCounterRequest("store"),
	);
	const results = await page.evaluate(() =>
		Promise.all([
			window.__telegramScopeHarness.reserve("store", "attempt"),
			window.__telegramScopeHarness.reserve("store", "lease"),
		]),
	);
	expect(results[0]).toEqual({
		kind: "reserved",
		id: `tma-v1:${scopeA}:attempt:2`,
	});
	expect(results[1]).toMatchObject({ kind: "failed" });
	await page.evaluate(() => window.__telegramScopeHarness.awaitClose("store"));
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.lifecycle),
	).toEqual(["request-success", "tx-complete", "closed"]);
	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "2" });
});

test("TMA-STORAGE-13: admitted upgrade drains but revoke prevents a following reservation", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.closeOnCounterRequest("store", true),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() => window.__telegramScopeHarness.awaitClose("store"));
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.lifecycle),
	).toEqual(["request-success", "tx-complete", "closed"]);
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "0" });
	await page.evaluate(() => window.__telegramScopeHarness.upgrade("a"));
});

test("TMA-STORAGE-14: controlled read fault rejects and releases scope lock without an ID", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("store", "attempt"),
	);
	await page.evaluate(() => window.__telegramScopeHarness.failNextRead());
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "1" });
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
});

test("TMA-STORAGE-15: an unknown operation kind cannot initialize or reserve in a scope", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "unknown" as "attempt"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.openCalls),
	).toBe(0);
});

test("TMA-STORAGE-16: completed and failed opens release cancellation observers before session close", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("normal", "a"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("normal", "attempt"),
	);
	expect(
		await page.evaluate(
			() => window.__telegramScopeHarness.retainedAbortCallbacks,
		),
	).toBe(0);
	await page.evaluate(() => window.__telegramScopeHarness.close("normal"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.create("retry", "a", "blocked-open"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("retry", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	await page.evaluate(() => window.__telegramScopeHarness.settleOpens());
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.activeHandles),
	).toBe(0);
	expect(
		await page.evaluate(
			() => window.__telegramScopeHarness.retainedAbortCallbacks,
		),
	).toBe(0);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("retry", "lease"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
	expect(
		await page.evaluate(
			() => window.__telegramScopeHarness.retainedAbortCallbacks,
		),
	).toBe(0);
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.activeHandles),
	).toBe(1);
});

test("TMA-STORAGE-17: whole array records with valid-looking fields remain corrupt and unchanged", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("store", "attempt"),
	);
	for (const key of ["identity", "counter"] as const) {
		await page.evaluate(
			async ({ key, scope }) => {
				await window.__telegramScopeHarness.edit("a", {
					key: "identity",
					protocolVersion: 1,
					scope,
				});
				const record =
					key === "identity"
						? Object.assign([], { key, protocolVersion: 1, scope })
						: Object.assign([], { key, lastReserved: "1" });
				await window.__telegramScopeHarness.edit("a", record);
			},
			{ key, scope: scopeA },
		);
		expect(
			await page.evaluate(
				async (key) =>
					(await window.__telegramScopeHarness.records("a")).some(
						(record) =>
							Array.isArray(record) && Reflect.get(record, "key") === key,
					),
				key,
			),
		).toBe(true);
		expect(
			await page.evaluate(() =>
				window.__telegramScopeHarness.reserve("store", "lease"),
			),
		).toMatchObject({ kind: "failed" });
		expect(
			await page.evaluate(
				async (key) =>
					(await window.__telegramScopeHarness.records("a")).some(
						(record) =>
							Array.isArray(record) && Reflect.get(record, "key") === key,
					),
				key,
			),
		).toBe(true);
	}
});

test("TMA-STORAGE-18: prevented-default native write error cannot expose an unpersisted ID", async ({
	page,
}) => {
	await page.evaluate(() => window.__telegramScopeHarness.create("store", "a"));
	await page.evaluate(() =>
		window.__telegramScopeHarness.reserve("store", "attempt"),
	);
	await page.evaluate(() =>
		window.__telegramScopeHarness.preventDefaultWriteFailure(),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toMatchObject({ kind: "failed" });
	expect(
		await page.evaluate(() => window.__telegramScopeHarness.records("a")),
	).toContainEqual({ key: "counter", lastReserved: "1" });
	expect(
		await page.evaluate(() =>
			window.__telegramScopeHarness.reserve("store", "lease"),
		),
	).toEqual({ kind: "reserved", id: `tma-v1:${scopeA}:lease:2` });
});
