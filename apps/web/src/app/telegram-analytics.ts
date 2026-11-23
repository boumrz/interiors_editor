import { generationPattern } from "./telegram-analytics-channel";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";

const ratings = [1, 2, 3, 4, 5] as const;
export type TelegramAnalyticsEvent =
	| { readonly name: "tma_open" }
	| {
			readonly name: "feedback_rating";
			readonly completed: boolean;
			readonly rating: (typeof ratings)[number];
	  };

export type TelegramAnalyticsTransport = {
	readonly send: (event: TelegramAnalyticsEvent) => boolean | Promise<boolean>;
	readonly close: () => void;
};
export type TelegramAnalyticsTransportFactory = (
	signal: AbortSignal,
	permitted: () => boolean,
) => TelegramAnalyticsTransport | Promise<TelegramAnalyticsTransport>;

type Consent = {
	read(): string | undefined;
	grant(): string;
	revoke(): void;
	subscribe(changed: () => void): () => void;
};

/** Only the editor sees the scope. The document gets a fresh channel token per connection. */
export function scopedAnalyticsConsent(
	win: Window,
	scope: VerifiedTelegramScope,
): Consent {
	const key = `interiors-tma-context-v1:${scope}:analytics-consent-v1`;
	let broadcast: BroadcastChannel | undefined;
	let observed: string | null = null;
	const revoked = new Set<string>();
	return {
		read() {
			observed = win.localStorage.getItem(key);
			return observed &&
				generationPattern.test(observed) &&
				!revoked.has(observed)
				? observed
				: undefined;
		},
		grant() {
			const value = win.crypto.randomUUID();
			win.localStorage.setItem(key, value);
			return value;
		},
		revoke() {
			// Notify live peers even if this browser has become unable to save the withdrawal.
			if (observed) {
				revoked.add(observed);
				try {
					broadcast?.postMessage(observed);
				} catch {
					/* Storage remains authoritative. */
				}
			}
			win.localStorage.removeItem(key);
		},
		subscribe(changed) {
			const storage = (event: StorageEvent) => {
				if (event.key === key || event.key === null) changed();
			};
			try {
				const Channel = (
					win as Window & { BroadcastChannel?: typeof BroadcastChannel }
				).BroadcastChannel;
				if (Channel) {
					broadcast = new Channel(key);
					broadcast.onmessage = ({ data }) => {
						if (typeof data !== "string" || !generationPattern.test(data))
							return;
						revoked.add(data);
						changed();
					};
				}
			} catch {
				/* Storage events still synchronize successful consent changes. */
			}
			win.addEventListener("storage", storage);
			win.addEventListener("pageshow", changed);
			return () => {
				win.removeEventListener("storage", storage);
				win.removeEventListener("pageshow", changed);
				broadcast?.close();
			};
		},
	};
}

type Attempt = {
	readonly controller: AbortController;
	readonly generation: string;
	transport?: TelegramAnalyticsTransport;
};

type Status = "off" | "connecting" | "on" | "unavailable" | "withdrawal-failed";
function closeTransport(transport: TelegramAnalyticsTransport | undefined) {
	try {
		transport?.close();
	} catch {
		/* Optional analytics cannot block editor teardown. */
	}
}

export function createTelegramAnalytics(
	runtimeSignal: AbortSignal,
	openTransport: TelegramAnalyticsTransportFactory,
	consent?: Consent,
	canRate = true,
	claimLaunch?: () => boolean,
) {
	const listeners = new Set<() => void>();
	let status: Status = "off";
	let current: Attempt | undefined;
	let launchSent = false;
	let unsubscribe: (() => void) | undefined;
	let started = false;
	let withdrawalPending = false;
	let localGrant: string | undefined;

	function readGrant() {
		try {
			return consent ? consent.read() : localGrant;
		} catch {
			return undefined;
		}
	}
	function update(next: Status) {
		status = next;
		for (const notify of listeners) notify();
	}
	function stop(next: Status = "off") {
		const attempt = current;
		current = undefined;
		attempt?.controller.abort();
		closeTransport(attempt?.transport);
		update(next);
	}
	function live(attempt: Attempt) {
		return (
			current === attempt &&
			!runtimeSignal.aborted &&
			attempt.generation === readGrant()
		);
	}
	async function send(attempt: Attempt, event: TelegramAnalyticsEvent) {
		if (!live(attempt)) return false;
		try {
			return (await attempt.transport?.send(event)) === true && live(attempt);
		} catch {
			return false;
		}
	}
	async function synchronize() {
		if (runtimeSignal.aborted || withdrawalPending) return;
		const generation = readGrant();
		if (!generation) {
			stop();
			return;
		}
		if (current?.generation === generation) return;
		if (current) stop();
		const attempt: Attempt = { controller: new AbortController(), generation };
		current = attempt;
		update("connecting");
		try {
			const transport = await openTransport(attempt.controller.signal, () =>
				live(attempt),
			);
			if (!live(attempt)) {
				closeTransport(transport);
				if (current === attempt) stop();
				return;
			}
			attempt.transport = transport;
			update("on");
			if (!launchSent && (!claimLaunch || claimLaunch())) {
				launchSent = true;
				const sent = await send(attempt, { name: "tma_open" });
				if (!sent && current === attempt) stop("unavailable");
			}
		} catch {
			if (current === attempt) stop("unavailable");
		}
	}
	function watch() {
		if (started || runtimeSignal.aborted) return;
		started = true;
		unsubscribe = consent?.subscribe(() => void synchronize());
		runtimeSignal.addEventListener(
			"abort",
			() => {
				unsubscribe?.();
				stop();
			},
			{ once: true },
		);
	}
	return {
		canRate,
		hasConsent: () => readGrant() !== undefined,
		snapshot: () => status,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async start() {
			watch();
			await synchronize();
		},
		async enable() {
			if (runtimeSignal.aborted) return;
			try {
				watch();
				if (!readGrant()) {
					if (consent) consent.grant();
					else localGrant = "session";
				}
				await synchronize();
			} catch {
				stop("unavailable");
			}
		},
		withdraw() {
			withdrawalPending = true;
			try {
				if (consent) consent.revoke();
				else localGrant = undefined;
				withdrawalPending = false;
				stop();
			} catch {
				// Keep this launch closed until the user can persist the withdrawal.
				stop("withdrawal-failed");
			}
		},
		async submitRating(completed: boolean, value: number) {
			const rating = ratings.find((item) => item === value);
			if (!canRate || status !== "on" || !current || rating === undefined)
				return false;
			return send(current, { name: "feedback_rating", completed, rating });
		},
	};
}

export type TelegramAnalytics = ReturnType<typeof createTelegramAnalytics>;
