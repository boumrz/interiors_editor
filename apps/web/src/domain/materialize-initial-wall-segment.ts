/**
 * AD-21's first materialized PlanGraph route.
 *
 * This is deliberately a constrained domain primitive: it can materialize one
 * canonical wall into an immutable empty graph, but it is not AddWallSegment.
 * It does not parse raw input, normalize contacts, write a Project/Revision,
 * publish history, or import V1/V2 and renderer/storage code.
 */

export type ContentHashPort = {
  sha256Utf8Ascii(preimage: string): Promise<string>;
};

export type InitialWallLimits = {
  readonly coordinateAbsHardMm: number;
  readonly maxWallLengthMm: number;
  readonly maxWallThicknessMm: number;
  readonly minWallLengthMm: number;
  readonly minWallThicknessMm: number;
  readonly vertexHardCount: number;
  readonly wallSegmentHardCount: number;
};

export type InitialPlanPoint = {
  readonly xMm: number;
  readonly zMm: number;
};

export type InitialWallIntent = {
  readonly end: InitialPlanPoint;
  readonly kind: 'initial-wall-segment';
  readonly levelId: string;
  readonly projectLimits: InitialWallLimits;
  readonly projectLimitsPolicyHash: string;
  readonly start: InitialPlanPoint;
  readonly thicknessMm: number;
};

export type EmptyPlanGraph = {
  readonly levelId: string;
  readonly projectLimitsPolicyHash: string;
  readonly verticesById: Readonly<Record<string, never>>;
  readonly wallSegmentsById: Readonly<Record<string, never>>;
};

export type MaterializationPermit = {
  readonly baseGraphDigest: string;
  /** AD-3 Durable Revision checksum. It is opaque to IWM-D1. */
  readonly baseRevisionChecksum: string;
  readonly baseRevisionId: string;
  readonly cancellationGeneration: number;
  readonly intentDigest: string;
  readonly permitNonce: string;
  readonly projectId: string;
  readonly projectLimits: InitialWallLimits;
  readonly projectLimitsPolicyHash: string;
  readonly writerFenceGeneration: number;
};

export type InitialWallReservationLabels = readonly ['startVertex', 'endVertex', 'wall'];

type InitialWallRetirementResult = 'Retired';

type InitialWallReservedIds = {
  readonly endVertexId: string;
  readonly startVertexId: string;
  readonly wallSegmentId: string;
};

type InitialWallReservedReservation = InitialWallReservedIds & {
  readonly kind: 'Reserved';
  /**
   * Terminally retires this unpublished tuple. It is invoked exactly when a
   * valid reservation cannot become a materialized candidate, so those IDs
   * cannot appear in a later retry.
   */
  readonly retireUnpublished: () => Promise<InitialWallRetirementResult>;
};

export type InitialWallReservationResult =
  | InitialWallReservedReservation
  | { readonly kind: 'Cancelled' }
  | { readonly kind: 'StaleBase' }
  | { readonly kind: 'LostFence' }
  | { readonly kind: 'InitialRouteUnavailable' };

/** The reservation port owns the one-shot, conditional permit consumption. */
export type IdReservationPort = {
  /**
   * Optional stable identity shared by wrappers over the same reservation
   * authority. A direct port instance is its own authority when omitted.
   */
  readonly authorityKey?: object;
  consumeIfCurrent(
    permit: MaterializationPermit,
    labels: InitialWallReservationLabels
  ): Promise<InitialWallReservationResult>;
};

export type InitialWallMaterializationInput = {
  readonly emptyPlanGraph: EmptyPlanGraph;
  readonly intent: InitialWallIntent;
  readonly permit: MaterializationPermit;
};

export type MaterializeInitialWallSegmentRequest = InitialWallMaterializationInput & {
  readonly hashPort: ContentHashPort;
  readonly reservationPort: IdReservationPort;
};

export type MaterializedPlanGraph = {
  readonly levelId: string;
  readonly projectLimitsPolicyHash: string;
  readonly verticesById: Readonly<Record<string, InitialPlanPoint>>;
  readonly wallSegmentsById: Readonly<Record<string, {
    readonly endVertexId: string;
    readonly startVertexId: string;
    readonly thicknessMm: number;
  }>>;
};

export type InitialWallChangeSet = {
  readonly addedVertexIds: readonly [string, string];
  readonly addedWallSegmentId: string;
  readonly baseGraphDigest: string;
  /** IWM-D1 hash of the complete ChangeSet binding record. */
  readonly bindingDigest: string;
  readonly postGraphDigest: string;
  readonly projectLimitsPolicyHash: string;
  readonly roomOpeningHostEffects: readonly [];
};

export type RemoveInitialWall = {
  /** IWM-D1 hash of the exact inverse binding record. */
  readonly bindingDigest: string;
  readonly endVertexId: string;
  readonly expectedPostGraphDigest: string;
  readonly restoresGraphDigest: string;
  readonly startVertexId: string;
  readonly wallSegmentId: string;
};

export type InitialWallAllocationIntent = {
  readonly slots: readonly [
    { readonly label: 'startVertex'; readonly vertexId: string },
    { readonly label: 'endVertex'; readonly vertexId: string },
    { readonly label: 'wall'; readonly wallSegmentId: string }
  ];
};

export type MaterializedInitialWall = {
  readonly allocationIntent: InitialWallAllocationIntent;
  readonly changeSet: InitialWallChangeSet;
  readonly inverse: RemoveInitialWall;
  readonly kind: 'materialized';
  readonly nextPlanGraph: MaterializedPlanGraph;
};

export type InitialWallNotMaterialized = {
  readonly allocationIntent: { readonly slots: readonly [] };
  readonly baseGraph?: EmptyPlanGraph;
  readonly kind: 'not-materialized';
  readonly status: 'Cancelled' | 'StaleBase' | 'LostFence' | 'InitialRouteUnavailable';
};

export type MaterializeInitialWallSegmentResult = MaterializedInitialWall | InitialWallNotMaterialized;

export type RemoveInitialWallRequest = {
  readonly hashPort: ContentHashPort;
  readonly inverse: RemoveInitialWall;
  readonly planGraph: MaterializedPlanGraph;
};

export type RemoveInitialWallResult =
  | { readonly kind: 'not-removed' }
  | { readonly kind: 'removed'; readonly restoredEmptyPlanGraph: EmptyPlanGraph };

const RESERVATION_LABELS: InitialWallReservationLabels = Object.freeze([
  'startVertex',
  'endVertex',
  'wall'
]) as InitialWallReservationLabels;

const CONTENT_HASH = /^[a-f0-9]{64}$/;
const OPAQUE_ASCII_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const issuedInitialWallInverses = new WeakSet<object>();
const locallyFencedReservationAuthorities = new WeakSet<object>();

/**
 * Derives all IWM-D1 bindings before the one linearization point, then asks
 * the port to consume the permit and reserve all three IDs atomically.
 */
export async function materializeInitialWallSegment(
  request: MaterializeInitialWallSegmentRequest
): Promise<MaterializeInitialWallSegmentResult> {
  let baseGraph: EmptyPlanGraph | undefined;
  let reservationPortForRetirement: IdReservationPort | undefined;
  let reservationForRetirement: InitialWallReservedReservation | undefined;
  try {
    if (!isRecord(request)) {
      return noMaterialization('InitialRouteUnavailable');
    }
    baseGraph = readEmptyPlanGraph(request.emptyPlanGraph);
    if (!baseGraph) {
      return noMaterialization('InitialRouteUnavailable');
    }
    const intent = readInitialWallIntent(request.intent);
    const permit = readMaterializationPermit(request.permit);
    const hashPort = request.hashPort;
    const reservationPort = request.reservationPort;
    if (!intent || !permit || !isHashPort(hashPort) || !isReservationPort(reservationPort)) {
      return noMaterialization('InitialRouteUnavailable', baseGraph);
    }
    if (!hasMatchingStaticBindings(baseGraph, intent, permit) || !isValidInitialWall(intent)) {
      return noMaterialization('InitialRouteUnavailable', baseGraph);
    }
    if (isLocallyFencedAuthority(reservationPort)) {
      return noMaterialization('InitialRouteUnavailable', baseGraph);
    }

    const policyHash = await digest(hashPort, limitsPreimage(intent.projectLimits));
    if (!policyHash || policyHash !== intent.projectLimitsPolicyHash) {
      return noMaterialization('InitialRouteUnavailable', baseGraph);
    }
    const baseGraphDigest = await digest(hashPort, emptyGraphPreimage(baseGraph));
    if (!baseGraphDigest || baseGraphDigest !== permit.baseGraphDigest) {
      return noMaterialization('InitialRouteUnavailable', baseGraph);
    }
    const intentDigest = await digest(hashPort, intentPreimage(intent));
    if (!intentDigest || intentDigest !== permit.intentDigest) {
      return noMaterialization('InitialRouteUnavailable', baseGraph);
    }

    const reservationReply = await reservationPort.consumeIfCurrent(
      clonePermit(permit),
      RESERVATION_LABELS
    );
    const reservation = readReservedReservation(reservationReply);
    if (!reservation) {
      const status = isRecord(reservationReply) && isReservationStatus(reservationReply.kind)
        ? reservationReply.kind
        : 'InitialRouteUnavailable';
      return noMaterialization(
        status,
        baseGraph
      );
    }
    reservationPortForRetirement = reservationPort;
    reservationForRetirement = reservation;

    const nextPlanGraph = createSingleWallGraph(baseGraph, intent, reservation);
    const postGraphDigest = await digest(hashPort, materializedGraphPreimage(nextPlanGraph, reservation));
    if (!postGraphDigest) {
      return noMaterializationAfterReservation(baseGraph, reservationPort, reservation);
    }
    const changeSetBindingDigest = await digest(
      hashPort,
      changeSetPreimage(permit.baseGraphDigest, postGraphDigest, baseGraph.projectLimitsPolicyHash, reservation)
    );
    if (!changeSetBindingDigest) {
      return noMaterializationAfterReservation(baseGraph, reservationPort, reservation);
    }
    const inverseBindingDigest = await digest(
      hashPort,
      inversePreimage(permit.baseGraphDigest, postGraphDigest, reservation)
    );
    if (!inverseBindingDigest) {
      return noMaterializationAfterReservation(baseGraph, reservationPort, reservation);
    }

    return freezeMaterializedInitialWall({
      allocationIntent: {
        slots: [
          { label: 'startVertex', vertexId: reservation.startVertexId },
          { label: 'endVertex', vertexId: reservation.endVertexId },
          { label: 'wall', wallSegmentId: reservation.wallSegmentId }
        ]
      },
      changeSet: {
        addedVertexIds: [reservation.startVertexId, reservation.endVertexId],
        addedWallSegmentId: reservation.wallSegmentId,
        baseGraphDigest: permit.baseGraphDigest,
        bindingDigest: changeSetBindingDigest,
        postGraphDigest,
        projectLimitsPolicyHash: baseGraph.projectLimitsPolicyHash,
        roomOpeningHostEffects: []
      },
      inverse: {
        bindingDigest: inverseBindingDigest,
        endVertexId: reservation.endVertexId,
        expectedPostGraphDigest: postGraphDigest,
        restoresGraphDigest: permit.baseGraphDigest,
        startVertexId: reservation.startVertexId,
        wallSegmentId: reservation.wallSegmentId
      },
      kind: 'materialized',
      nextPlanGraph
    });
  } catch {
    if (reservationPortForRetirement && reservationForRetirement) {
      await terminallyRetireReservation(reservationPortForRetirement, reservationForRetirement);
    }
    return noMaterialization('InitialRouteUnavailable', baseGraph);
  }
}

/**
 * Applies the semantic inverse only to exactly the graph it materialized.
 * It is pure and never allocates, resets an arbitrary graph, or publishes.
 */
export async function removeInitialWall(request: RemoveInitialWallRequest): Promise<RemoveInitialWallResult> {
  try {
    if (!isRecord(request) || !isHashPort(request.hashPort) || !isRecord(request.inverse)
      || !issuedInitialWallInverses.has(request.inverse)) {
      return { kind: 'not-removed' };
    }
    const inverse = readInverse(request.inverse);
    const graph = readSingleWallGraph(request.planGraph);
    if (!inverse || !graph || !matchesInverseSlots(graph, inverse)) {
      return { kind: 'not-removed' };
    }
    const reservation = {
      endVertexId: inverse.endVertexId,
      kind: 'Reserved' as const,
      startVertexId: inverse.startVertexId,
      wallSegmentId: inverse.wallSegmentId
    };
    const actualPostDigest = await digest(request.hashPort, materializedGraphPreimage(graph, reservation));
    if (!actualPostDigest || actualPostDigest !== inverse.expectedPostGraphDigest) {
      return { kind: 'not-removed' };
    }
    const actualInverseBinding = await digest(
      request.hashPort,
      inversePreimage(inverse.restoresGraphDigest, inverse.expectedPostGraphDigest, reservation)
    );
    if (!actualInverseBinding || actualInverseBinding !== inverse.bindingDigest) {
      return { kind: 'not-removed' };
    }
    const restoredEmptyPlanGraph = freezeEmptyPlanGraph({
      levelId: graph.levelId,
      projectLimitsPolicyHash: graph.projectLimitsPolicyHash,
      verticesById: {},
      wallSegmentsById: {}
    });
    const actualBaseDigest = await digest(request.hashPort, emptyGraphPreimage(restoredEmptyPlanGraph));
    return actualBaseDigest === inverse.restoresGraphDigest
      ? { kind: 'removed', restoredEmptyPlanGraph }
      : { kind: 'not-removed' };
  } catch {
    return { kind: 'not-removed' };
  }
}

function readEmptyPlanGraph(value: unknown): EmptyPlanGraph | undefined {
  if (!isRecord(value)
    || !hasExactKeys(value, ['levelId', 'projectLimitsPolicyHash', 'verticesById', 'wallSegmentsById'])
    || !isOpaqueId(value.levelId)
    || !isContentHash(value.projectLimitsPolicyHash)
    || !isEmptyRecord(value.verticesById)
    || !isEmptyRecord(value.wallSegmentsById)) {
    return undefined;
  }
  return freezeEmptyPlanGraph({
    levelId: value.levelId,
    projectLimitsPolicyHash: value.projectLimitsPolicyHash,
    verticesById: {},
    wallSegmentsById: {}
  });
}

function readInitialWallIntent(value: unknown): InitialWallIntent | undefined {
  if (!isRecord(value)
    || !hasExactKeys(value, [
      'end',
      'kind',
      'levelId',
      'projectLimits',
      'projectLimitsPolicyHash',
      'start',
      'thicknessMm'
    ])
    || value.kind !== 'initial-wall-segment'
    || !isOpaqueId(value.levelId)
    || !isContentHash(value.projectLimitsPolicyHash)) {
    return undefined;
  }
  const limits = readInitialWallLimits(value.projectLimits);
  const start = readPlanPoint(value.start);
  const end = readPlanPoint(value.end);
  if (!limits || !start || !end || !isSafeInteger(value.thicknessMm)) {
    return undefined;
  }
  return Object.freeze({
    end,
    kind: 'initial-wall-segment' as const,
    levelId: value.levelId,
    projectLimits: limits,
    projectLimitsPolicyHash: value.projectLimitsPolicyHash,
    start,
    thicknessMm: value.thicknessMm
  });
}

function readMaterializationPermit(value: unknown): MaterializationPermit | undefined {
  if (!isRecord(value)
    || !hasExactKeys(value, [
      'baseGraphDigest',
      'baseRevisionChecksum',
      'baseRevisionId',
      'cancellationGeneration',
      'intentDigest',
      'permitNonce',
      'projectId',
      'projectLimits',
      'projectLimitsPolicyHash',
      'writerFenceGeneration'
    ])
    || !isContentHash(value.baseGraphDigest)
    || !isContentHash(value.baseRevisionChecksum)
    || !isOpaqueId(value.baseRevisionId)
    || !isSafeCounter(value.cancellationGeneration)
    || !isContentHash(value.intentDigest)
    || !isOpaqueId(value.permitNonce)
    || !isOpaqueId(value.projectId)
    || !isContentHash(value.projectLimitsPolicyHash)
    || !isSafeCounter(value.writerFenceGeneration)) {
    return undefined;
  }
  const limits = readInitialWallLimits(value.projectLimits);
  return limits
    ? Object.freeze({
      baseGraphDigest: value.baseGraphDigest,
      baseRevisionChecksum: value.baseRevisionChecksum,
      baseRevisionId: value.baseRevisionId,
      cancellationGeneration: value.cancellationGeneration,
      intentDigest: value.intentDigest,
      permitNonce: value.permitNonce,
      projectId: value.projectId,
      projectLimits: limits,
      projectLimitsPolicyHash: value.projectLimitsPolicyHash,
      writerFenceGeneration: value.writerFenceGeneration
    })
    : undefined;
}

function readInitialWallLimits(value: unknown): InitialWallLimits | undefined {
  if (!isRecord(value)
    || !hasExactKeys(value, [
      'coordinateAbsHardMm',
      'vertexHardCount',
      'wallSegmentHardCount',
      'minWallLengthMm',
      'maxWallLengthMm',
      'minWallThicknessMm',
      'maxWallThicknessMm'
    ])
    || !isSafeInteger(value.coordinateAbsHardMm)
    || !isSafeCounter(value.vertexHardCount)
    || !isSafeCounter(value.wallSegmentHardCount)
    || !isPositiveSafeInteger(value.minWallLengthMm)
    || !isPositiveSafeInteger(value.maxWallLengthMm)
    || !isPositiveSafeInteger(value.minWallThicknessMm)
    || !isPositiveSafeInteger(value.maxWallThicknessMm)
    || value.maxWallLengthMm < value.minWallLengthMm
    || value.maxWallThicknessMm < value.minWallThicknessMm) {
    return undefined;
  }
  return Object.freeze({
    coordinateAbsHardMm: value.coordinateAbsHardMm,
    maxWallLengthMm: value.maxWallLengthMm,
    maxWallThicknessMm: value.maxWallThicknessMm,
    minWallLengthMm: value.minWallLengthMm,
    minWallThicknessMm: value.minWallThicknessMm,
    vertexHardCount: value.vertexHardCount,
    wallSegmentHardCount: value.wallSegmentHardCount
  });
}

function readPlanPoint(value: unknown): InitialPlanPoint | undefined {
  if (!isRecord(value)
    || !hasExactKeys(value, ['xMm', 'zMm'])
    || !isSafeInteger(value.xMm)
    || !isSafeInteger(value.zMm)) {
    return undefined;
  }
  return Object.freeze({ xMm: value.xMm, zMm: value.zMm });
}

function hasMatchingStaticBindings(
  baseGraph: EmptyPlanGraph,
  intent: InitialWallIntent,
  permit: MaterializationPermit
): boolean {
  return baseGraph.levelId === intent.levelId
    && baseGraph.projectLimitsPolicyHash === intent.projectLimitsPolicyHash
    && intent.projectLimitsPolicyHash === permit.projectLimitsPolicyHash
    && equalLimits(intent.projectLimits, permit.projectLimits);
}

function isValidInitialWall(intent: InitialWallIntent): boolean {
  const { end, projectLimits: limits, start, thicknessMm } = intent;
  if (limits.vertexHardCount < 2 || limits.wallSegmentHardCount < 1) {
    return false;
  }
  if (!isWithinCoordinateLimit(start, limits.coordinateAbsHardMm)
    || !isWithinCoordinateLimit(end, limits.coordinateAbsHardMm)
    || thicknessMm < limits.minWallThicknessMm
    || thicknessMm > limits.maxWallThicknessMm) {
    return false;
  }
  const deltaX = BigInt(end.xMm) - BigInt(start.xMm);
  const deltaZ = BigInt(end.zMm) - BigInt(start.zMm);
  if ((deltaX === 0n && deltaZ === 0n) || !isCardinalOrFortyFiveDegrees(deltaX, deltaZ)) {
    return false;
  }
  const squaredLength = deltaX * deltaX + deltaZ * deltaZ;
  const minimumSquaredLength = BigInt(limits.minWallLengthMm) * BigInt(limits.minWallLengthMm);
  const maximumSquaredLength = BigInt(limits.maxWallLengthMm) * BigInt(limits.maxWallLengthMm);
  return minimumSquaredLength <= squaredLength && squaredLength <= maximumSquaredLength;
}

function readReservedReservation(value: unknown): InitialWallReservedReservation | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const kind = value.kind;
  const startVertexId = value.startVertexId;
  const endVertexId = value.endVertexId;
  const wallSegmentId = value.wallSegmentId;
  const retireUnpublished = value.retireUnpublished;
  if (kind !== 'Reserved'
    || !isOpaqueId(startVertexId)
    || !isOpaqueId(endVertexId)
    || !isOpaqueId(wallSegmentId)
    || !isRetireUnpublished(retireUnpublished)
    || startVertexId === endVertexId
    || startVertexId === wallSegmentId
    || endVertexId === wallSegmentId) {
    return undefined;
  }
  return Object.freeze({
    endVertexId,
    kind,
    retireUnpublished: retireUnpublished.bind(value),
    startVertexId,
    wallSegmentId
  });
}

function isReservationStatus(value: unknown): value is InitialWallNotMaterialized['status'] {
  return value === 'Cancelled'
    || value === 'StaleBase'
    || value === 'LostFence'
    || value === 'InitialRouteUnavailable';
}

function isRetireUnpublished(value: unknown): value is () => Promise<InitialWallRetirementResult> {
  return typeof value === 'function';
}

function createSingleWallGraph(
  baseGraph: EmptyPlanGraph,
  intent: InitialWallIntent,
  reservation: InitialWallReservedIds
): MaterializedPlanGraph {
  return freezeMaterializedPlanGraph({
    levelId: baseGraph.levelId,
    projectLimitsPolicyHash: baseGraph.projectLimitsPolicyHash,
    verticesById: {
      [reservation.startVertexId]: intent.start,
      [reservation.endVertexId]: intent.end
    },
    wallSegmentsById: {
      [reservation.wallSegmentId]: {
        endVertexId: reservation.endVertexId,
        startVertexId: reservation.startVertexId,
        thicknessMm: intent.thicknessMm
      }
    }
  });
}

function readSingleWallGraph(value: unknown): MaterializedPlanGraph | undefined {
  if (!isRecord(value)
    || !hasExactKeys(value, ['levelId', 'projectLimitsPolicyHash', 'verticesById', 'wallSegmentsById'])
    || !isOpaqueId(value.levelId)
    || !isContentHash(value.projectLimitsPolicyHash)
    || !isRecord(value.verticesById)
    || !isRecord(value.wallSegmentsById)) {
    return undefined;
  }
  const vertexIds = Object.keys(value.verticesById);
  const wallIds = Object.keys(value.wallSegmentsById);
  if (vertexIds.length !== 2 || wallIds.length !== 1 || !vertexIds.every(isOpaqueId) || !wallIds.every(isOpaqueId)) {
    return undefined;
  }
  const firstVertexId = vertexIds[0];
  const secondVertexId = vertexIds[1];
  const wallId = wallIds[0];
  if (!firstVertexId || !secondVertexId || !wallId) {
    return undefined;
  }
  const firstVertex = readPlanPoint(value.verticesById[firstVertexId]);
  const secondVertex = readPlanPoint(value.verticesById[secondVertexId]);
  const wall = readMaterializedWall(value.wallSegmentsById[wallId]);
  if (!firstVertex || !secondVertex || !wall
    || ![firstVertexId, secondVertexId].includes(wall.startVertexId)
    || ![firstVertexId, secondVertexId].includes(wall.endVertexId)
    || wall.startVertexId === wall.endVertexId) {
    return undefined;
  }
  return freezeMaterializedPlanGraph({
    levelId: value.levelId,
    projectLimitsPolicyHash: value.projectLimitsPolicyHash,
    verticesById: { [firstVertexId]: firstVertex, [secondVertexId]: secondVertex },
    wallSegmentsById: { [wallId]: wall }
  });
}

function readMaterializedWall(value: unknown): {
  readonly endVertexId: string;
  readonly startVertexId: string;
  readonly thicknessMm: number;
} | undefined {
  if (!isRecord(value)
    || !hasExactKeys(value, ['endVertexId', 'startVertexId', 'thicknessMm'])
    || !isOpaqueId(value.endVertexId)
    || !isOpaqueId(value.startVertexId)
    || !isPositiveSafeInteger(value.thicknessMm)) {
    return undefined;
  }
  return Object.freeze({
    endVertexId: value.endVertexId,
    startVertexId: value.startVertexId,
    thicknessMm: value.thicknessMm
  });
}

function readInverse(value: unknown): RemoveInitialWall | undefined {
  if (!isRecord(value)
    || !hasExactKeys(value, [
      'bindingDigest',
      'endVertexId',
      'expectedPostGraphDigest',
      'restoresGraphDigest',
      'startVertexId',
      'wallSegmentId'
    ])
    || !isContentHash(value.bindingDigest)
    || !isOpaqueId(value.endVertexId)
    || !isContentHash(value.expectedPostGraphDigest)
    || !isContentHash(value.restoresGraphDigest)
    || !isOpaqueId(value.startVertexId)
    || !isOpaqueId(value.wallSegmentId)) {
    return undefined;
  }
  return Object.freeze({
    bindingDigest: value.bindingDigest,
    endVertexId: value.endVertexId,
    expectedPostGraphDigest: value.expectedPostGraphDigest,
    restoresGraphDigest: value.restoresGraphDigest,
    startVertexId: value.startVertexId,
    wallSegmentId: value.wallSegmentId
  });
}

function matchesInverseSlots(graph: MaterializedPlanGraph, inverse: RemoveInitialWall): boolean {
  const vertexIds = Object.keys(graph.verticesById);
  const wallIds = Object.keys(graph.wallSegmentsById);
  const wall = graph.wallSegmentsById[inverse.wallSegmentId];
  return vertexIds.length === 2
    && wallIds.length === 1
    && vertexIds.includes(inverse.startVertexId)
    && vertexIds.includes(inverse.endVertexId)
    && wallIds[0] === inverse.wallSegmentId
    && wall !== undefined
    && wall.startVertexId === inverse.startVertexId
    && wall.endVertexId === inverse.endVertexId;
}

function materializedGraphPreimage(
  graph: MaterializedPlanGraph,
  reservation: InitialWallReservedIds
): string {
  const start = graph.verticesById[reservation.startVertexId];
  const end = graph.verticesById[reservation.endVertexId];
  const wall = graph.wallSegmentsById[reservation.wallSegmentId];
  if (!start || !end || !wall) {
    throw new TypeError('Materialized graph does not contain every reservation slot');
  }
  return [
    'IWM-D1',
    'record=plan-graph',
    `levelId=${encodeOpaque(graph.levelId)}`,
    `projectLimitsPolicyHash=${encodeHash(graph.projectLimitsPolicyHash)}`,
    `startVertex=${encodeOpaque(reservation.startVertexId)}`,
    `start.xMm=${encodeSafeInteger(start.xMm)}`,
    `start.zMm=${encodeSafeInteger(start.zMm)}`,
    `endVertex=${encodeOpaque(reservation.endVertexId)}`,
    `end.xMm=${encodeSafeInteger(end.xMm)}`,
    `end.zMm=${encodeSafeInteger(end.zMm)}`,
    `wall=${encodeOpaque(reservation.wallSegmentId)}`,
    `wall.startVertexId=${encodeOpaque(wall.startVertexId)}`,
    `wall.endVertexId=${encodeOpaque(wall.endVertexId)}`,
    `wall.thicknessMm=${encodeSafeInteger(wall.thicknessMm)}`
  ].join('|');
}

function limitsPreimage(limits: InitialWallLimits): string {
  return [
    'IWM-D1',
    'record=initial-wall-limits',
    `coordinateAbsHardMm=${encodeSafeInteger(limits.coordinateAbsHardMm)}`,
    `vertexHardCount=${encodeSafeInteger(limits.vertexHardCount)}`,
    `wallSegmentHardCount=${encodeSafeInteger(limits.wallSegmentHardCount)}`,
    `minWallLengthMm=${encodeSafeInteger(limits.minWallLengthMm)}`,
    `maxWallLengthMm=${encodeSafeInteger(limits.maxWallLengthMm)}`,
    `minWallThicknessMm=${encodeSafeInteger(limits.minWallThicknessMm)}`,
    `maxWallThicknessMm=${encodeSafeInteger(limits.maxWallThicknessMm)}`
  ].join('|');
}

function emptyGraphPreimage(graph: EmptyPlanGraph): string {
  return [
    'IWM-D1',
    'record=empty-plan-graph',
    `levelId=${encodeOpaque(graph.levelId)}`,
    `projectLimitsPolicyHash=${encodeHash(graph.projectLimitsPolicyHash)}`,
    'vertices=[]',
    'wallSegments=[]'
  ].join('|');
}

function intentPreimage(intent: InitialWallIntent): string {
  return [
    'IWM-D1',
    'record=initial-wall-intent',
    `levelId=${encodeOpaque(intent.levelId)}`,
    `projectLimitsPolicyHash=${encodeHash(intent.projectLimitsPolicyHash)}`,
    `start.xMm=${encodeSafeInteger(intent.start.xMm)}`,
    `start.zMm=${encodeSafeInteger(intent.start.zMm)}`,
    `end.xMm=${encodeSafeInteger(intent.end.xMm)}`,
    `end.zMm=${encodeSafeInteger(intent.end.zMm)}`,
    `thicknessMm=${encodeSafeInteger(intent.thicknessMm)}`
  ].join('|');
}

function changeSetPreimage(
  baseGraphDigest: string,
  postGraphDigest: string,
  projectLimitsPolicyHash: string,
  reservation: InitialWallReservedIds
): string {
  return [
    'IWM-D1',
    'record=initial-wall-change-set',
    `baseGraphDigest=${encodeHash(baseGraphDigest)}`,
    `postGraphDigest=${encodeHash(postGraphDigest)}`,
    `projectLimitsPolicyHash=${encodeHash(projectLimitsPolicyHash)}`,
    `startVertex=${encodeOpaque(reservation.startVertexId)}`,
    `endVertex=${encodeOpaque(reservation.endVertexId)}`,
    `wall=${encodeOpaque(reservation.wallSegmentId)}`,
    'roomOpeningHostEffects=[]'
  ].join('|');
}

function inversePreimage(
  baseGraphDigest: string,
  postGraphDigest: string,
  reservation: InitialWallReservedIds
): string {
  return [
    'IWM-D1',
    'record=remove-initial-wall',
    `expectedPostGraphDigest=${encodeHash(postGraphDigest)}`,
    `wall=${encodeOpaque(reservation.wallSegmentId)}`,
    `startVertex=${encodeOpaque(reservation.startVertexId)}`,
    `endVertex=${encodeOpaque(reservation.endVertexId)}`,
    `restoresGraphDigest=${encodeHash(baseGraphDigest)}`
  ].join('|');
}

function noMaterialization(
  status: InitialWallNotMaterialized['status'],
  baseGraph?: EmptyPlanGraph
): InitialWallNotMaterialized {
  const allocationIntent = Object.freeze({ slots: Object.freeze([]) as readonly [] });
  return baseGraph
    ? Object.freeze({ allocationIntent, baseGraph: freezeEmptyPlanGraph(baseGraph), kind: 'not-materialized' as const, status })
    : Object.freeze({ allocationIntent, kind: 'not-materialized' as const, status });
}

async function noMaterializationAfterReservation(
  baseGraph: EmptyPlanGraph,
  reservationPort: IdReservationPort,
  reservation: InitialWallReservedReservation
): Promise<InitialWallNotMaterialized> {
  await terminallyRetireReservation(reservationPort, reservation);
  return noMaterialization('InitialRouteUnavailable', baseGraph);
}

async function terminallyRetireReservation(
  reservationPort: IdReservationPort,
  reservation: InitialWallReservedReservation
): Promise<void> {
  try {
    if (await reservation.retireUnpublished() === 'Retired') {
      return;
    }
  } catch {
    // Fall through to the authority-level defensive fence.
  }
  // A failed port cannot prove that a specific candidate is terminal. Fence its
  // bounded authority rather than retaining an unbounded set of tuple strings.
  locallyFencedReservationAuthorities.add(reservationAuthorityKey(reservationPort));
}

function isLocallyFencedAuthority(reservationPort: IdReservationPort): boolean {
  return locallyFencedReservationAuthorities.has(reservationAuthorityKey(reservationPort));
}

function reservationAuthorityKey(reservationPort: IdReservationPort): object {
  return isRecord(reservationPort.authorityKey) ? reservationPort.authorityKey : reservationPort;
}

function freezeEmptyPlanGraph(graph: EmptyPlanGraph): EmptyPlanGraph {
  return Object.freeze({
    levelId: graph.levelId,
    projectLimitsPolicyHash: graph.projectLimitsPolicyHash,
    verticesById: Object.freeze({}),
    wallSegmentsById: Object.freeze({})
  });
}

function freezeMaterializedPlanGraph(graph: MaterializedPlanGraph): MaterializedPlanGraph {
  const verticesById = Object.freeze(Object.fromEntries(Object.entries(graph.verticesById).map(([id, point]) => [
    id,
    Object.freeze({ xMm: point.xMm, zMm: point.zMm })
  ])));
  const wallSegmentsById = Object.freeze(Object.fromEntries(Object.entries(graph.wallSegmentsById).map(([id, wall]) => [
    id,
    Object.freeze({
      endVertexId: wall.endVertexId,
      startVertexId: wall.startVertexId,
      thicknessMm: wall.thicknessMm
    })
  ])));
  return Object.freeze({
    levelId: graph.levelId,
    projectLimitsPolicyHash: graph.projectLimitsPolicyHash,
    verticesById,
    wallSegmentsById
  });
}

function freezeMaterializedInitialWall(value: MaterializedInitialWall): MaterializedInitialWall {
  const inverse = Object.freeze({ ...value.inverse });
  issuedInitialWallInverses.add(inverse);
  return Object.freeze({
    allocationIntent: Object.freeze({
      slots: Object.freeze(value.allocationIntent.slots.map((slot) => Object.freeze({ ...slot }))) as InitialWallAllocationIntent['slots']
    }),
    changeSet: Object.freeze({
      ...value.changeSet,
      addedVertexIds: Object.freeze([...value.changeSet.addedVertexIds]) as InitialWallChangeSet['addedVertexIds'],
      roomOpeningHostEffects: Object.freeze([]) as readonly []
    }),
    inverse,
    kind: 'materialized' as const,
    nextPlanGraph: freezeMaterializedPlanGraph(value.nextPlanGraph)
  });
}

function clonePermit(permit: MaterializationPermit): MaterializationPermit {
  return Object.freeze({
    ...permit,
    projectLimits: Object.freeze({ ...permit.projectLimits })
  });
}

function equalLimits(left: InitialWallLimits, right: InitialWallLimits): boolean {
  return left.coordinateAbsHardMm === right.coordinateAbsHardMm
    && left.vertexHardCount === right.vertexHardCount
    && left.wallSegmentHardCount === right.wallSegmentHardCount
    && left.minWallLengthMm === right.minWallLengthMm
    && left.maxWallLengthMm === right.maxWallLengthMm
    && left.minWallThicknessMm === right.minWallThicknessMm
    && left.maxWallThicknessMm === right.maxWallThicknessMm;
}

function isWithinCoordinateLimit(point: InitialPlanPoint, limit: number): boolean {
  return Math.abs(point.xMm) <= limit && Math.abs(point.zMm) <= limit;
}

function isCardinalOrFortyFiveDegrees(deltaX: bigint, deltaZ: bigint): boolean {
  return deltaX === 0n || deltaZ === 0n || absolute(deltaX) === absolute(deltaZ);
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function encodeSafeInteger(value: number): string {
  if (!isSafeInteger(value)) {
    throw new TypeError('IWM-D1 accepts canonical SafeIntegerMm values only');
  }
  return String(Object.is(value, -0) ? 0 : value);
}

function encodeOpaque(value: string): string {
  if (!isOpaqueId(value)) {
    throw new TypeError('IWM-D1 accepts canonical opaque ASCII IDs only');
  }
  return `${value.length}:${value}`;
}

function encodeHash(value: string): string {
  if (!isContentHash(value)) {
    throw new TypeError('IWM-D1 accepts lowercase SHA-256 content hashes only');
  }
  return `64:${value}`;
}

async function digest(port: ContentHashPort, preimage: string): Promise<string | undefined> {
  const value = await port.sha256Utf8Ascii(preimage);
  return isContentHash(value) ? value : undefined;
}

function isHashPort(value: unknown): value is ContentHashPort {
  return isRecord(value) && typeof value.sha256Utf8Ascii === 'function';
}

function isReservationPort(value: unknown): value is IdReservationPort {
  return isRecord(value) && typeof value.consumeIfCurrent === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return isRecord(value) && Object.keys(value).length === 0;
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key) => expectedKeys.includes(key));
}

function isOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_ASCII_ID.test(value);
}

function isContentHash(value: unknown): value is string {
  return typeof value === 'string' && CONTENT_HASH.test(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isSafeCounter(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0;
}
