import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
  deleteDoorOpeningFromProject,
  moveDoorOpeningInProject,
	updateDoorOpeningInProject,
  type DoorOpeningProjectMutationResult
} from '../domain/door-opening-project';
import type { AddDoorOpeningInput, AddWindowOpeningInput } from '../domain/wall-opening';
import type { UpdateWallOpeningInput } from '../domain/wall-opening';
import { PROJECT_SCHEMA_VERSION, type Revision } from '../domain/project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRevisionPublicationPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type DoorOpeningProjectMutationStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'stale-base'; readonly reasonCode: 'STALE_BASE_REVISION'; readonly candidate: PublicationCandidate }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason; readonly candidate: PublicationCandidate };

export type DoorOpeningProjectMutationUseCaseResult =
  | Exclude<DoorOpeningProjectMutationResult, { readonly kind: 'accepted' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'stale-base'; readonly reasonCode: 'STALE_BASE_REVISION' }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface DoorOpeningProjectMutationDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRevisionPublicationPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

/** Publishes a Door host assignment only after the canonical wall is proven safe. */
export class AddDoorOpeningToProjectUseCase {
  public constructor(private readonly dependencies: DoorOpeningProjectMutationDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: AddDoorOpeningInput,
    onStatus: (status: DoorOpeningProjectMutationStatus) => void
  ): Promise<DoorOpeningProjectMutationUseCaseResult> {
    const updated = addDoorOpeningToProject(base.project, input, this.dependencies.ids, this.dependencies.clock.now());
    return publishDoorMutation(updated, this.dependencies, onStatus, base.revision.revisionId);
  }
}

/** Publishes a Window host assignment only after the canonical wall is proven safe. */
export class AddWindowOpeningToProjectUseCase {
  public constructor(private readonly dependencies: DoorOpeningProjectMutationDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: AddWindowOpeningInput,
    onStatus: (status: DoorOpeningProjectMutationStatus) => void
  ): Promise<DoorOpeningProjectMutationUseCaseResult> {
    const updated = addWindowOpeningToProject(base.project, input, this.dependencies.ids, this.dependencies.clock.now());
    return publishDoorMutation(updated, this.dependencies, onStatus, base.revision.revisionId);
  }
}

/** Publishes removal of one stable Opening identity without changing its wall. */
export class DeleteDoorOpeningFromProjectUseCase {
  public constructor(private readonly dependencies: DoorOpeningProjectMutationDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: { readonly openingId: string },
    onStatus: (status: DoorOpeningProjectMutationStatus) => void
  ): Promise<DoorOpeningProjectMutationUseCaseResult> {
    const updated = deleteDoorOpeningFromProject(base.project, input, this.dependencies.clock.now());
    return publishDoorMutation(updated, this.dependencies, onStatus, base.revision.revisionId);
  }
}

/** Publishes one validated change of an Opening's offset along its own wall. */
export class MoveDoorOpeningInProjectUseCase {
  public constructor(private readonly dependencies: DoorOpeningProjectMutationDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: { readonly openingId: string; readonly offsetMm: number },
    onStatus: (status: DoorOpeningProjectMutationStatus) => void
  ): Promise<DoorOpeningProjectMutationUseCaseResult> {
    const updated = moveDoorOpeningInProject(base.project, input, this.dependencies.clock.now());
    return publishDoorMutation(updated, this.dependencies, onStatus, base.revision.revisionId);
  }
}

/** Publishes one validated width, side or offset edit for a durable Opening. */
export class UpdateDoorOpeningInProjectUseCase {
  public constructor(private readonly dependencies: DoorOpeningProjectMutationDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: UpdateWallOpeningInput,
    onStatus: (status: DoorOpeningProjectMutationStatus) => void
  ): Promise<DoorOpeningProjectMutationUseCaseResult> {
    const updated = updateDoorOpeningInProject(base.project, input, this.dependencies.clock.now());
    return publishDoorMutation(updated, this.dependencies, onStatus, base.revision.revisionId);
  }
}

async function publishDoorMutation(
  updated: DoorOpeningProjectMutationResult,
  dependencies: DoorOpeningProjectMutationDependencies,
  onStatus: (status: DoorOpeningProjectMutationStatus) => void,
  expectedBaseRevisionId: string
): Promise<DoorOpeningProjectMutationUseCaseResult> {
  if (updated.kind === 'rejected') {
    return updated;
  }
  const serializedProject = dependencies.serializer.serialize(updated.project);
  const revision: Revision = {
    checksum: await dependencies.checksum.sha256(serializedProject),
    createdAt: updated.project.updatedAt,
    projectId: updated.project.projectId,
    revisionId: dependencies.ids.next(),
    schemaVersion: PROJECT_SCHEMA_VERSION,
    serializedProject
  };
  const candidate = { project: updated.project, revision };
  onStatus({ kind: 'saving' });
  const publication = await dependencies.repository.publishNextRevision(candidate, expectedBaseRevisionId);
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
  return { kind: 'durable', projectId: updated.project.projectId, revisionId: revision.revisionId };
}
