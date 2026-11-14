export interface WallGesturePoint {
	readonly xMm: number;
	readonly zMm: number;
}

interface WallGestureAxis {
	readonly startMm: WallGesturePoint;
	readonly endMm: WallGesturePoint;
}

/** The original centre stays under the original grab, including off-grid centres. */
export function openingDragOffsetFor(
	input: WallGestureAxis & {
		readonly pointerStartMm: WallGesturePoint;
		readonly pointerCurrentMm: WallGesturePoint;
		readonly openingOffsetMm: number;
	},
): number | undefined {
	const axis = wallAxis(input);
	if (
		!axis ||
		!Number.isSafeInteger(input.openingOffsetMm) ||
		input.openingOffsetMm < 0 ||
		!finitePoint(input.pointerStartMm) ||
		!finitePoint(input.pointerCurrentMm)
	)
		return undefined;
	const directedDelta =
		((input.pointerCurrentMm.xMm - input.pointerStartMm.xMm) * axis.dx +
			(input.pointerCurrentMm.zMm - input.pointerStartMm.zMm) * axis.dz) /
		Math.hypot(axis.dx, axis.dz);
	if (!Number.isFinite(directedDelta)) return undefined;
	const deltaMm =
		Math.sign(directedDelta) *
		Math.floor(Math.abs(directedDelta) / 100 + 0.5) *
		100;
	const offsetMm = input.openingOffsetMm + deltaMm;
	return Number.isSafeInteger(offsetMm) ? offsetMm : undefined;
}

/** A split stays on its original cardinal/45° axis and never invents an endpoint. */
export function wallSplitPointForPointer(
	input: WallGestureAxis & {
		readonly pointerMm: WallGesturePoint;
	},
): WallGesturePoint | undefined {
	const axis = wallAxis(input);
	if (!axis || !finitePoint(input.pointerMm)) return undefined;
	const sx = Math.sign(axis.dx),
		sz = Math.sign(axis.dz);
	const projectedStep =
		((input.pointerMm.xMm - input.startMm.xMm) * sx +
			(input.pointerMm.zMm - input.startMm.zMm) * sz) /
		(sx * sx + sz * sz);
	const stepMm = Math.floor(projectedStep / 100 + 0.5) * 100;
	if (
		!Number.isSafeInteger(stepMm) ||
		stepMm <= 0 ||
		stepMm >= Math.max(Math.abs(axis.dx), Math.abs(axis.dz))
	)
		return undefined;
	const point = {
		xMm: input.startMm.xMm + sx * stepMm,
		zMm: input.startMm.zMm + sz * stepMm,
	};
	return Number.isSafeInteger(point.xMm) && Number.isSafeInteger(point.zMm)
		? point
		: undefined;
}

function finitePoint(point: WallGesturePoint): boolean {
	return Number.isFinite(point.xMm) && Number.isFinite(point.zMm);
}

function wallAxis(
	input: WallGestureAxis,
): { readonly dx: number; readonly dz: number } | undefined {
	if (
		![
			input.startMm.xMm,
			input.startMm.zMm,
			input.endMm.xMm,
			input.endMm.zMm,
		].every(Number.isSafeInteger)
	)
		return undefined;
	const dx = input.endMm.xMm - input.startMm.xMm,
		dz = input.endMm.zMm - input.startMm.zMm;
	if (
		!Number.isSafeInteger(dx) ||
		!Number.isSafeInteger(dz) ||
		(dx === 0 && dz === 0) ||
		(dx !== 0 && dz !== 0 && Math.abs(dx) !== Math.abs(dz))
	)
		return undefined;
	return { dx, dz };
}
