import type { ChecksumPort, PublicationCandidate, UnverifiedProjectSource } from "../../application/ports";
import { canonicalProjectSerializer } from "../../application/create-project";
import { alphaBackupFeasibilityLimits } from "../../application/backup-feasibility-policy";
import { validateRuntimeV1Project, validateTelegramRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import { projectUsesInteriorDetails } from "../../domain/interior-project-format";
import { isStructurallyValidProjectV1, isStructurallyValidTelegramProject } from "../../domain/project-json-transfer";
import { encodeRegisteredRuntimeProject } from "../portable-backup/runtime-v1-wire";

export interface TelegramReadonlyProjectSnapshot {
 readonly scope: string;
 readonly projectId: string;
 readonly pointer: unknown;
 readonly revision: unknown;
 readonly creation: unknown;
}
export interface TelegramReadonlyResourceDescriptor {
 readonly resourceHash: string;
 readonly byteLength: number;
}
export interface TelegramReadonlyResourceRow extends TelegramReadonlyResourceDescriptor {
 readonly scope: string;
 readonly blob: Blob;
 readonly version: string;
 readonly creationLeaseId: string;
 readonly roots: readonly string[];
 readonly durable: boolean;
}
export interface VerifiedTelegramReadonlyProject {
 readonly candidate: PublicationCandidate;
 readonly resourceManifest: readonly TelegramReadonlyResourceDescriptor[];
}

/** Pure record checks over an owned native snapshot; never storage or release admission. */
export function readUnverifiedTelegramSnapshot(
 input: TelegramReadonlyProjectSnapshot,
 expectedRevisionId: string,
): UnverifiedProjectSource | undefined {
 const { pointer, revision, scope, projectId } = input;
 if (!record(pointer) || pointer.scope !== scope || pointer.projectId !== projectId || pointer.currentRevisionId !== expectedRevisionId || typeof pointer.currentRevisionId !== "string") return undefined;
 if (!record(revision) || revision.scope !== scope || revision.projectId !== projectId || revision.revisionId !== pointer.currentRevisionId || !record(revision.candidate)) return undefined;
 const { project, revision: source } = revision.candidate;
 if (!record(project) || project.projectId !== projectId || !record(source) || source.projectId !== projectId || source.revisionId !== pointer.currentRevisionId || typeof source.serializedProject !== "string") return undefined;
 return { kind: "unverified-source", projectId, revisionId: pointer.currentRevisionId, serializedProject: source.serializedProject };
}

/** Same current-Revision/creation-receipt acceptance as the scoped repository, without a writer. */
export async function verifyTelegramReadonlyCurrentSnapshot(
 input: TelegramReadonlyProjectSnapshot,
 checksum: ChecksumPort,
 databaseVersion = 4,
): Promise<VerifiedTelegramReadonlyProject | undefined> {
 try {
  const extended = databaseVersion === 5 || databaseVersion === 6;
  const validate = extended ? validateTelegramRuntimeV1Project : validateRuntimeV1Project;
  const { scope, projectId, pointer, revision, creation } = input;
  if (!record(pointer) || Object.keys(pointer).length !== 4 || pointer.scope !== scope || pointer.projectId !== projectId || typeof pointer.currentRevisionId !== "string") return undefined;
  if (!record(revision) || Object.keys(revision).length !== 6 || !isV1Candidate(revision.candidate, extended)) return undefined;
  const candidate = revision.candidate;
  if (projectUsesInteriorDetails(candidate.project) && databaseVersion !== 6) return undefined;
  if (revision.scope !== scope || revision.projectId !== projectId || revision.revisionId !== pointer.currentRevisionId || typeof revision.creationAttemptId !== "string" || candidate.project.projectId !== projectId || candidate.revision.projectId !== projectId || candidate.revision.revisionId !== pointer.currentRevisionId || pointer.name !== candidate.project.name) return undefined;
  // Bound the derived manifest through the existing closed grammar and policy before walking metadata arrays.
  if (encodeRegisteredRuntimeProject(candidate.project).kind !== "encoded" || validate(candidate.project).kind !== "accepted") return undefined;
  const resourceManifest = manifestFor(candidate);
  if (!exactManifest(revision.resourceManifest, resourceManifest) || !record(creation) || !exactManifest(creation.resourceManifest, resourceManifest)) return undefined;
  if (!publishedCreation(creation, scope) || creation.attemptId !== revision.creationAttemptId || creation.projectId !== projectId || creation.revisionId !== pointer.currentRevisionId || creation.intent !== "mutation" || creation.checksum !== candidate.revision.checksum || creation.serializedProject !== candidate.revision.serializedProject || !sameTelegramReadonlySnapshot(creation.resourceManifest, resourceManifest)) return undefined;
  if (canonicalProjectSerializer.serialize(candidate.project) !== candidate.revision.serializedProject || await checksum.sha256(candidate.revision.serializedProject) !== candidate.revision.checksum) return undefined;
  return { candidate, resourceManifest };
 } catch {
  // Lack of proof keeps the independent original-source capability unverified.
  return undefined;
 }
}

/** Metadata only: Blob bytes and GLB/hash policy still require independent verification. */
export function readTelegramReadonlyResourceRow(
 scope: string,
 expected: TelegramReadonlyResourceDescriptor,
 value: unknown,
): TelegramReadonlyResourceRow | undefined {
 const prefix = operationPrefix(scope, "lease");
 if (!record(value) || Object.keys(value).length !== 8 || value.scope !== scope || value.resourceHash !== expected.resourceHash || !hash(value.resourceHash) || value.byteLength !== expected.byteLength || !Number.isSafeInteger(value.byteLength) || typeof value.byteLength !== "number" || value.byteLength <= 0 || value.byteLength > alphaBackupFeasibilityLimits.maxResourceBytesPerEntry || !(value.blob instanceof Blob) || value.blob.size !== value.byteLength || typeof value.version !== "string" || !value.version.startsWith(prefix) || typeof value.creationLeaseId !== "string" || !value.creationLeaseId.startsWith(prefix) || !leaseRoots(value.roots, prefix) || typeof value.durable !== "boolean" || (!value.durable && value.roots.length === 0)) return undefined;
 return { scope, resourceHash: value.resourceHash, byteLength: value.byteLength, blob: value.blob, version: value.version, creationLeaseId: value.creationLeaseId, roots: value.roots, durable: value.durable };
}

/** Preserves own undefined, array keys and signed zero; never JSON-normalizes a snapshot. */
export function sameTelegramReadonlySnapshot(left: unknown, right: unknown, depth = 0): boolean {
 if (Object.is(left, right)) return true;
 if (depth > 128 || !left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
 if (Array.isArray(left) && Array.isArray(right) && left.length !== right.length) return false;
 const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
 const keys = Object.keys(a);
 return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameTelegramReadonlySnapshot(a[key], b[key], depth + 1));
}

function leaseRoots(value: unknown, prefix: string): value is readonly string[] {
 if (!Array.isArray(value)) return false;
 // Enumerate actual own keys, never allocate or walk a corrupt sparse length.
 const keys = Object.keys(value);
 return keys.length === value.length && keys.every((key, index) => key === String(index) && typeof value[index] === "string" && value[index].startsWith(prefix)) && new Set(value).size === value.length;
}
function exactManifest(value: unknown, expected: readonly TelegramReadonlyResourceDescriptor[]): boolean {
 // expected is bounded by the existing Project policy. A corrupt sparse length
 // is rejected before enumeration or iteration; no length-based allocation.
 if (!Array.isArray(value) || value.length !== expected.length) return false;
 return Object.keys(value).length === expected.length && expected.every((_entry, index) => Object.hasOwn(value, index)) && sameTelegramReadonlySnapshot(value, expected);
}
function record(value: unknown): value is Record<string, unknown> {
 return !!value && typeof value === "object" && !Array.isArray(value);
}
function hash(value: unknown): value is string {
 return typeof value === "string" && /^[a-fA-F0-9]{64}$/.test(value);
}
function operationPrefix(scope: string, kind: "attempt" | "lease") { return `tma-v1:${scope}:${kind}:`; }
function isV1Candidate(value: unknown, extended: boolean): value is PublicationCandidate {
 const validate = extended ? isStructurallyValidTelegramProject : isStructurallyValidProjectV1;
 return record(value) && validate(value.project) && record(value.revision) && value.revision.schemaVersion === 1 && typeof value.revision.projectId === "string" && typeof value.revision.revisionId === "string" && value.revision.revisionId.length > 0 && typeof value.revision.createdAt === "string" && typeof value.revision.serializedProject === "string" && typeof value.revision.checksum === "string";
}
function manifestFor(candidate: PublicationCandidate): readonly TelegramReadonlyResourceDescriptor[] {
 const resources = new Map<string, number>();
 for (const definition of candidate.project.assetDefinitionRefs) {
  if (!hash(definition.resourceHash) || !Number.isSafeInteger(definition.byteLength) || definition.byteLength <= 0 || definition.byteLength > alphaBackupFeasibilityLimits.maxResourceBytesPerEntry || (resources.has(definition.resourceHash) && resources.get(definition.resourceHash) !== definition.byteLength)) throw new Error("Invalid readonly resource manifest");
  resources.set(definition.resourceHash, definition.byteLength);
 }
 if (resources.size > alphaBackupFeasibilityLimits.maxResourceEntries || [...resources.values()].reduce((sum, value) => sum + value, 0) > alphaBackupFeasibilityLimits.maxResourceBytes) throw new Error("Readonly resource envelope exceeded");
 return [...resources].sort(([a], [b]) => a.localeCompare(b)).map(([resourceHash, byteLength]) => ({ resourceHash, byteLength }));
}
function publishedCreation(value: unknown, scope: string): value is Record<string, unknown> {
 const required = ["protocolVersion", "scope", "projectId", "attemptId", "ownerId", "fencingToken", "expectedBaseRevisionId", "revisionId", "checksum", "serializedProject", "resourceManifest", "intent", "state"];
 const allowed = new Set([...required, "leaseId", "receipt"]);
 if (!record(value) || !required.every(key => Object.hasOwn(value, key)) || !Object.keys(value).every(key => allowed.has(key)) || value.protocolVersion !== 1 || value.scope !== scope || typeof value.projectId !== "string" || typeof value.attemptId !== "string" || !value.attemptId.startsWith(operationPrefix(scope, "attempt")) || typeof value.ownerId !== "string" || typeof value.fencingToken !== "number" || !Number.isSafeInteger(value.fencingToken) || value.fencingToken <= 0 || !(value.expectedBaseRevisionId === null || typeof value.expectedBaseRevisionId === "string") || typeof value.revisionId !== "string" || typeof value.checksum !== "string" || typeof value.serializedProject !== "string" || !Array.isArray(value.resourceManifest) || !value.resourceManifest.every(entry => record(entry) && Object.keys(entry).length === 2 && hash(entry.resourceHash) && typeof entry.byteLength === "number" && Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0 && entry.byteLength <= alphaBackupFeasibilityLimits.maxResourceBytesPerEntry) || value.intent !== "mutation" || value.state !== "published" || !Object.hasOwn(value, "receipt") || (Object.hasOwn(value, "leaseId") && (typeof value.leaseId !== "string" || !value.leaseId.startsWith(operationPrefix(scope, "lease"))))) return false;
 return sameTelegramReadonlySnapshot(value.receipt, { revisionId: value.revisionId, checksum: value.checksum, resourceManifest: value.resourceManifest });
}
