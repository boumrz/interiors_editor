const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BINARY_CHUNK_TYPE = 0x004e4942;
export const MAXIMUM_GLB_INPUT_BYTES = 25 * 1024 * 1024;
const MAXIMUM_PORTABLE_GLB_RESOURCE_BYTES = 50 * 1024 * 1024;
const MAXIMUM_MATERIALS = 32;
const MAXIMUM_MESH_PRIMITIVES = 128;
const MAXIMUM_NODES = 256;
const MAXIMUM_TEXTURES = 16;
const MAXIMUM_TRIANGLES = 250_000;
const MAXIMUM_VERTICES = 300_000;
const MAXIMUM_TEXTURE_DIMENSION = 4096;
const MAXIMUM_DECODED_TEXTURE_PIXELS = 48_000_000;
const allowedExtensions = new Set([
	"KHR_materials_unlit",
	"KHR_texture_transform",
]);

export type StaticGlbImportPreflight =
	| {
			readonly inputBytes: number;
			readonly kind: "accepted";
			readonly materialCount: number;
			readonly meshCount: number;
			readonly nodeCount: number;
			readonly textureCount: number;
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "ANIMATION_OR_SKIN_UNSUPPORTED"
				| "DECODED_GEOMETRY_LIMIT"
				| "EXTERNAL_RESOURCE"
				| "GLB_FILE_BYTES_LIMIT"
				| "MALFORMED_GLTF"
				| "MEMORY_BUDGET_RISK"
				| "TEXTURE_LIMIT"
				| "UNSUPPORTED_REQUIRED_EXTENSION";
	  };

/**
 * Validates the inexpensive, declared GLB surface before a decoder or preview
 * can create scene/GPU resources.  It is deliberately a preflight, not a
 * trust decision: decoded limits and a no-network preview still follow it.
 */
export function preflightStaticGlbImport(
	fileBytes: Uint8Array,
): StaticGlbImportPreflight {
	return preflightStaticGlbResource(fileBytes, MAXIMUM_GLB_INPUT_BYTES);
}

export interface StaticGlbResourcePreflightPolicy {
	readonly maximumInputBytes: number;
}

/** Explicit portable-resource policy; experimental import keeps its existing fixed limit. */
export function createStaticGlbResourcePreflight(
	policy: StaticGlbResourcePreflightPolicy,
): (fileBytes: Uint8Array) => StaticGlbImportPreflight {
	const maximumInputBytes = policy.maximumInputBytes;
	if (
		!Number.isSafeInteger(maximumInputBytes) ||
		maximumInputBytes <= 0 ||
		maximumInputBytes > MAXIMUM_PORTABLE_GLB_RESOURCE_BYTES
	) {
		throw new RangeError("A bounded static GLB resource policy is required");
	}
	return (fileBytes) =>
		preflightStaticGlbResource(fileBytes, maximumInputBytes);
}

function preflightStaticGlbResource(
	fileBytes: Uint8Array,
	maximumInputBytes: number,
): StaticGlbImportPreflight {
	if (fileBytes.byteLength > maximumInputBytes) {
		return reject("GLB_FILE_BYTES_LIMIT");
	}
	const parsedGlb = parseGlbJsonDocument(fileBytes);
	if (!parsedGlb) {
		return reject("MALFORMED_GLTF");
	}
	const { binaryChunk, document } = parsedGlb;
	if (!isCoreGltfAsset(document)) {
		return reject("MALFORMED_GLTF");
	}
	if (hasExternalResource(document)) {
		return reject("EXTERNAL_RESOURCE");
	}
	if (hasUnsupportedStaticSceneContent(document)) {
		return reject("ANIMATION_OR_SKIN_UNSUPPORTED");
	}
	if (hasUnsupportedExtension(document)) {
		return reject("UNSUPPORTED_REQUIRED_EXTENSION");
	}

	const nodeCount = arrayField(document, "nodes").length;
	const meshCount = arrayField(document, "meshes").length;
	const materialCount = arrayField(document, "materials").length;
	const textureCount = arrayField(document, "textures").length;
	if (
		nodeCount > MAXIMUM_NODES ||
		primitiveCount(document) > MAXIMUM_MESH_PRIMITIVES ||
		exceedsGeometryBudget(document)
	) {
		return reject("DECODED_GEOMETRY_LIMIT");
	}
	if (materialCount > MAXIMUM_MATERIALS || textureCount > MAXIMUM_TEXTURES) {
		return reject("TEXTURE_LIMIT");
	}
	const textureMemoryRisk = textureMemoryRiskFor(document, binaryChunk);
	if (textureMemoryRisk) {
		return reject(textureMemoryRisk);
	}
	return {
		inputBytes: fileBytes.byteLength,
		kind: "accepted",
		materialCount,
		meshCount,
		nodeCount,
		textureCount,
	};
}

interface ParsedGlbDocument {
	readonly binaryChunk: Uint8Array | undefined;
	readonly document: Record<string, unknown>;
}

function parseGlbJsonDocument(
	fileBytes: Uint8Array,
): ParsedGlbDocument | undefined {
	if (fileBytes.byteLength < 20) return undefined;
	const view = new DataView(
		fileBytes.buffer,
		fileBytes.byteOffset,
		fileBytes.byteLength,
	);
	if (
		view.getUint32(0, true) !== GLB_MAGIC ||
		view.getUint32(4, true) !== GLB_VERSION ||
		view.getUint32(8, true) !== fileBytes.byteLength
	) {
		return undefined;
	}
	let offset = 12;
	const jsonChunk = readChunk(view, fileBytes, offset);
	if (!jsonChunk || jsonChunk.type !== JSON_CHUNK_TYPE) return undefined;
	offset = jsonChunk.endOffset;
	let binaryChunk: Uint8Array | undefined;
	if (offset < fileBytes.byteLength) {
		const binaryChunkHeader = readChunk(view, fileBytes, offset);
		if (!binaryChunkHeader || binaryChunkHeader.type !== BINARY_CHUNK_TYPE)
			return undefined;
		offset = binaryChunkHeader.endOffset;
		binaryChunk = fileBytes.subarray(
			binaryChunkHeader.byteOffset,
			binaryChunkHeader.endOffset,
		);
	}
	if (offset !== fileBytes.byteLength) return undefined;
	try {
		const parsed: unknown = JSON.parse(
			decodeUtf8(fileBytes.subarray(jsonChunk.byteOffset, jsonChunk.endOffset)),
		);
		return isRecord(parsed) ? { binaryChunk, document: parsed } : undefined;
	} catch {
		return undefined;
	}
}

function readChunk(
	view: DataView,
	fileBytes: Uint8Array,
	headerOffset: number,
):
	| {
			readonly byteOffset: number;
			readonly endOffset: number;
			readonly type: number;
	  }
	| undefined {
	if (headerOffset + 8 > fileBytes.byteLength) return undefined;
	const length = view.getUint32(headerOffset, true);
	const byteOffset = headerOffset + 8;
	const endOffset = byteOffset + length;
	if (length % 4 !== 0 || endOffset > fileBytes.byteLength) return undefined;
	return {
		byteOffset,
		endOffset,
		type: view.getUint32(headerOffset + 4, true),
	};
}

function isCoreGltfAsset(document: Record<string, unknown>): boolean {
	return isRecord(document.asset) && document.asset.version === "2.0";
}

function hasExternalResource(document: Record<string, unknown>): boolean {
	return ["buffers", "images"].some((field) =>
		arrayField(document, field).some(
			(candidate) => isRecord(candidate) && typeof candidate.uri === "string",
		),
	);
}

function hasUnsupportedStaticSceneContent(
	document: Record<string, unknown>,
): boolean {
	return (
		Object.hasOwn(document, "animations") ||
		Object.hasOwn(document, "skins") ||
		Object.hasOwn(document, "cameras") ||
		arrayField(document, "nodes").some(
			(node) => isRecord(node) && ("camera" in node || "skin" in node),
		)
	);
}

function hasUnsupportedExtension(document: Record<string, unknown>): boolean {
	return ["extensionsRequired", "extensionsUsed"].some((field) =>
		arrayField(document, field).some(
			(extension) =>
				typeof extension !== "string" || !allowedExtensions.has(extension),
		),
	);
}

type TextureMemoryRisk = "MALFORMED_GLTF" | "MEMORY_BUDGET_RISK";

interface ImageDimensions {
	readonly height: number;
	readonly width: number;
}

/**
 * A compressed GLB byte count says little about decoded image memory. Inspect
 * only embedded image headers before GLTFLoader creates ImageBitmaps or GPU
 * textures, enforcing the portable-resource hard limits from the contract.
 */
function textureMemoryRiskFor(
	document: Record<string, unknown>,
	binaryChunk: Uint8Array | undefined,
): TextureMemoryRisk | undefined {
	const images = arrayField(document, "images");
	if (images.length === 0) return undefined;
	if (!binaryChunk) return "MALFORMED_GLTF";
	const bufferViews = arrayField(document, "bufferViews");
	let totalPixels = 0;
	for (const image of images) {
		if (!isRecord(image) || typeof image.bufferView !== "number") {
			return "MALFORMED_GLTF";
		}
		const source = bytesForBufferView(
			bufferViews[image.bufferView],
			binaryChunk,
		);
		if (!source) return "MALFORMED_GLTF";
		const dimensions = imageDimensionsFor(source);
		if (!dimensions) return "MALFORMED_GLTF";
		if (
			dimensions.width > MAXIMUM_TEXTURE_DIMENSION ||
			dimensions.height > MAXIMUM_TEXTURE_DIMENSION
		) {
			return "MEMORY_BUDGET_RISK";
		}
		totalPixels += dimensions.width * dimensions.height;
		if (totalPixels > MAXIMUM_DECODED_TEXTURE_PIXELS) {
			return "MEMORY_BUDGET_RISK";
		}
	}
	return undefined;
}

function bytesForBufferView(
	bufferView: unknown,
	binaryChunk: Uint8Array,
): Uint8Array | undefined {
	if (!isRecord(bufferView)) return undefined;
	const byteLength = bufferView.byteLength;
	const byteOffset = bufferView.byteOffset ?? 0;
	if (
		typeof byteLength !== "number" ||
		!Number.isInteger(byteLength) ||
		byteLength <= 0 ||
		typeof byteOffset !== "number" ||
		!Number.isInteger(byteOffset) ||
		byteOffset < 0 ||
		byteOffset + byteLength > binaryChunk.byteLength
	) {
		return undefined;
	}
	return binaryChunk.subarray(byteOffset, byteOffset + byteLength);
}

function imageDimensionsFor(bytes: Uint8Array): ImageDimensions | undefined {
	return pngDimensions(bytes) ?? jpegDimensions(bytes) ?? webpDimensions(bytes);
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | undefined {
	if (
		bytes.byteLength < 24 ||
		bytes[0] !== 0x89 ||
		bytes[1] !== 0x50 ||
		bytes[2] !== 0x4e ||
		bytes[3] !== 0x47 ||
		bytes[12] !== 0x49 ||
		bytes[13] !== 0x48 ||
		bytes[14] !== 0x44 ||
		bytes[15] !== 0x52
	) {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const width = view.getUint32(16);
	const height = view.getUint32(20);
	return width > 0 && height > 0 ? { height, width } : undefined;
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | undefined {
	if (bytes.byteLength < 9 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
		return undefined;
	}
	let offset = 2;
	while (offset < bytes.byteLength) {
		while (bytes[offset] === 0xff) offset += 1;
		const marker = bytes[offset];
		offset += 1;
		if (marker === undefined) return undefined;
		if (
			marker === 0xd8 ||
			marker === 0xd9 ||
			marker === 0x01 ||
			(marker >= 0xd0 && marker <= 0xd7)
		) {
			continue;
		}
		if (offset + 2 > bytes.byteLength) return undefined;
		const length = (bytes[offset] << 8) | bytes[offset + 1];
		if (length < 8 || offset + length > bytes.byteLength) return undefined;
		if (
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf)
		) {
			const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
			const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
			return width > 0 && height > 0 ? { height, width } : undefined;
		}
		offset += length;
	}
	return undefined;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | undefined {
	if (
		bytes.byteLength < 30 ||
		String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" ||
		String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP"
	) {
		return undefined;
	}
	const kind = String.fromCharCode(...bytes.subarray(12, 16));
	if (kind === "VP8X") {
		const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
		const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
		return { height, width };
	}
	if (
		kind === "VP8 " &&
		bytes.byteLength >= 30 &&
		bytes[23] === 0x9d &&
		bytes[24] === 0x01 &&
		bytes[25] === 0x2a
	) {
		const width = bytes[26] | ((bytes[27] & 0x3f) << 8);
		const height = bytes[28] | ((bytes[29] & 0x3f) << 8);
		return width > 0 && height > 0 ? { height, width } : undefined;
	}
	if (kind === "VP8L" && bytes.byteLength >= 25 && bytes[20] === 0x2f) {
		const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
		const height =
			1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
		return width > 0 && height > 0 ? { height, width } : undefined;
	}
	return undefined;
}

function primitiveCount(document: Record<string, unknown>): number {
	return arrayField(document, "meshes").reduce<number>(
		(count, mesh) =>
			count + (isRecord(mesh) ? arrayField(mesh, "primitives").length : 0),
		0,
	);
}

/**
 * File bytes are a poor proxy for mobile draw cost: a compact index buffer can
 * still describe far too many triangles. Count the static GLB declarations
 * before a browser decoder or GPU sees the model.
 */
function exceedsGeometryBudget(document: Record<string, unknown>): boolean {
	const accessors = arrayField(document, "accessors");
	const referencedPositionAccessors = new Set<number>();
	let triangles = 0;
	let vertices = 0;
	for (const mesh of arrayField(document, "meshes")) {
		if (!isRecord(mesh)) continue;
		for (const primitive of arrayField(mesh, "primitives")) {
			if (!isRecord(primitive)) continue;
			const positionAccessor = positionAccessorIndex(primitive, accessors);
			const positionCount =
				positionAccessor === undefined
					? 0
					: accessorCount(positionAccessor, accessors);
			if (
				positionAccessor !== undefined &&
				!referencedPositionAccessors.has(positionAccessor)
			) {
				referencedPositionAccessors.add(positionAccessor);
				vertices += positionCount;
			}
			triangles += triangleCountForPrimitive(
				primitive,
				accessors,
				positionCount,
			);
			if (vertices > MAXIMUM_VERTICES || triangles > MAXIMUM_TRIANGLES) {
				return true;
			}
		}
	}
	return false;
}

function positionAccessorIndex(
	primitive: Record<string, unknown>,
	accessors: readonly unknown[],
): number | undefined {
	const attributes = primitive.attributes;
	if (!isRecord(attributes)) return undefined;
	const positionAccessor = attributes.POSITION;
	return typeof positionAccessor === "number" &&
		Number.isInteger(positionAccessor) &&
		positionAccessor >= 0 &&
		positionAccessor < accessors.length
		? positionAccessor
		: undefined;
}

function triangleCountForPrimitive(
	primitive: Record<string, unknown>,
	accessors: readonly unknown[],
	positionCount: number,
): number {
	const elementCount =
		accessorCount(primitive.indices, accessors) || positionCount;
	const mode = typeof primitive.mode === "number" ? primitive.mode : 4;
	if (mode === 5 || mode === 6) return Math.max(0, elementCount - 2);
	return mode === 4 ? Math.floor(elementCount / 3) : 0;
}

function accessorCount(value: unknown, accessors: readonly unknown[]): number {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
		return 0;
	const accessor = accessors[value];
	if (!isRecord(accessor) || typeof accessor.count !== "number") return 0;
	return Number.isInteger(accessor.count) && accessor.count > 0
		? accessor.count
		: 0;
}

function arrayField(
	document: Record<string, unknown>,
	field: string,
): readonly unknown[] {
	const value = document[field];
	return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeUtf8(bytes: Uint8Array): string {
	const TextDecoderConstructor = (
		globalThis as typeof globalThis & {
			readonly TextDecoder?: new (
				label?: string,
				options?: { readonly fatal?: boolean },
			) => { decode(input?: Uint8Array): string };
		}
	).TextDecoder;
	if (!TextDecoderConstructor) {
		throw new Error("UTF-8 decoder is unavailable");
	}
	return new TextDecoderConstructor("utf-8", { fatal: true }).decode(bytes);
}

function reject(
	reasonCode: Extract<
		StaticGlbImportPreflight,
		{ readonly kind: "rejected" }
	>["reasonCode"],
): StaticGlbImportPreflight {
	return { kind: "rejected", reasonCode };
}
