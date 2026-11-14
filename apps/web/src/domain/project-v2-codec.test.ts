import { describe, expect, it } from '@rstest/core';

import { decodeProjectV2, serializeProjectV2Canonically } from './project-v2-codec';
import type { ProjectV2 } from './project-v2';

function projectV2(): ProjectV2 {
  return {
    assetDefinitionRefs: [],
    assetInstances: [
      {
        anchorClass: 'floor',
        assetInstanceId: 'asset-table',
        color: '#8b5a2b',
        depthMm: 800,
		elevationMm: 0,
        heightMm: 750,
        label: 'Стол',
        roomId: 'room-main',
        widthMm: 1200,
        xMm: 1800,
        zMm: 1200
      }
    ],
    createdAt: '2026-08-06T12:00:00.000Z',
    level: {
      levelId: 'level-1',
      openings: [],
      roomMetadata: [
        {
          faceFingerprint: 'orthogonal-face:0:0|0:3000|4000:3000|4000:0',
          heightMm: 2600,
          roomId: 'room-main'
        }
      ],
      vertices: [
        { vertexId: 'vertex-d', xMm: 0, zMm: 3000 },
        { vertexId: 'vertex-b', xMm: 4000, zMm: 0 },
        { vertexId: 'vertex-c', xMm: 4000, zMm: 3000 },
        { vertexId: 'vertex-a', xMm: 0, zMm: 0 }
      ],
      wallSegments: [
        { endVertexId: 'vertex-a', startVertexId: 'vertex-d', thicknessMm: 100, wallSegmentId: 'wall-left' },
        { endVertexId: 'vertex-d', startVertexId: 'vertex-c', thicknessMm: 100, wallSegmentId: 'wall-top' },
        { endVertexId: 'vertex-c', startVertexId: 'vertex-b', thicknessMm: 100, wallSegmentId: 'wall-right' },
        { endVertexId: 'vertex-b', startVertexId: 'vertex-a', thicknessMm: 100, wallSegmentId: 'wall-bottom' }
      ]
    },
    lifecycle: 'active',
    name: 'Кухня',
    projectId: 'project-1',
    schemaVersion: 2,
    updatedAt: '2026-08-06T12:01:00.000Z'
  };
}

function acceptedProject(serialized: string): ProjectV2 {
  const result = decodeProjectV2(serialized);
  expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
  if (result.kind !== 'accepted') {
    throw new Error('Expected the v2 project fixture to decode');
  }
  return result.project;
}

describe('ProjectV2 codec', () => {
  it('emits one declared canonical byte representation and round-trips it into canonical array order', () => {
    const serialized = serializeProjectV2Canonically(projectV2());

    expect(serialized).toBe(
      '{"schemaVersion":2,"projectId":"project-1","name":"Кухня","createdAt":"2026-08-06T12:00:00.000Z","updatedAt":"2026-08-06T12:01:00.000Z","lifecycle":"active","level":{"levelId":"level-1","vertices":[{"vertexId":"vertex-a","xMm":0,"zMm":0},{"vertexId":"vertex-b","xMm":4000,"zMm":0},{"vertexId":"vertex-c","xMm":4000,"zMm":3000},{"vertexId":"vertex-d","xMm":0,"zMm":3000}],"wallSegments":[{"wallSegmentId":"wall-bottom","startVertexId":"vertex-a","endVertexId":"vertex-b","thicknessMm":100},{"wallSegmentId":"wall-left","startVertexId":"vertex-d","endVertexId":"vertex-a","thicknessMm":100},{"wallSegmentId":"wall-right","startVertexId":"vertex-b","endVertexId":"vertex-c","thicknessMm":100},{"wallSegmentId":"wall-top","startVertexId":"vertex-c","endVertexId":"vertex-d","thicknessMm":100}],"roomMetadata":[{"roomId":"room-main","faceFingerprint":"orthogonal-face:0:0|0:3000|4000:3000|4000:0","heightMm":2600}],"openings":[]},"assetInstances":[{"assetInstanceId":"asset-table","anchorClass":"floor","roomId":"room-main","label":"Стол","xMm":1800,"zMm":1200,"elevationMm":0,"widthMm":1200,"depthMm":800,"heightMm":750,"color":"#8b5a2b"}],"assetDefinitionRefs":[]}'
    );
    const decoded = acceptedProject(serialized);
    expect(decoded.level.vertices.map((vertex) => vertex.vertexId)).toEqual([
      'vertex-a',
      'vertex-b',
      'vertex-c',
      'vertex-d'
    ]);
    expect(serializeProjectV2Canonically(decoded)).toBe(serialized);
  });

  it.each([
    ['malformed JSON', '{"schemaVersion":2'],
    ['unknown top-level property', '{"schemaVersion":2,"debug":true}'],
    ['wrong schema version', '{"schemaVersion":1}']
  ])('rejects %s without fabricating a v2 Project', (_description, serialized) => {
    expect(decodeProjectV2(serialized)).toEqual(expect.objectContaining({ kind: 'rejected' }));
  });

  it.each([
    ['a decimal coordinate', '"xMm":0', '"xMm":0.5'],
    ['an exponent coordinate', '"xMm":0', '"xMm":0e0'],
    ['an unsafe integer coordinate', '"xMm":0', '"xMm":9007199254740992']
  ])('rejects %s before it can become canonical geometry', (_description, source, replacement) => {
    const serialized = serializeProjectV2Canonically(projectV2()).replace(source, replacement);

    expect(decodeProjectV2(serialized)).toEqual({
      kind: 'rejected',
      reasonCode: _description === 'an unsafe integer coordinate'
        ? 'INVALID_GEOMETRY_VALUE'
        : 'INVALID_GEOMETRY_LEXEME'
    });
  });

  it('normalizes the explicitly allowed raw negative zero to canonical zero', () => {
    const serialized = serializeProjectV2Canonically(projectV2()).replace('"xMm":0', '"xMm":-0');
    const decoded = acceptedProject(serialized);

    expect(decoded.level.vertices[0]).toEqual({ vertexId: 'vertex-a', xMm: 0, zMm: 0 });
    expect(serializeProjectV2Canonically(decoded)).not.toContain('"xMm":-0');
  });

  it('rejects a non-grounded floor elevation without silently coercing it', () => {
		const serialized = serializeProjectV2Canonically(projectV2()).replace(
			'"elevationMm":0',
			'"elevationMm":1'
		);

		expect(decodeProjectV2(serialized)).toEqual({
			kind: 'rejected',
			reasonCode: 'INVALID_GEOMETRY_VALUE'
    });
  });

	it('keeps a legacy v2 floor item without the explicit zero readable and byte-stable', () => {
		const current = projectV2();
		const { elevationMm: _legacyElevation, ...legacyAsset } =
			current.assetInstances[0];
		const legacy: ProjectV2 = { ...current, assetInstances: [legacyAsset] };
		const serialized = serializeProjectV2Canonically(legacy);
		const decoded = acceptedProject(serialized);

		expect(decoded.assetInstances[0]).not.toHaveProperty('elevationMm');
		expect(serializeProjectV2Canonically(decoded)).toBe(serialized);
	});

  it.each([
    ['a duplicate vertex identity', '"vertexId":"vertex-b"', '"vertexId":"vertex-a"', 'DUPLICATE_IDENTIFIER'],
    ['a wall reference to no vertex', '"endVertexId":"vertex-b"', '"endVertexId":"vertex-missing"', 'UNRESOLVABLE_REFERENCE'],
    ['an asset reference to no Room metadata', '"roomId":"room-main"', '"roomId":"room-missing"', 'UNRESOLVABLE_REFERENCE'],
    ['an invalid positive wall thickness', '"thicknessMm":100', '"thicknessMm":0', 'INVALID_GEOMETRY_VALUE'],
    ['an out-of-project coordinate', '"xMm":4000', '"xMm":100001', 'PROJECT_LIMIT_EXCEEDED']
  ])('rejects %s rather than silently repairing it', (_description, source, replacement, reasonCode) => {
    const serialized = serializeProjectV2Canonically(projectV2()).replace(source, replacement);

    expect(decodeProjectV2(serialized)).toEqual({ kind: 'rejected', reasonCode });
  });
});
