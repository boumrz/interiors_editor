import { describe, expect, it } from '@rstest/core';
import { unzipSync, zipSync } from 'fflate';
import { RuntimePortableBackupCodec } from './runtime-portable-backup-codec';
import { encodeRuntimeV1Project, RUNTIME_V1_SCHEMA_ID } from './runtime-v1-wire';
import { ExportPortableBackupUseCase } from '../../application/export-portable-backup';
import { canonicalProjectSerializer } from '../../application/create-project';
import { FflatePortableBackupEncoder } from './fflate-portable-backup-encoder';
import { FflatePortableBackupDecoder } from './fflate-portable-backup-decoder';
import type { Project } from '../../domain/project';
const utf8 = (text: string) => new TextEncoder().encode(text);
const checksum = { sha256Bytes: async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('') };
const project = (): Project => ({ schemaVersion: 1, projectId: 'p', name: 'P', createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', lifecycle: 'active',
  level: { levelId: 'l', vertices: [], wallSegments: [], rooms: [{ roomId: 'r', faceFingerprint: 'rectangular:r', heightMm: 500 }], openings: [] },
  assetInstances: [], assetDefinitionRefs: [] });
const createdAt = '2026-11-04T12:00:00.000Z';
const acceptProject = () => ({ kind: 'accepted' } as const);
const definition = (resourceHash: string, byteLength: number, id = 'd') => ({ assetDefinitionId: id, displayName: 'D', byteLength, widthMm: 1, depthMm: 1, heightMm: 1, format: 'glb' as const, resourceHash });
async function ready(source: unknown = project(), resources: readonly { readonly resourceHash: string; readonly bytes: Uint8Array }[] = []) {
  const result = await new RuntimePortableBackupCodec(checksum, acceptProject).encode({ project: source, createdAt, resources });
  expect(result.kind).toBe('encoded');
  if (result.kind !== 'encoded') throw new Error('not encoded');
  return result.bytes;
}
async function oldBackup(source: Project) {
  const textChecksum = { sha256: (text: string) => checksum.sha256Bytes(utf8(text)) };
  const serializedProject = canonicalProjectSerializer.serialize(source);
  const revision = { schemaVersion: 1 as const, revisionId: 'old-r', projectId: source.projectId, createdAt, serializedProject, checksum: await textChecksum.sha256(serializedProject) };
  const result = await new ExportPortableBackupUseCase({ binaryChecksum: checksum, checksum: textChecksum, encoder: new FflatePortableBackupEncoder(), serializer: canonicalProjectSerializer }).execute({ project: source, revision });
  expect(result.kind).toBe('ready');
  if (result.kind !== 'ready') throw new Error('old producer failed');
  return { bytes: result.bytes, serializedProject, revision };
}
function replaceAscii(bytes: Uint8Array, before: string, after: string): Uint8Array {
  expect(after.length).toBe(before.length);
  const result = bytes.slice(); const a = utf8(before); const b = utf8(after); let count = 0;
  for (let i = 0; i <= result.length - a.length; i++) if (a.every((byte, offset) => byte === result[i + offset])) { result.set(b, i); count++; i += a.length - 1; }
  expect(count).toBe(2);
  return result;
}
function assertClosedStore(archive: Uint8Array, entries: Readonly<Record<string, Uint8Array>>): void {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength); const end = archive.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50); expect(view.getUint16(end + 4, true)).toBe(0); expect(view.getUint16(end + 6, true)).toBe(0); expect(view.getUint16(end + 20, true)).toBe(0);
  const count = view.getUint16(end + 10, true); expect(count).toBe(Object.keys(entries).length);
  let cursor = view.getUint32(end + 16, true);
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50); expect(view.getUint16(cursor + 10, true)).toBe(0); expect(view.getUint16(cursor + 8, true) & 8).toBe(0);
    expect(view.getUint16(cursor + 30, true)).toBe(0); expect(view.getUint16(cursor + 32, true)).toBe(0);
    const nameLength = view.getUint16(cursor + 28, true); const local = view.getUint32(cursor + 42, true);
    const pathBytes = archive.subarray(cursor + 46, cursor + 46 + nameLength); expect([...pathBytes].every(byte => byte >= 33 && byte <= 126)).toBe(true);
    const path = new TextDecoder().decode(pathBytes); const bytes = entries[path];
    expect(view.getUint32(local, true)).toBe(0x04034b50); expect(view.getUint16(local + 8, true)).toBe(0); expect(view.getUint16(local + 28, true)).toBe(0);
    expect(view.getUint32(cursor + 20, true)).toBe(bytes.length); expect(view.getUint32(cursor + 24, true)).toBe(bytes.length);
    expect(view.getUint32(local + 18, true)).toBe(bytes.length); expect(view.getUint32(local + 22, true)).toBe(bytes.length);
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
    expect(view.getUint32(cursor + 16, true)).toBe((crc ^ 0xffffffff) >>> 0); expect(view.getUint32(local + 14, true)).toBe((crc ^ 0xffffffff) >>> 0);
    cursor += 46 + nameLength;
  }
  expect(cursor).toBe(end);
  expect(archive.length).toBe(22 + Object.entries(entries).reduce((sum, [path, bytes]) => sum + 76 + 2 * path.length + bytes.length, 0));
}
describe('registered runtime Portable Backup envelope', () => {
  it('exports a closed STORE envelope and restores exact empty wire state without relying on legacy guessing', async () => {
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    const source = { ...project(), projectId: 'p\ud800', level: { ...project().level, rooms: [{ ...project().level.rooms[0], name: undefined }] } };
    const encoded = await codec.encode({ project: source, createdAt, resources: [] });
    expect(encoded.kind).toBe('encoded');
    if (encoded.kind !== 'encoded') throw new Error('not encoded');
    const entries = unzipSync(encoded.bytes);
    assertClosedStore(encoded.bytes, entries);
    expect(Object.keys(entries).sort()).toEqual(['checksums.json', 'manifest.json', 'project/project.json']);
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    expect(manifest.projectSchemaId).toBe(RUNTIME_V1_SCHEMA_ID);
    expect(manifest.sourceProjectId).toEqual({ utf16be: 'AHDYAA' });
    expect(manifest.entries).toEqual([{ byteLength: entries['project/project.json'].length, mediaType: 'application/json', path: 'project/project.json', sha256: await checksum.sha256Bytes(entries['project/project.json']) }]);
    const decoded = await codec.decode(encoded.bytes);
    expect(decoded.kind).toBe('decoded');
    if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.schema).toBe('runtime-v1-wire');
    expect(decoded.decodedProject).toStrictEqual(source);
    expect(decoded.resources).toEqual([]);
  });
  it('keeps checksum failure ahead of unknown schema and preserves size before checksum', async () => {
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    const encoded = await codec.encode({ project: project(), createdAt, resources: [] });
    expect(encoded.kind).toBe('encoded');
    if (encoded.kind !== 'encoded') throw new Error('not encoded');
    const entries = unzipSync(encoded.bytes);
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    manifest.projectSchemaId = 'interiors.project/unknown';
    entries['manifest.json'] = utf8(JSON.stringify(manifest));
    entries['project/project.json'][0] = 0x3f;
    expect(await codec.decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    entries['project/project.json'] = oversized;
    manifest.entries[0].byteLength = oversized.length;
    entries['manifest.json'] = utf8(JSON.stringify(manifest));
    expect(await codec.decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('preserves every source resource key while deduplicating verified hash-case aliases in the archive', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const lower = await checksum.sha256Bytes(bytes); const upper = lower.toUpperCase();
    expect(upper).not.toBe(lower);
    const source = { ...project(), assetDefinitionRefs: [definition(lower, 4), definition(upper, 4, 'D')] };
    const archive = await ready(source, [{ resourceHash: lower, bytes }, { resourceHash: upper, bytes: bytes.slice() }]);
    const entries = unzipSync(archive); const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    assertClosedStore(archive, entries);
    expect(Object.keys(entries)).toHaveLength(4);
    expect(manifest.resources).toEqual([{ path: `custom/${lower}.glb`, resourceHash: upper }, { path: `custom/${lower}.glb`, resourceHash: lower }]);
    expect(manifest.entries).toHaveLength(2);
    const decoded = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(archive);
    expect(decoded.kind).toBe('decoded');
    if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.decodedProject).toStrictEqual(source);
    expect(decoded.resources.map(resource => resource.resourceHash)).toEqual([upper, lower]);
    expect(decoded.resources[0].bytes).toEqual(bytes); expect(decoded.resources[1].bytes).toEqual(bytes);
    decoded.resources[0].bytes[0] = 99;
    expect(decoded.resources[1].bytes[0]).toBe(1);
    expect(entries[`custom/${lower}.glb`][0]).toBe(1);
  });

  it('verifies each exact source hash key independently and never substitutes a differently spelled or missing key', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const hash = await checksum.sha256Bytes(bytes); const upper = hash.toUpperCase();
    const source = { ...project(), assetDefinitionRefs: [definition(hash, 4), definition(upper, 4, 'D')] };
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    expect(await codec.encode({ project: source, createdAt, resources: [{ resourceHash: hash, bytes }] })).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_RESOURCE_MISSING' });
    expect(await codec.encode({ project: source, createdAt, resources: [{ resourceHash: hash, bytes }, { resourceHash: upper, bytes: new Uint8Array([4, 3, 2, 1]) }] })).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
    expect(await codec.encode({ project: source, createdAt, resources: [{ resourceHash: hash, bytes }, { resourceHash: hash, bytes }] })).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('keeps the old exporter/decoder unchanged and upgrades a non-ambiguous old snapshot through the new wire codec', async () => {
    const source = { ...project(), projectId: 'old\ud800' };
    const old = await oldBackup(source); const before = await checksum.sha256Bytes(old.bytes);
    expect((await new FflatePortableBackupDecoder(checksum).decode(old.bytes)).kind).toBe('accepted');
    const decoded = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(old.bytes);
    expect(decoded.kind).toBe('decoded');
    if (decoded.kind !== 'decoded') throw new Error('legacy not decoded');
    expect(decoded.schema).toBe('runtime-v1-legacy'); expect(decoded.decodedProject).toStrictEqual(source);
    const upgraded = await ready(decoded.decodedProject, decoded.resources);
    const reopened = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(upgraded);
    expect(reopened.kind).toBe('decoded');
    if (reopened.kind !== 'decoded') throw new Error('wire not decoded');
    expect(reopened.schema).toBe('runtime-v1-wire'); expect(reopened.decodedProject).toStrictEqual(source);
    // This old decoder does not understand the new source-ID wrapper either.
    expect((await new FflatePortableBackupDecoder(checksum).decode(upgraded))).toMatchObject({ kind: 'rejected', reasonCode: 'PORTABLE_BACKUP_INVALID' });
    expect(await checksum.sha256Bytes(old.bytes)).toBe(before);
    expect(canonicalProjectSerializer.serialize(source)).toBe(old.serializedProject);
  });

  it('does not guess an ambiguous empty legacy Project or claim a physical recovery guarantee', async () => {
    const source = { ...project(), level: { ...project().level, rooms: [] } };
    const old = await oldBackup(source); const before = await checksum.sha256Bytes(old.bytes);
    expect((await new FflatePortableBackupDecoder(checksum).decode(old.bytes)).kind).toBe('accepted');
    expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(old.bytes)).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    const recovered = await new FflatePortableBackupDecoder(checksum).decode(old.bytes);
    if (recovered.kind !== 'accepted') throw new Error('old reader no longer available');
    const oldModel = JSON.parse(new TextDecoder().decode(recovered.projectBytes));
    const wire = await ready(oldModel);
    const decoded = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(wire);
    expect(decoded.kind).toBe('decoded');
    if (decoded.kind !== 'decoded') throw new Error('wire not decoded');
    expect(decoded.decodedProject).toStrictEqual(source);
    expect(await checksum.sha256Bytes(old.bytes)).toBe(before);
  });

  it('preserves an unaccepted PPJ candidate without imposing V1 manifest/ledger/resource grammar', async () => {
    const projectBytes = utf8('{"projectSchemaId":"interiors.project/alpha-1","schemaVersion":1,"projectId":"p","unvalidated":true}');
    const manifestBytes = utf8(JSON.stringify({ projectSchemaId: 'interiors.project/alpha-1', projectSchemaVersion: 1, sourceProjectId: 'p', canonicalProjectPath: 'project/project.json', futureTechnicalDescriptor: { unresolved: true } }));
    const ledgerBytes = utf8('[{"undeterminedLedgerGrammar":true}]');
    const original = zipSync({ 'manifest.json': manifestBytes, 'checksums.json': ledgerBytes, 'project/project.json': projectBytes, [`catalog/${'a'.repeat(64)}.asset`]: new Uint8Array([9]) }, { level: 0 });
    const before = original.slice(); const calls: string[] = [];
    const codec = new RuntimePortableBackupCodec({ sha256Bytes: async bytes => { calls.push('hash'); return checksum.sha256Bytes(bytes); } }, () => { calls.push('domain'); return { kind: 'accepted' }; });
    const result = await codec.decode(original);
    expect(result.kind).toBe('requires-ppj-validation');
    if (result.kind !== 'requires-ppj-validation') throw new Error('wrong PPJ boundary');
    expect(result.stage).toBe('candidate'); expect(result.checksumVerified).toBe(false); expect(calls).toEqual([]);
    expect(result.manifest?.read()).toEqual(manifestBytes); expect(result.checksumLedger?.read()).toEqual(ledgerBytes);
    expect(result.remainingChecks).toContain('full-ppj-manifest-and-ledger-bindings'); expect(result.remainingChecks).toContain('ppj-ast-r1');
    original.fill(0); const exposed = result.archive.read(); exposed.fill(0);
    expect(result.archive.read()).toEqual(before);
    const exposedManifest = result.manifest?.read(); exposedManifest?.fill(0);
    expect(result.manifest?.read()).toEqual(manifestBytes);
  });

  it('keeps an oversized shared-alpha Project as an unvalidated PPJ candidate until its manifest boundary is established', async () => {
    const old = await oldBackup(project()); const entries = unzipSync(old.bytes);
    const large = new Uint8Array(10 * 1024 * 1024 + 1); entries['project/project.json'] = large;
    // Deliberately unresolved PPJ size/checksum metadata; it must not be labelled verified.
    const result = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync(entries, { level: 0 }));
    expect(result.kind).toBe('requires-ppj-validation');
    if (result.kind !== 'requires-ppj-validation') throw new Error('not candidate');
    expect(result.checksumVerified).toBe(false); expect(result.declaredProjectByteLength).toBe(large.length);
  });

  it('never falls from a wire manifest into PPJ or legacy and never publishes an unregistered pair', async () => {
    const archive = await ready(); const entries = unzipSync(archive);
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    const wrong = utf8(new TextDecoder().decode(entries['project/project.json']).replace(RUNTIME_V1_SCHEMA_ID, 'interiors.project/alpha-1'));
    entries['project/project.json'] = wrong; manifest.entries[0].byteLength = wrong.length; manifest.entries[0].sha256 = await checksum.sha256Bytes(wrong);
    entries['manifest.json'] = utf8(JSON.stringify(manifest)); entries['checksums.json'] = utf8(JSON.stringify({ algorithm: 'sha-256', entries: [{ path: 'project/project.json', sha256: manifest.entries[0].sha256 }] }));
    expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    manifest.projectSchemaId = 'interiors.project/future'; entries['manifest.json'] = utf8(JSON.stringify(manifest));
    expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('rejects unsafe or duplicate raw names before any malformed manifest or Project failure', async () => {
    const archive = await ready(); const entries = unzipSync(archive); entries['manifest.json'] = utf8('?');
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    for (const path of ['../escape', 'Project/project.json', 'project\\project.json', '.interiors/project/project.json', `custom/${'A'.repeat(64)}.glb`, '😶']) {
      expect(await codec.decode(zipSync({ ...entries, [path]: new Uint8Array([0]) }, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_PATH_UNSAFE' });
    }
    const good = unzipSync(await ready());
    const duplicate = zipSync({ ...good, 'project/project.jsoN': good['project/project.json'] }, { level: 0 });
    expect(await codec.decode(replaceAscii(duplicate, 'project/project.jsoN', 'project/project.json'))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_PATH_UNSAFE' });
  });

  it('rejects a safe undeclared resource path before Project checksum or schema', async () => {
    const entries = unzipSync(await ready()); entries['project/project.json'][0] = 63;
    expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...entries, [`custom/${'a'.repeat(64)}.glb`]: new Uint8Array([0]) }, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_PATH_UNSAFE' });
  });

  it('keeps source identity mismatch behind Project checksum and before the domain callback', async () => {
    const entries = unzipSync(await ready()); const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    manifest.sourceProjectId = 'other'; entries['manifest.json'] = utf8(JSON.stringify(manifest));
    const calls: string[] = [];
    const codec = new RuntimePortableBackupCodec(checksum, () => { calls.push('domain'); return { kind: 'accepted' }; });
    expect(await codec.decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    entries['project/project.json'][0] = 63;
    expect(await codec.decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' }); expect(calls).toEqual([]);
  });

  it('preserves a domain failure before corrupt resource hashing on decode and encode', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const hash = await checksum.sha256Bytes(bytes);
    const source = { ...project(), assetDefinitionRefs: [definition(hash, 4)] };
    const archive = await ready(source, [{ resourceHash: hash, bytes }]); const entries = unzipSync(archive); entries[`custom/${hash}.glb`][0] ^= 255;
    const calls: string[] = [];
    const codec = new RuntimePortableBackupCodec({ sha256Bytes: async bytes => { calls.push(bytes.length === 4 ? 'resource-hash' : 'project-hash'); return checksum.sha256Bytes(bytes); } }, () => { calls.push('domain'); return { kind: 'rejected', reasonCode: 'PLAN_GRAPH_INVALID' }; });
    expect(await codec.decode(zipSync(entries, { level: 0 }))).toEqual({ kind: 'project-validation-rejected', reasonCode: 'PLAN_GRAPH_INVALID' }); expect(calls).toEqual(['project-hash', 'domain']);
    calls.length = 0;
    expect(await codec.encode({ project: source, createdAt, resources: [{ resourceHash: hash, bytes: new Uint8Array([9, 9, 9, 9]) }] })).toEqual({ kind: 'project-validation-rejected', reasonCode: 'PLAN_GRAPH_INVALID' }); expect(calls).toEqual(['domain']);
  });

  it('owns resource snapshots before asynchronous validation and owns archive bytes before asynchronous hashes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const hash = await checksum.sha256Bytes(bytes);
    const source = { ...project(), assetDefinitionRefs: [definition(hash, 4)] };
    const encoder = new RuntimePortableBackupCodec(checksum, () => { bytes[0] = 99; return { kind: 'accepted' }; });
    const encoded = await encoder.encode({ project: source, createdAt, resources: [{ resourceHash: hash, bytes }] });
    expect(encoded.kind).toBe('encoded'); if (encoded.kind !== 'encoded') throw new Error('not encoded');
    expect(unzipSync(encoded.bytes)[`custom/${hash}.glb`]).toEqual(new Uint8Array([1, 2, 3, 4]));
    const archive = encoded.bytes.slice();
    const codec = new RuntimePortableBackupCodec({ sha256Bytes: async bytes => { archive.fill(0); return checksum.sha256Bytes(bytes); } }, acceptProject);
    const decoded = await codec.decode(archive);
    expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.resources[0].bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('checks cancellation before work and immediately after the required validator', async () => {
    const controller = new AbortController(); controller.abort();
    const calls: string[] = []; const codec = new RuntimePortableBackupCodec(checksum, () => { calls.push('domain'); return { kind: 'accepted' }; });
    expect(await codec.encode({ project: project(), createdAt, resources: [] }, controller.signal)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });
    expect(await codec.decode(new Uint8Array(), controller.signal)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' }); expect(calls).toEqual([]);
    const next = new AbortController();
    const aborting = new RuntimePortableBackupCodec(checksum, () => { next.abort(); return { kind: 'accepted' }; });
    expect(await aborting.decode(await ready(), next.signal)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });
  });

  it('reports declared missing resource bytes at envelope binding and a Project-only missing reference after domain validation', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const hash = await checksum.sha256Bytes(bytes); const path = `custom/${hash}.glb`;
    const source = { ...project(), assetDefinitionRefs: [definition(hash, 4)] };
    const entries = unzipSync(await ready(source, [{ resourceHash: hash, bytes }])); delete entries[path];
    const calls: string[] = [];
    const invalidPlan = new RuntimePortableBackupCodec(checksum, () => { calls.push('domain'); return { kind: 'rejected', reasonCode: 'PLAN_GRAPH_INVALID' }; });
    expect(await invalidPlan.decode(zipSync(entries, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_RESOURCE_MISSING' }); expect(calls).toEqual([]);
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])); manifest.entries = manifest.entries.filter((entry: { path: string }) => entry.path !== path); manifest.resources = [];
    entries['manifest.json'] = utf8(JSON.stringify(manifest)); entries['checksums.json'] = utf8(JSON.stringify({ algorithm: 'sha-256', entries: manifest.entries.map(({ path, sha256 }: { path: string; sha256: string }) => ({ path, sha256 })) }));
    expect(await invalidPlan.decode(zipSync(entries, { level: 0 }))).toEqual({ kind: 'project-validation-rejected', reasonCode: 'PLAN_GRAPH_INVALID' }); expect(calls).toEqual(['domain']);
    expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync(entries, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_RESOURCE_MISSING' });
  });

  it.each(['backupFormat', 'backupFormatVersion', 'canonicalProjectPath', 'complete', 'createdAt', 'entries', 'projectSchemaId', 'projectSchemaVersion', 'requiredCapabilities', 'resources', 'sourceProjectId'])('rejects a missing registered wire manifest key %s', async key => {
    const entries = unzipSync(await ready()); const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])); delete manifest[key];
    entries['manifest.json'] = utf8(JSON.stringify(manifest));
    expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
  });

  it.each([
    ['backupFormat', 'other'], ['backupFormatVersion', 2], ['canonicalProjectPath', './project/project.json'], ['complete', false], ['createdAt', '2026-11-04'],
    ['projectSchemaId', ''], ['projectSchemaId', null], ['projectSchemaVersion', 0], ['projectSchemaVersion', '1'], ['projectSchemaVersion', 0.5],
    ['sourceProjectId', null], ['sourceProjectId', ''], ['sourceProjectId', 'x'.repeat(257)], ['sourceProjectId', '\ud800'], ['sourceProjectId', { utf16be: 'AGE' }],
    ['requiredCapabilities', ['unknown']], ['requiredCapabilities', {}], ['resources', {}], ['entries', null]
  ].map(([key, value]) => ({ key: String(key), value })))('rejects malformed wire manifest $key before Project checksum', async ({ key, value }) => {
    const entries = unzipSync(await ready()); const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])); manifest[key] = value;
    entries['manifest.json'] = utf8(JSON.stringify(manifest)); entries['project/project.json'][0] = 63;
    expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
  });

  it('rejects unknown manifest fields, duplicate raw JSON keys and malformed ledger bindings', async () => {
    const good = unzipSync(await ready()); const text = new TextDecoder().decode(good['manifest.json']);
    for (const manifest of [utf8(`{"unknown":0,${text.slice(1)}`), utf8(text.replace('"complete":true', '"complete":true,"complete":true')), utf8('?'), new Uint8Array([0xef, 0xbb, 0xbf, 123, 125])]) {
      expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...good, 'manifest.json': manifest }, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    }
    const original = JSON.parse(new TextDecoder().decode(good['checksums.json']));
    for (const value of [[], { ...original, algorithm: 'sha1' }, { ...original, extra: true }, { ...original, entries: [...original.entries, original.entries[0]] },
      { ...original, entries: [{ ...original.entries[0], sha256: '0'.repeat(64) }] }, { ...original, entries: [{ ...original.entries[0], path: 'other' }] },
      { ...original, entries: [{ ...original.entries[0], extra: true }] }]) {
      expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...good, 'checksums.json': utf8(JSON.stringify(value)) }, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    }
  });

  it('does not round fractional metadata into an integer, while exact integer metadata aliases retain their mathematical value', async () => {
    const good = unzipSync(await ready()); const text = new TextDecoder().decode(good['manifest.json']);
    for (const raw of ['1.00000000000000001', '0.99999999999999999', '9007199254740993', '1e999999', '1e99999999999999', '-1', '0']) {
      const manifest = utf8(text.replace('"projectSchemaVersion":1', `"projectSchemaVersion":${raw}`));
      expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...good, 'manifest.json': manifest }, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    }
    for (const raw of ['1.0', '1.00', '1e0', '1e00', '10e-1']) {
      const manifest = utf8(text.replace('"projectSchemaVersion":1', `"projectSchemaVersion":${raw}`));
      expect((await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...good, 'manifest.json': manifest }, { level: 0 }))).kind).toBe('decoded');
    }
    for (const raw of ['1e1', '10e0']) {
      const manifest = utf8(text.replace('"projectSchemaVersion":1', `"projectSchemaVersion":${raw}`));
      expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...good, 'manifest.json': manifest }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
  });

  it('uses unchanged PPJ raw/scalar bounds for an unregistered route rather than the V1 scanner', async () => {
    const good = unzipSync(await ready()); const manifest = JSON.parse(new TextDecoder().decode(good['manifest.json'])); manifest.projectSchemaId = 'interiors.project/future';
    for (const [padding, expected] of [['x'.repeat(2000), 'BACKUP_SCHEMA_UNREADABLE'], ['x'.repeat(5000), 'BACKUP_PROJECT_LIMIT']]) {
      const bytes = utf8(JSON.stringify({ projectSchemaId: 'interiors.project/future', schemaVersion: 1, projectId: 'p', padding }));
      manifest.entries[0].byteLength = bytes.length; manifest.entries[0].sha256 = await checksum.sha256Bytes(bytes);
      const entries = { ...good, 'project/project.json': bytes, 'manifest.json': utf8(JSON.stringify(manifest)), 'checksums.json': utf8(JSON.stringify({ algorithm: 'sha-256', entries: [{ path: 'project/project.json', sha256: manifest.entries[0].sha256 }] })) };
      expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync(entries, { level: 0 }))).toMatchObject({ kind: 'rejected', reasonCode: expected });
    }
  });

  it('does not confuse selector-looking strings and escaped punctuation inside legacy values with a root selector', async () => {
    const source = { ...project(), name: 'P {"projectSchemaId"}', level: { ...project().level, rooms: [{ ...project().level.rooms[0], name: '"}],\\"projectSchemaId":"interiors.project/alpha-1"' }] } };
    const old = await oldBackup(source);
    const result = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(old.bytes);
    expect(result.kind).toBe('decoded'); if (result.kind !== 'decoded') throw new Error('not legacy');
    expect(result.schema).toBe('runtime-v1-legacy'); expect(result.decodedProject).toStrictEqual(source);
  });

  it('enforces current definition/resource policy before domain without allocating large resource fixtures', async () => {
    const mib = 1024 * 1024; const calls: string[] = [];
    const codec = new RuntimePortableBackupCodec(checksum, () => { calls.push('domain'); return { kind: 'rejected', reasonCode: 'READONLY_SENTINEL' }; });
    const withDefinitions = (count: number, length: number) => ({ ...project(), assetDefinitionRefs: Array.from({ length: count }, (_, i) => definition(i.toString(16).padStart(64, '0'), length, `d${i}`)) });
    expect(await codec.encode({ project: withDefinitions(100, 1), createdAt, resources: [] })).toEqual({ kind: 'project-validation-rejected', reasonCode: 'READONLY_SENTINEL' }); expect(calls).toEqual(['domain']); calls.length = 0;
    for (const source of [withDefinitions(101, 1), withDefinitions(1, 50 * mib + 1), withDefinitions(4, 45 * mib + 1)]) expect(await codec.encode({ project: source, createdAt, resources: [] })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    expect(calls).toEqual([]);
    for (const source of [withDefinitions(1, 50 * mib), withDefinitions(4, 45 * mib)]) expect(await codec.encode({ project: source, createdAt, resources: [] })).toEqual({ kind: 'project-validation-rejected', reasonCode: 'READONLY_SENTINEL' });
    expect(calls).toEqual(['domain', 'domain']);
  });

  it('keeps separate resource payloads, canonical declaration order, and exact result metadata', async () => {
    const resources = await Promise.all([new Uint8Array([8, 7, 6]), new Uint8Array([3, 2, 1, 0]), new Uint8Array([5, 4])].map(async bytes => ({ bytes, resourceHash: await checksum.sha256Bytes(bytes) })));
    const source = { ...project(), assetDefinitionRefs: resources.map((resource, i) => definition(resource.resourceHash, resource.bytes.length, `d${i}`)) };
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    const encoded = await codec.encode({ project: source, resources, createdAt });
    expect(encoded.kind).toBe('encoded'); if (encoded.kind !== 'encoded') throw new Error('not encoded');
    expect(encoded.mimeType).toBe('application/zip');
    expect(encoded.metadata).toEqual({ sourceProjectId: 'p', createdAt, projectSchemaId: RUNTIME_V1_SCHEMA_ID, projectSchemaVersion: 1 });
    const entries = unzipSync(encoded.bytes); const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    const ordered = [...resources].sort((a, b) => a.resourceHash < b.resourceHash ? -1 : 1);
    expect(manifest.entries.slice(1).map((entry: { path: string }) => entry.path)).toEqual(ordered.map(resource => `custom/${resource.resourceHash}.glb`));
    expect(manifest.resources.map((resource: { resourceHash: string }) => resource.resourceHash)).toEqual(ordered.map(resource => resource.resourceHash));
    const decoded = await codec.decode(encoded.bytes);
    expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.metadata).toEqual(encoded.metadata); expect(decoded.resources).toEqual(ordered); expect(decoded.decodedProject).toStrictEqual(source);
    for (const resource of resources) {
      const bad = { ...entries, [`custom/${resource.resourceHash}.glb`]: resource.bytes.map(byte => byte ^ 255) };
      expect(await codec.decode(zipSync(bad, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
    }
    for (const field of ['entries', 'resources']) {
      const bad = { ...manifest, [field]: [...manifest[field]].reverse() };
      expect(await codec.decode(zipSync({ ...entries, 'manifest.json': utf8(JSON.stringify(bad)) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    }
  });

  it('rejects extraneous source keys and length disagreement without silently ignoring or padding bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const hash = await checksum.sha256Bytes(bytes);
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    const source = { ...project(), assetDefinitionRefs: [definition(hash, bytes.length)] };
    for (const resources of [[{ resourceHash: hash, bytes }, { resourceHash: 'a'.repeat(64), bytes }], [{ resourceHash: hash, bytes: bytes.slice(1) }]]) {
      expect(await codec.encode({ project: source, resources, createdAt })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
    expect(await codec.encode({ project: { ...source, schemaVersion: 2 }, resources: [], createdAt })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    expect(await codec.encode({ project: project(), resources: [], createdAt: '2026-11-04' })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
  });

  it('fails closed if a checksum collaborator claims a collision between unequal alias payloads', async () => {
    const hash = 'a'.repeat(64); const upper = hash.toUpperCase();
    const codec = new RuntimePortableBackupCodec({ sha256Bytes: async () => hash }, acceptProject);
    for (const other of [new Uint8Array([1, 2, 4]), new Uint8Array([1, 2, 3, 4])]) {
      const source = { ...project(), assetDefinitionRefs: [definition(hash, 3), definition(upper, other.length, 'D')] };
      expect(await codec.encode({ project: source, resources: [{ resourceHash: hash, bytes: new Uint8Array([1, 2, 3]) }, { resourceHash: upper, bytes: other }], createdAt })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
    }
  });

  it('preserves trusted collaborator exceptions and rejects invalid digests without conflating them with schema errors', async () => {
    const defect = new Error('validator defect');
    const codec = new RuntimePortableBackupCodec(checksum, () => { throw defect; });
    await expect(codec.encode({ project: project(), resources: [], createdAt })).rejects.toBe(defect);
    await expect(codec.decode(await ready())).rejects.toBe(defect);
    const badHash = new RuntimePortableBackupCodec({ sha256Bytes: async () => 'x'.repeat(64) }, acceptProject);
    expect(await badHash.encode({ project: project(), resources: [], createdAt })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
    expect(await badHash.decode(await ready())).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
    const upperHash = new RuntimePortableBackupCodec({ sha256Bytes: async bytes => (await checksum.sha256Bytes(bytes)).toUpperCase() }, acceptProject);
    expect((await upperHash.decode(await ready())).kind).toBe('decoded');
    const abort = new AbortController(); const abortHash = new RuntimePortableBackupCodec({ sha256Bytes: async bytes => { abort.abort(); return checksum.sha256Bytes(bytes); } }, acceptProject);
    expect(await abortHash.encode({ project: project(), resources: [], createdAt }, abort.signal)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });
  });

  it('rejects missing core files and a broken ZIP at their own early boundary', async () => {
    const entries = unzipSync(await ready()); const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    for (const name of ['manifest.json', 'checksums.json', 'project/project.json']) {
      const copy = { ...entries }; delete copy[name];
      expect(await codec.decode(zipSync(copy, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    }
    expect(await codec.decode(new Uint8Array([1, 2, 3]))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' });
  });

  it('rejects malformed closed resource declarations and ledger membership before hashing Project bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const hash = await checksum.sha256Bytes(bytes);
    const source = { ...project(), assetDefinitionRefs: [definition(hash, bytes.length)] };
    const entries = unzipSync(await ready(source, [{ resourceHash: hash, bytes }])); const good = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    const codec = new RuntimePortableBackupCodec({ sha256Bytes: async () => { throw new Error('must reject before hash'); } }, acceptProject);
    const variants = [
      { ...good, entries: [{ ...good.entries[0], mediaType: 'other' }, good.entries[1]] },
      { ...good, entries: [good.entries[0], { ...good.entries[1], mediaType: 'application/json' }] },
      { ...good, entries: [good.entries[0], { ...good.entries[1], sha256: '0'.repeat(64) }] },
      { ...good, entries: [good.entries[0], { ...good.entries[1], path: `catalog/${hash}.asset` }] },
      { ...good, entries: [good.entries[0], { ...good.entries[1], byteLength: bytes.length + 1 }] },
      { ...good, entries: [good.entries[0], { ...good.entries[1], sha256: '0'.repeat(65) }] },
      { ...good, entries: [good.entries[0], good.entries[0], good.entries[1]] },
      { ...good, resources: [good.resources[0], good.resources[0]] },
      { ...good, resources: [] },
      { ...good, resources: [{ ...good.resources[0], resourceHash: `${hash}0` }] },
      { ...good, resources: [{ ...good.resources[0], path: `custom/${'0'.repeat(64)}.glb` }] },
      { ...good, resources: [{ ...good.resources[0], extra: true }] },
      { ...good, entries: [{ ...good.entries[0], extra: true }, good.entries[1]] }
    ];
    for (const manifest of variants) expect(await codec.decode(zipSync({ ...entries, 'manifest.json': utf8(JSON.stringify(manifest)) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    for (const ledger of [{ algorithm: 'sha-256', entries: [] }, { algorithm: 'sha-256', entries: good.entries.map(({ path }: { path: string }) => ({ path, sha256: 'a'.repeat(65) })) }]) {
      expect(await codec.decode(zipSync({ ...entries, 'checksums.json': utf8(JSON.stringify(ledger)) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    }
  });

  it('defers extra mappings and definition-length disagreements until after the readonly domain decision', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const hash = await checksum.sha256Bytes(bytes);
    const source = { ...project(), assetDefinitionRefs: [definition(hash, bytes.length)] };
    const entries = unzipSync(await ready(source, [{ resourceHash: hash, bytes }]));
    for (const changed of [{ ...source, assetDefinitionRefs: [] }, { ...source, assetDefinitionRefs: [definition(hash, bytes.length + 1)] }]) {
      // Rewrite only the independently hashed Project member; the resource declarations remain intact.
      const wire = encodeRuntimeV1Project(changed); if (wire.kind !== 'encoded') throw new Error('invalid fixture');
      const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])); manifest.entries[0].byteLength = wire.bytes.length; manifest.entries[0].sha256 = await checksum.sha256Bytes(wire.bytes);
      const archive = zipSync({ ...entries, 'project/project.json': wire.bytes, 'manifest.json': utf8(JSON.stringify(manifest)), 'checksums.json': utf8(JSON.stringify({ algorithm: 'sha-256', entries: manifest.entries.map(({ path, sha256 }: { path: string; sha256: string }) => ({ path, sha256 })) })) }, { level: 0 });
      const denied = new RuntimePortableBackupCodec(checksum, () => ({ kind: 'rejected', reasonCode: 'PLAN_GRAPH_INVALID' } as const));
      expect(await denied.decode(archive)).toEqual({ kind: 'project-validation-rejected', reasonCode: 'PLAN_GRAPH_INVALID' });
      expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(archive)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
  });


  it('sorts exact source spellings independently from lowercase archive digest paths', async () => {
    const pair: { bytes: Uint8Array; resourceHash: string }[] = [];
    for (let i = 0; pair.length < 2; i++) { const bytes = new Uint8Array([i]); const resourceHash = await checksum.sha256Bytes(bytes); if (/^[a-f]/.test(resourceHash)) pair.push({ bytes, resourceHash }); }
    pair.sort((a, b) => a.resourceHash < b.resourceHash ? -1 : 1); pair[1].resourceHash = pair[1].resourceHash.toUpperCase();
    const source = { ...project(), assetDefinitionRefs: pair.map((resource, i) => definition(resource.resourceHash, resource.bytes.length, `d${i}`)) };
    const decoded = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(await ready(source, pair));
    expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.resources).toEqual([pair[1], pair[0]]);
  });

  it('guards actual provided-source cardinality before the readonly validator', async () => {
    const codec = new RuntimePortableBackupCodec(checksum, () => ({ kind: 'rejected', reasonCode: 'DOMAIN_SENTINEL' } as const));
    const resources = Array.from({ length: 900 }, () => ({ resourceHash: 'a'.repeat(64), bytes: new Uint8Array([1]) }));
    expect(await codec.encode({ project: project(), createdAt, resources })).toEqual({ kind: 'project-validation-rejected', reasonCode: 'DOMAIN_SENTINEL' });
    expect(await codec.encode({ project: project(), createdAt, resources: [...resources, resources[0]] })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('rejects checksum prefixes/suffixes and schema-ID control bytes as closed manifest faults', async () => {
    const good = unzipSync(await ready()); const manifest = JSON.parse(new TextDecoder().decode(good['manifest.json']));
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    for (const sha256 of [`x${manifest.entries[0].sha256}`, `${manifest.entries[0].sha256}x`]) {
      const changed = { ...manifest, entries: [{ ...manifest.entries[0], sha256 }] };
      const ledger = { algorithm: 'sha-256', entries: [{ path: 'project/project.json', sha256 }] };
      expect(await codec.decode(zipSync({ ...good, 'manifest.json': utf8(JSON.stringify(changed)), 'checksums.json': utf8(JSON.stringify(ledger)) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    }
    for (const projectSchemaId of ['\u0001interiors.project/future', 'interiors.project/future\u0001']) {
      expect(await codec.decode(zipSync({ ...good, 'manifest.json': utf8(JSON.stringify({ ...manifest, projectSchemaId })) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    }
    for (const digest of [`x${'a'.repeat(64)}`, `${'a'.repeat(64)}x`]) {
      expect(await new RuntimePortableBackupCodec({ sha256Bytes: async () => digest }, acceptProject).encode({ project: project(), createdAt, resources: [] })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
    }
  });

  it('checks unequal alias lengths even when the first payload is a matching prefix of the second', async () => {
    const lower = 'a'.repeat(64); const upper = lower.toUpperCase();
    const source = { ...project(), assetDefinitionRefs: [definition(lower, 4), definition(upper, 3, 'D')] };
    expect(await new RuntimePortableBackupCodec({ sha256Bytes: async () => lower }, acceptProject).encode({ project: source, createdAt,
      resources: [{ resourceHash: lower, bytes: new Uint8Array([1, 2, 3, 4]) }, { resourceHash: upper, bytes: new Uint8Array([1, 2, 3]) }] })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
  });

  it('makes only a conservative nonaccepting selection for empty, whitespace, escaped-selector, and malformed shared-alpha members', async () => {
    const good = unzipSync((await oldBackup(project())).bytes); const original = JSON.parse(new TextDecoder().decode(good['manifest.json']));
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    const cases = [
      ['{}', 'rejected'], [' \n { \t } \r ', 'rejected'], [JSON.stringify(project(), null, 2), 'rejected'],
      ['{"projectSchema\\u0049d":"interiors.project/alpha-1"}', 'requires-ppj-validation'],
      ['{"projectSchemaId":null}', 'requires-ppj-validation'], ['[]', 'requires-ppj-validation'],
      ['{"unterminated":"\\', 'requires-ppj-validation'], ['{"nested":[', 'requires-ppj-validation']
    ];
    for (const [text, kind] of cases) {
      const bytes = utf8(text); const manifest = { ...original, entries: [{ ...original.entries[0], byteLength: bytes.length, sha256: await checksum.sha256Bytes(bytes) }] };
      const archive = zipSync({ ...good, 'project/project.json': bytes, 'manifest.json': utf8(JSON.stringify(manifest)), 'checksums.json': utf8(JSON.stringify({ algorithm: 'sha-256', entries: manifest.entries.map(({ path, sha256 }: { path: string; sha256: string }) => ({ path, sha256 })) })) }, { level: 0 });
      const result = await codec.decode(archive); expect(result.kind).toBe(kind);
      if (result.kind === 'rejected') expect(result.reasonCode).toBe('BACKUP_SCHEMA_UNREADABLE');
      if (result.kind === 'requires-ppj-validation') {
        expect(result.checkedStages).toEqual(['container-index', 'raw-paths', 'bounded-control-json', 'common-selector-header']);
        expect(result.remainingChecks).toEqual(['full-ppj-manifest-and-ledger-bindings', 'project-size-and-expected-checksum', 'ppj-ast-r1', 'selector-and-source-identity', 'closed-ppj-project-and-limits', 'domain-and-host', 'resource-bindings-and-integrity', 'lossless-runtime-mapper']);
        expect(result.checksumVerified).toBe(false);
        const read = result.checksumLedger?.read(); read?.fill(0); expect(result.checksumLedger?.read()).not.toEqual(read);
        expect(await checksum.sha256Bytes(result.archive.read())).toBe(await checksum.sha256Bytes(archive));
      }
    }
  });


  it('retains an unselected candidate when PPJ control structure exceeds unregistered V1-only parser bounds', async () => {
    const base = { projectSchemaId: 'interiors.project/alpha-1', projectSchemaVersion: 1, sourceProjectId: 'p', canonicalProjectPath: 'project/project.json' };
    const projectBytes = utf8('{"projectSchemaId":"interiors.project/alpha-1"}');
    const deep = Array.from({ length: 9 }).reduce<unknown>(nested => [nested], 0);
    const manifests = [{ ...base, descriptor: deep }, { ...base, descriptor: 'x'.repeat(1400) }, { ...base, ...Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`x${i}`, i])) }];
    for (const manifest of manifests) {
      const manifestBytes = utf8(JSON.stringify(manifest)); const archive = zipSync({ 'manifest.json': manifestBytes, 'checksums.json': utf8('{}'), 'project/project.json': projectBytes }, { level: 0 });
      const result = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(archive);
      expect(result.kind).toBe('requires-ppj-validation'); if (result.kind !== 'requires-ppj-validation') throw new Error('not candidate');
      expect(result.metadata).toBeUndefined(); expect(result.checkedStages).toEqual(['container-index', 'raw-paths']);
      expect(result.remainingChecks).toEqual(['control-read-and-source-owned-bounds', 'bounded-control-json', 'common-selector-header', 'single-route-identification', 'full-ppj-manifest-and-ledger-bindings', 'project-size-and-expected-checksum', 'ppj-ast-r1', 'selector-and-source-identity', 'closed-ppj-project-and-limits', 'domain-and-host', 'resource-bindings-and-integrity', 'lossless-runtime-mapper']);
      expect(result.manifest?.read()).toEqual(manifestBytes); expect(result.archive.read()).toEqual(archive); expect(result.checksumVerified).toBe(false);
    }
  });


  it('applies the common manifest hard limit before any unselected handoff and defers an oversized ledger without inflating it', async () => {
    const oversized = new Uint8Array(1024 * 1024 + 1);
    const codec = new RuntimePortableBackupCodec({ sha256Bytes: async () => { throw new Error('no checksum before control boundary'); } }, acceptProject);
    expect(await codec.decode(zipSync({ 'manifest.json': oversized, 'checksums.json': utf8('?'), 'project/project.json': utf8('?') }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
    const base = unzipSync(await ready()); const archive = zipSync({ ...base, 'checksums.json': oversized }, { level: 0 });
    const result = await codec.decode(archive);
    expect(result.kind).toBe('requires-ppj-validation'); if (result.kind !== 'requires-ppj-validation') throw new Error('not candidate');
    expect(result.metadata).toBeUndefined(); expect(result.manifest?.read()).toEqual(base['manifest.json']); expect(result.checksumLedger).toBeUndefined();
    expect(result.checkedStages).toEqual(['container-index', 'raw-paths']); expect(await checksum.sha256Bytes(result.archive.read())).toBe(await checksum.sha256Bytes(archive));
    expect(result.remainingChecks).toContain('control-read-and-source-owned-bounds');
    expect(await codec.decode(zipSync({ ...base, 'manifest.json': utf8('?'), 'checksums.json': oversized }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
  });

  it('finds a PPJ root selector after nested structures, escaped keys, and all JSON whitespace without parsing it as V1', async () => {
    const manifest = utf8(JSON.stringify({ projectSchemaId: 'interiors.project/alpha-1', projectSchemaVersion: 1, sourceProjectId: 'p', canonicalProjectPath: 'project/project.json' }));
    const projectMembers = [
      ` \n\t${JSON.stringify({ nested: [{ text: '"}[]' }, [1, 2, 3], true, null], projectSchemaId: 'interiors.project/alpha-1' })}\r `,
      '{"nested":{"x":[]},"projectSchema\\u0049d":"interiors.project/alpha-1"}',
      '{"scalar":3,"projectSchemaId":"interiors.project/alpha-1"}',
      '{"text":"escaped\\\\slash","projectSchemaId":"interiors.project/alpha-1"}'
    ];
    for (const text of projectMembers) {
      const result = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ 'manifest.json': manifest, 'checksums.json': utf8('[]'), 'project/project.json': utf8(text) }, { level: 0 }));
      expect(result.kind).toBe('requires-ppj-validation'); if (result.kind !== 'requires-ppj-validation') throw new Error('not candidate');
      expect(result.metadata).toEqual({ sourceProjectId: 'p', projectSchemaId: 'interiors.project/alpha-1', projectSchemaVersion: 1 });
      expect(result.checkedStages).toContain('common-selector-header');
    }
  });

  it('preserves a control-capacity ledger as unselected and still rejects raw syntax before that capacity', async () => {
    const good = unzipSync(await ready());
    const ledger = utf8(JSON.stringify(Array.from({ length: 1025 }, () => 0)));
    const archive = zipSync({ ...good, 'checksums.json': ledger }, { level: 0 });
    const result = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(archive);
    expect(result.kind).toBe('requires-ppj-validation'); if (result.kind !== 'requires-ppj-validation') throw new Error('not candidate');
    expect(result.metadata).toBeUndefined(); expect(result.manifest?.read()).toEqual(good['manifest.json']); expect(result.checksumLedger?.read()).toEqual(ledger);
    expect(result.controlEntries).toEqual({ manifest: { path: 'manifest.json', declaredByteLength: good['manifest.json'].length }, checksumLedger: { path: 'checksums.json', declaredByteLength: ledger.length } });
    expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...good, 'checksums.json': utf8('[?') }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
  });


  it('keeps three independently owned buffers for three exact hash-case aliases of one archive digest', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]); const lower = await checksum.sha256Bytes(bytes); const upper = lower.toUpperCase(); const at = lower.search(/[a-f]/);
    const mixed = upper.slice(0, at) + lower[at] + upper.slice(at + 1); const hashes = [lower, upper, mixed].sort(); expect(new Set(hashes).size).toBe(3);
    const source = { ...project(), assetDefinitionRefs: hashes.map((hash, i) => definition(hash, bytes.length, `d${i}`)) };
    const decoded = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(await ready(source, hashes.map(resourceHash => ({ resourceHash, bytes }))));
    expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.resources.map(resource => resource.resourceHash)).toEqual(hashes);
    for (let i = 0; i < 3; i++) { decoded.resources[i].bytes[0] = 90 + i; for (let j = i + 1; j < 3; j++) expect(decoded.resources[j].bytes[0]).toBe(1); }
  });

  it('rejects a raw path with a valid prefix and forbidden suffix before any PPJ candidate can escape', async () => {
    const base = { 'manifest.json': utf8(JSON.stringify({ projectSchemaId: 'interiors.project/alpha-1', projectSchemaVersion: 1, sourceProjectId: 'p', canonicalProjectPath: 'project/project.json' })), 'checksums.json': utf8('[]'), 'project/project.json': utf8('{"projectSchemaId":"interiors.project/alpha-1"}') };
    for (const path of ['manifest.json.bak', 'checksums.json/extra', 'project/project.json.fake', `custom/${'a'.repeat(64)}.glb.extra`, `catalog/${'a'.repeat(64)}.asset.extra`]) {
      expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...base, [path]: new Uint8Array([1]) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PATH_UNSAFE' });
    }
  });


  it('admits an exactly 1 MiB valid manifest and bounded ledger across multiple real ZIP chunks', async () => {
    const good = unzipSync(await ready()); const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    for (const path of ['manifest.json', 'checksums.json']) {
      const padded = new Uint8Array(1024 * 1024); padded.fill(32); padded.set(good[path]);
      expect((await codec.decode(zipSync({ ...good, [path]: padded }, { level: 0 }))).kind).toBe('decoded');
    }
  });


  it('preserves the maximum legal scalar source ID and rejects an unregistered safe-integer version only after Project integrity', async () => {
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject); const source = { ...project(), projectId: 'p'.repeat(256) };
    const decoded = await codec.decode(await ready(source)); expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.metadata.sourceProjectId).toBe(source.projectId); expect(decoded.decodedProject.projectId).toBe(source.projectId);
    const entries = unzipSync(await ready()); const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])); manifest.projectSchemaVersion = Number.MAX_SAFE_INTEGER; entries['manifest.json'] = utf8(JSON.stringify(manifest));
    expect(await codec.decode(zipSync(entries, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    entries['project/project.json'][0] = 63;
    expect(await codec.decode(zipSync(entries, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
  });


  it('reads a supported DEFLATE envelope and retains a typed container failure from its real entry lease', async () => {
    const source = project(); const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    const compressed = zipSync(unzipSync(await ready(source)), { level: 6 });
    const decoded = await codec.decode(compressed); expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.decodedProject).toStrictEqual(source);
    const bytes = compressed.slice(); const view = new DataView(bytes.buffer); expect(view.getUint16(8, true)).toBe(8);
    const data = 30 + view.getUint16(26, true) + view.getUint16(28, true);
    bytes[data] = bytes[data] & ~6 | 6; // Reserved DEFLATE BTYPE=3 in the real first manifest entry.
    expect(await codec.decode(bytes)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' });
  });


  it('does not accept a future version of either registered schema ID or peek it into the shared-alpha route', async () => {
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject);
    for (const base of [unzipSync(await ready()), unzipSync((await oldBackup(project())).bytes)]) {
      const manifest = JSON.parse(new TextDecoder().decode(base['manifest.json'])); manifest.projectSchemaVersion = 2;
      expect(await codec.decode(zipSync({ ...base, 'manifest.json': utf8(JSON.stringify(manifest)) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
    const base = unzipSync((await oldBackup(project())).bytes); const bytes = utf8('{"projectSchemaId":"interiors.project/alpha-1","schemaVersion":1,"projectId":"p"}');
    const manifest = JSON.parse(new TextDecoder().decode(base['manifest.json'])); manifest.projectSchemaVersion = 2; manifest.entries[0].byteLength = bytes.length; manifest.entries[0].sha256 = await checksum.sha256Bytes(bytes);
    expect(await codec.decode(zipSync({ ...base, 'project/project.json': bytes, 'manifest.json': utf8(JSON.stringify(manifest)), 'checksums.json': utf8(JSON.stringify({ algorithm: 'sha-256', entries: [{ path: 'project/project.json', sha256: manifest.entries[0].sha256 }] })) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('restores a legacy exact resource when declarations are reordered and rejects uppercase legacy mappings at the manifest boundary', async () => {
    const resource = new Uint8Array([1, 2, 3, 4]); const hash = await checksum.sha256Bytes(resource); const path = `custom/${hash}.glb`;
    const source = { ...project(), assetDefinitionRefs: [definition(hash, resource.length)] }; const bytes = utf8(canonicalProjectSerializer.serialize(source));
    const base = unzipSync((await oldBackup(project())).bytes); const manifest = JSON.parse(new TextDecoder().decode(base['manifest.json']));
    manifest.entries = [{ path, byteLength: resource.length, mediaType: 'model/gltf-binary', sha256: hash }, { path: 'project/project.json', byteLength: bytes.length, mediaType: 'application/json', sha256: await checksum.sha256Bytes(bytes) }]; manifest.resources = [{ path, resourceHash: hash }];
    const entries = { ...base, [path]: resource, 'project/project.json': bytes, 'manifest.json': utf8(JSON.stringify(manifest)), 'checksums.json': utf8(JSON.stringify({ algorithm: 'sha-256', entries: manifest.entries.map(({ path, sha256 }: { path: string; sha256: string }) => ({ path, sha256 })) })) };
    const codec = new RuntimePortableBackupCodec(checksum, acceptProject); const decoded = await codec.decode(zipSync(entries, { level: 0 }));
    expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.schema).toBe('runtime-v1-legacy'); expect(decoded.decodedProject).toStrictEqual(source); expect(decoded.resources).toEqual([{ resourceHash: hash, bytes: resource }]);
    manifest.resources[0].resourceHash = hash.toUpperCase();
    expect(await codec.decode(zipSync({ ...entries, 'manifest.json': utf8(JSON.stringify(manifest)) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
  });


  it('owns the validated backup timestamp before the first asynchronous callback can change the caller input', async () => {
    const input = { project: project(), createdAt, resources: [] };
    const encoded = await new RuntimePortableBackupCodec(checksum, () => { input.createdAt = 'changed-after-validation'; return { kind: 'accepted' }; }).encode(input);
    expect(encoded.kind).toBe('encoded'); if (encoded.kind !== 'encoded') throw new Error('not encoded');
    expect(encoded.metadata.createdAt).toBe(createdAt);
    const decoded = await new RuntimePortableBackupCodec(checksum, acceptProject).decode(encoded.bytes);
    expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded'); expect(decoded.metadata.createdAt).toBe(createdAt);
  });


  it('retains typed manifest failures for missing common arrays and invalid mapping/header strings on an unregistered route', async () => {
    const good = unzipSync(await ready()); const base = JSON.parse(new TextDecoder().decode(good['manifest.json'])); base.projectSchemaId = 'interiors.project/future';
    const variants = [{ ...base, sourceProjectId: { utf16be: '2AA' } },
      ...['entries', 'resources'].map(key => { const copy = { ...base }; delete copy[key]; return copy; }),
      ...[`prefixcustom/${'a'.repeat(64)}.glb`, `custom/${'a'.repeat(64)}.glb.suffix`].map(path => ({ ...base, resources: [{ path, resourceHash: 'a'.repeat(64) }] }))];
    for (const manifest of variants) expect(await new RuntimePortableBackupCodec(checksum, acceptProject).decode(zipSync({ ...good, 'manifest.json': utf8(JSON.stringify(manifest)) }, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });
  });

});
