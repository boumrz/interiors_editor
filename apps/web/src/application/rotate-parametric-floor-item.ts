import {
  setParametricFloorItemYaw,
  type CreateParametricFloorItemResult,
  type SetParametricFloorItemYawInput,
  type ParametricFloorItemPlacementWarning
} from '../domain/parametric-item';
import { PROJECT_SCHEMA_VERSION, type Revision } from '../domain/project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type RotateParametricFloorItemStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type RotateParametricFloorItemUseCaseResult =
  | Exclude<CreateParametricFloorItemResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string; readonly warnings?: readonly ParametricFloorItemPlacementWarning[] }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface RotateParametricFloorItemDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

/** Publishes a validated continuous item turn as one atomic durable revision. */
export class RotateParametricFloorItemUseCase {
  public constructor(private readonly dependencies: RotateParametricFloorItemDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: SetParametricFloorItemYawInput,
    onStatus: (status: RotateParametricFloorItemStatus) => void
  ): Promise<RotateParametricFloorItemUseCaseResult> {
    const updated = setParametricFloorItemYaw(base.project, input, this.dependencies.clock.now());
    if (updated.kind === 'rejected') {
      return updated;
    }
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
    return {
      kind: 'durable',
      projectId: updated.project.projectId,
      revisionId: revision.revisionId,
      ...(updated.warnings ? { warnings: updated.warnings } : {})
    };
  }
}
