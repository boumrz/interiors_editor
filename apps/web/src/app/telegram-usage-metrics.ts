import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import { isProductMetric, type ProductMetric } from "../application/editor-product-metrics";
import { productStatisticsRevision } from "./product-statistics-revision";

export const statisticsRevision = "2026-11-22.2";
const publishedAt = Date.parse("2026-11-22T00:00:00+03:00");
const endsAt = Date.parse("2027-04-01T00:00:00+03:00");
const productPublishedAt = Date.parse("2026-11-25T00:00:00+03:00");

type Permission = "unknown" | "granted" | "denied";
type Stop = "all" | "repeat" | "product";
interface ProductGrant {
	revision: string;
	at: number;
	generation: string;
}
interface Preferences {
	form: string | null;
	opens: boolean;
	permission: Permission;
	decisionAt: number;
	lastOpen: number;
	baseline: number;
	product?: ProductGrant;
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
function decodeProduct(value: unknown): ProductGrant | undefined {
	if (
		value && typeof value === "object" &&
		"revision" in value && value.revision === productStatisticsRevision &&
		"at" in value && integer(value.at) && value.at >= productPublishedAt &&
		"generation" in value && typeof value.generation === "string" &&
		/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/.test(value.generation)
	) return { revision: value.revision, at: value.at, generation: value.generation };
}
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
	const product = v.opens && "product" in v ? decodeProduct(v.product) : undefined;
	return {
		form: v.form,
		opens: v.opens,
		permission: v.permission,
		lastOpen: v.lastOpen,
		decisionAt: v.decisionAt,
		baseline: v.baseline,
		...(product ? { product } : {}),
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
	const productLaunchKey = `${key}:product:launch`;
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
		claimProduct(launch: number, code: ProductMetric) {
			const storage = session();
			const raw = storage.getItem(productLaunchKey);
			let codes: ProductMetric[] = [];
			if (raw !== null) {
				const prior: unknown = JSON.parse(raw);
				if (
					!prior || typeof prior !== "object" ||
					!("launch" in prior) || !integer(prior.launch) || prior.launch > launch ||
					!("codes" in prior) || !Array.isArray(prior.codes) || !prior.codes.every(isProductMetric)
				) return false;
				if (prior.launch === launch) codes = prior.codes;
			}
			if (codes.includes(code)) return false;
			const next = JSON.stringify({ launch, codes: [...codes, code] });
			storage.setItem(productLaunchKey, next);
			return storage.getItem(productLaunchKey) === next;
		},
	};
}
type Path =
	| "/stats/tma-open-v2"
	| "/stats/tma-mobile-open-v1"
	| "/stats/tma-repeat-v2"
	| `/stats/tma-editor-v1/${"ios" | "android"}/${ProductMetric}`;
type View = "closed" | "settings";
interface Snapshot {
	view: View;
	aggregateEnabled: boolean;
	permission: Permission;
	studyOpen: boolean;
	productAvailable: boolean;
	productGranted: boolean;
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
	readonly product?: { readonly readable: () => boolean };
	readonly studyActive: () => boolean;
	readonly lock: (work: () => Promise<void>) => Promise<void>;
	readonly send: (path: Path) => void;
}) {
	const listeners = new Set<() => void>();
	const active = () =>
		opts.clock() >= publishedAt && opts.clock() < endsAt && opts.studyActive();
	const platform = opts.platform === "ios" || opts.platform === "android" ? opts.platform : undefined;
	const productLaunch = platform && integer(opts.launch) && opts.launch > 0
		? opts.launch
		: undefined;
	function productAvailable() {
		try {
			const now = opts.clock();
			return !!opts.product && productLaunch !== undefined && now >= productPublishedAt &&
				productLaunch <= now / 1000 && opts.product.readable();
		} catch {
			return false;
		}
	}
	function currentGrant(p: Preferences) {
		return p.opens && p.product && p.product.at <= opts.clock() ? p.product.generation : undefined;
	}
	let state: Snapshot = {
		view: "closed",
		aggregateEnabled: true,
		permission: "unknown",
		studyOpen: active(),
		productAvailable: false,
		productGranted: false,
		error: false,
		busy: false,
	};
	let launched = false;
	let productStarted = false;
	function update(change: Partial<Snapshot>) {
		if (opts.signal.aborted) return;
		state = { ...state, ...change };
		for (const listener of listeners) listener();
	}
	function deny(p: Preferences, all: boolean) {
		if (all) {
			p.opens = false;
			delete p.product;
		}
		p.permission = "denied";
		p.form = null;
		p.decisionAt = opts.clock();
		p.baseline = 0;
	}
	function reflect(p: Preferences, readable: boolean) {
		const open = active() && readable;
		const productOpen = productAvailable();
		update({
			aggregateEnabled: p.opens,
			permission: open ? p.permission : "denied",
			studyOpen: open,
			productAvailable: productOpen,
			productGranted: productOpen && currentGrant(p) !== undefined,
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
					repeat = opts.store.pending("repeat"),
					product = opts.store.pending("product");
				if (all || repeat || product) {
					if (all || repeat) deny(p, all);
					if (product) delete p.product;
					opts.store.write(p);
					if (all) opts.store.clear("all");
					if (repeat) opts.store.clear("repeat");
					if (product) opts.store.clear("product");
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
				productAvailable: false,
				productGranted: false,
			});
		}
	}
	async function edit(action: (p: Preferences, readable: boolean) => void) {
		update({ busy: true });
		await transact(action);
		update({ busy: false });
	}
	function productGrant() {
		try {
			if (!productStarted || opts.signal.aborted || !productAvailable() ||
				opts.store.pending("all") || opts.store.pending("product")) return;
			return currentGrant(opts.store.read());
		} catch {
			return;
		}
	}
	function recordProduct(metric: ProductMetric) {
		if (!isProductMetric(metric) || productLaunch === undefined || !platform) return;
		const grant = productGrant();
		if (!grant) return;
		void opts.lock(async () => {
			const signals: ProductMetric[] = metric === "editor_entry" ? [metric] : ["editor_entry", metric];
			for (const signal of signals) {
				if (productGrant() !== grant) return;
				if (opts.store.claimProduct(productLaunch, signal) && productGrant() === grant) {
					opts.send(`/stats/tma-editor-v1/${platform}/${signal}`);
				}
			}
		}).catch(() => { /* Unavailable session storage or transport drops this signal. */ });
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
		startProduct() {
			productStarted = true;
			recordProduct("editor_entry");
		},
		recordProduct,
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
		async chooseProduct(allow: boolean) {
			if (opts.signal.aborted) return;
			if (!allow) opts.store.stop("product");
			await edit((p) => {
				if (!allow || !p.opens || !productAvailable() || currentGrant(p)) return;
				p.product = {
					revision: productStatisticsRevision,
					at: opts.clock(),
					generation: globalThis.crypto.randomUUID(),
				};
				opts.store.write(p);
			});
			if (allow) recordProduct("editor_entry");
		},
	};
}
export type UsageMetrics = ReturnType<typeof createUsageMetrics>;
