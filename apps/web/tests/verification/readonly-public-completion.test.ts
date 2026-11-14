import { expect, it } from "@rstest/core";
import { observeReadonlyPublicOperation, requireReadonlyNativeCleanup, runReadonlyNativeCleanup, requireReadonlyNativeTransport } from "./readonly-public-completion";
it("distinguishes real completion, refusal and pending without converting pending into refusal", async () => {
 expect(await observeReadonlyPublicOperation(Promise.resolve(7), 5)).toEqual({ kind: "fulfilled", value: 7 });
 expect(await observeReadonlyPublicOperation(Promise.reject(undefined), 5)).toEqual({ kind: "rejected", reason: undefined });
 let release!: (value: number) => void;
 const held = new Promise<number>(resolve => { release = resolve; });
 expect(await observeReadonlyPublicOperation(held, 5)).toEqual({ kind: "pending" });
 release(9);
 expect(await observeReadonlyPublicOperation(held, 5)).toEqual({ kind: "fulfilled", value: 9 });
});

it("page cleanup failure has an infrastructure marker rather than a behavioral assertion", () => {
 expect(() => requireReadonlyNativeCleanup({ kind: "pending" })).toThrow("READONLY_PROOF_INVALID:");
 expect(() => requireReadonlyNativeCleanup({ kind: "rejected", reason: undefined })).toThrow("READONLY_PROOF_INVALID:");
 expect(() => requireReadonlyNativeCleanup({ kind: "fulfilled", value: undefined })).not.toThrow();
});

it("every cleanup IO exception is infrastructure, including an undefined rejection", async () => {
 await expect(runReadonlyNativeCleanup(() => { throw new Error("ENOENT"); })).rejects.toThrow("READONLY_PROOF_INVALID:");
 await expect(runReadonlyNativeCleanup(() => Promise.reject(undefined))).rejects.toThrow("READONLY_PROOF_INVALID:");
});
it("known closed browser transport is infrastructure while application refusal and pending remain public outcomes", () => {
 expect(() => requireReadonlyNativeTransport({ kind: "rejected", reason: new Error("page.evaluate: Target page, context or browser has been closed") })).toThrow("READONLY_PROOF_INVALID:");
 expect(() => requireReadonlyNativeTransport({ kind: "rejected", reason: new Error("Source verification refused") })).not.toThrow();
 expect(() => requireReadonlyNativeTransport({ kind: "pending" })).not.toThrow();
});
