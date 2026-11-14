import { describe, expect, it } from '@rstest/core';

import {
  inspectTopologyCorpus,
  runTopologyCorpus,
  topologyCorpusV1,
  type TopologyCorpus,
  type TopologyCorpusExecutor,
  type TopologyCorpusOutcome
} from './topology-corpus';

const expectedOutcomesByVectorId = new Map<string, TopologyCorpusOutcome>(
  topologyCorpusV1.vectors.map((vector) => [vector.vectorId, vector.expected])
);

const matchingExecutor: TopologyCorpusExecutor = {
  evaluate: ({ vectorId }) => {
    const expected = expectedOutcomesByVectorId.get(vectorId);
    if (!expected) {
      throw new Error(`Missing fixture outcome: ${vectorId}`);
    }
    return expected;
  }
};

function corpusWith(vector: TopologyCorpus['vectors'][number]): TopologyCorpus {
  return {
    ...topologyCorpusV1,
    vectors: [vector]
  };
}

describe('topology corpus spine', () => {
  it('declares a versioned pre-adoption corpus without representing a kernel choice as adopted', () => {
    expect(inspectTopologyCorpus(topologyCorpusV1)).toEqual([]);
    expect(topologyCorpusV1).toEqual({
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
    });
  });

  it('reports every corpus vector and never mistakes a partial match for a passing run', () => {
    const direction = topologyCorpusV1.vectors.find((vector) => vector.vectorId === 'DIRECTION-001');
    if (direction?.expected.kind !== 'accepted') {
      throw new Error('Expected the direction fixture');
    }

    expect(runTopologyCorpus(topologyCorpusV1, matchingExecutor)).toEqual({
      kind: 'passed',
      records: [
        { kind: 'matched', vectorId: 'RAW-INGRESS-001' },
        { kind: 'matched', vectorId: 'DIRECTION-001' },
        { kind: 'matched', vectorId: 'CONTACT-001' },
        { kind: 'matched', vectorId: 'LIFECYCLE-001' },
        { kind: 'matched', vectorId: 'LIFECYCLE-002' }
      ]
    });
    expect(runTopologyCorpus(topologyCorpusV1, {
      evaluate: (input) => input.vectorId === direction.vectorId
        ? { ...direction.expected, inverseStateDigest: 'wrong-inverse' }
        : matchingExecutor.evaluate(input)
    })).toEqual({
      kind: 'failed',
      records: [
        { kind: 'matched', vectorId: 'RAW-INGRESS-001' },
        { kind: 'mismatched', reasonCode: 'INVERSE_STATE_MISMATCH', vectorId: 'DIRECTION-001' },
        { kind: 'matched', vectorId: 'CONTACT-001' },
        { kind: 'matched', vectorId: 'LIFECYCLE-001' },
        { kind: 'matched', vectorId: 'LIFECYCLE-002' }
      ]
    });
  });

  it('gives an executor only the versioned input, never its expected outcome', () => {
    const receivedInputs: unknown[] = [];

    expect(runTopologyCorpus(topologyCorpusV1, {
      evaluate: (input) => {
        receivedInputs.push(input);
        return matchingExecutor.evaluate(input);
      }
    })).toEqual({
      kind: 'passed',
      records: [
        { kind: 'matched', vectorId: 'RAW-INGRESS-001' },
        { kind: 'matched', vectorId: 'DIRECTION-001' },
        { kind: 'matched', vectorId: 'CONTACT-001' },
        { kind: 'matched', vectorId: 'LIFECYCLE-001' },
        { kind: 'matched', vectorId: 'LIFECYCLE-002' }
      ]
    });
    expect(receivedInputs).toEqual([
      { baseStateDigest: 'state:empty', operation: 'add-wall(raw-x="1.5")', vectorId: 'RAW-INGRESS-001' },
      {
        baseStateDigest: 'state:empty',
        operation: 'add-wall(start=(0,0), end=(1000,1000))',
        vectorId: 'DIRECTION-001'
      },
      {
        baseStateDigest: 'state:one-diagonal',
        operation: 'add-wall(requires-half-mm-x)',
        vectorId: 'CONTACT-001'
      },
      {
        baseStateDigest: 'state:revision-7',
        operation: 'replay-after-fence-loss',
        vectorId: 'LIFECYCLE-001'
      },
      {
        baseStateDigest: 'state:revision-7',
        operation: 'cancel-before-materialization',
        vectorId: 'LIFECYCLE-002'
      }
    ]);
  });

  it('proves an accepted vector against its post-state, allocation intent and inverse state', () => {
    const vector = topologyCorpusV1.vectors.find((candidate) => candidate.expected.kind === 'accepted');
    if (vector?.expected.kind !== 'accepted') {
      throw new Error('Expected an accepted fixture');
    }

    expect(runTopologyCorpus(corpusWith(vector), matchingExecutor)).toEqual({
      kind: 'passed',
      records: [{ kind: 'matched', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({ ...vector.expected, inverseStateDigest: 'wrong-inverse' })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'INVERSE_STATE_MISMATCH', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({ ...vector.expected, postStateDigest: 'wrong-post-state' })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'POST_STATE_MISMATCH', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({ ...vector.expected, allocatedIds: ['wrong-allocation'] })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'ALLOCATION_INTENT_MISMATCH', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({ ...vector.expected, allocatedIds: ['vertex:start', 'vertex:end'] })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'ALLOCATION_INTENT_MISMATCH', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({
        ...vector.expected,
        allocatedIds: ['vertex:start', 'wrong-middle', 'wall:added']
      })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'ALLOCATION_INTENT_MISMATCH', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({
        allocatedIds: [],
        kind: 'rejected',
        postStateDigest: vector.baseStateDigest,
        reasonCode: 'UNEXPECTED_REJECTION'
      })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'OUTCOME_KIND_MISMATCH', vectorId: vector.vectorId }]
    });
  });

  it('rejects any rejected result that changes state, allocates an ID or changes its reason', () => {
    const vector = topologyCorpusV1.vectors.find((candidate) => candidate.expected.kind === 'rejected');
    if (vector?.expected.kind !== 'rejected') {
      throw new Error('Expected a rejected fixture');
    }

    expect(runTopologyCorpus(corpusWith(vector), matchingExecutor)).toEqual({
      kind: 'passed',
      records: [{ kind: 'matched', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({ ...vector.expected, postStateDigest: 'changed-state' })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'REJECTED_STATE_CHANGED', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({ ...vector.expected, allocatedIds: ['must-not-allocate'] })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'REJECTED_IDS_ALLOCATED', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({ ...vector.expected, reasonCode: 'WRONG_REASON' })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'REASON_CODE_MISMATCH', vectorId: vector.vectorId }]
    });
    expect(runTopologyCorpus(corpusWith(vector), {
      evaluate: () => ({
        allocatedIds: [],
        inverseStateDigest: vector.baseStateDigest,
        kind: 'accepted',
        postStateDigest: vector.baseStateDigest
      })
    })).toEqual({
      kind: 'failed',
      records: [{ kind: 'mismatched', reasonCode: 'OUTCOME_KIND_MISMATCH', vectorId: vector.vectorId }]
    });
  });

  it('refuses malformed corpus declarations before asking an executor to evaluate them', () => {
    const first = topologyCorpusV1.vectors[0];
    const rejected = topologyCorpusV1.vectors.find((candidate) => candidate.vectorId === 'CONTACT-001');
    if (!first || !rejected || rejected.expected.kind !== 'rejected') {
      throw new Error('Expected corpus fixtures');
    }
    const invalid: TopologyCorpus = {
      ...topologyCorpusV1,
      vectors: [
        first,
        { ...rejected, expected: { ...rejected.expected, postStateDigest: 'not-the-base-state' } },
        { ...first }
      ]
    };

    expect(inspectTopologyCorpus(invalid)).toEqual([
      'REJECTED_VECTOR_MUST_PRESERVE_STATE:CONTACT-001',
      'DUPLICATE_VECTOR_ID:RAW-INGRESS-001'
    ]);
    expect(runTopologyCorpus(invalid, {
      evaluate: () => {
        throw new Error('An invalid corpus must not invoke the executor');
      }
    })).toEqual({
      kind: 'invalid-corpus',
      violations: [
        'REJECTED_VECTOR_MUST_PRESERVE_STATE:CONTACT-001',
        'DUPLICATE_VECTOR_ID:RAW-INGRESS-001'
      ]
    });

    const invalidNoMutationCorpus: TopologyCorpus = {
      ...topologyCorpusV1,
      vectors: [
        { ...first, vectorId: '' },
        { ...rejected, expected: { ...rejected.expected, allocatedIds: ['leaked-id'] } }
      ]
    };
    expect(inspectTopologyCorpus(invalidNoMutationCorpus)).toEqual([
      'INVALID_VECTOR_ID:',
      'REJECTED_VECTOR_MUST_NOT_ALLOCATE_IDS:CONTACT-001'
    ]);
  });

  it('refuses an accepted fixture whose inverse cannot restore its declared base state', () => {
    const accepted = topologyCorpusV1.vectors.find((candidate) => candidate.expected.kind === 'accepted');
    if (accepted?.expected.kind !== 'accepted') {
      throw new Error('Expected an accepted fixture');
    }

    expect(inspectTopologyCorpus({
      ...topologyCorpusV1,
      vectors: [{
        ...accepted,
        expected: { ...accepted.expected, inverseStateDigest: 'wrong-base-state' }
      }]
    })).toEqual(['ACCEPTED_VECTOR_INVERSE_MUST_RESTORE_BASE_STATE:DIRECTION-001']);
  });

  it('refuses blank or duplicate allocation-intent labels on an accepted fixture', () => {
    const accepted = topologyCorpusV1.vectors.find((candidate) => candidate.expected.kind === 'accepted');
    if (accepted?.expected.kind !== 'accepted') {
      throw new Error('Expected an accepted fixture');
    }

    expect(inspectTopologyCorpus({
      ...topologyCorpusV1,
      vectors: [{
        ...accepted,
        expected: { ...accepted.expected, allocatedIds: ['', 'vertex:start', 'vertex:start'] }
      }]
    })).toEqual([
      'INVALID_ALLOCATION_INTENT:DIRECTION-001',
      'DUPLICATE_ALLOCATION_INTENT:DIRECTION-001'
    ]);
  });
});
