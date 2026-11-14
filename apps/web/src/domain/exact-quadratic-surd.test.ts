import { describe, expect, it } from "@rstest/core";

import {
	addExactMeasurement,
	compareExactMeasurements,
	exactMeasurement,
	exactMeasurementToNumber,
	exactMeasurementWithSqrt2,
	multiplyExactMeasurements,
	roundExactMeasurementHalfUp,
	subtractExactMeasurements,
} from "./exact-quadratic-surd";

describe("exact quadratic-surd measurements", () => {
	it("keeps rational and sqrt(2) terms without an IEEE-754 projection", () => {
		const area = subtractExactMeasurements(
			exactMeasurement(1_807_500n),
			exactMeasurementWithSqrt2(95_000n),
		);
		const perimeter = addExactMeasurement(
			exactMeasurement(3_700n),
			exactMeasurementWithSqrt2(1_800n),
		);

		expect(area).toEqual({
			denominator: 1n,
			rationalNumerator: 1_807_500n,
			sqrt2Numerator: -95_000n,
		});
		expect(perimeter).toEqual({
			denominator: 1n,
			rationalNumerator: 3_700n,
			sqrt2Numerator: 1_800n,
		});
		expect(exactMeasurementToNumber(perimeter)).toBeCloseTo(
			3_700 + 1_800 * Math.SQRT2,
			12,
		);
	});

	it("multiplies and compares Q(sqrt(2)) values exactly", () => {
		const squared = multiplyExactMeasurements(
			exactMeasurement(1n, 1n),
			exactMeasurement(1n, 1n),
		);

		expect(squared).toEqual({
			denominator: 1n,
			rationalNumerator: 3n,
			sqrt2Numerator: 2n,
		});
		expect(
			compareExactMeasurements(
				exactMeasurement(1n, 1n),
				exactMeasurement(2n),
			),
		).toBe(1);
	});

	it("rounds exact values with the shared half-up rule", () => {
		expect(roundExactMeasurementHalfUp(exactMeasurement(2_999n, 1n, 2n))).toBe(
			1_500n,
		);
		expect(roundExactMeasurementHalfUp(exactMeasurement(5n, 0n, 2n))).toBe(
			3n,
		);
		expect(roundExactMeasurementHalfUp(exactMeasurement(-5n, 0n, 2n))).toBe(
			-3n,
		);
	});
});
