import { describe, expect, it } from '@rstest/core';
import { encodeRuntimeV1Utf16, scanRuntimeV1Json } from './runtime-v1-raw-scanner';
import { decodeRuntimeV1LegacyProject, decodeRuntimeV1Project, encodeRuntimeV1Project, RUNTIME_V1_SCHEMA_ID } from './runtime-v1-wire';
const utf8 = (text: string) => new TextEncoder().encode(text);
const fixture = () => ({ schemaVersion: 1, projectId: 'p', name: 'P', createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', lifecycle: 'active',
  level: { levelId: 'l', vertices: [], wallSegments: [], rooms: [{ roomId: 'r', faceFingerprint: 'room', heightMm: 500 }], openings: [] },
  assetInstances: [{ assetInstanceId: 'i', anchorClass: 'floor', roomId: 'r', label: 'I', xMm: 0, zMm: 0, widthMm: 1, depthMm: 1, heightMm: 1, color: '#416b91', assetDefinitionId: 'd' }],
  assetDefinitionRefs: [{ assetDefinitionId: 'd', displayName: 'D', byteLength: 1, widthMm: 1, depthMm: 1, heightMm: 1, format: 'glb', resourceHash: 'a'.repeat(64) }] });
describe('independent adversarial V1 input boundaries', () => {
  it('retains every valid raw JSON exponent token before field-specific canonicality checks', () => {
    for (const token of ['1e2', '1E2', '1e+2', '1e-2', '-1.25E-2', '1e0', '1e+0', '1e-0', '0.5']) {
      const result = scanRuntimeV1Json(utf8(`[${token}]`));
      expect(result.kind).toBe('scanned');
      if (result.kind !== 'scanned' || result.root.kind !== 'array') throw new Error('not array');
      expect(result.root.elements[0]).toMatchObject({ kind: 'number', raw: token, start: 1, end: token.length + 1 });
    }
    for (const token of ['-', '-x', '-.', '-e', '1ex', '1e+x', '1e-x']) expect(scanRuntimeV1Json(utf8(token))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it.each([
    [0xf8, 0x90, 0x80, 0x80], [0xf9, 0x80, 0x80, 0x80], [0xfa, 0x80, 0x80, 0x80], [0xfb, 0x80, 0x80, 0x80],
    [0xe0, 0x9f, 0xbf], [0xf0, 0x8f, 0xbf, 0xbf], [0xed, 0xbf, 0xbf],
    [0x82, 0x80], [0xbf, 0xbf], [0x80, 0xa0, 0x80], [0xc1, 0x80, 0x80], [0x80, 0x90, 0x80, 0x80]
  ].map(bytes => ({ bytes })))('rejects invalid or overlong UTF8 even when masked codepoint would be a scalar', ({ bytes }) => {
    expect(scanRuntimeV1Json(new Uint8Array([34, ...bytes, 34]))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('rejects a variant bound to a valid ordinary asset definition even when its color matches', () => {
    const source = fixture();
    const value = { ...source, assetInstances: [{ ...source.assetInstances[0], colorVariantId: 'alpha-blue' }] };
    const rejection = { kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' };
    expect(encodeRuntimeV1Project(value)).toEqual(rejection);
    expect(decodeRuntimeV1Project(utf8(JSON.stringify({ projectSchemaId: RUNTIME_V1_SCHEMA_ID, ...value })))).toEqual(rejection);
  });
  it('checks UTF16 wire grammar independently so encoder/decoder mistakes cannot cancel each other', () => {
    const source = fixture();
    const raw = (projectId: unknown) => utf8(JSON.stringify({ projectSchemaId: RUNTIME_V1_SCHEMA_ID, ...source, projectId }));
    for (const value of ['\ud800', '\udbff', '\udc00', '\udfff', '\ud800\ue000', '\udbff\uffff']) {
      expect(decodeRuntimeV1Project(raw(value))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
      const encoded = encodeRuntimeV1Project({ ...source, projectId: value });
      expect(encoded.kind).toBe('encoded');
      if (encoded.kind !== 'encoded') throw new Error('not encoded');
      expect(new TextDecoder().decode(encoded.bytes)).toContain('"projectId":{"utf16be":');
    }
    for (const value of ['\ue000', '\uffff', '\ud800\udfff', '\udbff\udfff', 'A']) {
      const payload = encodeRuntimeV1Utf16(value);
      expect(scanRuntimeV1Json(utf8(`{"utf16be":"${payload}"}`))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
      expect(decodeRuntimeV1Project(raw({ utf16be: payload }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
      const encoded = encodeRuntimeV1Project({ ...source, projectId: value });
      expect(encoded.kind).toBe('encoded');
      if (encoded.kind !== 'encoded') throw new Error('not encoded');
      expect(new TextDecoder().decode(encoded.bytes)).toContain(`"projectId":${JSON.stringify(value)}`);
    }
    expect(encodeRuntimeV1Utf16('\ud800AB')).toBe('2AAAQQBC');
    expect(decodeRuntimeV1Project(raw({ utf16be: '2AAAQQBCA' }))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('accepts plain null-prototype data, rejects custom prototypes and refuses hidden known fields or array indices', () => {
    const source = fixture();
    const original = encodeRuntimeV1Project(source);
    const nullPrototype = encodeRuntimeV1Project(Object.assign(Object.create(null), source));
    expect(original.kind).toBe('encoded'); expect(nullPrototype.kind).toBe('encoded');
    if (original.kind !== 'encoded' || nullPrototype.kind !== 'encoded') throw new Error('not encoded');
    expect(nullPrototype.bytes).toStrictEqual(original.bytes);
    const hiddenName = Object.defineProperty({ ...source }, 'name', { value: 'P', enumerable: false });
    const hiddenIndex = [...source.assetInstances]; Object.defineProperty(hiddenIndex, '0', { enumerable: false });
    const customPrototype = Object.setPrototypeOf({ ...source }, { inherited: 'not Project data' });
    for (const value of [hiddenName, { ...source, assetInstances: hiddenIndex }, customPrototype]) expect(encodeRuntimeV1Project(value)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('rejects historical canonical bytes with a trailing suffix even when the whole historical prefix matches', () => {
    const text = JSON.stringify(fixture());
    for (const suffix of [' ', '\n', '\t']) expect(decodeRuntimeV1LegacyProject(utf8(text + suffix))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('rejects a hole balanced by a non-index property instead of silently producing an empty array', () => {
    const array = Object.assign(new Array(1), { secret: 'must survive source, never enter wire' });
    expect(encodeRuntimeV1Project({ ...fixture(), assetInstances: array })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    expect(Object.hasOwn(array, 0)).toBe(false);
    expect(array.secret).toBe('must survive source, never enter wire');
  });
  it('rejects unknown root and level fields even when their key is legal in a different V1 record', () => {
    const source = fixture();
    for (const value of [{ ...source, roomId: 'r' }, { ...source, level: { ...source.level, label: 'extra' } }]) expect(encodeRuntimeV1Project(value)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('bounds deeply nested invalid source objects and rejects nested cycles before capacity', () => {
    const source = fixture();
    let value: unknown = 'invalid';
    for (let i = 0; i < 10000; i++) value = { label: value };
    expect(encodeRuntimeV1Project({ ...source, assetInstances: [{ ...source.assetInstances[0], colorVariantId: value }] })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    const cyclic: Record<string, unknown> = {}; cyclic.label = cyclic;
    expect(encodeRuntimeV1Project({ ...source, assetInstances: [{ ...source.assetInstances[0], colorVariantId: cyclic }] })).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('rejects inherited Object prototype names as unknown incoming keys without invoking them', () => {
    const text = JSON.stringify({ projectSchemaId: RUNTIME_V1_SCHEMA_ID, ...fixture() });
    for (const key of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      const changed = `{"${key}":{},${text.slice(1)}`;
      expect(decodeRuntimeV1Project(utf8(changed))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
  });
  it('finishes raw traversal before reporting wrapper schema faults and preserves raw capacity precedence', () => {
    for (const bad of ['{"utf16be":"AGE"}', '{"utf16be":null}', '{"utf16be":{}}', '{"utf16be":[]}', '{"utf16be":"2AB"}', '{"utf16be":"2AA","extra":0}']) {
      const prefix = `{"bad":${bad},"later":`;
      const over = `[${Array.from({ length: 1025 }, () => '0').join(',')}]`;
      expect(scanRuntimeV1Json(utf8(`${prefix}${over}}`))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
      expect(scanRuntimeV1Json(utf8(`${prefix}${over},"late":?}`))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
      for (const tail of ['?}', '{"x":0,"x":1}}', '0}']) expect(scanRuntimeV1Json(utf8(prefix + tail))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
  });
  it('keeps valid wrapper decoded-charge admission before a later raw syntax error', () => {
    const wrapper = `{"utf16be":"${encodeRuntimeV1Utf16('\ud800'.repeat(256))}"}`;
    const group = `[${Array.from({ length: 1000 }, () => wrapper).join(',')}]`;
    const text = `[${Array.from({ length: 6 }, () => group).join(',')},?]`;
    expect(scanRuntimeV1Json(utf8(text))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    // 5753 * 1458 = 8,387,874 fits; the final 5754th wrapper crosses 8MiB.
    const last = `[${Array.from({ length: 754 }, () => wrapper).join(',')}]`;
    const exactCrossing = `${Array.from({ length: 5 }, () => group).join(',')},${last}`;
    for (const suffix of [']', ',?]']) expect(scanRuntimeV1Json(utf8(`[${exactCrossing}${suffix}`))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });
  it('keeps legacy raw scan non-accepting without applying wire-only wrapper interpretation or charge', () => {
    for (const payload of ['AGE', '2AA']) {
      const result = scanRuntimeV1Json(utf8(`{"utf16be":"${payload}"}`), 'legacy');
      expect(result.kind).toBe('scanned');
      if (result.kind !== 'scanned') throw new Error('not scanned');
      expect(result.metrics.decodedCharge).toBe(16);
    }
  });
});
