const schedule = globalThis.setTimeout;
const cancel = globalThis.clearTimeout;
export type ReadonlyPublicCompletion<T> =
 | { readonly kind: "fulfilled"; readonly value: T }
 | { readonly kind: "rejected"; readonly reason: unknown }
 | { readonly kind: "pending" };
/** Verification-only observation, without cancelling or changing the application operation. */
export async function observeReadonlyPublicOperation<T>(operation: Promise<T>, maximumWaitMs = 2000): Promise<ReadonlyPublicCompletion<T>> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 const settled: Promise<ReadonlyPublicCompletion<T>> = operation.then(value => ({ kind: "fulfilled", value }), reason => ({ kind: "rejected", reason }));
 const pending = new Promise<ReadonlyPublicCompletion<T>>(resolve => { timer = schedule(() => resolve({ kind: "pending" }), maximumWaitMs); });
 return Promise.race([settled, pending]).finally(() => { if (timer !== undefined) cancel(timer); });
}

/** Cleanup is infrastructure evidence; it must never become a public behavior assertion. */
export function requireReadonlyNativeCleanup(completion: ReadonlyPublicCompletion<unknown>): void {
 if (completion.kind !== "fulfilled") throw new Error("READONLY_PROOF_INVALID: native page cleanup did not fulfill");
}

export async function runReadonlyNativeCleanup(action: () => void | Promise<void>): Promise<void> {
 try { await action(); }
 catch (cause) { throw new Error("READONLY_PROOF_INVALID: native cleanup IO failed", { cause }); }
}
export function requireReadonlyNativeTransport(completion: ReadonlyPublicCompletion<unknown>): void {
 if (completion.kind !== "rejected") return;
 const reason = completion.reason;
 const message = typeof reason === "object" && reason !== null && "message" in reason && typeof reason.message === "string" ? reason.message : "";
 if (/^(?:page\.evaluate: )?Target (?:page, context or browser|page|context|browser) has been closed(?:\n|$)/.test(message)) throw new Error("READONLY_PROOF_INVALID: closed browser transport", { cause: reason });
}
