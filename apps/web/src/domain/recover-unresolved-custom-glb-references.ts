import type { Project } from './project';

export type RecoverUnresolvedCustomGlbReferencesResult =
  | {
      readonly kind: 'accepted';
      readonly project: Project;
      readonly removedAssetDefinitionIds: readonly string[];
      readonly removedAssetInstanceIds: readonly string[];
    }
  | {
      readonly kind: 'rejected';
      readonly reasonCode: 'RECOVERY_NOT_REQUIRED' | 'RECOVERY_REFERENCE_DANGLING';
    };

/**
 * Produces the deletion-only current-Project part of a RecoveryChangeSet.
 * Resource bytes are intentionally not touched: their reachability belongs to
 * the shared-store GC policy, not a single Project revision mutation.
 */
export function recoverUnresolvedCustomGlbReferences(
  project: Project,
  unresolvedResourceHashes: readonly string[],
  updatedAt: string
): RecoverUnresolvedCustomGlbReferencesResult {
  const definitionIds = new Set(project.assetDefinitionRefs.map((definition) => definition.assetDefinitionId));
  if (
    definitionIds.size !== project.assetDefinitionRefs.length
    || project.assetDefinitionRefs.some((definition) => definition.assetDefinitionId.length === 0)
    || project.assetInstances.some(
      (item) => item.assetDefinitionId !== undefined && !definitionIds.has(item.assetDefinitionId)
    )
  ) {
    return { kind: 'rejected', reasonCode: 'RECOVERY_REFERENCE_DANGLING' };
  }

  const hashes = new Set(unresolvedResourceHashes);
  const removedDefinitions = project.assetDefinitionRefs.filter((definition) => hashes.has(definition.resourceHash));
  if (hashes.size === 0 || removedDefinitions.length === 0) {
    return { kind: 'rejected', reasonCode: 'RECOVERY_NOT_REQUIRED' };
  }
  if (!unresolvedResourceHashes.every((hash) => removedDefinitions.some((definition) => definition.resourceHash === hash))) {
    return { kind: 'rejected', reasonCode: 'RECOVERY_NOT_REQUIRED' };
  }

  const removedDefinitionIds = new Set(removedDefinitions.map((definition) => definition.assetDefinitionId));
  const removedInstances = project.assetInstances.filter((item) =>
    item.assetDefinitionId !== undefined && removedDefinitionIds.has(item.assetDefinitionId)
  );

  return {
    kind: 'accepted',
    project: {
      ...project,
      assetDefinitionRefs: project.assetDefinitionRefs.filter(
        (definition) => !removedDefinitionIds.has(definition.assetDefinitionId)
      ),
      assetInstances: project.assetInstances.filter(
        (item) => item.assetDefinitionId === undefined || !removedDefinitionIds.has(item.assetDefinitionId)
      ),
      updatedAt
    },
    removedAssetDefinitionIds: removedDefinitions.map((definition) => definition.assetDefinitionId),
    removedAssetInstanceIds: removedInstances.map((item) => item.assetInstanceId)
  };
}
