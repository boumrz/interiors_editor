import { describe, expect, it } from '@rstest/core';

import { createInitialProject } from './initial-project';
import { migrateProjectV1ToV2 } from './migrate-project-v1-to-v2';
import { addWallToProjectV2 } from './add-wall-to-project-v2';
import { addWallSegment } from './add-wall-segment';
import { deriveBoundedOrthogonalFaces } from './derive-plan-faces';
import { createParametricFloorItem } from './parametric-item';
import { configureRectangularRoom } from './rectangular-room';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function idsThatMustNotAllocate() {
  return {
    next: () => {
      throw new Error('A rejected v2 wall command must not allocate an identity');
    }
  };
}

function migratedStarter() {
  const configured = configureRectangularRoom(
    createInitialProject({
      createdAt: '2026-08-06T12:00:00.000Z',
      levelId: 'level-1',
      name: 'Свободный план',
      projectId: 'project-1'
    }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T12:01:00.000Z'
  );
  if (configured.kind !== 'accepted') {
    throw new Error('Expected a v1 rectangular fixture');
  }
  const migrated = migrateProjectV1ToV2(configured.project);
  if (migrated.kind !== 'accepted') {
    throw new Error('Expected the fixture to migrate to v2');
  }
  return migrated.project;
}

describe('addWallToProjectV2', () => {
  it('splits a v2 room using only its PlanGraph and reconciles its metadata to two derived faces', () => {
    const result = addWallToProjectV2(
      migratedStarter(),
      { end: { xMm: 2050, zMm: 3100 }, start: { xMm: 2050, zMm: 0 }, thicknessMm: 100 },
      ids('v-bottom', 'v-top', 'bottom-tail', 'top-tail', 'divider', 'room-right'),
      '2026-08-06T12:02:00.000Z'
    );

    expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (result.kind !== 'accepted') {
      return;
    }
    expect(result.project.level.wallSegments).toHaveLength(7);
    expect(result.project.level.roomMetadata).toEqual([
      expect.objectContaining({ roomId: 'room-1' }),
      expect.objectContaining({ roomId: 'room-right' })
    ]);
    expect(result.project.updatedAt).toBe('2026-08-06T12:02:00.000Z');
  });

  it('turns two perpendicular full-span dividers into four durable room faces', () => {
    const source = migratedStarter();
    const maximumXmm = Math.max(...source.level.vertices.map((vertex) => vertex.xMm));
    const maximumZmm = Math.max(...source.level.vertices.map((vertex) => vertex.zMm));
    const firstDivider = addWallToProjectV2(
      source,
      { end: { xMm: 2000, zMm: maximumZmm }, start: { xMm: 2000, zMm: 0 }, thicknessMm: 100 },
      ids('v-bottom', 'v-top', 'bottom-tail', 'top-tail', 'divider', 'room-right'),
      '2026-08-06T12:02:00.000Z'
    );
    if (firstDivider.kind !== 'accepted') {
      throw new Error(`Expected first divider to be accepted, received ${firstDivider.reasonCode}`);
    }

    const normalizedCross = addWallSegment(
      { vertices: firstDivider.project.level.vertices, wallSegments: firstDivider.project.level.wallSegments },
      { end: { xMm: maximumXmm, zMm: 1500 }, start: { xMm: 0, zMm: 1500 }, thicknessMm: 100 },
      ids('v-left', 'v-right', 'left-tail', 'right-tail', 'divider-lower-tail', 'horizontal-left', 'horizontal-right')
    );
    if (normalizedCross.kind !== 'accepted') {
      throw new Error(`Expected normalized cross to be accepted, received ${normalizedCross.reasonCode}`);
    }
    const derivedCross = deriveBoundedOrthogonalFaces(normalizedCross.graph);
    expect(derivedCross).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (derivedCross.kind !== 'accepted') {
      return;
    }
    expect(derivedCross.faces.map((face) => face.vertices.length)).toEqual([4, 4, 4, 4]);

    const secondDivider = addWallToProjectV2(
      firstDivider.project,
      { end: { xMm: maximumXmm, zMm: 1500 }, start: { xMm: 0, zMm: 1500 }, thicknessMm: 100 },
      ids(
        'v-left', 'v-right',
        'left-tail', 'right-tail',
        'divider-lower-tail', 'horizontal-left', 'horizontal-right',
        'room-bottom-left', 'room-bottom-right'
      ),
      '2026-08-06T12:03:00.000Z'
    );

    expect(secondDivider).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (secondDivider.kind !== 'accepted') {
      return;
    }
    expect(secondDivider.project.level.wallSegments).toHaveLength(12);
    expect(secondDivider.project.level.roomMetadata).toHaveLength(4);
  });

  it('keeps an item in the child face it fully occupies while creating the sibling room metadata', () => {
    const v1 = configureRectangularRoom(
      createInitialProject({
        createdAt: '2026-08-06T12:00:00.000Z',
        levelId: 'level-1',
        name: 'Мебель',
        projectId: 'project-1'
      }),
      { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
      ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
      '2026-08-06T12:01:00.000Z'
    );
    if (v1.kind !== 'accepted') {
      throw new Error('Expected a v1 room');
    }
    const withItem = createParametricFloorItem(
      v1.project,
      { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 900, xMm: 1000, zMm: 1500 },
      ids('item-1'),
      '2026-08-06T12:01:30.000Z'
    );
    if (withItem.kind !== 'accepted') {
      throw new Error('Expected a fixture item');
    }
    const migrated = migrateProjectV1ToV2(withItem.project);
    if (migrated.kind !== 'accepted') {
      throw new Error('Expected a migrated fixture');
    }

    const result = addWallToProjectV2(
      migrated.project,
      { end: { xMm: 2050, zMm: 3100 }, start: { xMm: 2050, zMm: 0 }, thicknessMm: 100 },
      ids('v-bottom', 'v-top', 'bottom-tail', 'top-tail', 'divider', 'room-right'),
      '2026-08-06T12:02:00.000Z'
    );
    if (result.kind !== 'accepted') {
      throw new Error('Expected a non-crossing item to survive a wall split');
    }

    expect(result.project.assetInstances).toEqual([
      expect.objectContaining({ assetInstanceId: 'item-1', roomId: 'room-1' })
    ]);
    expect(result.project.level.roomMetadata.map((room) => room.roomId)).toEqual(['room-1', 'room-right']);
  });

  it('rejects a divider that would cut through a host-addressed item before consuming an actual ID', () => {
    const v1 = configureRectangularRoom(
      createInitialProject({
        createdAt: '2026-08-06T12:00:00.000Z',
        levelId: 'level-1',
        name: 'Пересечение мебели',
        projectId: 'project-1'
      }),
      { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
      ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
      '2026-08-06T12:01:00.000Z'
    );
    if (v1.kind !== 'accepted') {
      throw new Error('Expected a v1 room');
    }
    const withItem = createParametricFloorItem(
      v1.project,
      { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-1', widthMm: 1200, xMm: 2000, zMm: 1500 },
      ids('item-1'),
      '2026-08-06T12:01:30.000Z'
    );
    if (withItem.kind !== 'accepted') {
      throw new Error('Expected a fixture item');
    }
    const migrated = migrateProjectV1ToV2(withItem.project);
    if (migrated.kind !== 'accepted') {
      throw new Error('Expected a migrated fixture');
    }

    expect(addWallToProjectV2(
      migrated.project,
      { end: { xMm: 2050, zMm: 3100 }, start: { xMm: 2050, zMm: 0 }, thicknessMm: 100 },
      idsThatMustNotAllocate(),
      '2026-08-06T12:02:00.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'ITEM_HOST_UNRESOLVABLE' });
  });
});
