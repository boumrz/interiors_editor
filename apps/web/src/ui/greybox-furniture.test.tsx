import { describe, expect, it } from "@rstest/core";

import {
	filterGreyboxFurniturePresets,
	greyboxFurniturePresets,
} from "./greybox-furniture";

describe("filterGreyboxFurniturePresets", () => {
	it("matches a local parametric item by its Russian name or declared millimetre dimensions", () => {
		expect(
			filterGreyboxFurniturePresets(greyboxFurniturePresets, {
				category: "all",
				query: "шкаф",
			}),
		).toEqual([expect.objectContaining({ id: "wardrobe" })]);
		expect(
			filterGreyboxFurniturePresets(greyboxFurniturePresets, {
				category: "all",
				query: "2200",
			}),
		).toEqual([
			expect.objectContaining({ id: "wardrobe" }),
			expect.objectContaining({ id: "sofa" }),
		]);
	});

	it("combines category and query without inventing an unavailable remote result", () => {
		expect(
			filterGreyboxFurniturePresets(greyboxFurniturePresets, {
				category: "seating",
				query: "диван",
			}),
		).toEqual([expect.objectContaining({ id: "sofa" })]);
		expect(
			filterGreyboxFurniturePresets(greyboxFurniturePresets, {
				category: "seating",
				query: "кровать",
			}),
		).toEqual([]);
	});
});
