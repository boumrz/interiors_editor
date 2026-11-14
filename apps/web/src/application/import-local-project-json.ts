import {
  decodeLocalProjectJson,
  type DecodeLocalProjectJsonResult
} from '../domain/project-json-transfer';
import { PROJECT_SCHEMA_VERSION, type Project, type Revision } from '../domain/project';
import type {
  ChecksumPort,
  ClockPort,
  IdPort,
  ProjectRepositoryPort,
  ProjectSerializerPort,
  PublicationCandidate
} from './ports';

export type ImportLocalProjectJsonStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly candidate: PublicationCandidate }
  | {
      readonly kind: 'persist-failed';
      readonly reasonCode: import('./ports').PublicationFailureReason;
      readonly candidate: PublicationCandidate;
    };

export type ImportLocalProjectJsonResult =
  | Extract<DecodeLocalProjectJsonResult, { readonly kind: 'rejected' }>
  | { readonly kind: 'durable'; readonly projectId: string; readonly revisionId: string }
  | { readonly kind: 'persist-failed'; readonly reasonCode: import('./ports').PublicationFailureReason };

interface ImportLocalProjectJsonDependencies {
  readonly checksum: ChecksumPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly repository: ProjectRepositoryPort<import('./ports').PublicationFailureReason>;
  readonly serializer: ProjectSerializerPort;
}

/**
 * Imports only the resource-free local JSON transport. It never reuses the
 * source project identifier and does not inspect or alter any existing card.
 */
export class ImportLocalProjectJsonUseCase {
  public constructor(private readonly dependencies: ImportLocalProjectJsonDependencies) {}

  public async execute(
    bytes: Uint8Array,
    onStatus: (status: ImportLocalProjectJsonStatus) => void
  ): Promise<ImportLocalProjectJsonResult> {
    const decoded = await decodeLocalProjectJson(bytes, (value) =>
      this.dependencies.checksum.sha256(value)
    );
    if (decoded.kind === 'rejected') {
      return decoded;
    }

    const now = this.dependencies.clock.now();
    const project = copyAsNewProject(decoded.project, this.dependencies.ids.next(), now);
    const serializedProject = this.dependencies.serializer.serialize(project);
    const revision: Revision = {
      checksum: await this.dependencies.checksum.sha256(serializedProject),
      createdAt: now,
      projectId: project.projectId,
      revisionId: this.dependencies.ids.next(),
      schemaVersion: PROJECT_SCHEMA_VERSION,
      serializedProject
    };
    const candidate = { project, revision };
    onStatus({ kind: 'saving' });
    const publication = await this.dependencies.repository.publish(candidate);
    if (publication.kind === 'persist-failed') {
      onStatus({ ...publication, candidate });
      return publication;
    }
    onStatus({ candidate, kind: 'saved' });
    return {
      kind: 'durable',
      projectId: project.projectId,
      revisionId: revision.revisionId
    };
  }
}

function copyAsNewProject(source: Project, projectId: string, updatedAt: string): Project {
  return {
    ...source,
		projectId,
    updatedAt
  };
}
