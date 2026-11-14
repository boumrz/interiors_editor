import { alphaBackupFeasibilityLimits } from "../../application/backup-feasibility-policy";
import {
	browserBackupUtf8ByteLength,
	sameBrowserBackupValue,
} from "../../application/browser-backup-representability";
import { canonicalProjectSerializer } from "../../application/create-project";
import type {
	ChecksumPort,
	ProjectStorageNamespace,
	PublicationCandidate,
	UnverifiedProjectSource,
} from "../../application/ports";
import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import { isStructurallyValidProjectV1 } from "../../domain/project-json-transfer";
import { encodeRuntimeV1Project } from "../portable-backup/runtime-v1-wire";

export interface BrowserReadonlyProjectSnapshot {
	readonly storageNamespace: ProjectStorageNamespace;
	readonly projectId: string;
	readonly pointer: unknown;
	readonly revision: unknown;
	readonly creation?: unknown;
}
export interface BrowserReadonlyResourceDescriptor {
	readonly resourceHash: string;
	readonly byteLength: number;
}
export interface VerifiedBrowserReadonlySnapshot {
	readonly candidate: PublicationCandidate;
	readonly resourceManifest: readonly BrowserReadonlyResourceDescriptor[];
}
const scope = "browser-registered-v1";
const prefix = (kind: "attempt" | "lease") => `${scope}:${kind}:`;

/** Exact native row ownership only. This independently available source is never called healthy JSON. */
export function readUnverifiedBrowserSnapshot(
	input: BrowserReadonlyProjectSnapshot,
	expectedRevisionId: string,
): UnverifiedProjectSource | undefined {
	const { pointer, revision, projectId, storageNamespace } = input;
	if (
		storageNamespace !== "legacy" &&
		storageNamespace !== "browser-registered"
	)
		return undefined;
	if (
		!record(pointer) ||
		pointer.projectId !== projectId ||
		pointer.currentRevisionId !== expectedRevisionId ||
		typeof expectedRevisionId !== "string"
	)
		return undefined;
	if (
		!record(revision) ||
		revision.revisionId !== expectedRevisionId ||
		!record(revision.candidate)
	)
		return undefined;
	if (
		storageNamespace === "browser-registered" &&
		(pointer.scope !== scope ||
			revision.scope !== scope ||
			revision.projectId !== projectId)
	)
		return undefined;
	const { project, revision: source } = revision.candidate;
	if (
		!record(project) ||
		project.projectId !== projectId ||
		!record(source) ||
		source.projectId !== projectId ||
		source.revisionId !== expectedRevisionId ||
		typeof source.serializedProject !== "string"
	)
		return undefined;
	return {
		kind: "unverified-source",
		projectId,
		revisionId: expectedRevisionId,
		serializedProject: source.serializedProject,
	};
}

/** Bounded checks over owned readonly native rows. No serializer output is parsed back into the Project. */
export async function verifyBrowserReadonlySnapshot(
	input: BrowserReadonlyProjectSnapshot,
	checksum: ChecksumPort,
): Promise<VerifiedBrowserReadonlySnapshot | undefined> {
	try {
		const { pointer, revision, storageNamespace, projectId } = input;
		if (
			!record(pointer) ||
			!record(revision) ||
			!candidateV1(revision.candidate)
		)
			return undefined;
		const candidate = revision.candidate;
		if (
			!readUnverifiedBrowserSnapshot(input, candidate.revision.revisionId) ||
			pointer.name !== candidate.project.name
		)
			return undefined;
		if (storageNamespace === "legacy") {
			if (
				!keys(pointer, ["projectId", "name", "currentRevisionId"]) ||
				!keys(revision, ["revisionId", "candidate"])
			)
				return undefined;
		} else if (storageNamespace === "browser-registered") {
			if (
				!keys(pointer, ["scope", "projectId", "name", "currentRevisionId"]) ||
				!keys(revision, [
					"scope",
					"projectId",
					"revisionId",
					"candidate",
					"creationAttemptId",
					"resourceManifest",
				])
			)
				return undefined;
		} else return undefined;
		if (
			candidate.project.projectId !== projectId ||
			candidate.revision.serializedProject.length >
				alphaBackupFeasibilityLimits.maxProjectBytes ||
			browserBackupUtf8ByteLength(candidate.revision.serializedProject) >
				alphaBackupFeasibilityLimits.maxProjectBytes ||
			encodeRuntimeV1Project(candidate.project).kind !== "encoded" ||
			validateRuntimeV1Project(candidate.project).kind !== "accepted"
		)
			return undefined;
		const resourceManifest = references(candidate);
		if (
			storageNamespace === "browser-registered" &&
			!creationMatches(input, candidate, resourceManifest)
		)
			return undefined;
		if (
			canonicalProjectSerializer.serialize(candidate.project) !==
				candidate.revision.serializedProject ||
			(await checksum.sha256(candidate.revision.serializedProject)) !==
				candidate.revision.checksum
		)
			return undefined;
		return { candidate, resourceManifest };
	} catch {
		return undefined;
	}
}

/** Metadata only; the caller separately owns and verifies bytes at this exact raw key. */
export function readBrowserReadonlyResource(
	namespace: ProjectStorageNamespace,
	expected: BrowserReadonlyResourceDescriptor,
	value: unknown,
): Blob | ArrayBuffer | undefined {
	if (
		!record(value) ||
		!hash(expected.resourceHash) ||
		!Number.isSafeInteger(expected.byteLength) ||
		expected.byteLength <= 0 ||
		expected.byteLength >
			alphaBackupFeasibilityLimits.maxResourceBytesPerEntry ||
		value.resourceHash !== expected.resourceHash
	)
		return undefined;
	if (namespace === "legacy") {
		const known = Object.keys(value).every(
			(key) =>
				key === "resourceHash" ||
				key === "bytes" ||
				key === "pinStagingLeaseId",
		);
		return known &&
			value.pinStagingLeaseId === undefined &&
			value.bytes instanceof ArrayBuffer &&
			value.bytes.byteLength === expected.byteLength
			? value.bytes
			: undefined;
	}
	if (
		namespace !== "browser-registered" ||
		!keys(value, [
			"scope",
			"resourceHash",
			"byteLength",
			"blob",
			"version",
			"creationLeaseId",
			"roots",
			"durable",
		]) ||
		value.scope !== scope ||
		value.byteLength !== expected.byteLength ||
		!(value.blob instanceof Blob) ||
		value.blob.size !== expected.byteLength ||
		typeof value.version !== "string" ||
		!value.version.startsWith(prefix("lease")) ||
		typeof value.creationLeaseId !== "string" ||
		!value.creationLeaseId.startsWith(prefix("lease")) ||
		!denseArray(value.roots) ||
		!value.roots.every(
			(root) => typeof root === "string" && root.startsWith(prefix("lease")),
		) ||
		new Set(value.roots).size !== value.roots.length ||
		typeof value.durable !== "boolean" ||
		(!value.durable && value.roots.length === 0)
	)
		return undefined;
	return value.blob;
}
function creationMatches(
	input: BrowserReadonlyProjectSnapshot,
	candidate: PublicationCandidate,
	manifest: readonly BrowserReadonlyResourceDescriptor[],
): boolean {
	const { revision, creation } = input;
	if (
		!record(revision) ||
		typeof revision.creationAttemptId !== "string" ||
		!record(creation)
	)
		return false;
	const required = [
		"protocolVersion",
		"scope",
		"projectId",
		"attemptId",
		"ownerId",
		"fencingToken",
		"expectedBaseRevisionId",
		"revisionId",
		"checksum",
		"serializedProject",
		"resourceManifest",
		"intent",
		"state",
		"receipt",
	];
	const allowed = new Set([...required, "leaseId"]);
	if (
		!required.every((key) => Object.hasOwn(creation, key)) ||
		!Object.keys(creation).every((key) => allowed.has(key)) ||
		creation.protocolVersion !== 1 ||
		creation.scope !== scope ||
		creation.projectId !== input.projectId ||
		typeof creation.attemptId !== "string" ||
		!creation.attemptId.startsWith(prefix("attempt")) ||
		creation.attemptId !== revision.creationAttemptId ||
		typeof creation.ownerId !== "string" ||
		!Number.isSafeInteger(creation.fencingToken) ||
		typeof creation.fencingToken !== "number" ||
		creation.fencingToken <= 0 ||
		!(
			creation.expectedBaseRevisionId === null ||
			typeof creation.expectedBaseRevisionId === "string"
		) ||
		creation.revisionId !== candidate.revision.revisionId ||
		creation.checksum !== candidate.revision.checksum ||
		creation.serializedProject !== candidate.revision.serializedProject ||
		creation.intent !== "mutation" ||
		creation.state !== "published" ||
		(Object.hasOwn(creation, "leaseId") &&
			(typeof creation.leaseId !== "string" ||
				!creation.leaseId.startsWith(prefix("lease"))))
	)
		return false;
	return (
		exactManifest(revision.resourceManifest, manifest) &&
		exactManifest(creation.resourceManifest, manifest) &&
		sameBrowserBackupValue(creation.receipt, {
			revisionId: creation.revisionId,
			checksum: creation.checksum,
			resourceManifest: manifest,
		})
	);
}
function exactManifest(
	value: unknown,
	expected: readonly BrowserReadonlyResourceDescriptor[],
): boolean {
	return (
		denseArray(value) &&
		value.length === expected.length &&
		sameBrowserBackupValue(value, expected)
	);
}
function denseArray(value: unknown): value is readonly unknown[] {
	if (!Array.isArray(value)) return false;
	const names = Object.keys(value);
	return (
		names.length === value.length &&
		names.every((name, index) => name === String(index))
	);
}
function references(
	candidate: PublicationCandidate,
): readonly BrowserReadonlyResourceDescriptor[] {
	const result = new Map<string, number>();
	let total = 0;
	for (const ref of candidate.project.assetDefinitionRefs) {
		if (
			!hash(ref.resourceHash) ||
			!Number.isSafeInteger(ref.byteLength) ||
			ref.byteLength <= 0 ||
			ref.byteLength > alphaBackupFeasibilityLimits.maxResourceBytesPerEntry ||
			(result.has(ref.resourceHash) &&
				result.get(ref.resourceHash) !== ref.byteLength)
		)
			throw new Error("Invalid readonly resource address");
		if (!result.has(ref.resourceHash)) {
			if (
				ref.byteLength >
					alphaBackupFeasibilityLimits.maxResourceBytes - total ||
				result.size >= alphaBackupFeasibilityLimits.maxResourceEntries
			)
				throw new Error("Readonly resource envelope is too large");
			total += ref.byteLength;
			result.set(ref.resourceHash, ref.byteLength);
		}
	}
	return [...result]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([resourceHash, byteLength]) => ({ resourceHash, byteLength }));
}
function keys(
	value: Record<string, unknown>,
	expected: readonly string[],
): boolean {
	const actual = Object.keys(value);
	return (
		actual.length === expected.length &&
		expected.every((key) => Object.hasOwn(value, key))
	);
}
function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hash(value: unknown): value is string {
	return typeof value === "string" && /^[A-Fa-f0-9]{64}$/.test(value);
}
function candidateV1(value: unknown): value is PublicationCandidate {
	return (
		record(value) &&
		isStructurallyValidProjectV1(value.project) &&
		record(value.revision) &&
		value.revision.schemaVersion === 1 &&
		typeof value.revision.projectId === "string" &&
		typeof value.revision.revisionId === "string" &&
		value.revision.revisionId.length > 0 &&
		typeof value.revision.createdAt === "string" &&
		typeof value.revision.serializedProject === "string" &&
		typeof value.revision.checksum === "string"
	);
}
