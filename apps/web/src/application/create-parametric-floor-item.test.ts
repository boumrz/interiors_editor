import { describe, expect, it } from '@rstest/core';

import { CreateParametricFloorItemUseCase } from './create-parametric-floor-item';
import { canonicalProjectSerializer } from './create-project';
import type { ChecksumPort, ClockPort, IdPort, ProjectRepositoryPort, PublicationCandidate } from './ports';
import { createInitialProject } from '../domain/initial-project';
import { createParametricFloorItem } from '../domain/parametric-item';
import { configureRectangularRoom } from '../domain/rectangular-room';

function ids(...values: string[]): IdPort {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function baseCandidate(): PublicationCandidate {
  const room = configureRectangularRoom(
    createInitialProject({ createdAt: '2026-08-05T14:15:16.000Z', levelId: 'level-1', name: 'Гостиная', projectId: 'project-1' }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-05T14:16:16.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected room fixture');
  }
  return {
    project: room.project,
    revision: { checksum: 'base', createdAt: room.project.updatedAt, projectId: 'project-1', revisionId: 'revision-1', schemaVersion: 1, serializedProject: canonicalProjectSerializer.serialize(room.project) }
  };
}

describe('CreateParametricFloorItemUseCase', () => {
  it('publishes a schematic item through the normal durable revision boundary', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const repository: ProjectRepositoryPort = {
      loadCurrent: async () => ({ kind: 'empty' }),
      publish: async (candidate) => { published.push(candidate); return { kind: 'durable' }; },
      recover: async () => ({ kind: 'recovered' })
    };
    const useCase = new CreateParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:valid' } as ChecksumPort,
      clock: { now: () => '2026-08-05T14:17:16.000Z' } as ClockPort,
      ids: ids('item-1', 'revision-2'), repository, serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(baseCandidate(), { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 2050, zMm: 1550 }, () => undefined))
      .resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect(published[0]?.project.assetInstances).toHaveLength(1);
  });

  it('keeps a semantic collision warning on the durable outcome after explicit publication', async () => {
    const base = baseCandidate();
    const occupied = createParametricFloorItem(
      base.project,
      { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Первый стол', roomId: 'room-1', widthMm: 1200, xMm: 1500, zMm: 1500 },
      ids('item-1'),
      '2026-08-05T14:16:30.000Z'
    );
    if (occupied.kind !== 'accepted') throw new Error('Expected an occupied fixture');
    const collisionBase: PublicationCandidate = {
      project: occupied.project,
      revision: {
        checksum: 'occupied',
        createdAt: occupied.project.updatedAt,
        projectId: occupied.project.projectId,
        revisionId: 'revision-occupied',
        schemaVersion: 1,
        serializedProject: canonicalProjectSerializer.serialize(occupied.project)
      }
    };
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const useCase = new CreateParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:warning' },
      clock: { now: () => '2026-08-05T14:17:16.000Z' },
      ids: ids('item-2', 'revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async (candidate) => { published.push(candidate); return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(collisionBase, { color: '#e67e22', depthMm: 700, heightMm: 750, label: 'Второй стол', roomId: 'room-1', widthMm: 1200, xMm: 1600, zMm: 1500 }, () => undefined))
      .resolves.toEqual({
        kind: 'durable',
        projectId: 'project-1',
        revisionId: 'revision-2',
        warnings: [{ assetInstanceId: 'item-1', kind: 'item' }]
      });
    expect(published[0]?.project.assetInstances).toHaveLength(2);
  });

  it('does not allocate a revision or publish when the item command is rejected', async () => {
    let published = 0;
    const useCase = new CreateParametricFloorItemUseCase({
      checksum: { sha256: async () => 'must-not-hash' },
      clock: { now: () => '2026-08-05T14:17:16.000Z' },
      ids: ids('must-not-allocate'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => { published += 1; return { kind: 'durable' as const }; },
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });
    const statuses: string[] = [];

    await expect(useCase.execute(baseCandidate(), { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'missing', widthMm: 1200, xMm: 2050, zMm: 1550 }, (status) => statuses.push(status.kind)))
      .resolves.toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
    expect(statuses).toEqual([]);
    expect(published).toBe(0);
  });

  it('keeps the exact candidate in the failure status when publication fails', async () => {
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const useCase = new CreateParametricFloorItemUseCase({
      checksum: { sha256: async () => 'sum:item' },
      clock: { now: () => '2026-08-05T14:17:16.000Z' },
      ids: ids('item-1', 'revision-2'),
      repository: {
        loadCurrent: async () => ({ kind: 'empty' }),
        publish: async () => ({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' }),
        recover: async () => ({ kind: 'recovered' })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(baseCandidate(), { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 2050, zMm: 1550 }, (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses.map((status) => status.kind)).toEqual(['saving', 'persist-failed']);
    expect(statuses[1]?.candidate).toEqual(expect.objectContaining({
      project: expect.objectContaining({ assetInstances: [expect.objectContaining({ assetInstanceId: 'item-1' })] }),
      revision: expect.objectContaining({ checksum: 'sum:item', revisionId: 'revision-2' })
    }));
  });
});
