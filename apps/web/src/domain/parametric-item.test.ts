import { describe, expect, it } from "@rstest/core";
import { addConstrainedPartition } from "./constrained-partition";
import { addDoorOpeningToProject } from "./door-opening-project";
import { addGeneralWallToProject } from "./general-wall-project";
import { createInitialProject } from "./initial-project";
import {
	assessParametricFloorItemPlacement,
	createParametricFloorItem,
	deleteParametricFloorItem,
	findParametricFloorItemCollisionTargets,
	findRoomForFloorItem,
	floorItemFootprintIntersectsWall,
	moveParametricFloorItem,
	recolorParametricFloorItem,
	resizeParametricFloorItem,
	rotateParametricFloorItem,
	setParametricFloorItemLock,
	setParametricFloorItemYaw,
	yawRadiansFor,
} from "./parametric-item";
import { isFloorSchematicAssetInstance } from "./project";
import { configureRectangularRoom } from "./rectangular-room";
import { createRectangularRoomLoop } from "./rectangular-room-loop";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function idsThatMustNotAllocate() {
	return {
		next: () => {
			throw new Error("Rejected item placement must not allocate an ID");
		},
	};
}

function roomProject() {
	const result = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-05T14:15:16.000Z",
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
		"2026-08-05T14:16:16.000Z",
	);
	if (result.kind !== "accepted") {
		throw new Error("Expected room fixture");
	}
	return result.project;
}

describe("the initial floor-item pose", () => {
	it("rejects malformed initial steps before allocating a durable item", () => {
		const project = roomProject();
		for (const value of [
			-1,
			8,
			0.5,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			"2",
			null,
		]) {
			const input = {
				roomId: "room-1",
				label: "Невалидный угол",
				xMm: 2000,
				zMm: 1500,
				widthMm: 1200,
				depthMm: 400,
				heightMm: 800,
				color: "#716796",
				yawStep: value as 0,
			};
			expect(
				createParametricFloorItem(
					project,
					input,
					idsThatMustNotAllocate(),
					project.updatedAt,
				),
			).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		}
	});
	it("validates and creates every declared rotation step as the same pose", () => {
		const project = roomProject();
		for (const yawStep of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
			const input = {
				roomId: "room-1",
				label: "Поворот до установки",
				xMm: 2000,
				zMm: 1500,
				widthMm: 1200,
				depthMm: 400,
				heightMm: 800,
				color: "#716796",
				yawStep,
			};
			expect(assessParametricFloorItemPlacement(project, input)).toEqual({
				kind: "valid",
			});
			const created = createParametricFloorItem(
				project,
				input,
				ids(`pose-${yawStep}`),
				project.updatedAt,
			);
			expect(created.kind).toBe("accepted");
			if (created.kind !== "accepted")
				throw new Error("Expected valid rotated item");
			expect(created.project.assetInstances[0]).toMatchObject({
				yawStep,
				xMm: 2000,
				zMm: 1500,
			});
			expect(created.project.assetInstances[0]).not.toHaveProperty(
				"yawRadians",
			);
		}
	});
	it("rejects a rotated footprint that no longer fits before allocating an id", () => {
		const project = roomProject();
		const input = {
			roomId: "room-1",
			label: "У края",
			xMm: 2000,
			zMm: 300,
			widthMm: 1200,
			depthMm: 400,
			heightMm: 800,
			color: "#716796",
			yawStep: 2 as const,
		};
		expect(
			createParametricFloorItem(
				project,
				input,
				idsThatMustNotAllocate(),
				project.updatedAt,
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
	});
});

function disconnectedRoomProject() {
	const result = createRectangularRoomLoop(
		roomProject(),
		{ maxXMm: 7100, maxZMm: 6600, minXMm: 5000, minZMm: 5000 },
		ids(
			"v-5",
			"v-6",
			"v-7",
			"v-8",
			"wall-5",
			"wall-6",
			"wall-7",
			"wall-8",
			"room-2",
		),
		"2026-08-06T09:17:00.000Z",
	);
	if (result.kind !== "accepted") {
		throw new Error("Expected a disconnected room fixture");
	}
	return result.project;
}

function triangularRoomProject() {
	const empty = createInitialProject({
		createdAt: "2026-08-24T10:20:00.000Z",
		levelId: "level-triangle",
		name: "Треугольная комната",
		projectId: "project-triangle",
	});
	const bottom = addGeneralWallToProject(
		empty,
		{
			end: { xMm: 2000, zMm: 0 },
			start: { xMm: 0, zMm: 0 },
			thicknessMm: 100,
		},
		ids("triangle-a", "triangle-b", "triangle-bottom"),
		"2026-08-24T10:21:00.000Z",
	);
	if (bottom.kind !== "accepted") {
		throw new Error("Expected the triangle bottom wall");
	}
	const right = addGeneralWallToProject(
		bottom.project,
		{
			end: { xMm: 2000, zMm: 2000 },
			start: { xMm: 2000, zMm: 0 },
			thicknessMm: 100,
		},
		ids("triangle-c", "triangle-right"),
		"2026-08-24T10:22:00.000Z",
	);
	if (right.kind !== "accepted") {
		throw new Error("Expected the triangle right wall");
	}
	const closed = addGeneralWallToProject(
		right.project,
		{
			end: { xMm: 0, zMm: 0 },
			start: { xMm: 2000, zMm: 2000 },
			thicknessMm: 100,
		},
		ids("triangle-diagonal", "room-triangle"),
		"2026-08-24T10:23:00.000Z",
	);
	if (closed.kind !== "accepted") {
		throw new Error("Expected the closed triangular room");
	}
	return closed.project;
}

function concaveRoomProject() {
	const contour = [
		{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
		{ end: { xMm: 4000, zMm: 2000 }, start: { xMm: 4000, zMm: 0 } },
		{ end: { xMm: 2000, zMm: 2000 }, start: { xMm: 4000, zMm: 2000 } },
		{ end: { xMm: 2000, zMm: 4000 }, start: { xMm: 2000, zMm: 2000 } },
		{ end: { xMm: 0, zMm: 4000 }, start: { xMm: 2000, zMm: 4000 } },
		{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 4000 } },
	] as const;
	return contour.reduce(
		(project, wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === contour.length - 1
					? ids(`concave-wall-${index + 1}`, "room-concave")
					: ids(
							...(index === 0
								? ["concave-v-1", "concave-v-2", "concave-wall-1"]
								: [`concave-v-${index + 2}`, `concave-wall-${index + 1}`]),
						),
				`2026-08-27T13:0${index}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a concave Room fixture");
			}
			return added.project;
		},
		createInitialProject({
			createdAt: "2026-08-27T13:00:00.000Z",
			levelId: "concave-level",
			name: "Вогнутая комната",
			projectId: "concave-project",
		}),
	);
}

describe("createParametricFloorItem", () => {
	it("hosts a floor item in either leg of a concave Room and rejects its missing quadrant", () => {
		const concave = concaveRoomProject();
		for (const footprint of [
			{ depthMm: 400, widthMm: 400, xMm: 3000, zMm: 1000 },
			{ depthMm: 400, widthMm: 400, xMm: 1000, zMm: 3000 },
		]) {
			expect(findRoomForFloorItem(concave, footprint)).toBe("room-concave");
		}
		expect(
			findRoomForFloorItem(concave, {
				depthMm: 400,
				widthMm: 400,
				xMm: 3000,
				zMm: 3000,
			}),
		).toBeUndefined();
		expect(
			findRoomForFloorItem(concave, {
				depthMm: 2000,
				widthMm: 2000,
				xMm: 1950,
				yawStep: 1,
				zMm: 1950,
			}),
		).toBeUndefined();
	});

	it("hosts a floor item in a triangular Room only when every footprint corner stays inside its usable polygon", () => {
		const triangle = triangularRoomProject();
		const safe = {
			color: "#2f80ed",
			depthMm: 400,
			heightMm: 750,
			label: "Стол в треугольнике",
			roomId: "room-triangle",
			widthMm: 400,
			xMm: 1400,
			zMm: 600,
		};

		expect(
			findRoomForFloorItem(triangle, {
				depthMm: safe.depthMm,
				widthMm: safe.widthMm,
				xMm: safe.xMm,
				zMm: safe.zMm,
			}),
		).toBe("room-triangle");
		expect(
			createParametricFloorItem(
				triangle,
				safe,
				ids("triangle-item"),
				"2026-08-24T10:24:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "triangle-item",
							roomId: "room-triangle",
						}),
					],
				}),
			}),
		);

		const crossesDiagonal = {
			...safe,
			xMm: 1200,
			zMm: 1000,
		};
		expect(
			findRoomForFloorItem(triangle, {
				depthMm: crossesDiagonal.depthMm,
				widthMm: crossesDiagonal.widthMm,
				xMm: crossesDiagonal.xMm,
				zMm: crossesDiagonal.zMm,
			}),
		).toBeUndefined();
		expect(
			createParametricFloorItem(
				triangle,
				crossesDiagonal,
				idsThatMustNotAllocate(),
				"2026-08-24T10:24:01.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });

		expect(
			findRoomForFloorItem(triangle, {
				depthMm: 400,
				widthMm: 400,
				xMm: 1300,
				yawRadians: Math.PI / 4,
				zMm: 950,
			}),
		).toBeUndefined();
		expect(triangle.assetInstances).toEqual([]);
	});

	it("classifies a prospective placement as valid or invalid without allocating an item identifier or mutating the project", () => {
		const project = roomProject();
		const input = {
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 2050,
			zMm: 1550,
		};

		expect(assessParametricFloorItemPlacement(project, input)).toEqual({
			kind: "valid",
		});
		expect(
			assessParametricFloorItemPlacement(project, { ...input, xMm: 3651 }),
		).toEqual({ kind: "invalid", reasonCode: "OUTSIDE_ROOM_HOST" });
		expect(project.assetInstances).toEqual([]);
	});

	it("marks a ghost red when its otherwise valid footprint crosses a detached wall", () => {
		const source = roomProject();
		// A detached segment is valid editable PlanGraph topology. It must still
		// block a prospective floor item even though it does not split the room
		// metadata into another host address.
		const project = {
			...source,
			level: {
				...source.level,
				vertices: [
					...source.level.vertices,
					{ vertexId: "detached-wall-start", xMm: 2050, zMm: 500 },
					{ vertexId: "detached-wall-end", xMm: 2050, zMm: 2500 },
				],
				wallSegments: [
					...source.level.wallSegments,
					{
						endVertexId: "detached-wall-end",
						startVertexId: "detached-wall-start",
						thicknessMm: 100,
						wallSegmentId: "detached-wall",
					},
				],
			},
		};

		expect(
			assessParametricFloorItemPlacement(project, {
				color: "#2f80ed",
				depthMm: 500,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 900,
				xMm: 2050,
				zMm: 1500,
			}),
		).toEqual({ kind: "invalid", reasonCode: "WALL_ITEM_COLLISION" });
		expect(project.assetInstances).toEqual([]);
	});

	it("keeps a door-clearance collision as a semantic warning that an explicit placement can retain", () => {
		const withDoor = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 1000,
				sillMm: 0,
				swingSide: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-13T16:00:00.000Z",
		);
		if (withDoor.kind !== "accepted")
			throw new Error("Expected a door fixture");

		const input = {
			color: "#2f80ed",
			depthMm: 300,
			heightMm: 750,
			label: "Тумба",
			roomId: "room-1",
			widthMm: 300,
			xMm: 700,
			zMm: 650,
		};
		expect(assessParametricFloorItemPlacement(withDoor.project, input)).toEqual(
			{
				kind: "warning",
				warnings: [{ kind: "door-clearance", openingId: "door-1" }],
			},
		);
		expect(
			createParametricFloorItem(
				withDoor.project,
				input,
				ids("item-1"),
				"2026-08-13T16:01:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				warnings: [{ kind: "door-clearance", openingId: "door-1" }],
			}),
		);
	});

	it("identifies the retained item, wall or door that makes a ghost placement invalid", () => {
		const first = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Первый стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1000,
			},
			ids("item-1"),
			"2026-08-13T16:00:01.000Z",
		);
		if (first.kind !== "accepted") throw new Error("Expected an item fixture");
		expect(
			findParametricFloorItemCollisionTargets(first.project, {
				depthMm: 700,
				widthMm: 1200,
				xMm: 1100,
				zMm: 1000,
			}),
		).toEqual([{ kind: "item", assetInstanceId: "item-1" }]);
		expect(
			findParametricFloorItemCollisionTargets(first.project, {
				depthMm: 700,
				widthMm: 1200.5,
				xMm: 1100,
				zMm: 1000,
			}),
		).toEqual([]);

		const source = roomProject();
		const withWall = {
			...source,
			level: {
				...source.level,
				vertices: [
					...source.level.vertices,
					{ vertexId: "detached-wall-start", xMm: 2050, zMm: 500 },
					{ vertexId: "detached-wall-end", xMm: 2050, zMm: 2500 },
				],
				wallSegments: [
					...source.level.wallSegments,
					{
						endVertexId: "detached-wall-end",
						startVertexId: "detached-wall-start",
						thicknessMm: 100,
						wallSegmentId: "detached-wall",
					},
				],
			},
		};
		expect(
			findParametricFloorItemCollisionTargets(withWall, {
				depthMm: 500,
				widthMm: 900,
				xMm: 2050,
				zMm: 1500,
			}),
		).toEqual([{ kind: "wall", wallSegmentId: "detached-wall" }]);

		const withDoor = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 1000,
				sillMm: 0,
				swingSide: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-13T16:00:00.000Z",
		);
		if (withDoor.kind !== "accepted")
			throw new Error("Expected a door fixture");
		expect(
			findParametricFloorItemCollisionTargets(withDoor.project, {
				depthMm: 300,
				widthMm: 300,
				xMm: 700,
				zMm: 650,
			}),
		).toEqual([{ kind: "door-clearance", openingId: "door-1" }]);
	});
	it("creates a host-addressed schematic floor item in canonical millimetres", () => {
		const result = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 2050,
				zMm: 1550,
			},
			ids("item-1"),
			"2026-08-05T14:17:16.000Z",
		);

		expect(result).toEqual({
			kind: "accepted",
			project: expect.objectContaining({
				assetInstances: [
					{
						anchorClass: "floor",
						assetInstanceId: "item-1",
						color: "#2f80ed",
						depthMm: 700,
						elevationMm: 0,
						heightMm: 750,
						label: "Стол",
						roomId: "room-1",
						widthMm: 1200,
						xMm: 2050,
						yawStep: 0,
						zMm: 1550,
					},
				],
				updatedAt: "2026-08-05T14:17:16.000Z",
			}),
		});
	});

	it("hosts and moves an item in a disconnected room loop without treating the empty gap as a room", () => {
		const placed = createParametricFloorItem(
			disconnectedRoomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-2",
				widthMm: 1200,
				xMm: 6050,
				zMm: 5800,
			},
			ids("item-1"),
			"2026-08-06T09:18:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected an item in the disconnected room");
		}

		expect(
			findRoomForFloorItem(placed.project, {
				depthMm: 700,
				widthMm: 1200,
				xMm: 6050,
				zMm: 5800,
			}),
		).toBe("room-2");
		expect(
			findRoomForFloorItem(placed.project, {
				depthMm: 700,
				widthMm: 1200,
				xMm: 4550,
				zMm: 4050,
			}),
		).toBeUndefined();
		expect(
			moveParametricFloorItem(
				placed.project,
				{ assetInstanceId: "item-1", xMm: 2050, zMm: 1550 },
				"2026-08-06T09:19:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "item-1",
							roomId: "room-1",
						}),
					],
				}),
			}),
		);
	});

	it.each([
		{
			depthMm: 700,
			heightMm: 750,
			roomId: "room-1",
			widthMm: 1200,
			xMm: 2050.5,
			zMm: 1550,
		},
		{
			depthMm: 0,
			heightMm: 750,
			roomId: "room-1",
			widthMm: 1200,
			xMm: 2050,
			zMm: 1550,
		},
		{
			depthMm: 700,
			heightMm: 750,
			roomId: "unknown",
			widthMm: 1200,
			xMm: 2050,
			zMm: 1550,
		},
	])("rejects an invalid floor item without changing the Project", (input) => {
		const project = roomProject();

		expect(
			createParametricFloorItem(
				project,
				{ ...input, color: "#2f80ed", label: "Стол" },
				ids("must-not-allocate"),
				"2026-08-05T14:17:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		expect(project.assetInstances).toEqual([]);
	});

	it.each([
		{
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 0,
			xMm: 2050,
			zMm: 1550,
		},
		{
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 0,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 2050,
			zMm: 1550,
		},
		{
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "   ",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 2050,
			zMm: 1550,
		},
		{
			color: "#2f80ed!",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 2050,
			zMm: 1550,
		},
		{
			color: "2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 2050,
			zMm: 1550,
		},
	])("rejects an item with an invalid canonical field", (input) => {
		expect(
			createParametricFloorItem(
				roomProject(),
				input,
				ids("must-not-allocate"),
				"2026-08-05T14:17:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
	});

	it("accepts an item that exactly touches every usable edge and rejects either one-millimetre overflow", () => {
		const edgeInput = {
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 3450,
			zMm: 2700,
		};

		expect(
			createParametricFloorItem(
				roomProject(),
				edgeInput,
				ids("edge-item"),
				"2026-08-05T14:17:16.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(
			createParametricFloorItem(
				roomProject(),
				{ ...edgeInput, xMm: 3451 },
				ids("overflow-x"),
				"2026-08-05T14:17:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
		expect(
			createParametricFloorItem(
				roomProject(),
				{ ...edgeInput, zMm: 2701 },
				ids("overflow-z"),
				"2026-08-05T14:17:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
	});

	it("rejects an item that is geometrically inside the overall plan but outside its named room after a divider", () => {
		const partition = addConstrainedPartition(
			roomProject(),
			{ offsetMm: 2000, orientation: "vertical" },
			ids(
				"vertex-top",
				"vertex-bottom",
				"wall-top-right",
				"wall-bottom-left",
				"wall-divider",
				"room-right",
			),
			"2026-08-05T14:17:16.000Z",
		);
		if (partition.kind !== "accepted") {
			throw new Error("Expected partition fixture");
		}

		expect(
			createParametricFloorItem(
				partition.project,
				{
					color: "#2f80ed",
					depthMm: 700,
					heightMm: 750,
					label: "Стол",
					roomId: "room-1",
					widthMm: 1200,
					xMm: 3000,
					zMm: 1550,
				},
				ids("must-not-allocate"),
				"2026-08-05T14:18:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
		expect(partition.project.assetInstances).toEqual([]);
	});

	it("accepts the same item when its host address names the room on that side of the divider", () => {
		const partition = addConstrainedPartition(
			roomProject(),
			{ offsetMm: 2000, orientation: "vertical" },
			ids(
				"vertex-top",
				"vertex-bottom",
				"wall-top-right",
				"wall-bottom-left",
				"wall-divider",
				"room-right",
			),
			"2026-08-05T14:17:16.000Z",
		);
		if (partition.kind !== "accepted") {
			throw new Error("Expected partition fixture");
		}

		expect(
			createParametricFloorItem(
				partition.project,
				{
					color: "#2f80ed",
					depthMm: 700,
					heightMm: 750,
					label: "Стол",
					roomId: "room-right",
					widthMm: 1200,
					xMm: 3000,
					zMm: 1550,
				},
				ids("item-right"),
				"2026-08-05T14:18:16.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("uses the horizontal room host address and refuses an unrecognised face fingerprint", () => {
		const partition = addConstrainedPartition(
			roomProject(),
			{ offsetMm: 1500, orientation: "horizontal" },
			ids(
				"vertex-left",
				"vertex-right",
				"wall-right-bottom",
				"wall-left-top",
				"wall-divider",
				"room-bottom",
			),
			"2026-08-05T14:17:16.000Z",
		);
		if (partition.kind !== "accepted") {
			throw new Error("Expected partition fixture");
		}
		const bottomItem = {
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-bottom",
			widthMm: 1200,
			xMm: 2050,
			zMm: 2300,
		};

		expect(
			createParametricFloorItem(
				partition.project,
				bottomItem,
				ids("item-bottom"),
				"2026-08-05T14:18:16.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(
			createParametricFloorItem(
				partition.project,
				{ ...bottomItem, roomId: "room-1" },
				ids("wrong-top-host"),
				"2026-08-05T14:18:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });

		const tampered = {
			...roomProject(),
			level: {
				...roomProject().level,
				rooms: [
					{
						...roomProject().level.rooms[0],
						faceFingerprint: "rectangular:4100:3100:100:tampered",
					},
				],
			},
		};
		expect(
			createParametricFloorItem(
				tampered,
				{ ...bottomItem, roomId: "room-1", zMm: 1550 },
				ids("tampered"),
				"2026-08-05T14:18:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
	});

	it("resolves the only grid cell that can contain a resized item and never falls back to the first room", () => {
		const vertical = addConstrainedPartition(
			roomProject(),
			{ offsetMm: 2000, orientation: "vertical" },
			ids(
				"vertex-top",
				"vertex-bottom",
				"wall-top-right",
				"wall-bottom-left",
				"wall-divider",
				"room-right",
			),
			"2026-08-05T14:17:16.000Z",
		);
		if (vertical.kind !== "accepted") {
			throw new Error("Expected vertical grid fixture");
		}
		const grid = addConstrainedPartition(
			vertical.project,
			{ offsetMm: 1500, orientation: "horizontal" },
			ids(
				"vertex-cross",
				"grid-wall-1",
				"grid-wall-2",
				"grid-wall-3",
				"grid-room-1",
				"grid-room-2",
			),
			"2026-08-05T14:18:16.000Z",
		);
		if (grid.kind !== "accepted") {
			throw new Error("Expected crossed grid fixture");
		}
		const bottomRight = grid.project.level.rooms.find(
			(room) => room.faceFingerprint === "grid:2000:4100:1500:3100:100",
		);
		if (!bottomRight) {
			throw new Error("Expected bottom-right room");
		}

		expect(
			findRoomForFloorItem(grid.project, {
				depthMm: 700,
				widthMm: 1200,
				xMm: 3000,
				zMm: 2300,
			}),
		).toBe(bottomRight.roomId);
		expect(
			findRoomForFloorItem(grid.project, {
				depthMm: 700,
				widthMm: 1200,
				xMm: 1900,
				zMm: 2300,
			}),
		).toBeUndefined();
	});

	it("moves a placed item to another grid cell only when its full footprint fits the new host", () => {
		const partition = addConstrainedPartition(
			roomProject(),
			{ offsetMm: 2000, orientation: "vertical" },
			ids(
				"vertex-top",
				"vertex-bottom",
				"wall-top-right",
				"wall-bottom-left",
				"wall-divider",
				"room-right",
			),
			"2026-08-05T14:17:16.000Z",
		);
		if (partition.kind !== "accepted") {
			throw new Error("Expected grid fixture");
		}
		const placed = createParametricFloorItem(
			partition.project,
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-05T14:18:16.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected placed item");
		}

		expect(
			moveParametricFloorItem(
				placed.project,
				{ assetInstanceId: "item-1", xMm: 3000, zMm: 1500 },
				"2026-08-05T14:19:16.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "item-1",
							roomId: "room-right",
							xMm: 3000,
							zMm: 1500,
						}),
					],
				}),
			}),
		);
		expect(
			moveParametricFloorItem(
				placed.project,
				{ assetInstanceId: "item-1", xMm: 2000, zMm: 1500 },
				"2026-08-05T14:19:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
		expect(
			moveParametricFloorItem(
				placed.project,
				{ assetInstanceId: "missing", xMm: 3000, zMm: 1500 },
				"2026-08-05T14:19:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		expect(
			moveParametricFloorItem(
				placed.project,
				{ assetInstanceId: "item-1", xMm: 3000.5, zMm: 1500 },
				"2026-08-05T14:19:16.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		expect(
			findRoomForFloorItem(placed.project, {
				depthMm: 0,
				widthMm: 1200,
				xMm: 3000,
				zMm: 1500,
			}),
		).toBeUndefined();
	});

	it("keeps an item collision as a semantic warning while an exact edge touch remains valid", () => {
		const first = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Первый стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1000,
			},
			ids("item-1"),
			"2026-08-06T08:00:00.000Z",
		);
		if (first.kind !== "accepted") {
			throw new Error("Expected first item");
		}

		expect(
			createParametricFloorItem(
				first.project,
				{
					color: "#e67e22",
					depthMm: 700,
					heightMm: 750,
					label: "Пересечение",
					roomId: "room-1",
					widthMm: 1200,
					xMm: 1100,
					zMm: 1000,
				},
				ids("item-overlap"),
				"2026-08-06T08:00:01.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				warnings: [{ assetInstanceId: "item-1", kind: "item" }],
			}),
		);
		const touching = createParametricFloorItem(
			first.project,
			{
				color: "#e67e22",
				depthMm: 700,
				heightMm: 750,
				label: "Касание",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 2200,
				zMm: 1000,
			},
			ids("item-2"),
			"2026-08-06T08:00:01.000Z",
		);
		expect(touching).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (touching.kind !== "accepted") {
			throw new Error("Expected edge-touching item");
		}
		expect(
			moveParametricFloorItem(
				touching.project,
				{ assetInstanceId: "item-2", xMm: 1100, zMm: 1000 },
				"2026-08-06T08:00:02.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				warnings: [{ assetInstanceId: "item-1", kind: "item" }],
			}),
		);
	});

	it("treats touching and separated depth boundaries as non-overlapping in both placement orders", () => {
		const first = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Первый стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1000,
			},
			ids("item-1"),
			"2026-08-06T08:00:00.000Z",
		);
		if (first.kind !== "accepted") {
			throw new Error("Expected first item");
		}
		const touchingAlongZ = createParametricFloorItem(
			first.project,
			{
				color: "#e67e22",
				depthMm: 700,
				heightMm: 750,
				label: "Касание по глубине",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1700,
			},
			ids("item-2"),
			"2026-08-06T08:00:01.000Z",
		);
		expect(touchingAlongZ).toEqual(
			expect.objectContaining({ kind: "accepted" }),
		);
		if (touchingAlongZ.kind !== "accepted") {
			throw new Error("Expected depth-edge touching item");
		}
		expect(
			moveParametricFloorItem(
				touchingAlongZ.project,
				{ assetInstanceId: "item-2", xMm: 1000, zMm: 1700 },
				"2026-08-06T08:00:02.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(
			createParametricFloorItem(
				first.project,
				{
					color: "#e67e22",
					depthMm: 700,
					heightMm: 750,
					label: "Раздельно по глубине",
					roomId: "room-1",
					widthMm: 1200,
					xMm: 1000,
					zMm: 1800,
				},
				ids("item-3"),
				"2026-08-06T08:00:03.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("accepts a horizontal exact edge touch when the new item is left of the existing item", () => {
		const right = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Правый стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 2200,
				zMm: 1000,
			},
			ids("item-right"),
			"2026-08-06T08:00:00.000Z",
		);
		if (right.kind !== "accepted") {
			throw new Error("Expected right item");
		}
		expect(
			createParametricFloorItem(
				right.project,
				{
					color: "#e67e22",
					depthMm: 700,
					heightMm: 750,
					label: "Левый стол",
					roomId: "room-1",
					widthMm: 1200,
					xMm: 1000,
					zMm: 1000,
				},
				ids("item-left"),
				"2026-08-06T08:00:01.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("accepts a depth exact edge touch when the new item is in front of the existing item", () => {
		const back = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Задний стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1700,
			},
			ids("item-back"),
			"2026-08-06T08:00:00.000Z",
		);
		if (back.kind !== "accepted") {
			throw new Error("Expected back item");
		}
		expect(
			createParametricFloorItem(
				back.project,
				{
					color: "#e67e22",
					depthMm: 700,
					heightMm: 750,
					label: "Передний стол",
					roomId: "room-1",
					widthMm: 1200,
					xMm: 1000,
					zMm: 1000,
				},
				ids("item-front"),
				"2026-08-06T08:00:01.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("resizes a selected item at its current grid location when it fits, retaining semantic overlap warnings", () => {
		const first = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1000,
			},
			ids("item-1"),
			"2026-08-06T08:00:00.000Z",
		);
		if (first.kind !== "accepted") {
			throw new Error("Expected first item");
		}
		const second = createParametricFloorItem(
			first.project,
			{
				color: "#e67e22",
				depthMm: 700,
				heightMm: 750,
				label: "Кресло",
				roomId: "room-1",
				widthMm: 600,
				xMm: 2100,
				zMm: 1000,
			},
			ids("item-2"),
			"2026-08-06T08:00:01.000Z",
		);
		if (second.kind !== "accepted") {
			throw new Error("Expected second item");
		}

		expect(
			resizeParametricFloorItem(
				second.project,
				{
					assetInstanceId: "item-1",
					depthMm: 900,
					heightMm: 900,
					widthMm: 1400,
				},
				"2026-08-06T08:00:02.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: expect.arrayContaining([
						expect.objectContaining({
							assetInstanceId: "item-1",
							depthMm: 900,
							heightMm: 900,
							widthMm: 1400,
						}),
					]),
				}),
			}),
		);
		expect(
			resizeParametricFloorItem(
				second.project,
				{
					assetInstanceId: "item-1",
					depthMm: 700,
					heightMm: 750,
					widthMm: 1700,
				},
				"2026-08-06T08:00:03.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				warnings: [{ assetInstanceId: "item-2", kind: "item" }],
			}),
		);
		expect(
			resizeParametricFloorItem(
				second.project,
				{ assetInstanceId: "item-1", depthMm: 0, heightMm: 750, widthMm: 1200 },
				"2026-08-06T08:00:04.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
	});

	it("rejects a dimension change for an instance backed by a fixed asset definition", () => {
		const project = {
			...roomProject(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "custom-sofa",
					byteLength: 1024,
					depthMm: 900,
					displayName: "Диван",
					format: "glb" as const,
					heightMm: 800,
					resourceHash: "a".repeat(64),
					widthMm: 1800,
				},
			],
		};
		const placed = createParametricFloorItem(
			project,
			{
				assetDefinitionId: "custom-sofa",
				color: "#2f80ed",
				depthMm: 900,
				heightMm: 800,
				label: "Диван",
				roomId: "room-1",
				widthMm: 1800,
				xMm: 1800,
				zMm: 1500,
			},
			ids("item-fixed"),
			"2026-08-28T20:30:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected the fixed-size asset to place");
		}

		expect(
			resizeParametricFloorItem(
				placed.project,
				{
					assetInstanceId: "item-fixed",
					depthMm: 900,
					heightMm: 800,
					widthMm: 1700,
				},
				"2026-08-28T20:31:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "FIXED_ASSET_DIMENSIONS" });
	});
});

describe("deleteParametricFloorItem", () => {
	it("removes exactly the selected floor item and advances the Project timestamp", () => {
		const first = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1000,
				zMm: 1000,
			},
			ids("item-1"),
			"2026-08-06T12:00:00.000Z",
		);
		if (first.kind !== "accepted") {
			throw new Error("Expected first floor item");
		}
		const second = createParametricFloorItem(
			first.project,
			{
				color: "#e67e22",
				depthMm: 700,
				heightMm: 750,
				label: "Кресло",
				roomId: "room-1",
				widthMm: 600,
				xMm: 2500,
				zMm: 1000,
			},
			ids("item-2"),
			"2026-08-06T12:00:01.000Z",
		);
		if (second.kind !== "accepted") {
			throw new Error("Expected second floor item");
		}

		const result = deleteParametricFloorItem(
			second.project,
			{ assetInstanceId: "item-1" },
			"2026-08-06T12:00:02.000Z",
		);

		expect(result).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "item-2",
							label: "Кресло",
						}),
					],
					updatedAt: "2026-08-06T12:00:02.000Z",
				}),
			}),
		);
		expect(
			second.project.assetInstances.map((item) => item.assetInstanceId),
		).toEqual(["item-1", "item-2"]);
	});

	it("rejects a missing item without changing the Project", () => {
		const project = roomProject();

		expect(
			deleteParametricFloorItem(
				project,
				{ assetInstanceId: "missing-item" },
				"2026-08-06T12:00:02.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_NOT_FOUND" });
		expect(project.assetInstances).toEqual([]);
		expect(project.updatedAt).toBe("2026-08-05T14:16:16.000Z");
	});
});

describe("rotateParametricFloorItem", () => {
	it("reads a legacy free yaw as its nearest declared durable step", () => {
		expect(yawRadiansFor({ yawRadians: Math.PI / 7 })).toBeCloseTo(Math.PI / 4);
	});

	it("quantises a confirmed free gesture to the sole durable 45-degree yawStep", () => {
		const placed = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1500,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-13T14:40:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected placed item");
		}

		expect(
			setParametricFloorItemYaw(
				placed.project,
				{ assetInstanceId: "item-1", yawRadians: Math.PI / 7 },
				"2026-08-13T14:41:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "item-1",
							yawStep: 1,
						}),
					],
				}),
			}),
		);
		const accepted = setParametricFloorItemYaw(
			placed.project,
			{ assetInstanceId: "item-1", yawRadians: Math.PI / 7 },
			"2026-08-13T14:41:00.000Z",
		);
		if (accepted.kind !== "accepted") {
			throw new Error("Expected a valid snapped rotation");
		}
		expect(accepted.project.assetInstances[0]).not.toHaveProperty("yawRadians");
	});

	it("stores one clockwise 45-degree RotationStep without changing the item position or dimensions", () => {
		const placed = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1500,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-12T10:00:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected placed item");
		}

		expect(
			rotateParametricFloorItem(
				placed.project,
				{ assetInstanceId: "item-1", deltaSteps: 1 },
				"2026-08-12T10:01:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "item-1",
							depthMm: 700,
							widthMm: 1200,
							xMm: 1500,
							yawStep: 1,
							zMm: 1500,
						}),
					],
					updatedAt: "2026-08-12T10:01:00.000Z",
				}),
			}),
		);
	});

	it.each([
		{ deltaSteps: 1, expectedYawStep: 0, yawStep: 7 },
		{ deltaSteps: -1, expectedYawStep: 7, yawStep: 0 },
	] as const)(
		"wraps RotationStep $yawStep by $deltaSteps through the eight allowed directions",
		({ deltaSteps, expectedYawStep, yawStep }) => {
			const placed = createParametricFloorItem(
				roomProject(),
				{
					color: "#2f80ed",
					depthMm: 700,
					heightMm: 750,
					label: "Стол",
					roomId: "room-1",
					widthMm: 1200,
					xMm: 1500,
					zMm: 1500,
				},
				ids("item-1"),
				"2026-08-12T10:00:00.000Z",
			);
			if (placed.kind !== "accepted") {
				throw new Error("Expected placed item");
			}
			const project = {
				...placed.project,
				assetInstances: placed.project.assetInstances.map((item) => ({
					...item,
					yawStep,
				})),
			};

			expect(
				rotateParametricFloorItem(
					project,
					{ assetInstanceId: "item-1", deltaSteps },
					"2026-08-12T10:01:00.000Z",
				),
			).toEqual(
				expect.objectContaining({
					kind: "accepted",
					project: expect.objectContaining({
						assetInstances: [
							expect.objectContaining({ yawStep: expectedYawStep }),
						],
					}),
				}),
			);
		},
	);

	it("rejects a turn which would send a retained rotated footprint through the room wall", () => {
		const placed = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол у стены",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 3450,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-12T10:00:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected edge-aligned item");
		}

		expect(
			rotateParametricFloorItem(
				placed.project,
				{ assetInstanceId: "item-1", deltaSteps: 1 },
				"2026-08-12T10:01:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
		const placedItem = placed.project.assetInstances[0];
		expect(
			placedItem && isFloorSchematicAssetInstance(placedItem)
				? placedItem.yawStep
				: undefined,
		).toBe(0);
	});

	it("retains a warning when a turn makes the rotated footprint overlap another retained item", () => {
		const first = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1500,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-12T10:00:00.000Z",
		);
		if (first.kind !== "accepted") {
			throw new Error("Expected first item");
		}
		const second = createParametricFloorItem(
			first.project,
			{
				color: "#e67e22",
				depthMm: 600,
				heightMm: 750,
				label: "Кресло",
				roomId: "room-1",
				widthMm: 600,
				xMm: 1350,
				zMm: 2200,
			},
			ids("item-2"),
			"2026-08-12T10:00:01.000Z",
		);
		if (second.kind !== "accepted") {
			throw new Error("Expected second item");
		}

		expect(
			rotateParametricFloorItem(
				second.project,
				{ assetInstanceId: "item-1", deltaSteps: 1 },
				"2026-08-12T10:01:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				warnings: [{ assetInstanceId: "item-2", kind: "item" }],
			}),
		);
	});

	it("rejects an invalid rotation intent or missing item without mutating the Project", () => {
		const placed = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 1200,
				xMm: 1500,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-12T10:00:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected placed item");
		}

		expect(
			rotateParametricFloorItem(
				placed.project,
				{ assetInstanceId: "item-1", deltaSteps: 0 as never },
				"2026-08-12T10:01:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		expect(
			rotateParametricFloorItem(
				placed.project,
				{ assetInstanceId: "missing", deltaSteps: 1 },
				"2026-08-12T10:01:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		expect(placed.project.assetInstances).toEqual([
			expect.objectContaining({ assetInstanceId: "item-1", yawStep: 0 }),
		]);
	});
});

describe("wall and floor-item collision symmetry", () => {
	it("uses the same positive-area body test for cardinal and 45-degree Walls", () => {
		const footprint = {
			depthMm: 700,
			widthMm: 1200,
			xMm: 2000,
			zMm: 1500,
		};

		expect(
			floorItemFootprintIntersectsWall(footprint, {
				end: { xMm: 3500, zMm: 1500 },
				start: { xMm: 500, zMm: 1500 },
				thicknessMm: 100,
			}),
		).toBe(true);
		expect(
			floorItemFootprintIntersectsWall(footprint, {
				end: { xMm: 2000, zMm: 2500 },
				start: { xMm: 2000, zMm: 500 },
				thicknessMm: 100,
			}),
		).toBe(true);
		expect(
			floorItemFootprintIntersectsWall(footprint, {
				end: { xMm: 2900, zMm: 2900 },
				start: { xMm: 1500, zMm: 1500 },
				thicknessMm: 100,
			}),
		).toBe(true);
		expect(
			floorItemFootprintIntersectsWall(footprint, {
				end: { xMm: 3900, zMm: 1900 },
				start: { xMm: 2500, zMm: 500 },
				thicknessMm: 100,
			}),
		).toBe(false);
	});

	it("fails closed for an invalid footprint or unsupported Wall body", () => {
		const footprint = {
			depthMm: 700,
			widthMm: 1200,
			xMm: 2000,
			zMm: 1500,
		};
		const crossingWall = {
			end: { xMm: 3500, zMm: 1500 },
			start: { xMm: 500, zMm: 1500 },
			thicknessMm: 100,
		};

		expect(
			floorItemFootprintIntersectsWall(
				{ ...footprint, xMm: 2000.5 },
				crossingWall,
			),
		).toBe(false);
		expect(
			floorItemFootprintIntersectsWall(footprint, {
				...crossingWall,
				end: { xMm: 3500, zMm: 1800 },
				start: { xMm: 500, zMm: 1000 },
			}),
		).toBe(false);
		expect(
			floorItemFootprintIntersectsWall(footprint, {
				...crossingWall,
				end: crossingWall.start,
			}),
		).toBe(false);
		expect(
			floorItemFootprintIntersectsWall(footprint, {
				...crossingWall,
				thicknessMm: -100,
			}),
		).toBe(false);
		expect(
			floorItemFootprintIntersectsWall(footprint, {
				...crossingWall,
				thicknessMm: 100.5,
			}),
		).toBe(false);
		expect(
			floorItemFootprintIntersectsWall(footprint, {
				...crossingWall,
				start: { xMm: 500.5, zMm: 1500 },
			}),
		).toBe(false);
	});

	it("rejects moving an item through an existing explicitly drawn wall", () => {
		const wall = addGeneralWallToProject(
			roomProject(),
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-12T10:00:00.000Z",
		);
		if (wall.kind !== "accepted") {
			throw new Error("Expected a wall fixture");
		}
		const item = createParametricFloorItem(
			wall.project,
			{
				color: "#2f80ed",
				depthMm: 700,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 900,
				xMm: 1000,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-12T10:01:00.000Z",
		);
		if (item.kind !== "accepted") {
			throw new Error("Expected item fixture");
		}

		expect(
			moveParametricFloorItem(
				item.project,
				{ assetInstanceId: "item-1", xMm: 2050, zMm: 1500 },
				"2026-08-12T10:02:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
	});
});

describe("setParametricFloorItemLock", () => {
	it("locks exactly one floor item and rejects every user-driven mutation until explicit unlock", () => {
		const placed = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 600,
				heightMm: 750,
				label: "Защищённый стол",
				roomId: "room-1",
				widthMm: 900,
				xMm: 1800,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-25T01:10:00.000Z",
		);
		if (placed.kind !== "accepted") throw new Error("Expected floor item");

		const locked = setParametricFloorItemLock(
			placed.project,
			{ assetInstanceId: "item-1", locked: true },
			"2026-08-25T01:11:00.000Z",
		);
		if (locked.kind !== "accepted") throw new Error("Expected item lock");
		expect(locked.project.assetInstances).toEqual([
			expect.objectContaining({ assetInstanceId: "item-1", locked: true }),
		]);

		for (const result of [
			moveParametricFloorItem(
				locked.project,
				{ assetInstanceId: "item-1", xMm: 2100, zMm: 1500 },
				"2026-08-25T01:12:00.000Z",
			),
			setParametricFloorItemYaw(
				locked.project,
				{ assetInstanceId: "item-1", yawRadians: Math.PI / 2 },
				"2026-08-25T01:12:00.000Z",
			),
			rotateParametricFloorItem(
				locked.project,
				{ assetInstanceId: "item-1", deltaSteps: 1 },
				"2026-08-25T01:12:00.000Z",
			),
			resizeParametricFloorItem(
				locked.project,
				{
					assetInstanceId: "item-1",
					depthMm: 700,
					heightMm: 800,
					widthMm: 1000,
				},
				"2026-08-25T01:12:00.000Z",
			),
			recolorParametricFloorItem(
				locked.project,
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				"2026-08-25T01:12:00.000Z",
			),
			deleteParametricFloorItem(
				locked.project,
				{ assetInstanceId: "item-1" },
				"2026-08-25T01:12:00.000Z",
			),
		]) {
			expect(result).toEqual({ kind: "rejected", reasonCode: "ITEM_LOCKED" });
		}
		expect(locked.project).toEqual(
			expect.objectContaining({
				assetInstances: [
					expect.objectContaining({
						assetInstanceId: "item-1",
						color: "#2f80ed",
						locked: true,
						xMm: 1800,
					}),
				],
				updatedAt: "2026-08-25T01:11:00.000Z",
			}),
		);

		const unlocked = setParametricFloorItemLock(
			locked.project,
			{ assetInstanceId: "item-1", locked: false },
			"2026-08-25T01:13:00.000Z",
		);
		if (unlocked.kind !== "accepted") throw new Error("Expected item unlock");
		expect(unlocked).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [expect.not.objectContaining({ locked: true })],
				}),
			}),
		);
		const recolored = recolorParametricFloorItem(
			unlocked.project,
			{ assetInstanceId: "item-1", variantId: "alpha-blue" },
			"2026-08-25T01:14:00.000Z",
		);
		if (recolored.kind !== "accepted")
			throw new Error("Expected unlocked recolor");
		expect(recolored.project.assetInstances[0]).toMatchObject({
			assetInstanceId: "item-1",
			color: "#416b91",
		});
		expect(recolored.project.assetInstances[0]).not.toHaveProperty("locked");
	});

	it("locks only the requested floor item when multiple floor items exist", () => {
		const first = createParametricFloorItem(
			roomProject(),
			{
				color: "#2f80ed",
				depthMm: 500,
				heightMm: 750,
				label: "Первый стол",
				roomId: "room-1",
				widthMm: 500,
				xMm: 900,
				zMm: 900,
			},
			ids("item-first"),
			"2026-08-25T01:10:00.000Z",
		);
		if (first.kind !== "accepted") throw new Error("Expected first floor item");
		const second = createParametricFloorItem(
			first.project,
			{
				color: "#416b91",
				depthMm: 500,
				heightMm: 750,
				label: "Второй стол",
				roomId: "room-1",
				widthMm: 500,
				xMm: 3000,
				zMm: 2100,
			},
			ids("item-second"),
			"2026-08-25T01:11:00.000Z",
		);
		if (second.kind !== "accepted")
			throw new Error("Expected second floor item");

		const locked = setParametricFloorItemLock(
			second.project,
			{ assetInstanceId: "item-second", locked: true },
			"2026-08-25T01:12:00.000Z",
		);
		if (locked.kind !== "accepted")
			throw new Error("Expected second item lock");
		const firstItem = locked.project.assetInstances.find(
			(item) => item.assetInstanceId === "item-first",
		);
		const secondItem = locked.project.assetInstances.find(
			(item) => item.assetInstanceId === "item-second",
		);
		expect(firstItem).toMatchObject({ assetInstanceId: "item-first" });
		expect(firstItem).not.toHaveProperty("locked");
		expect(secondItem).toMatchObject({
			assetInstanceId: "item-second",
			locked: true,
		});
	});

	it("rejects a missing or unchanged floor-item lock command without mutating its Project", () => {
		const project = roomProject();
		expect(
			setParametricFloorItemLock(
				project,
				{ assetInstanceId: "missing", locked: true },
				"2026-08-25T01:11:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_NOT_FOUND" });

		const placed = createParametricFloorItem(
			project,
			{
				color: "#2f80ed",
				depthMm: 600,
				heightMm: 750,
				label: "Стол",
				roomId: "room-1",
				widthMm: 900,
				xMm: 1800,
				zMm: 1500,
			},
			ids("item-1"),
			"2026-08-25T01:10:00.000Z",
		);
		if (placed.kind !== "accepted") throw new Error("Expected floor item");
		expect(
			setParametricFloorItemLock(
				placed.project,
				{ assetInstanceId: "item-1", locked: false },
				"2026-08-25T01:11:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_LOCK_STATE_UNCHANGED" });
		expect(placed.project.assetInstances[0]).not.toHaveProperty("locked");
	});
});

describe("exact floor placement yaw", () => {
	const input = {
		roomId: "room-1", label: "Стул", xMm: 1800, zMm: 1500,
		widthMm: 650, depthMm: 450, heightMm: 850, color: "#716796",
	};

	it("uses the same intermediate pose for placement, move, resize, recolor and lock", () => {
		const project = roomProject();
		const created = createParametricFloorItem(project, { ...input, yawMilliDeg: 37500 }, ids("chair"), project.updatedAt);
		if (created.kind !== "accepted") throw new Error(created.reasonCode);
		const rotatedItem = created.project.assetInstances[0];
		if (!rotatedItem || !isFloorSchematicAssetInstance(rotatedItem)) throw new Error("Expected floor item");
		expect(rotatedItem).toHaveProperty("yawMilliDeg", 37500);
		expect(rotatedItem).not.toHaveProperty("yawStep");
		expect(yawRadiansFor(rotatedItem)).toBeCloseTo(37.5 * Math.PI / 180, 12);

		const moved = moveParametricFloorItem(created.project, { assetInstanceId: "chair", xMm: 1700, zMm: 1450 }, project.updatedAt);
		if (moved.kind !== "accepted") throw new Error(moved.reasonCode);
		const resized = resizeParametricFloorItem(moved.project, { assetInstanceId: "chair", widthMm: 700, depthMm: 500, heightMm: 850 }, project.updatedAt);
		if (resized.kind !== "accepted") throw new Error(resized.reasonCode);
		const locked = setParametricFloorItemLock(resized.project, { assetInstanceId: "chair", locked: true }, project.updatedAt);
		if (locked.kind !== "accepted") throw new Error(locked.reasonCode);
		expect(locked.project.assetInstances[0]).toMatchObject({ locked: true, xMm: 1700, widthMm: 700, yawMilliDeg: 37500 });
		expect(locked.project.assetInstances[0]).not.toHaveProperty("yawStep");
	});

	it("guards millidegrees and uses the legacy representation at an exact 45° multiple", () => {
		const project = roomProject();
		for (const yawMilliDeg of [-1, 360000, 42.5, Number.POSITIVE_INFINITY]) {
			expect(createParametricFloorItem(project, { ...input, yawMilliDeg }, idsThatMustNotAllocate(), project.updatedAt)).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		}
		expect(createParametricFloorItem(project, { ...input, yawMilliDeg: 37500, yawStep: 1 }, idsThatMustNotAllocate(), project.updatedAt)).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		const created = createParametricFloorItem(project, { ...input, yawMilliDeg: 45000 }, ids("chair"), project.updatedAt);
		if (created.kind !== "accepted") throw new Error(created.reasonCode);
		expect(created.project.assetInstances[0]).toHaveProperty("yawStep", 1);
		expect(created.project.assetInstances[0]).not.toHaveProperty("yawMilliDeg");
		const rotated = setParametricFloorItemYaw(created.project, { assetInstanceId: "chair", yawRadians: 359.999 * Math.PI / 180, exact: true }, project.updatedAt);
		if (rotated.kind !== "accepted") throw new Error(rotated.reasonCode);
		expect(rotated.project.assetInstances[0]).toHaveProperty("yawMilliDeg", 359999);
	});
});
