import { publishProjectMutation } from './project-mutation-publication';
import {
  resizeParametricFloorItem,
  type CreateParametricFloorItemResult,
  type ResizeParametricFloorItemInput,
  type ParametricFloorItemPlacementWarning
} from '../domain/parametric-item';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type ResizeParametricFloorItemStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type ResizeParametricFloorItemUseCaseResult =
  | Exclude<CreateParametricFloorItemResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string; readonly warnings?: readonly ParametricFloorItemPlacementWarning[] }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface ResizeParametricFloorItemDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

export class ResizeParametricFloorItemUseCase {
  public constructor(private readonly dependencies: ResizeParametricFloorItemDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: ResizeParametricFloorItemInput,
    onStatus: (status: ResizeParametricFloorItemStatus) => void
  ): Promise<ResizeParametricFloorItemUseCaseResult> {
    const updated = resizeParametricFloorItem(base.project, input, this.dependencies.clock.now());
    if (updated.kind === 'rejected') {
      return updated;
    }
    const publication = await publishProjectMutation(updated.project, this.dependencies, onStatus, base.revision.revisionId);
    return publication.kind === 'durable' && updated.warnings
      ? { ...publication, warnings: updated.warnings }
      : publication;
  }
}
