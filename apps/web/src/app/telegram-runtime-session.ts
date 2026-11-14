import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";

/**
 * One verified bootstrap owns one queue and one cancellation generation.
 * Operations must cover the complete publication/reconciliation, with private
 * inner adapters; recursively acquiring this queue would deadlock. Slow work
 * outside the queue must request admission again before touching local state.
 */
export class TelegramRuntimeSession {
	private active = true;
	private tail: Promise<void> = Promise.resolve();
	private readonly cancellation = new AbortController();

	public constructor(public readonly scope: VerifiedTelegramScope) {}

	public get signal(): AbortSignal {
		return this.cancellation.signal;
	}

	public run<T>(operation: () => Promise<T>): Promise<T> {
		if (!this.active)
			return Promise.reject(new Error("Telegram session is closed"));
		const result = this.tail.then(async () => {
			if (!this.active) throw new Error("Telegram session is closed");
			return operation();
		});
		// A failed transaction must neither poison the queue nor prevent draining.
		this.tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	/** Revoke synchronously; await the drain before closing handles/opening another runtime. */
	public revoke(): Promise<void> {
		this.active = false;
		this.cancellation.abort();
		return this.tail;
	}
}
