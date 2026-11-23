import { OpeningPlanSymbol } from "./opening-plan-symbol";
import { DIVIDED_WINDOW_MIN_WIDTH_MM } from "../adapters/renderer/opening-template";
import { createEditorInteractionGate, type EditorContactEpoch } from "./editor-host-boundary";
import {
	Fragment,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { wallBodiesForProjection } from "../adapters/renderer/wall-body-projection";
import { roomTypeLabels } from "./room-type-labels";
import { wallItemPlanFootprintForProjection } from "../adapters/renderer/rectangular-room-projection";
import { moveDoorOpeningInProject } from "../domain/door-opening-project";
import { PLAN_GRID_STEP_MM } from "../domain/constrained-partition";
import { formatAreaMm2, formatLengthMm } from "../domain/measurement-format";
import {
	assessParametricFloorItemPlacement,
	findParametricFloorItemCollisionTargets,
	findRoomForFloorItem,
	floorItemFootprintCorners,
	floorYawFieldsForRadians,
	rotationStepForYawRadians,
	yawRadiansFor,
} from "../domain/parametric-item";
import {
	openingDragOffsetFor,
	wallSplitPointForPointer,
} from "./opening-gesture";
import { wallOpeningIntervalMm } from "../domain/wall-opening";
import styles from "./AppShell.module.css";
import rotationStyles from "./FloorRotationControls.module.css";
import { PlacementRotationControl } from "./PlacementRotationControl";
import { FloorRotationAngleField } from "./FloorRotationAngleField";
import {
	beginRotationDomeGesture,
	moveRotationDomeGesture,
	rotationDomeGestureHasChanged,
	type RotationDomeGesture,
} from "./three-dimensional-rotation-gesture";
import { degreesForYawRadians } from "./rotation-angle";
import { DrawingDimensions } from "./DrawingDimensions";
import { ItemWallDistanceFields, ItemWallDistanceLines, ItemWallDistanceValues } from "./ItemWallDistances";
import { itemWallDistancePositionFor, itemWallDistancesFor, type ItemWallDistance } from "./item-wall-distances";
import { SheetHeader } from "./SheetHeader";
import { selectDrawingDimensions } from "./drawing-dimension-selection";
import { filterDrawingDimensions } from "./drawing-dimension-visibility";
import { drawingDimensionsFor } from "./drawing-dimensions";
import {
	layoutDrawingDimensions,
	type ScreenRect,
} from "./drawing-dimension-layout";
import {
	type CanvasSize,
	canvasPointFromClient,
	type EditorViewport,
	MINIMUM_TOUCH_TARGET_PX,
	maximumEditorZoomForGrid,
	panEditorViewport,
	pinchEditorViewport,
	visibleWorldBounds,
	zoomEditorViewportAround,
} from "./editor-viewport";
import { roomDimensionLayouts } from "./room-dimension-layout";
import { roomMeasurementFor } from "./room-measurement";
import {
	planItemSilhouetteKindFor,
	planItemSilhouettePathsFor,
} from "./plan-item-silhouette";
import {
	isWallDraftConfirmable,
	normalizeWallGestureDraft,
	snapConstrainedWallDraftEnd,
	snapWallDraftStart,
	wallDraftAlignmentGuide,
	wallJoinTargetRadiusMm,
} from "./wall-draft";
import {
	pointForWallVertexMove,
	snapWallMoveDeltaMm,
	wallVertexMoveAxisFor,
} from "./wall-vertex-move";
import {
	type EditorFloorAsset,
	hasProjectRevisionChanged,
	isFloorEditorAsset,
	yawRadiansForEditorFloorAsset,
	derivedPlanFor,
	wallDraftDirectionCopy,
	itemPlacementPreviewFeedback,
	snappedPoint,
	gridLinesBetween,
	wallHitPath,
	nearestWallAtPoint,
	visualGridStepMm,
	type PlanProjectionProps,
	type PointerPosition,
	type WallDraft,
	type WallMoveDraft,
	type WallMoveAxis,
	type WallVertexMoveDraft,
	type WallSplitDraft,
	type DoorOpeningDrag,
	type ItemPlacementDrag,
	type ItemPlacementPoint,
	initialPlanCanvasSize,
	distance,
	centre,
	visiblePlanFrame,
} from "./editor-plan-presentation";

const itemArrowSteps: Readonly<Partial<Record<string, { xMm: number; zMm: number }>>> = {
	ArrowLeft: { xMm: -100, zMm: 0 },
	ArrowRight: { xMm: 100, zMm: 0 },
	ArrowUp: { xMm: 0, zMm: -100 },
	ArrowDown: { xMm: 0, zMm: 100 },
};

export function PlanProjection({
	plainLabels = false,
	exactFloorYaw = false,
	initialItemPlacementPoint,
	onItemPlacementPointChange,
	skipBlurCommit,
	keyboardItemMovement = false,
	showOpeningTemplates = false,
	selectedOpeningId,
	showItemWallDistances = false,
	floorItemWallSnap,
	itemPlacementControls,
	registerTransientBoundary,
	dimensionVisibility,
	openingMoveErrorCopy,
	activeTool,
	isInteractionLocked,
	isWallMoveMode,
	isWallSplitMode,
	isWallVertexMoveMode,
	movableWallVertexIds,
	openingCreationPreview,
	openingMovePreview,
	itemDraft,
	readOnly,
	onDrawWall: rawOnDrawWall,
	onDrawingVisibilityChange,
	onCancelItemPlacement,
	onCloseItemPlacement,
	onItemPlacementYawChange: rawOnItemPlacementYawChange,
	onMoveDoorOpening: rawOnMoveDoorOpening,
	onMoveItem: rawOnMoveItem,
	onMoveWall: rawOnMoveWall,
	onMoveWallVertex: rawOnMoveWallVertex,
	onResolveSplitHostConflict: rawOnResolveSplitHostConflict,
	onSplitWall: rawOnSplitWall,
	onRotateItem: rawOnRotateItem,
	onPlaceItem: rawOnPlaceItem,
	onSelectItem,
	onSelectWall,
	onSelectOpening,
	onClearSelection,
	onWallMoveModeChange,
	onWallSplitModeChange,
	onWallVertexMoveModeChange,
	project,
	selectedItemId,
	selectedWallId,
	wallThicknessMm,
	viewport,
	setViewport,
	onPwaUpdateSafetyChange,
}: PlanProjectionProps) {
	const wallHatchId = `wall-hatch-${useId()}`;
	const hostGateRef = useRef(createEditorInteractionGate());
	const hostGateDisposed = useRef(false);
	const [, renderHostEpoch] = useState<EditorContactEpoch>(() => hostGateRef.current.capture());
	const hostEnabledRef = useRef(registerTransientBoundary !== undefined);
	hostEnabledRef.current = registerTransientBoundary !== undefined;
	const hostContacts = useRef(new Map<number, {
		readonly epoch: EditorContactEpoch;
		readonly kind: "camera" | "draft";
		readonly base: typeof project;
		readonly projection: string;
		readonly itemId?: string;
	}>());
	const revokedHostContacts = useRef(new Set<number>());
	const hostDraftState = useRef(false);
	const hostDraftContactEpoch = useRef<EditorContactEpoch | undefined>(undefined);
	const hostSelection = useRef(selectedItemId);
	hostSelection.current = selectedItemId;
	const hostCommand = <T,>(operation: () => T | Promise<T>, unavailable: T): Promise<T> =>
		hostGateRef.current.canBegin() ? hostGateRef.current.run(operation) : Promise.resolve(unavailable);
	const onDrawWall: PlanProjectionProps["onDrawWall"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnDrawWall(input), false) : rawOnDrawWall(input);
	const onMoveDoorOpening: PlanProjectionProps["onMoveDoorOpening"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnMoveDoorOpening(input), false) : rawOnMoveDoorOpening(input);
	const onMoveItem: PlanProjectionProps["onMoveItem"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnMoveItem(input), false) : rawOnMoveItem(input);
	const onMoveWall: PlanProjectionProps["onMoveWall"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnMoveWall(input), false) : rawOnMoveWall(input);
	const onMoveWallVertex: PlanProjectionProps["onMoveWallVertex"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnMoveWallVertex(input), false) : rawOnMoveWallVertex(input);
	const onResolveSplitHostConflict: PlanProjectionProps["onResolveSplitHostConflict"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnResolveSplitHostConflict(input), "rejected" as const) : rawOnResolveSplitHostConflict(input);
	const onSplitWall: PlanProjectionProps["onSplitWall"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnSplitWall(input), { kind: "rejected" as const }) : rawOnSplitWall(input);
	const onRotateItem: PlanProjectionProps["onRotateItem"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnRotateItem(input), false) : rawOnRotateItem(input);
	const onPlaceItem: PlanProjectionProps["onPlaceItem"] = (input) => hostEnabledRef.current ? hostCommand(() => rawOnPlaceItem(input), undefined) : rawOnPlaceItem(input);
	const onItemPlacementYawChange: PlanProjectionProps["onItemPlacementYawChange"] = (value) => {
		if (!hostEnabledRef.current || hostGateRef.current.canBegin()) {
			rawOnItemPlacementYawChange(value);
		}
	};
	const pointers = useRef(new Map<number, PointerPosition>());
	const planSvgRef = useRef<SVGSVGElement>(null);
	const placementRotationContact = useRef<{
		readonly pointerId: number;
		readonly centre: PointerPosition;
		gesture: RotationDomeGesture | undefined;
	}>(undefined);
	const [hasPlacementRotationContact, setHasPlacementRotationContact] =
		useState(false);
	const [canvasSize, setCanvasSize] = useState<CanvasSize>(
		initialPlanCanvasSize,
	);
	const [wallDraft, setWallDraft] = useState<WallDraft>();
	const [isConfirmingWallDraft, setIsConfirmingWallDraft] = useState(false);
	const [wallMoveDraft, setWallMoveDraft] = useState<WallMoveDraft>();
	const [isConfirmingWallMove, setIsConfirmingWallMove] = useState(false);
	const [wallSplitDraft, setWallSplitDraft] = useState<WallSplitDraft>();
	const [isConfirmingWallSplit, setIsConfirmingWallSplit] = useState(false);
	const [wallSplitHostConflict, setWallSplitHostConflict] = useState<
		| {
				readonly input: WallSplitDraft;
				readonly itemIds: readonly string[];
				readonly openingIds: readonly string[];
				readonly previewRevisionId: string;
		  }
		| undefined
	>();
	const [
		isResolvingWallSplitHostConflict,
		setIsResolvingWallSplitHostConflict,
	] = useState(false);
	const [wallVertexMoveDraft, setWallVertexMoveDraft] =
		useState<WallVertexMoveDraft>();
	const [isConfirmingWallVertexMove, setIsConfirmingWallVertexMove] =
		useState(false);
	const wallDraftCancelledByMultiTouch = useRef(false);
	const wallDraftCancelledPointerIds = useRef(new Set<number>());
	const itemDragCancelledByMultiTouch = useRef(false);
	const [itemDrag, setItemDrag] = useState<{
		readonly assetInstanceId: string;
		readonly end: { readonly xMm: number; readonly zMm: number };
		readonly moved: boolean;
		readonly pointerOrigin: PointerPosition;
		readonly pointerToItemOffset: {
			readonly xMm: number;
			readonly zMm: number;
		};
		readonly start: { readonly xMm: number; readonly zMm: number };
	}>();
	const [canvasInsets, setCanvasInsets] = useState({ top: 116, bottom: 96 });
	const [annotationObstacles, setAnnotationObstacles] = useState<
		readonly ScreenRect[]
	>([]);
	const hostLayout = useRef({ canvasSize, canvasInsets, viewport });
	hostLayout.current = { canvasSize, canvasInsets, viewport };
	function hostProjectionKey(): string | undefined {
		const canvas = planSvgRef.current;
		const box = canvas?.getBoundingClientRect();
		if (!canvas || !box || box.width <= 0 || box.height <= 0) return undefined;
		const layout = hostLayout.current;
		const matrix = canvas.getScreenCTM();
		return JSON.stringify([box.left, box.top, box.width, box.height,
			layout.canvasSize.canvasWidth, layout.canvasSize.canvasHeight,
			layout.canvasInsets.top, layout.canvasInsets.bottom,
			layout.viewport.panX, layout.viewport.panY, layout.viewport.zoom,
			matrix?.a, matrix?.b, matrix?.c, matrix?.d, matrix?.e, matrix?.f]);
	}
	const liveProjectRef = useRef(project);
	liveProjectRef.current = project;
	function hasHostContactDraft(): boolean {
		return !!(wallDraftRef.current || wallMoveDraftRef.current || wallSplitDraftRef.current || wallVertexMoveDraftRef.current || itemDragRef.current || itemRotationRef.current || doorOpeningDragRef.current || itemPlacementDragRef.current || placementRotationContact.current);
	}
	function markHostDraftContact(pointerId: number): void {
		const contact = hostEnabledRef.current ? hostContacts.current.get(pointerId) : undefined;
		if (contact) hostContacts.current.set(pointerId, { ...contact, kind: "draft" });
		hostDraftContactEpoch.current = contact?.epoch;
	}
	function isHostContactCurrent(pointerId: number): boolean {
		if (revokedHostContacts.current.has(pointerId)) return false;
		if (!hostEnabledRef.current) return true;
		const contact = hostContacts.current.get(pointerId);
		if (!contact) return false;
		const draft = contact.kind === "draft";
		if (!hostGateRef.current.isCurrent(contact.epoch) || contact.base !== liveProjectRef.current ||
			(draft && (contact.projection !== hostProjectionKey() || (contact.itemId !== undefined && contact.itemId !== hostSelection.current)))) {
			invalidateHostContacts();
			return false;
		}
		return !draft || hostDraftContactEpoch.current === undefined || hostDraftContactEpoch.current === contact.epoch;
	}
	function releaseHostContact(pointerId: number): void {
		hostContacts.current.delete(pointerId);
		pointers.current.delete(pointerId);
		touchContacts.current.delete(pointerId);
		if (pointers.current.size === 0) gesture.current = undefined;
	}
	const readOnlyRef = useRef(readOnly);
	readOnlyRef.current = readOnly;
	const splitGrabRef = useRef<
		| {
				readonly pointerId: number;
				readonly origin: { xMm: number; zMm: number };
				readonly pointerStart: { xMm: number; zMm: number };
				readonly base: typeof project;
		  }
		| undefined
	>(undefined);
	const splitBaseRef = useRef(project);
	const [splitUnavailable, setSplitUnavailable] = useState(false);
	const [doorOpeningDrag, setDoorOpeningDrag] = useState<DoorOpeningDrag>();
	const doorOpeningDragRef = useRef<DoorOpeningDrag | undefined>(undefined);
	const openingDragAssessment = useMemo(
		() =>
			project.schemaVersion === 1 && doorOpeningDrag
				? moveDoorOpeningInProject(
						project,
						{
							openingId: doorOpeningDrag.openingId,
							offsetMm: doorOpeningDrag.offsetMm,
						},
						project.updatedAt,
					)
				: undefined,
		[project, doorOpeningDrag],
	);
	const openingDragError =
		openingDragAssessment?.kind === "rejected"
			? openingDragAssessment.reasonCode
			: undefined;
	const [pendingDoorOpeningMove, setPendingDoorOpeningMove] = useState<{
		readonly openingId: string;
		readonly offsetMm: number;
	}>();
	const openingPreview = doorOpeningDrag ?? pendingDoorOpeningMove;
	const dimensionProject = useMemo(
		() =>
			project.schemaVersion === 1 && openingPreview
				? {
						...project,
						level: {
							...project.level,
							openings: project.level.openings.map((opening) =>
								opening.openingId === openingPreview.openingId
									? { ...opening, offsetMm: openingPreview.offsetMm }
									: opening,
							),
						},
					}
				: project,
		[project, openingPreview],
	);
	const drawingDimensions = useMemo(
		() =>
			dimensionProject.schemaVersion === 1
				? selectDrawingDimensions(
						filterDrawingDimensions(
							drawingDimensionsFor(dimensionProject),
							dimensionVisibility,
						),
					)
				: [],
		[dimensionProject, dimensionVisibility],
	);
	const hasDimensionCandidates = drawingDimensions.length > 0;
	const [dimensionTypography, setDimensionTypography] = useState<{
		readonly measureText: (label: string) => {
			readonly width: number;
			readonly height: number;
		};
	}>();
	useLayoutEffect(() => {
		if (!hasDimensionCandidates) return;
		let disposed = false;
		const update = () => {
			const svg = planSvgRef.current;
			if (disposed || !svg) return;
			const context = document.createElement("canvas").getContext("2d");
			if (!context) return;
			const text = svg.querySelector('[data-testid="drawing-dimensions"] text');
			if (text) {
				const style = getComputedStyle(text);
				context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			} else {
				context.font = `500 14px ${getComputedStyle(svg).getPropertyValue("--font-mono").trim() || "monospace"}`;
			}
			setDimensionTypography({
				measureText: (label) => {
					const metric = context.measureText(label);
					const fontHeight =
						metric.fontBoundingBoxAscent + metric.fontBoundingBoxDescent;
					return {
						width: metric.width + 8,
						height: Math.max(
							18,
							(Number.isFinite(fontHeight)
								? fontHeight
								: metric.actualBoundingBoxAscent +
									metric.actualBoundingBoxDescent) + 8,
						),
					};
				},
			});
		};
		update();
		const observer = new ResizeObserver(update);
		if (planSvgRef.current) observer.observe(planSvgRef.current);
		void document.fonts.ready.then(update, () => undefined);
		document.fonts.addEventListener("loadingdone", update);
		return () => {
			disposed = true;
			observer.disconnect();
			document.fonts.removeEventListener("loadingdone", update);
		};
	}, [hasDimensionCandidates]);
	const [isConfirmingDoorOpeningMove, setIsConfirmingDoorOpeningMove] =
		useState(false);
	const itemDragRef = useRef<typeof itemDrag>(undefined);
	const hostRetainedItemDrag = useRef<typeof itemDrag>(undefined);
	const itemDragPointerIdRef = useRef<number | undefined>(undefined);
	const itemDragCancelledPointerIds = useRef(new Set<number>());
	// React may batch the state clearing below. This ref records the gesture
	// fact synchronously, so the first touchEnd of a pinch cannot publish a
	// move through a stale render closure.
	const itemDragSawMultiTouchRef = useRef(false);
	const [itemRotation, setItemRotation] = useState<{
		readonly assetInstanceId: string;
		readonly pointerId: number;
		readonly yawRadians: number;
		readonly relative?: { readonly centre: PointerPosition; readonly gesture: RotationDomeGesture };
	}>();
	// Keep the released pose visible until its automatic Durable Revision
	// arrives. This is not a confirmation draft: the mutation starts as soon as
	// the pointer is released.
	const [submittedItemTransform, setSubmittedItemTransform] = useState<
		| {
				readonly assetInstanceId: string;
				readonly kind: "move";
				readonly xMm: number;
				readonly zMm: number;
		  }
		| {
				readonly assetInstanceId: string;
				readonly kind: "rotation";
				readonly yawRadians: number;
		  }
		| undefined
	>();
	const [isConfirmingItemTransform, setIsConfirmingItemTransform] =
		useState(false);
	const itemRotationRef = useRef<typeof itemRotation>(undefined);
	function retainedHostItemTransform(): { readonly assetInstanceId: string; readonly kind: "move" | "rotation" } | undefined {
		if (!hostEnabledRef.current) return undefined;
		const revokedDraftContact = hostDraftContactEpoch.current !== hostGateRef.current.capture();
		const move = itemDragRef.current;
		if (move && (revokedDraftContact || hostRetainedItemDrag.current !== undefined)) return { assetInstanceId: move.assetInstanceId, kind: "move" };
		const rotation = itemRotationRef.current;
		return rotation && revokedDraftContact ? { assetInstanceId: rotation.assetInstanceId, kind: "rotation" } : undefined;
	}

	const touchContacts = useRef(new Set<number>());
	const activeTouchCount = useRef(0);
	const wallDraftRef = useRef<WallDraft | undefined>(undefined);
	const wallMoveDraftRef = useRef<WallMoveDraft | undefined>(undefined);
	const wallSplitDraftRef = useRef<WallSplitDraft | undefined>(undefined);
	const wallVertexMoveDraftRef = useRef<WallVertexMoveDraft | undefined>(
		undefined,
	);
	const moveDraftProjectRef = useRef(project);
	const pointerCountAtItemDragStartRef = useRef(0);
	const [itemPoint, setItemPoint] = useState<ItemPlacementPoint | undefined>(initialItemPlacementPoint);
	const [itemPointIsExact, setItemPointIsExact] = useState(initialItemPlacementPoint !== undefined);
	const [isConfirmingItemPlacement, setIsConfirmingItemPlacement] =
		useState(false);
	const itemPlacementConfirmationIdRef = useRef(0);
	// A tap may deliver pointerdown and pointerup before React has committed the
	// state update from pointerdown.  Placement is a gesture, so its endpoint
	// needs the same synchronous source of truth as a wall draft or item drag.
	const itemPointRef = useRef(initialItemPlacementPoint);
	const itemPointIsExactRef = useRef(initialItemPlacementPoint !== undefined);
	const updateItemPoint = useCallback((next: ItemPlacementPoint | undefined, exact = false) => {
		itemPointRef.current = next;
		itemPointIsExactRef.current = exact;
		setItemPoint(next);
		setItemPointIsExact(exact);
	}, []);
	const itemPlacementDragRef = useRef<ItemPlacementDrag | undefined>(undefined);
	// A wall can be tapped to select it, but it must not steal a drag
	// that starts on the drawing.  Keep the possible selection transient until
	// pointerup; a movement beyond the normal tap tolerance is a canvas pan.
	const pendingCanvasSelectionRef = useRef<
		| {
				readonly pointerId: number;
				readonly pointerOrigin: PointerPosition;
				readonly wallSegmentId?: string;
		  }
		| undefined
	>(undefined);
	const viewportRef = useRef(viewport);
	const gesture = useRef<
		| {
				readonly kind: "pan";
				readonly origin: PointerPosition;
				readonly viewport: EditorViewport;
		  }
		| {
				readonly centre: PointerPosition;
				readonly kind: "pinch";
				readonly distance: number;
				readonly viewport: EditorViewport;
		  }
		| undefined
	>(undefined);
	const resetDirectManipulationContacts = useCallback(() => {
		if (!doorOpeningDragRef.current && !splitGrabRef.current) return;
		pointers.current.clear();
		touchContacts.current.clear();
		activeTouchCount.current = 0;
		gesture.current = undefined;
	}, []);
	const livePlacementYawChange = useRef(onItemPlacementYawChange);
	livePlacementYawChange.current = onItemPlacementYawChange;
	const cancelPlacementRotation = useCallback(() => {
		const contact = placementRotationContact.current;
		const rotation = contact?.gesture;
		if (!contact || !rotation) return;
		contact.gesture = undefined;
		livePlacementYawChange.current(rotation.initialYawRadians);
	}, []);

	useEffect(() => {
		const outsidePointer = (event: PointerEvent) => {
			if (event.target instanceof Node && planSvgRef.current?.contains(event.target)) return;
			cancelPlacementRotation();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") cancelPlacementRotation();
		};
		const onBlur = (event: Event) => {
			if (event.target === window && !hostEnabledRef.current) cancelPlacementRotation();
		};
		const onVisibility = () => {
			if (document.hidden && !hostEnabledRef.current) cancelPlacementRotation();
		};
		window.addEventListener("pointerdown", outsidePointer, true);
		window.addEventListener("keydown", onKey);
		window.addEventListener("blur", onBlur);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("pointerdown", outsidePointer, true);
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("blur", onBlur);
			document.removeEventListener("visibilitychange", onVisibility);
			if (!hostEnabledRef.current) cancelPlacementRotation();
		};
	}, [cancelPlacementRotation]);

	useLayoutEffect(() => {
		if (hostGateDisposed.current) {
			hostGateRef.current = createEditorInteractionGate();
			hostGateDisposed.current = false;
		}
		return () => {
			hostGateRef.current.dispose();
			hostGateDisposed.current = true;
			for (const id of hostContacts.current.keys()) revokedHostContacts.current.add(id);
			hostContacts.current.clear();
		};
	}, []);
	useEffect(() => {
		const cancelForOutsidePointer = (event: PointerEvent) => {
			if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
			const opening = doorOpeningDragRef.current;
			const split = splitGrabRef.current;
			const ownerId = opening?.pointerId ?? split?.pointerId;
			if (ownerId === undefined || event.pointerId === ownerId) return;
			// Canvas contacts are handled by its pinch arbiter. A second contact
			// on editor chrome must also cancel, without blocking that control.
			if (
				event.target instanceof Node &&
				planSvgRef.current?.contains(event.target)
			)
				return;
			resetDirectManipulationContacts();
			doorOpeningDragRef.current = undefined;
			setDoorOpeningDrag(undefined);
			splitGrabRef.current = undefined;
			if (split) {
				wallSplitDraftRef.current = undefined;
				setWallSplitDraft(undefined);
				setWallSplitHostConflict(undefined);
				setSplitUnavailable(false);
				onWallSplitModeChange(false);
			}
		};
		window.addEventListener("pointerdown", cancelForOutsidePointer, true);
		return () =>
			window.removeEventListener("pointerdown", cancelForOutsidePointer, true);
	}, [resetDirectManipulationContacts, onWallSplitModeChange]);
	const hasTransientEdit =
		wallDraft !== undefined ||
		isConfirmingWallDraft ||
		wallMoveDraft !== undefined ||
		isConfirmingWallMove ||
		wallSplitDraft !== undefined ||
		isConfirmingWallSplit ||
		wallSplitHostConflict !== undefined ||
		isResolvingWallSplitHostConflict ||
		wallVertexMoveDraft !== undefined ||
		isConfirmingWallVertexMove ||
		itemDrag !== undefined ||
		doorOpeningDrag !== undefined ||
		pendingDoorOpeningMove !== undefined ||
		isConfirmingDoorOpeningMove ||
		itemRotation !== undefined ||
		submittedItemTransform !== undefined ||
		isConfirmingItemTransform ||
		isConfirmingItemPlacement ||
		itemPoint !== undefined;

	hostDraftState.current = hasTransientEdit || itemDraft !== undefined;
	useEffect(() => {
		onPwaUpdateSafetyChange(hasTransientEdit);
		return () => onPwaUpdateSafetyChange(false);
	}, [hasTransientEdit, onPwaUpdateSafetyChange]);

	const clearLongPressPan = () => undefined;

	const clearItemDragCommit = useCallback(() => undefined, []);

	useEffect(() => {
		viewportRef.current = viewport;
	}, [viewport]);

	useEffect(() => {
		if (!submittedItemTransform) return;
		const durableItem = project.assetInstances.find(
			(item) => item.assetInstanceId === submittedItemTransform.assetInstanceId,
		);
		const isDurable =
			durableItem &&
			(submittedItemTransform.kind === "move"
				? isFloorEditorAsset(durableItem) &&
					durableItem.xMm === submittedItemTransform.xMm &&
					durableItem.zMm === submittedItemTransform.zMm
				: isFloorEditorAsset(durableItem) &&
					yawRadiansForEditorFloorAsset(durableItem) ===
						submittedItemTransform.yawRadians);
		if (isDurable) setSubmittedItemTransform(undefined);
	}, [project, submittedItemTransform]);

	useEffect(() => {
		if (!hasProjectRevisionChanged(moveDraftProjectRef.current, project))
			return;
		moveDraftProjectRef.current = project;
		resetDirectManipulationContacts();
		doorOpeningDragRef.current = undefined;
		setDoorOpeningDrag(undefined);
		setPendingDoorOpeningMove(undefined);
		splitGrabRef.current = undefined;
		splitBaseRef.current = project;
		setSplitUnavailable(false);
		setWallDraft(undefined);
		wallDraftRef.current = undefined;
		wallDraftCancelledByMultiTouch.current = false;
		wallDraftCancelledPointerIds.current.clear();
		setIsConfirmingWallDraft(false);
		setWallMoveDraft(undefined);
		wallMoveDraftRef.current = undefined;
		setIsConfirmingWallMove(false);
		setWallVertexMoveDraft(undefined);
		wallVertexMoveDraftRef.current = undefined;
		setIsConfirmingWallVertexMove(false);
		setWallSplitDraft(undefined);
		wallSplitDraftRef.current = undefined;
		setWallSplitHostConflict(undefined);
		setIsConfirmingWallSplit(false);
		setIsResolvingWallSplitHostConflict(false);
		onWallMoveModeChange(false);
		onWallSplitModeChange(false);
		onWallVertexMoveModeChange(false);
	}, [
		project,
		resetDirectManipulationContacts,
		onWallMoveModeChange,
		onWallSplitModeChange,
		onWallVertexMoveModeChange,
	]);

	useEffect(() => {
		const cancel = () => {
			if (isConfirmingWallSplit || isResolvingWallSplitHostConflict) return;
			resetDirectManipulationContacts();
			doorOpeningDragRef.current = undefined;
			setDoorOpeningDrag(undefined);
			splitGrabRef.current = undefined;
			setWallSplitDraft(undefined);
			wallSplitDraftRef.current = undefined;
			setWallSplitHostConflict(undefined);
			setSplitUnavailable(false);
		};
		if (readOnly || activeTool !== "select") cancel();
		const onKey = (event: KeyboardEvent) => {
			if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
			if (event.key === "Escape") cancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		readOnly,
		activeTool,
		resetDirectManipulationContacts,
		isConfirmingWallSplit,
		isResolvingWallSplitHostConflict,
	]);

	useLayoutEffect(() => {
		const canvas = planSvgRef.current;
		if (!canvas) return undefined;
		// Selection mounts a different inspector; attach observers to that current
		// surface without changing the fit of the plan when it opens.
		const inspectorSelectors = [
			...(activeTool === "select" && selectedWallId
				? ['[data-testid="selected-wall-inspector"]']
				: []),
			...(activeTool === "select" && selectedItemId
				? ['[data-testid="selected-item-inspector"]']
				: []),
		];
		const syncCanvasSize = () => {
			const bounds = canvas.getBoundingClientRect();
			const shell = canvas.closest('[data-testid="editor-workspace"]');
			const header = shell?.querySelector('[data-testid="editor-top-bar"]');
			const dock = shell?.querySelector('[data-testid="editor-action-dock"]');
			const top = Math.max(
				0,
				(header?.getBoundingClientRect().bottom ?? bounds.top) - bounds.top,
			);
			const visibleBottom = Math.min(bounds.bottom, shell?.getBoundingClientRect().bottom ?? bounds.bottom);
			const measuredBottom = Math.max(
				0,
				visibleBottom - (dock?.getBoundingClientRect().top ?? visibleBottom),
			);
			setCanvasInsets((previous) => {
				// The opening sheet temporarily replaces the dock and autofocuses its input.
				const bottom = !dock && isInteractionLocked && shell?.getAttribute("data-editor-host") === "telegram"
					? previous.bottom
					: measuredBottom;
				return previous.top === top && previous.bottom === bottom ? previous : { top, bottom };
			});
			const obstacles = [
				...(inspectorSelectors.length
					? (shell?.querySelectorAll(inspectorSelectors.join(",")) ?? [])
					: []),
			].flatMap((element) => {
				const box = element.getBoundingClientRect();
				return box.width > 0 && box.height > 0
					? [
							{
								x: box.left - bounds.left - 4,
								y: box.top - bounds.top - 4,
								width: box.width + 8,
								height: box.height + 8,
							},
						]
					: [];
			});
			setAnnotationObstacles((previous) =>
				JSON.stringify(previous) === JSON.stringify(obstacles)
					? previous
					: obstacles,
			);
			const next = {
				canvasHeight: Math.max(1, Math.round(bounds.height)),
				canvasWidth: Math.max(1, Math.round(bounds.width)),
			};
			setCanvasSize((previous) =>
				previous.canvasHeight === next.canvasHeight &&
				previous.canvasWidth === next.canvasWidth
					? previous
					: next,
			);
		};
		syncCanvasSize();
		const observer = new ResizeObserver(syncCanvasSize);
		observer.observe(canvas);
		const shell = canvas.closest('[data-testid="editor-workspace"]');
		for (const target of shell?.querySelectorAll(
			[
				'[data-testid="editor-top-bar"]',
				'[data-testid="editor-action-dock"]',
				...inspectorSelectors,
			].join(","),
		) ?? [])
			observer.observe(target);
		return () => observer.disconnect();
	}, [selectedWallId, selectedItemId, activeTool, isInteractionLocked]);

	useEffect(() => {
		if (activeTool !== "wall") {
			setWallDraft(undefined);
			wallDraftRef.current = undefined;
			wallDraftCancelledByMultiTouch.current = false;
			wallDraftCancelledPointerIds.current.clear();
		}
		if (activeTool !== "item") {
			setHasPlacementRotationContact(false);
			placementRotationContact.current = undefined;
			updateItemPoint(undefined);
			itemPlacementDragRef.current = undefined;
		}
		if (activeTool !== "select" || !isWallMoveMode) {
			setWallMoveDraft(undefined);
			wallMoveDraftRef.current = undefined;
			setIsConfirmingWallMove(false);
		}
		if (activeTool !== "select" || !isWallSplitMode) {
			setWallSplitDraft(undefined);
			wallSplitDraftRef.current = undefined;
			setIsConfirmingWallSplit(false);
		}
		if (activeTool !== "select" || !isWallVertexMoveMode) {
			setWallVertexMoveDraft(undefined);
			wallVertexMoveDraftRef.current = undefined;
			setIsConfirmingWallVertexMove(false);
		}
		setItemDrag(undefined);
		setDoorOpeningDrag(undefined);
		doorOpeningDragRef.current = undefined;
		itemDragRef.current = undefined;
		itemDragCancelledPointerIds.current.clear();
		itemDragSawMultiTouchRef.current = false;
		clearItemDragCommit();
		itemDragPointerIdRef.current = undefined;
		pendingCanvasSelectionRef.current = undefined;
	}, [
		activeTool,
		clearItemDragCommit,
		isWallMoveMode,
		isWallSplitMode,
		isWallVertexMoveMode,
		updateItemPoint,
	]);

	useEffect(() => () => clearItemDragCommit(), [clearItemDragCommit]);

	const startPan = (origin: PointerPosition) => {
		gesture.current = { kind: "pan", origin, viewport: viewportRef.current };
	};
	function finishRetainedHostCameraContact(pointerId: number): boolean {
		if (!hostEnabledRef.current || hostContacts.current.get(pointerId)?.kind !== "camera" || !hasHostContactDraft()) return false;
		clearLongPressPan();
		pendingCanvasSelectionRef.current = undefined;
		releaseHostContact(pointerId);
		activeTouchCount.current = touchContacts.current.size;
		return true;
	}

	const visibleCanvasCentre = () => ({
		x: canvasSize.canvasWidth / 2,
		y: canvasSize.canvasHeight / 2,
	});

	const vertices = project.level.vertices;
	const wallBodiesById = new Map(
		wallBodiesForProjection(project.level).map((body) => [
			body.wallSegmentId,
			body,
		]),
	);
	const { minX, maxX, minZ, maxZ } = visiblePlanFrame(vertices, true);
	const resolvedPlan = derivedPlanFor(project);
	const derivedPlan =
		resolvedPlan.kind === "accepted" ? resolvedPlan.plan : undefined;
	const roomFaceTiles =
		derivedPlan?.rooms.flatMap((room) =>
			room.faceTilesMm.map((tile, tileIndex) => ({
				key: `${room.roomId}:${tileIndex}`,
				roomId: room.roomId,
				tile,
			})),
		) ?? [];
	const roomFacePolygons =
		derivedPlan?.rooms.flatMap((room) =>
			room.facePolygonMm && room.facePolygonMm.length >= 3
				? [
						{
							key: `${room.roomId}:polygon`,
							roomId: room.roomId,
							vertices: room.facePolygonMm,
						},
					]
				: [],
		) ?? [];
	const roomTypesById = new Map(
		project.schemaVersion === 1
			? project.level.rooms.map(
					(room) =>
						[room.roomId, roomTypeLabels[room.type ?? "other"]] as const,
				)
			: [],
	);
	const roomLabels =
		derivedPlan?.rooms.flatMap((room) => {
			const tile = room.usableFloorTilesMm[0];
			const polygon = room.usableFloorPolygonMm;
			if (polygon && polygon.length >= 3) {
				return [
					{
						label: roomTypesById.get(room.roomId) ?? roomTypeLabels.other,
						roomId: room.roomId,
						xMm:
							polygon.reduce((sum, point) => sum + point.xMm, 0) /
							polygon.length,
						zMm:
							polygon.reduce((sum, point) => sum + point.zMm, 0) /
							polygon.length,
					},
				];
			}
			return tile && room.usableFloorTilesMm.length === 1
				? [
						{
							label: roomTypesById.get(room.roomId) ?? roomTypeLabels.other,
							roomId: room.roomId,
							xMm: (tile.minXmm + tile.maxXmm) / 2,
							zMm: (tile.minZmm + tile.maxZmm) / 2,
						},
					]
				: [];
		}) ?? [];
	const roomMeasurements =
		derivedPlan?.rooms.flatMap((room) => {
			const measurement = roomMeasurementFor(room);
			const tile = room.usableFloorTilesMm[0];
			const polygon = room.usableFloorPolygonMm;
			const bounds =
				tile && room.usableFloorTilesMm.length === 1
					? tile
					: polygon && polygon.length >= 3
						? {
								maxXmm: Math.max(...polygon.map((point) => point.xMm)),
								maxZmm: Math.max(...polygon.map((point) => point.zMm)),
								minXmm: Math.min(...polygon.map((point) => point.xMm)),
								minZmm: Math.min(...polygon.map((point) => point.zMm)),
							}
						: undefined;
			return measurement && bounds
				? [{ bounds, measurement, roomId: room.roomId }]
				: [];
		}) ?? [];
	const exteriorWallSegmentIds = new Set(
		derivedPlan?.walls
			.filter((wall) => wall.exteriorNormal !== undefined)
			.map((wall) => wall.wallSegmentId) ?? [],
	);
	const planWidthMm = maxX - minX;
	const planDepthMm = maxZ - minZ;
	const usableCanvasHeight = Math.max(
		48,
		canvasSize.canvasHeight - canvasInsets.top - canvasInsets.bottom - 16,
	);
	const drawingScale = Math.min(
		Math.max(96, canvasSize.canvasWidth - 180) / planWidthMm,
		Math.max(48, usableCanvasHeight - 144) / planDepthMm,
	);
	const currentWallJoinRadiusMm = () =>
		wallJoinTargetRadiusMm(drawingScale * viewportRef.current.zoom) ?? 0;
	const maximumViewportZoom = maximumEditorZoomForGrid(
		drawingScale,
		PLAN_GRID_STEP_MM,
	);
	const renderedWidth = planWidthMm * drawingScale;
	const renderedDepth = planDepthMm * drawingScale;
	const x = (canvasSize.canvasWidth - renderedWidth) / 2;
	const y = canvasInsets.top + 16 + (usableCanvasHeight - renderedDepth) / 2;
	const pointFor = (xMm: number, zMm: number) => ({
		x: x + (xMm - minX) * drawingScale,
		y: y + (zMm - minZ) * drawingScale,
	});
	const roomMeasurementLayouts = roomDimensionLayouts(
		roomMeasurements.map(({ bounds, measurement, roomId }) => {
			const start = pointFor(bounds.minXmm, bounds.minZmm);
			const end = pointFor(bounds.maxXmm, bounds.maxZmm);
			const anchor = pointFor(measurement.centerXMm, measurement.centerZMm);
			const sizeLabel =
				measurement.kind === "rectangular"
					? `${formatLengthMm(measurement.widthMm)} × ${formatLengthMm(measurement.depthMm)}`
					: "По внутреннему контуру";
			const width = end.x - start.x;
			const height = end.y - start.y;
			return {
				height,
				key: roomId,
				labelWidth: sizeLabel.length * 5.8,
				width,
				x: anchor.x - width / 2,
				y: anchor.y - height / 2,
			};
		}),
	);
	const canvasPointFor = (event: ReactPointerEvent<SVGSVGElement>) =>
		canvasPointFromClient(
			event,
			event.currentTarget.getBoundingClientRect(),
			canvasSize,
		);
	const projectPointFor = (event: ReactPointerEvent<SVGSVGElement>) => {
		const canvasPoint = canvasPointFor(event);
		return {
			xMm:
				minX +
				((canvasPoint.x - viewportRef.current.panX) / viewportRef.current.zoom -
					x) /
					drawingScale,
			zMm:
				minZ +
				((canvasPoint.y - viewportRef.current.panY) / viewportRef.current.zoom -
					y) /
					drawingScale,
		};
	};
	const placementPointerPointFor = (event: ReactPointerEvent<SVGSVGElement>) => {
		const point = projectPointFor(event);
		return floorItemWallSnap ? point : snappedPoint(point);
	};
	const itemMovePointFor = (point: { readonly xMm: number; readonly zMm: number }, assetInstanceId?: string) => {
		const fallback = snappedPoint(point);
		if (!floorItemWallSnap || assetInstanceId === undefined) return fallback;
		const asset = project.assetInstances.find((item) => item.assetInstanceId === assetInstanceId);
		if (!asset || !isFloorEditorAsset(asset)) return fallback;
		return floorItemWallSnap({
			target: point,
			fallback,
			assetInstanceId,
			footprint: asset,
		});
	};
	const wallMoveAxisFor = (wallSegmentId: string): WallMoveAxis | undefined => {
		const wall = project.level.wallSegments.find(
			(candidate) => candidate.wallSegmentId === wallSegmentId,
		);
		const start = wall
			? project.level.vertices.find(
					(vertex) => vertex.vertexId === wall.startVertexId,
				)
			: undefined;
		const end = wall
			? project.level.vertices.find(
					(vertex) => vertex.vertexId === wall.endVertexId,
				)
			: undefined;
		if (!start || !end) return undefined;
		if (start.xMm === end.xMm) {
			return {
				axis: "x" as const,
				end,
				kind: "cardinal" as const,
				positionMm: start.xMm,
				start,
			};
		}
		if (start.zMm === end.zMm) {
			return {
				axis: "z" as const,
				end,
				kind: "cardinal" as const,
				positionMm: start.zMm,
				start,
			};
		}
		const deltaX = end.xMm - start.xMm;
		const deltaZ = end.zMm - start.zMm;
		if (deltaX !== 0 && Math.abs(deltaX) === Math.abs(deltaZ)) {
			return {
				end,
				kind:
					Math.sign(deltaX) === Math.sign(deltaZ)
						? ("diagonal-rising" as const)
						: ("diagonal-falling" as const),
				start,
			};
		}
		return undefined;
	};
	const wallVertexMoveAxisAt = (vertexId: string) =>
		wallVertexMoveAxisFor(
			vertexId,
			project.level.wallSegments,
			project.level.vertices,
		);
	const wallSplitPointFor = (
		wallSegmentId: string,
		point: { readonly xMm: number; readonly zMm: number },
	) => {
		const wall = project.level.wallSegments.find(
			(candidate) => candidate.wallSegmentId === wallSegmentId,
		);
		const start = wall
			? project.level.vertices.find(
					(vertex) => vertex.vertexId === wall.startVertexId,
				)
			: undefined;
		const end = wall
			? project.level.vertices.find(
					(vertex) => vertex.vertexId === wall.endVertexId,
				)
			: undefined;
		if (!start || !end) return undefined;
		const pointMm = wallSplitPointForPointer({
			startMm: start,
			endMm: end,
			pointerMm: point,
		});
		return pointMm ? { pointMm, wallSegmentId } : undefined;
	};
	const clearWallMoveDraft = () => {
		setWallMoveDraft(undefined);
		wallMoveDraftRef.current = undefined;
		setIsConfirmingWallMove(false);
	};
	const cancelWallMoveDraft = () => {
		clearWallMoveDraft();
		onWallMoveModeChange(false);
	};
	const confirmWallMoveDraft = async () => {
		if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
		const candidate = wallMoveDraftRef.current;
		if (
			candidate?.phase !== "ready" ||
			readOnly ||
			(candidate.kind === "cardinal"
				? candidate.positionMm === candidate.originalPositionMm
				: candidate.translationMm.xMm === 0 &&
					candidate.translationMm.zMm === 0) ||
			isConfirmingWallMove
		) {
			return;
		}
		setIsConfirmingWallMove(true);
		const accepted = await onMoveWall(
			candidate.kind === "cardinal"
				? {
						positionMm: candidate.positionMm,
						wallSegmentId: candidate.wallSegmentId,
					}
				: {
						translationMm: candidate.translationMm,
						wallSegmentId: candidate.wallSegmentId,
					},
		);
		setIsConfirmingWallMove(false);
		if (accepted) {
			clearWallMoveDraft();
			onWallMoveModeChange(false);
		}
	};
	const clearWallSplitDraft = () => {
		splitGrabRef.current = undefined;
		setSplitUnavailable(false);
		setWallSplitDraft(undefined);
		wallSplitDraftRef.current = undefined;
		setWallSplitHostConflict(undefined);
		setIsConfirmingWallSplit(false);
		setIsResolvingWallSplitHostConflict(false);
	};
	const cancelWallSplitDraft = () => {
		clearWallSplitDraft();
		onWallSplitModeChange(false);
	};
	const confirmWallSplitDraft = async () => {
		if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
		const candidate = wallSplitDraftRef.current;
		if (
			!candidate ||
			readOnly ||
			isConfirmingWallSplit ||
			splitUnavailable ||
			splitBaseRef.current !== liveProjectRef.current
		)
			return;
		setIsConfirmingWallSplit(true);
		const result = await onSplitWall(candidate);
		setIsConfirmingWallSplit(false);
		if (result.kind === "durable") {
			clearWallSplitDraft();
			onWallSplitModeChange(false);
		} else if (result.kind === "host-conflict") {
			setWallSplitHostConflict({
				input: candidate,
				itemIds: result.itemIds,
				openingIds: result.openingIds,
				previewRevisionId: result.previewRevisionId,
			});
		}
	};
	const resolveWallSplitHostConflict = async () => {
		if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
		const conflict = wallSplitHostConflict;
		if (!conflict || readOnly || isResolvingWallSplitHostConflict) return;
		setIsResolvingWallSplitHostConflict(true);
		const result = await onResolveSplitHostConflict({
			...conflict.input,
			itemIds: conflict.itemIds,
			openingIds: conflict.openingIds,
			previewRevisionId: conflict.previewRevisionId,
		});
		setIsResolvingWallSplitHostConflict(false);
		if (result === "durable") {
			clearWallSplitDraft();
			onWallSplitModeChange(false);
		} else if (result === "stale-base") {
			clearWallSplitDraft();
			onWallSplitModeChange(false);
		}
	};
	const clearWallVertexMoveDraft = () => {
		setWallVertexMoveDraft(undefined);
		wallVertexMoveDraftRef.current = undefined;
		setIsConfirmingWallVertexMove(false);
	};
	const cancelWallVertexMoveDraft = () => {
		clearWallVertexMoveDraft();
		onWallVertexMoveModeChange(false);
	};
	const confirmWallVertexMoveDraft = async () => {
		if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
		const candidate = wallVertexMoveDraftRef.current;
		if (
			candidate?.phase !== "ready" ||
			(candidate.xMm === candidate.original.xMm &&
				candidate.zMm === candidate.original.zMm) ||
			readOnly ||
			isConfirmingWallVertexMove
		) {
			return;
		}
		setIsConfirmingWallVertexMove(true);
		const accepted = await onMoveWallVertex({
			vertexId: candidate.vertexId,
			xMm: candidate.xMm,
			zMm: candidate.zMm,
		});
		setIsConfirmingWallVertexMove(false);
		if (accepted) {
			clearWallVertexMoveDraft();
			onWallVertexMoveModeChange(false);
		}
	};

	const yawForPointer = (
		point: { readonly xMm: number; readonly zMm: number },
		center: { readonly xMm: number; readonly zMm: number },
	) => {
		const radians = Math.atan2(point.xMm - center.xMm, point.zMm - center.zMm);
		const normalizedRadians = radians < 0 ? radians + Math.PI * 2 : radians;
		return yawRadiansFor({
			yawStep: rotationStepForYawRadians(normalizedRadians),
		});
	};
	const rotationGizmoCenterFor = (item: {
		readonly xMm: number;
		readonly zMm: number;
	}) => ({
		xMm: item.xMm,
		zMm: item.zMm,
	});
	const rotationCentreInCanvas = (item: ItemPlacementPoint): PointerPosition => {
		const { x, y } = pointFor(item.xMm, item.zMm);
		const current = viewportRef.current;
		return { x: current.panX + x * current.zoom, y: current.panY + y * current.zoom };
	};
	const beginSelectedItemRotation = (item: EditorFloorAsset, event: ReactPointerEvent<SVGSVGElement>) => {
		const exact = exactFloorYaw || ("yawMilliDeg" in item && item.yawMilliDeg !== undefined);
		const previous = itemRotationRef.current;
		const centre = rotationCentreInCanvas(item);
		const relative = plainLabels || exact ? {
			centre,
			gesture: beginRotationDomeGesture({
				assetInstanceId: item.assetInstanceId,
				pointerId: event.pointerId,
				yawRadians: previous?.assetInstanceId === item.assetInstanceId ? previous.yawRadians : yawRadiansForEditorFloorAsset(item),
				point: canvasPointFor(event),
				centre,
				exact,
			}),
		} : undefined;
		const next = {
			assetInstanceId: item.assetInstanceId,
			pointerId: event.pointerId,
			relative,
			yawRadians: relative?.gesture.yawRadians ?? yawForPointer(projectPointFor(event), rotationGizmoCenterFor(item)),
		};
		itemRotationRef.current = next;
		markHostDraftContact(event.pointerId);
		setItemRotation(next);
	};
	const wallDraftSegments = project.level.wallSegments.flatMap((wall) => {
		const start = vertices.find(
			(vertex) => vertex.vertexId === wall.startVertexId,
		);
		const end = vertices.find((vertex) => vertex.vertexId === wall.endVertexId);
		return start && end ? [{ end, start }] : [];
	});
	const snapWallStart = (
		point: {
			readonly xMm: number;
			readonly zMm: number;
		},
		isStartingOnWall: boolean,
	) => {
		const radiusMm = currentWallJoinRadiusMm();
		const snapped = snapWallDraftStart(point, {
			radiusMm,
			vertices,
			...(isStartingOnWall ? { wallBodyRadiusMm: radiusMm } : {}),
			wallSegments: wallDraftSegments,
		});
		return snapped.xMm === point.xMm && snapped.zMm === point.zMm
			? snappedPoint(point)
			: { xMm: Math.round(snapped.xMm), zMm: Math.round(snapped.zMm) };
	};
	const snapWallEnd = (
		start: { readonly xMm: number; readonly zMm: number },
		point: { readonly xMm: number; readonly zMm: number },
	) => {
		const constrained = snapConstrainedWallDraftEnd(start, point, {
			radiusMm: currentWallJoinRadiusMm(),
			vertices,
			wallSegments: wallDraftSegments,
		});
		if (!constrained) return undefined;
		const normalized = normalizeWallGestureDraft(
			start,
			constrained.end,
			wallDraftSegments,
		);
		return {
			...constrained,
			start: normalized?.start ?? start,
			end: normalized?.end ?? start,
		};
	};
	const clearWallDraft = () => {
		setWallDraft(undefined);
		wallDraftRef.current = undefined;
		setIsConfirmingWallDraft(false);
	};
	const confirmWallDraft = async () => {
		if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
		const candidate = wallDraftRef.current;
		if (
			candidate?.phase !== "ready" ||
			readOnly ||
			isConfirmingWallDraft ||
			wallThicknessMm === undefined ||
			!isWallDraftConfirmable(candidate.start, candidate.end, wallThicknessMm)
		) {
			return;
		}
		setIsConfirmingWallDraft(true);
		const accepted = await onDrawWall({
			end: candidate.end,
			start: candidate.start,
			thicknessMm: wallThicknessMm,
		});
		setIsConfirmingWallDraft(false);
		if (accepted) {
			clearWallDraft();
		}
	};
	const wallDraftIsConfirmable =
		wallDraft?.phase === "ready" &&
		!readOnly &&
		!isConfirmingWallDraft &&
		wallThicknessMm !== undefined &&
		isWallDraftConfirmable(wallDraft.start, wallDraft.end, wallThicknessMm);
	const itemPlacementPreview = useMemo(() => {
		if (
			activeTool !== "item" ||
			!itemPoint ||
			!itemDraft ||
			project.schemaVersion !== 1
		) {
			return undefined;
		}
		const { color, depthMm, heightMm, label, widthMm } = itemDraft;
		const dimensions = { color, depthMm, heightMm, label, widthMm };
		const footprint = { depthMm, widthMm, ...floorYawFieldsForRadians(itemDraft.yawRadians, exactFloorYaw) };
		const point = itemPointIsExact
			? itemPoint
			: (floorItemWallSnap?.({ target: itemPoint, fallback: snappedPoint(itemPoint), footprint }) ?? itemPoint);
		const candidate = { ...dimensions, ...footprint, ...point };
		const roomId = findRoomForFloorItem(project, candidate);
		if (!roomId) {
			return {
				...candidate,
				isValid: false,
				reasonCode: "OUTSIDE_ROOM_HOST",
				tier: "invalid" as const,
			};
		}
		const assessment = assessParametricFloorItemPlacement(project, {
			...candidate,
			roomId,
		});
		return {
			...candidate,
			isValid: assessment.kind !== "invalid",
			tier: assessment.kind,
			...(assessment.kind === "invalid"
				? { reasonCode: assessment.reasonCode }
				: {}),
			...(assessment.kind === "warning"
				? { warnings: assessment.warnings }
				: {}),
		};
	}, [activeTool, exactFloorYaw, floorItemWallSnap, itemDraft, itemPoint, itemPointIsExact, project]);
	const placementXMm = itemPlacementPreview?.xMm;
	const placementZMm = itemPlacementPreview?.zMm;
	useEffect(() => {
		if (activeTool !== "item") return;
		onItemPlacementPointChange?.(placementXMm === undefined || placementZMm === undefined
			? undefined
			: { xMm: placementXMm, zMm: placementZMm });
	}, [activeTool, onItemPlacementPointChange, placementXMm, placementZMm]);

	const applyPlacementDistance = (side: ItemWallDistance["side"], valueMm: number) => {
		if (readOnly || isConfirmingItemPlacement || hasPlacementRotationContact || !derivedPlan || !itemPlacementPreview || !itemDraft || project.schemaVersion !== 1) return false;
		const candidate = itemWallDistancePositionFor(derivedPlan.rooms, itemPlacementPreview, side, valueMm);
		if (!candidate) return false;
		const assessed = assessParametricFloorItemPlacement(project, {
			color: itemDraft.color,
			depthMm: itemDraft.depthMm,
			heightMm: itemDraft.heightMm,
			label: itemDraft.label,
			widthMm: itemDraft.widthMm,
			...floorYawFieldsForRadians(itemDraft.yawRadians, exactFloorYaw),
			...candidate,
		});
		if (assessed.kind === "invalid") return false;
		updateItemPoint({ xMm: candidate.xMm, zMm: candidate.zMm }, true);
		return true;
	};
	const itemPlacementCollisionTargets = useMemo(() => {
		if (
			!itemPlacementPreview ||
			itemPlacementPreview.tier === "valid" ||
			project.schemaVersion !== 1
		) {
			return [];
		}
		return findParametricFloorItemCollisionTargets(
			project,
			itemPlacementPreview,
		);
	}, [itemPlacementPreview, project]);
	const itemPlacementCollisionIds = useMemo(() => {
		const items = new Set<string>();
		const walls = new Set<string>();
		const doors = new Set<string>();
		for (const target of itemPlacementCollisionTargets) {
			switch (target.kind) {
				case "item":
					items.add(target.assetInstanceId);
					break;
				case "wall":
					walls.add(target.wallSegmentId);
					break;
				case "door-clearance":
					doors.add(target.openingId);
					break;
			}
		}
		return { doors, items, walls };
	}, [itemPlacementCollisionTargets]);
	const clearItemPlacementPreview = () => {
		clearLongPressPan();
		itemPlacementDragRef.current = undefined;
		updateItemPoint(undefined);
	};
	const cancelItemPlacement = () => {
		itemPlacementConfirmationIdRef.current += 1;
		setIsConfirmingItemPlacement(false);
		clearItemPlacementPreview();
		onCancelItemPlacement();
	};
	const confirmItemPlacement = () => {
		if (hostEnabledRef.current && !hostGateRef.current.canBegin()) return;
		if (
			!itemPlacementPreview?.isValid ||
			isConfirmingItemPlacement ||
			placementRotationContact.current !== undefined ||
			gesture.current?.kind === "pinch"
		)
			return;
		const point = {
			xMm: itemPlacementPreview.xMm,
			zMm: itemPlacementPreview.zMm,
		};
		const confirmationId = itemPlacementConfirmationIdRef.current + 1;
		itemPlacementConfirmationIdRef.current = confirmationId;
		setIsConfirmingItemPlacement(true);
		void Promise.resolve(onPlaceItem(point)).finally(() => {
			if (itemPlacementConfirmationIdRef.current !== confirmationId) return;
			setIsConfirmingItemPlacement(false);
			clearItemPlacementPreview();
		});
	};

	const cancelItemDragForMultiTouch = () => {
		hostRetainedItemDrag.current = undefined;
		clearLongPressPan();
		clearItemDragCommit();
		itemDragSawMultiTouchRef.current = true;
		itemDragCancelledByMultiTouch.current = true;
		const draggedPointerId = itemDragPointerIdRef.current;
		if (draggedPointerId !== undefined) {
			itemDragCancelledPointerIds.current.add(draggedPointerId);
		}
		itemDragRef.current = undefined;
		itemDragPointerIdRef.current = undefined;
		setItemDrag(undefined);
	};

	const persistItemMove = async (move: {
		readonly assetInstanceId: string;
		readonly xMm: number;
		readonly zMm: number;
	}) => {
		if (readOnly || isConfirmingItemTransform) return;
		setIsConfirmingItemTransform(true);
		try {
			const accepted = await onMoveItem(move);
			if (!accepted) {
				setSubmittedItemTransform((active) =>
					active?.assetInstanceId === move.assetInstanceId ? undefined : active,
				);
			}
		} finally {
			setIsConfirmingItemTransform(false);
		}
	};

	const persistItemRotation = async (rotation: {
		readonly assetInstanceId: string;
		readonly yawRadians: number;
	}) => {
		if (readOnly || isConfirmingItemTransform) return;
		setIsConfirmingItemTransform(true);
		try {
			const accepted = await onRotateItem(rotation);
			if (!accepted) {
				setSubmittedItemTransform((active) =>
					active?.assetInstanceId === rotation.assetInstanceId
						? undefined
						: active,
				);
			}
		} finally {
			setIsConfirmingItemTransform(false);
		}
	};

	const publishOpeningMove = async (drag: DoorOpeningDrag) => {
		if (
			readOnlyRef.current ||
			drag.base !== liveProjectRef.current ||
			drag.offsetMm === drag.originalOffsetMm
		)
			return;
		setPendingDoorOpeningMove({
			openingId: drag.openingId,
			offsetMm: drag.offsetMm,
		});
		setIsConfirmingDoorOpeningMove(true);
		try {
			await onMoveDoorOpening({
				openingId: drag.openingId,
				offsetMm: drag.offsetMm,
			});
		} finally {
			setPendingDoorOpeningMove(undefined);
			setIsConfirmingDoorOpeningMove(false);
		}
	};

	const cancelPlacementForPinch = () => {
		const move = itemPlacementDragRef.current;
		if (move) {
			itemPlacementDragRef.current = undefined;
			updateItemPoint(move.before, move.beforeExact);
		}
		cancelPlacementRotation();
		placementRotationContact.current = undefined;
	};

	const beginPinch = (first: PointerPosition | undefined, second: PointerPosition | undefined) => {
		if (!first || !second) return;
		// Camera contacts remain valid as the camera changes its own projection.
		for (const [pointerId, contact] of hostContacts.current) {
			if (pointers.current.has(pointerId) && contact.kind === "draft") {
				hostContacts.current.set(pointerId, { ...contact, kind: "camera" });
			}
		}
		gesture.current = {
			centre: centre(first, second),
			distance: distance(first, second),
			kind: "pinch",
			viewport: viewportRef.current,
		};
	};

	const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
		if (hostEnabledRef.current) {
			const projection = hostProjectionKey();
			if (!hostGateRef.current.canBegin() || projection === undefined) { event.preventDefault(); return; }
			hostContacts.current.set(event.pointerId, { epoch: hostGateRef.current.capture(), kind: "camera", base: liveProjectRef.current, projection,
				itemId: (event.target as Element).closest("[data-item-id]")?.getAttribute("data-item-id") ?? undefined });
		}
		revokedHostContacts.current.delete(event.pointerId);
		event.currentTarget.setPointerCapture(event.pointerId);
		if (event.pointerType === "touch") {
			touchContacts.current.add(event.pointerId);
			activeTouchCount.current = Math.max(
				activeTouchCount.current,
				touchContacts.current.size,
			);
		}
		const canvasPoint = canvasPointFor(event);
		pointers.current.set(event.pointerId, canvasPoint);
		if (isInteractionLocked) {
			event.preventDefault();
			return;
		}
		const activePointers = [...pointers.current.values()];
		const hasMultipleContacts =
			activePointers.length >= 2 ||
			touchContacts.current.size >= 2 ||
			activeTouchCount.current >= 2;
		if (hasMultipleContacts && itemDragRef.current) {
			doorOpeningDragRef.current = undefined;
			setDoorOpeningDrag(undefined);
			pendingCanvasSelectionRef.current = undefined;
			cancelItemDragForMultiTouch();
			itemDragCancelledPointerIds.current.add(event.pointerId);
			beginPinch(activePointers[0], activePointers[1]);
			return;
		}
		if (hasMultipleContacts) {
			doorOpeningDragRef.current = undefined;
			setDoorOpeningDrag(undefined);
			splitGrabRef.current = undefined;
			pendingCanvasSelectionRef.current = undefined;
			clearLongPressPan();
			cancelPlacementForPinch();
			if (itemRotationRef.current && !retainedHostItemTransform()) {
				itemRotationRef.current = undefined;
				setItemRotation(undefined);
			}
			if (activeTool === "item") setHasPlacementRotationContact(true);
			if (wallMoveDraftRef.current) {
				clearWallMoveDraft();
				onWallMoveModeChange(false);
			}
			if (wallSplitDraftRef.current) {
				clearWallSplitDraft();
				onWallSplitModeChange(false);
			}
			if (wallVertexMoveDraftRef.current) {
				clearWallVertexMoveDraft();
				onWallVertexMoveModeChange(false);
			}
			if (activeTool === "wall" && wallDraftRef.current?.phase === "drawing") {
				wallDraftCancelledByMultiTouch.current = true;
				wallDraftCancelledPointerIds.current.add(event.pointerId);
				const draftPointerId = wallDraftRef.current?.pointerId;
				if (draftPointerId !== undefined) {
					wallDraftCancelledPointerIds.current.add(draftPointerId);
				}
				wallDraftRef.current = undefined;
				setWallDraft(undefined);
			}
			beginPinch(activePointers[0], activePointers[1]);
			return;
		}
		if (
			(isWallMoveMode && wallMoveDraftRef.current?.phase === "ready") ||
			(isWallSplitMode &&
				wallSplitDraftRef.current &&
				!(event.target as Element).closest("[data-wall-split-handle]")) ||
			(isWallVertexMoveMode &&
				wallVertexMoveDraftRef.current?.phase === "ready") ||
			isConfirmingItemTransform ||
			pendingDoorOpeningMove !== undefined
		) {
			return;
		}
		const hitWallId = (event.target as Element)
			.closest("[data-wall-id]")
			?.getAttribute("data-wall-id");
		const wallSegmentId = activeTool === "select" && hitWallId
			? nearestWallAtPoint({
				x: (canvasPoint.x - viewportRef.current.panX) / viewportRef.current.zoom,
				y: (canvasPoint.y - viewportRef.current.panY) / viewportRef.current.zoom,
			}, project.level.wallSegments.flatMap(wall => {
				const start = vertices.find(vertex => vertex.vertexId === wall.startVertexId);
				const end = vertices.find(vertex => vertex.vertexId === wall.endVertexId);
				return start && end ? [{
					wallSegmentId: wall.wallSegmentId,
					start: pointFor(start.xMm, start.zMm),
					end: pointFor(end.xMm, end.zMm),
					targetWidth: Math.max(MINIMUM_TOUCH_TARGET_PX / viewportRef.current.zoom, wall.thicknessMm * drawingScale),
				}] : [];
			}), hitWallId) ?? hitWallId
			: hitWallId;
		const wallVertexId = (event.target as Element)
			.closest("[data-wall-vertex-id]")
			?.getAttribute("data-wall-vertex-id");
		if (
			activeTool === "select" &&
			isWallVertexMoveMode &&
			wallVertexId &&
			movableWallVertexIds.includes(wallVertexId) &&
			activePointers.length === 1 &&
			!readOnly
		) {
			const original = project.level.vertices.find(
				(vertex) => vertex.vertexId === wallVertexId,
			);
			if (!original || !wallVertexMoveAxisAt(wallVertexId)) return;
			gesture.current = undefined;
			clearLongPressPan();
			event.preventDefault();
			event.stopPropagation();
			const draft: WallVertexMoveDraft = {
				original,
				phase: "dragging",
				pointerId: event.pointerId,
				pointerOrigin: canvasPoint,
				vertexId: wallVertexId,
				xMm: original.xMm,
				zMm: original.zMm,
			};
			setWallVertexMoveDraft(draft);
			wallVertexMoveDraftRef.current = draft;
			markHostDraftContact(event.pointerId);
			return;
		}
		const assetInstanceId = (event.target as Element)
			.closest("[data-item-id]")
			?.getAttribute("data-item-id");
		const rotationTarget = (event.target as Element).closest(
			"[data-rotation-hit-area], [data-rotation-handle]",
		);
		const rotationAssetInstanceId =
			rotationTarget?.getAttribute("data-rotation-hit-area") ??
			rotationTarget?.getAttribute("data-rotation-handle");
		const doorOpeningId = (event.target as Element)
			.closest("[data-door-opening-handle]")
			?.getAttribute("data-door-opening-handle");
		const doorOpeningWallId = (event.target as Element)
			.closest("[data-door-opening-wall]")
			?.getAttribute("data-door-opening-wall");
		const splitHandleWallId = (event.target as Element)
			.closest("[data-wall-split-handle]")
			?.getAttribute("data-wall-split-handle");
		const wallSplitTargetId =
			splitHandleWallId ?? wallSegmentId ?? doorOpeningWallId;
		const pointerAssetInstanceId = (event.target as Element)
			.closest("[data-item-id]")
			?.getAttribute("data-item-id");
		const retained = retainedHostItemTransform();
		const intendedAssetId = rotationAssetInstanceId ?? pointerAssetInstanceId;
		const intendedKind = rotationAssetInstanceId ? "rotation" : "move";
		if (activeTool === "select" && retained && intendedAssetId && (retained.assetInstanceId !== intendedAssetId || retained.kind !== intendedKind)) {
			event.preventDefault(); event.stopPropagation(); releaseHostContact(event.pointerId); return;
		}
		if (
			activeTool === "select" &&
			isWallSplitMode &&
			wallSplitTargetId &&
			wallSplitTargetId === selectedWallId &&
			activePointers.length === 1 &&
			!readOnly
		) {
			const split =
				splitHandleWallId && wallSplitDraftRef.current
					? wallSplitDraftRef.current
					: wallSplitPointFor(wallSplitTargetId, projectPointFor(event));
			if (!split) return;
			gesture.current = undefined;
			clearLongPressPan();
			event.preventDefault();
			event.stopPropagation();
			markHostDraftContact(event.pointerId);
			splitGrabRef.current = {
				pointerId: event.pointerId,
				origin: split.pointMm,
				pointerStart: projectPointFor(event),
				base: project,
			};
			splitBaseRef.current = project;
			setSplitUnavailable(false);
			setWallSplitDraft(split);
			wallSplitDraftRef.current = split;
			return;
		}
		if (
			activeTool === "select" &&
			isWallMoveMode &&
			wallSegmentId &&
			wallSegmentId === selectedWallId &&
			activePointers.length === 1 &&
			!readOnly
		) {
			const axis = wallMoveAxisFor(wallSegmentId);
			if (!axis) return;
			// Moving a wall is deliberately a separate, one-finger operation. The
			// candidate remains local to this canvas until the explicit confirmation
			// below, so a stray drag can never publish a Durable Revision.
			gesture.current = undefined;
			clearLongPressPan();
			event.preventDefault();
			event.stopPropagation();
			const draft: WallMoveDraft =
				axis.kind === "cardinal"
					? {
							kind: "cardinal",
							originalPositionMm: axis.positionMm,
							phase: "dragging",
							pointerId: event.pointerId,
							pointerOrigin: canvasPoint,
							positionMm: axis.positionMm,
							wallSegmentId,
						}
					: {
							kind: axis.kind,
							originalPointerPoint: projectPointFor(event),
							phase: "dragging",
							pointerId: event.pointerId,
							pointerOrigin: canvasPoint,
							translationMm: { xMm: 0, zMm: 0 },
							wallSegmentId,
						};
			setWallMoveDraft(draft);
			wallMoveDraftRef.current = draft;
			markHostDraftContact(event.pointerId);
			return;
		}
		if (
			activeTool === "select" &&
			doorOpeningId &&
			doorOpeningWallId &&
			activePointers.length === 1 &&
			!readOnly
		) {
			const opening = project.level.openings.find(
				(candidate) =>
					candidate.openingId === doorOpeningId &&
					candidate.wallSegmentId === doorOpeningWallId,
			);
			if (!opening) return;
			event.preventDefault();
			event.stopPropagation();
			gesture.current = undefined;
			pendingCanvasSelectionRef.current = undefined;
			onSelectOpening?.(opening.openingId);
			const drag: DoorOpeningDrag = {
				openingId: opening.openingId,
				wallSegmentId: opening.wallSegmentId,
				offsetMm: opening.offsetMm,
				originalOffsetMm: opening.offsetMm,
				pointerStart: projectPointFor(event),
				pointerOrigin: canvasPoint,
				base: project,
				pointerId: event.pointerId,
			};
			doorOpeningDragRef.current = drag;
			markHostDraftContact(event.pointerId);
			setDoorOpeningDrag(drag);
			return;
		}
		if (
			activeTool === "select" &&
			rotationAssetInstanceId &&
			activePointers.length === 1 &&
			!readOnly
		) {
			event.preventDefault();
			event.stopPropagation();
			onSelectItem(rotationAssetInstanceId);
			const item = project.assetInstances.find(
				(candidate): candidate is EditorFloorAsset =>
					candidate.assetInstanceId === rotationAssetInstanceId &&
					isFloorEditorAsset(candidate),
			);
			if (!item || ("locked" in item && item.locked)) return;
			beginSelectedItemRotation(item, event);
			return;
		}
		if (
			activeTool === "select" &&
			pointerAssetInstanceId &&
			selectedItemId === pointerAssetInstanceId &&
			activePointers.length === 1 &&
			!readOnly &&
			(event.target as Element).closest(".rotationGizmo")
		) {
			// An item owns this pointer synchronously.  A stale canvas pan must
			// never survive into a long item drag and pull the editor away.
			gesture.current = undefined;
			clearLongPressPan();
			event.preventDefault();
			event.stopPropagation();
			const item = project.assetInstances.find(
				(candidate): candidate is EditorFloorAsset =>
					candidate.assetInstanceId === pointerAssetInstanceId &&
					isFloorEditorAsset(candidate),
			);
			if (!item || ("locked" in item && item.locked)) return;
			beginSelectedItemRotation(item, event);
			return;
		}
		if (
			activeTool === "select" &&
			assetInstanceId &&
			activePointers.length === 1
		) {
			const item = project.assetInstances.find(
				(candidate): candidate is EditorFloorAsset =>
					candidate.assetInstanceId === assetInstanceId &&
					isFloorEditorAsset(candidate),
			);
			if (!item) return;
			const pointerPoint = projectPointFor(event);
			const retained = hostEnabledRef.current && itemDragRef.current?.assetInstanceId === assetInstanceId ? itemDragRef.current : undefined;
			const point = retained?.end ?? { xMm: item.xMm, zMm: item.zMm };
			onSelectItem(assetInstanceId);
			if (readOnly) {
				return;
			}
			hostRetainedItemDrag.current = retained;
			// A hit on an item always belongs to that item.  The old long-press
			// fallback could steal unrotated item drags and pan the whole canvas.
			const contact = {
				assetInstanceId,
				end: point,
				moved: false,
				pointerOrigin: canvasPoint,
				pointerToItemOffset: {
					xMm: pointerPoint.xMm - point.xMm,
					zMm: pointerPoint.zMm - point.zMm,
				},
				start: point,
			};
			// Selection opens its inspector on contact. Only movement beyond the
			// gesture tolerance becomes a new edit visible to navigation and history.
			itemDragRef.current = contact;
			setItemDrag(hostEnabledRef.current ? retained : contact);
			itemDragCancelledByMultiTouch.current = false;
			itemDragCancelledPointerIds.current.clear();
			itemDragSawMultiTouchRef.current = false;
			itemDragPointerIdRef.current = event.pointerId;
			markHostDraftContact(event.pointerId);
			pointerCountAtItemDragStartRef.current = pointers.current.size;
			return;
		}
		if (
			activeTool === "select" &&
			wallSegmentId &&
			activePointers.length === 1
		) {
			pendingCanvasSelectionRef.current = {
				pointerId: event.pointerId,
				pointerOrigin: canvasPoint,
				wallSegmentId,
			};
			startPan(canvasPoint);
			return;
		}
		if (activeTool === "wall" && activePointers.length === 1 && !readOnly) {
			if (wallDraftRef.current?.phase === "ready") {
				return;
			}
			// A drawing gesture owns its completion. In particular, it must not
			// inherit a pan left by a preceding touch sequence, otherwise pointerup
			// would return through the pan branch and leave a dashed draft behind.
			gesture.current = undefined;
			clearLongPressPan();
			const point = snapWallStart(projectPointFor(event), !!wallSegmentId);
			wallDraftCancelledByMultiTouch.current = false;
			setWallDraft({
				end: point,
				phase: "drawing",
				rawEnd: point,
				pointerId: event.pointerId,
				pointerOrigin: canvasPoint,
				start: point,
				gestureStart: point,
			});
			markHostDraftContact(event.pointerId);
			wallDraftRef.current = {
				end: point,
				phase: "drawing",
				rawEnd: point,
				pointerId: event.pointerId,
				pointerOrigin: canvasPoint,
				start: point,
				gestureStart: point,
			};
			return;
		}
		if (activeTool === "item" && activePointers.length === 1 && !readOnly) {
			// Placement owns a single-pointer drag just like a placed item does.
			// It must never arm the canvas long-press pan, otherwise the preview
			// cannot be positioned by dragging on a small phone screen.
			gesture.current = undefined;
			clearLongPressPan();
			event.preventDefault();
			if ((event.target as Element).closest("[data-placement-rotation-handle]") && itemPlacementPreview) {
				const centre = rotationCentreInCanvas(itemPlacementPreview);
				placementRotationContact.current = {
					centre,
					gesture: beginRotationDomeGesture({
						assetInstanceId: "placement",
						pointerId: event.pointerId,
						yawRadians: yawRadiansFor(itemPlacementPreview),
						point: canvasPoint,
						centre,
						exact: exactFloorYaw,
					}),
					pointerId: event.pointerId,
				};
				markHostDraftContact(event.pointerId);
				setHasPlacementRotationContact(true);
				return;
			}
			const point = placementPointerPointFor(event);
			itemPlacementDragRef.current = { pointerId: event.pointerId, before: itemPointRef.current, beforeExact: itemPointIsExactRef.current };
			updateItemPoint(point);
			markHostDraftContact(event.pointerId);
			return;
		}
		if (activePointers.length === 1 && activePointers[0]) {
			if (activeTool === "select") {
				pendingCanvasSelectionRef.current = {
					pointerId: event.pointerId,
					pointerOrigin: canvasPoint,
				};
			}
			startPan(activePointers[0]);
		}
	};

	const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
		if (!isHostContactCurrent(event.pointerId)) { releaseHostContact(event.pointerId); return; }
		if (!pointers.current.has(event.pointerId)) {
			return;
		}
		const canvasPoint = canvasPointFor(event);
		const pendingSelection = pendingCanvasSelectionRef.current;
		if (
			pendingSelection?.pointerId === event.pointerId &&
			distance(pendingSelection.pointerOrigin, canvasPoint) > 6
		) {
			pendingCanvasSelectionRef.current = undefined;
		}
		pointers.current.set(event.pointerId, canvasPoint);
		const activePointers = [...pointers.current.values()];
		const activeGesture = gesture.current;
		if (
			activePointers.length >= 2 ||
			touchContacts.current.size >= 2 ||
			activeTouchCount.current >= 2
		) {
			doorOpeningDragRef.current = undefined;
			setDoorOpeningDrag(undefined);
			splitGrabRef.current = undefined;
			itemDragSawMultiTouchRef.current = true;
			if (wallMoveDraftRef.current) {
				clearWallMoveDraft();
				onWallMoveModeChange(false);
			}
			if (wallSplitDraftRef.current) {
				clearWallSplitDraft();
				onWallSplitModeChange(false);
			}
			if (wallVertexMoveDraftRef.current) {
				clearWallVertexMoveDraft();
				onWallVertexMoveModeChange(false);
			}
			if (activeTool === "wall") {
				wallDraftCancelledByMultiTouch.current = true;
				wallDraftCancelledPointerIds.current.add(event.pointerId);
				const draftPointerId = wallDraftRef.current?.pointerId;
				if (draftPointerId !== undefined) {
					wallDraftCancelledPointerIds.current.add(draftPointerId);
				}
				wallDraftRef.current = undefined;
				setWallDraft(undefined);
			}
			if (itemDragRef.current) {
				cancelItemDragForMultiTouch();
			}
			if (
				activePointers[0] &&
				activePointers[1] &&
				activeGesture?.kind === "pinch"
			) {
				const factor =
					distance(activePointers[0], activePointers[1]) /
					activeGesture.distance;
				const nextCentre = centre(activePointers[0], activePointers[1]);
				setViewport(() =>
					pinchEditorViewport(
						activeGesture.viewport,
						factor,
						activeGesture.centre,
						nextCentre,
						maximumViewportZoom,
					),
				);
			}
			return;
		}
		const placementRotation = placementRotationContact.current;
		if (placementRotation?.pointerId === event.pointerId) {
			if (placementRotation.gesture) {
				placementRotation.gesture = moveRotationDomeGesture(placementRotation.gesture, canvasPoint, placementRotation.centre);
				onItemPlacementYawChange(placementRotation.gesture.yawRadians);
			}
			return;
		}
		if (hostEnabledRef.current && hostContacts.current.get(event.pointerId)?.kind === "camera") {
			if (activePointers.length === 1 && activePointers[0] && activeGesture?.kind === "pan") {
				setViewport(() => panEditorViewport(activeGesture.viewport,
					activePointers[0].x - activeGesture.origin.x, activePointers[0].y - activeGesture.origin.y));
			}
			return;
		}
		const activeWallMoveDraft = wallMoveDraftRef.current;
		if (
			activeTool === "select" &&
			isWallMoveMode &&
			activeWallMoveDraft?.phase === "dragging" &&
			activeWallMoveDraft.pointerId === event.pointerId &&
			activePointers.length === 1
		) {
			const axis = wallMoveAxisFor(activeWallMoveDraft.wallSegmentId);
			if (!axis || axis.kind !== activeWallMoveDraft.kind) return;
			const point = projectPointFor(event);
			const nextDraft: WallMoveDraft =
				activeWallMoveDraft.kind === "cardinal" && axis.kind === "cardinal"
					? {
							...activeWallMoveDraft,
							positionMm:
								activeWallMoveDraft.originalPositionMm +
								snapWallMoveDeltaMm(
									(axis.axis === "x" ? point.xMm : point.zMm) -
										activeWallMoveDraft.originalPositionMm,
								),
						}
					: activeWallMoveDraft.kind === "diagonal-rising" ||
							activeWallMoveDraft.kind === "diagonal-falling"
						? (() => {
								const deltaMm = snapWallMoveDeltaMm(
									activeWallMoveDraft.kind === "diagonal-rising"
										? (point.xMm -
												activeWallMoveDraft.originalPointerPoint.xMm -
												(point.zMm -
													activeWallMoveDraft.originalPointerPoint.zMm)) /
												2
										: (point.xMm -
												activeWallMoveDraft.originalPointerPoint.xMm +
												(point.zMm -
													activeWallMoveDraft.originalPointerPoint.zMm)) /
												2,
								);
								return {
									...activeWallMoveDraft,
									translationMm: {
										xMm: deltaMm,
										zMm:
											activeWallMoveDraft.kind === "diagonal-rising"
												? -deltaMm
												: deltaMm,
									},
								};
							})()
						: activeWallMoveDraft;
			wallMoveDraftRef.current = nextDraft;
			setWallMoveDraft(nextDraft);
			return;
		}
		if (
			activeTool === "select" &&
			isWallSplitMode &&
			wallSplitDraftRef.current
		) {
			const grab = splitGrabRef.current;
			if (
				grab?.pointerId === event.pointerId &&
				grab.base === liveProjectRef.current &&
				!readOnlyRef.current
			) {
				const point = projectPointFor(event);
				const next = wallSplitPointFor(
					wallSplitDraftRef.current.wallSegmentId,
					{
						xMm: grab.origin.xMm + point.xMm - grab.pointerStart.xMm,
						zMm: grab.origin.zMm + point.zMm - grab.pointerStart.zMm,
					},
				);
				setSplitUnavailable(!next);
				if (next) {
					wallSplitDraftRef.current = next;
					setWallSplitDraft(next);
				}
			}
			gesture.current = undefined;
			return;
		}
		const activeWallVertexMoveDraft = wallVertexMoveDraftRef.current;
		if (
			activeTool === "select" &&
			isWallVertexMoveMode &&
			activeWallVertexMoveDraft?.phase === "dragging" &&
			activeWallVertexMoveDraft.pointerId === event.pointerId &&
			activePointers.length === 1
		) {
			const axis = wallVertexMoveAxisAt(activeWallVertexMoveDraft.vertexId);
			if (!axis) return;
			const point = projectPointFor(event);
			const nextDraft = {
				...activeWallVertexMoveDraft,
				...pointForWallVertexMove(
					axis,
					point,
					activeWallVertexMoveDraft.original,
				),
			};
			wallVertexMoveDraftRef.current = nextDraft;
			setWallVertexMoveDraft(nextDraft);
			return;
		}
		const activeItemRotation = itemRotationRef.current;
		if (
			activeItemRotation &&
			activeItemRotation.pointerId === event.pointerId &&
			activePointers.length === 1
		) {
			const item = project.assetInstances.find(
				(candidate): candidate is EditorFloorAsset =>
					candidate.assetInstanceId === activeItemRotation.assetInstanceId &&
					isFloorEditorAsset(candidate),
			);
			if (!item) return;
			const relative = activeItemRotation.relative;
			const nextGesture = relative ? moveRotationDomeGesture(relative.gesture, canvasPoint, relative.centre) : undefined;
			const rotation = {
				...activeItemRotation,
				relative: relative && nextGesture ? { centre: relative.centre, gesture: nextGesture } : undefined,
				yawRadians: nextGesture?.yawRadians ?? yawForPointer(
					projectPointFor(event),
					rotationGizmoCenterFor(item),
				),
			};
			itemRotationRef.current = rotation;
			setItemRotation(rotation);
			return;
		}
		const activeDoorOpeningDrag = doorOpeningDragRef.current;
		if (
			activeDoorOpeningDrag &&
			activeDoorOpeningDrag.pointerId === event.pointerId &&
			activePointers.length === 1
		) {
			if (
				activeDoorOpeningDrag.base !== liveProjectRef.current ||
				readOnlyRef.current
			) {
				doorOpeningDragRef.current = undefined;
				setDoorOpeningDrag(undefined);
				return;
			}
			const wall = project.level.wallSegments.find(
				(wall) => wall.wallSegmentId === activeDoorOpeningDrag.wallSegmentId,
			);
			const start = project.level.vertices.find(
				(vertex) => vertex.vertexId === wall?.startVertexId,
			);
			const end = project.level.vertices.find(
				(vertex) => vertex.vertexId === wall?.endVertexId,
			);
			if (!start || !end) return;
			const offsetMm =
				distance(activeDoorOpeningDrag.pointerOrigin, canvasPoint) <= 6
					? activeDoorOpeningDrag.originalOffsetMm
					: openingDragOffsetFor({
							startMm: start,
							endMm: end,
							pointerStartMm: activeDoorOpeningDrag.pointerStart,
							pointerCurrentMm: projectPointFor(event),
							openingOffsetMm: activeDoorOpeningDrag.originalOffsetMm,
						});
			if (offsetMm === undefined) return;
			const drag = { ...activeDoorOpeningDrag, offsetMm };
			doorOpeningDragRef.current = drag;
			setDoorOpeningDrag(drag);
			return;
		}
		const activeItemDrag = itemDragRef.current;
		if (activeItemDrag && activePointers.length === 1) {
			if (
				!activeItemDrag.moved &&
				distance(activeItemDrag.pointerOrigin, canvasPoint) <= 6
			) {
				return;
			}
			clearLongPressPan();
			const point = projectPointFor(event);
			const nextItemDrag = {
				...activeItemDrag,
				end: itemMovePointFor({
					xMm: point.xMm - activeItemDrag.pointerToItemOffset.xMm,
					zMm: point.zMm - activeItemDrag.pointerToItemOffset.zMm,
				}, activeItemDrag.assetInstanceId),
				moved:
					activeItemDrag.moved ||
					distance(activeItemDrag.pointerOrigin, canvasPoint) > 6,
			};
			itemDragRef.current = nextItemDrag;
			setItemDrag(nextItemDrag);
			return;
		}
		const activeItemPlacementDrag = itemPlacementDragRef.current;
		if (
			activeTool === "item" &&
			activeItemPlacementDrag?.pointerId === event.pointerId &&
			activePointers.length === 1
		) {
			const point = placementPointerPointFor(event);
			updateItemPoint(point);
			return;
		}
		const activeWallDraft = wallDraftRef.current;
		if (
			activeTool === "wall" &&
			activeWallDraft &&
			activeWallDraft.phase === "drawing" &&
			activeWallDraft.pointerId === event.pointerId &&
			activePointers.length === 1
		) {
			const constrained = snapWallEnd(
				activeWallDraft.gestureStart ?? activeWallDraft.start,
				projectPointFor(event),
			);
			if (!constrained) {
				return;
			}
			const nextWallDraft = {
				...activeWallDraft,
				direction: constrained.direction,
				start: constrained.start,
				end: constrained.end,
				rawEnd: projectPointFor(event),
			};
			wallDraftRef.current = nextWallDraft;
			setWallDraft(nextWallDraft);
			return;
		}
		if (
			activePointers.length === 1 &&
			activePointers[0] &&
			activeGesture?.kind === "pan"
		) {
			setViewport(() =>
				panEditorViewport(
					activeGesture.viewport,
					activePointers[0].x - activeGesture.origin.x,
					activePointers[0].y - activeGesture.origin.y,
				),
			);
		}
	};

	const onPointerUp = async (event: ReactPointerEvent<SVGSVGElement>) => {
		if (!isHostContactCurrent(event.pointerId)) { releaseHostContact(event.pointerId); return; }
		if (activeTool === "item" && finishPlacementContact(event.pointerId)) return;
		if (finishRetainedHostCameraContact(event.pointerId)) return;
		hostContacts.current.delete(event.pointerId);
		clearLongPressPan();
		if (splitGrabRef.current?.pointerId === event.pointerId)
			splitGrabRef.current = undefined;
		if (event.pointerType === "touch") {
			touchContacts.current.delete(event.pointerId);
			if (touchContacts.current.size === 0) {
				activeTouchCount.current = 0;
			}
			if (touchContacts.current.size === 0) {
				itemDragCancelledByMultiTouch.current = false;
				itemDragSawMultiTouchRef.current = false;
			}
		}
		const wasItemDragCancelled = itemDragCancelledPointerIds.current.delete(
			event.pointerId,
		);
		const wasWallDraftCancelled = wallDraftCancelledPointerIds.current.delete(
			event.pointerId,
		);
		const activeWallMoveDraft = wallMoveDraftRef.current;
		if (
			activeTool === "select" &&
			isWallMoveMode &&
			activeWallMoveDraft?.phase === "dragging" &&
			activeWallMoveDraft.pointerId === event.pointerId
		) {
			pointers.current.delete(event.pointerId);
			gesture.current = undefined;
			const moved =
				distance(activeWallMoveDraft.pointerOrigin, canvasPointFor(event)) >
					6 &&
				(activeWallMoveDraft.kind === "cardinal"
					? activeWallMoveDraft.positionMm !==
						activeWallMoveDraft.originalPositionMm
					: activeWallMoveDraft.translationMm.xMm !== 0 ||
						activeWallMoveDraft.translationMm.zMm !== 0);
			if (!moved) {
				clearWallMoveDraft();
				return;
			}
			const candidate = {
				...activeWallMoveDraft,
				phase: "ready" as const,
				pointerId: undefined,
			};
			setWallMoveDraft(candidate);
			wallMoveDraftRef.current = candidate;
			return;
		}
		const activeWallVertexMoveDraft = wallVertexMoveDraftRef.current;
		if (
			activeTool === "select" &&
			isWallVertexMoveMode &&
			activeWallVertexMoveDraft?.phase === "dragging" &&
			activeWallVertexMoveDraft.pointerId === event.pointerId
		) {
			pointers.current.delete(event.pointerId);
			gesture.current = undefined;
			const moved =
				distance(
					activeWallVertexMoveDraft.pointerOrigin,
					canvasPointFor(event),
				) > 6 &&
				(activeWallVertexMoveDraft.xMm !==
					activeWallVertexMoveDraft.original.xMm ||
					activeWallVertexMoveDraft.zMm !==
						activeWallVertexMoveDraft.original.zMm);
			if (!moved) {
				clearWallVertexMoveDraft();
				return;
			}
			const candidate = {
				...activeWallVertexMoveDraft,
				phase: "ready" as const,
				pointerId: undefined,
			};
			setWallVertexMoveDraft(candidate);
			wallVertexMoveDraftRef.current = candidate;
			return;
		}
		const activeItemRotation = itemRotationRef.current;
		if (
			activeItemRotation &&
			activeItemRotation.pointerId === event.pointerId
		) {
			itemRotationRef.current = undefined;
			setItemRotation(undefined);
			pointers.current.delete(event.pointerId);
			if (!readOnly && (!activeItemRotation.relative || rotationDomeGestureHasChanged(activeItemRotation.relative.gesture))) {
				const rotation = {
					assetInstanceId: activeItemRotation.assetInstanceId,
					yawRadians: yawRadiansFor(floorYawFieldsForRadians(activeItemRotation.yawRadians, activeItemRotation.relative?.gesture.exact ?? false)),
				};
				setSubmittedItemTransform({ kind: "rotation", ...rotation });
				void persistItemRotation(rotation);
			}
			return;
		}
		const activeDoorOpeningDrag = doorOpeningDragRef.current;
		if (
			activeDoorOpeningDrag &&
			activeDoorOpeningDrag.pointerId === event.pointerId
		) {
			doorOpeningDragRef.current = undefined;
			setDoorOpeningDrag(undefined);
			pointers.current.delete(event.pointerId);
			if (
				!readOnlyRef.current &&
				activeDoorOpeningDrag.base === liveProjectRef.current &&
				distance(activeDoorOpeningDrag.pointerOrigin, canvasPointFor(event)) > 6
			)
				await publishOpeningMove(activeDoorOpeningDrag);
			return;
		}
		const activeItemDrag = itemDragRef.current;
		if (
			gesture.current?.kind === "pinch" &&
			(activeItemDrag ||
				itemDragCancelledByMultiTouch.current ||
				wasItemDragCancelled)
		) {
			setItemDrag(undefined);
			itemDragRef.current = undefined;
			itemDragPointerIdRef.current = undefined;
			pointers.current.delete(event.pointerId);
			if (pointers.current.size === 0 && event.pointerType !== "touch") {
				itemDragCancelledByMultiTouch.current = false;
				itemDragSawMultiTouchRef.current = false;
				gesture.current = undefined;
			}
			return;
		}
		if (
			activeItemDrag ||
			itemDragCancelledByMultiTouch.current ||
			wasItemDragCancelled
		) {
			const cancelledByMultiTouch = itemDragCancelledByMultiTouch.current;
			const point = projectPointFor(event);
			const end = itemMovePointFor({
				xMm: point.xMm - (activeItemDrag?.pointerToItemOffset.xMm ?? 0),
				zMm: point.zMm - (activeItemDrag?.pointerToItemOffset.zMm ?? 0),
			}, activeItemDrag?.assetInstanceId);
			const canvasPoint = canvasPointFor(event);
			const wasSinglePointer =
				pointers.current.size === 1 && gesture.current?.kind !== "pinch";
			const retained = hostRetainedItemDrag.current;
			hostRetainedItemDrag.current = undefined;
			const hasFreshTransform = activeItemDrag && (activeItemDrag.moved || distance(activeItemDrag.pointerOrigin, canvasPoint) > 6) &&
				(end.xMm !== activeItemDrag.start.xMm || end.zMm !== activeItemDrag.start.zMm);
			if (hostEnabledRef.current && retained && activeItemDrag && wasSinglePointer && !cancelledByMultiTouch && !itemDragSawMultiTouchRef.current && !hasFreshTransform) {
				const completedContactEpoch = hostGateRef.current.capture();
				invalidateHostContacts();
				itemDragRef.current = retained;
				setItemDrag(retained);
				itemDragPointerIdRef.current = undefined;
				hostDraftContactEpoch.current = completedContactEpoch;
				return;
			}
			setItemDrag(undefined);
			itemDragRef.current = undefined;
			itemDragPointerIdRef.current = undefined;
			pointers.current.delete(event.pointerId);
			if (
				!readOnly &&
				!cancelledByMultiTouch &&
				!itemDragSawMultiTouchRef.current &&
				activeItemDrag &&
				pointerCountAtItemDragStartRef.current === 1 &&
				wasSinglePointer &&
				(activeItemDrag.moved ||
					distance(activeItemDrag.pointerOrigin, canvasPoint) > 6)
			) {
				const move = {
					assetInstanceId: activeItemDrag.assetInstanceId,
					xMm: end.xMm,
					zMm: end.zMm,
				};
				if (
					move.xMm !== activeItemDrag.start.xMm ||
					move.zMm !== activeItemDrag.start.zMm
				) {
					setSubmittedItemTransform({ kind: "move", ...move });
					void persistItemMove(move);
				}
			}
			if (pointers.current.size === 0 && event.pointerType !== "touch") {
				itemDragCancelledByMultiTouch.current = false;
				itemDragSawMultiTouchRef.current = false;
				gesture.current = undefined;
			}
			return;
		}
		const activeItemPlacementDrag = itemPlacementDragRef.current;
		if (
			activeTool === "item" &&
			activeItemPlacementDrag?.pointerId === event.pointerId
		) {
			itemPlacementDragRef.current = undefined;
			pointers.current.delete(event.pointerId);
			if (pointers.current.size === 0) {
				gesture.current = undefined;
			}
			// The preview remains on the last drag position until the explicit
			// checkmark or cross; releasing the pointer never creates an item.
			return;
		}
		const activeWallDraft = wallDraftRef.current;
		if (activeTool === "wall" && wasWallDraftCancelled) {
			setWallDraft(undefined);
			wallDraftRef.current = undefined;
			pointers.current.delete(event.pointerId);
			if (pointers.current.size === 0) {
				gesture.current = undefined;
				wallDraftCancelledByMultiTouch.current = false;
			}
			return;
		}
		if (activeTool === "wall" && activeWallDraft?.phase === "drawing") {
			const isWallDraftPointer = activeWallDraft.pointerId === event.pointerId;
			pointers.current.delete(event.pointerId);
			const remainingPointerCount = pointers.current.size;
			if (
				!isWallDraftPointer ||
				remainingPointerCount > 0 ||
				wallDraftCancelledByMultiTouch.current
			) {
				if (remainingPointerCount === 0) {
					gesture.current = undefined;
					wallDraftCancelledByMultiTouch.current = false;
				}
				return;
			}
			const canvasPoint = canvasPointFor(event);
			if (distance(activeWallDraft.pointerOrigin, canvasPoint) <= 6) {
				setWallDraft(undefined);
				wallDraftRef.current = undefined;
				return;
			}
			const constrained = snapWallEnd(
				activeWallDraft.gestureStart ?? activeWallDraft.start,
				projectPointFor(event),
			);
			if (!constrained) {
				setWallDraft(undefined);
				wallDraftRef.current = undefined;
				return;
			}
			const end = constrained.end;
			if (
				end.xMm === constrained.start.xMm &&
				end.zMm === constrained.start.zMm
			) {
				setWallDraft(undefined);
				wallDraftRef.current = undefined;
				return;
			}
			if (event.pointerType === "touch") {
				const candidate = {
					...activeWallDraft,
					direction: constrained.direction,
					start: constrained.start,
					end,
					phase: "ready" as const,
					pointerId: undefined,
					rawEnd: projectPointFor(event),
				};
				setWallDraft(candidate);
				wallDraftRef.current = candidate;
				gesture.current = undefined;
				return;
			}
			clearWallDraft();
			if (wallThicknessMm === undefined) {
				return;
			}
			await onDrawWall({
				end,
				start: constrained.start,
				thicknessMm: wallThicknessMm,
			});
			return;
		}
		if (gesture.current?.kind === "pan") {
			const pendingSelection = pendingCanvasSelectionRef.current;
			if (pendingSelection?.pointerId === event.pointerId) {
				pendingCanvasSelectionRef.current = undefined;
				pointers.current.delete(event.pointerId);
				gesture.current = undefined;
				if (
					distance(pendingSelection.pointerOrigin, canvasPointFor(event)) <= 6
				) {
					if (pendingSelection.wallSegmentId) {
						onSelectWall(pendingSelection.wallSegmentId);
					} else {
						onClearSelection?.();
					}
				}
				return;
			}
			pointers.current.delete(event.pointerId);
			if (pointers.current.size === 0 && event.pointerType !== "touch") {
				itemDragSawMultiTouchRef.current = false;
				gesture.current = undefined;
			}
			return;
		}
		const placementPoint = itemPointRef.current;
		if (activeTool === "item" && placementPoint) {
			pointers.current.delete(event.pointerId);
			// A first tap only positions the ghost.  Creation is an explicit
			// confirmation so an invalid overlap never becomes a surprise durable
			// command and a valid placement remains reviewable on touch devices.
			return;
		}
		pointers.current.delete(event.pointerId);
		const remaining = [...pointers.current.values()];
		if (remaining.length === 1 && remaining[0]) {
			startPan(remaining[0]);
			return;
		}
		if (remaining.length === 0 && event.pointerType !== "touch") {
			gesture.current = undefined;
			wallDraftCancelledByMultiTouch.current = false;
			itemDragSawMultiTouchRef.current = false;
		}
	};
	function finishPlacementContact(pointerId: number): boolean {
		const rotation = placementRotationContact.current;
		const pinch = gesture.current?.kind === "pinch";
		if (rotation?.pointerId !== pointerId && !pinch) return false;
		placementRotationContact.current = undefined;
		releaseHostContact(pointerId);
		if (pointers.current.size === 0) {
			activeTouchCount.current = 0;
			touchContacts.current.clear();
			setHasPlacementRotationContact(false);
		}
		return true;
	}

	const onPointerCancel = (event: ReactPointerEvent<SVGSVGElement>) => {
		if (!isHostContactCurrent(event.pointerId)) { releaseHostContact(event.pointerId); return; }
		if (itemRotationRef.current?.pointerId === event.pointerId) {
			itemRotationRef.current = undefined;
			setItemRotation(undefined);
			releaseHostContact(event.pointerId);
			return;
		}
		if (activeTool === "item") {
			if (placementRotationContact.current?.pointerId === event.pointerId) cancelPlacementRotation();
			if (finishPlacementContact(event.pointerId)) return;
			const move = itemPlacementDragRef.current;
			if (move?.pointerId === event.pointerId) {
				itemPlacementDragRef.current = undefined;
				updateItemPoint(move.before, move.beforeExact);
				releaseHostContact(event.pointerId);
				return;
			}
		}
		if (finishRetainedHostCameraContact(event.pointerId)) return;
		hostContacts.current.delete(event.pointerId);
		clearLongPressPan();
		clearItemDragCommit();
		if (event.pointerType === "touch") {
			touchContacts.current.delete(event.pointerId);
			if (touchContacts.current.size === 0) {
				activeTouchCount.current = 0;
			}
		}
		pointers.current.delete(event.pointerId);
		setItemDrag(undefined);
		if (hostEnabledRef.current) {
			itemDragRef.current = undefined;
			itemDragPointerIdRef.current = undefined;
			hostRetainedItemDrag.current = undefined;
		}
		itemDragCancelledByMultiTouch.current = false;
		itemDragSawMultiTouchRef.current = false;
		updateItemPoint(undefined);
		itemPlacementDragRef.current = undefined;
		pendingCanvasSelectionRef.current = undefined;
		setDoorOpeningDrag(undefined);
		doorOpeningDragRef.current = undefined;
		splitGrabRef.current = undefined;
		if (wallMoveDraftRef.current) {
			clearWallMoveDraft();
			onWallMoveModeChange(false);
		}
		if (wallSplitDraftRef.current) {
			clearWallSplitDraft();
			onWallSplitModeChange(false);
		}
		if (wallVertexMoveDraftRef.current) {
			clearWallVertexMoveDraft();
			onWallVertexMoveModeChange(false);
		}
		if (wallDraftRef.current?.phase === "drawing") {
			clearWallDraft();
		}
		wallDraftCancelledByMultiTouch.current = false;
		gesture.current = undefined;
	};

	const onTouchStart = (event: React.TouchEvent<SVGSVGElement>) => {
		if (event.touches.length < 2) {
			return;
		}
		doorOpeningDragRef.current = undefined;
		setDoorOpeningDrag(undefined);
		splitGrabRef.current = undefined;
		for (let index = 0; index < event.touches.length; index += 1) {
			const touch = event.touches.item(index);
			if (touch) {
				touchContacts.current.add(touch.identifier);
			}
		}
		activeTouchCount.current = Math.max(
			activeTouchCount.current,
			event.touches.length,
		);
		if (wallMoveDraftRef.current) {
			clearWallMoveDraft();
			onWallMoveModeChange(false);
			return;
		}
		if (wallSplitDraftRef.current) {
			clearWallSplitDraft();
			onWallSplitModeChange(false);
			return;
		}
		if (wallVertexMoveDraftRef.current) {
			clearWallVertexMoveDraft();
			onWallVertexMoveModeChange(false);
			return;
		}
		if (activeTool === "wall" && wallDraftRef.current?.phase === "drawing") {
			wallDraftCancelledByMultiTouch.current = true;
			const draftPointerId = wallDraftRef.current?.pointerId;
			if (draftPointerId !== undefined) {
				wallDraftCancelledPointerIds.current.add(draftPointerId);
			}
			wallDraftRef.current = undefined;
			setWallDraft(undefined);
			return;
		}
		pendingCanvasSelectionRef.current = undefined;
		cancelPlacementForPinch();
		if (itemDragRef.current || itemDragPointerIdRef.current !== undefined) {
			cancelItemDragForMultiTouch();
		} else {
			itemDragSawMultiTouchRef.current = true;
		}
	};

	const onTouchMove = (event: React.TouchEvent<SVGSVGElement>) => {
		if (
			activeTool !== "wall" ||
			event.touches.length < 2 ||
			wallDraftRef.current?.phase !== "drawing"
		) {
			return;
		}
		activeTouchCount.current = Math.max(
			activeTouchCount.current,
			event.touches.length,
		);
		if (wallMoveDraftRef.current) {
			clearWallMoveDraft();
			onWallMoveModeChange(false);
			return;
		}
		if (wallSplitDraftRef.current) {
			clearWallSplitDraft();
			onWallSplitModeChange(false);
			return;
		}
		if (wallVertexMoveDraftRef.current) {
			clearWallVertexMoveDraft();
			onWallVertexMoveModeChange(false);
			return;
		}
		wallDraftCancelledByMultiTouch.current = true;
		const draftPointerId = wallDraftRef.current?.pointerId;
		if (draftPointerId !== undefined) {
			wallDraftCancelledPointerIds.current.add(draftPointerId);
		}
		wallDraftRef.current = undefined;
		setWallDraft(undefined);
	};

	const onTouchEnd = (event: React.TouchEvent<SVGSVGElement>) => {
		if (
			event.touches.length > 0 ||
			(activeTouchCount.current < 2 && gesture.current?.kind !== "pinch" && !placementRotationContact.current)
		) {
			return;
		}
		// Some mobile browsers finish a pinch with touchend before the paired
		// pointerup notifications. Resetting this transient gesture state keeps
		// the next one-finger drag available for panning.
		touchContacts.current.clear();
		activeTouchCount.current = 0;
		pointers.current.clear();
		gesture.current = undefined;
		placementRotationContact.current = undefined;
		setHasPlacementRotationContact(false);
	};

	function invalidateHostContacts(): void {
		if (itemDragRef.current && !itemDragRef.current.moved) {
			// Revoking an armed tap discards only that contact. A previous,
			// interrupted move remains available at its last actual world pose.
			itemDragRef.current = hostRetainedItemDrag.current;
			setItemDrag(hostRetainedItemDrag.current);
			hostRetainedItemDrag.current = undefined;
			itemDragPointerIdRef.current = undefined;
		}
		hostGateRef.current.invalidateContacts();
		if (hostEnabledRef.current && !hostGateDisposed.current) renderHostEpoch(hostGateRef.current.capture());
		for (const id of hostContacts.current.keys()) revokedHostContacts.current.add(id);
		hostContacts.current.clear();
		pointers.current.clear();
		touchContacts.current.clear();
		activeTouchCount.current = 0;
		gesture.current = undefined;
		splitGrabRef.current = undefined;
		itemPlacementDragRef.current = undefined;
		pendingCanvasSelectionRef.current = undefined;
		placementRotationContact.current = undefined;
		setHasPlacementRotationContact(false);
	}
	function cancelHostDraft(): void {
		if (hostGateRef.current.hasPending()) return;
		invalidateHostContacts();
		clearWallDraft();
		if (wallMoveDraftRef.current) cancelWallMoveDraft();
		if (wallSplitDraftRef.current || wallSplitHostConflict) cancelWallSplitDraft();
		if (wallVertexMoveDraftRef.current) cancelWallVertexMoveDraft();
		setWallSplitHostConflict(undefined);
		hostRetainedItemDrag.current = undefined;
		setItemDrag(undefined); itemDragRef.current = undefined; itemDragPointerIdRef.current = undefined;
		setItemRotation(undefined); itemRotationRef.current = undefined;
		setSubmittedItemTransform(undefined);
		setDoorOpeningDrag(undefined); doorOpeningDragRef.current = undefined;
		setPendingDoorOpeningMove(undefined);
		if (itemDraft) cancelItemPlacement(); else clearItemPlacementPreview();
		hostDraftState.current = false;
		hostDraftContactEpoch.current = undefined;
	}
	const hostActions = useRef({ invalidateHostContacts, cancelHostDraft });
	hostActions.current = { invalidateHostContacts, cancelHostDraft };
	useLayoutEffect(() => {
		if (!registerTransientBoundary) return;
		let registered = true;
		const unregister = registerTransientBoundary({
			inspect: () => registered ? {
				hasDraft: hostDraftState.current || !!(wallDraftRef.current || wallMoveDraftRef.current || wallSplitDraftRef.current || wallVertexMoveDraftRef.current || itemDragRef.current?.moved || hostRetainedItemDrag.current || itemRotationRef.current || doorOpeningDragRef.current || itemPointRef.current),
				hasPendingCommand: hostGateRef.current.hasPending(),
			} : { hasDraft: false, hasPendingCommand: false },
			suspend: () => { if (!registered) return; hostGateRef.current.suspend(); hostActions.current.invalidateHostContacts(); },
			resume: () => { if (registered) hostGateRef.current.resume(); },
			invalidateContacts: () => { if (registered) hostActions.current.invalidateHostContacts(); },
			cancelDraft: () => { if (registered) hostActions.current.cancelHostDraft(); },
		});
		return () => { registered = false; hostActions.current.invalidateHostContacts(); unregister(); };
	}, [registerTransientBoundary]);
	useEffect(() => {
		if (!registerTransientBoundary) return;
		const invalidate = () => hostActions.current.invalidateHostContacts();
		const windowBlur = (event: Event) => { if (event.target === window) invalidate(); };
		const hidden = () => { if (document.hidden) invalidate(); };
		window.addEventListener("blur", windowBlur, true);
		document.addEventListener("visibilitychange", hidden, true);
		return () => { window.removeEventListener("blur", windowBlur, true); document.removeEventListener("visibilitychange", hidden, true); };
	}, [registerTransientBoundary]);

	const visibleBounds = Number.isFinite(drawingScale)
		? visibleWorldBounds(viewport, {
				canvasHeight: canvasSize.canvasHeight,
				canvasWidth: canvasSize.canvasWidth,
				originCanvasX: x,
				originCanvasY: y,
				originWorldXMm: minX,
				originWorldZMm: minZ,
				pixelsPerMm: drawingScale,
			})
		: undefined;
	// The return control is only useful after the whole drawing has left the
	// visible canvas.  Compare the rendered drawing frame with the canvas rather
	// than individual centre lines: this is stable at a wall's edge and matches
	// what a person can actually still see on screen.
	const drawingLeft = viewport.panX + x * viewport.zoom;
	const drawingTop = viewport.panY + y * viewport.zoom;
	const isDrawingVisible =
		drawingLeft + renderedWidth * viewport.zoom >= 0 &&
		drawingLeft <= canvasSize.canvasWidth &&
		drawingTop + renderedDepth * viewport.zoom >= 0 &&
		drawingTop <= canvasSize.canvasHeight;
	useEffect(() => {
		onDrawingVisibilityChange(isDrawingVisible);
	}, [isDrawingVisible, onDrawingVisibilityChange]);

	if (!Number.isFinite(drawingScale) || !visibleBounds) {
		return (
			<div className={styles.emptyCanvas} data-testid="empty-plan">
				Контур ещё не создан
			</div>
		);
	}
	const dimensionScreenPoint = (point: {
		readonly xMm: number;
		readonly zMm: number;
	}) => {
		const screen = pointFor(point.xMm, point.zMm);
		return {
			x: viewport.panX + screen.x * viewport.zoom,
			y: viewport.panY + screen.y * viewport.zoom,
		};
	};
	const dimensionVertexById = new Map(
		vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const dimensionWallObstacles =
		drawingDimensions.length === 0
			? []
			: project.level.wallSegments.flatMap((wall) => {
					const start = dimensionVertexById.get(wall.startVertexId),
						end = dimensionVertexById.get(wall.endVertexId);
					if (!start || !end) return [];
					const first = dimensionScreenPoint(start),
						second = dimensionScreenPoint(end);
					const length = Math.hypot(second.x - first.x, second.y - first.y);
					const half = (wall.thicknessMm * drawingScale * viewport.zoom) / 2;
					if (
						!Number.isFinite(length) ||
						length <= 0 ||
						!Number.isFinite(half) ||
						half <= 0
					)
						return [];
					const normal = {
						x: (-(second.y - first.y) / length) * half,
						y: ((second.x - first.x) / length) * half,
					};
					return [
						[
							{ x: first.x + normal.x, y: first.y + normal.y },
							{ x: second.x + normal.x, y: second.y + normal.y },
							{ x: second.x - normal.x, y: second.y - normal.y },
							{ x: first.x - normal.x, y: first.y - normal.y },
						],
					];
				});
	const dimensionLayouts = layoutDrawingDimensions(drawingDimensions, {
		measureText: dimensionTypography?.measureText,
		projectPoint: dimensionScreenPoint,
		contentObstacles: dimensionWallObstacles,
		bounds: {
			x: 8,
			y: canvasInsets.top + 16,
			width: Math.max(1, canvasSize.canvasWidth - 16),
			height: Math.max(
				1,
				canvasSize.canvasHeight - canvasInsets.top - canvasInsets.bottom - 24,
			),
		},
		obstacles: annotationObstacles,
	});
	const transformItemId = itemDrag?.moved ? itemDrag.assetInstanceId : itemRotation?.assetInstanceId;
	const transformItem = transformItemId ? project.assetInstances.find(
		(item) => item.assetInstanceId === transformItemId,
	) : undefined;
	const transformFootprint = transformItem && isFloorEditorAsset(transformItem) ? {
		...transformItem,
		...(itemDrag?.moved ? itemDrag.end : {}),
		yawStep: undefined,
		yawRadians: itemRotation?.yawRadians ?? yawRadiansForEditorFloorAsset(transformItem),
		continuousYaw: true as const,
	} : undefined;
	const wallDistanceFootprint = itemPlacementPreview ?? transformFootprint;
	const wallDistances = showItemWallDistances && !readOnly && derivedPlan && wallDistanceFootprint
		? itemWallDistancesFor(derivedPlan.rooms, wallDistanceFootprint)
		: [];
	const wallDistanceBounds = {
		x: 8,
		y: canvasInsets.top + 16,
		width: canvasSize.canvasWidth - 16,
		height: canvasSize.canvasHeight - canvasInsets.top - canvasInsets.bottom - 24,
	};
	const leftPlacementStepRadians = exactFloorYaw ? Math.PI / 180 : -Math.PI / 4;
	const transform = `translate(${viewport.panX} ${viewport.panY}) scale(${viewport.zoom})`;
	const visualGridStep = visualGridStepMm();
	const retainedHostTransform = retainedHostItemTransform();
	const gridPhaseMm = PLAN_GRID_STEP_MM / 2;

	return (
		<>
			<svg
				aria-label="План помещения"
				className={styles.planSvg}
				data-active-tool={activeTool}
				data-interaction-locked={isInteractionLocked ? "true" : undefined}
				data-testid="plan-canvas"
				onPointerCancel={onPointerCancel}
				onLostPointerCapture={(event) => {
					// Normal release has already cleared these refs. Only unexpected
					// capture loss cancels contacts, otherwise a ready split survives.
					if (
						doorOpeningDragRef.current?.pointerId === event.pointerId ||
						splitGrabRef.current?.pointerId === event.pointerId ||
						itemPlacementDragRef.current?.pointerId === event.pointerId ||
						placementRotationContact.current?.pointerId === event.pointerId ||
						itemRotationRef.current?.pointerId === event.pointerId ||
						(gesture.current?.kind === "pinch" && pointers.current.has(event.pointerId))
					)
						onPointerCancel(event);
				}}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
				onWheel={(event) => {
					event.preventDefault();
					setViewport((previous) =>
						zoomEditorViewportAround(
							previous,
							Math.exp(-event.deltaY * 0.0015),
							visibleCanvasCentre(),
							maximumViewportZoom,
						),
					);
				}}
				role={keyboardItemMovement ? "group" : "img"}
				ref={planSvgRef}
				viewBox={`0 0 ${canvasSize.canvasWidth} ${canvasSize.canvasHeight}`}
			>
				<rect
					className={styles.gridFill}
					height={canvasSize.canvasHeight}
					width={canvasSize.canvasWidth}
					x="0"
					y="0"
				/>
				<defs>
					<pattern
						id={wallHatchId}
						patternUnits="userSpaceOnUse"
						width={6 / viewport.zoom}
						height={6 / viewport.zoom}
						patternTransform="rotate(45)"
					>
						<rect
							width={6 / viewport.zoom}
							height={6 / viewport.zoom}
							fill="#e9e5dd"
						/>
						<line
							x1="0"
							y1="0"
							x2="0"
							y2={6 / viewport.zoom}
							className={styles.wallHatchLine}
						/>
					</pattern>
				</defs>
				<g data-testid="plan-content" transform={transform}>
					{roomFacePolygons.map(({ key, roomId, vertices }) => (
						<polygon
							className={styles.roomFill}
							data-room-id={roomId}
							data-testid="room-face"
							key={key}
							points={vertices
								.map((vertex) => {
									const point = pointFor(vertex.xMm, vertex.zMm);
									return `${point.x},${point.y}`;
								})
								.join(" ")}
						/>
					))}
					{roomFaceTiles.map(({ key, roomId, tile }) => {
						const start = pointFor(tile.minXmm, tile.minZmm);
						const end = pointFor(tile.maxXmm, tile.maxZmm);
						return (
							<rect
								className={styles.roomFill}
								data-testid="room-face"
								height={end.y - start.y}
								key={key}
								data-room-id={roomId}
								width={end.x - start.x}
								x={start.x}
								y={start.y}
							/>
						);
					})}
					{roomLabels.map((room) => {
						const center = pointFor(room.xMm, room.zMm);
						return (
							<text
								className={styles.roomLabel}
								data-room-id={room.roomId}
								data-testid="room-label"
								key={`label-${room.roomId}`}
								textAnchor="middle"
								x={center.x}
								y={center.y - 20}
							>
								{room.label}
							</text>
						);
					})}
					<g data-testid="infinite-grid">
						{gridLinesBetween(
							visibleBounds.minXMm,
							visibleBounds.maxXMm,
							visualGridStep,
							gridPhaseMm,
						).map((xMm) => {
							const line = pointFor(xMm, visibleBounds.minZMm);
							return (
								<line
									className={
										(xMm - gridPhaseMm) % 1000 === 0
											? styles.planGridMajor
											: styles.planGridLine
									}
									key={`x-${xMm}`}
									x1={line.x}
									x2={line.x}
									y1={pointFor(xMm, visibleBounds.minZMm).y}
									y2={pointFor(xMm, visibleBounds.maxZMm).y}
								/>
							);
						})}
						{gridLinesBetween(
							visibleBounds.minZMm,
							visibleBounds.maxZMm,
							visualGridStep,
							gridPhaseMm,
						).map((zMm) => {
							const line = pointFor(visibleBounds.minXMm, zMm);
							return (
								<line
									className={
										(zMm - gridPhaseMm) % 1000 === 0
											? styles.planGridMajor
											: styles.planGridLine
									}
									key={`z-${zMm}`}
									x1={pointFor(visibleBounds.minXMm, zMm).x}
									x2={pointFor(visibleBounds.maxXMm, zMm).x}
									y1={line.y}
									y2={line.y}
								/>
							);
						})}
					</g>
					{project.level.wallSegments.map((wall) => {
						const start = vertices.find(
							(vertex) => vertex.vertexId === wall.startVertexId,
						);
						const end = vertices.find(
							(vertex) => vertex.vertexId === wall.endVertexId,
						);
						if (!start || !end) {
							return null;
						}
						const startPoint = pointFor(start.xMm, start.zMm);
						const endPoint = pointFor(end.xMm, end.zMm);
						const wallBody = wallBodiesById.get(wall.wallSegmentId);
						const wallHitTarget = Math.max(
							MINIMUM_TOUCH_TARGET_PX / viewport.zoom,
							wall.thicknessMm * drawingScale,
						);
						const isExterior = exteriorWallSegmentIds.has(wall.wallSegmentId);
						const isSelectedWall = selectedWallId === wall.wallSegmentId;
						const hasPlacementCollision = itemPlacementCollisionIds.walls.has(
							wall.wallSegmentId,
						);
						const openingSegments = project.level.openings.flatMap(
							(opening) => {
								if (opening.wallSegmentId !== wall.wallSegmentId) {
									return [];
								}
								const lengthMm = Math.hypot(
									end.xMm - start.xMm,
									end.zMm - start.zMm,
								);
								if (!Number.isFinite(lengthMm) || lengthMm <= 0) {
									return [];
								}
								const renderedOpening =
									doorOpeningDrag?.openingId === opening.openingId
										? { ...opening, offsetMm: doorOpeningDrag.offsetMm }
										: pendingDoorOpeningMove?.openingId === opening.openingId
											? {
													...opening,
													offsetMm: pendingDoorOpeningMove.offsetMm,
												}
											: openingMovePreview?.openingId === opening.openingId
												? { ...opening, offsetMm: openingMovePreview.offsetMm,
													...(opening.kind === "Door" && openingMovePreview.swingSide ? { swingSide: openingMovePreview.swingSide } : {}) }
												: opening;
								const interval = wallOpeningIntervalMm(renderedOpening);
								const pointAt = (offsetMm: number) =>
									pointFor(
										start.xMm + ((end.xMm - start.xMm) * offsetMm) / lengthMm,
										start.zMm + ((end.zMm - start.zMm) * offsetMm) / lengthMm,
									);
								return [
									{
										end: pointAt(interval.endMm),
										opening: renderedOpening,
										start: pointAt(interval.startMm),
									},
								];
							},
						);
						const openingCreationInterval =
							openingCreationPreview?.wallSegmentId === wall.wallSegmentId
								? wallOpeningIntervalMm(openingCreationPreview)
								: undefined;
						const openingCreationSegment = openingCreationInterval
							? {
									end: pointFor(
										start.xMm +
											((end.xMm - start.xMm) * openingCreationInterval.endMm) /
												Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm),
										start.zMm +
											((end.zMm - start.zMm) * openingCreationInterval.endMm) /
												Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm),
									),
									start: pointFor(
										start.xMm +
											((end.xMm - start.xMm) *
												openingCreationInterval.startMm) /
												Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm),
										start.zMm +
											((end.zMm - start.zMm) *
												openingCreationInterval.startMm) /
												Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm),
									),
								}
							: undefined;
						return (
							<g key={wall.wallSegmentId}>
								{wallBody ? (
									<>
										<polygon
											className={styles.wallBody}
											data-testid="wall-body"
											data-selected={isSelectedWall}
											data-wall-id={wall.wallSegmentId}
											data-thickness-mm={wall.thicknessMm}
											fill={`url(#${wallHatchId})`}
											points={wallBody.polygonMm
												.map((point) => {
													const screen = pointFor(point.xMm, point.zMm);
													return `${screen.x},${screen.y}`;
												})
												.join(" ")}
											pointerEvents="none"
										/>
										<path
											className={`${styles.wallBodyOutline} ${isSelectedWall ? styles.selectedWall : ""} ${hasPlacementCollision ? styles.previewCollisionWall : ""}`}
											data-testid="wall-body-outline"
											data-selected={isSelectedWall}
											d={wallBody.outlinesMm
												.map(([from, to]) => {
													const a = pointFor(from.xMm, from.zMm);
													const b = pointFor(to.xMm, to.zMm);
													return `M${a.x},${a.y} L${b.x},${b.y}`;
												})
												.join(" ")}
											pointerEvents="none"
										/>
									</>
								) : null}
								<line
									className={`${styles.wallOutline} ${isSelectedWall ? styles.selectedWall : ""} ${hasPlacementCollision ? styles.previewCollisionWall : ""}`}
									data-preview-collision={
										hasPlacementCollision ? "wall" : undefined
									}
									data-wall-id={wall.wallSegmentId}
									data-wall-kind={isExterior ? "exterior" : "interior"}
									data-testid="wall-line"
									opacity={0}
									pointerEvents="none"
									strokeWidth={wall.thicknessMm * drawingScale}
									x1={startPoint.x}
									x2={endPoint.x}
									y1={startPoint.y}
									y2={endPoint.y}
								/>
								<path
									className={styles.wallHitArea}
									data-testid="wall-segment"
									data-wall-id={wall.wallSegmentId}
									data-wall-kind={isExterior ? "exterior" : "interior"}
									d={wallHitPath(startPoint, endPoint, wallHitTarget)}
									fill="rgba(0, 0, 0, 0.001)"
								/>
								{openingCreationSegment && showOpeningTemplates && openingCreationPreview?.kind ? (
									<g data-testid="opening-creation-preview" className={styles.openingSymbolPreview} pointerEvents="none">
										<OpeningPlanSymbol {...openingCreationSegment} kind={openingCreationPreview.kind}
											swingSide={openingCreationPreview.swingSide} thickness={wall.thicknessMm * drawingScale}
											divided={openingCreationPreview.widthMm >= DIVIDED_WINDOW_MIN_WIDTH_MM} />
									</g>
								) : openingCreationSegment ? (
									<line
										className={styles.openingCreationPreview}
										data-testid="opening-creation-preview"
										pointerEvents="none"
										strokeWidth={Math.max(
											3,
											wall.thicknessMm * drawingScale * 0.4,
										)}
										x1={openingCreationSegment.start.x}
										x2={openingCreationSegment.end.x}
										y1={openingCreationSegment.start.y}
										y2={openingCreationSegment.end.y}
									/>
								) : null}
								{openingSegments.map(
									({ end: openingEnd, opening, start: openingStart }) => {
										const hasOpeningPlacementCollision =
											itemPlacementCollisionIds.doors.has(opening.openingId) ||
											(openingDragError !== undefined &&
												doorOpeningDrag?.openingId === opening.openingId);
										const openingLength = Math.hypot(
											openingEnd.x - openingStart.x,
											openingEnd.y - openingStart.y,
										);
										const windowPaneNormal =
											opening.kind === "Window" &&
											openingLength > Number.EPSILON
												? {
														x: -(openingEnd.y - openingStart.y) / openingLength,
														y: (openingEnd.x - openingStart.x) / openingLength,
													}
												: undefined;
										const windowPaneStrokeWidth = Math.max(
											1.1,
											Math.min(2, wall.thicknessMm * drawingScale * 0.1),
										);
										const windowPaneOffset = Math.max(
											windowPaneStrokeWidth,
											Math.min(6, wall.thicknessMm * drawingScale * 0.25),
										);
										return (
											<g
												data-opening-id={opening.openingId}
												data-preview-collision={
													hasOpeningPlacementCollision
														? "door-clearance"
														: undefined
												}
												data-testid={
													opening.kind === "Door"
														? "door-opening"
														: "window-opening"
												}
												key={opening.openingId}
												pointerEvents="none"
											>
												{showOpeningTemplates ? (
													<g className={styles.openingSymbol} data-selected={opening.openingId === selectedOpeningId} data-collision={hasOpeningPlacementCollision}
														pointerEvents={!readOnly && activeTool === "select" ? "stroke" : "none"}
														data-door-opening-handle={opening.openingId} data-door-opening-wall={wall.wallSegmentId}>
														<OpeningPlanSymbol start={openingStart} end={openingEnd} kind={opening.kind}
															swingSide={opening.swingSide} thickness={wall.thicknessMm * drawingScale}
															divided={opening.widthMm >= DIVIDED_WINDOW_MIN_WIDTH_MM} />
													</g>
												) : <>
												<line
													className={styles.doorOpeningCutout}
													strokeWidth={Math.max(
														4,
														wall.thicknessMm * drawingScale + 2,
													)}
													x1={openingStart.x}
													x2={openingEnd.x}
													y1={openingStart.y}
													y2={openingEnd.y}
												/>
												{windowPaneNormal ? (
													[-1, 1].map((direction) => (
														<line
															className={`${styles.windowOpeningPane} ${isSelectedWall ? styles.selectedOpening : ""} ${hasOpeningPlacementCollision ? styles.previewCollisionDoor : ""}`}
															data-testid="window-opening-pane"
															data-window-pane-direction={direction}
															key={`${opening.openingId}-pane-${direction}`}
															strokeWidth={windowPaneStrokeWidth}
															x1={
																openingStart.x +
																windowPaneNormal.x *
																	windowPaneOffset *
																	direction
															}
															x2={
																openingEnd.x +
																windowPaneNormal.x *
																	windowPaneOffset *
																	direction
															}
															y1={
																openingStart.y +
																windowPaneNormal.y *
																	windowPaneOffset *
																	direction
															}
															y2={
																openingEnd.y +
																windowPaneNormal.y *
																	windowPaneOffset *
																	direction
															}
														/>
													))
												) : (
													<line
														className={`${styles.doorOpeningMarker} ${isSelectedWall ? styles.selectedOpening : ""} ${hasOpeningPlacementCollision ? styles.previewCollisionDoor : ""}`}
														strokeWidth={Math.max(
															2,
															wall.thicknessMm * drawingScale * 0.22,
														)}
														x1={openingStart.x}
														x2={openingEnd.x}
														y1={openingStart.y}
														y2={openingEnd.y}
													/>
												)}
												</>}
												{!readOnly && activeTool === "select" ? (
													<g>
														{/* biome-ignore lint/a11y/useSemanticElements: SVG handle must stay in plan coordinates; arrow keys provide keyboard movement. */}
														<circle
															data-testid="opening-move-handle"
															data-door-opening-handle={opening.openingId}
															data-door-opening-wall={wall.wallSegmentId}
															cx={(openingStart.x + openingEnd.x) / 2}
															cy={(openingStart.y + openingEnd.y) / 2}
															r={24 / viewport.zoom}
															fill="transparent"
															pointerEvents="all"
															style={{ cursor: "grab" }}
															aria-label={`Переместить ${opening.kind === "Door" ? "дверь" : "окно"} вдоль стены`}
															role="button"
															tabIndex={0}
															onKeyDown={(event) => {
																if (
																	event.key !== "ArrowLeft" &&
																	event.key !== "ArrowRight"
																)
																	return;
																event.preventDefault();
																event.stopPropagation();
																onSelectOpening?.(opening.openingId);
																void onMoveDoorOpening({
																	openingId: opening.openingId,
																	offsetMm:
																		opening.offsetMm +
																		(event.key === "ArrowLeft" ? -100 : 100),
																});
															}}
														/>
														<circle
															cx={(openingStart.x + openingEnd.x) / 2}
															cy={(openingStart.y + openingEnd.y) / 2}
															r={5 / viewport.zoom}
															data-idle={showOpeningTemplates && opening.openingId !== selectedOpeningId && !hasOpeningPlacementCollision}
															className={`${styles.openingMoveDot} ${hasOpeningPlacementCollision ? styles.openingMoveDotInvalid : ""}`}
															pointerEvents="none"
														/>
													</g>
												) : null}
											</g>
										);
									},
								)}
							</g>
						);
					})}
					{isWallVertexMoveMode
						? project.level.wallSegments
								.filter((wall) => wall.wallSegmentId === selectedWallId)
								.flatMap((wall) => [wall.startVertexId, wall.endVertexId])
								.filter((vertexId) => movableWallVertexIds.includes(vertexId))
								.flatMap((vertexId) => {
									const vertex = vertices.find(
										(candidate) => candidate.vertexId === vertexId,
									);
									if (!vertex) return [];
									const point = pointFor(vertex.xMm, vertex.zMm);
									return [
										<g key={`vertex-handle-${vertexId}`}>
											<circle
												aria-label="Переместить вершину стены"
												className={styles.wallVertexMoveHandleHitArea}
												cx={point.x}
												cy={point.y}
												data-testid="wall-vertex-move-handle"
												data-wall-vertex-id={vertexId}
												pointerEvents="all"
												r={22 / viewport.zoom}
											/>
											<circle
												className={styles.wallVertexMoveHandle}
												cx={point.x}
												cy={point.y}
												pointerEvents="none"
												r={7 / viewport.zoom}
											/>
										</g>,
									];
								})
						: null}
					{itemPlacementPreview
						? (() => {
								const center = pointFor(
									itemPlacementPreview.xMm,
									itemPlacementPreview.zMm,
								);
								const previewPoints = floorItemFootprintCorners(
									itemPlacementPreview,
								)
									.map((point) => {
										const screen = pointFor(point.xMm, point.zMm);
										return `${screen.x},${screen.y}`;
									})
									.join(" ");
								const actionHeight = 64;
								const actionWidth = 250;
								const actionGap = 8;
								const actionBottomInset =
									canvasSize.canvasWidth < 560 ? 128 : 12;
								const actionX = (canvasSize.canvasWidth - actionWidth) / 2;
								const actionY =
									canvasSize.canvasHeight - actionHeight - actionBottomInset;
								const stopCanvasGesture = (event: {
									preventDefault(): void;
									stopPropagation(): void;
								}) => {
									event.preventDefault();
									event.stopPropagation();
								};
								const hostTilesForPartialPreview =
									itemPlacementPreview.reasonCode === "OUTSIDE_ROOM_HOST"
										? (derivedPlan?.rooms.find((room) =>
												room.usableFloorTilesMm.some(
													(tile) =>
														itemPlacementPreview.xMm >= tile.minXmm &&
														itemPlacementPreview.xMm <= tile.maxXmm &&
														itemPlacementPreview.zMm >= tile.minZmm &&
														itemPlacementPreview.zMm <= tile.maxZmm,
												),
											)?.usableFloorTilesMm ?? [])
										: [];
								const partialPreviewClipId = "item-placement-host-preview";
								return (
									<g
										data-placement-tier={itemPlacementPreview.tier}
										data-placement-valid={itemPlacementPreview.isValid}
										data-testid="item-placement-preview"
										aria-label={`Предпросмотр размещения: ${itemDraft?.label ?? "Предмет"}`}
									>
										{hostTilesForPartialPreview.length > 0 ? (
											<defs>
												<clipPath id={partialPreviewClipId}>
													{hostTilesForPartialPreview.map((tile) => {
														const tileStart = pointFor(
															tile.minXmm,
															tile.minZmm,
														);
														const tileEnd = pointFor(tile.maxXmm, tile.maxZmm);
														return (
															<rect
																height={tileEnd.y - tileStart.y}
																key={`preview-host-${tile.minXmm}:${tile.minZmm}:${tile.maxXmm}:${tile.maxZmm}`}
																width={tileEnd.x - tileStart.x}
																x={tileStart.x}
																y={tileStart.y}
															/>
														);
													})}
												</clipPath>
											</defs>
										) : null}
										<polygon
											points={previewPoints}
											className={
												itemPlacementPreview.tier === "invalid"
													? styles.itemPlacementPreviewInvalid
													: itemPlacementPreview.tier === "warning"
														? styles.itemPlacementPreviewWarning
														: styles.itemPlacementPreviewValid
											}
										/>
										{hostTilesForPartialPreview.length > 0 ? (
											<polygon
												points={previewPoints}
												className={styles.itemPlacementPreviewValid}
												clipPath={`url(#${partialPreviewClipId})`}
											/>
										) : null}
										<PlacementRotationControl
											x={center.x}
											y={center.y}
											zoom={viewport.zoom}
											yawRadians={yawRadiansFor(itemPlacementPreview)}
											disabled={readOnly || isConfirmingItemPlacement}
											exact={exactFloorYaw}
											showHandle={plainLabels}
											onChange={onItemPlacementYawChange}
										/>
										<g
											className={styles.itemPlacementActionBar}
											data-testid="legacy-item-placement-action-bar"
											transform={`translate(${actionX} ${actionY})`}
										>
											<rect height={actionHeight} rx={8} width={actionWidth} />
											{/* biome-ignore lint/a11y/useSemanticElements: the SVG coordinate system needs positioned touch controls. */}
											<g
												aria-disabled={
													!itemPlacementPreview.isValid ||
													isConfirmingItemPlacement
												}
												aria-label="Подтвердить размещение предмета"
												className={styles.itemPlacementConfirm}
												data-testid="legacy-item-placement-confirm"
												onClick={(event) => {
													stopCanvasGesture(event);
													confirmItemPlacement();
												}}
												onPointerDown={stopCanvasGesture}
												role="button"
												tabIndex={
													itemPlacementPreview.isValid &&
													!isConfirmingItemPlacement
														? 0
														: -1
												}
												transform={`translate(${actionGap} ${actionGap})`}
											>
												<rect
													height={actionHeight - actionGap * 2}
													rx={6}
													width={162}
												/>
												<text
													dominantBaseline="central"
													x={81}
													y={(actionHeight - actionGap * 2) / 2}
												>
													{plainLabels ? "Подтвердить" : "Подтвердить ✓"}
												</text>
											</g>
											{/* biome-ignore lint/a11y/useSemanticElements: the SVG coordinate system needs positioned touch controls. */}
											<g
												aria-label="Отменить размещение предмета"
												className={styles.itemPlacementCancel}
												data-testid="legacy-item-placement-cancel"
												onClick={(event) => {
													stopCanvasGesture(event);
													cancelItemPlacement();
												}}
												onPointerDown={stopCanvasGesture}
												role="button"
												tabIndex={0}
												transform={`translate(${178} ${actionGap})`}
											>
												<rect
													height={actionHeight - actionGap * 2}
													rx={6}
													width={actionWidth - 178 - actionGap}
												/>
												<text
													dominantBaseline="central"
													x={(actionWidth - 178 - actionGap) / 2}
													y={(actionHeight - actionGap * 2) / 2}
												>
													×
												</text>
											</g>
										</g>
									</g>
								);
							})()
						: null}
					{project.assetInstances.map((item) => {
						if (!isFloorEditorAsset(item)) return null;
						const position =
							itemDrag?.assetInstanceId === item.assetInstanceId
								? itemDrag.end
								: submittedItemTransform?.assetInstanceId ===
											item.assetInstanceId &&
										submittedItemTransform.kind === "move"
									? submittedItemTransform
									: item;
						const start = pointFor(
							position.xMm - item.widthMm / 2,
							position.zMm - item.depthMm / 2,
						);
						const center = pointFor(position.xMm, position.zMm);
						const silhouettePaths = planItemSilhouettePathsFor(
							planItemSilhouetteKindFor(item.label),
						);
						const frontLength = Math.max(
							5,
							Math.min(12, (item.depthMm * drawingScale) / 2 - 2),
						);
						const yawRadians = yawRadiansForEditorFloorAsset(item);
						const selected = selectedItemId === item.assetInstanceId;
						const hasPlacementCollision = itemPlacementCollisionIds.items.has(
							item.assetInstanceId,
						);
						const rotationGizmoCenter = rotationGizmoCenterFor(position);
						const gizmoCenter = pointFor(
							rotationGizmoCenter.xMm,
							rotationGizmoCenter.zMm,
						);
						const gizmoRadius = plainLabels
							? Math.max(36 / viewport.zoom, (Math.hypot(item.widthMm, item.depthMm) * drawingScale) / 2 + 24 / viewport.zoom)
							: Math.max(24, (Math.max(item.widthMm, item.depthMm) * drawingScale) / 2 + 18);
						const gizmoHitWidth = Math.min(32, gizmoRadius);
						const renderedYawRadians =
							itemRotation?.assetInstanceId === item.assetInstanceId
								? itemRotation.yawRadians
								: submittedItemTransform?.assetInstanceId ===
											item.assetInstanceId &&
										submittedItemTransform.kind === "rotation"
									? (submittedItemTransform.yawRadians ?? yawRadians)
									: yawRadians;
						const renderedYawDegrees = -(renderedYawRadians * 180) / Math.PI;
						const rotationBlocked = !!retainedHostTransform && (retainedHostTransform.kind !== "rotation" || retainedHostTransform.assetInstanceId !== item.assetInstanceId);
						const moveBlocked = !!retainedHostTransform && (retainedHostTransform.kind !== "move" || retainedHostTransform.assetInstanceId !== item.assetInstanceId);
						const keyboardSelectable = keyboardItemMovement && activeTool === "select" && !isInteractionLocked && !isWallMoveMode && !isWallSplitMode && !isWallVertexMoveMode;

						const selectionFrameInset = 4 / viewport.zoom;
						const selectionHandleRadius = 5 / viewport.zoom;
						const selectionFrame = {
							height: item.depthMm * drawingScale + selectionFrameInset * 2,
							width: item.widthMm * drawingScale + selectionFrameInset * 2,
							x: start.x - selectionFrameInset,
							y: start.y - selectionFrameInset,
						};
						return (
							<Fragment key={item.assetInstanceId}>
								<g
									data-item-id={item.assetInstanceId}
									transform={`rotate(${renderedYawDegrees} ${center.x} ${center.y})`}
								>
									<rect
										className={`${styles.schematicItem} ${selected ? styles.selectedItem : ""} ${hasPlacementCollision ? styles.previewCollisionItem : ""}`}
										data-preview-collision={
											hasPlacementCollision ? "item" : undefined
										}
										{...(keyboardSelectable ? {
											role: "button",
											"aria-label": `Выбрать предмет «${item.label}»`,
											"aria-pressed": selected,
											"aria-keyshortcuts": "Enter Space ArrowLeft ArrowRight ArrowUp ArrowDown",
											tabIndex: 0,
											onKeyDown: (event: React.KeyboardEvent<SVGRectElement>) => {
												if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault();
													onSelectItem(item.assetInstanceId);
													return;
												}
												const step = itemArrowSteps[event.key];
												if (!selected || !step) return;
												event.preventDefault();
												if (readOnly || retainedHostTransform || itemDrag || itemRotation || ("locked" in item && item.locked)) return;
												void persistItemMove({
													assetInstanceId: item.assetInstanceId,
													xMm: item.xMm + step.xMm,
													zMm: item.zMm + step.zMm,
												});
											},
										} : {})}
										data-testid="schematic-item"
										aria-disabled={moveBlocked || undefined}
										style={moveBlocked ? { cursor: "not-allowed" } : undefined}
										fill={item.color}
										height={item.depthMm * drawingScale}
										width={item.widthMm * drawingScale}
										x={start.x}
										y={start.y}
									/>
									{silhouettePaths.length > 0 ? (
										<g
											className={styles.schematicItemDetail}
											data-testid="plan-item-silhouette"
											transform={`translate(${start.x} ${start.y}) scale(${(item.widthMm * drawingScale) / 100} ${(item.depthMm * drawingScale) / 100})`}
										>
											{silhouettePaths.map((path) => (
												<path
													d={path}
													key={`${item.assetInstanceId}-detail-${path}`}
												/>
											))}
										</g>
									) : null}
									<path
										className={styles.itemFrontMarker}
										d={`M ${center.x} ${center.y + frontLength} l -4 -6 h 8 z`}
										data-testid="schematic-item-front"
										pointerEvents="none"
									/>
								</g>
								{selected ? (
									<g
										aria-label={`Выделение предмета: ${item.label}`}
										className={styles.itemSelectionFrame}
										data-testid="two-dimensional-item-selection-frame"
										pointerEvents="none"
										transform={`rotate(${renderedYawDegrees} ${center.x} ${center.y})`}
									>
										<rect
											height={selectionFrame.height}
											rx={1.5 / viewport.zoom}
											width={selectionFrame.width}
											x={selectionFrame.x}
											y={selectionFrame.y}
										/>
										{[
											{
												corner: "top-left",
												x: selectionFrame.x,
												y: selectionFrame.y,
											},
											{
												corner: "top-right",
												x: selectionFrame.x + selectionFrame.width,
												y: selectionFrame.y,
											},
											{
												corner: "bottom-right",
												x: selectionFrame.x + selectionFrame.width,
												y: selectionFrame.y + selectionFrame.height,
											},
											{
												corner: "bottom-left",
												x: selectionFrame.x,
												y: selectionFrame.y + selectionFrame.height,
											},
										].map(({ corner, x, y }) => (
											<circle
												data-testid="two-dimensional-item-selection-handle"
												key={`${item.assetInstanceId}-selection-handle-${corner}`}
												r={selectionHandleRadius}
												cx={x}
												cy={y}
											/>
										))}
									</g>
								) : null}
								{selected && (!plainLabels || (!readOnly && !("locked" in item && item.locked))) ? (
									<g
										className={`${styles.rotationGizmo} rotationGizmo`}
										data-item-id={item.assetInstanceId}
										data-rotation-active={
											itemRotation?.assetInstanceId === item.assetInstanceId
												? "true"
												: "false"
										}
										data-testid="rotation-gizmo"
										aria-disabled={rotationBlocked || undefined}
										style={rotationBlocked ? { opacity: 0.45 } : undefined}
									>
										<circle
											aria-label="Кольцо поворота предмета"
											cx={gizmoCenter.x}
											cy={gizmoCenter.y}
											data-testid="two-dimensional-rotation-track"
											r={gizmoRadius}
										/>
										<circle
											className={styles.rotationHitArea}
											cx={gizmoCenter.x}
											cy={gizmoCenter.y}
											data-rotation-hit-area={item.assetInstanceId}
											data-testid="two-dimensional-rotation-hit-area"
											aria-disabled={rotationBlocked || undefined}
											style={rotationBlocked ? { cursor: "not-allowed" } : undefined}
											fill="none"
											pointerEvents="stroke"
											r={gizmoRadius}
											strokeWidth={gizmoHitWidth}
										/>
										<circle
											className={styles.rotationHandle}
											cx={
												gizmoCenter.x +
												Math.sin(renderedYawRadians) * gizmoRadius
											}
											cy={
												gizmoCenter.y +
												Math.cos(renderedYawRadians) * gizmoRadius
											}
											data-rotation-handle={item.assetInstanceId}
											pointerEvents="all"
											r={plainLabels ? 6 / viewport.zoom : 12}
										/>
									</g>
								) : null}
							</Fragment>
						);
					})}
					{project.schemaVersion === 1
						? project.assetInstances.map((item) => {
								if (item.anchorClass !== "wall") return null;
								const wall = project.level.wallSegments.find(
									(candidate) => candidate.wallSegmentId === item.wallSegmentId,
								);
								const start = wall
									? vertices.find(
											(vertex) => vertex.vertexId === wall.startVertexId,
										)
									: undefined;
								const end = wall
									? vertices.find(
											(vertex) => vertex.vertexId === wall.endVertexId,
										)
									: undefined;
								if (!wall || !start || !end) return null;
								const footprint = wallItemPlanFootprintForProjection(
									item,
									wall,
									start,
									end,
								);
								if (!footprint) return null;
								return (
									<polygon
										aria-label={`Настенный предмет: ${item.label}`}
										className={styles.schematicItem}
										data-item-id={item.assetInstanceId}
										data-testid="wall-schematic-item"
										data-wall-item-side={item.side}
										fill={item.color}
										key={item.assetInstanceId}
										points={footprint.corners
											.map(({ xMm, zMm }) => {
												const point = pointFor(xMm, zMm);
												return `${point.x},${point.y}`;
											})
											.join(" ")}
										pointerEvents="none"
									/>
								);
							})
						: null}
					{roomMeasurements.map(({ bounds, measurement, roomId }) => {
						const start = pointFor(bounds.minXmm, bounds.minZmm);
						const end = pointFor(bounds.maxXmm, bounds.maxZmm);
						const sizeLabel =
							measurement.kind === "rectangular"
								? `${formatLengthMm(measurement.widthMm)} × ${formatLengthMm(measurement.depthMm)}`
								: "По внутреннему контуру";
						const perimeterLabel = `Периметр: ${formatLengthMm(measurement.perimeterMm)}`;
						const layout = roomMeasurementLayouts.get(roomId);
						if (!layout) return null;
						return (
							<g
								aria-label={`Комната: ${sizeLabel}, ${formatAreaMm2(measurement.areaMm2)}, ${perimeterLabel}`}
								className={styles.roomMeasurement}
								data-room-id={roomId}
								data-testid="room-measurement"
								key={`measurement-${roomId}`}
							>
								{measurement.kind === "rectangular" ? (
									<rect
										className={styles.roomMeasurementFrame}
										height={end.y - start.y}
										width={end.x - start.x}
										x={start.x}
										y={start.y}
									/>
								) : null}
								{layout.kind === "outside" ? (
									<line
										className={styles.dimensionLine}
										x1={layout.leader.x1}
										x2={layout.leader.x2}
										y1={layout.leader.y1}
										y2={layout.leader.y2}
									/>
								) : null}
								<text
									className={styles.roomMeasurementSize}
									textAnchor="middle"
									x={layout.centerX}
									y={layout.centerY - 5}
								>
									{sizeLabel}
								</text>
								<text
									className={styles.roomMeasurementArea}
									textAnchor="middle"
									x={layout.centerX}
									y={layout.centerY + 11}
								>
									{formatAreaMm2(measurement.areaMm2)}
								</text>
								<text
									className={styles.roomMeasurementPerimeter}
									textAnchor="middle"
									x={layout.centerX}
									y={layout.centerY + 27}
								>
									{perimeterLabel}
								</text>
							</g>
						);
					})}
					{wallDraft
						? (() => {
								const start = pointFor(
									wallDraft.start.xMm,
									wallDraft.start.zMm,
								);
								const end = pointFor(wallDraft.end.xMm, wallDraft.end.zMm);
								const guide = wallDraftAlignmentGuide(
									wallDraft.start,
									wallDraft.rawEnd,
									wallDraft.end,
									{
										radiusMm: currentWallJoinRadiusMm(),
										vertices,
										wallSegments: wallDraftSegments,
									},
								);
								const guideFrom = guide
									? pointFor(guide.from.xMm, guide.from.zMm)
									: undefined;
								const guideTo = guide
									? pointFor(guide.to.xMm, guide.to.zMm)
									: undefined;
								return (
									<>
										{guideFrom && guideTo ? (
											<line
												className={styles.wallAlignmentGuide}
												data-testid="wall-alignment-guide"
												x1={guideFrom.x}
												x2={guideTo.x}
												y1={guideFrom.y}
												y2={guideTo.y}
											/>
										) : null}
										{guide ? (
											<circle
												className={styles.wallSnapCheckpoint}
												cx={end.x}
												cy={end.y}
												data-testid="wall-snap-checkpoint"
												pointerEvents="none"
												r={7 / viewport.zoom}
											/>
										) : null}
										<line
											className={styles.draftWall}
											data-testid="wall-draft"
											x1={start.x}
											x2={end.x}
											y1={start.y}
											y2={end.y}
										/>
									</>
								);
							})()
						: null}
					{wallMoveDraft
						? (() => {
								const axis = wallMoveAxisFor(wallMoveDraft.wallSegmentId);
								if (!axis || axis.kind !== wallMoveDraft.kind) return null;
								const [start, end] =
									wallMoveDraft.kind === "cardinal" && axis.kind === "cardinal"
										? axis.axis === "x"
											? [
													{ ...axis.start, xMm: wallMoveDraft.positionMm },
													{ ...axis.end, xMm: wallMoveDraft.positionMm },
												]
											: [
													{ ...axis.start, zMm: wallMoveDraft.positionMm },
													{ ...axis.end, zMm: wallMoveDraft.positionMm },
												]
										: wallMoveDraft.kind !== "cardinal"
											? [
													{
														...axis.start,
														xMm:
															axis.start.xMm + wallMoveDraft.translationMm.xMm,
														zMm:
															axis.start.zMm + wallMoveDraft.translationMm.zMm,
													},
													{
														...axis.end,
														xMm: axis.end.xMm + wallMoveDraft.translationMm.xMm,
														zMm: axis.end.zMm + wallMoveDraft.translationMm.zMm,
													},
												]
											: [axis.start, axis.end];
								const startPoint = pointFor(start.xMm, start.zMm);
								const endPoint = pointFor(end.xMm, end.zMm);
								return (
									<line
										className={styles.wallMovePreview}
										data-testid="wall-move-preview"
										pointerEvents="none"
										x1={startPoint.x}
										x2={endPoint.x}
										y1={startPoint.y}
										y2={endPoint.y}
									/>
								);
							})()
						: null}
					{wallVertexMoveDraft
						? project.level.wallSegments.flatMap((wall) => {
								if (
									wall.startVertexId !== wallVertexMoveDraft.vertexId &&
									wall.endVertexId !== wallVertexMoveDraft.vertexId
								) {
									return [];
								}
								const start = project.level.vertices.find(
									(vertex) => vertex.vertexId === wall.startVertexId,
								);
								const end = project.level.vertices.find(
									(vertex) => vertex.vertexId === wall.endVertexId,
								);
								if (!start || !end) return [];
								const renderedStart =
									start.vertexId === wallVertexMoveDraft.vertexId
										? wallVertexMoveDraft
										: start;
								const renderedEnd =
									end.vertexId === wallVertexMoveDraft.vertexId
										? wallVertexMoveDraft
										: end;
								const startPoint = pointFor(
									renderedStart.xMm,
									renderedStart.zMm,
								);
								const endPoint = pointFor(renderedEnd.xMm, renderedEnd.zMm);
								return [
									<line
										className={styles.wallMovePreview}
										data-testid="wall-vertex-move-preview"
										key={`vertex-preview-${wall.wallSegmentId}`}
										pointerEvents="none"
										x1={startPoint.x}
										x2={endPoint.x}
										y1={startPoint.y}
										y2={endPoint.y}
									/>,
								];
							})
						: null}
					{wallSplitDraft
						? (() => {
								const point = pointFor(
									wallSplitDraft.pointMm.xMm,
									wallSplitDraft.pointMm.zMm,
								);
								return (
									<>
										<circle
											className={styles.wallSplitPreview}
											cx={point.x}
											cy={point.y}
											data-testid="wall-split-preview"
											pointerEvents="none"
											r={9 / viewport.zoom}
										/>
										<circle
											data-testid="wall-split-handle"
											data-wall-split-handle={wallSplitDraft.wallSegmentId}
											cx={point.x}
											cy={point.y}
											r={24 / viewport.zoom}
											fill="transparent"
											pointerEvents={readOnly ? "none" : "all"}
											style={{ cursor: "grab" }}
										/>
									</>
								);
							})()
						: null}
				</g>
				<DrawingDimensions layouts={dimensionLayouts} />
				{wallDistances.length > 0 ? (
					<ItemWallDistanceLines
						distances={wallDistances}
						projectPoint={dimensionScreenPoint}
						bounds={wallDistanceBounds}
						obstacles={dimensionLayouts.flatMap((layout) => layout.kind === "placed" ? [layout.labelBounds] : [])}
					/>
				) : null}
			</svg>
			{wallDistances.length > 0 && !itemPlacementPreview ? (
				<div className={styles.itemWallDistancePanel} style={{ top: canvasInsets.top + 8 }}>
					<ItemWallDistanceValues distances={wallDistances} />
				</div>
			) : null}
			{activeTool === "item" && itemDraft ? (
				<aside
					aria-label="Размещение предмета"
					className={styles.itemPlacementDock}
					data-placement-tier={itemPlacementPreview?.tier}
					data-testid="item-placement-action-dock"
				>
					<span aria-hidden="true" className={styles.itemPlacementDockHandle} />
					{plainLabels ? (
						<SheetHeader
							title={<span data-testid="item-placement-identity">{itemDraft.label}</span>}
							closeLabel="Закрыть размещение предмета"
							closeDisabled={isConfirmingItemPlacement || hasPlacementRotationContact}
							onClose={onCloseItemPlacement ?? cancelItemPlacement}
							protectEditorDraft={onCloseItemPlacement !== undefined}
						/>
					) : <strong
						className={styles.itemPlacementIdentity}
						data-testid="item-placement-identity"
					>
						{itemDraft.label}
					</strong>}
					{itemPlacementControls}
					{showItemWallDistances && itemPlacementPreview ? (
						<ItemWallDistanceFields
							distances={wallDistances}
							disabled={readOnly || isConfirmingItemPlacement || hasPlacementRotationContact}
							onApply={applyPlacementDistance}
							skipBlurCommit={skipBlurCommit}
						/>
					) : null}
					{itemPlacementPreview &&
					(itemPlacementPreview.tier !== "valid" ||
						isConfirmingItemPlacement) ? (
						<p
							aria-live="polite"
							className={styles.itemPlacementFeedback}
							data-testid="item-placement-feedback"
							role="status"
						>
							{itemPlacementPreviewFeedback(itemPlacementPreview, {
								isPreparingResource: isConfirmingItemPlacement,
							})}
						</p>
					) : null}
					<div
						className={plainLabels ? rotationStyles.row : styles.placementRotationActions}
						data-rotation-target={plainLabels ? "placement" : undefined}
					>
						<button
							aria-label={exactFloorYaw ? "Повернуть размещаемый предмет влево на 1°" : "Повернуть размещаемый предмет влево на 45°"}
							className={plainLabels ? rotationStyles.step : undefined}
							disabled={
								readOnly ||
								isConfirmingItemPlacement ||
								hasPlacementRotationContact
							}
							onClick={() =>
								onItemPlacementYawChange(itemDraft.yawRadians + leftPlacementStepRadians)
							}
							type="button"
						>
							↶
						</button>
						{exactFloorYaw ? (
							<FloorRotationAngleField
								ariaLabel="Угол размещаемого предмета, градусы"
								className={plainLabels ? rotationStyles.angle : undefined}
								yawRadians={itemDraft.yawRadians}
								disabled={readOnly || isConfirmingItemPlacement || hasPlacementRotationContact}
								onApply={onItemPlacementYawChange}
								skipBlurCommit={skipBlurCommit}
							/>
						) : <output className={plainLabels ? rotationStyles.value : undefined} data-testid="item-placement-angle">
							{degreesForYawRadians(itemDraft.yawRadians)}°
						</output>}
						<button
							aria-label={exactFloorYaw ? "Повернуть размещаемый предмет вправо на 1°" : "Повернуть размещаемый предмет вправо на 45°"}
							className={plainLabels ? rotationStyles.step : undefined}
							disabled={
								readOnly ||
								isConfirmingItemPlacement ||
								hasPlacementRotationContact
							}
							onClick={() =>
								onItemPlacementYawChange(itemDraft.yawRadians - leftPlacementStepRadians)
							}
							type="button"
						>
							↷
						</button>
					</div>
					<div className={styles.itemPlacementDockActions}>
						<button data-editor-action="cancel"
							aria-label="Отменить размещение предмета"
							className={styles.itemPlacementCancel}
							data-testid="item-placement-cancel"
							onClick={cancelItemPlacement}
							type="button"
						>
							{plainLabels ? "Отменить" : "Отмена"}
						</button>
						<button data-editor-action="confirm"
							aria-disabled={
								!itemPlacementPreview?.isValid ||
								isConfirmingItemPlacement ||
								hasPlacementRotationContact
							}
							aria-label="Подтвердить размещение предмета"
							className={styles.itemPlacementConfirm}
							data-testid="item-placement-confirm"
							disabled={
								!itemPlacementPreview?.isValid ||
								isConfirmingItemPlacement ||
								hasPlacementRotationContact
							}
							onClick={confirmItemPlacement}
							type="button"
						>
							{isConfirmingItemPlacement ? "Сохраняем…" : plainLabels ? "Подтвердить" : "Поставить"}
						</button>
					</div>
				</aside>
			) : null}
			{retainedHostTransform ? <aside className={styles.wallMoveDraftActions} role="status" style={{ pointerEvents: "none" }}>
				{retainedHostTransform.kind === "move" ? "Продолжите перемещение или отмените правку." : "Продолжите поворот или отмените правку."}
			</aside> : null}
			{doorOpeningDrag && openingDragError ? (
				<aside
					className={styles.wallMoveDraftActions}
					role="status"
					aria-live="polite"
					data-testid="opening-move-feedback"
					data-invalid={openingDragError ? "true" : undefined}
				>
					{openingMoveErrorCopy(openingDragError)}
				</aside>
			) : null}
			<fieldset
				className={styles.planZoomControls}
				aria-label="Масштаб плана"
			>
				<button
					type="button"
					aria-label="Приблизить"
					disabled={viewport.zoom >= maximumViewportZoom}
					onClick={() =>
						setViewport((current) =>
							zoomEditorViewportAround(
								current,
								1.5,
								visibleCanvasCentre(),
								maximumViewportZoom,
							),
						)
					}
				>
					+
				</button>
				<button
					type="button"
					aria-label="Отдалить"
					disabled={viewport.zoom <= 0.55}
					onClick={() =>
						setViewport((current) =>
							zoomEditorViewportAround(
								current,
								1 / 1.5,
								visibleCanvasCentre(),
								maximumViewportZoom,
							),
						)
					}
				>
					−
				</button>
			</fieldset>
			{pendingDoorOpeningMove ? (
				<aside
					className={styles.wallMoveDraftActions}
					role="status"
					data-testid="door-opening-move-draft"
				>
					Сохраняем положение проёма…
				</aside>
			) : null}
			{wallMoveDraft?.phase === "ready" ? (
				<aside
					aria-live="polite"
					className={styles.wallMoveDraftActions}
					data-testid="wall-move-draft"
					role="status"
				>
					<strong>Черновик переноса стены</strong>
					<div>
						<button data-editor-action="confirm"
							disabled={isConfirmingWallMove}
							onClick={() => void confirmWallMoveDraft()}
							type="button"
						>
							{plainLabels ? "Подтвердить" : "Подтвердить перенос"}
						</button>
						<button data-editor-action="cancel"
							disabled={isConfirmingWallMove}
							onClick={cancelWallMoveDraft}
							type="button"
						>
							{plainLabels ? "Отменить" : "Отменить перенос"}
						</button>
					</div>
				</aside>
			) : null}
			{wallVertexMoveDraft?.phase === "ready" ? (
				<aside
					aria-live="polite"
					className={styles.wallMoveDraftActions}
					data-testid="wall-vertex-move-draft"
					role="status"
				>
					<strong>Черновик переноса вершины</strong>
					<div>
						<button data-editor-action="confirm"
							disabled={isConfirmingWallVertexMove}
							onClick={() => void confirmWallVertexMoveDraft()}
							type="button"
						>
							{plainLabels ? "Подтвердить" : "Подтвердить перенос вершины"}
						</button>
						<button data-editor-action="cancel"
							disabled={isConfirmingWallVertexMove}
							onClick={cancelWallVertexMoveDraft}
							type="button"
						>
							{plainLabels ? "Отменить" : "Отменить перенос вершины"}
						</button>
					</div>
				</aside>
			) : null}
			{wallSplitDraft && !wallSplitHostConflict ? (
				<aside
					aria-live="polite"
					className={styles.wallMoveDraftActions}
					data-testid="wall-split-draft"
					role="status"
				>
					<strong>Разделение стены</strong>
					{splitUnavailable ? (
						<span role="alert">Выберите точку внутри стены.</span>
					) : null}
					<div>
						<button data-editor-action="confirm"
							disabled={isConfirmingWallSplit || splitUnavailable}
							onClick={() => void confirmWallSplitDraft()}
							type="button"
						>
							{plainLabels ? "Подтвердить" : "Подтвердить разделение"}
						</button>
						<button data-editor-action="cancel"
							disabled={isConfirmingWallSplit}
							onClick={cancelWallSplitDraft}
							type="button"
						>
							{plainLabels ? "Отменить" : "Отменить разделение"}
						</button>
					</div>
				</aside>
			) : null}
			{wallSplitHostConflict ? (
				<aside
					aria-live="polite"
					className={styles.wallMoveDraftActions}
					data-testid="wall-split-host-conflict"
					role="alert"
				>
					<strong>Разрез затрагивает размещённые данные</strong>
					{wallSplitHostConflict.openingIds.length > 0 ? (
						<span>
							{wallSplitHostConflict.openingIds.length}{" "}
							{wallSplitHostConflict.openingIds.length === 1
								? "проём"
								: "проёма"}{" "}
							попадёт в разрез и не сможет сохранить один адрес стены.
						</span>
					) : null}
					{wallSplitHostConflict.itemIds.length > 0 ? (
						<>
							<span>
								{wallSplitHostConflict.itemIds.length}{" "}
								{wallSplitHostConflict.itemIds.length === 1
									? "настенный предмет"
									: "настенных предмета"}{" "}
								попадёт в разрез и не сможет сохранить один адрес стены.
							</span>
							<ul data-testid="wall-split-conflicting-items">
								{wallSplitHostConflict.itemIds.map((assetInstanceId) => {
									const item = project.assetInstances.find(
										(candidate) =>
											candidate.assetInstanceId === assetInstanceId,
									);
									return (
										<li key={assetInstanceId}>
											{item?.label ?? "Настенный предмет"}{" "}
											<code>{assetInstanceId}</code>
										</li>
									);
								})}
							</ul>
						</>
					) : null}
					<div>
						<button data-editor-action="confirm"
							disabled={isResolvingWallSplitHostConflict}
							onClick={() => void resolveWallSplitHostConflict()}
							type="button"
						>
							{plainLabels ? "Подтвердить" : <>
							Разделить стену и удалить{" "}
							{wallSplitHostConflict.openingIds.length > 0 ? (
								<>
									{wallSplitHostConflict.openingIds.length}{" "}
									{wallSplitHostConflict.openingIds.length === 1
										? "проём"
										: "проёма"}
								</>
							) : null}
							{wallSplitHostConflict.openingIds.length > 0 &&
							wallSplitHostConflict.itemIds.length > 0
								? " и "
								: null}
							{wallSplitHostConflict.itemIds.length > 0 ? (
								<>
									{wallSplitHostConflict.itemIds.length}{" "}
									{wallSplitHostConflict.itemIds.length === 1
										? "настенный предмет"
										: "настенных предмета"}
								</>
							) : null}
							</>}
						</button>
						<button data-editor-action="cancel"
							disabled={isResolvingWallSplitHostConflict}
							onClick={cancelWallSplitDraft}
							type="button"
						>
							{plainLabels ? "Отменить" : "Отмена"}
						</button>
					</div>
				</aside>
			) : null}
			{wallDraft?.phase === "ready" ? (
				<aside
					aria-live="polite"
					className={styles.wallDraftActions}
					data-testid="wall-draft-actions"
					role="status"
				>
					<strong>
						Стена:{" "}
						{formatLengthMm(
							Math.hypot(
								wallDraft.end.xMm - wallDraft.start.xMm,
								wallDraft.end.zMm - wallDraft.start.zMm,
							),
						)}
					</strong>
					<span>{wallDraftDirectionCopy(wallDraft.direction)}</span>
					{!wallDraftIsConfirmable ? (
						<span data-testid="wall-draft-error">
							Стена должна быть длиннее своей толщины.
						</span>
					) : null}
					<div>
						<button data-editor-action="confirm"
							disabled={!wallDraftIsConfirmable}
							onClick={() => void confirmWallDraft()}
							type="button"
						>
							{isConfirmingWallDraft ? "Добавляем стену…" : plainLabels ? "Подтвердить" : "Подтвердить стену"}
						</button>
						<button data-editor-action="cancel"
							disabled={isConfirmingWallDraft}
							onClick={clearWallDraft}
							type="button"
						>
							{plainLabels ? "Отменить" : "Отменить стену"}
						</button>
					</div>
				</aside>
			) : null}
		</>
	);
}
