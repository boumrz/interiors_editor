import {
  MAXIMUM_PPJ_A1_JSON_BYTES,
  type LosslessJsonValue
} from '../../domain/ppj-a1-lossless-json';
import {
  ingestPpjA1StagedProjectMember,
  type IngestPpjA1StagedProjectMemberResult,
  type PpjA1IncrementalChecksumPort,
  type PpjA1StagedMemberStore
} from './ppj-a1-staged-project-member';

const CANONICAL_PROJECT_PATH = 'project/project.json';

/** Stable outcomes a container source may report while opening, reading or closing. */
export type PpjA1ArchiveSourceFailureReason =
  | 'BACKUP_CANCELLED'
  | 'BACKUP_COMPRESSION_RATIO'
  | 'BACKUP_CONTAINER_BYTES_LIMIT'
  | 'BACKUP_CONTAINER_UNSUPPORTED'
  | 'BACKUP_ENTRY_LIMIT'
  | 'BACKUP_UNPACKED_BYTES_LIMIT';

export type PpjA1ArchiveSourceFailure = {
  readonly kind: 'rejected';
  readonly reasonCode: PpjA1ArchiveSourceFailureReason;
};

/**
 * A raw central-directory entry selected by a future `.interiors` reader.
 *
 * The reader must apply container, compression and entry-level guards before
 * creating this value. This boundary intentionally owns only the exact raw
 * filename grammar and the canonical Project-member handoff; it neither
 * decodes ZIP nor parses manifest/checksums files.
 */
export type PpjA1ArchiveEntry = {
  /** Raw central-directory name bytes; no ZIP text decoding is permitted. */
  readonly rawName: Uint8Array;
  /** Already validated uncompressed size from the container entry. */
  readonly declaredByteLength: number;
  /**
   * Opens only this selected entry. It resolves with a lease only after a
   * cancelled open has quiesced for the supplied signal.
   */
  readonly open: (signal: AbortSignal | undefined) => Promise<PpjA1ArchiveEntryOpenResult>;
};

export type PpjA1ArchiveEntryOpenResult =
  | { readonly kind: 'opened'; readonly lease: PpjA1ArchiveEntryLease }
  | PpjA1ArchiveSourceFailure;

export type PpjA1ArchiveEntryLease = {
  /**
   * Emits chunks or a classified container failure. No raw exception may cross
   * this port; `close` still runs after a rejected read outcome.
   */
  readonly chunks: (signal: AbortSignal | undefined) => AsyncIterable<PpjA1ArchiveEntryReadResult>;
  /** Resolves only after any container read/decompression has quiesced. */
  readonly close: (signal: AbortSignal | undefined) => Promise<PpjA1ArchiveEntryCloseResult>;
};

export type PpjA1ArchiveEntryReadResult =
  | { readonly kind: 'chunk'; readonly bytes: Uint8Array }
  | PpjA1ArchiveSourceFailure;

export type PpjA1ArchiveEntryCloseResult =
  | { readonly kind: 'closed' }
  | PpjA1ArchiveSourceFailure;

/**
 * A manifest/checksum boundary binds all three declarations to one selected
 * central-directory entry before this handoff begins. This is intentionally a
 * typed handoff value, not a manifest decoder or checksum implementation.
 */
export type PpjA1CanonicalProjectSelection = {
  readonly entry: PpjA1ArchiveEntry;
  readonly expectedByteLength: number;
  readonly expectedChecksum: string;
};

export type IngestPpjA1CanonicalProjectMemberInput = {
  readonly checksum: PpjA1IncrementalChecksumPort;
  readonly entries: readonly PpjA1ArchiveEntry[];
  readonly selection: PpjA1CanonicalProjectSelection;
  readonly signal?: AbortSignal;
  readonly stageStore: PpjA1StagedMemberStore;
};

type PpjA1StagedMemberRejectReason = Extract<
  IngestPpjA1StagedProjectMemberResult,
  { readonly kind: 'rejected' }
>['reasonCode'];

export type IngestPpjA1CanonicalProjectMemberResult =
  | { readonly kind: 'accepted'; readonly root: LosslessJsonValue }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | 'BACKUP_MANIFEST_INVALID'
        | 'BACKUP_PATH_UNSAFE'
        | PpjA1ArchiveSourceFailureReason
        | PpjA1StagedMemberRejectReason;
    };

/**
 * Applies the source-owned raw archive filename grammar before opening the
 * canonical Project member. A future manifest reader supplies the checksum;
 * the staged ingress verifies it against both source and staged bytes before
 * raw JSON parsing, including the exact selected member length.
 */
export async function ingestPpjA1CanonicalProjectMember(
  input: IngestPpjA1CanonicalProjectMemberInput
): Promise<IngestPpjA1CanonicalProjectMemberResult> {
  let canonicalProjectEntry: PpjA1ArchiveEntry | undefined;
  let hasChecksums = false;
  let hasManifest = false;
  const seenNames = new Set<string>();

  for (const entry of input.entries) {
    const rawName = readSafeArchiveName(entry.rawName);
    if (rawName === undefined || !isAllowedArchiveName(rawName) || seenNames.has(rawName)) {
      return rejected('BACKUP_PATH_UNSAFE');
    }
    seenNames.add(rawName);
    hasManifest ||= rawName === 'manifest.json';
    hasChecksums ||= rawName === 'checksums.json';
    if (rawName === CANONICAL_PROJECT_PATH) {
      canonicalProjectEntry = entry;
    }
  }

  if (!hasManifest || !hasChecksums || canonicalProjectEntry === undefined) {
    // The manifest boundary is the owner of canonicalProjectPath. Without the
    // exact selected member, there can be no valid manifest selection to hand
    // into PPJ-A1 staging.
    return rejected('BACKUP_MANIFEST_INVALID');
  }

  if (input.selection.entry !== canonicalProjectEntry
    || input.selection.expectedByteLength !== canonicalProjectEntry.declaredByteLength) {
    return rejected('BACKUP_MANIFEST_INVALID');
  }

  if (input.selection.expectedByteLength > MAXIMUM_PPJ_A1_JSON_BYTES) {
    return rejected('BACKUP_PROJECT_LIMIT');
  }

  if (input.signal?.aborted) {
    return rejected('BACKUP_CANCELLED');
  }

  const opened = await openSelectedEntry(canonicalProjectEntry, input.signal);
  if (opened.kind === 'rejected') {
    return rejected(opened.reasonCode);
  }

  const sourceLease = opened.lease;
  let result: IngestPpjA1CanonicalProjectMemberResult;
  let closeResult: PpjA1ArchiveEntryCloseResult;
  try {
    if (input.signal?.aborted) {
      result = rejected('BACKUP_CANCELLED');
    } else {
      try {
        result = await ingestPpjA1StagedProjectMember({
          checksum: input.checksum,
          expectedChecksum: input.selection.expectedChecksum,
          precheckedByteLength: input.selection.expectedByteLength,
          expectedByteLength: input.selection.expectedByteLength,
          signal: input.signal,
          source: readSelectedEntry(sourceLease, input.signal),
          stageStore: input.stageStore
        });
      } catch (error) {
        if (!(error instanceof ArchiveReadFailure)) {
          throw error;
        }
        result = rejected(error.reasonCode);
      }
    }
  } finally {
    closeResult = await closeSelectedEntry(sourceLease, input.signal);
  }

  if (result.kind === 'accepted') {
    if (input.signal?.aborted) {
      return rejected('BACKUP_CANCELLED');
    }
    if (closeResult.kind === 'rejected') {
      return rejected(closeResult.reasonCode);
    }
  }
  return result;
}

class ArchiveReadFailure extends Error {
  public constructor(public readonly reasonCode: PpjA1ArchiveSourceFailureReason) {
    super(reasonCode);
  }
}

async function openSelectedEntry(
  entry: PpjA1ArchiveEntry,
  signal: AbortSignal | undefined
): Promise<PpjA1ArchiveEntryOpenResult> {
  try {
    const result = await entry.open(signal);
    return isOpenResult(result) || isArchiveSourceFailure(result)
      ? result
      : sourceFailure('BACKUP_CONTAINER_UNSUPPORTED');
  } catch {
    return sourceFailure(signal?.aborted ? 'BACKUP_CANCELLED' : 'BACKUP_CONTAINER_UNSUPPORTED');
  }
}

async function* readSelectedEntry(
  sourceLease: PpjA1ArchiveEntryLease,
  signal: AbortSignal | undefined
): AsyncGenerator<Uint8Array> {
  try {
    for await (const readResult of sourceLease.chunks(signal)) {
      if (isArchiveSourceFailure(readResult)) {
        throw new ArchiveReadFailure(readResult.reasonCode);
      }
      if (!isReadResult(readResult)) {
        throw new ArchiveReadFailure('BACKUP_CONTAINER_UNSUPPORTED');
      }
      yield readResult.bytes;
    }
  } catch (error) {
    if (error instanceof ArchiveReadFailure) {
      throw error;
    }
    throw new ArchiveReadFailure(signal?.aborted ? 'BACKUP_CANCELLED' : 'BACKUP_CONTAINER_UNSUPPORTED');
  }
}

async function closeSelectedEntry(
  sourceLease: PpjA1ArchiveEntryLease,
  signal: AbortSignal | undefined
): Promise<PpjA1ArchiveEntryCloseResult> {
  try {
    const result = await sourceLease.close(signal);
    return isClosedResult(result) || isArchiveSourceFailure(result)
      ? result
      : sourceFailure('BACKUP_CONTAINER_UNSUPPORTED');
  } catch {
    return sourceFailure(signal?.aborted ? 'BACKUP_CANCELLED' : 'BACKUP_CONTAINER_UNSUPPORTED');
  }
}

function sourceFailure(reasonCode: PpjA1ArchiveSourceFailureReason): PpjA1ArchiveSourceFailure {
  return { kind: 'rejected', reasonCode };
}

function isOpenResult(value: unknown): value is Extract<PpjA1ArchiveEntryOpenResult, { readonly kind: 'opened' }> {
  return isRecord(value) && value.kind === 'opened' && isArchiveEntryLease(value.lease);
}

function isArchiveEntryLease(value: unknown): value is PpjA1ArchiveEntryLease {
  return isRecord(value) && typeof value.chunks === 'function' && typeof value.close === 'function';
}

function isReadResult(value: unknown): value is Extract<PpjA1ArchiveEntryReadResult, { readonly kind: 'chunk' }> {
  return isRecord(value) && value.kind === 'chunk' && value.bytes instanceof Uint8Array;
}

function isClosedResult(value: unknown): value is Extract<PpjA1ArchiveEntryCloseResult, { readonly kind: 'closed' }> {
  return isRecord(value) && value.kind === 'closed';
}

function isArchiveSourceFailure(value: unknown): value is PpjA1ArchiveSourceFailure {
  return isRecord(value) && value.kind === 'rejected' && isArchiveSourceFailureReason(value.reasonCode);
}

function isArchiveSourceFailureReason(value: unknown): value is PpjA1ArchiveSourceFailureReason {
  return value === 'BACKUP_CANCELLED'
    || value === 'BACKUP_COMPRESSION_RATIO'
    || value === 'BACKUP_CONTAINER_BYTES_LIMIT'
    || value === 'BACKUP_CONTAINER_UNSUPPORTED'
    || value === 'BACKUP_ENTRY_LIMIT'
    || value === 'BACKUP_UNPACKED_BYTES_LIMIT';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSafeArchiveName(bytes: Uint8Array): string | undefined {
  let name = '';
  for (const byte of bytes) {
    if (byte < 0x20 || byte > 0x7e) {
      return undefined;
    }
    name += String.fromCharCode(byte);
  }
  return name;
}

function isAllowedArchiveName(name: string): boolean {
  return name === 'manifest.json'
    || name === 'checksums.json'
    || name === CANONICAL_PROJECT_PATH
    || isContentAddressedEntry(name, 'catalog/', '.asset')
    || isContentAddressedEntry(name, 'catalog/', '.texture')
    || isContentAddressedEntry(name, 'custom/', '.glb');
}

function isContentAddressedEntry(name: string, prefix: string, suffix: string): boolean {
  if (!name.startsWith(prefix) || !name.endsWith(suffix) || name.length !== prefix.length + 64 + suffix.length) {
    return false;
  }
  for (const character of name.slice(prefix.length, prefix.length + 64)) {
    const code = character.charCodeAt(0);
    if (!((code >= 0x30 && code <= 0x39) || (code >= 0x61 && code <= 0x66))) {
      return false;
    }
  }
  return true;
}

function rejected(
  reasonCode: Extract<IngestPpjA1CanonicalProjectMemberResult, { readonly kind: 'rejected' }>['reasonCode']
): Extract<IngestPpjA1CanonicalProjectMemberResult, { readonly kind: 'rejected' }> {
  return { kind: 'rejected', reasonCode };
}
