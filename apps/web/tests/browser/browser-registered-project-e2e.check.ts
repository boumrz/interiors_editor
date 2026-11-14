import { expect, test } from "@playwright/test";
import type {} from "./browser-registered-project-harness";

const databaseName = "interiors-editor-browser-registered";
const failedRevision = "22222222-2222-4222-8222-222222222222";
test.beforeEach(async ({ page }, info) => {
	await page.goto("/");
	expect(
		await page.evaluate(
			() => Reflect.get(globalThis, "__stryker__")?.activeMutant,
		),
	).toBe(info.project.metadata.activeMutant);
	await page.evaluate(() =>
		window.__browserRegisteredProjectHarness.create("a", "owner-a"),
	);
});
test("BROWSER-PROJECT-01: native browser profile publishes through the shared kernel without touching the real existing Web Project", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		const legacy = await h.seedLegacy("Existing browser Project"),
			before = await h.snapshotAll();
		const absent = await h.probe("a"),
			namesBefore = await h.names();
		await h.provision("a");
		const result = await h.createProject("a", "Private browser Project"),
			after = await h.snapshotAll();
		return {
			legacy,
			before,
			absent,
			namesBefore,
			result,
			after,
			directory: await h.list("a"),
			durability: h.durability(),
		};
	});
	expect(actual.legacy.result.kind).toBe("durable");
	expect(actual.absent).toEqual({
		kind: "not-provisioned",
		history: "unknown",
	});
	expect(actual.namesBefore).not.toContain(databaseName);
	expect(actual.result.kind).toBe("durable");
	expect(
		actual.after.filter((database) => database.name !== databaseName),
	).toEqual(actual.before);
	expect(actual.directory).toMatchObject({
		kind: "populated",
		projects: [{ name: "Private browser Project" }],
	});
	expect(actual.durability.length).toBeGreaterThan(0);
	expect(actual.durability.every((value) => value === "strict")).toBe(true);
	const privateDatabase = actual.after.find(
		(database) => database.name === databaseName,
	);
	expect(privateDatabase?.version).toBe(1);
	const journals = privateDatabase?.rows.find(
		(store) => store.name === "publication-attempts",
	)?.rows;
	expect(journals).toHaveLength(1);
	expect(journals?.[0]).toMatchObject({
		scope: "browser-registered-v1",
		state: "published",
		attemptId: "browser-registered-v1:attempt:1",
	});
});

test("BROWSER-PROJECT-02: two native contexts preserve one fenced writer and a stale context cannot publish after explicit takeover", async ({
	page,
	context,
}) => {
	const created = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		await h.provision("a");
		return h.createProject("a", "Original");
	});
	if (created.kind !== "durable")
		throw new Error("Expected initial Durable Revision");
	const other = await context.newPage();
	await other.goto("/");
	await other.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		h.create("b", "owner-b");
		await h.provision("b");
	});
	expect(
		await other.evaluate(
			(id) => window.__browserRegisteredProjectHarness.access("b", id),
			created.projectId,
		),
	).toEqual({ kind: "read-only", reasonCode: "WRITER_LEASE_HELD" });
	expect(
		await other.evaluate(
			(id) =>
				window.__browserRegisteredProjectHarness.rename("b", id, "Unconfirmed"),
			created.projectId,
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await other.evaluate(
			(id) => window.__browserRegisteredProjectHarness.takeover("b", id),
			created.projectId,
		),
	).toEqual({ kind: "writable", fencingToken: 2 });
	expect(
		await other.evaluate(
			(id) =>
				window.__browserRegisteredProjectHarness.rename("b", id, "New owner"),
			created.projectId,
		),
	).toMatchObject({ kind: "durable" });
	expect(
		await page.evaluate(
			(id) =>
				window.__browserRegisteredProjectHarness.rename(
					"a",
					id,
					"Late old writer",
				),
			created.projectId,
		),
	).toMatchObject({ kind: "persist-failed" });
	expect(
		await page.evaluate(
			(id) => window.__browserRegisteredProjectHarness.load("a", id),
			created.projectId,
		),
	).toMatchObject({
		kind: "durable",
		candidate: { project: { name: "New owner" } },
	});
});

test("BROWSER-PROJECT-03: aborting a real pointer put keeps the previous Project and explicit takeover cleans only the prepared attempt", async ({
	page,
}) => {
	const actual = await page.evaluate(async (revisionId) => {
		const h = window.__browserRegisteredProjectHarness;
		await h.provision("a");
		const initial = await h.createProject("a", "R1");
		if (initial.kind !== "durable") throw new Error("Missing R1");
		const aborted = await h.abortPointerRename(
				"a",
				initial.projectId,
				"Failed R2",
				revisionId,
			),
			held = await h.load("a", initial.projectId);
		h.create("b", "owner-b");
		await h.provision("b");
		const takeover = await h.takeover("b", initial.projectId),
			after = await h.snapshotAll();
		return {
			initial,
			aborted,
			held,
			takeover,
			after,
			current: await h.load("b", initial.projectId),
		};
	}, failedRevision);
	expect(actual.aborted).toMatchObject({
		aborted: true,
		result: { kind: "persist-failed" },
	});
	expect(actual.held).toMatchObject({
		kind: "durable",
		candidate: {
			project: { name: "R1" },
			revision: {
				revisionId:
					actual.initial.kind === "durable"
						? actual.initial.revisionId
						: "missing",
			},
		},
	});
	expect(actual.takeover).toEqual({ kind: "writable", fencingToken: 2 });
	expect(actual.current).toEqual(actual.held);
	const rows = actual.after.find(
		(database) => database.name === databaseName,
	)?.rows;
	expect(rows?.find((store) => store.name === "staging")?.rows).toEqual([]);
	expect(rows?.find((store) => store.name === "revisions")?.rows).toHaveLength(
		1,
	);
	expect(
		rows?.find((store) => store.name === "publication-attempts")?.rows,
	).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				revisionId: failedRevision,
				state: "no-publish",
			}),
		]),
	);
});

test("BROWSER-PROJECT-04: exact owned historical Revision remains a valid history target", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		await h.provision("a");
		const first = await h.createProject("a", "R1");
		if (first.kind !== "durable") throw new Error("Missing R1");
		const second = await h.rename("a", first.projectId, "R2");
		if (second.kind !== "durable") throw new Error("Missing R2");
		const history = await h.history("a", first.revisionId, second.revisionId);
		return { history, current: await h.load("a", first.projectId) };
	});
	expect(actual.history).toEqual({ kind: "durable" });
	expect(actual.current).toMatchObject({
		kind: "durable",
		candidate: { project: { name: "R1" } },
	});
});

test("BROWSER-PROJECT-05: retained no-publish journal prevents reusing its Project and Revision identity for different content", async ({
	page,
}) => {
	const actual = await page.evaluate(async (revisionId) => {
		const h = window.__browserRegisteredProjectHarness;
		await h.provision("a");
		const first = await h.createProject("a", "R1");
		if (first.kind !== "durable") throw new Error("Missing R1");
		const failed = await h.abortPointerRename(
			"a",
			first.projectId,
			"Failed R2",
			revisionId,
		);
		h.create("b", "owner-b");
		await h.provision("b");
		const takeover = await h.takeover("b", first.projectId),
			before = await h.snapshotAll();
		const reused = await h.rename(
				"b",
				first.projectId,
				"Different candidate",
				revisionId,
			),
			after = await h.snapshotAll();
		return {
			failed,
			takeover,
			reused,
			before,
			after,
			current: await h.load("b", first.projectId),
		};
	}, failedRevision);
	expect(actual.failed.result.kind).toBe("persist-failed");
	expect(actual.takeover.kind).toBe("writable");
	expect(actual.reused.kind).toBe("persist-failed");
	expect(actual.current).toMatchObject({
		kind: "durable",
		candidate: { project: { name: "R1" } },
	});
	const beforeRows = actual.before.find(
		(database) => database.name === databaseName,
	)?.rows;
	const afterRows = actual.after.find(
		(database) => database.name === databaseName,
	)?.rows;
	for (const name of [
		"projects",
		"revisions",
		"staging",
		"publication-attempts",
	])
		expect(afterRows?.find((store) => store.name === name)).toEqual(
			beforeRows?.find((store) => store.name === name),
		);
});

test("BROWSER-PROJECT-06: pair identity does not invent a global forever Revision-ID ban after explicit Project deletion", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		await h.provision("a");
		const first = await h.createProject("a", "Deleted Project");
		if (first.kind !== "durable") throw new Error("Missing first Project");
		const deleted = await h.deleteProject("a", first.projectId);
		const next = await h.createProject("a", "Other Project", [
			"33333333-3333-4333-8333-333333333333",
			"44444444-4444-4444-8444-444444444444",
			first.revisionId,
		]);
		return { deleted, next };
	});
	expect(actual.deleted).toEqual({ kind: "permanently-deleted" });
	expect(actual.next).toMatchObject({
		kind: "durable",
		projectId: "44444444-4444-4444-8444-444444444444",
	});
});

test("BROWSER-KEY-01: an absent current store is queried without creating a database or granting a writable capability", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		const legacy = await h.probeKey("legacy", "candidate"),
			registered = await h.probeKey("browser-registered", "candidate");
		return { legacy, registered, names: await h.names() };
	});
	expect(actual).toEqual({
		legacy: { kind: "free" },
		registered: { kind: "free" },
		names: [],
	});
});
test("BROWSER-KEY-02: direct legacy pointer keys include unreadable rows and remain exact/case-sensitive", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		await h.seedLegacy("Existing");
		await h.corruptLegacyPointer("CaseSensitive-ID");
		const before = await h.snapshotAll();
		return {
			before,
			present: await h.probeKey("legacy", "CaseSensitive-ID"),
			other: await h.probeKey("legacy", "casesensitive-id"),
			after: await h.snapshotAll(),
		};
	});
	expect(actual.present).toEqual({ kind: "occupied" });
	expect(actual.other).toEqual({ kind: "free" });
	expect(actual.after).toEqual(actual.before);
});
test("BROWSER-KEY-03: the same raw ID has independently queried browser storage owners", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		await h.provision("a");
		const created = await h.createProject("a", "Private");
		if (created.kind !== "durable") throw new Error("Missing private Project");
		const before = await h.snapshotAll();
		return {
			private: await h.probeKey("browser-registered", created.projectId),
			legacy: await h.probeKey("legacy", created.projectId),
			before,
			after: await h.snapshotAll(),
		};
	});
	expect(actual.private).toEqual({ kind: "occupied" });
	expect(actual.legacy).toEqual({ kind: "free" });
	expect(actual.after).toEqual(actual.before);
});
test("BROWSER-KEY-04: a cancelled lookup does not issue an IndexedDB request", async ({
	page,
}) => {
	expect(
		await page.evaluate(() =>
			window.__browserRegisteredProjectHarness.cancelledKey(
				"legacy",
				"candidate",
			),
		),
	).toEqual({ result: { kind: "unavailable" }, opens: 0 });
});

test("BROWSER-KEY-05: a provider's real attempted upgrade is aborted and never misclassified as absent/free", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		await h.seedLegacy("Existing");
		const before = await h.snapshotAll();
		return {
			before,
			outcome: await h.probeKeyFault("legacy", "candidate", "upgrade"),
			after: await h.snapshotAll(),
		};
	});
	expect(actual.outcome).toEqual({
		result: { kind: "unavailable" },
		handles: 0,
	});
	expect(actual.after).toEqual(actual.before);
});
for (const fault of ["cancel", "timeout"] as const) {
	test(`BROWSER-KEY-06-${fault}: abandoned native open closes its own late handle and preserves existing data`, async ({
		page,
	}) => {
		const actual = await page.evaluate(async (fault) => {
			const h = window.__browserRegisteredProjectHarness;
			await h.seedLegacy("Existing");
			const before = await h.snapshotAll();
			return {
				before,
				outcome: await h.probeKeyFault("legacy", "candidate", fault),
				after: await h.snapshotAll(),
			};
		}, fault);
		expect(actual.outcome).toEqual({
			result: { kind: "unavailable" },
			handles: 0,
		});
		expect(actual.after).toEqual(actual.before);
	});
}
test("BROWSER-KEY-07: unknown existing schema is unavailable, preserved, and never reset into an empty known scope", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		await h.foreignPrivateDatabase();
		const before = await h.snapshotAll();
		return {
			before,
			result: await h.probeKey("browser-registered", "candidate"),
			after: await h.snapshotAll(),
		};
	});
	expect(actual.result).toEqual({ kind: "unavailable" });
	expect(actual.after).toEqual(actual.before);
});

test("BROWSER-RUNTIME-01: actual private composition remains existing-only until explicit validated import, then ordinary edit/history and both file formats use its own native storage", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		h.createRuntime("private");
		const before = await h.names();
		const started = await h.startRuntime("private");
		const directory = await h.runtimeDirectory("private");
		const refused = await h.runtimeOrdinaryCreate("private");
		const beforeImport = await h.names();
		const imported = await h.runtimeImport("private", "Imported native");
		const importedState = h.runtimeState("private");
		const rename = await h.runtimeRename("private", "Edited native");
		const editedState = h.runtimeState("private");
		const undo = await h.runtimeUndo("private");
		const undoneState = h.runtimeState("private");
		const legacy = await h.runtimeExport("private", false);
		const wire = await h.runtimeExport("private", true);
		const listed = await h.runtimeDirectory("private");
		await h.runtimeClose("private");
		return {
			before,
			started,
			directory,
			refused,
			beforeImport,
			imported,
			importedState,
			rename,
			editedState,
			undo,
			undoneState,
			legacy,
			wire,
			listed,
			names: await h.names(),
		};
	});
	expect(actual.before).toEqual([]);
	expect(actual.started).toEqual({ kind: "writable" });
	expect(actual.directory).toEqual({
		kind: "not-provisioned",
		history: "unknown",
	});
	expect(actual.refused).toEqual({ kind: "not-ready" });
	expect(actual.beforeImport).toEqual([]);
	expect(actual.imported.kind).toBe("durable");
	expect(actual.importedState).toMatchObject({
		kind: "saved",
		project: { name: "Imported native" },
	});
	expect(actual.rename.kind).toBe("durable");
	expect(actual.editedState).toMatchObject({
		kind: "saved",
		project: { name: "Edited native" },
	});
	expect(actual.undo.kind).toBe("durable");
	expect(actual.undoneState).toMatchObject({
		kind: "saved",
		project: { name: "Imported native" },
	});
	expect(actual.legacy).toMatchObject({
		kind: "ready",
		decoded: { kind: "accepted" },
	});
	expect(actual.wire).toMatchObject({
		kind: "ready",
		decoded: { kind: "accepted", projectMember: { format: "runtime-v1-wire" } },
	});
	expect(actual.listed).toMatchObject({
		kind: "available",
		directory: { kind: "populated", projects: [{ name: "Imported native" }] },
	});
	expect(actual.names).toEqual([databaseName]);
});

test("BROWSER-RUNTIME-02: actual private ordinary Room/model/library commands keep legacy backup representability and a real registered reimport retains exact shared pinned bytes under a new Project", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		h.createRuntime("private");
		await h.startRuntime("private");
		const imported = await h.runtimeImport("private", "Private resource A");
		const placed = await h.runtimeConfigureAndPlace("private");
		const legacy = await h.runtimeExport("private", false),
			wire = await h.runtimeExport("private", true);
		const reimported = await h.runtimeReimportOwnWire("private");
		const directory = await h.runtimeDirectory("private"),
			all = await h.snapshotAll();
		await h.runtimeClose("private");
		return { imported, placed, legacy, wire, reimported, directory, all };
	});
	expect(actual.imported.kind).toBe("durable");
	expect(actual.placed.room.kind).toBe("durable");
	expect(actual.placed.library.kind).toBe("registered");
	expect(actual.placed.placed.kind).toBe("durable");
	expect(actual.placed.readBytes).toEqual(actual.placed.sourceBytes);
	expect(actual.placed.actualDigest).toBe(actual.placed.resourceHash);
	expect(actual.placed.state).toMatchObject({
		kind: "saved",
		project: {
			assetDefinitionRefs: [{ resourceHash: actual.placed.resourceHash }],
			assetInstances: [{ anchorClass: "floor" }],
		},
	});
	expect(actual.legacy).toMatchObject({
		kind: "ready",
		decoded: { kind: "accepted" },
	});
	expect(actual.wire).toMatchObject({
		kind: "ready",
		decoded: { kind: "accepted", projectMember: { format: "runtime-v1-wire" } },
	});
	expect(actual.reimported.imported?.kind).toBe("durable");
	expect(actual.reimported.readBytes).toEqual(actual.placed.sourceBytes);
	if (
		actual.imported.kind !== "durable" ||
		actual.reimported.imported?.kind !== "durable"
	)
		throw new Error("Missing actual Projects");
	expect(actual.reimported.imported.projectId).not.toBe(
		actual.imported.projectId,
	);
	expect(actual.directory).toMatchObject({
		kind: "available",
		directory: { kind: "populated" },
	});
	if (
		actual.directory.kind !== "available" ||
		actual.directory.directory.kind !== "populated"
	)
		throw new Error("Missing actual directory");
	expect(actual.directory.directory.projects).toHaveLength(2);
	expect(actual.all.map((db) => db.name)).toEqual([databaseName]);
	const resources = actual.all[0].rows.find(
		(store) => store.name === "resources",
	)?.rows;
	expect(resources).toHaveLength(1);
});

test("BROWSER-RUNTIME-03: a detected future private schema stays explicitly recovery-required and never re-admits or changes retained native rows", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		h.createRuntime("first");
		await h.startRuntime("first");
		await h.runtimeImport("first", "Preserved private Project");
		await h.runtimeClose("first");
		await h.futurePrivateVersion();
		const before = await h.snapshotAll();
		h.createRuntime("future");
		const startup = await h.startRuntime("future"),
			directory = await h.runtimeDirectory("future");
		let refused = false;
		try {
			await h.runtimeImport("future", "Must not replace preserved data");
		} catch {
			refused = true;
		}
		const after = await h.snapshotAll();
		await h.runtimeClose("future");
		return { before, startup, directory, refused, after };
	});
	expect(actual.startup).toEqual({
		kind: "read-only/exportable",
		recovery: {},
	});
	expect(actual.directory).toEqual({ kind: "recovery-required" });
	expect(actual.refused).toBe(true);
	expect(actual.after).toEqual(actual.before);
});

test("BROWSER-RUNTIME-04: a held real scope lock yields bounded coalesced directory unavailability without creating DB or revoking the healthy generation", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		h.createRuntime("busy", 100);
		await h.startRuntime("busy");
		const before = h.runtimeCounts("busy");
		await h.holdScopeLock();
		try {
			const unavailable = await Promise.all([
				h.runtimeDirectory("busy"),
				h.runtimeDirectory("busy"),
				h.runtimeDirectory("busy"),
			]);
			const during = h.runtimeCounts("busy"),
				names = await h.names();
			const completing = h.runtimeDirectory("busy");
			const released = h.releaseScopeLock();
			const recovered = await completing;
			await released;
			const after = h.runtimeCounts("busy"),
				imported = await h.runtimeImport("busy", "After transient busy");
			await h.runtimeClose("busy");
			return { before, during, after, names, unavailable, recovered, imported };
		} finally {
			await h.releaseScopeLock();
		}
	});
	expect(actual.unavailable).toEqual([
		{ kind: "unavailable" },
		{ kind: "unavailable" },
		{ kind: "unavailable" },
	]);
	expect(actual.names).toEqual([]);
	expect(actual.during.opens).toBe(actual.before.opens);
	expect(actual.during.locks).toBe((actual.before.locks ?? 0) + 1);
	expect(actual.after.opens).toBe((actual.before.opens ?? 0) + 1);
	expect(actual.after.locks).toBe((actual.before.locks ?? 0) + 1);
	expect(actual.recovered).toEqual({
		kind: "not-provisioned",
		history: "unknown",
	});
	expect(actual.imported.kind).toBe("durable");
});
test("BROWSER-RUNTIME-05: disposing a timed-out queued directory aborts only its real pending lock request and drains before the unrelated holder releases", async ({
	page,
}) => {
	const actual = await page.evaluate(async () => {
		const h = window.__browserRegisteredProjectHarness;
		h.createRuntime("closing", 100);
		await h.startRuntime("closing");
		await h.holdScopeLock();
		let watchdog: ReturnType<typeof setTimeout> | undefined;
		try {
			const directory = await h.runtimeDirectory("closing");
			const closed = await Promise.race([
				h.runtimeClose("closing").then(() => true),
				new Promise<false>((resolve) => {
					watchdog = setTimeout(() => resolve(false), 2000);
				}),
			]);
			return {
				directory,
				closed,
				holderStillHeld: h.scopeHeld(),
				names: await h.names(),
			};
		} finally {
			if (watchdog !== undefined) clearTimeout(watchdog);
			await h.releaseScopeLock();
		}
	});
	expect(actual.directory).toEqual({ kind: "unavailable" });
	expect(actual.closed).toBe(true);
	expect(actual.holderStillHeld).toBe(true);
	expect(actual.names).toEqual([]);
});

test("BROWSER-RUNTIME-06: actual two-source facade keeps legacy untouched during private import and qualifies future equal raw Project/Revision IDs with stale UI capability rejection", async ({
	page,
}) => {
	const actual = await page.evaluate(() =>
		window.__browserRegisteredProjectHarness.actualCoexistence(),
	);
	expect(actual.startup).toEqual({ kind: "writable" });
	expect(actual.privateReady).toEqual({
		kind: "not-provisioned",
		history: "unknown",
	});
	expect(actual.legacyAfter).toEqual(actual.legacyBefore);
	expect(actual.first.projectId).not.toBe(actual.imported.projectId);
	expect(actual.colliding.projectId).toBe(actual.imported.projectId);
	expect(actual.colliding.revisionId).toBe(actual.imported.revisionId);
	expect(actual.allocated).toBe(3);
	expect(actual.privateKey).not.toBe(actual.legacyKey);
	expect(actual.stale.kind).not.toBe("durable");
	expect(actual.afterStale).toEqual(actual.beforeStale);
	expect(actual.directory).toMatchObject({ kind: "projects" });
	if (actual.directory.kind !== "projects")
		throw new Error("Missing actual merged directory");
	expect(actual.directory.projects).toHaveLength(3);
	const colliding = actual.directory.projects.filter(
		(row) => row.projectId === actual.imported.projectId,
	);
	expect(colliding.map((row) => row.storageNamespace).sort()).toEqual([
		"browser-registered",
		"legacy",
	]);
	expect(actual.privateState).toMatchObject({
		kind: "saved",
		project: { projectId: actual.imported.projectId, name: "Actual private B" },
		revisionId: actual.imported.revisionId,
	});
	expect(actual.legacyState).toMatchObject({
		kind: "saved",
		project: {
			projectId: actual.imported.projectId,
			name: "Future legacy same raw IDs",
		},
		revisionId: actual.imported.revisionId,
	});
	expect(actual.openedPrivate.owner).toBe("browser-registered");
	expect(actual.openedLegacy.owner).toBe("legacy");
	expect(actual.openedPrivate.key).not.toBe(actual.openedLegacy.key);
	expect(actual.exports).toEqual([
		{ owner: "browser-registered", name: "Actual private B" },
		{ owner: "legacy", name: "Future legacy same raw IDs" },
	]);
});

test("BROWSER-RUNTIME-07: retained old empty file imports in the real legacy context, qualified directory exports wire, and strict Telegram imports a new exact empty Project", async ({
	page,
}) => {
	const actual = await page.evaluate(() =>
		window.__browserRegisteredProjectHarness.actualEmptyLegacyBridge(),
	);
	expect(actual.startup).toEqual({ kind: "writable" });
	expect(actual.telegramStartup).toEqual({ kind: "writable" });
	expect(actual.oldDecodedKind).toBe("accepted");
	expect(actual.original.projectId).not.toBe(actual.bridged.projectId);
	expect(actual.imported.projectId).not.toBe(actual.original.projectId);
	expect(actual.imported.projectId).not.toBe(actual.bridged.projectId);
	expect(actual.oldDigestAfter).toBe(actual.oldDigest);
	expect(actual.directory).toMatchObject({ kind: "projects" });
	if (actual.directory.kind !== "projects")
		throw new Error("Missing real qualified directory");
	expect(
		actual.directory.projects.map((row) => ({
			id: row.projectId,
			owner: row.storageNamespace,
		})),
	).toEqual(
		expect.arrayContaining([
			{ id: actual.original.projectId, owner: "legacy" },
			{ id: actual.bridged.projectId, owner: "legacy" },
		]),
	);
	const originalBefore = actual.beforeLegacyImport
		.flatMap((db) => db.rows.flatMap((store) => store.rows))
		.filter(
			(row) =>
				row &&
				typeof row === "object" &&
				"projectId" in row &&
				row.projectId === actual.original.projectId,
		);
	const originalAfter = actual.afterLegacyImport
		.flatMap((db) => db.rows.flatMap((store) => store.rows))
		.filter(
			(row) =>
				row &&
				typeof row === "object" &&
				"projectId" in row &&
				row.projectId === actual.original.projectId,
		);
	expect(originalAfter).toEqual(originalBefore);
	expect(actual.afterWireExport).toEqual(actual.beforeWireExport);
	expect(actual.directOld).toEqual({
		kind: "rejected",
		reasonCode: "BACKUP_SCHEMA_UNREADABLE",
	});
	expect(actual.afterStrictOld).toEqual(actual.beforeStrictOld);
	expect(actual.wireDecoded).toMatchObject({
		kind: "accepted",
		projectMember: { format: "runtime-v1-wire", project: actual.bridge },
		resources: [],
	});
	expect(actual.semantics[1]).toEqual(actual.semantics[0]);
	expect(actual.semantics[2]).toEqual(actual.semantics[0]);
	for (const project of [actual.source, actual.bridge, actual.target]) {
		expect(project.level.vertices).toEqual([]);
		expect(project.level.wallSegments).toEqual([]);
		expect(project.level.rooms).toEqual([]);
		expect(project.level.openings).toEqual([]);
		expect(project.assetInstances).toEqual([]);
		expect(project.assetDefinitionRefs).toEqual([]);
	}
	expect(actual.legacyAfterTelegram).toEqual(actual.afterWireExport);
	expect(
		actual.telegramDatabase?.rows.find((store) => store.name === "projects")
			?.rows,
	).toHaveLength(1);
	expect(
		actual.telegramDatabase?.rows.find((store) => store.name === "revisions")
			?.rows,
	).toHaveLength(1);
	expect(
		actual.telegramDatabase?.rows.find((store) => store.name === "resources")
			?.rows,
	).toEqual([]);
});
