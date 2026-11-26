import type { CatalogPartBuilder, CatalogProfile } from "./catalog-model-parts";

const ceramic = "#e7e3da";
const metal = "#a7adb1";
const graphite = "#343735";
const rounded = "rounded";
const cylinder: CatalogProfile = {
	rings: [
		[0, 1, 1],
		[1, 1, 1],
	],
};

function bath(box: CatalogPartBuilder) {
	return [
		box("body", [0, 1], [0, 1], [0, 1], {
			profile: {
				outline: rounded,
				openEnd: true,
				rings: [
					[0, 0.88, 0.83],
					[0.12, 0.95, 0.91],
					[0.91, 1, 1],
					[1, 0.98, 0.97],
					[1, 0.81, 0.66],
				],
			},
		}),
		box("detail", [0, 1], [0, 1], [0, 1], {
			color: ceramic,
			profile: {
				outline: rounded,
				openStart: true,
				rings: [
					[1, 0.81, 0.66],
					[0.85, 0.79, 0.63],
					[0.36, 0.62, 0.44],
					[0.29, 0.53, 0.38],
				],
			},
		}),
		box("detail", [0.71, 0.75], [0.29, 0.305], [0.452, 0.548], {
			color: metal,
			profile: cylinder,
		}),
	];
}

function toilet(box: CatalogPartBuilder) {
	return [
		box("body", [0, 1], [0.46, 0.986], [0, 0.34], { rounded: 0.024 }),
		box("detail", [0.43, 0.57], [0.983, 1], [0.1, 0.195], {
			color: metal,
			profile: cylinder,
		}),
		box("body", [0, 1], [0, 0.55], [0.23, 1], {
			profile: {
				openEnd: true,
				rings: [
					[0, 0.62, 0.53, 0, -0.15],
					[0.18, 0.59, 0.55, 0, -0.15],
					[0.46, 0.67, 0.67, 0, -0.08],
					[0.83, 0.97, 1],
					[0.94, 1, 1],
					[1, 0.98, 0.96],
					[1, 0.79, 0.74],
				],
			},
		}),
		box("detail", [0, 1], [0, 0.55], [0.23, 1], {
			color: ceramic,
			profile: {
				openStart: true,
				rings: [
					[1, 0.79, 0.74],
					[0.83, 0.68, 0.58],
					[0.5, 0.28, 0.28, 0, -0.08],
					[0.48, 0.2, 0.21, 0, -0.08],
				],
			},
		}),
		box("seat", [0, 1], [0.549, 0.584], [0.23, 1], {
			color: ceramic,
			profile: {
				openStart: true,
				openEnd: true,
				rings: [
					[0, 0.98, 0.96],
					[0.8, 0.98, 0.96],
					[1, 0.95, 0.93],
					[1, 0.79, 0.74],
					[0, 0.79, 0.74],
					[0, 0.98, 0.96],
				],
			},
		}),
	];
}

function shower(box: CatalogPartBuilder) {
	const glassFrame = "#878e90";
	return [
		box("body", [0, 1], [0, 0.075], [0, 1], {
			profile: {
				outline: rounded,
				rings: [
					[0, 0.96, 0.96],
					[0.22, 1, 1],
					[1, 1, 1],
					[1, 0.89, 0.89],
					[0.53, 0.84, 0.84],
				],
			},
		}),
		box("back", [0, 1], [0.07, 1], [0, 0.047], { rounded: 0.009 }),
		box("detail", [0.018, 0.053], [0.07, 1], [0.025, 0.062], {
			color: glassFrame,
		}),
		box("detail", [0.95, 1], [0.07, 1], [0.006, 0.055], { color: glassFrame }),
		box("detail", [0.95, 1], [0.07, 1], [0.95, 1], { color: glassFrame }),
		box("detail", [0.95, 1], [0.975, 1], [0.05, 1], { color: glassFrame }),
		box("detail", [0.4, 0.44], [0.075, 1], [0.95, 1], { color: glassFrame }),
		box("detail", [0.4, 0.95], [0.975, 1], [0.95, 1], { color: glassFrame }),
		box("detail", [0.964, 0.98], [0.075, 0.98], [0.05, 0.955], {
			color: "#b6dce0",
			opacity: 0.32,
		}),
		box("detail", [0.44, 0.952], [0.075, 0.98], [0.974, 0.986], {
			color: "#b6dce0",
			opacity: 0.24,
		}),
		box("detail", [0.5, 0.527], [0.46, 0.57], [0.952, 1], { color: graphite }),
		box("detail", [0.423, 0.454], [0.43, 0.88], [0.095, 0.127], {
			color: metal,
			profile: cylinder,
		}),
		box("detail", [0.423, 0.454], [0.854, 0.88], [0.1, 0.31], {
			color: metal,
			profile: { ...cylinder, axis: "z" },
		}),
		box("detail", [0.342, 0.535], [0.838, 0.856], [0.196, 0.387], {
			color: metal,
			profile: cylinder,
		}),
		box("detail", [0.335, 0.543], [0.43, 0.46], [0.075, 0.144], {
			color: graphite,
			rounded: 0.008,
		}),
	];
}

function vanity(box: CatalogPartBuilder) {
	return [
		box("leg", [0.08, 0.92], [0, 0.09], [0.08, 0.88], { color: graphite }),
		box("body", [0.023, 0.977], [0.086, 0.788], [0.027, 0.91], {
			rounded: 0.01,
		}),
		box("body", [0.023, 0.074], [0.78, 0.85], [0.027, 0.961]),
		box("body", [0.926, 0.977], [0.78, 0.85], [0.027, 0.961]),
		box("body", [0.074, 0.926], [0.78, 0.85], [0.027, 0.105]),
		...(
			[
				[0.026, 0.492],
				[0.508, 0.974],
			] as const
		).map((span) =>
			box("drawer", span, [0.105, 0.82], [0.906, 0.98], { rounded: 0.012 }),
		),
		...(
			[
				[0.357, 0.47],
				[0.53, 0.643],
			] as const
		).map((span) =>
			box("detail", span, [0.683, 0.722], [0.975, 1], {
				color: graphite,
				rounded: 0.006,
			}),
		),
		box("tabletop", [0, 1], [0.77, 0.905], [0, 1], {
			color: ceramic,
			profile: {
				outline: rounded,
				rings: [
					[0, 0.58, 0.5, 0, 0.06],
					[0.54, 0.72, 0.55, 0, 0.06],
					[0.56, 0.984, 0.984],
					[0.8, 1, 1],
					[1, 0.985, 0.985],
					[1, 0.74, 0.65, 0, 0.07],
					[0.4, 0.52, 0.43, 0, 0.065],
					[0.26, 0.42, 0.33, 0, 0.06],
				],
			},
		}),
		box("detail", [0.46, 0.54], [0.805, 0.816], [0.512, 0.627], {
			color: metal,
			profile: cylinder,
		}),
		box("detail", [0.463, 0.537], [0.9, 0.995], [0.125, 0.236], {
			color: metal,
			profile: cylinder,
		}),
		box("detail", [0.465, 0.535], [0.965, 1], [0.166, 0.397], {
			color: metal,
			profile: { ...cylinder, axis: "z" },
		}),
	];
}

function floorLamp(box: CatalogPartBuilder) {
	return [
		box("leg", [0.06, 0.94], [0, 0.023], [0.06, 0.94], {
			color: graphite,
			profile: {
				rings: [
					[0, 0.98, 0.98],
					[0.3, 1, 1],
					[1, 0.89, 0.89],
				],
			},
		}),
		box("body", [0.462, 0.538], [0.023, 0.85], [0.462, 0.538], {
			color: graphite,
			profile: cylinder,
		}),
		box("detail", [0, 1], [0.768, 1], [0, 1], {
			profile: {
				rings: [
					[0, 0.92, 0.92],
					[0.03, 1, 1],
					[0.98, 0.65, 0.65],
					[1, 0.64, 0.64],
				],
			},
		}),
	];
}

function rug(box: CatalogPartBuilder) {
	return [
		box("body", [0, 1], [0, 0.86], [0, 1], {
			tone: "trim",
			profile: {
				outline: rounded,
				cornerRadius: 0.11,
				rings: [
					[0, 0.995, 0.995],
					[0.07, 1, 1],
					[1, 0.996, 0.996],
				],
			},
		}),
		box("detail", [0.065, 0.935], [0.855, 1], [0.052, 0.948], {
			profile: { ...cylinder, outline: rounded, cornerRadius: 0.08 },
		}),
	];
}

function planter(box: CatalogPartBuilder) {
	return [
		box("body", [0, 1], [0, 0.58], [0, 1], {
			profile: {
				rings: [
					[0, 0.61, 0.61],
					[0.06, 0.68, 0.68],
					[0.84, 0.9, 0.9],
					[0.85, 1, 1],
					[1, 0.99, 0.99],
					[1, 0.84, 0.84],
					[0.83, 0.81, 0.81],
				],
			},
		}),
		box("detail", [0.08, 0.92], [0.478, 0.487], [0.08, 0.92], {
			color: "#433b37",
			profile: cylinder,
		}),
		// Twisted fans are built from broad rings shifted along the stem.
		box("detail", [0.26, 0.69], [0.475, 1], [0.25, 0.67], {
			color: "#416a51",
			profile: {
				rings: [
					[0, 0.12, 0.08, 0.08, 0.26],
					[0.35, 0.58, 0.18, -0.06, 0.1],
					[0.68, 1, 0.26, 0, -0.13],
					[1, 0.035, 0.025, -0.18, -0.46],
				],
			},
		}),
		box("detail", [0.49, 0.98], [0.476, 0.91], [0.36, 0.77], {
			color: "#2d593e",
			profile: {
				rings: [
					[0, 0.1, 0.11, -0.42, -0.16],
					[0.49, 0.48, 0.54, -0.06, 0.05],
					[0.78, 0.45, 0.55, 0.18, 0.17],
					[1, 0.045, 0.045, 0.47, 0.32],
				],
			},
		}),
		box("detail", [0.03, 0.52], [0.476, 0.86], [0.43, 0.848], {
			color: "#64865c",
			profile: {
				rings: [
					[0, 0.1, 0.11, 0.38, -0.23],
					[0.45, 0.53, 0.59, 0.02, 0],
					[0.73, 0.38, 0.63, -0.18, 0.16],
					[1, 0.035, 0.045, -0.46, 0.43],
				],
			},
		}),
		box("detail", [0.38, 0.71], [0.478, 0.79], [0.52, 0.99], {
			color: "#527652",
			profile: {
				rings: [
					[0, 0.15, 0.08, -0.18, -0.44],
					[0.4, 0.62, 0.26, -0.14, -0.13],
					[0.72, 0.79, 0.33, 0.1, 0.16],
					[1, 0.03, 0.04, 0.35, 0.47],
				],
			},
		}),
	];
}

function coatRack(box: CatalogPartBuilder) {
	return [
		box("leg", [0, 1], [0, 0.043], [0, 1], {
			color: graphite,
			profile: {
				rings: [
					[0, 0.91, 0.91],
					[0.2, 1, 1],
					[0.82, 1, 1],
					[1, 0.87, 0.87],
				],
			},
		}),
		box("body", [0.437, 0.563], [0.04, 0.98], [0.437, 0.563], {
			profile: cylinder,
		}),
		box("detail", [0.421, 0.579], [0.968, 1], [0.421, 0.579], {
			color: graphite,
			profile: cylinder,
		}),
		...(
			[
				[[0.08, 0.55], [0.69, 0.84], [0.451, 0.549], 1, 0],
				[[0.45, 0.94], [0.81, 0.97], [0.451, 0.549], -1, 0],
				[[0.451, 0.549], [0.73, 0.88], [0.45, 0.91], 0, -1],
				[[0.451, 0.549], [0.77, 0.92], [0.11, 0.55], 0, 1],
			] as const
		).flatMap(([x, y, z, dx, dz]) => {
			const width = dx === 0 ? 1 : 0.21;
			const depth = dz === 0 ? 1 : 0.21;
			return [
				box("arm", x, y, z, {
					profile: {
						openEnd: true,
						rings: [
							[0, width, depth, 0.39 * dx, 0.39 * dz],
							[0.66, width, depth, -0.29 * dx, -0.29 * dz],
							[0.88, width, depth, -0.39 * dx, -0.39 * dz],
						],
					},
				}),
				box("detail", x, y, z, {
					color: graphite,
					profile: {
						openStart: true,
						rings: [
							[0.88, width, depth, -0.39 * dx, -0.39 * dz],
							[0.96, width, depth, -0.39 * dx, -0.39 * dz],
							[1, width * 0.64, depth * 0.64, -0.39 * dx, -0.39 * dz],
						],
					},
				}),
			];
		}),
	];
}

export const catalogFixtures = {
	bath,
	toilet,
	shower,
	vanity,
	"floor-lamp": floorLamp,
	rug,
	planter,
	"coat-rack": coatRack,
};
