import { describe, expect, it } from '@rstest/core';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const fixturePath = new URL('./fixtures/contacts-lineage.tcc-a1.json', import.meta.url);

describe('W-READY-2026-08-30/S-2 contacts, faces and lineage detached corpus', () => {
  it('keeps the three blocked raw-input fixtures byte-addressable without relabelling them as execution evidence', () => {
    const manifest = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      contractId?: unknown;
      fixtures?: readonly {
        executorDisposition?: unknown;
        rawInput?: unknown;
        rawInputByteLength?: unknown;
        rawInputSha256?: unknown;
      }[];
    };
    expect(manifest.contractId).toBe('interiors.topology-corpus-contract');
    expect(manifest.fixtures).toHaveLength(3);
    for (const fixture of manifest.fixtures ?? []) {
      expect(fixture.executorDisposition).toBe('BLOCKED_UNSUPPORTED_TCC_A1_OUTCOME');
      expect(typeof fixture.rawInput).toBe('string');
      const raw = Buffer.from(fixture.rawInput as string, 'utf8');
      expect(raw.byteLength).toBe(fixture.rawInputByteLength);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.rawInputSha256);
    }
  });
});
