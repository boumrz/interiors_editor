import { describe, expect, it } from "@rstest/core";
import {
	captureTelegramHostSdk,
	createTelegramBrowserSignals,
} from "./host-environment";

function fixture(extra: Record<string, unknown> = {}) {
	const handlers = new Map<string, Set<(value?: unknown) => void>>();
	const calls: string[] = [];
	const sdk = {
		initData: "signed-test-only",
		ready() {
			calls.push("ready");
		},
		close() {
			calls.push("close");
		},
		version: "8.0",
		colorScheme: "light",
		isActive: true,
		viewportHeight: 700,
		viewportStableHeight: 700,
		safeAreaInset: { top: 20, right: 0, bottom: 10, left: 0 },
		contentSafeAreaInset: { top: 30, right: 5, bottom: 15, left: 0 },
		BackButton: {
			isVisible: false,
			show() {
				calls.push("show");
			},
			hide() {
				calls.push("hide");
			},
		},
		isClosingConfirmationEnabled: false,
		isVerticalSwipesEnabled: true,
		enableClosingConfirmation() {
			calls.push("confirm-on");
		},
		disableClosingConfirmation() {
			calls.push("confirm-off");
		},
		enableVerticalSwipes() {
			calls.push("swipes-on");
		},
		disableVerticalSwipes() {
			calls.push("swipes-off");
		},
		onEvent(name: string, callback: (value?: unknown) => void) {
			let list = handlers.get(name);
			if (!list) {
				list = new Set();
				handlers.set(name, list);
			}
			list.add(callback);
		},
		offEvent(name: string, callback: (value?: unknown) => void) {
			handlers.get(name)?.delete(callback);
		},
		...extra,
	};
	const values = new Map<string, { value: string; priority: string }>();
	const style = {
		getPropertyValue: (name: string) => values.get(name)?.value ?? "",
		getPropertyPriority: (name: string) => values.get(name)?.priority ?? "",
		setProperty: (name: string, value: string, priority = "") => {
			values.set(name, { value, priority });
		},
		removeProperty: (name: string) => {
			const prior = values.get(name)?.value ?? "";
			values.delete(name);
			return prior;
		},
	};
	let browser = {
		height: 800,
		width: 390,
		visualHeight: 750,
		textEntryFocused: false,
		visible: true,
		focused: true,
	};
	let listener = () => {};
	let current: unknown = sdk;
	let changed = 0;
	const dependencies = {
		style,
		readBrowser: () => browser,
		subscribeBrowser: (callback: () => void) => {
			listener = callback;
			return () => {
				listener = () => {};
			};
		},
		readCurrentSdk: () => current,
		onContextChanged: () => {
			changed++;
		},
	};
	const capture = captureTelegramHostSdk(sdk);
	if (!capture) throw new Error("Expected host fixture");
	return {
		sdk,
		calls,
		handlers,
		style,
		values,
		dependencies,
		capture,
		connect: () => capture.connect(dependencies),
		emit: (name: string, value?: unknown) => {
			for (const fn of [...(handlers.get(name) ?? [])]) fn(value);
		},
		browser: (patch: Partial<typeof browser>) => {
			browser = { ...browser, ...patch };
			listener();
		},
		replace: (next: unknown) => {
			current = next;
		},
		changed: () => changed,
	};
}

describe("Telegram host environment", () => {
	it("keeps one shape and touch spacing through theme changes and restores the prior design on disposal", () => {
		const f = fixture();
		f.style.setProperty("--editor-host-radius", "18px");
		const host = f.connect();
		expect(f.style.getPropertyValue("--editor-host-radius")).toBe("12px");
		expect(f.style.getPropertyValue("--editor-host-touch-gap")).toBe("8px");
		f.sdk.colorScheme = "dark";
		f.emit("themeChanged");
		expect(f.style.getPropertyValue("--editor-host-radius")).toBe("12px");
		host.dispose();
		expect(f.style.getPropertyValue("--editor-host-radius")).toBe("18px");
		expect(f.style.getPropertyValue("--editor-host-touch-gap")).toBe("");
	});
	it("captures mandatory SDK methods once without starting host work", () => {
		const f = fixture();
		expect(f.calls).toEqual([]);
		expect(f.values.size).toBe(0);
		expect(f.handlers.size).toBe(0);
		expect(captureTelegramHostSdk(undefined)).toBeUndefined();
		expect(
			captureTelegramHostSdk({ initData: "x", ready() {} }),
		).toBeUndefined();
	});
	it("keeps stable, live and visual heights separate and never sums overlapping insets", () => {
		const f = fixture(),
			h = f.connect();
		expect(f.style.getPropertyValue("--editor-viewport-height")).toBe("700px");
		expect(f.style.getPropertyValue("--editor-safe-area-top")).toBe(
			"max(env(safe-area-inset-top, 0px), 30px)",
		);
		f.sdk.viewportHeight = 500;
		f.sdk.viewportStableHeight = 500;
		f.emit("viewportChanged", { isStateStable: false });
		expect(h.layout().viewport).toEqual({
			liveHeight: 500,
			stableHeight: 700,
			visualHeight: 750,
			height: 700,
			width: 390,
		});
		f.browser({ visualHeight: 420 });
		expect(f.style.getPropertyValue("--editor-viewport-height")).toBe("420px");
		f.emit("viewportChanged", { isStateStable: true });
		expect(h.layout().viewport.stableHeight).toBe(500);
		h.dispose();
	});
	it("clips the editor surface while typing, including a committed SDK resize, and refits on rotation", () => {
		const f = fixture();
		const host = f.connect();
		const inset = () => f.style.getPropertyValue("--editor-keyboard-inset");
		expect(inset()).toBe("0px");
		f.browser({ textEntryFocused: true, visualHeight: 430 });
		expect(inset()).toBe("270px");
		f.sdk.viewportStableHeight = 430;
		f.emit("viewportChanged", { isStateStable: true });
		expect(inset()).toBe("270px");
		f.browser({ width: 760, height: 350, visualHeight: 350 });
		expect(inset()).toBe("0px");
		f.browser({ textEntryFocused: false, visualHeight: 300 });
		expect(inset()).toBe("0px");
		f.browser({ textEntryFocused: true, visualHeight: 240 });
		expect(inset()).toBe("60px");
		f.browser({ textEntryFocused: false });
		expect(inset()).toBe("60px");
		f.browser({ visualHeight: 260 });
		expect(inset()).toBe("40px");
		f.browser({ visualHeight: 340 });
		expect(inset()).toBe("0px");
		f.browser({ textEntryFocused: true, visualHeight: 280 });
		f.browser({ textEntryFocused: false, visualHeight: 200 });
		expect(inset()).toBe("0px");
		host.dispose();
		expect(inset()).toBe("");
	});
	it("rejects nonfinite/negative dimensions and keeps every CSS value finite", () => {
		const f = fixture({
			viewportHeight: NaN,
			viewportStableHeight: Infinity,
			safeAreaInset: { top: -1, bottom: Infinity, left: NaN, right: "10px" },
		});
		f.browser({ height: 640, visualHeight: NaN });
		const h = f.connect();
		expect(h.layout().viewport.height).toBe(640);
		expect(f.style.getPropertyValue("--editor-safe-area-top")).toBe(
			"max(env(safe-area-inset-top, 0px), 30px)",
		);
		for (const { value } of f.values.values())
			expect(value).not.toMatch(/NaN|Infinity/);
		h.dispose();
	});
	it("invalidates layout for live changes while theme alone creates no layout epoch", () => {
		const f = fixture(),
			h = f.connect();
		const before = h.lifecycle.snapshot();
		let count = 0;
		h.lifecycle.subscribe(() => {
			count++;
		});
		f.sdk.colorScheme = "dark";
		f.emit("themeChanged");
		expect(h.lifecycle.snapshot()).toBe(before);
		expect(f.style.getPropertyValue("--ink")).toBe("#f5f7fa");
		f.sdk.viewportHeight = 620;
		f.emit("viewportChanged", { isStateStable: false });
		expect(h.lifecycle.snapshot().layoutVersion).toBe(before.layoutVersion + 1);
		expect(count).toBe(1);
		h.dispose();
	});
	it("applies and persists an override without invalidating layout or following later Telegram changes", () => {
		const f = fixture();
		const writes: string[] = [];
		const dependencies = {
			...f.dependencies,
			themePreference: { read: () => writes.at(-1), write: (value: string) => writes.push(value) },
		};
		const host = f.capture.connect(dependencies);
		const theme = host.theme;
		if (!theme) throw new Error("Expected theme controls");
		const before = host.lifecycle.snapshot();
		const notifications: unknown[] = [];
		theme.subscribe(() => notifications.push(theme.snapshot()));
		expect(theme.snapshot()).toEqual({ preference: "auto", colorScheme: "light", background: "#fdfdfc" });
		theme.setPreference("dark");
		expect(f.style.getPropertyValue("--editor-host-plan-canvas")).toBe("#1d252c");
		const chosenTheme = theme.snapshot();
		theme.setPreference("dark");
		f.emit("themeChanged");
		expect(theme.snapshot()).toBe(chosenTheme);
		expect(notifications).toEqual([{ preference: "dark", colorScheme: "dark", background: "#1d252c" }]);
		expect(host.lifecycle.snapshot()).toBe(before);
		host.dispose();
		theme.setPreference("light");
		const reopened = f.capture.connect(dependencies);
		expect(reopened.theme?.snapshot().preference).toBe("dark");
		reopened.theme?.setPreference("auto");
		expect(f.style.getPropertyValue("color-scheme")).toBe("light");
		expect(writes).toEqual(["dark", "auto"]);
		reopened.dispose();
	});
	it("notifies only active theme subscribers of automatic host changes", () => {
		const f = fixture();
		const host = f.connect();
		const theme = host.theme;
		if (!theme) throw new Error("Expected theme controls");
		const notified: string[] = [];
		const stop = theme.subscribe(() => notified.push(theme.snapshot().colorScheme));
		f.sdk.colorScheme = "dark";
		f.emit("themeChanged");
		expect(notified).toEqual(["dark"]);
		stop();
		f.sdk.colorScheme = "light";
		f.emit("themeChanged");
		expect(notified).toEqual(["dark"]);
		expect(theme.snapshot().colorScheme).toBe("light");
		host.dispose();
	});
	it("uses the live system theme only while Telegram has no recognized scheme and handles unavailable persistence", () => {
		const f = fixture({ colorScheme: undefined });
		let systemDark = true;
		let onSystemChange = () => {};
		let unsubscribed = false;
		const host = f.capture.connect({
			...f.dependencies,
			readSystemColorScheme: () => systemDark ? "dark" : "light",
			subscribeSystemColorScheme: (listener: () => void) => {
				onSystemChange = listener;
				return () => { unsubscribed = true; };
			},
			themePreference: {
				read: () => "unsupported",
				write: () => { throw new Error("storage unavailable"); },
			},
		});
		expect(host.theme?.snapshot().colorScheme).toBe("dark");
		systemDark = false;
		onSystemChange();
		expect(f.style.getPropertyValue("color-scheme")).toBe("light");
		f.sdk.colorScheme = "dark";
		f.emit("themeChanged");
		expect(f.style.getPropertyValue("color-scheme")).toBe("dark");
		host.theme?.setPreference("light");
		expect(f.style.getPropertyValue("color-scheme")).toBe("light");
		host.dispose();
		expect(unsubscribed).toBe(true);
	});
	it("suspends on host, visibility and focus independently, then resumes with fresh snapshot", () => {
		const f = fixture(),
			h = f.connect();
		f.sdk.isActive = false;
		f.emit("deactivated");
		expect(h.lifecycle.snapshot().active).toBe(false);
		f.sdk.isActive = true;
		f.emit("activated");
		expect(h.lifecycle.snapshot().active).toBe(true);
		f.browser({ visible: false });
		f.emit("activated");
		expect(h.lifecycle.snapshot().active).toBe(false);
		f.browser({ visible: true, focused: false });
		expect(h.lifecycle.snapshot().active).toBe(false);
		f.browser({ focused: true });
		expect(h.lifecycle.snapshot().active).toBe(true);
		h.dispose();
	});
	it("binds SDK Back and optional warning/swipes with exact listener teardown and restores initial host state", () => {
		const f = fixture(),
			h = f.connect();
		let back = 0;
		const off = h.navigation.subscribeBack(() => {
			back++;
		});
		h.navigation.setBackVisible(true);
		h.navigation.setClosingConfirmation?.(true);
		h.navigation.setVerticalSwipesEnabled?.(false);
		f.emit("backButtonClicked");
		expect(back).toBe(1);
		off();
		f.emit("backButtonClicked");
		expect(back).toBe(1);
		h.navigation.close();
		h.dispose();
		expect(f.calls).toEqual([
			"show",
			"confirm-on",
			"swipes-off",
			"close",
			"hide",
			"confirm-off",
			"swipes-on",
		]);
		for (const set of f.handlers.values()) expect(set.size).toBe(0);
		h.navigation.close();
		expect(f.calls.at(-1)).toBe("swipes-on");
	});
	it("does not claim unsupported optional methods merely because SDK stubs exist", () => {
		const f = fixture({ version: "6.0" }),
			h = f.connect();
		expect(h.capabilities).toEqual({
			backButton: false,
			closingConfirmation: false,
			verticalSwipes: false,
			lifecycle: false,
			safeArea: false,
		});
		expect(h.navigation.setClosingConfirmation).toBeUndefined();
		expect(h.navigation.setVerticalSwipesEnabled).toBeUndefined();
		h.navigation.setBackVisible(true);
		expect(f.calls).toEqual([]);
		h.dispose();
	});
	it("detects observable SDK or launch replacement once, closes admission synchronously and ignores late events", () => {
		const f = fixture(),
			h = f.connect();
		let events = 0;
		h.lifecycle.subscribe(() => {
			events++;
		});
		f.replace({ ...f.sdk });
		f.emit("viewportChanged", { isStateStable: true });
		expect(f.changed()).toBe(1);
		expect(h.lifecycle.snapshot().active).toBe(false);
		const count = events;
		h.navigation.close();
		f.emit("backButtonClicked");
		f.emit("activated");
		expect(events).toBe(count);
		expect(f.calls).not.toContain("close");
		expect(f.values.size).toBe(0);
	});
	it("also rejects changed initData on the same SDK object without inspecting unsafe user fields", () => {
		const f = fixture(),
			h = f.connect();
		f.sdk.initData = "replacement";
		h.navigation.setBackVisible(true);
		expect(f.changed()).toBe(1);
		expect(f.calls).toEqual([]);
	});
	it("restores exact prior inline values/priorities and cannot erase a newer same-valued owner", () => {
		const f = fixture();
		f.style.setProperty("--canvas", "custom", "important");
		const a = f.connect(),
			b = f.connect();
		a.dispose();
		expect(f.style.getPropertyValue("--canvas")).toBe("#f4f1ea");
		b.dispose();
		expect(f.style.getPropertyValue("--canvas")).toBe("custom");
		expect(f.style.getPropertyPriority("--canvas")).toBe("important");
		expect(f.values.size).toBe(1);
	});
	it("removes subscriptions and denies events even when SDK offEvent throws", () => {
		const f = fixture({
				offEvent() {
					throw new Error("private launch should not escape");
				},
			}),
			h = f.connect();
		let back = 0;
		h.navigation.subscribeBack(() => {
			back++;
		});
		h.dispose();
		f.emit("backButtonClicked");
		f.browser({ height: 300 });
		expect(back).toBe(0);
		expect(f.values.size).toBe(0);
		h.dispose();
	});
});

it("uses the canonical dark semantic palette with a distinct readable primary fill", () => {
	const f = fixture({ colorScheme: "dark" }),
		h = f.connect();
	expect(f.style.getPropertyValue("--canvas")).toBe("#17212b");
	expect(f.style.getPropertyValue("--surface")).toBe("#1f2c36");
	expect(f.style.getPropertyValue("--ink")).toBe("#f5f7fa");
	expect(f.style.getPropertyValue("--editor-host-plan-canvas")).toBe("#1d252c");
	expect(f.style.getPropertyValue("--editor-host-primary")).toBe("#68bfff");
	expect(f.style.getPropertyValue("--editor-host-primary-fill")).toBe(
		"#1976b9",
	);
	expect(f.style.getPropertyValue("color-scheme")).toBe("dark");
	h.dispose();
	expect(f.values.size).toBe(0);
});

it("runs the instrumented adapter under the requested mutation namespace", () => {
	captureTelegramHostSdk({
		initData: "activation-probe",
		ready() {},
		close() {},
	});
	const runtime: unknown = Reflect.get(globalThis, "process");
	const environment: unknown =
		runtime && typeof runtime === "object"
			? Reflect.get(runtime, "env")
			: undefined;
	const expected: unknown =
		environment && typeof environment === "object"
			? Reflect.get(environment, "__STRYKER_ACTIVE_MUTANT__")
			: undefined;
	if (expected !== undefined) {
		const namespace: unknown = Reflect.get(globalThis, "__stryker__");
		if (!namespace || typeof namespace !== "object")
			throw new Error("Mutation activation namespace missing");
		expect(Reflect.get(namespace, "activeMutant")).toBe(expected);
	}
});

it("supplies the complete semantic CSS contract for both host themes and restores every token", () => {
	for (const colorScheme of ["light", "dark"]) {
		const f = fixture({ colorScheme }),
			h = f.connect();
		const roles = [
			"--canvas",
			"--surface",
			"--ink",
			"--muted",
			"--line",
			"--line-soft",
			"--shadow",
			"--blue",
			"--danger",
			"--safe",
			"color-scheme",
			"color",
			"background-color",
			...[
				"surface",
				"canvas",
				"plan-canvas",
				"ink",
				"muted",
				"line",
				"primary",
				"primary-fill",
				"on-primary",
				"primary-soft",
				"focus",
				"danger",
				"warning",
				"warning-soft",
			].map((role) => `--editor-host-${role}`),
		];
		for (const role of roles)
			expect(f.style.getPropertyValue(role), `${colorScheme} ${role}`).not.toBe(
				"",
			);
		expect(h.layout().colorScheme).toBe(colorScheme);
		expect(f.style.getPropertyValue("color-scheme")).toBe(colorScheme);
		expect(f.style.getPropertyValue("color")).toBe("var(--ink)");
		expect(f.style.getPropertyValue("background-color")).toBe("var(--canvas)");
		h.dispose();
		expect(f.values.size).toBe(0);
	}
});
it("captures and binds critical SDK method receivers before mutable getters or method replacement", () => {
	const calls: unknown[] = [];
	const sdk = {
		initData: "original",
		ready() {
			calls.push(this);
		},
		close() {
			calls.push(this);
		},
	};
	const capture = captureTelegramHostSdk(sdk);
	if (!capture) throw new Error("Expected capture");
	sdk.initData = "changed";
	sdk.ready = () => {
		throw new Error("New method must not be used");
	};
	const value = capture.bootstrapValue;
	if (!value || typeof value !== "object")
		throw new Error("Expected bootstrap value");
	expect(Reflect.get(value, "initData")).toBe("original");
	Reflect.get(value, "ready")();
	Reflect.get(value, "close")();
	expect(calls).toEqual([sdk, sdk]);
	expect(Object.isFrozen(value)).toBe(true);
	for (const invalid of [
		[],
		null,
		1,
		"host",
		{ initData: 7, ready() {}, close() {} },
		{ initData: "x", ready: undefined, close() {} },
		{ initData: "x", ready() {}, close: undefined },
		Object.defineProperty({}, "initData", {
			get() {
				throw new Error("Private getter");
			},
		}),
	])
		expect(captureTelegramHostSdk(invalid)).toBeUndefined();
});
it("uses explicit version capability results and safe fallback parsing without treating stubs as support", () => {
	for (const result of [true, false, "yes", undefined]) {
		const requested: string[] = [];
		const f = fixture({
				version: "6.0",
				isVersionAtLeast(value: string) {
					requested.push(value);
					return result;
				},
			}),
			h = f.connect();
		expect(h.capabilities.backButton).toBe(result === true);
		expect(h.capabilities.lifecycle).toBe(result === true);
		expect(requested).toContain("8.0");
		h.dispose();
	}
	for (const version of [
		undefined,
		"bad8.0",
		"8.0bad",
		"8.0.0.0",
		"6.0",
		"6.1",
		"6.1.0",
		"6.2.1",
		"7.7",
		"8.0.0",
		"10.12.3",
	]) {
		const f = fixture({ version }),
			h = f.connect();
		expect(h.capabilities.backButton).toBe(
			typeof version === "string" &&
				["6.1", "6.1.0", "6.2.1", "7.7", "8.0.0", "10.12.3"].includes(version),
		);
		expect(h.capabilities.verticalSwipes).toBe(
			typeof version === "string" &&
				["7.7", "8.0.0", "10.12.3"].includes(version),
		);
		h.dispose();
	}
	const f = fixture({
			isVersionAtLeast() {
				throw new Error("Unsupported version API");
			},
		}),
		h = f.connect();
	expect(Object.values(h.capabilities).every((value) => value === false)).toBe(
		true,
	);
	h.dispose();
});
it("keeps host activation, initial inactive state and browser read failures conservative", () => {
	const f = fixture({
			isActive: false,
			viewportStableHeight: undefined,
			viewportHeight: 600,
		}),
		h = f.connect();
	expect(h.lifecycle.snapshot().active).toBe(false);
	expect(h.layout().viewport.stableHeight).toBe(600);
	f.emit("activated");
	expect(h.lifecycle.snapshot().active).toBe(true);
	f.sdk.viewportHeight = 500;
	f.emit("viewportChanged", { isStateStable: true });
	expect(h.layout().viewport.stableHeight).toBe(500);
	h.dispose();
	const other = fixture(),
		blocked = other.capture.connect({
			...other.dependencies,
			readBrowser() {
				throw new Error("Hidden browser read");
			},
		});
	expect(blocked.lifecycle.snapshot().active).toBe(false);
	expect(blocked.layout().viewport.width).toBeUndefined();
	blocked.dispose();
});
it("denies subscription capabilities without a matching removal API or restorable Back state", () => {
	for (const patch of [
		{ onEvent: undefined },
		{ offEvent: undefined },
		{ BackButton: { show() {}, hide() {} } },
	]) {
		const f = fixture(patch),
			h = f.connect();
		expect(h.capabilities.backButton).toBe(false);
		if ("onEvent" in patch || "offEvent" in patch) {
			expect(h.capabilities.lifecycle).toBe(false);
			expect(f.handlers.size).toBe(0);
		}
		h.navigation.setBackVisible(true);
		h.dispose();
		expect(f.calls).toEqual(["confirm-off", "swipes-on"]);
	}
});
it("unsubscribes even if SDK registration partially succeeds then throws", () => {
	const registered = new Map<string, (value?: unknown) => void>();
	const f = fixture({
			onEvent(name: string, callback: (value?: unknown) => void) {
				registered.set(name, callback);
				throw new Error("Partial SDK registration");
			},
			offEvent(name: string, callback: (value?: unknown) => void) {
				if (registered.get(name) === callback) registered.delete(name);
			},
		}),
		h = f.connect();
	expect(registered.size).toBeGreaterThan(0);
	h.dispose();
	expect(registered.size).toBe(0);
});
it("isolates throwing observers and detects a denied SDK read without leaking context callbacks", () => {
	const f = fixture(),
		h = f.connect();
	let healthy = 0;
	h.lifecycle.subscribe(() => {
		throw new Error("Observer");
	});
	const off = h.lifecycle.subscribe(() => {
		healthy++;
	});
	f.browser({ focused: false });
	expect(healthy).toBe(1);
	off();
	f.browser({ focused: true });
	expect(healthy).toBe(1);
	f.replace(undefined);
	h.navigation.close();
	expect(f.changed()).toBe(1);
	h.lifecycle.subscribe(() => {
		healthy++;
	});
	f.browser({ height: 500 });
	expect(healthy).toBe(1);
	h.dispose();
});
it("reads native browser layout inputs and registers every capture listener with symmetric teardown", () => {
	class Surface {
		readonly listeners = new Map<string, Set<() => void>>();
		readonly flags: boolean[] = [];
		addEventListener(name: string, callback: () => void, capture: boolean) {
			this.flags.push(capture);
			let set = this.listeners.get(name);
			if (!set) {
				set = new Set();
				this.listeners.set(name, set);
			}
			set.add(callback);
		}
		removeEventListener(name: string, callback: () => void, capture: boolean) {
			this.flags.push(capture);
			if (capture) this.listeners.get(name)?.delete(callback);
		}
		emit(name: string) {
			for (const callback of this.listeners.get(name) ?? []) callback();
		}
	}
	const f = fixture(),
		visual = Object.assign(new Surface(), { height: 420 }),
		window = Object.assign(new Surface(), {
			innerHeight: 700,
			innerWidth: 360,
			visualViewport: visual,
		}),
		document = Object.assign(new Surface(), {
			documentElement: { style: f.style },
			activeElement: null as { matches(selector: string): boolean } | null,
			visibilityState: "visible",
			hasFocus: (): boolean => true,
		});
	const signals = createTelegramBrowserSignals({
		window: window as unknown as Window,
		document: document as unknown as Document,
	});
	expect(signals.style).toBe(f.style);
	expect(signals.readBrowser()).toEqual({
		height: 700,
		width: 360,
		visualHeight: 420,
		textEntryFocused: false,
		visible: true,
		focused: true,
	});
	document.activeElement = { matches: selector => selector.length > 0 };
	expect(signals.readBrowser().textEntryFocused).toBe(true);
	document.activeElement = { matches: () => false };
	expect(signals.readBrowser().textEntryFocused).toBe(false);
	let calls = 0;
	const off = signals.subscribeBrowser(() => {
		calls++;
	});
	for (const name of ["blur", "focus", "resize", "orientationchange"])
		window.emit(name);
	document.emit("visibilitychange");
	visual.emit("resize");
	visual.emit("scroll");
	expect(calls).toBe(7);
	off();
	window.emit("resize");
	document.emit("visibilitychange");
	visual.emit("scroll");
	expect(calls).toBe(7);
	expect(
		[...window.flags, ...document.flags, ...visual.flags].every(Boolean),
	).toBe(true);
	document.visibilityState = "hidden";
	document.hasFocus = () => false;
	expect(signals.readBrowser().visible).toBe(false);
	expect(signals.readBrowser().focused).toBe(false);
	const noVisual = Object.assign(new Surface(), {
		innerHeight: 500,
		innerWidth: 320,
		visualViewport: null,
	});
	const fallback = createTelegramBrowserSignals({
		window: noVisual as unknown as Window,
		document: document as unknown as Document,
	});
	expect(fallback.readSystemColorScheme?.()).toBe("light");
	expect(() => fallback.subscribeSystemColorScheme?.(() => undefined)()).not.toThrow();
	expect(fallback.readBrowser().visualHeight).toBeUndefined();
	const removeFallback = fallback.subscribeBrowser(() => {
		calls++;
	});
	noVisual.emit("resize");
	document.emit("visibilitychange");
	expect(calls).toBe(9);
	removeFallback();
	noVisual.emit("resize");
	document.emit("visibilitychange");
	expect(calls).toBe(9);
});

it("reads and cleans up the browser's live system theme signal", () => {
	const f = fixture();
	const media = {
		matches: true,
		listeners: new Set<() => void>(),
		addEventListener(name: string, listener: () => void) {
			expect(name).toBe("change");
			this.listeners.add(listener);
		},
		removeEventListener(name: string, listener: () => void) {
			expect(name).toBe("change");
			this.listeners.delete(listener);
		},
	};
	const signals = createTelegramBrowserSignals({
		window: {
			matchMedia(query: string) {
				expect(query).toBe("(prefers-color-scheme: dark)");
				return media;
			},
		} as unknown as Window,
		document: { documentElement: { style: f.style } } as unknown as Document,
	});
	expect(signals.readSystemColorScheme?.()).toBe("dark");
	let changes = 0;
	const dispose = signals.subscribeSystemColorScheme?.(() => { changes++; });
	expect(media.listeners.size).toBe(1);
	media.matches = false;
	for (const listener of [...media.listeners]) listener();
	expect(changes).toBe(1);
	expect(signals.readSystemColorScheme?.()).toBe("light");
	dispose?.();
	expect(media.listeners.size).toBe(0);
	const staticMedia = createTelegramBrowserSignals({
		window: { matchMedia: () => ({ matches: true }) } as unknown as Window,
		document: { documentElement: { style: f.style } } as unknown as Document,
	});
	expect(staticMedia.readSystemColorScheme?.()).toBe("dark");
	expect(() => staticMedia.subscribeSystemColorScheme?.(() => undefined)()).not.toThrow();
});

it("drains a browser remover returned after synchronous context-change disposal", () => {
	const f = fixture();
	let stopped = 0;
	const environment = f.capture.connect({
		...f.dependencies,
		subscribeBrowser(listener) {
			f.replace(undefined);
			listener();
			return () => {
				stopped++;
			};
		},
	});
	expect(f.changed()).toBe(1);
	expect(environment.lifecycle.snapshot().active).toBe(false);
	expect(stopped).toBe(1);
	expect(f.values.size).toBe(0);
	environment.dispose();
	expect(stopped).toBe(1);
});
it("does not register later SDK or browser listeners after a synchronous registration callback revokes context", () => {
	const registered = new Map<string, (value?: unknown) => void>();
	let first = true,
		subscribed = 0;
	const f = fixture({
		onEvent(name: string, callback: (value?: unknown) => void) {
			registered.set(name, callback);
			if (first) {
				first = false;
				f.replace(undefined);
				callback();
			}
		},
		offEvent(name: string, callback: (value?: unknown) => void) {
			if (registered.get(name) === callback) registered.delete(name);
		},
	});
	const environment = f.capture.connect({
		...f.dependencies,
		subscribeBrowser() {
			subscribed++;
			return () => undefined;
		},
	});
	expect(f.changed()).toBe(1);
	expect(registered.size).toBe(0);
	expect(subscribed).toBe(0);
	environment.dispose();
});
