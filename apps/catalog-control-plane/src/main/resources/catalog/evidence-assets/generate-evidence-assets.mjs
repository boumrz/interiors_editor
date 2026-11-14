import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputDirectory = resolve(process.argv[2] ?? new URL(".", import.meta.url).pathname);

const cubePositions = new Float32Array([
	-0.5, -0.5, -0.5,
	0.5, -0.5, -0.5,
	0.5, 0.5, -0.5,
	-0.5, 0.5, -0.5,
	-0.5, -0.5, 0.5,
	0.5, -0.5, 0.5,
	0.5, 0.5, 0.5,
	-0.5, 0.5, 0.5,
]);

const cubeIndices = new Uint16Array([
	0, 1, 2, 0, 2, 3,
	4, 6, 5, 4, 7, 6,
	0, 4, 5, 0, 5, 1,
	1, 5, 6, 1, 6, 2,
	2, 6, 7, 2, 7, 3,
	4, 0, 3, 4, 3, 7,
]);

/**
 * These four low-poly meshes are original, declarative evidence resources.
 * They deliberately use no texture, external URI, animation, skin, camera or
 * extension, so each is a static GLB accepted by StaticCatalogGlbProfile-1.
 */
const models = [
	{
		fileName: "evidence-bathroom-sink.glb",
		name: "Evidence bathroom sink",
		parts: [
			["basin", [0, 0.72, 0], [0.6, 0.48, 0.18]],
			["pedestal", [0, 0.35, 0], [0.25, 0.25, 0.7]],
			["tap", [0, 0.86, 0.16], [0.05, 0.1, 0.14]],
		],
	},
	{
		fileName: "evidence-countertop-appliance.glb",
		name: "Evidence countertop appliance",
		parts: [
			["body", [0, 0.16, 0], [0.55, 0.45, 0.32]],
			["lid", [0, 0.35, 0], [0.48, 0.38, 0.06]],
			["control", [0, 0.4, 0.2], [0.1, 0.04, 0.06]],
		],
	},
	{
		fileName: "evidence-floor-vase.glb",
		name: "Evidence floor vase",
		parts: [
			["body", [0, 0.225, 0], [0.2, 0.2, 0.45]],
			["rim", [0, 0.525, 0], [0.3, 0.3, 0.15]],
		],
	},
	{
		fileName: "evidence-wall-sconce.glb",
		name: "Evidence wall sconce",
		parts: [
			["backplate", [0, 0, 0], [0.22, 0.28, 0.02]],
			["shade", [0, 0, 0.09], [0.16, 0.14, 0.18]],
		],
	},
];

function padToFour(bytes) {
	const padding = (4 - (bytes.length % 4)) % 4;
	return padding === 0 ? bytes : Buffer.concat([bytes, Buffer.alloc(padding, 0x20)]);
}

function createGlb(model) {
	const binary = Buffer.alloc(cubePositions.byteLength + cubeIndices.byteLength);
	Buffer.from(cubePositions.buffer).copy(binary, 0);
	Buffer.from(cubeIndices.buffer).copy(binary, cubePositions.byteLength);

	const document = {
		asset: { generator: "InteriorsEditor readiness evidence", version: "2.0" },
		scene: 0,
		scenes: [{ name: model.name, nodes: model.parts.map((_, index) => index) }],
		nodes: model.parts.map(([name, translation, scale]) => ({
			mesh: 0,
			name,
			scale,
			translation,
		})),
		meshes: [
			{
				name: "Unit cube",
				primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }],
			},
		],
		buffers: [{ byteLength: binary.length }],
		bufferViews: [
			{ buffer: 0, byteLength: cubePositions.byteLength, byteOffset: 0, target: 34962 },
			{
				buffer: 0,
				byteLength: cubeIndices.byteLength,
				byteOffset: cubePositions.byteLength,
				target: 34963,
			},
		],
		accessors: [
			{
				bufferView: 0,
				componentType: 5126,
				count: 8,
				max: [0.5, 0.5, 0.5],
				min: [-0.5, -0.5, -0.5],
				type: "VEC3",
			},
			{
				bufferView: 1,
				componentType: 5123,
				count: 36,
				max: [7],
				min: [0],
				type: "SCALAR",
			},
		],
	};
	const json = padToFour(Buffer.from(JSON.stringify(document), "utf8"));
	const totalLength = 12 + 8 + json.length + 8 + binary.length;
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(totalLength, 8);
	const jsonHeader = Buffer.alloc(8);
	jsonHeader.writeUInt32LE(json.length, 0);
	jsonHeader.writeUInt32LE(0x4e4f534a, 4);
	const binaryHeader = Buffer.alloc(8);
	binaryHeader.writeUInt32LE(binary.length, 0);
	binaryHeader.writeUInt32LE(0x004e4942, 4);
	return Buffer.concat([header, jsonHeader, json, binaryHeader, binary]);
}

await mkdir(outputDirectory, { recursive: true });
for (const model of models) {
	await writeFile(resolve(outputDirectory, model.fileName), createGlb(model));
}
