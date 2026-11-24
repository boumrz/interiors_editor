import { expect, rstest, test } from "@rstest/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import {
	createTelegramEntrySession,
	parseTelegramDeploymentConfiguration,
	TelegramEditorApp,
} from "./telegram-editor-app";
import type { ApprovedTelegramRelease } from "./telegram-release-preflight";
import {
	createTelegramRuntime,
	type TelegramRuntime,
} from "./telegram-runtime";

const manifest = {
	version: 1,
	workerProtocolVersion: 1,
	appBuildId: "fixture-build",
	minimumCapabilities: ["indexeddb"],
	projectSchemas: { readable: [1], writable: [1] },
	assetSchemas: { readable: [1], writable: [1] },
	catalogSchemas: { readable: [1], writable: [1] },
};
const capsule = JSON.stringify({
	deliveryTarget: "telegram",
	entryPath: "/telegram.1234abcd.js",
	manifest,
});
const configuration = {
	botId: "123456",
	environment: "production",
	telegramURL: "https://t.me/example_test_bot",
	webURL: "https://example.invalid/editor",
};
function fixture(
	overrides: Partial<Parameters<typeof createTelegramEntrySession>[0]> = {},
) {
	let runtimes = 0,
		loads = 0,
		closed = 0;
	const entry = createTelegramEntrySession({
		configuration,
		rawCapsule: capsule,
		loadedEntryPath: "/telegram.1234abcd.js",
		legal: { readable: () => true, receipts: { has: () => true, accept: () => true } },
		secureContext: true,
		webLocks: true,
		readCapabilities: () => ({ indexeddb: true, webgl2: false }),
		readWorker: async () => ({
			hasControllingWorker: false,
			workerManifest: undefined,
		}),
		source: {
			read: () => ({
				initData: "",
				ready() {},
				close() {
					closed++;
				},
			}),
			start(_loaded, failed) {
				loads++;
				failed();
				return () => undefined;
			},
		},
		createRuntime() {
			runtimes++;
			throw new Error("Invalid launch must not construct any runtime");
		},
		nowEpochMs: () => 1_800_000_000_000,
		onExit: () => {
			closed++;
		},
		...overrides,
	});
	return {
		entry,
		runtimes: () => runtimes,
		loads: () => loads,
		closed: () => closed,
	};
}
test("public deployment configuration is exact, copied, and permits no tokens or unsafe links", () => {
	const raw = { ...configuration };
	const parsed = parseTelegramDeploymentConfiguration(raw);
	expect(parsed.kind).toBe("configured");
	raw.botId = "77";
	if (parsed.kind !== "configured") throw new Error("Expected configuration");
	expect(parsed.configuration.botId).toBe("123456");
	expect(Object.isFrozen(parsed.configuration)).toBe(true);
	for (const value of [
		{ ...configuration, botId: "01" },
		{ ...configuration, botId: "9007199254740992" },
		{ ...configuration, environment: "staging" },
		{ ...configuration, token: "never-allowed" },
		{ ...configuration, telegramURL: "" },
		{ ...configuration, telegramURL: "javascript:alert(1)" },
		{ ...configuration, webURL: "https://user:password@example.invalid" },
		null,
	])
		expect(parseTelegramDeploymentConfiguration(value).kind).toBe(
			"unavailable",
		);
	expect(
		parseTelegramDeploymentConfiguration({
			botId: "",
			environment: "",
			telegramURL: "",
			webURL: "",
		}).kind,
	).toBe("unavailable");
});

test("launches without a standalone web editor URL", () => {
	const { webURL: _webURL, ...telegramOnly } = configuration;
	expect(parseTelegramDeploymentConfiguration(telegramOnly)).toEqual({
		kind: "configured",
		configuration: telegramOnly,
	});
	expect(parseTelegramDeploymentConfiguration({ ...telegramOnly, webURL: "" }).kind).toBe("configured");
});
test("constructing the entry is inert and missing public configuration never loads SDK or creates runtime", async () => {
	const f = fixture({ configuration: {} });
	expect(f.loads()).toBe(0);
	expect(f.runtimes()).toBe(0);
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot().kind).toBe("unavailable");
	expect(f.loads()).toBe(0);
	expect(f.runtimes()).toBe(0);
	await expectCompleted(f.entry.dispose());
});
test("actual loaded-shell mismatch and unavailable worker manifest fail before source/runtime", async () => {
	for (const override of [
		{ loadedEntryPath: "/telegram.wrong.js" },
		{ rawCapsule: undefined },
		{
			readWorker: async () => ({
				hasControllingWorker: true,
				workerManifest: undefined,
			}),
		},
		{ readCapabilities: () => ({ indexeddb: false, webgl2: false }) },
	]) {
		let sourceReads = 0;
		const f = fixture({
			...override,
			source: {
				read() {
					sourceReads++;
					return undefined;
				},
				start() {
					throw new Error("Must not load");
				},
			},
		});
		await expectCompleted(f.entry.start());
		expect(f.entry.snapshot().kind).toBe("unavailable");
		expect(sourceReads).toBe(0);
		expect(f.runtimes()).toBe(0);
		await expectCompleted(f.entry.dispose());
	}
});
test("an SDK-shaped object with missing signed launch never constructs runtime and exposes no launch data", async () => {
	const f = fixture();
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot()).toEqual({ kind: "unavailable", reason: "launch" });
	expect(f.runtimes()).toBe(0);
	await expectCompleted(f.entry.exit());
	expect(f.closed()).toBe(1);
	await expectCompleted(f.entry.dispose());
});
test("only the current rejected shell can reveal its committed recovery UI without opening either runtime", async () => {
	const effects = { ready: 0, readonly: 0 };
	const sdk = { initData: "", ready() { effects.ready++; }, close() {} };
	const f = fixture({
		source: { read: () => sdk, start() { throw new Error("SDK already present"); } },
		createReadonlyRuntime() { effects.readonly++; throw new Error("Rejected launch"); },
	});
	expect(f.entry.shellReady(f.entry.snapshot())).toBe(false);
	await expectCompleted(f.entry.start());
	const first = f.entry.snapshot();
	expect(first).toEqual({ kind: "unavailable", reason: "launch" });
	const before = diagnosticSnapshot(f.entry);
	expect(effects.ready).toBe(0);
	expect(f.entry.shellReady({ ...first })).toBe(false);
	expect(f.entry.shellReady(first)).toBe(true);
	expect(f.entry.shellReady(first)).toBe(false);
	expect(effects.ready).toBe(1);
	expect(f.entry.snapshot()).toBe(first);
	expect(diagnosticSnapshot(f.entry)).toBe(before);
	expect(f.entry.ready({} as TelegramRuntime)).toBe(false);
	expect(f.runtimes() + effects.readonly).toBe(0);
	await expectCompleted(f.entry.start());
	expect(f.entry.shellReady(first)).toBe(false);
	expect(f.entry.shellReady(f.entry.snapshot())).toBe(true);
	expect(effects.ready).toBe(2);
	const last = f.entry.snapshot();
	await expectCompleted(f.entry.dispose());
	expect(f.entry.shellReady(last)).toBe(false);
	expect(effects.ready).toBe(2);
});
test("a shell-ready host failure leaves recovery state and diagnostics intact and exit usable", async () => {
	const effects = { ready: 0, close: 0 };
	const f = fixture({ source: {
		read: () => ({ initData: "", ready() { effects.ready++; throw new Error("Host failure"); }, close() { effects.close++; } }),
		start() { throw new Error("SDK already present"); },
	} });
	await expectCompleted(f.entry.start());
	const rejected = f.entry.snapshot(), before = diagnosticSnapshot(f.entry);
	expect(f.entry.shellReady(rejected)).toBe(false);
	expect(f.entry.shellReady(rejected)).toBe(false);
	expect(effects.ready).toBe(1);
	expect(f.entry.snapshot()).toBe(rejected);
	expect(diagnosticSnapshot(f.entry)).toBe(before);
	expect(f.runtimes()).toBe(0);
	await expectCompleted(f.entry.exit());
	expect(f.closed()).toBe(1);
});
test("a rejection before host bootstrap cannot load an SDK to reveal its shell", async () => {
	const f = fixture({ configuration: {} });
	await expectCompleted(f.entry.start());
	expect(f.entry.shellReady(f.entry.snapshot())).toBe(false);
	expect(f.loads()).toBe(0);
	expect(f.runtimes()).toBe(0);
	await expectCompleted(f.entry.dispose());
});
test("dispose is idempotent, revokes late worker admission and removes observers before completion", async () => {
	let release:
		| ((value: {
				hasControllingWorker: boolean;
				workerManifest: unknown;
		  }) => void)
		| undefined;
	let entered: () => void = () => undefined;
	const barrier = new Promise<void>((resolve) => {
		entered = resolve;
	});
	let reads = 0;
	const f = fixture({
		readWorker: () =>
			new Promise((resolve) => {
				release = resolve;
				entered();
			}),
		source: {
			read() {
				reads++;
				return undefined;
			},
			start() {
				throw new Error("Late SDK load");
			},
		},
	});
	let events = 0;
	f.entry.subscribe(() => {
		events++;
	});
	const work = f.entry.start();
	await requireEntered(barrier, work);
	expect(release).toBeDefined();
	const disposal = f.entry.dispose();
	const stoppedEvents = events;
	expect(f.entry.dispose()).toBe(disposal);
	release?.({ hasControllingWorker: false, workerManifest: undefined });
	await expectCompleted(work);
	await expectCompleted(disposal);
	expect(reads).toBe(0);
	expect(f.runtimes()).toBe(0);
	expect(events).toBe(stoppedEvents);
	expect(f.entry.ready({} as TelegramRuntime)).toBe(false);
	await expectCompleted(f.entry.start());
	expect(reads).toBe(0);
});

// Public Telegram-signed maintainers vector; native crypto with an injected historical TEST clock.
const signedExample =
	"user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%20%2B%20-%20%3F%20%5C%2F%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg%22%7D&chat_instance=8134722200314281151&chat_type=private&auth_date=1733584787&hash=2174df5b000556d044f3f020384e879c8efcab55ddea2ced4eb752e93e7080d6&signature=zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ";
test("reentrant dispose during real runtime abort drains the deferred whole controller command before replacement", async () => {
	let releaseChecksum: (value: string) => void = () => undefined,
		checksumEntered: () => void = () => undefined;
	const entered = new Promise<void>((resolve) => {
		checksumEntered = resolve;
	});
	let creates = 0,
		id = 0,
		opens = 0,
		checksumCalls = 0;
	let actual: TelegramRuntime | undefined;
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, raw: string) => {
			values.set(key, raw);
		},
	};
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: {
			read: () => ({ initData: signedExample, ready() {}, close() {} }),
			start() {
				throw new Error("Native signed source is already available");
			},
		},
		createRuntime(approval, scope) {
			creates++;
			actual = createTelegramRuntime({
				approval,
				scope,
				context: {
					indexedDb: {
						open() {
							opens++;
							throw new Error("No native DB in unit test");
						},
					},
					locks: {
						request() {
							throw new Error("No native locks in unit test");
						},
					},
					secureContext: true,
					crypto,
					sessionStorage: storage,
					localStorage: storage,
					readCapabilities: () => ({ indexeddb: true, webgl2: false }),
					readWorker: async () => ({
						hasControllingWorker: false,
						workerManifest: undefined,
					}),
				},
				ports: {
					checksum: {
						sha256: () => {
							if (++checksumCalls > 1) return Promise.resolve("a".repeat(64));
							checksumEntered();
							return new Promise((resolve) => {
								releaseChecksum = resolve;
							});
						},
					},
					binaryChecksum: { sha256Bytes: async () => "a".repeat(64) },
					ids: { next: () => `entry-id-${++id}` },
					clock: { now: () => "2026-11-04T18:00:00.000Z" },
					storageEstimate: { estimateStorage: async () => ({}) },
					portable: {
						encoder: { encode: () => new Uint8Array() },
						decoder: {
							decode: async () => ({ kind: "verification-unavailable" }),
						},
						writer: {
							encode: async () => ({
								kind: "rejected",
								reasonCode: "BACKUP_SCHEMA_UNREADABLE",
							}),
						},
						smoke: { verify: async () => true },
						feasibility: { assess: async () => ({ kind: "accepted" }) },
					},
				},
			});
			return actual;
		},
	});
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot().kind).toBe("editor");
	if (!actual) throw new Error("Expected actual shared-core runtime");
	expect(f.entry.ready(actual)).toBe(true);
	expect(f.entry.ready(actual)).toBe(false);
	const command = actual.controller.create("Entry drain");
	await requireEntered(entered, command);
	let disposed: Promise<void> | undefined;
	actual.session.signal.addEventListener(
		"abort",
		() => {
			disposed = f.entry.dispose();
		},
		{ once: true },
	);
	const retry = f.entry.start();
	if (!disposed)
		throw new Error("Actual abort must synchronously revoke entry");
	let finished = false;
	void disposed.then(() => {
		finished = true;
	});
	await Promise.resolve();
	await Promise.resolve();
	expect(finished).toBe(false);
	expect(f.entry.snapshot().kind).toBe("closed");
	releaseChecksum("a".repeat(64));
	await expectCompleted(command);
	await expectCompleted(retry);
	await expectCompleted(disposed);
	expect(finished).toBe(true);
	expect(creates).toBe(1);
	expect(opens).toBe(0);
});

function dormantActualRuntime(
	approval: ApprovedTelegramRelease,
	scope: VerifiedTelegramScope,
	indexeddb = true,
) {
	const storage = { getItem: () => null, setItem: () => undefined };
	return createTelegramRuntime({
		approval,
		scope,
		context: {
			indexedDb: {
				open() {
					throw new Error("Unexpected native DB use in admission unit");
				},
			},
			locks: {
				request() {
					throw new Error("Unexpected native lock use in admission unit");
				},
			},
			secureContext: true,
			crypto,
			sessionStorage: storage,
			localStorage: storage,
			readCapabilities: () => ({ indexeddb, webgl2: false }),
			readWorker: async () => ({
				hasControllingWorker: false,
				workerManifest: undefined,
			}),
		},
		ports: {
			checksum: { sha256: async () => "a".repeat(64) },
			binaryChecksum: { sha256Bytes: async () => "a".repeat(64) },
			ids: { next: () => crypto.randomUUID() },
			clock: { now: () => "2026-11-04T18:00:00.000Z" },
			storageEstimate: { estimateStorage: async () => ({}) },
			portable: {
				encoder: { encode: () => new Uint8Array() },
				decoder: { decode: async () => ({ kind: "verification-unavailable" }) },
				writer: {
					encode: async () => ({
						kind: "rejected",
						reasonCode: "BACKUP_SCHEMA_UNREADABLE",
					}),
				},
				smoke: { verify: async () => true },
				feasibility: { assess: async () => ({ kind: "accepted" }) },
			},
		},
	});
}
const signedSource = (ready: () => void = () => undefined) => ({
	read: () => ({ initData: signedExample, ready, close() {} }),
	start() {
		throw new Error("Signed source is already available");
	},
});
test("verified SDK ready failure revokes its real runtime and leaves a finite retry state", async () => {
	let actual: TelegramRuntime | undefined;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(() => {
			throw new Error("Native-ready failure");
		}),
		createRuntime(approval, scope) {
			actual = dormantActualRuntime(approval, scope);
			return actual;
		},
	});
	await expectCompleted(f.entry.start());
	if (!actual) throw new Error("Actual runtime required");
	expect(f.entry.ready(actual)).toBe(false);
	expect(f.entry.snapshot()).toEqual({ kind: "unavailable", reason: "launch" });
	expect(actual.session.signal.aborted).toBe(true);
	await expect(
		actual.controller.create("Late ready command"),
	).rejects.toThrow();
	await expectCompleted(f.entry.dispose());
});
test("actual runtime startup rechecks capabilities and cannot publish editor admission after failure", async () => {
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createRuntime(approval, scope) {
			return dormantActualRuntime(approval, scope, false);
		},
	});
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot()).toEqual({
		kind: "unavailable",
		reason: "release",
	});
	await expectCompleted(f.entry.dispose());
});
test("retry drains and replaces an actual runtime at the same verified scope without reviving old admission", async () => {
	const actual: TelegramRuntime[] = [];
	let ready = 0;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(() => {
			ready++;
		}),
		createRuntime(approval, scope) {
			const runtime = dormantActualRuntime(approval, scope);
			actual.push(runtime);
			return runtime;
		},
	});
	await expectCompleted(f.entry.start());
	expect(f.entry.ready(actual[0])).toBe(true);
	const first = f.entry.snapshot();
	if (first.kind !== "editor") throw new Error("Expected admitted editor");
	expect(typeof first.mountKey).toBe("string");
	await expectCompleted(f.entry.start());
	expect(actual).toHaveLength(2);
	const second = f.entry.snapshot();
	if (second.kind !== "editor") throw new Error("Expected replacement editor");
	expect(second.mountKey).not.toBe(first.mountKey);
	expect(actual[1].scope).toBe(actual[0].scope);
	expect(actual[1]).not.toBe(actual[0]);
	expect(actual[0].session.signal.aborted).toBe(true);
	expect(f.entry.ready(actual[0])).toBe(false);
	expect(f.entry.ready(actual[1])).toBe(true);
	expect(ready).toBe(2);
	await expect(
		actual[0].controller.create("Late prior generation"),
	).rejects.toThrow();
	await expectCompleted(f.entry.dispose());
});
test("fallback links, exact deployment types, supported test environment and URL bounds remain explicit", () => {
	expect(
		parseTelegramDeploymentConfiguration({
			...configuration,
			environment: "test",
		}).kind,
	).toBe("configured");
	for (const botId of [123456, "123456 "])
		expect(
			parseTelegramDeploymentConfiguration({ ...configuration, botId }).kind,
		).toBe("unavailable");
	const fallback = parseTelegramDeploymentConfiguration({
		...configuration,
		botId: "",
	});
	if (fallback.kind !== "unavailable")
		throw new Error("Expected missing deployment");
	expect(fallback.links).toEqual({
		telegramURL: configuration.telegramURL,
		webURL: configuration.webURL,
	});
	const prefix = "https://example.invalid/",
		boundary = prefix + "a".repeat(2048 - prefix.length);
	expect(
		parseTelegramDeploymentConfiguration({ ...configuration, webURL: boundary })
			.kind,
	).toBe("configured");
	expect(
		parseTelegramDeploymentConfiguration({
			...configuration,
			webURL: `${boundary}a`,
		}).kind,
	).toBe("unavailable");
	const denied = Object.defineProperty({}, "webURL", {
		get() {
			throw new Error("Never expose this private getter error");
		},
	});
	expect(parseTelegramDeploymentConfiguration(denied)).toEqual({
		kind: "unavailable",
		links: {},
	});
});
test("observers receive fresh states, may unsubscribe, and cannot break fail-closed admission", async () => {
	const f = fixture();
	expect(f.entry.snapshot()).toEqual({ kind: "checking" });
	const states: string[] = [];
	const unsubscribe = f.entry.subscribe(() =>
		states.push(f.entry.snapshot().kind),
	);
	f.entry.subscribe(() => {
		throw new Error("Observer failure");
	});
	await expectCompleted(f.entry.start());
	expect(states).toEqual(["checking", "unavailable"]);
	unsubscribe();
	await expectCompleted(f.entry.start());
	expect(states).toEqual(["checking", "unavailable"]);
	await expectCompleted(f.entry.dispose());
});
test("an unavailable platform read leaves a finite private-error-free state", async () => {
	const f = fixture({
		readWorker: async () => {
			throw new Error("Secret native platform detail");
		},
	});
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot()).toEqual({
		kind: "unavailable",
		reason: "storage",
	});
	expect(f.runtimes()).toBe(0);
	await expectCompleted(f.entry.dispose());
});
test("a superseded worker reply cannot construct a second runtime or replace the actual new editor", async () => {
	let reads = 0,
		release:
			| ((value: {
					hasControllingWorker: boolean;
					workerManifest: undefined;
			  }) => void)
			| undefined,
		entered: () => void = () => undefined;
	const barrier = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const actual: TelegramRuntime[] = [];
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		readWorker: () =>
			++reads === 1
				? new Promise((resolve) => {
						release = resolve;
						entered();
					})
				: Promise.resolve({
						hasControllingWorker: false,
						workerManifest: undefined,
					}),
		createRuntime(approval, scope) {
			const value = dormantActualRuntime(approval, scope);
			actual.push(value);
			return value;
		},
	});
	const old = f.entry.start();
	await requireEntered(barrier, old);
	await expectCompleted(f.entry.start());
	const admitted = f.entry.snapshot();
	expect(admitted.kind).toBe("editor");
	expect(actual).toHaveLength(1);
	release?.({ hasControllingWorker: false, workerManifest: undefined });
	await expectCompleted(old);
	expect(f.entry.snapshot()).toBe(admitted);
	expect(actual).toHaveLength(1);
	await expectCompleted(f.entry.dispose());
});
test("a real runtime returned after synchronous disposal is revoked and drained before disposal completes", async () => {
	let actual: TelegramRuntime | undefined, disposal: Promise<void> | undefined;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createRuntime(approval, scope) {
			actual = dormantActualRuntime(approval, scope);
			disposal = f.entry.dispose();
			return actual;
		},
	});
	await expectCompleted(f.entry.start());
	await expectCompleted(disposal);
	if (!actual) throw new Error("Expected actual returned runtime");
	expect(actual.session.signal.aborted).toBe(true);
	expect(f.entry.snapshot().kind).toBe("closed");
	await expect(
		actual.controller.create("Late returned runtime"),
	).rejects.toThrow();
});
test("failed ready then successful retry never reuses the failed editor mount generation", async () => {
	let works = false;
	const actual: TelegramRuntime[] = [];
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(() => {
			if (!works) throw new Error("One ready failure");
		}),
		createRuntime(approval, scope) {
			const value = dormantActualRuntime(approval, scope);
			actual.push(value);
			return value;
		},
	});
	await expectCompleted(f.entry.start());
	const first = f.entry.snapshot();
	if (first.kind !== "editor") throw new Error("Expected first editor");
	expect(f.entry.ready(actual[0])).toBe(false);
	works = true;
	await expectCompleted(f.entry.start());
	const second = f.entry.snapshot();
	if (second.kind !== "editor") throw new Error("Expected new editor");
	expect(second.mountKey).not.toBe(first.mountKey);
	expect(f.entry.ready(actual[1])).toBe(true);
	await expectCompleted(f.entry.dispose());
});

test("missing launch settings keep safe fallback URLs even when another URL field has a wrong JSON type", async () => {
	const f = fixture({ configuration: { ...configuration, botId: "" } });
	expect(f.entry.links.webURL).toBe(configuration.webURL);
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot()).toEqual({
		kind: "unavailable",
		reason: "configuration",
	});
	await expectCompleted(f.entry.dispose());
	const value = parseTelegramDeploymentConfiguration({
		...configuration,
		telegramURL: null,
	});
	if (value.kind !== "unavailable") throw new Error("Expected wrong URL type");
	expect(value.links).toEqual({ webURL: configuration.webURL });
	expect(
		parseTelegramDeploymentConfiguration({
			...configuration,
			webURL: [configuration.webURL],
		}).kind,
	).toBe("unavailable");
});

function hostStyle() {
	const values = new Map<string, string>();
	return {
		values,
		getPropertyValue: (name: string) => values.get(name) ?? "",
		getPropertyPriority: () => "",
		setProperty: (name: string, value: string) => {
			values.set(name, value);
		},
		removeProperty: (name: string) => {
			const value = values.get(name) ?? "";
			values.delete(name);
			return value;
		},
	};
}
test("only a signed admitted attempt connects its exact host capture before runtime construction and synchronous disposal tears it down", async () => {
	const sdk = {
		initData: signedExample,
		ready() {},
		close() {},
		version: "8.0",
	};
	const style = hostStyle();
	let connected = 0;
	let environment:
		| ReturnType<
				import("../adapters/telegram/host-environment").TelegramHostCapture["connect"]
		  >
		| undefined;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: { read: () => sdk, start: () => () => undefined },
		connectHost(capture, onContextChanged) {
			connected++;
			environment = capture.connect({
				style,
				readBrowser: () => ({
					height: 700,
					width: 390,
					visible: true,
					focused: true,
				}),
				subscribeBrowser: () => () => undefined,
				readCurrentSdk: () => sdk,
				onContextChanged,
			});
			return environment;
		},
		createRuntime(approval, scope) {
			expect(connected).toBe(1);
			return dormantActualRuntime(approval, scope);
		},
	});
	expect(connected).toBe(0);
	expect(style.values.size).toBe(0);
	await expectCompleted(f.entry.start());
	const state = f.entry.snapshot();
	expect(state.kind).toBe("editor");
	if (state.kind !== "editor") throw new Error("Expected editor");
	expect(state.hostEnvironment).toBe(environment);
	expect(environment?.lifecycle.snapshot().active).toBe(true);
	const stopped = f.entry.dispose();
	expect(environment?.lifecycle.snapshot().active).toBe(false);
	expect(state.runtime.session.signal.aborted).toBe(true);
	expect(style.values.size).toBe(0);
	await expectCompleted(stopped);
	const invalid = fixture({
		connectHost() {
			throw new Error("Unsigned launch must not bind host");
		},
	});
	await expectCompleted(invalid.entry.start());
	expect(invalid.entry.snapshot().kind).toBe("unavailable");
	await expectCompleted(invalid.entry.dispose());
});
test("observable host context replacement revokes actual runtime immediately and requires a fresh signed launch", async () => {
	const sdk = {
		initData: signedExample,
		ready() {},
		close() {},
		version: "8.0",
	};
	const style = hostStyle();
	let environment:
		| ReturnType<
				import("../adapters/telegram/host-environment").TelegramHostCapture["connect"]
		  >
		| undefined;
	let creates = 0;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: { read: () => sdk, start: () => () => undefined },
		connectHost(capture, onContextChanged) {
			environment = capture.connect({
				style,
				readBrowser: () => ({
					height: 700,
					width: 390,
					visible: true,
					focused: true,
				}),
				subscribeBrowser: () => () => undefined,
				readCurrentSdk: () => sdk,
				onContextChanged,
			});
			return environment;
		},
		createRuntime(approval, scope) {
			creates++;
			return dormantActualRuntime(approval, scope);
		},
	});
	await expectCompleted(f.entry.start());
	const original = f.entry.snapshot();
	if (original.kind !== "editor") throw new Error("Expected original editor");
	sdk.initData = "unsigned new context";
	environment?.navigation.setBackVisible(true);
	expect(original.runtime.session.signal.aborted).toBe(true);
	expect(f.entry.snapshot().kind).toBe("checking");
	await new Promise<void>((resolve) => {
		const off = f.entry.subscribe(() => {
			if (f.entry.snapshot().kind === "unavailable") {
				off();
				resolve();
			}
		});
	});
	expect(creates).toBe(1);
	expect(style.values.size).toBe(0);
	await expectCompleted(f.entry.dispose());
});

function diagnosticSnapshot(
	entry: ReturnType<typeof createTelegramEntrySession>,
) {
	const port: unknown = Reflect.get(entry, "diagnostics");
	expect(port).toBeDefined();
	if (!port || typeof port !== "object")
		throw new Error("Missing local diagnostics");
	const snapshot: unknown = Reflect.get(port, "snapshot");
	if (typeof snapshot !== "function")
		throw new Error("Missing owned diagnostic snapshot");
	return Reflect.apply(
		snapshot,
		port,
		[],
	) as import("./telegram-diagnostics").TelegramDiagnosticRecord;
}
test("entry diagnostics are inert, technical and retain the specific verified-launch rejection without exposing raw launch text", async () => {
	const f = fixture({
		source: {
			read: () => ({
				initData: "SECRET_RAW_LAUNCH username=SECRET_PERSON",
				ready() {},
				close() {},
			}),
			start() {
				throw new Error("Source already loaded");
			},
		},
	});
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		target: "telegram",
		appBuildId: "fixture-build",
		phase: "checking",
		reason: "checking",
		catalogVersion: "not-observed",
		capabilities: { indexeddb: "not-checked", webgl2: "not-checked" },
	});
	expect(f.loads()).toBe(0);
	expect(f.runtimes()).toBe(0);
	await expectCompleted(f.entry.start());
	const record = diagnosticSnapshot(f.entry);
	expect(record).toMatchObject({
		phase: "verification",
		reason: "malformed-init-data",
		capabilities: { indexeddb: true, webgl2: false },
	});
	expect(JSON.stringify(record)).not.toContain("SECRET_");
	expect(f.entry.snapshot()).toEqual({ kind: "unavailable", reason: "launch" });
	await expectCompleted(f.entry.dispose());
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "closed",
		reason: "disposed",
	});
});
test("entry diagnostics distinguish unavailable storage and an incompatible release before loading any SDK", async () => {
	for (const unavailable of ["storage", "release"] as const) {
		const f = fixture(
			unavailable === "storage"
				? { readCapabilities: () => ({ indexeddb: false, webgl2: false }) }
				: { loadedEntryPath: "/telegram.other.js" },
		);
		await expectCompleted(f.entry.start());
		expect(diagnosticSnapshot(f.entry)).toMatchObject({
			phase: "release",
			reason:
				unavailable === "storage"
					? "storage-unavailable"
					: "release-incompatible",
		});
		expect(f.loads()).toBe(0);
		expect(f.runtimes()).toBe(0);
		await expectCompleted(f.entry.dispose());
	}
});

test("catalog diagnostics record only validated public version and refuse stale or foreign runtime observations", async () => {
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createRuntime: (approval, scope) => dormantActualRuntime(approval, scope),
	});
	await expectCompleted(f.entry.start());
	const first = f.entry.snapshot();
	if (first.kind !== "editor")
		throw new Error("Missing actual admitted runtime");
	const available = {
		kind: "available" as const,
		publication: {
			assets: [],
			catalogVersion: "public-catalog-v1",
			envelopeHash: "a".repeat(64),
			publishedAt: "2026-11-05T00:00:00.000Z",
			privateFilename: "SECRET_FILE",
			rawGlb: "SECRET_BYTES",
		},
	};
	f.entry.observeCatalogPublication?.(first.runtime, available);
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		catalogVersion: "public-catalog-v1",
		reason: "ready",
	});
	expect(JSON.stringify(diagnosticSnapshot(f.entry))).not.toContain("SECRET_");
	const before = diagnosticSnapshot(f.entry);
	f.entry.observeCatalogPublication?.({}, { kind: "unavailable" });
	expect(diagnosticSnapshot(f.entry)).toBe(before);
	await expectCompleted(f.entry.start());
	const second = f.entry.snapshot();
	if (second.kind !== "editor") throw new Error("Missing replacement");
	const current = diagnosticSnapshot(f.entry);
	f.entry.observeCatalogPublication?.(first.runtime, available);
	expect(diagnosticSnapshot(f.entry)).toBe(current);
	f.entry.observeCatalogPublication?.(second.runtime, { kind: "cancelled" });
	expect(diagnosticSnapshot(f.entry)).toBe(current);
	f.entry.observeCatalogPublication?.(second.runtime, {
		kind: "invalid-envelope",
		reasonCode: "CATALOG_ENVELOPE_SCHEMA_INVALID",
	});
	expect(diagnosticSnapshot(f.entry).reason).toBe("catalog-envelope-invalid");
	f.entry.observeCatalogPublication?.(second.runtime, { kind: "unavailable" });
	expect(diagnosticSnapshot(f.entry).reason).toBe("catalog-unavailable");
	await expectCompleted(f.entry.dispose());
	const closed = diagnosticSnapshot(f.entry);
	f.entry.observeCatalogPublication?.(second.runtime, available);
	expect(diagnosticSnapshot(f.entry)).toBe(closed);
});

test("a diagnostic observer cannot admit a superseded attempt or start its SDK after reentrant disposal", async () => {
	const f = fixture();
	const port = f.entry.diagnostics;
	if (!port) throw new Error("Missing diagnostic port");
	let once = false;
	port.subscribe(() => {
		if (!once && port.snapshot().phase === "release") {
			once = true;
			void f.entry.dispose();
		}
	});
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot().kind).toBe("closed");
	expect(f.loads()).toBe(0);
	expect(f.runtimes()).toBe(0);
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "closed",
		reason: "disposed",
	});
});

const readableCapsule = JSON.stringify({
	deliveryTarget: "telegram",
	entryPath: "/telegram.1234abcd.js",
	manifest: {
		...manifest,
		projectSchemas: { readable: [1, 2], writable: [2] },
	},
});
function readonlyUnitRuntime(
	scope: VerifiedTelegramScope,
	start: () => Promise<boolean> = async () => true,
) {
	const controller = new AbortController();
	let closes = 0;
	return {
		scope,
		signal: controller.signal,
		sourceRecovery: {
			listRecoverySources: async () => [],
			readRecoverySource: async () => undefined,
		},
		start,
		listProjects: async () => ({ kind: "empty" as const }),
		exportProjectTransfer: async () => ({
			kind: "rejected" as const,
			reasonCode: "BACKUP_SCHEMA_UNREADABLE" as const,
		}),
		dispose: async () => {
			closes++;
			controller.abort();
		},
		closes: () => closes,
	};
}
test("a supported readable nonwritable release admits only the verified readonly runtime and preserves host readiness", async () => {
	let writable = 0,
		readonly = 0,
		ready = 0;
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(() => {
			ready++;
		}),
		createRuntime() {
			writable++;
			throw new Error("No writer may be constructed");
		},
		createReadonlyRuntime(_approval, scope) {
			readonly++;
			return readonlyUnitRuntime(scope);
		},
	});
	await expectCompleted(f.entry.start());
	const state = f.entry.snapshot();
	expect(state.kind).toBe("readonly");
	if (state.kind !== "readonly") throw new Error("Missing read-only mode");
	expect(writable).toBe(0);
	expect(readonly).toBe(1);
	expect(f.entry.shellReady(state)).toBe(false);
	expect(ready).toBe(0);
	expect(f.entry.ready(state.runtime)).toBe(true);
	expect(f.entry.ready(state.runtime)).toBe(false);
	expect(ready).toBe(1);
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "readonly",
		reason: "read-only",
	});
	await expectCompleted(f.entry.dispose());
	expect(state.runtime.signal.aborted).toBe(true);
});
test("readonly admission still requires signed launch and an actual successful current runtime start", async () => {
	let created = 0;
	const invalid = fixture({
		rawCapsule: readableCapsule,
		createReadonlyRuntime(_approval, scope) {
			created++;
			return readonlyUnitRuntime(scope);
		},
	});
	await expectCompleted(invalid.entry.start());
	expect(invalid.entry.snapshot()).toEqual({
		kind: "unavailable",
		reason: "launch",
	});
	expect(created).toBe(0);
	await expectCompleted(invalid.entry.dispose());
	let denied: ReturnType<typeof readonlyUnitRuntime> | undefined;
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createReadonlyRuntime(_approval, scope) {
			denied = readonlyUnitRuntime(scope, async () => false);
			return denied;
		},
	});
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot()).toEqual({
		kind: "unavailable",
		reason: "release",
	});
	expect(denied?.signal.aborted).toBe(true);
	expect(denied?.closes()).toBe(1);
	await expectCompleted(f.entry.dispose());
});
test("a same-scope readonly retry revokes the old ownership capability and cannot revive its readiness", async () => {
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createReadonlyRuntime: (_approval, scope) => readonlyUnitRuntime(scope),
	});
	await expectCompleted(f.entry.start());
	const first = f.entry.snapshot();
	if (first.kind !== "readonly") throw new Error("Missing first");
	expect(f.entry.ownsRuntime?.(first.runtime)).toBe(true);
	await expectCompleted(f.entry.start());
	const next = f.entry.snapshot();
	if (next.kind !== "readonly") throw new Error("Missing next");
	expect(next.mountKey).not.toBe(first.mountKey);
	expect(first.runtime.signal.aborted).toBe(true);
	expect(f.entry.ownsRuntime?.(first.runtime)).toBe(false);
	expect(f.entry.ready(first.runtime)).toBe(false);
	expect(f.entry.ownsRuntime?.(next.runtime)).toBe(true);
	await expectCompleted(f.entry.dispose());
	expect(f.entry.ownsRuntime?.(next.runtime)).toBe(false);
});

test("renderer capability loss during the actual writable handshake drains that runtime before readonly admission", async () => {
	let actual: TelegramRuntime | undefined,
		reads = 0,
		readonlyCreates = 0;
	const f = fixture({
		rawCapsule: JSON.stringify({
			deliveryTarget: "telegram",
			entryPath: "/telegram.1234abcd.js",
			manifest: { ...manifest, minimumCapabilities: ["indexeddb", "webgl2"] },
		}),
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		readCapabilities: () => ({ indexeddb: true, webgl2: ++reads === 1 }),
		createRuntime(approval, scope) {
			actual = dormantActualRuntime(approval, scope);
			return actual;
		},
		createReadonlyRuntime(_approval, scope) {
			readonlyCreates++;
			expect(actual?.session.signal.aborted).toBe(true);
			return readonlyUnitRuntime(scope);
		},
	});
	await expectCompleted(f.entry.start());
	const state = f.entry.snapshot();
	expect(state.kind).toBe("readonly");
	expect(readonlyCreates).toBe(1);
	expect(reads).toBeGreaterThan(1);
	if (state.kind !== "readonly") throw new Error("Missing readonly fallback");
	expect(f.entry.ready(state.runtime)).toBe(true);
	await expectCompleted(f.entry.dispose());
});
test("a changed worker during writable failure cannot obtain a readonly fallback from the old permit", async () => {
	let workers = 0,
		readonlyCreates = 0;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		readWorker: async () =>
			++workers === 1
				? { hasControllingWorker: false, workerManifest: undefined }
				: { hasControllingWorker: true, workerManifest: undefined },
		createRuntime: (approval, scope) =>
			dormantActualRuntime(approval, scope, false),
		createReadonlyRuntime(_approval, scope) {
			readonlyCreates++;
			return readonlyUnitRuntime(scope);
		},
	});
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot()).toEqual({
		kind: "unavailable",
		reason: "release",
	});
	expect(workers).toBe(2);
	expect(readonlyCreates).toBe(0);
	await expectCompleted(f.entry.dispose());
});
test("a readonly startup held across disposal is aborted synchronously, drained and never mounted late", async () => {
	let entered!: () => void, finish!: (value: boolean) => void;
	const entering = new Promise<void>((resolve) => {
		entered = resolve;
	});
	let current: ReturnType<typeof readonlyUnitRuntime> | undefined;
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createReadonlyRuntime(_approval, scope) {
			current = readonlyUnitRuntime(scope, () => {
				entered();
				return new Promise((resolve) => {
					finish = resolve;
				});
			});
			return current;
		},
	});
	const start = f.entry.start();
	await requireEntered(entering, start);
	const closing = f.entry.dispose();
	expect(current?.signal.aborted).toBe(true);
	let drained = false;
	void closing.then(() => {
		drained = true;
	});
	await Promise.resolve();
	expect(drained).toBe(false);
	finish(true);
	await expectCompleted(start);
	await expectCompleted(closing);
	expect(f.entry.snapshot()).toEqual({ kind: "closed" });
	expect(current?.closes()).toBe(1);
});

test("diagnostics retain actual verification outcomes while every rejected signed launch leaves all runtime factories closed", async () => {
	const changed = new URLSearchParams(signedExample);
	changed.set("user", JSON.stringify({ id: 0, first_name: "SECRET_NAME" }));
	const invalidSignature = new URLSearchParams(signedExample);
	invalidSignature.set("chat_instance", "1");
	const examples = [
		{
			raw: changed.toString(),
			now: 1_733_584_787_000,
			reason: "invalid-identity",
		},
		{ raw: signedExample, now: Number.NaN, reason: "invalid-clock" },
		{
			raw: signedExample,
			now: 1_733_584_787_000 + 301_000,
			reason: "expired-launch",
		},
		{
			raw: invalidSignature.toString(),
			now: 1_733_584_787_000,
			reason: "invalid-signature",
		},
	];
	for (const example of examples) {
		let readonlyCreates = 0;
		const f = fixture({
			rawCapsule: readableCapsule,
			configuration: { ...configuration, botId: "7342037359" },
			nowEpochMs: () => example.now,
			source: {
				read: () => ({ initData: example.raw, ready() {}, close() {} }),
				start() {
					throw new Error("Unexpected script request");
				},
			},
			createReadonlyRuntime(_approval, scope) {
				readonlyCreates++;
				return readonlyUnitRuntime(scope);
			},
		});
		await expectCompleted(f.entry.start());
		expect(f.entry.snapshot()).toEqual({
			kind: "unavailable",
			reason: "launch",
		});
		expect(diagnosticSnapshot(f.entry)).toMatchObject({
			phase: "verification",
			reason: example.reason,
		});
		expect(JSON.stringify(diagnosticSnapshot(f.entry))).not.toContain(
			"SECRET_NAME",
		);
		expect(readonlyCreates).toBe(0);
		expect(f.runtimes()).toBe(0);
		await expectCompleted(f.entry.dispose());
	}
});
test("diagnostics distinguish an unsupported loaded host from an SDK delivery failure", async () => {
	for (const broken of ["host", "delivery"] as const) {
		const f = fixture({
			source:
				broken === "host"
					? {
							read: () => ({ initData: signedExample }),
							start() {
								throw new Error("Already loaded");
							},
						}
					: {
							read: () => undefined,
							start(_loaded, failed) {
								failed();
								return () => undefined;
							},
						},
		});
		await expectCompleted(f.entry.start());
		expect(diagnosticSnapshot(f.entry)).toMatchObject({
			phase: "sdk",
			reason: broken === "host" ? "unsupported-host" : "sdk-load-failed",
		});
		expect(f.runtimes()).toBe(0);
		await expectCompleted(f.entry.dispose());
	}
});
test("the local diagnostic lifecycle follows the actual admission attempt and preserves its measured capabilities", async () => {
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createRuntime: (approval, scope) => dormantActualRuntime(approval, scope),
	});
	const phases: string[] = [];
	f.entry.diagnostics?.subscribe(() => {
		phases.push(diagnosticSnapshot(f.entry).phase);
	});
	await expectCompleted(f.entry.start());
	expect(phases).toEqual(["checking", "release", "sdk", "storage", "editor"]);
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "editor",
		reason: "ready",
		capabilities: { indexeddb: true, webgl2: false },
	});
	await expectCompleted(f.entry.dispose());
	expect(phases.at(-1)).toBe("closed");
});

test("secure readable storage without Web Locks admits the explicit readonly destination and never constructs a writer", async () => {
	let readonlyCreates = 0,
		writers = 0;
	const f = fixture({
		webLocks: false,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createRuntime() {
			writers++;
			throw new Error("A lock-free context cannot write");
		},
		createReadonlyRuntime(_approval, scope) {
			readonlyCreates++;
			return readonlyUnitRuntime(scope);
		},
	});
	await expectCompleted(f.entry.start());
	expect(f.entry.snapshot().kind).toBe("readonly");
	expect(readonlyCreates).toBe(1);
	expect(writers).toBe(0);
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "readonly",
		capabilities: { webLocks: false },
	});
	await expectCompleted(f.entry.dispose());
});

test("verified readable storage keeps backup access when writer-only technical construction fails", async () => {
	let reads = 0,
		readonlyCreates = 0;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		readWorker: async () => {
			reads++;
			return { hasControllingWorker: false, workerManifest: undefined };
		},
		createRuntime() {
			throw new Error("SECRET_WRITER_TECHNICAL_CONTEXT");
		},
		createReadonlyRuntime(_approval, scope) {
			readonlyCreates++;
			return readonlyUnitRuntime(scope);
		},
	});
	await expectCompleted(f.entry.start());
	const state = f.entry.snapshot();
	expect(state.kind).toBe("readonly");
	expect(readonlyCreates).toBe(1);
	expect(reads).toBe(2);
	expect(JSON.stringify(diagnosticSnapshot(f.entry))).not.toContain("SECRET_");
	if (state.kind !== "readonly") throw new Error("Missing readable fallback");
	expect(f.entry.ready(state.runtime)).toBe(true);
	await expectCompleted(f.entry.dispose());
});

test("an admitted readonly entry renders a distinct export-only screen with local diagnostics and no writer controls", async () => {
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createReadonlyRuntime: (_approval, scope) => readonlyUnitRuntime(scope),
	});
	await expectCompleted(f.entry.start());
	const markup = renderToStaticMarkup(
		createElement(TelegramEditorApp, {
			session: f.entry,
			catalogGateway: {
				currentPublication: async () => {
					throw new Error("Readonly UI must not request catalog");
				},
				resource: async () => {
					throw new Error("Readonly UI must not request remote resources");
				},
			},
		}),
	);
	expect(markup).toContain("Просмотр проектов");
	expect(markup).toContain("Данные для проверки");
	expect(markup).not.toContain("Создать проект");
	expect(markup).not.toContain("Импортировать");
	expect(markup).not.toContain("Удалить проект");
	await expectCompleted(f.entry.dispose());
});

test("readonly availability diagnostics belong only to the private current runtime, including an aborted current view with usable retry", async () => {
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createReadonlyRuntime: (_approval, scope) => readonlyUnitRuntime(scope),
	});
	await expectCompleted(f.entry.start());
	const first = f.entry.snapshot();
	if (first.kind !== "readonly") throw new Error("Missing readonly view");
	const unchanged = diagnosticSnapshot(f.entry);
	f.entry.observeReadonlyProblem?.({}, "source-unavailable");
	expect(diagnosticSnapshot(f.entry)).toBe(unchanged);
	f.entry.observeReadonlyProblem?.(first.runtime, "backup-unavailable");
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "readonly",
		reason: "backup-unavailable",
	});
	await first.runtime.dispose();
	expect(f.entry.ownsRuntime(first.runtime)).toBe(true);
	await expectCompleted(f.entry.start());
	const current = f.entry.snapshot();
	if (current.kind !== "readonly") throw new Error("Missing current");
	const fresh = diagnosticSnapshot(f.entry);
	f.entry.observeReadonlyProblem?.(first.runtime, "source-unavailable");
	expect(diagnosticSnapshot(f.entry)).toBe(fresh);
	f.entry.observeReadonlyProblem?.(current.runtime, "file-unavailable");
	expect(diagnosticSnapshot(f.entry).reason).toBe("file-unavailable");
	await expectCompleted(f.entry.dispose());
	const closed = diagnosticSnapshot(f.entry);
	f.entry.observeReadonlyProblem?.(current.runtime, "source-unavailable");
	expect(diagnosticSnapshot(f.entry)).toBe(closed);
});

test("entry recovery markup keeps supported retry, exit and public links separate from the initial checking state", async () => {
	const gateway = {
		currentPublication: async () => {
			throw new Error("Fallback cannot request catalog");
		},
		resource: async () => {
			throw new Error("Fallback cannot request resources");
		},
	};
	const f = fixture({ configuration: { ...configuration, botId: "" } });
	const checking = renderToStaticMarkup(
		createElement(TelegramEditorApp, {
			session: f.entry,
			catalogGateway: gateway,
		}),
	);
	expect(checking).toContain("Открытие редактора");
	expect(checking).toContain("Проверяем запуск и локальное хранилище");
	expect(checking).not.toContain("Повторить запуск");
	expect(checking).not.toContain("Просмотр проектов");
	await expectCompleted(f.entry.start());
	const fallback = renderToStaticMarkup(
		createElement(TelegramEditorApp, {
			session: f.entry,
			catalogGateway: gateway,
		}),
	);
	expect(fallback).toContain("Не удалось открыть редактор");
	expect(fallback).toContain("Этот Telegram-редактор пока не настроен");
	expect(fallback).toContain("Повторить запуск");
	expect(fallback).toContain("Выйти");
	expect(fallback).toContain("Открыть веб-редактор");
	expect(fallback).toContain("Открыть в Telegram");
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "configuration",
		reason: "configuration-invalid",
	});
	await expectCompleted(f.entry.dispose());
});

function entryGate<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
test("readonly fallback cannot start until the failed writer's complete owned shutdown finishes", async () => {
	const closing = entryGate<void>(),
		entered = entryGate<void>();
	let readers = 0;
	let writer: TelegramRuntime | undefined;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createRuntime(approval, scope) {
			writer = dormantActualRuntime(approval, scope, false);
			const actual = writer;
			return {
				...actual,
				dispose() {
					void actual.dispose();
					entered.resolve();
					return closing.promise;
				},
			};
		},
		createReadonlyRuntime(_approval, scope) {
			readers++;
			return readonlyUnitRuntime(scope);
		},
	});
	const starting = f.entry.start();
	await requireEntered(entered.promise, starting);
	expect(readers).toBe(0);
	expect(f.entry.snapshot().kind).toBe("checking");
	if (!writer) throw new Error("Missing owned writer");
	expect(writer.session.signal.aborted).toBe(true);
	expect(f.entry.ready(writer)).toBe(false);
	expect(f.entry.ownsRuntime(writer)).toBe(false);
	closing.resolve();
	await expectCompleted(starting);
	expect(readers).toBe(1);
	expect(f.entry.snapshot().kind).toBe("readonly");
	await expectCompleted(f.entry.dispose());
});
for (const mode of ["throw", "reject"] as const)
	for (const missing of [false, true])
		test(`writer shutdown ${mode} with ${missing ? "undefined" : "an owned error"} refuses readonly replacement and preserves exact disposal failure`, async () => {
			const failure = missing ? undefined : new Error("SECRET_NATIVE_SHUTDOWN");
			let readers = 0;
			const f = fixture({
				configuration: { ...configuration, botId: "7342037359" },
				nowEpochMs: () => 1_733_584_787_000,
				source: signedSource(),
				createRuntime(approval, scope) {
					const actual = dormantActualRuntime(approval, scope, false);
					return {
						...actual,
						dispose() {
							void actual.dispose();
							if (mode === "throw") throw failure;
							return Promise.reject(failure);
						},
					};
				},
				createReadonlyRuntime(_approval, scope) {
					readers++;
					return readonlyUnitRuntime(scope);
				},
			});
			await expectCompleted(f.entry.start());
			expect(readers).toBe(0);
			expect(f.entry.snapshot()).toEqual({
				kind: "unavailable",
				reason: "storage",
			});
			expect(diagnosticSnapshot(f.entry)).toMatchObject({
				phase: "storage",
				reason: "storage-failed",
			});
			expect(JSON.stringify(diagnosticSnapshot(f.entry))).not.toContain(
				"SECRET_",
			);
			const disposed = f.entry.dispose();
			expect(f.entry.dispose()).toBe(disposed);
			await expect(withinDeadline(disposed)).rejects.toBe(failure);
		});
for (const mode of ["throw", "reject"] as const)
	test(`an admitted readonly runtime's ${mode} during dispose stays closed and preserves its exact native failure`, async () => {
		const failure = new Error("SECRET_READONLY_DRAIN");
		const f = fixture({
			rawCapsule: readableCapsule,
			configuration: { ...configuration, botId: "7342037359" },
			nowEpochMs: () => 1_733_584_787_000,
			source: signedSource(),
			createReadonlyRuntime(_approval, scope) {
				const actual = readonlyUnitRuntime(scope);
				return {
					...actual,
					dispose() {
						void actual.dispose();
						if (mode === "throw") throw failure;
						return Promise.reject(failure);
					},
				};
			},
		});
		await expectCompleted(f.entry.start());
		const before = f.entry.snapshot();
		if (before.kind !== "readonly")
			throw new Error("Missing admitted readonly view");
		const disposed = f.entry.dispose();
		expect(f.entry.snapshot()).toEqual({ kind: "closed" });
		expect(f.entry.ownsRuntime(before.runtime)).toBe(false);
		expect(f.entry.dispose()).toBe(disposed);
		await expect(withinDeadline(disposed)).rejects.toBe(failure);
		expect(JSON.stringify(diagnosticSnapshot(f.entry))).not.toContain(
			"SECRET_",
		);
	});
test("structured-looking arrays and callable configuration objects cannot impersonate public deployment data", () => {
	for (const invalid of [
		Object.assign([], configuration),
		Object.assign(() => undefined, configuration),
	])
		expect(parseTelegramDeploymentConfiguration(invalid)).toEqual({
			kind: "unavailable",
			links: {},
		});
});
test("SDK readiness failure followed by native drain failure reports the final storage reason without private errors", async () => {
	const failure = new Error("SECRET_READY_DRAIN");
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(() => {
			throw new Error("SECRET_READY");
		}),
		createRuntime(approval, scope) {
			const actual = dormantActualRuntime(approval, scope);
			return {
				...actual,
				dispose() {
					void actual.dispose();
					return Promise.reject(failure);
				},
			};
		},
	});
	await expectCompleted(f.entry.start());
	const state = f.entry.snapshot();
	if (state.kind !== "editor")
		throw new Error("Missing actual admitted writer");
	expect(f.entry.ready(state.runtime)).toBe(false);
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	expect(f.entry.snapshot()).toEqual({
		kind: "unavailable",
		reason: "storage",
	});
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "storage",
		reason: "storage-failed",
	});
	expect(JSON.stringify(diagnosticSnapshot(f.entry))).not.toContain("SECRET_");
	await expect(withinDeadline(f.entry.dispose())).rejects.toBe(failure);
});

for (const reason of ["storage", "release"] as const)
	test(`entry reports ${reason} when the actual release preflight refuses before any SDK access`, async () => {
		let reads = 0;
		const f = fixture({
			...(reason === "storage"
				? { readCapabilities: () => ({ indexeddb: false, webgl2: false }) }
				: { loadedEntryPath: "/telegram.foreign.js" }),
			source: {
				read() {
					reads++;
					return undefined;
				},
				start() {
					throw new Error("Forbidden loader");
				},
			},
		});
		await expectCompleted(f.entry.start());
		expect(f.entry.snapshot()).toEqual({ kind: "unavailable", reason });
		expect(diagnosticSnapshot(f.entry)).toMatchObject({
			phase: "release",
			reason:
				reason === "storage" ? "storage-unavailable" : "release-incompatible",
		});
		expect(reads).toBe(0);
		await expectCompleted(f.entry.dispose());
	});
test("a loaded SDK timeout remains distinct from a launch rejection and closes without a late runtime", async () => {
	rstest.useFakeTimers();
	let loading = 0,
		stop = 0,
		loaded: (() => void) | undefined;
	const f = fixture({
		source: {
			read: () => undefined,
			start(done) {
				loading++;
				loaded = done;
				return () => {
					stop++;
				};
			},
		},
	});
	try {
		const starting = f.entry.start();
		await rstest.advanceTimersByTimeAsync(10000);
		await expectCompleted(starting);
		expect(loading).toBe(1);
		expect(f.entry.snapshot()).toEqual({
			kind: "unavailable",
			reason: "timeout",
		});
		expect(diagnosticSnapshot(f.entry)).toMatchObject({
			phase: "sdk",
			reason: "timeout",
		});
		expect(f.runtimes()).toBe(0);
		await expectCompleted(f.entry.dispose());
		loaded?.();
		expect(f.entry.snapshot()).toEqual({ kind: "closed" });
		expect(stop).toBe(1);
	} finally {
		rstest.useRealTimers();
	}
});
for (const boundary of [
	"source-read",
	"host-connect",
	"readonly-factory",
] as const)
	test(`reentrant disposal at ${boundary} cannot publish or retain its returned capabilities`, async () => {
		let f: ReturnType<typeof fixture>,
			runtime: ReturnType<typeof readonlyUnitRuntime> | undefined,
			connected:
				| ReturnType<
						import("../adapters/telegram/host-environment").TelegramHostCapture["connect"]
				  >
				| undefined,
			creates = 0,
			closing: Promise<void> | undefined;
		const sdk = { initData: signedExample, ready() {}, close() {} };
		f = fixture({
			rawCapsule: readableCapsule,
			configuration: { ...configuration, botId: "7342037359" },
			nowEpochMs: () => 1733584787000,
			source: {
				read() {
					if (boundary === "source-read") closing = f.entry.dispose();
					return sdk;
				},
				start() {
					throw new Error("Already loaded");
				},
			},
			connectHost(capture) {
				connected = capture.connect({
					onContextChanged() {},
					style: hostStyle(),
					readBrowser: () => ({
						height: 700,
						width: 390,
						visible: true,
						focused: true,
					}),
					subscribeBrowser: () => () => undefined,
					readCurrentSdk: () => sdk,
				});
				if (boundary === "host-connect") closing = f.entry.dispose();
				return connected;
			},
			createReadonlyRuntime(_approval, scope) {
				creates++;
				runtime = readonlyUnitRuntime(scope);
				if (boundary === "readonly-factory") closing = f.entry.dispose();
				return runtime;
			},
		});
		await expectCompleted(f.entry.start());
		await expectCompleted(closing);
		expect(f.entry.snapshot()).toEqual({ kind: "closed" });
		expect(creates).toBe(boundary === "readonly-factory" ? 1 : 0);
		if (runtime) {
			expect(runtime.signal.aborted).toBe(true);
			expect(runtime.closes()).toBe(1);
			expect(f.entry.ownsRuntime(runtime)).toBe(false);
		}
		await expectCompleted(f.entry.dispose());
	});
for (const phase of ["sdk", "storage", "readonly"] as const)
	test(`an observer closing the ${phase} diagnostic cannot admit the retired readonly view`, async () => {
		let creates = 0,
			retired: ReturnType<typeof readonlyUnitRuntime> | undefined;
		const f = fixture({
			rawCapsule: readableCapsule,
			configuration: { ...configuration, botId: "7342037359" },
			nowEpochMs: () => 1733584787000,
			source: signedSource(),
			createReadonlyRuntime(_approval, scope) {
				creates++;
				retired = readonlyUnitRuntime(scope);
				return retired;
			},
		});
		let closing: Promise<void> | undefined;
		f.entry.diagnostics?.subscribe(() => {
			if (diagnosticSnapshot(f.entry).phase === phase && !closing)
				closing = f.entry.dispose();
		});
		await expectCompleted(f.entry.start());
		await expectCompleted(closing);
		expect(f.entry.snapshot()).toEqual({ kind: "closed" });
		expect(creates).toBe(phase === "readonly" ? 1 : 0);
		if (retired) {
			expect(retired.signal.aborted).toBe(true);
			expect(f.entry.ready(retired)).toBe(false);
		}
		await expectCompleted(f.entry.dispose());
	});
test("a superseded held readonly start cannot publish after its replacement is already ready", async () => {
	const firstEntered = deferred<void>(),
		firstDone = deferred<boolean>();
	let creates = 0;
	const observed: string[] = [];
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1733584787000,
		source: signedSource(),
		createReadonlyRuntime(_approval, scope) {
			creates++;
			return readonlyUnitRuntime(
				scope,
				creates === 1
					? () => {
							firstEntered.resolve();
							return firstDone.promise;
						}
					: async () => true,
			);
		},
	});
	f.entry.subscribe(() => {
		const state = f.entry.snapshot();
		if (state.kind === "readonly") observed.push(state.mountKey);
	});
	const old = f.entry.start();
	await requireEntered(firstEntered.promise, old);
	const replacing = f.entry.start();
	await expectCompleted(replacing);
	const current = f.entry.snapshot();
	if (current.kind !== "readonly") throw new Error("Missing fresh view");
	firstDone.resolve(true);
	await expectCompleted(old);
	expect(f.entry.snapshot()).toBe(current);
	expect(observed).toEqual([current.mountKey]);
	expect(creates).toBe(2);
	await expectCompleted(f.entry.dispose());
});
test("ownership checks expose neither a checking private runtime nor a foreign admitted object", async () => {
	const entered = deferred<void>(),
		finish = deferred<boolean>();
	let owned: ReturnType<typeof readonlyUnitRuntime> | undefined;
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1733584787000,
		source: signedSource(),
		createReadonlyRuntime(_approval, scope) {
			owned = readonlyUnitRuntime(scope, () => {
				entered.resolve();
				return finish.promise;
			});
			return owned;
		},
	});
	const starting = f.entry.start();
	await requireEntered(entered.promise, starting);
	if (!owned) throw new Error("Missing actual private runtime");
	expect(f.entry.ownsRuntime(owned)).toBe(false);
	expect(f.entry.ownsRuntime({ ...owned })).toBe(false);
	f.entry.observeReadonlyProblem?.(owned, "source-unavailable");
	expect(diagnosticSnapshot(f.entry)).toMatchObject({
		phase: "storage",
		reason: "checking",
	});
	finish.resolve(true);
	await expectCompleted(starting);
	expect(f.entry.ownsRuntime(owned)).toBe(true);
	expect(f.entry.ownsRuntime({ ...owned })).toBe(false);
	const before = diagnosticSnapshot(f.entry);
	f.entry.observeCatalogPublication?.(owned, { kind: "unavailable" });
	expect(diagnosticSnapshot(f.entry)).toBe(before);
	await expectCompleted(f.entry.dispose());
});

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

// Capture the real scheduler before cases enable fake application timers.
const scheduleObservation = globalThis.setTimeout;
const cancelObservation = globalThis.clearTimeout;

type Observed<T> =
	| { readonly kind: "fulfilled"; readonly value: T }
	| { readonly kind: "rejected"; readonly reason: unknown }
	| { readonly kind: "pending" };
function observeCompletion<T>(operation: Promise<T>): Promise<Observed<T>> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const settled: Promise<Observed<T>> = operation.then(
		(value) => ({ kind: "fulfilled", value }),
		(reason) => ({ kind: "rejected", reason }),
	);
	const pending = new Promise<Observed<T>>((resolve) => {
		timer = scheduleObservation(() => resolve({ kind: "pending" }), 750);
	});
	return Promise.race([settled, pending]).finally(() => {
		if (timer !== undefined) cancelObservation(timer);
	});
}
/** Public noncompletion is a named assertion, never the runner's body timeout. */
async function expectCompleted<T>(
	operation: Promise<T> | undefined,
): Promise<T> {
	expect(operation).toBeDefined();
	if (!operation) throw new Error("Public operation was not started");
	const result = await observeCompletion(operation);
	expect(result.kind).toBe("fulfilled");
	if (result.kind !== "fulfilled")
		throw new Error("Public operation did not fulfill");
	return result.value;
}
function withinDeadline<T>(operation: Promise<T>): Promise<T> {
	return observeCompletion(operation).then((result) => {
		if (result.kind === "pending")
			throw new Error("Public operation did not settle");
		if (result.kind === "rejected") return Promise.reject(result.reason);
		return result.value;
	});
}
/** A fake held step races actual public completion, including an early refusal. */
async function requireEntered(
	entered: Promise<void>,
	operation: Promise<unknown>,
): Promise<void> {
	const phase = await expectCompleted(
		Promise.race([
			entered.then(() => "entered" as const),
			operation.then(
				() => "completed" as const,
				() => "completed" as const,
			),
		]),
	);
	expect(phase).toBe("entered");
}

test("a superseded readonly false result cannot close its already-ready replacement", async () => {
	const entered = deferred<void>(),
		firstDone = deferred<boolean>();
	let creates = 0;
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createReadonlyRuntime(_approval, scope) {
			return readonlyUnitRuntime(
				scope,
				++creates === 1
					? () => {
							entered.resolve();
							return firstDone.promise;
						}
					: async () => true,
			);
		},
	});
	const old = f.entry.start();
	await requireEntered(entered.promise, old);
	await expectCompleted(f.entry.start());
	const current = f.entry.snapshot();
	if (current.kind !== "readonly")
		throw new Error("Missing replacement reader");
	expect(f.entry.ready(current.runtime)).toBe(true);
	firstDone.resolve(false);
	await expect(withinDeadline(old)).resolves.toBeUndefined();
	expect(f.entry.snapshot()).toBe(current);
	expect(f.entry.ownsRuntime(current.runtime)).toBe(true);
	expect(current.runtime.signal.aborted).toBe(false);
	await expect(withinDeadline(f.entry.dispose())).resolves.toBeUndefined();
});

test("a superseded worker rejection cannot stop the already-ready current editor", async () => {
	const entered = deferred<void>();
	let rejectWorker!: (reason: unknown) => void;
	const oldWorker = new Promise<never>((_resolve, reject) => {
		rejectWorker = reject;
	});
	let workers = 0;
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		readWorker() {
			if (++workers === 1) {
				entered.resolve();
				return oldWorker;
			}
			return Promise.resolve({
				hasControllingWorker: false,
				workerManifest: undefined,
			});
		},
		createRuntime: (approval, scope) => dormantActualRuntime(approval, scope),
	});
	const old = f.entry.start();
	await requireEntered(entered.promise, old);
	await expectCompleted(f.entry.start());
	const current = f.entry.snapshot();
	if (current.kind !== "editor")
		throw new Error("Missing current actual editor");
	expect(f.entry.ready(current.runtime)).toBe(true);
	rejectWorker(new Error("SECRET_OLD_WORKER_FAILURE"));
	await expect(withinDeadline(old)).resolves.toBeUndefined();
	expect(f.entry.snapshot()).toBe(current);
	expect(f.entry.ownsRuntime(current.runtime)).toBe(true);
	expect(current.runtime.session.signal.aborted).toBe(false);
	expect(JSON.stringify(diagnosticSnapshot(f.entry))).not.toContain("SECRET_");
	await expect(withinDeadline(f.entry.dispose())).resolves.toBeUndefined();
});

for (const missing of [false, true]) {
	test(`a fulfilled pending start cannot hide the later owned drain rejection with ${missing ? "undefined" : "an Error"}`, async () => {
		const failure = missing ? undefined : new Error("SECRET_MIXED_DRAIN");
		const entered = deferred<void>();
		let rejectDrain!: (reason: unknown) => void;
		const ownedDrain = new Promise<void>((_resolve, reject) => {
			rejectDrain = reject;
		});
		let closing: Promise<void> | undefined;
		const f = fixture({
			configuration: { ...configuration, botId: "7342037359" },
			nowEpochMs: () => 1_733_584_787_000,
			source: signedSource(),
			createRuntime(approval, scope) {
				const actual = dormantActualRuntime(approval, scope);
				return {
					...actual,
					dispose() {
						void actual.dispose();
						entered.resolve();
						return ownedDrain;
					},
				};
			},
		});
		f.entry.subscribe(() => {
			if (f.entry.snapshot().kind === "editor") closing = f.entry.dispose();
		});
		const starting = f.entry.start();
		await requireEntered(entered.promise, starting);
		await expect(withinDeadline(starting)).resolves.toBeUndefined();
		if (!closing) throw new Error("Missing synchronous owned shutdown");
		expect(f.entry.snapshot()).toEqual({ kind: "closed" });
		expect(f.entry.dispose()).toBe(closing);
		let settled = false;
		void closing.then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);
		await Promise.resolve();
		expect(settled).toBe(false);
		const exactRejection = expect(withinDeadline(closing)).rejects.toBe(
			failure,
		);
		rejectDrain(failure);
		await exactRejection;
		expect(settled).toBe(true);
	});
}

test("the readonly snapshot retains its exact connected host navigation environment", async () => {
	const sdk = {
		initData: signedExample,
		ready() {},
		close() {},
		version: "8.0",
	};
	const style = hostStyle();
	let environment:
		| ReturnType<
				import("../adapters/telegram/host-environment").TelegramHostCapture["connect"]
		  >
		| undefined;
	const f = fixture({
		rawCapsule: readableCapsule,
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: { read: () => sdk, start: () => () => undefined },
		connectHost(capture, onContextChanged) {
			environment = capture.connect({
				style,
				readBrowser: () => ({
					height: 700,
					width: 390,
					visible: true,
					focused: true,
				}),
				subscribeBrowser: () => () => undefined,
				readCurrentSdk: () => sdk,
				onContextChanged,
			});
			return environment;
		},
		createReadonlyRuntime: (_approval, scope) => readonlyUnitRuntime(scope),
	});
	await expectCompleted(f.entry.start());
	const current = f.entry.snapshot();
	if (current.kind !== "readonly" || !environment)
		throw new Error("Missing connected readonly view");
	expect(current.hostEnvironment).toBe(environment);
	expect(current.hostEnvironment?.navigation).toBe(environment.navigation);
	expect(environment.lifecycle.snapshot().active).toBe(true);
	const closing = f.entry.dispose();
	expect(environment.lifecycle.snapshot().active).toBe(false);
	expect(style.values.size).toBe(0);
	await expect(withinDeadline(closing)).resolves.toBeUndefined();
});

test("editor ownership accepts the actual current runtime and rejects clones, old runtimes and closed views", async () => {
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1_733_584_787_000,
		source: signedSource(),
		createRuntime: (approval, scope) => dormantActualRuntime(approval, scope),
	});
	await expectCompleted(f.entry.start());
	const first = f.entry.snapshot();
	if (first.kind !== "editor") throw new Error("Missing first actual editor");
	expect(f.entry.ownsRuntime(first.runtime)).toBe(true);
	expect(f.entry.ownsRuntime({ ...first.runtime })).toBe(false);
	await expectCompleted(f.entry.start());
	const next = f.entry.snapshot();
	if (next.kind !== "editor")
		throw new Error("Missing replacement actual editor");
	expect(f.entry.ownsRuntime(first.runtime)).toBe(false);
	expect(f.entry.ownsRuntime(next.runtime)).toBe(true);
	expect(f.entry.ownsRuntime({ ...next.runtime })).toBe(false);
	await expect(withinDeadline(f.entry.dispose())).resolves.toBeUndefined();
	expect(f.entry.ownsRuntime(next.runtime)).toBe(false);
});

function legalFixture(overrides: Partial<Parameters<typeof createTelegramEntrySession>[0]> = {}) {
	const accepted = new Set<string>();
	let readable = true, canSave = true, writable = 0;
	const sdk = { initData: signedExample, ready() {}, close() {} };
	const f = fixture({
		configuration: { ...configuration, botId: "7342037359" },
		nowEpochMs: () => 1733584787000,
		source: { ...signedSource(), read: () => sdk },
		legal: {
			readable: () => readable,
			receipts: { has: (scope) => accepted.has(scope), accept: (scope) => {
				if (canSave) accepted.add(scope);
				return canSave;
			} },
		},
		createRuntime(approval, scope) { writable++; return dormantActualRuntime(approval, scope); },
		createReadonlyRuntime: (_approval, scope) => readonlyUnitRuntime(scope),
		...overrides,
	});
	const prompt = () => {
		const state = f.entry.snapshot();
		if (state.kind !== "legal") throw new Error("Expected verified legal entry before the writable runtime");
		return state;
	};
	return { ...f, accepted, prompt, writable: () => writable,
		loseLaunch: () => { sdk.initData = ""; }, disableStorage: () => { canSave = false; }, removeText: () => { readable = false; } };
}
test("verified first use waits for a current readable license and records the user's choice before opening a writer", async () => {
	const f = legalFixture();
	await f.entry.start();
	expect(f.writable()).toBe(0);
	const entry = f.prompt();
	expect(entry.scope).toMatch(/^tma-v1-[a-f0-9]{64}$/);
	await entry.proceed();
	expect(f.entry.snapshot().kind).toBe("editor");
	expect(f.accepted.has(entry.scope)).toBe(true);
	const admitted = f.entry.snapshot();
	if (admitted.kind !== "editor") throw Error("Expected a writable editor");
	expect(admitted.authenticatedAt).toBe(1733584787);
	await f.entry.start();
	expect(f.entry.snapshot().kind).toBe("editor");
	await f.entry.dispose();
});
test("declining opens the verified readonly directory without a writer or a receipt", async () => {
	const f = legalFixture();
	await f.entry.start();
	await f.prompt().readOnly();
	const state = f.entry.snapshot();
	expect(state.kind).toBe("readonly");
	if (state.kind === "readonly") expect(await state.runtime.listProjects()).toEqual({ kind: "empty" });
	expect(f.writable()).toBe(0);
	expect(f.accepted.size).toBe(0);
	await f.entry.dispose();
});
test("unavailable receipt storage or unavailable current text keeps the legal and readonly actions available", async () => {
	for (const fail of ["storage", "text"]) {
		const f = legalFixture();
		await f.entry.start();
		if (fail === "storage") f.disableStorage(); else f.removeText();
		await f.prompt().proceed();
		expect(f.prompt().error).toBe(fail);
		expect(f.writable()).toBe(0);
		expect(f.accepted.size).toBe(0);
		await f.prompt().readOnly();
		expect(f.entry.snapshot().kind).toBe("readonly");
		await f.entry.dispose();
	}
});
test("a changed host launch cannot reuse the previous account's legal action", async () => {
	const f = legalFixture();
	await f.entry.start();
	const old = f.prompt();
	f.loseLaunch();
	await old.proceed();
	expect(f.entry.snapshot().kind).toBe("unavailable");
	await old.readOnly();
	expect(f.writable()).toBe(0);
	expect(f.accepted.size).toBe(0);
	await f.entry.dispose();
});
test("declining a license without a supported readonly runtime never opens the writer", async () => {
	const f = legalFixture({ createReadonlyRuntime: undefined });
	await f.entry.start();
	await f.prompt().readOnly();
	expect(f.entry.snapshot()).toEqual({ kind: "unavailable", reason: "release" });
	expect(f.writable()).toBe(0);
	await f.entry.dispose();
});

test("the verified first-use shell owns the live host navigation and a failed reveal offers retry", async () => {
	const sdk = { initData: signedExample, ready() { throw Error("SDK unavailable"); }, close() {}, version: "8.0" };
	const f = legalFixture({
		source: { ...signedSource(), read: () => sdk },
		connectHost: (capture, onContextChanged) => capture.connect({
			style: hostStyle(), readBrowser: () => ({ width: 390, height: 800, visible: true, focused: true }),
			subscribeBrowser: () => () => undefined, readCurrentSdk: () => sdk, onContextChanged,
		}),
	});
	await f.entry.start();
	const state = f.prompt();
	expect(state.hostEnvironment?.navigation).toBeDefined();
	expect(f.entry.shellReady(state)).toBe(false);
	expect(f.entry.snapshot()).toEqual({ kind: "unavailable", reason: "launch" });
	await state.proceed();
	expect(f.writable()).toBe(0);
	await f.entry.dispose();
});

for (const choice of ["proceed", "readOnly"] as const)
	test(`verified users can finish reading for ten minutes before choosing ${choice}`, async () => {
		let now = 1_733_584_787_000;
		const f = legalFixture({ nowEpochMs: () => now });
		await f.entry.start();
		const prompt = f.prompt();
		now += 600_000;
		await prompt[choice]();
		expect(f.entry.snapshot().kind).toBe(choice === "proceed" ? "editor" : "readonly");
		expect(f.writable()).toBe(choice === "proceed" ? 1 : 0);
		await f.entry.dispose();
	});

test("one verified WebView is revealed once across legal review and editor admission", async () => {
	let reveals = 0;
	const sdk = { initData: signedExample, ready() { reveals++; }, close() {} };
	const f = legalFixture({ source: { ...signedSource(), read: () => sdk } });
	await f.entry.start();
	const prompt = f.prompt();
	expect(f.entry.shellReady(prompt)).toBe(true);
	await prompt.proceed();
	const editor = f.entry.snapshot();
	if (editor.kind !== "editor") throw new Error("Expected writable editor after acceptance");
	expect(f.entry.ready(editor.runtime)).toBe(true);
	expect(reveals).toBe(1);
	await f.entry.dispose();
});

test("a legal screen closes cleanly while reading and cannot be revived", async () => {
	const f = legalFixture();
	await f.entry.start();
	const original = f.prompt();
	expect(original.error).toBeUndefined();
	await expectCompleted(f.entry.exit());
	await expectCompleted(original.proceed());
	await expectCompleted(original.readOnly());
	expect(f.entry.snapshot()).toEqual({ kind: "closed" });
	expect(f.accepted.size).toBe(0);
	expect(f.writable()).toBe(0);
	expect(f.closed()).toBe(1);
});

test("only the currently offered legal decision can resolve its admission", async () => {
	const f = legalFixture();
	f.disableStorage();
	await f.entry.start();
	const original = f.prompt();
	const saving = original.proceed();
	expect(f.entry.snapshot()).toEqual({ kind: "checking" });
	await expectCompleted(saving);
	const retry = f.prompt();
	expect(retry.error).toBe("storage");
	await expectCompleted(original.readOnly());
	expect(f.entry.snapshot()).toBe(retry);
	const reading = retry.readOnly();
	expect(f.entry.snapshot()).toEqual({ kind: "checking" });
	await expectCompleted(reading);
	expect(f.entry.snapshot().kind).toBe("readonly");
	await expectCompleted(original.proceed());
	expect(f.entry.snapshot().kind).toBe("readonly");
	await expectCompleted(f.entry.dispose());
});

test("the host can revoke its context during the legal action's SDK read", async () => {
	const sdk = { initData: signedExample, ready() {}, close() {} };
	let revoke: (() => void) | undefined;
	const f = legalFixture({ source: {
		...signedSource(), read() { revoke?.(); return sdk; },
	} });
	await f.entry.start();
	const original = f.prompt();
	revoke = () => { void f.entry.dispose(); };
	await expectCompleted(original.proceed());
	expect(f.entry.snapshot()).toEqual({ kind: "closed" });
	expect(f.accepted.size).toBe(0);
	expect(f.writable()).toBe(0);
	await expectCompleted(f.entry.dispose());
});
