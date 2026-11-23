import { describe, expect, it } from "@rstest/core";
import {
	clipWallBodyToInterval,
	wallBodiesForProjection,
	wallFillRunsForProjection,
} from "./wall-body-projection";

const graph = (
	points: readonly (readonly [number, number])[],
	edges: readonly (readonly [number, number, number?])[],
) => ({
	vertices: points.map(([xMm, zMm], i) => ({ vertexId: `v${i}`, xMm, zMm })),
	wallSegments: edges.map(([a, b, thicknessMm = 100], i) => ({
		wallSegmentId: `w${i}`,
		startVertexId: `v${a}`,
		endVertexId: `v${b}`,
		thicknessMm,
	})),
});

describe("physical wall body projection shared by plan and 3D", () => {
	it("paints a straight run as one fill and stops at branches, corners and width changes", () => {
		const source = graph(
			[
				[0, 0],
				[1000, 0],
				[2000, 0],
				[3000, 0],
				[2000, 1000],
				[3000, 1000],
				[0, 2000],
				[1000, 2000],
				[2000, 2000],
			],
			[
				[1, 2],
				[1, 0],
				[2, 3],
				[2, 4],
				[3, 5],
				[6, 7, 100],
				[7, 8, 120],
			],
		);
		const bodies = wallBodiesForProjection(source);
		const fills = wallFillRunsForProjection(source, bodies);
		expect(fills).toEqual([
			{
				wallSegmentIds: ["w1", "w0"],
				polygonsMm: [bodies[1]?.polygonMm, bodies[0]?.polygonMm],
			},
		]);
		expect(bodies.map((body) => body.wallSegmentId)).toEqual([
			"w0",
			"w1",
			"w2",
			"w3",
			"w4",
			"w5",
			"w6",
		]);
	});

	it("keeps joined ends free of cap lines and bounds an acute miter without losing unequal-width corners", () => {
		const triangle = wallBodiesForProjection(
			graph(
				[
					[0, 0],
					[2000, 0],
					[2000, 2000],
				],
				[
					[0, 1],
					[1, 2],
					[2, 0],
				],
			),
		);
		for (const body of triangle) {
			expect(body.outlinesMm).toHaveLength(2);
			expect(
				body.outlinesMm.every(
					(edge) =>
						edge.length === 2 &&
						edge.every((p) => Number.isFinite(p.xMm) && Number.isFinite(p.zMm)),
				),
			).toBe(true);
		}
		const unequal = wallBodiesForProjection(
			graph(
				[
					[0, 0],
					[2000, 0],
					[0, 2000],
				],
				[
					[0, 1, 800],
					[0, 2, 100],
				],
			),
		);
		expect(unequal[0]?.polygonMm).toContainEqual({ xMm: -50, zMm: -400 });
		const acute = wallBodiesForProjection(
			graph(
				[
					[0, 0],
					[10000, 0],
					[10000, 10],
				],
				[
					[0, 1],
					[0, 2],
				],
			),
		);
		expect(
			acute
				.flatMap((body) => body.polygonMm)
				.every(
					(p) =>
						p.xMm >= -200 && p.xMm <= 10200 && p.zMm >= -200 && p.zMm <= 210,
				),
		).toBe(true);
	});
	it("retains geometry under translations, rotations and shuffled incident-wall enumeration", () => {
		const source = graph(
			[
				[0, 0],
				[1000, 0],
				[0, 1000],
				[-1000, -1000],
			],
			[
				[0, 1],
				[0, 2],
				[0, 3],
			],
		);
		const base = wallBodiesForProjection(source);
		for (let step = 0; step < 8; step++) {
			const angle = (step * Math.PI) / 4;
			const transform = (point: { xMm: number; zMm: number }) => ({
				xMm: 1700 + point.xMm * Math.cos(angle) - point.zMm * Math.sin(angle),
				zMm: 2300 + point.xMm * Math.sin(angle) + point.zMm * Math.cos(angle),
			});
			const moved = wallBodiesForProjection({
				...source,
				vertices: source.vertices.map((vertex) => ({
					...vertex,
					...transform(vertex),
				})),
				wallSegments: [...source.wallSegments].reverse(),
			});
			const ordered = (points: readonly { xMm: number; zMm: number }[]) =>
				points
					.map((p) => ({
						xMm: Math.round(p.xMm * 1e5) / 1e5,
						zMm: Math.round(p.zMm * 1e5) / 1e5,
					}))
					.sort((a, b) => a.xMm - b.xMm || a.zMm - b.zMm);
			for (const body of base)
				expect(
					ordered(
						moved.find((p) => p.wallSegmentId === body.wallSegmentId)
							?.polygonMm ?? [],
					),
				).toEqual(ordered(body.polygonMm.map(transform)));
		}
	});
	it("omits absent endpoints, zero-length and zero-thickness walls", () => {
		const source = graph(
			[
				[0, 0],
				[1000, 0],
			],
			[
				[0, 1],
				[0, 0],
				[0, 1, 0],
				[0, 2],
				[3, 1],
			],
		);
		expect(
			wallBodiesForProjection(source).map((body) => body.wallSegmentId),
		).toEqual(["w0"]);
	});
	it("outlines both physical sides and exactly the free end caps", () => {
		const body = wallBodiesForProjection(
			graph(
				[
					[400, 700],
					[1400, 700],
				],
				[[0, 1]],
			),
		)[0];
		expect(body?.outlinesMm).toEqual([
			[
				{ xMm: 400, zMm: 650 },
				{ xMm: 1400, zMm: 650 },
			],
			[
				{ xMm: 1400, zMm: 750 },
				{ xMm: 400, zMm: 750 },
			],
			[
				{ xMm: 400, zMm: 750 },
				{ xMm: 400, zMm: 650 },
			],
			[
				{ xMm: 1400, zMm: 650 },
				{ xMm: 1400, zMm: 750 },
			],
		]);
	});
	it("clips translated vertical and diagonal solids to exact jambs without losing their physical width", () => {
		for (const end of [
			[700, 2700],
			[2700, 2700],
		] as const) {
			const body = wallBodiesForProjection(
				graph([[700, 700], end], [[0, 1]]),
			)[0];
			if (!body) throw new Error("body absent");
			const polygon = clipWallBodyToInterval(body, 300, 900);
			const dx = (body.end.xMm - body.start.xMm) / body.lengthMm;
			const dz = (body.end.zMm - body.start.zMm) / body.lengthMm;
			expect(polygon).toHaveLength(4);
			const coordinates = polygon.map((p) => ({
				along: (p.xMm - body.start.xMm) * dx + (p.zMm - body.start.zMm) * dz,
				across: (p.xMm - body.start.xMm) * dz - (p.zMm - body.start.zMm) * dx,
			}));
			expect(Math.min(...coordinates.map((p) => p.along))).toBeCloseTo(300);
			expect(Math.max(...coordinates.map((p) => p.along))).toBeCloseTo(900);
			expect(Math.min(...coordinates.map((p) => p.across))).toBeCloseTo(-50);
			expect(Math.max(...coordinates.map((p) => p.across))).toBeCloseTo(50);
		}
	});
	it("fills the outside of an L corner with a true miter while preserving 100mm thickness and flat free ends", () => {
		const source = graph(
			[
				[0, 0],
				[1000, 0],
				[0, 1000],
			],
			[
				[0, 1],
				[0, 2],
			],
		);
		const bodies = wallBodiesForProjection(source);
		expect(bodies[0]?.polygonMm).toContainEqual({ xMm: -50, zMm: -50 });
		expect(bodies[0]?.polygonMm.filter((p) => p.xMm === 1000)).toEqual([
			{ xMm: 1000, zMm: -50 },
			{ xMm: 1000, zMm: 50 },
		]);
		expect(bodies[0]?.outlinesMm).toContainEqual([
			{ xMm: -50, zMm: -50 },
			{ xMm: 1000, zMm: -50 },
		]);
		expect(bodies[0]?.outlinesMm).not.toContainEqual([
			{ xMm: 0, zMm: -50 },
			{ xMm: 0, zMm: 50 },
		]);
		expect(source.wallSegments[0]?.thicknessMm).toBe(100);
	});
	it("does not leave a hole at T and X junctions or add rounded/square caps", () => {
		for (const branches of [3, 4]) {
			const bodies = wallBodiesForProjection(
				graph(
					[
						[0, 0],
						[1000, 0],
						[0, 1000],
						[-1000, 0],
						[0, -1000],
					],
					[
						[0, 1],
						[0, 2],
						[0, 3],
						[0, 4],
					].slice(0, branches) as [number, number][],
				),
			);
			expect(
				bodies.every((body) =>
					body.polygonMm.some((p) => p.xMm === 0 || p.zMm === 0),
				),
			).toBe(true);
			expect(
				bodies
					.flatMap((body) => body.polygonMm)
					.every((p) => Math.abs(p.xMm) <= 1000 && Math.abs(p.zMm) <= 1000),
			).toBe(true);
		}
	});
	it("joins a diagonal corner and preserves reversed endpoint geometry", () => {
		const forward = wallBodiesForProjection(
			graph(
				[
					[0, 0],
					[2000, 0],
					[2000, 2000],
				],
				[
					[0, 1],
					[1, 2],
					[2, 0],
				],
			),
		);
		const reversed = wallBodiesForProjection(
			graph(
				[
					[0, 0],
					[2000, 0],
					[2000, 2000],
				],
				[
					[1, 0],
					[2, 1],
					[0, 2],
				],
			),
		);
		expect(
			forward[0]?.polygonMm.some(
				(p) => p.xMm < -100 && Math.abs(p.zMm + 50) < 1e-9,
			),
		).toBe(true);
		for (let i = 0; i < forward.length; i++)
			expect(reversed[i]?.polygonMm).toEqual(forward[i]?.polygonMm);
	});
	it("keeps unequal wall widths physical and a disjoint segment unjoined", () => {
		const bodies = wallBodiesForProjection(
			graph(
				[
					[0, 0],
					[1000, 0],
					[0, 1000],
					[3000, 0],
					[4000, 0],
				],
				[
					[0, 1, 200],
					[0, 2, 100],
					[3, 4, 80],
				],
			),
		);
		expect(bodies[0]?.polygonMm).toContainEqual({ xMm: -50, zMm: -100 });
		expect(bodies[2]?.polygonMm).toEqual([
			{ xMm: 3000, zMm: -40 },
			{ xMm: 4000, zMm: -40 },
			{ xMm: 4000, zMm: 40 },
			{ xMm: 3000, zMm: 40 },
		]);
	});
	it("clips opening jambs at their exact offsets while retaining the corner on an outer solid", () => {
		const body = wallBodiesForProjection(
			graph(
				[
					[0, 0],
					[1000, 0],
					[0, 1000],
				],
				[
					[0, 1],
					[0, 2],
				],
			),
		)[0];
		if (!body) throw new Error("wall body missing");
		expect(clipWallBodyToInterval(body, 0, 300)).toContainEqual({
			xMm: -50,
			zMm: -50,
		});
		expect(
			clipWallBodyToInterval(body, 300, 700).every(
				(p) => p.xMm >= 300 && p.xMm <= 700,
			),
		).toBe(true);
		expect(
			clipWallBodyToInterval(body, 700, 1000).every((p) => p.xMm >= 700),
		).toBe(true);
	});
});
