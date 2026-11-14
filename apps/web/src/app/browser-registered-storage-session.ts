/** Anonymous browser-owned generation; no file or Telegram identity can select it. */
export class BrowserRegisteredStorageSession {
	public readonly scope = "browser-registered-v1" as const;
	private active = true;
	private tail: Promise<void> = Promise.resolve();
	private readonly cancellation = new AbortController();
	public get signal(): AbortSignal {
		return this.cancellation.signal;
	}
	public run<T>(operation: () => Promise<T>): Promise<T> {
		if (!this.active) return Promise.reject(closed());
		const result = this.tail.then(() => {
			if (!this.active) throw closed();
			return operation();
		});
		this.tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}
	/** Revoke synchronously, then drain the complete native outcome before teardown. */
	public revoke(): Promise<void> {
		this.active = false;
		this.cancellation.abort();
		return this.tail;
	}
}
function closed(): Error & { readonly kind: "unavailable" } {
	return Object.assign(new Error("Browser storage generation is closed"), {
		kind: "unavailable" as const,
	});
}
