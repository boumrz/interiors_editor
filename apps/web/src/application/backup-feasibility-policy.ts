import { parsePpjA1JsonBytes } from "../domain/ppj-a1-lossless-json";
import {
	isSha256ResourceHash,
	sameSha256ResourceHashBits,
} from "../domain/resource-hash";
import type {
	BinaryChecksumPort,
	CustomAssetResourceStorePort,
	DurablePublicationCandidate,
} from "./ports";

/**
 * The current Project Limits Policy deliberately leaves headroom below the
 * Portable Backup import envelope. A candidate accepted here can therefore be
 * exported offline without relying on compression or a remote catalogue.
 */
export const alphaBackupFeasibilityLimits = {
	maxContainerBytes: 190 * 1024 * 1024,
	maxProjectBytes: 10 * 1024 * 1024,
	maxResourceBytes: 180 * 1024 * 1024,
	maxResourceBytesPerEntry: 50 * 1024 * 1024,
	maxResourceEntries: 900,
	maxUnpackedBytes: 280 * 1024 * 1024,
} as const;

export type BackupFeasibilityDecision =
	| { readonly kind: "accepted" }
	| {
			readonly kind: "rejected";
			readonly reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED";
	  };

export interface BackupFeasibilityResourcePorts {
	readonly binaryChecksum: BinaryChecksumPort;
	readonly resources: Pick<CustomAssetResourceStorePort, "read">;
}

export interface BackupFeasibilityPolicyPort {
	assess(
		candidate: DurablePublicationCandidate,
		resourcePorts?: BackupFeasibilityResourcePorts,
	): Promise<BackupFeasibilityDecision>;
}

const manifestMetadataUpperBoundPerEntryBytes = 1024;
const fixedManifestMetadataUpperBoundBytes = 2 * 1024;

/**
 * Runs the non-I/O part of BackupFeasibilityPolicy before a candidate can move
 * a durable pointer. Exact-resource pin verification stays with its owning
 * placement/import boundary; this policy proves the complete envelope can fit.
 */
export async function assessBackupFeasibility(
	candidate: DurablePublicationCandidate,
	resourcePorts?: BackupFeasibilityResourcePorts,
): Promise<BackupFeasibilityDecision> {
	const projectBytes = encodeUtf8(candidate.revision.serializedProject);
	if (
		projectBytes.byteLength > alphaBackupFeasibilityLimits.maxProjectBytes ||
		parsePpjA1JsonBytes(projectBytes).kind !== "accepted"
	) {
		return rejected();
	}
	return assessEnvelope(
		candidate,
		projectBytes.byteLength,
		resourcePorts,
		fixedManifestMetadataUpperBoundBytes +
			manifestMetadataUpperBoundPerEntryBytes,
	);
}

/** Common envelope/resource bounds after the trusted registered member codec. */
export async function assessBackupEnvelopeFeasibility(
	candidate: DurablePublicationCandidate,
	projectByteLength: number,
	resourcePorts?: BackupFeasibilityResourcePorts,
): Promise<BackupFeasibilityDecision> {
	return assessEnvelope(candidate, projectByteLength, resourcePorts, 4096);
}

async function assessEnvelope(
	candidate: DurablePublicationCandidate,
	projectByteLength: number,
	resourcePorts: BackupFeasibilityResourcePorts | undefined,
	fixedMetadataBytes: number,
): Promise<BackupFeasibilityDecision> {
	if (
		!Number.isSafeInteger(projectByteLength) ||
		projectByteLength < 0 ||
		projectByteLength > alphaBackupFeasibilityLimits.maxProjectBytes
	)
		return rejected();

	const resources = new Map<string, number>();
	for (const definition of candidate.project.assetDefinitionRefs) {
		if (
			!Number.isSafeInteger(definition.byteLength) ||
			definition.byteLength <= 0 ||
			definition.byteLength >
				alphaBackupFeasibilityLimits.maxResourceBytesPerEntry
		) {
			return rejected();
		}
		const knownLength = resources.get(definition.resourceHash);
		if (knownLength !== undefined && knownLength !== definition.byteLength) {
			return rejected();
		}
		resources.set(definition.resourceHash, definition.byteLength);
	}

	const resourceBytes = [...resources.values()].reduce(
		(total, bytes) => total + bytes,
		0,
	);
	if (
		resources.size > alphaBackupFeasibilityLimits.maxResourceEntries ||
		resourceBytes > alphaBackupFeasibilityLimits.maxResourceBytes
	) {
		return rejected();
	}
	if (
		resourcePorts &&
		!(await hasExactPinnedResources(resources, resourcePorts))
	) {
		return rejected();
	}

	const metadataBytes =
		fixedMetadataBytes +
		manifestMetadataUpperBoundPerEntryBytes * resources.size;
	const unpackedBytes = projectByteLength + resourceBytes + metadataBytes;
	return unpackedBytes > alphaBackupFeasibilityLimits.maxUnpackedBytes ||
		unpackedBytes > alphaBackupFeasibilityLimits.maxContainerBytes
		? rejected()
		: { kind: "accepted" };
}

async function hasExactPinnedResources(
	resources: ReadonlyMap<string, number>,
	ports: BackupFeasibilityResourcePorts,
): Promise<boolean> {
	try {
		const remaining = new Map<string, number>();
		for (const resourceHash of resources.keys()) {
			if (!isSha256ResourceHash(resourceHash)) return false;
			const digest = resourceHash.toLowerCase();
			remaining.set(digest, (remaining.get(digest) ?? 0) + 1);
		}
		const aliasBytes = new Map<string, Uint8Array>();
		for (const [resourceHash, expectedByteLength] of resources) {
			const source = await ports.resources.read(resourceHash);
			if (!source || source.byteLength !== expectedByteLength) return false;
			const bytes = source.slice();
			if (
				!sameSha256ResourceHashBits(
					resourceHash,
					await ports.binaryChecksum.sha256Bytes(bytes),
				)
			) {
				return false;
			}
			const digest = resourceHash.toLowerCase();
			const previous = aliasBytes.get(digest);
			if (
				previous &&
				(previous.byteLength !== bytes.byteLength ||
					!previous.every((value, index) => value === bytes[index]))
			)
				return false;
			const rest = (remaining.get(digest) ?? 1) - 1;
			remaining.set(digest, rest);
			if (rest === 0) aliasBytes.delete(digest);
			else if (!previous) aliasBytes.set(digest, bytes);
		}
		return true;
	} catch {
		return false;
	}
}

function rejected(): BackupFeasibilityDecision {
	return { kind: "rejected", reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED" };
}

function encodeUtf8(value: string): Uint8Array {
	const bytes: number[] = [];
	for (const character of value) {
		const current = character.codePointAt(0);
		if (current === undefined) continue;
		if (current >= 0xd800 && current <= 0xdfff) return new Uint8Array();
		if (current <= 0x7f) {
			bytes.push(current);
		} else if (current <= 0x7ff) {
			bytes.push(0xc0 | (current >> 6), 0x80 | (current & 0x3f));
		} else if (current <= 0xffff) {
			bytes.push(
				0xe0 | (current >> 12),
				0x80 | ((current >> 6) & 0x3f),
				0x80 | (current & 0x3f),
			);
		} else {
			bytes.push(
				0xf0 | (current >> 18),
				0x80 | ((current >> 12) & 0x3f),
				0x80 | ((current >> 6) & 0x3f),
				0x80 | (current & 0x3f),
			);
		}
	}
	return Uint8Array.from(bytes);
}
