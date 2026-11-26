import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "./initial-project";
import type {
	CustomGlbAssetDefinition,
	FloorSchematicAssetInstance,
	WallSchematicAssetInstance,
} from "./project";
import {
	applyRoomLayoutCommand,
	projectRoomLayoutView,
	requiredRoomLayoutResourceHashes,
	type RoomLayoutProject,
	validateRoomLayouts,
} from "./room-layouts";

const createdAt = "2026-11-23T00:00:00Z";
const editedAt = "2026-11-23T10:00:00Z";

function ids(...values: readonly string[]) {
	const remaining = values[Symbol.iterator]();
	return { next: () => remaining.next().value ?? "" };
}

function definition(assetDefinitionId: string, resourceHash: string): CustomGlbAssetDefinition {
	return {
		assetDefinitionId,
		byteLength: 240,
		depthMm: 500,
		displayName: assetDefinitionId,
		format: "glb",
		heightMm: 800,
		resourceHash,
		widthMm: 500,
	};
}

const sharedHash = "a".repeat(64);
const hiddenHash = "b".repeat(64);
const floorItem: FloorSchematicAssetInstance = {
	anchorClass: "floor",
	assetDefinitionId: "chair",
	assetInstanceId: "chair-a",
	color: "#744b33",
	colorVariantId: "alpha-walnut",
	depthMm: 500,
	heightMm: 800,
	label: "Стул",
	locked: true,
	roomId: "bedroom",
	widthMm: 500,
	xMm: 1800,
	yawMilliDeg: 37500,
	zMm: 700,
};
const wallItem: WallSchematicAssetInstance = {
	anchorClass: "wall",
	assetDefinitionId: "mirror",
	assetInstanceId: "wall-mirror",
	color: "#eeeeee",
	depthMm: 30,
	elevationMm: 1000,
	heightMm: 400,
	label: "Зеркало",
	offsetMm: 900,
	side: "left",
	wallSegmentId: "wall-1",
	widthMm: 600,
};

function legacyProject(): RoomLayoutProject {
	const project = createInitialProject({
		createdAt,
		levelId: "level",
		name: "Квартира",
		projectId: "project",
	});
	return {
		...project,
		assetDefinitionRefs: [definition("chair", sharedHash), definition("mirror", sharedHash)],
		assetInstances: [floorItem, wallItem, { ...floorItem, assetInstanceId: "chair-hall", roomId: "hall" }],
		level: {
			...project.level,
			rooms: [
				{ faceFingerprint: "face-1", heightMm: 2600, roomId: "bedroom" },
				{ faceFingerprint: "face-2", heightMm: 2600, roomId: "hall" },
			],
		},
	};
}

function acceptedProject(result: ReturnType<typeof applyRoomLayoutCommand>) {
	if (result.kind !== "accepted") throw new Error(`Expected accepted room layout, got ${result.kind}`);
	return result.project;
}

function twoLayouts(project = legacyProject()) {
	return acceptedProject(applyRoomLayoutCommand(
		project,
		{ kind: "create-second", roomId: "bedroom" },
		ids("bed-a", "bed-b", "chair-b"),
		editedAt,
	));
}

function acceptedView(project: RoomLayoutProject, prefs = new Map<string, string>()) {
	const view = projectRoomLayoutView(project, prefs);
	if (view.kind !== "accepted") throw new Error("Expected a usable room layout view");
	return view;
}

describe("room layout state", () => {
	it("projects a pre-layout project as virtual A without changing project bytes or assets", () => {
		const project = legacyProject();
		const snapshot = JSON.stringify(project);
		const view = acceptedView(project, new Map([["bedroom", "stale-b"]]));
		expect(view.activeLayouts.get("bedroom")).toEqual({ name: "Вариант A", roomId: "bedroom", slot: "A" });
		expect(view.assetInstances).toEqual(project.assetInstances);
		expect(JSON.stringify(project)).toBe(snapshot);
	});

	it("creates one separate layout and clones exact floor data with fresh identities", () => {
		const source = legacyProject();
		const project = twoLayouts(source);
		expect(project.roomLayouts).toEqual([
			{ layoutId: "bed-a", name: "Вариант A", roomId: "bedroom", slot: "A" },
			{ layoutId: "bed-b", name: "Вариант B", roomId: "bedroom", slot: "B" },
		]);
		expect(project.assetInstances).toEqual([
			{ ...floorItem, roomLayoutId: "bed-a" },
			source.assetInstances[1],
			source.assetInstances[2],
			{ ...floorItem, assetInstanceId: "chair-b", roomLayoutId: "bed-b" },
		]);
		expect(project.level).toBe(source.level);
		expect(project.assetDefinitionRefs).toBe(source.assetDefinitionRefs);
		expect(project.updatedAt).toBe(editedAt);
		expect(source.assetInstances[0]).toBe(floorItem);
		expect(applyRoomLayoutCommand(project, { kind: "create-second", roomId: "bedroom" }, ids(), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_LIMIT" });
	});

	it("provides an empty second layout and rejects an allocated ID already used by the project", () => {
		const project = legacyProject();
		const empty = { ...project, assetInstances: [wallItem] };
		const result = acceptedProject(applyRoomLayoutCommand(
			empty, { kind: "create-second", roomId: "bedroom" }, ids("bed-a", "bed-b"), editedAt,
		));
		expect(result.roomLayouts).toHaveLength(2);
		expect(result.assetInstances).toEqual([wallItem]);
		expect(applyRoomLayoutCommand(project, { kind: "create-second", roomId: "bedroom" }, ids("bed-a", "bed-b", "chair-hall"), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_ID_CONFLICT" });
		expect(applyRoomLayoutCommand(project, { kind: "create-second", roomId: "bedroom" }, ids("bed-a", "bed-a"), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_ID_CONFLICT" });
		expect(applyRoomLayoutCommand(project, { kind: "create-second", roomId: "unknown" }, ids(), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_ROOM_NOT_FOUND" });
	});

	it("switches only the named room projection and includes the hidden layout resource in the durable union", () => {
		const data = twoLayouts();
		const project: RoomLayoutProject = {
			...data,
			assetDefinitionRefs: [...data.assetDefinitionRefs, definition("hidden-chair", hiddenHash)],
			assetInstances: data.assetInstances.map(item => item.assetInstanceId === "chair-b"
				? { ...item, assetDefinitionId: "hidden-chair", xMm: 2500 }
				: item),
		};
		expect(acceptedView(project).assetInstances.map(item => item.assetInstanceId))
			.toEqual(["chair-a", "wall-mirror", "chair-hall"]);
		const view = acceptedView(project, new Map([["bedroom", "bed-b"], ["hall", "bed-b"]]));
		expect(view.assetInstances.map(item => item.assetInstanceId))
			.toEqual(["wall-mirror", "chair-hall", "chair-b"]);
		expect(view.activeLayouts.get("hall")?.slot).toBe("A");
		expect(view.activeLayouts.get("bedroom")?.slot).toBe("B");
		expect(requiredRoomLayoutResourceHashes(project)).toEqual([sharedHash, hiddenHash]);
	});

	it("renames the virtual layout through explicit materialization and rejects blank names and foreign targets", () => {
		const source = legacyProject();
		expect(applyRoomLayoutCommand(source, { kind: "rename", name: " Вариант A ", roomId: "bedroom" }, ids(), editedAt))
			.toEqual({ kind: "unchanged", project: source });
		expect(applyRoomLayoutCommand(source, { kind: "rename", name: " \t ", roomId: "bedroom" }, ids(), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_NAME_INVALID" });
		const renamed = acceptedProject(applyRoomLayoutCommand(
			source, { kind: "rename", name: "  До ремонта  ", roomId: "bedroom" }, ids("bed-a"), editedAt,
		));
		expect(renamed.roomLayouts).toEqual([{ layoutId: "bed-a", name: "До ремонта", roomId: "bedroom", slot: "A" }]);
		expect(acceptedView(renamed).assetInstances[0]).toEqual({ ...floorItem, roomLayoutId: "bed-a" });
		expect(applyRoomLayoutCommand(renamed, { kind: "rename", layoutId: "bed-a", name: "New name", roomId: "hall" }, ids(), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_NOT_FOUND" });
		expect(applyRoomLayoutCommand(renamed, { kind: "rename", name: "New name", roomId: "bedroom" }, ids(), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_NOT_FOUND" });
	});

	it("renames an explicit B without reallocating IDs or touching A, geometry, or asset instances", () => {
		const project = twoLayouts();
		const result = acceptedProject(applyRoomLayoutCommand(
			project,
			{ kind: "rename", layoutId: "bed-b", name: " Для гостей ", roomId: "bedroom" },
			{ next: () => { throw new Error("Rename must not allocate"); } },
			editedAt,
		));
		expect(result.roomLayouts).toEqual([
			{ layoutId: "bed-a", name: "Вариант A", roomId: "bedroom", slot: "A" },
			{ layoutId: "bed-b", name: "Для гостей", roomId: "bedroom", slot: "B" },
		]);
		expect(result.assetInstances).toBe(project.assetInstances);
		expect(result.level).toBe(project.level);
		expect(applyRoomLayoutCommand(project, { kind: "delete", layoutId: "stale", roomId: "bedroom" }, ids(), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_NOT_FOUND" });
	});

	it("protects the last layout and creates the replacement in the vacant slot from the saved survivor", () => {
		const project = twoLayouts();
		const survivor = acceptedProject(applyRoomLayoutCommand(
			project, { kind: "delete", layoutId: "bed-a", roomId: "bedroom" }, ids(), editedAt,
		));
		const view = acceptedView(survivor, new Map([["bedroom", "bed-a"]]));
		expect(view.activeLayouts.get("bedroom")?.layoutId).toBe("bed-b");
		expect(view.assetInstances.map(item => item.assetInstanceId)).toEqual(["wall-mirror", "chair-hall", "chair-b"]);
		expect(survivor.assetDefinitionRefs).toBe(project.assetDefinitionRefs);
		expect(applyRoomLayoutCommand(survivor, { kind: "delete", layoutId: "bed-b", roomId: "bedroom" }, ids(), editedAt))
			.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_LAST" });
		const replacement = acceptedProject(applyRoomLayoutCommand(
			survivor, { kind: "create-second", roomId: "bedroom" }, ids("new-bed-a", "new-chair-a"), editedAt,
		));
		expect(replacement.roomLayouts).toEqual([
			{ layoutId: "bed-b", name: "Вариант B", roomId: "bedroom", slot: "B" },
			{ layoutId: "new-bed-a", name: "Вариант A", roomId: "bedroom", slot: "A" },
		]);
		expect(acceptedView(replacement).assetInstances.at(-1)).toEqual({ ...floorItem, assetInstanceId: "new-chair-a", roomLayoutId: "new-bed-a" });
	});

	it("rejects duplicate slots, cross-room and unassigned members, and wall membership", () => {
		const project = twoLayouts();
		const layouts = project.roomLayouts ?? [];
		const wallWithMembership = { ...wallItem, assetInstanceId: "bad", roomLayoutId: "bed-b" };
		const malformed: RoomLayoutProject[] = [
			{ ...project, roomLayouts: [...layouts, { layoutId: "extra-a", name: "Duplicate", roomId: "bedroom", slot: "A" }] },
			{ ...project, roomLayouts: [...layouts, { layoutId: "bed-b", name: "Duplicate ID", roomId: "hall", slot: "A" }] },
			{ ...project, roomLayouts: [...layouts, { layoutId: "extra", name: "No host", roomId: "missing", slot: "A" }] },
			{ ...project, roomLayouts: [...layouts, { layoutId: "extra", name: " Untrimmed ", roomId: "hall", slot: "A" }] },
			{ ...project, assetInstances: [...project.assetInstances, { ...floorItem, assetInstanceId: "bad", roomLayoutId: "bed-a", roomId: "hall" }] },
			{ ...project, assetInstances: [...project.assetInstances, { ...floorItem, assetInstanceId: "bad" }] },
			{ ...project, assetInstances: [...project.assetInstances, wallWithMembership] },
			{ ...project, assetInstances: [...project.assetInstances, { ...floorItem, roomLayoutId: "bed-b" }] },
			{ ...project, assetInstances: [...project.assetInstances, { ...floorItem, assetInstanceId: "bad", roomLayoutId: "missing" }] },
			{ ...project, assetInstances: [...project.assetInstances, { ...floorItem, assetDefinitionId: "missing", assetInstanceId: "bad", roomLayoutId: "bed-b" }] },
			{ ...project, assetDefinitionRefs: [...project.assetDefinitionRefs, { ...definition("extra", sharedHash), byteLength: 241 }] },
			{ ...project, assetDefinitionRefs: [...project.assetDefinitionRefs, definition("extra", "invalid-hash")] },
		];
		expect(validateRoomLayouts(project)).toEqual({ kind: "accepted" });
		for (const project of malformed) {
			expect(validateRoomLayouts(project)).toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_STATE_INVALID" });
			expect(projectRoomLayoutView(project, new Map())).toMatchObject({ kind: "rejected" });
			expect(applyRoomLayoutCommand(project, { kind: "create-second", roomId: "hall" }, ids(), editedAt))
				.toMatchObject({ kind: "rejected", reasonCode: "ROOM_LAYOUT_STATE_INVALID" });
		}
	});
});

it("rekeys furniture-supported decor with the new host when copying A to B", () => {
	const source = {
		...legacyProject(),
		supportedItems: [{
			anchorClass: "support" as const,
			assetInstanceId: "planter-a",
			label: "Кашпо",
			color: "#536d62",
			widthMm: 350,
			depthMm: 350,
			heightMm: 450,
			catalogPreset: { presetId: "planter", version: 1 as const },
			supportAssetInstanceId: "chair-a",
			supportSurfaceKey: "top",
			offsetXMm: 40,
			offsetZMm: 0,
			relativeYawMilliDeg: 0,
		}],
	};
	const result = applyRoomLayoutCommand(
		source,
		{ kind: "create-second", roomId: "bedroom" },
		ids("bed-a", "bed-b", "chair-b", "planter-b"),
		editedAt,
	);
	expect(result).toMatchObject({
		kind: "accepted",
		project: { supportedItems: [
			{ assetInstanceId: "planter-a", supportAssetInstanceId: "chair-a" },
			{ assetInstanceId: "planter-b", supportAssetInstanceId: "chair-b", offsetXMm: 40 },
		]},
	});
});
