import { describe, expect, it } from "@rstest/core";

import { exactMeasurement } from "./exact-quadratic-surd";
import { formatAreaMm2, formatLengthMm } from "./measurement-format";

describe("MeasurementFormatPolicy V1", () => {
	it("formats lengths as exact whole millimetres", () => {
		expect(formatLengthMm(4000)).toBe("4000 мм");
		expect(formatLengthMm(2999.49)).toBe("2999 мм");
		expect(formatLengthMm(2999.5)).toBe("3000 мм");
		expect(formatLengthMm(-2999.5)).toBe("-3000 мм");
	});

	it("formats an exact diagonal length only at the presentation boundary", () => {
		expect(formatLengthMm(exactMeasurement(3_700n, 1_800n))).toBe("6246 мм");
	});

	it("uses decimal half-up rounding to two square-metre places without float drift", () => {
		expect(formatAreaMm2(12_345_000)).toBe("12,35 м²");
		expect(formatAreaMm2(12_345_001)).toBe("12,35 м²");
		expect(formatAreaMm2(12_344_999)).toBe("12,34 м²");
		expect(formatAreaMm2(12_300_000)).toBe("12,30 м²");
		expect(formatAreaMm2(11_305_150.5)).toBe("11,31 м²");
	});

	it("formats an exact diagonal area only at the presentation boundary", () => {
		expect(
		formatAreaMm2(exactMeasurement(1_807_500n, -95_000n)),
	).toBe("1,67 м²");
	});
});
