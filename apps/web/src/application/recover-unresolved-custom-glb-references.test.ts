import { describe, expect, it } from '@rstest/core';

import { canonicalProjectSerializer } from './create-project';
import { RecoverUnresolvedCustomGlbReferencesUseCase } from './recover-unresolved-custom-glb-references';
import { createInitialProject } from '../domain/initial-project';
import type { PublicationCandidate } from './ports';

const brokenHash = 'a'.repeat(64);

function candidate(): PublicationCandidate {
  const project = createInitialProject({
    createdAt: '2026-08-18T13:50:00.000Z',
    levelId: 'level-recovery',
    name: 'Восстановление',
    projectId: 'project-recovery'
  });
  const withBrokenReference = {
    ...project,
    assetDefinitionRefs: [{
      assetDefinitionId: 'broken-chair',
      byteLength: 64,
      depthMm: 700,
      displayName: 'Кресло',
      format: 'glb' as const,
      heightMm: 800,
      resourceHash: brokenHash,
      widthMm: 900
    }],
    assetInstances: [{
      anchorClass: 'floor' as const,
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
    }]
  };
  return {
    project: withBrokenReference,
    revision: {
      checksum: 'sum:base',
      createdAt: withBrokenReference.updatedAt,
      projectId: withBrokenReference.projectId,
      revisionId: 'revision-base',
      schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(withBrokenReference)
    }
  };
}

describe('RecoverUnresolvedCustomGlbReferencesUseCase', () => {
  it('publishes exactly one next revision from the captured base after removing all broken references', async () => {
    const publications: Array<{ readonly candidate: PublicationCandidate; readonly expectedBaseRevisionId: string }> = [];
    const statuses: string[] = [];
    const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
      checksum: { sha256: async () => 'sum:recovered' },
      clock: { now: () => '2026-08-18T13:51:00.000Z' },
      ids: { next: () => 'revision-recovered' },
      repository: {
        publishNextRevision: async (next, expectedBaseRevisionId) => {
          publications.push({ candidate: next as PublicationCandidate, expectedBaseRevisionId });
          return { kind: 'durable' };
        }
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidate(), [brokenHash], (status) => statuses.push(status.kind)))
      .resolves.toEqual({
        kind: 'durable',
        projectId: 'project-recovery',
        revisionId: 'revision-recovered'
      });
    expect(publications).toEqual([{
      candidate: expect.objectContaining({
        project: expect.objectContaining({ assetDefinitionRefs: [], assetInstances: [] }),
        revision: expect.objectContaining({ checksum: 'sum:recovered', revisionId: 'revision-recovered' })
      }),
      expectedBaseRevisionId: 'revision-base'
    }]);
    expect(statuses).toEqual(['saving', 'saved']);
  });

  it('does not treat a stale current-project base as a durable recovery', async () => {
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
      checksum: { sha256: async () => 'sum:recovered' },
      clock: { now: () => '2026-08-18T13:51:00.000Z' },
      ids: { next: () => 'revision-recovered' },
      repository: { publishNextRevision: async () => ({ kind: 'stale-base' }) },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidate(), [brokenHash], (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'stale-base', reasonCode: 'STALE_BASE_REVISION' });
    expect(statuses).toEqual([
      { kind: 'saving' },
      {
        candidate: expect.objectContaining({
          project: expect.objectContaining({ assetDefinitionRefs: [], assetInstances: [] }),
          revision: expect.objectContaining({ revisionId: 'revision-recovered' })
        }),
        kind: 'stale-base',
        reasonCode: 'STALE_BASE_REVISION'
      }
    ]);
  });

  it('keeps the deletion candidate out of session history when persistence fails', async () => {
    const statuses: Array<{ readonly kind: string; readonly candidate?: PublicationCandidate }> = [];
    const useCase = new RecoverUnresolvedCustomGlbReferencesUseCase({
      checksum: { sha256: async () => 'sum:recovered' },
      clock: { now: () => '2026-08-18T13:51:00.000Z' },
      ids: { next: () => 'revision-recovered' },
      repository: {
        publishNextRevision: async () => ({
          kind: 'persist-failed',
          reasonCode: 'PERSISTENCE_WRITE_FAILED'
        })
      },
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(candidate(), [brokenHash], (status) => statuses.push(status)))
      .resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });
    expect(statuses).toEqual([
      { kind: 'saving' },
      {
        candidate: expect.objectContaining({
          project: expect.objectContaining({ assetDefinitionRefs: [], assetInstances: [] }),
          revision: expect.objectContaining({ revisionId: 'revision-recovered' })
        }),
        kind: 'persist-failed',
        reasonCode: 'PERSISTENCE_WRITE_FAILED'
      }
    ]);
  });
});
