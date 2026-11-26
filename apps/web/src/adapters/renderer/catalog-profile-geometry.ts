import type { CatalogProfile } from "./catalog-model-parts";

/** Compact, smooth sections with exact cardinal points for projected bounds. */
const oval = Array.from({ length: 20 }, (_, i) => {
	const angle = (i * Math.PI) / 10;
	return [Math.cos(angle), Math.sin(angle)] as const;
});

function roundedOutline(radius: number) {
	return [0, 1, 2, 3].flatMap((corner) => {
		const centre = ((corner + 0.5) * Math.PI) / 2;
		const centreX = Math.sign(Math.cos(centre)) * (1 - radius);
		const centreZ = Math.sign(Math.sin(centre)) * (1 - radius);
		return [0, 1, 2].map((step) => {
			const angle = (corner * Math.PI) / 2 + (step * Math.PI) / 4;
			return [
				centreX + radius * Math.cos(angle),
				centreZ + radius * Math.sin(angle),
			] as const;
		});
	});
}

const rounded = roundedOutline(0.24);

export function catalogProfileGeometry(profile: CatalogProfile): {
	positions: number[];
	indices: number[];
} {
	const outline =
		profile.cornerRadius !== undefined
			? roundedOutline(profile.cornerRadius)
			: profile.outline === "rounded"
				? rounded
				: oval;
	const sides = outline.length;
	const positions: number[] = [];
	const indices: number[] = [];
	const frontFacing = profile.axis === "z";

	function triangle(a: number, b: number, c: number) {
		indices.push(a, frontFacing ? c : b, frontFacing ? b : c);
	}

	for (const [
		index,
		[at, width, transverse, xOffset = 0, offset = 0],
	] of profile.rings.entries()) {
		for (const [x, across] of outline) {
			const u = (x * width) / 2 + xOffset;
			const v = (across * transverse) / 2 + offset;
			positions.push(u, frontFacing ? v : at - 0.5, frontFacing ? at - 0.5 : v);
		}
		if (index === 0) continue;
		for (let side = 0; side < sides; side += 1) {
			const next = (side + 1) % sides;
			const lower = (index - 1) * sides;
			const upper = index * sides;
			triangle(lower + side, upper + side, lower + next);
			triangle(lower + next, upper + side, upper + next);
		}
	}

	const firstCap = positions.length / 3;
	const lastRing = (profile.rings.length - 1) * sides;
	// Duplicate the cap vertices so averaging normals keeps the rims crisp.
	positions.push(
		...positions.slice(0, sides * 3),
		...positions.slice(lastRing * 3),
	);
	const lastCap = firstCap + sides;
	for (let side = 1; side < sides - 1; side += 1) {
		if (!profile.openStart)
			triangle(firstCap, firstCap + side, firstCap + side + 1);
		if (!profile.openEnd) triangle(lastCap, lastCap + side + 1, lastCap + side);
	}

	return { positions, indices };
}
