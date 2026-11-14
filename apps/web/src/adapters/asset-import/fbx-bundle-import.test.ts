import { describe, expect, it } from "@rstest/core";

import {
	findFbxTextureSidecar,
	prepareFbxImportBundle,
} from "./fbx-bundle-import";

const binaryHeader = [
	0x4b, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61, 0x20, 0x46, 0x42, 0x58, 0x20,
	0x42, 0x69, 0x6e, 0x61, 0x72, 0x79, 0x20, 0x20, 0x00, 0x1a, 0x00,
] as const;

function binaryFbx(): Uint8Array {
	const bytes = new Uint8Array(binaryHeader.length + 4);
	bytes.set(binaryHeader);
	new DataView(bytes.buffer).setUint32(binaryHeader.length, 7400, true);
	return bytes;
}

/** A deliberately uncompressed ZIP fixture: enough to represent Sketchfab's file layout. */
function storedZip(entries: Readonly<Record<string, Uint8Array>>): Uint8Array {
	const encoder = new TextEncoder();
	const localParts: Uint8Array[] = [];
	const directoryParts: Uint8Array[] = [];
	let offset = 0;
	for (const [name, bytes] of Object.entries(entries)) {
		const nameBytes = encoder.encode(name);
		const local = new Uint8Array(30 + nameBytes.byteLength + bytes.byteLength);
		const localView = new DataView(local.buffer);
		localView.setUint32(0, 0x04034b50, true);
		localView.setUint16(4, 20, true);
		localView.setUint16(8, 0, true);
		localView.setUint32(18, bytes.byteLength, true);
		localView.setUint32(22, bytes.byteLength, true);
		localView.setUint16(26, nameBytes.byteLength, true);
		local.set(nameBytes, 30);
		local.set(bytes, 30 + nameBytes.byteLength);
		localParts.push(local);

		const directory = new Uint8Array(46 + nameBytes.byteLength);
		const directoryView = new DataView(directory.buffer);
		directoryView.setUint32(0, 0x02014b50, true);
		directoryView.setUint16(4, 20, true);
		directoryView.setUint16(6, 20, true);
		directoryView.setUint16(10, 0, true);
		directoryView.setUint32(20, bytes.byteLength, true);
		directoryView.setUint32(24, bytes.byteLength, true);
		directoryView.setUint16(28, nameBytes.byteLength, true);
		directoryView.setUint32(42, offset, true);
		directory.set(nameBytes, 46);
		directoryParts.push(directory);
		offset += local.byteLength;
	}
	const directoryLength = directoryParts.reduce((total, part) => total + part.byteLength, 0);
	const footer = new Uint8Array(22);
	const footerView = new DataView(footer.buffer);
	footerView.setUint32(0, 0x06054b50, true);
	footerView.setUint16(8, directoryParts.length, true);
	footerView.setUint16(10, directoryParts.length, true);
	footerView.setUint32(12, directoryLength, true);
	footerView.setUint32(16, offset, true);
	const output = new Uint8Array(offset + directoryLength + footer.byteLength);
	let nextOffset = 0;
	for (const part of [...localParts, ...directoryParts, footer]) {
		output.set(part, nextOffset);
		nextOffset += part.byteLength;
	}
	return output;
}

describe("Sketchfab FBX bundle import", () => {
	it("opens a ZIP with an FBX and textures, even when the archive's names differ cosmetically from FBX references", () => {
		const result = prepareFbxImportBundle([
			{
				bytes: storedZip({
					"source/ChairWhite (_Blend) 1K.fbx": binaryFbx(),
					"textures/MainPillow_1K-BaseColor.jpg.jpeg": new Uint8Array([1]),
					"textures/MainPillow_1K-NormalGL.jpeg": new Uint8Array([2]),
					"textures/Pillow_1K-BaseColor.jpg.jpeg": new Uint8Array([3]),
					"textures/Wood_1K-BaseColor.jpg.jpeg": new Uint8Array([4]),
				}),
				name: "white-armchair-fbx-1k-9mb.zip",
			},
		]);

		expect(result).toMatchObject({
			fbxFilename: "source/ChairWhite (_Blend) 1K.fbx",
			kind: "accepted",
			sidecarResources: [
				{ name: "textures/MainPillow_1K-BaseColor.jpg.jpeg" },
				{ name: "textures/MainPillow_1K-NormalGL.jpeg" },
				{ name: "textures/Pillow_1K-BaseColor.jpg.jpeg" },
				{ name: "textures/Wood_1K-BaseColor.jpg.jpeg" },
			],
		});
		if (result.kind !== "accepted") return;

		expect(
			findFbxTextureSidecar(
				result.sidecarResources,
				"ChairWhite (.Blend) 1K.fbm/Wood_1K-BaseColor.jpg.jpg",
			)?.name,
		).toBe("textures/Wood_1K-BaseColor.jpg.jpeg");
		expect(
			findFbxTextureSidecar(
				result.sidecarResources,
				"ChairWhite (.Blend) 1K.fbm/MainPillow-NormalGL(\n).jpg.jpg",
			)?.name,
		).toBe("textures/MainPillow_1K-NormalGL.jpeg");
	});

	it("does not guess between two equally plausible texture files", () => {
		const matchingTextures = [
			{ bytes: new Uint8Array([1]), mimeType: "image/jpeg" as const, name: "wood_1k.jpg" },
			{ bytes: new Uint8Array([2]), mimeType: "image/jpeg" as const, name: "wood_2k.jpg" },
		];

		expect(findFbxTextureSidecar(matchingTextures, "wood.jpg")).toBeUndefined();
	});

	it("recognises the standard BaseMap and BaseColor aliases without matching an unrelated texture", () => {
		const textures = [
			{
				bytes: new Uint8Array([1]),
				mimeType: "image/png" as const,
				name: "textures/sofa-lp_Material.001_BaseColor.png",
			},
			{
				bytes: new Uint8Array([2]),
				mimeType: "image/png" as const,
				name: "textures/sofa-lp_Material.001_Normal.png",
			},
		];

		expect(
			findFbxTextureSidecar(
				textures,
				"H:\\syn\\props\\sofa\\export\\sofa-lp_Material.001_BaseMap.png",
			)?.name,
		).toBe("textures/sofa-lp_Material.001_BaseColor.png");
	});
});
