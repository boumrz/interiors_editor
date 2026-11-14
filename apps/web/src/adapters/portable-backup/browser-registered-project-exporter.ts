import { copyProject } from "../../domain/copy-project";
import { freezeBrowserBackupValue } from "../../application/browser-backup-representability";
import { ExportRuntimePortableBackupUseCase } from "../../application/export-runtime-portable-backup";
import type { ExportPortableBackupResult } from "../../application/export-portable-backup";
import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import type {
	CancellationSignalPort,
	ChecksumPort,
	CustomAssetResource,
	DurablePublicationCandidate,
	PortableBackupArchiveWriterPort,
	PortableBackupSmokeCheckPort,
} from "../../application/ports";
import type { CustomGlbAssetDefinition } from "../../domain/project";

/** The caller supplies a freshly loaded, owned Durable candidate, never the pending editor state. */
export class BrowserRegisteredProjectExporter {
	public constructor(
		private readonly dependencies: {
			readonly checksum: ChecksumPort;
			readonly smoke: PortableBackupSmokeCheckPort;
			readonly writer: PortableBackupArchiveWriterPort;
			readonly readPinnedSnapshot: (
				definitions: readonly CustomGlbAssetDefinition[],
			) => Promise<readonly CustomAssetResource[] | undefined>;
		},
	) {}
	public async execute(
		input: DurablePublicationCandidate,
		signal?: CancellationSignalPort,
	): Promise<
		ExportPortableBackupResult | { readonly kind: "verification-unavailable" }
	> {
		try {
			if (signal?.aborted) return cancelled();
			if (
				input.project.schemaVersion !== 1 ||
				input.revision.schemaVersion !== 1
			)
				return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" };
			const candidate = {
				project: copyProject(input.project),
				revision: { ...input.revision },
			};
			freezeBrowserBackupValue(candidate);
			const valid = validateRuntimeV1Project(candidate.project);
			if (valid.kind !== "accepted") return valid;
			const resources =
				candidate.project.assetDefinitionRefs.length === 0
					? []
					: await this.dependencies.readPinnedSnapshot(
							candidate.project.assetDefinitionRefs,
						);
			if (signal?.aborted) return cancelled();
			if (!resources) return { kind: "verification-unavailable" };
			const owned = new Map(
				resources.map((resource) => [
					resource.resourceHash,
					resource.bytes.slice(),
				]),
			);
			if (
				owned.size !== candidate.project.assetDefinitionRefs.length ||
				resources.length !== owned.size ||
				candidate.project.assetDefinitionRefs.some(
					(ref) => owned.get(ref.resourceHash)?.byteLength !== ref.byteLength,
				)
			)
				return { kind: "verification-unavailable" };
			return await new ExportRuntimePortableBackupUseCase({
				checksum: this.dependencies.checksum,
				smoke: this.dependencies.smoke,
				writer: this.dependencies.writer,
				resources: { read: async (key) => owned.get(key)?.slice() },
			}).execute(candidate, signal);
		} catch {
			return signal?.aborted
				? cancelled()
				: { kind: "verification-unavailable" };
		}
	}
}
function cancelled() {
	return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" } as const;
}
