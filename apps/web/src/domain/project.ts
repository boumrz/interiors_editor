import type { ItemColorVariantId } from "./item-color-variant";

export const PROJECT_SCHEMA_VERSION = 1 as const;

export interface Vertex {
	readonly vertexId: string;
	readonly xMm: number;
	readonly zMm: number;
}

export interface WallSegment {
	readonly wallSegmentId: string;
	readonly startVertexId: string;
	readonly endVertexId: string;
	readonly thicknessMm: number;
}

export interface Room {
	readonly roomId: string;
	readonly faceFingerprint: string;
	readonly heightMm: number;
	/**
	 * Optional while reading revisions authored before Room properties existed.
	 * The editor supplies readable defaults until the user makes an explicit
	 * Room-properties change, so opening an existing local Project never needs
	 * a speculative migration.
	 */
	readonly name?: string;
	readonly type?: RoomType;
}

/** A small stable Alpha vocabulary for a Room's intended use. */
export type RoomType =
	| "bathroom"
	| "bedroom"
	| "hallway"
	| "kitchen"
	| "living-room"
	| "office"
	| "other"
	| "storage";

/**
 * The one durable orientation authority for a floor asset. Positive steps are
 * right-handed 45-degree turns around +Y: local +Z points toward plan +X at
 * step 2. Older saved items without this field are interpreted as step 0.
 */
export type RotationStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * A durable reference to the exact catalogue publication from which an
 * immutable resource was deliberately placed. The GLB bytes themselves stay
 * addressed by `resourceHash`; this provenance makes their catalogue identity
 * recoverable after the live control plane is unavailable.
 */
export interface CatalogVersionAssetOrigin {
	readonly catalogAssetId: string;
	readonly catalogEnvelopeHash: string;
	readonly catalogVersion: string;
	readonly source: "CatalogVersion";
}

/** Metadata is durable; the immutable GLB bytes live in the local resource store by hash. */
export interface CustomGlbAssetDefinition {
	readonly assetDefinitionId: string;
	readonly byteLength: number;
	/** Present together only for an asset placed from a verified catalog publication. */
	readonly catalogAssetId?: CatalogVersionAssetOrigin["catalogAssetId"];
	readonly catalogEnvelopeHash?: CatalogVersionAssetOrigin["catalogEnvelopeHash"];
	readonly catalogVersion?: CatalogVersionAssetOrigin["catalogVersion"];
	readonly depthMm: number;
	readonly displayName: string;
	readonly format: "glb";
	readonly heightMm: number;
	readonly resourceHash: string;
	readonly source?: CatalogVersionAssetOrigin["source"];
	readonly widthMm: number;
}

export type FloorSchematicAssetInstance = {
	readonly assetInstanceId: string;
	/** Absent only for built-in parametric Alpha items. */
	readonly assetDefinitionId?: string;
	readonly anchorClass: "floor";
	/**
	 * Floor placement is grounded. Older revisions omitted this explicit zero and
	 * are interpreted identically until their next durable mutation.
	 */
	readonly elevationMm?: 0;
	readonly roomId: string;
	readonly label: string;
	readonly xMm: number;
	readonly zMm: number;
	readonly widthMm: number;
	readonly depthMm: number;
	readonly heightMm: number;
	readonly color: string;
	/** Stable declared variant reference; absent only in revisions before variant selection. */
	readonly colorVariantId?: ItemColorVariantId;
	/** Absent in pre-lock revisions and therefore equivalent to an unlocked item. */
	readonly locked?: true;
	/**
	 * Legacy import-only spelling from revisions authored before `yawStep` was
	 * enforced as the sole durable orientation. It is never authoritative when
	 * `yawStep` is present and every later placement mutation removes it.
	 */
	readonly yawRadians?: number;
	/** The sole durable orientation authority for a floor asset. */
	readonly yawStep?: RotationStep;
	/** Exact floor angle in thousandths of a degree, exclusive of legacy yaw. */
	readonly yawMilliDeg?: number;
};

/** A non-floor item keeps only a semantic Wall host and local millimetres. */
export type WallSchematicAssetInstance = {
	readonly anchorClass: "wall";
	readonly assetDefinitionId?: string;
	readonly assetInstanceId: string;
	readonly color: string;
	/** Stable declared variant reference; absent only in revisions before variant selection. */
	readonly colorVariantId?: ItemColorVariantId;
	readonly depthMm: number;
	readonly elevationMm: number;
	readonly heightMm: number;
	readonly label: string;
	/** Absent in pre-lock revisions and therefore equivalent to an unlocked item. */
	readonly locked?: true;
	readonly offsetMm: number;
	readonly side: "left" | "right";
	readonly wallSegmentId: string;
	readonly widthMm: number;
};

export type SchematicAssetInstance =
	| FloorSchematicAssetInstance
	| WallSchematicAssetInstance;

export function isFloorSchematicAssetInstance(
	item: SchematicAssetInstance,
): item is FloorSchematicAssetInstance {
	return item.anchorClass === "floor";
}

export function isWallSchematicAssetInstance(
	item: SchematicAssetInstance,
): item is WallSchematicAssetInstance {
	return item.anchorClass === "wall";
}

interface WallOpeningBase {
	readonly openingId: string;
	readonly wallSegmentId: string;
	/** Centre of the opening measured from the canonical start of its host wall. */
	readonly offsetMm: number;
	readonly widthMm: number;
	readonly heightMm: number;
	readonly sillMm: number;
}

export interface DoorWallOpening extends WallOpeningBase {
	readonly kind: "Door";
	/**
	 * The side into which a hinged door swings, relative to the canonical
	 * start→end direction of its host wall. Older revisions without a value
	 * are read as `right` for backwards-compatible projection.
	 */
	readonly swingSide?: "left" | "right";
}

export interface WindowWallOpening extends WallOpeningBase {
	readonly kind: "Window";
	/** Windows have no hinge or open/close state in Alpha. */
	readonly swingSide?: never;
}

export type WallOpening = DoorWallOpening | WindowWallOpening;

export interface Level {
	readonly levelId: string;
	readonly vertices: readonly Vertex[];
	readonly wallSegments: readonly WallSegment[];
	readonly rooms: readonly Room[];
	readonly openings: readonly WallOpening[];
}

export interface Project {
	readonly schemaVersion: typeof PROJECT_SCHEMA_VERSION;
	readonly projectId: string;
	readonly name: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly lifecycle: "active";
	readonly level: Level;
	readonly assetInstances: readonly SchematicAssetInstance[];
	readonly assetDefinitionRefs: readonly CustomGlbAssetDefinition[];
}

export interface Revision {
	readonly schemaVersion: typeof PROJECT_SCHEMA_VERSION;
	readonly revisionId: string;
	readonly projectId: string;
	readonly createdAt: string;
	readonly serializedProject: string;
	readonly checksum: string;
}
