import { describe, expect, it } from '@rstest/core';

import { canonicalProjectSerializer } from './create-project';
import { RenameProjectUseCase } from './rename-project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRevisionPublicationPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

const base: PublicationCandidate = {
  project: {
    assetDefinitionRefs: [],
    assetInstances: [],
    createdAt: '2026-08-15T14:00:00.000Z',
    level: { levelId: 'level-1', openings: [], rooms: [], vertices: [], wallSegments: [] },
    lifecycle: 'active',
    name: 'Исходный план',
    projectId: 'project-1',
    schemaVersion: 1,
    updatedAt: '2026-08-15T14:00:00.000Z'
  },
  revision: {
    checksum: 'sum:base',
    createdAt: '2026-08-15T14:00:00.000Z',
    projectId: 'project-1',
    revisionId: 'revision-1',
    schemaVersion: 1,
    serializedProject: ''
  }
};

const clock: ClockPort = { now: () => '2026-08-15T14:05:00.000Z' };
const ids: IdPort = { next: () => 'revision-2' };
const checksum: ChecksumPort = { sha256: async () => 'sum:next' };
const serializer: ProjectSerializerPort = canonicalProjectSerializer;

describe('RenameProjectUseCase', () => {
  for (const failedStage of ['serialization', 'checksum'] as const) {
    it(`does not announce saving or publish if ${failedStage} cannot prepare a revision`, async () => {
      const failure = new Error(`Unavailable ${failedStage}`);
      const publications: string[] = [];
      const statuses: string[] = [];
      const useCase = new RenameProjectUseCase({
        checksum: failedStage === 'checksum'
          ? { sha256: async () => { throw failure; } }
          : checksum,
        clock,
        ids,
        repository: {
          publishNextRevision: async (_candidate, expectedBaseRevisionId) => {
            publications.push(expectedBaseRevisionId);
            return { kind: 'durable' };
          }
        },
        serializer: failedStage === 'serialization'
          ? { serialize: () => { throw failure; } }
          : serializer
      });

      await expect(useCase.execute(base, 'Новое название', (status) => statuses.push(status.kind))).rejects.toBe(failure);
      expect(statuses).toEqual([]);
      expect(publications).toEqual([]);
    });
  }

  it('publishes one new revision using the exact current revision as its base', async () => {
    const calls: Array<{ readonly expectedBaseRevisionId: string; readonly candidate: PublicationCandidate }> = [];
    const repository: ProjectRevisionPublicationPort = {
      publishNextRevision: async (candidate, expectedBaseRevisionId) => {
        calls.push({ candidate: candidate as PublicationCandidate, expectedBaseRevisionId });
        return { kind: 'durable' };
      }
    };
    const statuses: string[] = [];
    const useCase = new RenameProjectUseCase({ checksum, clock, ids, repository, serializer });

    await expect(useCase.execute(base, '  План кухни  ', (status) => statuses.push(status.kind))).resolves.toEqual({
      kind: 'durable',
      projectId: 'project-1',
      revisionId: 'revision-2'
    });
    expect(statuses).toEqual(['saving', 'saved']);
    expect(calls).toEqual([{
      expectedBaseRevisionId: 'revision-1',
      candidate: expect.objectContaining({
        project: expect.objectContaining({
          createdAt: '2026-08-15T14:00:00.000Z',
          name: 'План кухни',
          projectId: 'project-1',
          updatedAt: '2026-08-15T14:05:00.000Z'
        }),
        revision: expect.objectContaining({ revisionId: 'revision-2' })
      })
    }]);
  });

  it('keeps the proposed name unsaved when the durable boundary rejects a stale base', async () => {
    const repository: ProjectRevisionPublicationPort = {
      publishNextRevision: async () => ({ kind: 'stale-base' })
    };
    const statuses: string[] = [];
    const useCase = new RenameProjectUseCase({ checksum, clock, ids, repository, serializer });

    await expect(useCase.execute(base, 'Новая версия', (status) => statuses.push(status.kind))).resolves.toEqual({
      kind: 'stale-base',
      reasonCode: 'STALE_BASE_REVISION'
    });
    expect(statuses).toEqual(['saving', 'stale-base']);
  });

  it('keeps the proposed name unsaved and reports the durable failure after saving started', async () => {
    const repository: ProjectRevisionPublicationPort = {
      publishNextRevision: async () => ({
        kind: 'persist-failed',
        reasonCode: 'PERSISTENCE_WRITE_FAILED'
      })
    };
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const useCase = new RenameProjectUseCase({ checksum, clock, ids, repository, serializer });

    await expect(useCase.execute(base, 'Новая версия', (status) => statuses.push(status))).resolves.toEqual({
      kind: 'persist-failed',
      reasonCode: 'PERSISTENCE_WRITE_FAILED'
    });
    expect(statuses).toEqual([
      { kind: 'saving' },
      {
        candidate: expect.objectContaining({
          project: expect.objectContaining({ name: 'Новая версия', projectId: 'project-1' }),
          revision: expect.objectContaining({ revisionId: 'revision-2' })
        }),
        kind: 'persist-failed',
        reasonCode: 'PERSISTENCE_WRITE_FAILED'
      }
    ]);
  });

  it('does not allocate or publish a blank name', async () => {
    let published = false;
    const repository: ProjectRevisionPublicationPort = {
      publishNextRevision: async () => {
        published = true;
        return { kind: 'durable' };
      }
    };
    const useCase = new RenameProjectUseCase({ checksum, clock, ids, repository, serializer });

    await expect(useCase.execute(base, '  ', () => undefined)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'PROJECT_NAME_REQUIRED'
    });
    expect(published).toBe(false);
  });
});
