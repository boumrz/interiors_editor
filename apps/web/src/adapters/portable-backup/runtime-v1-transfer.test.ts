import { describe, expect, it } from '@rstest/core';
import { serializeProjectCanonically } from '../../domain/canonical-serialization';
import type { Project } from '../../domain/project';
import { decodeRuntimeV1LegacyProject, decodeRuntimeV1Project, encodeRuntimeV1Project, RUNTIME_V1_SCHEMA_ID } from './runtime-v1-wire';

const utf8 = (text: string) => new TextEncoder().encode(text);
const project = (): Project => ({
  schemaVersion: 1, projectId: 'source', name: 'Дом', createdAt: '2026-11-04T00:00:00.000Z',
  updatedAt: '+010000-01-01T00:00:00.000Z', lifecycle: 'active',
  level: { levelId: 'level', vertices: [{ zMm: -0, vertexId: 'v1', xMm: -100000 }, { vertexId: 'v2', xMm: 100000, zMm: 100000 }],
    wallSegments: [{ wallSegmentId: 'wall', startVertexId: 'v1', endVertexId: 'v2', thicknessMm: 20 }],
    rooms: [{ heightMm: 500, roomId: 'room', faceFingerprint: 'rectangular:room', name: 'Комната', type: 'other' }],
    openings: [{ openingId: 'opening', wallSegmentId: 'wall', offsetMm: -0, widthMm: 1, heightMm: 10000, sillMm: -0, kind: 'Door', swingSide: 'left' }] },
  assetInstances: [{ assetInstanceId: 'item', anchorClass: 'floor', roomId: 'room', label: 'Стол', xMm: -0, zMm: 100000,
    widthMm: 1, depthMm: 100000, heightMm: 1, color: '#416b91', colorVariantId: 'alpha-blue', yawRadians: 0.5, yawStep: 0, elevationMm: 0, locked: true }],
  assetDefinitionRefs: []
});
const raw = (change: (text: string) => string = text => text) => utf8(change(JSON.stringify({ projectSchemaId: RUNTIME_V1_SCHEMA_ID, ...project() })));
const definition = (id = 'definition', hash = 'a'.repeat(64)) => ({ assetDefinitionId: id, displayName: 'GLB', byteLength: Number.MAX_SAFE_INTEGER,
  widthMm: 1, depthMm: 100000, heightMm: 1, format: 'glb', resourceHash: hash });

describe('exact portable V1 Project transfer', () => {
  it('round-trips -0, fractional legacy yaw, UTF16, own undefined, nested variants and nested key order', () => {
    const source = project();
    const exact = { ...source, projectId: 'source\ud800', level: { ...source.level, rooms: [{ ...source.level.rooms[0], name: undefined }] },
      assetInstances: [{ ...source.assetInstances[0], label: 'X\udfff', colorVariantId: [[['alpha-blue']]], yawStep: -0, elevationMm: -0, locked: undefined }] };
    const result = encodeRuntimeV1Project(exact);
    expect(result.kind).toBe('encoded');
    if (result.kind !== 'encoded') throw new Error('not encoded');
    const decoded = decodeRuntimeV1Project(result.bytes);
    expect(decoded.kind).toBe('decoded');
    if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.project).toStrictEqual(exact);
    expect(Object.keys(decoded.project.level.vertices[0])).toEqual(['zMm', 'vertexId', 'xMm']);
    expect(Object.hasOwn(decoded.project.level.rooms[0], 'name')).toBe(true);
    expect(Object.is(decoded.project.level.vertices[0].zMm, -0)).toBe(true);
    const item = decoded.project.assetInstances[0];
    expect(item.anchorClass).toBe('floor');
    if (item.anchorClass !== 'floor') throw new Error('not floor');
    expect(Object.is(item.yawStep, -0)).toBe(true);
    expect(new TextDecoder().decode(result.bytes)).toContain('"utf16be"');
    expect(new TextDecoder().decode(result.bytes)).toContain('"undefined":true');
    expect(exact.assetInstances[0].colorVariantId).toEqual([[['alpha-blue']]]);
  });

  it('accepts exact legacy canonical bytes with a disjoint witness, without inventing omitted undefined or negative zero', () => {
    const source = project();
    const bytes = utf8(serializeProjectCanonically(source));
    const result = decodeRuntimeV1LegacyProject(bytes);
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('not decoded');
    expect(result.project).toStrictEqual(JSON.parse(serializeProjectCanonically(source)));
    expect(Object.is(result.project.level.vertices[0].zMm, -0)).toBe(false);
  });

  it('rejects ambiguous legacy and nonhistorical bytes without fallback', () => {
    const source = project();
    const empty = { ...source, level: { ...source.level, vertices: [], wallSegments: [], rooms: [], openings: [] }, assetInstances: [] };
    for (const bytes of [utf8(serializeProjectCanonically(empty)), utf8(` ${serializeProjectCanonically(source)}`), raw()]) {
      expect(decodeRuntimeV1LegacyProject(bytes)).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
  });

  it('preserves wall items, Window own-undefined and partial absence of an all-undefined catalog quartet', () => {
    const source = project();
    const wall = { assetInstanceId: 'wallitem', anchorClass: 'wall', wallSegmentId: 'wall', side: 'right', offsetMm: -0, elevationMm: -0,
      label: 'Wall', widthMm: 100000, depthMm: 1, heightMm: 10000, color: '#ABCDEF', assetDefinitionId: 'definition', locked: undefined, colorVariantId: undefined };
    const exact = { ...source, assetInstances: [wall], assetDefinitionRefs: [{ ...definition(), source: undefined, catalogAssetId: undefined }],
      level: { ...source.level, rooms: [{ ...source.level.rooms[0], type: undefined }], openings: [{ ...source.level.openings[0], kind: 'Window', swingSide: undefined }] } };
    const encoded = encodeRuntimeV1Project(exact);
    expect(encoded.kind).toBe('encoded');
    if (encoded.kind !== 'encoded') throw new Error('not encoded');
    const result = decodeRuntimeV1Project(encoded.bytes);
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('not decoded');
    expect(result.project).toStrictEqual(exact);
    expect(Object.keys(result.project.assetDefinitionRefs[0])).toEqual(Object.keys(exact.assetDefinitionRefs[0]));
  });

  it('keeps distinct resource hash spellings and complete catalog provenance without case folding', () => {
    const source = { ...project(), assetDefinitionRefs: [
      { ...definition(), source: 'CatalogVersion', catalogAssetId: 'Каталог\ud800', catalogVersion: 'v1', catalogEnvelopeHash: 'B'.repeat(64) },
      definition('definition2', 'A'.repeat(64))] };
    const encoded = encodeRuntimeV1Project(source);
    expect(encoded.kind).toBe('encoded');
    if (encoded.kind !== 'encoded') throw new Error('not encoded');
    const decoded = decodeRuntimeV1Project(encoded.bytes);
    expect(decoded.kind).toBe('decoded');
    if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.project).toStrictEqual(source);
  });

  it('accepts ordinary string escape aliases in wire, not legacy canonical bytes', () => {
    const bytes = raw(s => s.replace('"source"', '"\\u0073ource"'));
    const result = decodeRuntimeV1Project(bytes);
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('not decoded');
    expect(result.project.projectId).toBe('source');
    const legacy = serializeProjectCanonically(project()).replace('"source"', '"\\u0073ource"');
    expect(decodeRuntimeV1LegacyProject(utf8(legacy))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('uses every registered legacy witness independently and rejects the overlapping no-witness shape', () => {
    const source = project();
    const baseRoom = { roomId: 'room', faceFingerprint: 'a'.repeat(64), heightMm: 500, name: 'Room' };
    const base = { ...source, level: { ...source.level, rooms: [baseRoom] }, assetInstances: [] };
    expect(decodeRuntimeV1LegacyProject(utf8(serializeProjectCanonically(base)))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    const { name: _name, ...unnamed } = baseRoom;
    const witnesses = [
      { ...base, assetInstances: source.assetInstances }, { ...base, assetDefinitionRefs: [definition()] },
      { ...base, level: { ...base.level, rooms: [{ ...baseRoom, type: 'office' }] } },
      { ...base, level: { ...base.level, rooms: [unnamed] } },
      { ...base, level: { ...base.level, rooms: [{ ...baseRoom, faceFingerprint: 'A'.repeat(64) }] } }
    ];
    for (const value of witnesses) {
      // Input is a historical JSON object; it is intentionally not asserted to be a domain-valid Project here.
      const bytes = utf8(JSON.stringify(value));
      expect(decodeRuntimeV1LegacyProject(bytes).kind).toBe('decoded');
    }
    const lone = { ...source, projectId: 'x\ud800' };
    const result = decodeRuntimeV1LegacyProject(utf8(serializeProjectCanonically(lone)));
    expect(result.kind).toBe('decoded');
    if (result.kind !== 'decoded') throw new Error('not decoded');
    expect(result.project.projectId).toBe('x\ud800');
  });

  it.each([
    (p: Project) => ({ ...p, name: ' X' }), (p: Project) => ({ ...p, name: 'X\ud800' }), (p: Project) => ({ ...p, projectId: '' }),
    (p: Project) => ({ ...p, projectId: 'X'.repeat(257) }), (p: Project) => ({ ...p, createdAt: '2026-11-04T00:00:00Z' }),
    (p: Project) => ({ ...p, updatedAt: '2026-02-30T00:00:00.000Z' }),
    (p: Project) => ({ ...p, level: { ...p.level, vertices: [p.level.vertices[0], p.level.vertices[0]] } }),
    (p: Project) => ({ ...p, level: { ...p.level, vertices: [{ vertexId: 'v1', xMm: -0, zMm: 0 }, { vertexId: 'v2', xMm: 0, zMm: -0 }] } }),
    (p: Project) => ({ ...p, level: { ...p.level, wallSegments: [{ ...p.level.wallSegments[0], endVertexId: 'v1' }] } }),
    (p: Project) => ({ ...p, level: { ...p.level, openings: [{ ...p.level.openings[0], wallSegmentId: 'missing' }] } }),
    (p: Project) => ({ ...p, assetInstances: [{ ...p.assetInstances[0], roomId: 'missing' }] }),
    (p: Project) => ({ ...p, assetInstances: [{ ...p.assetInstances[0], assetDefinitionId: 'missing' }] }),
    (p: Project) => ({ ...p, assetInstances: [{ ...p.assetInstances[0], colorVariantId: ['alpha-blue', 'alpha-blue'] }] }),
    (p: Project) => ({ ...p, assetInstances: [{ ...p.assetInstances[0], colorVariantId: [] }] }),
    (p: Project) => ({ ...p, assetInstances: [{ ...p.assetInstances[0], colorVariantId: null }] }),
    (p: Project) => ({ ...p, assetInstances: [{ ...p.assetInstances[0], colorVariantId: {} }] }),
    (p: Project) => ({ ...p, assetInstances: [{ ...p.assetInstances[0], yawRadians: Number.POSITIVE_INFINITY }] }),
    (p: Project) => ({ ...p, assetDefinitionRefs: [definition(), definition('different')] }),
    (p: Project) => ({ ...p, assetDefinitionRefs: [definition(), definition('definition', 'b'.repeat(64))] }),
    (p: Project) => ({ ...p, assetDefinitionRefs: [{ ...definition(), resourceHash: 'z'.repeat(64) }] }),
    (p: Project) => ({ ...p, assetDefinitionRefs: [{ ...definition(), byteLength: Number.MAX_SAFE_INTEGER + 1 }] }),
    (p: Project) => ({ ...p, assetDefinitionRefs: [{ ...definition(), source: 'CatalogVersion' }] }),
    (p: Project) => ({ ...p, assetDefinitionRefs: [{ ...definition(), source: 'CatalogVersion', catalogAssetId: ' padded ', catalogVersion: 'v', catalogEnvelopeHash: 'a'.repeat(64) }] }),
  ])('rejects invalid V1 snapshots without coercion or silent normalization', change => {
    const source = change(project());
    expect(encodeRuntimeV1Project(source)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('rejects holes, extra array properties, accessors, non-data objects and cycles without invoking user code', () => {
    const source = project();
    const sparse = new Array(1);
    const extra = Object.assign([...source.assetInstances], { secret: 1 });
    const accessor = Object.defineProperty({ ...source }, 'name', { get: () => { throw new Error('must not invoke getter'); }, enumerable: true });
    const cycle: Record<string, unknown> = { ...source }; cycle.level = cycle;
    const inheritedArray = [...source.assetInstances]; Object.setPrototypeOf(inheritedArray, { map: () => { throw new Error('must not invoke inherited code'); } });
    for (const value of [null, undefined, true, Symbol('x'), () => source, new Date(), accessor, cycle,
      { ...source, assetInstances: sparse }, { ...source, assetInstances: extra }, { ...source, assetInstances: inheritedArray },
      Object.defineProperty({ ...source }, 'hidden', { value: 1 }), { ...source, [Symbol('extra')]: 1 }]) {
      expect(encodeRuntimeV1Project(value)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
  });

  it('returns a stable rejection for revoked proxies and bounds unknown keys before wire allocation', () => {
    const source = project();
    const revocable = Proxy.revocable({}, {}); revocable.revoke();
    for (const value of [revocable.proxy, { ...source, assetInstances: [{ ...source.assetInstances[0], ['x'.repeat(3000)]: 1 }] }]) {
      expect(encodeRuntimeV1Project(value)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    }
  });

  it.each([
    (s: string) => s.replace('"schemaVersion":1', '"schemaVersion":1e0'),
    (s: string) => s.replace('"xMm":-100000', '"xMm":-1e5'),
    (s: string) => s.replace('"yawRadians":0.5', '"yawRadians":0.50'),
    (s: string) => s.replace('"source"', '{"utf16be":"AHMAbwB1AHIAYwBl"}'),
    (s: string) => s.replace('"source"', '"source\\ud800"'),
    (s: string) => s.replace('"name":"Дом"', '"name":{"undefined":true}'),
    (s: string) => s.replace('"source"', '{"utf16be":"2AA="}'),
    (s: string) => s.replace('"source"', '{"utf16be":"2AA","extra":1}'),
    (s: string) => s.replace('"lifecycle":"active"', '"lifecycle":"active","history":[]'),
    (s: string) => s.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
    (s: string) => s.replace('"startVertexId":"v1"', '"startVertexId":"missing"'),
    (s: string) => s.replace('"color":"#416b91"', '"color":"#416B91"'),
    (s: string) => s.replace('"kind":"Door"', '"kind":"Window"'),
    (s: string) => s.replace('"locked":true', '"locked":false'),
    (s: string) => s.replace('"heightMm":500', '"heightMm":499'),
    (s: string) => s.replace('"yawStep":0', '"yawStep":8'),
  ])('rejects closed grammar and raw alias violations', change => {
    expect(decodeRuntimeV1Project(raw(change))).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
});
