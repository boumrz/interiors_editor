import { describe, expect, it } from '@rstest/core';

import {
  readPpjA1ZipCentralDirectory,
  type ReadPpjA1ZipCentralDirectoryResult
} from './ppj-a1-zip-central-directory';
import type { PpjA1ArchiveEntryReadResult } from './ppj-a1-canonical-project-member-ingress';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('PPJ-A1 ZIP central-directory reader', () => {
  it('indexes stored archive entries by their raw central-directory bytes and streams their exact contents', async () => {
    const archive = storedZip([
      { name: 'manifest.json', content: '{}' },
      { name: 'checksums.json', content: '{}' },
      { name: 'project/project.json', content: '0' }
    ]);

    const indexed = readPpjA1ZipCentralDirectory(archive);
    const project = accepted(indexed).entries.find((entry) => decoder.decode(entry.rawName) === 'project/project.json');
    if (project === undefined) {
      throw new Error('The canonical Project member should be indexed');
    }

    expect(project.declaredByteLength).toBe(1);

    const opened = await project.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }

    const chunks: Uint8Array[] = [];
    for await (const part of opened.lease.chunks(undefined)) {
      expect(part.kind).toBe('chunk');
      if (part.kind === 'chunk') {
        chunks.push(part.bytes);
      }
    }
    await expect(opened.lease.close(undefined)).resolves.toEqual({ kind: 'closed' });
    expect(decoder.decode(join(chunks))).toBe('0');
  });

  it('preserves non-ASCII raw filename bytes for the path-grammar boundary instead of decoding or normalizing them', () => {
    const archive = storedZip([
      { name: Uint8Array.from([0x70, 0x72, 0x6f, 0x6a, 0x65, 0x63, 0x74, 0x2f, 0xff]), content: '0' }
    ]);

    const indexed = accepted(readPpjA1ZipCentralDirectory(archive));

    expect(indexed.entries[0]?.rawName).toEqual(Uint8Array.from([
      0x70, 0x72, 0x6f, 0x6a, 0x65, 0x63, 0x74, 0x2f, 0xff
    ]));
  });

  it('streams an allowed raw-deflate entry through the same typed lease boundary', async () => {
    const projectBytes = encoder.encode('{"project":"deflated"}');
    const archive = storedZip([{
      name: 'project/project.json',
      content: decoder.decode(projectBytes),
      compressedBytes: await rawDeflate(projectBytes),
      method: 8
    }]);
    const project = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (project === undefined) {
      throw new Error('The deflated Project member should be indexed');
    }

    const opened = await project.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }
    const chunks: Uint8Array[] = [];
    for await (const part of opened.lease.chunks(undefined)) {
      expect(part.kind).toBe('chunk');
      if (part.kind === 'chunk') {
        chunks.push(part.bytes);
      }
    }

    expect(decoder.decode(join(chunks))).toBe('{"project":"deflated"}');
  });

  it('rejects an archive without one bounded end-of-central-directory record', () => {
    expect(readPpjA1ZipCentralDirectory(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it.each([
    ['EOCD disk number', (archive: Uint8Array) => writeU16(archive, endOfCentralDirectoryOffset(archive) + 4, 1)],
    ['EOCD central-directory disk', (archive: Uint8Array) => writeU16(archive, endOfCentralDirectoryOffset(archive) + 6, 1)],
    ['EOCD entries-on-this-disk count', (archive: Uint8Array) => writeU16(archive, endOfCentralDirectoryOffset(archive) + 8, 2)],
    ['EOCD entry count', (archive: Uint8Array) => writeU16(archive, endOfCentralDirectoryOffset(archive) + 10, 2)],
    ['EOCD central-directory size', (archive: Uint8Array) => writeU32(archive, endOfCentralDirectoryOffset(archive) + 12, 1)],
    ['EOCD central-directory offset', (archive: Uint8Array) => writeU32(archive, endOfCentralDirectoryOffset(archive) + 16, 1)],
    ['central directory signature', (archive: Uint8Array) => writeU32(archive, centralDirectoryOffset(archive), 0)],
    ['central version-needed', (archive: Uint8Array) => writeU16(archive, centralDirectoryOffset(archive) + 6, 21)],
    ['central disk number', (archive: Uint8Array) => writeU16(archive, centralDirectoryOffset(archive) + 34, 1)],
    ['central local-header offset', (archive: Uint8Array) => writeU32(archive, centralDirectoryOffset(archive) + 42, 0xffffffff)],
    ['central name length', (archive: Uint8Array) => writeU16(archive, centralDirectoryOffset(archive) + 28, 0)],
    ['central extra length', (archive: Uint8Array) => writeU16(archive, centralDirectoryOffset(archive) + 30, 1)],
    ['central comment length', (archive: Uint8Array) => writeU16(archive, centralDirectoryOffset(archive) + 32, 1)],
    ['local signature', (archive: Uint8Array) => writeU32(archive, 0, 0)],
    ['local version-needed', (archive: Uint8Array) => writeU16(archive, 4, 10)],
    ['local flags', (archive: Uint8Array) => writeU16(archive, 6, 0x0800)],
    ['local compression method', (archive: Uint8Array) => writeU16(archive, 8, 8)],
    ['local compressed size', (archive: Uint8Array) => writeU32(archive, 18, 0)],
    ['local uncompressed size', (archive: Uint8Array) => writeU32(archive, 22, 0)],
    ['local name length', (archive: Uint8Array) => writeU16(archive, 26, 0)],
    ['local extra length', (archive: Uint8Array) => writeU16(archive, 28, 1)]
  ])('rejects a malformed %s field before exposing a member', (_label, mutate) => {
    const archive = storedZip([{ name: 'project/project.json', content: '0' }]);
    mutate(archive);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('rejects an unterminated central extra-field record rather than treating it as ignorable bytes', () => {
    const archive = storedZip([{
      name: 'project/project.json',
      content: '0',
      centralExtra: Uint8Array.from([0x02, 0x00, 0x01, 0x00])
    }]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('accepts a complete non-ZIP64 central extra-field record', () => {
    const archive = storedZip([{
      name: 'project/project.json',
      content: '0',
      centralExtra: Uint8Array.from([0x02, 0x00, 0x01, 0x00, 0xab])
    }]);

    expect(readPpjA1ZipCentralDirectory(archive).kind).toBe('accepted');
  });

  it('rejects a ZIP64 local extra field even when the central directory uses legacy-width fields', () => {
    const archive = storedZip([{
      name: 'project/project.json',
      content: '0',
      localExtra: Uint8Array.from([0x01, 0x00, 0x00, 0x00])
    }]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it.each([
    ['a Unix directory', 0x40000000, (3 << 8) | 20],
    ['a DOS directory', 0x00000010, 20]
  ])('rejects %s before exposing its bytes as a regular archive member', (_label, externalAttributes, versionMadeBy) => {
    const archive = storedZip([{
      name: 'project/project.json',
      content: '0',
      externalAttributes,
      versionMadeBy
    }]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('retains a private snapshot rather than exposing later caller mutations through a lease', async () => {
    const archive = storedZip([{ name: 'project/project.json', content: '0' }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The canonical Project member should be indexed');
    }
    archive.fill(0);
    const opened = await entry.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }

    const chunks: Uint8Array[] = [];
    for await (const result of opened.lease.chunks(undefined)) {
      if (result.kind === 'chunk') {
        chunks.push(result.bytes);
      }
    }
    expect(decoder.decode(join(chunks))).toBe('0');
  });

  it('returns the stable cancellation outcome before opening an indexed entry', async () => {
    const controller = new AbortController();
    controller.abort();
    const archive = storedZip([{ name: 'project/project.json', content: '0' }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The canonical Project member should be indexed');
    }

    await expect(entry.open(controller.signal)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CANCELLED'
    });
  });

  it('quiesces an already-started stored entry when its lease closes', async () => {
    const archive = storedZip([{ name: 'project/project.json', content: 'x'.repeat(70 * 1024) }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The stored Project member should be indexed');
    }
    const opened = await entry.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }
    const iterator = opened.lease.chunks(undefined)[Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.done).toBe(false);
    expect(first.value).toMatchObject({ kind: 'chunk' });
    await expect(opened.lease.close(undefined)).resolves.toEqual({ kind: 'closed' });
    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
  });

  it('refuses a second read attempt and a read attempt after closing an unopened lease', async () => {
    const archive = storedZip([{ name: 'project/project.json', content: '0' }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The canonical Project member should be indexed');
    }
    const opened = await entry.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }
    const firstRead = opened.lease.chunks(undefined)[Symbol.asyncIterator]();
    await expect(firstRead.next()).resolves.toMatchObject({ done: false, value: { kind: 'chunk' } });
    const secondRead = opened.lease.chunks(undefined)[Symbol.asyncIterator]();
    await expect(secondRead.next()).resolves.toEqual({
      done: false,
      value: { kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' }
    });

    const anotherOpened = await entry.open(undefined);
    expect(anotherOpened.kind).toBe('opened');
    if (anotherOpened.kind !== 'opened') {
      return;
    }
    await expect(anotherOpened.lease.close(undefined)).resolves.toEqual({ kind: 'closed' });
    const closedRead = anotherOpened.lease.chunks(undefined)[Symbol.asyncIterator]();
    await expect(closedRead.next()).resolves.toEqual({
      done: false,
      value: { kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' }
    });
  });

  it('splits a deflated member at the bounded 64 KiB output boundary without losing a trailing byte', async () => {
    const content = pseudoRandomAscii(64 * 1024 + 1);
    const archive = storedZip([{
      name: 'project/project.json',
      content,
      compressedBytes: await rawDeflate(encoder.encode(content)),
      method: 8
    }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The deflated Project member should be indexed');
    }
    const opened = await entry.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }
    const chunks: Uint8Array[] = [];
    for await (const result of opened.lease.chunks(undefined)) {
      expect(result.kind).toBe('chunk');
      if (result.kind === 'chunk') {
        chunks.push(result.bytes);
      }
    }

    expect(chunks.map((chunk) => chunk.byteLength)).toEqual([64 * 1024, 1]);
    expect(decoder.decode(join(chunks))).toBe(content);
  });

  it('quiesces an already-started deflated entry before it decodes another block after its lease closes', async () => {
    const content = pseudoRandomAscii(70 * 1024);
    const archive = storedZip([{
      name: 'project/project.json',
      content,
      compressedBytes: await rawDeflate(encoder.encode(content)),
      method: 8
    }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The deflated Project member should be indexed');
    }
    const opened = await entry.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }
    const iterator = opened.lease.chunks(undefined)[Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.done).toBe(false);
    expect(first.value).toMatchObject({ kind: 'chunk' });
    await expect(opened.lease.close(undefined)).resolves.toEqual({ kind: 'closed' });
    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
  });

  it('observes cancellation at a raw-deflate block checkpoint before decoding another block', async () => {
    const controller = new AbortController();
    const archive = storedZip([{
      name: 'project/project.json',
      content: '',
      compressedBytes: emptyStoredDeflateBlocks(2),
      method: 8
    }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The deflated Project member should be indexed');
    }
    const opened = await entry.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }
    const iterator = opened.lease.chunks(controller.signal)[Symbol.asyncIterator]();

    const pending = iterator.next();
    controller.abort();

    await expect(pending).resolves.toEqual({
      done: false,
      value: { kind: 'rejected', reasonCode: 'BACKUP_CANCELLED' }
    });
    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
  });

  it('rejects an encrypted entry before any compressed data is streamed', () => {
    const archive = storedZip([{ name: 'project/project.json', content: '0', flags: 0x0001 }]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('rejects a ZIP64 central-directory record instead of interpreting its legacy-width fields', () => {
    const archive = storedZip([{
      name: 'project/project.json',
      content: '0',
      centralExtra: Uint8Array.from([0x01, 0x00, 0x00, 0x00]),
      versionNeeded: 45
    }]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('rejects an unsupported compression method before any compressed data is streamed', () => {
    const archive = storedZip([{ name: 'project/project.json', content: '0', method: 12 }]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('rejects a central directory whose local header resolves a different raw filename', () => {
    const archive = storedZip([{ name: 'project/project.json', localName: 'project/other.json', content: '0' }]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('rejects repeated central-directory references to one local payload instead of retaining it once per entry', () => {
    const archive = storedZip([
      { name: 'project/project.json', content: '0' },
      { name: 'project/project.json', content: '0', centralLocalHeaderOffset: 0 }
    ]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('rejects a Unix symlink entry before exposing its bytes as a regular archive member', () => {
    const archive = storedZip([{
      name: 'project/project.json',
      content: '0',
      externalAttributes: 0xa0000000,
      versionMadeBy: (3 << 8) | 20
    }]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('rejects an entry whose declared uncompressed bytes cross the per-entry unpacked limit', () => {
    const archive = storedZip([
      {
        name: 'project/project.json',
        content: '0',
        declaredUncompressedSize: 100 * 1024 * 1024 + 1,
        method: 8
      }
    ]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_UNPACKED_BYTES_LIMIT'
    });
  });

  it('accepts an entry exactly at the per-entry unpacked-byte limit', () => {
    const compressedByteLength = 2 * 1024 * 1024;
    const archive = storedZip([{
      name: 'project/project.json',
      content: 'x'.repeat(compressedByteLength),
      declaredCompressedSize: compressedByteLength,
      declaredUncompressedSize: 100 * 1024 * 1024,
      method: 8
    }]);

    expect(readPpjA1ZipCentralDirectory(archive).kind).toBe('accepted');
  });

  it('applies the aggregate unpacked-byte limit inclusively across independent entry declarations', () => {
    const compressedByteLength = 2 * 1024 * 1024;
    const atLimit = Array.from({ length: 3 }, (_, index) => ({
      name: `catalog/${index}.asset`,
      content: 'x'.repeat(compressedByteLength),
      declaredCompressedSize: compressedByteLength,
      declaredUncompressedSize: 100 * 1024 * 1024,
      method: 8
    }));

    expect(readPpjA1ZipCentralDirectory(storedZip(atLimit)).kind).toBe('accepted');
    expect(readPpjA1ZipCentralDirectory(storedZip([
      ...atLimit,
      { name: 'project/project.json', content: '0' }
    ]))).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_UNPACKED_BYTES_LIMIT'
    });
  });

  it('accepts an entry exactly at the 50:1 compression-ratio boundary', () => {
    const archive = storedZip([
      {
        name: 'project/project.json',
        content: '0',
        declaredCompressedSize: 1,
        declaredUncompressedSize: 50,
        method: 8
      }
    ]);

    expect(readPpjA1ZipCentralDirectory(archive).kind).toBe('accepted');
  });

  it('rejects an entry whose declared compression ratio exceeds 50:1', () => {
    const archive = storedZip([
      {
        name: 'project/project.json',
        content: '0',
        declaredCompressedSize: 1,
        declaredUncompressedSize: 51,
        method: 8
      }
    ]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_COMPRESSION_RATIO'
    });
  });

  it('rejects more than 1,000 declared central-directory entries before reading entry contents', () => {
    const archive = storedZip(Array.from({ length: 1_001 }, (_, index) => ({
      name: `catalog/${index.toString(16).padStart(64, '0')}.asset`,
      content: ''
    })));

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_ENTRY_LIMIT'
    });
  });

  it('accepts exactly 1,000 declared central-directory entries', () => {
    const archive = storedZip(Array.from({ length: 1_000 }, (_, index) => ({
      name: `catalog/${index.toString(16).padStart(64, '0')}.asset`,
      content: ''
    })));

    expect(readPpjA1ZipCentralDirectory(archive).kind).toBe('accepted');
  });

  it('rejects a stored entry whose central-directory sizes disagree', () => {
    const archive = storedZip([
      {
        name: 'project/project.json',
        content: '0',
        declaredCompressedSize: 1,
        declaredUncompressedSize: 2
      }
    ]);

    expect(readPpjA1ZipCentralDirectory(archive)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED'
    });
  });

  it('converts malformed raw-deflate bytes into a typed container failure without leaking a raw exception', async () => {
    const archive = storedZip([{
      name: 'project/project.json',
      content: '0',
      compressedBytes: Uint8Array.from([0xff]),
      method: 8
    }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The malformed deflate entry should still have an indexed header');
    }
    const opened = await entry.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }

    const outcomes: PpjA1ArchiveEntryReadResult[] = [];
    for await (const outcome of opened.lease.chunks(undefined)) {
      outcomes.push(outcome);
    }

    expect(outcomes).toEqual([{ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' }]);
  });

  it('rejects a deflated stream whose actual decoded bytes exceed its central-directory declaration', async () => {
    const content = encoder.encode('decoded');
    const archive = storedZip([{
      name: 'project/project.json',
      content: decoder.decode(content),
      compressedBytes: await rawDeflate(content),
      declaredUncompressedSize: 1,
      method: 8
    }]);
    const entry = accepted(readPpjA1ZipCentralDirectory(archive)).entries[0];
    if (entry === undefined) {
      throw new Error('The deflated entry should be indexed');
    }
    const opened = await entry.open(undefined);
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') {
      return;
    }

    const outcomes: PpjA1ArchiveEntryReadResult[] = [];
    for await (const outcome of opened.lease.chunks(undefined)) {
      outcomes.push(outcome);
    }

    expect(outcomes).toEqual([{ kind: 'rejected', reasonCode: 'BACKUP_CONTAINER_UNSUPPORTED' }]);
  });
});

type StoredZipEntry = {
  readonly centralLocalHeaderOffset?: number;
  readonly centralExtra?: Uint8Array;
  readonly compressedBytes?: Uint8Array;
  readonly content: string;
  readonly declaredCompressedSize?: number;
  readonly declaredUncompressedSize?: number;
  readonly externalAttributes?: number;
  readonly flags?: number;
  readonly localName?: string;
  readonly localExtra?: Uint8Array;
  readonly method?: number;
  readonly name: string | Uint8Array;
  readonly versionMadeBy?: number;
  readonly versionNeeded?: number;
};

function accepted(result: ReadPpjA1ZipCentralDirectoryResult): Extract<ReadPpjA1ZipCentralDirectoryResult, { readonly kind: 'accepted' }> {
  if (result.kind !== 'accepted') {
    throw new Error(`Expected indexed ZIP archive, received ${result.reasonCode}`);
  }
  return result;
}

function storedZip(entries: readonly StoredZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = typeof entry.name === 'string' ? encoder.encode(entry.name) : entry.name;
    const localName = entry.localName === undefined ? name : encoder.encode(entry.localName);
    const localExtra = entry.localExtra ?? new Uint8Array();
    const content = encoder.encode(entry.content);
    const compressedBytes = entry.compressedBytes ?? content;
    const centralExtra = entry.centralExtra ?? new Uint8Array();
    const flags = entry.flags ?? 0;
    const method = entry.method ?? 0;
    const declaredCompressedSize = entry.declaredCompressedSize ?? compressedBytes.byteLength;
    const declaredUncompressedSize = entry.declaredUncompressedSize ?? content.byteLength;
    const localHeader = concat([
      u32(0x04034b50),
      u16(entry.versionNeeded ?? 20),
      u16(flags),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(declaredCompressedSize),
      u32(declaredUncompressedSize),
      u16(localName.byteLength),
      u16(localExtra.byteLength),
      localName,
      localExtra,
      compressedBytes
    ]);
    localParts.push(localHeader);
    centralParts.push(concat([
      u32(0x02014b50),
      u16(entry.versionMadeBy ?? 20),
      u16(entry.versionNeeded ?? 20),
      u16(flags),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(declaredCompressedSize),
      u32(declaredUncompressedSize),
      u16(name.byteLength),
      u16(centralExtra.byteLength),
      u16(0),
      u16(0),
      u16(0),
      u32(entry.externalAttributes ?? 0),
      u32(entry.centralLocalHeaderOffset ?? localOffset),
      name,
      centralExtra
    ]));
    localOffset += localHeader.byteLength;
  }

  const centralDirectory = concat(centralParts);
  return concat([
    ...localParts,
    centralDirectory,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.byteLength),
    u32(localOffset),
    u16(0)
  ]);
}

function join(chunks: readonly Uint8Array[]): Uint8Array {
  return concat(chunks);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  ]);
}

function centralDirectoryOffset(archive: Uint8Array): number {
  return readU32(archive, endOfCentralDirectoryOffset(archive) + 16);
}

function endOfCentralDirectoryOffset(archive: Uint8Array): number {
  return archive.byteLength - 22;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

async function rawDeflate(bytes: Uint8Array): Promise<Uint8Array> {
  const input = new ReadableStream<BufferSource>({
    start(controller): void {
      controller.enqueue(Uint8Array.from(bytes));
      controller.close();
    }
  });
  const output = input.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function emptyStoredDeflateBlocks(blockCount: number): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (let index = 0; index < blockCount; index += 1) {
    blocks.push(Uint8Array.from([
      index === blockCount - 1 ? 0x01 : 0x00,
      0x00,
      0x00,
      0xff,
      0xff
    ]));
  }
  return concat(blocks);
}

function pseudoRandomAscii(length: number): string {
  let state = 0x6d2b79f5;
  let value = '';
  for (let index = 0; index < length; index += 1) {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    value += String.fromCharCode(32 + ((state ^ (state >>> 14)) % 95 + 95) % 95);
  }
  return value;
}
