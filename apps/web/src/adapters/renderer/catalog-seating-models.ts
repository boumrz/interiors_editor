import { supportTopTemplates } from "../../domain/interior-support";
import type { CatalogPartBuilder } from "./catalog-model-parts";

const lightWood = "#bb946c";
const deskFrame = "#575452";
const mattressFabric = "#dfd4c6";
const pillowFabric = "#f4eadb";

type Interval = readonly [number, number];

function armchair(box: CatalogPartBuilder) {
	const sideFrames = [
		{ arm: [0, 0.108], support: [0.026, 0.091] },
		{ arm: [0.892, 1], support: [0.909, 0.974] },
	] as const;
	return [
		...sideFrames.flatMap(({ arm, support }) => [
			box("leg", support, [0, 0.65], [0, 0.1], {
				color: lightWood,
				rounded: 0.007,
			}),
			box("leg", support, [0, 0.75], [0.85, 1], {
				color: lightWood,
				rounded: 0.007,
			}),
			box("arm", arm, [0.635, 0.706], [0.015, 0.945], {
				color: lightWood,
				rounded: 0.014,
			}),
			box("detail", support, [0.375, 0.432], [0.065, 0.94], {
				color: lightWood,
				rounded: 0.007,
			}),
		]),
		box("detail", [0.068, 0.932], [0.38, 0.452], [0.06, 0.874], {
			color: lightWood,
			rounded: 0.01,
		}),
		box("detail", [0.06, 0.94], [0.682, 0.742], [0.894, 0.95], {
			color: lightWood,
			rounded: 0.009,
		}),
		box("seat", [0.104, 0.896], [0.433, 0.565], [0.007, 0.866], {
			rounded: 0.029,
		}),
		box("back", [0.093, 0.907], [0.482, 1], [0.647, 1], {
			// Follow the lean of the back without rotating its bounding box out of the footprint.
			profile: {
				outline: "rounded",
				rings: [
					[0, 0.88, 0.42, 0, -0.24],
					[0.09, 1, 0.48, 0, -0.26],
					[0.88, 1, 0.48, 0, 0.26],
					[1, 0.9, 0.38, 0, 0.3],
				],
			},
		}),
	];
}

function chair(box: CatalogPartBuilder) {
	const frontLegs = [
		[0.059, 0.166],
		[0.834, 0.941],
	] as const;
	const rearLegs = [
		[0.088, 0.186],
		[0.814, 0.912],
	] as const;
	return [
		...frontLegs.map((x) =>
			box("leg", x, [0, 0.492], [0.043, 0.164], {
				color: lightWood,
				profile: {
					outline: "rounded",
					rings: [
						[0, 0.71, 0.71],
						[1, 1, 1],
					],
				},
			}),
		),
		...rearLegs.map((x) =>
			box("leg", x, [0, 0.906], [0.791, 0.972], {
				color: lightWood,
				profile: {
					outline: "rounded",
					rings: [
						[0, 0.69, 0.58, 0, 0.12],
						[0.51, 1, 0.81, 0, -0.09],
						[1, 0.88, 0.72, 0, 0.14],
					],
				},
			}),
		),
		box("seat", [0, 1], [0.445, 0.514], [0, 0.915], { rounded: 0.015 }),
		box("back", [0.067, 0.933], [0.739, 1], [0.842, 1], { rounded: 0.015 }),
	];
}

function cornerSofa(box: CatalogPartBuilder) {
	// The optional depth is on the +X end, with an open foot facing +Z.
	const feet = [
		{ x: [0.037, 0.079], z: [0.054, 0.119] },
		{ x: [0.925, 0.967], z: [0.054, 0.119] },
		{ x: [0.037, 0.079], z: [0.485, 0.55] },
		{ x: [0.533, 0.575], z: [0.485, 0.55] },
		{ x: [0.662, 0.704], z: [0.902, 0.967] },
		{ x: [0.925, 0.967], z: [0.902, 0.967] },
	] as const;
	return [
		...feet.map(({ x, z }) =>
			box("leg", x, [0, 0.12], z, { tone: "foot", rounded: 0.006 }),
		),
		box("body", [0.066, 0.634], [0.11, 0.333], [0.098, 0.558], {
			tone: "shadow",
			rounded: 0.022,
		}),
		box("body", [0.632, 1], [0.11, 0.333], [0.098, 0.989], {
			tone: "shadow",
			rounded: 0.024,
		}),
		box("back", [0, 1], [0.11, 1], [0, 0.117], { rounded: 0.046 }),
		box("arm", [0, 0.069], [0.11, 0.723], [0.111, 0.57], { rounded: 0.031 }),
		box("seat", [0.074, 0.347], [0.331, 0.541], [0.113, 0.57], {
			rounded: 0.033,
		}),
		box("seat", [0.353, 0.629], [0.331, 0.541], [0.113, 0.57], {
			rounded: 0.033,
		}),
		box("seat", [0.635, 1], [0.331, 0.541], [0.113, 1], { rounded: 0.038 }),
	];
}

function ottoman(box: CatalogPartBuilder) {
	return [
		box("leg", [0.136, 0.864], [0, 0.098], [0.136, 0.864], {
			tone: "foot",
			rounded: 0.016,
		}),
		box("body", [0.017, 0.983], [0.094, 0.794], [0.017, 0.983], {
			rounded: 0.052,
		}),
		box("detail", [0.026, 0.974], [0.763, 0.829], [0.026, 0.974], {
			tone: "shadow",
			rounded: 0.014,
		}),
		box("seat", [0, 1], [0.809, 1], [0, 1], { rounded: 0.043 }),
	];
}

function tableLegs(
	box: CatalogPartBuilder,
	x: readonly Interval[],
	z: readonly Interval[],
	top: number,
	color: string,
) {
	return x.flatMap((width) =>
		z.map((depth) =>
			box("leg", width, [0, top], depth, {
				color,
				profile: {
					outline: "rounded",
					rings: [
						[0, 0.74, 0.74],
						[1, 1, 1],
					],
				},
			}),
		),
	);
}

function coffeeTable(box: CatalogPartBuilder) {
	return [
		...tableLegs(
			box,
			[
				[0.102, 0.179],
				[0.821, 0.898],
			],
			[
				[0.119, 0.252],
				[0.748, 0.881],
			],
			0.914,
			"#404344",
		),
		box("tabletop", [0, 1], supportTopTemplates["coffee-table"].y, [0, 1], {
			profile: {
				outline: "rounded",
				rings: [
					[0, 0.976, 0.962],
					[0.25, 1, 1],
					[0.82, 1, 1],
					[1, 0.987, 0.979],
				],
			},
		}),
	];
}

function table(box: CatalogPartBuilder) {
	return [
		...tableLegs(
			box,
			[
				[0.052, 0.115],
				[0.885, 0.948],
			],
			[
				[0.103, 0.201],
				[0.799, 0.897],
			],
			0.944,
			lightWood,
		),
		...(
			[
				[0.116, 0.157],
				[0.843, 0.884],
			] as const
		).map((z) =>
			box("body", [0.078, 0.922], [0.837, 0.944], z, {
				tone: "shadow",
				rounded: 0.004,
			}),
		),
		...(
			[
				[0.065, 0.093],
				[0.907, 0.935],
			] as const
		).map((x) =>
			box("body", x, [0.837, 0.944], [0.15, 0.85], {
				tone: "shadow",
				rounded: 0.004,
			}),
		),
		box("tabletop", supportTopTemplates.table.x, supportTopTemplates.table.y, supportTopTemplates.table.z, { rounded: 0.012 }),
	];
}

function desk(box: CatalogPartBuilder) {
	const sideFrames = [
		[0.051, 0.098],
		[0.902, 0.949],
	] as const;
	return [
		...sideFrames.flatMap((x) => [
			box("leg", x, [0, 0.939], [0.089, 0.175], {
				color: deskFrame,
				rounded: 0.006,
			}),
			box("leg", x, [0, 0.939], [0.825, 0.911], {
				color: deskFrame,
				rounded: 0.006,
			}),
			box("leg", x, [0.079, 0.135], [0.144, 0.856], {
				color: deskFrame,
				rounded: 0.006,
			}),
		]),
		box("body", [0.594, 0.897], [0.696, 0.943], [0.288, 0.824], {
			color: "#716861",
			rounded: 0.01,
		}),
		box("drawer", [0.581, 0.905], [0.705, 0.92], [0.808, 0.896], {
			rounded: 0.012,
		}),
		box("detail", [0.672, 0.814], [0.808, 0.852], [0.887, 0.943], {
			color: deskFrame,
			rounded: 0.008,
		}),
		box("tabletop", supportTopTemplates.desk.x, supportTopTemplates.desk.y, supportTopTemplates.desk.z, { rounded: 0.011 }),
	];
}

function bed(box: CatalogPartBuilder, pillows: readonly Interval[]) {
	const feet = [
		[0.077, 0.139],
		[0.861, 0.923],
	] as const;
	return [
		...feet.flatMap((x) =>
			(
				[
					[0.053, 0.107],
					[0.859, 0.913],
				] as const
			).map((z) =>
				box("leg", x, [0, 0.153], z, { tone: "foot", rounded: 0.006 }),
			),
		),
		box("bed-base", [0.013, 0.987], [0.122, 0.356], [0.012, 0.941], {
			color: "#74685e",
			rounded: 0.022,
		}),
		box("mattress", [0.013, 0.987], [0.322, 0.728], [0.008, 0.941], {
			color: mattressFabric,
			rounded: 0.04,
		}),
		box("headboard", [0, 1], [0.158, 1], [0.926, 1], { rounded: 0.032 }),
		box("body", [0, 1], [0.64, 0.785], [0, 0.695], { rounded: 0.033 }),
		box("detail", [0.002, 0.998], [0.764, 0.829], [0.605, 0.698], {
			tone: "highlight",
			rounded: 0.015,
		}),
		...pillows.map((x) =>
			box("detail", x, [0.715, 0.923], [0.718, 0.912], {
				color: pillowFabric,
				rounded: 0.05,
			}),
		),
	];
}

export const catalogSeatingModels = {
	armchair,
	chair,
	"corner-sofa": cornerSofa,
	ottoman,
	"coffee-table": coffeeTable,
	table,
	desk,
	bed: (box: CatalogPartBuilder) =>
		bed(box, [
			[0.075, 0.482],
			[0.518, 0.925],
		]),
	"single-bed": (box: CatalogPartBuilder) => bed(box, [[0.171, 0.829]]),
};
