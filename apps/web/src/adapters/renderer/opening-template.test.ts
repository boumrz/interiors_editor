import { expect, it } from "@rstest/core";
import type { DoorWallOpening, WindowWallOpening } from "../../domain/project";
import { openingTemplateFor } from "./opening-template";

const door: DoorWallOpening = {
	kind: "Door",
	offsetMm: 1400,
	widthMm: 900,
	heightMm: 2100,
	sillMm: 200,
	openingId: "door",
	wallSegmentId: "host",
};
const window: WindowWallOpening = {
	kind: "Window",
	offsetMm: 1400,
	widthMm: 900,
	heightMm: 1000,
	sillMm: 800,
	openingId: "window",
	wallSegmentId: "host",
};
const start = { xMm: -200, zMm: 900, vertexId: "start" };
const end = { xMm: 1800, zMm: 2900, vertexId: "end" };

it.each([
	["left", 1],
	["right", -1],
	[undefined, -1],
] as const)(
	"places the %s leaf inside the clearance sector of a translated diagonal host",
	(swingSide, sign) => {
		const parts = openingTemplateFor(
			{ ...door, swingSide },
			start,
			end,
			80,
			-400,
			-700,
		);
		const leaf = parts.find((part) => part.role === "leaf");
		expect(leaf?.box.centerXM).toBeCloseTo(
			(200 + (1009 - sign * 410) / Math.SQRT2) / 1000,
		);
		expect(leaf?.box.centerZM).toBeCloseTo(
			(1600 + (1009 + sign * 410) / Math.SQRT2) / 1000,
		);
		expect(leaf?.box).toMatchObject({
			centerYM: 1.23,
			widthM: 0.038,
			depthM: 0.82,
			heightM: 2.06,
			yawRadians: -Math.PI / 4,
		});
		const handles = parts.filter((part) => part.role === "hardware");
		expect(handles).toHaveLength(3);
		const spindle = handles[0]?.box;
		expect(spindle?.widthM).toBe(0.112);
		expect(spindle?.heightM).toBe(0.02);
		expect(spindle?.depthM).toBe(0.02);
		expect(spindle?.centerYM).toBe(1.2);
		expect(spindle?.centerXM).toBeCloseTo((200 + (1009 - sign * 753) / Math.SQRT2) / 1000);
		expect(spindle?.centerZM).toBeCloseTo((1600 + (1009 + sign * 753) / Math.SQRT2) / 1000);
		// Handles stand clear of both faces of the leaf, near its free end.
		for (const [i, handle] of handles.slice(1).entries()) {
			const along = 1009 + (i === 0 ? -56 : 56);
			const across = sign * 703;
			expect(handle.box.centerXM).toBeCloseTo(
				(200 + (along - across) / Math.SQRT2) / 1000,
			);
			expect(handle.box.centerZM).toBeCloseTo(
				(1600 + (along + across) / Math.SQRT2) / 1000,
			);
			expect(handle.box).toMatchObject({
				widthM: 0.016,
				heightM: 0.02,
				depthM: 0.1,
			});
		}
		expect(parts.every((part) => part.wallSegmentId === "host")).toBe(true);
		expect(
			parts
				.filter((part) => part.role === "frame")
				.map((part) => [part.box.widthM, part.box.heightM, part.box.depthM]),
		).toEqual([
			[0.04, 2.1, 0.08],
			[0.04, 2.1, 0.08],
			[0.82, 0.04, 0.08],
		]);
	},
);

it.each(["left", "right"] as const)("mirrors the %s leaf and spindle to the end jamb", (swingSide) => {
	const horizontalEnd = { ...end, zMm: start.zMm };
	const fromStart = openingTemplateFor({ ...door, swingSide }, start, horizontalEnd, 80, -200, 900);
	const fromEnd = openingTemplateFor({ ...door, swingSide, hingeEnd: "end" }, start, horizontalEnd, 80, -200, 900);
	for (const role of ["leaf", "hardware"] as const) {
		const original = fromStart.find(part => part.role === role);
		const mirrored = fromEnd.find(part => part.role === role);
		expect(mirrored?.box.centerXM).toBeCloseTo(2.8 - (original?.box.centerXM ?? 0));
		expect(mirrored?.box.centerZM).toBeCloseTo(original?.box.centerZM ?? 0);
	}
	expect(fromEnd.filter(part => part.role === "frame")).toEqual(fromStart.filter(part => part.role === "frame"));
});

it.each([
	[899, 1],
	[900, 2],
] as const)(
	"builds %s mm windows with %s panes fitting between the stiles",
	(widthMm, count) => {
		const parts = openingTemplateFor(
			{ ...window, widthMm },
			start,
			{ ...end, zMm: start.zMm },
			200,
			-200,
			900,
		);
		const panes = parts.filter((part) => part.role === "glass");
		expect(panes).toHaveLength(count);
		const usable = widthMm - (count === 2 ? 120 : 80);
		for (const [ordinal, part] of panes.entries()) {
			const center =
				count === 1
					? 1.4
					: 1.4 + ((ordinal === 0 ? -1 : 1) * (usable / 4 + 20)) / 1000;
			expect(part.box.centerXM).toBeCloseTo(center);
			expect(part.box).toMatchObject({
				centerYM: 1.3,
				centerZM: 0,
				widthM: usable / count / 1000,
				heightM: 0.92,
				depthM: 0.008,
			});
		}
		const frame = parts.filter((part) => part.role === "frame");
		expect(frame).toHaveLength(count === 1 ? 4 : 5);
		expect(frame.map((part) => part.box.depthM)).toEqual(
			Array(frame.length).fill(0.11),
		);
		expect(frame.map((part) => part.box.centerYM)).toEqual(
			count === 1 ? [1.3, 1.3, 1.78, 0.82] : [1.3, 1.3, 1.78, 0.82, 1.3],
		);
		expect(frame.map((part) => part.box.centerXM)).toEqual([
			(1400 - widthMm / 2 + 20) / 1000,
			(1400 + widthMm / 2 - 20) / 1000,
			1.4,
			1.4,
			...(count === 2 ? [1.4] : []),
		]);
	},
);

it.each([
	[1, 20],
	[20, 1],
])(
	"fits every member inside a %s by %s mm legacy window",
	(widthMm, heightMm) => {
		const parts = openingTemplateFor(
			{ ...window, widthMm, heightMm },
			start,
			end,
			20,
			0,
			0,
		);
		const glazing = parts.find((part) => part.role === "glass");
		expect(glazing?.box.widthM).toBe((widthMm - 0.25) / 1000);
		expect(glazing?.box.heightM).toBe((heightMm - 0.25) / 1000);
		expect(glazing?.box.depthM).toBe(0.005);
		expect(
			parts.every((part) => part.box.widthM > 0 && part.box.heightM > 0),
		).toBe(true);
	},
);

it.each([
	[299, 0],
	[300, 3],
] as const)("uses compact handling for a %s mm door", (heightMm, count) => {
	const parts = openingTemplateFor(
		{ ...door, heightMm },
		start,
		end,
		120,
		0,
		0,
	);
	const knobs = parts.filter((part) => part.role === "hardware");
	expect(knobs).toHaveLength(count);
	if (count)
		expect(knobs[0]?.box.centerYM).toBeCloseTo(
			(200 + (300 - 37.5) * 0.6) / 1000,
		);
});
