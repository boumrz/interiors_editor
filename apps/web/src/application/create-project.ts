import { serializeProjectCanonically } from '../domain/canonical-serialization';
import { createInitialProject } from '../domain/initial-project';
import { validateProjectName } from '../domain/project-name-policy';
import { PROJECT_SCHEMA_VERSION, type Revision } from '../domain/project';
import { serializeProjectV2Canonically } from '../domain/project-v2-codec';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort
} from './ports';

export type CreateProjectStatus =
  | { readonly kind: 'saving' }
  | {
      readonly kind: 'saved';
      readonly projectId: string;
      readonly projectName: string;
      readonly revisionId: string;
      readonly candidate: import('./ports').PublicationCandidate;
    }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: import('./ports').PublicationFailureReason;
      readonly candidate: import('./ports').PublicationCandidate;
    };

export type CreateProjectResult =
  | {
      readonly kind: 'rejected';
      readonly reasonCode: 'PROJECT_NAME_REQUIRED' | 'PROJECT_NAME_INVALID_UNICODE';
    }
  | { readonly kind: 'in-progress' }
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface CreateProjectDependencies {
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly serializer: ProjectSerializerPort;
  readonly checksum: ChecksumPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
}

export class CreateProjectUseCase {
  public constructor(private readonly dependencies: CreateProjectDependencies) {}

  public async execute(
    suppliedName: string,
    onStatus: (status: CreateProjectStatus) => void
  ): Promise<CreateProjectResult> {
    const name = validateProjectName(suppliedName);
    if (name.kind === 'rejected') {
      return name;
    }

    const createdAt = this.dependencies.clock.now();
    const project = createInitialProject({
      createdAt,
      levelId: this.dependencies.ids.next(),
      name: name.name,
      projectId: this.dependencies.ids.next()
    });
    const serializedProject = this.dependencies.serializer.serialize(project);
    const revision: Revision = {
      checksum: await this.dependencies.checksum.sha256(serializedProject),
      createdAt,
      projectId: project.projectId,
      revisionId: this.dependencies.ids.next(),
      schemaVersion: PROJECT_SCHEMA_VERSION,
      serializedProject
    };

    onStatus({ kind: 'saving' });
    const candidate = { project, revision };
    const publication = await this.dependencies.repository.publish(candidate);
    if (publication.kind === 'persist-failed') {
      onStatus({ ...publication, candidate });
      return publication;
    }

    const durable = {
      kind: 'durable' as const,
      projectId: project.projectId,
      revisionId: revision.revisionId
    };
    onStatus({
      kind: 'saved',
      projectId: durable.projectId,
      projectName: project.name,
      revisionId: durable.revisionId,
      candidate
    });
    return durable;
  }
}

export const canonicalProjectSerializer: ProjectSerializerPort = {
  serialize: (project) => project.schemaVersion === 2
    ? serializeProjectV2Canonically(project)
    : serializeProjectCanonically(project)
};
