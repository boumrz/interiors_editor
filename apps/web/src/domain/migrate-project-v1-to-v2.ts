import {
	type DerivedOrthogonalFace,
	type DerivePlanFacesResult,
	deriveBoundedOrthogonalFaces,
} from "./derive-plan-faces";
import {
	type FloorSchematicAssetInstance,
	isFloorSchematicAssetInstance,
	type Project,
	type Room,
	type SchematicAssetInstance,
	type WallSegment,
} from "./project";
import {
	type FloorSchematicAssetInstanceV2,
	PROJECT_V2_SCHEMA_VERSION,
	type ProjectV2,
	type RoomMetadataV2,
} from "./project-v2";

type LegacyRoomBounds = {
	readonly maxXMm: number;
	readonly maxZMm: number;
	readonly minXMm: number;
	readonly minZMm: number;
	readonly thicknessMm: number;
};

type ResolvedLegacyRoom = {
	readonly bounds: LegacyRoomBounds;
	readonly room: Room;
};

type ReconciledRoom = {
	readonly bounds: LegacyRoomBounds;
	readonly metadata: RoomMetadataV2;
};

type ReconcileRoomsResult =
	| {
			readonly kind: "accepted";
			readonly roomsById: ReadonlyMap<string, ReconciledRoom>;
			readonly roomMetadata: readonly RoomMetadataV2[];
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "LEGACY_ROOM_DESCRIPTOR_UNSUPPORTED"
				| "LEGACY_ROOM_METADATA_INVALID"
				| "ROOM_FACE_RECONCILIATION_AMBIGUOUS";
	  };

export type MigrateProjectV1ToV2Reason =
	| Extract<DerivePlanFacesResult, { readonly kind: "rejected" }>["reasonCode"]
	| "ITEM_HOST_UNRESOLVABLE"
	| "LEGACY_ROOM_DESCRIPTOR_UNSUPPORTED"
	| "LEGACY_ROOM_METADATA_INVALID"
	| "ROOM_FACE_RECONCILIATION_AMBIGUOUS";

export type MigrateProjectV1ToV2Result =
	| { readonly kind: "accepted"; readonly project: ProjectV2 }
	| {
			readonly kind: "rejected";
			readonly reasonCode: MigrateProjectV1ToV2Reason;
	  };

/**
 * Pure migration of the constrained v1 model. Legacy face descriptors are
 * evidence for one-to-one metadata reconciliation only; all v2 faces are
 * obtained from the canonical wall graph.
 */
export function migrateProjectV1ToV2(
	source: Project,
): MigrateProjectV1ToV2Result {
	const derived = deriveBoundedOrthogonalFaces({
		vertices: source.level.vertices,
		wallSegments: source.level.wallSegments,
	});
	if (derived.kind === "rejected") {
		return derived;
	}
	const wallById = wallsById(source.level.wallSegments);
	if (!wallById) {
		return {
			kind: "rejected",
			reasonCode: "ROOM_FACE_RECONCILIATION_AMBIGUOUS",
		};
	}
	const reconciliation = reconcileRooms(source, derived.faces, wallById);
	if (reconciliation.kind === "rejected") {
		return reconciliation;
	}
	const assetInstances = migrateAssetInstances(
		source.assetInstances,
		reconciliation.roomsById,
	);
	if (!assetInstances) {
		return { kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" };
	}
	return {
		kind: "accepted",
		project: {
			assetDefinitionRefs: [],
			assetInstances,
			createdAt: source.createdAt,
			level: {
				levelId: source.level.levelId,
				openings: [],
				roomMetadata: reconciliation.roomMetadata,
				vertices: source.level.vertices.map((vertex) => ({ ...vertex })),
				wallSegments: source.level.wallSegments.map((wall) => ({ ...wall })),
			},
			lifecycle: source.lifecycle,
			name: source.name,
			projectId: source.projectId,
			schemaVersion: PROJECT_V2_SCHEMA_VERSION,
			updatedAt: source.updatedAt,
		},
	};
}

function reconcileRooms(
	source: Project,
	faces: readonly DerivedOrthogonalFace[],
	wallById: ReadonlyMap<string, WallSegment>,
): ReconcileRoomsResult {
	if (source.level.rooms.length !== faces.length) {
		return {
			kind: "rejected",
			reasonCode: "ROOM_FACE_RECONCILIATION_AMBIGUOUS",
		};
	}
	const graphBounds = boundsForVertices(source);
	const resolvedRooms: ResolvedLegacyRoom[] = [];
	const roomIds = new Set<string>();
	for (const room of source.level.rooms) {
		if (
			!room.roomId ||
			roomIds.has(room.roomId) ||
			!isPositiveSafeInteger(room.heightMm)
		) {
			return { kind: "rejected", reasonCode: "LEGACY_ROOM_METADATA_INVALID" };
		}
		roomIds.add(room.roomId);
		const bounds = legacyBoundsForRoom(room, graphBounds);
		if (!bounds) {
			return {
				kind: "rejected",
				reasonCode: "LEGACY_ROOM_DESCRIPTOR_UNSUPPORTED",
			};
		}
		resolvedRooms.push({ bounds, room });
	}

	const reconciledRoomIds = new Set<string>();
	const roomsById = new Map<string, ReconciledRoom>();
	const roomMetadata: RoomMetadataV2[] = [];
	for (const face of faces) {
		const candidates = resolvedRooms.filter((resolved) =>
			faceMatchesLegacyBounds(face, resolved.bounds, wallById),
		);
		const candidate = candidates[0];
		if (
			!candidate ||
			candidates.length !== 1 ||
			reconciledRoomIds.has(candidate.room.roomId)
		) {
			return {
				kind: "rejected",
				reasonCode: "ROOM_FACE_RECONCILIATION_AMBIGUOUS",
			};
		}
		reconciledRoomIds.add(candidate.room.roomId);
		const metadata: RoomMetadataV2 = {
			faceFingerprint: face.fingerprint,
			heightMm: candidate.room.heightMm,
			roomId: candidate.room.roomId,
		};
		roomsById.set(metadata.roomId, { bounds: candidate.bounds, metadata });
		roomMetadata.push(metadata);
	}
	return roomsById.size === source.level.rooms.length
		? { kind: "accepted", roomMetadata, roomsById }
		: { kind: "rejected", reasonCode: "ROOM_FACE_RECONCILIATION_AMBIGUOUS" };
}

function wallsById(
	walls: readonly WallSegment[],
): ReadonlyMap<string, WallSegment> | undefined {
	const wallById = new Map<string, WallSegment>();
	for (const wall of walls) {
		if (
			!wall.wallSegmentId ||
			wallById.has(wall.wallSegmentId) ||
			!isPositiveSafeInteger(wall.thicknessMm)
		) {
			return undefined;
		}
		wallById.set(wall.wallSegmentId, wall);
	}
	return wallById;
}

function boundsForVertices(
	source: Project,
): Omit<LegacyRoomBounds, "thicknessMm"> | undefined {
	const first = source.level.vertices[0];
	if (!first) {
		return undefined;
	}
	let minXMm = first.xMm;
	let maxXMm = first.xMm;
	let minZMm = first.zMm;
	let maxZMm = first.zMm;
	for (const vertex of source.level.vertices.slice(1)) {
		minXMm = Math.min(minXMm, vertex.xMm);
		maxXMm = Math.max(maxXMm, vertex.xMm);
		minZMm = Math.min(minZMm, vertex.zMm);
		maxZMm = Math.max(maxZMm, vertex.zMm);
	}
	return { maxXMm, maxZMm, minXMm, minZMm };
}

function legacyBoundsForRoom(
	room: Room,
	graphBounds: Omit<LegacyRoomBounds, "thicknessMm"> | undefined,
): LegacyRoomBounds | undefined {
	const grid =
		/^grid:(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (grid) {
		return boundsFromValues(grid.slice(1));
	}
	const loop =
		/^loop:(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):(-?(?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (loop) {
		return boundsFromValues(loop.slice(1));
	}
	const rectangular =
		/^rectangular:((?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (rectangular && graphBounds) {
		const widthMm = safeInteger(rectangular[1]);
		const depthMm = safeInteger(rectangular[2]);
		const thicknessMm = safeInteger(rectangular[3]);
		if (
			widthMm !== undefined &&
			depthMm !== undefined &&
			thicknessMm !== undefined &&
			thicknessMm > 0 &&
			graphBounds.maxXMm - graphBounds.minXMm === widthMm &&
			graphBounds.maxZMm - graphBounds.minZMm === depthMm
		) {
			return { ...graphBounds, thicknessMm };
		}
		return undefined;
	}
	const partition =
		/^partition:(vertical|horizontal):(left|right|top|bottom):((?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*)):((?:0|[1-9]\d*))$/.exec(
			room.faceFingerprint,
		);
	if (!partition || !graphBounds) {
		return undefined;
	}
	const orientation = partition[1];
	const side = partition[2];
	const widthMm = safeInteger(partition[3]);
	const depthMm = safeInteger(partition[4]);
	const offsetMm = safeInteger(partition[5]);
	const thicknessMm = safeInteger(partition[6]);
	if (
		!orientation ||
		!side ||
		widthMm === undefined ||
		depthMm === undefined ||
		offsetMm === undefined ||
		thicknessMm === undefined ||
		widthMm !== graphBounds.maxXMm - graphBounds.minXMm ||
		depthMm !== graphBounds.maxZMm - graphBounds.minZMm ||
		offsetMm <= 0 ||
		thicknessMm <= 0
	) {
		return undefined;
	}
	if (orientation === "vertical" && (side === "left" || side === "right")) {
		const dividerXMm = graphBounds.minXMm + offsetMm;
		if (dividerXMm <= graphBounds.minXMm || dividerXMm >= graphBounds.maxXMm) {
			return undefined;
		}
		return side === "left"
			? { ...graphBounds, maxXMm: dividerXMm, thicknessMm }
			: { ...graphBounds, minXMm: dividerXMm, thicknessMm };
	}
	if (orientation === "horizontal" && (side === "top" || side === "bottom")) {
		const dividerZMm = graphBounds.minZMm + offsetMm;
		if (dividerZMm <= graphBounds.minZMm || dividerZMm >= graphBounds.maxZMm) {
			return undefined;
		}
		return side === "top"
			? { ...graphBounds, maxZMm: dividerZMm, thicknessMm }
			: { ...graphBounds, minZMm: dividerZMm, thicknessMm };
	}
	return undefined;
}

function boundsFromValues(
	values: readonly string[],
): LegacyRoomBounds | undefined {
	const minXMm = safeInteger(values[0]);
	const maxXMm = safeInteger(values[1]);
	const minZMm = safeInteger(values[2]);
	const maxZMm = safeInteger(values[3]);
	const thicknessMm = safeInteger(values[4]);
	if (
		minXMm === undefined ||
		maxXMm === undefined ||
		minZMm === undefined ||
		maxZMm === undefined ||
		thicknessMm === undefined ||
		minXMm >= maxXMm ||
		minZMm >= maxZMm ||
		thicknessMm <= 0
	) {
		return undefined;
	}
	return { maxXMm, maxZMm, minXMm, minZMm, thicknessMm };
}

function safeInteger(value: string | undefined): number | undefined {
	if (!value || !/^-?(?:0|[1-9]\d*)$/.test(value)) {
		return undefined;
	}
	const numberValue = Number(value);
	return Number.isSafeInteger(numberValue) ? numberValue : undefined;
}

function faceMatchesLegacyBounds(
	face: DerivedOrthogonalFace,
	bounds: LegacyRoomBounds,
	wallById: ReadonlyMap<string, WallSegment>,
): boolean {
	const expectedCoordinates = new Set([
		coordinateKey(bounds.minXMm, bounds.minZMm),
		coordinateKey(bounds.minXMm, bounds.maxZMm),
		coordinateKey(bounds.maxXMm, bounds.minZMm),
		coordinateKey(bounds.maxXMm, bounds.maxZMm),
	]);
	return (
		face.vertices.length === 4 &&
		face.vertices.every((vertex) =>
			expectedCoordinates.has(coordinateKey(vertex.xMm, vertex.zMm)),
		) &&
		face.boundaryWallSegmentIds.every(
			(wallSegmentId) =>
				wallById.get(wallSegmentId)?.thicknessMm === bounds.thicknessMm,
		)
	);
}

function migrateAssetInstances(
	assetInstances: readonly SchematicAssetInstance[],
	roomsById: ReadonlyMap<string, ReconciledRoom>,
): readonly FloorSchematicAssetInstanceV2[] | undefined {
	const assetIds = new Set<string>();
	const migrated: FloorSchematicAssetInstanceV2[] = [];
	for (const asset of assetInstances) {
		if (!isFloorSchematicAssetInstance(asset)) {
			return undefined;
		}
		const room = roomsById.get(asset.roomId);
		if (
			!isValidAsset(asset, assetIds) ||
			!room ||
			!footprintFitsBounds(asset, room.bounds)
		) {
			return undefined;
		}
		assetIds.add(asset.assetInstanceId);
		migrated.push({ ...asset });
	}
	return migrated;
}

function isValidAsset(
	asset: FloorSchematicAssetInstance,
	assetIds: ReadonlySet<string>,
): boolean {
	return (
		Boolean(asset.assetInstanceId) &&
		!assetIds.has(asset.assetInstanceId) &&
		Boolean(asset.roomId) &&
		asset.label.trim().length > 0 &&
		/^#[0-9a-fA-F]{6}$/.test(asset.color) &&
		[asset.xMm, asset.zMm, asset.widthMm, asset.depthMm, asset.heightMm].every(
			Number.isSafeInteger,
		) &&
		asset.widthMm > 0 &&
		asset.depthMm > 0 &&
		asset.heightMm > 0
	);
}

function footprintFitsBounds(
	asset: FloorSchematicAssetInstance,
	bounds: LegacyRoomBounds,
): boolean {
	const minX2 = BigInt(bounds.minXMm) * 2n + BigInt(bounds.thicknessMm);
	const maxX2 = BigInt(bounds.maxXMm) * 2n - BigInt(bounds.thicknessMm);
	const minZ2 = BigInt(bounds.minZMm) * 2n + BigInt(bounds.thicknessMm);
	const maxZ2 = BigInt(bounds.maxZMm) * 2n - BigInt(bounds.thicknessMm);
	const assetMinX2 = BigInt(asset.xMm) * 2n - BigInt(asset.widthMm);
	const assetMaxX2 = BigInt(asset.xMm) * 2n + BigInt(asset.widthMm);
	const assetMinZ2 = BigInt(asset.zMm) * 2n - BigInt(asset.depthMm);
	const assetMaxZ2 = BigInt(asset.zMm) * 2n + BigInt(asset.depthMm);
	return (
		assetMinX2 >= minX2 &&
		assetMaxX2 <= maxX2 &&
		assetMinZ2 >= minZ2 &&
		assetMaxZ2 <= maxZ2
	);
}

function isPositiveSafeInteger(value: number): boolean {
	return Number.isSafeInteger(value) && value > 0;
}

function coordinateKey(xMm: number, zMm: number): string {
	return `${xMm}:${zMm}`;
}
