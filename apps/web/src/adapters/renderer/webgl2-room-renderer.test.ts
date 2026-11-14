import { describe, expect, it } from "@rstest/core";

import type { RectangularRoomWebGlScene } from "./rectangular-room-projection";
import { THREE_DIMENSIONAL_ROOM_SURFACE_COLORS } from "./three-dimensional-room-palette";
import {
	cameraEyeAndTargetFor,
	createWebGl2Program,
	drawWoodFloor,
	floorPrismVerticesFor,
	furnitureGreyboxPartsFor,
	hiddenWallSegmentIdsForCutaway,
	sceneBoxModelMatrix,
	resetProceduralWebGl2Frame,
	shouldUseThreeWebGl2RoomSceneRenderer,
	shouldUseDetailedFurniture,
	shouldUseDetailedWallFinish,
	type WebGl2Camera,
	type WebGl2CanvasPort,
	type WebGl2CutawayMode,
	type WebGl2RendererDiagnostic,
	type WebGl2RendererQualityTier,
	type WebGl2RendererState,
	type WebGl2RuntimeModels,
	WebGl2RoomRendererController,
	type WebGl2SceneRenderer,
	wallCornerOutlineDrawsFor,
	wallFinishDrawsFor,
	wallFinishPartsFor,
	wallJointOutlineDrawsFor,
	woodFloorDrawsFor,
} from "./webgl2-room-renderer";

const scene: RectangularRoomWebGlScene = {
	cameraBounds: { centerXM: 2.05, centerZM: 1.55, depthM: 3.1, widthM: 4.1 },
	dimensions: { depthMm: 3000, heightMm: 2600, widthMm: 4000 },
	floors: [
		{
			centerXM: 2.05,
			centerYM: 0,
			centerZM: 1.55,
			depthM: 3,
			heightM: 0.04,
			widthM: 4,
		},
	],
	items: [],
	walls: [],
};

function canvas(context: object | null): WebGl2CanvasPort & {
	contextLossPreventDefaultCalls(): number;
	emit(type: "webglcontextlost" | "webglcontextrestored"): void;
} {
	const listeners = new Map<
		string,
		(event: { preventDefault(): void }) => void
	>();
	let contextLossPreventDefaultCalls = 0;
	return {
		addEventListener: (type, listener) => listeners.set(type, listener),
		contextLossPreventDefaultCalls: () => contextLossPreventDefaultCalls,
		emit: (type) =>
			listeners.get(type)?.({
				preventDefault: () => {
					if (type === "webglcontextlost") {
						contextLossPreventDefaultCalls += 1;
					}
				},
			}),
		getContext: () => context as WebGL2RenderingContext | null,
		removeEventListener: (type) => listeners.delete(type),
	};
}

describe("WebGl2RoomRendererController", () => {
	it("turns an exact triangular floor polygon into a closed triangular prism without a rectangular envelope", () => {
		const vertices = floorPrismVerticesFor({
			floor: { roomId: "triangle-room" },
			heightM: 0.04,
			vertices: [
				{ xM: 0.1, zM: 0.1 },
				{ xM: 1.9, zM: 0.1 },
				{ xM: 1.9, zM: 1.8 },
			],
		});

		expect(vertices).toHaveLength(72);
		const top = Array.from(vertices.slice(0, 9));
		const bottom = Array.from(vertices.slice(9, 18));
		expect(top).toHaveLength(9);
		expect(bottom).toHaveLength(9);
		expect([top[1], top[4], top[7]]).toEqual([
			expect.closeTo(0.02, 6),
			expect.closeTo(0.02, 6),
			expect.closeTo(0.02, 6),
		]);
		expect([bottom[1], bottom[4], bottom[7]]).toEqual([
			expect.closeTo(-0.02, 6),
			expect.closeTo(-0.02, 6),
			expect.closeTo(-0.02, 6),
		]);
		const twiceTopArea = Math.abs(
			((top[3] ?? 0) - (top[0] ?? 0)) *
				((top[8] ?? 0) - (top[2] ?? 0)) -
				((top[5] ?? 0) - (top[2] ?? 0)) *
					((top[6] ?? 0) - (top[0] ?? 0)),
		);
		expect(twiceTopArea / 2).toBeCloseTo(1.53, 6);
	});

	it("triangulates a concave floor without filling or overlapping its open recess", () => {
		const vertices = floorPrismVerticesFor({
			floor: { roomId: "concave-room" },
			heightM: 0.04,
			vertices: [
				{ xM: 0, zM: 0 },
				{ xM: 4, zM: 0 },
				{ xM: 4, zM: 4 },
				{ xM: 3, zM: 4 },
				{ xM: 3, zM: 1 },
				{ xM: 1, zM: 1 },
				{ xM: 1, zM: 4 },
				{ xM: 0, zM: 4 },
			],
		});

		const prism = Array.from(vertices);
		let topAreaM2 = 0;
		for (let index = 0; index < 6 * 18; index += 18) {
			const ax = prism[index] ?? 0;
			const az = prism[index + 2] ?? 0;
			const bx = prism[index + 3] ?? 0;
			const bz = prism[index + 5] ?? 0;
			const cx = prism[index + 6] ?? 0;
			const cz = prism[index + 8] ?? 0;
			topAreaM2 += Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
		}

		expect(vertices).toHaveLength(252);
		expect(topAreaM2).toBeCloseTo(10, 8);
	});

	it("triangulates the same concave floor clockwise without filling its open recess", () => {
		const vertices = floorPrismVerticesFor({
			floor: { roomId: "clockwise-concave-room" },
			heightM: 0.04,
			vertices: [
				{ xM: 0, zM: 4 },
				{ xM: 1, zM: 4 },
				{ xM: 1, zM: 1 },
				{ xM: 3, zM: 1 },
				{ xM: 3, zM: 4 },
				{ xM: 4, zM: 4 },
				{ xM: 4, zM: 0 },
				{ xM: 0, zM: 0 },
			],
		});

		const prism = Array.from(vertices);
		let topAreaM2 = 0;
		for (let index = 0; index < 6 * 18; index += 18) {
			const ax = prism[index] ?? 0;
			const az = prism[index + 2] ?? 0;
			const bx = prism[index + 3] ?? 0;
			const bz = prism[index + 5] ?? 0;
			const cx = prism[index + 6] ?? 0;
			const cz = prism[index + 8] ?? 0;
			topAreaM2 += Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
		}

		expect(vertices).toHaveLength(252);
		expect(topAreaM2).toBeCloseTo(10, 8);
	});

	it("fails closed instead of producing a floor prism for a zero-area polygon", () => {
		expect(
			floorPrismVerticesFor({
				floor: { roomId: "zero-area-room" },
				heightM: 0.04,
				vertices: [
					{ xM: 0, zM: 0 },
					{ xM: 1, zM: 0 },
					{ xM: 2, zM: 0 },
				],
			}),
		).toHaveLength(0);
	});

	it("keeps the raw disposable renderer active when optional GLB runtime metadata becomes available", () => {
		const factoryScenes: RectangularRoomWebGlScene[] = [];
		const renderer: WebGl2SceneRenderer = {
			dispose: () => undefined,
			render: () => undefined,
		};
		const controller = new WebGl2RoomRendererController(
			canvas({}),
			(_context, renderedScene) => {
				factoryScenes.push(renderedScene);
				return renderer;
			},
		);
		const customScene: RectangularRoomWebGlScene = {
			...scene,
			customGlbModels: [{ assetDefinitionId: "model-1" }],
		};

		controller.start(scene);
		controller.render(
			{
				azimuthRadians: 0,
				distance: 1,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			},
			"auto",
			customScene,
		);

		expect(factoryScenes).toEqual([scene]);
		controller.dispose();
	});

	it("keeps the raw disposable renderer active when another optional GLB runtime metadata entry joins the scene", () => {
		const factoryScenes: RectangularRoomWebGlScene[] = [];
		let disposed = 0;
		const controller = new WebGl2RoomRendererController(
			canvas({}),
			(_context, renderedScene) => {
				factoryScenes.push(renderedScene);
				return {
					dispose: () => {
						disposed += 1;
					},
					render: () => undefined,
				};
			},
		);
		const chairScene: RectangularRoomWebGlScene = {
			...scene,
			customGlbModels: [{ assetDefinitionId: "chair" }],
			items: [
				{
					assetDefinitionId: "chair",
					assetInstanceId: "chair-1",
					centerXM: 1,
					centerYM: 0.5,
					centerZM: 1,
					depthM: 1,
					heightM: 1,
					widthM: 1,
				},
			],
		};
		const chairAndLampScene: RectangularRoomWebGlScene = {
			...chairScene,
			customGlbModels: [
				{ assetDefinitionId: "chair" },
				{ assetDefinitionId: "lamp" },
			],
			items: [
				...chairScene.items,
				{
					assetDefinitionId: "lamp",
					assetInstanceId: "lamp-1",
					centerXM: 3,
					centerYM: 0.5,
					centerZM: 1,
					depthM: 1,
					heightM: 1,
					widthM: 1,
				},
			],
		};

		controller.start(chairScene);
		controller.render(
			{
				azimuthRadians: 0,
				distance: 1,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			},
			"auto",
			chairAndLampScene,
		);

		expect(factoryScenes).toEqual([chairScene]);
		expect(disposed).toBe(0);
		controller.dispose();
	});

	it("hands a decoded local GLB root to the room renderer instead of keeping its item as a greybox", () => {
		const runtimeModels: WebGl2RuntimeModels = {
			chair: {
				root: {} as never,
				sourceDimensionsM: { depthM: 1, heightM: 1, widthM: 1 },
			},
		};
		const receivedRuntimeModels: WebGl2RuntimeModels[] = [];
		const controller = new WebGl2RoomRendererController(
			canvas({}),
			(_context, _scene, _qualityTier, decodedModels) => {
				receivedRuntimeModels.push(decodedModels);
				return { dispose: () => undefined, render: () => undefined };
			},
		);

		controller.start(
			{
				...scene,
				items: [
					{
						assetDefinitionId: "chair",
						assetInstanceId: "chair-1",
						centerXM: 1,
						centerYM: 0.5,
						centerZM: 1,
						depthM: 1,
						heightM: 1,
						widthM: 1,
					},
				],
			},
			"standard",
			"NONE",
			runtimeModels,
		);

		expect(receivedRuntimeModels).toEqual([runtimeModels]);
		controller.dispose();
	});

	it("replaces a decoded GLB inside the initialized room renderer without rebuilding the shell", () => {
		const chairRuntimeModels: WebGl2RuntimeModels = {
			chair: {
				root: {} as never,
				sourceDimensionsM: { depthM: 1, heightM: 1, widthM: 1 },
			},
		};
		const chairAndLampRuntimeModels: WebGl2RuntimeModels = {
			...chairRuntimeModels,
			lamp: {
				root: {} as never,
				sourceDimensionsM: { depthM: 1, heightM: 1, widthM: 1 },
			},
		};
		const runtimeUpdates: WebGl2RuntimeModels[] = [];
		const renders: {
			readonly camera: WebGl2Camera | undefined;
			readonly cutawayMode: WebGl2CutawayMode | undefined;
			readonly scene: RectangularRoomWebGlScene | undefined;
		}[] = [];
		let constructed = 0;
		let disposed = 0;
		const controller = new WebGl2RoomRendererController(
			canvas({}),
			() => {
				constructed += 1;
				return {
					dispose: () => {
						disposed += 1;
					},
					render: (camera, cutawayMode, renderedScene) => {
						renders.push({
							camera,
							cutawayMode,
							scene: renderedScene,
						});
					},
					updateRuntimeModels: (models) => runtimeUpdates.push(models),
				};
			},
		);
		const furnishedScene: RectangularRoomWebGlScene = {
			...scene,
			items: [
				{
					assetDefinitionId: "chair",
					assetInstanceId: "chair-1",
					centerXM: 1,
					centerYM: 0.5,
					centerZM: 1,
					depthM: 1,
					heightM: 1,
					widthM: 1,
				},
				{
					assetDefinitionId: "lamp",
					assetInstanceId: "lamp-1",
					centerXM: 3,
					centerYM: 0.5,
					centerZM: 1,
					depthM: 1,
					heightM: 1,
					widthM: 1,
				},
			],
		};

		controller.start(furnishedScene);
		const camera: WebGl2Camera = {
			azimuthRadians: 0.7,
			distance: 2.4,
			elevationRadians: 1.1,
			panXM: 0.2,
			panZM: -0.1,
		};
		controller.render(camera, "show-all", furnishedScene);
		controller.updateRuntimeModels(chairRuntimeModels);
		controller.updateRuntimeModels(chairAndLampRuntimeModels);

		expect(constructed).toBe(1);
		expect(disposed).toBe(0);
		expect(runtimeUpdates).toEqual([
			chairRuntimeModels,
			chairAndLampRuntimeModels,
		]);
		expect(renders.at(-1)).toEqual({
			camera,
			cutawayMode: "show-all",
			scene: furnishedScene,
		});
		controller.dispose();
	});

	it("keeps the same Three room pipeline from the empty scene through local GLB arrival", () => {
		const glbItemScene: RectangularRoomWebGlScene = {
			...scene,
			items: [
				{
					assetDefinitionId: "chair",
					assetInstanceId: "chair-1",
					centerXM: 1,
					centerYM: 0.5,
					centerZM: 1,
					depthM: 1,
					heightM: 1,
					widthM: 1,
				},
			],
		};

		expect(shouldUseThreeWebGl2RoomSceneRenderer(scene, {})).toBe(true);
		expect(shouldUseThreeWebGl2RoomSceneRenderer(glbItemScene, {})).toBe(true);
		expect(
			shouldUseThreeWebGl2RoomSceneRenderer(scene, {
				chair: {
					root: {} as never,
					sourceDimensionsM: { depthM: 1, heightM: 1, widthM: 1 },
				},
			}),
		).toBe(true);
	});

	it("replaces inherited framebuffer, clipping and write masks before clearing a raw fallback frame", () => {
		const enabled = new Set([2, 3, 4, 5, 6, 7]);
		let framebuffer: unknown = {};
		let vertexArray: unknown = {};
		let colorWritable = false;
		let depthWritable = false;
		let colorCleared = false;
		let depthCleared = false;
		let viewport: number[] = [];
		let depthRange: number[] = [];
		let clearDepth = 0;
		let depthFunction = 0;
		let background: number[] = [];
		const context = {
			FRAMEBUFFER: 1, SCISSOR_TEST: 2, BLEND: 3, CULL_FACE: 4, STENCIL_TEST: 5, POLYGON_OFFSET_FILL: 6, RASTERIZER_DISCARD: 7, DEPTH_TEST: 8, LESS: 9,
			COLOR_BUFFER_BIT: 256, DEPTH_BUFFER_BIT: 512,
			bindFramebuffer: (_target: number, value: unknown) => { framebuffer = value; },
			bindVertexArray: (value: unknown) => { vertexArray = value; },
			disable: (capability: number) => { enabled.delete(capability); },
			enable: (capability: number) => { enabled.add(capability); },
			colorMask: (...channels: boolean[]) => { colorWritable = channels.length === 4 && channels.every(Boolean); },
			depthMask: (value: boolean) => { depthWritable = value; },
			depthFunc: (value: number) => { depthFunction = value; },
			depthRange: (...range: number[]) => { depthRange = range; },
			clearDepth: (value: number) => { clearDepth = value; },
			viewport: (...bounds: number[]) => { viewport = bounds; },
			clearColor: (...channels: number[]) => { background = channels; },
			clear: (mask: number) => {
				colorCleared = framebuffer === null && !enabled.has(2) && colorWritable && (mask & 256) !== 0;
				depthCleared = framebuffer === null && !enabled.has(2) && depthWritable && clearDepth === 1 && (mask & 512) !== 0;
			},
		};
		resetProceduralWebGl2Frame(context as unknown as WebGL2RenderingContext, 350, 480);
		expect(colorCleared).toBe(true);
		expect(depthCleared).toBe(true);
		expect(vertexArray).toBeNull();
		expect(viewport).toEqual([0, 0, 350, 480]);
		expect(depthRange).toEqual([0, 1]);
		expect(depthFunction).toBe(context.LESS);
		expect(background).toEqual(THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.background);
		expect([...enabled]).toEqual([8]);
	});

	it("draws a distinct vertical contour at an equal-thickness inner wall corner", () => {
		const corners = wallJointOutlineDrawsFor([
			{
				centerXM: 1,
				centerYM: 1.3,
				centerZM: 0,
				depthM: 0.2,
				heightM: 2.6,
				widthM: 2,
			},
			{
				centerXM: 2,
				centerYM: 1.3,
				centerZM: 1,
				depthM: 2,
				heightM: 2.6,
				widthM: 0.2,
			},
		]);

		expect(corners).toHaveLength(1);
		expect(corners[0]).toEqual(
			expect.objectContaining({
				centerXM: expect.closeTo(2, 8),
				centerZM: expect.closeTo(0, 8),
				heightM: expect.closeTo(2.6, 8),
			}),
		);
	});

	it("keeps depth-revealing corner caps on both sides of a wall split by a doorway", () => {
		const horizontalCaps = wallCornerOutlineDrawsFor({
			centerXM: 2,
			centerYM: 1.3,
			centerZM: 0,
			depthM: 0.1,
			heightM: 2.6,
			widthM: 1.6,
		});
		const verticalCaps = wallCornerOutlineDrawsFor({
			centerXM: 0,
			centerYM: 1.3,
			centerZM: 1.5,
			depthM: 1.2,
			heightM: 2.6,
			widthM: 0.1,
		});

		expect(horizontalCaps).toHaveLength(2);
		expect(
			horizontalCaps.every((cap) => cap.depthM > 0.1 && cap.widthM < 0.1),
		).toBe(true);
		expect(verticalCaps).toHaveLength(2);
		expect(
			verticalCaps.every((cap) => cap.widthM > 0.1 && cap.depthM < 0.1),
		).toBe(true);
	});

	it("rotates local +Z toward world +X for a positive right-handed item yaw", () => {
		const matrix = sceneBoxModelMatrix({
			centerXM: 10,
			centerYM: 1,
			centerZM: 20,
			depthM: 4,
			heightM: 2,
			widthM: 2,
			yawRadians: Math.PI / 2,
		});

		expect(transformPoint(matrix, [0, 0, 0.5])).toEqual([12, 1, 20]);
		expect(transformPoint(matrix, [0.5, 0, 0])).toEqual([10, 1, 19]);
	});

	it("rotates every detailed furniture subpart around its parent, including its forward-facing back", () => {
		const item = {
			centerXM: 2,
			centerYM: 0.5,
			centerZM: 2,
			depthM: 0.8,
			heightM: 1,
			material: { colorHex: "#2f80ed", furnitureKind: "sofa" as const },
			widthM: 1.2,
			yawRadians: Math.PI / 2,
		};

		const parts = furnitureGreyboxPartsFor(item, true);
		const back = parts.find((part) => part.role === "back");
		const arms = parts.filter((part) => part.role === "arm");

		expect(back?.box).toEqual(
			expect.objectContaining({
				centerXM: expect.closeTo(2.328, 8),
				centerZM: expect.closeTo(2, 8),
				yawRadians: Math.PI / 2,
			}),
		);
		expect(arms.map((part) => [part.box.centerXM, part.box.centerZM])).toEqual([
			[expect.closeTo(1.952, 8), expect.closeTo(2.53, 8)],
			[expect.closeTo(1.952, 8), expect.closeTo(1.47, 8)],
		]);
		expect(parts.every((part) => part.box.yawRadians === Math.PI / 2)).toBe(
			true,
		);
	});

	it("keeps the default floor-board phase continuous across adjacent floor tiles", () => {
		const firstTile = {
			centerXM: 2,
			centerYM: 0,
			centerZM: 2,
			depthM: 4,
			heightM: 0.04,
			widthM: 4,
		};
		const secondTile = { ...firstTile, centerZM: 6 };
		const firstDraws = woodFloorDrawsFor(firstTile);
		const secondDraws = woodFloorDrawsFor(secondTile);
		const lastFirstDraw = firstDraws.at(-1);
		const firstSecondDraw = secondDraws[0];

		expect(lastFirstDraw).toBeDefined();
		expect(firstSecondDraw).toBeDefined();
		if (!lastFirstDraw || !firstSecondDraw) {
			throw new Error("Expected floor tiles to produce board draws");
		}
		expect(
			lastFirstDraw.box.centerZM + lastFirstDraw.box.depthM / 2,
		).toBeCloseTo(4, 8);
		expect(
			firstSecondDraw.box.centerZM - firstSecondDraw.box.depthM / 2,
		).toBeCloseTo(4, 8);
		expect(lastFirstDraw.color).toEqual(firstSecondDraw.color);
	});

	it("clips global boards at a tile boundary without restarting their spacing or colour sequence", () => {
		const draws = woodFloorDrawsFor({
			centerXM: 1,
			centerYM: 0,
			centerZM: 0.5,
			depthM: 0.8,
			heightM: 0.04,
			widthM: 2,
		});

		expect(draws.map((draw) => Number(draw.box.depthM.toFixed(4)))).toEqual([
			0.22, 0.32, 0.26,
		]);
		expect(draws.map((draw) => draw.color)).toEqual([
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorDarkBoard,
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorLightBoard,
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorDarkBoard,
		]);
	});

	it("uses the same world board index for a tile that starts away from the origin", () => {
		const draws = woodFloorDrawsFor({
			centerXM: 1,
			centerYM: 0,
			centerZM: 1,
			depthM: 0.8,
			heightM: 0.04,
			widthM: 2,
		});

		expect(draws[0]?.box.centerYM).toBeCloseTo(0.02, 8);
		expect(draws[0]?.box.centerZM).toBeCloseTo(0.62, 8);
		expect(draws[0]?.color).toEqual(
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorLightBoard,
		);
	});

	it("submits every generated shared-floor board to the renderer", () => {
		const floor = {
			centerXM: 1,
			centerYM: 0,
			centerZM: 0.5,
			depthM: 0.8,
			heightM: 0.04,
			widthM: 2,
		};
		const camera: WebGl2Camera = {
			azimuthRadians: 0,
			distance: 1,
			elevationRadians: 1,
			panXM: 0,
			panZM: 0,
		};
		const submitted: Array<
			readonly [number, readonly [number, number, number, number]]
		> = [];

		drawWoodFloor(
			floor,
			(box, color) => submitted.push([box.centerZM, color]),
			camera,
		);

		expect(submitted).toEqual(
			woodFloorDrawsFor(floor).map((draw) => [draw.box.centerZM, draw.color]),
		);
	});

	it("projects each wall into a warm plaster finish with trim, entirely inside its disposable envelope", () => {
		const wall = {
			centerXM: 2,
			centerYM: 1.3,
			centerZM: 1,
			depthM: 0.12,
			heightM: 2.6,
			widthM: 4,
		};
		const parts = wallFinishPartsFor(wall, false);
		const epsilon = 0.000000001;

		expect(parts.map((part) => `${part.role}:${part.tone}`)).toEqual([
			"baseboard:trim",
			"plaster:interior",
			"upper-wash:interior",
		]);
		expect(
			wallFinishPartsFor(wall, true).map((part) => `${part.role}:${part.tone}`),
		).toEqual(["baseboard:trim", "plaster:exterior", "upper-wash:exterior"]);
		expectWallFinishGeometry(parts, [
			[0.048, 0.096],
			[1.321, 2.45],
			[2.573, 0.054],
		]);
		parts.forEach((part) => {
			expect(part.box.centerXM - part.box.widthM / 2).toBeGreaterThanOrEqual(
				wall.centerXM - wall.widthM / 2 - epsilon,
			);
			expect(part.box.centerXM + part.box.widthM / 2).toBeLessThanOrEqual(
				wall.centerXM + wall.widthM / 2 + epsilon,
			);
			expect(part.box.centerYM - part.box.heightM / 2).toBeGreaterThanOrEqual(
				wall.centerYM - wall.heightM / 2 - epsilon,
			);
			expect(part.box.centerYM + part.box.heightM / 2).toBeLessThanOrEqual(
				wall.centerYM + wall.heightM / 2 + epsilon,
			);
			expect(part.box.centerZM - part.box.depthM / 2).toBeGreaterThanOrEqual(
				wall.centerZM - wall.depthM / 2 - epsilon,
			);
			expect(part.box.centerZM + part.box.depthM / 2).toBeLessThanOrEqual(
				wall.centerZM + wall.depthM / 2 + epsilon,
			);
		});

		const shortWall = { ...wall, centerYM: 0.1, heightM: 0.2 };
		expectWallFinishGeometry(wallFinishPartsFor(shortWall, false), [
			[0.02304, 0.04608],
			[0.11008, 0.128],
			[0.18704, 0.02592],
		]);
		expect(
			wallFinishDrawsFor(wall, false, true).map((draw) => draw.color),
		).toEqual([
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.baseboard,
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.interiorWall,
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.wallUpperWash,
		]);
		expect(
			wallFinishDrawsFor(wall, true, true).map((draw) => draw.color),
		).toEqual([
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.baseboard,
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.exteriorWall,
			THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.wallUpperWash,
		]);
		expect(wallFinishDrawsFor(wall, true, false)).toEqual([
			{
				box: wall,
				color: THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.exteriorWall,
			},
		]);
	});

	it("uses rich furniture silhouettes only through the bounded mobile draw-call budget", () => {
		expect(shouldUseDetailedFurniture(12)).toBe(true);
		expect(shouldUseDetailedFurniture(13)).toBe(false);
		expect(shouldUseDetailedWallFinish(12)).toBe(true);
		expect(shouldUseDetailedWallFinish(13)).toBe(false);
	});

	it("projects each semantic furniture kind into a recognizable, bounded greybox silhouette", () => {
		const item = {
			centerXM: 2,
			centerYM: 0.5,
			centerZM: 2,
			depthM: 0.8,
			heightM: 1,
			material: { colorHex: "#2f80ed", furnitureKind: "generic" as const },
			widthM: 1.2,
		};
		const expectedParts = new Map([
			[
				"table",
				["tabletop:highlight", "leg:base", "leg:base", "leg:base", "leg:base"],
			],
			[
				"chair",
				[
					"seat:highlight",
					"leg:base",
					"leg:base",
					"leg:base",
					"leg:base",
					"back:shadow",
				],
			],
			["bed", ["bed-base:base", "mattress:highlight", "headboard:shadow"]],
			[
				"storage",
				[
					"body:base",
					"drawer:highlight",
					"drawer:highlight",
					"drawer:highlight",
				],
			],
			[
				"sofa",
				["body:base", "seat:highlight", "back:shadow", "arm:base", "arm:base"],
			],
			["generic", ["body:base"]],
		] as const);
		const epsilon = 0.000000001;

		expectedParts.forEach((partsExpected, furnitureKind) => {
			const parts = furnitureGreyboxPartsFor(
				{ ...item, material: { ...item.material, furnitureKind } },
				true,
			);

			expect(parts.map((part) => `${part.role}:${part.tone}`)).toEqual(
				partsExpected,
			);
			parts.forEach((part) => {
				expect(part.box.centerXM - part.box.widthM / 2).toBeGreaterThanOrEqual(
					item.centerXM - item.widthM / 2 - epsilon,
				);
				expect(part.box.centerXM + part.box.widthM / 2).toBeLessThanOrEqual(
					item.centerXM + item.widthM / 2 + epsilon,
				);
				expect(part.box.centerYM - part.box.heightM / 2).toBeGreaterThanOrEqual(
					item.centerYM - item.heightM / 2 - epsilon,
				);
				expect(part.box.centerYM + part.box.heightM / 2).toBeLessThanOrEqual(
					item.centerYM + item.heightM / 2 + epsilon,
				);
				expect(part.box.centerZM - part.box.depthM / 2).toBeGreaterThanOrEqual(
					item.centerZM - item.depthM / 2 - epsilon,
				);
				expect(part.box.centerZM + part.box.depthM / 2).toBeLessThanOrEqual(
					item.centerZM + item.depthM / 2 + epsilon,
				);
			});
		});

		const sofaItem = {
			...item,
			material: { ...item.material, furnitureKind: "sofa" as const },
		};
		expect(furnitureGreyboxPartsFor(sofaItem, false)).toEqual([
			{ box: sofaItem, role: "body", tone: "base" },
		]);
	});

	it("keeps detailed furniture parts volume-disjoint so their planes cannot z-fight", () => {
		const baseItem = {
			centerXM: 2,
			centerYM: 0.5,
			centerZM: 2,
			depthM: 0.8,
			heightM: 1,
			material: { colorHex: "#2f80ed", furnitureKind: "generic" as const },
			widthM: 1.2,
		};

		(["table", "chair", "bed", "storage", "sofa"] as const).forEach(
			(furnitureKind) => {
				const parts = furnitureGreyboxPartsFor(
					{
						...baseItem,
						material: { ...baseItem.material, furnitureKind },
					},
					true,
				);
				expectNoStrictBoxOverlap(parts.map((part) => part.box));
			},
		);
	});

	it("opens one coherent exterior facade facing the active camera and never hides the interior divider", () => {
		const cutawayScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 2.05,
					centerYM: 1.3,
					centerZM: 0,
					depthM: 0.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 0, z: -1 }, wallSegmentId: "back" },
					widthM: 4.1,
				},
				{
					centerXM: 4.1,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 1, z: 0 }, wallSegmentId: "right" },
					widthM: 0.1,
				},
				{
					centerXM: 2.05,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 0, z: 1 }, wallSegmentId: "front" },
					widthM: 4.1,
				},
				{
					centerXM: 0,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: -1, z: 0 }, wallSegmentId: "left" },
					widthM: 0.1,
				},
				{
					centerXM: 2,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { wallSegmentId: "divider" },
					widthM: 0.1,
				},
			],
		};

		expect([
			...hiddenWallSegmentIdsForCutaway(cutawayScene, {
				azimuthRadians: 0.75,
				distance: 2.5,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			}),
		]).toEqual(["right"]);
		expect([
			...hiddenWallSegmentIdsForCutaway(cutawayScene, {
				azimuthRadians: -2.4,
				distance: 2.5,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			}),
		]).toEqual(["left"]);
	});

	it("keeps a split facade whole without pulling a parallel recessed wall out of the shell", () => {
		const cutawayScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 1,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					wall: {
						exteriorNormal: { x: 0, z: 1 },
						wallSegmentId: "front-west",
					},
					widthM: 2,
				},
				{
					centerXM: 3.1,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					wall: {
						exteriorNormal: { x: 0, z: 1 },
						wallSegmentId: "front-east",
					},
					widthM: 2,
				},
				{
					centerXM: 2.05,
					centerYM: 1.3,
					centerZM: 2.4,
					depthM: 0.1,
					heightM: 2.6,
					wall: {
						exteriorNormal: { x: 0, z: 1 },
						wallSegmentId: "front-recess",
					},
					widthM: 4.1,
				},
			],
		};

		expect([
			...hiddenWallSegmentIdsForCutaway(cutawayScene, {
				azimuthRadians: Math.PI / 2,
				distance: 2.5,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			}),
		]).toEqual(["front-west", "front-east"]);
	});

	it("opens the outer facade of an L-shaped shell regardless of wall-array order", () => {
		const notch = {
			centerXM: 1,
			centerYM: 1.3,
			centerZM: 2,
			depthM: 2,
			heightM: 2.6,
			wall: { exteriorNormal: { x: 1, z: 0 }, wallSegmentId: "notch" },
			widthM: 0.1,
		};
		const outerFacade = {
			centerXM: 4,
			centerYM: 1.3,
			centerZM: 2,
			depthM: 4,
			heightM: 2.6,
			wall: {
				exteriorNormal: { x: 1, z: 0 },
				wallSegmentId: "outer-facade",
			},
			widthM: 0.1,
		};
		const camera: WebGl2Camera = {
			azimuthRadians: 0,
			distance: 2.5,
			elevationRadians: 1,
			panXM: 0,
			panZM: 0,
		};

		for (const walls of [
			[notch, outerFacade],
			[outerFacade, notch],
		]) {
			expect([
				...hiddenWallSegmentIdsForCutaway({ ...scene, walls }, camera),
			]).toEqual(["outer-facade"]);
		}
	});

	it("opens the outermost parallel 45-degree facade instead of an earlier recess", () => {
		const diagonalNormal = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
		const cutawayScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 1.5,
					centerYM: 1.3,
					centerZM: 1.5,
					depthM: 0.1,
					heightM: 2.6,
					wall: {
						exteriorNormal: diagonalNormal,
						wallSegmentId: "diagonal-recess",
					},
					widthM: 4,
					yawRadians: Math.PI / 4,
				},
				{
					centerXM: 3.5,
					centerYM: 1.3,
					centerZM: 3.5,
					depthM: 0.1,
					heightM: 2.6,
					wall: {
						exteriorNormal: diagonalNormal,
						wallSegmentId: "diagonal-outer",
					},
					widthM: 4,
					yawRadians: Math.PI / 4,
				},
			],
		};

		expect([
			...hiddenWallSegmentIdsForCutaway(cutawayScene, {
				azimuthRadians: Math.PI / 4,
				distance: 2.5,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			}),
		]).toEqual(["diagonal-outer"]);
	});

	it("normalizes exterior normals before choosing the nearest coherent facade", () => {
		const cutawayScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 4.1,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 10, z: 0 }, wallSegmentId: "right" },
					widthM: 0.1,
				},
				{
					centerXM: 3.4,
					centerYM: 1.3,
					centerZM: 3.4,
					depthM: 0.1,
					heightM: 2.6,
					wall: {
						exteriorNormal: { x: Math.SQRT1_2, z: Math.SQRT1_2 },
						wallSegmentId: "diagonal",
					},
					widthM: 4.1,
				},
			],
		};

		expect([
			...hiddenWallSegmentIdsForCutaway(cutawayScene, {
				azimuthRadians: Math.PI / 4,
				distance: 2.5,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			}),
		]).toEqual(["diagonal"]);
	});

	it("opens every split segment of the same nearest facade without exposing a disconnected gap", () => {
		const cutawayScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 1,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					wall: {
						exteriorNormal: { x: 0, z: 1 },
						wallSegmentId: "front-west",
					},
					widthM: 2,
				},
				{
					centerXM: 3.1,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					wall: {
						exteriorNormal: { x: 0, z: 1 },
						wallSegmentId: "front-east",
					},
					widthM: 2,
				},
				{
					centerXM: 4.1,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 1, z: 0 }, wallSegmentId: "right" },
					widthM: 0.1,
				},
			],
		};

		expect([
			...hiddenWallSegmentIdsForCutaway(cutawayScene, {
				azimuthRadians: Math.PI / 2,
				distance: 2.5,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			}),
		]).toEqual(["front-west", "front-east"]);
	});

	it("classifies a cutaway from the camera-to-plan-centre direction after pan", () => {
		const cutawayScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 4.1,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 1, z: 0 }, wallSegmentId: "right" },
					widthM: 0.1,
				},
				{
					centerXM: 0,
					centerYM: 1.3,
					centerZM: 1.55,
					depthM: 3.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: -1, z: 0 }, wallSegmentId: "left" },
					widthM: 0.1,
				},
			],
		};

		expect([
			...hiddenWallSegmentIdsForCutaway(cutawayScene, {
				azimuthRadians: 0,
				distance: 2.5,
				elevationRadians: 1,
				panXM: -10,
				panZM: 0,
			}),
		]).toEqual(["left"]);
	});

	it("derives one orbit camera eye and target from scene bounds without a room-transition state", () => {
		const camera: WebGl2Camera = {
			azimuthRadians: Math.PI / 2,
			distance: 2,
			elevationRadians: Math.PI / 6,
			panXM: 0.5,
			panZM: -0.2,
		};

		const { eye, target } = cameraEyeAndTargetFor(scene, camera);

		expect(target[0]).toBeCloseTo(2.55, 10);
		expect(target[1]).toBeCloseTo(0.572, 10);
		expect(target[2]).toBeCloseTo(1.35, 10);
		expect(eye[0]).toBeCloseTo(2.55, 10);
		expect(eye[1]).toBeCloseTo(0.572 + 4.1 * 2 * Math.sin(Math.PI / 6), 10);
		expect(eye[2]).toBeCloseTo(1.35 + 4.1 * 2 * Math.cos(Math.PI / 6), 10);
	});

	it("keeps a cutaway wall visible until it crosses the exit threshold, preventing orbit flicker", () => {
		const frontWallScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 2.05,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 0, z: 1 }, wallSegmentId: "front" },
					widthM: 4.1,
				},
			],
		};
		const nearBoundary: WebGl2Camera = {
			azimuthRadians: 0.2,
			distance: 2.5,
			elevationRadians: 1,
			panXM: 0,
			panZM: 0,
		};
		const pastExit: WebGl2Camera = { ...nearBoundary, azimuthRadians: 0.05 };

		expect([
			...hiddenWallSegmentIdsForCutaway(frontWallScene, nearBoundary),
		]).toEqual([]);
		expect([
			...hiddenWallSegmentIdsForCutaway(
				frontWallScene,
				nearBoundary,
				new Set(["front"]),
			),
		]).toEqual(["front"]);
		expect([
			...hiddenWallSegmentIdsForCutaway(
				frontWallScene,
				pastExit,
				new Set(["front"]),
			),
		]).toEqual([]);
	});

	it("shows every wall when the user selects the fallback show-all mode", () => {
		const mode: WebGl2CutawayMode = "show-all";
		const cutawayScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 2.05,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					wall: { exteriorNormal: { x: 0, z: 1 }, wallSegmentId: "front" },
					widthM: 4.1,
				},
			],
		};

		expect([
			...hiddenWallSegmentIdsForCutaway(
				cutawayScene,
				{
					azimuthRadians: Math.PI / 2,
					distance: 2.5,
					elevationRadians: 1,
					panXM: 0,
					panZM: 0,
				},
				new Set(["front"]),
				mode,
			),
		]).toEqual([]);
	});

	it("fails closed to show all when a legacy wall has no exterior identity", () => {
		const legacyScene: RectangularRoomWebGlScene = {
			...scene,
			walls: [
				{
					centerXM: 2.05,
					centerYM: 1.3,
					centerZM: 3.1,
					depthM: 0.1,
					heightM: 2.6,
					widthM: 4.1,
				},
			],
		};

		expect([
			...hiddenWallSegmentIdsForCutaway(legacyScene, {
				azimuthRadians: Math.PI / 2,
				distance: 2.5,
				elevationRadians: 1,
				panXM: 0,
				panZM: 0,
			}),
		]).toEqual([]);
	});

	it("releases an already-compiled vertex shader when fragment compilation fails", () => {
		const deletedShaderTypes: number[] = [];
		const context = {
			COMPILE_STATUS: 3,
			FRAGMENT_SHADER: 2,
			LINK_STATUS: 4,
			VERTEX_SHADER: 1,
			compileShader: () => undefined,
			createProgram: () => ({}) as WebGLProgram,
			createShader: (type: number) => ({ type }) as unknown as WebGLShader,
			deleteShader: (shader: unknown) =>
				deletedShaderTypes.push((shader as { type: number }).type),
			getShaderParameter: (shader: unknown) =>
				(shader as { type: number }).type !== 2,
			shaderSource: () => undefined,
		} as unknown as WebGL2RenderingContext;

		expect(() => createWebGl2Program(context, "vertex", "fragment")).toThrow(
			"Could not compile a WebGL shader",
		);
		expect(deletedShaderTypes).toEqual([2, 1]);
	});

	it("renders a new disposable camera view without rebuilding the Project scene", () => {
		const port = canvas({});
		const cameras: Array<WebGl2Camera | undefined> = [];
		const controller = new WebGl2RoomRendererController(port, () => ({
			dispose: () => undefined,
			render: (camera) => {
				cameras.push(camera);
			},
		}));
		const camera: WebGl2Camera = {
			azimuthRadians: 0.5,
			distance: 1.2,
			elevationRadians: 0.7,
			panXM: 0,
			panZM: 0,
		};

		controller.start(scene);
		controller.render(camera);

		expect(cameras).toEqual([undefined, camera]);
		controller.dispose();
	});

	it("passes the selected show-all fallback to the disposable renderer", () => {
		const port = canvas({});
		const renders: Array<
			readonly [WebGl2Camera | undefined, WebGl2CutawayMode | undefined]
		> = [];
		const controller = new WebGl2RoomRendererController(port, () => ({
			dispose: () => undefined,
			render: (camera, cutawayMode) => {
				renders.push([camera, cutawayMode]);
			},
		}));
		const camera: WebGl2Camera = {
			azimuthRadians: 0.5,
			distance: 1.2,
			elevationRadians: 0.7,
			panXM: 0,
			panZM: 0,
		};

		controller.start(scene);
		controller.render(camera, "show-all");

		expect(renders).toEqual([
			[undefined, undefined],
			[camera, "show-all"],
		]);
		controller.dispose();
	});

	it("reports unavailable when the canvas cannot acquire WebGL2 and keeps retry possible", () => {
		const port = canvas(null);
		const controller = new WebGl2RoomRendererController(port, () => {
			throw new Error("Must not build a scene without a context");
		});

		expect(controller.start(scene)).toEqual({ kind: "unavailable" });
		controller.dispose();
	});

	it("automatically rebuilds the last 3D scene and view after the WebGL context is restored", () => {
		const port = canvas({});
		const updatedScene: RectangularRoomWebGlScene = {
			...scene,
			items: [
				{
					centerXM: 1,
					centerYM: 0.5,
					centerZM: 1,
					depthM: 1,
					heightM: 1,
					widthM: 1,
				},
			],
		};
		let disposed = 0;
		const constructedScenes: RectangularRoomWebGlScene[] = [];
		const renders: Array<{
			readonly camera: WebGl2Camera | undefined;
			readonly cutawayMode: WebGl2CutawayMode | undefined;
			readonly generation: number;
			readonly rendererScene: RectangularRoomWebGlScene | undefined;
		}> = [];
		const stateHistory: WebGl2RendererState[] = [];
		const controller = new WebGl2RoomRendererController(
			port,
			(_context, constructedScene): WebGl2SceneRenderer => {
				constructedScenes.push(constructedScene);
				const generation = constructedScenes.length;
				return {
					dispose: () => {
						disposed += 1;
					},
					render: (camera, cutawayMode, rendererScene) => {
						renders.push({ camera, cutawayMode, generation, rendererScene });
					},
				};
			},
			(nextState) => stateHistory.push(nextState),
		);
		const camera: WebGl2Camera = {
			azimuthRadians: 0.5,
			distance: 1.2,
			elevationRadians: 0.7,
			panXM: 0.2,
			panZM: -0.3,
		};

		expect(controller.start(scene)).toEqual({ kind: "ready" });
		controller.render(camera, "show-all", updatedScene);
		port.emit("webglcontextlost");
		expect(controller.snapshot()).toEqual({ kind: "context-lost" });
		expect(port.contextLossPreventDefaultCalls()).toBe(1);
		expect(disposed).toBe(1);
		port.emit("webglcontextrestored");
		expect(controller.snapshot()).toEqual({ kind: "ready" });
		expect(stateHistory).toEqual([
			{ kind: "ready" },
			{ kind: "context-lost" },
			{ kind: "ready" },
		]);
		expect(constructedScenes).toEqual([scene, updatedScene]);
		expect(renders).toEqual([
			{
				camera: undefined,
				cutawayMode: undefined,
				generation: 1,
				rendererScene: scene,
			},
			{
				camera,
				cutawayMode: "show-all",
				generation: 1,
				rendererScene: updatedScene,
			},
			{
				camera,
				cutawayMode: "show-all",
				generation: 2,
				rendererScene: updatedScene,
			},
		]);
		controller.dispose();
		expect(disposed).toBe(2);
	});

	it("rebuilds the latest canonical scene when it changes while the WebGL context is lost", () => {
		const port = canvas({});
		const constructedScenes: RectangularRoomWebGlScene[] = [];
		const renders: Array<{
			readonly camera: WebGl2Camera | undefined;
			readonly cutawayMode: WebGl2CutawayMode | undefined;
			readonly scene: RectangularRoomWebGlScene | undefined;
		}> = [];
		const currentRevisionScene: RectangularRoomWebGlScene = {
			...scene,
			items: [
				{
					assetInstanceId: "revision-item",
					centerXM: 1.4,
					centerYM: 0.5,
					centerZM: 1.8,
					depthM: 0.6,
					heightM: 1,
					widthM: 1.2,
				},
			],
		};
		const controller = new WebGl2RoomRendererController(
			port,
			(_context, constructedScene) => {
				constructedScenes.push(constructedScene);
				return {
					dispose: () => undefined,
					render: (camera, cutawayMode, renderedScene) => {
						renders.push({ camera, cutawayMode, scene: renderedScene });
					},
				};
			},
		);
		const camera: WebGl2Camera = {
			azimuthRadians: 0.4,
			distance: 1.9,
			elevationRadians: 0.8,
			panXM: 0.25,
			panZM: -0.15,
		};

		controller.start(scene);
		controller.render(camera, "show-all", scene);
		port.emit("webglcontextlost");
		controller.updateScene(currentRevisionScene);
		port.emit("webglcontextrestored");

		expect(constructedScenes).toEqual([scene, currentRevisionScene]);
		expect(renders.at(-1)).toEqual({
			camera,
			cutawayMode: "show-all",
			scene: currentRevisionScene,
		});
		controller.dispose();
	});

	it("retries a failed automatic recovery at low quality before offering a safe 2D fallback", () => {
		const port = canvas({});
		let attempts = 0;
		const controller = new WebGl2RoomRendererController(
			port,
			(): WebGl2SceneRenderer => {
				attempts += 1;
				if (attempts >= 2) {
					throw new Error("Restored context cannot recreate shaders");
				}
				return { dispose: () => undefined, render: () => undefined };
			},
		);

		expect(controller.start(scene)).toEqual({ kind: "ready" });
		port.emit("webglcontextlost");
		port.emit("webglcontextrestored");

		expect(attempts).toBe(3);
		expect(controller.snapshot()).toEqual({
			kind: "two-dimensional-fallback",
			reasonCode: "WEBGL_RECOVERY_FAILED",
		});
		controller.dispose();
	});

	it("keeps the recovered 3D projection in reduced quality after a standard recovery fails", () => {
		const port = canvas({});
		const attemptedQualityTiers: WebGl2RendererQualityTier[] = [];
		const controller = new WebGl2RoomRendererController(
			port,
			(_context, _scene, qualityTier): WebGl2SceneRenderer => {
				attemptedQualityTiers.push(qualityTier);
				if (attemptedQualityTiers.length === 2) {
					throw new Error("Standard recovery cannot recreate shaders");
				}
				return { dispose: () => undefined, render: () => undefined };
			},
		);

		expect(controller.start(scene)).toEqual({ kind: "ready" });
		port.emit("webglcontextlost");
		port.emit("webglcontextrestored");

		expect(attemptedQualityTiers).toEqual(["standard", "standard", "reduced"]);
		expect(controller.snapshot()).toEqual({
			kind: "ready",
			qualityTier: "reduced",
		});
		controller.dispose();
	});

	it("lowers only the transient renderer tier after sustained frame pressure and records safe diagnostics", () => {
		const port = canvas({});
		const constructedQualityTiers: WebGl2RendererQualityTier[] = [];
		const diagnostics: WebGl2RendererDiagnostic[] = [];
		const frameTimes = [0, 34, 100, 134, 200, 234];
		const controller = new WebGl2RoomRendererController(
			port,
			(_context, _scene, qualityTier): WebGl2SceneRenderer => {
				constructedQualityTiers.push(qualityTier);
				return { dispose: () => undefined, render: () => undefined };
			},
			undefined,
			(diagnostic) => diagnostics.push(diagnostic),
			() => frameTimes.shift() ?? 234,
		);
		const camera: WebGl2Camera = {
			azimuthRadians: 0.5,
			distance: 1.2,
			elevationRadians: 0.7,
			panXM: 0,
			panZM: 0,
		};

		controller.start(scene);
		controller.render(camera);
		controller.render(camera);
		controller.render(camera);

		expect(constructedQualityTiers).toEqual(["standard", "reduced"]);
		expect(controller.snapshot()).toEqual({
			kind: "ready",
			qualityTier: "reduced",
		});
		expect(diagnostics).toEqual([
			{
				backend: "webgl2",
				fallbackTier: "none",
				lifecycleOutcome: "ready",
				lossOrdinal: 0,
				qualityTier: "standard",
				reasonCode: "NONE",
			},
			{
				backend: "webgl2",
				fallbackTier: "none",
				lifecycleOutcome: "ready",
				lossOrdinal: 0,
				qualityTier: "reduced",
				reasonCode: "RUNTIME_PERFORMANCE_PRESSURE",
			},
		]);
		controller.dispose();
	});

	it("does not construct a 3D scene when a restore arrives before the first scene starts", () => {
		const port = canvas({});
		let constructed = 0;
		const controller = new WebGl2RoomRendererController(
			port,
			(): WebGl2SceneRenderer => {
				constructed += 1;
				return { dispose: () => undefined, render: () => undefined };
			},
		);

		port.emit("webglcontextrestored");

		expect(constructed).toBe(0);
		expect(controller.snapshot()).toEqual({ kind: "retryable" });
		controller.dispose();
	});

	it("reports initialization failure without leaving an undisposed renderer behind", () => {
		const port = canvas({});
		const controller = new WebGl2RoomRendererController(port, () => {
			throw new Error("Shader compilation failed");
		});

		expect(controller.start(scene)).toEqual({ kind: "failed" });
		controller.dispose();
	});
});

function expectWallFinishGeometry(
	parts: ReturnType<typeof wallFinishPartsFor>,
	expected: readonly (readonly [centerYM: number, heightM: number])[],
): void {
	expect(parts).toHaveLength(expected.length);
	parts.forEach((part, index) => {
		const target = expected[index];
		if (!target) {
			throw new Error("Missing expected wall finish part");
		}
		expect(part.box.centerYM).toBeCloseTo(target[0], 8);
		expect(part.box.heightM).toBeCloseTo(target[1], 8);
	});
}

function transformPoint(
	matrix: Float32Array,
	point: readonly [number, number, number],
): readonly [number, number, number] {
	return [
		matrix[0] * point[0] +
			matrix[4] * point[1] +
			matrix[8] * point[2] +
			matrix[12],
		matrix[1] * point[0] +
			matrix[5] * point[1] +
			matrix[9] * point[2] +
			matrix[13],
		matrix[2] * point[0] +
			matrix[6] * point[1] +
			matrix[10] * point[2] +
			matrix[14],
	];
}

function expectNoStrictBoxOverlap(
	boxes: readonly {
		readonly centerXM: number;
		readonly centerYM: number;
		readonly centerZM: number;
		readonly depthM: number;
		readonly heightM: number;
		readonly widthM: number;
	}[],
): void {
	for (let firstIndex = 0; firstIndex < boxes.length; firstIndex += 1) {
		const first = boxes[firstIndex];
		if (!first) continue;
		for (
			let secondIndex = firstIndex + 1;
			secondIndex < boxes.length;
			secondIndex += 1
		) {
			const second = boxes[secondIndex];
			if (!second) continue;
			const xOverlap =
				Math.min(
					first.centerXM + first.widthM / 2,
					second.centerXM + second.widthM / 2,
				) -
				Math.max(
					first.centerXM - first.widthM / 2,
					second.centerXM - second.widthM / 2,
				);
			const yOverlap =
				Math.min(
					first.centerYM + first.heightM / 2,
					second.centerYM + second.heightM / 2,
				) -
				Math.max(
					first.centerYM - first.heightM / 2,
					second.centerYM - second.heightM / 2,
				);
			const zOverlap =
				Math.min(
					first.centerZM + first.depthM / 2,
					second.centerZM + second.depthM / 2,
				) -
				Math.max(
					first.centerZM - first.depthM / 2,
					second.centerZM - second.depthM / 2,
				);
			expect(
				xOverlap > 0.000001 && yOverlap > 0.000001 && zOverlap > 0.000001,
				`parts ${firstIndex} and ${secondIndex} overlap by a renderable volume`,
			).toBe(false);
		}
	}
}
