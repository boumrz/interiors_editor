import { PROJECT_SCHEMA_VERSION, type Project } from '../domain/project';
import type {
  ChecksumPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate,
  PublicationFailureReason
} from './ports';

type ProjectPublicationDependencies = {
  readonly checksum: ChecksumPort;
  readonly ids: IdPort;
  readonly serializer: ProjectSerializerPort;
};

type ProjectMutationPublicationStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: PublicationFailureReason;
      readonly candidate: PublicationCandidate;
    };

type ProjectMutationPublicationResult =
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: PublicationFailureReason };

/** One schema-1 snapshot and checksum, prepared before a pending-save status. */
export async function prepareProjectPublication(
  project: Project,
  dependencies: ProjectPublicationDependencies
): Promise<PublicationCandidate> {
  const serializedProject = dependencies.serializer.serialize(project);
  const revision = {
    checksum: await dependencies.checksum.sha256(serializedProject),
    createdAt: project.updatedAt,
    projectId: project.projectId,
    revisionId: dependencies.ids.next(),
    schemaVersion: PROJECT_SCHEMA_VERSION,
    serializedProject
  };
  return { project, revision };
}

/** Keeps validation in each command and durability in its existing repository. */
export async function publishProjectMutation(
  project: Project,
  dependencies: ProjectPublicationDependencies & {
    readonly repository: Pick<ProjectRepositoryPort, 'publish'>;
  },
  onStatus: (status: ProjectMutationPublicationStatus) => void,
  expectedBaseRevisionId: string
): Promise<ProjectMutationPublicationResult> {
  const candidate = await prepareProjectPublication(project, dependencies);
  onStatus({ kind: 'saving' });
  const publication = await dependencies.repository.publish(candidate, expectedBaseRevisionId);
  if (publication.kind === 'persist-failed') {
    onStatus({ ...publication, candidate });
    return publication;
  }
  onStatus({ candidate, kind: 'saved' });
  return {
    kind: 'durable',
    projectId: project.projectId,
    revisionId: candidate.revision.revisionId
  };
}
