import { describe, expect, it } from "@rstest/core";

import { createInitialProject } from "./initial-project";
import { createCustomGlbFloorItem } from "./custom-glb-asset";
import {
	alphaParametricItemColors,
	createParametricFloorItem,
	recolorParametricFloorItem,
} from "./parametric-item";
import { alphaParametricItemColorVariants } from "./item-color-variant";
import { configureRectangularRoom } from "./rectangular-room";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function glbDefinition(assetDefinitionId: string) {
	return {
		assetDefinitionId,
		byteLength: 1024,
		depthMm: 700,
		displayName: "GLB-стол",
		format: "glb" as const,
		heightMm: 750,
		resourceHash:
			"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		widthMm: 1200,
	};
}

function projectWithItem(assetDefinitionId?: string) {
	const room = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-15T18:00:00.000Z",
			levelId: "level-1",
			name: "Цветовой тест",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids("v-1", "v-2", "v-3", "v-4", "wall-1", "wall-2", "wall-3", "wall-4", "room-1"),
		"2026-08-15T18:01:00.000Z",
	);
	if (room.kind !== "accepted") throw new Error("Expected room fixture");
	const item =
		assetDefinitionId === undefined
			? createParametricFloorItem(
					room.project,
					{
						color: "#a76a3b",
						depthMm: 700,
						heightMm: 750,
						label: "Стол",
						roomId: "room-1",
						widthMm: 1200,
						xMm: 1500,
						zMm: 1500,
					},
					ids("item-1"),
					"2026-08-15T18:02:00.000Z",
				)
			: createCustomGlbFloorItem(
					room.project,
					{
						asset: glbDefinition(assetDefinitionId),
						color: "#a76a3b",
						roomId: "room-1",
						xMm: 1500,
						zMm: 1500,
					},
					ids("item-1"),
					"2026-08-15T18:02:00.000Z",
				);
	if (item.kind !== "accepted") throw new Error("Expected item fixture");
	return item.project;
}

describe("recolorParametricFloorItem", () => {
	it("declares stable named variants for the single Alpha body slot", () => {
		expect(alphaParametricItemColorVariants).toEqual([
			{
				color: "#a76a3b",
				label: "Тёплое дерево",
				slotId: "body",
				variantId: "alpha-warm-wood",
			},
			{
				color: "#416b91",
				label: "Глубокий синий",
				slotId: "body",
				variantId: "alpha-blue",
			},
			{
				color: "#716796",
				label: "Мягкий фиолетовый",
				slotId: "body",
				variantId: "alpha-violet",
			},
			{
				color: "#8c6e4c",
				label: "Орех",
				slotId: "body",
				variantId: "alpha-walnut",
			},
			{
				color: "#835a45",
				label: "Терракота",
				slotId: "body",
				variantId: "alpha-terracotta",
			},
			{
				color: "#536d62",
				label: "Лесной зелёный",
				slotId: "body",
				variantId: "alpha-forest",
			},
			{
				color: "#8a4f54",
				label: "Ягодный красный",
				slotId: "body",
				variantId: "alpha-berry",
			},
		]);
	});

	it("durably changes only a declared local color variant", () => {
		const first = projectWithItem();
		const withSecondItem = createParametricFloorItem(
			first,
			{
				color: "#8b4f27",
				depthMm: 500,
				heightMm: 450,
				label: "Тумба",
				roomId: "room-1",
				widthMm: 500,
				xMm: 3000,
				zMm: 2400,
			},
			ids("item-2"),
			"2026-08-15T18:02:30.000Z",
		);
		if (withSecondItem.kind !== "accepted")
			throw new Error("Expected second item fixture");
		const project = withSecondItem.project;
		const result = recolorParametricFloorItem(
			project,
			{ assetInstanceId: "item-1", variantId: "alpha-blue" },
			"2026-08-15T18:03:00.000Z",
		);

		expect(alphaParametricItemColors).toContain("#416b91");
		expect(result).toEqual({
			kind: "accepted",
			project: expect.objectContaining({
				assetInstances: expect.arrayContaining([
					expect.objectContaining({
							assetInstanceId: "item-1",
							color: "#416b91",
							colorVariantId: "alpha-blue",
							depthMm: 700,
							heightMm: 750,
							widthMm: 1200,
							xMm: 1500,
							zMm: 1500,
						}),
					expect.objectContaining({
						assetInstanceId: "item-2",
						color: "#8b4f27",
					}),
				]),
				updatedAt: "2026-08-15T18:03:00.000Z",
			}),
		});
		expect(project.assetInstances[0]?.color).toBe("#a76a3b");
		expect(project.assetInstances[1]?.color).toBe("#8b4f27");
	});

	it("rejects a color outside the declared offline palette without changing the project", () => {
		const project = projectWithItem();

		expect(
			recolorParametricFloorItem(
				project,
				{ assetInstanceId: "item-1", variantId: "unknown" as never },
				"2026-08-15T18:03:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_COLOR_UNSUPPORTED" });
		expect(project.assetInstances[0]?.color).toBe("#a76a3b");
	});

	it("rejects a stale item selection rather than recoloring another item", () => {
		expect(
			recolorParametricFloorItem(
				projectWithItem(),
				{ assetInstanceId: "deleted-item", variantId: "alpha-blue" },
				"2026-08-15T18:03:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_NOT_FOUND" });
	});

	it("does not recolor a GLB-backed item that declares no recolorable slot", () => {
		const project = projectWithItem("model-1");

		expect(
			recolorParametricFloorItem(
				project,
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				"2026-08-25T14:30:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_COLOR_NOT_SUPPORTED" });
		expect(project.assetInstances[0]).toEqual(
			expect.objectContaining({
				assetDefinitionId: "model-1",
				color: "#a76a3b",
			}),
		);
	});

	it("keeps a non-GLB catalog reference recolorable beside an unrelated GLB", () => {
		const base = projectWithItem();
		const project = {
			...base,
			assetDefinitionRefs: [glbDefinition("unrelated-model")],
			assetInstances: base.assetInstances.map((item) => ({
				...item,
				assetDefinitionId: "parametric-catalog-1",
			})),
		};

		expect(
			recolorParametricFloorItem(
				project,
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				"2026-08-25T14:32:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
			}),
		);
	});

	it("does not mistake an unrelated GLB manifest entry for a floor item's color rule", () => {
		const base = projectWithItem();
		const project = {
			...base,
			assetDefinitionRefs: [glbDefinition("unrelated-model")],
		};

		expect(
			recolorParametricFloorItem(
				project,
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				"2026-08-25T14:33:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
			}),
		);
	});

	it("matches the GLB manifest entry by its exact asset-definition ID", () => {
		const base = projectWithItem("model-1");
		const project = {
			...base,
			assetDefinitionRefs: [
				glbDefinition("unrelated-model"),
				...base.assetDefinitionRefs,
			],
		};

		expect(
			recolorParametricFloorItem(
				project,
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				"2026-08-25T14:34:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_COLOR_NOT_SUPPORTED" });
	});
});
