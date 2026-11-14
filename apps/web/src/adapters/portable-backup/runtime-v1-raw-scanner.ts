/** Separate V1-only byte scanner. It neither selects an archive route nor accepts a Project. */
export const RUNTIME_V1_LIMITS = Object.freeze({
  bytes: 10 * 1024 * 1024, depth: 8, nodes: 65_536, members: 49_152,
  membersPerObject: 32, elements: 24_576, elementsPerArray: 1_024,
  pointerBytes: 128, numericBytes: 64, stringCharge: 4 * 1024,
  decodedCharge: 8 * 1024 * 1024, metadataBytes: 16 * 1024 * 1024
});
export type RuntimeV1Rejection = { readonly kind: 'rejected'; readonly reasonCode: 'BACKUP_SCHEMA_UNREADABLE' | 'BACKUP_PROJECT_LIMIT' };
export type RuntimeV1Metrics = {
  readonly valueNodes: number; readonly memberRecords: number; readonly arrayElements: number;
  readonly pointerLinks: number; readonly decodedCharge: number; readonly numericLexemeBytes: number;
  readonly metadataBytes: number; readonly maximumDepth: number; readonly maximumPointerBytes: number;
  readonly projectBytes: number;
};
type Link = { readonly parent: RuntimeV1Node; readonly segment: string | number } | undefined;
type Base = { readonly link: Link; readonly start: number; end: number };
export type RuntimeV1Node = Base & (
  | { readonly kind: 'object'; readonly members: ReadonlyMap<string, RuntimeV1Node> }
  | { readonly kind: 'array'; readonly elements: readonly RuntimeV1Node[] }
  | { readonly kind: 'number'; readonly raw: string }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'literal'; readonly value: boolean | null }
);
export type RuntimeV1ScanResult = { readonly kind: 'scanned'; readonly root: RuntimeV1Node; readonly metrics: RuntimeV1Metrics } | RuntimeV1Rejection;
export class RuntimeV1Fault extends Error {
  constructor(readonly reasonCode: RuntimeV1Rejection['reasonCode']) { super(reasonCode); }
}
export const unreadable = (): never => { throw new RuntimeV1Fault('BACKUP_SCHEMA_UNREADABLE'); };
const capacity = (): never => { throw new RuntimeV1Fault('BACKUP_PROJECT_LIMIT'); };
const encoder = new TextEncoder();
const onlyAscii = (value: string) => [...value].every(character => character.charCodeAt(0) < 128);
const ascii = (n: number | undefined) => n !== undefined && n >= 0x30 && n <= 0x39;
const hex = (n: number | undefined): number => {
  if (n !== undefined && n >= 48 && n <= 57) return n - 48;
  if (n !== undefined && n >= 65 && n <= 70) return n - 55;
  if (n !== undefined && n >= 97 && n <= 102) return n - 87;
  return unreadable();
};
export function containsLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  }
  return false;
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function encodeRuntimeV1Utf16(value: string): string {
  let result = '';
  let bits = 0;
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    for (const byte of [unit >>> 8, unit & 255]) {
      bits = (bits << 8) | byte;
      count += 8;
      while (count >= 6) { count -= 6; result += alphabet[(bits >>> count) & 63]; }
    }
  }
  if (count) result += alphabet[(bits << (6 - count)) & 63];
  return result;
}
export function decodeRuntimeV1Utf16(payload: string): string {
  // Bound before allocating any decoded wrapper bytes. At most 512 transient bytes.
  if (payload.length < 3 || payload.length > 683 || !/^[A-Za-z0-9_-]+$/.test(payload)) return unreadable();
  const byteLength = Math.floor(payload.length * 6 / 8);
  if (byteLength < 2 || byteLength > 512 || byteLength % 2 !== 0) return unreadable();
  const tail = payload.length % 4;
  const last = alphabet.indexOf(payload[payload.length - 1]);
  if (tail === 1 || (tail === 2 && (last & 15) !== 0) || (tail === 3 && (last & 3) !== 0)) return unreadable();
  let bits = 0;
  let count = 0;
  let high: number | undefined;
  let result = '';
  for (const character of payload) {
    bits = (bits << 6) | alphabet.indexOf(character);
    count += 6;
    if (count >= 8) {
      count -= 8;
      const byte = (bits >>> count) & 255;
      if (high === undefined) high = byte;
      else { result += String.fromCharCode((high << 8) | byte); high = undefined; }
    }
  }
  if (encodeRuntimeV1Utf16(result) !== payload || !containsLoneSurrogate(result)) return unreadable();
  return result;
}
export function runtimeV1Pointer(node: RuntimeV1Node): string {
  const parts: string[] = [];
  let link = node.link;
  while (link) { parts.push(String(link.segment).replace(/~/g, '~0').replace(/\//g, '~1')); link = link.parent.link; }
  return parts.reverse().map(part => `/${part}`).join('');
}
export function scanRuntimeV1Json(bytes: Uint8Array, mode: 'wire' | 'legacy' = 'wire'): RuntimeV1ScanResult {
  if (bytes.byteLength > RUNTIME_V1_LIMITS.bytes) return { kind: 'rejected', reasonCode: 'BACKUP_PROJECT_LIMIT' };
  try { return new Scanner(bytes, mode).scan(); }
  catch (error) {
    if (error instanceof RuntimeV1Fault) return { kind: 'rejected', reasonCode: error.reasonCode };
    throw error;
  }
}
class Scanner {
  private cursor = 0;
  private depth = 0;
  private nodes = 0;
  private members = 0;
  private elements = 0;
  private charge = 0;
  private numericBytes = 0;
  private maximumDepth = 0;
  private maximumPointerBytes = 0;
  private pendingWrapperSchemaFault = false;
  constructor(private readonly bytes: Uint8Array, private readonly mode: 'wire' | 'legacy') {}
  scan(): RuntimeV1ScanResult {
    this.whitespace();
    const root = this.value(undefined);
    this.whitespace();
    if (this.peek() !== undefined) return unreadable();
    if (this.pendingWrapperSchemaFault) return unreadable();
    return { kind: 'scanned', root, metrics: this.metrics() };
  }
  private metrics(): RuntimeV1Metrics {
    return { valueNodes: this.nodes, memberRecords: this.members, arrayElements: this.elements,
      pointerLinks: this.nodes, decodedCharge: this.charge, numericLexemeBytes: this.numericBytes,
      metadataBytes: 48 * this.nodes + 32 * this.members + 8 * this.elements + 16 * this.nodes + this.charge + this.numericBytes + 8320 + 512,
      maximumDepth: this.maximumDepth, maximumPointerBytes: this.maximumPointerBytes, projectBytes: this.bytes.byteLength };
  }
  private check(): void {
    if (this.nodes > RUNTIME_V1_LIMITS.nodes || this.members > RUNTIME_V1_LIMITS.members
      || this.elements > RUNTIME_V1_LIMITS.elements || this.charge > RUNTIME_V1_LIMITS.decodedCharge
      || this.metrics().metadataBytes > RUNTIME_V1_LIMITS.metadataBytes) capacity();
  }
  private pointer(link: Link): void {
    let length = 0;
    while (link) {
      length += 1 + encoder.encode(String(link.segment).replace(/~/g, '~0').replace(/\//g, '~1')).byteLength;
      link = link.parent.link;
    }
    if (length > RUNTIME_V1_LIMITS.pointerBytes) capacity();
    this.maximumPointerBytes = Math.max(this.maximumPointerBytes, length);
  }
  private admit(link: Link, charge = 0, numericBytes = 0): void {
    this.pointer(link);
    this.nodes++;
    if (link && typeof link.segment === 'number') {
      if (link.segment >= RUNTIME_V1_LIMITS.elementsPerArray) capacity();
      this.elements++;
    }
    this.charge += charge;
    this.numericBytes += numericBytes;
    this.check();
  }
  private value(link: Link): RuntimeV1Node {
    const start = this.cursor;
    const byte = this.peek();
    if (byte === 123 || byte === 91) {
      this.cursor++;
      if (++this.depth > RUNTIME_V1_LIMITS.depth) return capacity();
      this.maximumDepth = Math.max(this.maximumDepth, this.depth);
      this.admit(link);
      if (byte === 123) {
        const members = new Map<string, RuntimeV1Node>();
        const node: RuntimeV1Node = { kind: 'object', members, link, start, end: start };
        this.whitespace();
        if (!this.take(125)) {
          for (;;) {
            const key = this.string();
            if (members.has(key)) return unreadable(); // duplicate wins on the same admission event
            const childLink = { parent: node, segment: key };
            this.pointer(childLink);
            if (members.size >= RUNTIME_V1_LIMITS.membersPerObject) return capacity();
            this.members++;
            this.charge += onlyAscii(key) ? key.length : 3 * key.length;
            this.check();
            this.whitespace(); this.consume(58); this.whitespace();
            members.set(key, this.value(childLink));
            this.whitespace();
            if (this.take(125)) break;
            this.consume(44); this.whitespace();
          }
        }
        if (this.mode === 'wire' && members.has('utf16be')) {
          try {
            const payload = members.get('utf16be');
            if (members.size !== 1 || payload?.kind !== 'string') this.pendingWrapperSchemaFault = true;
            else {
              this.charge += 3 * decodeRuntimeV1Utf16(payload.value).length;
              this.check();
            }
          } catch (error) {
            // Closed grammar is evaluated after raw traversal. Keep scanning so
            // later raw capacity/syntax events retain the source-owned order.
            if (error instanceof RuntimeV1Fault && error.reasonCode === 'BACKUP_SCHEMA_UNREADABLE') this.pendingWrapperSchemaFault = true;
            else throw error;
          }
        }
        node.end = this.cursor;
        this.depth--;
        return node;
      }
      const elements: RuntimeV1Node[] = [];
      const node: RuntimeV1Node = { kind: 'array', elements, link, start, end: start };
      this.whitespace();
      if (!this.take(93)) {
        for (;;) {
          elements.push(this.value({ parent: node, segment: elements.length }));
          this.whitespace();
          if (this.take(93)) break;
          this.consume(44); this.whitespace();
        }
      }
      node.end = this.cursor;
      this.depth--;
      return node;
    }
    if (byte === 34) {
      const value = this.string();
      const payload = this.mode === 'wire' && link?.segment === 'utf16be' && onlyAscii(value);
      this.admit(link, payload ? value.length : 3 * value.length);
      return { kind: 'string', value, link, start, end: this.cursor };
    }
    if (byte === 45 || ascii(byte)) {
      const raw = this.number();
      this.admit(link, 0, raw.length);
      return { kind: 'number', raw, link, start, end: this.cursor };
    }
    for (const [text, value] of [['true', true], ['false', false], ['null', null]] as const) {
      if (byte === text.charCodeAt(0)) {
        for (const character of text) this.consume(character.charCodeAt(0));
        this.admit(link, text.length);
        return { kind: 'literal', value, link, start, end: this.cursor };
      }
    }
    return unreadable();
  }
  private string(): string {
    this.consume(34);
    let result = '';
    while (true) {
      const byte = this.peek();
      if (byte === 34) { this.cursor++; return result; }
      if (byte === undefined || byte < 32) return unreadable();
      let text: string;
      if (byte === 92) {
        this.cursor++;
        const escaped = this.peek();
        this.cursor++;
        const simple = new Map([[34, '"'], [92, '\\'], [47, '/'], [98, '\b'], [102, '\f'], [110, '\n'], [114, '\r'], [116, '\t']]);
        if (escaped === 117) {
          let unit = 0;
          for (let i = 0; i < 4; i++) { unit = (unit << 4) | hex(this.peek()); this.cursor++; }
          text = String.fromCharCode(unit);
        } else {
          const value = escaped === undefined ? undefined : simple.get(escaped);
          if (value === undefined) return unreadable();
          text = value;
        }
      } else if (byte < 128) { this.cursor++; text = String.fromCharCode(byte); }
      else text = this.utf8();
      // UTF-16 strings are bounded during traversal, before retention.
      if (3 * (result.length + text.length) > RUNTIME_V1_LIMITS.stringCharge) return capacity();
      result += text;
    }
  }
  private utf8(): string {
    const first = this.peek();
    if (first === undefined) return unreadable();
    const width = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
    if (!width) return unreadable();
    let code = first & (width === 2 ? 31 : width === 3 ? 15 : 7);
    for (let i = 1; i < width; i++) {
      const next = this.bytes[this.cursor + i];
      if (next === undefined || (next & 0xc0) !== 0x80) return unreadable();
      code = (code << 6) | (next & 63);
    }
    if (code < (width === 2 ? 128 : width === 3 ? 2048 : 65536) || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return unreadable();
    this.cursor += width;
    return String.fromCodePoint(code);
  }
  private number(): string {
    const start = this.cursor;
    const consume = () => { this.cursor++; if (this.cursor - start > RUNTIME_V1_LIMITS.numericBytes) capacity(); };
    if (this.peek() === 45) consume();
    if (this.peek() === 48) {
      consume();
      if (ascii(this.peek())) return unreadable();
    }
    else {
      const first = this.peek();
      if (first === undefined || first < 49 || first > 57) return unreadable();
      do { consume(); } while (ascii(this.peek()));
    }
    if (this.peek() === 46) {
      if (!ascii(this.bytes[this.cursor + 1])) return unreadable();
      consume(); do { consume(); } while (ascii(this.peek()));
    }
    if (this.peek() === 101 || this.peek() === 69) {
      const next = this.bytes[this.cursor + 1];
      const offset = next === 43 || next === 45 ? 2 : 1;
      if (!ascii(this.bytes[this.cursor + offset])) return unreadable();
      consume(); if (this.peek() === 43 || this.peek() === 45) consume();
      do { consume(); } while (ascii(this.peek()));
    }
    let result = '';
    for (let i = start; i < this.cursor; i++) result += String.fromCharCode(this.bytes[i]);
    return result;
  }
  private peek(): number | undefined { return this.bytes[this.cursor]; }
  private take(byte: number): boolean { if (this.peek() !== byte) return false; this.cursor++; return true; }
  private consume(byte: number): void { if (!this.take(byte)) unreadable(); }
  private whitespace(): void { while (this.peek() === 32 || this.peek() === 9 || this.peek() === 10 || this.peek() === 13) this.cursor++; }
}
