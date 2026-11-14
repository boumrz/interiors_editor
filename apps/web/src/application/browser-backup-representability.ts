import { copyProject } from "../domain/copy-project";
import type { Project } from "../domain/project";
import { isStructurallyValidProjectV1 } from "../domain/project-json-transfer";
import {
	calculatePpjA1AstMetadataBytes,
	MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS,
	MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS_PER_ARRAY,
	MAXIMUM_PPJ_A1_AST_CONTAINER_DEPTH,
	MAXIMUM_PPJ_A1_AST_METADATA_BYTES,
	MAXIMUM_PPJ_A1_AST_NODES,
	MAXIMUM_PPJ_A1_AST_OBJECT_MEMBERS,
	MAXIMUM_PPJ_A1_AST_OBJECT_MEMBERS_PER_OBJECT,
	MAXIMUM_PPJ_A1_AST_STRING_BYTES,
	MAXIMUM_PPJ_A1_AST_STRING_BYTES_PER_STRING,
	parsePpjA1JsonBytes,
} from "../domain/ppj-a1-lossless-json";
import { alphaBackupFeasibilityLimits } from "./backup-feasibility-policy";
import { canonicalProjectSerializer } from "./create-project";
import type {
	BinaryChecksumPort,
	CancellationSignalPort,
	CustomAssetResource,
	PublicationCandidate,
} from "./ports";

export type BrowserBackupRepresentationFailure =
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "PROJECT_BACKUP_ENVELOPE_EXCEEDED"
				| "BACKUP_CANCELLED";
	  }
	| { readonly kind: "verification-unavailable" };
export interface BrowserBackupSourceProof {
	readonly project: Project;
	readonly maximumProjectByteLength: number;
	/** Privately owned ingress bytes; the admission profile never exposes this proof to UI. */
	readonly resources: readonly CustomAssetResource[];
}
export type BrowserBackupRepresentationResult =
	| BrowserBackupRepresentationFailure
	| {
			readonly kind: "representable";
			readonly proof: BrowserBackupSourceProof;
	  };
const uuid =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const rejected = (): BrowserBackupRepresentationFailure => ({
	kind: "rejected",
	reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
});

/** This spelling restriction belongs only to the additional browser ingress. */
export function isBrowserBackupResourceHash(value: string): boolean {
	return /^[a-f0-9]{64}$/.test(value);
}

/** No JSON equality: own presence, array properties, UTF16 and signed zero are values. */
export function sameBrowserBackupValue(left: unknown, right: unknown): boolean {
	const pairs = new WeakMap<object, WeakSet<object>>();
	const equal = (a: unknown, b: unknown): boolean => {
		if (Object.is(a, b)) return true;
		if (
			a === null ||
			b === null ||
			typeof a !== "object" ||
			typeof b !== "object" ||
			Array.isArray(a) !== Array.isArray(b)
		)
			return false;
		if (pairs.get(a)?.has(b)) return true;
		const matched = pairs.get(a) ?? new WeakSet<object>();
		matched.add(b);
		pairs.set(a, matched);
		const keys = Reflect.ownKeys(a);
		if (keys.length !== Reflect.ownKeys(b).length) return false;
		return keys.every((key) => {
			const first = Object.getOwnPropertyDescriptor(a, key),
				second = Object.getOwnPropertyDescriptor(b, key);
			return (
				first !== undefined &&
				second !== undefined &&
				Object.hasOwn(first, "value") &&
				Object.hasOwn(second, "value") &&
				equal(first.value, second.value)
			);
		});
	};
	return equal(left, right);
}

export function freezeBrowserBackupValue(value: unknown): void {
	const seen = new WeakSet<object>();
	const freeze = (current: unknown): void => {
		if (current === null || typeof current !== "object" || seen.has(current))
			return;
		seen.add(current);
		for (const key of Reflect.ownKeys(current)) {
			const descriptor = Object.getOwnPropertyDescriptor(current, key);
			if (!descriptor || !Object.hasOwn(descriptor, "value"))
				throw new TypeError("Unowned Project accessor");
			freeze(descriptor.value);
		}
		Object.freeze(current);
	};
	freeze(value);
}

/**
 * The ordinary importer has already copied source/resources before this call.
 * Keep those resource snapshots private rather than copying the entire 180MiB payload again.
 */
export async function assessBrowserBackupRepresentability(
	project: Project,
	resources: readonly CustomAssetResource[],
	checksum: BinaryChecksumPort,
	signal?: CancellationSignalPort,
): Promise<BrowserBackupRepresentationResult> {
	try {
		if (signal?.aborted)
			return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
		const owned = copyProject(project);
		freezeBrowserBackupValue(owned);
		const snapshots = resources.map((resource) =>
			Object.freeze({
				resourceHash: resource.resourceHash,
				bytes: resource.bytes,
			}),
		);
		const measured = legacyProject(owned, true);
		if (!measured) return rejected();
		const references = resourceReferences(
			owned,
			snapshots,
			measured.maximumProjectBytes,
		);
		if (!references) return rejected();
		const valid = await verifyResources(
			references,
			snapshots,
			checksum,
			signal,
		);
		if (signal?.aborted)
			return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
		if (!valid) return rejected();
		return {
			kind: "representable",
			proof: Object.freeze({
				project: owned,
				maximumProjectByteLength: measured.maximumProjectBytes,
				resources: Object.freeze(snapshots),
			}),
		};
	} catch {
		return signal?.aborted
			? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
			: { kind: "verification-unavailable" };
	}
}

/** Checks the actual generated identity/time and internal Revision before any staging. */
export async function verifyBrowserBackupCandidate(
	candidate: PublicationCandidate,
	proof: BrowserBackupSourceProof,
	resources: readonly CustomAssetResource[],
	checksum: BinaryChecksumPort,
	signal?: CancellationSignalPort,
): Promise<BrowserBackupRepresentationFailure | { readonly kind: "accepted" }> {
	try {
		if (signal?.aborted)
			return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
		const project = copyProject(candidate.project),
			revision = { ...candidate.revision };
		if (
			!uuid.test(project.projectId) ||
			project.projectId === proof.project.projectId ||
			!uuid.test(revision.revisionId) ||
			revision.projectId !== project.projectId ||
			revision.schemaVersion !== 1 ||
			revision.createdAt !== project.updatedAt ||
			project.updatedAt.length > 27 ||
			new Date(project.updatedAt).toISOString() !== project.updatedAt
		)
			return rejected();
		const comparable = {
			...project,
			projectId: proof.project.projectId,
			updatedAt: proof.project.updatedAt,
		};
		if (!sameBrowserBackupValue(comparable, proof.project)) return rejected();
		const measured = legacyProject(project, false);
		if (
			!measured ||
			measured.maximumProjectBytes > proof.maximumProjectByteLength ||
			measured.serialized !== revision.serializedProject
		)
			return rejected();
		const digest = await checksum.sha256Bytes(
			encodeBrowserBackupUtf8(measured.serialized),
		);
		if (signal?.aborted)
			return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
		if (digest !== revision.checksum) return rejected();
		const references = resourceReferences(
			project,
			resources,
			measured.maximumProjectBytes,
		);
		if (!references || !sameResourceBytes(resources, proof.resources))
			return rejected();
		const valid = await verifyResources(
			references,
			resources,
			checksum,
			signal,
		);
		if (signal?.aborted)
			return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
		if (!valid) return rejected();
		return { kind: "accepted" };
	} catch {
		return signal?.aborted
			? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
			: { kind: "verification-unavailable" };
	}
}

export function sameBrowserBackupResourceBytes(
	left: readonly CustomAssetResource[],
	right: readonly CustomAssetResource[],
): boolean {
	return sameResourceBytes(left, right);
}
function sameResourceBytes(
	left: readonly CustomAssetResource[],
	right: readonly CustomAssetResource[],
): boolean {
	if (left.length !== right.length) return false;
	const expected = new Map(
		right.map((resource) => [resource.resourceHash, resource.bytes]),
	);
	if (expected.size !== right.length) return false;
	return left.every((resource) => {
		const bytes = expected.get(resource.resourceHash);
		return (
			bytes !== undefined &&
			resource.bytes.byteLength === bytes.byteLength &&
			resource.bytes.every((value, index) => value === bytes[index])
		);
	});
}

function resourceReferences(
	project: Project,
	resources: readonly CustomAssetResource[],
	projectBytes: number,
): ReadonlyMap<string, number> | undefined {
	if (
		project.assetDefinitionRefs.length !== resources.length ||
		resources.length > alphaBackupFeasibilityLimits.maxResourceEntries
	)
		return undefined;
	const references = new Map<string, number>();
	let payload = 0;
	for (const definition of project.assetDefinitionRefs) {
		if (
			!isBrowserBackupResourceHash(definition.resourceHash) ||
			references.has(definition.resourceHash) ||
			!Number.isSafeInteger(definition.byteLength) ||
			definition.byteLength <= 0 ||
			definition.byteLength >
				alphaBackupFeasibilityLimits.maxResourceBytesPerEntry
		)
			return undefined;
		references.set(definition.resourceHash, definition.byteLength);
		payload += definition.byteLength;
	}
	// Actual old STORE writer: fixed controls/project header <=3KiB, each ASCII
	// lower64 resource descriptor/path/local+central ZIP header <=1024 bytes.
	const upper = projectBytes + payload + 3072 + 1024 * references.size;
	if (
		payload > alphaBackupFeasibilityLimits.maxResourceBytes ||
		upper > alphaBackupFeasibilityLimits.maxContainerBytes ||
		upper > alphaBackupFeasibilityLimits.maxUnpackedBytes
	)
		return undefined;
	const seen = new Set<string>();
	for (const resource of resources) {
		if (
			seen.has(resource.resourceHash) ||
			references.get(resource.resourceHash) !== resource.bytes.byteLength
		)
			return undefined;
		seen.add(resource.resourceHash);
	}
	return references;
}
async function verifyResources(
	references: ReadonlyMap<string, number>,
	resources: readonly CustomAssetResource[],
	checksum: BinaryChecksumPort,
	signal?: CancellationSignalPort,
): Promise<boolean> {
	for (const resource of resources) {
		if (
			signal?.aborted ||
			references.get(resource.resourceHash) !== resource.bytes.byteLength ||
			(await checksum.sha256Bytes(resource.bytes.slice())) !==
				resource.resourceHash
		)
			return false;
	}
	return !signal?.aborted;
}

/** Counts the actual canonical JSON shape before its full string/AST allocation. */
function legacyProject(
	project: Project,
	reserveIdentity: boolean,
):
	| { readonly serialized: string; readonly maximumProjectBytes: number }
	| undefined {
	const counts = {
		valueNodes: 0,
		memberRecords: 0,
		arrayElements: 0,
		pointerLinks: 0,
		decodedStringBytes: 0,
		rawNumericLexemeBytes: 0,
	};
	let bytes = 0;
	const ancestors = new WeakSet<object>();
	const charge = (amount: number): boolean => {
		bytes += amount;
		return bytes <= alphaBackupFeasibilityLimits.maxProjectBytes;
	};
	const string = (
		value: string,
	): { readonly raw: number; readonly decoded: number } | undefined => {
		if (value.length > MAXIMUM_PPJ_A1_AST_STRING_BYTES_PER_STRING)
			return undefined;
		const decoded = browserBackupUtf8ByteLength(value);
		if (decoded > MAXIMUM_PPJ_A1_AST_STRING_BYTES_PER_STRING) return undefined;
		const raw = JSON.stringify(value);
		return raw === undefined
			? undefined
			: { raw: browserBackupUtf8ByteLength(raw), decoded };
	};
	const walk = (value: unknown, depth: number): boolean => {
		counts.valueNodes++;
		counts.pointerLinks++;
		if (counts.valueNodes > MAXIMUM_PPJ_A1_AST_NODES) return false;
		if (typeof value === "string") {
			const length = string(value);
			if (!length) return false;
			counts.decodedStringBytes += length.decoded;
			return charge(length.raw);
		}
		if (typeof value === "number") {
			if (!Number.isFinite(value) || Object.is(value, -0)) return false;
			const raw = JSON.stringify(value);
			if (raw === undefined) return false;
			counts.rawNumericLexemeBytes += raw.length;
			return charge(raw.length);
		}
		if (typeof value === "boolean") return charge(value ? 4 : 5);
		if (value === null) return charge(4);
		if (
			typeof value !== "object" ||
			ancestors.has(value) ||
			depth + 1 > MAXIMUM_PPJ_A1_AST_CONTAINER_DEPTH
		)
			return false;
		ancestors.add(value);
		const keys = Reflect.ownKeys(value);
		let valid = true;
		if (Array.isArray(value)) {
			if (
				Object.getPrototypeOf(value) !== Array.prototype ||
				value.length > MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS_PER_ARRAY ||
				keys.length !== value.length + 1
			)
				return false;
			counts.arrayElements += value.length;
			if (
				counts.arrayElements > MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS ||
				!charge(2 + Math.max(0, value.length - 1))
			)
				return false;
			for (let index = 0; index < value.length; index++) {
				const descriptor = Object.getOwnPropertyDescriptor(
					value,
					String(index),
				);
				if (
					!descriptor?.enumerable ||
					!Object.hasOwn(descriptor, "value") ||
					!walk(descriptor.value, depth + 1)
				) {
					valid = false;
					break;
				}
			}
		} else {
			if (
				Object.getPrototypeOf(value) !== Object.prototype ||
				keys.length > MAXIMUM_PPJ_A1_AST_OBJECT_MEMBERS_PER_OBJECT
			)
				return false;
			counts.memberRecords += keys.length;
			if (
				counts.memberRecords > MAXIMUM_PPJ_A1_AST_OBJECT_MEMBERS ||
				!charge(2 + Math.max(0, keys.length - 1))
			)
				return false;
			for (const key of keys) {
				const descriptor = Object.getOwnPropertyDescriptor(value, key),
					length = typeof key === "string" ? string(key) : undefined;
				if (
					!descriptor?.enumerable ||
					!Object.hasOwn(descriptor, "value") ||
					!length ||
					!charge(length.raw + 1)
				) {
					valid = false;
					break;
				}
				counts.decodedStringBytes += length.decoded;
				if (!walk(descriptor.value, depth + 1)) {
					valid = false;
					break;
				}
			}
		}
		ancestors.delete(value);
		return valid;
	};
	if (!walk(project, 0)) return undefined;
	// browserRandomUuid always emits UUIDv4's36 ASCII chars (native or fallback);
	// Date.toISOString emits at most27. Only these two Project values change.
	const quotedId = JSON.stringify(project.projectId),
		quotedTime = JSON.stringify(project.updatedAt);
	if (quotedId === undefined || quotedTime === undefined) return undefined;
	const extraBytes = reserveIdentity
		? Math.max(0, 38 - browserBackupUtf8ByteLength(quotedId)) +
			Math.max(0, 29 - browserBackupUtf8ByteLength(quotedTime))
		: 0;
	const extraDecoded = reserveIdentity
		? Math.max(0, 36 - browserBackupUtf8ByteLength(project.projectId)) +
			Math.max(0, 27 - browserBackupUtf8ByteLength(project.updatedAt))
		: 0;
	const future = {
		...counts,
		decodedStringBytes: counts.decodedStringBytes + extraDecoded,
	};
	if (
		bytes + extraBytes > alphaBackupFeasibilityLimits.maxProjectBytes ||
		future.decodedStringBytes > MAXIMUM_PPJ_A1_AST_STRING_BYTES ||
		calculatePpjA1AstMetadataBytes(future) > MAXIMUM_PPJ_A1_AST_METADATA_BYTES
	)
		return undefined;
	const serialized = canonicalProjectSerializer.serialize(project),
		encoded = encodeBrowserBackupUtf8(serialized);
	if (
		encoded.byteLength !== bytes ||
		parsePpjA1JsonBytes(encoded).kind !== "accepted"
	)
		return undefined;
	// These are the same member guard/canonical-byte check used by the old importer.
	const parsed: unknown = JSON.parse(serialized);
	if (
		!isStructurallyValidProjectV1(parsed) ||
		canonicalProjectSerializer.serialize(parsed) !== serialized ||
		!sameBrowserBackupValue(project, parsed)
	)
		return undefined;
	return { serialized, maximumProjectBytes: bytes + extraBytes };
}

/** UTF8 sizing never retains an encoded copy; lone UTF16 code units charge U+FFFD. */
export function browserBackupUtf8ByteLength(value: string): number {
	let bytes = 0;
	for (let index = 0; index < value.length; index++) {
		const first = value.charCodeAt(index);
		if (first <= 0x7f) bytes++;
		else if (first <= 0x7ff) bytes += 2;
		else if (first >= 0xd800 && first <= 0xdbff) {
			const second = value.charCodeAt(index + 1);
			if (second >= 0xdc00 && second <= 0xdfff) {
				bytes += 4;
				index++;
			} else bytes += 3;
		} else bytes += 3;
	}
	return bytes;
}

/** Exactly one output allocation, with native TextEncoder replacement semantics. */
export function encodeBrowserBackupUtf8(value: string): Uint8Array {
	const bytes = new Uint8Array(browserBackupUtf8ByteLength(value));
	let offset = 0;
	for (const character of value) {
		const current = character.codePointAt(0);
		if (current === undefined) continue;
		const point = current >= 0xd800 && current <= 0xdfff ? 0xfffd : current;
		if (point <= 0x7f) bytes[offset++] = point;
		else if (point <= 0x7ff) {
			bytes[offset++] = 0xc0 | (point >> 6);
			bytes[offset++] = 0x80 | (point & 0x3f);
		} else if (point <= 0xffff) {
			bytes[offset++] = 0xe0 | (point >> 12);
			bytes[offset++] = 0x80 | ((point >> 6) & 0x3f);
			bytes[offset++] = 0x80 | (point & 0x3f);
		} else {
			bytes[offset++] = 0xf0 | (point >> 18);
			bytes[offset++] = 0x80 | ((point >> 12) & 0x3f);
			bytes[offset++] = 0x80 | ((point >> 6) & 0x3f);
			bytes[offset++] = 0x80 | (point & 0x3f);
		}
	}
	return bytes;
}
