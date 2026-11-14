import type { Vertex, WallSegment } from './project';

export const PROJECT_V2_SCHEMA_VERSION = 2 as const;

/**
 * Durable Room properties are metadata addressed by a fingerprint that is
 * re-derived from the canonical PlanGraph. They do not describe a face.
 */
export type RoomMetadataV2 = {
  readonly faceFingerprint: string;
  readonly heightMm: number;
  readonly roomId: string;
};

/**
 * The alpha v1 catalogue contains only procedural floor greyboxes. Keeping
 * the shape explicit avoids treating its Room host as geometry.
 */
export type FloorSchematicAssetInstanceV2 = {
  readonly anchorClass: 'floor';
  readonly assetInstanceId: string;
  readonly color: string;
  readonly depthMm: number;
	/** Legacy v2 revisions omit the explicit grounded elevation. */
	readonly elevationMm?: 0;
  readonly heightMm: number;
  readonly label: string;
  readonly roomId: string;
  readonly widthMm: number;
  readonly xMm: number;
  readonly zMm: number;
};

export type LevelV2 = {
  readonly levelId: string;
  readonly openings: readonly [];
  readonly roomMetadata: readonly RoomMetadataV2[];
  readonly vertices: readonly Vertex[];
  readonly wallSegments: readonly WallSegment[];
};

/**
 * Version 2 persists only PlanGraph geometry and metadata which can be
 * reconciled to a derived face. Face polygons, meshes and spatial indices are
 * intentionally absent.
 */
export type ProjectV2 = {
  readonly assetDefinitionRefs: readonly [];
  readonly assetInstances: readonly FloorSchematicAssetInstanceV2[];
  readonly createdAt: string;
  readonly level: LevelV2;
  readonly lifecycle: 'active';
  readonly name: string;
  readonly projectId: string;
  readonly schemaVersion: typeof PROJECT_V2_SCHEMA_VERSION;
  readonly updatedAt: string;
};

/** A v2 revision serializes the v2 PlanGraph document; it is never a v1 alias. */
export type RevisionV2 = {
  readonly checksum: string;
  readonly createdAt: string;
  readonly projectId: string;
  readonly revisionId: string;
  readonly schemaVersion: typeof PROJECT_V2_SCHEMA_VERSION;
  readonly serializedProject: string;
};
