import { serializeProjectCanonically } from "./canonical-serialization";
import { alphaParametricItemColorVariantFor } from "./item-color-variant";
import { parsePpjA1JsonBytes } from "./ppj-a1-lossless-json";
import type { Project, RoomType, RotationStep } from "./project";
import { hasOnlyUnicodeScalarValues } from "./unicode-scalar-values";

const LOCAL_PROJECT_JSON_FORMAT = "interiors-editor-project-json" as const;
const LOCAL_PROJECT_JSON_FORMAT_VERSION = 1 as const;

const MAXIMUM_PROJECT_JSON_BYTES = 10 * 1024 * 1024;
const MAXIMUM_ASSETS = 250;
const MAXIMUM_OPENINGS = 200;
const MAXIMUM_ROOMS = 50;
const MAXIMUM_VERTICES = 600;
const MAXIMUM_WALLS = 300;
const ROOM_TYPES: readonly RoomType[] = [
	"bathroom",
	"bedroom",
	"hallway",
	"kitchen",
	"living-room",
	"office",
	"other",
	"storage",
];

export type ProjectJsonChecksum = (
	serializedProject: string,
) => Promise<string>;

export type DecodeLocalProjectJsonResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "PROJECT_JSON_CHECKSUM_MISMATCH"
				| "PROJECT_JSON_INVALID";
	  };

type LocalProjectJsonEnvelope = {
	readonly format: typeof LOCAL_PROJECT_JSON_FORMAT;
	readonly formatVersion: typeof LOCAL_PROJECT_JSON_FORMAT_VERSION;
	readonly project: Project;
	readonly projectChecksum: string;
};

/**
 * A small transfer format for the current, resource-free Project schema.
 * It intentionally carries no resource bytes or external URLs; future
 * catalog/custom resources require the self-contained Portable Backup route.
 */
export async function encodeLocalProjectJson(
	project: Project,
	checksum: ProjectJsonChecksum,
): Promise<string> {
	const serializedProject = serializeProjectCanonically(project);
	const envelope: LocalProjectJsonEnvelope = {
		format: LOCAL_PROJECT_JSON_FORMAT,
		formatVersion: LOCAL_PROJECT_JSON_FORMAT_VERSION,
		project: JSON.parse(serializedProject) as Project,
		projectChecksum: await checksum(serializedProject),
	};
	return JSON.stringify(envelope);
}

/**
 * Verifies the untrusted file before materialising it as a Project object.
 * Canonical equality rejects pretty printing, raw numeric aliases and unknown
 * envelope fields so this inexpensive transfer route cannot become a loose
 * schema ingress beside Portable Backup.
 */
export async function decodeLocalProjectJson(
	bytes: Uint8Array,
	checksum: ProjectJsonChecksum,
): Promise<DecodeLocalProjectJsonResult> {
	if (bytes.byteLength > MAXIMUM_PROJECT_JSON_BYTES) {
		return rejectInvalid();
	}
	const parsedBytes = parsePpjA1JsonBytes(bytes);
	if (parsedBytes.kind === "rejected") {
		return rejectInvalid();
	}

	let raw: string;
	let parsed: unknown;
	try {
		raw = decodeUtf8(bytes);
		parsed = JSON.parse(raw);
	} catch {
		return rejectInvalid();
	}
	if (!isLocalProjectJsonEnvelope(parsed)) {
		return rejectInvalid();
	}

	const serializedProject = serializeProjectCanonically(parsed.project);
	const canonicalEnvelope = JSON.stringify({
		format: LOCAL_PROJECT_JSON_FORMAT,
		formatVersion: LOCAL_PROJECT_JSON_FORMAT_VERSION,
		project: JSON.parse(serializedProject) as Project,
		projectChecksum: parsed.projectChecksum,
	} satisfies LocalProjectJsonEnvelope);
	if (raw !== canonicalEnvelope) {
		return rejectInvalid();
	}
	return (await checksum(serializedProject)) === parsed.projectChecksum
		? { kind: "accepted", project: parsed.project }
		: { kind: "rejected", reasonCode: "PROJECT_JSON_CHECKSUM_MISMATCH" };
}

function isLocalProjectJsonEnvelope(
	value: unknown,
): value is LocalProjectJsonEnvelope {
	if (
		!hasExactKeys(value, [
			"format",
			"formatVersion",
			"project",
			"projectChecksum",
		])
	) {
		return false;
	}
	const envelope = value as Record<string, unknown>;
	return (
		envelope.format === LOCAL_PROJECT_JSON_FORMAT &&
		envelope.formatVersion === LOCAL_PROJECT_JSON_FORMAT_VERSION &&
		typeof envelope.projectChecksum === "string" &&
		envelope.projectChecksum.length > 0 &&
		isStructurallyValidProjectV1(envelope.project)
	);
}

/** Validates the persisted v1 document before it becomes a durable projection. */
export function isStructurallyValidProjectV1(value: unknown): value is Project {
	if (
		!hasExactKeys(value, [
			"schemaVersion",
			"projectId",
			"name",
			"createdAt",
			"updatedAt",
			"lifecycle",
			"level",
			"assetInstances",
			"assetDefinitionRefs",
		])
	) {
		return false;
	}
	const project = value as Record<string, unknown>;
	if (
		project.schemaVersion !== 1 ||
		project.lifecycle !== "active" ||
		!isNonEmptyString(project.projectId) ||
		!isProjectName(project.name) ||
		!isIsoInstant(project.createdAt) ||
		!isIsoInstant(project.updatedAt) ||
		!isAssetDefinitionRefs(project.assetDefinitionRefs) ||
		!isLevel(project.level) ||
		!Array.isArray(project.assetInstances) ||
		project.assetInstances.length > MAXIMUM_ASSETS
	) {
		return false;
	}

	const level = project.level;
	const roomIds = new Set(level.rooms.map((room) => room.roomId));
	const wallIds = new Set(level.wallSegments.map((wall) => wall.wallSegmentId));
	const assetIds = new Set<string>();
	const assetDefinitionIds = new Set(
		project.assetDefinitionRefs.map((asset) => asset.assetDefinitionId),
	);
	return project.assetInstances.every((asset) => {
		if (!isSchematicAssetItem(asset) || assetIds.has(asset.assetInstanceId)) {
			return false;
		}
		assetIds.add(asset.assetInstanceId);
		return (
			(asset.anchorClass === "floor"
				? roomIds.has(asset.roomId)
				: wallIds.has(asset.wallSegmentId)) &&
			(asset.assetDefinitionId === undefined ||
				assetDefinitionIds.has(asset.assetDefinitionId)) &&
			(asset.colorVariantId === undefined ||
				asset.assetDefinitionId === undefined)
		);
	});
}

function isLevel(value: unknown): value is Project["level"] {
	if (
		!hasExactKeys(value, [
			"levelId",
			"vertices",
			"wallSegments",
			"rooms",
			"openings",
		])
	) {
		return false;
	}
	const level = value as Record<string, unknown>;
	if (
		!isNonEmptyString(level.levelId) ||
		!Array.isArray(level.vertices) ||
		!Array.isArray(level.wallSegments) ||
		!Array.isArray(level.rooms) ||
		!Array.isArray(level.openings) ||
		level.vertices.length > MAXIMUM_VERTICES ||
		level.wallSegments.length > MAXIMUM_WALLS ||
		level.rooms.length > MAXIMUM_ROOMS ||
		level.openings.length > MAXIMUM_OPENINGS
	) {
		return false;
	}

	const vertexIds = new Set<string>();
	const coordinates = new Set<string>();
	for (const vertex of level.vertices) {
		if (!isVertex(vertex) || vertexIds.has(vertex.vertexId)) {
			return false;
		}
		const coordinate = `${vertex.xMm}:${vertex.zMm}`;
		if (coordinates.has(coordinate)) {
			return false;
		}
		vertexIds.add(vertex.vertexId);
		coordinates.add(coordinate);
	}

	const wallIds = new Set<string>();
	for (const wall of level.wallSegments) {
		if (
			!isWallSegment(wall) ||
			wallIds.has(wall.wallSegmentId) ||
			!vertexIds.has(wall.startVertexId) ||
			!vertexIds.has(wall.endVertexId) ||
			wall.startVertexId === wall.endVertexId
		) {
			return false;
		}
		wallIds.add(wall.wallSegmentId);
	}

	const roomIds = new Set<string>();
	for (const room of level.rooms) {
		if (!isRoom(room) || roomIds.has(room.roomId)) {
			return false;
		}
		roomIds.add(room.roomId);
	}

	const openingIds = new Set<string>();
	return level.openings.every((opening) => {
		if (!isOpening(opening) || openingIds.has(opening.openingId)) {
			return false;
		}
		openingIds.add(opening.openingId);
		return wallIds.has(opening.wallSegmentId);
	});
}

function isVertex(
	value: unknown,
): value is Project["level"]["vertices"][number] {
	if (!hasExactKeys(value, ["vertexId", "xMm", "zMm"])) {
		return false;
	}
	const vertex = value as Record<string, unknown>;
	return (
		isNonEmptyString(vertex.vertexId) &&
		isSafeIntegerInRange(vertex.xMm, -100_000, 100_000) &&
		isSafeIntegerInRange(vertex.zMm, -100_000, 100_000)
	);
}

function isWallSegment(
	value: unknown,
): value is Project["level"]["wallSegments"][number] {
	if (
		!hasExactKeys(value, [
			"wallSegmentId",
			"startVertexId",
			"endVertexId",
			"thicknessMm",
		])
	) {
		return false;
	}
	const wall = value as Record<string, unknown>;
	return (
		isNonEmptyString(wall.wallSegmentId) &&
		isNonEmptyString(wall.startVertexId) &&
		isNonEmptyString(wall.endVertexId) &&
		isSafeIntegerInRange(wall.thicknessMm, 20, 1_000)
	);
}

function isRoom(value: unknown): value is Project["level"]["rooms"][number] {
	if (
		!hasExactKeys(
			value,
			["roomId", "faceFingerprint", "heightMm"],
			["name", "type"],
		)
	) {
		return false;
	}
	const room = value as Record<string, unknown>;
	return (
		isNonEmptyString(room.roomId) &&
		isNonEmptyString(room.faceFingerprint) &&
		isSafeIntegerInRange(room.heightMm, 500, 10_000) &&
		(room.name === undefined || isNonEmptyString(room.name)) &&
		(room.type === undefined || ROOM_TYPES.includes(room.type as RoomType))
	);
}

function isOpening(
	value: unknown,
): value is Project["level"]["openings"][number] {
	if (
		!hasExactKeys(
			value,
			[
				"openingId",
				"wallSegmentId",
				"offsetMm",
				"widthMm",
				"heightMm",
				"sillMm",
				"kind",
			],
			["swingSide", "hingeEnd"],
		)
	) {
		return false;
	}
	const opening = value as Record<string, unknown>;
	return (
		isNonEmptyString(opening.openingId) &&
		isNonEmptyString(opening.wallSegmentId) &&
		isSafeIntegerInRange(opening.offsetMm, 0, 100_000) &&
		isSafeIntegerInRange(opening.widthMm, 1, 100_000) &&
		isSafeIntegerInRange(opening.heightMm, 1, 10_000) &&
		isSafeIntegerInRange(opening.sillMm, 0, 10_000) &&
		opening.kind !== undefined &&
		(opening.kind === "Door" || opening.kind === "Window") &&
		(opening.kind === "Window"
			? opening.swingSide === undefined && !Object.hasOwn(opening, "hingeEnd")
			: (opening.swingSide === undefined ||
				opening.swingSide === "left" ||
				opening.swingSide === "right") &&
				(!Object.hasOwn(opening, "hingeEnd") || opening.hingeEnd === "end"))
	);
}

function isSchematicAssetItem(
	value: unknown,
): value is Project["assetInstances"][number] {
	if (!isRecordWithAnchorClass(value)) return false;
	switch (value.anchorClass) {
		case "floor":
			return isSchematicFloorItem(value);
		case "wall":
			return isSchematicWallItem(value);
		default:
			return false;
	}
}

function isRecordWithAnchorClass(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && "anchorClass" in value;
}

function isSchematicFloorItem(value: unknown): boolean {
	if (
		!hasExactKeys(
			value,
			[
				"assetInstanceId",
				"anchorClass",
				"roomId",
				"label",
				"xMm",
				"zMm",
				"widthMm",
				"depthMm",
				"heightMm",
				"color",
			],
			[
				"assetDefinitionId",
				"colorVariantId",
				"elevationMm",
				"locked",
				"yawRadians",
				"yawStep",
				"yawMilliDeg",
			],
		)
	) {
		return false;
	}
	const item = value as Record<string, unknown>;
	return (
		isNonEmptyString(item.assetInstanceId) &&
		(item.assetDefinitionId === undefined ||
			isNonEmptyString(item.assetDefinitionId)) &&
		(item.locked === undefined || item.locked === true) &&
		item.anchorClass === "floor" &&
		(item.elevationMm === undefined || item.elevationMm === 0) &&
		isNonEmptyString(item.roomId) &&
		isNonEmptyString(item.label) &&
		isSafeIntegerInRange(item.xMm, -100_000, 100_000) &&
		isSafeIntegerInRange(item.zMm, -100_000, 100_000) &&
		isSafeIntegerInRange(item.widthMm, 1, 100_000) &&
		isSafeIntegerInRange(item.depthMm, 1, 100_000) &&
		isSafeIntegerInRange(item.heightMm, 1, 100_000) &&
		typeof item.color === "string" &&
		/^#[0-9a-f]{6}$/i.test(item.color) &&
		(item.colorVariantId === undefined ||
			alphaParametricItemColorVariantFor(String(item.colorVariantId))?.color ===
				item.color) &&
		(item.yawRadians === undefined ||
			(typeof item.yawRadians === "number" &&
				Number.isFinite(item.yawRadians))) &&
		(item.yawStep === undefined || isRotationStep(item.yawStep)) &&
		(item.yawMilliDeg === undefined || (
			isSafeIntegerInRange(item.yawMilliDeg, 0, 359_999) &&
			item.yawRadians === undefined && item.yawStep === undefined
		))
	);
}

function isSchematicWallItem(value: unknown): boolean {
	if (
		!hasExactKeys(
			value,
			[
				"assetInstanceId",
				"anchorClass",
				"wallSegmentId",
				"side",
				"offsetMm",
				"elevationMm",
				"label",
				"widthMm",
				"depthMm",
				"heightMm",
				"color",
			],
			["assetDefinitionId", "colorVariantId", "locked"],
		)
	) {
		return false;
	}
	const item = value as Record<string, unknown>;
	return (
		isNonEmptyString(item.assetInstanceId) &&
		(item.assetDefinitionId === undefined ||
			isNonEmptyString(item.assetDefinitionId)) &&
		(item.locked === undefined || item.locked === true) &&
		item.anchorClass === "wall" &&
		isNonEmptyString(item.wallSegmentId) &&
		(item.side === "left" || item.side === "right") &&
		isSafeIntegerInRange(item.offsetMm, 0, 100_000) &&
		isSafeIntegerInRange(item.elevationMm, 0, 10_000) &&
		isNonEmptyString(item.label) &&
		isSafeIntegerInRange(item.widthMm, 1, 100_000) &&
		isSafeIntegerInRange(item.depthMm, 1, 100_000) &&
		isSafeIntegerInRange(item.heightMm, 1, 10_000) &&
		typeof item.color === "string" &&
		/^#[0-9a-f]{6}$/i.test(item.color) &&
		(item.colorVariantId === undefined ||
			alphaParametricItemColorVariantFor(String(item.colorVariantId))?.color ===
				item.color)
	);
}

function isAssetDefinitionRefs(
	value: unknown,
): value is Project["assetDefinitionRefs"] {
	if (!Array.isArray(value) || value.length > MAXIMUM_ASSETS) {
		return false;
	}
	const ids = new Set<string>();
	const hashes = new Set<string>();
	return value.every((definition) => {
		if (
			!hasExactKeys(definition, [
				"assetDefinitionId",
				"byteLength",
				"depthMm",
				"displayName",
				"format",
				"heightMm",
				"resourceHash",
				"widthMm",
			], [
				"catalogAssetId",
				"catalogEnvelopeHash",
				"catalogVersion",
				"source",
			])
		) {
			return false;
		}
		const asset = definition as Record<string, unknown>;
		if (
			!isNonEmptyString(asset.assetDefinitionId) ||
			!isSafeIntegerInRange(asset.byteLength, 1, Number.MAX_SAFE_INTEGER) ||
			!isSafeIntegerInRange(asset.widthMm, 1, 100_000) ||
			!isSafeIntegerInRange(asset.depthMm, 1, 100_000) ||
			!isSafeIntegerInRange(asset.heightMm, 1, 100_000) ||
			!isNonEmptyString(asset.displayName) ||
			asset.format !== "glb" ||
			typeof asset.resourceHash !== "string" ||
			!/^[a-f0-9]{64}$/i.test(asset.resourceHash) ||
			!hasValidCatalogVersionOrigin(asset) ||
			ids.has(asset.assetDefinitionId) ||
			hashes.has(asset.resourceHash)
		) {
			return false;
		}
		ids.add(asset.assetDefinitionId);
		hashes.add(asset.resourceHash);
		return true;
	});
}

function hasValidCatalogVersionOrigin(asset: Record<string, unknown>): boolean {
	const provenance = [
		asset.source,
		asset.catalogAssetId,
		asset.catalogEnvelopeHash,
		asset.catalogVersion,
	];
	if (provenance.every((value) => value === undefined)) return true;
	return (
		asset.source === "CatalogVersion" &&
		isNonEmptyString(asset.catalogAssetId) &&
		asset.catalogAssetId.trim() === asset.catalogAssetId &&
		isNonEmptyString(asset.catalogVersion) &&
		asset.catalogVersion.trim() === asset.catalogVersion &&
		typeof asset.catalogEnvelopeHash === "string" &&
		/^[a-f0-9]{64}$/i.test(asset.catalogEnvelopeHash)
	);
}

function hasExactKeys(
	value: unknown,
	required: readonly string[],
	optional: readonly string[] = [],
): value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const keys = Object.keys(value);
	return (
		required.every((key) => Object.hasOwn(value, key)) &&
		keys.every((key) => required.includes(key) || optional.includes(key))
	);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function isProjectName(value: unknown): value is string {
	return (
		isNonEmptyString(value) &&
		value.trim() === value &&
		hasOnlyUnicodeScalarValues(value)
	);
}

function isIsoInstant(value: unknown): value is string {
	if (!isNonEmptyString(value)) {
		return false;
	}
	try {
		return new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

function isRotationStep(value: unknown): value is RotationStep {
	return (
		typeof value === "number" &&
		Number.isSafeInteger(value) &&
		value >= 0 &&
		value <= 7
	);
}

function isSafeIntegerInRange(
	value: unknown,
	minimum: number,
	maximum: number,
): value is number {
	return (
		typeof value === "number" &&
		Number.isSafeInteger(value) &&
		value >= minimum &&
		value <= maximum
	);
}

function rejectInvalid(): DecodeLocalProjectJsonResult {
	return { kind: "rejected", reasonCode: "PROJECT_JSON_INVALID" };
}

function decodeUtf8(bytes: Uint8Array): string {
	const TextDecoderConstructor = (
		globalThis as typeof globalThis & {
			readonly TextDecoder?: new (
				label?: string,
				options?: { readonly fatal?: boolean },
			) => { decode(input: Uint8Array): string };
		}
	).TextDecoder;
	if (!TextDecoderConstructor) {
		throw new Error("UTF-8 decoding is unavailable");
	}
	return new TextDecoderConstructor("utf-8", { fatal: true }).decode(bytes);
}
