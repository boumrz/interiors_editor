import { describe, expect, it } from '@rstest/core';
import {
  MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS,
  MAXIMUM_PPJ_A1_AST_METADATA_BYTES,
  MAXIMUM_PPJ_A1_AST_NODES,
  MAXIMUM_PPJ_A1_JSON_BYTES,
  calculatePpjA1AstMetadataBytes,
  parsePpjA1JsonBytes,
  reconstructPpjA1JsonPointer,
  type LosslessJsonValue
} from './ppj-a1-lossless-json';

function parse(text: string) {
  return parsePpjA1JsonBytes(asciiBytes(text));
}

function asciiBytes(text: string): Uint8Array {
  const bytes = Array.from(text, (character) => character.charCodeAt(0));
  if (bytes.some((byte) => byte > 0x7f)) {
    throw new Error('Test helper accepts ASCII fixtures only');
  }
  return Uint8Array.from(bytes);
}

function utf8StringDocument(contentBytes: readonly number[]): Uint8Array {
  return Uint8Array.from([0x7b, 0x22, 0x76, 0x22, 0x3a, 0x22, ...contentBytes, 0x22, 0x7d]);
}

function utf8ObjectMemberDocument(memberNameBytes: readonly number[]): Uint8Array {
  return Uint8Array.from([0x7b, 0x22, ...memberNameBytes, 0x22, 0x3a, 0x30, 0x7d]);
}

function jsonUnicodeEscape(hex: string): string {
  return `${String.fromCharCode(0x5c)}u${hex}`;
}

function escapedJsonStringDocument(escapedContents: string): string {
  return `{"v":"${escapedContents}"}`;
}

function requireObject(value: LosslessJsonValue): ReadonlyMap<string, LosslessJsonValue> {
  if (value.kind !== 'object') {
    throw new Error('Expected a JSON object');
  }
  return value.properties;
}

function requireProperty(value: LosslessJsonValue, key: string): LosslessJsonValue {
  const property = requireObject(value).get(key);
  if (!property) {
    throw new Error(`Expected ${key}`);
  }
  return property;
}

function objectWithNumericProperties(propertyCount: number): string {
  return `{${Array.from({ length: propertyCount }, (_, index) => `"k${index}":0`).join(',')}}`;
}

function aggregateMemberDocument(lastObjectPropertyCount: number): string {
  const firstCollection = Array.from({ length: 1024 }, () => objectWithNumericProperties(24)).join(',');
  const secondCollection = [
    ...Array.from({ length: 1023 }, () => objectWithNumericProperties(24)),
    objectWithNumericProperties(lastObjectPropertyCount)
  ].join(',');
  return `{"a":[${firstCollection}],"b":[${secondCollection}]}`;
}

function aggregateArrayDocument(lastInnerArrayValueCount: number): string {
  const inner = (valueCount: number) => `[${Array.from({ length: valueCount }, () => '0').join(',')}]`;
  return `[${[...Array.from({ length: 1023 }, () => inner(23)), inner(lastInnerArrayValueCount)].join(',')}]`;
}

function nodeBudgetDocument(withOneExtraNode: boolean): string {
  let propertySlot = 0;
  const arraysInsteadOfScalars = 14_847;
  const object = (propertyCount: number) => {
    const properties = Array.from({ length: propertyCount }, (_, index) => {
      const value =
        propertySlot < arraysInsteadOfScalars
          ? withOneExtraNode && propertySlot === 0
            ? '[[0]]'
            : '[0]'
          : '0';
      propertySlot += 1;
      return `"k${index}":${value}`;
    });
    return `{${properties.join(',')}}`;
  };
  const firstCollection = Array.from({ length: 1024 }, () => object(32)).join(',');
  const secondCollection = [
    ...Array.from({ length: 510 }, () => object(32)),
    object(31),
    object(31)
  ].join(',');
  return `{"a":[${firstCollection}],"b":[${secondCollection}]}`;
}

describe('PPJ-A1 bounded lossless JSON AST', () => {
  it('retains numeric lexemes and reconstructs escaped pointers only on demand', () => {
    const result = parse('{"schemaVersion":1,"a/b":{"negativeZero":-0,"exponent":1e3,"decimal":1.0}}');

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected accepted parse');
    }

    const nested = requireProperty(result.root, 'a/b');
    const negativeZero = requireProperty(nested, 'negativeZero');
    expect(reconstructPpjA1JsonPointer(nested)).toBe('/a~1b');
    expect(negativeZero).toMatchObject({ kind: 'number', lexeme: '-0' });
    expect(reconstructPpjA1JsonPointer(negativeZero)).toBe('/a~1b/negativeZero');
    expect(Object.hasOwn(negativeZero, 'pointer')).toBe(false);
    expect(negativeZero.pointerLink).toMatchObject({ kind: 'member', memberName: 'negativeZero' });
    expect(requireProperty(nested, 'exponent')).toMatchObject({ kind: 'number', lexeme: '1e3' });
    expect(requireProperty(nested, 'decimal')).toMatchObject({ kind: 'number', lexeme: '1.0' });
  });

  it('uses decoded JSON member names to reject duplicates', () => {
    expect(parse('{"a":1,"\\u0061":2}')).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_SCHEMA_UNREADABLE'
    });
  });

  it('keeps an escaped member-name source span without copying its full pointer', () => {
    const document = '{"a\\u002fb":0}';
    const result = parse(document);

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected accepted parse');
    }
    const value = requireProperty(result.root, 'a/b');
    expect(value.pointerLink.kind).toBe('member');
    if (value.pointerLink.kind !== 'member') {
      throw new Error('Expected member pointer link');
    }
    const { sourceSpan } = value.pointerLink;
    expect(document.slice(sourceSpan.startByte, sourceSpan.endByteExclusive)).toBe('"a\\u002fb"');
    expect(reconstructPpjA1JsonPointer(value)).toBe('/a~1b');
  });

  it('decodes JSON string escapes without document-level JSON.parse', () => {
    const result = parse('{"label":"\\u2713\\n\\""}');

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected accepted parse');
    }
    expect(requireProperty(result.root, 'label')).toMatchObject({ kind: 'string', value: '✓\n"' });
  });

  it('retains every JSON primitive form as observable AST values', () => {
    const result = parse('[true,false,null,"",0,-0,-12,1.5,6e+2,-7E-3]');

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted' || result.root.kind !== 'array') {
      throw new Error('Expected an accepted JSON array');
    }

    const values = result.root.values;
    expect(values.map((value) => value.kind)).toEqual([
      'boolean',
      'boolean',
      'null',
      'string',
      'number',
      'number',
      'number',
      'number',
      'number',
      'number'
    ]);
    expect(values[0]).toMatchObject({ kind: 'boolean', value: true });
    expect(values[1]).toMatchObject({ kind: 'boolean', value: false });
    expect(values[2]).toMatchObject({ kind: 'null' });
    expect(values[3]).toMatchObject({ kind: 'string', value: '' });
    expect(values.slice(4)).toMatchObject([
      { kind: 'number', lexeme: '0' },
      { kind: 'number', lexeme: '-0' },
      { kind: 'number', lexeme: '-12' },
      { kind: 'number', lexeme: '1.5' },
      { kind: 'number', lexeme: '6e+2' },
      { kind: 'number', lexeme: '-7E-3' }
    ]);
  });

  it('decodes all JSON string escape forms including a surrogate pair', () => {
    const escapedJsonValue = ['\\b', '\\f', '\\n', '\\r', '\\t', '\\\\', '\\/', '\\"', '\\u0041', '\\uD83D', '\\uDE00'].join('');
    const result = parse(`{"value":"${escapedJsonValue}"}`);

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected an accepted JSON object');
    }
    expect(requireProperty(result.root, 'value')).toMatchObject({
      kind: 'string',
      value: '\b\f\n\r\t\\/"A😀'
    });
  });

  const escaped007f = jsonUnicodeEscape('007F');
  const escaped07ff = jsonUnicodeEscape('07FF');
  const escaped0800 = jsonUnicodeEscape('0800');
  const escapedMaximumSurrogatePair = [jsonUnicodeEscape('DBFF'), jsonUnicodeEscape('DFFF')].join('');

  it.each([
    {
      label: 'U+007F',
      acceptedEscapedContents: escaped007f.repeat(4096),
      rejectedEscapedContents: escaped007f.repeat(4097)
    },
    {
      label: 'U+07FF',
      acceptedEscapedContents: escaped07ff.repeat(2048),
      rejectedEscapedContents: escaped07ff.repeat(2049)
    },
    {
      label: 'U+0800 plus U+007F',
      acceptedEscapedContents: [escaped0800.repeat(1365), escaped007f].join(''),
      rejectedEscapedContents: [escaped0800.repeat(1365), escaped007f.repeat(2)].join('')
    },
    {
      label: 'U+10FFFF escaped surrogate pair',
      acceptedEscapedContents: escapedMaximumSurrogatePair.repeat(1024),
      rejectedEscapedContents: escapedMaximumSurrogatePair.repeat(1025)
    }
  ])(
    'enforces the decoded 4 KiB byte cap for escaped Unicode strings: $label',
    ({ acceptedEscapedContents, rejectedEscapedContents }) => {
      expect(parse(escapedJsonStringDocument(acceptedEscapedContents))).toMatchObject({ kind: 'accepted' });
      expect(parse(escapedJsonStringDocument(rejectedEscapedContents))).toEqual({
        kind: 'rejected',
        reasonCode: 'BACKUP_PROJECT_LIMIT'
      });
    }
  );

  it.each([
    { escaped: '\\uD800\\uDC00', value: String.fromCodePoint(0x10000) },
    { escaped: '\\uD800\\uDFFF', value: String.fromCodePoint(0x103ff) },
    { escaped: '\\uDBFF\\uDC00', value: String.fromCodePoint(0x10fc00) },
    { escaped: '\\uDBFF\\uDFFF', value: String.fromCodePoint(0x10ffff) }
  ])('decodes the inclusive surrogate-pair bounds: $escaped', ({ escaped, value }) => {
    const result = parse(`{"value":"${escaped}"}`);

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected an accepted surrogate-pair string');
    }
    expect(requireProperty(result.root, 'value')).toMatchObject({ kind: 'string', value });
  });

  it.each([
    { document: '{"value":"\\uD800"}', label: 'unfinished high surrogate value' },
    { document: '{"value":"\\uDC00"}', label: 'unpaired low surrogate value' },
    { document: '{"value":"\\uD800x"}', label: 'high surrogate followed by an ordinary code unit' },
    { document: '{"\\uD800":0}', label: 'unfinished high surrogate member name' },
    { document: '{"\\uDC00":0}', label: 'unpaired low surrogate member name' }
  ])('rejects a non-scalar escaped surrogate in a $label', ({ document }) => {
    expect(parse(document)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_SCHEMA_UNREADABLE'
    });
  });

  it('retains numeric digit endpoints and multi-digit fractional/exponent lexemes', () => {
    const result = parse('[9,19,1.99,9e9,9e99]');

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted' || result.root.kind !== 'array') {
      throw new Error('Expected an accepted numeric array');
    }
    expect(result.root.values).toMatchObject([
      { kind: 'number', lexeme: '9' },
      { kind: 'number', lexeme: '19' },
      { kind: 'number', lexeme: '1.99' },
      { kind: 'number', lexeme: '9e9' },
      { kind: 'number', lexeme: '9e99' }
    ]);
  });

  it('accepts JSON whitespace and empty containers without changing their values', () => {
    const result = parse(' \t\r\n [ { } , [ ] , true , false , null ] \r\n');

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted' || result.root.kind !== 'array') {
      throw new Error('Expected an accepted JSON array');
    }
    expect(result.root.values.map((value) => value.kind)).toEqual(['object', 'array', 'boolean', 'boolean', 'null']);
    expect(result.root.values[2]).toMatchObject({ kind: 'boolean', value: true });
    expect(result.root.values[3]).toMatchObject({ kind: 'boolean', value: false });
  });

  it.each([
    '[-]',
    '[-/]',
    '[-:]',
    '[01]',
    '[1.,]',
    '[1.]',
    '[1e]',
    '[1e,]',
    '[1e+]',
    '[1e-]',
    '[+1]',
    '[tru]',
    '[truex]',
    '[fals]',
    '[nullx]',
    '[truz]',
    '[1 2]',
    '{"a" 1}',
    '{"a":1,}',
    `{"v":"${String.fromCharCode(0x5c)}q"}`,
    `{"v":"${String.fromCharCode(0x5c)}u12g4"}`,
    `{"v":"${String.fromCharCode(0x5c)}`,
    `{"v":"a${String.fromCharCode(0x01)}b"}`
  ])('rejects malformed JSON syntax and scalar grammar: %s', (document) => {
    expect(parse(document)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it.each([0x2f, 0x40, 0x60])('rejects each non-hex byte below JSON unicode-escape ranges: %s', (invalidByte) => {
    const invalidEscape = String.fromCharCode(0x5c, 0x75, 0x31, 0x32, invalidByte, 0x34);
    const document = `{"v":"${invalidEscape}"}`;

    expect(parse(document)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('rejects invalid JSON grammar instead of accepting a valid prefix', () => {
    expect(parse('{"schemaVersion":01}')).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
    expect(parse('{"schemaVersion":1} trailing')).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('reconstructs every array index from parent links', () => {
    const result = parse('{"vertices":[{"xMm":125},{"xMm":-125}]}');

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected accepted parse');
    }
    const vertices = requireProperty(result.root, 'vertices');
    expect(vertices.kind).toBe('array');
    if (vertices.kind !== 'array') {
      throw new Error('Expected vertices array');
    }
    expect(reconstructPpjA1JsonPointer(requireProperty(vertices.values[0], 'xMm'))).toBe('/vertices/0/xMm');
    expect(reconstructPpjA1JsonPointer(requireProperty(vertices.values[1], 'xMm'))).toBe('/vertices/1/xMm');
  });

  it('rejects unreadable UTF-8 before a JSON value exists', () => {
    expect(parsePpjA1JsonBytes(new Uint8Array([0xc3, 0x28]))).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_SCHEMA_UNREADABLE'
    });
  });

  it('rejects unreadable UTF-8 before an object member name completes', () => {
    expect(parsePpjA1JsonBytes(new Uint8Array([0x7b, 0x22, 0xc3, 0x28]))).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_SCHEMA_UNREADABLE'
    });
  });

  it.each([
    { contentBytes: [0xc2, 0x80], value: String.fromCodePoint(0x80) },
    { contentBytes: [0xdf, 0xbf], value: String.fromCodePoint(0x7ff) },
    { contentBytes: [0xe0, 0xa0, 0x80], value: String.fromCodePoint(0x800) },
    { contentBytes: [0xef, 0xbf, 0xbf], value: String.fromCodePoint(0xffff) },
    { contentBytes: [0xf0, 0x90, 0x80, 0x80], value: String.fromCodePoint(0x10000) },
    { contentBytes: [0xf4, 0x8f, 0xbf, 0xbf], value: String.fromCodePoint(0x10ffff) }
  ])('retains valid UTF-8 range endpoint bytes: $contentBytes', ({ contentBytes, value }) => {
    const result = parsePpjA1JsonBytes(utf8StringDocument(contentBytes));

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected an accepted UTF-8 endpoint');
    }
    expect(requireProperty(result.root, 'v')).toMatchObject({ kind: 'string', value });
  });

  it('distinguishes raw JSON string control boundaries and lowercase unicode hex', () => {
    expect(parse('{"v":" "}')).toMatchObject({ kind: 'accepted' });
    expect(parse('{"v":"\x7f"}')).toMatchObject({ kind: 'accepted' });
    expect(parse('{"v":"\\u00af"}')).toMatchObject({ kind: 'accepted' });
    expect(parsePpjA1JsonBytes(utf8StringDocument([0x1f]))).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_SCHEMA_UNREADABLE'
    });
  });

  it('decodes uppercase JSON unicode escapes without losing their scalar value', () => {
    const result = parse(`{"v":"${String.fromCharCode(0x5c)}u004A"}`);

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected an accepted uppercase JSON unicode escape');
    }
    expect(requireProperty(result.root, 'v')).toMatchObject({ kind: 'string', value: 'J' });
  });

  it('decodes valid UTF-8 strings while retaining numeric raw lexemes', () => {
    const result = parsePpjA1JsonBytes(new Uint8Array([
      0x7b, 0x22, 0x6e, 0x61, 0x6d, 0x65, 0x22, 0x3a, 0x22, 0xe2, 0x9c, 0x93, 0x22, 0x2c, 0x22,
      0x78, 0x4d, 0x6d, 0x22, 0x3a, 0x2d, 0x30, 0x7d
    ]));

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected accepted parse');
    }
    expect(requireProperty(result.root, 'name')).toMatchObject({ kind: 'string', value: '✓' });
    expect(requireProperty(result.root, 'xMm')).toMatchObject({ kind: 'number', lexeme: '-0' });
  });

  it('retains two-, three- and four-byte UTF-8 scalar values', () => {
    const result = parsePpjA1JsonBytes(utf8StringDocument([0xc3, 0xa9, 0xe2, 0x9c, 0x93, 0xf0, 0x9f, 0x98, 0x80]));

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected an accepted UTF-8 JSON object');
    }
    expect(requireProperty(result.root, 'v')).toMatchObject({ kind: 'string', value: 'é✓😀' });
  });

  it.each([
    { contentBytes: [0xc0, 0x80] },
    { contentBytes: [0xc1, 0xbf, 0xbf] },
    { contentBytes: [0xc1, 0xbf, 0xbf, 0xbf] },
    { contentBytes: [0xc2, 0x20] },
    { contentBytes: [0xe0, 0x80, 0x80] },
    { contentBytes: [0xed, 0xa0, 0x80] },
    { contentBytes: [0xed, 0xbf, 0xbf] },
    { contentBytes: [0xf0, 0x9f, 0x98] },
    { contentBytes: [0xf4, 0x90, 0x80, 0x80] }
  ])('rejects invalid UTF-8 scalar bytes: $contentBytes', ({ contentBytes }) => {
    expect(parsePpjA1JsonBytes(utf8StringDocument(contentBytes))).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_SCHEMA_UNREADABLE'
    });
  });

  it('defensively rejects a raw member above the upstream 10 MiB envelope', () => {
    expect(parsePpjA1JsonBytes(new Uint8Array(MAXIMUM_PPJ_A1_JSON_BYTES + 1))).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PROJECT_LIMIT'
    });
  });

  it('parses an almost-10-MiB ASCII member without a decoded-document copy', () => {
    const bytes = new Uint8Array(MAXIMUM_PPJ_A1_JSON_BYTES);
    bytes.fill(0x20);
    bytes[bytes.length - 1] = 0x30;

    expect(parsePpjA1JsonBytes(bytes)).toMatchObject({ kind: 'accepted' });
  });

  it.each([
    ['nine nested containers', `${'['.repeat(9)}0${']'.repeat(9)}`],
    ['thirty-three members of one object', objectWithNumericProperties(33)],
    ['the 1,025th element of one array', `[${Array.from({ length: 1025 }, () => '0').join(',')}]`],
    ['a 129-byte reconstructed pointer', `{"${'a'.repeat(128)}":0}`],
    ['a decoded JSON string above 4 KiB', `{"name":"${'a'.repeat(4097)}"}`],
    ['a raw numeric token above 64 bytes', `{"xMm":1${'0'.repeat(64)}}`]
  ])('rejects %s as BACKUP_PROJECT_LIMIT', (_label, document) => {
    expect(parse(document)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it.each([
    ['eight nested containers', `${'['.repeat(8)}0${']'.repeat(8)}`],
    ['thirty-two members of one object', objectWithNumericProperties(32)],
    ['1,024 elements of one array', `[${Array.from({ length: 1024 }, () => '0').join(',')}]`],
    ['a 128-byte reconstructed pointer', `{"${'a'.repeat(127)}":0}`],
    ['a decoded JSON string of exactly 4 KiB', `{"name":"${'a'.repeat(4096)}"}`],
    ['a raw numeric token of exactly 64 bytes', `{"xMm":1${'0'.repeat(63)}}`]
  ])('accepts the inclusive AST-R1 boundary for %s', (_label, document) => {
    expect(parse(document)).toMatchObject({ kind: 'accepted' });
  });

  it('reconstructs the inclusive 128-byte pointer rather than only admitting it', () => {
    const memberName = 'a'.repeat(127);
    const result = parse(`{"${memberName}":0}`);

    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') {
      throw new Error('Expected an accepted boundary object');
    }
    expect(reconstructPpjA1JsonPointer(requireProperty(result.root, memberName))).toBe(`/${memberName}`);
  });

  it('counts array-index, escaped and UTF-8 pointer segments before retaining a child', () => {
    const arrayMemberName = 'a'.repeat(125);
    const arrayResult = parse(`{"${arrayMemberName}":[0]}`);

    expect(arrayResult.kind).toBe('accepted');
    if (arrayResult.kind !== 'accepted') {
      throw new Error('Expected an accepted array pointer boundary');
    }
    const array = requireProperty(arrayResult.root, arrayMemberName);
    expect(array.kind).toBe('array');
    if (array.kind !== 'array') {
      throw new Error('Expected an array pointer boundary value');
    }
    expect(reconstructPpjA1JsonPointer(array.values[0])).toBe(`/${arrayMemberName}/0`);
    expect(parse(`{"${'a'.repeat(126)}":[0]}`)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PROJECT_LIMIT'
    });

    const slashName = `${'/'.repeat(62)}a`;
    const slashResult = parse(`{"${slashName}":[0]}`);
    expect(slashResult.kind).toBe('accepted');
    if (slashResult.kind !== 'accepted') {
      throw new Error('Expected an accepted slash-escaped pointer boundary');
    }
    const slashArray = requireProperty(slashResult.root, slashName);
    expect(slashArray.kind).toBe('array');
    if (slashArray.kind !== 'array') {
      throw new Error('Expected a slash-escaped pointer boundary array');
    }
    expect(reconstructPpjA1JsonPointer(slashArray.values[0])).toBe(`/${'~1'.repeat(62)}a/0`);
    expect(parse(`{"${slashName}a":[0]}`)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PROJECT_LIMIT'
    });

    const escapedUnicodeName = `${'~'.repeat(62)}éa`;
    const escapedUnicodeJsonName = `${'~'.repeat(62)}\\u00e9a`;
    const escapedUnicodeResult = parse(`{"${escapedUnicodeJsonName}":0}`);
    expect(escapedUnicodeResult.kind).toBe('accepted');
    if (escapedUnicodeResult.kind !== 'accepted') {
      throw new Error('Expected an accepted escaped UTF-8 pointer boundary');
    }
    expect(reconstructPpjA1JsonPointer(requireProperty(escapedUnicodeResult.root, escapedUnicodeName))).toBe(
      `/${'~0'.repeat(62)}éa`
    );
    expect(parse(`{"${escapedUnicodeJsonName}a":0}`)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PROJECT_LIMIT'
    });
  });

  it.each([
    {
      label: 'U+007F',
      memberName: String.fromCharCode(0x7f).repeat(127),
      memberNameBytes: Array.from({ length: 127 }, () => 0x7f)
    },
    {
      label: 'U+07FF',
      memberName: [String.fromCharCode(0x7ff).repeat(63), 'a'].join(''),
      memberNameBytes: [...Array.from({ length: 63 }, () => [0xdf, 0xbf]), [0x61]].flat()
    },
    {
      label: 'U+0800',
      memberName: [String.fromCharCode(0x800).repeat(42), 'a'].join(''),
      memberNameBytes: [...Array.from({ length: 42 }, () => [0xe0, 0xa0, 0x80]), [0x61]].flat()
    },
    {
      label: 'U+10000',
      memberName: [String.fromCodePoint(0x10000).repeat(31), 'aaa'].join(''),
      memberNameBytes: [...Array.from({ length: 31 }, () => [0xf0, 0x90, 0x80, 0x80]), [0x61, 0x61, 0x61]].flat()
    },
    {
      label: 'U+10FFFF',
      memberName: [String.fromCodePoint(0x10ffff).repeat(31), 'aaa'].join(''),
      memberNameBytes: [...Array.from({ length: 31 }, () => [0xf4, 0x8f, 0xbf, 0xbf]), [0x61, 0x61, 0x61]].flat()
    }
  ])('counts JSON Pointer UTF-8 bytes at the 128-byte boundary: $label', ({ memberName, memberNameBytes }) => {
    const accepted = parsePpjA1JsonBytes(utf8ObjectMemberDocument(memberNameBytes));

    expect(accepted.kind).toBe('accepted');
    if (accepted.kind !== 'accepted') {
      throw new Error('Expected accepted UTF-8 pointer boundary');
    }
    expect(reconstructPpjA1JsonPointer(requireProperty(accepted.root, memberName))).toBe(['/', memberName].join(''));

    expect(parsePpjA1JsonBytes(utf8ObjectMemberDocument([...memberNameBytes, 0x61]))).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PROJECT_LIMIT'
    });
  });

  it('rejects the aggregate decoded-string cap only after the inclusive 4 MiB boundary', () => {
    const fourKiBString = `"${'a'.repeat(4096)}"`;
    const atLimit = `{"a":[${Array.from({ length: 1023 }, () => fourKiBString).join(',')}],"b":"${'a'.repeat(4094)}"}`;
    const overLimit = `{"a":[${Array.from({ length: 1023 }, () => fourKiBString).join(',')}],"b":"${'a'.repeat(4095)}"}`;

    expect(parse(atLimit)).toMatchObject({ kind: 'accepted' });
    expect(parse(overLimit)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('rejects the aggregate member-record cap only after its inclusive boundary', () => {
    expect(parse(aggregateMemberDocument(22))).toMatchObject({ kind: 'accepted' });
    expect(parse(aggregateMemberDocument(23))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('rejects the aggregate array-edge cap only after its inclusive boundary', () => {
    expect(parse(aggregateArrayDocument(23))).toMatchObject({ kind: 'accepted' });
    expect(parse(aggregateArrayDocument(24))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('rejects the 65,537th value node without first exceeding another AST-R1 cap', () => {
    expect(parse(nodeBudgetDocument(false))).toMatchObject({ kind: 'accepted' });
    expect(parse(nodeBudgetDocument(true))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
  });

  it('uses the source-owned retained-metadata formula', () => {
    const rawNumericLexemeBytes = MAXIMUM_PPJ_A1_AST_NODES * 64;
    const measured = calculatePpjA1AstMetadataBytes({
      arrayElements: MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS,
      decodedStringBytes: 4 * 1024 * 1024,
      memberRecords: 49_152,
      pointerLinks: MAXIMUM_PPJ_A1_AST_NODES,
      rawNumericLexemeBytes,
      valueNodes: MAXIMUM_PPJ_A1_AST_NODES
    });

    expect(measured).toBe(
      48 * MAXIMUM_PPJ_A1_AST_NODES +
        32 * 49_152 +
        8 * MAXIMUM_PPJ_A1_AST_ARRAY_ELEMENTS +
        16 * MAXIMUM_PPJ_A1_AST_NODES +
        4 * 1024 * 1024 +
        rawNumericLexemeBytes +
        8_320
    );
    expect(measured).toBeLessThanOrEqual(MAXIMUM_PPJ_A1_AST_METADATA_BYTES);
  });

  it('gives a duplicate name precedence over that name\'s member-capacity crossing', () => {
    const members = Array.from({ length: 32 }, (_, index) => `"k${index}":0`);
    const document = `{${[...members, '"k0":0'].join(',')}}`;

    expect(parse(document)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('reserves a unique member edge and its pointer bound before reading a colon or value', () => {
    expect(parse(`{"${'a'.repeat(128)}"`)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PROJECT_LIMIT'
    });
  });

  it('gives malformed JSON precedence over a speculative 1,025th array edge', () => {
    const document = `[${Array.from({ length: 1024 }, () => '0').join(',')},]`;

    expect(parse(document)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });

  it('stops at an incrementally crossed string cap before a later unterminated-string fault', () => {
    expect(parse(`{"name":"${'a'.repeat(4097)}`)).toEqual({
      kind: 'rejected',
      reasonCode: 'BACKUP_PROJECT_LIMIT'
    });
  });
});
