import { expect, test } from "@rstest/core";
import {
	createUsageMetrics,
	deviceStatisticsStore,
} from "./telegram-usage-metrics";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";

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
			lock,
			send(path) {
				sent.push(path);
				env.onSent?.();
			},
		});
	return { local, session, model, sent, env };
}
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
