import type { DerivedOrthogonalRoomFace } from "../domain/derived-orthogonal-plan-faces";
import {
	compareExactMeasurements,
	exactMeasurement,
	isExactMeasurement,
	type MeasurementValue,
} from "../domain/exact-quadratic-surd";

interface RoomMeasurementBase {
	readonly areaMm2: MeasurementValue;
	readonly centerXMm: number;
	readonly centerZMm: number;
	readonly heightMm: number;
	readonly perimeterMm: MeasurementValue;
}

export type RoomMeasurement =
	| (RoomMeasurementBase & {
			readonly depthMm: number;
			readonly kind: "rectangular";
			readonly widthMm: number;
	  })
	| (RoomMeasurementBase & { readonly kind: "polygonal" });

/**
 * Presentation-only measurements originate from the usable floor projection.
 * A non-rectangular decomposition intentionally gets no invented envelope.
 */
export function roomMeasurementFor(
	room: DerivedOrthogonalRoomFace,
): RoomMeasurement | undefined {
	const tile = room.usableFloorTilesMm[0];
	if (tile && room.usableFloorTilesMm.length === 1) {
		const widthMm = tile.maxXmm - tile.minXmm;
		const depthMm = tile.maxZmm - tile.minZmm;
		const geometricAreaMm2 = widthMm * depthMm;
		const { usableFloorAreaMm2: areaMm2, usableFloorPerimeterMm: perimeterMm } =
			room;
		if (
			!Number.isFinite(widthMm) ||
			!Number.isFinite(depthMm) ||
			!Number.isFinite(geometricAreaMm2) ||
			!isPositiveMeasurement(areaMm2) ||
			!isPositiveMeasurement(perimeterMm) ||
			Math.abs(widthMm) > Number.MAX_SAFE_INTEGER ||
			Math.abs(depthMm) > Number.MAX_SAFE_INTEGER ||
			Math.abs(geometricAreaMm2) > Number.MAX_SAFE_INTEGER ||
			widthMm <= 0 ||
			depthMm <= 0
		) {
			return undefined;
		}
		return {
			areaMm2,
			centerXMm: tile.minXmm + widthMm / 2,
			centerZMm: tile.minZmm + depthMm / 2,
			depthMm,
			heightMm: room.heightMm,
			kind: "rectangular",
			perimeterMm,
			widthMm,
		};
	}

	const polygon = room.usableFloorPolygonMm;
	if (!polygon || polygon.length < 3) return undefined;
	let signedTwiceAreaMm2 = 0;
	let weightedCenterX = 0;
	let weightedCenterZ = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const first = polygon[index];
		const second = polygon[(index + 1) % polygon.length];
		if (!first || !second) return undefined;
		const cross = first.xMm * second.zMm - second.xMm * first.zMm;
		signedTwiceAreaMm2 += cross;
		weightedCenterX += (first.xMm + second.xMm) * cross;
		weightedCenterZ += (first.zMm + second.zMm) * cross;
	}
	const { usableFloorAreaMm2: areaMm2, usableFloorPerimeterMm: perimeterMm } =
		room;
	if (
		!isPositiveMeasurement(areaMm2) ||
		!isPositiveMeasurement(perimeterMm) ||
		!Number.isFinite(weightedCenterX) ||
		!Number.isFinite(weightedCenterZ) ||
		signedTwiceAreaMm2 === 0
	) {
		return undefined;
	}
	return {
		areaMm2,
		centerXMm: weightedCenterX / (3 * signedTwiceAreaMm2),
		centerZMm: weightedCenterZ / (3 * signedTwiceAreaMm2),
		heightMm: room.heightMm,
		kind: "polygonal",
		perimeterMm,
	};
}

function isPositiveMeasurement(value: MeasurementValue): boolean {
	return isExactMeasurement(value)
		? compareExactMeasurements(value, exactMeasurement(0n)) > 0
		: Number.isFinite(value) &&
			Math.abs(value) <= Number.MAX_SAFE_INTEGER &&
			value > 0;
}
