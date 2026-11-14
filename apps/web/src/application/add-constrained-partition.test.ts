import { describe, expect, it } from '@rstest/core';

import { AddConstrainedPartitionUseCase } from './add-constrained-partition';
import { canonicalProjectSerializer } from './create-project';
import type { ChecksumPort, ClockPort, DurablePublicationCandidate, IdPort, ProjectRepositoryPort, PublicationCandidate, PublicationResult } from './ports';
import { createInitialProject } from '../domain/initial-project';
import { configureRectangularRoom } from '../domain/rectangular-room';

const clock: ClockPort = { now: () => '2026-08-05T14:17:16.000Z' };
const checksum: ChecksumPort = { sha256: async (value) => `checksum:${value.length}` };

function ids(...values: string[]): IdPort {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function rectangularCandidate(): PublicationCandidate {
  const room = configureRectangularRoom(
    createInitialProject({
      createdAt: '2026-08-05T14:15:16.000Z',
      levelId: 'level-1',
      name: 'Гостиная',
      projectId: 'project-1'
    }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-05T14:16:16.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected rectangular fixture');
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

describe('AddConstrainedPartitionUseCase', () => {
  it('checksums the exact serialized candidate before announcing saving and waits for durable publication before saved', async () => {
    const checksumInputs: string[] = [];
    const completeChecksum: Array<(checksum: string) => void> = [];
    const completePublication: Array<(result: PublicationResult) => void> = [];
    const notifyPublication: Array<() => void> = [];
    const publicationStarted = new Promise<void>((resolve) => notifyPublication.push(resolve));
    const published: DurablePublicationCandidate[] = [];
    const statuses: string[] = [];
    const useCase = new AddConstrainedPartitionUseCase({
      checksum: {
        sha256: (value) => new Promise<string>((resolve) => {
          checksumInputs.push(value);
          completeChecksum.push(resolve);
        })
      },
      clock,
      ids: ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right', 'revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: (candidate) => new Promise<PublicationResult>((resolve) => {
          published.push(candidate);
          completePublication.push(resolve);
          notifyPublication[0]?.();
        }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    const pending = useCase.execute(rectangularCandidate(), { offsetMm: 2000, orientation: 'vertical' }, (status) => statuses.push(status.kind));
    expect(checksumInputs).toHaveLength(1);
    expect(statuses).toEqual([]);
    expect(published).toEqual([]);

    completeChecksum[0]?.('checksum:verified-candidate');
    await publicationStarted;
    expect(statuses).toEqual(['saving']);
    expect(published).toEqual([expect.objectContaining({
      revision: {
        checksum: 'checksum:verified-candidate',
        createdAt: clock.now(),
        projectId: 'project-1',
        revisionId: 'revision-2',
        schemaVersion: 1,
        serializedProject: checksumInputs[0]
      }
    })]);

    completePublication[0]?.({ kind: 'durable' });
    await expect(pending).resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect(statuses).toEqual(['saving', 'saved']);
  });

  for (const reasonCode of ['PERSISTENCE_QUOTA_EXCEEDED', 'PROJECT_HISTORY_RESOURCE_LIMIT', 'PROJECT_BACKUP_ENVELOPE_EXCEEDED'] as const) {
    it(`preserves ${reasonCode} and never reports a pending partition saved`, async () => {
      const statuses: string[] = [];
      const useCase = new AddConstrainedPartitionUseCase({
        checksum,
        clock,
        ids: ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right', 'revision-2'),
        repository: {
          loadCurrent: async () => ({ kind: 'empty' }),
          publish: async () => ({ kind: 'persist-failed', reasonCode }),
          recover: async () => ({ kind: 'recovered' })
        },
        serializer: canonicalProjectSerializer
      });
      await expect(useCase.execute(rectangularCandidate(), { offsetMm: 2000, orientation: 'vertical' }, (status) => statuses.push(status.kind)))
        .resolves.toEqual({ kind: 'persist-failed', reasonCode });
      expect(statuses).toEqual(['saving', 'persist-failed']);
    });
  }

  it('publishes a single durable project revision for a valid constrained partition', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const repository: ProjectRepositoryPort = {
      loadCurrent: async () => ({ kind: 'empty' }),
      publish: async (candidate) => {
        published.push(candidate);
        return { kind: 'durable' };
      },
      recover: async () => ({ kind: 'recovered' })
    };
    const useCase = new AddConstrainedPartitionUseCase({
      checksum,
      clock,
      ids: ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right', 'revision-2'),
      repository,
      serializer: canonicalProjectSerializer
    });
    const statuses: string[] = [];

    await expect(
      useCase.execute(rectangularCandidate(), { offsetMm: 2000, orientation: 'vertical' }, (status) => statuses.push(status.kind))
    ).resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect(statuses).toEqual(['saving', 'saved']);
    expect((published[0] as PublicationCandidate | undefined)?.project.level.rooms.map((room) => room.roomId)).toEqual(['room-1', 'room-right']);
    expect((published[0] as PublicationCandidate | undefined)?.project.level.wallSegments.some((wall) => wall.wallSegmentId === 'wall-divider')).toBe(true);
  });

  it('does not publish an invalid partition candidate', async () => {
    let published = 0;
    const useCase = new AddConstrainedPartitionUseCase({
      checksum,
      clock,
      ids: ids('must-not-allocate'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => { published += 1; return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });
    const statuses: string[] = [];

    await expect(useCase.execute(rectangularCandidate(), { offsetMm: 0, orientation: 'vertical' }, (status) => statuses.push(status.kind)))
      .resolves.toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
    expect(statuses).toEqual([]);
    expect(published).toBe(0);
  });

  it('reports the exact pending partition candidate when durable publication fails', async () => {
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const useCase = new AddConstrainedPartitionUseCase({
      checksum,
      clock,
      ids: ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right', 'revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => ({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(rectangularCandidate(), { offsetMm: 2000, orientation: 'vertical' }, (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses.map((status) => status.kind)).toEqual(['saving', 'persist-failed']);
    expect(statuses[1]?.candidate).toEqual(expect.objectContaining({
      project: expect.objectContaining({ level: expect.objectContaining({ rooms: expect.arrayContaining([expect.objectContaining({ roomId: 'room-right' })]) }) }),
      revision: expect.objectContaining({ revisionId: 'revision-2' })
    }));
  });
});
