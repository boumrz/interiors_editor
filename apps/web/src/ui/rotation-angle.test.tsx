import { describe, expect, it } from "@rstest/core";

import { degreesForYawRadians, yawRadiansFromDegrees } from "./rotation-angle";

describe("rotation angle input", () => {
	it("converts exact CAD angles to the durable continuous yaw", () => {
		expect(yawRadiansFromDegrees("45")).toBeCloseTo(Math.PI / 4);
		expect(yawRadiansFromDegrees("90")).toBeCloseTo(Math.PI / 2);
		expect(yawRadiansFromDegrees("360")).toBe(0);
		expect(yawRadiansFromDegrees("-90")).toBeCloseTo((Math.PI * 3) / 2);
	});

	it("rejects non-finite angle text and reports a stable degree value", () => {
		expect(yawRadiansFromDegrees("")).toBeUndefined();
		expect(yawRadiansFromDegrees("поворот")).toBeUndefined();
		expect(degreesForYawRadians(Math.PI / 2)).toBe("90");
		expect(degreesForYawRadians((Math.PI * 7) / 4)).toBe("315");
	});
});
