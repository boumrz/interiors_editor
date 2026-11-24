import { describe, expect, it } from "@rstest/core";
import { addDoorOpeningToProject } from "../../domain/door-opening-project";
import { addGeneralWallToProject } from "../../domain/general-wall-project";
import { createInitialProject } from "../../domain/initial-project";
import {
	type ExteriorCutawayEdge,
	projectRectangularRoomForWebGl,
	type RectangularRoomWebGlScene,
	type SceneBox,
} from "./rectangular-room-projection";
import { wallCutawayForCamera } from "./webgl2-room-renderer-shared";

const baseBox = {
	centerYM: 1.25,
	heightM: 2.5,
};

function facade(
	wallSegmentId: string,
	centerXM: number,
	centerZM: number,
	widthM: number,
	depthM: number,
	vertexIds: readonly [string, string],
	exteriorNormal?: { readonly x: number; readonly z: number },
): SceneBox {
	return {
		...baseBox,
		centerXM,
		centerZM,
		depthM,
		wall: { exteriorNormal, vertexIds, wallSegmentId },
		widthM,
	};
}

const west = facade("west", 0, 2, 0.2, 4, ["sw", "nw"], { x: -1, z: 0 });
const north = facade("north", 3, 4, 6, 0.2, ["nw", "ne"], { x: 0, z: 1 });
const east = facade("east", 6, 2, 0.2, 4, ["ne", "se"], { x: 1, z: 0 });
const south = facade("south", 3, 0, 6, 0.2, ["se", "sw"], { x: 0, z: -1 });

function room(walls: readonly SceneBox[] = [west, north, east, south]): RectangularRoomWebGlScene {
	return {
		cameraBounds: { centerXM: 3, centerZM: 2, depthM: 4, widthM: 6 },
		dimensions: { depthMm: 4000, heightMm: 2500, widthMm: 6000 },
		floors: [],
		items: [],
		walls,
	};
}

function camera(degrees: number, panXM = 0, panZM = 0) {
	return { azimuthRadians: degrees * Math.PI / 180, distance: 1, elevationRadians: 0.6, panXM, panZM };
}

function hidden(state: ReturnType<typeof wallCutawayForCamera>) {
	return [...state.hiddenWallSegmentIds].sort();
}

function projectForSteps(divide = false) {
	const time = "2026-11-24T00:00:00Z";
	const project = createInitialProject({ createdAt: time, levelId: "level", name: "Steps", projectId: "steps" });
	let sequence = 0;
	const ids = { next: () => `id-${++sequence}` };
	const outline = [
		{ xMm: 0, zMm: 0 },
		{ xMm: 3500, zMm: 0 },
		{ xMm: 3500, zMm: 2700 },
		{ xMm: 4100, zMm: 2700 },
		{ xMm: 4100, zMm: 5700 },
		{ xMm: 0, zMm: 5700 },
		{ xMm: 0, zMm: 0 },
	].map(({ xMm, zMm }) => ({ xMm: xMm - 2000, zMm: zMm + 1000 }));
	const closedRoom = outline.reduce((current, end, index) => {
		const start = outline[index - 1];
		if (!start) return current;
		const added = addGeneralWallToProject(current, { start, end, thicknessMm: 100 }, ids, time);
		if (added.kind !== "accepted") throw new Error(`Invalid wall fixture: ${added.reasonCode}`);
		return added.project;
	}, project);
	const divided = divide ? addGeneralWallToProject(closedRoom, {
		start: { xMm: -2000, zMm: 3700 },
		end: { xMm: 1500, zMm: 3700 },
		thicknessMm: 100,
	}, ids, time) : undefined;
	if (divided?.kind === "rejected") throw new Error("Invalid partition fixture");
	const built = divided?.project ?? closedRoom;
	const vertices = new Map(built.level.vertices.map(vertex => [vertex.vertexId, vertex]));
	const wallId = (xMm: number, zMm: number) => {
		const wall = built.level.wallSegments.find(({ endVertexId, startVertexId }) => {
			const start = vertices.get(startVertexId);
			const end = vertices.get(endVertexId);
			return start?.xMm === xMm - 2000 && end?.xMm === xMm - 2000
				&& Math.min(start.zMm, end.zMm) === zMm + 1000;
		});
		if (!wall) throw new Error("Expected an actual stepped east wall");
		return wall.wallSegmentId;
	};
	const shallowEast = wallId(3500, 0);
	const deepEast = wallId(4100, 2700);
	const withDoor = addDoorOpeningToProject(built, {
		heightMm: 2100,
		offsetMm: 1400,
		sillMm: 0,
		wallSegmentId: shallowEast,
		widthMm: 900,
	}, ids, time);
	if (withDoor.kind !== "accepted") throw new Error("Invalid stepped door fixture");
	const scene = projectRectangularRoomForWebGl(withDoor.project, undefined, true);
	if (!scene) throw new Error("Step fixture did not produce a 3D scene");
	return { deepEast, scene, shallowEast };
}

function contourEdge(
	wallSegmentId: string,
	start: ExteriorCutawayEdge["start"],
	end: ExteriorCutawayEdge["end"],
	normal: ExteriorCutawayEdge["normal"],
): ExteriorCutawayEdge {
	return { start, end, normal, wallSegmentId };
}

const rectangularContour = [
	contourEdge("west", { xM: 0, zM: 0 }, { xM: 0, zM: 4 }, { x: -1, z: 0 }),
	contourEdge("north", { xM: 0, zM: 4 }, { xM: 6, zM: 4 }, { x: 0, z: 1 }),
	contourEdge("east", { xM: 6, zM: 4 }, { xM: 6, zM: 0 }, { x: 1, z: 0 }),
	contourEdge("south", { xM: 6, zM: 0 }, { xM: 0, zM: 0 }, { x: 0, z: -1 }),
];

describe("Telegram 3D facade visibility", () => {
	it("opens both exposed east walls of the reported stepped plan and tells the renderers to hide its door", () => {
		const { deepEast, scene, shallowEast } = projectForSteps();
		const auto = wallCutawayForCamera(scene, camera(0), "auto-sector");
		expect(hidden(auto)).toEqual([deepEast, shallowEast].sort());
		expect(scene.openingParts?.find(part => part.role === "leaf")?.wallSegmentId).toBe(shallowEast);
		expect(hidden(wallCutawayForCamera(scene, camera(45), "auto-sector"))).toEqual(
			expect.arrayContaining([deepEast, shallowEast]),
		);
		expect(hidden(wallCutawayForCamera(scene, camera(180), "auto-sector"))).not.toContain(shallowEast);
		expect(hidden(wallCutawayForCamera(scene, camera(0), "show-all", auto))).toEqual([]);
		expect(hidden(wallCutawayForCamera(scene, camera(0), "auto"))).toEqual([deepEast]);
	});

	it("uses whole exterior centerlines in scene coordinates and leaves the partition visible", () => {
		const { deepEast, scene, shallowEast } = projectForSteps(true);
		const shallow = scene.exteriorCutawayEdges?.find(edge => edge.wallSegmentId === shallowEast);
		expect([shallow?.start, shallow?.end]).toEqual(expect.arrayContaining([
			{ xM: 3.5, zM: 0 },
			{ xM: 3.5, zM: 2.7 },
		]));
		const partition = scene.walls.find(wall => wall.wall && !wall.wall.exteriorNormal)?.wall;
		expect(partition?.wallSegmentId).toBeDefined();
		expect(scene.exteriorCutawayEdges?.some(edge => edge.wallSegmentId === partition?.wallSegmentId)).toBe(false);
		expect(hidden(wallCutawayForCamera(scene, camera(0), "auto-sector"))).toEqual([deepEast, shallowEast].sort());
	});

	it("keeps a farther exterior wall covered by the full front span and opens a partly exposed wing", () => {
		const facing = { x: 1, z: 0 };
		const edges = [
			contourEdge("front-upper", { xM: 6, zM: 2 }, { xM: 6, zM: 4 }, facing),
			contourEdge("covered", { xM: 4, zM: 4 }, { xM: 4, zM: 0 }, facing),
			contourEdge("back", { xM: 7, zM: 0 }, { xM: 7, zM: 5 }, { x: -1, z: 0 }),
			contourEdge("front-lower", { xM: 6, zM: 0 }, { xM: 6, zM: 2 }, facing),
			contourEdge("wing", { xM: 2, zM: 3 }, { xM: 2, zM: 5 }, facing),
			contourEdge("separate", { xM: 2, zM: 6 }, { xM: 2, zM: 7 }, facing),
		];
		const scene = { ...room(), exteriorCutawayEdges: edges };
		const state = wallCutawayForCamera(scene, camera(0), "auto-sector");
		expect(hidden(state)).toEqual(["front-lower", "front-upper", "separate", "wing"]);
		expect(wallCutawayForCamera(scene, camera(3), "auto-sector", state).hiddenWallSegmentIds)
			.toBe(state.hiddenWallSegmentIds);
		expect(hidden(wallCutawayForCamera({ ...scene, exteriorCutawayEdges: [...edges].reverse() }, camera(0), "auto-sector")))
			.toEqual(["front-lower", "front-upper", "separate", "wing"]);
		const mirror = ({ xM, zM }: ExteriorCutawayEdge["start"]) => ({ xM: 8 - xM, zM });
		const mirroredScene = {
			...scene,
			exteriorCutawayEdges: edges.map(edge => ({
				...edge,
				start: mirror(edge.start),
				end: mirror(edge.end),
				normal: { x: -edge.normal.x, z: edge.normal.z },
			})),
		};
		expect(hidden(wallCutawayForCamera(mirroredScene, camera(180), "auto-sector")))
			.toEqual(["front-lower", "front-upper", "separate", "wing"]);
	});

	it.each([
		{ nearDepths: [12, 8], farDepths: [3, 7], nearNormal: { x: 0, z: 1 }, farNormal: { x: 1, z: 0 } },
		{ nearDepths: [6, 10], farDepths: [5, 1], nearNormal: { x: 1, z: 0 }, farNormal: { x: 0, z: 1 } },
	] as const)("compares oblique walls within their overlapping span ($nearDepths)", ({
		nearDepths: [nearStart, nearEnd],
		farDepths: [farStart, farEnd],
		nearNormal,
		farNormal,
	}) => {
		// At 45° the walls share lateral span [2, 6]. The nearer wall
		// remains in front throughout that span, but their extensions cross.
		const point = (lateral: number, depth: number) => ({
			xM: (depth - lateral) / Math.SQRT2,
			zM: (depth + lateral) / Math.SQRT2,
		});
		const scene = {
			...room(),
			exteriorCutawayEdges: [
				contourEdge("near", point(2, nearStart), point(6, nearEnd), nearNormal),
				contourEdge("far", point(2, farStart), point(6, farEnd), farNormal),
			],
		};
		expect(hidden(wallCutawayForCamera(scene, camera(45), "auto-sector"))).toEqual(["near"]);
	});

	it("opens both front sides and the diagonal connecting them on a projected contour", () => {
		const scene = {
			...room(),
			exteriorCutawayEdges: [
				contourEdge("north", { xM: 0, zM: 4 }, { xM: 5, zM: 4 }, { x: 0, z: 1 }),
				contourEdge("chamfer", { xM: 5, zM: 4 }, { xM: 6, zM: 3 }, { x: 1, z: 1 }),
				contourEdge("east", { xM: 6, zM: 3 }, { xM: 6, zM: 0 }, { x: 1, z: 0 }),
				contourEdge("south", { xM: 6, zM: 0 }, { xM: 0, zM: 0 }, { x: 0, z: -1 }),
				contourEdge("west", { xM: 0, zM: 0 }, { xM: 0, zM: 4 }, { x: -1, z: 0 }),
			],
		};
		expect(hidden(wallCutawayForCamera(scene, camera(45), "auto-sector")))
			.toEqual(["chamfer", "east", "north"]);
		expect(hidden(wallCutawayForCamera(scene, camera(0), "auto-sector")))
			.toEqual(["chamfer", "east"]);
	});

	it("includes an exposed front edge with endpoints straddling the viewing axis", () => {
		const scene = {
			...room(),
			exteriorCutawayEdges: [contourEdge("front", { xM: 2, zM: 0 }, { xM: 2, zM: 4 }, { x: 1, z: 0 })],
		};
		expect(hidden(wallCutawayForCamera(scene, camera(45), "auto-sector"))).toEqual(["front"]);
	});

	it("opens the same four faces and four corners from both orbit directions", () => {
		const views = [
			[0, ["east"]],
			[45, ["east", "north"]],
			[90, ["north"]],
			[135, ["north", "west"]],
			[180, ["west"]],
			[225, ["south", "west"]],
			[270, ["south"]],
			[315, ["east", "south"]],
		] as const;
		const scene = { ...room(), exteriorCutawayEdges: rectangularContour };
		const directions: ReadonlyArray<(typeof views)[number]>[] = [views, [...views].reverse()];
		for (const sequence of directions) {
			sequence.reduce<ReturnType<typeof wallCutawayForCamera> | undefined>((previous, [angle, walls]) => {
				const state = wallCutawayForCamera(scene, camera(angle), "auto-sector", previous);
				expect(hidden(state)).toEqual(walls);
				return state;
			}, undefined);
		}
	});

	it("is deterministic on first entry at either side of zero and holds the last sector around a boundary", () => {
		const scene = room();
		expect(hidden(wallCutawayForCamera(scene, camera(22.5), "auto-sector"))).toEqual(["east", "north"]);
		expect(hidden(wallCutawayForCamera(scene, camera(-22.5), "auto-sector"))).toEqual(["east"]);

		const axial = wallCutawayForCamera(scene, camera(0), "auto-sector");
		const corner = wallCutawayForCamera(scene, camera(45), "auto-sector");
		for (const angle of [21, 22.5, 24]) {
			expect(hidden(wallCutawayForCamera(scene, camera(angle), "auto-sector", axial))).toEqual(["east"]);
			expect(hidden(wallCutawayForCamera(scene, camera(angle), "auto-sector", corner))).toEqual(["east", "north"]);
		}
		expect(hidden(wallCutawayForCamera(scene, camera(28), "auto-sector", axial))).toEqual(["east", "north"]);
		expect(hidden(wallCutawayForCamera(scene, camera(17), "auto-sector", corner))).toEqual(["east"]);
		expect(hidden(wallCutawayForCamera(scene, camera(25.49), "auto-sector", axial))).toEqual(["east"]);
		expect(hidden(wallCutawayForCamera(scene, camera(25.51), "auto-sector", axial))).toEqual(["east", "north"]);
	});

	it("hides all segments of the complete front facade and retains a setback wall and an internal partition", () => {
		const northWest = facade("north-west", 1.5, 4, 3, 0.2, ["nw", "mid"], { x: 0, z: 1 });
		const northEast = facade("north-east", 4.5, 4, 3, 0.2, ["mid", "ne"], { x: 0, z: 1 });
		const setback = facade("setback", 3, 3, 2, 0.2, ["notch1", "notch2"], { x: 0, z: 1 });
		const partition = facade("partition", 4, 2, 0.2, 4, ["divider1", "divider2"]);
		const scene = room([west, northWest, east, setback, northEast, south, partition]);
		expect(hidden(wallCutawayForCamera(scene, camera(45), "auto-sector"))).toEqual(["east", "north-east", "north-west"]);
		expect(hidden(wallCutawayForCamera(scene, camera(90), "auto-sector"))).toEqual(["north-east", "north-west"]);
	});

	it("only hides a reliable exterior front on a chamfered plan or separated walls", () => {
		const outerNorth = facade("north", 2.5, 4, 5, 0.2, ["nw", "chamfer-n"], { x: 0, z: 1 });
		const outerEast = facade("east", 6, 1.5, 0.2, 3, ["chamfer-e", "se"], { x: 1, z: 0 });
		const chamfer = facade("chamfer", 5.5, 3.5, Math.SQRT2, 0.2, ["chamfer-n", "chamfer-e"], { x: 1, z: 1 });
		expect(hidden(wallCutawayForCamera(room([west, outerNorth, outerEast, south, chamfer]), camera(45), "auto-sector"))).toEqual(["chamfer"]);
		expect(hidden(wallCutawayForCamera(room([chamfer, outerEast, outerNorth]), camera(45), "auto-sector"))).toEqual(["chamfer"]);
		expect(hidden(wallCutawayForCamera(room([outerNorth, outerEast]), camera(45), "auto-sector"))).toEqual(["east"]);
		expect(hidden(wallCutawayForCamera(room([outerEast, outerNorth]), camera(45), "auto-sector"))).toEqual(["east"]);
		expect(hidden(wallCutawayForCamera(room([west, south]), camera(45), "auto-sector"))).toEqual([]);
		expect(hidden(wallCutawayForCamera(room(), camera(0, -6 * Math.cos(0.6)), "auto-sector"))).toEqual([]);
	});

	it("preserves nearby parallel walls and does not mistake missing topology for adjacency", () => {
		const nearSetback = facade("near-setback", 3, 3.988, 2, 0.2, ["notch1", "notch2"], { x: 0, z: 1 });
		const unknownNeighbour: SceneBox = {
			...east,
			wall: { exteriorNormal: { x: 1, z: 0 }, wallSegmentId: "east" },
		};
		for (const walls of [[nearSetback, north], [north, nearSetback]]) {
			expect(hidden(wallCutawayForCamera(room(walls), camera(90), "auto-sector"))).toEqual(["north"]);
		}
		expect(hidden(wallCutawayForCamera(room([north, unknownNeighbour]), camera(45), "auto-sector"))).toEqual(["east"]);
		expect(hidden(wallCutawayForCamera(room([unknownNeighbour, north]), camera(45), "auto-sector"))).toEqual(["east"]);
	});

	it("selects the same single diagonal facade at an exact tie when source order is reversed", () => {
		const northEast = facade("north-east", 5.5, 3.5, 1, 0.2, ["ne-n", "ne-e"], { x: 1, z: 1 });
		const southEast = facade("south-east", 5.5, 0.5, 1, 0.2, ["se-s", "se-e"], { x: 1, z: -1 });
		for (const walls of [[northEast, southEast], [southEast, northEast]]) {
			expect(hidden(wallCutawayForCamera(room(walls), camera(0), "auto-sector"))).toEqual(["north-east"]);
		}
	});

	it("ranks a front axial facade ahead of an oblique facade in either input order", () => {
		const chamfer = facade("chamfer", 5.5, 3.5, 1, 0.2, ["ne-n", "ne-e"], { x: 1, z: 1 });
		for (const walls of [[east, chamfer], [chamfer, east]]) {
			expect(hidden(wallCutawayForCamera(room(walls), camera(0), "auto-sector"))).toEqual(["east"]);
		}
	});

	it("does not rank differently oriented facades by their distance from the coordinate origin", () => {
		const insetEast = facade("east", 3, 2, 0.2, 4, ["e1", "e2"], { x: 1, z: 0 });
		expect(hidden(wallCutawayForCamera(room([north, insetEast]), camera(45), "auto-sector"))).toEqual(["east"]);
	});

	it("restores all walls and reapplies the current panned camera without inheriting a hidden sector", () => {
		const scene = room();
		const previous = wallCutawayForCamera(scene, camera(0), "auto-sector");
		const view = camera(0, 0, 6 * Math.cos(0.6));
		const shown = wallCutawayForCamera(scene, view, "show-all", previous);
		expect(hidden(shown)).toEqual([]);
		expect(hidden(wallCutawayForCamera(scene, view, "auto-sector", shown))).toEqual(["east", "north"]);
		expect(hidden(wallCutawayForCamera(scene, view, "auto"))).toEqual(["east"]);
	});
});
