import type { TelegramAnalyticsTransport } from "./telegram-analytics";
import {
	type AnalyticsDocument,
	channelMessage,
	readChannelMessage,
} from "./telegram-analytics-channel";

export function openAnalyticsFrame(
	win: Window,
	config: AnalyticsDocument,
	signal: AbortSignal,
	permitted: () => boolean,
): Promise<TelegramAnalyticsTransport> {
	return new Promise((resolve, reject) => {
		if (signal.aborted || !permitted()) {
			reject(Error("Analytics consent unavailable"));
			return;
		}
		const origin = new URL(config.documentURL).origin;
		const token = win.crypto.randomUUID();
		const frame = win.document.createElement("iframe");
		frame.hidden = true;
		frame.referrerPolicy = "no-referrer";
		frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
		frame.src = config.documentURL;
		let phase:
			| "loading"
			| "connecting"
			| "activating"
			| "online"
			| "sending"
			| "sent"
			| "closed" = "loading";
		let acknowledge: ((sent: boolean) => void) | undefined;
		let timer = setTimeout(close, 10_000);
		function close() {
			if (phase === "closed") return;
			phase = "closed";
			clearTimeout(timer);
			signal.removeEventListener("abort", close);
			win.removeEventListener("message", receive);
			frame.removeEventListener("load", connect);
			frame.removeEventListener("error", close);
			frame.remove();
			acknowledge?.(false);
			reject(Error("Analytics document unavailable"));
		}
		function post(type: "connect" | "activate" | "launch") {
			try {
				if (permitted() && frame.contentWindow) {
					frame.contentWindow.postMessage(
						channelMessage(type, token, config.counterId),
						origin,
					);
					return;
				}
			} catch {
				/* Consent or document access is no longer available. */
			}
			close();
		}
		function connect() {
			if (phase !== "loading") {
				close();
				return;
			}
			phase = "connecting";
			post("connect");
		}
		function receive(event: MessageEvent) {
			if (event.origin !== origin || event.source !== frame.contentWindow)
				return;
			const message = readChannelMessage(event.data, config.counterId);
			if (message?.token !== token) return;
			if (!permitted() || message.type === "failed") {
				close();
				return;
			}
			if (phase === "connecting" && message.type === "ready") {
				phase = "activating";
				post("activate");
			} else if (phase === "activating" && message.type === "online") {
				phase = "online";
				clearTimeout(timer);
				resolve({
					send(event) {
						if (event.name !== "tma_open" || phase !== "online") return false;
						phase = "sending";
						return new Promise<boolean>((done) => {
							acknowledge = done;
							timer = setTimeout(close, 10_000);
							post("launch");
						});
					},
					close,
				});
			} else if (phase === "sending" && message.type === "accepted") {
				phase = "sent";
				clearTimeout(timer);
				acknowledge?.(true);
				acknowledge = undefined;
			}
		}
		frame.addEventListener("load", connect);
		frame.addEventListener("error", close);
		signal.addEventListener("abort", close, { once: true });
		win.addEventListener("message", receive);
		win.document.body.appendChild(frame);
	});
}
