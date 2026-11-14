import { describe, expect, it } from '@rstest/core';

import { addWallToProjectV2 } from './add-wall-to-project-v2';
import { deleteWallFromProjectV2 } from './delete-wall-from-project-v2';
import { configureRectangularRoom } from './rectangular-room';
import { createInitialProject } from './initial-project';
import { migrateProjectV1ToV2 } from './migrate-project-v1-to-v2';
import { createParametricFloorItemV2 } from './parametric-item-v2';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function partitionedV2(withItem = false) {
  const configured = configureRectangularRoom(
    createInitialProject({
      createdAt: '2026-08-06T14:00:00.000Z',
      levelId: 'level-1',
      name: 'Удаление v2 стены',
      projectId: 'project-1'
    }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T14:01:00.000Z'
  );
  if (configured.kind !== 'accepted') {
    throw new Error('Expected v1 fixture');
  }
  const migrated = migrateProjectV1ToV2(configured.project);
  if (migrated.kind !== 'accepted') {
    throw new Error('Expected v2 migration');
  }
  const withOptionalItem = withItem
    ? createParametricFloorItemV2(
        migrated.project,
        { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 900, xMm: 1000, zMm: 1500 },
        ids('item-1'),
        '2026-08-06T14:02:00.000Z'
      )
    : { kind: 'accepted' as const, project: migrated.project };
  if (withOptionalItem.kind !== 'accepted') {
    throw new Error('Expected v2 item');
  }
  const partitioned = addWallToProjectV2(
    withOptionalItem.project,
    { end: { xMm: 2050, zMm: 3100 }, start: { xMm: 2050, zMm: 0 }, thicknessMm: 100 },
    ids('v-bottom', 'v-top', 'bottom-tail', 'top-tail', 'divider', 'room-right'),
    '2026-08-06T14:03:00.000Z'
  );
  if (partitioned.kind !== 'accepted') {
    throw new Error('Expected v2 divider');
  }
  return partitioned.project;
}

describe('deleteWallFromProjectV2', () => {
  it('merges partitioned derived faces into one durable room and garbage-collects its split vertices', () => {
    const result = deleteWallFromProjectV2(
      partitionedV2(),
      { wallSegmentId: 'divider' },
      '2026-08-06T14:04:00.000Z'
    );

    expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (result.kind !== 'accepted') {
      return;
    }
    expect(result.project.level.wallSegments).toHaveLength(4);
    expect(result.project.level.vertices).toHaveLength(4);
    expect(result.project.level.roomMetadata).toEqual([
      expect.objectContaining({ roomId: 'room-1', heightMm: 2600 })
    ]);
  });

  it('keeps an item after its two room faces merge into its retained host room', () => {
    const result = deleteWallFromProjectV2(
      partitionedV2(true),
      { wallSegmentId: 'divider' },
      '2026-08-06T14:04:00.000Z'
    );
    if (result.kind !== 'accepted') {
      throw new Error('Expected a valid v2 merge');
    }

    expect(result.project.assetInstances).toEqual([
      expect.objectContaining({ assetInstanceId: 'item-1', roomId: 'room-1' })
    ]);
  });

  it('rejects a merge of rooms with different canonical heights rather than inventing a wall height', () => {
    const project = partitionedV2();
    const first = project.level.roomMetadata[0];
    const second = project.level.roomMetadata[1];
    if (!first || !second) {
      throw new Error('Expected v2 partition fixture');
    }
    expect(deleteWallFromProjectV2({
      ...project,
      level: {
        ...project.level,
        roomMetadata: [first, { ...second, heightMm: 3000 }]
      }
    }, { wallSegmentId: 'divider' }, '2026-08-06T14:04:00.000Z')).toEqual({
      kind: 'rejected',
      reasonCode: 'ROOM_HEIGHT_CONFLICT'
    });
  });
});
