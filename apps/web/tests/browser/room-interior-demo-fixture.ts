import type { ProjectController } from "../../src/app/project-controller";
import { resolveOrthogonalPlanFaces } from "../../src/domain/derived-orthogonal-plan-faces";
import { exactMeasurementToNumber } from "../../src/domain/exact-quadratic-surd";
import { resolveSupportedPlacements } from "../../src/domain/interior-support";

export const roomInteriorDemoName = "Гостиная с читальным уголком";

function savedProject(controller: ProjectController) {
	const state = controller.snapshot();
	if (state.kind !== "saved" || state.project.schemaVersion !== 1) {
		throw Error(`Expected a saved interior, got ${state.kind}`);
	}
	return state.project;
}

function requireDurable(label: string, result: { readonly kind: string; readonly reasonCode?: string }) {
	if (result.kind !== "durable") throw Error(`${label}: ${result.kind} ${result.reasonCode ?? ""}`);
}

export async function buildRoomInteriorDemo(controller: ProjectController) {
	if (!controller.roomInteriorEnabled()) throw Error("Room authoring capability unavailable");
	requireDurable("create", await controller.create(roomInteriorDemoName));
	const points = [{ xMm: 0, zMm: 0 }, { xMm: 5600, zMm: 0 }, { xMm: 5600, zMm: 4400 }, { xMm: 0, zMm: 4400 }] as const;
	for (const [index, start] of points.entries()) {
		const end = points[(index + 1) % points.length] ?? points[0];
		const bearing = index % 2 === 0;
		requireDurable(`wall ${index}`, await controller.addGeneralWall({
			start, end, thicknessMm: bearing ? 200 : 100, profile: bearing ? "bearing" : "partition",
		}));
	}
	const initial = savedProject(controller);
	const roomId = initial.level.rooms[0]?.roomId;
	if (!roomId) throw Error("The contour must yield a room");
	requireDurable("room height", await controller.updateRoomProperties({ roomId, type: "living-room", heightMm: 2700 }));
	const vertexById = new Map(initial.level.vertices.map(vertex => [vertex.vertexId, vertex]));
	const findSegment = (xMm: number, zMm: number) => {
		const segment = initial.level.wallSegments.find(wall => {
			const start = vertexById.get(wall.startVertexId);
			return start?.xMm === xMm && start.zMm === zMm;
		});
		if (!segment) throw Error(`No wall at ${xMm},${zMm}`);
		return segment.wallSegmentId;
	};
	const north = findSegment(0, 0);
	const east = findSegment(5600, 0);
	const south = findSegment(5600, 4400);
	const west = findSegment(0, 4400);

	requireDurable("oak", await controller.updateRoomFloorFinish({ roomId, finish: { presetId: "light-oak", version: 1 } }));
	for (const wallSegmentId of [north, east, south, west]) {
		requireDurable("wall finish", await controller.updateWallSideFinish({
			wallSegmentId, side: "left", finish: { presetId: wallSegmentId === south ? "muted-green-paint" : "warm-white-paint", version: 1 },
		}));
	}
	requireDurable("west door", await controller.addDoorOpening({
		wallSegmentId: west, offsetMm: 3100, widthMm: 900, heightMm: 2100, sillMm: 0,
		variant: "glazed-swing", swingSide: "left", hingeEnd: "end",
	}));
	requireDurable("north window", await controller.addWindowOpening({
		wallSegmentId: north, offsetMm: 2600, widthMm: 1600, heightMm: 1300, sillMm: 850, sections: 2,
	}));
	requireDurable("east window", await controller.addWindowOpening({
		wallSegmentId: east, offsetMm: 2000, widthMm: 900, heightMm: 1300, sillMm: 850, sections: 1,
	}));
	const floorItems = [
		["sofa", "Диван", 2600, 3700, 2200, 900, 850, 0, "#716796"],
		["coffee-table", "Журнальный столик", 2600, 2400, 900, 550, 450, 0, "#a76a3b"],
		["bedside-table", "Тумбочка", 4200, 3750, 500, 400, 600, 180000, "#8c6e4c"],
		["desk", "Письменный стол", 4250, 550, 1200, 600, 750, 0, "#8c6e4c"],
		["chair", "Стул", 4250, 1350, 500, 500, 900, 0, "#416b91"],
		["open-shelf", "Стеллаж", 1300, 350, 800, 350, 1800, 0, "#a76a3b"],
	] as const;
	for (const [presetId, label, xMm, zMm, widthMm, depthMm, heightMm, yawMilliDeg, color] of floorItems) {
		requireDurable(presetId, await controller.createParametricFloorItem({
			roomId, label, xMm, zMm, widthMm, depthMm, heightMm, yawMilliDeg, color,
			catalogPreset: { presetId, version: 1 },
		}));
	}
	const decor = [
		["planter", "Кашпо", "bedside-table", "top", 350, 350, 450, 40, 0, "#536d62"],
		["vase", "Ваза", "coffee-table", "top", 150, 150, 240, -66, 12, "#835a45"],
		["table-lamp", "Настольная лампа", "desk", "top", 220, 220, 360, 370, -115, "#8a4f54"],
		["book", "Книга", "open-shelf", "shelf-2", 210, 145, 28, -130, 35, "#416b91"],
	] as const;
	for (const [presetId, label, host, supportSurfaceKey, widthMm, depthMm, heightMm, offsetXMm, offsetZMm, color] of decor) {
		const supportAssetInstanceId = savedProject(controller).assetInstances.find(item =>
			item.anchorClass === "floor" && item.catalogPreset?.presetId === host)?.assetInstanceId;
		if (!supportAssetInstanceId) throw Error(`Missing host for ${presetId}`);
		requireDurable(presetId, await controller.applyInteriorCommand({
			kind: "place-supported",
			item: {
				supportAssetInstanceId, supportSurfaceKey, label, widthMm, depthMm, heightMm, color, offsetXMm, offsetZMm,
				relativeYawMilliDeg: presetId === "vase" ? 22000 : 0,
				catalogPreset: { presetId, version: 1 },
			},
		}));
	}
	const project = savedProject(controller);
	const observations = roomInteriorDemoObservations(project);
	if (observations.areaMm2 !== 23_100_000 || observations.guestNames.length !== 4) {
		throw Error(`Unexpected saved fixture: ${JSON.stringify(observations)}`);
	}
	const backup = await controller.exportProjectTransfer();
	if (backup.kind !== "ready") throw Error(`Export preparation: ${backup.kind} ${"reasonCode" in backup ? backup.reasonCode : ""}`);
	return observations;
}

export function roomInteriorDemoObservations(project: ReturnType<typeof savedProject>) {
	const resolved = resolveOrthogonalPlanFaces(project);
	const room = resolved.kind === "accepted" ? resolved.plan.rooms[0] : undefined;
	return {
		projectId: project.projectId,
		roomCount: project.level.rooms.length,
		areaMm2: room ? typeof room.usableFloorAreaMm2 === "number" ? room.usableFloorAreaMm2 : exactMeasurementToNumber(room.usableFloorAreaMm2) : undefined,
		axisThicknesses: project.level.wallSegments.map(wall => wall.thicknessMm),
		floorFinish: project.level.rooms[0]?.floorFinish?.presetId,
		openings: project.level.openings,
		floorCount: project.assetInstances.filter(item => item.anchorClass === "floor").length,
		guestNames: (project.supportedItems ?? []).map(item => item.label),
		world: resolveSupportedPlacements(project).map(guest => ({ id: guest.item.assetInstanceId, label: guest.item.label, xMm: guest.xMm, zMm: guest.zMm, bottomMm: guest.bottomMm, topMm: guest.topMm })),
	};
}

export async function checkRoomInteriorDemoEdits(controller: ProjectController) {
	const initial = savedProject(controller);
	const nightstand = initial.assetInstances.find(item => item.anchorClass === "floor" && item.catalogPreset?.presetId === "bedside-table");
	const chair = initial.assetInstances.find(item => item.anchorClass === "floor" && item.catalogPreset?.presetId === "chair");
	const guest = initial.supportedItems?.find(item => item.catalogPreset.presetId === "planter");
	const door = initial.level.openings.find(item => item.kind === "Door");
	const roomId = initial.level.rooms[0]?.roomId;
	if (!nightstand || !chair || !guest || !door || !roomId) throw Error("Expected editable imported room");
	requireDurable("nightstand 90 degree turn", await controller.rotateParametricFloorItem({
		assetInstanceId: nightstand.assetInstanceId, yawRadians: 3 * Math.PI / 2, exact: true,
	}));
	const turned = resolveSupportedPlacements(savedProject(controller)).find(position => position.item.assetInstanceId === guest.assetInstanceId);
	if (turned?.xMm !== 4200 || turned.zMm !== 3790 || turned.bottomMm !== 600) throw Error("Planter did not follow the quarter turn");

	const beforeReject = controller.currentRevisionIdentity();
	const reject = controller.previewInteriorCommand({
		kind: "move-supported", assetInstanceId: guest.assetInstanceId,
		target: { supportAssetInstanceId: chair.assetInstanceId, supportSurfaceKey: "top", offsetXMm: 0, offsetZMm: 0, relativeYawMilliDeg: 0 },
	});
	if (reject.kind !== "rejected" || JSON.stringify(controller.currentRevisionIdentity()) !== JSON.stringify(beforeReject)) {
		throw Error(`Chair preview: ${reject.kind} ${"reasonCode" in reject ? reject.reasonCode : ""}, revision before ${beforeReject?.revisionId}, after ${controller.currentRevisionIdentity()?.revisionId}`);
	}
	requireDurable("matte tiles", await controller.updateRoomFloorFinish({ roomId, finish: { presetId: "matte-floor-tile", version: 1 } }));
	requireDurable("wall side", await controller.updateWallSideFinish({
		wallSegmentId: door.wallSegmentId, side: "left", finish: { presetId: "neutral-wall-tile", version: 1 },
	}));
	requireDurable("southbound slider", await controller.updateDoorOpening({
		openingId: door.openingId, variant: "sliding", slideSide: "left", slideDirection: "toward-start",
	}));
	const amended = roomInteriorDemoObservations(savedProject(controller));
	return {
		turned: { xMm: turned.xMm, zMm: turned.zMm, bottomMm: turned.bottomMm },
		chair: reject.reasonCode, amended,
	};
}
