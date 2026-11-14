import { prepareProjectPublication } from './project-mutation-publication';
import { renameProject } from '../domain/rename-project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRevisionPublicationPort,
  ProjectSerializerPort,
  PublicationFailureReason,
  PublicationCandidate
} from './ports';

export type RenameProjectStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | {
      readonly kind: 'stale-base';
      readonly reasonCode: 'STALE_BASE_REVISION';
      readonly candidate: PublicationCandidate;
    }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: PublicationFailureReason;
      readonly candidate: PublicationCandidate;
    };

export type RenameProjectUseCaseResult =
  | {
      readonly kind: 'rejected';
      readonly reasonCode: 'PROJECT_NAME_REQUIRED' | 'PROJECT_NAME_INVALID_UNICODE';
    }
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'stale-base'; readonly reasonCode: 'STALE_BASE_REVISION' }
  | { readonly kind: 'persist-failed'; readonly reasonCode: PublicationFailureReason };

interface RenameProjectDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRevisionPublicationPort<PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

/** Writes a renamed Project as an exact-base next revision, never as a clone. */
export class RenameProjectUseCase {
  public constructor(private readonly dependencies: RenameProjectDependencies) {}

  public async execute(
    base: PublicationCandidate,
    suppliedName: string,
    onStatus: (status: RenameProjectStatus) => void
  ): Promise<RenameProjectUseCaseResult> {
    const updated = renameProject(base.project, suppliedName, this.dependencies.clock.now());
    if (updated.kind === 'rejected') {
      return updated;
    }
    const candidate = await prepareProjectPublication(updated.project, this.dependencies);
    onStatus({ kind: 'saving' });
    const publication = await this.dependencies.repository.publishNextRevision(
      candidate,
      base.revision.revisionId
    );
    if (publication.kind === 'stale-base') {
      const stale = { kind: 'stale-base' as const, reasonCode: 'STALE_BASE_REVISION' as const };
      onStatus({ ...stale, candidate });
      return stale;
    }
    if (publication.kind === 'persist-failed') {
      onStatus({ ...publication, candidate });
      return publication;
    }
    onStatus({ candidate, kind: 'saved' });
    return {
      kind: 'durable',
      projectId: updated.project.projectId,
      revisionId: candidate.revision.revisionId
    };
  }
}
