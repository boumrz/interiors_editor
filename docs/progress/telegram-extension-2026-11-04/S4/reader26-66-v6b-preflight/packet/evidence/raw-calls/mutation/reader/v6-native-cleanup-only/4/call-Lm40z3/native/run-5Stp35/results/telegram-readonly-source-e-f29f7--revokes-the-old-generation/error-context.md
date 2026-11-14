# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-readonly-source-e2e.check.ts >> TMA-READONLY-METADATA: native identity-extra refuses access, retains every field and permanently revokes the old generation
- Location: tests/browser/telegram-readonly-source-e2e.check.ts:6:2

# Error details

```
Error: READONLY_PROOF_INVALID: controlled native page cleanup failure
```

# Test source

```ts
  1  | import { test as base, expect } from "@playwright/test";
  2  | import { observeReadonlyPublicOperation, requireReadonlyNativeCleanup } from "./readonly-public-completion";
  3  | const processValue = Reflect.get(globalThis, "process");
  4  | async function ownedFiles() { const name = "node:fs"; return import(name); }
  5  | const root = processValue.env.TMA_READONLY_INVOCATION;
  6  | if (!root) throw new Error("READONLY_PROOF_INVALID: owned invocation required");
  7  | const owner = `${processValue.pid}:${processValue.env.TEST_WORKER_INDEX ?? "unknown"}`;
  8  | let owns = false;
  9  | export const test = base.extend({ page: async ({ page }, use) => {
  10 |  const evaluate = page.evaluate;
  11 |  page.evaluate = new Proxy(evaluate, { async apply(target, receiver, argumentsList) {
  12 |   const result = await observeReadonlyPublicOperation(Reflect.apply(target, receiver, argumentsList));
  13 |   expect(result.kind).toBe("fulfilled");
  14 |   if (result.kind !== "fulfilled") throw new Error("Native public operation did not fulfill");
  15 |   return result.value;
  16 |  } });
  17 |  try { await use(page); }
  18 |  finally {
  19 |   page.evaluate = evaluate;
  20 |   const closed = await observeReadonlyPublicOperation(page.close({ runBeforeUnload: false }));
  21 |   requireReadonlyNativeCleanup(closed);
> 22 |   if (processValue.env.TMA_READONLY_CLEANUP_CONTROL === "1") throw new Error("READONLY_PROOF_INVALID: controlled native page cleanup failure");
     |                                                                    ^ Error: READONLY_PROOF_INVALID: controlled native page cleanup failure
  23 |  }
  24 | } });
  25 | test.beforeAll(async () => {
  26 |  const { appendFileSync, writeFileSync } = await ownedFiles();
  27 |  try { writeFileSync(`${root}/native-worker.owner`, owner, { flag: "wx" }); owns = true; appendFileSync(`${root}/native-workers.jsonl`, `${JSON.stringify({ kind: "begin", owner })}\n`); }
  28 |  catch (error) { throw new Error("READONLY_PROOF_INVALID: native worker ownership", { cause: error }); }
  29 | });
  30 | test.afterAll(async () => {
  31 |  const { appendFileSync, readFileSync, unlinkSync } = await ownedFiles();
  32 |  if (!owns) return;
  33 |  if (readFileSync(`${root}/native-worker.owner`, "utf8") !== owner) throw new Error("READONLY_PROOF_INVALID: foreign native cleanup");
  34 |  unlinkSync(`${root}/native-worker.owner`); appendFileSync(`${root}/native-workers.jsonl`, `${JSON.stringify({ kind: "end", owner })}\n`); owns = false;
  35 | });
  36 | export { expect };
  37 | 
```