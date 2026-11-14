import { describe, expect, it } from '@rstest/core';

import { configureRectangularRoom } from './rectangular-room';
import { exactMeasurement } from './exact-quadratic-surd';
import { createInitialProject } from './initial-project';
import { migrateProjectV1ToV2 } from './migrate-project-v1-to-v2';
import { resolveProjectV2Plan } from './derived-project-v2-plan';
import type { ProjectV2 } from './project-v2';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function migratedStarter() {
  const configured = configureRectangularRoom(
    createInitialProject({
      createdAt: '2026-08-06T12:30:00.000Z',
      levelId: 'level-1',
      name: 'v2 план',
      projectId: 'project-1'
    }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-06T12:31:00.000Z'
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

describe('resolveProjectV2Plan', () => {
  it('derives a v2 room from the PlanGraph and uses its metadata only for height and room identity', () => {
    expect(resolveProjectV2Plan(migratedStarter())).toEqual({
      kind: 'accepted',
      plan: expect.objectContaining({
        rooms: [expect.objectContaining({
          heightMm: 2600,
          roomId: 'room-1',
          usableFloorAreaMm2: exactMeasurement(12_000_000n),
          usableFloorPerimeterMm: exactMeasurement(14_000n),
          usableFloorTilesMm: [{ maxXmm: 4050, maxZmm: 3050, minXmm: 50, minZmm: 50 }]
        })],
        walls: expect.arrayContaining([
          expect.objectContaining({ exteriorNormal: { x: 0, z: -1 }, wallSegmentId: 'wall-1' })
        ])
      })
    });
  });

  it('renders a validated open v2 graph as walls without inventing a room or floor', () => {
    const openPlan: ProjectV2 = {
      assetDefinitionRefs: [],
      assetInstances: [],
      createdAt: '2026-08-06T12:30:00.000Z',
      level: {
        levelId: 'level-1',
        openings: [],
        roomMetadata: [],
        vertices: [
          { vertexId: 'a', xMm: 0, zMm: 0 },
          { vertexId: 'b', xMm: 3000, zMm: 0 }
        ],
        wallSegments: [{ endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-1' }]
      },
      lifecycle: 'active',
      name: 'Открытая линия',
      projectId: 'project-1',
      schemaVersion: 2,
      updatedAt: '2026-08-06T12:30:00.000Z'
    };

    expect(resolveProjectV2Plan(openPlan)).toEqual({
      kind: 'accepted',
      plan: {
        rooms: [],
        walls: [{ heightMm: 2600, wallSegmentId: 'wall-1' }]
      }
    });
  });

  it('rejects v2 Room metadata that cannot be reconciled to a derived face', () => {
    const project = migratedStarter();
    const room = project.level.roomMetadata[0];
    if (!room) {
      throw new Error('Expected v2 room metadata fixture');
    }
    expect(resolveProjectV2Plan({
      ...project,
      level: {
        ...project.level,
        roomMetadata: [{ ...room, faceFingerprint: 'orthogonal-face:made-up' }]
      }
    })).toEqual({ kind: 'rejected', reasonCode: 'ROOM_FACE_RECONCILIATION_FAILED' });
  });
});
