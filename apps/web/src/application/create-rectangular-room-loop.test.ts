import { describe, expect, it } from '@rstest/core';

import { CreateRectangularRoomLoopUseCase } from './create-rectangular-room-loop';
import { canonicalProjectSerializer } from './create-project';
import type { ChecksumPort, ClockPort, IdPort, PublicationCandidate } from './ports';
import { createInitialProject } from '../domain/initial-project';
import { configureRectangularRoom } from '../domain/rectangular-room';

const clock: ClockPort = { now: () => '2026-08-06T09:20:00.000Z' };
const checksum: ChecksumPort = { sha256: async (value) => `checksum:${value.length}` };

function ids(...values: string[]): IdPort {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function starterCandidate(): PublicationCandidate {
  const room = configureRectangularRoom(
    createInitialProject({
      createdAt: '2026-08-06T09:18:00.000Z',
      levelId: 'level-1',
      name: 'Квартира',
      projectId: 'project-1'
    }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T09:19:00.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected a starter room');
  }
  return {
    project: room.project,
    revision: {
      checksum: 'checksum:base',
      createdAt: room.project.updatedAt,
      projectId: room.project.projectId,
      revisionId: 'revision-1',
      schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(room.project)
    }
  };
}

describe('CreateRectangularRoomLoopUseCase', () => {
  it('publishes exactly one durable revision for a detached rectangular room loop', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const useCase = new CreateRectangularRoomLoopUseCase({
      checksum,
      clock,
      ids: ids('v-5', 'v-6', 'v-7', 'v-8', 'wall-5', 'wall-6', 'wall-7', 'wall-8', 'room-2', 'revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async (candidate) => {
          published.push(candidate);
          return { kind: 'durable' };
        },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });
    const statuses: string[] = [];

    await expect(useCase.execute(
      starterCandidate(),
      { maxXMm: 7100, maxZMm: 6600, minXMm: 5000, minZMm: 5000 },
      (status) => statuses.push(status.kind)
    )).resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });

    expect(statuses).toEqual(['saving', 'saved']);
    expect(published).toHaveLength(1);
    expect((published[0] as PublicationCandidate | undefined)?.project.level.rooms.map((room) => room.roomId)).toEqual(['room-1', 'room-2']);
    expect((published[0] as PublicationCandidate | undefined)?.revision.serializedProject).toContain('"loop:5000:7100:5000:6600:100"');
  });

  it('rejects an overlapping loop before calculating a checksum or publishing a revision', async () => {
    let checksumCalls = 0;
    let publishCalls = 0;
    const useCase = new CreateRectangularRoomLoopUseCase({
      checksum: { sha256: async () => { checksumCalls += 1; return 'unexpected'; } },
      clock,
      ids: ids('must-not-allocate'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => { publishCalls += 1; return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });
    const statuses: string[] = [];

    await expect(useCase.execute(
      starterCandidate(),
      { maxXMm: 5000, maxZMm: 2000, minXMm: 4099, minZMm: 1000 },
      (status) => statuses.push(status.kind)
    )).resolves.toEqual({ kind: 'rejected', reasonCode: 'ROOM_OVERLAP' });
    expect(checksumCalls).toBe(0);
    expect(publishCalls).toBe(0);
    expect(statuses).toEqual([]);
  });

  it('keeps the durable candidate available when its publication fails', async () => {
    const useCase = new CreateRectangularRoomLoopUseCase({
      checksum,
      clock,
      ids: ids('v-5', 'v-6', 'v-7', 'v-8', 'wall-5', 'wall-6', 'wall-7', 'wall-8', 'room-2', 'revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => ({ kind: 'persist-failed' as const, reasonCode: 'PERSISTENCE_WRITE_FAILED' as const }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];

    await expect(useCase.execute(
      starterCandidate(),
      { maxXMm: 7100, maxZMm: 6600, minXMm: 5000, minZMm: 5000 },
      (status) => statuses.push(status)
    )).resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });

    expect(statuses.map((status) => status.kind)).toEqual(['saving', 'persist-failed']);
    expect(statuses[1]?.candidate?.revision.revisionId).toBe('revision-2');
    expect(statuses[1]?.candidate?.project.level.rooms.map((room) => room.roomId)).toEqual(['room-1', 'room-2']);
  });
});
