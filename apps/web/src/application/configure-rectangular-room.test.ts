import { describe, expect, it } from '@rstest/core';

import { ConfigureRectangularRoomUseCase } from './configure-rectangular-room';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  PublicationCandidate
} from './ports';
import { canonicalProjectSerializer } from './create-project';
import { createInitialProject } from '../domain/initial-project';
import { configureRectangularRoom } from '../domain/rectangular-room';
import type { Project } from '../domain/project';

const clock: ClockPort = { now: () => '2026-08-05T14:17:16.000Z' };
const checksum: ChecksumPort = { sha256: async (value) => `checksum:${value.length}` };

function ids(...values: string[]): IdPort {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function existingRectangle(): Project {
  const created = configureRectangularRoom(
    createInitialProject({
      createdAt: '2026-08-05T14:15:16.000Z',
      levelId: 'level-1',
      name: 'Квартира',
      projectId: 'project-1'
    }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-05T14:16:16.000Z'
  );
  if (created.kind !== 'accepted') {
    throw new Error('Fixture should create a rectangle');
  }
  return created.project;
}

function repository(result: 'durable' | 'failed' = 'durable') {
  const published: import('./ports').DurablePublicationCandidate[] = [];
  const port: ProjectRepositoryPort = {
    loadCurrent: async () => ({ kind: 'empty' }),
    publish: async (candidate) => {
      published.push(candidate);
      return result === 'durable'
        ? { kind: 'durable' as const }
        : { kind: 'persist-failed' as const, reasonCode: 'PERSISTENCE_WRITE_FAILED' as const };
    },
    recover: async () => ({ kind: 'recovered' })
  };
  return { port, published };
}

describe('ConfigureRectangularRoomUseCase', () => {
  it('binds the first room publication to the exact opened Revision', async () => {
    const project = createInitialProject({ createdAt: clock.now(), levelId: 'level-base', name: 'Комната', projectId: 'project-base' });
    const base: PublicationCandidate = { project, revision: { checksum: 'base-checksum', createdAt: project.createdAt, projectId: project.projectId, revisionId: 'opened-revision', schemaVersion: 1, serializedProject: canonicalProjectSerializer.serialize(project) } };
    const receivedBases: string[][] = [];
    const useCase = new ConfigureRectangularRoomUseCase({
      checksum, clock, ids: ids('v1', 'v2', 'v3', 'v4', 'w1', 'w2', 'w3', 'w4', 'room1', 'new-revision'), serializer: canonicalProjectSerializer,
      repository: { loadCurrent: async () => ({ kind: 'empty' }), recover: async () => ({ kind: 'recovered' }), publish: async (_candidate, ...bases: string[]) => { receivedBases.push(bases); return { kind: 'durable' }; } }
    });
    expect(await useCase.execute(base, { depthMm: '3000', heightMm: '2600', widthMm: '4000' }, () => undefined)).toMatchObject({ kind: 'durable' });
    expect(receivedBases).toEqual([['opened-revision']]);
  });

  it('retains the validated room measurements on its saved notification', async () => {
    const { port } = repository();
    const notifications: import('./configure-rectangular-room').ConfigureRectangularRoomStatus[] = [];
    const project = existingRectangle();
    const useCase = new ConfigureRectangularRoomUseCase({
      checksum,
      clock,
      ids: ids('revision-2'),
      repository: port,
      serializer: canonicalProjectSerializer
    });
    const base: PublicationCandidate = {
      project,
      revision: {
        checksum: 'checksum:base',
        createdAt: project.updatedAt,
        projectId: project.projectId,
        revisionId: 'revision-1',
        schemaVersion: 1,
        serializedProject: canonicalProjectSerializer.serialize(project)
      }
    };

    const result = await useCase.execute(base, { depthMm: '3350', heightMm: '2750', widthMm: '4550' }, (status) => notifications.push(status));
    expect(notifications).toEqual([
      { kind: 'saving' },
      expect.objectContaining({ kind: 'saved', metrics: result.kind === 'durable' ? result.metrics : undefined })
    ]);
    expect(result).toMatchObject({ kind: 'durable', metrics: { depthMm: 3350, heightMm: 2750, widthMm: 4550 } });
  });

  it('publishes one new durable Revision while preserving the existing graph IDs', async () => {
    const { port, published } = repository();
    const statuses: string[] = [];
    const useCase = new ConfigureRectangularRoomUseCase({
      checksum,
      clock,
      ids: ids('revision-2'),
      repository: port,
      serializer: canonicalProjectSerializer
    });
    const baseProject = existingRectangle();
    const base: PublicationCandidate = {
      project: baseProject,
      revision: {
        checksum: 'checksum:base',
        createdAt: '2026-08-05T14:16:16.000Z',
        projectId: 'project-1',
        revisionId: 'revision-1',
        schemaVersion: 1,
        serializedProject: canonicalProjectSerializer.serialize(baseProject)
      }
    };

    const result = await useCase.execute(
      base,
      { depthMm: '3350', heightMm: '2750', widthMm: '4550' },
      (status) => statuses.push(status.kind)
    );

    expect(result).toMatchObject({
      kind: 'durable',
      metrics: { depthMm: 3350, heightMm: 2750, widthMm: 4550 },
      revisionId: 'revision-2'
    });
    expect(statuses).toEqual(['saving', 'saved']);
    expect(published).toHaveLength(1);
    expect((published[0] as PublicationCandidate | undefined)?.project.level.vertices.map((vertex) => vertex.vertexId)).toEqual([
      'v-1',
      'v-2',
      'v-3',
      'v-4'
    ]);
    expect((published[0] as PublicationCandidate | undefined)?.project.level.rooms[0]).toMatchObject({ roomId: 'room-1', heightMm: 2750 });
  });

  it('does not allocate a revision or publish when the raw numeric input is invalid', async () => {
    const { port, published } = repository();
    const useCase = new ConfigureRectangularRoomUseCase({
      checksum,
      clock,
      ids: ids('must-not-be-used'),
      repository: port,
      serializer: canonicalProjectSerializer
    });
    const project = existingRectangle();
    const base: PublicationCandidate = {
      project,
      revision: {
        checksum: 'checksum:base',
        createdAt: project.updatedAt,
        projectId: project.projectId,
        revisionId: 'revision-1',
        schemaVersion: 1,
        serializedProject: canonicalProjectSerializer.serialize(project)
      }
    };

    await expect(
      useCase.execute(base, { depthMm: '3000', heightMm: '2600', widthMm: '1.5' }, () => undefined)
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
    expect(published).toEqual([]);
    expect(project).toEqual(existingRectangle());
  });

  it('keeps the validated replacement pending when publication fails', async () => {
    const { port } = repository('failed');
    const statuses: string[] = [];
    const useCase = new ConfigureRectangularRoomUseCase({
      checksum,
      clock,
      ids: ids('revision-2'),
      repository: port,
      serializer: canonicalProjectSerializer
    });
    const project = existingRectangle();
    const base: PublicationCandidate = {
      project,
      revision: {
        checksum: 'checksum:base',
        createdAt: project.updatedAt,
        projectId: project.projectId,
        revisionId: 'revision-1',
        schemaVersion: 1,
        serializedProject: canonicalProjectSerializer.serialize(project)
      }
    };

    await expect(
      useCase.execute(base, { depthMm: '3000', heightMm: '2600', widthMm: '4100' }, (status) => statuses.push(status.kind))
    ).resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses).toEqual(['saving', 'persist-failed']);
  });
});
