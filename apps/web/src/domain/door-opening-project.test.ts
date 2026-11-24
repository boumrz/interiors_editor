import { describe, expect, it } from "@rstest/core";
import { addConstrainedPartition } from "./constrained-partition";
import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
	deleteDoorOpeningFromProject,
	moveDoorOpeningInProject,
	projectOpeningsRemainValid,
	updateDoorOpeningInProject,
	wallOpeningHostsForProject,
	windowsWithMixedSillsOnSameWall,
} from "./door-opening-project";
import { addGeneralWallToProject } from "./general-wall-project";
import { createInitialProject } from "./initial-project";
import { createParametricFloorItem } from "./parametric-item";
import { createParametricWallItem } from "./parametric-wall-item";
import type { Project } from "./project";
import { configureRectangularRoom } from "./rectangular-room";
import type { WindowOpening } from "./wall-opening";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function roomProject() {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-12T10:00:00.000Z",
			levelId: "level-1",
			name: "План",
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
		"2026-08-12T10:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected room fixture");
	}
	return configured.project;
}

function sharedWallHeightOpeningMinimumProject() {
	const divided = addConstrainedPartition(
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
		"2026-08-22T19:35:00.000Z",
	);
	if (divided.kind !== "accepted") {
		throw new Error("Expected the shared-wall height fixture to be accepted");
	}
	return {
		...divided.project,
		level: {
			...divided.project.level,
			rooms: divided.project.level.rooms.map((room) => ({
				...room,
				heightMm: room.roomId === "room-1" ? 2400 : 2700,
			})),
		},
	};
}

const alignmentTime = "2026-08-24T12:00:00.000Z";
const windowAlignment = { kind: "align-matching-windows", openingId: "window-1" } as const;

function withWindows(source: Project, ...windows: readonly Omit<WindowOpening, "kind">[]) {
	return windows.reduce((project, { openingId, ...window }) => {
		const added = addWindowOpeningToProject(project, window, ids(openingId), alignmentTime);
		if (added.kind !== "accepted") throw new Error(`Expected valid window ${openingId}: ${added.reasonCode}`);
		return added.project;
	}, source);
}

function sideBySide(windowHeightMm: number, wallSegmentId = "wall-1") {
	return [
		{ openingId: "window-1", offsetMm: 400, sillMm: 300, widthMm: 600, heightMm: windowHeightMm, wallSegmentId },
		{ openingId: "window-2", offsetMm: 1250, sillMm: 150, widthMm: 600, heightMm: windowHeightMm, wallSegmentId },
	] as const;
}

describe("door opening Project mutation", () => {
	it("aligns every equal-size same-wall window to 900 mm, preserving dimensions, offsets, identities and other openings", () => {
		const door = addDoorOpeningToProject(roomProject(), {
			heightMm: 2100, offsetMm: 680, sillMm: 0, wallSegmentId: "wall-2", widthMm: 900,
		}, ids("door-1"), alignmentTime);
		if (door.kind !== "accepted") throw new Error("Expected a valid Door fixture");
		const [first, second] = sideBySide(600);
		const source = withWindows(door.project, first, second,
			{ ...first, openingId: "window-3", offsetMm: 2100, sillMm: 1100 },
			{ ...first, openingId: "different-width", offsetMm: 2900, widthMm: 350 },
			{ ...first, openingId: "different-height", offsetMm: 3550, heightMm: 500 },
			{ ...first, openingId: "other-wall", wallSegmentId: "wall-2", offsetMm: 1800 },
		);
		const expectedIds = ["window-1", "window-2", "window-3"];
		expect(windowsWithMixedSillsOnSameWall(source.level.openings, "window-1").map(({ openingId }) => openingId)).toEqual(expectedIds);
		const nextTime = "2026-08-24T12:01:00.000Z";
		const result = updateDoorOpeningInProject(source, windowAlignment, nextTime);
		expect(result).toEqual({
			kind: "accepted",
			project: {
				...source, updatedAt: nextTime,
				level: {
					...source.level,
					openings: source.level.openings.map(opening =>
						expectedIds.includes(opening.openingId) ? { ...opening, sillMm: 900 } : opening),
				},
			},
		});
	});

	it("aligns tall windows flush with the lower ceiling of a shared wall", () => {
		const source = withWindows(sharedWallHeightOpeningMinimumProject(), ...sideBySide(2100, "wall-divider"));
		const result = updateDoorOpeningInProject(source, windowAlignment, alignmentTime);
		if (result.kind !== "accepted") throw new Error(`Expected alignable tall windows: ${result.reasonCode}`);
		expect(result.project.level.openings.map(({ sillMm }) => sillMm)).toEqual([300, 300]);
		expect(projectOpeningsRemainValid(result.project)).toBe(true);
	});

	it("uses the actual taller host when another wall in the same plan is lower", () => {
		const divided = sharedWallHeightOpeningMinimumProject();
		const host = wallOpeningHostsForProject(divided)?.find(wall =>
			wall.heightMm === 2700 && wall.usableLengthMm >= 1550);
		if (!host) throw new Error("Expected a taller canonical boundary wall");
		const source = withWindows(divided, ...sideBySide(2100, host.wallSegmentId));
		const result = updateDoorOpeningInProject(source, windowAlignment, alignmentTime);
		if (result.kind !== "accepted") throw new Error(`Expected alignable tall windows: ${result.reasonCode}`);
		expect(result.project.level.openings.map(({ sillMm }) => sillMm)).toEqual([600, 600]);
	});

	it("excludes a Door even when its wall and dimensions match those of the Windows", () => {
		const door = addDoorOpeningToProject(roomProject(), {
			heightMm: 2100, offsetMm: 3300, sillMm: 0, wallSegmentId: "wall-1", widthMm: 900,
		}, ids("door-1"), alignmentTime);
		if (door.kind !== "accepted") throw new Error("Expected a valid Door fixture");
		const [first, second] = sideBySide(2100);
		const source = withWindows(door.project, { ...first, offsetMm: 650, widthMm: 900 }, { ...second, offsetMm: 1950, widthMm: 900 });
		expect(windowsWithMixedSillsOnSameWall(source.level.openings, "door-1")).toEqual([]);
		const result = updateDoorOpeningInProject(source, windowAlignment, alignmentTime);
		if (result.kind !== "accepted") throw new Error(`Expected alignable windows: ${result.reasonCode}`);
		expect(result.project.level.openings.map(({ kind, sillMm }) => ({ kind, sillMm }))).toEqual([
			{ kind: "Door", sillMm: 0 }, { kind: "Window", sillMm: 500 }, { kind: "Window", sillMm: 500 },
		]);
	});

	it("rejects a stale or invalid source host before returning any aligned geometry", () => {
		const source = withWindows(roomProject(), ...sideBySide(600));
		const withMissingHost = {
			...source, level: { ...source.level, openings: source.level.openings.map(opening => ({ ...opening, wallSegmentId: "missing" })) },
		};
		expect(updateDoorOpeningInProject(withMissingHost, windowAlignment, alignmentTime))
			.toEqual({ kind: "rejected", reasonCode: "WALL_NOT_FOUND" });
		const withBadOffset = {
			...source,
			level: {
				...source.level,
				openings: source.level.openings.map(opening => opening.openingId === "window-1" ? { ...opening, offsetMm: 100 } : opening),
			},
		};
		expect(updateDoorOpeningInProject(withBadOffset, windowAlignment, alignmentTime))
			.toEqual({ kind: "rejected", reasonCode: "OPENING_OUTSIDE_WALL_INTERVAL" });
	});

	it("leaves already aligned windows, a lone window, and an invalid selection untouched", () => {
		const [first, second] = sideBySide(600);
		const source = withWindows(roomProject(), first, { ...second, sillMm: first.sillMm },
			{ ...first, openingId: "lone-window", offsetMm: 2100, widthMm: 350 });
		for (const openingId of ["window-1", "lone-window", "missing"]) {
			expect(windowsWithMixedSillsOnSameWall(source.level.openings, openingId)).toEqual([]);
			expect(updateDoorOpeningInProject(source, { ...windowAlignment, openingId }, alignmentTime))
				.toEqual({ kind: "accepted", project: source });
		}
	});

	it("rejects alignment of the whole set when the second window would collide with a wall-mounted item", () => {
		const [first, second] = sideBySide(600);
		const source = withWindows(roomProject(), first, { ...second, sillMm: 600 });
		const panel = createParametricWallItem(source, {
			color: "#416b91", depthMm: 50, elevationMm: 1300, heightMm: 100,
			label: "Настенная панель", offsetMm: second.offsetMm, side: "left", wallSegmentId: second.wallSegmentId, widthMm: 300,
		}, ids("panel-1"), alignmentTime);
		if (panel.kind !== "accepted") throw new Error("Expected a panel outside existing openings");
		const before = JSON.stringify(panel.project);
		expect(updateDoorOpeningInProject(panel.project, windowAlignment, alignmentTime))
			.toEqual({ kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" });
		expect(JSON.stringify(panel.project)).toBe(before);
	});

	it("keeps an added opening out of an existing wall-mounted panel", () => {
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
			"2026-08-23T16:00:00.000Z",
		);
		if (panel.kind !== "accepted") throw new Error("Expected panel fixture");

		expect(
			addDoorOpeningToProject(
				panel.project,
				{
					heightMm: 2100,
					offsetMm: 2050,
					sillMm: 0,
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				ids("must-not-allocate"),
				"2026-08-23T16:01:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_OPENING_COLLISION" });
	});

	it("uses the exact conservative 45-degree host boundary while editing its durable Door", () => {
		const diagonal = addGeneralWallToProject(
			roomProject(),
			{
				end: { xMm: -2000, zMm: -2000 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("diagonal-end", "diagonal-wall"),
			"2026-08-23T14:30:00.000Z",
		);
		if (diagonal.kind !== "accepted") {
			throw new Error("Expected a durable 45-degree wall fixture");
		}

		expect(wallOpeningHostsForProject(diagonal.project)).toContainEqual({
			heightMm: 2600,
			usableLengthMm: 2828,
			wallSegmentId: "diagonal-wall",
		});
		const added = addDoorOpeningToProject(
			diagonal.project,
			{
				heightMm: 2100,
				offsetMm: 1414,
				sillMm: 0,
				wallSegmentId: "diagonal-wall",
				widthMm: 900,
			},
			ids("diagonal-door"),
			"2026-08-23T14:31:00.000Z",
		);

		expect(added).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [
							expect.objectContaining({
								openingId: "diagonal-door",
								wallSegmentId: "diagonal-wall",
							}),
						],
					}),
				}),
			}),
		);
		if (added.kind !== "accepted") return;
		expect(projectOpeningsRemainValid(added.project)).toBe(true);
		const beforeEdit = JSON.stringify(added.project);
		expect(
			updateDoorOpeningInProject(
				added.project,
				{
					openingId: "diagonal-door",
					swingSide: "left",
					widthMm: 2828,
				},
				"2026-08-23T14:32:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [
							expect.objectContaining({
								openingId: "diagonal-door",
								swingSide: "left",
								wallSegmentId: "diagonal-wall",
								widthMm: 2828,
							}),
						],
					}),
				}),
			}),
		);
		expect(
			updateDoorOpeningInProject(
				added.project,
				{ openingId: "diagonal-door", widthMm: 2829 },
				"2026-08-23T14:33:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "DOOR_WIDTH_EXCEEDS_WALL_LENGTH",
		});
		expect(JSON.stringify(added.project)).toBe(beforeEdit);
	});

	it("accepts the exact lower shared-wall height and atomically rejects one millimetre above it", () => {
		const source = sharedWallHeightOpeningMinimumProject();
		const before = JSON.stringify(source);
		const hosts = wallOpeningHostsForProject(source);
		expect(hosts).toContainEqual({
			heightMm: 2400,
			usableLengthMm: 3100,
			wallSegmentId: "wall-divider",
		});

		expect(
			addDoorOpeningToProject(
				source,
				{
					heightMm: 2400,
					offsetMm: 1550,
					sillMm: 0,
					wallSegmentId: "wall-divider",
					widthMm: 900,
				},
				ids("door-shared-wall-exact"),
				"2026-08-22T19:36:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [
							expect.objectContaining({
								heightMm: 2400,
								sillMm: 0,
								wallSegmentId: "wall-divider",
							}),
						],
					}),
				}),
			}),
		);

		expect(
			addWindowOpeningToProject(
				source,
				{
					heightMm: 1500,
					offsetMm: 1550,
					sillMm: 900,
					wallSegmentId: "wall-divider",
					widthMm: 1200,
				},
				ids("window-shared-wall-exact"),
				"2026-08-22T19:36:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [
							expect.objectContaining({
								heightMm: 1500,
								sillMm: 900,
								wallSegmentId: "wall-divider",
							}),
						],
					}),
				}),
			}),
		);

		expect(
			addWindowOpeningToProject(
				source,
				{
					heightMm: 1501,
					offsetMm: 1550,
					sillMm: 900,
					wallSegmentId: "wall-divider",
					widthMm: 1200,
				},
				{
					next: () => {
						throw new Error(
							"Out-of-bounds opening must not allocate an identity",
						);
					},
				},
				"2026-08-22T19:36:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OPENING_OUT_OF_BOUNDS" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("stores a window on exactly one canonical wall without adding a door swing", () => {
		const result = addWindowOpeningToProject(
			roomProject(),
			{
				heightMm: 1200,
				offsetMm: 2050,
				sillMm: 900,
				wallSegmentId: "wall-1",
				widthMm: 1200,
			},
			ids("window-1"),
			"2026-08-15T10:00:00.000Z",
		);

		expect(result).toEqual({
			kind: "accepted",
			project: expect.objectContaining({
				level: expect.objectContaining({
					openings: [
						{
							heightMm: 1200,
							kind: "Window",
							offsetMm: 2050,
							openingId: "window-1",
							sillMm: 900,
							wallSegmentId: "wall-1",
							widthMm: 1200,
						},
					],
				}),
				updatedAt: "2026-08-15T10:00:00.000Z",
			}),
		});
		if (result.kind !== "accepted") throw new Error("Expected a Window fixture");
		const beforeEdit = JSON.stringify(result.project);
		expect(
			updateDoorOpeningInProject(
				result.project,
				{ openingId: "window-1", widthMm: 4101 },
				"2026-08-24T08:03:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "WINDOW_WIDTH_EXCEEDS_WALL_LENGTH",
		});
		expect(JSON.stringify(result.project)).toBe(beforeEdit);
	});

	it("recognizes when a durable Opening no longer has a derivable canonical host", () => {
		const added = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-15T10:00:00.000Z",
		);
		if (added.kind !== "accepted") throw new Error("Expected a door fixture");

		expect(projectOpeningsRemainValid(added.project)).toBe(true);
		expect(
			projectOpeningsRemainValid({
				...added.project,
				level: { ...added.project.level, rooms: [] },
			}),
		).toBe(false);
	});

	it("stores a selected wall-hosted door as an atomic Project update", () => {
		const result = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-12T10:02:00.000Z",
		);

		expect(result).toEqual({
			kind: "accepted",
			project: expect.objectContaining({
				level: expect.objectContaining({
					openings: [
						{
							heightMm: 2100,
							kind: "Door",
							offsetMm: 2050,
							openingId: "door-1",
							sillMm: 0,
							swingSide: "right",
							wallSegmentId: "wall-1",
							widthMm: 900,
						},
					],
				}),
				updatedAt: "2026-08-12T10:02:00.000Z",
			}),
		});
	});

	it("keeps a normal room wall available as a door host when an unrelated free wall is present", () => {
		const source = roomProject();
		const withDetachedWall = {
			...source,
			level: {
				...source.level,
				vertices: [
					...source.level.vertices,
					{ vertexId: "free-start", xMm: 6000, zMm: 5000 },
					{ vertexId: "free-end", xMm: 7600, zMm: 5000 },
				],
				wallSegments: [
					...source.level.wallSegments,
					{
						endVertexId: "free-end",
						startVertexId: "free-start",
						thicknessMm: 100,
						wallSegmentId: "free-wall",
					},
				],
			},
		};

		expect(
			addDoorOpeningToProject(
				withDetachedWall,
				{
					heightMm: 2100,
					offsetMm: 2050,
					sillMm: 0,
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				ids("door-1"),
				"2026-08-15T11:00:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [expect.objectContaining({ wallSegmentId: "wall-1" })],
					}),
				}),
			}),
		);
	});

	it("does not allocate an opening or modify the Project when the opening crosses a wall end", () => {
		const source = roomProject();
		const before = JSON.stringify(source);

		expect(
			addDoorOpeningToProject(
				source,
				{
					heightMm: 2100,
					offsetMm: 100,
					sillMm: 0,
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				{
					next: () => {
						throw new Error("Invalid opening must not allocate an ID");
					},
				},
				"2026-08-12T10:02:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "OPENING_OUTSIDE_WALL_INTERVAL",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("removes exactly the selected hosted opening without changing its wall", () => {
		const added = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-12T10:02:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a door fixture");
		}

		const deleted = deleteDoorOpeningFromProject(
			added.project,
			{ openingId: "door-1" },
			"2026-08-12T10:03:00.000Z",
		);

		expect(deleted).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [],
						wallSegments: roomProject().level.wallSegments,
					}),
					updatedAt: "2026-08-12T10:03:00.000Z",
				}),
			}),
		);
	});

	it("moves a durable door along its existing wall without changing its host identity", () => {
		const added = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-12T10:02:00.000Z",
		);
		if (added.kind !== "accepted") throw new Error("Expected a door fixture");

		expect(
			moveDoorOpeningInProject(
				added.project,
				{ openingId: "door-1", offsetMm: 2500 },
				"2026-08-13T14:52:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [
							expect.objectContaining({ openingId: "door-1", offsetMm: 2500 }),
						],
					}),
				}),
			}),
		);
	});

	it("updates a placed door width and its opening side atomically", () => {
		const added = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-12T10:02:00.000Z",
		);
		if (added.kind !== "accepted") throw new Error("Expected a door fixture");

		expect(
			updateDoorOpeningInProject(
				added.project,
				{ openingId: "door-1", swingSide: "left", widthMm: 1100 },
				"2026-08-13T15:02:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [
							expect.objectContaining({
								openingId: "door-1",
								swingSide: "left",
								widthMm: 1100,
							}),
						],
					}),
				}),
			}),
		);
	});

	it("does not flip a door through an already placed item in its new swing sector", () => {
		const withDoor = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 1000,
				sillMm: 0,
				swingSide: "right",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-13T15:02:00.000Z",
		);
		if (withDoor.kind !== "accepted")
			throw new Error("Expected a door fixture");
		const withItem = createParametricFloorItem(
			withDoor.project,
			{
				color: "#2f80ed",
				depthMm: 300,
				heightMm: 750,
				label: "Тумба",
				roomId: "room-1",
				widthMm: 300,
				xMm: 700,
				zMm: 650,
			},
			ids("item-1"),
			"2026-08-13T15:03:00.000Z",
		);
		if (withItem.kind !== "accepted")
			throw new Error("Expected item outside the outward swing");

		expect(
			updateDoorOpeningInProject(
				withItem.project,
				{ openingId: "door-1", swingSide: "left" },
				"2026-08-13T15:04:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "DOOR_CLEARANCE_COLLISION" });
	});
});
