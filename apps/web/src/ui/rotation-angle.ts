const FULL_TURN_MILLI_DEGREES = 360_000;
const FULL_TURN_RADIANS = Math.PI * 2;

/** Converts a user-entered CAD angle to the canonical half-open yaw interval. */
export function yawRadiansFromDegrees(raw: string): number | undefined {
	if (raw.trim() === "") return undefined;
	const degrees = Number(raw);
	if (!Number.isFinite(degrees)) return undefined;
	const normalized = ((degrees % 360) + 360) % 360;
	const yawRadians = (normalized * Math.PI) / 180;
	return yawRadians === FULL_TURN_RADIANS ? 0 : yawRadians;
}

export function preciseYawRadiansFromDegrees(raw: string): number | undefined {
	const angle = /^([+-]?)([0-9]+)(?:[.,]([0-9]{1,3}))?$/.exec(raw.trim());
	if (!angle) return undefined;
	const degrees = Number(angle[2]);
	if (!Number.isSafeInteger(degrees)) return undefined;
	const fraction = Number((angle[3] ?? "").padEnd(3, "0"));
	const milliDegrees = ((degrees % 360) * 1000 + fraction) * (angle[1] === "-" ? -1 : 1);
	const normalized = (milliDegrees + FULL_TURN_MILLI_DEGREES) % FULL_TURN_MILLI_DEGREES;
	return (normalized * Math.PI) / 180_000;
}

/** Formats a durable yaw without introducing display-only 45° quantisation. */
export function degreesForYawRadians(yawRadians: number | undefined): string {
	if (yawRadians === undefined || !Number.isFinite(yawRadians)) {
		return "0";
	}
	const normalized = normalizeYawRadians(yawRadians);
	const milliDegrees = Math.round(normalized * 180_000 / Math.PI) % FULL_TURN_MILLI_DEGREES;
	return String(milliDegrees / 1000);
}

export function normalizeYawRadians(yawRadians: number): number {
	return ((yawRadians % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;
}
