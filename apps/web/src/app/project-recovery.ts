import { alphaBackupFeasibilityLimits } from "../application/backup-feasibility-policy";
import type {
	BinaryChecksumPort,
	CancellationSignalPort,
	CustomAssetResource,
	CustomAssetResourceStorePort,
	DurablePublicationCandidate,
	PublicationCandidate,
} from "../application/ports";
import { serializeProjectCanonically } from "../domain/canonical-serialization";
import { parsePpjA1JsonBytes } from "../domain/ppj-a1-lossless-json";
import type { Project } from "../domain/project";
import { isStructurallyValidProjectV1 } from "../domain/project-json-transfer";
import {
	isSha256ResourceHash,
	sameSha256ResourceHashBits,
} from "../domain/resource-hash";

export type ExportRecoveryDraftResult =
	| {
			readonly kind: "ready";
			readonly bytes: Uint8Array;
			readonly filename: string;
			readonly mimeType: "application/json";
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "RECOVERY_DRAFT_LIMIT_EXCEEDED"
				| "RECOVERY_DRAFT_UNSUPPORTED";
	  };

export type DecodeRecoveryDraftResult =
	| { readonly kind: "cancelled" }
	| {
			readonly kind: "accepted";
			readonly candidate: PublicationCandidate;
			readonly resources: readonly CustomAssetResource[];
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "RECOVERY_DRAFT_INVALID"
				| "RECOVERY_DRAFT_INCOMPLETE"
				| "RECOVERY_DRAFT_LIMIT_EXCEEDED";
	  };

/** Recovery files restore only through an explicit, separately verified new-Project import. */
export async function decodeRecoveryDraft(
	bytes: Uint8Array,
	checksum: BinaryChecksumPort,
	signal?: CancellationSignalPort,
): Promise<DecodeRecoveryDraftResult> {
	if (signal?.aborted) return { kind: "cancelled" };
	if (
		bytes.byteLength > alphaBackupFeasibilityLimits.maxUnpackedBytes ||
		!withinRecoveryJsonBudget(bytes)
	)
		return limitExceeded();
	try {
		const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		const data: unknown = JSON.parse(raw);
		// The writer's compact JSON is the recovery grammar: this also rejects
		// duplicate member names and alternate lexemes without a second parser.
		if (
			raw !== JSON.stringify(data) ||
			!keys(data, [
				"format",
				"formatVersion",
				"durability",
				"completeResources",
				"candidate",
				"resources",
				"missingResourceHashes",
			]) ||
			data.format !== "interiors-recovery-draft" ||
			data.formatVersion !== 1 ||
			data.durability !== "unpublished" ||
			!Array.isArray(data.resources) ||
			!Array.isArray(data.missingResourceHashes)
		)
			return invalidDraft();
		if (
			data.completeResources !== true ||
			data.missingResourceHashes.length !== 0
		)
			return { kind: "rejected", reasonCode: "RECOVERY_DRAFT_INCOMPLETE" };
		if (
			!keys(data.candidate, ["project", "revision"]) ||
			!isStructurallyValidProjectV1(data.candidate.project) ||
			!keys(data.candidate.revision, [
				"checksum",
				"createdAt",
				"projectId",
				"revisionId",
				"schemaVersion",
				"serializedProject",
			])
		)
			return invalidDraft();
		const project = data.candidate.project;
		const revision = data.candidate.revision;
		if (
			revision.schemaVersion !== 1 ||
			revision.projectId !== project.projectId ||
			revision.createdAt !== project.updatedAt ||
			typeof revision.revisionId !== "string" ||
			revision.revisionId.length === 0 ||
			typeof revision.checksum !== "string" ||
			revision.checksum.length === 0 ||
			typeof revision.serializedProject !== "string" ||
			revision.serializedProject.length >
				alphaBackupFeasibilityLimits.maxProjectBytes
		)
			return invalidDraft();
		const projectBytes = new TextEncoder().encode(revision.serializedProject);
		if (
			projectBytes.byteLength > alphaBackupFeasibilityLimits.maxProjectBytes ||
			parsePpjA1JsonBytes(projectBytes).kind !== "accepted" ||
			revision.serializedProject !== serializeProjectCanonically(project) ||
			(await checksum.sha256Bytes(projectBytes)) !== revision.checksum
		)
			return invalidDraft();
		const definitions = new Map(
			project.assetDefinitionRefs.map((definition) => [
				definition.resourceHash,
				definition,
			]),
		);
		if (signal?.aborted) return { kind: "cancelled" };
		if (
			definitions.size > alphaBackupFeasibilityLimits.maxResourceEntries ||
			data.resources.length !== definitions.size ||
			[...definitions.values()].reduce(
				(total, definition) => total + definition.byteLength,
				0,
			) > alphaBackupFeasibilityLimits.maxResourceBytes
		)
			return invalidDraft();
		const resources: CustomAssetResource[] = [];
		const seen = new Set<string>();
		for (const entry of data.resources) {
			if (signal?.aborted) return { kind: "cancelled" };
			if (
				!keys(entry, ["resourceHash", "encoding", "bytes"]) ||
				typeof entry.resourceHash !== "string" ||
				!isSha256ResourceHash(entry.resourceHash) ||
				typeof entry.bytes !== "string" ||
				entry.encoding !== "base64" ||
				seen.has(entry.resourceHash)
			)
				return invalidDraft();
			const definition = definitions.get(entry.resourceHash);
			if (
				!definition ||
				definition.byteLength >
					alphaBackupFeasibilityLimits.maxResourceBytesPerEntry ||
				entry.bytes.length !== Math.ceil(definition.byteLength / 3) * 4 ||
				!/^[A-Za-z0-9+/]*={0,2}$/.test(entry.bytes)
			)
				return invalidDraft();
			const decoded = atob(entry.bytes);
			const resourceBytes = Uint8Array.from(decoded, (character) =>
				character.charCodeAt(0),
			);
			if (
				resourceBytes.byteLength !== definition.byteLength ||
				!sameSha256ResourceHashBits(
					entry.resourceHash,
					await checksum.sha256Bytes(resourceBytes),
				)
			)
				return invalidDraft();
			seen.add(entry.resourceHash);
			resources.push({
				resourceHash: entry.resourceHash,
				bytes: resourceBytes,
			});
		}
		if (signal?.aborted) return { kind: "cancelled" };
		return {
			kind: "accepted",
			candidate: {
				project,
				revision: {
					checksum: revision.checksum,
					createdAt: project.updatedAt,
					projectId: project.projectId,
					revisionId: revision.revisionId,
					schemaVersion: 1,
					serializedProject: revision.serializedProject,
				},
			},
			resources,
		};
	} catch {
		return invalidDraft();
	}
}

function keys(
	value: unknown,
	expected: readonly string[],
): value is Record<string, unknown> {
	return (
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		Object.keys(value).length === expected.length &&
		expected.every((key) => Object.hasOwn(value, key))
	);
}

function invalidDraft(): DecodeRecoveryDraftResult {
	return { kind: "rejected", reasonCode: "RECOVERY_DRAFT_INVALID" };
}

/** An unpublished source copy, deliberately distinct from a complete .interiors backup. */
export async function exportRecoveryDraft(
	source: DurablePublicationCandidate,
	resources?: Pick<CustomAssetResourceStorePort, "read">,
	checksum?: BinaryChecksumPort,
): Promise<ExportRecoveryDraftResult> {
	if (source.project.schemaVersion !== 1 || source.revision.schemaVersion !== 1)
		return { kind: "rejected", reasonCode: "RECOVERY_DRAFT_UNSUPPORTED" };
	const serializedCandidate = JSON.stringify(source);
	const encoder = new TextEncoder();
	if (
		serializedCandidate.length >
			alphaBackupFeasibilityLimits.maxProjectBytes * 2 ||
		encoder.encode(serializedCandidate).byteLength >
			alphaBackupFeasibilityLimits.maxProjectBytes * 2
	)
		return limitExceeded();
	// Capture the exact source before any asynchronous resource reads.
	const candidate: DurablePublicationCandidate =
		JSON.parse(serializedCandidate);
	const definitions = new Map<string, number>();
	let resourceBytes = 0;
	for (const definition of candidate.project.assetDefinitionRefs) {
		const knownLength = definitions.get(definition.resourceHash);
		if (
			!isSha256ResourceHash(definition.resourceHash) ||
			!Number.isSafeInteger(definition.byteLength) ||
			definition.byteLength <= 0 ||
			definition.byteLength >
				alphaBackupFeasibilityLimits.maxResourceBytesPerEntry ||
			(knownLength !== undefined && knownLength !== definition.byteLength)
		)
			return limitExceeded();
		if (knownLength === undefined) resourceBytes += definition.byteLength;
		definitions.set(definition.resourceHash, definition.byteLength);
	}
	if (
		definitions.size > alphaBackupFeasibilityLimits.maxResourceEntries ||
		resourceBytes > alphaBackupFeasibilityLimits.maxResourceBytes
	)
		return limitExceeded();
	const embedded: {
		resourceHash: string;
		encoding: "base64";
		bytes: string;
	}[] = [];
	const missingResourceHashes: string[] = [];
	for (const [resourceHash, byteLength] of definitions) {
		try {
			const stored =
				resources && checksum ? await resources.read(resourceHash) : undefined;
			const bytes = stored?.slice();
			if (
				!bytes ||
				bytes.byteLength !== byteLength ||
				!checksum ||
				!sameSha256ResourceHashBits(
					resourceHash,
					await checksum.sha256Bytes(bytes),
				)
			) {
				missingResourceHashes.push(resourceHash);
				continue;
			}
			const chunks: string[] = [];
			// A multiple of three keeps independently encoded chunks padding-free.
			for (let offset = 0; offset < bytes.byteLength; offset += 12_288)
				chunks.push(
					btoa(String.fromCharCode(...bytes.subarray(offset, offset + 12_288))),
				);
			embedded.push({
				resourceHash,
				encoding: "base64",
				bytes: chunks.join(""),
			});
		} catch {
			missingResourceHashes.push(resourceHash);
		}
	}
	const bytes = encoder.encode(
		JSON.stringify({
			format: "interiors-recovery-draft",
			formatVersion: 1,
			durability: "unpublished",
			completeResources: missingResourceHashes.length === 0,
			candidate,
			resources: embedded,
			missingResourceHashes,
		}),
	);
	if (bytes.byteLength > alphaBackupFeasibilityLimits.maxUnpackedBytes)
		return limitExceeded();
	const stem =
		candidate.project.name
			.trim()
			.replace(/[\\/:*?"<>|]+/g, "-")
			.replace(/\s+/g, "-")
			.slice(0, 80) || "project";
	return {
		bytes,
		filename: `${stem}.interiors-recovery.json`,
		kind: "ready",
		mimeType: "application/json",
	};
}

/** A disposable view of verified geometry; missing models never become substitute durable assets. */
export function recoveryReadOnlyProjection(
	project: Project,
	unresolvedHashes: readonly string[],
): Project {
	const copy: Project = JSON.parse(JSON.stringify(project));
	const unresolved = new Set(unresolvedHashes);
	const excluded = new Set(
		copy.assetDefinitionRefs
			.filter((definition) => unresolved.has(definition.resourceHash))
			.map((definition) => definition.assetDefinitionId),
	);
	const projection: Project = {
		...copy,
		assetDefinitionRefs: copy.assetDefinitionRefs.filter(
			(definition) => !excluded.has(definition.assetDefinitionId),
		),
		assetInstances: copy.assetInstances.filter(
			(instance) =>
				instance.assetDefinitionId === undefined ||
				!excluded.has(instance.assetDefinitionId),
		),
	};
	freeze(projection);
	return projection;
}

function freeze(value: unknown): void {
	if (value !== null && typeof value === "object") {
		for (const child of Object.values(value)) freeze(child);
		Object.freeze(value);
	}
}

function limitExceeded(): {
	readonly kind: "rejected";
	readonly reasonCode: "RECOVERY_DRAFT_LIMIT_EXCEEDED";
} {
	return { kind: "rejected", reasonCode: "RECOVERY_DRAFT_LIMIT_EXCEEDED" };
}

/** Bound structure before parsing; legitimate model strings have a separate byte budget. */
function withinRecoveryJsonBudget(bytes: Uint8Array): boolean {
	let quoted = false;
	let escaped = false;
	let depth = 0;
	let tokens = 0;
	let literalLength = 0;
	let stringLength = 0;
	const maximumStringBytes =
		Math.ceil(alphaBackupFeasibilityLimits.maxResourceBytesPerEntry / 3) * 4;
	for (const byte of bytes) {
		if (quoted) {
			if (!escaped && byte === 0x22) {
				quoted = false;
				continue;
			}
			stringLength++;
			if (stringLength > maximumStringBytes) return false;
			if (escaped) escaped = false;
			else if (byte === 0x5c) escaped = true;
			continue;
		}
		if (byte === 0x22) {
			quoted = true;
			stringLength = 0;
			literalLength = 0;
		} else if (byte === 0x7b || byte === 0x5b) {
			depth++;
			tokens++;
			literalLength = 0;
		} else if (byte === 0x7d || byte === 0x5d) {
			depth--;
			tokens++;
			literalLength = 0;
		} else if (byte === 0x2c || byte === 0x3a) {
			tokens++;
			literalLength = 0;
		} else if (byte > 0x20) literalLength++;
		else literalLength = 0;
		if (depth > 64 || tokens > 250_000 || literalLength > 64) return false;
	}
	return true;
}
