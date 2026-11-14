import { describe, expect, it } from '@rstest/core';

import { deleteWallSegment } from './delete-wall-segment';
import { deriveBoundedOrthogonalFaces, type PlanGraph } from './derive-plan-faces';
import { exactMeasurement } from './exact-quadratic-surd';

function partitionedRectangleGraph(): PlanGraph {
  return {
    vertices: [
      { vertexId: 'a', xMm: 0, zMm: 0 },
      { vertexId: 'b', xMm: 2000, zMm: 0 },
      { vertexId: 'c', xMm: 4000, zMm: 0 },
      { vertexId: 'd', xMm: 4000, zMm: 3000 },
      { vertexId: 'e', xMm: 2000, zMm: 3000 },
      { vertexId: 'f', xMm: 0, zMm: 3000 }
    ],
    wallSegments: [
      { endVertexId: 'a', startVertexId: 'f', thicknessMm: 100, wallSegmentId: 'wall-left' },
      { endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-bottom-left' },
      { endVertexId: 'c', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'wall-bottom-right' },
      { endVertexId: 'd', startVertexId: 'c', thicknessMm: 100, wallSegmentId: 'wall-right' },
      { endVertexId: 'e', startVertexId: 'd', thicknessMm: 100, wallSegmentId: 'wall-top-right' },
      { endVertexId: 'f', startVertexId: 'e', thicknessMm: 100, wallSegmentId: 'wall-top-left' },
      { endVertexId: 'e', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'wall-divider' }
    ]
  };
}

function roomWithDanglingWallGraph(): PlanGraph {
  return {
    vertices: [
      { vertexId: 'a', xMm: 0, zMm: 0 },
      { vertexId: 'b', xMm: 2000, zMm: 0 },
      { vertexId: 'c', xMm: 4000, zMm: 0 },
      { vertexId: 'd', xMm: 4000, zMm: 3000 },
      { vertexId: 'e', xMm: 0, zMm: 3000 },
      { vertexId: 'dangling-end', xMm: 2000, zMm: 1500 },
      { vertexId: 'preexisting-orphan', xMm: 6000, zMm: 6000 }
    ],
    wallSegments: [
      { endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-bottom-left' },
      { endVertexId: 'c', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'wall-bottom-right' },
      { endVertexId: 'd', startVertexId: 'c', thicknessMm: 100, wallSegmentId: 'wall-right' },
      { endVertexId: 'e', startVertexId: 'd', thicknessMm: 100, wallSegmentId: 'wall-top' },
      { endVertexId: 'a', startVertexId: 'e', thicknessMm: 100, wallSegmentId: 'wall-left' },
      { endVertexId: 'dangling-end', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'wall-dangling' }
    ]
  };
}

function snapshotGraph(graph: PlanGraph): PlanGraph {
  return {
    vertices: graph.vertices.map((vertex) => ({ ...vertex })),
    wallSegments: graph.wallSegments.map((wall) => ({ ...wall }))
  };
}

describe('deleteWallSegment', () => {
  it('removes exactly one normalized partition and safely merges its two derived faces', () => {
    const graph = partitionedRectangleGraph();
    expect(deriveBoundedOrthogonalFaces(graph)).toEqual(expect.objectContaining({
      faces: expect.arrayContaining([expect.anything(), expect.anything()]),
      kind: 'accepted'
    }));

    const result = deleteWallSegment(graph, 'wall-divider');

    expect(result).toEqual({
      graph: {
        vertices: graph.vertices.filter((vertex) => !['b', 'e'].includes(vertex.vertexId)),
        wallSegments: [
          { endVertexId: 'a', startVertexId: 'f', thicknessMm: 100, wallSegmentId: 'wall-left' },
          { endVertexId: 'd', startVertexId: 'c', thicknessMm: 100, wallSegmentId: 'wall-right' },
          { endVertexId: 'c', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-bottom-left' },
          { endVertexId: 'f', startVertexId: 'd', thicknessMm: 100, wallSegmentId: 'wall-top-right' }
        ]
      },
      kind: 'accepted'
    });
    if (result.kind !== 'accepted') {
      throw new Error('Expected the partition deletion to be accepted');
    }
    expect(deriveBoundedOrthogonalFaces(result.graph)).toEqual({
      faces: [expect.objectContaining({
        areaMm2: exactMeasurement(12_000_000n),
        fingerprint: 'orthogonal-face:0:0|0:3000|4000:3000|4000:0'
      })],
      kind: 'accepted'
    });
  });

  it('removes a dangling branch and garbage-collects only its now-unreferenced endpoint', () => {
    const graph = roomWithDanglingWallGraph();

    const result = deleteWallSegment(graph, 'wall-dangling');

    expect(result).toEqual({
      graph: {
        vertices: graph.vertices.filter((vertex) => vertex.vertexId !== 'dangling-end'),
        wallSegments: graph.wallSegments.filter((wall) => wall.wallSegmentId !== 'wall-dangling')
      },
      kind: 'accepted'
    });
    if (result.kind !== 'accepted') {
      throw new Error('Expected the dangling wall deletion to be accepted');
    }
    expect(deriveBoundedOrthogonalFaces(result.graph)).toEqual(expect.objectContaining({
      faces: [expect.objectContaining({ areaMm2: exactMeasurement(12_000_000n) })],
      kind: 'accepted'
    }));
  });

  it('rejects an unknown wall without changing the graph', () => {
    const graph = partitionedRectangleGraph();
    const before = snapshotGraph(graph);

    expect(deleteWallSegment(graph, 'wall-missing')).toEqual({
      kind: 'rejected',
      reasonCode: 'WALL_NOT_FOUND'
    });
    expect(graph).toEqual(before);
  });

  it('rejects a graph that is not normalized before looking for a wall to remove', () => {
    const graph: PlanGraph = {
      vertices: [
        { vertexId: 'a', xMm: 0, zMm: 0 },
        { vertexId: 'b', xMm: 1000, zMm: 500 }
      ],
      wallSegments: [{ endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-1' }]
    };

    expect(deleteWallSegment(graph, 'wall-1')).toEqual({
      kind: 'rejected',
      reasonCode: 'INVALID_PLAN_GRAPH'
    });
  });

  it('never mutates the supplied graph while deleting a wall', () => {
    const graph = partitionedRectangleGraph();
    const before = snapshotGraph(graph);

    const result = deleteWallSegment(graph, 'wall-divider');

    expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
    expect(graph).toEqual(before);
    expect(graph.wallSegments.map((wall) => wall.wallSegmentId)).toEqual([
      'wall-left',
      'wall-bottom-left',
      'wall-bottom-right',
      'wall-right',
      'wall-top-right',
      'wall-top-left',
      'wall-divider'
    ]);
  });
});
