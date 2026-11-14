import type {
	BinaryChecksumPort,
	ChecksumPort,
	CustomAssetResourceStorePort,
	DurablePublicationCandidate,
	PortableBackupEncoderPort,
	ProjectSerializerPort,
} from "./ports";
import type { PortableBackupIngressReason } from "./portable-backup-reasons";

const BACKUP_FORMAT = "interiors-portable-backup" as const;
const BACKUP_FORMAT_VERSION = 1 as const;
const CANONICAL_PROJECT_PATH = "project/project.json" as const;
const PROJECT_SCHEMA_ID = "interiors.project/alpha-1" as const;

export type ExportPortableBackupResult =
	| {
			readonly bytes: Uint8Array;
			readonly filename: string;
			readonly kind: "ready";
			readonly mimeType: "application/zip";
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE"
				| "PORTABLE_BACKUP_UNSUPPORTED"
				| PortableBackupIngressReason;
	  };

interface ExportPortableBackupDependencies {
	readonly binaryChecksum?: BinaryChecksumPort;
	readonly checksum: ChecksumPort;
	readonly encoder: PortableBackupEncoderPort;
	readonly resources?: Pick<CustomAssetResourceStorePort, "read"> & Partial<Omit<CustomAssetResourceStorePort, "read">>;
	readonly serializer: ProjectSerializerPort;
}

/**
 * Makes a complete V1 `.interiors` envelope only when every referenced custom
 * GLB is still locally present at its immutable SHA-256 address. A source with
 * a missing, corrupt or unverified resource fails closed rather than producing
 * a file that merely looks like a backup.
 */
export class ExportPortableBackupUseCase {
	public constructor(
		private readonly dependencies: ExportPortableBackupDependencies,
	) {}

	public async execute(
		candidate: DurablePublicationCandidate,
	): Promise<ExportPortableBackupResult> {
		if (
			candidate.project.schemaVersion !== 1 ||
			candidate.revision.schemaVersion !== 1
		) {
			return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" };
		}
		const resources = await this.readVerifiedResources(candidate);
		if (!resources) return resourcesUnavailable();

		const projectJson = this.dependencies.serializer.serialize(
			candidate.project,
		);
		const projectBytes = encodeUtf8(projectJson);
		const projectChecksum =
			await this.dependencies.checksum.sha256(projectJson);
		const projectEntry = {
			byteLength: projectBytes.byteLength,
			mediaType: "application/json",
			path: CANONICAL_PROJECT_PATH,
			sha256: projectChecksum,
		} as const;
		const resourceEntries = resources.map((resource) => ({
			byteLength: resource.bytes.byteLength,
			mediaType: "model/gltf-binary",
			path: customGlbPath(resource.resourceHash),
			sha256: resource.resourceHash,
		} as const));
		const manifest = JSON.stringify({
			backupFormat: BACKUP_FORMAT,
			backupFormatVersion: BACKUP_FORMAT_VERSION,
			canonicalProjectPath: CANONICAL_PROJECT_PATH,
			complete: true,
			createdAt: candidate.revision.createdAt,
			entries: [projectEntry, ...resourceEntries],
			projectSchemaId: PROJECT_SCHEMA_ID,
			projectSchemaVersion: candidate.project.schemaVersion,
			requiredCapabilities: [],
			resources: resources.map((resource) => ({
				path: customGlbPath(resource.resourceHash),
				resourceHash: resource.resourceHash,
			})),
			sourceProjectId: candidate.project.projectId,
		});
		const checksums = JSON.stringify({
			algorithm: "sha-256",
			entries: [
				{ path: CANONICAL_PROJECT_PATH, sha256: projectChecksum },
				...resources.map((resource) => ({
					path: customGlbPath(resource.resourceHash),
					sha256: resource.resourceHash,
				})),
			],
		});
		const archiveEntries: Record<string, Uint8Array> = {
			"checksums.json": encodeUtf8(checksums),
			"manifest.json": encodeUtf8(manifest),
			[CANONICAL_PROJECT_PATH]: projectBytes,
		};
		for (const resource of resources) {
			archiveEntries[customGlbPath(resource.resourceHash)] = resource.bytes;
		}
		return {
			bytes: this.dependencies.encoder.encode(archiveEntries),
			filename: portableBackupFileName(candidate.project.name),
			kind: "ready",
			mimeType: "application/zip",
		};
	}

	private async readVerifiedResources(
		candidate: DurablePublicationCandidate,
	): Promise<readonly { readonly bytes: Uint8Array; readonly resourceHash: string }[] | undefined> {
		if (candidate.project.assetDefinitionRefs.length === 0) return [];
		const store = this.dependencies.resources;
		const checksum = this.dependencies.binaryChecksum;
		if (!store || !checksum) return undefined;
		const resources: { readonly bytes: Uint8Array; readonly resourceHash: string }[] = [];
		const seenHashes = new Set<string>();
		for (const definition of [...candidate.project.assetDefinitionRefs].sort((left, right) =>
			left.resourceHash.localeCompare(right.resourceHash),
		)) {
			if (
				seenHashes.has(definition.resourceHash) ||
				!isCustomGlbDefinitionPortable(definition.resourceHash, definition.byteLength)
			) {
				return undefined;
			}
			seenHashes.add(definition.resourceHash);
			try {
				const bytes = await store.read(definition.resourceHash);
				if (
					!bytes ||
					bytes.byteLength !== definition.byteLength ||
					(await checksum.sha256Bytes(bytes)) !== definition.resourceHash
				) {
					return undefined;
				}
				resources.push({ bytes: bytes.slice(), resourceHash: definition.resourceHash });
			} catch {
				return undefined;
			}
		}
		return resources;
	}
}

function customGlbPath(resourceHash: string): string {
	return `custom/${resourceHash}.glb`;
}

function isCustomGlbDefinitionPortable(
	resourceHash: string,
	byteLength: number,
): boolean {
	return (
		/^[a-f0-9]{64}$/.test(resourceHash) &&
		Number.isSafeInteger(byteLength) &&
		byteLength > 0
	);
}

function resourcesUnavailable(): Extract<
	ExportPortableBackupResult,
	{ readonly kind: "rejected" }
> {
	return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE" };
}

function encodeUtf8(value: string): Uint8Array {
	const bytes: number[] = [];
	for (const character of value) {
		const current = character.codePointAt(0);
		if (current === undefined) continue;
		// A lone surrogate is not Unicode scalar data; match TextEncoder by
		// serializing it as the replacement character rather than emitting an
		// invalid UTF-8 sequence.
		const codePoint = current >= 0xd800 && current <= 0xdfff ? 0xfffd : current;
		if (codePoint <= 0x7f) {
			bytes.push(codePoint);
		} else if (codePoint <= 0x7ff) {
			bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
		} else if (codePoint <= 0xffff) {
			bytes.push(
				0xe0 | (codePoint >> 12),
				0x80 | ((codePoint >> 6) & 0x3f),
				0x80 | (codePoint & 0x3f),
			);
		} else {
			bytes.push(
				0xf0 | (codePoint >> 18),
				0x80 | ((codePoint >> 12) & 0x3f),
				0x80 | ((codePoint >> 6) & 0x3f),
				0x80 | (codePoint & 0x3f),
			);
		}
	}
	return Uint8Array.from(bytes);
}

function downloadStem(name: string): string {
	const stem = name
		.trim()
		.replace(/[\\/:*?"<>|]+/g, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return stem.length > 0 ? stem.slice(0, 80) : "project";
}

export function portableBackupFileName(name: string): string {
	return `${downloadStem(name)}.interiors`;
}
