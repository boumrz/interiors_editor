import { describe, expect, it } from "@rstest/core";

import {
	createStaticGlbResourcePreflight,
	preflightStaticGlbImport,
} from "./static-glb-import";

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BINARY_CHUNK_TYPE = 0x004e4942;
const MAXIMUM_GLB_INPUT_BYTES = 25 * 1024 * 1024;

function staticGlb(
	document: Record<string, unknown> = {
		asset: { version: "2.0" },
		buffers: [{ byteLength: 0 }],
		scenes: [{ nodes: [] }],
	},
	binary: number | Uint8Array = 0,
): Uint8Array {
	const json = new Uint8Array(
		[...JSON.stringify(document)].map((character) => character.charCodeAt(0)),
	);
	const jsonLength = Math.ceil(json.byteLength / 4) * 4;
	const binaryByteLength =
		typeof binary === "number" ? binary : binary.byteLength;
	const hasBinaryChunk = binaryByteLength > 0;
	const totalLength =
		12 + 8 + jsonLength + (hasBinaryChunk ? 8 + binaryByteLength : 0);
	const bytes = new Uint8Array(totalLength);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, GLB_MAGIC, true);
	view.setUint32(4, GLB_VERSION, true);
	view.setUint32(8, totalLength, true);
	view.setUint32(12, jsonLength, true);
	view.setUint32(16, JSON_CHUNK_TYPE, true);
	bytes.set(json, 20);
	bytes.fill(0x20, 20 + json.byteLength, 20 + jsonLength);
	if (hasBinaryChunk) {
		const binaryOffset = 20 + jsonLength;
		view.setUint32(binaryOffset, binaryByteLength, true);
		view.setUint32(binaryOffset + 4, BINARY_CHUNK_TYPE, true);
		if (binary instanceof Uint8Array) {
			bytes.set(binary, binaryOffset + 8);
		}
	}
	return bytes;
}

function pngHeader(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(24);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	bytes.set([0x49, 0x48, 0x44, 0x52], 12);
	const view = new DataView(bytes.buffer);
	view.setUint32(16, width);
	view.setUint32(20, height);
	return bytes;
}

function jpegHeader(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array([
		0xff,
		0xd8,
		0xff,
		0xc0,
		0,
		8,
		8,
		(height >>> 8) & 0xff,
		height & 0xff,
		(width >>> 8) & 0xff,
		width & 0xff,
		0,
	]);
	return bytes;
}

function webpVp8xHeader(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(32);
	bytes.set([0x52, 0x49, 0x46, 0x46]);
	bytes.set([0x57, 0x45, 0x42, 0x50], 8);
	bytes.set([0x56, 0x50, 0x38, 0x58], 12);
	const encodedWidth = width - 1;
	const encodedHeight = height - 1;
	bytes.set(
		[
			encodedWidth & 0xff,
			(encodedWidth >>> 8) & 0xff,
			(encodedWidth >>> 16) & 0xff,
		],
		24,
	);
	bytes.set(
		[
			encodedHeight & 0xff,
			(encodedHeight >>> 8) & 0xff,
			(encodedHeight >>> 16) & 0xff,
		],
		27,
	);
	return bytes;
}

function staticGlbWithEmbeddedImage(
	bytes: Uint8Array,
	mimeType: "image/jpeg" | "image/png" | "image/webp",
): Uint8Array {
	return staticGlb(
		{
			asset: { version: "2.0" },
			bufferViews: [{ byteLength: bytes.byteLength, byteOffset: 0 }],
			buffers: [{ byteLength: bytes.byteLength }],
			images: [{ bufferView: 0, mimeType }],
			scenes: [{ nodes: [] }],
			textures: [{ source: 0 }],
		},
		bytes,
	);
}

function staticGlbWithPngTextures(
	dimensions: readonly { readonly height: number; readonly width: number }[],
): Uint8Array {
	const headers = dimensions.map(({ height, width }) =>
		pngHeader(width, height),
	);
	const binary = new Uint8Array(headers.length * 24);
	headers.forEach((header, index) => {
		binary.set(header, index * 24);
	});
	return staticGlb(
		{
			asset: { version: "2.0" },
			bufferViews: headers.map((header, index) => ({
				byteLength: header.byteLength,
				byteOffset: index * header.byteLength,
			})),
			buffers: [{ byteLength: binary.byteLength }],
			images: headers.map((_, index) => ({
				bufferView: index,
				mimeType: "image/png",
			})),
			scenes: [{ nodes: [] }],
			textures: headers.map((_, index) => ({ source: index })),
		},
		binary,
	);
}

describe("preflightStaticGlbImport", () => {
	it("accepts a bounded self-contained static GLB and exposes only safe summary metadata", () => {
		const result = preflightStaticGlbImport(
			staticGlb({
				asset: { generator: "Blender", version: "2.0" },
				buffers: [{ byteLength: 0 }],
				materials: [{}],
				meshes: [{ primitives: [{}] }],
				nodes: [{ mesh: 0 }],
				scenes: [{ nodes: [0] }],
			}),
		);

		expect(result).toEqual({
			inputBytes: 192,
			kind: "accepted",
			materialCount: 1,
			meshCount: 1,
			nodeCount: 1,
			textureCount: 0,
		});
	});

	it("accepts a GLB exactly at the durable resource byte limit", () => {
		const document = {
			asset: { version: "2.0" },
			buffers: [{ byteLength: MAXIMUM_GLB_INPUT_BYTES - 128 }],
			scenes: [{ nodes: [] }],
		};
		const minimumGlbWithBinaryChunk = staticGlb(document, 4);
		const result = preflightStaticGlbImport(
			staticGlb(
				document,
				MAXIMUM_GLB_INPUT_BYTES - minimumGlbWithBinaryChunk.byteLength + 4,
			),
		);

		expect(result.kind).toBe("accepted");
		if (result.kind === "accepted") {
			expect(result.inputBytes).toBe(MAXIMUM_GLB_INPUT_BYTES);
		}
	});

	it("rejects a byte stream above the durable resource budget before parsing it", () => {
		expect(
			preflightStaticGlbImport(new Uint8Array(MAXIMUM_GLB_INPUT_BYTES + 1)),
		).toEqual({ kind: "rejected", reasonCode: "GLB_FILE_BYTES_LIMIT" });
	});

	it("rejects a GLB whose declared length or JSON chunk is malformed", () => {
		const corrupted = staticGlb();
		new DataView(corrupted.buffer).setUint32(8, corrupted.byteLength - 4, true);

		expect(preflightStaticGlbImport(corrupted)).toEqual({
			kind: "rejected",
			reasonCode: "MALFORMED_GLTF",
		});
	});

	it("rejects external resource URIs even when the enclosing file has a valid GLB header", () => {
		expect(
			preflightStaticGlbImport(
				staticGlb({
					asset: { version: "2.0" },
					buffers: [{ byteLength: 64, uri: "scene.bin" }],
					scenes: [{ nodes: [] }],
				}),
			),
		).toEqual({ kind: "rejected", reasonCode: "EXTERNAL_RESOURCE" });
	});

	it("rejects animation, skin and cameras rather than silently dropping their meaning", () => {
		expect(
			preflightStaticGlbImport(
				staticGlb({
					animations: [{}],
					asset: { version: "2.0" },
					buffers: [{ byteLength: 0 }],
					cameras: [{}],
					nodes: [{ camera: 0, skin: 0 }],
					scenes: [{ nodes: [0] }],
					skins: [{}],
				}),
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "ANIMATION_OR_SKIN_UNSUPPORTED",
		});
	});

	it("rejects an unknown required extension while allowing the explicit static material allowlist", () => {
		expect(
			preflightStaticGlbImport(
				staticGlb({
					asset: { version: "2.0" },
					buffers: [{ byteLength: 0 }],
					extensionsRequired: ["EXT_untrusted_scene_behavior"],
					scenes: [{ nodes: [] }],
				}),
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "UNSUPPORTED_REQUIRED_EXTENSION",
		});
	});

	it("keeps declared static-scene complexity inside the mobile geometry and texture budgets", () => {
		expect(
			preflightStaticGlbImport(
				staticGlb({
					asset: { version: "2.0" },
					buffers: [{ byteLength: 0 }],
					meshes: [{ primitives: Array.from({ length: 129 }, () => ({})) }],
					scenes: [{ nodes: [] }],
				}),
			),
		).toEqual({ kind: "rejected", reasonCode: "DECODED_GEOMETRY_LIMIT" });

		expect(
			preflightStaticGlbImport(
				staticGlb({
					asset: { version: "2.0" },
					buffers: [{ byteLength: 0 }],
					scenes: [{ nodes: [] }],
					textures: Array.from({ length: 17 }, () => ({})),
				}),
			),
		).toEqual({ kind: "rejected", reasonCode: "TEXTURE_LIMIT" });
	});

	it("admits the exact decoded texture-pixel boundary but rejects unsafe image dimensions and totals", () => {
		const atTotalPixelLimit = staticGlbWithPngTextures(
			Array.from({ length: 12 }, () => ({ height: 2000, width: 2000 })),
		);
		const onePixelOverTotalLimit = staticGlbWithPngTextures([
			...Array.from({ length: 12 }, () => ({ height: 2000, width: 2000 })),
			{ height: 1, width: 1 },
		]);

		expect(preflightStaticGlbImport(atTotalPixelLimit).kind).toBe("accepted");
		expect(
			preflightStaticGlbImport(
				staticGlbWithPngTextures([{ height: 1, width: 4096 }]),
			),
		).toMatchObject({ kind: "accepted" });
		expect(
			preflightStaticGlbImport(
				staticGlbWithPngTextures([{ height: 1, width: 4097 }]),
			),
		).toEqual({ kind: "rejected", reasonCode: "MEMORY_BUDGET_RISK" });
		expect(preflightStaticGlbImport(onePixelOverTotalLimit)).toEqual({
			kind: "rejected",
			reasonCode: "MEMORY_BUDGET_RISK",
		});
	});

	it("uses JPEG and WebP headers too, instead of allowing a large compressed texture through", () => {
		expect(
			preflightStaticGlbImport(
				staticGlbWithEmbeddedImage(jpegHeader(1, 4097), "image/jpeg"),
			),
		).toEqual({ kind: "rejected", reasonCode: "MEMORY_BUDGET_RISK" });
		expect(
			preflightStaticGlbImport(
				staticGlbWithEmbeddedImage(webpVp8xHeader(4097, 1), "image/webp"),
			),
		).toEqual({ kind: "rejected", reasonCode: "MEMORY_BUDGET_RISK" });
	});

	it("rejects a model that would exceed the mobile triangle budget while retaining the exact boundary", () => {
		const atTriangleLimit = staticGlb({
			accessors: [{ count: 3 }, { count: 750_000 }],
			asset: { version: "2.0" },
			buffers: [{ byteLength: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
			scenes: [{ nodes: [] }],
		});
		const overTriangleLimit = staticGlb({
			accessors: [{ count: 3 }, { count: 750_003 }],
			asset: { version: "2.0" },
			buffers: [{ byteLength: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
			scenes: [{ nodes: [] }],
		});

		expect(preflightStaticGlbImport(atTriangleLimit).kind).toBe("accepted");
		expect(preflightStaticGlbImport(overTriangleLimit)).toEqual({
			kind: "rejected",
			reasonCode: "DECODED_GEOMETRY_LIMIT",
		});
	});

	it("retains the exact vertex boundary before rejecting a model with one excess vertex", () => {
		const atVertexLimit = staticGlb({
			accessors: [{ count: 300_000 }],
			asset: { version: "2.0" },
			buffers: [{ byteLength: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
			scenes: [{ nodes: [] }],
		});
		const overVertexLimit = staticGlb({
			accessors: [{ count: 300_001 }],
			asset: { version: "2.0" },
			buffers: [{ byteLength: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
			scenes: [{ nodes: [] }],
		});

		expect(preflightStaticGlbImport(atVertexLimit).kind).toBe("accepted");
		expect(preflightStaticGlbImport(overVertexLimit)).toEqual({
			kind: "rejected",
			reasonCode: "DECODED_GEOMETRY_LIMIT",
		});
	});

	it("counts a shared position accessor once when several material primitives reuse one mesh", () => {
		const result = preflightStaticGlbImport(
			staticGlb({
				accessors: [
					{ count: 100_000 },
					{ count: 3 },
					{ count: 3 },
					{ count: 3 },
					{ count: 3 },
				],
				asset: { version: "2.0" },
				buffers: [{ byteLength: 0 }],
				meshes: [
					{
						primitives: [
							{ attributes: { POSITION: 0 }, indices: 1 },
							{ attributes: { POSITION: 0 }, indices: 2 },
							{ attributes: { POSITION: 0 }, indices: 3 },
							{ attributes: { POSITION: 0 }, indices: 4 },
						],
					},
				],
				scenes: [{ nodes: [] }],
			}),
		);

		expect(result.kind).toBe("accepted");
	});
});

function paddedStaticGlb(totalBytes: number): Uint8Array {
	if (totalBytes % 4) throw new Error("A valid GLB must be four-byte aligned");
	let binaryBytes = totalBytes - 128;
	for (let attempt = 0; attempt < 3; attempt++) {
		const document = {
			asset: { version: "2.0" },
			buffers: [{ byteLength: binaryBytes }],
			scenes: [{ nodes: [] }],
		};
		const minimum = staticGlb(document, 4);
		const next = totalBytes - minimum.byteLength + 4;
		if (next === binaryBytes) return staticGlb(document, binaryBytes);
		binaryBytes = next;
	}
	throw new Error("Expected stable padded GLB size");
}

describe.sequential("explicit bounded portable GLB preflight", () => {
	it("captures only a positive safe byte maximum within the existing 50 MiB portable ceiling", () => {
		for (const maximumInputBytes of [
			0,
			-1,
			1.5,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			50 * 1024 * 1024 + 1,
		]) {
			expect(() =>
				createStaticGlbResourcePreflight({ maximumInputBytes }),
			).toThrow(RangeError);
		}
		const policy = { maximumInputBytes: 25 * 1024 * 1024 };
		const preflight = createStaticGlbResourcePreflight(policy);
		policy.maximumInputBytes = 50 * 1024 * 1024;
		expect(preflight(new Uint8Array(25 * 1024 * 1024 + 1))).toEqual({
			kind: "rejected",
			reasonCode: "GLB_FILE_BYTES_LIMIT",
		});
	});
	it("keeps the default 25 MiB limit while technically checking valid aligned portable GLBs up to exactly 50 MiB", () => {
		const portable = createStaticGlbResourcePreflight({
			maximumInputBytes: 50 * 1024 * 1024,
		});
		for (const inputBytes of [
			25 * 1024 * 1024,
			25 * 1024 * 1024 + 4,
			50 * 1024 * 1024,
		]) {
			const bytes = paddedStaticGlb(inputBytes);
			expect(bytes.byteLength).toBe(inputBytes);
			expect(portable(bytes)).toMatchObject({ kind: "accepted", inputBytes });
			expect(preflightStaticGlbImport(bytes).kind).toBe(
				inputBytes <= 25 * 1024 * 1024 ? "accepted" : "rejected",
			);
		}
	});
	it("applies both +1 byte guards before malformed-header parsing", () => {
		for (const maximumInputBytes of [25 * 1024 * 1024, 50 * 1024 * 1024]) {
			const preflight = createStaticGlbResourcePreflight({ maximumInputBytes });
			expect(preflight(new Uint8Array(maximumInputBytes + 1))).toEqual({
				kind: "rejected",
				reasonCode: "GLB_FILE_BYTES_LIMIT",
			});
		}
	});
	it("shares every existing static/security guard and its precedence across default, explicit 25 and portable 50 policies", () => {
		const portable = createStaticGlbResourcePreflight({
			maximumInputBytes: 50 * 1024 * 1024,
		});
		const strict = createStaticGlbResourcePreflight({
			maximumInputBytes: 25 * 1024 * 1024,
		});
		const cases = [
			{
				bytes: staticGlb({ asset: { version: "3.0" } }),
				reasonCode: "MALFORMED_GLTF",
			},
			{
				bytes: staticGlb({
					asset: { version: "2.0" },
					buffers: [{ uri: "scene.bin" }],
					animations: [],
				}),
				reasonCode: "EXTERNAL_RESOURCE",
			},
			{
				bytes: staticGlb({
					asset: { version: "2.0" },
					images: [{ uri: "data:image/png;base64,AAAA" }],
				}),
				reasonCode: "EXTERNAL_RESOURCE",
			},
			...["animations", "skins", "cameras"].map((field) => ({
				bytes: staticGlb({ asset: { version: "2.0" }, [field]: [] }),
				reasonCode: "ANIMATION_OR_SKIN_UNSUPPORTED",
			})),
			{
				bytes: staticGlb({ asset: { version: "2.0" }, nodes: [{ skin: 0 }] }),
				reasonCode: "ANIMATION_OR_SKIN_UNSUPPORTED",
			},
			{
				bytes: staticGlb({
					asset: { version: "2.0" },
					extensionsRequired: ["EXT_untrusted"],
				}),
				reasonCode: "UNSUPPORTED_REQUIRED_EXTENSION",
			},
			{
				bytes: staticGlb({
					asset: { version: "2.0" },
					extensionsUsed: ["EXT_untrusted"],
				}),
				reasonCode: "UNSUPPORTED_REQUIRED_EXTENSION",
			},
			{
				bytes: staticGlb({
					asset: { version: "2.0" },
					nodes: Array.from({ length: 257 }, () => ({})),
				}),
				reasonCode: "DECODED_GEOMETRY_LIMIT",
			},
			{
				bytes: staticGlb({
					asset: { version: "2.0" },
					meshes: [{ primitives: Array.from({ length: 129 }, () => ({})) }],
				}),
				reasonCode: "DECODED_GEOMETRY_LIMIT",
			},
			{
				bytes: staticGlb({
					asset: { version: "2.0" },
					materials: Array.from({ length: 33 }, () => ({})),
				}),
				reasonCode: "TEXTURE_LIMIT",
			},
			{
				bytes: staticGlb({
					asset: { version: "2.0" },
					textures: Array.from({ length: 17 }, () => ({})),
				}),
				reasonCode: "TEXTURE_LIMIT",
			},
			{
				bytes: staticGlbWithEmbeddedImage(pngHeader(4097, 1), "image/png"),
				reasonCode: "MEMORY_BUDGET_RISK",
			},
			{ bytes: Uint8Array.of(1, 2, 3), reasonCode: "MALFORMED_GLTF" },
		];
		for (const { bytes, reasonCode } of cases) {
			const before = bytes.slice();
			for (const preflight of [preflightStaticGlbImport, strict, portable])
				expect(preflight(bytes)).toEqual({ kind: "rejected", reasonCode });
			expect(bytes).toEqual(before);
		}
		const allowed = staticGlb({
			asset: { version: "2.0" },
			extensionsUsed: ["KHR_materials_unlit", "KHR_texture_transform"],
		});
		expect(portable(allowed).kind).toBe("accepted");
		expect(portable(allowed)).toEqual(preflightStaticGlbImport(allowed));
	});

	it("retains the exact existing node, primitive, material and texture count boundaries", () => {
		const portable = createStaticGlbResourcePreflight({
			maximumInputBytes: 50 * 1024 * 1024,
		});
		for (const extra of [
			{ nodes: Array.from({ length: 256 }, () => ({})) },
			{ meshes: [{ primitives: Array.from({ length: 128 }, () => ({})) }] },
			{ materials: Array.from({ length: 32 }, () => ({})) },
			{ textures: Array.from({ length: 16 }, () => ({})) },
		]) {
			const bytes = staticGlb({ asset: { version: "2.0" }, ...extra });
			expect(portable(bytes).kind).toBe("accepted");
			expect(preflightStaticGlbImport(bytes).kind).toBe("accepted");
		}
	});
});
