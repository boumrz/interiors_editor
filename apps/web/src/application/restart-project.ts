import { restartProject } from '../domain/restart-project';
import { PROJECT_SCHEMA_VERSION, type Revision } from '../domain/project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type RestartProjectStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type RestartProjectUseCaseResult =
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface RestartProjectDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

/** Publishes an empty replacement plan without deleting the preceding revision. */
export class RestartProjectUseCase {
  public constructor(private readonly dependencies: RestartProjectDependencies) {}

  public async execute(
    base: PublicationCandidate,
    onStatus: (status: RestartProjectStatus) => void
  ): Promise<RestartProjectUseCaseResult> {
    const updated = restartProject(
      base.project,
      this.dependencies.ids.next(),
      this.dependencies.clock.now()
    );
    const serializedProject = this.dependencies.serializer.serialize(updated.project);
    const revision: Revision = {
      checksum: await this.dependencies.checksum.sha256(serializedProject),
      createdAt: updated.project.updatedAt,
      projectId: updated.project.projectId,
      revisionId: this.dependencies.ids.next(),
      schemaVersion: PROJECT_SCHEMA_VERSION,
      serializedProject
    };
    const candidate = { project: updated.project, revision };
    onStatus({ kind: 'saving' });
    const publication = await this.dependencies.repository.publish(candidate, base.revision.revisionId);
    if (publication.kind === 'persist-failed') {
      onStatus({ ...publication, candidate });
      return publication;
    }
    onStatus({ candidate, kind: 'saved' });
    return { kind: 'durable', projectId: updated.project.projectId, revisionId: revision.revisionId };
  }
}
