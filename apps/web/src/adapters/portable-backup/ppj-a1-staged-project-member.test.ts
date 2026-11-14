import { describe, expect, it } from '@rstest/core';

import { MAXIMUM_PPJ_A1_JSON_BYTES } from '../../domain/ppj-a1-lossless-json';
import {
  ingestPpjA1StagedProjectMember,
  type PpjA1IncrementalChecksum,
  type PpjA1IncrementalChecksumPort,
  type PpjA1StagedMember,
  type PpjA1StagedMemberStore
} from './ppj-a1-staged-project-member';

const encoder = new TextEncoder();

class RecordingChecksum implements PpjA1IncrementalChecksum {
  public constructor(
    private readonly events: string[],
    private readonly digestValue: string,
    private readonly afterDigest: (() => void) | undefined,
    private readonly afterUpdate: (() => void) | undefined
  ) {}

  public async digest(): Promise<string> {
    this.events.push('checksum:digest');
    this.afterDigest?.();
    return this.digestValue;
  }

  public update(bytes: Uint8Array): void {
    this.events.push(`checksum:update:${bytes.byteLength}`);
    this.afterUpdate?.();
  }
}

class RecordingChecksumPort implements PpjA1IncrementalChecksumPort {
  public afterDigest: (() => void) | undefined;
  public afterUpdate: (() => void) | undefined;

  public constructor(
    private readonly events: string[],
    private readonly digestValue: string
  ) {}

  public create(): PpjA1IncrementalChecksum {
    this.events.push('checksum:create');
    return new RecordingChecksum(this.events, this.digestValue, this.afterDigest, this.afterUpdate);
  }
}

class ByteChecksum implements PpjA1IncrementalChecksum {
  private readonly chunks: Uint8Array[] = [];

  public constructor(private readonly events: string[]) {}

  public async digest(): Promise<string> {
    this.events.push('checksum:digest');
    const byteLength = this.chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return `sum:${new TextDecoder().decode(bytes)}`;
  }

  public update(bytes: Uint8Array): void {
    this.events.push(`checksum:update:${bytes.byteLength}`);
    this.chunks.push(bytes.slice());
  }
}

class ByteChecksumPort implements PpjA1IncrementalChecksumPort {
  public constructor(private readonly events: string[]) {}

  public create(): PpjA1IncrementalChecksum {
    this.events.push('checksum:create');
    return new ByteChecksum(this.events);
  }
}

class MutatingByteChecksum implements PpjA1IncrementalChecksum {
  private readonly chunks: Uint8Array[] = [];

  public constructor(private readonly events: string[]) {}

  public async digest(): Promise<string> {
    this.events.push('checksum:digest');
    const byteLength = this.chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return `sum:${new TextDecoder().decode(bytes)}`;
  }

  public update(bytes: Uint8Array): void {
    this.events.push(`checksum:update:${bytes.byteLength}`);
    this.chunks.push(bytes.slice());
    bytes.fill(0x31);
  }
}

class MutatingByteChecksumPort implements PpjA1IncrementalChecksumPort {
  public constructor(private readonly events: string[]) {}

  public create(): PpjA1IncrementalChecksum {
    this.events.push('checksum:create');
    return new MutatingByteChecksum(this.events);
  }
}

class RecordingStagedMember implements PpjA1StagedMember {
  private readonly chunks: Uint8Array[] = [];
  public afterAppend: (() => void) | undefined;
  public afterReadChunks: (() => void) | undefined;
  public retainInputAliases = false;
  public transformReadChunk: ((chunk: Uint8Array) => Uint8Array) | undefined;

  public constructor(private readonly events: string[]) {}

  public async append(bytes: Uint8Array): Promise<void> {
    this.events.push(`stage:append:${bytes.byteLength}`);
    this.chunks.push(this.retainInputAliases ? bytes : bytes.slice());
    this.afterAppend?.();
  }

  public async discard(): Promise<void> {
    this.events.push('stage:discard');
    this.chunks.length = 0;
  }

  public async *readChunks(): AsyncGenerator<Uint8Array> {
    this.events.push('stage:read-chunks');
    for (const chunk of this.chunks) {
      const stagedChunk = chunk.slice();
      yield this.transformReadChunk?.(stagedChunk) ?? stagedChunk;
    }
    this.afterReadChunks?.();
  }

  public get stagedByteLength(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  }
}

class RecordingStagedMemberStore implements PpjA1StagedMemberStore {
  public readonly current: RecordingStagedMember;
  public afterCleanup: (() => void) | undefined;
  public afterOpen: (() => void) | undefined;
  public reachableBytes = 11;
  public unreachableBytes = 7;

  public constructor(private readonly events: string[]) {
    this.current = new RecordingStagedMember(events);
  }

  public async cleanupUnreachable(): Promise<void> {
    this.events.push('store:cleanup-unreachable');
    this.unreachableBytes = 0;
    this.afterCleanup?.();
  }

  public async open(): Promise<PpjA1StagedMember> {
    this.events.push('store:open');
    this.afterOpen?.();
    return this.current;
  }
}

async function* chunks(...values: Uint8Array[]): AsyncGenerator<Uint8Array> {
  yield* values;
}

function makeInput(
  stageStore: RecordingStagedMemberStore,
  checksum: PpjA1IncrementalChecksumPort,
  source: AsyncIterable<Uint8Array>,
  expectedChecksum: string,
  precheckedByteLength?: number,
  signal?: AbortSignal
) {
  return {
    checksum,
    expectedChecksum,
    precheckedByteLength,
    signal,
    source,
    stageStore
  };
}

describe('PPJ-A1 staged project-member ingress', () => {
  it('honours cancellation before touching recovery, staging, checksum or AST work', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    controller.abort();

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(
          store,
          new RecordingChecksumPort(events, 'sum:unexpected'),
          chunks(encoder.encode('0')),
          'sum:unexpected',
          1,
          controller.signal
        )
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('honours cancellation raised by recovery before opening a fresh staging lease', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    store.afterCleanup = () => controller.abort();

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(
          store,
          new RecordingChecksumPort(events, 'sum:unexpected'),
          chunks(encoder.encode('0')),
          'sum:unexpected',
          1,
          controller.signal
        )
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual(['store:cleanup-unreachable']);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('waits for recovery cleanup to quiesce on cancellation before opening a staging lease', async () => {
    const events: string[] = [];
    const controller = new AbortController();
    const stageStore: PpjA1StagedMemberStore = {
      cleanupUnreachable: async (signal): Promise<void> => {
        events.push('store:cleanup-unreachable');
        queueMicrotask(() => controller.abort());
        await new Promise<void>((resolve) => {
          signal?.addEventListener('abort', () => {
            events.push('store:cleanup:quiesced');
            resolve();
          }, { once: true });
        });
      },
      open: async (): Promise<PpjA1StagedMember> => {
        events.push('store:open');
        throw new Error('A cancelled cleanup must not open a staging lease');
      }
    };

    await expect(
      ingestPpjA1StagedProjectMember({
        checksum: new RecordingChecksumPort(events, 'sum:unexpected'),
        expectedChecksum: 'sum:unexpected',
        precheckedByteLength: 0,
        signal: controller.signal,
        source: chunks(encoder.encode('0')),
        stageStore
      })
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual(['store:cleanup-unreachable', 'store:cleanup:quiesced']);
  });

  it('discards a lease opened after cancellation without beginning checksum or AST work', async () => {
    const events: string[] = [];
    const controller = new AbortController();
    const stage = new RecordingStagedMember(events);
    const stageStore: PpjA1StagedMemberStore = {
      cleanupUnreachable: async (): Promise<void> => {
        events.push('store:cleanup-unreachable');
      },
      open: async (signal): Promise<PpjA1StagedMember> => {
        events.push('store:open');
        queueMicrotask(() => controller.abort());
        await new Promise<void>((resolve) => {
          signal?.addEventListener('abort', () => {
            events.push('store:open:quiesced');
            resolve();
          }, { once: true });
        });
        return stage;
      }
    };

    await expect(
      ingestPpjA1StagedProjectMember({
        checksum: new RecordingChecksumPort(events, 'sum:unexpected'),
        expectedChecksum: 'sum:unexpected',
        precheckedByteLength: 0,
        signal: controller.signal,
        source: chunks(encoder.encode('0')),
        stageStore
      })
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'store:open:quiesced',
      'stage:discard'
    ]);
  });

  it('rejects an upstream-prechecked member above 10 MiB before staging, checksum or AST work', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(
          store,
          new RecordingChecksumPort(events, 'sum:unexpected'),
          chunks(encoder.encode('{"unexpected":true}')),
          'sum:expected',
          MAXIMUM_PPJ_A1_JSON_BYTES + 1
        )
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });

    expect(events).toEqual([]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('rejects an exact parent binding above 10 MiB before staging, checksum or AST work', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);

    await expect(
      ingestPpjA1StagedProjectMember({
        checksum: new RecordingChecksumPort(events, 'sum:unexpected'),
        expectedByteLength: MAXIMUM_PPJ_A1_JSON_BYTES + 1,
        expectedChecksum: 'sum:expected',
        source: chunks(encoder.encode('{"unexpected":true}')),
        stageStore: store
      })
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });

    expect(events).toEqual([]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('stages bounded bytes, completes checksum, then and only then reads the AST member and cleans the stage', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const first = encoder.encode('{"schema');
    const second = encoder.encode('Version":1}');

    const result = await ingestPpjA1StagedProjectMember(
      makeInput(
        store,
        new RecordingChecksumPort(events, 'sum:accepted'),
        chunks(first, second),
        'sum:accepted',
        first.byteLength + second.byteLength
      )
    );

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected an admitted staged member');
    }
    expect(result.root).toMatchObject({ kind: 'object' });
    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${first.byteLength}`,
      `stage:append:${first.byteLength}`,
      `checksum:update:${second.byteLength}`,
      `stage:append:${second.byteLength}`,
      'checksum:digest',
      'checksum:create',
      'stage:read-chunks',
      `checksum:update:${first.byteLength}`,
      `checksum:update:${second.byteLength}`,
      'checksum:digest',
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('rejects checksum mismatch before AST read and still removes staged bytes', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const bytes = encoder.encode('{"schemaVersion":1}');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new RecordingChecksumPort(events, 'sum:actual'), chunks(bytes), 'sum:expected', bytes.byteLength)
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${bytes.byteLength}`,
      `stage:append:${bytes.byteLength}`,
      'checksum:digest',
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('rejects an exact parent byte-length mismatch before digest or staged AST read', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const bytes = encoder.encode('{}');

    await expect(
      ingestPpjA1StagedProjectMember({
        checksum: new RecordingChecksumPort(events, 'sum:accepted'),
        expectedByteLength: 1,
        expectedChecksum: 'sum:accepted',
        precheckedByteLength: 1,
        source: chunks(bytes),
        stageStore: store
      })
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_MANIFEST_INVALID' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${bytes.byteLength}`,
      `stage:append:${bytes.byteLength}`,
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('accepts the inclusive 10 MiB streamed boundary and rejects the first byte above it before staging that byte', async () => {
    const acceptedEvents: string[] = [];
    const acceptedStore = new RecordingStagedMemberStore(acceptedEvents);
    const acceptedBytes = new Uint8Array(MAXIMUM_PPJ_A1_JSON_BYTES);
    acceptedBytes.fill(0x20);
    acceptedBytes[acceptedBytes.length - 1] = 0x30;

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(
          acceptedStore,
          new RecordingChecksumPort(acceptedEvents, 'sum:accepted'),
          chunks(acceptedBytes),
          'sum:accepted',
          MAXIMUM_PPJ_A1_JSON_BYTES
        )
      )
    ).resolves.toMatchObject({ kind: 'accepted' });
    expect(acceptedEvents).toContain(`stage:append:${MAXIMUM_PPJ_A1_JSON_BYTES}`);
    expect(acceptedEvents).toContain('stage:read-chunks');
    expect(acceptedStore.current.stagedByteLength).toBe(0);

    const rejectedEvents: string[] = [];
    const rejectedStore = new RecordingStagedMemberStore(rejectedEvents);
    const atLimit = new Uint8Array(MAXIMUM_PPJ_A1_JSON_BYTES);
    const firstByteAbove = new Uint8Array([0x20]);

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(
          rejectedStore,
          new RecordingChecksumPort(rejectedEvents, 'sum:unexpected'),
          chunks(atLimit, firstByteAbove),
          'sum:unexpected'
        )
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    expect(rejectedEvents).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${MAXIMUM_PPJ_A1_JSON_BYTES}`,
      `stage:append:${MAXIMUM_PPJ_A1_JSON_BYTES}`,
      'stage:discard'
    ]);
    expect(rejectedStore.current.stagedByteLength).toBe(0);
  });

  it('cancels after a staged chunk without staged checksum, AST read or retained staging', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    const first = encoder.encode('{"schemaVersion":1');
    const second = encoder.encode('}');

    async function* abortAfterFirstChunk(): AsyncGenerator<Uint8Array> {
      yield first;
      controller.abort();
      yield second;
    }

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(
          store,
          new RecordingChecksumPort(events, 'sum:unexpected'),
          abortAfterFirstChunk(),
          'sum:unexpected',
          first.byteLength + second.byteLength,
          controller.signal
        )
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${first.byteLength}`,
      `stage:append:${first.byteLength}`,
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('cancels immediately after staging a chunk before source checksum completion', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    store.current.afterAppend = () => controller.abort();
    const bytes = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(
          store,
          new RecordingChecksumPort(events, 'sum:unexpected'),
          chunks(bytes),
          'sum:unexpected',
          bytes.byteLength,
          controller.signal
        )
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${bytes.byteLength}`,
      `stage:append:${bytes.byteLength}`,
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('cancels after the source checksum update before staging the chunk', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    const checksum = new RecordingChecksumPort(events, 'sum:unexpected');
    checksum.afterUpdate = () => controller.abort();
    const bytes = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, checksum, chunks(bytes), 'sum:unexpected', bytes.byteLength, controller.signal)
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${bytes.byteLength}`,
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('cancels after the source checksum completes before staged bytes are read as AST input', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    const checksum = new RecordingChecksumPort(events, 'sum:accepted');
    checksum.afterDigest = () => controller.abort();
    const bytes = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, checksum, chunks(bytes), 'sum:accepted', bytes.byteLength, controller.signal)
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${bytes.byteLength}`,
      `stage:append:${bytes.byteLength}`,
      'checksum:digest',
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('cancels after staged bytes are read before completing their checksum', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    store.current.afterReadChunks = () => controller.abort();
    const bytes = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(
          store,
          new RecordingChecksumPort(events, 'sum:accepted'),
          chunks(bytes),
          'sum:accepted',
          bytes.byteLength,
          controller.signal
        )
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${bytes.byteLength}`,
      `stage:append:${bytes.byteLength}`,
      'checksum:digest',
      'checksum:create',
      'stage:read-chunks',
      `checksum:update:${bytes.byteLength}`,
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('rejects staged bytes that differ from the checksum-valid source before parser dispatch', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    store.current.transformReadChunk = () => encoder.encode('1');
    const source = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new ByteChecksumPort(events), chunks(source), 'sum:0', source.byteLength)
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${source.byteLength}`,
      `stage:append:${source.byteLength}`,
      'checksum:digest',
      'checksum:create',
      'stage:read-chunks',
      `checksum:update:${source.byteLength}`,
      'checksum:digest',
      'stage:discard'
    ]);
  });

  it('rejects replacement bytes even when a staged-only checksum would accept them', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    store.current.transformReadChunk = () => encoder.encode('1');
    const source = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new ByteChecksumPort(events), chunks(source), 'sum:1', source.byteLength)
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
  });

  it('rejects a malformed staged replacement at checksum verification before AST traversal', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    store.current.transformReadChunk = () => new Uint8Array([0x80]);
    const source = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new ByteChecksumPort(events), chunks(source), 'sum:0', source.byteLength)
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CHECKSUM_MISMATCH' });
  });

  it('owns a copy of each source chunk before a retaining stage or producer can mutate its input', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    store.current.retainInputAliases = true;
    const source = encoder.encode('0');
    store.current.afterAppend = () => {
      source[0] = 0x31;
    };

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new ByteChecksumPort(events), chunks(source), 'sum:0', source.byteLength)
      )
    ).resolves.toMatchObject({ kind: 'accepted', root: { kind: 'number', lexeme: '0' } });
  });

  it('keeps AST input separate when a checksum port mutates the bytes it receives', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const source = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new MutatingByteChecksumPort(events), chunks(source), 'sum:0', source.byteLength)
      )
    ).resolves.toMatchObject({ kind: 'accepted', root: { kind: 'number', lexeme: '0' } });
  });

  it('waits for an append to quiesce on cancellation before it discards the opened stage', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    store.current.append = async (bytes, signal?: AbortSignal): Promise<void> => {
      events.push(`stage:append:${bytes.byteLength}`);
      queueMicrotask(() => controller.abort());
      await new Promise<void>((resolve) => {
        signal?.addEventListener('abort', () => {
          events.push('stage:append:quiesced');
          resolve();
        }, { once: true });
      });
    };
    const bytes = encoder.encode('0');

    const result = await Promise.race([
      ingestPpjA1StagedProjectMember(
        makeInput(store, new RecordingChecksumPort(events, 'sum:unexpected'), chunks(bytes), 'sum:unexpected', bytes.byteLength, controller.signal)
      ),
      new Promise<{ readonly kind: 'timed-out' }>((resolve) => setTimeout(() => resolve({ kind: 'timed-out' }), 100))
    ]);

    expect(result).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });
    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${bytes.byteLength}`,
      `stage:append:${bytes.byteLength}`,
      'stage:append:quiesced',
      'stage:discard'
    ]);
  });

  it('waits for a checksum digest to quiesce on cancellation before it discards the opened stage', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    let createdChecksums = 0;
    const checksum: PpjA1IncrementalChecksumPort = {
      create: (): PpjA1IncrementalChecksum => {
        createdChecksums += 1;
        const sequence = createdChecksums;
        events.push(`checksum:create:${sequence}`);
        return {
          digest: async (signal?: AbortSignal): Promise<string> => {
            events.push(`checksum:digest:${sequence}`);
            if (sequence === 1) {
              return 'sum:0';
            }
            queueMicrotask(() => controller.abort());
            return new Promise<string>((resolve) => {
              signal?.addEventListener('abort', () => {
                events.push('checksum:digest:quiesced');
                resolve('sum:0');
              }, { once: true });
            });
          },
          update: (bytes): void => {
            events.push(`checksum:update:${sequence}:${bytes.byteLength}`);
          }
        };
      }
    };
    const bytes = encoder.encode('0');

    const result = await Promise.race([
      ingestPpjA1StagedProjectMember(
        makeInput(store, checksum, chunks(bytes), 'sum:0', bytes.byteLength, controller.signal)
      ),
      new Promise<{ readonly kind: 'timed-out' }>((resolve) => setTimeout(() => resolve({ kind: 'timed-out' }), 100))
    ]);

    expect(result).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });
    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create:1',
      'checksum:update:1:1',
      `stage:append:${bytes.byteLength}`,
      'checksum:digest:1',
      'checksum:create:2',
      'stage:read-chunks',
      'checksum:update:2:1',
      'checksum:digest:2',
      'checksum:digest:quiesced',
      'stage:discard'
    ]);
  });

  it('waits for a cancelled staged read to quiesce before it discards the lease', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    const bytes = encoder.encode('0');
    Reflect.set(store.current, 'readChunks', (signal?: AbortSignal): AsyncIterable<Uint8Array> => {
      events.push('stage:read-chunks');
      return {
        [Symbol.asyncIterator]: () => ({
          next: () => {
            events.push('stage:read:next');
            queueMicrotask(() => controller.abort());
            return new Promise<IteratorResult<Uint8Array>>(() => undefined);
          },
          return: async () => {
            events.push('stage:read:return');
            await Promise.resolve();
            if (!signal?.aborted) {
              throw new Error('The staged reader did not receive the cancellation signal');
            }
            events.push('stage:read:quiesced');
            return { done: true, value: undefined };
          }
        })
      };
    });

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new ByteChecksumPort(events), chunks(bytes), 'sum:0', bytes.byteLength, controller.signal)
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      `checksum:update:${bytes.byteLength}`,
      `stage:append:${bytes.byteLength}`,
      'checksum:digest',
      'checksum:create',
      'stage:read-chunks',
      'stage:read:next',
      'stage:read:return',
      'stage:read:quiesced',
      'stage:discard'
    ]);
  });

  it('cancels and discards an opened stage when an uncooperative source never resolves its next chunk', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          events.push('source:next');
          queueMicrotask(() => controller.abort());
          return new Promise<IteratorResult<Uint8Array>>(() => undefined);
        },
        return: async () => {
          events.push('source:return');
          return { done: true, value: undefined };
        }
      })
    };

    const result = await Promise.race([
      ingestPpjA1StagedProjectMember(
        makeInput(store, new RecordingChecksumPort(events, 'sum:unexpected'), source, 'sum:unexpected', 0, controller.signal)
      ),
      new Promise<{ readonly kind: 'timed-out' }>((resolve) => setTimeout(() => resolve({ kind: 'timed-out' }), 100))
    ]);

    expect(result).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });
    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      'source:next',
      'source:return',
      'stage:discard'
    ]);
    expect(store.current.stagedByteLength).toBe(0);
  });

  it('discards an opened stage when a cancelled iterator throws synchronously from return', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const controller = new AbortController();
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          events.push('source:next');
          queueMicrotask(() => controller.abort());
          return new Promise<IteratorResult<Uint8Array>>(() => undefined);
        },
        return: () => {
          events.push('source:return');
          throw new Error('uncooperative cleanup failure');
        }
      })
    };

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new RecordingChecksumPort(events, 'sum:unexpected'), source, 'sum:unexpected', 0, controller.signal)
      )
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' });

    expect(events).toEqual([
      'store:cleanup-unreachable',
      'store:open',
      'checksum:create',
      'source:next',
      'source:return',
      'stage:discard'
    ]);
  });

  it('cleans only unreachable prior staging before opening the next member', async () => {
    const events: string[] = [];
    const store = new RecordingStagedMemberStore(events);
    const bytes = encoder.encode('0');

    await expect(
      ingestPpjA1StagedProjectMember(
        makeInput(store, new RecordingChecksumPort(events, 'sum:accepted'), chunks(bytes), 'sum:accepted', bytes.byteLength)
      )
    ).resolves.toMatchObject({ kind: 'accepted' });

    expect(store.unreachableBytes).toBe(0);
    expect(store.reachableBytes).toBe(11);
    expect(events.slice(0, 2)).toEqual(['store:cleanup-unreachable', 'store:open']);
  });
});
