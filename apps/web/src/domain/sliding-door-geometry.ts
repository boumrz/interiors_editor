import type { FloorItemFootprint } from "./parametric-item";
import type { DoorWallOpening, WallSegment } from "./project";
import { SLIDING_WALL_CLEARANCE_MM, wallOpeningRequiredIntervalMm } from "./wall-opening";

export const SLIDING_LEAF_DEPTH_MM = 38;
export const SLIDING_HANDLE_DEPTH_MM = 24;

interface PointMm {
	readonly xMm: number;
	readonly zMm: number;
}

export function orientedWallFootprint(start: PointMm, end: PointMm, thicknessMm: number): FloorItemFootprint {
	const dx = end.xMm - start.xMm;
	const dz = end.zMm - start.zMm;
	return {
		continuousYaw: true,
		xMm: (start.xMm + end.xMm) / 2,
		zMm: (start.zMm + end.zMm) / 2,
		widthMm: Math.hypot(dx, dz),
		depthMm: thicknessMm,
		yawRadians: -Math.atan2(dz, dx),
	};
}

export function slidingDoorSweepFor(
	opening: DoorWallOpening,
	wall: Pick<WallSegment, "thicknessMm">,
	start: PointMm,
	end: PointMm,
) {
	if (opening.variant !== "sliding") return undefined;
	const length = Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm);
	if (length === 0) return undefined;
	const dx = (end.xMm - start.xMm) / length;
	const dz = (end.zMm - start.zMm) / length;
	const side = opening.slideSide === "left" ? 1 : -1;
	const { startMm: alongStartMm, endMm: alongEndMm } = wallOpeningRequiredIntervalMm(opening);
	const nearestMm = wall.thicknessMm / 2 + SLIDING_WALL_CLEARANCE_MM;
	const extentMm = SLIDING_LEAF_DEPTH_MM + SLIDING_HANDLE_DEPTH_MM;
	const normalCenterMm = side * (nearestMm + extentMm / 2);
	const alongCenterMm = (alongStartMm + alongEndMm) / 2;
	const footprint: FloorItemFootprint = {
		continuousYaw: true,
		widthMm: alongEndMm - alongStartMm,
		depthMm: extentMm,
		xMm: start.xMm + alongCenterMm * dx - normalCenterMm * dz,
		zMm: start.zMm + alongCenterMm * dz + normalCenterMm * dx,
		yawRadians: -Math.atan2(dz, dx),
	};
	return {
		alongStartMm,
		alongEndMm,
		normalStartMm: normalCenterMm - extentMm / 2,
		normalEndMm: normalCenterMm + extentMm / 2,
		leafNormalMm: side * (nearestMm + SLIDING_LEAF_DEPTH_MM / 2),
		bottomMm: opening.sillMm,
		topMm: opening.sillMm + opening.heightMm,
		footprint,
	};
}
