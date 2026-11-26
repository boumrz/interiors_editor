import { zipSync } from 'fflate';
import type { BinaryChecksumPort } from '../../application/ports';
import { alphaBackupFeasibilityLimits } from '../../application/backup-feasibility-policy';
import { parsePpjA1JsonBytes } from '../../domain/ppj-a1-lossless-json';
import { containsLoneSurrogate, decodeRuntimeV1Utf16, encodeRuntimeV1Utf16, scanRuntimeV1Json, type RuntimeV1Node } from './runtime-v1-raw-scanner';
import { decodeRuntimeV1LegacyProject, decodeRegisteredRuntimeV1Project, encodeRegisteredRuntimeProject,
  isRegisteredRuntimeV1SchemaId, RUNTIME_V1_DOOR_HINGE_SCHEMA_ID, RUNTIME_V1_FLOOR_YAW_SCHEMA_ID, RUNTIME_V1_INTERIOR_SCHEMA_ID,
  RUNTIME_V1_ROOM_LAYOUTS_SCHEMA_ID, RUNTIME_V1_WALL_COLORS_SCHEMA_ID, type RuntimeV1Project } from './runtime-v1-wire';
import { readPpjA1ZipCentralDirectory } from './ppj-a1-zip-central-directory';
import type { PpjA1ArchiveEntry } from './ppj-a1-canonical-project-member-ingress';

const PPJ = 'interiors.project/alpha-1';
const PROJECT = 'project/project.json';
const CORE = ['manifest.json', 'checksums.json', PROJECT];
const MANIFEST_KEYS = ['backupFormat', 'backupFormatVersion', 'canonicalProjectPath', 'complete', 'createdAt', 'entries', 'projectSchemaId', 'projectSchemaVersion', 'requiredCapabilities', 'resources', 'sourceProjectId'];
const MAXIMUM_CONTROL_BYTES = 1024 * 1024;
const MAXIMUM_CONTAINER_BYTES = 200 * 1024 * 1024;
const MAXIMUM_DEFINITIONS = 100;
const hex = /^[a-fA-F0-9]{64}$/;
const lowerHex = /^[a-f0-9]{64}$/;
const pathPattern = /^(?:manifest\.json|checksums\.json|project\/project\.json|catalog\/[a-f0-9]{64}\.(?:asset|texture)|custom\/[a-f0-9]{64}\.glb)$/;
const customPattern = /^custom\/([a-f0-9]{64})\.glb$/;
const utf8 = new TextEncoder();

export type RuntimePortableResource = { readonly resourceHash: string; readonly bytes: Uint8Array };
export type RuntimePortableRejection = { readonly kind: 'rejected'; readonly reasonCode: 'BACKUP_SCHEMA_UNREADABLE' | 'BACKUP_PROJECT_LIMIT' | 'BACKUP_PATH_UNSAFE' | 'BACKUP_MANIFEST_INVALID' | 'BACKUP_CHECKSUM_MISMATCH' | 'BACKUP_RESOURCE_MISSING' | 'BACKUP_CANCELLED' | 'BACKUP_CONTAINER_UNSUPPORTED' | 'BACKUP_CONTAINER_BYTES_LIMIT' | 'BACKUP_ENTRY_LIMIT' | 'BACKUP_UNPACKED_BYTES_LIMIT' | 'BACKUP_COMPRESSION_RATIO' };
export type RuntimePortableProjectValidation<TDomainReason extends string = string> = { readonly kind: 'accepted' } | { readonly kind: 'rejected'; readonly reasonCode: TDomainReason };
export type RuntimePortableProjectValidator<TDomainReason extends string = string> = (project: RuntimeV1Project, signal: AbortSignal | undefined) => RuntimePortableProjectValidation<TDomainReason> | Promise<RuntimePortableProjectValidation<TDomainReason>>;
export type RuntimePortableDomainRejection<TDomainReason extends string = string> = { readonly kind: 'project-validation-rejected'; readonly reasonCode: TDomainReason };
export type RuntimePortableSelectorHeader = { readonly sourceProjectId: string; readonly projectSchemaId: string; readonly projectSchemaVersion: number };
export type RuntimePortableMetadata = RuntimePortableSelectorHeader & { readonly createdAt: string };
/** Each read returns an independent copy; callers cannot modify the retained source snapshot. */
export type RuntimePortableByteSnapshot = { readonly byteLength: number; readonly read: () => Uint8Array };
export type RuntimePpjValidationHandoff = {
  readonly kind: 'requires-ppj-validation'; readonly stage: 'candidate'; readonly checksumVerified: false;
  readonly checkedStages: readonly ('container-index' | 'raw-paths' | 'bounded-control-json' | 'common-selector-header')[];
  readonly remainingChecks: readonly string[];
  readonly archive: RuntimePortableByteSnapshot; readonly manifest?: RuntimePortableByteSnapshot; readonly checksumLedger?: RuntimePortableByteSnapshot;
  readonly controlEntries: { readonly manifest: { readonly path: 'manifest.json'; readonly declaredByteLength: number }; readonly checksumLedger: { readonly path: 'checksums.json'; readonly declaredByteLength: number } };
  readonly declaredProjectByteLength: number; readonly metadata?: RuntimePortableSelectorHeader;
};
export type RuntimePortableEncodeInput = { readonly project: unknown; readonly createdAt: string; readonly resources: readonly RuntimePortableResource[] };
export type RuntimePortableEncodeResult<TDomainReason extends string = string> = { readonly kind: 'encoded'; readonly bytes: Uint8Array; readonly mimeType: 'application/zip'; readonly metadata: RuntimePortableMetadata } | RuntimePortableRejection | RuntimePortableDomainRejection<TDomainReason>;
export type RuntimePortableDecodeResult<TDomainReason extends string = string> = { readonly kind: 'decoded'; readonly schema: 'runtime-v1-wire' | 'runtime-v1-floor-yaw' | 'runtime-v1-door-hinge' | 'runtime-v1-room-layouts' | 'runtime-v1-interior-details' | 'runtime-v1-wall-colors' | 'runtime-v1-legacy'; readonly decodedProject: RuntimeV1Project; readonly projectBytes: Uint8Array; readonly resources: readonly RuntimePortableResource[]; readonly metadata: RuntimePortableMetadata } | RuntimePortableRejection | RuntimePortableDomainRejection<TDomainReason> | RuntimePpjValidationHandoff;
type ObjectNode = Extract<RuntimeV1Node, { readonly kind: 'object' }>;
type ManifestEntry = { readonly byteLength: number; readonly path: string; readonly mediaType: string; readonly sha256: string };
type ResourceMapping = { readonly path: string; readonly resourceHash: string };
type Manifest = RuntimePortableMetadata & { readonly entries: readonly ManifestEntry[]; readonly resources: readonly ResourceMapping[] };
class EnvelopeFault extends Error {
  constructor(readonly reasonCode: RuntimePortableRejection['reasonCode']) { super(reasonCode); }
}
function fail(code: RuntimePortableRejection['reasonCode']): never { throw new EnvelopeFault(code); }
const checkCancelled = (signal: AbortSignal | undefined): void => { if (signal?.aborted) fail('BACKUP_CANCELLED'); };
const ordinal = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);
const json = (value: unknown): Uint8Array => utf8.encode(JSON.stringify(value));
const sourceString = (value: string): string | { readonly utf16be: string } => containsLoneSurrogate(value) ? { utf16be: encodeRuntimeV1Utf16(value) } : value;
function snapshot(bytes: Uint8Array): RuntimePortableByteSnapshot { return Object.freeze({ byteLength: bytes.length, read: () => bytes.slice() }); }
function rejected(error: unknown): RuntimePortableRejection {
  if (error instanceof EnvelopeFault) return { kind: 'rejected', reasonCode: error.reasonCode };
  throw error; // Do not relabel trusted validator/checksum implementation failures as corrupt user files.
}

/** A separate codec: no old port implementation, storage writes, IDs, pins, or publication. */
export class RuntimePortableBackupCodec<TDomainReason extends string = string> {
  constructor(private readonly checksum: BinaryChecksumPort, private readonly validateProject: RuntimePortableProjectValidator<TDomainReason>,
    private readonly allowTelegramExtendedSchemas = false) {}

  private admitsSchema(schemaId: string): boolean {
    return this.allowTelegramExtendedSchemas || schemaId !== RUNTIME_V1_INTERIOR_SCHEMA_ID &&
      schemaId !== RUNTIME_V1_ROOM_LAYOUTS_SCHEMA_ID && schemaId !== RUNTIME_V1_WALL_COLORS_SCHEMA_ID;
  }

  async encode(input: RuntimePortableEncodeInput, signal?: AbortSignal): Promise<RuntimePortableEncodeResult<TDomainReason>> {
    try {
      checkCancelled(signal);
      const backupCreatedAt = input.createdAt;
      const encoded = encodeRegisteredRuntimeProject(input.project);
      if (encoded.kind === 'rejected') return encoded;
      const { projectSchemaId } = encoded;
      if (!this.admitsSchema(projectSchemaId)) fail('BACKUP_SCHEMA_UNREADABLE');
      const decoded = decodeRegisteredRuntimeV1Project(encoded.bytes, projectSchemaId);
      if (decoded.kind === 'rejected') return decoded;
      const project = decoded.project;
      if (!iso(backupCreatedAt)) fail('BACKUP_MANIFEST_INVALID');
      checkProjectPolicy(project);
      // Snapshot resource input before the first asynchronous callback, within source-owned byte caps.
      const copied = copySourceResources(input.resources);
      const validation = await this.validateProject(project, signal);
      checkCancelled(signal);
      if (validation.kind === 'rejected') return { kind: 'project-validation-rejected', reasonCode: validation.reasonCode };
      const verified = await this.verifySourceResources(project, copied, signal);
      const projectHash = await this.digest(encoded.bytes, signal);
      const entries: ManifestEntry[] = [{ byteLength: encoded.bytes.length, mediaType: 'application/json', path: PROJECT, sha256: projectHash }];
      const archiveEntries: Record<string, Uint8Array> = {};
      for (const resource of verified.unique) {
        const path = `custom/${resource.resourceHash}.glb`;
        entries.push({ byteLength: resource.bytes.length, mediaType: 'model/gltf-binary', path, sha256: resource.resourceHash });
        archiveEntries[path] = resource.bytes;
      }
      const metadata = { sourceProjectId: project.projectId, createdAt: backupCreatedAt, projectSchemaId, projectSchemaVersion: 1 };
      const manifestBytes = json({ backupFormat: 'interiors-portable-backup', backupFormatVersion: 1, canonicalProjectPath: PROJECT, complete: true,
        createdAt: backupCreatedAt, entries, projectSchemaId, projectSchemaVersion: 1, requiredCapabilities: [],
        resources: verified.mappings, sourceProjectId: sourceString(project.projectId) });
      const ledgerBytes = json({ algorithm: 'sha-256', entries: entries.map(({ path, sha256 }) => ({ path, sha256 })) });
      if (manifestBytes.length > MAXIMUM_CONTROL_BYTES || ledgerBytes.length > MAXIMUM_CONTROL_BYTES) fail('BACKUP_PROJECT_LIMIT');
      const files = { 'manifest.json': manifestBytes, 'checksums.json': ledgerBytes, [PROJECT]: encoded.bytes, ...archiveEntries };
      const unpacked = Object.values(files).reduce((sum, bytes) => sum + bytes.length, 0);
      const exactStoreBytes = 22 + Object.entries(files).reduce((sum, [path, bytes]) => sum + 76 + 2 * path.length + bytes.length, 0);
      if (unpacked > alphaBackupFeasibilityLimits.maxUnpackedBytes || exactStoreBytes > alphaBackupFeasibilityLimits.maxContainerBytes) fail('BACKUP_PROJECT_LIMIT');
      checkCancelled(signal);
      // Fixed local DOS date; all names are ASCII, lengths/CRC known, no extra/comment/descriptor/ZIP64.
      const bytes = zipSync(files, { level: 0, os: 0, attrs: 0, mtime: new Date(1980, 0, 1) });
      if (bytes.length !== exactStoreBytes) fail('BACKUP_CONTAINER_UNSUPPORTED');
      checkCancelled(signal);
      return { kind: 'encoded', bytes, mimeType: 'application/zip', metadata };
    } catch (error) { return rejected(error); }
  }

  async decode(archive: Uint8Array, signal?: AbortSignal): Promise<RuntimePortableDecodeResult<TDomainReason>> {
    try {
      checkCancelled(signal);
      if (archive.length > MAXIMUM_CONTAINER_BYTES) fail('BACKUP_CONTAINER_BYTES_LIMIT');
      const ownedArchive = archive.slice();
      const indexed = readPpjA1ZipCentralDirectory(ownedArchive);
      if (indexed.kind === 'rejected') return indexed;
      const paths = new Map<string, PpjA1ArchiveEntry>();
      for (const entry of indexed.entries) {
        const path = asciiPath(entry.rawName);
        if (!path || !pathPattern.test(path) || paths.has(path)) fail('BACKUP_PATH_UNSAFE');
        paths.set(path, entry);
      }
      if (!CORE.every(path => paths.has(path))) fail('BACKUP_MANIFEST_INVALID');
      const manifestEntry = paths.get('manifest.json'); const ledgerEntry = paths.get('checksums.json'); const projectEntry = paths.get(PROJECT);
      if (!manifestEntry || !ledgerEntry || !projectEntry) fail('BACKUP_MANIFEST_INVALID');
      const controlEntries = { manifest: { path: 'manifest.json' as const, declaredByteLength: manifestEntry.declaredByteLength }, checksumLedger: { path: 'checksums.json' as const, declaredByteLength: ledgerEntry.declaredByteLength } };
      // The manifest hard byte limit is common. PPJ control structural limits and a separate ledger byte cap are not registered.
      if (manifestEntry.declaredByteLength > MAXIMUM_CONTROL_BYTES) fail('BACKUP_MANIFEST_INVALID');
      const manifestBytes = await readEntry(manifestEntry, MAXIMUM_CONTROL_BYTES, 'BACKUP_MANIFEST_INVALID', signal);
      const manifestNode = controlValue(manifestBytes);
      if (!manifestNode) return ppjHandoff(ownedArchive, manifestBytes, undefined, projectEntry, controlEntries);
      const manifestRoot = object(manifestNode);
      // A large tentative ledger is preserved without inflating it or inventing a PPJ control limit.
      if (ledgerEntry.declaredByteLength > MAXIMUM_CONTROL_BYTES) return ppjHandoff(ownedArchive, manifestBytes, undefined, projectEntry, controlEntries);
      const ledgerBytes = await readEntry(ledgerEntry, MAXIMUM_CONTROL_BYTES, 'BACKUP_MANIFEST_INVALID', signal);
      const ledgerRoot = controlValue(ledgerBytes);
      if (!ledgerRoot) return ppjHandoff(ownedArchive, manifestBytes, ledgerBytes, projectEntry, controlEntries);
      const header = selectorHeader(manifestRoot);
      let preview: Uint8Array | undefined;
      if (header.projectSchemaId === PPJ && header.projectSchemaVersion === 1) {
        // PPJ manifest/resource binding is explicitly unfinished in the source contract.
        // This bounded non-accepting peek can select only a candidate, never dispatch/accept it.
        if (projectEntry.declaredByteLength > alphaBackupFeasibilityLimits.maxProjectBytes) return ppjHandoff(ownedArchive, manifestBytes, ledgerBytes, projectEntry, controlEntries, header);
        preview = await readEntry(projectEntry, alphaBackupFeasibilityLimits.maxProjectBytes, 'BACKUP_PROJECT_LIMIT', signal);
        if (probeRootSelector(preview) !== 'absent') return ppjHandoff(ownedArchive, manifestBytes, ledgerBytes, projectEntry, controlEntries, header);
      }
      const wireSchema = header.projectSchemaVersion === 1 && this.admitsSchema(header.projectSchemaId) &&
        isRegisteredRuntimeV1SchemaId(header.projectSchemaId) ? header.projectSchemaId : undefined;
      const knownWire = wireSchema !== undefined;
      const knownLegacy = header.projectSchemaId === PPJ && header.projectSchemaVersion === 1;
      const manifest = parseManifest(manifestRoot, knownWire, knownLegacy);
      bindEnvelope(manifest, ledgerRoot, paths, knownWire || knownLegacy);
      if (projectEntry.declaredByteLength > alphaBackupFeasibilityLimits.maxProjectBytes) fail('BACKUP_PROJECT_LIMIT');
      const bytes = preview ?? await readEntry(projectEntry, alphaBackupFeasibilityLimits.maxProjectBytes, 'BACKUP_PROJECT_LIMIT', signal);
      const projectDeclaration = manifest.entries.find(entry => entry.path === PROJECT);
      if (!projectDeclaration) fail('BACKUP_MANIFEST_INVALID');
      if (await this.digest(bytes, signal) !== projectDeclaration.sha256) fail('BACKUP_CHECKSUM_MISMATCH');
      if (!knownWire && !knownLegacy) {
        const raw = parsePpjA1JsonBytes(bytes);
        if (raw.kind === 'rejected') return raw;
        fail('BACKUP_SCHEMA_UNREADABLE');
      }
      const decoded = wireSchema === undefined ? decodeRuntimeV1LegacyProject(bytes) : decodeRegisteredRuntimeV1Project(bytes, wireSchema);
      if (decoded.kind === 'rejected') return decoded;
      const project = decoded.project;
      if (project.projectId !== manifest.sourceProjectId) fail('BACKUP_SCHEMA_UNREADABLE');
      checkProjectPolicy(project);
      checkArchivePolicy(archive.length, indexed.entries, manifest);
      const validation = await this.validateProject(project, signal);
      checkCancelled(signal);
      if (validation.kind === 'rejected') return { kind: 'project-validation-rejected', reasonCode: validation.reasonCode };
      const resources = await this.readProjectResources(project, manifest, paths, signal);
      checkCancelled(signal);
      const schema = wireSchema === RUNTIME_V1_WALL_COLORS_SCHEMA_ID ? 'runtime-v1-wall-colors'
        : wireSchema === RUNTIME_V1_INTERIOR_SCHEMA_ID ? 'runtime-v1-interior-details'
        : wireSchema === RUNTIME_V1_ROOM_LAYOUTS_SCHEMA_ID ? 'runtime-v1-room-layouts'
        : wireSchema === RUNTIME_V1_DOOR_HINGE_SCHEMA_ID ? 'runtime-v1-door-hinge'
        : wireSchema === RUNTIME_V1_FLOOR_YAW_SCHEMA_ID ? 'runtime-v1-floor-yaw'
        : knownWire ? 'runtime-v1-wire' : 'runtime-v1-legacy';
      return { kind: 'decoded', schema, decodedProject: project, projectBytes: bytes, resources,
        metadata: { sourceProjectId: manifest.sourceProjectId, createdAt: manifest.createdAt, projectSchemaId: manifest.projectSchemaId, projectSchemaVersion: manifest.projectSchemaVersion } };
    } catch (error) { return rejected(error); }
  }

  private async digest(bytes: Uint8Array, signal: AbortSignal | undefined): Promise<string> {
    checkCancelled(signal);
    const digest = await this.checksum.sha256Bytes(bytes);
    checkCancelled(signal);
    if (!hex.test(digest)) fail('BACKUP_CHECKSUM_MISMATCH');
    return digest.toLowerCase();
  }

  private async verifySourceResources(project: RuntimeV1Project, resources: readonly RuntimePortableResource[], signal: AbortSignal | undefined): Promise<{ readonly unique: readonly RuntimePortableResource[]; readonly mappings: readonly ResourceMapping[] }> {
    const expected = new Map(project.assetDefinitionRefs.map(def => [def.resourceHash, def]));
    const provided = new Map<string, Uint8Array>();
    for (const resource of resources) {
      if (provided.has(resource.resourceHash)) fail('BACKUP_SCHEMA_UNREADABLE');
      provided.set(resource.resourceHash, resource.bytes);
    }
    if ([...expected.keys()].some(hash => !provided.has(hash))) fail('BACKUP_RESOURCE_MISSING');
    if (expected.size !== provided.size) fail('BACKUP_SCHEMA_UNREADABLE');
    const unique = new Map<string, Uint8Array>();
    const mappings: ResourceMapping[] = [];
    for (const [resourceHash, definition] of [...expected].sort(([a], [b]) => ordinal(a, b))) {
      const bytes = provided.get(resourceHash);
      if (!bytes || bytes.length !== definition.byteLength) fail('BACKUP_SCHEMA_UNREADABLE');
      const digest = await this.digest(bytes, signal);
      if (digest !== resourceHash.toLowerCase()) fail('BACKUP_CHECKSUM_MISMATCH');
      const alias = unique.get(digest);
      if (alias && !sameBytes(alias, bytes)) fail('BACKUP_CHECKSUM_MISMATCH');
      unique.set(digest, bytes);
      mappings.push({ path: `custom/${digest}.glb`, resourceHash });
    }
    return { unique: [...unique].sort(([a], [b]) => ordinal(a, b)).map(([resourceHash, bytes]) => ({ resourceHash, bytes })), mappings };
  }

  private async readProjectResources(project: RuntimeV1Project, manifest: Manifest, paths: ReadonlyMap<string, PpjA1ArchiveEntry>, signal: AbortSignal | undefined): Promise<readonly RuntimePortableResource[]> {
    const definitions = new Map(project.assetDefinitionRefs.map(def => [def.resourceHash, def]));
    if (manifest.resources.some(mapping => !definitions.has(mapping.resourceHash))) fail('BACKUP_SCHEMA_UNREADABLE');
    const mapped = new Set(manifest.resources.map(mapping => mapping.resourceHash));
    if ([...definitions.keys()].some(hash => !mapped.has(hash))) fail('BACKUP_RESOURCE_MISSING');
    const resources: RuntimePortableResource[] = [];
    for (const declaration of manifest.entries.filter(entry => entry.path !== PROJECT)) {
      const aliases = manifest.resources.filter(mapping => mapping.path === declaration.path);
      for (const alias of aliases) if (definitions.get(alias.resourceHash)?.byteLength !== declaration.byteLength) fail('BACKUP_SCHEMA_UNREADABLE');
      const bytes = await readEntry(paths.get(declaration.path), alphaBackupFeasibilityLimits.maxResourceBytesPerEntry, 'BACKUP_PROJECT_LIMIT', signal);
      if (await this.digest(bytes, signal) !== declaration.sha256) fail('BACKUP_CHECKSUM_MISMATCH');
      for (let i = 0; i < aliases.length; i++) resources.push({ resourceHash: aliases[i].resourceHash, bytes: i === 0 ? bytes : bytes.slice() });
    }
    return resources.sort((a, b) => ordinal(a.resourceHash, b.resourceHash));
  }
}

function controlValue(bytes: Uint8Array): RuntimeV1Node | undefined {
  const result = scanRuntimeV1Json(bytes, 'legacy');
  if (result.kind === 'rejected') return result.reasonCode === 'BACKUP_PROJECT_LIMIT' ? undefined : fail('BACKUP_MANIFEST_INVALID');
  return result.root;
}
function object(node: RuntimeV1Node | undefined, keys?: readonly string[]): ObjectNode {
  if (node?.kind !== 'object') return fail('BACKUP_MANIFEST_INVALID');
  if (keys && (node.members.size !== keys.length || keys.some(key => !node.members.has(key)))) return fail('BACKUP_MANIFEST_INVALID');
  return node;
}
function string(node: RuntimeV1Node | undefined): string {
  return node?.kind === 'string' ? node.value : fail('BACKUP_MANIFEST_INVALID');
}
function array(node: RuntimeV1Node | undefined): readonly RuntimeV1Node[] {
  return node?.kind === 'array' ? node.elements : fail('BACKUP_MANIFEST_INVALID');
}
function literal(node: RuntimeV1Node | undefined, expected: boolean | string): void {
  if (!(node?.kind === 'literal' && node.value === expected) && !(node?.kind === 'string' && node.value === expected)) fail('BACKUP_MANIFEST_INVALID');
}
/** Exact mathematical JSON integers; metadata aliases cannot round fractional/unsafe values into safe integers. */
function integer(node: RuntimeV1Node | undefined, minimum: number): number {
  if (node?.kind !== 'number') return fail('BACKUP_MANIFEST_INVALID');
  const parts = /^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(node.raw);
  if (!parts) return fail('BACKUP_MANIFEST_INVALID');
  let coefficient = BigInt(parts[2] + (parts[3] ?? ''));
  if (coefficient !== 0n) {
    const exponent = Number(parts[4] ?? '0') - (parts[3]?.length ?? 0);
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 64) return fail('BACKUP_MANIFEST_INVALID');
    if (exponent >= 0) coefficient *= 10n ** BigInt(exponent);
    else {
      const divisor = 10n ** BigInt(-exponent);
      if (coefficient % divisor !== 0n) return fail('BACKUP_MANIFEST_INVALID');
      coefficient /= divisor;
    }
  }
  if (parts[1]) coefficient = -coefficient;
  if (coefficient < BigInt(minimum) || coefficient > BigInt(Number.MAX_SAFE_INTEGER)) return fail('BACKUP_MANIFEST_INVALID');
  return Number(coefficient);
}
function v1String(node: RuntimeV1Node | undefined, wire: boolean): string {
  let value: string;
  if (node?.kind === 'string') {
    value = node.value;
    if (wire && containsLoneSurrogate(value)) return fail('BACKUP_MANIFEST_INVALID');
  } else {
    if (!wire) return fail('BACKUP_MANIFEST_INVALID');
    const wrapper = object(node, ['utf16be']);
    try { value = decodeRuntimeV1Utf16(string(wrapper.members.get('utf16be'))); }
    catch { return fail('BACKUP_MANIFEST_INVALID'); }
  }
  if (value.length < 1 || value.length > 256) return fail('BACKUP_MANIFEST_INVALID');
  return value;
}
function iso(value: string): boolean { const date = new Date(value); return Number.isFinite(date.getTime()) && date.toISOString() === value; }
function selectorHeader(root: ObjectNode): RuntimePortableSelectorHeader {
  literal(root.members.get('canonicalProjectPath'), PROJECT);
  const projectSchemaId = string(root.members.get('projectSchemaId'));
  if (!/^[!-~]{1,256}$/.test(projectSchemaId)) fail('BACKUP_MANIFEST_INVALID');
  const projectSchemaVersion = integer(root.members.get('projectSchemaVersion'), 1);
  const sourceProjectId = v1String(root.members.get('sourceProjectId'), isRegisteredRuntimeV1SchemaId(projectSchemaId));
  return { sourceProjectId, projectSchemaId, projectSchemaVersion };
}
function parseManifest(root: ObjectNode, wire: boolean, legacy: boolean): Manifest {
  const header = { ...selectorHeader(root), createdAt: string(root.members.get('createdAt')) };
  literal(root.members.get('backupFormat'), 'interiors-portable-backup');
  if (integer(root.members.get('backupFormatVersion'), 1) !== 1) fail('BACKUP_MANIFEST_INVALID');
  literal(root.members.get('complete'), true);
  if (wire || legacy) object(root, MANIFEST_KEYS);
  if ((wire || legacy) && (!iso(header.createdAt) || array(root.members.get('requiredCapabilities')).length !== 0)) fail('BACKUP_MANIFEST_INVALID');
  const entries = array(root.members.get('entries')).map(node => {
    const entry = object(node, ['byteLength', 'mediaType', 'path', 'sha256']);
    const path = string(entry.members.get('path')); const mediaType = string(entry.members.get('mediaType')); const sha256 = string(entry.members.get('sha256'));
    const byteLength = integer(entry.members.get('byteLength'), path === PROJECT ? 0 : 1);
    if (!lowerHex.test(sha256) || !pathPattern.test(path) || CORE.includes(path) && path !== PROJECT) fail('BACKUP_MANIFEST_INVALID');
    if (wire || legacy) {
      const digest = customPattern.exec(path)?.[1];
      if (path === PROJECT ? mediaType !== 'application/json' : !digest || mediaType !== 'model/gltf-binary' || sha256 !== digest) fail('BACKUP_MANIFEST_INVALID');
    }
    return { path, byteLength, mediaType, sha256 };
  });
  const resources = array(root.members.get('resources')).map(node => {
    const mapping = object(node, ['path', 'resourceHash']);
    const path = string(mapping.members.get('path')); const resourceHash = string(mapping.members.get('resourceHash'));
    if (!hex.test(resourceHash) || (legacy && !lowerHex.test(resourceHash)) || customPattern.exec(path)?.[1] !== resourceHash.toLowerCase()) fail('BACKUP_MANIFEST_INVALID');
    return { path, resourceHash };
  });
  if (new Set(entries.map(entry => entry.path)).size !== entries.length || new Set(resources.map(mapping => mapping.resourceHash)).size !== resources.length) fail('BACKUP_MANIFEST_INVALID');
  if (wire) {
    if (entries[0]?.path !== PROJECT || entries.slice(1).some((entry, i) => i > 0 && ordinal(entries[i].path, entry.path) >= 0)
      || resources.some((entry, i) => i > 0 && ordinal(resources[i - 1].resourceHash, entry.resourceHash) >= 0)) fail('BACKUP_MANIFEST_INVALID');
  }
  return { ...header, entries, resources };
}
function bindEnvelope(manifest: Manifest, ledgerNode: RuntimeV1Node, paths: ReadonlyMap<string, PpjA1ArchiveEntry>, v1: boolean): void {
  const ledgerRoot = object(ledgerNode, ['algorithm', 'entries']); literal(ledgerRoot.members.get('algorithm'), 'sha-256');
  const ledger = new Map<string, string>();
  for (const node of array(ledgerRoot.members.get('entries'))) {
    const item = object(node, ['path', 'sha256']); const path = string(item.members.get('path')); const sha = string(item.members.get('sha256'));
    if (!lowerHex.test(sha) || ledger.has(path)) fail('BACKUP_MANIFEST_INVALID');
    ledger.set(path, sha);
  }
  const declarations = new Map(manifest.entries.map(entry => [entry.path, entry]));
  for (const path of paths.keys()) if (!CORE.includes(path) && !declarations.has(path)) fail('BACKUP_PATH_UNSAFE');
  if (ledger.size !== declarations.size || !declarations.has(PROJECT)) fail('BACKUP_MANIFEST_INVALID');
  if (v1) {
    const resourcePaths = new Set(manifest.resources.map(mapping => mapping.path));
    if (resourcePaths.size !== declarations.size - 1) fail('BACKUP_MANIFEST_INVALID');
    for (const mapping of manifest.resources) if (!declarations.has(mapping.path)) fail('BACKUP_MANIFEST_INVALID');
  }
  for (const declaration of manifest.entries) {
    const entry = paths.get(declaration.path);
    if (ledger.get(declaration.path) !== declaration.sha256 || entry && entry.declaredByteLength !== declaration.byteLength) fail('BACKUP_MANIFEST_INVALID');
  }
  for (const declaration of manifest.entries) if (!paths.has(declaration.path)) fail(declaration.path === PROJECT ? 'BACKUP_MANIFEST_INVALID' : 'BACKUP_RESOURCE_MISSING');
  if (paths.size !== declarations.size + 2) fail('BACKUP_MANIFEST_INVALID');
}
function checkProjectPolicy(project: RuntimeV1Project): void {
  if (project.assetDefinitionRefs.length > MAXIMUM_DEFINITIONS) fail('BACKUP_PROJECT_LIMIT');
  let total = 0;
  for (const def of project.assetDefinitionRefs) {
    total += def.byteLength;
    if (def.byteLength > alphaBackupFeasibilityLimits.maxResourceBytesPerEntry || total > alphaBackupFeasibilityLimits.maxResourceBytes) fail('BACKUP_PROJECT_LIMIT');
  }
}
function checkArchivePolicy(length: number, entries: readonly PpjA1ArchiveEntry[], manifest: Manifest): void {
  if (length > alphaBackupFeasibilityLimits.maxContainerBytes || entries.reduce((sum, entry) => sum + entry.declaredByteLength, 0) > alphaBackupFeasibilityLimits.maxUnpackedBytes
    || manifest.entries.some(entry => entry.path !== PROJECT && entry.byteLength > alphaBackupFeasibilityLimits.maxResourceBytesPerEntry)) fail('BACKUP_PROJECT_LIMIT');
}
function copySourceResources(resources: readonly RuntimePortableResource[]): readonly RuntimePortableResource[] {
  if (resources.length > alphaBackupFeasibilityLimits.maxResourceEntries) fail('BACKUP_PROJECT_LIMIT');
  let total = 0;
  for (const resource of resources) {
    total += resource.bytes.length;
    if (resource.bytes.length > alphaBackupFeasibilityLimits.maxResourceBytesPerEntry || total > alphaBackupFeasibilityLimits.maxResourceBytes) fail('BACKUP_PROJECT_LIMIT');
  }
  return resources.map(resource => ({ resourceHash: resource.resourceHash, bytes: resource.bytes.slice() }));
}
function asciiPath(bytes: Uint8Array): string | undefined {
  let path = '';
  for (const byte of bytes) { if (byte < 0x21 || byte > 0x7e) return undefined; path += String.fromCharCode(byte); }
  return path || undefined;
}
async function readEntry(entry: PpjA1ArchiveEntry | undefined, maximum: number, overflow: RuntimePortableRejection['reasonCode'], signal: AbortSignal | undefined): Promise<Uint8Array> {
  if (!entry) return fail('BACKUP_MANIFEST_INVALID');
  if (entry.declaredByteLength > maximum) return fail(overflow);
  checkCancelled(signal);
  const opened = await entry.open(signal);
  if (opened.kind === 'rejected') return fail(opened.reasonCode);
  const chunks: Uint8Array[] = []; let length = 0; let failure: EnvelopeFault | undefined;
  try {
    for await (const chunk of opened.lease.chunks(signal)) {
      checkCancelled(signal);
      if (chunk.kind === 'rejected') return fail(chunk.reasonCode);
      length += chunk.bytes.length;
      if (length > maximum) return fail(overflow);
      if (length > entry.declaredByteLength) return fail('BACKUP_CONTAINER_UNSUPPORTED');
      chunks.push(chunk.bytes.slice());
    }
  } catch (error) { if (error instanceof EnvelopeFault) failure = error; else throw error; }
  finally {
    const closed = await opened.lease.close(signal);
    if (closed.kind === 'rejected' && !failure) failure = new EnvelopeFault(closed.reasonCode);
  }
  if (failure) throw failure;
  checkCancelled(signal);
  if (length !== entry.declaredByteLength) return fail('BACKUP_CONTAINER_UNSUPPORTED');
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
function ppjHandoff(archive: Uint8Array, manifest: Uint8Array | undefined, ledger: Uint8Array | undefined, projectEntry: PpjA1ArchiveEntry, controlEntries: RuntimePpjValidationHandoff['controlEntries'], metadata?: RuntimePortableSelectorHeader): RuntimePpjValidationHandoff {
  return { kind: 'requires-ppj-validation', stage: 'candidate', checksumVerified: false,
    checkedStages: metadata ? ['container-index', 'raw-paths', 'bounded-control-json', 'common-selector-header'] : ['container-index', 'raw-paths'],
    remainingChecks: [...(metadata ? [] : ['control-read-and-source-owned-bounds', 'bounded-control-json', 'common-selector-header', 'single-route-identification']),
      'full-ppj-manifest-and-ledger-bindings', 'project-size-and-expected-checksum', 'ppj-ast-r1', 'selector-and-source-identity', 'closed-ppj-project-and-limits', 'domain-and-host', 'resource-bindings-and-integrity', 'lossless-runtime-mapper'],
    archive: snapshot(archive), ...(manifest ? { manifest: snapshot(manifest) } : {}), ...(ledger ? { checksumLedger: snapshot(ledger) } : {}),
    declaredProjectByteLength: projectEntry.declaredByteLength, controlEntries, ...(metadata ? { metadata } : {}) };
}

/** Bounded byte lookahead only; no Project AST/model, schema acceptance or failure escapes this probe. */
function probeRootSelector(bytes: Uint8Array): 'absent' | 'present' | 'indeterminate' {
  let cursor = 0;
  const whitespace = () => { while ([9, 10, 13, 32].includes(bytes[cursor])) cursor++; };
  const quoted = (): boolean => {
    if (bytes[cursor++] !== 34) return false;
    while (cursor < bytes.length) {
      const byte = bytes[cursor++];
      if (byte === 34) return true;
      if (byte === 92) { if (cursor >= bytes.length) return false; cursor++; }
    }
    return false;
  };
  const key = (): string | undefined => {
    const start = cursor;
    if (!quoted()) return undefined;
    const token = bytes.subarray(start, cursor);
    if (token.length > 1024) return '';
    const scanned = scanRuntimeV1Json(token, 'legacy');
    return scanned.kind === 'scanned' && scanned.root.kind === 'string' ? scanned.root.value : undefined;
  };
  const skipValue = (): boolean => {
    if (bytes[cursor] === 34) return quoted();
    if (bytes[cursor] === 123 || bytes[cursor] === 91) {
      let depth = 0;
      do {
        const byte = bytes[cursor];
        if (byte === 34) { if (!quoted()) return false; continue; }
        cursor++;
        if (byte === 123 || byte === 91) depth++;
        if (byte === 125 || byte === 93) depth--;
      } while (depth > 0 && cursor < bytes.length);
      return depth === 0;
    }
    const start = cursor;
    while (cursor < bytes.length && bytes[cursor] !== 44 && bytes[cursor] !== 125) cursor++;
    return cursor > start;
  };
  whitespace(); if (bytes[cursor++] !== 123) return 'indeterminate'; whitespace();
  if (bytes[cursor] === 125) { cursor++; whitespace(); return cursor === bytes.length ? 'absent' : 'indeterminate'; }
  while (cursor < bytes.length) {
    const name = key(); if (name === undefined) return 'indeterminate'; whitespace();
    if (bytes[cursor++] !== 58) return 'indeterminate'; whitespace();
    if (name === 'projectSchemaId') return 'present';
    if (!skipValue()) return 'indeterminate'; whitespace();
    if (bytes[cursor] === 125) { cursor++; whitespace(); return cursor === bytes.length ? 'absent' : 'indeterminate'; }
    if (bytes[cursor++] !== 44) return 'indeterminate'; whitespace();
  }
  return 'indeterminate';
}
