import { describe, expect, it } from '@rstest/core';

import {
  deriveBoundedOrthogonalFaces,
  type PlanGraph
} from './derive-plan-faces';
import { exactMeasurement } from './exact-quadratic-surd';

function rectangleGraph(): PlanGraph {
  return {
    vertices: [
      { vertexId: 'a', xMm: 0, zMm: 0 },
      { vertexId: 'b', xMm: 4000, zMm: 0 },
      { vertexId: 'c', xMm: 4000, zMm: 3000 },
      { vertexId: 'd', xMm: 0, zMm: 3000 }
    ],
    wallSegments: [
      { endVertexId: 'd', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-left' },
      { endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-bottom' },
      { endVertexId: 'c', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'wall-right' },
      { endVertexId: 'd', startVertexId: 'c', thicknessMm: 100, wallSegmentId: 'wall-top' }
    ]
  };
}

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

describe('deriveBoundedOrthogonalFaces', () => {
  it('derives one bounded rectangular face with a stable coordinate fingerprint independent of wall order and direction', () => {
    const first = deriveBoundedOrthogonalFaces(rectangleGraph());
    const reversed: PlanGraph = {
      ...rectangleGraph(),
      wallSegments: [...rectangleGraph().wallSegments].reverse().map((wall) => ({
        ...wall,
        endVertexId: wall.startVertexId,
        startVertexId: wall.endVertexId
      }))
    };
    const second = deriveBoundedOrthogonalFaces(reversed);

    expect(first).toEqual({
      faces: [
        {
          areaMm2: exactMeasurement(12_000_000n),
          boundaryWallSegmentIds: ['wall-bottom', 'wall-left', 'wall-right', 'wall-top'],
          fingerprint: 'orthogonal-face:0:0|0:3000|4000:3000|4000:0',
          vertices: [
            { xMm: 0, zMm: 0 },
            { xMm: 0, zMm: 3000 },
            { xMm: 4000, zMm: 3000 },
            { xMm: 4000, zMm: 0 }
          ]
        }
      ],
      kind: 'accepted'
    });
    expect(second).toEqual(first);
  });

  it('derives both bounded faces of a normalized partition and excludes the unbounded exterior traversal', () => {
    const result = deriveBoundedOrthogonalFaces(partitionedRectangleGraph());

    expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (result.kind !== 'accepted') {
      throw new Error('Expected the normalized partition to derive faces');
    }
    expect(result.faces).toHaveLength(2);
    expect(result.faces.map((face) => face.areaMm2)).toEqual([
      exactMeasurement(6_000_000n),
      exactMeasurement(6_000_000n)
    ]);
    expect(result.faces.map((face) => face.boundaryWallSegmentIds)).toEqual([
      ['wall-bottom-left', 'wall-divider', 'wall-left', 'wall-top-left'],
      ['wall-bottom-right', 'wall-divider', 'wall-right', 'wall-top-right']
    ]);
  });

  it('accepts an open wall graph without inventing a Room face', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'a', xMm: 0, zMm: 0 },
        { vertexId: 'b', xMm: 1000, zMm: 0 }
      ],
      wallSegments: [{ endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-1' }]
    });

    expect(result).toEqual({ faces: [], kind: 'accepted' });
  });

  it('rejects nested closed rings instead of materializing a partial or second Room', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'outer-a', xMm: 0, zMm: 0 },
        { vertexId: 'outer-b', xMm: 6000, zMm: 0 },
        { vertexId: 'outer-c', xMm: 6000, zMm: 5000 },
        { vertexId: 'outer-d', xMm: 0, zMm: 5000 },
        { vertexId: 'inner-a', xMm: 2000, zMm: 1500 },
        { vertexId: 'inner-b', xMm: 4000, zMm: 1500 },
        { vertexId: 'inner-c', xMm: 4000, zMm: 3500 },
        { vertexId: 'inner-d', xMm: 2000, zMm: 3500 }
      ],
      wallSegments: [
        { endVertexId: 'outer-b', startVertexId: 'outer-a', thicknessMm: 100, wallSegmentId: 'outer-bottom' },
        { endVertexId: 'outer-c', startVertexId: 'outer-b', thicknessMm: 100, wallSegmentId: 'outer-right' },
        { endVertexId: 'outer-d', startVertexId: 'outer-c', thicknessMm: 100, wallSegmentId: 'outer-top' },
        { endVertexId: 'outer-a', startVertexId: 'outer-d', thicknessMm: 100, wallSegmentId: 'outer-left' },
        { endVertexId: 'inner-b', startVertexId: 'inner-a', thicknessMm: 100, wallSegmentId: 'inner-bottom' },
        { endVertexId: 'inner-c', startVertexId: 'inner-b', thicknessMm: 100, wallSegmentId: 'inner-right' },
        { endVertexId: 'inner-d', startVertexId: 'inner-c', thicknessMm: 100, wallSegmentId: 'inner-top' },
        { endVertexId: 'inner-a', startVertexId: 'inner-d', thicknessMm: 100, wallSegmentId: 'inner-left' }
      ]
    });

    expect(result).toEqual({
      kind: 'rejected',
      reasonCode: 'AMBIGUOUS_BOUNDED_WALK'
    });
  });

  it('rejects nested 45-degree rings instead of materializing overlapping Rooms', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'outer-west', xMm: 0, zMm: 3000 },
        { vertexId: 'outer-north', xMm: 3000, zMm: 6000 },
        { vertexId: 'outer-east', xMm: 6000, zMm: 3000 },
        { vertexId: 'outer-south', xMm: 3000, zMm: 0 },
        { vertexId: 'inner-west', xMm: 2000, zMm: 3000 },
        { vertexId: 'inner-north', xMm: 3000, zMm: 4000 },
        { vertexId: 'inner-east', xMm: 4000, zMm: 3000 },
        { vertexId: 'inner-south', xMm: 3000, zMm: 2000 }
      ],
      wallSegments: [
        { endVertexId: 'outer-north', startVertexId: 'outer-west', thicknessMm: 100, wallSegmentId: 'outer-north-west' },
        { endVertexId: 'outer-east', startVertexId: 'outer-north', thicknessMm: 100, wallSegmentId: 'outer-north-east' },
        { endVertexId: 'outer-south', startVertexId: 'outer-east', thicknessMm: 100, wallSegmentId: 'outer-south-east' },
        { endVertexId: 'outer-west', startVertexId: 'outer-south', thicknessMm: 100, wallSegmentId: 'outer-south-west' },
        { endVertexId: 'inner-north', startVertexId: 'inner-west', thicknessMm: 100, wallSegmentId: 'inner-north-west' },
        { endVertexId: 'inner-east', startVertexId: 'inner-north', thicknessMm: 100, wallSegmentId: 'inner-north-east' },
        { endVertexId: 'inner-south', startVertexId: 'inner-east', thicknessMm: 100, wallSegmentId: 'inner-south-east' },
        { endVertexId: 'inner-west', startVertexId: 'inner-south', thicknessMm: 100, wallSegmentId: 'inner-south-west' }
      ]
    });

    expect(result).toEqual({
      kind: 'rejected',
      reasonCode: 'AMBIGUOUS_BOUNDED_WALK'
    });
  });

  it('keeps disjoint 45-degree rings as separate Rooms', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'left-west', xMm: 0, zMm: 3000 },
        { vertexId: 'left-north', xMm: 3000, zMm: 6000 },
        { vertexId: 'left-east', xMm: 6000, zMm: 3000 },
        { vertexId: 'left-south', xMm: 3000, zMm: 0 },
        { vertexId: 'right-west', xMm: 8000, zMm: 3000 },
        { vertexId: 'right-north', xMm: 11000, zMm: 6000 },
        { vertexId: 'right-east', xMm: 14000, zMm: 3000 },
        { vertexId: 'right-south', xMm: 11000, zMm: 0 }
      ],
      wallSegments: [
        { endVertexId: 'left-north', startVertexId: 'left-west', thicknessMm: 100, wallSegmentId: 'left-north-west' },
        { endVertexId: 'left-east', startVertexId: 'left-north', thicknessMm: 100, wallSegmentId: 'left-north-east' },
        { endVertexId: 'left-south', startVertexId: 'left-east', thicknessMm: 100, wallSegmentId: 'left-south-east' },
        { endVertexId: 'left-west', startVertexId: 'left-south', thicknessMm: 100, wallSegmentId: 'left-south-west' },
        { endVertexId: 'right-north', startVertexId: 'right-west', thicknessMm: 100, wallSegmentId: 'right-north-west' },
        { endVertexId: 'right-east', startVertexId: 'right-north', thicknessMm: 100, wallSegmentId: 'right-north-east' },
        { endVertexId: 'right-south', startVertexId: 'right-east', thicknessMm: 100, wallSegmentId: 'right-south-east' },
        { endVertexId: 'right-west', startVertexId: 'right-south', thicknessMm: 100, wallSegmentId: 'right-south-west' }
      ]
    });

    expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (result.kind === 'accepted') {
      expect(result.faces).toHaveLength(2);
      expect(result.faces.map((face) => face.fingerprint)).toEqual([
        'orthogonal-face:0:3000|3000:0|6000:3000|3000:6000',
        'orthogonal-face:8000:3000|11000:0|14000:3000|11000:6000'
      ]);
    }
  });

  it('rejects a translated nested 45-degree ring without depending on the coordinate origin', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'outer-west', xMm: -10000, zMm: -5000 },
        { vertexId: 'outer-north', xMm: -7000, zMm: -2000 },
        { vertexId: 'outer-east', xMm: -4000, zMm: -5000 },
        { vertexId: 'outer-south', xMm: -7000, zMm: -8000 },
        { vertexId: 'inner-west', xMm: -8000, zMm: -5000 },
        { vertexId: 'inner-north', xMm: -7000, zMm: -4000 },
        { vertexId: 'inner-east', xMm: -6000, zMm: -5000 },
        { vertexId: 'inner-south', xMm: -7000, zMm: -6000 }
      ],
      wallSegments: [
        { endVertexId: 'outer-north', startVertexId: 'outer-west', thicknessMm: 100, wallSegmentId: 'outer-north-west' },
        { endVertexId: 'outer-east', startVertexId: 'outer-north', thicknessMm: 100, wallSegmentId: 'outer-north-east' },
        { endVertexId: 'outer-south', startVertexId: 'outer-east', thicknessMm: 100, wallSegmentId: 'outer-south-east' },
        { endVertexId: 'outer-west', startVertexId: 'outer-south', thicknessMm: 100, wallSegmentId: 'outer-south-west' },
        { endVertexId: 'inner-north', startVertexId: 'inner-west', thicknessMm: 100, wallSegmentId: 'inner-north-west' },
        { endVertexId: 'inner-east', startVertexId: 'inner-north', thicknessMm: 100, wallSegmentId: 'inner-north-east' },
        { endVertexId: 'inner-south', startVertexId: 'inner-east', thicknessMm: 100, wallSegmentId: 'inner-south-east' },
        { endVertexId: 'inner-west', startVertexId: 'inner-south', thicknessMm: 100, wallSegmentId: 'inner-south-west' }
      ]
    });

    expect(result).toEqual({
      kind: 'rejected',
      reasonCode: 'AMBIGUOUS_BOUNDED_WALK'
    });
  });

  it('accepts an isolated exact 45-degree wall without inventing a Room face', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'a', xMm: 0, zMm: 0 },
        { vertexId: 'b', xMm: 1000, zMm: 1000 }
      ],
      wallSegments: [{ endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-45' }]
    });

    expect(result).toEqual({ faces: [], kind: 'accepted' });
  });

  it('derives a closed exact 45-degree triangular Plan face without replacing it with a rectangle', () => {
    expect(deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'a', xMm: 0, zMm: 0 },
        { vertexId: 'b', xMm: 1000, zMm: 0 },
        { vertexId: 'c', xMm: 1000, zMm: 1000 }
      ],
      wallSegments: [
        { endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'bottom' },
        { endVertexId: 'c', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'right' },
        { endVertexId: 'a', startVertexId: 'c', thicknessMm: 100, wallSegmentId: 'diagonal' }
      ]
    })).toEqual({
      faces: [
        {
          areaMm2: exactMeasurement(500_000n),
          boundaryWallSegmentIds: ['bottom', 'diagonal', 'right'],
          fingerprint: 'orthogonal-face:0:0|1000:0|1000:1000',
          vertices: [
            { xMm: 0, zMm: 0 },
            { xMm: 1000, zMm: 0 },
            { xMm: 1000, zMm: 1000 }
          ]
        }
      ],
      kind: 'accepted'
    });
  });

  it('preserves a half-square-millimetre face area exactly', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'a', xMm: 0, zMm: 0 },
        { vertexId: 'b', xMm: 1, zMm: 0 },
        { vertexId: 'c', xMm: 1, zMm: 1 }
      ],
      wallSegments: [
        { endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'bottom' },
        { endVertexId: 'c', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'right' },
        { endVertexId: 'a', startVertexId: 'c', thicknessMm: 100, wallSegmentId: 'diagonal' }
      ]
    });

    expect(result).toEqual(expect.objectContaining({ kind: 'accepted' }));
    if (result.kind !== 'accepted') {
      throw new Error('Expected the triangular face to be derived');
    }
    expect(result.faces[0]?.areaMm2).toEqual(exactMeasurement(1n, 0n, 2n));
  });

  it('accepts a normalized acyclic plus graph without inventing a Room face', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'left', xMm: -1000, zMm: 0 },
        { vertexId: 'center', xMm: 0, zMm: 0 },
        { vertexId: 'right', xMm: 1000, zMm: 0 },
        { vertexId: 'top', xMm: 0, zMm: -1000 },
        { vertexId: 'bottom', xMm: 0, zMm: 1000 }
      ],
      wallSegments: [
        { endVertexId: 'center', startVertexId: 'left', thicknessMm: 100, wallSegmentId: 'wall-left' },
        { endVertexId: 'right', startVertexId: 'center', thicknessMm: 100, wallSegmentId: 'wall-right' },
        { endVertexId: 'center', startVertexId: 'top', thicknessMm: 100, wallSegmentId: 'wall-top' },
        { endVertexId: 'bottom', startVertexId: 'center', thicknessMm: 100, wallSegmentId: 'wall-bottom' }
      ]
    });

    expect(result).toEqual({ faces: [], kind: 'accepted' });
  });

  it('keeps a closed room when a normalized dangling interior wall is a graph bridge', () => {
    const result = deriveBoundedOrthogonalFaces({
      vertices: [
        { vertexId: 'a', xMm: 0, zMm: 0 },
        { vertexId: 'b', xMm: 2000, zMm: 0 },
        { vertexId: 'c', xMm: 4000, zMm: 0 },
        { vertexId: 'd', xMm: 4000, zMm: 3000 },
        { vertexId: 'e', xMm: 0, zMm: 3000 },
        { vertexId: 'f', xMm: 2000, zMm: 1500 }
      ],
      wallSegments: [
        { endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-bottom-left' },
        { endVertexId: 'c', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'wall-bottom-right' },
        { endVertexId: 'd', startVertexId: 'c', thicknessMm: 100, wallSegmentId: 'wall-right' },
        { endVertexId: 'e', startVertexId: 'd', thicknessMm: 100, wallSegmentId: 'wall-top' },
        { endVertexId: 'a', startVertexId: 'e', thicknessMm: 100, wallSegmentId: 'wall-left' },
        { endVertexId: 'f', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'wall-dangling' }
      ]
    });

    expect(result).toEqual({
      faces: [
        {
          areaMm2: exactMeasurement(12_000_000n),
          boundaryWallSegmentIds: ['wall-bottom-left', 'wall-bottom-right', 'wall-left', 'wall-right', 'wall-top'],
          fingerprint: 'orthogonal-face:0:0|0:3000|4000:3000|4000:0',
          vertices: [
            { xMm: 0, zMm: 0 },
            { xMm: 0, zMm: 3000 },
            { xMm: 4000, zMm: 3000 },
            { xMm: 4000, zMm: 0 }
          ]
        }
      ],
      kind: 'accepted'
    });
  });

  it.each([
    [
      'non-orthogonal wall',
      {
        vertices: [
          { vertexId: 'a', xMm: 0, zMm: 0 },
          { vertexId: 'b', xMm: 1000, zMm: 500 }
        ],
        wallSegments: [{ endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-1' }]
      },
      'NON_ORTHOGONAL_WALL'
    ],
    [
      'wall reference to an absent vertex',
      {
        vertices: [{ vertexId: 'a', xMm: 0, zMm: 0 }],
        wallSegments: [{ endVertexId: 'missing', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-1' }]
      },
      'UNRESOLVED_WALL_REFERENCE'
    ],
    [
      'zero-length wall',
      {
        vertices: [
          { vertexId: 'a', xMm: 0, zMm: 0 },
          { vertexId: 'b', xMm: 0, zMm: 0 }
        ],
        wallSegments: [{ endVertexId: 'b', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-1' }]
      },
      'DEGENERATE_WALL'
    ]
  ])('rejects %s before it can produce a face', (_description, graph, reasonCode) => {
    expect(deriveBoundedOrthogonalFaces(graph)).toEqual({ kind: 'rejected', reasonCode });
  });

  it('rejects a T contact when the crossed wall has not been split at the shared Vertex', () => {
    const graph: PlanGraph = {
      vertices: [
        { vertexId: 'a', xMm: 0, zMm: 0 },
        { vertexId: 'b', xMm: 2000, zMm: 0 },
        { vertexId: 'c', xMm: 4000, zMm: 0 },
        { vertexId: 'd', xMm: 4000, zMm: 3000 },
        { vertexId: 'e', xMm: 2000, zMm: 3000 },
        { vertexId: 'f', xMm: 0, zMm: 3000 }
      ],
      wallSegments: [
        { endVertexId: 'c', startVertexId: 'a', thicknessMm: 100, wallSegmentId: 'wall-bottom-unsplit' },
        { endVertexId: 'd', startVertexId: 'c', thicknessMm: 100, wallSegmentId: 'wall-right' },
        { endVertexId: 'f', startVertexId: 'd', thicknessMm: 100, wallSegmentId: 'wall-top-unsplit' },
        { endVertexId: 'a', startVertexId: 'f', thicknessMm: 100, wallSegmentId: 'wall-left' },
        { endVertexId: 'e', startVertexId: 'b', thicknessMm: 100, wallSegmentId: 'wall-divider' }
      ]
    };

    expect(deriveBoundedOrthogonalFaces(graph)).toEqual({
      kind: 'rejected',
      reasonCode: 'AMBIGUOUS_BOUNDED_WALK'
    });
  });
});
