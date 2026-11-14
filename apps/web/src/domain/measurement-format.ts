import {
	divideExactMeasurementByInteger,
	isExactMeasurement,
	roundExactMeasurementHalfUp,
	type MeasurementValue,
} from "./exact-quadratic-surd";

export function formatLengthMm(valueMm: MeasurementValue): string {
	const roundedMm = isExactMeasurement(valueMm)
		? roundExactMeasurementHalfUp(valueMm).toString()
		: valueMm < 0
			? -Math.round(-valueMm)
			: Math.round(valueMm);
	return `${roundedMm} мм`;
}

export function formatAreaMm2(valueMm2: MeasurementValue): string {
	const hundredthsSquareMetres = isExactMeasurement(valueMm2)
		? roundExactMeasurementHalfUp(
				divideExactMeasurementByInteger(valueMm2, 10_000n),
			)
		: BigInt(Math.round(valueMm2 / 10_000));
	const whole = hundredthsSquareMetres / 100n;
	const fraction = (hundredthsSquareMetres % 100n)
		.toString()
		.padStart(2, "0");
	return `${whole},${fraction} м²`;
}
