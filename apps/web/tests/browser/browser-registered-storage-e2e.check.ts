import { expect, test } from "@playwright/test";
import type {} from "./browser-registered-storage-harness";
const name = "interiors-editor-browser-registered";
test.beforeEach(async ({ page }, info) => {
	await page.goto("/");
	const actual = await page.evaluate(
		() => Reflect.get(globalThis, "__stryker__")?.activeMutant,
	);
	info.annotations.push({
		type: "browser-registered-mutation-activation",
		description: JSON.stringify({
			expected: info.project.metadata.activeMutant,
			actual,
			title: info.title,
		}),
	});
	expect(actual).toBe(info.project.metadata.activeMutant);
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.create("a"),
	);
});
test("BROWSER-STORAGE-01: ordinary absent probe/reservation never creates a database; explicit provisioning atomically creates the independent schema", async ({
	page,
}) => {
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("a"),
		),
	).toEqual({ kind: "not-provisioned", history: "unknown" });
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.reserve("a"),
		),
	).toEqual({ kind: "not-provisioned" });
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("a"),
		),
	).toEqual({ kind: "available" });
	const snapshot = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.snapshot(),
	);
	expect(snapshot.version).toBe(1);
	expect(
		snapshot.stores.map((store) => [store.name, store.keyPath, store.indexes]),
	).toEqual([
		["library", "resourceHash", []],
		["pin-staging-leases", "leaseId", []],
		["projects", "projectId", []],
		["publication-attempts", "attemptId", []],
		["resources", "resourceHash", []],
		["revisions", "revisionId", []],
		["scope-metadata", "key", []],
		["staging", "attemptId", []],
		["writer-fences", "projectId", []],
	]);
	expect(
		snapshot.stores.find((store) => store.name === "scope-metadata")?.rows,
	).toEqual([
		{ key: "counter", lastReserved: "0" },
		{ key: "identity", namespace: "browser-registered-v1", protocolVersion: 1 },
	]);
	expect(
		snapshot.stores
			.filter((store) => store.name !== "scope-metadata")
			.every((store) => store.rows.length === 0),
	).toBe(true);
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([name]);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.reserve("a", "lease"),
		),
	).toEqual({ kind: "reserved", id: "browser-registered-v1:lease:1" });
});
test("BROWSER-STORAGE-02: two native contexts bootstrap one scope and reserve a single durable counter under their shared Web Lock", async ({
	page,
	context,
}) => {
	const other = await context.newPage();
	try {
		await other.goto("/");
		await other.evaluate(() =>
			window.__browserRegisteredStorageHarness.create("b"),
		);
		expect(
			await Promise.all([
				page.evaluate(() =>
					window.__browserRegisteredStorageHarness.provision("a"),
				),
				other.evaluate(() =>
					window.__browserRegisteredStorageHarness.provision("b"),
				),
			]),
		).toEqual([{ kind: "available" }, { kind: "available" }]);
		const results = await Promise.all(
			Array.from({ length: 40 }, (_, index) =>
				(index % 2 === 0 ? page : other).evaluate(
					(id) => window.__browserRegisteredStorageHarness.reserve(id),
					index % 2 === 0 ? "a" : "b",
				),
			),
		);
		expect(
			new Set(
				results.map((result) => ("id" in result ? result.id : result.kind)),
			).size,
		).toBe(40);
		expect(results.every((result) => result.kind === "reserved")).toBe(true);
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.names(),
			),
		).toEqual([name]);
		expect(
			(
				await page.evaluate(() =>
					window.__browserRegisteredStorageHarness.snapshot(),
				)
			).stores.find((store) => store.name === "scope-metadata")?.rows,
		).toContainEqual({ key: "counter", lastReserved: "40" });
	} finally {
		await other.close();
	}
});
for (const corruption of [
	"missing-identity",
	"missing-counter",
	"foreign-identity",
	"counter-number",
	"counter-leading-zero",
	"counter-overflow",
] as const) {
	test(`BROWSER-STORAGE-03-${corruption}: existing metadata is refused without reset or mutation`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("a"),
		);
		await page.evaluate(async (fault) => {
			const h = window.__browserRegisteredStorageHarness;
			if (fault === "missing-identity")
				await h.editMetadata("identity", undefined, true);
			else if (fault === "missing-counter")
				await h.editMetadata("counter", undefined, true);
			else if (fault === "foreign-identity")
				await h.editMetadata("identity", {
					key: "identity",
					namespace: "tma-v1-foreign",
					protocolVersion: 1,
				});
			else
				await h.editMetadata("counter", {
					key: "counter",
					lastReserved:
						fault === "counter-number"
							? 7
							: fault === "counter-leading-zero"
								? "01"
								: "18446744073709551616",
				});
		}, corruption);
		const before = await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.snapshot(),
		);
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.probe("a"),
			),
		).toEqual({ kind: "recovery-required" });
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.reserve("a"),
			),
		).toEqual({ kind: "recovery-required" });
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.provision("a"),
			),
		).toEqual({ kind: "recovery-required" });
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.snapshot(),
			),
		).toEqual(before);
	});
}
test("BROWSER-STORAGE-04: native reservations preserve uint64 precision and stop at exhaustion without reset", async ({
	page,
}) => {
	await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.provision("a");
		await h.editMetadata("counter", {
			key: "counter",
			lastReserved: "9007199254740992",
		});
	});
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.reserve("a"),
		),
	).toEqual({
		kind: "reserved",
		id: "browser-registered-v1:attempt:9007199254740993",
	});
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.editMetadata("counter", {
			key: "counter",
			lastReserved: "18446744073709551615",
		}),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("a"),
		),
	).toEqual({ kind: "available" });
	const before = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.snapshot(),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.reserve("a"),
		),
	).toEqual({ kind: "unavailable" });
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.snapshot(),
		),
	).toEqual(before);
});
test("BROWSER-STORAGE-05: revocation while queued for the real lock cannot initialize storage", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.holdLock(),
	);
	const queued = page.evaluate(() =>
		window.__browserRegisteredStorageHarness.provision("a"),
	);
	await expect
		.poll(() =>
			page.evaluate(
				async () => (await navigator.locks.query()).pending?.length,
			),
		)
		.toBe(1);
	const closing = page.evaluate(() =>
		window.__browserRegisteredStorageHarness.close("a"),
	);
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.releaseLock(),
	);
	expect((await queued).kind).toBe("unavailable");
	await closing;
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([]);
});

test("BROWSER-STORAGE-06: cancelling the selected file while queued cannot create a service database", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.holdLock(),
	);
	const queued = page.evaluate(() =>
		window.__browserRegisteredStorageHarness.provisionCancelable("a"),
	);
	await expect
		.poll(() =>
			page.evaluate(
				async () => (await navigator.locks.query()).pending?.length,
			),
		)
		.toBe(1);
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.cancelProvision("a"),
	);
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.releaseLock(),
	);
	expect((await queued).kind).toBe("unavailable");
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("a"),
		),
	).toEqual({ kind: "not-provisioned", history: "unknown" });
});
test("BROWSER-STORAGE-07: an existing future schema remains recovery-required on probe and explicit import without reset", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.createFutureDatabase(),
	);
	const before = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.snapshot(),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("a"),
		),
	).toEqual({ kind: "recovery-required" });
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("a"),
		),
	).toEqual({ kind: "recovery-required" });
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.snapshot(),
		),
	).toEqual(before);
});
test("BROWSER-STORAGE-08: a known counter rollback revokes the old generation without repairing or resetting metadata", async ({
	page,
}) => {
	await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.provision("a");
		await h.reserve("a");
		await h.editMetadata("counter", { key: "counter", lastReserved: "0" });
	});
	const before = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.snapshot(),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("a"),
		),
	).toEqual({ kind: "recovery-required" });
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("a"),
		),
	).toEqual({ kind: "recovery-required" });
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.snapshot(),
		),
	).toEqual(before);
});
test("BROWSER-STORAGE-09: native versionchange deletion revokes the live context and fresh absence stays honestly unknown", async ({
	page,
}) => {
	await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.provision("a");
		await h.reserve("a");
		await h.deleteDatabase();
	});
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("a"),
		),
	).toEqual({ kind: "recovery-required" });
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("a"),
		),
	).toEqual({ kind: "recovery-required" });
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([]);
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.create("b"),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("b"),
		),
	).toEqual({ kind: "not-provisioned", history: "unknown" });
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([]);
});

for (const key of ["identity", "counter"] as const) {
	test(`BROWSER-STORAGE-10-${key}: detected metadata loss permanently revokes the old runtime even if the exact record later reappears`, async ({
		page,
	}) => {
		await page.evaluate(async () => {
			const h = window.__browserRegisteredStorageHarness;
			await h.provision("a");
			await h.reserve("a");
		});
		const metadata = (
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.snapshot(),
			)
		).stores.find((store) => store.name === "scope-metadata")?.rows;
		if (!metadata) throw new Error("Missing healthy metadata fixture");
		const original = metadata.find(
			(row) =>
				row && typeof row === "object" && Reflect.get(row, "key") === key,
		);
		await page.evaluate(
			(key) =>
				window.__browserRegisteredStorageHarness.editMetadata(
					key,
					undefined,
					true,
				),
			key,
		);
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.probe("a"),
			),
		).toEqual({ kind: "recovery-required" });
		await page.evaluate(
			({ key, value }) =>
				window.__browserRegisteredStorageHarness.editMetadata(key, value),
			{ key, value: original },
		);
		const restored = await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.snapshot(),
		);
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.reserve("a"),
			),
		).toEqual({ kind: "recovery-required" });
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.provision("a"),
			),
		).toEqual({ kind: "recovery-required" });
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.snapshot(),
			),
		).toEqual(restored);
	});
}

test("BROWSER-STORAGE-11: observing a future schema revokes the old runtime before an external replacement becomes valid", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.createFutureDatabase(),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("a"),
		),
	).toEqual({ kind: "recovery-required" });
	await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.deleteDatabase();
		h.create("b");
		await h.provision("b");
	});
	const before = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.snapshot(),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("a"),
		),
	).toEqual({ kind: "recovery-required" });
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.snapshot(),
		),
	).toEqual(before);
});

test("BROWSER-STORAGE-12: revocation during native schema inspection drains every started validation transaction before returning", async ({
	page,
}) => {
	await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		h.create("seed");
		await h.provision("seed");
		await h.close("seed");
	});
	const result = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.probeWhileSchemaCompletionRevokes(
			"a",
		),
	);
	expect(result.status).toEqual({ kind: "unavailable" });
	expect(!result.metadataStarted || result.metadataOutcome).toBe(true);
});

test("BROWSER-STORAGE-13: strict durability is observed on real transactions and a relaxed fallback never reserves an ID", async ({
	page,
}) => {
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.strictFallback("a"),
		),
	).toEqual({ kind: "unavailable" });
	const snapshot = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.snapshot(),
	);
	expect(
		snapshot.stores.find((store) => store.name === "scope-metadata")?.rows,
	).toContainEqual({ key: "counter", lastReserved: "0" });
	expect(
		snapshot.stores
			.filter((store) => store.name !== "scope-metadata")
			.every((store) => store.rows.length === 0),
	).toBe(true);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.reserve("a"),
		),
	).toEqual({ kind: "reserved", id: "browser-registered-v1:attempt:1" });
});
for (const unawaited of [false, true]) {
	test(`BROWSER-STORAGE-14-${unawaited}: callback failure atomically aborts actual writes and composite operation drains before returning`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("a"),
		);
		expect(
			await page.evaluate(
				(unawaited) =>
					window.__browserRegisteredStorageHarness.abortCallback(
						"a",
						unawaited,
					),
				unawaited,
			),
		).toEqual({ kind: "rejected" });
		const snapshot = await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.snapshot(),
		);
		expect(
			snapshot.stores.find((store) => store.name === "library")?.rows,
		).toEqual([]);
		expect(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.probe("a"),
			),
		).toEqual({ kind: "available" });
	});
}
test("BROWSER-STORAGE-15: escaped composite capability cannot issue an ID after its operation ends", async ({
	page,
}) => {
	await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.provision("a");
		await h.captureAccess("a");
	});
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.escapedReserve("a"),
		),
	).toEqual({ kind: "unavailable" });
	expect(
		(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.snapshot(),
			)
		).stores.find((store) => store.name === "scope-metadata")?.rows,
	).toContainEqual({ key: "counter", lastReserved: "0" });
});
test("BROWSER-STORAGE-16: revocation from actual native put-success aborts and drains before returning any ID", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.provision("a"),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.revokeAfterNativeCounterPut("a"),
		),
	).toEqual({ result: { kind: "unavailable" }, outcome: true });
	expect(
		(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.snapshot(),
			)
		).stores.find((store) => store.name === "scope-metadata")?.rows,
	).toContainEqual({ key: "counter", lastReserved: "0" });
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.create("b"),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.reserve("b"),
		),
	).toEqual({ kind: "reserved", id: "browser-registered-v1:attempt:1" });
});
test("BROWSER-STORAGE-17: initializer abort after native identity add-success leaves no database or false Project", async ({
	page,
}) => {
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.abortInitialization("a"),
		),
	).toEqual({ kind: "unavailable" });
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("a"),
		),
	).toEqual({ kind: "not-provisioned", history: "unknown" });
});

test("BROWSER-STORAGE-18: a controlled blocked event abandons late native v0 upgrade before any initialization", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.create("blocked", {
			blocked: true,
		}),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("blocked"),
		),
	).toEqual({ kind: "unavailable" });
	await page.evaluate(() => window.__browserRegisteredStorageHarness.settled());
	expect(
		await page.evaluate(() => window.__browserRegisteredStorageHarness.names()),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.handles(),
		),
	).toBe(0);
});
test("BROWSER-STORAGE-19: an open deadline refuses late success and closes only its own handle while a new context continues", async ({
	page,
}) => {
	await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.provision("a");
		await h.close("a");
		h.create("late", { delaySuccessMs: 50, openTimeoutMs: 5 });
	});
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.provision("late"),
		),
	).toEqual({ kind: "unavailable" });
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.create("new"),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.reserve("new"),
		),
	).toEqual({ kind: "reserved", id: "browser-registered-v1:attempt:1" });
	await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.close("new"),
	);
	await expect
		.poll(() =>
			page.evaluate(() => window.__browserRegisteredStorageHarness.handles()),
		)
		.toBe(0);
	expect(
		(
			await page.evaluate(() =>
				window.__browserRegisteredStorageHarness.snapshot(),
			)
		).stores.find((store) => store.name === "scope-metadata")?.rows,
	).toContainEqual({ key: "counter", lastReserved: "1" });
});
test("BROWSER-STORAGE-20: a blocked existing native open closes its later success without losing metadata or granting a new capability", async ({
	page,
}) => {
	await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.provision("a");
		await h.reserve("a");
		await h.close("a");
		h.create("blocked", { blocked: true, delaySuccessMs: 50 });
	});
	const before = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.snapshot(),
	);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.probe("blocked"),
		),
	).toEqual({ kind: "unavailable" });
	await expect
		.poll(() =>
			page.evaluate(() => window.__browserRegisteredStorageHarness.handles()),
		)
		.toBe(0);
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredStorageHarness.snapshot(),
		),
	).toEqual(before);
});

for (const options of [{ noLocks: true }, { insecure: true }] as const) {
	test(`BROWSER-STORAGE-21-${Object.keys(options)[0]}: missing required capability refuses before any native database request`, async ({
		page,
	}) => {
		await page.goto("/");
		const actual = await page.evaluate(async (options) => {
			const h = window.__browserRegisteredStorageHarness;
			h.create("test", options);
			return {
				probe: await h.probe("test"),
				provision: await h.provision("test"),
				reserve: await h.reserve("test"),
				opens: h.openCount(),
				names: await h.names(),
			};
		}, options);
		expect(actual).toEqual({
			probe: { kind: "unavailable" },
			provision: { kind: "unavailable" },
			reserve: { kind: "unavailable" },
			opens: 0,
			names: [],
		});
	});
}

test("BROWSER-STORAGE-22: pre-cancelled file and invalid operation kind cannot create a database", async ({
	page,
}) => {
	await page.goto("/");
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		h.create("test");
		return {
			cancelled: await h.provisionPrecancelled("test"),
			invalid: await h.reserve("test", "foreign" as never),
			opens: h.openCount(),
			names: await h.names(),
		};
	});
	expect(actual).toEqual({
		cancelled: { kind: "unavailable" },
		invalid: { kind: "unavailable" },
		opens: 0,
		names: [],
	});
});

for (const fault of [
	"missing-store",
	"extra-store",
	"key-path",
	"auto-increment",
	"index",
] as const) {
	test(`BROWSER-STORAGE-23-${fault}: unknown existing schema remains byte-for-byte unchanged and never becomes writable`, async ({
		page,
	}) => {
		await page.goto("/");
		const actual = await page.evaluate(async (fault) => {
			const h = window.__browserRegisteredStorageHarness;
			await h.createMalformedDatabase(fault);
			const before = await h.snapshot();
			h.create("test");
			return {
				before,
				probe: await h.probe("test"),
				provision: await h.provision("test"),
				reserve: await h.reserve("test"),
				after: await h.snapshot(),
			};
		}, fault);
		expect(actual.probe).toEqual({ kind: "recovery-required" });
		expect(actual.provision).toEqual({ kind: "recovery-required" });
		expect(actual.reserve).toEqual({ kind: "recovery-required" });
		expect(actual.after).toEqual(actual.before);
	});
}

test("BROWSER-STORAGE-24: preventing a real request error does not commit a reservation or poison later healthy work", async ({
	page,
}) => {
	await page.goto("/");
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		h.create("test");
		await h.provision("test");
		const failed = await h.preventedRequestError("test"),
			before = await h.snapshot();
		const resumed = await h.reserve("test");
		return {
			failed,
			counter: before.stores
				.find((store) => store.name === "scope-metadata")
				?.rows.find(
					(row: unknown) =>
						typeof row === "object" &&
						row !== null &&
						"key" in row &&
						row.key === "counter",
				),
			resumed,
		};
	});
	expect(actual.failed.prevented).toBe(true);
	expect(actual.failed.result.kind).not.toBe("reserved");
	expect(actual.counter).toEqual({ key: "counter", lastReserved: "0" });
	expect(actual.resumed).toEqual({
		kind: "reserved",
		id: "browser-registered-v1:attempt:1",
	});
});

test("BROWSER-STORAGE-25: session revocation is synchronous, drains the running command and rejects queued/future commands", async ({
	page,
}) => {
	const actual = await page.evaluate(() =>
		window.__browserRegisteredStorageHarness.sessionQueue(),
	);
	expect(actual).toEqual({
		before: { aborted: true, drained: false, events: ["first-started"] },
		events: ["first-started", "first-completed"],
		outcomes: ["fulfilled", "rejected"],
		drained: true,
		after: "refused",
	});
});

test("BROWSER-STORAGE-26: explicit disposal closes its actual native handle and stale capabilities cannot reopen it", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.provision("a");
		const before = await h.snapshot(),
			handlesBefore = h.handles();
		await h.close("a");
		await h.close("a");
		return {
			before,
			handlesBefore,
			handlesAfter: h.handles(),
			probe: await h.probe("a"),
			provision: await h.provision("a"),
			reserve: await h.reserve("a"),
			after: await h.snapshot(),
		};
	});
	expect(actual.handlesBefore).toBe(1);
	expect(actual.handlesAfter).toBe(0);
	expect(actual.probe).toEqual({ kind: "unavailable" });
	expect(actual.provision).toEqual({ kind: "unavailable" });
	expect(actual.reserve).toEqual({ kind: "unavailable" });
	expect(actual.after).toEqual(actual.before);
});

test("BROWSER-STORAGE-27: the composite operation receives the exact anonymous browser scope and live owned signal", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredStorageHarness;
		await h.provision("a");
		return h.inspectAccess("a");
	});
	expect(actual).toEqual({
		scope: "browser-registered-v1",
		aborted: false,
		sameSignal: true,
	});
});
