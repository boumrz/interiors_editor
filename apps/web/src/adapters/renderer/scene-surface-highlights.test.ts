import { expect, it } from "@rstest/core";
import { supportGlowGeometry } from "./scene-surface-highlights";

const outline = [{ xM: 1, zM: 2 }, { xM: 2, zM: 2 }, { xM: 2, zM: 3 }, { xM: 1, zM: 3 }];

function readVertices(geometry: NonNullable<ReturnType<typeof supportGlowGeometry>>) {
	expect(geometry.colors.length / 4).toBe(geometry.positions.length / 3);
	return Array.from({ length: geometry.positions.length / 3 }, (_, index) => ({
		x: geometry.positions[index * 3],
		y: geometry.positions[index * 3 + 1],
		z: geometry.positions[index * 3 + 2],
		red: geometry.colors[index * 4],
		green: geometry.colors[index * 4 + 1],
		blue: geometry.colors[index * 4 + 2],
		alpha: geometry.colors[index * 4 + 3],
	}));
}

it("fades a luminous contour to transparent inside and outside the surface edge", () => {
	const geometry = supportGlowGeometry([{ heightM: 0.60, outline }]);
	if (!geometry) throw new Error("Expected a glowing contour");
	const vertices = readVertices(geometry);
	const outer = Math.min(...vertices.map(({ x }) => x));
	expect(outer).toBeLessThan(0.97);
	expect(vertices.filter(({ x }) => x === outer).every(({ alpha }) => alpha === 0)).toBe(true);
	expect(vertices.some(({ x, alpha }) => x > 1.03 && x < 1.07 && alpha === 0)).toBe(true);
	expect(vertices.every(({ x }) => x < 1.07 || x > 1.93)).toBe(true);
	const core = vertices.find(({ x, z, alpha }) => x === 1 && z === 2 && alpha > 0.7);
	expect(core).toEqual(expect.objectContaining({ red: expect.any(Number), y: expect.closeTo(0.602, 5) }));
	expect(core?.red).toBeGreaterThan(0.65);
	for (const [minimum, maximum] of [[0.10, 0.35], [0.40, 0.7]]) {
		expect(vertices.some(({ alpha, red, blue }) => alpha > minimum && alpha < maximum && blue > red)).toBe(true);
	}
	expect(Array.from(geometry.colors).every(channel => channel >= 0 && channel <= 1)).toBe(true);
});

it("keeps candidate and selected contours in one batch at each shelf height", () => {
	const geometry = supportGlowGeometry([
		{ heightM: 0.60, outline },
		{ heightM: 1.24, outline, selected: true },
	]);
	if (!geometry) throw new Error("Expected both glowing contours");
	const vertices = readVertices(geometry);
	const candidate = vertices.filter(({ y }) => Math.abs(y - 0.602) < 0.00001);
	const selected = vertices.filter(({ y }) => Math.abs(y - 1.242) < 0.00001);
	expect(candidate.length).toBeGreaterThan(0);
	expect(candidate.length).toBe(selected.length);
	expect(candidate.length + selected.length).toBe(vertices.length);
	expect(Math.max(...selected.map(({ alpha }) => alpha))).toBeGreaterThan(Math.max(...candidate.map(({ alpha }) => alpha)));
	expect(Math.min(...selected.map(({ x }) => x))).toBeLessThan(Math.min(...candidate.map(({ x }) => x)));
});

it("keeps a narrow rotated contour open and facing upwards with either winding", () => {
	const narrow = [[-0.8, -0.02], [0.8, -0.02], [0.8, 0.02], [-0.8, 0.02]].map(([x, z]) => ({
		xM: (x - z) * Math.SQRT1_2,
		zM: (x + z) * Math.SQRT1_2,
	}));
	for (const edges of [narrow, [...narrow].reverse()]) {
		const geometry = supportGlowGeometry([{ heightM: 0.86, outline: edges }]);
		if (!geometry) throw new Error("Expected a narrow glowing contour");
		const vertices = readVertices(geometry);
		for (let index = 0; index < vertices.length; index += 3) {
			const [a, b, c] = vertices.slice(index, index + 3);
			expect((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)).toBeGreaterThan(0);
		}
		const inwardRim = vertices.filter(({ x, z, alpha }) => alpha === 0 && Math.abs(x + z) < Math.SQRT2 * 0.8);
		expect(inwardRim).not.toHaveLength(0);
		expect(inwardRim.every(({ x, z }) => Math.abs(z - x) > 0.008 && Math.abs(z - x) < Math.SQRT2 * 0.02)).toBe(true);
	}
});

it("omits invalid outlines without suppressing usable contours", () => {
	const degenerate = [
		{ heightM: 0.6, outline: outline.slice(0, 2) },
		{ heightM: 0.6, outline: [{ xM: 0, zM: 0 }, { xM: 1, zM: 0 }, { xM: 2, zM: 0 }] },
		{ heightM: 0.6, outline: [outline[0], ...outline] },
		{ heightM: 0.6, outline: [{ xM: NaN, zM: 0 }, ...outline] },
		{ heightM: Infinity, outline },
	];
	expect(supportGlowGeometry(undefined)).toBeUndefined();
	expect(supportGlowGeometry([])).toBeUndefined();
	expect(supportGlowGeometry(degenerate)).toBeUndefined();
	expect(supportGlowGeometry([...degenerate, { heightM: 0.6, outline }])).toEqual(supportGlowGeometry([{ heightM: 0.6, outline }]));
});
