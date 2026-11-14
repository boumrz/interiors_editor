# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-readonly-source-e2e.check.ts >> TMA-READONLY-19: a genuine native open queued behind blocked deletion times out and its late v0 event still aborts without reprovision
- Location: tests/browser/telegram-readonly-source-e2e.check.ts:425:1

# Error details

```
Error: READONLY_PROOF_INVALID: native cleanup IO failed
```

# Test source

```ts
  1  | const schedule = globalThis.setTimeout;
  2  | const cancel = globalThis.clearTimeout;
  3  | export type ReadonlyPublicCompletion<T> =
  4  |  | { readonly kind: "fulfilled"; readonly value: T }
  5  |  | { readonly kind: "rejected"; readonly reason: unknown }
  6  |  | { readonly kind: "pending" };
  7  | /** Verification-only observation, without cancelling or changing the application operation. */
  8  | export async function observeReadonlyPublicOperation<T>(operation: Promise<T>, maximumWaitMs = 2000): Promise<ReadonlyPublicCompletion<T>> {
  9  |  let timer: ReturnType<typeof setTimeout> | undefined;
  10 |  const settled: Promise<ReadonlyPublicCompletion<T>> = operation.then(value => ({ kind: "fulfilled", value }), reason => ({ kind: "rejected", reason }));
  11 |  const pending = new Promise<ReadonlyPublicCompletion<T>>(resolve => { timer = schedule(() => resolve({ kind: "pending" }), maximumWaitMs); });
  12 |  return Promise.race([settled, pending]).finally(() => { if (timer !== undefined) cancel(timer); });
  13 | }
  14 | 
  15 | /** Cleanup is infrastructure evidence; it must never become a public behavior assertion. */
  16 | export function requireReadonlyNativeCleanup(completion: ReadonlyPublicCompletion<unknown>): void {
  17 |  if (completion.kind !== "fulfilled") throw new Error("READONLY_PROOF_INVALID: native page cleanup did not fulfill");
  18 | }
  19 | 
  20 | export async function runReadonlyNativeCleanup(action: () => void | Promise<void>): Promise<void> {
  21 |  try { await action(); }
> 22 |  catch (cause) { throw new Error("READONLY_PROOF_INVALID: native cleanup IO failed", { cause }); }
     |                        ^ Error: READONLY_PROOF_INVALID: native cleanup IO failed
  23 | }
  24 | export function requireReadonlyNativeTransport(completion: ReadonlyPublicCompletion<unknown>): void {
  25 |  if (completion.kind !== "rejected") return;
  26 |  const reason = completion.reason;
  27 |  const message = typeof reason === "object" && reason !== null && "message" in reason && typeof reason.message === "string" ? reason.message : "";
  28 |  if (/^(?:page\.evaluate: )?Target (?:page, context or browser|page|context|browser) has been closed(?:\n|$)/.test(message)) throw new Error("READONLY_PROOF_INVALID: closed browser transport", { cause: reason });
  29 | }
  30 | 
```