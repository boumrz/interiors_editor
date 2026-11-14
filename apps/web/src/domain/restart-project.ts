import type { Project } from './project';

export type RestartProjectResult =
  | { readonly kind: 'accepted'; readonly project: Project };

/**
 * Starts a new plan inside the same durable project identity. The prior
 * revision is deliberately retained by the revision store and becomes the
 * immediate undo target once the replacement revision publishes.
 */
export function restartProject(
  project: Project,
  levelId: string,
  updatedAt: string
): RestartProjectResult {
  return {
    kind: 'accepted',
    project: {
      ...project,
      assetDefinitionRefs: [],
      assetInstances: [],
      level: {
        levelId,
        openings: [],
        rooms: [],
        vertices: [],
        wallSegments: []
      },
      updatedAt
    }
  };
}
