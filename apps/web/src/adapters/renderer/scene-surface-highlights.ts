export interface SceneSurfaceHighlight {
	readonly heightM: number;
	readonly outline: readonly { readonly xM: number; readonly zM: number }[];
	readonly selected?: true | undefined;
}

export const FLOOR_DESTINATION_TINT = "#378cd8";

type OutlinePoint = SceneSurfaceHighlight["outline"][number];

const GLOW_PROFILE = [
	[-1,    0.10, 0.52, 1,    0],
	[-0.38, 0.13, 0.71, 1,    0.28],
	[-0.08, 0.34, 0.87, 1,    0.74],
	[0,     0.94, 0.99, 1,    0.98],
	[0.10,  0.34, 0.87, 1,    0.72],
	[0.40,  0.13, 0.71, 1,    0.30],
	[1,     0.10, 0.52, 1,    0],
] as const;

function glowOutline(outline: readonly OutlinePoint[]) {
	if (outline.length < 3) return undefined;
	const area = outline.reduce((sum, point, index) => {
		const next = outline[(index + 1) % outline.length];
		return sum + point.xM * next.zM - next.xM * point.zM;
	}, 0);
	if (!Number.isFinite(area) || area === 0) return undefined;
	const points = area < 0 ? outline : [...outline].reverse();
	const normals: OutlinePoint[] = [];
	let centerX = 0;
	let centerZ = 0;
	for (const [index, point] of points.entries()) {
		const next = points[(index + 1) % points.length];
		const x = next.xM - point.xM;
		const z = next.zM - point.zM;
		const length = Math.hypot(x, z);
		if (length === 0) return undefined;
		normals.push({ xM: -z / length, zM: x / length });
		centerX += point.xM / points.length;
		centerZ += point.zM / points.length;
	}
	// Preserve a clear center even when the contact surface is a thin shelf.
	const centerClearance = Math.min(...points.map((point, index) =>
		(point.xM - centerX) * normals[index].xM + (point.zM - centerZ) * normals[index].zM,
	));
	const offsets = normals.map((normal, index) => {
		const previous = normals[(index + normals.length - 1) % normals.length];
		// Bisect the corner to keep every straight edge the same width.
		const divisor = Math.max(0.25, 1 + normal.xM * previous.xM + normal.zM * previous.zM);
		return {
			xM: (normal.xM + previous.xM) / divisor,
			zM: (normal.zM + previous.zM) / divisor,
		};
	});
	return { points, offsets, centerClearance };
}

/** Batches the soft glow around convex contact outlines as upward-facing strips. */
export function supportGlowGeometry(surfaces: readonly SceneSurfaceHighlight[] | undefined): { positions: Float32Array; colors: Float32Array } | undefined {
	const positions: number[] = [];
	const colors: number[] = [];
	for (const surface of surfaces ?? []) {
		const outline = glowOutline(surface.outline);
		if (!outline || !Number.isFinite(surface.heightM)) continue;
		const { points, offsets, centerClearance } = outline;
		const haloWidth = surface.selected ? 0.056 : 0.042;
		const opacity = surface.selected ? 1 : 0.84;
		// Lift the glow by 2 mm to separate it from the physical plate.
		const y = surface.heightM + 0.002;
		const rings = GLOW_PROFILE.map(([distance, red, green, blue, alpha]) => {
			const radius = distance * (distance < 0 ? Math.min(haloWidth, centerClearance * 0.65) : haloWidth);
			return {
				points: points.map((point, index) => ({
					xM: point.xM + offsets[index].xM * radius,
					zM: point.zM + offsets[index].zM * radius,
				})),
				color: [red, green, blue, alpha * opacity],
			};
		});
		for (let index = 1; index < rings.length; index++) {
			const inner = rings[index - 1];
			const outer = rings[index];
			for (let edge = 0; edge < points.length; edge++) {
				const next = (edge + 1) % points.length;
				const a = inner.points[edge];
				const b = inner.points[next];
				const c = outer.points[edge];
				const d = outer.points[next];
				positions.push(a.xM, y, a.zM, c.xM, y, c.zM, d.xM, y, d.zM);
				positions.push(a.xM, y, a.zM, d.xM, y, d.zM, b.xM, y, b.zM);
				colors.push(...inner.color, ...outer.color, ...outer.color, ...inner.color, ...outer.color, ...inner.color);
			}
		}
	}
	if (positions.length === 0) return undefined;
	return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
}
