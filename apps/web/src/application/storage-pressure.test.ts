import { describe, expect, it } from "@rstest/core";

import { assessStoragePressure } from "./storage-pressure";

describe("assessStoragePressure", () => {
	it("keeps an unavailable browser estimate explicitly unknown instead of inventing capacity", () => {
		expect(assessStoragePressure({})).toEqual({ kind: "unavailable" });
		expect(assessStoragePressure({ quotaBytes: 0, usageBytes: 0 })).toEqual({
			kind: "unavailable",
		});
		expect(
			assessStoragePressure({ quotaBytes: 1_000, usageBytes: undefined }),
		).toEqual({ kind: "unavailable" });
		expect(
			assessStoragePressure({ quotaBytes: undefined, usageBytes: 0 }),
		).toEqual({ kind: "unavailable" });
		expect(
			assessStoragePressure({ quotaBytes: Number.NaN, usageBytes: 0 }),
		).toEqual({ kind: "unavailable" });
		expect(
			assessStoragePressure({ quotaBytes: 1_000, usageBytes: -1 }),
		).toEqual({ kind: "unavailable" });
		expect(
			assessStoragePressure({ quotaBytes: 1_000, usageBytes: 1.5 }),
		).toEqual({ kind: "unavailable" });
	});

	it("classifies valid local usage before it reaches the warning envelope", () => {
		expect(assessStoragePressure({ quotaBytes: 1000, usageBytes: 0 })).toEqual({
			kind: "healthy",
			quotaBytes: 1000,
			usageBytes: 0,
		});
		expect(
			assessStoragePressure({ quotaBytes: 1000, usageBytes: 699 }),
		).toEqual({
			kind: "healthy",
			quotaBytes: 1000,
			usageBytes: 699,
		});
	});

	it("raises a warning at seventy percent and a critical risk at ninety percent without rounding down", () => {
		expect(
			assessStoragePressure({ quotaBytes: 1000, usageBytes: 700 }),
		).toEqual({
			kind: "warning",
			quotaBytes: 1000,
			usageBytes: 700,
		});
		expect(
			assessStoragePressure({ quotaBytes: 1000, usageBytes: 900 }),
		).toEqual({
			kind: "critical",
			quotaBytes: 1000,
			usageBytes: 900,
		});
	});

	it("fails closed to critical when reported use is already larger than quota", () => {
		expect(
			assessStoragePressure({ quotaBytes: 1000, usageBytes: 1001 }),
		).toEqual({
			kind: "critical",
			quotaBytes: 1000,
			usageBytes: 1001,
		});
	});
});
