import type { Project } from './project';

export function serializeProjectCanonically(project: Project): string {
  return JSON.stringify({
    schemaVersion: project.schemaVersion,
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
    assetInstances: project.assetInstances,
    assetDefinitionRefs: project.assetDefinitionRefs
  });
}
