import { completeReadonlyUnitOperation, refuseReadonlyUnitOperation } from "../../../tests/verification/readonly-public-unit-completion";
import { describe, expect, it } from "@rstest/core";
import { verifiedReadonlyTestScope } from "../../../tests/fixtures/telegram-readonly-signed-launch";
import { approveReadableTelegramRelease } from "../../app/telegram-readable-release";
import { createRegisteredRuntimePortablePorts } from "../portable-backup/registered-runtime-portable";
import { createTelegramReadonlyProjectSource } from "./telegram-readonly-project-source";

const binaryChecksum = {
 async sha256Bytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
 }
};
const checksum = { sha256: (text: string) => binaryChecksum.sha256Bytes(new TextEncoder().encode(text)) };

function approval() {
 const manifest = { appBuildId: "0123456789abcdef", assetSchemas: { readable: [1], writable: [1] }, catalogSchemas: { readable: [1], writable: [1] }, projectSchemas: { readable: [1, 2], writable: [2] }, minimumCapabilities: ["indexeddb"], version: 1, workerProtocolVersion: 1 };
 const result = approveReadableTelegramRelease({ capsule: { deliveryTarget: "telegram", entryPath: "/telegram.12345678.js", manifest }, loadedEntryPath: "/telegram.12345678.js", capabilities: { indexeddb: true, webgl2: false }, secureContext: true, hasControllingWorker: false, workerManifest: undefined });
 if (result.kind !== "approved") throw new Error("Expected actual opaque readable release permit");
 return result.approval;
}

function immediateLocks(): Pick<LockManager, "request"> {
 return { async request<T>(name: string, optionsOrCallback: LockOptions | LockGrantedCallback<T>, suppliedCallback?: LockGrantedCallback<T>): Promise<T> {
  const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : suppliedCallback;
  if (!callback) throw new Error("Missing lock callback");
  return callback({ name, mode: "exclusive" });
 } };
}

describe("existing-only Telegram readonly source", () => {
 it("refuses a forged readable-release permit before any lock or IndexedDB access", async () => {
  let databaseCalls = 0, lockCalls = 0;
  const scope = await verifiedReadonlyTestScope();
  const portable = createRegisteredRuntimePortablePorts({ binaryChecksum });
  expect(() => createTelegramReadonlyProjectSource({
   scope, release: {}, checksum, binaryChecksum, portable,
   technical: { secureContext: true, indexedDb: { open() { databaseCalls++; throw new Error("Unexpected database open"); } }, locks: { request() { lockCalls++; throw new Error("Unexpected scope lock"); } } }
  })).toThrow();
  expect(databaseCalls).toBe(0);
  expect(lockCalls).toBe(0);
 });
 it("an actually absent inventory stays empty without issuing a native open and closes synchronously", async () => {
  let opens = 0;
  const source = createTelegramReadonlyProjectSource({ scope: await verifiedReadonlyTestScope(), release: approval(), checksum, binaryChecksum, portable: createRegisteredRuntimePortablePorts({ binaryChecksum }), technical: { secureContext: true, locks: immediateLocks(), indexedDb: { async databases() { return []; }, open() { opens++; throw new Error("An absent inventory must not be opened"); } } } });
  expect(await completeReadonlyUnitOperation(source.listProjects())).toEqual({ kind: "empty" });
  expect(await completeReadonlyUnitOperation(source.sourceRecovery.listRecoverySources())).toEqual([]);
  expect(opens).toBe(0);
  const closed = source.dispose();
  expect(source.signal.aborted).toBe(true);
  expect(source.dispose()).toBe(closed);
  expect(await completeReadonlyUnitOperation(closed)).toBeUndefined();
  expect(await refuseReadonlyUnitOperation(source.sourceRecovery.listRecoverySources())).toBeDefined();
  expect(opens).toBe(0);
 });
 it("keeps the default lock-required constructor closed when Web Locks are missing", async () => {
  let opens = 0;
  const scope = await verifiedReadonlyTestScope();
  expect(() => createTelegramReadonlyProjectSource({ scope, release: approval(), checksum, binaryChecksum, portable: createRegisteredRuntimePortablePorts({ binaryChecksum }), technical: { secureContext: true, indexedDb: { open() { opens++; throw new Error("Unexpected native open"); } } } })).toThrow();
  expect(opens).toBe(0);
 });
 it("explicit native-readonly coordination admits an absent inventory without locks or provisioning", async () => {
  let opens = 0;
  const source = createTelegramReadonlyProjectSource({ coordination: "native-readonly-snapshot", scope: await verifiedReadonlyTestScope(), release: approval(), checksum, binaryChecksum, portable: createRegisteredRuntimePortablePorts({ binaryChecksum }), technical: { secureContext: true, indexedDb: { async databases() { return []; }, open() { opens++; throw new Error("Unexpected native open"); } } } });
  expect(await completeReadonlyUnitOperation(source.listProjects())).toEqual({ kind: "empty" });
  expect(await completeReadonlyUnitOperation(source.sourceRecovery.listRecoverySources())).toEqual([]);
  expect(opens).toBe(0);
  expect(await completeReadonlyUnitOperation(source.dispose())).toBeUndefined();
 });
 it("the explicit native-readonly profile never calls an available lock port", async () => {
  let locks = 0;
  const source = createTelegramReadonlyProjectSource({ coordination: "native-readonly-snapshot", scope: await verifiedReadonlyTestScope(), release: approval(), checksum, binaryChecksum, portable: createRegisteredRuntimePortablePorts({ binaryChecksum }), technical: { secureContext: true, locks: { request() { locks++; throw new Error("Native readonly profile attempted a lock"); } }, indexedDb: { async databases() { return []; }, open() { throw new Error("Unexpected native open"); } } } });
  expect(await completeReadonlyUnitOperation(source.listProjects())).toEqual({ kind: "empty" });
  expect(locks).toBe(0);
  expect(await completeReadonlyUnitOperation(source.dispose())).toBeUndefined();
 });

 it("the explicit native-readonly profile does not observe an unavailable request property on a partial host capability", async () => {
  let reads = 0;
  const locks: Pick<LockManager, "request"> = { get request(): LockManager["request"] { reads++; throw new Error("Unavailable host lock property was observed"); } };
  const source = createTelegramReadonlyProjectSource({ coordination: "native-readonly-snapshot", scope: await verifiedReadonlyTestScope(), release: approval(), checksum, binaryChecksum, portable: createRegisteredRuntimePortablePorts({ binaryChecksum }), technical: { secureContext: true, locks, indexedDb: { async databases() { return []; }, open() { throw new Error("Unexpected native open"); } } } });
  expect(await completeReadonlyUnitOperation(source.listProjects())).toEqual({ kind: "empty" });
  expect(reads).toBe(0);
  expect(await completeReadonlyUnitOperation(source.dispose())).toBeUndefined();
 });

});

describe("readonly source admission boundary", () => {
 async function validDependencies() {
  let storageCalls = 0;
  const dependencies: Parameters<typeof createTelegramReadonlyProjectSource>[0] = {
   scope: await verifiedReadonlyTestScope(), release: approval(), checksum, binaryChecksum,
   portable: createRegisteredRuntimePortablePorts({ binaryChecksum }),
   technical: {
    secureContext: true,
    indexedDb: { async databases() { storageCalls++; return []; }, open() { storageCalls++; throw new Error("Admission must remain inert"); } },
    locks: { request() { storageCalls++; throw new Error("Admission must not request a scope lock"); } },
   },
  };
  return { dependencies, storageCalls: () => storageCalls };
 }
 // Unknown JavaScript inputs exercise the actual public boundary without asserting a fake branded Scope type.
 const constructUnknown = (input: unknown): unknown => Reflect.apply(createTelegramReadonlyProjectSource, undefined, [input]);

 it("refuses an unsupported coordination profile before touching native storage", async () => {
  const f = await validDependencies();
  expect(() => constructUnknown({ ...f.dependencies, coordination: "unregistered-reader" })).toThrow();
  expect(f.storageCalls()).toBe(0);
 });
 it("requires the exact primitive verified-scope namespace instead of coercing foreign values", async () => {
  const f = await validDependencies();
  for (const scope of ["foreign", `${f.dependencies.scope}-suffix`, 7, { toString: () => f.dependencies.scope }]) {
   expect(() => constructUnknown({ ...f.dependencies, scope })).toThrow();
  }
  expect(f.storageCalls()).toBe(0);
 });
 it("a genuine readable permit does not override an insecure native technical context", async () => {
  const f = await validDependencies();
  expect(() => createTelegramReadonlyProjectSource({ ...f.dependencies, technical: { ...f.dependencies.technical, secureContext: false } })).toThrow();
  expect(f.storageCalls()).toBe(0);
 });
 it("all byte and Project verification functions are required before a readonly handle is admitted", async () => {
  const f = await validDependencies();
  const bad: readonly unknown[] = [
   { ...f.dependencies, checksum: { sha256: undefined } },
   { ...f.dependencies, binaryChecksum: { sha256Bytes: undefined } },
   { ...f.dependencies, portable: { ...f.dependencies.portable, writer: { encode: undefined } } },
   { ...f.dependencies, portable: { ...f.dependencies.portable, smoke: { verify: undefined } } },
  ];
  for (const input of bad) expect(() => constructUnknown(input)).toThrow();
  expect(f.storageCalls()).toBe(0);
 });
 it("rejects invalid configured wait bounds before opening, allocating an operation or taking a lock", async () => {
  const f = await validDependencies();
  for (const openTimeoutMs of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 60_001, "5000"]) {
   expect(() => constructUnknown({ ...f.dependencies, technical: { ...f.dependencies.technical, openTimeoutMs } })).toThrow();
  }
  expect(f.storageCalls()).toBe(0);
 });
 it("both existing inclusive wait boundaries construct and close without a native read", async () => {
  const f = await validDependencies();
  for (const openTimeoutMs of [1, 60_000]) {
   const reader = createTelegramReadonlyProjectSource({ ...f.dependencies, technical: { ...f.dependencies.technical, openTimeoutMs } });
   expect(reader.signal.aborted).toBe(false);
   const closed = reader.dispose();
   expect(reader.signal.aborted).toBe(true);
   expect(await completeReadonlyUnitOperation(closed)).toBeUndefined();
  }
  expect(f.storageCalls()).toBe(0);
 });
});
