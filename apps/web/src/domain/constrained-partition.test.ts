import { describe, expect, it } from '@rstest/core';

import { addConstrainedPartition, deleteConstrainedWall, expandOrthogonalGrid } from './constrained-partition';
import { addDoorOpeningToProject } from './door-opening-project';
import { createParametricFloorItem } from './parametric-item';
import { createInitialProject } from './initial-project';
import { configureRectangularRoom } from './rectangular-room';
import { changeGeneralWallThickness } from './general-wall-project';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function idsThatMustNotAllocate() {
  return {
    next: () => {
      throw new Error('Deleting a divider must reuse existing graph identities');
    }
  };
}

function rectangularProject() {
  const result = configureRectangularRoom(
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
  if (result.kind !== 'accepted') {
    throw new Error('Expected rectangular fixture');
  }
  return result.project;
}

describe('addConstrainedPartition', () => {
  it('splits a mixed rectangle without homogenizing wall thicknesses or discarding finishes', () => {
    const date = '2026-11-26T10:00:00.000Z';
    const changed = changeGeneralWallThickness(rectangularProject(), { wallSegmentId: 'wall-1', thicknessMm: 200 }, date);
    if (changed.kind !== 'accepted') throw new Error(`Expected the 200-mm north wall: ${changed.reasonCode}`);
    const oak = { presetId: 'light-oak', version: 1 } as const;
    const source = { ...changed.project, level: { ...changed.project.level, rooms: changed.project.level.rooms.map(room => ({ ...room, floorFinish: oak })) } };
    const added = addConstrainedPartition(source, { offsetMm: 2000, orientation: 'vertical', profile: 'bearing' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'), date);
    if (added.kind !== 'accepted') throw new Error(`Expected the mixed divider: ${added.reasonCode}`);
    expect(added.project.level.wallSegments.filter(({ thicknessMm }) => thicknessMm === 200)).toHaveLength(3);
    expect(added.project.level.wallSegments.find(({ profile }) => profile === 'bearing')?.thicknessMm).toBe(200);
    expect(added.project.level.rooms.map(({ floorFinish }) => floorFinish)).toEqual([oak, oak]);
  });
  it('extends a 100-mm horizontal partition across a mixed rectangle', () => {
    const date = '2026-11-26T10:00:00.000Z';
    const thickened = changeGeneralWallThickness(rectangularProject(), { wallSegmentId: 'wall-1', thicknessMm: 200 }, date);
    if (thickened.kind !== 'accepted') throw new Error(`Expected mixed walls: ${thickened.reasonCode}`);
    const added = addConstrainedPartition(thickened.project, { offsetMm: 1500, orientation: 'horizontal', profile: 'partition' },
      ids('left-contact', 'right-contact', 'wall-right-tail', 'wall-left-tail', 'divider', 'room-bottom'), date);
    if (added.kind !== 'accepted') throw new Error(`Expected mixed partition: ${added.reasonCode}`);
    const newWall = added.project.level.wallSegments.find(({ profile }) => profile === 'partition');
    expect(newWall?.thicknessMm).toBe(100);
    expect(added.project.level.vertices.filter(({ vertexId }) => vertexId === newWall?.startVertexId || vertexId === newWall?.endVertexId)).toEqual([
      { vertexId: 'left-contact', xMm: 0, zMm: 1500 }, { vertexId: 'right-contact', xMm: 4100, zMm: 1500 },
    ]);
    expect(added.project.level.wallSegments.find(({ wallSegmentId }) => wallSegmentId === 'wall-1')?.thicknessMm).toBe(200);
  });
  it('refuses a new partition through a sliding track and an unsnapped mixed-wall location', () => {
    const source = rectangularProject();
    const chosen = addDoorOpeningToProject(source, {
      wallSegmentId: 'wall-1', offsetMm: 1500, sillMm: 0, widthMm: 900, heightMm: 2100,
      variant: 'sliding', slideSide: 'left', slideDirection: 'toward-end',
    }, ids('door'), source.updatedAt);
    if (chosen.kind !== 'accepted') throw new Error(`Expected sliding door: ${chosen.reasonCode}`);
    expect(addConstrainedPartition(chosen.project, { offsetMm: 2300, orientation: 'vertical', profile: 'partition' }, idsThatMustNotAllocate(), source.updatedAt))
      .toEqual({ kind: 'rejected', reasonCode: 'WALL_DOOR_OPENING_COLLISION' });
    expect(addConstrainedPartition(chosen.project, { offsetMm: 2350, orientation: 'vertical', profile: 'partition' }, idsThatMustNotAllocate(), source.updatedAt))
      .toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });
  it('splits a rectangular PlanGraph on a vertical grid line and retains the source room identity', () => {
    const result = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 2000, orientation: 'vertical' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
      '2026-08-05T14:17:16.000Z'
    );

    if (result.kind !== 'accepted') {
      throw new Error('Expected partition to be accepted');
    }
    expect(result.project.level.vertices).toHaveLength(6);
    expect(result.project.level.wallSegments).toHaveLength(7);
    expect(result.project.level.rooms).toEqual([
      { faceFingerprint: 'grid:0:2000:0:3100:100', heightMm: 2600, roomId: 'room-1' },
      { faceFingerprint: 'grid:2000:4100:0:3100:100', heightMm: 2600, roomId: 'room-right' }
    ]);
  });

  it('splits a rectangular PlanGraph on a horizontal grid line and retains the source room identity', () => {
    const result = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 1500, orientation: 'horizontal' },
      ids('vertex-left', 'vertex-right', 'wall-right-bottom', 'wall-left-top', 'wall-divider', 'room-bottom'),
      '2026-08-05T14:17:16.000Z'
    );

    if (result.kind !== 'accepted') {
      throw new Error('Expected partition to be accepted');
    }
    expect(result.project.level.rooms).toEqual([
      { faceFingerprint: 'grid:0:4100:0:1500:100', heightMm: 2600, roomId: 'room-1' },
      { faceFingerprint: 'grid:0:4100:1500:3100:100', heightMm: 2600, roomId: 'room-bottom' }
    ]);
  });

  it.each([0, 50, 100, 2050, 4000, 4050, 4100, 4101, 2000.5])(
    'rejects an invalid vertical partition offset %p without mutating the starter',
    (offsetMm) => {
      const project = rectangularProject();

      expect(
        addConstrainedPartition(
          project,
          { offsetMm, orientation: 'vertical' },
          ids('must-not-allocate'),
          '2026-08-05T14:17:16.000Z'
        )
      ).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
      expect(project.level.wallSegments).toHaveLength(4);
      expect(project.level.rooms).toHaveLength(1);
    }
  );

  it('builds a canonical orthogonal grid when a second snapped divider crosses the first one', () => {
    const first = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 2000, orientation: 'vertical' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
      '2026-08-05T14:17:16.000Z'
    );
    if (first.kind !== 'accepted') {
      throw new Error('Expected first partition fixture');
    }

    const second = addConstrainedPartition(
      first.project,
      { offsetMm: 1500, orientation: 'horizontal' },
      ids('grid-vertex-1', 'grid-vertex-2', 'grid-vertex-3', 'grid-wall-1', 'grid-wall-2', 'grid-wall-3', 'grid-wall-4', 'grid-wall-5', 'grid-room-1', 'grid-room-2', 'grid-room-3'),
      '2026-08-05T14:18:16.000Z'
    );

    expect(second).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (second.kind !== 'accepted') {
      throw new Error('Expected crossed grid divider');
    }
    expect(second.project.level.vertices).toHaveLength(9);
    expect(second.project.level.wallSegments).toHaveLength(12);
    expect(second.project.level.rooms).toHaveLength(4);
    expect(second.project.level.rooms.map((room) => room.faceFingerprint)).toEqual([
      'grid:0:2000:0:1500:100',
      'grid:2000:4100:0:1500:100',
      'grid:0:2000:1500:3100:100',
      'grid:2000:4100:1500:3100:100'
    ]);
    expect(second.project.level.vertices.every((vertex) => vertex.xMm % 100 === 0 || vertex.xMm === 4100 || vertex.zMm % 100 === 0 || vertex.zMm === 3100)).toBe(true);
  });

  it.each([100, 2050, 4000])('rejects a divider that does not produce usable snapped grid cells: %p mm', (offsetMm) => {
    const result = addConstrainedPartition(
      rectangularProject(),
      { offsetMm, orientation: 'vertical' },
      ids('must-not-allocate'),
      '2026-08-05T14:17:16.000Z'
    );

    expect(result).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });

  it('rejects a proposed divider whose swept wall body intersects a retained floor item without allocating or changing the project', () => {
    const starter = rectangularProject();
    const placed = createParametricFloorItem(
      starter,
      {
        color: '#2f80ed',
        depthMm: 700,
        heightMm: 750,
        label: 'Стол',
        roomId: 'room-1',
        widthMm: 1200,
        xMm: 2000,
        zMm: 1500
      },
      ids('item-1'),
      '2026-08-12T09:00:00.000Z'
    );
    if (placed.kind !== 'accepted') {
      throw new Error('Expected placed floor item fixture');
    }
    const before = JSON.stringify(placed.project);

    expect(addConstrainedPartition(
      placed.project,
      { offsetMm: 2000, orientation: 'vertical' },
      ids('must-not-allocate'),
      '2026-08-12T09:01:00.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'WALL_ITEM_COLLISION' });
    expect(JSON.stringify(placed.project)).toBe(before);
  });

  it('adds an outer grid strip to an already partitioned plan while retaining existing room identities', () => {
    const partitioned = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 2000, orientation: 'vertical' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
      '2026-08-06T08:00:00.000Z'
    );
    if (partitioned.kind !== 'accepted') {
      throw new Error('Expected partition fixture');
    }

    const result = expandOrthogonalGrid(
      partitioned.project,
      { amountMm: 1000, side: 'right' },
      ids('vertex-new-top', 'vertex-new-bottom', 'wall-new-top', 'wall-new-bottom', 'wall-new-right', 'room-extension'),
      '2026-08-06T08:00:01.000Z'
    );

    expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (result.kind !== 'accepted') {
      throw new Error('Expected expanded grid');
    }
    expect(result.project.level.vertices).toHaveLength(8);
    expect(result.project.level.wallSegments).toHaveLength(10);
    expect(result.project.level.rooms).toEqual([
      { faceFingerprint: 'grid:0:2000:0:3100:100', heightMm: 2600, roomId: 'room-1' },
      { faceFingerprint: 'grid:2000:4100:0:3100:100', heightMm: 2600, roomId: 'room-right' },
      { faceFingerprint: 'grid:4100:5100:0:3100:100', heightMm: 2600, roomId: 'room-extension' }
    ]);
  });

  it.each([
    { side: 'left' as const, expectedBounds: [-1000, 4100, 0, 3100] },
    { side: 'top' as const, expectedBounds: [0, 4100, -1000, 3100] },
    { side: 'bottom' as const, expectedBounds: [0, 4100, 0, 4100] }
  ])('adds an outer strip at the requested %s edge without moving the original geometry', ({ side, expectedBounds }) => {
    const result = expandOrthogonalGrid(
      rectangularProject(),
      { amountMm: 1000, side },
      ids('v-1', 'v-2', 'v-3', 'v-4', 'v-5', 'v-6', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'wall-5', 'wall-6', 'wall-7', 'room-extension'),
      '2026-08-06T08:00:01.000Z'
    );

    expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (result.kind !== 'accepted') {
      throw new Error('Expected expanded grid');
    }
    const xCoordinates = result.project.level.vertices.map((vertex) => vertex.xMm);
    const zCoordinates = result.project.level.vertices.map((vertex) => vertex.zMm);
    expect([Math.min(...xCoordinates), Math.max(...xCoordinates), Math.min(...zCoordinates), Math.max(...zCoordinates)])
      .toEqual(expectedBounds);
    expect(result.project.level.rooms).toHaveLength(2);
    expect(result.project.level.wallSegments).toHaveLength(7);
  });

  it.each([
    { amountMm: 0, side: 'right' as const },
    { amountMm: 50, side: 'right' as const },
    { amountMm: 150, side: 'right' as const },
    { amountMm: 100.5, side: 'right' as const }
  ])('rejects an unsnapped or empty grid expansion without mutating the source: %o', (input) => {
    const project = rectangularProject();

    expect(expandOrthogonalGrid(project, input, ids('must-not-allocate'), '2026-08-06T08:00:01.000Z'))
      .toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
    expect(project.level.rooms).toHaveLength(1);
    expect(project.level.vertices).toHaveLength(4);
  });

  it('refuses expansion for a project that is not the supported orthogonal grid', () => {
    const project = createInitialProject({ createdAt: '2026-08-06T08:00:00.000Z', levelId: 'level-1', name: 'Пустой', projectId: 'project-1' });

    expect(expandOrthogonalGrid(project, { amountMm: 1000, side: 'right' }, ids('must-not-allocate'), '2026-08-06T08:00:01.000Z'))
      .toEqual({ kind: 'rejected', reasonCode: 'PLAN_NOT_RECTANGULAR_STARTER' });
  });

  it('refuses an expansion when a legacy grid already contains an unusable narrow span', () => {
    const partitioned = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 200, orientation: 'vertical' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
      '2026-08-06T08:00:00.000Z'
    );
    if (partitioned.kind !== 'accepted') {
      throw new Error('Expected partition fixture');
    }
    const legacyNarrowGrid = {
      ...partitioned.project,
      level: {
        ...partitioned.project.level,
        vertices: partitioned.project.level.vertices.map((vertex) => vertex.xMm === 200 ? { ...vertex, xMm: 100 } : vertex),
        rooms: partitioned.project.level.rooms.map((room) => ({
          ...room,
          faceFingerprint: room.faceFingerprint
            .replace('grid:0:200:', 'grid:0:100:')
            .replace('grid:200:4100:', 'grid:100:4100:')
        }))
      }
    };

    expect(expandOrthogonalGrid(legacyNarrowGrid, { amountMm: 1000, side: 'right' }, ids('must-not-allocate'), '2026-08-06T08:00:01.000Z'))
      .toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });
});

function interiorVerticalWallId(project: ReturnType<typeof rectangularProject>): string {
  const verticesById = new Map(project.level.vertices.map((vertex) => [vertex.vertexId, vertex]));
  const divider = project.level.wallSegments.find((wall) => {
    const start = verticesById.get(wall.startVertexId);
    const end = verticesById.get(wall.endVertexId);
    return start?.xMm === 2000 && end?.xMm === 2000;
  });
  if (!divider) {
    throw new Error('Expected vertical divider');
  }
  return divider.wallSegmentId;
}

describe('deleteConstrainedWall', () => {
  it('removes the selected internal divider as one canonical line while preserving a valid grid', () => {
    const partitioned = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 2000, orientation: 'vertical' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
      '2026-08-06T12:00:00.000Z'
    );
    if (partitioned.kind !== 'accepted') {
      throw new Error('Expected partition fixture');
    }

    const result = deleteConstrainedWall(
      partitioned.project,
      { wallSegmentId: interiorVerticalWallId(partitioned.project) },
      idsThatMustNotAllocate(),
      '2026-08-06T12:00:01.000Z'
    );

    expect(result).toEqual(expect.objectContaining({
      kind: 'accepted',
      project: expect.objectContaining({
        level: expect.objectContaining({
          rooms: [{ faceFingerprint: 'grid:0:4100:0:3100:100', heightMm: 2600, roomId: 'room-1' }],
          vertices: expect.arrayContaining([
            expect.objectContaining({ xMm: 0, zMm: 0 }),
            expect.objectContaining({ xMm: 4100, zMm: 3100 })
          ])
        }),
        updatedAt: '2026-08-06T12:00:01.000Z'
      })
    }));
    if (result.kind !== 'accepted') {
      throw new Error('Expected deleted divider');
    }
    expect(result.project.level.vertices.some((vertex) => vertex.xMm === 2000)).toBe(false);
    expect(result.project.level.wallSegments).toHaveLength(4);
  });

  it('rehosts each retained floor item in the merged Room atomically', () => {
    const partitioned = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 2000, orientation: 'vertical' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
      '2026-08-06T12:00:00.000Z'
    );
    if (partitioned.kind !== 'accepted') {
      throw new Error('Expected partition fixture');
    }
    const placed = createParametricFloorItem(
      partitioned.project,
      { color: '#2f80ed', depthMm: 700, heightMm: 750, label: 'Стол', roomId: 'room-right', widthMm: 1200, xMm: 3000, zMm: 1500 },
      ids('item-right'),
      '2026-08-06T12:00:01.000Z'
    );
    if (placed.kind !== 'accepted') {
      throw new Error('Expected placed item');
    }

    const result = deleteConstrainedWall(
      placed.project,
      { wallSegmentId: interiorVerticalWallId(placed.project) },
      idsThatMustNotAllocate(),
      '2026-08-06T12:00:02.000Z'
    );

    expect(result).toEqual(expect.objectContaining({
      kind: 'accepted',
      project: expect.objectContaining({
        assetInstances: [expect.objectContaining({ assetInstanceId: 'item-right', roomId: 'room-1' })]
      })
    }));
  });

  it('removes a horizontal divider with the same identity-preserving merge semantics', () => {
    const partitioned = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 1500, orientation: 'horizontal' },
      ids('vertex-left', 'vertex-right', 'wall-right-bottom', 'wall-left-top', 'wall-divider', 'room-bottom'),
      '2026-08-06T12:00:00.000Z'
    );
    if (partitioned.kind !== 'accepted') {
      throw new Error('Expected horizontal partition fixture');
    }
    const verticesById = new Map(partitioned.project.level.vertices.map((vertex) => [vertex.vertexId, vertex]));
    const divider = partitioned.project.level.wallSegments.find((wall) => {
      const start = verticesById.get(wall.startVertexId);
      const end = verticesById.get(wall.endVertexId);
      return start?.zMm === 1500 && end?.zMm === 1500;
    });
    if (!divider) {
      throw new Error('Expected horizontal divider');
    }

    const result = deleteConstrainedWall(
      partitioned.project,
      { wallSegmentId: divider.wallSegmentId },
      idsThatMustNotAllocate(),
      '2026-08-06T12:00:01.000Z'
    );

    expect(result).toEqual(expect.objectContaining({
      kind: 'accepted',
      project: expect.objectContaining({
        level: expect.objectContaining({
          rooms: [{ faceFingerprint: 'grid:0:4100:0:3100:100', heightMm: 2600, roomId: 'room-1' }],
          wallSegments: expect.any(Array)
        })
      })
    }));
    if (result.kind !== 'accepted') {
      throw new Error('Expected deleted horizontal divider');
    }
    expect(result.project.level.vertices.some((vertex) => vertex.zMm === 1500)).toBe(false);
    expect(result.project.level.wallSegments).toHaveLength(4);
  });

  it('rejects deletion without publishing a graph when an existing item cannot be rehosted safely', () => {
    const partitioned = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 2000, orientation: 'vertical' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
      '2026-08-06T12:00:00.000Z'
    );
    if (partitioned.kind !== 'accepted') {
      throw new Error('Expected partition fixture');
    }
    const corrupted = {
      ...partitioned.project,
      assetInstances: [{
        anchorClass: 'floor' as const,
        assetInstanceId: 'invalid-item',
        color: '#2f80ed',
        depthMm: 700,
        heightMm: 750,
        label: 'Повреждённый',
        roomId: 'room-1',
        widthMm: 1200,
        xMm: 100,
        zMm: 1500
      }]
    };

    expect(deleteConstrainedWall(
      corrupted,
      { wallSegmentId: interiorVerticalWallId(corrupted) },
      idsThatMustNotAllocate(),
      '2026-08-06T12:00:01.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'ITEM_HOST_UNRESOLVABLE' });
    expect(corrupted.level.rooms).toHaveLength(2);
    expect(corrupted.assetInstances[0]?.roomId).toBe('room-1');
  });

  it('rejects an exterior wall, an unknown wall, and an unsupported PlanGraph without mutation', () => {
    const partitioned = addConstrainedPartition(
      rectangularProject(),
      { offsetMm: 2000, orientation: 'vertical' },
      ids('vertex-top', 'vertex-bottom', 'wall-top-right', 'wall-bottom-left', 'wall-divider', 'room-right'),
      '2026-08-06T12:00:00.000Z'
    );
    if (partitioned.kind !== 'accepted') {
      throw new Error('Expected partition fixture');
    }
    const dividerId = interiorVerticalWallId(partitioned.project);
    const exteriorWalls = partitioned.project.level.wallSegments.filter((wall) => wall.wallSegmentId !== dividerId);
    expect(exteriorWalls).toHaveLength(6);
    for (const exterior of exteriorWalls) {
      expect(deleteConstrainedWall(
        partitioned.project,
        { wallSegmentId: exterior.wallSegmentId },
        ids('must-not-allocate'),
        '2026-08-06T12:00:01.000Z'
      )).toEqual({ kind: 'rejected', reasonCode: 'WALL_BOUNDARY' });
    }
    expect(deleteConstrainedWall(partitioned.project, { wallSegmentId: 'unknown-wall' }, ids('must-not-allocate'), '2026-08-06T12:00:01.000Z'))
      .toEqual({ kind: 'rejected', reasonCode: 'WALL_NOT_FOUND' });
    expect(deleteConstrainedWall(
      createInitialProject({ createdAt: '2026-08-06T12:00:00.000Z', levelId: 'level-1', name: 'Пустой', projectId: 'project-1' }),
      { wallSegmentId: 'unknown-wall' },
      ids('must-not-allocate'),
      '2026-08-06T12:00:01.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'PLAN_NOT_RECTANGULAR_STARTER' });
    expect(partitioned.project.level.rooms).toHaveLength(2);
  });
});
