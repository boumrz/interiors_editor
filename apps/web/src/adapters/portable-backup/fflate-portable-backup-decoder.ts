import type {
	BinaryChecksumPort,
	CancellationSignalPort,
	CustomAssetResource,
	PortableBackupDecodeResult,
	PortableBackupDecoderPort,
} from "../../application/ports";
import { MAXIMUM_PPJ_A1_JSON_BYTES } from "../../domain/ppj-a1-lossless-json";
import { readPpjA1ZipCentralDirectory } from "./ppj-a1-zip-central-directory";
import type {
	PpjA1ArchiveEntry,
	PpjA1ArchiveEntryReadResult,
} from "./ppj-a1-canonical-project-member-ingress";

const BACKUP_FORMAT = "interiors-portable-backup" as const;
const CANONICAL_PROJECT_PATH = "project/project.json" as const;
const CORE_PATHS = [
	"checksums.json",
	"manifest.json",
	CANONICAL_PROJECT_PATH,
] as const;
const CUSTOM_GLB_PATH = /^custom\/([a-f0-9]{64})\.glb$/;

type ManifestEntry = {
	readonly byteLength: number;
	readonly mediaType: "application/json" | "model/gltf-binary";
	readonly path: string;
	readonly sha256: string;
};

type ResourceManifestEntry = {
	readonly path: string;
	readonly resourceHash: string;
};

type PortableManifest = {
	readonly backupFormat: typeof BACKUP_FORMAT;
	readonly backupFormatVersion: 1;
	readonly canonicalProjectPath: typeof CANONICAL_PROJECT_PATH;
	readonly complete: true;
	readonly createdAt: string;
	readonly entries: readonly ManifestEntry[];
	readonly projectSchemaId: "interiors.project/alpha-1";
	readonly projectSchemaVersion: 1;
	readonly requiredCapabilities: readonly [];
	readonly resources: readonly ResourceManifestEntry[];
	readonly sourceProjectId: string;
};

type ChecksumEntry = {
	readonly path: string;
	readonly sha256: string;
};

/**
 * Opens the current ZIP envelope only after raw names, manifest/ledger bindings
 * and every exact custom GLB digest agree. The decoder does not create a
 * Project, pin bytes or permit archive-owned buffers to escape its boundary.
 */
export class FflatePortableBackupDecoder implements PortableBackupDecoderPort {
	public constructor(private readonly checksum: BinaryChecksumPort) {}

	public async decode(
		archive: Uint8Array,
		signal?: CancellationSignalPort,
	): Promise<PortableBackupDecodeResult> {
		if (signal?.aborted) return cancelled();
		const indexed = readPpjA1ZipCentralDirectory(archive);
		if (indexed.kind === "rejected") {
			return mapPpjA1SourceFailure(indexed.reasonCode);
		}

		const entries = new Map<string, PpjA1ArchiveEntry>();
		for (const entry of indexed.entries) {
			if (signal?.aborted) return cancelled();
			const path = readAsciiPath(entry.rawName);
			if (!path || entries.has(path) || !isAllowedPath(path)) return rejected();
			entries.set(path, entry);
		}
		if (!CORE_PATHS.every((path) => entries.has(path))) return rejected();

		const manifestRead = await readEntry(entries.get("manifest.json"), signal);
		if (manifestRead.kind === "rejected") return manifestRead;
		if (isReadableFutureSchemaManifest(manifestRead.bytes)) {
			return futureSchema();
		}
		const checksumsRead = await readEntry(entries.get("checksums.json"), signal);
		if (checksumsRead.kind === "rejected") return checksumsRead;
		const manifestBytes = manifestRead.bytes;
		const checksumsBytes = checksumsRead.bytes;

		const manifest = parseManifest(manifestBytes);
		const checksumLedger = parseChecksumLedger(checksumsBytes);
		if (!manifest || !checksumLedger || !matchesEnvelope(manifest, checksumLedger, entries)) {
			return rejected();
		}
		const projectEntry = manifest.entries.find(
			(entry) => entry.path === CANONICAL_PROJECT_PATH,
		);
		const projectArchiveEntry = entries.get(CANONICAL_PROJECT_PATH);
		if (
			!projectEntry ||
			!projectArchiveEntry ||
			projectEntry.byteLength !== projectArchiveEntry.declaredByteLength
		) {
			return rejected();
		}
		if (projectEntry.byteLength > MAXIMUM_PPJ_A1_JSON_BYTES) {
			return limitExceeded();
		}
		const projectRead = await readEntry(
			projectArchiveEntry,
			signal,
			MAXIMUM_PPJ_A1_JSON_BYTES,
		);
		if (projectRead.kind === "rejected") return projectRead;
		const projectBytes = projectRead.bytes;
		if (
			projectEntry.byteLength !== projectBytes.byteLength ||
			projectSourceId(projectBytes) !== manifest.sourceProjectId
		) {
			return rejected();
		}
		if ((await this.checksum.sha256Bytes(projectBytes)) !== projectEntry.sha256) {
			return checksumMismatch();
		}
		if (signal?.aborted) return cancelled();

		const resources: CustomAssetResource[] = [];
		for (const resource of manifest.resources) {
			if (signal?.aborted) return cancelled();
			const entry = entries.get(resource.path);
			const declared = manifest.entries.find(
				(candidate) => candidate.path === resource.path,
			);
			const read = await readEntry(entry, signal);
			if (
				!entry ||
				!declared ||
				read.kind === "rejected" ||
				read.bytes.byteLength !== declared.byteLength
			) {
				if (read.kind === "rejected") return read;
				return rejected();
			}
			const bytes = read.bytes;
			if ((await this.checksum.sha256Bytes(bytes)) !== declared.sha256) {
				return checksumMismatch();
			}
			if (signal?.aborted) return cancelled();
			resources.push({ bytes, resourceHash: resource.resourceHash });
		}

		return resources.length === 0
			? { kind: "accepted", projectBytes }
			: { kind: "accepted", projectBytes, resources };
	}
}

async function readEntry(
	entry: PpjA1ArchiveEntry | undefined,
	signal: CancellationSignalPort | undefined,
	maximumByteLength?: number,
): Promise<
	| { readonly bytes: Uint8Array; readonly kind: "accepted" }
	| Extract<PortableBackupDecodeResult, { readonly kind: "rejected" }>
> {
	if (!entry) return rejected();
	if (
		maximumByteLength !== undefined &&
		entry.declaredByteLength > maximumByteLength
	) {
		return limitExceeded();
	}
	if (signal?.aborted) return cancelled();
	const abortSignal = signal as AbortSignal | undefined;
	const opened = await entry.open(abortSignal);
	if (opened.kind === "rejected") {
		return mapPpjA1SourceFailure(opened.reasonCode);
	}
	const chunks: Uint8Array[] = [];
	let length = 0;
	let readFailure: Extract<
		PortableBackupDecodeResult,
		{ readonly kind: "rejected" }
	> | undefined;
	try {
		for await (const result of opened.lease.chunks(abortSignal)) {
			if (!isChunk(result)) {
				readFailure = mapPpjA1SourceFailure(result.reasonCode);
				break;
			}
			length += result.bytes.byteLength;
			if (
				length > entry.declaredByteLength ||
				(maximumByteLength !== undefined && length > maximumByteLength)
			) {
				readFailure =
					maximumByteLength !== undefined && length > maximumByteLength
						? limitExceeded()
						: rejected();
				break;
			}
			chunks.push(result.bytes.slice());
		}
	} finally {
		const closed = await opened.lease.close(abortSignal);
		if (closed.kind === "rejected") {
			readFailure = mapPpjA1SourceFailure(closed.reasonCode);
		}
	}
	if (readFailure) return readFailure;
	if (signal?.aborted) return cancelled();
	if (length !== entry.declaredByteLength) return rejected();
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { bytes, kind: "accepted" };
}

function isChunk(
	value: PpjA1ArchiveEntryReadResult,
): value is Extract<PpjA1ArchiveEntryReadResult, { readonly kind: "chunk" }> {
	return value.kind === "chunk";
}

function parseManifest(bytes: Uint8Array): PortableManifest | undefined {
	const parsed = parseJson(bytes);
	if (
		!hasExactKeys(parsed, [
			"backupFormat",
			"backupFormatVersion",
			"canonicalProjectPath",
			"complete",
			"createdAt",
			"entries",
			"projectSchemaId",
			"projectSchemaVersion",
			"requiredCapabilities",
			"resources",
			"sourceProjectId",
		])
	) {
		return undefined;
	}
	const manifest = parsed as Record<string, unknown>;
	if (
		manifest.backupFormat !== BACKUP_FORMAT ||
		manifest.backupFormatVersion !== 1 ||
		manifest.canonicalProjectPath !== CANONICAL_PROJECT_PATH ||
		manifest.complete !== true ||
		typeof manifest.createdAt !== "string" ||
		manifest.projectSchemaId !== "interiors.project/alpha-1" ||
		manifest.projectSchemaVersion !== 1 ||
		typeof manifest.sourceProjectId !== "string" ||
		manifest.sourceProjectId.length === 0 ||
		!isEmptyArray(manifest.requiredCapabilities) ||
		!Array.isArray(manifest.entries) ||
		!Array.isArray(manifest.resources)
	) {
		return undefined;
	}
	const entries = manifest.entries.map(parseManifestEntry);
	const resources = manifest.resources.map(parseResourceManifestEntry);
	if (
		entries.some((entry) => !entry) ||
		resources.some((entry) => !entry) ||
		entries.length !== resources.length + 1 ||
		new Set(entries.map((entry) => entry?.path)).size !== entries.length ||
		new Set(resources.map((entry) => entry?.path)).size !== resources.length
	) {
		return undefined;
	}
	return {
		...(manifest as Omit<PortableManifest, "entries" | "resources">),
		entries: entries as ManifestEntry[],
		resources: resources as ResourceManifestEntry[],
	};
}

function isReadableFutureSchemaManifest(bytes: Uint8Array): boolean {
	const parsed = parseJson(bytes);
	if (
		!hasExactKeys(parsed, [
			"backupFormat",
			"backupFormatVersion",
			"canonicalProjectPath",
			"complete",
			"createdAt",
			"entries",
			"projectSchemaId",
			"projectSchemaVersion",
			"requiredCapabilities",
			"resources",
			"sourceProjectId",
		])
	) {
		return false;
	}
	const manifest = parsed as Record<string, unknown>;
	if (
		manifest.backupFormat !== BACKUP_FORMAT ||
		manifest.backupFormatVersion !== 1 ||
		manifest.canonicalProjectPath !== CANONICAL_PROJECT_PATH ||
		manifest.complete !== true ||
		typeof manifest.createdAt !== "string" ||
		typeof manifest.projectSchemaId !== "string" ||
		manifest.projectSchemaId.length === 0 ||
		typeof manifest.projectSchemaVersion !== "number" ||
		!Number.isSafeInteger(manifest.projectSchemaVersion) ||
		manifest.projectSchemaVersion <= 0 ||
		typeof manifest.sourceProjectId !== "string" ||
		manifest.sourceProjectId.length === 0 ||
		!Array.isArray(manifest.entries) ||
		!Array.isArray(manifest.resources) ||
		!Array.isArray(manifest.requiredCapabilities)
	) {
		return false;
	}
	return (
		manifest.projectSchemaId !== "interiors.project/alpha-1" ||
		manifest.projectSchemaVersion > 1
	);
}

function parseManifestEntry(value: unknown): ManifestEntry | undefined {
	if (!hasExactKeys(value, ["byteLength", "mediaType", "path", "sha256"])) {
		return undefined;
	}
	const entry = value as Record<string, unknown>;
	if (
		typeof entry.byteLength !== "number" ||
		!Number.isSafeInteger(entry.byteLength) ||
		entry.byteLength < 0 ||
		typeof entry.path !== "string" ||
		typeof entry.sha256 !== "string" ||
		entry.sha256.length === 0
	) {
		return undefined;
	}
	if (entry.path === CANONICAL_PROJECT_PATH) {
		return entry.mediaType === "application/json"
			? (entry as ManifestEntry)
			: undefined;
	}
	const resourceHash = customGlbHash(entry.path);
	return (
		resourceHash !== undefined &&
		entry.mediaType === "model/gltf-binary" &&
		entry.byteLength > 0 &&
		entry.sha256 === resourceHash
			? (entry as ManifestEntry)
			: undefined
	);
}

function parseResourceManifestEntry(
	value: unknown,
): ResourceManifestEntry | undefined {
	if (!hasExactKeys(value, ["path", "resourceHash"])) return undefined;
	const entry = value as Record<string, unknown>;
	return typeof entry.path === "string" &&
		typeof entry.resourceHash === "string" &&
		customGlbHash(entry.path) === entry.resourceHash
		? (entry as ResourceManifestEntry)
		: undefined;
}

function parseChecksumLedger(bytes: Uint8Array): readonly ChecksumEntry[] | undefined {
	const parsed = parseJson(bytes);
	if (!hasExactKeys(parsed, ["algorithm", "entries"])) return undefined;
	const ledger = parsed as Record<string, unknown>;
	if (ledger.algorithm !== "sha-256" || !Array.isArray(ledger.entries)) {
		return undefined;
	}
	const entries = ledger.entries.map((entry): ChecksumEntry | undefined => {
		if (!hasExactKeys(entry, ["path", "sha256"])) return undefined;
		return typeof entry.path === "string" && typeof entry.sha256 === "string" && entry.sha256.length > 0
			? (entry as ChecksumEntry)
			: undefined;
	});
	return entries.some((entry) => !entry) || new Set(entries.map((entry) => entry?.path)).size !== entries.length
		? undefined
		: (entries as ChecksumEntry[]);
}

function matchesEnvelope(
	manifest: PortableManifest,
	ledger: readonly ChecksumEntry[],
	indexedEntries: ReadonlyMap<string, PpjA1ArchiveEntry>,
): boolean {
	const manifestEntries = new Map(manifest.entries.map((entry) => [entry.path, entry]));
	const ledgerEntries = new Map(ledger.map((entry) => [entry.path, entry]));
	const declaredResourcePaths = new Set(manifest.resources.map((entry) => entry.path));
	const expectedPaths = new Set([...CORE_PATHS, ...declaredResourcePaths]);
	if (
		manifestEntries.size !== manifest.entries.length ||
		ledgerEntries.size !== ledger.length ||
		indexedEntries.size !== expectedPaths.size ||
		manifestEntries.size !== declaredResourcePaths.size + 1 ||
		ledgerEntries.size !== manifestEntries.size
	) {
		return false;
	}
	for (const path of expectedPaths) {
		if (!indexedEntries.has(path)) return false;
	}
	for (const entry of manifest.entries) {
		const checksum = ledgerEntries.get(entry.path);
		if (!checksum || checksum.sha256 !== entry.sha256) return false;
	}
	for (const resource of manifest.resources) {
		const entry = manifestEntries.get(resource.path);
		if (!entry || entry.sha256 !== resource.resourceHash) return false;
	}
	return manifestEntries.has(CANONICAL_PROJECT_PATH);
}

function projectSourceId(bytes: Uint8Array): string | undefined {
	const parsed = parseJson(bytes);
	return isRecord(parsed) && typeof parsed.projectId === "string"
		? parsed.projectId
		: undefined;
}

function parseJson(bytes: Uint8Array): unknown {
	try {
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} catch {
		return undefined;
	}
}

function readAsciiPath(bytes: Uint8Array): string | undefined {
	if (bytes.byteLength === 0) return undefined;
	let path = "";
	for (const byte of bytes) {
		if (byte < 0x21 || byte > 0x7e) return undefined;
		path += String.fromCharCode(byte);
	}
	return path;
}

function isAllowedPath(path: string): boolean {
	return CORE_PATHS.some((candidate) => candidate === path) || customGlbHash(path) !== undefined;
}

function customGlbHash(path: string): string | undefined {
	return CUSTOM_GLB_PATH.exec(path)?.[1];
}

function hasExactKeys(
	value: unknown,
	keys: readonly string[],
): value is Record<string, unknown> {
	if (!isRecord(value)) return false;
	const actual = Object.keys(value).sort();
	return (
		actual.length === keys.length &&
		actual.every((key, index) => key === [...keys].sort()[index])
	);
}

function isEmptyArray(value: unknown): value is readonly [] {
	return Array.isArray(value) && value.length === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejected(): Extract<
	PortableBackupDecodeResult,
	{ readonly kind: "rejected" }
> {
	return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
}

function checksumMismatch(): Extract<
	PortableBackupDecodeResult,
	{ readonly kind: "rejected" }
> {
	return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CHECKSUM_MISMATCH" };
}

function limitExceeded(): Extract<
	PortableBackupDecodeResult,
	{ readonly kind: "rejected" }
> {
	return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_LIMIT_EXCEEDED" };
}

function cancelled(): Extract<
	PortableBackupDecodeResult,
	{ readonly kind: "rejected" }
> {
	return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" };
}

function futureSchema(): Extract<
	PortableBackupDecodeResult,
	{ readonly kind: "rejected" }
> {
	return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_FUTURE_SCHEMA" };
}

export function mapPpjA1SourceFailure(
	reasonCode: import("./ppj-a1-canonical-project-member-ingress").PpjA1ArchiveSourceFailureReason,
): Extract<PortableBackupDecodeResult, { readonly kind: "rejected" }> {
	if (reasonCode === "BACKUP_CANCELLED") return cancelled();
	if (
		reasonCode === "BACKUP_COMPRESSION_RATIO" ||
		reasonCode === "BACKUP_CONTAINER_BYTES_LIMIT" ||
		reasonCode === "BACKUP_ENTRY_LIMIT" ||
		reasonCode === "BACKUP_UNPACKED_BYTES_LIMIT"
	) {
		return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_LIMIT_EXCEEDED" };
	}
	return rejected();
}
