import { describe, expect, it } from "@rstest/core";
import {
	openingDragOffsetFor,
	wallSplitPointForPointer,
} from "./opening-gesture";

describe("wall-local opening and split gestures", () => {
	it("preserves the grab offset and snaps only a signed relative opening delta", () => {
		const input = {
			startMm: { xMm: 0, zMm: 0 },
			endMm: { xMm: 4000, zMm: 0 },
			pointerStartMm: { xMm: 950, zMm: 30 },
			openingOffsetMm: 731,
		};
		for (const [delta, expected] of [
			[0, 731],
			[49, 731],
			[50, 831],
			[149, 831],
			[150, 931],
			[-49, 731],
			[-50, 631],
			[-149, 631],
			[-150, 531],
		] as const) {
			expect(
				openingDragOffsetFor({
					...input,
					pointerCurrentMm: { xMm: 950 + delta, zMm: 900 },
				}),
			).toBe(expected);
		}
		expect(
			openingDragOffsetFor({
				...input,
				pointerCurrentMm: { xMm: -250, zMm: 30 },
			}),
		).toBe(-469);
		expect(
			openingDragOffsetFor({
				...input,
				openingOffsetMm: 0,
				pointerCurrentMm: { xMm: 1050, zMm: 30 },
			}),
		).toBe(100);
	});

	it("projects a reversed vertical wall in its own canonical direction", () => {
		expect(
			openingDragOffsetFor({
				startMm: { xMm: 17, zMm: 2029 },
				endMm: { xMm: 17, zMm: 29 },
				pointerStartMm: { xMm: 17, zMm: 1500 },
				pointerCurrentMm: { xMm: 900, zMm: 1270 },
				openingOffsetMm: 800,
			}),
		).toBe(1000);
	});

	it("measures opening offsets along the physical diagonal in all four quadrants", () => {
		for (const sx of [-1, 1])
			for (const sz of [-1, 1]) {
				const startMm = { xMm: 17, zMm: 29 };
				const endMm = { xMm: 17 + sx * 2000, zMm: 29 + sz * 2000 };
				const pointerStartMm = { xMm: 17 + sx * 500, zMm: 29 + sz * 500 };
				expect(
					openingDragOffsetFor({
						startMm,
						endMm,
						pointerStartMm,
						pointerCurrentMm: {
							xMm: pointerStartMm.xMm + sx * 100,
							zMm: pointerStartMm.zMm + sz * 100,
						},
						openingOffsetMm: 731,
					}),
				).toBe(831);
				expect(
					openingDragOffsetFor({
						startMm,
						endMm,
						pointerStartMm,
						pointerCurrentMm: {
							xMm: pointerStartMm.xMm - sz * 100,
							zMm: pointerStartMm.zMm + sx * 100,
						},
						openingOffsetMm: 731,
					}),
				).toBe(731);
			}
	});

	it("keeps split points on the origin-relative 100mm lattice for cardinal and reversed walls", () => {
		expect(
			wallSplitPointForPointer({
				startMm: { xMm: 17, zMm: 29 },
				endMm: { xMm: 2017, zMm: 29 },
				pointerMm: { xMm: 266, zMm: 900 },
			}),
		).toEqual({ xMm: 217, zMm: 29 });
		expect(
			wallSplitPointForPointer({
				startMm: { xMm: 17, zMm: 2029 },
				endMm: { xMm: 17, zMm: 29 },
				pointerMm: { xMm: 900, zMm: 1779 },
			}),
		).toEqual({ xMm: 17, zMm: 1729 });
	});

	it("quantizes both signed diagonal components together rather than rounding two coordinates independently", () => {
		for (const sx of [-1, 1])
			for (const sz of [-1, 1]) {
				expect(
					wallSplitPointForPointer({
						startMm: { xMm: 17, zMm: 29 },
						endMm: { xMm: 17 + sx * 2000, zMm: 29 + sz * 2000 },
						pointerMm: { xMm: 17 + sx * 230, zMm: 29 + sz * 270 },
					}),
				).toEqual({ xMm: 17 + sx * 300, zMm: 29 + sz * 300 });
			}
	});

	it("rejects endpoint splits, behind-origin candidates and non-finite projections", () => {
		const startMm = { xMm: 17, zMm: 29 },
			endMm = { xMm: 2017, zMm: 29 };
		for (const xMm of [
			17,
			40,
			-100,
			2017,
			2100,
			Number.NaN,
			Number.POSITIVE_INFINITY,
		]) {
			expect(
				wallSplitPointForPointer({
					startMm,
					endMm,
					pointerMm: { xMm, zMm: 29 },
				}),
			).toBeUndefined();
		}
	});

	it("fails closed for unsupported/zero/noninteger hosts and invalid opening state", () => {
		const startMm = { xMm: 0, zMm: 0 };
		for (const endMm of [
			{ xMm: 0, zMm: 0 },
			{ xMm: 200, zMm: 100 },
			{ xMm: 100.5, zMm: 0 },
			{ xMm: Number.NaN, zMm: 100 },
			{ xMm: Number.MAX_SAFE_INTEGER + 1, zMm: 0 },
		]) {
			expect(
				wallSplitPointForPointer({
					startMm,
					endMm,
					pointerMm: { xMm: 100, zMm: 0 },
				}),
			).toBeUndefined();
			expect(
				openingDragOffsetFor({
					startMm,
					endMm,
					pointerStartMm: startMm,
					pointerCurrentMm: startMm,
					openingOffsetMm: 900,
				}),
			).toBeUndefined();
		}
		for (const openingOffsetMm of [
			-1,
			0.5,
			Number.NaN,
			Number.MAX_SAFE_INTEGER,
		]) {
			expect(
				openingDragOffsetFor({
					startMm,
					endMm: { xMm: 2000, zMm: 0 },
					pointerStartMm: startMm,
					pointerCurrentMm: { xMm: 100, zMm: 0 },
					openingOffsetMm,
				}),
			).toBeUndefined();
		}
		expect(
			openingDragOffsetFor({
				startMm,
				endMm: { xMm: 2000, zMm: 0 },
				pointerStartMm: { xMm: Number.NaN, zMm: 0 },
				pointerCurrentMm: startMm,
				openingOffsetMm: 900,
			}),
		).toBeUndefined();
		for (const [first, last] of [
			[
				{ xMm: 0.5, zMm: 0.5 },
				{ xMm: 2000.5, zMm: 0.5 },
			],
			[
				{ xMm: 0.5, zMm: 0 },
				{ xMm: 2000.5, zMm: 0 },
			],
			[
				{ xMm: -Number.MAX_SAFE_INTEGER, zMm: 0 },
				{ xMm: Number.MAX_SAFE_INTEGER, zMm: 0 },
			],
			[
				{ xMm: 0, zMm: -Number.MAX_SAFE_INTEGER },
				{ xMm: 0, zMm: Number.MAX_SAFE_INTEGER },
			],
		] as const) {
			expect(
				openingDragOffsetFor({
					startMm: first,
					endMm: last,
					pointerStartMm: { xMm: 0, zMm: 0 },
					pointerCurrentMm: { xMm: 100, zMm: 100 },
					openingOffsetMm: 900,
				}),
			).toBeUndefined();
		}
	});
});
