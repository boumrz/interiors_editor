import { deriveBoundedOrthogonalFaces, type PlanGraph } from './derive-plan-faces';
import type { Vertex, WallSegment } from './project';

export type DeleteWallSegmentResult =
  | { readonly graph: PlanGraph; readonly kind: 'accepted' }
  | {
      readonly kind: 'rejected';
      readonly reasonCode: 'INVALID_PLAN_GRAPH' | 'INVALID_RESULTING_PLAN_GRAPH' | 'WALL_NOT_FOUND';
    };

/**
 * Removes one canonical wall segment from a normalized PlanGraph. Geometry is
 * never reconstructed: surviving segments and vertices retain their original
 * identities and order, while only vertices made unreferenced by this command
 * are garbage-collected.
 */
export function deleteWallSegment(
  graph: PlanGraph,
  wallSegmentId: string
): DeleteWallSegmentResult {
  return deleteWallSegments(graph, [wallSegmentId]);
}

/** Deletes all selected edges before deriving any resulting faces. */
export function deleteWallSegments(
  graph: PlanGraph,
  wallSegmentIds: readonly string[]
): DeleteWallSegmentResult {
  if (deriveBoundedOrthogonalFaces(graph).kind === 'rejected') {
    return reject('INVALID_PLAN_GRAPH');
  }
  const selectedIds = new Set(wallSegmentIds);
  const targets = graph.wallSegments.filter((wall) => selectedIds.has(wall.wallSegmentId));
  if (!targets.length || targets.length !== wallSegmentIds.length) {
    return reject('WALL_NOT_FOUND');
  }

  const wallSegments = graph.wallSegments.filter((wall) => !selectedIds.has(wall.wallSegmentId));
  const referencedVertexIds = new Set(
    wallSegments.flatMap((wall) => [wall.startVertexId, wall.endVertexId])
  );
  const targetVertexIds = new Set(targets.flatMap((wall) => [wall.startVertexId, wall.endVertexId]));
  const vertices = graph.vertices.filter((vertex) =>
    !targetVertexIds.has(vertex.vertexId) || referencedVertexIds.has(vertex.vertexId)
  );
  const target = targets[0];
  const remaining = { vertices, wallSegments };
  const next = targets.length > 1
    ? coalesceCollinearSegments(remaining, targetVertexIds)
    : target && targetTouchesRoomJunction(target, graph.wallSegments)
      ? coalesceCollinearSegments(remaining)
      : remaining;

  if (deriveBoundedOrthogonalFaces(next).kind === 'rejected') {
    return reject('INVALID_RESULTING_PLAN_GRAPH');
  }
  return { graph: next, kind: 'accepted' };
}

function targetTouchesRoomJunction(target: { readonly startVertexId: string; readonly endVertexId: string }, walls: readonly WallSegment[]): boolean {
  return [target.startVertexId, target.endVertexId].every((vertexId) =>
    walls.filter((wall) => wall.startVertexId === vertexId || wall.endVertexId === vertexId).length >= 3
  );
}

/**
 * A divider splits its boundary walls at its endpoints. When that divider is
 * removed, restore the one straight canonical segment instead of retaining
 * obsolete degree-two vertices and artificial wall fragments.
 */
function coalesceCollinearSegments(graph: PlanGraph, eligibleJoints?: ReadonlySet<string>): PlanGraph {
  let vertices = graph.vertices;
  let wallSegments = graph.wallSegments;
  while (true) {
    const merged = mergeOneDegreeTwoVertex(vertices, wallSegments, eligibleJoints);
    if (!merged) {
      return { vertices, wallSegments };
    }
    vertices = merged.vertices;
    wallSegments = merged.wallSegments;
  }
}

function mergeOneDegreeTwoVertex(
  vertices: readonly Vertex[],
  wallSegments: readonly WallSegment[],
  eligibleJoints?: ReadonlySet<string>
): { readonly vertices: readonly Vertex[]; readonly wallSegments: readonly WallSegment[] } | undefined {
  const verticesById = new Map(vertices.map((vertex) => [vertex.vertexId, vertex]));
  for (const vertex of vertices) {
    if (eligibleJoints && !eligibleJoints.has(vertex.vertexId)) continue;
    const connected = wallSegments.filter((wall) =>
      wall.startVertexId === vertex.vertexId || wall.endVertexId === vertex.vertexId
    );
    const [first, second] = connected;
    if (!first || !second || connected.length !== 2 || first.thicknessMm !== second.thicknessMm) {
      continue;
    }
    const firstOtherId = first.startVertexId === vertex.vertexId ? first.endVertexId : first.startVertexId;
    const secondOtherId = second.startVertexId === vertex.vertexId ? second.endVertexId : second.startVertexId;
    const firstOther = verticesById.get(firstOtherId);
    const secondOther = verticesById.get(secondOtherId);
    if (!firstOther || !secondOther || !areStrictlyCollinear(firstOther, vertex, secondOther)) {
      continue;
    }
    const replacement: WallSegment = {
      endVertexId: secondOtherId,
      startVertexId: firstOtherId,
      thicknessMm: first.thicknessMm,
      wallSegmentId: first.wallSegmentId
    };
    return {
      vertices: vertices.filter((candidate) => candidate.vertexId !== vertex.vertexId),
      wallSegments: [
        ...wallSegments.filter((wall) => wall !== first && wall !== second),
        replacement
      ]
    };
  }
  return undefined;
}

function areStrictlyCollinear(first: Vertex, middle: Vertex, second: Vertex): boolean {
  if (first.xMm === middle.xMm && middle.xMm === second.xMm) {
    return (first.zMm < middle.zMm && middle.zMm < second.zMm) ||
      (second.zMm < middle.zMm && middle.zMm < first.zMm);
  }
  if (first.zMm === middle.zMm && middle.zMm === second.zMm) {
    return (first.xMm < middle.xMm && middle.xMm < second.xMm) ||
      (second.xMm < middle.xMm && middle.xMm < first.xMm);
  }
  return false;
}

function reject(
  reasonCode: Extract<DeleteWallSegmentResult, { readonly kind: 'rejected' }>['reasonCode']
): Extract<DeleteWallSegmentResult, { readonly kind: 'rejected' }> {
  return { kind: 'rejected', reasonCode };
}
