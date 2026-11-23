import { describe, expect, it } from "@rstest/core";

import { degreesForYawRadians, preciseYawRadiansFromDegrees, yawRadiansFromDegrees } from "./rotation-angle";

describe("rotation angle input", () => {
	it("converts exact CAD angles to the durable continuous yaw", () => {
		expect(yawRadiansFromDegrees("45")).toBeCloseTo(Math.PI / 4);
		expect(yawRadiansFromDegrees("90")).toBeCloseTo(Math.PI / 2);
		expect(yawRadiansFromDegrees("360")).toBe(0);
		expect(yawRadiansFromDegrees("-90")).toBeCloseTo((Math.PI * 3) / 2);
	});

	it("rejects non-finite angle text and reports a stable degree value", () => {
		expect(yawRadiansFromDegrees("")).toBeUndefined();
		expect(yawRadiansFromDegrees("   ")).toBeUndefined();
		expect(yawRadiansFromDegrees("поворот")).toBeUndefined();
		expect(degreesForYawRadians(Math.PI / 2)).toBe("90");
		expect(degreesForYawRadians((Math.PI * 7) / 4)).toBe("315");
		expect(degreesForYawRadians(Infinity)).toBe("0");
		expect(degreesForYawRadians(undefined)).toBe("0");
	});

	it("accepts signed dot or comma decimals at thousandth-degree precision", () => {
		expect(preciseYawRadiansFromDegrees("-10,125")).toBeCloseTo(349.875 * Math.PI / 180, 9);
		expect(preciseYawRadiansFromDegrees("+37,5")).toBeCloseTo(37.5 * Math.PI / 180, 9);
		expect(preciseYawRadiansFromDegrees("360")).toBe(0);
		expect(preciseYawRadiansFromDegrees("9007199254740992")).toBeUndefined();
		expect(degreesForYawRadians(preciseYawRadiansFromDegrees(" 720.001 "))).toBe("0.001");
		expect(degreesForYawRadians(359.9999 * Math.PI / 180)).toBe("0");
		for (const text of ["-", "0x2d", "1e2", "37,5.0", "37,5001", "37."]) {
			expect(preciseYawRadiansFromDegrees(text)).toBeUndefined();
		}
	});
});
