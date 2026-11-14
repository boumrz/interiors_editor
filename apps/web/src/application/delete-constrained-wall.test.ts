import { describe, expect, it } from '@rstest/core';

import { DeleteConstrainedWallUseCase } from './delete-constrained-wall';
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
    createInitialProject({ createdAt: '2026-08-06T12:00:00.000Z', levelId: 'level-1', name: 'Квартира', projectId: 'project-1' }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T12:00:01.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected room fixture');
  }
  const partitioned = addConstrainedPartition(
    room.project,
    { offsetMm: 2000, orientation: 'vertical' },
    ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
    '2026-08-06T12:00:02.000Z'
  );
  if (partitioned.kind !== 'accepted') {
    throw new Error('Expected partition fixture');
  }
  return {
    project: partitioned.project,
    revision: {
      checksum: 'sum:base',
      createdAt: partitioned.project.updatedAt,
      projectId: partitioned.project.projectId,
      revisionId: 'revision-1',
      schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(partitioned.project)
    }
  };
}

function dividerWallId(candidate: PublicationCandidate): string {
  const verticesById = new Map(candidate.project.level.vertices.map((vertex) => [vertex.vertexId, vertex]));
  const divider = candidate.project.level.wallSegments.find((wall) => {
    const start = verticesById.get(wall.startVertexId);
    const end = verticesById.get(wall.endVertexId);
    return start?.xMm === 2000 && end?.xMm === 2000;
  });
  if (!divider) {
    throw new Error('Expected divider fixture');
  }
  return divider.wallSegmentId;
}

describe('DeleteConstrainedWallUseCase', () => {
  it('publishes a selected internal divider deletion as one durable Revision', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const candidate = partitionedCandidate();
    const useCase = new DeleteConstrainedWallUseCase({
      checksum: { sha256: async () => 'sum:deleted-wall' },
      clock: { now: () => '2026-08-06T12:01:00.000Z' },
      ids: ids('revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async (next) => { published.push(next); return { kind: 'durable' }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidate, { wallSegmentId: dividerWallId(candidate) }, () => undefined))
      .resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect((published[0] as PublicationCandidate | undefined)?.project.level.rooms).toEqual([
      { faceFingerprint: 'grid:0:4100:0:3100:100', heightMm: 2600, roomId: 'room-1' }
    ]);
  });

  it('does not publish an exterior wall deletion', async () => {
    let published = 0;
    const candidate = partitionedCandidate();
    const exterior = candidate.project.level.wallSegments.find((wall) => wall.wallSegmentId !== dividerWallId(candidate));
    if (!exterior) {
      throw new Error('Expected exterior wall fixture');
    }
    const useCase = new DeleteConstrainedWallUseCase({
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

    await expect(useCase.execute(candidate, { wallSegmentId: exterior.wallSegmentId }, () => undefined))
      .resolves.toEqual({ kind: 'rejected', reasonCode: 'WALL_BOUNDARY' });
    expect(published).toBe(0);
  });

  it('keeps a failed divider-deletion candidate for retry', async () => {
    const candidate = partitionedCandidate();
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const useCase = new DeleteConstrainedWallUseCase({
      checksum: { sha256: async () => 'sum:deleted-wall' },
      clock: { now: () => '2026-08-06T12:01:00.000Z' },
      ids: ids('revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => ({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidate, { wallSegmentId: dividerWallId(candidate) }, (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses.map((status) => status.kind)).toEqual(['saving', 'persist-failed']);
    expect(statuses[1]?.candidate).toEqual(expect.objectContaining({
      project: expect.objectContaining({ level: expect.objectContaining({ rooms: [{ roomId: 'room-1', faceFingerprint: 'grid:0:4100:0:3100:100', heightMm: 2600 }] }) }),
      revision: expect.objectContaining({ checksum: 'sum:deleted-wall', revisionId: 'revision-2' })
    }));
  });
});
