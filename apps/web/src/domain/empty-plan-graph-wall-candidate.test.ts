import { describe, expect, it } from '@rstest/core';

import {
  EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
  deriveEmptyPlanGraphWallCandidate,
  emptyPlanGraphWallCorpusExecutor
} from './empty-plan-graph-wall-candidate';

const alphaRawGeometryLimits = {
  maxAbsoluteCoordinateMm: 100_000
};

describe('empty PlanGraph wall candidate', () => {
  it('derives a detached 45-degree centerline candidate with fixture-only allocation placeholders', () => {
    const rawRequest = {
      end: { xMm: '1000', zMm: '1000' },
      kind: 'endpoints' as const,
      start: { xMm: '-0', zMm: '0' }
    };

    expect(deriveEmptyPlanGraphWallCandidate(rawRequest, alphaRawGeometryLimits)).toEqual({
      allocationIntent: ['vertex:start', 'vertex:end', 'wall:initial'],
      candidate: {
        vertices: [
          { candidateRef: 'candidate:vertex:start', positionMm: { xMm: 0, zMm: 0 } },
          { candidateRef: 'candidate:vertex:end', positionMm: { xMm: 1000, zMm: 1000 } }
        ],
        wallCenterlines: [
          {
            candidateRef: 'candidate:wall:initial',
            direction: 'NE',
            endVertexRef: 'candidate:vertex:end',
            startVertexRef: 'candidate:vertex:start'
          }
        ]
      },
      inverseStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
      kind: 'accepted',
      opaqueCandidateRefs: ['candidate:vertex:start', 'candidate:vertex:end', 'candidate:wall:initial'],
      postStateDigest: 'tcc-a1:detached-plan-graph:wall:0,0:1000,1000'
    });
    expect(rawRequest).toEqual({
      end: { xMm: '1000', zMm: '1000' },
      kind: 'endpoints',
      start: { xMm: '-0', zMm: '0' }
    });
  });

  it.each([
    [
      'invalid raw numeric lexeme',
      {
        end: { xMm: '1.5', zMm: '0' },
        kind: 'endpoints',
        start: { xMm: '0', zMm: '0' }
      },
      'INVALID_DIMENSION'
    ],
    [
      'zero length',
      {
        end: { xMm: '0', zMm: '0' },
        kind: 'endpoints',
        start: { xMm: '0', zMm: '0' }
      },
      'ZERO_LENGTH'
    ],
    [
      'unsupported slope',
      {
        end: { xMm: '1000', zMm: '500' },
        kind: 'endpoints',
        start: { xMm: '0', zMm: '0' }
      },
      'UNSUPPORTED_DIRECTION'
    ]
  ] as const)('preserves the empty graph for %s', (_caseName, rawRequest, reasonCode) => {
    expect(deriveEmptyPlanGraphWallCandidate(rawRequest, alphaRawGeometryLimits)).toEqual({
      allocationIntent: [],
      kind: 'rejected',
      postStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
      reasonCode
    });
  });

  it('refuses to reuse the empty-plan executor for a different base or a different semantic command', () => {
    const validIntent = {
      kind: 'empty-plan-graph-wall' as const,
      limits: alphaRawGeometryLimits,
      rawWallGeometry: {
        end: { xMm: '1000', zMm: '0' },
        kind: 'endpoints',
        start: { xMm: '0', zMm: '0' }
      }
    };

    expect(() => emptyPlanGraphWallCorpusExecutor.evaluate({
      baseStateDigest: 'tcc-a1:detached-plan-graph:nonempty',
      fixtureId: 'wrong-base',
      intent: validIntent,
      rawInputBytes: []
    })).toThrow('The empty-plan wall corpus executor accepts only an empty-plan wall intent');
    expect(() => Reflect.apply(emptyPlanGraphWallCorpusExecutor.evaluate, emptyPlanGraphWallCorpusExecutor, [{
      baseStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
      fixtureId: 'wrong-kind',
      intent: { ...validIntent, kind: 'different-command' },
      rawInputBytes: []
    }])).toThrow('The empty-plan wall corpus executor accepts only an empty-plan wall intent');
  });
});
