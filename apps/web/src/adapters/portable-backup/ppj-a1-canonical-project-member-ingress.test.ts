import { describe, expect, it } from '@rstest/core';

import { MAXIMUM_PPJ_A1_JSON_BYTES } from '../../domain/ppj-a1-lossless-json';
import type {
  PpjA1IncrementalChecksum,
  PpjA1IncrementalChecksumPort,
  PpjA1StagedMember,
  PpjA1StagedMemberStore
} from './ppj-a1-staged-project-member';
import {
  ingestPpjA1CanonicalProjectMember,
  type PpjA1ArchiveEntry,
  type PpjA1ArchiveEntryOpenResult,
  type PpjA1ArchiveEntryReadResult,
  type PpjA1ArchiveEntryLease
} from './ppj-a1-canonical-project-member-ingress';

const encoder = new TextEncoder();
const archiveSourceFailureReasons = [
  'BACKUP_CANCELLED',
  'BACKUP_COMPRESSION_RATIO',
  'BACKUP_CONTAINER_BYTES_LIMIT',
  'BACKUP_CONTAINER_UNSUPPORTED',
  'BACKUP_ENTRY_LIMIT',
  'BACKUP_UNPACKED_BYTES_LIMIT'
] as const;

class HexChecksum implements PpjA1IncrementalChecksum {
  private readonly chunks: Uint8Array[] = [];

  public update(bytes: Uint8Array): void {
    this.chunks.push(bytes.slice());
  }

  public async digest(): Promise<string> {
    return `hex:${this.chunks.flatMap((chunk) => [...chunk]).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
}

class HexChecksumPort implements PpjA1IncrementalChecksumPort {
  public create(): PpjA1IncrementalChecksum {
    return new HexChecksum();
  }
}

class ByteLengthChecksum implements PpjA1IncrementalChecksum {
  private byteLength = 0;

  public update(bytes: Uint8Array): void {
    this.byteLength += bytes.byteLength;
  }

  public async digest(): Promise<string> {
    return `bytes:${this.byteLength}`;
  }
}

class ByteLengthChecksumPort implements PpjA1IncrementalChecksumPort {
  public create(): PpjA1IncrementalChecksum {
    return new ByteLengthChecksum();
  }
}

class MemoryStage implements PpjA1StagedMember {
  private readonly chunks: Uint8Array[] = [];

  public constructor(private readonly events: string[]) {}

  public async append(bytes: Uint8Array): Promise<void> {
    this.events.push(`append:${bytes.byteLength}`);
    this.chunks.push(bytes.slice());
  }

  public async discard(): Promise<void> {
    this.events.push('discard');
    this.chunks.length = 0;
  }

  public async *readChunks(): AsyncGenerator<Uint8Array> {
    this.events.push('read');
    for (const chunk of this.chunks) {
      yield chunk.slice();
    }
  }
}

class MemoryStageStore implements PpjA1StagedMemberStore {
  public readonly events: string[] = [];
  public readonly stage = new MemoryStage(this.events);

  public async cleanupUnreachable(): Promise<void> {
    this.events.push('cleanup');
  }

  public async open(): Promise<PpjA1StagedMember> {
    this.events.push('open-stage');
    return this.stage;
  }
}

type TestEntry = PpjA1ArchiveEntry & {
  readonly closeCalls: () => number;
  readonly openCalls: () => number;
};

function entry(
  rawName: string | Uint8Array,
  bytes: Uint8Array,
  declaredByteLength = bytes.byteLength
): TestEntry {
  let closes = 0;
  let opens = 0;
  return {
    declaredByteLength,
    open: async (): Promise<PpjA1ArchiveEntryOpenResult> => {
      opens += 1;
      return {
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'chunk', bytes }),
          close: async () => {
            closes += 1;
            return { kind: 'closed' };
          }
        }
      };
    },
    rawName: typeof rawName === 'string' ? encoder.encode(rawName) : rawName,
    closeCalls: (): number => closes,
    openCalls: (): number => opens
  };
}

async function* chunks(...values: PpjA1ArchiveEntryReadResult[]): AsyncGenerator<PpjA1ArchiveEntryReadResult> {
  yield* values;
}

function input(entries: readonly PpjA1ArchiveEntry[], stageStore = new MemoryStageStore()) {
  const includesManifestOrChecksums = entries.some((candidate) => {
    const name = new TextDecoder().decode(candidate.rawName);
    return name === 'manifest.json' || name === 'checksums.json';
  });
  const completeEntries = includesManifestOrChecksums
    ? entries
    : [entry('manifest.json', encoder.encode('{}')), entry('checksums.json', encoder.encode('{}')), ...entries];
  const selectedEntry = entries.find((candidate) => new TextDecoder().decode(candidate.rawName) === 'project/project.json') ?? entries[0];
  if (selectedEntry === undefined) {
    throw new Error('A test input requires at least one archive entry');
  }
  return {
    checksum: new HexChecksumPort(),
    entries: completeEntries,
    selection: {
      entry: selectedEntry,
      expectedByteLength: selectedEntry.declaredByteLength,
      expectedChecksum: 'hex:30'
    },
    stageStore
  };
}

describe('PPJ-A1 canonical Project member ingress', () => {
  it('admits the exact canonical member only after raw archive names are safe and stages its bytes', async () => {
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = input([
      entry('manifest.json', encoder.encode('{}')),
      entry('checksums.json', encoder.encode('{}')),
      project,
      entry(`catalog/${'a'.repeat(64)}.asset`, encoder.encode('asset')),
      entry(`catalog/${'b'.repeat(64)}.texture`, encoder.encode('texture')),
      entry(`custom/${'c'.repeat(64)}.glb`, encoder.encode('glb'))
    ]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toMatchObject({
      kind: 'accepted',
      root: { kind: 'number', lexeme: '0' }
    });

    expect(project.openCalls()).toBe(1);
    expect(project.closeCalls()).toBe(1);
    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:1', 'read', 'discard']);
  });

  it.each([
    '.interiors/project/project.json',
    './project/project.json',
    'project//project.json',
    'project\\project.json',
    `catalog/${'A'.repeat(64)}.asset`,
    `xatalog/${'a'.repeat(64)}.asset`,
    `catalog/${'a'.repeat(64)}.bsset`,
    `catalog/${'a'.repeat(63)}.asset`,
    `catalog/${'a'.repeat(65)}.asset`,
    `catalog/${'a'.repeat(63)}z.asset`,
    `catalog/${'a'.repeat(63)}:.asset`,
    `catalog/${'a'.repeat(63)}/.asset`,
    new Uint8Array([0x1f]),
    new Uint8Array([0x70, 0x72, 0x6f, 0x6a, 0x65, 0x63, 0x74, 0x2f, 0xff])
  ])('rejects unsafe raw entry name %p before opening or staging the Project member', async (unsafeName) => {
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = input([project, entry(unsafeName, encoder.encode('irrelevant'))]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PATH_UNSAFE'
    });

    expect(project.openCalls()).toBe(0);
    expect(project.closeCalls()).toBe(0);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it.each(['0', '9', 'a', 'f'])('accepts the inclusive lowercase hexadecimal boundary %s in a content-addressed entry', async (boundary) => {
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = input([project, entry(`catalog/${boundary.repeat(64)}.asset`, encoder.encode('asset'))]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toMatchObject({
      kind: 'accepted',
      root: { kind: 'number', lexeme: '0' }
    });
  });

  it('rejects a duplicate raw entry name before opening or staging the canonical Project member', async () => {
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = input([project, entry('project/project.json', encoder.encode('0'))]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PATH_UNSAFE'
    });

    expect(project.openCalls()).toBe(0);
    expect(project.closeCalls()).toBe(0);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it('rejects a missing canonical Project member as an invalid manifest selection without staging', async () => {
    const submitted = input([entry('manifest.json', encoder.encode('{}'))]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_MANIFEST_INVALID'
    });

    expect(submitted.stageStore.events).toEqual([]);
  });

  it('rejects a container without checksums.json before opening the otherwise canonical Project member', async () => {
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = input([entry('manifest.json', encoder.encode('{}')), project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_MANIFEST_INVALID'
    });

    expect(project.openCalls()).toBe(0);
    expect(project.closeCalls()).toBe(0);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it('rejects a container without manifest.json before opening the otherwise canonical Project member', async () => {
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = input([entry('checksums.json', encoder.encode('{}')), project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_MANIFEST_INVALID'
    });

    expect(project.openCalls()).toBe(0);
    expect(project.closeCalls()).toBe(0);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it('rejects a complete safe name set that has no canonical Project member before staging', async () => {
    const submitted = input([
      entry('manifest.json', encoder.encode('{}')),
      entry('checksums.json', encoder.encode('{}'))
    ]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_MANIFEST_INVALID'
    });

    expect(submitted.stageStore.events).toEqual([]);
  });

  it('rejects an over-limit declared Project member before opening it, checksumming or parsing it', async () => {
    const project = entry('project/project.json', encoder.encode('0'), MAXIMUM_PPJ_A1_JSON_BYTES + 1);
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PROJECT_LIMIT'
    });

    expect(project.openCalls()).toBe(0);
    expect(project.closeCalls()).toBe(0);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it('passes the inclusive 10 MiB manifest-bound member through staging before raw JSON rejects its invalid bytes', async () => {
    const project = entry('project/project.json', new Uint8Array(MAXIMUM_PPJ_A1_JSON_BYTES));
    const submitted = {
      ...input([project]),
      checksum: new ByteLengthChecksumPort(),
      selection: {
        entry: project,
        expectedByteLength: MAXIMUM_PPJ_A1_JSON_BYTES,
        expectedChecksum: `bytes:${MAXIMUM_PPJ_A1_JSON_BYTES}`
      }
    };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_SCHEMA_UNREADABLE'
    });

    expect(project.openCalls()).toBe(1);
    expect(project.closeCalls()).toBe(1);
    expect(submitted.stageStore.events).toEqual([
      'cleanup',
      'open-stage',
      `append:${MAXIMUM_PPJ_A1_JSON_BYTES}`,
      'read',
      'discard'
    ]);
  });

  it('honours cancellation before opening the selected canonical Project member or staging bytes', async () => {
    const controller = new AbortController();
    controller.abort();
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = { ...input([project]), signal: controller.signal };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CANCELLED'
    });

    expect(project.openCalls()).toBe(0);
    expect(project.closeCalls()).toBe(0);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it('waits for a source lease opened during cancellation to quiesce and close before returning', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async (): Promise<PpjA1ArchiveEntryOpenResult> => {
        events.push('source:open');
        controller.abort();
        await Promise.resolve();
        events.push('source:quiesced');
        return {
          kind: 'opened',
          lease: {
            chunks: () => chunks({ kind: 'chunk', bytes: encoder.encode('0') }),
            close: async () => {
              events.push('source:close');
              return { kind: 'closed' };
            }
          }
        };
      },
      rawName: encoder.encode('project/project.json')
    };
    const submitted = { ...input([project]), signal: controller.signal };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CANCELLED'
    });

    expect(events).toEqual(['source:open', 'source:quiesced', 'source:close']);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it('returns a typed container failure from opening the selected Project member before staging work begins', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual([]);
  });

  it.each(archiveSourceFailureReasons)('preserves the typed open failure reason %s before staging work begins', async (reasonCode) => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({ kind: 'rejected', reasonCode }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode
    });

    expect(submitted.stageStore.events).toEqual([]);
  });

  it('maps a malformed typed open outcome to a stable container failure before staging work begins', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({ kind: 'unexpected' }) as never,
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual([]);
  });

  it.each([
    { kind: 'unexpected', lease: validLease() },
    { kind: 'opened', lease: { chunks: validLease().chunks } },
    { kind: 'opened', lease: { close: validLease().close } }
  ])('maps malformed opened lease shape %p before staging work begins', async (outcome) => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => outcome as never,
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual([]);
  });

  it('stops before checksum digest or AST traversal when the selected member read reports a typed container failure', async () => {
    const events: string[] = [];
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'rejected', reasonCode: 'BACKUP_COMPRESSION_RATIO' }),
          close: async () => {
            events.push('source:close');
            return { kind: 'closed' };
          }
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_COMPRESSION_RATIO'
    });

    expect(events).toEqual(['source:close']);
    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'discard']);
  });

  it('maps a malformed typed read outcome to a stable container failure before checksum digest or AST traversal', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'unexpected' } as never),
          close: async () => ({ kind: 'closed' })
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'discard']);
  });

  it.each([
    { kind: 'unexpected', bytes: encoder.encode('0') },
    { kind: 'chunk', bytes: 'not-a-byte-array' }
  ])('maps malformed typed read shape %p before checksum digest or AST traversal', async (readResult) => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks(readResult as never),
          close: async () => ({ kind: 'closed' })
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'discard']);
  });

  it('does not accept a staged Project when the source lease cannot close', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'chunk', bytes: encoder.encode('0') }),
          close: async () => ({ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' })
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:1', 'read', 'discard']);
  });

  it('does not accept a staged Project when close reports a malformed typed outcome', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'chunk', bytes: encoder.encode('0') }),
          close: async () => ({ kind: 'unexpected' }) as never
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:1', 'read', 'discard']);
  });

  it('maps an unknown typed close reason to the stable container failure instead of leaking it', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'chunk', bytes: encoder.encode('0') }),
          close: async () => ({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' }) as never
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:1', 'read', 'discard']);
  });

  it('preserves an earlier checksum failure when a later source close also reports a failure', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 2,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'chunk', bytes: new Uint8Array([0xc3, 0x28]) }),
          close: async () => ({ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' })
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CHECKSUM_MISMATCH'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:2', 'discard']);
  });

  it('maps a container port violation while opening the selected Project member to a stable failure', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async (): Promise<never> => {
        throw new Error('raw open failure');
      },
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual([]);
  });

  it('preserves cancellation when opening violates the container contract after cancellation began', async () => {
    const controller = new AbortController();
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async (): Promise<never> => {
        controller.abort();
        throw new Error('raw open failure after cancellation');
      },
      rawName: encoder.encode('project/project.json')
    };
    const submitted = { ...input([project]), signal: controller.signal };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CANCELLED'
    });

    expect(submitted.stageStore.events).toEqual([]);
  });

  it('maps a container port violation while reading the selected Project member to a stable failure', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => brokenChunks(),
          close: async () => ({ kind: 'closed' })
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'discard']);
  });

  it('preserves cancellation when reading violates the container contract after cancellation began', async () => {
    const controller = new AbortController();
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => abortingBrokenChunks(controller),
          close: async () => ({ kind: 'closed' })
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = { ...input([project]), signal: controller.signal };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CANCELLED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'discard']);
  });

  it('preserves cancellation when starting the selected-member read violates the container contract', async () => {
    const controller = new AbortController();
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => {
            controller.abort();
            throw new Error('raw read-start failure after cancellation');
          },
          close: async () => ({ kind: 'closed' })
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = { ...input([project]), signal: controller.signal };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CANCELLED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'discard']);
  });

  it('maps a container port violation while closing an otherwise valid Project member to a stable failure', async () => {
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'chunk', bytes: encoder.encode('0') }),
          close: async (): Promise<never> => {
            throw new Error('raw close failure');
          }
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:1', 'read', 'discard']);
  });

  it('preserves cancellation when closing violates the container contract after cancellation began', async () => {
    const controller = new AbortController();
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'chunk', bytes: encoder.encode('0') }),
          close: async (): Promise<never> => {
            controller.abort();
            throw new Error('raw close failure');
          }
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = { ...input([project]), signal: controller.signal };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CANCELLED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:1', 'read', 'discard']);
  });

  it('does not accept a staged Project when cancellation begins during a normally completing close', async () => {
    const controller = new AbortController();
    const project: PpjA1ArchiveEntry = {
      declaredByteLength: 1,
      open: async () => ({
        kind: 'opened',
        lease: {
          chunks: () => chunks({ kind: 'chunk', bytes: encoder.encode('0') }),
          close: async () => {
            controller.abort();
            return { kind: 'closed' };
          }
        }
      }),
      rawName: encoder.encode('project/project.json')
    };
    const submitted = { ...input([project]), signal: controller.signal };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CANCELLED'
    });

    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:1', 'read', 'discard']);
  });

  it('rejects a manifest binding whose declared Project byte count is not bound to the selected entry before opening it', async () => {
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = {
      ...input([project]),
      selection: {
        entry: project,
        expectedByteLength: 2,
        expectedChecksum: 'hex:30'
      }
    };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_MANIFEST_INVALID'
    });

    expect(project.openCalls()).toBe(0);
    expect(project.closeCalls()).toBe(0);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it('rejects a manifest binding to a different safe entry even when its byte count happens to match the Project member', async () => {
    const manifest = entry('manifest.json', encoder.encode('0'));
    const project = entry('project/project.json', encoder.encode('0'));
    const submitted = {
      ...input([manifest, entry('checksums.json', encoder.encode('{}')), project]),
      selection: {
        entry: manifest,
        expectedByteLength: 1,
        expectedChecksum: 'hex:30'
      }
    };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_MANIFEST_INVALID'
    });

    expect(project.openCalls()).toBe(0);
    expect(project.closeCalls()).toBe(0);
    expect(submitted.stageStore.events).toEqual([]);
  });

  it('rejects a checksum-valid stream whose factual byte count differs from the bound manifest entry', async () => {
    const project = entry('project/project.json', encoder.encode('{}'), 1);
    const submitted = {
      ...input([project]),
      selection: {
        entry: project,
        expectedByteLength: 1,
        expectedChecksum: 'hex:7b7d'
      }
    };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_MANIFEST_INVALID'
    });

    expect(project.openCalls()).toBe(1);
    expect(project.closeCalls()).toBe(1);
    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:2', 'discard']);
  });

  it('rejects a factual size mismatch before checksum or AST can classify malformed source bytes', async () => {
    const project = entry('project/project.json', new Uint8Array([0xc3, 0x28]), 1);
    const submitted = {
      ...input([project]),
      selection: {
        entry: project,
        expectedByteLength: 1,
        expectedChecksum: 'hex:c328'
      }
    };

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_MANIFEST_INVALID'
    });

    expect(project.openCalls()).toBe(1);
    expect(project.closeCalls()).toBe(1);
    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:2', 'discard']);
  });

  it('keeps checksum mismatch ahead of raw JSON parsing for the selected canonical member', async () => {
    const project = entry('project/project.json', new Uint8Array([0xc3, 0x28]));
    const submitted = input([project]);

    await expect(ingestPpjA1CanonicalProjectMember(submitted)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CHECKSUM_MISMATCH'
    });

    expect(project.openCalls()).toBe(1);
    expect(project.closeCalls()).toBe(1);
    expect(submitted.stageStore.events).toEqual(['cleanup', 'open-stage', 'append:2', 'discard']);
  });
});

function abortingBrokenChunks(controller: AbortController): AsyncIterable<PpjA1ArchiveEntryReadResult> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: async (): Promise<IteratorResult<PpjA1ArchiveEntryReadResult>> => {
        controller.abort();
        throw new Error('raw read failure');
      }
    })
  };
}

function brokenChunks(): AsyncIterable<PpjA1ArchiveEntryReadResult> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: async (): Promise<IteratorResult<PpjA1ArchiveEntryReadResult>> => {
        throw new Error('raw read failure');
      }
    })
  };
}

function validLease(): PpjA1ArchiveEntryLease {
  return {
    chunks: () => chunks({ kind: 'chunk', bytes: encoder.encode('0') }),
    close: async () => ({ kind: 'closed' })
  };
}
