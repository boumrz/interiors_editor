import { expect } from "@rstest/core";
import { observeReadonlyPublicOperation } from "./readonly-public-completion";
export async function completeReadonlyUnitOperation<T>(operation: Promise<T>): Promise<T> {
 const result = await observeReadonlyPublicOperation(operation);
 expect(result.kind).toBe("fulfilled");
 if (result.kind !== "fulfilled") throw new Error("Public operation did not fulfill");
 return result.value;
}
export async function refuseReadonlyUnitOperation(operation: Promise<unknown>): Promise<unknown> {
 const result = await observeReadonlyPublicOperation(operation);
 expect(result.kind).toBe("rejected");
 if (result.kind !== "rejected") throw new Error("Public operation did not reject");
 return result.reason;
}
