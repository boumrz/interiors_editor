/**
 * This module is an allocation-free interactive ingress/resolution boundary, not a
 * complete AddWallSegment preflight. It intentionally stops before PlanGraph
 * contact normalization, Room/Opening/host validation, ChangeSet creation,
 * IDs, fences and durability.
 *
 * Geometry Contract §§1 and 4 own the raw grammar and direction semantics.
 * AD-7/AD-20 require the eventual touch and numeric adapters to use the same
 * detached domain path without promoting legacy V1/V2 behavior.
 */

declare const safeIntegerMmBrand: unique symbol;

export type SafeIntegerMm = number & { readonly [safeIntegerMmBrand]: 'SafeIntegerMm' };

export type RawPlanPoint = {
  readonly xMm: string;
  readonly zMm: string;
};

export type RawWallGeometryRequest =
  | {
      readonly end: RawPlanPoint;
      readonly kind: 'endpoints';
      readonly start: RawPlanPoint;
    }
  | {
      readonly delta: RawPlanPoint;
      readonly kind: 'delta';
      readonly start: RawPlanPoint;
    }
  | {
      readonly kind: 'diagonal-length';
      readonly lengthMm: string;
      readonly quadrant: DiagonalQuadrant;
      readonly start: RawPlanPoint;
    };

export type DiagonalQuadrant = 'NE' | 'NW' | 'SE' | 'SW';

export type PlanDirection = 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW' | 'S' | 'SE';

export type RawWallGeometryLimits = {
  /** The source-owned ProjectLimitsPolicy absolute x/z hard bound. */
  readonly maxAbsoluteCoordinateMm: number;
};

export type ResolvedPlanPoint = {
  readonly xMm: SafeIntegerMm;
  readonly zMm: SafeIntegerMm;
};

export type ResolvedWallGeometry = {
  readonly deltaMm: ResolvedPlanPoint;
  readonly direction: PlanDirection;
  readonly endMm: ResolvedPlanPoint;
  /** Ephemeral exact arithmetic only; it must never enter a persisted command. */
  readonly squaredLengthMm2: bigint;
  readonly startMm: ResolvedPlanPoint;
};

export type ParseSafeIntegerMmResult =
  | { readonly kind: 'accepted'; readonly value: SafeIntegerMm }
  | { readonly kind: 'rejected'; readonly reasonCode: 'INVALID_DIMENSION' };

export type ResolveRawWallGeometryResult =
  | { readonly geometry: ResolvedWallGeometry; readonly kind: 'accepted' }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | 'INVALID_DIMENSION'
        | 'PROJECT_BOUNDS_EXCEEDED'
        | 'UNSUPPORTED_DIRECTION'
        | 'ZERO_LENGTH';
    };

const INTEGER_MM_LEXEME = /^-?(?:0|[1-9][0-9]*)$/;
const MAXIMUM_SAFE_COORDINATE_BOUND_MM = Math.floor(Number.MAX_SAFE_INTEGER / 2);

type ExactPoint = {
  readonly xMm: bigint;
  readonly zMm: bigint;
};

/**
 * Keeps lexical provenance at the trust boundary. A caller cannot pass a
 * previously coerced number in place of the raw UI lexeme.
 */
export function parseSafeIntegerMmLexeme(raw: unknown): ParseSafeIntegerMmResult {
  if (typeof raw !== 'string' || !INTEGER_MM_LEXEME.test(raw)) {
    return rejectInvalidDimension();
  }
  const parsed = raw === '-0' ? 0 : Number(raw);
  return Number.isSafeInteger(parsed)
    ? { kind: 'accepted', value: asSafeIntegerMm(parsed) }
    : rejectInvalidDimension();
}

/**
 * Resolves only raw interactive wall geometry. It has no mutable inputs or
 * topology state, so an accepted result cannot be mistaken for a materialized
 * wall or a complete topology candidate.
 */
export function resolveRawWallGeometry(
  request: unknown,
  limits: RawWallGeometryLimits
): ResolveRawWallGeometryResult {
  const maxAbsoluteCoordinateMm = readMaximumCoordinate(limits);
  if (!isRawWallGeometryRequest(request)) {
    return reject('INVALID_DIMENSION');
  }
  const parsedStart = parsePoint(request.start);
  if (!parsedStart) {
    return reject('INVALID_DIMENSION');
  }

  switch (request.kind) {
    case 'endpoints': {
      const parsedEnd = parsePoint(request.end);
      return parsedEnd
        ? resolveEndpoints(parsedStart, parsedEnd, maxAbsoluteCoordinateMm)
        : reject('INVALID_DIMENSION');
    }
    case 'delta': {
      const parsedDelta = parsePoint(request.delta);
      if (!parsedDelta) {
        return reject('INVALID_DIMENSION');
      }
      const end = {
        xMm: BigInt(parsedStart.xMm) + BigInt(parsedDelta.xMm),
        zMm: BigInt(parsedStart.zMm) + BigInt(parsedDelta.zMm)
      };
      return resolveExactEndpoints(parsedStart, end, maxAbsoluteCoordinateMm);
    }
    case 'diagonal-length':
      return resolveLengthOnlyDiagonal(parsedStart, request.lengthMm, request.quadrant, maxAbsoluteCoordinateMm);
  }
}

function resolveLengthOnlyDiagonal(
  start: ResolvedPlanPoint,
  rawLengthMm: string,
  quadrant: DiagonalQuadrant,
  maxAbsoluteCoordinateMm: bigint
): ResolveRawWallGeometryResult {
  const parsedLength = parseSafeIntegerMmLexeme(rawLengthMm);
  if (parsedLength.kind === 'rejected') {
    return parsedLength;
  }
  if (parsedLength.value < 0) {
    return reject('INVALID_DIMENSION');
  }
  if (parsedLength.value === 0) {
    return reject('ZERO_LENGTH');
  }
  const magnitudeMm = nearestDiagonalMagnitude(BigInt(parsedLength.value));
  const delta = signedDiagonalDelta(magnitudeMm, quadrant);
  const end = {
    xMm: BigInt(start.xMm) + delta.xMm,
    zMm: BigInt(start.zMm) + delta.zMm
  };
  return resolveExactEndpoints(start, end, maxAbsoluteCoordinateMm);
}

function resolveEndpoints(
  start: ResolvedPlanPoint,
  end: ResolvedPlanPoint,
  maxAbsoluteCoordinateMm: bigint
): ResolveRawWallGeometryResult {
  return resolveExactEndpoints(start, { xMm: BigInt(end.xMm), zMm: BigInt(end.zMm) }, maxAbsoluteCoordinateMm);
}

function resolveExactEndpoints(
  start: ResolvedPlanPoint,
  exactEnd: ExactPoint,
  maxAbsoluteCoordinateMm: bigint
): ResolveRawWallGeometryResult {
  const exactStart: ExactPoint = { xMm: BigInt(start.xMm), zMm: BigInt(start.zMm) };
  if (!isWithinCoordinateBound(exactStart, maxAbsoluteCoordinateMm) || !isWithinCoordinateBound(exactEnd, maxAbsoluteCoordinateMm)) {
    return reject('PROJECT_BOUNDS_EXCEEDED');
  }
  const delta = {
    xMm: exactEnd.xMm - exactStart.xMm,
    zMm: exactEnd.zMm - exactStart.zMm
  };
  if (delta.xMm === 0n && delta.zMm === 0n) {
    return reject('ZERO_LENGTH');
  }
  const direction = directionFor(delta);
  if (!direction) {
    return reject('UNSUPPORTED_DIRECTION');
  }
  return {
    geometry: {
      deltaMm: toResolvedPoint(delta),
      direction,
      endMm: toResolvedPoint(exactEnd),
      squaredLengthMm2: delta.xMm * delta.xMm + delta.zMm * delta.zMm,
      startMm: start
    },
    kind: 'accepted'
  };
}

function parsePoint(raw: RawPlanPoint): ResolvedPlanPoint | undefined {
  const xMm = parseSafeIntegerMmLexeme(raw.xMm);
  const zMm = parseSafeIntegerMmLexeme(raw.zMm);
  if (xMm.kind === 'rejected' || zMm.kind === 'rejected') {
    return undefined;
  }
  return { xMm: xMm.value, zMm: zMm.value };
}

function isRawWallGeometryRequest(value: unknown): value is RawWallGeometryRequest {
  if (!isRecord(value) || !isRawPlanPoint(value.start)) {
    return false;
  }
  switch (value.kind) {
    case 'endpoints':
      return isRawPlanPoint(value.end);
    case 'delta':
      return isRawPlanPoint(value.delta);
    case 'diagonal-length':
      return isDiagonalQuadrant(value.quadrant);
    default:
      return false;
  }
}

function isRawPlanPoint(value: unknown): value is RawPlanPoint {
  return isRecord(value);
}

function isDiagonalQuadrant(value: unknown): value is DiagonalQuadrant {
  return value === 'NE' || value === 'NW' || value === 'SE' || value === 'SW';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readMaximumCoordinate(limits: RawWallGeometryLimits): bigint {
  if (
    !Number.isSafeInteger(limits.maxAbsoluteCoordinateMm) ||
    limits.maxAbsoluteCoordinateMm < 0 ||
    limits.maxAbsoluteCoordinateMm > MAXIMUM_SAFE_COORDINATE_BOUND_MM
  ) {
    throw new TypeError('RawWallGeometryLimits.maxAbsoluteCoordinateMm must preserve SafeIntegerMm deltas');
  }
  return BigInt(limits.maxAbsoluteCoordinateMm);
}

function isWithinCoordinateBound(point: ExactPoint, maximum: bigint): boolean {
  return absolute(point.xMm) <= maximum && absolute(point.zMm) <= maximum;
}

function directionFor(delta: ExactPoint): PlanDirection | undefined {
  if (delta.zMm === 0n) {
    return delta.xMm > 0n ? 'E' : 'W';
  }
  if (delta.xMm === 0n) {
    return delta.zMm > 0n ? 'N' : 'S';
  }
  if (absolute(delta.xMm) !== absolute(delta.zMm)) {
    return undefined;
  }
  if (delta.xMm > 0n) {
    return delta.zMm > 0n ? 'NE' : 'SE';
  }
  return delta.zMm > 0n ? 'NW' : 'SW';
}

function signedDiagonalDelta(magnitudeMm: bigint, quadrant: DiagonalQuadrant): ExactPoint {
  switch (quadrant) {
    case 'NE':
      return { xMm: magnitudeMm, zMm: magnitudeMm };
    case 'NW':
      return { xMm: -magnitudeMm, zMm: magnitudeMm };
    case 'SE':
      return { xMm: magnitudeMm, zMm: -magnitudeMm };
    case 'SW':
      return { xMm: -magnitudeMm, zMm: -magnitudeMm };
  }
}

function nearestDiagonalMagnitude(lengthMm: bigint): bigint {
  const twiceLengthSquared = 2n * lengthMm * lengthMm;
  const floorMagnitude = integerSquareRoot(twiceLengthSquared) / 2n;
  const candidate = isNearestDiagonalMagnitude(floorMagnitude, twiceLengthSquared)
    ? floorMagnitude
    : floorMagnitude + 1n;
  return candidate;
}

function isNearestDiagonalMagnitude(magnitudeMm: bigint, twiceLengthSquared: bigint): boolean {
  const lower = 2n * magnitudeMm - 1n;
  const upper = 2n * magnitudeMm + 1n;
  return lower * lower < twiceLengthSquared && twiceLengthSquared < upper * upper;
}

function integerSquareRoot(value: bigint): bigint {
  let current = value;
  let next = (current + 1n) / 2n;
  while (next < current) {
    current = next;
    next = (current + value / current) / 2n;
  }
  return current;
}

/** Coordinate bounds use a safe-integer maximum, so an admitted exact point is representable. */
function toResolvedPoint(point: ExactPoint): ResolvedPlanPoint {
  return {
    xMm: asSafeIntegerMm(Number(point.xMm)),
    zMm: asSafeIntegerMm(Number(point.zMm))
  };
}

/** The only justified brand assertion: Number.isSafeInteger has already passed. */
function asSafeIntegerMm(value: number): SafeIntegerMm {
  return value as SafeIntegerMm;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function reject(
  reasonCode: Extract<ResolveRawWallGeometryResult, { readonly kind: 'rejected' }>['reasonCode']
): Extract<ResolveRawWallGeometryResult, { readonly kind: 'rejected' }> {
  return { kind: 'rejected', reasonCode };
}

function rejectInvalidDimension(): Extract<ParseSafeIntegerMmResult, { readonly kind: 'rejected' }> {
  return { kind: 'rejected', reasonCode: 'INVALID_DIMENSION' };
}
