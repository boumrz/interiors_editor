import { unzlibSync } from "fflate";

import { preflightStaticGlbImport } from "../../domain/static-glb-import";

const pngSignature = Uint8Array.of(
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a,
);
const crcTable = buildCrcTable();

export type CatalogMediaValidation =
	| { readonly kind: "accepted" }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "CATALOG_RESOURCE_MEDIA_INVALID"
				| "GLB_VERSION_INVALID"
				| "PNG_CRC_INVALID";
	  };

export function validateCatalogMedia(
	mediaType: "image/png" | "model/gltf-binary",
	bytes: Uint8Array,
): CatalogMediaValidation {
	if (mediaType === "image/png") return validatePng(bytes);
	if (
		bytes.byteLength >= 8 &&
		readUint32(bytes, 0, true) === 0x46546c67 &&
		readUint32(bytes, 4, true) !== 2
	) {
		return rejected("GLB_VERSION_INVALID");
	}
	return preflightStaticGlbImport(bytes).kind === "accepted"
		? { kind: "accepted" }
		: rejected("CATALOG_RESOURCE_MEDIA_INVALID");
}

function validatePng(bytes: Uint8Array): CatalogMediaValidation {
	if (
		bytes.byteLength < 45 ||
		!equalBytes(bytes.subarray(0, 8), pngSignature)
	) {
		return rejected("CATALOG_RESOURCE_MEDIA_INVALID");
	}
	let offset = 8;
	let width = 0;
	let height = 0;
	let channels = 0;
	let ihdrCount = 0;
	let iendCount = 0;
	const idatChunks: Uint8Array[] = [];
	while (offset < bytes.byteLength) {
		if (bytes.byteLength - offset < 12) return mediaInvalid();
		const length = readUint32(bytes, offset);
		const dataOffset = offset + 8;
		const crcOffset = dataOffset + length;
		const endOffset = crcOffset + 4;
		if (endOffset > bytes.byteLength) return mediaInvalid();
		const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
		if (
			crc32(bytes.subarray(offset + 4, crcOffset)) !==
			readUint32(bytes, crcOffset)
		) {
			return rejected("PNG_CRC_INVALID");
		}
		if (type === "IHDR") {
			ihdrCount += 1;
			if (offset !== 8 || length !== 13 || ihdrCount !== 1)
				return mediaInvalid();
			width = readUint32(bytes, dataOffset);
			height = readUint32(bytes, dataOffset + 4);
			const bitDepth = bytes[dataOffset + 8];
			const colorType = bytes[dataOffset + 9];
			channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
			if (
				width < 1 ||
				width > 512 ||
				height < 1 ||
				height > 512 ||
				width * height * 4 > 1_048_576 ||
				bitDepth !== 8 ||
				channels === 0 ||
				bytes[dataOffset + 10] !== 0 ||
				bytes[dataOffset + 11] !== 0 ||
				bytes[dataOffset + 12] !== 0
			) {
				return mediaInvalid();
			}
		} else if (type === "IDAT") {
			if (ihdrCount !== 1 || iendCount !== 0) return mediaInvalid();
			idatChunks.push(bytes.slice(dataOffset, crcOffset));
		} else if (type === "IEND") {
			iendCount += 1;
			if (
				length !== 0 ||
				ihdrCount !== 1 ||
				idatChunks.length === 0 ||
				iendCount !== 1 ||
				endOffset !== bytes.byteLength
			) {
				return mediaInvalid();
			}
		}
		offset = endOffset;
	}
	if (ihdrCount !== 1 || idatChunks.length === 0 || iendCount !== 1) {
		return mediaInvalid();
	}
	const rowLength = 1 + width * channels;
	const expectedLength = height * rowLength;
	try {
		const inflated = unzlibSync(concatenate(idatChunks));
		if (inflated.byteLength !== expectedLength) return mediaInvalid();
		for (let row = 0; row < height; row += 1) {
			const filter = inflated[row * rowLength];
			if (filter === undefined || filter > 4) return mediaInvalid();
		}
	} catch {
		return mediaInvalid();
	}
	return { kind: "accepted" };
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
	const output = new Uint8Array(
		chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
	);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
	return (
		left.byteLength === right.byteLength &&
		left.every((byte, index) => byte === right[index])
	);
}

function readUint32(
	bytes: Uint8Array,
	offset: number,
	littleEndian = false,
): number {
	return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(
		0,
		littleEndian,
	);
}

function buildCrcTable(): Uint32Array {
	const table = new Uint32Array(256);
	for (let index = 0; index < table.length; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) {
			value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[index] = value >>> 0;
	}
	return table;
}

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function mediaInvalid(): CatalogMediaValidation {
	return rejected("CATALOG_RESOURCE_MEDIA_INVALID");
}

function rejected(
	reasonCode: Extract<
		CatalogMediaValidation,
		{ kind: "rejected" }
	>["reasonCode"],
): CatalogMediaValidation {
	return { kind: "rejected", reasonCode };
}
