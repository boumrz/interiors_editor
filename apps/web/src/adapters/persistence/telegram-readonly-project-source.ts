import { isApprovedReadableTelegramRelease } from "../../app/telegram-readable-release";
import { TelegramRuntimeSession } from "../../app/telegram-runtime-session";
import type { VerifiedTelegramScope } from "../telegram/signed-launch";
import type {
 BinaryChecksumPort, CancellationSignalPort, ChecksumPort, PortableBackupArchiveWriterPort,
 PortableBackupSmokeCheckPort, ProjectDirectoryResult, ProjectSourceRecoveryPort,
 ProjectSummary, UnverifiedProjectSource,
} from "../../application/ports";
import { alphaBackupFeasibilityLimits } from "../../application/backup-feasibility-policy";
import { ExportRuntimePortableBackupUseCase } from "../../application/export-runtime-portable-backup";
import type { ExportPortableBackupResult } from "../../application/export-portable-backup";
import { sameSha256ResourceHashBits } from "../../domain/resource-hash";
import { withNativeCancellation } from "../portable-backup/native-cancellation";
import {
 readTelegramReadonlyResourceRow, readUnverifiedTelegramSnapshot,
 sameTelegramReadonlySnapshot, verifyTelegramReadonlyCurrentSnapshot,
 type TelegramReadonlyProjectSnapshot, type TelegramReadonlyResourceDescriptor,

} from "./telegram-readonly-project-snapshot";

export interface TelegramReadonlyProjectSource {
 readonly scope: VerifiedTelegramScope;
 readonly signal: AbortSignal;
 readonly sourceRecovery: ProjectSourceRecoveryPort;
 listProjects(): Promise<ProjectDirectoryResult>;
 exportPortableBackup(projectId: string, expectedRevisionId: string, signal?: CancellationSignalPort): Promise<ExportPortableBackupResult>;
 dispose(): Promise<void>;
}
export interface TelegramReadonlyProjectSourceDependencies {
 readonly coordination?: "scoped-lock" | "native-readonly-snapshot";
 readonly scope: VerifiedTelegramScope;
 readonly release: unknown;
 readonly technical: {
  readonly indexedDb: Pick<IDBFactory, "open"> & Partial<Pick<IDBFactory, "databases">>;
  readonly locks?: Pick<LockManager, "request">;
  readonly secureContext: boolean;
  readonly openTimeoutMs?: number;
  readonly acceptExactFloorYawStorage?: boolean;
  readonly acceptDoorHingeStorage?: boolean;
  readonly acceptRoomInteriorStorage?: boolean;
 };
 readonly checksum: ChecksumPort;
 readonly binaryChecksum: BinaryChecksumPort;
 readonly portable: { readonly writer: PortableBackupArchiveWriterPort; readonly smoke: PortableBackupSmokeCheckPort };
}
const stores = {
 "scope-metadata": "key", projects: "projectId", revisions: "revisionId", staging: "attemptId",
 "writer-fences": "projectId", "publication-attempts": "attemptId", "pin-staging-leases": "leaseId",
 resources: "resourceHash", library: "resourceHash",
} as const;
const maximumCounter = 18_446_744_073_709_551_615n;
class ReadonlyMetadataFault extends Error {}
class ReadonlyUnavailable extends Error {}

/** Inert construction; only an actual readable-shell permit and verified scope admit later reads. */
export function createTelegramReadonlyProjectSource(dependencies: TelegramReadonlyProjectSourceDependencies): TelegramReadonlyProjectSource {
 if (!isApprovedReadableTelegramRelease(dependencies.release)) throw new Error("Approved readable Telegram release is required");
 const { scope, checksum, binaryChecksum, portable } = dependencies;
 const technical = { ...dependencies.technical };
 const coordination = dependencies.coordination ?? "scoped-lock";
 if (coordination !== "scoped-lock" && coordination !== "native-readonly-snapshot") throw new Error("Explicit readonly coordination is required");
 if (typeof scope !== "string" || /^tma-v1-[a-f0-9]{64}$/.exec(scope)?.[0] !== scope) throw new Error("Verified Telegram scope is required");
 if (!technical.secureContext || typeof technical.indexedDb.open !== "function" || (coordination === "scoped-lock" && (!technical.locks || typeof technical.locks.request !== "function"))) throw new Error("Secure readonly Telegram storage capabilities are required");
 if (typeof checksum.sha256 !== "function" || typeof binaryChecksum.sha256Bytes !== "function" || typeof portable.writer.encode !== "function" || typeof portable.smoke.verify !== "function") throw new Error("Readonly backup verification ports are required");
 const timeout = technical.openTimeoutMs ?? 5000;
 if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 60_000) throw new Error("Bounded readonly storage timeout is required");
 const reader = new ReadonlyReader(scope, { ...dependencies, technical }, timeout, coordination);
 return Object.freeze({
  scope, signal: reader.signal,
  sourceRecovery: Object.freeze({ listRecoverySources: () => reader.listSources(), readRecoverySource: (projectId: string, revisionId: string) => reader.readSource(projectId, revisionId) }),
  listProjects: () => reader.listProjects(),
  exportPortableBackup: (projectId: string, revisionId: string, signal?: CancellationSignalPort) => reader.export(projectId, revisionId, signal),
  dispose: () => reader.dispose(),
 });
}

class ReadonlyReader {
 private readonly session: TelegramRuntimeSession;
 public readonly signal: AbortSignal;
 private readonly databaseName: string;
 private readonly openNative: IDBFactory["open"];
 private readonly inventory: (() => Promise<IDBDatabaseInfo[]>) | undefined;
 private readonly requestLock: LockManager["request"] | undefined;
 private readonly transactions = new Set<IDBTransaction>();
 private opening: Promise<IDBDatabase | undefined> | undefined;
 private handle: IDBDatabase | undefined;
 private knownExisting = false;
 private observedCounter = 0n;
 private disposal: Promise<void> | undefined;
 private readonly abortTransactions = () => { for (const transaction of this.transactions) abort(transaction); };
 public constructor(private readonly scope: VerifiedTelegramScope, private readonly dependencies: TelegramReadonlyProjectSourceDependencies, private readonly timeout: number, private readonly coordination: "scoped-lock" | "native-readonly-snapshot") {
  this.session = new TelegramRuntimeSession(scope); this.signal = this.session.signal;
  this.databaseName = `interiors-editor-projects:${scope}`;
  this.openNative = dependencies.technical.indexedDb.open.bind(dependencies.technical.indexedDb);
  this.inventory = dependencies.technical.indexedDb.databases?.bind(dependencies.technical.indexedDb);
  const locks = dependencies.technical.locks;
  this.requestLock = coordination === "scoped-lock" ? locks?.request.bind(locks) : undefined;
  this.signal.addEventListener("abort", this.abortTransactions, { once: true });
 }
 public listProjects(): Promise<ProjectDirectoryResult> {
  return this.run(async (database, signal) => {
   if (!database) return { kind: "empty" };
   const ids = await this.keys(database, signal), projects: ProjectSummary[] = [];
   let recoveryNeeded = false;
   for (const id of ids) {
    if (typeof id !== "string") { recoveryNeeded = true; continue; }
    const rows = await this.snapshot(database, id, false, signal);
    const verified = await verifyTelegramReadonlyCurrentSnapshot(rows, this.dependencies.checksum);
    this.assertActive(signal);
    if (!verified) { recoveryNeeded = true; continue; }
    projects.push({ projectId: id, revisionId: verified.candidate.revision.revisionId, name: verified.candidate.project.name, updatedAt: verified.candidate.project.updatedAt });
   }
   return projects.length ? { kind: "populated", projects, ...(recoveryNeeded ? { recoveryNeeded: true as const } : {}) } : recoveryNeeded ? { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" } : { kind: "empty" };
  });
 }
 public listSources(): Promise<readonly Omit<UnverifiedProjectSource, "serializedProject">[]> {
  return this.run(async (database, signal) => {
   if (!database) return [];
   const result: Omit<UnverifiedProjectSource, "serializedProject">[] = [];
   for (const projectId of await this.keys(database, signal)) {
    if (typeof projectId !== "string") continue;
    const rows = await this.snapshot(database, projectId, false, signal);
    const revisionId = record(rows.pointer) ? rows.pointer.currentRevisionId : undefined;
    if (typeof revisionId !== "string") continue;
    const source = readUnverifiedTelegramSnapshot(rows, revisionId);
    if (source) result.push({ kind: source.kind, projectId: source.projectId, revisionId: source.revisionId });
   }
   return result;
  });
 }
 public readSource(projectId: string, revisionId: string): Promise<UnverifiedProjectSource | undefined> {
  return this.run(async (database, signal) => database ? readUnverifiedTelegramSnapshot(await this.snapshot(database, projectId, false, signal), revisionId) : undefined);
 }
 public async export(projectId: string, revisionId: string, sourceSignal?: CancellationSignalPort): Promise<ExportPortableBackupResult> {
  if (sourceSignal?.aborted || this.signal.aborted) return cancelled();
  try {
   const result = await withNativeCancellation(sourceSignal, (native) => this.run(async (database, signal) => {
    if (!database) return unavailable();
    const snapshot = await this.snapshot(database, projectId, true, signal);
    if (!record(snapshot.pointer) || snapshot.pointer.currentRevisionId !== revisionId) return unavailable();
    const verified = await verifyTelegramReadonlyCurrentSnapshot(snapshot, this.dependencies.checksum, database.version);
    this.assertActive(signal);
    if (!verified || !snapshot.resources || snapshot.resources.length !== verified.resourceManifest.length) return unavailable();
    const bytes = new Map<string, Uint8Array>();
    for (let index = 0; index < verified.resourceManifest.length; index++) {
     const descriptor = verified.resourceManifest[index], row = readTelegramReadonlyResourceRow(this.scope, descriptor, snapshot.resources[index]);
     if (!row) return unavailable();
     const value = new Uint8Array(await row.blob.arrayBuffer());
     this.assertActive(signal);
     if (value.byteLength !== descriptor.byteLength || !sameSha256ResourceHashBits(descriptor.resourceHash, await this.dependencies.binaryChecksum.sha256Bytes(value))) return unavailable();
     this.assertActive(signal);
     bytes.set(descriptor.resourceHash, value);
    }
    const exporter = new ExportRuntimePortableBackupUseCase({ checksum: this.dependencies.checksum, resources: { read: async (hash) => bytes.get(hash)?.slice() }, smoke: this.dependencies.portable.smoke, writer: this.dependencies.portable.writer });
    const formatted = await exporter.execute(verified.candidate, signal);
    this.assertActive(signal);
    if (formatted.kind !== "ready") return formatted;
    const current = await this.snapshot(database, projectId, false, signal);
    if (!sameTelegramReadonlySnapshot({ ...snapshot, resources: undefined }, { ...current, resources: undefined })) return unavailable();
    return formatted;
   }, native));
   return result.kind === "cancelled" ? cancelled() : result.value;
  } catch {
   return sourceSignal?.aborted || this.signal.aborted ? cancelled() : unavailable();
  }
 }
 public dispose(): Promise<void> {
  if (this.disposal) return this.disposal;
  let finish: () => void = () => undefined, fail: (reason: unknown) => void = () => undefined;
  this.disposal = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  const drain = this.session.revoke();
  void drain.then(() => { this.closeHandle(this.handle); this.signal.removeEventListener("abort", this.abortTransactions); finish(); }, fail);
  return this.disposal;
 }
 private assertActive(signal: AbortSignal): void { if (this.signal.aborted || signal.aborted) throw new DOMException("Readonly source is closed", "AbortError"); }
 private run<T>(work: (database: IDBDatabase | undefined, signal: AbortSignal) => Promise<T>, external?: AbortSignal): Promise<T> {
  return this.session.run(async () => {
   const cancellation = new AbortController();
   const cancel = () => cancellation.abort();
   this.signal.addEventListener("abort", cancel, { once: true }); external?.addEventListener("abort", cancel, { once: true });
   if (this.signal.aborted || external?.aborted) cancel();
   let granted = false;
   const timer = setTimeout(() => { if (!granted) cancellation.abort(); }, this.timeout);
   try {
    this.assertActive(cancellation.signal);
    const readSnapshot = async () => {
     this.assertActive(cancellation.signal);
     const database = await this.database(cancellation.signal);
     const result = await work(database, cancellation.signal);
     this.assertActive(cancellation.signal);
     return result;
    };
    if (this.coordination === "native-readonly-snapshot") {
     // One native readonly transaction owns every selected row and Blob. The
     // exporter validates those owned bytes and the final current-proof CAS;
     // this explicit profile grants no writer or provisioning capability.
     granted = true; clearTimeout(timer);
     return await readSnapshot();
    }
    const requestLock = this.requestLock;
    if (!requestLock) throw new ReadonlyUnavailable("Readonly scope lock is unavailable");
    return await requestLock(`interiors-tma-storage-v1:${this.scope}`, { mode: "exclusive", signal: cancellation.signal }, async (lock) => {
     granted = true; clearTimeout(timer);
     if (!lock) throw new ReadonlyUnavailable("Readonly scope lock was not granted");
     return readSnapshot();
    });
   } finally { clearTimeout(timer); this.signal.removeEventListener("abort", cancel); external?.removeEventListener("abort", cancel); }
  });
 }
 private async database(signal: AbortSignal): Promise<IDBDatabase | undefined> {
  this.assertActive(signal);
  if (this.opening) return this.opening;
  if (this.inventory) {
   const databases = await cancellable(this.inventory(), signal, this.timeout);
   this.assertActive(signal);
   if (!databases.some(value => value.name === this.databaseName)) {
    if (this.knownExisting) { void this.dispose(); throw new ReadonlyMetadataFault("Known readonly database was lost"); }
    return undefined;
   }
  }
  const opening = this.openExisting(signal); this.opening = opening;
  void opening.then(database => { if (!database && this.opening === opening) this.opening = undefined; }, () => { if (this.opening === opening) this.opening = undefined; });
  return opening;
 }
 private openExisting(signal: AbortSignal): Promise<IDBDatabase | undefined> {
  return new Promise((resolve, reject) => {
   let request: IDBOpenDBRequest;
   try { request = this.openNative(this.databaseName); } catch (error) { reject(error); return; }
   let settled = false, validating = false, absentUpgrade = false, abandoned: unknown;
   const cancellation = new AbortController();
   const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); };
   const fail = (error: unknown) => { abandoned = error; cancellation.abort(); if (!validating && !settled) { settled = true; cleanup(); reject(error); } };
   const onAbort = () => fail(new DOMException("Readonly open was abandoned", "AbortError"));
   const timer = setTimeout(() => fail(new ReadonlyUnavailable("Readonly database open timed out")), this.timeout);
   signal.addEventListener("abort", onAbort, { once: true });
   if (signal.aborted) onAbort();
   request.onblocked = () => fail(new ReadonlyUnavailable("Readonly database open is blocked"));
   request.onupgradeneeded = event => { absentUpgrade = event.oldVersion === 0 && !this.knownExisting; request.transaction?.abort(); };
   request.onerror = () => {
    if (settled) return;
    if (absentUpgrade && abandoned === undefined && !signal.aborted) { settled = true; cleanup(); resolve(undefined); }
    else fail(request.error ?? new ReadonlyUnavailable("Readonly database open failed"));
   };
   request.onsuccess = () => {
    const database = request.result;
    if (settled || abandoned !== undefined || signal.aborted || absentUpgrade) { database.close(); if (!settled) fail(new ReadonlyUnavailable("Abandoned readonly database handle")); return; }
    const supportsVersion = database.version === 2
      || (database.version === 3 && this.dependencies.technical.acceptExactFloorYawStorage === true)
      || (database.version === 4 && this.dependencies.technical.acceptDoorHingeStorage === true)
      || ((database.version === 5 || database.version === 6) && this.dependencies.technical.acceptRoomInteriorStorage === true);
    if (!supportsVersion || !sameNames(database.objectStoreNames, Object.keys(stores))) { database.close(); void this.dispose(); fail(new ReadonlyMetadataFault("Readonly database schema is unsupported")); return; }
    this.handle = database;
    database.onversionchange = () => { void this.dispose(); database.close(); };
    database.onclose = () => { void this.dispose(); };
    validating = true;
    void this.transaction(database, cancellation.signal, async () => undefined).then(() => {
     validating = false;
     if (abandoned !== undefined || signal.aborted) { this.closeHandle(database); fail(abandoned ?? new DOMException("Readonly open was abandoned", "AbortError")); return; }
     this.knownExisting = true; settled = true; cleanup(); resolve(database);
    }, error => { validating = false; this.closeHandle(database); fail(abandoned ?? error); });
   };
  });
 }
 private closeHandle(database: IDBDatabase | undefined): void { if (!database) return; database.onversionchange = null; database.onclose = null; database.close(); if (this.handle === database) this.handle = undefined; }
 private async transaction<T>(database: IDBDatabase, signal: AbortSignal, work: (transaction: IDBTransaction) => Promise<T>): Promise<T> {
  this.assertActive(signal);
  let transaction: IDBTransaction;
  try { transaction = database.transaction(Object.keys(stores), "readonly"); } catch (error) { void this.dispose(); throw error; }
  this.transactions.add(transaction);
  const completion = transactionDone(transaction); void completion.catch(() => undefined);
  const onAbort = () => abort(transaction); signal.addEventListener("abort", onAbort, { once: true });
  try {
   for (const [name, keyPath] of Object.entries(stores)) { const store = transaction.objectStore(name); if (store.keyPath !== keyPath || store.autoIncrement || store.indexNames.length !== 0) throw new ReadonlyMetadataFault("Readonly store inventory is unsupported"); }
   const records: readonly unknown[] = await read(transaction.objectStore("scope-metadata").getAll());
   const counter = metadataCounter(records, this.scope);
   if (counter === undefined || counter < this.observedCounter) throw new ReadonlyMetadataFault("Readonly scope identity or counter was lost");
   this.assertActive(signal);
   const result = await work(transaction);
   await completion;
   this.assertActive(signal); this.observedCounter = counter;
   return result;
  } catch (error) { abort(transaction); await completion.catch(() => undefined); if (error instanceof ReadonlyMetadataFault) void this.dispose(); throw error; }
  finally { signal.removeEventListener("abort", onAbort); this.transactions.delete(transaction); }
 }
 private keys(database: IDBDatabase, signal: AbortSignal): Promise<readonly IDBValidKey[]> { return this.transaction(database, signal, transaction => read(transaction.objectStore("projects").getAllKeys())); }
 private snapshot(database: IDBDatabase, projectId: string, withResources: boolean, signal: AbortSignal): Promise<TelegramReadonlyProjectSnapshot & { readonly resources?: readonly unknown[] }> {
  return this.transaction(database, signal, async transaction => {
   const pointer: unknown = await read(transaction.objectStore("projects").get(projectId));
   const revision: unknown = record(pointer) && typeof pointer.currentRevisionId === "string" ? await read(transaction.objectStore("revisions").get(pointer.currentRevisionId)) : undefined;
   const creation: unknown = record(revision) && typeof revision.creationAttemptId === "string" ? await read(transaction.objectStore("publication-attempts").get(revision.creationAttemptId)) : undefined;
   const result = { scope: this.scope, projectId, pointer, revision, creation };
   if (!withResources) return result;
   const descriptors = record(revision) ? resourceDescriptors(revision.resourceManifest) : undefined;
   if (!descriptors) return result;
   const resources: unknown[] = [];
   for (const descriptor of descriptors) resources.push(await read(transaction.objectStore("resources").get(descriptor.resourceHash)));
   return { ...result, resources };
  });
 }
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function sameNames(names: DOMStringList, expected: readonly string[]): boolean { return Array.from(names).sort().join() === [...expected].sort().join(); }
function metadataCounter(records: readonly unknown[], scope: string): bigint | undefined {
 if (records.length !== 2) return undefined;
 const identity = records.find(value => record(value) && value.key === "identity"), counter = records.find(value => record(value) && value.key === "counter");
 if (!record(identity) || Object.keys(identity).length !== 3 || identity.protocolVersion !== 1 || identity.scope !== scope || !record(counter) || Object.keys(counter).length !== 2 || typeof counter.lastReserved !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(counter.lastReserved)) return undefined;
 const value = BigInt(counter.lastReserved); return value <= maximumCounter ? value : undefined;
}
function resourceDescriptors(value: unknown): readonly TelegramReadonlyResourceDescriptor[] | undefined {
 if (!Array.isArray(value) || value.length > alphaBackupFeasibilityLimits.maxResourceEntries) return undefined;
 const result: TelegramReadonlyResourceDescriptor[] = []; let total = 0;
 for (const entry of value) {
  if (!record(entry) || Object.keys(entry).length !== 2 || typeof entry.resourceHash !== "string" || !/^[a-fA-F0-9]{64}$/.test(entry.resourceHash) || typeof entry.byteLength !== "number" || !Number.isSafeInteger(entry.byteLength) || entry.byteLength <= 0 || entry.byteLength > alphaBackupFeasibilityLimits.maxResourceBytesPerEntry || entry.byteLength > alphaBackupFeasibilityLimits.maxResourceBytes - total) return undefined;
  total += entry.byteLength; result.push({ resourceHash: entry.resourceHash, byteLength: entry.byteLength });
 }
 return result;
}
function read<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new ReadonlyUnavailable("Readonly storage request failed")); }); }
function abort(transaction: IDBTransaction): void { try { transaction.abort(); } catch { /* A final native transaction cannot abort twice. */ } }
function transactionDone(transaction: IDBTransaction): Promise<void> {
 return new Promise((resolve, reject) => {
  let error: unknown;
  transaction.oncomplete = () => error === undefined ? resolve() : reject(error);
  transaction.onabort = () => reject(error ?? transaction.error ?? new DOMException("Readonly transaction aborted", "AbortError"));
  transaction.onerror = () => { error = transaction.error ?? new ReadonlyUnavailable("Readonly transaction request failed"); abort(transaction); };
 });
}
function cancellable<T>(promise: Promise<T>, signal: AbortSignal, timeout: number): Promise<T> {
 return new Promise((resolve, reject) => {
  let settled = false;
  const finish = (work: () => void) => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener("abort", onAbort); work(); };
  const onAbort = () => finish(() => reject(new DOMException("Readonly query was abandoned", "AbortError")));
  const timer = setTimeout(() => finish(() => reject(new ReadonlyUnavailable("Readonly inventory timed out"))), timeout);
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  void promise.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
 });
}
function cancelled(): ExportPortableBackupResult { return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }; }
function unavailable(): ExportPortableBackupResult { return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" }; }
