import { describe, expect, it } from "@rstest/core";
import { addDoorOpeningToProject } from "./door-opening-project";
import { createInitialProject } from "./initial-project";
import {
	assessParametricWallItemPlacement,
	createParametricWallItem,
	deleteParametricWallItem,
	moveParametricWallItem,
	recolorParametricWallItem,
	setParametricWallItemLock,
	type ParametricWallItemInput,
} from "./parametric-wall-item";
import type { Project, WallSchematicAssetInstance } from "./project";
import { configureRectangularRoom } from "./rectangular-room";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function roomProject() {
	const result = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-23T15:15:00.000Z",
			levelId: "level-1",
			name: "Гостиная",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids(
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
		),
		"2026-08-23T15:16:00.000Z",
	);
	if (result.kind !== "accepted") throw new Error("Expected room fixture");
	return result.project;
}

function wallItem(project: Project, assetInstanceId: string): WallSchematicAssetInstance {
	const item = project.assetInstances.find(
		(candidate): candidate is WallSchematicAssetInstance =>
			candidate.anchorClass === "wall" &&
			candidate.assetInstanceId === assetInstanceId,
	);
	if (!item) throw new Error(`Expected wall item ${assetInstanceId}`);
	return item;
}

describe("createParametricWallItem", () => {
	it("creates a wall-hosted panel at an integer local offset without world coordinates", () => {
		const project = roomProject();

		const result = createParametricWallItem(
			project,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("wall-item-1"),
			"2026-08-23T15:17:00.000Z",
		);

		expect(result).toEqual({
			kind: "accepted",
			project: expect.objectContaining({
				assetInstances: [
					{
						anchorClass: "wall",
						assetInstanceId: "wall-item-1",
						color: "#416b91",
						depthMm: 50,
						elevationMm: 1300,
						heightMm: 600,
						label: "Настенная панель",
						offsetMm: 2050,
						side: "left",
						wallSegmentId: "wall-1",
						widthMm: 900,
					},
				],
				updatedAt: "2026-08-23T15:17:00.000Z",
			}),
		});
	});

	it("accepts only resource-backed wall models declared by the current project", () => {
		const input = {
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Настенная панель",
			offsetMm: 2050,
			side: "left" as const,
			wallSegmentId: "wall-1",
			widthMm: 900,
		};
		const projectWithoutPinnedModel = roomProject();
		const withoutCatalogReference = createParametricWallItem(
			projectWithoutPinnedModel,
			input,
			ids("plain-panel"),
			"2026-08-25T14:00:00.000Z",
		);
		const unknownModelReference = createParametricWallItem(
			roomProject(),
			{ ...input, assetDefinitionId: "catalog-panel" },
			ids("must-not-allocate"),
			"2026-08-25T14:00:00.000Z",
		);
		const projectWithPinnedModel = {
			...roomProject(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "catalog-panel",
					byteLength: 1024,
					depthMm: 50,
					displayName: "GLB-панель",
					format: "glb" as const,
					heightMm: 600,
					resourceHash:
						"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					widthMm: 900,
				},
			],
		};
		const projectWithDifferentPinnedModel = {
			...projectWithPinnedModel,
			assetDefinitionRefs: projectWithPinnedModel.assetDefinitionRefs.map(
				(definition) => ({
					...definition,
					assetDefinitionId: "different-catalog-panel",
				}),
			),
		};
		const wrongPinnedModelReference = createParametricWallItem(
			projectWithDifferentPinnedModel,
			{ ...input, assetDefinitionId: "catalog-panel" },
			ids("must-not-allocate-wrong-reference"),
			"2026-08-25T14:00:00.000Z",
		);
		const withPinnedModelReference = createParametricWallItem(
			projectWithPinnedModel,
			{ ...input, assetDefinitionId: "catalog-panel" },
			ids("catalog-panel-instance"),
			"2026-08-25T14:00:00.000Z",
		);
		if (
			withoutCatalogReference.kind !== "accepted" ||
			withPinnedModelReference.kind !== "accepted"
		) {
			throw new Error("Expected the placeholder and declared model to be accepted");
		}
		const [plainPanel] = withoutCatalogReference.project.assetInstances;
		const [catalogPanel] = withPinnedModelReference.project.assetInstances;
		if (!plainPanel || !catalogPanel) throw new Error("Expected both panels");

		expect(Object.hasOwn(plainPanel, "assetDefinitionId")).toBe(false);
		expect(unknownModelReference).toEqual({
			kind: "rejected",
			reasonCode: "ASSET_DEFINITION_NOT_PINNED",
		});
		expect(wrongPinnedModelReference).toEqual({
			kind: "rejected",
			reasonCode: "ASSET_DEFINITION_NOT_PINNED",
		});
		expect(projectWithoutPinnedModel.assetInstances).toEqual([]);
		expect(catalogPanel).toEqual(
			expect.objectContaining({ assetDefinitionId: "catalog-panel" }),
		);
	});

	it("keeps the project unchanged when a panel would cross its wall bounds or height", () => {
		const project = roomProject();
		const input = {
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Настенная панель",
			offsetMm: 2050,
			side: "left",
			wallSegmentId: "wall-1",
			widthMm: 900,
		} satisfies ParametricWallItemInput;

		expect(
			createParametricWallItem(
				project,
				{ ...input, offsetMm: 449 },
				ids("must-not-allocate"),
				"2026-08-23T15:17:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_WALL_HOST" });
		expect(
			createParametricWallItem(
				project,
				{ ...input, elevationMm: 2301 },
				ids("must-not-allocate"),
				"2026-08-23T15:17:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_WALL_HOST" });
		expect(project.assetInstances).toEqual([]);
	});

	it("rejects a panel that would occupy the opening void on its wall", () => {
		const withDoor = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-23T15:17:00.000Z",
		);
		if (withDoor.kind !== "accepted") throw new Error("Expected door fixture");

		expect(
			createParametricWallItem(
				withDoor.project,
				{
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Настенная панель",
					offsetMm: 2050,
					side: "left",
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				ids("must-not-allocate"),
				"2026-08-23T15:18:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" });
	});

	it("accepts a panel whose edge exactly touches an opening edge", () => {
		const withDoor = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-23T15:17:00.000Z",
		);
		if (withDoor.kind !== "accepted") throw new Error("Expected door fixture");

		expect(
			createParametricWallItem(
				withDoor.project,
				{
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Настенная панель",
					offsetMm: 1150,
					side: "left",
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				ids("panel-1"),
				"2026-08-23T15:18:00.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("retains a same-side wall-panel overlap as a semantic warning while leaving touching, vertically separate and independently hosted panels valid", () => {
		const first = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Первая панель",
				offsetMm: 2500,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-25T13:00:00.000Z",
		);
		if (first.kind !== "accepted") throw new Error("Expected first panel");
		const base = {
			color: "#8b4f27",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Следующая панель",
			offsetMm: 2100,
			side: "left" as const,
			wallSegmentId: "wall-1",
			widthMm: 900,
		};

		for (const offsetMm of [2100, 2700, 2900]) {
			expect(
				createParametricWallItem(
					first.project,
					{ ...base, offsetMm },
					ids("must-not-allocate"),
					"2026-08-25T13:01:00.000Z",
				),
			).toEqual(
				expect.objectContaining({
					kind: "accepted",
					warnings: [{ assetInstanceId: "panel-1", kind: "wall-item" }],
				}),
			);
		}
		expect(first.project.assetInstances).toHaveLength(1);

		for (const input of [
			{ ...base, label: "Касается слева", offsetMm: 1600 },
			{ ...base, label: "Касается справа", offsetMm: 3400 },
			{ ...base, label: "Выше по стене", elevationMm: 2200, offsetMm: 2500 },
			{ ...base, label: "Касается сверху", elevationMm: 1900, offsetMm: 2500 },
			{ ...base, label: "Касается снизу", elevationMm: 700, offsetMm: 2500 },
			{ ...base, label: "С обратной стороны", offsetMm: 2500, side: "right" as const },
			{ ...base, label: "На другой стене", offsetMm: 2500, wallSegmentId: "wall-2" },
		]) {
			expect(
				createParametricWallItem(
					first.project,
					input,
					ids("panel-2"),
					"2026-08-25T13:02:00.000Z",
				),
			).toEqual(expect.objectContaining({ kind: "accepted" }));
		}
	});

	it("assesses an adjacent duplicate against the same collision rules without changing the project", () => {
		const source = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Исходная панель",
				offsetMm: 900,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("source-panel"),
			"2026-08-25T14:00:00.000Z",
		);
		if (source.kind !== "accepted") throw new Error("Expected source panel");
		const occupiedNeighbor = createParametricWallItem(
			source.project,
			{
				color: "#8b4f27",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Занятая соседняя позиция",
				offsetMm: 1800,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("occupied-panel"),
			"2026-08-25T14:01:00.000Z",
		);
		if (occupiedNeighbor.kind !== "accepted") {
			throw new Error("Expected occupied neighbor");
		}
		const duplicateCandidate = {
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Копия исходной панели",
			offsetMm: 1800,
			side: "left" as const,
			wallSegmentId: "wall-1",
			widthMm: 900,
		};

		expect(
			assessParametricWallItemPlacement(
				occupiedNeighbor.project,
				duplicateCandidate,
			),
		).toEqual({
			kind: "accepted",
			warnings: [{ assetInstanceId: "occupied-panel", kind: "wall-item" }],
		});
		expect(
			assessParametricWallItemPlacement(occupiedNeighbor.project, {
				...duplicateCandidate,
				offsetMm: 2700,
			}),
		).toEqual({ kind: "accepted" });
		expect(
			assessParametricWallItemPlacement(occupiedNeighbor.project, {
				...duplicateCandidate,
				label: " ",
			}),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		expect(occupiedNeighbor.project.assetInstances).toHaveLength(2);
	});

	it("moves exactly one panel using only its wall-local offset and elevation", () => {
		const placed = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-24T00:01:00.000Z",
		);
		if (placed.kind !== "accepted") throw new Error("Expected panel fixture");

		const moved = moveParametricWallItem(
			placed.project,
			{
				assetInstanceId: "panel-1",
				elevationMm: 2100,
				offsetMm: 3100,
			},
			"2026-08-24T00:02:00.000Z",
		);
		expect(moved).toEqual({
			kind: "accepted",
			project: expect.objectContaining({
				assetInstances: [
					expect.objectContaining({
						assetInstanceId: "panel-1",
						elevationMm: 2100,
						offsetMm: 3100,
						side: "left",
						wallSegmentId: "wall-1",
					}),
				],
				updatedAt: "2026-08-24T00:02:00.000Z",
			}),
		});
		expect(moved).not.toHaveProperty("warnings");
	});

	it("keeps the durable panel unchanged when a new local address crosses an opening or becomes invalid", () => {
		const withDoor = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-24T00:01:00.000Z",
		);
		if (withDoor.kind !== "accepted") throw new Error("Expected door fixture");
		const placed = createParametricWallItem(
			withDoor.project,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 2000,
				heightMm: 200,
				label: "Настенная панель",
				offsetMm: 1150,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-24T00:02:00.000Z",
		);
		if (placed.kind !== "accepted") throw new Error("Expected panel fixture");

		expect(
			moveParametricWallItem(
				placed.project,
				{ assetInstanceId: "panel-1", elevationMm: 2000, offsetMm: 1151 },
				"2026-08-24T00:03:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" });
		expect(
			moveParametricWallItem(
				placed.project,
				{ assetInstanceId: "panel-1", elevationMm: -1, offsetMm: 1150 },
				"2026-08-24T00:03:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_WALL_POSITION" });
		expect(placed.project.assetInstances).toEqual([
			expect.objectContaining({ elevationMm: 2000, offsetMm: 1150 }),
		]);
	});

	it("retains a warning when a move passes through another same-side panel", () => {
		const first = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Первая панель",
				offsetMm: 2500,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-25T13:03:00.000Z",
		);
		if (first.kind !== "accepted") throw new Error("Expected first panel");
		const second = createParametricWallItem(
			first.project,
			{
				color: "#8b4f27",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Вторая панель",
				offsetMm: 1000,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-2"),
			"2026-08-25T13:04:00.000Z",
		);
		if (second.kind !== "accepted") throw new Error("Expected second panel");

		expect(
			moveParametricWallItem(
				second.project,
				{ assetInstanceId: "panel-2", elevationMm: 1300, offsetMm: 2000 },
				"2026-08-25T13:05:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				warnings: [{ assetInstanceId: "panel-1", kind: "wall-item" }],
			}),
		);

		const movedClear = moveParametricWallItem(
			second.project,
			{ assetInstanceId: "panel-2", elevationMm: 1300, offsetMm: 1600 },
			"2026-08-25T13:06:00.000Z",
		);
		expect(movedClear).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(movedClear).not.toHaveProperty("warnings");
	});

	it("moves only the selected wall panel and never treats a floor item as its host", () => {
		const first = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Первая панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-24T00:04:00.000Z",
		);
		if (first.kind !== "accepted") throw new Error("Expected first panel");
		const second = createParametricWallItem(
			first.project,
			{
				color: "#8b4f27",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Вторая панель",
				offsetMm: 1550,
				side: "right",
				wallSegmentId: "wall-2",
				widthMm: 900,
			},
			ids("panel-2"),
			"2026-08-24T00:05:00.000Z",
		);
		if (second.kind !== "accepted") throw new Error("Expected second panel");

		expect(
			moveParametricWallItem(
				second.project,
				{ assetInstanceId: "panel-2", elevationMm: 2100, offsetMm: 2000 },
				"2026-08-24T00:06:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "panel-1",
							elevationMm: 1300,
							offsetMm: 2050,
						}),
						expect.objectContaining({
							assetInstanceId: "panel-2",
							elevationMm: 2100,
							offsetMm: 2000,
							wallSegmentId: "wall-2",
						}),
					],
				}),
			}),
		);
		expect(
			moveParametricWallItem(
				{
					...roomProject(),
					assetInstances: [
						{
							anchorClass: "floor",
							assetInstanceId: "floor-1",
							color: "#416b91",
							depthMm: 500,
							heightMm: 750,
							label: "Стол",
							roomId: "room-1",
							widthMm: 500,
							xMm: 1000,
							zMm: 1000,
						},
					],
				},
				{ assetInstanceId: "floor-1", elevationMm: 1300, offsetMm: 2050 },
				"2026-08-24T00:06:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" });
	});

	it("rejects a missing host and unsafe local millimetres before changing the panel", () => {
		const placed = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-24T00:04:00.000Z",
		);
		if (placed.kind !== "accepted") throw new Error("Expected panel fixture");
		const missingHostProject = {
			...placed.project,
			level: { ...placed.project.level, vertices: [] },
		};

		expect(
			moveParametricWallItem(
				missingHostProject,
				{ assetInstanceId: "panel-1", elevationMm: 1300, offsetMm: 2050 },
				"2026-08-24T00:05:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_HOST_NOT_FOUND" });
		for (const input of [
			{ assetInstanceId: "panel-1", elevationMm: 1300.5, offsetMm: 2050 },
			{ assetInstanceId: "panel-1", elevationMm: -1, offsetMm: 2050 },
			{ assetInstanceId: "panel-1", elevationMm: 1300, offsetMm: -1 },
		]) {
			expect(
				moveParametricWallItem(
					placed.project,
					input,
					"2026-08-24T00:05:00.000Z",
				),
			).toEqual({ kind: "rejected", reasonCode: "INVALID_WALL_POSITION" });
		}
		for (const input of [
			{ assetInstanceId: "panel-1", elevationMm: 0, offsetMm: 2050 },
			{ assetInstanceId: "panel-1", elevationMm: 1300, offsetMm: 0 },
		]) {
			expect(
				moveParametricWallItem(
					placed.project,
					input,
					"2026-08-24T00:05:00.000Z",
				),
			).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_WALL_HOST" });
		}
	});

	it("checks the selected wall's own host dimensions instead of the first wall host", () => {
		const placed = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2500,
				side: "left",
				wallSegmentId: "wall-2",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-24T00:04:00.000Z",
		);
		if (placed.kind !== "accepted") throw new Error("Expected panel fixture");

		expect(
			moveParametricWallItem(
				placed.project,
				{ assetInstanceId: "panel-1", elevationMm: 1300, offsetMm: 2700 },
				"2026-08-24T00:05:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_WALL_HOST" });
	});

	it("deletes only a wall-hosted object and leaves a floor item untouched", () => {
		const panel = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-23T15:18:00.000Z",
		);
		if (panel.kind !== "accepted") throw new Error("Expected panel fixture");

		expect(
			deleteParametricWallItem(
				panel.project,
				{ assetInstanceId: "panel-1" },
				"2026-08-23T15:19:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({ assetInstances: [] }),
			}),
		);
		expect(
			deleteParametricWallItem(
				{
					...roomProject(),
					assetInstances: [
						{
							anchorClass: "floor",
							assetInstanceId: "floor-1",
							color: "#416b91",
							depthMm: 500,
							heightMm: 750,
							label: "Стол",
							roomId: "room-1",
							widthMm: 500,
							xMm: 1000,
							zMm: 1000,
						},
					],
				},
				{ assetInstanceId: "floor-1" },
				"2026-08-23T15:19:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" });
	});

	it("locks exactly one wall item, then refuses its accidental move and deletion until explicit unlock", () => {
		const first = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Первая панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-25T00:40:00.000Z",
		);
		if (first.kind !== "accepted") throw new Error("Expected first panel");
		const second = createParametricWallItem(
			first.project,
			{
				color: "#8b4f27",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Вторая панель",
				offsetMm: 2050,
				side: "right",
				wallSegmentId: "wall-2",
				widthMm: 900,
			},
			ids("panel-2"),
			"2026-08-25T00:41:00.000Z",
		);
		if (second.kind !== "accepted") throw new Error("Expected second panel");

		const locked = setParametricWallItemLock(
			second.project,
			{ assetInstanceId: "panel-2", locked: true },
			"2026-08-25T00:42:00.000Z",
		);
		if (locked.kind !== "accepted") throw new Error("Expected lock result");
		expect(locked.project.updatedAt).toBe("2026-08-25T00:42:00.000Z");
		expect(wallItem(locked.project, "panel-1").locked).toBeUndefined();
		expect(wallItem(locked.project, "panel-2").locked).toBe(true);

		expect(
			moveParametricWallItem(
				locked.project,
				{ assetInstanceId: "panel-2", elevationMm: 1300, offsetMm: 2500 },
				"2026-08-25T00:43:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_LOCKED" });
		expect(
			deleteParametricWallItem(
				locked.project,
				{ assetInstanceId: "panel-2" },
				"2026-08-25T00:43:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_LOCKED" });
		expect(wallItem(locked.project, "panel-1").locked).toBeUndefined();
		expect(wallItem(locked.project, "panel-2").offsetMm).toBe(2050);

		const unlocked = setParametricWallItemLock(
			locked.project,
			{ assetInstanceId: "panel-2", locked: false },
			"2026-08-25T00:44:00.000Z",
		);
		if (unlocked.kind !== "accepted") throw new Error("Expected unlock result");
		expect(wallItem(unlocked.project, "panel-1").locked).toBeUndefined();
		expect(wallItem(unlocked.project, "panel-2").locked).toBeUndefined();
	});

	it("refuses an unknown, floor or unchanged wall-item lock command without changing the durable project", () => {
		const panel = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-25T00:45:00.000Z",
		);
		if (panel.kind !== "accepted") throw new Error("Expected panel fixture");

		expect(
			setParametricWallItemLock(
				panel.project,
				{ assetInstanceId: "missing", locked: true },
				"2026-08-25T00:46:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" });
		expect(
			setParametricWallItemLock(
				panel.project,
				{ assetInstanceId: "panel-1", locked: false },
				"2026-08-25T00:46:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_LOCK_STATE_UNCHANGED" });
		expect(
			setParametricWallItemLock(
				{
					...roomProject(),
					assetInstances: [
						{
							anchorClass: "floor",
							assetInstanceId: "floor-1",
							color: "#416b91",
							depthMm: 500,
							heightMm: 750,
							label: "Стол",
							roomId: "room-1",
							widthMm: 500,
							xMm: 1000,
							zMm: 1000,
						},
					],
				},
				{ assetInstanceId: "floor-1", locked: true },
				"2026-08-25T00:46:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" });
		expect(panel.project.assetInstances).toHaveLength(1);
		expect(wallItem(panel.project, "panel-1").locked).toBeUndefined();
	});
});

describe("recolorParametricWallItem", () => {
	it("changes only one unlocked wall panel to a declared color variant", () => {
		const first = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Первая панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-25T14:10:00.000Z",
		);
		if (first.kind !== "accepted") throw new Error("Expected first panel");
		const second = createParametricWallItem(
			first.project,
			{
				color: "#8b4f27",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Вторая панель",
				offsetMm: 2050,
				side: "right",
				wallSegmentId: "wall-2",
				widthMm: 900,
			},
			ids("panel-2"),
			"2026-08-25T14:11:00.000Z",
		);
		if (second.kind !== "accepted") throw new Error("Expected second panel");

		const result = recolorParametricWallItem(
			second.project,
			{ assetInstanceId: "panel-1", variantId: "alpha-warm-wood" },
			"2026-08-25T14:12:00.000Z",
		);
		if (result.kind !== "accepted") throw new Error("Expected recolor");
		expect(result.project.updatedAt).toBe("2026-08-25T14:12:00.000Z");
		expect(wallItem(result.project, "panel-1")).toEqual(
				expect.objectContaining({
					color: "#a76a3b",
					colorVariantId: "alpha-warm-wood",
				elevationMm: 1300,
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
			}),
		);
		expect(wallItem(result.project, "panel-2").color).toBe("#8b4f27");
		expect(wallItem(second.project, "panel-1").color).toBe("#416b91");

		const withAConflictingFloorIdentity = {
			...result.project,
			assetInstances: [
				...result.project.assetInstances,
				{
					anchorClass: "floor" as const,
					assetInstanceId: "panel-1",
					color: "#416b91",
					depthMm: 500,
					heightMm: 750,
					label: "Стол с чужим идентификатором",
					roomId: "room-1",
					widthMm: 500,
					xMm: 1000,
					zMm: 1000,
				},
			],
		};
		const targetStillMeansWall = recolorParametricWallItem(
			withAConflictingFloorIdentity,
			{ assetInstanceId: "panel-1", variantId: "alpha-violet" },
			"2026-08-25T14:12:30.000Z",
		);
		if (targetStillMeansWall.kind !== "accepted") {
			throw new Error("Expected wall target despite conflicting floor identity");
		}
		expect(
			targetStillMeansWall.project.assetInstances.find(
				(item) => item.anchorClass === "floor",
			),
		).toEqual(expect.objectContaining({ color: "#416b91" }));
	});

	it("rejects unsupported, locked, missing, and floor targets without changing a panel", () => {
		const created = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-25T14:13:00.000Z",
		);
		if (created.kind !== "accepted") throw new Error("Expected panel fixture");

		expect(
			recolorParametricWallItem(
				created.project,
				{ assetInstanceId: "panel-1", variantId: "unknown" as never },
				"2026-08-25T14:14:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_COLOR_UNSUPPORTED" });
		const locked = setParametricWallItemLock(
			created.project,
			{ assetInstanceId: "panel-1", locked: true },
			"2026-08-25T14:14:00.000Z",
		);
		if (locked.kind !== "accepted") throw new Error("Expected locked panel");
		expect(
			recolorParametricWallItem(
				locked.project,
				{ assetInstanceId: "panel-1", variantId: "alpha-warm-wood" },
				"2026-08-25T14:15:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_LOCKED" });
		expect(
			recolorParametricWallItem(
				created.project,
				{ assetInstanceId: "missing", variantId: "alpha-warm-wood" },
				"2026-08-25T14:15:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" });
		expect(
			recolorParametricWallItem(
				{
					...roomProject(),
					assetInstances: [
						{
							anchorClass: "floor",
							assetInstanceId: "floor-1",
							color: "#416b91",
							depthMm: 500,
							heightMm: 750,
							label: "Стол",
							roomId: "room-1",
							widthMm: 500,
							xMm: 1000,
							zMm: 1000,
						},
					],
				},
				{ assetInstanceId: "floor-1", variantId: "alpha-warm-wood" },
				"2026-08-25T14:15:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ITEM_NOT_FOUND" });
		expect(wallItem(created.project, "panel-1").color).toBe("#416b91");
	});

	it("does not recolor a wall item backed by a model without a declared color slot", () => {
		const project = {
			...roomProject(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "model-1",
					byteLength: 1024,
					depthMm: 50,
					displayName: "GLB-панель",
					format: "glb" as const,
					heightMm: 600,
					resourceHash:
						"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					widthMm: 900,
				},
			],
		};
		const created = createParametricWallItem(
			project,
			{
				assetDefinitionId: "model-1",
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "GLB-панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-25T14:30:00.000Z",
		);
		if (created.kind !== "accepted") throw new Error("Expected wall item");

		expect(
			recolorParametricWallItem(
				created.project,
				{ assetInstanceId: "panel-1", variantId: "alpha-warm-wood" },
				"2026-08-25T14:31:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_COLOR_NOT_SUPPORTED" });
		expect(wallItem(created.project, "panel-1")).toEqual(
			expect.objectContaining({
				assetDefinitionId: "model-1",
				color: "#416b91",
			}),
		);
	});

	it("keeps a legacy resource-free catalog panel recolorable beside an unrelated GLB", () => {
		const project = {
			...roomProject(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "unrelated-model",
					byteLength: 1024,
					depthMm: 50,
					displayName: "Другая GLB-панель",
					format: "glb" as const,
					heightMm: 600,
					resourceHash:
						"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
					widthMm: 900,
				},
			],
			assetInstances: [
				{
					anchorClass: "wall" as const,
					assetDefinitionId: "parametric-catalog-1",
					assetInstanceId: "panel-1",
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Параметрическая панель",
					offsetMm: 2050,
					side: "left" as const,
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
			],
		};

		expect(
			recolorParametricWallItem(
				project,
				{ assetInstanceId: "panel-1", variantId: "alpha-warm-wood" },
				"2026-08-25T14:36:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
			}),
		);
	});
});
