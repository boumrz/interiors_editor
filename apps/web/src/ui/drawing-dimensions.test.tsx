import { describe, expect, it } from "@rstest/core";
import { deriveBoundedOrthogonalFaces } from "../domain/derive-plan-faces";
import { createInitialProject } from "../domain/initial-project";
import type { Project, WallOpening } from "../domain/project";
import { drawingDimensionsFor } from "./drawing-dimensions";

type Point = readonly [number, number];

function graph(points: readonly Point[], edges?: readonly (readonly [number, number])[], thicknesses: readonly number[] = []): Project {
	const initial = createInitialProject({ createdAt: "2026-10-25T10:00:00.000Z", levelId: "level", name: "Размерный план", projectId: "project" });
	const vertices = points.map(([xMm, zMm], index) => ({ vertexId: `v${index}`, xMm, zMm }));
	const wallSegments = (edges ?? points.map((_, index) => [index, (index + 1) % points.length] as const)).map(([start, end], index) => ({ wallSegmentId: `w${index}`, startVertexId: `v${start}`, endVertexId: `v${end}`, thicknessMm: thicknesses[index] ?? 100 }));
	const faces = deriveBoundedOrthogonalFaces({ vertices, wallSegments });
	if (faces.kind !== "accepted") throw new Error(`Invalid drawing fixture: ${faces.reasonCode}`);
	return { ...initial, level: { ...initial.level, vertices, wallSegments, rooms: faces.faces.map((face, index) => {
		const xs = face.vertices.map(point => point.xMm);
		const zs = face.vertices.map(point => point.zMm);
		const minX = Math.min(...xs); const maxX = Math.max(...xs); const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
		const rectangular = face.vertices.length === 4 && face.vertices.every(point => (point.xMm === minX || point.xMm === maxX) && (point.zMm === minZ || point.zMm === maxZ));
		return { roomId: `r${index}`, faceFingerprint: rectangular ? `grid:${minX}:${maxX}:${minZ}:${maxZ}:100` : face.fingerprint, heightMm: 2600 };
	}) } };
}

function rectangle(): Project {
	return graph([[0, 0], [4100, 0], [4100, 3100], [0, 3100]]);
}

function opening(id: string, offsetMm: number, widthMm: number, wallSegmentId = "w0"): WallOpening {
	return { openingId: id, wallSegmentId, offsetMm, widthMm, heightMm: 2000, sillMm: 0, kind: "Door", swingSide: "right" };
}

function withOpenings(project: Project, openings: readonly WallOpening[]): Project {
	return { ...project, level: { ...project.level, openings } };
}

function freezeProject(project: Project): Project {
	for (const vertex of project.level.vertices) Object.freeze(vertex);
	for (const wall of project.level.wallSegments) Object.freeze(wall);
	for (const room of project.level.rooms) Object.freeze(room);
	for (const value of project.level.openings) Object.freeze(value);
	Object.freeze(project.level.vertices); Object.freeze(project.level.wallSegments); Object.freeze(project.level.rooms); Object.freeze(project.level.openings);
	Object.freeze(project.level);
	return Object.freeze(project);
}

describe("DrawingDimensions-RU", () => {
	it("distinguishes wall axes, clear room spans and the actual outer wall envelope", () => {
		const dimensions = drawingDimensionsFor(rectangle());
		expect(dimensions.filter(value => value.kind === "wall").map(value => value.label)).toEqual(["4100", "3100", "4100", "3100"]);
		expect(dimensions.filter(value => value.kind === "room-clear")).toEqual(expect.arrayContaining([
			expect.objectContaining({ roomId: "r0", label: "4000", valueMm: 4000, reference: "clear", direction: "aligned", preferredSide: "top", startMm: { xMm: 50, zMm: 50 }, endMm: { xMm: 4050, zMm: 50 } }),
			expect.objectContaining({ roomId: "r0", label: "3000", valueMm: 3000, reference: "clear", direction: "aligned", preferredSide: "left", startMm: { xMm: 50, zMm: 50 }, endMm: { xMm: 50, zMm: 3050 } })
		]));
		expect(dimensions.filter(value => value.kind === "overall")).toEqual(expect.arrayContaining([
			expect.objectContaining({ label: "4200", valueMm: 4200, reference: "outer", direction: "x", preferredSide: "top", lane: 1, startMm: { xMm: -50, zMm: 0 }, endMm: { xMm: 4150, zMm: 0 } }),
			expect.objectContaining({ label: "3200", valueMm: 3200, reference: "outer", direction: "z", preferredSide: "left", lane: 1, startMm: { xMm: 0, zMm: -50 }, endMm: { xMm: 0, zMm: 3150 } })
		]));
		expect(dimensions.filter(value => value.kind === "room-clear")).toHaveLength(2);
		expect(dimensions.every(value => /^\d+$/.test(value.label))).toBe(true);
		expect(dimensions.filter(value => value.kind === "wall").every(value => value.reference === "axis" && value.direction === "aligned" && value.lane === 0)).toBe(true);
	});

	it("creates one ordered opening/pier chain whose exact intervals sum to its wall axis", () => {
		const project = withOpenings(rectangle(), [opening("window", 3000, 600), opening("door", 1200, 800)]);
		const dimensions = drawingDimensionsFor(project).filter(value => value.wallSegmentId === "w0");
		const pieces = dimensions.filter(value => value.kind === "opening" || value.kind === "pier").sort((a, b) => a.startMm.xMm - b.startMm.xMm);
		expect(pieces.map(value => [value.kind, value.valueMm, value.label, value.startMm.xMm, value.endMm.xMm])).toEqual([
			["pier", 800, "800", 0, 800], ["opening", 800, "800", 800, 1600], ["pier", 1100, "1100", 1600, 2700], ["opening", 600, "600", 2700, 3300], ["pier", 800, "800", 3300, 4100]
		]);
		expect(pieces.reduce((total, value) => total + value.valueMm, 0)).toBe(4100);
		expect(pieces.every(value => value.reference === "axis" && value.lane === 0 && value.preferredSide === "top")).toBe(true);
		expect(pieces.filter(value => value.kind === "opening").map(value => value.openingId)).toEqual(["door", "window"]);
		expect(dimensions.find(value => value.kind === "wall")?.lane).toBe(1);
	});

	it.each([
		{ wallSegmentId: "w0", side: "top", topLane: 2, leftLane: 1 },
		{ wallSegmentId: "w3", side: "left", topLane: 1, leftLane: 2 },
		{ wallSegmentId: "w2", side: "bottom", topLane: 1, leftLane: 1 },
		{ wallSegmentId: "w1", side: "right", topLane: 1, leftLane: 1 },
	])("keeps the overall row beyond the wall axis only on the same $side side as an opening chain", ({ wallSegmentId, side, topLane, leftLane }) => {
		const dimensions = drawingDimensionsFor(withOpenings(rectangle(), [opening("door", 1200, 800, wallSegmentId)]));
		expect(dimensions.find(value => value.kind === "opening")).toMatchObject({ preferredSide: side, lane: 0 });
		expect(dimensions.find(value => value.kind === "wall" && value.wallSegmentId === wallSegmentId)).toMatchObject({ preferredSide: side, lane: 1 });
		expect(dimensions.filter(value => value.kind === "overall").map(value => [value.preferredSide, value.lane])).toEqual([["top", topLane], ["left", leftLane]]);
	});

	it("omits zero piers for flush or touching openings without losing either opening", () => {
		const dimensions = drawingDimensionsFor(withOpenings(rectangle(), [opening("first", 400, 800), opening("second", 1200, 800), opening("last", 3700, 800)]));
		expect(dimensions.filter(value => value.kind === "opening")).toHaveLength(3);
		expect(dimensions.filter(value => value.kind === "pier").map(value => value.valueMm)).toEqual([1700]);
		expect(dimensions.every(value => value.valueMm > 0)).toBe(true);
	});

	it("retains half-millimetre jamb anchors and applies the existing half-up rule only to labels", () => {
		const dimensions = drawingDimensionsFor(withOpenings(rectangle(), [opening("odd", 1000, 801)]));
		const aperture = dimensions.find(value => value.openingId === "odd");
		expect(aperture).toMatchObject({ label: "801", valueMm: 801, startMm: { xMm: 599.5, zMm: 0 }, endMm: { xMm: 1400.5, zMm: 0 } });
		expect(dimensions.filter(value => value.kind === "pier").map(value => [value.valueMm, value.label])).toEqual([[599.5, "600"], [2699.5, "2700"]]);
	});

	it("keeps diagonal chain lengths along the true segment and retains the unrounded final pier", () => {
		const project = withOpenings(graph([[0, 0], [3000, 3000]], [[0, 1]]), [opening("diagonal-door", 2000, 800)]);
		const dimensions = drawingDimensionsFor(project);
		expect(dimensions.find(value => value.kind === "wall")).toMatchObject({ valueMm: Math.SQRT2 * 3000, label: "4243", startMm: { xMm: 0, zMm: 0 }, endMm: { xMm: 3000, zMm: 3000 } });
		const aperture = dimensions.find(value => value.kind === "opening");
		expect(aperture?.startMm.xMm).toBeCloseTo(1600 / Math.SQRT2, 8);
		expect(aperture?.startMm.zMm).toBeCloseTo(1600 / Math.SQRT2, 8);
		expect(aperture?.endMm.xMm).toBeCloseTo(2400 / Math.SQRT2, 8);
		const piers = dimensions.filter(value => value.kind === "pier");
		expect(piers.map(value => value.label)).toEqual(["1600", "1843"]);
		expect(piers.reduce((total, value) => total + value.valueMm, aperture?.valueMm ?? 0)).toBeCloseTo(3000 * Math.SQRT2, 9);
		expect(dimensions.filter(value => value.kind === "overall").every(value => value.reference === "outer")).toBe(true);
	});

	it("normalizes reversed walls while respecting the original offset origin", () => {
		const source = withOpenings(rectangle(), [opening("door", 1200, 800)]);
		const reversed = { ...source, level: { ...source.level, wallSegments: source.level.wallSegments.map(wall => ({ ...wall, startVertexId: wall.endVertexId, endVertexId: wall.startVertexId })), openings: [opening("door", 2900, 800)] } };
		expect(drawingDimensionsFor(reversed)).toEqual(drawingDimensionsFor(source));
	});

	it("keeps the vertical chain in physical order when the wall origin is reversed", () => {
		const project = withOpenings(graph([[0, 0], [0, 4100]], [[0, 1]]), [opening("door", 1200, 800)]);
		const reverse = withOpenings({ ...project, level: { ...project.level, wallSegments: project.level.wallSegments.map(wall => ({ ...wall, startVertexId: wall.endVertexId, endVertexId: wall.startVertexId })) } }, [opening("door", 2900, 800)]);
		expect(drawingDimensionsFor(reverse)).toEqual(drawingDimensionsFor(project));
	});

	it("projects openings on vertical walls and every signed diagonal without converting their width to an axis projection", () => {
		for (const [xMm, zMm] of [[0, 4000], [0, -4000], [3000, 3000], [3000, -3000], [-3000, 3000], [-3000, -3000]] as const) {
			const dimensions = drawingDimensionsFor(withOpenings(graph([[200, -100], [200 + xMm, -100 + zMm]], [[0, 1]]), [opening("door", 2000, 800)]));
			const aperture = dimensions.find(value => value.kind === "opening");
			expect(aperture).toMatchObject({ label: "800", valueMm: 800, wallSegmentId: "w0", openingId: "door", direction: "aligned", reference: "axis" });
			if (!aperture) throw new Error("Expected an aperture");
			expect(Math.hypot(aperture.endMm.xMm - aperture.startMm.xMm, aperture.endMm.zMm - aperture.startMm.zMm)).toBeCloseTo(800, 8);
			const cx = (aperture.startMm.xMm + aperture.endMm.xMm) / 2;
			const cz = (aperture.startMm.zMm + aperture.endMm.zMm) / 2;
			expect(cx).toBeCloseTo(200 + xMm / Math.hypot(xMm, zMm) * 2000, 8);
			expect(cz).toBeCloseTo(-100 + zMm / Math.hypot(xMm, zMm) * 2000, 8);
		}
	});

	it("keeps true clear boundary edges on a triangular room, including its diagonal", () => {
		const dimensions = drawingDimensionsFor(graph([[0, 0], [3000, 0], [3000, 3000]]));
		const clear = dimensions.filter(value => value.kind === "room-clear");
		expect(clear).toHaveLength(3);
		const diagonal = clear.find(value => value.startMm.xMm !== value.endMm.xMm && value.startMm.zMm !== value.endMm.zMm);
		expect(diagonal?.valueMm).toBeCloseTo((2900 - 50 * Math.SQRT2) * Math.SQRT2, 8);
		expect(diagonal?.label).toBe("4001");
		expect(clear.every(value => value.reference === "clear")).toBe(true);
	});

	it("does not call a concave room's bounding rectangle its clear width and depth", () => {
		const dimensions = drawingDimensionsFor(graph([[0, 0], [4000, 0], [4000, 1000], [1000, 1000], [1000, 4000], [0, 4000]]));
		const clear = dimensions.filter(value => value.kind === "room-clear");
		expect(clear).toHaveLength(6);
		expect(clear.map(value => value.valueMm).sort((a, b) => a - b)).toEqual([900, 900, 3000, 3000, 3900, 3900]);
		expect(clear.every(value => value.reference === "clear" && value.roomId === "r0" && value.direction === "aligned")).toBe(true);
		expect(clear.find(value => value.startMm.xMm === 950 && value.startMm.zMm === 950 && value.endMm.xMm === 3950 && value.endMm.zMm === 950)?.valueMm).toBe(3000);
	});

	it("derives each adjacent room separately and does not duplicate the shared wall axis", () => {
		const project = graph([[0, 0], [2000, 0], [4000, 0], [4000, 3000], [2000, 3000], [0, 3000]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4]]);
		const dimensions = drawingDimensionsFor(project);
		expect(dimensions.filter(value => value.kind === "room-clear")).toHaveLength(4);
		expect(new Set(dimensions.filter(value => value.kind === "room-clear").map(value => value.roomId))).toEqual(new Set(["r0", "r1"]));
		expect(dimensions.filter(value => value.kind === "wall" && value.wallSegmentId === "w6")).toHaveLength(1);
		expect(dimensions.find(value => value.kind === "wall" && value.wallSegmentId === "w6")?.preferredSide).toBe("left");
		const names = { ...project, level: { ...project.level, rooms: project.level.rooms.map((room, index) => ({ ...room, roomId: index === 0 ? "z-last" : "a-first" })) } };
		expect(drawingDimensionsFor(names).filter(value => value.kind === "room-clear").map(value => value.roomId)).toEqual(["a-first", "a-first", "z-last", "z-last"]);
	});

	it("uses every legacy wall thickness instead of adding one global default thickness", () => {
		const project = graph([[0, 0], [4000, 0], [4000, 3000], [0, 3000]], undefined, [101, 300, 200, 151]);
		const dimensions = drawingDimensionsFor(project);
		expect(dimensions.filter(value => value.kind === "overall").map(value => [value.direction, value.valueMm, value.label])).toEqual([["x", 4225.5, "4226"], ["z", 3150.5, "3151"]]);
		expect(dimensions.filter(value => value.kind === "room-clear").map(value => [value.valueMm, value.label]).sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([[2849.5, "2850"], [3774.5, "3775"]]);
	});

	it("measures detached diagonal butt caps rather than extending both endpoints along the wall", () => {
		const dimensions = drawingDimensionsFor(graph([[100, 300], [1100, -700]], [[0, 1]], [200]));
		const overall = dimensions.filter(value => value.kind === "overall");
		expect(overall[0]?.valueMm).toBeCloseTo(1000 + 100 * Math.SQRT2, 8);
		expect(overall[1]?.valueMm).toBeCloseTo(1000 + 100 * Math.SQRT2, 8);
		expect(overall.map(value => value.label)).toEqual(["1141", "1141"]);
		expect(overall[0]?.startMm.xMm).toBeCloseTo(100 - 100 / Math.SQRT2, 8);
		expect(overall[0]?.endMm.xMm).toBeCloseTo(1100 + 100 / Math.SQRT2, 8);
		expect(overall[0]?.startMm.zMm).toBeCloseTo(300 - 100 / Math.SQRT2, 8);
		expect(overall[0]?.endMm.zMm).toBeCloseTo(-700 + 100 / Math.SQRT2, 8);
		expect(overall[1]?.startMm.xMm).toBeCloseTo(1100 - 100 / Math.SQRT2, 8);
		expect(overall[1]?.startMm.zMm).toBeCloseTo(-700 - 100 / Math.SQRT2, 8);
		expect(overall[1]?.endMm.xMm).toBeCloseTo(100 + 100 / Math.SQRT2, 8);
		expect(overall[1]?.endMm.zMm).toBeCloseTo(300 + 100 / Math.SQRT2, 8);
	});

	it("does not invent inner room spans for unsupported or unreconciled room geometry", () => {
		const source = rectangle();
		for (const rooms of [[], [{ ...source.level.rooms[0], roomId: "broken", faceFingerprint: "unknown", heightMm: 2600 }]]) {
			const result = drawingDimensionsFor({ ...source, level: { ...source.level, rooms } });
			expect(result.filter(value => value.kind === "room-clear")).toEqual([]);
			expect(result.filter(value => value.kind === "wall")).toHaveLength(4);
		}
	});

	it("does not build partial pier chains from malformed, out-of-host or overlapping opening intervals", () => {
		for (const openings of [[opening("outside", 4000, 800)], [opening("negative", -100, 800)], [opening("zero", 1000, 0)], [opening("decimal", 1000.1, 800)], [opening("first", 1000, 800), opening("second", 1300, 800)]]) {
			const dimensions = drawingDimensionsFor(withOpenings(rectangle(), openings));
			expect(dimensions.filter(value => value.kind === "opening" || value.kind === "pier")).toEqual([]);
			expect(dimensions.filter(value => value.kind === "wall")).toHaveLength(4);
			expect(dimensions).toEqual(drawingDimensionsFor(rectangle()));
		}
	});

	it("ignores unresolved wall references and suppresses an unprovable overall envelope", () => {
		const source = rectangle();
		const dimensions = drawingDimensionsFor({ ...source, level: { ...source.level, wallSegments: [...source.level.wallSegments, { wallSegmentId: "absent", startVertexId: "missing", endVertexId: "v0", thicknessMm: 100 }] } });
		expect(dimensions.filter(value => value.kind === "wall")).toHaveLength(4);
		expect(dimensions.filter(value => value.wallSegmentId === "absent" || value.kind === "overall" || value.kind === "room-clear")).toEqual([]);
	});

	it("does not project zero, unsupported, unsafe or non-finite wall segments", () => {
		const source = graph([[0, 0], [1000, 0]], [[0, 1]]);
		for (const point of [{ xMm: 0, zMm: 0 }, { xMm: 1000, zMm: 200 }, { xMm: Number.NaN, zMm: 0 }, { xMm: Number.POSITIVE_INFINITY, zMm: 0 }, { xMm: Number.MAX_SAFE_INTEGER + 1, zMm: 0 }, { xMm: 1000.5, zMm: 0 }]) {
			expect(drawingDimensionsFor({ ...source, level: { ...source.level, vertices: [source.level.vertices[0], { vertexId: "v1", ...point }] } })).toEqual([]);
		}
		for (const thicknessMm of [0, -1, 0.5, Number.NaN]) {
			expect(drawingDimensionsFor({ ...source, level: { ...source.level, wallSegments: source.level.wallSegments.map(wall => ({ ...wall, thicknessMm })) } })).toEqual([]);
		}
		for (const points of [[{ vertexId: "v0", xMm: -Number.MAX_SAFE_INTEGER, zMm: 0 }, { vertexId: "v1", xMm: Number.MAX_SAFE_INTEGER, zMm: 0 }], [{ vertexId: "v0", xMm: 0, zMm: 0 }, { vertexId: "v1", xMm: Number.MAX_SAFE_INTEGER, zMm: Number.MAX_SAFE_INTEGER }]]) {
			expect(drawingDimensionsFor({ ...source, level: { ...source.level, vertices: points } })).toEqual([]);
		}
	});

	it("uses outward layout preferences consistently for the four sides", () => {
		expect(drawingDimensionsFor(rectangle()).filter(value => value.kind === "wall").map(value => [value.wallSegmentId, value.preferredSide])).toEqual([["w0", "top"], ["w1", "right"], ["w2", "bottom"], ["w3", "left"]]);
	});

	it("places internal dimension lanes relative to the complete plan, including shifted and centerline cases", () => {
		const examples: readonly { readonly points: readonly Point[]; readonly edge: readonly [number, number]; readonly expected: "left" | "right" }[] = [
			{ points: [[0, 0], [1000, 0], [4000, 0], [4000, 3000], [1000, 3000], [0, 3000]], edge: [1, 4], expected: "left" },
			{ points: [[4000, 0], [4000, 3000], [3000, 3000], [0, 3000], [0, 0], [3000, 0]], edge: [5, 2], expected: "right" },
			{ points: [[0, 0], [2000, 0], [4000, 0], [4000, 3000], [2000, 3000], [0, 3000]], edge: [1, 4], expected: "left" }
		];
		for (const { points, edge, expected } of examples) {
			const edges = [...points.map((_, index) => [index, (index + 1) % points.length] as const), edge];
			expect(drawingDimensionsFor(graph(points, edges)).find(value => value.kind === "wall" && value.wallSegmentId === "w6")?.preferredSide).toBe(expected);
			const rotated: Point[] = points.map(([x, z]) => [z, x]);
			expect(drawingDimensionsFor(graph(rotated, edges)).find(value => value.kind === "wall" && value.wallSegmentId === "w6")?.preferredSide).toBe(expected === "left" ? "top" : "bottom");
		}
	});

	it("keeps the maximum exactly representable axis length instead of losing an admissible endpoint", () => {
		const project = graph([[0, 0], [Number.MAX_SAFE_INTEGER, 0]], [[0, 1]]);
		expect(drawingDimensionsFor(project).find(value => value.kind === "wall")).toMatchObject({ valueMm: Number.MAX_SAFE_INTEGER, label: "9007199254740991", endMm: { xMm: Number.MAX_SAFE_INTEGER, zMm: 0 } });
	});

	it("has deterministic keys/order independent of collection order and never mutates its input", () => {
		const project = freezeProject(withOpenings(rectangle(), [opening("door", 1000, 800), opening("window", 3000, 1000)]));
		const before = JSON.stringify(project);
		const dimensions = drawingDimensionsFor(project);
		expect(dimensions).toEqual(drawingDimensionsFor({ ...project, level: { ...project.level, vertices: [...project.level.vertices].reverse(), wallSegments: [...project.level.wallSegments].reverse(), openings: [...project.level.openings].reverse(), rooms: [...project.level.rooms].reverse() } }));
		expect(new Set(dimensions.map(value => value.id)).size).toBe(dimensions.length);
		expect(JSON.stringify(project)).toBe(before);
		expect(dimensions.every(value => value.id.length > 0 && [value.startMm.xMm, value.startMm.zMm, value.endMm.xMm, value.endMm.zMm, value.valueMm].every(Number.isFinite))).toBe(true);
	});

	it("returns no annotations for an empty plan or a data set beyond the explicit projection budgets", () => {
		const source = rectangle();
		expect(drawingDimensionsFor(createInitialProject({ createdAt: source.createdAt, levelId: "empty", name: "Пусто", projectId: "empty" }))).toEqual([]);
		for (const [field, count] of [["wallSegments", 301], ["rooms", 51], ["openings", 201]] as const) {
			const values = field === "wallSegments" ? Array.from({ length: count }, (_, index) => ({ ...source.level.wallSegments[0], wallSegmentId: `wall-${index}` })) : field === "rooms" ? Array.from({ length: count }, (_, index) => ({ ...source.level.rooms[0], roomId: `room-${index}` })) : Array.from({ length: count }, (_, index) => opening(`opening-${index}`, 1000, 800));
			expect(drawingDimensionsFor({ ...source, level: { ...source.level, [field]: values } })).toEqual([]);
		}
	});

	it("still draws the exact maximum of 50 rooms, 300 walls and 200 openings", () => {
		const points: Point[] = [];
		const edges: (readonly [number, number])[] = [];
		for (let index = 0; index < 50; index += 1) {
			const x = (index % 10) * 1500; const z = Math.floor(index / 10) * 1500;
			const first = points.length;
			points.push([x, z], [x + 1100, z], [x + 1100, z + 1100], [x, z + 1100]);
			edges.push([first, first + 1], [first + 1, first + 2], [first + 2, first + 3], [first + 3, first]);
		}
		for (let index = 0; index < 100; index += 1) {
			const first = points.length;
			points.push([20000 + index * 200, 0], [20100 + index * 200, 0]);
			edges.push([first, first + 1]);
		}
		const source = graph(points, edges);
		const project = withOpenings(source, Array.from({ length: 200 }, (_, index) => opening(`door-${index}`, 550, 800, `w${index}`)));
		expect(project.level.rooms).toHaveLength(50);
		const dimensions = drawingDimensionsFor(project);
		expect(dimensions.filter(value => value.kind === "wall")).toHaveLength(300);
		expect(dimensions.filter(value => value.kind === "opening")).toHaveLength(200);
		expect(dimensions.filter(value => value.kind === "room-clear")).toHaveLength(100);
	});
});
