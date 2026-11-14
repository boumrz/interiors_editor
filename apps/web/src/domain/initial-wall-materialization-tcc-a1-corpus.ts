/**
 * The first executable TCC-A1 corpus that drives AD-21's actual materializer.
 *
 * Fixture IDs, raw bytes and expected digests are static evidence. The executor
 * is detached: its injected ports simulate conditional reservation only; it
 * never writes a Project, Revision, History or durable allocation ledger.
 */

import {
  materializeInitialWallSegment,
  type ContentHashPort,
  type EmptyPlanGraph,
  type IdReservationPort,
  type InitialWallMaterializationInput,
  type InitialWallReservationResult,
  type MaterializeInitialWallSegmentResult
} from './materialize-initial-wall-segment';
import {
  TCC_A1_CONTRACT_ID,
  TCC_A1_CONTRACT_VERSION,
  type TccA1CorpusExecutor,
  type TccA1CorpusManifest,
  type TccA1MaterializationTransientKind,
  type TccA1Outcome
} from './tcc-a1-corpus-runner';

type FixtureReservation =
  | {
    readonly endVertexId: string;
    readonly kind: 'Reserved';
    readonly startVertexId: string;
    readonly wallSegmentId: string;
  }
  | { readonly kind: 'Cancelled' | 'LostFence' | 'StaleBase' };

export type InitialWallMaterializationCorpusIntent = {
  readonly kind: 'initial-wall-materialization';
  readonly materializationInput: InitialWallMaterializationInput;
  readonly reservation: FixtureReservation;
};

const INITIAL_LIMITS = Object.freeze({
  coordinateAbsHardMm: 100_000,
  maxWallLengthMm: 10_000,
  maxWallThicknessMm: 500,
  minWallLengthMm: 100,
  minWallThicknessMm: 50,
  vertexHardCount: 2,
  wallSegmentHardCount: 1
});

const POLICY_HASH = 'a86d7d9ca1262f932355f1d8a6031b641f28b2446c9d4c455cc5f03d5d183369';
const EMPTY_GRAPH_DIGEST = '26674bcb07ee4e553621347ee3bcdd03c70088ddb02c35a54149ed272c885bcb';
const BASE_REVISION_CHECKSUM = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

export const initialWallMaterializationTccA1Corpus: TccA1CorpusManifest<InitialWallMaterializationCorpusIntent> = {
  contractId: TCC_A1_CONTRACT_ID,
  contractVersion: TCC_A1_CONTRACT_VERSION,
  corpusId: 'interiors.tcc-a1.initial-wall-materialization',
  corpusRevision: 1,
  executorRole: 'domain-kernel',
  fixtures: [
    acceptedFixture({
      end: { xMm: 2100, zMm: 200 },
      fixtureId: 'TCC-A1-INITIAL-WALL-001',
      intentDigest: '3baa3a1c6c58fa31eb3455809e07156794a419b45422c696cfdec87e83707f82',
      postStateDigest: 'b116fb1f12ea31c00681fc97b4fada776980b6119fed0370a139460c757d60ad',
      rawInput: '{"kind":"initial-wall-segment","start":{"xMm":100,"zMm":200},"end":{"xMm":2100,"zMm":200},"thicknessMm":120}',
      rawInputSha256: 'f85856b29bd5b9ebcfc43028975d02e14290b026c36f31734ddfa4fd78b143b2',
      reservation: { endVertexId: 'vertex-end-east', kind: 'Reserved', startVertexId: 'vertex-start-east', wallSegmentId: 'wall-east' }
    }),
    acceptedFixture({
      end: { xMm: 2100, zMm: 2200 },
      fixtureId: 'TCC-A1-INITIAL-WALL-002',
      intentDigest: '6b98c9237edd13480085e984b12802e420c3befed1cf766f99ad95e181b8a8fd',
      postStateDigest: '0cd4a12f9cd137889ff76a0ce0f4b5dacee6a6389b6d51cf463ba97fcba7caac',
      rawInput: '{"kind":"initial-wall-segment","start":{"xMm":100,"zMm":200},"end":{"xMm":2100,"zMm":2200},"thicknessMm":120}',
      rawInputSha256: 'e8a4ecad9eb57561c428c90a1c3342a07ff820af5ff372d200509e1986f26143',
      reservation: { endVertexId: 'vertex-end-ne', kind: 'Reserved', startVertexId: 'vertex-start-ne', wallSegmentId: 'wall-ne' }
    }),
    acceptedFixture({
      end: { xMm: -1900, zMm: 2200 },
      fixtureId: 'TCC-A1-INITIAL-WALL-003',
      intentDigest: '4dd7b4b07fece1aed7d5a35659bb58d995ecdbe77bc7a167e931bfa0e6db9b7a',
      postStateDigest: '5149963434918d2c5f4914d3828215d3f674fcf1c478e93247e528719fe306de',
      rawInput: '{"kind":"initial-wall-segment","start":{"xMm":100,"zMm":200},"end":{"xMm":-1900,"zMm":2200},"thicknessMm":120}',
      rawInputSha256: 'a1d02fe9eb4e21312e9401c980ce0ff433327171ba134342306bbfb056e7f453',
      reservation: { endVertexId: 'vertex-end-nw', kind: 'Reserved', startVertexId: 'vertex-start-nw', wallSegmentId: 'wall-nw' }
    }),
    acceptedFixture({
      end: { xMm: 2100, zMm: -1800 },
      fixtureId: 'TCC-A1-INITIAL-WALL-004',
      intentDigest: 'e803da664e5af0e6e412927c026fca75d29fe625d6748532fd7f72fbe3d97e54',
      postStateDigest: 'e312420a682b29b6c701465b08e4f90ea4d7383cf5ba66a02922414dabf8c0fa',
      rawInput: '{"kind":"initial-wall-segment","start":{"xMm":100,"zMm":200},"end":{"xMm":2100,"zMm":-1800},"thicknessMm":120}',
      rawInputSha256: 'cab9df8e23876b6536479a1c9cc7eda48f1e0ff4adee9a3115ff2c180833cb75',
      reservation: { endVertexId: 'vertex-end-se', kind: 'Reserved', startVertexId: 'vertex-start-se', wallSegmentId: 'wall-se' }
    }),
    acceptedFixture({
      end: { xMm: -1900, zMm: -1800 },
      fixtureId: 'TCC-A1-INITIAL-WALL-005',
      intentDigest: '3384a873db222480c3e26076c6de97f109000184bd02a3512e16f20f534cc709',
      postStateDigest: 'bade507f34285bac59ab0ed577f7057253e1d842b426e6527af700c7bda72238',
      rawInput: '{"kind":"initial-wall-segment","start":{"xMm":100,"zMm":200},"end":{"xMm":-1900,"zMm":-1800},"thicknessMm":120}',
      rawInputSha256: 'ec28de24b544658fb4f5457f4f1b8cb4eba0b136d334ee624940e84d370a36df',
      reservation: { endVertexId: 'vertex-end-sw', kind: 'Reserved', startVertexId: 'vertex-start-sw', wallSegmentId: 'wall-sw' }
    }),
    transientFixture('TCC-A1-INITIAL-WALL-006', 'Cancelled', '8351ed45f95d038a3a879edbfc999224eda4eb4ecd5901ee633a13e1048e1b46'),
    transientFixture('TCC-A1-INITIAL-WALL-007', 'StaleBase', 'c2d5095710dc782b776f81099f0cddc0341b7259583315c904e4d48f2a202764'),
    transientFixture('TCC-A1-INITIAL-WALL-008', 'LostFence', '9882547f08e078d6c5374fdd82c7af12d9132ea1e1c86deef57d516257d2d40f')
  ],
  policyReferences: [
    'architecture-spine.md#AD-21',
    'geometry-contract.md#1-mm-ingress-and-exact-direction-semantics',
    'topology-corpus-contract.md#2-fixture-outcome-contract'
  ]
};

export function createInitialWallMaterializationTccA1Executor(
  hashPort: ContentHashPort
): TccA1CorpusExecutor<InitialWallMaterializationCorpusIntent> {
  return {
    evaluate: async ({ baseStateDigest, intent }) => {
      if (intent.kind !== 'initial-wall-materialization'
        || baseStateDigest !== intent.materializationInput.permit.baseGraphDigest) {
        throw new TypeError('The initial-wall materialization corpus input is not bound to its base graph');
      }
      const result = await materializeInitialWallSegment({
        ...intent.materializationInput,
        hashPort,
        reservationPort: reservationPortFor(intent.reservation)
      });
      return adaptInitialWallMaterializationResultToTccA1Outcome(result, hashPort);
    }
  };
}

function acceptedFixture(input: {
  readonly end: { readonly xMm: number; readonly zMm: number };
  readonly fixtureId: string;
  readonly intentDigest: string;
  readonly postStateDigest: string;
  readonly rawInput: string;
  readonly rawInputSha256: string;
  readonly reservation: Extract<FixtureReservation, { readonly kind: 'Reserved' }>;
}): TccA1CorpusManifest<InitialWallMaterializationCorpusIntent>['fixtures'][number] {
  return {
    baseStateDigest: EMPTY_GRAPH_DIGEST,
    expected: {
      allocationIntent: ['startVertex', 'endVertex', 'wall'],
      inverseStateDigest: EMPTY_GRAPH_DIGEST,
      kind: 'accepted',
      opaqueCandidateRefs: [input.reservation.startVertexId, input.reservation.endVertexId, input.reservation.wallSegmentId],
      postStateDigest: input.postStateDigest
    },
    fixtureId: input.fixtureId,
    intent: materializationIntent(input.end, input.intentDigest, input.reservation),
    rawInputBytes: asciiBytes(input.rawInput),
    rawInputSha256: input.rawInputSha256
  };
}

function transientFixture(
  fixtureId: string,
  status: Extract<FixtureReservation, { readonly kind: 'Cancelled' | 'LostFence' | 'StaleBase' }>['kind'],
  rawInputSha256: string
): TccA1CorpusManifest<InitialWallMaterializationCorpusIntent>['fixtures'][number] {
  return {
    baseStateDigest: EMPTY_GRAPH_DIGEST,
    expected: {
      allocationIntent: [] as const,
      kind: 'transient',
      postStateDigest: EMPTY_GRAPH_DIGEST,
      transientKind: transientKind(status)
    },
    fixtureId,
    intent: materializationIntent({ xMm: 2100, zMm: 200 }, '3baa3a1c6c58fa31eb3455809e07156794a419b45422c696cfdec87e83707f82', { kind: status }),
    rawInputBytes: asciiBytes(`{"kind":"initial-wall-segment","start":{"xMm":100,"zMm":200},"end":{"xMm":2100,"zMm":200},"thicknessMm":120,"reservationOutcome":"${status}"}`),
    rawInputSha256
  };
}

function materializationIntent(
  end: { readonly xMm: number; readonly zMm: number },
  intentDigest: string,
  reservation: FixtureReservation
): InitialWallMaterializationCorpusIntent {
  return {
    kind: 'initial-wall-materialization',
    materializationInput: {
      emptyPlanGraph: {
        levelId: 'level-1',
        projectLimitsPolicyHash: POLICY_HASH,
        verticesById: {},
        wallSegmentsById: {}
      },
      intent: {
        end,
        kind: 'initial-wall-segment',
        levelId: 'level-1',
        projectLimits: INITIAL_LIMITS,
        projectLimitsPolicyHash: POLICY_HASH,
        start: { xMm: 100, zMm: 200 },
        thicknessMm: 120
      },
      permit: {
        baseGraphDigest: EMPTY_GRAPH_DIGEST,
        baseRevisionChecksum: BASE_REVISION_CHECKSUM,
        baseRevisionId: 'revision-1',
        cancellationGeneration: 3,
        intentDigest,
        permitNonce: 'permit-1',
        projectId: 'project-1',
        projectLimits: INITIAL_LIMITS,
        projectLimitsPolicyHash: POLICY_HASH,
        writerFenceGeneration: 7
      }
    },
    reservation
  };
}

function reservationPortFor(reservation: FixtureReservation): IdReservationPort {
  return {
    consumeIfCurrent: async (): Promise<InitialWallReservationResult> => reservation.kind === 'Reserved'
      ? { ...reservation, retireUnpublished: async () => 'Retired' }
      : { kind: reservation.kind }
  };
}

/**
 * Preserves every observable no-materialization property before the generic
 * TCC runner evaluates it. In particular, it never substitutes a fixture's
 * empty digest or allocation intent for values returned by the kernel.
 */
export async function adaptInitialWallMaterializationResultToTccA1Outcome(
  result: MaterializeInitialWallSegmentResult,
  hashPort: ContentHashPort
): Promise<TccA1Outcome> {
  if (result.kind === 'materialized') {
    return {
      allocationIntent: result.allocationIntent.slots.map((slot) => slot.label),
      inverseStateDigest: result.inverse.restoresGraphDigest,
      kind: 'accepted',
      opaqueCandidateRefs: result.allocationIntent.slots.map((slot) => 'vertexId' in slot ? slot.vertexId : slot.wallSegmentId),
      postStateDigest: result.changeSet.postGraphDigest
    };
  }
  if (result.status === 'Cancelled' || result.status === 'LostFence' || result.status === 'StaleBase') {
    return {
      allocationIntent: observedAllocationLabels(result.allocationIntent),
      kind: 'transient',
      postStateDigest: await digestEmptyPlanGraph(result.baseGraph, hashPort),
      transientKind: transientKind(result.status)
    };
  }
  throw new TypeError('The initial-wall corpus does not declare private route-unavailable outcomes');
}

function observedAllocationLabels(allocationIntent: unknown): readonly string[] {
  if (!isRecord(allocationIntent) || !Array.isArray(allocationIntent.slots)) {
    return Object.freeze(['invalid-allocation-intent']);
  }
  return Object.freeze(allocationIntent.slots.map((slot, index) => {
    if (isRecord(slot) && typeof slot.label === 'string' && slot.label.trim().length > 0) {
      return slot.label;
    }
    return `invalid-allocation-slot-${index}`;
  }));
}

async function digestEmptyPlanGraph(
  graph: EmptyPlanGraph | undefined,
  hashPort: ContentHashPort
): Promise<string> {
  if (!isCanonicalEmptyPlanGraph(graph)) {
    throw new TypeError('A TCC-A1 transient must retain its returned empty base graph');
  }
  const digest = await hashPort.sha256Utf8Ascii([
    'IWM-D1',
    'record=empty-plan-graph',
    `levelId=${graph.levelId.length}:${graph.levelId}`,
    `projectLimitsPolicyHash=64:${graph.projectLimitsPolicyHash}`,
    'vertices=[]',
    'wallSegments=[]'
  ].join('|'));
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new TypeError('The TCC-A1 content-hash port returned an invalid empty-graph digest');
  }
  return digest;
}

function transientKind(status: 'Cancelled' | 'LostFence' | 'StaleBase'): TccA1MaterializationTransientKind {
  return status === 'Cancelled' ? 'cancelled' : status === 'LostFence' ? 'lost-fence' : 'stale-base';
}

function asciiBytes(value: string): readonly number[] {
  return Object.freeze([...value].map((character) => character.charCodeAt(0)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCanonicalEmptyPlanGraph(value: unknown): value is EmptyPlanGraph {
  return isRecord(value)
    && typeof value.levelId === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value.levelId)
    && typeof value.projectLimitsPolicyHash === 'string'
    && /^[a-f0-9]{64}$/.test(value.projectLimitsPolicyHash)
    && isEmptyRecord(value.verticesById)
    && isEmptyRecord(value.wallSegmentsById);
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return isRecord(value) && Object.keys(value).length === 0;
}
