import type { SurfaceFinish, WallSegment } from "./project";

export function sameSurfaceFinish(left: SurfaceFinish | undefined, right: SurfaceFinish | undefined): boolean {
	return left?.presetId === right?.presetId && left?.version === right?.version;
}

export function wallSurfaceMetadata(
	wall: Pick<WallSegment, "sideFinishes" | "profile">,
	reverse = false,
): Pick<WallSegment, "sideFinishes" | "profile"> {
	const left = reverse ? wall.sideFinishes?.right : wall.sideFinishes?.left;
	const right = reverse ? wall.sideFinishes?.left : wall.sideFinishes?.right;
	return {
		...(wall.profile === undefined ? {} : { profile: wall.profile }),
		...(left === undefined && right === undefined ? {} : { sideFinishes: {
			...(left === undefined ? {} : { left }),
			...(right === undefined ? {} : { right }),
		} }),
	};
}

export function sameWallSurfaceMetadata(first: WallSegment, second: WallSegment, reverseSecond: boolean): boolean {
	const compared = wallSurfaceMetadata(second, reverseSecond);
	return first.profile === compared.profile &&
		sameSurfaceFinish(first.sideFinishes?.left, compared.sideFinishes?.left) &&
		sameSurfaceFinish(first.sideFinishes?.right, compared.sideFinishes?.right);
}
