import { expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { applyInteriorCommand, type InteriorCommand } from "../domain/interior-project";
import type { FloorSchematicAssetInstance, Project } from "../domain/project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { createSupportedDrag, planSupportDrop, supportDragLevels } from "./supported-drag";

function fixture() {
	const updatedAt = "2026-11-26T12:00:00.000Z";
	let id = 0;
	const initial = createInitialProject({ createdAt: updatedAt, levelId: "level", name: "Гостиная", projectId: "room" });
	const room = configureRectangularRoom(initial, { widthMm: "5500", depthMm: "4200", heightMm: "2700" }, { next: () => String(++id) }, updatedAt);
	if (room.kind !== "accepted" || !room.project.level.rooms[0]) throw Error("Expected the room fixture");
	const table: FloorSchematicAssetInstance = {
		anchorClass: "floor", assetInstanceId: "table", roomId: room.project.level.rooms[0].roomId,
		label: "Стол", color: "#835a45", catalogPreset: { presetId: "table", version: 1 },
		xMm: 1400, zMm: 1300, yawStep: 2, widthMm: 1000, depthMm: 600, heightMm: 740,
	};
	const book: FloorSchematicAssetInstance = {
		...table, assetInstanceId: "book", label: "Книга", color: "#416b91", catalogPreset: { presetId: "book", version: 1 },
		xMm: 2400, zMm: 1700, yawStep: 1, widthMm: 210, depthMm: 145, heightMm: 28,
	};
	const shelf: FloorSchematicAssetInstance = {
		...table, assetInstanceId: "shelf", label: "Стеллаж", catalogPreset: { presetId: "open-shelf", version: 1 },
		xMm: 3500, zMm: 1700, yawStep: 0, widthMm: 800, depthMm: 350, heightMm: 1800,
	};
	return { project: { ...room.project, assetInstances: [table, book, shelf] }, table, book, shelf };
}

function apply(project: Project, command: InteriorCommand) {
	return applyInteriorCommand(project, command, { next: () => "unexpected-copy" }, project.updatedAt);
}

function drag(project: Project) {
	return createSupportedDrag(project, command => apply(project, command).kind === "accepted", async () => true, () => undefined);
}

it("attaches the existing floor item at the drop point and keeps its identity, appearance, and world angle", () => {
	const { project, table, book } = fixture();
	const interaction = drag(project);
	const source = interaction.source(book.assetInstanceId);
	if (!source) throw Error("Expected draggable floor decor");
	const drop = planSupportDrop(interaction, source, table, table);
	if (drop?.kind !== "place") throw Error("Expected a single available tabletop");
	const result = apply(project, drop.destination.command);
	if (result.kind !== "accepted") throw Error("Expected the drag to commit");
	expect(result.project.assetInstances.some(item => item.assetInstanceId === "book")).toBe(false);
	expect(result.project.supportedItems).toEqual([{
		assetInstanceId: "book", anchorClass: "support", supportAssetInstanceId: "table", supportSurfaceKey: "top",
		offsetXMm: 0, offsetZMm: 0, relativeYawMilliDeg: 315000,
		label: book.label, color: book.color, catalogPreset: book.catalogPreset,
		widthMm: book.widthMm, depthMm: book.depthMm, heightMm: book.heightMm,
	}]);
});

it("keeps a book's current shelf when dragging on the same plan footprint and asks for a level at an ambiguous new host", () => {
	const { project, shelf, table, book } = fixture();
	const initial = drag(project);
	const initialSource = initial.source(book.assetInstanceId);
	if (!initialSource) throw Error("Expected draggable floor decor");
	expect(planSupportDrop(initial, initialSource, shelf, shelf)).toMatchObject({ kind: "choose-level", hostId: "shelf" });
	const selectedShelf = initial.options.find(option => option.surface.key === "shelf-3");
	const mount = selectedShelf && initial.onSurface(initialSource, selectedShelf, shelf);
	if (!mount) throw Error("Expected a mountable shelf");
	expect(supportDragLevels(initial, book.assetInstanceId, shelf.assetInstanceId, shelf).map(({ anchor }) => anchor))
		.toContainEqual(mount.address);
	const mounted = apply(project, mount.command);
	if (mounted.kind !== "accepted") throw Error("Expected the shelf mount");
	const next = drag(mounted.project);
	const guest = next.source(book.assetInstanceId);
	if (!guest) throw Error("Expected draggable shelf decor");
	const adjusted = { ...shelf, xMm: shelf.xMm + 50 };
	const sameHost = planSupportDrop(next, guest, adjusted, adjusted);
	expect(sameHost).toMatchObject({ kind: "place", destination: { command: { target: { supportSurfaceKey: "shelf-3", offsetXMm: 50 } } } });
	const newHost = planSupportDrop(next, guest, table, table);
	expect(newHost).toMatchObject({ kind: "place", destination: { command: { kind: "move-supported", target: { supportAssetInstanceId: "table" } } } });
	expect(next.onFloor(guest, book)?.command).toMatchObject({ kind: "move-supported", target: { roomId: book.roomId, yawMilliDeg: 45000 } });
});

it("excludes locked decor and rejects an occupied drop without changing its original binding", () => {
	const { project, table, book } = fixture();
	const occupied: Project = { ...project, supportedItems: [{
		assetInstanceId: "occupied", anchorClass: "support", supportAssetInstanceId: "table", supportSurfaceKey: "top",
		offsetXMm: 0, offsetZMm: 0, relativeYawMilliDeg: 0,
		label: "Книга", color: book.color, catalogPreset: { presetId: "book", version: 1 },
		widthMm: book.widthMm, depthMm: book.depthMm, heightMm: book.heightMm,
	}] };
	const interaction = drag(occupied);
	const source = interaction.source(book.assetInstanceId);
	if (!source) throw Error("Expected draggable floor decor");
	expect(planSupportDrop(interaction, source, table, table)).toBeUndefined();
	expect(supportDragLevels(interaction, book.assetInstanceId, table.assetInstanceId, table)).toEqual([]);
	expect(occupied.assetInstances).toContain(book);
	expect(drag({ ...project, assetInstances: [table, { ...book, locked: true }] }).source(book.assetInstanceId)).toBeUndefined();
});
