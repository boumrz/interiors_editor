import { describe, expect, it } from '@rstest/core';

import { createInitialProject } from './initial-project';
import { restartProject } from './restart-project';

describe('restartProject', () => {
  it('creates an empty plan revision while preserving the project identity and original creation time', () => {
    const source = {
      ...createInitialProject({
        createdAt: '2026-08-01T10:00:00.000Z',
        levelId: 'level-old',
        name: 'Квартира',
        projectId: 'project-1'
      }),
      assetDefinitionRefs: [{ assetDefinitionId: 'old-model', byteLength: 3, depthMm: 1, displayName: 'Old model', format: 'glb' as const, heightMm: 1, widthMm: 1, resourceHash: 'a'.repeat(64) }],
      assetInstances: [{
        assetInstanceId: 'item-1', anchorClass: 'floor' as const, color: '#2f80ed', depthMm: 600,
        heightMm: 700, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 1600, zMm: 1400
      }],
      level: {
        levelId: 'level-old', openings: [{ heightMm: 2100, kind: 'Door' as const, offsetMm: 1200, openingId: 'opening-1', sillMm: 0, wallSegmentId: 'wall-1', widthMm: 900 }],
        rooms: [{ faceFingerprint: 'face-old', heightMm: 2600, roomId: 'room-1' }],
        vertices: [{ vertexId: 'vertex-1', xMm: 0, zMm: 0 }],
        wallSegments: [{ endVertexId: 'vertex-1', startVertexId: 'vertex-1', thicknessMm: 100, wallSegmentId: 'wall-1' }]
      }
    };

    const result = restartProject(source, 'level-new', '2026-08-15T09:20:00.000Z');

    expect(result).toEqual({
      kind: 'accepted',
      project: expect.objectContaining({
        createdAt: '2026-08-01T10:00:00.000Z',
        name: 'Квартира', projectId: 'project-1', updatedAt: '2026-08-15T09:20:00.000Z',
        assetDefinitionRefs: [], assetInstances: [],
        level: { levelId: 'level-new', openings: [], rooms: [], vertices: [], wallSegments: [] }
      })
    });
    expect(source.assetDefinitionRefs).toHaveLength(1);
  });
});
