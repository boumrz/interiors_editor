import { describe, expect, it } from '@rstest/core';

import {
  materializeInitialWallSegment,
  removeInitialWall,
  type ContentHashPort,
  type IdReservationPort,
  type InitialWallMaterializationInput,
  type InitialWallReservationResult,
  type MaterializedInitialWall
} from './materialize-initial-wall-segment';

type TestInitialWallLimits = {
  readonly coordinateAbsHardMm: number;
  readonly maxWallLengthMm: number;
  readonly maxWallThicknessMm: number;
  readonly minWallLengthMm: number;
  readonly minWallThicknessMm: number;
  readonly vertexHardCount: number;
  readonly wallSegmentHardCount: number;
};

const initialLimits: TestInitialWallLimits = {
  coordinateAbsHardMm: 100_000,
  maxWallLengthMm: 10_000,
  maxWallThicknessMm: 500,
  minWallLengthMm: 100,
  minWallThicknessMm: 50,
  vertexHardCount: 2,
  wallSegmentHardCount: 1
};

const policyPreimage = 'IWM-D1|record=initial-wall-limits|coordinateAbsHardMm=100000|vertexHardCount=2|wallSegmentHardCount=1|minWallLengthMm=100|maxWallLengthMm=10000|minWallThicknessMm=50|maxWallThicknessMm=500';

describe('MaterializeInitialWallSegment', () => {
  it('materializes an immutable initial wall with exact slot order, binding hashes and inverse', async () => {
    const input = await createInput();
    const hashPort = recordingHashPort();
    const reservationCalls: unknown[] = [];
    const reservationPort: IdReservationPort = {
      consumeIfCurrent: async (permit, labels) => {
        reservationCalls.push({ labels: [...labels], permit });
        return reservedIds();
      }
    };

    const result = await materializeInitialWallSegment({ ...input, hashPort, reservationPort });

    expect(result.kind).toBe('materialized');
    if (result.kind !== 'materialized') {
      return;
    }

    const expectedPostGraphDigest = await sha256Ascii(postGraphPreimage(input.intent.projectLimitsPolicyHash));
    const expectedChangeSetBindingDigest = await sha256Ascii(changeSetPreimage(
      input.permit.baseGraphDigest,
      expectedPostGraphDigest,
      input.intent.projectLimitsPolicyHash
    ));
    const expectedInverseBindingDigest = await sha256Ascii(inversePreimage(
      input.permit.baseGraphDigest,
      expectedPostGraphDigest
    ));

    expect(result).toEqual({
      allocationIntent: {
        slots: [
          { label: 'startVertex', vertexId: 'vertex-start' },
          { label: 'endVertex', vertexId: 'vertex-end' },
          { label: 'wall', wallSegmentId: 'wall-initial' }
        ]
      },
      changeSet: {
        addedVertexIds: ['vertex-start', 'vertex-end'],
        addedWallSegmentId: 'wall-initial',
        baseGraphDigest: input.permit.baseGraphDigest,
        bindingDigest: expectedChangeSetBindingDigest,
        postGraphDigest: expectedPostGraphDigest,
        projectLimitsPolicyHash: input.intent.projectLimitsPolicyHash,
        roomOpeningHostEffects: []
      },
      inverse: {
        bindingDigest: expectedInverseBindingDigest,
        endVertexId: 'vertex-end',
        expectedPostGraphDigest,
        restoresGraphDigest: input.permit.baseGraphDigest,
        startVertexId: 'vertex-start',
        wallSegmentId: 'wall-initial'
      },
      kind: 'materialized',
      nextPlanGraph: {
        levelId: 'level-1',
        projectLimitsPolicyHash: input.intent.projectLimitsPolicyHash,
        verticesById: {
          'vertex-end': { xMm: 2100, zMm: 200 },
          'vertex-start': { xMm: 100, zMm: 200 }
        },
        wallSegmentsById: {
          'wall-initial': {
            endVertexId: 'vertex-end',
            startVertexId: 'vertex-start',
            thicknessMm: 120
          }
        }
      }
    });
    expect(reservationCalls).toEqual([{
      labels: ['startVertex', 'endVertex', 'wall'],
      permit: input.permit
    }]);
    expect(hashPort.preimages).toEqual([
      policyPreimage,
      emptyGraphPreimage(input.intent.projectLimitsPolicyHash),
      intentPreimage(input.intent.projectLimitsPolicyHash),
      postGraphPreimage(input.intent.projectLimitsPolicyHash),
      changeSetPreimage(input.permit.baseGraphDigest, expectedPostGraphDigest, input.intent.projectLimitsPolicyHash),
      inversePreimage(input.permit.baseGraphDigest, expectedPostGraphDigest)
    ]);
    expectDeeplyFrozen(result);

    mutateViaUntypedBoundary(input.intent.start, 'xMm', 999);
    mutateViaUntypedBoundary(input.emptyPlanGraph.verticesById, 'unexpected', { xMm: 1, zMm: 1 });
    expect(result.nextPlanGraph.verticesById['vertex-start']).toEqual({ xMm: 100, zMm: 200 });
    expect(result.nextPlanGraph.verticesById).not.toHaveProperty('unexpected');
  });

  it.each([
    ['Cancelled'],
    ['StaleBase'],
    ['LostFence']
  ] as const)('keeps the exact empty base and exposes no allocation for %s', async (status) => {
    const input = await createInput();
    const hashPort = recordingHashPort();
    let calls = 0;
    const reservationPort: IdReservationPort = {
      consumeIfCurrent: async () => {
        calls += 1;
        return { kind: status };
      }
    };

    await expect(materializeInitialWallSegment({ ...input, hashPort, reservationPort })).resolves.toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status
    });
    expect(calls).toBe(1);
  });

  it('rejects a policy-hash mismatch before consuming the permit', async () => {
    const input = await createInput();
    const hashPort = recordingHashPort();
    let calls = 0;
    const reservationPort: IdReservationPort = {
      consumeIfCurrent: async () => {
        calls += 1;
        return reservedIds();
      }
    };

    const result = await materializeInitialWallSegment({
      ...input,
      hashPort,
      reservationPort,
      intent: { ...input.intent, projectLimitsPolicyHash: 'f'.repeat(64) }
    });

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(calls).toBe(0);
  });

  it('rejects a rederived valid policy hash when it does not bind the immutable intent', async () => {
    const input = await createInput();
    let reservationCalls = 0;
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort: {
        sha256Utf8Ascii: async (preimage) => preimage === policyPreimageFor(input.intent.projectLimits)
          ? 'a'.repeat(64)
          : sha256Ascii(preimage)
      },
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    });

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it.each([
    ['a negative coordinate hard bound', { coordinateAbsHardMm: -1 }],
    ['a negative vertex hard count', { vertexHardCount: -1 }],
    ['a negative wall hard count', { wallSegmentHardCount: -1 }],
    ['a zero minimum wall length', { minWallLengthMm: 0 }],
    ['a zero maximum wall length', { maxWallLengthMm: 0 }],
    ['a zero minimum wall thickness', { minWallThicknessMm: 0 }],
    ['a zero maximum wall thickness', { maxWallThicknessMm: 0 }],
    ['an inverted wall-length interval', { minWallLengthMm: 10_001 }],
    ['an inverted wall-thickness interval', { minWallThicknessMm: 501 }]
  ] as const)('rejects %s in the canonical limits projection before consuming a permit', async (_caseName, limits) => {
    const input = await createInput();
    let reservationCalls = 0;
    const request = {
      ...input,
      intent: { ...input.intent, projectLimits: { ...input.intent.projectLimits, ...limits } },
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    };

    const result = await Reflect.apply(materializeInitialWallSegment, undefined, [request]);
    expect(result).toMatchObject({
      allocationIntent: { slots: [] },
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it.each([
    ['a different base level', (input: InitialWallMaterializationInput) => ({
      ...input,
      emptyPlanGraph: { ...input.emptyPlanGraph, levelId: 'level-2' }
    })],
    ['a different base policy hash', (input: InitialWallMaterializationInput) => ({
      ...input,
      emptyPlanGraph: { ...input.emptyPlanGraph, projectLimitsPolicyHash: 'a'.repeat(64) }
    })],
    ['a different permit policy hash', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, projectLimitsPolicyHash: 'a'.repeat(64) }
    })],
    ['a different permit coordinate hard bound', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, projectLimits: { ...input.permit.projectLimits, coordinateAbsHardMm: 99_999 } }
    })],
    ['a different permit vertex hard count', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, projectLimits: { ...input.permit.projectLimits, vertexHardCount: 3 } }
    })],
    ['a different permit wall hard count', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, projectLimits: { ...input.permit.projectLimits, wallSegmentHardCount: 2 } }
    })],
    ['a different permit minimum wall length', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, projectLimits: { ...input.permit.projectLimits, minWallLengthMm: 99 } }
    })],
    ['a different permit maximum wall length', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, projectLimits: { ...input.permit.projectLimits, maxWallLengthMm: 10_001 } }
    })],
    ['a different permit minimum wall thickness', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, projectLimits: { ...input.permit.projectLimits, minWallThicknessMm: 51 } }
    })],
    ['a different permit maximum wall thickness', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, projectLimits: { ...input.permit.projectLimits, maxWallThicknessMm: 499 } }
    })]
  ] as const)('does not consume a permit with %s', async (_caseName, change) => {
    const input = await createInput();
    let reservationCalls = 0;
    const result = await materializeInitialWallSegment({
      ...change(input),
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    });

    expect(result).toMatchObject({
      allocationIntent: { slots: [] },
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it.each([
    ['the rederived empty-graph digest', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, baseGraphDigest: 'e'.repeat(64) }
    })],
    ['the rederived canonical intent digest', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, intentDigest: 'd'.repeat(64) }
    })]
  ] as const)('refuses a permit whose %s does not bind the current route', async (_caseName, change) => {
    const input = await createInput();
    let calls = 0;
    const result = await materializeInitialWallSegment({
      ...change(input),
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async () => {
          calls += 1;
          return reservedIds();
        }
      }
    });

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(calls).toBe(0);
  });

  it.each([
    ['a nonempty base graph', (input: InitialWallMaterializationInput) => ({
      ...input,
      emptyPlanGraph: {
        ...input.emptyPlanGraph,
        verticesById: { 'unexpected-vertex': { xMm: 1, zMm: 1 } }
      }
    })],
    ['an extra field in the canonical empty graph', (input: InitialWallMaterializationInput) => ({
      ...input,
      emptyPlanGraph: { ...input.emptyPlanGraph, unexpected: true }
    })],
    ['a noncanonical intent kind', (input: InitialWallMaterializationInput) => ({
      ...input,
      intent: { ...input.intent, kind: 'add-wall-segment' }
    })],
    ['an unsafe canonical endpoint component', (input: InitialWallMaterializationInput) => ({
      ...input,
      intent: { ...input.intent, start: { ...input.intent.start, xMm: Number.MAX_SAFE_INTEGER + 1 } }
    })],
    ['an invalid opaque permit nonce', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, permitNonce: 'permit|bad' }
    })],
    ['an invalid durable revision checksum', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, baseRevisionChecksum: 'not-a-hash' }
    })],
    ['a durable revision checksum with a leading byte', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, baseRevisionChecksum: `x${input.permit.baseRevisionChecksum}` }
    })],
    ['a durable revision checksum with a trailing byte', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, baseRevisionChecksum: `${input.permit.baseRevisionChecksum}x` }
    })],
    ['a negative cancellation generation', (input: InitialWallMaterializationInput) => ({
      ...input,
      permit: { ...input.permit, cancellationGeneration: -1 }
    })]
  ] as const)('treats %s as private no-materialization before calling the reservation port', async (_caseName, change) => {
    const input = await createInput();
    let calls = 0;
    const untypedRequest = {
      ...change(input),
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async () => {
          calls += 1;
          return reservedIds();
        }
      }
    };

    const result = await Reflect.apply(materializeInitialWallSegment, undefined, [untypedRequest]);
    expect(result).toMatchObject({
      allocationIntent: { slots: [] },
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(calls).toBe(0);
  });

  it('rejects a negative-zero endpoint before consuming an otherwise matching permit', async () => {
    const input = await createInput({ start: { xMm: 0, zMm: 200 } });
    let reservationCalls = 0;
    const result = await Reflect.apply(materializeInitialWallSegment, undefined, [{
      ...input,
      hashPort: recordingHashPort(),
      intent: {
        ...input.intent,
        start: { ...input.intent.start, xMm: -0 }
      },
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    }]);

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it('rejects a string endpoint component before consuming an otherwise matching permit', async () => {
    const input = await createInput({ start: { xMm: 0, zMm: 200 } });
    let reservationCalls = 0;
    const result = await Reflect.apply(materializeInitialWallSegment, undefined, [{
      ...input,
      hashPort: recordingHashPort(),
      intent: {
        ...input.intent,
        start: { ...input.intent.start, xMm: '0' }
      },
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    }]);

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it('rejects a zero minimum wall length before consuming its matching permit projection', async () => {
    const input = await createInput({ limits: { minWallLengthMm: 0 } });
    let reservationCalls = 0;
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    });

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it('rejects matching intent and permit limit projections with an unknown field before reserve', async () => {
    const input = await createInput();
    const limitsWithUnknownField = { ...input.intent.projectLimits, unexpected: true };
    let reservationCalls = 0;
    const result = await Reflect.apply(materializeInitialWallSegment, undefined, [{
      ...input,
      hashPort: recordingHashPort(),
      intent: { ...input.intent, projectLimits: limitsWithUnknownField },
      permit: { ...input.permit, projectLimits: limitsWithUnknownField },
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    }]);

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it('does not let the reservation port mutate a permit or its fixed slot order', async () => {
    const input = await createInput();
    const mutableAttempts: boolean[] = [];
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async (permit, labels) => {
          mutableAttempts.push(
            Reflect.set(permit, 'permitNonce', 'replaced-nonce'),
            Reflect.set(permit.projectLimits, 'maxWallLengthMm', 1),
            Reflect.set(labels, 0, 'wall')
          );
          return reservedIds();
        }
      }
    });

    expect(result.kind).toBe('materialized');
    expect(mutableAttempts).toEqual([false, false, false]);
    expect(input.permit.permitNonce).toBe('permit-1');
    expect(input.permit.projectLimits.maxWallLengthMm).toBe(10_000);
  });

  it('snapshots valid reserved IDs before an awaited hash can mutate the port-owned tuple', async () => {
    const input = await createInput();
    const portOwnedReservation = mutableReservedIds();
    const hashPort = recordingHashPort({
      onPreimage: (preimage) => {
        if (preimage.startsWith('IWM-D1|record=plan-graph|')) {
          portOwnedReservation.endVertexId = 'vertex-mutated-after-return';
        }
      }
    });
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort,
      reservationPort: { consumeIfCurrent: async () => portOwnedReservation }
    });

    expect(result).toMatchObject({
      allocationIntent: {
        slots: [
          { label: 'startVertex', vertexId: 'vertex-start' },
          { label: 'endVertex', vertexId: 'vertex-end' },
          { label: 'wall', wallSegmentId: 'wall-initial' }
        ]
      },
      changeSet: { addedVertexIds: ['vertex-start', 'vertex-end'] },
      inverse: { endVertexId: 'vertex-end' },
      kind: 'materialized'
    });
  });

  it('terminally retires a valid reservation after a post-reservation failure before retrying', async () => {
    const input = await createInput();
    let retired = false;
    const reservationPort: IdReservationPort = {
      consumeIfCurrent: async () => retired
        ? {
          endVertexId: 'vertex-end-retry',
          kind: 'Reserved',
          retireUnpublished: async () => 'Retired',
          startVertexId: 'vertex-start-retry',
          wallSegmentId: 'wall-initial-retry'
        }
        : {
          endVertexId: 'vertex-end',
          kind: 'Reserved',
          retireUnpublished: async () => {
            retired = true;
            return 'Retired';
          },
          startVertexId: 'vertex-start',
          wallSegmentId: 'wall-initial'
        }
    };

    await expect(materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort({ throwAtPreimage: postGraphPreimage(input.intent.projectLimitsPolicyHash) }),
      reservationPort
    })).resolves.toMatchObject({ kind: 'not-materialized', status: 'InitialRouteUnavailable' });
    expect(retired).toBe(true);

    const retry = await materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort
    });
    expect(retry).toMatchObject({
      allocationIntent: {
        slots: [
          { label: 'startVertex', vertexId: 'vertex-start-retry' },
          { label: 'endVertex', vertexId: 'vertex-end-retry' },
          { label: 'wall', wallSegmentId: 'wall-initial-retry' }
        ]
      },
      kind: 'materialized'
    });
  });

  it('locally fences a tuple when the terminal port callback itself rejects', async () => {
    const input = await createInput();
    let reservationCalls = 0;
    const reservationPort: IdReservationPort = {
      consumeIfCurrent: async () => {
        reservationCalls += 1;
        return {
          ...reservedIds(),
          retireUnpublished: async () => {
            throw new TypeError('terminal backend unavailable');
          }
        };
      }
    };

    await expect(materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort({ throwAtPreimage: postGraphPreimage(input.intent.projectLimitsPolicyHash) }),
      reservationPort
    })).resolves.toMatchObject({ kind: 'not-materialized', status: 'InitialRouteUnavailable' });

    await expect(materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort
    })).resolves.toMatchObject({
      allocationIntent: { slots: [] },
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(1);
  });

  it('fences a shared authority when a wrapper reports an unconfirmed terminal result', async () => {
    const input = await createInput();
    const authorityKey = Object.freeze({});
    const unconfirmedPort = {
      authorityKey,
      consumeIfCurrent: async () => ({
        ...mutableReservedIds(),
        retireUnpublished: async () => 'NotRetired'
      })
    };

    await expect(Reflect.apply(materializeInitialWallSegment, undefined, [{
      ...input,
      hashPort: recordingHashPort({ throwAtPreimage: postGraphPreimage(input.intent.projectLimitsPolicyHash) }),
      reservationPort: unconfirmedPort
    }])).resolves.toMatchObject({ kind: 'not-materialized', status: 'InitialRouteUnavailable' });

    let wrapperCalls = 0;
    const wrapperOverSameAuthority: IdReservationPort = {
      authorityKey,
      consumeIfCurrent: async () => {
        wrapperCalls += 1;
        return reservedIds();
      }
    };
    await expect(materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: wrapperOverSameAuthority
    })).resolves.toMatchObject({
      allocationIntent: { slots: [] },
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(wrapperCalls).toBe(0);
  });

  it('calls a method-style terminal callback with its reservation reply as receiver', async () => {
    const input = await createInput();
    const reply = {
      endVertexId: 'vertex-end',
      kind: 'Reserved' as const,
      retired: false,
      retireUnpublished(): Promise<'Retired'> {
        this.retired = true;
        return Promise.resolve('Retired');
      },
      startVertexId: 'vertex-start',
      wallSegmentId: 'wall-initial'
    };

    await expect(materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort({ throwAtPreimage: postGraphPreimage(input.intent.projectLimitsPolicyHash) }),
      reservationPort: { consumeIfCurrent: async () => reply }
    })).resolves.toMatchObject({ kind: 'not-materialized' });
    expect(reply.retired).toBe(true);
  });

  it('takes a single value snapshot from a volatile reservation reply', async () => {
    const input = await createInput();
    let startReads = 0;
    let endReads = 0;
    let wallReads = 0;
    const volatileReply = Object.defineProperties({}, {
      endVertexId: {
        enumerable: true,
        get: () => (++endReads === 1 ? 'vertex-end' : 'vertex-end-replaced')
      },
      kind: { enumerable: true, get: () => 'Reserved' },
      retireUnpublished: { enumerable: true, get: () => async () => 'Retired' },
      startVertexId: {
        enumerable: true,
        get: () => (++startReads === 1 ? 'vertex-start' : 'vertex-start-replaced')
      },
      wallSegmentId: {
        enumerable: true,
        get: () => (++wallReads === 1 ? 'wall-initial' : 'wall-initial-replaced')
      }
    });

    const result = await Reflect.apply(materializeInitialWallSegment, undefined, [{
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: { consumeIfCurrent: async () => volatileReply }
    }]);

    expect(result).toMatchObject({
      allocationIntent: {
        slots: [
          { label: 'startVertex', vertexId: 'vertex-start' },
          { label: 'endVertex', vertexId: 'vertex-end' },
          { label: 'wall', wallSegmentId: 'wall-initial' }
        ]
      },
      kind: 'materialized'
    });
    expect({ endReads, startReads, wallReads }).toEqual({ endReads: 1, startReads: 1, wallReads: 1 });
  });

  it('contains a hostile getter at the runtime guard without touching a reservation port', async () => {
    let reservationCalls = 0;
    const hostileRequest = Object.defineProperty({
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    }, 'emptyPlanGraph', {
      enumerable: true,
      get: () => {
        throw new TypeError('hostile getter');
      }
    });

    await expect(Reflect.apply(materializeInitialWallSegment, undefined, [hostileRequest])).resolves.toEqual({
      allocationIntent: { slots: [] },
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it('discards an invalid reserved tuple without exposing a partial materialization', async () => {
    const input = await createInput();
    const hashPort = recordingHashPort();
    const malformedReservationPort = {
      consumeIfCurrent: async () => ({
        endVertexId: 'vertex-duplicate',
        kind: 'Reserved',
        startVertexId: 'vertex-duplicate',
        wallSegmentId: 'wall-initial'
      })
    };

    await expect(Reflect.apply(materializeInitialWallSegment, undefined, [{
      ...input,
      hashPort,
      reservationPort: malformedReservationPort
    }])).resolves.toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
  });

  it.each([
    ['a start/end collision', { endVertexId: 'vertex-start' }],
    ['a start/wall collision', { wallSegmentId: 'vertex-start' }],
    ['an end/wall collision', { wallSegmentId: 'vertex-end' }]
  ] as const)('discards a reserved reply with %s before creating a candidate', async (_caseName, change) => {
    const input = await createInput();
    const result = await Reflect.apply(materializeInitialWallSegment, undefined, [{
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: { consumeIfCurrent: async () => ({ ...mutableReservedIds(), ...change }) }
    }]);

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
  });

  it('does not consume a permit when a hash port returns a malformed limits digest', async () => {
    const input = await createInput();
    let reservationCalls = 0;
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort: {
        sha256Utf8Ascii: async (preimage) => preimage.includes('record=initial-wall-limits')
          ? 'invalid-digest'
          : sha256Ascii(preimage)
      },
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    });

    expect(result).toMatchObject({ kind: 'not-materialized', status: 'InitialRouteUnavailable' });
    expect(reservationCalls).toBe(0);
  });

  it.each([
    'plan-graph',
    'initial-wall-change-set',
    'remove-initial-wall'
  ])('retires the tuple if %s hashing cannot yield a ContentHash', async (record) => {
    const input = await createInput();
    let retireCalls = 0;
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort: {
        sha256Utf8Ascii: async (preimage) => preimage.includes(`record=${record}`)
          ? 'invalid-digest'
          : sha256Ascii(preimage)
      },
      reservationPort: {
        consumeIfCurrent: async () => ({
          ...reservedIds(),
          retireUnpublished: async () => {
            retireCalls += 1;
            return 'Retired';
          }
        })
      }
    });

    expect(result).toMatchObject({ allocationIntent: { slots: [] }, kind: 'not-materialized' });
    expect(retireCalls).toBe(1);
  });

  it('does not expose a reservation when post-reservation construction fails', async () => {
    const input = await createInput();
    const hashPort = recordingHashPort({ throwAtPreimage: postGraphPreimage(input.intent.projectLimitsPolicyHash) });
    const reservationPort: IdReservationPort = {
      consumeIfCurrent: async () => reservedIds()
    };

    await expect(materializeInitialWallSegment({ ...input, hashPort, reservationPort })).resolves.toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
  });

  it.each([
    ['E', { xMm: 1100, zMm: 200 }],
    ['N', { xMm: 100, zMm: 1200 }],
    ['NE', { xMm: 1100, zMm: 1200 }],
    ['NW', { xMm: -900, zMm: 1200 }],
    ['SE', { xMm: 1100, zMm: -800 }],
    ['SW', { xMm: -900, zMm: -800 }]
  ] as const)('accepts the canonical %s direction before the shared topology route expands', async (_direction, end) => {
    const input = await createInput({ end });
    let reservationCalls = 0;
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    });

    expect(result.kind).toBe('materialized');
    expect(reservationCalls).toBe(1);
  });

  it.each([
    ['a zero-length canonical intent', { end: { xMm: 100, zMm: 200 } }],
    ['an unsupported canonical slope', { end: { xMm: 1100, zMm: 700 } }],
    ['a point just outside the coordinate hard limit', { end: { xMm: 100_001, zMm: 200 } }],
    [
      'a point outside the coordinate hard limit even when its wall length is otherwise allowed',
      {
        end: { xMm: 100_001, zMm: 0 },
        limits: { maxWallLengthMm: 100_001 },
        start: { xMm: 0, zMm: 0 }
      }
    ],
    [
      'a z coordinate outside the hard limit even when its wall length is otherwise allowed',
      {
        end: { xMm: 0, zMm: 100_001 },
        limits: { maxWallLengthMm: 100_001 },
        start: { xMm: 0, zMm: 0 }
      }
    ],
    ['a wall one millimetre shorter than the minimum', { end: { xMm: 199, zMm: 200 } }],
    ['a thickness one millimetre below the minimum', { thicknessMm: 49 }],
    ['a vertex count that cannot represent the wall', { limits: { vertexHardCount: 1 } }],
    ['a wall count that cannot represent the wall', { limits: { wallSegmentHardCount: 0 } }]
  ] as const)('does not consume a permit for %s', async (_caseName, overrides) => {
    const input = await createInput(overrides);
    let reservationCalls = 0;
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: {
        consumeIfCurrent: async () => {
          reservationCalls += 1;
          return reservedIds();
        }
      }
    });

    expect(result).toEqual({
      allocationIntent: { slots: [] },
      baseGraph: input.emptyPlanGraph,
      kind: 'not-materialized',
      status: 'InitialRouteUnavailable'
    });
    expect(reservationCalls).toBe(0);
  });

  it.each([
    ['the exact minimum wall length', { start: { xMm: 0, zMm: 0 }, end: { xMm: 100, zMm: 0 } }],
    ['the exact minimum thickness', { thicknessMm: 50 }],
    ['the exact maximum thickness', { thicknessMm: 500 }],
    [
      'the coordinate and maximum-length boundary',
      {
        end: { xMm: 100_000, zMm: 0 },
        limits: { maxWallLengthMm: 100_000 },
        start: { xMm: 0, zMm: 0 }
      }
    ],
    [
      'the z coordinate and maximum-length boundary',
      {
        end: { xMm: 0, zMm: 100_000 },
        limits: { maxWallLengthMm: 100_000 },
        start: { xMm: 0, zMm: 0 }
      }
    ]
  ] as const)('materializes at %s', async (_caseName, overrides) => {
    const input = await createInput(overrides);
    const result = await materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: { consumeIfCurrent: async () => reservedIds() }
    });

    expect(result.kind).toBe('materialized');
  });

  it('removes only the matching materialized graph through its exact inverse', async () => {
    const input = await createInput();
    const materialized = await materializeInitialWallSegment({
      ...input,
      hashPort: recordingHashPort(),
      reservationPort: { consumeIfCurrent: async () => reservedIds() }
    });
    expect(materialized.kind).toBe('materialized');
    if (materialized.kind !== 'materialized') {
      return;
    }

    await expect(removeInitialWall({
      hashPort: recordingHashPort(),
      inverse: materialized.inverse,
      planGraph: materialized.nextPlanGraph
    })).resolves.toEqual({
      kind: 'removed',
      restoredEmptyPlanGraph: input.emptyPlanGraph
    });

    const graphWithAnExtraVertex = {
      ...materialized.nextPlanGraph,
      verticesById: {
        ...materialized.nextPlanGraph.verticesById,
        'vertex-extra': { xMm: 500, zMm: 500 }
      }
    };
    await expect(removeInitialWall({
      hashPort: recordingHashPort(),
      inverse: materialized.inverse,
      planGraph: graphWithAnExtraVertex
    })).resolves.toEqual({ kind: 'not-removed' });

    await expect(removeInitialWall({
      hashPort: {
        sha256Utf8Ascii: async (preimage) => preimage.includes('record=plan-graph')
          ? 'invalid-digest'
          : sha256Ascii(preimage)
      },
      inverse: materialized.inverse,
      planGraph: materialized.nextPlanGraph
    })).resolves.toEqual({ kind: 'not-removed' });

    await expect(removeInitialWall({
      hashPort: recordingHashPort(),
      inverse: { ...materialized.inverse, expectedPostGraphDigest: 'c'.repeat(64) },
      planGraph: materialized.nextPlanGraph
    })).resolves.toEqual({ kind: 'not-removed' });

    await expect(removeInitialWall({
      hashPort: recordingHashPort(),
      inverse: { ...materialized.inverse, bindingDigest: 'c'.repeat(64) },
      planGraph: materialized.nextPlanGraph
    })).resolves.toEqual({ kind: 'not-removed' });

    await expect(removeInitialWall({
      hashPort: recordingHashPort(),
      inverse: materialized.inverse,
      planGraph: {
        ...materialized.nextPlanGraph,
        wallSegmentsById: {
          'wall-initial': {
            ...materialized.nextPlanGraph.wallSegmentsById['wall-initial'],
            endVertexId: 'vertex-start'
          }
        }
      }
    })).resolves.toEqual({ kind: 'not-removed' });

    await expect(Reflect.apply(removeInitialWall, undefined, [{
      hashPort: recordingHashPort(),
      inverse: { ...materialized.inverse, endVertexId: 'vertex|bad' },
      planGraph: materialized.nextPlanGraph
    }])).resolves.toEqual({ kind: 'not-removed' });

    await expect(Reflect.apply(removeInitialWall, undefined, [{
      hashPort: recordingHashPort(),
      inverse: { ...materialized.inverse, unexpected: true },
      planGraph: materialized.nextPlanGraph
    }])).resolves.toEqual({ kind: 'not-removed' });

    await expect(Reflect.apply(removeInitialWall, undefined, [{
      hashPort: recordingHashPort(),
      inverse: materialized.inverse,
      planGraph: {
        ...materialized.nextPlanGraph,
        verticesById: {
          ...materialized.nextPlanGraph.verticesById,
          'vertex-start': { xMm: Number.MAX_SAFE_INTEGER + 1, zMm: 200 }
        }
      }
    }])).resolves.toEqual({ kind: 'not-removed' });

    await expect(Reflect.apply(removeInitialWall, undefined, [{
      hashPort: recordingHashPort(),
      inverse: { ...materialized.inverse },
      planGraph: materialized.nextPlanGraph
    }])).resolves.toEqual({ kind: 'not-removed' });
  });
});

type InitialInputOverrides = {
  readonly end?: { readonly xMm: number; readonly zMm: number };
  readonly limits?: Partial<TestInitialWallLimits>;
  readonly start?: { readonly xMm: number; readonly zMm: number };
  readonly thicknessMm?: number;
};

async function createInput(overrides: InitialInputOverrides = {}): Promise<InitialWallMaterializationInput> {
  const limits = { ...initialLimits, ...overrides.limits };
  const start = overrides.start ?? { xMm: 100, zMm: 200 };
  const end = overrides.end ?? { xMm: 2100, zMm: 200 };
  const thicknessMm = overrides.thicknessMm ?? 120;
  const projectLimitsPolicyHash = await sha256Ascii(policyPreimageFor(limits));
  const baseGraphDigest = await sha256Ascii(emptyGraphPreimage(projectLimitsPolicyHash));
  const intentDigest = await sha256Ascii(intentPreimageFor({
    end,
    projectLimitsPolicyHash,
    start,
    thicknessMm
  }));
  return {
    emptyPlanGraph: {
      levelId: 'level-1',
      projectLimitsPolicyHash,
      verticesById: {},
      wallSegmentsById: {}
    },
    intent: {
      end,
      kind: 'initial-wall-segment',
      levelId: 'level-1',
      projectLimits: limits,
      projectLimitsPolicyHash,
      start,
      thicknessMm
    },
    permit: {
      baseGraphDigest,
      baseRevisionChecksum: 'b'.repeat(64),
      baseRevisionId: 'revision-1',
      cancellationGeneration: 3,
      intentDigest,
      permitNonce: 'permit-1',
      projectId: 'project-1',
      projectLimits: limits,
      projectLimitsPolicyHash,
      writerFenceGeneration: 7
    }
  };
}

function reservedIds(): InitialWallReservationResult {
  return {
    endVertexId: 'vertex-end',
    kind: 'Reserved',
    retireUnpublished: async () => 'Retired',
    startVertexId: 'vertex-start',
    wallSegmentId: 'wall-initial'
  };
}

function mutableReservedIds(): {
  endVertexId: string;
  kind: 'Reserved';
  retireUnpublished: () => Promise<'Retired'>;
  startVertexId: string;
  wallSegmentId: string;
} {
  return {
    endVertexId: 'vertex-end',
    kind: 'Reserved',
    retireUnpublished: async () => 'Retired',
    startVertexId: 'vertex-start',
    wallSegmentId: 'wall-initial'
  };
}

function recordingHashPort(options: {
  readonly onPreimage?: (preimage: string) => void;
  readonly throwAtPreimage?: string;
} = {}): ContentHashPort & { readonly preimages: string[] } {
  const preimages: string[] = [];
  return {
    preimages,
    sha256Utf8Ascii: async (preimage) => {
      preimages.push(preimage);
      options.onPreimage?.(preimage);
      if (preimage === options.throwAtPreimage) {
        throw new TypeError('intentional post-reservation hash failure');
      }
      return sha256Ascii(preimage);
    }
  };
}

function emptyGraphPreimage(projectLimitsPolicyHash: string): string {
  return `IWM-D1|record=empty-plan-graph|levelId=7:level-1|projectLimitsPolicyHash=64:${projectLimitsPolicyHash}|vertices=[]|wallSegments=[]`;
}

function policyPreimageFor(limits: TestInitialWallLimits): string {
  return `IWM-D1|record=initial-wall-limits|coordinateAbsHardMm=${limits.coordinateAbsHardMm}|vertexHardCount=${limits.vertexHardCount}|wallSegmentHardCount=${limits.wallSegmentHardCount}|minWallLengthMm=${limits.minWallLengthMm}|maxWallLengthMm=${limits.maxWallLengthMm}|minWallThicknessMm=${limits.minWallThicknessMm}|maxWallThicknessMm=${limits.maxWallThicknessMm}`;
}

function intentPreimage(projectLimitsPolicyHash: string): string {
  return intentPreimageFor({
    end: { xMm: 2100, zMm: 200 },
    projectLimitsPolicyHash,
    start: { xMm: 100, zMm: 200 },
    thicknessMm: 120
  });
}

function intentPreimageFor(intent: {
  readonly end: { readonly xMm: number; readonly zMm: number };
  readonly projectLimitsPolicyHash: string;
  readonly start: { readonly xMm: number; readonly zMm: number };
  readonly thicknessMm: number;
}): string {
  return `IWM-D1|record=initial-wall-intent|levelId=7:level-1|projectLimitsPolicyHash=64:${intent.projectLimitsPolicyHash}|start.xMm=${intent.start.xMm}|start.zMm=${intent.start.zMm}|end.xMm=${intent.end.xMm}|end.zMm=${intent.end.zMm}|thicknessMm=${intent.thicknessMm}`;
}

function postGraphPreimage(projectLimitsPolicyHash: string): string {
  return `IWM-D1|record=plan-graph|levelId=7:level-1|projectLimitsPolicyHash=64:${projectLimitsPolicyHash}|startVertex=12:vertex-start|start.xMm=100|start.zMm=200|endVertex=10:vertex-end|end.xMm=2100|end.zMm=200|wall=12:wall-initial|wall.startVertexId=12:vertex-start|wall.endVertexId=10:vertex-end|wall.thicknessMm=120`;
}

function changeSetPreimage(baseGraphDigest: string, postGraphDigest: string, projectLimitsPolicyHash: string): string {
  return `IWM-D1|record=initial-wall-change-set|baseGraphDigest=64:${baseGraphDigest}|postGraphDigest=64:${postGraphDigest}|projectLimitsPolicyHash=64:${projectLimitsPolicyHash}|startVertex=12:vertex-start|endVertex=10:vertex-end|wall=12:wall-initial|roomOpeningHostEffects=[]`;
}

function inversePreimage(baseGraphDigest: string, postGraphDigest: string): string {
  return `IWM-D1|record=remove-initial-wall|expectedPostGraphDigest=64:${postGraphDigest}|wall=12:wall-initial|startVertex=12:vertex-start|endVertex=10:vertex-end|restoresGraphDigest=64:${baseGraphDigest}`;
}

async function sha256Ascii(preimage: string): Promise<string> {
  const bytes = Uint8Array.from([...preimage].map((character) => character.charCodeAt(0)));
  const crypto = (globalThis as unknown as {
    readonly crypto: { readonly subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> } };
  }).crypto;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mutateViaUntypedBoundary(target: object, key: string, value: unknown): void {
  Reflect.set(target, key, value);
}

function expectDeeplyFrozen(value: MaterializedInitialWall): void {
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value.nextPlanGraph)).toBe(true);
  expect(Object.isFrozen(value.nextPlanGraph.verticesById)).toBe(true);
  expect(Object.isFrozen(value.nextPlanGraph.wallSegmentsById)).toBe(true);
  expect(Object.isFrozen(value.nextPlanGraph.verticesById['vertex-start'])).toBe(true);
  expect(Object.isFrozen(value.nextPlanGraph.verticesById['vertex-end'])).toBe(true);
  expect(Object.isFrozen(value.nextPlanGraph.wallSegmentsById['wall-initial'])).toBe(true);
  expect(Object.isFrozen(value.changeSet)).toBe(true);
  expect(Object.isFrozen(value.changeSet.addedVertexIds)).toBe(true);
  expect(Object.isFrozen(value.inverse)).toBe(true);
  expect(Object.isFrozen(value.allocationIntent)).toBe(true);
  expect(Object.isFrozen(value.allocationIntent.slots)).toBe(true);
}
