import type { CancellationSignalPort } from "../../application/ports";

export interface CancellationPollingPort {
	watch(check: () => void): () => void;
}

const polling: CancellationPollingPort = {
	watch(check) {
		const timer = globalThis.setInterval(check, 4);
		return () => globalThis.clearInterval(timer);
	},
};

/** Preserves native abort events, including inside an asynchronous ZIP iterator. */
export async function withNativeCancellation<T>(
	source: CancellationSignalPort | undefined,
	operation: (signal: AbortSignal | undefined) => Promise<T>,
	observer: CancellationPollingPort = polling,
): Promise<
	| { readonly kind: "completed"; readonly value: T }
	| { readonly kind: "cancelled" }
> {
	if (source?.aborted) return { kind: "cancelled" };
	const native =
		source !== undefined &&
		typeof AbortSignal !== "undefined" &&
		source instanceof AbortSignal;
	const owned =
		source !== undefined && !native ? new AbortController() : undefined;
	const synchronize = () => {
		if (source?.aborted) owned?.abort();
	};
	const stop = owned ? observer.watch(synchronize) : undefined;
	try {
		if (source?.aborted) return { kind: "cancelled" };
		const value = await operation(native ? source : owned?.signal);
		synchronize();
		return source?.aborted
			? { kind: "cancelled" }
			: { kind: "completed", value };
	} catch (error) {
		if (source?.aborted) return { kind: "cancelled" };
		throw error;
	} finally {
		stop?.();
	}
}
