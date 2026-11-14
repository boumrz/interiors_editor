/**
 * Bounded raw-byte JSON parsing for the staged canonical PPJ-A1 member.
 *
 * This is deliberately below the PPJ-A1 closed-schema and archive boundaries:
 * it knows neither manifest/path/checksum state nor Project shape rules, and
 * it cannot construct or publish a Project. Numeric JSON tokens remain raw
 * lexemes. Each accepted value keeps a parent/source-span or parent/index link;
 * a diagnostic RFC 6901 pointer is reconstructed only on demand.
 */

export const MAXIMUM_PPJ_A1_JSON_BYTES = 10 * 1024 * 1024;
export const MAXIMUM_PPJ_A1_AST_CONTAINER_DEPTH = 8;
export const MAXIMUM_PPJ_A1_AST_NODES = 65_536;
export const MAXIMUM_PPJ_A1_AST_OBJECT_MEMBERS = 49_152;
export const MAXIMUM_PPJ_A1_AST_OBJECT_MEMBERS_PER_OBJECT = 32;
export const MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS = 24_576;
export const MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS_PER_ARRAY = 1_024;
export const MAXIMUM_PPJ_A1_AST_RECONSTRUCTED_POINTER_BYTES = 128;
export const MAXIMUM_PPJ_A1_AST_STRING_BYTES = 4 * 1024 * 1024;
export const MAXIMUM_PPJ_A1_AST_STRING_BYTES_PER_STRING = 4 * 1024;
export const MAXIMUM_PPJ_A1_AST_NUMERIC_TOKEN_BYTES = 64;
export const MAXIMUM_PPJ_A1_AST_METADATA_BYTES = 16 * 1024 * 1024;

const PPJ_A1_AST_PARSER_STATE_AND_DIAGNOSTIC_POINTER_BYTES = 8_320;

export type JsonByteSourceSpan = {
  readonly endByteExclusive: number;
  readonly startByte: number;
};

export type LosslessJsonPointerLink =
  | { readonly kind: 'root' }
  | {
      readonly kind: 'member';
      readonly memberName: string;
      readonly parent: LosslessJsonValue;
      readonly sourceSpan: JsonByteSourceSpan;
    }
  | {
      readonly index: number;
      readonly kind: 'array-index';
      readonly parent: LosslessJsonValue;
    };

type LosslessJsonNode = {
  readonly pointerLink: LosslessJsonPointerLink;
};

export type LosslessJsonArray = LosslessJsonNode & {
  readonly kind: 'array';
  readonly values: readonly LosslessJsonValue[];
};

export type LosslessJsonBoolean = LosslessJsonNode & {
  readonly kind: 'boolean';
  readonly value: boolean;
};

export type LosslessJsonNull = LosslessJsonNode & {
  readonly kind: 'null';
};

export type LosslessJsonNumber = LosslessJsonNode & {
  readonly kind: 'number';
  readonly lexeme: string;
};

export type LosslessJsonObject = LosslessJsonNode & {
  readonly kind: 'object';
  readonly properties: ReadonlyMap<string, LosslessJsonValue>;
};

export type LosslessJsonString = LosslessJsonNode & {
  readonly kind: 'string';
  readonly value: string;
};

export type LosslessJsonValue =
  | LosslessJsonArray
  | LosslessJsonBoolean
  | LosslessJsonNull
  | LosslessJsonNumber
  | LosslessJsonObject
  | LosslessJsonString;

export type PpjA1AstMetadataCounts = {
  readonly arrayElements: number;
  readonly decodedStringBytes: number;
  readonly memberRecords: number;
  readonly pointerLinks: number;
  readonly rawNumericLexemeBytes: number;
  readonly valueNodes: number;
};

export type ParsePpjA1JsonBytesResult =
  | { readonly kind: 'accepted'; readonly root: LosslessJsonValue }
  | { readonly kind: 'rejected'; readonly reasonCode: 'BACKUP_PROJECT_LIMIT' | 'BACKUP_SCHEMA_UNREADABLE' };

type ParsedJsonNumber = {
  readonly byteLength: number;
  readonly lexeme: string;
};

type ParsedJsonString = {
  readonly byteLength: number;
  readonly sourceSpan: JsonByteSourceSpan;
  readonly value: string;
};

type ParsedStringState = {
  byteLength: number;
  pendingHighSurrogate: number | undefined;
  readonly parts: string[];
};

type ResourceDelta = Partial<PpjA1AstMetadataCounts>;

class AstCapacityExceededError extends Error {
  public constructor() {
    super('PPJ-A1 AST-R1 capacity exceeded');
  }
}

/**
 * The source-owned AST-R1 accounting formula. It is exported for deterministic
 * corpus checks; parsing itself rejects before retaining a value over the cap.
 */
export function calculatePpjA1AstMetadataBytes(counts: PpjA1AstMetadataCounts): number {
  return (
    48 * counts.valueNodes +
    32 * counts.memberRecords +
    8 * counts.arrayElements +
    16 * counts.pointerLinks +
    counts.decodedStringBytes +
    counts.rawNumericLexemeBytes +
    PPJ_A1_AST_PARSER_STATE_AND_DIAGNOSTIC_POINTER_BYTES
  );
}

/**
 * Reconstructs a diagnostic pointer from bounded parent links. Parse admission
 * guarantees that the returned UTF-8 pointer is at most 128 bytes.
 */
export function reconstructPpjA1JsonPointer(value: LosslessJsonValue): string {
  const segments: Array<string | number> = [];
  let link = value.pointerLink;
  while (link.kind !== 'root') {
    if (link.kind === 'member') {
      segments.push(link.memberName);
    } else {
      segments.push(link.index);
    }
    link = link.parent.pointerLink;
  }

  let pointer = '';
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    pointer += `/${escapeJsonPointerSegment(String(segments[index]))}`;
  }
  if (utf8ByteLength(pointer) > MAXIMUM_PPJ_A1_AST_RECONSTRUCTED_POINTER_BYTES) {
    throw new Error('Accepted PPJ-A1 AST has an oversized diagnostic pointer');
  }
  return pointer;
}

/**
 * The upstream archive adapter normally enforces the member-size envelope
 * before checksum and parser dispatch. Retaining the same defensive guard here
 * keeps the standalone seam total for direct callers.
 */
export function parsePpjA1JsonBytes(bytes: Uint8Array): ParsePpjA1JsonBytesResult {
  if (bytes.byteLength > MAXIMUM_PPJ_A1_JSON_BYTES) {
    return reject('BACKUP_PROJECT_LIMIT');
  }

  try {
    return { kind: 'accepted', root: new LosslessJsonByteParser(bytes).parseDocument() };
  } catch (error) {
    if (error instanceof AstCapacityExceededError) {
      return reject('BACKUP_PROJECT_LIMIT');
    }
    return reject('BACKUP_SCHEMA_UNREADABLE');
  }
}

class LosslessJsonByteParser {
  private arrayElements = 0;
  private containerDepth = 0;
  private cursor = 0;
  private decodedStringBytes = 0;
  private memberRecords = 0;
  private pointerLinks = 0;
  private rawNumericLexemeBytes = 0;
  private valueNodes = 0;

  public constructor(private readonly bytes: Uint8Array) {}

  public parseDocument(): LosslessJsonValue {
    this.skipWhitespace();
    const root = this.parseValue({ kind: 'root' }, false);
    this.skipWhitespace();
    if (this.currentByte() !== undefined) {
      throw new SyntaxError('Unexpected trailing JSON token');
    }
    return root;
  }

  private parseValue(link: LosslessJsonPointerLink, isArrayElement: boolean): LosslessJsonValue {
    const current = this.currentByte();
    if (current === undefined) {
      throw new SyntaxError('Expected JSON value');
    }
    switch (current) {
      case 0x7b:
        return this.parseObject(link, isArrayElement);
      case 0x5b:
        return this.parseArray(link, isArrayElement);
      case 0x22: {
        const string = this.parseString();
        this.admitValue(link, isArrayElement, string.byteLength, 0);
        return { kind: 'string', pointerLink: link, value: string.value };
      }
      case 0x74:
        this.consumeLiteral('true');
        this.admitValue(link, isArrayElement, 0, 0);
        return { kind: 'boolean', pointerLink: link, value: true };
      case 0x66:
        this.consumeLiteral('false');
        this.admitValue(link, isArrayElement, 0, 0);
        return { kind: 'boolean', pointerLink: link, value: false };
      case 0x6e:
        this.consumeLiteral('null');
        this.admitValue(link, isArrayElement, 0, 0);
        return { kind: 'null', pointerLink: link };
      default:
        if (current === 0x2d || isDigitByte(current)) {
          const number = this.parseNumber();
          this.admitValue(link, isArrayElement, 0, number.byteLength);
          return { kind: 'number', lexeme: number.lexeme, pointerLink: link };
        }
        throw new SyntaxError('Expected JSON value');
    }
  }

  private parseObject(link: LosslessJsonPointerLink, isArrayElement: boolean): LosslessJsonObject {
    this.consumeByte(0x7b);
    this.admitContainer(link, isArrayElement);
    const properties = new Map<string, LosslessJsonValue>();
    const object: LosslessJsonObject = { kind: 'object', pointerLink: link, properties };
    try {
      this.skipWhitespace();
      if (this.tryConsumeByte(0x7d)) {
        return object;
      }

      while (true) {
        if (this.currentByte() !== 0x22) {
          throw new SyntaxError('Expected JSON object member name');
        }
        const key = this.parseString();
        const childLink: LosslessJsonPointerLink = {
          kind: 'member',
          memberName: key.value,
          parent: object,
          sourceSpan: key.sourceSpan
        };
        this.reserveObjectMember(key, childLink, properties);
        this.skipWhitespace();
        this.consumeByte(0x3a);
        this.skipWhitespace();
        properties.set(key.value, this.parseValue(childLink, false));
        this.skipWhitespace();
        if (this.tryConsumeByte(0x7d)) {
          return object;
        }
        this.consumeByte(0x2c);
        this.skipWhitespace();
      }
    } finally {
      this.containerDepth -= 1;
    }
  }

  private parseArray(link: LosslessJsonPointerLink, isArrayElement: boolean): LosslessJsonArray {
    this.consumeByte(0x5b);
    this.admitContainer(link, isArrayElement);
    const values: LosslessJsonValue[] = [];
    const array: LosslessJsonArray = { kind: 'array', pointerLink: link, values };
    try {
      this.skipWhitespace();
      if (this.tryConsumeByte(0x5d)) {
        return array;
      }

      while (true) {
        const childLink: LosslessJsonPointerLink = { index: values.length, kind: 'array-index', parent: array };
        values.push(this.parseValue(childLink, true));
        this.skipWhitespace();
        if (this.tryConsumeByte(0x5d)) {
          return array;
        }
        this.consumeByte(0x2c);
        this.skipWhitespace();
      }
    } finally {
      this.containerDepth -= 1;
    }
  }

  private parseString(): ParsedJsonString {
    const startByte = this.cursor;
    const state: ParsedStringState = { byteLength: 0, parts: [], pendingHighSurrogate: undefined };
    this.consumeByte(0x22);
    while (true) {
      const current = this.currentByte();
      if (current === undefined) {
        throw new SyntaxError('Unterminated JSON string');
      }
      if (current === 0x22) {
        this.cursor += 1;
        this.assertNoPendingHighSurrogate(state);
        return {
          byteLength: state.byteLength,
          sourceSpan: { endByteExclusive: this.cursor, startByte },
          value: state.parts.join('')
        };
      }
      if (current === 0x5c) {
        this.cursor += 1;
        this.parseStringEscape(state);
        continue;
      }
      if (current < 0x20) {
        throw new SyntaxError('Unescaped control character in JSON string');
      }
      if (current <= 0x7f) {
        this.cursor += 1;
        this.appendStringCodeUnit(state, current);
        continue;
      }
      const decoded = this.consumeUtf8CodePoint();
      this.assertNoPendingHighSurrogate(state);
      this.appendStringText(state, decoded.text, decoded.byteLength);
    }
  }

  private parseStringEscape(state: ParsedStringState): void {
    const escaped = this.currentByte();
    if (escaped === undefined) {
      throw new SyntaxError('Unterminated JSON string escape');
    }
    this.cursor += 1;
    switch (escaped) {
      case 0x22:
      case 0x2f:
      case 0x5c:
        this.appendStringCodeUnit(state, escaped);
        return;
      case 0x62:
        this.appendStringCodeUnit(state, 0x08);
        return;
      case 0x66:
        this.appendStringCodeUnit(state, 0x0c);
        return;
      case 0x6e:
        this.appendStringCodeUnit(state, 0x0a);
        return;
      case 0x72:
        this.appendStringCodeUnit(state, 0x0d);
        return;
      case 0x74:
        this.appendStringCodeUnit(state, 0x09);
        return;
      case 0x75:
        this.appendStringCodeUnit(state, this.consumeEscapedUnicodeCodeUnit());
        return;
      default:
        throw new SyntaxError('Invalid JSON string escape');
    }
  }

  private consumeEscapedUnicodeCodeUnit(): number {
    let codeUnit = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      const hex = hexByteValue(this.currentByte());
      if (hex === undefined) {
        throw new SyntaxError('Invalid JSON unicode escape');
      }
      this.cursor += 1;
      codeUnit = (codeUnit << 4) | hex;
    }
    return codeUnit;
  }

  private appendStringCodeUnit(state: ParsedStringState, codeUnit: number): void {
    const pendingHighSurrogate = state.pendingHighSurrogate;
    if (pendingHighSurrogate !== undefined) {
      if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        state.pendingHighSurrogate = undefined;
        this.appendStringText(state, String.fromCharCode(pendingHighSurrogate, codeUnit), 4);
        return;
      }
      throw new SyntaxError('Unpaired JSON escaped high surrogate');
    }
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      state.pendingHighSurrogate = codeUnit;
      return;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new SyntaxError('Unpaired JSON escaped low surrogate');
    }
    this.appendStringText(state, String.fromCharCode(codeUnit), utf8CodeUnitByteLength(codeUnit));
  }

  private assertNoPendingHighSurrogate(state: ParsedStringState): void {
    if (state.pendingHighSurrogate === undefined) {
      return;
    }
    throw new SyntaxError('Unpaired JSON escaped high surrogate');
  }

  private appendStringText(state: ParsedStringState, text: string, byteLength: number): void {
    const nextStringByteLength = state.byteLength + byteLength;
    if (
      nextStringByteLength > MAXIMUM_PPJ_A1_AST_STRING_BYTES_PER_STRING ||
      this.decodedStringBytes + nextStringByteLength > MAXIMUM_PPJ_A1_AST_STRING_BYTES
    ) {
      throw new AstCapacityExceededError();
    }
    this.assertMetadataCapacity({ decodedStringBytes: nextStringByteLength });
    state.byteLength = nextStringByteLength;
    state.parts.push(text);
  }

  private parseNumber(): ParsedJsonNumber {
    const startByte = this.cursor;
    let tokenByteLength = 0;
    const consumeNumericByte = () => {
      this.cursor += 1;
      tokenByteLength += 1;
      if (tokenByteLength > MAXIMUM_PPJ_A1_AST_NUMERIC_TOKEN_BYTES) {
        throw new AstCapacityExceededError();
      }
      this.assertMetadataCapacity({ rawNumericLexemeBytes: tokenByteLength });
    };

    if (this.currentByte() === 0x2d) {
      consumeNumericByte();
    }
    if (this.currentByte() === 0x30) {
      consumeNumericByte();
      if (isDigitByte(this.currentByte())) {
        throw new SyntaxError('Leading zero in JSON number');
      }
    } else {
      if (!isDigitOneToNineByte(this.currentByte())) {
        throw new SyntaxError('Expected non-zero JSON digit');
      }
      consumeNumericByte();
      while (isDigitByte(this.currentByte())) {
        consumeNumericByte();
      }
    }

    if (this.currentByte() === 0x2e) {
      if (!isDigitByte(this.byteAt(this.cursor + 1))) {
        throw new SyntaxError('Expected JSON digit after decimal point');
      }
      consumeNumericByte();
      do {
        consumeNumericByte();
      } while (isDigitByte(this.currentByte()));
    }

    if (this.currentByte() === 0x45 || this.currentByte() === 0x65) {
      const signOffset = this.byteAt(this.cursor + 1) === 0x2b || this.byteAt(this.cursor + 1) === 0x2d ? 2 : 1;
      if (!isDigitByte(this.byteAt(this.cursor + signOffset))) {
        throw new SyntaxError('Expected JSON exponent digit');
      }
      consumeNumericByte();
      if (this.currentByte() === 0x2b || this.currentByte() === 0x2d) {
        consumeNumericByte();
      }
      do {
        consumeNumericByte();
      } while (isDigitByte(this.currentByte()));
    }

    return { byteLength: tokenByteLength, lexeme: asciiString(this.bytes, startByte, this.cursor) };
  }

  private admitContainer(link: LosslessJsonPointerLink, isArrayElement: boolean): void {
    if (this.containerDepth + 1 > MAXIMUM_PPJ_A1_AST_CONTAINER_DEPTH) {
      throw new AstCapacityExceededError();
    }
    this.admitValue(link, isArrayElement, 0, 0);
    this.containerDepth += 1;
  }

  private admitValue(
    link: LosslessJsonPointerLink,
    isArrayElement: boolean,
    decodedStringByteLength: number,
    rawNumericLexemeByteLength: number
  ): void {
    if (this.valueNodes + 1 > MAXIMUM_PPJ_A1_AST_NODES) {
      throw new AstCapacityExceededError();
    }
    if (pointerLinkByteLength(link) > MAXIMUM_PPJ_A1_AST_RECONSTRUCTED_POINTER_BYTES) {
      throw new AstCapacityExceededError();
    }
    if (
      isArrayElement &&
      (this.arrayElements + 1 > MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS ||
        (link.kind === 'array-index' && link.index + 1 > MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS_PER_ARRAY))
    ) {
      throw new AstCapacityExceededError();
    }
    this.assertMetadataCapacity({
      arrayElements: isArrayElement ? 1 : 0,
      decodedStringBytes: decodedStringByteLength,
      pointerLinks: 1,
      rawNumericLexemeBytes: rawNumericLexemeByteLength,
      valueNodes: 1
    });
    this.arrayElements += isArrayElement ? 1 : 0;
    this.decodedStringBytes += decodedStringByteLength;
    this.pointerLinks += 1;
    this.rawNumericLexemeBytes += rawNumericLexemeByteLength;
    this.valueNodes += 1;
  }

  private reserveObjectMember(
    key: ParsedJsonString,
    childLink: LosslessJsonPointerLink,
    properties: ReadonlyMap<string, LosslessJsonValue>
  ): void {
    if (properties.has(key.value)) {
      throw new SyntaxError('Duplicate JSON object member name');
    }
    if (pointerLinkByteLength(childLink) > MAXIMUM_PPJ_A1_AST_RECONSTRUCTED_POINTER_BYTES) {
      throw new AstCapacityExceededError();
    }
    if (
      this.memberRecords + 1 > MAXIMUM_PPJ_A1_AST_OBJECT_MEMBERS ||
      properties.size + 1 > MAXIMUM_PPJ_A1_AST_OBJECT_MEMBERS_PER_OBJECT
    ) {
      throw new AstCapacityExceededError();
    }
    this.assertMetadataCapacity({ decodedStringBytes: key.byteLength, memberRecords: 1 });
    this.decodedStringBytes += key.byteLength;
    this.memberRecords += 1;
  }

  private assertMetadataCapacity(delta: ResourceDelta): void {
    const metadataBytes = calculatePpjA1AstMetadataBytes({
      arrayElements: this.arrayElements + (delta.arrayElements ?? 0),
      decodedStringBytes: this.decodedStringBytes + (delta.decodedStringBytes ?? 0),
      memberRecords: this.memberRecords + (delta.memberRecords ?? 0),
      pointerLinks: this.pointerLinks + (delta.pointerLinks ?? 0),
      rawNumericLexemeBytes: this.rawNumericLexemeBytes + (delta.rawNumericLexemeBytes ?? 0),
      valueNodes: this.valueNodes + (delta.valueNodes ?? 0)
    });
    if (metadataBytes > MAXIMUM_PPJ_A1_AST_METADATA_BYTES) {
      throw new AstCapacityExceededError();
    }
  }

  private consumeUtf8CodePoint(): { readonly byteLength: number; readonly text: string } {
    const first = this.currentByte();
    if (first === undefined) {
      throw new SyntaxError('Unreadable UTF-8');
    }
    const sequence = utf8Sequence(first);
    if (!sequence || this.cursor + sequence.width > this.bytes.length) {
      throw new SyntaxError('Unreadable UTF-8');
    }
    let codePoint = first & sequence.mask;
    for (let offset = 1; offset < sequence.width; offset += 1) {
      const continuation = this.byteAt(this.cursor + offset);
      if (continuation === undefined || (continuation & 0xc0) !== 0x80) {
        throw new SyntaxError('Unreadable UTF-8');
      }
      codePoint = (codePoint << 6) | (continuation & 0x3f);
    }
    if (
      codePoint < sequence.minimumCodePoint ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
      codePoint > 0x10ffff
    ) {
      throw new SyntaxError('Unreadable UTF-8');
    }
    this.cursor += sequence.width;
    return { byteLength: sequence.width, text: String.fromCodePoint(codePoint) };
  }

  private consumeLiteral(literal: string): void {
    for (let index = 0; index < literal.length; index += 1) {
      if (this.currentByte() !== literal.charCodeAt(index)) {
        throw new SyntaxError(`Expected ${literal}`);
      }
      this.cursor += 1;
    }
  }

  private consumeByte(expected: number): void {
    if (!this.tryConsumeByte(expected)) {
      throw new SyntaxError(`Expected JSON byte ${expected}`);
    }
  }

  private tryConsumeByte(expected: number): boolean {
    if (this.currentByte() !== expected) {
      return false;
    }
    this.cursor += 1;
    return true;
  }

  private skipWhitespace(): void {
    while (isJsonWhitespaceByte(this.currentByte())) {
      this.cursor += 1;
    }
  }

  private byteAt(index: number): number | undefined {
    return this.bytes[index];
  }

  private currentByte(): number | undefined {
    return this.byteAt(this.cursor);
  }
}

function pointerLinkByteLength(link: LosslessJsonPointerLink): number {
  let byteLength = 0;
  let current = link;
  while (current.kind !== 'root') {
    byteLength += 1;
    if (current.kind === 'member') {
      byteLength += escapedJsonPointerSegmentByteLength(current.memberName);
    } else {
      byteLength += String(current.index).length;
    }
    current = current.parent.pointerLink;
  }
  return byteLength;
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function escapedJsonPointerSegmentByteLength(segment: string): number {
  let byteLength = 0;
  for (let index = 0; index < segment.length; index += 1) {
    const codeUnit = segment.charCodeAt(index);
    if (codeUnit === 0x2f || codeUnit === 0x7e) {
      byteLength += 2;
      continue;
    }
    const encoded = utf8CodePointByteLength(segment, index);
    byteLength += encoded.byteLength;
    index += encoded.width - 1;
  }
  return byteLength;
}

function utf8ByteLength(value: string): number {
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const encoded = utf8CodePointByteLength(value, index);
    byteLength += encoded.byteLength;
    index += encoded.width - 1;
  }
  return byteLength;
}

function utf8CodePointByteLength(value: string, index: number): { readonly byteLength: number; readonly width: number } {
  const codeUnit = value.charCodeAt(index);
  if (codeUnit <= 0x7f) {
    return { byteLength: 1, width: 1 };
  }
  if (codeUnit <= 0x7ff) {
    return { byteLength: 2, width: 1 };
  }
  const nextCodeUnit = value.charCodeAt(index + 1);
  if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
    return { byteLength: 4, width: 2 };
  }
  return { byteLength: 3, width: 1 };
}

function utf8CodeUnitByteLength(codeUnit: number): number {
  if (codeUnit <= 0x7f) {
    return 1;
  }
  if (codeUnit <= 0x7ff) {
    return 2;
  }
  return 3;
}

function asciiString(bytes: Uint8Array, start: number, end: number): string {
  let value = '';
  for (let index = start; index < end; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function hexByteValue(value: number | undefined): number | undefined {
  if (value !== undefined && value >= 0x30 && value <= 0x39) {
    return value - 0x30;
  }
  if (value !== undefined && value >= 0x41 && value <= 0x46) {
    return value - 0x41 + 10;
  }
  if (value !== undefined && value >= 0x61 && value <= 0x66) {
    return value - 0x61 + 10;
  }
  return undefined;
}

function isDigitByte(value: number | undefined): boolean {
  return value !== undefined && value >= 0x30 && value <= 0x39;
}

function isDigitOneToNineByte(value: number | undefined): boolean {
  return value !== undefined && value >= 0x31 && value <= 0x39;
}

function isJsonWhitespaceByte(value: number | undefined): boolean {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
}

function utf8Sequence(first: number): { readonly mask: number; readonly minimumCodePoint: number; readonly width: number } | undefined {
  if (first >= 0xc2 && first <= 0xdf) {
    return { mask: 0x1f, minimumCodePoint: 0x80, width: 2 };
  }
  if (first >= 0xe0 && first <= 0xef) {
    return { mask: 0x0f, minimumCodePoint: 0x800, width: 3 };
  }
  if (first >= 0xf0 && first <= 0xf4) {
    return { mask: 0x07, minimumCodePoint: 0x10000, width: 4 };
  }
  return undefined;
}

function reject(reasonCode: Extract<ParsePpjA1JsonBytesResult, { readonly kind: 'rejected' }>['reasonCode']): Extract<
  ParsePpjA1JsonBytesResult,
  { readonly kind: 'rejected' }
> {
  return { kind: 'rejected', reasonCode };
}
