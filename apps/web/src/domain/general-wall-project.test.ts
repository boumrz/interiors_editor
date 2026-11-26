import { describe, expect, it } from "@rstest/core";
import { resolveOrthogonalPlanFaces } from "./derived-orthogonal-plan-faces";
import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
} from "./door-opening-project";
import {
	addGeneralWallToProject,
	addGeneralWallToProjectWithHostResolution,
	changeGeneralWallThickness,
	deleteGeneralVertex,
	deleteGeneralWallFromProject,
	deleteGeneralWallWithConsequenceResolution,
	deleteGeneralWallWithOpeningResolution,
	moveGeneralVertex,
	moveGeneralWall,
	previewOpeningConflictForWallDeletion,
	previewOpeningConflictForWallSplit,
	previewWallAddHostConflict,
	previewWallDeletionConflict,
	previewWallSplitHostConflict,
	reconcileMissingRoomsFromPlanGraph,
	reverseGeneralWall,
	splitGeneralWall,
	splitGeneralWallWithHostResolution,
	splitGeneralWallWithOpeningResolution,
	uninterruptedWallRun,
} from "./general-wall-project";
import { createInitialProject } from "./initial-project";
import { createParametricFloorItem } from "./parametric-item";
import { createParametricWallItem } from "./parametric-wall-item";
import { isFloorSchematicAssetInstance, type Project } from "./project";
import { configureRectangularRoom } from "./rectangular-room";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function idsThatMustNotAllocate() {
	return {
		next: () => {
			throw new Error("A rejected wall mutation must not allocate an identity");
		},
	};
}

function starterProject() {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-12T10:00:00.000Z",
			levelId: "level-1",
			name: "Свободный план",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids(
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
		),
		"2026-08-12T10:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected a rectangular starter fixture");
	}
	return configured.project;
}

it("records both mixed profiles and carries their metadata across a wall split", () => {
	const start = { xMm: 1500, zMm: 3100 };
	const result = addGeneralWallToProject(starterProject(), {
		start, end: { xMm: 1500, zMm: 6600 }, thicknessMm: 200, profile: "bearing",
	}, ids("split", "new-vertex", "tail", "bearing-wall"), "2026-11-26T10:00:00.000Z");
	if (result.kind !== "accepted") throw new Error(`Expected valid wall: ${result.reasonCode}`);
	const bearing = result.project.level.wallSegments.find(({ thicknessMm }) => thicknessMm === 200);
	expect(bearing?.profile).toBe("bearing");
	if (!bearing) throw new Error("Expected bearing wall");
	const split = splitGeneralWall(result.project, { wallSegmentId: bearing.wallSegmentId, pointMm: {xMm: 1500, zMm: 4500} }, ids("new-joint", "new-piece"), "2026-11-26T10:01:00.000Z");
	if (split.kind !== "accepted") throw new Error(`Expected valid split: ${split.reasonCode}`);
	expect(split.project.level.wallSegments.filter(({ profile, thicknessMm }) => profile === "bearing" && thicknessMm === 200)).toHaveLength(2);
});

it("preserves the same physical finished side and full sliding track when reversing or splitting a wall", () => {
	const date = "2026-11-26T10:00:00.000Z";
	const starter = starterProject();
	const finish = { presetId: "muted-green-paint", version: 1 } as const;
	const source = { ...starter, level: { ...starter.level, wallSegments: starter.level.wallSegments.map((wall) =>
		wall.wallSegmentId === "wall-1" ? { ...wall, profile: "partition" as const, sideFinishes: { left: finish } } : wall) } };
	const added = addDoorOpeningToProject(source, {
		wallSegmentId: "wall-1", offsetMm: 1500, widthMm: 900, heightMm: 2100, sillMm: 0,
		variant: "sliding", slideSide: "left", slideDirection: "toward-end",
	}, ids("slider"), date);
	if (added.kind !== "accepted") throw new Error(`Expected valid slider: ${added.reasonCode}`);
	const reversed = reverseGeneralWall(added.project, { wallSegmentId: "wall-1" }, date);
	if (reversed.kind !== "accepted") throw new Error(`Expected valid reversal: ${reversed.reasonCode}`);
	expect(reversed.project.level.wallSegments.find(({ wallSegmentId }) => wallSegmentId === "wall-1")?.sideFinishes).toEqual({ right: finish });
	expect(reversed.project.level.openings[0]).toMatchObject({ offsetMm: 2600, slideSide: "right", slideDirection: "toward-start" });
	const cut = splitGeneralWall(added.project, { wallSegmentId: "wall-1", positionMm: 2300 }, idsThatMustNotAllocate(), date);
	expect(cut.kind).toBe("rejected");
	const split = splitGeneralWall(added.project, { wallSegmentId: "wall-1", positionMm: 3200 }, ids("joint", "tail"), date);
	if (split.kind !== "accepted") throw new Error(`Expected valid split: ${split.reasonCode}`);
	expect(split.project.level.wallSegments.filter(({ profile }) => profile === "partition").map(({ sideFinishes }) => sideFinishes)).toEqual([{ left: finish }, { left: finish }]);
});

it("inherits floor finish in both split rooms and resolves a later unequal merge independently of metadata", () => {
	const date = "2026-11-26T10:00:00.000Z";
	const starter = starterProject();
	const oak = { presetId: "light-oak", version: 1 } as const;
	const tile = { presetId: "matte-floor-tile", version: 1 } as const;
	const source = { ...starter, level: { ...starter.level, rooms: starter.level.rooms.map((room) => ({ ...room, floorFinish: oak })) } };
	const added = addGeneralWallToProject(source, {
		start: { xMm: 2050, zMm: 0 }, end: { xMm: 2050, zMm: 3100 }, thicknessMm: 100,
	}, ids("divider-bottom", "divider-top", "bottom-tail", "top-tail", "divider", "room-right"), date);
	if (added.kind !== "accepted") throw new Error(`Expected split rooms: ${added.reasonCode}`);
	expect(added.project.level.rooms.map(({ floorFinish }) => floorFinish)).toEqual([oak, oak]);
	const unequal = { ...added.project, level: { ...added.project.level, rooms: added.project.level.rooms.map((room) =>
		room.roomId === "room-right" ? { ...room, floorFinish: tile } : room) } };
	const preview = previewWallDeletionConflict(unequal, { wallSegmentId: "divider" });
	const conflict = preview.kind === "conflict" ? preview.roomMetadataConflicts?.[0] : undefined;
	if (!conflict) throw new Error("Expected merge conflict");
	expect(conflict.floorFinishChoices).toEqual([{ roomId: "room-1", floorFinish: oak }, { roomId: "room-right", floorFinish: tile }]);
	const merged = deleteGeneralWallWithConsequenceResolution(unequal, {
		wallSegmentId: "divider", openingIds: [], itemIds: [], roomIds: ["room-1", "room-right"],
		roomMetadataResolutions: [{ targetFaceKey: conflict.targetFaceKey, retainedRoomId: "room-1", retainedFloorFinishRoomId: "room-right" }],
	}, date);
	expect(merged).toMatchObject({ kind: "accepted", project: { level: { rooms: [{ roomId: "room-1", floorFinish: tile }] } } });
});

it("inherits both room layouts when a contour split assigns furniture to the new room", () => {
	const source = projectWithTable(3000, 1500);
	const layouts = [
		{ roomId: "room-1", layoutId: "old-a", slot: "A", name: "Первый" },
		{ roomId: "room-1", layoutId: "old-b", slot: "B", name: "Второй" },
	] as const;
	const configured: Project = { ...source, roomLayouts: layouts, assetInstances: source.assetInstances.map((item) =>
		isFloorSchematicAssetInstance(item) ? { ...item, roomLayoutId: "old-b" } : item) };
	const split = addGeneralWallToProject(configured, {
		start: { xMm: 2050, zMm: 0 }, end: { xMm: 2050, zMm: 3100 }, thicknessMm: 100,
	}, ids("divider-bottom", "divider-top", "bottom-tail", "top-tail", "divider", "room-right", "right-a", "right-b"), source.updatedAt);
	if (split.kind !== "accepted") throw new Error(`Expected split: ${split.reasonCode}`);
	expect(split.project.roomLayouts).toEqual([...layouts,
		{ ...layouts[0], roomId: "room-right", layoutId: "right-a" },
		{ ...layouts[1], roomId: "room-right", layoutId: "right-b" },
	]);
	expect(split.project.assetInstances[0]).toMatchObject({ assetInstanceId: "item-1", roomId: "room-right", roomLayoutId: "right-b" });
});

it("duplicates the incoming support and its guest when one room merges into a two-layout room", () => {
	const date = "2026-11-26T10:00:00.000Z";
	const divided = addGeneralWallToProject(starterProject(), {
		start: { xMm: 2050, zMm: 0 }, end: { xMm: 2050, zMm: 3100 }, thicknessMm: 100,
	}, ids("divider-bottom", "divider-top", "bottom-tail", "top-tail", "divider", "room-right"), date);
	if (divided.kind !== "accepted") throw new Error(`Expected rooms: ${divided.reasonCode}`);
	const cabinet = createParametricFloorItem(divided.project, {
		roomId: "room-right", label: "Тумбочка", catalogPreset: { presetId: "bedside-table", version: 1 },
		xMm: 3000, zMm: 1500, widthMm: 500, depthMm: 400, heightMm: 600, color: "#536d62",
	}, ids("cabinet"), date);
	if (cabinet.kind !== "accepted") throw new Error(`Expected support: ${cabinet.reasonCode}`);
	const source: Project = { ...cabinet.project, roomLayouts: [
		{ roomId: "room-1", layoutId: "original-a", slot: "A", name: "А" },
		{ roomId: "room-1", layoutId: "original-b", slot: "B", name: "Б" },
	], supportedItems: [{
		assetInstanceId: "plant", anchorClass: "support", label: "Кашпо", catalogPreset: { presetId: "planter", version: 1 },
		widthMm: 350, depthMm: 350, heightMm: 450, color: "#536d62", supportAssetInstanceId: "cabinet", supportSurfaceKey: "top",
		offsetXMm: 40, offsetZMm: 0, relativeYawMilliDeg: 0,
	}] };
	const preview = previewWallDeletionConflict(source, { wallSegmentId: "divider" });
	const conflict = preview.kind === "conflict" ? preview.roomMetadataConflicts?.[0] : undefined;
	if (!conflict) throw new Error("Expected room metadata decision");
	const merged = deleteGeneralWallWithConsequenceResolution(source, {
		wallSegmentId: "divider", openingIds: [], itemIds: [], roomIds: ["room-1", "room-right"],
		roomMetadataResolutions: [{ targetFaceKey: conflict.targetFaceKey, retainedRoomId: "room-1" }],
	}, date, false, ids("cabinet-b", "plant-b"));
	if (merged.kind !== "accepted") throw new Error(`Expected merge: ${merged.reasonCode}`);
	expect(merged.project.assetInstances).toMatchObject([
		{ assetInstanceId: "cabinet", roomId: "room-1", roomLayoutId: "original-a" },
		{ assetInstanceId: "cabinet-b", roomId: "room-1", roomLayoutId: "original-b" },
	]);
	expect(merged.project.supportedItems).toMatchObject([
		{ assetInstanceId: "plant", supportAssetInstanceId: "cabinet" },
		{ assetInstanceId: "plant-b", supportAssetInstanceId: "cabinet-b" },
	]);
});

it("rejects merging two rooms that each contain two layouts without consuming an identity", () => {
	const date = "2026-11-26T10:00:00.000Z";
	const divided = addGeneralWallToProject(starterProject(), {
		start: { xMm: 2050, zMm: 0 }, end: { xMm: 2050, zMm: 3100 }, thicknessMm: 100,
	}, ids("divider-bottom", "divider-top", "bottom-tail", "top-tail", "divider", "room-right"), date);
	if (divided.kind !== "accepted") throw new Error(`Expected split: ${divided.reasonCode}`);
	const layouts = ["room-1", "room-right"].flatMap((roomId) => (["A", "B"] as const).map((slot) => ({
		roomId, slot, layoutId: `${roomId}-${slot}`, name: slot,
	})));
	const source: Project = { ...divided.project, roomLayouts: layouts };
	const preview = previewWallDeletionConflict(source, { wallSegmentId: "divider" });
	const conflict = preview.kind === "conflict" ? preview.roomMetadataConflicts?.[0] : undefined;
	if (!conflict) throw new Error("Expected metadata decision");
	const before = JSON.stringify(source);
	expect(deleteGeneralWallWithConsequenceResolution(source, {
		wallSegmentId: "divider", openingIds: [], itemIds: [], roomIds: ["room-1", "room-right"],
		roomMetadataResolutions: [{ targetFaceKey: conflict.targetFaceKey, retainedRoomId: "room-1" }],
	}, date, false, idsThatMustNotAllocate())).toMatchObject({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
	expect(JSON.stringify(source)).toBe(before);
});

function projectWithTable(xMm = 2000, zMm = 1500) {
	const placed = createParametricFloorItem(
		starterProject(),
		{
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm,
			zMm,
		},
		ids("item-1"),
		"2026-08-12T10:02:00.000Z",
	);
	if (placed.kind !== "accepted") {
		throw new Error("Expected a floor-item fixture");
	}
	return placed.project;
}

function projectWithSidewaysTable(
	project = starterProject(),
	roomId = "room-1",
) {
	const placed = createParametricFloorItem(
		project,
		{
			color: "#2f80ed",
			depthMm: 400,
			heightMm: 750,
			label: "Стол",
			roomId,
			widthMm: 1800,
			xMm: 350,
			yawStep: 2,
			zMm: 1200,
		},
		ids("sideways-table"),
		"2026-11-25T10:00:00.000Z",
	);
	if (placed.kind !== "accepted") {
		throw new Error("Expected the rotated table to fit along the left wall");
	}
	return placed.project;
}

function concaveRoomProject(
	points = [
		{ xMm: 0, zMm: 0 },
		{ xMm: 4000, zMm: 0 },
		{ xMm: 4000, zMm: 2000 },
		{ xMm: 2000, zMm: 2000 },
		{ xMm: 2000, zMm: 4000 },
		{ xMm: 0, zMm: 4000 },
	],
) {
	const empty = createInitialProject({
		createdAt: "2026-11-25T09:00:00.000Z",
		levelId: "level-1",
		name: "Комната с нишей",
		projectId: "project-concave-room",
	});
	const timestamp = "2026-11-25T09:01:00.000Z";
	const contourIds = ids(
		"vertex-1",
		"vertex-2",
		"wall-1",
		"vertex-3",
		"wall-2",
		"vertex-4",
		"wall-3",
		"vertex-5",
		"wall-4",
		"vertex-6",
		"wall-5",
		"wall-6",
		"room-concave",
	);
	return points.reduce((project, start, index) => {
		const end = points[(index + 1) % points.length];
		if (!end) throw new Error("Expected a closed contour");
		const added = addGeneralWallToProject(
			project,
			{ start, end, thicknessMm: 100 },
			contourIds,
			timestamp,
		);
		if (added.kind !== "accepted") throw new Error("Expected a valid contour");
		return added.project;
	}, empty);
}

function projectWithDoor() {
	const added = addDoorOpeningToProject(
		starterProject(),
		{
			heightMm: 2100,
			offsetMm: 2050,
			sillMm: 0,
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		ids("door-1"),
		"2026-08-15T10:00:00.000Z",
	);
	if (added.kind !== "accepted") {
		throw new Error("Expected a door-hosted fixture");
	}
	return added.project;
}

function projectWithReversedDiagonalDoor() {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-26T01:00:00.000Z",
			levelId: "level-diagonal-door",
			name: "Диагональная дверь",
			projectId: "project-diagonal-door",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "3000" },
		ids(
			"diag-v-1",
			"diag-v-2",
			"diag-v-3",
			"diag-v-4",
			"diag-wall-1",
			"diag-wall-2",
			"diag-wall-3",
			"diag-wall-4",
			"diag-room-1",
		),
		"2026-08-26T01:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected a square diagonal-door fixture");
	}
	const divided = addGeneralWallToProject(
		configured.project,
		{
			end: { xMm: 0, zMm: 0 },
			start: { xMm: 3100, zMm: 3100 },
			thicknessMm: 100,
		},
		ids("diagonal-host", "diag-room-2"),
		"2026-08-26T01:02:00.000Z",
	);
	if (divided.kind !== "accepted") {
		throw new Error("Expected a diagonal divider");
	}
	const door = addDoorOpeningToProject(
		divided.project,
		{
			heightMm: 2100,
			offsetMm: 2192,
			sillMm: 0,
			swingSide: "left",
			wallSegmentId: "diagonal-host",
			widthMm: 900,
		},
		ids("diagonal-door"),
		"2026-08-26T01:03:00.000Z",
	);
	if (door.kind !== "accepted") {
		throw new Error("Expected a Door on the reversed diagonal host");
	}
	return door.project;
}

function projectWithWindow() {
	const added = addWindowOpeningToProject(
		starterProject(),
		{
			heightMm: 1200,
			offsetMm: 2050,
			sillMm: 900,
			wallSegmentId: "wall-1",
			widthMm: 1200,
		},
		ids("window-1"),
		"2026-08-15T10:00:00.000Z",
	);
	if (added.kind !== "accepted") {
		throw new Error("Expected a window-hosted fixture");
	}
	return added.project;
}

function projectWithWallPanel(offsetMm: number) {
	const placed = createParametricWallItem(
		starterProject(),
		{
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Настенная панель",
			offsetMm,
			side: "right",
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		ids("wall-panel-1"),
		"2026-08-24T15:30:00.000Z",
	);
	if (placed.kind !== "accepted") {
		throw new Error("Expected a wall-panel fixture");
	}
	return placed.project;
}

function projectWithDiagonalWallPanel(offsetMm: number, widthMm = 100) {
	const detached = addGeneralWallToProject(
		starterProject(),
		{
			end: { xMm: 6002, zMm: 6002 },
			start: { xMm: 5000, zMm: 5000 },
			thicknessMm: 100,
		},
		ids("diagonal-start", "diagonal-end", "diagonal-host"),
		"2026-08-27T09:04:00.000Z",
	);
	if (detached.kind !== "accepted") {
		throw new Error("Expected a detached diagonal wall fixture");
	}
	const placed = createParametricWallItem(
		detached.project,
		{
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Панель на диагонали",
			offsetMm,
			side: "right",
			wallSegmentId: "diagonal-host",
			widthMm,
		},
		ids("diagonal-panel"),
		"2026-08-27T09:05:00.000Z",
	);
	if (placed.kind !== "accepted") {
		throw new Error("Expected a diagonal panel fixture");
	}
	return placed.project;
}

function projectWithWallPanelsOnDifferentHosts() {
	const placed = createParametricWallItem(
		projectWithWallPanel(3000),
		{
			color: "#835a45",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Вторая настенная панель",
			offsetMm: 1500,
			side: "left",
			wallSegmentId: "wall-2",
			widthMm: 900,
		},
		ids("wall-panel-2"),
		"2026-08-24T15:30:00.000Z",
	);
	if (placed.kind !== "accepted") {
		throw new Error("Expected a second wall-panel fixture");
	}
	return placed.project;
}

function projectWithDoorAndWallPanels() {
	const doorProject = projectWithDoor();
	const first = createParametricWallItem(
		{
			...doorProject,
			level: {
				...doorProject.level,
				openings: doorProject.level.openings.map((opening) => {
					if (opening.kind !== "Door") return opening;
					const { swingSide: _legacyDefault, ...legacyDoor } = opening;
					return { ...legacyDoor, offsetMm: 1000 };
				}),
			},
		},
		{
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Настенная панель",
			offsetMm: 3000,
			side: "left",
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		ids("wall-panel-1"),
		"2026-08-24T23:00:00.000Z",
	);
	if (first.kind !== "accepted") {
		throw new Error("Expected a wall-panel fixture on the Door host");
	}
	const second = createParametricWallItem(
		first.project,
		{
			color: "#835a45",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Незатронутая панель",
			offsetMm: 1500,
			side: "right",
			wallSegmentId: "wall-2",
			widthMm: 900,
		},
		ids("wall-panel-2"),
		"2026-08-24T23:01:00.000Z",
	);
	if (second.kind !== "accepted") {
		throw new Error("Expected a wall-panel fixture on another host");
	}
	return second.project;
}

function projectWithOpeningsOnDifferentWallHosts() {
	const door = addDoorOpeningToProject(
		starterProject(),
		{
			heightMm: 2100,
			offsetMm: 1000,
			sillMm: 0,
			swingSide: "left",
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		ids("door-1"),
		"2026-08-24T23:03:00.000Z",
	);
	if (door.kind !== "accepted") {
		throw new Error("Expected an explicit left-swing Door fixture");
	}
	const firstWindow = addWindowOpeningToProject(
		door.project,
		{
			heightMm: 1200,
			offsetMm: 3000,
			sillMm: 900,
			wallSegmentId: "wall-1",
			widthMm: 600,
		},
		ids("window-1"),
		"2026-08-24T23:04:00.000Z",
	);
	if (firstWindow.kind !== "accepted") {
		throw new Error("Expected a Window fixture on the selected Wall");
	}
	const secondWindow = addWindowOpeningToProject(
		firstWindow.project,
		{
			heightMm: 1200,
			offsetMm: 1500,
			sillMm: 900,
			wallSegmentId: "wall-2",
			widthMm: 600,
		},
		ids("window-2"),
		"2026-08-24T23:05:00.000Z",
	);
	if (secondWindow.kind !== "accepted") {
		throw new Error("Expected a Window fixture on an unaffected Wall");
	}
	return secondWindow.project;
}

describe("general Project wall mutations", () => {
	it.each([
		[
			"a wall position outside the project boundary",
			() =>
				moveGeneralWall(
					starterProject(),
					{ positionMm: 100_001, wallSegmentId: "wall-1" },
					"2026-08-28T09:00:00.000Z",
				),
			"PROJECT_BOUNDS_EXCEEDED",
		],
		[
			"a fractional wall position",
			() =>
				moveGeneralWall(
					starterProject(),
					{ positionMm: 12.5, wallSegmentId: "wall-1" },
					"2026-08-28T09:00:00.000Z",
				),
			"INVALID_DIMENSION",
		],
		[
			"a Vertex position outside the project boundary",
			() =>
				moveGeneralVertex(
					starterProject(),
					{ vertexId: "v-1", xMm: 100_001, zMm: 0 },
					"2026-08-28T09:00:00.000Z",
				),
			"PROJECT_BOUNDS_EXCEEDED",
		],
		[
			"a fractional Vertex x coordinate",
			() =>
				moveGeneralVertex(
					starterProject(),
					{ vertexId: "v-1", xMm: 12.5, zMm: 0 },
					"2026-08-28T09:00:00.000Z",
				),
			"INVALID_DIMENSION",
		],
		[
			"a Vertex z coordinate outside the project boundary",
			() =>
				moveGeneralVertex(
					starterProject(),
					{ vertexId: "v-1", xMm: 0, zMm: 100_001 },
					"2026-08-28T09:00:00.000Z",
				),
			"PROJECT_BOUNDS_EXCEEDED",
		],
		[
			"a fractional Vertex z coordinate",
			() =>
				moveGeneralVertex(
					starterProject(),
					{ vertexId: "v-1", xMm: 0, zMm: 12.5 },
					"2026-08-28T09:00:00.000Z",
				),
			"INVALID_DIMENSION",
		],
	] as const)(
		"rejects %s with its canonical input reason",
		(_case, move, reasonCode) => {
			expect(move()).toEqual({
				kind: "rejected",
				reasonCode,
			});
		},
	);

	it.each([
		[
			"a wall position",
			() =>
				moveGeneralWall(
					starterProject(),
					{ positionMm: 100_000, wallSegmentId: "wall-1" },
					"2026-08-28T09:01:00.000Z",
				),
		],
		[
			"a Vertex x coordinate",
			() =>
				moveGeneralVertex(
					starterProject(),
					{ vertexId: "v-1", xMm: 100_000, zMm: 0 },
					"2026-08-28T09:01:00.000Z",
				),
		],
		[
			"a Vertex z coordinate",
			() =>
				moveGeneralVertex(
					starterProject(),
					{ vertexId: "v-1", xMm: 0, zMm: 100_000 },
					"2026-08-28T09:01:00.000Z",
				),
		],
	] as const)(
		"does not misclassify %s at the inclusive coordinate limit",
		(_case, move) => {
			expect(move()).not.toEqual({
				kind: "rejected",
				reasonCode: "PROJECT_BOUNDS_EXCEEDED",
			});
		},
	);

	it("materializes the first closed 45-degree triangle as one durable Room without a rectangular envelope", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-23T13:10:00.000Z",
			levelId: "level-1",
			name: "Первая диагональная комната",
			projectId: "project-triangle-first",
		});
		const bottom = addGeneralWallToProject(
			empty,
			{
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("a", "b", "bottom"),
			"2026-08-23T13:11:00.000Z",
		);
		if (bottom.kind !== "accepted") {
			throw new Error("Expected the first triangle edge to be accepted");
		}
		const right = addGeneralWallToProject(
			bottom.project,
			{
				end: { xMm: 2000, zMm: 2000 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("c", "right"),
			"2026-08-23T13:12:00.000Z",
		);
		if (right.kind !== "accepted") {
			throw new Error("Expected the second triangle edge to be accepted");
		}

		const closed = addGeneralWallToProject(
			right.project,
			{
				end: { xMm: 0, zMm: 0 },
				start: { xMm: 2000, zMm: 2000 },
				thicknessMm: 100,
			},
			ids("diagonal", "room-triangle"),
			"2026-08-23T13:13:00.000Z",
		);

		expect(closed).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (closed.kind !== "accepted") return;
		expect(closed.project.level.rooms).toEqual([
			{
				faceFingerprint: "orthogonal-face:0:0|2000:0|2000:2000",
				heightMm: 2600,
				roomId: "room-triangle",
			},
		]);
		expect(resolveOrthogonalPlanFaces(closed.project)).toEqual(
			expect.objectContaining({ kind: "accepted" }),
		);
	});

	it("materializes a closed 45-degree trapezoid as one durable Room instead of dropping its face", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-24T22:30:00.000Z",
			levelId: "level-1",
			name: "Диагональная трапеция",
			projectId: "project-trapezoid-first",
		});
		const bottom = addGeneralWallToProject(
			empty,
			{
				end: { xMm: 5000, zMm: 0 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("a", "b", "bottom"),
			"2026-08-24T22:31:00.000Z",
		);
		if (bottom.kind !== "accepted") throw new Error("Expected bottom wall");
		const right = addGeneralWallToProject(
			bottom.project,
			{
				end: { xMm: 5000, zMm: 2000 },
				start: { xMm: 5000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("c", "right"),
			"2026-08-24T22:32:00.000Z",
		);
		if (right.kind !== "accepted") throw new Error("Expected right wall");
		const top = addGeneralWallToProject(
			right.project,
			{
				end: { xMm: 2000, zMm: 2000 },
				start: { xMm: 5000, zMm: 2000 },
				thicknessMm: 100,
			},
			ids("d", "top"),
			"2026-08-24T22:33:00.000Z",
		);
		if (top.kind !== "accepted") throw new Error("Expected top wall");

		const closed = addGeneralWallToProject(
			top.project,
			{
				end: { xMm: 0, zMm: 0 },
				start: { xMm: 2000, zMm: 2000 },
				thicknessMm: 100,
			},
			ids("diagonal", "room-trapezoid"),
			"2026-08-24T22:34:00.000Z",
		);

		expect(closed).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (closed.kind !== "accepted") return;
		expect(closed.project.level.rooms).toEqual([
			{
				faceFingerprint: "orthogonal-face:0:0|2000:2000|5000:2000|5000:0",
				heightMm: 2600,
				roomId: "room-trapezoid",
			},
		]);
		expect(resolveOrthogonalPlanFaces(closed.project)).toEqual(
			expect.objectContaining({ kind: "accepted" }),
		);
	});

	it("materializes a closed concave contour as one durable Room without substituting its rectangular envelope", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-26T10:00:00.000Z",
			levelId: "level-1",
			name: "Первая вогнутая комната",
			projectId: "project-concave-first",
		});
		const contour = [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 2000 }, start: { xMm: 4000, zMm: 0 } },
			{
				end: { xMm: 2000, zMm: 2000 },
				start: { xMm: 4000, zMm: 2000 },
			},
			{
				end: { xMm: 2000, zMm: 4000 },
				start: { xMm: 2000, zMm: 2000 },
			},
			{ end: { xMm: 0, zMm: 4000 }, start: { xMm: 2000, zMm: 4000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 4000 } },
		] as const;
		let project = empty;
		contour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === contour.length - 1
					? ids(`wall-${index + 1}`, "room-concave")
					: ids(
							...(index === 0
								? ["vertex-1", "vertex-2", "wall-1"]
								: [`vertex-${index + 2}`, `wall-${index + 1}`]),
						),
				`2026-08-26T10:0${index + 1}:00.000Z`,
			);
			expect(added).toEqual(expect.objectContaining({ kind: "accepted" }));
			if (added.kind === "accepted") project = added.project;
		});

		expect(project.level.rooms).toEqual([
			{
				faceFingerprint:
					"orthogonal-face:0:0|0:4000|2000:4000|2000:2000|4000:2000|4000:0",
				heightMm: 2600,
				roomId: "room-concave",
			},
		]);
		const projection = resolveOrthogonalPlanFaces(project);
		expect(projection).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (projection.kind !== "accepted") return;
		expect(projection.plan.rooms[0]).toEqual(
			expect.objectContaining({
				facePolygonMm: [
					{ xMm: 0, zMm: 0 },
					{ xMm: 0, zMm: 4000 },
					{ xMm: 2000, zMm: 4000 },
					{ xMm: 2000, zMm: 2000 },
					{ xMm: 4000, zMm: 2000 },
					{ xMm: 4000, zMm: 0 },
				],
				roomId: "room-concave",
				usableFloorPolygonMm: [
					{ xMm: 50, zMm: 50 },
					{ xMm: 50, zMm: 3950 },
					{ xMm: 1950, zMm: 3950 },
					{ xMm: 1950, zMm: 1950 },
					{ xMm: 3950, zMm: 1950 },
					{ xMm: 3950, zMm: 50 },
				],
			}),
		);
	});

	it("inherits the exact L-shaped Room height when one split successor is rectangular", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-26T10:05:00.000Z",
			levelId: "level-concave-lineage",
			name: "Две комнаты разной высоты",
			projectId: "project-concave-lineage",
		});
		const concaveContour = [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 2000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 2000, zMm: 2000 }, start: { xMm: 4000, zMm: 2000 } },
			{ end: { xMm: 2000, zMm: 4000 }, start: { xMm: 2000, zMm: 2000 } },
			{ end: { xMm: 0, zMm: 4000 }, start: { xMm: 2000, zMm: 4000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 4000 } },
		] as const;
		let project = empty;
		concaveContour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === concaveContour.length - 1
					? ids(`concave-wall-${index + 1}`, "room-concave")
					: ids(
							...(index === 0
								? ["concave-vertex-1", "concave-vertex-2", "concave-wall-1"]
								: [`concave-vertex-${index + 2}`, `concave-wall-${index + 1}`]),
						),
				`2026-08-26T10:${String(6 + index).padStart(2, "0")}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a closed L-shaped Room fixture");
			}
			project = added.project;
		});

		const secondContour = [
			{ end: { xMm: 8000, zMm: 0 }, start: { xMm: 6000, zMm: 0 } },
			{ end: { xMm: 8000, zMm: 2000 }, start: { xMm: 8000, zMm: 0 } },
			{ end: { xMm: 6000, zMm: 2000 }, start: { xMm: 8000, zMm: 2000 } },
			{ end: { xMm: 6000, zMm: 0 }, start: { xMm: 6000, zMm: 2000 } },
		] as const;
		secondContour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === secondContour.length - 1
					? ids(`second-wall-${index + 1}`, "room-second")
					: ids(
							...(index === 0
								? ["second-vertex-1", "second-vertex-2", "second-wall-1"]
								: [`second-vertex-${index + 2}`, `second-wall-${index + 1}`]),
						),
				`2026-08-26T10:${String(12 + index).padStart(2, "0")}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a second closed Room fixture");
			}
			project = added.project;
		});

		const source = {
			...project,
			level: {
				...project.level,
				rooms: project.level.rooms.map((room) =>
					room.roomId === "room-concave"
						? {
								...room,
								heightMm: 2400,
								name: "Кухня",
								type: "kitchen" as const,
							}
						: { ...room, heightMm: 3200 },
				),
			},
		};
		const before = JSON.stringify(source);

		const result = addGeneralWallToProject(
			source,
			{
				end: { xMm: 3000, zMm: 2000 },
				start: { xMm: 3000, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"lower-contact",
				"upper-contact",
				"concave-wall-1-tail",
				"concave-wall-3-tail",
				"arm-divider",
				"room-arm",
			),
			"2026-08-26T10:20:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toHaveLength(3);
		expect(result.project.level.rooms).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					heightMm: 2400,
					name: "Кухня",
					roomId: "room-concave",
					type: "kitchen",
				}),
				{
					faceFingerprint: "grid:3000:4000:0:2000:100",
					heightMm: 2400,
					roomId: "room-arm",
				},
				expect.objectContaining({
					heightMm: 3200,
					roomId: "room-second",
				}),
			]),
		);
		expect(resolveOrthogonalPlanFaces(result.project)).toEqual(
			expect.objectContaining({ kind: "accepted" }),
		);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("changes one boundary thickness of a closed concave Room without moving its centerline or replacing Room height", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-26T10:10:00.000Z",
			levelId: "level-1",
			name: "Толщина вогнутой комнаты",
			projectId: "project-concave-thickness",
		});
		const contour = [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 2000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 2000, zMm: 2000 }, start: { xMm: 4000, zMm: 2000 } },
			{ end: { xMm: 2000, zMm: 4000 }, start: { xMm: 2000, zMm: 2000 } },
			{ end: { xMm: 0, zMm: 4000 }, start: { xMm: 2000, zMm: 4000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 4000 } },
		] as const;
		let project = empty;
		contour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === contour.length - 1
					? ids(`wall-${index + 1}`, "room-concave")
					: ids(
							...(index === 0
								? ["vertex-1", "vertex-2", "wall-1"]
								: [`vertex-${index + 2}`, `wall-${index + 1}`]),
						),
				`2026-08-26T10:1${index + 1}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a closed concave fixture");
			}
			project = added.project;
		});
		const sourceVertices = project.level.vertices;
		const sourceRoom = project.level.rooms[0];

		const result = changeGeneralWallThickness(
			project,
			{ thicknessMm: 120, wallSegmentId: "wall-1" },
			"2026-08-26T10:20:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.vertices).toEqual(sourceVertices);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					thicknessMm: 120,
					wallSegmentId: "wall-1",
				}),
			]),
		);
		expect(result.project.level.rooms).toEqual([
			expect.objectContaining({
				heightMm: sourceRoom?.heightMm,
				roomId: "room-concave",
			}),
		]);
		const projection = resolveOrthogonalPlanFaces(result.project);
		expect(projection).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (projection.kind !== "accepted") return;
		expect(projection.plan.rooms[0]?.usableFloorPolygonMm).toEqual([
			{ xMm: 50, zMm: 60 },
			{ xMm: 50, zMm: 3950 },
			{ xMm: 1950, zMm: 3950 },
			{ xMm: 1950, zMm: 1950 },
			{ xMm: 3950, zMm: 1950 },
			{ xMm: 3950, zMm: 60 },
		]);
	});

	it("rejects a concave boundary thickness that collapses its exact usable polygon", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-26T10:30:00.000Z",
			levelId: "level-1",
			name: "Узкая вогнутая комната",
			projectId: "project-narrow-concave-thickness",
		});
		const contour = [
			{ end: { xMm: 1000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 1000, zMm: 400 }, start: { xMm: 1000, zMm: 0 } },
			{ end: { xMm: 200, zMm: 400 }, start: { xMm: 1000, zMm: 400 } },
			{ end: { xMm: 200, zMm: 1000 }, start: { xMm: 200, zMm: 400 } },
			{ end: { xMm: 0, zMm: 1000 }, start: { xMm: 200, zMm: 1000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 1000 } },
		] as const;
		let project = empty;
		contour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === contour.length - 1
					? ids(`narrow-wall-${index + 1}`, "room-narrow-concave")
					: ids(
							...(index === 0
								? ["narrow-vertex-1", "narrow-vertex-2", "narrow-wall-1"]
								: [`narrow-vertex-${index + 2}`, `narrow-wall-${index + 1}`]),
						),
				`2026-08-26T10:3${index + 1}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a narrow closed concave fixture");
			}
			project = added.project;
		});
		const before = JSON.stringify(project);

		expect(
			changeGeneralWallThickness(
				project,
				{ thicknessMm: 300, wallSegmentId: "narrow-wall-4" },
				"2026-08-26T10:40:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "USABLE_POLYGON_COLLAPSED" });
		expect(JSON.stringify(project)).toBe(before);
	});

	it("splits one boundary Wall of a closed concave Room without changing its exact usable polygon", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-26T11:00:00.000Z",
			levelId: "level-1",
			name: "Разделение стены вогнутой комнаты",
			projectId: "project-concave-wall-split",
		});
		const contour = [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 2000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 2000, zMm: 2000 }, start: { xMm: 4000, zMm: 2000 } },
			{ end: { xMm: 2000, zMm: 4000 }, start: { xMm: 2000, zMm: 2000 } },
			{ end: { xMm: 0, zMm: 4000 }, start: { xMm: 2000, zMm: 4000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 4000 } },
		] as const;
		let project = empty;
		contour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === contour.length - 1
					? ids(`split-wall-${index + 1}`, "room-concave")
					: ids(
							...(index === 0
								? ["split-vertex-1", "split-vertex-2", "split-wall-1"]
								: [`split-vertex-${index + 2}`, `split-wall-${index + 1}`]),
						),
				`2026-08-26T11:0${index + 1}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a closed concave split fixture");
			}
			project = added.project;
		});
		const before = JSON.stringify(project);

		const result = splitGeneralWall(
			project,
			{ positionMm: 2000, wallSegmentId: "split-wall-1" },
			ids("inline-concave-vertex", "split-wall-1-tail"),
			"2026-08-26T11:10:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "inline-concave-vertex", xMm: 2000, zMm: 0 },
			]),
		);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "inline-concave-vertex",
					startVertexId: "split-vertex-1",
					wallSegmentId: "split-wall-1",
				}),
				expect.objectContaining({
					endVertexId: "split-vertex-2",
					startVertexId: "inline-concave-vertex",
					wallSegmentId: "split-wall-1-tail",
				}),
			]),
		);
		expect(result.project.level.rooms).toEqual([
			expect.objectContaining({ heightMm: 2600, roomId: "room-concave" }),
		]);
		const projection = resolveOrthogonalPlanFaces(result.project);
		expect(projection).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (projection.kind !== "accepted") return;
		expect(projection.plan.rooms[0]?.usableFloorPolygonMm).toEqual([
			{ xMm: 50, zMm: 50 },
			{ xMm: 50, zMm: 3950 },
			{ xMm: 1950, zMm: 3950 },
			{ xMm: 1950, zMm: 1950 },
			{ xMm: 3950, zMm: 1950 },
			{ xMm: 3950, zMm: 50 },
		]);
		expect(projection.plan.walls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					exteriorNormal: { x: 0, z: -1 },
					wallSegmentId: "split-wall-1",
				}),
				expect.objectContaining({
					exteriorNormal: { x: 0, z: -1 },
					wallSegmentId: "split-wall-1-tail",
				}),
			]),
		);
		const merged = deleteGeneralVertex(
			result.project,
			{ vertexId: "inline-concave-vertex" },
			"2026-08-26T11:10:30.000Z",
		);
		expect(merged).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (merged.kind !== "accepted") return;
		expect(merged.project.level.rooms).toEqual(result.project.level.rooms);
		expect(resolveOrthogonalPlanFaces(merged.project)).toMatchObject({
			kind: "accepted",
			plan: {
				rooms: [
					{
						roomId: "room-concave",
						usableFloorPolygonMm:
							projection.plan.rooms[0]?.usableFloorPolygonMm,
					},
				],
			},
		});
		const splitBeforeUnequalThickness = JSON.stringify(result.project);
		const thickened = changeGeneralWallThickness(
			result.project,
			{ thicknessMm: 120, wallSegmentId: "split-wall-1-tail" },
			"2026-08-26T11:11:00.000Z",
		);
		expect(thickened).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (thickened.kind !== "accepted") return;
		expect(thickened.project.level.vertices).toEqual(
			result.project.level.vertices,
		);
		expect(thickened.project.level.rooms).toEqual(result.project.level.rooms);
		const thickenedProjection = resolveOrthogonalPlanFaces(thickened.project);
		expect(thickenedProjection).toEqual(
			expect.objectContaining({ kind: "accepted" }),
		);
		if (thickenedProjection.kind !== "accepted") return;
		expect(thickenedProjection.plan.rooms[0]?.usableFloorPolygonMm).toEqual([
			{ xMm: 50, zMm: 50 },
			{ xMm: 50, zMm: 3950 },
			{ xMm: 1950, zMm: 3950 },
			{ xMm: 1950, zMm: 1950 },
			{ xMm: 3950, zMm: 1950 },
			{ xMm: 3950, zMm: 60 },
			{ xMm: 2000, zMm: 60 },
			{ xMm: 2000, zMm: 50 },
		]);
		expect(JSON.stringify(result.project)).toBe(splitBeforeUnequalThickness);
		expect(JSON.stringify(project)).toBe(before);
	});

	it("moves an equal-leg corner of a closed concave Room onto its shared 45-degree line", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-26T10:10:00.000Z",
			levelId: "level-1",
			name: "Правка вогнутой комнаты",
			projectId: "project-concave-corner-move",
		});
		const contour = [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 2000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 2000, zMm: 2000 }, start: { xMm: 4000, zMm: 2000 } },
			{ end: { xMm: 2000, zMm: 4000 }, start: { xMm: 2000, zMm: 2000 } },
			{ end: { xMm: 0, zMm: 4000 }, start: { xMm: 2000, zMm: 4000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 4000 } },
		] as const;
		let project = empty;
		contour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === contour.length - 1
					? ids(`wall-${index + 1}`, "room-concave")
					: ids(
							...(index === 0
								? ["vertex-1", "vertex-2", "wall-1"]
								: [`vertex-${index + 2}`, `wall-${index + 1}`]),
						),
				`2026-08-26T10:1${index + 1}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a closed concave fixture");
			}
			project = added.project;
		});
		const before = JSON.stringify(project);

		const result = moveGeneralVertex(
			project,
			{ vertexId: "vertex-4", xMm: 3000, zMm: 3000 },
			"2026-08-26T10:20:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					vertexId: "vertex-4",
					xMm: 3000,
					zMm: 3000,
				}),
			]),
		);
		expect(result.project.level.rooms).toEqual([
			expect.objectContaining({
				heightMm: 2600,
				roomId: "room-concave",
			}),
		]);
		expect(JSON.stringify(project)).toBe(before);

		const unequalThicknessProject = {
			...project,
			level: {
				...project.level,
				wallSegments: project.level.wallSegments.map((wall) =>
					wall.wallSegmentId === "wall-4"
						? { ...wall, thicknessMm: 120 }
						: wall,
				),
			},
		};
		const unequalBefore = JSON.stringify(unequalThicknessProject);
		expect(
			moveGeneralVertex(
				unequalThicknessProject,
				{ vertexId: "vertex-4", xMm: 3000, zMm: 3000 },
				"2026-08-26T10:21:00.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(JSON.stringify(unequalThicknessProject)).toBe(unequalBefore);
	});

	it("closes a four-wall room when its first wall is a 45-degree diagonal and the final wall is cardinal", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-25T09:00:00.000Z",
			levelId: "level-1",
			name: "Диагональ первой стеной",
			projectId: "project-first-diagonal-trapezoid",
		});
		const diagonal = addGeneralWallToProject(
			empty,
			{
				end: { xMm: 2000, zMm: 2000 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("a", "b", "diagonal"),
			"2026-08-25T09:01:00.000Z",
		);
		if (diagonal.kind !== "accepted") throw new Error("Expected diagonal wall");
		const top = addGeneralWallToProject(
			diagonal.project,
			{
				end: { xMm: 5000, zMm: 2000 },
				start: { xMm: 2000, zMm: 2000 },
				thicknessMm: 100,
			},
			ids("c", "top"),
			"2026-08-25T09:02:00.000Z",
		);
		if (top.kind !== "accepted") throw new Error("Expected top wall");
		const right = addGeneralWallToProject(
			top.project,
			{
				end: { xMm: 5000, zMm: 0 },
				start: { xMm: 5000, zMm: 2000 },
				thicknessMm: 100,
			},
			ids("d", "right"),
			"2026-08-25T09:03:00.000Z",
		);
		if (right.kind !== "accepted") throw new Error("Expected right wall");

		const closed = addGeneralWallToProject(
			right.project,
			{
				end: { xMm: 0, zMm: 0 },
				start: { xMm: 5000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("closing", "room-first-diagonal-trapezoid"),
			"2026-08-25T09:04:00.000Z",
		);

		expect(closed).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (closed.kind !== "accepted") return;
		expect(closed.project.level.rooms).toEqual([
			{
				faceFingerprint: "orthogonal-face:0:0|2000:2000|5000:2000|5000:0",
				heightMm: 2600,
				roomId: "room-first-diagonal-trapezoid",
			},
		]);
	});

	it("splits a square Room along a 45-degree wall immediately and preserves height for every successor", () => {
		const configured = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-23T13:20:00.000Z",
				levelId: "level-1",
				name: "Диагональное деление",
				projectId: "project-square-diagonal",
			}),
			{ depthMm: "3000", heightMm: "2800", widthMm: "3000" },
			ids(
				"v-1",
				"v-2",
				"v-3",
				"v-4",
				"wall-1",
				"wall-2",
				"wall-3",
				"wall-4",
				"room-square",
			),
			"2026-08-23T13:21:00.000Z",
		);
		if (configured.kind !== "accepted") {
			throw new Error("Expected a square starter fixture");
		}
		const source = {
			...configured.project,
			level: {
				...configured.project.level,
				rooms: [
					{
						...configured.project.level.rooms[0],
						heightMm: 2800,
						name: "Мастерская",
						type: "office" as const,
					},
				],
			},
		};
		const diagonal = {
			end: { xMm: 3100, zMm: 3100 },
			start: { xMm: 0, zMm: 0 },
			thicknessMm: 100,
		};

		const occupied = createParametricFloorItem(
			source,
			{
				color: "#2f80ed",
				depthMm: 400,
				heightMm: 750,
				label: "Стол",
				roomId: "room-square",
				widthMm: 400,
				xMm: 800,
				zMm: 2000,
			},
			ids("item-square"),
			"2026-08-23T13:21:30.000Z",
		);
		if (occupied.kind !== "accepted") {
			throw new Error("Expected a safe floor-item fixture");
		}
		expect(
			addGeneralWallToProject(
				occupied.project,
				diagonal,
				idsThatMustNotAllocate(),
				"2026-08-23T13:21:31.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });

		const result = addGeneralWallToProject(
			source,
			diagonal,
			ids("diagonal", "room-new"),
			"2026-08-23T13:22:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(
			expect.arrayContaining([
				{
					faceFingerprint: "orthogonal-face:0:0|0:3100|3100:3100",
					heightMm: 2800,
					name: "Мастерская",
					roomId: "room-square",
					type: "office",
				},
				{
					faceFingerprint: "orthogonal-face:0:0|3100:0|3100:3100",
					heightMm: 2800,
					roomId: "room-new",
				},
			]),
		);
		const reconciled = reconcileMissingRoomsFromPlanGraph(
			{
				...result.project,
				level: { ...result.project.level, rooms: [] },
			},
			ids("room-recovered-left", "room-recovered-right"),
			"2026-08-23T13:22:30.000Z",
		);
		expect(reconciled).toEqual(
			expect.objectContaining({ changed: true, kind: "accepted" }),
		);
		expect(reconciled.project.level.rooms).toEqual(
			expect.arrayContaining([
				{
					faceFingerprint: "orthogonal-face:0:0|0:3100|3100:3100",
					heightMm: 2600,
					roomId: "room-recovered-left",
				},
				{
					faceFingerprint: "orthogonal-face:0:0|3100:0|3100:3100",
					heightMm: 2600,
					roomId: "room-recovered-right",
				},
			]),
		);
		const extended = addGeneralWallToProject(
			result.project,
			{
				end: { xMm: 5100, zMm: 5000 },
				start: { xMm: 4000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("free-start", "free-end", "free-wall"),
			"2026-08-23T13:22:45.000Z",
		);
		expect(extended).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (extended.kind !== "accepted") return;
		expect(extended.project.level.rooms).toEqual(result.project.level.rooms);
		const resolved = resolveOrthogonalPlanFaces(result.project);
		expect(resolved).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (resolved.kind !== "accepted") return;
		const retainedFace = resolved.plan.rooms.find(
			(room) => room.roomId === "room-square",
		);
		expect(retainedFace?.usableFloorPolygonMm).toEqual([
			{
				xMm: 50,
				zMm: expect.closeTo(50 + 50 * Math.SQRT2, 8),
			},
			{ xMm: 50, zMm: 3050 },
			{
				xMm: expect.closeTo(3050 - 50 * Math.SQRT2, 8),
				zMm: 3050,
			},
		]);
	});

	it("splits one already diagonal Room from its outer boundary to the shared diagonal", () => {
		const configured = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-26T10:30:00.000Z",
				levelId: "level-post-diagonal",
				name: "Редактирование после диагонали",
				projectId: "project-post-diagonal",
			}),
			{ depthMm: "3000", heightMm: "2800", widthMm: "3000" },
			ids(
				"v-1",
				"v-2",
				"v-3",
				"v-4",
				"wall-1",
				"wall-2",
				"wall-3",
				"wall-4",
				"room-square",
			),
			"2026-08-26T10:31:00.000Z",
		);
		if (configured.kind !== "accepted") {
			throw new Error("Expected a square starter fixture");
		}
		const diagonal = addGeneralWallToProject(
			{
				...configured.project,
				level: {
					...configured.project.level,
					rooms: configured.project.level.rooms.map((room) => ({
						...room,
						heightMm: 2800,
						name: "Мастерская",
						type: "office" as const,
					})),
				},
			},
			{
				end: { xMm: 3100, zMm: 3100 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("diagonal", "room-diagonal-right"),
			"2026-08-26T10:32:00.000Z",
		);
		if (diagonal.kind !== "accepted") {
			throw new Error("Expected the initial diagonal split");
		}
		const before = JSON.stringify(diagonal.project);

		const result = addGeneralWallToProject(
			diagonal.project,
			{
				end: { xMm: 2400, zMm: 2400 },
				start: { xMm: 2400, zMm: 3100 },
				thicknessMm: 100,
			},
			ids(
				"diagonal-contact",
				"top-contact",
				"top-tail",
				"diagonal-tail",
				"cardinal-divider",
				"room-diagonal-split",
			),
			"2026-08-26T10:33:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toHaveLength(3);
		expect(result.project.level.rooms).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					heightMm: 2800,
					name: "Мастерская",
					roomId: "room-square",
					type: "office",
				}),
				expect.objectContaining({
					heightMm: 2800,
					roomId: "room-diagonal-right",
				}),
				expect.objectContaining({
					heightMm: 2800,
					roomId: "room-diagonal-split",
				}),
			]),
		);
		expect(
			result.project.level.wallSegments.filter(
				(wall) =>
					wall.startVertexId === "diagonal-contact" ||
					wall.endVertexId === "diagonal-contact",
			),
		).toHaveLength(3);
		expect(resolveOrthogonalPlanFaces(result.project)).toEqual(
			expect.objectContaining({ kind: "accepted" }),
		);
		expect(JSON.stringify(diagonal.project)).toBe(before);
	});

	it("merges two 45-degree Rooms back into a square only after an explicit metadata choice", () => {
		const configured = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-23T14:10:00.000Z",
				levelId: "level-1",
				name: "Обратное диагональное деление",
				projectId: "project-square-diagonal-delete",
			}),
			{ depthMm: "3000", heightMm: "2600", widthMm: "3000" },
			ids(
				"v-1",
				"v-2",
				"v-3",
				"v-4",
				"wall-1",
				"wall-2",
				"wall-3",
				"wall-4",
				"room-square",
			),
			"2026-08-23T14:11:00.000Z",
		);
		if (configured.kind !== "accepted") {
			throw new Error("Expected a square starter fixture");
		}
		const split = addGeneralWallToProject(
			{
				...configured.project,
				level: {
					...configured.project.level,
					rooms: [
						{
							...configured.project.level.rooms[0],
							name: "Мастерская",
							type: "office" as const,
						},
					],
				},
			},
			{
				end: { xMm: 3100, zMm: 3100 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("diagonal", "room-new"),
			"2026-08-23T14:12:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected a diagonal split fixture");
		}
		const source = {
			...split.project,
			level: {
				...split.project.level,
				rooms: split.project.level.rooms.map((room) =>
					room.roomId === "room-new"
						? { ...room, name: "Гостиная", type: "living-room" as const }
						: room,
				),
			},
		};

		expect(
			previewWallDeletionConflict(source, { wallSegmentId: "diagonal" }),
		).toEqual({
			itemIds: [],
			kind: "conflict",
			openingIds: [],
			roomIds: ["room-new", "room-square"],
			roomMetadataConflicts: [
				{
					retainedRoomIds: ["room-new", "room-square"],
					targetFaceKey: "0:3100:0:3100:100:100:100:100",
				},
			],
			wallSegmentId: "diagonal",
		});
		expect(
			deleteGeneralWallWithConsequenceResolution(
				source,
				{
					itemIds: [],
					openingIds: [],
					roomIds: ["room-new", "room-square"],
					wallSegmentId: "diagonal",
				},
				"2026-08-23T14:13:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ROOM_METADATA_CONFLICT_STALE" });

		const merged = deleteGeneralWallWithConsequenceResolution(
			source,
			{
				itemIds: [],
				openingIds: [],
				roomIds: ["room-new", "room-square"],
				roomMetadataResolutions: [
					{
						retainedRoomId: "room-new",
						targetFaceKey: "0:3100:0:3100:100:100:100:100",
					},
				],
				wallSegmentId: "diagonal",
			},
			"2026-08-23T14:13:00.000Z",
		);

		expect(merged).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (merged.kind !== "accepted") return;
		expect(merged.project.level.rooms).toEqual([
			{
				faceFingerprint: "grid:0:3100:0:3100:100",
				heightMm: 2600,
				name: "Гостиная",
				roomId: "room-new",
				type: "living-room",
			},
		]);
		expect(merged.project.level.wallSegments).toHaveLength(4);
		expect(resolveOrthogonalPlanFaces(merged.project)).toEqual(
			expect.objectContaining({ kind: "accepted" }),
		);
	});

	it("atomically removes a Door and explicitly merges Room metadata with its 45-degree divider", () => {
		const configured = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-23T14:40:00.000Z",
				levelId: "level-1",
				name: "Диагональ с дверью",
				projectId: "project-square-diagonal-door-delete",
			}),
			{ depthMm: "3000", heightMm: "2600", widthMm: "3000" },
			ids(
				"v-1",
				"v-2",
				"v-3",
				"v-4",
				"wall-1",
				"wall-2",
				"wall-3",
				"wall-4",
				"room-square",
			),
			"2026-08-23T14:41:00.000Z",
		);
		if (configured.kind !== "accepted") {
			throw new Error("Expected a square starter fixture");
		}
		const split = addGeneralWallToProject(
			configured.project,
			{
				end: { xMm: 3100, zMm: 3100 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("diagonal", "room-new"),
			"2026-08-23T14:42:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected a diagonal split fixture");
		}
		const withDoor = addDoorOpeningToProject(
			split.project,
			{
				heightMm: 2100,
				offsetMm: 2192,
				sillMm: 0,
				wallSegmentId: "diagonal",
				widthMm: 900,
			},
			ids("diagonal-door"),
			"2026-08-23T14:43:00.000Z",
		);
		if (withDoor.kind !== "accepted") {
			throw new Error("Expected a durable diagonal door fixture");
		}

		expect(
			previewWallDeletionConflict(withDoor.project, {
				wallSegmentId: "diagonal",
			}),
		).toEqual({
			itemIds: [],
			kind: "conflict",
			openingIds: ["diagonal-door"],
			roomIds: ["room-new", "room-square"],
			roomMetadataConflicts: [
				{
					retainedRoomIds: ["room-new", "room-square"],
					targetFaceKey: "0:3100:0:3100:100:100:100:100",
				},
			],
			wallSegmentId: "diagonal",
		});

		const deleted = deleteGeneralWallWithConsequenceResolution(
			withDoor.project,
			{
				itemIds: [],
				openingIds: ["diagonal-door"],
				roomIds: ["room-new", "room-square"],
				roomMetadataResolutions: [
					{
						retainedRoomId: "room-square",
						targetFaceKey: "0:3100:0:3100:100:100:100:100",
					},
				],
				wallSegmentId: "diagonal",
			},
			"2026-08-23T14:44:00.000Z",
		);

		expect(deleted).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (deleted.kind !== "accepted") return;
		expect(deleted.project.level.openings).toEqual([]);
		expect(deleted.project.level.wallSegments).toHaveLength(4);
		expect(deleted.project.level.rooms).toEqual([
			expect.objectContaining({
				faceFingerprint: "grid:0:3100:0:3100:100",
				roomId: "room-square",
			}),
		]);
	});

	it("keeps the Room durable when an exact 45-degree branch joins its wall body", () => {
		const source = starterProject();
		const result = addGeneralWallToProject(
			source,
			{
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 1000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("diagonal-start", "bottom-contact", "bottom-tail", "diagonal-wall"),
			"2026-08-23T12:30:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "bottom-contact",
					startVertexId: "diagonal-start",
					thicknessMm: 100,
					wallSegmentId: "diagonal-wall",
				},
			]),
		);
	});

	it("rehosts an unaffected wall panel to the exact successor when a T contact normalizes its host", () => {
		const tailPanel = projectWithWallPanel(3000);
		const headPanel = createParametricWallItem(
			tailPanel,
			{
				color: "#835a45",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Панель на первой части",
				offsetMm: 1000,
				side: "right",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("wall-panel-head"),
			"2026-08-26T01:09:00.000Z",
		);
		if (headPanel.kind !== "accepted") {
			throw new Error("Expected two non-overlapping wall panels");
		}
		const source = headPanel.project;
		const result = addGeneralWallToProject(
			source,
			{
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 2000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("t-contact", "branch-start", "wall-1-tail", "branch-wall"),
			"2026-08-26T01:10:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "t-contact",
					wallSegmentId: "wall-1",
				}),
				expect.objectContaining({
					startVertexId: "t-contact",
					wallSegmentId: "wall-1-tail",
				}),
			]),
		);
		expect(result.project.assetInstances).toEqual([
			expect.objectContaining({
				assetInstanceId: "wall-panel-1",
				offsetMm: 1000,
				side: "right",
				wallSegmentId: "wall-1-tail",
			}),
			expect.objectContaining({
				assetInstanceId: "wall-panel-head",
				offsetMm: 1000,
				side: "right",
				wallSegmentId: "wall-1",
			}),
		]);
		expect(source.assetInstances[0]).toEqual(
			expect.objectContaining({
				offsetMm: 3000,
				wallSegmentId: "wall-1",
			}),
		);
	});

	it("normalizes an exact X contact and keeps an unaffected wall panel on its physical successor", () => {
		const source = projectWithWallPanel(3000);
		const result = addGeneralWallToProject(
			source,
			{
				end: { xMm: 2000, zMm: 1000 },
				start: { xMm: 2000, zMm: -1000 },
				thicknessMm: 100,
			},
			ids(
				"x-outside",
				"x-contact",
				"x-inside",
				"wall-1-tail",
				"x-outside-piece",
				"x-inside-piece",
			),
			"2026-08-26T10:10:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([{ vertexId: "x-contact", xMm: 2000, zMm: 0 }]),
		);
		expect(
			result.project.level.wallSegments.filter(
				(wall) =>
					wall.startVertexId === "x-contact" ||
					wall.endVertexId === "x-contact",
			),
		).toHaveLength(4);
		expect(result.project.level.wallSegments).toHaveLength(7);
		expect(result.project.assetInstances).toEqual([
			expect.objectContaining({
				assetInstanceId: "wall-panel-1",
				offsetMm: 1000,
				side: "right",
				wallSegmentId: "wall-1-tail",
			}),
		]);
		expect(source.assetInstances).toEqual([
			expect.objectContaining({
				offsetMm: 3000,
				wallSegmentId: "wall-1",
			}),
		]);
	});

	it("rehosts a panel on a non-zero vertical host after T normalization", () => {
		const placed = createParametricWallItem(
			starterProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Вертикальная панель",
				offsetMm: 2200,
				side: "left",
				wallSegmentId: "wall-2",
				widthMm: 900,
			},
			ids("vertical-panel"),
			"2026-08-26T01:09:30.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected a vertical wall-panel fixture");
		}

		const result = addGeneralWallToProject(
			placed.project,
			{
				end: { xMm: 4100, zMm: 1000 },
				start: { xMm: 3000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("branch-start", "vertical-contact", "wall-2-tail", "branch-wall"),
			"2026-08-26T01:10:10.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.assetInstances).toEqual([
			expect.objectContaining({
				assetInstanceId: "vertical-panel",
				offsetMm: 1200,
				side: "left",
				wallSegmentId: "wall-2-tail",
			}),
		]);
	});

	it("keeps exact wall-item edge contact on one T-normalized successor", () => {
		const input = {
			end: { xMm: 2000, zMm: 0 },
			start: { xMm: 2000, zMm: 1000 },
			thicknessMm: 100,
		} as const;
		const head = addGeneralWallToProject(
			projectWithWallPanel(1550),
			input,
			ids("head-t-contact", "head-branch-start", "head-tail", "head-branch"),
			"2026-08-26T01:10:20.000Z",
		);
		const tail = addGeneralWallToProject(
			projectWithWallPanel(2450),
			input,
			ids("tail-t-contact", "tail-branch-start", "wall-1-tail", "tail-branch"),
			"2026-08-26T01:10:30.000Z",
		);

		expect(head).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(tail).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (head.kind !== "accepted" || tail.kind !== "accepted") return;
		expect(head.project.assetInstances).toEqual([
			expect.objectContaining({
				offsetMm: 1550,
				wallSegmentId: "wall-1",
			}),
		]);
		expect(tail.project.assetInstances).toEqual([
			expect.objectContaining({
				offsetMm: 450,
				wallSegmentId: "wall-1-tail",
			}),
		]);
	});

	it("rehosts an unaffected Door when a T contact normalizes its wall", () => {
		const result = addGeneralWallToProject(
			projectWithDoor(),
			{
				end: { xMm: 1000, zMm: 0 },
				start: { xMm: 1000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("t-contact", "branch-start", "wall-1-tail", "branch-wall"),
			"2026-08-26T01:10:45.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.openings).toEqual([
			expect.objectContaining({
				offsetMm: 1050,
				openingId: "door-1",
				wallSegmentId: "wall-1-tail",
			}),
		]);
	});

	it("rejects an exact diagonal T contact through a Door before allocating topology", () => {
		const source = projectWithReversedDiagonalDoor();
		const before = JSON.stringify(source);

		expect(
			addGeneralWallToProject(
				source,
				{
					end: { xMm: 1550, zMm: 1550 },
					start: { xMm: 1550, zMm: 500 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-26T01:10:55.000Z",
			),
		).toEqual({
			affected: { kind: "opening", openingId: "diagonal-door" },
			kind: "rejected",
			reasonCode: "WALL_DOOR_OPENING_COLLISION",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rehosts an unaffected Door while splitting an already diagonal Room", () => {
		const source = projectWithReversedDiagonalDoor();
		const before = JSON.stringify(source);
		const result = addGeneralWallToProject(
			source,
			{
				end: { xMm: 2400, zMm: 2400 },
				start: { xMm: 2400, zMm: 3100 },
				thicknessMm: 100,
			},
			ids(
				"diagonal-contact",
				"top-contact",
				"top-tail",
				"diagonal-host-tail",
				"cardinal-divider",
				"room-diagonal-split",
			),
			"2026-08-26T10:34:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toHaveLength(3);
		expect(
			result.project.level.wallSegments.filter(
				(wall) =>
					wall.startVertexId === "diagonal-contact" ||
					wall.endVertexId === "diagonal-contact",
			),
		).toHaveLength(3);
		expect(result.project.level.openings).toEqual([
			expect.objectContaining({
				offsetMm: 1203,
				openingId: "diagonal-door",
				swingSide: "left",
				wallSegmentId: "diagonal-host-tail",
			}),
		]);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("splits an already diagonal Room through an interior dangling-wall contact", () => {
		const source = projectWithReversedDiagonalDoor();
		const dangling = addGeneralWallToProject(
			source,
			{
				end: { xMm: 2600, zMm: 2700 },
				start: { xMm: 2100, zMm: 2700 },
				thicknessMm: 100,
			},
			ids("dangling-left", "dangling-right", "dangling-wall"),
			"2026-08-26T10:35:00.000Z",
		);
		if (dangling.kind !== "accepted") {
			throw new Error("Expected an interior dangling Wall fixture");
		}
		expect(dangling.project.level.rooms).toEqual(source.level.rooms);

		const result = addGeneralWallToProject(
			dangling.project,
			{
				end: { xMm: 2400, zMm: 2400 },
				start: { xMm: 2400, zMm: 3100 },
				thicknessMm: 100,
			},
			ids(
				"diagonal-contact",
				"interior-contact",
				"top-contact",
				"top-tail",
				"diagonal-host-tail",
				"dangling-tail",
				"divider-head",
				"divider-tail",
				"room-diagonal-split",
			),
			"2026-08-26T10:36:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toHaveLength(3);
		expect(
			result.project.level.wallSegments.filter(
				(wall) =>
					wall.startVertexId === "interior-contact" ||
					wall.endVertexId === "interior-contact",
			),
		).toHaveLength(4);
		expect(result.project.level.openings).toEqual([
			expect.objectContaining({
				offsetMm: 1203,
				openingId: "diagonal-door",
				wallSegmentId: "diagonal-host-tail",
			}),
		]);
	});

	it("rejects a T contact through a wall panel footprint without allocating topology", () => {
		const source = projectWithWallPanel(2000);
		const before = JSON.stringify(source);

		expect(
			addGeneralWallToProject(
				source,
				{
					end: { xMm: 2000, zMm: 0 },
					start: { xMm: 2000, zMm: 1000 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-26T01:11:00.000Z",
			),
		).toEqual({
			affected: { assetInstanceId: "wall-panel-1", kind: "wall-item" },
			kind: "rejected",
			reasonCode: "WALL_ITEM_COLLISION",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("previews and atomically removes a wall panel cut by an exact T contact", () => {
		const source = projectWithWallPanelsOnDifferentHosts();
		const before = JSON.stringify(source);
		const input = {
			end: { xMm: 3000, zMm: 0 },
			start: { xMm: 3000, zMm: 1000 },
			thicknessMm: 100,
		} as const;

		expect(previewWallAddHostConflict(source, input)).toEqual({
			itemIds: ["wall-panel-1"],
			kind: "conflict",
			openingIds: [],
		});
		expect(
			addGeneralWallToProjectWithHostResolution(
				source,
				{ ...input, itemIds: [], openingIds: [] },
				idsThatMustNotAllocate(),
				"2026-08-27T09:07:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ADD_CONFLICT_STALE" });

		const resolved = addGeneralWallToProjectWithHostResolution(
			source,
			{ ...input, itemIds: ["wall-panel-1"], openingIds: [] },
			ids("t-contact", "branch-start", "wall-1-tail", "branch-wall"),
			"2026-08-27T09:08:00.000Z",
		);

		expect(resolved).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (resolved.kind !== "accepted") return;
		expect(resolved.project.assetInstances).toEqual([
			expect.objectContaining({
				assetInstanceId: "wall-panel-2",
				wallSegmentId: "wall-2",
			}),
		]);
		expect(resolved.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ wallSegmentId: "wall-1" }),
				expect.objectContaining({ wallSegmentId: "wall-1-tail" }),
				expect.objectContaining({ wallSegmentId: "branch-wall" }),
			]),
		);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("previews and atomically removes a Door cut by an exact T contact", () => {
		const source = projectWithOpeningsOnDifferentWallHosts();
		const before = JSON.stringify(source);
		const input = {
			end: { xMm: 1000, zMm: 500 },
			start: { xMm: 1000, zMm: -500 },
			thicknessMm: 100,
		} as const;

		expect(previewWallAddHostConflict(source, input)).toEqual({
			itemIds: [],
			kind: "conflict",
			openingIds: ["door-1"],
		});
		const resolved = addGeneralWallToProjectWithHostResolution(
			source,
			{ ...input, itemIds: [], openingIds: ["door-1"] },
			ids("branch-start", "t-contact", "wall-1-tail", "branch-wall"),
			"2026-08-27T09:09:00.000Z",
		);

		expect(resolved).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (resolved.kind !== "accepted") return;
		expect(resolved.project.level.openings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ openingId: "window-1" }),
				expect.objectContaining({ openingId: "window-2" }),
			]),
		);
		expect(resolved.project.level.openings).toHaveLength(2);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("returns no AddWall host consequence for invalid or unaffected candidates", () => {
		expect(
			previewWallAddHostConflict(projectWithWallPanel(1000), {
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 2000, zMm: 1000 },
				thicknessMm: 100,
			}),
		).toEqual({ kind: "none" });
		expect(
			previewWallAddHostConflict(projectWithWallPanel(2000), {
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			}),
		).toEqual({ kind: "none" });
		expect(
			addGeneralWallToProjectWithHostResolution(
				projectWithWallPanel(1000),
				{
					end: { xMm: 2000, zMm: 0 },
					itemIds: [],
					openingIds: [],
					start: { xMm: 2000, zMm: 1000 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-27T09:09:30.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_ADD_CONFLICT_STALE" });
	});

	it("sorts every cut wall-item identity and ignores floor-hosted items", () => {
		const wallSource = projectWithWallPanel(2000);
		const panel = wallSource.assetInstances[0];
		const floorItem = projectWithTable().assetInstances[0];
		if (panel?.anchorClass !== "wall" || !floorItem) {
			throw new Error("Expected wall and floor item fixtures");
		}
		const source = {
			...wallSource,
			assetInstances: [
				{ ...panel, assetInstanceId: "panel-z" },
				{ ...panel, assetInstanceId: "panel-a", side: "left" as const },
				floorItem,
			],
		};

		expect(
			previewWallAddHostConflict(source, {
				end: { xMm: 2000, zMm: 0 },
				start: { xMm: 2000, zMm: 1000 },
				thicknessMm: 100,
			}),
		).toEqual({
			itemIds: ["panel-a", "panel-z"],
			kind: "conflict",
			openingIds: [],
		});
	});

	it("sorts opening identities cut by one AddWall X route across two hosts", () => {
		const door = projectWithDoor();
		const sourceWithRenamedDoor = {
			...door,
			level: {
				...door.level,
				openings: door.level.openings.map((opening) => ({
					...opening,
					offsetMm: 1000,
					openingId: "opening-z",
				})),
			},
		};
		const withWindow = addWindowOpeningToProject(
			sourceWithRenamedDoor,
			{
				heightMm: 1200,
				offsetMm: 3100,
				sillMm: 900,
				wallSegmentId: "wall-3",
				widthMm: 900,
			},
			ids("opening-a"),
			"2026-08-27T09:09:45.000Z",
		);
		if (withWindow.kind !== "accepted") {
			throw new Error("Expected openings on two opposite hosts");
		}

		expect(
			previewWallAddHostConflict(withWindow.project, {
				end: { xMm: 1000, zMm: 3600 },
				start: { xMm: 1000, zMm: -500 },
				thicknessMm: 100,
			}),
		).toEqual({
			itemIds: [],
			kind: "conflict",
			openingIds: ["opening-a", "opening-z"],
		});
	});

	it("moves a detached 45-degree Wall only along its normal without changing its Room", () => {
		const source = starterProject();
		const added = addGeneralWallToProject(
			source,
			{
				end: { xMm: 6000, zMm: 2000 },
				start: { xMm: 5000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("diagonal-start", "diagonal-end", "diagonal-wall"),
			"2026-08-23T12:45:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a detached 45-degree wall fixture");
		}

		const result = moveGeneralWall(
			added.project,
			{
				translationMm: { xMm: 400, zMm: -400 },
				wallSegmentId: "diagonal-wall",
			},
			"2026-08-23T12:46:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "diagonal-start", xMm: 5400, zMm: 600 },
				{ vertexId: "diagonal-end", xMm: 6400, zMm: 1600 },
			]),
		);
		expect(added.project.level.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "diagonal-start", xMm: 5000, zMm: 1000 },
				{ vertexId: "diagonal-end", xMm: 6000, zMm: 2000 },
			]),
		);
	});

	it("splits a detached 45-degree Wall at an exact on-segment point without changing its Room", () => {
		const source = starterProject();
		const added = addGeneralWallToProject(
			source,
			{
				end: { xMm: 6000, zMm: 2000 },
				start: { xMm: 5000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("diagonal-start", "diagonal-end", "diagonal-wall"),
			"2026-08-23T12:50:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a detached 45-degree wall fixture");
		}

		const result = splitGeneralWall(
			added.project,
			{
				pointMm: { xMm: 5500, zMm: 1500 },
				wallSegmentId: "diagonal-wall",
			},
			ids("diagonal-split", "diagonal-tail"),
			"2026-08-23T12:51:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "diagonal-split", xMm: 5500, zMm: 1500 },
			]),
		);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "diagonal-split",
					startVertexId: "diagonal-start",
					wallSegmentId: "diagonal-wall",
				}),
				expect.objectContaining({
					endVertexId: "diagonal-end",
					startVertexId: "diagonal-split",
					wallSegmentId: "diagonal-tail",
				}),
			]),
		);
		const merged = deleteGeneralVertex(
			result.project,
			{ vertexId: "diagonal-split" },
			"2026-08-23T12:52:00.000Z",
		);
		expect(merged).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (merged.kind !== "accepted") return;
		expect(merged.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "diagonal-end",
					startVertexId: "diagonal-start",
					wallSegmentId: "diagonal-wall",
				}),
			]),
		);
		expect(
			merged.project.level.wallSegments.map((wall) => wall.wallSegmentId),
		).not.toContain("diagonal-tail");
	});

	it("rejects diagonal Wall moves along the wall and off-axis split points before durable allocation", () => {
		const source = starterProject();
		const added = addGeneralWallToProject(
			source,
			{
				end: { xMm: 6000, zMm: 2000 },
				start: { xMm: 5000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("diagonal-start", "diagonal-end", "diagonal-wall"),
			"2026-08-23T12:55:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a detached 45-degree wall fixture");
		}
		const before = JSON.stringify(added.project);

		expect(
			moveGeneralWall(
				added.project,
				{
					translationMm: { xMm: 400, zMm: 400 },
					wallSegmentId: "diagonal-wall",
				},
				"2026-08-23T12:56:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_NOT_MOVABLE" });
		expect(
			splitGeneralWall(
				added.project,
				{
					pointMm: { xMm: 5500, zMm: 1600 },
					wallSegmentId: "diagonal-wall",
				},
				idsThatMustNotAllocate(),
				"2026-08-23T12:57:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_SPLIT_POINT_INVALID" });
		expect(
			splitGeneralWall(
				added.project,
				{
					pointMm: { xMm: 5000, zMm: 1000 },
					wallSegmentId: "diagonal-wall",
				},
				idsThatMustNotAllocate(),
				"2026-08-23T12:57:30.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_SPLIT_POINT_INVALID" });
		const falling = addGeneralWallToProject(
			source,
			{
				end: { xMm: 6000, zMm: 1000 },
				start: { xMm: 5000, zMm: 2000 },
				thicknessMm: 100,
			},
			ids("falling-start", "falling-end", "falling-wall"),
			"2026-08-23T12:58:00.000Z",
		);
		if (falling.kind !== "accepted") {
			throw new Error("Expected a falling 45-degree wall fixture");
		}
		expect(
			moveGeneralWall(
				falling.project,
				{
					translationMm: { xMm: 400, zMm: -400 },
					wallSegmentId: "falling-wall",
				},
				"2026-08-23T12:59:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_NOT_MOVABLE" });
		expect(JSON.stringify(added.project)).toBe(before);
	});

	it("automatically inherits a split Room height without a successor selection", () => {
		const starter = starterProject();
		const source = {
			...starter,
			level: {
				...starter.level,
				rooms: starter.level.rooms.map((room) => ({
					...room,
					heightMm: 2750,
					name: "Спальня",
					type: "bedroom" as const,
				})),
			},
		};
		const wall = {
			end: { xMm: 2050, zMm: 3100 },
			start: { xMm: 2050, zMm: 0 },
			thicknessMm: 100,
		};
		const result = addGeneralWallToProject(
			source,
			wall,
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-left",
			),
			"2026-08-22T23:40:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.rooms).toEqual([
			{
				faceFingerprint: "grid:0:2050:0:3100:100",
				heightMm: 2750,
				name: "Спальня",
				roomId: "room-1",
				type: "bedroom",
			},
			{
				faceFingerprint: "grid:2050:4100:0:3100:100",
				heightMm: 2750,
				roomId: "room-left",
			},
		]);
	});

	it("changes one selected wall thickness without moving its centerline or changing the room height", () => {
		const source = starterProject();
		const before = JSON.stringify(source);

		const result = changeGeneralWallThickness(
			source,
			{ thicknessMm: 200, wallSegmentId: "wall-1" },
			"2026-08-15T09:00:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "v-2",
					startVertexId: "v-1",
					thicknessMm: 200,
					wallSegmentId: "wall-1",
				}),
			]),
		);
		expect(result.project.level.rooms).toEqual([
			expect.objectContaining({
				heightMm: 2600,
				roomId: "room-1",
			}),
		]);
		expect(result.project.level.rooms[0]?.faceFingerprint).toBe(
			source.level.rooms[0]?.faceFingerprint,
		);
		expect(resolveOrthogonalPlanFaces(result.project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-1" }] },
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it.each([20, 101, 1000])(
		"accepts hard-limit and odd integer wall thickness %i mm",
		(thicknessMm) => {
			const source = starterProject();

			const result = changeGeneralWallThickness(
				source,
				{ thicknessMm, wallSegmentId: "wall-1" },
				"2026-08-27T12:00:00.000Z",
			);

			expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
			if (result.kind !== "accepted") return;
			expect(
				result.project.level.wallSegments.find(
					(wall) => wall.wallSegmentId === "wall-1",
				)?.thicknessMm,
			).toBe(thicknessMm);
			expect(result.project.level.vertices).toEqual(source.level.vertices);
			expect(result.project.level.rooms).toEqual(source.level.rooms);
			expect(resolveOrthogonalPlanFaces(result.project)).toEqual(
				expect.objectContaining({ kind: "accepted" }),
			);
		},
	);

	it.each([
		[-20, "INVALID_DIMENSION"],
		[0, "INVALID_DIMENSION"],
		[19, "PROJECT_BOUNDS_EXCEEDED"],
		[1001, "PROJECT_BOUNDS_EXCEEDED"],
		[20.5, "INVALID_DIMENSION"],
	] as const)(
		"rejects wall thickness %s with canonical reason %s",
		(thicknessMm, reasonCode) => {
			const source = starterProject();
			const before = JSON.stringify(source);

			expect(
				changeGeneralWallThickness(
					source,
					{ thicknessMm, wallSegmentId: "wall-1" },
					"2026-08-27T12:01:00.000Z",
				),
			).toEqual({ kind: "rejected", reasonCode });
			expect(JSON.stringify(source)).toBe(before);
		},
	);

	it("changes a detached open-plan Wall without inventing a Room", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-27T12:02:00.000Z",
			levelId: "open-level",
			name: "Открытый план",
			projectId: "open-project",
		});
		const added = addGeneralWallToProject(
			empty,
			{
				end: { xMm: 1000, zMm: 0 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("open-start", "open-end", "open-wall"),
			"2026-08-27T12:03:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected an open-plan Wall fixture");
		}

		const result = changeGeneralWallThickness(
			added.project,
			{ thicknessMm: 101, wallSegmentId: "open-wall" },
			"2026-08-27T12:04:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.rooms).toEqual([]);
		expect(result.project.level.vertices).toEqual(added.project.level.vertices);
		expect(result.project.level.wallSegments).toEqual([
			expect.objectContaining({
				thicknessMm: 101,
				wallSegmentId: "open-wall",
			}),
		]);
	});

	it("rejects thickness equal to a detached Wall length", () => {
		const detached = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 5200, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("short-start", "short-end", "short-wall"),
			"2026-08-27T12:05:00.000Z",
		);
		if (detached.kind !== "accepted") {
			throw new Error("Expected a short detached Wall fixture");
		}
		const before = JSON.stringify(detached.project);

		expect(
			changeGeneralWallThickness(
				detached.project,
				{ thicknessMm: 200, wallSegmentId: "short-wall" },
				"2026-08-27T12:06:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
		expect(JSON.stringify(detached.project)).toBe(before);
	});

	it("rejects a detached Wall thickness whose expanded body crosses a retained floor item", () => {
		const detached = addGeneralWallToProject(
			projectWithTable(),
			{
				end: { xMm: 3000, zMm: 1000 },
				start: { xMm: 1000, zMm: 1000 },
				thicknessMm: 100,
			},
			ids("guard-start", "guard-end", "guard-wall"),
			"2026-08-27T12:07:00.000Z",
		);
		if (detached.kind !== "accepted") {
			throw new Error("Expected a collision-free detached Wall fixture");
		}
		const before = JSON.stringify(detached.project);

		expect(
			changeGeneralWallThickness(
				detached.project,
				{ thicknessMm: 400, wallSegmentId: "guard-wall" },
				"2026-08-27T12:08:00.000Z",
			),
		).toEqual({
			affected: { assetInstanceId: "item-1", kind: "floor-item" },
			kind: "rejected",
			reasonCode: "WALL_ITEM_COLLISION",
		});
		expect(JSON.stringify(detached.project)).toBe(before);
	});

	it("keeps a rotated item hosted when only a remote concave boundary becomes thicker", () => {
		const contour = [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 2000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 2000, zMm: 2000 }, start: { xMm: 4000, zMm: 2000 } },
			{ end: { xMm: 2000, zMm: 4000 }, start: { xMm: 2000, zMm: 2000 } },
			{ end: { xMm: 0, zMm: 4000 }, start: { xMm: 2000, zMm: 4000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 4000 } },
		] as const;
		let project = createInitialProject({
			createdAt: "2026-08-27T14:20:00.000Z",
			levelId: "level-concave-rotated-item",
			name: "Вогнутая комната с повёрнутым предметом",
			projectId: "project-concave-rotated-item",
		});
		contour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === contour.length - 1
					? ids(`rotated-host-wall-${index + 1}`, "room-concave-rotated")
					: ids(
							...(index === 0
								? [
										"rotated-host-v-1",
										"rotated-host-v-2",
										"rotated-host-wall-1",
									]
								: [
										`rotated-host-v-${index + 2}`,
										`rotated-host-wall-${index + 1}`,
									]),
						),
				`2026-08-27T14:2${index + 1}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a concave rotated-item fixture");
			}
			project = added.project;
		});
		const placed = createParametricFloorItem(
			project,
			{
				color: "#2f80ed",
				depthMm: 200,
				heightMm: 750,
				label: "Повёрнутый стол",
				roomId: "room-concave-rotated",
				widthMm: 800,
				xMm: 550,
				zMm: 800,
			},
			ids("rotated-concave-item"),
			"2026-08-27T14:30:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected an initially valid floor item");
		}
		const source = {
			...placed.project,
			assetInstances: placed.project.assetInstances.map((item) => ({
				...item,
				yawStep: 2 as const,
			})),
		};

		const result = changeGeneralWallThickness(
			source,
			{ thicknessMm: 500, wallSegmentId: "rotated-host-wall-4" },
			"2026-08-27T14:31:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.assetInstances).toEqual(source.assetInstances);
		expect(result.project.level.rooms).toEqual(source.level.rooms);
	});

	it("rejects thickness that expands a detached wall into another wall's Opening", () => {
		const added = addGeneralWallToProject(
			projectWithDoor(),
			{
				end: { xMm: 2050, zMm: -100 },
				start: { xMm: 2050, zMm: -600 },
				thicknessMm: 100,
			},
			ids("opening-guard-start", "opening-guard-end", "opening-guard-wall"),
			"2026-08-27T14:32:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a wall touching the Opening boundary");
		}
		const firstUnrelatedWall = added.project.level.wallSegments.find(
			(wall) => wall.wallSegmentId === "wall-2",
		);
		if (!firstUnrelatedWall) throw new Error("Expected an unrelated wall");
		const source = {
			...added.project,
			level: {
				...added.project.level,
				wallSegments: [
					firstUnrelatedWall,
					...added.project.level.wallSegments.filter(
						(wall) => wall.wallSegmentId !== firstUnrelatedWall.wallSegmentId,
					),
				],
			},
		};
		const before = JSON.stringify(source);

		expect(
			changeGeneralWallThickness(
				source,
				{ thicknessMm: 200, wallSegmentId: "opening-guard-wall" },
				"2026-08-27T14:33:00.000Z",
			),
		).toEqual({
			affected: { kind: "opening", openingId: "door-1" },
			kind: "rejected",
			reasonCode: "WALL_DOOR_OPENING_COLLISION",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("allows a hosted Opening to remain in its own thickened wall", () => {
		const source = projectWithDoor();

		const result = changeGeneralWallThickness(
			source,
			{ thicknessMm: 200, wallSegmentId: "wall-1" },
			"2026-08-27T14:34:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.openings).toEqual(source.level.openings);
	});

	it("reverses one Wall while retaining physical Opening and wall-item hosts", () => {
		const source = projectWithDoorAndWallPanels();
		const before = JSON.stringify(source);
		expect(source.level.openings[0]).not.toHaveProperty("swingSide");

		const result = reverseGeneralWall(
			source,
			{ wallSegmentId: "wall-1" },
			"2026-08-24T23:02:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "v-1",
					startVertexId: "v-2",
					wallSegmentId: "wall-1",
				}),
				expect.objectContaining({
					endVertexId: "v-3",
					startVertexId: "v-2",
					wallSegmentId: "wall-2",
				}),
			]),
		);
		expect(result.project.level.openings).toEqual([
			expect.objectContaining({
				openingId: "door-1",
				offsetMm: 3100,
				swingSide: "left",
				wallSegmentId: "wall-1",
			}),
		]);
		expect(result.project.assetInstances).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					assetInstanceId: "wall-panel-1",
					offsetMm: 1100,
					side: "right",
					wallSegmentId: "wall-1",
				}),
				expect.objectContaining({
					assetInstanceId: "wall-panel-2",
					offsetMm: 1500,
					side: "right",
					wallSegmentId: "wall-2",
				}),
			]),
		);
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(resolveOrthogonalPlanFaces(result.project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-1" }] },
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("reflects every selected opening kind and leaves another Wall host unchanged", () => {
		const source = projectWithOpeningsOnDifferentWallHosts();

		const result = reverseGeneralWall(
			source,
			{ wallSegmentId: "wall-1" },
			"2026-08-24T23:06:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.openings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "Door",
					openingId: "door-1",
					offsetMm: 3100,
					swingSide: "right",
					wallSegmentId: "wall-1",
				}),
				expect.objectContaining({
					kind: "Window",
					openingId: "window-1",
					offsetMm: 1100,
					wallSegmentId: "wall-1",
				}),
				expect.objectContaining({
					kind: "Window",
					openingId: "window-2",
					offsetMm: 1500,
					wallSegmentId: "wall-2",
				}),
			]),
		);
		const reflectedWindow = result.project.level.openings.find(
			(opening) => opening.openingId === "window-1",
		);
		expect(reflectedWindow).toEqual({
			heightMm: 1200,
			kind: "Window",
			openingId: "window-1",
			offsetMm: 1100,
			sillMm: 900,
			wallSegmentId: "wall-1",
			widthMm: 600,
		});
	});

	it("flips a right-side wall panel when its stable host direction reverses", () => {
		const result = reverseGeneralWall(
			projectWithWallPanel(1000),
			{ wallSegmentId: "wall-1" },
			"2026-08-24T23:07:00.000Z",
		);

		expect(result).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							offsetMm: 3100,
							side: "left",
							wallSegmentId: "wall-1",
						}),
					],
				}),
			}),
		);
	});

	it.each([
		{ openingId: "door-1", project: projectWithDoor },
		{ openingId: "window-1", project: projectWithWindow },
	])(
		"rejects moving a legacy thick wall body into another host's $openingId",
		({ openingId, project }) => {
			const added = addGeneralWallToProject(
				project(),
				{
					start: { xMm: 1500, zMm: 500 },
					end: { xMm: 2600, zMm: 500 },
					thicknessMm: 201,
				},
				ids("collision-start", "collision-end", "collision-wall"),
				"2026-10-25T10:00:00.000Z",
			);
			if (added.kind !== "accepted")
				throw new Error("Expected a collision-free legacy wall");
			const source = added.project;
			const before = JSON.stringify(source);

			expect(
				moveGeneralWall(
					source,
					{ wallSegmentId: "collision-wall", positionMm: 100 },
					"2026-10-25T10:01:00.000Z",
				),
			).toEqual({
				kind: "rejected",
				reasonCode: "WALL_DOOR_OPENING_COLLISION",
				affected: { kind: "opening", openingId },
			});
			expect(JSON.stringify(source)).toBe(before);
		},
	);

	it.each([
		{ positionMm: 149, kind: "rejected" },
		{ positionMm: 150, kind: "accepted" },
		{ positionMm: 151, kind: "accepted" },
	] as const)(
		"a moved 200 mm wall at $positionMm mm from a 100 mm opening host is $kind",
		({ positionMm, kind }) => {
			const added = addGeneralWallToProject(
				projectWithDoor(),
				{
					start: { xMm: 1500, zMm: 500 },
					end: { xMm: 2600, zMm: 500 },
					thicknessMm: 200,
				},
				ids("boundary-start", "boundary-end", "boundary-wall"),
				"2026-10-25T10:00:00.000Z",
			);
			if (added.kind !== "accepted")
				throw new Error("Expected a collision-free boundary wall");
			const before = JSON.stringify(added.project);

			const result = moveGeneralWall(
				added.project,
				{ wallSegmentId: "boundary-wall", positionMm },
				"2026-10-25T10:01:00.000Z",
			);

			expect(result.kind).toBe(kind);
			if (result.kind === "rejected") {
				expect(result).toEqual({
					kind: "rejected",
					reasonCode: "WALL_DOOR_OPENING_COLLISION",
					affected: { kind: "opening", openingId: "door-1" },
				});
			} else {
				expect(result.project.level.openings).toEqual(
					added.project.level.openings,
				);
				expect(
					result.project.level.vertices.find(
						(vertex) => vertex.vertexId === "boundary-start",
					)?.zMm,
				).toBe(positionMm);
			}
			expect(JSON.stringify(added.project)).toBe(before);
		},
	);

	it("rejects moving an Opening host until its hole overlaps a stationary wall body", () => {
		const added = addGeneralWallToProject(
			projectWithDoor(),
			{
				start: { xMm: 1500, zMm: 500 },
				end: { xMm: 2600, zMm: 500 },
				thicknessMm: 201,
			},
			ids("stationary-start", "stationary-end", "stationary-wall"),
			"2026-10-25T10:00:00.000Z",
		);
		if (added.kind !== "accepted")
			throw new Error("Expected a stationary legacy wall");
		const before = JSON.stringify(added.project);

		expect(
			moveGeneralWall(
				added.project,
				{ wallSegmentId: "wall-1", positionMm: 400 },
				"2026-10-25T10:01:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "WALL_DOOR_OPENING_COLLISION",
			affected: { kind: "opening", openingId: "door-1" },
		});
		expect(JSON.stringify(added.project)).toBe(before);
	});

	it("allows moving an Opening together with its own host when no other wall occupies the hole", () => {
		const source = projectWithDoor();
		const result = moveGeneralWall(
			source,
			{ wallSegmentId: "wall-1", positionMm: 400 },
			"2026-10-25T10:01:00.000Z",
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted") return;
		expect(result.project.level.openings).toEqual(source.level.openings);
		expect(
			result.project.level.vertices.find((vertex) => vertex.vertexId === "v-1")
				?.zMm,
		).toBe(400);
	});

	it("moves a selected full-span divider in exact millimetres while preserving both Room identities", () => {
		const divided = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-23T00:40:00.000Z",
		);
		if (divided.kind !== "accepted") {
			throw new Error("Expected divider fixture");
		}
		const source = {
			...divided.project,
			level: {
				...divided.project.level,
				rooms: divided.project.level.rooms.map((room) =>
					room.roomId === "room-1"
						? {
								...room,
								heightMm: 2750,
								name: "Кухня",
								type: "kitchen" as const,
							}
						: {
								...room,
								heightMm: 2800,
								name: "Гостиная",
								type: "living-room" as const,
							},
				),
			},
		};
		const before = JSON.stringify(source);

		const result = moveGeneralWall(
			source,
			{ positionMm: 1700, wallSegmentId: "divider" },
			"2026-08-23T00:41:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					vertexId: "divider-bottom",
					xMm: 1700,
					zMm: 0,
				}),
				expect.objectContaining({
					vertexId: "divider-top",
					xMm: 1700,
					zMm: 3100,
				}),
			]),
		);
		expect(result.project.level.rooms).toEqual([
			{
				faceFingerprint: "grid:0:1700:0:3100:100",
				heightMm: 2750,
				name: "Кухня",
				roomId: "room-1",
				type: "kitchen",
			},
			{
				faceFingerprint: "grid:1700:4100:0:3100:100",
				heightMm: 2800,
				name: "Гостиная",
				roomId: "room-right",
				type: "living-room",
			},
		]);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("expands a furnished concave Room by moving its outer wall", () => {
		const source = projectWithSidewaysTable(
			concaveRoomProject(),
			"room-concave",
		);
		const updatedAt = "2026-11-25T10:01:00.000Z";
		const result = moveGeneralWall(
			source,
			{ positionMm: 4500, wallSegmentId: "wall-2" },
			updatedAt,
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.updatedAt).toBe(updatedAt);
		expect(result.project.assetInstances).toEqual(source.assetInstances);
		expect(result.project.level.rooms).toEqual([
			{
				faceFingerprint:
					"orthogonal-face:0:0|0:4000|2000:4000|2000:2000|4500:2000|4500:0",
				heightMm: 2600,
				roomId: "room-concave",
			},
		]);
		const projection = resolveOrthogonalPlanFaces(result.project);
		expect(projection).toMatchObject({
			kind: "accepted",
			plan: {
				rooms: [
					{
						usableFloorPolygonMm: expect.arrayContaining([
							{ xMm: 4450, zMm: 50 },
							{ xMm: 4450, zMm: 1950 },
						]),
					},
				],
			},
		});
	});

	it("preserves both room identities when expanding a concave room around its neighbour", () => {
		const timestamp = "2026-11-25T10:01:00.000Z";
		const side = addGeneralWallToProject(
			concaveRoomProject(),
			{
				start: { xMm: 4000, zMm: 2000 },
				end: { xMm: 4000, zMm: 4000 },
				thicknessMm: 100,
			},
			ids("far-corner", "neighbour-side"),
			timestamp,
		);
		if (side.kind !== "accepted") throw new Error("Expected a neighbour wall");
		const adjacent = addGeneralWallToProject(
			side.project,
			{
				start: { xMm: 4000, zMm: 4000 },
				end: { xMm: 2000, zMm: 4000 },
				thicknessMm: 100,
			},
			ids("neighbour-bottom", "room-neighbour"),
			timestamp,
		);
		if (adjacent.kind !== "accepted")
			throw new Error("Expected two closed rooms");
		const source = {
			...adjacent.project,
			level: {
				...adjacent.project.level,
				rooms: adjacent.project.level.rooms.map((room) =>
					room.roomId === "room-neighbour" ? { ...room, heightMm: 2800 } : room,
				),
			},
		};
		const result = moveGeneralWall(
			source,
			{ positionMm: -500, wallSegmentId: "wall-6" },
			timestamp,
		);
		expect(result).toMatchObject({
			kind: "accepted",
			project: {
				level: {
					rooms: [
						{
							faceFingerprint:
								"orthogonal-face:-500:0|-500:4000|2000:4000|2000:2000|4000:2000|4000:0",
							heightMm: 2600,
							roomId: "room-concave",
						},
						{
							faceFingerprint: "grid:2000:4000:2000:4000:100",
							heightMm: 2800,
							roomId: "room-neighbour",
						},
					],
				},
			},
		});
	});

	it("rejects a moved concave boundary when a rotated item would lose its host", () => {
		const source = projectWithSidewaysTable(
			concaveRoomProject(),
			"room-concave",
		);
		const before = JSON.stringify(source);
		expect(
			moveGeneralWall(
				source,
				{ positionMm: 250, wallSegmentId: "wall-6" },
				"2026-11-25T10:01:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("moves a freely drawn wall while the plan still has no room", () => {
		const timestamp = "2026-11-25T10:01:00.000Z";
		const empty = createInitialProject({
			createdAt: timestamp,
			levelId: "level-1",
			name: "Незамкнутый план",
			projectId: "project-open-plan",
		});
		const drawn = addGeneralWallToProject(
			empty,
			{
				start: { xMm: 3000, zMm: 1000 },
				end: { xMm: 3000, zMm: 2500 },
				thicknessMm: 100,
			},
			ids("start", "end", "wall"),
			timestamp,
		);
		if (drawn.kind !== "accepted") throw new Error("Expected one open wall");

		const moved = moveGeneralWall(
			drawn.project,
			{ positionMm: 3500, wallSegmentId: "wall" },
			timestamp,
		);

		expect(moved).toMatchObject({
			kind: "accepted",
			project: {
				level: {
					rooms: [],
					vertices: [
						{ vertexId: "start", xMm: 3500, zMm: 1000 },
						{ vertexId: "end", xMm: 3500, zMm: 2500 },
					],
				},
			},
		});
	});

	it.each([
		{ wallSegmentId: "wall-1", positionMm: 3600 },
		{ wallSegmentId: "wall-2", positionMm: -500 },
		{ wallSegmentId: "wall-3", positionMm: -500 },
		{ wallSegmentId: "wall-4", positionMm: 4600 },
	])(
		"rejects dragging $wallSegmentId through the opposite boundary",
		(input) => {
			const source = starterProject();
			const before = JSON.stringify(source);
			expect(
				moveGeneralWall(source, input, "2026-11-25T10:01:00.000Z"),
			).toEqual({
				kind: "rejected",
				reasonCode: "INVALID_RESULTING_PROJECT",
			});
			expect(JSON.stringify(source)).toBe(before);
		},
	);

	it("rejects a moved wall that would collapse a Room usable area without changing the current Project", () => {
		const divided = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-23T00:40:00.000Z",
		);
		if (divided.kind !== "accepted") {
			throw new Error("Expected divider fixture");
		}
		const before = JSON.stringify(divided.project);

		expect(
			moveGeneralWall(
				divided.project,
				{ positionMm: 50, wallSegmentId: "divider" },
				"2026-08-23T00:41:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ROOM_USABLE_AREA_COLLAPSE" });
		expect(JSON.stringify(divided.project)).toBe(before);
	});

	it("rejects a moved boundary when a rotated floor footprint leaves the actual usable Room", () => {
		const unrotated = projectWithTable(2000, 850);
		const source = {
			...unrotated,
			assetInstances: unrotated.assetInstances.map((item) => ({
				...item,
				yawStep: 1 as const,
			})),
		};
		const before = JSON.stringify(source);

		expect(
			moveGeneralWall(
				source,
				{ positionMm: 400, wallSegmentId: "wall-1" },
				"2026-08-27T08:06:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects a moved wall body that would cross a floor item", () => {
		const source = projectWithTable();
		const detached = addGeneralWallToProject(
			source,
			{
				end: { xMm: 1000, zMm: 2200 },
				start: { xMm: 1000, zMm: 800 },
				thicknessMm: 100,
			},
			ids("moving-wall-start", "moving-wall-end", "moving-wall"),
			"2026-08-27T08:07:00.000Z",
		);
		if (detached.kind !== "accepted") {
			throw new Error("Expected a movable wall fixture");
		}
		const before = JSON.stringify(detached.project);

		expect(
			moveGeneralWall(
				detached.project,
				{ positionMm: 2000, wallSegmentId: "moving-wall" },
				"2026-08-27T08:08:00.000Z",
			),
		).toEqual({
			affected: { assetInstanceId: "item-1", kind: "floor-item" },
			kind: "rejected",
			reasonCode: "WALL_ITEM_COLLISION",
		});
		expect(JSON.stringify(detached.project)).toBe(before);
	});

	it("rejects a moved 45-degree wall body that would cross a floor item", () => {
		const diagonal = addGeneralWallToProject(
			projectWithTable(),
			{
				end: { xMm: 3900, zMm: 1900 },
				start: { xMm: 2500, zMm: 500 },
				thicknessMm: 100,
			},
			ids("diagonal-body-start", "diagonal-body-end", "diagonal-body-wall"),
			"2026-08-27T08:08:30.000Z",
		);
		if (diagonal.kind !== "accepted") {
			throw new Error("Expected a collision-free diagonal wall fixture");
		}
		const before = JSON.stringify(diagonal.project);

		expect(
			moveGeneralWall(
				diagonal.project,
				{
					translationMm: { xMm: -1000, zMm: 1000 },
					wallSegmentId: "diagonal-body-wall",
				},
				"2026-08-27T08:08:40.000Z",
			),
		).toEqual({
			affected: { assetInstanceId: "item-1", kind: "floor-item" },
			kind: "rejected",
			reasonCode: "WALL_ITEM_COLLISION",
		});
		expect(JSON.stringify(diagonal.project)).toBe(before);
	});

	it("rejects a whole-wall move that would shorten a perpendicular neighbour to its thickness", () => {
		const horizontal = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 7000, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("short-adjacent-start", "short-adjacent-end", "moving-horizontal"),
			"2026-08-27T08:09:00.000Z",
		);
		if (horizontal.kind !== "accepted") {
			throw new Error("Expected detached horizontal fixture");
		}
		const perpendicular = addGeneralWallToProject(
			horizontal.project,
			{
				end: { xMm: 5000, zMm: 5200 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("short-adjacent-fixed", "short-adjacent-wall"),
			"2026-08-27T08:10:00.000Z",
		);
		if (perpendicular.kind !== "accepted") {
			throw new Error("Expected perpendicular neighbour fixture");
		}
		const before = JSON.stringify(perpendicular.project);

		expect(
			moveGeneralWall(
				perpendicular.project,
				{ positionMm: 5100, wallSegmentId: "moving-horizontal" },
				"2026-08-27T08:11:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
		expect(
			moveGeneralWall(
				perpendicular.project,
				{ positionMm: 5099, wallSegmentId: "moving-horizontal" },
				"2026-08-27T08:12:00.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(JSON.stringify(perpendicular.project)).toBe(before);
	});

	it("splits a selected Wall at an exact integer point and preserves the derived Room", () => {
		const source = starterProject();

		const result = splitGeneralWall(
			source,
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("wall-1-split-vertex", "wall-1-tail"),
			"2026-08-23T01:00:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					vertexId: "wall-1-split-vertex",
					xMm: 2000,
					zMm: 0,
				}),
			]),
		);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "wall-1-split-vertex",
					startVertexId: "v-1",
					wallSegmentId: "wall-1",
				}),
				expect.objectContaining({
					endVertexId: "v-2",
					startVertexId: "wall-1-split-vertex",
					wallSegmentId: "wall-1-tail",
				}),
			]),
		);
		expect(result.project.level.rooms).toEqual([
			expect.objectContaining({
				heightMm: 2600,
				roomId: "room-1",
			}),
		]);
	});

	it("rejects a split that would create a wall piece at or below the usable-length boundary", () => {
		const source = starterProject();
		const before = JSON.stringify(source);

		for (const positionMm of [99, 100]) {
			expect(
				splitGeneralWall(
					source,
					{ positionMm, wallSegmentId: "wall-1" },
					idsThatMustNotAllocate(),
					"2026-08-27T09:00:00.000Z",
				),
			).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
		}
		expect(
			splitGeneralWall(
				source,
				{ positionMm: 101, wallSegmentId: "wall-1" },
				ids("usable-split-vertex", "usable-split-tail"),
				"2026-08-27T09:01:00.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(JSON.stringify(source)).toBe(before);
	});

	it("keeps an explicit split stable when a later unrelated wall is added", () => {
		const split = splitGeneralWall(
			starterProject(),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("stable-split-vertex", "stable-split-tail"),
			"2026-08-27T09:02:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected an explicit split fixture");
		}

		const added = addGeneralWallToProject(
			split.project,
			{
				end: { xMm: 6000, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("unrelated-start", "unrelated-end", "unrelated-wall"),
			"2026-08-27T09:03:00.000Z",
		);

		expect(added).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (added.kind !== "accepted") return;
		expect(added.project.level.vertices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ vertexId: "stable-split-vertex" }),
			]),
		);
		expect(added.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ wallSegmentId: "wall-1" }),
				expect.objectContaining({ wallSegmentId: "stable-split-tail" }),
			]),
		);
	});

	it("keeps a non-zero diagonal explicit split stable after an unrelated add", () => {
		const diagonal = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 6002, zMm: 6002 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("diagonal-start", "diagonal-end", "diagonal-wall"),
			"2026-08-27T09:03:10.000Z",
		);
		if (diagonal.kind !== "accepted") {
			throw new Error("Expected a detached diagonal fixture");
		}
		const split = splitGeneralWall(
			diagonal.project,
			{
				pointMm: { xMm: 5500, zMm: 5500 },
				wallSegmentId: "diagonal-wall",
			},
			ids("stable-diagonal-vertex", "stable-diagonal-tail"),
			"2026-08-27T09:03:20.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected a diagonal split fixture");
		}

		const added = addGeneralWallToProject(
			split.project,
			{
				end: { xMm: 8000, zMm: 5000 },
				start: { xMm: 7000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("unrelated-start", "unrelated-end", "unrelated-wall"),
			"2026-08-27T09:03:30.000Z",
		);

		expect(added).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (added.kind !== "accepted") return;
		expect(added.project.level.vertices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ vertexId: "stable-diagonal-vertex" }),
			]),
		);
		expect(added.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ wallSegmentId: "diagonal-wall" }),
				expect.objectContaining({ wallSegmentId: "stable-diagonal-tail" }),
			]),
		);
	});

	it("keeps a far-edge wall item valid when splitting a diagonal host", () => {
		const source = projectWithDiagonalWallPanel(1367);
		expect(
			previewWallSplitHostConflict(source, {
				pointMm: { xMm: 5500, zMm: 5500 },
				wallSegmentId: "diagonal-host",
			}),
		).toEqual({ kind: "none", wallSegmentId: "diagonal-host" });

		const result = splitGeneralWall(
			source,
			{
				pointMm: { xMm: 5500, zMm: 5500 },
				wallSegmentId: "diagonal-host",
			},
			ids("diagonal-split-vertex", "diagonal-tail"),
			"2026-08-27T09:06:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.assetInstances).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					assetInstanceId: "diagonal-panel",
					offsetMm: 659,
					wallSegmentId: "diagonal-tail",
				}),
			]),
		);
	});

	it("places an exact diagonal tail-boundary item on the tail successor", () => {
		const source = projectWithDiagonalWallPanel(758);
		const input = {
			pointMm: { xMm: 5500, zMm: 5500 },
			wallSegmentId: "diagonal-host",
		} as const;

		expect(previewWallSplitHostConflict(source, input)).toEqual({
			kind: "none",
			wallSegmentId: "diagonal-host",
		});
		const result = splitGeneralWall(
			source,
			input,
			ids("diagonal-boundary-vertex", "diagonal-boundary-tail"),
			"2026-08-27T09:06:30.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.assetInstances).toEqual([
			expect.objectContaining({
				offsetMm: 50,
				wallSegmentId: "diagonal-boundary-tail",
			}),
		]);
	});

	it("places an exact diagonal tail-boundary Window on the tail successor", () => {
		const diagonal = projectWithDiagonalWallPanel(1367);
		const withWindow = addWindowOpeningToProject(
			{ ...diagonal, assetInstances: [] },
			{
				heightMm: 500,
				offsetMm: 758,
				sillMm: 500,
				wallSegmentId: "diagonal-host",
				widthMm: 100,
			},
			ids("diagonal-window"),
			"2026-08-27T09:06:40.000Z",
		);
		if (withWindow.kind !== "accepted") {
			throw new Error("Expected a diagonal Window fixture");
		}
		const input = {
			pointMm: { xMm: 5500, zMm: 5500 },
			wallSegmentId: "diagonal-host",
		} as const;

		expect(previewWallSplitHostConflict(withWindow.project, input)).toEqual({
			kind: "none",
			wallSegmentId: "diagonal-host",
		});
		const result = splitGeneralWall(
			withWindow.project,
			input,
			ids("diagonal-window-vertex", "diagonal-window-tail"),
			"2026-08-27T09:06:50.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.openings).toEqual([
			expect.objectContaining({
				offsetMm: 50,
				openingId: "diagonal-window",
				wallSegmentId: "diagonal-window-tail",
			}),
		]);
	});

	it("moves an inline shared Vertex in exact millimetres without changing the derived Room", () => {
		const split = splitGeneralWall(
			starterProject(),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("inline-vertex", "wall-1-tail"),
			"2026-08-23T04:10:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected split-wall fixture");
		}
		const before = JSON.stringify(split.project);

		const result = moveGeneralVertex(
			split.project,
			{ vertexId: "inline-vertex", xMm: 1800, zMm: 0 },
			"2026-08-23T04:11:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					vertexId: "inline-vertex",
					xMm: 1800,
					zMm: 0,
				}),
			]),
		);
		expect(result.project.level.rooms).toEqual(
			expect.arrayContaining([expect.objectContaining({ roomId: "room-1" })]),
		);
		expect(JSON.stringify(split.project)).toBe(before);
	});

	it("rejects an inline Vertex at and below the minimum usable wall length", () => {
		const split = splitGeneralWall(
			starterProject(),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("short-wall-vertex", "wall-1-tail"),
			"2026-08-27T08:00:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected split-wall fixture");
		}
		const before = JSON.stringify(split.project);

		for (const xMm of [99, 100]) {
			expect(
				moveGeneralVertex(
					split.project,
					{ vertexId: "short-wall-vertex", xMm, zMm: 0 },
					"2026-08-27T08:01:00.000Z",
				),
			).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
		}
		expect(
			moveGeneralVertex(
				split.project,
				{ vertexId: "short-wall-vertex", xMm: 101, zMm: 0 },
				"2026-08-27T08:02:00.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
		expect(JSON.stringify(split.project)).toBe(before);
	});

	it("rejects a Vertex move that would leave its wall-hosted item outside the shortened host", () => {
		const detached = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 7000, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("panel-wall-start", "panel-wall-end", "panel-wall"),
			"2026-08-27T08:03:00.000Z",
		);
		if (detached.kind !== "accepted") {
			throw new Error("Expected detached wall fixture");
		}
		const placed = createParametricWallItem(
			detached.project,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Панель на укорачиваемой стене",
				offsetMm: 1600,
				side: "right",
				wallSegmentId: "panel-wall",
				widthMm: 700,
			},
			ids("shortened-wall-panel"),
			"2026-08-27T08:04:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected wall-panel fixture");
		}
		const before = JSON.stringify(placed.project);

		expect(
			moveGeneralVertex(
				placed.project,
				{ vertexId: "panel-wall-end", xMm: 6500, zMm: 5000 },
				"2026-08-27T08:05:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
		expect(JSON.stringify(placed.project)).toBe(before);
	});

	it("rejects a non-zero-origin detached Vertex move at the usable-length boundary", () => {
		const detached = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 5200, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("short-detached-start", "short-detached-end", "short-detached-wall"),
			"2026-08-27T08:13:00.000Z",
		);
		if (detached.kind !== "accepted") {
			throw new Error("Expected short detached fixture");
		}

		expect(
			moveGeneralVertex(
				detached.project,
				{ vertexId: "short-detached-end", xMm: 5100, zMm: 5000 },
				"2026-08-27T08:14:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "TOO_SHORT_WALL" });
		expect(
			moveGeneralVertex(
				detached.project,
				{ vertexId: "short-detached-end", xMm: 5101, zMm: 5000 },
				"2026-08-27T08:15:00.000Z",
			),
		).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("rejects a detached Vertex move whose longer wall body would cross a floor item", () => {
		const detached = addGeneralWallToProject(
			projectWithTable(),
			{
				end: { xMm: 1000, zMm: 1500 },
				start: { xMm: 500, zMm: 1500 },
				thicknessMm: 100,
			},
			ids("growing-wall-start", "growing-wall-end", "growing-wall"),
			"2026-08-27T08:16:00.000Z",
		);
		if (detached.kind !== "accepted") {
			throw new Error("Expected growing wall fixture");
		}
		const before = JSON.stringify(detached.project);

		expect(
			moveGeneralVertex(
				detached.project,
				{ vertexId: "growing-wall-end", xMm: 2000, zMm: 1500 },
				"2026-08-27T08:17:00.000Z",
			),
		).toEqual({
			affected: { assetInstanceId: "item-1", kind: "floor-item" },
			kind: "rejected",
			reasonCode: "WALL_ITEM_COLLISION",
		});
		expect(JSON.stringify(detached.project)).toBe(before);
	});

	it("moves a detached 45-degree wall endpoint along its diagonal without changing the Room", () => {
		const added = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: -1000, zMm: -1000 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("diagonal-end", "diagonal-wall"),
			"2026-08-23T12:32:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected detached diagonal fixture");
		}
		const before = JSON.stringify(added.project);

		const result = moveGeneralVertex(
			added.project,
			{ vertexId: "diagonal-end", xMm: -1400, zMm: -1400 },
			"2026-08-23T12:33:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "diagonal-end", xMm: -1400, zMm: -1400 },
			]),
		);
		expect(result.project.level.rooms).toEqual(added.project.level.rooms);
		expect(JSON.stringify(added.project)).toBe(before);
	});

	it("removes a split-only inline Vertex by merging its two equal-thickness wall pieces", () => {
		const split = splitGeneralWall(
			starterProject(),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("inline-vertex", "wall-1-tail"),
			"2026-08-23T04:55:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected split-wall fixture");
		}

		const result = deleteGeneralVertex(
			split.project,
			{ vertexId: "inline-vertex" },
			"2026-08-23T04:56:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.level.vertices).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ vertexId: "inline-vertex" }),
			]),
		);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "v-2",
					startVertexId: "v-1",
					wallSegmentId: "wall-1",
				}),
			]),
		);
		expect(result.project.level.wallSegments).toHaveLength(4);
		expect(result.project.level.rooms).toEqual([
			expect.objectContaining({ roomId: "room-1" }),
		]);
	});

	it("finds the same straight run when tapping any constituent segment of a saved wall", () => {
		const split = splitGeneralWall(
			starterProject(),
			{ positionMm: 2050, wallSegmentId: "wall-1" },
			ids("inline-vertex", "wall-1-tail"),
			"2026-08-23T04:55:00.000Z",
		);
		if (split.kind !== "accepted") throw new Error("Expected split wall");
		const source = split.project;
		const before = JSON.stringify(source);
		const expected = {
			startVertexId: "v-1",
			endVertexId: "v-2",
			wallSegmentIds: ["wall-1", "wall-1-tail"],
		};
		expect(uninterruptedWallRun(source, "wall-1")).toEqual(expected);
		expect(uninterruptedWallRun(source, "wall-1-tail")).toEqual(expected);
		expect(uninterruptedWallRun(source, "wall-2")?.wallSegmentIds).toEqual([
			"wall-2",
		]);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("widens and moves the full uninterrupted run with its attached room and door", () => {
		const split = splitGeneralWall(
			projectWithDoor(),
			{ positionMm: 1000, wallSegmentId: "wall-1" },
			ids("legacy-joint", "wall-1-tail"),
			"2026-08-23T04:55:00.000Z",
		);
		if (split.kind !== "accepted") throw new Error("Expected a saved run");
		const source = split.project;
		const selection = {
			wallSegmentId: "wall-1-tail",
			wallRunSegmentIds: ["wall-1", "wall-1-tail"],
		};
		const updatedAt = "2026-08-23T04:56:00.000Z";
		const widened = changeGeneralWallThickness(
			source,
			{
				...selection,
				thicknessMm: 200,
			},
			updatedAt,
		);
		if (widened.kind !== "accepted") throw new Error("Expected widened run");
		expect(widened.project.level.wallSegments).toEqual(
			source.level.wallSegments.map((wall) =>
				selection.wallRunSegmentIds.includes(wall.wallSegmentId)
					? { ...wall, thicknessMm: 200 }
					: wall,
			),
		);
		const moved = moveGeneralWall(
			widened.project,
			{ ...selection, positionMm: 300 },
			updatedAt,
		);
		if (moved.kind !== "accepted") throw new Error("Expected moved run");
		expect(moved.project.level.vertices).toEqual(
			source.level.vertices.map((vertex) =>
				["v-1", "legacy-joint", "v-2"].includes(vertex.vertexId)
					? { ...vertex, zMm: 300 }
					: vertex,
			),
		);
		expect(moved.project.level.wallSegments).toEqual(
			widened.project.level.wallSegments,
		);
		expect(moved.project.level.openings).toEqual(source.level.openings);
		expect(moved.project.level.rooms).toEqual([
			expect.objectContaining({ heightMm: 2600, roomId: "room-1" }),
		]);
	});

	it("rejects widening the whole run when a part other than the selected wall hits an Opening", () => {
		const timestamp = "2026-08-23T04:57:00.000Z";
		const added = addGeneralWallToProject(
			projectWithDoor(),
			{
				start: { xMm: 2050, zMm: -1100 },
				end: { xMm: 2050, zMm: -100 },
				thicknessMm: 100,
			},
			ids("guard-start", "guard-end", "guard-wall"),
			timestamp,
		);
		if (added.kind !== "accepted")
			throw new Error("Expected a safe guard wall");
		const split = splitGeneralWall(
			added.project,
			{ positionMm: -600, wallSegmentId: "guard-wall" },
			ids("guard-joint", "guard-tail"),
			timestamp,
		);
		if (split.kind !== "accepted")
			throw new Error("Expected a saved guard run");
		const selection = {
			wallSegmentId: "guard-wall",
			wallRunSegmentIds: ["guard-wall", "guard-tail"],
		};
		const before = JSON.stringify(split.project);
		expect(
			changeGeneralWallThickness(
				split.project,
				{
					...selection,
					thicknessMm: 200,
				},
				timestamp,
			),
		).toEqual({
			affected: { kind: "opening", openingId: "door-1" },
			kind: "rejected",
			reasonCode: "WALL_DOOR_OPENING_COLLISION",
		});
		expect(JSON.stringify(split.project)).toBe(before);

		const host = splitGeneralWall(
			split.project,
			{ positionMm: 1000, wallSegmentId: "wall-1" },
			ids("host-joint", "host-tail"),
			timestamp,
		);
		if (host.kind !== "accepted")
			throw new Error("Expected split Opening host");
		expect(
			changeGeneralWallThickness(
				host.project,
				{
					wallSegmentId: "wall-1",
					wallRunSegmentIds: ["wall-1", "host-tail"],
					thicknessMm: 200,
				},
				timestamp,
			),
		).toEqual({
			affected: { kind: "opening", openingId: "door-1" },
			kind: "rejected",
			reasonCode: "WALL_DOOR_OPENING_COLLISION",
		});
	});

	it("translates an uninterrupted diagonal and rejects stale membership without touching its neighbours", () => {
		const timestamp = "2026-08-23T04:58:00.000Z";
		const added = addGeneralWallToProject(
			starterProject(),
			{
				start: { xMm: 5000, zMm: 5000 },
				end: { xMm: 7000, zMm: 7000 },
				thicknessMm: 100,
			},
			ids("diagonal-start", "diagonal-end", "diagonal-first"),
			timestamp,
		);
		if (added.kind !== "accepted")
			throw new Error("Expected a detached diagonal wall");
		const split = splitGeneralWall(
			added.project,
			{ pointMm: { xMm: 6000, zMm: 6000 }, wallSegmentId: "diagonal-first" },
			ids("diagonal-joint", "diagonal-tail"),
			timestamp,
		);
		if (split.kind !== "accepted")
			throw new Error("Expected a saved diagonal run");
		const input = {
			wallSegmentId: "diagonal-tail",
			translationMm: { xMm: 100, zMm: -100 },
			wallRunSegmentIds: ["diagonal-first", "diagonal-tail"],
		};
		expect(
			moveGeneralWall(
				split.project,
				{
					...input,
					wallRunSegmentIds: ["diagonal-tail"],
				},
				timestamp,
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_RUN_SELECTION_STALE" });
		const moved = moveGeneralWall(split.project, input, timestamp);
		if (moved.kind !== "accepted") throw new Error("Expected moved diagonal");
		expect(moved.project.level.vertices).toEqual(
			split.project.level.vertices.map((vertex) =>
				vertex.vertexId.startsWith("diagonal")
					? { ...vertex, xMm: vertex.xMm + 100, zMm: vertex.zMm - 100 }
					: vertex,
			),
		);
		expect(moved.project.level.wallSegments).toEqual(
			split.project.level.wallSegments,
		);
	});

	it("keeps a true T junction fixed when the chosen run cannot move in parallel", () => {
		const timestamp = "2026-08-23T04:59:00.000Z";
		const divided = addGeneralWallToProject(
			starterProject(),
			{
				start: { xMm: 2050, zMm: 0 },
				end: { xMm: 2050, zMm: 3100 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			timestamp,
		);
		if (divided.kind !== "accepted")
			throw new Error("Expected a saved T junction");
		const split = splitGeneralWall(
			divided.project,
			{ positionMm: 1000, wallSegmentId: "wall-1" },
			ids("inline-join", "legacy-tail"),
			timestamp,
		);
		if (split.kind !== "accepted")
			throw new Error("Expected an inline joint before the T junction");
		const before = JSON.stringify(split.project);
		expect(
			moveGeneralWall(
				split.project,
				{
					wallSegmentId: "legacy-tail",
					wallRunSegmentIds: ["wall-1", "legacy-tail"],
					positionMm: 250,
				},
				timestamp,
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_NOT_MOVABLE" });
		expect(JSON.stringify(split.project)).toBe(before);
	});

	it("preserves the physical hinge on wall reversal when four door orientations are writable", () => {
		const source = projectWithDoor();
		const input = { wallSegmentId: "wall-1" };
		const updatedAt = "2026-08-23T04:56:00.000Z";
		const reversed = reverseGeneralWall(source, input, updatedAt, true);
		if (reversed.kind !== "accepted") throw new Error("Expected reversed wall");
		expect(reversed.project.level.openings[0]).toMatchObject({
			hingeEnd: "end",
			swingSide: "left",
		});
		const restored = reverseGeneralWall(
			reversed.project,
			input,
			updatedAt,
			true,
		);
		if (restored.kind !== "accepted") throw new Error("Expected restored wall");
		expect(restored.project.level.openings[0]).not.toHaveProperty("hingeEnd");
		expect(restored.project.level.openings[0]).toMatchObject({
			offsetMm: 2050,
			swingSide: "right",
		});
	});

	it("keeps the run bounded by an exact T junction and by a thickness change", () => {
		const divided = addGeneralWallToProject(
			starterProject(),
			{
				start: { xMm: 2050, zMm: 0 },
				end: { xMm: 2050, zMm: 3100 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-23T04:55:00.000Z",
		);
		if (divided.kind !== "accepted") throw new Error("Expected a divider");
		expect(
			uninterruptedWallRun(divided.project, "wall-1")?.wallSegmentIds,
		).toEqual(["wall-1"]);
		expect(
			uninterruptedWallRun(divided.project, "bottom-tail")?.wallSegmentIds,
		).toEqual(["bottom-tail"]);
		const split = splitGeneralWall(
			starterProject(),
			{ positionMm: 2050, wallSegmentId: "wall-1" },
			ids("thickness-join", "wall-1-tail"),
			"2026-08-23T04:55:00.000Z",
		);
		if (split.kind !== "accepted") throw new Error("Expected a split wall");
		const source = {
			...split.project,
			level: {
				...split.project.level,
				wallSegments: split.project.level.wallSegments.map((wall) =>
					wall.wallSegmentId === "wall-1-tail"
						? { ...wall, thicknessMm: 120 }
						: wall,
				),
			},
		};
		expect(uninterruptedWallRun(source, "wall-1")?.wallSegmentIds).toEqual([
			"wall-1",
		]);
	});

	it("previews hosted resources on every part of the run and deletes the confirmed run as one candidate", () => {
		const split = splitGeneralWall(
			starterProject(),
			{ positionMm: 2050, wallSegmentId: "wall-1" },
			ids("inline-vertex", "wall-1-tail"),
			"2026-08-23T04:55:00.000Z",
		);
		if (split.kind !== "accepted") throw new Error("Expected a split wall");
		const withDoor = addDoorOpeningToProject(
			split.project,
			{
				heightMm: 2100,
				offsetMm: 900,
				sillMm: 0,
				wallSegmentId: "wall-1-tail",
				widthMm: 900,
			},
			ids("tail-door"),
			"2026-08-23T04:56:00.000Z",
		);
		if (withDoor.kind !== "accepted") throw new Error("Expected a door");
		const withItem = createParametricWallItem(
			withDoor.project,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Панель",
				offsetMm: 900,
				side: "right",
				wallSegmentId: "wall-1",
				widthMm: 400,
			},
			ids("head-panel"),
			"2026-08-23T04:57:00.000Z",
		);
		if (withItem.kind !== "accepted") throw new Error("Expected a wall item");
		const source = withItem.project;
		const before = JSON.stringify(source);
		const input = {
			wallSegmentId: "wall-1",
			wallRunSegmentIds: ["wall-1", "wall-1-tail"],
		};
		expect(previewWallDeletionConflict(source, input)).toMatchObject({
			kind: "conflict",
			itemIds: ["head-panel"],
			openingIds: ["tail-door"],
			roomIds: ["room-1"],
		});
		const confirmation = {
			...input,
			itemIds: ["head-panel"],
			openingIds: ["tail-door"],
			roomIds: ["room-1"],
		};
		const updatedAt = "2026-08-23T04:58:00.000Z";
		expect(
			deleteGeneralWallWithConsequenceResolution(
				source,
				{
					...confirmation,
					wallRunSegmentIds: ["wall-1"],
				},
				updatedAt,
			),
		).toMatchObject({
			kind: "rejected",
			reasonCode: "WALL_DELETION_CONFLICT_STALE",
		});
		const deleted = deleteGeneralWallWithConsequenceResolution(
			source,
			confirmation,
			updatedAt,
		);
		expect(deleted).toMatchObject({
			kind: "accepted",
			project: { assetInstances: [], level: { openings: [], rooms: [] } },
		});
		if (deleted.kind !== "accepted")
			throw new Error("Expected confirmed deletion");
		expect(
			deleted.project.level.wallSegments.map((wall) => wall.wallSegmentId),
		).toEqual(["wall-2", "wall-3", "wall-4"]);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("keeps a corner Vertex intact when an inline merge is not topologically safe", () => {
		const source = starterProject();
		const before = JSON.stringify(source);

		expect(
			deleteGeneralVertex(
				source,
				{ vertexId: "v-1" },
				"2026-08-23T04:57:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "VERTEX_NOT_DELETABLE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects a corner Vertex move that would make an attached wall diagonal", () => {
		const source = starterProject();
		const before = JSON.stringify(source);

		expect(
			moveGeneralVertex(
				source,
				{ vertexId: "v-1", xMm: 100, zMm: 0 },
				"2026-08-23T04:12:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "VERTEX_NOT_MOVABLE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects a Wall split at an endpoint or non-integer point without allocating an identity", () => {
		const source = starterProject();
		const noIds = idsThatMustNotAllocate();

		expect(
			splitGeneralWall(
				source,
				{ positionMm: 0, wallSegmentId: "wall-1" },
				noIds,
				"2026-08-23T01:00:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_SPLIT_POINT_INVALID" });
		expect(
			splitGeneralWall(
				source,
				{ positionMm: 2000.5, wallSegmentId: "wall-1" },
				noIds,
				"2026-08-23T01:00:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_SPLIT_POINT_INVALID" });
	});

	it("keeps an Opening host intact by rejecting a split of its selected Wall", () => {
		const source = projectWithDoor();
		const before = JSON.stringify(source);

		expect(
			splitGeneralWall(
				source,
				{ positionMm: 2000, wallSegmentId: "wall-1" },
				idsThatMustNotAllocate(),
				"2026-08-23T01:00:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OPENING_HOST_UNRESOLVABLE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("previews and atomically removes only an Opening cut by a wall split", () => {
		const source = projectWithDoor();
		const before = JSON.stringify(source);
		const input = { positionMm: 2050, wallSegmentId: "wall-1" } as const;

		expect(previewOpeningConflictForWallSplit(source, input)).toEqual({
			kind: "conflict",
			openingIds: ["door-1"],
			wallSegmentId: "wall-1",
		});
		expect(
			splitGeneralWallWithOpeningResolution(
				source,
				{ ...input, openingIds: [] },
				idsThatMustNotAllocate(),
				"2026-08-23T13:58:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OPENING_CONFLICT_STALE" });
		expect(JSON.stringify(source)).toBe(before);

		expect(
			splitGeneralWallWithOpeningResolution(
				source,
				{ ...input, openingIds: ["door-1"] },
				ids("split-vertex", "split-tail"),
				"2026-08-23T13:58:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [],
						wallSegments: expect.arrayContaining([
							expect.objectContaining({ wallSegmentId: "wall-1" }),
							expect.objectContaining({ wallSegmentId: "split-tail" }),
						]),
					}),
				}),
			}),
		);
	});

	it("keeps a Door or Window on its one unambiguous split-wall successor", () => {
		const headDoor = splitGeneralWall(
			projectWithDoor(),
			{ positionMm: 2500, wallSegmentId: "wall-1" },
			ids("door-split-vertex", "door-split-tail"),
			"2026-08-23T13:55:00.000Z",
		);
		expect(headDoor).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [
							expect.objectContaining({
								offsetMm: 2050,
								openingId: "door-1",
								wallSegmentId: "wall-1",
							}),
						],
					}),
				}),
			}),
		);

		const tailWindow = splitGeneralWall(
			projectWithWindow(),
			{ positionMm: 1000, wallSegmentId: "wall-1" },
			ids("window-split-vertex", "window-split-tail"),
			"2026-08-23T13:55:00.000Z",
		);
		expect(tailWindow).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [
							expect.objectContaining({
								offsetMm: 1050,
								openingId: "window-1",
								wallSegmentId: "window-split-tail",
							}),
						],
					}),
				}),
			}),
		);
	});

	it("rehosts a whole wall panel to its one split-wall successor without changing its semantic side", () => {
		const headPanel = splitGeneralWall(
			projectWithWallPanel(1000),
			{ positionMm: 2500, wallSegmentId: "wall-1" },
			ids("head-panel-split-vertex", "head-panel-split-tail"),
			"2026-08-24T15:31:00.000Z",
		);
		expect(headPanel).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "wall-panel-1",
							offsetMm: 1000,
							side: "right",
							wallSegmentId: "wall-1",
						}),
					],
				}),
			}),
		);

		const tailPanel = splitGeneralWall(
			projectWithWallPanel(3000),
			{ positionMm: 1000, wallSegmentId: "wall-1" },
			ids("tail-panel-split-vertex", "tail-panel-split-tail"),
			"2026-08-24T15:31:00.000Z",
		);
		expect(tailPanel).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "wall-panel-1",
							offsetMm: 2000,
							side: "right",
							wallSegmentId: "tail-panel-split-tail",
						}),
					],
				}),
			}),
		);
	});

	it("previews and atomically removes only a wall panel cut by a wall split", () => {
		const source = projectWithWallPanelsOnDifferentHosts();
		const before = JSON.stringify(source);
		const input = { positionMm: 3000, wallSegmentId: "wall-1" } as const;

		expect(previewWallSplitHostConflict(source, input)).toEqual({
			itemIds: ["wall-panel-1"],
			kind: "conflict",
			openingIds: [],
			wallSegmentId: "wall-1",
		});
		expect(
			splitGeneralWallWithHostResolution(
				source,
				{ ...input, itemIds: [], openingIds: [] },
				idsThatMustNotAllocate(),
				"2026-08-26T09:10:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_SPLIT_CONFLICT_STALE" });
		expect(
			splitGeneralWallWithHostResolution(
				source,
				{
					...input,
					itemIds: ["wall-panel-1", "wall-panel-1"],
					openingIds: [],
				},
				idsThatMustNotAllocate(),
				"2026-08-26T09:10:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_SPLIT_CONFLICT_STALE" });

		const resolved = splitGeneralWallWithHostResolution(
			source,
			{ ...input, itemIds: ["wall-panel-1"], openingIds: [] },
			ids("item-split-vertex", "item-split-tail"),
			"2026-08-26T09:10:00.000Z",
		);

		expect(resolved).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (resolved.kind !== "accepted") return;
		expect(resolved.project.assetInstances).toEqual([
			expect.objectContaining({
				assetInstanceId: "wall-panel-2",
				wallSegmentId: "wall-2",
			}),
		]);
		expect(resolved.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "item-split-vertex",
					wallSegmentId: "wall-1",
				}),
				expect.objectContaining({
					startVertexId: "item-split-vertex",
					wallSegmentId: "item-split-tail",
				}),
			]),
		);
		expect(resolved.project.level.rooms).toEqual(source.level.rooms);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("previews exact wall-item split boundaries and ignores invalid candidates", () => {
		const source = projectWithWallPanelsOnDifferentHosts();
		const sourcePanel = source.assetInstances.find(
			(item) => item.assetInstanceId === "wall-panel-1",
		);
		if (sourcePanel?.anchorClass !== "wall") {
			throw new Error("Expected wall-panel fixture");
		}
		const sameOffsetOnDifferentHosts = {
			...source,
			assetInstances: source.assetInstances.map((item) => ({
				...item,
				offsetMm: 1500,
			})),
		};

		expect(
			previewWallSplitHostConflict(sameOffsetOnDifferentHosts, {
				positionMm: 1500,
				wallSegmentId: "wall-1",
			}),
		).toEqual({
			itemIds: ["wall-panel-1"],
			kind: "conflict",
			openingIds: [],
			wallSegmentId: "wall-1",
		});
		expect(
			previewWallSplitHostConflict(
				{
					...source,
					assetInstances: [
						{
							...sourcePanel,
							assetInstanceId: "wall-panel-3",
							offsetMm: 2600,
							wallSegmentId: "wall-3",
						},
					],
				},
				{ positionMm: 1500, wallSegmentId: "wall-3" },
			),
		).toEqual({
			itemIds: ["wall-panel-3"],
			kind: "conflict",
			openingIds: [],
			wallSegmentId: "wall-3",
		});

		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 2550,
				wallSegmentId: "wall-1",
			}),
		).toEqual({ kind: "none", wallSegmentId: "wall-1" });
		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 2551,
				wallSegmentId: "wall-1",
			}),
		).toEqual({
			itemIds: ["wall-panel-1"],
			kind: "conflict",
			openingIds: [],
			wallSegmentId: "wall-1",
		});
		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 3449,
				wallSegmentId: "wall-1",
			}),
		).toEqual({
			itemIds: ["wall-panel-1"],
			kind: "conflict",
			openingIds: [],
			wallSegmentId: "wall-1",
		});
		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 3450,
				wallSegmentId: "wall-1",
			}),
		).toEqual({ kind: "none", wallSegmentId: "wall-1" });
		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 1500,
				wallSegmentId: "wall-2",
			}),
		).toEqual({
			itemIds: ["wall-panel-2"],
			kind: "conflict",
			openingIds: [],
			wallSegmentId: "wall-2",
		});
		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 1000,
				wallSegmentId: "wall-1",
			}),
		).toEqual({ kind: "none", wallSegmentId: "wall-1" });
		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 0,
				wallSegmentId: "wall-1",
			}),
		).toEqual({ kind: "none", wallSegmentId: "wall-1" });
		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 1000,
				wallSegmentId: "missing-wall",
			}),
		).toEqual({ kind: "none", wallSegmentId: "missing-wall" });
		expect(
			previewWallSplitHostConflict(
				{
					...source,
					level: {
						...source.level,
						vertices: source.level.vertices.filter(
							(vertex) => vertex.vertexId !== "v-1",
						),
					},
				},
				{ positionMm: 3000, wallSegmentId: "wall-1" },
			),
		).toEqual({ kind: "none", wallSegmentId: "wall-1" });
		expect(
			splitGeneralWallWithHostResolution(
				source,
				{
					itemIds: [],
					openingIds: [],
					positionMm: 1000,
					wallSegmentId: "wall-1",
				},
				idsThatMustNotAllocate(),
				"2026-08-26T09:11:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_SPLIT_CONFLICT_STALE" });
	});

	it("includes and atomically removes an Opening cut by the complete split-host preview", () => {
		const source = projectWithOpeningsOnDifferentWallHosts();
		const input = { positionMm: 1000, wallSegmentId: "wall-1" } as const;

		expect(previewWallSplitHostConflict(source, input)).toEqual({
			itemIds: [],
			kind: "conflict",
			openingIds: ["door-1"],
			wallSegmentId: "wall-1",
		});
		const resolved = splitGeneralWallWithHostResolution(
			source,
			{ ...input, itemIds: [], openingIds: ["door-1"] },
			ids("host-split-vertex", "host-split-tail"),
			"2026-08-26T09:12:00.000Z",
		);

		expect(resolved).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (resolved.kind !== "accepted") return;
		expect(resolved.project.level.openings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ openingId: "window-1" }),
				expect.objectContaining({
					openingId: "window-2",
					wallSegmentId: "wall-2",
				}),
			]),
		);
		expect(resolved.project.level.openings).toHaveLength(2);
		expect(resolved.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ wallSegmentId: "wall-1" }),
				expect.objectContaining({ wallSegmentId: "host-split-tail" }),
			]),
		);
	});

	it("sorts every wall-item identity cut by the same split", () => {
		const base = projectWithWallPanel(2000);
		const item = base.assetInstances[0];
		if (item?.anchorClass !== "wall") {
			throw new Error("Expected wall-panel fixture");
		}
		const source = {
			...base,
			assetInstances: [
				{ ...item, assetInstanceId: "wall-panel-z", side: "right" as const },
				{ ...item, assetInstanceId: "wall-panel-a", side: "left" as const },
			],
		};

		expect(
			previewWallSplitHostConflict(source, {
				positionMm: 2000,
				wallSegmentId: "wall-1",
			}),
		).toEqual({
			itemIds: ["wall-panel-a", "wall-panel-z"],
			kind: "conflict",
			openingIds: [],
			wallSegmentId: "wall-1",
		});
	});

	it("keeps an item edge at the split boundary on a deterministic successor", () => {
		const headAtBoundary = splitGeneralWall(
			projectWithWallPanel(1550),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("head-boundary-split-vertex", "head-boundary-split-tail"),
			"2026-08-24T15:31:00.000Z",
		);
		expect(headAtBoundary).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							offsetMm: 1550,
							wallSegmentId: "wall-1",
						}),
					],
				}),
			}),
		);

		const tailAtBoundary = splitGeneralWall(
			projectWithWallPanel(2450),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("tail-boundary-split-vertex", "tail-boundary-split-tail"),
			"2026-08-24T15:31:00.000Z",
		);
		expect(tailAtBoundary).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							offsetMm: 450,
							wallSegmentId: "tail-boundary-split-tail",
						}),
					],
				}),
			}),
		);
	});

	it("rehosts only the items belonging to the split Wall", () => {
		const result = splitGeneralWall(
			projectWithWallPanelsOnDifferentHosts(),
			{ positionMm: 1000, wallSegmentId: "wall-1" },
			ids("two-panel-split-vertex", "two-panel-split-tail"),
			"2026-08-24T15:31:00.000Z",
		);

		expect(result).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "wall-panel-1",
							offsetMm: 2000,
							wallSegmentId: "two-panel-split-tail",
						}),
						expect.objectContaining({
							assetInstanceId: "wall-panel-2",
							offsetMm: 1500,
							side: "left",
							wallSegmentId: "wall-2",
						}),
					],
				}),
			}),
		);
	});

	it("previews and atomically deletes only the wall panel hosted by a deleted Wall", () => {
		const source = projectWithWallPanelsOnDifferentHosts();
		const before = JSON.stringify(source);

		expect(
			previewWallDeletionConflict(source, { wallSegmentId: "wall-1" }),
		).toEqual({
			itemIds: ["wall-panel-1"],
			kind: "conflict",
			openingIds: [],
			roomIds: ["room-1"],
			wallSegmentId: "wall-1",
		});
		expect(
			deleteGeneralWallFromProject(
				source,
				{ wallSegmentId: "wall-1" },
				"2026-08-24T15:43:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
		expect(
			deleteGeneralWallWithConsequenceResolution(
				source,
				{
					itemIds: ["wall-panel-1"],
					openingIds: [],
					roomIds: ["room-1"],
					wallSegmentId: "wall-1",
				},
				"2026-08-24T15:43:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "wall-panel-2",
							wallSegmentId: "wall-2",
						}),
					],
				}),
			}),
		);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("previews the Room removed with a boundary Wall without discarding a panel on another Wall", () => {
		const source = projectWithWallPanelsOnDifferentHosts();

		expect(
			previewWallDeletionConflict(source, { wallSegmentId: "wall-3" }),
		).toEqual({
			itemIds: [],
			kind: "conflict",
			openingIds: [],
			roomIds: ["room-1"],
			wallSegmentId: "wall-3",
		});
		expect(
			deleteGeneralWallFromProject(
				source,
				{ wallSegmentId: "wall-3" },
				"2026-08-24T15:43:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: expect.arrayContaining([
						expect.objectContaining({ assetInstanceId: "wall-panel-1" }),
						expect.objectContaining({ assetInstanceId: "wall-panel-2" }),
					]),
				}),
			}),
		);
	});

	it("rehosts a panel from the removed split successor when an inline Vertex is merged", () => {
		const split = splitGeneralWall(
			projectWithWallPanel(3000),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("panel-merge-vertex", "panel-merge-tail"),
			"2026-08-24T15:53:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected a split panel fixture");
		}

		expect(
			deleteGeneralVertex(
				split.project,
				{ vertexId: "panel-merge-vertex" },
				"2026-08-24T15:53:01.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "wall-panel-1",
							offsetMm: 3000,
							side: "right",
							wallSegmentId: "wall-1",
						}),
					],
					level: expect.objectContaining({
						wallSegments: expect.not.arrayContaining([
							expect.objectContaining({
								wallSegmentId: "panel-merge-tail",
							}),
						]),
					}),
				}),
			}),
		);
	});

	it("keeps a panel's physical side and position when the removed segment is reversed", () => {
		const split = splitGeneralWall(
			projectWithWallPanel(3000),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("reversed-panel-merge-vertex", "reversed-panel-merge-tail"),
			"2026-08-24T21:11:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected a split panel fixture");
		}
		const reversedTail = {
			...split.project,
			assetInstances: split.project.assetInstances.map((item) =>
				item.anchorClass === "wall"
					? { ...item, offsetMm: 1100, side: "left" as const }
					: item,
			),
			level: {
				...split.project.level,
				wallSegments: split.project.level.wallSegments.map((wall) =>
					wall.wallSegmentId === "reversed-panel-merge-tail"
						? {
								...wall,
								endVertexId: wall.startVertexId,
								startVertexId: wall.endVertexId,
							}
						: wall,
				),
			},
		};

		expect(
			deleteGeneralVertex(
				reversedTail,
				{ vertexId: "reversed-panel-merge-vertex" },
				"2026-08-24T21:11:01.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							offsetMm: 3000,
							side: "right",
							wallSegmentId: "wall-1",
						}),
					],
				}),
			}),
		);
		const rightSidedReversedTail = {
			...reversedTail,
			assetInstances: reversedTail.assetInstances.map((item) =>
				item.anchorClass === "wall"
					? { ...item, side: "right" as const }
					: item,
			),
		};
		expect(
			deleteGeneralVertex(
				rightSidedReversedTail,
				{ vertexId: "reversed-panel-merge-vertex" },
				"2026-08-24T21:11:02.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [expect.objectContaining({ side: "left" })],
				}),
			}),
		);
	});

	it("keeps a panel's physical position when the surviving segment starts at the removed Vertex", () => {
		const split = splitGeneralWall(
			projectWithWallPanel(500),
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("reversed-survivor-vertex", "reversed-survivor-tail"),
			"2026-08-27T11:00:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected a split panel fixture");
		}
		const source = {
			...split.project,
			assetInstances: split.project.assetInstances.map((item) =>
				item.anchorClass === "wall"
					? { ...item, offsetMm: 1500, side: "left" as const }
					: item,
			),
			level: {
				...split.project.level,
				wallSegments: split.project.level.wallSegments.map((wall) =>
					wall.wallSegmentId === "wall-1"
						? {
								...wall,
								endVertexId: wall.startVertexId,
								startVertexId: wall.endVertexId,
							}
						: wall,
				),
			},
		};

		expect(
			deleteGeneralVertex(
				source,
				{ vertexId: "reversed-survivor-vertex" },
				"2026-08-27T11:00:01.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							offsetMm: 3600,
							side: "left",
							wallSegmentId: "wall-1",
						}),
					],
				}),
			}),
		);
	});

	it("rejects a split through a wall panel without allocating a partial topology", () => {
		const source = projectWithWallPanel(2000);
		const before = JSON.stringify(source);

		expect(
			splitGeneralWall(
				source,
				{ positionMm: 2000, wallSegmentId: "wall-1" },
				idsThatMustNotAllocate(),
				"2026-08-24T15:31:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects a topology mutation when a persisted wall panel no longer fits its host", () => {
		const placed = projectWithWallPanel(1000);
		const source = {
			...placed,
			assetInstances: placed.assetInstances.map((item) =>
				item.anchorClass === "wall" ? { ...item, offsetMm: 10_000 } : item,
			),
		};
		const before = JSON.stringify(source);

		expect(
			splitGeneralWall(
				source,
				{ positionMm: 2000, wallSegmentId: "wall-1" },
				idsThatMustNotAllocate(),
				"2026-08-24T15:31:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_SOURCE_PROJECT" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects a selected thickness that would consume a placed floor item's usable room area", () => {
		const source = projectWithTable(2000, 400);
		const before = JSON.stringify(source);

		expect(
			changeGeneralWallThickness(
				source,
				{ thicknessMm: 500, wallSegmentId: "wall-1" },
				"2026-08-15T09:00:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects a concave thickness edit when the exact recomputed usable polygon loses a retained item", () => {
		const contour = [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 2000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 2000, zMm: 2000 }, start: { xMm: 4000, zMm: 2000 } },
			{ end: { xMm: 2000, zMm: 4000 }, start: { xMm: 2000, zMm: 2000 } },
			{ end: { xMm: 0, zMm: 4000 }, start: { xMm: 2000, zMm: 4000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 4000 } },
		] as const;
		let project = createInitialProject({
			createdAt: "2026-08-27T14:00:00.000Z",
			levelId: "level-concave-item",
			name: "Вогнутая комната с предметом",
			projectId: "project-concave-item-thickness",
		});
		contour.forEach((wall, index) => {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				index === contour.length - 1
					? ids(`host-wall-${index + 1}`, "room-concave")
					: ids(
							...(index === 0
								? ["host-v-1", "host-v-2", "host-wall-1"]
								: [`host-v-${index + 2}`, `host-wall-${index + 1}`]),
						),
				`2026-08-27T14:0${index + 1}:00.000Z`,
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a concave item-host fixture");
			}
			project = added.project;
		});
		const placed = createParametricFloorItem(
			project,
			{
				color: "#2f80ed",
				depthMm: 200,
				heightMm: 750,
				label: "Стол у внутренней стены",
				roomId: "room-concave",
				widthMm: 200,
				xMm: 1800,
				zMm: 3000,
			},
			ids("concave-item"),
			"2026-08-27T14:10:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected an initially valid concave floor item");
		}
		const before = JSON.stringify(placed.project);

		expect(
			changeGeneralWallThickness(
				placed.project,
				{ thicknessMm: 500, wallSegmentId: "host-wall-4" },
				"2026-08-27T14:11:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
		expect(JSON.stringify(placed.project)).toBe(before);
	});

	it("rejects a thickness edit instead of publishing a Project with an invalid durable Opening", () => {
		const valid = projectWithDoor();
		const source = {
			...valid,
			level: {
				...valid.level,
				openings: valid.level.openings.map((opening) => ({
					...opening,
					widthMm: 5000,
				})),
			},
		};
		const before = JSON.stringify(source);

		expect(
			changeGeneralWallThickness(
				source,
				{ thicknessMm: 200, wallSegmentId: "wall-1" },
				"2026-08-15T09:00:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "OPENING_HOST_UNRESOLVABLE",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects selected wall thickness outside the hard Project limit without changing the project", () => {
		const source = starterProject();

		expect(
			changeGeneralWallThickness(
				source,
				{ thicknessMm: 1001, wallSegmentId: "wall-1" },
				"2026-08-15T09:00:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "PROJECT_BOUNDS_EXCEEDED" });
	});

	it("rejects a missing selected wall before calculating any resulting rooms", () => {
		expect(
			changeGeneralWallThickness(
				starterProject(),
				{ thicknessMm: 200, wallSegmentId: "missing-wall" },
				"2026-08-15T09:00:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_NOT_FOUND" });
	});

	it("rejects a thickness that reaches the selected room wall length", () => {
		const configured = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-15T09:00:00.000Z",
				levelId: "level-1",
				name: "Узкий план",
				projectId: "project-1",
			}),
			{ depthMm: "100", heightMm: "2600", widthMm: "100" },
			ids(
				"v-1",
				"v-2",
				"v-3",
				"v-4",
				"wall-1",
				"wall-2",
				"wall-3",
				"wall-4",
				"room-1",
			),
			"2026-08-15T09:00:00.000Z",
		);
		if (configured.kind !== "accepted") {
			throw new Error("Expected a narrow rectangular fixture");
		}

		expect(
			changeGeneralWallThickness(
				configured.project,
				{ thicknessMm: 500, wallSegmentId: "wall-1" },
				"2026-08-15T09:01:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "TOO_SHORT_WALL",
		});
	});

	it("rejects a thickness when it collapses one of several derived rooms even if another remains usable", () => {
		const divided = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 200, zMm: 3100 },
				start: { xMm: 200, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"narrow-divider",
				"room-right",
			),
			"2026-08-15T09:00:00.000Z",
		);
		if (divided.kind !== "accepted") {
			throw new Error("Expected a narrow-left-room fixture");
		}

		expect(
			changeGeneralWallThickness(
				divided.project,
				{ thicknessMm: 500, wallSegmentId: "narrow-divider" },
				"2026-08-15T09:01:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "USABLE_POLYGON_COLLAPSED",
		});
	});

	it("fails closed when the source no longer has a complete Room-to-face mapping", () => {
		const source = starterProject();

		expect(
			changeGeneralWallThickness(
				{ ...source, level: { ...source.level, rooms: [] } },
				{ thicknessMm: 200, wallSegmentId: "wall-1" },
				"2026-08-15T09:00:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "INVALID_SOURCE_PROJECT" });
	});

	it("materializes the first room after a user manually closes an empty rectangular plan", () => {
		let project = createInitialProject({
			createdAt: "2026-08-13T08:40:00.000Z",
			levelId: "level-1",
			name: "Ручной план",
			projectId: "project-1",
		});
		const walls = [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 3000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 0, zMm: 3000 }, start: { xMm: 4000, zMm: 3000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 3000 } },
		] as const;
		const identity = ids(
			"v-1",
			"v-2",
			"wall-1",
			"v-3",
			"wall-2",
			"v-4",
			"wall-3",
			"wall-4",
			"room-1",
		);

		for (const wall of walls) {
			const result = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				identity,
				"2026-08-13T08:41:00.000Z",
			);
			if (result.kind !== "accepted") {
				throw new Error(
					`Expected manually drawn wall to be accepted: ${result.reasonCode}`,
				);
			}
			project = result.project;
		}

		expect(project.level.rooms).toEqual([
			{
				faceFingerprint: "grid:0:4000:0:3000:100",
				heightMm: 2600,
				roomId: "room-1",
			},
		]);
		expect(resolveOrthogonalPlanFaces(project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-1" }] },
		});
	});

	it("materializes a new room immediately when walls extend the untouched starter perimeter", () => {
		let project = starterProject();
		const identity = ids(
			"outside-top-vertex",
			"outside-top-wall",
			"outside-right-vertex",
			"outside-right-wall",
			"outside-bottom-wall",
			"outside-room",
		);
		for (const wall of [
			{
				end: { xMm: 8100, zMm: 0 },
				start: { xMm: 4100, zMm: 0 },
			},
			{
				end: { xMm: 8100, zMm: 3100 },
				start: { xMm: 8100, zMm: 0 },
			},
			{
				end: { xMm: 4100, zMm: 3100 },
				start: { xMm: 8100, zMm: 3100 },
			},
		] as const) {
			const result = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				identity,
				"2026-08-13T18:00:00.000Z",
			);
			if (result.kind !== "accepted") {
				throw new Error(
					`Expected an exterior room wall to be accepted: ${result.reasonCode}`,
				);
			}
			project = result.project;
		}

		expect(project.level.rooms).toEqual([
			expect.objectContaining({ roomId: "room-1" }),
			expect.objectContaining({
				faceFingerprint: "grid:4100:8100:0:3100:100",
				roomId: "outside-room",
			}),
		]);
		expect(resolveOrthogonalPlanFaces(project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-1" }, { roomId: "outside-room" }] },
		});
	});

	it("keeps adjoining rooms derivable when a newly drawn wall uses its own configured thickness", () => {
		let project = starterProject();
		const identity = ids(
			"thick-top-vertex",
			"thick-top-wall",
			"thick-right-vertex",
			"thick-right-wall",
			"thick-bottom-wall",
			"thick-room",
		);
		for (const wall of [
			{
				end: { xMm: 8100, zMm: 0 },
				start: { xMm: 4100, zMm: 0 },
			},
			{
				end: { xMm: 8100, zMm: 3100 },
				start: { xMm: 8100, zMm: 0 },
			},
			{
				end: { xMm: 4100, zMm: 3100 },
				start: { xMm: 8100, zMm: 3100 },
			},
		] as const) {
			const result = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 150 },
				identity,
				"2026-08-13T18:10:00.000Z",
			);
			if (result.kind !== "accepted") {
				throw new Error(
					`Expected a 150-mm exterior room wall to be accepted: ${result.reasonCode}`,
				);
			}
			project = result.project;
		}

		expect(project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					thicknessMm: 100,
					wallSegmentId: "wall-2",
				}),
				expect.objectContaining({
					thicknessMm: 150,
					wallSegmentId: "thick-top-wall",
				}),
			]),
		);
		expect(resolveOrthogonalPlanFaces(project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-1" }, { roomId: "thick-room" }] },
		});
	});

	it("repairs an older closed plan that was saved before its first Room metadata was materialized", () => {
		let project = createInitialProject({
			createdAt: "2026-08-13T08:40:00.000Z",
			levelId: "level-1",
			name: "Ручной план",
			projectId: "project-1",
		});
		const drawIds = ids(
			"v-1",
			"v-2",
			"wall-1",
			"v-3",
			"wall-2",
			"v-4",
			"wall-3",
			"wall-4",
			"room-original",
		);
		for (const wall of [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 3000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 0, zMm: 3000 }, start: { xMm: 4000, zMm: 3000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 3000 } },
		]) {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				drawIds,
				"2026-08-13T08:41:00.000Z",
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a manually closed room fixture");
			}
			project = added.project;
		}
		const stale = {
			...project,
			level: { ...project.level, rooms: [] },
		};

		const repaired = reconcileMissingRoomsFromPlanGraph(
			stale,
			ids("room-repaired"),
			"2026-08-13T08:44:00.000Z",
		);

		expect(repaired).toEqual(
			expect.objectContaining({ changed: true, kind: "accepted" }),
		);
		if (repaired.kind !== "accepted") {
			return;
		}
		expect(repaired.project.level.rooms).toEqual([
			{
				faceFingerprint: "grid:0:4000:0:3000:100",
				heightMm: 2600,
				roomId: "room-repaired",
			},
		]);
		expect(resolveOrthogonalPlanFaces(repaired.project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-repaired" }] },
		});
	});

	it("repairs both rooms of a pre-fix closed contour that already has a full divider", () => {
		const source = {
			...createInitialProject({
				createdAt: "2026-08-13T08:40:00.000Z",
				levelId: "level-1",
				name: "Разделённый план",
				projectId: "project-1",
			}),
			level: {
				levelId: "level-1",
				openings: [],
				rooms: [],
				vertices: [
					{ vertexId: "top-left", xMm: 0, zMm: 0 },
					{ vertexId: "top-divider", xMm: 2000, zMm: 0 },
					{ vertexId: "top-right", xMm: 4000, zMm: 0 },
					{ vertexId: "bottom-left", xMm: 0, zMm: 3000 },
					{ vertexId: "bottom-divider", xMm: 2000, zMm: 3000 },
					{ vertexId: "bottom-right", xMm: 4000, zMm: 3000 },
				],
				wallSegments: [
					{
						endVertexId: "top-divider",
						startVertexId: "top-left",
						thicknessMm: 100,
						wallSegmentId: "top-left-wall",
					},
					{
						endVertexId: "top-right",
						startVertexId: "top-divider",
						thicknessMm: 100,
						wallSegmentId: "top-right-wall",
					},
					{
						endVertexId: "bottom-left",
						startVertexId: "top-left",
						thicknessMm: 100,
						wallSegmentId: "left-wall",
					},
					{
						endVertexId: "bottom-divider",
						startVertexId: "bottom-left",
						thicknessMm: 100,
						wallSegmentId: "bottom-left-wall",
					},
					{
						endVertexId: "bottom-right",
						startVertexId: "bottom-divider",
						thicknessMm: 100,
						wallSegmentId: "bottom-right-wall",
					},
					{
						endVertexId: "bottom-right",
						startVertexId: "top-right",
						thicknessMm: 100,
						wallSegmentId: "right-wall",
					},
					{
						endVertexId: "bottom-divider",
						startVertexId: "top-divider",
						thicknessMm: 100,
						wallSegmentId: "divider",
					},
				],
			},
		};

		const repaired = reconcileMissingRoomsFromPlanGraph(
			source,
			ids("room-left", "room-right"),
			"2026-08-13T08:44:00.000Z",
		);

		expect(repaired).toEqual(
			expect.objectContaining({ changed: true, kind: "accepted" }),
		);
		expect(repaired.project.level.rooms).toEqual([
			expect.objectContaining({ roomId: "room-left" }),
			expect.objectContaining({ roomId: "room-right" }),
		]);
		expect(resolveOrthogonalPlanFaces(repaired.project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-left" }, { roomId: "room-right" }] },
		});
	});

	it("does not recover Room metadata for a closed graph whose wall insets collapse the usable floor", () => {
		const collapsed = {
			...createInitialProject({
				createdAt: "2026-08-28T05:00:00.000Z",
				levelId: "collapsed-level",
				name: "Схлопнутая recovery-комната",
				projectId: "collapsed-recovery-project",
			}),
			level: {
				levelId: "collapsed-level",
				openings: [],
				rooms: [],
				vertices: [
					{ vertexId: "top-left", xMm: 0, zMm: 0 },
					{ vertexId: "top-right", xMm: 400, zMm: 0 },
					{ vertexId: "bottom-right", xMm: 400, zMm: 400 },
					{ vertexId: "bottom-left", xMm: 0, zMm: 400 },
				],
				wallSegments: [
					{
						endVertexId: "top-right",
						startVertexId: "top-left",
						thicknessMm: 500,
						wallSegmentId: "top",
					},
					{
						endVertexId: "bottom-right",
						startVertexId: "top-right",
						thicknessMm: 500,
						wallSegmentId: "right",
					},
					{
						endVertexId: "bottom-left",
						startVertexId: "bottom-right",
						thicknessMm: 500,
						wallSegmentId: "bottom",
					},
					{
						endVertexId: "top-left",
						startVertexId: "bottom-left",
						thicknessMm: 500,
						wallSegmentId: "left",
					},
				],
			},
		};

		expect(
			reconcileMissingRoomsFromPlanGraph(
				collapsed,
				idsThatMustNotAllocate(),
				"2026-08-28T05:01:00.000Z",
			),
		).toEqual({ changed: false, kind: "accepted", project: collapsed });
	});

	it("does not recover a collapsed 45-degree triangle before the projection preflight", () => {
		const collapsedTriangle = {
			...createInitialProject({
				createdAt: "2026-08-28T05:02:00.000Z",
				levelId: "collapsed-triangle-level",
				name: "Схлопнутый recovery-треугольник",
				projectId: "collapsed-triangle-recovery-project",
			}),
			level: {
				levelId: "collapsed-triangle-level",
				openings: [],
				rooms: [],
				vertices: [
					{ vertexId: "top-left", xMm: 0, zMm: 0 },
					{ vertexId: "top-right", xMm: 400, zMm: 0 },
					{ vertexId: "bottom-left", xMm: 0, zMm: 400 },
				],
				wallSegments: [
					{
						endVertexId: "top-right",
						startVertexId: "top-left",
						thicknessMm: 500,
						wallSegmentId: "top",
					},
					{
						endVertexId: "bottom-left",
						startVertexId: "top-right",
						thicknessMm: 500,
						wallSegmentId: "diagonal",
					},
					{
						endVertexId: "top-left",
						startVertexId: "bottom-left",
						thicknessMm: 500,
						wallSegmentId: "left",
					},
				],
			},
		};

		expect(
			reconcileMissingRoomsFromPlanGraph(
				collapsedTriangle,
				idsThatMustNotAllocate(),
				"2026-08-28T05:03:00.000Z",
			),
		).toEqual({
			changed: false,
			kind: "accepted",
			project: collapsedTriangle,
		});
	});

	it("leaves an empty, open, malformed, or already materialized plan untouched without allocating an ID", () => {
		const empty = createInitialProject({
			createdAt: "2026-08-13T08:40:00.000Z",
			levelId: "level-1",
			name: "Пустой план",
			projectId: "project-1",
		});
		const open = {
			...empty,
			level: {
				...empty.level,
				vertices: [
					{ vertexId: "v-1", xMm: 0, zMm: 0 },
					{ vertexId: "v-2", xMm: 1000, zMm: 0 },
				],
				wallSegments: [
					{
						endVertexId: "v-2",
						startVertexId: "v-1",
						thicknessMm: 100,
						wallSegmentId: "wall-1",
					},
				],
			},
		};
		const malformed = {
			...open,
			level: {
				...open.level,
				vertices: [
					{ vertexId: "v-1", xMm: 0, zMm: 0 },
					{ vertexId: "v-2", xMm: 1000, zMm: 500 },
				],
			},
		};

		expect(
			reconcileMissingRoomsFromPlanGraph(
				empty,
				idsThatMustNotAllocate(),
				"2026-08-13T08:44:00.000Z",
			),
		).toEqual({ changed: false, kind: "accepted", project: empty });
		expect(
			reconcileMissingRoomsFromPlanGraph(
				open,
				idsThatMustNotAllocate(),
				"2026-08-13T08:44:00.000Z",
			),
		).toEqual({ changed: false, kind: "accepted", project: open });
		expect(
			reconcileMissingRoomsFromPlanGraph(
				malformed,
				idsThatMustNotAllocate(),
				"2026-08-13T08:44:00.000Z",
			),
		).toEqual({ changed: false, kind: "accepted", project: malformed });
		expect(
			reconcileMissingRoomsFromPlanGraph(
				starterProject(),
				idsThatMustNotAllocate(),
				"2026-08-13T08:44:00.000Z",
			),
		).toEqual({
			changed: false,
			kind: "accepted",
			project: starterProject(),
		});
	});

	it("does not repair a closed graph that has data whose durable host semantics would need reinterpretation", () => {
		const closed = {
			...createInitialProject({
				createdAt: "2026-08-13T08:40:00.000Z",
				levelId: "level-1",
				name: "Закрытый план",
				projectId: "project-1",
			}),
			level: {
				levelId: "level-1",
				openings: [],
				rooms: [],
				vertices: [
					{ vertexId: "top-left", xMm: 0, zMm: 0 },
					{ vertexId: "top-right", xMm: 4000, zMm: 0 },
					{ vertexId: "bottom-left", xMm: 0, zMm: 3000 },
					{ vertexId: "bottom-right", xMm: 4000, zMm: 3000 },
				],
				wallSegments: [
					{
						endVertexId: "top-right",
						startVertexId: "top-left",
						thicknessMm: 100,
						wallSegmentId: "top",
					},
					{
						endVertexId: "bottom-right",
						startVertexId: "top-right",
						thicknessMm: 100,
						wallSegmentId: "right",
					},
					{
						endVertexId: "bottom-left",
						startVertexId: "bottom-right",
						thicknessMm: 100,
						wallSegmentId: "bottom",
					},
					{
						endVertexId: "top-left",
						startVertexId: "bottom-left",
						thicknessMm: 100,
						wallSegmentId: "left",
					},
				],
			},
		};
		const withItem = {
			...closed,
			assetInstances: [
				{
					anchorClass: "floor" as const,
					assetInstanceId: "item-1",
					color: "#2f80ed",
					depthMm: 700,
					heightMm: 750,
					label: "Стол",
					roomId: "unknown-room",
					widthMm: 1200,
					xMm: 2000,
					zMm: 1500,
				},
			],
		};
		const withOpening = {
			...closed,
			level: {
				...closed.level,
				openings: [
					{
						heightMm: 2100,
						kind: "Door" as const,
						offsetMm: 2000,
						openingId: "opening-1",
						sillMm: 0,
						wallSegmentId: "top",
						widthMm: 900,
					},
				],
			},
		};

		for (const source of [withItem, withOpening]) {
			expect(
				reconcileMissingRoomsFromPlanGraph(
					source,
					idsThatMustNotAllocate(),
					"2026-08-13T08:44:00.000Z",
				),
			).toEqual({ changed: false, kind: "accepted", project: source });
		}
	});

	it("adds a detached cardinal wall outside existing rooms without changing the room metadata", () => {
		const source = starterProject();

		const result = addGeneralWallToProject(
			source,
			{
				end: { xMm: 6500, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("free-start", "free-end", "free-wall"),
			"2026-08-12T10:03:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.vertices).toEqual(
			expect.arrayContaining([
				{ vertexId: "free-start", xMm: 5000, zMm: 5000 },
				{ vertexId: "free-end", xMm: 6500, zMm: 5000 },
			]),
		);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "free-end",
					startVertexId: "free-start",
					thicknessMm: 100,
					wallSegmentId: "free-wall",
				},
			]),
		);
		expect(result.project.updatedAt).toBe("2026-08-12T10:03:00.000Z");
	});

	it("adds a detached wall outside a room with a rotated floor item against its boundary", () => {
		const source = projectWithSidewaysTable();
		const vertexStart = { xMm: 5000, zMm: 0 };
		const vertexEnd = { xMm: 5000, zMm: 7300 };
		const result = addGeneralWallToProject(
			source,
			{ start: vertexStart, end: vertexEnd, thicknessMm: 100 },
			ids("guide-start", "guide-end", "guide-wall"),
			"2026-11-25T10:02:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.assetInstances).toEqual(source.assetInstances);
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.vertices).toEqual([
			...source.level.vertices,
			{ vertexId: "guide-start", ...vertexStart },
			{ vertexId: "guide-end", ...vertexEnd },
		]);
		expect(result.project.level.wallSegments).toEqual([
			...source.level.wallSegments,
			{
				endVertexId: "guide-end",
				startVertexId: "guide-start",
				thicknessMm: 100,
				wallSegmentId: "guide-wall",
			},
		]);
	});

	it("closes a separate contour without relocating an item from the original room", () => {
		const source = projectWithSidewaysTable();
		const points = [
			{ xMm: 5000, zMm: 0 },
			{ xMm: 6600, zMm: 0 },
			{ xMm: 6600, zMm: 1000 },
			{ xMm: 5000, zMm: 1000 },
			{ xMm: 5000, zMm: 0 },
		];
		const contourIds = ids(
			"exterior-1",
			"exterior-2",
			"exterior-wall-1",
			"exterior-3",
			"exterior-wall-2",
			"exterior-4",
			"exterior-wall-3",
			"exterior-wall-4",
			"exterior-room",
		);
		const result = points
			.slice(1)
			.reduce<ReturnType<typeof addGeneralWallToProject>>(
				(previous, end, index) => {
					const start = points[index];
					if (!start || previous.kind !== "accepted") {
						throw new Error(
							"Expected every open part of the detached contour to save",
						);
					}
					return addGeneralWallToProject(
						previous.project,
						{ start, end, thicknessMm: 100 },
						contourIds,
						"2026-11-25T10:03:00.000Z",
					);
				},
				{ kind: "accepted", project: source },
			);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.assetInstances).toEqual(source.assetInstances);
		expect(resolveOrthogonalPlanFaces(result.project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-1" }, { roomId: "exterior-room" }] },
		});
	});

	it("keeps an existing concave room's ID and item when closing a triangle in its outer notch", () => {
		const timestamp = "2026-11-25T10:03:00.000Z";
		const concave = concaveRoomProject([
			{ xMm: 1000, zMm: 0 },
			{ xMm: 3000, zMm: 0 },
			{ xMm: 3000, zMm: 3000 },
			{ xMm: 0, zMm: 3000 },
			{ xMm: 0, zMm: 1000 },
			{ xMm: 1000, zMm: 1000 },
		]);
		const source = createParametricFloorItem(
			concave,
			{
				color: "#2f80ed",
				depthMm: 300,
				heightMm: 400,
				label: "Табурет",
				roomId: "room-concave",
				widthMm: 300,
				xMm: 1500,
				zMm: 650,
			},
			ids("stool"),
			timestamp,
		);
		if (source.kind !== "accepted")
			throw new Error("Expected stool to fit the room");
		const added = addGeneralWallToProject(
			source.project,
			{
				start: { xMm: 0, zMm: 1000 },
				end: { xMm: 1000, zMm: 0 },
				thicknessMm: 100,
			},
			ids("diagonal", "room-triangle"),
			timestamp,
		);
		expect(added).toMatchObject({
			kind: "accepted",
			project: {
				assetInstances: source.project.assetInstances,
				level: {
					rooms: expect.arrayContaining([
						...source.project.level.rooms,
						{
							faceFingerprint: "orthogonal-face:0:1000|1000:0|1000:1000",
							heightMm: 2600,
							roomId: "room-triangle",
						},
					]),
				},
			},
		});
	});

	it("keeps a retained floor item's position and assigns it to the correct successor after a room split", () => {
		const source = projectWithTable(3000, 1500);
		const result = addGeneralWallToProject(
			source,
			{
				start: { xMm: 2050, zMm: 0 },
				end: { xMm: 2050, zMm: 3100 },
				thicknessMm: 100,
			},
			ids("start", "end", "top-tail", "bottom-tail", "divider", "room-right"),
			"2026-11-25T10:03:00.000Z",
		);

		expect(result).toMatchObject({
			kind: "accepted",
			project: {
				assetInstances: [{ ...source.assetInstances[0], roomId: "room-right" }],
			},
		});
	});

	it("normalizes two contiguous freehand pieces of the same detached wall into one segment", () => {
		const first = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 6500, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("free-start", "free-joint", "free-wall"),
			"2026-08-15T10:00:00.000Z",
		);
		if (first.kind !== "accepted") {
			throw new Error("Expected the first detached wall piece");
		}

		const second = addGeneralWallToProject(
			first.project,
			{
				end: { xMm: 8000, zMm: 5000 },
				start: { xMm: 6500, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("free-tail", "second-wall"),
			"2026-08-15T10:01:00.000Z",
		);

		expect(second).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (second.kind !== "accepted") {
			return;
		}
		expect(second.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "free-tail",
					startVertexId: "free-start",
					thicknessMm: 100,
					wallSegmentId: "free-wall",
				},
			]),
		);
		expect(
			second.project.level.wallSegments.map((wall) => wall.wallSegmentId),
		).not.toContain("second-wall");
		expect(
			second.project.level.vertices.map((vertex) => vertex.vertexId),
		).not.toContain("free-joint");
	});

	it("keeps an outward wall joined to a room corner as a real wall without changing that room", () => {
		const source = starterProject();

		const result = addGeneralWallToProject(
			source,
			{
				end: { xMm: 0, zMm: -1800 },
				start: { xMm: 0, zMm: 0 },
				thicknessMm: 100,
			},
			ids("outward-end", "outward-wall"),
			"2026-08-12T10:03:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.rooms).toEqual(source.level.rooms);
		expect(result.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				{
					endVertexId: "outward-end",
					startVertexId: "v-1",
					thicknessMm: 100,
					wallSegmentId: "outward-wall",
				},
			]),
		);
	});

	it("splits a bounded room only when the user explicitly draws a full wall through it", () => {
		const result = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-12T10:03:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.rooms).toEqual([
			{
				faceFingerprint: "grid:0:2050:0:3100:100",
				heightMm: 2600,
				roomId: "room-1",
			},
			{
				faceFingerprint: "grid:2050:4100:0:3100:100",
				heightMm: 2600,
				roomId: "room-right",
			},
		]);
		expect(result.project.level.wallSegments).toHaveLength(7);
	});

	it("keeps both split rooms derivable from the materialized wall identities", () => {
		const result = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-12T10:03:00.000Z",
		);
		if (result.kind !== "accepted") {
			throw new Error("Expected an interior divider fixture");
		}

		expect(resolveOrthogonalPlanFaces(result.project)).toMatchObject({
			kind: "accepted",
			plan: { rooms: [{ roomId: "room-1" }, { roomId: "room-right" }] },
		});
	});

	it("rejects a wall body that crosses an existing item before allocating an ID or changing the project", () => {
		const source = projectWithTable();
		const before = JSON.stringify(source);

		expect(
			addGeneralWallToProject(
				source,
				{
					end: { xMm: 2000, zMm: 2500 },
					start: { xMm: 2000, zMm: 500 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-12T10:03:00.000Z",
			),
		).toEqual({
			affected: { assetInstanceId: "item-1", kind: "floor-item" },
			kind: "rejected",
			reasonCode: "WALL_ITEM_COLLISION",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects a new wall that would occupy a durable doorway before allocating an ID", () => {
		const source = projectWithDoor();
		const before = JSON.stringify(source);

		expect(
			addGeneralWallToProject(
				source,
				{
					end: { xMm: 2050, zMm: 500 },
					start: { xMm: 2050, zMm: -500 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-15T11:00:00.000Z",
			),
		).toEqual({
			affected: { kind: "opening", openingId: "door-1" },
			kind: "rejected",
			reasonCode: "WALL_DOOR_OPENING_COLLISION",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects a new wall that would occupy a durable window before allocating an ID", () => {
		const source = projectWithWindow();
		const before = JSON.stringify(source);

		expect(
			addGeneralWallToProject(
				source,
				{
					end: { xMm: 2050, zMm: 500 },
					start: { xMm: 2050, zMm: -500 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-15T11:00:00.000Z",
			),
		).toEqual({
			affected: { kind: "opening", openingId: "window-1" },
			kind: "rejected",
			reasonCode: "WALL_DOOR_OPENING_COLLISION",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("allows a wall to meet but not cross an item footprint", () => {
		const source = projectWithTable(1350);

		const result = addGeneralWallToProject(
			source,
			{
				end: { xMm: 2000, zMm: 2500 },
				start: { xMm: 2000, zMm: 500 },
				thicknessMm: 100,
			},
			ids("wall-start", "wall-end", "wall-touching-item"),
			"2026-08-12T10:03:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
	});

	it("also rejects a horizontal wall body that crosses an existing item", () => {
		const source = projectWithTable();

		expect(
			addGeneralWallToProject(
				source,
				{
					end: { xMm: 3500, zMm: 1500 },
					start: { xMm: 500, zMm: 1500 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-12T10:03:00.000Z",
			),
		).toEqual({
			affected: { assetInstanceId: "item-1", kind: "floor-item" },
			kind: "rejected",
			reasonCode: "WALL_ITEM_COLLISION",
		});
	});

	it("rejects a wall that clips the retained 45-degree footprint even when its unrotated edge would only touch", () => {
		const unrotated = projectWithTable();
		const source = {
			...unrotated,
			assetInstances: unrotated.assetInstances.map((item) => ({
				...item,
				yawStep: 1 as const,
			})),
		};

		expect(
			addGeneralWallToProject(
				source,
				{
					end: { xMm: 2650, zMm: 2500 },
					start: { xMm: 2650, zMm: 500 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-12T10:03:00.000Z",
			),
		).toEqual({
			affected: { assetInstanceId: "item-1", kind: "floor-item" },
			kind: "rejected",
			reasonCode: "WALL_ITEM_COLLISION",
		});
	});

	it("removes exactly the selected detached wall and keeps unrelated rooms intact", () => {
		const added = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 6500, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("free-start", "free-end", "free-wall"),
			"2026-08-12T10:03:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a detached wall fixture");
		}

		const result = deleteGeneralWallFromProject(
			added.project,
			{ wallSegmentId: "free-wall" },
			"2026-08-12T10:04:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.rooms).toEqual(starterProject().level.rooms);
		expect(
			result.project.level.wallSegments.map((wall) => wall.wallSegmentId),
		).not.toContain("free-wall");
		expect(
			result.project.level.vertices.map((vertex) => vertex.vertexId),
		).not.toEqual(expect.arrayContaining(["free-start", "free-end"]));
	});

	it("removes a room-closing wall when no hosted item would be orphaned", () => {
		const result = deleteGeneralWallFromProject(
			starterProject(),
			{ wallSegmentId: "wall-1" },
			"2026-08-12T10:04:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.rooms).toEqual([]);
		expect(
			result.project.level.wallSegments.map((wall) => wall.wallSegmentId),
		).not.toContain("wall-1");
	});

	it("removes an explicitly selected interior divider and reconciles its two rooms back to one", () => {
		const source = starterProject();
		const namedSource = {
			...source,
			level: {
				...source.level,
				rooms: source.level.rooms.map((room) => ({
					...room,
					name: "Гостиная",
					type: "living-room" as const,
				})),
			},
		};
		const added = addGeneralWallToProject(
			namedSource,
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-12T10:03:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected an interior divider fixture");
		}

		expect(
			deleteGeneralWallFromProject(
				added.project,
				{ wallSegmentId: "divider" },
				"2026-08-12T10:04:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_DELETION_CONFLICT" });
		const result = deleteGeneralWallWithConsequenceResolution(
			added.project,
			{
				itemIds: [],
				openingIds: [],
				roomIds: ["room-1", "room-right"],
				roomMetadataResolutions: [
					{
						retainedRoomId: "room-1",
						targetFaceKey: "0:4100:0:3100:100:100:100:100",
					},
				],
				wallSegmentId: "divider",
			},
			"2026-08-12T10:04:00.000Z",
		);

		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.rooms).toEqual([
			{
				faceFingerprint: "grid:0:4100:0:3100:100",
				heightMm: 2600,
				name: "Гостиная",
				roomId: "room-1",
				type: "living-room",
			},
		]);
		expect(
			result.project.level.wallSegments.map((wall) => wall.wallSegmentId),
		).not.toContain("divider");
		expect(result.project.level.wallSegments).toHaveLength(4);
	});

	it("requires an explicit source Room when removing a divider merges room metadata", () => {
		const added = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-23T00:20:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected an interior divider fixture");
		}
		const source = {
			...added.project,
			level: {
				...added.project.level,
				rooms: added.project.level.rooms.map((room) =>
					room.roomId === "room-1"
						? {
								...room,
								heightMm: 2750,
								name: "Кухня",
								type: "kitchen" as const,
							}
						: {
								...room,
								heightMm: 3100,
								name: "Гостиная",
								type: "living-room" as const,
							},
				),
			},
		};

		expect(
			previewWallDeletionConflict(source, { wallSegmentId: "divider" }),
		).toEqual({
			itemIds: [],
			kind: "conflict",
			openingIds: [],
			roomIds: ["room-1", "room-right"],
			roomMetadataConflicts: [
				{
					retainedRoomIds: ["room-1", "room-right"],
					targetFaceKey: "0:4100:0:3100:100:100:100:100",
				},
			],
			wallSegmentId: "divider",
		});
		expect(
			deleteGeneralWallWithConsequenceResolution(
				source,
				{
					itemIds: [],
					openingIds: [],
					roomIds: ["room-1", "room-right"],
					wallSegmentId: "divider",
				},
				"2026-08-23T00:21:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "ROOM_METADATA_CONFLICT_STALE",
		});
		expect(
			deleteGeneralWallWithConsequenceResolution(
				source,
				{
					itemIds: [],
					openingIds: [],
					roomIds: ["room-1", "room-right"],
					roomMetadataResolutions: [
						{
							retainedRoomId: "missing-room",
							targetFaceKey: "0:4100:0:3100:100:100:100:100",
						},
					],
					wallSegmentId: "divider",
				},
				"2026-08-23T00:21:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "ROOM_METADATA_CONFLICT_STALE",
		});

		const result = deleteGeneralWallWithConsequenceResolution(
			source,
			{
				itemIds: [],
				openingIds: [],
				roomIds: ["room-1", "room-right"],
				roomMetadataResolutions: [
					{
						retainedRoomId: "room-right",
						targetFaceKey: "0:4100:0:3100:100:100:100:100",
					},
				],
				wallSegmentId: "divider",
			},
			"2026-08-23T00:21:00.000Z",
		);
		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") {
			return;
		}
		expect(result.project.level.rooms).toEqual([
			{
				faceFingerprint: "grid:0:4100:0:3100:100",
				heightMm: 3100,
				name: "Гостиная",
				roomId: "room-right",
				type: "living-room",
			},
		]);
	});

	it("rehosts valid Opening and wall-Item hosts when divider deletion coalesces boundary pieces", () => {
		const divided = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-27T11:10:00.000Z",
		);
		if (divided.kind !== "accepted") {
			throw new Error("Expected a divided-room fixture");
		}
		const withDoor = addDoorOpeningToProject(
			divided.project,
			{
				heightMm: 2100,
				offsetMm: 1400,
				sillMm: 0,
				wallSegmentId: "bottom-tail",
				widthMm: 900,
			},
			ids("tail-door"),
			"2026-08-27T11:11:00.000Z",
		);
		if (withDoor.kind !== "accepted") {
			throw new Error(
				`Expected a Door on a split boundary host: ${JSON.stringify(withDoor)}`,
			);
		}
		const withPanel = createParametricWallItem(
			withDoor.project,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Панель на временном сегменте",
				offsetMm: 500,
				side: "right",
				wallSegmentId: "bottom-tail",
				widthMm: 400,
			},
			ids("tail-panel"),
			"2026-08-27T11:12:00.000Z",
		);
		if (withPanel.kind !== "accepted") {
			throw new Error("Expected a wall Item on a split boundary host");
		}

		expect(
			previewWallDeletionConflict(withPanel.project, {
				wallSegmentId: "divider",
			}),
		).toEqual({
			itemIds: [],
			kind: "conflict",
			openingIds: [],
			roomIds: ["room-1", "room-right"],
			roomMetadataConflicts: [
				{
					retainedRoomIds: ["room-1", "room-right"],
					targetFaceKey: "0:4100:0:3100:100:100:100:100",
				},
			],
			wallSegmentId: "divider",
		});
		const result = deleteGeneralWallWithConsequenceResolution(
			withPanel.project,
			{
				itemIds: [],
				openingIds: [],
				roomIds: ["room-1", "room-right"],
				roomMetadataResolutions: [
					{
						retainedRoomId: "room-1",
						targetFaceKey: "0:4100:0:3100:100:100:100:100",
					},
				],
				wallSegmentId: "divider",
			},
			"2026-08-27T11:13:00.000Z",
		);
		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.assetInstances).toEqual([
			expect.objectContaining({
				assetInstanceId: "tail-panel",
				offsetMm: 2550,
				wallSegmentId: "wall-1",
			}),
		]);
		expect(result.project.level.openings).toEqual([
			expect.objectContaining({
				offsetMm: 3450,
				openingId: "tail-door",
				wallSegmentId: "wall-1",
			}),
		]);
		const reversedTail = reverseGeneralWall(
			withPanel.project,
			{ wallSegmentId: "bottom-tail" },
			"2026-08-27T11:14:00.000Z",
		);
		if (reversedTail.kind !== "accepted")
			throw new Error("Expected reversed tail host");
		const rehosted = deleteGeneralWallWithConsequenceResolution(
			reversedTail.project,
			{
				itemIds: [],
				openingIds: [],
				roomIds: ["room-1", "room-right"],
				roomMetadataResolutions: [
					{
						retainedRoomId: "room-1",
						targetFaceKey: "0:4100:0:3100:100:100:100:100",
					},
				],
				wallSegmentId: "divider",
			},
			"2026-08-27T11:15:00.000Z",
			true,
		);
		expect(rehosted).toMatchObject({
			kind: "accepted",
			project: {
				level: {
					openings: [
						{
							hingeEnd: "end",
							offsetMm: 3450,
							openingId: "tail-door",
							swingSide: "right",
							wallSegmentId: "wall-1",
						},
					],
				},
			},
		});
	});

	it("keeps an exact rotated floor Item when its Room is merged into the chosen predecessor", () => {
		const divided = addGeneralWallToProject(
			starterProject(),
			{
				end: { xMm: 2050, zMm: 3100 },
				start: { xMm: 2050, zMm: 0 },
				thicknessMm: 100,
			},
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
			),
			"2026-08-27T11:20:00.000Z",
		);
		if (divided.kind !== "accepted") {
			throw new Error("Expected a divided-room fixture");
		}
		const placed = createParametricFloorItem(
			divided.project,
			{
				color: "#2f80ed",
				depthMm: 200,
				heightMm: 750,
				label: "Поворотный стол",
				roomId: "room-right",
				widthMm: 1200,
				xMm: 3400,
				zMm: 1500,
			},
			ids("rotated-item"),
			"2026-08-27T11:21:00.000Z",
		);
		if (placed.kind !== "accepted") {
			throw new Error("Expected a floor Item in the right Room");
		}
		const source = {
			...placed.project,
			assetInstances: placed.project.assetInstances.map((item) => ({
				...item,
				xMm: 3950,
				yawStep: 2 as const,
			})),
		};

		const preview = previewWallDeletionConflict(source, {
			wallSegmentId: "divider",
		});
		expect(preview).toEqual(
			expect.objectContaining({
				itemIds: [],
				kind: "conflict",
				roomIds: ["room-1", "room-right"],
			}),
		);
		if (preview.kind !== "conflict") return;
		const result = deleteGeneralWallWithConsequenceResolution(
			source,
			{
				itemIds: [],
				openingIds: [],
				roomIds: ["room-1", "room-right"],
				roomMetadataResolutions: [
					{
						retainedRoomId: "room-1",
						targetFaceKey: "0:4100:0:3100:100:100:100:100",
					},
				],
				wallSegmentId: "divider",
			},
			"2026-08-27T11:22:00.000Z",
		);
		expect(result).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (result.kind !== "accepted") return;
		expect(result.project.assetInstances).toEqual([
			expect.objectContaining({
				assetInstanceId: "rotated-item",
				roomId: "room-1",
				xMm: 3950,
				yawStep: 2,
			}),
		]);
	});

	it("keeps the source untouched when deletion would orphan a hosted item", () => {
		const source = projectWithTable();
		const before = JSON.stringify(source);

		expect(
			deleteGeneralWallFromProject(
				source,
				{ wallSegmentId: "wall-1" },
				"2026-08-12T10:04:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "ITEM_HOST_UNRESOLVABLE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("rejects deletion before it can leave an Opening without a valid wall host", () => {
		const source = projectWithDoor();
		const before = JSON.stringify(source);

		expect(
			deleteGeneralWallFromProject(
				source,
				{ wallSegmentId: "wall-2" },
				"2026-08-15T10:01:00.000Z",
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "OPENING_HOST_UNRESOLVABLE",
		});
		expect(JSON.stringify(source)).toBe(before);
	});

	it("previews and atomically resolves only the Openings hosted by a deleted wall", () => {
		const source = projectWithDoor();
		const before = JSON.stringify(source);

		expect(
			previewOpeningConflictForWallDeletion(source, {
				wallSegmentId: "wall-1",
			}),
		).toEqual({
			kind: "conflict",
			openingIds: ["door-1"],
			wallSegmentId: "wall-1",
		});
		expect(
			deleteGeneralWallWithOpeningResolution(
				source,
				{ openingIds: ["door-1"], wallSegmentId: "wall-1" },
				"2026-08-22T19:50:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					level: expect.objectContaining({
						openings: [],
						wallSegments: expect.not.arrayContaining([
							expect.objectContaining({ wallSegmentId: "wall-1" }),
						]),
					}),
				}),
			}),
		);
		expect(
			deleteGeneralWallWithOpeningResolution(
				source,
				{ openingIds: ["not-the-door"], wallSegmentId: "wall-1" },
				"2026-08-22T19:50:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OPENING_CONFLICT_STALE" });
		expect(JSON.stringify(source)).toBe(before);
	});

	it("previews and atomically resolves every direct Opening and orphaned Item caused by a wall deletion", () => {
		const withDoor = addDoorOpeningToProject(
			projectWithTable(),
			{
				heightMm: 2100,
				offsetMm: 2050,
				sillMm: 0,
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("door-1"),
			"2026-08-22T20:10:00.000Z",
		);
		if (withDoor.kind !== "accepted") {
			throw new Error("Expected an Item and Door fixture");
		}
		const source = withDoor.project;
		const before = JSON.stringify(source);

		expect(
			previewWallDeletionConflict(source, { wallSegmentId: "wall-1" }),
		).toEqual({
			itemIds: ["item-1"],
			kind: "conflict",
			openingIds: ["door-1"],
			roomIds: ["room-1"],
			wallSegmentId: "wall-1",
		});
		expect(
			deleteGeneralWallWithConsequenceResolution(
				source,
				{
					itemIds: [],
					openingIds: ["door-1"],
					roomIds: ["room-1"],
					wallSegmentId: "wall-1",
				},
				"2026-08-22T20:11:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_DELETION_CONFLICT_STALE" });
		expect(
			deleteGeneralWallWithConsequenceResolution(
				source,
				{
					itemIds: ["item-1", "item-1"],
					openingIds: ["door-1"],
					roomIds: ["room-1"],
					wallSegmentId: "wall-1",
				},
				"2026-08-22T20:11:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "WALL_DELETION_CONFLICT_STALE" });
		expect(
			deleteGeneralWallWithConsequenceResolution(
				source,
				{
					itemIds: ["item-1"],
					openingIds: ["door-1"],
					roomIds: ["room-1"],
					wallSegmentId: "wall-1",
				},
				"2026-08-22T20:11:00.000Z",
			),
		).toEqual(
			expect.objectContaining({
				kind: "accepted",
				project: expect.objectContaining({
					assetInstances: [],
					level: expect.objectContaining({ openings: [] }),
				}),
			}),
		);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("still deletes a detached wall when an unrelated Opening keeps its valid host", () => {
		const source = projectWithDoor();
		const added = addGeneralWallToProject(
			source,
			{
				end: { xMm: 6500, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("free-start", "free-end", "free-wall"),
			"2026-08-15T10:00:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a detached wall fixture");
		}

		const deleted = deleteGeneralWallFromProject(
			added.project,
			{ wallSegmentId: "free-wall" },
			"2026-08-15T10:01:00.000Z",
		);
		expect(deleted).toEqual(expect.objectContaining({ kind: "accepted" }));
		if (deleted.kind !== "accepted") {
			return;
		}
		expect(deleted.project.level.openings).toEqual(source.level.openings);
	});
});
