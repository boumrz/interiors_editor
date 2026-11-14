/**
 * A versioned, pre-adoption corpus contract. It deliberately knows nothing
 * about the current V1/V2 topology implementation: a future adopted kernel
 * supplies the executor, while this module keeps its expected outcomes,
 * allocation intent and inverse proof reproducible.
 */
export interface TopologyCorpus {
  readonly corpusId: string;
  readonly kernel: TopologyCorpusKernel;
  readonly policyVersion: string;
  readonly runtimeVersion: string;
  readonly schemaVersion: 1;
  readonly vectors: readonly TopologyCorpusVector[];
}

export type TopologyCorpusKernel =
  | { readonly kind: 'pending-architecture-decision' }
  | { readonly kind: 'selected'; readonly implementationId: string; readonly version: string };

export interface TopologyCorpusExecutionInput {
  readonly baseStateDigest: string;
  readonly operation: string;
  readonly vectorId: string;
}

export interface TopologyCorpusVector extends TopologyCorpusExecutionInput {
  readonly category: 'raw-ingress' | 'direction' | 'contact' | 'lifecycle';
  readonly expected: TopologyCorpusOutcome;
}

export type TopologyCorpusOutcome = TopologyCorpusAcceptedOutcome | TopologyCorpusRejectedOutcome;

export interface TopologyCorpusAcceptedOutcome {
  /** Stable pre-materialization allocation intent labels, never Project IDs. */
  readonly allocatedIds: readonly string[];
  readonly inverseStateDigest: string;
  readonly kind: 'accepted';
  readonly postStateDigest: string;
}

export interface TopologyCorpusRejectedOutcome {
  readonly allocatedIds: readonly string[];
  readonly kind: 'rejected';
  readonly postStateDigest: string;
  readonly reasonCode: string;
}

export interface TopologyCorpusExecutor {
  evaluate(input: TopologyCorpusExecutionInput): TopologyCorpusOutcome;
}

export type TopologyCorpusInspectionViolation =
  | `ACCEPTED_VECTOR_INVERSE_MUST_RESTORE_BASE_STATE:${string}`
  | `DUPLICATE_ALLOCATION_INTENT:${string}`
  | `DUPLICATE_VECTOR_ID:${string}`
  | `INVALID_ALLOCATION_INTENT:${string}`
  | `INVALID_VECTOR_ID:${string}`
  | `REJECTED_VECTOR_MUST_NOT_ALLOCATE_IDS:${string}`
  | `REJECTED_VECTOR_MUST_PRESERVE_STATE:${string}`;

export type TopologyCorpusRecord =
  | { readonly kind: 'matched'; readonly vectorId: string }
  | {
      readonly kind: 'mismatched';
      readonly reasonCode:
        | 'ALLOCATION_INTENT_MISMATCH'
        | 'INVERSE_STATE_MISMATCH'
        | 'OUTCOME_KIND_MISMATCH'
        | 'POST_STATE_MISMATCH'
        | 'REASON_CODE_MISMATCH'
        | 'REJECTED_IDS_ALLOCATED'
        | 'REJECTED_STATE_CHANGED';
      readonly vectorId: string;
    };

export type TopologyCorpusRun =
  | { readonly kind: 'invalid-corpus'; readonly violations: readonly TopologyCorpusInspectionViolation[] }
  | { readonly kind: 'failed'; readonly records: readonly TopologyCorpusRecord[] }
  | { readonly kind: 'passed'; readonly records: readonly TopologyCorpusRecord[] };

/**
 * The initial vectors intentionally carry a pending kernel marker. Their
 * expected states are evidence requirements, not a claim that any current
 * application path already satisfies Alpha topology semantics.
 */
export const topologyCorpusV1: TopologyCorpus = {
  corpusId: 'interiors-topology-alpha-v1',
  kernel: { kind: 'pending-architecture-decision' },
  policyVersion: 'geometry-contract-2026-07-26',
  runtimeVersion: 'typescript-corpus-runner-v1',
  schemaVersion: 1,
  vectors: [
    {
      baseStateDigest: 'state:empty',
      category: 'raw-ingress',
      expected: {
        allocatedIds: [],
        kind: 'rejected',
        postStateDigest: 'state:empty',
        reasonCode: 'INVALID_RAW_LEXEME'
      },
      operation: 'add-wall(raw-x="1.5")',
      vectorId: 'RAW-INGRESS-001'
    },
    {
      baseStateDigest: 'state:empty',
      category: 'direction',
      expected: {
        allocatedIds: ['vertex:start', 'vertex:end', 'wall:added'],
        inverseStateDigest: 'state:empty',
        kind: 'accepted',
        postStateDigest: 'state:one-45-degree-wall'
      },
      operation: 'add-wall(start=(0,0), end=(1000,1000))',
      vectorId: 'DIRECTION-001'
    },
    {
      baseStateDigest: 'state:one-diagonal',
      category: 'contact',
      expected: {
        allocatedIds: [],
        kind: 'rejected',
        postStateDigest: 'state:one-diagonal',
        reasonCode: 'FRACTIONAL_INTERSECTION'
      },
      operation: 'add-wall(requires-half-mm-x)',
      vectorId: 'CONTACT-001'
    },
    {
      baseStateDigest: 'state:revision-7',
      category: 'lifecycle',
      expected: {
        allocatedIds: [],
        kind: 'rejected',
        postStateDigest: 'state:revision-7',
        reasonCode: 'STALE_BASE_REVISION'
      },
      operation: 'replay-after-fence-loss',
      vectorId: 'LIFECYCLE-001'
    },
    {
      baseStateDigest: 'state:revision-7',
      category: 'lifecycle',
      expected: {
        allocatedIds: [],
        kind: 'rejected',
        postStateDigest: 'state:revision-7',
        reasonCode: 'CANCELLED'
      },
      operation: 'cancel-before-materialization',
      vectorId: 'LIFECYCLE-002'
    }
  ]
};

export function inspectTopologyCorpus(corpus: TopologyCorpus): readonly TopologyCorpusInspectionViolation[] {
  const seenVectorIds = new Set<string>();
  const violations: TopologyCorpusInspectionViolation[] = [];
  for (const vector of corpus.vectors) {
    if (!vector.vectorId) {
      violations.push(`INVALID_VECTOR_ID:${vector.vectorId}`);
    } else if (seenVectorIds.has(vector.vectorId)) {
      violations.push(`DUPLICATE_VECTOR_ID:${vector.vectorId}`);
    }
    seenVectorIds.add(vector.vectorId);

    if (vector.expected.kind === 'accepted') {
      if (vector.expected.inverseStateDigest !== vector.baseStateDigest) {
        violations.push(`ACCEPTED_VECTOR_INVERSE_MUST_RESTORE_BASE_STATE:${vector.vectorId}`);
      }
      const allocationIntent = new Set<string>();
      for (const allocationId of vector.expected.allocatedIds) {
        if (!allocationId) {
          violations.push(`INVALID_ALLOCATION_INTENT:${vector.vectorId}`);
        } else if (allocationIntent.has(allocationId)) {
          violations.push(`DUPLICATE_ALLOCATION_INTENT:${vector.vectorId}`);
        }
        allocationIntent.add(allocationId);
      }
    } else {
      if (vector.expected.postStateDigest !== vector.baseStateDigest) {
        violations.push(`REJECTED_VECTOR_MUST_PRESERVE_STATE:${vector.vectorId}`);
      }
      if (vector.expected.allocatedIds.length !== 0) {
        violations.push(`REJECTED_VECTOR_MUST_NOT_ALLOCATE_IDS:${vector.vectorId}`);
      }
    }
  }
  return violations;
}

export function runTopologyCorpus(corpus: TopologyCorpus, executor: TopologyCorpusExecutor): TopologyCorpusRun {
  const violations = inspectTopologyCorpus(corpus);
  if (violations.length > 0) {
    return { kind: 'invalid-corpus', violations };
  }

  const records = corpus.vectors.map((vector) => inspectResult(vector, executor.evaluate(toExecutionInput(vector))));
  return records.every((record) => record.kind === 'matched')
    ? { kind: 'passed', records }
    : { kind: 'failed', records };
}

function inspectResult(vector: TopologyCorpusVector, observed: TopologyCorpusOutcome): TopologyCorpusRecord {
  const expected = vector.expected;
  if (expected.kind === 'accepted') {
    if (observed.kind !== 'accepted') {
      return mismatch(vector, 'OUTCOME_KIND_MISMATCH');
    }
    if (observed.postStateDigest !== expected.postStateDigest) {
      return mismatch(vector, 'POST_STATE_MISMATCH');
    }
    if (!sameTextSequence(observed.allocatedIds, expected.allocatedIds)) {
      return mismatch(vector, 'ALLOCATION_INTENT_MISMATCH');
    }
    return observed.inverseStateDigest === expected.inverseStateDigest
      ? matched(vector)
      : mismatch(vector, 'INVERSE_STATE_MISMATCH');
  }
  if (observed.kind !== 'rejected') {
    return mismatch(vector, 'OUTCOME_KIND_MISMATCH');
  }
  if (observed.postStateDigest !== vector.baseStateDigest) {
    return mismatch(vector, 'REJECTED_STATE_CHANGED');
  }
  if (observed.allocatedIds.length !== 0) {
    return mismatch(vector, 'REJECTED_IDS_ALLOCATED');
  }
  return observed.reasonCode === expected.reasonCode
    ? matched(vector)
    : mismatch(vector, 'REASON_CODE_MISMATCH');
}

function toExecutionInput(vector: TopologyCorpusVector): TopologyCorpusExecutionInput {
  return {
    baseStateDigest: vector.baseStateDigest,
    operation: vector.operation,
    vectorId: vector.vectorId
  };
}

function matched(vector: TopologyCorpusVector): TopologyCorpusRecord {
  return { kind: 'matched', vectorId: vector.vectorId };
}

function mismatch(
  vector: TopologyCorpusVector,
  reasonCode: Extract<TopologyCorpusRecord, { readonly kind: 'mismatched' }>['reasonCode']
): TopologyCorpusRecord {
  return { kind: 'mismatched', reasonCode, vectorId: vector.vectorId };
}

function sameTextSequence(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}
