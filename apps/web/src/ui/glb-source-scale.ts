const CENTIMETRES_TO_METRES = 0.01;
const SKETCHFAB_CENTIMETRE_SCALE = 100;
const SCALE_TOLERANCE = 0.5;

export interface GlbBoundsMetres {
	readonly depthM: number;
	readonly heightM: number;
	readonly widthM: number;
}

export interface MeasuredGlbDimensionsMillimetres {
	readonly depthMm: number;
	readonly heightMm: number;
	readonly widthMm: number;
}

interface JsonRecord {
	readonly [key: string]: unknown;
}

function record(value: unknown): JsonRecord | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as JsonRecord)
		: undefined;
}

function isSketchfabFbxExport(asset: unknown): boolean {
	const assetRecord = record(asset);
	const extras = record(assetRecord?.extras);
	return (
		typeof assetRecord?.generator === "string" &&
		assetRecord.generator.startsWith("Sketchfab-") &&
		typeof extras?.source === "string" &&
		extras.source.includes("sketchfab.com/3d-models/")
	);
}

function isCentimetreMatrix(value: unknown): boolean {
	if (
		!Array.isArray(value) ||
		value.length !== 16 ||
		!value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
	)
		return false;
	const matrix = value as readonly number[];
	const scales = [
		Math.hypot(matrix[0] ?? 0, matrix[1] ?? 0, matrix[2] ?? 0),
		Math.hypot(matrix[4] ?? 0, matrix[5] ?? 0, matrix[6] ?? 0),
		Math.hypot(matrix[8] ?? 0, matrix[9] ?? 0, matrix[10] ?? 0),
	];
	return scales.every(
		(scale) =>
			Math.abs(scale - SKETCHFAB_CENTIMETRE_SCALE) <= SCALE_TOLERANCE,
	);
}

/**
 * Sketchfab's FBX-to-GLB export occasionally preserves centimetre transforms
 * in node matrices even though glTF dimensions are metres. Only its explicit
 * metadata plus a uniform 100× matrix is enough evidence to correct the
 * suggested physical dimensions; every other GLB remains at declared scale.
 */
export function sourceMetreScaleForGlb(document: unknown): number {
	const root = record(document);
	if (!root || !isSketchfabFbxExport(root.asset) || !Array.isArray(root.nodes)) {
		return 1;
	}
	return root.nodes.some((node) => isCentimetreMatrix(record(node)?.matrix))
		? CENTIMETRES_TO_METRES
		: 1;
}

/**
 * Bounds from Three are renderer-space metres.  This only prepares the
 * editable, user-confirmed suggestions shown by the custom-asset form.
 */
export function measuredDimensionsMmForGlbBounds(
	bounds: GlbBoundsMetres,
	document: unknown,
): MeasuredGlbDimensionsMillimetres {
	const metreScale = sourceMetreScaleForGlb(document);
	const toMillimetres = (valueM: number) =>
		Math.max(1, Math.round(valueM * metreScale * 1000));
	return {
		depthMm: toMillimetres(bounds.depthM),
		heightMm: toMillimetres(bounds.heightM),
		widthMm: toMillimetres(bounds.widthM),
	};
}
