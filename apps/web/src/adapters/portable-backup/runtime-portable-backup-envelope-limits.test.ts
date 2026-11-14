import { expect, it, rstest } from '@rstest/core';
import { RuntimePortableBackupCodec, type RuntimePortableResource } from './runtime-portable-backup-codec';
import { encodeRuntimeV1Project } from './runtime-v1-wire';
import { unzipSync, zipSync } from 'fflate';

const mib = 1024 * 1024;
const checksum = { sha256Bytes: async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('') };
const acceptFixture = () => ({ kind: 'accepted' } as const);
const id = (prefix: string, index = 0) => { const suffix = `${prefix}${index}`; return '\u0001'.repeat(256 - suffix.length) + suffix; };

/** Valid GLB 2.0 static triangle with an owned padded BIN; padding is part of its exact hash. */
function glb(totalBytes: number, stamp: number): Uint8Array {
  let binaryLength = totalBytes - 512; let jsonBytes = new Uint8Array();
  for (let i = 0; i < 3; i++) {
    const document = { asset: { version: '2.0' }, buffers: [{ byteLength: binaryLength }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [0.001, 0, 0.001] }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
    const raw = new TextEncoder().encode(JSON.stringify(document)); jsonBytes = new Uint8Array(Math.ceil(raw.length / 4) * 4); jsonBytes.fill(32); jsonBytes.set(raw);
    binaryLength = totalBytes - 28 - jsonBytes.length;
  }
  const bytes = new Uint8Array(totalBytes); const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, totalBytes, true);
  view.setUint32(12, jsonBytes.length, true); view.setUint32(16, 0x4e4f534a, true); bytes.set(jsonBytes, 20);
  const binaryHeader = 20 + jsonBytes.length; view.setUint32(binaryHeader, binaryLength, true); view.setUint32(binaryHeader + 4, 0x004e4942, true);
  view.setFloat32(binaryHeader + 8 + 12, 0.001, true); view.setFloat32(binaryHeader + 8 + 32, 0.001, true);
  view.setUint32(totalBytes - 4, stamp, true); return bytes;
}

/** Independent central/local/CRC inspection; does not allocate a second inflated 180 MiB payload. */
function storeMetrics(archive: Uint8Array) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength); const end = archive.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50); expect(view.getUint16(end + 4, true)).toBe(0); expect(view.getUint16(end + 6, true)).toBe(0); expect(view.getUint16(end + 20, true)).toBe(0);
  const count = view.getUint16(end + 10, true); expect(view.getUint16(end + 8, true)).toBe(count);
  const table = Uint32Array.from({ length: 256 }, (_, initial) => { let value = initial; for (let i = 0; i < 8; i++) value = value >>> 1 ^ (value & 1 ? 0xedb88320 : 0); return value >>> 0; });
  let cursor = view.getUint32(end + 16, true); let payloadBytes = 0; let predicted = 22; let manifestBytes = 0; let projectBytes = 0;
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50); expect(view.getUint16(cursor + 8, true)).toBe(0); expect(view.getUint16(cursor + 10, true)).toBe(0);
    expect(view.getUint16(cursor + 30, true)).toBe(0); expect(view.getUint16(cursor + 32, true)).toBe(0);
    const nameLength = view.getUint16(cursor + 28, true); const local = view.getUint32(cursor + 42, true); const length = view.getUint32(cursor + 24, true);
    const pathBytes = archive.subarray(cursor + 46, cursor + 46 + nameLength); expect(pathBytes.every(byte => byte >= 33 && byte <= 126)).toBe(true);
    const path = new TextDecoder().decode(pathBytes); if (path === 'manifest.json') manifestBytes = length; if (path === 'project/project.json') projectBytes = length;
    expect(view.getUint32(local, true)).toBe(0x04034b50); expect(view.getUint16(local + 6, true)).toBe(0); expect(view.getUint16(local + 8, true)).toBe(0);
    expect(view.getUint16(local + 28, true)).toBe(0); expect(view.getUint16(local + 26, true)).toBe(nameLength);
    expect(view.getUint32(cursor + 20, true)).toBe(length); expect(view.getUint32(local + 18, true)).toBe(length); expect(view.getUint32(local + 22, true)).toBe(length);
    const data = archive.subarray(local + 30 + nameLength, local + 30 + nameLength + length); let crc = 0xffffffff;
    for (const byte of data) crc = crc >>> 8 ^ table[(crc ^ byte) & 255]; crc = (crc ^ 0xffffffff) >>> 0;
    expect(view.getUint32(cursor + 16, true)).toBe(crc); expect(view.getUint32(local + 14, true)).toBe(crc);
    payloadBytes += length; predicted += 76 + 2 * nameLength + length; cursor += 46 + nameLength;
  }
  expect(cursor).toBe(end); expect(archive.length).toBe(predicted);
  return { entries: count, payloadBytes, containerBytes: archive.length, manifestBytes, projectBytes };
}

it('executes the current-policy full STORE envelope proof at 180 MiB, 50 MiB per entry, and all other V1 collection caps', async () => {
  const resources: RuntimePortableResource[] = []; const lengths = Array.from({ length: 100 }, (_, i) => i === 0 ? 50 * mib : i === 99 ? 1_377_112 : 1_376_916);
  expect(lengths.reduce((a, b) => a + b, 0)).toBe(180 * mib);
  for (let i = 0; i < lengths.length; i++) { const bytes = glb(lengths[i], i + 1); resources.push({ bytes, resourceHash: await checksum.sha256Bytes(bytes) }); }
  const source = { schemaVersion: 1, projectId: '\ud800'.repeat(256), name: '\u0001'.repeat(256), createdAt: '-271821-04-20T00:00:00.000Z', updatedAt: '+275760-09-13T00:00:00.000Z', lifecycle: 'active',
    level: { levelId: id('l'), vertices: Array.from({ length: 600 }, (_, i) => ({ vertexId: id('v', i), xMm: i, zMm: -0 })),
      wallSegments: Array.from({ length: 300 }, (_, i) => ({ wallSegmentId: id('w', i), startVertexId: id('v', 2 * i), endVertexId: id('v', 2 * i + 1), thicknessMm: 1000 })),
      rooms: Array.from({ length: 50 }, (_, i) => ({ roomId: id('r', i), faceFingerprint: id('f', i), heightMm: 10000, name: id('n', i), type: 'living-room' })),
      openings: Array.from({ length: 200 }, (_, i) => ({ openingId: id('o', i), wallSegmentId: id('w', i), offsetMm: -0, widthMm: 100000, heightMm: 10000, sillMm: -0, kind: 'Door', swingSide: undefined })) },
    assetInstances: Array.from({ length: 250 }, (_, i) => ({ assetInstanceId: id('i', i), anchorClass: 'floor', roomId: id('r', i % 50), label: id('label', i), xMm: -0, zMm: -100000, widthMm: 100000, depthMm: 100000, heightMm: 100000,
      color: '#a76a3b', assetDefinitionId: undefined, colorVariantId: [[[[['alpha-warm-wood']]]]], elevationMm: -0, locked: true, yawRadians: -Number.MAX_VALUE, yawStep: -0 })),
    assetDefinitionRefs: resources.map((resource, i) => ({ assetDefinitionId: id('d', i), displayName: id('D', i), byteLength: resource.bytes.length, widthMm: 100000, depthMm: 100000, heightMm: 100000, format: 'glb', resourceHash: resource.resourceHash,
      source: 'CatalogVersion', catalogAssetId: id('C', i), catalogVersion: id('V', i), catalogEnvelopeHash: 'A'.repeat(64) })) };
  // This is a grammar/size corpus. Its artificial Plan is not claimed to pass domain/host acceptance.
  const member = encodeRuntimeV1Project(source); expect(member.kind).toBe('encoded'); if (member.kind !== 'encoded') throw new Error('invalid maximum fixture');
  const codec = new RuntimePortableBackupCodec(checksum, acceptFixture); const encoded = await codec.encode({ project: source, resources, createdAt: '2026-11-04T00:00:00.000Z' });
  expect(encoded.kind).toBe('encoded'); if (encoded.kind !== 'encoded') throw new Error('not encoded'); resources.length = 0;
  const metrics = storeMetrics(encoded.bytes); expect(metrics.entries).toBe(103); expect(metrics.projectBytes).toBe(member.bytes.length);
  expect(metrics.manifestBytes).toBeLessThanOrEqual(mib); expect(metrics.containerBytes).toBeLessThanOrEqual(190 * mib); expect(metrics.payloadBytes).toBeLessThanOrEqual(280 * mib);
  const decoded = await codec.decode(encoded.bytes); expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded');
  expect(decoded.decodedProject).toStrictEqual(source); expect(decoded.resources).toHaveLength(100); expect(decoded.resources.reduce((sum, resource) => sum + resource.bytes.length, 0)).toBe(180 * mib);
  expect(decoded.resources.map(resource => resource.resourceHash)).toEqual(source.assetDefinitionRefs.map(def => def.resourceHash).sort());
  for (const resource of decoded.resources) expect(await checksum.sha256Bytes(resource.bytes)).toBe(resource.resourceHash);
  console.info('S3_ENVELOPE_STORE_PROOF', JSON.stringify({ ...metrics, resourceBytes: 180 * mib, largestResourceBytes: 50 * mib, definitionCount: 100, projectMetrics: member.metrics }));
}, 120_000);

it('rejects the exact generic container maximum plus one byte before copying, parsing, or hashing', async () => {
  const calls: string[] = []; const codec = new RuntimePortableBackupCodec({ sha256Bytes: async () => { calls.push('hash'); return ''; } }, () => { calls.push('domain'); return { kind: 'accepted' }; });
  const copies = rstest.spyOn(Uint8Array.prototype, 'slice');
  try {
    expect(await codec.decode(new Uint8Array(200 * mib + 1))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_BYTES_LIMIT' });
    expect(copies).not.toHaveBeenCalled(); expect(calls).toEqual([]);
  } finally { copies.mockRestore(); }
  // Exactly 200 MiB reaches the index parser and fails for its real malformed ZIP, not the size cap.
  expect(await codec.decode(new Uint8Array(200 * mib))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' });
});


it('rejects excess provided-source bytes before copying or calling a Project validator', async () => {
  const calls: string[] = []; const codec = new RuntimePortableBackupCodec(checksum, () => { calls.push('domain'); return { kind: 'rejected', reasonCode: 'DOMAIN_SENTINEL' } as const; });
  const project = { schemaVersion: 1, projectId: 'p', name: 'P', createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', lifecycle: 'active',
    level: { levelId: 'l', vertices: [], wallSegments: [], rooms: [], openings: [] }, assetInstances: [], assetDefinitionRefs: [] };
  const input = { project, createdAt: project.createdAt, resources: [{ resourceHash: 'a'.repeat(64), bytes: new Uint8Array(50 * mib + 1) }] };
  expect(await codec.encode(input)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  const shared = new Uint8Array(45 * mib + 1);
  expect(await codec.encode({ ...input, resources: Array.from({ length: 4 }, () => ({ resourceHash: 'a'.repeat(64), bytes: shared })) })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  expect(calls).toEqual([]);
});


it('checks actual archive length at the 190 MiB policy boundary before readonly domain validation', async () => {
  const source = { schemaVersion: 1, projectId: 'p', name: 'P', createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', lifecycle: 'active',
    level: { levelId: 'l', vertices: [], wallSegments: [], rooms: [], openings: [] }, assetInstances: [], assetDefinitionRefs: [] };
  const encoder = new RuntimePortableBackupCodec(checksum, acceptFixture); const encoded = await encoder.encode({ project: source, resources: [], createdAt: source.createdAt });
  expect(encoded.kind).toBe('encoded'); if (encoded.kind !== 'encoded') throw new Error('not encoded');
  const base = encoded.bytes; const oldDirectory = new DataView(base.buffer).getUint32(base.length - 6, true);
  for (const extra of [0, 1]) {
    const bytes = new Uint8Array(190 * mib + extra); const gap = bytes.length - base.length;
    bytes.set(base.subarray(0, oldDirectory)); bytes.set(base.subarray(oldDirectory), oldDirectory + gap);
    new DataView(bytes.buffer).setUint32(bytes.length - 6, oldDirectory + gap, true);
    const calls: string[] = []; const codec = new RuntimePortableBackupCodec(checksum, () => { calls.push('domain'); return { kind: 'rejected', reasonCode: 'DOMAIN_SENTINEL' } as const; });
    expect(await codec.decode(bytes)).toEqual(extra ? { kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' } : { kind: 'project-validation-rejected', reasonCode: 'DOMAIN_SENTINEL' });
    expect(calls).toEqual(extra ? [] : ['domain']);
  }
}, 120_000);

it('checks declared portable resource entry size before the domain hook and before its corrupt payload hash', async () => {
  const hash = 'a'.repeat(64); const path = `custom/${hash}.glb`;
  const source = { schemaVersion: 1, projectId: 'p', name: 'P', createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', lifecycle: 'active',
    level: { levelId: 'l', vertices: [], wallSegments: [], rooms: [], openings: [] }, assetInstances: [], assetDefinitionRefs: [{ assetDefinitionId: 'd', displayName: 'D', byteLength: 4, widthMm: 1, depthMm: 1, heightMm: 1, format: 'glb', resourceHash: hash }] };
  const member = encodeRuntimeV1Project(source); expect(member.kind).toBe('encoded'); if (member.kind !== 'encoded') throw new Error('not encoded');
  const empty = await new RuntimePortableBackupCodec(checksum, acceptFixture).encode({ project: { ...source, assetDefinitionRefs: [] }, resources: [], createdAt: source.createdAt });
  if (empty.kind !== 'encoded') throw new Error('not encoded'); const files = unzipSync(empty.bytes); const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
  manifest.entries = [{ byteLength: member.bytes.length, mediaType: 'application/json', path: 'project/project.json', sha256: await checksum.sha256Bytes(member.bytes) }, { byteLength: 50 * mib + 1, mediaType: 'model/gltf-binary', path, sha256: hash }]; manifest.resources = [{ path, resourceHash: hash }];
  files['project/project.json'] = member.bytes.slice(); files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest)); files['checksums.json'] = new TextEncoder().encode(JSON.stringify({ algorithm: 'sha-256', entries: manifest.entries.map(({ path, sha256 }: { path: string; sha256: string }) => ({ path, sha256 })) })); files[path] = new Uint8Array(50 * mib + 1);
  const calls: string[] = []; const codec = new RuntimePortableBackupCodec(checksum, () => { calls.push('domain'); return { kind: 'rejected', reasonCode: 'DOMAIN_SENTINEL' } as const; });
  expect(await codec.decode(zipSync(files, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' }); expect(calls).toEqual([]);
}, 120_000);

it('admits an exact 10 MiB wire Project member and rejects one further byte before its wrong checksum', async () => {
  const source = { schemaVersion: 1, projectId: 'p', name: 'P', createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', lifecycle: 'active',
    level: { levelId: 'l', vertices: [], wallSegments: [], rooms: [], openings: [] }, assetInstances: [], assetDefinitionRefs: [] };
  const codec = new RuntimePortableBackupCodec(checksum, acceptFixture); const encoded = await codec.encode({ project: source, resources: [], createdAt: source.createdAt });
  if (encoded.kind !== 'encoded') throw new Error('not encoded'); const files = unzipSync(encoded.bytes); const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
  const bytes = new Uint8Array(10 * mib); bytes.fill(32); bytes.set(files['project/project.json']); manifest.entries[0].byteLength = bytes.length; manifest.entries[0].sha256 = await checksum.sha256Bytes(bytes);
  files['project/project.json'] = bytes; files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest)); files['checksums.json'] = new TextEncoder().encode(JSON.stringify({ algorithm: 'sha-256', entries: [{ path: 'project/project.json', sha256: manifest.entries[0].sha256 }] }));
  const decoded = await codec.decode(zipSync(files, { level: 0 })); expect(decoded.kind).toBe('decoded'); if (decoded.kind !== 'decoded') throw new Error('not decoded'); expect(decoded.decodedProject).toStrictEqual(source); expect(decoded.projectBytes.length).toBe(10 * mib);
  files['project/project.json'] = new Uint8Array(10 * mib + 1); manifest.entries[0].byteLength = 10 * mib + 1; files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  expect(await codec.decode(zipSync(files, { level: 0 }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
});
