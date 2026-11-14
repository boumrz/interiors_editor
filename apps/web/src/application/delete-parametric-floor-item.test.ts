import { describe, expect, it } from '@rstest/core';

import { DeleteParametricFloorItemUseCase } from './delete-parametric-floor-item';
import { canonicalProjectSerializer } from './create-project';
import type { PublicationCandidate } from './ports';
import { createInitialProject } from '../domain/initial-project';
import { createParametricFloorItem } from '../domain/parametric-item';
import { configureRectangularRoom } from '../domain/rectangular-room';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithFloorItem(): PublicationCandidate {
  const room = configureRectangularRoom(
    createInitialProject({ createdAt: '2026-08-06T12:00:00.000Z', levelId: 'level-1', name: 'Квартира', projectId: 'project-1' }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T12:00:01.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected room fixture');
  }
  const item = createParametricFloorItem(
    room.project,
    { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 2000, zMm: 1500 },
    ids('item-1'),
    '2026-08-06T12:00:02.000Z'
  );
  if (item.kind !== 'accepted') {
    throw new Error('Expected item fixture');
  }
  return {
    project: item.project,
    revision: {
      checksum: 'sum:base',
      createdAt: item.project.updatedAt,
      projectId: item.project.projectId,
      revisionId: 'revision-1',
      schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(item.project)
    }
  };
}

describe('DeleteParametricFloorItemUseCase', () => {
  it('publishes deletion as one durable Revision', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const statuses: string[] = [];
    const useCase = new DeleteParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:deleted' },
      clock: { now: () => '2026-08-06T12:01:00.000Z' },
      ids: ids('revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async (candidate) => { published.push(candidate); return { kind: 'durable' }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidateWithFloorItem(), { assetInstanceId: 'item-1' }, (status) => statuses.push(status.kind)))
      .resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect(published[0]?.project.assetInstances).toEqual([]);
    expect(statuses).toEqual(['saving', 'saved']);
  });

  it('does not hash or publish when the target item is missing', async () => {
    let published = 0;
    const useCase = new DeleteParametricFloorItemUseCase({
      checksum: { sha256: async () => 'must-not-hash' },
      clock: { now: () => '2026-08-06T12:01:00.000Z' },
      ids: ids('must-not-allocate'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => { published += 1; return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidateWithFloorItem(), { assetInstanceId: 'missing-item' }, () => undefined))
      .resolves.toEqual({ kind: 'rejected', reasonCode: 'ITEM_NOT_FOUND' });
    expect(published).toBe(0);
  });

  it('retains the exact deletion candidate when persistence fails', async () => {
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const useCase = new DeleteParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:deleted' },
      clock: { now: () => '2026-08-06T12:01:00.000Z' },
      ids: ids('revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => ({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidateWithFloorItem(), { assetInstanceId: 'item-1' }, (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses.map((status) => status.kind)).toEqual(['saving', 'persist-failed']);
    expect(statuses[1]?.candidate).toEqual(expect.objectContaining({
      project: expect.objectContaining({ assetInstances: [] }),
      revision: expect.objectContaining({ checksum: 'sum:deleted', revisionId: 'revision-2' })
    }));
  });
});
