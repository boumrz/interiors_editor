import { publishProjectMutation } from './project-mutation-publication';
import {
  deleteParametricFloorItem,
  type DeleteParametricFloorItemInput,
  type DeleteParametricFloorItemResult
} from '../domain/parametric-item';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type DeleteParametricFloorItemStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type DeleteParametricFloorItemUseCaseResult =
  | Exclude<DeleteParametricFloorItemResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface DeleteParametricFloorItemDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

export class DeleteParametricFloorItemUseCase {
  public constructor(private readonly dependencies: DeleteParametricFloorItemDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: DeleteParametricFloorItemInput,
    onStatus: (status: DeleteParametricFloorItemStatus) => void
  ): Promise<DeleteParametricFloorItemUseCaseResult> {
    const updated = deleteParametricFloorItem(base.project, input, this.dependencies.clock.now());
    if (updated.kind === 'rejected') {
      return updated;
    }
    return publishProjectMutation(updated.project, this.dependencies, onStatus, base.revision.revisionId);
  }
}
