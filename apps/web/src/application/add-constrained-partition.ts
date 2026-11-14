import { publishProjectMutation } from './project-mutation-publication';
import {
  addConstrainedPartition,
  type AddConstrainedPartitionResult,
  type ConstrainedPartitionInput
} from '../domain/constrained-partition';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type AddConstrainedPartitionStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: import('./ports').PublicationFailureReason;
      readonly candidate: PublicationCandidate;
    };

export type AddConstrainedPartitionUseCaseResult =
  | Exclude<AddConstrainedPartitionResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface AddConstrainedPartitionDependencies {
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly serializer: ProjectSerializerPort;
  readonly checksum: ChecksumPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
}

export class AddConstrainedPartitionUseCase {
  public constructor(private readonly dependencies: AddConstrainedPartitionDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: ConstrainedPartitionInput,
    onStatus: (status: AddConstrainedPartitionStatus) => void
  ): Promise<AddConstrainedPartitionUseCaseResult> {
    const updated = addConstrainedPartition(base.project, input, this.dependencies.ids, this.dependencies.clock.now());
    if (updated.kind === 'rejected') {
      return updated;
    }
    return publishProjectMutation(updated.project, this.dependencies, onStatus, base.revision.revisionId);
  }
}
