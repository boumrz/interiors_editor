import { describe, expect, it } from "@rstest/core";

import {
	measuredDimensionsMmForGlbBounds,
	sourceMetreScaleForGlb,
} from "./glb-source-scale";

const centimetreSketchfabTransform = [
	100, 0, 0, 0,
	0, 0, -100, 0,
	0, 100, 0, 0,
	0, 0, 0, 1,
];

const rotatedCentimetreSketchfabTransform = [
	36, 48, 80, 0,
	73.76, 38.32, -56.2, 0,
	-57.632, 79.24, -21.61, 0,
	0, 0, 0, 1,
];

function sketchfabDocument(matrix: unknown) {
	return {
		asset: {
			extras: { source: "https://sketchfab.com/3d-models/a-model" },
			generator: "Sketchfab-16.67.0",
		},
		nodes: [{ matrix }],
	};
}

describe("sourceMetreScaleForGlb", () => {
	it("recognises the centimetre transforms emitted by the supplied Sketchfab FBX GLB", () => {
		expect(
			sourceMetreScaleForGlb({
				asset: {
					extras: {
						source: "https://sketchfab.com/3d-models/white-armchair-fbx-1k-9mb",
					},
					generator: "Sketchfab-16.67.0",
				},
				nodes: [{ children: [1] }, { matrix: centimetreSketchfabTransform }],
			}),
		).toBe(0.01);
	});

	it("keeps standard metre GLB files and ambiguous Sketchfab files at their declared scale", () => {
		expect(
			sourceMetreScaleForGlb({
				asset: { generator: "Blender glTF exporter v4.5.0" },
				nodes: [{ matrix: centimetreSketchfabTransform }],
			}),
		).toBe(1);
		expect(
			sourceMetreScaleForGlb({
				asset: {
					extras: { source: "https://sketchfab.com/3d-models/a-model" },
					generator: "Sketchfab-16.67.0",
				},
				nodes: [{ scale: [100, 100, 100] }],
			}),
		).toBe(1);
	});

	it("requires both source markers rather than treating any GLB with a 100× matrix as Sketchfab FBX", () => {
		expect(
			sourceMetreScaleForGlb({
				...sketchfabDocument(centimetreSketchfabTransform),
				asset: {
					extras: { source: "https://example.com/model" },
					generator: "Sketchfab-16.67.0",
				},
			}),
		).toBe(1);
		expect(
			sourceMetreScaleForGlb({
				...sketchfabDocument(centimetreSketchfabTransform),
				asset: {
					extras: {
						source: "https://sketchfab.com/3d-models/a-model",
					},
					generator: "Other exporter",
				},
			}),
		).toBe(1);
		expect(
			sourceMetreScaleForGlb({
				asset: { generator: "Sketchfab-16.67.0" },
				nodes: [{ matrix: centimetreSketchfabTransform }],
			}),
		).toBe(1);
		expect(
			sourceMetreScaleForGlb({ nodes: [{ matrix: centimetreSketchfabTransform }] }),
		).toBe(1);
	});

	it("does not infer a unit conversion from malformed or non-uniform matrices", () => {
		expect(
			sourceMetreScaleForGlb({
				asset: {
					extras: { source: "https://sketchfab.com/3d-models/a-model" },
					generator: "Sketchfab-16.67.0",
				},
				nodes: [{ matrix: [...centimetreSketchfabTransform.slice(0, 8), 80, 0, 0, 0, 0, 0, 0, 1] }],
			}),
		).toBe(1);
		expect(sourceMetreScaleForGlb(null)).toBe(1);
	});

	it("only accepts a complete numeric 4×4 matrix and keeps the inclusive scale tolerance", () => {
		expect(
			sourceMetreScaleForGlb(
				sketchfabDocument(rotatedCentimetreSketchfabTransform),
			),
		).toBe(0.01);
		expect(
			sourceMetreScaleForGlb(
				sketchfabDocument([
					100.5, 0, 0, 0,
					0, 100.5, 0, 0,
					0, 0, 100.5, 0,
					0, 0, 0, 1,
				]),
			),
		).toBe(0.01);
		expect(
			sourceMetreScaleForGlb(
				sketchfabDocument(centimetreSketchfabTransform.slice(0, 15)),
			),
		).toBe(1);
		expect(
			sourceMetreScaleForGlb(
				sketchfabDocument([
					...centimetreSketchfabTransform.slice(0, 15),
					"1",
				]),
			),
		).toBe(1);
		expect(
			sourceMetreScaleForGlb({
				...sketchfabDocument(centimetreSketchfabTransform),
				nodes: [undefined, { matrix: centimetreSketchfabTransform }],
			}),
		).toBe(0.01);
	});

	it("converts the supplied armchair bounds into the millimetres suggested in the import form", () => {
		expect(
		measuredDimensionsMmForGlbBounds(
			{ depthM: 200.202, heightM: 227.675, widthM: 202.179 },
			{
				asset: {
					extras: {
						source:
							"https://sketchfab.com/3d-models/white-armchair-fbx-1k-9mb",
					},
					generator: "Sketchfab-16.67.0",
				},
				nodes: [{ matrix: centimetreSketchfabTransform }],
			},
		),
	).toEqual({ depthMm: 2002, heightMm: 2277, widthMm: 2022 });
	});
});
