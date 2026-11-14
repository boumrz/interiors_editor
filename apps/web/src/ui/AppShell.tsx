import type { ReleaseRecoveryRecord } from "../app/release-startup";
import { LegacyStartupRecoveryNotice } from "./legacy-startup-recovery";
import type { EditorNavigationProtection } from "./editor-host-boundary";
import {
	type FormEvent,
 type ReactNode,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { projectRectangularRoomForWebGl } from "../adapters/renderer/rectangular-room-projection";
import { browserRandomUuid } from "../app/browser-ports";
import type {
	ProjectController,
	ProjectScreenState,
} from "../app/project-controller";
import {
	type CatalogGatewayPort,
	type ProjectSourceRecoveryPort,
	type ProjectStorageNamespace,
	type VersionedCatalogPublication,
	WRITER_LEASE_HEARTBEAT_MS,
} from "../application/ports";
import type {
	PersistentStorageRequest,
	StoragePressure,
} from "../application/storage-pressure";
import type { ImportPortableBackupStatus } from "../application/import-portable-backup";
import type { AddWallSegmentInput } from "../domain/add-wall-segment";
import { wallOpeningHostsForProject } from "../domain/door-opening-project";
import {
	type AddGeneralWallHostResolutionInput,
	type GeneralWallProjectMutationAffectedReference,
	isGeneralVertexDeletionEligible,
	type MoveGeneralWallInput,
	previewWallAddHostConflict,
	previewWallDeletionConflict,
	previewWallSplitHostConflict,
	type SplitGeneralWallHostResolutionInput,
	type SplitGeneralWallInput,
} from "../domain/general-wall-project";
import {
	alphaParametricItemColorVariants,
	type ItemColorVariantId,
} from "../domain/item-color-variant";
import { formatAreaMm2, formatLengthMm } from "../domain/measurement-format";
import {
	alphaParametricItemColors,
	assessParametricFloorItemPlacement,
	findRoomForFloorItem,
	rotationStepForYawRadians,
	yawRadiansFor,
} from "../domain/parametric-item";
import {
	assessParametricWallItemPlacement,
	type ParametricWallItemInput,
	type ParametricWallItemPlacementWarning,
} from "../domain/parametric-wall-item";
import type {
	CatalogVersionAssetOrigin,
	CustomGlbAssetDefinition,
	Project,
	Room,
	RoomType,
	WallOpening,
} from "../domain/project";
import type { ProjectV2 } from "../domain/project-v2";
import {
	deriveRectangularRoomMetrics,
	type RectangularRoomMetrics,
} from "../domain/rectangular-room";
import { preflightStaticGlbImport } from "../domain/static-glb-import";
import { projectDirectoryEmptyLabel, projectDirectoryCards, ProjectStorageStatus } from "./project-storage-presentation";
import { readBoundedLocalGlbFiles } from "./bounded-local-glb-files";
import { StoredSourceRecovery, prepareUnverifiedSourceFile } from "./stored-source-recovery";
import { loadLocalGlbResource } from "./local-glb-resource";
import { LocalFileTransferPanel, LocalFileTransferSession, type LocalFileTransferPort, type LocalFileTransferState } from "./local-file-transfer";
import {
	previewRoomHeightOpeningConflict,
	type RoomHeightOpeningResolution,
	roomTypes,
	type UpdateRoomPropertiesInput,
} from "../domain/update-room-properties";
import { MINIMUM_RESIDENTIAL_DOORWAY_WIDTH_MM } from "../domain/wall-opening";
import styles from "./AppShell.module.css";
import {
	CustomGlbPreview,
	type MeasuredCustomGlbDimensions,
} from "./CustomGlbPreview";
import type { CustomGlbResource } from "./custom-glb-runtime-cache";
import { DimensionFilter } from "./DimensionFilter";
import {
	DRAWING_DIMENSION_PREFERENCES_KEY,
	type DrawingDimensionVisibility,
	type DrawingDimensionPreferencesPort,
	defaultDrawingDimensionVisibility,
	loadDrawingDimensionPreferences,
	saveDrawingDimensionPreferences,
} from "./drawing-dimension-visibility";
import { projectHubChromeReset } from "./editor-chrome-state";
import {
	derivedPlanFor,
	type EditorFloorAsset,
	type EditorProject,
	type EditorTool,
	isFloorEditorAsset,
	itemPlacementWarningSummary,
	type WallSplitHostConflictResolutionResult,
	type WallSplitPublishResult,
	yawRadiansForEditorFloorAsset,
} from "./editor-plan-presentation";
import { type EditorViewport, initialEditorViewport } from "./editor-viewport";
import inspectorStyles from "./InspectorPanels.module.css";
import { itemCountCopy } from "./item-count-copy";
import { openingCreationDialogKeyAction } from "./opening-creation-dialog";
import {
	type OpeningCreationDraft,
	openingCreationDraftFor,
	openingCreationHostFor,
	validateOpeningCreationDraft,
} from "./opening-creation-draft";
import { PlanProjection } from "./PlanProjection";
import type { HostLifecyclePort, HostNavigationPort, EditorTransientBoundary } from "./editor-host-boundary";
import { editorBackDecision } from "./editor-back-policy";
import { EditorLeaveGuard, captureEditorFocus, type EditorFocusSnapshot } from "./EditorLeaveGuard";
import { ProjectConfirmationDialog } from "./ProjectConfirmationDialog";
import safetyStyles from "./ProjectSafety.module.css";
import {
	type CatalogSection,
	catalogAssetsFromPublication,
	catalogSections,
	filterPreloadedGlbCatalogAssets,
	preloadedGlbCatalogAssets as localPreloadedGlbCatalogAssets,
	type PreloadedGlbCatalogAsset,
} from "./preloaded-glb-catalog";
import {
	fetchPreloadedGlbBytes,
	type PreloadedGlbDownloadProgress,
} from "./preloaded-glb-resource";
import { projectDeletionTargetText } from "./project-deletion-copy";
import { RenameProjectDialog } from "./RenameProjectDialog";
import { ResourceRepairControls } from "./ResourceRepairControls";
import { RoomScene3d } from "./RoomScene3d";
import { roomTypeLabels } from "./room-type-labels";
import { moveDoorOpeningInProject } from "../domain/door-opening-project";
import { degreesForYawRadians, yawRadiansFromDegrees } from "./rotation-angle";
import { SaveFailureNotice } from "./SaveFailureNotice";
import {
	isWallMoveGestureSupported,
	wallVertexMoveAxisFor,
} from "./wall-vertex-move";

export {
	hasProjectRevisionChanged,
	itemPlacementPreviewFeedback,
	itemPlacementWarningSummary,
} from "./editor-plan-presentation";

import "./global.css";
export interface PwaUpdate {
	readonly activate: () => void;
	readonly isReloadReady: boolean;
	readonly isWaiting: boolean;
	readonly reload: () => void;
}

export type PwaBrowseCacheCleanupResult =
	| { readonly kind: "cleared" }
	| { readonly kind: "unavailable" };

export interface PwaBrowseCache {
	readonly clear: () => Promise<PwaBrowseCacheCleanupResult>;
}

export type PwaInstallPromptOutcome = "accepted" | "dismissed" | "unavailable";

export interface PwaInstall {
	readonly canUseIosShareInstall: boolean;
	readonly isStandalone: boolean;
	readonly promptInstall?: () => Promise<PwaInstallPromptOutcome>;
}

interface AppShellProps {
 readonly diagnosticDetails?: ReactNode;
 readonly readonlyDetails?:ReactNode;
 readonly readonlyRecoveryDetails?:ReactNode;
 readonly readonlyStorageSources?:readonly ProjectStorageNamespace[];
	readonly requestedRenameProjectId?: string;
 readonly editorStorageNamespace?: ProjectStorageNamespace;
 readonly canCreateLegacyProject?: () => boolean;
 readonly getLegacyStartupRecovery?: () => ReleaseRecoveryRecord | undefined;
	readonly hostNavigation?: HostNavigationPort;
 readonly navigationProtection?: EditorNavigationProtection;
	readonly hostLifecycle?: HostLifecyclePort;
	readonly registeredTransferImport?: boolean;
	readonly registeredTransferExport?: boolean;
	readonly fileTransfer?: LocalFileTransferPort;
	readonly sourceRecovery?: ProjectSourceRecoveryPort;
	readonly catalogGateway?: CatalogGatewayPort;
	readonly controller: ProjectController;
	readonly drawingDimensionPreferences?: DrawingDimensionPreferencesPort;
	readonly pwaBrowseCache?: PwaBrowseCache;
	readonly pwaInstall?: PwaInstall;
	readonly pwaUpdate?: PwaUpdate;
}

interface DimensionFields {
	readonly widthMm: string;
	readonly depthMm: string;
	readonly heightMm: string;
}

interface OpeningDraftFields {
	readonly baseRevisionId: string;
	readonly isMove?: boolean;
	readonly heightMm: string;
	readonly kind: "Door" | "Window";
	readonly offsetMm: string;
	readonly openingId: string;
	readonly sillMm: string;
	readonly widthMm: string;
}

interface WallDeletionConflict {
	readonly itemIds: readonly string[];
	readonly openingIds: readonly string[];
	readonly previewRevisionId: string;
	readonly requiresResolution: boolean;
	readonly retainedRoomIdByTargetFaceKey: Readonly<
		Record<string, string | undefined>
	>;
	readonly roomMetadataConflicts: readonly {
		readonly retainedRoomIds: readonly string[];
		readonly targetFaceKey: string;
	}[];
	readonly roomIds: readonly string[];
	readonly wallSegmentId: string;
}

interface VertexDeletionCandidate {
	readonly previewRevisionId: string;
	readonly vertexId: string;
}

interface WallAddHostConflict {
	readonly input: AddWallSegmentInput;
	readonly itemIds: readonly string[];
	readonly openingIds: readonly string[];
}

type WallMutationCorrection =
	| {
			readonly assetInstanceId: string;
			readonly kind: "floor-item";
			readonly message: string;
	  }
	| {
			readonly kind: "opening";
			readonly message: string;
			readonly opening: WallOpening;
	  };

interface ItemFields {
	readonly color: string;
	readonly depthMm: string;
	readonly heightMm: string;
	readonly label: string;
	readonly widthMm: string;
}

interface ItemColorVariantDraft {
	readonly anchorClass: "floor" | "wall";
	readonly assetInstanceId: string;
	readonly variantId: ItemColorVariantId;
}

interface RoomPropertyFields {
	readonly heightMm: string;
	readonly name: string;
	readonly type: RoomType;
}

interface RoomHeightOpeningConflict {
	readonly input: UpdateRoomPropertiesInput;
	readonly openingIds: readonly string[];
	readonly resolutions: Readonly<
		Record<string, "delete" | "resize" | undefined>
	>;
}

interface WallItemPositionFields {
	readonly elevationMm: string;
	readonly offsetMm: string;
}

/**
 * Unlike a durable wall item, its composer fields deliberately keep the user's
 * raw text. This permits editing a value through an empty intermediate state
 * without accidentally publishing an invalid wall-local address.
 */
interface WallItemDraftFields extends ItemFields {
	readonly elevationMm: string;
	readonly offsetMm: string;
}

type ViewMode = "plan" | "three-dimensional";

type FbxConversionUiState =
	| { readonly kind: "idle" }
	| { readonly filename: string; readonly kind: "converting" }
	| { readonly kind: "rejected"; readonly reasonCode: string };

type ProjectTransferImportUiState =
	| { readonly kind: "idle" }
	| {
			readonly filename: string;
			readonly kind:
				| "checking-render"
				| "cancelling"
				| "reading"
				| "saving"
				| "validating";
	  }
	| {
			readonly completed: number;
			readonly filename: string;
			readonly kind: "staging-resources";
			readonly total: number;
	  };

type CustomGlbImportUiState =
	| { readonly kind: "idle" }
	| { readonly filename: string; readonly kind: "checking" }
	| {
			readonly assetDefinitionId: string;
			readonly bytes: Uint8Array;
			readonly displayName: string;
			readonly dimensions: DimensionFields;
			readonly filename: string;
			readonly kind: "ready";
			readonly resourceHash: string;
			readonly source: "fbx" | "glb";
			readonly textureCount: number;
	  }
	| { readonly kind: "rejected"; readonly reasonCode: string };

type CustomGlbPlacementDraft = Extract<
	CustomGlbImportUiState,
	{ readonly kind: "ready" }
> & {
	readonly catalogOrigin?: CatalogVersionAssetOrigin;
	readonly reusesExistingDefinition?: true;
};

type CustomGlbLibraryResourceState = "loading" | "ready" | "unavailable";

type CustomCatalogAsset =
	| {
			readonly definition: CustomGlbAssetDefinition;
			readonly resource: CustomGlbResource;
			readonly resourceState: "ready";
	  }
	| {
			readonly definition: CustomGlbAssetDefinition;
			readonly resource?: undefined;
			readonly resourceState: "loading" | "unavailable";
	  };

type PreloadedGlbResourceState =
	| {
			readonly kind: "loading";
			readonly loadedBytes: number;
			readonly totalBytes?: number;
	  }
	| { readonly kind: "ready"; readonly resource: CustomGlbResource }
	| { readonly kind: "unavailable" };

type CatalogPublicationUiState =
	| { readonly kind: "idle" | "loading" }
	| {
			readonly kind: "ready";
			readonly publication: VersionedCatalogPublication;
	  }
	| { readonly kind: "unavailable" | "invalid" };

type CatalogCategoryFilter = CatalogSection | "all" | "custom";

const initialDimensions: DimensionFields = {
	depthMm: "3000",
	heightMm: "2600",
	widthMm: "4000",
};
const initialItemFields: ItemFields = {
	color: "#a76a3b",
	depthMm: "700",
	heightMm: "750",
	label: "Стол",
	widthMm: "1200",
};
const DEFAULT_DRAW_WALL_THICKNESS_MM = 100;
const PRELOADED_GLB_DEFINITION_PREFIX = "preloaded-glb:";

function CatalogCategoryGlyph({
	category,
}: {
	readonly category: CatalogCategoryFilter;
}) {
	return (
		<svg
			aria-hidden="true"
			data-testid="catalog-category-glyph"
			fill="none"
			viewBox="0 0 28 28"
		>
			{category === "all" ? (
				<>
					<rect height="7" rx="1.5" width="7" x="5" y="5" />
					<rect height="7" rx="1.5" width="7" x="16" y="5" />
					<rect height="7" rx="1.5" width="7" x="5" y="16" />
					<rect height="7" rx="1.5" width="7" x="16" y="16" />
				</>
			) : null}
			{category === "custom" ? (
				<path d="m14 4 1.8 6.2L22 12l-6.2 1.8L14 20l-1.8-6.2L6 12l6.2-1.8L14 4Zm7 14 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
			) : null}
			{category === "furniture" ? (
				<path d="M6 19v-5.4c0-1.5 1.2-2.7 2.7-2.7h10.6c1.5 0 2.7 1.2 2.7 2.7V19M4.5 18.7h19v3.1h-19zM8.8 10.9V8.1c0-1 .8-1.8 1.8-1.8h6.8c1 0 1.8.8 1.8 1.8v2.8" />
			) : null}
			{category === "plumbing" ? (
				<path d="M7 13V9.5A3.5 3.5 0 0 1 10.5 6h3A3.5 3.5 0 0 1 17 9.5V11M17 11h4v3h-8v-3h4ZM6 18h15M9 18v3m9-3v3" />
			) : null}
			{category === "appliances-electronics" ? (
				<path d="M8 4.5h12v19H8zM11 8h6M11 16h6M12 22.5h4" />
			) : null}
			{category === "lighting" ? (
				<path d="M9 14.5h10L17.2 8H10.8L9 14.5ZM14 14.5V21m-3 0h6M8 7l-2-2m14 2 2-2M14 6V3" />
			) : null}
			{category === "accessories" ? (
				<path d="M10 5.5h8l-1 4.2c2 1.8 3 4.1 3 6.8 0 3.5-2.7 6-6 6s-6-2.5-6-6c0-2.7 1-5 3-6.8l-1-4.2ZM9.5 16h9" />
			) : null}
		</svg>
	);
}

function catalogOriginFor(
	asset: PreloadedGlbCatalogAsset,
): CatalogVersionAssetOrigin | undefined {
	if (
		!asset.catalogAssetId ||
		!asset.catalogEnvelopeHash ||
		!asset.catalogVersion
	) {
		return undefined;
	}
	return {
		catalogAssetId: asset.catalogAssetId,
		catalogEnvelopeHash: asset.catalogEnvelopeHash,
		catalogVersion: asset.catalogVersion,
		source: "CatalogVersion",
	};
}

function statusCopy(state: ProjectScreenState): string {
	switch (state.kind) {
		case "loading":
			return "Проверяем";
		case "first-run":
			return "Новый проект";
		case "projects":
			return "Выберите проект";
		case "saving":
			return "Сохраняем локально…";
		case "saved":
			return "Сохранено локально";
		case "persist-failed":
			return "Не сохранено";
		case "recovery-needed":
			return "Нужно восстановление";
		case "history-recovery-needed":
			return "История требует восстановления";
	}
}

/**
 * Network reachability is only an informational surface for a healthy local
 * Project. Persist, recovery and fenced-writer states already carry their own
 * stronger contract and must never be visually merged with this notice.
 */
export function shouldShowHealthyOfflineStatus({
	isBrowserOnline,
	isReadOnly,
	stateKind,
}: {
	readonly isBrowserOnline: boolean;
	readonly isReadOnly: boolean;
	readonly stateKind: ProjectScreenState["kind"];
}): boolean {
	return (
		!isBrowserOnline &&
		!isReadOnly &&
		(stateKind === "saved" || stateKind === "saving")
	);
}

function storagePressureCopy(
	pressure: Exclude<StoragePressure, { readonly kind: "unavailable" }>,
): string {
	const percentage = Math.ceil(
		(pressure.usageBytes / pressure.quotaBytes) * 100,
	);
	return pressure.kind === "critical"
		? `Локальное хранилище почти заполнено: занято не менее ${percentage}%. Экспортируйте проект до следующего изменения.`
		: `Локальное хранилище заполнено на ${percentage}%. Подготовьте экспорт проекта до следующего изменения.`;
}

function persistentStorageRequestCopy(
	result: PersistentStorageRequest,
): string {
	if (result.kind === "granted") {
		return "Браузер подтвердил защиту локального хранилища. Это не заменяет резервный экспорт проекта.";
	}
	if (result.kind === "not-granted") {
		return "Браузер не подтвердил защиту локального хранилища. Экспортируйте проект перед следующей правкой.";
	}
	return "Этот браузер не может подтвердить защиту локального хранилища. Экспортируйте проект перед следующей правкой.";
}

/** Explains why the last durable Project revision intentionally stayed current. */
export function persistenceFailureCopy(reasonCode: string): string {
	if (reasonCode === "PERSISTENCE_QUOTA_EXCEEDED") {
		return "В локальном хранилище недостаточно места. Сохранённый план не изменён — экспортируйте проект, освободите место и повторите сохранение.";
	}
	return reasonCode === "PROJECT_HISTORY_RESOURCE_LIMIT"
		? "Новая правка превысила лимит текущей истории. Закройте и заново откройте проект, чтобы начать новую историю; сохранённый план не изменён."
		: "Не удалось сохранить правку. Сохранённый план не изменён — повторите действие.";
}

/** Name-specific feedback stays inside the rename dialog. */
export function renamePersistenceFailureCopy(reasonCode: string): string {
	return reasonCode === "PROJECT_HISTORY_RESOURCE_LIMIT" ||
		reasonCode === "PERSISTENCE_QUOTA_EXCEEDED"
		? `Прежнее название не изменено. ${persistenceFailureCopy(reasonCode)}`
		: "Прежнее название не изменено. Не удалось сохранить правку — повторите действие.";
}

export function persistenceFailureActionCopy(reasonCode: string, retryPolicy: ReturnType<ProjectController["persistenceRetryPolicy"]> = "allowed"): string {
	if (retryPolicy === "registered-transfer-reselection-required") return "Выбрать исходный файл снова";
	return reasonCode === "PROJECT_HISTORY_RESOURCE_LIMIT"
		? "Открыть проект заново"
		: "Повторить сохранение";
}

/** The history branch is unchanged whenever its explicit discard cannot be proven safe. */
export function historyDiscardFailureCopy(reason: string): string {
	if (reason === "current-resource-issue") {
		return "Текущий план тоже требует восстановления, поэтому история не изменена.";
	}
	if (reason === "read-only" || reason === "writer-lease-lost") {
		return "Проект открыт для редактирования в другом окне. История не изменена.";
	}
	return "Не удалось повторно проверить текущий план. История не изменена.";
}

function isLegacyFixtureProject(
	project: EditorProject | undefined,
): project is ProjectV2 {
	return project?.schemaVersion === 2;
}

function editorProject(state: ProjectScreenState): EditorProject | undefined {
	const project =
		state.kind === "saved" ||
		state.kind === "saving" ||
		state.kind === "persist-failed" ||
		state.kind === "history-recovery-needed"
			? state.project
			: undefined;
	return project;
}

function roomMetadataFor(project: EditorProject) {
	return project.schemaVersion === 2
		? project.level.roomMetadata
		: project.level.rooms;
}

function dimensionsFrom(
	metrics: RectangularRoomMetrics | undefined,
): DimensionFields {
	return metrics
		? {
				depthMm: String(metrics.depthMm),
				heightMm: String(metrics.heightMm),
				widthMm: String(metrics.widthMm),
			}
		: initialDimensions;
}

export function dimensionsAfterCustomGlbPreviewMeasurement(
	currentDimensions: DimensionFields,
	measuredDimensions: MeasuredCustomGlbDimensions,
	hasUserEditedDimensions: boolean,
): DimensionFields {
	if (hasUserEditedDimensions) return currentDimensions;
	return {
		depthMm: String(measuredDimensions.depthMm),
		heightMm: String(measuredDimensions.heightMm),
		widthMm: String(measuredDimensions.widthMm),
	};
}

function roomCountCopy(count: number): string {
	const lastTwoDigits = Math.abs(count) % 100;
	const lastDigit = Math.abs(count) % 10;
	if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
		return `${count} комнат`;
	}
	if (lastDigit === 1) {
		return `${count} комната`;
	}
	if (lastDigit >= 2 && lastDigit <= 4) {
		return `${count} комнаты`;
	}
	return `${count} комнат`;
}

function roomPropertyFieldsFor(
	room: Room,
	roomIndex: number,
): RoomPropertyFields {
	return {
		heightMm: String(room.heightMm),
		name: room.name?.trim() || `Комната ${roomIndex + 1}`,
		type: room.type ?? "other",
	};
}

function wallCountCopy(count: number): string {
	const lastTwoDigits = Math.abs(count) % 100;
	const lastDigit = Math.abs(count) % 10;
	if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
		return `${count} стен`;
	}
	if (lastDigit === 1) {
		return `${count} стена`;
	}
	if (lastDigit >= 2 && lastDigit <= 4) {
		return `${count} стены`;
	}
	return `${count} стен`;
}

export { itemCountCopy as catalogResultCountCopy } from "./item-count-copy";

function activeEditorModeCopy(
	viewMode: ViewMode,
	activeTool: EditorTool,
): string {
	if (viewMode === "three-dimensional") {
		return "3D";
	}
	switch (activeTool) {
		case "wall":
			return "Стены";
		case "item":
			return "Предмет";
		case "select":
			return "Рука и выбор";
	}
}

export function errorCopy(reasonCode: string): string {
	switch (reasonCode) {
		case "OUTSIDE_ROOM_HOST":
			return "Предмет должен целиком находиться внутри выбранной комнаты.";
		case "ITEM_COLLISION":
			return "Предметы не могут пересекаться.";
		case "WALL_ITEM_COLLISION":
			return "Стена не может пересекать размещённый предмет. Переместите предмет или проведите стену иначе.";
		case "WALL_HOST_NOT_FOUND":
			return "Выбранная стена больше недоступна. Выберите её ещё раз.";
		case "OUTSIDE_WALL_HOST":
			return "Предмет должен целиком помещаться на выбранной стене.";
		case "WALL_OPENING_COLLISION":
			return "Настенный предмет не может пересекать дверной или оконный проём.";
		case "ASSET_DEFINITION_NOT_PINNED":
			return "Модель ещё не закреплена в ресурсах этого проекта. Сначала завершите её добавление.";
		case "WALL_ITEM_LOCKED":
		case "ITEM_LOCKED":
			return "Предмет заблокирован. Сначала разблокируйте его.";
		case "WALL_ITEM_LOCK_STATE_UNCHANGED":
		case "ITEM_LOCK_STATE_UNCHANGED":
			return "Предмет уже находится в выбранном состоянии блокировки.";
		case "WALL_DOOR_OPENING_COLLISION":
			return "Новая стена пересекает проём. Соедините её с краем проёма или проведите в стороне.";
		case "DOOR_CLEARANCE_COLLISION":
			return "Предмет пересекает сектор открывания двери. Измените сторону двери или переместите предмет.";
		case "PROJECT_BOUNDS_EXCEEDED":
			return "Новое положение или размер выходит за границы проекта.";
		case "INVALID_DIMENSION":
			return "Введите целые положительные миллиметры.";
		case "ZERO_LENGTH":
			return "Проведите стену с ненулевой длиной.";
		case "ROOM_NOT_DETACHED":
			return "Новая комната не должна касаться существующего контура.";
		case "ROOM_OVERLAP":
			return "Новая комната пересекает существующий контур.";
		case "PLAN_TOPOLOGY_UNSUPPORTED":
			return "Этот план пока не поддерживает добавление отдельного контура.";
		case "PLAN_NOT_RECTANGULAR_STARTER":
			return "Для этого контура нужен инструмент стен, а не изменение стартовой стороны.";
		case "WALL_BOUNDARY":
			return "Внешнюю стену нельзя удалить в текущем плане.";
		case "WALL_NOT_FOUND":
		case "WALL_NOT_DELETABLE":
			return "Эту стену нельзя удалить в текущей топологии.";
		case "INVALID_WALL_HOST":
			return "Для проёма нужна корректно выбранная стена.";
		case "DOOR_WIDTH_BELOW_MINIMUM":
			return `Ширина дверного проёма должна быть не менее ${MINIMUM_RESIDENTIAL_DOORWAY_WIDTH_MM} мм.`;
		case "DOOR_WIDTH_EXCEEDS_WALL_LENGTH":
			return "Ширина дверного проёма не может превышать длину выбранной стены.";
		case "WINDOW_WIDTH_EXCEEDS_WALL_LENGTH":
			return "Ширина окна не может превышать длину выбранной стены.";
		case "OPENING_OUTSIDE_WALL_INTERVAL":
			return "Проём не помещается в границы выбранной стены.";
		case "OPENING_OUT_OF_BOUNDS":
			return "Высота проёма превышает высоту выбранной стены.";
		case "OPENING_OVERLAP":
			return "Проёмы на одной стене не могут пересекаться.";
		case "OPENING_NOT_FOUND":
			return "Этот проём уже удалён или недоступен.";
		case "ITEM_HOST_UNRESOLVABLE":
			return "Изменение нарушит размещение предмета. Переместите предмет и повторите.";
		case "OPENING_HOST_UNRESOLVABLE":
			return "Изменение сделает проём невалидным. Сначала удалите или переместите проём.";
		case "OPENING_CONFLICT_STALE":
			return "Состав затронутых проёмов изменился. Проверьте последствия ещё раз.";
		case "WALL_DELETION_CONFLICT":
			return "Перед удалением стены подтвердите все показанные последствия.";
		case "STALE_BASE_REVISION":
			return "План изменился после preview. Проверьте последствия удаления ещё раз.";
		case "WRITER_LEASE_LOST":
			return "Редактирование перешло в другое окно. Удаление не выполнено.";
		case "WALL_ADD_CONFLICT_STALE":
			return "Состав затронутых проёмов или предметов изменился. Проверьте последствия добавления ещё раз.";
		case "ITEM_NOT_FOUND":
			return "Предмет уже удалён или недоступен.";
		case "ITEM_COLOR_UNSUPPORTED":
			return "Этот вариант цвета недоступен в локальном каталоге.";
		case "FIXED_ASSET_DIMENSIONS":
			return "Габариты этой 3D-модели зафиксированы её определением.";
		case "ITEM_COLOR_NOT_SUPPORTED":
			return "У этой 3D-модели не объявлены изменяемые варианты цвета.";
		case "ROOM_HEIGHT_CONFLICT":
			return "У объединяемых комнат разная высота. Сначала выровняйте её.";
		case "ROOM_METADATA_CONFLICT_STALE":
			return "Состав объединяемых помещений изменился. Проверьте последствия ещё раз.";
		case "ROOM_NOT_FOUND":
			return "Выбранное помещение больше не существует в текущем плане.";
		case "ROOM_NAME_REQUIRED":
			return "Укажите название помещения.";
		case "ROOM_TYPE_INVALID":
			return "Выберите назначение помещения из списка.";
		case "ROOM_HEIGHT_INVALID":
			return "Высота комнаты должна быть целым числом от 500 до 10 000 мм.";
		case "ROOM_HEIGHT_OPENING_CONFLICT":
			return "Эта высота сделает существующий проём выше стены. Сначала измените или удалите проём.";
		case "ROOM_HEIGHT_OPENING_CONFLICT_STALE":
			return "Состав затронутых проёмов изменился. Проверьте высоту помещения ещё раз.";
		case "ROOM_HEIGHT_OPENING_RESOLUTION_INVALID":
			return "Выбранный результат больше не подходит текущим проёмам. Проверьте их ещё раз.";
		case "ROOM_USABLE_AREA_COLLAPSE":
			return "Эта толщина сделает комнату непригодной. Укажите меньшее значение.";
		case "USABLE_POLYGON_COLLAPSED":
			return "Эта толщина схлопнет внутренний контур комнаты. Укажите меньшее значение.";
		case "UNSUPPORTED_WALL_THICKNESS":
			return "Толщина стены должна быть целым числом от 20 до 1000 мм.";
		case "WALL_POSITION_UNCHANGED":
			return "Укажите новое положение стены.";
		case "WALL_NOT_MOVABLE":
			return "Эту стену пока нельзя переместить отдельно от связанных сегментов.";
		case "WALL_SPLIT_CONFLICT_STALE":
			return "Состав затронутых проёмов или предметов изменился. Проверьте последствия ещё раз.";
		case "WALL_SPLIT_POINT_INVALID":
			return "Выберите точку разделения строго внутри стены.";
		case "VERTEX_NOT_FOUND":
			return "Эта вершина уже недоступна в текущем плане.";
		case "VERTEX_NOT_DELETABLE":
			return "Можно убрать только промежуточную вершину на прямой стене без проёмов.";
		case "VERTEX_POSITION_UNCHANGED":
			return "Вершина уже находится в этом положении.";
		case "VERTEX_NOT_MOVABLE":
			return "Этот перенос изменит связанные стены. Пока можно двигать только вершину на прямом участке.";
		case "COLLINEAR_OVERLAP":
			return "Новая стена накладывается на существующий сегмент.";
		case "INVALID_PLAN_GRAPH":
			return "Контур стен нельзя безопасно замкнуть. Проверьте, что стены не пересекаются и соединяются в углах.";
		case "UNSUPPORTED_FACE_SHAPE":
			return "Этот замкнутый контур пока не поддерживается. Используйте простой выпуклый контур без пересечений.";
		case "DIAGONAL_WALL_CONTACT_UNSUPPORTED":
			return "Диагональная стена не может накладываться на другую, а точка пересечения должна попадать в целый миллиметр.";
		case "TOO_SHORT_WALL":
			return "Стена должна быть длиннее своей толщины.";
		case "UNSUPPORTED_DIRECTION":
			return "В альфе стены строятся горизонтально, вертикально или под углом 45°.";
		case "INVALID_SOURCE_PROJECT":
		case "INVALID_RESULTING_PROJECT":
			return "Этот план нельзя безопасно изменить. Проверьте его целостность.";
		default:
			return "Не удалось применить изменение. Проверьте параметры и попробуйте снова.";
	}
}

export function wallMutationCorrection(
	result: {
		readonly affected?: GeneralWallProjectMutationAffectedReference;
		readonly reasonCode: string;
	},
	project: Project | undefined,
): WallMutationCorrection | undefined {
	if (!project) return undefined;
	const affected = result.affected;
	if (
		result.reasonCode === "WALL_ITEM_COLLISION" &&
		affected?.kind === "floor-item"
	) {
		const item = project.assetInstances.find(
			(candidate) =>
				candidate.anchorClass === "floor" &&
				candidate.assetInstanceId === affected.assetInstanceId,
		);
		return item
			? {
					assetInstanceId: item.assetInstanceId,
					kind: "floor-item",
					message: `Стена не может пересекать предмет «${item.label}». Откройте предмет, чтобы переместить его, или проведите стену иначе.`,
				}
			: undefined;
	}
	if (
		result.reasonCode !== "WALL_DOOR_OPENING_COLLISION" ||
		affected?.kind !== "opening"
	) {
		return undefined;
	}
	const opening = project?.level.openings.find(
		(candidate) => candidate.openingId === affected.openingId,
	);
	if (!opening) return undefined;
	const openingsOnHost = project.level.openings.filter(
		(candidate) => candidate.wallSegmentId === opening.wallSegmentId,
	);
	const ordinal = openingsOnHost.findIndex(
		(candidate) => candidate.openingId === opening.openingId,
	);
	const name = `${opening.kind === "Door" ? "Дверной проём" : "Окно"} № ${ordinal + 1}`;
	return {
		kind: "opening",
		message: `Стена пересекает ${name} на выбранной стене. Откройте ${opening.kind === "Door" ? "проём" : "окно"}, чтобы изменить его, или проведите стену иначе.`,
		opening,
	};
}

export function wallThicknessErrorCopy(reasonCode: string): string {
	switch (reasonCode) {
		case "INVALID_DIMENSION":
			return "Толщина стены должна быть целым числом миллиметров.";
		case "PROJECT_BOUNDS_EXCEEDED":
			return "Толщина стены должна быть в допустимом диапазоне 20–1000 мм.";
		default:
			return errorCopy(reasonCode);
	}
}

export function projectNameErrorCopy(reasonCode: string): string {
	return reasonCode === "PROJECT_NAME_INVALID_UNICODE"
		? "Название содержит недопустимый символ. Удалите его и повторите попытку."
		: "Введите название проекта.";
}

/** A project card is a place to return to, not a diagnostic log. */
export function projectDirectoryUpdatedCopy(updatedAt: string): string {
	const timestamp = new Date(updatedAt);
	if (Number.isNaN(timestamp.valueOf())) return "Изменён недавно";
	const formatted = new Intl.DateTimeFormat("ru-RU", {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
	}).format(timestamp);
	return `Изменён · ${formatted}`;
}

export function projectTransferImportFeedback(reasonCode: string): string {
	switch (reasonCode) {
		case "PROJECT_BACKUP_ENVELOPE_EXCEEDED":
			return "Текущий формат резервной копии в браузере не сохраняет эти данные точно. Исходный файл и существующие проекты не изменены.";
		case "BACKUP_SCHEMA_UNREADABLE":
			return "Не удалось безопасно определить формат файла. Исходный файл и существующие проекты не изменены.";
		case "verification-unavailable":
			return "Проверка этого файла сейчас недоступна. Повторите попытку или обновите приложение. Исходный файл и существующие проекты не изменены.";
		case "BACKUP_CHECKSUM_MISMATCH":
		case "PROJECT_JSON_CHECKSUM_MISMATCH":
		case "PORTABLE_BACKUP_CHECKSUM_MISMATCH":
			return "Контрольная сумма файла не совпала. Передайте исходный файл заново.";
		case "BACKUP_CANCELLED":
		case "PORTABLE_BACKUP_CANCELLED":
			return "Импорт отменён. Существующие проекты не изменены.";
		case "PORTABLE_BACKUP_FUTURE_SCHEMA":
			return "Этот backup создан более новой версией приложения. Обновите приложение и повторите импорт; существующие проекты не изменены.";
		case "BACKUP_LIMIT_EXCEEDED":
		case "PORTABLE_BACKUP_LIMIT_EXCEEDED":
			return "Backup превышает безопасный размер или количество файлов для телефона. Существующие проекты не изменены.";
		default:
			return "Не удалось проверить файл проекта. Существующие проекты не изменены.";
	}
}

function projectTransferProgress(
	state: Exclude<ProjectTransferImportUiState, { readonly kind: "idle" }>,
): number {
	switch (state.kind) {
		case "reading":
		case "cancelling":
			return 0;
		case "validating":
			return 1;
		case "staging-resources":
			return state.total === 0 ? 2 : 1 + state.completed / state.total;
		case "checking-render":
			return 3;
		case "saving":
			return 4;
	}
}

function projectTransferProgressCopy(
	state: Exclude<ProjectTransferImportUiState, { readonly kind: "idle" }>,
): string {
	switch (state.kind) {
		case "reading":
			return `Читаем ${state.filename}…`;
		case "validating":
			return "Проверяем контейнер, схему и контрольные суммы…";
		case "staging-resources":
			return state.total === 0
				? "Подготавливаем новый локальный проект…"
				: `Проверяем локальные ресурсы: ${state.completed} из ${state.total}…`;
		case "checking-render":
			return "Проверяем локальное чтение и 2D/3D-проекцию…";
		case "saving":
			return "Публикуем новый локальный проект…";
		case "cancelling":
			return "Останавливаем импорт и очищаем временные данные…";
	}
}

/** User-visible FBX copy is deliberately about conversion, never about a durable Project import. */
export function fbxConversionFeedback(reasonCode: string): string {
	switch (reasonCode) {
		case "FBX_FILE_SELECTION_INVALID":
			return "Выберите один FBX с текстурами либо один ZIP-архив с такой моделью.";
		case "FBX_ARCHIVE_INVALID":
			return "ZIP-архив не удалось прочитать. Скачайте модель заново и выберите исходный ZIP.";
		case "FBX_ARCHIVE_BYTES_LIMIT":
			return "ZIP-архив ограничен 25 MiB для надёжного локального преобразования на телефоне.";
		case "FBX_ARCHIVE_RESOURCE_LIMIT":
			return "В ZIP слишком много файлов или распакованных данных для одного предмета. Экспортируйте одну модель с уменьшенными текстурами.";
		case "FBX_SIDECAR_TYPE_UNSUPPORTED":
			return "Вместе с FBX поддерживаются только текстуры JPG, PNG или WebP. Уберите другие файлы или упакуйте модель в GLB.";
		case "FBX_FILE_BYTES_LIMIT":
			return "Один FBX для телефона ограничен 12 MiB. Выберите отдельный предмет, а не набор мебели.";
		case "FBX_SIDECAR_BYTES_LIMIT":
			return "Текстуры, выбранные вместе с FBX, ограничены 13 MiB. Уменьшите текстуры или выберите GLB до 25 MiB.";
		case "FBX_BINARY_HEADER_REQUIRED":
			return "Нужен binary FBX версии 7.1–7.8, а не текстовый или переименованный файл.";
		case "UNSUPPORTED_FBX_VERSION":
			return "Версия FBX не поддерживается. Экспортируйте binary FBX 7.1–7.8 или сразу GLB.";
		case "FBX_EXTERNAL_RESOURCE":
			return "Для этой FBX выберите вместе с моделью все нужные текстуры JPG, PNG или WebP — приложение не скачивает файлы по ссылкам.";
		case "FBX_UNSUPPORTED_SCENE_CONTENT":
			return "Поддерживается только статичный предмет без анимации, скелета, morph-targets, камер и света.";
		case "FBX_CONVERSION_OUTPUT_LIMIT":
			return "Нормализованная GLB-модель превысила 25 MiB. Уменьшите геометрию или текстуры и повторите.";
		case "FBX_CONVERSION_TIMEOUT":
			return "Преобразование не завершилось за 15 секунд и было безопасно остановлено.";
		case "FBX_CONVERSION_CANCELLED":
			return "Преобразование отменено. Проект и локальное хранилище не изменены.";
		default:
			return "Не удалось безопасно преобразовать FBX. Проект и локальное хранилище не изменены.";
	}
}

function customGlbImportFeedback(reasonCode: string): string {
	switch (reasonCode) {
		case "GLB_BYTES_LIMIT":
		case "GLB_FILE_BYTES_LIMIT":
			return "Одна GLB-модель ограничена 25 MiB, чтобы её можно было хранить и открыть на телефоне.";
		case "GLB_HEADER_INVALID":
		case "GLB_JSON_INVALID":
		case "MALFORMED_GLTF":
			return "Это не целая GLB 2.0. Экспортируйте из Blender/Maya в один файл .glb и повторите.";
		case "EXTERNAL_RESOURCE":
			return "Модель ссылается на отдельные текстуры или файлы. Экспортируйте self-contained GLB со всеми текстурами внутри.";
		case "UNSUPPORTED_DYNAMIC_CONTENT":
		case "ANIMATION_OR_SKIN_UNSUPPORTED":
			return "Поддерживается статичная модель без анимации, рига, камеры и света.";
		case "UNSUPPORTED_REQUIRED_EXTENSION":
			return "В модели используется неподдерживаемое расширение glTF. Экспортируйте стандартный GLB без расширений.";
		case "GLB_GEOMETRY_BUDGET":
		case "DECODED_GEOMETRY_LIMIT":
			return "В модели слишком много геометрии для надёжного мобильного предпросмотра. Упростите её и повторите.";
		case "GLB_TEXTURE_BUDGET":
		case "TEXTURE_LIMIT":
			return "В модели слишком много текстур для мобильного проекта. Объедините или уменьшите текстуры.";
		case "MEMORY_BUDGET_RISK":
			return "Текстуры после распаковки слишком велики для надёжной работы на телефоне. Уменьшите их до 4096 px по стороне и 48 Мп суммарно.";
		default:
			return "Не удалось проверить GLB. Проект и локальное хранилище не изменены.";
	}
}

async function sha256HexForBrowserBytes(bytes: Uint8Array): Promise<string> {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	const digest = await window.crypto.subtle.digest("SHA-256", copy.buffer);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

async function prepareCustomGlbImport(
	bytes: Uint8Array,
	filename: string,
	source: "fbx" | "glb",
): Promise<CustomGlbImportUiState> {
	const preflight = preflightStaticGlbImport(bytes);
	if (preflight.kind === "rejected") {
		return { kind: "rejected", reasonCode: preflight.reasonCode };
	}
	const displayName =
		filename.replace(/\.(?:fbx|glb)$/i, "").trim() || "Моя модель";
	return {
		assetDefinitionId: browserRandomUuid(),
		bytes,
		dimensions: { depthMm: "1000", heightMm: "1000", widthMm: "1000" },
		displayName,
		filename,
		kind: "ready",
		resourceHash: await sha256HexForBrowserBytes(bytes),
		source,
		textureCount: preflight.textureCount,
	};
}

async function loadPreloadedGlbResource(
	asset: PreloadedGlbCatalogAsset,
	signal: AbortSignal,
	onProgress: (progress: PreloadedGlbDownloadProgress) => void,
): Promise<CustomGlbResource | undefined> {
	let bytes: Uint8Array;
	let resourceHash: string;
	try {
		// Catalog resources can be larger than a development tunnel's whole-body
		// limit. Use the same bounded range path for published and local cards.
		bytes = await fetchPreloadedGlbBytes(
			asset.resourceUrl,
			fetch,
			undefined,
			signal,
			onProgress,
		);
		resourceHash = await sha256HexForBrowserBytes(bytes);
	} catch {
		return undefined;
	}
	if (
		asset.resource &&
		(bytes.byteLength !== asset.resource.byteLength ||
			resourceHash !== asset.resource.sha256)
	) {
		return undefined;
	}
	const preflight = preflightStaticGlbImport(bytes);
	if (preflight.kind === "rejected") return undefined;
	return { bytes, resourceHash };
}

function preloadedGlbResourceReadinessCopy(
	state: PreloadedGlbResourceState | undefined,
): string {
	switch (state?.kind) {
		case "loading":
			return state.totalBytes
				? `Готовим для офлайн · ${Math.round((state.loadedBytes / state.totalBytes) * 100)}%`
				: "Готовим для офлайн";
		case "ready":
			return "Готово для размещения";
		case "unavailable":
			return "Не удалось подготовить предмет для офлайн";
		default:
			return "Готово к загрузке";
	}
}

export function preloadedGlbLoadingStatusCopy(
	state: Readonly<{ loadedBytes: number; totalBytes?: number }>,
): string {
	if (!state.totalBytes) return "Готовим для офлайн…";
	const percent = Math.min(
		100,
		Math.round((state.loadedBytes / state.totalBytes) * 100),
	);
	return `Готовим для офлайн… ${percent}%`;
}

function catalogThumbnailUrlFor(
	asset: PreloadedGlbCatalogAsset,
	thumbnailUrls: Readonly<Record<string, string>>,
): string | undefined {
	return (
		thumbnailUrls[asset.id] ??
		(!asset.thumbnail && asset.thumbnailUrl ? asset.thumbnailUrl : undefined)
	);
}

function customCatalogAssetsFor(
	definitions: readonly CustomGlbAssetDefinition[],
	resources: Readonly<Record<string, CustomGlbResource>>,
	resourceStates: Readonly<Record<string, CustomGlbLibraryResourceState>>,
	query: string,
	category: CatalogSection | "all" | "custom",
): readonly CustomCatalogAsset[] {
	if (category !== "all" && category !== "custom") return [];
	const normalizedQuery = query.trim().toLocaleLowerCase("ru");
	return definitions
		.filter(
			(definition) =>
				!definition.assetDefinitionId.startsWith(
					PRELOADED_GLB_DEFINITION_PREFIX,
				),
		)
		.filter((definition) => {
			if (normalizedQuery === "") return true;
			return [
				definition.displayName,
				definition.widthMm,
				definition.depthMm,
				definition.heightMm,
			]
				.join(" ")
				.toLocaleLowerCase("ru")
				.includes(normalizedQuery);
		})
		.map((definition) => {
			const resource = resources[definition.assetDefinitionId];
			if (
				resource?.resourceHash === definition.resourceHash &&
				resourceStates[definition.assetDefinitionId] === "ready"
			) {
				return { definition, resource, resourceState: "ready" };
			}
			return {
				definition,
				resourceState:
					resourceStates[definition.assetDefinitionId] === "unavailable"
						? "unavailable"
						: "loading",
			};
		});
}

/** A delayed initial read must never erase a card registered while it was pending. */
function mergeCustomGlbLibraryDefinitions(
	current: readonly CustomGlbAssetDefinition[],
	hydrated: readonly CustomGlbAssetDefinition[],
): readonly CustomGlbAssetDefinition[] {
	const definitionsByHash = new Map(
		hydrated.map((definition) => [definition.resourceHash, definition]),
	);
	for (const definition of current) {
		definitionsByHash.set(definition.resourceHash, definition);
	}
	return [...definitionsByHash.values()];
}

/** Placement is a direct canvas action, so every outcome needs clear copy. */
export function itemPlacementFeedback(result: {
	readonly kind: string;
	readonly reasonCode?: string;
}): string | undefined {
	switch (result.kind) {
		case "durable":
			return "Предмет размещён и сохранён.";
		case "in-progress":
			return "Предыдущая правка ещё сохраняется. Подождите и повторите размещение.";
		case "not-ready":
			return "Проект ещё открывается. Подождите и повторите размещение предмета.";
		case "persist-failed":
			return "Не удалось сохранить предмет. Повторите сохранение и разместите его снова.";
		case "cancelled":
			return "Размещение предмета отменено.";
		case "rejected":
			return result.reasonCode
				? errorCopy(result.reasonCode)
				: "Предмет нельзя разместить в этой точке.";
		default:
			return "Предмет пока нельзя разместить. Повторите действие.";
	}
}

/**
 * Once publication has produced a durable or retryable candidate, the draft
 * is no longer cancellable transient UI. A rejected/deferred command stays a
 * draft so the user can retry it without drawing again.
 */
export function shouldConsumeConfirmedWallDraft(result: {
	readonly kind: string;
}): boolean {
	return result.kind === "durable" || result.kind === "persist-failed";
}

function positiveInteger(raw: string): number | undefined {
	if (!/^(?:[1-9][0-9]*)$/.test(raw)) return undefined;
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : undefined;
}

function nonNegativeSafeInteger(raw: string): number | undefined {
	const trimmed = raw.trim();
	if (!/^(?:0|[1-9][0-9]*)$/.test(trimmed)) {
		return undefined;
	}
	const value = Number(trimmed);
	return Number.isSafeInteger(value) ? value : undefined;
}

function wallItemDraftFieldsFor(
	input: ParametricWallItemInput,
): WallItemDraftFields {
	return {
		color: input.color,
		depthMm: String(input.depthMm),
		elevationMm: String(input.elevationMm),
		heightMm: String(input.heightMm),
		label: input.label,
		offsetMm: String(input.offsetMm),
		widthMm: String(input.widthMm),
	};
}

function wallItemDraftFromFields(
	draft: ParametricWallItemInput,
	fields: WallItemDraftFields | undefined,
): ParametricWallItemInput | undefined {
	if (!fields) return undefined;
	const widthMm = positiveInteger(fields.widthMm);
	const depthMm = positiveInteger(fields.depthMm);
	const heightMm = positiveInteger(fields.heightMm);
	const elevationMm = nonNegativeSafeInteger(fields.elevationMm);
	const offsetMm = nonNegativeSafeInteger(fields.offsetMm);
	const label = fields.label.trim();
	if (
		widthMm === undefined ||
		depthMm === undefined ||
		heightMm === undefined ||
		elevationMm === undefined ||
		offsetMm === undefined ||
		label.length === 0 ||
		!alphaParametricItemColors.includes(fields.color as never)
	) {
		return undefined;
	}
	return {
		...draft,
		color: fields.color,
		depthMm,
		elevationMm,
		heightMm,
		label,
		offsetMm,
		widthMm,
	};
}

function PwaUpdateNotice({
	canActivate,
	hasUndurableDraft,
	pwaUpdate,
}: {
	readonly canActivate: boolean;
	readonly hasUndurableDraft: boolean;
	readonly pwaUpdate: PwaUpdate | undefined;
}) {
	if (!pwaUpdate || (!pwaUpdate.isWaiting && !pwaUpdate.isReloadReady)) {
		return null;
	}
	const isReloadReady = pwaUpdate.isReloadReady;
	return (
		<aside
			aria-live="polite"
			className={styles.pwaUpdateNotice}
			data-blocked={canActivate ? undefined : "true"}
			data-testid="pwa-update-notice"
			role="status"
		>
			<strong>
				{isReloadReady
					? "Обновление готово к перезапуску"
					: "Обновление готово"}
			</strong>
			<p>
				{canActivate
					? isReloadReady
						? "Текущий проект сохранён. Перезагрузите приложение, когда будете готовы."
						: "Текущий проект сохранён. Обновите приложение, когда будете готовы."
					: hasUndurableDraft
						? "Завершите или отмените черновую правку перед обновлением приложения."
						: "Обновление будет доступно после завершения сохранения текущего проекта."}
			</p>
			<button
				disabled={!canActivate}
				onClick={isReloadReady ? pwaUpdate.reload : pwaUpdate.activate}
				type="button"
			>
				{isReloadReady ? "Перезагрузить приложение" : "Обновить приложение"}
			</button>
		</aside>
	);
}

function PwaInstallGuide({
	pwaInstall,
}: {
	readonly pwaInstall: PwaInstall | undefined;
}) {
	const [promptOutcome, setPromptOutcome] = useState<PwaInstallPromptOutcome>();
	const [isPrompting, setIsPrompting] = useState(false);
	useEffect(() => {
		if (!promptOutcome) return;
		const timeout = window.setTimeout(() => setPromptOutcome(undefined), 5000);
		return () => window.clearTimeout(timeout);
	}, [promptOutcome]);
	if (!pwaInstall?.promptInstall || pwaInstall.isStandalone) return null;
	const promptInstall = async () => {
		if (!pwaInstall.promptInstall || isPrompting) return;
		setIsPrompting(true);
		try {
			setPromptOutcome(await pwaInstall.promptInstall());
		} finally {
			setIsPrompting(false);
		}
	};
	return (
		<aside className={styles.pwaInstallGuide} data-testid="pwa-install-guide">
			<button
				className={styles.secondaryAction}
				disabled={isPrompting}
				onClick={() => void promptInstall()}
				type="button"
			>
				{isPrompting ? "Открываем установку…" : "Установить приложение"}
			</button>
			{promptOutcome === "unavailable" ? (
				<div role="status">
					Установка сейчас недоступна.
					<button
						type="button"
						aria-label="Закрыть уведомление"
						onClick={() => setPromptOutcome(undefined)}
					>
						×
					</button>
				</div>
			) : null}
		</aside>
	);
}

function WriterLeaseNotice({
	error,
	hasRecoveryCopy,
	isConfirming,
	isShowingRecoveryCopy,
	isTakingOver,
	onCancel,
	onConfirm,
	onRequestTakeOver,
	onToggleRecoveryCopy,
	onRecoveryExport,
}: {
	readonly error?: string;
	readonly hasRecoveryCopy: boolean;
	readonly isConfirming: boolean;
	readonly isShowingRecoveryCopy: boolean;
	readonly isTakingOver: boolean;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
	readonly onRequestTakeOver: () => void;
	readonly onToggleRecoveryCopy: () => void;
	readonly onRecoveryExport: () => void;
}) {
	return (
		<aside
			aria-live="assertive"
			className={styles.writerLeaseNotice}
			data-testid="writer-lease-notice"
			role="alert"
		>
			<strong>Проект открыт в другом окне</strong>
			<p>
				В этом окне редактирование остановлено, чтобы версии не перезаписали
				друг друга.
			</p>
			{hasRecoveryCopy ? (
				<>
					<p>
						Незавершённое изменение осталось в этом окне. Скачайте его, чтобы
						восстановить как отдельный проект.
					</p>
					<button onClick={onRecoveryExport} type="button">
						Скачать несохранённую правку
					</button>
					<button onClick={onToggleRecoveryCopy} type="button">
						{isShowingRecoveryCopy
							? "Показать актуальную версию"
							: "Показать recovery-копию"}
					</button>
				</>
			) : null}
			{isConfirming ? (
				<>
					<p>
						После перехвата другое окно потеряет право сохранять этот проект.
						Подтвердите действие или отмените его — сохранённая версия не
						изменится.
					</p>
					<button disabled={isTakingOver} onClick={onConfirm} type="button">
						{isTakingOver
							? "Перехватываем редактирование…"
							: "Подтвердить перехват"}
					</button>
					<button disabled={isTakingOver} onClick={onCancel} type="button">
						Отмена
					</button>
				</>
			) : (
				<button onClick={onRequestTakeOver} type="button">
					Взять редактирование на себя
				</button>
			)}
			{error ? <p role="alert">{error}</p> : null}
		</aside>
	);
}

export function AppShell({
 diagnosticDetails,
 readonlyDetails,
 readonlyRecoveryDetails,
 readonlyStorageSources,
	requestedRenameProjectId,
 editorStorageNamespace,
 canCreateLegacyProject,
 getLegacyStartupRecovery,
	hostNavigation,
 navigationProtection,
	hostLifecycle,
	registeredTransferImport,
	registeredTransferExport,
	fileTransfer,
	sourceRecovery,
	catalogGateway,
	controller,
	drawingDimensionPreferences,
	pwaBrowseCache,
	pwaInstall,
	pwaUpdate,
}: AppShellProps) {
	const legacyCreationAllowed = canCreateLegacyProject?.() !== false;
 const isLegacyOwnerReadOnly = (namespace?: ProjectStorageNamespace) => !legacyCreationAllowed && namespace !== "browser-registered";
 const isEmbeddedHost = hostNavigation !== undefined || fileTransfer !== undefined;
 const isNavigationProtected = hostNavigation !== undefined || navigationProtection !== undefined;
 // Existing browser storage retains its editing behavior while recovery protections remain active.
 const fullTransientNavigationProtection = hostNavigation !== undefined || (navigationProtection !== undefined && editorStorageNamespace === "browser-registered");
	const [state, setState] = useState<ProjectScreenState>(controller.snapshot());
	const transientBoundaries = useRef(new Set<EditorTransientBoundary>());
	const lifecycleRef = useRef(hostLifecycle); lifecycleRef.current = hostLifecycle;
	const leaveFocusActive = useRef(false);
	const registerTransientBoundary = useCallback((boundary: EditorTransientBoundary) => {
		transientBoundaries.current.add(boundary);
		if (lifecycleRef.current?.snapshot().active === false || leaveFocusActive.current) boundary.suspend();
		return () => { transientBoundaries.current.delete(boundary); };
	}, []);
	const hostBackHandler = useRef<() => void>(() => undefined);
	const prepareHostBack = useRef<() => void>(() => undefined);
	const resumeHostViews = useRef<() => void>(() => undefined);
	useLayoutEffect(() => {
		if (!fullTransientNavigationProtection) return;
		const interceptBackPointer = (event: PointerEvent) => {
			if (!(event.target instanceof Element) || !event.target.closest("[data-editor-host-back]")) return;
			prepareHostBack.current();
			event.preventDefault();
		};
		window.addEventListener("pointerdown", interceptBackPointer, { capture: true });
		return () => window.removeEventListener("pointerdown", interceptBackPointer, { capture: true });
	}, [fullTransientNavigationProtection]);
	const [leaveFocus, setLeaveFocus] = useState<EditorFocusSnapshot>();
	const confirmedWriterExit = useRef<ReturnType<ProjectController["writerRecoveryCopy"]>>(undefined);
	leaveFocusActive.current = leaveFocus !== undefined;
	useLayoutEffect(() => {
		if (!hostLifecycle) return;
		let previous: ReturnType<HostLifecyclePort["snapshot"]> | undefined;
		const apply = () => {
			const next = hostLifecycle.snapshot();
			if (!previous || next.layoutVersion !== previous.layoutVersion) for (const boundary of transientBoundaries.current) boundary.invalidateContacts();
			if (!next.active) prepareHostBack.current();
			else if (previous?.active === false) {
				if (!leaveFocusActive.current) resumeHostViews.current();
				void controller.refreshWriterLeaseAccess().catch(() => undefined);
				void controller.refreshSessionHistoryIntegrity().catch(() => undefined);
			}
			previous = next;
		};
		const unsubscribe = hostLifecycle.subscribe(apply); apply();
		return unsubscribe;
	}, [hostLifecycle, controller]);
	const [hostBackNotice, setHostBackNotice] = useState<string>();
	useEffect(() => {
		if (!hostNavigation) return;
		const unsubscribe = hostNavigation.subscribeBack(() => hostBackHandler.current());
		try { hostNavigation.setBackVisible(true); } catch { /* DOM navigation remains available. */ }
		return () => {
			unsubscribe();
			try { hostNavigation.setBackVisible(false); hostNavigation.setClosingConfirmation?.(false); hostNavigation.setVerticalSwipesEnabled?.(true); } catch { /* Host teardown is best effort. */ }
		};
	}, [hostNavigation]);
	const [localFileState, setLocalFileState] = useState<LocalFileTransferState>({ kind: "idle" });
	const localFileSession = useMemo(() => fileTransfer ? new LocalFileTransferSession(fileTransfer, setLocalFileState) : undefined, [fileTransfer]);
	useEffect(() => () => localFileSession?.close(), [localFileSession]);
	const localFilePanel = localFileSession ? <LocalFileTransferPanel session={localFileSession} state={localFileState} /> : null;
	const sourceRecoveryPanel = sourceRecovery && localFileSession && (state.kind === "recovery-needed" || (state.kind === "projects" && state.recoveryNeeded)) ? <StoredSourceRecovery port={sourceRecovery} onExport={async (source) => {
		await localFileSession.prepare(async (signal) => {
			if (signal.aborted) return undefined;
			const prepared = prepareUnverifiedSourceFile(source);
			return prepared.kind === "prepared-source" ? { bytes: prepared.bytes, filename: prepared.filename, fileKind: "unverified-source" } : undefined;
		});
		if (localFileSession.snapshot().kind !== "prepared") throw new Error("Source preparation failed");
	}} /> : null;

 const readonlySourceRecoveryPanel=(state.kind==="recovery-needed"||(state.kind==="projects"&&state.recoveryNeeded))?readonlyRecoveryDetails:undefined;

	const [isBrowserOnline, setIsBrowserOnline] = useState(
		() => typeof navigator === "undefined" || navigator.onLine !== false,
	);
	const [storagePressure, setStoragePressure] = useState<StoragePressure>({
		kind: "unavailable",
	});
	const [hasCheckedStoragePressure, setHasCheckedStoragePressure] =
		useState(false);
	const [persistentStorageRequest, setPersistentStorageRequest] =
		useState<PersistentStorageRequest>();
	const [isRequestingPersistentStorage, setIsRequestingPersistentStorage] =
		useState(false);
	const [browseCacheCleanup, setBrowseCacheCleanup] =
		useState<PwaBrowseCacheCleanupResult>();
	const [isClearingBrowseCache, setIsClearingBrowseCache] = useState(false);
	const requestPersistentStorage = async () => {
		if (isRequestingPersistentStorage) return;
		setIsRequestingPersistentStorage(true);
		try {
			setPersistentStorageRequest(await controller.requestPersistentStorage());
		} finally {
			setIsRequestingPersistentStorage(false);
		}
	};
	const clearBrowseCache = async () => {
		if (!pwaBrowseCache || isClearingBrowseCache) return;
		setIsClearingBrowseCache(true);
		try {
			setBrowseCacheCleanup(await pwaBrowseCache.clear());
		} finally {
			setIsClearingBrowseCache(false);
		}
	};
	const retryPolicy = registeredTransferImport ? controller.persistenceRetryPolicy() : "allowed";
	const retryOrOpenNewHistoryBoundary = () => {
		if (registeredTransferImport && controller.persistenceRetryPolicy() === "registered-transfer-reselection-required") { registeredTransferInputRef.current?.click(); return; }
		if (
			state.kind === "persist-failed" &&
			state.reasonCode === "PROJECT_HISTORY_RESOURCE_LIMIT"
		) {
			void controller.open();
			return;
		}
		void controller.retry();
	};
	const [name, setName] = useState("");
	const [nameError, setNameError] = useState<string | undefined>();
	const [projectTransferError, setProjectTransferError] = useState<
		string | undefined
	>();
	const [projectTransferImport, setProjectTransferImport] =
		useState<ProjectTransferImportUiState>({ kind: "idle" });
	const [customGlbRepairError, setCustomGlbRepairError] = useState<
		string | undefined
	>();
	const [isRepairingCustomGlb, setIsRepairingCustomGlb] = useState(false);
	const [
		isRecoveryRemovalConfirmationOpen,
		setIsRecoveryRemovalConfirmationOpen,
	] = useState(false);
	const [isRemovingUnresolvedCustomGlb, setIsRemovingUnresolvedCustomGlb] =
		useState(false);
	const [recoveryRemovalError, setRecoveryRemovalError] = useState<
		string | undefined
	>();
	const [isRenameProjectOpen, setIsRenameProjectOpen] = useState(false);
	const [renameProjectName, setRenameProjectName] = useState("");
	const [renameProjectError, setRenameProjectError] = useState<
		string | undefined
	>();
	const [renameTargetProjectId, setRenameTargetProjectId] = useState<
		string | undefined
	>(requestedRenameProjectId);
	const [dimensionError, setDimensionError] = useState<string | undefined>();
	const [directoryDeletionTarget, setDirectoryDeletionTarget] = useState<{
		readonly projectId: string;
		readonly name: string;
		readonly storageNamespace?: ProjectStorageNamespace;
	}>();
	const directoryDeletionTriggerRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!dimensionError) return;
		const timeout = window.setTimeout(() => setDimensionError(undefined), 5000);
		return () => window.clearTimeout(timeout);
	}, [dimensionError]);
	const [wallMutationCorrectionState, setWallMutationCorrectionState] =
		useState<WallMutationCorrection | undefined>();
	const wallMutationCorrectionActionRef = useRef<HTMLButtonElement>(null);
	const openingDraftWidthInputRef = useRef<HTMLInputElement>(null);
	const [itemPlacementConfirmation, setItemPlacementConfirmation] = useState<
		string | undefined
	>();
	const [dimensions, setDimensions] =
		useState<DimensionFields>(initialDimensions);
	const [openingCreationDraft, setOpeningCreationDraft] =
		useState<OpeningCreationDraft>();
	const [openingDraft, setOpeningDraft] = useState<OpeningDraftFields>();
	const isOpeningDialogOpen =
		openingCreationDraft !== undefined || openingDraft !== undefined;
	const [selectedOpeningId, setSelectedOpeningId] = useState<string>();

	const [wallDeletionConflict, setWallDeletionConflict] =
		useState<WallDeletionConflict>();
	const [wallAddHostConflict, setWallAddHostConflict] =
		useState<WallAddHostConflict>();
	const [isResolvingWallAddHostConflict, setIsResolvingWallAddHostConflict] =
		useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>("plan");
	const [dimensionVisibility, setDimensionVisibility] = useState(
		defaultDrawingDimensionVisibility,
	);
	const [isDimensionFilterOpen, setIsDimensionFilterOpen] = useState(false);
	const dimensionFilterTriggerRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		setDimensionVisibility(
			loadDrawingDimensionPreferences(() =>
				drawingDimensionPreferences === undefined
					? window.localStorage.getItem(DRAWING_DIMENSION_PREFERENCES_KEY)
					: drawingDimensionPreferences.read(),
			),
		);
	}, [drawingDimensionPreferences]);
	const changeDimensionVisibility = (next: DrawingDimensionVisibility) => {
		setDimensionVisibility(next);
		saveDrawingDimensionPreferences(next, (raw) => {
			if (drawingDimensionPreferences === undefined) {
				window.localStorage.setItem(DRAWING_DIMENSION_PREFERENCES_KEY, raw);
			} else {
				drawingDimensionPreferences.write(raw);
			}
		});
	};
	const [activeTool, setActiveTool] = useState<EditorTool>("select");
	const [itemPlacementYawRadians, setItemPlacementYawRadians] = useState(0);
	const changeItemPlacementYaw = useCallback((value: number) => {
		if (Number.isFinite(value))
			setItemPlacementYawRadians(
				yawRadiansFor({ yawStep: rotationStepForYawRadians(value) }),
			);
	}, []);
	const pendingCreationRef = useRef<
		| { projectId: string; revisionId: string; baseRevisionId: string }
		| undefined
	>(undefined);
	const captureCreationBase = () => {
		pendingCreationRef.current = undefined;
		const current = controller.snapshot();
		if (current.kind === "saved")
			return {
				projectId: current.project.projectId,
				revisionId: current.revisionId,
			};
	};
	const consumeCreationSurface = () => {
		setActiveTool("select");
		setCustomGlbPlacementDraft(undefined);
		setReusedItemDefinitionId(undefined);
	};
	const settlePendingCreation = (
		base: { projectId: string; revisionId: string } | undefined,
		result: {
			readonly kind: string;
			readonly projectId?: string;
			readonly revisionId?: string;
		},
	): boolean => {
		pendingCreationRef.current = undefined;
		if (!base || controller.writerAccess().kind === "read-only") return false;
		const current = controller.snapshot();
		if (
			result.kind === "durable" &&
			current.kind === "saved" &&
			result.projectId === base.projectId &&
			current.project.projectId === base.projectId &&
			current.revisionId === result.revisionId
		) {
			consumeCreationSurface();
			return true;
		}
		if (
			result.kind !== "persist-failed" ||
			current.kind !== "persist-failed" ||
			current.project?.projectId !== base.projectId ||
			current.revisionId !== base.revisionId ||
			!("candidate" in current)
		)
			return false;
		// The controller publishes this extra status field only after accepting
		// ownership. An early pin failure can return persist-failed while its
		// snapshot is still Saved and must leave the user's placement retryable.
		const candidate = current.candidate;
		if (
			!candidate ||
			typeof candidate !== "object" ||
			!("project" in candidate) ||
			!("revision" in candidate)
		)
			return false;
		const candidateProject = candidate.project;
		const candidateRevision = candidate.revision;
		if (
			!candidateProject ||
			typeof candidateProject !== "object" ||
			!("projectId" in candidateProject) ||
			candidateProject.projectId !== base.projectId ||
			!candidateRevision ||
			typeof candidateRevision !== "object" ||
			!("revisionId" in candidateRevision) ||
			typeof candidateRevision.revisionId !== "string" ||
			candidateRevision.revisionId === base.revisionId
		)
			return false;
		pendingCreationRef.current = {
			projectId: base.projectId,
			revisionId: candidateRevision.revisionId,
			baseRevisionId: base.revisionId,
		};
		return true;
	};
	useEffect(() => {
		const pending = pendingCreationRef.current;
		if (!pending) return;
		if (
			state.kind !== "saved" &&
			state.kind !== "saving" &&
			state.kind !== "persist-failed"
		) {
			pendingCreationRef.current = undefined;
			return;
		}
		if (
			state.kind === "saved" &&
			state.project.projectId === pending.projectId &&
			state.revisionId === pending.revisionId
		) {
			pendingCreationRef.current = undefined;
			setActiveTool("select");
			setCustomGlbPlacementDraft(undefined);
			setReusedItemDefinitionId(undefined);
			return;
		}
		if (
			state.project?.projectId !== pending.projectId ||
			state.revisionId !== pending.baseRevisionId
		)
			pendingCreationRef.current = undefined;
	}, [state]);
	const [isDrawingVisible, setIsDrawingVisible] = useState(true);
	const [isEditorActionMenuOpen, setIsEditorActionMenuOpen] = useState(false);
	const [isRestartConfirmationOpen, setIsRestartConfirmationOpen] =
		useState(false);
	const [isRestartingProject, setIsRestartingProject] = useState(false);
	const [historyResourceIssueHashes, setHistoryResourceIssueHashes] = useState<
		readonly string[] | undefined
	>();
	const [
		isHistoryDiscardConfirmationOpen,
		setIsHistoryDiscardConfirmationOpen,
	] = useState(false);
	const [isDiscardingSessionHistory, setIsDiscardingSessionHistory] =
		useState(false);
	const [historyDiscardError, setHistoryDiscardError] = useState<
		string | undefined
	>();
	const [
		isProjectDeletionConfirmationOpen,
		setIsProjectDeletionConfirmationOpen,
	] = useState(false);
	const [isDeletingProject, setIsDeletingProject] = useState(false);
	const [projectDeletionError, setProjectDeletionError] = useState<
		string | undefined
	>();
	const [isPlanInspectorOpen, setIsPlanInspectorOpen] = useState(false);
	const [planDimensionError, setPlanDimensionError] = useState<
		string | undefined
	>();
	const [isRoomDirectoryOpen, setIsRoomDirectoryOpen] = useState(false);
	const [selectedRoomPropertyId, setSelectedRoomPropertyId] = useState<
		string | undefined
	>();
	const [roomPropertyFields, setRoomPropertyFields] = useState<
		RoomPropertyFields | undefined
	>();
	const [roomPropertyError, setRoomPropertyError] = useState<
		string | undefined
	>();
	const [roomPropertyConfirmation, setRoomPropertyConfirmation] = useState<
		string | undefined
	>();
	const [roomHeightOpeningConflict, setRoomHeightOpeningConflict] = useState<
		RoomHeightOpeningConflict | undefined
	>();
	const [isSelectionInspectorExpanded, setIsSelectionInspectorExpanded] =
		useState(false);
	const [itemFields, setItemFields] = useState<ItemFields>(initialItemFields);
	const [itemColorVariantDraft, setItemColorVariantDraft] = useState<
		ItemColorVariantDraft | undefined
	>();

	useEffect(() => {
		if (!itemPlacementConfirmation) return;
		const timeoutId = window.setTimeout(
			() => setItemPlacementConfirmation(undefined),
			2_800,
		);
		return () => window.clearTimeout(timeoutId);
	}, [itemPlacementConfirmation]);

	/**
	 * A selected GLB may be copied without rereading its resource bytes.  This
	 * is deliberately separate from CustomGlbPlacementDraft: a duplicate only
	 * references a definition that is already durable in this Project.
	 */
	const [reusedItemDefinitionId, setReusedItemDefinitionId] = useState<
		string | undefined
	>();

	useEffect(() => {
		if (wallMutationCorrectionState?.message === dimensionError) {
			wallMutationCorrectionActionRef.current?.focus();
		}
	}, [dimensionError, wallMutationCorrectionState]);

	useEffect(() => {
		if (isOpeningDialogOpen) {
			openingDraftWidthInputRef.current?.focus();
		}
	}, [isOpeningDialogOpen]);

	useLayoutEffect(() => {
		if (!isOpeningDialogOpen) return;
		const canvas = editorCanvasRef.current;
		const dialog = openingCreationDialogRef.current;
		if (!canvas || !dialog) return;
		const backgrounds = Array.from(canvas.children).filter(
			(child) => child !== dialog,
		);
		const previousAttributes = backgrounds.map((child) => ({
			ariaHidden: child.getAttribute("aria-hidden"),
			child,
			wasInert: child.hasAttribute("inert"),
		}));
		for (const { child } of previousAttributes) {
			child.setAttribute("aria-hidden", "true");
			child.setAttribute("inert", "");
		}
		return () => {
			for (const { ariaHidden, child, wasInert } of previousAttributes) {
				if (ariaHidden === null) child.removeAttribute("aria-hidden");
				else child.setAttribute("aria-hidden", ariaHidden);
				if (!wasInert) child.removeAttribute("inert");
			}
		};
	}, [isOpeningDialogOpen]);

	const [isBuiltInCatalogOpen, setIsBuiltInCatalogOpen] = useState(false);
	const [isPlaceholderComposerOpen, setIsPlaceholderComposerOpen] =
		useState(false);
	const [placeholderFields, setPlaceholderFields] =
		useState<ItemFields>(initialItemFields);
	const [placeholderComposerError, setPlaceholderComposerError] = useState<
		string | undefined
	>();
	const [fbxConversion, setFbxConversion] = useState<FbxConversionUiState>({
		kind: "idle",
	});
	const [customGlbImport, setCustomGlbImport] =
		useState<CustomGlbImportUiState>({
			kind: "idle",
		});
	const [customGlbPlacementDraft, setCustomGlbPlacementDraft] =
		useState<CustomGlbPlacementDraft>();
	const [customGlbLibraryDefinitions, setCustomGlbLibraryDefinitions] =
		useState<readonly CustomGlbAssetDefinition[]>([]);
	const [removedCustomGlbHashes, setRemovedCustomGlbHashes] = useState<
		readonly string[]
	>([]);
	const [customLibraryEpoch, setCustomLibraryEpoch] = useState(0);
	const customLibraryEpochRef = useRef(customLibraryEpoch);
	customLibraryEpochRef.current = customLibraryEpoch;
	const [removingCustomAssetId, setRemovingCustomAssetId] = useState<string>();
	const [customLibraryError, setCustomLibraryError] = useState<string>();
	const [customGlbResources, setCustomGlbResources] = useState<
		Readonly<Record<string, CustomGlbResource>>
	>({});
	const [customGlbResourceStates, setCustomGlbResourceStates] = useState<
		Readonly<Record<string, CustomGlbLibraryResourceState>>
	>({});
	const [customGlbResourceReloadEpoch, setCustomGlbResourceReloadEpoch] =
		useState(0);
	const [catalogPublicationState, setCatalogPublicationState] =
		useState<CatalogPublicationUiState>({ kind: "idle" });
	const [preloadedGlbCatalogAssets, setPreloadedGlbCatalogAssets] = useState<
		readonly PreloadedGlbCatalogAsset[]
	>(localPreloadedGlbCatalogAssets);
	const [catalogThumbnailUrls, setCatalogThumbnailUrls] = useState<
		Readonly<Record<string, string>>
	>({});
	const [preloadedGlbResources, setPreloadedGlbResources] = useState<
		Readonly<
			Partial<Record<PreloadedGlbCatalogAsset["id"], PreloadedGlbResourceState>>
		>
	>({});
	const [
		unavailablePreloadedCatalogThumbnails,
		setUnavailablePreloadedCatalogThumbnails,
	] = useState<ReadonlySet<PreloadedGlbCatalogAsset["id"]>>(() => new Set());
	const [catalogQuery, setCatalogQuery] = useState("");
	const [catalogCategory, setCatalogCategory] = useState<
		CatalogSection | "all" | "custom"
	>("all");
	const [selectedPreloadedCatalogAssetId, setSelectedPreloadedCatalogAssetId] =
		useState<PreloadedGlbCatalogAsset["id"] | undefined>();
	const [selectedCustomCatalogAssetId, setSelectedCustomCatalogAssetId] =
		useState<string | undefined>();
	const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
	const [selectedItemFields, setSelectedItemFields] = useState<
		ItemFields | undefined
	>();
	const [wallItemPositionFields, setWallItemPositionFields] = useState<
		Readonly<Record<string, WallItemPositionFields>>
	>({});
	const [selectedItemAngleRaw, setSelectedItemAngleRaw] = useState("0");
	const [selectedWallId, setSelectedWallId] = useState<string | undefined>();
	const skipNextNumericBlurCommitRef = useRef<boolean | HTMLInputElement>(false);
	const [wallItemDraft, setWallItemDraft] = useState<
		ParametricWallItemInput | undefined
	>();
	const [wallItemDraftFields, setWallItemDraftFields] = useState<
		WallItemDraftFields | undefined
	>();
	const [isWallMoveMode, setIsWallMoveMode] = useState(false);
	const [isWallSplitMode, setIsWallSplitMode] = useState(false);
	const [isWallVertexMoveMode, setIsWallVertexMoveMode] = useState(false);
	const [hasTransientPlanEdit, setHasTransientPlanEdit] = useState(false);
	const [
		hasTransientThreeDimensionalEdit,
		setHasTransientThreeDimensionalEdit,
	] = useState(false);
	const [vertexDeletionCandidate, setVertexDeletionCandidate] = useState<
		VertexDeletionCandidate | undefined
	>();
	const [isDeletingVertex, setIsDeletingVertex] = useState(false);
	const [viewport, setViewport] = useState<EditorViewport>(
		initialEditorViewport,
	);
	const [isTakingOverWriterLease, setIsTakingOverWriterLease] = useState(false);
	const [
		isWriterTakeoverConfirmationOpen,
		setIsWriterTakeoverConfirmationOpen,
	] = useState(false);
	const [writerTakeoverError, setWriterTakeoverError] = useState<
		string | undefined
	>();
	const [isShowingWriterRecoveryCopy, setIsShowingWriterRecoveryCopy] =
		useState(false);
	const [catalogWallModelDraft, setCatalogWallModelDraft] = useState<{
		readonly asset: PreloadedGlbCatalogAsset;
		readonly resource: CustomGlbResource;
		readonly assetDefinitionId: string;
		readonly reusesExistingDefinition: boolean;
	}>();
	useEffect(() => {
		if (!wallItemDraft) setCatalogWallModelDraft(undefined);
	}, [wallItemDraft]);
	const catalogDialogRef = useRef<HTMLElement>(null);
	const roomDirectoryDialogRef = useRef<HTMLElement>(null);
	const planInspectorRef = useRef<HTMLElement>(null);
	const roomDockActionRef = useRef<HTMLButtonElement>(null);
	const catalogSearchInputRef = useRef<HTMLInputElement>(null);
	const fbxConversionAbortRef = useRef<AbortController | undefined>(undefined);
	const customGlbImportRequestRef = useRef(0);
	const customGlbDimensionsEditedByUserRef = useRef(false);
	const customGlbPlacementRequestRef = useRef(0);
	const customGlbPlacementAbortRef = useRef<AbortController | undefined>(
		undefined,
	);
	const preloadedGlbLoadPromisesRef = useRef<
		Partial<
			Record<
				PreloadedGlbCatalogAsset["id"],
				Promise<CustomGlbResource | undefined>
			>
		>
	>({});
	const catalogPublicationAbortRef = useRef<AbortController | undefined>(
		undefined,
	);
	const preloadedGlbLoadAbortRef = useRef<
		Partial<Record<PreloadedGlbCatalogAsset["id"], AbortController>>
	>({});
	const fbxImportInputRef = useRef<HTMLInputElement>(null);
	const customGlbImportInputRef = useRef<HTMLInputElement>(null);
	const customGlbRepairInputRef = useRef<HTMLInputElement>(null);
	const projectTransferInputRef = useRef<HTMLInputElement>(null);
	const registeredTransferInputRef = useRef<HTMLInputElement>(null);
	const recoveryDraftInputRef = useRef<HTMLInputElement>(null);
	const projectTransferAbortRef = useRef<AbortController | undefined>(
		undefined,
	);
	const projectsHeadingRef = useRef<HTMLHeadingElement>(null);
	const editorHeaderMenuRef = useRef<HTMLButtonElement>(null);
	const editorActionMenuRef = useRef<HTMLDialogElement>(null);
	const editorActionDockRef = useRef<HTMLDivElement>(null);
	const selectionPropertiesTriggerRef = useRef<HTMLButtonElement>(null);
	const editorTopBarRef = useRef<HTMLElement>(null);
	const historyDiscardTriggerRef = useRef<HTMLButtonElement>(null);
	const renameProjectTriggerRef = useRef<HTMLButtonElement>(null);
	const wallAddHostConflictPanelRef = useRef<HTMLElement>(null);
	const wallDeletionConflictPanelRef = useRef<HTMLElement>(null);
	const vertexDeletionPanelRef = useRef<HTMLElement>(null);
	const wallToolButtonRef = useRef<HTMLButtonElement>(null);
	const restoreFocusRef = useRef<HTMLElement | undefined>(undefined);
	const editorCanvasRef = useRef<HTMLElement>(null);
	const openingCreationRestoreFocusRef = useRef<HTMLElement | undefined>(
		undefined,
	);
	const openingCreationActionRef = useRef<HTMLButtonElement>(null);
	const openingCreationDialogRef = useRef<HTMLElement>(null);
	useLayoutEffect(() => {
		const dialog = editorActionMenuRef.current;
		if (!isEditorActionMenuOpen || !dialog) return;
		dialog.showModal();
		dialog.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
		return () => dialog.close();
	}, [isEditorActionMenuOpen]);
	const writerAccess = controller.writerAccess();
	const isWriterLeaseReadOnly = writerAccess.kind === "read-only";
	const writerRecoveryCopy = controller.writerRecoveryCopy?.();
	const recoveryProjection = useMemo(
		() =>
			state.kind === "recovery-needed"
				? controller.recoveryReadOnlyProject?.()
				: undefined,
		[controller, state],
	);
	const project =
		isWriterLeaseReadOnly && isShowingWriterRecoveryCopy && writerRecoveryCopy
			? writerRecoveryCopy.project
			: (editorProject(state) ?? recoveryProjection);
	useEffect(() => {
		if (isWriterLeaseReadOnly) {
			pendingCreationRef.current = undefined;
			setIsRenameProjectOpen(false);
			setIsRestartConfirmationOpen(false);
			setItemColorVariantDraft(undefined);
		}
	}, [isWriterLeaseReadOnly]);
	useLayoutEffect(() => {
		if (!project?.projectId) return;
		const header = editorTopBarRef.current;
		const shell = header?.closest<HTMLElement>(
			'[data-testid="editor-workspace"]',
		);
		if (!header || !shell) return;
		const update = () =>
			shell.style.setProperty(
				"--editor-header-bottom",
				`${Math.ceil(header.getBoundingClientRect().bottom - shell.getBoundingClientRect().top)}px`,
			);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(header, { box: "border-box" });
		window.visualViewport?.addEventListener("resize", update);
		return () => {
			observer.disconnect();
			window.visualViewport?.removeEventListener("resize", update);
		};
	}, [project?.projectId]);
	const inspectorProjectIdRef = useRef(project?.projectId);
	useEffect(() => {
		// Loading/takeover may temporarily have no projected Project. Reset
		// only for a different Project; explicit navigation also resets below.
		if (
			!project?.projectId ||
			inspectorProjectIdRef.current === project.projectId
		)
			return;
		inspectorProjectIdRef.current = project.projectId;
		setIsRenameProjectOpen(false);
		setIsDimensionFilterOpen(false);
		setIsRestartConfirmationOpen(false);
		setItemColorVariantDraft(undefined);
		setWallItemDraft(undefined);
		setIsPlanInspectorOpen(false);
		setPlanDimensionError(undefined);
		setIsRoomDirectoryOpen(false);
		setRoomHeightOpeningConflict(undefined);
	}, [project?.projectId]);
	const wallAddHostConflictProjectRef = useRef(project);
	useEffect(() => {
		if (wallAddHostConflictProjectRef.current === project) return;
		wallAddHostConflictProjectRef.current = project;
		setWallAddHostConflict(undefined);
		setIsResolvingWallAddHostConflict(false);
	}, [project]);
	useEffect(() => {
		if (wallAddHostConflict && viewMode === "plan") {
			wallAddHostConflictPanelRef.current?.focus();
		}
	}, [viewMode, wallAddHostConflict]);
	useEffect(() => {
		if (wallDeletionConflict && viewMode === "plan") {
			wallDeletionConflictPanelRef.current?.focus();
		}
	}, [viewMode, wallDeletionConflict]);
	useEffect(() => {
		if (vertexDeletionCandidate && viewMode === "plan") {
			vertexDeletionPanelRef.current?.focus();
		}
	}, [viewMode, vertexDeletionCandidate]);
	const customGlbResourceManifest =
		project?.schemaVersion === 1 ? project.assetDefinitionRefs : [];
	useEffect(() => {
		let cancelled = false;
		void controller.listCustomGlbLibraryAssets().then(
			(definitions) => {
				if (!cancelled) {
					setCustomGlbLibraryDefinitions((current) =>
						mergeCustomGlbLibraryDefinitions(current, definitions),
					);
				}
			},
			() => {
				if (!cancelled) setCustomGlbLibraryDefinitions([]);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [controller]);
	useEffect(() => {
		if (!catalogGateway || preloadedGlbCatalogAssets.length === 0) {
			setCatalogThumbnailUrls({});
			return;
		}
		const abortController = new AbortController();
		const objectUrls: string[] = [];
		setCatalogThumbnailUrls({});
		void Promise.all(
			preloadedGlbCatalogAssets.map(async (asset) => {
				if (!asset.thumbnail) return;
				const result = await catalogGateway.resource(
					asset.thumbnail,
					abortController.signal,
				);
				if (abortController.signal.aborted) return;
				if (result.kind !== "available") {
					setUnavailablePreloadedCatalogThumbnails((failed) =>
						new Set(failed).add(asset.id),
					);
					return;
				}
				const thumbnailBytes = Uint8Array.from(result.bytes);
				const url = URL.createObjectURL(
					new Blob([thumbnailBytes.buffer], {
						type: asset.thumbnail.mediaType,
					}),
				);
				objectUrls.push(url);
				setCatalogThumbnailUrls((current) => ({
					...current,
					[asset.id]: url,
				}));
			}),
		);
		return () => {
			abortController.abort();
			for (const url of objectUrls) URL.revokeObjectURL(url);
		};
	}, [catalogGateway, preloadedGlbCatalogAssets]);
	useEffect(() => {
		let cancelled = false;
		void controller
			.listRemovedCustomGlbLibraryResourceHashes?.()
			.then((hashes) => {
				if (!cancelled && customLibraryEpochRef.current === customLibraryEpoch)
					setRemovedCustomGlbHashes(hashes);
			})
			.catch(() => {
				if (!cancelled)
					setCustomLibraryError(
						"Не удалось прочитать свою библиотеку. Откройте каталог снова.",
					);
			});
		return () => {
			cancelled = true;
		};
	}, [controller, customLibraryEpoch]);
	const customGlbCatalogDefinitions = useMemo(() => {
		const definitionsByHash = new Map<string, CustomGlbAssetDefinition>();
		for (const definition of customGlbLibraryDefinitions) {
			definitionsByHash.set(definition.resourceHash, definition);
		}
		for (const definition of customGlbResourceManifest) {
			// The active Project definition wins: selecting it can create another
			// instance without redundantly adding a definition to this revision.
			definitionsByHash.set(definition.resourceHash, definition);
		}
		return [...definitionsByHash.values()];
	}, [customGlbLibraryDefinitions, customGlbResourceManifest]);
	const customGlbCatalogManifestKey = customGlbCatalogDefinitions
		.map(
			({ assetDefinitionId, resourceHash }) =>
				`${assetDefinitionId}:${resourceHash}`,
		)
		.sort()
		.join("|");
	const customGlbCatalogDefinitionsRef = useRef(customGlbCatalogDefinitions);
	customGlbCatalogDefinitionsRef.current = customGlbCatalogDefinitions;
	useEffect(() => {
		let cancelled = false;
		// The manifest or an explicit local re-import is the lifecycle boundary.
		// Ordinary poses must not trigger IndexedDB reads.
		void customGlbCatalogManifestKey;
		void customGlbResourceReloadEpoch;
		const manifest = customGlbCatalogDefinitionsRef.current;
		if (manifest.length === 0) {
			setCustomGlbResources({});
			setCustomGlbResourceStates({});
			return undefined;
		}
		setCustomGlbResourceStates(
			Object.fromEntries(
				manifest.map(({ assetDefinitionId }) => [assetDefinitionId, "loading"]),
			),
		);
		void Promise.all(
			manifest.map((asset) =>
				loadLocalGlbResource(asset, {
					read: (resourceHash) => controller.readCustomGlbResource(resourceHash),
					checksum: { sha256Bytes: sha256HexForBrowserBytes },
				}),
			),
		).then((resolved) => {
			if (cancelled) return;
			setCustomGlbResources(
				Object.fromEntries(
					resolved.flatMap((resource) =>
						resource.kind === "ready"
							? [
									[
										resource.assetDefinitionId,
										{
											bytes: resource.bytes,
											resourceHash: resource.resourceHash,
										},
									] as const,
								]
							: [],
					),
				),
			);
			setCustomGlbResourceStates(
				Object.fromEntries(
					resolved.map((resource) => [
						resource.assetDefinitionId,
						resource.kind,
					]),
				),
			);
		});
		return () => {
			cancelled = true;
		};
	}, [controller, customGlbCatalogManifestKey, customGlbResourceReloadEpoch]);
	useEffect(() => {
		const verifiedProjectAssets = customGlbResourceManifest.flatMap(
			(definition) => {
				const resource = customGlbResources[definition.assetDefinitionId];
				return resource?.resourceHash === definition.resourceHash
					? [{ definition, resource }]
					: [];
			},
		);
		if (verifiedProjectAssets.length === 0) return undefined;

		let cancelled = false;
		void Promise.all(
			verifiedProjectAssets.map(({ definition, resource }) =>
				controller.registerCustomGlbLibraryAsset({
					asset: definition,
					glbBytes: resource.bytes,
				}),
			),
		).then((results) => {
			if (cancelled) return;
			const registeredAssets = results.flatMap((result) =>
				result.kind === "registered" || result.kind === "already-present"
					? [result.asset]
					: [],
			);
			if (registeredAssets.length === 0) return;
			setCustomGlbLibraryDefinitions((definitions) => {
				const definitionsByHash = new Map(
					definitions.map((definition) => [
						definition.resourceHash,
						definition,
					]),
				);
				for (const asset of registeredAssets) {
					definitionsByHash.set(asset.resourceHash, asset);
				}
				return [...definitionsByHash.values()];
			});
		});
		return () => {
			cancelled = true;
		};
	}, [controller, customGlbResourceManifest, customGlbResources]);
	const isLegacyReadOnly = isLegacyFixtureProject(project);
	const isHistoryResourceRecovery = state.kind === "history-recovery-needed";
	const isPersistenceFailure = state.kind === "persist-failed";
	const isExternalSaveFailure = isPersistenceFailure && !isRenameProjectOpen;
	useEffect(() => {
		if (state.kind !== "saved" || isWriterLeaseReadOnly) {
			setIsProjectDeletionConfirmationOpen(false);
		}
		if (state.kind !== "history-recovery-needed" || isWriterLeaseReadOnly) {
			setIsHistoryDiscardConfirmationOpen(false);
		}
	}, [state.kind, isWriterLeaseReadOnly]);
	const isEditorReadOnly =
		isLegacyReadOnly ||
		isWriterLeaseReadOnly ||
		isHistoryResourceRecovery ||
		Boolean(state.kind === "recovery-needed");
	useEffect(() => {
		if (isEditorReadOnly) {
			setOpeningDraft(undefined);
		}
	}, [isEditorReadOnly]);
	useEffect(() => {
		if (
			isRoomDirectoryOpen &&
			(isWriterLeaseReadOnly || isHistoryResourceRecovery)
		) {
			setIsRoomDirectoryOpen(false);
			setRoomHeightOpeningConflict(undefined);
			restoreFocusRef.current = undefined;
			queueMicrotask(() => editorHeaderMenuRef.current?.focus());
		}
	}, [isRoomDirectoryOpen, isWriterLeaseReadOnly, isHistoryResourceRecovery]);
	// A history-integrity notice is an urgent recovery path.  It must remain
	// actionable even if the person happened to have the optional overflow
	// sheet open when the failed history operation was detected.
	useEffect(() => {
		if (isHistoryResourceRecovery) {
			setIsEditorActionMenuOpen(false);
		}
	}, [isHistoryResourceRecovery]);
	const isHealthyOfflineStatusVisible = shouldShowHealthyOfflineStatus({
		isBrowserOnline,
		isReadOnly: isEditorReadOnly,
		stateKind: state.kind,
	});
	const selectedItem = project?.assetInstances.find(
		(item): item is EditorFloorAsset =>
			item.assetInstanceId === selectedItemId && isFloorEditorAsset(item),
	);
	const selectedItemPlacementAssessment =
		project?.schemaVersion === 1 && selectedItem
			? assessParametricFloorItemPlacement(
					project,
					selectedItem,
					selectedItem.assetInstanceId,
				)
			: undefined;
	const selectedItemPlacementWarnings =
		selectedItemPlacementAssessment?.kind === "warning"
			? selectedItemPlacementAssessment.warnings
			: [];
	const selectedItemAssetDefinitionId =
		selectedItem !== undefined && "assetDefinitionId" in selectedItem
			? selectedItem.assetDefinitionId
			: undefined;
	const selectedItemHasFixedDimensions =
		selectedItemAssetDefinitionId !== undefined;
	const selectedItemHasNoDeclaredColorVariant =
		selectedItemAssetDefinitionId !== undefined &&
		customGlbResourceManifest.some(
			(definition) =>
				definition.assetDefinitionId === selectedItemAssetDefinitionId,
		);
	const selectedItemLocked =
		project?.schemaVersion === 1 &&
		selectedItem !== undefined &&
		"locked" in selectedItem &&
		selectedItem.locked === true;
	const pendingItemColorVariant = itemColorVariantDraft
		? alphaParametricItemColorVariants.find(
				(variant) => variant.variantId === itemColorVariantDraft.variantId,
			)
		: undefined;
	const selectedWall = project?.level.wallSegments.find(
		(wall) => wall.wallSegmentId === selectedWallId,
	);
	const openingCreationDraftValidation =
		project?.schemaVersion === 1 && openingCreationDraft
			? validateOpeningCreationDraft(project, openingCreationDraft)
			: undefined;
	const openingCreationHost =
		project?.schemaVersion === 1 && openingCreationDraft
			? openingCreationHostFor(project, openingCreationDraft.wallSegmentId)
			: undefined;
	const selectedWallOpeningHost =
		project?.schemaVersion === 1 && selectedWall
			? openingCreationHostFor(project, selectedWall.wallSegmentId)
			: undefined;
	const openingCreationPreview =
		openingCreationDraftValidation?.kind === "valid"
			? openingCreationDraftValidation.input
			: undefined;
	const openingCreationDraftError =
		openingCreationDraftValidation?.kind === "invalid"
			? openingCreationDraftValidation.message
			: dimensionError;
	const canConfirmOpeningCreationDraft =
		openingCreationDraftValidation?.kind === "valid";
	const canOpenOpeningCreationDraft = selectedWallOpeningHost !== undefined;
	const selectedOpening = project?.level.openings.find(
		(opening) => opening.openingId === selectedOpeningId,
	);
	const isWallOpeningDockContext =
		viewMode === "plan" &&
		activeTool === "select" &&
		selectedWall !== undefined &&
		selectedOpening === undefined;
	const selectedWallItemDraftSource =
		wallItemDraft !== undefined &&
		wallItemDraft.wallSegmentId === selectedWall?.wallSegmentId
			? wallItemDraft
			: undefined;
	const selectedWallItemDraftCandidate = selectedWallItemDraftSource
		? wallItemDraftFromFields(selectedWallItemDraftSource, wallItemDraftFields)
		: undefined;
	const selectedWallItemDraft =
		selectedWallItemDraftCandidate ?? selectedWallItemDraftSource;
	const selectedWallItemDraftAssessment =
		project?.schemaVersion === 1 && selectedWallItemDraftCandidate !== undefined
			? assessParametricWallItemPlacement(
					project,
					selectedWallItemDraftCandidate,
				)
			: undefined;
	const selectedWallItemDraftWarning =
		selectedWallItemDraftAssessment?.kind === "accepted"
			? selectedWallItemDraftAssessment.warnings?.[0]
			: undefined;
	const selectedWallItemDraftAffectedLabel =
		selectedWallItemDraftWarning?.kind === "wall-item"
			? project?.assetInstances.find(
					(item) =>
						item.assetInstanceId ===
						selectedWallItemDraftWarning.assetInstanceId,
				)?.label
			: undefined;
	const selectedWallItemDraftError =
		selectedWallItemDraftSource === undefined
			? undefined
			: selectedWallItemDraftCandidate === undefined
				? "Укажите название, целые положительные размеры и целые миллиметры от нуля для положения настенного предмета."
				: selectedWallItemDraftAssessment?.kind === "rejected"
					? errorCopy(selectedWallItemDraftAssessment.reasonCode)
					: undefined;
	const canConfirmWallItemDraft =
		selectedWallItemDraftCandidate !== undefined &&
		selectedWallItemDraftAssessment?.kind === "accepted";
	const selectedWallItems =
		project?.schemaVersion === 1 && selectedWall
			? project.assetInstances.filter(
					(
						item,
					): item is Extract<
						Project["assetInstances"][number],
						{ readonly anchorClass: "wall" }
					> =>
						item.anchorClass === "wall" &&
						item.wallSegmentId === selectedWall.wallSegmentId,
				)
			: [];
	const selectedWallItemWarningsById = new Map<
		string,
		readonly ParametricWallItemPlacementWarning[]
	>(
		project?.schemaVersion === 1
			? selectedWallItems.map((item) => {
					const assessment = assessParametricWallItemPlacement(
						project,
						item,
						item.assetInstanceId,
					);
					return [
						item.assetInstanceId,
						assessment.kind === "accepted" ? (assessment.warnings ?? []) : [],
					] as const;
				})
			: [],
	);
	const canMoveSelectedWallWithGesture =
		project?.schemaVersion === 1 && selectedWall
			? isWallMoveGestureSupported(
					selectedWall.wallSegmentId,
					project.level.wallSegments,
					project.level.vertices,
				)
			: false;
	const movableSelectedWallVertexIds = useMemo(() => {
		if (project?.schemaVersion !== 1 || !selectedWall) return [];
		return [selectedWall.startVertexId, selectedWall.endVertexId].filter(
			(vertexId) =>
				wallVertexMoveAxisFor(
					vertexId,
					project.level.wallSegments,
					project.level.vertices,
				) !== undefined,
		);
	}, [project, selectedWall]);
	const selectedWallOpenings =
		project?.schemaVersion === 1 && selectedWall
			? project.level.openings.filter(
					(opening) => opening.wallSegmentId === selectedWall.wallSegmentId,
				)
			: [];
	const removableSelectedWallVertexIds = useMemo(() => {
		if (project?.schemaVersion !== 1 || !selectedWall) return [];
		return [selectedWall.startVertexId, selectedWall.endVertexId].filter(
			(vertexId) => isGeneralVertexDeletionEligible(project, vertexId),
		);
	}, [project, selectedWall]);
	const vertexDeletionAffectedWallItemIds = useMemo(() => {
		if (project?.schemaVersion !== 1 || !vertexDeletionCandidate) return [];
		const incidentWallIds = new Set(
			project.level.wallSegments
				.filter(
					(wall) =>
						wall.startVertexId === vertexDeletionCandidate.vertexId ||
						wall.endVertexId === vertexDeletionCandidate.vertexId,
				)
				.map((wall) => wall.wallSegmentId),
		);
		return project.assetInstances
			.filter(
				(item) =>
					item.anchorClass === "wall" &&
					incidentWallIds.has(item.wallSegmentId),
			)
			.map((item) => item.assetInstanceId)
			.sort();
	}, [project, vertexDeletionCandidate]);
	const filteredPreloadedCatalogAssets = useMemo(
		() =>
			catalogCategory === "custom"
				? []
				: filterPreloadedGlbCatalogAssets(preloadedGlbCatalogAssets, {
						query: catalogQuery,
						section: catalogCategory,
					}),
		[catalogCategory, catalogQuery, preloadedGlbCatalogAssets],
	);
	const customCatalogAssets = useMemo(
		() =>
			customCatalogAssetsFor(
				customGlbCatalogDefinitions.filter(
					(definition) =>
						!removedCustomGlbHashes.includes(definition.resourceHash),
				),
				customGlbResources,
				customGlbResourceStates,
				catalogQuery,
				catalogCategory,
			),
		[
			catalogCategory,
			catalogQuery,
			customGlbCatalogDefinitions,
			customGlbResources,
			customGlbResourceStates,
			removedCustomGlbHashes,
		],
	);
	const selectedCustomCatalogAsset = customCatalogAssets.find(
		(asset) =>
			asset.definition.assetDefinitionId === selectedCustomCatalogAssetId,
	);
	const selectedPreloadedCatalogAsset = preloadedGlbCatalogAssets.find(
		(asset) => asset.id === selectedPreloadedCatalogAssetId,
	);
	const selectedPreloadedCatalogResourceState = selectedPreloadedCatalogAsset
		? preloadedGlbResources[selectedPreloadedCatalogAsset.id]
		: undefined;
	const focusedPreloadedCatalogResourceState = selectedPreloadedCatalogAsset
		? (selectedPreloadedCatalogResourceState?.kind ?? "loading")
		: undefined;
	const selectedPreloadedCatalogThumbnailUrl =
		selectedPreloadedCatalogAsset &&
		!unavailablePreloadedCatalogThumbnails.has(selectedPreloadedCatalogAsset.id)
			? catalogThumbnailUrlFor(
					selectedPreloadedCatalogAsset,
					catalogThumbnailUrls,
				)
			: undefined;
	const isPreloadedCatalogResourcePreparing =
		selectedPreloadedCatalogAsset !== undefined &&
		(selectedPreloadedCatalogResourceState === undefined ||
			selectedPreloadedCatalogResourceState.kind === "loading");
	const isCatalogPublicationOutage =
		isBuiltInCatalogOpen &&
		(catalogPublicationState.kind === "unavailable" ||
			catalogPublicationState.kind === "invalid");
	const hasCatalogPlacementSelection =
		selectedPreloadedCatalogAsset !== undefined ||
		selectedCustomCatalogAsset !== undefined ||
		(customGlbImport.kind === "ready" &&
			!selectedPreloadedCatalogAsset &&
			!selectedCustomCatalogAsset);
	const catalogResultCount =
		filteredPreloadedCatalogAssets.length + customCatalogAssets.length;
	useEffect(() => {
		if (!isBuiltInCatalogOpen || !focusedPreloadedCatalogResourceState) return;
		catalogDialogRef.current?.focus();
	}, [focusedPreloadedCatalogResourceState, isBuiltInCatalogOpen]);
	const itemPlacementDraft = useMemo(() => {
		const source = customGlbPlacementDraft
			? {
					color: "#b8b4aa",
					depthMm: customGlbPlacementDraft.dimensions.depthMm,
					heightMm: customGlbPlacementDraft.dimensions.heightMm,
					label: customGlbPlacementDraft.displayName,
					widthMm: customGlbPlacementDraft.dimensions.widthMm,
				}
			: itemFields;
		const widthMm = positiveInteger(source.widthMm);
		const depthMm = positiveInteger(source.depthMm);
		const heightMm = positiveInteger(source.heightMm);
		const label = source.label.trim();
		return widthMm && depthMm && heightMm && label.length > 0
			? {
					color: source.color,
					yawRadians: itemPlacementYawRadians,
					yawStep: rotationStepForYawRadians(itemPlacementYawRadians),
					depthMm,
					heightMm,
					label,
					widthMm,
				}
			: undefined;
	}, [customGlbPlacementDraft, itemFields, itemPlacementYawRadians]);
	const metrics = useMemo(
		() =>
			project?.schemaVersion === 1
				? deriveRectangularRoomMetrics(project)
				: undefined,
		[project],
	);
	const derivedRooms = useMemo(() => {
		const derivedPlan = project ? derivedPlanFor(project) : undefined;
		return derivedPlan?.kind === "accepted" ? derivedPlan.plan.rooms : [];
	}, [project]);
	const editableRooms = useMemo(() => {
		if (project?.schemaVersion !== 1) return [];
		const derivedRoomIds = new Set(derivedRooms.map(({ roomId }) => roomId));
		return project.level.rooms.flatMap((room, roomIndex) =>
			derivedRoomIds.has(room.roomId)
				? [
						{
							fields: roomPropertyFieldsFor(room, roomIndex),
							room,
						},
					]
				: [],
		);
	}, [derivedRooms, project]);
	const selectedRoomProperty = editableRooms.find(
		({ room }) => room.roomId === selectedRoomPropertyId,
	);
	const threeDimensionalScene = useMemo(
		() => (project ? projectRectangularRoomForWebGl(project) : undefined),
		[project],
	);
	const threeDimensionalOrigin = useMemo(() => {
		if (!project || project.level.vertices.length === 0) return undefined;
		return {
			xMm: Math.min(...project.level.vertices.map((vertex) => vertex.xMm)),
			zMm: Math.min(...project.level.vertices.map((vertex) => vertex.zMm)),
		};
	}, [project]);
	const planCharacteristics = useMemo(() => {
		if (!project || project.level.vertices.length === 0) {
			return undefined;
		}
		const xs = project.level.vertices.map((vertex) => vertex.xMm);
		const zs = project.level.vertices.map((vertex) => vertex.zMm);
		return {
			depthMm: Math.max(...zs) - Math.min(...zs),
			heightMm: Math.max(
				0,
				...roomMetadataFor(project).map((room) => room.heightMm),
			),
			widthMm: Math.max(...xs) - Math.min(...xs),
		};
	}, [project]);
	const threeDimensionalMeasurements = metrics ?? planCharacteristics;
	const isWorking = state.kind === "loading" || state.kind === "saving";
	const hasRetainedHistoryTarget = isNavigationProtected && state.kind === "saved" && controller.pendingPublicationIdentity?.() !== undefined;
 const isMutationBlocked = isWorking || isPersistenceFailure || hasRetainedHistoryTarget || isLegacyOwnerReadOnly(editorStorageNamespace);
	useEffect(() => {
		if (!isWorking) return;
		if (isRoomDirectoryOpen) roomDirectoryDialogRef.current?.focus();
		else if (isPlanInspectorOpen) planInspectorRef.current?.focus();
	}, [isRoomDirectoryOpen, isPlanInspectorOpen, isWorking]);
	const isItemPlacementActive =
		activeTool === "item" && itemPlacementDraft !== undefined;
	// Both views expose placement identity and cancellation from the first choice.
	const isItemPlacementSurfaceActive = isItemPlacementActive;
	const isEditorDockVisible =
		!isItemPlacementSurfaceActive && openingCreationDraft === undefined;
	useLayoutEffect(() => {
		if (!project?.projectId || !isEditorDockVisible) return;
		const dock = editorActionDockRef.current?.closest<HTMLElement>("nav");
		const shell = dock?.closest<HTMLElement>(
			'[data-testid="editor-workspace"]',
		);
		if (!dock || !shell) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			const bounds = dock.getBoundingClientRect();
			if (bounds.height > 0) {
				const inset = `${Math.ceil(Math.max(0, shell.getBoundingClientRect().bottom - bounds.top))}px`;
				if (shell.style.getPropertyValue("--editor-dock-inset") !== inset) {
					shell.style.setProperty("--editor-dock-inset", inset);
				}
			}
		};
		const scheduleUpdate = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		const observer = new ResizeObserver(scheduleUpdate);
		observer.observe(dock, { box: "border-box" });
		observer.observe(shell, { box: "border-box" });
		window.visualViewport?.addEventListener("resize", scheduleUpdate);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			window.visualViewport?.removeEventListener("resize", scheduleUpdate);
		};
	}, [project?.projectId, isEditorDockVisible]);
	const recoveryRemovalSummary =
		state.kind === "recovery-needed"
			? controller.recoveryCustomGlbRemovalSummary()
			: undefined;
	const hasUndurableEditorDraft =
        hasRetainedHistoryTarget ||
		hasTransientPlanEdit ||
		hasTransientThreeDimensionalEdit ||
		(activeTool === "item" && itemPlacementDraft !== undefined) ||
		wallItemDraft !== undefined ||
		openingCreationDraft !== undefined ||
		openingDraft !== undefined ||
		wallAddHostConflict !== undefined ||
		wallDeletionConflict !== undefined ||
		vertexDeletionCandidate !== undefined ||
		roomHeightOpeningConflict !== undefined;
	const hasRawRenameDraft = isRenameProjectOpen && renameProjectName !== project?.name;
	const hasRawSelectedItemDraft = !!selectedItem && !!selectedItemFields && (
		selectedItemFields.widthMm !== String(selectedItem.widthMm) || selectedItemFields.depthMm !== String(selectedItem.depthMm) || selectedItemFields.heightMm !== String(selectedItem.heightMm) || selectedItemFields.label !== selectedItem.label || selectedItemFields.color !== selectedItem.color || selectedItemAngleRaw !== degreesForYawRadians(yawRadiansForEditorFloorAsset(selectedItem))
	);
	const hasRawRoomPropertyDraft = isRoomDirectoryOpen && !!roomPropertyFields && !!selectedRoomProperty && (
		roomPropertyFields.heightMm !== selectedRoomProperty.fields.heightMm || roomPropertyFields.type !== selectedRoomProperty.fields.type || roomPropertyFields.name !== selectedRoomProperty.fields.name
	);
	const hasRawProjectNameDraft = state.kind === "first-run" && name !== "";
	const baselineDimensions = dimensionsFrom(metrics);
	const hasRawDimensionDraft = !!project && (dimensions.widthMm !== baselineDimensions.widthMm || dimensions.depthMm !== baselineDimensions.depthMm || dimensions.heightMm !== baselineDimensions.heightMm);
	const hasRawPlaceholderDraft = isPlaceholderComposerOpen && (placeholderFields.label !== itemFields.label || placeholderFields.widthMm !== itemFields.widthMm || placeholderFields.depthMm !== itemFields.depthMm || placeholderFields.heightMm !== itemFields.heightMm || placeholderFields.color !== itemFields.color);
	const hasRawWallPositionDraft = (project?.assetInstances ?? []).some((item) => {
		if (item.anchorClass !== "wall") return false;
		const fields = wallItemPositionFields[item.assetInstanceId];
		return fields !== undefined && (fields.offsetMm !== String(item.offsetMm) || fields.elevationMm !== String(item.elevationMm));
	});
	const hasRawCustomImportDraft = customGlbImport.kind === "ready" || customGlbImport.kind === "checking" || fbxConversion.kind === "converting";
	const hasRawEditorDraft = hasRawRenameDraft || hasRawSelectedItemDraft || hasRawRoomPropertyDraft || hasRawProjectNameDraft || hasRawDimensionDraft || hasRawPlaceholderDraft || hasRawWallPositionDraft || hasRawCustomImportDraft || itemColorVariantDraft !== undefined;
	const editorSaveState =
		state.kind === "saving"
			? "Сохраняем…"
            : hasRetainedHistoryTarget ? "Правка не сохранена"
			: state.kind === "saved" && (isItemPlacementActive || (fullTransientNavigationProtection && (hasRawEditorDraft || hasUndurableEditorDraft)))
				? "Предпросмотр — не сохранено"
				: state.kind === "saved"
					? "Сохранено"
					: statusCopy(state);

	useEffect(() => {
		if (!hostNavigation) return;
		try {
			hostNavigation.setClosingConfirmation?.(hasUndurableEditorDraft || hasRawEditorDraft || writerRecoveryCopy !== undefined || isTakingOverWriterLease || !!leaveFocus || state.kind === "saving" || state.kind === "persist-failed" || projectTransferImport.kind !== "idle");
			hostNavigation.setVerticalSwipesEnabled?.(!project);
		} catch { /* Unsupported host capabilities never change Project state. */ }
	}, [hostNavigation, hasUndurableEditorDraft, hasRawEditorDraft, writerRecoveryCopy, isTakingOverWriterLease, leaveFocus, project, state.kind, projectTransferImport.kind]);
	const canActivatePwaUpdate =
		(state.kind === "saved" ||
			state.kind === "first-run" ||
			state.kind === "projects") &&
		!hasUndurableEditorDraft;
	const wallThicknessMm = DEFAULT_DRAW_WALL_THICKNESS_MM;
	const sessionHistory = controller.sessionHistory();
	const sessionHistoryCommandLabels =
		controller.sessionHistoryCommandLabels?.();
	const undoActionLabel =
		sessionHistoryCommandLabels?.undoActionLabel ?? "Отменить действие";
	const redoActionLabel =
		sessionHistoryCommandLabels?.redoActionLabel ?? "Повторить действие";
	const canReturnToDrawing =
		project !== undefined &&
		project.level.wallSegments.length > 0 &&
		!isDrawingVisible;
	const drawingCompassDegrees =
		viewport.panX === 0 && viewport.panY === 0
			? 0
			: (Math.atan2(viewport.panX, -viewport.panY) * 180) / Math.PI;

	useEffect(() => {
		const unsubscribe = controller.subscribe(setState);
		// Close the render-to-subscribe gap before startup or a keyed remount.
		setState(controller.snapshot());
		void controller.open();
		return unsubscribe;
	}, [controller]);

	useEffect(() => {
		const reportBrowserOnline = () => setIsBrowserOnline(true);
		const reportBrowserOffline = () => setIsBrowserOnline(false);
		setIsBrowserOnline(navigator.onLine !== false);
		window.addEventListener("online", reportBrowserOnline);
		window.addEventListener("offline", reportBrowserOffline);
		return () => {
			window.removeEventListener("online", reportBrowserOnline);
			window.removeEventListener("offline", reportBrowserOffline);
		};
	}, []);

	useEffect(() => {
		if (state.kind === "saved") {
			void controller.refreshSessionHistoryIntegrity();
		}
	}, [controller, state.kind]);

	useEffect(() => {
		const refreshHistoryIntegrityAfterResume = () => {
			if (document.visibilityState !== "hidden") {
				void controller.refreshSessionHistoryIntegrity();
			}
		};
		document.addEventListener(
			"visibilitychange",
			refreshHistoryIntegrityAfterResume,
		);
		return () =>
			document.removeEventListener(
				"visibilitychange",
				refreshHistoryIntegrityAfterResume,
			);
	}, [controller]);

	useEffect(() => {
		let refreshInFlight = false;
		const refreshWriterAfterResume = () => {
			if (document.visibilityState === "hidden" || refreshInFlight) return;
			refreshInFlight = true;
			void controller
				.refreshWriterLeaseAccess()
				.finally(() => (refreshInFlight = false));
		};
		document.addEventListener("visibilitychange", refreshWriterAfterResume);
		window.addEventListener("focus", refreshWriterAfterResume);
		const heartbeat = window.setInterval(
			refreshWriterAfterResume,
			WRITER_LEASE_HEARTBEAT_MS,
		);
		return () => {
			window.clearInterval(heartbeat);
			document.removeEventListener(
				"visibilitychange",
				refreshWriterAfterResume,
			);
			window.removeEventListener("focus", refreshWriterAfterResume);
		};
	}, [controller]);

	useEffect(() => {
		let active = true;
		const refreshStoragePressure = () => {
			void controller.storagePressure().then((pressure) => {
				if (!active) return;
				setStoragePressure(pressure);
				setHasCheckedStoragePressure(true);
			});
		};
		const refreshAfterResume = () => {
			if (document.visibilityState !== "hidden") refreshStoragePressure();
		};
		refreshStoragePressure();
		document.addEventListener("visibilitychange", refreshAfterResume);
		return () => {
			active = false;
			document.removeEventListener("visibilitychange", refreshAfterResume);
		};
	}, [controller]);

	useEffect(() => {
		setDimensions(dimensionsFrom(metrics));
	}, [metrics]);

	useEffect(() => {
		if (!selectedItem) {
			setSelectedItemFields(undefined);
			setSelectedItemAngleRaw("0");
			return;
		}
		setSelectedItemFields({
			color: selectedItem.color,
			depthMm: String(selectedItem.depthMm),
			heightMm: String(selectedItem.heightMm),
			label: selectedItem.label,
			widthMm: String(selectedItem.widthMm),
		});
		setSelectedItemAngleRaw(
			degreesForYawRadians(yawRadiansForEditorFloorAsset(selectedItem)),
		);
	}, [selectedItem]);

	useEffect(() => {
		setWallItemPositionFields(
			Object.fromEntries(
				(project?.assetInstances ?? [])
					.filter(
						(
							item,
						): item is Extract<
							Project["assetInstances"][number],
							{ readonly anchorClass: "wall" }
						> => item.anchorClass === "wall",
					)
					.map((item) => [
						item.assetInstanceId,
						{
							elevationMm: String(item.elevationMm),
							offsetMm: String(item.offsetMm),
						},
					]),
			),
		);
	}, [project]);

	useEffect(() => {
		if (
			!isBuiltInCatalogOpen ||
			!window.matchMedia("(min-width: 600px)").matches
		) {
			return;
		}
		catalogSearchInputRef.current?.focus();
	}, [isBuiltInCatalogOpen]);

	useEffect(() => {
		if (
			!renameTargetProjectId ||
			state.kind !== "saved" ||
			project?.projectId !== renameTargetProjectId
		) {
			return;
		}
		setRenameProjectName(project.name);
		setRenameProjectError(undefined);
		setIsRenameProjectOpen(true);
		setRenameTargetProjectId(undefined);
	}, [project, renameTargetProjectId, state.kind]);

	useEffect(() => {
		if (state.kind !== "projects") return;
		queueMicrotask(() => projectsHeadingRef.current?.focus());
	}, [state.kind]);

	const submitProject = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setNameError(undefined);
		const result = await controller.create(name);
		if (result.kind === "rejected") {
			setNameError(projectNameErrorCopy(result.reasonCode));
		}
	};

	const importProjectTransferFile = async (file: File | undefined, registered = false) => {
		setProjectTransferError(undefined);
		if (!file || projectTransferImport.kind !== "idle") return;
		const abortController = new AbortController();
		projectTransferAbortRef.current = abortController;
		setProjectTransferImport({ filename: file.name, kind: "reading" });
		try {
			if (file.size > 200 * 1024 * 1024) {
				setProjectTransferError(projectTransferImportFeedback("BACKUP_LIMIT_EXCEEDED"));
				return;
			}
			const read = fileTransfer ? await fileTransfer.read(file, abortController.signal) : undefined;
			if (read && read.kind !== "read") {
				setProjectTransferError(read.kind === "cancelled" ? projectTransferImportFeedback("BACKUP_CANCELLED") : "Не удалось прочитать файл. Существующие проекты не изменены.");
				return;
			}
			const bytes = read?.kind === "read" ? read.bytes : new Uint8Array(await file.arrayBuffer());
			if (abortController.signal.aborted) {
				setProjectTransferError(
					projectTransferImportFeedback("PORTABLE_BACKUP_CANCELLED"),
				);
				return;
			}
			const importOptions = {
				onPortableStatus: (status: ImportPortableBackupStatus) => {
					if (
						status.kind === "validating" ||
						status.kind === "checking-render" ||
						status.kind === "saving"
					) {
						setProjectTransferImport({
							filename: file.name,
							kind: status.kind,
						});
					} else if (status.kind === "staging-resources") {
						setProjectTransferImport({
							completed: status.completed,
							filename: file.name,
							kind: status.kind,
							total: status.total,
						});
					}
				},
				signal: abortController.signal,
			};
			const result = registered
				? await controller.importRegisteredPortableBackup(bytes, { onStatus: importOptions.onPortableStatus, signal: abortController.signal })
				: await controller.importProjectTransfer(bytes, importOptions);
			if (result.kind === "rejected") {
				setProjectTransferError(
					projectTransferImportFeedback(result.reasonCode),
				);
				return;
			}
			if (result.kind !== "durable") {
				setProjectTransferError(
					result.kind === "verification-unavailable"
						? projectTransferImportFeedback(result.kind)
						: "Не удалось импортировать проект. Существующие проекты не изменены.",
				);
			}
		} catch {
			setProjectTransferError(
				"Не удалось прочитать файл. Существующие проекты не изменены.",
			);
		} finally {
			if (projectTransferAbortRef.current === abortController) {
				projectTransferAbortRef.current = undefined;
			}
			setProjectTransferImport({ kind: "idle" });
			if (projectTransferInputRef.current) {
				projectTransferInputRef.current.value = "";
			}
			if (registeredTransferInputRef.current) registeredTransferInputRef.current.value = "";
		}
	};

	const downloadRecoveryDraft = async () => {
		setProjectTransferError(undefined);
		if (localFileSession) {
			await localFileSession.prepare(async () => {
				const result = await controller.exportRecoveryDraft();
				return result.kind === "ready" ? { bytes: result.bytes, filename: result.filename, fileKind: "recovery-draft" } : undefined;
			});
			return;
		}
		try {
			const result = await controller.exportRecoveryDraft();
			if (result.kind !== "ready") {
				setProjectTransferError(
					"Не удалось подготовить несохранённую правку. Повторите попытку.",
				);
				return;
			}
			const url = URL.createObjectURL(
				new Blob([result.bytes.slice().buffer], { type: result.mimeType }),
			);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = result.filename;
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch {
			setProjectTransferError("Не удалось скачать несохранённую правку.");
		}
	};
	const restoreRecoveryDraftFile = async (file: File | undefined) => {
		if (!file) return;
		setProjectTransferError(undefined);
		if (file.size > 280 * 1024 * 1024) {
			setProjectTransferError("Файл восстановления слишком велик.");
			return;
		}
		const abortController = new AbortController();
		projectTransferAbortRef.current = abortController;
		setProjectTransferImport({ kind: "validating", filename: file.name });
		try {
			const result = await controller.importRecoveryDraft(
				new Uint8Array(await file.arrayBuffer()),
				{
					signal: abortController.signal,
					onStatus: (status) => {
						if (
							status.kind === "saving" ||
							status.kind === "validating" ||
							status.kind === "checking-render"
						)
							setProjectTransferImport({
								kind: status.kind,
								filename: file.name,
							});
					},
				},
			);
			if (
				result.kind === "rejected" &&
				result.reasonCode === "PORTABLE_BACKUP_CANCELLED"
			)
				return;
			if (result.kind !== "durable")
				setProjectTransferError(
					result.kind === "rejected" &&
						result.reasonCode === "RECOVERY_DRAFT_INCOMPLETE"
						? "В файле не хватает точных моделей. Сохраните исходный файл и восстановите модели из оригиналов."
						: "Не удалось восстановить правку. Исходные проекты остались без изменений.",
				);
		} catch {
			setProjectTransferError("Не удалось прочитать файл восстановления.");
		} finally {
			if (projectTransferAbortRef.current === abortController)
				projectTransferAbortRef.current = undefined;
			setProjectTransferImport({ kind: "idle" });
		}
	};
	const repairFromPortableBackup = async (file: File | undefined) => {
		if (!file || isRepairingCustomGlb) return;
		setCustomGlbRepairError(undefined);
		if (file.size > 200 * 1024 * 1024) {
			setCustomGlbRepairError("Резервная копия превышает допустимый размер.");
			return;
		}
		setIsRepairingCustomGlb(true);
		try {
			const result = await controller.repairResourcesFromPortableBackup(
				new Uint8Array(await file.arrayBuffer()),
			);
			if (result.kind === "rejected")
				setCustomGlbRepairError(
					"Эта копия не содержит всех нужных точных моделей или не прошла проверку.",
				);
			else if (result.kind === "persist-failed")
				setCustomGlbRepairError(
					"Не удалось сохранить восстановленные модели. Повторите попытку.",
				);
		} catch {
			setCustomGlbRepairError("Не удалось прочитать резервную копию.");
		} finally {
			setIsRepairingCustomGlb(false);
		}
	};

	const cancelProjectTransferImport = () => {
		const abortController = projectTransferAbortRef.current;
		if (!abortController || projectTransferImport.kind === "saving") return;
		abortController.abort();
		if (projectTransferImport.kind !== "idle") {
			setProjectTransferImport({
				filename: projectTransferImport.filename,
				kind: "cancelling",
			});
		}
	};

	const repairCustomGlbResourceFiles = async (fileList: FileList | null) => {
		const files = Array.from(fileList ?? []);
		if (files.length === 0 || isRepairingCustomGlb) return;
		setCustomGlbRepairError(undefined);
		setIsRepairingCustomGlb(true);
		try {
			const bounded = isEmbeddedHost ? await readBoundedLocalGlbFiles(files, "exact-repair") : undefined;
			if (bounded?.kind === "rejected") {
				setCustomGlbRepairError("Выбранный набор GLB превышает допустимые ограничения. Проект не изменён.");
				return;
			}
			const result = await controller.repairCustomGlbResources(bounded?.bytes ?? await Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer()))));
			if (result.kind === "rejected") {
				setCustomGlbRepairError(
					"Нужен точный набор исходных GLB для восстановления: по одному файлу для каждой недоступной модели.",
				);
				return;
			}
			if (result.kind === "repaired") {
				setCustomGlbRepairError(
					"Набор записан, но проверка проекта всё ещё требует точные исходные GLB. Повторите выбор полного набора.",
				);
				return;
			}
			if (result.kind !== "recovered") {
				setCustomGlbRepairError(
					"Не удалось записать проверенный GLB. Проект не изменён — повторите попытку.",
				);
			}
		} catch {
			setCustomGlbRepairError(
				"Не удалось прочитать файлы. Проект не изменён — выберите исходные GLB для восстановления повторно.",
			);
		} finally {
			setIsRepairingCustomGlb(false);
			if (customGlbRepairInputRef.current) {
				customGlbRepairInputRef.current.value = "";
			}
		}
	};

	const removeUnresolvedCustomGlbReferences = async () => {
		if (isRemovingUnresolvedCustomGlb) return;
		setRecoveryRemovalError(undefined);
		setIsRemovingUnresolvedCustomGlb(true);
		try {
			const result = await controller.removeUnresolvedCustomGlbReferences();
			if (result.kind === "durable") {
				setIsRecoveryRemovalConfirmationOpen(false);
				return;
			}
			setIsRecoveryRemovalConfirmationOpen(false);
			setRecoveryRemovalError(
				result.kind === "stale-recovery"
					? "Состав недоступных моделей изменился. Проверьте обновлённый список и подтвердите действие снова."
					: result.kind === "writer-lease-lost"
						? "Другое окно получило право записи. Перехватите редактирование или вернитесь к исходным GLB."
						: result.kind === "reopen-failed"
							? "Новая версия сохранена, но повторная проверка не завершилась. Проект остаётся в режиме восстановления."
							: "Не удалось удалить недоступные модели. Проект и исходная версия не изменены.",
			);
		} catch {
			setRecoveryRemovalError(
				"Не удалось удалить недоступные модели. Проект и исходная версия не изменены.",
			);
		} finally {
			setIsRemovingUnresolvedCustomGlb(false);
		}
	};

	const registeredTransferFileInput = registeredTransferImport ? <input type="file" accept="application/zip,.interiors" aria-label="Импорт файла для переноса" hidden ref={registeredTransferInputRef} disabled={projectTransferImport.kind !== "idle"} onChange={(event) => void importProjectTransferFile(event.currentTarget.files?.[0], true)} /> : null;

	const exportProjectTransfer = async (projectId?: string, registered = false, storageNamespace?: ProjectStorageNamespace) => {
		setProjectTransferError(undefined);
		const prepare = (signal?: AbortSignal) => {
			const options = storageNamespace === undefined ? { signal } : { signal, storageNamespace };
			return registered ? controller.exportRegisteredProjectTransfer(projectId, options) : controller.exportProjectTransfer(projectId, options);
		};
		if (localFileSession) {
			setIsEditorActionMenuOpen(false);
			await localFileSession.prepare(async (signal) => {
				const result = await prepare(signal);
				return result.kind === "ready" ? { bytes: result.bytes, filename: result.filename, fileKind: "portable-backup" } : undefined;
			});
			return;
		}
		try {
			const result = await prepare();
			if (result.kind !== "ready") {
				setProjectTransferError(
					result.kind === "rejected" &&
						result.reasonCode === "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE"
						? "Точные байты одной из моделей недоступны, поэтому файл проекта не создан. Сначала восстановите исходную модель."
						: "Не удалось подготовить файл проекта. Проект не изменён. Повторите попытку.",
				);
				return;
			}
			const bytes = new Uint8Array(result.bytes.byteLength);
			bytes.set(result.bytes);
			const blob = new Blob([bytes.buffer], { type: result.mimeType });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.download = result.filename;
			anchor.href = url;
			anchor.click();
			queueMicrotask(() => URL.revokeObjectURL(url));
		} catch {
			setProjectTransferError(
				"Не удалось подготовить файл проекта. Повторите попытку.",
			);
		}
	};

	const openRenameProject = () => {
		if (!project || isMutationBlocked || isEditorReadOnly) return;

		setRenameProjectName(project.name);
		setRenameProjectError(undefined);
		setIsRenameProjectOpen(true);
	};

	const cancelRenameProject = () => {
		setIsRenameProjectOpen(false);
		setRenameProjectError(undefined);
	};

	const renameProjectFromDirectory = (projectId: string, storageNamespace?: ProjectStorageNamespace) => {
		setRenameTargetProjectId(projectId);
		if (storageNamespace === undefined) void controller.openProject(projectId);
		else void controller.openProject(projectId, { storageNamespace, initialAction: "rename" });
	};

	const submitRenameProject = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isMutationBlocked || isEditorReadOnly) return;
		setRenameProjectError(undefined);
		const result = await controller.renameProject(renameProjectName);
		if (result.kind === "durable") {
			setIsRenameProjectOpen(false);
			return;
		}
		if (result.kind === "rejected") {
			setRenameProjectError(projectNameErrorCopy(result.reasonCode));
			return;
		}
		if (result.kind === "stale-base") {
			setRenameProjectError(
				"Проект изменился в другом окне. Вернитесь к проектам и откройте актуальную версию.",
			);
			return;
		}
		if (result.kind === "persist-failed") {
			setRenameProjectError(renamePersistenceFailureCopy(result.reasonCode));
			return;
		}
		setRenameProjectError("Проект ещё открывается. Повторите попытку.");
	};

	const retryRenameProjectPublication = async () => {
		await controller.retry();
		if (controller.snapshot().kind === "saved") {
			setIsRenameProjectOpen(false);
			setRenameProjectError(undefined);
		}
	};

	const createContour = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isEditorReadOnly || isMutationBlocked) return;
		setDimensionError(undefined);
		const creationBase = captureCreationBase();
		const result = await controller.configureRectangularRoom(dimensions);
		settlePendingCreation(creationBase, result);
		if (result.kind === "rejected") {
			pendingCreationRef.current = undefined;
			setDimensionError(errorCopy(result.reasonCode));
		}
	};

	const chooseRoomProperty = (roomId: string) => {
		if (isMutationBlocked || roomHeightOpeningConflict) return;
		const selected = editableRooms.find(({ room }) => room.roomId === roomId);
		if (!selected) return;
		setSelectedRoomPropertyId(roomId);
		setRoomPropertyFields(selected.fields);
		setRoomPropertyError(undefined);
		setRoomPropertyConfirmation(undefined);
		setRoomHeightOpeningConflict(undefined);
	};

	const openRoomDirectory = () => {
		const firstRoom = editableRooms[0];
		if (!firstRoom) return;
		restoreFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		setSelectedRoomPropertyId(firstRoom.room.roomId);
		setRoomPropertyFields(firstRoom.fields);
		setRoomPropertyError(undefined);
		setRoomPropertyConfirmation(undefined);
		setRoomHeightOpeningConflict(undefined);
		setIsRoomDirectoryOpen(true);
		queueMicrotask(() => roomDirectoryDialogRef.current?.focus());
	};

	const closeRoomDirectory = () => {
		if (isWorking) return;
		setIsRoomDirectoryOpen(false);
		setRoomPropertyError(undefined);
		setRoomPropertyConfirmation(undefined);
		setRoomHeightOpeningConflict(undefined);
		const restoreTarget = restoreFocusRef.current;
		restoreFocusRef.current = undefined;
		queueMicrotask(() => {
			const visibleTarget =
				restoreTarget?.isConnected &&
				getComputedStyle(restoreTarget).opacity !== "0"
					? restoreTarget
					: (roomDockActionRef.current ?? editorHeaderMenuRef.current);
			visibleTarget?.focus();
		});
	};

	const trapRoomDirectoryFocus = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			if (isNavigationProtected) requestEditorBack(false, closeRoomDirectory); else closeRoomDirectory();
			return;
		}
		if (event.key !== "Tab") return;
		const focusable = Array.from(
			event.currentTarget.querySelectorAll<HTMLElement>(
				"button:not([disabled]), input:not([disabled]), select:not([disabled])",
			),
		);
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) {
			event.preventDefault();
			event.currentTarget.focus();
			return;
		}
		const isContainerFocused = document.activeElement === event.currentTarget;
		if (
			event.shiftKey &&
			(document.activeElement === first || isContainerFocused)
		) {
			event.preventDefault();
			last.focus();
			return;
		}
		if (
			!event.shiftKey &&
			(document.activeElement === last || isContainerFocused)
		) {
			event.preventDefault();
			first.focus();
		}
	};

	const openPlanInspector = () => {
		setIsEditorActionMenuOpen(false);
		setIsPlanInspectorOpen(true);
		setPlanDimensionError(undefined);

		queueMicrotask(() => planInspectorRef.current?.focus());
	};
	const closePlanInspector = () => {
		setIsPlanInspectorOpen(false);
		setPlanDimensionError(undefined);
		queueMicrotask(() => editorHeaderMenuRef.current?.focus());
	};

	const saveRoomProperties = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (
			!selectedRoomProperty ||
			!roomPropertyFields ||
			project?.schemaVersion !== 1 ||
			isEditorReadOnly ||
			isMutationBlocked
		) {
			return;
		}
		setRoomPropertyError(undefined);
		setRoomPropertyConfirmation(undefined);
		const input: UpdateRoomPropertiesInput = {
			heightMm: Number(roomPropertyFields.heightMm),
			roomId: selectedRoomProperty.room.roomId,
			type: roomPropertyFields.type,
		};
		const preview = previewRoomHeightOpeningConflict(project, input);
		if (preview.kind === "rejected") {
			setRoomPropertyFields(selectedRoomProperty.fields);
			setRoomPropertyError(errorCopy(preview.reasonCode));
			return;
		}
		if (preview.kind === "conflict") {
			setRoomHeightOpeningConflict({
				input,
				openingIds: preview.openingIds,
				resolutions: {},
			});
			return;
		}
		const result = await controller.updateRoomProperties(input);
		if (result.kind === "durable") {
			setRoomPropertyConfirmation("Помещение сохранено локально.");
			return;
		}
		// The validated input is still the controller's pending change. Keep
		// these fields intact while the save-failure surface owns retry.
		if (result.kind === "persist-failed") return;
		setRoomPropertyFields(selectedRoomProperty.fields);
		if (result.kind === "rejected") {
			setRoomPropertyError(errorCopy(result.reasonCode));
			return;
		}
		setRoomPropertyError(
			result.kind === "in-progress"
				? "Дождитесь завершения текущего сохранения и повторите попытку."
				: "Проект ещё открывается. Повторите попытку.",
		);
	};

	const chooseRoomHeightOpeningResolution = (
		openingId: string,
		resolution: "delete" | "resize",
	) => {
		setRoomHeightOpeningConflict((conflict) =>
			conflict?.openingIds.includes(openingId)
				? {
						...conflict,
						resolutions: {
							...conflict.resolutions,
							[openingId]: resolution,
						},
					}
				: conflict,
		);
	};

	const cancelRoomHeightOpeningConflict = () => {
		setRoomHeightOpeningConflict(undefined);
		setRoomPropertyFields(selectedRoomProperty?.fields);
		setRoomPropertyError(undefined);
		setRoomPropertyConfirmation(undefined);
	};

	const resolveRoomHeightOpeningConflict = async () => {
		const conflict = roomHeightOpeningConflict;
		if (
			!conflict ||
			project?.schemaVersion !== 1 ||
			isEditorReadOnly ||
			isMutationBlocked
		) {
			return;
		}
		const openingResolutions = conflict.openingIds.flatMap(
			(openingId): readonly RoomHeightOpeningResolution[] => {
				const resolution = conflict.resolutions[openingId];
				if (resolution === "delete") {
					return [{ kind: "delete", openingId }];
				}
				const opening = project.level.openings.find(
					(candidate) => candidate.openingId === openingId,
				);
				const heightMm = opening ? conflict.input.heightMm - opening.sillMm : 0;
				return resolution === "resize" && heightMm > 0
					? [{ heightMm, kind: "resize", openingId }]
					: [];
			},
		);
		if (openingResolutions.length !== conflict.openingIds.length) return;

		setRoomPropertyError(undefined);
		setRoomPropertyConfirmation(undefined);
		const result = await controller.resolveRoomHeightOpeningConflict({
			...conflict.input,
			openingResolutions,
		});
		if (result.kind === "durable") {
			setRoomHeightOpeningConflict(undefined);
			setRoomPropertyFields({
				heightMm: String(conflict.input.heightMm),
				name:
					roomPropertyFields?.name ?? selectedRoomProperty?.fields.name ?? "",
				type: conflict.input.type as RoomType,
			});
			setRoomPropertyConfirmation("Помещение и проёмы сохранены локально.");
			return;
		}
		setRoomHeightOpeningConflict(undefined);
		// The confirmed room/opening change remains pending in the controller.
		// Preserve its form values while the external save notice owns retry.
		if (result.kind === "persist-failed") return;
		setRoomPropertyFields(selectedRoomProperty?.fields);
		setRoomPropertyError(
			result.kind === "rejected"
				? errorCopy(result.reasonCode)
				: result.kind === "in-progress"
					? "Дождитесь завершения текущего сохранения и повторите попытку."
					: "Проект ещё открывается. Повторите попытку.",
		);
	};

	const applyPlanDimensions = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (
			!metrics ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		setPlanDimensionError(undefined);
		pendingCreationRef.current = undefined;
		const result = await controller.configureRectangularRoom(dimensions);
		if (result.kind === "rejected") {
			setPlanDimensionError(errorCopy(result.reasonCode));
		}
	};

	const drawWall = async (input: AddWallSegmentInput): Promise<boolean> => {
		if (
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed" ||
			wallAddHostConflict !== undefined
		) {
			return false;
		}
		setDimensionError(undefined);
		setWallMutationCorrectionState(undefined);
		if (project?.schemaVersion === 1) {
			const preview = previewWallAddHostConflict(project, input);
			if (preview.kind === "conflict") {
				setWallAddHostConflict({
					input,
					itemIds: preview.itemIds,
					openingIds: preview.openingIds,
				});
				return true;
			}
		}
		const creationBase = captureCreationBase();
		const result = await controller.addGeneralWall(input);
		const acceptedCreation = settlePendingCreation(creationBase, result);
		if (result.kind === "rejected") {
			pendingCreationRef.current = undefined;
			showWallMutationRejection(result);
			return false;
		}
		if (result.kind === "durable") {
			setSelectedItemId(undefined);
			setSelectedWallId(undefined);
			setSelectedOpeningId(undefined);
		}
		return acceptedCreation;
	};

	const resolveWallAddHostConflict = async () => {
		if (
			!wallAddHostConflict ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed" ||
			isResolvingWallAddHostConflict
		) {
			return;
		}
		setIsResolvingWallAddHostConflict(true);
		setDimensionError(undefined);
		const input: AddGeneralWallHostResolutionInput = {
			...wallAddHostConflict.input,
			itemIds: wallAddHostConflict.itemIds,
			openingIds: wallAddHostConflict.openingIds,
		};
		try {
			const creationBase = captureCreationBase();
			const result =
				await controller.resolveHostConflictAndAddGeneralWall(input);
			const acceptedCreation = settlePendingCreation(creationBase, result);
			if (result.kind === "rejected") {
				pendingCreationRef.current = undefined;
				setDimensionError(errorCopy(result.reasonCode));
				if (result.reasonCode === "WALL_ADD_CONFLICT_STALE") {
					const refreshed =
						project?.schemaVersion === 1
							? previewWallAddHostConflict(project, wallAddHostConflict.input)
							: undefined;
					setWallAddHostConflict(
						refreshed?.kind === "conflict"
							? {
									input: wallAddHostConflict.input,
									itemIds: refreshed.itemIds,
									openingIds: refreshed.openingIds,
								}
							: undefined,
					);
				}
				return;
			}
			if (acceptedCreation) {
				setWallAddHostConflict(undefined);
			}
			if (result.kind === "durable") {
				setSelectedItemId(undefined);
				setSelectedWallId(undefined);
				setSelectedOpeningId(undefined);
			}
		} finally {
			setIsResolvingWallAddHostConflict(false);
		}
	};
	const cancelWallAddHostConflict = () => {
		if (isResolvingWallAddHostConflict || isWorking) return;
		pendingCreationRef.current = undefined;
		setWallAddHostConflict(undefined);
		requestAnimationFrame(() => wallToolButtonRef.current?.focus());
	};

	const rotateItem = async (input: {
		readonly assetInstanceId: string;
		readonly yawRadians: number;
	}) => {
		if (
			isEditorReadOnly ||
			isWorking ||
			project?.assetInstances.some(
				(item) =>
					item.anchorClass === "floor" &&
					item.assetInstanceId === input.assetInstanceId &&
					item.locked,
			)
		)
			return false;
		setDimensionError(undefined);
		const result = await controller.rotateParametricFloorItem(input);
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return false;
		}
		if (result.kind === "durable" && "warnings" in result && result.warnings) {
			setDimensionError(
				`Предупреждение: ${itemPlacementWarningSummary(result.warnings)}.`,
			);
		}
		return result.kind === "durable";
	};

	const commitSelectedItemAngle = async () => {
		if (
			!selectedItem ||
			selectedItemLocked ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		const yawRadians = yawRadiansFromDegrees(selectedItemAngleRaw);
		if (yawRadians === undefined) {
			setDimensionError("Укажите конечный угол поворота в градусах.");
			return;
		}
		setDimensionError(undefined);
		const accepted = await rotateItem({
			assetInstanceId: selectedItem.assetInstanceId,
			yawRadians,
		});
		if (accepted) {
			setSelectedItemAngleRaw(
				degreesForYawRadians(
					yawRadiansFor({
						yawStep: rotationStepForYawRadians(yawRadians),
					}),
				),
			);
		}
	};

	const activateWallTool = async () => {
		if (
			!project ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		setDimensionError(undefined);
		setViewMode("plan");
		setActiveTool("wall");
		// Construction owns the canvas.  Keeping a previous inspector sheet open
		// can cover a real wall endpoint on a phone and make a valid drag appear
		// to do nothing.
		setSelectedItemId(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
		setOpeningCreationDraft(undefined);
		setOpeningDraft(undefined);
		setWallDeletionConflict(undefined);
	};

	const activateOpeningTool = () => {
		if (
			!project ||
			!selectedWall ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		const draft = openingCreationDraftFor(project, selectedWall.wallSegmentId);
		if (!draft) {
			setDimensionError("Выберите стену, на которой можно создать проём.");
			return;
		}
		setDimensionError(undefined);
		setViewMode("plan");
		setActiveTool("select");
		setSelectedItemId(undefined);
		setOpeningDraft(undefined);
		setWallDeletionConflict(undefined);
		setIsEditorActionMenuOpen(false);
		openingCreationRestoreFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		setOpeningCreationDraft(draft);
	};

	const activateSelectTool = () => {
		customGlbPlacementAbortRef.current?.abort();
		customGlbPlacementAbortRef.current = undefined;
		setOpeningCreationDraft(undefined);
		setOpeningDraft(undefined);
		setWallDeletionConflict(undefined);
		setCustomGlbPlacementDraft(undefined);
		setReusedItemDefinitionId(undefined);
		setViewMode("plan");
		setActiveTool("select");
		setSelectedItemId(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
	};

	const loadCatalogPublication = useCallback(async () => {
		catalogPublicationAbortRef.current?.abort();
		setSelectedPreloadedCatalogAssetId(undefined);
		// Local declared furniture is available before, during and after a
		// control-plane outage. A valid publication may replace it explicitly.
		setPreloadedGlbCatalogAssets(localPreloadedGlbCatalogAssets);
		setPreloadedGlbResources({});
		setUnavailablePreloadedCatalogThumbnails(new Set());
		if (!catalogGateway) {
			setCatalogPublicationState({ kind: "unavailable" });
			return;
		}
		const abortController = new AbortController();
		catalogPublicationAbortRef.current = abortController;
		setCatalogPublicationState({ kind: "loading" });
		const result = await catalogGateway.currentPublication(
			abortController.signal,
		);
		if (
			abortController.signal.aborted ||
			catalogPublicationAbortRef.current !== abortController
		) {
			return;
		}
		if (result.kind === "available") {
			setPreloadedGlbCatalogAssets(
				catalogAssetsFromPublication(result.publication),
			);
			setCatalogPublicationState({
				kind: "ready",
				publication: result.publication,
			});
		} else if (result.kind === "invalid-envelope") {
			setCatalogPublicationState({ kind: "invalid" });
		} else if (result.kind !== "cancelled") {
			setCatalogPublicationState({ kind: "unavailable" });
		}
		if (catalogPublicationAbortRef.current === abortController) {
			catalogPublicationAbortRef.current = undefined;
		}
	}, [catalogGateway]);

	const openBuiltInCatalog = () => {
		if (isEditorReadOnly) {
			return;
		}
		restoreFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		setActiveTool("select");
		setSelectedItemId(undefined);
		// A wall model chosen from the catalog keeps the wall the user selected.
		setSelectedPreloadedCatalogAssetId(undefined);
		setSelectedCustomCatalogAssetId(undefined);
		setItemPlacementConfirmation(undefined);
		setReusedItemDefinitionId(undefined);
		setIsPlaceholderComposerOpen(false);
		setPlaceholderComposerError(undefined);
		setPlaceholderFields(itemFields);
		setIsBuiltInCatalogOpen(true);
		void loadCatalogPublication();
	};

	const beginPlaceholderPlacement = () => {
		const widthMm = positiveInteger(placeholderFields.widthMm);
		const depthMm = positiveInteger(placeholderFields.depthMm);
		const heightMm = positiveInteger(placeholderFields.heightMm);
		const label = placeholderFields.label.trim();
		if (!widthMm || !depthMm || !heightMm || label.length === 0) {
			setPlaceholderComposerError(
				"Укажите название и целые положительные ширину, глубину и высоту.",
			);
			return;
		}
		if (
			!alphaParametricItemColors.includes(
				placeholderFields.color as (typeof alphaParametricItemColors)[number],
			)
		) {
			setPlaceholderComposerError("Выберите один из доступных цветов макета.");
			return;
		}
		setPlaceholderComposerError(undefined);
		setDimensionError(undefined);
		setCustomGlbPlacementDraft(undefined);
		setReusedItemDefinitionId(undefined);
		setItemFields({
			color: placeholderFields.color,
			depthMm: String(depthMm),
			heightMm: String(heightMm),
			label,
			widthMm: String(widthMm),
		});
		setItemPlacementYawRadians(0);
		setActiveTool("item");
		closeOverlay();
	};

	const ensurePreloadedGlbResource = useCallback(
		async (
			asset: PreloadedGlbCatalogAsset,
		): Promise<CustomGlbResource | undefined> => {
			const current = preloadedGlbResources[asset.id];
			if (current?.kind === "ready") {
				return current.resource;
			}
			const loading = preloadedGlbLoadPromisesRef.current[asset.id];
			if (loading) {
				return loading;
			}
			if (!asset.resource && !asset.resourceUrl) {
				setPreloadedGlbResources((resources) => ({
					...resources,
					[asset.id]: { kind: "unavailable" },
				}));
				return undefined;
			}
			const abortController = new AbortController();
			preloadedGlbLoadAbortRef.current[asset.id]?.abort();
			preloadedGlbLoadAbortRef.current[asset.id] = abortController;
			setPreloadedGlbResources((resources) => ({
				...resources,
				[asset.id]: { kind: "loading", loadedBytes: 0 },
			}));
			const load = loadPreloadedGlbResource(
				asset,
				abortController.signal,
				(progress) => {
					setPreloadedGlbResources((resources) => {
						if (resources[asset.id]?.kind !== "loading") return resources;
						return {
							...resources,
							[asset.id]: { kind: "loading", ...progress },
						};
					});
				},
			);
			preloadedGlbLoadPromisesRef.current[asset.id] = load;
			try {
				const resource = await load;
				if (abortController.signal.aborted) return undefined;
				setPreloadedGlbResources((resources) => ({
					...resources,
					[asset.id]: resource
						? { kind: "ready", resource }
						: { kind: "unavailable" },
				}));
				return resource;
			} catch {
				setPreloadedGlbResources((resources) => ({
					...resources,
					[asset.id]: { kind: "unavailable" },
				}));
				return undefined;
			} finally {
				delete preloadedGlbLoadPromisesRef.current[asset.id];
				if (preloadedGlbLoadAbortRef.current[asset.id] === abortController) {
					delete preloadedGlbLoadAbortRef.current[asset.id];
				}
			}
		},
		[preloadedGlbResources],
	);

	const selectPreloadedCatalogAsset = (asset: PreloadedGlbCatalogAsset) => {
		setSelectedPreloadedCatalogAssetId(asset.id);
		setSelectedCustomCatalogAssetId(undefined);
		void ensurePreloadedGlbResource(asset);
	};

	const retryPreloadedCatalogResource = () => {
		if (!selectedPreloadedCatalogAsset) return;
		setDimensionError(undefined);
		void ensurePreloadedGlbResource(selectedPreloadedCatalogAsset);
	};

	const cancelPreloadedCatalogSelection = () => {
		const assetId = selectedPreloadedCatalogAsset?.id;
		if (!assetId) return;
		preloadedGlbLoadAbortRef.current[assetId]?.abort();
		delete preloadedGlbLoadAbortRef.current[assetId];
		setPreloadedGlbResources((resources) => {
			const next = { ...resources };
			delete next[assetId];
			return next;
		});
		setSelectedPreloadedCatalogAssetId(undefined);
	};

	const selectCustomCatalogAsset = (asset: CustomCatalogAsset) => {
		setSelectedPreloadedCatalogAssetId(undefined);
		setSelectedCustomCatalogAssetId(asset.definition.assetDefinitionId);
	};

	const startPreloadedCatalogPlacement = (
		asset: PreloadedGlbCatalogAsset,
		resource: CustomGlbResource,
	) => {
		const existingDefinition = customGlbResourceManifest.find(
			(definition) => definition.resourceHash === resource.resourceHash,
		);
		if (asset.anchorClass === "wall") {
			if (project?.schemaVersion !== 1 || isEditorReadOnly || isMutationBlocked)
				return;
			const hosts = wallOpeningHostsForProject(project) ?? [];
			const host =
				hosts.find(
					(candidate) =>
						candidate.wallSegmentId === selectedWallId &&
						candidate.usableLengthMm >= asset.widthMm &&
						candidate.heightMm >= asset.heightMm,
				) ??
				hosts.find(
					(candidate) =>
						candidate.usableLengthMm >= asset.widthMm &&
						candidate.heightMm >= asset.heightMm,
				);
			if (!host) {
				setDimensionError("Нет стены, на которой помещается этот предмет.");
				return;
			}
			const draft: ParametricWallItemInput = {
				color: "#416b91",
				depthMm: asset.depthMm,
				heightMm: asset.heightMm,
				label: asset.label,
				widthMm: asset.widthMm,
				wallSegmentId: host.wallSegmentId,
				side: "left",
				offsetMm: Math.round(host.usableLengthMm / 2),
				elevationMm: Math.min(1500, host.heightMm - asset.heightMm),
			};
			setCatalogWallModelDraft({
				asset,
				resource,
				assetDefinitionId:
					existingDefinition?.assetDefinitionId ??
					`${PRELOADED_GLB_DEFINITION_PREFIX}${asset.id}:${browserRandomUuid()}`,
				reusesExistingDefinition: existingDefinition !== undefined,
			});
			setSelectedWallId(host.wallSegmentId);
			setSelectedOpeningId(undefined);
			setSelectedItemId(undefined);
			setWallItemDraft(draft);
			setWallItemDraftFields(wallItemDraftFieldsFor(draft));
			setCustomGlbPlacementDraft(undefined);
			setViewMode("plan");
			setActiveTool("select");
			setIsSelectionInspectorExpanded(true);
			setDimensionError(undefined);
			closeOverlay();
			return;
		}
		setDimensionError(undefined);
		setSelectedCustomCatalogAssetId(undefined);
		setReusedItemDefinitionId(undefined);
		setCustomGlbPlacementDraft(
			existingDefinition
				? {
						assetDefinitionId: existingDefinition.assetDefinitionId,
						bytes: resource.bytes,
						dimensions: {
							depthMm: String(existingDefinition.depthMm),
							heightMm: String(existingDefinition.heightMm),
							widthMm: String(existingDefinition.widthMm),
						},
						displayName: existingDefinition.displayName,
						filename: asset.resourceUrl,
						kind: "ready",
						resourceHash: resource.resourceHash,
						reusesExistingDefinition: true,
						source: "glb",
						textureCount: 0,
					}
				: {
						assetDefinitionId: `${PRELOADED_GLB_DEFINITION_PREFIX}${asset.id}:${browserRandomUuid()}`,
						bytes: resource.bytes,
						dimensions: {
							depthMm: String(asset.depthMm),
							heightMm: String(asset.heightMm),
							widthMm: String(asset.widthMm),
						},
						displayName: asset.label,
						filename: asset.resourceUrl,
						kind: "ready",
						resourceHash: resource.resourceHash,
						...(catalogOriginFor(asset)
							? { catalogOrigin: catalogOriginFor(asset) }
							: {}),
						source: "glb",
						textureCount: 0,
					},
		);
		setItemPlacementYawRadians(0);
		setActiveTool("item");
		closeOverlay();
	};

	const beginPreloadedCatalogPlacement = () => {
		const asset = selectedPreloadedCatalogAsset;
		if (!asset) return;
		const readyResource = preloadedGlbResources[asset.id];
		if (readyResource?.kind !== "ready") return;
		startPreloadedCatalogPlacement(asset, readyResource.resource);
	};

	const beginCustomCatalogPlacement = () => {
		if (selectedCustomCatalogAsset?.resourceState === "unavailable") {
			setDimensionError(
				"Модель недоступна локально. Импортируйте исходный GLB заново.",
			);
			return;
		}
		if (!selectedCustomCatalogAsset?.resource) {
			setDimensionError(
				"Байты модели ещё загружаются из локального хранилища. Подождите и повторите.",
			);
			return;
		}
		const { definition, resource } = selectedCustomCatalogAsset;
		const existingDefinition = customGlbResourceManifest.find(
			(candidate) => candidate.resourceHash === definition.resourceHash,
		);
		const placementDefinition = existingDefinition ?? definition;
		setDimensionError(undefined);
		setReusedItemDefinitionId(undefined);
		setCustomGlbPlacementDraft({
			assetDefinitionId: placementDefinition.assetDefinitionId,
			bytes: resource.bytes,
			dimensions: {
				depthMm: String(placementDefinition.depthMm),
				heightMm: String(placementDefinition.heightMm),
				widthMm: String(placementDefinition.widthMm),
			},
			displayName: placementDefinition.displayName,
			filename: placementDefinition.displayName,
			kind: "ready",
			resourceHash: placementDefinition.resourceHash,
			...(existingDefinition
				? { reusesExistingDefinition: true as const }
				: {}),
			source: "glb",
			textureCount: 0,
		});
		setItemPlacementYawRadians(0);
		setActiveTool("item");
		closeOverlay();
	};

	const beginCatalogPlacement = () => {
		if (selectedCustomCatalogAsset) {
			beginCustomCatalogPlacement();
			return;
		}
		beginPreloadedCatalogPlacement();
	};

	const discardCustomGlbImport = () => {
		++customGlbImportRequestRef.current;
		++customGlbPlacementRequestRef.current;
		customGlbDimensionsEditedByUserRef.current = false;
		setCustomGlbImport({ kind: "idle" });
	};

	const importCustomGlbFile = async (file: File | undefined) => {
		if (!file) return;
		const importRequestId = ++customGlbImportRequestRef.current;
		++customGlbPlacementRequestRef.current;
		customGlbDimensionsEditedByUserRef.current = false;
		setCustomGlbImport({ filename: file.name, kind: "checking" });
		try {
			
			const bounded = isEmbeddedHost ? await readBoundedLocalGlbFiles([file], "new-model") : undefined;
			if (bounded?.kind === "rejected") {
				if (customGlbImportRequestRef.current === importRequestId) setCustomGlbImport({ kind: "rejected", reasonCode: "GLB_FILE_BYTES_LIMIT" });
				return;
			}
			const bytes = bounded?.bytes[0] ?? new Uint8Array(await file.arrayBuffer());
			const prepared = await prepareCustomGlbImport(bytes, file.name, "glb");
			if (customGlbImportRequestRef.current === importRequestId) {
				setCustomGlbImport(prepared);
			}
		} catch {
			if (customGlbImportRequestRef.current === importRequestId) {
				setCustomGlbImport({
					kind: "rejected",
					reasonCode: "GLB_HEADER_INVALID",
				});
			}
		} finally {
			if (
				customGlbImportRequestRef.current === importRequestId &&
				customGlbImportInputRef.current
			) {
				customGlbImportInputRef.current.value = "";
			}
		}
	};

	const updateCustomGlbImport = (
		update: (current: CustomGlbPlacementDraft) => CustomGlbPlacementDraft,
	) => {
		setCustomGlbImport((current) =>
			current.kind === "ready" ? update(current) : current,
		);
	};

	const claimCustomGlbDimensions = () => {
		customGlbDimensionsEditedByUserRef.current = true;
	};

	const updateCustomGlbDimension = (
		dimension: keyof DimensionFields,
		value: string,
	) => {
		claimCustomGlbDimensions();
		updateCustomGlbImport((current) => ({
			...current,
			dimensions: {
				...current.dimensions,
				[dimension]: value,
			},
		}));
	};

	const applyMeasuredCustomGlbDimensions = (
		dimensions: MeasuredCustomGlbDimensions,
	) => {
		updateCustomGlbImport((current) => {
			const nextDimensions = dimensionsAfterCustomGlbPreviewMeasurement(
				current.dimensions,
				dimensions,
				customGlbDimensionsEditedByUserRef.current,
			);
			return nextDimensions === current.dimensions
				? current
				: { ...current, dimensions: nextDimensions };
		});
	};

	const removeCustomCatalogAsset = async (asset: CustomGlbAssetDefinition) => {
		if (removingCustomAssetId) return;
		setRemovingCustomAssetId(asset.assetDefinitionId);
		setCustomLibraryError(undefined);
		try {
			const libraryDefinition = customGlbLibraryDefinitions.find(
				(entry) => entry.resourceHash === asset.resourceHash,
			);
			const result = await controller.removeCustomGlbLibraryAsset(
				libraryDefinition?.assetDefinitionId ?? asset.assetDefinitionId,
			);
			if (result.kind !== "removed") {
				setCustomLibraryError("Не удалось убрать карточку. Повторите попытку.");
				return;
			}
			setRemovedCustomGlbHashes((hashes) => [
				...new Set([...hashes, asset.resourceHash]),
			]);
			setCustomGlbLibraryDefinitions((definitions) =>
				definitions.filter(
					(entry) => entry.resourceHash !== asset.resourceHash,
				),
			);
			setSelectedCustomCatalogAssetId(undefined);
			setCustomLibraryEpoch((epoch) => epoch + 1);
		} catch {
			setCustomLibraryError("Не удалось убрать карточку. Повторите попытку.");
		} finally {
			setRemovingCustomAssetId(undefined);
		}
	};

	const beginCustomGlbPlacement = () => {
		if (customGlbImport.kind !== "ready") return;
		const importForPlacement = customGlbImport;
		const placementRequestId = ++customGlbPlacementRequestRef.current;
		const widthMm = positiveInteger(importForPlacement.dimensions.widthMm);
		const depthMm = positiveInteger(importForPlacement.dimensions.depthMm);
		const heightMm = positiveInteger(importForPlacement.dimensions.heightMm);
		if (
			!widthMm ||
			!depthMm ||
			!heightMm ||
			importForPlacement.displayName.trim().length === 0
		) {
			setDimensionError(
				"Укажите название и целые положительные габариты модели.",
			);
			return;
		}
		setDimensionError(undefined);
		setReusedItemDefinitionId(undefined);
		const existingDefinition = customGlbResourceManifest.find(
			(definition) =>
				definition.resourceHash === importForPlacement.resourceHash,
		);
		void controller
			.registerCustomGlbLibraryAsset({
				asset: {
					assetDefinitionId: importForPlacement.assetDefinitionId,
					byteLength: importForPlacement.bytes.byteLength,
					depthMm,
					displayName: importForPlacement.displayName.trim(),
					format: "glb",
					heightMm,
					resourceHash: importForPlacement.resourceHash,
					widthMm,
				},
				glbBytes: importForPlacement.bytes,
				restoreRemoved: true,
			})
			.then((result) => {
				if (customGlbPlacementRequestRef.current !== placementRequestId) return;
				if (result.kind === "registered" || result.kind === "already-present") {
					const placementDefinition = existingDefinition ?? result.asset;
					setRemovedCustomGlbHashes((hashes) =>
						hashes.filter((hash) => hash !== result.asset.resourceHash),
					);
					setCustomLibraryEpoch((epoch) => epoch + 1);
					setCustomGlbLibraryDefinitions((definitions) => {
						const withoutSameResource = definitions.filter(
							(definition) =>
								definition.resourceHash !== result.asset.resourceHash,
						);
						return [...withoutSameResource, result.asset];
					});
					setCustomGlbResources((resources) => ({
						...resources,
						[result.asset.assetDefinitionId]: {
							bytes: importForPlacement.bytes.slice(),
							resourceHash: result.asset.resourceHash,
						},
						...(existingDefinition
							? {
									[existingDefinition.assetDefinitionId]: {
										bytes: importForPlacement.bytes.slice(),
										resourceHash: result.asset.resourceHash,
									},
								}
							: {}),
					}));
					setCustomGlbResourceStates((states) => ({
						...states,
						[result.asset.assetDefinitionId]: "ready",
						...(existingDefinition
							? { [existingDefinition.assetDefinitionId]: "ready" as const }
							: {}),
					}));
					setCustomGlbResourceReloadEpoch((epoch) => epoch + 1);
					setCustomGlbPlacementDraft({
						...importForPlacement,
						assetDefinitionId: placementDefinition.assetDefinitionId,
						dimensions: {
							depthMm: String(placementDefinition.depthMm),
							heightMm: String(placementDefinition.heightMm),
							widthMm: String(placementDefinition.widthMm),
						},
						displayName: placementDefinition.displayName,
						resourceHash: placementDefinition.resourceHash,
						...(existingDefinition
							? { reusesExistingDefinition: true as const }
							: {}),
					});
					setItemPlacementYawRadians(0);
					setActiveTool("item");
					closeOverlay();
					return;
				}
				setDimensionError(
					result.kind === "rejected"
						? errorCopy(result.reasonCode)
						: "Не удалось добавить модель в «Кастомное». Повторите импорт.",
				);
			});
	};

	const importFbxFiles = async (files: FileList | null | undefined) => {
		if (isEmbeddedHost || fbxConversion.kind === "converting") return;
		const selectedFiles = Array.from(files ?? []);
		const abortController = new AbortController();
		fbxConversionAbortRef.current = abortController;
		discardCustomGlbImport();
		setFbxConversion({
			filename: selectedFiles[0]?.name ?? "выбранный файл",
			kind: "converting",
		});
		try {
			const { prepareFbxImportBundle } = await import(
				"../adapters/asset-import/fbx-bundle-import"
			);
			const bundle = prepareFbxImportBundle(
				await Promise.all(
					selectedFiles.map(async (selectedFile) => ({
						bytes: new Uint8Array(await selectedFile.arrayBuffer()),
						name: selectedFile.name,
					})),
				),
			);
			if (bundle.kind === "rejected") {
				setFbxConversion({ kind: "rejected", reasonCode: bundle.reasonCode });
				return;
			}
			const { convertStaticFbxToGlb } = await import(
				"../adapters/asset-import/fbx-to-glb-converter"
			);
			const result = await convertStaticFbxToGlb(bundle.fbxBytes, {
				sidecarResources: bundle.sidecarResources,
				signal: abortController.signal,
			});
			if (result.kind === "converted") {
				setCustomGlbImport(
					await prepareCustomGlbImport(
						result.glbBytes,
						bundle.fbxFilename,
						"fbx",
					),
				);
				setFbxConversion({ kind: "idle" });
			} else {
				setFbxConversion({ kind: "rejected", reasonCode: result.reasonCode });
			}
		} catch {
			setFbxConversion({
				kind: "rejected",
				reasonCode: "FBX_CONVERSION_FAILED",
			});
		} finally {
			if (fbxConversionAbortRef.current === abortController) {
				fbxConversionAbortRef.current = undefined;
			}
			if (fbxImportInputRef.current) {
				fbxImportInputRef.current.value = "";
			}
		}
	};

	const cancelFbxConversion = () => {
		fbxConversionAbortRef.current?.abort();
		fbxConversionAbortRef.current = undefined;
		setFbxConversion({ kind: "idle" });
	};

	const closeOverlay = () => {
		cancelFbxConversion();
		catalogPublicationAbortRef.current?.abort();
		catalogPublicationAbortRef.current = undefined;
		for (const abortController of Object.values(
			preloadedGlbLoadAbortRef.current,
		)) {
			abortController?.abort();
		}
		preloadedGlbLoadAbortRef.current = {};
		++customGlbImportRequestRef.current;
		++customGlbPlacementRequestRef.current;
		setIsBuiltInCatalogOpen(false);
		const restoreTarget = restoreFocusRef.current;
		restoreFocusRef.current = undefined;
		queueMicrotask(() => restoreTarget?.focus());
	};

	const trapOverlayFocus = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			if (isNavigationProtected) requestEditorBack(false, closeOverlay); else closeOverlay();
		}
	};

	const cancelItemPlacement = () => {
		pendingCreationRef.current = undefined;
		customGlbPlacementAbortRef.current?.abort();
		customGlbPlacementAbortRef.current = undefined;
		setDimensionError(undefined);
		setCustomGlbPlacementDraft(undefined);
		setReusedItemDefinitionId(undefined);
		setActiveTool("select");
		setSelectedItemId(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
	};

	const placeItem = async (point: {
		readonly xMm: number;
		readonly zMm: number;
	}) => {
		if (project?.schemaVersion !== 1) {
			return;
		}
		const draft = itemPlacementDraft;
		setDimensionError(undefined);
		setItemPlacementConfirmation(undefined);
		if (!draft) {
			setDimensionError(
				"Укажите название и целые положительные размеры предмета.",
			);
			return;
		}
		const roomId = findRoomForFloorItem(project, {
			depthMm: draft.depthMm,
			yawStep: draft.yawStep,
			widthMm: draft.widthMm,
			xMm: point.xMm,
			zMm: point.zMm,
		});
		if (!roomId) {
			setDimensionError(
				"Предмет должен целиком находиться внутри ячейки сетки.",
			);
			return;
		}
		const customGlbAbortController =
			customGlbPlacementDraft &&
			!customGlbPlacementDraft.reusesExistingDefinition
				? new AbortController()
				: undefined;
		if (customGlbAbortController) {
			customGlbPlacementAbortRef.current = customGlbAbortController;
		}
		const creationBase = captureCreationBase();
		const result = await (customGlbPlacementDraft
			? customGlbPlacementDraft.reusesExistingDefinition
				? await controller.createParametricFloorItem({
						assetDefinitionId: customGlbPlacementDraft.assetDefinitionId,
						color: draft.color,
						depthMm: draft.depthMm,
						yawStep: draft.yawStep,
						heightMm: draft.heightMm,
						label: draft.label,
						roomId,
						widthMm: draft.widthMm,
						xMm: point.xMm,
						zMm: point.zMm,
					})
				: controller.createCustomGlbFloorItem(
						{
							asset: {
								assetDefinitionId: customGlbPlacementDraft.assetDefinitionId,
								byteLength: customGlbPlacementDraft.bytes.byteLength,
								depthMm: draft.depthMm,
								displayName: draft.label,
								format: "glb",
								heightMm: draft.heightMm,
								resourceHash: customGlbPlacementDraft.resourceHash,
								...(customGlbPlacementDraft.catalogOrigin ?? {}),
								widthMm: draft.widthMm,
							},
							color: draft.color,
							glbBytes: customGlbPlacementDraft.bytes,
							yawStep: draft.yawStep,
							roomId,
							xMm: point.xMm,
							zMm: point.zMm,
						},
						{ signal: customGlbAbortController?.signal },
					)
			: controller.createParametricFloorItem({
					...(reusedItemDefinitionId === undefined
						? {}
						: { assetDefinitionId: reusedItemDefinitionId }),
					color: draft.color,
					depthMm: draft.depthMm,
					yawStep: draft.yawStep,
					heightMm: draft.heightMm,
					label: draft.label,
					roomId,
					widthMm: draft.widthMm,
					xMm: point.xMm,
					zMm: point.zMm,
				}));
		const acceptedCreation = settlePendingCreation(creationBase, result);
		if (customGlbPlacementAbortRef.current === customGlbAbortController) {
			customGlbPlacementAbortRef.current = undefined;
		}
		if (result.kind === "cancelled") return;
		const feedback = itemPlacementFeedback(result);
		if (result.kind !== "durable") {
			setDimensionError(feedback);
			if (acceptedCreation) {
				consumeCreationSurface();
				setSelectedItemId(undefined);
				setSelectedWallId(undefined);
				setSelectedOpeningId(undefined);
			}
			return;
		}
		const warningSummary =
			"warnings" in result && result.warnings
				? itemPlacementWarningSummary(result.warnings)
				: undefined;
		setItemPlacementConfirmation(
			warningSummary
				? `${feedback} Предупреждение сохранено: ${warningSummary}.`
				: feedback,
		);
		setActiveTool("select");
		setCustomGlbPlacementDraft(undefined);
		setReusedItemDefinitionId(undefined);
		setSelectedItemId(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
	};

	const moveItem = async (input: {
		readonly assetInstanceId: string;
		readonly xMm: number;
		readonly zMm: number;
	}) => {
		if (
			isEditorReadOnly ||
			project?.assetInstances.some(
				(item) =>
					item.anchorClass === "floor" &&
					item.assetInstanceId === input.assetInstanceId &&
					item.locked,
			)
		) {
			return false;
		}
		setDimensionError(undefined);
		const result = await controller.moveParametricFloorItem(input);
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return false;
		}
		if (result.kind === "durable" && "warnings" in result && result.warnings) {
			setDimensionError(
				`Предупреждение: ${itemPlacementWarningSummary(result.warnings)}.`,
			);
		}
		return result.kind === "durable";
	};

	const selectItem = (assetInstanceId: string) => {
		const item = project?.assetInstances.find(
			(candidate) => candidate.assetInstanceId === assetInstanceId,
		);
		if (!item) {
			return;
		}
		setDimensionError(undefined);
		setIsSelectionInspectorExpanded(false);
		setIsWallMoveMode(false);
		setIsWallSplitMode(false);
		setIsWallVertexMoveMode(false);
		setVertexDeletionCandidate(undefined);

		setSelectedItemId(assetInstanceId);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
		setWallDeletionConflict(undefined);
		setSelectedItemFields({
			color: item.color,
			depthMm: String(item.depthMm),
			heightMm: String(item.heightMm),
			label: item.label,
			widthMm: String(item.widthMm),
		});
	};

	const openSelectionProperties = () => {
		setIsEditorActionMenuOpen(false);
		setIsSelectionInspectorExpanded(true);
	};

	const openWallMutationCorrection = () => {
		const correction = wallMutationCorrectionState;
		if (!correction) return;
		if (correction.kind === "opening") {
			setActiveTool("select");
			selectWall(correction.opening.wallSegmentId);
			openOpeningDraft(correction.opening);
			return;
		}
		setActiveTool("select");
		selectItem(correction.assetInstanceId);
		setIsSelectionInspectorExpanded(true);
	};

	const nudgeSelectedItem = async (delta: {
		readonly xMm: number;
		readonly zMm: number;
	}) => {
		if (!selectedItem) return;
		const moved = await moveItem({
			assetInstanceId: selectedItem.assetInstanceId,
			xMm: selectedItem.xMm + delta.xMm,
			zMm: selectedItem.zMm + delta.zMm,
		});
		if (moved) {
			setItemPlacementConfirmation(
				`Предмет «${selectedItem.label}» перемещён на 100 мм.`,
			);
		}
	};

	const showWallMutationRejection = (
		result: {
			readonly affected?: GeneralWallProjectMutationAffectedReference;
			readonly reasonCode: string;
		},
		fallbackCopy: (reasonCode: string) => string = errorCopy,
	) => {
		const correction = wallMutationCorrection(
			result,
			project?.schemaVersion === 1 ? project : undefined,
		);
		setWallMutationCorrectionState(correction);
		setDimensionError(correction?.message ?? fallbackCopy(result.reasonCode));
	};

	const clearSelection = () => {
		setDimensionError(undefined);
		setIsWallMoveMode(false);
		setIsWallSplitMode(false);
		setIsWallVertexMoveMode(false);
		setVertexDeletionCandidate(undefined);
		setSelectedItemId(undefined);
		setSelectedItemFields(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
		setIsSelectionInspectorExpanded(false);
		setOpeningDraft(undefined);
		setOpeningCreationDraft(undefined);
		setWallItemDraft(undefined);
		setWallItemDraftFields(undefined);
		setWallDeletionConflict(undefined);
	};

	const selectWall = (wallSegmentId: string) => {
		setSelectedOpeningId(undefined);
		if (
			!project?.level.wallSegments.some(
				(wall) => wall.wallSegmentId === wallSegmentId,
			)
		) {
			return;
		}
		setDimensionError(undefined);
		setIsSelectionInspectorExpanded(false);
		setIsWallMoveMode(false);
		setIsWallSplitMode(false);
		setIsWallVertexMoveMode(false);
		setVertexDeletionCandidate(undefined);
		setSelectedItemId(undefined);
		setOpeningDraft(undefined);
		setWallItemDraft(undefined);
		setWallItemDraftFields(undefined);
		setWallDeletionConflict(undefined);
		setSelectedWallId(wallSegmentId);
	};

	const selectOpening = (openingId: string) => {
		const opening = project?.level.openings.find(
			(value) => value.openingId === openingId,
		);
		if (!opening) return;
		setSelectedOpeningId(openingId);
		setSelectedWallId(opening.wallSegmentId);
		setSelectedItemId(undefined);
		setIsSelectionInspectorExpanded(false);
	};

	const duplicateWallItem = (
		item: Extract<
			Project["assetInstances"][number],
			{ readonly anchorClass: "wall" }
		>,
	) => {
		if (
			project?.schemaVersion !== 1 ||
			item.assetDefinitionId === undefined ||
			isEditorReadOnly ||
			isMutationBlocked ||
			wallItemDraft !== undefined
		) {
			return;
		}
		const draft = [item.offsetMm + item.widthMm, item.offsetMm - item.widthMm]
			.map((offsetMm) => ({
				...(item.assetDefinitionId === undefined
					? {}
					: { assetDefinitionId: item.assetDefinitionId }),
				color: item.color,
				depthMm: item.depthMm,
				elevationMm: item.elevationMm,
				heightMm: item.heightMm,
				label: item.label,
				offsetMm,
				side: item.side,
				wallSegmentId: item.wallSegmentId,
				widthMm: item.widthMm,
			}))
			.find((candidate) => {
				const assessment = assessParametricWallItemPlacement(
					project,
					candidate,
				);
				return (
					assessment.kind === "accepted" && assessment.warnings === undefined
				);
			});
		if (!draft) {
			setDimensionError(
				"На этой стене нет места для безопасной копии предмета.",
			);
			return;
		}
		setDimensionError(undefined);
		setWallItemDraft(draft);
		setWallItemDraftFields(wallItemDraftFieldsFor(draft));
	};

	const confirmWallItemPlacement = async () => {
		if (!wallItemDraft || isEditorReadOnly || isMutationBlocked) return;
		const draft = wallItemDraftFromFields(wallItemDraft, wallItemDraftFields);
		if (!draft) {
			setDimensionError(
				"Укажите название, целые положительные размеры и целые миллиметры от нуля для положения настенного предмета.",
			);
			return;
		}
		const model = catalogWallModelDraft;
		const result = model
			? model.reusesExistingDefinition
				? await controller.createParametricWallItem({
						...draft,
						assetDefinitionId: model.assetDefinitionId,
					})
				: await controller.createCustomGlbFloorItem({
						anchorClass: "wall",
						color: draft.color,
						wallSegmentId: draft.wallSegmentId,
						side: draft.side,
						offsetMm: draft.offsetMm,
						elevationMm: draft.elevationMm,
						glbBytes: model.resource.bytes,
						asset: {
							assetDefinitionId: model.assetDefinitionId,
							byteLength: model.resource.bytes.byteLength,
							depthMm: model.asset.depthMm,
							heightMm: model.asset.heightMm,
							widthMm: model.asset.widthMm,
							displayName: model.asset.label,
							format: "glb",
							resourceHash: model.resource.resourceHash,
							...(catalogOriginFor(model.asset) ?? {}),
						},
					})
			: await controller.createParametricWallItem(draft);
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		if (result.kind === "durable") {
			if (
				"warnings" in result &&
				Array.isArray(result.warnings) &&
				result.warnings.length
			) {
				setDimensionError(
					"Предупреждение сохранено: настенные предметы пересекаются. Измените смещение или сторону, если это не запланированное наложение.",
				);
			}
			setWallItemDraft(undefined);
			setWallItemDraftFields(undefined);
		}
	};

	const deleteWallItem = async (assetInstanceId: string) => {
		if (isEditorReadOnly || isMutationBlocked) return;
		const result = await controller.deleteParametricWallItem({
			assetInstanceId,
		});
		if (result.kind === "rejected")
			setDimensionError(errorCopy(result.reasonCode));
	};

	const setWallItemLock = async (assetInstanceId: string, locked: boolean) => {
		if (isEditorReadOnly || isMutationBlocked) return;
		setDimensionError(undefined);
		const result = await controller.setParametricWallItemLock({
			assetInstanceId,
			locked,
		});
		if (result.kind === "rejected")
			setDimensionError(errorCopy(result.reasonCode));
	};

	const updateWallItemPositionField = (
		item: Extract<
			Project["assetInstances"][number],
			{ readonly anchorClass: "wall" }
		>,
		field: keyof WallItemPositionFields,
		value: string,
	) => {
		setWallItemPositionFields((current) => ({
			...current,
			[item.assetInstanceId]: {
				elevationMm:
					current[item.assetInstanceId]?.elevationMm ??
					String(item.elevationMm),
				offsetMm:
					current[item.assetInstanceId]?.offsetMm ?? String(item.offsetMm),
				[field]: value,
			},
		}));
	};

	const commitWallItemPosition = async (
		item: Extract<
			Project["assetInstances"][number],
			{ readonly anchorClass: "wall" }
		>,
	) => {
		if (isEditorReadOnly || isMutationBlocked || item.locked) return;
		const fields = wallItemPositionFields[item.assetInstanceId] ?? {
			elevationMm: String(item.elevationMm),
			offsetMm: String(item.offsetMm),
		};
		const elevationMm = nonNegativeSafeInteger(fields.elevationMm);
		const offsetMm = nonNegativeSafeInteger(fields.offsetMm);
		if (elevationMm === undefined || offsetMm === undefined) {
			setDimensionError(
				"Укажите целые миллиметры от нуля для смещения и высоты предмета.",
			);
			return;
		}
		setDimensionError(undefined);
		const result = await controller.moveParametricWallItem({
			assetInstanceId: item.assetInstanceId,
			elevationMm,
			offsetMm,
		});
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		if (result.kind === "durable" && result.warnings?.length) {
			setDimensionError(
				"Предупреждение сохранено: настенные предметы пересекаются. Измените смещение или сторону, если это не запланированное наложение.",
			);
		}
	};

	const deleteSelectedItem = async () => {
		if (
			!selectedItem ||
			selectedItemLocked ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		setDimensionError(undefined);
		const result = await controller.deleteParametricFloorItem({
			assetInstanceId: selectedItem.assetInstanceId,
		});
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		if (result.kind === "durable") {
			setSelectedItemId(undefined);
		}
	};

	/**
	 * Duplicate means "place another copy", not "overlap the selected item".
	 * The new object remains a preview until the user chooses a collision-free
	 * location and confirms it through the ordinary fenced placement command.
	 */
	const duplicateSelectedItem = () => {
		if (
			!selectedItem ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		const assetDefinitionId =
			"assetDefinitionId" in selectedItem
				? selectedItem.assetDefinitionId
				: undefined;
		if (
			assetDefinitionId !== undefined &&
			(project?.schemaVersion !== 1 ||
				!project.assetDefinitionRefs.some(
					(definition) => definition.assetDefinitionId === assetDefinitionId,
				))
		) {
			setDimensionError(
				"Модель выбранного предмета больше не прикреплена к проекту. Восстановите её перед созданием копии.",
			);
			return;
		}
		setDimensionError(undefined);
		setItemPlacementConfirmation(undefined);
		setCustomGlbPlacementDraft(undefined);
		setReusedItemDefinitionId(assetDefinitionId);
		setItemFields({
			color: selectedItem.color,
			depthMm: String(selectedItem.depthMm),
			heightMm: String(selectedItem.heightMm),
			label: selectedItem.label,
			widthMm: String(selectedItem.widthMm),
		});
		setSelectedItemId(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
		setViewMode("plan");
		setItemPlacementYawRadians(0);
		setActiveTool("item");
	};

	const deleteSelectedWall = async () => {
		if (
			!selectedWall ||
			state.kind !== "saved" ||
			isEditorReadOnly ||
			isWorking
		) {
			return;
		}
		setDimensionError(undefined);
		const conflictPreview =
			project?.schemaVersion === 1
				? previewWallDeletionConflict(project, {
						wallSegmentId: selectedWall.wallSegmentId,
					})
				: undefined;
		if (conflictPreview?.kind === "conflict") {
			setWallDeletionConflict({
				...conflictPreview,
				previewRevisionId: state.revisionId,
				requiresResolution: true,
				retainedRoomIdByTargetFaceKey: {},
				roomMetadataConflicts: conflictPreview.roomMetadataConflicts ?? [],
			});
			return;
		}
		setWallDeletionConflict({
			itemIds: [],
			openingIds: [],
			previewRevisionId: state.revisionId,
			requiresResolution: false,
			retainedRoomIdByTargetFaceKey: {},
			roomIds: [],
			roomMetadataConflicts: [],
			wallSegmentId: selectedWall.wallSegmentId,
		});
	};

	const chooseWallDeletionRoomMetadata = (
		targetFaceKey: string,
		retainedRoomId: string,
	) => {
		setWallDeletionConflict((current) =>
			current
				? {
						...current,
						retainedRoomIdByTargetFaceKey: {
							...current.retainedRoomIdByTargetFaceKey,
							[targetFaceKey]: retainedRoomId,
						},
					}
				: current,
		);
	};

	const confirmWallDeletionConflict = async () => {
		if (
			!wallDeletionConflict ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		const roomMetadataResolutions =
			wallDeletionConflict.roomMetadataConflicts.map((conflict) => {
				const retainedRoomId =
					wallDeletionConflict.retainedRoomIdByTargetFaceKey[
						conflict.targetFaceKey
					];
				return retainedRoomId
					? { retainedRoomId, targetFaceKey: conflict.targetFaceKey }
					: undefined;
			});
		if (
			roomMetadataResolutions.some((resolution) => resolution === undefined)
		) {
			setDimensionError(
				"Выберите помещение, чьи параметры останутся после объединения.",
			);
			return;
		}
		setDimensionError(undefined);
		const result = wallDeletionConflict.requiresResolution
			? await controller.resolveWallDeletionConflict({
					itemIds: wallDeletionConflict.itemIds,
					openingIds: wallDeletionConflict.openingIds,
					previewRevisionId: wallDeletionConflict.previewRevisionId,
					roomIds: wallDeletionConflict.roomIds,
					roomMetadataResolutions: roomMetadataResolutions as readonly {
						readonly retainedRoomId: string;
						readonly targetFaceKey: string;
					}[],
					wallSegmentId: wallDeletionConflict.wallSegmentId,
				})
			: await controller.deleteGeneralWall({
					previewRevisionId: wallDeletionConflict.previewRevisionId,
					wallSegmentId: wallDeletionConflict.wallSegmentId,
				});
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		if (result.kind === "stale-base") {
			setDimensionError(errorCopy(result.reasonCode));
			setWallDeletionConflict(undefined);
			return;
		}
		if (result.kind === "writer-lease-lost") {
			setDimensionError(errorCopy(result.reasonCode));
			setWallDeletionConflict(undefined);
			return;
		}
		// A confirmed command awaiting publication belongs to the controller retry
		// state; its old preview must not cover the save-failure actions.
		if (result.kind === "durable" || result.kind === "persist-failed") {
			setSelectedWallId(undefined);
			setSelectedOpeningId(undefined);
			setWallDeletionConflict(undefined);
		}
	};

	const cancelWallDeletionConflict = () => {
		setDimensionError(undefined);
		setWallDeletionConflict(undefined);
	};

	const publishWallMove = async (
		input: MoveGeneralWallInput,
	): Promise<boolean> => {
		if (
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return false;
		}
		setDimensionError(undefined);
		setWallMutationCorrectionState(undefined);
		const result = await controller.moveGeneralWall(input);
		if (result.kind === "rejected") {
			showWallMutationRejection(result);
			return false;
		}
		return result.kind === "durable";
	};

	const publishWallVertexMove = async (input: {
		readonly vertexId: string;
		readonly xMm: number;
		readonly zMm: number;
	}): Promise<boolean> => {
		if (
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return false;
		}
		setDimensionError(undefined);
		setWallMutationCorrectionState(undefined);
		const result = await controller.moveGeneralVertex(input);
		if (result.kind === "rejected") {
			showWallMutationRejection(result);
			return false;
		}
		return result.kind === "durable";
	};

	const publishWallSplit = async (
		input: SplitGeneralWallInput,
	): Promise<WallSplitPublishResult> => {
		if (
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return { kind: "rejected" };
		}
		const latest = controller.snapshot();
		if (latest.kind !== "saved" || latest.project !== project)
			return { kind: "rejected" };
		setDimensionError(undefined);
		const result = await controller.splitGeneralWall(input);
		if (result.kind === "rejected") {
			if (
				(result.reasonCode === "OPENING_HOST_UNRESOLVABLE" ||
					result.reasonCode === "ITEM_HOST_UNRESOLVABLE") &&
				project?.schemaVersion === 1
			) {
				const preview = previewWallSplitHostConflict(project, input);
				if (preview.kind === "conflict") {
					if (state.kind !== "saved") return { kind: "rejected" };
					return {
						itemIds: preview.itemIds,
						kind: "host-conflict",
						openingIds: preview.openingIds,
						previewRevisionId: state.revisionId,
					};
				}
			}
			setDimensionError(errorCopy(result.reasonCode));
			return { kind: "rejected" };
		}
		return result.kind === "durable"
			? { kind: "durable" }
			: { kind: "rejected" };
	};

	const resolveWallSplitHostConflict = async (
		input: SplitGeneralWallHostResolutionInput & {
			readonly previewRevisionId: string;
		},
	): Promise<WallSplitHostConflictResolutionResult> => {
		if (
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return "rejected";
		}
		setDimensionError(undefined);
		const result = await controller.resolveHostConflictAndSplitWall(input);
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return "rejected";
		}
		if (result.kind === "stale-base") {
			setDimensionError(errorCopy(result.reasonCode));
			return "stale-base";
		}
		return result.kind === "durable" ? "durable" : "rejected";
	};

	const confirmVertexDeletion = async () => {
		if (
			!vertexDeletionCandidate ||
			isEditorReadOnly ||
			isWorking ||
			isDeletingVertex ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		setDimensionError(undefined);
		setIsDeletingVertex(true);
		const result = await controller.deleteGeneralVertex({
			previewRevisionId: vertexDeletionCandidate.previewRevisionId,
			vertexId: vertexDeletionCandidate.vertexId,
		});
		setIsDeletingVertex(false);
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		if (result.kind === "stale-base") {
			setDimensionError(errorCopy(result.reasonCode));
			setVertexDeletionCandidate(undefined);
			return;
		}
		if (result.kind === "writer-lease-lost") {
			setDimensionError(errorCopy(result.reasonCode));
			setVertexDeletionCandidate(undefined);
			return;
		}
		if (result.kind === "durable") {
			setVertexDeletionCandidate(undefined);
		}
	};

	const closeOpeningCreationDraft = () => {
		pendingCreationRef.current = undefined;
		setDimensionError(undefined);
		setOpeningCreationDraft(undefined);
		setActiveTool("select");
		const restoreTarget = openingCreationRestoreFocusRef.current;
		openingCreationRestoreFocusRef.current = undefined;
		requestAnimationFrame(() => {
			if (restoreTarget?.isConnected) {
				restoreTarget.focus();
				return;
			}
			openingCreationActionRef.current?.focus();
		});
	};

	const trapOpeningCreationFocus = (event: KeyboardEvent<HTMLElement>) => {
		const focusable =
			event.key === "Tab"
				? Array.from(
						event.currentTarget.querySelectorAll<HTMLElement>(
							"button:not([disabled]), input:not([disabled]), select:not([disabled])",
						),
					)
				: [];
		const activeIndex =
			document.activeElement instanceof HTMLElement
				? focusable.indexOf(document.activeElement)
				: -1;
		const action = openingCreationDialogKeyAction({
			activeIndex,
			focusableCount: focusable.length,
			isWorking,
			key: event.key,
			shiftKey: event.shiftKey,
		});
		if (action === "dismiss") {
			event.preventDefault();
			if (openingDraft) cancelOpeningDraft();
			else closeOpeningCreationDraft();
			return;
		}
		if (action === "block") {
			event.preventDefault();
			return;
		}
		if (action === "retain-dialog") {
			event.preventDefault();
			event.currentTarget.focus();
			return;
		}
		if (action === "focus-first") {
			event.preventDefault();
			focusable[0]?.focus();
			return;
		}
		if (action === "focus-last") {
			event.preventDefault();
			focusable.at(-1)?.focus();
		}
	};

	const addDoorToWall = async (input: {
		readonly heightMm: number;
		readonly offsetMm: number;
		readonly sillMm: number;
		readonly wallSegmentId: string;
		readonly widthMm: number;
	}) => {
		if (
			project?.schemaVersion !== 1 ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		setDimensionError(undefined);
		const creationBase = captureCreationBase();
		const result = await controller.addDoorOpening({
			...input,
		});
		const accepted = settlePendingCreation(creationBase, result);
		if (result.kind === "rejected") {
			pendingCreationRef.current = undefined;
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		if (accepted) {
			setSelectedWallId(input.wallSegmentId);
			closeOpeningCreationDraft();
		}
	};

	const addWindowToWall = async (input: {
		readonly heightMm: number;
		readonly offsetMm: number;
		readonly sillMm: number;
		readonly wallSegmentId: string;
		readonly widthMm: number;
	}) => {
		if (
			project?.schemaVersion !== 1 ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		if (
			!Number.isSafeInteger(input.widthMm) ||
			input.widthMm <= 0 ||
			!Number.isSafeInteger(input.heightMm) ||
			input.heightMm <= 0 ||
			!Number.isSafeInteger(input.sillMm) ||
			input.sillMm < 0 ||
			!Number.isSafeInteger(input.offsetMm) ||
			input.offsetMm < 0
		) {
			setDimensionError("Укажите положительные целые ширину и высоту.");
			return;
		}
		setDimensionError(undefined);
		const creationBase = captureCreationBase();
		const result = await controller.addWindowOpening({
			heightMm: input.heightMm,
			offsetMm: input.offsetMm,
			sillMm: input.sillMm,
			wallSegmentId: input.wallSegmentId,
			widthMm: input.widthMm,
		});
		const accepted = settlePendingCreation(creationBase, result);
		if (result.kind === "rejected") {
			pendingCreationRef.current = undefined;
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		if (accepted) {
			setSelectedWallId(input.wallSegmentId);
			closeOpeningCreationDraft();
		}
	};

	const confirmOpeningCreationDraft = async () => {
		if (project?.schemaVersion !== 1 || !openingCreationDraft) return;
		const validation = validateOpeningCreationDraft(
			project,
			openingCreationDraft,
		);
		if (validation.kind === "invalid") {
			setDimensionError(validation.message);
			return;
		}
		if (validation.input.kind === "Door") {
			await addDoorToWall(validation.input);
			return;
		}
		await addWindowToWall(validation.input);
	};

	const selectOpeningCreationKind = (kind: OpeningCreationDraft["kind"]) => {
		if (project?.schemaVersion !== 1 || !openingCreationDraft) return;
		const next = openingCreationDraftFor(
			project,
			openingCreationDraft.wallSegmentId,
			kind,
		);
		if (!next) return;
		setDimensionError(undefined);
		setOpeningCreationDraft(next);
	};

	const deleteSelectedDoorOpening = async (openingId: string) => {
		if (
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		setDimensionError(undefined);
		const result = await controller.deleteDoorOpening({ openingId });
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
		}
	};

	const moveSelectedDoorOpening = async (input: {
		readonly openingId: string;
		readonly offsetMm: number;
	}): Promise<boolean> => {
		if (
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		)
			return false;
		const latest = controller.snapshot();
		if (latest.kind !== "saved" || latest.project !== project) return false;
		const opening = project?.level.openings.find(
			(value) => value.openingId === input.openingId,
		);
		if (!opening || opening.offsetMm === input.offsetMm) return false;
		if (project?.schemaVersion !== 1) return false;
		const preview = moveDoorOpeningInProject(project, input, project.updatedAt);
		if (preview.kind === "rejected") {
			setDimensionError(errorCopy(preview.reasonCode));
			return false;
		}
		setDimensionError(undefined);
		setSelectedOpeningId(opening.openingId);
		setOpeningDraft({
			baseRevisionId: latest.revisionId,
			isMove: true,
			heightMm: String(opening.heightMm),
			kind: opening.kind,
			offsetMm: String(input.offsetMm),
			openingId: opening.openingId,
			sillMm: String(opening.sillMm),
			widthMm: String(opening.widthMm),
		});
		return true;
	};

	const updateSelectedDoorOpening = async (input: {
		readonly heightMm?: number;
		readonly offsetMm?: number;
		readonly openingId: string;
		readonly sillMm?: number;
		readonly widthMm?: number;
	}) => {
		if (
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		)
			return;
		if (
			input.widthMm === undefined &&
			input.heightMm === undefined &&
			input.sillMm === undefined &&
			input.offsetMm === undefined
		) {
			setDimensionError("Укажите хотя бы одно значение проёма для изменения.");
			return;
		}
		if (
			(input.widthMm !== undefined &&
				(!Number.isSafeInteger(input.widthMm) || input.widthMm <= 0)) ||
			(input.heightMm !== undefined &&
				(!Number.isSafeInteger(input.heightMm) || input.heightMm <= 0)) ||
			(input.sillMm !== undefined &&
				(!Number.isSafeInteger(input.sillMm) || input.sillMm < 0)) ||
			(input.offsetMm !== undefined &&
				(!Number.isSafeInteger(input.offsetMm) || input.offsetMm < 0))
		) {
			setDimensionError("Укажите положительные целые ширину и высоту.");
			return;
		}
		setDimensionError(undefined);
		const result = await controller.updateDoorOpening(input);
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		const settled = controller.snapshot();
		if (
			result.kind === "durable" ||
			(result.kind === "persist-failed" &&
				settled.kind === "persist-failed" &&
				"candidate" in settled)
		) {
			// The confirmed candidate now belongs to save/recovery. Keeping its
			// editing modal would allow a second confirmation after a retry.
			setOpeningDraft(undefined);
		}
	};

	const openOpeningDraft = (opening: Project["level"]["openings"][number]) => {
		if (state.kind !== "saved") return;
		setSelectedOpeningId(opening.openingId);
		if (isEditorReadOnly || isWorking) {
			return;
		}
		setDimensionError(undefined);
		setOpeningDraft({
			baseRevisionId: state.revisionId,
			heightMm: String(opening.heightMm),
			kind: opening.kind,
			offsetMm: String(opening.offsetMm),
			openingId: opening.openingId,
			sillMm: String(opening.sillMm),
			widthMm: String(opening.widthMm),
		});
	};

	const confirmOpeningDraft = async () => {
		if (!openingDraft) return;
		const latest = controller.snapshot();
		if (
			latest.kind !== "saved" ||
			latest.revisionId !== openingDraft.baseRevisionId
		) {
			setOpeningDraft(undefined);
			setDimensionError("План изменился. Выберите проём заново.");
			return;
		}
		const widthMm = positiveInteger(openingDraft.widthMm);
		const heightMm = positiveInteger(openingDraft.heightMm);

		const currentOpening = project?.level.openings.find(
			(opening) => opening.openingId === openingDraft.openingId,
		);
		const offsetMm = openingDraft.isMove
			? Number(openingDraft.offsetMm)
			: currentOpening?.offsetMm;
		const sillMm = currentOpening?.sillMm;
		if (
			widthMm === undefined ||
			heightMm === undefined ||
			sillMm === undefined ||
			offsetMm === undefined
		) {
			setDimensionError("Укажите положительные целые ширину и высоту.");
			return;
		}
		await updateSelectedDoorOpening({
			heightMm,
			offsetMm,
			openingId: openingDraft.openingId,
			sillMm,
			widthMm,
		});
	};

	const cancelOpeningDraft = () => {
		setDimensionError(undefined);
		setOpeningDraft(undefined);
	};

	const commitSelectedItem = async () => {
		if (
			!selectedItem ||
			!selectedItemFields ||
			selectedItemLocked ||
			selectedItemHasFixedDimensions ||
			isEditorReadOnly ||
			isWorking ||
			state.kind === "persist-failed" ||
			state.kind === "recovery-needed"
		) {
			return;
		}
		const widthMm = positiveInteger(selectedItemFields.widthMm);
		const depthMm = positiveInteger(selectedItemFields.depthMm);
		const heightMm = positiveInteger(selectedItemFields.heightMm);
		setDimensionError(undefined);
		if (!widthMm || !depthMm || !heightMm) {
			setDimensionError("Укажите целые положительные размеры предмета.");
			return;
		}
		const result = await controller.resizeParametricFloorItem({
			assetInstanceId: selectedItem.assetInstanceId,
			depthMm,
			heightMm,
			widthMm,
		});
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		if (result.kind === "durable" && "warnings" in result && result.warnings) {
			setDimensionError(
				`Предупреждение: ${itemPlacementWarningSummary(result.warnings)}.`,
			);
		}
	};

	const confirmItemColorVariant = async () => {
		const draft = itemColorVariantDraft;
		if (!draft || isEditorReadOnly || isWorking) return;
		if (isPersistenceFailure) {
			await controller.retry();
			if (controller.snapshot().kind === "saved")
				setItemColorVariantDraft(undefined);
			return;
		}
		const item = project?.assetInstances.find(
			(candidate) => candidate.assetInstanceId === draft.assetInstanceId,
		);
		if (!item || item.anchorClass !== draft.anchorClass) {
			setDimensionError("Предмет больше недоступен. Выберите его заново.");
			setItemColorVariantDraft(undefined);
			return;
		}
		setDimensionError(undefined);
		const result =
			item.anchorClass === "floor"
				? await controller.recolorParametricFloorItem({
						assetInstanceId: item.assetInstanceId,
						variantId: draft.variantId,
					})
				: await controller.recolorParametricWallItem({
						assetInstanceId: item.assetInstanceId,
						variantId: draft.variantId,
					});
		if (result.kind === "rejected" || result.kind === "persist-failed") {
			setDimensionError(errorCopy(result.reasonCode));
			return;
		}
		setItemColorVariantDraft(undefined);
	};

	const setFloorItemLock = async (assetInstanceId: string, locked: boolean) => {
		if (isEditorReadOnly || isMutationBlocked) return;
		setDimensionError(undefined);
		const result = await controller.setParametricFloorItemLock({
			assetInstanceId,
			locked,
		});
		if (result.kind === "rejected") {
			setDimensionError(errorCopy(result.reasonCode));
		}
	};

	const commitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			event.currentTarget.blur();
		}
	};

	const consumeSkippedNumericBlurCommit = (target: HTMLInputElement) => {
		const skipped = skipNextNumericBlurCommitRef.current;
		skipNextNumericBlurCommitRef.current = false;
		return skipped === true || skipped === target;
	};

	const cancelSelectedItemNumericDraft = () => {
		if (!selectedItem) return;
		setDimensionError(undefined);
		setSelectedItemFields({
			color: selectedItem.color,
			depthMm: String(selectedItem.depthMm),
			heightMm: String(selectedItem.heightMm),
			label: selectedItem.label,
			widthMm: String(selectedItem.widthMm),
		});
		setSelectedItemAngleRaw(
			degreesForYawRadians(yawRadiansForEditorFloorAsset(selectedItem)),
		);
	};

	const cancelWallItemPositionDraft = (
		item: Extract<
			Project["assetInstances"][number],
			{ readonly anchorClass: "wall" }
		>,
	) => {
		setDimensionError(undefined);
		setWallItemPositionFields((current) => ({
			...current,
			[item.assetInstanceId]: {
				elevationMm: String(item.elevationMm),
				offsetMm: String(item.offsetMm),
			},
		}));
	};

	const cancelNumericDraftOnEscape = (
		event: KeyboardEvent<HTMLInputElement>,
		cancel: () => void,
	) => {
		if (event.key !== "Escape") return false;
		event.preventDefault();
		skipNextNumericBlurCommitRef.current = true;
		cancel();
		event.currentTarget.blur();
		return true;
	};

	const travelHistory = async (direction: "redo" | "undo") => {
		if (isEditorReadOnly || isWorking || state.kind !== "saved") {
			return;
		}
		setDimensionError(undefined);
		const result =
			direction === "undo" ? await controller.undo() : await controller.redo();
		if (result.kind === "durable") {
			setSelectedItemId(undefined);
			setSelectedWallId(undefined);
			setSelectedOpeningId(undefined);
			setWallDeletionConflict(undefined);
			setVertexDeletionCandidate(undefined);
			return;
		}
		if (result.kind === "history-resource-issue") {
			setHistoryResourceIssueHashes(result.resourceHashes);
			setHistoryDiscardError(undefined);
			setIsHistoryDiscardConfirmationOpen(true);
		}
	};

	const discardSessionHistory = async () => {
		if (
			isLegacyReadOnly ||
			isWriterLeaseReadOnly ||
			isWorking ||
			isDiscardingSessionHistory ||
			state.kind !== "history-recovery-needed"
		) {
			return;
		}
		setIsDiscardingSessionHistory(true);
		setHistoryDiscardError(undefined);
		try {
			const result = await controller.discardSessionHistory();
			if (result.kind === "discarded") {
				setHistoryResourceIssueHashes(undefined);
				setIsHistoryDiscardConfirmationOpen(false);
				setSelectedItemId(undefined);
				setSelectedWallId(undefined);
				setSelectedOpeningId(undefined);
				return;
			}
			setHistoryDiscardError(historyDiscardFailureCopy(result.kind));
		} finally {
			setIsDiscardingSessionHistory(false);
		}
	};

	const takeOverWriterLease = async () => {
		setIsTakingOverWriterLease(true);
		setWriterTakeoverError(undefined);
		try {
			const result = await controller.takeOverWriterLease();
			if (result.kind === "writable") {
				setIsWriterTakeoverConfirmationOpen(false);
				setIsShowingWriterRecoveryCopy(false);
				setWallDeletionConflict(undefined);
				setVertexDeletionCandidate(undefined);
				return;
			}
			setWriterTakeoverError(
				"Не удалось перехватить редактирование. Проект остался только для просмотра — попробуйте ещё раз.",
			);
		} catch {
			setWriterTakeoverError(
				"Не удалось перехватить редактирование. Проект остался только для просмотра — попробуйте ещё раз.",
			);
		} finally {
			setIsTakingOverWriterLease(false);
		}
	};

	const cancelWriterTakeover = () => {
		setIsWriterTakeoverConfirmationOpen(false);
		setWriterTakeoverError(undefined);
	};

	const restartCurrentProject = async () => {
		if (isEditorReadOnly || isWorking || isRestartingProject) return;
		setIsRestartingProject(true);
		setDimensionError(undefined);
		try {
			const result = isPersistenceFailure
				? await controller
						.retry()
						.then(() =>
							controller.snapshot().kind === "saved"
								? { kind: "durable" as const }
								: { kind: "persist-failed" as const },
						)
				: await controller.restartProject();
			if (result.kind === "durable") {
				setActiveTool("select");
				setIsBuiltInCatalogOpen(false);
				setIsRestartConfirmationOpen(false);
				setSelectedItemId(undefined);
				setSelectedWallId(undefined);
				setSelectedOpeningId(undefined);
				setWallDeletionConflict(undefined);
				setVertexDeletionCandidate(undefined);
				setViewport(initialEditorViewport);
				setViewMode("plan");
				return;
			}
			if (result.kind === "persist-failed") {
				setDimensionError(
					"Не удалось сохранить новый пустой план. Исходный чертёж не изменён.",
				);
			}
		} finally {
			setIsRestartingProject(false);
		}
	};

	const returnToProjects = async (confirmedCopy?: NonNullable<ReturnType<ProjectController["writerRecoveryCopy"]>>) => {
		if (isRepairingCustomGlb || isRemovingUnresolvedCustomGlb) return;

		setIsPlanInspectorOpen(false);
		setPlanDimensionError(undefined);
		setIsRoomDirectoryOpen(false);
		setRoomHeightOpeningConflict(undefined);
		setDimensionError(undefined);
		setProjectTransferError(undefined);
		setProjectDeletionError(undefined);
		setIsBuiltInCatalogOpen(false);
		setIsRenameProjectOpen(false);
		setRenameTargetProjectId(undefined);
		setIsRestartConfirmationOpen(false);
		setIsProjectDeletionConfirmationOpen(false);
		setSelectedItemId(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
		setWallDeletionConflict(undefined);
		setVertexDeletionCandidate(undefined);
		const chromeReset = projectHubChromeReset();
		setIsEditorActionMenuOpen(chromeReset.actionMenuOpen);
		setViewMode(chromeReset.viewMode);
        if (confirmedCopy && navigationProtection) {
            if (!(await navigationProtection.discardWriterRecoveryAndShowProjects(confirmedCopy))) setHostBackNotice("Несохранённая копия изменилась. Повторите выход после проверки данных.");
        } else await controller.showProjects();
	};

	const permanentlyDeleteCurrentProject = async () => {
		if (isEditorReadOnly || isMutationBlocked || isDeletingProject) return;
		setIsDeletingProject(true);
		setProjectDeletionError(undefined);
		try {
			const result = await controller.permanentlyDeleteCurrentProject();
			if (result.kind === "permanently-deleted") {
				setIsProjectDeletionConfirmationOpen(false);
				return;
			}
			setProjectDeletionError(
				result.kind === "read-only" || result.kind === "writer-lease-lost"
					? "Проект открыт для редактирования в другом окне. Удаление не выполнено."
					: "Не удалось удалить проект. Исходные данные не изменены.",
			);
		} finally {
			setIsDeletingProject(false);
		}
	};

	const permanentlyDeleteDirectoryProject = async () => {
		if (!directoryDeletionTarget || isDeletingProject) return;
		setIsDeletingProject(true);
		setProjectDeletionError(undefined);
		try {
			const result = await (directoryDeletionTarget.storageNamespace === undefined
				? controller.permanentlyDeleteProjectFromDirectory(directoryDeletionTarget.projectId)
				: controller.permanentlyDeleteProjectFromDirectory(directoryDeletionTarget.projectId, { storageNamespace: directoryDeletionTarget.storageNamespace }));
			if (result.kind === "permanently-deleted") {
				setDirectoryDeletionTarget(undefined);
			} else {
				setProjectDeletionError(
					result.kind === "read-only" || result.kind === "writer-lease-lost"
						? "Проект открыт для редактирования в другом окне. Удаление не выполнено."
						: "Не удалось удалить проект. Исходные данные не изменены.",
				);
			}
		} finally {
			setIsDeletingProject(false);
		}
	};

	const resumeTransientViews = () => { if (hostLifecycle?.snapshot().active === false) return; skipNextNumericBlurCommitRef.current = false; for (const boundary of transientBoundaries.current) boundary.resume(); };
	resumeHostViews.current = resumeTransientViews;
	const continueEditorDraft = () => { confirmedWriterExit.current = undefined; leaveFocusActive.current = false; setLeaveFocus(undefined); resumeTransientViews(); };
	const suspendForBack = () => {
		const focused = document.activeElement;
		if (fullTransientNavigationProtection && focused instanceof HTMLInputElement && focused.hasAttribute("data-editor-blur-commit")) skipNextNumericBlurCommitRef.current = focused;
		for (const boundary of transientBoundaries.current) boundary.suspend();
	};
	prepareHostBack.current = suspendForBack;
	const hasPendingEditorCommand = () => controller.hasPendingPublication() || controller.snapshot().kind === "loading" || controller.snapshot().kind === "saving" || !!projectTransferAbortRef.current || isRepairingCustomGlb || isRemovingUnresolvedCustomGlb || isDeletingProject || isTakingOverWriterLease || [...transientBoundaries.current].some((boundary) => boundary.inspect().hasPendingCommand);
	const requestEditorBack = (explicitProjects = false, onCleanPanelClose?: () => void) => {
		if (!isNavigationProtected) { void returnToProjects(); return; }
		if (leaveFocus) { continueEditorDraft(); return; }
		suspendForBack();
		const nativePanel = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].at(-1);
		const panel = !explicitProjects && (!!onCleanPanelClose || (fullTransientNavigationProtection && (!!nativePanel || isRenameProjectOpen || isEditorActionMenuOpen || isPlanInspectorOpen || isRoomDirectoryOpen || isBuiltInCatalogOpen || isSelectionInspectorExpanded || localFileState.kind !== "idle")));
		const recoveryExit = !panel ? controller.writerRecoveryCopy?.() : undefined;
		const decision = editorBackDecision({
			pending: hasPendingEditorCommand(),
			persistFailed: controller.snapshot().kind === "persist-failed" || hasRetainedHistoryTarget,
			draft: recoveryExit !== undefined || (fullTransientNavigationProtection && (hasRawEditorDraft || hasUndurableEditorDraft || [...transientBoundaries.current].some((boundary) => boundary.inspect().hasDraft))),
			panel,
			project: !!project || state.kind === "first-run" || state.kind === "recovery-needed",
		});
		if (decision === "confirm-discard") { confirmedWriterExit.current = recoveryExit; leaveFocusActive.current = true; setLeaveFocus(captureEditorFocus()); return; }
		resumeTransientViews();
		if (decision === "saving") { setHostBackNotice("Дождитесь завершения текущего действия. Сохраняемая правка не отменена."); return; }
		if (decision === "persist-failed") { setHostBackNotice("Правка не сохранена. Повторите сохранение или экспортируйте данные для восстановления."); return; }
		setHostBackNotice(undefined);
		if (decision === "close-panel") {
			if (onCleanPanelClose) onCleanPanelClose();
			else if (nativePanel) nativePanel.dispatchEvent(new Event("cancel", { cancelable: true }));
			else if (isRenameProjectOpen) cancelRenameProject();
			else if (localFileState.kind !== "idle") localFileSession?.close();
			else if (isEditorActionMenuOpen) setIsEditorActionMenuOpen(false);
			else if (isRoomDirectoryOpen) closeRoomDirectory();
			else if (isPlanInspectorOpen) closePlanInspector();
			else if (isSelectionInspectorExpanded) setIsSelectionInspectorExpanded(false);
			else closeOverlay();
		} else if (decision === "projects") { void returnToProjects(); }
		else { try { hostNavigation?.close(); } catch { setHostBackNotice("Не удалось закрыть приложение. Попробуйте ещё раз."); } }
	};
	hostBackHandler.current = () => requestEditorBack();
	const hostBackGuard = leaveFocus ? <EditorLeaveGuard focus={leaveFocus} fallback={editorHeaderMenuRef.current} onContinue={continueEditorDraft} onDiscard={() => {
		if (hasPendingEditorCommand() || controller.snapshot().kind === "persist-failed") return;
		const exitCopy = confirmedWriterExit.current;
		if (exitCopy && controller.writerRecoveryCopy?.() !== exitCopy) {
			continueEditorDraft(); setHostBackNotice("Несохранённая правка изменилась. Повторите выход, чтобы проверить её снова."); return;
		}
		for (const boundary of transientBoundaries.current) if (boundary.inspect().hasDraft) boundary.cancelDraft();
		if (isRenameProjectOpen) cancelRenameProject();
		if (hasRawProjectNameDraft) { setName(""); setNameError(undefined); }
		if (hasRawDimensionDraft) { setDimensions(baselineDimensions); setDimensionError(undefined); }
		if (hasRawSelectedItemDraft) cancelSelectedItemNumericDraft();
		if (hasRawRoomPropertyDraft || roomHeightOpeningConflict) cancelRoomHeightOpeningConflict();
		if (hasRawPlaceholderDraft) { setPlaceholderFields(itemFields); setPlaceholderComposerError(undefined); }
		if (hasRawWallPositionDraft) for (const item of project?.assetInstances ?? []) if (item.anchorClass === "wall") cancelWallItemPositionDraft(item);
		if (hasRawCustomImportDraft) { cancelFbxConversion(); ++customGlbImportRequestRef.current; setCustomGlbImport({ kind: "idle" }); }
		setItemColorVariantDraft(undefined);
		if (openingCreationDraft) closeOpeningCreationDraft();
		if (openingDraft) cancelOpeningDraft();
		if (activeTool === "item") cancelItemPlacement();
		setWallItemDraft(undefined); setWallItemDraftFields(undefined); setCatalogWallModelDraft(undefined);
		setWallAddHostConflict(undefined); setWallDeletionConflict(undefined); setVertexDeletionCandidate(undefined);
		setHasTransientPlanEdit(false); setHasTransientThreeDimensionalEdit(false);
		continueEditorDraft();
		if (exitCopy) void returnToProjects(exitCopy);
	}} /> : null;

	if (state.kind === "projects") {
		return (
			<main data-editor-host={hostNavigation ? "telegram" : undefined} className={styles.startShell}>
				{localFilePanel}
				{sourceRecoveryPanel}
 {readonlySourceRecoveryPanel}
 <LegacyStartupRecoveryNotice getRecovery={getLegacyStartupRecovery} />
				{registeredTransferFileInput}
				{hostBackGuard}
				{hostBackNotice ? <p role="status">{hostBackNotice}</p> : null}
				<section
					aria-labelledby="projects-heading"
					className={styles.createCard}
					data-testid="project-hub"
				>
					<header className={styles.projectHubHeading}>
						<h1 id="projects-heading" ref={projectsHeadingRef} tabIndex={-1}>
							Проекты
						</h1>
						<p>Планы на этом устройстве</p>
					</header>
					<div
						className={styles.projectHubActions}
						data-testid="project-hub-actions"
					>
						<button
							className={styles.primaryAction}
							disabled={!legacyCreationAllowed}
 onClick={() => controller.startNewProject()}
							type="button"
						>
							Новый проект
						</button>
						<input
							accept="application/json,.json,application/zip,.interiors"
							aria-label="Импортировать проект"
							className={styles.visuallyHidden}
							disabled={projectTransferImport.kind !== "idle"}
							id="import-project-transfer"
							onChange={(event) =>
								void importProjectTransferFile(event.currentTarget.files?.[0])
							}
							ref={projectTransferInputRef}
							type="file"
						/>
						<button
							className={styles.secondaryAction}
							disabled={projectTransferImport.kind !== "idle"}
							onClick={() => projectTransferInputRef.current?.click()}
							type="button"
						>
							Импортировать проект
						</button>
						{registeredTransferImport ? <>
							<button className={styles.secondaryAction} type="button" disabled={projectTransferImport.kind !== "idle"} onClick={() => registeredTransferInputRef.current?.click()}>Импорт файла для переноса</button>
						</> : null}
					</div>
					<input
						hidden
						ref={recoveryDraftInputRef}
						type="file"
						accept=".json,application/json"
						aria-label="Выбрать файл несохранённой правки"
						onChange={(event) => {
							void restoreRecoveryDraftFile(event.currentTarget.files?.[0]);
							event.currentTarget.value = "";
						}}
					/>
					<button
						className={styles.secondaryAction}
						disabled={projectTransferImport.kind !== "idle"}
						onClick={() => recoveryDraftInputRef.current?.click()}
						type="button"
					>
						Восстановить несохранённую правку
					</button>
					{projectTransferImport.kind !== "idle" ? (
						<div
							className={styles.projectTransferStatus}
							data-testid="project-transfer-import-status"
							role="status"
						>
							<span>{projectTransferProgressCopy(projectTransferImport)}</span>
							<progress
								aria-label="Прогресс импорта проекта"
								max={4}
								value={projectTransferProgress(projectTransferImport)}
							/>
							{projectTransferImport.kind !== "saving" &&
							projectTransferImport.kind !== "cancelling" ? (
								<button onClick={cancelProjectTransferImport} type="button">
									Отменить импорт
								</button>
							) : null}
						</div>
					) : null}
					{projectTransferError ? (
						<p className={styles.fieldError} role="alert">
							{projectTransferError}
						</p>
					) : null}
					{state.recoveryNeeded ? (
						<p className={styles.fieldError} role="alert">
							{state.projects.length > 0
                                ? "Один из локальных проектов требует восстановления. Остальные доступны."
                                : "Локальные записи требуют проверки и восстановления."}
						</p>
					) : null}
                    {state.recoveryNeeded && state.projects.length === 0 ? (
                        <section className={safetyStyles.card} data-testid="project-recovery-screen" aria-labelledby="directory-recovery-heading">
                            <h2 id="directory-recovery-heading">Проект требует восстановления</h2>
                            <p role="status">Нужно восстановление</p>
                            <p>Не удалось проверить сохранённую версию. Исходные записи не изменены. Доступные исходники можно подготовить отдельно.</p>
                            <button className={safetyStyles.primary} type="button" onClick={() => void controller.showProjects()}>Повторить проверку</button>
                        </section>
                    ) : null}
					{!legacyCreationAllowed ? <p role="status">Создание и редактирование проектов Web/PWA сейчас недоступны.</p> : null}
                    {state.storageSources ? <ProjectStorageStatus sources={state.storageSources.filter(source=>!readonlyStorageSources?.includes(source.storageNamespace))} onRetry={() => void controller.showProjects()} /> : null}
					{state.projects.length === 0 ? (projectDirectoryEmptyLabel(state.storageSources, state.recoveryNeeded === true) ? (
						<section
							aria-label="Пустой список проектов"
							className={styles.projectDirectoryEmpty}
							data-testid="project-directory-empty"
						>
							<span
								aria-hidden="true"
								className={styles.projectDirectoryGrid}
							/>
							<strong>{projectDirectoryEmptyLabel(state.storageSources, state.recoveryNeeded === true)}</strong>
						</section>
					) : null) : (
						<ul
							className={state.storageSources ? `${styles.projectDirectory} ${styles.scopedProjectDirectory}` : styles.projectDirectory}
							data-testid="project-directory"
						>
							{projectDirectoryCards(state.projects, state.storageSources !== undefined).map(({ summary, key, storageLabel, copyLabel, spokenName, ownerConfirmed }) => (
								<li
									className={styles.projectDirectoryCard}
									key={key}
									data-project-storage={summary.storageNamespace}
								>
									<button
										aria-label={`Открыть ${spokenName}`}
										disabled={!ownerConfirmed || isLegacyOwnerReadOnly(summary.storageNamespace)}
										className={styles.projectCardOpen}
										onClick={() =>
											summary.storageNamespace === undefined ? void controller.openProject(summary.projectId) : void controller.openProject(summary.projectId, { storageNamespace: summary.storageNamespace })
										}
										type="button"
									>
										<span
											aria-hidden="true"
											className={styles.projectCardPreview}
										>
											<svg aria-hidden="true" fill="none" viewBox="0 0 48 48">
												<path
													d="M10 9h20l8 8v22H10V9Z M30 9v9h8 M17 26h14 M17 32h9"
													stroke="currentColor"
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth="1.5"
												/>
											</svg>
										</span>
										<span className={styles.projectCardCopy}>
											<strong>{summary.name}</strong>
											{storageLabel ? <small>{storageLabel}</small> : null}
											{copyLabel ? <small>{copyLabel}</small> : null}
											<small>
												{projectDirectoryUpdatedCopy(summary.updatedAt)}
											</small>
										</span>
									</button>
									<button
										aria-label={`Удалить проект ${spokenName}`}
										disabled={!ownerConfirmed || isLegacyOwnerReadOnly(summary.storageNamespace)}
										className={styles.projectDeleteAction}
										onClick={(event) => {
											directoryDeletionTriggerRef.current = event.currentTarget;
											setProjectDeletionError(undefined);
											setDirectoryDeletionTarget({
												projectId: summary.projectId,
												name: spokenName,
												storageNamespace: summary.storageNamespace,
											});
										}}
										type="button"
									>
										<svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
											<path
												d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"
												stroke="currentColor"
												strokeWidth="1.7"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									</button>
									<details className={styles.projectDirectoryActions}>
										<summary aria-label={`Действия для ${spokenName}`}>
											<span aria-hidden="true">•••</span>
										</summary>
										<div>
											<button
												aria-label={`Переименовать ${spokenName}`}
												disabled={!ownerConfirmed || isLegacyOwnerReadOnly(summary.storageNamespace)}
												onClick={() =>
													renameProjectFromDirectory(summary.projectId, summary.storageNamespace)
												}
												type="button"
											>
												Переименовать
											</button>
											<button
												aria-label={`Экспортировать проект ${spokenName}`}
												disabled={!ownerConfirmed}
												onClick={() =>
													void exportProjectTransfer(summary.projectId, false, summary.storageNamespace)
												}
												type="button"
											>
												Экспортировать проект
											</button>
											{registeredTransferExport ? <button type="button" aria-label={`Экспорт файла для переноса: ${spokenName}`} disabled={!ownerConfirmed} onClick={() => void exportProjectTransfer(summary.projectId, true, summary.storageNamespace)}>Экспорт файла для переноса</button> : null}
										</div>
									</details>
								</li>
							))}
						</ul>
					)}
				</section>
				{directoryDeletionTarget ? (
					<ProjectConfirmationDialog
						label="Удалить проект"
						title="Удалить проект навсегда?"
						cancelLabel="Оставить проект"
						confirmLabel="Удалить навсегда"
						busyLabel="Удаляем…"
						busy={isDeletingProject}
						error={projectDeletionError}
						onCancel={() => setDirectoryDeletionTarget(undefined)}
						onConfirm={() => void permanentlyDeleteDirectoryProject()}
						returnFocusRef={directoryDeletionTriggerRef}
						fallbackFocusRef={projectsHeadingRef}
					>
						<p>{projectDeletionTargetText(directoryDeletionTarget.name)}</p>
						<p>
							Проект и его локальные версии будут удалены без возможности
							восстановления. Это действие нельзя отменить.
						</p>
					</ProjectConfirmationDialog>
				) : null}
				<PwaInstallGuide pwaInstall={pwaInstall} />
				<PwaUpdateNotice
					canActivate={canActivatePwaUpdate}
					hasUndurableDraft={hasUndurableEditorDraft}
					pwaUpdate={pwaUpdate}
				/>
 {readonlyDetails}
 {diagnosticDetails}
			</main>
		);
	}

	if (!project) {
		return (
			<main
				className={
					state.kind === "recovery-needed"
						? safetyStyles.page
						: styles.startShell
				}
			>
				{localFilePanel}
				{sourceRecoveryPanel}
 {readonlySourceRecoveryPanel}
 <LegacyStartupRecoveryNotice getRecovery={getLegacyStartupRecovery} />
				{registeredTransferFileInput}
				{hostBackGuard}
				{hostBackNotice ? <p role="status">{hostBackNotice}</p> : null}
				<section
					aria-labelledby="create-heading"
					className={
						state.kind === "recovery-needed"
							? safetyStyles.card
							: styles.createCard
					}
					data-testid={
						state.kind === "recovery-needed"
							? "project-recovery-screen"
							: undefined
					}
				>
					{state.kind === "first-run" || state.kind === "recovery-needed" ? (
						<button
							aria-label="Вернуться к проектам"
							data-editor-host-back={fullTransientNavigationProtection ? "back" : undefined}
							className={
								state.kind === "recovery-needed"
									? safetyStyles.back
									: styles.projectCreationBack
							}
							disabled={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
							onClick={() => {
								if (isNavigationProtected) { requestEditorBack(true); return; }
								setIsRecoveryRemovalConfirmationOpen(false);
								setCustomGlbRepairError(undefined);
								setRecoveryRemovalError(undefined);
								void controller.showProjects();
							}}
							type="button"
						>
							‹ Назад
						</button>
					) : null}
					<h1 id="create-heading">
						{state.kind === "recovery-needed"
							? "Проект требует восстановления"
							: "Новый проект"}
					</h1>
					{state.kind !== "recovery-needed" ? (
						<form
							className={styles.createForm}
							noValidate
							onSubmit={submitProject}
						>
							<label htmlFor="project-name">Название проекта</label>
							<input
								aria-describedby={nameError ? "project-name-error" : undefined}
								aria-invalid={nameError ? "true" : undefined}
								autoComplete="off"
								disabled={isWorking || state.kind === "persist-failed"}
								id="project-name"
								onChange={(event) => setName(event.target.value)}
								value={name}
							/>
							{nameError ? (
								<p
									className={styles.fieldError}
									id="project-name-error"
									role="alert"
								>
									{nameError}
								</p>
							) : null}
							<button
								className={styles.primaryAction}
								disabled={isWorking || state.kind === "persist-failed"}
								type="submit"
							>
								{state.kind === "saving" ? "Сохранение…" : "Создать проект"}
							</button>
						</form>
					) : null}
					{state.kind !== "first-run" ? (
						<span className={styles.startStatus} role="status">
							{isWriterLeaseReadOnly ? "Только просмотр" : statusCopy(state)}
						</span>
					) : null}
					{state.kind === "recovery-needed" ? (
						<p data-testid="resource-recovery-diagnostic">
							{recoveryRemovalSummary
								? "Некоторые модели отсутствуют или повреждены. Редактирование остановлено. Восстановите точные исходные файлы или выберите удаление недоступных моделей."
								: "Не удалось проверить сохранённую версию. Локальные данные оставлены на устройстве. Повторите проверку или вернитесь к списку проектов."}
						</p>
					) : null}
					{state.kind === "persist-failed" ? (
						<section
							className={safetyStyles.card}
							data-testid="project-creation-failure"
						>
							<div className={safetyStyles.message} role="alert">
								<h2>Не удалось создать проект</h2>
								<p>
									{state.reasonCode === "PERSISTENCE_QUOTA_EXCEEDED"
										? "В локальном хранилище недостаточно места. Освободите место и повторите сохранение."
										: "Проект ещё не сохранён на устройстве. Повторите сохранение."}
								</p>
							</div>
							<button
								className={safetyStyles.primary}
								onClick={retryOrOpenNewHistoryBoundary}
								type="button"
							>
								{persistenceFailureActionCopy(state.reasonCode, retryPolicy)}
							</button>
						</section>
					) : null}
					{state.kind === "recovery-needed" ? (
						<div className={safetyStyles.recoveryActions}>
							{recoveryRemovalSummary ? (
								<ResourceRepairControls
									busy={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
									error={customGlbRepairError}
									onGlbFiles={(files) =>
										void repairCustomGlbResourceFiles(files)
									}
									onBackupFile={(file) => void repairFromPortableBackup(file)}
								/>
							) : null}
							{recoveryRemovalSummary ? (
								<div>
									<p>
										Размещённых предметов:{" "}
										{recoveryRemovalSummary.affectedAssetInstanceCount}.
										Недоступных описаний моделей:{" "}
										{recoveryRemovalSummary.affectedAssetDefinitionCount}.
									</p>
									<p>Это действие нельзя отменить через историю.</p>
									{isRecoveryRemovalConfirmationOpen ? (
										<div aria-live="assertive" role="alert">
											<p>
												Будет создана новая версия без всех недоступных моделей.
											</p>
											<button
												className={safetyStyles.danger}
												disabled={
													isRepairingCustomGlb || isRemovingUnresolvedCustomGlb
												}
												onClick={() =>
													void removeUnresolvedCustomGlbReferences()
												}
												type="button"
											>
												{isRemovingUnresolvedCustomGlb
													? "Удаляем недоступные модели…"
													: "Подтвердить удаление всех недоступных моделей"}
											</button>
											<button
												className={styles.textAction}
												disabled={
													isRepairingCustomGlb || isRemovingUnresolvedCustomGlb
												}
												onClick={() =>
													setIsRecoveryRemovalConfirmationOpen(false)
												}
												type="button"
											>
												Отмена
											</button>
										</div>
									) : (
										<button
											className={safetyStyles.danger}
											disabled={
												isRepairingCustomGlb || isRemovingUnresolvedCustomGlb
											}
											onClick={() => setIsRecoveryRemovalConfirmationOpen(true)}
											type="button"
										>
											Удалить все недоступные модели
										</button>
									)}
									{recoveryRemovalError ? (
										<p className={styles.fieldError} role="alert">
											{recoveryRemovalError}
										</p>
									) : null}
								</div>
							) : null}
							{isWriterLeaseReadOnly ? (
								<WriterLeaseNotice
									onRecoveryExport={() => void downloadRecoveryDraft()}
									error={writerTakeoverError}
									hasRecoveryCopy={writerRecoveryCopy !== undefined}
									isConfirming={isWriterTakeoverConfirmationOpen}
									isShowingRecoveryCopy={isShowingWriterRecoveryCopy}
									isTakingOver={isTakingOverWriterLease}
									onCancel={cancelWriterTakeover}
									onConfirm={() => void takeOverWriterLease()}
									onRequestTakeOver={() => {
										setWriterTakeoverError(undefined);
										setIsWriterTakeoverConfirmationOpen(true);
									}}
									onToggleRecoveryCopy={() =>
										setIsShowingWriterRecoveryCopy((visible) => !visible)
									}
								/>
							) : null}
							<button
								className={
									recoveryRemovalSummary ? undefined : safetyStyles.primary
								}
								disabled={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
								onClick={() => void controller.recover()}
								type="button"
							>
								Повторить проверку
							</button>
						</div>
					) : null}
				</section>
				<PwaInstallGuide pwaInstall={pwaInstall} />
				<PwaUpdateNotice
					canActivate={canActivatePwaUpdate}
					hasUndurableDraft={hasUndurableEditorDraft}
					pwaUpdate={pwaUpdate}
				/>
 {readonlyDetails}
 {diagnosticDetails}
			</main>
		);
	}

	const isStarterContourVisible =
		project.schemaVersion === 1 &&
		!metrics &&
		project.level.vertices.length === 0 &&
		activeTool === "select" &&
		viewMode === "plan";
	const storagePressureNotice =
		storagePressure.kind === "warning" ||
		storagePressure.kind === "critical" ? (
			<aside
				aria-live="polite"
				className={styles.storagePressure}
				data-risk={storagePressure.kind}
				data-testid="storage-pressure"
				role="status"
			>
				<strong>
					{storagePressure.kind === "critical"
						? "Риск заполнения хранилища"
						: "Хранилище почти заполнено"}
				</strong>
				<p>{storagePressureCopy(storagePressure)}</p>
				<button
					disabled={isRequestingPersistentStorage}
					onClick={() => void requestPersistentStorage()}
					type="button"
				>
					{isRequestingPersistentStorage
						? "Запрашиваем защиту…"
						: "Запросить защиту хранилища"}
				</button>
				{persistentStorageRequest ? (
					<p data-testid="storage-persistence-status">
						{persistentStorageRequestCopy(persistentStorageRequest)}
					</p>
				) : null}
				{pwaBrowseCache ? (
					<>
						<button
							disabled={isClearingBrowseCache}
							onClick={() => void clearBrowseCache()}
							type="button"
						>
							{isClearingBrowseCache
								? "Очищаем кэш…"
								: "Освободить место в кэше"}
						</button>
						{browseCacheCleanup ? (
							<p data-testid="browse-cache-cleanup-status">
								{browseCacheCleanup.kind === "cleared"
									? "Кэш повторно загружаемых данных очищен. Сохранённые проекты и модели не затронуты."
									: "Не удалось очистить кэш каталога. Экспортируйте проект перед следующей правкой."}
							</p>
						) : null}
					</>
				) : null}
				<button data-editor-host-back={fullTransientNavigationProtection ? "projects" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(true) : void returnToProjects()} type="button">
					К проектам и экспорту
				</button>
			</aside>
		) : hasCheckedStoragePressure && storagePressure.kind === "unavailable" ? (
			<aside
				aria-live="polite"
				className={styles.storagePressure}
				data-risk="unavailable"
				data-testid="storage-estimate-unavailable"
				role="status"
			>
				<strong>Не удалось оценить свободное место</strong>
				<p>
					Точный 2D-план и локальное сохранение остаются доступны, но браузер не
					сообщает остаток хранилища. Перед важной работой создайте резервную
					копию проекта.
				</p>
				<button data-editor-host-back={fullTransientNavigationProtection ? "projects" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(true) : void returnToProjects()} type="button">
					К проектам и экспорту
				</button>
			</aside>
		) : null;

	return (
		<main
			data-editor-host={hostNavigation ? "telegram" : undefined}
			className={styles.editorShell}
			data-healthy-offline-status={isHealthyOfflineStatusVisible}
			data-testid="editor-workspace"
			data-view-mode={viewMode}
		>
			{localFilePanel}
				{sourceRecoveryPanel}
 {readonlySourceRecoveryPanel}
 <LegacyStartupRecoveryNotice presentation="floating" getRecovery={getLegacyStartupRecovery} />
			{registeredTransferFileInput}
				{hostBackGuard}
				{hostBackNotice ? <p role="status">{hostBackNotice}</p> : null}
            {hasRetainedHistoryTarget ? <aside className={`${safetyStyles.card} ${safetyStyles.floating}`} data-testid="retained-publication-notice" role="status">
                <strong>Есть несохранённая правка</strong>
                <p>На экране — последняя сохранённая версия. Сначала сохраните отдельную копию правки.</p>
                <button type="button" onClick={() => void downloadRecoveryDraft()}>Скачать копию для восстановления</button>
                {projectTransferError ? <p role="alert">{projectTransferError}</p> : null}
            </aside> : null}
			{state.kind === "persist-failed" && !isRenameProjectOpen ? (
				<SaveFailureNotice
					actionLabel={persistenceFailureActionCopy(state.reasonCode, retryPolicy)}
					description={retryPolicy === "registered-transfer-reselection-required" ? "Несохранённая правка доступна для экспорта восстановления. Чтобы повторить импорт, выберите исходный файл снова. Существующие проекты не изменены." : persistenceFailureCopy(state.reasonCode)}
					exportError={projectTransferError}
					onExport={() => void exportProjectTransfer()}
					onRecoveryExport={() => void downloadRecoveryDraft()}
					onRetry={retryOrOpenNewHistoryBoundary}
				/>
			) : null}
			{state.kind === "recovery-needed" ? (
				<aside
					className={`${safetyStyles.card} ${safetyStyles.floating}`}
					data-testid="resource-recovery-projection-notice"
				>
					<section
						data-testid="project-recovery-screen"
						className={safetyStyles.recoveryActions}
					>
						<h2>Проект требует восстановления</h2>
						<p data-testid="resource-recovery-diagnostic">
							Редактирование остановлено. Показана проверенная геометрия только
							для просмотра. Недоступные модели временно скрыты; сохранённый
							проект не изменён.
						</p>
						{recoveryRemovalSummary ? (
							<p>
								Размещённых предметов:{" "}
								{recoveryRemovalSummary.affectedAssetInstanceCount}. Недоступных
								описаний моделей:{" "}
								{recoveryRemovalSummary.affectedAssetDefinitionCount}.
							</p>
						) : null}
						<ResourceRepairControls
							busy={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
							error={customGlbRepairError}
							onGlbFiles={(files) => void repairCustomGlbResourceFiles(files)}
							onBackupFile={(file) => void repairFromPortableBackup(file)}
						/>
						{recoveryRemovalSummary ? (
							<button
								className={safetyStyles.danger}
								disabled={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
								onClick={() => setIsRecoveryRemovalConfirmationOpen(true)}
								type="button"
							>
								Удалить все недоступные модели
							</button>
						) : null}
						<button
							disabled={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
							onClick={() => void controller.recover()}
							type="button"
						>
							Повторить проверку
						</button>
						<button
							disabled={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
							data-editor-host-back={fullTransientNavigationProtection ? "projects" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(true) : void returnToProjects()}
							type="button"
						>
							Вернуться к проектам
						</button>
					</section>
				</aside>
			) : null}
			<section
				className={styles.canvasArea}
				id="editor-canvas"
				ref={editorCanvasRef}
			>
				<span
					aria-live="polite"
					className={styles.durabilityStatus}
					data-testid="project-durability-status"
					data-visible-status="true"
					role="status"
				>
					{isShowingWriterRecoveryCopy
						? "Recovery-копия — только просмотр"
						: isWriterLeaseReadOnly
							? "Только просмотр"
							: statusCopy(state)}
				</span>
				{isHistoryResourceRecovery && !isHistoryDiscardConfirmationOpen ? (
					<aside
						aria-live="assertive"
						className={`${safetyStyles.card} ${safetyStyles.floating}`}
						data-testid="history-resource-recovery-notice"
						role="alert"
					>
						<h2>Недоступная модель находится только в истории</h2>
						<ResourceRepairControls
							busy={isRepairingCustomGlb}
							error={customGlbRepairError}
							onGlbFiles={(files) => void repairCustomGlbResourceFiles(files)}
							onBackupFile={(file) => void repairFromPortableBackup(file)}
						/>
						<p>
							Текущий план сохранён и доступен для экспорта, но редактирование,
							«Отменить» и «Повторить» остановлены до восстановления модели или
							явной очистки истории.
						</p>
						<button
							className={safetyStyles.primary}
							onClick={() => void controller.refreshSessionHistoryIntegrity()}
							type="button"
						>
							Проверить историю снова
						</button>
						<button
							ref={historyDiscardTriggerRef}
							onClick={() => {
								setHistoryDiscardError(undefined);
								setIsHistoryDiscardConfirmationOpen(true);
							}}
							type="button"
						>
							Очистить историю
						</button>
					</aside>
				) : null}
				{!isStarterContourVisible ? storagePressureNotice : null}

				{viewMode === "three-dimensional" && threeDimensionalScene ? (
					<RoomScene3d
						registerTransientBoundary={fullTransientNavigationProtection ? registerTransientBoundary : undefined}
						assessItemPlacement={(point) => {
							if (
								project?.schemaVersion !== 1 ||
								!threeDimensionalOrigin ||
								!itemPlacementDraft
							) {
								return false;
							}
							const xMm = Math.round(
								point.xM * 1000 + threeDimensionalOrigin.xMm,
							);
							const zMm = Math.round(
								point.zM * 1000 + threeDimensionalOrigin.zMm,
							);
							const roomId = findRoomForFloorItem(project, {
								depthMm: itemPlacementDraft.depthMm,
								yawStep: itemPlacementDraft.yawStep,
								widthMm: itemPlacementDraft.widthMm,
								xMm,
								zMm,
							});
							return (
								!!roomId &&
								assessParametricFloorItemPlacement(project, {
									...itemPlacementDraft,
									roomId,
									xMm,
									zMm,
								}).kind !== "invalid"
							);
						}}
						customGlbResourceStates={customGlbResourceStates}
						canTransformSelectedItem={!selectedItemLocked}
						customGlbResources={customGlbResources}
						itemPlacementDraft={
							activeTool === "item" ? itemPlacementDraft : undefined
						}
						onItemPlacementYawChange={changeItemPlacementYaw}
						onCancelItemPlacement={() => {
							cancelItemPlacement();
						}}
						onClearSelection={clearSelection}
						onMoveItem={async (input) => {
							if (!threeDimensionalOrigin) return false;
							return moveItem({
								assetInstanceId: input.assetInstanceId,
								xMm: Math.round(input.xM * 1000 + threeDimensionalOrigin.xMm),
								zMm: Math.round(input.zM * 1000 + threeDimensionalOrigin.zMm),
							});
						}}
						onOpenItemCatalog={openBuiltInCatalog}
						onOpenPlan={() => setViewMode("plan")}
						onPwaUpdateSafetyChange={setHasTransientThreeDimensionalEdit}
						onPlaceItem={async (point) => {
							if (!threeDimensionalOrigin) return;
							await placeItem({
								xMm: Math.round(point.xM * 1000 + threeDimensionalOrigin.xMm),
								zMm: Math.round(point.zM * 1000 + threeDimensionalOrigin.zMm),
							});
						}}
						onRotateItem={rotateItem}
						onSelectItem={selectItem}
						readOnly={isEditorReadOnly || isMutationBlocked}
						scene={threeDimensionalScene}
						selectedItemId={selectedItemId}
					/>
				) : (
					<PlanProjection
						registerTransientBoundary={fullTransientNavigationProtection ? registerTransientBoundary : undefined}
						dimensionVisibility={dimensionVisibility}
						openingMoveErrorCopy={errorCopy}
						activeTool={activeTool}
						isInteractionLocked={isOpeningDialogOpen}
						isWallMoveMode={isWallMoveMode}
						isWallSplitMode={isWallSplitMode}
						isWallVertexMoveMode={isWallVertexMoveMode}
						movableWallVertexIds={movableSelectedWallVertexIds}
						openingCreationPreview={openingCreationPreview}
						openingMovePreview={
							openingDraft?.isMove
								? {
										openingId: openingDraft.openingId,
										offsetMm: Number(openingDraft.offsetMm),
									}
								: undefined
						}
						itemDraft={fullTransientNavigationProtection && !isItemPlacementActive ? undefined : itemPlacementDraft}
						readOnly={
							isEditorReadOnly ||
							isWorking ||
							state.kind === "persist-failed" ||
							state.kind === "recovery-needed" ||
							wallAddHostConflict !== undefined ||
							openingCreationDraft !== undefined
						}
						onItemPlacementYawChange={changeItemPlacementYaw}
						onCancelItemPlacement={() => {
							cancelItemPlacement();
						}}
						onDrawWall={drawWall}
						onDrawingVisibilityChange={setIsDrawingVisible}
						onMoveDoorOpening={moveSelectedDoorOpening}
						onMoveItem={moveItem}
						onMoveWall={publishWallMove}
						onMoveWallVertex={publishWallVertexMove}
						onPwaUpdateSafetyChange={setHasTransientPlanEdit}
						onResolveSplitHostConflict={resolveWallSplitHostConflict}
						onSplitWall={publishWallSplit}
						onRotateItem={rotateItem}
						onPlaceItem={(point) => placeItem(point)}
						onSelectItem={selectItem}
						onSelectWall={selectWall}
						onClearSelection={clearSelection}
						onSelectOpening={selectOpening}
						onWallMoveModeChange={setIsWallMoveMode}
						onWallSplitModeChange={setIsWallSplitMode}
						onWallVertexMoveModeChange={setIsWallVertexMoveMode}
						project={project}
						selectedItemId={selectedItemId}
						selectedWallId={selectedWallId}
						wallThicknessMm={wallThicknessMm}
						setViewport={(update) => setViewport(update)}
						viewport={viewport}
					/>
				)}

				<header
					className={styles.editorTopBar}
					data-testid="editor-top-bar"
					ref={editorTopBarRef}
				>
					<button
						aria-label={hostNavigation ? "Назад" : "Вернуться к проектам"}
						data-editor-host-back={fullTransientNavigationProtection ? "back" : undefined}
						className={styles.editorBackAction}
						disabled={
							isWorking || isRepairingCustomGlb || isRemovingUnresolvedCustomGlb
						}
						onClick={() => isNavigationProtected ? requestEditorBack() : void returnToProjects()}
						type="button"
					>
						Назад
					</button>
					<button
						aria-label={`Переименовать проект ${project.name}`}
						className={styles.projectIdentity}
						disabled={isEditorReadOnly || isMutationBlocked}
						onClick={openRenameProject}
						ref={renameProjectTriggerRef}
						type="button"
					>
						<span>{project.name}</span>
					</button>
					<span
						aria-live="polite"
						className={styles.editorSaveState}
						role="status"
					>
						{editorSaveState}
					</span>
					{!isItemPlacementSurfaceActive && !openingCreationDraft ? (
						<button
							aria-controls="editor-secondary-actions"
							aria-expanded={isEditorActionMenuOpen}
							aria-haspopup="dialog"
							aria-label="Открыть остальные действия"
							ref={editorHeaderMenuRef}
							className={styles.editorHeaderMenuTrigger}
							onClick={() => setIsEditorActionMenuOpen((isOpen) => !isOpen)}
							type="button"
						>
							<svg
								aria-hidden="true"
								data-testid="more-actions-icon"
								fill="currentColor"
								height="24"
								viewBox="0 0 24 24"
								width="24"
							>
								<circle cx="6" cy="12" r="1.65" />
								<circle cx="12" cy="12" r="1.65" />
								<circle cx="18" cy="12" r="1.65" />
							</svg>
						</button>
					) : null}
					<div className={styles.editorViewRow}>
						<fieldset
							aria-label="Переключить вид редактора"
							className={styles.editorViewSwitch}
							data-testid="editor-view-switch"
						>
							<legend className={styles.visuallyHidden}>
								Переключить вид редактора
							</legend>
							<button
								aria-label="План 2D"
								aria-pressed={viewMode === "plan"}
								disabled={openingCreationDraft !== undefined}
								onClick={() => setViewMode("plan")}
								type="button"
							>
								План
							</button>
							<button
								aria-pressed={viewMode === "three-dimensional"}
								disabled={
									!threeDimensionalScene || openingCreationDraft !== undefined
								}
								onClick={() => setViewMode("three-dimensional")}
								type="button"
							>
								3D
							</button>
						</fieldset>
						{viewMode === "plan" ? (
							<button
								aria-label="Настроить размеры"
								aria-haspopup="dialog"
								aria-expanded={isDimensionFilterOpen}
								className={styles.dimensionFilterTrigger}
								disabled={hasUndurableEditorDraft || isWorking}
								ref={dimensionFilterTriggerRef}
								type="button"
								onClick={() => {
									setIsEditorActionMenuOpen(false);
									setIsPlanInspectorOpen(false);
									setIsRoomDirectoryOpen(false);
									setIsDimensionFilterOpen(true);
								}}
							>
								<svg
									aria-hidden="true"
									data-testid="dimension-filter-icon"
									viewBox="0 0 24 24"
									fill="none"
								>
									<path
										d="M4 6h16M7 12h10M10 18h4"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
									/>
								</svg>
								<span>Размеры</span>
							</button>
						) : null}
					</div>
				</header>
				{isHealthyOfflineStatusVisible ? (
					<p
						aria-live="polite"
						className={styles.healthyOfflineStatus}
						data-testid="healthy-offline-status"
						role="status"
					>
						Офлайн — работаем на устройстве
					</p>
				) : null}

				{isRenameProjectOpen ? (
					<RenameProjectDialog
						name={renameProjectName}
						error={renameProjectError}
						busy={isWorking}
						blocked={isMutationBlocked}
						canRetry={isPersistenceFailure}
						onChange={setRenameProjectName}
						onSubmit={(event) => void submitRenameProject(event)}
						onRetry={() => void retryRenameProjectPublication()}
						onCancel={cancelRenameProject}
						returnFocusRef={renameProjectTriggerRef}
					/>
				) : null}

				{!isItemPlacementSurfaceActive && !openingCreationDraft ? (
					<>
						<nav aria-label="Инструменты редактора" className={styles.toolRail}>
							<span
								aria-live="polite"
								className={styles.railActiveTool}
								data-testid="active-tool-chip"
							>
								{activeEditorModeCopy(viewMode, activeTool)}
							</span>
							<div
								className={styles.editorActionDock}
								data-testid="editor-action-dock"
								ref={editorActionDockRef}
							>
								{isWallOpeningDockContext ? (
									<button
										aria-label="Добавить проём"
										className={`${styles.dockAction} ${styles.roomDockAction}`}
										disabled={
											isEditorReadOnly ||
											isMutationBlocked ||
											!canOpenOpeningCreationDraft ||
											state.kind === "recovery-needed"
										}
										onClick={activateOpeningTool}
										ref={openingCreationActionRef}
										type="button"
									>
										<svg
											aria-hidden="true"
											fill="none"
											height="24"
											viewBox="0 0 24 24"
											width="24"
										>
											<rect
												height="13"
												rx="1"
												stroke="currentColor"
												strokeWidth="1.8"
												width="15"
												x="4.5"
												y="5.5"
											/>
											<path
												d="M12 5.5v13M4.5 12h15"
												stroke="currentColor"
												strokeWidth="1.8"
											/>
										</svg>
										<span>Добавить проём</span>
									</button>
								) : (
									<button
										aria-label="Комната"
										ref={roomDockActionRef}
										aria-pressed={isRoomDirectoryOpen}
										className={`${styles.dockAction} ${styles.roomDockAction}`}
										disabled={
											isWorking ||
											isEditorReadOnly ||
											editableRooms.length === 0
										}
										onClick={openRoomDirectory}
										type="button"
									>
										<svg
											aria-hidden="true"
											fill="none"
											height="24"
											viewBox="0 0 24 24"
											width="24"
										>
											<path
												d="M4.5 5.5h15v13h-15zM11.5 5.5v8h8M4.5 13.5h7"
												stroke="currentColor"
												strokeLinejoin="round"
												strokeWidth="1.8"
											/>
										</svg>
										<span>Комната</span>
									</button>
								)}
								<button
									aria-label="Рука и выбор"
									aria-pressed={activeTool === "select"}
									className={styles.selectToolButton}
									onClick={activateSelectTool}
									type="button"
								>
									<svg
										aria-hidden="true"
										data-testid="select-tool-icon"
										fill="none"
										height="24"
										viewBox="0 0 24 24"
										width="24"
									>
										<path
											d="M5 3.5 18.5 13l-6.2 1.8L9.8 21 5 3.5Z"
											stroke="currentColor"
											strokeLinejoin="round"
											strokeWidth="2"
										/>
										<path
											d="m14 15 4.2 4.2"
											stroke="currentColor"
											strokeLinecap="round"
											strokeWidth="2"
										/>
									</svg>
									<span>Рука и выбор</span>
								</button>
								{isWallOpeningDockContext ? (
									<button
										aria-label="Свойства"
										ref={selectionPropertiesTriggerRef}
										className={`${styles.dockAction} ${styles.wallDockAction}`}
										disabled={isEditorReadOnly || isMutationBlocked}
										onClick={openSelectionProperties}
										type="button"
									>
										<svg
											aria-hidden="true"
											data-testid="wall-tool-icon"
											fill="none"
											height="24"
											viewBox="0 0 24 24"
											width="24"
										>
											<path
												d="M5 4.5h14v15H5zM9.7 4.5v15M14.4 4.5v15"
												stroke="currentColor"
												strokeLinejoin="round"
												strokeWidth="1.8"
											/>
											<path
												d="M5 10h14"
												stroke="currentColor"
												strokeWidth="1.8"
											/>
										</svg>
										<span>Свойства</span>
									</button>
								) : (
									<button
										aria-label="Стена"
										aria-pressed={activeTool === "wall"}
										className={`${styles.dockAction} ${styles.wallDockAction}`}
										disabled={
											isEditorReadOnly ||
											isMutationBlocked ||
											state.kind === "recovery-needed"
										}
										onClick={() => void activateWallTool()}
										ref={wallToolButtonRef}
										type="button"
									>
										<svg
											aria-hidden="true"
											data-testid="wall-tool-icon"
											fill="none"
											height="24"
											viewBox="0 0 24 24"
											width="24"
										>
											<path
												d="M5 4.5h14v15H5zM9.7 4.5v15M14.4 4.5v15"
												stroke="currentColor"
												strokeLinejoin="round"
												strokeWidth="1.8"
											/>
											<path
												d="M5 10h14"
												stroke="currentColor"
												strokeWidth="1.8"
											/>
										</svg>
										<span>Стена</span>
									</button>
								)}

								<button
									aria-label="Предметы интерьера"
									aria-pressed={activeTool === "item"}
									className={`${styles.dockAction} ${styles.itemDockAction}`}
									disabled={
										isEditorReadOnly ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									onClick={openBuiltInCatalog}
									type="button"
								>
									<svg
										aria-hidden="true"
										data-testid="catalog-tool-icon"
										fill="none"
										height="24"
										viewBox="0 0 24 24"
										width="24"
									>
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
							</div>
						</nav>
						<dialog
							aria-label="Остальные действия редактора"
							className={styles.editorActionMenu}
							hidden={!isEditorActionMenuOpen}
							id="editor-secondary-actions"
							ref={editorActionMenuRef}
							onCancel={(event) => {
								event.preventDefault();
								setIsEditorActionMenuOpen(false);
							}}
							onClick={(event) => {
								if (event.target !== event.currentTarget) return;
								const bounds = event.currentTarget.getBoundingClientRect();
								if (
									event.clientX < bounds.left ||
									event.clientX > bounds.right ||
									event.clientY < bounds.top ||
									event.clientY > bounds.bottom
								) {
									setIsEditorActionMenuOpen(false);
								}
							}}
							onKeyDown={(event) => {
								if (event.key !== "Tab") return;
								const buttons = Array.from(
									event.currentTarget.querySelectorAll<HTMLButtonElement>(
										"button:not(:disabled)",
									),
								);
								const first = buttons[0];
								const last = buttons.at(-1);
								if (event.shiftKey && document.activeElement === first) {
									event.preventDefault();
									last?.focus();
								} else if (!event.shiftKey && document.activeElement === last) {
									event.preventDefault();
									first?.focus();
								}
							}}
						>
							<span
								aria-hidden="true"
								className={styles.editorActionMenuHandle}
								data-testid="editor-action-menu-handle"
							/>
							<div className={styles.editorActionMenuHeader}>
								<span>Ещё</span>
								<button
									aria-label="Закрыть остальные действия"
									onClick={() => setIsEditorActionMenuOpen(false)}
									type="button"
								>
									Закрыть
								</button>
							</div>
							{isWallOpeningDockContext ? (
								<button
									aria-label="Предметы интерьера"
									disabled={
										isEditorReadOnly ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									onClick={() => {
										setIsEditorActionMenuOpen(false);
										openBuiltInCatalog();
									}}
									type="button"
								>
									Каталог
								</button>
							) : null}
							{viewMode === "plan" &&
							activeTool === "select" &&
							selectedItem ? (
								<button
									aria-controls="selected-item-inspector"
									onClick={openSelectionProperties}
									type="button"
								>
									Параметры выбранного предмета
								</button>
							) : null}
							{viewMode === "plan" &&
							activeTool === "select" &&
							!selectedItem &&
							!selectedWall &&
							metrics ? (
								<button onClick={openPlanInspector} type="button">
									Размеры плана
								</button>
							) : null}
							<button
								disabled={isWorking}
								data-editor-host-back={fullTransientNavigationProtection ? "projects" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(true) : void returnToProjects()}
								type="button"
							>
								Проекты
							</button>
							<button
								disabled={isWorking}
								onClick={() => void exportProjectTransfer()}
								type="button"
							>
								Экспортировать проект
							</button>
							{registeredTransferExport ? <button type="button" disabled={isWorking} onClick={() => void exportProjectTransfer(undefined, true)}>Экспорт файла для переноса</button> : null}
							<button
								disabled={
									isEditorReadOnly ||
									isWorking ||
									state.kind === "persist-failed" ||
									state.kind === "recovery-needed"
								}
								onClick={() => {
									setIsEditorActionMenuOpen(false);
									setDimensionError(undefined);
									setIsRestartConfirmationOpen(true);
								}}
								type="button"
							>
								Начать заново
							</button>
							<button
								className={styles.menuDangerAction}
								disabled={
									isEditorReadOnly ||
									isWorking ||
									state.kind === "persist-failed" ||
									state.kind === "recovery-needed"
								}
								onClick={() => {
									setIsEditorActionMenuOpen(false);
									setProjectDeletionError(undefined);
									setIsProjectDeletionConfirmationOpen(true);
								}}
								type="button"
							>
								Удалить проект
							</button>
						</dialog>
					</>
				) : null}

				<fieldset
					aria-label="История изменений"
					className={styles.canvasHistory}
				>
					<button
						aria-label={undoActionLabel}
						disabled={
							isEditorReadOnly ||
							!sessionHistory.canUndo ||
							isWorking ||
							state.kind !== "saved"
						}
						onClick={() => void travelHistory("undo")}
						type="button"
					>
						↶
					</button>
					<button
						aria-label={redoActionLabel}
						disabled={
							isEditorReadOnly ||
							!sessionHistory.canRedo ||
							isWorking ||
							state.kind !== "saved"
						}
						onClick={() => void travelHistory("redo")}
						type="button"
					>
						↷
					</button>
				</fieldset>

				{viewMode === "plan" &&
				activeTool === "select" &&
				!selectedItem &&
				!selectedWall &&
				editableRooms.length > 0 ? (
					<button
						aria-label="Помещения"
						aria-expanded={isRoomDirectoryOpen}
						className={styles.roomDirectoryToggle}
						disabled={isWorking}
						onClick={openRoomDirectory}
						type="button"
					>
						<svg
							aria-hidden="true"
							data-testid="rooms-directory-icon"
							fill="none"
							height="24"
							viewBox="0 0 24 24"
							width="24"
						>
							<path
								d="M4.5 5.5h15v13h-15zM11.5 5.5v8h8M4.5 13.5h7"
								stroke="currentColor"
								strokeLinejoin="round"
								strokeWidth="1.8"
							/>
						</svg>
					</button>
				) : null}

				{viewMode === "plan" && canReturnToDrawing ? (
					<button
						aria-label="Вернуться к чертежу"
						className={styles.returnToDrawing}
						data-testid="drawing-compass"
						onClick={() => setViewport(initialEditorViewport)}
						type="button"
					>
						<span
							aria-hidden="true"
							className={styles.drawingCompassArrow}
							style={{ transform: `rotate(${drawingCompassDegrees}deg)` }}
						>
							↑
						</span>
					</button>
				) : null}

				{viewMode === "plan" && activeTool !== "wall" ? (
					<output hidden data-testid="item-count">
						{itemCountCopy(project.assetInstances.length)}
					</output>
				) : null}

				{viewMode === "plan" && selectedOpening && !isOpeningDialogOpen ? (
					<aside
						className={styles.openingContext}
						aria-label={
							selectedOpening.kind === "Window"
								? "Выбранное окно"
								: "Выбранный проём"
						}
					>
						<strong>
							{selectedOpening.kind === "Window" ? "Окно" : "Дверной проём"}
						</strong>
						<span>
							{formatLengthMm(selectedOpening.widthMm)} ×{" "}
							{formatLengthMm(selectedOpening.heightMm)}
						</span>
						<button
							type="button"
							disabled={isEditorReadOnly || isMutationBlocked}
							onClick={() => openOpeningDraft(selectedOpening)}
						>
							Параметры
						</button>
						<button
							type="button"
							disabled={isEditorReadOnly || isMutationBlocked}
							onClick={() =>
								void deleteSelectedDoorOpening(selectedOpening.openingId)
							}
						>
							Удалить
						</button>
					</aside>
				) : null}

				{viewMode === "plan" && openingCreationDraft ? (
					<aside
						aria-labelledby="opening-creation-title"
						aria-modal={isExternalSaveFailure ? undefined : true}
						className={styles.openingCreationSheet}
						data-testid="opening-creation-draft"
						onKeyDown={
							isExternalSaveFailure ? undefined : trapOpeningCreationFocus
						}
						ref={openingCreationDialogRef}
						role="dialog"
						tabIndex={-1}
					>
						<form
							aria-busy={isWorking}
							onSubmit={(event) => {
								event.preventDefault();
								void confirmOpeningCreationDraft();
							}}
						>
							<span
								aria-hidden="true"
								className={styles.openingCreationSheetHandle}
							/>
							<strong id="opening-creation-title">
								{openingCreationDraft.kind === "Window"
									? "Новое окно"
									: "Новый проём"}
							</strong>
							{openingCreationHost ? (
								<p className={styles.openingCreationHost}>
									Стена {openingCreationHost.ordinal} ·{" "}
									{formatLengthMm(openingCreationHost.lengthMm)}
								</p>
							) : null}
							<fieldset className={styles.openingCreationKindPicker}>
								<legend className={styles.visuallyHidden}>Тип проёма</legend>
								<button
									aria-pressed={openingCreationDraft.kind === "Door"}
									disabled={isWorking || isEditorReadOnly}
									onClick={() => selectOpeningCreationKind("Door")}
									type="button"
								>
									Дверь
								</button>
								<button
									aria-pressed={openingCreationDraft.kind === "Window"}
									disabled={isWorking || isEditorReadOnly}
									onClick={() => selectOpeningCreationKind("Window")}
									type="button"
								>
									Окно
								</button>
							</fieldset>
							<div className={styles.openingCreationFields}>
								<label>
									<span>Ширина</span>
									<input
										aria-describedby={
											openingCreationDraftError
												? "opening-creation-error"
												: undefined
										}
										aria-invalid={openingCreationDraftError ? true : undefined}
										aria-label="Ширина, мм"
										disabled={isWorking || isEditorReadOnly}
										inputMode="numeric"
										onChange={(event) => {
											setDimensionError(undefined);
											setOpeningCreationDraft((current) =>
												current
													? { ...current, widthMm: event.target.value }
													: current,
											);
										}}
										ref={openingDraftWidthInputRef}
										value={openingCreationDraft.widthMm}
									/>
								</label>
								<label>
									<span>Высота</span>
									<input
										aria-describedby={
											openingCreationDraftError
												? "opening-creation-error"
												: undefined
										}
										aria-invalid={openingCreationDraftError ? true : undefined}
										aria-label="Высота, мм"
										disabled={isWorking || isEditorReadOnly}
										inputMode="numeric"
										onChange={(event) => {
											setDimensionError(undefined);
											setOpeningCreationDraft((current) =>
												current
													? { ...current, heightMm: event.target.value }
													: current,
											);
										}}
										value={openingCreationDraft.heightMm}
									/>
								</label>
							</div>
							{openingCreationDraftError ? (
								<p id="opening-creation-error" role="alert">
									{openingCreationDraftError}
								</p>
							) : null}
							<div className={styles.openingCreationActions}>
								<button
									disabled={isWorking}
									onClick={closeOpeningCreationDraft}
									type="button"
								>
									Отмена
								</button>
								<button
									disabled={
										isWorking ||
										isEditorReadOnly ||
										!canConfirmOpeningCreationDraft
									}
									type="submit"
								>
									Добавить
								</button>
							</div>
						</form>
					</aside>
				) : null}

				{viewMode === "plan" && openingDraft?.isMove ? (
					<ProjectConfirmationDialog
						label={
							openingDraft.kind === "Window"
								? "Подтвердить перемещение окна"
								: "Подтвердить перемещение проёма"
						}
						title={
							openingDraft.kind === "Window"
								? "Переместить окно?"
								: "Переместить проём?"
						}
						cancelLabel="Отмена"
						confirmLabel="Подтвердить"
						confirmTone="primary"
						busyLabel="Сохраняем…"
						busy={isWorking}
						error={dimensionError}
						onCancel={cancelOpeningDraft}
						onConfirm={() => void confirmOpeningDraft()}
						returnFocusRef={selectionPropertiesTriggerRef}
						fallbackFocusRef={editorHeaderMenuRef}
						testId="opening-move-confirmation"
					>
						<p>
							{openingDraft.kind === "Window" ? "Окно" : "Проём"} будет
							установлено в выбранном месте.
						</p>
					</ProjectConfirmationDialog>
				) : null}

				{viewMode === "plan" && openingDraft && !openingDraft.isMove ? (
					<aside
						aria-label={
							openingDraft.kind === "Door"
								? "Параметры дверного проёма"
								: "Параметры окна"
						}
						className={styles.openingCreationSheet}
						data-testid="opening-draft"
						role="dialog"
						aria-modal={isExternalSaveFailure ? undefined : true}
						tabIndex={-1}
						ref={openingCreationDialogRef}
						onKeyDown={
							isExternalSaveFailure ? undefined : trapOpeningCreationFocus
						}
					>
						<form
							aria-busy={isWorking}
							onSubmit={(event) => {
								event.preventDefault();
								void confirmOpeningDraft();
							}}
						>
							<strong>
								{openingDraft.kind === "Door"
									? "Изменить проём"
									: "Изменить окно"}
							</strong>

							<div className={styles.openingCreationFields}>
								<label>
									<span>Ширина</span>
									<input
										aria-label={
											openingDraft.kind === "Door"
												? "Ширина дверного проёма, мм"
												: "Ширина окна, мм"
										}
										aria-describedby={
											dimensionError ? "opening-draft-error" : undefined
										}
										aria-invalid={dimensionError ? true : undefined}
										disabled={isWorking || isEditorReadOnly}
										inputMode="numeric"
										ref={openingDraftWidthInputRef}
										onChange={(event) =>
											setOpeningDraft((current) =>
												current
													? { ...current, widthMm: event.target.value }
													: current,
											)
										}
										value={openingDraft.widthMm}
									/>
								</label>
								<label>
									<span>Высота</span>
									<input
										aria-label={
											openingDraft.kind === "Door"
												? "Высота дверного проёма, мм"
												: "Высота окна, мм"
										}
										aria-describedby={
											dimensionError ? "opening-draft-error" : undefined
										}
										aria-invalid={dimensionError ? true : undefined}
										disabled={isWorking || isEditorReadOnly}
										inputMode="numeric"
										onChange={(event) =>
											setOpeningDraft((current) =>
												current
													? { ...current, heightMm: event.target.value }
													: current,
											)
										}
										value={openingDraft.heightMm}
									/>
								</label>
							</div>
							{dimensionError ? (
								<p id="opening-draft-error" role="alert">
									{dimensionError}
								</p>
							) : null}
							<div className={styles.openingCreationActions}>
								<button disabled={isWorking || isEditorReadOnly} type="submit">
									{openingDraft.isMove
										? "Применить"
										: openingDraft.kind === "Door"
											? "Сохранить проём"
											: "Сохранить окно"}
								</button>
								<button
									disabled={isWorking}
									onClick={cancelOpeningDraft}
									type="button"
								>
									Отмена
								</button>
							</div>
						</form>
					</aside>
				) : null}

				{viewMode === "plan" && vertexDeletionCandidate ? (
					<aside
						aria-label="Последствия удаления вершины"
						aria-live="assertive"
						className={styles.windowDraftPanel}
						data-testid="vertex-deletion-draft"
						ref={vertexDeletionPanelRef}
						role="alert"
						tabIndex={-1}
					>
						<div>
							<strong>Черновик удаления вершины</strong>
							<span>
								Будут объединены только две прямые части стены без проёмов.
							</span>
							{vertexDeletionAffectedWallItemIds.length > 0 ? (
								<>
									<span>
										Адреса настенных предметов будут проверены и при
										необходимости перенесены на объединённую стену.
									</span>
									<ul data-testid="vertex-deletion-affected-items">
										{vertexDeletionAffectedWallItemIds.map(
											(assetInstanceId) => (
												<li key={assetInstanceId}>
													<code>{assetInstanceId}</code>
												</li>
											),
										)}
									</ul>
								</>
							) : null}
							<span>
								Отмена не меняет план, историю или локальное сохранение.
							</span>
							{dimensionError ? <p role="alert">{dimensionError}</p> : null}
							<div>
								<button
									disabled={
										isDeletingVertex ||
										isEditorReadOnly ||
										isMutationBlocked ||
										state.kind === "recovery-needed"
									}
									onClick={() => void confirmVertexDeletion()}
									type="button"
								>
									Подтвердить удаление
								</button>
								<button
									disabled={isDeletingVertex}
									onClick={() => {
										setDimensionError(undefined);
										setVertexDeletionCandidate(undefined);
									}}
									type="button"
								>
									Отменить удаление
								</button>
							</div>
						</div>
					</aside>
				) : null}

				{viewMode === "plan" && wallAddHostConflict ? (
					<aside
						aria-label="Последствия добавления стены"
						aria-live="assertive"
						className={styles.windowDraftPanel}
						data-testid="wall-add-host-conflict-preview"
						ref={wallAddHostConflictPanelRef}
						role="alert"
						tabIndex={-1}
					>
						<div>
							<strong>Последствия добавления стены</strong>
							<span>
								Новый T- или X-образный стык разделит существующую стену в точке
								размещённого объекта.
							</span>
							{wallAddHostConflict.openingIds.length > 0 ? (
								<>
									<span>
										{wallAddHostConflict.openingIds.length === 1
											? "1 проём потеряет допустимый адрес. Его можно удалить только вместе с добавлением стены."
											: `${wallAddHostConflict.openingIds.length} проёма потеряют допустимый адрес. Их можно удалить только вместе с добавлением стены.`}
									</span>
									<ul data-testid="wall-add-conflicting-openings">
										{wallAddHostConflict.openingIds.map((openingId) => {
											const opening = project?.level.openings.find(
												(candidate) => candidate.openingId === openingId,
											);
											return (
												<li key={openingId}>
													{opening?.kind === "Window"
														? "Окно"
														: "Дверной проём"}{" "}
													<code>{openingId}</code>
												</li>
											);
										})}
									</ul>
								</>
							) : null}
							{wallAddHostConflict.itemIds.length > 0 ? (
								<>
									<span>
										{wallAddHostConflict.itemIds.length === 1
											? "1 настенный предмет потеряет допустимый адрес. Его можно удалить только вместе с добавлением стены."
											: `${wallAddHostConflict.itemIds.length} настенных предмета потеряют допустимый адрес. Их можно удалить только вместе с добавлением стены.`}
									</span>
									<ul data-testid="wall-add-conflicting-items">
										{wallAddHostConflict.itemIds.map((assetInstanceId) => {
											const item = project?.assetInstances.find(
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
							<span>
								Отмена не меняет план, историю или локальное сохранение.
							</span>
							{dimensionError ? <p role="alert">{dimensionError}</p> : null}
							<div>
								<button
									disabled={
										isResolvingWallAddHostConflict ||
										isWorking ||
										isEditorReadOnly
									}
									onClick={() => void resolveWallAddHostConflict()}
									type="button"
								>
									{`Добавить стену${
										wallAddHostConflict.openingIds.length === 0
											? ""
											: wallAddHostConflict.openingIds.length === 1
												? " и удалить 1 проём"
												: ` и удалить ${wallAddHostConflict.openingIds.length} проёма`
									}${
										wallAddHostConflict.itemIds.length === 0
											? ""
											: wallAddHostConflict.itemIds.length === 1
												? " и удалить 1 настенный предмет"
												: ` и удалить ${wallAddHostConflict.itemIds.length} настенных предмета`
									}`}
								</button>
								<button
									disabled={isResolvingWallAddHostConflict || isWorking}
									onClick={cancelWallAddHostConflict}
									type="button"
								>
									Отмена
								</button>
							</div>
						</div>
					</aside>
				) : null}

				{viewMode === "plan" && wallDeletionConflict ? (
					<aside
						aria-label="Последствия удаления стены"
						aria-live="assertive"
						className={styles.windowDraftPanel}
						data-testid="opening-conflict-preview"
						ref={wallDeletionConflictPanelRef}
						role="alert"
						tabIndex={-1}
					>
						<div>
							<strong>Последствия удаления</strong>
							{!wallDeletionConflict.requiresResolution ? (
								<span>
									Будет удалена выбранная стена. Помещения, проёмы и предметы не
									затрагиваются.
								</span>
							) : null}
							{wallDeletionConflict.openingIds.length > 0 ? (
								<>
									<span>
										{wallDeletionConflict.openingIds.length === 1
											? "На этой стене 1 проём. Его можно удалить только вместе со стеной."
											: `На этой стене ${wallDeletionConflict.openingIds.length} проёма. Их можно удалить только вместе со стеной.`}
									</span>
									<ul data-testid="wall-deletion-affected-openings">
										{wallDeletionConflict.openingIds.map((openingId) => (
											<li key={openingId}>
												<code>{openingId}</code>
											</li>
										))}
									</ul>
								</>
							) : null}
							{wallDeletionConflict.itemIds.length > 0 ? (
								<>
									<span>
										{wallDeletionConflict.itemIds.length === 1
											? "1 предмет потеряет допустимый адрес. Его можно удалить только вместе со стеной."
											: `${wallDeletionConflict.itemIds.length} предмета потеряют допустимый адрес. Их можно удалить только вместе со стеной.`}
									</span>
									<ul data-testid="wall-deletion-affected-items">
										{wallDeletionConflict.itemIds.map((assetInstanceId) => (
											<li key={assetInstanceId}>
												<code>{assetInstanceId}</code>
											</li>
										))}
									</ul>
								</>
							) : null}
							{wallDeletionConflict.roomIds.length > 0 ? (
								<>
									<span>
										{wallDeletionConflict.roomIds.length === 1
											? "Будет изменено 1 помещение."
											: `Будут изменены ${wallDeletionConflict.roomIds.length} помещения.`}
									</span>
									<ul data-testid="wall-deletion-affected-rooms">
										{wallDeletionConflict.roomIds.map((roomId) => (
											<li key={roomId}>
												<code>{roomId}</code>
											</li>
										))}
									</ul>
								</>
							) : null}
							{wallDeletionConflict.roomMetadataConflicts.map((conflict) => (
								<div key={conflict.targetFaceKey}>
									<span>
										После объединения выберите помещение, чьи тип, высота и
										история останутся.
									</span>
									<div>
										{conflict.retainedRoomIds.map((roomId, index) => {
											const room =
												project?.schemaVersion === 1
													? project.level.rooms.find(
															(candidate) => candidate.roomId === roomId,
														)
													: undefined;
											return (
												<button
													aria-pressed={
														wallDeletionConflict.retainedRoomIdByTargetFaceKey[
															conflict.targetFaceKey
														] === roomId
													}
													data-testid={`wall-deletion-metadata-${index}`}
													disabled={isWorking || isEditorReadOnly}
													key={roomId}
													onClick={() =>
														chooseWallDeletionRoomMetadata(
															conflict.targetFaceKey,
															roomId,
														)
													}
													type="button"
												>
													<span>
														{room
															? `Сохранить параметры «${roomTypeLabels[room.type ?? "other"]}»`
															: `Сохранить параметры помещения ${index + 1}`}
													</span>
													<small>
														{room
															? `${roomTypeLabels[room.type ?? "other"]} · ${formatLengthMm(room.heightMm)} · `
															: ""}
														<code>{roomId}</code>
													</small>
												</button>
											);
										})}
									</div>
								</div>
							))}
							<span>
								Отмена не меняет план, историю или локальное сохранение.
							</span>
							{dimensionError ? <p role="alert">{dimensionError}</p> : null}
							<div>
								<button
									disabled={
										isWorking ||
										isEditorReadOnly ||
										wallDeletionConflict.roomMetadataConflicts.some(
											(conflict) =>
												wallDeletionConflict.retainedRoomIdByTargetFaceKey[
													conflict.targetFaceKey
												] === undefined,
										)
									}
									onClick={() => void confirmWallDeletionConflict()}
									type="button"
								>
									{`Удалить стену${
										wallDeletionConflict.openingIds.length === 0
											? ""
											: wallDeletionConflict.openingIds.length === 1
												? " и 1 проём"
												: ` и ${wallDeletionConflict.openingIds.length} проёма`
									}${
										wallDeletionConflict.itemIds.length === 0
											? ""
											: wallDeletionConflict.itemIds.length === 1
												? " и 1 предмет"
												: ` и ${wallDeletionConflict.itemIds.length} предмета`
									}${
										wallDeletionConflict.roomIds.length === 0
											? ""
											: wallDeletionConflict.roomIds.length === 1
												? " и изменить 1 помещение"
												: ` и изменить ${wallDeletionConflict.roomIds.length} помещения`
									}`}
								</button>
								<button
									disabled={isWorking}
									onClick={cancelWallDeletionConflict}
									type="button"
								>
									Отмена
								</button>
							</div>
						</div>
					</aside>
				) : null}

				{viewMode === "plan" && activeTool === "wall" ? (
					<>
						<output
							hidden
							className={styles.planRoomStatus}
							data-testid="plan-room-status"
						>
							{roomCountCopy(derivedRooms.length)} ·{" "}
							{wallCountCopy(project.level.wallSegments.length)}
						</output>
						<div
							className={styles.visuallyHidden}
							data-testid="plan-counts"
							hidden
						>
							<span data-testid="room-count">
								{roomCountCopy(derivedRooms.length)}
							</span>
							<span data-testid="wall-count">
								{wallCountCopy(project.level.wallSegments.length)}
							</span>
						</div>
					</>
				) : null}

				{isLegacyReadOnly ? (
					<p
						className={styles.legacyReadOnly}
						data-testid="legacy-read-only"
						role="status"
					>
						Этот архивный формат доступен только для просмотра. Новое
						редактирование будет доступно после безопасного переноса в
						канонический план.
					</p>
				) : null}

				{activeTool === "select" &&
				selectedItem &&
				selectedItemFields &&
				viewMode === "plan" ? (
					<aside
						aria-label="Свойства выбранного предмета"
						className={`${styles.selectionPanel} ${styles.selectionInspectorPanel}`}
						data-item-locked={selectedItemLocked}
						data-inspector-expanded={isSelectionInspectorExpanded}
						data-testid="selected-item-inspector"
						id="selected-item-inspector"
						hidden={
							isEditorActionMenuOpen ||
							isOpeningDialogOpen ||
							selectedOpening !== undefined
						}
					>
						<div className={styles.panelHeading}>
							<span
								aria-hidden="true"
								className={styles.selectionItemInspectorIcon}
								data-testid="selected-item-inspector-icon"
							>
								<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
									<path
										d="M7 11.5V7.8c0-1.55 1.25-2.8 2.8-2.8h4.4C15.75 5 17 6.25 17 7.8v3.7M5 11.5h14v4.2H5zM7 15.7v3.3M17 15.7v3.3"
										stroke="currentColor"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="1.7"
									/>
								</svg>
							</span>
							<span className={styles.selectionItemInspectorCategory}>
								{"assetDefinitionId" in selectedItem &&
								selectedItem.assetDefinitionId
									? "ВЫБРАННЫЙ ПРЕДМЕТ"
									: "МАКЕТНЫЙ ПРЕДМЕТ"}
							</span>
							<strong>{selectedItem.label}</strong>
							<button
								aria-expanded={isSelectionInspectorExpanded}
								aria-label={
									isSelectionInspectorExpanded
										? "Скрыть панель предмета"
										: "Развернуть панель предмета"
								}
								className={styles.selectionInspectorToggle}
								data-editor-host-back={fullTransientNavigationProtection && isSelectionInspectorExpanded ? "panel" : undefined}
								onClick={() => {
									if (isNavigationProtected && isSelectionInspectorExpanded) requestEditorBack(false, () => setIsSelectionInspectorExpanded(false));
									else setIsSelectionInspectorExpanded((expanded) => !expanded);
								}}
								type="button"
							>
								{isSelectionInspectorExpanded
									? "Скрыть параметры"
									: "Параметры ↓"}
							</button>
						</div>

						{selectedItemPlacementWarnings.length > 0 ? (
							<p data-testid="selected-item-placement-warning" role="status">
								Предупреждение для этого предмета:{" "}
								{itemPlacementWarningSummary(selectedItemPlacementWarnings)}.
							</p>
						) : null}
						<div className={styles.itemDimensions}>
							<label>
								<span>Ширина</span>
								<input
									aria-label="Ширина выбранного предмета, мм"
									aria-describedby={
										dimensionError ? "dimension-error" : undefined
									}
									aria-invalid={dimensionError ? true : undefined}
									autoComplete="off"
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										selectedItemHasFixedDimensions ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									inputMode="numeric"
									data-editor-blur-commit=""

							onBlur={(event) => {
										if (!consumeSkippedNumericBlurCommit(event.currentTarget)) {
											void commitSelectedItem();
										}
									}}
									onChange={(event) =>
										setSelectedItemFields({
											...selectedItemFields,
											widthMm: event.target.value,
										})
									}
									onKeyDown={(event) => {
										if (
											cancelNumericDraftOnEscape(
												event,
												cancelSelectedItemNumericDraft,
											)
										) {
											return;
										}
										commitOnEnter(event);
									}}
									value={selectedItemFields.widthMm}
								/>
							</label>
							<label>
								<span>Глубина</span>
								<input
									aria-label="Глубина выбранного предмета, мм"
									autoComplete="off"
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										selectedItemHasFixedDimensions ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									inputMode="numeric"
									data-editor-blur-commit=""

							onBlur={(event) => {
										if (!consumeSkippedNumericBlurCommit(event.currentTarget)) {
											void commitSelectedItem();
										}
									}}
									onChange={(event) =>
										setSelectedItemFields({
											...selectedItemFields,
											depthMm: event.target.value,
										})
									}
									onKeyDown={(event) => {
										if (
											cancelNumericDraftOnEscape(
												event,
												cancelSelectedItemNumericDraft,
											)
										) {
											return;
										}
										commitOnEnter(event);
									}}
									value={selectedItemFields.depthMm}
								/>
							</label>
							<label>
								<span>Высота</span>
								<input
									aria-label="Высота выбранного предмета, мм"
									autoComplete="off"
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										selectedItemHasFixedDimensions ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									inputMode="numeric"
									data-editor-blur-commit=""

							onBlur={(event) => {
										if (!consumeSkippedNumericBlurCommit(event.currentTarget)) {
											void commitSelectedItem();
										}
									}}
									onChange={(event) =>
										setSelectedItemFields({
											...selectedItemFields,
											heightMm: event.target.value,
										})
									}
									onKeyDown={(event) => {
										if (
											cancelNumericDraftOnEscape(
												event,
												cancelSelectedItemNumericDraft,
											)
										) {
											return;
										}
										commitOnEnter(event);
									}}
									value={selectedItemFields.heightMm}
								/>
							</label>
							<label>
								<span>Поворот</span>
								<input
									aria-label="Угол поворота выбранного предмета, градусы"
									autoComplete="off"
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									inputMode="decimal"
									data-editor-blur-commit=""

							onBlur={(event) => {
										if (!consumeSkippedNumericBlurCommit(event.currentTarget)) {
											void commitSelectedItemAngle();
										}
									}}
									onChange={(event) =>
										setSelectedItemAngleRaw(event.target.value)
									}
									onKeyDown={(event) => {
										if (
											cancelNumericDraftOnEscape(
												event,
												cancelSelectedItemNumericDraft,
											)
										) {
											return;
										}
										commitOnEnter(event);
									}}
									value={selectedItemAngleRaw}
								/>
							</label>
						</div>

						{selectedItemHasNoDeclaredColorVariant ? null : (
							<fieldset className={styles.quickPalette}>
								<legend>Цвет предмета</legend>
								<div>
									{alphaParametricItemColorVariants.map((variant) => (
										<button
											aria-label={`Выбрать вариант цвета предмета ${variant.label}`}
											aria-pressed={selectedItem.color === variant.color}
											disabled={
												isEditorReadOnly ||
												selectedItemLocked ||
												isWorking ||
												state.kind === "persist-failed" ||
												state.kind === "recovery-needed"
											}
											key={variant.variantId}
											onClick={() => {
												setDimensionError(undefined);
												setItemColorVariantDraft({
													anchorClass: "floor",
													assetInstanceId: selectedItem.assetInstanceId,
													variantId: variant.variantId,
												});
											}}
											type="button"
										>
											<span
												aria-hidden="true"
												className={styles.itemColorSwatch}
												style={{ backgroundColor: variant.color }}
											/>
											<small>{variant.label}</small>
										</button>
									))}
								</div>
							</fieldset>
						)}
						<dl className={styles.inlineMetrics}>
							<div>
								<dt>ПОЗИЦИЯ X</dt>
								<dd>{formatLengthMm(selectedItem.xMm)}</dd>
							</div>
							<div>
								<dt>ПОЗИЦИЯ Z</dt>
								<dd>{formatLengthMm(selectedItem.zMm)}</dd>
							</div>
						</dl>
						<fieldset className={styles.itemNudgeControls}>
							<legend>Переместить предмет на 100 мм</legend>
							<div>
								<button
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									onClick={() => void nudgeSelectedItem({ xMm: -100, zMm: 0 })}
									type="button"
								>
									Сместить предмет на 100 мм влево
								</button>
								<button
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									onClick={() => void nudgeSelectedItem({ xMm: 100, zMm: 0 })}
									type="button"
								>
									Сместить предмет на 100 мм вправо
								</button>
							</div>
							<div>
								<button
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									onClick={() => void nudgeSelectedItem({ xMm: 0, zMm: -100 })}
									type="button"
								>
									Сместить предмет на 100 мм вверх
								</button>
								<button
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									onClick={() => void nudgeSelectedItem({ xMm: 0, zMm: 100 })}
									type="button"
								>
									Сместить предмет на 100 мм вниз
								</button>
							</div>
						</fieldset>

						<button
							aria-pressed={selectedItemLocked === true}
							disabled={isEditorReadOnly || isMutationBlocked}
							onClick={() =>
								void setFloorItemLock(
									selectedItem.assetInstanceId,
									!selectedItemLocked,
								)
							}
							type="button"
						>
							{selectedItemLocked
								? "Разблокировать предмет"
								: "Заблокировать предмет"}
						</button>

						<button
							disabled={
								isEditorReadOnly ||
								isWorking ||
								state.kind === "persist-failed" ||
								state.kind === "recovery-needed"
							}
							onClick={duplicateSelectedItem}
							type="button"
						>
							Дублировать предмет
						</button>
						<button
							className={styles.deleteAction}
							disabled={
								isEditorReadOnly ||
								selectedItemLocked ||
								isWorking ||
								state.kind === "persist-failed" ||
								state.kind === "recovery-needed"
							}
							onClick={() => void deleteSelectedItem()}
							type="button"
						>
							Удалить предмет
						</button>
					</aside>
				) : activeTool === "select" &&
					selectedWall &&
					(isSelectionInspectorExpanded ||
						selectedWallItemDraft !== undefined) &&
					!isWallMoveMode &&
					!isWallSplitMode &&
					!isWallVertexMoveMode &&
					!vertexDeletionCandidate &&
					viewMode === "plan" ? (
					<aside
						aria-label="Свойства выбранной стены"
						className={`${styles.selectionPanel} ${styles.selectionInspectorPanel}`}
						data-inspector-expanded={true}
						data-testid="selected-wall-inspector"
						hidden={
							isEditorActionMenuOpen ||
							isOpeningDialogOpen ||
							selectedOpening !== undefined
						}
					>
						<div className={styles.panelHeading}>
							<span
								aria-hidden="true"
								className={styles.selectionWallInspectorIcon}
								data-testid="selected-wall-inspector-icon"
							>
								<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
									<path
										d="M5 5.5h14v13H5zM5 12h14M12 5.5v13"
										stroke="currentColor"
										strokeLinejoin="round"
										strokeWidth="1.7"
									/>
								</svg>
							</span>
							<strong>Свойства стены</strong>
							<button
								aria-label="Закрыть свойства стены"
								className={styles.selectionInspectorToggle}
								onClick={() => {
									setIsSelectionInspectorExpanded(false);
									setWallItemDraft(undefined);
									setWallItemDraftFields(undefined);
									selectionPropertiesTriggerRef.current?.focus();
								}}
								type="button"
							>
								Закрыть
							</button>
						</div>

						{selectedWallItemDraft ? (
							<div className={styles.openingRow} role="status">
								<strong>Размещение настенного предмета</strong>
								<span>
									Смещение от начала стены:{" "}
									{formatLengthMm(selectedWallItemDraft.offsetMm)} ·{" "}
									{formatLengthMm(selectedWallItemDraft.widthMm)} ×{" "}
									{formatLengthMm(selectedWallItemDraft.heightMm)}
								</span>

								{selectedWallItemDraftError ? (
									<p className={styles.fieldError} role="alert">
										{selectedWallItemDraftError}
									</p>
								) : null}
								{selectedWallItemDraftAffectedLabel ? (
									<p
										className={styles.fieldWarning}
										data-testid="wall-item-placement-affected-target"
									>
										Конфликтующий предмет: «{selectedWallItemDraftAffectedLabel}
										». Измените смещение или сторону.
									</p>
								) : null}
								{selectedWallItemDraftWarning ? (
									<p
										className={styles.fieldWarning}
										data-testid="wall-item-placement-warning"
										role="status"
									>
										Предупреждение: предметы пересекаются.
									</p>
								) : null}
								<fieldset className={styles.sidePicker}>
									<legend className={styles.visuallyHidden}>
										Сторона размещения предмета
									</legend>
									<button
										aria-label="Разместить на левой стороне стены"
										aria-pressed={selectedWallItemDraft.side === "left"}
										disabled={
											isEditorReadOnly ||
											isMutationBlocked ||
											roomHeightOpeningConflict !== undefined
										}
										onClick={() =>
											setWallItemDraft((current) =>
												current?.wallSegmentId ===
												selectedWallItemDraft.wallSegmentId
													? { ...current, side: "left" }
													: current,
											)
										}
										type="button"
									>
										Слева
									</button>
									<button
										aria-label="Разместить на правой стороне стены"
										aria-pressed={selectedWallItemDraft.side === "right"}
										disabled={
											isEditorReadOnly ||
											isMutationBlocked ||
											roomHeightOpeningConflict !== undefined
										}
										onClick={() =>
											setWallItemDraft((current) =>
												current?.wallSegmentId ===
												selectedWallItemDraft.wallSegmentId
													? { ...current, side: "right" }
													: current,
											)
										}
										type="button"
									>
										Справа
									</button>
								</fieldset>
								<button
									disabled={
										isEditorReadOnly ||
										isMutationBlocked ||
										!canConfirmWallItemDraft
									}
									onClick={() => void confirmWallItemPlacement()}
									type="button"
								>
									Подтвердить размещение
								</button>
								<button
									disabled={isWorking}
									onClick={() => {
										setWallItemDraft(undefined);
										setWallItemDraftFields(undefined);
									}}
									type="button"
								>
									Отменить
								</button>
							</div>
						) : null}
						{selectedWallItems.map((item) => {
							const warnings = selectedWallItemWarningsById.get(
								item.assetInstanceId,
							);
							const affectedLabels = warnings
								?.map(
									(warning) =>
										project?.assetInstances.find(
											(candidate) =>
												candidate.assetInstanceId === warning.assetInstanceId,
										)?.label,
								)
								.filter((label): label is string => label !== undefined);
							return (
								<div className={styles.openingRow} key={item.assetInstanceId}>
									<strong>{item.label}</strong>
									{affectedLabels?.length ? (
										<p
											className={styles.fieldWarning}
											data-testid={`wall-item-warning-${item.assetInstanceId}`}
											role="status"
										>
											Предупреждение: «{item.label}» пересекается с «
											{affectedLabels.join("», «")}». Измените смещение или
											сторону.
										</p>
									) : null}
									<label>
										<span>Смещение настенного предмета «{item.label}», мм</span>
										<input
											autoComplete="off"
											disabled={
												isEditorReadOnly || isMutationBlocked || item.locked
											}
											inputMode="numeric"
											data-editor-blur-commit=""

									onBlur={(event) => {
												if (!consumeSkippedNumericBlurCommit(event.currentTarget)) {
													void commitWallItemPosition(item);
												}
											}}
											onChange={(event) =>
												updateWallItemPositionField(
													item,
													"offsetMm",
													event.target.value,
												)
											}
											onKeyDown={(event) => {
												if (
													cancelNumericDraftOnEscape(event, () =>
														cancelWallItemPositionDraft(item),
													)
												) {
													return;
												}
												commitOnEnter(event);
											}}
											value={
												wallItemPositionFields[item.assetInstanceId]
													?.offsetMm ?? String(item.offsetMm)
											}
										/>
									</label>
									<label>
										<span>
											Высота центра настенного предмета «{item.label}», мм
										</span>
										<input
											autoComplete="off"
											disabled={
												isEditorReadOnly || isMutationBlocked || item.locked
											}
											inputMode="numeric"
											data-editor-blur-commit=""

									onBlur={(event) => {
												if (!consumeSkippedNumericBlurCommit(event.currentTarget)) {
													void commitWallItemPosition(item);
												}
											}}
											onChange={(event) =>
												updateWallItemPositionField(
													item,
													"elevationMm",
													event.target.value,
												)
											}
											onKeyDown={(event) => {
												if (
													cancelNumericDraftOnEscape(event, () =>
														cancelWallItemPositionDraft(item),
													)
												) {
													return;
												}
												commitOnEnter(event);
											}}
											value={
												wallItemPositionFields[item.assetInstanceId]
													?.elevationMm ?? String(item.elevationMm)
											}
										/>
									</label>
									{item.assetDefinitionId !== undefined &&
									customGlbResourceManifest.some(
										(definition) =>
											definition.assetDefinitionId === item.assetDefinitionId,
									) ? null : (
										<fieldset className={styles.quickPalette}>
											<legend>Цвет настенного предмета «{item.label}»</legend>
											<div>
												{alphaParametricItemColorVariants.map((variant) => (
													<button
														aria-label={`Выбрать вариант цвета настенного предмета ${variant.label}`}
														aria-pressed={item.color === variant.color}
														disabled={
															isEditorReadOnly ||
															isMutationBlocked ||
															item.locked
														}
														key={variant.variantId}
														onClick={() => {
															setDimensionError(undefined);
															setItemColorVariantDraft({
																anchorClass: "wall",
																assetInstanceId: item.assetInstanceId,
																variantId: variant.variantId,
															});
														}}
														type="button"
													>
														<span
															aria-hidden="true"
															className={styles.itemColorSwatch}
															style={{ backgroundColor: variant.color }}
														/>
														<small>{variant.label}</small>
													</button>
												))}
											</div>
										</fieldset>
									)}
									{item.assetDefinitionId !== undefined ? (
										<button
											disabled={
												isEditorReadOnly ||
												isMutationBlocked ||
												selectedWallItemDraft !== undefined ||
												state.kind === "recovery-needed"
											}
											onClick={() => duplicateWallItem(item)}
											type="button"
										>
											Дублировать настенный предмет
										</button>
									) : null}
									<button
										aria-pressed={item.locked === true}
										disabled={isEditorReadOnly || isMutationBlocked}
										onClick={() =>
											void setWallItemLock(item.assetInstanceId, !item.locked)
										}
										type="button"
									>
										{item.locked
											? "Разблокировать настенный предмет"
											: "Заблокировать настенный предмет"}
									</button>

									<button
										disabled={
											isEditorReadOnly || isMutationBlocked || item.locked
										}
										onClick={() => void deleteWallItem(item.assetInstanceId)}
										type="button"
									>
										Удалить настенный предмет
									</button>
								</div>
							);
						})}
						{canMoveSelectedWallWithGesture ? (
							<button
								aria-pressed={isWallMoveMode}
								className={styles.wallMoveGestureAction}
								disabled={
									isEditorReadOnly ||
									isWorking ||
									state.kind === "recovery-needed"
								}
								onClick={() => {
									setDimensionError(undefined);
									setIsWallSplitMode(false);
									setIsWallVertexMoveMode(false);
									setIsWallMoveMode((active) => !active);
								}}
								type="button"
							>
								{isWallMoveMode
									? "Отменить перенос стены"
									: "Переместить стену жестом"}
							</button>
						) : null}
						{removableSelectedWallVertexIds.map((vertexId) => (
							<button
								aria-label={
									removableSelectedWallVertexIds.length === 1
										? "Удалить вершину"
										: vertexId === selectedWall.startVertexId
											? `Удалить начальную вершину ${vertexId}`
											: `Удалить конечную вершину ${vertexId}`
								}
								className={styles.wallMoveGestureAction}
								disabled={
									isEditorReadOnly ||
									isWorking ||
									state.kind === "persist-failed" ||
									state.kind === "recovery-needed"
								}
								key={vertexId}
								onClick={() => {
									setDimensionError(undefined);
									setIsWallMoveMode(false);
									setIsWallSplitMode(false);
									setIsWallVertexMoveMode(false);
									if (state.kind === "saved") {
										setVertexDeletionCandidate({
											previewRevisionId: state.revisionId,
											vertexId,
										});
									}
								}}
								type="button"
							>
								{removableSelectedWallVertexIds.length === 1
									? "Удалить вершину"
									: vertexId === selectedWall.startVertexId
										? "Удалить начальную вершину"
										: "Удалить конечную вершину"}
							</button>
						))}
						{movableSelectedWallVertexIds.length > 0 ? (
							<button
								aria-pressed={isWallVertexMoveMode}
								className={styles.wallMoveGestureAction}
								disabled={
									isEditorReadOnly ||
									isWorking ||
									state.kind === "persist-failed" ||
									state.kind === "recovery-needed"
								}
								onClick={() => {
									setDimensionError(undefined);
									setIsWallMoveMode(false);
									setIsWallSplitMode(false);
									setIsWallVertexMoveMode((active) => !active);
								}}
								type="button"
							>
								{isWallVertexMoveMode
									? "Отменить перенос вершины"
									: "Переместить вершину жестом"}
							</button>
						) : null}
						{selectedWallOpenings.map((opening) => (
							<div className={styles.openingRow} key={opening.openingId}>
								<div>
									<span>
										{opening.kind === "Door"
											? "Ширина дверного проёма, мм"
											: "Ширина окна, мм"}
									</span>

									<output>{formatLengthMm(opening.widthMm)}</output>
								</div>
								<button
									disabled={
										isEditorReadOnly ||
										isMutationBlocked ||
										state.kind === "recovery-needed"
									}
									onClick={() => openOpeningDraft(opening)}
									type="button"
								>
									{opening.kind === "Door" ? "Изменить проём" : "Изменить окно"}
								</button>
								<button
									disabled={
										isEditorReadOnly ||
										isMutationBlocked ||
										state.kind === "recovery-needed"
									}
									onClick={() =>
										void deleteSelectedDoorOpening(opening.openingId)
									}
									type="button"
								>
									{opening.kind === "Door" ? "Удалить проём" : "Удалить окно"}
								</button>
							</div>
						))}
						<button
							className={styles.deleteAction}
							disabled={
								isEditorReadOnly ||
								isWorking ||
								state.kind === "persist-failed" ||
								state.kind === "recovery-needed"
							}
							onClick={() => void deleteSelectedWall()}
							type="button"
						>
							Удалить стену
						</button>
					</aside>
				) : activeTool === "select" && metrics && viewMode === "plan" ? (
					<aside
						aria-label="Точные размеры плана"
						className={inspectorStyles.planPanel}
						ref={planInspectorRef}
						tabIndex={-1}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								closePlanInspector();
							}
						}}
						data-inspector-open={isPlanInspectorOpen}
						data-testid="plan-dimensions-sheet"
					>
						<span
							aria-hidden="true"
							className={inspectorStyles.handle}
							data-testid="plan-dimensions-sheet-handle"
						/>
						<div className={inspectorStyles.heading}>
							<h2>Размеры плана</h2>
							<button
								aria-label="Скрыть размеры плана"
								className={inspectorStyles.close}
								data-editor-host-back={fullTransientNavigationProtection ? "panel" : undefined}
								onClick={() => isNavigationProtected ? requestEditorBack(false, closePlanInspector) : closePlanInspector()}
								type="button"
							>
								×
							</button>
						</div>
						<form
							className={inspectorStyles.form}
							onSubmit={applyPlanDimensions}
						>
							<div className={inspectorStyles.fields}>
								<label>
									<span>Ширина, мм</span>
									<input
										aria-describedby={
											planDimensionError ? "plan-dimension-error" : undefined
										}
										aria-invalid={planDimensionError ? "true" : undefined}
										autoComplete="off"
										disabled={
											isEditorReadOnly ||
											isWorking ||
											state.kind === "persist-failed" ||
											state.kind === "recovery-needed"
										}
										inputMode="numeric"
										onChange={(event) =>
											setDimensions({
												...dimensions,
												widthMm: event.target.value,
											})
										}
										value={dimensions.widthMm}
									/>
								</label>
								<label>
									<span>Глубина, мм</span>
									<input
										aria-describedby={
											planDimensionError ? "plan-dimension-error" : undefined
										}
										aria-invalid={planDimensionError ? "true" : undefined}
										autoComplete="off"
										disabled={
											isEditorReadOnly ||
											isWorking ||
											state.kind === "persist-failed" ||
											state.kind === "recovery-needed"
										}
										inputMode="numeric"
										onChange={(event) =>
											setDimensions({
												...dimensions,
												depthMm: event.target.value,
											})
										}
										value={dimensions.depthMm}
									/>
								</label>
								<label>
									<span>Высота, мм</span>
									<input
										aria-describedby={
											planDimensionError ? "plan-dimension-error" : undefined
										}
										aria-invalid={planDimensionError ? "true" : undefined}
										autoComplete="off"
										disabled={
											isEditorReadOnly ||
											isWorking ||
											state.kind === "persist-failed" ||
											state.kind === "recovery-needed"
										}
										inputMode="numeric"
										onChange={(event) =>
											setDimensions({
												...dimensions,
												heightMm: event.target.value,
											})
										}
										value={dimensions.heightMm}
									/>
								</label>
							</div>
							{planDimensionError ? (
								<p
									className={inspectorStyles.error}
									id="plan-dimension-error"
									role="alert"
								>
									{planDimensionError}
								</p>
							) : null}
							<button
								className={inspectorStyles.primary}
								disabled={
									isEditorReadOnly ||
									isWorking ||
									state.kind === "persist-failed" ||
									state.kind === "recovery-needed"
								}
								type="submit"
							>
								Применить размеры
							</button>
						</form>
						<dl className={inspectorStyles.metrics}>
							<div>
								<dt>Площадь</dt>
								<dd data-testid="plan-area">
									{formatAreaMm2(metrics.areaMm2)}
								</dd>
							</div>
							<div>
								<dt>Высота</dt>
								<dd data-testid="plan-height">
									{formatLengthMm(metrics.heightMm)}
								</dd>
							</div>
							<div>
								<dt>Периметр</dt>
								<dd data-testid="plan-perimeter">
									{formatLengthMm(metrics.perimeterMm)}
								</dd>
							</div>
						</dl>
						<output data-testid="plan-width" hidden>
							{formatLengthMm(metrics.widthMm)}
						</output>
						<output data-testid="plan-depth" hidden>
							{formatLengthMm(metrics.depthMm)}
						</output>
					</aside>
				) : null}

				{activeTool === "select" &&
				!selectedItem &&
				!selectedWall &&
				metrics &&
				viewMode === "plan" ? (
					<button
						aria-label="Размеры плана"
						aria-expanded={isPlanInspectorOpen}
						className={styles.planInspectorToggle}
						onClick={
							isPlanInspectorOpen ? closePlanInspector : openPlanInspector
						}
						type="button"
					>
						<svg
							aria-hidden="true"
							data-testid="plan-dimensions-icon"
							fill="none"
							height="24"
							viewBox="0 0 24 24"
							width="24"
						>
							<path
								d="M4.5 8.5h15v7h-15zM7.5 8.5v3M10.5 8.5v2M13.5 8.5v3M16.5 8.5v2"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="1.8"
							/>
						</svg>
					</button>
				) : null}

				{threeDimensionalMeasurements && viewMode === "three-dimensional" ? (
					<aside
						aria-label="Характеристики 3D макета"
						className={`${styles.selectionPanel} ${styles.threeDimensionalMetrics}`}
						data-testid="three-dimensional-metrics"
					>
						<div className={styles.panelHeading}>
							<span>3D МАКЕТ</span>
							<strong>
								{metrics
									? formatAreaMm2(metrics.areaMm2)
									: roomCountCopy(derivedRooms.length)}
							</strong>
						</div>
						<dl className={styles.inlineMetrics}>
							<div>
								<dt>ШИРИНА</dt>
								<dd>{formatLengthMm(threeDimensionalMeasurements.widthMm)}</dd>
							</div>
							<div>
								<dt>ГЛУБИНА</dt>
								<dd>{formatLengthMm(threeDimensionalMeasurements.depthMm)}</dd>
							</div>
							<div>
								<dt>ВЫСОТА</dt>
								<dd>{formatLengthMm(threeDimensionalMeasurements.heightMm)}</dd>
							</div>
							<div>
								<dt>СТЕНЫ</dt>
								<dd>{project.level.wallSegments.length}</dd>
							</div>
						</dl>
					</aside>
				) : null}

				{project.level.vertices.length > 0 &&
				!metrics &&
				!selectedItem &&
				!selectedWall &&
				activeTool === "select" &&
				viewMode === "plan" ? (
					<>
						{/* Resting Plan deliberately keeps the drawing surface clear. The
						    same live values remain observable to the existing editor
						    contracts; people reach editable room data through the Room
						    directory rather than a second persistent bottom panel. */}
						<output data-testid="room-count" hidden>
							{roomCountCopy(derivedRooms.length)}
						</output>
						<output data-testid="wall-count" hidden>
							{wallCountCopy(project.level.wallSegments.length)}
						</output>
					</>
				) : null}

				{isStarterContourVisible ? (
					<div
						className={styles.starterProjectStack}
						data-has-storage-notice={Boolean(storagePressureNotice)}
					>
						{storagePressureNotice}
						<form
							aria-label="Размеры стартового контура"
							className={styles.contourPanel}
							noValidate
							onSubmit={createContour}
						>
							<span>СТАРТОВЫЙ КОНТУР</span>
							<div className={styles.contourFields}>
								<label>
									Ширина, мм
									<input
										autoComplete="off"
										disabled={isEditorReadOnly || isMutationBlocked}
										inputMode="numeric"
										onChange={(event) =>
											setDimensions({
												...dimensions,
												widthMm: event.target.value,
											})
										}
										value={dimensions.widthMm}
									/>
								</label>
								<label>
									Глубина, мм
									<input
										autoComplete="off"
										disabled={isEditorReadOnly || isWorking}
										inputMode="numeric"
										onChange={(event) =>
											setDimensions({
												...dimensions,
												depthMm: event.target.value,
											})
										}
										value={dimensions.depthMm}
									/>
								</label>
								<label>
									Высота, мм
									<input
										autoComplete="off"
										disabled={isEditorReadOnly || isWorking}
										inputMode="numeric"
										onChange={(event) =>
											setDimensions({
												...dimensions,
												heightMm: event.target.value,
											})
										}
										value={dimensions.heightMm}
									/>
								</label>
							</div>
							<button
								className={styles.primaryAction}
								disabled={
									isEditorReadOnly ||
									isWorking ||
									state.kind === "persist-failed" ||
									state.kind === "recovery-needed"
								}
								type="submit"
							>
								Создать контур
							</button>
						</form>
					</div>
				) : null}

				{dimensionError ? (
					<div
						className={styles.canvasError}
						data-testid="transient-notification"
						id="dimension-error"
						role="alert"
					>
						<button
							className={styles.notificationClose}
							type="button"
							aria-label="Закрыть уведомление"
							onClick={() => setDimensionError(undefined)}
						>
							×
						</button>
						<p>{dimensionError}</p>
						{wallMutationCorrectionState?.message === dimensionError ? (
							<button
								className={styles.canvasErrorAction}
								onClick={openWallMutationCorrection}
								ref={wallMutationCorrectionActionRef}
								type="button"
							>
								{wallMutationCorrectionState.kind === "opening"
									? `Открыть ${wallMutationCorrectionState.opening.kind === "Door" ? "дверной проём" : "окно"} для исправления`
									: "Открыть предмет для исправления"}
							</button>
						) : null}
					</div>
				) : null}
				{itemPlacementConfirmation && !hasTransientThreeDimensionalEdit ? (
					<output hidden data-testid="item-placement-durable-status">
						{itemPlacementConfirmation}
					</output>
				) : null}
				{isDimensionFilterOpen && viewMode === "plan" ? (
					<DimensionFilter
						visibility={dimensionVisibility}
						onChange={changeDimensionVisibility}
						onClose={() => setIsDimensionFilterOpen(false)}
						returnFocusRef={dimensionFilterTriggerRef}
					/>
				) : null}

				{state.kind === "recovery-needed" ? (
					<button
						className={styles.retryButton}
						onClick={() => void controller.recover()}
						type="button"
					>
						Восстановить проверку
					</button>
				) : null}
				<PwaUpdateNotice
					canActivate={canActivatePwaUpdate}
					hasUndurableDraft={hasUndurableEditorDraft}
					pwaUpdate={pwaUpdate}
				/>
				{isWriterLeaseReadOnly ? (
					<WriterLeaseNotice
						onRecoveryExport={() => void downloadRecoveryDraft()}
						error={writerTakeoverError}
						hasRecoveryCopy={writerRecoveryCopy !== undefined}
						isConfirming={isWriterTakeoverConfirmationOpen}
						isShowingRecoveryCopy={isShowingWriterRecoveryCopy}
						isTakingOver={isTakingOverWriterLease}
						onCancel={cancelWriterTakeover}
						onConfirm={() => void takeOverWriterLease()}
						onRequestTakeOver={() => {
							setWriterTakeoverError(undefined);
							setIsWriterTakeoverConfirmationOpen(true);
						}}
						onToggleRecoveryCopy={() =>
							setIsShowingWriterRecoveryCopy((visible) => !visible)
						}
					/>
				) : null}
			</section>

			{isRoomDirectoryOpen ? (
				<aside
					aria-label="Помещения"
					aria-modal={isExternalSaveFailure ? undefined : true}
					className={inspectorStyles.roomBackdrop}
					onKeyDown={isExternalSaveFailure ? undefined : trapRoomDirectoryFocus}
					ref={roomDirectoryDialogRef}
					role="dialog"
					tabIndex={-1}
				>
					<section
						className={inspectorStyles.roomSheet}
						data-testid="room-directory-sheet"
					>
						<div
							aria-hidden="true"
							className={inspectorStyles.handle}
							data-testid="room-directory-sheet-handle"
						/>
						<div className={inspectorStyles.heading}>
							<h2>Помещения</h2>
							<button
								aria-label="Закрыть помещения"
								className={inspectorStyles.close}
								disabled={isWorking}
								data-editor-host-back={fullTransientNavigationProtection ? "panel" : undefined}
								onClick={() => isNavigationProtected ? requestEditorBack(false, closeRoomDirectory) : closeRoomDirectory()}
								type="button"
							>
								×
							</button>
						</div>

						<div className={inspectorStyles.content}>
							<nav
								aria-label="Список помещений"
								className={inspectorStyles.roomList}
							>
								{editableRooms.map(({ fields, room }) => (
									<button
										aria-label={roomTypeLabels[fields.type]}
										aria-pressed={room.roomId === selectedRoomPropertyId}
										key={room.roomId}
										disabled={
											isMutationBlocked ||
											roomHeightOpeningConflict !== undefined
										}
										onClick={() => chooseRoomProperty(room.roomId)}
										type="button"
									>
										<strong>{roomTypeLabels[fields.type]}</strong>
										<small>{formatLengthMm(room.heightMm)}</small>
									</button>
								))}
							</nav>
							{selectedRoomProperty && roomPropertyFields ? (
								<form
									aria-busy={isWorking}
									className={inspectorStyles.form}
									onSubmit={(event) => void saveRoomProperties(event)}
								>
									<label>
										<span>Тип</span>
										<select
											aria-label="Тип помещения"
											disabled={
												isEditorReadOnly ||
												isMutationBlocked ||
												roomHeightOpeningConflict !== undefined
											}
											onChange={(event) =>
												setRoomPropertyFields((current) =>
													current
														? {
																...current,
																type: event.target.value as RoomType,
															}
														: current,
												)
											}
											value={roomPropertyFields.type}
										>
											{roomTypes.map((roomType) => (
												<option key={roomType} value={roomType}>
													{roomTypeLabels[roomType]}
												</option>
											))}
										</select>
									</label>
									<label>
										<span>Высота, мм</span>
										<input
											aria-label="Высота помещения, мм"
											aria-describedby={
												roomPropertyError ? "room-property-error" : undefined
											}
											aria-invalid={roomPropertyError ? true : undefined}
											autoComplete="off"
											disabled={
												isEditorReadOnly ||
												isMutationBlocked ||
												roomHeightOpeningConflict !== undefined
											}
											inputMode="numeric"
											onChange={(event) =>
												setRoomPropertyFields((current) =>
													current
														? { ...current, heightMm: event.target.value }
														: current,
												)
											}
											value={roomPropertyFields.heightMm}
										/>
									</label>

									{roomHeightOpeningConflict ? (
										<section
											aria-label="Конфликт высоты помещения и проёмов"
											className={inspectorStyles.conflict}
											data-testid="room-height-opening-conflict-preview"
										>
											<strong>Высота затрагивает проёмы</strong>
											<p>
												{roomHeightOpeningConflict.openingIds.length === 1
													? "1 проём больше не помещается в стене. Выберите, что с ним сделать."
													: `${roomHeightOpeningConflict.openingIds.length} проёма больше не помещаются в стене. Выберите, что сделать с каждым.`}
											</p>
											{roomHeightOpeningConflict.openingIds.map(
												(openingId, openingIndex) => {
													const opening =
														project.schemaVersion === 1
															? project.level.openings.find(
																	(candidate) =>
																		candidate.openingId === openingId,
																)
															: undefined;
													const resizeHeightMm = opening
														? roomHeightOpeningConflict.input.heightMm -
															opening.sillMm
														: 0;
													const actionSuffix =
														roomHeightOpeningConflict.openingIds.length === 1
															? ""
															: ` ${openingIndex + 1}`;
													return (
														<div
															className={inspectorStyles.resolution}
															key={openingId}
														>
															<span>
																{opening?.kind === "Window"
																	? "Окно"
																	: "Дверной проём"}
																{actionSuffix}
															</span>
															{resizeHeightMm > 0 ? (
																<button
																	aria-label={`Уменьшить проём${actionSuffix} до ${resizeHeightMm} мм`}
																	aria-pressed={
																		roomHeightOpeningConflict.resolutions[
																			openingId
																		] === "resize"
																	}
																	disabled={isWorking}
																	onClick={() =>
																		chooseRoomHeightOpeningResolution(
																			openingId,
																			"resize",
																		)
																	}
																	type="button"
																>
																	Уменьшить до {resizeHeightMm} мм
																</button>
															) : null}
															<button
																aria-label={`Удалить проём${actionSuffix}`}
																aria-pressed={
																	roomHeightOpeningConflict.resolutions[
																		openingId
																	] === "delete"
																}
																disabled={isWorking}
																onClick={() =>
																	chooseRoomHeightOpeningResolution(
																		openingId,
																		"delete",
																	)
																}
																type="button"
															>
																Удалить проём
															</button>
														</div>
													);
												},
											)}
											<div className={inspectorStyles.conflictActions}>
												<button
													disabled={isWorking}
													onClick={cancelRoomHeightOpeningConflict}
													type="button"
												>
													Отмена
												</button>
												<button
													disabled={
														isWorking ||
														!roomHeightOpeningConflict.openingIds.every(
															(openingId) =>
																roomHeightOpeningConflict.resolutions[
																	openingId
																] !== undefined,
														)
													}
													onClick={() =>
														void resolveRoomHeightOpeningConflict()
													}
													type="button"
												>
													Сохранить помещение и изменить{" "}
													{roomHeightOpeningConflict.openingIds.length} проём
												</button>
											</div>
										</section>
									) : null}
									{roomPropertyError ? (
										<p
											className={inspectorStyles.error}
											id="room-property-error"
											role="alert"
										>
											{roomPropertyError}
										</p>
									) : null}
									{roomPropertyConfirmation ? (
										<p className={inspectorStyles.success} role="status">
											{roomPropertyConfirmation}
										</p>
									) : null}
									{!roomHeightOpeningConflict ? (
										<button
											className={inspectorStyles.primary}
											disabled={isEditorReadOnly || isMutationBlocked}
											type="submit"
										>
											{isWorking ? "Сохраняем…" : "Сохранить помещение"}
										</button>
									) : null}
								</form>
							) : null}
						</div>
					</section>
				</aside>
			) : null}

			{isBuiltInCatalogOpen ? (
				<aside
					aria-label="Предметы интерьера"
					className={styles.catalogDialog}
					data-focused-preloaded-selection={
						selectedPreloadedCatalogAsset ? "true" : undefined
					}
					data-preloaded-resource-state={focusedPreloadedCatalogResourceState}
					onKeyDown={trapOverlayFocus}
					ref={catalogDialogRef}
					role="dialog"
					tabIndex={-1}
				>
					<div className={styles.dialogHeading}>
						<div>
							<span>БИБЛИОТЕКА ИНТЕРЬЕРА</span>
							<strong data-testid="catalog-title">Каталог</strong>
						</div>
						<button
							aria-label="Закрыть предметы интерьера"
							data-editor-host-back={fullTransientNavigationProtection ? "panel" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(false, closeOverlay) : closeOverlay()}
							type="button"
						>
							×
						</button>
					</div>

					<div className={styles.catalogContent}>
						{isCatalogPublicationOutage ? (
							<div
								className={styles.catalogInlineError}
								role="alert"
								data-testid="catalog-publication-error"
							>
								<strong>Каталог временно недоступен</strong>
								<button
									onClick={() => void loadCatalogPublication()}
									type="button"
								>
									Повторить
								</button>
							</div>
						) : null}
						{catalogPublicationState.kind === "loading" ? (
							<div
								className={styles.catalogImportStatus}
								data-testid="catalog-publication-status"
								role="status"
							>
								Загружаем актуальную версию каталога…
							</div>
						) : null}
						{catalogPublicationState.kind === "ready" ? (
							<div
								className={styles.catalogImportStatus}
								data-testid="catalog-publication-status"
								role="status"
							>
								<span className={styles.catalogPublicationSummary}>
									Каталог обновлён
								</span>
								<span className={styles.catalogPublicationDetails}>
									Версия {catalogPublicationState.publication.catalogVersion} ·{" "}
									{catalogPublicationState.publication.assets.length} предметов
									· envelope SHA-256{" "}
									{catalogPublicationState.publication.envelopeHash}
								</span>
							</div>
						) : null}
						<details
							className={styles.catalogAuthoring}
							data-testid="catalog-authoring"
						>
							<summary>
								<span
									aria-hidden="true"
									className={styles.catalogAuthoringIcon}
								>
									✦
								</span>
								<span className={styles.catalogAuthoringCopy}>
									<strong>Импорт модели</strong>
								</span>
								<span
									aria-hidden="true"
									className={styles.catalogAuthoringChevron}
								>
									⌄
								</span>
							</summary>
							<div className={styles.catalogAuthoringContent}>
								<section
									aria-label="Создать макетный предмет"
									className={styles.catalogImport}
								>
									<div>
										<strong>Свой макетный предмет</strong>
									</div>
									<button
										onClick={() => {
											setPlaceholderComposerError(undefined);
											setIsPlaceholderComposerOpen((isOpen) => !isOpen);
										}}
										type="button"
									>
										{isPlaceholderComposerOpen
											? "Скрыть параметры"
											: "Создать макетный предмет"}
									</button>
									{isPlaceholderComposerOpen ? (
										<form
											aria-label="Создать макетный предмет"
											className={styles.placeholderComposer}
											onSubmit={(event) => {
												event.preventDefault();
												beginPlaceholderPlacement();
											}}
										>
											<label>
												<span>Название макетного предмета</span>
												<input
													autoComplete="off"
													onChange={(event) =>
														setPlaceholderFields((fields) => ({
															...fields,
															label: event.target.value,
														}))
													}
													value={placeholderFields.label}
												/>
											</label>
											<div className={styles.placeholderDimensions}>
												<label>
													<span>Ширина макетного предмета, мм</span>
													<input
														autoComplete="off"
														inputMode="numeric"
														onChange={(event) =>
															setPlaceholderFields((fields) => ({
																...fields,
																widthMm: event.target.value,
															}))
														}
														value={placeholderFields.widthMm}
													/>
												</label>
												<label>
													<span>Глубина макетного предмета, мм</span>
													<input
														autoComplete="off"
														inputMode="numeric"
														onChange={(event) =>
															setPlaceholderFields((fields) => ({
																...fields,
																depthMm: event.target.value,
															}))
														}
														value={placeholderFields.depthMm}
													/>
												</label>
												<label>
													<span>Высота макетного предмета, мм</span>
													<input
														autoComplete="off"
														inputMode="numeric"
														onChange={(event) =>
															setPlaceholderFields((fields) => ({
																...fields,
																heightMm: event.target.value,
															}))
														}
														value={placeholderFields.heightMm}
													/>
												</label>
											</div>
											<fieldset className={styles.placeholderPalette}>
												<legend>Цвет макетного предмета</legend>
												<div>
													{alphaParametricItemColors.map((color) => (
														<button
															aria-label={`Выбрать цвет макетного предмета ${color}`}
															aria-pressed={placeholderFields.color === color}
															key={color}
															onClick={() =>
																setPlaceholderFields((fields) => ({
																	...fields,
																	color,
																}))
															}
															type="button"
														>
															<span
																aria-hidden="true"
																className={styles.itemColorSwatch}
																style={{ backgroundColor: color }}
															/>
														</button>
													))}
												</div>
											</fieldset>

											{placeholderComposerError ? (
												<p className={styles.fieldError} role="alert">
													{placeholderComposerError}
												</p>
											) : null}
											<button className={styles.primaryAction} type="submit">
												Начать размещение
											</button>
										</form>
									) : null}
								</section>
								<section
									aria-label="Локальное преобразование FBX"
									hidden={isEmbeddedHost}
									style={isEmbeddedHost ? { display: "none" } : undefined}
									className={styles.catalogImport}
								>
									<div>
										<strong>Импортировать FBX</strong>
									</div>
									<input
										accept=".fbx,.zip,.jpg,.jpeg,.png,.webp,application/octet-stream,application/zip,application/x-zip-compressed,image/jpeg,image/png,image/webp"
										aria-label="Выбрать FBX и текстуры для локального преобразования"
										className={styles.visuallyHidden}
										data-testid="fbx-import-input"
										disabled={isEmbeddedHost || fbxConversion.kind === "converting"}
										onChange={(event) =>
											void importFbxFiles(event.currentTarget.files)
										}
										ref={fbxImportInputRef}
										multiple
										type="file"
									/>
									{fbxConversion.kind === "idle" ? (
										<button
											onClick={() => fbxImportInputRef.current?.click()}
											type="button"
										>
											Выбрать FBX или ZIP
										</button>
									) : null}
									{fbxConversion.kind === "converting" ? (
										<div className={styles.catalogImportStatus} role="status">
											<span>
												Преобразуем {fbxConversion.filename} локально…
											</span>
											<button onClick={cancelFbxConversion} type="button">
												Отменить
											</button>
										</div>
									) : null}
									{fbxConversion.kind === "rejected" ? (
										<div className={styles.catalogImportStatus} role="status">
											<span>
												{fbxConversionFeedback(fbxConversion.reasonCode)}
											</span>
											<button
												onClick={() => setFbxConversion({ kind: "idle" })}
												type="button"
											>
												Понятно
											</button>
										</div>
									) : null}
								</section>
								<section
									aria-label="Импорт своей GLB-модели"
									className={styles.catalogImport}
								>
									<div>
										<strong>Уже есть GLB?</strong>
									</div>
									<input
										accept=".glb,model/gltf-binary,application/octet-stream"
										aria-label="Выбрать GLB-модель для размещения"
										className={styles.visuallyHidden}
										data-testid="custom-glb-import-input"
										disabled={customGlbImport.kind === "checking"}
										onChange={(event) =>
											void importCustomGlbFile(event.currentTarget.files?.[0])
										}
										ref={customGlbImportInputRef}
										type="file"
									/>
									{customGlbImport.kind === "idle" ? (
										<button
											onClick={() => customGlbImportInputRef.current?.click()}
											type="button"
										>
											Выбрать GLB
										</button>
									) : null}
									{customGlbImport.kind === "checking" ? (
										<div className={styles.catalogImportStatus} role="status">
											<span>
												Проверяем {customGlbImport.filename} локально…
											</span>
										</div>
									) : null}
									{customGlbImport.kind === "rejected" ? (
										<div className={styles.catalogImportStatus} role="status">
											<span>
												{customGlbImportFeedback(customGlbImport.reasonCode)}
											</span>
											<button onClick={discardCustomGlbImport} type="button">
												Выбрать другой файл
											</button>
										</div>
									) : null}
									{customGlbImport.kind === "ready" ? (
										<div className={styles.customGlbReview}>
											<p className={styles.catalogNote}>
												{customGlbImport.source === "fbx"
													? `Конвертировано из FBX: ${customGlbImport.filename} · ${customGlbImport.textureCount} ${customGlbImport.textureCount === 1 ? "текстура встроена" : "текстуры встроены"} в GLB`
													: `Выбран GLB: ${customGlbImport.filename}`}
											</p>
											<CustomGlbPreview
												bytes={customGlbImport.bytes}
												label={customGlbImport.displayName}
												onMeasuredDimensions={applyMeasuredCustomGlbDimensions}
											/>
											<div className={styles.customGlbFields}>
												<label>
													<span>Название модели</span>
													<input
														autoComplete="off"
														onChange={(event) =>
															updateCustomGlbImport((current) => ({
																...current,
																displayName: event.target.value,
															}))
														}
														value={customGlbImport.displayName}
													/>
												</label>
												<label>
													<span>Ширина, мм</span>
													<input
														inputMode="numeric"
														onChange={(event) =>
															updateCustomGlbDimension(
																"widthMm",
																event.currentTarget.value,
															)
														}
														onFocus={claimCustomGlbDimensions}
														onPointerDown={claimCustomGlbDimensions}
														value={customGlbImport.dimensions.widthMm}
													/>
												</label>
												<label>
													<span>Глубина, мм</span>
													<input
														inputMode="numeric"
														onChange={(event) =>
															updateCustomGlbDimension(
																"depthMm",
																event.currentTarget.value,
															)
														}
														onFocus={claimCustomGlbDimensions}
														onPointerDown={claimCustomGlbDimensions}
														value={customGlbImport.dimensions.depthMm}
													/>
												</label>
												<label>
													<span>Высота, мм</span>
													<input
														inputMode="numeric"
														onChange={(event) =>
															updateCustomGlbDimension(
																"heightMm",
																event.currentTarget.value,
															)
														}
														onFocus={claimCustomGlbDimensions}
														onPointerDown={claimCustomGlbDimensions}
														value={customGlbImport.dimensions.heightMm}
													/>
												</label>
											</div>
											<div className={styles.catalogImportStatus}>
												<span>
													{customGlbImport.filename} ·{" "}
													{(
														customGlbImport.bytes.byteLength /
														1024 /
														1024
													).toFixed(1)}{" "}
													MiB
												</span>
												<button onClick={discardCustomGlbImport} type="button">
													Другой файл
												</button>
											</div>
										</div>
									) : null}
								</section>
							</div>
						</details>
						<div className={styles.catalogFilters}>
							<label>
								<span>Поиск по названию, категории, креплению или размеру</span>
								<input
									autoComplete="off"
									onChange={(event) => setCatalogQuery(event.target.value)}
									placeholder="Найти предмет"
									ref={catalogSearchInputRef}
									value={catalogQuery}
								/>
							</label>
							<output aria-live="polite" data-testid="catalog-result-count">
								{itemCountCopy(catalogResultCount)}
							</output>
						</div>
						<nav
							aria-label="Категории каталога"
							className={styles.catalogCategoryTabs}
						>
							<button
								aria-pressed={catalogCategory === "all"}
								data-catalog-category="all"
								data-testid="catalog-category-filter"
								onClick={() => setCatalogCategory("all")}
								type="button"
							>
								<span
									aria-hidden="true"
									className={styles.catalogCategoryGlyph}
								>
									<CatalogCategoryGlyph category="all" />
								</span>
								<span className={styles.catalogCategoryLabel}>Все</span>
							</button>
							<button
								aria-pressed={catalogCategory === "custom"}
								data-catalog-category="custom"
								data-testid="catalog-category-filter"
								onClick={() => setCatalogCategory("custom")}
								type="button"
							>
								<span
									aria-hidden="true"
									className={styles.catalogCategoryGlyph}
								>
									<CatalogCategoryGlyph category="custom" />
								</span>
								<span className={styles.catalogCategoryLabel}>Кастомное</span>
							</button>
							{catalogSections.map((section) => (
								<button
									aria-pressed={catalogCategory === section.id}
									data-catalog-category={section.id}
									data-testid="catalog-category-filter"
									key={section.id}
									onClick={() => setCatalogCategory(section.id)}
									type="button"
								>
									<span
										aria-hidden="true"
										className={styles.catalogCategoryGlyph}
									>
										<CatalogCategoryGlyph category={section.id} />
									</span>
									<span className={styles.catalogCategoryLabel}>
										{section.label}
									</span>
								</button>
							))}
						</nav>
						<div className={styles.catalogGrid}>
							{customLibraryError ? (
								<p className={styles.catalogNote} role="alert">
									{customLibraryError}
								</p>
							) : null}
							{customCatalogAssets.map((asset) => (
								<div
									className={styles.customCatalogEntry}
									key={asset.definition.assetDefinitionId}
								>
									<button
										aria-label={`${asset.definition.displayName} — ${asset.definition.widthMm} × ${asset.definition.depthMm} × ${asset.definition.heightMm} мм, Кастомное${asset.resourceState === "unavailable" ? ", модель недоступна локально" : ""}`}
										aria-pressed={
											selectedCustomCatalogAsset?.definition
												.assetDefinitionId ===
											asset.definition.assetDefinitionId
										}
										className={styles.catalogCard}
										data-selected={
											selectedCustomCatalogAsset?.definition
												.assetDefinitionId ===
											asset.definition.assetDefinitionId
										}
										data-testid="custom-catalog-card"
										disabled={asset.resourceState !== "ready"}
										key={asset.definition.assetDefinitionId}
										onClick={() => selectCustomCatalogAsset(asset)}
										type="button"
									>
										{asset.resourceState === "ready" ? (
											<CustomGlbPreview
												bytes={asset.resource.bytes}
												label={asset.definition.displayName}
												variant="catalog"
											/>
										) : (
											<div className={styles.customGlbCatalogPlaceholder}>
												{asset.resourceState === "unavailable"
													? "Модель недоступна локально. Импортируйте исходный GLB заново."
													: "Загружаем локальную модель…"}
											</div>
										)}
										{selectedCustomCatalogAsset?.definition
											.assetDefinitionId ===
										asset.definition.assetDefinitionId ? (
											<span
												aria-hidden="true"
												className={styles.catalogCardSelectedMark}
												data-testid="catalog-card-selected-mark"
											>
												✓
											</span>
										) : null}
										<div className={styles.catalogCardDetails}>
											<strong>{asset.definition.displayName}</strong>
											<small>
												{asset.definition.widthMm} × {asset.definition.depthMm}{" "}
												× {asset.definition.heightMm} мм
											</small>
											<span className={styles.catalogCardMeta}>
												<span
													className={styles.catalogCardCategory}
													data-testid="catalog-card-category"
												>
													Кастомное
												</span>
												<span
													className={styles.catalogCardReadiness}
													data-testid="catalog-card-readiness"
												>
													{asset.resourceState === "unavailable"
														? "Нужен импорт"
														: "Локально"}
												</span>
											</span>
										</div>
									</button>
									<button
										className={styles.customCatalogRemove}
										type="button"
										aria-label={`Убрать ${asset.definition.displayName} из каталога`}
										disabled={removingCustomAssetId !== undefined}
										onClick={() =>
											void removeCustomCatalogAsset(asset.definition)
										}
									>
										{removingCustomAssetId ===
										asset.definition.assetDefinitionId
											? "Убираем…"
											: "Убрать из каталога"}
									</button>
									<small>
										Предметы в проектах останутся. Карточку можно вернуть
										повторным импортом GLB.
									</small>
								</div>
							))}
							{filteredPreloadedCatalogAssets.map((asset) => {
								const thumbnailUrl = catalogThumbnailUrlFor(
									asset,
									catalogThumbnailUrls,
								);
								const readiness = preloadedGlbResourceReadinessCopy(
									preloadedGlbResources[asset.id],
								);
								return (
									<button
										aria-label={`${asset.label} — ${asset.widthMm} × ${asset.depthMm} × ${asset.heightMm} мм, Встроенный каталог`}
										aria-pressed={
											selectedPreloadedCatalogAsset?.id === asset.id
										}
										className={styles.catalogCard}
										data-selected={
											selectedPreloadedCatalogAsset?.id === asset.id
										}
										data-testid="preloaded-catalog-card"
										key={asset.id}
										onClick={() => selectPreloadedCatalogAsset(asset)}
										type="button"
									>
										{unavailablePreloadedCatalogThumbnails.has(asset.id) ||
										!thumbnailUrl ? (
											<span
												className={styles.catalogThumbnailFallback}
												data-testid="preloaded-catalog-thumbnail-fallback"
											>
												Превью недоступно
											</span>
										) : (
											<img
												alt={`Превью предмета: ${asset.label}`}
												className={styles.catalogThumbnail}
												height="191"
												onError={() =>
													setUnavailablePreloadedCatalogThumbnails((failed) =>
														new Set(failed).add(asset.id),
													)
												}
												src={thumbnailUrl}
												width="318"
											/>
										)}
										{selectedPreloadedCatalogAsset?.id === asset.id ? (
											<span
												aria-hidden="true"
												className={styles.catalogCardSelectedMark}
												data-testid="catalog-card-selected-mark"
											>
												✓
											</span>
										) : null}
										<div className={styles.catalogCardDetails}>
											<strong>{asset.label}</strong>
											<small>
												{asset.widthMm} × {asset.depthMm} × {asset.heightMm} мм
											</small>
											<span className={styles.catalogCardMeta}>
												<span
													className={styles.catalogCardCategory}
													data-testid="catalog-card-category"
												>
													{
														catalogSections.find(
															(section) => section.id === asset.section,
														)?.label
													}
												</span>
												<span className={styles.catalogCardHost}>
													{asset.anchorClass === "wall"
														? "На стене"
														: "На полу"}
												</span>
												{(asset.variantCount ?? 0) > 0 ? (
													<span
														className={styles.catalogCardVariantCount}
														data-testid="catalog-card-variant-count"
													>
														Варианты: {asset.variantCount}
													</span>
												) : null}
												<span
													className={styles.catalogCardReadiness}
													data-testid="catalog-card-readiness"
												>
													{readiness}
												</span>
											</span>
										</div>
									</button>
								);
							})}
						</div>
						{catalogResultCount === 0 ? (
							<p
								className={styles.catalogEmpty}
								data-testid={
									catalogCategory === "custom" && catalogQuery.trim() === ""
										? "custom-catalog-empty-state"
										: undefined
								}
								role="status"
							>
								{catalogCategory === "custom" && catalogQuery.trim() === "" ? (
									<strong>Нет своих моделей</strong>
								) : catalogQuery.trim() === "" && catalogCategory !== "all" ? (
									`В локальном каталоге пока нет предметов в категории «${
										catalogSections.find(
											(section) => section.id === catalogCategory,
										)?.label ?? catalogCategory
									}».`
								) : (
									"В локальном каталоге нет предметов с такими параметрами."
								)}
							</p>
						) : null}
					</div>
					<div
						className={styles.catalogPlacementBar}
						data-testid="catalog-placement-bar"
						hidden={!hasCatalogPlacementSelection}
					>
						<div className={styles.catalogPlacementSelection}>
							<span
								aria-hidden="true"
								className={styles.catalogPlacementPreview}
								data-preview-kind={
									selectedPreloadedCatalogThumbnailUrl ? "thumbnail" : "symbol"
								}
								data-testid="catalog-placement-preview"
							>
								{selectedPreloadedCatalogThumbnailUrl ? (
									<img
										alt=""
										onError={() => {
											if (selectedPreloadedCatalogAsset) {
												setUnavailablePreloadedCatalogThumbnails((failed) =>
													new Set(failed).add(selectedPreloadedCatalogAsset.id),
												);
											}
										}}
										src={selectedPreloadedCatalogThumbnailUrl}
									/>
								) : (
									<span>{selectedCustomCatalogAsset ? "◇" : "✦"}</span>
								)}
							</span>
							<div className={styles.catalogPlacementCopy}>
								<strong>
									{customGlbImport.kind === "ready" &&
									!selectedPreloadedCatalogAsset &&
									!selectedCustomCatalogAsset
										? customGlbImport.displayName
										: (selectedPreloadedCatalogAsset?.label ??
											selectedCustomCatalogAsset?.definition.displayName ??
											"Выберите предмет")}
								</strong>
								<small>
									{customGlbImport.kind === "ready" &&
									!selectedPreloadedCatalogAsset &&
									!selectedCustomCatalogAsset
										? `${customGlbImport.filename} · ${(customGlbImport.bytes.byteLength / 1024 / 1024).toFixed(1)} MiB`
										: selectedPreloadedCatalogAsset
											? `${selectedPreloadedCatalogAsset.widthMm} × ${selectedPreloadedCatalogAsset.depthMm} × ${selectedPreloadedCatalogAsset.heightMm} мм`
											: selectedCustomCatalogAsset
												? `${selectedCustomCatalogAsset.definition.widthMm} × ${selectedCustomCatalogAsset.definition.depthMm} × ${selectedCustomCatalogAsset.definition.heightMm} мм`
												: ""}
								</small>
								{selectedPreloadedCatalogAsset?.resource ? (
									<small data-testid="catalog-selected-resource-metadata">
										Ресурс: {selectedPreloadedCatalogAsset.resource.byteLength}{" "}
										байт · SHA-256{" "}
										{selectedPreloadedCatalogAsset.resource.sha256}
									</small>
								) : null}
								{selectedPreloadedCatalogAsset &&
								isPreloadedCatalogResourcePreparing ? (
									<small
										className={styles.catalogModelLoadingStatus}
										data-testid="preloaded-catalog-loading-status"
										role="status"
									>
										<span>
											{selectedPreloadedCatalogResourceState?.kind === "loading"
												? preloadedGlbLoadingStatusCopy(
														selectedPreloadedCatalogResourceState,
													)
												: "Готовим для офлайн…"}
										</span>
										{selectedPreloadedCatalogResourceState?.kind ===
											"loading" &&
										selectedPreloadedCatalogResourceState.totalBytes ? (
											<progress
												aria-label="Прогресс загрузки модели"
												max={selectedPreloadedCatalogResourceState.totalBytes}
												value={Math.min(
													selectedPreloadedCatalogResourceState.loadedBytes,
													selectedPreloadedCatalogResourceState.totalBytes,
												)}
											/>
										) : (
											<progress aria-label="Прогресс загрузки модели" />
										)}
									</small>
								) : null}
								{selectedPreloadedCatalogAsset &&
								selectedPreloadedCatalogResourceState?.kind === "ready" ? (
									<small
										data-testid="preloaded-catalog-ready-status"
										role="status"
									>
										Готово для размещения
									</small>
								) : null}
								{selectedPreloadedCatalogAsset &&
								selectedPreloadedCatalogResourceState?.kind ===
									"unavailable" ? (
									<small
										data-testid="preloaded-catalog-resource-status"
										role="status"
									>
										Не удалось подготовить предмет для офлайн. Проект не
										изменён.
									</small>
								) : null}
							</div>
						</div>
						<button
							disabled={
								!(
									customGlbImport.kind === "ready" &&
									!selectedPreloadedCatalogAsset &&
									!selectedCustomCatalogAsset
								) &&
								((!selectedPreloadedCatalogAsset &&
									!selectedCustomCatalogAsset) ||
									selectedCustomCatalogAsset?.resourceState === "unavailable")
							}
							onClick={
								customGlbImport.kind === "ready" &&
								!selectedPreloadedCatalogAsset &&
								!selectedCustomCatalogAsset
									? beginCustomGlbPlacement
									: isPreloadedCatalogResourcePreparing
										? cancelPreloadedCatalogSelection
										: selectedPreloadedCatalogResourceState?.kind ===
												"unavailable"
											? retryPreloadedCatalogResource
											: beginCatalogPlacement
							}
							type="button"
						>
							{customGlbImport.kind === "ready" &&
							!selectedPreloadedCatalogAsset &&
							!selectedCustomCatalogAsset
								? "Добавить в «Кастомное» и разместить"
								: selectedPreloadedCatalogAsset &&
										isPreloadedCatalogResourcePreparing
									? "Отмена"
									: selectedPreloadedCatalogResourceState?.kind ===
											"unavailable"
										? "Повторить"
										: selectedCustomCatalogAsset?.resourceState ===
												"unavailable"
											? "Импортируйте GLB заново"
											: selectedPreloadedCatalogAsset
												? "Показать на плане"
												: "Разместить на плане"}
						</button>
						{selectedPreloadedCatalogResourceState?.kind === "unavailable" ? (
							<button onClick={cancelPreloadedCatalogSelection} type="button">
								Отмена
							</button>
						) : null}
					</div>
				</aside>
			) : null}
			{isProjectDeletionConfirmationOpen &&
			state.kind === "saved" &&
			!isWriterLeaseReadOnly ? (
				<ProjectConfirmationDialog
					label="Удалить проект"
					title="Удалить проект навсегда?"
					cancelLabel="Оставить проект"
					confirmLabel="Удалить навсегда"
					busyLabel="Удаляем…"
					busy={isDeletingProject}
					error={projectDeletionError}
					onCancel={() => setIsProjectDeletionConfirmationOpen(false)}
					onConfirm={() => void permanentlyDeleteCurrentProject()}
					returnFocusRef={editorHeaderMenuRef}
					fallbackFocusRef={projectsHeadingRef}
				>
					<p data-testid="project-deletion-target">
						{projectDeletionTargetText(state.project.name)}
					</p>
					<p>
						Проект и его локальные версии будут удалены без возможности
						восстановления. Это действие нельзя отменить.
					</p>
				</ProjectConfirmationDialog>
			) : null}
			{isHistoryDiscardConfirmationOpen &&
			isHistoryResourceRecovery &&
			!isWriterLeaseReadOnly ? (
				<ProjectConfirmationDialog
					label="Очистить историю изменений"
					title="Очистить историю изменений?"
					cancelLabel="Оставить историю"
					confirmLabel="Очистить историю"
					busyLabel="Проверяем текущий план…"
					busy={isDiscardingSessionHistory}
					error={historyDiscardError}
					onCancel={() => {
						setHistoryDiscardError(undefined);
						setIsHistoryDiscardConfirmationOpen(false);
					}}
					onConfirm={() => void discardSessionHistory()}
					returnFocusRef={historyDiscardTriggerRef}
					fallbackFocusRef={editorHeaderMenuRef}
					testId="history-discard-dialog"
				>
					<p>
						{historyResourceIssueHashes?.length === 1
							? "Одна сохранённая правка ссылается на отсутствующую или повреждённую модель."
							: "Сохранённые правки ссылаются на отсутствующие или повреждённые модели."}
					</p>
					<p>
						Текущий сохранённый план останется без изменений. Если очистить
						историю, действия «Отменить» и «Повторить» будут потеряны и их
						нельзя будет восстановить.
					</p>
				</ProjectConfirmationDialog>
			) : null}
			{state.kind === "recovery-needed" && isRecoveryRemovalConfirmationOpen ? (
				<ProjectConfirmationDialog
					label="Удалить недоступные модели"
					title="Удалить все недоступные модели?"
					cancelLabel="Отмена"
					confirmLabel="Подтвердить удаление всех недоступных моделей"
					busyLabel="Удаляем недоступные модели…"
					busy={isRemovingUnresolvedCustomGlb}
					error={recoveryRemovalError}
					onCancel={() => setIsRecoveryRemovalConfirmationOpen(false)}
					onConfirm={() => void removeUnresolvedCustomGlbReferences()}
					returnFocusRef={editorHeaderMenuRef}
					fallbackFocusRef={editorHeaderMenuRef}
				>
					<p>
						Будет сохранена одна новая версия без всех недоступных моделей. Это
						действие нельзя отменить через историю.
					</p>
				</ProjectConfirmationDialog>
			) : null}
			{itemColorVariantDraft && pendingItemColorVariant ? (
				<ProjectConfirmationDialog
					label="Подтвердить вариант цвета"
					title={`Применить вариант «${pendingItemColorVariant.label}»?`}
					cancelLabel="Отменить вариант"
					confirmLabel={
						isPersistenceFailure ? "Повторить сохранение" : "Применить вариант"
					}
					busyLabel="Сохраняем…"
					busy={isWorking}
					error={dimensionError}
					onCancel={() => setItemColorVariantDraft(undefined)}
					onConfirm={() => void confirmItemColorVariant()}
					returnFocusRef={editorHeaderMenuRef}
					fallbackFocusRef={editorHeaderMenuRef}
				>
					<p>
						Изменится только объявленный слот «Корпус». Габариты, положение и
						привязка предмета останутся прежними.
					</p>
				</ProjectConfirmationDialog>
			) : null}
			{isRestartConfirmationOpen ? (
				<ProjectConfirmationDialog
					label="Начать проект заново"
					title="Начать проект заново?"
					cancelLabel="Оставить чертёж"
					confirmLabel={
						isPersistenceFailure
							? "Повторить сохранение"
							: "Создать пустой план"
					}
					busyLabel="Создаём…"
					busy={isRestartingProject || isWorking}
					error={dimensionError}
					onCancel={() => setIsRestartConfirmationOpen(false)}
					onConfirm={() => void restartCurrentProject()}
					returnFocusRef={editorHeaderMenuRef}
					fallbackFocusRef={editorHeaderMenuRef}
					testId="restart-project-sheet"
				>
					<p>
						Будет создана новая пустая версия плана. Предыдущую версию можно
						сразу вернуть кнопкой «Отменить».
					</p>
				</ProjectConfirmationDialog>
			) : null}
		</main>
	);
}
