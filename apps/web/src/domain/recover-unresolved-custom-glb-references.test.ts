import { describe, expect, it } from '@rstest/core';

import { recoverUnresolvedCustomGlbReferences } from './recover-unresolved-custom-glb-references';
import { createInitialProject } from './initial-project';
import type { CustomGlbAssetDefinition, Project } from './project';

const firstHash = 'a'.repeat(64);
const secondHash = 'b'.repeat(64);
const healthyHash = 'c'.repeat(64);

function definition(
  assetDefinitionId: string,
  resourceHash: string
): CustomGlbAssetDefinition {
  return {
    assetDefinitionId,
    byteLength: 64,
    depthMm: 700,
    displayName: assetDefinitionId,
    format: 'glb',
    heightMm: 800,
    resourceHash,
    widthMm: 900
  };
}

function projectWithCustomReferences(): Project {
  const project = createInitialProject({
    createdAt: '2026-08-18T13:50:00.000Z',
    levelId: 'level-recovery',
    name: 'Восстановление',
    projectId: 'project-recovery'
  });
  return {
    ...project,
    assetDefinitionRefs: [
      definition('broken-chair', firstHash),
      definition('broken-table', secondHash),
      definition('healthy-lamp', healthyHash),
      definition('unused-broken-chair', firstHash)
    ],
    assetInstances: [
      {
        anchorClass: 'floor',
        assetDefinitionId: 'broken-chair',
        assetInstanceId: 'item-broken-chair',
        color: '#416b91',
        depthMm: 700,
        heightMm: 800,
        label: 'Кресло',
        roomId: 'room-1',
        widthMm: 900,
        xMm: 1500,
        zMm: 1500
      },
      {
        anchorClass: 'floor',
        assetDefinitionId: 'broken-table',
        assetInstanceId: 'item-broken-table',
        color: '#416b91',
        depthMm: 700,
        heightMm: 800,
        label: 'Стол',
        roomId: 'room-1',
        widthMm: 900,
        xMm: 2500,
        zMm: 1500
      },
      {
        anchorClass: 'floor',
        assetDefinitionId: 'healthy-lamp',
        assetInstanceId: 'item-healthy-lamp',
        color: '#416b91',
        depthMm: 700,
        heightMm: 800,
        label: 'Лампа',
        roomId: 'room-1',
        widthMm: 900,
        xMm: 3500,
        zMm: 1500
      },
      {
        anchorClass: 'floor',
        assetInstanceId: 'item-built-in',
        color: '#416b91',
        depthMm: 700,
        heightMm: 800,
        label: 'Тумба',
        roomId: 'room-1',
        widthMm: 900,
        xMm: 4500,
        zMm: 1500
      }
    ]
  };
}

describe('recoverUnresolvedCustomGlbReferences', () => {
  it('removes every unresolved definition and dependent instance in one immutable Project candidate', () => {
    const source = projectWithCustomReferences();

    const result = recoverUnresolvedCustomGlbReferences(
      source,
      [firstHash, secondHash, firstHash],
      '2026-08-18T13:51:00.000Z'
    );

    expect(result).toEqual({
      kind: 'accepted',
      project: expect.objectContaining({
        assetDefinitionRefs: [definition('healthy-lamp', healthyHash)],
        assetInstances: expect.arrayContaining([
          expect.objectContaining({ assetInstanceId: 'item-healthy-lamp' }),
          expect.objectContaining({ assetInstanceId: 'item-built-in' })
        ]),
        updatedAt: '2026-08-18T13:51:00.000Z'
      }),
      removedAssetDefinitionIds: ['broken-chair', 'broken-table', 'unused-broken-chair'],
      removedAssetInstanceIds: ['item-broken-chair', 'item-broken-table']
    });
    if (result.kind === 'accepted') {
      expect(result.project.assetInstances.map((item) => item.assetInstanceId))
        .toEqual(['item-healthy-lamp', 'item-built-in']);
    }
    expect(source).toEqual(projectWithCustomReferences());
  });

  it('fails closed without a complete resolvable removal target', () => {
    const source = projectWithCustomReferences();
    const firstInstance = source.assetInstances[0];
    if (!firstInstance) {
      throw new Error('Expected the fixture to include an asset instance.');
    }
    const dangling: Project = {
      ...source,
      assetInstances: [
        ...source.assetInstances,
        {
          ...firstInstance,
          assetDefinitionId: 'missing-definition',
          assetInstanceId: 'item-dangling'
        }
      ]
    };

    expect(recoverUnresolvedCustomGlbReferences(source, ['f'.repeat(64)], '2026-08-18T13:51:00.000Z'))
      .toEqual({ kind: 'rejected', reasonCode: 'RECOVERY_NOT_REQUIRED' });
    expect(recoverUnresolvedCustomGlbReferences(dangling, [firstHash], '2026-08-18T13:51:00.000Z'))
      .toEqual({ kind: 'rejected', reasonCode: 'RECOVERY_REFERENCE_DANGLING' });
  });

  it('fails closed instead of deleting a healthy instance from a malformed custom-definition graph', () => {
    const source = projectWithCustomReferences();
    const brokenDefinition = source.assetDefinitionRefs[0];
    const healthyDefinition = source.assetDefinitionRefs[2];
    if (!brokenDefinition || !healthyDefinition) {
      throw new Error('Expected the fixture to include broken and healthy definitions.');
    }
    const firstInstance = source.assetInstances[0];
    if (!firstInstance) {
      throw new Error('Expected the fixture to include an asset instance.');
    }
    const duplicateId: Project = {
      ...source,
      assetDefinitionRefs: [
        brokenDefinition,
        { ...healthyDefinition, assetDefinitionId: brokenDefinition.assetDefinitionId },
        ...source.assetDefinitionRefs.slice(1, 2),
        ...source.assetDefinitionRefs.slice(3)
      ],
      assetInstances: source.assetInstances.map((item) => item.assetDefinitionId === healthyDefinition.assetDefinitionId
        ? { ...item, assetDefinitionId: brokenDefinition.assetDefinitionId }
        : item)
    };
    const emptyReference: Project = {
      ...source,
      assetInstances: [
        ...source.assetInstances,
        {
          ...firstInstance,
          assetDefinitionId: '',
          assetInstanceId: 'item-empty-definition-reference'
        }
      ]
    };

    expect(recoverUnresolvedCustomGlbReferences(duplicateId, [firstHash], '2026-08-18T13:51:00.000Z'))
      .toEqual({ kind: 'rejected', reasonCode: 'RECOVERY_REFERENCE_DANGLING' });
    expect(recoverUnresolvedCustomGlbReferences(emptyReference, [firstHash], '2026-08-18T13:51:00.000Z'))
      .toEqual({ kind: 'rejected', reasonCode: 'RECOVERY_REFERENCE_DANGLING' });
  });
});
