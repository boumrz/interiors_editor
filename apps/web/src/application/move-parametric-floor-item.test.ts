import { describe, expect, it } from '@rstest/core';

import { MoveParametricFloorItemUseCase } from './move-parametric-floor-item';
import { canonicalProjectSerializer } from './create-project';
import type { PublicationCandidate, ProjectRepositoryPort } from './ports';
import { createInitialProject } from '../domain/initial-project';
import { createParametricFloorItem } from '../domain/parametric-item';
import { configureRectangularRoom } from '../domain/rectangular-room';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithItem(): PublicationCandidate {
  const room = configureRectangularRoom(
    createInitialProject({ createdAt: '2026-08-06T02:10:00.000Z', levelId: 'level-1', name: 'Гостиная', projectId: 'project-1' }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T02:10:01.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected rectangular fixture');
  }
  const item = createParametricFloorItem(
    room.project,
    { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 1500, zMm: 1500 },
    ids('item-1'),
    '2026-08-06T02:10:02.000Z'
  );
  if (item.kind !== 'accepted') {
    throw new Error('Expected item fixture');
  }
  return {
    project: item.project,
    revision: {
      checksum: 'sum:base', createdAt: item.project.updatedAt, projectId: 'project-1', revisionId: 'revision-1', schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(item.project)
    }
  };
}

describe('MoveParametricFloorItemUseCase', () => {
  it('publishes one durable revision with the updated canonical location', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const repository: ProjectRepositoryPort = {
      loadCurrent: async () => ({ kind: 'empty' }),
      publish: async (candidate) => { published.push(candidate); return { kind: 'durable' }; },
      recover: async () => ({ kind: 'recovered' })
    };
    const useCase = new MoveParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:moved' }, clock: { now: () => '2026-08-06T02:11:00.000Z' },
      ids: ids('revision-2'), repository, serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidateWithItem(), { assetInstanceId: 'item-1', xMm: 2500, zMm: 1500 }, () => undefined))
      .resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect(published[0]?.project.assetInstances).toEqual([
      expect.objectContaining({ assetInstanceId: 'item-1', roomId: 'room-1', xMm: 2500, zMm: 1500 })
    ]);
  });

  it('does not hash or publish an invalid move candidate', async () => {
    let published = 0;
    const statuses: string[] = [];
    const useCase = new MoveParametricFloorItemUseCase({
      checksum: { sha256: async () => 'must-not-hash' }, clock: { now: () => '2026-08-06T02:11:00.000Z' },
      ids: ids('must-not-allocate'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => { published += 1; return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidateWithItem(), { assetInstanceId: 'missing', xMm: 2500, zMm: 1500 }, (status) => statuses.push(status.kind)))
      .resolves.toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
    expect(published).toBe(0);
    expect(statuses).toEqual([]);
  });

  it('keeps the exact moved candidate available when durable publication fails', async () => {
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const useCase = new MoveParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:moved' }, clock: { now: () => '2026-08-06T02:11:00.000Z' },
      ids: ids('revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => ({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidateWithItem(), { assetInstanceId: 'item-1', xMm: 2500, zMm: 1500 }, (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses.map((status) => status.kind)).toEqual(['saving', 'persist-failed']);
    expect(statuses[1]?.candidate?.project.assetInstances).toEqual([
      expect.objectContaining({ assetInstanceId: 'item-1', xMm: 2500, zMm: 1500 })
    ]);
  });
});
