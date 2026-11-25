import { copy } from "./editor-language";
import type { ReactNode } from "react";
import type { RegisterEditorTransientBoundary } from "./editor-host-boundary";
import type { DrawingDimensionVisibility } from "./drawing-dimension-visibility";
import type { AddWallSegmentInput } from "../domain/add-wall-segment";
import { PLAN_GRID_STEP_MM } from "../domain/constrained-partition";
import { resolveOrthogonalPlanFaces } from "../domain/derived-orthogonal-plan-faces";
import { resolveProjectV2Plan } from "../domain/derived-project-v2-plan";
import type {
	MoveGeneralWallInput,
	SplitGeneralWallHostResolutionInput,
	SplitGeneralWallInput,
} from "../domain/general-wall-project";
import type { UninterruptedWallRun } from "../domain/wall-runs";
import {
	type ParametricFloorItemPlacementWarning,
	yawRadiansFor,
} from "../domain/parametric-item";
import type { ParametricWallItemPlacementWarning } from "../domain/parametric-wall-item";
import type { Project, Vertex } from "../domain/project";
import type { ProjectV2 } from "../domain/project-v2";
import type { EditorViewport } from "./editor-viewport";
import type { FloorItemWallSnap } from "./floor-item-wall-snap";
import type { WallDraftDirection, WallDraftPoint } from "./wall-draft";

/** Pure Plan presentation policies and shared editor contracts; no controller or AppShell dependency. */

export type EditorTool = "select" | "wall" | "item";

export type EditorProject = Project | ProjectV2;

export type EditorFloorAsset =
	| Extract<
			Project["assetInstances"][number],
			{ readonly anchorClass: "floor" }
	  >
	| ProjectV2["assetInstances"][number];

/** A draft belongs to one exact durable snapshot and cannot cross its revision boundary. */
export function hasProjectRevisionChanged(
	previous: EditorProject,
	next: EditorProject,
): boolean {
	return previous !== next;
}

export function isFloorEditorAsset(
	asset: EditorProject["assetInstances"][number],
): asset is EditorFloorAsset {
	return asset.anchorClass === "floor";
}

export function yawRadiansForEditorFloorAsset(item: EditorFloorAsset): number {
	return yawRadiansFor({
		yawMilliDeg: "yawMilliDeg" in item ? item.yawMilliDeg : undefined,
		yawRadians:
			"yawRadians" in item && typeof item.yawRadians === "number"
				? item.yawRadians
				: undefined,
		yawStep:
			"yawStep" in item && typeof item.yawStep === "number"
				? item.yawStep
				: undefined,
	});
}

export function derivedPlanFor(project: EditorProject) {
	return project.schemaVersion === 2
		? resolveProjectV2Plan(project)
		: resolveOrthogonalPlanFaces(project);
}

export function wallDraftDirectionCopy(
	direction: WallDraftDirection | undefined,
): string {
	switch (direction) {
		case "E":
		case "W":
			return copy("Направление: горизонтально", "Direction: horizontal");
		case "N":
		case "S":
			return copy("Направление: вертикально", "Direction: vertical");
		case "NE":
		case "NW":
		case "SE":
		case "SW":
			return copy("Направление: диагональ 45°", "Direction: 45° diagonal");
		default:
			return copy("Направление: уточняется", "Direction: pending");
	}
}

/** The preview must explain its state before a placement becomes durable. */
export function itemPlacementWarningSummary(
	warnings: readonly (
		| ParametricFloorItemPlacementWarning
		| ParametricWallItemPlacementWarning
	)[],
): string {
	return [
		...new Set(
			warnings.map((warning) =>
				warning.kind === "item"
					? copy("пересечение с другим предметом", "overlap with another item")
					: warning.kind === "wall-item"
						? copy(
								"пересечение с другим настенным предметом",
								"overlap with another wall-mounted item",
							)
						: copy(
								"перекрытие зоны открывания двери",
								"overlap with the door swing area",
							),
			),
		),
	].join("; ");
}

export function itemPlacementPreviewFeedback(
	preview: {
		readonly isValid: boolean;
		readonly reasonCode?: string;
		readonly warnings?: readonly ParametricFloorItemPlacementWarning[];
	},
	options?: { readonly isPreparingResource?: boolean },
): string {
	if (options?.isPreparingResource) {
		return copy("Подготавливаем модель…", "Preparing model…");
	}
	if (preview.warnings && preview.warnings.length > 0) {
		return copy(
			`Предупреждение: ${itemPlacementWarningSummary(preview.warnings)}.`,
			`Warning: ${itemPlacementWarningSummary(preview.warnings)}.`,
		);
	}
	if (preview.isValid) {
		return "";
	}
	switch (preview.reasonCode) {
		case "ITEM_COLLISION":
			return copy(
				"Предмет пересекается с другим предметом. Выберите другое место.",
				"The item overlaps another item. Choose a different location.",
			);
		case "WALL_ITEM_COLLISION":
			return copy(
				"Предпросмотр пересекает стену.",
				"The preview intersects a wall.",
			);
		case "OUTSIDE_ROOM_HOST":
			return copy(
				"Предпросмотр выходит за границы комнаты.",
				"The preview extends outside the room.",
			);
		default:
			return copy(
				"Это размещение пока недоступно.",
				"This placement is unavailable.",
			);
	}
}

export function snappedPoint(point: {
	readonly xMm: number;
	readonly zMm: number;
}) {
	return {
		xMm: Math.round(point.xMm / PLAN_GRID_STEP_MM) * PLAN_GRID_STEP_MM,
		zMm: Math.round(point.zMm / PLAN_GRID_STEP_MM) * PLAN_GRID_STEP_MM,
	};
}

export function gridLinesBetween(
	minimumMm: number,
	maximumMm: number,
	stepMm: number,
	phaseMm = 0,
): readonly number[] {
	const first = Math.ceil((minimumMm - phaseMm) / stepMm) * stepMm + phaseMm;
	const lines: number[] = [];
	for (let line = first; line <= maximumMm; line += stepMm) {
		lines.push(line);
	}
	return lines;
}

/** A filled hit region stays accessible to touch and browser automation for zero-width SVG lines. */
export function wallHitPath(
	start: { readonly x: number; readonly y: number },
	end: { readonly x: number; readonly y: number },
	targetWidth: number,
): string {
	const length = Math.hypot(end.x - start.x, end.y - start.y);
	if (
		!Number.isFinite(length) ||
		length <= 0 ||
		!Number.isFinite(targetWidth) ||
		targetWidth <= 0
	) {
		return "";
	}
	const offsetX = (-(end.y - start.y) * targetWidth) / (length * 2);
	const offsetY = ((end.x - start.x) * targetWidth) / (length * 2);
	const extension = Math.max(0, (targetWidth - length) / 2);
	const extendX = ((end.x - start.x) * extension) / length;
	const extendY = ((end.y - start.y) * extension) / length;
	return [
		`M ${start.x - extendX + offsetX} ${start.y - extendY + offsetY}`,
		`L ${end.x + extendX + offsetX} ${end.y + extendY + offsetY}`,
		`L ${end.x + extendX - offsetX} ${end.y + extendY - offsetY}`,
		`L ${start.x - extendX - offsetX} ${start.y - extendY - offsetY}`,
		"Z",
	].join(" ");
}

/** Overlapping touch regions select the closest real segment, preserving the hit on exact ties. */
export function nearestWallAtPoint(
	point: { readonly x: number; readonly y: number },
	walls: readonly {
		readonly wallSegmentId: string;
		readonly start: { readonly x: number; readonly y: number };
		readonly end: { readonly x: number; readonly y: number };
		readonly targetWidth: number;
	}[],
	preferredWallId?: string,
): string | undefined {
	if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
	return walls.reduce<{ readonly id: string; readonly distanceSquared: number } | undefined>((nearest, wall) => {
		const dx = wall.end.x - wall.start.x;
		const dy = wall.end.y - wall.start.y;
		const length = Math.hypot(dx, dy);
		if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(wall.targetWidth) || wall.targetWidth <= 0) return nearest;
		const along = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / length;
		const perpendicular = ((point.y - wall.start.y) * dx - (point.x - wall.start.x) * dy) / length;
		const extension = Math.max(0, (wall.targetWidth - length) / 2);
		if (along < -extension || along > length + extension || Math.abs(perpendicular) > wall.targetWidth / 2) return nearest;
		const distanceSquared = (along - Math.max(0, Math.min(length, along))) ** 2 + perpendicular ** 2;
		return !nearest || distanceSquared < nearest.distanceSquared || (distanceSquared === nearest.distanceSquared && wall.wallSegmentId === preferredWallId)
			? { id: wall.wallSegmentId, distanceSquared }
			: nearest;
	}, undefined)?.id;
}

export function visualGridStepMm(): number {
	return PLAN_GRID_STEP_MM;
}

export interface PlanProjectionProps {
	readonly plainLabels?: boolean;
	/** Built-in models whose visible front faces local -Z in the 3D scene. */
	readonly reversedItemFrontIds?: ReadonlySet<string>;
	readonly exactFloorYaw?: boolean;
	readonly rotationStepMode?: boolean;
	readonly onRotationStepModeChange?: (checked: boolean) => void;
	readonly rotationInspectorState?: import("./plan-rotation-layout").PlanRotationInspectorState;
	readonly selectedWallRun?: UninterruptedWallRun;
	readonly initialItemPlacementPoint?: ItemPlacementPoint;
	readonly onItemPlacementPointChange?: (point: ItemPlacementPoint | undefined) => void;
	readonly skipBlurCommit?: (target: HTMLInputElement) => boolean;
	readonly keyboardItemMovement?: boolean;
	readonly showOpeningTemplates?: boolean;
	readonly showItemWallDistances?: boolean;
	readonly focusedWallDistance?: import("./item-wall-distances").ItemWallDistance["side"];
	readonly floorItemWallSnap?: FloorItemWallSnap;
	readonly itemPlacementControls?: ReactNode;
	readonly registerTransientBoundary?: RegisterEditorTransientBoundary;
	readonly dimensionVisibility: DrawingDimensionVisibility;
	readonly openingMoveErrorCopy: (reasonCode: string) => string;
	readonly activeTool: EditorTool;
	readonly isInteractionLocked: boolean;
	readonly isWallMoveMode: boolean;
	readonly isWallSplitMode: boolean;
	readonly isWallVertexMoveMode: boolean;
	readonly movableWallVertexIds: readonly string[];
	readonly openingMovePreview?: {
		readonly swingSide?: "left" | "right";
		readonly hingeEnd?: "end" | null;
		readonly openingId: string;
		readonly offsetMm: number;
	};
	readonly openingCreationPreview:
		| {
				readonly kind?: "Door" | "Window";
				readonly swingSide?: "left" | "right";
				readonly hingeEnd?: "end" | null;
				readonly offsetMm: number;
				readonly wallSegmentId: string;
				readonly widthMm: number;
		  }
		| undefined;
	readonly onMoveOpeningCreationDraft?: (offsetMm: number) => void;
	readonly openingHostIds?: ReadonlySet<string>;
	readonly onChooseOpeningHost?: (wallSegmentId: string, offsetMm: number) => void;
	readonly onItemPlacementYawChange: (yawRadians: number) => void;
	readonly itemDraft:
		| {
				readonly color: string;
				readonly yawRadians: number;
				readonly depthMm: number;
				readonly heightMm: number;
				readonly label: string;
				readonly widthMm: number;
		  }
		| undefined;
	readonly readOnly: boolean;
	readonly onCancelItemPlacement: () => void;
	readonly onCloseItemPlacement?: () => void;
	readonly onDrawWall: (input: AddWallSegmentInput) => Promise<boolean>;
	readonly onDrawingVisibilityChange: (isVisible: boolean) => void;
	readonly onOpeningMoveStart?: () => void;
	readonly onSelectOpening?: (openingId: string) => void;
	readonly onClearSelection?: () => void;
	readonly onMoveDoorOpening: (input: {
		readonly openingId: string;
		readonly offsetMm: number;
	}) => Promise<boolean>;
	readonly onMoveItem: (input: {
		readonly assetInstanceId: string;
		readonly xMm: number;
		readonly zMm: number;
	}) => Promise<boolean>;
	readonly onMoveWall: (input: MoveGeneralWallInput) => Promise<boolean>;
	readonly onMoveWallVertex: (input: {
		readonly vertexId: string;
		readonly xMm: number;
		readonly zMm: number;
	}) => Promise<boolean>;
	readonly onPwaUpdateSafetyChange: (hasTransientEdit: boolean) => void;
	readonly onResolveSplitHostConflict: (
		input: SplitGeneralWallHostResolutionInput & {
			readonly previewRevisionId: string;
		},
	) => Promise<WallSplitHostConflictResolutionResult>;
	readonly onSplitWall: (
		input: SplitGeneralWallInput,
	) => Promise<WallSplitPublishResult>;
	readonly onRotateItem: (input: {
		readonly assetInstanceId: string;
		readonly yawRadians: number;
	}) => Promise<boolean>;
	readonly onPlaceItem: (point: {
		readonly xMm: number;
		readonly zMm: number;
	}) => Promise<void> | void;
	readonly onSelectItem: (assetInstanceId: string) => void;
	readonly onSelectWall: (wallSegmentId: string) => void;
	readonly onWallMoveModeChange: (isActive: boolean) => void;
	readonly onWallSplitModeChange: (isActive: boolean) => void;
	readonly onWallVertexMoveModeChange: (isActive: boolean) => void;
	readonly project: EditorProject;
	readonly selectedItemId: string | undefined;
	readonly selectedOpeningId?: string;
	readonly selectedWallId: string | undefined;
	readonly wallThicknessMm: number | undefined;
	readonly viewport: EditorViewport;
	readonly setViewport: (
		next: (previous: EditorViewport) => EditorViewport,
	) => void;
}

export interface PointerPosition {
	readonly x: number;
	readonly y: number;
}

export interface WallDraft {
	readonly gestureStart?: { readonly xMm: number; readonly zMm: number };
	readonly direction?: WallDraftDirection;
	readonly end: { readonly xMm: number; readonly zMm: number };
	readonly phase: "drawing" | "ready";
	readonly rawEnd: { readonly xMm: number; readonly zMm: number };
	readonly pointerOrigin: PointerPosition;
	readonly pointerId: number | undefined;
	readonly start: { readonly xMm: number; readonly zMm: number };
}

export type WallMoveDraft =
	| {
			readonly kind: "cardinal";
			readonly originalPositionMm: number;
			readonly phase: "dragging" | "ready";
			readonly pointerId: number | undefined;
			readonly pointerOrigin: PointerPosition;
			readonly positionMm: number;
			readonly wallSegmentId: string;
			readonly wallRunSegmentIds?: readonly string[];
	  }
	| {
			readonly kind: "diagonal-falling" | "diagonal-rising";
			readonly originalPointerPoint: WallDraftPoint;
			readonly phase: "dragging" | "ready";
			readonly pointerId: number | undefined;
			readonly pointerOrigin: PointerPosition;
			readonly translationMm: { readonly xMm: number; readonly zMm: number };
			readonly wallSegmentId: string;
			readonly wallRunSegmentIds?: readonly string[];
	  };

export type WallMoveAxis =
	| {
			readonly axis: "x" | "z";
			readonly end: Vertex;
			readonly kind: "cardinal";
			readonly positionMm: number;
			readonly start: Vertex;
	  }
	| {
			readonly end: Vertex;
			readonly kind: "diagonal-falling" | "diagonal-rising";
			readonly start: Vertex;
	  };

export interface WallVertexMoveDraft {
	readonly original: WallDraftPoint;
	readonly phase: "dragging" | "ready";
	readonly pointerId: number | undefined;
	readonly pointerOrigin: PointerPosition;
	readonly vertexId: string;
	readonly xMm: number;
	readonly zMm: number;
}

export interface WallSplitDraft {
	readonly pointMm: WallDraftPoint;
	readonly wallSegmentId: string;
}

export type WallSplitPublishResult =
	| { readonly kind: "durable" }
	| {
			readonly itemIds: readonly string[];
			readonly kind: "host-conflict";
			readonly openingIds: readonly string[];
			readonly previewRevisionId: string;
	  }
	| { readonly kind: "rejected" };

export type WallSplitHostConflictResolutionResult =
	| "durable"
	| "rejected"
	| "stale-base";

export interface OpeningDrag {
	readonly originalOffsetMm: number;
	readonly pointerStart: WallDraftPoint;
	readonly pointerOrigin: PointerPosition;
	readonly base: EditorProject;
	readonly openingId?: string;
	readonly pointerId: number;
	readonly wallSegmentId: string;
	readonly offsetMm: number;
}

export type ItemPlacementPoint = { readonly xMm: number; readonly zMm: number };

export interface ItemPlacementDrag {
	readonly pointerId: number;
	readonly before: ItemPlacementPoint | undefined;
	readonly beforeExact: boolean;
}

export const initialPlanCanvasSize = {
	canvasHeight: 370,
	canvasWidth: 440,
} as const;

const MINIMUM_VISIBLE_PLAN_SPAN_MM = 4000;

const EMPTY_PLAN_HALF_SPAN_MM = 3000;

const EXTERIOR_DRAW_MARGIN_MM = 0;

export function distance(
	first: PointerPosition,
	second: PointerPosition,
): number {
	return Math.hypot(first.x - second.x, first.y - second.y);
}

export function centre(
	first: PointerPosition,
	second: PointerPosition,
): PointerPosition {
	return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function visiblePlanFrame(
	vertices: readonly { readonly xMm: number; readonly zMm: number }[],
	padEditableCanvas: boolean,
) {
	if (vertices.length === 0) {
		return {
			maxX: EMPTY_PLAN_HALF_SPAN_MM,
			maxZ: EMPTY_PLAN_HALF_SPAN_MM,
			minX: -EMPTY_PLAN_HALF_SPAN_MM,
			minZ: -EMPTY_PLAN_HALF_SPAN_MM,
		};
	}
	const rawMinX = Math.min(...vertices.map((vertex) => vertex.xMm));
	const rawMaxX = Math.max(...vertices.map((vertex) => vertex.xMm));
	const rawMinZ = Math.min(...vertices.map((vertex) => vertex.zMm));
	const rawMaxZ = Math.max(...vertices.map((vertex) => vertex.zMm));
	if (!padEditableCanvas) {
		return { maxX: rawMaxX, maxZ: rawMaxZ, minX: rawMinX, minZ: rawMinZ };
	}
	const width = Math.max(
		rawMaxX - rawMinX + EXTERIOR_DRAW_MARGIN_MM * 2,
		MINIMUM_VISIBLE_PLAN_SPAN_MM,
	);
	const depth = Math.max(
		rawMaxZ - rawMinZ + EXTERIOR_DRAW_MARGIN_MM * 2,
		MINIMUM_VISIBLE_PLAN_SPAN_MM,
	);
	const centerX = (rawMinX + rawMaxX) / 2;
	const centerZ = (rawMinZ + rawMaxZ) / 2;
	return {
		maxX: centerX + width / 2,
		maxZ: centerZ + depth / 2,
		minX: centerX - width / 2,
		minZ: centerZ - depth / 2,
	};
}
