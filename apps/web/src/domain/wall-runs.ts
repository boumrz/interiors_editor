import type { PlanGraph } from "./derive-plan-faces";
import type { Vertex, WallSegment } from "./project";

export interface UninterruptedWallRun {
	readonly startVertexId: string;
	readonly endVertexId: string;
	readonly wallSegmentIds: readonly string[];
}

function wallRunIndex(graph: PlanGraph) {
	const vertices = new Map(
		graph.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const incident = new Map<string, WallSegment[]>();
	for (const wall of graph.wallSegments) {
		for (const vertexId of [wall.startVertexId, wall.endVertexId]) {
			const walls = incident.get(vertexId) ?? [];
			walls.push(wall);
			incident.set(vertexId, walls);
		}
	}
	return { vertices, incident };
}

function traceWallRun(
	{ vertices, incident }: ReturnType<typeof wallRunIndex>,
	selected: WallSegment,
	visited: Set<string>,
): UninterruptedWallRun | undefined {
	visited.add(selected.wallSegmentId);
	function follow(vertexId: string) {
		const wallSegmentIds: string[] = [];
		let previous = selected;
		let endVertexId = vertexId;
		while (true) {
			const joint = vertices.get(endVertexId);
			const walls = incident.get(endVertexId);
			if (!joint || walls?.length !== 2) break;
			const next = walls.find(
				(wall) => wall.wallSegmentId !== previous.wallSegmentId,
			);
			if (
				!next ||
				visited.has(next.wallSegmentId) ||
				next.thicknessMm !== previous.thicknessMm
			)
				break;
			const other = vertices.get(otherEndpoint(previous, endVertexId) ?? "");
			const nextVertex = vertices.get(otherEndpoint(next, endVertexId) ?? "");
			if (
				!other ||
				!nextVertex ||
				!verticesAreCollinear(other, joint, nextVertex)
			)
				break;
			visited.add(next.wallSegmentId);
			wallSegmentIds.push(next.wallSegmentId);
			endVertexId = nextVertex.vertexId;
			previous = next;
		}
		return { endVertexId, wallSegmentIds };
	}
	const before = follow(selected.startVertexId);
	const after = follow(selected.endVertexId);
	const start = vertices.get(before.endVertexId);
	const end = vertices.get(after.endVertexId);
	if (!start || !end) return undefined;
	const wallSegmentIds = [
		...before.wallSegmentIds.reverse(),
		selected.wallSegmentId,
		...after.wallSegmentIds,
	];
	return start.xMm < end.xMm || (start.xMm === end.xMm && start.zMm < end.zMm)
		? {
				startVertexId: start.vertexId,
				endVertexId: end.vertexId,
				wallSegmentIds,
			}
		: {
				startVertexId: end.vertexId,
				endVertexId: start.vertexId,
				wallSegmentIds: wallSegmentIds.reverse(),
			};
}

export function uninterruptedWallRunForGraph(
	graph: PlanGraph,
	wallSegmentId: string,
): UninterruptedWallRun | undefined {
	const wall = graph.wallSegments.find(
		(candidate) => candidate.wallSegmentId === wallSegmentId,
	);
	return wall ? traceWallRun(wallRunIndex(graph), wall, new Set()) : undefined;
}

/** Indexes the graph once and visits each edge of each run once. */
export function uninterruptedWallRuns(
	graph: PlanGraph,
): readonly UninterruptedWallRun[] {
	const index = wallRunIndex(graph);
	const visited = new Set<string>();
	const runs: UninterruptedWallRun[] = [];
	for (const wall of graph.wallSegments) {
		if (visited.has(wall.wallSegmentId)) continue;
		const run = traceWallRun(index, wall, visited);
		if (run) runs.push(run);
	}
	return runs;
}

export function otherEndpoint(
	wall: WallSegment,
	vertexId: string,
): string | undefined {
	if (wall.startVertexId === vertexId) return wall.endVertexId;
	if (wall.endVertexId === vertexId) return wall.startVertexId;
	return undefined;
}

export function verticesAreCollinear(
	first: Vertex,
	joined: Vertex,
	second: Vertex,
): boolean {
	const firstX = BigInt(first.xMm - joined.xMm);
	const firstZ = BigInt(first.zMm - joined.zMm);
	const secondX = BigInt(second.xMm - joined.xMm);
	const secondZ = BigInt(second.zMm - joined.zMm);
	return (
		firstX * secondZ === firstZ * secondX &&
		firstX * secondX + firstZ * secondZ < 0n
	);
}
