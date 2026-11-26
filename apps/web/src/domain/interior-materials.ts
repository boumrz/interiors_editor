import type { FloorFinishId, WallFinishId } from "./project";

export const floorFinishColors = {
	"light-oak": "#cfb28a",
	"matte-floor-tile": "#ddd9d0",
	"plain-floor": "#b8b0a4",
} as const satisfies Record<FloorFinishId, string>;

export const wallFinishColors = {
	"warm-white-paint": "#eae2d5",
	"sand-paint": "#c7ad8f",
	"muted-green-paint": "#879680",
	"neutral-wall-tile": "#ddd9d0",
} as const satisfies Record<WallFinishId, string>;
