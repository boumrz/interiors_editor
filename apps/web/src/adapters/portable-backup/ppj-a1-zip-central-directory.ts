import type {
	PpjA1ArchiveEntry,
	PpjA1ArchiveEntryCloseResult,
	PpjA1ArchiveEntryLease,
	PpjA1ArchiveEntryOpenResult,
	PpjA1ArchiveEntryReadResult,
	PpjA1ArchiveSourceFailure,
	PpjA1ArchiveSourceFailureReason,
} from "./ppj-a1-canonical-project-member-ingress";

const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAXIMUM_COMMENT_BYTES = 0xffff;
const MAXIMUM_CONTAINER_BYTES = 200 * 1024 * 1024;
const MAXIMUM_ENTRIES = 1_000;
const MAXIMUM_SINGLE_UNPACKED_BYTES = 100 * 1024 * 1024;
const MAXIMUM_TOTAL_UNPACKED_BYTES = 300 * 1024 * 1024;
const MAXIMUM_COMPRESSION_RATIO = 50;
const STREAM_CHUNK_BYTES = 64 * 1024;

type CentralDirectoryRecord = {
	readonly compressedSize: number;
	readonly dataOffset: number;
	readonly flags: number;
	readonly method: number;
	readonly rawName: Uint8Array;
	readonly uncompressedSize: number;
};

type EndOfCentralDirectory = {
	readonly centralDirectoryOffset: number;
	readonly centralDirectorySize: number;
	readonly entries: number;
};

export type ReadPpjA1ZipCentralDirectoryResult =
	| {
			readonly kind: "accepted";
			readonly entries: readonly PpjA1ArchiveEntry[];
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode: PpjA1ArchiveSourceFailureReason;
	  };

/**
 * Reads only the bounded ZIP container index and exposes checked entries through
 * the typed archive-source port. The caller still owns the raw filename
 * allowlist, manifest/checksum schema and PPJ-A1 staging boundary.
 *
 * ZIP64, multi-volume, encrypted and non-store/non-deflate archives are
 * intentionally outside the alpha container grammar. This module creates no
 * Project, Revision, staging record or manifest selection.
 */
export function readPpjA1ZipCentralDirectory(
	bytes: Uint8Array,
): ReadPpjA1ZipCentralDirectoryResult {
	if (bytes.byteLength > MAXIMUM_CONTAINER_BYTES) {
		return rejected("BACKUP_CONTAINER_BYTES_LIMIT");
	}

	const snapshot = bytes.slice();
	const end = readEndOfCentralDirectory(snapshot);
	if (end === undefined) {
		return rejected("BACKUP_CONTAINER_UNSUPPORTED");
	}
	if (end.entries > MAXIMUM_ENTRIES) {
		return rejected("BACKUP_ENTRY_LIMIT");
	}

	const records = readCentralDirectoryRecords(snapshot, end);
	if (records.kind === "rejected") {
		return records;
	}

	return {
		kind: "accepted",
		entries: records.records.map(
			(record) => new IndexedZipEntry(snapshot, record),
		),
	};
}

function readEndOfCentralDirectory(
	bytes: Uint8Array,
): EndOfCentralDirectory | undefined {
	const minimumOffset = Math.max(
		0,
		bytes.byteLength - MAXIMUM_COMMENT_BYTES - 22,
	);
	for (
		let offset = bytes.byteLength - 22;
		offset >= minimumOffset;
		offset -= 1
	) {
		if (readU32(bytes, offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
			continue;
		}
		const commentLength = readU16(bytes, offset + 20);
		if (
			commentLength === undefined ||
			offset + 22 + commentLength !== bytes.byteLength
		) {
			continue;
		}

		const diskNumber = readU16(bytes, offset + 4);
		const centralDirectoryDisk = readU16(bytes, offset + 6);
		const entriesOnThisDisk = readU16(bytes, offset + 8);
		const entries = readU16(bytes, offset + 10);
		const centralDirectorySize = readU32(bytes, offset + 12);
		const centralDirectoryOffset = readU32(bytes, offset + 16);
		if (
			diskNumber === undefined ||
			centralDirectoryDisk === undefined ||
			entriesOnThisDisk === undefined ||
			entries === undefined ||
			centralDirectorySize === undefined ||
			centralDirectoryOffset === undefined ||
			diskNumber !== 0 ||
			centralDirectoryDisk !== 0 ||
			entriesOnThisDisk !== entries ||
			entries === 0xffff ||
			centralDirectorySize === 0xffffffff ||
			centralDirectoryOffset === 0xffffffff ||
			!hasRange(bytes, centralDirectoryOffset, centralDirectorySize) ||
			centralDirectoryOffset + centralDirectorySize !== offset
		) {
			return undefined;
		}
		return { centralDirectoryOffset, centralDirectorySize, entries };
	}
	return undefined;
}

function readCentralDirectoryRecords(
	bytes: Uint8Array,
	end: EndOfCentralDirectory,
):
	| {
			readonly kind: "accepted";
			readonly records: readonly CentralDirectoryRecord[];
	  }
	| Exclude<ReadPpjA1ZipCentralDirectoryResult, { readonly kind: "accepted" }> {
	const records: CentralDirectoryRecord[] = [];
	let totalUnpackedBytes = 0;
	const occupiedSpans: { readonly start: number; readonly end: number }[] = [];
	let cursor = end.centralDirectoryOffset;
	const centralDirectoryEnd =
		end.centralDirectoryOffset + end.centralDirectorySize;

	for (let index = 0; index < end.entries; index += 1) {
		const header = readCentralDirectoryHeader(
			bytes,
			cursor,
			end.centralDirectoryOffset,
			centralDirectoryEnd,
		);
		if (header.kind === "rejected") {
			return header;
		}
		cursor = header.nextOffset;

		if (
			occupiedSpans.some(
				(span) => header.spanStart < span.end && span.start < header.spanEnd,
			)
		) {
			return rejected("BACKUP_CONTAINER_UNSUPPORTED");
		}
		occupiedSpans.push({ start: header.spanStart, end: header.spanEnd });

		if (
			header.record.method === 0 &&
			header.record.compressedSize !== header.record.uncompressedSize
		) {
			return rejected("BACKUP_CONTAINER_UNSUPPORTED");
		}
		if (
			header.record.uncompressedSize > MAXIMUM_SINGLE_UNPACKED_BYTES ||
			totalUnpackedBytes + header.record.uncompressedSize >
				MAXIMUM_TOTAL_UNPACKED_BYTES
		) {
			return rejected("BACKUP_UNPACKED_BYTES_LIMIT");
		}
		if (
			exceedsCompressionRatio(
				header.record.uncompressedSize,
				header.record.compressedSize,
			)
		) {
			return rejected("BACKUP_COMPRESSION_RATIO");
		}
		totalUnpackedBytes += header.record.uncompressedSize;
		records.push(header.record);
	}

	return cursor === centralDirectoryEnd
		? { kind: "accepted", records }
		: rejected("BACKUP_CONTAINER_UNSUPPORTED");
}

function readCentralDirectoryHeader(
	bytes: Uint8Array,
	offset: number,
	centralDirectoryStart: number,
	centralDirectoryEnd: number,
):
	| {
			readonly kind: "accepted";
			readonly nextOffset: number;
			readonly record: CentralDirectoryRecord;
			readonly spanEnd: number;
			readonly spanStart: number;
	  }
	| Exclude<ReadPpjA1ZipCentralDirectoryResult, { readonly kind: "accepted" }> {
	if (
		!hasRange(bytes, offset, 46) ||
		readU32(bytes, offset) !== CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE
	) {
		return rejected("BACKUP_CONTAINER_UNSUPPORTED");
	}

	const versionMadeBy = readU16(bytes, offset + 4);
	const versionNeeded = readU16(bytes, offset + 6);
	const flags = readU16(bytes, offset + 8);
	const method = readU16(bytes, offset + 10);
	const compressedSize = readU32(bytes, offset + 20);
	const uncompressedSize = readU32(bytes, offset + 24);
	const nameLength = readU16(bytes, offset + 28);
	const extraLength = readU16(bytes, offset + 30);
	const commentLength = readU16(bytes, offset + 32);
	const diskNumber = readU16(bytes, offset + 34);
	const externalAttributes = readU32(bytes, offset + 38);
	const localHeaderOffset = readU32(bytes, offset + 42);
	if (
		versionMadeBy === undefined ||
		versionNeeded === undefined ||
		flags === undefined ||
		method === undefined ||
		compressedSize === undefined ||
		uncompressedSize === undefined ||
		nameLength === undefined ||
		extraLength === undefined ||
		commentLength === undefined ||
		diskNumber === undefined ||
		externalAttributes === undefined ||
		localHeaderOffset === undefined ||
		versionNeeded > 20 ||
		diskNumber !== 0 ||
		localHeaderOffset === 0xffffffff ||
		compressedSize === 0xffffffff ||
		uncompressedSize === 0xffffffff ||
		(flags & ~0x0800) !== 0 ||
		(method !== 0 && method !== 8)
	) {
		return rejected("BACKUP_CONTAINER_UNSUPPORTED");
	}
	const unixFileType = (externalAttributes >>> 16) & 0xf000;
	if (
		(externalAttributes & 0x10) !== 0 ||
		(versionMadeBy >>> 8 === 3 &&
			(unixFileType === 0x4000 || unixFileType === 0xa000))
	) {
		return rejected("BACKUP_CONTAINER_UNSUPPORTED");
	}

	const variableLength = nameLength + extraLength + commentLength;
	const nextOffset = offset + 46 + variableLength;
	if (
		nextOffset > centralDirectoryEnd ||
		readZip64Extra(bytes, offset + 46 + nameLength, extraLength) !== false
	) {
		return rejected("BACKUP_CONTAINER_UNSUPPORTED");
	}

	const rawName = bytes.slice(offset + 46, offset + 46 + nameLength);
	const local = readLocalRecord(
		bytes,
		localHeaderOffset,
		rawName,
		versionNeeded,
		flags,
		method,
		compressedSize,
		uncompressedSize,
		centralDirectoryStart,
	);
	if (local.kind === "rejected") {
		return local;
	}

	return {
		kind: "accepted",
		nextOffset,
		record: {
			compressedSize,
			dataOffset: local.dataOffset,
			flags,
			method,
			rawName,
			uncompressedSize,
		},
		spanEnd: local.spanEnd,
		spanStart: local.spanStart,
	};
}

function readLocalRecord(
	bytes: Uint8Array,
	offset: number,
	expectedRawName: Uint8Array,
	expectedVersionNeeded: number,
	expectedFlags: number,
	expectedMethod: number,
	expectedCompressedSize: number,
	expectedUncompressedSize: number,
	centralDirectoryStart: number,
):
	| {
			readonly kind: "accepted";
			readonly dataOffset: number;
			readonly spanEnd: number;
			readonly spanStart: number;
	  }
	| Exclude<ReadPpjA1ZipCentralDirectoryResult, { readonly kind: "accepted" }> {
	if (
		!hasRange(bytes, offset, 30) ||
		readU32(bytes, offset) !== LOCAL_FILE_HEADER_SIGNATURE
	) {
		return rejected("BACKUP_CONTAINER_UNSUPPORTED");
	}

	const versionNeeded = readU16(bytes, offset + 4);
	const flags = readU16(bytes, offset + 6);
	const method = readU16(bytes, offset + 8);
	const compressedSize = readU32(bytes, offset + 18);
	const uncompressedSize = readU32(bytes, offset + 22);
	const nameLength = readU16(bytes, offset + 26);
	const extraLength = readU16(bytes, offset + 28);
	if (
		versionNeeded === undefined ||
		flags === undefined ||
		method === undefined ||
		compressedSize === undefined ||
		uncompressedSize === undefined ||
		nameLength === undefined ||
		extraLength === undefined ||
		versionNeeded !== expectedVersionNeeded ||
		flags !== expectedFlags ||
		method !== expectedMethod
	) {
		return rejected("BACKUP_CONTAINER_UNSUPPORTED");
	}

	const dataOffset = offset + 30 + nameLength + extraLength;
	const dataEnd = dataOffset + expectedCompressedSize;
	if (
		!hasRange(bytes, offset + 30, nameLength) ||
		readZip64Extra(bytes, offset + 30 + nameLength, extraLength) !== false ||
		!sameBytes(
			bytes.subarray(offset + 30, offset + 30 + nameLength),
			expectedRawName,
		) ||
		!hasRange(bytes, dataOffset, expectedCompressedSize) ||
		dataEnd > centralDirectoryStart ||
		compressedSize !== expectedCompressedSize ||
		uncompressedSize !== expectedUncompressedSize
	) {
		return rejected("BACKUP_CONTAINER_UNSUPPORTED");
	}

	return { kind: "accepted", dataOffset, spanEnd: dataEnd, spanStart: offset };
}

function readZip64Extra(
	bytes: Uint8Array,
	offset: number,
	length: number,
): boolean | undefined {
	if (!hasRange(bytes, offset, length)) {
		return undefined;
	}
	const end = offset + length;
	let cursor = offset;
	while (cursor < end) {
		const identifier = readU16(bytes, cursor);
		const payloadLength = readU16(bytes, cursor + 2);
		if (
			identifier === undefined ||
			payloadLength === undefined ||
			payloadLength > end - cursor - 4
		) {
			return undefined;
		}
		if (identifier === 0x0001) {
			return true;
		}
		cursor += 4 + payloadLength;
	}
	return false;
}

class IndexedZipEntry implements PpjA1ArchiveEntry {
	public readonly declaredByteLength: number;
	public readonly rawName: Uint8Array;

	public constructor(
		private readonly snapshot: Uint8Array,
		private readonly record: CentralDirectoryRecord,
	) {
		this.declaredByteLength = record.uncompressedSize;
		this.rawName = record.rawName.slice();
	}

	public async open(
		signal: AbortSignal | undefined,
	): Promise<PpjA1ArchiveEntryOpenResult> {
		if (signal?.aborted) {
			return sourceFailure("BACKUP_CANCELLED");
		}
		return {
			kind: "opened",
			lease: new IndexedZipEntryLease(this.snapshot, this.record),
		};
	}
}

class IndexedZipEntryLease implements PpjA1ArchiveEntryLease {
	private chunksStarted = false;
	private closed = false;

	public constructor(
		private readonly snapshot: Uint8Array,
		private readonly record: CentralDirectoryRecord,
	) {}

	public async *chunks(
		signal: AbortSignal | undefined,
	): AsyncGenerator<PpjA1ArchiveEntryReadResult> {
		if (this.chunksStarted || this.closed) {
			yield sourceFailure("BACKUP_CONTAINER_UNSUPPORTED");
			return;
		}
		this.chunksStarted = true;

		if (this.record.method === 0) {
			yield* this.streamStoredBytes(signal);
			return;
		}
		yield* this.streamDeflatedBytes(signal);
	}

	public async close(): Promise<PpjA1ArchiveEntryCloseResult> {
		this.closed = true;
		return { kind: "closed" };
	}

	private async *streamStoredBytes(
		signal: AbortSignal | undefined,
	): AsyncGenerator<PpjA1ArchiveEntryReadResult> {
		for (
			let offset = 0;
			offset < this.record.compressedSize;
			offset += STREAM_CHUNK_BYTES
		) {
			if (this.closed) {
				return;
			}
			if (signal?.aborted) {
				yield sourceFailure("BACKUP_CANCELLED");
				return;
			}
			const end = Math.min(
				offset + STREAM_CHUNK_BYTES,
				this.record.compressedSize,
			);
			yield {
				kind: "chunk",
				bytes: this.snapshot.slice(
					this.record.dataOffset + offset,
					this.record.dataOffset + end,
				),
			};
		}
	}

	private async *streamDeflatedBytes(
		signal: AbortSignal | undefined,
	): AsyncGenerator<PpjA1ArchiveEntryReadResult> {
		try {
			const decoder = decodeRawDeflate(this.snapshot, this.record)[
				Symbol.iterator
			]();
			while (true) {
				if (this.closed) {
					return;
				}
				if (signal?.aborted) {
					yield sourceFailure("BACKUP_CANCELLED");
					return;
				}
				const next = decoder.next();
				if (next.done) {
					return;
				}
				const bytes = next.value;
				if (bytes === undefined) {
					await yieldToEventLoop();
					continue;
				}
				yield { kind: "chunk", bytes };
			}
		} catch (error) {
			yield sourceFailure(
				error instanceof DeflateFailure
					? error.reasonCode
					: signal?.aborted
						? "BACKUP_CANCELLED"
						: "BACKUP_CONTAINER_UNSUPPORTED",
			);
		}
	}
}

const CODE_LENGTH_ORDER = [
	16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];
const LENGTH_BASES = [
	3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
	83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA_BITS = [
	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
	5, 5, 0,
];
const DISTANCE_BASES = [
	1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
	1_025, 1_537, 2_049, 3_073, 4_097, 6_145, 8_193, 12_289, 16_385, 24_577,
];
const DISTANCE_EXTRA_BITS = [
	0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
	11, 12, 12, 13, 13,
];

class DeflateFailure extends Error {
	public constructor(
		public readonly reasonCode: PpjA1ArchiveSourceFailureReason,
	) {
		super(reasonCode);
	}
}

type HuffmanNode = {
	readonly symbol?: number;
	readonly zero?: HuffmanNode;
	readonly one?: HuffmanNode;
};
type MutableHuffmanNode = {
	symbol?: number;
	zero?: MutableHuffmanNode;
	one?: MutableHuffmanNode;
};

function* decodeRawDeflate(
	snapshot: Uint8Array,
	record: CentralDirectoryRecord,
): Generator<Uint8Array | undefined> {
	const reader = new DeflateBitReader(
		snapshot,
		record.dataOffset,
		record.dataOffset + record.compressedSize,
	);
	const output = new DeflateOutput(record);
	let isFinalBlock = false;
	while (!isFinalBlock) {
		isFinalBlock = reader.readBits(1) === 1;
		const blockType = reader.readBits(2);
		if (blockType === 0) {
			reader.alignByte();
			const length = reader.readBits(16);
			if (length !== (~reader.readBits(16) & 0xffff)) {
				throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
			}
			for (let index = 0; index < length; index += 1) {
				const ready = output.write(reader.readBits(8));
				if (ready !== undefined) {
					yield ready;
				}
			}
		} else if (blockType === 1 || blockType === 2) {
			const trees =
				blockType === 1 ? fixedHuffmanTrees() : dynamicHuffmanTrees(reader);
			while (true) {
				const symbol = readHuffmanSymbol(reader, trees.literalLength);
				if (symbol < 256) {
					const ready = output.write(symbol);
					if (ready !== undefined) {
						yield ready;
					}
					continue;
				}
				if (symbol === 256) {
					break;
				}
				if (symbol < 257 || symbol > 285 || trees.distance === undefined) {
					throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
				}
				const lengthIndex = symbol - 257;
				const length =
					requiredValue(LENGTH_BASES, lengthIndex) +
					reader.readBits(requiredValue(LENGTH_EXTRA_BITS, lengthIndex));
				const distanceSymbol = readHuffmanSymbol(reader, trees.distance);
				if (distanceSymbol > 29) {
					throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
				}
				const distance =
					requiredValue(DISTANCE_BASES, distanceSymbol) +
					reader.readBits(requiredValue(DISTANCE_EXTRA_BITS, distanceSymbol));
				for (let index = 0; index < length; index += 1) {
					const ready = output.copy(distance);
					if (ready !== undefined) {
						yield ready;
					}
				}
			}
		} else {
			throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
		}
		yield undefined;
	}
	if (!reader.finished()) {
		throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
	}
	const finalChunk = output.finish();
	if (finalChunk !== undefined) {
		yield finalChunk;
	}
}

function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

class DeflateBitReader {
	private bitBuffer = 0;
	private bitCount = 0;
	private offset: number;

	public constructor(
		private readonly bytes: Uint8Array,
		start: number,
		private readonly end: number,
	) {
		this.offset = start;
	}

	public alignByte(): void {
		this.bitBuffer = 0;
		this.bitCount = 0;
	}

	public finished(): boolean {
		return this.offset === this.end;
	}

	public readBits(count: number): number {
		while (this.bitCount < count) {
			if (this.offset >= this.end) {
				throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
			}
			this.bitBuffer |=
				requiredValue(this.bytes, this.offset++) << this.bitCount;
			this.bitCount += 8;
		}
		const mask = (1 << count) - 1;
		const value = this.bitBuffer & mask;
		this.bitBuffer >>>= count;
		this.bitCount -= count;
		return value;
	}
}

class DeflateOutput {
	private buffer = new Uint8Array(STREAM_CHUNK_BYTES);
	private bufferLength = 0;
	private readonly window = new Uint8Array(32 * 1024);
	private windowLength = 0;
	private windowOffset = 0;
	private written = 0;

	public constructor(private readonly record: CentralDirectoryRecord) {}

	public copy(distance: number): Uint8Array | undefined {
		if (distance > this.windowLength) {
			throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
		}
		return this.write(
			requiredValue(
				this.window,
				(this.windowOffset - distance + this.window.byteLength) %
					this.window.byteLength,
			),
		);
	}

	public finish(): Uint8Array | undefined {
		if (this.written !== this.record.uncompressedSize) {
			throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
		}
		return this.bufferLength === 0
			? undefined
			: this.buffer.slice(0, this.bufferLength);
	}

	public write(byte: number): Uint8Array | undefined {
		const nextLength = this.written + 1;
		if (nextLength > MAXIMUM_SINGLE_UNPACKED_BYTES) {
			throw new DeflateFailure("BACKUP_UNPACKED_BYTES_LIMIT");
		}
		if (exceedsCompressionRatio(nextLength, this.record.compressedSize)) {
			throw new DeflateFailure("BACKUP_COMPRESSION_RATIO");
		}
		if (nextLength > this.record.uncompressedSize) {
			throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
		}
		this.buffer[this.bufferLength++] = byte;
		this.window[this.windowOffset] = byte;
		this.windowOffset = (this.windowOffset + 1) % this.window.byteLength;
		this.windowLength = Math.min(this.windowLength + 1, this.window.byteLength);
		this.written = nextLength;
		if (this.bufferLength !== this.buffer.byteLength) {
			return undefined;
		}
		const ready = this.buffer;
		this.buffer = new Uint8Array(STREAM_CHUNK_BYTES);
		this.bufferLength = 0;
		return ready;
	}
}

function fixedHuffmanTrees(): {
	readonly distance: HuffmanNode;
	readonly literalLength: HuffmanNode;
} {
	const literalLengths = new Array<number>(288).fill(8);
	literalLengths.fill(9, 144, 256);
	literalLengths.fill(7, 256, 280);
	const distance = createHuffmanTree(new Array<number>(32).fill(5));
	const literalLength = createHuffmanTree(literalLengths);
	if (distance === undefined || literalLength === undefined) {
		throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
	}
	return { distance, literalLength };
}

function dynamicHuffmanTrees(reader: DeflateBitReader): {
	readonly distance: HuffmanNode | undefined;
	readonly literalLength: HuffmanNode;
} {
	const literalCount = reader.readBits(5) + 257;
	const distanceCount = reader.readBits(5) + 1;
	const codeLengthCount = reader.readBits(4) + 4;
	const codeLengths = new Array<number>(19).fill(0);
	for (let index = 0; index < codeLengthCount; index += 1) {
		codeLengths[requiredValue(CODE_LENGTH_ORDER, index)] = reader.readBits(3);
	}
	const codeLengthTree = createHuffmanTree(codeLengths);
	if (codeLengthTree === undefined) {
		throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
	}
	const lengths: number[] = [];
	while (lengths.length < literalCount + distanceCount) {
		const symbol = readHuffmanSymbol(reader, codeLengthTree);
		if (symbol <= 15) {
			lengths.push(symbol);
		} else if (symbol === 16) {
			if (lengths.length === 0) {
				throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
			}
			appendRepeatedLength(
				lengths,
				requiredValue(lengths, lengths.length - 1),
				reader.readBits(2) + 3,
				literalCount + distanceCount,
			);
		} else if (symbol === 17) {
			appendRepeatedLength(
				lengths,
				0,
				reader.readBits(3) + 3,
				literalCount + distanceCount,
			);
		} else if (symbol === 18) {
			appendRepeatedLength(
				lengths,
				0,
				reader.readBits(7) + 11,
				literalCount + distanceCount,
			);
		} else {
			throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
		}
	}
	const literalLength = createHuffmanTree(lengths.slice(0, literalCount));
	if (literalLength === undefined || lengths[256] === 0) {
		throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
	}
	return {
		distance: createHuffmanTree(lengths.slice(literalCount)),
		literalLength,
	};
}

function appendRepeatedLength(
	lengths: number[],
	value: number,
	count: number,
	maximum: number,
): void {
	if (lengths.length + count > maximum) {
		throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
	}
	for (let index = 0; index < count; index += 1) {
		lengths.push(value);
	}
}

function createHuffmanTree(
	lengths: readonly number[],
): HuffmanNode | undefined {
	const counts = new Array<number>(16).fill(0);
	for (const length of lengths) {
		if (!Number.isInteger(length) || length < 0 || length > 15) {
			throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
		}
		if (length > 0) {
			counts[length] = requiredValue(counts, length) + 1;
		}
	}
	if (counts.every((count) => count === 0)) {
		return undefined;
	}
	const nextCodes = new Array<number>(16).fill(0);
	let code = 0;
	for (let bits = 1; bits <= 15; bits += 1) {
		code = (code + requiredValue(counts, bits - 1)) << 1;
		nextCodes[bits] = code;
	}
	const root: MutableHuffmanNode = {};
	for (let symbol = 0; symbol < lengths.length; symbol += 1) {
		const length = requiredValue(lengths, symbol);
		if (length === 0) {
			continue;
		}
		let node: MutableHuffmanNode = root;
		const symbolCode = requiredValue(nextCodes, length);
		nextCodes[length] = symbolCode + 1;
		for (let bit = 0; bit < length; bit += 1) {
			const key =
				((symbolCode >>> (length - bit - 1)) & 1) === 0 ? "zero" : "one";
			if (bit === length - 1) {
				if (node[key] !== undefined) {
					throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
				}
				node[key] = { symbol };
			} else {
				node[key] ??= {};
				if (node[key]?.symbol !== undefined) {
					throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
				}
				const child = node[key];
				if (child === undefined) {
					throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
				}
				node = child;
			}
		}
	}
	return root;
}

function readHuffmanSymbol(
	reader: DeflateBitReader,
	root: HuffmanNode,
): number {
	let node: HuffmanNode | undefined = root;
	for (let depth = 0; depth < 15; depth += 1) {
		node = reader.readBits(1) === 0 ? node.zero : node.one;
		if (node === undefined) {
			break;
		}
		if (node.symbol !== undefined) {
			return node.symbol;
		}
	}
	throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
}

function exceedsCompressionRatio(
	uncompressedSize: number,
	compressedSize: number,
): boolean {
	return uncompressedSize > compressedSize * MAXIMUM_COMPRESSION_RATIO;
}

function hasRange(bytes: Uint8Array, offset: number, length: number): boolean {
	return (
		Number.isSafeInteger(offset) &&
		Number.isSafeInteger(length) &&
		offset >= 0 &&
		length >= 0 &&
		offset <= bytes.byteLength &&
		length <= bytes.byteLength - offset
	);
}

function readU16(bytes: Uint8Array, offset: number): number | undefined {
	if (!hasRange(bytes, offset, 2)) {
		return undefined;
	}
	return requiredValue(bytes, offset) | (requiredValue(bytes, offset + 1) << 8);
}

function readU32(bytes: Uint8Array, offset: number): number | undefined {
	if (!hasRange(bytes, offset, 4)) {
		return undefined;
	}
	return (
		(requiredValue(bytes, offset) |
			(requiredValue(bytes, offset + 1) << 8) |
			(requiredValue(bytes, offset + 2) << 16) |
			(requiredValue(bytes, offset + 3) << 24)) >>>
		0
	);
}

function requiredValue<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new DeflateFailure("BACKUP_CONTAINER_UNSUPPORTED");
	}
	return value;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.byteLength !== right.byteLength) {
		return false;
	}
	for (let index = 0; index < left.byteLength; index += 1) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}

function rejected(
	reasonCode: PpjA1ArchiveSourceFailureReason,
): Exclude<ReadPpjA1ZipCentralDirectoryResult, { readonly kind: "accepted" }> {
	return { kind: "rejected", reasonCode };
}

function sourceFailure(
	reasonCode: PpjA1ArchiveSourceFailureReason,
): PpjA1ArchiveSourceFailure {
	return { kind: "rejected", reasonCode };
}
