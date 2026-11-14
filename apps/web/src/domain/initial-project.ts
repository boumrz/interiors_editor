import { PROJECT_SCHEMA_VERSION, type Project } from './project';

export interface InitialProjectValues {
  readonly projectId: string;
  readonly levelId: string;
  readonly name: string;
  readonly createdAt: string;
}

export function createInitialProject(values: InitialProjectValues): Project {
  return {
    assetDefinitionRefs: [],
    assetInstances: [],
    createdAt: values.createdAt,
    level: {
      levelId: values.levelId,
      openings: [],
      rooms: [],
      vertices: [],
      wallSegments: []
    },
    lifecycle: 'active',
    name: values.name,
    projectId: values.projectId,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    updatedAt: values.createdAt
  };
}
