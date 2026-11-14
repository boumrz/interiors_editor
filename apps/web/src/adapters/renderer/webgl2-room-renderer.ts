import type {
	RectangularRoomWebGlScene,
	SceneBox,
	SceneFloorPolygon,
} from "./rectangular-room-projection";
import { createThreeWebGl2RoomSceneRenderer } from "./three-webgl2-room-renderer";
import { THREE_DIMENSIONAL_ROOM_SURFACE_COLORS } from "./three-dimensional-room-palette";

import {
	cameraEyeAndTargetFor,
	furnitureGreyboxPartsFor,
	hiddenWallSegmentIdsForCutaway,
	sceneBoxYawRadians,
	type FurnitureGreyboxPart,
	type WebGl2Camera,
	type WebGl2CutawayMode,
	type WebGl2RendererQualityTier,
	type WebGl2RuntimeModels,
	type WebGl2SceneRenderer,
} from "./webgl2-room-renderer-shared";

export {
	cameraEyeAndTargetFor,
	furnitureGreyboxPartsFor,
	hiddenWallSegmentIdsForCutaway,
	type FurnitureGreyboxPart,
	type FurnitureGreyboxRole,
	type WebGl2Camera,
	type WebGl2CutawayMode,
	type WebGl2OrbitCamera,
	type WebGl2RendererQualityTier,
	type WebGl2RuntimeModel,
	type WebGl2RuntimeModels,
	type WebGl2SceneRenderer,
} from "./webgl2-room-renderer-shared";

export interface WebGl2CanvasPort {
	getContext(contextId: "webgl2"): WebGL2RenderingContext | null;
	addEventListener(
		type: "webglcontextlost" | "webglcontextrestored",
		listener: (event: { preventDefault(): void }) => void,
	): void;
	removeEventListener(
		type: "webglcontextlost" | "webglcontextrestored",
		listener: (event: { preventDefault(): void }) => void,
	): void;
}

export type WebGl2RendererState =
	| { readonly kind: "ready"; readonly qualityTier?: "reduced" }
	| { readonly kind: "unavailable" }
	| { readonly kind: "failed" }
	| { readonly kind: "context-lost" }
	| { readonly kind: "retryable" }
	| {
			readonly kind: "two-dimensional-fallback";
			readonly reasonCode: "WEBGL_RECOVERY_FAILED";
	  };

export interface WebGl2RendererDiagnostic {
	readonly backend: "webgl2";
	readonly fallbackTier: "none" | "two-dimensional";
	readonly lifecycleOutcome: WebGl2RendererState["kind"];
	readonly lossOrdinal: number;
	readonly qualityTier: WebGl2RendererQualityTier;
	readonly reasonCode:
		| "NONE"
		| "RECOVERY_LOW_QUALITY"
		| "RUNTIME_PERFORMANCE_PRESSURE"
		| "WEBGL2_UNAVAILABLE"
		| "WEBGL_CONTEXT_LOST"
		| "WEBGL_RECOVERY_FAILED"
		| "WEBGL_RENDERER_INITIALIZATION_FAILED"
		| "WEBGL_RENDERER_NOT_STARTED";
}

const RENDER_PRESSURE_FRAME_MS = 33.3;
const SUSTAINED_PRESSURE_FRAME_COUNT = 3;

type RendererFactory = (
	context: WebGL2RenderingContext,
	scene: RectangularRoomWebGlScene,
	qualityTier: WebGl2RendererQualityTier,
	runtimeModels: WebGl2RuntimeModels,
) => WebGl2SceneRenderer;

export class WebGl2RoomRendererController {
	private lastCamera: WebGl2Camera | undefined;
	private lastCutawayMode: WebGl2CutawayMode | undefined;
	private lastScene: RectangularRoomWebGlScene | undefined;
	private lastRuntimeModels: WebGl2RuntimeModels = {};
	private renderer: WebGl2SceneRenderer | undefined;
	private rendererQualityTier: WebGl2RendererQualityTier = "standard";
	private slowRenderFrameCount = 0;
	private state: WebGl2RendererState = { kind: "retryable" };
	private contextLossOrdinal = 0;

	public constructor(
		private readonly canvas: WebGl2CanvasPort,
		private readonly createSceneRenderer: RendererFactory = createWebGl2RoomSceneRenderer,
		private readonly onStateChange: (state: WebGl2RendererState) => void = () =>
			undefined,
		private readonly onDiagnostic: (
			diagnostic: WebGl2RendererDiagnostic,
		) => void = () => undefined,
		private readonly now: () => number = () => performance.now(),
	) {
		this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
		this.canvas.addEventListener(
			"webglcontextrestored",
			this.handleContextRestored,
		);
	}

	public start(
		scene: RectangularRoomWebGlScene,
		qualityTier: WebGl2RendererQualityTier = "standard",
		reasonCode: WebGl2RendererDiagnostic["reasonCode"] = "NONE",
		runtimeModels: WebGl2RuntimeModels = {},
	): WebGl2RendererState {
		this.lastScene = scene;
		this.lastRuntimeModels = runtimeModels;
		this.renderer?.dispose();
		this.renderer = undefined;
		const context = this.canvas.getContext("webgl2");
		if (!context) {
			this.setState({ kind: "unavailable" }, qualityTier);
			return this.state;
		}
		try {
			this.renderer = this.createSceneRenderer(
				context,
				scene,
				qualityTier,
				runtimeModels,
			);
			this.rendererQualityTier = qualityTier;
			this.slowRenderFrameCount = 0;
			this.renderer.render(
				this.lastCamera,
				this.lastCutawayMode,
				this.lastScene,
			);
			this.setState(
				qualityTier === "reduced"
					? { kind: "ready", qualityTier: "reduced" }
					: { kind: "ready" },
				qualityTier,
				reasonCode,
			);
		} catch {
			this.renderer?.dispose();
			this.renderer = undefined;
			this.setState({ kind: "failed" }, qualityTier);
		}
		return this.state;
	}

	public retry(scene: RectangularRoomWebGlScene): WebGl2RendererState {
		return this.start(scene, "standard", "NONE", this.lastRuntimeModels);
	}

	/**
	 * Records the latest disposable projection even when its WebGL context is
	 * temporarily unavailable, so recovery never reconstructs a stale Revision.
	 */
	public updateScene(scene: RectangularRoomWebGlScene): void {
		this.lastScene = scene;
	}

	/**
	 * A parsed GLB is a presentation resource. Hand it to the live renderer
	 * without discarding the room shell, current cutaway, or camera pose.
	 */
	public updateRuntimeModels(runtimeModels: WebGl2RuntimeModels): void {
		this.lastRuntimeModels = runtimeModels;
		this.renderer?.updateRuntimeModels?.(runtimeModels);
		this.renderer?.render(
			this.lastCamera,
			this.lastCutawayMode,
			this.lastScene,
		);
	}

	public render(
		camera: WebGl2Camera,
		cutawayMode: WebGl2CutawayMode = "auto",
		scene?: RectangularRoomWebGlScene,
	): void {
		this.lastCamera = camera;
		this.lastCutawayMode = cutawayMode;
		if (scene) {
			this.updateScene(scene);
		}
		const renderStartedAt = this.now();
		this.renderer?.render(camera, cutawayMode, scene);
		this.recordRenderDuration(this.now() - renderStartedAt);
	}

	public snapshot(): WebGl2RendererState {
		return this.state;
	}

	public dispose(): void {
		this.renderer?.dispose();
		this.renderer = undefined;
		this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
		this.canvas.removeEventListener(
			"webglcontextrestored",
			this.handleContextRestored,
		);
	}

	private readonly handleContextLost = (event: {
		preventDefault(): void;
	}): void => {
		event.preventDefault();
		this.renderer?.dispose();
		this.renderer = undefined;
		this.contextLossOrdinal += 1;
		this.setState({ kind: "context-lost" });
	};

	private readonly handleContextRestored = (): void => {
		if (!this.lastScene) {
			this.setState({ kind: "retryable" });
			return;
		}
		const standardRecovery = this.start(
			this.lastScene,
			"standard",
			"NONE",
			this.lastRuntimeModels,
		);
		if (standardRecovery.kind === "ready") return;
		const reducedRecovery = this.start(
			this.lastScene,
			"reduced",
			"RECOVERY_LOW_QUALITY",
			this.lastRuntimeModels,
		);
		if (reducedRecovery.kind === "ready") return;
		this.setState(
			{
				kind: "two-dimensional-fallback",
				reasonCode: "WEBGL_RECOVERY_FAILED",
			},
			"reduced",
			"WEBGL_RECOVERY_FAILED",
		);
	};

	private recordRenderDuration(durationMs: number): void {
		if (this.rendererQualityTier === "reduced") return;
		if (durationMs < RENDER_PRESSURE_FRAME_MS) {
			this.slowRenderFrameCount = 0;
			return;
		}
		this.slowRenderFrameCount += 1;
		if (this.slowRenderFrameCount < SUSTAINED_PRESSURE_FRAME_COUNT) return;
		this.slowRenderFrameCount = 0;
		if (!this.lastScene) return;
		this.start(
			this.lastScene,
			"reduced",
			"RUNTIME_PERFORMANCE_PRESSURE",
			this.lastRuntimeModels,
		);
	}

	private setState(
		state: WebGl2RendererState,
		qualityTier: WebGl2RendererQualityTier = this.rendererQualityTier,
		reasonCode: WebGl2RendererDiagnostic["reasonCode"] = this.reasonCodeFor(
			state,
		),
	): void {
		this.state = state;
		this.onStateChange(state);
		this.onDiagnostic({
			backend: "webgl2",
			fallbackTier:
				state.kind === "two-dimensional-fallback" ? "two-dimensional" : "none",
			lifecycleOutcome: state.kind,
			lossOrdinal: this.contextLossOrdinal,
			qualityTier,
			reasonCode,
		});
	}

	private reasonCodeFor(
		state: WebGl2RendererState,
	): WebGl2RendererDiagnostic["reasonCode"] {
		switch (state.kind) {
			case "ready":
				return "NONE";
			case "unavailable":
				return "WEBGL2_UNAVAILABLE";
			case "failed":
				return "WEBGL_RENDERER_INITIALIZATION_FAILED";
			case "context-lost":
				return "WEBGL_CONTEXT_LOST";
			case "retryable":
				return "WEBGL_RENDERER_NOT_STARTED";
			case "two-dimensional-fallback":
				return "WEBGL_RECOVERY_FAILED";
		}
	}
}

export function createDomWebGl2CanvasPort(
	canvas: HTMLCanvasElement,
): WebGl2CanvasPort {
	return {
		addEventListener: (type, listener) =>
			canvas.addEventListener(type, listener),
		getContext: (contextId) => canvas.getContext(contextId),
		removeEventListener: (type, listener) =>
			canvas.removeEventListener(type, listener),
	};
}

const vertexShaderSource = `#version 300 es
in vec3 a_position;
uniform mat4 u_matrix;
void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main() {
  outColor = u_color;
}`;

const unitCubeVertices = new Float32Array([
	-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5,
	0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
	-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
	0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, -0.5,
	-0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5,
	-0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5,
	0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
	0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
]);

/**
 * Triangulates a derived simple floor into its actual thin prism. The floor
 * remains a renderer-only projection: these metre values never become a
 * second durable geometry source.
 */
export function wallPrismVerticesFor(wall: SceneBox): Float32Array {
	if (!wall.wallFootprintM) return new Float32Array();
	const vertices = floorPrismVerticesFor({
		floor: { roomId: "" },
		vertices: wall.wallFootprintM,
		heightM: wall.heightM,
	});
	for (let i = 1; i < vertices.length; i += 3)
		vertices[i] = (vertices[i] ?? 0) + wall.centerYM;
	return vertices;
}

export function floorPrismVerticesFor(floor: SceneFloorPolygon): Float32Array {
	if (
		floor.vertices.length < 3 ||
		!Number.isFinite(floor.heightM) ||
		floor.heightM <= 0 ||
		!floor.vertices.every(
			(vertex) => Number.isFinite(vertex.xM) && Number.isFinite(vertex.zM),
		)
	) {
		return new Float32Array();
	}
	const topY = floor.heightM / 2;
	const bottomY = -topY;
	const vertices: number[] = [];
	const append = (
		point: { readonly xM: number; readonly zM: number },
		y: number,
	) => {
		vertices.push(point.xM, y, point.zM);
	};
	const triangles = triangulateSimpleFloor(floor.vertices);
	if (triangles.length !== floor.vertices.length - 2) {
		return new Float32Array();
	}
	for (const triangle of triangles) {
		const [firstRaw, secondRaw, thirdRaw] = triangle;
		const first = firstRaw === undefined ? undefined : floor.vertices[firstRaw];
		const second =
			secondRaw === undefined ? undefined : floor.vertices[secondRaw];
		const third = thirdRaw === undefined ? undefined : floor.vertices[thirdRaw];
		if (!first || !second || !third) return new Float32Array();
		append(first, topY);
		append(second, topY);
		append(third, topY);
		append(first, bottomY);
		append(third, bottomY);
		append(second, bottomY);
	}
	for (let index = 0; index < floor.vertices.length; index += 1) {
		const firstEdgePoint = floor.vertices[index];
		const secondEdgePoint = floor.vertices[(index + 1) % floor.vertices.length];
		if (!firstEdgePoint || !secondEdgePoint) return new Float32Array();
		append(firstEdgePoint, bottomY);
		append(secondEdgePoint, bottomY);
		append(secondEdgePoint, topY);
		append(firstEdgePoint, bottomY);
		append(secondEdgePoint, topY);
		append(firstEdgePoint, topY);
	}
	return new Float32Array(vertices);
}

type FloorPoint = { readonly xM: number; readonly zM: number };

/** Ear clipping for the simple canonical usable-floor polygon; no engine math dependency. */
function triangulateSimpleFloor(
	vertices: readonly FloorPoint[],
): readonly (readonly [number, number, number])[] {
	const signedTwiceArea = vertices.reduce((area, point, index) => {
		const next = vertices[(index + 1) % vertices.length];
		return next ? area + point.xM * next.zM - point.zM * next.xM : area;
	}, 0);
	if (Math.abs(signedTwiceArea) <= Number.EPSILON) return [];
	const isCounterClockwise = signedTwiceArea > 0;
	const remaining = vertices.map((_, index) => index);
	const triangles: Array<readonly [number, number, number]> = [];
	const orientation = (
		first: FloorPoint,
		second: FloorPoint,
		third: FloorPoint,
	) =>
		(second.xM - first.xM) * (third.zM - first.zM) -
		(second.zM - first.zM) * (third.xM - first.xM);
	const isInsideOrOnTriangle = (
		point: FloorPoint,
		first: FloorPoint,
		second: FloorPoint,
		third: FloorPoint,
	) => {
		const firstSide = orientation(first, second, point);
		const secondSide = orientation(second, third, point);
		const thirdSide = orientation(third, first, point);
		return !(
			(firstSide < 0 || secondSide < 0 || thirdSide < 0) &&
			(firstSide > 0 || secondSide > 0 || thirdSide > 0)
		);
	};
	let attemptsRemaining = vertices.length * vertices.length;
	while (remaining.length > 3 && attemptsRemaining > 0) {
		let clipped = false;
		for (let position = 0; position < remaining.length; position += 1) {
			const previousIndex =
				remaining[(position - 1 + remaining.length) % remaining.length];
			const index = remaining[position];
			const nextIndex = remaining[(position + 1) % remaining.length];
			if (
				previousIndex === undefined ||
				index === undefined ||
				nextIndex === undefined
			)
				return [];
			const previous = vertices[previousIndex];
			const current = vertices[index];
			const next = vertices[nextIndex];
			if (!previous || !current || !next) return [];
			const turn = orientation(previous, current, next);
			if (isCounterClockwise ? turn <= 0 : turn >= 0) continue;
			const containsOtherVertex = remaining.some((candidateIndex) => {
				if (
					candidateIndex === previousIndex ||
					candidateIndex === index ||
					candidateIndex === nextIndex
				)
					return false;
				const candidate = vertices[candidateIndex];
				return (
					candidate !== undefined &&
					isInsideOrOnTriangle(candidate, previous, current, next)
				);
			});
			if (containsOtherVertex) continue;
			triangles.push([previousIndex, index, nextIndex]);
			remaining.splice(position, 1);
			clipped = true;
			break;
		}
		if (!clipped) return [];
		attemptsRemaining -= 1;
	}
	if (remaining.length !== 3) return [];
	const [first, second, third] = remaining;
	return first === undefined || second === undefined || third === undefined
		? []
		: [...triangles, [first, second, third]];
}

function createWebGl2RoomSceneRenderer(
	context: WebGL2RenderingContext,
	scene: RectangularRoomWebGlScene,
	qualityTier: WebGl2RendererQualityTier,
	runtimeModels: WebGl2RuntimeModels,
): WebGl2SceneRenderer {
	if (shouldUseThreeWebGl2RoomSceneRenderer(scene, runtimeModels)) {
		try {
			return createThreeWebGl2RoomSceneRenderer(
				context,
				scene,
				qualityTier,
				runtimeModels,
			);
		} catch {
			// An unavailable optional engine does not require adding an asset or
			// retrying engine construction on every camera frame. Recovery starts
			// a fresh renderer explicitly through the existing controller lifecycle.
			return createProceduralWebGl2RoomSceneRenderer(
				context,
				scene,
				qualityTier,
			);
		}
	}
	return createProceduralWebGl2RoomSceneRenderer(context, scene, qualityTier);
}

/**
 * Empty, placeholder and GLB scenes share one room pipeline. Furniture arrival
 * must not replace the floor, walls, lighting or WebGL state of an empty room.
 */
export function shouldUseThreeWebGl2RoomSceneRenderer(
	_scene: RectangularRoomWebGlScene,
	_runtimeModels: WebGl2RuntimeModels,
): boolean {
	return true;
}

/** The fallback owns a complete writable default framebuffer for every frame. */
export function resetProceduralWebGl2Frame(
	context: WebGL2RenderingContext,
	width: number,
	height: number,
): void {
	context.bindFramebuffer(context.FRAMEBUFFER, null);
	context.bindVertexArray(null);
	context.disable(context.SCISSOR_TEST);
	context.disable(context.BLEND);
	context.disable(context.CULL_FACE);
	context.disable(context.STENCIL_TEST);
	context.disable(context.POLYGON_OFFSET_FILL);
	context.disable(context.RASTERIZER_DISCARD);
	context.colorMask(true, true, true, true);
	context.depthMask(true);
	context.depthFunc(context.LESS);
	context.depthRange(0, 1);
	context.clearDepth(1);
	context.viewport(0, 0, width, height);
	context.enable(context.DEPTH_TEST);
	context.clearColor(...THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.background);
	context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
}

function createProceduralWebGl2RoomSceneRenderer(
	context: WebGL2RenderingContext,
	scene: RectangularRoomWebGlScene,
	qualityTier: WebGl2RendererQualityTier,
): WebGl2SceneRenderer {
	const program = createWebGl2Program(
		context,
		vertexShaderSource,
		fragmentShaderSource,
	);
	const vertexBuffer = context.createBuffer();
	const floorPolygonBuffer = context.createBuffer();
	const positionLocation = context.getAttribLocation(program, "a_position");
	const matrixLocation = context.getUniformLocation(program, "u_matrix");
	const colorLocation = context.getUniformLocation(program, "u_color");
	if (
		!vertexBuffer ||
		!floorPolygonBuffer ||
		positionLocation < 0 ||
		!matrixLocation ||
		!colorLocation
	) {
		context.deleteProgram(program);
		throw new Error("WebGL scene locations are unavailable");
	}
	context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
	context.bufferData(
		context.ARRAY_BUFFER,
		unitCubeVertices,
		context.STATIC_DRAW,
	);
	let hiddenWallSegmentIds = new Set<string>();
	let activeScene = scene;

	const drawBox = (
		box: SceneBox,
		color: readonly [number, number, number, number],
		camera: WebGl2Camera,
	): void => {
		const physicalVertices = box.wallFootprintM
			? wallPrismVerticesFor(box)
			: undefined;
		context.bindBuffer(
			context.ARRAY_BUFFER,
			physicalVertices ? floorPolygonBuffer : vertexBuffer,
		);
		if (physicalVertices)
			context.bufferData(
				context.ARRAY_BUFFER,
				physicalVertices,
				context.DYNAMIC_DRAW,
			);
		context.vertexAttribPointer(
			positionLocation,
			3,
			context.FLOAT,
			false,
			0,
			0,
		);
		const aspect =
			Math.max(1, context.canvas.width) / Math.max(1, context.canvas.height);
		const projection = perspective(Math.PI / 3, aspect, 0.1, 100);
		const { eye, target } = cameraEyeAndTargetFor(activeScene, camera);
		const view = lookAt(eye, target, [0, 1, 0]);
		const matrix = multiply(
			projection,
			physicalVertices ? view : multiply(view, sceneBoxModelMatrix(box)),
		);
		context.uniformMatrix4fv(matrixLocation, false, matrix);
		context.uniform4fv(colorLocation, color);
		context.drawArrays(
			context.TRIANGLES,
			0,
			(physicalVertices ?? unitCubeVertices).length / 3,
		);
	};

	const drawFloorPolygon = (
		floor: SceneFloorPolygon,
		color: readonly [number, number, number, number],
		camera: WebGl2Camera,
	): void => {
		const vertices = floorPrismVerticesFor(floor);
		if (vertices.length === 0) return;
		const aspect =
			Math.max(1, context.canvas.width) / Math.max(1, context.canvas.height);
		const projection = perspective(Math.PI / 3, aspect, 0.1, 100);
		const { eye, target } = cameraEyeAndTargetFor(activeScene, camera);
		const view = lookAt(eye, target, [0, 1, 0]);
		context.bindBuffer(context.ARRAY_BUFFER, floorPolygonBuffer);
		context.bufferData(context.ARRAY_BUFFER, vertices, context.DYNAMIC_DRAW);
		context.vertexAttribPointer(
			positionLocation,
			3,
			context.FLOAT,
			false,
			0,
			0,
		);
		context.uniformMatrix4fv(matrixLocation, false, multiply(projection, view));
		context.uniform4fv(colorLocation, color);
		context.drawArrays(context.TRIANGLES, 0, vertices.length / 3);
	};

	return {
		dispose: () => {
			context.deleteBuffer(vertexBuffer);
			context.deleteBuffer(floorPolygonBuffer);
			context.deleteProgram(program);
		},
		render: (
			camera = initialWebGl2Camera,
			cutawayMode: WebGl2CutawayMode = "auto",
			sceneOverride = scene,
		) => {
			activeScene = sceneOverride;
			const canvas = context.canvas as HTMLCanvasElement;
			const pixelRatio = Math.min(
				qualityTier === "reduced" ? 1 : 2,
				window.devicePixelRatio || 1,
			);
			const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
			const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}
			resetProceduralWebGl2Frame(context, width, height);
			context.useProgram(program);
			context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
			context.enableVertexAttribArray(positionLocation);
			context.vertexAttribPointer(
				positionLocation,
				3,
				context.FLOAT,
				false,
				0,
				0,
			);
			activeScene.floors.forEach((floor) => {
				drawWoodFloor(floor, drawBox, camera);
			});
			activeScene.floorPolygons?.forEach((floor) => {
				drawFloorPolygon(
					floor,
					THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorLightBoard,
					camera,
				);
			});
			hiddenWallSegmentIds = new Set(
				hiddenWallSegmentIdsForCutaway(
					activeScene,
					camera,
					hiddenWallSegmentIds,
					cutawayMode,
				),
			);
			const useDetailedWallFinish = shouldUseDetailedWallFinish(
				activeScene.walls.length,
			);
			const visibleWalls = activeScene.walls.filter(
				(wall) => !hiddenWallSegmentIds.has(wall.wall?.wallSegmentId ?? ""),
			);
			visibleWalls.forEach((wall) => {
				drawWallFinish(
					wall,
					isExteriorWall(wall),
					useDetailedWallFinish,
					drawBox,
					camera,
				);
				wallCornerOutlineDrawsFor(wall).forEach((outline) => {
					drawBox(
						outline,
						THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.wallOutline,
						camera,
					);
				});
			});
			wallJointOutlineDrawsFor(visibleWalls).forEach((outline) => {
				drawBox(
					outline,
					THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.wallOutline,
					camera,
				);
			});
			const detailedFurniture = shouldUseDetailedFurniture(
				activeScene.items.length,
			);
			activeScene.items.forEach((item) => {
				drawFurniture(item, detailedFurniture, drawBox, camera);
			});
		},
	};
}

/** Builds only disposable orbit camera values from canonical scene bounds. */
export type DrawBox = (
	box: SceneBox,
	color: readonly [number, number, number, number],
	camera: WebGl2Camera,
) => void;

const MAX_DETAILED_FURNITURE_ITEMS = 12;
const MAX_DETAILED_WALLS = 12;

/** Keeps the alpha scene inside a small, predictable mobile draw-call budget. */
export function shouldUseDetailedFurniture(itemCount: number): boolean {
	return itemCount <= MAX_DETAILED_FURNITURE_ITEMS;
}

/** Keeps procedural finish details bounded while retaining a legible wall tone for large plans. */
export function shouldUseDetailedWallFinish(wallCount: number): boolean {
	return wallCount <= MAX_DETAILED_WALLS;
}

export type WallFinishRole = "baseboard" | "plaster" | "upper-wash";

export interface WallFinishPart {
	readonly box: SceneBox;
	readonly role: WallFinishRole;
	readonly tone: "exterior" | "interior" | "trim";
}

export interface WallFinishDraw {
	readonly box: SceneBox;
	readonly color: readonly [number, number, number, number];
}

/**
 * Thin, darker end caps expose joins between wall segments and the depth of a
 * split doorway. They remain bounded inside the canonical wall envelope, so
 * this is visual legibility rather than a parallel geometry model.
 */
export function wallCornerOutlineDrawsFor(wall: SceneBox): readonly SceneBox[] {
	if (wall.wallFootprintM) return [];
	const shortSideM = Math.min(wall.widthM, wall.depthM);
	const capM = Math.min(0.045, Math.max(0.012, shortSideM * 0.36));
	// A cap must sit slightly in front of the plaster it outlines. Identical
	// planes make a mobile GPU alternate fragments while the camera moves.
	const surfaceOffsetM = 0.004;
	if (wall.widthM >= wall.depthM) {
		const offset = Math.max(0, wall.widthM / 2 - capM / 2);
		return [-offset, offset].map((xOffset) => ({
			...wall,
			centerXM: wall.centerXM + xOffset,
			depthM: wall.depthM + surfaceOffsetM * 2,
			heightM: Math.max(0.02, wall.heightM - 0.006),
			widthM: capM,
		}));
	}
	const offset = Math.max(0, wall.depthM / 2 - capM / 2);
	return [-offset, offset].map((zOffset) => ({
		...wall,
		centerZM: wall.centerZM + zOffset,
		depthM: capM,
		heightM: Math.max(0.02, wall.heightM - 0.006),
		widthM: wall.widthM + surfaceOffsetM * 2,
	}));
}

/**
 * Adds a narrow physical outline at every perpendicular wall contact. Equal
 * finish colours otherwise make a right-angle join read as one flat slab.
 * The post protrudes by a few millimetres beyond the wall envelopes, so its
 * silhouette remains visible from the user camera without changing PlanGraph
 * geometry or wall thickness.
 */
export function wallJointOutlineDrawsFor(
	walls: readonly SceneBox[],
): readonly SceneBox[] {
	const outlines: SceneBox[] = [];
	for (let firstIndex = 0; firstIndex < walls.length; firstIndex += 1) {
		const first = walls[firstIndex];
		if (!first || first.wallFootprintM) continue;
		for (
			let secondIndex = firstIndex + 1;
			secondIndex < walls.length;
			secondIndex += 1
		) {
			const second = walls[secondIndex];
			if (
				!second ||
				second.wallFootprintM ||
				isHorizontalWall(first) === isHorizontalWall(second)
			)
				continue;
			const horizontal = isHorizontalWall(first) ? first : second;
			const vertical = isHorizontalWall(first) ? second : first;
			const joinX = vertical.centerXM;
			const joinZ = horizontal.centerZM;
			if (
				!within(
					joinX,
					horizontal.centerXM - horizontal.widthM / 2,
					horizontal.centerXM + horizontal.widthM / 2,
				) ||
				!within(
					joinZ,
					vertical.centerZM - vertical.depthM / 2,
					vertical.centerZM + vertical.depthM / 2,
				)
			) {
				continue;
			}
			const thicknessM = Math.max(
				Math.min(horizontal.depthM, horizontal.widthM),
				Math.min(vertical.depthM, vertical.widthM),
			);
			outlines.push({
				centerXM: joinX,
				centerYM: Math.min(horizontal.centerYM, vertical.centerYM),
				centerZM: joinZ,
				depthM: thicknessM + 0.008,
				heightM: Math.max(horizontal.heightM, vertical.heightM),
				widthM: thicknessM + 0.008,
			});
		}
	}
	return outlines;
}

function isHorizontalWall(wall: SceneBox): boolean {
	return wall.widthM >= wall.depthM;
}

function within(value: number, first: number, second: number): boolean {
	return (
		value >= Math.min(first, second) - 1e-8 &&
		value <= Math.max(first, second) + 1e-8
	);
}

/**
 * A visual-only wall finish. The parts tile the projected wall's existing
 * envelope, so material detail cannot become a second source of geometry.
 */
export function wallFinishPartsFor(
	wall: SceneBox,
	exterior: boolean,
): readonly WallFinishPart[] {
	const trimHeightM = Math.min(wall.heightM * 0.36, 0.15);
	const baseboardHeightM = trimHeightM * 0.64;
	const upperWashHeightM = trimHeightM - baseboardHeightM;
	const plasterHeightM = wall.heightM - trimHeightM;
	const bottomYM = wall.centerYM - wall.heightM / 2;
	const surfaceTone = exterior ? "exterior" : "interior";

	return [
		wallFinishPart(
			"baseboard",
			{
				...wall,
				centerYM: bottomYM + baseboardHeightM / 2,
				heightM: baseboardHeightM,
			},
			"trim",
		),
		wallFinishPart(
			"plaster",
			{
				...wall,
				centerYM: bottomYM + baseboardHeightM + plasterHeightM / 2,
				heightM: plasterHeightM,
			},
			surfaceTone,
		),
		wallFinishPart(
			"upper-wash",
			{
				...wall,
				centerYM:
					bottomYM + baseboardHeightM + plasterHeightM + upperWashHeightM / 2,
				heightM: upperWashHeightM,
			},
			surfaceTone,
		),
	];
}

function drawWallFinish(
	wall: SceneBox,
	exterior: boolean,
	detailed: boolean,
	drawBox: DrawBox,
	camera: WebGl2Camera,
): void {
	wallFinishDrawsFor(wall, exterior, detailed).forEach((draw) => {
		drawBox(draw.box, draw.color, camera);
	});
}

/** Makes renderer-visible colour and draw-count decisions testable without a WebGL context. */
export function wallFinishDrawsFor(
	wall: SceneBox,
	exterior: boolean,
	detailed: boolean,
): readonly WallFinishDraw[] {
	if (!detailed) {
		return [
			{
				box: wall,
				color: colorForWallFinish(
					"plaster",
					exterior ? "exterior" : "interior",
				),
			},
		];
	}
	return wallFinishPartsFor(wall, exterior).map((part) => ({
		box: part.box,
		color: colorForWallFinish(part.role, part.tone),
	}));
}

function wallFinishPart(
	role: WallFinishRole,
	box: SceneBox,
	tone: WallFinishPart["tone"],
): WallFinishPart {
	return { box, role, tone };
}

function colorForWallFinish(
	role: WallFinishRole,
	tone: WallFinishPart["tone"],
): readonly [number, number, number, number] {
	if (role === "baseboard") {
		return THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.baseboard;
	}
	if (role === "upper-wash") {
		return THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.wallUpperWash;
	}
	return tone === "exterior"
		? THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.exteriorWall
		: THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.interiorWall;
}

export interface WoodFloorDraw {
	readonly box: SceneBox;
	readonly color: readonly [number, number, number, number];
}

const WOOD_BOARD_DEPTH_M = 0.32;

export function drawWoodFloor(
	floor: SceneBox,
	drawBox: DrawBox,
	camera: WebGl2Camera,
): void {
	woodFloorDrawsFor(floor).forEach((draw) => {
		drawBox(draw.box, draw.color, camera);
	});
}

/**
 * Uses world Z rather than an individual room tile's depth. This makes the
 * procedural default read as one continuous floor; a future Room surface
 * assignment can replace it without changing plan geometry.
 */
export function woodFloorDrawsFor(floor: SceneBox): readonly WoodFloorDraw[] {
	const minimumZM = floor.centerZM - floor.depthM / 2;
	const maximumZM = floor.centerZM + floor.depthM / 2;
	const firstBoard = Math.floor(minimumZM / WOOD_BOARD_DEPTH_M);
	const lastBoard = Math.ceil(maximumZM / WOOD_BOARD_DEPTH_M) - 1;
	const draws: WoodFloorDraw[] = [];
	for (let board = firstBoard; board <= lastBoard; board += 1) {
		const boardMinimumZM = board * WOOD_BOARD_DEPTH_M;
		const boardMaximumZM = boardMinimumZM + WOOD_BOARD_DEPTH_M;
		const clippedMinimumZM = Math.max(minimumZM, boardMinimumZM);
		const clippedMaximumZM = Math.min(maximumZM, boardMaximumZM);
		if (clippedMaximumZM <= clippedMinimumZM) {
			continue;
		}
		draws.push({
			box: {
				...floor,
				centerYM: floor.centerYM + floor.heightM / 2,
				centerZM: (clippedMinimumZM + clippedMaximumZM) / 2,
				depthM: clippedMaximumZM - clippedMinimumZM,
				heightM: floor.heightM,
			},
			color:
				board % 2 === 0
					? THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorDarkBoard
					: THREE_DIMENSIONAL_ROOM_SURFACE_COLORS.floorLightBoard,
		});
	}
	return draws;
}

function drawFurniture(
	item: SceneBox,
	detailed: boolean,
	drawBox: DrawBox,
	camera: WebGl2Camera,
): void {
	const color = colorFor(item.material?.colorHex);
	furnitureGreyboxPartsFor(item, detailed).forEach((part) => {
		drawBox(part.box, colorForFurnitureTone(color, part.tone), camera);
	});
}

/**
 * Maps a disposable item box to a small, fixed-cost collection of boxes. Every
 * part stays inside the canonical item's envelope; this is essential because
 * the renderer must never become a second geometry source.
 */
function colorForFurnitureTone(
	color: readonly [number, number, number, number],
	tone: FurnitureGreyboxPart["tone"],
): readonly [number, number, number, number] {
	if (tone === "highlight") {
		return lighten(color, 0.14);
	}
	if (tone === "shadow") {
		return darken(color, 0.12);
	}
	return color;
}

function isExteriorWall(wall: SceneBox): boolean {
	return wall.wall?.exteriorNormal !== undefined;
}

function colorFor(
	colorHex: string | undefined,
): readonly [number, number, number, number] {
	const match = /^#([0-9a-fA-F]{6})$/.exec(colorHex ?? "");
	if (!match) {
		return [0.18, 0.43, 0.62, 1];
	}
	const raw = Number.parseInt(match[1] ?? "000000", 16);
	return [(raw >> 16) / 255, ((raw >> 8) & 255) / 255, (raw & 255) / 255, 1];
}

function lighten(
	color: readonly [number, number, number, number],
	amount: number,
): readonly [number, number, number, number] {
	return [
		Math.min(1, color[0] + amount),
		Math.min(1, color[1] + amount),
		Math.min(1, color[2] + amount),
		color[3],
	];
}

function darken(
	color: readonly [number, number, number, number],
	amount: number,
): readonly [number, number, number, number] {
	return [
		Math.max(0, color[0] - amount),
		Math.max(0, color[1] - amount),
		Math.max(0, color[2] - amount),
		color[3],
	];
}

const initialWebGl2Camera: WebGl2Camera = {
	azimuthRadians: 0,
	distance: 2.1,
	elevationRadians: 1,
	panXM: 0,
	panZM: 0,
};

export function createWebGl2Program(
	context: WebGL2RenderingContext,
	vertexSource: string,
	fragmentSource: string,
): WebGLProgram {
	const vertexShader = compileShader(
		context,
		context.VERTEX_SHADER,
		vertexSource,
	);
	let fragmentShader: WebGLShader;
	try {
		fragmentShader = compileShader(
			context,
			context.FRAGMENT_SHADER,
			fragmentSource,
		);
	} catch (error) {
		context.deleteShader(vertexShader);
		throw error;
	}
	const program = context.createProgram();
	if (!program) {
		context.deleteShader(vertexShader);
		context.deleteShader(fragmentShader);
		throw new Error("Could not allocate a WebGL program");
	}
	context.attachShader(program, vertexShader);
	context.attachShader(program, fragmentShader);
	context.linkProgram(program);
	context.deleteShader(vertexShader);
	context.deleteShader(fragmentShader);
	if (!context.getProgramParameter(program, context.LINK_STATUS)) {
		context.deleteProgram(program);
		throw new Error("Could not link a WebGL program");
	}
	return program;
}

function compileShader(
	context: WebGL2RenderingContext,
	type: number,
	source: string,
): WebGLShader {
	const shader = context.createShader(type);
	if (!shader) {
		throw new Error("Could not allocate a WebGL shader");
	}
	context.shaderSource(shader, source);
	context.compileShader(shader);
	if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
		context.deleteShader(shader);
		throw new Error("Could not compile a WebGL shader");
	}
	return shader;
}

/**
 * Builds the WebGL model matrix for a scene box. The positive-Y right-handed
 * convention intentionally maps local +Z toward world +X as yaw increases.
 */
export function sceneBoxModelMatrix(box: SceneBox): Float32Array {
	const yawRadians = sceneBoxYawRadians(box);
	const cosine = Math.cos(yawRadians);
	const sine = Math.sin(yawRadians);
	return new Float32Array([
		cosine * box.widthM,
		0,
		-sine * box.widthM,
		0,
		0,
		box.heightM,
		0,
		0,
		sine * box.depthM,
		0,
		cosine * box.depthM,
		0,
		box.centerXM,
		box.centerYM,
		box.centerZM,
		1,
	]);
}

function perspective(
	fieldOfViewRadians: number,
	aspect: number,
	near: number,
	far: number,
): Float32Array {
	const scale = 1 / Math.tan(fieldOfViewRadians / 2);
	const range = 1 / (near - far);
	return new Float32Array([
		scale / aspect,
		0,
		0,
		0,
		0,
		scale,
		0,
		0,
		0,
		0,
		(near + far) * range,
		-1,
		0,
		0,
		2 * near * far * range,
		0,
	]);
}

function lookAt(
	eye: readonly [number, number, number],
	target: readonly [number, number, number],
	up: readonly [number, number, number],
): Float32Array {
	const forward = normalize(subtract(eye, target));
	const right = normalize(cross(up, forward));
	const correctedUp = cross(forward, right);
	return new Float32Array([
		right[0],
		correctedUp[0],
		forward[0],
		0,
		right[1],
		correctedUp[1],
		forward[1],
		0,
		right[2],
		correctedUp[2],
		forward[2],
		0,
		-dot(right, eye),
		-dot(correctedUp, eye),
		-dot(forward, eye),
		1,
	]);
}

function multiply(left: Float32Array, right: Float32Array): Float32Array {
	const result = new Float32Array(16);
	for (let column = 0; column < 4; column += 1) {
		for (let row = 0; row < 4; row += 1) {
			result[column * 4 + row] =
				left[row] * right[column * 4] +
				left[4 + row] * right[column * 4 + 1] +
				left[8 + row] * right[column * 4 + 2] +
				left[12 + row] * right[column * 4 + 3];
		}
	}
	return result;
}

function subtract(
	left: readonly [number, number, number],
	right: readonly [number, number, number],
): [number, number, number] {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function cross(
	left: readonly [number, number, number],
	right: readonly [number, number, number],
): [number, number, number] {
	return [
		left[1] * right[2] - left[2] * right[1],
		left[2] * right[0] - left[0] * right[2],
		left[0] * right[1] - left[1] * right[0],
	];
}

function dot(
	left: readonly [number, number, number],
	right: readonly [number, number, number],
): number {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function normalize(
	vector: readonly [number, number, number],
): [number, number, number] {
	const length = Math.hypot(vector[0], vector[1], vector[2]);
	return [vector[0] / length, vector[1] / length, vector[2] / length];
}
