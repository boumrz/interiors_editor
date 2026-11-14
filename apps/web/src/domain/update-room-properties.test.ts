import { describe, expect, it } from "@rstest/core";
import { addDoorOpeningToProject } from "./door-opening-project";
import { addGeneralWallToProject } from "./general-wall-project";
import { createInitialProject } from "./initial-project";
import { configureRectangularRoom } from "./rectangular-room";
import {
	previewRoomHeightOpeningConflict,
	resolveRoomHeightOpeningConflict,
	updateRoomProperties,
} from "./update-room-properties";

function roomProject() {
	const values = [
		"v-1",
		"v-2",
		"v-3",
		"v-4",
		"wall-1",
		"wall-2",
		"wall-3",
		"wall-4",
		"room-1",
	];
	let index = 0;
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-15T18:00:00.000Z",
			levelId: "level-1",
			name: "План",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		{ next: () => values[index++] ?? `unexpected-${index}` },
		"2026-08-15T18:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected a valid Room fixture");
	}
	return configured.project;
}

describe("updateRoomProperties", () => {
	it("updates one room in a shared plan without changing another room or either hidden name", () => {
		const configured = roomProject();
		const xs = configured.level.vertices.map((vertex) => vertex.xMm);
		const zs = configured.level.vertices.map((vertex) => vertex.zMm);
		const xMm = (Math.min(...xs) + Math.max(...xs)) / 2;
		let sequence = 0;
		const divided = addGeneralWallToProject(
			configured,
			{
				start: { xMm, zMm: Math.min(...zs) },
				end: { xMm, zMm: Math.max(...zs) },
				thicknessMm: 100,
			},
			{ next: () => `divider-${++sequence}` },
			"2026-08-15T18:01:30.000Z",
		);
		if (divided.kind !== "accepted")
			throw new Error("Expected two valid rooms");
		expect(divided.project.level.rooms).toHaveLength(2);
		const source = {
			...divided.project,
			level: {
				...divided.project.level,
				rooms: divided.project.level.rooms.map((room, index) => ({
					...room,
					name: `  Историческое имя ${index}  `,
				})),
			},
		};
		const target = source.level.rooms[0];
		if (!target) throw new Error("Expected selected room");
		const result = updateRoomProperties(
			source,
			{ heightMm: 2800, roomId: target.roomId, type: "kitchen" },
			"2026-08-15T18:02:00.000Z",
		);
		expect(result).toEqual({
			kind: "accepted",
			project: {
				...source,
				level: {
					...source.level,
					rooms: [
						{ ...target, heightMm: 2800, type: "kitchen" },
						source.level.rooms[1],
					],
				},
				updatedAt: "2026-08-15T18:02:00.000Z",
			},
		});
	});

	it.each([undefined, "  Историческое имя  ", ""])(
		"preserves the exact legacy name %s when only type and height change",
		(name) => {
			const configured = roomProject();
			const source = {
				...configured,
				level: {
					...configured.level,
					rooms: configured.level.rooms.map((room) => ({
						...room,
						...(name === undefined ? {} : { name }),
					})),
				},
			};
			const before = JSON.stringify(source);
			const result = updateRoomProperties(
				source,
				{
					heightMm: 2800,
					roomId: "room-1",
					type: "kitchen",
				},
				"2026-08-15T18:02:00.000Z",
			);
			expect(result).toEqual({
				kind: "accepted",
				project: {
					...source,
					level: {
						...source.level,
						rooms: source.level.rooms.map((room) => ({
							...room,
							heightMm: 2800,
							type: "kitchen",
						})),
					},
					updatedAt: "2026-08-15T18:02:00.000Z",
				},
			});
			if (result.kind !== "accepted")
				throw new Error("Expected metadata update");
			expect(Object.hasOwn(result.project.level.rooms[0] ?? {}, "name")).toBe(
				name !== undefined,
			);
			expect(JSON.stringify(source)).toBe(before);
		},
	);

	it("preserves an absent name through a confirmed Room-height Opening resolution", () => {
		const opened = addDoorOpeningToProject(
			roomProject(),
			{
				heightMm: 2100,
				offsetMm: 1200,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			{ next: () => "door-1" },
			"2026-08-15T18:01:30.000Z",
		);
		if (opened.kind !== "accepted") throw new Error("Expected Door fixture");
		const input = {
			heightMm: 2000,
			roomId: "room-1",
			type: "kitchen",
			openingResolutions: [
				{ heightMm: 1900, kind: "resize" as const, openingId: "door-1" },
			],
		};
		expect(previewRoomHeightOpeningConflict(opened.project, input)).toEqual({
			kind: "conflict",
			openingIds: ["door-1"],
			roomId: "room-1",
		});
		const result = resolveRoomHeightOpeningConflict(
			opened.project,
			input,
			"2026-08-15T18:02:00.000Z",
		);
		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted")
			throw new Error("Expected resolved height change");
		expect(result.project.level.rooms).toEqual(
			opened.project.level.rooms.map((room) => ({
				...room,
				heightMm: 2000,
				type: "kitchen",
			})),
		);
		expect(Object.hasOwn(result.project.level.rooms[0] ?? {}, "name")).toBe(
			false,
		);
		expect(result.project.level.openings[0]?.heightMm).toBe(1900);
	});

	it("previews every Opening made too tall by a lower Room height without mutating the Project", () => {
		const configured = roomProject();
		const hostWallSegmentId = configured.level.wallSegments[0]?.wallSegmentId;
		if (!hostWallSegmentId) {
			throw new Error("Expected a wall in the Room fixture");
		}
		const opened = addDoorOpeningToProject(
			configured,
			{
				heightMm: 2100,
				offsetMm: 1200,
				sillMm: 0,
				wallSegmentId: hostWallSegmentId,
				widthMm: 900,
			},
			{ next: () => "door-1" },
			"2026-08-15T18:01:30.000Z",
		);
		if (opened.kind !== "accepted") {
			throw new Error("Expected a valid Door fixture");
		}

		expect(
			previewRoomHeightOpeningConflict(opened.project, {
				heightMm: 2000,
				name: "Кухня",
				roomId: "room-1",
				type: "kitchen",
			}),
		).toEqual({
			kind: "conflict",
			openingIds: ["door-1"],
			roomId: "room-1",
		});
		expect(
			updateRoomProperties(
				opened.project,
				{
					heightMm: 2000,
					name: "Кухня",
					roomId: "room-1",
					type: "kitchen",
				},
				"2026-08-15T18:02:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ROOM_HEIGHT_OPENING_CONFLICT" });
		expect(opened.project.level.openings).toEqual([
			expect.objectContaining({ heightMm: 2100, openingId: "door-1" }),
		]);
	});

	it("re-enters a Room-height conflict only with an exact explicit Opening resize or delete outcome", () => {
		const configured = roomProject();
		const hostWallSegmentId = configured.level.wallSegments[0]?.wallSegmentId;
		if (!hostWallSegmentId) {
			throw new Error("Expected a wall in the Room fixture");
		}
		const opened = addDoorOpeningToProject(
			configured,
			{
				heightMm: 2100,
				offsetMm: 1200,
				sillMm: 0,
				wallSegmentId: hostWallSegmentId,
				widthMm: 900,
			},
			{ next: () => "door-1" },
			"2026-08-15T18:01:30.000Z",
		);
		if (opened.kind !== "accepted") {
			throw new Error("Expected a valid Door fixture");
		}
		const draft = {
			heightMm: 2000,
			name: "Кухня",
			roomId: "room-1",
			type: "kitchen",
		} as const;

		expect(
			resolveRoomHeightOpeningConflict(
				opened.project,
				{
					...draft,
					openingResolutions: [
						{ heightMm: 1900, kind: "resize", openingId: "door-1" },
					],
				},
				"2026-08-15T18:02:00.000Z",
			),
		).toEqual({
			kind: "accepted",
			project: expect.objectContaining({
				level: expect.objectContaining({
					openings: [
						expect.objectContaining({ heightMm: 1900, openingId: "door-1" }),
					],
					rooms: [
						expect.objectContaining({
							heightMm: 2000,
							name: "Кухня",
							type: "kitchen",
						}),
					],
				}),
				updatedAt: "2026-08-15T18:02:00.000Z",
			}),
		});
		expect(
			resolveRoomHeightOpeningConflict(
				opened.project,
				{ ...draft, openingResolutions: [] },
				"2026-08-15T18:02:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "ROOM_HEIGHT_OPENING_CONFLICT_STALE",
		});
		expect(
			resolveRoomHeightOpeningConflict(
				opened.project,
				{
					...draft,
					openingResolutions: [
						{ kind: "delete", openingId: "door-1" },
						{ kind: "delete", openingId: "door-1" },
					],
				},
				"2026-08-15T18:02:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "ROOM_HEIGHT_OPENING_CONFLICT_STALE",
		});
		expect(
			resolveRoomHeightOpeningConflict(
				opened.project,
				{
					...draft,
					openingResolutions: [{ kind: "delete", openingId: "door-1" }],
				},
				"2026-08-15T18:02:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({ openings: [] }),
				}),
			}),
		);
		expect(opened.project.level.openings).toEqual([
			expect.objectContaining({ heightMm: 2100, openingId: "door-1" }),
		]);
	});

	it("changes only the selected Room properties and leaves derived geometry untouched", () => {
		const source = roomProject();

		expect(
			updateRoomProperties(
				source,
				{
					heightMm: 2700,
					name: "  Кухня  ",
					roomId: "room-1",
					type: "kitchen",
				},
				"2026-08-15T18:02:00.000Z",
			),
		).toEqual({
			kind: "accepted",
			project: {
				...source,
				level: {
					...source.level,
					rooms: [
						{
							...source.level.rooms[0],
							heightMm: 2700,
							name: "Кухня",
							type: "kitchen",
						},
					],
				},
				updatedAt: "2026-08-15T18:02:00.000Z",
			},
		});
	});

	it.each([500, 10_000])(
		"accepts the inclusive safe room-height boundary %i mm",
		(heightMm) => {
			expect(
				updateRoomProperties(
					roomProject(),
					{ heightMm, name: "Кухня", roomId: "room-1", type: "kitchen" },
					"2026-08-15T18:02:00.000Z",
				),
			).toEqual(
				expect.objectContaining({
					kind: "accepted",
					project: expect.objectContaining({
						level: expect.objectContaining({
							rooms: [expect.objectContaining({ heightMm })],
						}),
					}),
				}),
			);
		},
	);

	it.each([
		[
			"an unknown Room",
			{
				heightMm: 2600,
				name: "Кухня",
				roomId: "room-missing",
				type: "kitchen",
			},
			"ROOM_NOT_FOUND",
		],
		[
			"an empty name",
			{ heightMm: 2600, name: "   ", roomId: "room-1", type: "kitchen" },
			"ROOM_NAME_REQUIRED",
		],
		[
			"an unknown type",
			{ heightMm: 2600, name: "Кухня", roomId: "room-1", type: "attic" },
			"ROOM_TYPE_INVALID",
		],
		[
			"a height below the canonical safety floor",
			{ heightMm: 499, name: "Кухня", roomId: "room-1", type: "kitchen" },
			"ROOM_HEIGHT_INVALID",
		],
		[
			"a height above the canonical project limit",
			{ heightMm: 10_001, name: "Кухня", roomId: "room-1", type: "kitchen" },
			"ROOM_HEIGHT_INVALID",
		],
	])(
		"rejects %s without altering the source Project",
		(_description, input, reasonCode) => {
			const source = roomProject();

			expect(
				updateRoomProperties(source, input, "2026-08-15T18:02:00.000Z"),
			).toEqual({ kind: "rejected", reasonCode });
			expect(source.level.rooms[0]).toEqual(
				expect.objectContaining({ heightMm: 2600, roomId: "room-1" }),
			);
		},
	);
});
