import { validateProjectName } from './project-name-policy';
import type { Project } from './project';

export type RenameProjectResult =
  | { readonly kind: 'accepted'; readonly project: Project }
  | {
      readonly kind: 'rejected';
      readonly reasonCode: 'PROJECT_NAME_REQUIRED' | 'PROJECT_NAME_INVALID_UNICODE';
    };

/**
 * Renaming is deliberately a narrow, immutable Project mutation: identity,
 * geometry, assets and creation timestamp are carried into the next revision
 * unchanged.
 */
export function renameProject(
  source: Project,
  suppliedName: string,
  updatedAt: string
): RenameProjectResult {
  const name = validateProjectName(suppliedName);
  if (name.kind === 'rejected') {
    return name;
  }

  return {
    kind: 'accepted',
    project: {
      ...source,
      name: name.name,
      updatedAt
    }
  };
}
