import { publishProjectMutation } from './project-mutation-publication';
import {
  configureRectangularRoom,
  type RectangularRoomInput,
  type RectangularRoomMetrics
} from '../domain/rectangular-room';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type ConfigureRectangularRoomStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate; readonly metrics: RectangularRoomMetrics }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: import('./ports').PublicationFailureReason;
      readonly candidate: PublicationCandidate;
    };

export type ConfigureRectangularRoomUseCaseResult =
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | 'INVALID_DIMENSION'
        | 'PROJECT_BOUNDS_EXCEEDED'
        | 'PLAN_NOT_RECTANGULAR_STARTER';
    }
  | {
      readonly kind: 'durable';
      readonly projectId: string;
      readonly revisionId: string;
      readonly metrics: RectangularRoomMetrics;
    }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface ConfigureRectangularRoomDependencies {
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly serializer: ProjectSerializerPort;
  readonly checksum: ChecksumPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
}

export class ConfigureRectangularRoomUseCase {
  public constructor(private readonly dependencies: ConfigureRectangularRoomDependencies) {}

  public async execute(
    base: PublicationCandidate,
    input: RectangularRoomInput,
    onStatus: (status: ConfigureRectangularRoomStatus) => void
  ): Promise<ConfigureRectangularRoomUseCaseResult> {
    const updated = configureRectangularRoom(
      base.project,
      input,
      this.dependencies.ids,
      this.dependencies.clock.now()
    );
    if (updated.kind === 'rejected') {
      return updated;
    }
    const metrics = updated.metrics;
    const publication = await publishProjectMutation(
      updated.project,
      this.dependencies,
      (status) => onStatus(status.kind === 'saved' ? { ...status, metrics } : status),
      base.revision.revisionId
    );
    return publication.kind === 'durable' ? { ...publication, metrics } : publication;
  }
}
