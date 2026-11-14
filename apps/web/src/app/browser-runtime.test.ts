// @ts-nocheck
import { expect, it, rs } from "@rstest/core";
import {
	DurableProjectRepository,
	MemoryVersionedProjectStore,
} from "../adapters/persistence/durable-project-repository";
import { FencedProjectRepository } from "../adapters/persistence/fenced-project-repository";
import { FflatePortableBackupDecoder } from "../adapters/portable-backup/fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../adapters/portable-backup/portable-backup-read-render-smoke";
import { createInitialProject } from "../domain/initial-project";
import { encodeLocalProjectJson } from "../domain/project-json-transfer";
import type { BrowserRegisteredRuntime } from "./browser-registered-runtime";
import { createBrowserRuntime } from "./browser-runtime";
import type {
	ReleaseStartupInput,
	ReleaseStartupOutcome,
} from "./release-startup";
import { createSharedProjectController } from "./shared-project-controller";

const instant = "2026-11-05T00:00:00.000Z";
const manifest = {
	version: 1,
	workerProtocolVersion: 1,
	appBuildId: "browser-unit-contract",
	minimumCapabilities: ["indexeddb", "webgl2"],
	projectSchemas: { readable: [1], writable: [1] },
	assetSchemas: { readable: [1], writable: [1] },
	catalogSchemas: { readable: [1], writable: [1] },
};
const input = (): ReleaseStartupInput => ({
	shellManifest: structuredClone(manifest),
	hasControllingWorker: false,
	workerManifest: undefined,
	capabilities: { indexeddb: true, webgl2: true },
});
function core() {
	const binaryChecksum = {
		sha256Bytes: async (bytes: Uint8Array) =>
			[
				...new Uint8Array(
					await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
				),
			]
				.map((v) => v.toString(16).padStart(2, "0"))
				.join(""),
	};
	const checksum = {
		sha256: (text: string) =>
			binaryChecksum.sha256Bytes(new TextEncoder().encode(text)),
	};
	const store = new MemoryVersionedProjectStore();
	const repository = new FencedProjectRepository(
		new DurableProjectRepository(store, checksum.sha256),
		store,
		"actual-memory-owner",
	);
	let inspected = 0;
	const inspect = repository.inspectWriterAccess.bind(repository);
	repository.inspectWriterAccess = (id) => {
		inspected++;
		return inspect(id);
	};
	const shared = createSharedProjectController({
		repository,
		checksum,
		binaryChecksum,
		ids: { next: () => crypto.randomUUID() },
		clock: { now: () => instant },
		storageEstimate: { estimateStorage: async () => ({}) },
		resources: {
			read: async () => undefined,
			delete: async () => {},
			writeIfAbsent: async () => ({ kind: "stored" }),
		},
		library: {
			list: async () => [],
			register: async (asset) => ({ kind: "registered", asset }),
		},
		pinStaging: {
			requiresPublicationContext: true,
			begin: async () => {
				throw new Error("No resources");
			},
			markForPublication: async () => {},
			complete: async () => {},
			discard: async () => {},
		},
		portable: {
			encoder: new FflatePortableBackupEncoder(),
			decoder: new FflatePortableBackupDecoder(binaryChecksum),
			smoke: new PortableBackupReadRenderSmokeCheck({
				checksum: binaryChecksum,
			}),
		},
	});
	return { ...shared, repository, checksum, inspected: () => inspected };
}
function fixture(
	legacyKind: ReleaseStartupOutcome["kind"] = "writable",
	privateKind: ReleaseStartupOutcome["kind"] = "read-only/exportable",
	read: () => Promise<ReleaseStartupInput> = async () => input(),
	recovery: import("./release-startup").ReleaseRecoveryRecord = {},
	startupTimeoutMs?: number,
	readonlyProjects?: import("./browser-readonly-projects").BrowserReadonlyProjectsRuntime,
) {
	const legacy = core(),
		privateCore = core();
	let legacyHandshakes = 0,
		privateDisposals = 0;
	const registered: BrowserRegisteredRuntime = {
		controller: privateCore.controller,
		readDirectory: async () =>
			privateKind === "writable"
				? {
						kind: "available",
						directory: await privateCore.repository.listProjects(),
					}
				: { kind: "unavailable" },
		dispose: async () => {
			privateDisposals++;
		},
		readReleaseStartupInput: async () => input(),
		releaseStartup: {
			handshake: async () =>
				privateKind === "writable"
					? { kind: "writable" }
					: { kind: "read-only/exportable", recovery: {} },
		},
	};
	const legacyStartup: import("./production-app").ProductionAppRuntime["releaseStartup"] =
		{
			handshake: async () => {
				legacyHandshakes++;
				return legacyKind === "writable"
					? { kind: "writable" }
					: legacyKind === "migration-in-progress"
						? { kind: "migration-in-progress" }
						: { kind: "read-only/exportable", recovery };
			},
		};
	let runtime: ReturnType<typeof createBrowserRuntime> | undefined;
	expect(() => {
		runtime = createBrowserRuntime({
			legacy: {
				controller: legacy.controller,
				releaseStartup: legacyStartup,
			},
			registered,
			readReleaseStartupInput: read,
			startupTimeoutMs,
			...(readonlyProjects ? { readonlyProjects } : {}),
		});
	}).not.toThrow();
	expect(runtime).toMatchObject({
		releaseStartup: { handshake: expect.any(Function) },
		navigationProtection: {
			discardWriterRecoveryAndShowProjects: expect.any(Function),
		},
	});
	if (runtime === undefined)
		throw new Error("Unreachable after runtime contract assertion");
	return {
		runtime,
		legacy,
		legacyStartup,
		registered,
		privateCore,
		legacyHandshakes: () => legacyHandshakes,
		privateDisposals: () => privateDisposals,
	};
}
async function directoryCompleted<T>(operation: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const result = await Promise.race([
			operation.then((value) => ({ kind: "completed" as const, value }), (reason) => ({kind:"rejected" as const, reason})),
			new Promise<{ kind: "pending" }>((resolve) => {
				timer = setTimeout(() => resolve({ kind: "pending" }), 2000);
			}),
		]);
		expect(result.kind, "controlled public directory operation completes").toBe(
			"completed",
		);
		if (result.kind !== "completed")
			throw Error("Directory completion assertion failed");
		return result.value;
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
it("a private-first startup publishes its healthy rows immediately and still adds legacy rows when that source is admitted", async () => {
	const f = fixture("writable", "writable"),
		legacyAdmission = held<ReleaseStartupOutcome>();
	await f.legacy.controller.create("Legacy after admission");
	await f.privateCore.controller.create("Private immediately");
	f.legacyStartup.handshake = () => legacyAdmission.promise;
	let stopPrivate = () => {},
		stopLegacy = () => {};
	const privateShown = new Promise<void>((resolve) => {
		stopPrivate = f.runtime.controller.subscribe((state) => {
			if (
				state.kind === "projects" &&
				state.projects.some((row) => row.name === "Private immediately")
			)
				resolve();
		});
	});
	const legacyWritable = new Promise<void>((resolve) => {
		stopLegacy = f.runtime.subscribeStartupSources(() => {
			if (f.runtime.canCreateLegacyProject()) resolve();
		});
	});
	try {
		expect(
			await directoryCompleted(f.runtime.releaseStartup.handshake(input())),
		).toEqual({ kind: "writable" });
		const reading = f.runtime.controller.open();
		await directoryCompleted(privateShown);
		expect(f.runtime.controller.snapshot()).toMatchObject({
			kind: "projects",
			projects: [
				{ name: "Private immediately", storageNamespace: "browser-registered" },
			],
		});
		legacyAdmission.resolve({ kind: "writable" });
		await directoryCompleted(legacyWritable);
		await directoryCompleted(reading);
		expect(f.runtime.controller.snapshot()).toMatchObject({
			kind: "projects",
			projects: [
				{ name: "Legacy after admission", storageNamespace: "legacy" },
				{ name: "Private immediately", storageNamespace: "browser-registered" },
			],
		});
		await directoryCompleted(f.runtime.dispose());
	} finally {
		stopPrivate();
		stopLegacy();
		legacyAdmission.resolve({ kind: "read-only/exportable", recovery: {} });
		void f.runtime.dispose().catch(() => undefined);
	}
});

it("a held legacy directory has a bounded unavailable result while the healthy private directory remains visible", async () => {
	rs.useFakeTimers();
	const f = fixture("writable", "writable", undefined, undefined, 7),
		heldLegacy = held<ReleaseStartupOutcome>();
	f.legacyStartup.handshake = () => heldLegacy.promise;
	let opened = false;
	try {
		const startup = f.runtime.releaseStartup.handshake(input());
		await rs.advanceTimersByTimeAsync(0);
		expect(await startup).toEqual({ kind: "writable" });
		const opening = f.runtime.controller.open().then(() => {
			opened = true;
		});
		await rs.advanceTimersByTimeAsync(0);
		expect(f.runtime.controller.snapshot()).toMatchObject({
			kind: "projects",
			storageSources: [
				{ storageNamespace: "legacy", kind: "unavailable" },
				{ storageNamespace: "browser-registered", kind: "available" },
			],
		});
		expect(opened).toBe(false);
		await rs.advanceTimersByTimeAsync(6);
		expect(opened).toBe(false);
		await rs.advanceTimersByTimeAsync(1);
		expect(opened).toBe(true);
		await opening;
		heldLegacy.resolve({ kind: "read-only/exportable", recovery: {} });
		await rs.advanceTimersByTimeAsync(0);
		await directoryCompleted(f.runtime.dispose());
	} finally {
		heldLegacy.resolve({ kind: "read-only/exportable", recovery: {} });
		void f.runtime.dispose().catch(() => undefined);
		await rs.advanceTimersByTimeAsync(0);
		rs.clearAllTimers();
		rs.useRealTimers();
	}
});
it("disposal releases a pending legacy directory without entering the old Core after late admission", async () => {
	rs.useFakeTimers();
	const f = fixture("writable", "writable", undefined, undefined, 7),
		heldLegacy = held<ReleaseStartupOutcome>(),
		coreOpen = rs.spyOn(f.legacy.controller, "open");
	f.legacyStartup.handshake = () => heldLegacy.promise;
	try {
		const startup = f.runtime.releaseStartup.handshake(input());
		await rs.advanceTimersByTimeAsync(0);
		await startup;
		let readingComplete = false;
  const reading = f.runtime.controller.open().then(()=>{readingComplete=true;});
		await rs.advanceTimersByTimeAsync(0);
		const closing = f.runtime.dispose();
		await rs.advanceTimersByTimeAsync(0);
		expect(readingComplete).toBe(true);
  await reading;
		expect(coreOpen).not.toHaveBeenCalled();
		heldLegacy.resolve({ kind: "writable" });
		await rs.advanceTimersByTimeAsync(0);
		await directoryCompleted(closing);
		expect(coreOpen).not.toHaveBeenCalled();
		expect(rs.getTimerCount()).toBe(0);
	} finally {
		heldLegacy.resolve({ kind: "read-only/exportable", recovery: {} });
		void f.runtime.dispose().catch(() => undefined);
		await rs.advanceTimersByTimeAsync(0);
		rs.clearAllTimers();
		rs.useRealTimers();
	}
});
it("a superseded directory cannot use a newer legacy admission to enter the old Core", async () => {
	rs.useFakeTimers();
	const f = fixture("writable", "writable", undefined, undefined, 7),
		old = held<ReleaseStartupOutcome>(),
		coreOpen = rs.spyOn(f.legacy.controller, "open");
	let starts = 0;
	f.legacyStartup.handshake = () =>
		++starts === 1 ? old.promise : Promise.resolve({ kind: "writable" });
	try {
		const first = f.runtime.releaseStartup.handshake(input());
		await rs.advanceTimersByTimeAsync(0);
		await first;
		const reading = f.runtime.controller.open();
		await rs.advanceTimersByTimeAsync(0);
		const newer = f.runtime.releaseStartup.handshake(input());
		await rs.advanceTimersByTimeAsync(0);
		await newer;
		expect(f.runtime.canCreateLegacyProject()).toBe(true);
		old.resolve({ kind: "writable" });
		await rs.advanceTimersByTimeAsync(0);
		await reading;
		expect(coreOpen).not.toHaveBeenCalled();
		await directoryCompleted(f.runtime.dispose());
	} finally {
		old.resolve({ kind: "read-only/exportable", recovery: {} });
		void f.runtime.dispose().catch(() => undefined);
		await rs.advanceTimersByTimeAsync(0);
		rs.clearAllTimers();
		rs.useRealTimers();
	}
});


it("already settled healthy source ports settle the public startup promise in the same drained turn", async () => {
	rs.useFakeTimers();
	const f = fixture(
		"writable",
		"read-only/exportable",
		undefined,
		undefined,
		7,
	);
	let outcome:
		| { kind: "resolved"; value: ReleaseStartupOutcome }
		| { kind: "rejected"; reason: unknown }
		| undefined;
	const starting = f.runtime.releaseStartup.handshake(input());
	expect(starting).toBeInstanceOf(Promise);
	void starting.then(
		(value) => {
			outcome = { kind: "resolved", value };
		},
		(reason) => {
			outcome = { kind: "rejected", reason };
		},
	);
	let checksComplete = false;
	try {
		await rs.advanceTimersByTimeAsync(0);
		expect(outcome).toEqual({ kind: "resolved", value: { kind: "writable" } });
		expect(f.legacyHandshakes()).toBe(1);
		expect(rs.getTimerCount()).toBe(0);
		checksComplete = true;
	} finally {
		// Memory-only ports own no native handles. A broken public settlement must
		// not hide the assertion by awaiting that same non-settling promise again.
		void f.runtime.dispose().catch(() => undefined);
		if (checksComplete) await rs.advanceTimersByTimeAsync(7);
		rs.clearAllTimers();
		rs.useRealTimers();
	}
});
it("already settled owned drains settle one stable disposal promise in the same drained turn", async () => {
	rs.useFakeTimers();
	const f = fixture();
	const closing = f.runtime.dispose();
	let outcome: "resolved" | "rejected" | undefined;
	void closing.then(
		() => {
			outcome = "resolved";
		},
		() => {
			outcome = "rejected";
		},
	);
	try {
		await rs.advanceTimersByTimeAsync(0);
		expect(outcome).toBe("resolved");
		expect(f.runtime.dispose()).toBe(closing);
		expect(f.privateDisposals()).toBe(1);
	} finally {
		rs.clearAllTimers();
		rs.useRealTimers();
	}
});
it("an uncloneable unknown manifest settles as readonly without calling either underlying startup", async () => {
	rs.useFakeTimers();
	const f = fixture();
	let outcome: ReleaseStartupOutcome | undefined;
	const privateStartup = rs.spyOn(f.registered.releaseStartup, "handshake");
	const starting = f.runtime.releaseStartup.handshake({
		...input(),
		shellManifest: () => undefined,
	});
	void starting.then(
		(value) => {
			outcome = value;
		},
		() => undefined,
	);
	let checksComplete = false;
	try {
		await rs.advanceTimersByTimeAsync(0);
		expect(outcome).toEqual({ kind: "read-only/exportable", recovery: {} });
		expect(f.legacyHandshakes()).toBe(0);
		expect(privateStartup).not.toHaveBeenCalled();
		checksComplete = true;
	} finally {
		void f.runtime.dispose().catch(() => undefined);
		if (checksComplete) await rs.advanceTimersByTimeAsync(0);
		rs.clearAllTimers();
		rs.useRealTimers();
	}
});
it("ordinary owned outer disposal completes as a reported successful promise and remains one stable published result", async () => {
	const f = fixture();
	const closing = f.runtime.dispose();
	expect(f.runtime.dispose()).toBe(closing);
	await expect(closing).resolves.toBeUndefined();
});

it("outer source contract preserves the actual ordinary legacy JSON dispatch while the private source is unavailable", async () => {
	const f = fixture();
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "writable",
	});
	await f.runtime.controller.open();
	const source = createInitialProject({
		projectId: "source",
		levelId: "level",
		name: "Ordinary JSON",
		createdAt: instant,
	});
	const result = await f.runtime.controller.importProjectTransfer(
		new TextEncoder().encode(
			await encodeLocalProjectJson(source, f.legacy.checksum.sha256),
		),
	);
	expect(result).toMatchObject({ kind: "durable" });
	expect(f.runtime.controller.snapshot()).toMatchObject({
		kind: "saved",
		project: { name: "Ordinary JSON" },
	});
	expect(await f.legacy.repository.listProjects()).toMatchObject({
		kind: "populated",
		projects: [{ name: "Ordinary JSON" }],
	});
	await f.runtime.dispose();
	expect(f.privateDisposals()).toBe(1);
});
it("outer source contract keeps healthy private startup usable and refuses legacy creation when its actual handshake failed", async () => {
	const f = fixture("read-only/exportable", "writable");
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "writable",
	});
	await f.runtime.controller.open();
	expect(
		(await f.runtime.controller.create("Must not publish to failed legacy"))
			.kind,
	).not.toBe("durable");
	expect(await f.legacy.repository.listProjects()).toEqual({ kind: "empty" });
	expect(f.runtime.controller.snapshot()).not.toMatchObject({ kind: "saved" });
	await f.runtime.dispose();
});
it("outer source contract refuses legacy Core directory/export after failed write admission because those old adapters can provision storage", async () => {
	const f = fixture("read-only/exportable", "writable");
	const seeded = await f.legacy.controller.create("Readable legacy");
	if (seeded.kind !== "durable") throw new Error("Missing source");
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "writable",
	});
	await f.runtime.controller.open();
	expect(f.runtime.controller.snapshot()).toMatchObject({
		kind: "projects",
		projects: [],
		storageSources: [
			{ storageNamespace: "legacy", kind: "unavailable" },
			{ storageNamespace: "browser-registered", kind: "available" },
		],
	});
	const exported = await f.runtime.controller.exportProjectTransfer(
		seeded.projectId,
		{ storageNamespace: "legacy" },
	);
	const readonlySources = f.runtime.getReadonlyProjectSources();
	expect(readonlySources).toEqual(["legacy"]);
	expect(f.runtime.getReadonlyProjectSources()).toBe(readonlySources);
	expect(Object.isFrozen(readonlySources)).toBe(true);
	expect(exported.kind).not.toBe("ready");
	expect(
		(await f.legacy.controller.exportProjectTransfer(seeded.projectId)).kind,
	).toBe("ready");
	await f.runtime.controller.openProject(seeded.projectId, {
		storageNamespace: "legacy",
	});
	expect(f.legacy.inspected()).toBe(0);
	await f.runtime.dispose();
});

it("outer source contract does not call the old recovery coordinator or acquire legacy capability from a caller manifest when the actual source disagrees", async () => {
	const f = fixture("writable", "writable", async () => ({
		...input(),
		shellManifest: { ...manifest, appBuildId: "actual-different-build" },
	}));
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "writable",
	});
	expect(f.legacyHandshakes()).toBe(0);
	await f.runtime.controller.open();
	expect(f.runtime.controller.snapshot()).toMatchObject({
		kind: "projects",
		storageSources: [
			{ storageNamespace: "legacy", kind: "unavailable" },
			{ storageNamespace: "browser-registered", kind: "available" },
		],
	});
	expect(
		(await f.runtime.controller.importProjectTransfer(Uint8Array.of(123, 125)))
			.kind,
	).toBe("verification-unavailable");
	expect(await f.legacy.repository.listProjects()).toEqual({ kind: "empty" });
	await f.runtime.dispose();
});
it("outer source contract never re-admits a late old startup after a later source refusal", async () => {
	let release: (value: ReleaseStartupInput) => void = () => {};
	const held = new Promise<ReleaseStartupInput>((resolve) => {
		release = resolve;
	});
	let reads = 0;
	const f = fixture("writable", "read-only/exportable", async () =>
		++reads === 1 ? held : { ...input(), shellManifest: undefined },
	);
	const old = f.runtime.releaseStartup.handshake(input());
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "read-only/exportable",
		recovery: {},
	});
	release(input());
	expect(await old).toEqual({ kind: "read-only/exportable", recovery: {} });
	expect(f.legacyHandshakes()).toBe(0);
	expect(
		(await f.runtime.controller.importProjectTransfer(Uint8Array.of(123, 125)))
			.kind,
	).toBe("verification-unavailable");
	await f.runtime.dispose();
});
it("outer source contract drains an actual legacy command held before Saving while revoking later view calls, without pretending old connections can be closed or an authorised write cancelled", async () => {
	const f = fixture();
	const created = await f.legacy.controller.create("R1");
	if (created.kind !== "durable") throw new Error("Missing source");
	await f.runtime.releaseStartup.handshake(input());
	await f.runtime.controller.open();
	await f.runtime.controller.openProject(created.projectId, {
		storageNamespace: "legacy",
	});
	let entered: () => void = () => {},
		release: () => void = () => {};
	const waiting = new Promise<void>((resolve) => {
			entered = resolve;
		}),
		held = new Promise<void>((resolve) => {
			release = resolve;
		});
	const checksum = f.legacy.checksum.sha256;
	f.legacy.checksum.sha256 = async (text) => {
		if (text.includes("Held actual rename")) {
			entered();
			await held;
		}
		return checksum(text);
	};
	const renaming = f.runtime.controller.renameProject("Held actual rename");
	await waiting;
	expect(f.legacy.controller.hasPendingPublication()).toBe(true);
	let finished = false;
	const disposal = f.runtime.dispose();
	void disposal.then(() => {
		finished = true;
	});
	expect(f.runtime.dispose()).toBe(disposal);
	await Promise.resolve();
	expect(finished).toBe(false);
	release();
	await renaming;
	await disposal;
	expect(finished).toBe(true);
	expect(await f.legacy.repository.listProjects()).toMatchObject({
		kind: "populated",
		projects: [{ name: "Held actual rename" }],
	});
	expect(
		(await f.runtime.controller.renameProject("Late refused")).kind,
	).not.toBe("durable");
	expect(f.privateDisposals()).toBe(1);
});

it("outer source contract represents an absent private capability honestly and keeps the actual legacy JSON route available without a fake private Core", async () => {
	const legacy = core();
	const runtime = createBrowserRuntime({
		legacy: {
			controller: legacy.controller,
			releaseStartup: { handshake: async () => ({ kind: "writable" }) },
		},
		readReleaseStartupInput: async () => input(),
	});
	expect(await runtime.releaseStartup.handshake(input())).toEqual({
		kind: "writable",
	});
	await runtime.controller.open();
	expect(runtime.controller.snapshot()).toMatchObject({
		kind: "projects",
		storageSources: [
			{ storageNamespace: "legacy", kind: "available" },
			{ storageNamespace: "browser-registered", kind: "unavailable" },
		],
	});
	expect(
		(
			await runtime.controller.importRegisteredPortableBackup(
				Uint8Array.of(80, 75),
			)
		).kind,
	).toBe("not-ready");
	expect(await legacy.repository.listProjects()).toEqual({ kind: "empty" });
	const source = createInitialProject({
		projectId: "source",
		levelId: "level",
		name: "Legacy with absent private",
		createdAt: instant,
	});
	expect(
		(
			await runtime.controller.importProjectTransfer(
				new TextEncoder().encode(
					await encodeLocalProjectJson(source, legacy.checksum.sha256),
				),
			)
		).kind,
	).toBe("durable");
	await runtime.dispose();
});
it("outer source contract retains an owned exact old recovery record when healthy private startup prevents a global readonly outcome", async () => {
	const original = {
		projectId: "old-source",
		serializedProject: "unverified exact original bytes",
	};
	const f = fixture(
		"read-only/exportable",
		"writable",
		async () => input(),
		original,
	);
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "writable",
	});
	const record = f.runtime.getLegacyStartupRecovery();
	expect(record).toEqual(original);
	expect(record).not.toBe(original);
	Object.assign(record ?? {}, {
		projectId: "forged",
		serializedProject: "forged",
	});
	expect(f.runtime.getLegacyStartupRecovery()).toEqual(original);
	await f.runtime.dispose();
	expect(f.runtime.getLegacyStartupRecovery()).toBeUndefined();
});

async function turns() {
	for (let count = 0; count < 20; count++) await Promise.resolve();
}
it("outer partial startup admits known healthy legacy before a held private handshake and disposal still drains that unfinished source", async () => {
	const f = fixture("writable", "writable");
	let release: (value: ReleaseStartupOutcome) => void = () => {};
	const held = new Promise<ReleaseStartupOutcome>((resolve) => {
		release = resolve;
	});
	f.registered.releaseStartup.handshake = () => held;
	const modes: string[] = [];
	let outcome: ReleaseStartupOutcome | undefined;
	const starting = f.runtime.releaseStartup
		.handshake({
			...input(),
			onModeChange: (mode) => {
				modes.push(mode);
			},
		})
		.then((value) => {
			outcome = value;
			return value;
		});
	try {
		await turns();
		expect(f.legacyHandshakes()).toBe(1);
		expect(outcome).toEqual({ kind: "writable" });
		let closed = false;
		const disposal = f.runtime.dispose();
		void disposal.then(() => {
			closed = true;
		});
		await turns();
		expect(closed).toBe(false);
		release({ kind: "writable" });
		await disposal;
		expect(modes).toEqual(["writable"]);
	} finally {
		release({ kind: "writable" });
		await starting;
		await f.runtime.dispose();
	}
});
it("outer partial startup admits known healthy private before a held actual legacy input without granting legacy writes", async () => {
	let release: (value: ReleaseStartupInput) => void = () => {};
	const held = new Promise<ReleaseStartupInput>((resolve) => {
		release = resolve;
	});
	const f = fixture("writable", "writable", () => held);
	let outcome: ReleaseStartupOutcome | undefined;
	const starting = f.runtime.releaseStartup.handshake(input()).then((value) => {
		outcome = value;
		return value;
	});
	try {
		await turns();
		expect(outcome).toEqual({ kind: "writable" });
		expect(f.legacyHandshakes()).toBe(0);
		expect(
			(
				await f.runtime.controller.importProjectTransfer(
					Uint8Array.of(123, 125),
				)
			).kind,
		).toBe("verification-unavailable");
	} finally {
		release(input());
		await starting;
		await f.runtime.dispose();
	}
});
it("outer partial startup has a bounded readonly result when neither source has proved writable and late source work remains owned", async () => {
	let releaseOld: (value: ReleaseStartupInput) => void = () => {},
		releaseNew: (value: ReleaseStartupOutcome) => void = () => {};
	const old = new Promise<ReleaseStartupInput>((resolve) => {
			releaseOld = resolve;
		}),
		next = new Promise<ReleaseStartupOutcome>((resolve) => {
			releaseNew = resolve;
		});
	const f = fixture("writable", "writable", () => old, {}, 20);
	f.registered.releaseStartup.handshake = () => next;
	let watchdog: ReturnType<typeof setTimeout> | undefined;
	try {
		const result = await Promise.race([
			f.runtime.releaseStartup.handshake(input()),
			new Promise<"deadline-missed">((resolve) => {
				watchdog = setTimeout(() => resolve("deadline-missed"), 200);
			}),
		]);
		expect(result).toEqual({ kind: "read-only/exportable", recovery: {} });
		expect(f.legacyHandshakes()).toBe(0);
	} finally {
		if (watchdog !== undefined) clearTimeout(watchdog);
		releaseOld(input());
		releaseNew({ kind: "writable" });
		await f.runtime.dispose();
	}
});

it("outer source contract hides the previous raw recovery snapshot as soon as a new startup generation begins and cannot expose it when current source verification fails", async () => {
	let reads = 0,
		release: (value: ReleaseStartupInput) => void = () => {};
	const held = new Promise<ReleaseStartupInput>((resolve) => {
		release = resolve;
	});
	const original = {
		projectId: "old-source",
		serializedProject: "exact old raw snapshot",
	};
	const f = fixture(
		"read-only/exportable",
		"writable",
		async () => (++reads === 1 ? input() : held),
		original,
	);
	await f.runtime.releaseStartup.handshake(input());
	expect(f.runtime.getLegacyStartupRecovery()).toEqual(original);
	const starting = f.runtime.releaseStartup.handshake(input());
	expect(f.runtime.getLegacyStartupRecovery()).toBeUndefined();
	release({ ...input(), shellManifest: undefined });
	await starting;
	await turns();
	expect(f.runtime.getLegacyStartupRecovery()).toBeUndefined();
	expect(f.legacyHandshakes()).toBe(1);
	await f.runtime.dispose();
});

it("outer legacy creation admission reports only its actual current writable source and closes for new generations and disposal", async () => {
	let reads = 0,
		release: (value: ReleaseStartupInput) => void = () => {};
	const held = new Promise<ReleaseStartupInput>((resolve) => {
		release = resolve;
	});
	const f = fixture("writable", "writable", async () =>
		++reads === 1 ? input() : held,
	);
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	await f.runtime.releaseStartup.handshake(input());
	await turns();
	expect(f.runtime.canCreateLegacyProject()).toBe(true);
	const next = f.runtime.releaseStartup.handshake(input());
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	release(input());
	await next;
	await turns();
	expect(f.runtime.canCreateLegacyProject()).toBe(true);
	await f.runtime.dispose();
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	const readonly = fixture("read-only/exportable", "writable");
	await readonly.runtime.releaseStartup.handshake(input());
	expect(readonly.runtime.canCreateLegacyProject()).toBe(false);
	await readonly.runtime.dispose();
});

it("late actual legacy settlement notifies readiness and recovery on the same private editor instance without navigation", async () => {
	let release: (value: ReleaseStartupInput) => void = () => {};
	const held = new Promise<ReleaseStartupInput>((resolve) => {
		release = resolve;
	});
	const original = {
		projectId: "old",
		serializedProject: "unverified exact source",
	};
	const f = fixture("read-only/exportable", "writable", () => held, original);
	const source = await f.privateCore.controller.create("Private active");
	if (source.kind !== "durable")
		throw new Error("Missing private contract fixture Project");
	const observations: { revision: number; recovery: unknown; key: string }[] =
		[];
	const subscribe: unknown = Reflect.get(f.runtime, "subscribeStartupSources"),
		snapshot: unknown = Reflect.get(f.runtime, "getStartupSourcesRevision");
	const stop =
		typeof subscribe === "function"
			? Reflect.apply(subscribe, f.runtime, [
					() => {
						observations.push({
							revision:
								typeof snapshot === "function"
									? Reflect.apply(snapshot, f.runtime, [])
									: 0,
							recovery: f.runtime.getLegacyStartupRecovery(),
							key: f.runtime.getEditorInstanceSnapshot().key,
						});
					},
				])
			: () => {};
	await f.runtime.releaseStartup.handshake(input());
	await f.runtime.controller.open();
	await f.runtime.controller.openProject(source.projectId, {
		storageNamespace: "browser-registered",
	});
	const key = f.runtime.getEditorInstanceSnapshot().key,
		state = f.runtime.controller.snapshot();
	observations.length = 0;
	release(input());
	await turns();
	expect(f.runtime.getLegacyStartupRecovery()).toEqual(original);
	expect(
		observations.some(
			(value) => JSON.stringify(value.recovery) === JSON.stringify(original),
		),
	).toBe(true);
	expect(observations.every((value) => value.key === key)).toBe(true);
	expect(f.runtime.getEditorInstanceSnapshot().key).toBe(key);
	expect(f.runtime.controller.snapshot()).toBe(state);
	stop();
	await f.runtime.dispose();
});
it("startup source observers can unsubscribe or throw without changing admission; closing is observable and no late event survives disposal", async () => {
	const f = fixture(),
		events: number[] = [];
	let once = 0;
	let stop = () => {};
	f.runtime.subscribeStartupSources(() => {
		throw new Error("Observer failure");
	});
	stop = f.runtime.subscribeStartupSources(() => {
		once++;
		stop();
	});
	f.runtime.subscribeStartupSources(() => {
		events.push(f.runtime.getStartupSourcesRevision());
	});
	await f.runtime.releaseStartup.handshake(input());
	expect(f.runtime.canCreateLegacyProject()).toBe(true);
	expect(once).toBe(1);
	expect(events.length).toBeGreaterThan(0);
	expect(new Set(events).size).toBe(events.length);
	const before = events.length;
	await f.runtime.dispose();
	expect(events.length).toBe(before + 1);
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	const closed = events.length;
	f.runtime.subscribeStartupSources(() => {
		events.push(-1);
	});
	await turns();
	expect(events.length).toBe(closed);
});
it("a source observer can dispose reentrantly after writable proof and all controller entry points are closed before its closing notification", async () => {
	const f = fixture();
	let disposal: Promise<void> | undefined;
	let closingStarted = false;
	const attempts: Promise<unknown>[] = [];
	f.runtime.subscribeStartupSources(() => {
		if (f.runtime.canCreateLegacyProject()) {
			closingStarted = true;
			disposal = f.runtime.dispose();
		} else if (closingStarted)
			attempts.push(f.runtime.controller.create("Must not start after close"));
	});
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "read-only/exportable",
		recovery: {},
	});
	if (!disposal) throw new Error("Missing owned disposal");
	await disposal;
	await Promise.all(attempts);
	expect(await f.legacy.repository.listProjects()).toEqual({ kind: "empty" });
	expect(f.privateDisposals()).toBe(1);
});

it("a source observer may start a newer startup generation without letting the superseded attempt invoke the old recovery coordinator", async () => {
	const f = fixture();
	let newer: Promise<ReleaseStartupOutcome> | undefined,
		first = true;
	let stop = () => {};
	stop = f.runtime.subscribeStartupSources(() => {
		if (first) {
			first = false;
			stop();
			newer = f.runtime.releaseStartup.handshake(input());
		}
	});
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "read-only/exportable",
		recovery: {},
	});
	if (!newer) throw new Error("Missing newer owned generation");
	expect(await newer).toEqual({ kind: "writable" });
	expect(f.legacyHandshakes()).toBe(1);
	expect(f.runtime.canCreateLegacyProject()).toBe(true);
	await f.runtime.dispose();
});

for (const timeout of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 60001])
	it(`outer rejects invalid startup deadline ${timeout} before any source admission`, () => {
		expect(() =>
			fixture("writable", "writable", undefined, undefined, timeout),
		).toThrow();
	});
for (const timeout of [1, 60000])
	it(`outer accepts exact supported startup deadline boundary ${timeout}`, async () => {
		const f = fixture(
			"writable",
			"read-only/exportable",
			undefined,
			undefined,
			timeout,
		);
		await expect(f.runtime.dispose()).resolves.toBeUndefined();
	});
for (const [legacy, privateKind, expected] of [
	["writable", "writable", []],
	["writable", "read-only/exportable", ["browser-registered"]],
	["read-only/exportable", "writable", ["legacy"]],
	[
		"read-only/exportable",
		"read-only/exportable",
		["legacy", "browser-registered"],
	],
] as const)
	it(`outer exposes only the actual backup-only source set ${legacy}/${privateKind}`, async () => {
		const f = fixture(legacy, privateKind);
		await f.runtime.releaseStartup.handshake(input());
		const sources = f.runtime.getReadonlyProjectSources();
		expect(sources).toEqual(expected);
		expect(Object.isFrozen(sources)).toBe(true);
		expect(f.runtime.getReadonlyProjectSources()).toBe(sources);
		await expect(f.runtime.dispose()).resolves.toBeUndefined();
		expect(f.runtime.getReadonlyProjectSources()).toEqual([]);
	});
it("outer refuses each unsupported actual read profile before invoking old recovery while healthy private source stays writable", async () => {
	const profiles: ReleaseStartupInput[] = [
		{ ...input(), shellManifest: undefined },
		{ ...input(), capabilities: { indexeddb: false, webgl2: true } },
		{ ...input(), capabilities: { indexeddb: true, webgl2: false } },
		{
			...input(),
			shellManifest: {
				...manifest,
				projectSchemas: { readable: [2], writable: [2] },
			},
		},
		{
			...input(),
			shellManifest: {
				...manifest,
				assetSchemas: { readable: [2], writable: [2] },
			},
		},
		{
			...input(),
			shellManifest: {
				...manifest,
				catalogSchemas: { readable: [2], writable: [2] },
			},
		},
		{ ...input(), hasControllingWorker: true, workerManifest: undefined },
		{
			...input(),
			hasControllingWorker: true,
			workerManifest: { ...manifest, appBuildId: "foreign-worker" },
		},
		{
			...input(),
			hasControllingWorker: false,
			workerManifest: structuredClone(manifest),
		},
	];
	for (const actual of profiles) {
		const f = fixture("writable", "writable", async () => actual);
		expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
			kind: "writable",
		});
		expect(f.legacyHandshakes()).toBe(0);
		expect(f.runtime.canCreateLegacyProject()).toBe(false);
		expect(f.runtime.getReadonlyProjectSources()).toEqual(["legacy"]);
		await expect(f.runtime.dispose()).resolves.toBeUndefined();
	}
});
it("outer admits a coherent actual controlling worker and legacy readable-only schema cannot enter its old writer recovery", async () => {
	const actual = {
			...input(),
			hasControllingWorker: true,
			workerManifest: structuredClone(manifest),
		},
		f = fixture("writable", "read-only/exportable", async () => actual);
	expect(await f.runtime.releaseStartup.handshake(actual)).toEqual({
		kind: "writable",
	});
	expect(f.legacyHandshakes()).toBe(1);
	expect(f.runtime.canCreateLegacyProject()).toBe(true);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
	const readable = {
			...input(),
			shellManifest: {
				...manifest,
				projectSchemas: { readable: [1, 2], writable: [2] },
			},
		},
		g = fixture("writable", "writable", async () => readable);
	expect(await g.runtime.releaseStartup.handshake(readable)).toEqual({
		kind: "writable",
	});
	expect(g.legacyHandshakes()).toBe(0);
	expect(g.runtime.canCreateLegacyProject()).toBe(false);
	await expect(g.runtime.dispose()).resolves.toBeUndefined();
});
it("a formerly admitted legacy editor cannot mutate after a later actual source refusal, retaining its exact durable revision", async () => {
	let actual = input();
	const f = fixture("writable", "read-only/exportable", async () => actual);
	await f.runtime.releaseStartup.handshake(input());
	await f.runtime.controller.open();
	f.runtime.controller.startNewProject();
	const created = await f.runtime.controller.create("Original");
	expect(created.kind).toBe("durable");
	const before = await f.legacy.repository.loadCurrent();
	actual = {
		...input(),
		shellManifest: { ...manifest, appBuildId: "different-current-shell" },
	};
	await f.runtime.releaseStartup.handshake(input());
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	const renamed = await f.runtime.controller
		.renameProject("Must not publish")
		.catch(() => ({ kind: "refused" as const }));
	expect(renamed.kind).not.toBe("durable");
	expect(await f.legacy.repository.loadCurrent()).toEqual(before);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});
it("source notification revisions increase and an unsubscribed listener is skipped in the same delivery", async () => {
	const f = fixture();
	let stop = () => {},
		removedCalls = 0;
	const revisions: number[] = [];
	f.runtime.subscribeStartupSources(() => {
		revisions.push(f.runtime.getStartupSourcesRevision());
		stop();
	});
	stop = f.runtime.subscribeStartupSources(() => {
		removedCalls++;
	});
	await f.runtime.releaseStartup.handshake(input());
	expect(removedCalls).toBe(0);
	expect(revisions.length).toBeGreaterThan(1);
	expect(revisions.every((v, i) => v > (revisions[i - 1] ?? 0))).toBe(true);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});
it("a source observer starting a newer generation prevents old notification delivery to later listeners", async () => {
	const f = fixture();
	let begun = false,
		newer: Promise<ReleaseStartupOutcome> | undefined,
		oldRevision: number | undefined;
	const second: number[] = [];
	f.runtime.subscribeStartupSources(() => {
		if (!begun) {
			begun = true;
			oldRevision = f.runtime.getStartupSourcesRevision();
			newer = f.runtime.releaseStartup.handshake(input());
		}
	});
	f.runtime.subscribeStartupSources(() => {
		second.push(f.runtime.getStartupSourcesRevision());
	});
	const old = f.runtime.releaseStartup.handshake(input());
	await old;
	await newer;
	expect(oldRevision).toBeDefined();
	expect(second).not.toContain(oldRevision);
	expect(new Set(second).size).toBe(second.length);
	expect(second.length).toBeGreaterThan(0);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});
for (const [legacy, privateKind, kind] of [
	["migration-in-progress", "read-only/exportable", "migration-in-progress"],
	["read-only/exportable", "migration-in-progress", "read-only/exportable"],
] as const)
	it(`all nonwritable settlement preserves only the actual legacy mode ${legacy}/${privateKind}`, async () => {
		const f = fixture(legacy, privateKind);
		expect((await f.runtime.releaseStartup.handshake(input())).kind).toBe(kind);
		await expect(f.runtime.dispose()).resolves.toBeUndefined();
	});

function held<T>() {
	let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	// Observe the fixture-owned promise without replacing what the production
	// port receives. A mutation may refuse to consume this controlled input.
	void promise.catch(() => undefined);
	return { promise, resolve, reject };
}
function readCapability(
	admit: (input: ReleaseStartupInput) => Promise<void> = async () => {},
	finish: () => Promise<void> = async () => {},
): import("./browser-readonly-projects").BrowserReadonlyProjectsRuntime {
	const cancellation = new AbortController();
	return {
		signal: cancellation.signal,
		getSourceSignal: () => undefined,
		getSourceRecovery: () => undefined,
		admit(value) {
			const original = admit(value);
			void original.catch(() => undefined);
			return original;
		},
		readDirectory: async () => ({
			kind: "projects",
			projects: [],
			storageSources: [],
		}),
		exportBackup: async () => ({ kind: "verification-unavailable" }),
		dispose() {
			cancellation.abort();
			const original = finish();
			void original.catch(() => undefined);
			return original;
		},
	};
}
it("fully settled nonwritable sources finish before the startup deadline, including a rejected private startup", async () => {
	rs.useFakeTimers();
	const f = fixture("read-only/exportable", "read-only/exportable");
	f.registered.releaseStartup.handshake = async () => {
		throw new Error("private unavailable");
	};
	try {
		let result: ReleaseStartupOutcome | undefined;
		const pending = f.runtime.releaseStartup.handshake(input());
		void pending.then((value) => {
			result = value;
		});
		await rs.advanceTimersByTimeAsync(0);
		expect(result?.kind).toBe("read-only/exportable");
		expect(rs.getTimerCount()).toBe(0);
		await expect(f.runtime.dispose()).resolves.toBeUndefined();
		await pending;
	} finally {
		// Drain the actual owned startup deadline even when the early settlement
		// assertion fails; cleanup must not mask it behind frozen time.
		await rs.advanceTimersByTimeAsync(1500);
		await f.runtime.dispose().catch(() => undefined);
		rs.useRealTimers();
	}
});
it("one rejected private source cannot finish startup while the potentially writable legacy source is still held", async () => {
	rs.useFakeTimers();
	const actual = held<ReleaseStartupInput>(),
		f = fixture("writable", "read-only/exportable", () => actual.promise);
	f.registered.releaseStartup.handshake = async () => {
		throw new Error("private unavailable");
	};
	try {
		let result: ReleaseStartupOutcome | undefined;
		const pending = f.runtime.releaseStartup.handshake(input());
		void pending.then((value) => {
			result = value;
		});
		await rs.advanceTimersByTimeAsync(0);
		expect(result).toBeUndefined();
		actual.resolve(input());
		await rs.advanceTimersByTimeAsync(0);
		expect(result?.kind).toBe("writable");
		expect(rs.getTimerCount()).toBe(0);
		await pending;
		await expect(f.runtime.dispose()).resolves.toBeUndefined();
	} finally {
		actual.resolve(input());
		await f.runtime.dispose().catch(() => undefined);
		rs.useRealTimers();
	}
});
for (const rejectAdmission of [false, true])
	it(`stale readonly admission settlement (${rejectAdmission ? "rejection" : "success"}) cannot notify the newer startup generation`, async () => {
		const old = held<void>();
		let calls = 0;
		const reader = readCapability(() => {
				calls++;
				return calls === 1 ? old.promise : Promise.resolve();
			}),
			f = fixture(
				"writable",
				"read-only/exportable",
				undefined,
				undefined,
				undefined,
				reader,
			);
		await f.runtime.releaseStartup.handshake(input());
		await f.runtime.releaseStartup.handshake(input());
		await Promise.resolve();
		const before = f.runtime.getStartupSourcesRevision();
		if (rejectAdmission) old.reject(new Error("stale admission"));
		else old.resolve();
		for (let i = 0; i < 10; i++) await Promise.resolve();
		expect(f.runtime.getStartupSourcesRevision()).toBe(before);
		await expect(f.runtime.dispose()).resolves.toBeUndefined();
	});
for (const rejectAdmission of [false, true])
	it(`current late readonly admission settlement (${rejectAdmission ? "rejection" : "success"}) notifies without changing the editor instance`, async () => {
		const admission = held<void>(),
			reader = readCapability(() => admission.promise),
			f = fixture(
				"writable",
				"read-only/exportable",
				undefined,
				undefined,
				undefined,
				reader,
			);
		await f.runtime.releaseStartup.handshake(input());
		const before = f.runtime.getStartupSourcesRevision(),
			instance = f.runtime.getEditorInstanceSnapshot();
		if (rejectAdmission)
			admission.reject(new Error("readable source unavailable"));
		else admission.resolve();
		for (let i = 0; i < 10; i++) await Promise.resolve();
		expect(f.runtime.getStartupSourcesRevision()).toBeGreaterThan(before);
		expect(f.runtime.getEditorInstanceSnapshot()).toBe(instance);
		await expect(f.runtime.dispose()).resolves.toBeUndefined();
	});
for (const failure of [undefined, new Error("owned readonly drain")])
	it(`outer propagates exact readonly disposal failure after draining a started actual-source read (${failure === undefined ? "undefined" : "Error"})`, async () => {
		for (const synchronous of [false, true]) {
			const actual = held<ReleaseStartupInput>(),
				original = Promise.reject<void>(failure);
			void original.catch(() => undefined);
			const reader = readCapability(
					undefined,
					synchronous
						? () => {
								throw failure;
							}
						: () => original,
				),
				f = fixture(
					"writable",
					"read-only/exportable",
					() => actual.promise,
					undefined,
					undefined,
					reader,
				),
				startup = f.runtime.releaseStartup.handshake(input());
			void startup.catch(() => undefined);
			let disposed = false;
			const closing = f.runtime.dispose();
			void closing.then(
				() => {
					disposed = true;
				},
				() => {
					disposed = true;
				},
			);
			expect(reader.signal.aborted).toBe(true);
			expect(f.runtime.dispose()).toBe(closing);
			for (let i = 0; i < 5; i++) await Promise.resolve();
			try {
				expect(disposed).toBe(false);
			} finally {
				actual.resolve(input());
			}
			await expect(closing).rejects.toBe(failure);
			await startup;
		}
	});
for (const failure of [undefined, new Error("owned private drain")])
	it(`outer preserves actual facade disposal rejection (${failure === undefined ? "undefined" : "Error"}) instead of converting it to successful cleanup`, async () => {
		// The real facade owns a published disposal promise. First prove that
		// outer teardown waits for its controlled input before injecting failure;
		// a failed pending assertion must not create an unconsumed fixture fault.
		const gate = held<void>(),
			entered = held<void>(),
			f = fixture();
		f.registered.dispose = () => {
			entered.resolve();
			return gate.promise;
		};
		let settled = false,
			failureInjected = false;
		const closing = f.runtime.dispose();
		void closing.then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);
		try {
			expect(
				await Promise.race([
					entered.promise.then(() => true),
					closing.then(
						() => false,
						() => false,
					),
				]),
			).toBe(true);
			for (let i = 0; i < 10; i++) await Promise.resolve();
			expect(settled).toBe(false);
			expect(f.runtime.dispose()).toBe(closing);
			failureInjected = true;
			gate.reject(failure);
			await expect(closing).rejects.toBe(failure);
		} finally {
			if (!failureInjected) gate.resolve();
		}
		// Keep the original synchronous throw boundary as well as the actual
		// asynchronous published-promise path above.
		const sync = fixture();
		sync.registered.dispose = () => {
			throw failure;
		};
		const synchronousClosing = sync.runtime.dispose();
		expect(sync.runtime.dispose()).toBe(synchronousClosing);
		await expect(synchronousClosing).rejects.toBe(failure);
	});

it("ordinary failed pending startup is drained but cannot be relabeled as a disposal failure", async () => {
	const privateRead = held<ReleaseStartupOutcome>(),
		f = fixture();
	f.registered.releaseStartup.handshake = () => privateRead.promise;
	const startup = f.runtime.releaseStartup.handshake(input());
	for (let i = 0; i < 5; i++) await Promise.resolve();
	const closing = f.runtime.dispose();
	privateRead.reject(new Error("startup unavailable"));
	await expect(closing).resolves.toBeUndefined();
	await startup;
});
it("a disposed runtime refuses startup before invoking either actual source again", async () => {
	const f = fixture();
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
	let calls = 0;
	f.registered.releaseStartup.handshake = async () => {
		calls++;
		return { kind: "writable" };
	};
	await expect(
		f.runtime.releaseStartup.handshake(input()),
	).rejects.toBeDefined();
	expect(calls).toBe(0);
	expect(f.legacyHandshakes()).toBe(0);
});
it("the neutral legacy guard still refuses a synchronous new-project transition after source admission is revoked", async () => {
	let actual = input();
	const f = fixture("writable", "read-only/exportable", async () => actual);
	await f.runtime.releaseStartup.handshake(input());
	await f.runtime.controller.open();
	f.runtime.controller.startNewProject();
	const before = f.runtime.getEditorInstanceSnapshot();
	actual = {
		...input(),
		shellManifest: { ...manifest, appBuildId: "actual-refusal" },
	};
	await f.runtime.releaseStartup.handshake(input());
	f.runtime.controller.startNewProject();
	expect(f.runtime.getEditorInstanceSnapshot()).toBe(before);
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	expect(await f.legacy.repository.listProjects()).toEqual({ kind: "empty" });
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});

it("outer supplies the actual compare-and-swap recovery exit capability without authorizing an unrelated candidate", async () => {
	const f = fixture(),
		project = createInitialProject({
			projectId: "unowned",
			levelId: "level",
			name: "Unowned",
			createdAt: instant,
		}),
		serializedProject = JSON.stringify(project);
	const candidate = {
		project,
		revision: {
			schemaVersion: 1 as const,
			projectId: project.projectId,
			revisionId: "unowned-revision",
			createdAt: instant,
			serializedProject,
			checksum: await f.legacy.checksum.sha256(serializedProject),
		},
	};
	expect(
		await f.runtime.navigationProtection.discardWriterRecoveryAndShowProjects(
			candidate,
		),
	).toBe(false);
	expect(await f.legacy.repository.listProjects()).toEqual({ kind: "empty" });
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});

it("an inert outer constructor reports neither namespace as writable and has no recovery source from an unstarted generation", async () => {
	const f = fixture("writable", "writable");
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	expect(f.runtime.getReadonlyProjectSources()).toEqual([
		"legacy",
		"browser-registered",
	]);
	expect(f.runtime.getLegacyStartupRecovery()).toBeUndefined();
	expect(f.legacyHandshakes()).toBe(0);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});

it("an old actual-source read that later proves the same manifest cannot re-enter legacy recovery after a newer generation admitted it", async () => {
	const old = held<ReleaseStartupInput>();
	let reads = 0;
	const f = fixture("writable", "read-only/exportable", async () =>
		++reads === 1 ? old.promise : input(),
	);
	const first = f.runtime.releaseStartup.handshake(input());
	expect((await f.runtime.releaseStartup.handshake(input())).kind).toBe(
		"writable",
	);
	expect(f.legacyHandshakes()).toBe(1);
	old.resolve(input());
	expect((await first).kind).toBe("read-only/exportable");
	expect(f.legacyHandshakes()).toBe(1);
	expect(f.runtime.canCreateLegacyProject()).toBe(true);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});
it("disposing while an actual legacy source read is held forbids its later recovery callback", async () => {
	const actual = held<ReleaseStartupInput>(),
		f = fixture("writable", "read-only/exportable", () => actual.promise),
		pending = f.runtime.releaseStartup.handshake(input()),
		closing = f.runtime.dispose();
	actual.resolve(input());
	expect((await pending).kind).toBe("read-only/exportable");
	await expect(closing).resolves.toBeUndefined();
	expect(f.legacyHandshakes()).toBe(0);
});
it("source notification revocation after actual legacy read proof prevents entering old recovery", async () => {
	const actual = held<ReleaseStartupInput>(),
		privateResult = held<ReleaseStartupOutcome>(),
		stopped = held<void>(),
		f = fixture("writable", "read-only/exportable", () => actual.promise);
	f.registered.releaseStartup.handshake = () => privateResult.promise;
	let armed = false,
		stopping = false,
		closing: Promise<void> | undefined;
	f.runtime.subscribeStartupSources(() => {
		if (armed && !stopping) {
			stopping = true;
			closing = f.runtime.dispose();
			stopped.resolve();
		}
	});
	const pending = f.runtime.releaseStartup.handshake(input());
	armed = true;
	actual.resolve(input());
	await stopped.promise;
	privateResult.resolve({ kind: "read-only/exportable", recovery: {} });
	await pending;
	await closing;
	expect(f.legacyHandshakes()).toBe(0);
});
it("a newer startup started by the legacy read-proof notification prevents the old recovery invocation", async () => {
	const actual = held<ReleaseStartupInput>(),
		privateResult = held<ReleaseStartupOutcome>(),
		f = fixture("writable", "read-only/exportable", async () => {
			return reads++ === 0 ? actual.promise : input();
		});
	let reads = 0;
	f.registered.releaseStartup.handshake = () => privateResult.promise;
	let armed = false,
		switched = false,
		newer: Promise<ReleaseStartupOutcome> | undefined;
	f.runtime.subscribeStartupSources(() => {
		if (armed && !switched) {
			switched = true;
			newer = f.runtime.releaseStartup.handshake(input());
		}
	});
	const first = f.runtime.releaseStartup.handshake(input());
	armed = true;
	actual.resolve(input());
	for (let i = 0; i < 15; i++) await Promise.resolve();
	privateResult.resolve({ kind: "read-only/exportable", recovery: {} });
	await first;
	await newer;
	expect(switched).toBe(true);
	expect(f.legacyHandshakes()).toBe(1);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});
it("late writable legacy recovery cannot overwrite the newer readonly recovery or call its old mode observer", async () => {
	const old = held<ReleaseStartupOutcome>(),
		f = fixture("read-only/exportable", "read-only/exportable"),
		modes: ReleaseStartupOutcome["kind"][] = [];
	let calls = 0;
	f.legacyStartup.handshake = async () =>
		++calls === 1
			? old.promise
			: {
					kind: "read-only/exportable",
					recovery: {
						projectId: "newer",
						serializedProject: "newer original source",
					},
				};
	const first = f.runtime.releaseStartup.handshake({
		...input(),
		onModeChange: (mode) => modes.push(mode),
	});
	for (let i = 0; i < 10; i++) await Promise.resolve();
	expect((await f.runtime.releaseStartup.handshake(input())).kind).toBe(
		"read-only/exportable",
	);
	const source = f.runtime.getLegacyStartupRecovery();
	old.resolve({ kind: "writable" });
	expect((await first).kind).toBe("read-only/exportable");
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	expect(f.runtime.getLegacyStartupRecovery()).toEqual(source);
	expect(source?.projectId).toBe("newer");
	expect(modes).toEqual([]);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});
it("late old private writable startup cannot hide the newer backup-only namespace or call its old observer", async () => {
	const old = held<ReleaseStartupOutcome>(),
		f = fixture("read-only/exportable", "read-only/exportable"),
		modes: ReleaseStartupOutcome["kind"][] = [];
	let calls = 0;
	f.registered.releaseStartup.handshake = async () =>
		++calls === 1
			? old.promise
			: { kind: "read-only/exportable", recovery: {} };
	const first = f.runtime.releaseStartup.handshake({
		...input(),
		onModeChange: (mode) => modes.push(mode),
	});
	for (let i = 0; i < 10; i++) await Promise.resolve();
	await f.runtime.releaseStartup.handshake(input());
	expect(f.runtime.getReadonlyProjectSources()).toEqual([
		"legacy",
		"browser-registered",
	]);
	old.resolve({ kind: "writable" });
	expect((await first).kind).toBe("read-only/exportable");
	expect(f.runtime.getReadonlyProjectSources()).toEqual([
		"legacy",
		"browser-registered",
	]);
	expect(modes).toEqual([]);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});
it("mode observer disposal revokes a just-finished writable admission before its caller receives the outcome", async () => {
	const f = fixture();
	let closing: Promise<void> | undefined;
	const result = await f.runtime.releaseStartup.handshake({
		...input(),
		onModeChange: () => {
			closing = f.runtime.dispose();
		},
	});
	expect(result.kind).toBe("read-only/exportable");
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	await closing;
});
it("mode observer starting a newer generation cannot deliver its old writable outcome", async () => {
	let actual = input();
	const f = fixture("writable", "read-only/exportable", async () => actual);
	let newer: Promise<ReleaseStartupOutcome> | undefined;
	const first = await f.runtime.releaseStartup.handshake({
		...input(),
		onModeChange: () => {
			actual = {
				...input(),
				shellManifest: { ...manifest, appBuildId: "new-actual-source" },
			};
			newer = f.runtime.releaseStartup.handshake(input());
		},
	});
	expect(first.kind).toBe("read-only/exportable");
	expect((await newer)?.kind).toBe("read-only/exportable");
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	await expect(f.runtime.dispose()).resolves.toBeUndefined();
});
for (const rejected of [false, true])
	it(`a late private ${rejected ? "rejection" : "readonly result"} cannot repeat the already published writable startup mode`, async () => {
		rs.useFakeTimers();
		const privateOutcome = held<ReleaseStartupOutcome>(),
			f = fixture("writable", "read-only/exportable", undefined, undefined, 7),
			mode = rs.fn();
		f.registered.releaseStartup.handshake = () => privateOutcome.promise;
		let outcome: ReleaseStartupOutcome | undefined;
		void f.runtime.releaseStartup
			.handshake({ ...input(), onModeChange: mode })
			.then(
				(value) => {
					outcome = value;
				},
				() => undefined,
			);
		try {
			await rs.advanceTimersByTimeAsync(0);
			expect(outcome).toEqual({ kind: "writable" });
			expect(f.runtime.getReadonlyProjectSources()).toEqual([
				"browser-registered",
			]);
			if (rejected) privateOutcome.reject(new Error("late private refusal"));
			else
				privateOutcome.resolve({ kind: "read-only/exportable", recovery: {} });
			await rs.advanceTimersByTimeAsync(0);
			expect(mode).toHaveBeenCalledExactlyOnceWith("writable");
			expect(f.runtime.canCreateLegacyProject()).toBe(true);
			expect(f.runtime.getReadonlyProjectSources()).toEqual([
				"browser-registered",
			]);
		} finally {
			privateOutcome.resolve({ kind: "read-only/exportable", recovery: {} });
			void f.runtime.dispose().catch(() => undefined);
			await rs.advanceTimersByTimeAsync(7);
			rs.clearAllTimers();
			rs.useRealTimers();
		}
	});
it("private writable startup keeps the held legacy source exactly backup-only and emits no second mode when it later resolves readonly", async () => {
	rs.useFakeTimers();
	const actual = held<ReleaseStartupInput>(),
		f = fixture(
			"read-only/exportable",
			"writable",
			() => actual.promise,
			undefined,
			7,
		),
		mode = rs.fn();
	let outcome: ReleaseStartupOutcome | undefined;
	void f.runtime.releaseStartup
		.handshake({ ...input(), onModeChange: mode })
		.then(
			(value) => {
				outcome = value;
			},
			() => undefined,
		);
	try {
		await rs.advanceTimersByTimeAsync(0);
		expect(outcome).toEqual({ kind: "writable" });
		expect(f.runtime.getReadonlyProjectSources()).toEqual(["legacy"]);
		expect(f.legacyHandshakes()).toBe(0);
		actual.resolve(input());
		await rs.advanceTimersByTimeAsync(0);
		expect(f.legacyHandshakes()).toBe(1);
		expect(mode).toHaveBeenCalledExactlyOnceWith("writable");
		expect(f.runtime.getReadonlyProjectSources()).toEqual(["legacy"]);
	} finally {
		actual.resolve(input());
		void f.runtime.dispose().catch(() => undefined);
		await rs.advanceTimersByTimeAsync(7);
		rs.clearAllTimers();
		rs.useRealTimers();
	}
});
for (const rejected of [false, true])
	it(`a private ${rejected ? "rejection" : "readonly result"} after legacy readonly settlement immediately returns the exact available raw recovery payload`, async () => {
		rs.useFakeTimers();
		const recovery = {
				projectId: "source\ud800",
				serializedProject: "raw\udfff\u0000",
			},
			privateOutcome = held<ReleaseStartupOutcome>(),
			f = fixture(
				"read-only/exportable",
				"read-only/exportable",
				undefined,
				recovery,
				7,
			),
			mode = rs.fn();
		f.registered.releaseStartup.handshake = () => privateOutcome.promise;
		let outcome: ReleaseStartupOutcome | undefined;
		void f.runtime.releaseStartup
			.handshake({ ...input(), onModeChange: mode })
			.then(
				(value) => {
					outcome = value;
				},
				() => undefined,
			);
		try {
			await rs.advanceTimersByTimeAsync(0);
			expect(f.legacyHandshakes()).toBe(1);
			expect(outcome).toBeUndefined();
			if (rejected)
				privateOutcome.reject(
					new Error("private refused after legacy read proof"),
				);
			else
				privateOutcome.resolve({ kind: "read-only/exportable", recovery: {} });
			await rs.advanceTimersByTimeAsync(0);
			expect(outcome).toEqual({ kind: "read-only/exportable", recovery });
			expect(mode).toHaveBeenCalledExactlyOnceWith("read-only/exportable");
			expect(rs.getTimerCount()).toBe(0);
		} finally {
			privateOutcome.resolve({ kind: "read-only/exportable", recovery: {} });
			void f.runtime.dispose().catch(() => undefined);
			await rs.advanceTimersByTimeAsync(7);
			rs.clearAllTimers();
			rs.useRealTimers();
		}
	});
it("a reentrant newer startup owns the sole readonly admission before the old source can revoke its tickets", async () => {
	rs.useFakeTimers();
	const newerInput = {
			...input(),
			shellManifest: { ...manifest, appBuildId: "newer-read-owner" },
		},
		admitted: ReleaseStartupInput[] = [],
		reader = readCapability(async (value) => {
			admitted.push(value);
		}),
		f = fixture(
			"writable",
			"writable",
			async () => newerInput,
			undefined,
			7,
			reader,
		);
	let reentered = false,
		oldOutcome: ReleaseStartupOutcome | undefined,
		newerOutcome: ReleaseStartupOutcome | undefined;
	f.runtime.subscribeStartupSources(() => {
		if (reentered) return;
		reentered = true;
		void f.runtime.releaseStartup.handshake(newerInput).then(
			(value) => {
				newerOutcome = value;
			},
			() => undefined,
		);
	});
	void f.runtime.releaseStartup.handshake(input()).then(
		(value) => {
			oldOutcome = value;
		},
		() => undefined,
	);
	try {
		await rs.advanceTimersByTimeAsync(0);
		expect(oldOutcome?.kind).toBe("read-only/exportable");
		expect(newerOutcome?.kind).toBe("writable");
		expect(admitted.map((value) => value.shellManifest)).toEqual([
			newerInput.shellManifest,
		]);
	} finally {
		void f.runtime.dispose().catch(() => undefined);
		await rs.advanceTimersByTimeAsync(7);
		rs.clearAllTimers();
		rs.useRealTimers();
	}
});

for(const legacyKind of ["writable","read-only/exportable"] as const)
 for(const privateKind of ["writable","read-only/exportable"] as const)
  it(`trusted writable admission query reports current live sources and refuses a disposed runtime (${legacyKind}/${privateKind})`,async()=>{
   const f=fixture(legacyKind,privateKind);
   expect(f.runtime.hasWritableSourceAdmission).toBeTypeOf("function");
   expect(f.runtime.hasWritableSourceAdmission()).toBe(false);
   try {
    await f.runtime.releaseStartup.handshake(input());
    expect(f.runtime.hasWritableSourceAdmission()).toBe(legacyKind==="writable"||privateKind==="writable");
    await directoryCompleted(f.runtime.dispose());
    expect(f.runtime.hasWritableSourceAdmission()).toBe(false);
   }finally{void f.runtime.dispose().catch(()=>undefined);}
  });
