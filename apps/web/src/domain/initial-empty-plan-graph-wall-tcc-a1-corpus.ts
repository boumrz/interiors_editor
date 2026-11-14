/**
 * Seed TCC-A1 fixtures for the deliberately narrow empty-plan wall candidate.
 * The raw byte arrays are ASCII JSON fixture bytes; no JSON parser or legacy
 * project codec is involved in this detached domain corpus.
 */

import {
  EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
  type EmptyPlanGraphWallCorpusIntent
} from './empty-plan-graph-wall-candidate';
import {
  TCC_A1_CONTRACT_ID,
  TCC_A1_CONTRACT_VERSION,
  type TccA1CorpusManifest
} from './tcc-a1-corpus-runner';

const alphaRawGeometryLimits = {
  maxAbsoluteCoordinateMm: 100_000
};

export const initialEmptyPlanGraphWallTccA1Corpus: TccA1CorpusManifest<EmptyPlanGraphWallCorpusIntent> = {
  contractId: TCC_A1_CONTRACT_ID,
  contractVersion: TCC_A1_CONTRACT_VERSION,
  corpusId: 'interiors.tcc-a1.empty-plan-wall',
  corpusRevision: 1,
  executorRole: 'domain-kernel',
  fixtures: [
    {
      baseStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
      expected: {
        allocationIntent: ['vertex:start', 'vertex:end', 'wall:initial'],
        inverseStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
        kind: 'accepted',
        opaqueCandidateRefs: ['candidate:vertex:start', 'candidate:vertex:end', 'candidate:wall:initial'],
        postStateDigest: 'tcc-a1:detached-plan-graph:wall:0,0:1000,1000'
      },
      fixtureId: 'TCC-A1-EMPTY-WALL-001',
      intent: {
        kind: 'empty-plan-graph-wall',
        limits: alphaRawGeometryLimits,
        rawWallGeometry: {
          end: { xMm: '1000', zMm: '1000' },
          kind: 'endpoints',
          start: { xMm: '0', zMm: '0' }
        }
      },
      rawInputBytes: asciiFixtureBytes('{"kind":"endpoints","start":{"xMm":"0","zMm":"0"},"end":{"xMm":"1000","zMm":"1000"}}'),
      rawInputSha256: '409db14815c4568339bdf096ffdaf621da88a0631756bdadf18a2a04fc9c89b3'
    },
    {
      baseStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
      expected: {
        allocationIntent: [],
        kind: 'rejected',
        postStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
        reasonCode: 'INVALID_DIMENSION'
      },
      fixtureId: 'TCC-A1-EMPTY-WALL-002',
      intent: {
        kind: 'empty-plan-graph-wall',
        limits: alphaRawGeometryLimits,
        rawWallGeometry: {
          end: { xMm: '1.5', zMm: '0' },
          kind: 'endpoints',
          start: { xMm: '0', zMm: '0' }
        }
      },
      rawInputBytes: asciiFixtureBytes('{"kind":"endpoints","start":{"xMm":"0","zMm":"0"},"end":{"xMm":"1.5","zMm":"0"}}'),
      rawInputSha256: 'ddd9c4f696740a6551d0d5396f9741b98183ea8799258d8fb394f8acb114dd0c'
    }
  ],
  policyReferences: [
    'geometry-contract.md#1-mm-ingress-and-exact-direction-semantics',
    'topology-corpus-contract.md#1-identichnost-i-neizmennost-corpus',
    'topology-corpus-contract.md#2-fixture-outcome-contract'
  ]
};

function asciiFixtureBytes(source: string): readonly number[] {
  const bytes = [...source].map((character) => character.charCodeAt(0));
  if (bytes.some((byte) => byte > 0x7f)) {
    throw new TypeError('Seed TCC-A1 fixtures must declare ASCII JSON bytes explicitly');
  }
  return Object.freeze(bytes);
}
