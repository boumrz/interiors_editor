import type {
	HostLifecyclePort,
	HostNavigationPort,
} from "../../ui/editor-host-boundary";

// Official field/event semantics checked 2026-11-05:
// https://core.telegram.org/bots/webapps#initializing-mini-apps
// https://core.telegram.org/bots/webapps#events-available-for-mini-apps
// Capture is not authentication. Only the entry's successful signed bootstrap may connect it.
type RecordValue = Record<string, unknown>;
type Method = (...arguments_: unknown[]) => unknown;
type Style = Pick<
	CSSStyleDeclaration,
	"getPropertyValue" | "getPropertyPriority" | "setProperty" | "removeProperty"
>;
export interface TelegramBrowserLayout {
	readonly height: number;
	readonly width: number;
	readonly visualHeight?: number;
	readonly textEntryFocused?: boolean;
	readonly visible: boolean;
	readonly focused: boolean;
}
export interface TelegramHostEnvironmentDependencies {
	readonly style: Style;
	readonly readBrowser: () => TelegramBrowserLayout;
	readonly subscribeBrowser: (listener: () => void) => () => void;
	readonly readCurrentSdk: () => unknown;
	readonly readSystemColorScheme?: () => TelegramColorScheme | undefined;
	readonly subscribeSystemColorScheme?: (listener: () => void) => () => void;
	readonly themePreference?: {
		readonly read: () => unknown;
		readonly write: (preference: TelegramThemePreference) => void;
	};
	/** An observable replacement requires a NEW signed bootstrap, not activation-based identity. */
	readonly onContextChanged: () => void;
}
type TelegramColorScheme = "light" | "dark";
export type TelegramThemePreference = "auto" | TelegramColorScheme;
interface TelegramThemeSnapshot {
	readonly preference: TelegramThemePreference;
	readonly colorScheme: TelegramColorScheme;
	readonly background: string;
}
interface TelegramThemePort {
	readonly snapshot: () => TelegramThemeSnapshot;
	readonly subscribe: (listener: () => void) => () => void;
	readonly setPreference: (preference: TelegramThemePreference) => void;
}
type Insets = Readonly<{
	top: number;
	right: number;
	bottom: number;
	left: number;
}>;
export interface TelegramHostLayout {
	readonly viewport: Readonly<{
		liveHeight: number | undefined;
		stableHeight: number | undefined;
		visualHeight: number | undefined;
		height: number | undefined;
		width: number | undefined;
	}>;
	readonly safeArea: Insets;
	readonly contentSafeArea: Insets;
	readonly colorScheme: TelegramColorScheme;
}
export interface TelegramHostEnvironment {
	readonly theme?: TelegramThemePort;
	readonly showSettings?: (listener:()=>void)=>()=>void;
	readonly navigation: HostNavigationPort;
	readonly lifecycle: HostLifecyclePort;
	readonly capabilities: Readonly<{
		backButton: boolean;
		closingConfirmation: boolean;
		verticalSwipes: boolean;
		lifecycle: boolean;
		safeArea: boolean;
	}>;
	readonly layout: () => TelegramHostLayout;
	readonly dispose: () => void;
}
export interface TelegramHostCapture {
	/** Immutable critical fields only, passed straight to the signed-launch bootstrap. */
	readonly bootstrapValue: unknown;
	/** Checks whether the same signed host is still present without reauthenticating it. */
	readonly matchesCurrent: (readCurrentSdk: () => unknown) => boolean;
	/** One live host environment per SDK; the entry revokes/drains its predecessor before connecting. */
	readonly connect: (
		dependencies: TelegramHostEnvironmentDependencies,
	) => TelegramHostEnvironment;
}
const object = (value: unknown): RecordValue | undefined =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as RecordValue)
		: undefined;
const read = (target: RecordValue | undefined, key: string): unknown => {
	try {
		return target?.[key];
	} catch {
		return undefined;
	}
};
const method = (
	target: RecordValue | undefined,
	key: string,
): Method | undefined => {
	const candidate = read(target, key);
	return typeof candidate === "function"
		? (...arguments_: unknown[]) => candidate.apply(target, arguments_)
		: undefined;
};
const positive = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: undefined;
const inset = (value: unknown): number =>
	typeof value === "number" && Number.isSafeInteger(value) && value >= 0
		? value
		: 0;
const sides = ["top", "right", "bottom", "left"] as const;
function insets(value: unknown): Insets {
	const record = object(value);
	return Object.freeze({
		top: inset(read(record, "top")),
		right: inset(read(record, "right")),
		bottom: inset(read(record, "bottom")),
		left: inset(read(record, "left")),
	});
}
const light = {
	"--canvas": "#f4f1ea",
	"--surface": "#ffffff",
	"--ink": "#172033",
	"--muted": "#667085",
	"--line": "#b8b7b2",
	"--line-soft": "#deddd7",
	"--shadow": "rgba(23, 32, 51, 0.1)",
	"--blue": "#2563eb",
	"--danger": "#b42318",
	"--safe": "#147a55",
};

const dark = {
	"--canvas": "#17212b",
	"--surface": "#1f2c36",
	"--ink": "#f5f7fa",
	"--muted": "#a7b6c2",
	"--line": "#3b4c59",
	"--line-soft": "#33414b",
	"--shadow": "rgba(0, 0, 0, 0.3)",
	"--blue": "#68bfff",
	"--danger": "#ff887f",
	"--safe": "#65d891",
};
const hostLight = {
	surface: "#ffffff",
	canvas: "#f4f6f8",
	"plan-canvas": "#fdfdfc",
	ink: "#192436",
	muted: "#52647b",
	line: "#d9e1e8",
	primary: "#1976b9",
	"primary-fill": "#1976b9",
	"on-primary": "#ffffff",
	"primary-soft": "#e7f3fb",
	focus: "#0b5d8e",
	danger: "#a33333",
	warning: "#8a5800",
	"warning-soft": "#fff4ed",
};
const hostDark = {
	surface: "#1f2c36",
	canvas: "#17212b",
	"plan-canvas": "#1d252c",
	ink: "#f5f7fa",
	muted: "#a7b6c2",
	line: "#3b4c59",
	primary: "#68bfff",
	"primary-fill": "#1976b9",
	"on-primary": "#ffffff",
	"primary-soft": "color-mix(in srgb, #68bfff 18%, #1f2c36)",
	focus: "#8dd3ff",
	danger: "#ff887f",
	warning: "#f4c96a",
	"warning-soft": "color-mix(in srgb, #f4c96a 16%, #1f2c36)",
};

function colorScheme(value: unknown): TelegramColorScheme | undefined {
	return value === "light" || value === "dark" ? value : undefined;
}

type Styles = Map<string, string>;
type StyleOwner = { values: Styles };
type StyleLease = {
	baseline: Map<string, { value: string; priority: string }>;
	owners: StyleOwner[];
};
const styleLeases = new WeakMap<Style, StyleLease>();
function ownStyles(style: Style) {
	let lease = styleLeases.get(style);
	if (!lease) {
		lease = { baseline: new Map(), owners: [] };
		styleLeases.set(style, lease);
	}
	const current = lease,
		owner: StyleOwner = { values: new Map() };
	current.owners.push(owner);
	const apply = (values: Styles) => {
		for (const [name, value] of values) {
			if (!current.baseline.has(name))
				current.baseline.set(name, {
					value: style.getPropertyValue(name),
					priority: style.getPropertyPriority(name),
				});
			if (value) style.setProperty(name, value);
			else style.removeProperty(name);
		}
	};
	return {
		update(values: Styles) {
			owner.values = values;
			if (current.owners.at(-1) === owner) apply(values);
		},
		dispose() {
			const index = current.owners.indexOf(owner);
			if (index < 0) return;
			const wasTop = index === current.owners.length - 1;
			current.owners.splice(index, 1);
			if (!wasTop) return;
			const prior = current.owners.at(-1);
			if (prior) apply(prior.values);
			else {
				for (const [name, { value, priority }] of current.baseline) {
					if (value) style.setProperty(name, value, priority);
					else style.removeProperty(name);
				}
				styleLeases.delete(style);
			}
		},
	};
}
function atLeast(sdk: RecordValue, version: string): boolean {
	const check = method(sdk, "isVersionAtLeast");
	if (check) {
		try {
			return check(version) === true;
		} catch {
			return false;
		}
	}
	const raw = read(sdk, "version");
	if (typeof raw !== "string" || !/^\d{1,3}(?:\.\d{1,3}){1,2}$/.test(raw))
		return false;
	const actual = raw.split(".").map(Number),
		required = version.split(".").map(Number);
	for (
		let index = 0;
		index < Math.max(actual.length, required.length);
		index++
	) {
		const delta = (actual[index] ?? 0) - (required[index] ?? 0);
		if (delta !== 0) return delta > 0;
	}
	return true;
}

/** Inert: snapshots critical SDK fields; never reads globals, loads scripts or opens storage. */
export function captureTelegramHostSdk(
	raw: unknown,
): TelegramHostCapture | undefined {
	const sdk = object(raw);
	if (!sdk) return undefined;
	const initData = read(sdk, "initData"),
		ready = method(sdk, "ready"),
		close = method(sdk, "close");
	if (typeof initData !== "string" || !ready || !close) return undefined;
	const bootstrapValue = Object.freeze({
		initData,
		ready: () => {
			ready();
		},
		close: () => {
			close();
		},
	});
	const matchesCurrent = (readCurrentSdk: () => unknown) => {
		try { return readCurrentSdk() === raw && read(sdk, "initData") === initData; }
		catch { return false; }
	};
	return Object.freeze({
		bootstrapValue, matchesCurrent,
		connect(dependencies: TelegramHostEnvironmentDependencies) {
			const on = method(sdk, "onEvent"),
				off = method(sdk, "offEvent"),
				events = !!on && !!off;
			const back = object(read(sdk, "BackButton")),
				show = method(back, "show"),
				hide = method(back, "hide"),
				initialBack = read(back, "isVisible");
			const confirmOn = method(sdk, "enableClosingConfirmation"),
				confirmOff = method(sdk, "disableClosingConfirmation"),
				initialConfirmation = read(sdk, "isClosingConfirmationEnabled");
			const swipesOn = method(sdk, "enableVerticalSwipes"),
				swipesOff = method(sdk, "disableVerticalSwipes"),
				initialSwipes = read(sdk, "isVerticalSwipesEnabled");
			const capabilities = Object.freeze({
				backButton:
					events &&
					atLeast(sdk, "6.1") &&
					!!show &&
					!!hide &&
					typeof initialBack === "boolean",
				closingConfirmation:
					atLeast(sdk, "6.2") &&
					!!confirmOn &&
					!!confirmOff &&
					typeof initialConfirmation === "boolean",
				verticalSwipes:
					atLeast(sdk, "7.7") &&
					!!swipesOn &&
					!!swipesOff &&
					typeof initialSwipes === "boolean",
				lifecycle: events && atLeast(sdk, "8.0"),
				safeArea: atLeast(sdk, "8.0"),
			});
			const removers: (() => void)[] = [],
				listeners = new Set<() => void>(),
				themeListeners = new Set<() => void>(),
				backListeners = new Set<() => void>();
			let disposed = false,
				contextChanged = false,
				hostActive = read(sdk, "isActive") !== false;
			let snapshot: ReturnType<HostLifecyclePort["snapshot"]> = Object.freeze({
				active: false,
				layoutVersion: 0,
			});
			let drawingHeight = 0;
			let layout: TelegramHostLayout,
				stableHeight =
					positive(read(sdk, "viewportStableHeight")) ??
					positive(read(sdk, "viewportHeight"));
			let css: ReturnType<typeof ownStyles> | undefined;
			let theme: TelegramThemeSnapshot;
			let preference: TelegramThemePreference = "auto";
			const contextMatches = () => matchesCurrent(dependencies.readCurrentSdk);
			const notify = () => {
				for (const listener of [...listeners]) {
					try {
						listener();
					} catch {
						/* Observers do not control admission. */
					}
				}
			};
			const safely = (operation: (() => unknown) | undefined) => {
				try {
					operation?.();
				} catch {
					/* Optional host cleanup is best effort. */
				}
			};
			const end = (restoreHost: boolean) => {
				if (disposed) return;
				disposed = true;
				for (const remove of removers.splice(0).reverse()) safely(remove);
				backListeners.clear();
				css?.dispose();
				if (restoreHost && contextMatches()) {
					if (capabilities.backButton && typeof initialBack === "boolean")
						safely(initialBack ? show : hide);
					if (capabilities.closingConfirmation)
						safely(initialConfirmation ? confirmOn : confirmOff);
					if (capabilities.verticalSwipes)
						safely(initialSwipes ? swipesOn : swipesOff);
				}
				if (snapshot.active) {
					snapshot = Object.freeze({ ...snapshot, active: false });
					notify();
				}
				listeners.clear();
				themeListeners.clear();
			};
			const current = () => {
				if (disposed) return false;
				if (contextMatches()) return true;
				contextChanged = true;
				end(false);
				safely(dependencies.onContextChanged);
				return false;
			};
			const refresh = (commitStable = false) => {
				if (!current()) return;
				let browser: TelegramBrowserLayout;
				try {
					browser = dependencies.readBrowser();
				} catch {
					browser = { height: 0, width: 0, visible: false, focused: false };
				}
				const liveHeight = positive(read(sdk, "viewportHeight"));
				if (commitStable)
					stableHeight =
						positive(read(sdk, "viewportStableHeight")) ??
						liveHeight ??
						stableHeight;
				const visualHeight = positive(browser.visualHeight),
					windowHeight = positive(browser.height),
					base = stableHeight ?? liveHeight ?? windowHeight;
				const heights = [base, visualHeight, windowHeight].filter(
					(height): height is number => height !== undefined,
				);
				const height = heights.length ? Math.min(...heights) : undefined;
				const width = positive(browser.width);
				const prior = layout?.viewport;
				// Keep the pre-keyboard projection until the closing animation finishes.
				// A different width starts a new fit, including a rotation mid-entry.
				const visibleHeight = height ?? 0;
				const priorHeight = prior?.height ?? 0;
				const closingKeyboard = priorHeight < drawingHeight && visibleHeight >= priorHeight;
				drawingHeight = prior?.width === width && (browser.textEntryFocused || closingKeyboard)
					? Math.max(drawingHeight, visibleHeight)
					: visibleHeight;
				const effectiveScheme = colorScheme(preference) ?? colorScheme(read(sdk, "colorScheme")) ??
					dependencies.readSystemColorScheme?.() ?? "light";
				const hostPalette = effectiveScheme === "dark" ? hostDark : hostLight;
				const themeChanged = theme?.preference !== preference || theme.colorScheme !== effectiveScheme;
				if (themeChanged) {
					theme = Object.freeze({
						preference,
						colorScheme: effectiveScheme,
						background: hostPalette["plan-canvas"],
					});
				}
				const next: TelegramHostLayout = Object.freeze({
					viewport: Object.freeze({
						liveHeight,
						stableHeight,
						visualHeight,
						height,
						width,
					}),
					safeArea: insets(
						capabilities.safeArea ? read(sdk, "safeAreaInset") : undefined,
					),
					contentSafeArea: insets(
						capabilities.safeArea
							? read(sdk, "contentSafeAreaInset")
							: undefined,
					),
					colorScheme: effectiveScheme,
				});
				const layoutChanged =
					layout !== undefined &&
					JSON.stringify({ ...layout, colorScheme: undefined }) !==
						JSON.stringify({ ...next, colorScheme: undefined });
				layout = next;
				const active = hostActive && browser.visible && browser.focused;
				const nextSnapshot = Object.freeze({
					active,
					layoutVersion: snapshot.layoutVersion + (layoutChanged ? 1 : 0),
				});
				const changed = active !== snapshot.active || layoutChanged;
				if (changed) snapshot = nextSnapshot;
				const values: Styles = new Map(
					Object.entries(next.colorScheme === "dark" ? dark : light),
				);
				for (const [name, value] of Object.entries(hostPalette))
					values.set(`--editor-host-${name}`, value);
				values.set("color-scheme", next.colorScheme);
				values.set("--editor-host-radius", "12px");
				values.set("--editor-host-touch-gap", "8px");
				values.set("--editor-keyboard-inset", `${drawingHeight - visibleHeight}px`);
				values.set("color", "var(--ink)");
				values.set("background-color", "var(--canvas)");
				values.set(
					"--editor-viewport-height",
					height === undefined ? "" : `${height}px`,
				);
				for (const side of sides)
					values.set(
						`--editor-safe-area-${side}`,
						`max(env(safe-area-inset-${side}, 0px), ${Math.max(next.safeArea[side], next.contentSafeArea[side])}px)`,
					);
				css?.update(values);
				if (changed) notify();
				if (themeChanged) for (const listener of [...themeListeners]) safely(listener);
			};
			const subscribeEvent = (
				name: string,
				handler: (value?: unknown) => void,
			) => {
				if (disposed || !on || !off) return;
				const callback = (value?: unknown) => {
					if (current()) handler(value);
				};
				removers.push(() => {
					off(name, callback);
				});
				try {
					on(name, callback);
				} catch {
					/* Unsupported event leaves browser/DOM paths available. */
				}
			};
			if (!contextMatches()) throw new Error("Telegram host context changed");
			css = ownStyles(dependencies.style);
			safely(() => { preference = colorScheme(dependencies.themePreference?.read()) ?? "auto"; });
			refresh();
			safely(() => {
				const remove = dependencies.subscribeSystemColorScheme?.(() => refresh());
				if (!remove) return;
				if (disposed) safely(remove);
				else removers.push(remove);
			});
			if (events) {
				subscribeEvent("themeChanged", () => refresh());
				subscribeEvent("viewportChanged", (value) =>
					refresh(read(object(value), "isStateStable") === true),
				);
				if (capabilities.safeArea) {
					subscribeEvent("safeAreaChanged", () => refresh());
					subscribeEvent("contentSafeAreaChanged", () => refresh());
					subscribeEvent("fullscreenChanged", () => refresh(true));
				}
				if (capabilities.lifecycle) {
					subscribeEvent("activated", () => {
						hostActive = true;
						refresh(true);
					});
					subscribeEvent("deactivated", () => {
						hostActive = false;
						refresh();
					});
				}
				if (capabilities.backButton)
					subscribeEvent("backButtonClicked", () => {
						for (const listener of [...backListeners]) {
							try {
								listener();
							} catch {
								/* Other listeners still run. */
							}
						}
					});
			}
			if (!disposed) {
				try {
					const removeBrowser = dependencies.subscribeBrowser(() => refresh());
					if (disposed) safely(removeBrowser);
					else removers.push(removeBrowser);
				} catch {
					/* Initial browser state remains conservative. */
				}
			}
			const navigation: HostNavigationPort = {
				subscribeBack(listener) {
					if (!current()) return () => undefined;
					backListeners.add(listener);
					return () => {
						backListeners.delete(listener);
					};
				},
				setBackVisible(visible) {
					if (current() && capabilities.backButton) (visible ? show : hide)?.();
				},
				close() {
					if (current()) close();
				},
				...(capabilities.closingConfirmation
					? {
							setClosingConfirmation(enabled: boolean) {
								if (current()) (enabled ? confirmOn : confirmOff)?.();
							},
						}
					: {}),
				...(capabilities.verticalSwipes
					? {
							setVerticalSwipesEnabled(enabled: boolean) {
								if (current()) (enabled ? swipesOn : swipesOff)?.();
							},
						}
					: {}),
			};
			const settings=object(read(sdk,"SettingsButton"));
			const settingsOn=method(settings,"onClick"), settingsOff=method(settings,"offClick");
			const settingsShow=method(settings,"show"), settingsHide=method(settings,"hide");
			return Object.freeze({
				...(atLeast(sdk,"6.10") && settingsOn && settingsOff && settingsShow && settingsHide ? {
					showSettings(listener:()=>void) {
						const callback=()=>{ if(current())listener(); };
						const wasVisible=read(settings,"isVisible")===true;
						const remove=()=>{safely(()=>settingsOff(callback));if(!wasVisible && contextMatches())safely(settingsHide);};
						try {settingsOn(callback);settingsShow();} catch(e){remove();throw e;}
						removers.push(remove);
						return ()=>{const index=removers.indexOf(remove);if(index>=0){removers.splice(index,1);remove();}};
					}
				}:{}),
				navigation,
				theme: Object.freeze({
					snapshot: () => theme,
					subscribe(listener: () => void) {
						if (disposed) return () => undefined;
						themeListeners.add(listener);
						return () => { themeListeners.delete(listener); };
					},
					setPreference(next: TelegramThemePreference) {
						if (!current() || next === preference) return;
						preference = next;
						safely(() => dependencies.themePreference?.write(next));
						refresh();
					},
				}),
				lifecycle: Object.freeze({
					snapshot: () => snapshot,
					subscribe(listener: () => void) {
						if (disposed) return () => undefined;
						listeners.add(listener);
						return () => {
							listeners.delete(listener);
						};
					},
				}),
				capabilities,
				layout: () => layout,
				dispose: () => end(!contextChanged),
			});
		},
	});
}

/** Native listeners use capture so editor blur handlers can observe inactivity first. */
export function createTelegramBrowserSignals(context: {
	readonly window: Window;
	readonly document: Document;
}): Pick<
	TelegramHostEnvironmentDependencies,
	"style" | "readBrowser" | "subscribeBrowser" | "readSystemColorScheme" | "subscribeSystemColorScheme"
> {
	const { window, document } = context;
	const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
	return {
		style: document.documentElement.style,
		readSystemColorScheme: () => systemTheme?.matches ? "dark" : "light",
		subscribeSystemColorScheme(listener) {
			systemTheme?.addEventListener?.("change", listener);
			return () => systemTheme?.removeEventListener?.("change", listener);
		},
		readBrowser: () => ({
			height: window.innerHeight,
			width: window.innerWidth,
			visualHeight: window.visualViewport?.height,
			textEntryFocused: document.activeElement?.matches(
				'textarea:not([readonly]), input:not([readonly]):is(:not([type]), [type="text"], [type="search"], [type="number"], [type="email"], [type="tel"], [type="url"], [type="password"])',
			) === true,
			visible: document.visibilityState !== "hidden",
			focused: document.hasFocus(),
		}),
		subscribeBrowser(listener) {
			const targets: readonly (readonly [EventTarget, string])[] = [
				[window, "blur"],
				[window, "focus"],
				[window, "resize"],
				[window, "orientationchange"],
				[document, "visibilitychange"],
				...(window.visualViewport
					? ([
							[window.visualViewport, "resize"],
							[window.visualViewport, "scroll"],
						] as const)
					: []),
			];
			for (const [target, event] of targets)
				target.addEventListener(event, listener, true);
			return () => {
				for (const [target, event] of targets)
					target.removeEventListener(event, listener, true);
			};
		},
	};
}
