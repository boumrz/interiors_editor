import { publishProjectMutation } from './project-mutation-publication';
import {
  createParametricFloorItem,
  type CreateParametricFloorItemResult,
  type FloorItemCollisionPolicy,
  type ParametricFloorItemInput,
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

export type CreateParametricFloorItemStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type CreateParametricFloorItemUseCaseResult =
  | Exclude<CreateParametricFloorItemResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string; readonly warnings?: readonly ParametricFloorItemPlacementWarning[] }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface CreateParametricFloorItemDependencies {
  readonly floorItemCollisionPolicy?: FloorItemCollisionPolicy;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly serializer: ProjectSerializerPort;
  readonly checksum: ChecksumPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
}

export class CreateParametricFloorItemUseCase {
  public constructor(private readonly dependencies: CreateParametricFloorItemDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: ParametricFloorItemInput,
    onStatus: (status: CreateParametricFloorItemStatus) => void
  ): Promise<CreateParametricFloorItemUseCaseResult> {
    const updated = createParametricFloorItem(
      base.project,
      input,
      this.dependencies.ids,
      this.dependencies.clock.now(),
      this.dependencies.floorItemCollisionPolicy,
    );
    if (updated.kind === 'rejected') {
      return updated;
    }
    const publication = await publishProjectMutation(updated.project, this.dependencies, onStatus, base.revision.revisionId);
    return publication.kind === 'durable' && updated.warnings
      ? { ...publication, warnings: updated.warnings }
      : publication;
  }
}
