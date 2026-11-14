import { describe, expect, it } from '@rstest/core';
import { decodeRuntimeV1LegacyProject, decodeRuntimeV1Project, encodeRuntimeV1Project, RUNTIME_V1_SCHEMA_ID } from './runtime-v1-wire';
import { scanRuntimeV1Json } from './runtime-v1-raw-scanner';

const source = () => ({ schemaVersion: 1, projectId: 'p', name: 'P', createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '+010000-01-01T00:00:00.000Z', lifecycle: 'active',
  level: { levelId: 'l', vertices: [{ vertexId: 'v0', xMm: -100000, zMm: 0 }, { vertexId: 'v1', xMm: 100000, zMm: 100000 }],
    wallSegments: [{ wallSegmentId: 'w', startVertexId: 'v0', endVertexId: 'v1', thicknessMm: 20 }],
    rooms: [{ roomId: 'r', faceFingerprint: 'rectangular:r', heightMm: 500, name: 'R', type: 'other' }],
    openings: [{ openingId: 'o', wallSegmentId: 'w', offsetMm: 0, widthMm: 1, heightMm: 1, sillMm: 0, kind: 'Door', swingSide: 'left' }] },
  assetInstances: [{ assetInstanceId: 'i', anchorClass: 'floor', roomId: 'r', label: 'I', xMm: 0, zMm: 1, widthMm: 1, depthMm: 1, heightMm: 1,
    color: '#ABCDEF', assetDefinitionId: 'd', elevationMm: 0, locked: true, yawRadians: 0.5, yawStep: 0 }],
  assetDefinitionRefs: [{ assetDefinitionId: 'd', displayName: 'D', byteLength: 1, widthMm: 1, depthMm: 1, heightMm: 1, format: 'glb', resourceHash: 'a'.repeat(64),
    source: 'CatalogVersion', catalogAssetId: 'a', catalogVersion: 'v', catalogEnvelopeHash: 'b'.repeat(64) }] });
const utf8 = (text: string) => new TextEncoder().encode(text);
function replace(path: string, value: unknown): unknown {
  // Each case owns a fresh, known JSON fixture. This assertion is test-data navigation only.
  const fixture = source();
  const keys = path.split('/');
  let record = fixture as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) record = record[key] as Record<string, unknown>;
  record[keys[keys.length - 1]] = value;
  return fixture;
}
function roundTrip(value: unknown): void {
  const encoded = encodeRuntimeV1Project(value);
  expect(encoded.kind).toBe('encoded');
  if (encoded.kind !== 'encoded') throw new Error('not encoded');
  const decoded = decodeRuntimeV1Project(encoded.bytes);
  expect(decoded.kind).toBe('decoded');
  if (decoded.kind !== 'decoded') throw new Error('not decoded');
  expect(decoded.project).toStrictEqual(value);
}
function rejectedSnapshot(value: unknown): void {
  const rejection = { kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' };
  expect(encodeRuntimeV1Project(value)).toEqual(rejection);
  expect(decodeRuntimeV1Project(utf8(JSON.stringify(Object.assign({ projectSchemaId: RUNTIME_V1_SCHEMA_ID }, value))))).toEqual(rejection);
}

describe('closed V1 field contract', () => {
  it.each([
    ['level/vertices/0/xMm', -100000, 100000], ['level/vertices/0/zMm', -100000, 100000],
    ['level/wallSegments/0/thicknessMm', 20, 1000], ['level/rooms/0/heightMm', 500, 10000],
    ['level/openings/0/offsetMm', 0, 100000], ['level/openings/0/widthMm', 1, 100000], ['level/openings/0/heightMm', 1, 10000], ['level/openings/0/sillMm', 0, 10000],
    ['assetInstances/0/xMm', -100000, 100000], ['assetInstances/0/zMm', -100000, 100000], ['assetInstances/0/widthMm', 1, 100000],
    ['assetInstances/0/depthMm', 1, 100000], ['assetInstances/0/heightMm', 1, 100000], ['assetInstances/0/elevationMm', 0, 0], ['assetInstances/0/yawStep', 0, 7],
    ['assetDefinitionRefs/0/byteLength', 1, Number.MAX_SAFE_INTEGER], ['assetDefinitionRefs/0/widthMm', 1, 100000],
    ['assetDefinitionRefs/0/depthMm', 1, 100000], ['assetDefinitionRefs/0/heightMm', 1, 100000]
  ].map(([path, min, max]) => ({ path: String(path), min: Number(min), max: Number(max) })))('preserves inclusive integer range $path and rejects both outside values and non-integers', ({ path, min, max }) => {
    roundTrip(replace(path, min)); roundTrip(replace(path, max));
    for (const value of [min - 1, max + 1, min + 0.5, String(min), null, false]) {
      rejectedSnapshot(replace(path, value));
    }
  });
  it('accepts every room type and variant/color pair, without turning nested arrays into strings', () => {
    for (const type of ['bathroom', 'bedroom', 'hallway', 'kitchen', 'living-room', 'office', 'other', 'storage']) roundTrip(replace('level/rooms/0/type', type));
    const pairs = [['alpha-warm-wood', '#a76a3b'], ['alpha-blue', '#416b91'], ['alpha-violet', '#716796'], ['alpha-walnut', '#8c6e4c'],
      ['alpha-terracotta', '#835a45'], ['alpha-forest', '#536d62'], ['alpha-berry', '#8a4f54']];
    for (const [variant, color] of pairs) {
      const fixture = source();
      roundTrip({ ...fixture, assetInstances: [{ ...fixture.assetInstances[0], assetDefinitionId: undefined, color, colorVariantId: [[variant]] }] });
    }
  });
  it('accepts both door swing and wall sides with all wall ranges', () => {
    for (const side of ['left', 'right']) {
      roundTrip(replace('level/openings/0/swingSide', side));
      for (const offsetMm of [-0, 100000]) for (const elevationMm of [-0, 10000]) for (const heightMm of [1, 10000]) {
        const fixture = source();
        const wall = { assetInstanceId: 'wallitem', anchorClass: 'wall', wallSegmentId: 'w', side, offsetMm, elevationMm, heightMm,
          label: 'Wall', widthMm: 100000, depthMm: 100000, color: '#ABCDEF', locked: true, assetDefinitionId: 'd' };
        roundTrip({ ...fixture, assetInstances: [wall] });
        for (const changed of [{ ...wall, offsetMm: -1 }, { ...wall, offsetMm: 100001 }, { ...wall, elevationMm: -1 }, { ...wall, elevationMm: 10001 },
          { ...wall, heightMm: 0 }, { ...wall, heightMm: 10001 }, { ...wall, side: '' }, { ...wall, wallSegmentId: 'missing' }]) {
          rejectedSnapshot({ ...fixture, assetInstances: [changed] });
        }
      }
    }
  });
  it('keeps every finite canonical yaw without creating an absent yawStep', () => {
    const fixture = source();
    const { yawStep: _yawStep, ...item } = fixture.assetInstances[0];
    for (const yawRadians of [-0, Number.MIN_VALUE, -Number.MAX_VALUE, 1e21, -1e-7, 0.5]) roundTrip({ ...fixture, assetInstances: [{ ...item, yawRadians }] });
  });
  it('keeps Unicode/code-unit boundary strings and maximum S length exactly', () => {
    for (const value of [' A B ', '\u0080', '\u07ff', '\u0800', '\ud7ff', '\ud800', '\udbff', '\udc00', '\udfff', '\ue000', '\uffff', '\ud800\udc00', '\udbff\udfff', '\ud800A', '\ud800AB', '\udc00A', 'A\udbff', '\u0000'.repeat(256)]) roundTrip(replace('projectId', value));
    roundTrip({ ...source(), createdAt: '+010000-01-01T00:00:00.000Z', updatedAt: '0000-01-01T00:00:00.000Z' });
  });
  it.each([
    ['projectId', null], ['projectId', 'X'.repeat(257)], ['name', ''], ['lifecycle', ''], ['schemaVersion', 2], ['level/levelId', {}],
    ['assetInstances', {}], ['assetInstances', [null]], ['assetInstances', [{}]], ['assetDefinitionRefs', null], ['level/vertices', false],
    ['level/rooms/0/type', 'unknown'], ['level/rooms/0/name', null], ['level/openings/0/kind', 'door'], ['level/openings/0/swingSide', ''],
    ['assetInstances/0/anchorClass', ''], ['assetInstances/0/color', '#ABCDEG'], ['assetInstances/0/color', 'ABCDEF'], ['assetInstances/0/label', null],
    ['assetInstances/0/color', 'x#ABCDEF'], ['assetInstances/0/color', '#ABCDEF0'], ['assetInstances/0/assetDefinitionId', 'missing'],
    ['assetDefinitionRefs/0/format', 'GLB'], ['assetDefinitionRefs/0/resourceHash', 'a'.repeat(63)], ['assetDefinitionRefs/0/resourceHash', 'a'.repeat(65)],
    ['assetDefinitionRefs/0/source', 'catalogversion'], ['assetDefinitionRefs/0/catalogEnvelopeHash', 'z'.repeat(64)], ['assetDefinitionRefs/0/catalogVersion', ' v'],
  ].map(([path, value]) => ({ path: String(path), value })))('rejects wrong ordinary field $path', ({ path, value }) => {
    rejectedSnapshot(replace(path, value));
  });
  it('checks closed required and optional fields on incoming wire records, not only source encoding', () => {
    const text = JSON.stringify({ projectSchemaId: RUNTIME_V1_SCHEMA_ID, ...source() });
    for (const value of [text.replace('"roomId":"r"', '"roomId":"r","renderer":{}'), text.replace('"vertexId":"v0",', ''), text.replace('"name":"P",', ''),
      text.replace('"projectId":"p"', '"projectId":{"undefined":true}'), text.replace('"color":"#ABCDEF"', '"color":{"utf16be":"2AA"}'),
      text.replace('"elevationMm":0', '"elevationMm":{"undefined":false}'), text.replace('"locked":true', '"locked":{"undefined":true,"extra":0}'),
      text.replace(RUNTIME_V1_SCHEMA_ID, 'interiors.project/alpha-1'), text.replace(RUNTIME_V1_SCHEMA_ID, ''), text.replace('"yawRadians":0.5', '"yawRadians":1e999')]) {
      expect(decodeRuntimeV1Project(utf8(value))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
  });
  it('gives leading-zero syntax priority at the same overflowing array event', () => {
    const prefix = Array.from({ length: 1024 }, () => '0').join(',');
    for (const token of ['01', '-01']) expect(scanRuntimeV1Json(utf8(`[${prefix},${token}]`))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('counts every RFC6901 escape in pointer admission, including the exact 128-byte edge', () => {
    for (const value of ['~', '/']) {
      const exact = scanRuntimeV1Json(utf8(`{"${value.repeat(63)}A":0}`));
      expect(exact.kind).toBe('scanned');
      if (exact.kind !== 'scanned') throw new Error('not scanned');
      expect(exact.metrics.maximumPointerBytes).toBe(128);
      expect(scanRuntimeV1Json(utf8(`{"${value.repeat(64)}":0}`))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    }
  });
  it('decodes all hexadecimal escape branches and rejects immediate neighbors', () => {
    const text = '"\\u0009\\u0041\\u0046\\u0061\\u0066\\u00AF\\u00af"';
    const parsed = scanRuntimeV1Json(utf8(text));
    expect(parsed.kind).toBe('scanned');
    if (parsed.kind !== 'scanned') throw new Error('not scanned');
    expect(parsed.root).toMatchObject({ kind: 'string', value: '\tAFaf¯¯' });
    for (const last of ['/', ':', '@', 'G', '`', 'g']) expect(scanRuntimeV1Json(utf8(`"\\u000${last}"`))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('charges mixed non-ASCII object keys and literal bytes exactly', () => {
    for (const key of ['éa', '\u0080']) {
      const result = scanRuntimeV1Json(utf8(`{"${key}":true}`));
      expect(result.kind).toBe('scanned');
      if (result.kind !== 'scanned') throw new Error('not scanned');
      expect(result.metrics.decodedCharge).toBe(3 * key.length + 4);
    }
  });
  it('normalizes root and level writer order without reordering nested records or changing the source', () => {
    const original = source();
    const reversed: Record<string, unknown> = Object.fromEntries(Object.entries(original).reverse());
    reversed.level = Object.fromEntries(Object.entries(original.level).reverse());
    const before = Object.keys(reversed.level as object);
    const first = encodeRuntimeV1Project(original); const second = encodeRuntimeV1Project(reversed);
    expect(first.kind).toBe('encoded'); expect(second.kind).toBe('encoded');
    if (first.kind !== 'encoded' || second.kind !== 'encoded') throw new Error('not encoded');
    expect(second.bytes).toStrictEqual(first.bytes);
    expect(Object.keys(reversed.level as object)).toEqual(before);
  });
  it('rejects same-length noncanonical legacy root order rather than ignoring byte differences', () => {
    const text = JSON.stringify(source());
    const reordered = text.replace('"schemaVersion":1,"projectId":"p"', '"projectId":"p","schemaVersion":1');
    expect(reordered.length).toBe(text.length);
    expect(decodeRuntimeV1LegacyProject(utf8(reordered))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('uses non-SHA room fingerprints as exact legacy witnesses, including lowercase SHA prefixes and suffixes', () => {
    const fixture = source();
    const { type: _type, ...room } = fixture.level.rooms[0];
    for (const faceFingerprint of [`x${'a'.repeat(64)}`, `${'a'.repeat(64)}x`]) {
      const legacy = { ...fixture, level: { ...fixture.level, rooms: [{ ...room, faceFingerprint }] }, assetInstances: [], assetDefinitionRefs: [] };
      expect(decodeRuntimeV1LegacyProject(utf8(JSON.stringify(legacy))).kind).toBe('decoded');
    }
  });
  it('keeps scanner acceptance distinct from Project acceptance and rejects primitive Project roots', () => {
    for (const text of ['{}', '[{}]', '{"x":{}}']) expect(scanRuntimeV1Json(utf8(text)).kind).toBe('scanned');
    for (const text of ['null', 'true', '0', '"text"', '[]', '{}']) expect(decodeRuntimeV1Project(utf8(text))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    expect(scanRuntimeV1Json(new Uint8Array([34, 0xed, 0xbf, 0xbf, 34]))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('requires unique unused item/opening IDs independently of reference checks', () => {
    const fixture = source();
    roundTrip({ ...fixture, assetInstances: [fixture.assetInstances[0], { ...fixture.assetInstances[0], assetInstanceId: 'i2' }] });
    roundTrip({ ...fixture, level: { ...fixture.level, openings: [fixture.level.openings[0], { ...fixture.level.openings[0], openingId: 'o2' }] } });
    rejectedSnapshot({ ...fixture, assetInstances: [fixture.assetInstances[0], fixture.assetInstances[0]] });
    rejectedSnapshot({ ...fixture, level: { ...fixture.level, openings: [fixture.level.openings[0], fixture.level.openings[0]] } });
  });
  it('rejects deeply nested source arrays at admission, without walking to JavaScript stack exhaustion', () => {
    const fixture = source();
    let value: unknown = 'alpha-blue';
    for (let i = 0; i < 10000; i++) value = [value];
    expect(encodeRuntimeV1Project({ ...fixture, assetInstances: [{ ...fixture.assetInstances[0], colorVariantId: value }] })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });
  it('bounds source strings before constructing their raw JSON token and does not invoke accessors', () => {
    expect(encodeRuntimeV1Project(replace('projectId', 'X'.repeat(1366)))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    const calls = { getter: 0, inheritedMap: 0 };
    const fixture = source();
    const accessor = Object.defineProperty({ ...fixture }, 'name', { enumerable: true, get: () => { calls.getter++; return 'P'; } });
    expect(encodeRuntimeV1Project(accessor)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    const array = [...fixture.assetInstances];
    Object.setPrototypeOf(array, { map: () => { calls.inheritedMap++; return []; } });
    expect(encodeRuntimeV1Project({ ...fixture, assetInstances: array })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    expect(calls).toEqual({ getter: 0, inheritedMap: 0 });
  });
});
