/** A durable AssetInstance can attach only to a floor or a wall surface. */
export type AssetAnchorClass = "floor" | "wall";

/** Floor coordinates live in the one canonical plan frame; `roomId` is the host address. */
export type FloorPlacement = {
	readonly anchorClass: "floor";
	readonly elevationMm: 0;
	readonly roomId: string;
	readonly xMm: number;
	readonly zMm: number;
};

/**
 * A Wall placement never serializes a renderer transform. Its offset is
 * measured from the canonical wall start; `side` keeps the semantic surface
 * stable when a compatible topology command rehosts the item.
 */
export type WallPlacement = {
	readonly anchorClass: "wall";
	readonly elevationMm: number;
	readonly offsetMm: number;
	readonly side: "left" | "right";
	readonly wallSegmentId: string;
};

export type StableAssetPlacement =
	| FloorPlacement
	| WallPlacement;

export type AssetPlacementHostKind = "room" | "wall";

export function assetPlacementHostKind(
	placement: StableAssetPlacement,
): AssetPlacementHostKind {
	return placement.anchorClass === "wall" ? "wall" : "room";
}

/**
 * Trust-boundary guard for the new discriminated placement payload. Geometry
 * checks against a particular Room or Wall deliberately remain in the command
 * that owns that topology; this guard accepts no world-space renderer fields.
 */
export function isStableAssetPlacement(
	value: unknown,
): value is StableAssetPlacement {
	if (!isRecord(value) || typeof value.anchorClass !== "string") return false;

	switch (value.anchorClass) {
		case "floor":
			return (
				hasExactKeys(value, [
					"anchorClass",
					"elevationMm",
					"roomId",
					"xMm",
					"zMm",
				]) &&
				value.elevationMm === 0 &&
				isHostId(value.roomId) &&
				isPlanCoordinate(value.xMm) &&
				isPlanCoordinate(value.zMm)
			);
		case "wall":
			return (
				hasExactKeys(value, [
					"anchorClass",
					"elevationMm",
					"offsetMm",
					"side",
					"wallSegmentId",
				]) &&
				isHostId(value.wallSegmentId) &&
				isElevation(value.elevationMm) &&
				isNonNegativeMm(value.offsetMm) &&
				(value.side === "left" || value.side === "right")
			);
		default:
			return false;
	}
}

function hasExactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value).sort();
	return (
		keys.length === expected.length &&
		keys.every((key, index) => key === [...expected].sort()[index])
	);
}

function isElevation(value: unknown): value is number {
	return isNonNegativeMm(value) && value <= 10_000;
}

function isHostId(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeMm(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPlanCoordinate(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isSafeInteger(value) &&
		value >= -100_000 &&
		value <= 100_000
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
