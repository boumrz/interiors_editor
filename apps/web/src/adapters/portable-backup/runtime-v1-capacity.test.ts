import { describe, expect, it } from '@rstest/core';
import { decodeRuntimeV1Utf16, encodeRuntimeV1Utf16, RUNTIME_V1_LIMITS, runtimeV1Pointer, scanRuntimeV1Json } from './runtime-v1-raw-scanner';
const utf8 = (text: string) => new TextEncoder().encode(text);
const reject = (text: string, reasonCode = 'BACKUP_SCHEMA_UNREADABLE') => {
  expect(scanRuntimeV1Json(utf8(text))).toEqual({ kind: 'rejected', reasonCode });
};
const list = (count: number, value = '0') => `[${Array.from({ length: count }, () => value).join(',')}]`;
describe('V1 byte scanner admission', () => {
  it('retains parent links, source spans, numeric tokens, string escapes and metrics', () => {
    const text = ' \n{"a/b~c":[-0,true,false,null,"\\b\\f\\n\\r\\t\\/\\\\\\"\\u0041é😀"]}\r\t';
    const result = scanRuntimeV1Json(utf8(text));
    expect(result.kind).toBe('scanned');
    if (result.kind !== 'scanned' || result.root.kind !== 'object') throw new Error('not object');
    const array = result.root.members.get('a/b~c');
    if (array?.kind !== 'array') throw new Error('not array');
    expect(runtimeV1Pointer(result.root)).toBe('');
    expect(runtimeV1Pointer(array.elements[0])).toBe('/a~1b~0c/0');
    expect(array.elements[0]).toMatchObject({ kind: 'number', raw: '-0', start: text.indexOf('-0'), end: text.indexOf('-0') + 2 });
    expect(array.elements[4]).toMatchObject({ kind: 'string', value: '\b\f\n\r\t/\\"Aé😀' });
    expect(result.metrics).toMatchObject({ valueNodes: 7, pointerLinks: 7, memberRecords: 1, arrayElements: 5, maximumDepth: 2, numericLexemeBytes: 2 });
    expect(result.metrics.projectBytes).toBe(utf8(text).length);
    expect(result.metrics.metadataBytes).toBe(48 * 7 + 32 + 8 * 5 + 16 * 7 + result.metrics.decodedCharge + 2 + 8320 + 512);
  });
  it.each(['', '\ufeff{}', '{', '[', '"', '"\n"', '"\\q"', '"\\u000x"', '"\\u0"', 'tru', 'True', 'undefined', 'NaN', 'Infinity', '+1', '--1', '01', '-01', '1.', '1e', '1e+', '[0,]', '{"a":}', '{"a" 1}', '{"a":1,}', '{}x', '{"a":1,"\\u0061":2}'])('rejects malformed input %s', text => reject(text));
  it.each([
    [0x22, 0xc0, 0x80, 0x22], [0x22, 0xed, 0xa0, 0x80, 0x22], [0x22, 0xf4, 0x90, 0x80, 0x80, 0x22],
    [0x22, 0x80, 0x22], [0x22, 0xc2], [0x22, 0xe0, 0x80, 0x80, 0x22], [0x22, 0xf0, 0x80, 0x80, 0x80, 0x22], [0x22, 0xc2, 0x41, 0x22], [0xff]
  ].map(bytes => ({ bytes })))('rejects invalid UTF8 at its traversal event', ({ bytes }) => {
    expect(scanRuntimeV1Json(new Uint8Array(bytes))).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' });
  });
  it('admits inclusive array, object, depth, pointer, numeric and string limits', () => {
    for (const text of [list(1024), `{${Array.from({ length: 32 }, (_, i) => `"k${i}":0`).join(',')}}`, `${'['.repeat(8)}0${']'.repeat(8)}`,
      `{"${'a'.repeat(127)}":0}`, '1'.repeat(64), JSON.stringify('a'.repeat(1365))]) {
      expect(scanRuntimeV1Json(utf8(text)).kind).toBe('scanned');
    }
    for (const text of [list(1025), `{${Array.from({ length: 33 }, (_, i) => `"k${i}":0`).join(',')}}`, `${'['.repeat(9)}0${']'.repeat(9)}`,
      `{"${'a'.repeat(128)}":0}`, '1'.repeat(65), JSON.stringify('a'.repeat(1366))]) reject(text, 'BACKUP_PROJECT_LIMIT');
  });
  it('checks raw size before syntax, including its exact boundary', () => {
    const max = RUNTIME_V1_LIMITS.bytes;
    expect(scanRuntimeV1Json(utf8(`0${' '.repeat(max - 1)}`)).kind).toBe('scanned');
    reject(`?${' '.repeat(max)}`, 'BACKUP_PROJECT_LIMIT');
  });
  it('preserves event precedence: same-event syntax/duplicate before capacity, earlier capacity before late UTF8', () => {
    const members = Array.from({ length: 32 }, (_, i) => `"k${i}":0`).join(',');
    reject(`{${members},"k0":0}`);
    reject(`[${Array.from({ length: 1024 }, () => '0').join(',')},?]`);
    const earlyCapacity = utf8(`[${Array.from({ length: 1025 }, () => '0').join(',')},"`);
    const bytes = new Uint8Array(earlyCapacity.length + 2); bytes.set(earlyCapacity); bytes.set([0xff, 34], earlyCapacity.length);
    expect(scanRuntimeV1Json(bytes)).toEqual({ kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' });
    reject(`{${members},"new":?}`, 'BACKUP_PROJECT_LIMIT');
    for (const suffix of ['.', 'e', 'e+', 'e-']) reject('1'.repeat(64) + suffix);
    reject(`${'1'.repeat(65)}.`, 'BACKUP_PROJECT_LIMIT');
  });
  it('enforces aggregate array elements, members, decoded charge and retained metadata', () => {
    expect(scanRuntimeV1Json(utf8(list(24, list(1023)))).kind).toBe('scanned');
    reject(list(25, list(1024)), 'BACKUP_PROJECT_LIMIT');
    const record = `{${Array.from({ length: 32 }, (_, i) => `"k${i}":0`).join(',')}}`;
    reject(list(2, list(800, record)), 'BACKUP_PROJECT_LIMIT');
    reject(list(3, list(1024, JSON.stringify('x'.repeat(1365)))), 'BACKUP_PROJECT_LIMIT');
  });
  it.each(['2AB', '2AA=', '2A', '', 'AA', 'AAA', 'AGE', '2ADcAA', '!!!!', '2AA\n', '2AA+', 'A'.repeat(684)])('rejects malformed or redundant UTF16 wrappers %s', payload => {
    reject(`{"utf16be":${JSON.stringify(payload)}}`);
  });
  it('checks closed wrappers before materialization and round-trips exact code units at both sizes', () => {
    for (const value of ['\ud800', '\udfff', '😀\ud800A\udfff', '\ud800'.repeat(256)]) {
      const payload = encodeRuntimeV1Utf16(value);
      expect(decodeRuntimeV1Utf16(payload)).toBe(value);
      expect(scanRuntimeV1Json(utf8(`{"utf16be":"${payload}"}`)).kind).toBe('scanned');
    }
    reject('{"utf16be":"2AA","extra":0}');
    reject('{"utf16be":true}');
    expect(scanRuntimeV1Json(utf8('"\\ud800"'), 'legacy').kind).toBe('scanned');
  });
});
