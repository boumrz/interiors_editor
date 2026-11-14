/**
 * First detached PlanGraph command seed.
 *
 * It intentionally creates a candidate for an otherwise empty graph only. The
 * candidate refs are corpus-visible placeholders, not allocated durable IDs.
 * Contacts, faces, Room/Opening/host reconciliation, thickness, ChangeSets,
 * writer fences, history and publication belong to later source-owned slices.
 */

import {
  resolveRawWallGeometry,
  type PlanDirection,
  type RawWallGeometryLimits,
  type ResolvedPlanPoint
} from './raw-wall-geometry-resolution';
import type {
  TccA1AcceptedOutcome,
  TccA1CorpusExecutor,
  TccA1RejectedOutcome
} from './tcc-a1-corpus-runner';

export const EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST = 'tcc-a1:detached-plan-graph:empty';

const START_VERTEX_CANDIDATE_REF = 'candidate:vertex:start';
const END_VERTEX_CANDIDATE_REF = 'candidate:vertex:end';
const INITIAL_WALL_CANDIDATE_REF = 'candidate:wall:initial';

const EMPTY_PLAN_WALL_ALLOCATION_INTENT = ['vertex:start', 'vertex:end', 'wall:initial'] as const;
const EMPTY_PLAN_WALL_OPAQUE_REFS = [
  START_VERTEX_CANDIDATE_REF,
  END_VERTEX_CANDIDATE_REF,
  INITIAL_WALL_CANDIDATE_REF
] as const;

export type EmptyPlanGraphWallCandidate = {
  readonly vertices: readonly [
    { readonly candidateRef: typeof START_VERTEX_CANDIDATE_REF; readonly positionMm: ResolvedPlanPoint },
    { readonly candidateRef: typeof END_VERTEX_CANDIDATE_REF; readonly positionMm: ResolvedPlanPoint }
  ];
  readonly wallCenterlines: readonly [
    {
      readonly candidateRef: typeof INITIAL_WALL_CANDIDATE_REF;
      readonly direction: PlanDirection;
      readonly endVertexRef: typeof END_VERTEX_CANDIDATE_REF;
      readonly startVertexRef: typeof START_VERTEX_CANDIDATE_REF;
    }
  ];
};

export type EmptyPlanGraphWallCandidateResult =
  | (TccA1AcceptedOutcome & { readonly candidate: EmptyPlanGraphWallCandidate })
  | TccA1RejectedOutcome;

export type EmptyPlanGraphWallCorpusIntent = {
  readonly kind: 'empty-plan-graph-wall';
  readonly limits: RawWallGeometryLimits;
  readonly rawWallGeometry: unknown;
};

/**
 * Resolves the raw geometry through S2-01 and turns only an accepted exact
 * direction into an empty-plan candidate. A rejection keeps the empty digest,
 * has no allocation intent, and is passed through without replacement.
 */
export function deriveEmptyPlanGraphWallCandidate(
  rawWallGeometry: unknown,
  limits: RawWallGeometryLimits
): EmptyPlanGraphWallCandidateResult {
  const resolved = resolveRawWallGeometry(rawWallGeometry, limits);
  if (resolved.kind === 'rejected') {
    return {
      allocationIntent: [],
      kind: 'rejected',
      postStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
      reasonCode: resolved.reasonCode
    };
  }

  return {
    allocationIntent: EMPTY_PLAN_WALL_ALLOCATION_INTENT,
    candidate: {
      vertices: [
        { candidateRef: START_VERTEX_CANDIDATE_REF, positionMm: copyPoint(resolved.geometry.startMm) },
        { candidateRef: END_VERTEX_CANDIDATE_REF, positionMm: copyPoint(resolved.geometry.endMm) }
      ],
      wallCenterlines: [{
        candidateRef: INITIAL_WALL_CANDIDATE_REF,
        direction: resolved.geometry.direction,
        endVertexRef: END_VERTEX_CANDIDATE_REF,
        startVertexRef: START_VERTEX_CANDIDATE_REF
      }]
    },
    inverseStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
    kind: 'accepted',
    opaqueCandidateRefs: EMPTY_PLAN_WALL_OPAQUE_REFS,
    postStateDigest: digestInitialWall(resolved.geometry.startMm, resolved.geometry.endMm)
  };
}

/**
 * The executor is intentionally restricted to fixtures whose base is the
 * empty detached graph. It is not a general AddWallSegment command.
 */
export const emptyPlanGraphWallCorpusExecutor: TccA1CorpusExecutor<EmptyPlanGraphWallCorpusIntent> = {
  evaluate: ({ baseStateDigest, intent }) => {
    if (baseStateDigest !== EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST || intent.kind !== 'empty-plan-graph-wall') {
      throw new TypeError('The empty-plan wall corpus executor accepts only an empty-plan wall intent');
    }
    return deriveEmptyPlanGraphWallCandidate(intent.rawWallGeometry, intent.limits);
  }
};

function copyPoint(point: ResolvedPlanPoint): ResolvedPlanPoint {
  return { xMm: point.xMm, zMm: point.zMm };
}

function digestInitialWall(start: ResolvedPlanPoint, end: ResolvedPlanPoint): string {
  return `tcc-a1:detached-plan-graph:wall:${start.xMm},${start.zMm}:${end.xMm},${end.zMm}`;
}
