import { describe, expect, it } from '@rstest/core';

import { serializeProjectCanonically } from './canonical-serialization';
import { addConstrainedPartition } from './constrained-partition';
import { createInitialProject } from './initial-project';
import type { Project } from './project';
import { createRectangularRoomLoop, rectangularRoomLoopBounds } from './rectangular-room-loop';
import { configureRectangularRoom } from './rectangular-room';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function idsThatMustNotAllocate() {
  return {
    next: () => {
      throw new Error('A rejected room loop must not allocate an identity');
    }
  };
}

function starterProject() {
  const result = configureRectangularRoom(
    createInitialProject({
      createdAt: '2026-08-06T09:10:00.000Z',
      levelId: 'level-1',
      name: 'План квартиры',
      projectId: 'project-1'
    }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T09:11:00.000Z'
  );
  if (result.kind !== 'accepted') {
    throw new Error('Expected a starter room');
  }
  return result.project;
}

function loopStarterProject(): Project {
  const project = starterProject();
  return {
    ...project,
    level: {
      ...project.level,
      rooms: [{ ...project.level.rooms[0], faceFingerprint: 'loop:0:4100:0:3100:100' }]
    }
  };
}

describe('Plan topology', () => {
  it('adds a detached snapped room loop while retaining the existing canonical wall and room identities', () => {
    const project = starterProject();

    const result = createRectangularRoomLoop(
      project,
      { maxXMm: 7100, maxZMm: 6600, minXMm: 5000, minZMm: 5000 },
      ids('v-5', 'v-6', 'v-7', 'v-8', 'wall-5', 'wall-6', 'wall-7', 'wall-8', 'room-2'),
      '2026-08-06T09:12:00.000Z'
    );

    if (result.kind !== 'accepted') {
      throw new Error('Expected a detached room loop to be accepted');
    }
    expect(result.project.updatedAt).toBe('2026-08-06T09:12:00.000Z');
    expect(result.project.level.vertices).toHaveLength(8);
    expect(result.project.level.wallSegments).toHaveLength(8);
    expect(result.project.level.rooms).toEqual([
      { faceFingerprint: 'loop:0:4100:0:3100:100', heightMm: 2600, roomId: 'room-1' },
      { faceFingerprint: 'loop:5000:7100:5000:6600:100', heightMm: 2600, roomId: 'room-2' }
    ]);
    expect(result.project.level.vertices.filter((vertex) => vertex.vertexId.startsWith('v-'))).toHaveLength(8);
    expect(result.project.level.wallSegments.filter((wall) => wall.wallSegmentId.startsWith('wall-'))).toHaveLength(8);
    expect(result.project.level.wallSegments.slice(0, 4).map((wall) => wall.wallSegmentId)).toEqual([
      'wall-1', 'wall-2', 'wall-3', 'wall-4'
    ]);
    expect(rectangularRoomLoopBounds(result.project)?.map((bounds) => ({
      boundaryWallSegmentIds: bounds.boundaryWallSegmentIds,
      roomId: bounds.room.roomId
    }))).toEqual([
      { boundaryWallSegmentIds: ['wall-1', 'wall-2', 'wall-3', 'wall-4'], roomId: 'room-1' },
      { boundaryWallSegmentIds: ['wall-5', 'wall-6', 'wall-7', 'wall-8'], roomId: 'room-2' }
    ]);
  });

  it('does not project or extend a loop fingerprint whose concrete wall boundary is not a closed rectangle', () => {
    const project = starterProject();
    const forged = {
      ...project,
      level: {
        ...project.level,
        rooms: [{ ...project.level.rooms[0], faceFingerprint: 'loop:0:4100:0:3100:100' }],
        wallSegments: project.level.wallSegments.map((wall) =>
          wall.wallSegmentId === 'wall-1' ? { ...wall, endVertexId: 'v-3' } : wall
        )
      }
    };
    const original = serializeProjectCanonically(forged);

    expect(rectangularRoomLoopBounds(forged)).toBeUndefined();
    expect(createRectangularRoomLoop(
      forged,
      { maxXMm: 7100, maxZMm: 6600, minXMm: 5000, minZMm: 5000 },
      idsThatMustNotAllocate(),
      '2026-08-06T09:12:00.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'PLAN_TOPOLOGY_UNSUPPORTED' });
    expect(serializeProjectCanonically(forged)).toBe(original);
  });

  it('derives the same boundary linkage when one loop segment has the opposite orientation', () => {
    const project = starterProject();
    const reversed = {
      ...project,
      level: {
        ...project.level,
        rooms: [{ ...project.level.rooms[0], faceFingerprint: 'loop:0:4100:0:3100:100' }],
        wallSegments: project.level.wallSegments.map((wall) =>
          wall.wallSegmentId === 'wall-2'
            ? { ...wall, endVertexId: wall.startVertexId, startVertexId: wall.endVertexId }
            : wall
        )
      }
    };

    expect(rectangularRoomLoopBounds(reversed)?.[0]?.boundaryWallSegmentIds).toEqual([
      'wall-1', 'wall-2', 'wall-3', 'wall-4'
    ]);
  });

  it.each([
    ['room metadata does not name a valid face', (project: Project) => ({
      ...project,
      level: { ...project.level, rooms: [{ ...project.level.rooms[0], roomId: '' }] }
    })],
    ['room height is not positive integer millimetres', (project: Project) => ({
      ...project,
      level: { ...project.level, rooms: [{ ...project.level.rooms[0], heightMm: 0 }] }
    })],
    ['fingerprint thickness differs from its concrete walls', (project: Project) => ({
      ...project,
      level: { ...project.level, rooms: [{ ...project.level.rooms[0], faceFingerprint: 'loop:0:4100:0:3100:101' }] }
    })],
    ['a corner vertex is duplicated at the same plan coordinate', (project: Project) => ({
      ...project,
      level: {
        ...project.level,
        vertices: project.level.vertices.map((vertex) =>
          vertex.vertexId === 'v-4' ? { ...vertex, xMm: 0, zMm: 0 } : vertex
        )
      }
    })],
    ['a vertex identity is duplicated', (project: Project) => ({
      ...project,
      level: {
        ...project.level,
        vertices: project.level.vertices.map((vertex) =>
          vertex.vertexId === 'v-4' ? { ...vertex, vertexId: 'v-1' } : vertex
        )
      }
    })],
    ['a wall points to no PlanGraph vertex', (project: Project) => ({
      ...project,
      level: {
        ...project.level,
        wallSegments: project.level.wallSegments.map((wall) =>
          wall.wallSegmentId === 'wall-1' ? { ...wall, endVertexId: 'missing-vertex' } : wall
        )
      }
    })],
    ['a wall identity is duplicated', (project: Project) => ({
      ...project,
      level: {
        ...project.level,
        wallSegments: project.level.wallSegments.map((wall) =>
          wall.wallSegmentId === 'wall-4' ? { ...wall, wallSegmentId: 'wall-1' } : wall
        )
      }
    })],
    ['hidden auxiliary geometry is present beside the four boundary walls', (project: Project) => ({
      ...project,
      level: {
        ...project.level,
        vertices: [...project.level.vertices, { vertexId: 'v-extra', xMm: 8000, zMm: 8000 }]
      }
    })]
  ])('does not project or extend a loop when %s', (_description, corrupt) => {
    const corrupted = corrupt(loopStarterProject());
    const original = serializeProjectCanonically(corrupted);

    expect(rectangularRoomLoopBounds(corrupted)).toBeUndefined();
    expect(createRectangularRoomLoop(
      corrupted,
      { maxXMm: 7100, maxZMm: 6600, minXMm: 5000, minZMm: 5000 },
      idsThatMustNotAllocate(),
      '2026-08-06T09:12:00.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'PLAN_TOPOLOGY_UNSUPPORTED' });
    expect(serializeProjectCanonically(corrupted)).toBe(original);
  });

  it.each([
    { maxXMm: 5000, maxZMm: 2100, minXMm: 4100, minZMm: 1000, reasonCode: 'ROOM_NOT_DETACHED' },
    { maxXMm: 5000, maxZMm: 2000, minXMm: 4099, minZMm: 1000, reasonCode: 'ROOM_OVERLAP' },
    { maxXMm: 5050, maxZMm: 6600, minXMm: 5000, minZMm: 5000, reasonCode: 'INVALID_DIMENSION' },
    { maxXMm: 100_100, maxZMm: 6600, minXMm: 5000, minZMm: 5000, reasonCode: 'PROJECT_BOUNDS_EXCEEDED' }
  ])('rejects an invalid or non-detached rectangle without mutating the current plan: %o', (input) => {
    const project = starterProject();
    const original = serializeProjectCanonically(project);

    expect(createRectangularRoomLoop(
      project,
      input,
      idsThatMustNotAllocate(),
      '2026-08-06T09:12:00.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: input.reasonCode });
    expect(serializeProjectCanonically(project)).toBe(original);
  });

  it('retains an exact integer-millimetre room boundary when it is safely detached from the snap grid', () => {
    const result = createRectangularRoomLoop(
      starterProject(),
      { maxXMm: 6401, maxZMm: 5301, minXMm: 4201, minZMm: 3901 },
      ids('v-5', 'v-6', 'v-7', 'v-8', 'wall-5', 'wall-6', 'wall-7', 'wall-8', 'room-2'),
      '2026-08-06T09:12:00.000Z'
    );

    expect(result).toEqual(expect.objectContaining({
      kind: 'accepted',
      project: expect.objectContaining({
        level: expect.objectContaining({
          rooms: expect.arrayContaining([
            expect.objectContaining({ faceFingerprint: 'loop:4201:6401:3901:5301:100', roomId: 'room-2' })
          ])
        })
      })
    }));
  });

  it('refuses to reinterpret an existing partitioned grid as detached loops', () => {
    const partitioned = addConstrainedPartition(
      starterProject(),
      { offsetMm: 2000, orientation: 'vertical' },
      ids('v-5', 'v-6', 'wall-5', 'wall-6', 'wall-7', 'room-2'),
      '2026-08-06T09:12:00.000Z'
    );
    if (partitioned.kind !== 'accepted') {
      throw new Error('Expected a partitioned grid fixture');
    }

    expect(createRectangularRoomLoop(
      partitioned.project,
      { maxXMm: 7100, maxZMm: 6600, minXMm: 5000, minZMm: 5000 },
      idsThatMustNotAllocate(),
      '2026-08-06T09:13:00.000Z'
    )).toEqual({ kind: 'rejected', reasonCode: 'PLAN_TOPOLOGY_UNSUPPORTED' });
  });
});
