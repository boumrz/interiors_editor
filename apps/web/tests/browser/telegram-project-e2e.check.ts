import { expect, test, type Page } from "@playwright/test";
import type {} from "./telegram-storage-harness";

test.beforeEach(async ({ page }, testInfo) => {
	await page.goto("/");
	expect(
		await page.evaluate(
			() => Reflect.get(globalThis, "__stryker__")?.activeMutant,
		),
	).toBe(testInfo.project.metadata.activeMutant);
});

for (const mode of [
	"missing",
	"other-project",
	"published-unmarked",
	"no-publish-other-project",
] as const) {
	test(`TMA-PROJECT-12: a prepared attempt with ${mode} pin stays quarantined before writer renewal or takeover`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__telegramProjectHarness.create("a", "a", "owner-a"),
		);
		const lease = await page.evaluate(() =>
			window.__telegramProjectHarness.prepareResource(
				"a",
				"incomplete",
				"p1",
				"r1",
				[71, 72, 73],
			),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.writePrepared("a", "incomplete"),
		);
		if (mode === "published-unmarked") {
			expect(
				await page.evaluate(() =>
					window.__telegramProjectHarness.publishPrepared("a", "incomplete"),
				),
			).toEqual({ kind: "durable" });
		} else if (mode === "no-publish-other-project") {
			await page.evaluate(async () => {
				const [attempt] = await window.__telegramProjectHarness.rows(
					"a",
					"publication-attempts",
				);
				if (!attempt || typeof attempt !== "object")
					throw new Error("Missing prepared journal");
				const attemptId = Reflect.get(attempt, "attemptId");
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"publication-attempts",
					attemptId,
					{ state: "no-publish" },
				);
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"staging",
					attemptId,
					null,
				);
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"revisions",
					"r1",
					null,
				);
			});
		}
		await page.evaluate(
			({ leaseId, mode }) =>
				window.__telegramProjectHarness.changeStoredRow(
					"a",
					"pin-staging-leases",
					leaseId,
					mode === "missing"
						? null
						: mode === "published-unmarked"
							? { marked: false }
							: { projectId: "p2" },
				),
			{ leaseId: lease.leaseId, mode },
		);
		const before = await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
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
			await page.evaluate(
				(published) =>
					window.__telegramProjectHarness.publishFixture(
						"a",
						"p1",
						"r2",
						published ? "r1" : undefined,
					),
				mode === "published-unmarked",
			),
		).toMatchObject({ kind: "persist-failed" });
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.protocolSnapshot("a"),
			),
		).toEqual(before);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.resourceBytes("a", "incomplete"),
			),
		).toEqual([71, 72, 73]);
	});
}

for (const mode of [
	"missing-revision",
	"missing-receipt",
	"changed-revision",
	"changed-creation-id",
	"wrong-digest",
	"non-index-array-property",
	"invalid-domain",
] as const) {
	test(`TMA-PROJECT-10: ${mode} quarantines a current Project before writer renewal or publication`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__telegramProjectHarness.create("a", "a", "owner-a"),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
		);
		await page.evaluate(
			(mode) => mode === "invalid-domain" ? window.__telegramProjectHarness.corruptCurrentDomain("a") : window.__telegramProjectHarness.corruptCurrentProof("a", mode),
			mode,
		);
		if (mode === "non-index-array-property") expect(await page.evaluate(async () => {
			const rows = await window.__telegramProjectHarness.rows("a", "revisions");
			return Reflect.get(Reflect.get(Reflect.get(Reflect.get(rows[0] as object, "candidate"), "project"), "level"), "vertices").historical;
		})).toBe("source-only");
		const before = await page.evaluate(async () => ({
			writer: await window.__telegramProjectHarness.rows("a", "writer-fences"),
			revisions: await window.__telegramProjectHarness.rows("a", "revisions"),
			journals: await window.__telegramProjectHarness.rows(
				"a",
				"publication-attempts",
			),
			metadata: await window.__telegramProjectHarness.rows(
				"a",
				"scope-metadata",
			),
		}));
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.load("a", "p1"),
			),
		).toMatchObject({ kind: "recovery-needed" });
		if (mode !== "missing-revision")
			expect(
				await page.evaluate(() =>
					window.__telegramProjectHarness.recoverySources("a"),
				),
			).toEqual([
				{ kind: "unverified-source", projectId: "p1", revisionId: "r1" },
			]);
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
				window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
			),
		).toMatchObject({ kind: "persist-failed" });
		expect(
			await page.evaluate(async () => ({
				writer: await window.__telegramProjectHarness.rows(
					"a",
					"writer-fences",
				),
				revisions: await window.__telegramProjectHarness.rows("a", "revisions"),
				journals: await window.__telegramProjectHarness.rows(
					"a",
					"publication-attempts",
				),
				metadata: await window.__telegramProjectHarness.rows(
					"a",
					"scope-metadata",
				),
			})),
		).toEqual(before);
	});
}

test("TMA-PROJECT-11: orphaned prepared pin roots quarantine a Project with an existing fence", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"orphan",
			"p1",
			"r1",
			[94, 95, 96],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "orphan"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.leavePinRootsWithFence("a"),
	);
	const before = await page.evaluate(async () => ({
		pins: await window.__telegramProjectHarness.rows("a", "pin-staging-leases"),
		writer: await window.__telegramProjectHarness.rows("a", "writer-fences"),
		resources: await window.__telegramProjectHarness.rows("a", "resources"),
		metadata: await window.__telegramProjectHarness.rows("a", "scope-metadata"),
	}));
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
			window.__telegramProjectHarness.publishFixture("a", "p1", "r2"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(async () => ({
			pins: await window.__telegramProjectHarness.rows(
				"a",
				"pin-staging-leases",
			),
			writer: await window.__telegramProjectHarness.rows("a", "writer-fences"),
			resources: await window.__telegramProjectHarness.rows("a", "resources"),
			metadata: await window.__telegramProjectHarness.rows(
				"a",
				"scope-metadata",
			),
		})),
	).toEqual(before);
});

test("TMA-PROJECT-09: a surviving prepared pin root prevents fresh Project ID reuse without affecting other Projects", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"orphan",
			"p1",
			"r1",
			[91, 92, 93],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "orphan"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.leaveOnlyPreparedPinRoots("a"),
	);
	const before = await page.evaluate(async () => ({
		pins: await window.__telegramProjectHarness.rows("a", "pin-staging-leases"),
		resources: await window.__telegramProjectHarness.rows("a", "resources"),
		metadata: await window.__telegramProjectHarness.rows("a", "scope-metadata"),
	}));
	expect(before.pins).toHaveLength(1);
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("fresh", "a", "owner-fresh"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("fresh", "p1", "r2"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(async () => ({
			pins: await window.__telegramProjectHarness.rows(
				"a",
				"pin-staging-leases",
			),
			resources: await window.__telegramProjectHarness.rows("a", "resources"),
			metadata: await window.__telegramProjectHarness.rows(
				"a",
				"scope-metadata",
			),
		})),
	).toEqual(before);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "writer-fences"),
		),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("fresh", "p2", "r3"),
		),
	).toEqual({ kind: "durable" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "orphan"),
		),
	).toEqual([91, 92, 93]);
});

test("TMA-PROJECT-08: observing another writer remains read-only after expiry and a fresh runtime in the same context", async ({
	page,
	context,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
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
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toMatchObject({ kind: "read-only" });
	await page.evaluate(() => window.__telegramProjectHarness.close("a"));
	await page.evaluate(() => {
		window.__telegramProjectHarness.create("reloaded", "a", "owner-reloaded");
		window.__telegramProjectHarness.setNow("reloaded", Date.now() + 10000);
	});
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("reloaded", "p1"),
		),
	).toMatchObject({ kind: "read-only" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "writer-fences"),
		),
	).toMatchObject([{ ownerId: "owner-b", fencingToken: 2 }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.takeover("reloaded", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 3 });
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("other-scope", "b", "owner-other"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("other-scope", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 1 });
});

test("TMA-PROJECT-07: history cannot promote a prepared Revision whose pointer transaction aborted", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.abortNextProjectPointer(),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
		),
	).toMatchObject({ kind: "persist-failed" });
	const stages = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "staging"),
	);
	const journal = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "publication-attempts"),
	);
	expect(stages).toHaveLength(1);
	expect(journal).toHaveLength(2);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.existingRevision(
				"a",
				"a",
				"r2",
				"r1",
				"history",
			),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r1" } },
	});
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
});

test("TMA-PROJECT-06: a missing persisted fence cannot reset an existing Project to token one", async ({
	page,
	context,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	const before = await page.evaluate(() =>
		window.__telegramProjectHarness.load("a", "p1"),
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
	await second.evaluate(() =>
		window.__telegramProjectHarness.deleteWriterRow("a", "p1"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toEqual(before);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "writer-fences"),
		),
	).toEqual([]);
	expect(
		await second.evaluate(() =>
			window.__telegramProjectHarness.takeover("b", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("fresh", "a", "owner-c"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.takeover("fresh", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "writer-fences"),
		),
	).toEqual([]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toHaveLength(1);
});

test("TMA-PROJECT-05: a borrowed valid candidate cannot satisfy another Project pointer", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p2", "r2"),
	);
	const healthy = await page.evaluate(() =>
		window.__telegramProjectHarness.load("a", "p2"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.borrowRevisionCandidate("a", "r2", "r1"),
	);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p2")),
	).toEqual(healthy);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.list("a")),
	).toMatchObject({
		kind: "populated",
		recoveryNeeded: true,
		projects: [{ projectId: "p2" }],
	});
});


test("TMA-PROJECT-01: real shared create and first-room commands save and reopen in their isolated scope", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
	const created = await page.evaluate(() =>
		window.__telegramProjectHarness.createProject("a", "Квартира"),
	);
	expect(created.kind).toBe("durable");
	if (created.kind !== "durable") throw new Error("Expected durable creation");
	expect(
		await page.evaluate(
			(id) => window.__telegramProjectHarness.configure("a", id, "4000"),
			created.projectId,
		),
	).toMatchObject({
		kind: "durable",
		metrics: { widthMm: 4000, depthMm: 3000, heightMm: 2600 },
	});
	const before = await page.evaluate(
		(id) => window.__telegramProjectHarness.load("a", id),
		created.projectId,
	);
	// Usable dimensions exclude inward wall offsets; centerlines span an extra100mm.
	expect(before).toMatchObject({
		kind: "durable",
		candidate: {
			project: {
				name: "Квартира",
				level: {
					rooms: [{ heightMm: 2600 }],
					vertices: [
						{ xMm: 0, zMm: 0 },
						{ xMm: 4100, zMm: 0 },
						{ xMm: 4100, zMm: 3100 },
						{ xMm: 0, zMm: 3100 },
					],
				},
			},
		},
	});
	await page.evaluate(() => window.__telegramProjectHarness.close("a"));
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("reopened", "a", "owner-reopened"),
	);
	expect(
		await page.evaluate(
			(id) => window.__telegramProjectHarness.load("reopened", id),
			created.projectId,
		),
	).toEqual(before);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.list("reopened")),
	).toMatchObject({
		kind: "populated",
		projects: [{ projectId: created.projectId }],
	});
	expect(
		(await page.evaluate(() => indexedDB.databases())).map(
			(entry) => entry.name,
		),
	).toEqual([`interiors-editor-projects:tma-v1-${"a".repeat(64)}`]);
});

test("TMA-PROJECT-02: explicit takeover fences the old runtime before staging without deleting its current Revision", async ({
	page,
	context,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("first", "a", "owner-a"),
	);
	const created = await page.evaluate(() =>
		window.__telegramProjectHarness.createProject("first", "План"),
	);
	if (created.kind !== "durable") throw new Error("Expected durable creation");
	const second = await context.newPage();
	await second.goto("/");
	await second.evaluate(() =>
		window.__telegramProjectHarness.create("second", "a", "owner-b"),
	);
	expect(
		await second.evaluate(
			(id) => window.__telegramProjectHarness.access("second", id),
			created.projectId,
		),
	).toMatchObject({ kind: "read-only" });
	expect(
		await second.evaluate(
			(id) => window.__telegramProjectHarness.takeover("second", id),
			created.projectId,
		),
	).toMatchObject({ kind: "writable" });
	expect(
		await page.evaluate(
			(id) => window.__telegramProjectHarness.configure("first", id, "4000"),
			created.projectId,
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.lost("first")),
	).toBe(true);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.lost("first")),
	).toBe(false);
	expect(
		await second.evaluate(
			(id) => window.__telegramProjectHarness.load("second", id),
			created.projectId,
		),
	).toMatchObject({
		kind: "durable",
		candidate: {
			revision: { revisionId: created.revisionId },
			project: { level: { rooms: [] } },
		},
	});
	expect(
		await second.evaluate(
			(id) => window.__telegramProjectHarness.configure("second", id, "4200"),
			created.projectId,
		),
	).toMatchObject({ kind: "durable" });
	expect(
		await page.evaluate(
			(id) => window.__telegramProjectHarness.configure("first", id, "4500"),
			created.projectId,
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toHaveLength(2);
});

test("TMA-PROJECT-03: global Revision collision and stale base preserve the original immutable Revision", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
		),
	).toEqual({ kind: "durable" });
	const original = await page.evaluate(() =>
		window.__telegramProjectHarness.load("a", "p1"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p2", "r1"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture(
				"a",
				"p1",
				"r2",
				"obsolete",
			),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toEqual(original);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p2")),
	).toEqual({ kind: "empty" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toHaveLength(1);
});

test("TMA-PROJECT-04: history uses a new receipt and an exact existing Revision without overwriting or duplicating it", async ({
	page,
}) => {
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
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.existingRevision("a", "a", "r1", "r2"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.existingRevision(
				"a",
				"a",
				"r1",
				"r2",
				"history",
			),
		),
	).toEqual({ kind: "durable" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r1" } },
	});
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toEqual(revisions);
	const journal = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "publication-attempts"),
	);
	expect(journal).toHaveLength(3);
	expect(
		journal.every(
			(record) =>
				record &&
				typeof record === "object" &&
				Reflect.get(record, "state") === "published" &&
				Reflect.get(record, "receipt"),
		),
	).toBe(true);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "staging"),
		),
	).toEqual([]);
});

async function expectCurrentQuarantine(page: Page) {
	const before = await page.evaluate(() =>
		window.__telegramProjectHarness.protocolSnapshot("a"),
	);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({ kind: "recovery-needed" });
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
			window.__telegramProjectHarness.publishFixture("a", "p1", "r-next", "r1"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
		),
	).toEqual(before);
}

test("TMA-PROJECT-13: a vanished prepublication fence cannot reissue token one to its remembered owner", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 1 });
	await page.evaluate(() =>
		window.__telegramProjectHarness.deleteWriterRow("a", "p1"),
	);
	const before = await page.evaluate(() =>
		window.__telegramProjectHarness.protocolSnapshot("a"),
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
			window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
		),
	).toEqual(before);
});

for (const surviving of [
	"revision-and-receipt",
	"revision-only",
	"receipt-only",
	"no-publish-only",
] as const) {
	test(`TMA-PROJECT-14: ${surviving} claims prevent fresh Project ID reuse when pointer and fence vanished`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__telegramProjectHarness.create("a", "a", "owner-a"),
		);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
			),
		).toEqual({ kind: "durable" });
		await page.evaluate(async (surviving) => {
			const [creation] = await window.__telegramProjectHarness.rows(
				"a",
				"publication-attempts",
			);
			if (!creation || typeof creation !== "object")
				throw new Error("Missing creation receipt");
			const attemptId = Reflect.get(creation, "attemptId");
			await window.__telegramProjectHarness.changeStoredRow(
				"a",
				"projects",
				"p1",
				null,
			);
			await window.__telegramProjectHarness.deleteWriterRow("a", "p1");
			if (surviving === "revision-only")
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"publication-attempts",
					attemptId,
					null,
				);
			if (surviving === "receipt-only" || surviving === "no-publish-only")
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"revisions",
					"r1",
					null,
				);
			if (surviving === "no-publish-only")
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"publication-attempts",
					attemptId,
					{ state: "no-publish" },
					["receipt"],
				);
			await window.__telegramProjectHarness.close("a");
			window.__telegramProjectHarness.create("fresh", "a", "owner-fresh");
		}, surviving);
		const before = await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
		);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.access("fresh", "p1"),
			),
		).toEqual({ kind: "not-ready" });
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.takeover("fresh", "p1"),
			),
		).toEqual({ kind: "not-ready" });
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.publishFixture("fresh", "p1", "r2"),
			),
		).toMatchObject({ kind: "persist-failed" });
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.protocolSnapshot("a"),
			),
		).toEqual(before);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.publishFixture("fresh", "p2", "r3"),
			),
		).toEqual({ kind: "durable" });
	});
}

for (const mode of [
	"scope",
	"extra",
	"attempt",
	"revision",
	"hashes",
	"lease",
] as const) {
	test(`TMA-PROJECT-15: mismatched prepared pin ${mode} quarantines the exact Project without cleanup`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__telegramProjectHarness.create("a", "a", "owner-a"),
		);
		const lease = await page.evaluate(() =>
			window.__telegramProjectHarness.prepareResource(
				"a",
				"corrupt-pin",
				"p1",
				"r1",
				[81, 82, 83],
			),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.writePrepared("a", "corrupt-pin"),
		);
		await page.evaluate(
			async ({ mode, lease }) => {
				const patches: Record<typeof mode, Record<string, unknown>> = {
					scope: { scope: `tma-v1-${"b".repeat(64)}` },
					extra: { unregisteredRootMeaning: true },
					attempt: {
						attemptId: `${lease.leaseId.replace(":lease:", ":attempt:")}99`,
					},
					revision: { revisionId: "other-revision" },
					hashes: { resourceHashes: [...lease.resourceHashes, "f".repeat(64)] },
					lease: { leaseId: `${lease.leaseId}99` },
				};
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"pin-staging-leases",
					lease.leaseId,
					patches[mode],
				);
				if (mode === "lease")
					await window.__telegramProjectHarness.changeStoredRow(
						"a",
						"pin-staging-leases",
						lease.leaseId,
						null,
					);
			},
			{ mode, lease },
		);
		const before = await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
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
				window.__telegramProjectHarness.publishFixture("a", "p1", "r2"),
			),
		).toMatchObject({ kind: "persist-failed" });
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.protocolSnapshot("a"),
			),
		).toEqual(before);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.resourceBytes("a", "corrupt-pin"),
			),
		).toEqual([81, 82, 83]);
	});
}

for (const mode of [
	"pointer-extra",
	"pointer-scope",
	"pointer-name",
	"revision-extra",
	"revision-scope",
	"revision-project",
	"creation-project",
	"creation-revision",
	"creation-intent",
	"creation-checksum",
	"creation-serialization",
] as const) {
	test(`TMA-PROJECT-16: ${mode} does not weaken current Project proof admission`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__telegramProjectHarness.create("a", "a", "owner-a"),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
		);
		await page.evaluate(async (mode) => {
			if (mode.startsWith("pointer-")) {
				const patch =
					mode === "pointer-extra"
						? { unknownMeaning: true }
						: mode === "pointer-scope"
							? { scope: `tma-v1-${"b".repeat(64)}` }
							: { name: "Wrong pointer name" };
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"projects",
					"p1",
					patch,
				);
			} else if (mode.startsWith("revision-")) {
				const patch =
					mode === "revision-extra"
						? { unknownMeaning: true }
						: mode === "revision-scope"
							? { scope: `tma-v1-${"b".repeat(64)}` }
							: { projectId: "other-project" };
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"revisions",
					"r1",
					patch,
				);
			} else {
				const [creation] = await window.__telegramProjectHarness.rows(
					"a",
					"publication-attempts",
				);
				if (!creation || typeof creation !== "object")
					throw new Error("Missing creation receipt");
				const receipt: unknown = Reflect.get(creation, "receipt");
				if (!receipt || typeof receipt !== "object")
					throw new Error("Missing exact receipt");
				const patches = {
					"creation-project": { projectId: "other-project" },
					"creation-revision": {
						revisionId: "other-revision",
						receipt: { ...receipt, revisionId: "other-revision" },
					},
					"creation-intent": { intent: "history" },
					"creation-checksum": {
						checksum: "different-receipt-digest",
						receipt: { ...receipt, checksum: "different-receipt-digest" },
					},
					"creation-serialization": {
						serializedProject: "different receipt bytes",
					},
				};
				if (
					mode === "creation-project" ||
					mode === "creation-revision" ||
					mode === "creation-intent" ||
					mode === "creation-checksum" ||
					mode === "creation-serialization"
				)
					await window.__telegramProjectHarness.changeStoredRow(
						"a",
						"publication-attempts",
						Reflect.get(creation, "attemptId"),
						patches[mode],
					);
			}
		}, mode);
		await expectCurrentQuarantine(page);
	});
}

test("TMA-PROJECT-17: a relabelled receipt cannot lend a healthy foreign candidate to another Project pointer", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p2", "r2"),
	);
	await page.evaluate(async () => {
		const pointers = await window.__telegramProjectHarness.rows(
			"a",
			"projects",
		);
		const other = pointers.find(
			(value) =>
				value &&
				typeof value === "object" &&
				Reflect.get(value, "projectId") === "p2",
		);
		const journals = await window.__telegramProjectHarness.rows(
			"a",
			"publication-attempts",
		);
		const creation = journals.find(
			(value) =>
				value &&
				typeof value === "object" &&
				Reflect.get(value, "revisionId") === "r2",
		);
		if (
			!other ||
			typeof other !== "object" ||
			!creation ||
			typeof creation !== "object"
		)
			throw new Error("Missing foreign fixture");
		await window.__telegramProjectHarness.changeStoredRow(
			"a",
			"projects",
			"p1",
			{ currentRevisionId: "r2", name: Reflect.get(other, "name") },
		);
		await window.__telegramProjectHarness.changeStoredRow(
			"a",
			"publication-attempts",
			Reflect.get(creation, "attemptId"),
			{ projectId: "p1" },
		);
	});
	await expectCurrentQuarantine(page);
});

test("TMA-PROJECT-18: awaited native SHA cannot admit a coherently replaced current proof before fence write", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.armCurrentProofRace("a", "a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	const afterFault = await page.evaluate(() =>
		window.__telegramProjectHarness.checksumRaceSnapshot("a"),
	);
	expect(afterFault).toBeDefined();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
		),
	).toEqual(afterFault);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.takeover("a", "p1"),
		),
	).toEqual({ kind: "not-ready" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
		),
	).toEqual(afterFault);
});

test("TMA-PROJECT-19: a missing source Revision cannot hide another exact unverified recovery source", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p2", "r2"),
	);
	const serializedProject = await page.evaluate(() =>
		window.__telegramProjectHarness.futureRevision("a", "r2"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.changeStoredRow(
			"a",
			"revisions",
			"r1",
			null,
		),
	);
	const before = await page.evaluate(() =>
		window.__telegramProjectHarness.protocolSnapshot("a"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.recoverySources("a"),
		),
	).toEqual([{ kind: "unverified-source", projectId: "p2", revisionId: "r2" }]);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.readRecoverySource("a", "p1", "r1"),
		),
	).toBeUndefined();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.readRecoverySource("a", "p2", "r2"),
		),
	).toEqual({
		kind: "unverified-source",
		projectId: "p2",
		revisionId: "r2",
		serializedProject,
	});
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
		),
	).toEqual(before);
});

for (const store of ["projects", "revisions"] as const) {
	test(`TMA-PROJECT-20: foreign ${store} scope never exposes unverified source bytes`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__telegramProjectHarness.create("a", "a", "owner-a"),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.futureRevision("a", "r1"),
		);
		await page.evaluate(
			(store) =>
				window.__telegramProjectHarness.changeStoredRow(
					"a",
					store,
					store === "projects" ? "p1" : "r1",
					{ scope: `tma-v1-${"b".repeat(64)}` },
				),
			store,
		);
		const before = await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
		);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.recoverySources("a"),
			),
		).toEqual([]);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.readRecoverySource("a", "p1", "r1"),
			),
		).toBeUndefined();
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.protocolSnapshot("a"),
			),
		).toEqual(before);
	});
}

test("TMA-PROJECT-21: a valid two-resource preparation renews and publishes with both exact roots", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	const lease = await page.evaluate(() =>
		window.__telegramProjectHarness.prepareTwoResources("a"),
	);
	expect(lease.resourceHashes).toHaveLength(2);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 1 });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "pair"),
		),
	).toEqual({ kind: "durable" });
	await page.evaluate(() =>
		window.__telegramProjectHarness.completePrepared("a", "pair"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 1 });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({
		kind: "durable",
		candidate: {
			project: {
				assetDefinitionRefs: [
					{ resourceHash: lease.resourceHashes[0] },
					{ resourceHash: lease.resourceHashes[1] },
				],
			},
		},
	});
	const state = await page.evaluate(() =>
		window.__telegramProjectHarness.protocolSnapshot("a"),
	);
	expect(state.find((entry) => entry.name === "resources")?.rows).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ blob: [11, 12], durable: true }),
			expect.objectContaining({ blob: [21, 22, 23], durable: true }),
		]),
	);
});

for (const replacement of [
	"same-owner",
	"expired-foreign",
	"owner-only-corruption",
] as const) {
	test(`TMA-PROJECT-22: ${replacement} cannot silently adopt a changed remembered writer identity`, async ({
		page,
	}) => {
		await page.evaluate(() => {
			window.__telegramProjectHarness.create("a", "a", "owner-a");
			window.__telegramProjectHarness.setNow("a", 1_000);
		});
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.access("a", "p1"),
			),
		).toMatchObject({ kind: "writable", fencingToken: 1 });
		await page.evaluate(async (replacement) => {
			if (replacement === "owner-only-corruption") {
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"writer-fences",
					"p1",
					{ ownerId: "owner-b", expiresAtEpochMs: 1_001 },
				);
			} else {
				window.__telegramProjectHarness.create(
					"b",
					"a",
					replacement === "same-owner" ? "owner-a" : "owner-b",
				);
				window.__telegramProjectHarness.setNow("b", 1_000);
				const taken = await window.__telegramProjectHarness.takeover("b", "p1");
				if (taken.kind !== "writable" || taken.fencingToken !== 2)
					throw new Error("Replacement did not acquire its native fence");
			}
			if (replacement !== "same-owner")
				window.__telegramProjectHarness.setNow("a", 1_000_000);
		}, replacement);
		const before = await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
		);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.access("a", "p1"),
			),
		).toEqual({ kind: "read-only", reasonCode: "WRITER_LEASE_HELD" });
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.protocolSnapshot("a"),
			),
		).toEqual(before);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.takeover("a", "p1"),
			),
		).toEqual({
			kind: "writable",
			fencingToken: replacement === "owner-only-corruption" ? 2 : 3,
		});
	});
}

test("TMA-PROJECT-23: a completed no-publish pin allows a fresh exact preparation under the same live fence", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"cancelled",
			"p1",
			"r1",
			[41, 42],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "cancelled"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.discardPrepared("a", "cancelled"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 1 });
	await page.evaluate(() =>
		window.__telegramProjectHarness.prepareResource(
			"a",
			"retry",
			"p1",
			"r2",
			[51, 52, 53],
		),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.writePrepared("a", "retry"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishPrepared("a", "retry"),
		),
	).toEqual({ kind: "durable" });
	await page.evaluate(() =>
		window.__telegramProjectHarness.completePrepared("a", "retry"),
	);
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r2" } },
	});
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "cancelled"),
		),
	).toBeUndefined();
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.resourceBytes("a", "retry"),
		),
	).toEqual([51, 52, 53]);
});

for (const mode of [
	"missing-revision",
	"invalid-creation-id",
	"foreign-creation-id",
	"changed-candidate",
] as const) {
	for (const operation of ["access", "takeover"] as const) {
		test(`TMA-PROJECT-24: ${mode} prepared immutable ownership refuses ${operation} before changing the fence`, async ({
			page,
		}) => {
			await page.evaluate(() =>
				window.__telegramProjectHarness.create("a", "a", "owner-a"),
			);
			await page.evaluate(() =>
				window.__telegramProjectHarness.prepareResource(
					"a",
					"prepared-revision",
					"p1",
					"r1",
					[61, 62, 63],
				),
			);
			await page.evaluate(() =>
				window.__telegramProjectHarness.writePrepared("a", "prepared-revision"),
			);
			await page.evaluate(async (mode) => {
				let patch: Record<string, unknown> | null =
					mode === "missing-revision"
						? null
						: {
								creationAttemptId:
									mode === "foreign-creation-id" ? "foreign-attempt" : 7,
							};
				if (mode === "changed-candidate") {
					const [row] = await window.__telegramProjectHarness.rows(
						"a",
						"revisions",
					);
					if (!row || typeof row !== "object")
						throw new Error("Missing prepared Revision");
					const candidate: unknown = Reflect.get(row, "candidate");
					if (!candidate || typeof candidate !== "object")
						throw new Error("Missing candidate");
					const project: unknown = Reflect.get(candidate, "project");
					if (!project || typeof project !== "object")
						throw new Error("Missing Project");
					patch = {
						candidate: {
							...candidate,
							project: { ...project, name: "Changed immutable payload" },
						},
					};
				}
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"revisions",
					"r1",
					patch,
				);
			}, mode);
			const before = await page.evaluate(() =>
				window.__telegramProjectHarness.protocolSnapshot("a"),
			);
			expect(
				await page.evaluate(
					(operation) => window.__telegramProjectHarness[operation]("a", "p1"),
					operation,
				),
			).toEqual({ kind: "not-ready" });
			expect(
				await page.evaluate(() =>
					window.__telegramProjectHarness.protocolSnapshot("a"),
				),
			).toEqual(before);
			expect(
				await page.evaluate(() =>
					window.__telegramProjectHarness.resourceBytes(
						"a",
						"prepared-revision",
					),
				),
			).toEqual([61, 62, 63]);
		});
	}
}

for (const missing of [
	"revision",
	"creation-receipt",
	"creation-project",
	"creation-revision",
	"creation-intent",
	"creation-checksum",
	"creation-serialization",
	"creation-manifest",
	"creation-no-publish",
	"foreign-creation-id",
] as const) {
	test(`TMA-PROJECT-25: prepared history ${missing} ownership refuses writer admission`, async ({
		page,
	}) => {
		await page.evaluate(() =>
			window.__telegramProjectHarness.create("a", "a", "owner-a"),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
		);
		await page.evaluate(() =>
			window.__telegramProjectHarness.abortNextProjectPointer(),
		);
		expect(
			await page.evaluate(() =>
				window.__telegramProjectHarness.existingRevision(
					"a",
					"a",
					"r1",
					"r2",
					"history",
				),
			),
		).toMatchObject({ kind: "persist-failed" });
		await page.evaluate(async (missing) => {
			if (missing === "revision") {
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"revisions",
					"r1",
					null,
				);
				return;
			}
			const journals = await window.__telegramProjectHarness.rows(
				"a",
				"publication-attempts",
			);
			const creation = journals.find(
				(value) =>
					value &&
					typeof value === "object" &&
					Reflect.get(value, "revisionId") ===
						(missing === "foreign-creation-id" ? "r2" : "r1") &&
					Reflect.get(value, "intent") === "mutation",
			);
			if (!creation || typeof creation !== "object")
				throw new Error("Missing original history creation");
			const attemptId = Reflect.get(creation, "attemptId");
			if (missing === "foreign-creation-id") {
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"revisions",
					"r1",
					{ creationAttemptId: attemptId },
				);
				return;
			}
			if (missing === "creation-receipt") {
				await window.__telegramProjectHarness.changeStoredRow(
					"a",
					"publication-attempts",
					attemptId,
					null,
				);
				return;
			}
			if (missing === "creation-no-publish") {
				await window.__telegramProjectHarness.changeStoredRow("a", "publication-attempts", attemptId, { state: "no-publish" }, ["receipt"]);
				return;
			}
			const receipt: unknown = Reflect.get(creation, "receipt");
			if (!receipt || typeof receipt !== "object")
				throw new Error("Missing exact receipt");
			const manifest = [{ resourceHash: "f".repeat(64), byteLength: 1 }];
			const patches = {
				"creation-project": { projectId: "other-project" },
				"creation-revision": {
					revisionId: "other-revision",
					receipt: { ...receipt, revisionId: "other-revision" },
				},
				"creation-intent": { intent: "history" },
				"creation-checksum": {
					checksum: "different-receipt-digest",
					receipt: { ...receipt, checksum: "different-receipt-digest" },
				},
				"creation-serialization": {
					serializedProject: "different receipt bytes",
				},
				"creation-manifest": {
					resourceManifest: manifest,
					receipt: { ...receipt, resourceManifest: manifest },
				},
			};
			await window.__telegramProjectHarness.changeStoredRow(
				"a",
				"publication-attempts",
				attemptId,
				patches[missing],
			);
		}, missing);
		const before = await page.evaluate(() =>
			window.__telegramProjectHarness.protocolSnapshot("a"),
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
				window.__telegramProjectHarness.protocolSnapshot("a"),
			),
		).toEqual(before);
	});
}

test("TMA-PROJECT-26: a complete interrupted history attempt retains its original creation receipt and retries exactly", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__telegramProjectHarness.create("a", "a", "owner-a"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.publishFixture("a", "p1", "r2", "r1"),
	);
	await page.evaluate(() =>
		window.__telegramProjectHarness.abortNextProjectPointer(),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.existingRevision(
				"a",
				"a",
				"r1",
				"r2",
				"history",
			),
		),
	).toMatchObject({ kind: "persist-failed" });
	const revisions = await page.evaluate(() =>
		window.__telegramProjectHarness.rows("a", "revisions"),
	);
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.access("a", "p1"),
		),
	).toMatchObject({ kind: "writable", fencingToken: 1 });
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.existingRevision(
				"a",
				"a",
				"r1",
				"r2",
				"history",
			),
		),
	).toEqual({ kind: "durable" });
	expect(
		await page.evaluate(() => window.__telegramProjectHarness.load("a", "p1")),
	).toMatchObject({
		kind: "durable",
		candidate: { revision: { revisionId: "r1" } },
	});
	expect(
		await page.evaluate(() =>
			window.__telegramProjectHarness.rows("a", "revisions"),
		),
	).toEqual(revisions);
});
