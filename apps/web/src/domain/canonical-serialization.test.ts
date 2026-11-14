import { describe, expect, it } from '@rstest/core';

import { serializeProjectCanonically } from './canonical-serialization';
import type { Project } from './project';

const project: Project = {
  assetDefinitionRefs: [],
  assetInstances: [],
  createdAt: '2026-08-05T14:15:16.000Z',
  level: {
    levelId: 'level-b',
    openings: [],
    rooms: [],
    vertices: [],
    wallSegments: []
  },
  lifecycle: 'active',
  name: 'План B',
  projectId: 'project-a',
  schemaVersion: 1,
  updatedAt: '2026-08-05T14:15:16.000Z'
};

describe('serializeProjectCanonically', () => {
  it('uses a deterministic declared field order for the initial Project snapshot', () => {
    expect(serializeProjectCanonically(project)).toBe(
      '{"schemaVersion":1,"projectId":"project-a","name":"План B","createdAt":"2026-08-05T14:15:16.000Z","updatedAt":"2026-08-05T14:15:16.000Z","lifecycle":"active","level":{"levelId":"level-b","vertices":[],"wallSegments":[],"rooms":[],"openings":[]},"assetInstances":[],"assetDefinitionRefs":[]}'
    );
    expect(serializeProjectCanonically({ ...project, name: 'План C' })).not.toBe(
      serializeProjectCanonically(project)
    );
  });
});
