import { describe, expect, it } from "@rstest/core";

import {
	addDoorOpening,
	assessDoorOpeningPlacement,
	assessWindowOpeningPlacement,
	addWindowOpening,
	deleteWallOpening,
	moveWallOpening,
	updateWallOpening,
	wallOpeningIntervalMm,
	type DoorOpening,
	type WallOpeningHost,
} from "./wall-opening";

function wallHosts(
	overrides: Partial<WallOpeningHost> = {},
): readonly WallOpeningHost[] {
	return [
		{
			heightMm: 2600,
			usableLengthMm: 4000,
			wallSegmentId: "wall-main",
			...overrides,
		},
	];
}

function opening(overrides: Partial<DoorOpening> = {}): DoorOpening {
	return {
		heightMm: 2100,
		kind: "Door",
		offsetMm: 2000,
		openingId: "opening-existing",
		sillMm: 0,
		wallSegmentId: "wall-main",
		widthMm: 900,
		swingSide: "right",
		...overrides,
	};
}

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function idsThatMustNotAllocate() {
	return {
		next: () => {
			throw new Error("A rejected opening must not allocate an identity");
		},
	};
}

describe("wall-hosted door openings", () => {
	it("adds a window with an exact sill and no door swing state", () => {
		const result = addWindowOpening(
			{ openings: [], wallHosts: wallHosts() },
			{
				heightMm: 1200,
				offsetMm: 2000,
				sillMm: 900,
				wallSegmentId: "wall-main",
				widthMm: 1200,
			},
			ids("window-1"),
		);

		expect(result).toEqual({
			kind: "accepted",
			openings: [
				{
					heightMm: 1200,
					kind: "Window",
					offsetMm: 2000,
					openingId: "window-1",
					sillMm: 900,
					wallSegmentId: "wall-main",
					widthMm: 1200,
				},
			],
		});
	});

	it("enforces the 800 mm residential doorway minimum and never permits a width beyond its host wall", () => {
		const exactMinimum = addDoorOpening(
			{ openings: [], wallHosts: wallHosts() },
			{
				heightMm: 2100,
				offsetMm: 400,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 800,
			},
			ids("door-minimum"),
		);
		const exactHostWidth = addDoorOpening(
			{ openings: [], wallHosts: wallHosts() },
			{
				heightMm: 2100,
				offsetMm: 2000,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 4000,
			},
			ids("door-full-wall"),
		);
		const belowMinimum = addDoorOpening(
			{ openings: [], wallHosts: wallHosts() },
			{
				heightMm: 2100,
				offsetMm: 400,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 799,
			},
			idsThatMustNotAllocate(),
		);
		const beyondHost = addDoorOpening(
			{ openings: [], wallHosts: wallHosts() },
			{
				heightMm: 2100,
				offsetMm: 2000,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 4001,
			},
			idsThatMustNotAllocate(),
		);

		expect(exactMinimum).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(exactHostWidth).toEqual(
			expect.objectContaining({ kind: "accepted" }),
		);
		expect(belowMinimum).toEqual({
			kind: "rejected",
			reasonCode: "DOOR_WIDTH_BELOW_MINIMUM",
		});
		expect(beyondHost).toEqual({
			kind: "rejected",
			reasonCode: "DOOR_WIDTH_EXCEEDS_WALL_LENGTH",
		});
	});

	it("adds a door with a durable ID to its selected wall without changing existing openings", () => {
		const existing = [
			opening({ openingId: "door-kept", widthMm: 600, offsetMm: 500 }),
		];

		const result = addDoorOpening(
			{ openings: existing, wallHosts: wallHosts() },
			{
				heightMm: 2100,
				offsetMm: 2500,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 900,
			},
			ids("door-1"),
		);

		expect(result).toEqual({
			kind: "accepted",
			openings: [
				existing[0],
				{
					heightMm: 2100,
					kind: "Door",
					offsetMm: 2500,
					openingId: "door-1",
					sillMm: 0,
					swingSide: "right",
					wallSegmentId: "wall-main",
					widthMm: 900,
				},
			],
		});
		expect(existing).toEqual([
			opening({ openingId: "door-kept", widthMm: 600, offsetMm: 500 }),
		]);
	});

	it.each([
		["accepts the first exact interval boundary", 450, 900, "accepted"],
		[
			"rejects a left edge outside the usable interval",
			449,
			900,
			"OPENING_OUTSIDE_WALL_INTERVAL",
		],
		["accepts the final exact interval boundary", 3550, 900, "accepted"],
		[
			"rejects a right edge outside the usable interval",
			3551,
			900,
			"OPENING_OUTSIDE_WALL_INTERVAL",
		],
	])("%s", (_description, offsetMm, widthMm, expected) => {
		const result = addDoorOpening(
			{ openings: [], wallHosts: wallHosts() },
			{
				heightMm: 2100,
				offsetMm,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm,
			},
			expected === "accepted" ? ids("door-boundary") : idsThatMustNotAllocate(),
		);

		expect(result.kind === "accepted" ? result.kind : result.reasonCode).toBe(
			expected,
		);
	});

	it("permits a door up to the wall height and rejects one millimetre above it", () => {
		const exactHeight = addDoorOpening(
			{ openings: [], wallHosts: wallHosts() },
			{
				heightMm: 2400,
				offsetMm: 2000,
				sillMm: 200,
				wallSegmentId: "wall-main",
				widthMm: 900,
			},
			ids("door-exact-height"),
		);
		const tooTall = addDoorOpening(
			{ openings: [], wallHosts: wallHosts() },
			{
				heightMm: 2401,
				offsetMm: 2000,
				sillMm: 200,
				wallSegmentId: "wall-main",
				widthMm: 900,
			},
			idsThatMustNotAllocate(),
		);

		expect(exactHeight).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(tooTall).toEqual({
			kind: "rejected",
			reasonCode: "OPENING_OUT_OF_BOUNDS",
		});
	});

	it.each([
		[
			"a zero width",
			{
				heightMm: 2100,
				offsetMm: 2000,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 0,
			},
		],
		[
			"a zero height",
			{
				heightMm: 0,
				offsetMm: 2000,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 900,
			},
		],
		[
			"a negative sill",
			{
				heightMm: 2100,
				offsetMm: 2000,
				sillMm: -1,
				wallSegmentId: "wall-main",
				widthMm: 900,
			},
		],
		[
			"a fractional offset",
			{
				heightMm: 2100,
				offsetMm: 2000.5,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 900,
			},
		],
	])("rejects %s before allocating an ID", (_description, input) => {
		expect(
			addDoorOpening(
				{ openings: [], wallHosts: wallHosts() },
				input,
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
	});

	it("rejects a missing wall host before allocating an ID", () => {
		expect(
			addDoorOpening(
				{ openings: [], wallHosts: wallHosts() },
				{
					heightMm: 2100,
					offsetMm: 2000,
					sillMm: 0,
					wallSegmentId: "wall-missing",
					widthMm: 900,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_NOT_FOUND" });
	});

	it("rejects a malformed selected wall host before allocating an ID", () => {
		expect(
			addDoorOpening(
				{ openings: [], wallHosts: wallHosts({ heightMm: 0 }) },
				{
					heightMm: 2100,
					offsetMm: 2000,
					sillMm: 0,
					wallSegmentId: "wall-main",
					widthMm: 900,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_WALL_HOST" });
	});

	it("rejects an ambiguous duplicate wall host before allocating an ID", () => {
		const host = wallHosts()[0];
		if (!host) {
			throw new Error("Expected a test wall host");
		}

		expect(
			addDoorOpening(
				{ openings: [], wallHosts: [host, { ...host, heightMm: 2800 }] },
				{
					heightMm: 2100,
					offsetMm: 2000,
					sillMm: 0,
					wallSegmentId: "wall-main",
					widthMm: 900,
				},
				idsThatMustNotAllocate(),
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_WALL_HOST" });
	});

	it("rejects only positive overlap on the same host, while allowing two openings to meet at an edge", () => {
		const existing = [opening({ offsetMm: 2000, widthMm: 1000 })];
		const overlapping = addDoorOpening(
			{ openings: existing, wallHosts: wallHosts() },
			{
				heightMm: 2100,
				offsetMm: 2500,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 1000,
			},
			idsThatMustNotAllocate(),
		);
		const touching = addDoorOpening(
			{ openings: existing, wallHosts: wallHosts() },
			{
				heightMm: 2100,
				offsetMm: 3000,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 1000,
			},
			ids("door-touching"),
		);

		expect(overlapping).toEqual({
			kind: "rejected",
			reasonCode: "OPENING_OVERLAP",
		});
		expect(touching).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("does not treat an opening on a different wall as an overlap", () => {
		const result = addDoorOpening(
			{
				openings: [opening({ wallSegmentId: "wall-other", widthMm: 1000 })],
				wallHosts: [
					...wallHosts(),
					{ heightMm: 2600, usableLengthMm: 4000, wallSegmentId: "wall-other" },
				],
			},
			{
				heightMm: 2100,
				offsetMm: 2000,
				sillMm: 0,
				wallSegmentId: "wall-main",
				widthMm: 1000,
			},
			ids("door-isolated"),
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("exposes the exact centre-offset interval for 2D and 3D projections", () => {
		expect(wallOpeningIntervalMm({ offsetMm: 2001, widthMm: 901 })).toEqual({
			endMm: 2451.5,
			startMm: 1550.5,
		});
	});

	it("deletes exactly the selected opening and leaves the supplied collection unchanged", () => {
		const openings = [
			opening({ openingId: "door-1" }),
			opening({ openingId: "door-2", offsetMm: 3200 }),
		];

		const result = deleteWallOpening(openings, "door-1");

		expect(result).toEqual({ kind: "accepted", openings: [openings[1]] });
		expect(openings).toEqual([
			opening({ openingId: "door-1" }),
			opening({ openingId: "door-2", offsetMm: 3200 }),
		]);
	});

	it("moves a door along its selected host without allocating a replacement identity", () => {
		const result = moveWallOpening(
			{
				openings: [opening({ openingId: "door-1", offsetMm: 1200 })],
				wallHosts: wallHosts(),
			},
			{ offsetMm: 2800, openingId: "door-1" },
		);

		expect(result).toEqual({
			kind: "accepted",
			openings: [
				expect.objectContaining({ openingId: "door-1", offsetMm: 2800 }),
			],
		});
	});

	it("keeps the same durable opening while changing its width or opening side", () => {
		const result = updateWallOpening(
			{
				openings: [opening({ openingId: "door-1", offsetMm: 2100 })],
				wallHosts: wallHosts(),
			},
			{ openingId: "door-1", swingSide: "left", widthMm: 1200 },
		);

		expect(result).toEqual({
			kind: "accepted",
			openings: [
				expect.objectContaining({
					openingId: "door-1",
					offsetMm: 2100,
					swingSide: "left",
					widthMm: 1200,
				}),
			],
		});
	});

	it("keeps the 800 mm minimum and wall-length maximum when an existing door is resized", () => {
		const state = {
			openings: [opening({ openingId: "door-1", offsetMm: 2000 })],
			wallHosts: wallHosts(),
		};

		expect(
			updateWallOpening(state, { openingId: "door-1", widthMm: 799 }),
		).toEqual({
			kind: "rejected",
			reasonCode: "DOOR_WIDTH_BELOW_MINIMUM",
		});
		expect(
			updateWallOpening(state, { openingId: "door-1", widthMm: 4001 }),
		).toEqual({
			kind: "rejected",
			reasonCode: "DOOR_WIDTH_EXCEEDS_WALL_LENGTH",
		});
		expect(
			updateWallOpening(state, { openingId: "door-1", widthMm: 800 }),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(
			updateWallOpening(state, { openingId: "door-1", widthMm: 4000 }),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(state.openings).toEqual([
			opening({ openingId: "door-1", offsetMm: 2000 }),
		]);
	});

	it("allows a narrow window resize but never gives it a door swing side", () => {
		const windowOpening = {
			heightMm: 1200,
			kind: "Window" as const,
			offsetMm: 2000,
			openingId: "window-1",
			sillMm: 900,
			wallSegmentId: "wall-main",
			widthMm: 1200,
		};
		const state = { openings: [windowOpening], wallHosts: wallHosts() };

		expect(
			updateWallOpening(state, { openingId: "window-1", widthMm: 600 }),
		).toEqual({
			kind: "accepted",
			openings: [expect.objectContaining({ kind: "Window", widthMm: 600 })],
		});
		expect(
			updateWallOpening(state, { openingId: "window-1", swingSide: "left" }),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });
		expect(state.openings).toEqual([windowOpening]);
	});

	it("updates a window sill and height atomically, including the exact host-height boundary", () => {
		const windowOpening = {
			heightMm: 1200,
			kind: "Window" as const,
			offsetMm: 2000,
			openingId: "window-1",
			sillMm: 900,
			wallSegmentId: "wall-main",
			widthMm: 1200,
		};
		const state = { openings: [windowOpening], wallHosts: wallHosts() };

		expect(
			updateWallOpening(state, {
				heightMm: 1500,
				openingId: "window-1",
				sillMm: 1100,
			}),
		).toEqual({
			kind: "accepted",
			openings: [
				expect.objectContaining({
					heightMm: 1500,
					kind: "Window",
					sillMm: 1100,
				}),
			],
		});
		expect(
			updateWallOpening(state, {
				heightMm: 1501,
				openingId: "window-1",
				sillMm: 1100,
			}),
		).toEqual({ kind: "rejected", reasonCode: "OPENING_OUT_OF_BOUNDS" });
		expect(state.openings).toEqual([windowOpening]);
	});

	it("rejects a resized opening that would cross its wall end without changing the original", () => {
		const openings = [
			opening({ openingId: "door-1", offsetMm: 450, widthMm: 900 }),
		];

		expect(
			updateWallOpening(
				{ openings, wallHosts: wallHosts() },
				{ openingId: "door-1", widthMm: 902 },
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "OPENING_OUTSIDE_WALL_INTERVAL",
		});
		expect(openings).toEqual([
			opening({ openingId: "door-1", offsetMm: 450, widthMm: 900 }),
		]);
	});

	it("keeps the original opening when a moved door would cross another one", () => {
		const openings = [
			opening({ openingId: "door-1", offsetMm: 900, widthMm: 900 }),
			opening({ openingId: "door-2", offsetMm: 2800, widthMm: 900 }),
		];

		expect(
			moveWallOpening(
				{ openings, wallHosts: wallHosts() },
				{ offsetMm: 2400, openingId: "door-1" },
			),
		).toEqual({ kind: "rejected", reasonCode: "OPENING_OVERLAP" });
		expect(openings).toEqual([
			opening({ openingId: "door-1", offsetMm: 900, widthMm: 900 }),
			opening({ openingId: "door-2", offsetMm: 2800, widthMm: 900 }),
		]);
	});

	it("rejects deletion of an unknown opening without changing its collection", () => {
		const openings = [opening()];

		expect(deleteWallOpening(openings, "opening-missing")).toEqual({
			kind: "rejected",
			reasonCode: "OPENING_NOT_FOUND",
		});
		expect(openings).toEqual([opening()]);
	});
});

describe("read-only opening placement assessments", () => {
	it("checks accepted placement without allocating or modifying frozen inputs and preserves negative zero", () => {
		const input = Object.freeze({
			wallSegmentId: "wall-main",
			offsetMm: 450,
			widthMm: 900,
			heightMm: 2100,
			sillMm: -0,
			swingSide: undefined,
		});
		const state = Object.freeze({
			openings: Object.freeze([]),
			wallHosts: Object.freeze(wallHosts().map((host) => Object.freeze(host))),
		});
		expect(assessDoorOpeningPlacement(state, input)).toEqual({
			kind: "accepted",
		});
		expect(assessWindowOpeningPlacement(state, input)).toEqual({
			kind: "accepted",
		});
		expect(state.openings).toEqual([]);
		expect(Object.is(input.sillMm, -0)).toBe(true);
		expect(Object.hasOwn(input, "swingSide")).toBe(true);
		expect(input.swingSide).toBeUndefined();
	});

	for (const kind of ["Door", "Window"] as const) {
		const assess =
			kind === "Door"
				? assessDoorOpeningPlacement
				: assessWindowOpeningPlacement;
		it.each([
			{
				name: "invalid dimensions before missing host",
				input: { widthMm: 0 },
				hosts: [],
				reason: "INVALID_DIMENSION",
			},
			{ name: "missing host", input: {}, hosts: [], reason: "WALL_NOT_FOUND" },
			{
				name: "invalid host before opening width",
				input: { widthMm: 1 },
				hosts: wallHosts({ heightMm: 0 }),
				reason: "INVALID_WALL_HOST",
			},
			{
				name: "duplicate host",
				input: {},
				hosts: [...wallHosts(), ...wallHosts()],
				reason: "INVALID_WALL_HOST",
			},
			{
				name: "width beyond host before interval",
				input: { widthMm: 4001, offsetMm: 0 },
				hosts: wallHosts(),
				reason:
					kind === "Door"
						? "DOOR_WIDTH_EXCEEDS_WALL_LENGTH"
						: "WINDOW_WIDTH_EXCEEDS_WALL_LENGTH",
			},
			{
				name: "interval before height",
				input: { offsetMm: 449, heightMm: 9000 },
				hosts: wallHosts(),
				reason: "OPENING_OUTSIDE_WALL_INTERVAL",
			},
			{
				name: "height before overlap",
				input: { heightMm: 2601 },
				hosts: wallHosts(),
				reason: "OPENING_OUT_OF_BOUNDS",
			},
			{
				name: "positive same-wall overlap",
				input: {},
				hosts: wallHosts(),
				reason: "OPENING_OVERLAP",
			},
		])(`${kind}: $name`, ({ input, hosts, reason }) => {
			const state = { openings: [opening()], wallHosts: hosts };
			const before = { openings: state.openings.map((opening) => ({ ...opening })), wallHosts: state.wallHosts.map((host) => ({ ...host })) };
			expect(
				assess(state, {
					wallSegmentId: "wall-main",
					offsetMm: 2000,
					widthMm: 900,
					heightMm: 2100,
					sillMm: 0,
					...input,
				}),
			).toEqual({ kind: "rejected", reasonCode: reason });
			expect(state).toEqual(before);
		});
		it(`${kind}: permits exact host and touching boundaries without adding an opening`, () => {
			const state = {
				openings: [opening({ offsetMm: 900, widthMm: 900 })],
				wallHosts: wallHosts(),
			};
			expect(
				assess(state, {
					wallSegmentId: "wall-main",
					offsetMm: 1800,
					widthMm: 900,
					heightMm: 2600,
					sillMm: 0,
				}),
			).toEqual({ kind: "accepted" });
			expect(state.openings).toHaveLength(1);
		});
	}
	it("keeps the residential door minimum ahead of interval, while accepting a narrow valid window", () => {
		const state = { openings: [], wallHosts: wallHosts() };
		const narrow = {
			wallSegmentId: "wall-main",
			offsetMm: 1,
			widthMm: 799,
			heightMm: 2100,
			sillMm: 0,
		};
		expect(assessDoorOpeningPlacement(state, narrow)).toEqual({
			kind: "rejected",
			reasonCode: "DOOR_WIDTH_BELOW_MINIMUM",
		});
		expect(
			assessWindowOpeningPlacement(state, { ...narrow, offsetMm: 400 }),
		).toEqual({ kind: "accepted" });
	});
});

it("read-only Window permits exactly the full host width without converting it to a Door", () => {
	const state = { openings: [], wallHosts: wallHosts() };
	expect(
		assessWindowOpeningPlacement(state, {
			wallSegmentId: "wall-main",
			offsetMm: 2000,
			widthMm: 4000,
			heightMm: 1000,
			sillMm: 500,
		}),
	).toEqual({ kind: "accepted" });
	expect(state.openings).toEqual([]);
});
