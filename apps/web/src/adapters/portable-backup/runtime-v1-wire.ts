import type { Project, SchematicAssetInstance } from '../../domain/project';
import type { ItemColorVariantId } from '../../domain/item-color-variant';
import { containsLoneSurrogate, decodeRuntimeV1Utf16, encodeRuntimeV1Utf16, RUNTIME_V1_LIMITS,
  RuntimeV1Fault, scanRuntimeV1Json, unreadable, type RuntimeV1Metrics, type RuntimeV1Node, type RuntimeV1Rejection } from './runtime-v1-raw-scanner';

export const RUNTIME_V1_SCHEMA_ID = 'interiors.project/runtime-v1-wire' as const;
export const RUNTIME_V1_FLOOR_YAW_SCHEMA_ID = 'interiors.project/runtime-v1-floor-yaw' as const;
export type RegisteredRuntimeV1SchemaId = typeof RUNTIME_V1_SCHEMA_ID | typeof RUNTIME_V1_FLOOR_YAW_SCHEMA_ID;
export type RegisteredRuntimeV1EncodeResult =
  | (Extract<RuntimeV1EncodeResult, { readonly kind: 'encoded' }> & { readonly projectSchemaId: RegisteredRuntimeV1SchemaId })
  | RuntimeV1Rejection;

export function isRegisteredRuntimeV1SchemaId(id: string): id is RegisteredRuntimeV1SchemaId {
  return id === RUNTIME_V1_SCHEMA_ID || id === RUNTIME_V1_FLOOR_YAW_SCHEMA_ID;
}
export type RuntimeV1VariantValue = ItemColorVariantId | readonly [RuntimeV1VariantValue];
type ExactItem<T> = T extends SchematicAssetInstance ? Omit<T, 'colorVariantId'> & { readonly colorVariantId?: RuntimeV1VariantValue } : never;
/** Wider than Project deliberately: the registered historical guard accepted singleton variant arrays. */
export type RuntimeV1Project = Omit<Project, 'assetInstances'> & { readonly assetInstances: readonly ExactItem<SchematicAssetInstance>[] };
export type RuntimeV1DecodeResult = { readonly kind: 'decoded'; readonly project: RuntimeV1Project; readonly metrics: RuntimeV1Metrics } | RuntimeV1Rejection;
export type RuntimeV1EncodeResult = { readonly kind: 'encoded'; readonly bytes: Uint8Array; readonly metrics: RuntimeV1Metrics } | RuntimeV1Rejection;
type Read = (node: RuntimeV1Node) => unknown;
type RecordValue = Record<string, unknown>;
const utf8 = new TextEncoder();
const colors: Readonly<Record<string, string>> = { 'alpha-warm-wood': '#a76a3b', 'alpha-blue': '#416b91',
  'alpha-violet': '#716796', 'alpha-walnut': '#8c6e4c', 'alpha-terracotta': '#835a45', 'alpha-forest': '#536d62', 'alpha-berry': '#8a4f54' };
const rootKeys = ['schemaVersion', 'projectId', 'name', 'createdAt', 'updatedAt', 'lifecycle', 'level', 'assetInstances', 'assetDefinitionRefs'];
const levelKeys = ['levelId', 'vertices', 'wallSegments', 'rooms', 'openings'];
const sourceKeys = new Set([...rootKeys, ...levelKeys, 'vertexId', 'xMm', 'zMm', 'wallSegmentId', 'startVertexId', 'endVertexId', 'thicknessMm',
  'roomId', 'faceFingerprint', 'heightMm', 'type', 'openingId', 'offsetMm', 'widthMm', 'sillMm', 'kind', 'swingSide',
  'assetInstanceId', 'anchorClass', 'label', 'depthMm', 'color', 'assetDefinitionId', 'colorVariantId', 'elevationMm', 'locked', 'yawRadians', 'yawStep', 'side',
  'displayName', 'byteLength', 'format', 'resourceHash', 'source', 'catalogAssetId', 'catalogVersion', 'catalogEnvelopeHash']);
const reject = (error: unknown): RuntimeV1Rejection => {
  if (error instanceof RuntimeV1Fault) return { kind: 'rejected', reasonCode: error.reasonCode };
  throw error;
};
const number = (min: number, max: number): Read => node => {
  if (node.kind !== 'number' || !/^-?(0|[1-9][0-9]*)$/.test(node.raw)) return unreadable();
  const value = Number(node.raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) return unreadable();
  return value;
};
const finite: Read = node => {
  if (node.kind !== 'number') return unreadable();
  const value = Number(node.raw);
  if (!Number.isFinite(value) || (node.raw !== '-0' && JSON.stringify(value) !== node.raw)) return unreadable();
  return value;
};
const oneOf = (...values: readonly string[]): Read => node => {
  if (node.kind !== 'string' || !values.includes(node.value)) return unreadable();
  return node.value;
};
const hash: Read = node => {
  if (node.kind !== 'string' || !/^[a-fA-F0-9]{64}$/.test(node.value)) return unreadable();
  return node.value;
};
const color: Read = node => {
  if (node.kind !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(node.value)) return unreadable();
  return node.value;
};
const clock: Read = node => {
  if (node.kind !== 'string') return unreadable();
  const date = new Date(node.value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== node.value) return unreadable();
  return node.value;
};
const trueOnly: Read = node => node.kind === 'literal' && node.value === true ? true : unreadable();

class Decoder {
  constructor(private readonly mode: 'wire' | 'legacy', private readonly schemaId: RegisteredRuntimeV1SchemaId) {}
  private string: Read = node => {
    let value: string;
    if (node.kind === 'string') {
      value = node.value;
      if (this.mode === 'wire' && containsLoneSurrogate(value)) return unreadable();
    } else {
      if (this.mode !== 'wire' || node.kind !== 'object' || node.members.size !== 1) return unreadable();
      const payload = node.members.get('utf16be');
      if (payload?.kind !== 'string') return unreadable();
      value = decodeRuntimeV1Utf16(payload.value);
    }
    if (value.length < 1 || value.length > 256) return unreadable();
    return value;
  };
  private trimmedString: Read = node => {
    const value = this.string(node);
    if (typeof value !== 'string' || value.trim() !== value) return unreadable();
    return value;
  };
  private name: Read = node => {
    const value = this.trimmedString(node);
    if (typeof value !== 'string' || containsLoneSurrogate(value)) return unreadable();
    return value;
  };
  private variant: Read = node => {
    if (node.kind === 'array') {
      if (node.elements.length !== 1) return unreadable();
      return [this.variant(node.elements[0])];
    }
    if (node.kind !== 'string' || !Object.hasOwn(colors, node.value)) return unreadable();
    return node.value;
  };
  private record(node: RuntimeV1Node, required: Readonly<Record<string, Read>>, optional: Readonly<Record<string, Read>> = {}): RecordValue {
    if (node.kind !== 'object') return unreadable();
    for (const key of Object.keys(required)) if (!node.members.has(key)) return unreadable();
    const result: RecordValue = {};
    for (const [key, value] of node.members) {
      const requiredRead = Object.hasOwn(required, key) ? required[key] : undefined;
      const optionalRead = Object.hasOwn(optional, key) ? optional[key] : undefined;
      const read = requiredRead ?? optionalRead;
      if (!read) return unreadable();
      const markerNode = value.kind === 'object' ? value.members.get('undefined') : undefined;
      const marker = this.mode === 'wire' && !requiredRead && value.kind === 'object' && value.members.size === 1
        && markerNode?.kind === 'literal' && markerNode.value === true;
      result[key] = marker ? undefined : read(value);
    }
    return result;
  }
  private array(read: Read, max: number): Read {
    return node => {
      if (node.kind !== 'array') return unreadable();
      if (node.elements.length > max) throw new RuntimeV1Fault('BACKUP_PROJECT_LIMIT');
      return node.elements.map(read);
    };
  }
  decode(node: RuntimeV1Node): RuntimeV1Project {
    const string = this.string;
    const allowsPreciseYaw = this.schemaId === RUNTIME_V1_FLOOR_YAW_SCHEMA_ID;
    const floorOrientation: Record<string, Read> = { elevationMm: number(0, 0), yawRadians: finite, yawStep: number(0, 7) };
    if (allowsPreciseYaw) floorOrientation.yawMilliDeg = number(0, 359999);
    const vertex: Read = n => this.record(n, { vertexId: string, xMm: number(-100000, 100000), zMm: number(-100000, 100000) });
    const wall: Read = n => this.record(n, { wallSegmentId: string, startVertexId: string, endVertexId: string, thicknessMm: number(20, 1000) });
    const room: Read = n => this.record(n, { roomId: string, faceFingerprint: string, heightMm: number(500, 10000) },
      { name: string, type: oneOf('bathroom', 'bedroom', 'hallway', 'kitchen', 'living-room', 'office', 'other', 'storage') });
    const opening: Read = n => {
      const result = this.record(n, { openingId: string, wallSegmentId: string, offsetMm: number(0, 100000),
        widthMm: number(1, 100000), heightMm: number(1, 10000), sillMm: number(0, 10000), kind: oneOf('Door', 'Window') }, { swingSide: oneOf('left', 'right') });
      if (result.kind === 'Window' && result.swingSide !== undefined) return unreadable();
      return result;
    };
    const item: Read = n => {
      if (n.kind !== 'object') return unreadable();
      const anchor = n.members.get('anchorClass');
      const common = { assetInstanceId: string, label: string, widthMm: number(1, 100000), depthMm: number(1, 100000), color };
      const optional = { assetDefinitionId: string, colorVariantId: this.variant, locked: trueOnly };
      const result = anchor?.kind === 'string' && anchor.value === 'floor'
        ? this.record(n, { ...common, anchorClass: oneOf('floor'), roomId: string, xMm: number(-100000, 100000), zMm: number(-100000, 100000), heightMm: number(1, 100000) },
          { ...optional, ...floorOrientation })
        : this.record(n, { ...common, anchorClass: oneOf('wall'), wallSegmentId: string, side: oneOf('left', 'right'),
          offsetMm: number(0, 100000), elevationMm: number(0, 10000), heightMm: number(1, 10000) }, optional);
      if (
        Object.hasOwn(result, 'yawMilliDeg') &&
        (result.yawMilliDeg === undefined || Object.hasOwn(result, 'yawStep') || Object.hasOwn(result, 'yawRadians'))
      ) return unreadable();
      if (result.colorVariantId !== undefined) {
        let terminal = result.colorVariantId;
        while (Array.isArray(terminal)) terminal = terminal[0];
        if (typeof terminal !== 'string' || result.assetDefinitionId !== undefined || colors[terminal] !== result.color) return unreadable();
      }
      return result;
    };
    const definition: Read = n => {
      const result = this.record(n, { assetDefinitionId: string, displayName: string, byteLength: number(1, Number.MAX_SAFE_INTEGER),
        widthMm: number(1, 100000), depthMm: number(1, 100000), heightMm: number(1, 100000), format: oneOf('glb'), resourceHash: hash },
      { source: oneOf('CatalogVersion'), catalogAssetId: this.trimmedString, catalogVersion: this.trimmedString, catalogEnvelopeHash: hash });
      const quartet = ['source', 'catalogAssetId', 'catalogVersion', 'catalogEnvelopeHash'].map(key => result[key]);
      if (!quartet.every(value => value === undefined) && !quartet.every(value => value !== undefined)) return unreadable();
      return result;
    };
    const level: Read = n => this.record(n, { levelId: string, vertices: this.array(vertex, 600), wallSegments: this.array(wall, 300),
      rooms: this.array(room, 50), openings: this.array(opening, 200) });
    const rules: Record<string, Read> = { schemaVersion: n => n.kind === 'number' && n.raw === '1' ? 1 : unreadable(), projectId: string,
      name: this.name, createdAt: clock, updatedAt: clock, lifecycle: oneOf('active'), level, assetInstances: this.array(item, 250), assetDefinitionRefs: this.array(definition, 250) };
    if (this.mode === 'wire') rules.projectSchemaId = oneOf(this.schemaId);
    const value = this.record(node, rules);
    delete value.projectSchemaId;
    // Closed validated wire shape, deliberately not a claim of domain Project validity.
    const project = value as RuntimeV1Project;
    if (allowsPreciseYaw && !project.assetInstances.some(item => Object.hasOwn(item, 'yawMilliDeg'))) return unreadable();
    references(project);
    return project;
  }
}
function unique(values: readonly string[]): Set<string> {
  const set = new Set(values);
  if (set.size !== values.length) return unreadable();
  return set;
}
function references(project: RuntimeV1Project): void {
  const level = project.level;
  const vertices = unique(level.vertices.map(v => v.vertexId));
  unique(level.vertices.map(v => `${v.xMm},${v.zMm}`)); // intentionally equates +0 and -0
  const walls = unique(level.wallSegments.map(w => w.wallSegmentId));
  const rooms = unique(level.rooms.map(r => r.roomId));
  unique(level.openings.map(o => o.openingId));
  unique(project.assetInstances.map(i => i.assetInstanceId));
  const definitions = unique(project.assetDefinitionRefs.map(d => d.assetDefinitionId));
  unique(project.assetDefinitionRefs.map(d => d.resourceHash));
  for (const wall of level.wallSegments) if (!vertices.has(wall.startVertexId) || !vertices.has(wall.endVertexId) || wall.startVertexId === wall.endVertexId) unreadable();
  for (const opening of level.openings) if (!walls.has(opening.wallSegmentId)) unreadable();
  for (const item of project.assetInstances) {
    if (item.anchorClass === 'floor' ? !rooms.has(item.roomId) : !walls.has(item.wallSegmentId)) unreadable();
    if (item.assetDefinitionId !== undefined && !definitions.has(item.assetDefinitionId)) unreadable();
  }
}
function decode(bytes: Uint8Array, mode: 'wire' | 'legacy', schemaId: RegisteredRuntimeV1SchemaId = RUNTIME_V1_SCHEMA_ID): RuntimeV1DecodeResult {
  const scanned = scanRuntimeV1Json(bytes, mode);
  if (scanned.kind === 'rejected') return scanned;
  try {
    const project = new Decoder(mode, schemaId).decode(scanned.root);
    if (mode === 'legacy') {
      const historical = utf8.encode(historicalCanonical(project));
      if (historical.length !== bytes.length || historical.some((byte, i) => byte !== bytes[i]) || !legacyWitness(project)) return unreadable();
    }
    return { kind: 'decoded', project, metrics: scanned.metrics };
  } catch (error) { return reject(error); }
}
export const decodeRuntimeV1Project = (bytes: Uint8Array): RuntimeV1DecodeResult => decode(bytes, 'wire');
export const decodeRuntimeV1LegacyProject = (bytes: Uint8Array): RuntimeV1DecodeResult => decode(bytes, 'legacy');
export function decodeRegisteredRuntimeV1Project(bytes: Uint8Array, schemaId: RegisteredRuntimeV1SchemaId): RuntimeV1DecodeResult {
  return decode(bytes, 'wire', schemaId);
}
function legacyWitness(project: RuntimeV1Project): boolean {
  return project.assetInstances.length > 0 || project.assetDefinitionRefs.length > 0
    || project.level.rooms.some(room => room.type !== undefined || !Object.hasOwn(room, 'name') || !/^[a-f0-9]{64}$/.test(room.faceFingerprint));
}
function historicalCanonical(project: RuntimeV1Project): string {
  // Exact historical root/level normalization; internal serializer remains unchanged.
  return JSON.stringify({ schemaVersion: project.schemaVersion, projectId: project.projectId, name: project.name,
    createdAt: project.createdAt, updatedAt: project.updatedAt, lifecycle: project.lifecycle,
    level: { levelId: project.level.levelId, vertices: project.level.vertices, wallSegments: project.level.wallSegments,
      rooms: project.level.rooms, openings: project.level.openings }, assetInstances: project.assetInstances, assetDefinitionRefs: project.assetDefinitionRefs });
}
/** Pure snapshot encoding: no clocks, IDs, storage, checksum or resource access. */
export function encodeRuntimeV1Project(project: unknown): RuntimeV1EncodeResult {
  return encodeMember(project, RUNTIME_V1_SCHEMA_ID);
}

/** Choose the precise-angle member only for snapshots that actually carry that field. */
export function encodeRegisteredRuntimeProject(project: unknown): RegisteredRuntimeV1EncodeResult {
  try {
    const projectSchemaId = hasExactYawField(project) ? RUNTIME_V1_FLOOR_YAW_SCHEMA_ID : RUNTIME_V1_SCHEMA_ID;
    const encoded = encodeMember(project, projectSchemaId);
    return encoded.kind === 'encoded' ? { ...encoded, projectSchemaId } : encoded;
  } catch {
    return { kind: 'rejected', reasonCode: 'BACKUP_SCHEMA_UNREADABLE' };
  }
}

function hasExactYawField(project: unknown): boolean {
  if (typeof project !== 'object' || project === null) return false;
  const items: unknown = Object.getOwnPropertyDescriptor(project, 'assetInstances')?.value;
  if (!Array.isArray(items) || items.length > RUNTIME_V1_LIMITS.elementsPerArray) return false;
  for (let index = 0; index < items.length; index++) {
    const item: unknown = Object.getOwnPropertyDescriptor(items, index)?.value;
    if (typeof item === 'object' && item !== null && Object.hasOwn(item, 'yawMilliDeg')) return true;
  }
  return false;
}

function encodeMember(project: unknown, schemaId: RegisteredRuntimeV1SchemaId): RuntimeV1EncodeResult {
  try {
    const active = new Set<object>();
    let bytes = 0;
    const add = (value: string): string => {
      bytes += utf8.encode(value).byteLength;
      if (bytes > RUNTIME_V1_LIMITS.bytes) throw new RuntimeV1Fault('BACKUP_PROJECT_LIMIT');
      return value;
    };
    const write = (value: unknown, depth: number, context: 'root' | 'level' | 'nested'): string => {
      if (typeof value === 'string') {
        if (value.length > 256) return unreadable();
        return add(containsLoneSurrogate(value) ? `{"utf16be":${JSON.stringify(encodeRuntimeV1Utf16(value))}}` : JSON.stringify(value));
      }
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) return unreadable();
        return add(Object.is(value, -0) ? '-0' : JSON.stringify(value));
      }
      if (value === undefined) return add('{"undefined":true}');
      if (value === null || typeof value === 'boolean') return add(String(value));
      if (typeof value !== 'object' || active.has(value)) return unreadable();
      const prototype = Object.getPrototypeOf(value);
      if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return unreadable();
      if (depth > RUNTIME_V1_LIMITS.depth) throw new RuntimeV1Fault('BACKUP_PROJECT_LIMIT');
      active.add(value);
      const keys = Reflect.ownKeys(value);
      if (Array.isArray(value) ? value.length > RUNTIME_V1_LIMITS.elementsPerArray : keys.length > RUNTIME_V1_LIMITS.membersPerObject) throw new RuntimeV1Fault('BACKUP_PROJECT_LIMIT');
      for (const key of keys) {
        if (typeof key !== 'string') return unreadable();
        const preciseYawKey = key === 'yawMilliDeg' && schemaId === RUNTIME_V1_FLOOR_YAW_SCHEMA_ID;
        if (!Array.isArray(value) && (key.length > 32 || !sourceKeys.has(key) && !preciseYawKey)) return unreadable();
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || (!descriptor.enumerable && !(Array.isArray(value) && key === 'length'))) return unreadable();
      }
      let result: string;
      if (Array.isArray(value)) {
        if (keys.length !== value.length + 1) return unreadable();
        for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) return unreadable();
        result = add('[') + value.map(entry => write(entry, depth + 1, 'nested')).join(',') + add(']');
        add(','.repeat(Math.max(0, value.length - 1)));
      } else {
        const record = value as Record<string, unknown>; // checked data-only descriptors
        const order = context === 'root' ? rootKeys : context === 'level' ? levelKeys : Object.keys(value);
        if (order.length !== keys.length || order.some(key => !Object.hasOwn(record, key))) return unreadable();
        const entries: string[] = [];
        if (context === 'root') entries.push(add(`${JSON.stringify('projectSchemaId')}:${JSON.stringify(schemaId)}`));
        for (const key of order) entries.push(add(`${JSON.stringify(key)}:`) + write(record[key], depth + 1, context === 'root' && key === 'level' ? 'level' : 'nested'));
        result = add('{') + entries.join(',') + add('}');
        add(','.repeat(Math.max(0, entries.length - 1)));
      }
      active.delete(value);
      return result;
    };
    const text = write(project, 1, 'root');
    const encoded = utf8.encode(text);
    const checked = decodeRegisteredRuntimeV1Project(encoded, schemaId);
    if (checked.kind === 'rejected') return checked;
    return { kind: 'encoded', bytes: encoded, metrics: checked.metrics };
  } catch (error) {
    return { kind: 'rejected', reasonCode: error instanceof RuntimeV1Fault ? error.reasonCode : 'BACKUP_SCHEMA_UNREADABLE' };
  }
}
