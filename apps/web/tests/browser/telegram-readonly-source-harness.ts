import { createInitialProject } from "../../src/domain/initial-project";
import { serializeProjectCanonically } from "../../src/domain/canonical-serialization";
import { configureRectangularRoom } from "../../src/domain/rectangular-room";
import type { Project } from "../../src/domain/project";
import { isStructurallyValidProjectV1 } from "../../src/domain/project-json-transfer";
import { TelegramRuntimeSession } from "../../src/app/telegram-runtime-session";
import { createTelegramContextState } from "../../src/adapters/telegram/context-state";
import { approveReadableTelegramRelease } from "../../src/app/telegram-readable-release";
import { TelegramScopeStore } from "../../src/adapters/persistence/telegram-scope-store";
import { TelegramProjectRepository } from "../../src/adapters/persistence/telegram-project-repository";
import { createTelegramReadonlyProjectSource, type TelegramReadonlyProjectSource } from "../../src/adapters/persistence/telegram-readonly-project-source";
import { createRegisteredRuntimePortablePorts } from "../../src/adapters/portable-backup/registered-runtime-portable";
import { verifiedReadonlyTestScope } from "../fixtures/telegram-readonly-signed-launch";

let fileCancellation: AbortController | undefined;
let checksumHold: { entered: boolean; release(): void; wait: Promise<void> } | undefined;
const binaryChecksum = { async sha256Bytes(bytes: Uint8Array) {
 const value = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
 return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
} };
const checksum = { async sha256(text: string) {
 if (subjectPhase && checksumHold) { const hold = checksumHold; hold.entered = true; await hold.wait; }
 return binaryChecksum.sha256Bytes(new TextEncoder().encode(text));
} };
let reader: TelegramReadonlyProjectSource | undefined;
let subjectPhase = false;
const readerHandles = new WeakSet<IDBDatabase>();
const openedReaderHandles: { handle: IDBDatabase; closeCalled: boolean }[] = [];
let liveWriter: { storage: TelegramScopeStore; repository: TelegramProjectRepository; project: Project; revisionId: string } | undefined;
let disposalState: "none" | "pending" | "resolved" = "none";
const transactions: { name: string; mode: IDBTransactionMode; final?: "complete" | "abort" }[] = [];
const lifecycle: string[] = [];
const upgrades: { oldVersion: number; newVersion: number | null; final?: "abort" | "complete" }[] = [];
let abortDuringMetadata = false;
let openHold: (() => void) | undefined;
let lateHandle: IDBDatabase | undefined;
let lateHandleClosed = false;
let deletionBlocker: IDBDatabase | undefined;
let deletionCompletion: Promise<void> | undefined;
let lockRelease: (() => void) | undefined;
let lockCompletion: Promise<void> | undefined;
let operation: { status: "pending" | "fulfilled" | "rejected"; value?: unknown } | undefined;
const nativeTransaction = IDBDatabase.prototype.transaction;
const nativeClose = IDBDatabase.prototype.close;
const nativeGetAll = IDBObjectStore.prototype.getAll;
const successSetter = Object.getOwnPropertyDescriptor(IDBRequest.prototype, "onsuccess")?.set;
if (!successSetter) throw new Error("Native request callback descriptor is unavailable");
IDBDatabase.prototype.close = function() { for (const value of openedReaderHandles) if (value.handle === this) value.closeCalled = true; if (this === lateHandle) lateHandleClosed = true; return nativeClose.call(this); };
IDBDatabase.prototype.transaction = function(storeNames, mode = "readonly", options) {
 const tx = nativeTransaction.call(this, storeNames, mode, options);
 if (readerHandles.has(this)) {
  const observation: typeof transactions[number] = { name: this.name, mode };
  transactions.push(observation);
  if (mode !== "readonly") { tx.abort(); throw new Error("Readonly subject attempted a changing transaction"); }
  tx.addEventListener("complete", () => { observation.final = "complete"; lifecycle.push("native-complete"); });
  tx.addEventListener("abort", () => { observation.final = "abort"; lifecycle.push("native-abort"); });
 }
 return tx;
};
IDBObjectStore.prototype.getAll = function(...args: Parameters<IDBObjectStore["getAll"]>) {
 const request = nativeGetAll.apply(this, args);
 if (readerHandles.has(this.transaction.db) && this.name === "scope-metadata" && abortDuringMetadata) {
  abortDuringMetadata = false;
  Object.defineProperty(request, "onsuccess", { set(handler: IDBRequest["onsuccess"]) {
   successSetter.call(request, (event: Event) => {
    lifecycle.push("revoke-in-native-request");
    if (!reader) throw new Error("No reader during native callback");
    void reader.dispose().then(() => { lifecycle.push("dispose-resolved"); });
    handler?.call(request, event);
   });
  } });
 }
 return request;
};
function readableApproval() {
 const entry = document.querySelector<HTMLScriptElement>("script[src]");
 if (!entry) throw new Error("Actual native harness script is missing");
 const entryPath = new URL(entry.src).pathname;
 const manifest = { appBuildId: "0123456789abcdef", assetSchemas: { readable: [1], writable: [1] }, catalogSchemas: { readable: [1], writable: [1] }, projectSchemas: { readable: [1, 2], writable: [2] }, minimumCapabilities: ["indexeddb"], version: 1, workerProtocolVersion: 1 };
 const result = approveReadableTelegramRelease({ capsule: { deliveryTarget: "telegram", entryPath, manifest }, loadedEntryPath: entryPath, secureContext: isSecureContext, capabilities: { indexeddb: !!indexedDB, webgl2: false }, hasControllingWorker: !!navigator.serviceWorker?.controller, workerManifest: undefined });
 if (result.kind !== "approved") throw new Error("Actual readonly harness shell permit failed");
 return result.approval;
}
async function nativeDatabase() {
 const scope = await verifiedReadonlyTestScope();
 return new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(`interiors-editor-projects:${scope}`);
  request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error("Snapshot observer refused an absent database")); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
 });
}
async function normalize(value: unknown): Promise<unknown> {
 if (value instanceof Blob) return { nativeBlob: true, size: value.size, type: value.type, bytes: Array.from(new Uint8Array(await value.arrayBuffer())) };
 if (Array.isArray(value)) return Promise.all(value.map(normalize));
 if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, entry]) => [key, await normalize(entry)])));
 return value;
}
async function rows() {
 const db = await nativeDatabase();
 try {
  const values: Record<string, unknown> = {};
  for (const name of Array.from(db.objectStoreNames)) {
   values[name] = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(name, "readonly"), request = tx.objectStore(name).getAll();
    let records: unknown;
    request.onsuccess = () => { records = request.result; };
    tx.oncomplete = () => resolve(records);
    tx.onabort = () => reject(tx.error);
   });
  }
  return await normalize(values);
 } finally { db.close(); }
}
async function fixtureWrite(work: (tx: IDBTransaction) => void) {
 const previous = subjectPhase; subjectPhase = false;
 const db = await nativeDatabase();
 try {
  await new Promise<void>((resolve, reject) => {
   const tx = db.transaction(Array.from(db.objectStoreNames), "readwrite");
   tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
   try { work(tx); } catch (error) { tx.abort(); reject(error); }
  });
 } finally { db.close(); subjectPhase = previous; }
}
function row(value: unknown): Record<string, unknown> {
 if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Genuine fixture row is missing");
 return value as Record<string, unknown>;
}
function staticGlb() {
 const json = new TextEncoder().encode('{"asset":{"version":"2.0"}} '), bytes = new Uint8Array(20 + json.byteLength), view = new DataView(bytes.buffer);
 view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.byteLength, true); view.setUint32(12, json.byteLength, true); view.setUint32(16, 0x4e4f534a, true); bytes.set(json, 20);
 return bytes;
}
async function seedFixture(options: { aliases?: boolean; legacyValues?: boolean; resources?: boolean; preparedOnly?: boolean; keepWriter?: boolean; projectId?: string; revisionId?: string; name?: string } = {}) {
 subjectPhase = false;
 const scope = await verifiedReadonlyTestScope();
 const session = new TelegramRuntimeSession(scope);
 const storage = new TelegramScopeStore(session, { indexedDb: indexedDB, locks: navigator.locks, secureContext: isSecureContext });
 const repository = new TelegramProjectRepository(storage, { ownerId: crypto.randomUUID(), nowEpochMs: () => Date.now(), checksum, binaryChecksum, takeoverRequirements: createTelegramContextState(scope, { localStorage, sessionStorage }).writerTakeover });
 let project: Project = createInitialProject({ projectId: options.projectId ?? (options.legacyValues ? "readonly-project\ud800" : "readonly-project"), levelId: "readonly-level", name: options.name ?? "Existing readonly Project", createdAt: "2026-11-05T00:00:00.000Z" });
 if (options.legacyValues) {
  let sequence = 0;
  const result = configureRectangularRoom(project, { widthMm: "4000", depthMm: "3000", heightMm: "2600" }, { next: () => `legacy-${++sequence}` }, project.updatedAt);
  if (result.kind !== "accepted") throw new Error("Genuine geometry prerequisite was rejected");
  project = { ...result.project, level: { ...result.project.level, vertices: result.project.level.vertices.map((vertex, index) => index === 0 ? { ...vertex, xMm: -0 } : vertex), rooms: result.project.level.rooms.map(room => ({ ...room, name: undefined })) }, assetInstances: [{ anchorClass: "floor", assetInstanceId: "legacy-floor", roomId: result.project.level.rooms[0].roomId, label: "Legacy floor", xMm: 1500, zMm: 1500, widthMm: 300, depthMm: 300, heightMm: 900, color: "#416b91", elevationMm: -0, yawRadians: 0.5, colorVariantId: undefined }] };
 }
 if (options.legacyValues) {
  const raw = { ...project, assetInstances: [...project.assetInstances, { ...project.assetInstances[0], assetInstanceId: "nested-variant-floor", xMm: 2600, colorVariantId: [["alpha-blue"]] }] };
  if (!isStructurallyValidProjectV1(raw)) throw new Error("Authoritative legacy Project guard rejected the supported nested variant fixture");
  project = raw;
 }
 const bytes = staticGlb(), lower = await binaryChecksum.sha256Bytes(bytes);
 const hashes = options.resources || options.aliases ? options.aliases ? [lower, lower.toUpperCase()] : [lower] : [];
 if (options.aliases && hashes[0] === hashes[1]) throw new Error("Expected distinct exact hash aliases");
 if (hashes.length) project = { ...project, assetDefinitionRefs: hashes.map((resourceHash, index) => ({ assetDefinitionId: `readonly-custom-${index}`, byteLength: bytes.byteLength, depthMm: 100, displayName: "Локальная модель", format: "glb", heightMm: 100, resourceHash, widthMm: 100 })) };
 const serializedProject = serializeProjectCanonically(project);
 const candidate = { project, revision: { projectId: project.projectId, revisionId: options.revisionId ?? "readonly-revision", createdAt: project.createdAt, schemaVersion: 1 as const, serializedProject, checksum: await checksum.sha256(serializedProject) } };
 const lease = hashes.length ? await repository.pinStaging.begin(hashes, { candidate }) : undefined;
 if (lease) {
  for (const resourceHash of hashes) await repository.resources.writeIfAbsentPinned?.({ resourceHash, bytes }, lease.leaseId);
  await repository.pinStaging.markForPublication(lease, { projectId: project.projectId, revisionId: candidate.revision.revisionId });
 }
 const result = options.preparedOnly ? { kind: "prepared-fixture" as const } : await repository.publish(candidate);
 if (result.kind !== "durable" && result.kind !== "prepared-fixture") throw new Error(`Genuine scoped repository fixture did not become Durable: ${result.kind}`);
 if (lease && !options.preparedOnly) await repository.pinStaging.complete(lease);
 if (options.keepWriter) liveWriter = { storage, repository, project, revisionId: candidate.revision.revisionId };
 else await storage.close();
 return { summary: { projectId: project.projectId, revisionId: candidate.revision.revisionId, name: project.name, updatedAt: project.updatedAt }, hashes, originalBytes: Array.from(bytes), serializedProject };
}
type Fault = "creation-missing" | "creation-prepared" | "creation-checksum" | "creation-receipt-id" | "creation-scope" | "pointer-scope" | "pointer-revision-stale" | "revision-missing" | "revision-scope" | "revision-project" | "revision-schema" | "candidate-project" | "candidate-revision" | "corrupt-string" | "manifest-sparse" | "item-sparse";
async function tamper(fault: Fault, projectId = "readonly-project") {
 await fixtureWrite(tx => {
  const pointers = tx.objectStore("projects"), revisions = tx.objectStore("revisions"), creations = tx.objectStore("publication-attempts");
  const request = pointers.get(projectId);
  request.onsuccess = () => {
   const pointer = row(request.result), revisionId = String(pointer.currentRevisionId);
   if (fault === "pointer-scope") { pointers.put({ ...pointer, scope: "foreign" }); return; }
   if (fault === "pointer-revision-stale") { pointers.put({ ...pointer, currentRevisionId: "other" }); return; }
   if (fault === "revision-missing") { revisions.delete(revisionId); return; }
   const revisionRequest = revisions.get(revisionId);
   revisionRequest.onsuccess = () => {
    const revision = row(revisionRequest.result), candidate = row(revision.candidate), source = row(candidate.revision), project = row(candidate.project);
    if (fault === "revision-scope") { revisions.put({ ...revision, scope: "foreign" }); return; }
    if (fault === "revision-project") { revisions.put({ ...revision, projectId: "foreign" }); return; }
    if (fault === "revision-schema") { revisions.put({ ...revision, candidate: { ...candidate, revision: { ...source, schemaVersion: 9 } } }); return; }
    if (fault === "candidate-project") { revisions.put({ ...revision, candidate: { ...candidate, project: { ...project, projectId: "foreign" } } }); return; }
    if (fault === "candidate-revision") { revisions.put({ ...revision, candidate: { ...candidate, revision: { ...source, revisionId: "other" } } }); return; }
    if (fault === "corrupt-string") { revisions.put({ ...revision, candidate: { ...candidate, revision: { ...source, serializedProject: " \u0000raw-corrupt\ud800😀\n" } } }); return; }
    if (fault === "item-sparse") { const items: unknown[] = []; items.length = 1; revisions.put({ ...revision, candidate: { ...candidate, project: { ...project, assetInstances: items } } }); return; }
    const attemptId = String(revision.creationAttemptId);
    if (fault === "creation-missing") { creations.delete(attemptId); return; }
    const creationRequest = creations.get(attemptId);
    creationRequest.onsuccess = () => {
     const creation = row(creationRequest.result);
     if (fault === "creation-prepared") creations.put({ ...creation, state: "prepared" });
     else if (fault === "creation-checksum") creations.put({ ...creation, checksum: "wrong" });
     else if (fault === "creation-receipt-id") creations.put({ ...creation, receipt: { ...row(creation.receipt), revisionId: "other" } });
     else if (fault === "creation-scope") creations.put({ ...creation, scope: "foreign" });
     else if (fault === "manifest-sparse") { const manifest = Array<unknown>(1); revisions.put({ ...revision, resourceManifest: manifest }); creations.put({ ...creation, resourceManifest: manifest, receipt: { ...row(creation.receipt), resourceManifest: manifest } }); }
     else throw new Error("Unsupported fixture fault");
    };
   };
  };
 });
}
const harness = {
 async seed() { return (await seedFixture()).summary; },
 seedFixture,
 async seedMixedDirectory() {
  const healthy = await seedFixture();
  const corrupt = await seedFixture({ projectId: "readonly-project-b", revisionId: "readonly-revision-b", name: "Recoverable second Project" });
  await tamper("creation-missing", corrupt.summary.projectId);
  return { healthy: healthy.summary, corrupt: corrupt.summary, rawCorruptSource: corrupt.serializedProject };
 },
 async seedNumericProjectKey() {
  const healthy = await seedFixture();
  await fixtureWrite(tx => {
   const projects = tx.objectStore("projects"), revisions = tx.objectStore("revisions");
   const pointerRequest = projects.get(healthy.summary.projectId);
   pointerRequest.onsuccess = () => {
    const pointer = row(pointerRequest.result), revisionRequest = revisions.get(healthy.summary.revisionId);
    revisionRequest.onsuccess = () => {
     const revision = row(revisionRequest.result), candidate = row(revision.candidate);
     const project = row(candidate.project), source = row(candidate.revision), revisionId = "numeric-key-revision";
     // A native numeric key and matching malformed metadata must never become a string-addressed source card.
     projects.put({ ...pointer, projectId: 7, currentRevisionId: revisionId });
     revisions.put({ ...revision, projectId: 7, revisionId, candidate: { ...candidate, project: { ...project, projectId: 7 }, revision: { ...source, projectId: 7, revisionId } } });
    };
   };
  });
  return healthy.summary;
 },
 async start(options: { omitInventory?: boolean; openTimeoutMs?: number; holdOpen?: boolean; omitLocks?: boolean; coordination?: "scoped-lock" | "native-readonly-snapshot" } = {}) {
  const scope = await verifiedReadonlyTestScope(); subjectPhase = true;
  let holdNextOpen = options.holdOpen;
  const indexedDb = { open(name: string) {
   const request = indexedDB.open(name);
   request.addEventListener("success", () => { readerHandles.add(request.result); openedReaderHandles.push({ handle: request.result, closeCalled: false }); });
   request.addEventListener("upgradeneeded", event => {
    const observation: typeof upgrades[number] = { oldVersion: event.oldVersion, newVersion: event.newVersion }; upgrades.push(observation);
    request.transaction?.addEventListener("abort", () => { observation.final = "abort"; });
    request.transaction?.addEventListener("complete", () => { observation.final = "complete"; });
   });
   if (holdNextOpen) { holdNextOpen = false; Object.defineProperty(request, "onsuccess", { set(handler: IDBRequest["onsuccess"]) { successSetter.call(request, (event: Event) => { lateHandle = request.result; openHold = () => { handler?.call(request, event); openHold = undefined; }; }); } }); }
   return request;
  }, ...(options.omitInventory ? {} : { databases: indexedDB.databases.bind(indexedDB) }) };
  reader = createTelegramReadonlyProjectSource({ coordination: options.coordination, scope, release: readableApproval(), technical: { indexedDb, locks: options.omitLocks ? undefined : navigator.locks, secureContext: isSecureContext, openTimeoutMs: options.openTimeoutMs }, checksum, binaryChecksum, portable: createRegisteredRuntimePortablePorts({ binaryChecksum }) });
  return { scope: reader.scope, aborted: reader.signal.aborted, transactions: [...transactions] };
 },
 list() { if (!reader) throw new Error("No readonly reader"); return reader.listProjects(); },
 listSources() { if (!reader) throw new Error("No readonly reader"); return reader.sourceRecovery.listRecoverySources(); },
 read(projectId: string, revisionId: string) { if (!reader) throw new Error("No readonly reader"); return reader.sourceRecovery.readRecoverySource(projectId, revisionId); },
 async export(projectId: string, revisionId: string, signal?: AbortSignal) {
  if (!reader) throw new Error("No readonly reader");
  const result = await reader.exportPortableBackup(projectId, revisionId, signal);
  if (result.kind !== "ready") return result;
  const decoded = await createRegisteredRuntimePortablePorts({ binaryChecksum }).decoder.decode(result.bytes);
  const decodedProject = decoded.kind === "accepted" && decoded.projectMember?.format === "runtime-v1-wire" && isStructurallyValidProjectV1(decoded.projectMember.project) ? decoded.projectMember.project : undefined;
  const fidelity = decodedProject ? { negativeZero: Object.is(decodedProject.level.vertices[0]?.xMm, -0), ownUndefinedName: Object.hasOwn(decodedProject.level.rooms[0] ?? {}, "name") && decodedProject.level.rooms[0]?.name === undefined, ownUndefinedVariant: Object.hasOwn(decodedProject.assetInstances[0] ?? {}, "colorVariantId"), rawYaw: decodedProject.assetInstances[0]?.anchorClass === "floor" ? decodedProject.assetInstances[0].yawRadians : undefined, nestedVariant: decodedProject.assetInstances[1]?.colorVariantId } : undefined;
  const portable = decoded.kind === "accepted" ? { ...decoded, resources: decoded.resources?.map(resource => ({ resourceHash: resource.resourceHash, bytes: Array.from(resource.bytes) })) } : decoded;
  return { kind: result.kind, filename: result.filename, mimeType: result.mimeType, decoded: portable, fidelity };
 },
 async publishNext() {
  if (!liveWriter) throw new Error("No genuine live writer fixture");
  const previous = subjectPhase; subjectPhase = false;
  try {
   const project = { ...liveWriter.project, name: "Concurrent durable Project", updatedAt: "2026-11-05T00:00:01.000Z" }, revisionId = "readonly-next", serializedProject = serializeProjectCanonically(project);
   const candidate = { project, revision: { projectId: project.projectId, revisionId, createdAt: project.updatedAt, schemaVersion: 1 as const, serializedProject, checksum: await checksum.sha256(serializedProject) } };
   const result = await liveWriter.repository.publish(candidate, liveWriter.revisionId);
   if (result.kind !== "durable") throw new Error(`Concurrent genuine writer fixture refused publication: ${result.kind}`);
   liveWriter.project = project; liveWriter.revisionId = revisionId;
   return { projectId: project.projectId, revisionId, name: project.name, updatedAt: project.updatedAt };
  } finally { subjectPhase = previous; }
 },
 beginDispose() {
  if (!reader) throw new Error("No readonly reader");
  disposalState = "pending";
  void reader.dispose().then(() => { disposalState = "resolved"; });
  return { aborted: reader.signal.aborted, state: disposalState };
 },
 disposalState() { return disposalState; },
 async metadata(fault: "counter-missing" | "counter-overflow" | "counter-rollback" | "identity-scope") {
  await fixtureWrite(tx => {
   const metadata = tx.objectStore("scope-metadata");
   if (fault === "counter-missing") metadata.delete("counter");
   else if (fault === "counter-overflow") metadata.put({ key: "counter", lastReserved: "18446744073709551616" });
   else if (fault === "counter-rollback") metadata.put({ key: "counter", lastReserved: "0" });
   else { const request = metadata.get("identity"); request.onsuccess = () => metadata.put({ ...row(request.result), scope: "foreign" }); }
  });
 },
 async metadataShapeFault(fault: "identity-extra" | "identity-missing" | "identity-version" | "identity-array" | "counter-extra" | "counter-number" | "counter-empty" | "counter-leading-zero" | "counter-negative" | "counter-fraction" | "counter-array" | "metadata-extra") {
  await fixtureWrite(tx => {
   const metadata = tx.objectStore("scope-metadata");
   if (fault === "metadata-extra") { metadata.put({ key: "unexpected", value: true }); return; }
   const identityFault = fault.startsWith("identity-"), key = identityFault ? "identity" : "counter";
   const request = metadata.get(key);
   request.onsuccess = () => {
    const value = row(request.result);
    if (fault === "identity-extra" || fault === "counter-extra") metadata.put({ ...value, unexpected: true });
    else if (fault === "identity-missing") { const { protocolVersion: _removed, ...missing } = value; metadata.put(missing); }
    else if (fault === "identity-version") metadata.put({ ...value, protocolVersion: 2 });
    else if (fault === "identity-array" || fault === "counter-array") metadata.put(Object.assign([], value));
    else if (fault === "counter-number") metadata.put({ ...value, lastReserved: 1 });
    else if (fault === "counter-empty") metadata.put({ ...value, lastReserved: "" });
    else if (fault === "counter-leading-zero") metadata.put({ ...value, lastReserved: "01" });
    else if (fault === "counter-negative") metadata.put({ ...value, lastReserved: "-1" });
    else if (fault === "counter-fraction") metadata.put({ ...value, lastReserved: "1.5" });
    else throw new Error("Unsupported native metadata fault");
   };
  });
 },
 async metadataShapeEvidence() {
  const db = await nativeDatabase();
  try { return await new Promise<unknown>((resolve, reject) => {
   const tx = db.transaction("scope-metadata", "readonly"), request = tx.objectStore("scope-metadata").getAll();
   let evidence: unknown;
   request.onsuccess = () => { evidence = request.result.map(value => ({ array: Array.isArray(value), keys: Object.keys(value), fields: Object.entries(value) })); };
   tx.oncomplete = () => resolve(evidence); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
 },
 async setMaximumCounter() { await fixtureWrite(tx => { tx.objectStore("scope-metadata").put({ key: "counter", lastReserved: "18446744073709551615" }); }); },
 async schemaFault(fault: "keypath" | "array-keypath" | "out-of-line" | "autoincrement" | "index" | "missing-store" | "extra-store") {
  const previous = subjectPhase; subjectPhase = false;
  const db = await nativeDatabase(), name = db.name;
  const contents: Record<string, readonly unknown[]> = {};
  try {
   for (const storeName of Array.from(db.objectStoreNames)) contents[storeName] = await new Promise<readonly unknown[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly"), request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
   });
  } finally { db.close(); }
  try {
   await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(name); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error("Fixture schema replacement unexpectedly blocked")); });
   await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = () => {
     const keys = { "scope-metadata": "key", projects: "projectId", revisions: "revisionId", staging: "attemptId", "writer-fences": "projectId", "publication-attempts": "attemptId", "pin-staging-leases": "leaseId", resources: "resourceHash", library: "resourceHash" };
     for (const [storeName, keyPath] of Object.entries(keys)) {
      if (storeName === "library" && fault === "missing-store") continue;
      const options = storeName !== "library" ? { keyPath } : fault === "keypath" ? { keyPath: "wrongHash" } : fault === "array-keypath" ? { keyPath: [keyPath] } : fault === "out-of-line" ? {} : { keyPath, autoIncrement: fault === "autoincrement" };
      const store = request.result.createObjectStore(storeName, options);
      if (storeName === "library" && fault === "index") store.createIndex("unexpected", keyPath);
      for (const value of contents[storeName] ?? []) store.put(value);
     }
     if (fault === "extra-store") request.result.createObjectStore("unexpected");
    };
    request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error);
   });
  } finally { subjectPhase = previous; }
 },
 async replaceRows(values: Record<string, readonly unknown[]>) { await fixtureWrite(tx => { for (const [name, records] of Object.entries(values)) { const store = tx.objectStore(name); store.clear(); for (const record of records) store.put(record); } }); },
 async removeResource(hash: string) { await fixtureWrite(tx => { tx.objectStore("resources").delete(hash); }); },
 async corruptResource(hash: string) { await fixtureWrite(tx => { const store = tx.objectStore("resources"), request = store.get(hash); request.onsuccess = () => { const value = row(request.result); store.put({ ...value, blob: new Blob([new Uint8Array(Number(value.byteLength)).fill(99)]) }); }; }); },
 async corruptResourceRoots(hash: string, mode: "sparse" | "extra") {
  await fixtureWrite(tx => {
   const resources = tx.objectStore("resources"), request = resources.get(hash);
   request.onsuccess = () => {
    const value = row(request.result), roots = mode === "sparse" ? Array<unknown>(1) : [String(value.creationLeaseId)];
    if (mode === "extra") Object.defineProperty(roots, "extra", { value: value.creationLeaseId, enumerable: true });
    resources.put({ ...value, roots, durable: false });
   };
  });
 },
 async resourceRootsShape(hash: string) {
  const db = await nativeDatabase();
  try { return await new Promise<{ length: number; keys: string[]; hasZero: boolean }>((resolve, reject) => {
   const tx = db.transaction("resources", "readonly"), request = tx.objectStore("resources").get(hash);
   let result: { length: number; keys: string[]; hasZero: boolean };
   request.onsuccess = () => { const roots = row(request.result).roots; if (!Array.isArray(roots)) throw new Error("No actual native roots array"); result = { length: roots.length, keys: Object.keys(roots), hasZero: Object.hasOwn(roots, 0) }; };
   tx.oncomplete = () => resolve(result); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
 },
 tamper, rows,
 modes() { return [...transactions]; },
 upgrades() { return [...upgrades]; },
 signal() { return reader?.signal.aborted; },
 holdChecksum() { let release: () => void = () => undefined; const wait = new Promise<void>(resolve => { release = resolve; }); checksumHold = { entered: false, release, wait }; },
 checksumEntered() { return checksumHold?.entered ?? false; },
 releaseChecksum() { const hold = checksumHold; checksumHold = undefined; hold?.release(); },
 startExport(projectId: string, revisionId: string) { operation = { status: "pending" }; const current = operation; void harness.export(projectId, revisionId).then(value => { current.status = "fulfilled"; current.value = value; }, () => { current.status = "rejected"; }); },
 startFileExport(projectId: string, revisionId: string) {
  fileCancellation = new AbortController(); operation = { status: "pending" }; const current = operation;
  void harness.export(projectId, revisionId, fileCancellation.signal).then(value => { current.status = "fulfilled"; current.value = value; }, () => { current.status = "rejected"; });
 },
 abortFileExport() { if (!fileCancellation) throw new Error("No current file export"); fileCancellation.abort(); },
 startList() { if (!reader) throw new Error("No readonly reader"); operation = { status: "pending" }; const current = operation; void reader.listProjects().then(value => { current.status = "fulfilled"; current.value = value; }, () => { current.status = "rejected"; }); },
 operation() { return operation; },
 async holdLock() {
  const scope = await verifiedReadonlyTestScope(); let entered: () => void = () => undefined;
  const granted = new Promise<void>(resolve => { entered = resolve; });
  lockCompletion = navigator.locks.request(`interiors-tma-storage-v1:${scope}`, async () => { entered(); await new Promise<void>(resolve => { lockRelease = resolve; }); });
  await granted;
 },
 async readerLockQueued() {
  const scope = await verifiedReadonlyTestScope(), state = await navigator.locks.query();
  return state.pending?.some(lock => lock.name === `interiors-tma-storage-v1:${scope}`) ?? false;
 },
 async releaseLock() { lockRelease?.(); await lockCompletion; },
 openHeld() { return !!openHold; },
 releaseOpen() { openHold?.(); },
 lateHandleClosed() { return lateHandleClosed; },
 async abortMetadataRead() {
  if (!reader) throw new Error("No readonly reader"); abortDuringMetadata = true;
  const result = await reader.listProjects().then(() => "fulfilled", () => "rejected");
  await reader.dispose(); return { result, lifecycle: [...lifecycle], aborted: reader.signal.aborted, transactions: [...transactions] };
 },
 async databases() { const scope = await verifiedReadonlyTestScope(); return (await indexedDB.databases()).filter(value => value.name === `interiors-editor-projects:${scope}`); },
 async blockDeletion() {
  deletionBlocker = await nativeDatabase(); const name = deletionBlocker.name;
  let blocked: () => void = () => undefined;
  const observed = new Promise<void>(resolve => { blocked = resolve; });
  const request = indexedDB.deleteDatabase(name);
  deletionCompletion = new Promise<void>((resolve, reject) => { request.onblocked = () => blocked(); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  await observed;
 },
 async releaseDeletion() { deletionBlocker?.close(); deletionBlocker = undefined; await deletionCompletion; },
 async version(version: number) {
  const previous = subjectPhase; subjectPhase = false; const scope = await verifiedReadonlyTestScope();
  try { return await new Promise<number>((resolve, reject) => { const request = indexedDB.open(`interiors-editor-projects:${scope}`, version); request.onsuccess = () => { const db = request.result; const actual = db.version; db.close(); resolve(actual); }; request.onerror = () => reject(request.error); }); }
  finally { subjectPhase = previous; }
 },
 async dispose() { if (reader) await reader.dispose(); return { aborted: reader?.signal.aborted }; },
 handleLifetime() { return { opened: openedReaderHandles.length, unclosed: openedReaderHandles.filter(value => !value.closeCalled).length }; },
 loaded() { return window.__telegramReadonlySubjects; },
};
declare global {
 interface Window {
  __telegramReadonlySource: typeof harness;
  __telegramReadonlySubjects?: Readonly<Record<string, { readonly sha: string; readonly instrumented: boolean; readonly localIDs: readonly string[]; readActive(): string | null }>>;
 }
}
window.__telegramReadonlySource = harness;
