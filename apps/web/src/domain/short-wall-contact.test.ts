import { describe, expect, it } from "@rstest/core";

import { addWallSegment } from "./add-wall-segment";
import { deriveBoundedOrthogonalFaces } from "./derive-plan-faces";
import { resolveOrthogonalPlanFaces } from "./derived-orthogonal-plan-faces";
import {
	addGeneralWallToProject,
	changeGeneralWallThickness,
	deleteGeneralWallFromProject,
	moveGeneralVertex,
	moveGeneralWall,
	splitGeneralWall,
} from "./general-wall-project";
import { createInitialProject } from "./initial-project";
import type { Project } from "./project";
import { decodeLocalProjectJson, encodeLocalProjectJson } from "./project-json-transfer";

const updatedAt = "2026-11-14T18:00:00.000Z";

function ids() {
	let next = 0;
	return { next: () => `contact-${++next}` };
}

function openRoomWithExtendedBottom(tailLengthMm: number): Project {
	const initial = createInitialProject({
		createdAt: updatedAt,
		levelId: "tail-level",
		name: "Комната с остатком стены",
		projectId: "tail-project",
	});
	return {
		...initial,
		level: {
			...initial.level,
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "tail-end", xMm: 4000 + tailLengthMm, zMm: 0 },
				{ vertexId: "c", xMm: 4000, zMm: 3000 },
				{ vertexId: "d", xMm: 0, zMm: 3000 },
			],
			wallSegments: [
				{ wallSegmentId: "bottom", startVertexId: "a", endVertexId: "tail-end", thicknessMm: 100 },
				{ wallSegmentId: "top", startVertexId: "c", endVertexId: "d", thicknessMm: 100 },
				{ wallSegmentId: "left", startVertexId: "d", endVertexId: "a", thicknessMm: 100 },
			],
		},
	};
}

function closeRoom(tailLengthMm: number): Project {
	const result = addGeneralWallToProject(
		openRoomWithExtendedBottom(tailLengthMm),
		{ start: { xMm: 4000, zMm: 0 }, end: { xMm: 4000, zMm: 3000 }, thicknessMm: 100 },
		ids(),
		updatedAt,
	);
	expect(result.kind).toBe("accepted");
	if (result.kind !== "accepted") throw new Error(`Room closure failed: ${result.reasonCode}`);
	return result.project;
}

function tailOf(project: Project) {
	const tail = project.level.wallSegments.find((wall) =>
		wall.startVertexId === "tail-end" || wall.endVertexId === "tail-end",
	);
	if (!tail) throw new Error("The exact dangling wall must remain selectable");
	return tail;
}

describe("exact wall contacts with short retained fragments", () => {
	it.each([1, 99, 100])("closes a room and retains its exact %i-mm dangling fragment", (tailLengthMm) => {
		const source = openRoomWithExtendedBottom(tailLengthMm);
		const before = JSON.stringify(source);
		const project = closeRoom(tailLengthMm);
		expect(project.level.rooms).toHaveLength(1);
		expect(project.level.wallSegments).toHaveLength(5);
		expect(project.level.vertices).toContainEqual({ vertexId: "tail-end", xMm: 4000 + tailLengthMm, zMm: 0 });
		const tail = tailOf(project);
		const contact = project.level.vertices.find((vertex) => vertex.vertexId === (tail.startVertexId === "tail-end" ? tail.endVertexId : tail.startVertexId));
		expect(contact).toEqual(expect.objectContaining({ xMm: 4000, zMm: 0 }));
		expect(deriveBoundedOrthogonalFaces(project.level)).toEqual(expect.objectContaining({ kind: "accepted", faces: [expect.anything()] }));
		expect(resolveOrthogonalPlanFaces(project).kind).toBe("accepted");
		expect(JSON.stringify(source)).toBe(before);
	});

	it("lets the user delete the retained fragment without deleting the room", () => {
		const source = closeRoom(1);
		const result = deleteGeneralWallFromProject(source, { wallSegmentId: tailOf(source).wallSegmentId }, updatedAt);
		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.wallSegments).toHaveLength(4);
		expect(result.project.level.vertices.some((vertex) => vertex.vertexId === "tail-end")).toBe(false);
	});

	it("lets the user extend the retained fragment and continue adding walls", () => {
		const source = closeRoom(1);
		const result = addGeneralWallToProject(source, {
			start: { xMm: 4001, zMm: 0 }, end: { xMm: 5001, zMm: 0 }, thicknessMm: 100,
		}, { next: (() => { let next = 0; return () => `extension-${++next}`; })() }, updatedAt);
		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.vertices).toContainEqual(expect.objectContaining({ xMm: 5001, zMm: 0 }));
		const added = addGeneralWallToProject(source, {
			start: { xMm: 6000, zMm: 0 }, end: { xMm: 7000, zMm: 0 }, thicknessMm: 100,
		}, { next: (() => { let next = 0; return () => `additional-${++next}`; })() }, updatedAt);
		expect(added.kind).toBe("accepted");
	});

	it.each([1, 99, 100])("does not let an unchanged %i-mm fragment block another wall's move or thickness edit", (lengthMm) => {
		const source = closeRoom(lengthMm);
		expect(moveGeneralWall(source, { wallSegmentId: "left", positionMm: -100 }, updatedAt).kind).toBe("accepted");
		expect(changeGeneralWallThickness(source, { wallSegmentId: "left", thicknessMm: 200 }, updatedAt).kind).toBe("accepted");
		expect(moveGeneralVertex(source, { vertexId: "tail-end", xMm: 5000, zMm: 0 }, updatedAt).kind).toBe("accepted");
	});

	it("retains a translated vertical fragment while repairing its length without changing the room", () => {
		const source = openRoomWithExtendedBottom(1);
		const rotated: Project = { ...source, level: { ...source.level, vertices: source.level.vertices.map(vertex => ({ ...vertex, xMm: 2000 - vertex.zMm, zMm: 1000 + vertex.xMm })) } };
		const closed = addGeneralWallToProject(rotated, { start: { xMm: 2000, zMm: 5000 }, end: { xMm: -1000, zMm: 5000 }, thicknessMm: 100 }, ids(), updatedAt);
		expect(closed.kind).toBe("accepted");
		if (closed.kind !== "accepted") return;
		const repaired = moveGeneralVertex(closed.project, { vertexId: "tail-end", xMm: 2000, zMm: 5002 }, updatedAt);
		expect(repaired.kind).toBe("accepted");
		if (repaired.kind !== "accepted") return;
		expect(repaired.project.level.rooms).toEqual(closed.project.level.rooms);
		expect(repaired.project.level.vertices).toContainEqual({ vertexId: "tail-end", xMm: 2000, zMm: 5002 });
	});

	it.each([[1, 2], [99, 100], [100, 101]])("allows an exact fragment repair from %i to %i mm", (beforeMm, afterMm) => {
		const source = closeRoom(beforeMm);
		const result = moveGeneralVertex(source, { vertexId: "tail-end", xMm: 4000 + afterMm, zMm: 0 }, updatedAt);
		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.vertices).toContainEqual({ vertexId: "tail-end", xMm: 4000 + afterMm, zMm: 0 });
	});

	it.each([[100, 99], [101, 100], [1, 0]])("rejects explicitly shortening a %i-mm wall to %i mm without mutation", (beforeMm, afterMm) => {
		const source = closeRoom(beforeMm);
		const before = JSON.stringify(source);
		const result = moveGeneralVertex(source, { vertexId: "tail-end", xMm: 4000 + afterMm, zMm: 0 }, updatedAt);
		expect(result.kind).toBe("rejected");
		expect(JSON.stringify(source)).toBe(before);
	});

	it("allows reducing a retained fragment's thickness and rejects thickening it", () => {
		const source = closeRoom(100);
		const before = JSON.stringify(source);
		const wallSegmentId = tailOf(source).wallSegmentId;
		expect(changeGeneralWallThickness(source, { wallSegmentId, thicknessMm: 99 }, updatedAt).kind).toBe("accepted");
		expect(changeGeneralWallThickness(source, { wallSegmentId, thicknessMm: 101 }, updatedAt)).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects an explicit split that would author a new short tail before allocating IDs", () => {
		const source = openRoomWithExtendedBottom(1);
		const before = JSON.stringify(source);
		expect(splitGeneralWall(source, { wallSegmentId: "bottom", positionMm: 4000 }, { next: () => { throw new Error("A rejected split must not allocate"); } }, updatedAt)).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("retains the exact room and dangling fragment through validated local-file roundtrip", async () => {
		const source = { ...closeRoom(1), name: "Room with a retained wall" };
		const checksum = async (value: string) => `test-checksum-${value.length}`;
		const encoded = await encodeLocalProjectJson(source, checksum);
		const decoded = await decodeLocalProjectJson(Uint8Array.from(encoded, character => character.charCodeAt(0)), checksum);
		expect(decoded).toEqual({ kind: "accepted", project: source });
	});

	it.each([1, 99, 100])("still rejects a newly authored %i-mm wall before allocating", (lengthMm) => {
		const result = addWallSegment({ vertices: [], wallSegments: [] }, {
			start: { xMm: 0, zMm: 0 }, end: { xMm: lengthMm, zMm: 0 }, thicknessMm: 100,
		}, { next: () => { throw new Error("Rejected wall must not allocate"); } });
		expect(result).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
	});
});
