import type { Vertex, WallSegment } from './project';
import {
  PROJECT_V2_SCHEMA_VERSION,
  type FloorSchematicAssetInstanceV2,
  type ProjectV2,
  type RoomMetadataV2
} from './project-v2';

const MAX_ABSOLUTE_COORDINATE_MM = 100_000;
const MAX_ASSET_INSTANCES = 250;
const MAX_ROOM_HEIGHT_MM = 10_000;
const MAX_ROOMS = 50;
const MAX_WALL_LENGTH_SQUARED_MM = 10_000_000_000;
const MAX_WALL_SEGMENTS = 300;
const MAX_ASSET_DIMENSION_MM = 100_000;
const MAX_JSON_NESTING = 128;
const MIN_ROOM_HEIGHT_MM = 500;
const MIN_WALL_LENGTH_SQUARED_MM = 2_500;
const MIN_WALL_THICKNESS_MM = 20;
const MAX_WALL_THICKNESS_MM = 1_000;
const INTEGER_LEXEME = /^-?(?:0|[1-9]\d*)$/;
const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

export type DecodeProjectV2Reason =
  | 'DUPLICATE_IDENTIFIER'
  | 'INVALID_GEOMETRY_LEXEME'
  | 'INVALID_GEOMETRY_VALUE'
  | 'INVALID_PROJECT_SHAPE'
  | 'INVALID_PROJECT_VALUE'
  | 'INVALID_SCHEMA'
  | 'MALFORMED_JSON'
  | 'PROJECT_LIMIT_EXCEEDED'
  | 'UNRESOLVABLE_REFERENCE';

export type DecodeProjectV2Result =
  | { readonly kind: 'accepted'; readonly project: ProjectV2 }
  | { readonly kind: 'rejected'; readonly reasonCode: DecodeProjectV2Reason };

type LosslessJsonValue =
  | LosslessJsonArray
  | LosslessJsonBoolean
  | LosslessJsonNull
  | LosslessJsonNumber
  | LosslessJsonObject
  | LosslessJsonString;

type LosslessJsonArray = {
  readonly kind: 'array';
  readonly values: readonly LosslessJsonValue[];
};

type LosslessJsonBoolean = {
  readonly kind: 'boolean';
  readonly value: boolean;
};

type LosslessJsonNull = {
  readonly kind: 'null';
};

type LosslessJsonNumber = {
  readonly kind: 'number';
  readonly lexeme: string;
};

type LosslessJsonObject = {
  readonly kind: 'object';
  readonly properties: ReadonlyMap<string, LosslessJsonValue>;
};

type LosslessJsonString = {
  readonly kind: 'string';
  readonly value: string;
};

/**
 * Serializes only a Project which passes the same strict ingress rules as a
 * persisted v2 snapshot. Array order is canonicalized because graph/member
 * order is not part of the Project meaning.
 */
export function serializeProjectV2Canonically(project: ProjectV2): string {
  let provisional: string | undefined;
  try {
    provisional = JSON.stringify(project);
  } catch {
    throw new TypeError('Cannot canonically serialize an unrepresentable ProjectV2');
  }
  if (typeof provisional !== 'string') {
    throw new TypeError('Cannot canonically serialize an unrepresentable ProjectV2');
  }
  const decoded = decodeProjectV2(provisional);
  if (decoded.kind === 'rejected') {
    throw new TypeError(`Cannot canonically serialize invalid ProjectV2: ${decoded.reasonCode}`);
  }
  return stringifyCanonicalProject(decoded.project);
}

/**
 * Parses a persisted Project without first coercing geometry numbers to host
 * IEEE numbers. Every geometry field is checked as its raw JSON lexeme before
 * the resulting safe integer is materialized.
 */
export function decodeProjectV2(serialized: string): DecodeProjectV2Result {
  if (typeof serialized !== 'string') {
    return reject('MALFORMED_JSON');
  }
  try {
    const parsed = new LosslessJsonParser(serialized).parseDocument();
    return { kind: 'accepted', project: decodeProjectDocument(parsed) };
  } catch (error) {
    if (error instanceof ProjectV2CodecFailure) {
      return reject(error.reasonCode);
    }
    return reject('MALFORMED_JSON');
  }
}

function decodeProjectDocument(value: LosslessJsonValue): ProjectV2 {
  const document = exactObject(value, [
    'schemaVersion',
    'projectId',
    'name',
    'createdAt',
    'updatedAt',
    'lifecycle',
    'level',
    'assetInstances',
    'assetDefinitionRefs'
  ]);
  decodeSchemaVersion(field(document, 'schemaVersion'));
  const projectId = nonEmptyString(field(document, 'projectId'));
  const name = nonEmptyString(field(document, 'name'));
  const createdAt = nonEmptyString(field(document, 'createdAt'));
  const updatedAt = nonEmptyString(field(document, 'updatedAt'));
  const lifecycle = nonEmptyString(field(document, 'lifecycle'));
  if (lifecycle !== 'active') {
    fail('INVALID_PROJECT_VALUE');
  }
  const level = decodeLevel(field(document, 'level'));
  const assetInstances = decodeAssetInstances(field(document, 'assetInstances'), level.roomMetadata);
  emptyArray(field(document, 'assetDefinitionRefs'));
  return canonicalizeProject({
    assetDefinitionRefs: [],
    assetInstances,
    createdAt,
    level,
    lifecycle: 'active',
    name,
    projectId,
    schemaVersion: PROJECT_V2_SCHEMA_VERSION,
    updatedAt
  });
}

function decodeSchemaVersion(value: LosslessJsonValue): void {
  if (value.kind !== 'number' || value.lexeme !== String(PROJECT_V2_SCHEMA_VERSION)) {
    fail('INVALID_SCHEMA');
  }
}

function decodeLevel(value: LosslessJsonValue): ProjectV2['level'] {
  const document = exactObject(value, ['levelId', 'vertices', 'wallSegments', 'roomMetadata', 'openings']);
  const levelId = nonEmptyString(field(document, 'levelId'));
  const vertices = decodeVertices(field(document, 'vertices'));
  const wallSegments = decodeWallSegments(field(document, 'wallSegments'), vertices);
  const roomMetadata = decodeRoomMetadata(field(document, 'roomMetadata'));
  emptyArray(field(document, 'openings'));
  return { levelId, openings: [], roomMetadata, vertices, wallSegments };
}

function decodeVertices(value: LosslessJsonValue): readonly Vertex[] {
  const values = array(value);
  const vertexIds = new Set<string>();
  const coordinates = new Set<string>();
  return values.map((entry) => {
    const document = exactObject(entry, ['vertexId', 'xMm', 'zMm']);
    const vertexId = nonEmptyString(field(document, 'vertexId'));
    const xMm = coordinate(field(document, 'xMm'));
    const zMm = coordinate(field(document, 'zMm'));
    if (vertexIds.has(vertexId) || coordinates.has(coordinateKey(xMm, zMm))) {
      fail('DUPLICATE_IDENTIFIER');
    }
    vertexIds.add(vertexId);
    coordinates.add(coordinateKey(xMm, zMm));
    return { vertexId, xMm, zMm };
  });
}

function decodeWallSegments(
  value: LosslessJsonValue,
  vertices: readonly Vertex[]
): readonly WallSegment[] {
  const values = array(value);
  if (values.length > MAX_WALL_SEGMENTS) {
    fail('PROJECT_LIMIT_EXCEEDED');
  }
  const vertexById = new Map(vertices.map((vertex) => [vertex.vertexId, vertex]));
  const wallIds = new Set<string>();
  const endpointPairs = new Set<string>();
  return values.map((entry) => {
    const document = exactObject(entry, ['wallSegmentId', 'startVertexId', 'endVertexId', 'thicknessMm']);
    const wallSegmentId = nonEmptyString(field(document, 'wallSegmentId'));
    const startVertexId = nonEmptyString(field(document, 'startVertexId'));
    const endVertexId = nonEmptyString(field(document, 'endVertexId'));
    const thicknessMm = wallThickness(field(document, 'thicknessMm'));
    if (wallIds.has(wallSegmentId) || endpointPairs.has(canonicalPair(startVertexId, endVertexId))) {
      fail('DUPLICATE_IDENTIFIER');
    }
    const start = vertexById.get(startVertexId);
    const end = vertexById.get(endVertexId);
    if (!start || !end) {
      fail('UNRESOLVABLE_REFERENCE');
    }
    validateWallGeometry(start, end);
    wallIds.add(wallSegmentId);
    endpointPairs.add(canonicalPair(startVertexId, endVertexId));
    return { endVertexId, startVertexId, thicknessMm, wallSegmentId };
  });
}

function decodeRoomMetadata(value: LosslessJsonValue): readonly RoomMetadataV2[] {
  const values = array(value);
  if (values.length > MAX_ROOMS) {
    fail('PROJECT_LIMIT_EXCEEDED');
  }
  const roomIds = new Set<string>();
  const fingerprints = new Set<string>();
  return values.map((entry) => {
    const document = exactObject(entry, ['roomId', 'faceFingerprint', 'heightMm']);
    const roomId = nonEmptyString(field(document, 'roomId'));
    const faceFingerprint = nonEmptyString(field(document, 'faceFingerprint'));
    const heightMm = roomHeight(field(document, 'heightMm'));
    if (roomIds.has(roomId) || fingerprints.has(faceFingerprint)) {
      fail('DUPLICATE_IDENTIFIER');
    }
    roomIds.add(roomId);
    fingerprints.add(faceFingerprint);
    return { faceFingerprint, heightMm, roomId };
  });
}

function decodeAssetInstances(
  value: LosslessJsonValue,
  roomMetadata: readonly RoomMetadataV2[]
): readonly FloorSchematicAssetInstanceV2[] {
  const values = array(value);
  if (values.length > MAX_ASSET_INSTANCES) {
    fail('PROJECT_LIMIT_EXCEEDED');
  }
  const roomIds = new Set(roomMetadata.map((room) => room.roomId));
  const assetIds = new Set<string>();
  return values.map((entry) => {
    const document = exactObject(entry, [
      'assetInstanceId',
      'anchorClass',
      'roomId',
      'label',
      'xMm',
      'zMm',
      'widthMm',
      'depthMm',
      'heightMm',
      'color'
    ], ['elevationMm']);
    const assetInstanceId = nonEmptyString(field(document, 'assetInstanceId'));
    const anchorClass = nonEmptyString(field(document, 'anchorClass'));
    const roomId = nonEmptyString(field(document, 'roomId'));
    const label = nonEmptyString(field(document, 'label'));
    const xMm = coordinate(field(document, 'xMm'));
    const zMm = coordinate(field(document, 'zMm'));
		const elevationMm = document.has('elevationMm')
			? floorElevation(field(document, 'elevationMm'))
			: undefined;
    const widthMm = assetDimension(field(document, 'widthMm'));
    const depthMm = assetDimension(field(document, 'depthMm'));
    const heightMm = assetDimension(field(document, 'heightMm'));
    const color = nonEmptyString(field(document, 'color'));
    if (anchorClass !== 'floor' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      fail('INVALID_PROJECT_VALUE');
    }
    if (assetIds.has(assetInstanceId)) {
      fail('DUPLICATE_IDENTIFIER');
    }
    if (!roomIds.has(roomId)) {
      fail('UNRESOLVABLE_REFERENCE');
    }
    assetIds.add(assetInstanceId);
    return {
      anchorClass: 'floor',
      assetInstanceId,
      color,
      depthMm,
		...(elevationMm === undefined ? {} : { elevationMm }),
      heightMm,
      label,
      roomId,
      widthMm,
      xMm,
      zMm
    };
  });
}

function coordinate(value: LosslessJsonValue): number {
  const parsed = safeIntegerMm(value);
  if (Math.abs(parsed) > MAX_ABSOLUTE_COORDINATE_MM) {
    fail('PROJECT_LIMIT_EXCEEDED');
  }
  return parsed;
}

function wallThickness(value: LosslessJsonValue): number {
  const parsed = safeIntegerMm(value);
  if (parsed <= 0) {
    fail('INVALID_GEOMETRY_VALUE');
  }
  if (parsed < MIN_WALL_THICKNESS_MM || parsed > MAX_WALL_THICKNESS_MM) {
    fail('PROJECT_LIMIT_EXCEEDED');
  }
  return parsed;
}

function roomHeight(value: LosslessJsonValue): number {
  const parsed = safeIntegerMm(value);
  if (parsed <= 0) {
    fail('INVALID_GEOMETRY_VALUE');
  }
  if (parsed < MIN_ROOM_HEIGHT_MM || parsed > MAX_ROOM_HEIGHT_MM) {
    fail('PROJECT_LIMIT_EXCEEDED');
  }
  return parsed;
}

function assetDimension(value: LosslessJsonValue): number {
  const parsed = safeIntegerMm(value);
  if (parsed <= 0) {
    fail('INVALID_GEOMETRY_VALUE');
  }
  if (parsed > MAX_ASSET_DIMENSION_MM) {
    fail('PROJECT_LIMIT_EXCEEDED');
  }
  return parsed;
}

function floorElevation(value: LosslessJsonValue): 0 {
	const parsed = safeIntegerMm(value);
	if (parsed !== 0) {
		fail('INVALID_GEOMETRY_VALUE');
	}
	return 0;
}

function safeIntegerMm(value: LosslessJsonValue): number {
  if (value.kind !== 'number') {
    fail('INVALID_PROJECT_SHAPE');
  }
  if (!INTEGER_LEXEME.test(value.lexeme)) {
    fail('INVALID_GEOMETRY_LEXEME');
  }
  const normalizedLexeme = value.lexeme === '-0' ? '0' : value.lexeme;
  const parsed = Number(normalizedLexeme);
  if (!Number.isSafeInteger(parsed)) {
    fail('INVALID_GEOMETRY_VALUE');
  }
  return parsed;
}

function validateWallGeometry(start: Vertex, end: Vertex): void {
  const deltaXMm = end.xMm - start.xMm;
  const deltaZMm = end.zMm - start.zMm;
  if (deltaXMm === 0 && deltaZMm === 0) {
    fail('INVALID_GEOMETRY_VALUE');
  }
  if (deltaXMm !== 0 && deltaZMm !== 0 && Math.abs(deltaXMm) !== Math.abs(deltaZMm)) {
    fail('INVALID_GEOMETRY_VALUE');
  }
  const lengthSquaredMm = deltaXMm * deltaXMm + deltaZMm * deltaZMm;
  if (lengthSquaredMm < MIN_WALL_LENGTH_SQUARED_MM) {
    fail('INVALID_GEOMETRY_VALUE');
  }
  if (lengthSquaredMm > MAX_WALL_LENGTH_SQUARED_MM) {
    fail('PROJECT_LIMIT_EXCEEDED');
  }
}

function exactObject(
	value: LosslessJsonValue,
	keys: readonly string[],
	optionalKeys: readonly string[] = []
): ReadonlyMap<string, LosslessJsonValue> {
	if (
		value.kind !== 'object' ||
		value.properties.size < keys.length ||
		value.properties.size > keys.length + optionalKeys.length ||
		!keys.every((key) => value.properties.has(key)) ||
		![...value.properties.keys()].every(
			(key) => keys.includes(key) || optionalKeys.includes(key)
		)
	) {
    fail('INVALID_PROJECT_SHAPE');
  }
  return value.properties;
}

function field(object: ReadonlyMap<string, LosslessJsonValue>, key: string): LosslessJsonValue {
  const value = object.get(key);
  if (!value) {
    fail('INVALID_PROJECT_SHAPE');
  }
  return value;
}

function nonEmptyString(value: LosslessJsonValue): string {
  if (value.kind !== 'string') {
    fail('INVALID_PROJECT_SHAPE');
  }
  if (value.value.trim().length === 0) {
    fail('INVALID_PROJECT_VALUE');
  }
  return value.value;
}

function array(value: LosslessJsonValue): readonly LosslessJsonValue[] {
  if (value.kind !== 'array') {
    fail('INVALID_PROJECT_SHAPE');
  }
  return value.values;
}

function emptyArray(value: LosslessJsonValue): void {
  if (array(value).length !== 0) {
    fail('INVALID_PROJECT_SHAPE');
  }
}

function canonicalizeProject(project: ProjectV2): ProjectV2 {
  return {
    assetDefinitionRefs: [],
    assetInstances: [...project.assetInstances]
      .sort((left, right) => compareText(left.assetInstanceId, right.assetInstanceId))
      .map((asset) => ({ ...asset })),
    createdAt: project.createdAt,
    level: {
      levelId: project.level.levelId,
      openings: [],
      roomMetadata: [...project.level.roomMetadata]
        .sort((left, right) => compareText(left.roomId, right.roomId))
        .map((room) => ({ ...room })),
      vertices: [...project.level.vertices]
        .sort((left, right) => compareText(left.vertexId, right.vertexId))
        .map((vertex) => ({ ...vertex })),
      wallSegments: [...project.level.wallSegments]
        .sort((left, right) => compareText(left.wallSegmentId, right.wallSegmentId))
        .map((wall) => ({ ...wall }))
    },
    lifecycle: 'active',
    name: project.name,
    projectId: project.projectId,
    schemaVersion: PROJECT_V2_SCHEMA_VERSION,
    updatedAt: project.updatedAt
  };
}

function stringifyCanonicalProject(project: ProjectV2): string {
  const canonical = canonicalizeProject(project);
  return JSON.stringify({
    schemaVersion: canonical.schemaVersion,
    projectId: canonical.projectId,
    name: canonical.name,
    createdAt: canonical.createdAt,
    updatedAt: canonical.updatedAt,
    lifecycle: canonical.lifecycle,
    level: {
      levelId: canonical.level.levelId,
      vertices: canonical.level.vertices.map((vertex) => ({
        vertexId: vertex.vertexId,
        xMm: vertex.xMm,
        zMm: vertex.zMm
      })),
      wallSegments: canonical.level.wallSegments.map((wall) => ({
        wallSegmentId: wall.wallSegmentId,
        startVertexId: wall.startVertexId,
        endVertexId: wall.endVertexId,
        thicknessMm: wall.thicknessMm
      })),
      roomMetadata: canonical.level.roomMetadata.map((room) => ({
        roomId: room.roomId,
        faceFingerprint: room.faceFingerprint,
        heightMm: room.heightMm
      })),
      openings: []
    },
    assetInstances: canonical.assetInstances.map((asset) => ({
      assetInstanceId: asset.assetInstanceId,
      anchorClass: asset.anchorClass,
      roomId: asset.roomId,
      label: asset.label,
      xMm: asset.xMm,
      zMm: asset.zMm,
		...(asset.elevationMm === undefined ? {} : { elevationMm: asset.elevationMm }),
      widthMm: asset.widthMm,
      depthMm: asset.depthMm,
      heightMm: asset.heightMm,
      color: asset.color
    })),
    assetDefinitionRefs: []
  });
}

function coordinateKey(xMm: number, zMm: number): string {
  return `${xMm}:${zMm}`;
}

function canonicalPair(first: string, second: string): string {
  return compareText(first, second) <= 0
    ? `${first.length}:${first}${second.length}:${second}`
    : `${second.length}:${second}${first.length}:${first}`;
}

function compareText(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function reject(reasonCode: DecodeProjectV2Reason): Extract<DecodeProjectV2Result, { readonly kind: 'rejected' }> {
  return { kind: 'rejected', reasonCode };
}

function fail(reasonCode: DecodeProjectV2Reason): never {
  throw new ProjectV2CodecFailure(reasonCode);
}

class ProjectV2CodecFailure extends Error {
  public constructor(public readonly reasonCode: DecodeProjectV2Reason) {
    super(reasonCode);
  }
}

class LosslessJsonParser {
  private index = 0;

  public constructor(private readonly input: string) {}

  public parseDocument(): LosslessJsonValue {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.input.length) {
      throw new Error('Unexpected content after JSON document');
    }
    return value;
  }

  private parseValue(depth: number): LosslessJsonValue {
    if (depth > MAX_JSON_NESTING) {
      throw new Error('JSON nesting exceeds the bounded decoder limit');
    }
    this.skipWhitespace();
    const character = this.input[this.index];
    if (character === '{') {
      return this.parseObject(depth + 1);
    }
    if (character === '[') {
      return this.parseArray(depth + 1);
    }
    if (character === '"') {
      return { kind: 'string', value: this.parseString() };
    }
    if (character === 't') {
      this.parseLiteral('true');
      return { kind: 'boolean', value: true };
    }
    if (character === 'f') {
      this.parseLiteral('false');
      return { kind: 'boolean', value: false };
    }
    if (character === 'n') {
      this.parseLiteral('null');
      return { kind: 'null' };
    }
    if (character === '-' || isAsciiDigit(character)) {
      return this.parseNumber();
    }
    throw new Error('Unexpected JSON token');
  }

  private parseObject(depth: number): LosslessJsonObject {
    this.expect('{');
    this.skipWhitespace();
    const properties = new Map<string, LosslessJsonValue>();
    if (this.consume('}')) {
      return { kind: 'object', properties };
    }
    while (true) {
      this.skipWhitespace();
      if (this.input[this.index] !== '"') {
        throw new Error('JSON object key must be a string');
      }
      const key = this.parseString();
      if (properties.has(key)) {
        throw new Error('Duplicate JSON object key');
      }
      this.skipWhitespace();
      this.expect(':');
      const value = this.parseValue(depth);
      properties.set(key, value);
      this.skipWhitespace();
      if (this.consume('}')) {
        return { kind: 'object', properties };
      }
      this.expect(',');
    }
  }

  private parseArray(depth: number): LosslessJsonArray {
    this.expect('[');
    this.skipWhitespace();
    const values: LosslessJsonValue[] = [];
    if (this.consume(']')) {
      return { kind: 'array', values };
    }
    while (true) {
      values.push(this.parseValue(depth));
      this.skipWhitespace();
      if (this.consume(']')) {
        return { kind: 'array', values };
      }
      this.expect(',');
    }
  }

  private parseString(): string {
    const start = this.index;
    this.expect('"');
    while (this.index < this.input.length) {
      const character = this.input[this.index];
      if (character === '"') {
        this.index += 1;
        const decoded = JSON.parse(this.input.slice(start, this.index));
        if (typeof decoded !== 'string') {
          throw new Error('Expected JSON string');
        }
        return decoded;
      }
      if (character === '\\') {
        this.index += 1;
        const escapeCharacter = this.input[this.index];
        if (escapeCharacter === 'u') {
          for (let offset = 1; offset <= 4; offset += 1) {
            if (!isHexadecimal(this.input[this.index + offset])) {
              throw new Error('Invalid Unicode escape');
            }
          }
          this.index += 5;
          continue;
        }
        if (!escapeCharacter || !'"\\/bfnrt'.includes(escapeCharacter)) {
          throw new Error('Invalid JSON escape');
        }
        this.index += 1;
        continue;
      }
      if (!character || character.charCodeAt(0) < 0x20) {
        throw new Error('Unescaped JSON control character');
      }
      this.index += 1;
    }
    throw new Error('Unterminated JSON string');
  }

  private parseNumber(): LosslessJsonNumber {
    JSON_NUMBER.lastIndex = this.index;
    const match = JSON_NUMBER.exec(this.input);
    if (!match) {
      throw new Error('Invalid JSON number');
    }
    this.index = JSON_NUMBER.lastIndex;
    return { kind: 'number', lexeme: match[0] };
  }

  private parseLiteral(literal: string): void {
    if (this.input.slice(this.index, this.index + literal.length) !== literal) {
      throw new Error('Invalid JSON literal');
    }
    this.index += literal.length;
  }

  private skipWhitespace(): void {
    while (isJsonWhitespace(this.input[this.index])) {
      this.index += 1;
    }
  }

  private expect(character: string): void {
    if (!this.consume(character)) {
      throw new Error(`Expected ${character}`);
    }
  }

  private consume(character: string): boolean {
    if (this.input[this.index] !== character) {
      return false;
    }
    this.index += 1;
    return true;
  }
}

function isAsciiDigit(value: string | undefined): boolean {
  return value !== undefined && value >= '0' && value <= '9';
}

function isHexadecimal(value: string | undefined): boolean {
  return value !== undefined && /[0-9a-fA-F]/.test(value);
}

function isJsonWhitespace(value: string | undefined): boolean {
  return value === ' ' || value === '\n' || value === '\r' || value === '\t';
}
