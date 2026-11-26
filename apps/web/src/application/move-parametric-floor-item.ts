import { floorItemSupportConflict } from '../domain/interior-support';
import { publishProjectMutation } from './project-mutation-publication';
import {
  moveParametricFloorItem,
  type CreateParametricFloorItemResult,
  type FloorItemCollisionPolicy,
  type MoveParametricFloorItemInput,
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

export type MoveParametricFloorItemStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type MoveParametricFloorItemUseCaseResult =
  | Exclude<CreateParametricFloorItemResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string; readonly warnings?: readonly ParametricFloorItemPlacementWarning[] }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface MoveParametricFloorItemDependencies {
  readonly floorItemCollisionPolicy?: FloorItemCollisionPolicy;
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

export class MoveParametricFloorItemUseCase {
  public constructor(private readonly dependencies: MoveParametricFloorItemDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: MoveParametricFloorItemInput,
    onStatus: (status: MoveParametricFloorItemStatus) => void
  ): Promise<MoveParametricFloorItemUseCaseResult> {
    const updated = moveParametricFloorItem(
      base.project,
      input,
      this.dependencies.clock.now(),
      this.dependencies.floorItemCollisionPolicy,
    );
    if (updated.kind === 'rejected') {
      return updated;
    }
    const conflict = floorItemSupportConflict(updated.project, base.project, input.assetInstanceId);
    if (conflict) return conflict;
    const publication = await publishProjectMutation(updated.project, this.dependencies, onStatus, base.revision.revisionId);
    return publication.kind === 'durable' && updated.warnings
      ? { ...publication, warnings: updated.warnings }
      : publication;
  }
}
