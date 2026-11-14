import { describe, expect, it } from '@rstest/core';

import { validateProjectName } from './project-name-policy';
import { hasOnlyUnicodeScalarValues } from './unicode-scalar-values';

describe('validateProjectName', () => {
  it('trims an accepted project name while preserving its valid result discriminator', () => {
    expect(validateProjectName('  План B  ')).toEqual({ kind: 'valid', name: 'План B' });
  });

  it('uses the stable missing-name reason for an all-whitespace value', () => {
    expect(validateProjectName('\n\t ')).toEqual({
      kind: 'rejected',
      reasonCode: 'PROJECT_NAME_REQUIRED'
    });
  });

  it('detects a lone UTF-16 surrogate before it can become durable project data', () => {
    const malformedName = `План ${String.fromCharCode(0xd800)}`;

    expect(malformedName.charCodeAt(malformedName.length - 1)).toBe(0xd800);
    expect(hasOnlyUnicodeScalarValues(malformedName)).toBe(false);
  });

  it('accepts scalar values at both Unicode surrogate-pair boundaries', () => {
    expect(hasOnlyUnicodeScalarValues(
      `A${String.fromCharCode(0xd800, 0xdc00)}${String.fromCharCode(0xdbff, 0xdfff)}B`
    )).toBe(true);
  });

  it('rejects every isolated surrogate boundary and malformed pair', () => {
    const highMinimum = String.fromCharCode(0xd800);
    const highMaximum = String.fromCharCode(0xdbff);
    const lowMinimum = String.fromCharCode(0xdc00);
    const lowMaximum = String.fromCharCode(0xdfff);

    for (const malformed of [
      highMinimum,
      highMaximum,
      `${highMinimum}A`,
      `${highMinimum}\ue000`,
      lowMinimum,
      lowMaximum,
      `${lowMinimum}${lowMinimum}`
    ]) {
      expect(hasOnlyUnicodeScalarValues(malformed)).toBe(false);
    }
  });

  it('accepts BMP characters immediately above the low-surrogate range', () => {
    expect(hasOnlyUnicodeScalarValues('План\ue000')).toBe(true);
  });
});
