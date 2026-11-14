import {
  MAXIMUM_PPJ_A1_JSON_BYTES,
  parsePpjA1JsonBytes,
  type LosslessJsonValue,
  type ParsePpjA1JsonBytesResult
} from '../../domain/ppj-a1-lossless-json';

export interface PpjA1IncrementalChecksum {
  update(bytes: Uint8Array): void;
  /** Resolves only after the digest operation has quiesced for this signal. */
  digest(signal: AbortSignal | undefined): Promise<string>;
}

export interface PpjA1IncrementalChecksumPort {
  create(): PpjA1IncrementalChecksum;
}

/**
 * An opaque staging lease provided by the archive/container adapter.
 *
 * This seam neither creates Project/Revision identifiers nor keeps staged bytes
 * after it has returned. A concrete durable adapter later owns the journal and
 * decides which prior stages are unreachable on restart.
 */
export interface PpjA1StagedMember {
  /** Resolves only after append has quiesced; no write may continue after abort. */
  append(bytes: Uint8Array, signal: AbortSignal | undefined): Promise<void>;
  /**
   * Produces the staged snapshot once source staging has completed. The caller
   * copies every yielded chunk before it is checksummed or parsed. Its iterator
   * must quiesce a pending read before return() resolves after cancellation.
   */
  readChunks(signal: AbortSignal | undefined): AsyncIterable<Uint8Array>;
  discard(): Promise<void>;
}

export interface PpjA1StagedMemberStore {
  /** Resolves only after recovery cleanup has quiesced for this signal. */
  cleanupUnreachable(signal: AbortSignal | undefined): Promise<void>;
  /** Resolves only after opening has quiesced for this signal. */
  open(signal: AbortSignal | undefined): Promise<PpjA1StagedMember>;
}

export type IngestPpjA1StagedProjectMemberInput = {
  readonly checksum: PpjA1IncrementalChecksumPort;
  /**
   * An optional size already bounded by the parent container adapter. This
   * seam does not interpret an archive header or manifest declaration; it
   * still applies the inclusive limit to the bytes it actually stages.
   */
  readonly precheckedByteLength?: number;
  /**
   * An optional exact byte-length binding already established by a validated
   * parent selection. A mismatch is rejected before either checksum digest or
   * AST traversal; this seam does not parse the manifest that established it.
   */
  readonly expectedByteLength?: number;
  readonly expectedChecksum: string;
  readonly signal?: AbortSignal;
  readonly source: AsyncIterable<Uint8Array>;
  readonly stageStore: PpjA1StagedMemberStore;
};

export type IngestPpjA1StagedProjectMemberResult =
  | { readonly kind: 'accepted'; readonly root: LosslessJsonValue }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | 'BACKUP_CANCELLED'
        | 'BACKUP_CHECKSUM_MISMATCH'
        | 'BACKUP_MANIFEST_INVALID'
        | Extract<ParsePpjA1JsonBytesResult, { readonly kind: 'rejected' }>['reasonCode'];
    };

/**
 * Enforces the source-owned pre-AST order for an already selected canonical
 * Project member: size guard → source/staged snapshot checksums → raw JSON
 * AST. The source and staged checksum passes consume independent copies, so a
 * same-length stage replacement cannot become a valid AST input.
 *
 * It intentionally does not decode an archive, select a manifest/schema,
 * construct a Project or publish a revision. Every opened staging lease is
 * discarded before its outcome is returned.
 */
export async function ingestPpjA1StagedProjectMember(
  input: IngestPpjA1StagedProjectMemberInput
): Promise<IngestPpjA1StagedProjectMemberResult> {
  const precheckedByteLength = input.precheckedByteLength ?? 0;
  const expectedByteLength = input.expectedByteLength ?? 0;
  if (precheckedByteLength > MAXIMUM_PPJ_A1_JSON_BYTES
    || expectedByteLength > MAXIMUM_PPJ_A1_JSON_BYTES) {
    return rejected('BACKUP_PROJECT_LIMIT');
  }

  if (input.signal?.aborted) {
    return rejected('BACKUP_CANCELLED');
  }

  await input.stageStore.cleanupUnreachable(input.signal);
  if (input.signal?.aborted) {
    return rejected('BACKUP_CANCELLED');
  }

  const stage = await input.stageStore.open(input.signal);
  let sourceIterator: AsyncIterator<Uint8Array> | undefined;
  let sourceFinished = false;
  let stagedIterator: AsyncIterator<Uint8Array> | undefined;
  let stagedFinished = false;
  try {
    if (input.signal?.aborted) {
      return rejected('BACKUP_CANCELLED');
    }
    let stagedByteLength = 0;
    const sourceChecksum = input.checksum.create();
    sourceIterator = input.source[Symbol.asyncIterator]();
    while (true) {
      const sourceNext = await nextOrCancellation(sourceIterator, input.signal);
      if (sourceNext.kind === 'cancelled') {
        return rejected('BACKUP_CANCELLED');
      }
      if (sourceNext.result.done) {
        sourceFinished = true;
        break;
      }
      if (input.signal?.aborted) {
        return rejected('BACKUP_CANCELLED');
      }

      const chunk = sourceNext.result.value;
      const nextByteLength = stagedByteLength + chunk.byteLength;
      if (nextByteLength > MAXIMUM_PPJ_A1_JSON_BYTES) {
        return rejected('BACKUP_PROJECT_LIMIT');
      }

      // Neither producer nor staging adapter owns a mutable alias after this
      // boundary. The source and later staged checksum/AST passes each receive
      // their own copy in turn.
      const sourceCopy = chunk.slice();
      sourceChecksum.update(sourceCopy.slice());
      if (input.signal?.aborted) {
        return rejected('BACKUP_CANCELLED');
      }
      await stage.append(sourceCopy.slice(), input.signal);
      if (input.signal?.aborted) {
        return rejected('BACKUP_CANCELLED');
      }
      stagedByteLength = nextByteLength;
    }

    if (input.signal?.aborted) {
      return rejected('BACKUP_CANCELLED');
    }

    if (input.expectedByteLength !== undefined && stagedByteLength !== input.expectedByteLength) {
      return rejected('BACKUP_MANIFEST_INVALID');
    }

    const sourceDigest = await sourceChecksum.digest(input.signal);
    if (input.signal?.aborted) {
      return rejected('BACKUP_CANCELLED');
    }
    if (sourceDigest !== input.expectedChecksum) {
      return rejected('BACKUP_CHECKSUM_MISMATCH');
    }

    const stagedChecksum = input.checksum.create();
    const verifiedChunks: Uint8Array[] = [];
    let verifiedByteLength = 0;
    stagedIterator = stage.readChunks(input.signal)[Symbol.asyncIterator]();
    while (true) {
      const stagedNext = await nextOrCancellation(stagedIterator, input.signal);
      if (stagedNext.kind === 'cancelled') {
        return rejected('BACKUP_CANCELLED');
      }
      if (stagedNext.result.done) {
        stagedFinished = true;
        break;
      }
      if (input.signal?.aborted) {
        return rejected('BACKUP_CANCELLED');
      }

      const chunk = stagedNext.result.value.slice();
      const nextByteLength = verifiedByteLength + chunk.byteLength;
      if (nextByteLength > MAXIMUM_PPJ_A1_JSON_BYTES) {
        return rejected('BACKUP_PROJECT_LIMIT');
      }
      // The checksum port is an external capability: it receives its own
      // copy, so even a defective implementation cannot alter AST input.
      stagedChecksum.update(chunk.slice());
      verifiedChunks.push(chunk);
      verifiedByteLength = nextByteLength;
      if (input.signal?.aborted) {
        return rejected('BACKUP_CANCELLED');
      }
    }

    if (verifiedByteLength !== stagedByteLength) {
      return rejected('BACKUP_CHECKSUM_MISMATCH');
    }
    if (input.signal?.aborted) {
      return rejected('BACKUP_CANCELLED');
    }
    const stagedDigest = await stagedChecksum.digest(input.signal);
    if (input.signal?.aborted) {
      return rejected('BACKUP_CANCELLED');
    }
    if (stagedDigest !== input.expectedChecksum || stagedDigest !== sourceDigest) {
      return rejected('BACKUP_CHECKSUM_MISMATCH');
    }

    return parsePpjA1JsonBytes(joinChunks(verifiedChunks, verifiedByteLength));
  } finally {
    if (!sourceFinished) {
      abandonIterator(sourceIterator);
    }
    if (!stagedFinished) {
      await quiesceStagedIterator(stagedIterator);
    }
    await stage.discard();
  }
}

type NextOrCancellation<T> =
  | { readonly kind: 'next'; readonly result: IteratorResult<T> }
  | { readonly kind: 'cancelled' };

async function nextOrCancellation<T>(
  iterator: AsyncIterator<T>,
  signal: AbortSignal | undefined
): Promise<NextOrCancellation<T>> {
  if (signal === undefined) {
    return { kind: 'next', result: await iterator.next() };
  }
  if (signal.aborted) {
    return { kind: 'cancelled' };
  }

  let removeAbortListener = (): void => undefined;
  const cancellation = new Promise<NextOrCancellation<T>>((resolve) => {
    const onAbort = (): void => resolve({ kind: 'cancelled' });
    signal.addEventListener('abort', onAbort, { once: true });
    removeAbortListener = (): void => signal.removeEventListener('abort', onAbort);
  });
  const next = Promise.resolve(iterator.next()).then(
    (result): NextOrCancellation<T> => ({ kind: 'next', result })
  );
  // When cancellation wins the race, retain a rejection handler for a source
  // which eventually fails after its lease has already been discarded.
  void next.catch((): void => undefined);
  try {
    return await Promise.race([next, cancellation]);
  } finally {
    removeAbortListener();
  }
}

function abandonIterator(iterator: AsyncIterator<unknown> | undefined): void {
  const close = iterator?.return;
  if (iterator === undefined || close === undefined) {
    return;
  }
  // An adapter may throw synchronously from return(), but that must not
  // prevent the staging lease from discard. Invoke it before discard so a
  // cooperative iterator can release its own resource immediately.
  try {
    void Promise.resolve(close.call(iterator)).catch((): void => undefined);
  } catch {
    // Staging cleanup remains authoritative even when iterator cleanup fails.
  }
}

async function quiesceStagedIterator(iterator: AsyncIterator<unknown> | undefined): Promise<void> {
  try {
    const close = iterator?.return;
    if (iterator !== undefined && close !== undefined) {
      await close.call(iterator);
    }
  } catch {
    // Discard remains authoritative when a staged reader cannot confirm close.
  }
}

function joinChunks(chunks: readonly Uint8Array[], byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function rejected(
  reasonCode: Extract<IngestPpjA1StagedProjectMemberResult, { readonly kind: 'rejected' }>['reasonCode']
): Extract<IngestPpjA1StagedProjectMemberResult, { readonly kind: 'rejected' }> {
  return { kind: 'rejected', reasonCode };
}
