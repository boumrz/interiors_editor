import { shelfTemplate, supportTopTemplates } from "../../domain/interior-support";
import type { CatalogPartBuilder } from "./catalog-model-parts";

const cabinetFoot = "#393532";
const cabinetPull = "#d0ae82";
const applianceTrim = "#b7bdba";
const controlPanel = "#333b40";
const darkGlass = "#26343c";

type Span = Parameters<CatalogPartBuilder>[1];

function cabinetFeet(box: CatalogPartBuilder, top: number) {
	const positions: readonly Span[] = [
		[0.08, 0.19],
		[0.81, 0.92],
	];
	return positions.flatMap((x) =>
		positions.map((z) =>
			box("leg", x, [0, top], z, { color: cabinetFoot, rounded: 0.009 }),
		),
	);
}

function bedsideTable(box: CatalogPartBuilder) {
	return [
		...cabinetFeet(box, 0.12),
		box("body", [0, 0.1], [0.12, 0.94], [0, 1]),
		box("body", [0.9, 1], [0.12, 0.94], [0, 1]),
		box("body", [0.1, 0.9], [0.12, 0.2], [0, 0.96], { tone: "shadow" }),
		box("body", [0.1, 0.9], [0.2, 0.94], [0, 0.13], { tone: "shadow" }),
		box("tabletop", supportTopTemplates["bedside-table"].x, supportTopTemplates["bedside-table"].y, supportTopTemplates["bedside-table"].z, {
			tone: "highlight",
			rounded: 0.009,
		}),
		box("drawer", [0.115, 0.885], [0.62, 0.925], [0.82, 0.95], {
			rounded: 0.007,
		}),
		box("detail", [0.32, 0.68], [0.76, 0.81], [0.94, 1], {
			color: cabinetPull,
			rounded: 0.008,
		}),
	];
}

function dresser(box: CatalogPartBuilder) {
	const drawerStarts = [0.12, 0.39, 0.66];
	return [
		...cabinetFeet(box, 0.1),
		box("body", [0, 1], [0.1, 0.944], [0, 0.9], { rounded: 0.011 }),
		box("body", [0.04, 0.96], [0.11, 0.944], [0.89, 0.93], { tone: "shadow" }),
		box("tabletop", supportTopTemplates.dresser.x, supportTopTemplates.dresser.y, supportTopTemplates.dresser.z, {
			tone: "highlight",
			rounded: 0.009,
		}),
		...drawerStarts.flatMap((bottom) => [
			box("drawer", [0.042, 0.958], [bottom, bottom + 0.245], [0.91, 0.982], {
				rounded: 0.008,
			}),
			box(
				"detail",
				[0.36, 0.64],
				[bottom + 0.105, bottom + 0.143],
				[0.976, 1],
				{ color: cabinetPull, rounded: 0.009 },
			),
		]),
	];
}

function wardrobe(box: CatalogPartBuilder) {
	const doors: readonly Span[] = [
		[0.023, 0.492],
		[0.508, 0.977],
	];
	const pulls: readonly Span[] = [
		[0.405, 0.437],
		[0.563, 0.595],
	];
	return [
		box("leg", [0.044, 0.956], [0, 0.07], [0.035, 0.88], {
			color: cabinetFoot,
		}),
		box("body", [0, 1], [0.07, 1], [0, 0.924], { rounded: 0.012 }),
		box("body", [0.023, 0.977], [0.09, 0.985], [0.917, 0.944], {
			tone: "shadow",
		}),
		...doors.map((x) =>
			box("drawer", x, [0.095, 0.984], [0.937, 0.974], { rounded: 0.008 }),
		),
		...pulls.map((x) =>
			box("detail", x, [0.43, 0.6], [0.967, 1], {
				color: cabinetPull,
				rounded: 0.009,
			}),
		),
	];
}

function openShelf(box: CatalogPartBuilder) {
	const sides: readonly Span[] = [
		[0, 0.075],
		[0.925, 1],
	];
	return [
		...sides.map((x) => box("body", x, [0, 1], [0, 1], { rounded: 0.008 })),
		...shelfTemplate.levels.map((y) =>
			box("tabletop", shelfTemplate.x, y, shelfTemplate.z, {
				tone: "highlight",
				rounded: 0.007,
			}),
		),
	];
}

function tvStand(box: CatalogPartBuilder) {
	const doors: readonly Span[] = [
		[0.035, 0.317],
		[0.683, 0.965],
	];
	return [
		...cabinetFeet(box, 0.17),
		box("body", [0, 1], [0.17, 0.248], [0, 0.974], { tone: "shadow" }),
		box("body", [0, 0.026], [0.245, 0.884], [0, 0.982]),
		box("body", [0.974, 1], [0.245, 0.884], [0, 0.982]),
		box("body", [0.026, 0.974], [0.245, 0.884], [0, 0.14], {
			color: cabinetFoot,
		}),
		box("tabletop", supportTopTemplates["tv-stand"].x, supportTopTemplates["tv-stand"].y, supportTopTemplates["tv-stand"].z, { rounded: 0.012 }),
		box("tabletop", [0.313, 0.687], [0.53, 0.588], [0.14, 0.94], {
			tone: "highlight",
			rounded: 0.007,
		}),
		...doors.map((x) =>
			box("drawer", x, [0.256, 0.875], [0.856, 0.988], { rounded: 0.01 }),
		),
	];
}

function kitchenFloorUnit(box: CatalogPartBuilder) {
	return [
		box("leg", [0.052, 0.948], [0, 0.11], [0.016, 0.79], {
			color: cabinetFoot,
		}),
		box("body", [0.025, 0.975], [0.11, 0.939], [0, 0.924], { rounded: 0.009 }),
		box("body", [0.035, 0.965], [0.126, 0.939], [0.918, 0.951], {
			tone: "shadow",
		}),
		box("tabletop", [0, 1], [0.938, 1], [0, 1], {
			color: "#ded6c8",
			rounded: 0.009,
		}),
		box("drawer", [0.045, 0.955], [0.136, 0.685], [0.945, 0.973], {
			rounded: 0.006,
		}),
		box("drawer", [0.045, 0.955], [0.708, 0.925], [0.945, 0.973], {
			rounded: 0.006,
		}),
		box("detail", [0.31, 0.69], [0.809, 0.846], [0.968, 0.998], {
			color: cabinetFoot,
			rounded: 0.009,
		}),
		box("detail", [0.31, 0.69], [0.577, 0.614], [0.968, 0.998], {
			color: cabinetFoot,
			rounded: 0.009,
		}),
	];
}

function laundryCase(box: CatalogPartBuilder) {
	return [
		box("leg", [0.035, 0.965], [0, 0.05], [0.025, 0.91], {
			color: controlPanel,
		}),
		box("body", [0, 1], [0.048, 1], [0, 0.952], { rounded: 0.013 }),
		box("body", [0.022, 0.978], [0.055, 0.79], [0.944, 0.969], {
			rounded: 0.008,
		}),
	];
}

function laundryHatch(
	box: CatalogPartBuilder,
	x: Span,
	y: Span,
	rimColor: string,
) {
	return [
		box("detail", x, y, [0.965, 0.995], {
			color: rimColor,
			profile: {
				axis: "z",
				rings: [
					[0, 0.93, 0.93],
					[0.32, 1, 1],
					[0.8, 1, 1],
					[1, 0.93, 0.93],
				],
			},
		}),
		box(
			"detail",
			[x[0] + 0.065, x[1] - 0.065],
			[y[0] + 0.047, y[1] - 0.047],
			[0.993, 1],
			{
				color: darkGlass,
				profile: {
					axis: "z",
					rings: [
						[0, 1, 1],
						[1, 1, 1],
					],
				},
			},
		),
	];
}

function washer(box: CatalogPartBuilder) {
	return [
		...laundryCase(box),
		box("body", [0.022, 0.978], [0.802, 0.979], [0.944, 0.969], {
			tone: "highlight",
			rounded: 0.008,
		}),
		...laundryHatch(box, [0.147, 0.853], [0.16, 0.655], applianceTrim),
		box("drawer", [0.105, 0.428], [0.852, 0.939], [0.958, 0.98], {
			rounded: 0.006,
		}),
		box("detail", [0.122, 0.413], [0.849, 0.868], [0.977, 0.988], {
			color: controlPanel,
		}),
		box("detail", [0.647, 0.775], [0.851, 0.942], [0.964, 0.99], {
			color: applianceTrim,
			profile: {
				axis: "z",
				rings: [
					[0, 1, 1],
					[0.7, 1, 1],
					[1, 0.76, 0.76],
				],
			},
		}),
		box("detail", [0.825, 0.935], [0.874, 0.919], [0.965, 0.976], {
			color: controlPanel,
			rounded: 0.004,
		}),
	];
}

function dryer(box: CatalogPartBuilder) {
	const ventRows: readonly Span[] = [
		[0.105, 0.124],
		[0.139, 0.158],
		[0.173, 0.192],
	];
	return [
		...laundryCase(box),
		box("body", [0.025, 0.975], [0.801, 0.975], [0.945, 0.971], {
			color: controlPanel,
			rounded: 0.01,
		}),
		box("detail", [0.092, 0.211], [0.85, 0.934], [0.965, 0.986], {
			color: applianceTrim,
			profile: {
				axis: "z",
				rings: [
					[0, 1, 1],
					[1, 0.83, 0.83],
				],
			},
		}),
		box("detail", [0.54, 0.89], [0.868, 0.925], [0.969, 0.981], {
			color: "#778988",
			rounded: 0.004,
		}),
		...laundryHatch(box, [0.144, 0.856], [0.245, 0.748], "#576064"),
		box("detail", [0.101, 0.899], [0.084, 0.214], [0.962, 0.977], {
			color: applianceTrim,
			rounded: 0.006,
		}),
		...ventRows.map((y) =>
			box("detail", [0.155, 0.845], y, [0.976, 0.985], { color: controlPanel }),
		),
	];
}

function fridge(box: CatalogPartBuilder) {
	const doors: readonly Span[] = [
		[0.069, 0.346],
		[0.357, 0.993],
	];
	const handles: readonly Span[] = [
		[0.246, 0.32],
		[0.384, 0.523],
	];
	return [
		box("leg", [0.04, 0.96], [0, 0.063], [0.022, 0.82], {
			color: controlPanel,
		}),
		box("body", [0, 1], [0.059, 1], [0, 0.927], { rounded: 0.018 }),
		box("detail", [0.04, 0.96], [0.069, 0.99], [0.922, 0.951], {
			color: controlPanel,
		}),
		...doors.map((y) =>
			box("drawer", [0.012, 0.988], y, [0.944, 0.982], { rounded: 0.012 }),
		),
		...handles.map((y) =>
			box("detail", [0.112, 0.172], y, [0.975, 1], {
				color: applianceTrim,
				rounded: 0.009,
			}),
		),
	];
}

function dishwasher(box: CatalogPartBuilder) {
	const handleSides: readonly Span[] = [
		[0.025, 0.196],
		[0.804, 0.975],
	];
	return [
		box("leg", [0.045, 0.955], [0, 0.101], [0.022, 0.83], {
			color: controlPanel,
		}),
		box("body", [0, 1], [0.099, 1], [0, 0.952], { rounded: 0.01 }),
		box("drawer", [0.015, 0.985], [0.11, 0.85], [0.946, 1], { rounded: 0.008 }),
		box("detail", [0.024, 0.976], [0.85, 0.932], [0.949, 0.971], {
			color: controlPanel,
		}),
		...handleSides.map((x) =>
			box("detail", x, [0.85, 0.932], [0.966, 0.99], { color: "#50585b" }),
		),
		box("detail", [0.025, 0.975], [0.932, 0.985], [0.948, 0.994], {
			color: applianceTrim,
			rounded: 0.006,
		}),
		box("detail", [0.746, 0.906], [0.944, 0.972], [0.99, 0.998], {
			color: controlPanel,
			rounded: 0.004,
		}),
	];
}

function stove(box: CatalogPartBuilder) {
	const burnerXs: readonly Span[] = [
		[0.114, 0.437],
		[0.558, 0.881],
	];
	const burnerZs: readonly Span[] = [
		[0.091, 0.415],
		[0.523, 0.846],
	];
	const controls: readonly Span[] = [
		[0.1, 0.2],
		[0.275, 0.375],
		[0.45, 0.55],
		[0.625, 0.725],
		[0.8, 0.9],
	];
	return [
		box("leg", [0.036, 0.964], [0, 0.046], [0.028, 0.873], {
			color: controlPanel,
		}),
		box("body", [0, 1], [0.044, 0.953], [0, 0.942], { rounded: 0.011 }),
		box("tabletop", [0, 1], [0.951, 0.988], [0, 0.973], {
			color: controlPanel,
			rounded: 0.008,
		}),
		...burnerXs.flatMap((x) =>
			burnerZs.map((z) =>
				box("detail", x, [0.986, 1], z, {
					color: "#727675",
					profile: {
						rings: [
							[0, 1, 1],
							[0.63, 1, 1],
							[1, 0.87, 0.87],
						],
					},
				}),
			),
		),
		box("drawer", [0.036, 0.964], [0.106, 0.761], [0.937, 0.981], {
			rounded: 0.01,
		}),
		box("detail", [0.102, 0.898], [0.213, 0.604], [0.974, 0.989], {
			color: darkGlass,
			rounded: 0.019,
		}),
		box("detail", [0.129, 0.871], [0.649, 0.694], [0.974, 1], {
			color: applianceTrim,
			rounded: 0.009,
		}),
		box("body", [0.037, 0.963], [0.777, 0.933], [0.937, 0.979], {
			tone: "highlight",
			rounded: 0.007,
		}),
		...controls.map((x) =>
			box("detail", x, [0.824, 0.894], [0.973, 0.997], {
				color: controlPanel,
				profile: {
					axis: "z",
					rings: [
						[0, 1, 1],
						[1, 0.83, 0.83],
					],
				},
			}),
		),
	];
}

export const catalogCaseworkModels = {
	"bedside-table": bedsideTable,
	dresser,
	wardrobe,
	"open-shelf": openShelf,
	"tv-stand": tvStand,
	"kitchen-floor-unit": kitchenFloorUnit,
	washer,
	"slim-washer": washer,
	dryer,
	fridge,
	dishwasher,
	stove,
};
