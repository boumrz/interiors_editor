import { describe, expect, it } from "@rstest/core";
import { addConstrainedPartition } from "../../domain/constrained-partition";
import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
} from "../../domain/door-opening-project";
import {
	addGeneralWallToProject,
	changeGeneralWallThickness,
} from "../../domain/general-wall-project";
import { createInitialProject } from "../../domain/initial-project";
import { migrateProjectV1ToV2 } from "../../domain/migrate-project-v1-to-v2";
import { createParametricFloorItem } from "../../domain/parametric-item";
import { createParametricFloorItemV2 } from "../../domain/parametric-item-v2";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import { createRectangularRoomLoop } from "../../domain/rectangular-room-loop";
import { projectRectangularRoomForWebGl } from "./rectangular-room-projection";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

describe("projectRectangularRoomForWebGl", () => {
	it("projects physical joined corners into every wall solid without changing canonical dimensions", () => {
		const created = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-11-01T00:00:00.000Z",
				levelId: "level",
				name: "Joined",
				projectId: "joined",
			}),
			{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
			ids("a", "b", "c", "d", "north", "east", "south", "west", "room"),
			"2026-11-01T00:00:01.000Z",
		);
		if (created.kind !== "accepted") throw new Error("rectangle fixture");
		const scene = projectRectangularRoomForWebGl(created.project);
		const north = scene?.walls.find(
			(wall) => wall.wall?.wallSegmentId === "north",
		);
		expect(north?.wallFootprintM).toContainEqual({ xM: -0.05, zM: -0.05 });
		expect(north?.wallFootprintM).toContainEqual({ xM: 4.15, zM: -0.05 });
		expect(north?.heightM).toBe(2.6);
		const translated = {
			...created.project,
			level: {
				...created.project.level,
				vertices: created.project.level.vertices.map((vertex) => ({
					...vertex,
					xMm: vertex.xMm + 1100,
					zMm: vertex.zMm + 1700,
				})),
			},
		};
		expect(
			projectRectangularRoomForWebGl(translated)?.walls.map(
				(wall) => wall.wallFootprintM,
			),
		).toEqual(scene?.walls.map((wall) => wall.wallFootprintM));
		expect(
			created.project.level.wallSegments.map((wall) => wall.thicknessMm),
		).toEqual([100, 100, 100, 100]);
	});
	it("projects a durable 45-degree triangle as one exact disposable 3D floor polygon", () => {
		const source = {
			...createInitialProject({
				createdAt: "2026-08-23T13:20:00.000Z",
				levelId: "level-1",
				name: "Диагональная комната",
				projectId: "project-triangle-webgl",
			}),
			assetInstances: [
				{
					anchorClass: "wall" as const,
					assetInstanceId: "diagonal-panel-left",
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Диагональная панель",
					offsetMm: 1414,
					side: "left" as const,
					wallSegmentId: "diagonal",
					widthMm: 900,
				},
			],
			level: {
				levelId: "level-1",
				openings: [],
				rooms: [
					{
						faceFingerprint: "orthogonal-face:0:0|2000:0|2000:2000",
						heightMm: 2600,
						roomId: "room-triangle",
					},
				],
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "b", xMm: 2000, zMm: 0 },
					{ vertexId: "c", xMm: 2000, zMm: 2000 },
				],
				wallSegments: [
					{
						endVertexId: "b",
						startVertexId: "a",
						thicknessMm: 100,
						wallSegmentId: "bottom",
					},
					{
						endVertexId: "c",
						startVertexId: "b",
						thicknessMm: 100,
						wallSegmentId: "right",
					},
					{
						endVertexId: "a",
						startVertexId: "c",
						thicknessMm: 100,
						wallSegmentId: "diagonal",
					},
				],
			},
		};

		const scene = projectRectangularRoomForWebGl(source);

		expect(scene?.floors).toEqual([]);
		expect(scene?.floorPolygons).toHaveLength(1);
		const polygon = scene?.floorPolygons?.[0];
		expect(polygon?.floor).toEqual({ roomId: "room-triangle" });
		expect(polygon?.heightM).toBe(0.04);
		expect(polygon?.vertices).toHaveLength(3);
		expect(polygon?.vertices[0]?.xM).toBeCloseTo(0.05 + 0.05 * Math.SQRT2, 8);
		expect(polygon?.vertices[0]?.zM).toBeCloseTo(0.05, 8);
		expect(polygon?.vertices[1]).toEqual({ xM: 1.95, zM: 0.05 });
		expect(polygon?.vertices[2]?.xM).toBeCloseTo(1.95, 8);
		expect(polygon?.vertices[2]?.zM).toBeCloseTo(1.95 - 0.05 * Math.SQRT2, 8);
		expect(scene?.items).toEqual([
			expect.objectContaining({
				assetInstanceId: "diagonal-panel-left",
				centerXM: expect.closeTo((2000 - (1414 - 75) / Math.SQRT2) / 1000, 8),
				centerZM: expect.closeTo((2000 - (1414 + 75) / Math.SQRT2) / 1000, 8),
				yawRadians: (3 * Math.PI) / 4,
			}),
		]);
	});

	it("projects a normalized seven-segment contour with a full divider into two floors", () => {
		const source = {
			...createInitialProject({
				createdAt: "2026-08-13T08:40:00.000Z",
				levelId: "level-1",
				name: "Разделённый план",
				projectId: "project-1",
			}),
			level: {
				levelId: "level-1",
				openings: [],
				rooms: [
					{
						faceFingerprint: "grid:0:2000:0:3000:100",
						heightMm: 2600,
						roomId: "room-left",
					},
					{
						faceFingerprint: "grid:2000:4000:0:3000:100",
						heightMm: 2600,
						roomId: "room-right",
					},
				],
				vertices: [
					{ vertexId: "top-left", xMm: 0, zMm: 0 },
					{ vertexId: "top-divider", xMm: 2000, zMm: 0 },
					{ vertexId: "top-right", xMm: 4000, zMm: 0 },
					{ vertexId: "bottom-left", xMm: 0, zMm: 3000 },
					{ vertexId: "bottom-divider", xMm: 2000, zMm: 3000 },
					{ vertexId: "bottom-right", xMm: 4000, zMm: 3000 },
				],
				wallSegments: [
					{
						endVertexId: "top-divider",
						startVertexId: "top-left",
						thicknessMm: 100,
						wallSegmentId: "top-left-wall",
					},
					{
						endVertexId: "top-right",
						startVertexId: "top-divider",
						thicknessMm: 100,
						wallSegmentId: "top-right-wall",
					},
					{
						endVertexId: "bottom-left",
						startVertexId: "top-left",
						thicknessMm: 100,
						wallSegmentId: "left-wall",
					},
					{
						endVertexId: "bottom-divider",
						startVertexId: "bottom-left",
						thicknessMm: 100,
						wallSegmentId: "bottom-left-wall",
					},
					{
						endVertexId: "bottom-right",
						startVertexId: "bottom-divider",
						thicknessMm: 100,
						wallSegmentId: "bottom-right-wall",
					},
					{
						endVertexId: "bottom-right",
						startVertexId: "top-right",
						thicknessMm: 100,
						wallSegmentId: "right-wall",
					},
					{
						endVertexId: "bottom-divider",
						startVertexId: "top-divider",
						thicknessMm: 100,
						wallSegmentId: "divider",
					},
				],
			},
		};

		const scene = projectRectangularRoomForWebGl(source);

		expect(scene?.floors).toHaveLength(2);
		expect(scene?.floors.map((floor) => floor.floor?.roomId)).toEqual([
			"room-left",
			"room-right",
		]);
		expect(scene?.walls).toHaveLength(7);
		expect(scene?.dimensions).toEqual({
			depthMm: 2900,
			heightMm: 2600,
			widthMm: 3900,
		});
	});

	it("projects the canonical integer-mm rectangle into scene metres without creating another geometry source", () => {
		const created = configureRectangularRoom(
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
		if (created.kind !== "accepted") {
			throw new Error("Expected a valid rectangular fixture");
		}

		expect(projectRectangularRoomForWebGl(created.project)).toMatchObject({
			cameraBounds: {
				centerXM: 2.05,
				centerZM: 1.55,
				depthM: 3.1,
				widthM: 4.1,
			},
			dimensions: { depthMm: 3000, heightMm: 2600, widthMm: 4000 },
			floors: [
				{
					centerXM: 2.05,
					centerYM: 0,
					centerZM: 1.55,
					depthM: 3,
					floor: { roomId: "room-1" },
					heightM: 0.04,
					widthM: 4,
				},
			],
			items: [],
			walls: [
				{
					centerXM: 2.05,
					centerYM: 1.3,
					centerZM: 0,
					depthM: 0.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 0, z: -1 }, wallSegmentId: "wall-1" },
					widthM: 4.1,
				},
				{
					centerXM: 4.1,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 1, z: 0 }, wallSegmentId: "wall-2" },
					widthM: 0.1,
				},
				{
					centerXM: 2.05,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 0, z: 1 }, wallSegmentId: "wall-3" },
					widthM: 4.1,
				},
				{
					centerXM: 0,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: -1, z: 0 }, wallSegmentId: "wall-4" },
					widthM: 0.1,
				},
			],
		});
	});

	it("projects a durably changed odd wall thickness as a solid 3D wall while keeping Room height derived", () => {
		const created = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-15T09:00:00.000Z",
				levelId: "level-1",
				name: "Толстая стена",
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
			"2026-08-15T09:00:00.000Z",
		);
		if (created.kind !== "accepted") {
			throw new Error("Expected a rectangular fixture");
		}
		const changed = changeGeneralWallThickness(
			created.project,
			{ thicknessMm: 101, wallSegmentId: "wall-1" },
			"2026-08-15T09:01:00.000Z",
		);
		if (changed.kind !== "accepted") {
			throw new Error("Expected a valid thickness mutation");
		}

		const scene = projectRectangularRoomForWebGl(changed.project);
		const editedWall = scene?.walls.find(
			(wall) => wall.wall?.wallSegmentId === "wall-1",
		);
		expect(editedWall).toMatchObject({ depthM: 0.101, heightM: 2.6 });
		expect(scene?.dimensions.heightMm).toBe(2600);
		expect(scene?.floors[0]?.depthM).toBeLessThan(3);
	});

	it("projects a durable 45-degree branch as a rotated wall without changing the rectangular room floor", () => {
		const configured = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-23T08:45:00.000Z",
				levelId: "level-1",
				name: "Диагональная стена",
				projectId: "project-diagonal",
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
			"2026-08-23T08:45:00.000Z",
		);
		if (configured.kind !== "accepted") {
			throw new Error("Expected a valid rectangular fixture");
		}
		const added = addGeneralWallToProject(
			configured.project,
			{
				end: { xMm: -1000, zMm: -1000 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("diagonal-end", "diagonal-wall"),
			"2026-08-23T08:46:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a durable diagonal branch");
		}

		const scene = projectRectangularRoomForWebGl(added.project);
		const diagonal = scene?.walls.find(
			(wall) => wall.wall?.wallSegmentId === "diagonal-wall",
		);

		expect(scene?.floors).toHaveLength(1);
		expect(diagonal).toMatchObject({
			centerXM: 0.5,
			centerZM: 0.5,
			depthM: 0.1,
			heightM: 2.6,
			widthM: Math.SQRT2,
			yawRadians: (3 * Math.PI) / 4,
		});
	});

	it("does not project an empty Project as a made-up 3D room", () => {
		expect(
			projectRectangularRoomForWebGl(
				createInitialProject({
					createdAt: "2026-08-05T14:15:16.000Z",
					levelId: "level-1",
					name: "Пусто",
					projectId: "project-1",
				}),
			),
		).toBeUndefined();
	});

	it("cuts a durable door interval out of its hosted 3D wall while retaining its lintel", () => {
		const room = configureRectangularRoom(
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
		if (room.kind !== "accepted") {
			throw new Error("Expected a valid room fixture");
		}
		const doorway = addDoorOpeningToProject(
			room.project,
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("opening-1"),
			"2026-08-05T14:17:16.000Z",
		);
		if (doorway.kind !== "accepted") {
			throw new Error("Expected a valid door fixture");
		}

		for (const swingSide of [undefined, "right", "left"] as const) {
			const door = doorway.project.level.openings[0];
			if (door?.kind !== "Door") throw new Error("Expected Door");
			const { swingSide: _previousSide, ...legacyDoor } = door;
			const project = {
				...doorway.project,
				level: { ...doorway.project.level, openings: [swingSide ? { ...legacyDoor, swingSide } : legacyDoor] },
			};
			const fixtures = projectRectangularRoomForWebGl(project, undefined, true)?.openingParts;
			expect(fixtures?.filter(part => part.role === "frame")).toHaveLength(3);
			const leaf = fixtures?.find(part => part.role === "leaf");
			expect(leaf?.wallSegmentId).toBe("wall-1");
			expect(leaf?.box.centerXM).toBeCloseTo(1.63, 1);
			expect(leaf?.box.centerYM).toBeCloseTo(1.035, 1);
			expect((leaf?.box.centerZM ?? 0) * (swingSide === "left" ? 1 : -1)).toBeGreaterThan(0.4);
			expect(leaf?.box.depthM).toBeGreaterThan(0.8);
			expect(leaf?.box.widthM).toBeLessThan(0.06);
			expect(projectRectangularRoomForWebGl(project)?.openingParts).toBeUndefined();
		}

		const doorWallBoxes = projectRectangularRoomForWebGl(
			doorway.project,
		)?.walls.filter((wall) => wall.wall?.wallSegmentId === "wall-1");

		expect(doorWallBoxes).toMatchObject([
			{
				centerXM: 0.8,
				centerYM: 1.3,
				centerZM: 0,
				depthM: 0.1,
				heightM: 2.6,
				wall: { exteriorNormal: { x: 0, z: -1 }, wallSegmentId: "wall-1" },
				widthM: 1.6,
			},
			{
				centerXM: 2.05,
				centerYM: 2.35,
				centerZM: 0,
				depthM: 0.1,
				heightM: 0.5,
				wall: { exteriorNormal: { x: 0, z: -1 }, wallSegmentId: "wall-1" },
				widthM: 0.9,
			},
			{
				centerXM: 3.3,
				centerYM: 1.3,
				centerZM: 0,
				depthM: 0.1,
				heightM: 2.6,
				wall: { exteriorNormal: { x: 0, z: -1 }, wallSegmentId: "wall-1" },
				widthM: 1.6,
			},
		]);
	});

	it("cuts a durable window from its hosted 3D wall while retaining sill and lintel", () => {
		const room = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-22T18:00:00.000Z",
				levelId: "level-1",
				name: "Окно",
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
			"2026-08-22T18:01:00.000Z",
		);
		if (room.kind !== "accepted") {
			throw new Error("Expected a valid room fixture");
		}
		const windowOpening = addWindowOpeningToProject(
			room.project,
			{
				heightMm: 1200,
				offsetMm: 2050,
				sillMm: 900,
				wallSegmentId: "wall-1",
				widthMm: 1200,
			},
			ids("window-1"),
			"2026-08-22T18:02:00.000Z",
		);
		if (windowOpening.kind !== "accepted") {
			throw new Error("Expected a valid window fixture");
		}

		const fixtures = projectRectangularRoomForWebGl(windowOpening.project, undefined, true)?.openingParts;
		expect(fixtures?.filter(part => part.role === "frame")).toHaveLength(5);
		const glazing = fixtures?.filter(part => part.role === "glass");
		expect(glazing).toHaveLength(2);
		for (const pane of glazing ?? []) {
			expect(pane.wallSegmentId).toBe("wall-1");
			expect(pane.box.centerYM).toBe(1.5);
			expect(pane.box.centerZM).toBe(0);
			expect(pane.box.heightM).toBeLessThan(1.2);
			expect(pane.box.widthM).toBeGreaterThan(0.5);
		}

		const windowWallBoxes = projectRectangularRoomForWebGl(
			windowOpening.project,
		)?.walls.filter((wall) => wall.wall?.wallSegmentId === "wall-1");

		expect(windowWallBoxes).toHaveLength(4);
		expect(windowWallBoxes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ centerYM: 0.45, heightM: 0.9, widthM: 1.2 }),
				expect.objectContaining({ centerYM: 2.35, heightM: 0.5, widthM: 1.2 }),
			]),
		);
	});

	it("fills the floor continuously through a ground-level doorway", () => {
		const room = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-06T10:00:00.000Z",
				levelId: "level-1",
				name: "Дверь",
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
			"2026-08-06T10:01:00.000Z",
		);
		if (room.kind !== "accepted") throw new Error("Expected room fixture");
		const project = {
			...room.project,
			level: {
				...room.project.level,
				openings: [
					{
						heightMm: 2100,
						kind: "Door" as const,
						offsetMm: 2000,
						openingId: "door-1",
						sillMm: 0,
						wallSegmentId: "wall-1",
						widthMm: 900,
					},
				],
			},
		};
		const scene = projectRectangularRoomForWebGl(project);
		expect(scene?.floors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ heightM: 0.04, widthM: 0.9 }),
			]),
		);
	});

	it("projects the shared-wall-height-opening-min golden Room heights into disposable 3D walls", () => {
		const room = configureRectangularRoom(
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
		if (room.kind !== "accepted") {
			throw new Error("Expected rectangle fixture");
		}
		const partitioned = addConstrainedPartition(
			room.project,
			{ offsetMm: 2000, orientation: "vertical" },
			ids("top", "bottom", "top-right", "bottom-left", "divider", "room-right"),
			"2026-08-05T14:17:16.000Z",
		);
		if (partitioned.kind !== "accepted") {
			throw new Error("Expected partition fixture");
		}
		const roomsWithIndependentHeights = {
			...partitioned.project,
			level: {
				...partitioned.project.level,
				rooms: partitioned.project.level.rooms.map((candidate) => ({
					...candidate,
					heightMm: candidate.roomId === "room-right" ? 2700 : 2400,
				})),
			},
		};

		const scene = projectRectangularRoomForWebGl(roomsWithIndependentHeights);

		expect(scene?.floors).toEqual([
			{
				centerXM: 1,
				centerYM: 0,
				centerZM: 1.55,
				depthM: 3,
				floor: { roomId: "room-1" },
				heightM: 0.04,
				widthM: 1.9,
			},
			{
				centerXM: 3.05,
				centerYM: 0,
				centerZM: 1.55,
				depthM: 3,
				floor: { roomId: "room-right" },
				heightM: 0.04,
				widthM: 2,
			},
		]);
		expect(scene?.walls).toContainEqual(
			expect.objectContaining({
				centerXM: 2,
				centerYM: 1.35,
				centerZM: 1.55,
				depthM: 3.1,
				heightM: 2.7,
				wall: { wallSegmentId: "divider" },
				widthM: 0.1,
			}),
		);
		expect(scene?.walls).toContainEqual(
			expect.objectContaining({
				centerXM: 0,
				centerYM: 1.2,
				centerZM: 1.55,
				depthM: 3.1,
				heightM: 2.4,
				wall: { exteriorNormal: { x: -1, z: 0 }, wallSegmentId: "wall-4" },
				widthM: 0.1,
			}),
		);
		expect(scene?.walls).toContainEqual(
			expect.objectContaining({
				centerXM: 4.1,
				centerYM: 1.35,
				centerZM: 1.55,
				depthM: 3.1,
				heightM: 2.7,
				wall: { exteriorNormal: { x: 1, z: 0 }, wallSegmentId: "wall-2" },
				widthM: 0.1,
			}),
		);
		expect(scene?.walls).toHaveLength(7);
	});

	it("projects a normalized T-shaped plan whenever its closed wall faces are rectangular", () => {
		const starter = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-13T00:10:00.000Z",
				levelId: "level-1",
				name: "Т-образный план",
				projectId: "project-t",
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
			"2026-08-13T00:10:01.000Z",
		);
		if (starter.kind !== "accepted") {
			throw new Error("Expected a rectangular fixture");
		}
		const vertical = addGeneralWallToProject(
			starter.project,
			{
				end: { xMm: 2000, zMm: 3100 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"top-contact",
				"bottom-contact",
				"top-tail",
				"bottom-tail",
				"vertical-divider",
				"room-right",
			),
			"2026-08-13T00:10:02.000Z",
		);
		if (vertical.kind !== "accepted") {
			throw new Error("Expected the first divider");
		}
		const completed = addGeneralWallToProject(
			vertical.project,
			{
				end: { xMm: 4100, zMm: 1500 },
				start: { xMm: 2000, zMm: 1500 },
				thicknessMm: 100,
			},
			ids(
				"right-contact",
				"vertical-tail",
				"right-tail",
				"crossbar",
				"room-top-right",
				"room-bottom-right",
			),
			"2026-08-13T00:10:03.000Z",
		);
		if (completed.kind !== "accepted") {
			throw new Error("Expected the crossbar");
		}

		const scene = projectRectangularRoomForWebGl(completed.project);

		expect(scene?.floors).toHaveLength(3);
		expect(scene?.walls).toHaveLength(
			completed.project.level.wallSegments.length,
		);
	});

	it("projects a parametric floor item from the canonical Project as a disposable 3D box", () => {
		const room = configureRectangularRoom(
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
		if (room.kind !== "accepted") {
			throw new Error("Expected room fixture");
		}
		const item = createParametricFloorItem(
			room.project,
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
		if (item.kind !== "accepted") {
			throw new Error("Expected item fixture");
		}

		expect(projectRectangularRoomForWebGl(item.project)?.items).toEqual([
			{
				assetAnchor: "floor",
				assetInstanceId: "item-1",
				centerXM: 2.05,
				centerYM: 0.375,
				centerZM: 1.55,
				depthM: 0.7,
				heightM: 0.75,
				material: { colorHex: "#2f80ed", furnitureKind: "table" },
				widthM: 1.2,
			},
		]);
	});

	it("projects wall items outside their host centreline on their declared semantic side", () => {
		const room = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-25T15:30:00.000Z",
				levelId: "level-1",
				name: "Стороны настенных предметов",
				projectId: "project-wall-item-sides",
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
			"2026-08-25T15:31:00.000Z",
		);
		if (room.kind !== "accepted") throw new Error("Expected room fixture");

		const project = {
			...room.project,
			assetInstances: [
				{
					anchorClass: "wall" as const,
					assetInstanceId: "panel-left",
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Панель слева",
					offsetMm: 1200,
					side: "left" as const,
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				{
					anchorClass: "wall" as const,
					assetInstanceId: "panel-right",
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Панель справа",
					offsetMm: 2800,
					side: "right" as const,
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
			],
		};

		expect(projectRectangularRoomForWebGl(project)?.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					assetAnchor: "wall",
					assetInstanceId: "panel-left",
					centerXM: 1.2,
					centerZM: 0.075,
					yawRadians: 0,
				}),
				expect.objectContaining({
					assetAnchor: "wall",
					assetInstanceId: "panel-right",
					centerXM: 2.8,
					centerZM: -0.075,
					yawRadians: 0,
				}),
			]),
		);
	});

	it("keeps a custom GLB definition address on its disposable scene item", () => {
		const room = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-15T20:30:00.000Z",
				levelId: "level-1",
				name: "Моя модель",
				projectId: "project-custom",
			}),
			{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
			ids("v-1", "v-2", "v-3", "v-4", "w-1", "w-2", "w-3", "w-4", "room-1"),
			"2026-08-15T20:31:00.000Z",
		);
		if (room.kind !== "accepted") throw new Error("Expected room fixture");
		const item = createParametricFloorItem(
			{
				...room.project,
				assetDefinitionRefs: [
					{
						assetDefinitionId: "model-sofa",
						byteLength: 1024,
						depthMm: 900,
						displayName: "Мой диван",
						format: "glb",
						heightMm: 800,
						resourceHash: "a".repeat(64),
						widthMm: 1800,
					},
				],
			},
			{
				assetDefinitionId: "model-sofa",
				color: "#b8b4aa",
				depthMm: 900,
				heightMm: 800,
				label: "Мой диван",
				roomId: "room-1",
				widthMm: 1800,
				xMm: 2050,
				zMm: 1550,
			},
			ids("item-custom"),
			"2026-08-15T20:32:00.000Z",
		);
		if (item.kind !== "accepted")
			throw new Error("Expected custom item fixture");

		expect(projectRectangularRoomForWebGl(item.project)?.items).toEqual([
			expect.objectContaining({
				assetDefinitionId: "model-sofa",
				assetInstanceId: "item-custom",
			}),
		]);
	});

	it("projects a persisted item yaw step as the matching disposable right-handed scene rotation", () => {
		const room = configureRectangularRoom(
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
		if (room.kind !== "accepted") {
			throw new Error("Expected room fixture");
		}
		const item = createParametricFloorItem(
			room.project,
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
		if (item.kind !== "accepted") {
			throw new Error("Expected item fixture");
		}
		const yawAwareProject = {
			...item.project,
			assetInstances: item.project.assetInstances.map((asset) => ({
				...asset,
				yawStep: 2 as const,
			})),
		};

		expect(projectRectangularRoomForWebGl(yawAwareProject)?.items).toEqual([
			expect.objectContaining({ yawRadians: Math.PI / 2 }),
		]);
	});

	it("projects 37.5 degrees exactly in the disposable 3D scene", () => {
		const room = configureRectangularRoom(
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
		if (room.kind !== "accepted") {
			throw new Error("Expected room fixture");
		}
		const item = createParametricFloorItem(
			room.project,
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
		if (item.kind !== "accepted") {
			throw new Error("Expected item fixture");
		}
		const yawAwareProject = {
			...item.project,
			assetInstances: item.project.assetInstances.map((asset) => ({
				...asset,
				yawMilliDeg: 37500,
			})),
		};

		expect(projectRectangularRoomForWebGl(yawAwareProject)?.items).toEqual([
			expect.objectContaining({ yawRadians: 37500 * Math.PI / 180000 }),
		]);
	});

	it("uses the declared yaw step in preference to a legacy free yaw", () => {
		const room = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-06T10:00:00.000Z",
				levelId: "level-1",
				name: "Поворот",
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
			"2026-08-06T10:01:00.000Z",
		);
		if (room.kind !== "accepted") throw new Error("Expected room fixture");
		const item = createParametricFloorItem(
			room.project,
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
			"2026-08-06T10:02:00.000Z",
		);
		if (item.kind !== "accepted") throw new Error("Expected item fixture");
		expect(
			projectRectangularRoomForWebGl({
				...item.project,
				assetInstances: item.project.assetInstances.map((asset) => ({
					...asset,
					yawRadians: Math.PI / 7,
					yawStep: 2 as const,
				})),
			})?.items,
		).toEqual([expect.objectContaining({ yawRadians: Math.PI / 2 })]);
	});

	it("maps a legacy free yaw to its nearest declared step", () => {
		const room = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-06T10:00:00.000Z",
				levelId: "level-1",
				name: "Legacy поворот",
				projectId: "project-legacy-yaw",
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
			"2026-08-06T10:01:00.000Z",
		);
		if (room.kind !== "accepted") throw new Error("Expected room fixture");
		const item = createParametricFloorItem(
			room.project,
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
			"2026-08-06T10:02:00.000Z",
		);
		if (item.kind !== "accepted") throw new Error("Expected item fixture");
		expect(
			projectRectangularRoomForWebGl({
				...item.project,
				assetInstances: item.project.assetInstances.map((asset) => {
					const legacyAsset = { ...asset, yawRadians: Math.PI / 7 };
					delete (legacyAsset as { yawStep?: unknown }).yawStep;
					return legacyAsset;
				}),
			})?.items,
		).toEqual([expect.objectContaining({ yawRadians: Math.PI / 4 })]);
	});

	it("classifies alpha greybox labels into distinct semantic furniture silhouettes", () => {
		const room = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-06T10:00:00.000Z",
				levelId: "level-1",
				name: "Каталог",
				projectId: "project-1",
			}),
			{ depthMm: "8000", heightMm: "2600", widthMm: "8000" },
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
			"2026-08-06T10:01:00.000Z",
		);
		if (room.kind !== "accepted") {
			throw new Error("Expected room fixture");
		}

		const labels = [
			["Обеденный стол", "table"],
			["Стул", "chair"],
			["Двуспальная кровать", "bed"],
			["Шкаф", "storage"],
			["Тумбочка", "storage"],
			["Комод", "storage"],
			["Диван", "sofa"],
			["Растение", "generic"],
		] as const;
		const placements = [
			{ xMm: 1000, zMm: 1000 },
			{ xMm: 2500, zMm: 1000 },
			{ xMm: 4200, zMm: 1000 },
			{ xMm: 6500, zMm: 1000 },
			{ xMm: 6800, zMm: 4000 },
			{ xMm: 1800, zMm: 6500 },
			{ xMm: 1800, zMm: 4000 },
			{ xMm: 5200, zMm: 4000 },
		] as const;
		const completed = labels.reduce((project, [label], index) => {
			const placed = createParametricFloorItem(
				project,
				{
					color: "#2f80ed",
					depthMm: 600,
					heightMm: 750,
					label,
					roomId: "room-1",
					widthMm: 900,
					...placements[index],
				},
				ids(`item-${index}`),
				"2026-08-06T10:02:00.000Z",
			);
			if (placed.kind !== "accepted") {
				throw new Error(`Expected ${label} fixture`);
			}
			return placed.project;
		}, room.project);

		expect(
			projectRectangularRoomForWebGl(completed)?.items.map(
				(item) => item.material?.furnitureKind,
			),
		).toEqual(labels.map(([, furnitureKind]) => furnitureKind));
	});

	it("projects disconnected room faces as separate floors and never fills their empty gap", () => {
		const starter = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-06T09:20:00.000Z",
				levelId: "level-1",
				name: "Квартира",
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
			"2026-08-06T09:21:00.000Z",
		);
		if (starter.kind !== "accepted") {
			throw new Error("Expected a starter room");
		}
		const disconnected = createRectangularRoomLoop(
			starter.project,
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
			"2026-08-06T09:22:00.000Z",
		);
		if (disconnected.kind !== "accepted") {
			throw new Error("Expected a disconnected room");
		}

		const roomsWithIndependentHeights = {
			...disconnected.project,
			level: {
				...disconnected.project.level,
				rooms: disconnected.project.level.rooms.map((candidate) =>
					candidate.roomId === "room-2"
						? { ...candidate, heightMm: 3000 }
						: candidate,
				),
			},
		};
		const scene = projectRectangularRoomForWebGl(roomsWithIndependentHeights);

		expect(scene?.cameraBounds).toEqual({
			centerXM: 3.55,
			centerZM: 3.3,
			depthM: 6.6,
			widthM: 7.1,
		});
		expect(scene?.floors).toEqual([
			{
				centerXM: 2.05,
				centerYM: 0,
				centerZM: 1.55,
				depthM: 3,
				floor: { roomId: "room-1" },
				heightM: 0.04,
				widthM: 4,
			},
			{
				centerXM: 6.05,
				centerYM: 0,
				centerZM: 5.8,
				depthM: 1.5,
				floor: { roomId: "room-2" },
				heightM: 0.04,
				widthM: 2,
			},
		]);
		expect(
			scene?.walls.every((wall) => wall.wall?.exteriorNormal !== undefined),
		).toBe(true);
		expect(
			scene?.walls.find((wall) => wall.wall?.wallSegmentId === "wall-1"),
		).toEqual(
			expect.objectContaining({
				centerYM: 1.3,
				heightM: 2.6,
				wall: { exteriorNormal: { x: 0, z: -1 }, wallSegmentId: "wall-1" },
			}),
		);
		expect(
			scene?.walls.find((wall) => wall.wall?.wallSegmentId === "wall-5"),
		).toEqual(
			expect.objectContaining({
				centerYM: 1.5,
				heightM: 3,
				wall: { exteriorNormal: { x: 0, z: -1 }, wallSegmentId: "wall-5" },
			}),
		);
	});

	it("does not create a global-envelope scene when the graph and legacy room metadata cannot be reconciled", () => {
		const created = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-06T10:10:00.000Z",
				levelId: "level-1",
				name: "Поврежденный план",
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
			"2026-08-06T10:11:00.000Z",
		);
		if (created.kind !== "accepted") {
			throw new Error("Expected a starter room");
		}

		expect(
			projectRectangularRoomForWebGl({
				...created.project,
				level: {
					...created.project.level,
					rooms: [
						{
							...created.project.level.rooms[0],
							faceFingerprint: "rectangular:999:999:100",
						},
					],
				},
			}),
		).toBeUndefined();
	});

	it("projects a reconciled v2 PlanGraph with the same disposable floors, walls, and greyboxes", () => {
		const configured = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-06T15:00:00.000Z",
				levelId: "level-1",
				name: "v2",
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
			"2026-08-06T15:01:00.000Z",
		);
		if (configured.kind !== "accepted") {
			throw new Error("Expected a v1 fixture");
		}
		const migrated = migrateProjectV1ToV2(configured.project);
		if (migrated.kind !== "accepted") {
			throw new Error("Expected migration");
		}
		const withItem = createParametricFloorItemV2(
			migrated.project,
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
			"2026-08-06T15:02:00.000Z",
		);
		if (withItem.kind !== "accepted") {
			throw new Error("Expected v2 item");
		}

		const scene = projectRectangularRoomForWebGl(withItem.project);

		expect(scene?.floors).toEqual([
			{
				centerXM: 2.05,
				centerYM: 0,
				centerZM: 1.55,
				depthM: 3,
				floor: { roomId: "room-1" },
				heightM: 0.04,
				widthM: 4,
			},
		]);
		expect(scene?.items).toEqual([
			expect.objectContaining({
				centerXM: 2.05,
				centerZM: 1.55,
				material: { colorHex: "#2f80ed", furnitureKind: "table" },
			}),
		]);
		expect(scene?.walls).toHaveLength(4);
		expect(
			scene?.walls.find((wall) => wall.wall?.wallSegmentId === "wall-1"),
		).toEqual(
			expect.objectContaining({
				wall: { exteriorNormal: { x: 0, z: -1 }, wallSegmentId: "wall-1" },
			}),
		);
	});
});
