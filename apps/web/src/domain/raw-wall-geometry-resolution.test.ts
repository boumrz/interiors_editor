import { describe, expect, it } from '@rstest/core';

import {
  parseSafeIntegerMmLexeme,
  resolveRawWallGeometry,
  type RawWallGeometryLimits
} from './raw-wall-geometry-resolution';

const alphaRawGeometryLimits: RawWallGeometryLimits = {
  maxAbsoluteCoordinateMm: 100_000
};

function invokeParserFromAnUntypedBoundary(value: unknown): unknown {
  return Reflect.apply(parseSafeIntegerMmLexeme, undefined, [value]);
}

function invokeResolverFromAnUntypedBoundary(value: unknown): unknown {
  return Reflect.apply(resolveRawWallGeometry, undefined, [value, alphaRawGeometryLimits]);
}

describe('lossless raw wall-geometry resolution', () => {
  it('accepts raw safe-integer lexemes only and normalizes lexical -0 before returning a domain value', () => {
    const normalized = parseSafeIntegerMmLexeme('-0');

    expect(normalized).toEqual({ kind: 'accepted', value: 0 });
    if (normalized.kind !== 'accepted') {
      throw new Error('Expected -0 to normalize to a SafeIntegerMm value');
    }
    expect(Object.is(normalized.value, -0)).toBe(false);
    expect(parseSafeIntegerMmLexeme('9007199254740991')).toEqual({
      kind: 'accepted',
      value: Number.MAX_SAFE_INTEGER
    });
  });

  it.each([
    '',
    ' 1',
    '1 ',
    '+1',
    '01',
    '-00',
    '1.0',
    '.1',
    '1e3',
    'NaN',
    'Infinity',
    '-Infinity',
    '9007199254740992',
    '-9007199254740992'
  ])('rejects the invalid raw lexeme %p before a host number becomes domain input', (raw) => {
    expect(parseSafeIntegerMmLexeme(raw)).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });

  it('does not silently accept an already-coerced number from an untyped adapter boundary', () => {
    expect(invokeParserFromAnUntypedBoundary(1000)).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });

  it.each([
    undefined,
    {},
    { kind: 'unknown', start: { xMm: '0', zMm: '0' } },
    { kind: 'endpoints', start: { xMm: '0', zMm: '0' } },
    { end: { xMm: '1000', zMm: '0' }, kind: 'endpoints', start: { xMm: 0, zMm: '0' } },
    { kind: 'diagonal-length', lengthMm: '1000', start: { xMm: '0', zMm: '0' } },
    { kind: 'diagonal-length', lengthMm: '1000', quadrant: 'SIDEWAYS', start: { xMm: '0', zMm: '0' } }
  ])('rejects malformed raw request shape %p instead of throwing or inferring geometry', (request) => {
    expect(invokeResolverFromAnUntypedBoundary(request)).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });

  it.each([
    { end: { xMm: '1', zMm: '0' }, kind: 'endpoints', start: { xMm: '1e3', zMm: '0' } },
    { end: { xMm: '1', zMm: '1.5' }, kind: 'endpoints', start: { xMm: '0', zMm: '0' } },
    { delta: { xMm: '1', zMm: '1e3' }, kind: 'delta', start: { xMm: '0', zMm: '0' } },
    { kind: 'diagonal-length', lengthMm: '1e3', quadrant: 'NE', start: { xMm: '0', zMm: '0' } }
  ])('rejects every lexically invalid field after the request envelope itself is valid', (request) => {
    expect(resolveRawWallGeometry(request, alphaRawGeometryLimits)).toEqual({
      kind: 'rejected',
      reasonCode: 'INVALID_DIMENSION'
    });
  });

  it('rejects a non-string diagonal length at the envelope boundary', () => {
    expect(invokeResolverFromAnUntypedBoundary({
      kind: 'diagonal-length',
      lengthMm: 1000,
      quadrant: 'NE',
      start: { xMm: '0', zMm: '0' }
    })).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });

  it('rejects null as a raw request rather than treating it as an object envelope', () => {
    expect(invokeResolverFromAnUntypedBoundary(null)).toEqual({ kind: 'rejected', reasonCode: 'INVALID_DIMENSION' });
  });

  it.each([
    -1,
    1.5,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER
  ])('fails fast for an impossible non-negative safe Project coordinate limit %p', (maxAbsoluteCoordinateMm) => {
    expect(() => resolveRawWallGeometry({
      end: { xMm: '1', zMm: '0' },
      kind: 'endpoints',
      start: { xMm: '0', zMm: '0' }
    }, { maxAbsoluteCoordinateMm })).toThrow('RawWallGeometryLimits.maxAbsoluteCoordinateMm must preserve SafeIntegerMm deltas');
  });

  it('allows zero as a valid policy bound and rejects only the out-of-range resolved endpoint', () => {
    expect(resolveRawWallGeometry({
      end: { xMm: '1', zMm: '0' },
      kind: 'endpoints',
      start: { xMm: '0', zMm: '0' }
    }, { maxAbsoluteCoordinateMm: 0 })).toEqual({ kind: 'rejected', reasonCode: 'PROJECT_BOUNDS_EXCEEDED' });
  });

  it('allows the largest policy bound that still guarantees a SafeIntegerMm delta', () => {
    expect(resolveRawWallGeometry({
      end: { xMm: '1', zMm: '0' },
      kind: 'endpoints',
      start: { xMm: '0', zMm: '0' }
    }, { maxAbsoluteCoordinateMm: Math.floor(Number.MAX_SAFE_INTEGER / 2) })).toMatchObject({ kind: 'accepted' });
  });

  it('returns fresh resolved geometry for off-grid endpoint input without mutating raw input and canonicalizes -0', () => {
    const request = {
      end: { xMm: '1125', zMm: '1000' },
      kind: 'endpoints' as const,
      start: { xMm: '125', zMm: '-0' }
    };

    expect(resolveRawWallGeometry(request, alphaRawGeometryLimits)).toEqual({
      geometry: {
        deltaMm: { xMm: 1000, zMm: 1000 },
        direction: 'NE',
        endMm: { xMm: 1125, zMm: 1000 },
        squaredLengthMm2: 2_000_000n,
        startMm: { xMm: 125, zMm: 0 }
      },
      kind: 'accepted'
    });
    expect(request).toEqual({
      end: { xMm: '1125', zMm: '1000' },
      kind: 'endpoints',
      start: { xMm: '125', zMm: '-0' }
    });
  });

  it.each([
    ['E', { xMm: '1000', zMm: '0' }],
    ['NE', { xMm: '1000', zMm: '1000' }],
    ['N', { xMm: '0', zMm: '1000' }],
    ['NW', { xMm: '-1000', zMm: '1000' }],
    ['W', { xMm: '-1000', zMm: '0' }],
    ['SW', { xMm: '-1000', zMm: '-1000' }],
    ['S', { xMm: '0', zMm: '-1000' }],
    ['SE', { xMm: '1000', zMm: '-1000' }]
  ] as const)('derives the permitted %s direction from an exact raw delta', (direction, delta) => {
    expect(resolveRawWallGeometry({
      delta,
      kind: 'delta',
      start: { xMm: '125', zMm: '-275' }
    }, alphaRawGeometryLimits)).toEqual({
      geometry: {
        deltaMm: {
          xMm: Number(delta.xMm),
          zMm: Number(delta.zMm)
        },
        direction,
        endMm: {
          xMm: 125 + Number(delta.xMm),
          zMm: -275 + Number(delta.zMm)
        },
        squaredLengthMm2: direction.length === 2 ? 2_000_000n : 1_000_000n,
        startMm: { xMm: 125, zMm: -275 }
      },
      kind: 'accepted'
    });
  });

  it.each([
    ['NE', { xMm: 1000, zMm: 1000 }],
    ['NW', { xMm: -1000, zMm: 1000 }],
    ['SW', { xMm: -1000, zMm: -1000 }],
    ['SE', { xMm: 1000, zMm: -1000 }]
  ] as const)('resolves a length-only 45-degree request in the explicit %s quadrant without float rounding', (quadrant, delta) => {
    expect(resolveRawWallGeometry({
      kind: 'diagonal-length',
      lengthMm: '1414',
      quadrant,
      start: { xMm: '0', zMm: '0' }
    }, alphaRawGeometryLimits)).toEqual({
      geometry: {
        deltaMm: delta,
        direction: quadrant,
        endMm: delta,
        squaredLengthMm2: 2_000_000n,
        startMm: { xMm: 0, zMm: 0 }
      },
      kind: 'accepted'
    });
  });

  it('uses the exact nearest-integer diagonal predicate at the first 1415 mm boundary', () => {
    expect(resolveRawWallGeometry({
      kind: 'diagonal-length',
      lengthMm: '1415',
      quadrant: 'SE',
      start: { xMm: '125', zMm: '-275' }
    }, alphaRawGeometryLimits)).toEqual({
      geometry: {
        deltaMm: { xMm: 1001, zMm: -1001 },
        direction: 'SE',
        endMm: { xMm: 1126, zMm: -1276 },
        squaredLengthMm2: 2_004_002n,
        startMm: { xMm: 125, zMm: -275 }
      },
      kind: 'accepted'
    });
  });

  it('keeps the Geometry Contract 1000 mm SE example at its exact 707 mm integer delta', () => {
    expect(resolveRawWallGeometry({
      kind: 'diagonal-length',
      lengthMm: '1000',
      quadrant: 'SE',
      start: { xMm: '0', zMm: '0' }
    }, alphaRawGeometryLimits)).toEqual({
      geometry: {
        deltaMm: { xMm: 707, zMm: -707 },
        direction: 'SE',
        endMm: { xMm: 707, zMm: -707 },
        squaredLengthMm2: 999_698n,
        startMm: { xMm: 0, zMm: 0 }
      },
      kind: 'accepted'
    });
  });

  it('resolves the smallest positive diagonal length without using a floating-point zero shortcut', () => {
    expect(resolveRawWallGeometry({
      kind: 'diagonal-length',
      lengthMm: '1',
      quadrant: 'NE',
      start: { xMm: '0', zMm: '0' }
    }, alphaRawGeometryLimits)).toEqual({
      geometry: {
        deltaMm: { xMm: 1, zMm: 1 },
        direction: 'NE',
        endMm: { xMm: 1, zMm: 1 },
        squaredLengthMm2: 2n,
        startMm: { xMm: 0, zMm: 0 }
      },
      kind: 'accepted'
    });
  });

  it.each([
    {
      delta: { xMm: '-50', zMm: '0' },
      expectedEnd: { xMm: 99_950, zMm: -100_000 },
      start: { xMm: '100000', zMm: '-100000' }
    },
    {
      delta: { xMm: '50', zMm: '0' },
      expectedEnd: { xMm: -99_950, zMm: 100_000 },
      start: { xMm: '-100000', zMm: '100000' }
    }
  ])('keeps an inclusive Project coordinate edge valid for raw geometry resolution', ({ delta, expectedEnd, start }) => {
    expect(resolveRawWallGeometry({ delta, kind: 'delta', start }, alphaRawGeometryLimits)).toEqual({
      geometry: {
        deltaMm: { xMm: Number(delta.xMm), zMm: 0 },
        direction: delta.xMm.startsWith('-') ? 'W' : 'E',
        endMm: expectedEnd,
        squaredLengthMm2: 2500n,
        startMm: { xMm: Number(start.xMm), zMm: Number(start.zMm) }
      },
      kind: 'accepted'
    });
  });

  it('checks the resolved endpoint, not only raw start and delta components, against the coordinate policy', () => {
    expect(resolveRawWallGeometry({
      delta: { xMm: '1', zMm: '0' },
      kind: 'delta',
      start: { xMm: '99999', zMm: '0' }
    }, alphaRawGeometryLimits)).toMatchObject({
      geometry: { endMm: { xMm: 100_000, zMm: 0 } },
      kind: 'accepted'
    });
    expect(resolveRawWallGeometry({
      delta: { xMm: '2', zMm: '0' },
      kind: 'delta',
      start: { xMm: '99999', zMm: '0' }
    }, alphaRawGeometryLimits)).toEqual({ kind: 'rejected', reasonCode: 'PROJECT_BOUNDS_EXCEEDED' });
    expect(resolveRawWallGeometry({
      end: { xMm: '0', zMm: '100001' },
      kind: 'endpoints',
      start: { xMm: '0', zMm: '0' }
    }, alphaRawGeometryLimits)).toEqual({ kind: 'rejected', reasonCode: 'PROJECT_BOUNDS_EXCEEDED' });
  });

  it.each([
    [
      'a fractional endpoint',
      { end: { xMm: '1.5', zMm: '0' }, kind: 'endpoints' as const, start: { xMm: '0', zMm: '0' } },
      'INVALID_DIMENSION'
    ],
    [
      'a zero endpoint delta after -0 normalization',
      { end: { xMm: '-0', zMm: '0' }, kind: 'endpoints' as const, start: { xMm: '0', zMm: '-0' } },
      'ZERO_LENGTH'
    ],
    [
      'an unsupported slope',
      { delta: { xMm: '1000', zMm: '999' }, kind: 'delta' as const, start: { xMm: '0', zMm: '0' } },
      'UNSUPPORTED_DIRECTION'
    ],
    [
      'a negative length-only diagonal',
      { kind: 'diagonal-length' as const, lengthMm: '-1', quadrant: 'NE' as const, start: { xMm: '0', zMm: '0' } },
      'INVALID_DIMENSION'
    ],
    [
      'a zero length-only diagonal',
      { kind: 'diagonal-length' as const, lengthMm: '-0', quadrant: 'NE' as const, start: { xMm: '0', zMm: '0' } },
      'ZERO_LENGTH'
    ],
    [
      'a coordinate outside the Project policy',
      { end: { xMm: '100001', zMm: '0' }, kind: 'endpoints' as const, start: { xMm: '0', zMm: '0' } },
      'PROJECT_BOUNDS_EXCEEDED'
    ]
  ])('rejects %s without materializing topology state', (_label, request, reasonCode) => {
    expect(resolveRawWallGeometry(request, alphaRawGeometryLimits)).toEqual({ kind: 'rejected', reasonCode });
  });
});
