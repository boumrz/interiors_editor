import { describe, expect, it } from '@rstest/core';

import { canonicalProjectSerializer, CreateProjectUseCase } from './create-project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

const fixedClock = (instant: string): ClockPort => ({ now: () => instant });

const sequentialIds = (...values: string[]): IdPort => {
  let index = 0;
  return {
    next: () => values[index++] ?? 'unexpected-id'
  };
};

const serializer: ProjectSerializerPort = {
  serialize: (project) => JSON.stringify(project)
};

const checksum: ChecksumPort = {
  sha256: async (value) => `checksum:${value.length}`
};

function recordingRepository(result: 'durable' | 'failed' = 'durable') {
  const received: import('./ports').DurablePublicationCandidate[] = [];
  const repository: ProjectRepositoryPort = {
    loadCurrent: async () => ({ kind: 'empty' }),
    publish: async (candidate) => {
      received.push(candidate);
      return result === 'durable'
        ? { kind: 'durable' as const }
        : { kind: 'persist-failed' as const, reasonCode: 'PERSISTENCE_WRITE_FAILED' as const };
    },
    recover: async () => ({ kind: 'recovered' })
  };
  return { received, repository };
}

describe('CreateProjectUseCase', () => {
  it('creates exactly one serializable one-Level Project and publishes its initial Durable Revision', async () => {
    const status: string[] = [];
    const { received, repository } = recordingRepository();
    const useCase = new CreateProjectUseCase({
      checksum,
      clock: fixedClock('2026-08-05T14:15:16.000Z'),
      ids: sequentialIds('level-opaque-42', 'project-opaque-17', 'revision-opaque-5'),
      repository,
      serializer: canonicalProjectSerializer
    });

    const result = await useCase.execute('  Моя студия  ', (next) => status.push(next.kind));

    expect(result).toEqual({
      kind: 'durable',
      projectId: 'project-opaque-17',
      revisionId: 'revision-opaque-5'
    });
    expect(status).toEqual(['saving', 'saved']);
    expect(received).toHaveLength(1);
    expect(received[0]?.project).toEqual({
      assetDefinitionRefs: [],
      assetInstances: [],
      createdAt: '2026-08-05T14:15:16.000Z',
      level: {
        levelId: 'level-opaque-42',
        openings: [],
        rooms: [],
        vertices: [],
        wallSegments: []
      },
      lifecycle: 'active',
      name: 'Моя студия',
      projectId: 'project-opaque-17',
      schemaVersion: 1,
      updatedAt: '2026-08-05T14:15:16.000Z'
    });
    expect(received[0]?.revision).toMatchObject({
      checksum: expect.stringMatching(/^checksum:/),
      createdAt: '2026-08-05T14:15:16.000Z',
      projectId: 'project-opaque-17',
      revisionId: 'revision-opaque-5',
      schemaVersion: 1
    });
    expect(canonicalProjectSerializer.serialize(received[0]?.project ?? ({} as never))).toBe(
      received[0]?.revision.serializedProject
    );
  });

  it('rejects an all-whitespace name before it allocates IDs or touches persistence', async () => {
    const { received, repository } = recordingRepository();
    const useCase = new CreateProjectUseCase({
      checksum,
      clock: fixedClock('2026-08-05T14:15:16.000Z'),
      ids: sequentialIds('must-not-be-used'),
      repository,
      serializer
    });

    const result = await useCase.execute(' \n\t ', () => undefined);

    expect(result).toEqual({ kind: 'rejected', reasonCode: 'PROJECT_NAME_REQUIRED' });
    expect(received).toEqual([]);
  });

  it('keeps a validated candidate pending and never labels it saved when publication fails', async () => {
    const status: string[] = [];
    const statusEvents: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const { received, repository } = recordingRepository('failed');
    const useCase = new CreateProjectUseCase({
      checksum,
      clock: fixedClock('2026-08-05T14:15:16.000Z'),
      ids: sequentialIds('level-2', 'project-2', 'revision-2'),
      repository,
      serializer
    });

    const result = await useCase.execute('Кухня', (next) => {
      status.push(next.kind);
      statusEvents.push(next);
    });

    expect(result).toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(status).toEqual(['saving', 'persist-failed']);
    expect(received).toHaveLength(1);
    expect(statusEvents[1]).toMatchObject({
      candidate: {
        project: { projectId: 'project-2' },
        revision: { revisionId: 'revision-2' }
      },
      kind: 'persist-failed',
      reasonCode: 'PERSISTENCE_WRITE_FAILED'
    });
  });
});
