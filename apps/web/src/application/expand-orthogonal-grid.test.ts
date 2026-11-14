import { describe, expect, it } from '@rstest/core';

import { ExpandOrthogonalGridUseCase } from './expand-orthogonal-grid';
import { canonicalProjectSerializer } from './create-project';
import type { PublicationCandidate } from './ports';
import { addConstrainedPartition } from '../domain/constrained-partition';
import { createInitialProject } from '../domain/initial-project';
import { configureRectangularRoom } from '../domain/rectangular-room';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function partitionedCandidate(): PublicationCandidate {
  const room = configureRectangularRoom(
    createInitialProject({ createdAt: '2026-08-06T08:30:00.000Z', levelId: 'level-1', name: 'Квартира', projectId: 'project-1' }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T08:30:01.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected room fixture');
  }
  const partitioned = addConstrainedPartition(
    room.project,
    { offsetMm: 2000, orientation: 'vertical' },
    ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
    '2026-08-06T08:30:02.000Z'
  );
  if (partitioned.kind !== 'accepted') {
    throw new Error('Expected partition fixture');
  }
  return {
    project: partitioned.project,
    revision: {
      checksum: 'sum:base', createdAt: partitioned.project.updatedAt, projectId: partitioned.project.projectId, revisionId: 'revision-1', schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(partitioned.project)
    }
  };
}

describe('ExpandOrthogonalGridUseCase', () => {
  it('publishes the outer-strip expansion as one durable revision', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const statuses: unknown[] = [];
    const useCase = new ExpandOrthogonalGridUseCase({
      checksum: { sha256: async () => 'sum:expanded' }, clock: { now: () => '2026-08-06T08:31:00.000Z' },
      ids: ids('vertex-new-top', 'vertex-new-bottom', 'wall-new-top', 'wall-new-bottom', 'wall-new-right', 'room-extension', 'revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async (candidate) => { published.push(candidate); return { kind: 'durable' }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(partitionedCandidate(), { amountMm: 1000, side: 'right' }, (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect((published[0] as PublicationCandidate | undefined)?.project.level.rooms.map((room) => room.roomId)).toEqual(['room-1', 'room-right', 'room-extension']);
    expect(statuses).toEqual([
      { kind: 'saving' },
      expect.objectContaining({ kind: 'saved', candidate: expect.objectContaining({ revision: expect.objectContaining({ checksum: 'sum:expanded' }) }) })
    ]);
  });

  it('does not publish an unsnapped grid expansion', async () => {
    let published = 0;
    const useCase = new ExpandOrthogonalGridUseCase({
      checksum: { sha256: async () => 'must-not-hash' }, clock: { now: () => '2026-08-06T08:31:00.000Z' }, ids: ids('must-not-allocate'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => { published += 1; return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(partitionedCandidate(), { amountMm: 50, side: 'right' }, () => undefined))
      .resolves.toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
    expect(published).toBe(0);
  });

  it('does not expose a failed expansion as durable and keeps its candidate for recovery', async () => {
    const statuses: unknown[] = [];
    const useCase = new ExpandOrthogonalGridUseCase({
      checksum: { sha256: async () => 'sum:expanded' }, clock: { now: () => '2026-08-06T08:31:00.000Z' },
      ids: ids('vertex-new-top', 'vertex-new-bottom', 'wall-new-top', 'wall-new-bottom', 'wall-new-right', 'room-extension', 'revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => ({ kind: 'persist-failed' as const, reasonCode: 'PERSISTENCE_WRITE_FAILED' as const }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(partitionedCandidate(), { amountMm: 1000, side: 'right' }, (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses).toEqual([
      { kind: 'saving' },
      expect.objectContaining({
        kind: 'persist-failed',
        reasonCode: 'PERSISTENCE_WRITE_FAILED',
        candidate: expect.objectContaining({ revision: expect.objectContaining({ checksum: 'sum:expanded' }) })
      })
    ]);
  });
});
