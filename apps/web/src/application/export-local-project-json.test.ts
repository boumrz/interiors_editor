import { describe, expect, it } from '@rstest/core';

import { canonicalProjectSerializer } from './create-project';
import { ExportLocalProjectJsonUseCase } from './export-local-project-json';
import type { PublicationCandidate } from './ports';

const candidate: PublicationCandidate = {
  project: {
    assetDefinitionRefs: [],
    assetInstances: [],
    createdAt: '2026-08-15T10:00:00.000Z',
    level: { levelId: 'level-1', openings: [], rooms: [], vertices: [], wallSegments: [] },
    lifecycle: 'active',
    name: 'Кухня / вариант 1',
    projectId: 'project-1',
    schemaVersion: 1,
    updatedAt: '2026-08-15T10:00:00.000Z'
  },
  revision: {
    checksum: 'old-checksum',
    createdAt: '2026-08-15T10:00:00.000Z',
    projectId: 'project-1',
    revisionId: 'revision-1',
    schemaVersion: 1,
    serializedProject: ''
  }
};

describe('ExportLocalProjectJsonUseCase', () => {
  it('returns a local JSON download with a filesystem-safe, readable filename', async () => {
    const useCase = new ExportLocalProjectJsonUseCase({
      checksum: { sha256: async (value) => `checksum:${value.length}` },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidate)).resolves.toEqual({
      content: expect.stringContaining('"format":"interiors-editor-project-json"'),
      filename: 'Кухня-вариант-1.interiors.json',
      kind: 'ready',
      mimeType: 'application/json'
    });
  });

  it('keeps quarantined legacy V2 snapshots observable but not transferable through the V1 JSON route', async () => {
    const useCase = new ExportLocalProjectJsonUseCase({
      checksum: { sha256: async () => 'unused' },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute({
      ...candidate,
      project: { ...candidate.project, schemaVersion: 2 } as never,
      revision: { ...candidate.revision, schemaVersion: 2 } as never
    })).resolves.toEqual({ kind: 'rejected', reasonCode: 'PROJECT_JSON_UNSUPPORTED' });
  });

  it('refuses a JSON-only export when a project references pinned GLB bytes', async () => {
    const useCase = new ExportLocalProjectJsonUseCase({
      checksum: { sha256: async () => 'unused' },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute({
      ...candidate,
      project: {
        ...candidate.project,
        assetDefinitionRefs: [{
          assetDefinitionId: 'model-1',
          byteLength: 1024,
          depthMm: 900,
          displayName: 'Моя модель',
          format: 'glb',
          heightMm: 800,
          resourceHash: 'a'.repeat(64),
          widthMm: 1000
        }]
      }
    })).resolves.toEqual({ kind: 'rejected', reasonCode: 'PROJECT_JSON_UNSUPPORTED' });
  });
});
