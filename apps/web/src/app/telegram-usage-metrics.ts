import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";

export const statisticsRevision = "2026-11-22.2";
const publishedAt = Date.parse("2026-11-22T00:00:00+03:00");
const endsAt = Date.parse("2027-04-01T00:00:00+03:00");

type Permission = "unknown" | "granted" | "denied";
type Stop = "all" | "repeat";
interface Preferences {
	form: string | null;
	opens: boolean;
	permission: Permission;
	decisionAt: number;
	lastOpen: number;
	baseline: number;
}
function initial(): Preferences {
	return {
		form: null,
		opens: true,
		permission: "unknown",
		decisionAt: 0,
		lastOpen: 0,
		baseline: 0,
	};
}
const integer = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function decode(raw: string | null): Preferences {
	if (raw === null) return initial();
	const v: unknown = JSON.parse(raw);
	if (
		!v ||
		typeof v !== "object" ||
		!("form" in v) ||
		(v.form !== null &&
			(typeof v.form !== "string" || !/^[a-f0-9]{64}$/.test(v.form))) ||
		!("opens" in v) ||
		typeof v.opens !== "boolean" ||
		!("permission" in v) ||
		(v.permission !== "unknown" &&
			v.permission !== "denied" &&
			v.permission !== "granted") ||
		(v.permission === "granted") !== (v.form !== null) ||
		!("lastOpen" in v) ||
		!integer(v.lastOpen) ||
		!("baseline" in v) ||
		!integer(v.baseline) ||
		!("decisionAt" in v) ||
		!integer(v.decisionAt) ||
		(v.permission === "granted" &&
			(!v.opens ||
				v.decisionAt < publishedAt ||
				v.decisionAt >= endsAt ||
				v.baseline > v.lastOpen)) ||
		(v.permission !== "granted" && v.baseline !== 0)
	)
		throw Error("Unreadable statistics choice");
	return {
		form: v.form,
		opens: v.opens,
		permission: v.permission,
		lastOpen: v.lastOpen,
		decisionAt: v.decisionAt,
		baseline: v.baseline,
	};
}

type Local = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** A withdrawal is journalled before any asynchronous work so a closed page can resume it. */
export function deviceStatisticsStore(
	scope: VerifiedTelegramScope,
	local: () => Local,
	session: () => Local,
) {
	const key = `interiors:${scope}:statistics:${statisticsRevision}`;
	const memory = new Set<Stop>();
	const stores = [local, session];
	return {
		key,
		read: () => decode(local().getItem(key)),
		write(value: Preferences) {
			const json = JSON.stringify(value),
				storage = local();
			storage.setItem(key, json);
			if (storage.getItem(key) !== json)
				throw Error("Statistics choice did not persist");
		},
		stop(which: Stop) {
			memory.add(which);
			for (const storage of stores)
				try {
					storage().setItem(`${key}:stop:${which}`, "1");
				} catch {
					/* The other copy may still be writable. */
				}
		},
		pending(which: Stop) {
			return (
				memory.has(which) ||
				stores.some(
					(storage) => storage().getItem(`${key}:stop:${which}`) !== null,
				)
			);
		},
		clear(which: Stop) {
			for (const storage of stores)
				storage().removeItem(`${key}:stop:${which}`);
			memory.delete(which);
		},
	};
}
type Path =
	| "/stats/tma-open-v2"
	| "/stats/tma-mobile-open-v1"
	| "/stats/tma-repeat-v2";
type View = "closed" | "settings";
interface Snapshot {
	view: View;
	aggregateEnabled: boolean;
	permission: Permission;
	studyOpen: boolean;
	busy: boolean;
	error: boolean;
}
export function createUsageMetrics(opts: {
	readonly store: ReturnType<typeof deviceStatisticsStore>;
	readonly launch?: number;
	readonly platform?: unknown;
	readonly signal: AbortSignal;
	readonly clock: () => number;
	readonly readable: () => Promise<boolean>;
	readonly formDigest: string;
	readonly studyActive: () => boolean;
	readonly lock: (work: () => Promise<void>) => Promise<void>;
	readonly send: (path: Path) => void;
}) {
	const listeners = new Set<() => void>();
	const active = () =>
		opts.clock() >= publishedAt && opts.clock() < endsAt && opts.studyActive();
	let state: Snapshot = {
		view: "closed",
		aggregateEnabled: true,
		permission: "unknown",
		studyOpen: active(),
		error: false,
		busy: false,
	};
	let launched = false;
	function update(change: Partial<Snapshot>) {
		if (opts.signal.aborted) return;
		state = { ...state, ...change };
		for (const listener of listeners) listener();
	}
	function deny(p: Preferences, all: boolean) {
		if (all) p.opens = false;
		p.permission = "denied";
		p.form = null;
		p.decisionAt = opts.clock();
		p.baseline = 0;
	}
	function reflect(p: Preferences, readable: boolean) {
		const open = active() && readable;
		update({
			aggregateEnabled: p.opens,
			permission: open ? p.permission : "denied",
			studyOpen: open,
			error: false,
		});
	}
	async function transact(action: (p: Preferences, readable: boolean) => void) {
		if (opts.signal.aborted) return;
		try {
			await opts.lock(async () => {
				if (opts.signal.aborted) return;
				const p = opts.store.read();
				if (p.permission === "granted" && p.form !== opts.formDigest) {
					p.permission = "unknown";
					p.baseline = 0;
					p.decisionAt = 0;
					p.form = null;
				}
				const readable = active() && (await opts.readable().catch(() => false));
				if (opts.signal.aborted) return;
				const all = opts.store.pending("all"),
					repeat = opts.store.pending("repeat");
				if (all || repeat) {
					deny(p, all);
					opts.store.write(p);
					if (all) opts.store.clear("all");
					if (repeat) opts.store.clear("repeat");
				}
				if (p.permission === "granted" && p.decisionAt > opts.clock())
					throw Error("Invalid consent timestamp");
				action(p, readable);
				reflect(p, readable);
			});
		} catch {
			update({
				aggregateEnabled: false,
				permission: "denied",
				error: true,
				studyOpen: false,
			});
		}
	}
	async function edit(action: (p: Preferences, readable: boolean) => void) {
		update({ busy: true });
		await transact(action);
		update({ busy: false });
	}
	return {
		snapshot: () => state,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async start() {
			const at = opts.launch;
			if (launched || at === undefined || !integer(at) || at === 0) return;
			launched = true;
			await transact((p, readable) => {
				if (!p.opens || at <= p.lastOpen) return;
				p.lastOpen = at;
				const authorized = p.permission === "granted" && active() && readable;
				const returning = authorized && p.baseline > 0 && at > p.baseline;
				if (authorized && !p.baseline) p.baseline = at;
				opts.store.write(p);
				if (opts.signal.aborted || opts.store.pending("all")) return;
				opts.send(
					opts.platform === "ios" || opts.platform === "android"
						? "/stats/tma-mobile-open-v1"
						: "/stats/tma-open-v2",
				);
				if (
					returning &&
					!opts.signal.aborted &&
					active() &&
					!opts.store.pending("all") &&
					!opts.store.pending("repeat")
				)
					opts.send("/stats/tma-repeat-v2");
			});
		},
		async openSettings() {
			update({ view: "settings", busy: true });
			await transact(() => {});
			update({ busy: false });
		},
		closeSettings() {
			update({ view: "closed" });
		},
		async setAggregate(enabled: boolean) {
			if (opts.signal.aborted) return;
			if (!enabled) opts.store.stop("all");
			await edit((p) => {
				if (!enabled) deny(p, true);
				else p.opens = true;
				// Turning counting on mid-visit takes effect with the next verified entry.
				if (opts.launch && enabled)
					p.lastOpen = Math.max(opts.launch, p.lastOpen);
				opts.store.write(p);
			});
		},
		async choose(allow: boolean) {
			if (opts.signal.aborted) return;
			if (!allow) opts.store.stop("repeat");
			await edit((p, readable) => {
				if (!allow) deny(p, false);
				else {
					if (!p.opens || !active() || !readable || p.permission === "granted")
						return;
					p.permission = "granted";
					p.form = opts.formDigest;
					p.decisionAt = opts.clock();
					p.baseline = opts.launch ?? 0;
					p.lastOpen = Math.max(p.lastOpen, p.baseline);
				}
				opts.store.write(p);
			});
		},
	};
}
export type UsageMetrics = ReturnType<typeof createUsageMetrics>;
