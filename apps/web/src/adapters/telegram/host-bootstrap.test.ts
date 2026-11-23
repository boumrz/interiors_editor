import { describe, expect, it as test, rstest } from "@rstest/core";
import { createBootstrapPublicObservation } from "../../../tests/verification/telegram-bootstrap-public-observation";
import {
	createTelegramSdkScriptSource,
} from "./host-bootstrap";
import type { TelegramLaunchConfiguration } from "./signed-launch";

// Independent public Telegram-signed fixture, already verified by signed-launch tests.
// https://github.com/Telegram-Mini-Apps/tma.js/blob/9350703debf015ff6b5fa751fdf1f72ae8ae250a/apps/docs/platform/init-data.md
const signedExample =
	"user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%20%2B%20-%20%3F%20%5C%2F%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg%22%7D&chat_instance=8134722200314281151&chat_type=private&auth_date=1733584787&hash=2174df5b000556d044f3f020384e879c8efcab55ddea2ced4eb752e93e7080d6&signature=zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ";
const configuration = {
	botId: "7342037359",
	environment: "production",
} as const;
const fixtureClock = 1_733_584_787_000;

function it(name: string, run: (ports: ReturnType<typeof createBootstrapPublicObservation>) => void | Promise<void>) {
	test(name, async () => {
		const ports = createBootstrapPublicObservation();
		try { await run(ports); }
		finally {
			const publicDisposalErrors = ports.disposeAll();
			try { expect(publicDisposalErrors).toEqual([]); }
			finally {
				await ports.close();
				console.log("SDK_PUBLIC_PORTS", JSON.stringify(ports.summary()));
			}
		}
	});
}

function hostFixture(ports: ReturnType<typeof createBootstrapPublicObservation>, initial?: unknown) {
	let sdk = initial;
	let loaded: (() => void) | undefined;
	let failed: (() => void) | undefined;
	let deadline: (() => void) | undefined;
	const effects = { starts: 0, removals: 0, timers: 0, fallbackExits: 0 };
	const bootstrap = ports.bootstrap({
		configuration,
		timeoutMs: 5_000,
		nowEpochMs: () => fixtureClock,
		source: {
			read: () => sdk,
			start: (onLoad, onError) => {
				effects.starts++;
				loaded = onLoad;
				failed = onError;
				return () => {
					effects.removals++;
				};
			},
		},
		timers: {
			schedule: (callback, milliseconds) => {
				expect(milliseconds).toBe(5_000);
				deadline = callback;
				effects.timers++;
				return () => {
					effects.timers--;
				};
			},
		},
		onExit: () => {
			effects.fallbackExits++;
		},
	});
	return {
		bootstrap,
		effects,
		load(value: unknown) {
			sdk = value;
			loaded?.();
		},
		fail() {
			failed?.();
		},
		timeout() {
			deadline?.();
		},
	};
}

function sdkFixture(initData = signedExample) {
	const effects = { ready: 0, closed: 0 };
	return {
		effects,
		sdk: {
			initData,
			ready() {
				effects.ready++;
			},
			close() {
				effects.closed++;
			},
		},
	};
}

describe("Telegram entry bootstrap boundary", () => {
	it("reveals a rejected launch shell once without making the verified ready boundary available", async (ports) => {
		const sdk = sdkFixture("");
		const fixture = hostFixture(ports, sdk.sdk);
		expect(fixture.bootstrap.shellReady()).toBe(false);
		expect(await ports.result(fixture.bootstrap.start())).toMatchObject({
			kind: "unavailable", reason: "invalid-launch",
		});
		expect(sdk.effects.ready).toBe(0);
		expect(fixture.bootstrap.shellReady()).toBe(true);
		expect(fixture.bootstrap.shellReady()).toBe(false);
		expect(sdk.effects.ready).toBe(1);
		expect(fixture.bootstrap.ready()).toBe(false);
		fixture.bootstrap.dispose();
		expect(fixture.bootstrap.shellReady()).toBe(false);
	});

	it("contains a shell-ready exception and never repeats that host call or verifies the rejected launch", async (ports) => {
		const sdk = sdkFixture("");
		const ready = rstest.fn(() => { throw new Error("Host failure"); });
		const fixture = hostFixture(ports, { ...sdk.sdk, ready });
		await ports.result(fixture.bootstrap.start());
		expect(fixture.bootstrap.shellReady()).toBe(false);
		expect(fixture.bootstrap.shellReady()).toBe(false);
		expect(ready).toHaveBeenCalledTimes(1);
		expect(fixture.bootstrap.ready()).toBe(false);
		expect(fixture.bootstrap.exit()).toBe("requested");
		expect(sdk.effects.closed).toBe(1);
	});

	it("revokes a rejected shell callback at disposal and while a replacement launch is pending", async (ports) => {
		const sdk = sdkFixture("");
		const fixture = hostFixture(ports, sdk.sdk);
		await ports.result(fixture.bootstrap.start());
		const replacement = fixture.bootstrap.start();
		expect(fixture.bootstrap.shellReady()).toBe(false);
		await ports.result(replacement);
		fixture.bootstrap.dispose();
		expect(fixture.bootstrap.shellReady()).toBe(false);
		expect(sdk.effects.ready).toBe(0);
	});

	it("revokes shell readiness on exit from both a pending and a rejected launch", async (ports) => {
		for (const waitForRejection of [false, true]) {
			const sdk = sdkFixture("");
			const fixture = hostFixture(ports, sdk.sdk);
			const launch = fixture.bootstrap.start();
			if (waitForRejection) await ports.result(launch);
			expect(fixture.bootstrap.exit()).toBe("requested");
			await ports.result(launch);
			expect(fixture.bootstrap.shellReady()).toBe(false);
			expect(fixture.bootstrap.ready()).toBe(false);
			expect(sdk.effects).toEqual({ ready: 0, closed: 1 });
		}
	});

	it("is inert until explicitly started and exposes ready only after native signed verification", async (ports) => {
		const sdk = sdkFixture();
		const fixture = hostFixture(ports, sdk.sdk);
		expect(fixture.effects).toEqual({
			starts: 0,
			removals: 0,
			timers: 0,
			fallbackExits: 0,
		});
		expect(fixture.bootstrap.ready()).toBe(false);
		const result = await ports.result(fixture.bootstrap.start());
		expect(result.kind).toBe("verified");
		if (result.kind !== "verified")
			throw new Error("Expected verified public fixture");
		expect(result.scope).toMatch(/^tma-v1-[a-f0-9]{64}$/);
		expect(result.authenticatedAt).toBe(1733584787);
		expect(Object.keys(result).sort()).toEqual(["authenticatedAt","kind", "scope"]);
		expect(sdk.effects.ready).toBe(0);
		expect(fixture.bootstrap.ready()).toBe(true);
		expect(sdk.effects.ready).toBe(1);
		expect(fixture.effects.starts).toBe(0);
		expect(fixture.effects.timers).toBe(0);
	});

	it("loads asynchronously, times out finitely, ignores the late load and retries with a new attempt", async (ports) => {
		const fixture = hostFixture(ports);
		const first = fixture.bootstrap.start();
		expect(fixture.effects.starts).toBe(1);
		fixture.timeout();
		expect(await ports.result(first)).toEqual({ kind: "unavailable", reason: "timeout" });
		expect(fixture.effects.removals).toBe(1);
		expect(fixture.effects.timers).toBe(0);
		fixture.fail();
		expect(fixture.effects.removals).toBe(1);
		expect(fixture.effects.timers).toBe(0);
		const sdk = sdkFixture();
		fixture.load(sdk.sdk);
		expect(fixture.bootstrap.ready()).toBe(false);
		const retry = await ports.result(fixture.bootstrap.start());
		expect(retry.kind).toBe("verified");
		expect(fixture.bootstrap.ready()).toBe(true);
	});

	it("rejects an SDK-shaped object without signed launch data and never calls ready", async (ports) => {
		const sdk = sdkFixture("");
		const fixture = hostFixture(ports, sdk.sdk);
		expect(await ports.result(fixture.bootstrap.start())).toEqual({
			kind: "unavailable",
			reason: "invalid-launch",
			launchReason: "malformed-init-data",
		});
		expect(fixture.bootstrap.ready()).toBe(false);
		expect(sdk.effects.ready).toBe(0);
		expect(fixture.bootstrap.exit()).toBe("requested");
		expect(sdk.effects.closed).toBe(1);
		expect(fixture.effects.fallbackExits).toBe(0);
	});

	it("returns retryable loader errors and uses the supplied exit fallback when no SDK is available", async (ports) => {
		const fixture = hostFixture(ports);
		const result = fixture.bootstrap.start();
		fixture.fail();
		expect(await ports.result(result)).toEqual({
			kind: "unavailable",
			reason: "sdk-load-failed",
		});
		expect(fixture.effects.removals).toBe(1);
		expect(fixture.bootstrap.exit()).toBe("requested");
		expect(fixture.effects.fallbackExits).toBe(1);
	});

	it("cancels a superseded bootstrap and denies every late callback after disposal", async (ports) => {
		const fixture = hostFixture(ports);
		const first = fixture.bootstrap.start();
		const second = fixture.bootstrap.start();
		expect(await ports.result(first)).toEqual({ kind: "unavailable", reason: "cancelled" });
		expect(fixture.effects.removals).toBe(1);
		fixture.bootstrap.dispose();
		expect(await ports.result(second)).toEqual({ kind: "unavailable", reason: "cancelled" });
		fixture.load(sdkFixture().sdk);
		expect(await ports.result(fixture.bootstrap.start())).toEqual({
			kind: "unavailable",
			reason: "disposed",
		});
		expect(fixture.bootstrap.ready()).toBe(false);
		expect(fixture.bootstrap.exit()).toBe("unavailable");
		expect(fixture.effects.removals).toBe(2);
		expect(fixture.effects.timers).toBe(0);
	});

	it("verifies a successfully loaded SDK, removes its script subscription and snapshots trusted configuration", async (ports) => {
		const mutableConfiguration: {
			botId: string;
			environment: TelegramLaunchConfiguration["environment"];
		} = { ...configuration };
		const sdk = sdkFixture();
		let loaded: (() => void) | undefined;
		let available: unknown;
		let stopped = 0;
		const bootstrap = ports.bootstrap({
			configuration: mutableConfiguration,
			timeoutMs: 5_000,
			nowEpochMs: () => fixtureClock,
			source: {
				read: () => available,
				start(onLoad) {
					loaded = onLoad;
					return () => {
						stopped++;
					};
				},
			},
			onExit() {},
		});
		const result = bootstrap.start();
		mutableConfiguration.botId = "7342037360";
		available = sdk.sdk;
		loaded?.();
		expect((await ports.result(result)).kind).toBe("verified");
		expect(stopped).toBe(1);
		expect(bootstrap.ready()).toBe(true);
		bootstrap.dispose();
		expect(bootstrap.ready()).toBe(false);
	});

	it("does not accept initDataUnsafe, malformed SDK methods or late unsupported objects", async (ports) => {
		for (const value of [
			null,
			[],
			"sdk",
			{ initDataUnsafe: { user: { id: 1 } } },
			{ ...sdkFixture().sdk, ready: undefined },
			{ ...sdkFixture().sdk, close: 0 },
		]) {
			const fixture = hostFixture(ports, value);
			expect(await ports.result(fixture.bootstrap.start())).toEqual({
				kind: "unavailable",
				reason: "unsupported-host",
			});
			expect(fixture.bootstrap.ready()).toBe(false);
		}
		const fixture = hostFixture(ports);
		const result = fixture.bootstrap.start();
		fixture.load(undefined);
		expect(await ports.result(result)).toEqual({
			kind: "unavailable",
			reason: "unsupported-host",
		});
	});

	it("keeps the real freshness check at SDK arrival rather than at factory construction", async (ports) => {
		const sdk = sdkFixture();
		let clock = fixtureClock;
		let loaded: (() => void) | undefined;
		let available: unknown;
		const bootstrap = ports.bootstrap({
			configuration,
			timeoutMs: 5_000,
			nowEpochMs: () => clock,
			source: {
				read: () => available,
				start(onLoad) {
					loaded = onLoad;
					return () => {};
				},
			},
			onExit() {},
		});
		const result = bootstrap.start();
		clock += 300_001;
		available = sdk.sdk;
		loaded?.();
		expect(await ports.result(result)).toEqual({
			kind: "unavailable",
			reason: "invalid-launch",
			launchReason: "expired-launch",
		});
		expect(bootstrap.ready()).toBe(false);
	});

	it("returns finite safe failures for invalid deadlines, native timer timeout and throwing SDK controls", async (ports) => {
		for (const timeoutMs of [
			0,
			-1,
			0.5,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			2_147_483_648,
		]) {
			const bootstrap = ports.bootstrap({
				configuration,
				timeoutMs,
				nowEpochMs: () => fixtureClock,
				onExit() {},
				source: {
					read() {
						throw new Error("Must not inspect SDK");
					},
					start() {
						throw new Error("Must not load SDK");
					},
				},
			});
			expect(await ports.result(bootstrap.start())).toEqual({
				kind: "unavailable",
				reason: "invalid-timeout",
			});
		}
		const timeout = ports.bootstrap({
			configuration,
			timeoutMs: 1,
			nowEpochMs: () => fixtureClock,
			onExit() {},
			source: { read: () => undefined, start: () => () => {} },
		});
		const nativeTimeout = timeout.start();
		await ports.nativeDeadline();
		expect(await ports.result(nativeTimeout)).toEqual({
			kind: "unavailable",
			reason: "timeout",
		});
		const throwing = ports.bootstrap({
			configuration,
			timeoutMs: 5_000,
			nowEpochMs: () => fixtureClock,
			onExit() {},
			source: {
				read: () => ({
					initData: signedExample,
					ready() {
						throw new Error("host closed");
					},
					close() {
						throw new Error("host closed");
					},
				}),
				start: () => () => {},
			},
		});
		expect((await ports.result(throwing.start())).kind).toBe("verified");
		expect(throwing.ready()).toBe(false);
		expect(throwing.exit()).toBe("failed");
	});

	it("does not revive a timed-out launch after native verification returns late", async (ports) => {
		let release: (() => void) | undefined;
		let entered: (() => void) | undefined;
		let timeout: (() => void) | undefined;
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		const digestEntered = ports.observe(new Promise<void>((resolve) => {
			entered = resolve;
		}));
		const sdk = sdkFixture();
		const bootstrap = ports.bootstrap({
			configuration,
			timeoutMs: 5_000,
			nowEpochMs: () => fixtureClock,
			onExit() {},
			source: { read: () => sdk.sdk, start: () => () => {} },
			timers: {
				schedule(callback) {
					timeout = callback;
					return () => {};
				},
			},
			subtle: {
				importKey: crypto.subtle.importKey.bind(crypto.subtle),
				verify: crypto.subtle.verify.bind(crypto.subtle),
				async digest(algorithm, bytes) {
					entered?.();
					await hold;
					return crypto.subtle.digest(algorithm, bytes);
				},
			},
		});
		const result = bootstrap.start();
		try {
			await ports.result(digestEntered);
			timeout?.();
			expect(await ports.result(result)).toEqual({ kind: "unavailable", reason: "timeout" });
		} finally {
			release?.();
			await ports.drain();
		}
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(bootstrap.ready()).toBe(false);
		expect(sdk.effects.ready).toBe(0);
	});

	it("adds the official SDK script only on explicit load and removes both callbacks on teardown", () => {
		const effects = { appended: 0, removed: 0, loaded: 0, failed: 0 };
		// A structural DOM double for the concrete script adapter; no domain model is mocked.
		const script = {
			src: "",
			async: false,
			onload: null as HTMLScriptElement["onload"],
			onerror: null as HTMLScriptElement["onerror"],
			remove() {
				effects.removed++;
			},
		} as HTMLScriptElement;
		const document = {
			createElement(tag: string) {
				expect(tag).toBe("script");
				return script;
			},
			head: {
				appendChild(node: HTMLScriptElement) {
					expect(node).toBe(script);
					effects.appended++;
					return node;
				},
			},
		} as unknown as Pick<Document, "createElement" | "head">;
		const sdk = sdkFixture().sdk;
		const source = createTelegramSdkScriptSource({
			document,
			readWebApp: () => sdk,
		});
		expect(effects.appended).toBe(0);
		expect(source.read()).toBe(sdk);
		const stop = source.start(
			() => {
				effects.loaded++;
			},
			() => {
				effects.failed++;
			},
		);
		expect(script.src).toBe("/telegram-sdk/telegram-web-app.124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908.js");
		expect(script.async).toBe(true);
		expect(effects.appended).toBe(1);
		script.onload?.call(script, new Event("load"));
		script.onerror?.call(script, new Event("error"));
		expect(effects.loaded).toBe(1);
		expect(effects.failed).toBe(1);
		stop();
		stop();
		expect(script.onload).toBeNull();
		expect(script.onerror).toBeNull();
		expect(effects.removed).toBe(1);
	});

	it("rejects whole arrays, callable objects and non-string launch data despite valid-looking SDK methods", async (ports) => {
		const sdk = sdkFixture().sdk;
		for (const value of [
			Object.assign([], sdk),
			Object.assign(() => {}, sdk),
			{ ...sdk, initData: 0 },
			{ ...sdk, initData: undefined },
		]) {
			const fixture = hostFixture(ports, value);
			expect(await ports.result(fixture.bootstrap.start())).toEqual({
				kind: "unavailable",
				reason: "unsupported-host",
			});
			expect(fixture.bootstrap.ready()).toBe(false);
		}
	});

	it("cleans synchronous loader errors and never invokes teardown twice for repeated late errors", async (ports) => {
		let removed = 0;
		let error: (() => void) | undefined;
		const bootstrap = ports.bootstrap({
			configuration,
			timeoutMs: 5_000,
			nowEpochMs: () => fixtureClock,
			onExit() {},
			source: {
				read: () => undefined,
				start(_onLoad, onError) {
					error = onError;
					onError();
					return () => {
						removed++;
					};
				},
			},
		});
		expect(await ports.result(bootstrap.start())).toEqual({
			kind: "unavailable",
			reason: "sdk-load-failed",
		});
		expect(removed).toBe(1);
		error?.();
		expect(removed).toBe(1);
	});

	it("settles thrown loader/read failures without waiting for its deadline", async (ports) => {
		for (const source of [
			{
				read() {
					throw new Error("Private launch must not escape");
				},
				start: () => () => {},
			},
			{
				read: () => undefined,
				start() {
					throw new Error("Private launch must not escape");
				},
			},
		]) {
			const bootstrap = ports.bootstrap({
				configuration,
				timeoutMs: 5_000,
				nowEpochMs: () => fixtureClock,
				source,
				onExit() {},
			});
			expect(await ports.result(bootstrap.start())).toEqual({
				kind: "unavailable",
				reason: "sdk-load-failed",
			});
		}
		let reads = 0;
		let loaded: (() => void) | undefined;
		const bootstrap = ports.bootstrap({
			configuration,
			timeoutMs: 5_000,
			nowEpochMs: () => fixtureClock,
			onExit() {},
			source: {
				read() {
					if (++reads > 1) throw new Error("Private host getter");
					return undefined;
				},
				start(onLoad) {
					loaded = onLoad;
					return () => {};
				},
			},
		});
		const result = bootstrap.start();
		loaded?.();
		expect(await ports.result(result)).toEqual({
			kind: "unavailable",
			reason: "unsupported-host",
		});
	});

	it("contains an unexpected asynchronous validator failure without exposing its input or exception", async (ports) => {
		rstest.stubGlobal(
			"TextEncoder",
			class {
				constructor() {
					throw new Error("PRIVATE_INIT_DATA_MUST_NOT_ESCAPE");
				}
			},
		);
		try {
			const fixture = hostFixture(ports, sdkFixture().sdk);
			expect(await ports.result(fixture.bootstrap.start())).toEqual({
				kind: "unavailable",
				reason: "invalid-launch",
				launchReason: "unsupported-crypto",
			});
			expect(fixture.bootstrap.ready()).toBe(false);
		} finally {
			rstest.unstubAllGlobals();
		}
	});

	it("clears its real native deadline after successful verification", async (ports) => {
		const schedule = rstest.spyOn(globalThis, "setTimeout");
		const clear = rstest.spyOn(globalThis, "clearTimeout");
		try {
			const bootstrap = ports.bootstrap({
				configuration,
				timeoutMs: 5_000,
				nowEpochMs: () => fixtureClock,
				onExit() {},
				source: { read: () => sdkFixture().sdk, start: () => () => {} },
			});
			expect((await ports.result(bootstrap.start())).kind).toBe("verified");
			const timer = schedule.mock.results[0]?.value;
			expect(timer).toBeDefined();
			expect(clear).toHaveBeenCalledWith(timer);
			bootstrap.dispose();
		} finally {
			schedule.mockRestore();
			clear.mockRestore();
		}
	});

	it("accepts the native maximum timer delay without clamping it into an immediate timeout", async (ports) => {
		const delays: number[] = [];
		const bootstrap = ports.bootstrap({
			configuration,
			timeoutMs: 2_147_483_647,
			nowEpochMs: () => fixtureClock,
			onExit() {},
			timers: {
				schedule(_callback, milliseconds) {
					delays.push(milliseconds);
					return () => {};
				},
			},
			source: {
				read: () => undefined,
				start(_onLoad, onError) {
					onError();
					return () => {};
				},
			},
		});
		expect(await ports.result(bootstrap.start())).toEqual({
			kind: "unavailable",
			reason: "sdk-load-failed",
		});
		expect(delays).toEqual([2_147_483_647]);
	});
});
