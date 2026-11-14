import type { DrawingDimension } from "./drawing-dimensions";

export type DrawingDimensionVisibility = Readonly<
	Record<DrawingDimension["kind"], boolean>
>;

export interface DrawingDimensionPreferencesPort {
	read(): string | null;
	write(raw: string): void;
}

export const DRAWING_DIMENSION_PREFERENCES_KEY =
	"interiors.editor.dimension-visibility.v1";

const kinds = ["wall", "opening", "pier", "overall", "room-clear"] as const;

export function defaultDrawingDimensionVisibility(): DrawingDimensionVisibility {
	return {
		wall: false,
		opening: false,
		pier: false,
		overall: false,
		"room-clear": true,
	};
}

export function filterDrawingDimensions(
	dimensions: readonly DrawingDimension[],
	visibility: DrawingDimensionVisibility,
): readonly DrawingDimension[] {
	return dimensions.filter(
		(dimension) =>
			dimension.kind !== "wall" &&
			dimension.kind !== "pier" &&
			visibility[dimension.kind],
	);
}

export function parseDrawingDimensionPreferences(
	raw: string | null,
): DrawingDimensionVisibility {
	if (raw === null || raw.length > 2048)
		return defaultDrawingDimensionVisibility();
	try {
		const value: unknown = JSON.parse(raw);
		if (
			!isRecord(value) ||
			Object.keys(value).length !== 2 ||
			value.version !== 1 ||
			!isVisibility(value.visible)
		)
			return defaultDrawingDimensionVisibility();
		return copyVisibility(value.visible);
	} catch {
		return defaultDrawingDimensionVisibility();
	}
}

export function serializeDrawingDimensionPreferences(
	visibility: DrawingDimensionVisibility,
): string {
	return JSON.stringify({ version: 1, visible: copyVisibility(visibility) });
}

export function loadDrawingDimensionPreferences(
	read: () => string | null,
): DrawingDimensionVisibility {
	try {
		return parseDrawingDimensionPreferences(read());
	} catch {
		return defaultDrawingDimensionVisibility();
	}
}

export function saveDrawingDimensionPreferences(
	visibility: DrawingDimensionVisibility,
	write: (raw: string) => void,
): boolean {
	try {
		write(serializeDrawingDimensionPreferences(visibility));
		return true;
	} catch {
		return false;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isVisibility(value: unknown): value is DrawingDimensionVisibility {
	return (
		isRecord(value) &&
		Object.keys(value).length === kinds.length &&
		kinds.every(
			(kind) => Object.hasOwn(value, kind) && typeof value[kind] === "boolean",
		)
	);
}

function copyVisibility(
	visibility: DrawingDimensionVisibility,
): DrawingDimensionVisibility {
	return {
		wall: false,
		opening: visibility.opening,
		pier: false,
		overall: visibility.overall,
		"room-clear": visibility["room-clear"],
	};
}
