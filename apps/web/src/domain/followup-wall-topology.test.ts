import { describe, expect, it } from "@rstest/core";
import { addGeneralWallToProject } from "./general-wall-project";
import { createInitialProject } from "./initial-project";
import { configureRectangularRoom } from "./rectangular-room";
import type { Project } from "./project";
import { deriveBoundedOrthogonalFaces } from "./derive-plan-faces";
import type { PlanGraph } from "./derive-plan-faces";
import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
} from "./door-opening-project";

function radialRooms(sectors: readonly number[]): PlanGraph {
	const rim = [
		[0, -2000],
		[2000, -2000],
		[2000, 0],
		[2000, 2000],
		[0, 2000],
		[-2000, 2000],
		[-2000, 0],
		[-2000, -2000],
	] as const;
	const edges = new Map<
		string,
		{
			startVertexId: string;
			endVertexId: string;
			wallSegmentId: string;
			thicknessMm: number;
		}
	>();
	const used = new Set<number>();
	for (const index of sectors) {
		const next = (index + 1) % rim.length;
		used.add(index);
		used.add(next);
		for (const [a, b] of [
			["center", `r${index}`],
			[`r${index}`, `r${next}`],
			[`r${next}`, "center"],
		]) {
			if (!a || !b) throw new Error("Expected triangle edge");
			const key = [a, b].sort().join(":");
			edges.set(key, {
				startVertexId: a,
				endVertexId: b,
				wallSegmentId: key,
				thicknessMm: 100,
			});
		}
	}
	return {
		vertices: [
			{ vertexId: "center", xMm: 0, zMm: 0 },
			...[...used].map((index) => {
				const point = rim[index];
				if (!point) throw new Error("Expected rim vertex");
				return { vertexId: `r${index}`, xMm: point[0], zMm: point[1] };
			}),
		],
		wallSegments: [...edges.values()],
	};
}

function openUpperContour() {
	let ordinal = 0;
	const ids = { next: () => `followup-${ordinal++}` };
	const at = "2026-11-01T12:00:00.000Z";
	const rectangle = configureRectangularRoom(
		createInitialProject({
			createdAt: at,
			projectId: "through-wall",
			levelId: "level",
			name: "Сквозная стена",
		}),
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		ids,
		at,
	);
	if (rectangle.kind !== "accepted") throw new Error("Expected initial room");
	let project: Project = rectangle.project;
	for (const [start, end] of [
		[
			{ xMm: 0, zMm: 0 },
			{ xMm: 0, zMm: -3100 },
		],
		[
			{ xMm: 0, zMm: -3100 },
			{ xMm: 2700, zMm: -3100 },
		],
		[
			{ xMm: 2700, zMm: -3100 },
			{ xMm: 2700, zMm: -1100 },
		],
	] as const) {
		const result = addGeneralWallToProject(
			project,
			{ start, end, thicknessMm: 100 },
			ids,
			at,
		);
		if (result.kind !== "accepted")
			throw new Error(`Setup rejected: ${result.reasonCode}`);
		project = result.project;
	}
	return { project, ids, at };
}

describe("continuing an open contour through an existing room", () => {
	for (const kind of ["door", "window"] as const) {
		for (const collision of [false, true]) {
			it(`${collision ? "rejects contact through" : "preserves the exact address of"} an existing ${kind}`, () => {
				const { project, ids, at } = openUpperContour();
				const host = project.level.wallSegments.find((wall) => {
					const a = project.level.vertices.find(
						(v) => v.vertexId === wall.startVertexId,
					);
					const b = project.level.vertices.find(
						(v) => v.vertexId === wall.endVertexId,
					);
					return a?.zMm === 0 && b?.zMm === 0;
				});
				if (!host) throw new Error("Expected room boundary host");
				const a = project.level.vertices.find(
					(v) => v.vertexId === host.startVertexId,
				);
				if (!a) throw new Error("Expected host origin");
				const xMm = collision ? 2700 : 3400;
				const createOpening =
					kind === "door" ? addDoorOpeningToProject : addWindowOpeningToProject;
				const opened = createOpening(
					project,
					{
						wallSegmentId: host.wallSegmentId,
						offsetMm: Math.abs(xMm - a.xMm),
						widthMm: 900,
						heightMm: kind === "door" ? 2100 : 1200,
						sillMm: kind === "door" ? 0 : 900,
					},
					ids,
					at,
				);
				if (opened.kind !== "accepted")
					throw new Error(`Opening setup: ${opened.reasonCode}`);
				const source = JSON.stringify(opened.project);
				const result = addGeneralWallToProject(
					opened.project,
					{
						start: { xMm: 2700, zMm: -1100 },
						end: { xMm: 2700, zMm: 3100 },
						thicknessMm: 100,
					},
					collision
						? {
								next: () => {
									throw new Error("Rejected contact must not allocate IDs");
								},
							}
						: ids,
					at,
				);
				expect(JSON.stringify(opened.project)).toBe(source);
				if (collision) {
					expect(result).toMatchObject({
						kind: "rejected",
						reasonCode: "WALL_DOOR_OPENING_COLLISION",
					});
					return;
				}
				expect(result.kind).toBe("accepted");
				if (result.kind !== "accepted") return;
				expect(result.project.level.rooms).toHaveLength(3);
				const previous = opened.project.level.openings[0];
				const opening = result.project.level.openings[0];
				if (!opening || !previous)
					throw new Error("Expected surviving opening");
				expect(result.project.level.openings).toHaveLength(1);
				expect(opening).toEqual({
					...previous,
					wallSegmentId: opening.wallSegmentId,
					offsetMm: 700,
				});
				expect(opening.wallSegmentId).not.toBe(host.wallSegmentId);
				const successor = result.project.level.wallSegments.find(
					(wall) => wall.wallSegmentId === opening.wallSegmentId,
				);
				const start = result.project.level.vertices.find(
					(v) => v.vertexId === successor?.startVertexId,
				);
				expect(start).toMatchObject({ xMm: 2700, zMm: 0 });
				expect((start?.xMm ?? 0) + opening.offsetMm).toBe(xMm);
			});
		}
	}
	it.each([
		{ sectors: [0, 1], allowed: true },
		{ sectors: [0, 1, 2], allowed: true },
		{ sectors: [0, 1, 2, 3], allowed: true },
		{ sectors: [0, 1, 2, 3, 4, 5, 6, 7], allowed: true },
		{ sectors: [0, 4], allowed: false },
		{ sectors: [0, 1, 4], allowed: false },
		{ sectors: [0, 1, 4, 5], allowed: false },
	])(
		"requires a connected chain of incident rooms at a shared vertex: $sectors",
		({ sectors, allowed }) => {
			const graph = radialRooms(sectors);
			for (const candidate of [
				graph,
				{
					...graph,
					vertices: [...graph.vertices].reverse(),
					wallSegments: [...graph.wallSegments]
						.reverse()
						.map((w) => ({
							...w,
							startVertexId: w.endVertexId,
							endVertexId: w.startVertexId,
						})),
				},
			]) {
				const result = deriveBoundedOrthogonalFaces(candidate);
				expect(result.kind).toBe(allowed ? "accepted" : "rejected");
				if (result.kind === "accepted")
					expect(result.faces).toHaveLength(sectors.length);
				else expect(result.reasonCode).toBe("AMBIGUOUS_BOUNDED_WALK");
			}
		},
	);
	for (const reversed of [false, true]) {
		it(`closes the upper contour and splits the lower room in one ${reversed ? "reversed" : "forward"} wall command`, () => {
			const { project, ids, at } = openUpperContour();
			expect(project.level.rooms).toHaveLength(1);
			const source = JSON.stringify(project);
			const freeEnd = { xMm: 2700, zMm: -1100 };
			const boundary = { xMm: 2700, zMm: 3100 };
			const result = addGeneralWallToProject(
				project,
				{
					start: reversed ? boundary : freeEnd,
					end: reversed ? freeEnd : boundary,
					thicknessMm: 100,
				},
				ids,
				at,
			);
			expect(
				result.kind,
				result.kind === "rejected" ? result.reasonCode : "",
			).toBe("accepted");
			if (result.kind !== "accepted") return;
			expect(result.project.level.rooms).toHaveLength(3);
			// Seven existing walls remain stable; two contact splits and two new
			// pieces are added. The existing upper segment is not silently merged.
			expect(result.project.level.wallSegments).toHaveLength(11);
			const junction = result.project.level.vertices.find(
				(v) => v.xMm === 2700 && v.zMm === 0,
			);
			expect(junction).toBeDefined();
			expect(
				result.project.level.wallSegments.filter(
					(wall) =>
						wall.startVertexId === junction?.vertexId ||
						wall.endVertexId === junction?.vertexId,
				),
			).toHaveLength(4);
			const derived = deriveBoundedOrthogonalFaces(result.project.level);
			expect(derived.kind).toBe("accepted");
			if (derived.kind === "accepted") expect(derived.faces).toHaveLength(3);
			expect(
				result.project.level.vertices.every(
					(v) => Number.isSafeInteger(v.xMm) && Number.isSafeInteger(v.zMm),
				),
			).toBe(true);
			expect(JSON.stringify(project)).toBe(source);
		});
	}
});
