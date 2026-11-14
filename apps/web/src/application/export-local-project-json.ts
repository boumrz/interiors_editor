import { encodeLocalProjectJson } from '../domain/project-json-transfer';
import type { ChecksumPort, DurablePublicationCandidate, ProjectSerializerPort } from './ports';

export type ExportLocalProjectJsonResult =
  | {
      readonly content: string;
      readonly filename: string;
      readonly kind: 'ready';
      readonly mimeType: 'application/json';
    }
  | { readonly kind: 'rejected'; readonly reasonCode: 'PROJECT_JSON_UNSUPPORTED' };

interface ExportLocalProjectJsonDependencies {
  readonly checksum: ChecksumPort;
  readonly serializer: ProjectSerializerPort;
}

/**
 * Generates a download-only representation of a current resource-free V1
 * snapshot. It is intentionally separate from Portable Backup, which will
 * carry exact resource bytes once custom/catalog assets exist.
 */
export class ExportLocalProjectJsonUseCase {
  public constructor(private readonly dependencies: ExportLocalProjectJsonDependencies) {}

  public async execute(
    candidate: DurablePublicationCandidate
  ): Promise<ExportLocalProjectJsonResult> {
    if (
      candidate.project.schemaVersion !== 1 ||
      candidate.revision.schemaVersion !== 1 ||
      candidate.project.assetDefinitionRefs.length > 0
    ) {
      return { kind: 'rejected', reasonCode: 'PROJECT_JSON_UNSUPPORTED' };
    }
    const project = JSON.parse(this.dependencies.serializer.serialize(candidate.project)) as typeof candidate.project;
    const content = await encodeLocalProjectJson(project, (value) =>
      this.dependencies.checksum.sha256(value)
    );
    return {
      content,
      filename: `${downloadStem(candidate.project.name)}.interiors.json`,
      kind: 'ready',
      mimeType: 'application/json'
    };
  }
}

function downloadStem(name: string): string {
  const stem = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return stem.length > 0 ? stem.slice(0, 80) : 'project';
}
