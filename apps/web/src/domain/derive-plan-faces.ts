import {
	exactMeasurement,
	type ExactMeasurement,
} from "./exact-quadratic-surd";
import type { Vertex, WallSegment } from "./project";

export interface PlanGraph {
	readonly vertices: readonly Vertex[];
	readonly wallSegments: readonly WallSegment[];
}

export interface PlanFacePoint {
	readonly xMm: number;
	readonly zMm: number;
}

/**
 * A disposable, canonical-coordinate description of one bounded face. It is
 * not persisted as a second geometry source: future commands reconcile Room
 * metadata against its fingerprint after deriving it from the PlanGraph.
 */
export interface DerivedOrthogonalFace {
	/** Exact centerline area, including half-square-millimetre faces. */
	readonly areaMm2: ExactMeasurement;
	readonly boundaryWallSegmentIds: readonly string[];
	readonly fingerprint: string;
	readonly vertices: readonly PlanFacePoint[];
}

export type DerivePlanFacesResult =
	| {
			readonly kind: "accepted";
			readonly faces: readonly DerivedOrthogonalFace[];
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "AMBIGUOUS_BOUNDED_WALK"
				| "DEGENERATE_WALL"
				| "NON_ORTHOGONAL_WALL"
				| "UNRESOLVED_WALL_REFERENCE";
	  };

type RejectedDerivePlanFacesResult = Extract<
	DerivePlanFacesResult,
	{ readonly kind: "rejected" }
>;

type ResolvedWallsResult =
	| { readonly kind: "accepted"; readonly walls: readonly ResolvedWall[] }
	| RejectedDerivePlanFacesResult;

type FaceCyclesResult =
	| { readonly kind: "accepted"; readonly cycles: readonly FaceCycle[] }
	| RejectedDerivePlanFacesResult;

type DerivedFaceResult =
	| { readonly kind: "accepted"; readonly face: DerivedOrthogonalFace }
	| RejectedDerivePlanFacesResult;

/** Clockwise octilinear directions in the canonical x/z coordinate space. */
type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface ResolvedWall {
	readonly direction: Direction;
	readonly end: Vertex;
	readonly start: Vertex;
	readonly wallSegmentId: string;
}

interface HalfEdge {
	readonly direction: Direction;
	readonly endVertexId: string;
	readonly id: string;
	readonly startVertexId: string;
	readonly wallSegmentId: string;
}

interface FaceCycle {
	readonly boundaryWallSegmentIds: readonly string[];
	readonly points: readonly PlanFacePoint[];
	readonly twiceAreaMm2: bigint;
}

/**
 * Derives bounded, simple, axis-aligned PlanGraph faces by walking the left
 * side of every directed edge. The unbounded exterior traversals have a
 * negative signed area and are intentionally omitted.
 */
export function deriveBoundedOrthogonalFaces(
	graph: PlanGraph,
): DerivePlanFacesResult {
	const vertexById = indexVertices(graph.vertices);
	if (!vertexById) {
		return reject("AMBIGUOUS_BOUNDED_WALK");
	}
	const walls = resolveWalls(graph.wallSegments, vertexById);
	if (walls.kind === "rejected") {
		return walls;
	}
	if (!hasUniqueCoordinates(vertexById)) {
		return reject("AMBIGUOUS_BOUNDED_WALK");
	}
	if (!hasNormalizedContacts(walls.walls, vertexById)) {
		return reject("AMBIGUOUS_BOUNDED_WALK");
	}

	// A bridge has the same face on both of its sides. It must remain in the
	// canonical PlanGraph, but cannot contribute a bounded face boundary.
	// The half-edge walk accepts every alpha octilinear boundary and returns
	// its exact ring; downstream Room projections choose only shapes they can
	// safely materialize instead of fabricating a rectangular approximation.
	const nonBridgeWalls = withoutGraphBridges(walls.walls);
	const halfEdges = halfEdgesFor(nonBridgeWalls);
	const outgoingByVertex = indexOutgoingHalfEdges(halfEdges);
	const cycles = walkFaceCycles(halfEdges, outgoingByVertex, vertexById);
	if (cycles.kind === "rejected") {
		return cycles;
	}
	const bounded = cycles.cycles.filter((cycle) => cycle.twiceAreaMm2 > 0n);
	if (!areNonAmbiguousBoundedFaces(bounded)) {
		return reject("AMBIGUOUS_BOUNDED_WALK");
	}

	const faces: DerivedOrthogonalFace[] = [];
	for (const cycle of bounded) {
		const face = faceForCycle(cycle);
		if (face.kind === "rejected") {
			return face;
		}
		faces.push(face.face);
	}
	faces.sort((first, second) =>
		compareText(first.fingerprint, second.fingerprint),
	);
	return { faces, kind: "accepted" };
}

function indexVertices(
	vertices: readonly Vertex[],
): ReadonlyMap<string, Vertex> | undefined {
	const vertexById = new Map<string, Vertex>();
	for (const vertex of vertices) {
		if (
			!vertex.vertexId ||
			vertexById.has(vertex.vertexId) ||
			!Number.isSafeInteger(vertex.xMm) ||
			!Number.isSafeInteger(vertex.zMm)
		) {
			return undefined;
		}
		vertexById.set(vertex.vertexId, vertex);
	}
	return vertexById;
}

function resolveWalls(
	wallSegments: readonly WallSegment[],
	vertexById: ReadonlyMap<string, Vertex>,
): ResolvedWallsResult {
	const wallIds = new Set<string>();
	const walls: ResolvedWall[] = [];
	for (const wall of wallSegments) {
		if (!wall.wallSegmentId || wallIds.has(wall.wallSegmentId)) {
			return reject("AMBIGUOUS_BOUNDED_WALK");
		}
		wallIds.add(wall.wallSegmentId);
		const start = vertexById.get(wall.startVertexId);
		const end = vertexById.get(wall.endVertexId);
		if (!start || !end) {
			return reject("UNRESOLVED_WALL_REFERENCE");
		}
		const direction = directionFor(start, end);
		if (direction === undefined) {
			return start.xMm === end.xMm && start.zMm === end.zMm
				? reject("DEGENERATE_WALL")
				: reject("NON_ORTHOGONAL_WALL");
		}
		walls.push({ direction, end, start, wallSegmentId: wall.wallSegmentId });
	}
	return { kind: "accepted", walls };
}

function directionFor(
	start: PlanFacePoint,
	end: PlanFacePoint,
): Direction | undefined {
	if (start.xMm === end.xMm && start.zMm === end.zMm) {
		return undefined;
	}
	if (start.zMm === end.zMm) {
		return end.xMm > start.xMm ? 0 : 4;
	}
	if (start.xMm === end.xMm) {
		return end.zMm > start.zMm ? 2 : 6;
	}
	if (Math.abs(end.xMm - start.xMm) === Math.abs(end.zMm - start.zMm)) {
		if (end.xMm > start.xMm) {
			return end.zMm > start.zMm ? 1 : 7;
		}
		return end.zMm > start.zMm ? 3 : 5;
	}
	return undefined;
}

function hasUniqueCoordinates(
	vertexById: ReadonlyMap<string, Vertex>,
): boolean {
	const coordinates = new Set<string>();
	for (const vertex of vertexById.values()) {
		const key = coordinateKey(vertex.xMm, vertex.zMm);
		if (coordinates.has(key)) {
			return false;
		}
		coordinates.add(key);
	}
	return true;
}

function hasNormalizedContacts(
	walls: readonly ResolvedWall[],
	vertexById: ReadonlyMap<string, Vertex>,
): boolean {
	for (const wall of walls) {
		for (const vertex of vertexById.values()) {
			if (
				vertex.vertexId !== wall.start.vertexId &&
				vertex.vertexId !== wall.end.vertexId &&
				liesInWallInterior(vertex, wall)
			) {
				return false;
			}
		}
	}
	for (let firstIndex = 0; firstIndex < walls.length; firstIndex += 1) {
		const first = walls[firstIndex];
		if (!first) {
			continue;
		}
		for (
			let secondIndex = firstIndex + 1;
			secondIndex < walls.length;
			secondIndex += 1
		) {
			const second = walls[secondIndex];
			if (!second || !hasNormalizedPairContact(first, second)) {
				return false;
			}
		}
	}
	return true;
}

function hasNormalizedPairContact(
	first: ResolvedWall,
	second: ResolvedWall,
): boolean {
	if (areCollinearOverlapping(first, second)) {
		return false;
	}
	if (!segmentsIntersect(first, second)) {
		return true;
	}
	return [first.start, first.end].some((firstEndpoint) =>
		[second.start, second.end].some(
			(secondEndpoint) =>
				firstEndpoint.vertexId === secondEndpoint.vertexId &&
				firstEndpoint.xMm === secondEndpoint.xMm &&
				firstEndpoint.zMm === secondEndpoint.zMm,
		),
	);
}

function areCollinearOverlapping(
	first: ResolvedWall,
	second: ResolvedWall,
): boolean {
	if (
		orientation(first.start, first.end, second.start) !== 0n ||
		orientation(first.start, first.end, second.end) !== 0n
	) {
		return false;
	}
	const useX = first.start.xMm !== first.end.xMm;
	return intervalsOverlapBeyondEndpoint(
		useX ? first.start.xMm : first.start.zMm,
		useX ? first.end.xMm : first.end.zMm,
		useX ? second.start.xMm : second.start.zMm,
		useX ? second.end.xMm : second.end.zMm,
	);
}

function intervalsOverlapBeyondEndpoint(
	firstStart: number,
	firstEnd: number,
	secondStart: number,
	secondEnd: number,
): boolean {
	return (
		Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd)) <
		Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd))
	);
}

function liesInWallInterior(point: PlanFacePoint, wall: ResolvedWall): boolean {
	return (
		liesOnWall(point, wall) && endpointVertexIdAt(wall, point) === undefined
	);
}

function liesOnWall(point: PlanFacePoint, wall: ResolvedWall): boolean {
	return (
		orientation(wall.start, wall.end, point) === 0n &&
		liesWithin(point.xMm, wall.start.xMm, wall.end.xMm) &&
		liesWithin(point.zMm, wall.start.zMm, wall.end.zMm)
	);
}

function liesWithin(value: number, first: number, second: number): boolean {
	return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function endpointVertexIdAt(
	wall: ResolvedWall,
	point: PlanFacePoint,
): string | undefined {
	if (wall.start.xMm === point.xMm && wall.start.zMm === point.zMm) {
		return wall.start.vertexId;
	}
	if (wall.end.xMm === point.xMm && wall.end.zMm === point.zMm) {
		return wall.end.vertexId;
	}
	return undefined;
}

function orientation(
	first: PlanFacePoint,
	second: PlanFacePoint,
	third: PlanFacePoint,
): bigint {
	return (
		BigInt(second.xMm - first.xMm) * BigInt(third.zMm - first.zMm) -
		BigInt(second.zMm - first.zMm) * BigInt(third.xMm - first.xMm)
	);
}

function segmentsIntersect(first: ResolvedWall, second: ResolvedWall): boolean {
	const firstStart = orientation(first.start, first.end, second.start);
	const firstEnd = orientation(first.start, first.end, second.end);
	const secondStart = orientation(second.start, second.end, first.start);
	const secondEnd = orientation(second.start, second.end, first.end);
	if (
		(firstStart === 0n && liesOnWall(second.start, first)) ||
		(firstEnd === 0n && liesOnWall(second.end, first)) ||
		(secondStart === 0n && liesOnWall(first.start, second)) ||
		(secondEnd === 0n && liesOnWall(first.end, second))
	) {
		return true;
	}
	return (
		firstStart > 0n !== firstEnd > 0n && secondStart > 0n !== secondEnd > 0n
	);
}

function halfEdgesFor(walls: readonly ResolvedWall[]): readonly HalfEdge[] {
	return walls
		.flatMap((wall) => [
			{
				direction: wall.direction,
				endVertexId: wall.end.vertexId,
				id: `${wall.wallSegmentId}:forward`,
				startVertexId: wall.start.vertexId,
				wallSegmentId: wall.wallSegmentId,
			},
			{
				direction: oppositeDirection(wall.direction),
				endVertexId: wall.start.vertexId,
				id: `${wall.wallSegmentId}:reverse`,
				startVertexId: wall.end.vertexId,
				wallSegmentId: wall.wallSegmentId,
			},
		])
		.sort((first, second) => compareText(first.id, second.id));
}

function withoutGraphBridges(
	walls: readonly ResolvedWall[],
): readonly ResolvedWall[] {
	const adjacency = new Map<
		string,
		Array<{
			readonly neighbourVertexId: string;
			readonly wallSegmentId: string;
		}>
	>();
	for (const wall of walls) {
		const startAdjacency = adjacency.get(wall.start.vertexId) ?? [];
		startAdjacency.push({
			neighbourVertexId: wall.end.vertexId,
			wallSegmentId: wall.wallSegmentId,
		});
		adjacency.set(wall.start.vertexId, startAdjacency);

		const endAdjacency = adjacency.get(wall.end.vertexId) ?? [];
		endAdjacency.push({
			neighbourVertexId: wall.start.vertexId,
			wallSegmentId: wall.wallSegmentId,
		});
		adjacency.set(wall.end.vertexId, endAdjacency);
	}

	let visitIndex = 0;
	const discoveryByVertex = new Map<string, number>();
	const lowestReachableByVertex = new Map<string, number>();
	const bridgeWallIds = new Set<string>();

	const visit = (
		vertexId: string,
		parentWallSegmentId: string | undefined,
	): void => {
		visitIndex += 1;
		discoveryByVertex.set(vertexId, visitIndex);
		lowestReachableByVertex.set(vertexId, visitIndex);
		for (const connection of adjacency.get(vertexId) ?? []) {
			if (connection.wallSegmentId === parentWallSegmentId) {
				continue;
			}
			const neighbourDiscovery = discoveryByVertex.get(
				connection.neighbourVertexId,
			);
			if (neighbourDiscovery === undefined) {
				visit(connection.neighbourVertexId, connection.wallSegmentId);
				const neighbourLowest = lowestReachableByVertex.get(
					connection.neighbourVertexId,
				);
				const vertexDiscovery = discoveryByVertex.get(vertexId);
				const vertexLowest = lowestReachableByVertex.get(vertexId);
				if (
					neighbourLowest === undefined ||
					vertexDiscovery === undefined ||
					vertexLowest === undefined
				) {
					continue;
				}
				lowestReachableByVertex.set(
					vertexId,
					Math.min(vertexLowest, neighbourLowest),
				);
				if (neighbourLowest > vertexDiscovery) {
					bridgeWallIds.add(connection.wallSegmentId);
				}
				continue;
			}
			const vertexLowest = lowestReachableByVertex.get(vertexId);
			if (vertexLowest !== undefined) {
				lowestReachableByVertex.set(
					vertexId,
					Math.min(vertexLowest, neighbourDiscovery),
				);
			}
		}
	};

	for (const vertexId of adjacency.keys()) {
		if (discoveryByVertex.get(vertexId) === undefined) {
			visit(vertexId, undefined);
		}
	}
	return walls.filter((wall) => !bridgeWallIds.has(wall.wallSegmentId));
}

function oppositeDirection(direction: Direction): Direction {
	return ((direction + 4) % 8) as Direction;
}

function indexOutgoingHalfEdges(
	halfEdges: readonly HalfEdge[],
): ReadonlyMap<string, readonly HalfEdge[]> {
	const outgoing = new Map<string, HalfEdge[]>();
	for (const halfEdge of halfEdges) {
		const atVertex = outgoing.get(halfEdge.startVertexId) ?? [];
		atVertex.push(halfEdge);
		outgoing.set(halfEdge.startVertexId, atVertex);
	}
	for (const atVertex of outgoing.values()) {
		atVertex.sort(
			(first, second) =>
				first.direction - second.direction || compareText(first.id, second.id),
		);
	}
	return outgoing;
}

function walkFaceCycles(
	halfEdges: readonly HalfEdge[],
	outgoingByVertex: ReadonlyMap<string, readonly HalfEdge[]>,
	vertexById: ReadonlyMap<string, Vertex>,
): FaceCyclesResult {
	const visited = new Set<string>();
	const cycles: FaceCycle[] = [];
	for (const initial of halfEdges) {
		if (visited.has(initial.id)) {
			continue;
		}
		const local = new Set<string>();
		const cycle: HalfEdge[] = [];
		let current: HalfEdge | undefined = initial;
		while (current) {
			if (local.has(current.id)) {
				if (current.id !== initial.id) {
					return reject("AMBIGUOUS_BOUNDED_WALK");
				}
				break;
			}
			local.add(current.id);
			visited.add(current.id);
			cycle.push(current);
			current = nextHalfEdge(current, outgoingByVertex);
			if (cycle.length > halfEdges.length) {
				return reject("AMBIGUOUS_BOUNDED_WALK");
			}
		}
		if (!current) {
			return reject("AMBIGUOUS_BOUNDED_WALK");
		}
		const ring: Vertex[] = [];
		for (const halfEdge of cycle) {
			const vertex = vertexById.get(halfEdge.startVertexId);
			if (!vertex) {
				return reject("UNRESOLVED_WALL_REFERENCE");
			}
			ring.push(vertex);
		}
		const twiceAreaMm2 = twiceArea(ring);
		if (twiceAreaMm2 === 0n) {
			if (isSimplePotentialRing(cycle, ring)) {
				return reject("DEGENERATE_WALL");
			}
			continue;
		}
		if (twiceAreaMm2 < 0n) {
			continue;
		}
		if (!isSimplePotentialRing(cycle, ring)) {
			return reject("AMBIGUOUS_BOUNDED_WALK");
		}
		cycles.push({
			boundaryWallSegmentIds: cycle.map((halfEdge) => halfEdge.wallSegmentId),
			points: ring.map((vertex) => ({ xMm: vertex.xMm, zMm: vertex.zMm })),
			twiceAreaMm2,
		});
	}
	return { cycles, kind: "accepted" };
}

function nextHalfEdge(
	halfEdge: HalfEdge,
	outgoingByVertex: ReadonlyMap<string, readonly HalfEdge[]>,
): HalfEdge | undefined {
	const outgoing = outgoingByVertex.get(halfEdge.endVertexId);
	if (!outgoing) {
		return undefined;
	}
	const reverseDirection = oppositeDirection(halfEdge.direction);
	const reverseIndex = outgoing.findIndex(
		(candidate) =>
			candidate.direction === reverseDirection &&
			candidate.endVertexId === halfEdge.startVertexId,
	);
	if (reverseIndex < 0) {
		return undefined;
	}
	return outgoing[(reverseIndex - 1 + outgoing.length) % outgoing.length];
}

function twiceArea(points: readonly PlanFacePoint[]): bigint {
	let result = 0n;
	for (let index = 0; index < points.length; index += 1) {
		const current = points[index];
		const next = points[(index + 1) % points.length];
		if (!current || !next) {
			return 0n;
		}
		result +=
			BigInt(current.xMm) * BigInt(next.zMm) -
			BigInt(next.xMm) * BigInt(current.zMm);
	}
	return result;
}

function isSimplePotentialRing(
	cycle: readonly HalfEdge[],
	points: readonly PlanFacePoint[],
): boolean {
	return (
		cycle.length >= 3 &&
		new Set(cycle.map((halfEdge) => halfEdge.wallSegmentId)).size ===
			cycle.length &&
		new Set(points.map((point) => coordinateKey(point.xMm, point.zMm))).size ===
			points.length
	);
}

function areNonAmbiguousBoundedFaces(cycles: readonly FaceCycle[]): boolean {
	for (let firstIndex = 0; firstIndex < cycles.length; firstIndex += 1) {
		const first = cycles[firstIndex];
		if (!first) {
			continue;
		}
		for (
			let secondIndex = firstIndex + 1;
			secondIndex < cycles.length;
			secondIndex += 1
		) {
			const second = cycles[secondIndex];
			if (!second) {
				continue;
			}
			const sharedWall = first.boundaryWallSegmentIds.some((wallSegmentId) =>
				second.boundaryWallSegmentIds.includes(wallSegmentId),
			);
			const sharedVertices = first.points.filter((firstPoint) =>
				second.points.some(
					(secondPoint) =>
						firstPoint.xMm === secondPoint.xMm &&
						firstPoint.zMm === secondPoint.zMm,
				),
			);
			// Non-neighbouring rooms may meet at a junction when intervening rooms
			// connect them through incident walls. The number of occupied sectors
			// is not fixed: a three-room corner is as valid as a four-cell grid.
			// Separate rings touching only at a vertex remain ambiguous.
			if (
				sharedVertices.length > 0 &&
				!sharedWall &&
				!sharedVertices.every((vertex) =>
					areFacesConnectedAtVertex(first, second, cycles, vertex),
				)
			) {
				return false;
			}
			if (
				!sharedWall &&
				(ringContainsInteriorProbe(first.points, second.points) ||
					ringContainsInteriorProbe(second.points, first.points))
			) {
				return false;
			}
		}
	}
	return true;
}

function areFacesConnectedAtVertex(
	first: FaceCycle,
	second: FaceCycle,
	cycles: readonly FaceCycle[],
	vertex: PlanFacePoint,
): boolean {
	const incident = cycles.map((cycle) => {
		const index = cycle.points.findIndex(
			(point) => point.xMm === vertex.xMm && point.zMm === vertex.zMm,
		);
		return {
			cycle,
			walls: cycle.boundaryWallSegmentIds.filter(
				(_, wallIndex) =>
					wallIndex === index ||
					(wallIndex + 1) % cycle.points.length === index,
			),
		};
	});
	const reached = new Set<FaceCycle>([first]);
	const pending = [first];
	for (const current of pending) {
		const walls = incident.find((entry) => entry.cycle === current)?.walls ?? [];
		for (const candidate of incident) {
			if (
				reached.has(candidate.cycle) ||
				!candidate.walls.some((wall) => walls.includes(wall))
			)
				continue;
			if (candidate.cycle === second) return true;
			reached.add(candidate.cycle);
			pending.push(candidate.cycle);
		}
	}
	return false;
}

function ringContainsInteriorProbe(
	container: readonly PlanFacePoint[],
	candidate: readonly PlanFacePoint[],
): boolean {
	const probe = interiorProbe(candidate);
	if (!probe) {
		return false;
	}
	let winding = 0;
	for (let index = 0; index < container.length; index += 1) {
		const first = container[index];
		const second = container[(index + 1) % container.length];
		if (!first || !second) {
			return false;
		}
		const firstX2 = BigInt(first.xMm) * 2n;
		const firstZ2 = BigInt(first.zMm) * 2n;
		const secondX2 = BigInt(second.xMm) * 2n;
		const secondZ2 = BigInt(second.zMm) * 2n;
		const cross =
			(secondX2 - firstX2) * (probe.z2 - firstZ2) -
			(secondZ2 - firstZ2) * (probe.x2 - firstX2);
		if (
			cross === 0n &&
			liesWithinBigInt(probe.x2, firstX2, secondX2) &&
			liesWithinBigInt(probe.z2, firstZ2, secondZ2)
		) {
			return true;
		}
		if (firstZ2 <= probe.z2 && secondZ2 > probe.z2 && cross > 0n) {
			winding += 1;
		} else if (firstZ2 > probe.z2 && secondZ2 <= probe.z2 && cross < 0n) {
			winding -= 1;
		}
	}
	return winding !== 0;
}

function interiorProbe(
	points: readonly PlanFacePoint[],
): { readonly x2: bigint; readonly z2: bigint } | undefined {
	const first = points[0];
	const second = points[1];
	if (!first || !second) {
		return undefined;
	}
	const direction = directionFor(first, second);
	if (direction === undefined) {
		return undefined;
	}
	const directionX =
		second.xMm === first.xMm ? 0 : Math.sign(second.xMm - first.xMm);
	const directionZ =
		second.zMm === first.zMm ? 0 : Math.sign(second.zMm - first.zMm);
	return {
		x2: BigInt(first.xMm) + BigInt(second.xMm) - BigInt(directionZ),
		z2: BigInt(first.zMm) + BigInt(second.zMm) + BigInt(directionX),
	};
}

function faceForCycle(cycle: FaceCycle): DerivedFaceResult {
	const vertices = normalizeRing(cycle.points);
	if (vertices.length < 3) {
		return reject("DEGENERATE_WALL");
	}
	return {
		face: {
			areaMm2: exactMeasurement(cycle.twiceAreaMm2, 0n, 2n),
			boundaryWallSegmentIds: [...new Set(cycle.boundaryWallSegmentIds)].sort(
				compareText,
			),
			fingerprint: `orthogonal-face:${vertices.map((vertex) => coordinateKey(vertex.xMm, vertex.zMm)).join("|")}`,
			vertices,
		},
		kind: "accepted",
	};
}

function normalizeRing(
	points: readonly PlanFacePoint[],
): readonly PlanFacePoint[] {
	const simplified = [...points];
	let removed = true;
	while (removed && simplified.length >= 3) {
		removed = false;
		for (let index = 0; index < simplified.length; index += 1) {
			const previous =
				simplified[(index - 1 + simplified.length) % simplified.length];
			const current = simplified[index];
			const next = simplified[(index + 1) % simplified.length];
			if (
				previous &&
				current &&
				next &&
				isIntermediateCollinearPoint(previous, current, next)
			) {
				simplified.splice(index, 1);
				removed = true;
				break;
			}
		}
	}
	return canonicalRing(simplified);
}

function isIntermediateCollinearPoint(
	first: PlanFacePoint,
	second: PlanFacePoint,
	third: PlanFacePoint,
): boolean {
	const firstX = BigInt(first.xMm);
	const firstZ = BigInt(first.zMm);
	const secondX = BigInt(second.xMm);
	const secondZ = BigInt(second.zMm);
	const thirdX = BigInt(third.xMm);
	const thirdZ = BigInt(third.zMm);
	return (
		(secondX - firstX) * (thirdZ - firstZ) ===
			(secondZ - firstZ) * (thirdX - firstX) &&
		liesWithinBigInt(secondX, firstX, thirdX) &&
		liesWithinBigInt(secondZ, firstZ, thirdZ)
	);
}

function liesWithinBigInt(
	value: bigint,
	first: bigint,
	second: bigint,
): boolean {
	return first <= second
		? value >= first && value <= second
		: value >= second && value <= first;
}

function canonicalRing(
	points: readonly PlanFacePoint[],
): readonly PlanFacePoint[] {
	const candidates: PlanFacePoint[][] = [];
	for (const direction of [points, [...points].reverse()]) {
		for (let index = 0; index < direction.length; index += 1) {
			candidates.push([
				...direction.slice(index),
				...direction.slice(0, index),
			]);
		}
	}
	return candidates.reduce(
		(best, candidate) =>
			comparePointSequences(candidate, best) < 0 ? candidate : best,
		candidates[0] ?? [],
	);
}

function comparePointSequences(
	first: readonly PlanFacePoint[],
	second: readonly PlanFacePoint[],
): number {
	for (let index = 0; index < first.length; index += 1) {
		const firstPoint = first[index];
		const secondPoint = second[index];
		if (!firstPoint || !secondPoint) {
			return 0;
		}
		if (firstPoint.xMm !== secondPoint.xMm) {
			return firstPoint.xMm - secondPoint.xMm;
		}
		if (firstPoint.zMm !== secondPoint.zMm) {
			return firstPoint.zMm - secondPoint.zMm;
		}
	}
	return 0;
}

function coordinateKey(xMm: number, zMm: number): string {
	return `${xMm}:${zMm}`;
}

function compareText(first: string, second: string): number {
	return first < second ? -1 : first > second ? 1 : 0;
}

function reject(
	reasonCode: RejectedDerivePlanFacesResult["reasonCode"],
): RejectedDerivePlanFacesResult {
	return { kind: "rejected", reasonCode };
}
