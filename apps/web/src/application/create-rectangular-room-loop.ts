import {
  createRectangularRoomLoop,
  type CreateRectangularRoomLoopResult,
  type RectangularRoomLoopInput
} from '../domain/rectangular-room-loop';
import { PROJECT_SCHEMA_VERSION, type Revision } from '../domain/project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type CreateRectangularRoomLoopStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: import('./ports').PublicationFailureReason;
      readonly candidate: PublicationCandidate;
    };

export type CreateRectangularRoomLoopUseCaseResult =
  | Exclude<CreateRectangularRoomLoopResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface CreateRectangularRoomLoopDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

export class CreateRectangularRoomLoopUseCase {
  public constructor(private readonly dependencies: CreateRectangularRoomLoopDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: RectangularRoomLoopInput,
    onStatus: (status: CreateRectangularRoomLoopStatus) => void
  ): Promise<CreateRectangularRoomLoopUseCaseResult> {
    const updated = createRectangularRoomLoop(base.project, input, this.dependencies.ids, this.dependencies.clock.now());
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
    return { kind: 'durable', projectId: updated.project.projectId, revisionId: revision.revisionId };
  }
}
