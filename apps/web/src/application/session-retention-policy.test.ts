import { describe, expect, it } from '@rstest/core';

import { createInitialProject } from '../domain/initial-project';
import type { CustomGlbAssetDefinition } from '../domain/project';
import type { DurablePublicationCandidate } from './ports';
import { assessSessionRetention } from './session-retention-policy';

function asset(resourceHash: string, byteLength: number): CustomGlbAssetDefinition {
  return {
    assetDefinitionId: `definition:${resourceHash}`,
    byteLength,
    depthMm: 100,
    displayName: resourceHash,
    format: 'glb',
    heightMm: 100,
    resourceHash,
    widthMm: 100
  };
}

function candidate(
  revisionId: string,
  resources: readonly CustomGlbAssetDefinition[]
): DurablePublicationCandidate {
  const createdAt = '2026-08-22T12:00:00.000Z';
  const project = createInitialProject({
    createdAt,
    levelId: 'level-1',
    name: 'План',
    projectId: 'project-1'
  });

  return {
    project: { ...project, assetDefinitionRefs: resources },
    revision: {
      checksum: `checksum:${revisionId}`,
      createdAt,
      projectId: project.projectId,
      revisionId,
      schemaVersion: 1,
      serializedProject: '{}'
    }
  };
}

describe('SessionRetentionPolicy', () => {
  it('admits an exact resource envelope and counts a shared history resource only once', () => {
    const current = candidate('revision-current', [asset('hash:lamp', 5)]);
    const undo = [candidate('revision-undo', [asset('hash:table', 3)])];
    const redo = [candidate('revision-redo', [asset('hash:lamp', 5)])];
    const prospective = candidate('revision-next', [asset('hash:chair', 2), asset('hash:lamp', 5)]);

    expect(assessSessionRetention({
      current,
      limits: { maxResourceBytes: 10, maxResourceEntries: 3 },
      prospective,
      redo,
      undo
    })).toEqual({
      kind: 'accepted',
      resourceBytes: 10,
      resourceEntries: 3
    });
  });

  it('rejects the next command before a new resource exceeds the retained entry envelope', () => {
    const redo = [candidate('revision-redo', [asset('hash:redo', 1)])];
    const decision = assessSessionRetention({
      current: candidate('revision-current', [asset('hash:current', 1)]),
      limits: { maxResourceBytes: 10, maxResourceEntries: 2 },
      prospective: candidate('revision-next', [asset('hash:next', 1)]),
      redo,
      undo: []
    });

    expect(decision).toEqual({
      kind: 'rejected',
      limit: 2,
      measured: 3,
      metric: 'resource-entries',
      reasonCode: 'PROJECT_HISTORY_RESOURCE_LIMIT'
    });
    expect(redo).toEqual([candidate('revision-redo', [asset('hash:redo', 1)])]);
  });

  it('rejects the next command before a new resource exceeds the retained byte envelope', () => {
    expect(assessSessionRetention({
      current: candidate('revision-current', [asset('hash:current', 8)]),
      limits: { maxResourceBytes: 10, maxResourceEntries: 3 },
      prospective: candidate('revision-next', [asset('hash:next', 3)]),
      redo: [candidate('revision-redo', [asset('hash:redo', 1)])],
      undo: []
    })).toEqual({
      kind: 'rejected',
      limit: 10,
      measured: 12,
      metric: 'resource-bytes',
      reasonCode: 'PROJECT_HISTORY_RESOURCE_LIMIT'
    });
  });

  it('conservatively keeps the greatest length when corrupt history claims different sizes for one digest', () => {
    expect(assessSessionRetention({
      current: candidate('revision-current', [asset('hash:shared', 4)]),
      limits: { maxResourceBytes: 6, maxResourceEntries: 1 },
      prospective: candidate('revision-next', [asset('hash:shared', 7)]),
      redo: [],
      undo: []
    })).toEqual({
      kind: 'rejected',
      limit: 6,
      measured: 7,
      metric: 'resource-bytes',
      reasonCode: 'PROJECT_HISTORY_RESOURCE_LIMIT'
    });
  });

  it('does not let a smaller prospective claim reduce a retained digest length', () => {
    expect(assessSessionRetention({
      current: candidate('revision-current', [asset('hash:shared', 10)]),
      limits: { maxResourceBytes: 5, maxResourceEntries: 1 },
      prospective: candidate('revision-next', [asset('hash:shared', 3)]),
      redo: [],
      undo: []
    })).toEqual({
      kind: 'rejected',
      limit: 5,
      measured: 10,
      metric: 'resource-bytes',
      reasonCode: 'PROJECT_HISTORY_RESOURCE_LIMIT'
    });
  });
});
