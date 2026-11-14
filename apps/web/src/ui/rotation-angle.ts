const FULL_TURN_DEGREES = 360;
const FULL_TURN_RADIANS = Math.PI * 2;

/** Converts a user-entered CAD angle to the canonical half-open yaw interval. */
export function yawRadiansFromDegrees(raw: string): number | undefined {
	if (raw.trim() === "") {
		return undefined;
	}
	const degrees = Number(raw);
	if (!Number.isFinite(degrees)) {
		return undefined;
	}
	const normalizedDegrees =
		((degrees % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) %
		FULL_TURN_DEGREES;
	const yawRadians = (normalizedDegrees * Math.PI) / 180;
	return yawRadians === FULL_TURN_RADIANS ? 0 : yawRadians;
}

/** Formats a durable yaw without introducing display-only 45° quantisation. */
export function degreesForYawRadians(yawRadians: number | undefined): string {
	if (yawRadians === undefined || !Number.isFinite(yawRadians)) {
		return "0";
	}
	const normalizedDegrees =
		(((yawRadians * 180) / Math.PI) % FULL_TURN_DEGREES +
			FULL_TURN_DEGREES) %
		FULL_TURN_DEGREES;
	return String(Math.round(normalizedDegrees * 1000) / 1000);
}
