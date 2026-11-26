import type { Project } from './project';
import { interiorSchemaVersionFor, supportContextFor } from './interior-project-format';

export function serializeProjectCanonically(project: Project): string {
  const interiorSchemaVersion = interiorSchemaVersionFor(project);
  const supportedItems = (project.supportedItems ?? []).map(item => ({
    ...item, context: supportContextFor(item, project),
  }));
  return JSON.stringify({
    schemaVersion: project.schemaVersion,
    ...(interiorSchemaVersion === undefined ? {} : { interiorSchemaVersion }),
    projectId: project.projectId,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    lifecycle: project.lifecycle,
    level: {
      levelId: project.level.levelId,
      vertices: project.level.vertices,
      wallSegments: project.level.wallSegments,
      rooms: project.level.rooms,
      openings: project.level.openings
    },
    ...(project.roomLayouts?.length ? { roomLayouts: project.roomLayouts } : {}),
    assetInstances: [...project.assetInstances, ...supportedItems],
    assetDefinitionRefs: project.assetDefinitionRefs
  });
}
