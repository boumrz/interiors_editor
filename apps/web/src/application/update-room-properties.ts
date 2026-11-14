import {
	resolveRoomHeightOpeningConflict,
  updateRoomProperties,
	type ResolveRoomHeightOpeningConflictInput,
  type UpdateRoomPropertiesInput,
  type UpdateRoomPropertiesResult
} from '../domain/update-room-properties';
import { PROJECT_SCHEMA_VERSION, type Revision } from '../domain/project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRevisionPublicationPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type UpdateRoomPropertiesStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'stale-base'; readonly reasonCode: 'STALE_BASE_REVISION'; readonly candidate: PublicationCandidate }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: import('./ports').PublicationFailureReason;
      readonly candidate: PublicationCandidate;
    };

export type UpdateRoomPropertiesUseCaseResult =
  | Exclude<UpdateRoomPropertiesResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'stale-base'; readonly reasonCode: 'STALE_BASE_REVISION' }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface UpdateRoomPropertiesDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRevisionPublicationPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

/** Publishes exactly one validated metadata change for a stable derived Room. */
export class UpdateRoomPropertiesUseCase {
  public constructor(private readonly dependencies: UpdateRoomPropertiesDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: UpdateRoomPropertiesInput,
    onStatus: (status: UpdateRoomPropertiesStatus) => void
  ): Promise<UpdateRoomPropertiesUseCaseResult> {
    const updated = updateRoomProperties(base.project, input, this.dependencies.clock.now());
    return this.publish(updated, base.revision.revisionId, onStatus);
  }

  /**
   * Confirms one previously shown Room-height Opening outcome against the
   * current fenced base. The domain repeats the preview and all validation
   * before this method is allowed to construct a durable Revision.
   */
  public async resolveOpeningConflict(
    base: PublicationCandidate,
    input: ResolveRoomHeightOpeningConflictInput,
    onStatus: (status: UpdateRoomPropertiesStatus) => void
  ): Promise<UpdateRoomPropertiesUseCaseResult> {
    const updated = resolveRoomHeightOpeningConflict(base.project, input, this.dependencies.clock.now());
    return this.publish(updated, base.revision.revisionId, onStatus);
  }

  private async publish(
    updated: UpdateRoomPropertiesResult,
    expectedBaseRevisionId: string,
    onStatus: (status: UpdateRoomPropertiesStatus) => void
  ): Promise<UpdateRoomPropertiesUseCaseResult> {
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
    const candidate: PublicationCandidate = { project: updated.project, revision };
    onStatus({ kind: 'saving' });
    const publication = await this.dependencies.repository.publishNextRevision(candidate, expectedBaseRevisionId);
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
      revisionId: revision.revisionId
    };
  }
}
