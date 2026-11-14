import { publishProjectMutation } from './project-mutation-publication';
import {
  deleteConstrainedWall,
  type DeleteConstrainedWallInput,
  type DeleteConstrainedWallResult
} from '../domain/constrained-partition';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type DeleteConstrainedWallStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type DeleteConstrainedWallUseCaseResult =
  | Exclude<DeleteConstrainedWallResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface DeleteConstrainedWallDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

export class DeleteConstrainedWallUseCase {
  public constructor(private readonly dependencies: DeleteConstrainedWallDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: DeleteConstrainedWallInput,
    onStatus: (status: DeleteConstrainedWallStatus) => void
  ): Promise<DeleteConstrainedWallUseCaseResult> {
    const updated = deleteConstrainedWall(base.project, input, this.dependencies.ids, this.dependencies.clock.now());
    if (updated.kind === 'rejected') {
      return updated;
    }
    return publishProjectMutation(updated.project, this.dependencies, onStatus, base.revision.revisionId);
  }
}
