import {
	deriveBoundedOrthogonalFaces,
	type PlanGraph,
} from "./derive-plan-faces";
import type { Vertex, WallSegment } from "./project";

const PROJECT_COORDINATE_LIMIT_MM = 100_000;

export interface PlanPoint {
	readonly xMm: number;
	readonly zMm: number;
}

interface PlanSegment {
	readonly end: PlanPoint;
	readonly start: PlanPoint;
}

export interface AddWallSegmentInput {
	readonly end: PlanPoint;
	/** Existing walls with hosted geometry must retain their stable segment ID. */
	readonly nonMergeableWallSegmentIds?: readonly string[];
	readonly start: PlanPoint;
	readonly thicknessMm: number;
}

interface IdSource {
	next(): string;
}

interface ResolvedWall {
	readonly end: Vertex;
	readonly start: Vertex;
	readonly wall: WallSegment;
}

interface PlannedExistingWall {
	readonly points: readonly PlanPoint[];
	readonly resolved: ResolvedWall;
}

interface PlannedTopology {
	readonly candidatePoints: readonly PlanPoint[];
	readonly existingWalls: readonly PlannedExistingWall[];
	readonly newVertices: readonly PlanPoint[];
}

interface ValidatedCandidate {
	readonly end: PlanPoint;
	readonly kind: "accepted";
	readonly start: PlanPoint;
	readonly thicknessMm: number;
}

export type AddWallSegmentResult =
	| { readonly kind: "accepted"; readonly graph: PlanGraph }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "COLLINEAR_OVERLAP"
				| "DIAGONAL_WALL_CONTACT_UNSUPPORTED"
				| "INVALID_DIMENSION"
				| "INVALID_PLAN_GRAPH"
				| "PROJECT_BOUNDS_EXCEEDED"
				| "TOO_SHORT_WALL"
				| "UNSUPPORTED_DIRECTION"
				| "ZERO_LENGTH";
	  };

/**
 * Allocation-free topology normalization precedes ID materialization. Exact
 * T and X contacts become one shared vertex; every touched wall is split into
 * consecutive non-zero pieces before the result may become a Project command.
 *
 * It preserves exact integer coordinates (including off-grid numeric input);
 * the gesture snap belongs to the UI, not this domain command. A diagonal
 * contact is permitted when its intersection is an exact integer-mm shared
 * vertex; contacts which would need fractional coordinates remain rejected.
 */
export function addWallSegment(
	graph: PlanGraph,
	input: AddWallSegmentInput,
	ids: IdSource,
): AddWallSegmentResult {
	const candidate = validateCandidate(input);
	if (candidate.kind === "rejected") {
		return candidate;
	}
	const existing = resolveExistingGraph(graph);
	if (!existing || deriveBoundedOrthogonalFaces(graph).kind === "rejected") {
		return reject("INVALID_PLAN_GRAPH");
	}
	if (
		isDiagonal(candidate) &&
		existing.some((wall) => hasUnsupportedDiagonalContact(candidate, wall))
	) {
		return reject("DIAGONAL_WALL_CONTACT_UNSUPPORTED");
	}
	if (segmentLength(candidate.start, candidate.end) <= candidate.thicknessMm) {
		return reject("TOO_SHORT_WALL");
	}
	if (existing.some((wall) => hasPositiveCollinearOverlap(candidate, wall))) {
		return reject("COLLINEAR_OVERLAP");
	}

	const contacts = collectCandidateContacts(
		candidate,
		existing,
		graph.vertices,
	);
	const candidatePoints = sortedPointsOnSegment(
		candidate,
		contacts.values(),
	);
	if (!hasUsablePieces(candidatePoints, candidate.thicknessMm)) {
		return reject("TOO_SHORT_WALL");
	}
	const existingWalls: PlannedExistingWall[] = [];
	for (const resolved of existing) {
		const points = sortedPointsOnSegment(resolved, contacts.values());
		if (!hasUsablePieces(points, resolved.wall.thicknessMm)) {
			return reject("TOO_SHORT_WALL");
		}
		existingWalls.push({ points, resolved });
	}
	const existingCoordinates = new Set(
		graph.vertices.map((vertex) => pointKey(vertex)),
	);
	const newVertices = [...contacts.values()]
		.filter((point) => !existingCoordinates.has(pointKey(point)))
		.sort(comparePoint);
	const planned: PlannedTopology = {
		candidatePoints,
		existingWalls,
		newVertices,
	};
	const preview = temporaryGraph(
		graph,
		candidate.thicknessMm,
		planned,
	);
	if (!preview || deriveBoundedOrthogonalFaces(preview).kind === "rejected") {
		return reject("INVALID_PLAN_GRAPH");
	}
	const materialized = materializeGraph(
		graph,
		candidate.thicknessMm,
		planned,
		ids,
	);
	if (!materialized) {
		return reject("INVALID_PLAN_GRAPH");
	}
	return {
		graph: mergeContiguousCollinearWalls(
			materialized,
			input.nonMergeableWallSegmentIds ?? [],
		),
		kind: "accepted",
	};
}

function validateCandidate(
	input: AddWallSegmentInput,
): 
	| ValidatedCandidate
	| Extract<AddWallSegmentResult, { readonly kind: "rejected" }> {
	if (!Number.isSafeInteger(input.thicknessMm) || input.thicknessMm <= 0) {
		return reject("INVALID_DIMENSION");
	}
	if (!isInProjectBounds(input.start) || !isInProjectBounds(input.end)) {
		return reject("PROJECT_BOUNDS_EXCEEDED");
	}
	if (input.start.xMm === input.end.xMm && input.start.zMm === input.end.zMm) {
		return reject("ZERO_LENGTH");
	}
	if (!isAllowedDirection(input.start, input.end)) {
		return reject("UNSUPPORTED_DIRECTION");
	}
	if (segmentLength(input.start, input.end) <= 0) {
		return reject("TOO_SHORT_WALL");
	}
	return {
		end: input.end,
		kind: "accepted",
		start: input.start,
		thicknessMm: input.thicknessMm,
	};
}

function resolveExistingGraph(
	graph: PlanGraph,
): readonly ResolvedWall[] | undefined {
	const verticesById = new Map<string, Vertex>();
	const coordinates = new Set<string>();
	for (const vertex of graph.vertices) {
		if (
			!vertex.vertexId ||
			verticesById.has(vertex.vertexId) ||
			!isInProjectBounds(vertex) ||
			coordinates.has(pointKey(vertex))
		) {
			return undefined;
		}
		verticesById.set(vertex.vertexId, vertex);
		coordinates.add(pointKey(vertex));
	}
	const wallIds = new Set<string>();
	const resolved: ResolvedWall[] = [];
	for (const wall of graph.wallSegments) {
		const start = verticesById.get(wall.startVertexId);
		const end = verticesById.get(wall.endVertexId);
		if (
			!wall.wallSegmentId ||
			wallIds.has(wall.wallSegmentId) ||
			!start ||
			!end ||
			!Number.isSafeInteger(wall.thicknessMm) ||
			wall.thicknessMm <= 0 ||
			!isAllowedDirection(start, end) ||
			segmentLength(start, end) <= 0
		) {
			return undefined;
		}
		wallIds.add(wall.wallSegmentId);
		resolved.push({ end, start, wall });
	}
	return resolved;
}

function collectCandidateContacts(
	candidate: PlanSegment,
	existing: readonly ResolvedWall[],
	vertices: readonly Vertex[],
): ReadonlyMap<string, PlanPoint> {
	const contacts = new Map<string, PlanPoint>();
	addContact(contacts, candidate.start);
	addContact(contacts, candidate.end);
	for (const vertex of vertices) {
		if (isStrictlyInsideSegment(vertex, candidate)) {
			addContact(contacts, vertex);
		}
	}
	for (const wall of existing) {
		const intersection = exactSegmentIntersection(candidate, wall);
		if (
			intersection.kind === "integer" &&
			isOnSegment(intersection.point, candidate) &&
			isOnSegment(intersection.point, wall)
		) {
			addContact(contacts, intersection.point);
		}
	}
	return contacts;
}

function temporaryGraph(
	graph: PlanGraph,
	candidateThicknessMm: number,
	planned: PlannedTopology,
): PlanGraph | undefined {
	const usedVertexIds = new Set(
		graph.vertices.map((vertex) => vertex.vertexId),
	);
	const vertexIdsByCoordinate = new Map(
		graph.vertices.map((vertex) => [pointKey(vertex), vertex.vertexId]),
	);
	planned.newVertices.forEach((point, index) => {
		const vertexId = availableTemporaryId(
			"__candidate_vertex_",
			index,
			usedVertexIds,
		);
		usedVertexIds.add(vertexId);
		vertexIdsByCoordinate.set(pointKey(point), vertexId);
	});
	const vertices: Vertex[] = [
		...graph.vertices,
		...planned.newVertices.map((point) => ({
			vertexId: vertexIdsByCoordinate.get(pointKey(point)) ?? "",
			xMm: point.xMm,
			zMm: point.zMm,
		})),
	];
	const usedWallIds = new Set(
		graph.wallSegments.map((wall) => wall.wallSegmentId),
	);
	const wallSegments: WallSegment[] = [];
	for (const { points, resolved } of planned.existingWalls) {
		if (!appendPieces(
			points,
			resolved.wall.thicknessMm,
			(index) =>
				index === 0
					? resolved.wall.wallSegmentId
					: nextTemporaryWallId(usedWallIds),
			vertexIdsByCoordinate,
			wallSegments,
		)) {
			return undefined;
		}
	}
	if (!appendPieces(
		planned.candidatePoints,
		candidateThicknessMm,
		() => nextTemporaryWallId(usedWallIds),
		vertexIdsByCoordinate,
		wallSegments,
	)) {
		return undefined;
	}
	return { vertices, wallSegments };
}

function materializeGraph(
	graph: PlanGraph,
	candidateThicknessMm: number,
	planned: PlannedTopology,
	ids: IdSource,
): PlanGraph | undefined {
	const usedVertexIds = new Set(
		graph.vertices.map((vertex) => vertex.vertexId),
	);
	const usedWallIds = new Set(
		graph.wallSegments.map((wall) => wall.wallSegmentId),
	);
	const vertexIdsByCoordinate = new Map(
		graph.vertices.map((vertex) => [pointKey(vertex), vertex.vertexId]),
	);
	const newVertices: Vertex[] = [];
	for (const point of planned.newVertices) {
		const vertexId = nextMaterializedId(ids, usedVertexIds);
		if (!vertexId) {
			return undefined;
		}
		const vertex: Vertex = {
			vertexId,
			xMm: point.xMm,
			zMm: point.zMm,
		};
		vertexIdsByCoordinate.set(pointKey(point), vertex.vertexId);
		newVertices.push(vertex);
	}
	const wallSegments: WallSegment[] = [];
	for (const { points, resolved } of planned.existingWalls) {
		if (!appendPieces(
			points,
			resolved.wall.thicknessMm,
			(index) =>
				index === 0
					? resolved.wall.wallSegmentId
					: nextMaterializedId(ids, usedWallIds),
			vertexIdsByCoordinate,
			wallSegments,
		)) {
			return undefined;
		}
	}
	if (!appendPieces(
		planned.candidatePoints,
		candidateThicknessMm,
		() => nextMaterializedId(ids, usedWallIds),
		vertexIdsByCoordinate,
		wallSegments,
	)) {
		return undefined;
	}
	return { vertices: [...graph.vertices, ...newVertices], wallSegments };
}

/**
 * A small-screen author can finish one straight wall in several gestures.
 * Two same-thickness segments are one wall only when their shared vertex has
 * degree two: a corner, T or X junction must retain its canonical vertex so
 * derived faces and future wall edits remain unambiguous. Walls hosting an
 * Opening are supplied as protected IDs by the Project command.
 */
function mergeContiguousCollinearWalls(
	graph: PlanGraph,
	nonMergeableWallSegmentIds: readonly string[],
): PlanGraph {
	const protectedWallIds = new Set(nonMergeableWallSegmentIds);
	let normalized = graph;
	while (true) {
		const verticesById = new Map(
			normalized.vertices.map((vertex) => [vertex.vertexId, vertex]),
		);
		const wallsAtVertex = new Map<string, WallSegment[]>();
		for (const wall of normalized.wallSegments) {
			for (const vertexId of [wall.startVertexId, wall.endVertexId]) {
				const atVertex = wallsAtVertex.get(vertexId) ?? [];
				atVertex.push(wall);
				wallsAtVertex.set(vertexId, atVertex);
			}
		}
		const merge = normalized.vertices
			.map((joint) => {
				const pair = wallsAtVertex.get(joint.vertexId);
				if (
					pair?.length !== 2 ||
					protectedWallIds.has(pair[0]?.wallSegmentId ?? "") ||
					protectedWallIds.has(pair[1]?.wallSegmentId ?? "")
				) {
					return undefined;
				}
				const first = pair[0];
				const second = pair[1];
				if (!first || !second || first.thicknessMm !== second.thicknessMm) {
					return undefined;
				}
				const firstOtherId = otherVertexId(first, joint.vertexId);
				const secondOtherId = otherVertexId(second, joint.vertexId);
				const firstOther = firstOtherId
					? verticesById.get(firstOtherId)
					: undefined;
				const secondOther = secondOtherId
					? verticesById.get(secondOtherId)
					: undefined;
				if (
					!firstOtherId ||
					!secondOtherId ||
					firstOtherId === secondOtherId ||
					!firstOther ||
					!secondOther ||
					!areCollinearAtJoint(firstOther, joint, secondOther)
				) {
					return undefined;
				}
				return { first, firstOtherId, joint, second, secondOtherId };
			})
			.find((candidate) => candidate !== undefined);
		if (!merge) {
			return normalized;
		}

		const replacement: WallSegment = {
			endVertexId: merge.secondOtherId,
			startVertexId: merge.firstOtherId,
			thicknessMm: merge.first.thicknessMm,
			// Preserve the earlier segment identity. The new segment can never
			// be a host because an Opening did not exist before this command.
			wallSegmentId: merge.first.wallSegmentId,
		};
		normalized = {
			vertices: normalized.vertices.filter(
				(vertex) => vertex.vertexId !== merge.joint.vertexId,
			),
			wallSegments: normalized.wallSegments.flatMap((wall) => {
				if (wall.wallSegmentId === merge.first.wallSegmentId) {
					return [replacement];
				}
				if (wall.wallSegmentId === merge.second.wallSegmentId) {
					return [];
				}
				return [wall];
			}),
		};
	}
}

function otherVertexId(
	wall: WallSegment,
	vertexId: string,
): string | undefined {
	if (wall.startVertexId === vertexId) return wall.endVertexId;
	if (wall.endVertexId === vertexId) return wall.startVertexId;
	return undefined;
}

function areCollinearAtJoint(
	first: PlanPoint,
	joint: PlanPoint,
	second: PlanPoint,
): boolean {
	return orientation(first, joint, second) === 0n;
}

function appendPieces(
	points: readonly PlanPoint[],
	thicknessMm: number,
	wallIdForIndex: (index: number) => string | undefined,
	vertexIdsByCoordinate: ReadonlyMap<string, string>,
	target: WallSegment[],
): boolean {
	for (let index = 0; index < points.length - 1; index += 1) {
		const start = points[index];
		const end = points[index + 1];
		if (!start || !end) {
			return false;
		}
		const startVertexId = vertexIdsByCoordinate.get(pointKey(start));
		const endVertexId = vertexIdsByCoordinate.get(pointKey(end));
		const wallSegmentId = wallIdForIndex(index);
		if (!startVertexId || !endVertexId || !wallSegmentId) {
			return false;
		}
		target.push({
			endVertexId,
			startVertexId,
			thicknessMm,
			wallSegmentId,
		});
	}
	return true;
}

function sortedPointsOnSegment(
	segment: PlanSegment,
	contacts: Iterable<PlanPoint>,
): readonly PlanPoint[] {
	const pointsByCoordinate = new Map<string, PlanPoint>();
	addContact(pointsByCoordinate, segment.start);
	addContact(pointsByCoordinate, segment.end);
	for (const contact of contacts) {
		if (isOnSegment(contact, segment)) {
			addContact(pointsByCoordinate, contact);
		}
	}
	return [...pointsByCoordinate.values()].sort(
		(first, second) =>
			distanceFromStart(first, segment) - distanceFromStart(second, segment),
	);
}

function hasUsablePieces(
	points: readonly PlanPoint[],
	thicknessMm: number,
): boolean {
	return (
		points.length >= 2 &&
		points.slice(1).every((point, index) => {
			const previous = points[index];
			return previous
				? segmentLength(previous, point) > thicknessMm
				: false;
		})
	);
}

function nextMaterializedId(
	ids: IdSource,
	used: Set<string>,
): string | undefined {
	const id = ids.next();
	if (!id || used.has(id)) {
		return undefined;
	}
	used.add(id);
	return id;
}

function hasPositiveCollinearOverlap(
	candidate: PlanSegment,
	existing: ResolvedWall,
): boolean {
	if (!areCollinear(candidate, existing)) {
		return false;
	}
	if (isVertical(candidate)) {
		return hasPositiveIntervalOverlap(
			candidate.start.zMm,
			candidate.end.zMm,
			existing.start.zMm,
			existing.end.zMm,
		);
	}
	return hasPositiveIntervalOverlap(
		candidate.start.xMm,
		candidate.end.xMm,
		existing.start.xMm,
		existing.end.xMm,
	);
}

function hasPositiveIntervalOverlap(
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

type SegmentIntersection =
	| { readonly kind: "collinear" }
	| { readonly kind: "integer"; readonly point: PlanPoint }
	| { readonly kind: "none" }
	| { readonly kind: "non-integer" };

/**
 * Computes a contact without floating point. A PlanGraph must stay on its
 * integer-millimetre canonical grid, so a crossing at (500.5, 500.5) is not
 * rounded or silently moved: the caller can reject it before allocating IDs.
 */
function exactSegmentIntersection(
	first: PlanSegment,
	second: PlanSegment,
): SegmentIntersection {
	const firstDelta = {
		xMm: BigInt(first.end.xMm - first.start.xMm),
		zMm: BigInt(first.end.zMm - first.start.zMm),
	};
	const secondDelta = {
		xMm: BigInt(second.end.xMm - second.start.xMm),
		zMm: BigInt(second.end.zMm - second.start.zMm),
	};
	const denominator = crossProduct(firstDelta, secondDelta);
	if (denominator === 0n) {
		return areCollinear(first, second) ? { kind: "collinear" } : { kind: "none" };
	}

	const fromFirstToSecond = {
		xMm: BigInt(second.start.xMm - first.start.xMm),
		zMm: BigInt(second.start.zMm - first.start.zMm),
	};
	const firstParameterNumerator = crossProduct(
		fromFirstToSecond,
		secondDelta,
	);
	const secondParameterNumerator = crossProduct(
		fromFirstToSecond,
		firstDelta,
	);
	if (
		!isParameterWithinSegment(firstParameterNumerator, denominator) ||
		!isParameterWithinSegment(secondParameterNumerator, denominator)
	) {
		return { kind: "none" };
	}

	const xNumerator =
		BigInt(first.start.xMm) * denominator +
		firstDelta.xMm * firstParameterNumerator;
	const zNumerator =
		BigInt(first.start.zMm) * denominator +
		firstDelta.zMm * firstParameterNumerator;
	if (xNumerator % denominator !== 0n || zNumerator % denominator !== 0n) {
		return { kind: "non-integer" };
	}
	return {
		kind: "integer",
		point: {
			xMm: Number(xNumerator / denominator),
			zMm: Number(zNumerator / denominator),
		},
	};
}

function crossProduct(
	first: { readonly xMm: bigint; readonly zMm: bigint },
	second: { readonly xMm: bigint; readonly zMm: bigint },
): bigint {
	return first.xMm * second.zMm - first.zMm * second.xMm;
}

function isParameterWithinSegment(numerator: bigint, denominator: bigint): boolean {
	const sign = denominator > 0n ? 1n : -1n;
	const normalizedNumerator = numerator * sign;
	const normalizedDenominator = denominator * sign;
	return normalizedNumerator >= 0n && normalizedNumerator <= normalizedDenominator;
}

function isStrictlyInsideSegment(
	point: PlanPoint,
	segment: PlanSegment,
): boolean {
	return (
		isOnSegment(point, segment) &&
		pointKey(point) !== pointKey(segment.start) &&
		pointKey(point) !== pointKey(segment.end)
	);
}

function isOnSegment(point: PlanPoint, segment: PlanSegment): boolean {
	return (
		orientation(segment.start, segment.end, point) === 0n &&
		liesWithin(point.xMm, segment.start.xMm, segment.end.xMm) &&
		liesWithin(point.zMm, segment.start.zMm, segment.end.zMm)
	);
}

function isAllowedDirection(start: PlanPoint, end: PlanPoint): boolean {
	const deltaX = end.xMm - start.xMm;
	const deltaZ = end.zMm - start.zMm;
	return (
		(deltaX === 0) !== (deltaZ === 0) ||
		(deltaX !== 0 && deltaZ !== 0 && Math.abs(deltaX) === Math.abs(deltaZ))
	);
}

function isDiagonal(segment: PlanSegment): boolean {
	return (
		segment.start.xMm !== segment.end.xMm &&
		segment.start.zMm !== segment.end.zMm
	);
}

function isVertical(segment: PlanSegment): boolean {
	return segment.start.xMm === segment.end.xMm;
}

function liesWithin(value: number, first: number, second: number): boolean {
	return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function distanceFromStart(point: PlanPoint, segment: PlanSegment): number {
	return isVertical(segment)
		? (point.zMm - segment.start.zMm) *
				Math.sign(segment.end.zMm - segment.start.zMm)
		: (point.xMm - segment.start.xMm) *
				Math.sign(segment.end.xMm - segment.start.xMm);
}

function segmentLength(start: PlanPoint, end: PlanPoint): number {
	return Math.hypot(start.xMm - end.xMm, start.zMm - end.zMm);
}

function hasUnsupportedDiagonalContact(
	candidate: PlanSegment,
	existing: ResolvedWall,
): boolean {
	const intersection = exactSegmentIntersection(candidate, existing);
	return (
		(intersection.kind === "collinear" &&
			hasPositiveCollinearOverlap(candidate, existing)) ||
		intersection.kind === "non-integer"
	);
}

function areCollinear(first: PlanSegment, second: PlanSegment): boolean {
	return (
		orientation(first.start, first.end, second.start) === 0n &&
		orientation(first.start, first.end, second.end) === 0n
	);
}

function orientation(
	first: PlanPoint,
	second: PlanPoint,
	third: PlanPoint,
): bigint {
	return (
		BigInt(second.xMm - first.xMm) * BigInt(third.zMm - first.zMm) -
		BigInt(second.zMm - first.zMm) * BigInt(third.xMm - first.xMm)
	);
}

function isInProjectBounds(point: PlanPoint): boolean {
	return (
		Number.isSafeInteger(point.xMm) &&
		Number.isSafeInteger(point.zMm) &&
		Math.abs(point.xMm) <= PROJECT_COORDINATE_LIMIT_MM &&
		Math.abs(point.zMm) <= PROJECT_COORDINATE_LIMIT_MM
	);
}

function addContact(target: Map<string, PlanPoint>, point: PlanPoint): void {
	target.set(pointKey(point), { xMm: point.xMm, zMm: point.zMm });
}

function pointKey(point: PlanPoint): string {
	return `${point.xMm}:${point.zMm}`;
}

function comparePoint(first: PlanPoint, second: PlanPoint): number {
	return first.xMm - second.xMm || first.zMm - second.zMm;
}

function availableTemporaryId(
	prefix: string,
	index: number,
	used: ReadonlySet<string>,
): string {
	let suffix = index;
	while (used.has(`${prefix}${suffix}`)) {
		suffix += 1;
	}
	return `${prefix}${suffix}`;
}

function nextTemporaryWallId(used: Set<string>): string {
	const wallId = availableTemporaryId("__candidate_wall_", used.size, used);
	used.add(wallId);
	return wallId;
}

function reject(
	reasonCode: Extract<
		AddWallSegmentResult,
		{ readonly kind: "rejected" }
	>["reasonCode"],
): Extract<AddWallSegmentResult, { readonly kind: "rejected" }> {
	return { kind: "rejected", reasonCode };
}
