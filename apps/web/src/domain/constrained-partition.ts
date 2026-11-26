import {
	type FloorSchematicAssetInstance,
	isFloorSchematicAssetInstance,
	type Project,
	type Room,
	type SchematicAssetInstance,
	type Vertex,
	type WallProfile,
	type WallSegment,
} from "./project";
import { resolveOrthogonalPlanFaces } from "./derived-orthogonal-plan-faces";
import { addGeneralWallToProject } from "./general-wall-project";

/** The editing lattice is deliberately part of the domain contract, not a UI-only snap. */
export const PLAN_GRID_STEP_MM = 100;

export interface ConstrainedPartitionInput {
	readonly orientation: "vertical" | "horizontal";
	readonly offsetMm: number;
	readonly profile?: WallProfile;
}

export interface OrthogonalGridExpansionInput {
	readonly amountMm: number;
	readonly side: "left" | "right" | "top" | "bottom";
}

export interface DeleteConstrainedWallInput {
	readonly wallSegmentId: string;
}

interface IdSource {
	next(): string;
}

interface GridCell {
	readonly maxXmm: number;
	readonly maxZmm: number;
	readonly minXmm: number;
	readonly minZmm: number;
	readonly room: Room;
}

interface OrthogonalGrid {
	readonly cells: readonly GridCell[];
	readonly maxXmm: number;
	readonly maxZmm: number;
	readonly minXmm: number;
	readonly minZmm: number;
	readonly thicknessMm: number;
	readonly xLines: readonly number[];
	readonly zLines: readonly number[];
}

export type AddConstrainedPartitionResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "INVALID_DIMENSION"
				| "PLAN_NOT_RECTANGULAR_STARTER"
				| "WALL_DOOR_OPENING_COLLISION"
				| "WALL_ITEM_COLLISION";
	  };

export type DeleteConstrainedWallResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "ITEM_HOST_UNRESOLVABLE"
				| "PLAN_NOT_RECTANGULAR_STARTER"
				| "WALL_BOUNDARY"
				| "WALL_NOT_DELETABLE"
				| "WALL_NOT_FOUND";
	  };

/**
 * Inserts a full-span divider into the supported orthogonal grid subset of the
 * PlanGraph. Grid lines are derived from canonical geometry; no parallel grid
 * representation is persisted.
 */
export function addConstrainedPartition(
	project: Project,
	input: ConstrainedPartitionInput,
	ids: IdSource,
	updatedAt: string,
): AddConstrainedPartitionResult {
	if (input.profile !== undefined || project.interiorSchemaVersion !== undefined || project.roomLayouts?.length || project.supportedItems?.length ||
		project.level.rooms.some((room) => room.floorFinish !== undefined) ||
		project.level.wallSegments.some((wall, _, walls) => wall.profile !== undefined || wall.sideFinishes !== undefined ||
			wall.thicknessMm !== walls[0]?.thicknessMm)) {
		return addPlanGraphPartition(project, input, ids, updatedAt);
	}
	const grid = readOrthogonalGrid(project);
	if (!grid) {
		return { kind: "rejected", reasonCode: "PLAN_NOT_RECTANGULAR_STARTER" };
	}
	const existingLines =
		input.orientation === "vertical" ? grid.xLines : grid.zLines;
	const minimum = input.orientation === "vertical" ? grid.minXmm : grid.minZmm;
	const maximum = input.orientation === "vertical" ? grid.maxXmm : grid.maxZmm;
	const nextLines = sortedUnique([...existingLines, input.offsetMm]);
	if (
		!isSnappedOffset(input.offsetMm, minimum, maximum, grid.thicknessMm) ||
		nextLines.length === existingLines.length ||
		!allSpansUsable(nextLines, grid.thicknessMm)
	) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	if (doesPartitionIntersectFloorItem(project, grid, input)) {
		return { kind: "rejected", reasonCode: "WALL_ITEM_COLLISION" };
	}

	const xLines = input.orientation === "vertical" ? nextLines : grid.xLines;
	const zLines = input.orientation === "horizontal" ? nextLines : grid.zLines;
	return {
		kind: "accepted",
		project: rebuildGrid(project, grid, xLines, zLines, ids, updatedAt),
	};
}

function addPlanGraphPartition(
	project: Project,
	input: ConstrainedPartitionInput,
	ids: IdSource,
	updatedAt: string,
): AddConstrainedPartitionResult {
	const resolved = resolveOrthogonalPlanFaces(project);
	if (resolved.kind === "rejected") return { kind: "rejected", reasonCode: "PLAN_NOT_RECTANGULAR_STARTER" };
	const x = project.level.vertices.map((vertex) => vertex.xMm);
	const z = project.level.vertices.map((vertex) => vertex.zMm);
	const minX = Math.min(...x);
	const maxX = Math.max(...x);
	const minZ = Math.min(...z);
	const maxZ = Math.max(...z);
	const faceArea = resolved.plan.rooms.reduce((total, room) => {
		if (room.facePolygonMm) {
			const polygon = room.facePolygonMm;
			const twiceArea = polygon.reduce((sum, point, index) => {
				const next = polygon[(index + 1) % polygon.length];
				return next ? sum + point.xMm * next.zMm - point.zMm * next.xMm : sum;
			}, 0);
			return total + Math.abs(twiceArea) / 2;
		}
		return total + room.faceTilesMm.reduce((area, box) => area + (box.maxXmm - box.minXmm) * (box.maxZmm - box.minZmm), 0);
	}, 0);
	if (faceArea !== (maxX - minX) * (maxZ - minZ)) return { kind: "rejected", reasonCode: "PLAN_NOT_RECTANGULAR_STARTER" };
	const vertical = input.orientation === "vertical";
	const thicknessMm = input.profile === "bearing" ? 200 : 100;
	if (!isSnappedOffset(input.offsetMm, vertical ? minX : minZ, vertical ? maxX : maxZ, thicknessMm)) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	const added = addGeneralWallToProject(project, {
		start: { xMm: vertical ? input.offsetMm : minX, zMm: vertical ? minZ : input.offsetMm },
		end: { xMm: vertical ? input.offsetMm : maxX, zMm: vertical ? maxZ : input.offsetMm },
		thicknessMm,
		...(input.profile === undefined ? {} : { profile: input.profile }),
	}, ids, updatedAt);
	if (added.kind === "accepted") return added;
	const reasonCode = added.reasonCode;
	return { kind: "rejected", reasonCode: reasonCode === "WALL_DOOR_OPENING_COLLISION" ? reasonCode :
		reasonCode === "WALL_ITEM_COLLISION" || reasonCode === "ITEM_HOST_UNRESOLVABLE" ? "WALL_ITEM_COLLISION" : "INVALID_DIMENSION" };
}

/**
 * This protects the supported legacy grid path from constructing a divider
 * through an already placed floor item. It is intentionally an axis-aligned
 * characterization guard; rotated footprints belong to the future canonical
 * PlanGraph route fixed by AD-22/AD-23.
 */
function doesPartitionIntersectFloorItem(
	project: Project,
	grid: OrthogonalGrid,
	input: ConstrainedPartitionInput,
): boolean {
	const halfThicknessMm = grid.thicknessMm / 2;
	return project.assetInstances.some(
		(item) =>
			!isFloorSchematicAssetInstance(item) ||
			(input.orientation === "vertical"
				? item.xMm - item.widthMm / 2 < input.offsetMm + halfThicknessMm &&
					item.xMm + item.widthMm / 2 > input.offsetMm - halfThicknessMm &&
					item.zMm - item.depthMm / 2 < grid.maxZmm &&
					item.zMm + item.depthMm / 2 > grid.minZmm
				: item.zMm - item.depthMm / 2 < input.offsetMm + halfThicknessMm &&
					item.zMm + item.depthMm / 2 > input.offsetMm - halfThicknessMm &&
					item.xMm - item.widthMm / 2 < grid.maxXmm &&
					item.xMm + item.widthMm / 2 > grid.minXmm),
	);
}

/**
 * Adds a full outer strip to the proven orthogonal-grid subset. The previous
 * boundary becomes an internal grid line, so every existing Room face is
 * preserved exactly and receives its existing identity.
 */
export function expandOrthogonalGrid(
	project: Project,
	input: OrthogonalGridExpansionInput,
	ids: IdSource,
	updatedAt: string,
): AddConstrainedPartitionResult {
	const grid = readOrthogonalGrid(project);
	if (!grid) {
		return { kind: "rejected", reasonCode: "PLAN_NOT_RECTANGULAR_STARTER" };
	}
	if (
		!Number.isSafeInteger(input.amountMm) ||
		input.amountMm <= 0 ||
		input.amountMm % PLAN_GRID_STEP_MM !== 0
	) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	const xLines =
		input.side === "left"
			? sortedUnique([grid.minXmm - input.amountMm, ...grid.xLines])
			: input.side === "right"
				? sortedUnique([...grid.xLines, grid.maxXmm + input.amountMm])
				: grid.xLines;
	const zLines =
		input.side === "top"
			? sortedUnique([grid.minZmm - input.amountMm, ...grid.zLines])
			: input.side === "bottom"
				? sortedUnique([...grid.zLines, grid.maxZmm + input.amountMm])
				: grid.zLines;
	if (
		!allSpansUsable(xLines, grid.thicknessMm) ||
		!allSpansUsable(zLines, grid.thicknessMm)
	) {
		return { kind: "rejected", reasonCode: "INVALID_DIMENSION" };
	}
	return {
		kind: "accepted",
		project: rebuildGrid(project, grid, xLines, zLines, ids, updatedAt),
	};
}

/**
 * Deletes one internal orthogonal divider. A crossed divider is represented by
 * multiple wall segments, so selecting any of those segments removes its
 * complete canonical grid line and merges the adjacent rooms.
 */
export function deleteConstrainedWall(
	project: Project,
	input: DeleteConstrainedWallInput,
	ids: IdSource,
	updatedAt: string,
): DeleteConstrainedWallResult {
	const grid = readOrthogonalGrid(project);
	if (!grid) {
		return { kind: "rejected", reasonCode: "PLAN_NOT_RECTANGULAR_STARTER" };
	}
	const wall = project.level.wallSegments.find(
		(candidate) => candidate.wallSegmentId === input.wallSegmentId,
	);
	if (!wall) {
		return { kind: "rejected", reasonCode: "WALL_NOT_FOUND" };
	}
	const start = vertexForWall(project, wall, "start");
	const end = vertexForWall(project, wall, "end");
	if (!start || !end) {
		return { kind: "rejected", reasonCode: "WALL_NOT_DELETABLE" };
	}

	const isVertical = start.xMm === end.xMm;
	const isHorizontal = start.zMm === end.zMm;
	if (isVertical === isHorizontal) {
		return { kind: "rejected", reasonCode: "WALL_NOT_DELETABLE" };
	}

	const lineMm = isVertical ? start.xMm : start.zMm;
	const minimumMm = isVertical ? grid.minXmm : grid.minZmm;
	const maximumMm = isVertical ? grid.maxXmm : grid.maxZmm;
	if (lineMm === minimumMm || lineMm === maximumMm) {
		return { kind: "rejected", reasonCode: "WALL_BOUNDARY" };
	}
	const lines = isVertical ? grid.xLines : grid.zLines;
	if (!lines.includes(lineMm)) {
		return { kind: "rejected", reasonCode: "WALL_NOT_DELETABLE" };
	}

	const xLines = isVertical
		? lines.filter((line) => line !== lineMm)
		: grid.xLines;
	const zLines = isHorizontal
		? lines.filter((line) => line !== lineMm)
		: grid.zLines;
	const rebuilt = rebuildGrid(project, grid, xLines, zLines, ids, updatedAt);
	const assetInstances = rehostFloorItems(
		rebuilt,
		xLines,
		zLines,
		grid.thicknessMm,
	);
	if (!assetInstances) {
		return { kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" };
	}
	return {
		kind: "accepted",
		project: { ...rebuilt, assetInstances },
	};
}

function isSnappedOffset(
	offsetMm: number,
	minimumMm: number,
	maximumMm: number,
	thicknessMm: number,
): boolean {
	return (
		Number.isSafeInteger(offsetMm) &&
		(offsetMm - minimumMm) % PLAN_GRID_STEP_MM === 0 &&
		offsetMm > minimumMm + thicknessMm &&
		offsetMm < maximumMm - thicknessMm
	);
}

function allSpansUsable(
	lines: readonly number[],
	thicknessMm: number,
): boolean {
	return lines
		.slice(1)
		.every((line, index) => line - (lines[index] ?? line) > thicknessMm);
}

function rebuildGrid(
	project: Project,
	previous: OrthogonalGrid,
	xLines: readonly number[],
	zLines: readonly number[],
	ids: IdSource,
	updatedAt: string,
): Project {
	const previousVertices = new Map(
		project.level.vertices.map((vertex) => [
			coordinateKey(vertex.xMm, vertex.zMm),
			vertex,
		]),
	);
	const vertices: Vertex[] = [];
	const vertexIds = new Map<string, string>();
	for (const zMm of zLines) {
		for (const xMm of xLines) {
			const key = coordinateKey(xMm, zMm);
			const previousVertex = previousVertices.get(key);
			const vertex = previousVertex ?? { vertexId: ids.next(), xMm, zMm };
			vertices.push(vertex);
			vertexIds.set(key, vertex.vertexId);
		}
	}

	const previousWalls = project.level.wallSegments
		.map((wall) => ({
			end: vertexForWall(project, wall, "end"),
			start: vertexForWall(project, wall, "start"),
			wall,
		}))
		.filter(
			(
				entry,
			): entry is {
				readonly end: Vertex;
				readonly start: Vertex;
				readonly wall: WallSegment;
			} => Boolean(entry.end && entry.start),
		);
	const usedWallIds = new Set<string>();
	const walls: WallSegment[] = [];
	const appendEdge = (
		startXmm: number,
		startZmm: number,
		endXmm: number,
		endZmm: number,
	) => {
		const startVertexId = vertexIds.get(coordinateKey(startXmm, startZmm));
		const endVertexId = vertexIds.get(coordinateKey(endXmm, endZmm));
		if (!startVertexId || !endVertexId) {
			return;
		}
		const exact = previousWalls.find(
			(entry) =>
				!usedWallIds.has(entry.wall.wallSegmentId) &&
				edgeKey(
					entry.start.xMm,
					entry.start.zMm,
					entry.end.xMm,
					entry.end.zMm,
				) === edgeKey(startXmm, startZmm, endXmm, endZmm),
		);
		const containing =
			exact ??
			previousWalls.find(
				(entry) =>
					!usedWallIds.has(entry.wall.wallSegmentId) &&
					coversEdge(
						entry.start,
						entry.end,
						startXmm,
						startZmm,
						endXmm,
						endZmm,
					),
			);
		const overlapping =
			containing ??
			previousWalls.find(
				(entry) =>
					!usedWallIds.has(entry.wall.wallSegmentId) &&
					overlapsEdge(
						entry.start,
						entry.end,
						startXmm,
						startZmm,
						endXmm,
						endZmm,
					),
			);
		const wallSegmentId = overlapping?.wall.wallSegmentId ?? ids.next();
		usedWallIds.add(wallSegmentId);
		walls.push({
			endVertexId,
			startVertexId,
			thicknessMm: previous.thicknessMm,
			wallSegmentId,
		});
	};

	for (const zMm of zLines) {
		for (let index = 0; index < xLines.length - 1; index += 1) {
			appendEdge(xLines[index] ?? 0, zMm, xLines[index + 1] ?? 0, zMm);
		}
	}
	for (const xMm of xLines) {
		for (let index = 0; index < zLines.length - 1; index += 1) {
			appendEdge(xMm, zLines[index] ?? 0, xMm, zLines[index + 1] ?? 0);
		}
	}

	const rooms = roomsForGrid(
		previous.cells,
		xLines,
		zLines,
		previous.thicknessMm,
		ids,
	);
	return {
		...project,
		level: { ...project.level, rooms, vertices, wallSegments: walls },
		updatedAt,
	};
}

function rehostFloorItems(
	project: Project,
	xLines: readonly number[],
	zLines: readonly number[],
	thicknessMm: number,
): readonly SchematicAssetInstance[] | undefined {
	const cells = cellsForCoordinates(xLines, zLines);
	const assetInstances: SchematicAssetInstance[] = [];
	for (const item of project.assetInstances) {
		if (!isFloorSchematicAssetInstance(item)) {
			return undefined;
		}
		const roomIndex = cells.findIndex((cell) =>
			isWithinGridCell(item, cell, thicknessMm),
		);
		const room = roomIndex < 0 ? undefined : project.level.rooms[roomIndex];
		if (!room) {
			return undefined;
		}
		assetInstances.push({ ...item, roomId: room.roomId });
	}
	return assetInstances;
}

function isWithinGridCell(
	item: FloorSchematicAssetInstance,
	cell: Omit<GridCell, "room">,
	thicknessMm: number,
): boolean {
	const halfThicknessMm = thicknessMm / 2;
	return (
		Number.isSafeInteger(item.xMm) &&
		Number.isSafeInteger(item.zMm) &&
		Number.isSafeInteger(item.widthMm) &&
		Number.isSafeInteger(item.depthMm) &&
		item.widthMm > 0 &&
		item.depthMm > 0 &&
		item.xMm - item.widthMm / 2 >= cell.minXmm + halfThicknessMm &&
		item.xMm + item.widthMm / 2 <= cell.maxXmm - halfThicknessMm &&
		item.zMm - item.depthMm / 2 >= cell.minZmm + halfThicknessMm &&
		item.zMm + item.depthMm / 2 <= cell.maxZmm - halfThicknessMm
	);
}

function roomsForGrid(
	previousCells: readonly GridCell[],
	xLines: readonly number[],
	zLines: readonly number[],
	thicknessMm: number,
	ids: IdSource,
): readonly Room[] {
	const assignedRoomIds = new Set<string>();
	return cellsForCoordinates(xLines, zLines).map((cell) => {
		const exact = previousCells.find((previous) => sameBounds(previous, cell));
		const containing = previousCells.find(
			(previous) =>
				!assignedRoomIds.has(previous.room.roomId) &&
				containsBounds(previous, cell),
		);
		const contained = previousCells.find(
			(previous) =>
				!assignedRoomIds.has(previous.room.roomId) &&
				containsBounds(cell, previous),
		);
		const source = exact ?? containing ?? contained;
		const roomId =
			source && !assignedRoomIds.has(source.room.roomId)
				? source.room.roomId
				: ids.next();
		assignedRoomIds.add(roomId);
		return {
			faceFingerprint: gridFingerprint(cell, thicknessMm),
			heightMm: source?.room.heightMm ?? previousCells[0]?.room.heightMm ?? 0,
			roomId,
		};
	});
}

function readOrthogonalGrid(project: Project): OrthogonalGrid | undefined {
	const vertices = project.level.vertices;
	if (
		vertices.length < 4 ||
		project.level.wallSegments.length < 4 ||
		project.level.rooms.length === 0
	) {
		return undefined;
	}
	const xLines = sortedUnique(vertices.map((vertex) => vertex.xMm));
	const zLines = sortedUnique(vertices.map((vertex) => vertex.zMm));
	const minXmm = xLines[0];
	const maxXmm = xLines.at(-1);
	const minZmm = zLines[0];
	const maxZmm = zLines.at(-1);
	const thicknessMm = project.level.wallSegments[0]?.thicknessMm;
	if (
		minXmm === undefined ||
		maxXmm === undefined ||
		minZmm === undefined ||
		maxZmm === undefined ||
		!Number.isSafeInteger(thicknessMm) ||
		thicknessMm <= 0 ||
		vertices.some(
			(vertex) =>
				!Number.isSafeInteger(vertex.xMm) || !Number.isSafeInteger(vertex.zMm),
		) ||
		project.level.wallSegments.some((wall) => wall.thicknessMm !== thicknessMm)
	) {
		return undefined;
	}
	const byCoordinate = new Map(
		vertices.map((vertex) => [coordinateKey(vertex.xMm, vertex.zMm), vertex]),
	);
	if (
		byCoordinate.size !== vertices.length ||
		byCoordinate.size !== xLines.length * zLines.length
	) {
		return undefined;
	}
	const expectedEdges = expectedGridEdges(xLines, zLines);
	const actualEdges = project.level.wallSegments.map((wall) => {
		const start = vertexForWall(project, wall, "start");
		const end = vertexForWall(project, wall, "end");
		return start && end
			? edgeKey(start.xMm, start.zMm, end.xMm, end.zMm)
			: undefined;
	});
	const resolvedEdges = actualEdges.filter(
		(edge): edge is string => edge !== undefined,
	);
	if (resolvedEdges.length !== actualEdges.length) {
		return undefined;
	}
	if (
		new Set(resolvedEdges).size !== expectedEdges.size ||
		resolvedEdges.some((edge) => !expectedEdges.has(edge))
	) {
		return undefined;
	}
	const cells = cellsForCoordinates(xLines, zLines);
	const rooms = cells.map((cell) => {
		const candidates = project.level.rooms.filter((room) =>
			roomMatchesCell(room, cell, minXmm, maxXmm, minZmm, maxZmm, thicknessMm),
		);
		return candidates.length === 1
			? { ...cell, room: candidates[0] }
			: undefined;
	});
	if (
		rooms.some((cell) => !cell) ||
		rooms.length !== project.level.rooms.length
	) {
		return undefined;
	}
	return {
		cells: rooms as readonly GridCell[],
		maxXmm,
		maxZmm,
		minXmm,
		minZmm,
		thicknessMm,
		xLines,
		zLines,
	};
}

function roomMatchesCell(
	room: Room,
	cell: Omit<GridCell, "room">,
	minXmm: number,
	maxXmm: number,
	minZmm: number,
	maxZmm: number,
	thicknessMm: number,
): boolean {
	if (
		room.faceFingerprint ===
		`grid:${cell.minXmm}:${cell.maxXmm}:${cell.minZmm}:${cell.maxZmm}:${thicknessMm}`
	) {
		return true;
	}
	if (
		room.faceFingerprint ===
		`rectangular:${maxXmm - minXmm}:${maxZmm - minZmm}:${thicknessMm}`
	) {
		return (
			cell.minXmm === minXmm &&
			cell.maxXmm === maxXmm &&
			cell.minZmm === minZmm &&
			cell.maxZmm === maxZmm
		);
	}
	const partition =
		/^partition:(vertical|horizontal):(left|right|top|bottom):(\d+):(\d+):(\d+):(\d+)$/.exec(
			room.faceFingerprint,
		);
	if (!partition) {
		return false;
	}
	const [, orientation, side, widthRaw, depthRaw, offsetRaw, thicknessRaw] =
		partition;
	if (
		Number(widthRaw) !== maxXmm - minXmm ||
		Number(depthRaw) !== maxZmm - minZmm ||
		Number(thicknessRaw) !== thicknessMm
	) {
		return false;
	}
	const offsetMm = Number(offsetRaw);
	if (orientation === "vertical") {
		return side === "left"
			? cell.minXmm === minXmm &&
					cell.maxXmm === minXmm + offsetMm &&
					cell.minZmm === minZmm &&
					cell.maxZmm === maxZmm
			: side === "right" &&
					cell.minXmm === minXmm + offsetMm &&
					cell.maxXmm === maxXmm &&
					cell.minZmm === minZmm &&
					cell.maxZmm === maxZmm;
	}
	return side === "top"
		? cell.minXmm === minXmm &&
				cell.maxXmm === maxXmm &&
				cell.minZmm === minZmm &&
				cell.maxZmm === minZmm + offsetMm
		: side === "bottom" &&
				cell.minXmm === minXmm &&
				cell.maxXmm === maxXmm &&
				cell.minZmm === minZmm + offsetMm &&
				cell.maxZmm === maxZmm;
}

function cellsForCoordinates(
	xLines: readonly number[],
	zLines: readonly number[],
): readonly Omit<GridCell, "room">[] {
	const cells: Array<Omit<GridCell, "room">> = [];
	for (let zIndex = 0; zIndex < zLines.length - 1; zIndex += 1) {
		for (let xIndex = 0; xIndex < xLines.length - 1; xIndex += 1) {
			cells.push({
				maxXmm: xLines[xIndex + 1] ?? 0,
				maxZmm: zLines[zIndex + 1] ?? 0,
				minXmm: xLines[xIndex] ?? 0,
				minZmm: zLines[zIndex] ?? 0,
			});
		}
	}
	return cells;
}

function expectedGridEdges(
	xLines: readonly number[],
	zLines: readonly number[],
): Set<string> {
	const edges = new Set<string>();
	for (const zMm of zLines) {
		for (let index = 0; index < xLines.length - 1; index += 1) {
			edges.add(edgeKey(xLines[index] ?? 0, zMm, xLines[index + 1] ?? 0, zMm));
		}
	}
	for (const xMm of xLines) {
		for (let index = 0; index < zLines.length - 1; index += 1) {
			edges.add(edgeKey(xMm, zLines[index] ?? 0, xMm, zLines[index + 1] ?? 0));
		}
	}
	return edges;
}

function vertexForWall(
	project: Project,
	wall: WallSegment,
	side: "start" | "end",
): Vertex | undefined {
	const vertexId = side === "start" ? wall.startVertexId : wall.endVertexId;
	return project.level.vertices.find((vertex) => vertex.vertexId === vertexId);
}

function coversEdge(
	start: Vertex,
	end: Vertex,
	edgeStartXmm: number,
	edgeStartZmm: number,
	edgeEndXmm: number,
	edgeEndZmm: number,
): boolean {
	if (
		start.xMm === end.xMm &&
		edgeStartXmm === edgeEndXmm &&
		start.xMm === edgeStartXmm
	) {
		return (
			Math.min(start.zMm, end.zMm) <= Math.min(edgeStartZmm, edgeEndZmm) &&
			Math.max(start.zMm, end.zMm) >= Math.max(edgeStartZmm, edgeEndZmm)
		);
	}
	if (
		start.zMm === end.zMm &&
		edgeStartZmm === edgeEndZmm &&
		start.zMm === edgeStartZmm
	) {
		return (
			Math.min(start.xMm, end.xMm) <= Math.min(edgeStartXmm, edgeEndXmm) &&
			Math.max(start.xMm, end.xMm) >= Math.max(edgeStartXmm, edgeEndXmm)
		);
	}
	return false;
}

function overlapsEdge(
	start: Vertex,
	end: Vertex,
	edgeStartXmm: number,
	edgeStartZmm: number,
	edgeEndXmm: number,
	edgeEndZmm: number,
): boolean {
	if (
		start.xMm === end.xMm &&
		edgeStartXmm === edgeEndXmm &&
		start.xMm === edgeStartXmm
	) {
		return (
			Math.max(
				Math.min(start.zMm, end.zMm),
				Math.min(edgeStartZmm, edgeEndZmm),
			) <
			Math.min(Math.max(start.zMm, end.zMm), Math.max(edgeStartZmm, edgeEndZmm))
		);
	}
	if (
		start.zMm === end.zMm &&
		edgeStartZmm === edgeEndZmm &&
		start.zMm === edgeStartZmm
	) {
		return (
			Math.max(
				Math.min(start.xMm, end.xMm),
				Math.min(edgeStartXmm, edgeEndXmm),
			) <
			Math.min(Math.max(start.xMm, end.xMm), Math.max(edgeStartXmm, edgeEndXmm))
		);
	}
	return false;
}

function sameBounds(
	first: Omit<GridCell, "room">,
	second: Omit<GridCell, "room">,
): boolean {
	return (
		first.minXmm === second.minXmm &&
		first.maxXmm === second.maxXmm &&
		first.minZmm === second.minZmm &&
		first.maxZmm === second.maxZmm
	);
}

function containsBounds(
	container: Omit<GridCell, "room">,
	candidate: Omit<GridCell, "room">,
): boolean {
	return (
		candidate.minXmm >= container.minXmm &&
		candidate.maxXmm <= container.maxXmm &&
		candidate.minZmm >= container.minZmm &&
		candidate.maxZmm <= container.maxZmm
	);
}

function gridFingerprint(
	cell: Omit<GridCell, "room">,
	thicknessMm: number,
): string {
	return `grid:${cell.minXmm}:${cell.maxXmm}:${cell.minZmm}:${cell.maxZmm}:${thicknessMm}`;
}

function coordinateKey(xMm: number, zMm: number): string {
	return `${xMm}:${zMm}`;
}

function edgeKey(
	startXmm: number,
	startZmm: number,
	endXmm: number,
	endZmm: number,
): string {
	const first = coordinateKey(startXmm, startZmm);
	const second = coordinateKey(endXmm, endZmm);
	return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function sortedUnique(values: readonly number[]): readonly number[] {
	return [...new Set(values)].sort((first, second) => first - second);
}
