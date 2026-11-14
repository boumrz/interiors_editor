import { describe, expect, it } from '@rstest/core';

import { RestartProjectUseCase, type RestartProjectStatus } from './restart-project';
import { canonicalProjectSerializer } from './create-project';
import { createInitialProject } from '../domain/initial-project';
import type { ProjectRepositoryPort, PublicationCandidate } from './ports';

describe('RestartProjectUseCase', () => {
  it('publishes an empty replacement plan as one durable revision without deleting the prior revision', async () => {
    const baseProject = createInitialProject({
      createdAt: '2026-08-01T10:00:00.000Z', levelId: 'level-old', name: 'Квартира', projectId: 'project-1'
    });
    const base: PublicationCandidate = {
      project: baseProject,
      revision: { checksum: 'old', createdAt: baseProject.updatedAt, projectId: 'project-1', revisionId: 'revision-old', schemaVersion: 1, serializedProject: canonicalProjectSerializer.serialize(baseProject) }
    };
    const published: PublicationCandidate[] = [];
    const repository: ProjectRepositoryPort = {
      loadCurrent: async () => ({ kind: 'empty' }),
      publish: async (candidate) => { published.push(candidate as PublicationCandidate); return { kind: 'durable' }; },
      recover: async () => ({ kind: 'recovered' })
    };
    const ids = ['level-new', 'revision-new'];
    const useCase = new RestartProjectUseCase({
      checksum: { sha256: async () => 'sum:new' },
      clock: { now: () => '2026-08-15T09:20:00.000Z' },
      ids: { next: () => ids.shift() ?? 'unexpected' },
      repository,
      serializer: canonicalProjectSerializer
    });

    const statuses: RestartProjectStatus[] = [];
    await expect(useCase.execute(base, (status) => statuses.push(status))).resolves.toEqual({
      kind: 'durable', projectId: 'project-1', revisionId: 'revision-new'
    });
    expect(published).toEqual([expect.objectContaining({
      revision: expect.objectContaining({ revisionId: 'revision-new' }),
      project: expect.objectContaining({ assetInstances: [], level: { levelId: 'level-new', openings: [], rooms: [], vertices: [], wallSegments: [] } })
    })]);
    expect(statuses.map((status) => status.kind)).toEqual(['saving', 'saved']);
    expect(statuses[1]).toEqual(expect.objectContaining({
      candidate: expect.objectContaining({ revision: expect.objectContaining({ revisionId: 'revision-new' }) }),
      kind: 'saved'
    }));
    expect(base.revision.revisionId).toBe('revision-old');
  });

  it('retains the original revision and reports a retryable failure when publishing the empty plan fails', async () => {
    const baseProject = createInitialProject({
      createdAt: '2026-08-01T10:00:00.000Z', levelId: 'level-old', name: 'Квартира', projectId: 'project-1'
    });
    const base: PublicationCandidate = {
      project: baseProject,
      revision: { checksum: 'old', createdAt: baseProject.updatedAt, projectId: 'project-1', revisionId: 'revision-old', schemaVersion: 1, serializedProject: canonicalProjectSerializer.serialize(baseProject) }
    };
    const repository: ProjectRepositoryPort = {
      loadCurrent: async () => ({ kind: 'empty' }),
      publish: async () => ({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' }),
      recover: async () => ({ kind: 'recovered' })
    };
    const ids = ['level-new', 'revision-new'];
    const useCase = new RestartProjectUseCase({
      checksum: { sha256: async () => 'sum:new' },
      clock: { now: () => '2026-08-15T09:20:00.000Z' },
      ids: { next: () => ids.shift() ?? 'unexpected' },
      repository,
      serializer: canonicalProjectSerializer
    });
    const statuses: RestartProjectStatus[] = [];

    await expect(useCase.execute(base, (status) => statuses.push(status))).resolves.toEqual({
      kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED'
    });
    expect(statuses).toEqual([
      { kind: 'saving' },
      expect.objectContaining({
        candidate: expect.objectContaining({
          project: expect.objectContaining({ assetInstances: [], level: expect.objectContaining({ levelId: 'level-new' }) }),
          revision: expect.objectContaining({ revisionId: 'revision-new' })
        }),
        kind: 'persist-failed',
        reasonCode: 'PERSISTENCE_WRITE_FAILED'
      })
    ]);
    expect(base.revision.revisionId).toBe('revision-old');
  });
});
