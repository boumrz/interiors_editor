import type { ExportPortableBackupResult } from "./export-portable-backup";
import { copyProject } from "../domain/copy-project";
import { portableBackupFileName } from "./export-portable-backup";
import { canonicalProjectSerializer } from "./create-project";
import { validateRuntimeV1Project, validateTelegramRuntimeV1Project } from "./runtime-v1-project-validation";
import type {
	CancellationSignalPort,
	ChecksumPort,
	CustomAssetResource,
	CustomAssetResourceStorePort,
	DurablePublicationCandidate,
	PortableBackupArchiveWriterPort,
	PortableBackupSmokeCheckPort,
} from "./ports";

/** Formats an exact V1 object; the internal revision serializer is never its wire encoder. */
export class ExportRuntimePortableBackupUseCase {
	public constructor(
		private readonly dependencies: {
			readonly checksum: ChecksumPort;
			readonly resources: Pick<CustomAssetResourceStorePort, "read">;
			readonly smoke: PortableBackupSmokeCheckPort;
			readonly writer: PortableBackupArchiveWriterPort;
			readonly allowTelegramExtendedSchemas?: boolean;
		},
	) {}

	public async execute(
		input: DurablePublicationCandidate,
		signal?: CancellationSignalPort,
	): Promise<ExportPortableBackupResult> {
		if (signal?.aborted) return cancelled();
		if (
			input.project.schemaVersion !== 1 ||
			input.revision.schemaVersion !== 1 ||
			input.revision.projectId !== input.project.projectId
		)
			return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" };
		const validation = this.dependencies.allowTelegramExtendedSchemas
			? validateTelegramRuntimeV1Project(input.project)
			: validateRuntimeV1Project(input.project);
		if (validation.kind === "rejected") return validation;
		const candidate = {
			project: copyProject(input.project),
			revision: { ...input.revision },
		};
		const serialized = canonicalProjectSerializer.serialize(candidate.project);
		if (
			serialized !== candidate.revision.serializedProject ||
			(await this.dependencies.checksum.sha256(serialized)) !==
				candidate.revision.checksum
		)
			return { kind: "rejected", reasonCode: "BACKUP_CHECKSUM_MISMATCH" };
		if (signal?.aborted) return cancelled();
		const resources: CustomAssetResource[] = [];
		for (const definition of candidate.project.assetDefinitionRefs) {
			let bytes: Uint8Array | undefined;
			try {
				bytes = await this.dependencies.resources.read(definition.resourceHash);
			} catch {
				return {
					kind: "rejected",
					reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
				};
			}
			if (signal?.aborted) return cancelled();
			if (!bytes)
				return { kind: "rejected", reasonCode: "BACKUP_RESOURCE_MISSING" };
			if (bytes.byteLength !== definition.byteLength)
				return { kind: "rejected", reasonCode: "BACKUP_CHECKSUM_MISMATCH" };
			// Domain limits were checked before I/O; each exact original key owns a snapshot.
			resources.push({
				resourceHash: definition.resourceHash,
				bytes: bytes.slice(),
			});
		}
		if (!(await this.dependencies.smoke.verify(candidate.project, resources)))
			return {
				kind: "rejected",
				reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
			};
		if (signal?.aborted) return cancelled();
		const encoded = await this.dependencies.writer.encode(
			{
				project: candidate.project,
				createdAt: candidate.revision.createdAt,
				resources,
			},
			signal,
		);
		if (signal?.aborted) return cancelled();
		return encoded.kind === "rejected"
			? encoded
			: {
					kind: "ready",
					bytes: encoded.bytes,
					mimeType: encoded.mimeType,
					filename: portableBackupFileName(candidate.project.name),
				};
	}
}

function cancelled(): Extract<
	ExportPortableBackupResult,
	{ readonly kind: "rejected" }
> {
	return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
}
