import { describe, expect, it } from '@rstest/core';

import { createInitialProject } from './initial-project';
import {
  configureRectangularRoom,
  deriveRectangularRoomMetrics,
  STARTER_WALL_THICKNESS_MM
} from './rectangular-room';

const initialProject = () =>
  createInitialProject({
    createdAt: '2026-08-05T14:15:16.000Z',
    levelId: 'level-1',
    name: 'Квартира',
    projectId: 'project-1'
  });

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

describe('configureRectangularRoom', () => {
  it('builds a canonical centreline rectangle whose usable inner dimensions are the supplied mm', () => {
    const result = configureRectangularRoom(
      initialProject(),
      { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
      ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
      '2026-08-05T14:16:16.000Z'
    );

    if (result.kind !== 'accepted') {
      throw new Error('Expected rectangular room creation to be accepted');
    }

    expect(result).toEqual({
      kind: 'accepted',
      metrics: {
        areaMm2: 12_000_000,
        depthMm: 3000,
        heightMm: 2600,
        perimeterMm: 14_000,
        widthMm: 4000
      },
      project: {
        assetDefinitionRefs: [],
        assetInstances: [],
        createdAt: '2026-08-05T14:15:16.000Z',
        level: {
          levelId: 'level-1',
          openings: [],
          rooms: [
            {
              faceFingerprint: 'rectangular:4100:3100:100',
              heightMm: 2600,
              roomId: 'room-1'
            }
          ],
          vertices: [
            { vertexId: 'v-1', xMm: 0, zMm: 0 },
            { vertexId: 'v-2', xMm: 4100, zMm: 0 },
            { vertexId: 'v-3', xMm: 4100, zMm: 3100 },
            { vertexId: 'v-4', xMm: 0, zMm: 3100 }
          ],
          wallSegments: [
            { endVertexId: 'v-2', startVertexId: 'v-1', thicknessMm: 100, wallSegmentId: 'wall-1' },
            { endVertexId: 'v-3', startVertexId: 'v-2', thicknessMm: 100, wallSegmentId: 'wall-2' },
            { endVertexId: 'v-4', startVertexId: 'v-3', thicknessMm: 100, wallSegmentId: 'wall-3' },
            { endVertexId: 'v-1', startVertexId: 'v-4', thicknessMm: 100, wallSegmentId: 'wall-4' }
          ]
        },
        lifecycle: 'active',
        name: 'Квартира',
        projectId: 'project-1',
        schemaVersion: 1,
        updatedAt: '2026-08-05T14:16:16.000Z'
      }
    });
    expect(STARTER_WALL_THICKNESS_MM).toBe(100);
    expect(deriveRectangularRoomMetrics(result.project)).toEqual({
      areaMm2: 12_000_000,
      depthMm: 3000,
      heightMm: 2600,
      perimeterMm: 14_000,
      widthMm: 4000
    });
  });

  it('changes only coordinates, room properties and updatedAt when editing the existing starter', () => {
    const created = configureRectangularRoom(
      initialProject(),
      { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
      ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
      '2026-08-05T14:16:16.000Z'
    );
    if (created.kind !== 'accepted') {
      throw new Error('Expected rectangular room creation to be accepted');
    }
    const changed = configureRectangularRoom(
      created.project,
      { depthMm: '3350', heightMm: '2750', widthMm: '4550' },
      ids('must-not-allocate'),
      '2026-08-05T14:17:16.000Z'
    );

    expect(changed.kind).toBe('accepted');
    if (changed.kind !== 'accepted') {
      throw new Error('Expected accepted rectangular update');
    }
    expect(changed.project.level.vertices.map((vertex) => vertex.vertexId)).toEqual([
      'v-1',
      'v-2',
      'v-3',
      'v-4'
    ]);
    expect(changed.project.level.wallSegments.map((wall) => wall.wallSegmentId)).toEqual([
      'wall-1',
      'wall-2',
      'wall-3',
      'wall-4'
    ]);
    expect(changed.project.level.rooms[0]).toMatchObject({ roomId: 'room-1', heightMm: 2750 });
    expect(deriveRectangularRoomMetrics(changed.project)).toMatchObject({
      depthMm: 3350,
      heightMm: 2750,
      widthMm: 4550
    });
  });

  it.each(['', ' 4000', '4000 ', '0', '-1', '1.5', '1e3', '9007199254740992', '-0'])(
    'rejects invalid raw dimension lexeme %p without changing the project',
    (widthMm) => {
      const project = initialProject();

      expect(
        configureRectangularRoom(
          project,
          { depthMm: '3000', heightMm: '2600', widthMm },
          ids('must-not-allocate'),
          '2026-08-05T14:16:16.000Z'
        )
      ).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
      expect(project.level.vertices).toEqual([]);
    }
  );

  it.each([
    { depthMm: '1.5', heightMm: '2600', widthMm: '4000' },
    { depthMm: '3000', heightMm: '1e3', widthMm: '4000' },
    { depthMm: '3000', heightMm: '2600', widthMm: '9007199254740991' },
    { depthMm: '9007199254740991', heightMm: '2600', widthMm: '4000' }
  ])('rejects invalid or non-representable values in every dimension field', (input) => {
    expect(
      configureRectangularRoom(
        initialProject(),
        input,
        ids('must-not-allocate'),
        '2026-08-05T14:16:16.000Z'
      )
    ).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });

  it.each([
    { depthMm: '3000', heightMm: '2600', widthMm: '99901' },
    { depthMm: '99901', heightMm: '2600', widthMm: '4000' },
    { depthMm: '3000', heightMm: '10001', widthMm: '4000' }
  ])('rejects otherwise valid dimensions outside the Project hard limits', (input) => {
    expect(
      configureRectangularRoom(
        initialProject(),
        input,
        ids('must-not-allocate'),
        '2026-08-05T14:16:16.000Z'
      )
    ).toEqual({ kind: 'rejected', reasonCode: 'PROJECT_BOUNDS_EXCEEDED' });
  });

  it('never rewrites a non-empty plan that is not exactly this rectangular starter', () => {
    const project = initialProject();
    const nonStarter = {
      ...project,
      level: {
        ...project.level,
        vertices: [{ vertexId: 'loose-vertex', xMm: 0, zMm: 0 }]
      }
    };

    expect(
      configureRectangularRoom(
        nonStarter,
        { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
        ids('must-not-allocate'),
        '2026-08-05T14:16:16.000Z'
      )
    ).toEqual({ kind: 'rejected', reasonCode: 'PLAN_NOT_RECTANGULAR_STARTER' });
    expect(nonStarter.level.vertices).toEqual([{ vertexId: 'loose-vertex', xMm: 0, zMm: 0 }]);
  });

  it.each([
    (project: ReturnType<typeof initialProject>) => ({
      ...project,
      level: { ...project.level, rooms: [] }
    }),
    (project: ReturnType<typeof initialProject>) => ({
      ...project,
      level: {
        ...project.level,
        wallSegments: project.level.wallSegments.map((wall, index) =>
          index === 0 ? { ...wall, thicknessMm: 99 } : wall
        )
      }
    }),
    (project: ReturnType<typeof initialProject>) => ({
      ...project,
      level: {
        ...project.level,
        wallSegments: project.level.wallSegments.map((wall, index) =>
          index === 1 ? { ...wall, wallSegmentId: 'wall-1' } : wall
        )
      }
    }),
    (project: ReturnType<typeof initialProject>) => ({
      ...project,
      level: {
        ...project.level,
        wallSegments: project.level.wallSegments.map((wall, index) =>
          index === 0 ? { ...wall, endVertexId: 'v-3' } : wall
        )
      }
    }),
    (project: ReturnType<typeof initialProject>) => ({
      ...project,
      level: {
        ...project.level,
        vertices: project.level.vertices.map((vertex, index) =>
          index === 0 ? { ...vertex, vertexId: '' } : vertex
        )
      }
    }),
    (project: ReturnType<typeof initialProject>) => ({
      ...project,
      level: {
        ...project.level,
        vertices: project.level.vertices.map((vertex, index) =>
          index === 2 ? { ...vertex, xMm: vertex.xMm - 100 } : vertex
        )
      }
    })
  ])('does not derive metrics from a malformed starter graph', (mutate) => {
    const created = configureRectangularRoom(
      initialProject(),
      { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
      ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
      '2026-08-05T14:16:16.000Z'
    );
    if (created.kind !== 'accepted') {
      throw new Error('Expected valid starter fixture');
    }

    expect(deriveRectangularRoomMetrics(mutate(created.project))).toBeUndefined();
  });

  it('never overwrites a four-edge trapezoid as though it were a rectangular starter', () => {
    const created = configureRectangularRoom(
      initialProject(),
      { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
      ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
      '2026-08-05T14:16:16.000Z'
    );
    if (created.kind !== 'accepted') {
      throw new Error('Expected valid starter fixture');
    }
    const trapezoid = {
      ...created.project,
      level: {
        ...created.project.level,
        vertices: created.project.level.vertices.map((vertex, index) =>
          index === 2 ? { ...vertex, xMm: vertex.xMm - 100 } : vertex
        )
      }
    };

    expect(
      configureRectangularRoom(
        trapezoid,
        { depthMm: '3200', heightMm: '2600', widthMm: '4200' },
        ids('must-not-allocate'),
        '2026-08-05T14:17:16.000Z'
      )
    ).toEqual({ kind: 'rejected', reasonCode: 'PLAN_NOT_RECTANGULAR_STARTER' });
    expect(trapezoid.level.vertices[2]?.xMm).toBe(4000);
  });
});
