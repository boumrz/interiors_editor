import { describe, expect, it } from "@rstest/core";
import { zlibSync } from "fflate";

import mediaCases from "../../../../../contracts/catalog-control-plane/fixtures/media-cases.json" with {
	type: "json",
};
import { validateCatalogMedia } from "./catalog-media-validator";

describe("catalog media contract", () => {
	it("executes every shared media-profile fixture", () => {
		for (const mediaCase of mediaCases.cases) {
			const bytes = Uint8Array.from(atob(mediaCase.base64), (character) =>
				character.charCodeAt(0),
			);
			const mediaType = mediaCase.profile.startsWith("CatalogThumbnail")
				? "image/png"
				: "model/gltf-binary";

			const result = validateCatalogMedia(mediaType, bytes);

			if (mediaCase.outcome === "accepted") {
				expect(result, mediaCase.id).toEqual({ kind: "accepted" });
			} else {
				expect(result, mediaCase.id).toEqual({
					kind: "rejected",
					reasonCode: mediaCase.reasonCode,
				});
			}
		}
	});

	it("enforces the bounded PNG structure and scanline profile", () => {
		for (const bytes of [
			png({ width: 0 }),
			png({ width: 513 }),
			png({ height: 0 }),
			png({ height: 513 }),
			png({ bitDepth: 16 }),
			png({ colorType: 1 }),
			png({ compression: 1 }),
			png({ filterMethod: 1 }),
			png({ interlace: 1 }),
			png({ raw: Uint8Array.of(0) }),
			png({ raw: Uint8Array.of(5, 0, 0, 0, 0) }),
			png({ omitIdat: true }),
			png({ omitIend: true }),
			png({ trailing: Uint8Array.of(0) }),
			png({ duplicateIhdr: true }),
			png({ idatBeforeIhdr: true }),
			Uint8Array.of(),
			Uint8Array.of(0x89, 0x50, 0x4e),
		]) {
			expect(validateCatalogMedia("image/png", bytes).kind).toBe("rejected");
		}

		expect(validateCatalogMedia("image/png", png({}))).toEqual({
			kind: "accepted",
		});
		expect(
			validateCatalogMedia(
				"image/png",
				png({
					ancillary: true,
					colorType: 2,
					raw: Uint8Array.of(4, 0, 0, 0),
				}),
			),
		).toEqual({ kind: "accepted" });
	});

	it("keeps GLB version diagnostics distinct from other malformed input", () => {
		const valid = decodeBase64(
			mediaCases.cases.find(({ id }) => id === "glb-minimal-static-v2")
				?.base64 ?? "",
		);
		const wrongMagic = valid.slice();
		wrongMagic[0] = 0;
		wrongMagic[4] = 1;
		const wrongLength = valid.slice();
		wrongLength[8] = 0;
		const invalidJson = valid.slice();
		invalidJson[20] = 0xff;

		for (const bytes of [
			valid.subarray(0, 19),
			wrongMagic,
			wrongLength,
			invalidJson,
		]) {
			expect(validateCatalogMedia("model/gltf-binary", bytes)).toEqual({
				kind: "rejected",
				reasonCode: "CATALOG_RESOURCE_MEDIA_INVALID",
			});
		}
	});
});

interface PngOptions {
	readonly ancillary?: boolean;
	readonly bitDepth?: number;
	readonly colorType?: number;
	readonly compression?: number;
	readonly duplicateIhdr?: boolean;
	readonly filterMethod?: number;
	readonly height?: number;
	readonly idatBeforeIhdr?: boolean;
	readonly interlace?: number;
	readonly omitIdat?: boolean;
	readonly omitIend?: boolean;
	readonly raw?: Uint8Array;
	readonly trailing?: Uint8Array;
	readonly width?: number;
}

function png(options: PngOptions): Uint8Array {
	const ihdr = new Uint8Array(13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, options.width ?? 1);
	view.setUint32(4, options.height ?? 1);
	ihdr[8] = options.bitDepth ?? 8;
	ihdr[9] = options.colorType ?? 6;
	ihdr[10] = options.compression ?? 0;
	ihdr[11] = options.filterMethod ?? 0;
	ihdr[12] = options.interlace ?? 0;
	const ihdrChunk = pngChunk("IHDR", ihdr);
	const idatChunk = pngChunk(
		"IDAT",
		zlibSync(options.raw ?? Uint8Array.of(0, 0, 0, 0, 0)),
	);
	const chunks = [
		pngSignature,
		...(options.idatBeforeIhdr ? [idatChunk] : []),
		ihdrChunk,
		...(options.duplicateIhdr ? [ihdrChunk] : []),
		...(options.ancillary ? [pngChunk("tEXt", Uint8Array.of(0))] : []),
		...(!options.omitIdat && !options.idatBeforeIhdr ? [idatChunk] : []),
		...(options.omitIend ? [] : [pngChunk("IEND", Uint8Array.of())]),
		...(options.trailing ? [options.trailing] : []),
	];
	return concatenate(chunks);
}

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
const testCrcTable = buildCrcTable();

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = new TextEncoder().encode(type);
	const output = new Uint8Array(12 + data.byteLength);
	const view = new DataView(output.buffer);
	view.setUint32(0, data.byteLength);
	output.set(typeBytes, 4);
	output.set(data, 8);
	view.setUint32(8 + data.byteLength, crc32(concatenate([typeBytes, data])));
	return output;
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
	for (const byte of bytes)
		crc = (crc >>> 8) ^ (testCrcTable[(crc ^ byte) & 0xff] ?? 0);
	return (crc ^ 0xffffffff) >>> 0;
}

function decodeBase64(value: string): Uint8Array {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
