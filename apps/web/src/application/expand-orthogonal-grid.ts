import { publishProjectMutation } from './project-mutation-publication';
import {
  expandOrthogonalGrid,
  type AddConstrainedPartitionResult,
  type OrthogonalGridExpansionInput
} from '../domain/constrained-partition';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type ExpandOrthogonalGridStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type ExpandOrthogonalGridUseCaseResult =
  | Exclude<AddConstrainedPartitionResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface ExpandOrthogonalGridDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

export class ExpandOrthogonalGridUseCase {
  public constructor(private readonly dependencies: ExpandOrthogonalGridDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: OrthogonalGridExpansionInput,
    onStatus: (status: ExpandOrthogonalGridStatus) => void
  ): Promise<ExpandOrthogonalGridUseCaseResult> {
    const updated = expandOrthogonalGrid(base.project, input, this.dependencies.ids, this.dependencies.clock.now());
    if (updated.kind === 'rejected') {
      return updated;
    }
    return publishProjectMutation(updated.project, this.dependencies, onStatus, base.revision.revisionId);
  }
}
