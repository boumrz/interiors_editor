import { expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { applyInteriorCommand } from "../domain/interior-project";
import type { FloorSchematicAssetInstance, Project, SupportedSchematicAssetInstance } from "../domain/project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { supportOptions } from "./supported-item-controls";
import { availableSupportOptions, supportAddressAt, supportPlacementCommand } from "./supported-placement-targets";

function fixture() {
	const updatedAt = "2026-11-26T12:00:00.000Z";
	let id = 0;
	const initial = createInitialProject({ createdAt: updatedAt, levelId: "level", name: "Гостиная", projectId: "room" });
	const made = configureRectangularRoom(initial, { widthMm: "5500", depthMm: "4200", heightMm: "2700" },
		{ next: () => String(++id) }, updatedAt);
	if (made.kind !== "accepted") throw Error("Expected the room fixture");
	const roomId = made.project.level.rooms[0]?.roomId;
	if (!roomId) throw Error("Expected a derived room");
	const shelf: FloorSchematicAssetInstance = {
		anchorClass: "floor", assetInstanceId: "shelf", roomId, label: "Стеллаж", color: "#835a45",
		catalogPreset: { presetId: "open-shelf", version: 1 }, xMm: 1400, zMm: 1300, yawMilliDeg: 90000,
		widthMm: 800, depthMm: 350, heightMm: 1800,
	};
	const stand: FloorSchematicAssetInstance = {
		...shelf, assetInstanceId: "stand", label: "Тумбочка", catalogPreset: { presetId: "bedside-table", version: 1 },
		xMm: 3500, zMm: 2800, yawMilliDeg: 0, widthMm: 500, depthMm: 400, heightMm: 600,
	};
	const book = {
		label: "Книга", color: "#416b91", widthMm: 210, depthMm: 145, heightMm: 28,
		catalogPreset: { presetId: "book", version: 1 },
	} as const;
	return { project: { ...made.project, assetInstances: [shelf, stand] }, shelf, stand, book };
}

function available(project: Project, decor: Parameters<typeof supportPlacementCommand>[2]) {
	const draft = { mode: "catalog" } as const;
	return availableSupportOptions(supportOptions(project), 0, address => {
		const command = supportPlacementCommand(draft, address, decor);
		return Boolean(command && applyInteriorCommand(project, command, { next: () => "ghost" }, project.updatedAt).kind === "accepted");
	});
}

it("offers viable furniture surfaces for the current item, including shelf levels that fit", () => {
	const { project, book } = fixture();
	const locations = available(project, book);
	expect(locations.map(option => option.anchor.supportSurfaceKey)).toEqual(["shelf-1", "shelf-2", "shelf-3", "shelf-4", "shelf-5", "top"]);
	const bigLamp = { ...book, heightMm: 420, catalogPreset: { presetId: "table-lamp", version: 1 as const } };
	expect(available(project, bigLamp).map(option => option.anchor.supportSurfaceKey)).toEqual(["shelf-5", "top"]);
});

it("keeps a shelf with a free side selectable while excluding a fully occupied surface", () => {
	const { project, book, shelf, stand } = fixture();
	const occupied: SupportedSchematicAssetInstance = {
		...book, anchorClass: "support", assetInstanceId: "old-book", supportAssetInstanceId: shelf.assetInstanceId,
		supportSurfaceKey: "shelf-2", offsetXMm: 0, offsetZMm: 0, relativeYawMilliDeg: 0,
	};
	const lamp: SupportedSchematicAssetInstance = {
		...occupied, assetInstanceId: "big-lamp", supportAssetInstanceId: stand.assetInstanceId, supportSurfaceKey: "top",
		...book, label: "Лампа", widthMm: 480, depthMm: 380, heightMm: 240,
		catalogPreset: { presetId: "table-lamp", version: 1 },
	};
	const result = available({ ...project, supportedItems: [occupied, lamp] }, book);
	const secondShelf = result.find(option => option.surface.key === "shelf-2");
	expect(secondShelf?.anchor.offsetXMm).not.toBe(0);
	expect(secondShelf).toBeDefined();
	expect(result.some(option => option.surface.key === "top")).toBe(false);
});

it("converts an exact drawn contact to the selected shelf's local integer address", () => {
	const { project } = fixture();
	const option = supportOptions(project).find(candidate => candidate.surface.key === "shelf-2");
	if (!option) throw Error("Expected the second shelf");
	expect(supportAddressAt(option, 37500, { xMm: 1420.1, zMm: 1260.3 })).toEqual({
		supportAssetInstanceId: "shelf", supportSurfaceKey: "shelf-2", offsetXMm: 40, offsetZMm: 20, relativeYawMilliDeg: 37500,
	});
	expect(supportAddressAt(option, 0)).toMatchObject({ offsetXMm: 0, offsetZMm: 0 });
});

it("reuses durable IDs when moving and converts copy and rehome to their ordinary commands", () => {
	const floor = { roomId: "room-1", xMm: 2500, zMm: 1500, yawMilliDeg: 90000 };
	expect(supportPlacementCommand({ mode: "move", sourceId: "original" }, floor))
		.toEqual({ kind: "move-supported", assetInstanceId: "original", target: floor });
	expect(supportPlacementCommand({ mode: "rehome", sourceId: "original" }, floor))
		.toEqual({ kind: "move-supported", assetInstanceId: "original", target: floor });
	expect(supportPlacementCommand({ mode: "copy", sourceId: "original" }, floor))
		.toEqual({ kind: "copy-supported", assetInstanceId: "original", target: floor });
	expect(supportPlacementCommand({ mode: "catalog" }, floor)).toBeUndefined();
});

it("routes a selected catalog color and floor source through the same contact address", () => {
	const { project, book } = fixture();
	const option = supportOptions(project).find(candidate => candidate.surface.key === "shelf-2");
	if (!option) throw Error("Expected the second shelf");
	const address = supportAddressAt(option, 90000);
	expect(supportPlacementCommand({ mode: "attach", sourceId: "book-floor" }, address, { ...book, colorVariantId: "alpha-blue" }))
		.toEqual({ kind: "place-supported", sourceAssetInstanceId: "book-floor", item: { ...book, ...address, colorVariantId: "alpha-blue" } });
	expect(supportPlacementCommand({ mode: "catalog" }, address, {
		...book, catalogPreset: { presetId: "chair", version: 1 },
	})).toBeUndefined();
	expect(supportPlacementCommand({ mode: "catalog" }, address, { ...book, colorVariantId: "unavailable" }))
		.toEqual({ kind: "place-supported", item: { ...book, ...address } });
});

it("rounds both local axes after a turn and centers an asymmetric usable surface", () => {
	const { project } = fixture();
	const source = supportOptions(project).find(candidate => candidate.surface.key === "shelf-2");
	if (!source) throw Error("Expected the second shelf");
	const option = {
		host: { ...source.host, yawMilliDeg: 30000 },
		surface: { ...source.surface, minXMm: -140, maxXMm: 260, minZMm: -70, maxZMm: 150 },
	};
	expect(supportAddressAt(option, 0, { xMm: 1480, zMm: 1330 })).toMatchObject({ offsetXMm: 54, offsetZMm: 66 });
	expect(supportAddressAt(option, 0)).toMatchObject({ offsetXMm: 60, offsetZMm: 40 });
	for (const [offsetXMm, offsetZMm] of [[-40, 40], [160, 40], [-73, 40], [193, 40], [60, -15], [60, 95], [60, -33], [60, 113]]) {
		expect(availableSupportOptions([option], 0, address => address.offsetXMm === offsetXMm && address.offsetZMm === offsetZMm))
			.toMatchObject([{ anchor: { offsetXMm, offsetZMm } }]);
	}
});

it("does not create decor without a catalog identity, even on a valid floor or shelf", () => {
	const { project } = fixture();
	const option = supportOptions(project).find(candidate => candidate.surface.key === "shelf-2");
	if (!option) throw Error("Expected the second shelf");
	const draft = { mode: "catalog" } as const;
	expect(supportPlacementCommand(draft, { roomId: "room-1", xMm: 2100, zMm: 1100 })).toBeUndefined();
	expect(supportPlacementCommand(draft, supportAddressAt(option, 0))).toBeUndefined();
});


it("uses an ordinary floor instance when choosing floor during catalog placement", () => {
	const { project, book, stand } = fixture();
	const target = { roomId: stand.roomId, xMm: 2600, zMm: 2300, yawMilliDeg: 90001 };
	const draft = { mode: "catalog" } as const;
	const command = supportPlacementCommand(draft, target, book);
	if (!command) throw Error("Floor and shelf must share the same placement flow");
	const publishPreview = (input: typeof command) =>
		applyInteriorCommand(project, input, { next: () => "new-book" }, project.updatedAt);
	const result = publishPreview(command);
	if (result.kind !== "accepted") throw Error("Expected accepted floor contact");
	expect(result.project.assetInstances.at(-1)).toMatchObject({
		assetInstanceId: "new-book", anchorClass: "floor", catalogPreset: book.catalogPreset, ...target,
	});
	expect(result.project.supportedItems).toBeUndefined();
	expect(project.assetInstances).toHaveLength(2);
	const blocked = supportPlacementCommand(draft, { ...target, xMm: stand.xMm, zMm: stand.zMm }, book);
	if (!blocked) throw Error("Placement command should be checked against furniture");
	expect(publishPreview(blocked).kind).toBe("rejected");
});

it("keeps an existing decor identity when repositioned from floor to floor", () => {
	const { project, book, stand } = fixture();
	const source = {
		project: {
			...project, assetInstances: [...project.assetInstances, {
				...stand, ...book, assetInstanceId: "old-book", xMm: 2400, zMm: 1700,
			}],
		},
		target: { roomId: stand.roomId, xMm: 2700, zMm: 1700, yawMilliDeg: 90001 },
	};
	const command = supportPlacementCommand({ mode: "attach", sourceId: "old-book" }, source.target, book);
	if (!command) throw Error("Expected a floor move");
	const result = applyInteriorCommand(source.project, command, { next: () => "unneeded-id" }, project.updatedAt);
	if (result.kind !== "accepted") throw Error("Expected an accepted move");
	expect(result.project.assetInstances).toHaveLength(3);
	expect(result.project.assetInstances.find(item => item.assetInstanceId === "old-book")).toMatchObject({ ...book, ...source.target });
});


it("stores submillimetre negative rounding and a straight floor pose canonically", () => {
	const { project, book, stand } = fixture();
	const top = supportOptions(project).find(option => option.host.assetInstanceId === stand.assetInstanceId);
	if (!top) throw Error("Expected the top surface");
	const address = supportAddressAt(top, 0, { xMm: stand.xMm - 0.01, zMm: stand.zMm - 0.01 });
	expect(Object.is(address.offsetXMm, 0)).toBe(true);
	expect(Object.is(address.offsetZMm, 0)).toBe(true);
	const floor = supportPlacementCommand({ mode: "catalog" }, { roomId: stand.roomId, xMm: 2600, zMm: 2300, yawMilliDeg: 0 }, book);
	if (!floor) throw Error("Expected floor placement");
	const result = applyInteriorCommand(project, floor, { next: () => "straight" }, project.updatedAt);
	if (result.kind !== "accepted") throw Error("Expected a straight floor pose");
	const item = result.project.assetInstances.at(-1);
	expect(item).toMatchObject({ assetInstanceId: "straight", yawStep: 0 });
	expect(item).not.toHaveProperty("yawMilliDeg");
});
