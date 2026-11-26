import type { CatalogPartBuilder, CatalogProfile } from "./catalog-model-parts";

const fixedGraphite = "#343735";
const pages = "#eee2cc";
const cylinder: CatalogProfile = { rings: [[0, 1, 1], [1, 1, 1]] };

function tableLamp(box: CatalogPartBuilder) {
	return [
		box("leg", [0, 1], [0, 0.085], [0, 1], {
			color: fixedGraphite, profile: { rings: [[0, 0.96, 0.96], [0.42, 1, 1], [1, 0.86, 0.86]] },
		}),
		box("body", [0.437, 0.563], [0.079, 0.83], [0.437, 0.563], { color: "#635948", profile: cylinder }),
		box("detail", [0.047, 0.953], [0.51, 1], [0.047, 0.953], {
			profile: { rings: [[0, 1, 1], [0.04, 1, 1], [0.96, 0.68, 0.68], [1, 0.64, 0.64]] },
		}),
	];
}

function book(box: CatalogPartBuilder) {
	return [
		box("body", [0, 1], [0, 0.13], [0, 1], { rounded: 0.001 }),
		box("body", [0, 1], [0.87, 1], [0, 1], { rounded: 0.001 }),
		box("body", [0, 0.058], [0.1, 0.90], [0, 1], { tone: "shadow", rounded: 0.002 }),
		box("detail", [0.055, 0.972], [0.126, 0.874], [0.03, 0.97], { color: pages, rounded: 0.001 }),
		box("detail", [0.229, 0.786], [0.994, 1], [0.17, 0.3], { tone: "highlight" }),
	];
}

function vase(box: CatalogPartBuilder) {
	return [
		box("body", [0, 1], [0, 1], [0, 1], {
			profile: { openEnd: true, rings: [
				[0, 0.64, 0.64], [0.08, 0.76, 0.76], [0.36, 1, 1],
				[0.63, 0.91, 0.91], [0.79, 0.48, 0.48], [0.98, 0.42, 0.42],
				[1, 0.43, 0.43], [1, 0.32, 0.32], [0.83, 0.29, 0.29],
			] },
		}),
		box("detail", [0.33, 0.67], [0.76, 0.83], [0.33, 0.67], { tone: "shadow", profile: cylinder }),
	];
}

export const catalogDecorModels = { "table-lamp": tableLamp, book, vase };
