import {
  recoverUnresolvedCustomGlbReferences,
  type RecoverUnresolvedCustomGlbReferencesResult
} from '../domain/recover-unresolved-custom-glb-references';
import { PROJECT_SCHEMA_VERSION, type Revision } from '../domain/project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRevisionPublicationPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type RecoverUnresolvedCustomGlbReferencesStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | {
      readonly kind: 'stale-base';
      readonly reasonCode: 'STALE_BASE_REVISION';
      readonly candidate: PublicationCandidate;
    }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: import('./ports').PublicationFailureReason;
      readonly candidate: PublicationCandidate;
    };

export type RecoverUnresolvedCustomGlbReferencesUseCaseResult =
  | Exclude<RecoverUnresolvedCustomGlbReferencesResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'stale-base'; readonly reasonCode: 'STALE_BASE_REVISION' }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface RecoverUnresolvedCustomGlbReferencesDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRevisionPublicationPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

/** Publishes a deletion-only recovery candidate from one exact current Project base. */
export class RecoverUnresolvedCustomGlbReferencesUseCase {
  public constructor(private readonly dependencies: RecoverUnresolvedCustomGlbReferencesDependencies) {}

  public async execute(
    base: PublicationCandidate,
    unresolvedResourceHashes: readonly string[],
    onStatus: (status: RecoverUnresolvedCustomGlbReferencesStatus) => void
  ): Promise<RecoverUnresolvedCustomGlbReferencesUseCaseResult> {
    const updated = recoverUnresolvedCustomGlbReferences(
      base.project,
      unresolvedResourceHashes,
      this.dependencies.clock.now()
    );
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
      revisionId: revision.revisionId
    };
  }
}
