import { describe, expect, it } from '@rstest/core';

import { ResizeParametricFloorItemUseCase } from './resize-parametric-floor-item';
import { canonicalProjectSerializer } from './create-project';
import type { PublicationCandidate } from './ports';
import { createInitialProject } from '../domain/initial-project';
import { createParametricFloorItem } from '../domain/parametric-item';
import { configureRectangularRoom } from '../domain/rectangular-room';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithItem(): PublicationCandidate {
  const room = configureRectangularRoom(
    createInitialProject({ createdAt: '2026-08-06T08:30:00.000Z', levelId: 'level-1', name: 'Гостиная', projectId: 'project-1' }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T08:30:01.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected room fixture');
  }
  const item = createParametricFloorItem(
    room.project,
    { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 1500, zMm: 1500 },
    ids('item-1'),
    '2026-08-06T08:30:02.000Z'
  );
  if (item.kind !== 'accepted') {
    throw new Error('Expected item fixture');
  }
  return {
    project: item.project,
    revision: {
      checksum: 'sum:base', createdAt: item.project.updatedAt, projectId: item.project.projectId, revisionId: 'revision-1', schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(item.project)
    }
  };
}

describe('ResizeParametricFloorItemUseCase', () => {
  it('publishes a durable revision containing the selected item dimensions', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const statuses: unknown[] = [];
    const useCase = new ResizeParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:resized' },
      clock: { now: () => '2026-08-06T08:31:00.000Z' },
      ids: ids('revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async (candidate) => { published.push(candidate); return { kind: 'durable' }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(
      candidateWithItem(),
      { assetInstanceId: 'item-1', depthMm: 900, heightMm: 900, widthMm: 1400 },
      (status) => statuses.push(status)
    )).resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect(published[0]?.project.assetInstances).toEqual([
      expect.objectContaining({ assetInstanceId: 'item-1', depthMm: 900, heightMm: 900, widthMm: 1400 })
    ]);
    expect(statuses).toEqual([
      { kind: 'saving' },
      expect.objectContaining({ kind: 'saved', candidate: expect.objectContaining({ revision: expect.objectContaining({ checksum: 'sum:resized' }) }) })
    ]);
  });

  it('does not hash or publish an invalid resize', async () => {
    let published = 0;
    const useCase = new ResizeParametricFloorItemUseCase({
      checksum: { sha256: async () => 'must-not-hash' },
      clock: { now: () => '2026-08-06T08:31:00.000Z' },
      ids: ids('must-not-allocate'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => { published += 1; return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(
      candidateWithItem(),
      { assetInstanceId: 'item-1', depthMm: 0, heightMm: 900, widthMm: 1400 },
      () => undefined
    )).resolves.toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
    expect(published).toBe(0);
  });

  it('keeps a failed resize non-durable and reports the recoverable publication candidate', async () => {
    const statuses: unknown[] = [];
    const useCase = new ResizeParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:resized' },
      clock: { now: () => '2026-08-06T08:31:00.000Z' },
      ids: ids('revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => ({ kind: 'persist-failed' as const, reasonCode: 'PERSISTENCE_WRITE_FAILED' as const }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(
      candidateWithItem(),
      { assetInstanceId: 'item-1', depthMm: 900, heightMm: 900, widthMm: 1400 },
      (status) => statuses.push(status)
    )).resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses).toEqual([
      { kind: 'saving' },
      expect.objectContaining({
        kind: 'persist-failed',
        reasonCode: 'PERSISTENCE_WRITE_FAILED',
        candidate: expect.objectContaining({ revision: expect.objectContaining({ checksum: 'sum:resized' }) })
      })
    ]);
  });
});
