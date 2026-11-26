import { expect, it } from "@rstest/core";
import { applyInteriorCommand, projectInteriorView } from "./interior-project";
import { createInitialProject } from "./initial-project";
import { floorItemSupportConflict, resolveSupportedPlacements, supportSurfacesFor, validateSupportedItems } from "./interior-support";
import type { FloorSchematicAssetInstance, Project, SupportedSchematicAssetInstance } from "./project";
import { configureRectangularRoom } from "./rectangular-room";

function fixture() {
	const time = "2026-11-26T12:00:00.000Z";
	let n = 0;
	const room = configureRectangularRoom(createInitialProject({
		createdAt: time, levelId: "level", name: "Гостиная", projectId: "test-project",
	}), { widthMm: "5600", depthMm: "4400", heightMm: "2700" }, { next: () => `id-${++n}` }, time);
	if (room.kind !== "accepted") throw Error("mixed fixture");
	const roomId = room.project.level.rooms[0]?.roomId;
	if (!roomId) throw Error("room id");
	const host: FloorSchematicAssetInstance = {
		assetInstanceId: "nightstand", anchorClass: "floor", roomId,
		label: "Тумбочка", color: "#835a45", catalogPreset: { presetId: "bedside-table", version: 1 },
		widthMm: 500, depthMm: 400, heightMm: 600, xMm: 4200, zMm: 3750, yawMilliDeg: 180000,
	};
	const pot: SupportedSchematicAssetInstance = {
		assetInstanceId: "pot", anchorClass: "support", supportAssetInstanceId: "nightstand",
		catalogPreset: { presetId: "planter", version: 1 }, supportSurfaceKey: "top",
		label: "Кашпо", color: "#536d62", offsetXMm: 40, offsetZMm: 0, relativeYawMilliDeg: 0,
		widthMm: 350, depthMm: 350, heightMm: 450,
	};
	const project: Project = { ...room.project, assetInstances: [host], supportedItems: [pot] };
	return { project, host, pot };
}

it("resolves the planter height and rotates its local offset with the nightstand", () => {
	const { project, host } = fixture();
	expect(validateSupportedItems(project)).toBe(true);
	expect(resolveSupportedPlacements(project)[0]).toMatchObject({ xMm: 4160, zMm: 3750, bottomMm: 600, topMm: 1050, yawMilliDeg: 180000 });
	const updated = { ...project, assetInstances: [{ ...host, yawMilliDeg: 270000, heightMm: 700 }] };
	expect(resolveSupportedPlacements(updated)[0]).toMatchObject({ xMm: 4200, zMm: 3790, bottomMm: 700, topMm: 1150, yawMilliDeg: 270000 });
});

it("rejects duplicate IDs, an unsupported chair or user GLB, impossible placement, and an unknown shelf", () => {
	const { project, host, pot } = fixture();
	expect(validateSupportedItems({ ...project, supportedItems: [pot, pot] })).toBe(false);
	expect(validateSupportedItems({ ...project, assetInstances: [{ ...host, catalogPreset: { presetId: "chair", version: 1 } }] })).toBe(false);
	expect(validateSupportedItems({ ...project, assetInstances: [{ ...host, assetDefinitionId: "custom" }] })).toBe(false);
	expect(validateSupportedItems({ ...project, supportedItems: [{ ...pot, offsetXMm: 230 }] })).toBe(false);
	expect(validateSupportedItems({ ...project, supportedItems: [{ ...pot, supportSurfaceKey: "shelf-99" }] })).toBe(false);
});

it("gives separate vertical volumes to books with coincident footprints on the shelf", () => {
	const { project, host, pot } = fixture();
	const shelf = { ...host, heightMm: 1800, widthMm: 800, depthMm: 350, catalogPreset: { presetId: "open-shelf", version: 1 as const } };
	const book = {
		...pot, offsetXMm: 0, catalogPreset: { presetId: "book", version: 1 as const },
		widthMm: 210, heightMm: 28, depthMm: 145, supportSurfaceKey: "shelf-2",
	};
	const books = [book, { ...book, assetInstanceId: "other-book", supportSurfaceKey: "shelf-3" }];
	expect(supportSurfacesFor(shelf).map(surface => surface.heightMm)).toEqual([221, 598, 974, 1350, 1800]);
	expect(validateSupportedItems({ ...project, assetInstances: [shelf], supportedItems: books })).toBe(true);
	expect(validateSupportedItems({ ...project, assetInstances: [shelf], supportedItems: [book, { ...books[1]!, supportSurfaceKey: "shelf-2" }] })).toBe(false);
	expect(validateSupportedItems({ ...project, assetInstances: [shelf], supportedItems: [{ ...book, heightMm: 360 }] })).toBe(false);
});

it("keeps a cabinet and its guest together in both independent layouts", () => {
	const { project } = fixture();
	const ids = ["layout-a", "layout-b", "cabinet-b", "pot-b"][Symbol.iterator]();
	const result = applyInteriorCommand(project, { kind: "room-layout", command: { kind: "create-second", roomId: project.level.rooms[0]!.roomId } },
		{ next: () => ids.next().value ?? "" }, project.updatedAt);
	if (result.kind !== "accepted") throw Error("Expected two complete layouts");
	expect(result.project.assetInstances).toHaveLength(2);
	expect(result.project.supportedItems).toHaveLength(2);
	expect(resolveSupportedPlacements(result.project).map(guest => [guest.item.assetInstanceId, guest.item.supportAssetInstanceId, guest.roomLayoutId]))
		.toEqual([["pot", "nightstand", "layout-a"], ["pot-b", "cabinet-b", "layout-b"]]);
	expect(projectInteriorView(result.project, new Map([[project.level.rooms[0]!.roomId, "layout-b"]])).supportedItems?.[0]?.assetInstanceId)
		.toBe("pot-b");
});

it("rejects an invalid chair destination without replacing the original support", () => {
	const { project, host, pot } = fixture();
	const chair = { ...host, xMm: 3200, zMm: 2700, assetInstanceId: "chair", catalogPreset: { presetId: "chair", version: 1 as const } };
	const source = { ...project, assetInstances: [host, chair] };
	const snapshot = JSON.stringify(source);
	const outcome = applyInteriorCommand(source, {
		kind: "move-supported", assetInstanceId: pot.assetInstanceId,
		target: { supportAssetInstanceId: chair.assetInstanceId, supportSurfaceKey: "top", offsetXMm: 0, offsetZMm: 0, relativeYawMilliDeg: 0 },
	}, { next: () => "unused-id" }, project.updatedAt);
	expect(outcome).toMatchObject({ kind: "rejected", conflictAssetInstanceId: pot.assetInstanceId });
	expect(JSON.stringify(source)).toBe(snapshot);
});

it("requires all exact destinations to delete a host and rehome its guests in one candidate", () => {
	const { project, host, pot } = fixture();
	const roomId = project.level.rooms[0]!.roomId;
	const partial = applyInteriorCommand(project, { kind: "delete-furniture", assetInstanceId: host.assetInstanceId, rehome: {} },
		{ next: () => "unused-id" }, project.updatedAt);
	expect(partial).toMatchObject({ kind: "rejected", reasonCode: "INTERIOR_REHOME_REQUIRED", conflictAssetInstanceId: pot.assetInstanceId });
	expect(project.assetInstances).toEqual([host]);
	expect(project.supportedItems).toEqual([pot]);
	const complete = applyInteriorCommand(project, { kind: "delete-furniture", assetInstanceId: host.assetInstanceId,
		rehome: { [pot.assetInstanceId]: { roomId, xMm: 3400, zMm: 2400, yawMilliDeg: 37500 } } },
		{ next: () => "unused-id" }, project.updatedAt);
	if (complete.kind !== "accepted") throw Error("Expected atomic rehome");
	expect(complete.project.supportedItems).toBeUndefined();
	expect(complete.project.assetInstances).toMatchObject([{ assetInstanceId: pot.assetInstanceId, yawMilliDeg: 37500, color: pot.color, anchorClass: "floor" }]);
});

it("leaves the opposite wall finish untouched and removes the empty intervention when reset", () => {
	const { project } = fixture();
	const base = { ...project, supportedItems: undefined, assetInstances: [] };
	const roomId = base.level.rooms[0]!.roomId;
	const wallSegmentId = base.level.wallSegments[0]!.wallSegmentId;
	const command = (from: Project, value: Parameters<typeof applyInteriorCommand>[1]) => {
		const result = applyInteriorCommand(from, value, { next: () => "unused-id" }, project.updatedAt);
		if (result.kind !== "accepted") throw Error("Expected changed finish");
		return result.project;
	};
	const floor = command(base, { kind: "set-floor-finish", roomId, finish: { presetId: "light-oak", version: 1 } });
	const left = command(floor, { kind: "set-wall-finish", wallSegmentId, side: "left", finish: { presetId: "muted-green-paint", version: 1 } });
	const both = command(left, { kind: "set-wall-finish", wallSegmentId, side: "right", finish: { presetId: "neutral-wall-tile", version: 1 } });
	expect(both.level.wallSegments[0]?.sideFinishes).toEqual({
		left: { presetId: "muted-green-paint", version: 1 }, right: { presetId: "neutral-wall-tile", version: 1 },
	});
	const right = command(both, { kind: "set-wall-finish", wallSegmentId, side: "left" });
	expect(right.level.wallSegments[0]?.sideFinishes?.right?.presetId).toBe("neutral-wall-tile");
	const resetSides = command(right, { kind: "set-wall-finish", wallSegmentId, side: "right" });
	const reset = command(resetSides, { kind: "set-floor-finish", roomId });
	expect(reset.level.wallSegments[0]?.sideFinishes).toBeUndefined();
	expect(reset.interiorSchemaVersion).toBeUndefined();
});

it("copies a furnished support with new addresses and an independent pose", () => {
	const { project, host, pot } = fixture();
	const keys = ["second-nightstand", "second-pot"][Symbol.iterator]();
	const result = applyInteriorCommand(project, {
		kind: "copy-furniture", assetInstanceId: host.assetInstanceId,
		target: { roomId: host.roomId, xMm: 1400, zMm: 2000, yawMilliDeg: 90000 },
	}, { next: () => keys.next().value ?? "" }, project.updatedAt);
	if (result.kind !== "accepted") throw Error("Expected a copy with decor");
	expect(result.project.assetInstances[1]).toMatchObject({
		assetInstanceId: "second-nightstand", catalogPreset: host.catalogPreset, yawMilliDeg: 90000,
	});
	expect(result.project.supportedItems).toEqual([
		pot, { ...pot, assetInstanceId: "second-pot", supportAssetInstanceId: "second-nightstand" },
	]);
	expect(resolveSupportedPlacements(result.project)[1]).toMatchObject({ xMm: 1400, zMm: 1960, bottomMm: 600, topMm: 1050 });
	const collision = applyInteriorCommand(project, {
		kind: "copy-furniture", assetInstanceId: host.assetInstanceId,
		target: { roomId: host.roomId, xMm: host.xMm, zMm: host.zMm },
	}, { next: () => "other" }, project.updatedAt);
	expect(collision).toMatchObject({ kind: "rejected", conflictAssetInstanceId: host.assetInstanceId });
});

it("puts floor decor and a copy of furnished furniture over a rug while rejecting another solid occupant", () => {
	const { project, host, pot } = fixture();
	const target = { roomId: host.roomId, xMm: 1400, zMm: 2000 };
	const rug: FloorSchematicAssetInstance = {
		...host, ...target, assetInstanceId: "rug", label: "Ковёр", widthMm: 1200, depthMm: 1100, heightMm: 15,
		catalogPreset: { presetId: "rug", version: 1 },
	};
	const source = { ...project, assetInstances: [host, rug] };
	const decor = applyInteriorCommand(source, { kind: "copy-supported", assetInstanceId: pot.assetInstanceId, target }, { next: () => "floor-pot" }, project.updatedAt);
	if (decor.kind !== "accepted") throw Error("Expected floor decor on the rug");
	expect(decor.project.assetInstances.at(-1)).toMatchObject({ ...target, assetInstanceId: "floor-pot", anchorClass: "floor" });
	const kind = "copy-furniture" as const;
	const keys = ["nightstand-copy", "pot-copy"][Symbol.iterator]();
	const copy = applyInteriorCommand(source, { kind, assetInstanceId: host.assetInstanceId, target }, { next: () => keys.next().value ?? "" }, project.updatedAt);
	if (copy.kind !== "accepted") throw Error("Expected the furnished copy on the rug");
	expect(copy.project.assetInstances.at(-1)).toMatchObject({ ...target, assetInstanceId: "nightstand-copy" });
	expect(copy.project.supportedItems?.at(-1)).toMatchObject({ assetInstanceId: "pot-copy", supportAssetInstanceId: "nightstand-copy" });
	expect(applyInteriorCommand(decor.project, { kind, assetInstanceId: host.assetInstanceId, target }, { next: () => "blocked-copy" }, project.updatedAt))
		.toMatchObject({ kind: "rejected", conflictAssetInstanceId: host.assetInstanceId });
});

it("keeps exact guest identity and dimensions when binding an old item or locking a raised item", () => {
	const { project, host, pot } = fixture();
	const { catalogPreset: _, ...legacy } = host;
	const draft = (source: Project, command: Parameters<typeof applyInteriorCommand>[1]) =>
		applyInteriorCommand(source, command, { next: () => "guest-copy" }, source.updatedAt);
	const bound = draft({ ...project, assetInstances: [legacy], supportedItems: undefined }, {
		kind: "bind-preset", assetInstanceId: legacy.assetInstanceId, presetId: "bedside-table",
	});
	if (bound.kind !== "accepted") throw Error("Expected an explicit binding");
	expect(bound.project.assetInstances).toEqual([host]);
	const locked = draft(project, { kind: "set-supported-lock", assetInstanceId: pot.assetInstanceId, locked: true });
	if (locked.kind !== "accepted") throw Error("Expected a locked guest");
	expect(locked.project.supportedItems).toEqual([{ ...pot, locked: true }]);
	expect(draft(locked.project, { kind: "delete-supported", assetInstanceId: pot.assetInstanceId })).toMatchObject({
		kind: "rejected", reasonCode: "INTERIOR_ITEM_LOCKED", conflictAssetInstanceId: pot.assetInstanceId,
	});
	const unlocked = draft(locked.project, { kind: "set-supported-lock", assetInstanceId: pot.assetInstanceId, locked: false });
	if (unlocked.kind !== "accepted") throw Error("Expected an unlocked guest");
	expect(unlocked.project.supportedItems).toEqual([pot]);
});

it("rejects contact with an occupied volume, an invalid rotation, and a lowered ceiling", () => {
	const { project, host, pot } = fixture();
	const obstruction = { ...host, assetInstanceId: "obstruction", xMm: 4160, heightMm: 601, widthMm: 70, depthMm: 70 };
	expect(validateSupportedItems({ ...project, assetInstances: [host, obstruction] })).toBe(false);
	expect(validateSupportedItems({ ...project, assetInstances: [host, { ...obstruction, heightMm: 600 }] })).toBe(true);
	for (const relativeYawMilliDeg of [-1, 360_000, 25.5]) {
		expect(validateSupportedItems({ ...project, supportedItems: [{ ...pot, relativeYawMilliDeg }] })).toBe(false);
	}
	const low = { ...project, level: { ...project.level, rooms: project.level.rooms.map(room => ({ ...room, heightMm: 1049 })) } };
	expect(validateSupportedItems(low)).toBe(false);
	expect(validateSupportedItems({ ...project, supportedItems: [{ ...pot, assetInstanceId: host.assetInstanceId }] })).toBe(false);
	expect(validateSupportedItems({ ...project, supportedItems: [{ ...pot, color: "#short" }] })).toBe(false);
	expect(validateSupportedItems({ ...project, supportedItems: [{ ...pot, widthMm: 0 }] })).toBe(false);
});

it("rejects a wall attachment or sliding track only when it reaches the raised guest", () => {
	const { project, host, pot } = fixture();
	const wall = project.level.wallSegments[0];
	if (!wall) throw Error("Expected the north wall");
	const halfThickness = wall.thicknessMm / 2;
	const furniture = { ...host, xMm: 2100, zMm: halfThickness + 280, yawMilliDeg: 0 };
	const item = { ...pot, offsetXMm: 0, offsetZMm: -80 };
	const source: Project = { ...project, assetInstances: [furniture], supportedItems: [item] };
	expect(validateSupportedItems(source)).toBe(true);

	const attachment = {
		anchorClass: "wall" as const, assetInstanceId: "attachment", wallSegmentId: wall.wallSegmentId,
		side: "left" as const, offsetMm: 2100, elevationMm: 800, widthMm: 300, depthMm: 80, heightMm: 300,
		label: "Светильник", color: "#5c6165",
	};
	expect(validateSupportedItems({ ...source, assetInstances: [furniture, attachment] })).toBe(false);
	expect(validateSupportedItems({ ...source, assetInstances: [furniture, { ...attachment, side: "right" as const }] })).toBe(true);
	expect(validateSupportedItems({ ...source, assetInstances: [furniture, { ...attachment, elevationMm: 450 }] })).toBe(true);

	const slider = {
		openingId: "slider", wallSegmentId: wall.wallSegmentId, kind: "Door" as const, variant: "sliding" as const,
		slideSide: "left" as const, slideDirection: "toward-end" as const, offsetMm: 1000,
		widthMm: 900, heightMm: 2050, sillMm: 0,
	};
	const withOpening = (opening: typeof slider | (Omit<typeof slider, "slideSide"> & { slideSide: "right" })) =>
		({ ...source, level: { ...source.level, openings: [opening] } });
	expect(validateSupportedItems(withOpening(slider))).toBe(false);
	expect(validateSupportedItems(withOpening({ ...slider, slideSide: "right" }))).toBe(true);
	expect(validateSupportedItems(withOpening({ ...slider, heightMm: 600 }))).toBe(true);
});

it("adjusts just the chosen raised item and refuses an invalid new size or colour", () => {
	const { project, host, pot } = fixture();
	const secondHost = { ...host, assetInstanceId: "second-stand", xMm: 2600, zMm: 3200 };
	const secondItem = { ...pot, assetInstanceId: "second-pot", supportAssetInstanceId: secondHost.assetInstanceId };
	const source = { ...project, assetInstances: [host, secondHost], supportedItems: [pot, secondItem] };
	const draft = (candidate: Project, command: Parameters<typeof applyInteriorCommand>[1]) =>
		applyInteriorCommand(candidate, command, { next: () => "allocated" }, candidate.updatedAt);
	const recolored = draft(source, { kind: "recolor-supported", assetInstanceId: pot.assetInstanceId, variantId: "alpha-blue" });
	if (recolored.kind !== "accepted") throw Error("Expected a selected color");
	expect(recolored.project.supportedItems).toEqual([{ ...pot, color: "#416b91", colorVariantId: "alpha-blue" }, secondItem]);
	expect(draft(source, { kind: "recolor-supported", assetInstanceId: pot.assetInstanceId, variantId: "unknown" as "alpha-blue" }).kind).toBe("rejected");
	const resized = draft(recolored.project, { kind: "resize-supported", assetInstanceId: pot.assetInstanceId, widthMm: 340, depthMm: 340, heightMm: 370 });
	if (resized.kind !== "accepted") throw Error("Expected a selected size");
	expect(resized.project.supportedItems).toEqual([
		{ ...pot, color: "#416b91", colorVariantId: "alpha-blue", widthMm: 340, depthMm: 340, heightMm: 370 }, secondItem,
	]);
	expect(draft(source, { kind: "resize-supported", assetInstanceId: pot.assetInstanceId, widthMm: 2200, depthMm: 340, heightMm: 370 }).kind).toBe("rejected");
	expect(draft(source, { kind: "delete-furniture", assetInstanceId: "absent" }).kind).toBe("rejected");
	expect(draft(source, { kind: "delete-furniture", assetInstanceId: host.assetInstanceId })).toMatchObject({
		kind: "accepted", project: { assetInstances: [secondHost], supportedItems: [secondItem] },
	});
	expect(draft({ ...source, supportedItems: [{ ...pot, locked: true }, secondItem] }, {
		kind: "delete-furniture", assetInstanceId: host.assetInstanceId,
	})).toMatchObject({ kind: "rejected", reasonCode: "INTERIOR_ITEM_LOCKED", conflictAssetInstanceId: pot.assetInstanceId });
});


it("identifies the locked decor only when its own support is being edited", () => {
	const { project, host, pot } = fixture();
	const source: Project = { ...project, supportedItems: [{ ...pot, locked: true }] };
	expect(floorItemSupportConflict(source, source, host.assetInstanceId)).toEqual({
		kind: "rejected", reasonCode: "ITEM_LOCKED", conflictAssetInstanceId: pot.assetInstanceId,
	});
	expect(floorItemSupportConflict(source, source, "another-host")).toBeUndefined();
	expect(floorItemSupportConflict(source, project, host.assetInstanceId)).toBeUndefined();
});
