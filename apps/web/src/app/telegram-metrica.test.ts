import { expect, rs, test } from "@rstest/core";
import { parseTelegramDeploymentConfiguration } from "./telegram-editor-app";
import { createTelegramAnalytics } from "./telegram-analytics";
import {
	parseAnalyticsDocument,
	channelMessage,
	readChannelMessage,
} from "./telegram-analytics-channel";
import { openAnalyticsFrame } from "./telegram-analytics-frame";
import { installAnalyticsDocument } from "./telegram-analytics-document";

const parentOrigin = "https://editor.example";
const childOrigin = "https://analytics.example";
const path = `/v1/launch-v1.${"a".repeat(64)}.html`;
const config = { documentURL: childOrigin + path, counterId: 123 };
const launch = {
	botId: "123",
	environment: "production",
	telegramURL: "https://t.me/sample",
	webURL: parentOrigin,
};
const token = "45cdd65d-5792-4c1c-b4d3-946b8c4c3f05";

test("optional analytics configuration cannot disable admission or authorize a same-origin or decorated document", () => {
	expect(
		parseTelegramDeploymentConfiguration({ ...launch, analytics: config }).kind,
	).toBe("configured");
	expect(parseAnalyticsDocument(config, parentOrigin)).toEqual(config);
	for (const documentURL of [
		null,
		"",
		"relative",
		parentOrigin + path,
		`${childOrigin}/t.html`,
		"http://outside.invalid/t",
		"https://u:p@a.invalid/t",
		`${config.documentURL}?a`,
		`${config.documentURL}#hash`,
	]) {
		expect(
			parseAnalyticsDocument({ ...config, documentURL }, parentOrigin),
		).toBeUndefined();
	}
	for (const counterId of [
		null,
		0,
		-1,
		1.5,
		Number.MAX_SAFE_INTEGER + 1,
		"123",
	])
		expect(
			parseAnalyticsDocument({ ...config, counterId }, parentOrigin),
		).toBeUndefined();
	expect(
		parseAnalyticsDocument({ ...config, other: true }, parentOrigin),
	).toBeUndefined();
	expect(
		parseAnalyticsDocument(
			{ documentURL: `http://127.0.0.1:8888${path}`, counterId: 2 },
			"http://127.0.0.1:9999",
		),
	).toBeDefined();
	expect(
		parseAnalyticsDocument(
			{ documentURL: `http://127.0.0.1:8888${path}`, counterId: 2 },
			parentOrigin,
		),
	).toBeUndefined();
});

test("the versioned channel admits only a closed record and one generation", () => {
	for (const type of [
		"connect",
		"ready",
		"activate",
		"online",
		"launch",
		"accepted",
		"failed",
	] as const) {
		const message = channelMessage(type, token, config.counterId);
		expect(readChannelMessage(message, config.counterId)).toEqual(message);
		for (const invalid of [
			null,
			[],
			{},
			{ ...message, type: "feedback_rating" },
			{ ...message, v: 2 },
			{ ...message, token: "bad" },
			{ ...message, counterId: 2 },
			{ ...message, href: "secret" },
		])
			expect(readChannelMessage(invalid, config.counterId)).toBeUndefined();
	}
});

function frameFixture({
	topLevel = false,
	referrer = "",
	blocked = false,
} = {}) {
	const win = new EventTarget() as EventTarget & Record<string, unknown>;
	const doc = new EventTarget() as EventTarget & Record<string, unknown>;
	const posts: { data: ReturnType<typeof channelMessage>; origin: string }[] =
		[];
	const parent = {
		postMessage(data: ReturnType<typeof channelMessage>, origin: string) {
			posts.push({ data, origin });
		},
	};
	const calls: unknown[][] = [],
		scripts: {
			src: string;
			onload: () => void;
			onerror: () => void;
			remove: () => void;
		}[] = [];
	const removed: string[] = [];
	Object.assign(win, {
		parent: topLevel ? win : parent,
		document: doc,
		location: new URL(config.documentURL),
		localStorage: {
			removeItem(key: string) {
				if (blocked) throw Error("denied");
				removed.push(key);
			},
		},
	});
	Object.assign(doc, {
		referrer,
		createElement: () => ({ remove() {} }),
		head: {
			appendChild: (node: (typeof scripts)[number]) => scripts.push(node),
		},
	});
	const receive = (
		type: string,
		opts: {
			origin?: string;
			source?: unknown;
			nonce?: string;
			extra?: object;
		} = {},
	) => {
		const event = Object.assign(new Event("message"), {
			source: opts.source ?? parent,
			origin: opts.origin ?? parentOrigin,
			data: {
				...channelMessage("connect", opts.nonce ?? token, config.counterId),
				type,
				...opts.extra,
			},
		});
		win.dispatchEvent(event);
	};
	const start = () =>
		installAnalyticsDocument(win as unknown as Window, {
			editorOrigin: parentOrigin,
			counterId: config.counterId,
		});
	function loadSdk() {
		win.ym = (...args: unknown[]) => {
			calls.push(args);
			if (args[1] === "init")
				doc.dispatchEvent(new Event("yacounter123inited"));
		};
		scripts[0].onload();
	}
	return { win, posts, calls, scripts, removed, receive, start, loadSdk };
}

test("isolated document loads the SDK only after its parent confirms the handshake and emits one minimized launch", () => {
	const f = frameFixture();
	f.start();
	for (const opts of [
		{ origin: childOrigin },
		{ source: {} },
		{ extra: { url: "private" } },
	])
		f.receive("connect", opts);
	f.receive("activate");
	f.receive("launch");
	expect(f.posts).toEqual([]);
	f.receive("connect");
	expect(f.posts.map((x) => [x.data.type, x.origin])).toEqual([
		["ready", parentOrigin],
	]);
	f.receive("activate", { nonce: "c1aa5506-84ed-4f58-af60-dee9f544986c" });
	expect(f.scripts).toHaveLength(0);
	f.receive("activate");
	f.receive("activate");
	f.receive("launch");
	expect(f.scripts.map((x) => x.src)).toEqual([
		"https://mc.yandex.ru/metrika/tag.js",
	]);
	expect(f.calls).toEqual([]);
	f.loadSdk();
	expect(f.posts.at(-1)?.data.type).toBe("online");
	f.receive("launch", { origin: childOrigin });
	f.receive("launch", { extra: { scope: "private" } });
	expect(f.calls).toHaveLength(1);
	f.receive("launch");
	f.receive("launch");
	expect(f.calls).toEqual([
		[
			123,
			"init",
			{
				defer: true,
				clickmap: false,
				trackLinks: false,
				accurateTrackBounce: false,
				sendTitle: false,
				webvisor: false,
				childIframe: false,
				ecommerce: false,
				trackHash: false,
				disableYtm: true,
				triggerEvent: true,
			},
		],
		[123, "hit", "https://domiknote.ru/tma", { referer: "", title: "" }],
		[123, "reachGoal", "tma_open"],
	]);
	expect(f.posts.at(-1)?.data.type).toBe("accepted");
	f.win.dispatchEvent(new Event("pagehide"));
	f.receive("activate");
	f.receive("launch");
	expect(f.scripts).toHaveLength(1);
	expect(f.calls.filter((x) => x[1] === "hit")).toHaveLength(1);
	expect(f.removed.filter((x) => x === "_ym_retryReqs")).toHaveLength(2);
});
test("top-level and referrer-bearing documents stay inert and denied storage prevents SDK loading", () => {
	for (const options of [
		{ topLevel: true },
		{ referrer: `${parentOrigin}/private` },
	]) {
		const f = frameFixture(options);
		f.start();
		f.receive("connect");
		f.receive("activate");
		expect(f.posts).toEqual([]);
		expect(f.scripts).toEqual([]);
	}
	const f = frameFixture({ blocked: true });
	f.start();
	f.receive("connect");
	f.receive("activate");
	expect(f.posts.at(-1)?.data.type).toBe("failed");
	expect(f.scripts).toEqual([]);
});

test("a shared consent generation fences pending transports and prevents replay across re-enabling within one launch", async () => {
	let generation: string | undefined;
	const listeners = new Set<() => void>();
	const consent = {
		read: () => generation,
		grant: () => {
			generation = crypto.randomUUID();
			return generation;
		},
		revoke: () => {
			generation = undefined;
		},
		subscribe: (fn: () => void) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	};
	const calls: string[] = [];
	const lifecycle = new AbortController();
	const analytics = createTelegramAnalytics(
		lifecycle.signal,
		async (_signal, allowed) => {
			calls.push("open");
			return {
				send: async (event) => {
					if (allowed()) calls.push(event.name);
					return true;
				},
				close: () => {
					calls.push("close");
				},
			};
		},
		consent,
	);
	expect(analytics.snapshot()).toBe("off");
	expect(calls).toEqual([]);
	await analytics.enable();
	expect(calls).toEqual(["open", "tma_open"]);
	consent.revoke();
	for (const listener of listeners) listener();
	expect(analytics.snapshot()).toBe("off");
	expect(await analytics.submitRating(true, 3)).toBe(false);
	await analytics.enable();
	expect(calls.filter((x) => x === "tma_open")).toHaveLength(1);
	lifecycle.abort();
	expect(analytics.snapshot()).toBe("off");
	expect(listeners.size).toBe(0);
	await analytics.enable();
	expect(calls.filter((x) => x === "open")).toHaveLength(2);
});

function editorFrameFixture() {
	const w = new EventTarget();
	const posts: { data: ReturnType<typeof channelMessage>; origin: string }[] =
		[];
	const child = {
		postMessage(data: ReturnType<typeof channelMessage>, origin: string) {
			posts.push({ data, origin });
		},
	};
	const attrs: Record<string, string> = {};
	let removed = 0,
		appended = 0,
		permitted = true;
	const frame = Object.assign(new EventTarget(), {
		contentWindow: child as typeof child | null,
		setAttribute: (key: string, value: string) => {
			attrs[key] = value;
		},
		remove() {
			removed++;
		},
		hidden: false,
		src: "",
		referrerPolicy: "",
	});
	const doc = {
		createElement: (tag: string) => {
			expect(tag).toBe("iframe");
			return frame;
		},
		body: {
			appendChild: () => {
				appended++;
			},
		},
	};
	const win = Object.assign(w, { crypto, document: doc }) as unknown as Window;
	const control = new AbortController();
	const open = () =>
		openAnalyticsFrame(win, config, control.signal, () => permitted);
	const reply = (
		type: "ready" | "online" | "accepted" | "failed",
		origin = childOrigin,
		source: unknown = child,
		nonce = posts[0].data.token,
	) =>
		w.dispatchEvent(
			Object.assign(new Event("message"), {
				origin,
				source,
				data: channelMessage(type, nonce, config.counterId),
			}),
		);
	const loaded = () => frame.dispatchEvent(new Event("load"));
	return {
		child,
		control,
		frame,
		posts,
		attrs,
		loaded,
		open,
		reply,
		doc,
		removed: () => removed,
		appended: () => appended,
		deny: () => {
			permitted = false;
		},
	};
}

test("parent activates and sends only to the current child, closes immediately on withdrawal", async () => {
	const f = editorFrameFixture();
	const transport = f.open();
	expect(f.appended()).toBe(1);
	expect(f.frame.hidden).toBe(true);
	expect(f.frame.referrerPolicy).toBe("no-referrer");
	expect(f.attrs.sandbox).toBe("allow-scripts allow-same-origin");
	expect(f.frame.src).toBe(config.documentURL);
	f.loaded();
	expect(f.posts[0].data.type).toBe("connect");
	expect(f.posts[0].origin).toBe(childOrigin);
	f.reply("online");
	f.reply("accepted");
	f.reply("ready", parentOrigin);
	f.reply("ready", childOrigin, {});
	f.reply("ready", childOrigin, f.child, crypto.randomUUID());
	expect(f.posts).toHaveLength(1);
	f.reply("ready");
	f.reply("ready");
	expect(f.posts.map((x) => x.data.type)).toEqual(["connect", "activate"]);
	f.reply("online");
	const t = await transport;
	expect(
		await t.send({ name: "feedback_rating", completed: true, rating: 2 }),
	).toBe(false);
	const sent = t.send({ name: "tma_open" });
	expect(f.posts.at(-1)?.data.type).toBe("launch");
	f.reply("accepted");
	expect(await sent).toBe(true);
	expect(await t.send({ name: "tma_open" })).toBe(false);
	f.deny();
	f.control.abort();
	t.close();
	expect(f.removed()).toBe(1);
});

test("withdrawn consent, navigation and failed or timed-out handshakes discard pending launches", async () => {
	for (const deny of ["aborted", "withheld"] as const) {
		const f = editorFrameFixture();
		if (deny === "aborted") f.control.abort();
		else f.deny();
		await expect(f.open()).rejects.toThrow("Analytics consent unavailable");
		expect(f.appended()).toBe(0);
	}
	rs.useFakeTimers();
	try {
		for (const failure of [
			"load-error",
			"aborted",
			"reloaded",
			"revoked",
			"child-failed",
			"posting-error",
			"no-window",
			"timer",
		] as const) {
			const f = editorFrameFixture();
			const pending = expect(f.open()).rejects.toThrow(
				"Analytics document unavailable",
			);
			if (failure === "posting-error")
				f.child.postMessage = () => {
					throw Error("detached");
				};
			if (failure === "no-window") f.frame.contentWindow = null;
			f.loaded();
			if (failure === "load-error") f.frame.dispatchEvent(new Event("error"));
			if (failure === "aborted") f.control.abort();
			if (failure === "reloaded") f.loaded();
			if (failure === "child-failed") f.reply("failed");
			if (failure === "revoked") {
				f.deny();
				f.reply("ready");
			}
			if (failure === "timer") {
				await rs.advanceTimersByTimeAsync(9999);
				expect(f.removed()).toBe(0);
				await rs.advanceTimersByTimeAsync(1);
			}
			await pending;
			expect(f.removed()).toBe(1);
		}
	} finally {
		rs.useRealTimers();
	}
	const f = editorFrameFixture();
	const connected = f.open();
	f.loaded();
	f.reply("ready");
	f.reply("online");
	const transport = await connected;
	const sent = transport.send({ name: "tma_open" });
	f.control.abort();
	expect(await sent).toBe(false);
	const late = editorFrameFixture();
	const c = late.open();
	late.loaded();
	late.reply("ready");
	late.reply("online");
	const t = await c;
	late.deny();
	expect(await t.send({ name: "tma_open" })).toBe(false);
	expect(late.posts).toHaveLength(2);
});

test("a saved grant resumes once, stale grants cannot send, and a storage error keeps the editor usable", async () => {
	let current: string | undefined = token;
	const consent = {
		read: () => current,
		grant: () => {
			throw Error("blocked");
		},
		revoke: () => {
			current = undefined;
		},
		subscribe: (_fn: () => void) => () => {},
	};
	const lifecycle = new AbortController();
	const calls: string[] = [];
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const a = createTelegramAnalytics(
		lifecycle.signal,
		async () => {
			await gate;
			return {
				send: () => {
					calls.push("sent");
					return true;
				},
				close: () => {
					calls.push("closed");
				},
			};
		},
		consent,
		false,
	);
	const starting = a.start();
	expect(a.snapshot()).toBe("connecting");
	current = undefined;
	release();
	await starting;
	expect(calls).toEqual(["closed"]);
	expect(a.snapshot()).toBe("off");
	expect(a.canRate).toBe(false);
	await a.enable();
	expect(a.snapshot()).toBe("unavailable");
	expect(calls).toEqual(["closed"]);
});

test("canonical analytics paths and exact parent pairing reject edge-case URL variants", () => {
	for (const documentURL of [
		`${config.documentURL}?`,
		`${config.documentURL}#`,
		`https://u@analytics.example${path}`,
		`https://:p@analytics.example${path}`,
		`https://ANALYTICS.example${path}`,
		`https://analytics.example/${path.replace("v1/", "v2/../v1/")}`,
		`http://example.test${path}`,
		`ftp://127.0.0.1${path}`,
		`http://127.0.0.2${path}`,
		config.documentURL.replace("launch-v1", "launch-v2"),
		config.documentURL.replace("a".repeat(64), "a".repeat(63)),
		config.documentURL.replace("a".repeat(64), "A".repeat(64)),
	])
		expect(
			parseAnalyticsDocument({ ...config, documentURL }, parentOrigin),
		).toBeUndefined();
	for (const bad of [
		null,
		true,
		[],
		{},
		{ a: 1, b: 2 },
		{ documentURL: config.documentURL, other: 1 },
	])
		expect(parseAnalyticsDocument(bad, parentOrigin)).toBeUndefined();
	const good = parseTelegramDeploymentConfiguration(
		{ ...launch, analytics: config },
		parentOrigin,
	);
	if (good.kind !== "configured") throw Error("editor unavailable");
	expect(good.configuration.usageMetrics).toBeUndefined();
	const bad = parseTelegramDeploymentConfiguration(
		{ ...launch, analytics: { ...config, counterId: -5 } },
		parentOrigin,
	);
	if (bad.kind !== "configured") throw Error("editor unavailable");
	expect(bad.configuration.usageMetrics).toBeUndefined();
});

test("local consent is scoped across accounts and reacts to other tabs' withdrawal and clearing storage", async () => {
	const { scopedAnalyticsConsent } = await import("./telegram-analytics");
	type Scope = Parameters<typeof scopedAnalyticsConsent>[1];
	const map = new Map<string, string>();
	const target = new EventTarget();
	const win = Object.assign(target, {
		crypto,
		localStorage: {
			getItem: (key: string) => map.get(key) ?? null,
			setItem: (key: string, value: string) => {
				map.set(key, value);
			},
			removeItem: (key: string) => {
				map.delete(key);
			},
		},
	}) as unknown as Window;
	const scope = `tma-v1-${"1".repeat(64)}` as Scope;
	const first = scopedAnalyticsConsent(win, scope);
	const other = scopedAnalyticsConsent(
		win,
		`tma-v1-${"2".repeat(64)}` as Scope,
	);
	expect(first.read()).toBeUndefined();
	expect(map.size).toBe(0);
	const grant = first.grant();
	expect(first.read()).toBe(grant);
	expect(other.read()).toBeUndefined();
	const key = [...map.keys()][0];
	expect(key).toBe(`interiors-tma-context-v1:${scope}:analytics-consent-v1`);
	let changes = 0;
	const stop = first.subscribe(() => {
		changes++;
	});
	const inform = (key: string | null) =>
		win.dispatchEvent(Object.assign(new Event("storage"), { key }));
	inform("other");
	expect(changes).toBe(0);
	inform(key);
	inform(null);
	win.dispatchEvent(new Event("pageshow"));
	expect(changes).toBe(3);
	first.revoke();
	expect(first.read()).toBeUndefined();
	expect(map.size).toBe(0);
	map.set(key, "tampered");
	expect(first.read()).toBeUndefined();
	stop();
	inform(key);
	win.dispatchEvent(new Event("pageshow"));
	expect(changes).toBe(3);
});

test("launch-only grants stop on failed sends, stay revocable, and feedback transport retains explicit rating behavior", async () => {
	const lifecycle = new AbortController();
	const calls: unknown[] = [];
	let closed = 0;
	let fail = false;
	const a = createTelegramAnalytics(lifecycle.signal, () => ({
		send: (event) => {
			calls.push(event);
			if (fail) throw Error("failed");
			return true;
		},
		close: () => {
			closed++;
			throw Error("closed");
		},
	}));
	const seen: string[] = [];
	const remove = a.subscribe(() => seen.push(a.snapshot()));
	await a.start();
	expect(a.hasConsent()).toBe(false);
	expect(await a.submitRating(true, 5)).toBe(false);
	await Promise.all([a.enable(), a.enable()]);
	expect(a.hasConsent()).toBe(true);
	expect(a.snapshot()).toBe("on");
	for (const value of [0, 6, NaN, 2.5])
		expect(await a.submitRating(false, value)).toBe(false);
	for (const value of [1, 2, 3, 4, 5])
		expect(await a.submitRating(value === 2, value)).toBe(true);
	expect(calls).toEqual([
		{ name: "tma_open" },
		...[1, 2, 3, 4, 5].map((rating) => ({
			name: "feedback_rating",
			rating,
			completed: rating === 2,
		})),
	]);
	fail = true;
	expect(await a.submitRating(false, 1)).toBe(false);
	a.withdraw();
	expect(a.hasConsent()).toBe(false);
	expect(a.snapshot()).toBe("off");
	expect(closed).toBe(1);
	remove();
	const was = seen.length;
	await a.enable();
	expect(seen.length).toBe(was);
	expect(
		calls.filter((x) => (x as { name: string }).name === "tma_open"),
	).toHaveLength(1);
	const b = createTelegramAnalytics(new AbortController().signal, () => ({
		send: () => false,
		close() {},
	}));
	await b.enable();
	expect(b.snapshot()).toBe("unavailable");
	expect(b.hasConsent()).toBe(true);
	b.withdraw();
	expect(b.snapshot()).toBe("off");
	const c = createTelegramAnalytics(new AbortController().signal, () => {
		throw Error("network");
	});
	await c.enable();
	expect(c.snapshot()).toBe("unavailable");
});

test("recipient rejects untrusted config and alternate document locations before receiving messages", () => {
	for (const childConfig of [
		undefined,
		true,
		[],
		{},
		{ editorOrigin: parentOrigin, counterId: "7" },
		{ editorOrigin: childOrigin, counterId: 123 },
		{ editorOrigin: "http://example.com", counterId: 1 },
		{ editorOrigin: `${parentOrigin}/path`, counterId: 123 },
		{ editorOrigin: parentOrigin, counterId: 123, extra: 0 },
	]) {
		const f = frameFixture();
		installAnalyticsDocument(f.win as unknown as Window, childConfig);
		f.receive("connect");
		expect(f.posts).toEqual([]);
	}
	for (const suffix of ["?test=x", "#details"]) {
		const f = frameFixture();
		f.win.location = new URL(config.documentURL + suffix);
		f.start();
		f.receive("connect");
		expect(f.posts).toEqual([]);
	}
	const f = frameFixture();
	f.start();
	f.receive("connect");
	f.receive("activate");
	f.scripts[0].onerror();
	expect(f.posts.map((x) => x.data.type)).toEqual(["ready", "failed"]);
	f.receive("launch");
	expect(f.calls).toEqual([]);
});

test("withdrawal still closes a live document when the storage API starts denying mutations", async () => {
	const lifecycle = new AbortController();
	let closed = 0;
	let generation: string | undefined;
	const consent = {
		read: () => generation,
		grant: () => {
			generation = token;
			return token;
		},
		revoke: () => {
			throw Error("denied");
		},
		subscribe: () => () => {},
	};
	const a = createTelegramAnalytics(
		lifecycle.signal,
		() => ({
			send: () => true,
			close: () => {
				closed++;
			},
		}),
		consent,
		false,
	);
	await a.enable();
	expect(a.snapshot()).toBe("on");
	expect(() => a.withdraw()).not.toThrow();
	expect(a.snapshot()).toBe("withdrawal-failed");
	expect(closed).toBe(1);
	await a.start();
	expect(closed).toBe(1);
	expect(a.snapshot()).toBe("withdrawal-failed");
});

test("closed records reject inherited protocol fields and an unavailable SDK cannot acknowledge a goal", () => {
	const { type, ...other } = channelMessage("launch", token, 123);
	expect(
		readChannelMessage(
			Object.assign(Object.create({ type }), other, { private: "secret" }),
			123,
		),
	).toBeUndefined();
	const f = frameFixture();
	f.start();
	f.receive("connect");
	f.receive("activate");
	f.loadSdk();
	f.win.ym = undefined;
	f.receive("launch");
	expect(f.posts.at(-1)?.data.type).toBe("failed");
	expect(f.calls).toHaveLength(1);
});

test("controlled activation admits a signed measurement launch and keeps ordinary launches disabled", async () => {
	const { analyticsForVerifiedLaunch } = await import(
		"./telegram-analytics-channel"
	);
	const controlled = { ...config, testLaunchOnly: true as const };
	expect(parseAnalyticsDocument(controlled, parentOrigin)).toEqual(controlled);
	for (const testLaunchOnly of [false, 0, null, undefined, "true"])
		expect(
			parseAnalyticsDocument({ ...config, testLaunchOnly }, parentOrigin),
		).toBeUndefined();
	expect(analyticsForVerifiedLaunch(controlled, undefined)).toBeUndefined();
	expect(analyticsForVerifiedLaunch(controlled, true)).toEqual(controlled);
	expect(analyticsForVerifiedLaunch(config, undefined)).toEqual(config);
	expect(analyticsForVerifiedLaunch(undefined, true)).toBeUndefined();
});

test("failed durable withdrawal notifies active scope peers and can be retried once storage recovers", async () => {
	const { scopedAnalyticsConsent } = await import("./telegram-analytics");
	type Scope = Parameters<typeof scopedAnalyticsConsent>[1];
	const scope = `tma-v1-${"3".repeat(64)}` as Scope;
	const map = new Map<string, string>();
	let blocked = false;
	const storage = {
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => {
			map.set(key, value);
		},
		removeItem: (key: string) => {
			if (blocked) throw Error("write denied");
			map.delete(key);
		},
	};
	const launch = () => {
		const lifecycle = new AbortController();
		const win = Object.assign(new EventTarget(), {
			crypto,
			localStorage: storage,
			BroadcastChannel,
		}) as unknown as Window;
		const consent = scopedAnalyticsConsent(win, scope);
		const app = createTelegramAnalytics(
			lifecycle.signal,
			() => ({ send: () => true, close: () => {} }),
			consent,
			false,
		);
		return { app, lifecycle };
	};
	const first = launch();
	const peer = launch();
	try {
		await first.app.enable();
		await peer.app.start();
		expect(peer.app.snapshot()).toBe("on");
		blocked = true;
		const stopped = new Promise<void>((done) => {
			const off = peer.app.subscribe(() => {
				if (peer.app.snapshot() === "off") {
					off();
					done();
				}
			});
		});
		first.app.withdraw();
		expect(first.app.snapshot()).toBe("withdrawal-failed");
		await stopped;
		expect(peer.app.hasConsent()).toBe(false);
		expect(map.size).toBe(1);
		blocked = false;
		first.app.withdraw();
		expect(first.app.snapshot()).toBe("off");
		expect(map.size).toBe(0);
	} finally {
		first.lifecycle.abort();
		peer.lifecycle.abort();
	}
});
