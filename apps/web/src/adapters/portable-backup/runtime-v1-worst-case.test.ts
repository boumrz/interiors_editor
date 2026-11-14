import { describe, expect, it } from '@rstest/core';
import { decodeRuntimeV1Project, encodeRuntimeV1Project } from './runtime-v1-wire';
import { RUNTIME_V1_LIMITS, scanRuntimeV1Json } from './runtime-v1-raw-scanner';

type CorpusKind = 'escaped' | 'wrappers' | 'undefined' | 'variants';
function maximumProject(kind: CorpusKind) {
  const string = (prefix: string, index = 0) => {
    const suffix = `${prefix}${String(index).padStart(4, '0')}`;
    return (kind === 'wrappers' ? '\ud800' : '\u0001').repeat(256 - suffix.length) + suffix;
  };
  const id = (prefix: string, index: number) => string(prefix, index);
  const marker = kind === 'undefined';
  const variant = kind === 'variants';
  return {
    schemaVersion: 1, projectId: string('project'), name: '\u0001'.repeat(256),
    createdAt: '-271821-04-20T00:00:00.000Z', updatedAt: '+275760-09-13T00:00:00.000Z', lifecycle: 'active',
    level: { levelId: string('level'),
      vertices: Array.from({ length: 600 }, (_, i) => ({ vertexId: id('v', i), xMm: i, zMm: -0 })),
      wallSegments: Array.from({ length: 300 }, (_, i) => ({ wallSegmentId: id('w', i), startVertexId: id('v', 2 * i), endVertexId: id('v', 2 * i + 1), thicknessMm: 1000 })),
      rooms: Array.from({ length: 50 }, (_, i) => ({ roomId: id('r', i), faceFingerprint: string('face', i), heightMm: 10000,
        name: marker ? undefined : string('roomname', i), type: marker ? undefined : 'living-room' })),
      openings: Array.from({ length: 200 }, (_, i) => ({ openingId: id('o', i), wallSegmentId: id('w', i), offsetMm: -0,
        widthMm: 100000, heightMm: 10000, sillMm: -0, kind: marker ? 'Window' : 'Door', swingSide: marker ? undefined : 'right' })) },
    assetInstances: Array.from({ length: 250 }, (_, i) => ({ assetInstanceId: id('i', i), anchorClass: 'floor', roomId: id('r', i % 50),
      label: string('label', i), xMm: -0, zMm: -100000, widthMm: 100000, depthMm: 100000, heightMm: 100000,
      color: '#a76a3b', assetDefinitionId: marker || variant ? undefined : id('d', i),
      colorVariantId: variant ? [[[[['alpha-warm-wood']]]]] : undefined, elevationMm: marker ? undefined : -0,
      locked: marker ? undefined : true, yawRadians: marker ? undefined : -Number.MAX_VALUE, yawStep: marker ? undefined : -0 })),
    assetDefinitionRefs: Array.from({ length: 250 }, (_, i) => ({ assetDefinitionId: id('d', i), displayName: string('definition', i),
      byteLength: Number.MAX_SAFE_INTEGER, widthMm: 100000, depthMm: 100000, heightMm: 100000, format: 'glb',
      resourceHash: i.toString(16).padStart(64, '0'), source: marker ? undefined : 'CatalogVersion',
      catalogAssetId: marker ? undefined : string('catalog', i), catalogVersion: marker ? undefined : string('version', i),
      catalogEnvelopeHash: 'A'.repeat(64) }))
  };
}

describe('executable source-owned V1 capacity proof', () => {
  it.each(['escaped', 'wrappers', 'undefined', 'variants'] as const)('fits all collection caps with exact %s values', kind => {
    const source = maximumProject(kind);
    if (kind === 'undefined') {
      // The quartet must contain no ordinary values when its other values are undefined.
      for (const definition of source.assetDefinitionRefs) Object.defineProperty(definition, 'catalogEnvelopeHash', { value: undefined, enumerable: true });
    }
    const encoded = encodeRuntimeV1Project(source);
    expect(encoded.kind).toBe('encoded');
    if (encoded.kind !== 'encoded') throw new Error(`${kind}: ${encoded.reasonCode}`);
    const decoded = decodeRuntimeV1Project(encoded.bytes);
    expect(decoded.kind).toBe('decoded');
    if (decoded.kind !== 'decoded') throw new Error('not decoded');
    expect(decoded.project).toStrictEqual(source);
    expect(encoded.bytes.byteLength).toBeLessThanOrEqual(7_920_128);
    expect(encoded.metrics.valueNodes).toBeLessThanOrEqual(21_621);
    expect(encoded.metrics.memberRecords).toBeLessThanOrEqual(18_720);
    expect(encoded.metrics.arrayElements).toBeLessThanOrEqual(2_900);
    expect(encoded.metrics.decodedCharge).toBeLessThanOrEqual(7_575_453);
    expect(encoded.metrics.metadataBytes).toBeLessThanOrEqual(11_281_917);
    expect(encoded.metrics.maximumDepth).toBeLessThanOrEqual(RUNTIME_V1_LIMITS.depth);
    expect(encoded.metrics.maximumPointerBytes).toBeLessThanOrEqual(128);
    const measured = { escaped: [6333970, 3346129, 4666456], wrappers: [3061338, 6142009, 7851328],
      undefined: [5156070, 2701929, 4260056], variants: [5962470, 3165379, 4575706] }[kind];
    expect([encoded.bytes.byteLength, encoded.metrics.decodedCharge, encoded.metrics.metadataBytes]).toEqual(measured);
    if (kind === 'variants') expect(encoded.metrics.maximumDepth).toBe(8);
    console.info('S3_V1_WORST_CASE', JSON.stringify({ kind, ...encoded.metrics }));
  });
  it('rejects one excess record for each closed collection without dropping data', () => {
    for (const key of ['vertices', 'wallSegments', 'rooms', 'openings'] as const) {
      const source = maximumProject('escaped');
      const array: unknown[] = source.level[key];
      array.push(array[0]);
      expect(encodeRuntimeV1Project(source)).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    }
    for (const key of ['assetInstances', 'assetDefinitionRefs'] as const) {
      const source = maximumProject('escaped');
      const array: unknown[] = source[key];
      array.push(array[0]);
      expect(encodeRuntimeV1Project(source)).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    }
  });
  it('rejects sixth VariantValue layer and preserves the source object', () => {
    const source = maximumProject('variants');
    const item = source.assetInstances[0];
    const tooDeep = { ...source, assetInstances: [{ ...item, colorVariantId: [item.colorVariantId] }] };
    expect(encodeRuntimeV1Project(tooDeep)).toMatchObject({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    expect(item.colorVariantId).toEqual([[[[['alpha-warm-wood']]]]]);
  });

  it('admits the final reachable metadata budget step and rejects the next without relying on another cap', () => {
    const under = scanRuntimeV1Json(rawBudgetCorpus(5798, true));
    expect(under.kind).toBe('scanned');
    if (under.kind !== 'scanned') throw new Error('not scanned');
    expect(under.metrics).toMatchObject({ valueNodes: 55309, memberRecords: 48000, arrayElements: 7308,
      decodedCharge: 8319000, numericLexemeBytes: 3315072, metadataBytes: 16777144 });
    const exact = scanRuntimeV1Json(rawBudgetCorpus(5798, true, 1500, 72));
    expect(exact.kind).toBe('scanned');
    if (exact.kind !== 'scanned') throw new Error('not scanned');
    expect(exact.metrics.metadataBytes).toBe(16777216);
    expect(scanRuntimeV1Json(rawBudgetCorpus(5798, true, 1500, 73))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    expect(scanRuntimeV1Json(rawBudgetCorpus(5799, true))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('admits exactly 65536 nodes and rejects the next independently of members, elements and metadata', () => {
    const under = scanRuntimeV1Json(rawBudgetCorpus(16014, false));
    expect(under.kind).toBe('scanned');
    if (under.kind !== 'scanned') throw new Error('not scanned');
    expect(under.metrics.valueNodes).toBe(65536);
    expect(under.metrics.memberRecords).toBe(48000);
    expect(under.metrics.arrayElements).toBeLessThan(24576);
    expect(under.metrics.metadataBytes).toBeLessThan(16777216);
    expect(scanRuntimeV1Json(rawBudgetCorpus(16015, false))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('admits exactly 49152 members and rejects the next record before other aggregate bounds', () => {
    const exact = scanRuntimeV1Json(rawBudgetCorpus(0, false, 1536));
    expect(exact.kind).toBe('scanned');
    if (exact.kind !== 'scanned') throw new Error('not scanned');
    expect(exact.metrics.memberRecords).toBe(49152);
    expect(exact.metrics.valueNodes).toBeLessThan(65536);
    expect(scanRuntimeV1Json(rawBudgetCorpus(0, false, 1537))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('admits exactly 8MiB decoded charge and rejects a single extra ASCII key byte', () => {
    const group = `[${Array.from({ length: 1024 }, () => JSON.stringify('x'.repeat(1365))).join(',')}]`;
    const text = (key: string) => `[${group},${group},${JSON.stringify('x'.repeat(682))},{"${key}":""}]`;
    const exact = scanRuntimeV1Json(new TextEncoder().encode(text('ab')));
    expect(exact.kind).toBe('scanned');
    if (exact.kind !== 'scanned') throw new Error('not scanned');
    expect(exact.metrics.decodedCharge).toBe(8388608);
    expect(exact.metrics.metadataBytes).toBeLessThan(16777216);
    expect(scanRuntimeV1Json(new TextEncoder().encode(text('abc')))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });
});

/** Raw scanner corpus, deliberately not a Project: independent admission limits. */
function rawBudgetCorpus(extraNumbers: number, chargedStrings: boolean, recordCount = 1500, keyExtension = 0): Uint8Array {
  const token = chargedStrings ? '1'.repeat(64) : '0';
  const chunk = (values: readonly string[]) => `[${values.join(',')}]`;
  const groups = (values: readonly string[]) => chunk(Array.from({ length: Math.ceil(values.length / 1000) }, (_, i) => chunk(values.slice(i * 1000, (i + 1) * 1000))));
  const records = Array.from({ length: recordCount }, (_, record) => `{${Array.from({ length: 32 }, (_, key) =>
    `"${record === 0 && key === 0 && keyExtension ? 'K'.repeat(2 + keyExtension) : `k${key}`}":${chargedStrings && record * 32 + key < 2000 ? JSON.stringify('x'.repeat(1365)) : token}`).join(',')}}`);
  return new TextEncoder().encode(`[${groups(records)},${groups(Array.from({ length: extraNumbers }, () => token))}]`);
}
