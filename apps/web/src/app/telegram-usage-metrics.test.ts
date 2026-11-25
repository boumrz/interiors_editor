import { expect, test } from "@rstest/core";
import {
	createUsageMetrics,
	deviceStatisticsStore,
} from "./telegram-usage-metrics";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import type { ProductMetric } from "../application/editor-product-metrics";

const now = Date.UTC(2026, 10, 22, 12);
const cutoff = Date.UTC(2027, 2, 31, 21);
const first = now / 1000;
const open = "/stats/tma-open-v2",
	mobileOpen = "/stats/tma-mobile-open-v1",
	repeat = "/stats/tma-repeat-v2";
const scope = ("tma-v1-" + "a".repeat(64)) as VerifiedTelegramScope;
const other = ("tma-v1-" + "b".repeat(64)) as VerifiedTelegramScope;
function fixture() {
	const local = new Map<string, string>(),
		session = new Map<string, string>();
	const sent: string[] = [];
	const env = {
		time: now,
		active: true,
		form: true,
		productForm: true,
		failSession: false,
		digest: "a".repeat(64),
		failRead: false,
		reads: 0,
		failWrite: false,
		failPrimary: false,
		onSaved: undefined as (() => void) | undefined,
		onSent: undefined as (() => void) | undefined,
		ignoreWrite: false,
	};
	const storage = (map: Map<string, string>) => ({
		getItem(key: string) {
			env.reads++;
			if (env.failRead) throw Error();
			return map.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			if (env.failSession && map === session) throw Error();
			if (env.failWrite || (env.failPrimary && !key.includes(":stop:")))
				throw Error();
			if (!env.ignoreWrite) map.set(key, value);
			if (!key.includes(":stop:")) env.onSaved?.();
		},
		removeItem(key: string) {
			map.delete(key);
		},
	});
	let tail: Promise<unknown> = Promise.resolve();
	const lock = async (work: () => Promise<void>) => {
		const turn = tail.then(work);
		tail = turn.catch(() => {});
		await turn;
	};
	const model = (
		at?: number,
		area = scope,
		abort = new AbortController(),
		platform?: unknown,
	) =>
		createUsageMetrics({
			store: deviceStatisticsStore(
				area,
				() => storage(local),
				() => storage(session),
			),
			launch: at,
			platform,
			signal: abort.signal,
			clock: () => env.time,
			studyActive: () => env.active,
			readable: async () => env.form,
			formDigest: env.digest,
			product: { readable: () => env.productForm },
			lock,
			send(path) {
				sent.push(path);
				env.onSent?.();
			},
		});
	return { local, session, model, sent, env, drain: () => lock(async () => {}) };
}

const productLaunch = Date.parse("2026-11-25T12:00:00+03:00") / 1000;
const productPath = (metric: ProductMetric) => `/stats/tma-editor-v2/${metric}`;

test("product consent defaults off independently of repeat consent and counts actual editor entry and approved actions", async () => {
	const f = fixture();
	f.env.time = productLaunch * 1000;
	const editor = f.model(productLaunch, scope, undefined, "ios");
	await editor.choose(true);
	await editor.openSettings();
	expect(editor.snapshot()).toMatchObject({ permission: "granted", productAvailable: true, productGranted: false });
	editor.startProduct();
	editor.recordProduct("wall_added");
	await f.drain();
	expect(f.sent).toEqual([]);
	await editor.chooseProduct(true);
	editor.recordProduct("item_placed");
	editor.recordProduct("item_placed");
	editor.recordProduct("user_text" as ProductMetric);
	await f.drain();
	expect(f.sent).toEqual([productPath("editor_entry"), productPath("item_placed")]);
	await editor.chooseProduct(false);
	editor.recordProduct("save_failed");
	await f.drain();
	expect(editor.snapshot()).toMatchObject({ permission: "granted", productGranted: false });
	expect(f.sent).toHaveLength(2);
	await editor.chooseProduct(true);
	await editor.choose(false);
	expect(editor.snapshot()).toMatchObject({ permission: "denied", productGranted: true });
	editor.recordProduct("save_failed");
	await f.drain();
	expect(f.sent).toEqual([productPath("editor_entry"), productPath("item_placed"), productPath("save_failed")]);
});

test("product records deduplicate across reload on the same verified launch and keep accounts isolated", async () => {
	const f = fixture();
	f.env.time = (productLaunch + 20) * 1000;
	const editorFor = (launch: number, area = scope) => f.model(launch, area, undefined, "android");
	const firstEditor = editorFor(productLaunch);
	await firstEditor.chooseProduct(true);
	await f.drain();
	expect(f.sent).toEqual([]);
	firstEditor.startProduct();
	firstEditor.recordProduct("wall_added");
	await f.drain();
	const reload = editorFor(productLaunch);
	reload.startProduct();
	reload.recordProduct("wall_added");
	editorFor(productLaunch, other).startProduct();
	await f.drain();
	const next = editorFor(productLaunch + 1);
	next.startProduct();
	next.recordProduct("wall_added");
	await f.drain();
	reload.recordProduct("save_failed");
	await f.drain();
	expect(f.sent).toEqual([
		productPath("editor_entry"), productPath("wall_added"),
		productPath("editor_entry"), productPath("wall_added"),
	]);
});

test("aggregate opt-out stops an action queued in another context and removes product consent across re-enabling", async () => {
	const f = fixture();
	f.env.time = productLaunch * 1000;
	const editor = f.model(productLaunch, scope, undefined, "ios");
	editor.startProduct();
	await editor.chooseProduct(true);
	await f.drain();
	editor.recordProduct("save_quota");
	await f.model().setAggregate(false);
	await f.model().setAggregate(true);
	editor.recordProduct("project_created");
	await f.drain();
	expect(f.sent).toEqual([productPath("editor_entry")]);
});

test("product consent fails closed without a verified mobile entry, displayed form or the session watermark", async () => {
	const f = fixture();
	f.env.time = productLaunch * 1000;
	for (const editor of [f.model(undefined, scope, undefined, "ios"), f.model(productLaunch, scope, undefined, "tdesktop")]) {
		await editor.chooseProduct(true);
		editor.startProduct();
		editor.recordProduct("wall_added");
	}
	const editor = f.model(productLaunch, scope, undefined, "ios");
	f.env.productForm = false;
	editor.startProduct();
	await editor.chooseProduct(true);
	editor.recordProduct("wall_added");
	f.env.productForm = true;
	f.env.failSession = true;
	await editor.chooseProduct(true);
	editor.recordProduct("wall_added");
	await f.drain();
	expect(f.sent).toEqual([]);
});

test("a choice from another open window counts a mounted editor only with its subsequent activity", async () => {
	const f = fixture();
	f.env.time = (productLaunch + 1) * 1000;
	const editor = f.model(productLaunch, scope, undefined, "ios");
	editor.startProduct();
	editor.recordProduct("wall_added");
	await f.model(productLaunch + 1, scope, undefined, "ios").chooseProduct(true);
	await f.drain();
	expect(f.sent).toEqual([]);
	editor.recordProduct("item_placed");
	await f.drain();
	expect(f.sent).toEqual([productPath("editor_entry"), productPath("item_placed")]);
});

test("an old product consent edition or a failed withdrawal cannot permit later signals", async () => {
	const f = fixture();
	f.env.time = (productLaunch + 20) * 1000;
	const current = f.model(productLaunch, scope, undefined, "ios");
	await current.chooseProduct(true);
	const [key, raw] = [...f.local.entries()][0];
	const previous = JSON.parse(raw);
	f.local.set(key, JSON.stringify({ ...previous, product: { ...previous.product, revision: "2026-11-25" } }));
	current.startProduct();
	current.recordProduct("item_placed");
	await f.drain();
	expect(f.sent).toEqual([]);
	await current.chooseProduct(true);
	await f.drain();
	f.env.failPrimary = true;
	await current.chooseProduct(false);
	f.env.failPrimary = false;
	const next = f.model(productLaunch + 1, scope, undefined, "ios");
	next.startProduct();
	next.recordProduct("save_failed");
	await next.openSettings();
	await f.drain();
	expect(next.snapshot()).toMatchObject({ productGranted: false, aggregateEnabled: true });
	expect(f.sent).toEqual([productPath("editor_entry")]);
});

test("daily consent expires at the switch to two-hour reports while a launch keeps its prior code watermark", async () => {
	const f = fixture();
	f.env.time = (productLaunch + 20) * 1000;
	const current = f.model(productLaunch, scope, undefined, "ios");
	await current.chooseProduct(true);
	const [key, raw] = [...f.local.entries()][0];
	const saved = JSON.parse(raw);
	f.local.set(key, JSON.stringify({ ...saved, product: { ...saved.product, revision: "2026-11-25" } }));
	f.session.set(`${key}:product:launch`, JSON.stringify({ launch: productLaunch, codes: ["editor_entry", "wall_added"] }));
	current.startProduct();
	current.recordProduct("item_placed");
	await f.drain();
	expect(f.sent).toEqual([]);
	await current.openSettings();
	expect(current.snapshot()).toMatchObject({ productAvailable: true, productGranted: false });
	await current.chooseProduct(true);
	expect(JSON.parse(f.local.get(key) ?? "{}")).toMatchObject({ product: { revision: "2026-11-25.2" } });
	current.recordProduct("wall_added");
	current.recordProduct("save_failed");
	await f.drain();
	expect(f.sent).toEqual([productPath("save_failed")]);

	const next = f.model(productLaunch + 1, scope, undefined, "ios");
	next.startProduct();
	next.recordProduct("wall_added");
	await f.drain();
	expect(f.sent).toEqual([productPath("save_failed"), productPath("editor_entry"), productPath("wall_added")]);
});

test("product permission opens on publication and requires a current positive whole-second launch", async () => {
	const f = fixture();
	const publication = Date.parse("2026-11-25T00:00:00+03:00");
	f.env.time = publication - 1;
	const before = f.model(Math.floor(f.env.time / 1000), scope, undefined, "ios");
	await before.openSettings();
	expect(before.snapshot().productAvailable).toBe(false);
	await before.chooseProduct(true);
	before.startProduct();
	await f.drain();
	expect(f.sent).toEqual([]);

	f.env.time = publication;
	const at = publication / 1000;
	for (const launch of [0, -1, at - 0.5, at + 1]) {
		const editor = f.model(launch, scope, undefined, "ios");
		await editor.openSettings();
		expect(editor.snapshot().productAvailable).toBe(false);
		await editor.chooseProduct(true);
		editor.startProduct();
	}
	await f.drain();
	expect(f.sent).toEqual([]);

	const editor = f.model(at, scope, undefined, "ios");
	await editor.chooseProduct(true);
	editor.startProduct();
	await f.drain();
	expect(editor.snapshot().productGranted).toBe(true);
	expect(f.sent).toEqual([productPath("editor_entry")]);
});

test("malformed or future product consent leaves opens and a separate repeat choice intact", async () => {
	const f = fixture();
	f.env.time = productLaunch * 1000;
	const editor = f.model(productLaunch, scope, undefined, "ios");
	await editor.choose(true);
	await editor.chooseProduct(true);
	const [key, raw] = [...f.local.entries()][0];
	const saved = JSON.parse(raw);
	for (const product of [
		null,
		"granted",
		{ ...saved.product, at: now },
		{ ...saved.product, at: f.env.time + 1 },
		{ ...saved.product, generation: `invalid-${saved.product.generation}` },
		{ ...saved.product, generation: `${saved.product.generation}-invalid` },
	]) {
		f.local.set(key, JSON.stringify({ ...saved, product }));
		await editor.openSettings();
		expect(editor.snapshot()).toMatchObject({ aggregateEnabled: true, permission: "granted", productGranted: false, error: false });
		editor.startProduct();
		editor.recordProduct("wall_added");
	}
	await f.drain();
	expect(f.sent).toEqual([]);
});

test("product signals require an intact session watermark and a confirmed write", async () => {
	const f = fixture();
	f.env.time = productLaunch * 1000;
	const editor = f.model(productLaunch, scope, undefined, "ios");
	await editor.chooseProduct(true);
	f.env.ignoreWrite = true;
	editor.startProduct();
	editor.recordProduct("wall_added");
	await f.drain();
	expect(f.sent).toEqual([]);

	f.env.ignoreWrite = false;
	editor.startProduct();
	await f.drain();
	const [key] = [...f.session.keys()];
	for (const corrupt of [
		null,
		42,
		{},
		{ launch: productLaunch, codes: ["editor_entry", "project details"] },
	]) {
		f.session.set(key, JSON.stringify(corrupt));
		editor.recordProduct("wall_added");
		await f.drain();
	}
	expect(f.sent).toEqual([productPath("editor_entry")]);
});

test("two consenting accounts keep independent session watermarks even at the same launch time", async () => {
	const f = fixture();
	f.env.time = productLaunch * 1000;
	for (const area of [scope, other]) {
		const editor = f.model(productLaunch, area, undefined, "ios");
		await editor.chooseProduct(true);
		editor.startProduct();
		editor.recordProduct("wall_added");
		await f.drain();
	}
	expect(f.sent).toEqual([
		productPath("editor_entry"), productPath("wall_added"),
		productPath("editor_entry"), productPath("wall_added"),
	]);
});

test("closing during a product claim suppresses transport and makes later settings calls inert", async () => {
	const f = fixture();
	f.env.time = productLaunch * 1000;
	const abort = new AbortController();
	const editor = f.model(productLaunch, scope, abort, "ios");
	await editor.chooseProduct(true);
	editor.startProduct();
	await f.drain();
	f.env.onSaved = () => abort.abort();
	editor.recordProduct("wall_added");
	await f.drain();
	await editor.chooseProduct(false);

	const reloaded = f.model(productLaunch, scope, undefined, "ios");
	await reloaded.openSettings();
	expect(reloaded.snapshot().productGranted).toBe(true);
	expect(f.sent).toEqual([productPath("editor_entry")]);
});

test("granting again after withdrawal counts later actions once without replay", async () => {
	const f = fixture();
	f.env.time = productLaunch * 1000;
	const editor = f.model(productLaunch, scope, undefined, "ios");
	editor.startProduct();
	await editor.chooseProduct(true);
	editor.recordProduct("wall_added");
	await f.drain();
	editor.recordProduct("item_placed");
	await f.model().chooseProduct(false);
	editor.recordProduct("room_created");
	await editor.chooseProduct(true);
	editor.recordProduct("wall_added");
	editor.recordProduct("item_placed");
	await f.drain();
	expect(f.sent).toEqual([productPath("editor_entry"), productPath("wall_added"), productPath("item_placed")]);
});

test("only iOS and Android select the empty mobile route in place of the daily route", async () => {
	const f = fixture();
	const platforms = [
		"ios", "android", "tdesktop", "web", undefined, "Android", "unknown",
	];
	for (const [index, platform] of platforms.entries())
		await f.model(first + index, scope, undefined, platform).start();
	expect(f.sent).toEqual([mobileOpen, mobileOpen, open, open, open, open, open]);
	await f.model().setAggregate(false);
	await f.model(first + 10, scope, undefined, "ios").start();
	expect(f.sent).toHaveLength(platforms.length);
});
test("only verified editable entry sends one empty open by default, even across remount, concurrent start and replay", async () => {
	const f = fixture();
	const gate = f.model();
	await gate.openSettings();
	await gate.start();
	expect(f.sent).toEqual([]);
	expect(gate.snapshot().aggregateEnabled).toBe(true);
	expect(gate.snapshot().permission).toBe("unknown");
	await Promise.all([f.model(first).start(), f.model(first).start()]);
	await f.model(first - 1).start();
	expect(f.sent).toEqual([open]);
	await f.model(first + 1).start();
	expect(f.sent).toEqual([open, open]);
});
test("pre-entry choices persist, total opt-out also withdraws repeats, re-consent starts a new baseline", async () => {
	const f = fixture();
	await f.model().choose(true);
	await f.model().setAggregate(false);
	await f.model(first).start();
	const next = f.model(first + 1);
	await next.start();
	expect(f.sent).toEqual([]);
	await next.openSettings();
	expect(next.snapshot().aggregateEnabled).toBe(false);
	expect(next.snapshot().permission).toBe("denied");
	await next.setAggregate(true);
	await next.choose(true);
	expect(f.sent).toEqual([]);
	await f.model(first + 1).start();
	expect(f.sent).toEqual([]);
	await f.model(first + 2).start();
	expect(f.sent).toEqual([open, repeat]);
	const panel = f.model(first + 2);
	await panel.choose(false);
	await f.model(first + 3).start();
	expect(f.sent).toEqual([open, repeat, open]);
	await f.model().choose(true);
	await f.model(first + 4).start();
	expect(f.sent).toEqual([open, repeat, open, open]);
	await f.model(first + 5).start();
	expect(f.sent.at(-1)).toBe(repeat);
});
test("first accepted open after a separate pre-entry permission is baseline, second launch on same device/scope counts once", async () => {
	const f = fixture();
	await f.model().choose(true);
	await f.model(first).start();
	await f.model(first).start();
	expect(f.sent).toEqual([open]);
	await Promise.all([f.model(first + 1).start(), f.model(first + 1).start()]);
	await f.model(first + 2, other).start();
	expect(f.sent).toEqual([open, open, repeat, open]);
	const fresh = fixture();
	await fresh.model(first + 2).start();
	expect(fresh.sent).toEqual([open]);
});
test("granting from editor settings sets the current entry as baseline and never sends or backfills events", async () => {
	const f = fixture();
	const m = f.model(first);
	await m.start();
	await m.openSettings();
	await m.choose(true);
	await m.closeSettings();
	expect(f.sent).toEqual([open]);
	await f.model(first).start();
	expect(f.sent).toEqual([open]);
	await f.model(first + 1).start();
	expect(f.sent).toEqual([open, open, repeat]);
});
test("declining all before first entry stays off after a fresh mount and reconfirmation lets future entries count", async () => {
	const f = fixture();
	const before = f.model();
	await before.openSettings();
	await before.setAggregate(false);
	await f.model(first).start();
	await f.model(first + 1).start();
	expect(f.sent).toEqual([]);
	await f.model(first + 1).setAggregate(true);
	await f.model(first + 2).start();
	expect(f.sent).toEqual([open]);
});
test("legacy grant, unreadable local record, failed writes, missing form and aborted admission cannot authorize new transport", async () => {
	const f = fixture();
	f.local.set("interiors_return_permission_v1", "granted-v1");
	await f.model(first).start();
	expect(f.sent).toEqual([open]);
	const saved = [...f.local.keys()].find(
		(x) => x !== "interiors_return_permission_v1",
	);
	expect(saved).toBeDefined();
	f.local.set(String(saved), "garbage");
	await f.model(first + 1).start();
	expect(f.sent).toEqual([open]);
	const faulty = fixture();
	faulty.env.failRead = true;
	await faulty.model(first).start();
	faulty.env.failRead = false;
	faulty.env.failWrite = true;
	await faulty.model(first + 1).start();
	faulty.env.failWrite = false;
	faulty.env.ignoreWrite = true;
	await faulty.model(first + 2).start();
	expect(faulty.sent).toEqual([]);
	const c = fixture();
	c.env.form = false;
	await c.model().choose(true);
	await c.model(first).start();
	await c.model(first + 1).start();
	expect(c.sent).toEqual([open, open]);
	const controller = new AbortController();
	controller.abort();
	await c.model(first + 2, scope, controller).start();
	expect(c.sent).toEqual([open, open]);
});
test("calendar cutoff and early study stop suppress repeats, leave total independent, and cannot establish a grant", async () => {
	for (const when of [cutoff - 1, cutoff, cutoff + 1]) {
		const f = fixture();
		await f.model().choose(true);
		await f.model(first).start();
		f.env.time = when;
		const m = f.model(first + 1);
		await m.start();
		await m.openSettings();
		expect(f.sent).toEqual(when < cutoff ? [open, open, repeat] : [open, open]);
		expect(m.snapshot().studyOpen).toBe(when < cutoff);
	}
	const f = fixture();
	await f.model().choose(true);
	await f.model(first).start();
	f.env.active = false;
	await f.model(first + 1).start();
	expect(f.sent).toEqual([open, open]);
});

test("an older document text never authorizes repeat counting when the current grant text changes", async () => {
	const f = fixture();
	await f.model().choose(true);
	await f.model(first).start();
	f.env.digest = "b".repeat(64);
	const updated = f.model(first + 1);
	await updated.start();
	await updated.openSettings();
	expect(updated.snapshot().permission).toBe("unknown");
	expect(f.sent).toEqual([open, open]);
	await updated.choose(true);
	await f.model(first + 2).start();
	expect(f.sent).toEqual([open, open, open, repeat]);
});

test("a failed primary withdrawal remains journalled after closing and prevents a previously granted repeat when storage recovers", async () => {
	const f = fixture();
	await f.model().choose(true);
	await f.model(first).start();
	f.env.failPrimary = true;
	const panel = f.model(first);
	await panel.choose(false);
	expect(panel.snapshot().error).toBe(true);
	await f.model(first + 1).start();
	expect(f.sent).toEqual([open]);
	f.env.failPrimary = false;
	await f.model(first + 2).start();
	expect(f.sent).toEqual([open, open]);
	const saved = f.model();
	await saved.openSettings();
	expect(saved.snapshot().permission).toBe("denied");
});
test("a failed full opt-out prevents future opens after reload and clears an earlier repeat baseline", async () => {
	const f = fixture();
	await f.model().choose(true);
	await f.model(first).start();
	f.env.failPrimary = true;
	await f.model().setAggregate(false);
	f.env.failPrimary = false;
	await f.model(first + 1).start();
	const saved = f.model();
	await saved.openSettings();
	expect(saved.snapshot().aggregateEnabled).toBe(false);
	expect(saved.snapshot().permission).toBe("denied");
	expect(f.sent).toEqual([open]);
});

test("the precise start of the edition gates repeat choice independently of the daily count", async () => {
	const at = Date.parse("2026-11-21T21:00:00Z");
	for (const delta of [-1, 0, 1]) {
		const f = fixture();
		f.env.time = at + delta;
		const gate = f.model();
		await gate.openSettings();
		expect(gate.snapshot().studyOpen).toBe(delta >= 0);
		await gate.choose(true);
		await gate.openSettings();
		expect(gate.snapshot().studyOpen).toBe(delta >= 0);
		expect(gate.snapshot().permission).toBe(delta >= 0 ? "granted" : "denied");
	}
});
test("an abandoned or malformed opening never becomes a deferred event on retry", async () => {
	const f = fixture();
	for (const time of [undefined, NaN, 0, -1, first + 0.2])
		await f.model(time).start();
	expect(f.sent).toEqual([]);
	expect(f.env.reads).toBe(0);
	const same = f.model(first);
	f.env.failWrite = true;
	await same.start();
	f.env.failWrite = false;
	await same.start();
	expect(f.sent).toEqual([]);
});
test("cancellation or full opt-out between committing the watermark and submitting the request suppresses delivery", async () => {
	for (const reason of ["abort", "stop"]) {
		const f = fixture(),
			cancel = new AbortController();
		const gate = f.model();
		let stop: Promise<void> | undefined;
		f.env.onSaved = () => {
			f.env.onSaved = undefined;
			if (reason === "abort") cancel.abort();
			else stop = gate.setAggregate(false);
		};
		await f.model(first, scope, cancel).start();
		await stop;
		expect(f.sent).toEqual([]);
	}
});
test("changing either setting during the open request suppresses a pending repeat", async () => {
	for (const all of [true, false]) {
		const f = fixture();
		const gate = f.model();
		await gate.choose(true);
		await f.model(first).start();
		let saving: Promise<void> | undefined;
		f.env.onSent = () => {
			f.env.onSent = undefined;
			saving = all ? gate.setAggregate(false) : gate.choose(false);
		};
		await f.model(first + 1).start();
		await saving;
		expect(f.sent).toEqual([open, open]);
	}
});
