/**
 * Ephemeral exact values in Q(√2). They are intended for derived geometry and
 * measurement formatting only; they must never enter durable Project state.
 */
export interface ExactMeasurement {
	readonly denominator: bigint;
	readonly rationalNumerator: bigint;
	readonly sqrt2Numerator: bigint;
}

export type MeasurementValue = ExactMeasurement | number;

export function isExactMeasurement(value: MeasurementValue): value is ExactMeasurement {
	return typeof value !== "number";
}

export function exactMeasurement(
	rationalNumerator: bigint,
	sqrt2Numerator = 0n,
	denominator = 1n,
): ExactMeasurement {
	if (denominator === 0n) {
		throw new Error("An exact measurement denominator must not be zero.");
	}
	const sign = denominator < 0n ? -1n : 1n;
	const rational = rationalNumerator * sign;
	const sqrt2 = sqrt2Numerator * sign;
	const positiveDenominator = denominator * sign;
	const divisor = greatestCommonDivisor(
		greatestCommonDivisor(absolute(rational), absolute(sqrt2)),
		positiveDenominator,
	);
	return {
		denominator: positiveDenominator / divisor,
		rationalNumerator: rational / divisor,
		sqrt2Numerator: sqrt2 / divisor,
	};
}

export function exactMeasurementWithSqrt2(
	sqrt2Numerator: bigint,
): ExactMeasurement {
	return exactMeasurement(0n, sqrt2Numerator);
}

export function addExactMeasurement(
	first: ExactMeasurement,
	second: ExactMeasurement,
): ExactMeasurement {
	return exactMeasurement(
		first.rationalNumerator * second.denominator +
			second.rationalNumerator * first.denominator,
		first.sqrt2Numerator * second.denominator +
			second.sqrt2Numerator * first.denominator,
		first.denominator * second.denominator,
	);
}

export function subtractExactMeasurements(
	first: ExactMeasurement,
	second: ExactMeasurement,
): ExactMeasurement {
	return exactMeasurement(
		first.rationalNumerator * second.denominator -
			second.rationalNumerator * first.denominator,
		first.sqrt2Numerator * second.denominator -
			second.sqrt2Numerator * first.denominator,
		first.denominator * second.denominator,
	);
}

export function multiplyExactMeasurements(
	first: ExactMeasurement,
	second: ExactMeasurement,
): ExactMeasurement {
	return exactMeasurement(
		first.rationalNumerator * second.rationalNumerator +
			2n * first.sqrt2Numerator * second.sqrt2Numerator,
		first.rationalNumerator * second.sqrt2Numerator +
			first.sqrt2Numerator * second.rationalNumerator,
		first.denominator * second.denominator,
	);
}

export function multiplyExactMeasurementByInteger(
	value: ExactMeasurement,
	factor: bigint,
): ExactMeasurement {
	return exactMeasurement(
		value.rationalNumerator * factor,
		value.sqrt2Numerator * factor,
		value.denominator,
	);
}

export function divideExactMeasurementByInteger(
	value: ExactMeasurement,
	divisor: bigint,
): ExactMeasurement {
	return exactMeasurement(
		value.rationalNumerator,
		value.sqrt2Numerator,
		value.denominator * divisor,
	);
}

export function negateExactMeasurement(value: ExactMeasurement): ExactMeasurement {
	return exactMeasurement(
		-value.rationalNumerator,
		-value.sqrt2Numerator,
		value.denominator,
	);
}

export function absoluteExactMeasurement(value: ExactMeasurement): ExactMeasurement {
	return compareExactMeasurements(value, exactMeasurement(0n)) < 0
		? negateExactMeasurement(value)
		: value;
}

export function exactMeasurementWithSqrt2Factor(
	value: ExactMeasurement,
): ExactMeasurement {
	return exactMeasurement(
		2n * value.sqrt2Numerator,
		value.rationalNumerator,
		value.denominator,
	);
}

export function compareExactMeasurements(
	first: ExactMeasurement,
	second: ExactMeasurement,
): -1 | 0 | 1 {
	const difference = subtractExactMeasurements(first, second);
	return signOfQuadraticSurd(
		difference.rationalNumerator,
		difference.sqrt2Numerator,
	);
}

export function exactMeasurementToNumber(value: ExactMeasurement): number {
	return (
		Number(value.rationalNumerator) / Number(value.denominator) +
		(Number(value.sqrt2Numerator) / Number(value.denominator)) * Math.SQRT2
	);
}

/** Rounds an exact value to the nearest integer with ties away from zero. */
export function roundExactMeasurementHalfUp(value: ExactMeasurement): bigint {
	const zero = exactMeasurement(0n);
	if (compareExactMeasurements(value, zero) < 0) {
		return -roundExactMeasurementHalfUp(negateExactMeasurement(value));
	}
	const floor = floorExactMeasurement(value);
	const remainder = subtractExactMeasurements(value, exactMeasurement(floor));
	return compareExactMeasurements(
		multiplyExactMeasurementByInteger(remainder, 2n),
		exactMeasurement(1n),
	) >= 0
		? floor + 1n
		: floor;
}

function floorExactMeasurement(value: ExactMeasurement): bigint {
	let lower = 0n;
	let upper =
		(absolute(value.rationalNumerator) + 2n * absolute(value.sqrt2Numerator)) /
			value.denominator +
		1n;
	while (lower + 1n < upper) {
		const candidate = (lower + upper) / 2n;
		if (compareExactMeasurements(value, exactMeasurement(candidate)) >= 0) {
			lower = candidate;
		} else {
			upper = candidate;
		}
	}
	return lower;
}

function signOfQuadraticSurd(
	rationalNumerator: bigint,
	sqrt2Numerator: bigint,
): -1 | 0 | 1 {
	if (rationalNumerator === 0n && sqrt2Numerator === 0n) return 0;
	if (rationalNumerator >= 0n && sqrt2Numerator >= 0n) return 1;
	if (rationalNumerator <= 0n && sqrt2Numerator <= 0n) return -1;
	const rationalSquared = rationalNumerator * rationalNumerator;
	const sqrtSquared = 2n * sqrt2Numerator * sqrt2Numerator;
	if (rationalNumerator > 0n) {
		return rationalSquared > sqrtSquared ? 1 : -1;
	}
	return sqrtSquared > rationalSquared ? 1 : -1;
}

function greatestCommonDivisor(first: bigint, second: bigint): bigint {
	let left = first;
	let right = second;
	while (right !== 0n) {
		const remainder = left % right;
		left = right;
		right = remainder;
	}
	return left === 0n ? 1n : left;
}

function absolute(value: bigint): bigint {
	return value < 0n ? -value : value;
}
