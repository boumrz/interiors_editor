import type { CustomWallFinish, FloorFinishId, WallFinish, WallFinishId } from "./project";

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

export function isCanonicalWallColor(value: unknown): value is string {
	return typeof value === "string" && value.length === 7 && /^#[0-9a-f]{6}$/.test(value);
}

export function parseCustomWallFinish(value: string): CustomWallFinish | undefined {
	const text = value.trim().toLowerCase();
	const color = text.startsWith("#") ? text : `#${text}`;
	return isCanonicalWallColor(color) ? { color, version: 2 } : undefined;
}

export function wallFinishColor(finish: WallFinish): string {
	return finish.version === 2 ? finish.color : wallFinishColors[finish.presetId];
}

export function isWallFinish(value: unknown): value is WallFinish {
	if (typeof value !== "object" || value === null || Reflect.ownKeys(value).length !== 2) return false;
	const version = Object.getOwnPropertyDescriptor(value, "version");
	if (!version?.enumerable) return false;
	const field = Object.getOwnPropertyDescriptor(value, version.value === 2 ? "color" : "presetId");
	if (!field?.enumerable) return false;
	const entry: unknown = field.value;
	return version.value === 2 ? isCanonicalWallColor(entry)
		: version.value === 1 && typeof entry === "string" && Object.hasOwn(wallFinishColors, entry);
}
