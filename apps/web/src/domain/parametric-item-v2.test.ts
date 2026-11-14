import { describe, expect, it } from '@rstest/core';

import {
  createParametricFloorItemV2,
  deleteParametricFloorItemV2,
  moveParametricFloorItemV2,
  resizeParametricFloorItemV2
} from './parametric-item-v2';
import { configureRectangularRoom } from './rectangular-room';
import { createInitialProject } from './initial-project';
import { migrateProjectV1ToV2 } from './migrate-project-v1-to-v2';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function migratedStarter() {
  const configured = configureRectangularRoom(
    createInitialProject({
      createdAt: '2026-08-06T13:40:00.000Z',
      levelId: 'level-1',
      name: 'Мебель v2',
      projectId: 'project-1'
    }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T13:41:00.000Z'
  );
  if (configured.kind !== 'accepted') {
    throw new Error('Expected v1 fixture');
  }
  const migrated = migrateProjectV1ToV2(configured.project);
  if (migrated.kind !== 'accepted') {
    throw new Error('Expected v2 fixture');
  }
  return migrated.project;
}

describe('v2 parametric floor items', () => {
  it('places, moves, resizes and deletes a host-addressed item from v2 derived room tiles', () => {
    const created = createParametricFloorItemV2(
      migratedStarter(),
      { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 1000, zMm: 1500 },
      ids('item-1'),
      '2026-08-06T13:42:00.000Z'
    );
    if (created.kind !== 'accepted') {
      throw new Error('Expected v2 item creation');
    }
    const moved = moveParametricFloorItemV2(
      created.project,
      { assetInstanceId: 'item-1', xMm: 2800, zMm: 1500 },
      '2026-08-06T13:43:00.000Z'
    );
    if (moved.kind !== 'accepted') {
      throw new Error('Expected v2 item move');
    }
    const resized = resizeParametricFloorItemV2(
      moved.project,
      { assetInstanceId: 'item-1', depthMm: 800, heightMm: 900, widthMm: 1300 },
      '2026-08-06T13:44:00.000Z'
    );
    if (resized.kind !== 'accepted') {
      throw new Error('Expected v2 item resize');
    }
    expect(resized.project.assetInstances).toEqual([
		expect.objectContaining({ depthMm: 800, elevationMm: 0, heightMm: 900, roomId: 'room-1', widthMm: 1300, xMm: 2800 })
    ]);
    expect(deleteParametricFloorItemV2(
      resized.project,
      { assetInstanceId: 'item-1' },
      '2026-08-06T13:45:00.000Z'
    )).toEqual(expect.objectContaining({
      kind: 'accepted',
      project: expect.objectContaining({ assetInstances: [] })
    }));
  });

  it('rejects collision and a resize that would leave the room usable polygon', () => {
    const first = createParametricFloorItemV2(
      migratedStarter(),
      { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 1000, zMm: 1500 },
      ids('item-1'),
      '2026-08-06T13:42:00.000Z'
    );
    if (first.kind !== 'accepted') {
      throw new Error('Expected v2 first item');
    }
    expect(createParametricFloorItemV2(
      first.project,
      { color: '#f2994a', depthMm: 700, heightMm: 750, label: 'Стул', roomId: 'room-1', widthMm: 900, xMm: 1000, zMm: 1500 },
      idsThatMustNotAllocate(),
      '2026-08-06T13:43:00.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'ITEM_COLLISION' });
    expect(resizeParametricFloorItemV2(
      first.project,
      { assetInstanceId: 'item-1', depthMm: 700, heightMm: 750, widthMm: 3900 },
      '2026-08-06T13:43:00.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'OUTSIDE_ROOM_HOST' });
  });
});

function idsThatMustNotAllocate() {
  return { next: () => { throw new Error('Rejected item placement must not allocate an ID'); } };
}
