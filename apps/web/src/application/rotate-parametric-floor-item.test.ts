import { describe, expect, it } from '@rstest/core';

import { RotateParametricFloorItemUseCase } from './rotate-parametric-floor-item';
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
    createInitialProject({ createdAt: '2026-08-12T10:00:00.000Z', levelId: 'level-1', name: 'Гостиная', projectId: 'project-1' }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-12T10:01:00.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected room fixture');
  }
  const item = createParametricFloorItem(
    room.project,
    { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 1500, zMm: 1500 },
    ids('item-1'),
    '2026-08-12T10:02:00.000Z'
  );
  if (item.kind !== 'accepted') {
    throw new Error('Expected floor item fixture');
  }
  return {
    project: item.project,
    revision: {
      checksum: 'base',
      createdAt: item.project.updatedAt,
      projectId: item.project.projectId,
      revisionId: 'revision-1',
      schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(item.project)
    }
  };
}

describe('RotateParametricFloorItemUseCase', () => {
  it('publishes one durable revision carrying only the declared yaw step', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const useCase = new RotateParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:rotated' },
      clock: { now: () => '2026-08-12T10:03:00.000Z' },
      ids: ids('revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async (candidate) => { published.push(candidate); return { kind: 'durable' }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidateWithFloorItem(), { assetInstanceId: 'item-1', yawRadians: Math.PI / 7 }, () => undefined))
      .resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect(published[0]?.project.assetInstances).toEqual([
      expect.objectContaining({ assetInstanceId: 'item-1', yawStep: 1 })
    ]);
    expect(published[0]?.project.assetInstances[0]).not.toHaveProperty('yawRadians');
  });

  it('does not hash or publish an invalid turn', async () => {
    let publicationCount = 0;
    const useCase = new RotateParametricFloorItemUseCase({
      checksum: { sha256: async () => 'must-not-hash' },
      clock: { now: () => '2026-08-12T10:03:00.000Z' },
      ids: ids('must-not-allocate'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => { publicationCount += 1; return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidateWithFloorItem(), { assetInstanceId: 'item-1', yawRadians: -0.1 }, () => undefined))
      .resolves.toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
    expect(publicationCount).toBe(0);
  });
});
