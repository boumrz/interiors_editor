import { test as base, expect } from "@playwright/test";
import { observeReadonlyPublicOperation, requireReadonlyNativeCleanup, runReadonlyNativeCleanup, requireReadonlyNativeTransport } from "./readonly-public-completion";
const processValue = Reflect.get(globalThis, "process");
async function ownedFiles() { const name = "node:fs"; return import(name); }
const root = processValue.env.TMA_READONLY_INVOCATION;
if (!root) throw new Error("READONLY_PROOF_INVALID: owned invocation required");
const owner = `${processValue.pid}:${processValue.env.TEST_WORKER_INDEX ?? "unknown"}`;
let owns = false;
export const test = base.extend({ page: async ({ page }, use) => {
 const evaluate = page.evaluate;
 page.evaluate = new Proxy(evaluate, { async apply(target, receiver, argumentsList) {
  let result = await observeReadonlyPublicOperation(Reflect.apply(target, receiver, argumentsList));
  if (processValue.env.TMA_READONLY_TRANSPORT_CONTROL === "1") result = { kind: "rejected", reason: new Error("page.evaluate: Target page, context or browser has been closed") };
  requireReadonlyNativeTransport(result);
  expect(result.kind).toBe("fulfilled");
  if (result.kind !== "fulfilled") throw new Error("Native public operation did not fulfill");
  return result.value;
 } });
 try { await use(page); }
 finally { await runReadonlyNativeCleanup(async () => {
  page.evaluate = evaluate;
  const closed = await observeReadonlyPublicOperation(page.close({ runBeforeUnload: false }));
  requireReadonlyNativeCleanup(closed);
  if (processValue.env.TMA_READONLY_CLEANUP_CONTROL === "1") throw new Error("READONLY_PROOF_INVALID: controlled native page cleanup failure");
 }); }
} });
test.beforeAll(async () => {
 const { appendFileSync, writeFileSync } = await ownedFiles();
 try { writeFileSync(`${root}/native-worker.owner`, owner, { flag: "wx" }); owns = true; appendFileSync(`${root}/native-workers.jsonl`, `${JSON.stringify({ kind: "begin", owner })}\n`); }
 catch (error) { throw new Error("READONLY_PROOF_INVALID: native worker ownership", { cause: error }); }
});
test.afterAll(async () => { await runReadonlyNativeCleanup(async () => {
 const { appendFileSync, readFileSync, unlinkSync } = await ownedFiles();
 if (!owns) return;
 if (readFileSync(`${root}/native-worker.owner`, "utf8") !== owner) throw new Error("READONLY_PROOF_INVALID: foreign native cleanup");
 if (processValue.env.TMA_READONLY_WORKER_CLEANUP_CONTROL === "1") throw new Error("Controlled worker cleanup IO failure");
 unlinkSync(`${root}/native-worker.owner`); appendFileSync(`${root}/native-workers.jsonl`, `${JSON.stringify({ kind: "end", owner })}\n`); owns = false;
}); });
export { expect };
