import {
	channelMessage,
	exactRecord,
	readChannelMessage,
	safeAnalyticsURL,
	isCounterId,
} from "./telegram-analytics-channel";

type Metrica = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
type AnalyticsWindow = Window & {
	ym?: Metrica;
	[key: `yaCounter${number}`]: { destruct?(): void } | undefined;
};

export function installAnalyticsDocument(
	window: Window,
	configuration: unknown,
) {
	if (!exactRecord(configuration, ["editorOrigin", "counterId"])) return;
	const { editorOrigin, counterId } = configuration;
	if (
		typeof editorOrigin !== "string" ||
		safeAnalyticsURL(`${editorOrigin}/`)?.origin !== editorOrigin ||
		!isCounterId(counterId)
	)
		return;
	const win = window as AnalyticsWindow;
	if (
		win.parent === win ||
		win.location.origin === editorOrigin ||
		win.document.referrer ||
		win.location.search ||
		win.location.hash
	)
		return;
	const parent = win.parent;
	const counterKey = `yaCounter${counterId}` as const;
	const initialized = `yacounter${counterId}inited`;
	let token: string | undefined;
	let phase:
		| "waiting"
		| "connected"
		| "loading"
		| "online"
		| "sent"
		| "closed" = "waiting";
	let script: HTMLScriptElement | undefined;
	const post = (type: "ready" | "online" | "failed" | "accepted") => {
		if (token)
			parent.postMessage(channelMessage(type, token, counterId), editorOrigin);
	};
	const onReady = () => {
		if (phase !== "loading") return;
		phase = "online";
		post("online");
	};
	function stop() {
		phase = "closed";
		win.removeEventListener("message", receive);
		win.removeEventListener("pagehide", stop);
		win.document.removeEventListener(initialized, onReady);
		if (script) {
			script.onload = null;
			script.onerror = null;
			script.remove();
			try {
				win[counterKey]?.destruct?.();
			} catch {
				/* Teardown still clears pending provider retries. */
			}
			try {
				win.localStorage.removeItem("_ym_retryReqs");
			} catch {
				/* Storage was disabled. */
			}
		}
	}
	function failed() {
		post("failed");
		stop();
	}
	function activate() {
		phase = "loading";
		// The dedicated origin must never replay an SDK retry from a former grant.
		win.localStorage.removeItem("_ym_retryReqs");
		const queued: Metrica = (...args) => {
			queued.a ??= [];
			queued.a.push(args);
		};
		queued.l = Date.now();
		win.ym = queued;
		win.document.addEventListener(initialized, onReady, { once: true });
		script = win.document.createElement("script");
		script.async = true;
		script.referrerPolicy = "no-referrer";
		script.src = "https://mc.yandex.ru/metrika/tag.js";
		script.onerror = failed;
		script.onload = () => {
			if (phase !== "loading") return;
			try {
				win.ym?.(counterId, "init", {
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
				});
			} catch {
				failed();
			}
		};
		win.document.head.appendChild(script);
	}
	function receive(event: MessageEvent) {
		if (event.origin !== editorOrigin || event.source !== parent) return;
		const message = readChannelMessage(event.data, counterId as number);
		if (!message) return;
		if (phase === "waiting" && message.type === "connect") {
			token = message.token;
			phase = "connected";
			post("ready");
			return;
		}
		if (token !== message.token) return;
		try {
			if (phase === "connected" && message.type === "activate") activate();
			if (phase === "online" && message.type === "launch") {
				phase = "sent";
				if (!win.ym) {
					failed();
					return;
				}
				win.ym(counterId, "hit", "https://domiknote.ru/tma", {
					referer: "",
					title: "",
				});
				win.ym(counterId, "reachGoal", "tma_open");
				post("accepted");
			}
		} catch {
			failed();
		}
	}
	win.addEventListener("message", receive);
	win.addEventListener("pagehide", stop, { once: true });
}
