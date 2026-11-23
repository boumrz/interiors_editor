import { createEditorInteractionGate, type EditorContactEpoch, type RegisterEditorTransientBoundary } from "./editor-host-boundary";
import {
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import type { FurnitureGreyboxKind, RectangularRoomWebGlScene } from "../adapters/renderer/rectangular-room-projection";
import {
	createDomWebGl2CanvasPort,
	createWebGl2RoomSceneRendererWithResizeOnChange,
	type WebGl2CutawayMode,
	type WebGl2RendererState,
	WebGl2RoomRendererController,
	type WebGl2RuntimeModels,
} from "../adapters/renderer/webgl2-room-renderer";
import {
	floorYawFieldsForRadians,
	rotationStepForYawRadians,
	yawRadiansFor,
} from "../domain/parametric-item";
import styles from "./AppShell.module.css";
import {
	type CustomGlbResource,
	CustomGlbRuntimeCache,
	rendererStructureKeyFor,
} from "./custom-glb-runtime-cache";
import {
	type CustomGlbRuntimeModel,
	loadCustomGlbRuntime,
} from "./custom-glb-runtime-loader";
import { SheetHeader } from "./SheetHeader";
import { FloorRotationAngleField, RotationModeToggle } from "./FloorRotationAngleField";
import rotationStyles from "./FloorRotationControls.module.css";
import { degreesForYawRadians, steppedYawRadians } from "./rotation-angle";
import { itemCountCopy } from "./item-count-copy";
import sceneStyles from "./RoomScene3d.module.css";
import {
	canvasPointForFloor,
	floorItemAtPoint,
	floorItemAtScreenPoint,
	floorPointForCanvas,
	projectedItemFootprintFor,
	type ThreeDimensionalFloorPoint,
	wallItemAtScreenPoint,
} from "./three-dimensional-floor-interaction";
import {
	beginRotationDomeGesture,
	moveRotationDomeGesture,
	type RotationDomeGesture,
	rotationDomeGestureHasChanged,
} from "./three-dimensional-rotation-gesture";
import {
	fitThreeDimensionalViewport,
	focusThreeDimensionalViewportOnSelectedItem,
	initialThreeDimensionalViewportForRoom,
	initialThreeDimensionalViewportForSelectedItem,
	orbitThreeDimensionalViewport,
	panThreeDimensionalViewport,
	type ThreeDimensionalViewport,
	zoomThreeDimensionalViewport,
} from "./three-dimensional-viewport";
import { disposeThreeObject3D } from "./three-resource-disposal";

interface RoomScene3dProps {
	readonly plainLabels?: boolean;
	readonly resizeDrawingBufferOnChangeOnly?: boolean;
	readonly registerTransientBoundary?: RegisterEditorTransientBoundary;
	readonly scene: RectangularRoomWebGlScene;
	/** Parent verification state prevents an absent in-flight IndexedDB read from masquerading as a failed resource. */
	readonly customGlbResourceStates?: Readonly<
		Record<string, "loading" | "ready" | "unavailable">
	>;
	/** Exact local bytes only; this component never fetches a model resource. */
	readonly customGlbResources?: Readonly<Record<string, CustomGlbResource>>;
	readonly selectedItemId?: string;
	readonly readOnly?: boolean;
	readonly itemPlacementControls?: ReactNode;
	readonly selectedItemControls?: ReactNode;
	readonly exactFloorYaw?: boolean;
	readonly rotationStepMode?: boolean;
	readonly onRotationStepModeChange?: (checked: boolean) => void;
	readonly initialItemPlacementPoint?: ThreeDimensionalFloorPoint;
	readonly onItemPlacementPointChange?: (point: ThreeDimensionalFloorPoint) => void;
	readonly snapFloorItemPoint?: (point: ThreeDimensionalFloorPoint, assetInstanceId?: string) => ThreeDimensionalFloorPoint;
	/** A locked selected item stays selectable while camera inspection remains available. */
	readonly canTransformSelectedItem?: boolean;
	readonly itemPlacementDraft?: {
		readonly color: string;
		readonly depthMm: number;
		readonly furnitureKind?: FurnitureGreyboxKind;
		readonly heightMm: number;
		readonly label: string;
		readonly widthMm: number;
		readonly yawRadians?: number;
	};
	readonly onItemPlacementYawChange?: (yawRadians: number) => void;
	readonly assessItemPlacement?: (input: {
		readonly xM: number;
		readonly zM: number;
	}) => boolean;
	readonly onCancelItemPlacement?: () => void;
	readonly onCloseItemPlacement?: () => void;
	readonly skipBlurCommit?: (target: HTMLInputElement) => boolean;
	/** Opens the same curated catalog as the 2D dock, without leaving 3D. */
	readonly onOpenItemCatalog?: (trigger: HTMLButtonElement) => void;
	readonly onPlaceItem?: (input: {
		readonly xM: number;
		readonly zM: number;
	}) => void | Promise<void>;
	readonly onMoveItem?: (input: {
		readonly assetInstanceId: string;
		readonly xM: number;
		readonly zM: number;
	}) => Promise<boolean>;
	readonly onRotateItem?: (input: {
		readonly assetInstanceId: string;
		readonly yawRadians: number;
	}) => Promise<boolean>;
	/** Blocks a waiting PWA update while a 3D interaction has no Durable Revision. */
	readonly onPwaUpdateSafetyChange?: (hasTransientEdit: boolean) => void;
	readonly onClearSelection?: () => void;
	/** Safe local view change after recovery exhausts transient renderer retries. */
	readonly onOpenPlan?: () => void;
	readonly onSelectItem?: (assetInstanceId: string) => void;
}

interface Point {
	readonly x: number;
	readonly y: number;
}

/** Pixel insets reserved by persistent mobile chrome, never Project geometry. */
interface SceneViewportInsets {
	readonly bottom: number;
	readonly top: number;
}

type RotationGesture = RotationDomeGesture & {
	readonly target: "item" | "placement";
	readonly placementKey?: string;
};

interface RotationPointerListeners {
	readonly down: (event: PointerEvent) => void;
	readonly cancel: (event: PointerEvent) => void;
	readonly move: (event: PointerEvent) => void;
	readonly up: (event: PointerEvent) => void;
}

const ROTATION_GIZMO_CENTER = 100;
const ROTATION_GIZMO_RADIUS = 73;
const ROTATION_GIZMO_SIZE = 200;
const ROTATION_DOME_HEIGHT = 128;

export type CustomGlbPresentation = "loading" | "rendered" | "unavailable";

/** A byte-verified GLB is visible only after its disposable decoder root exists. */
export function customGlbPresentationFor(input: {
	readonly resourceState: "loading" | "ready" | "unavailable" | undefined;
	readonly runtimeState?: "loading" | "ready" | "unavailable";
}): CustomGlbPresentation {
	if (
		input.resourceState === "unavailable" ||
		input.runtimeState === "unavailable"
	) {
		return "unavailable";
	}
	return input.resourceState === "ready" && input.runtimeState === "ready"
		? "rendered"
		: "loading";
}

/** A preview has no durable identity and must never look like active rotation. */
export function isThreeDimensionalRotationActive(
	rotationAssetInstanceId: string | undefined,
	selectedAssetInstanceId: string | undefined,
): boolean {
	return (
		rotationAssetInstanceId !== undefined &&
		selectedAssetInstanceId !== undefined &&
		rotationAssetInstanceId === selectedAssetInstanceId
	);
}

/** A PWA update may run only after every 3D item interaction has a Durable Revision. */
export function hasUndurableThreeDimensionalItemTransform(input: {
	readonly hasItemPreview: boolean;
	readonly hasPendingItemPreview: boolean;
	readonly hasRotation: boolean;
	readonly isConfirmingItemTransform: boolean;
}): boolean {
	return (
		input.hasItemPreview ||
		input.hasPendingItemPreview ||
		input.hasRotation ||
		input.isConfirmingItemTransform
	);
}

function statusCopy(state: WebGl2RendererState): string | undefined {
	switch (state.kind) {
		case "ready":
			return undefined;
		case "unavailable":
			return "WebGL2 недоступен. Точный 2D-план остаётся доступен.";
		case "failed":
			return "3D-сцена не инициализировалась. Данные проекта не изменены.";
		case "context-lost":
			return "Графический контекст потерян. Данные проекта не изменены.";
		case "retryable":
			return "3D готов к повторной инициализации.";
		case "two-dimensional-fallback":
			return "3D не удалось восстановить в облегчённом режиме. Точный 2D-план остаётся доступен; данные проекта не изменены.";
	}
}

/** Contains only renderer lifecycle/tier information, never Project content. */
export function rendererDiagnosticsCopy(state: WebGl2RendererState): string {
	switch (state.kind) {
		case "ready":
			return state.qualityTier === "reduced"
				? "Диагностика 3D: WebGL2 · облегчённое качество; геометрия и данные проекта не изменены."
				: "Диагностика 3D: WebGL2 · стандартное качество.";
		case "unavailable":
			return "Диагностика 3D: WebGL2 недоступен; точный Plan 2D остаётся доступен.";
		case "failed":
			return "Диагностика 3D: инициализация renderer не удалась; данные проекта не изменены.";
		case "context-lost":
			return "Диагностика 3D: графический контекст потерян; выполняется безопасное восстановление.";
		case "retryable":
			return "Диагностика 3D: renderer ожидает инициализации.";
		case "two-dimensional-fallback":
			return "Диагностика 3D: восстановление исчерпано; доступен точный Plan 2D.";
	}
}

function clampToBounds(value: number, lower: number, upper: number): number {
	return Math.max(lower, Math.min(upper, value));
}

function distance(first: Point, second: Point): number {
	return Math.hypot(first.x - second.x, first.y - second.y);
}

function centre(first: Point, second: Point): Point {
	return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function RoomScene3d({
	plainLabels = false,
	resizeDrawingBufferOnChangeOnly = false,
	registerTransientBoundary,
	scene,
	customGlbResourceStates = {},
	customGlbResources = {},
	selectedItemId,
	readOnly = false,
	canTransformSelectedItem = true,
	itemPlacementDraft,
	itemPlacementControls,
	selectedItemControls,
	exactFloorYaw = false,
	rotationStepMode = false,
	onRotationStepModeChange,
	initialItemPlacementPoint,
	onItemPlacementPointChange,
	snapFloorItemPoint,
	onItemPlacementYawChange,
	assessItemPlacement,
	onCancelItemPlacement,
	onCloseItemPlacement,
	skipBlurCommit,
	onOpenItemCatalog,
	onPlaceItem,
	onMoveItem,
	onRotateItem,
	onPwaUpdateSafetyChange,
	onClearSelection,
	onOpenPlan,
	onSelectItem,
}: RoomScene3dProps) {
	const scenePanelRef = useRef<HTMLElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const viewControlsRef = useRef<HTMLElement>(null);
	const placementMenuRef = useRef<HTMLElement>(null);
	const controllerRef = useRef<WebGl2RoomRendererController | undefined>(
		undefined,
	);
	const startedRendererKeyRef = useRef<string | undefined>(undefined);
	const hostGateRef = useRef(createEditorInteractionGate());
	const hostGateDisposed = useRef(false);
	const [, renderHostEpoch] = useState<EditorContactEpoch>(() => hostGateRef.current.capture());
	const hostEnabledRef = useRef(registerTransientBoundary !== undefined);
	hostEnabledRef.current = registerTransientBoundary !== undefined;
	const hostDraftState = useRef(false);
	const [hasRawAngleDraft, setHasRawAngleDraft] = useState(false);
	const [angleDraftEpoch, setAngleDraftEpoch] = useState(0);
	const hostContacts = useRef(new Map<number, {
		readonly epoch: EditorContactEpoch;
		readonly projection: string;
		readonly base: RectangularRoomWebGlScene;
		readonly selectedItemId: string | undefined;
		readonly placementKey: string | undefined;
	}>());
	const pointers = useRef(new Map<number, Point>());
	const rotationRef = useRef<RotationGesture | undefined>(undefined);
	const rotationFrameRef = useRef<number | undefined>(undefined);
	const rotationGizmoRef = useRef<SVGSVGElement>(null);
	const rotationBaseSceneRef = useRef<RectangularRoomWebGlScene | undefined>(
		undefined,
	);
	const placementKey = itemPlacementDraft
		? JSON.stringify([itemPlacementDraft.label, itemPlacementDraft.widthMm, itemPlacementDraft.depthMm, itemPlacementDraft.heightMm])
		: undefined;
	const hasPlacementYawControl = onItemPlacementYawChange !== undefined;
	const interactionContextRef = useRef({
		scene,
		selectedItemId,
		readOnly,
		canTransformSelectedItem,
		placementKey,
		onItemPlacementYawChange,
	});
	interactionContextRef.current = {
		scene,
		selectedItemId,
		readOnly,
		canTransformSelectedItem,
		placementKey,
		onItemPlacementYawChange,
	};
	const restorePlacementRotationYaw = useCallback(() => {
		const active = rotationRef.current;
		const current = interactionContextRef.current;
		if (active?.target === "placement" && active.placementKey === current.placementKey && current.scene === rotationBaseSceneRef.current) {
			current.onItemPlacementYawChange?.(active.initialYawRadians);
		}
	}, []);
	const hasUserCameraViewRef = useRef(false);
	const [hasUserCameraView, setHasUserCameraView] = useState(false);
	const fittedCameraLayoutRef = useRef<string | undefined>(undefined);
	const rotationPointerListenersRef = useRef<
		RotationPointerListeners | undefined
	>(undefined);
	const pendingRotationRef = useRef<RotationGesture | undefined>(undefined);
	const customGlbRuntimeCacheRef = useRef(
		new CustomGlbRuntimeCache<CustomGlbRuntimeModel>(),
	);
	const customGlbRuntimeResourceHashesRef = useRef<
		Readonly<Record<string, string>>
	>({});
	const gesture = useRef<
		| {
				readonly camera: ThreeDimensionalViewport;
				readonly kind: "orbit";
				readonly point: Point;
		  }
		| {
				readonly camera: ThreeDimensionalViewport;
				readonly centre: Point;
				readonly distance: number;
				readonly kind: "pinch";
		  }
		| {
				readonly assetInstanceId: string;
				readonly floorPoint: ThreeDimensionalFloorPoint;
				readonly kind: "move-item";
				readonly moved: boolean;
				readonly pointerId: number;
		  }
		| { readonly kind: "place-item"; readonly pointerId: number }
		| undefined
	>(undefined);
	const [state, setState] = useState<WebGl2RendererState>({
		kind: "retryable",
	});
	const rendererReadyRef = useRef(false);
	rendererReadyRef.current = state.kind === "ready";
	const rendererReady = state.kind === "ready";
	const initialViewportForCurrentScene = (): ThreeDimensionalViewport => {
		const roomViewport = initialThreeDimensionalViewportForRoom(scene);
		if (plainLabels) return roomViewport;
		return initialThreeDimensionalViewportForSelectedItem(
			scene.cameraBounds,
			selectedItemId === undefined
				? undefined
				: scene.items.find((item) => item.assetInstanceId === selectedItemId),
			roomViewport,
		);
	};
	const [camera, setCamera] = useState<ThreeDimensionalViewport>(
		initialViewportForCurrentScene,
	);
	const cameraRef = useRef(camera);
	cameraRef.current = camera;
	const [cutawayMode, setCutawayMode] = useState<WebGl2CutawayMode>("auto");
	const [canvasSize, setCanvasSize] = useState<Point>({ x: 0, y: 0 });
	const drawingBufferSize = resizeDrawingBufferOnChangeOnly ? canvasSize : undefined;
	const [sceneViewportInsets, setSceneViewportInsets] =
		useState<SceneViewportInsets>({ bottom: 0, top: 0 });
	const [placementSurface, setPlacementSurface] = useState({ headerBottom: 0, menuTop: 0 });
	const isItemPlacementActive = itemPlacementDraft !== undefined;
	const markUserCameraView = () => {
		if (!hasUserCameraViewRef.current) setHasUserCameraView(true);
		hasUserCameraViewRef.current = true;
	};
	const resetOverview = () => {
		hasUserCameraViewRef.current = false;
		setHasUserCameraView(false);
		setCamera(
			fitThreeDimensionalViewport(
				initialThreeDimensionalViewportForRoom(scene),
				scene,
				{
					height: canvasSize.y,
					width: canvasSize.x,
				},
			),
		);
	};
	const [customGlbRuntimeModels, setCustomGlbRuntimeModels] =
		useState<WebGl2RuntimeModels>({});
	const [customGlbRuntimeStates, setCustomGlbRuntimeStates] = useState<
		Readonly<Record<string, "loading" | "ready" | "unavailable">>
	>({});
	const [customGlbRuntimeRetryEpoch, setCustomGlbRuntimeRetryEpoch] =
		useState(0);
	const [rotation, setRotation] = useState<RotationGesture | undefined>(
		undefined,
	);
	const [itemPreview, setItemPreview] = useState<
		| {
				readonly assetInstanceId: string;
				readonly kind: "move" | "rotation";
				readonly xM?: number;
				readonly yawRadians?: number;
				readonly zM?: number;
		  }
		| undefined
	>(undefined);
	const hostRetainedItemPreview = useRef<typeof itemPreview>(undefined);
	// Keep the released pose painted while the automatic mutation reaches a
	// Durable Revision. This is deliberately not a user-confirmation draft.
	const [submittedItemPreview, setSubmittedItemPreview] = useState<
		| {
				readonly assetInstanceId: string;
				readonly kind: "move" | "rotation";
				readonly xM?: number;
				readonly yawRadians?: number;
				readonly zM?: number;
		  }
		| undefined
	>(undefined);
	const [isConfirmingItemTransform, setIsConfirmingItemTransform] =
		useState(false);
	const hasTransientItemTransform = hasRawAngleDraft || hasUndurableThreeDimensionalItemTransform({
		hasItemPreview: itemPreview !== undefined,
		hasPendingItemPreview: submittedItemPreview !== undefined,
		hasRotation: rotation !== undefined,
		isConfirmingItemTransform,
	});

	useEffect(() => {
		onPwaUpdateSafetyChange?.(hasTransientItemTransform);
		return () => onPwaUpdateSafetyChange?.(false);
	}, [hasTransientItemTransform, onPwaUpdateSafetyChange]);
	const sceneRef = useRef(scene);
	const [itemPlacementPoint, setItemPlacementPoint] = useState(initialItemPlacementPoint);
	const [placementPointFromGesture, setPlacementPointFromGesture] = useState(false);
	const rotationTrackHeight = plainLabels ? ROTATION_GIZMO_SIZE : ROTATION_DOME_HEIGHT;
	const rotationTrackPath = plainLabels
		? "M27 100 A73 73 0 1 1 173 100 A73 73 0 1 1 27 100"
		: "M27 100 A73 73 0 0 1 173 100";
	hostDraftState.current = hasRawAngleDraft || itemPreview !== undefined || submittedItemPreview !== undefined || itemPlacementDraft !== undefined || itemPlacementPoint !== undefined;
	useLayoutEffect(() => {
		if (hostGateDisposed.current) {
			hostGateRef.current = createEditorInteractionGate();
			hostGateDisposed.current = false;
		}
		return () => { hostGateRef.current.dispose(); hostGateDisposed.current = true; hostContacts.current.clear(); };
	}, []);
	const customGlbDefinitionIds = useMemo(
		() =>
			[
				...new Set(
					scene.items
						.map((item) => item.assetDefinitionId)
						.filter(
							(assetDefinitionId): assetDefinitionId is string =>
								assetDefinitionId !== undefined &&
								(customGlbResourceStates[assetDefinitionId] !== undefined ||
									customGlbResources[assetDefinitionId] !== undefined),
						),
				),
			].sort(),
		[customGlbResourceStates, customGlbResources, scene.items],
	);
	const customGlbRuntimeRequests = useMemo(
		() =>
			customGlbDefinitionIds.flatMap((assetDefinitionId) => {
				const resource = customGlbResources[assetDefinitionId];
				return resource &&
					customGlbResourceStates[assetDefinitionId] === "ready"
					? [{ assetDefinitionId, resource }]
					: [];
			}),
		[customGlbDefinitionIds, customGlbResourceStates, customGlbResources],
	);
	const customGlbRuntimePlanKey = useMemo(
		() =>
			JSON.stringify({
				definitions: customGlbDefinitionIds.map((assetDefinitionId) => ({
					assetDefinitionId,
					resourceHash:
						customGlbResources[assetDefinitionId]?.resourceHash ?? null,
					resourceState: customGlbResourceStates[assetDefinitionId] ?? null,
				})),
				retryEpoch: customGlbRuntimeRetryEpoch,
			}),
		[
			customGlbDefinitionIds,
			customGlbResourceStates,
			customGlbResources,
			customGlbRuntimeRetryEpoch,
		],
	);
	const customGlbRuntimePlan = {
		definitionIds: customGlbDefinitionIds,
		requests: customGlbRuntimeRequests,
		resourceStates: customGlbResourceStates,
	};
	const customGlbRuntimePlanRef = useRef(customGlbRuntimePlan);
	customGlbRuntimePlanRef.current = customGlbRuntimePlan;

	useEffect(() => {
		let cancelled = false;
		// The semantic resource key is the loader lifecycle boundary. The ref
		// supplies its matching latest snapshot without treating a pose-only
		// scene projection as a new GLB decode request.
		void customGlbRuntimePlanKey;
		const { definitionIds, requests, resourceStates } =
			customGlbRuntimePlanRef.current;
		const resourceHashesByDefinitionId = Object.fromEntries(
			requests.map(({ assetDefinitionId, resource }) => [
				assetDefinitionId,
				resource.resourceHash,
			]),
		);
		const previousResourceHashes = customGlbRuntimeResourceHashesRef.current;
		const retainedDefinitionIds = new Set(
			Object.entries(resourceHashesByDefinitionId).flatMap(
				([assetDefinitionId, resourceHash]) =>
					previousResourceHashes[assetDefinitionId] === resourceHash
						? [assetDefinitionId]
						: [],
			),
		);
		customGlbRuntimeResourceHashesRef.current = resourceHashesByDefinitionId;
		void customGlbRuntimeCacheRef.current.evictExcept(
			new Set(requests.map(({ resource }) => resource.resourceHash)),
			(runtime) => disposeThreeObject3D(runtime.root),
		);
		setCustomGlbRuntimeModels((current) =>
			Object.fromEntries(
				Object.entries(current).filter(([assetDefinitionId]) =>
					retainedDefinitionIds.has(assetDefinitionId),
				),
			),
		);
		setCustomGlbRuntimeStates((current) =>
			Object.fromEntries(
				definitionIds.map((assetDefinitionId) => [
					assetDefinitionId,
					resourceStates[assetDefinitionId] === "unavailable"
						? "unavailable"
						: retainedDefinitionIds.has(assetDefinitionId) &&
								current[assetDefinitionId] === "ready"
							? "ready"
							: "loading",
				]),
			),
		);
		for (const { assetDefinitionId, resource } of requests) {
			void (async () => {
				let runtime: Awaited<
					ReturnType<CustomGlbRuntimeCache<CustomGlbRuntimeModel>["load"]>
				>;
				try {
					runtime = await customGlbRuntimeCacheRef.current.load(
						assetDefinitionId,
						resource,
						loadCustomGlbRuntime,
					);
				} catch {
					runtime = undefined;
				}
				if (cancelled) return;
				if (!runtime) {
					setCustomGlbRuntimeModels((current) => {
						if (current[assetDefinitionId] === undefined) return current;
						const next = { ...current };
						delete next[assetDefinitionId];
						return next;
					});
					setCustomGlbRuntimeStates((current) => ({
						...current,
						[assetDefinitionId]: "unavailable",
					}));
					return;
				}
				setCustomGlbRuntimeModels((current) => ({
					...current,
					[assetDefinitionId]: runtime.root,
				}));
				setCustomGlbRuntimeStates((current) => ({
					...current,
					[assetDefinitionId]: "ready",
				}));
			})();
		}
		return () => {
			cancelled = true;
		};
	}, [customGlbRuntimePlanKey]);

	useEffect(
		() => () => {
			void customGlbRuntimeCacheRef.current.dispose((runtime) =>
				disposeThreeObject3D(runtime.root),
			);
		},
		[],
	);

	const customGlbPresentations = customGlbDefinitionIds.map(
		(assetDefinitionId) =>
			customGlbPresentationFor({
				resourceState: customGlbResourceStates[assetDefinitionId],
				runtimeState: customGlbRuntimeStates[assetDefinitionId],
			}),
	);
	const customGlbRuntimeUnavailableDefinitionIds =
		customGlbDefinitionIds.filter(
			(_, index) => customGlbPresentations[index] === "unavailable",
		);
	const customGlbRuntimeStatus =
		customGlbDefinitionIds.length === 0
			? "none"
			: customGlbRuntimeUnavailableDefinitionIds.length > 0
				? `unavailable:${customGlbRuntimeUnavailableDefinitionIds.length}`
				: customGlbPresentations.some(
							(presentation) => presentation === "loading",
						)
					? `loading:${customGlbDefinitionIds.length}`
					: `rendered:${customGlbDefinitionIds.length}`;

	// A durable project revision reaches this component asynchronously. Keep the
	// last released pose on screen between pointerup and that revision, so the
	// object never flashes back while its automatic save is in flight.
	const visualItemPreview = itemPreview ?? submittedItemPreview;

	const threeDimensionalItemPlacementPreview = useMemo(() => {
		if (!itemPlacementDraft || !itemPlacementPoint) return undefined;
		const point = placementPointFromGesture
			? snapFloorItemPoint?.(itemPlacementPoint) ?? itemPlacementPoint
			: itemPlacementPoint;
		return {
			...point,
			...itemPlacementDraft,
			isValid: assessItemPlacement?.(point) ?? false,
		};
	}, [assessItemPlacement, itemPlacementDraft, itemPlacementPoint, placementPointFromGesture, snapFloorItemPoint]);
	const placementXM = threeDimensionalItemPlacementPreview?.xM;
	const placementZM = threeDimensionalItemPlacementPreview?.zM;
	useLayoutEffect(() => {
		if (placementXM !== undefined && placementZM !== undefined)
			onItemPlacementPointChange?.({ xM: placementXM, zM: placementZM });
	}, [onItemPlacementPointChange, placementXM, placementZM]);
	const itemPlacementState = !threeDimensionalItemPlacementPreview
		? "choose-point"
		: threeDimensionalItemPlacementPreview.isValid
			? "ready"
			: "choose-another-point";

	const renderedScene = useMemo(() => {
		const renderedItems = scene.items.map((item) =>
			visualItemPreview &&
			item.assetInstanceId === visualItemPreview.assetInstanceId
				? {
						...item,
						...(visualItemPreview.xM === undefined
							? {}
							: { centerXM: visualItemPreview.xM }),
						...(visualItemPreview.zM === undefined
							? {}
							: { centerZM: visualItemPreview.zM }),
						...(visualItemPreview.yawRadians === undefined
							? {}
							: { yawRadians: visualItemPreview.yawRadians }),
					}
				: item,
		);
		const preview = threeDimensionalItemPlacementPreview;
		return {
			...scene,
			items: preview
				? [
						...renderedItems,
						{
							centerXM: preview.xM,
							centerYM: preview.heightMm / 2000,
							centerZM: preview.zM,
							depthM: preview.depthMm / 1000,
							heightM: preview.heightMm / 1000,
							material: {
								colorHex: preview.isValid ? preview.color : "#b32d2d",
									furnitureKind: preview.furnitureKind ?? "generic" as const,
									...(preview.furnitureKind === undefined ? {} : { refreshGreyboxAppearance: true as const }),
							},
							widthM: preview.widthMm / 1000,
							yawRadians: preview.yawRadians ?? 0,
						},
					]
				: renderedItems,
		};
	}, [scene, threeDimensionalItemPlacementPreview, visualItemPreview]);
	const renderedSceneRef = useRef(renderedScene);
	renderedSceneRef.current = renderedScene;
	const rendererStructureKey = rendererStructureKeyFor(scene);
	const rendererStartKey = resizeDrawingBufferOnChangeOnly
		? `resize-buffer-on-change:${rendererStructureKey}`
		: rendererStructureKey;

	const renderedCamera = camera;
	const renderedCutawayMode: WebGl2CutawayMode = cutawayMode;

	useEffect(() => {
		if (!submittedItemPreview) return;
		const durableItem = scene.items.find(
			(item) => item.assetInstanceId === submittedItemPreview.assetInstanceId,
		);
		const isConfirmed =
			durableItem &&
			(submittedItemPreview.kind === "move"
				? durableItem.centerXM === submittedItemPreview.xM &&
					durableItem.centerZM === submittedItemPreview.zM
				: durableItem.yawRadians === submittedItemPreview.yawRadians);
		if (isConfirmed) {
			setSubmittedItemPreview(undefined);
		}
	}, [scene, submittedItemPreview]);

	useEffect(() => {
		if (sceneRef.current === scene) return;
		sceneRef.current = scene;
		hostRetainedItemPreview.current = undefined;
		setItemPreview(undefined);
		setSubmittedItemPreview(undefined);
		setIsConfirmingItemTransform(false);
	}, [scene]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return undefined;
		}
		const controller = new WebGl2RoomRendererController(
			createDomWebGl2CanvasPort(canvas),
			resizeDrawingBufferOnChangeOnly
				? createWebGl2RoomSceneRendererWithResizeOnChange
				: undefined,
			(nextState) => {
				rendererReadyRef.current = nextState.kind === "ready";
				setState(nextState);
			},
		);
		controllerRef.current = controller;
		return () => {
			controller.dispose();
			if (controllerRef.current === controller) {
				controllerRef.current = undefined;
				// React StrictMode recreates the disposable WebGL controller in
				// development. Its replacement must start even when the Project
				// scene structure is unchanged (an empty room).
				startedRendererKeyRef.current = undefined;
				rendererReadyRef.current = false;
			}
		};
	}, [resizeDrawingBufferOnChangeOnly]);

	useLayoutEffect(() => {
		// Telegram controls overlay one render surface across all editing states.
		if (plainLabels) return undefined;
		const panel = scenePanelRef.current;
		if (!panel || typeof window === "undefined") return undefined;
		const workspace = panel.closest('[data-testid="editor-workspace"]');
		const header = workspace?.querySelector<HTMLElement>(
			'[data-testid="editor-top-bar"]',
		);
		const deck = viewControlsRef.current;
		const resetInsets = () =>
			setSceneViewportInsets((current) =>
				current.top === 0 && current.bottom === 0
					? current
					: { bottom: 0, top: 0 },
			);
		if (!header || !deck) {
			resetInsets();
			return undefined;
		}
		const updateInsets = () => {
			const isPhone = window.matchMedia?.("(max-width: 559px)").matches;
			if (!isPhone || isItemPlacementActive) {
				resetInsets();
				return;
			}
			const panelBox = panel.getBoundingClientRect();
			const headerBox = header.getBoundingClientRect();
			const deckBox = deck.getBoundingClientRect();
			if (panelBox.width <= 0 || panelBox.height <= 0) {
				resetInsets();
				return;
			}
			const top = Math.max(
				0,
				Math.min(panelBox.height, headerBox.bottom - panelBox.top),
			);
			const bottom = Math.max(
				0,
				Math.min(panelBox.height - top, panelBox.bottom - deckBox.top),
			);
			setSceneViewportInsets((current) =>
				current.top === top && current.bottom === bottom
					? current
					: { bottom, top },
			);
		};

		updateInsets();
		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateInsets);
			return () => window.removeEventListener("resize", updateInsets);
		}
		const observer = new ResizeObserver(updateInsets);
		observer.observe(panel);
		observer.observe(header, { box: "border-box" });
		observer.observe(deck);
		window.addEventListener("resize", updateInsets);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateInsets);
		};
	}, [isItemPlacementActive, plainLabels]);

	useLayoutEffect(() => {
		if (!isItemPlacementActive) return;
		const panel = scenePanelRef.current;
		const menu = placementMenuRef.current;
		const header = panel?.closest('[data-testid="editor-workspace"]')?.querySelector('[data-testid="editor-top-bar"]');
		if (!panel || !menu || !header) return;
		const update = () => {
			const canvasTop = canvasRef.current?.getBoundingClientRect().top ?? panel.getBoundingClientRect().top;
			const headerBottom = Math.max(0, header.getBoundingClientRect().bottom - canvasTop);
			const menuTop = menu.getBoundingClientRect().top - canvasTop;
			setPlacementSurface((previous) => previous.headerBottom === headerBottom && previous.menuTop === menuTop ? previous : { headerBottom, menuTop });
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(header, { box: "border-box" });
		observer.observe(menu);
		observer.observe(panel);
		window.addEventListener("resize", update);
		return () => { observer.disconnect(); window.removeEventListener("resize", update); };
	}, [isItemPlacementActive]);

	useEffect(() => {
		if (
			hasUserCameraViewRef.current ||
			canvasSize.x <= 0 ||
			canvasSize.y <= 0
		) {
			return;
		}
		const fitSignature = [
			scene.cameraBounds.widthM,
			scene.cameraBounds.depthM,
			scene.dimensions.heightMm,
			canvasSize.x,
			canvasSize.y,
		].join(":");
		if (fittedCameraLayoutRef.current === fitSignature) return;
		fittedCameraLayoutRef.current = fitSignature;
		setCamera((previous) => {
			const fitted = fitThreeDimensionalViewport(previous, scene, {
				height: canvasSize.y,
				width: canvasSize.x,
			});
			if (plainLabels) return fitted;
			const selectedFloorItem =
				selectedItemId === undefined
					? undefined
					: scene.items.find(
							(item) =>
								item.assetInstanceId === selectedItemId &&
								item.assetAnchor !== "wall",
						);
			return focusThreeDimensionalViewportOnSelectedItem(
				fitted,
				scene.cameraBounds,
				selectedFloorItem,
			);
		});
	}, [canvasSize.x, canvasSize.y, plainLabels, scene, selectedItemId]);

	useEffect(() => {
		const controller = controllerRef.current;
		if (!controller) return;
		if (startedRendererKeyRef.current === rendererStartKey) return;
		startedRendererKeyRef.current = rendererStartKey;
		setState(
			controller.start(
				renderedSceneRef.current,
				"standard",
				"NONE",
				customGlbRuntimeModels,
			),
		);
	}, [customGlbRuntimeModels, rendererStartKey]);

	useEffect(() => {
		controllerRef.current?.updateRuntimeModels(customGlbRuntimeModels);
	}, [customGlbRuntimeModels]);

	useEffect(() => {
		const controller = controllerRef.current;
		if (!controller) return;
		controller.updateScene(renderedScene);
		if (drawingBufferSize && (drawingBufferSize.x <= 0 || drawingBufferSize.y <= 0)) return;
		if (state.kind !== "ready") return;
		controller.render(renderedCamera, renderedCutawayMode, renderedScene);
	}, [drawingBufferSize, renderedCamera, renderedCutawayMode, renderedScene, state.kind]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;
		const updateSize = () =>
			setCanvasSize({ x: canvas.clientWidth, y: canvas.clientHeight });
		updateSize();
		const observer = new ResizeObserver(updateSize);
		observer.observe(canvas);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (rendererReady) return;
		if (hostEnabledRef.current) { hostActions.current.invalidateHostContacts(); return; }
		restorePlacementRotationYaw();
		pointers.current.clear();
		gesture.current = undefined;
		rotationRef.current = undefined;
		pendingRotationRef.current = undefined;
		if (rotationFrameRef.current !== undefined) {
			cancelAnimationFrame(rotationFrameRef.current);
			rotationFrameRef.current = undefined;
		}
		const listeners = rotationPointerListenersRef.current;
		if (listeners) {
			window.removeEventListener("pointerdown", listeners.down, true);
			window.removeEventListener("pointermove", listeners.move);
			window.removeEventListener("pointerup", listeners.up);
			window.removeEventListener("pointercancel", listeners.cancel);
			rotationPointerListenersRef.current = undefined;
		}
		setItemPreview(undefined);
		setSubmittedItemPreview(undefined);
		setItemPlacementPoint(undefined);
		setRotation(undefined);
	}, [rendererReady, restorePlacementRotationYaw]);

	useEffect(
		() => () => {
			if (!hostEnabledRef.current) restorePlacementRotationYaw();
			if (rotationFrameRef.current !== undefined) {
				cancelAnimationFrame(rotationFrameRef.current);
			}
			const listeners = rotationPointerListenersRef.current;
			if (listeners) {
				window.removeEventListener("pointerdown", listeners.down, true);
				window.removeEventListener("pointermove", listeners.move);
				window.removeEventListener("pointerup", listeners.up);
				window.removeEventListener("pointercancel", listeners.cancel);
			}
		},
		[restorePlacementRotationYaw],
	);

	const retry = () => {
		const controller = controllerRef.current;
		if (controller) {
			setState(controller.retry(renderedSceneRef.current));
		}
	};

	const retryCustomGlbRuntime = () => {
		void customGlbRuntimeCacheRef.current.evictExcept(new Set(), (runtime) =>
			disposeThreeObject3D(runtime.root),
		);
		setCustomGlbRuntimeRetryEpoch((epoch) => epoch + 1);
	};

	const canvasPoint = (
		event: Pick<ReactPointerEvent<HTMLElement>, "clientX" | "clientY">,
	): Point | undefined => {
		const box = canvasRef.current?.getBoundingClientRect();
		return box
			? { x: event.clientX - box.left, y: event.clientY - box.top }
			: undefined;
	};

	// Pointer interactions must use the live layout measurement. ResizeObserver
	// can legitimately deliver after the first paint, while a user may already
	// start a drag on the freshly opened 3D view.
	const interactionCanvasSize = (): {
		readonly height: number;
		readonly width: number;
	} => {
		const box = canvasRef.current?.getBoundingClientRect();
		return box && box.width > 0 && box.height > 0
			? { height: box.height, width: box.width }
			: { height: canvasSize.y, width: canvasSize.x };
	};

	function retainedHostItemTransform(): typeof itemPreview {
		if (!hostEnabledRef.current) return undefined;
		if (hostRetainedItemPreview.current) return hostRetainedItemPreview.current;
		if (itemPreview && (itemPreview.kind === "move" ? gesture.current?.kind !== "move-item" : rotationRef.current === undefined)) return itemPreview;
		return undefined;
	}
	function allowsHostItemTransform(kind: "move" | "rotation", assetInstanceId: string | undefined): boolean {
		const retained = retainedHostItemTransform();
		return !retained || (retained.kind === kind && retained.assetInstanceId === assetInstanceId);
	}
	function hostProjectionKey(): string | undefined {
		const box = canvasRef.current?.getBoundingClientRect();
		if (!box || box.width <= 0 || box.height <= 0) return undefined;
		const current = cameraRef.current;
		return JSON.stringify([box.left, box.top, box.width, box.height,
			current.azimuthRadians, current.elevationRadians, current.distance, current.panXM, current.panZM]);
	}
	function captureHostContact(pointerId: number): boolean {
		if (!hostEnabledRef.current) return true;
		const projection = hostProjectionKey();
		if (!hostGateRef.current.canBegin() || !rendererReadyRef.current || projection === undefined) return false;
		const current = interactionContextRef.current;
		hostContacts.current.set(pointerId, { epoch: hostGateRef.current.capture(), projection,
			base: current.scene, selectedItemId: current.selectedItemId, placementKey: current.placementKey });
		return true;
	}
	function isHostContactCurrent(pointerId: number, rotationContact = false): boolean {
		if (!hostEnabledRef.current) return true;
		const contact = hostContacts.current.get(pointerId);
		if (!contact) return false;
		const current = interactionContextRef.current;
		const semantic = rotationContact || gesture.current?.kind === "move-item" || gesture.current?.kind === "place-item";
		if (!hostGateRef.current.isCurrent(contact.epoch) || contact.base !== current.scene ||
			(semantic && (!rendererReadyRef.current || contact.projection !== hostProjectionKey() || contact.selectedItemId !== current.selectedItemId || contact.placementKey !== current.placementKey))) {
			invalidateHostContacts();
			return false;
		}
		return true;
	}
	const applyRotationPreview = (nextRotation: RotationGesture) => {
		setRotation(nextRotation);
		if (nextRotation.target === "placement") {
			interactionContextRef.current.onItemPlacementYawChange?.(nextRotation.yawRadians);
			return;
		}
		setItemPreview({ assetInstanceId: nextRotation.assetInstanceId, kind: "rotation", yawRadians: nextRotation.yawRadians });
	};

	const publishRotationPreview = (nextRotation: RotationGesture) => {
		rotationRef.current = nextRotation;
		pendingRotationRef.current = nextRotation;
		if (rotationFrameRef.current !== undefined) return;
		const epoch = hostGateRef.current.capture();
		rotationFrameRef.current = requestAnimationFrame(() => {
			if (hostEnabledRef.current && !hostGateRef.current.isCurrent(epoch)) return;
			rotationFrameRef.current = undefined;
			const pendingRotation = pendingRotationRef.current;
			pendingRotationRef.current = undefined;
			if (!pendingRotation) return;
			applyRotationPreview(pendingRotation);
		});
	};

	const flushRotationPreview = () => {
		if (rotationFrameRef.current !== undefined) {
			cancelAnimationFrame(rotationFrameRef.current);
			rotationFrameRef.current = undefined;
		}
		const pendingRotation = pendingRotationRef.current;
		pendingRotationRef.current = undefined;
		if (!pendingRotation) return;
		applyRotationPreview(pendingRotation);
	};

	const clearRotationPointerListeners = useCallback(() => {
		const listeners = rotationPointerListenersRef.current;
		if (!listeners) return;
		window.removeEventListener("pointerdown", listeners.down, true);
		window.removeEventListener("pointermove", listeners.move);
		window.removeEventListener("pointerup", listeners.up);
		window.removeEventListener("pointercancel", listeners.cancel);
		rotationPointerListenersRef.current = undefined;
	}, []);

	const abandonRotationPreview = useCallback(() => {
		hostRetainedItemPreview.current = undefined;
		restorePlacementRotationYaw();
		if (rotationFrameRef.current !== undefined)
			cancelAnimationFrame(rotationFrameRef.current);
		rotationFrameRef.current = undefined;
		pendingRotationRef.current = undefined;
		rotationRef.current = undefined;
		rotationBaseSceneRef.current = undefined;
		setItemPreview(undefined);
		setRotation(undefined);
	}, [restorePlacementRotationYaw]);

	const rotationStillAllowed = (active: RotationGesture) => {
		const current = interactionContextRef.current;
		return (
			rendererReadyRef.current &&
			!current.readOnly &&
			(active.target === "placement"
				? active.placementKey === current.placementKey && current.onItemPlacementYawChange !== undefined
				: current.canTransformSelectedItem && current.selectedItemId === active.assetInstanceId) &&
			current.scene === rotationBaseSceneRef.current
		);
	};

	const rotationCentre = (bounds: DOMRect): Point => ({
		x:
			bounds.left +
			(bounds.width * ROTATION_GIZMO_CENTER) / ROTATION_GIZMO_SIZE,
		y:
			bounds.top +
			(bounds.height * ROTATION_GIZMO_CENTER) / rotationTrackHeight,
	});

	const updateRotationFromClientPoint = (pointerId: number, point: Point) => {
		if (!isHostContactCurrent(pointerId, true)) return;
		const activeRotation = rotationRef.current;
		const gizmoBounds = rotationGizmoRef.current?.getBoundingClientRect();
		if (
			!activeRotation ||
			activeRotation.pointerId !== pointerId ||
			!gizmoBounds
		)
			return;
		if (!rotationStillAllowed(activeRotation)) {
			abandonRotationPreview();
			clearRotationPointerListeners();
			pointers.current.clear();
			gesture.current = undefined;
			return;
		}
		const nextRotation: RotationGesture = { ...moveRotationDomeGesture(
			activeRotation,
			point,
			rotationCentre(gizmoBounds),
		), target: activeRotation.target, placementKey: activeRotation.placementKey };
		publishRotationPreview(nextRotation);
	};

	const persistItemTransform = async (transform: {
		readonly assetInstanceId: string;
		readonly kind: "move" | "rotation";
		readonly xM?: number;
		readonly yawRadians?: number;
		readonly zM?: number;
	}) => {
		if (readOnly || isConfirmingItemTransform) return;
		const perform = async () => {
		setIsConfirmingItemTransform(true);
		try {
			const accepted =
				transform.kind === "move"
					? await onMoveItem?.({
							assetInstanceId: transform.assetInstanceId,
							xM: transform.xM ?? 0,
							zM: transform.zM ?? 0,
						})
					: await onRotateItem?.({
							assetInstanceId: transform.assetInstanceId,
							yawRadians: transform.yawRadians ?? 0,
						});
			if (!accepted) setSubmittedItemPreview(undefined);
		} finally {
			setIsConfirmingItemTransform(false);
		}
		};
		if (!hostEnabledRef.current) return perform();
		if (!hostGateRef.current.canBegin()) return;
		return hostGateRef.current.run(perform);
	};

	const finishRotation = (pointerId: number, cancelled = false) => {
		if (!isHostContactCurrent(pointerId, true)) return;
		hostContacts.current.delete(pointerId);
		const activeRotation = rotationRef.current;
		if (!activeRotation || activeRotation.pointerId !== pointerId) return;
		pointers.current.delete(pointerId);
		if (cancelled || !rotationStillAllowed(activeRotation)) {
			abandonRotationPreview();
			pointers.current.clear();
			gesture.current = undefined;
			clearRotationPointerListeners();
			return;
		}
		flushRotationPreview();
		const changed = rotationDomeGestureHasChanged(activeRotation);
		if (activeRotation.target === "placement") {
			interactionContextRef.current.onItemPlacementYawChange?.(activeRotation.yawRadians);
		} else if (changed) {
			const completedRotation = {
				assetInstanceId: activeRotation.assetInstanceId,
				kind: "rotation" as const,
				yawRadians: yawRadiansFor(floorYawFieldsForRadians(activeRotation.yawRadians, exactFloorYaw)),
			};
			setSubmittedItemPreview(completedRotation);
			void persistItemTransform(completedRotation);
		}
		rotationRef.current = undefined;
		rotationBaseSceneRef.current = undefined;
		setItemPreview(hostEnabledRef.current && activeRotation.target === "item" && !changed ? hostRetainedItemPreview.current : undefined);
		hostRetainedItemPreview.current = undefined;
		setRotation(undefined);
		clearRotationPointerListeners();
	};

	const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (!captureHostContact(event.pointerId)) { event.preventDefault(); return; }
		if (!rendererReady || isConfirmingItemTransform) {
			event.preventDefault();
			return;
		}
		// Pointer capture keeps a drag alive outside the canvas, but iPhone
		// WebKit can reject it. The canvas handlers still receive an in-canvas
		// touch gesture, so navigation must not depend on this enhancement.
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// Continue with the native in-canvas pointer stream.
		}
		pointers.current.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});
		const activePointers = [...pointers.current.values()];
		if (activePointers.length === 1 && activePointers[0]) {
			const point = canvasPoint(event);
			const floorPoint = point
				? floorPointForCanvas(scene, camera, interactionCanvasSize(), point)
				: undefined;
			if (!readOnly && itemPlacementDraft && floorPoint) {
				onClearSelection?.();
				setPlacementPointFromGesture(true);
				setItemPlacementPoint(floorPoint);
				gesture.current = { kind: "place-item", pointerId: event.pointerId };
				return;
			}
			const itemAtPointer = floorPoint
				? floorItemAtPoint(renderedScene.items, floorPoint)
				: undefined;
			const screenItemAtPointer = point
				? floorItemAtScreenPoint(
						renderedScene.items,
						renderedScene,
						camera,
						interactionCanvasSize(),
						point,
					)
				: undefined;
			const wallItem = plainLabels && point
				? wallItemAtScreenPoint(renderedScene.items, renderedScene, camera, interactionCanvasSize(), point)
				: undefined;
			const item = wallItem ?? itemAtPointer ?? screenItemAtPointer;
			if (!item) onClearSelection?.();
			if (item?.assetInstanceId) onSelectItem?.(item.assetInstanceId);
			if (
				!readOnly &&
				canTransformSelectedItem &&
				item?.assetInstanceId &&
				item.assetAnchor !== "wall" &&
				item.assetInstanceId === selectedItemId &&
				floorPoint
			) {
				if (!allowsHostItemTransform("move", item.assetInstanceId)) {
					hostContacts.current.delete(event.pointerId); pointers.current.delete(event.pointerId); gesture.current = undefined; event.preventDefault(); return;
				}
				hostRetainedItemPreview.current = hostEnabledRef.current && itemPreview?.assetInstanceId === item.assetInstanceId ? itemPreview : undefined;
				gesture.current = {
					assetInstanceId: item.assetInstanceId,
					floorPoint,
					kind: "move-item",
					moved: false,
					pointerId: event.pointerId,
				};
				return;
			}
			gesture.current = { camera, kind: "orbit", point: activePointers[0] };
			return;
		}
		if (activePointers.length === 2 && activePointers[0] && activePointers[1]) {
			// A second finger changes intent from direct manipulation to camera
			// inspection, so it cancels the in-progress local item preview.
			hostRetainedItemPreview.current = undefined;
			setItemPreview(undefined);
			gesture.current = {
				camera,
				centre: centre(activePointers[0], activePointers[1]),
				distance: distance(activePointers[0], activePointers[1]),
				kind: "pinch",
			};
		}
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (!isHostContactCurrent(event.pointerId)) return;
		if (!rendererReady) return;
		if (!pointers.current.has(event.pointerId)) {
			return;
		}
		pointers.current.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});
		const activePointers = [...pointers.current.values()];
		const activeGesture = gesture.current;
		if (
			activePointers.length >= 2 &&
			activePointers[0] &&
			activePointers[1] &&
			activeGesture?.kind === "pinch"
		) {
			markUserCameraView();
			const nextCentre = centre(activePointers[0], activePointers[1]);
			const zoomed = zoomThreeDimensionalViewport(
				activeGesture.camera,
				distance(activePointers[0], activePointers[1]) / activeGesture.distance,
			);
			setCamera(
				panThreeDimensionalViewport(
					zoomed,
					nextCentre.x - activeGesture.centre.x,
					nextCentre.y - activeGesture.centre.y,
				),
			);
			return;
		}
		if (
			activePointers.length === 1 &&
			activePointers[0] &&
			activeGesture?.kind === "move-item"
		) {
			const point = canvasPoint(event);
			const floorPoint = point
				? floorPointForCanvas(scene, camera, interactionCanvasSize(), point)
				: undefined;
			if (floorPoint) {
				const target = snapFloorItemPoint?.(floorPoint, activeGesture.assetInstanceId) ?? floorPoint;
				setItemPreview({
					assetInstanceId: activeGesture.assetInstanceId,
					kind: "move",
					xM: target.xM,
					zM: target.zM,
				});
				gesture.current = {
					...activeGesture,
					floorPoint,
					moved:
						activeGesture.moved ||
						Math.hypot(
							floorPoint.xM - activeGesture.floorPoint.xM,
							floorPoint.zM - activeGesture.floorPoint.zM,
						) > 0.005,
				};
			}
			return;
		}
		if (
			activePointers.length === 1 &&
			activePointers[0] &&
			activeGesture?.kind === "place-item"
		) {
			const point = canvasPoint(event);
			const floorPoint = point
				? floorPointForCanvas(scene, camera, interactionCanvasSize(), point)
				: undefined;
			if (floorPoint) {
			setPlacementPointFromGesture(true);
			setItemPlacementPoint(floorPoint);
		}
			return;
		}
		if (
			activePointers.length === 1 &&
			activePointers[0] &&
			activeGesture?.kind === "orbit"
		) {
			markUserCameraView();
			setCamera(
				orbitThreeDimensionalViewport(
					activeGesture.camera,
					activePointers[0].x - activeGesture.point.x,
					activePointers[0].y - activeGesture.point.y,
				),
			);
		}
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (!isHostContactCurrent(event.pointerId)) return;
		hostContacts.current.delete(event.pointerId);
		if (!rendererReady) {
			if (hostEnabledRef.current) { invalidateHostContacts(); return; }
			pointers.current.delete(event.pointerId);
			gesture.current = undefined;
			setItemPreview(undefined);
			return;
		}
		const activeGesture = gesture.current;
		pointers.current.delete(event.pointerId);
		if (
			activeGesture?.kind === "move-item" &&
			activeGesture.pointerId === event.pointerId
		) {
			if (activeGesture.moved && !readOnly) {
				const target = snapFloorItemPoint?.(activeGesture.floorPoint, activeGesture.assetInstanceId) ?? activeGesture.floorPoint;
				const completedMove = {
					assetInstanceId: activeGesture.assetInstanceId,
					kind: "move" as const,
					xM: Math.round(target.xM * 1000) / 1000,
					zM: Math.round(target.zM * 1000) / 1000,
				};
				setSubmittedItemPreview(completedMove);
				void persistItemTransform(completedMove);
			}
			setItemPreview(hostEnabledRef.current && !activeGesture.moved ? hostRetainedItemPreview.current : undefined);
			hostRetainedItemPreview.current = undefined;
			gesture.current = undefined;
			return;
		}
		if (
			activeGesture?.kind === "place-item" &&
			activeGesture.pointerId === event.pointerId
		) {
			gesture.current = undefined;
			return;
		}
		const remaining = [...pointers.current.values()];
		if (remaining.length === 1 && remaining[0]) {
			gesture.current = { camera, kind: "orbit", point: remaining[0] };
			return;
		}
		if (remaining.length === 0) {
			gesture.current = undefined;
		}
	};

	const onPointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (!isHostContactCurrent(event.pointerId)) return;
		hostContacts.current.delete(event.pointerId);
		pointers.current.delete(event.pointerId);
		const activeGesture = gesture.current;
		if (
			(activeGesture?.kind === "move-item" ||
				activeGesture?.kind === "place-item") &&
			activeGesture.pointerId === event.pointerId
		) {
			gesture.current = undefined;
			hostRetainedItemPreview.current = undefined;
			setItemPreview(undefined);
			return;
		}
		const remaining = [...pointers.current.values()];
		if (remaining.length === 1 && remaining[0]) {
			gesture.current = { camera, kind: "orbit", point: remaining[0] };
			return;
		}
		if (remaining.length === 0) gesture.current = undefined;
	};

	const startRotation = (event: ReactPointerEvent<SVGPathElement>) => {
		if (!captureHostContact(event.pointerId)) { event.preventDefault(); return; }
		const target = itemPlacementDraft ? "placement" : "item";
		const item = rotationItem;
		if (target === "item" && !allowsHostItemTransform("rotation", item?.assetInstanceId)) {
			hostContacts.current.delete(event.pointerId); event.preventDefault(); event.stopPropagation(); return;
		}
		const gizmoBounds = rotationGizmoRef.current?.getBoundingClientRect();
		if (
			!item ||
			item.assetAnchor === "wall" ||
			!gizmoBounds ||
			readOnly ||
			(target === "placement" ? !onItemPlacementYawChange : !canTransformSelectedItem) ||
			!rendererReady ||
			isConfirmingItemTransform ||
			pointers.current.size > 1
		)
			return;
		hostRetainedItemPreview.current = hostEnabledRef.current && itemPreview?.assetInstanceId === item.assetInstanceId ? itemPreview : undefined;
		event.preventDefault();
		event.stopPropagation();
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			/* Window listeners retain capture on WebKit. */
		}
		const nextRotation: RotationGesture = { ...beginRotationDomeGesture({
			assetInstanceId: target === "placement" ? "placement-preview" : item.assetInstanceId ?? "",
			pointerId: event.pointerId,
			yawRadians: item.yawRadians ?? 0,
			point: { x: event.clientX, y: event.clientY },
			centre: rotationCentre(gizmoBounds),
			exact: exactFloorYaw,
			snapToStep: rotationStepMode || !exactFloorYaw,
		}), target, placementKey };
		rotationBaseSceneRef.current = scene;
		rotationRef.current = nextRotation;
		pointers.current.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});
		setRotation(nextRotation);
		if (target === "item") setItemPreview({
			assetInstanceId: nextRotation.assetInstanceId,
			kind: "rotation",
			yawRadians: nextRotation.yawRadians,
		});
		clearRotationPointerListeners();
		// One pointer stream owns rotation and the subsequent camera gesture. A
		// second contact can land on either the cap, canvas or captured SVG.
		const listenerEpoch = hostGateRef.current.capture();
		const listenerCurrent = () => !hostEnabledRef.current || hostGateRef.current.isCurrent(listenerEpoch);
		const down = (pointer: PointerEvent) => {
			if (!listenerCurrent() || !captureHostContact(pointer.pointerId)) return;
			if (pointers.current.has(pointer.pointerId)) return;
			pointers.current.set(pointer.pointerId, {
				x: pointer.clientX,
				y: pointer.clientY,
			});
			abandonRotationPreview();
			const contacts = [...pointers.current.values()];
			if (contacts[0] && contacts[1])
				gesture.current = {
					kind: "pinch",
					camera: cameraRef.current,
					centre: centre(contacts[0], contacts[1]),
					distance: distance(contacts[0], contacts[1]),
				};
		};
		const move = (pointer: PointerEvent) => {
			if (!listenerCurrent()) return;
			if (!pointers.current.has(pointer.pointerId)) return;
			pointers.current.set(pointer.pointerId, {
				x: pointer.clientX,
				y: pointer.clientY,
			});
			if (rotationRef.current) {
				updateRotationFromClientPoint(pointer.pointerId, {
					x: pointer.clientX,
					y: pointer.clientY,
				});
				return;
			}
			const contacts = [...pointers.current.values()];
			const active = gesture.current;
			if (active?.kind === "pinch" && contacts[0] && contacts[1]) {
				const nextCentre = centre(contacts[0], contacts[1]);
				markUserCameraView();
				setCamera(
					panThreeDimensionalViewport(
						zoomThreeDimensionalViewport(
							active.camera,
							distance(contacts[0], contacts[1]) / active.distance,
						),
						nextCentre.x - active.centre.x,
						nextCentre.y - active.centre.y,
					),
				);
			} else if (
				active?.kind === "orbit" &&
				contacts.length === 1 &&
				contacts[0]
			) {
				markUserCameraView();
				setCamera(
					orbitThreeDimensionalViewport(
						active.camera,
						contacts[0].x - active.point.x,
						contacts[0].y - active.point.y,
					),
				);
			}
		};
		const end = (pointer: PointerEvent, cancelled: boolean) => {
			if (!listenerCurrent()) return;
			if (rotationRef.current) {
				finishRotation(pointer.pointerId, cancelled);
				return;
			}
			pointers.current.delete(pointer.pointerId);
			const contacts = [...pointers.current.values()];
			gesture.current =
				contacts.length === 1 && contacts[0]
					? { kind: "orbit", camera: cameraRef.current, point: contacts[0] }
					: undefined;
			if (contacts.length === 0) clearRotationPointerListeners();
		};
		const up = (pointer: PointerEvent) => end(pointer, false);
		const cancel = (pointer: PointerEvent) => end(pointer, true);
		rotationPointerListenersRef.current = { down, cancel, move, up };
		window.addEventListener("pointerdown", down, true);
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", cancel);
	};

	const cancelActiveRotation = useCallback(() => {
		if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
		abandonRotationPreview();
		clearRotationPointerListeners();
		pointers.current.clear();
		gesture.current = undefined;
	}, [abandonRotationPreview, clearRotationPointerListeners]);

	function invalidateHostContacts(): void {
		const active = rotationRef.current;
		const current = interactionContextRef.current;
		if (active && current.scene === rotationBaseSceneRef.current && (active.target === "placement" ? active.placementKey === current.placementKey : active.assetInstanceId === current.selectedItemId)) applyRotationPreview(active);
		hostGateRef.current.invalidateContacts();
		if (hostEnabledRef.current && !hostGateDisposed.current) renderHostEpoch(hostGateRef.current.capture());
		hostContacts.current.clear();
		pointers.current.clear();
		gesture.current = undefined;
		clearRotationPointerListeners();
		if (rotationFrameRef.current !== undefined) cancelAnimationFrame(rotationFrameRef.current);
		rotationFrameRef.current = undefined;
		pendingRotationRef.current = undefined;
		rotationRef.current = undefined;
		rotationBaseSceneRef.current = undefined;
		setRotation(undefined);
	}
	function cancelHostDraft(): void {
		if (hostGateRef.current.hasPending()) return;
		invalidateHostContacts();
		if (hasRawAngleDraft) {
			setHasRawAngleDraft(false);
			setAngleDraftEpoch(epoch => epoch + 1);
		}
		hostRetainedItemPreview.current = undefined;
		setItemPreview(undefined);
		setSubmittedItemPreview(undefined);
		setItemPlacementPoint(undefined);
		if (itemPlacementDraft) onCancelItemPlacement?.();
		hostDraftState.current = false;
	}
	const hostPlacementKey = useRef(placementKey);
	useEffect(() => {
		if (hostPlacementKey.current === placementKey) return;
		hostPlacementKey.current = placementKey;
		if (!hostEnabledRef.current) return;
		hostActions.current.invalidateHostContacts();
		setItemPlacementPoint(undefined);
	}, [placementKey]);
	const hostActions = useRef({ invalidateHostContacts, cancelHostDraft });
	hostActions.current = { invalidateHostContacts, cancelHostDraft };
	useLayoutEffect(() => {
		if (!registerTransientBoundary) return;
		let registered = true;
		const unregister = registerTransientBoundary({
			inspect: () => registered ? { hasDraft: hostDraftState.current || rotationRef.current !== undefined || gesture.current?.kind === "move-item" || gesture.current?.kind === "place-item", hasPendingCommand: hostGateRef.current.hasPending() } : { hasDraft: false, hasPendingCommand: false },
			suspend: () => { if (!registered) return; hostGateRef.current.suspend(); hostActions.current.invalidateHostContacts(); },
			resume: () => { if (registered) hostGateRef.current.resume(); },
			invalidateContacts: () => { if (registered) hostActions.current.invalidateHostContacts(); },
			cancelDraft: () => { if (registered) hostActions.current.cancelHostDraft(); },
		});
		return () => { registered = false; hostActions.current.invalidateHostContacts(); unregister(); };
	}, [registerTransientBoundary]);

	useEffect(() => {
		// A new base, selection or writer capability never inherits a live drag.
		const active = rotationRef.current;
		if (
			active &&
			(scene !== rotationBaseSceneRef.current ||
				readOnly ||
				(active.target === "placement"
					? placementKey !== active.placementKey || !hasPlacementYawControl
					: selectedItemId !== active.assetInstanceId || !canTransformSelectedItem))
		)
			cancelActiveRotation();
		if (gesture.current?.kind === "move-item") {
			gesture.current = undefined;
			pointers.current.clear();
			setItemPreview(undefined);
		}
	}, [
		scene,
		selectedItemId,
		readOnly,
		canTransformSelectedItem,
		placementKey,
		hasPlacementYawControl,
		cancelActiveRotation,
	]);

	useEffect(() => {
		const cancel = (event: KeyboardEvent) => {
			if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
			if (event.key === "Escape" && rotationRef.current) {
				event.preventDefault();
				cancelActiveRotation();
			}
		};
		const background = () => hostEnabledRef.current ? hostActions.current.invalidateHostContacts() : cancelActiveRotation();
		const hidden = () => { if (document.hidden) background(); };
		window.addEventListener("keydown", cancel);
		window.addEventListener("blur", background);
		document.addEventListener("visibilitychange", hidden);
		return () => {
			window.removeEventListener("keydown", cancel);
			window.removeEventListener("blur", background);
			document.removeEventListener("visibilitychange", hidden);
		};
	}, [cancelActiveRotation]);

	const applyControlAngle = (yawRadians: number) => {
		if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
		const canonicalAngle = yawRadiansFor(floorYawFieldsForRadians(yawRadians, exactFloorYaw));
		if (itemPlacementDraft) {
			if (readOnly || !rendererReady || rotationRef.current || !onItemPlacementYawChange) return;
			onItemPlacementYawChange(canonicalAngle);
			return;
		}
		const selected = (hostEnabledRef.current ? renderedScene : scene).items.find(
			(item) => item.assetInstanceId === selectedItemId,
		);
		if (!allowsHostItemTransform("rotation", selected?.assetInstanceId)) return;
		if (
			!selected?.assetInstanceId ||
			selected.assetAnchor === "wall" ||
			readOnly ||
			!canTransformSelectedItem ||
			!rendererReady ||
			isConfirmingItemTransform ||
			rotationRef.current ||
			canonicalAngle === (selected.yawRadians ?? 0)
		)
			return;
		const transform = {
			assetInstanceId: selected.assetInstanceId,
			kind: "rotation" as const,
			yawRadians: canonicalAngle,
		};
		setSubmittedItemPreview(transform);
		void persistItemTransform(transform);
	};

	const message = statusCopy(state);
	const rendererDiagnostics = rendererDiagnosticsCopy(state);
	const cutawayCopy =
		cutawayMode === "auto"
			? "Авто: ближние внешние стены скрываются"
			: "Все стены показаны";
	const selectedItem = selectedItemId === undefined ? undefined : renderedScene.items.find(
		(item) => item.assetInstanceId === selectedItemId,
	);
	const rotationItem = itemPlacementDraft
		? threeDimensionalItemPlacementPreview ? renderedScene.items.at(-1) : undefined
		: selectedItem;
	// The observer state can still be 0×0 during the first interaction after
	// opening 3D. Use the same live measurement as pointer hit-testing so a
	// selected item's rotation control is available immediately.
	const liveCanvasSize = interactionCanvasSize();

	const currentRotationYaw = rotation?.yawRadians ?? (hostEnabledRef.current && !itemPlacementDraft && visualItemPreview?.kind === "rotation" ? visualItemPreview.yawRadians : undefined) ?? (itemPlacementDraft ? itemPlacementDraft.yawRadians ?? 0 : selectedItem?.yawRadians ?? 0);
	const displayedYawRadians = gizmoYawForSceneYaw(currentRotationYaw);
	const retainedHostTransform = retainedHostItemTransform();
	const rotationBlocked = !itemPlacementDraft && !allowsHostItemTransform("rotation", selectedItemId);
	const gizmoPosition = rotationItem
		? canvasPointForFloor(renderedScene, camera, liveCanvasSize, {
				xM: rotationItem.centerXM,
				zM: rotationItem.centerZM,
			})
		: undefined;
	const selectedItemFootprint =
		rotationItem && rotationItem.assetAnchor !== "wall"
			? projectedItemFootprintFor(
					rotationItem,
					renderedScene,
					camera,
					liveCanvasSize,
				)
			: undefined;
	const isRotationActive = rotation?.target === "placement" ? !!threeDimensionalItemPlacementPreview : isThreeDimensionalRotationActive(
		rotation?.assetInstanceId,
		selectedItem?.assetInstanceId,
	);

	// The rotation control has one axis, so its centre is the item's centre.
	// Only its annular stroke owns a pointer; the clear middle remains the
	// item's direct-manipulation target even for very small assets.
	const ringTop = itemPlacementDraft ? placementSurface.headerBottom : 0;
	const ringBottom = itemPlacementDraft && placementSurface.menuTop > ringTop
		? placementSurface.menuTop
		: liveCanvasSize.height;
	const ringSize = plainLabels
		? Math.min(ROTATION_GIZMO_SIZE, ringBottom - ringTop - 12, liveCanvasSize.width - 12)
		: ROTATION_GIZMO_SIZE;
	const ringPadding = ringSize / 2 + 6;
	const gizmoOverlayPosition = gizmoPosition && ringSize >= 84
		? plainLabels
			? {
				x: clampToBounds(gizmoPosition.x, ringPadding, liveCanvasSize.width - ringPadding),
				y: clampToBounds(gizmoPosition.y, ringTop + ringPadding, ringBottom - ringPadding),
			}
			: {
				x: Math.max(104, Math.min(liveCanvasSize.width - 104, gizmoPosition.x)),
				y: itemPlacementDraft
					? Math.max(placementSurface.headerBottom + 104, Math.min(placementSurface.menuTop - 32, gizmoPosition.y))
					: Math.max(104, Math.min(liveCanvasSize.height - 84, gizmoPosition.y)),
			}
		: undefined;
	// Leave a usable space for the ring while allowing the sheet to scroll.
	const availablePlacementHeight = liveCanvasSize.height - placementSurface.headerBottom;
	const reservedRotationHeight = plainLabels
		? clampToBounds(availablePlacementHeight - 116, 110, ROTATION_GIZMO_SIZE + 20)
		: ROTATION_DOME_HEIGHT + 20;
	const placementMenuMaxHeight = Math.max(
		96,
		availablePlacementHeight - (threeDimensionalItemPlacementPreview ? reservedRotationHeight : 12),
	);
	const angleDisplay = exactFloorYaw
		? degreesForYawRadians(currentRotationYaw)
		: String(rotationStepForYawRadians(currentRotationYaw) * 45);
	const placementAngle = (
		<output
			aria-live="polite"
			className={plainLabels ? rotationStyles.value : undefined}
			data-testid="three-dimensional-placement-rotation-angle"
		>
			{angleDisplay}°
		</output>
	);
	const step = exactFloorYaw && !rotationStepMode ? 1 : 45;
	const rotationStepYaw = (direction: 1 | -1) => exactFloorYaw
		? steppedYawRadians(currentRotationYaw, direction, rotationStepMode)
		: currentRotationYaw + direction * Math.PI / 4;
	const rotationStepClass = plainLabels ? rotationStyles.step : undefined;
	const rotationRowClass = plainLabels
		? rotationStyles.row
		: `${sceneStyles.rotationStepControls} ${itemPlacementDraft ? sceneStyles.placementRotationControls : ""}`;
	const rotationDisabled = !rendererReady || readOnly || isConfirmingItemTransform || isRotationActive || rotationBlocked;
	const rotationControls = (
		<fieldset
			aria-label="Поворот предмета"
			className={rotationRowClass}
			data-rotation-target={plainLabels ? (itemPlacementDraft ? "placement" : "selected") : undefined}
		>
			<button
				aria-label={`Повернуть предмет на ${step}° против часовой стрелки`}
				className={rotationStepClass}
				disabled={rotationDisabled}
				onClick={() => applyControlAngle(rotationStepYaw(1))}
				type="button"
			>
				↶
			</button>
			{isRotationActive ? (
				<button type="button" className={plainLabels ? rotationStyles.cancel : sceneStyles.rotationCancel} onClick={cancelActiveRotation}>
					{itemPlacementDraft ? placementAngle : null}<span>Отменить поворот</span>
				</button>
			) : exactFloorYaw ? (
				<FloorRotationAngleField
					key={`${itemPlacementDraft ? placementKey : selectedItemId}:${angleDraftEpoch}`}
					ariaLabel="Поворот предмета в 3D, градусы"
					className={plainLabels ? rotationStyles.angle : undefined}
					disabled={rotationDisabled}
					explicit={onRotationStepModeChange !== undefined}
					onDraftChange={setHasRawAngleDraft}
					onApply={applyControlAngle}
					skipBlurCommit={skipBlurCommit}
					yawRadians={currentRotationYaw}
				/>
			) : itemPlacementDraft ? placementAngle : <span className={plainLabels ? rotationStyles.value : sceneStyles.rotationCaption}>Поворот</span>}
			<button
				aria-label={`Повернуть предмет на ${step}° по часовой стрелке`}
				className={rotationStepClass}
				disabled={rotationDisabled}
				onClick={() => applyControlAngle(rotationStepYaw(-1))}
				type="button"
			>
				↷
			</button>
			{onRotationStepModeChange ? <RotationModeToggle checked={rotationStepMode} disabled={rotationDisabled} onChange={onRotationStepModeChange} /> : null}
		</fieldset>
	);
	return (
		<section
			aria-label="3D вид комнаты"
			className={styles.scenePanel}
			ref={scenePanelRef}
		>
			<div
				className={sceneStyles.sceneViewport}
				style={plainLabels ? undefined : {
					bottom: sceneViewportInsets.bottom,
					top: sceneViewportInsets.top,
				}}
			>
				<canvas
					aria-label="3D вид комнаты"
					className={styles.sceneCanvas}
					data-testid="three-dimensional-canvas"
					onPointerCancel={onPointerCancel}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					ref={canvasRef}
					role="img"
					style={{ touchAction: "none" }}
				>
					3D-визуализация требует WebGL2.
				</canvas>
				{selectedItemFootprint ? (
					<svg
						aria-hidden="true"
						className={sceneStyles.itemSelectionFrame}
						data-testid="three-dimensional-item-selection-frame"
						height={liveCanvasSize.height}
						viewBox={`0 0 ${liveCanvasSize.width} ${liveCanvasSize.height}`}
						width={liveCanvasSize.width}
					>
						<polygon
							points={selectedItemFootprint
								.map((corner) => `${corner.x},${corner.y}`)
								.join(" ")}
						/>
					</svg>
				) : null}
				{rotationItem &&
				gizmoOverlayPosition &&
				rotationItem.assetAnchor !== "wall" &&
				!readOnly &&
				(itemPlacementDraft ? hasPlacementYawControl : canTransformSelectedItem) ? (
					<div
						className={sceneStyles.rotationOverlay}
						data-full-ring={plainLabels || undefined}
						style={{
							left: gizmoOverlayPosition.x,
							top: gizmoOverlayPosition.y,
							...(plainLabels ? { width: ringSize, transform: `translate(-50%, ${-ringSize / 2}px)` } : {}),
						}}
					>
						{!itemPlacementDraft ? <output
							className={sceneStyles.rotationAngle}
							data-testid="three-dimensional-rotation-angle"
							aria-live="polite"
						>
							{angleDisplay}°
						</output> : null}
						<svg
							aria-label={plainLabels ? "Кольцо поворота предмета в 3D" : "Полусфера поворота предмета в 3D"}
							className={sceneStyles.rotationGizmo}
							data-rotation-active={isRotationActive ? "true" : "false"}
							data-testid="three-dimensional-rotation-gizmo"
							aria-disabled={rotationBlocked || undefined}
							style={rotationBlocked ? { opacity: 0.45 } : undefined}
							height={plainLabels ? ringSize : rotationTrackHeight}
							ref={rotationGizmoRef}
							viewBox={`0 0 ${ROTATION_GIZMO_SIZE} ${rotationTrackHeight}`}
							width={ringSize}
						>
							{!plainLabels && <path
								className={sceneStyles.rotationDome}
								data-testid="three-dimensional-rotation-dome"
								d="M27 100 A73 73 0 0 1 173 100 Z"
							/>}
							<path
								className={sceneStyles.rotationTrack}
								data-testid="three-dimensional-rotation-track"
								d={rotationTrackPath}
								vectorEffect={plainLabels ? "non-scaling-stroke" : undefined}
							/>
							{!plainLabels && <path
								className={sceneStyles.rotationMeridian}
								d="M100 27 C68 48 68 79 100 100 C132 79 132 48 100 27 M43 55 Q100 78 157 55"
							/>}
							<path
								aria-label="Вращать предмет в 3D"
								className={sceneStyles.rotationHitArea}
								data-testid="three-dimensional-rotation-hit-area"
								aria-disabled={rotationBlocked || undefined}
								style={rotationBlocked ? { cursor: "not-allowed" } : undefined}
								d={rotationTrackPath}
								vectorEffect={plainLabels ? "non-scaling-stroke" : undefined}
								onPointerDown={startRotation}
								onLostPointerCapture={(event) => { if (rotationRef.current?.pointerId === event.pointerId) cancelActiveRotation(); }}
							/>
							<circle
								className={sceneStyles.rotationHandle}
								cx={
									ROTATION_GIZMO_CENTER +
									Math.sin(displayedYawRadians) * ROTATION_GIZMO_RADIUS
								}
								cy={
									ROTATION_GIZMO_CENTER -
									Math.cos(displayedYawRadians) * ROTATION_GIZMO_RADIUS
								}
								data-testid="three-dimensional-rotation-handle"
								pointerEvents="none"
								r="8"
							/>
						</svg>
						{!itemPlacementDraft && !onRotationStepModeChange ? rotationControls : null}
					</div>
				) : null}
			</div>
			{onRotationStepModeChange && !itemPlacementDraft && rotationItem && gizmoOverlayPosition &&
				rotationItem.assetAnchor !== "wall" && !readOnly && canTransformSelectedItem ? (
				<div className={sceneStyles.rotationEditor}>{rotationControls}</div>
			) : null}
			{hasUserCameraView && rendererReady && !isItemPlacementActive ? (
				<button
					aria-label="Вернуть обзор 3D"
					className={sceneStyles.overviewReset}
					onClick={resetOverview}
					type="button"
				>
					<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
						<path
							d="M5 9a8 8 0 1 1-1 5.3M5 9V4m0 5h5"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="1.9"
						/>
					</svg>
					<span>Обзор</span>
				</button>
			) : null}
			<output data-testid="three-dimensional-camera" hidden>
				{`${camera.azimuthRadians.toFixed(3)}:${camera.elevationRadians.toFixed(3)}:${camera.distance.toFixed(3)}:${camera.panXM.toFixed(3)}:${camera.panZM.toFixed(3)}`}
			</output>
			<output data-testid="three-dimensional-item-preview" hidden>
				{visualItemPreview
					? visualItemPreview.kind === "rotation"
						? `поворот:${visualItemPreview.yawRadians?.toFixed(3)}`
						: `перемещение:${visualItemPreview.xM?.toFixed(3)}:${visualItemPreview.zM?.toFixed(3)}`
					: "нет"}
			</output>
			<output data-testid="three-dimensional-custom-glb-status" hidden>
				{customGlbRuntimeStatus}
			</output>
			{itemPlacementDraft ? (
				<aside
					aria-label="Размещение предмета"
					className={sceneStyles.itemPlacementMenu}
					data-placement-state={itemPlacementState}
					data-full-ring={plainLabels || undefined}
					data-testid="three-dimensional-item-placement-menu"
					data-scene-color-dock={itemPlacementControls ? "placement" : undefined}
					ref={placementMenuRef}
					style={{ maxHeight: onRotationStepModeChange
						? `min(${placementMenuMaxHeight}px, calc(var(--editor-viewport-height, 100dvh) - 12px - var(--editor-safe-area-bottom, 0px)))`
						: placementMenuMaxHeight }}
				>
					<span
						aria-hidden="true"
						className={sceneStyles.itemPlacementHandle}
					/>
					{onCloseItemPlacement ? (
						<SheetHeader
							title={<span data-testid="three-dimensional-item-placement-identity">{itemPlacementDraft.label}</span>}
							closeLabel="Закрыть размещение предмета"
							protectEditorDraft
							onClose={onCloseItemPlacement}
						/>
					) : (
					<div className={sceneStyles.itemPlacementIdentity}>
						<span aria-hidden="true" className={sceneStyles.itemPlacementGlyph}>
							<svg aria-hidden="true" fill="none" viewBox="0 0 28 28">
								<path d="M8 19.5v-5.2c0-1.5 1.1-2.7 2.6-2.7h6.8c1.5 0 2.6 1.2 2.6 2.7v5.2" />
								<path d="M6 18.8h16v3H6zM9.5 11.6V8.4c0-1 .8-1.9 1.9-1.9h5.2c1 0 1.9.8 1.9 1.9v3.2" />
							</svg>
						</span>
						<div className={sceneStyles.itemPlacementCopy}>
							<strong data-testid="three-dimensional-item-placement-identity">
								{itemPlacementDraft.label}
							</strong>
							{itemPlacementState === "choose-another-point" ? (
								<span
									aria-live="polite"
									className={sceneStyles.itemPlacementStatus}
									data-placement-state={itemPlacementState}
									data-testid="three-dimensional-item-placement-status"
									role="status"
								>
									Выберите другое место
								</span>
							) : null}
						</div>
					</div>
					)}
					{onCloseItemPlacement && itemPlacementState === "choose-another-point" ? (
						<span className={sceneStyles.itemPlacementStatus} role="status" data-testid="three-dimensional-item-placement-status">
							Выберите другое место
						</span>
					) : null}
					{itemPlacementControls}
					{threeDimensionalItemPlacementPreview ? (
						<output
							aria-hidden="true"
							className={sceneStyles.itemPlacementCoordinates}
							data-placement-valid={
								threeDimensionalItemPlacementPreview.isValid
							}
							data-testid="three-dimensional-item-placement-preview"
							data-x-m={threeDimensionalItemPlacementPreview.xM.toFixed(3)}
							data-z-m={threeDimensionalItemPlacementPreview.zM.toFixed(3)}
							hidden
						>
							{threeDimensionalItemPlacementPreview.isValid
								? "Можно поставить"
								: "Нельзя поставить здесь"}
						</output>
					) : null}
					{hasPlacementYawControl ? rotationControls : null}
					<div className={sceneStyles.itemPlacementActions}>
						<button data-editor-action="cancel"
							aria-label="Отменить размещение предмета"
							className={sceneStyles.itemPlacementCancel}
							onClick={() => {
								if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
								setItemPlacementPoint(undefined);
								onCancelItemPlacement?.();
							}}
							type="button"
						>
							{plainLabels ? "Отменить" : "Отмена"}
						</button>
						<button data-editor-action="confirm"
							aria-label="Подтвердить размещение предмета"
							className={sceneStyles.itemPlacementConfirm}
							disabled={
								!rendererReady ||
							readOnly ||
							isRotationActive ||
							isConfirmingItemTransform ||
							!threeDimensionalItemPlacementPreview?.isValid
							}
							onClick={() => {
								if (
									!rendererReady ||
									readOnly ||
									isConfirmingItemTransform ||
									rotationRef.current ||
									pointers.current.size > 0 ||
									!threeDimensionalItemPlacementPreview?.isValid
								)
									return;
								const point = {
									xM: threeDimensionalItemPlacementPreview.xM,
									zM: threeDimensionalItemPlacementPreview.zM,
								};
								if (hostEnabledRef.current) {
									if (!hostGateRef.current.canBegin()) return;
									// The parent owns the Durable outcome and clears the draft via props.
									return hostGateRef.current.run(async () => {
										setIsConfirmingItemTransform(true);
										try { await onPlaceItem?.(point); }
										finally { setIsConfirmingItemTransform(false); }
									});
								}
								setItemPlacementPoint(undefined);
								onPlaceItem?.(point);
							}}
							type="button"
						>
							{plainLabels ? "Подтвердить" : "Поставить"}
						</button>
					</div>
				</aside>
			) : null}
			{!itemPlacementDraft ? (
				<section
					aria-label="Управление видом 3D"
					className={sceneStyles.viewControls}
					data-testid="three-dimensional-view-controls"
					data-scene-color-dock={selectedItem && !readOnly && selectedItemControls ? "selected" : undefined}
					ref={viewControlsRef}
				>
					<div
						className={sceneStyles.cameraDeck}
						data-testid="three-dimensional-camera-deck"
					>
						{onOpenItemCatalog ? (
							<button
								aria-label="Предметы интерьера"
								className={sceneStyles.threeDimensionalCatalogButton}
								disabled={readOnly}
								onClick={(event) => onOpenItemCatalog(event.currentTarget)}
								type="button"
							>
								<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
									<path
										d="M7 11V6.5A2.5 2.5 0 0 1 9.5 4h5A2.5 2.5 0 0 1 17 6.5V11"
										stroke="currentColor"
										strokeLinecap="round"
										strokeWidth="1.9"
									/>
									<path
										d="M5 11h14v6H5zM8 17v3M16 17v3"
										stroke="currentColor"
										strokeLinejoin="round"
										strokeWidth="1.9"
									/>
								</svg>
								<span>Предмет</span>
							</button>
						) : null}
						<fieldset className={sceneStyles.cutawayControls}>
							<legend className={sceneStyles.cutawayLegend}>
								Режим стен 3D
							</legend>
							<button
								aria-label="Авто cutaway"
								aria-pressed={cutawayMode === "auto"}
								className={sceneStyles.cutawayButton}
								onClick={() => setCutawayMode("auto")}
								style={{ minHeight: 44, minInlineSize: 44 }}
								type="button"
							>
								<svg
									aria-hidden="true"
									data-testid="three-dimensional-auto-cutaway-icon"
									fill="none"
									viewBox="0 0 24 24"
								>
									<path
										d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"
										stroke="currentColor"
										strokeLinejoin="round"
										strokeWidth="1.8"
									/>
									<path
										d="m5 7 7 4 7-4M12 11v10M4 15.5h5"
										stroke="currentColor"
										strokeLinecap="round"
										strokeWidth="1.8"
									/>
								</svg>
								<span>Авто</span>
							</button>
							<button
								aria-label="Показать все стены"
								aria-pressed={cutawayMode === "show-all"}
								className={sceneStyles.cutawayButton}
								onClick={() => setCutawayMode("show-all")}
								style={{ minHeight: 44, minInlineSize: 44 }}
								type="button"
							>
								<svg
									aria-hidden="true"
									data-testid="three-dimensional-all-walls-icon"
									fill="none"
									viewBox="0 0 24 24"
								>
									<path
										d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"
										stroke="currentColor"
										strokeLinejoin="round"
										strokeWidth="1.8"
									/>
									<path
										d="m5 7 7 4 7-4M12 11v10"
										stroke="currentColor"
										strokeLinecap="round"
										strokeWidth="1.8"
									/>
								</svg>
								<span>Все стены</span>
							</button>
						</fieldset>
						{selectedItem && !readOnly ? selectedItemControls : null}
						<fieldset
							aria-label="Масштаб 3D"
							className={sceneStyles.scaleControls}
						>
							<button
								aria-label="Приблизить 3D"
								className={sceneStyles.scaleButton}
								onClick={() => {
									markUserCameraView();
									setCamera((previous) =>
										zoomThreeDimensionalViewport(previous, 1.2),
									);
								}}
								type="button"
							>
								+
							</button>
							<button
								aria-label="Отдалить 3D"
								className={sceneStyles.scaleButton}
								onClick={() => {
									markUserCameraView();
									setCamera((previous) =>
										zoomThreeDimensionalViewport(previous, 1 / 1.2),
									);
								}}
								type="button"
							>
								−
							</button>
						</fieldset>
					</div>
				</section>
			) : null}
			<output hidden>
				{itemCountCopy(scene.items.length)} в плане
			</output>
			<output data-testid="three-dimensional-cutaway" hidden>
				{cutawayCopy}
			</output>
			<output data-testid="three-dimensional-renderer-diagnostics" hidden>
				{rendererDiagnostics}
			</output>
			{message || customGlbRuntimeUnavailableDefinitionIds.length > 0 || retainedHostTransform ? (
				<div className={styles.sceneRecoveryNotices}>
					{retainedHostTransform ? <aside className={styles.sceneRecovery} role="status" style={{ pointerEvents: "none" }}>
						{retainedHostTransform.kind === "move" ? "Продолжите перемещение или отмените правку." : "Продолжите поворот или отмените правку."}
					</aside> : null}
					{message ? (
						<aside className={styles.sceneRecovery} role="status">
							<strong>3D недоступен</strong>
							<span>{message}</span>
							{state.kind === "two-dimensional-fallback" ? (
								<button
									className={styles.retryButton}
									onClick={onOpenPlan}
									type="button"
								>
									Открыть точный план 2D
								</button>
							) : (
								<button
									className={styles.retryButton}
									onClick={retry}
									type="button"
								>
									Повторить 3D
								</button>
							)}
						</aside>
					) : null}
					{customGlbRuntimeUnavailableDefinitionIds.length > 0 ? (
						<aside className={styles.sceneRecovery} role="status">
							<strong>Модель не открылась в 3D</strong>
							<span>
								Пользовательский GLB не удалось подготовить для 3D-сцены. Проект
								не изменён; повторите подготовку или повторно импортируйте
								исходный GLB.
							</span>
							<button
								className={styles.retryButton}
								onClick={retryCustomGlbRuntime}
								type="button"
							>
								Повторить подготовку модели
							</button>
						</aside>
					) : null}
				</div>
			) : null}
		</section>
	);
}

function gizmoYawForSceneYaw(yawRadians: number): number {
	return normalizeYawRadians(-yawRadians);
}

function normalizeYawRadians(yawRadians: number): number {
	const normalized = yawRadians % (Math.PI * 2);
	return normalized < 0 ? normalized + Math.PI * 2 : normalized;
}
