import { describe, expect, it } from "@rstest/core";
import type { DrawingDimension } from "./drawing-dimensions";
import {
	DRAWING_DIMENSION_PREFERENCES_KEY,
	defaultDrawingDimensionVisibility,
	filterDrawingDimensions,
	loadDrawingDimensionPreferences,
	parseDrawingDimensionPreferences,
	saveDrawingDimensionPreferences,
	serializeDrawingDimensionPreferences,
	type DrawingDimensionVisibility,
} from "./drawing-dimension-visibility";

const internalOnly: DrawingDimensionVisibility = {
	wall: false,
	opening: false,
	pier: false,
	overall: false,
	"room-clear": true,
};
const allOff: DrawingDimensionVisibility = {
	...internalOnly,
	"room-clear": false,
};
const kinds = ["wall", "opening", "pier", "overall", "room-clear"] as const;

function annotation(
	kind: DrawingDimension["kind"],
	id: string = kind,
): DrawingDimension {
	return {
		id,
		kind,
		startMm: { xMm: 0, zMm: 0 },
		endMm: { xMm: 100, zMm: 0 },
		label: "100",
		valueMm: 100,
		reference:
			kind === "room-clear" ? "clear" : kind === "overall" ? "outer" : "axis",
		direction: "x",
		lane: 0,
		preferredSide: "top",
	};
}

function preference(visible: unknown, version: unknown = 1): string {
	return JSON.stringify({ version, visible });
}

describe("drawing dimension visibility preferences", () => {
	it("starts with fresh internal-only settings and the versioned origin preference key", () => {
		const first = defaultDrawingDimensionVisibility();
		const second = defaultDrawingDimensionVisibility();
		expect(first).toEqual(internalOnly);
		expect(second).toEqual(internalOnly);
		expect(first).not.toBe(second);
		expect(DRAWING_DIMENSION_PREFERENCES_KEY).toBe(
			"interiors.editor.dimension-visibility.v1",
		);
	});

	it.each(["opening", "overall", "room-clear"] as const)(
		"can independently show only %s annotations",
		(kind) => {
			const dimensions = Object.freeze(
				kinds.map((value) => Object.freeze(annotation(value))),
			);
			const visibility = Object.freeze({ ...allOff, [kind]: true });
			expect(filterDrawingDimensions(dimensions, visibility)).toEqual([
				annotation(kind),
			]);
			expect(dimensions.map((value) => value.kind)).toEqual(kinds);
			expect(visibility).toEqual({ ...allOff, [kind]: true });
		},
	);

	it.each(["wall", "pier"] as const)(
		"never renders retired %s dimensions even from an enabled legacy caller",
		(kind) => {
			const dimensions = Object.freeze([
				annotation(kind),
				annotation("room-clear"),
			]);
			const visibility = Object.freeze({ ...internalOnly, [kind]: true });
			expect(filterDrawingDimensions(dimensions, visibility)).toEqual([
				annotation("room-clear"),
			]);
			expect(visibility[kind]).toBe(true);
		},
	);

	it("keeps annotation order, source identities and exact values while filtering mixed groups", () => {
		const dimensions = Object.freeze([
			annotation("opening"),
			Object.freeze({
				...annotation("opening", "first-opening"),
				valueMm: 100.5,
				label: "101",
			}),
			annotation("overall"),
			annotation("pier"),
			annotation("room-clear"),
			annotation("opening", "second-opening"),
		]);
		const filtered = filterDrawingDimensions(
			dimensions,
			Object.freeze({
				...allOff,
				opening: true,
				overall: true,
				wall: true,
				pier: true,
			}),
		);
		expect(filtered.map((value) => value.id)).toEqual([
			"opening",
			"first-opening",
			"overall",
			"second-opening",
		]);
		expect(filtered[0]).toBe(dimensions[0]);
		expect(filtered[1]).toBe(dimensions[1]);
		expect(filtered[2]).toBe(dimensions[2]);
		expect(filtered[3]).toBe(dimensions[5]);
		expect(filtered[1]).toMatchObject({
			valueMm: 100.5,
			label: "101",
			reference: "axis",
		});
	});

	it("supports all-off, internal-only and all-on without changing the source array", () => {
		const dimensions = Object.freeze(
			kinds.map((value) => Object.freeze(annotation(value))),
		);
		expect(filterDrawingDimensions(dimensions, allOff)).toEqual([]);
		expect(
			filterDrawingDimensions(dimensions, defaultDrawingDimensionVisibility()),
		).toEqual([annotation("room-clear")]);
		const allOn = {
			wall: true,
			opening: true,
			pier: true,
			overall: true,
			"room-clear": true,
		};
		const filtered = filterDrawingDimensions(dimensions, allOn);
		expect(filtered).toEqual([
			annotation("opening"),
			annotation("overall"),
			annotation("room-clear"),
		]);
		expect(filtered).not.toBe(dimensions);
		expect(filterDrawingDimensions([], allOn)).toEqual([]);
	});

	it("migrates every legacy combination to supported filters, including all-off, without reviving axial dimensions", () => {
		for (let mask = 0; mask < 32; mask += 1) {
			const visibility = Object.freeze({
				wall: Boolean(mask & 1),
				opening: Boolean(mask & 2),
				pier: Boolean(mask & 4),
				overall: Boolean(mask & 8),
				"room-clear": Boolean(mask & 16),
			});
			const serialized = serializeDrawingDimensionPreferences(visibility);
			const supported = { ...visibility, wall: false, pier: false };
			expect(JSON.parse(serialized)).toEqual({
				version: 1,
				visible: supported,
			});
			expect(parseDrawingDimensionPreferences(preference(visibility))).toEqual(
				supported,
			);
			expect(parseDrawingDimensionPreferences(serialized)).toEqual(supported);
		}
	});

	it("serializes only the preference contract even when a structurally valid caller has unrelated fields", () => {
		const supplied = Object.freeze({
			...allOff,
			opening: true,
			unrelated: "not a UI preference",
		});
		const serialized = serializeDrawingDimensionPreferences(supplied);
		expect(JSON.parse(serialized)).toEqual({
			version: 1,
			visible: { ...allOff, opening: true },
		});
		expect(parseDrawingDimensionPreferences(serialized)).toEqual({
			...allOff,
			opening: true,
		});
	});

	it("returns independent values for repeated valid or invalid preference reads", () => {
		const raw = preference(allOff);
		expect(parseDrawingDimensionPreferences(raw)).not.toBe(
			parseDrawingDimensionPreferences(raw),
		);
		expect(parseDrawingDimensionPreferences(null)).not.toBe(
			parseDrawingDimensionPreferences(null),
		);
	});

	it("falls back for missing, corrupt, non-object, incomplete, future or extra-key envelopes", () => {
		const invalid = [
			null,
			"",
			" ",
			"{",
			"null",
			"[]",
			"true",
			"1",
			'"text"',
			"{}",
			JSON.stringify({ visible: allOff }),
			JSON.stringify({ version: 1 }),
			preference(allOff, 0),
			preference(allOff, 2),
			preference(allOff, "1"),
			JSON.stringify({ version: 1, visible: allOff, extra: true }),
			preference(null),
			preference([]),
			preference("all"),
			preference({ ...allOff, unknown: true }),
			preference({ ...allOff, ["__proto__"]: true }),
		];
		for (const raw of invalid)
			expect(parseDrawingDimensionPreferences(raw)).toEqual(internalOnly);
	});

	it("requires every visibility field and rejects non-boolean checkbox values", () => {
		for (const kind of kinds) {
			const incomplete = Object.fromEntries(
				Object.entries(allOff).filter(([key]) => key !== kind),
			);
			expect(parseDrawingDimensionPreferences(preference(incomplete))).toEqual(
				internalOnly,
			);
			for (const invalid of [0, 1, "false", "true", null, [], {}]) {
				expect(
					parseDrawingDimensionPreferences(
						preference({ ...allOff, [kind]: invalid }),
					),
				).toEqual(internalOnly);
			}
		}
	});

	it("accepts the exact 2048-character boundary and rejects one character beyond it", () => {
		const raw = preference({ ...allOff, overall: true });
		for (const size of [2047, 2048]) {
			expect(
				parseDrawingDimensionPreferences(" ".repeat(size - raw.length) + raw),
			).toEqual({ ...allOff, overall: true });
		}
		expect(
			parseDrawingDimensionPreferences(" ".repeat(2049 - raw.length) + raw),
		).toEqual(internalOnly);
	});

	it("loads injected storage in a server environment and survives read exceptions", () => {
		let reads = 0;
		const loaded = loadDrawingDimensionPreferences(() => {
			reads += 1;
			return preference(allOff);
		});
		expect(loaded).toEqual(allOff);
		expect(reads).toBe(1);
		expect(loadDrawingDimensionPreferences(() => null)).toEqual(internalOnly);
		expect(loadDrawingDimensionPreferences(() => "corrupt")).toEqual(
			internalOnly,
		);
		expect(
			loadDrawingDimensionPreferences(() => {
				throw new Error("Storage access denied");
			}),
		).toEqual(internalOnly);
	});

	it("saves only after explicit invocation and reports successful exact persistence", () => {
		const visibility = Object.freeze({ ...allOff, overall: true });
		const writes: string[] = [];
		expect(writes).toEqual([]);
		expect(
			saveDrawingDimensionPreferences(visibility, (raw) => {
				writes.push(raw);
			}),
		).toBe(true);
		expect(writes).toHaveLength(1);
		expect(parseDrawingDimensionPreferences(writes[0])).toEqual(visibility);
		expect(visibility).toEqual({ ...allOff, overall: true });
	});

	it("reports write failure without changing the in-memory all-off choice", () => {
		const visibility = Object.freeze({ ...allOff });
		expect(
			saveDrawingDimensionPreferences(visibility, () => {
				throw new Error("Quota exhausted");
			}),
		).toBe(false);
		expect(visibility).toEqual(allOff);
	});
});
