import {
	type TelegramLaunchConfiguration,
	type TelegramLaunchResult,
	type VerifiedTelegramScope,
	verifyTelegramLaunch,
} from "./signed-launch";

export interface TelegramSdkSource {
	read(): unknown;
	/** Loading is explicit. Teardown removes this attempt's listeners/script. */
	start(onLoad: () => void, onError: () => void): () => void;
}

/** Explicit Telegram entry use only; importing this module never loads the SDK. */
export function createTelegramSdkScriptSource(context: {
	readonly document: Pick<Document, "createElement" | "head">;
	readonly readWebApp: () => unknown;
}): TelegramSdkSource {
	return {
		read: () => context.readWebApp(),
		start(onLoad, onError) {
			const script = context.document.createElement("script");
			// Exact official SDK bytes are pinned by the Telegram-only release producer.
			// https://core.telegram.org/bots/webapps#initializing-mini-apps
			script.src = "/telegram-sdk/telegram-web-app.124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908.js";
			script.async = true;
			script.onload = () => onLoad();
			script.onerror = () => onError();
			context.document.head.appendChild(script);
			let stopped = false;
			return () => {
				if (stopped) return;
				stopped = true;
				script.onload = null;
				script.onerror = null;
				script.remove();
			};
		},
	};
}

export interface TelegramBootstrapTimers {
	schedule(callback: () => void, milliseconds: number): () => void;
}

type LaunchFailure = Extract<
	TelegramLaunchResult,
	{ kind: "rejected" }
>["reason"];
type LaunchCrypto = NonNullable<
	Parameters<typeof verifyTelegramLaunch>[2]["subtle"]
>;

export type TelegramHostBootstrapResult =
	| { readonly kind: "verified"; readonly scope: VerifiedTelegramScope }
	| {
			readonly kind: "unavailable";
			readonly reason: "invalid-launch";
			readonly launchReason: LaunchFailure;
	  }
	| {
			readonly kind: "unavailable";
			readonly reason:
				| "unsupported-host"
				| "sdk-load-failed"
				| "timeout"
				| "cancelled"
				| "disposed"
				| "invalid-timeout";
	  };

export interface TelegramHostBootstrap {
	/** A retry cancels the previous attempt; no late attempt can verify a launch. */
	start(): Promise<TelegramHostBootstrapResult>;
	/** Call only after essential UI is loaded; launch verification is not editor readiness. */
	ready(): boolean;
	/** Reveal a committed recovery shell; this never verifies or admits a runtime. */
	shellReady(): boolean;
	exit(): "requested" | "failed" | "unavailable";
	dispose(): void;
}

type Sdk = {
	readonly initData: string;
	readonly ready: () => void;
	readonly close: () => void;
};

/**
 * Inert S2 launch boundary, never a writable-runtime factory. A verified result
 * still needs shell-bound manifest, storage/fence and client-release guards.
 * SDK objects, launch identity and errors containing raw initData do not escape.
 */
export function createTelegramHostBootstrap(dependencies: {
	readonly configuration: TelegramLaunchConfiguration;
	readonly source: TelegramSdkSource;
	readonly timeoutMs: number;
	readonly nowEpochMs: () => number;
	readonly onExit: () => void;
	readonly subtle?: LaunchCrypto;
	readonly timers?: TelegramBootstrapTimers;
}): TelegramHostBootstrap {
	const configuration = { ...dependencies.configuration };
	const source = dependencies.source;
	const timeoutMs = dependencies.timeoutMs;
	const timers = dependencies.timers ?? {
		schedule: (callback: () => void, milliseconds: number) => {
			const timer = globalThis.setTimeout(callback, milliseconds);
			return () => globalThis.clearTimeout(timer);
		},
	};
	let disposed = false;
	let verifiedSdk: Sdk | undefined;
	let revealShell: (() => void) | undefined;
	let current: { readonly cancel: () => void } | undefined;

	return {
		start() {
			if (disposed)
				return Promise.resolve({ kind: "unavailable", reason: "disposed" });
			current?.cancel();
			verifiedSdk = undefined;
			revealShell = undefined;
			if (
				!Number.isSafeInteger(timeoutMs) ||
				timeoutMs <= 0 ||
				timeoutMs > 2_147_483_647
			)
				return Promise.resolve({
					kind: "unavailable",
					reason: "invalid-timeout",
				});
			return new Promise<TelegramHostBootstrapResult>((resolve) => {
				let settled = false;
				let stopScript: (() => void) | undefined;
				let stopTimer: (() => void) | undefined;
				const finish = (result: TelegramHostBootstrapResult) => {
					if (settled) return;
					settled = true;
					// Settle even if a host-provided teardown throws.
					try {
						stopScript?.();
					} catch {
						/* Admission is already closed. */
					}
					try {
						stopTimer?.();
					} catch {
						/* Admission is already closed. */
					}
					if (current === attempt) current = undefined;
					resolve(result);
				};
				const attempt = {
					cancel: () => finish({ kind: "unavailable", reason: "cancelled" }),
				};
				current = attempt;
				const verify = (raw: unknown) => {
					if (settled) return;
					const sdk = readSdk(raw);
					if (!sdk) {
						finish({ kind: "unavailable", reason: "unsupported-host" });
						return;
					}
					revealShell = sdk.ready;
					void verifyTelegramLaunch(sdk.initData, configuration, {
						nowEpochMs: dependencies.nowEpochMs(),
						subtle: dependencies.subtle,
					})
						.then((launch) => {
							if (settled) return;
							if (launch.kind !== "verified") {
								finish({
									kind: "unavailable",
									reason: "invalid-launch",
									launchReason: launch.reason,
								});
								return;
							}
							verifiedSdk = sdk;
							finish({ kind: "verified", scope: launch.scope });
						})
						.catch(() =>
							finish({
								kind: "unavailable",
								reason: "invalid-launch",
								launchReason: "unsupported-crypto",
							}),
						);
				};
				try {
					stopTimer = timers.schedule(
						() => finish({ kind: "unavailable", reason: "timeout" }),
						timeoutMs,
					);
					const available = source.read();
					if (available !== undefined) verify(available);
					else {
						const stop = source.start(
							() => {
								try {
									verify(source.read());
								} catch {
									finish({ kind: "unavailable", reason: "unsupported-host" });
								}
							},
							() => finish({ kind: "unavailable", reason: "sdk-load-failed" }),
						);
						if (settled) stop();
						else stopScript = stop;
					}
				} catch {
					finish({ kind: "unavailable", reason: "sdk-load-failed" });
				}
			});
		},
		shellReady() {
			if (disposed || current || !revealShell) return false;
			const reveal = revealShell;
			revealShell = undefined;
			try {
				reveal();
				return true;
			} catch {
				return false;
			}
		},
		ready() {
			if (!verifiedSdk || disposed) return false;
			try {
				verifiedSdk.ready();
				return true;
			} catch {
				return false;
			}
		},
		exit() {
			if (disposed) return "unavailable";
			current?.cancel();
			verifiedSdk = undefined;
			revealShell = undefined;
			try {
				const sdk = readSdk(source.read());
				if (sdk) sdk.close();
				else dependencies.onExit();
				return "requested";
			} catch {
				return "failed";
			}
		},
		dispose() {
			disposed = true;
			verifiedSdk = undefined;
			revealShell = undefined;
			current?.cancel();
		},
	};
}

function readSdk(value: unknown): Sdk | undefined {
	try {
		if (!value || typeof value !== "object" || Array.isArray(value))
			return undefined;
		const record = value as Record<string, unknown>;
		const { initData, ready, close } = record;
		if (
			typeof initData !== "string" ||
			typeof ready !== "function" ||
			typeof close !== "function"
		)
			return undefined;
		return {
			initData,
			ready: () => {
				ready.call(value);
			},
			close: () => {
				close.call(value);
			},
		};
	} catch {
		return undefined;
	}
}
