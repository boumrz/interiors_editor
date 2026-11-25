import { copy, editorLanguage } from "./editor-language";
import type { ProductMetric, ProductMetricSink } from "../application/editor-product-metrics";
import type { RoomRenderTheme } from "../adapters/renderer/three-dimensional-room-palette";
import { DoorSwingPicker } from "./door-swing-picker";
import type { ReleaseRecoveryRecord } from "../app/release-startup";
import { LegacyStartupRecoveryNotice } from "./legacy-startup-recovery";
import type { EditorNavigationProtection } from "./editor-host-boundary";
import {
	Fragment,
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
	type ProjectSummary,
	type VersionedCatalogPublication,
	WRITER_LEASE_HEARTBEAT_MS,
} from "../application/ports";
import type {
	PersistentStorageRequest,
	StoragePressure,
} from "../application/storage-pressure";
import type { ImportPortableBackupStatus } from "../application/import-portable-backup";
import type { AddWallSegmentInput } from "../domain/add-wall-segment";
import { wallOpeningHostsForProject, windowsWithMixedSillsOnSameWall } from "../domain/door-opening-project";
import { resolveOrthogonalPlanFaces } from "../domain/derived-orthogonal-plan-faces";
import {
	type AddGeneralWallHostResolutionInput,
	type GeneralWallProjectMutationAffectedReference,
	isGeneralVertexDeletionEligible,
	type MoveGeneralWallInput,
	previewWallAddHostConflict,
	previewWallDeletionConflict,
	uninterruptedWallRun,
	previewWallSplitHostConflict,
	type SplitGeneralWallHostResolutionInput,
	type SplitGeneralWallInput,
} from "../domain/general-wall-project";
import {
	alphaParametricItemColorVariants,
	type ItemColorVariantId,
} from "../domain/item-color-variant";
import { formatAreaMm2, formatLengthMm } from "./editor-measurement-format";
import {
	alphaParametricItemColors,
	assessParametricFloorItemPlacement,
	findRoomForFloorItem,
	floorYawFieldsForRadians,
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
import { EncryptedImportPasswordDialog, LocalFileTransferPanel, LocalFileTransferSession, type LocalFileTransferPort, type LocalFileTransferState } from "./local-file-transfer";
import { decryptProjectTransfer, isEncryptedProjectTransfer, MAX_ENCRYPTED_PROJECT_TRANSFER_BYTES } from "../adapters/telegram/encrypted-project-transfer";
import {
	previewRoomHeightOpeningConflict,
	type RoomHeightOpeningResolution,
	roomTypes,
	type UpdateRoomPropertiesInput,
} from "../domain/update-room-properties";
import { MINIMUM_RESIDENTIAL_DOORWAY_WIDTH_MM, type UpdateWallOpeningInput } from "../domain/wall-opening";
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
	itemPlacementPreviewFeedback,
	isFloorEditorAsset,
	itemPlacementWarningSummary,
	type WallSplitHostConflictResolutionResult,
	type WallSplitPublishResult,
	yawRadiansForEditorFloorAsset,
} from "./editor-plan-presentation";
import { type EditorViewport, initialEditorViewport } from "./editor-viewport";
import inspectorStyles from "./InspectorPanels.module.css";
import { ItemWallDistanceFields } from "./ItemWallDistances";
import { itemWallDistancePositionFor, itemWallDistancesFor, type ItemWallDistance } from "./item-wall-distances";
import { EditorModalSheet } from "./EditorModalSheet";
import { TmaFloorItemTabs, type FloorItemTab } from "./TmaFloorItemTabs";
import { TelegramSheetFrame } from "./TelegramSheetFrame";
import { SheetHeader } from "./SheetHeader";
import { EditorConsequenceSheet } from "./EditorConsequenceSheet";
import sheetStyles from "./SheetHeader.module.css";
import { createFloorItemWallSnap } from "./floor-item-wall-snap";
import { itemCountCopy } from "./item-count-copy";
import { openingCreationDialogKeyAction } from "./opening-creation-dialog";
import {
	type OpeningCreationDraft,
	type OpeningCreationKind,
	openingCreationDraftFor,
	openingCreationHostFor,
	openingCreationHostsFor,
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
	preloadedGlbCatalogLabelForDisplay,
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
import { TelegramGreyboxCatalog, telegramGreyboxKindForLabel, type TelegramGreyboxPreset } from "./telegram-greybox-catalog";
import { TelegramItemColor } from "./telegram-item-color";
import { roomTypeLabels } from "./room-type-labels";
import { moveDoorOpeningInProject } from "../domain/door-opening-project";
import { degreesForYawRadians, preciseYawRadiansFromDegrees, yawRadiansFromDegrees } from "./rotation-angle";
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
	readonly onProductMetric?: ProductMetricSink | undefined;
	readonly onProductMetricsReady?: (() => void) | undefined;
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
	readonly localGreyboxCatalog?: boolean;
	readonly roomTheme?: RoomRenderTheme | undefined;
	readonly exactFloorYaw?: boolean;
	readonly doorHingeAuthoring?: boolean;
	readonly projectsSupplement?: ReactNode;
	readonly onOpenSettings?: (restoreFocus?: HTMLElement) => void;
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
	readonly swingSide?: "left" | "right";
	readonly hingeEnd?: "end" | null;
	readonly baseRevisionId: string;
	readonly isMove?: boolean;
	readonly heightMm: string;
	readonly kind: "Door" | "Window";
	readonly offsetMm: string;
	readonly openingId: string;
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
	readonly wallRunSegmentIds?: readonly string[];
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
	readonly colorVariantId?: string;
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

type ProjectTransferDestination = "import" | "registered-import" | "repair";

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

function ItemInspectorActions({ telegram, children }: {
	readonly telegram: boolean;
	readonly children: ReactNode;
}) {
	return telegram ? <div className={styles.inspectorItemActions}>{children}</div> : children;
}

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
			return copy("Проверяем", "Checking");
		case "first-run":
			return copy("Новый проект", "New project");
		case "projects":
			return copy("Выберите проект", "Choose a project");
		case "saving":
			return copy("Сохраняем локально…", "Saving locally…");
		case "saved":
			return copy("Сохранено локально", "Saved locally");
		case "persist-failed":
			return copy("Не сохранено", "Unsaved");
		case "recovery-needed":
			return copy("Нужно восстановление", "Recovery needed");
		case "history-recovery-needed":
			return copy("История требует восстановления", "History needs recovery");
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
		? copy(`Локальное хранилище почти заполнено: занято не менее ${percentage}%. Экспортируйте проект до следующего изменения.`, `Local storage is nearly full. At least ${percentage}% is in use. Export your project before making another change.`)
		: copy(`Локальное хранилище заполнено на ${percentage}%. Подготовьте экспорт проекта до следующего изменения.`, `Local storage is ${percentage}% full. Prepare a project export before making another change.`);
}

function persistentStorageRequestCopy(
	result: PersistentStorageRequest,
): string {
	if (result.kind === "granted") {
		return copy("Браузер подтвердил защиту локального хранилища. Это не заменяет резервный экспорт проекта.", "The browser has confirmed that local storage is protected. Keep a separate project backup.");
	}
	if (result.kind === "not-granted") {
		return copy("Браузер не подтвердил защиту локального хранилища. Экспортируйте проект перед следующей правкой.", "The browser could not confirm local storage protection. Export your project before your next edit.");
	}
	return copy("Этот браузер не может подтвердить защиту локального хранилища. Экспортируйте проект перед следующей правкой.", "This browser cannot confirm local storage protection. Export your project before your next edit.");
}

/** Explains why the last durable Project revision intentionally stayed current. */
export function persistenceFailureCopy(reasonCode: string): string {
	if (reasonCode === "PERSISTENCE_QUOTA_EXCEEDED") {
		return copy("В локальном хранилище недостаточно места. Сохранённый план не изменён — экспортируйте проект, освободите место и повторите сохранение.", "Local storage is full. Your saved plan is intact. Export your project, free up space and save again.");
	}
	return reasonCode === "PROJECT_HISTORY_RESOURCE_LIMIT"
		? copy("Новая правка превысила лимит текущей истории. Закройте и заново откройте проект, чтобы начать новую историю; сохранённый план не изменён.", "This edit exceeds the session history limit. Reopen the project to start a new history. Your saved plan is intact.")
		: copy("Не удалось сохранить правку. Сохранённый план не изменён — повторите действие.", "The edit could not be saved. Your saved plan is intact. Try again.");
}

/** Name-specific feedback stays inside the rename dialog. */
export function renamePersistenceFailureCopy(reasonCode: string): string {
	return reasonCode === "PROJECT_HISTORY_RESOURCE_LIMIT" ||
		reasonCode === "PERSISTENCE_QUOTA_EXCEEDED"
		? copy(`Прежнее название не изменено. ${persistenceFailureCopy(reasonCode)}`, `The previous name is still in use. ${persistenceFailureCopy(reasonCode)}`)
		: copy("Прежнее название не изменено. Не удалось сохранить правку — повторите действие.", "The previous name is still in use. Try saving again.");
}

export function persistenceFailureActionCopy(reasonCode: string, retryPolicy: ReturnType<ProjectController["persistenceRetryPolicy"]> = "allowed"): string {
	if (retryPolicy === "registered-transfer-reselection-required") return copy("Выбрать исходный файл снова", "Choose the original file again");
	return reasonCode === "PROJECT_HISTORY_RESOURCE_LIMIT"
		? copy("Открыть проект заново", "Reopen project")
		: copy("Повторить сохранение", "Retry save");
}

/** The history branch is unchanged whenever its explicit discard cannot be proven safe. */
export function historyDiscardFailureCopy(reason: string): string {
	if (reason === "current-resource-issue") {
		return copy("Текущий план тоже требует восстановления, поэтому история не изменена.", "The current plan also needs recovery. The history is intact.");
	}
	if (reason === "read-only" || reason === "writer-lease-lost") {
		return copy("Проект открыт для редактирования в другом окне. История не изменена.", "This project is being edited in another window. The history is intact.");
	}
	return copy("Не удалось повторно проверить текущий план. История не изменена.", "The current plan could not be checked again. The history is intact.");
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
	if (editorLanguage() === "en") return `${count} ${count === 1 ? "room" : "rooms"}`;
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
		name: room.name?.trim() || copy(`Комната ${roomIndex + 1}`, `Room ${roomIndex + 1}`),
		type: room.type ?? "other",
	};
}

function wallCountCopy(count: number): string {
	if (editorLanguage() === "en") return `${count} ${count === 1 ? "wall" : "walls"}`;
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
			return copy("Стены", "Walls");
		case "item":
			return copy("Предмет", "Item");
		case "select":
			return copy("Рука и выбор", "Pan and select");
	}
}

type FloorItemEdit = "move" | "rotation" | "size";

const itemCollisionCopy: Record<FloorItemEdit, string> = {
	get move() { return copy("Пересечение с другим предметом. Предмет остался на прежнем месте.", "This overlaps another item. The item stayed in its previous position."); },
	get rotation() { return copy("Пересечение с другим предметом. Угол поворота не изменился.", "This overlaps another item. The angle stayed the same."); },
	get size() { return copy("Пересечение с другим предметом. Размеры не изменились.", "This overlaps another item. The dimensions stayed the same."); },
};

export function editRejectionMetric(reasonCode: string): ProductMetric | undefined {
	switch (reasonCode) {
		case "ITEM_COLLISION":
		case "WALL_ITEM_COLLISION":
		case "DOOR_CLEARANCE_COLLISION":
		case "ITEM_HOST_UNRESOLVABLE":
			return "item_collision";
		case "WALL_OPENING_COLLISION":
		case "WALL_DOOR_OPENING_COLLISION":
		case "OPENING_HOST_UNRESOLVABLE":
		case "OPENING_OVERLAP":
		case "OPENING_OUTSIDE_WALL_INTERVAL":
		case "OPENING_OUT_OF_BOUNDS":
		case "DOOR_WIDTH_EXCEEDS_WALL_LENGTH":
		case "WINDOW_WIDTH_EXCEEDS_WALL_LENGTH":
		case "ROOM_HEIGHT_OPENING_CONFLICT":
			return "opening_conflict";
		case "ROOM_USABLE_AREA_COLLAPSE":
		case "USABLE_POLYGON_COLLAPSED":
		case "INVALID_RESULTING_PROJECT":
		case "INVALID_PLAN_GRAPH":
		case "COLLINEAR_OVERLAP":
		case "TOO_SHORT_WALL":
		case "UNSUPPORTED_FACE_SHAPE":
		case "PROJECT_BOUNDS_EXCEEDED":
		case "UNSUPPORTED_DIRECTION":
		case "DIAGONAL_WALL_CONTACT_UNSUPPORTED":
		case "WALL_NOT_MOVABLE":
		case "VERTEX_NOT_MOVABLE":
		case "ROOM_NOT_DETACHED":
		case "ROOM_OVERLAP":
			return "geometry_rejected";
	}
}

export function errorCopy(reasonCode: string, itemEdit?: FloorItemEdit): string {
	switch (reasonCode) {
		case "OUTSIDE_ROOM_HOST":
			return copy("Предмет должен целиком находиться внутри выбранной комнаты.", "The item must fit entirely inside the selected room.");
		case "ITEM_COLLISION":
			return itemEdit ? itemCollisionCopy[itemEdit] : copy("Предметы не могут пересекаться.", "Items cannot overlap.");
		case "WALL_ITEM_COLLISION":
			return copy("Стена не может пересекать размещённый предмет. Переместите предмет или проведите стену иначе.", "A wall cannot intersect an item. Move the item or draw the wall in a different position.");
		case "WALL_HOST_NOT_FOUND":
			return copy("Выбранная стена больше недоступна. Выберите её ещё раз.", "The selected wall is unavailable. Select it again.");
		case "OUTSIDE_WALL_HOST":
			return copy("Предмет должен целиком помещаться на выбранной стене.", "The item must fit entirely on the selected wall.");
		case "WALL_OPENING_COLLISION":
			return copy("Настенный предмет не может пересекать дверной или оконный проём.", "A wall-mounted item cannot overlap a door or window opening.");
		case "ASSET_DEFINITION_NOT_PINNED":
			return copy("Модель ещё не закреплена в ресурсах этого проекта. Сначала завершите её добавление.", "Finish adding this model so its resources are available in the project.");
		case "WALL_ITEM_LOCKED":
		case "ITEM_LOCKED":
			return copy("Предмет заблокирован. Сначала разблокируйте его.", "Unlock the item first.");
		case "WALL_ITEM_LOCK_STATE_UNCHANGED":
		case "ITEM_LOCK_STATE_UNCHANGED":
			return copy("Предмет уже находится в выбранном состоянии блокировки.", "The item already has the selected lock setting.");
		case "WALL_DOOR_OPENING_COLLISION":
			return copy("Новая стена пересекает проём. Соедините её с краем проёма или проведите в стороне.", "The new wall intersects an opening. Join it to the edge of the opening or draw it in a different position.");
		case "DOOR_CLEARANCE_COLLISION":
			return copy("Предмет пересекает сектор открывания двери. Измените сторону двери или переместите предмет.", "The item overlaps the door swing. Change the swing direction or move the item.");
		case "PROJECT_BOUNDS_EXCEEDED":
			return copy("Новое положение или размер выходит за границы проекта.", "The proposed position or size exceeds the project bounds.");
		case "INVALID_DIMENSION":
			return copy("Введите целые положительные миллиметры.", "Enter a positive whole number of millimetres.");
		case "ZERO_LENGTH":
			return copy("Проведите стену с ненулевой длиной.", "Draw a wall with nonzero length.");
		case "ROOM_NOT_DETACHED":
			return copy("Новая комната не должна касаться существующего контура.", "Leave space between the new room and the existing outline.");
		case "ROOM_OVERLAP":
			return copy("Новая комната пересекает существующий контур.", "The new room overlaps the existing outline.");
		case "PLAN_TOPOLOGY_UNSUPPORTED":
			return copy("Этот план пока не поддерживает добавление отдельного контура.", "This plan does not currently support a separate outline.");
		case "PLAN_NOT_RECTANGULAR_STARTER":
			return copy("Для этого контура нужен инструмент стен, а не изменение стартовой стороны.", "Use the Wall tool to change this outline.");
		case "WALL_BOUNDARY":
			return copy("Внешнюю стену нельзя удалить в текущем плане.", "The outer wall cannot be deleted in the current plan.");
		case "WALL_NOT_FOUND":
		case "WALL_NOT_DELETABLE":
			return copy("Эту стену нельзя удалить в текущей топологии.", "This wall cannot be deleted in the current plan.");
		case "INVALID_WALL_HOST":
			return copy("Для проёма нужна корректно выбранная стена.", "Select an eligible wall for the opening.");
		case "DOOR_WIDTH_BELOW_MINIMUM":
			return copy(`Ширина дверного проёма должна быть не менее ${MINIMUM_RESIDENTIAL_DOORWAY_WIDTH_MM} мм.`, `The doorway must be at least ${MINIMUM_RESIDENTIAL_DOORWAY_WIDTH_MM} mm wide.`);
		case "DOOR_WIDTH_EXCEEDS_WALL_LENGTH":
			return copy("Ширина дверного проёма не может превышать длину выбранной стены.", "The door opening must fit within the wall length.");
		case "WINDOW_WIDTH_EXCEEDS_WALL_LENGTH":
			return copy("Ширина окна не может превышать длину выбранной стены.", "The window must fit within the wall length.");
		case "OPENING_OUTSIDE_WALL_INTERVAL":
			return copy("Проём не помещается в границы выбранной стены.", "The opening extends beyond the wall.");
		case "OPENING_OUT_OF_BOUNDS":
			return copy("Высота проёма превышает высоту выбранной стены.", "The opening is taller than the selected wall.");
		case "OPENING_OVERLAP":
			return copy("Проёмы на одной стене не могут пересекаться.", "Openings on a wall cannot overlap.");
		case "OPENING_NOT_FOUND":
			return copy("Этот проём уже удалён или недоступен.", "This opening is unavailable.");
		case "ITEM_HOST_UNRESOLVABLE":
			return copy("Изменение нарушит размещение предмета. Переместите предмет и повторите.", "This change would affect an item placement. Move the item and try again.");
		case "OPENING_HOST_UNRESOLVABLE":
			return copy("Изменение сделает проём невалидным. Сначала удалите или переместите проём.", "This change would make an opening invalid. Move or delete the opening first.");
		case "OPENING_CONFLICT_STALE":
			return copy("Состав затронутых проёмов изменился. Проверьте последствия ещё раз.", "The affected openings have changed. Review them again.");
		case "WALL_DELETION_CONFLICT":
			return copy("Перед удалением стены подтвердите все показанные последствия.", "Confirm the effects before deleting the wall.");
		case "STALE_BASE_REVISION":
			return copy("План изменился после preview. Проверьте последствия удаления ещё раз.", "The plan changed after the preview. Review the effects of deleting the wall again.");
		case "WRITER_LEASE_LOST":
			return copy("Редактирование перешло в другое окно. Удаление не выполнено.", "Editing moved to another window. The wall was not deleted.");
		case "WALL_ADD_CONFLICT_STALE":
			return copy("Состав затронутых проёмов или предметов изменился. Проверьте последствия добавления ещё раз.", "The affected openings or items have changed. Review the effects of adding the wall again.");
		case "ITEM_NOT_FOUND":
			return copy("Предмет уже удалён или недоступен.", "This item is unavailable.");
		case "ITEM_COLOR_UNSUPPORTED":
			return copy("Этот вариант цвета недоступен в локальном каталоге.", "This color is unavailable in the local catalog.");
		case "FIXED_ASSET_DIMENSIONS":
			return copy("Габариты этой 3D-модели зафиксированы её определением.", "This 3D model has fixed dimensions.");
		case "ITEM_COLOR_NOT_SUPPORTED":
			return copy("У этой 3D-модели не объявлены изменяемые варианты цвета.", "This 3D model has no adjustable colors.");
		case "ROOM_HEIGHT_CONFLICT":
			return copy("У объединяемых комнат разная высота. Сначала выровняйте её.", "The rooms have different heights. Set the same height before merging them.");
		case "ROOM_METADATA_CONFLICT_STALE":
			return copy("Состав объединяемых помещений изменился. Проверьте последствия ещё раз.", "The rooms to merge have changed. Review the effects again.");
		case "ROOM_NOT_FOUND":
			return copy("Выбранное помещение больше не существует в текущем плане.", "The selected room is no longer on the plan.");
		case "ROOM_NAME_REQUIRED":
			return copy("Укажите название помещения.", "Enter a room name.");
		case "ROOM_TYPE_INVALID":
			return copy("Выберите назначение помещения из списка.", "Choose a room type from the list.");
		case "ROOM_HEIGHT_INVALID":
			return copy("Высота комнаты должна быть целым числом от 500 до 10 000 мм.", "Enter a whole number between 500 and 10,000 mm for the room height.");
		case "ROOM_HEIGHT_OPENING_CONFLICT":
			return copy("Эта высота сделает существующий проём выше стены. Сначала измените или удалите проём.", "The wall would be shorter than an existing opening. Change or remove the opening first.");
		case "ROOM_HEIGHT_OPENING_CONFLICT_STALE":
			return copy("Состав затронутых проёмов изменился. Проверьте высоту помещения ещё раз.", "The affected openings have changed. Check the room height again.");
		case "ROOM_HEIGHT_OPENING_RESOLUTION_INVALID":
			return copy("Выбранный результат больше не подходит текущим проёмам. Проверьте их ещё раз.", "The selected result no longer fits the openings. Review them again.");
		case "ROOM_USABLE_AREA_COLLAPSE":
		case "USABLE_POLYGON_COLLAPSED":
			return copy("Изменение разрушит внутренний контур комнаты. Выберите другое положение стены.", "This change would leave the room without usable space. Choose a different wall position.");
		case "UNSUPPORTED_WALL_THICKNESS":
			return copy("Толщина стены должна быть целым числом от 20 до 1000 мм.", "Enter a whole number from 20 to 1,000 mm for the wall thickness.");
		case "WALL_POSITION_UNCHANGED":
			return copy("Укажите новое положение стены.", "Choose a new wall position.");
		case "WALL_NOT_MOVABLE":
			return copy("Эту стену пока нельзя переместить отдельно от связанных сегментов.", "This wall cannot move independently of the connected segments.");
		case "WALL_SPLIT_CONFLICT_STALE":
			return copy("Состав затронутых проёмов или предметов изменился. Проверьте последствия ещё раз.", "The affected openings or items have changed. Review the effects again.");
		case "WALL_SPLIT_POINT_INVALID":
			return copy("Выберите точку разделения строго внутри стены.", "Choose a point inside the wall segment.");
		case "VERTEX_NOT_FOUND":
			return copy("Эта вершина уже недоступна в текущем плане.", "This vertex is unavailable.");
		case "VERTEX_NOT_DELETABLE":
			return copy("Можно убрать только промежуточную вершину на прямой стене без проёмов.", "Only an intermediate vertex on a straight wall without openings can be removed.");
		case "VERTEX_POSITION_UNCHANGED":
			return copy("Вершина уже находится в этом положении.", "The vertex is already at this position.");
		case "VERTEX_NOT_MOVABLE":
			return copy("Этот перенос изменит связанные стены. Пока можно двигать только вершину на прямом участке.", "This move would change the connected walls. Move a vertex on a straight segment.");
		case "COLLINEAR_OVERLAP":
			return copy("Новая стена накладывается на существующий сегмент.", "The new wall overlaps an existing segment.");
		case "INVALID_PLAN_GRAPH":
			return copy("Контур стен нельзя безопасно замкнуть. Проверьте, что стены не пересекаются и соединяются в углах.", "The wall outline cannot close safely. Check that walls are joined at the corners and do not cross.");
		case "UNSUPPORTED_FACE_SHAPE":
			return copy("Этот замкнутый контур пока не поддерживается. Используйте простой выпуклый контур без пересечений.", "This closed outline is not supported yet. Use a simple convex shape without intersections.");
		case "DIAGONAL_WALL_CONTACT_UNSUPPORTED":
			return copy("Диагональная стена не может накладываться на другую, а точка пересечения должна попадать в целый миллиметр.", "Diagonal walls cannot overlap. Their intersection must fall on a whole millimetre.");
		case "TOO_SHORT_WALL":
			return copy("Стена должна быть длиннее своей толщины.", "The wall length must exceed its thickness.");
		case "UNSUPPORTED_DIRECTION":
			return copy("В альфе стены строятся горизонтально, вертикально или под углом 45°.", "Draw walls horizontally, vertically or at 45°.");
		case "INVALID_SOURCE_PROJECT":
		case "INVALID_RESULTING_PROJECT":
			return copy("Этот план нельзя безопасно изменить. Проверьте его целостность.", "This plan cannot be changed safely. Check its geometry.");
		default:
			return copy("Не удалось применить изменение. Проверьте параметры и попробуйте снова.", "The change could not be applied. Check the details and try again.");
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
					message: copy(`Стена не может пересекать предмет «${item.label}». Откройте предмет, чтобы переместить его, или проведите стену иначе.`, `The wall would intersect “${item.label}”. Open the item to move it or draw the wall in a different position.`),
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
	const name = copy(`${opening.kind === "Door" ? "Дверной проём" : "Окно"} № ${ordinal + 1}`, `${opening.kind === "Door" ? "Door opening" : "Window"} #${ordinal + 1}`);
	return {
		kind: "opening",
		message: copy(`Стена пересекает ${name} на выбранной стене. Откройте ${opening.kind === "Door" ? "проём" : "окно"}, чтобы изменить его, или проведите стену иначе.`, `The wall intersects ${name} on the selected wall. Open it to adjust it or draw the wall in a different position.`),
		opening,
	};
}

export function wallThicknessErrorCopy(reasonCode: string): string {
	switch (reasonCode) {
		case "INVALID_DIMENSION":
			return copy("Толщина стены должна быть целым числом миллиметров.", "Enter a whole number of millimetres for the wall thickness.");
		case "PROJECT_BOUNDS_EXCEEDED":
			return copy("Толщина стены должна быть в допустимом диапазоне 20–1000 мм.", "Wall thickness must be between 20 and 1,000 mm.");
		case "ROOM_USABLE_AREA_COLLAPSE":
		case "USABLE_POLYGON_COLLAPSED":
			return copy("Эта толщина схлопнет внутренний контур комнаты. Укажите меньшее значение.", "This thickness would remove the usable space inside the room. Enter a smaller value.");
		default:
			return errorCopy(reasonCode);
	}
}

export function projectNameErrorCopy(reasonCode: string): string {
	return reasonCode === "PROJECT_NAME_INVALID_UNICODE"
		? copy("Название содержит недопустимый символ. Удалите его и повторите попытку.", "The name contains an unsupported character. Remove it and try again.")
		: copy("Введите название проекта.", "Enter a project name.");
}

/** A project card is a place to return to, not a diagnostic log. */
export function projectDirectoryUpdatedCopy(updatedAt: string): string {
	const timestamp = new Date(updatedAt);
	if (Number.isNaN(timestamp.valueOf())) return copy("Изменён недавно", "Edited recently");
	const formatted = new Intl.DateTimeFormat(copy("ru-RU", "en-US"), {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
	}).format(timestamp);
	return copy(`Изменён · ${formatted}`, `Edited · ${formatted}`);
}

type ProjectTransferImportRejection =
	| Extract<Awaited<ReturnType<ProjectController["importProjectTransfer"]>>, { readonly kind: "rejected" }>["reasonCode"]
	| Extract<Awaited<ReturnType<typeof decryptProjectTransfer>>, { readonly kind: "rejected" }>["reasonCode"]
	| "BACKUP_LIMIT_EXCEEDED"
	| "FILE_LIMIT_EXCEEDED"
	| "FILE_SIZE_MISMATCH"
	| "verification-unavailable";

export function projectTransferImportMetric(reasonCode: ProjectTransferImportRejection): ProductMetric | undefined {
	switch (reasonCode) {
		case "BACKUP_CANCELLED":
		case "PORTABLE_BACKUP_CANCELLED":
		case "TRANSFER_CANCELLED":
		case "INVALID_TRANSFER_PASSWORD":
			return undefined;
		case "PORTABLE_BACKUP_FUTURE_SCHEMA":
		case "BACKUP_CONTAINER_UNSUPPORTED":
			return "backup_incompatible";
		case "verification-unavailable":
		case "TRANSFER_CRYPTO_UNAVAILABLE":
			return "backup_import_failed";
		default:
			return "backup_invalid";
	}
}

export function projectTransferImportFeedback(reasonCode: string): string {
	switch (reasonCode) {
		case "PROJECT_BACKUP_ENVELOPE_EXCEEDED":
			return copy("Текущий формат резервной копии в браузере не сохраняет эти данные точно. Исходный файл и существующие проекты не изменены.", "The current browser backup format cannot store these data exactly. The source file and existing projects are intact.");
		case "BACKUP_SCHEMA_UNREADABLE":
			return copy("Не удалось безопасно определить формат файла. Исходный файл и существующие проекты не изменены.", "The file format could not be recognized safely. The source file and existing projects are intact.");
		case "verification-unavailable":
			return copy("Проверка этого файла сейчас недоступна. Повторите попытку или обновите приложение. Исходный файл и существующие проекты не изменены.", "This file cannot be verified right now. Try again or update the app. The source file and existing projects are intact.");
		case "BACKUP_CHECKSUM_MISMATCH":
		case "PROJECT_JSON_CHECKSUM_MISMATCH":
		case "PORTABLE_BACKUP_CHECKSUM_MISMATCH":
			return copy("Контрольная сумма файла не совпала. Передайте исходный файл заново.", "The file checksum did not match. Share the original file again.");
		case "BACKUP_CANCELLED":
		case "PORTABLE_BACKUP_CANCELLED":
			return copy("Импорт отменён. Существующие проекты не изменены.", "Import canceled. Existing projects are intact.");
		case "PORTABLE_BACKUP_FUTURE_SCHEMA":
			return copy("Этот backup создан более новой версией приложения. Обновите приложение и повторите импорт; существующие проекты не изменены.", "This backup was created with a newer version of the app. Update the app and import it again. Existing projects are intact.");
		case "BACKUP_LIMIT_EXCEEDED":
		case "PORTABLE_BACKUP_LIMIT_EXCEEDED":
			return copy("Backup превышает безопасный размер или количество файлов для телефона. Существующие проекты не изменены.", "The backup exceeds the mobile limit for size or file count. Existing projects are intact.");
		default:
			return copy("Не удалось проверить файл проекта. Существующие проекты не изменены.", "The project file could not be verified. Existing projects are intact.");
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
			return copy(`Читаем ${state.filename}…`, `Reading ${state.filename}…`);
		case "validating":
			return copy("Проверяем контейнер, схему и контрольные суммы…", "Checking the container, schema and checksums…");
		case "staging-resources":
			return state.total === 0
				? copy("Подготавливаем новый локальный проект…", "Preparing a new local project…")
				: copy(`Проверяем локальные ресурсы: ${state.completed} из ${state.total}…`, `Checking local resources (${state.completed} of ${state.total})…`);
		case "checking-render":
			return copy("Проверяем локальное чтение и 2D/3D-проекцию…", "Verifying local access and the 2D and 3D views…");
		case "saving":
			return copy("Публикуем новый локальный проект…", "Saving a new local project…");
		case "cancelling":
			return copy("Останавливаем импорт и очищаем временные данные…", "Canceling the import and clearing temporary data…");
	}
}

/** User-visible FBX copy is deliberately about conversion, never about a durable Project import. */
export function fbxConversionFeedback(reasonCode: string): string {
	switch (reasonCode) {
		case "FBX_FILE_SELECTION_INVALID":
			return copy("Выберите один FBX с текстурами либо один ZIP-архив с такой моделью.", "Choose one FBX with textures or one ZIP archive containing that model.");
		case "FBX_ARCHIVE_INVALID":
			return copy("ZIP-архив не удалось прочитать. Скачайте модель заново и выберите исходный ZIP.", "The ZIP archive could not be opened. Download it again and choose the original ZIP.");
		case "FBX_ARCHIVE_BYTES_LIMIT":
			return copy("ZIP-архив ограничен 25 MiB для надёжного локального преобразования на телефоне.", "The ZIP archive is limited to 25 MiB for mobile conversion.");
		case "FBX_ARCHIVE_RESOURCE_LIMIT":
			return copy("В ZIP слишком много файлов или распакованных данных для одного предмета. Экспортируйте одну модель с уменьшенными текстурами.", "The ZIP contains too many files or too much extracted data. Export a single model with smaller textures.");
		case "FBX_SIDECAR_TYPE_UNSUPPORTED":
			return copy("Вместе с FBX поддерживаются только текстуры JPG, PNG или WebP. Уберите другие файлы или упакуйте модель в GLB.", "FBX textures must be JPG, PNG or WebP. Remove other files or package the model as GLB.");
		case "FBX_FILE_BYTES_LIMIT":
			return copy("Один FBX для телефона ограничен 12 MiB. Выберите отдельный предмет, а не набор мебели.", "A mobile FBX is limited to 12 MiB. Choose a single furniture model.");
		case "FBX_SIDECAR_BYTES_LIMIT":
			return copy("Текстуры, выбранные вместе с FBX, ограничены 13 MiB. Уменьшите текстуры или выберите GLB до 25 MiB.", "FBX textures are limited to 13 MiB. Use smaller textures or choose GLB up to 25 MiB.");
		case "FBX_BINARY_HEADER_REQUIRED":
			return copy("Нужен binary FBX версии 7.1–7.8, а не текстовый или переименованный файл.", "Choose a binary FBX version 7.1–7.8.");
		case "UNSUPPORTED_FBX_VERSION":
			return copy("Версия FBX не поддерживается. Экспортируйте binary FBX 7.1–7.8 или сразу GLB.", "This FBX version is unsupported. Export a binary FBX 7.1–7.8 or a GLB.");
		case "FBX_EXTERNAL_RESOURCE":
			return copy("Для этой FBX выберите вместе с моделью все нужные текстуры JPG, PNG или WebP — приложение не скачивает файлы по ссылкам.", "Select all required JPG, PNG or WebP textures with the FBX. The app uses the files you select.");
		case "FBX_UNSUPPORTED_SCENE_CONTENT":
			return copy("Поддерживается только статичный предмет без анимации, скелета, morph-targets, камер и света.", "Choose a static item without animation, rigs, morph targets, cameras or lights.");
		case "FBX_CONVERSION_OUTPUT_LIMIT":
			return copy("Нормализованная GLB-модель превысила 25 MiB. Уменьшите геометрию или текстуры и повторите.", "The converted GLB exceeds 25 MiB. Simplify the model or reduce its textures and try again.");
		case "FBX_CONVERSION_TIMEOUT":
			return copy("Преобразование не завершилось за 15 секунд и было безопасно остановлено.", "The conversion exceeded 15 seconds and was stopped.");
		case "FBX_CONVERSION_CANCELLED":
			return copy("Преобразование отменено. Проект и локальное хранилище не изменены.", "Conversion canceled. The project and local storage are intact.");
		default:
			return copy("Не удалось безопасно преобразовать FBX. Проект и локальное хранилище не изменены.", "The FBX could not be converted safely. The project and local storage are intact.");
	}
}

function customGlbImportFeedback(reasonCode: string): string {
	switch (reasonCode) {
		case "GLB_BYTES_LIMIT":
		case "GLB_FILE_BYTES_LIMIT":
			return copy("Одна GLB-модель ограничена 25 MiB, чтобы её можно было хранить и открыть на телефоне.", "Each GLB is limited to 25 MiB for mobile storage and viewing.");
		case "GLB_HEADER_INVALID":
		case "GLB_JSON_INVALID":
		case "MALFORMED_GLTF":
			return copy("Это не целая GLB 2.0. Экспортируйте из Blender/Maya в один файл .glb и повторите.", "Choose a complete GLB 2.0 file. Export a single .glb file from Blender or Maya.");
		case "EXTERNAL_RESOURCE":
			return copy("Модель ссылается на отдельные текстуры или файлы. Экспортируйте self-contained GLB со всеми текстурами внутри.", "The model refers to external files. Export a GLB with all textures embedded.");
		case "UNSUPPORTED_DYNAMIC_CONTENT":
		case "ANIMATION_OR_SKIN_UNSUPPORTED":
			return copy("Поддерживается статичная модель без анимации, рига, камеры и света.", "Choose a static model without animation, a rig, cameras or lights.");
		case "UNSUPPORTED_REQUIRED_EXTENSION":
			return copy("В модели используется неподдерживаемое расширение glTF. Экспортируйте стандартный GLB без расширений.", "This model uses an unsupported glTF extension. Export a standard GLB without extensions.");
		case "GLB_GEOMETRY_BUDGET":
		case "DECODED_GEOMETRY_LIMIT":
			return copy("В модели слишком много геометрии для надёжного мобильного предпросмотра. Упростите её и повторите.", "This model is too detailed for mobile preview. Simplify it and try again.");
		case "GLB_TEXTURE_BUDGET":
		case "TEXTURE_LIMIT":
			return copy("В модели слишком много текстур для мобильного проекта. Объедините или уменьшите текстуры.", "This model has too many textures for a mobile project. Merge or reduce them.");
		case "MEMORY_BUDGET_RISK":
			return copy("Текстуры после распаковки слишком велики для надёжной работы на телефоне. Уменьшите их до 4096 px по стороне и 48 Мп суммарно.", "The extracted textures are too large for mobile. Reduce them to 4,096 px per side and 48 MP in total.");
		default:
			return copy("Не удалось проверить GLB. Проект и локальное хранилище не изменены.", "The GLB could not be verified. The project and local storage are intact.");
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
		filename.replace(/\.(?:fbx|glb)$/i, "").trim() || copy("Моя модель", "My model");
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
				? copy(`Готовим для офлайн · ${Math.round((state.loadedBytes / state.totalBytes) * 100)}%`, `Preparing for offline use · ${Math.round((state.loadedBytes / state.totalBytes) * 100)}%`)
				: copy("Готовим для офлайн", "Preparing for offline use");
		case "ready":
			return copy("Готово для размещения", "Ready to place");
		case "unavailable":
			return copy("Не удалось подготовить предмет для офлайн", "Could not prepare the item for offline use");
		default:
			return copy("Готово к загрузке", "Ready to download");
	}
}

export function preloadedGlbLoadingStatusCopy(
	state: Readonly<{ loadedBytes: number; totalBytes?: number }>,
): string {
	if (!state.totalBytes) return copy("Готовим для офлайн…", "Preparing for offline use…");
	const percent = Math.min(
		100,
		Math.round((state.loadedBytes / state.totalBytes) * 100),
	);
	return copy(`Готовим для офлайн… ${percent}%`, `Preparing for offline use… ${percent}%`);
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
			return copy("Предмет размещён и сохранён.", "Item placed and saved.");
		case "in-progress":
			return copy("Предыдущая правка ещё сохраняется. Подождите и повторите размещение.", "The previous edit is still saving. Wait, then place the item again.");
		case "not-ready":
			return copy("Проект ещё открывается. Подождите и повторите размещение предмета.", "The project is still opening. Wait, then place the item again.");
		case "persist-failed":
			return copy("Не удалось сохранить предмет. Повторите сохранение и разместите его снова.", "The item could not be saved. Retry the save and place it again.");
		case "cancelled":
			return copy("Размещение предмета отменено.", "Item placement canceled.");
		case "rejected":
			return result.reasonCode
				? errorCopy(result.reasonCode)
				: copy("Предмет нельзя разместить в этой точке.", "The item cannot be placed here.");
		default:
			return copy("Предмет пока нельзя разместить. Повторите действие.", "The item could not be placed. Try again.");
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

function canEditOpeningOffset(draft: OpeningDraftFields, telegram: boolean): boolean {
	return draft.isMove === true || (telegram && draft.kind === "Door");
}

export function openingEditInputFor(
	draft: OpeningDraftFields,
	saved: Pick<Project["level"]["openings"][number], "kind" | "offsetMm" | "openingId" | "sillMm"> | undefined,
	telegram: boolean,
): UpdateWallOpeningInput | undefined {
	if (saved?.openingId !== draft.openingId || saved.kind !== draft.kind) return undefined;
	const widthMm = positiveInteger(draft.widthMm);
	const heightMm = positiveInteger(draft.heightMm);
	const offsetMm = canEditOpeningOffset(draft, telegram) ? nonNegativeSafeInteger(draft.offsetMm) : saved.offsetMm;
	if (widthMm === undefined || heightMm === undefined || offsetMm === undefined) return undefined;
	return {
		openingId: saved.openingId,
		heightMm,
		offsetMm,
		sillMm: saved.sillMm,
		widthMm,
		...(draft.swingSide ? { swingSide: draft.swingSide } : {}),
		...(draft.hingeEnd !== undefined ? { hingeEnd: draft.hingeEnd } : {}),
	};
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
					? copy("Обновление готово к перезапуску", "Update ready to apply")
					: copy("Обновление готово", "Update ready")}
			</strong>
			<p>
				{canActivate
					? isReloadReady
						? copy("Текущий проект сохранён. Перезагрузите приложение, когда будете готовы.", "The project is saved. Reload the app when you are ready.")
						: copy("Текущий проект сохранён. Обновите приложение, когда будете готовы.", "The project is saved. Update the app when you are ready.")
					: hasUndurableDraft
						? copy("Завершите или отмените черновую правку перед обновлением приложения.", "Finish or cancel the draft before updating.")
						: copy("Обновление будет доступно после завершения сохранения текущего проекта.", "You can update after the current project finishes saving.")}
			</p>
			<button
				disabled={!canActivate}
				onClick={isReloadReady ? pwaUpdate.reload : pwaUpdate.activate}
				type="button"
			>
				{isReloadReady ? copy("Перезагрузить приложение", "Reload app") : copy("Обновить приложение", "Update app")}
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
				{isPrompting ? copy("Открываем установку…", "Opening installation…") : copy("Установить приложение", "Install app")}
			</button>
			{promptOutcome === "unavailable" ? (
				<div role="status">
					{copy("Установка сейчас недоступна.", "Installation is unavailable right now.")}
					<button
						type="button"
						aria-label={copy("Закрыть уведомление", "Dismiss notification")}
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
	plainLabels = false,
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
	readonly plainLabels?: boolean;
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
			<strong>{copy("Проект открыт в другом окне", "Project open in another window")}</strong>
			<p>
				{copy("В этом окне редактирование остановлено, чтобы версии не перезаписали друг друга.", "Editing is paused in this window to prevent conflicting saves.")}
			</p>
			{hasRecoveryCopy ? (
				<>
					<p>
						{copy("Незавершённое изменение осталось в этом окне. Скачайте его, чтобы восстановить как отдельный проект.", "The unfinished edit is still in this window. Download it to recover it as a separate project.")}
					</p>
					<button onClick={onRecoveryExport} type="button">
						{copy("Скачать несохранённую правку", "Download unsaved edit")}
					</button>
					<button onClick={onToggleRecoveryCopy} type="button">
						{isShowingRecoveryCopy
							? copy("Показать актуальную версию", "Show current version")
							: copy("Показать recovery-копию", "Show recovery copy")}
					</button>
				</>
			) : null}
			{isConfirming ? (
				<>
					<p>
						{copy("После перехвата другое окно потеряет право сохранять этот проект. Подтвердите действие или отмените его — сохранённая версия не изменится.", "The other window will lose edit access after takeover. Confirm or cancel to keep the saved version.")}
					</p>
					<button data-editor-action="confirm" disabled={isTakingOver} onClick={onConfirm} type="button">
						{isTakingOver
							? copy("Перехватываем редактирование…", "Taking over editing…")
							: plainLabels ? copy("Подтвердить", "Confirm") : copy("Подтвердить перехват", "Confirm takeover")}
					</button>
					<button data-editor-action="cancel" disabled={isTakingOver} onClick={onCancel} type="button">
						{plainLabels ? copy("Отменить", "Cancel") : copy("Отмена", "Cancel")}
					</button>
				</>
			) : (
				<button onClick={onRequestTakeOver} type="button">
					{copy("Взять редактирование на себя", "Take over editing")}
				</button>
			)}
			{error ? <p role="alert">{error}</p> : null}
		</aside>
	);
}

export function AppShell({
	onProductMetric,
	onProductMetricsReady,
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
	roomTheme,
	registeredTransferImport,
	registeredTransferExport,
	fileTransfer,
	sourceRecovery,
	catalogGateway,
	localGreyboxCatalog = false,
	exactFloorYaw = false,
	doorHingeAuthoring = false,
	projectsSupplement,
	onOpenSettings,
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
	const metricSink = useRef(onProductMetric);
	metricSink.current = onProductMetric;
	const reportProductMetric = useCallback<ProductMetricSink>((metric) => {
		try { metricSink.current?.(metric); } catch { /* Statistics must not change the editor's outcome. */ }
	}, []);
	const reportEditRejection = (reasonCode: string) => {
		const metric = editRejectionMetric(reasonCode);
		if (metric) reportProductMetric(metric);
	};
	useEffect(() => {
		if (onProductMetric) {
			return controller.subscribeProductMetrics?.((metric) => reportProductMetric(metric));
		}
	}, [controller, onProductMetric, reportProductMetric]);
	const projectDirectoryRef = useRef<HTMLUListElement>(null);
	useEffect(() => {
		if (state.kind !== "projects") return;
		const openMenus = () => projectDirectoryRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]") ?? [];
		const closeOutsideMenus = (event: MouseEvent) => {
			for (const menu of openMenus()) {
				if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
			}
		};
		const dismissMenu = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape") return;
			for (const menu of openMenus()) {
				menu.open = false;
				menu.querySelector("summary")?.focus();
				event.preventDefault();
			}
		};
		document.addEventListener("click", closeOutsideMenus);
		document.addEventListener("keydown", dismissMenu);
		return () => {
			document.removeEventListener("click", closeOutsideMenus);
			document.removeEventListener("keydown", dismissMenu);
		};
	}, [state.kind]);
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
	const localFileSession = useMemo(() => fileTransfer ? new LocalFileTransferSession(fileTransfer, setLocalFileState, reportProductMetric) : undefined, [fileTransfer, reportProductMetric]);
	useEffect(() => () => localFileSession?.close(), [localFileSession]);
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
	const [encryptedProjectTransfer, setEncryptedProjectTransfer] = useState<{
		readonly file: File;
		readonly destination: ProjectTransferDestination;
		readonly error?: string;
	}>();
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
	const [directoryRenameTarget, setDirectoryRenameTarget] = useState<ProjectSummary>();
	const [directoryRenameWrite, setDirectoryRenameWrite] = useState<"idle" | "saving" | "retained">("idle");
	const directoryRenameInFlight = useRef(false);
	const [dimensionNotice, setDimensionNotice] = useState<{
		readonly kind: "notice" | "item-collision";
		readonly message: string;
	}>();
	const dimensionError = dimensionNotice?.message;
	const setDimensionError = useCallback((message: string | undefined, kind: "notice" | "item-collision" = "notice") => {
		setDimensionNotice(message === undefined ? undefined : { kind, message });
	}, []);
	const showEditRejection = (reasonCode: string) => {
		setDimensionError(errorCopy(reasonCode));
		reportEditRejection(reasonCode);
	};
	const [directoryDeletionTarget, setDirectoryDeletionTarget] = useState<{
		readonly projectId: string;
		readonly name: string;
		readonly storageNamespace?: ProjectStorageNamespace;
	}>();
	const directoryDeletionTriggerRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (dimensionNotice?.kind !== "notice") return;
		const timeout = window.setTimeout(() => setDimensionError(undefined), 5000);
		return () => window.clearTimeout(timeout);
	}, [dimensionNotice, setDimensionError]);
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
	const [openingEntry, setOpeningEntry] = useState<"add" | OpeningCreationKind>();
	const [showOpeningWallList, setShowOpeningWallList] = useState(false);
	const [showOpeningCreationDetails, setShowOpeningCreationDetails] = useState(false);
	const [openingDraft, setOpeningDraft] = useState<OpeningDraftFields>();
	const isOpeningDialogOpen =
		openingEntry !== undefined || openingCreationDraft !== undefined || openingDraft !== undefined;
	const [selectedOpeningId, setSelectedOpeningId] = useState<string>();

	const [wallDeletionConflict, setWallDeletionConflict] =
		useState<WallDeletionConflict>();
	const [wallAddHostConflict, setWallAddHostConflict] =
		useState<WallAddHostConflict>();
	const [isResolvingWallAddHostConflict, setIsResolvingWallAddHostConflict] =
		useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>("plan");
	const [rotationStepMode, setRotationStepMode] = useState(false);
	const onRotationStepModeChange = hostNavigation && exactFloorYaw ? setRotationStepMode : undefined;
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
	const retainedPlacementPoint = useRef<{ readonly xMm: number; readonly zMm: number } | undefined>(undefined);
	const changeItemPlacementYaw = useCallback((value: number) => {
		if (Number.isFinite(value))
			setItemPlacementYawRadians(
				yawRadiansFor(floorYawFieldsForRadians(value, exactFloorYaw)),
			);
	}, [exactFloorYaw]);
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
		if (!isOpeningDialogOpen || hostNavigation) return;
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
	}, [hostNavigation, isOpeningDialogOpen]);

	const [isBuiltInCatalogOpen, setIsBuiltInCatalogOpen] = useState(false);
	const [isModelLibrarySelected, setIsModelLibrarySelected] = useState(false);
	const CatalogAuthoring = localGreyboxCatalog ? "div" : "details";
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
	>(localGreyboxCatalog ? [] : localPreloadedGlbCatalogAssets);
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
	const [floorDimensionErrors, setFloorDimensionErrors] = useState<
		Partial<Record<keyof DimensionFields, string>>
	>({});
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
	useEffect(() => () => projectTransferAbortRef.current?.abort(), []);
	const projectsHeadingRef = useRef<HTMLHeadingElement>(null);
	const editorHeaderMenuRef = useRef<HTMLButtonElement>(null);
	const sceneColorTriggerRef = useRef<HTMLButtonElement>(null);
	const itemDeleteTriggerRef = useRef<HTMLButtonElement>(null);
	const floorPropertiesTriggerRef = useRef<HTMLButtonElement>(null);
	const [itemDeleteConfirmation, setItemDeleteConfirmation] = useState(false);
	const [floorItemTab, setFloorItemTab] = useState<FloorItemTab>("sizes");
	const [itemWallDrafts, setItemWallDrafts] = useState<Partial<Record<ItemWallDistance["side"], string>>>({});
	const [focusedWallDistance, setFocusedWallDistance] = useState<ItemWallDistance["side"]>();
	const updateItemWallDraft = (side: ItemWallDistance["side"], value: string | undefined) => {
		setItemWallDrafts((current) => {
			if (value !== undefined) return { ...current, [side]: value };
			const { [side]: _removed, ...remaining } = current;
			return remaining;
		});
	};
	const editorActionMenuRef = useRef<HTMLDialogElement>(null);
	const editorActionDockRef = useRef<HTMLDivElement>(null);
	const selectionPropertiesTriggerRef = useRef<HTMLButtonElement>(null);
	const editorTopBarRef = useRef<HTMLElement>(null);
	const historyDiscardTriggerRef = useRef<HTMLButtonElement>(null);
	const renameProjectTriggerRef = useRef<HTMLButtonElement>(null);
	const directoryRenameTriggerRef = useRef<HTMLElement>(null);
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
	const addDockTriggerRef = useRef<HTMLButtonElement>(null);
	const doorChoiceRef = useRef<HTMLButtonElement>(null);
	const windowChoiceRef = useRef<HTMLButtonElement>(null);
	const openingWallListRef = useRef<HTMLButtonElement>(null);
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
		if (localGreyboxCatalog || !catalogGateway || preloadedGlbCatalogAssets.length === 0) {
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
	}, [catalogGateway, localGreyboxCatalog, preloadedGlbCatalogAssets]);
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
						copy("Не удалось прочитать свою библиотеку. Откройте каталог снова.", "Your library could not be read. Open the catalog again."),
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
	const productMetricsReady = legacyCreationAllowed && (
		(state.kind === "projects" && !state.recoveryNeeded) ||
		state.kind === "first-run" ||
		(state.kind === "saved" && !isEditorReadOnly && controller.writerAccess().kind === "writable")
	);
	useEffect(() => {
		if (!productMetricsReady || !onProductMetricsReady) return;
		const announceReady = () => {
			if (hostLifecycle?.snapshot().active === false) return;
			try { onProductMetricsReady(); } catch { /* The editor remains available. */ }
		};
		announceReady();
		return hostLifecycle?.subscribe(announceReady);
	}, [hostLifecycle, onProductMetricsReady, productMetricsReady]);
	useEffect(() => {
		if (state.kind === "persist-failed") {
			reportProductMetric(state.reasonCode === "PERSISTENCE_QUOTA_EXCEEDED" ? "save_quota" : "save_failed");
		} else if (state.kind === "projects" && state.storageSources?.some((source) => source.kind === "unavailable")) {
			reportProductMetric("storage_unavailable");
		}
	}, [reportProductMetric, state]);
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
	const selectedWallRun = hostNavigation && project?.schemaVersion === 1 && selectedWall
		? uninterruptedWallRun(project, selectedWall.wallSegmentId)
		: undefined;
	const wallRunSegmentIds = selectedWallRun && selectedWallRun.wallSegmentIds.length > 1
		? selectedWallRun.wallSegmentIds
		: undefined;
	const windowSillPolicy = hostNavigation ? "preset" : "draft";
	const openingCreationDraftValidation =
		project?.schemaVersion === 1 && openingCreationDraft
			? validateOpeningCreationDraft(project, openingCreationDraft, windowSillPolicy)
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
	const openingHostChoices = useMemo(() =>
		project?.schemaVersion === 1 && openingEntry && openingEntry !== "add"
			? openingCreationHostsFor(project, openingEntry)
			: [], [openingEntry, project]);
	const openingHostIds = useMemo(() => new Set(openingHostChoices.map(host => host.wallSegmentId)), [openingHostChoices]);
	const compactOpeningCreation = openingCreationDraft?.baseRevisionId !== undefined && !showOpeningCreationDetails;
	const selectedOpening = project?.level.openings.find(
		(opening) => opening.openingId === selectedOpeningId,
	);
	const windowAlignmentAvailable = !!(
		hostNavigation &&
		project?.schemaVersion === 1 &&
		openingDraft?.kind === "Window" &&
		windowsWithMixedSillsOnSameWall(project.level.openings, openingDraft.openingId).length
	);
	const windowAlignmentDirty =
		selectedOpening?.kind !== "Window" ||
		openingDraft?.openingId !== selectedOpening.openingId ||
		openingDraft.widthMm !== String(selectedOpening.widthMm) ||
		openingDraft.heightMm !== String(selectedOpening.heightMm);
	const openingDraftPreviewOffset = openingDraft && canEditOpeningOffset(openingDraft, hostNavigation !== undefined)
		? nonNegativeSafeInteger(openingDraft.offsetMm)
		: undefined;
	const doorDraftWallId = openingCreationDraft?.kind === "Door"
		? openingCreationDraft.wallSegmentId
		: openingDraft?.kind === "Door" ? selectedOpening?.wallSegmentId : undefined;
	const doorInsideSide = useMemo(() => {
		if (!doorHingeAuthoring || project?.schemaVersion !== 1 || !doorDraftWallId) return undefined;
		const wall = project.level.wallSegments.find(candidate => candidate.wallSegmentId === doorDraftWallId);
		if (!wall) return undefined;
		const start = project.level.vertices.find(vertex => vertex.vertexId === wall.startVertexId);
		const end = project.level.vertices.find(vertex => vertex.vertexId === wall.endVertexId);
		const plan = resolveOrthogonalPlanFaces(project);
		const exterior = plan.kind === "accepted"
			? plan.plan.walls.find(candidate => candidate.wallSegmentId === doorDraftWallId)?.exteriorNormal
			: undefined;
		if (!start || !end || !exterior) return undefined;
		return (end.xMm - start.xMm) * exterior.z - (end.zMm - start.zMm) * exterior.x > 0
			? "right" as const : "left" as const;
	}, [doorDraftWallId, doorHingeAuthoring, project]);
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
				? copy("Укажите название, целые положительные размеры и целые миллиметры от нуля для положения настенного предмета.", "Enter a name, positive whole dimensions and a nonnegative position in millimetres for the wall-mounted item.")
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
						(item.wallSegmentId === selectedWall.wallSegmentId ||
							wallRunSegmentIds?.includes(item.wallSegmentId) === true),
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
					wallRunSegmentIds && selectedWallRun
						? [
							...project.level.wallSegments.filter(wall => !wallRunSegmentIds.includes(wall.wallSegmentId)),
							{ ...selectedWall, startVertexId: selectedWallRun.startVertexId, endVertexId: selectedWallRun.endVertexId },
						]
						: project.level.wallSegments,
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
					(opening) => opening.wallSegmentId === selectedWall.wallSegmentId ||
						wallRunSegmentIds?.includes(opening.wallSegmentId) === true,
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
			localGreyboxCatalog || catalogCategory === "custom"
				? []
				: filterPreloadedGlbCatalogAssets(preloadedGlbCatalogAssets, {
						query: catalogQuery,
						section: catalogCategory,
					}),
		[catalogCategory, catalogQuery, localGreyboxCatalog, preloadedGlbCatalogAssets],
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
	const selectedPreloadedCatalogAsset = localGreyboxCatalog
		? undefined
		: preloadedGlbCatalogAssets.find((asset) => asset.id === selectedPreloadedCatalogAssetId);
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
		const furnitureKind = localGreyboxCatalog && !customGlbPlacementDraft && !reusedItemDefinitionId
			? telegramGreyboxKindForLabel(label)
			: undefined;
		return widthMm && depthMm && heightMm && label.length > 0
			? {
					color: source.color,
					...("colorVariantId" in source && typeof source.colorVariantId === "string" ? { colorVariantId: source.colorVariantId } : {}),
					...(furnitureKind === undefined ? {} : { furnitureKind }),
					yawRadians: itemPlacementYawRadians,
					...floorYawFieldsForRadians(itemPlacementYawRadians, exactFloorYaw),
					depthMm,
					heightMm,
					label,
					widthMm,
				}
			: undefined;
	}, [customGlbPlacementDraft, exactFloorYaw, itemFields, itemPlacementYawRadians, localGreyboxCatalog, reusedItemDefinitionId]);
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
		() => project ? projectRectangularRoomForWebGl(project, localGreyboxCatalog ? telegramGreyboxKindForLabel : undefined, hostNavigation !== undefined) : undefined,
		[project, localGreyboxCatalog, hostNavigation],
	);
	const reversedPlanItemFrontIds = useMemo(() => {
		if (!hostNavigation || !threeDimensionalScene) return undefined;
		const ids = new Set<string>();
		for (const item of threeDimensionalScene.items) {
			if (item.assetAnchor !== "floor" || item.assetInstanceId === undefined ||
				item.assetDefinitionId !== undefined) continue;
			// These built-in meshes have a backrest or headboard on local +Z.
			const kind = item.material?.furnitureKind;
			if (kind === "chair" || kind === "sofa" || kind === "bed") {
				ids.add(item.assetInstanceId);
			}
		}
		return ids;
	}, [hostNavigation, threeDimensionalScene]);
	const threeDimensionalOrigin = useMemo(() => {
		if (!project || project.level.vertices.length === 0) return undefined;
		return {
			xMm: Math.min(...project.level.vertices.map((vertex) => vertex.xMm)),
			zMm: Math.min(...project.level.vertices.map((vertex) => vertex.zMm)),
		};
	}, [project]);
	const floorItemWallSnap = useMemo(
		() => hostNavigation && project?.schemaVersion === 1 ? createFloorItemWallSnap(project) : undefined,
		[hostNavigation, project],
	);
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
	useLayoutEffect(() => {
		if (!isItemPlacementActive) retainedPlacementPoint.current = undefined;
	}, [isItemPlacementActive]);
	const isEditorDockVisible =
		!isItemPlacementSurfaceActive && openingCreationDraft === undefined && (!openingEntry || openingEntry === "add");
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
	const hasRawRenameDraft = isRenameProjectOpen && renameProjectName !== (directoryRenameTarget?.name ?? project?.name);
	const hasRawSelectedItemDraft = !!selectedItem && !!selectedItemFields && (
		selectedItemFields.widthMm !== String(selectedItem.widthMm) || selectedItemFields.depthMm !== String(selectedItem.depthMm) || selectedItemFields.heightMm !== String(selectedItem.heightMm) || selectedItemFields.label !== selectedItem.label || (!onRotationStepModeChange && selectedItemAngleRaw !== degreesForYawRadians(yawRadiansForEditorFloorAsset(selectedItem))) || selectedItemFields.color !== selectedItem.color
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
	const hasRawEditorDraft = Object.keys(itemWallDrafts).length > 0 || hasRawRenameDraft || hasRawSelectedItemDraft || hasRawRoomPropertyDraft || hasRawProjectNameDraft || hasRawDimensionDraft || hasRawPlaceholderDraft || hasRawWallPositionDraft || hasRawCustomImportDraft || itemColorVariantDraft !== undefined;
	const isEditorPreview = state.kind === "saved" && (
		isItemPlacementActive ||
		(fullTransientNavigationProtection && (hasRawEditorDraft || hasUndurableEditorDraft))
	);
	const editorSaveState =
		state.kind === "saving"
			? copy("Сохраняем…", "Saving…")
			: hasRetainedHistoryTarget || (state.kind === "saved" && dimensionNotice?.kind === "item-collision")
				? copy("Правка не сохранена", "Edit unsaved")
			: isEditorPreview
				? copy("Предпросмотр — не сохранено", "Preview · unsaved")
				: state.kind === "saved"
					? copy("Сохранено", "Saved")
					: statusCopy(state);

	useEffect(() => {
		if (!hostNavigation) return;
		try {
			hostNavigation.setClosingConfirmation?.(hasUndurableEditorDraft || hasRawEditorDraft || writerRecoveryCopy !== undefined || isTakingOverWriterLease || !!leaveFocus || state.kind === "saving" || state.kind === "persist-failed" || directoryRenameWrite !== "idle" || projectTransferImport.kind !== "idle");
			hostNavigation.setVerticalSwipesEnabled?.(!project);
		} catch { /* Unsupported host capabilities never change Project state. */ }
	}, [hostNavigation, hasUndurableEditorDraft, hasRawEditorDraft, writerRecoveryCopy, isTakingOverWriterLease, leaveFocus, project, state.kind, directoryRenameWrite, projectTransferImport.kind]);
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
		sessionHistoryCommandLabels?.undoActionLabel ?? copy("Отменить действие", "Undo");
	const redoActionLabel =
		sessionHistoryCommandLabels?.redoActionLabel ?? copy("Повторить действие", "Redo");
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

	const previousInspectorItem = useRef<EditorFloorAsset | undefined>(undefined);
	useEffect(() => {
		const previous = previousInspectorItem.current;
		previousInspectorItem.current = selectedItem;
		if (previous?.assetInstanceId !== selectedItem?.assetInstanceId) {
			setFloorDimensionErrors({});
		}
		if (!selectedItem) {
			setSelectedItemFields(undefined);
			setSelectedItemAngleRaw("0");
			return;
		}
		const sameItem = hostNavigation && previous?.assetInstanceId === selectedItem.assetInstanceId;
		setSelectedItemFields((raw) => ({
			color: selectedItem.color,
			depthMm: sameItem && raw && previous.depthMm === selectedItem.depthMm ? raw.depthMm : String(selectedItem.depthMm),
			heightMm: sameItem && raw && previous.heightMm === selectedItem.heightMm ? raw.heightMm : String(selectedItem.heightMm),
			label: selectedItem.label,
			widthMm: sameItem && raw && previous.widthMm === selectedItem.widthMm ? raw.widthMm : String(selectedItem.widthMm),
		}));
		setSelectedItemAngleRaw(
			degreesForYawRadians(yawRadiansForEditorFloorAsset(selectedItem)),
		);
	}, [hostNavigation, selectedItem]);

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
		if (!isBuiltInCatalogOpen) return;
		if (localGreyboxCatalog) {
			catalogDialogRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
		} else if (window.matchMedia("(min-width: 600px)").matches) {
			catalogSearchInputRef.current?.focus();
		}
	}, [isBuiltInCatalogOpen, localGreyboxCatalog]);

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

	const readProjectTransferFile = async (
		file: File | undefined,
		destination: ProjectTransferDestination = "import",
		password?: string,
	) => {
		const repairing = destination === "repair";
		if (!file || projectTransferAbortRef.current || projectTransferImport.kind !== "idle" ||
			(repairing && isRepairingCustomGlb)) return;
		const setError = repairing ? setCustomGlbRepairError : setProjectTransferError;
		const reportImportRejection = (reasonCode: ProjectTransferImportRejection) => {
			if (repairing) return;
			const metric = projectTransferImportMetric(reasonCode);
			if (metric) reportProductMetric(metric);
		};
		const sizeError = repairing ? copy("Резервная копия превышает допустимый размер.", "This backup exceeds the size limit.") : projectTransferImportFeedback("BACKUP_LIMIT_EXCEEDED");
		const readError = repairing ? copy("Не удалось прочитать резервную копию.", "The backup could not be read.") : copy("Не удалось прочитать файл. Существующие проекты не изменены.", "The file could not be read. Existing projects are intact.");
		setError(undefined);
		if (password !== undefined) setEncryptedProjectTransfer({ file, destination });
		const abortController = new AbortController();
		projectTransferAbortRef.current = abortController;
		setProjectTransferImport({ filename: file.name, kind: "reading" });
		if (repairing) setIsRepairingCustomGlb(true);
		try {
			if (file.size > 200 * 1024 * 1024) {
				setError(sizeError);
				reportImportRejection("BACKUP_LIMIT_EXCEEDED");
				return;
			}
			const prefix = hostNavigation && new Uint8Array(await file.slice(0, 8).arrayBuffer());
			if (abortController.signal.aborted) return;
			const encrypted = !!prefix && isEncryptedProjectTransfer(prefix);
			if (encrypted && file.size > MAX_ENCRYPTED_PROJECT_TRANSFER_BYTES) {
				setError(sizeError);
				reportImportRejection("BACKUP_LIMIT_EXCEEDED");
				return;
			}
			if (encrypted && password === undefined) {
				setEncryptedProjectTransfer({ file, destination });
				return;
			}
			const read = fileTransfer ? await fileTransfer.read(file, abortController.signal) : undefined;
			if (read && read.kind !== "read") {
				setError(read.kind === "cancelled" ? projectTransferImportFeedback("BACKUP_CANCELLED") : readError);
				if (!abortController.signal.aborted) {
					if (read.kind === "rejected") reportImportRejection(read.reasonCode);
					if (read.kind === "failed" && !repairing) reportProductMetric("backup_import_failed");
				}
				return;
			}
			let bytes = read?.kind === "read" ? read.bytes : new Uint8Array(await file.arrayBuffer());
			if (abortController.signal.aborted) {
				setError(
					projectTransferImportFeedback("PORTABLE_BACKUP_CANCELLED"),
				);
				return;
			}
			if (encrypted && password !== undefined) {
				const unlocked = await decryptProjectTransfer(bytes, password, abortController.signal);
				if (abortController.signal.aborted) return;
				if (unlocked.kind !== "decrypted") {
					setEncryptedProjectTransfer({ file, destination, error:
						unlocked.reasonCode === "TRANSFER_AUTHENTICATION_FAILED"
							? copy("Пароль неверен или файл повреждён.", "The password is incorrect or the file is damaged.")
							: unlocked.reasonCode === "INVALID_TRANSFER_PASSWORD"
								? copy("Введите пароль, заданный при экспорте.", "Enter the password you set during export.")
								: copy("Не удалось открыть зашифрованный файл.", "The encrypted file could not be opened."),
					});
					reportImportRejection(unlocked.reasonCode);
					return;
				}
				bytes = unlocked.bytes;
				setEncryptedProjectTransfer(undefined);
			}
			if (repairing) {
				const result = await controller.repairResourcesFromPortableBackup(bytes);
				if (result.kind === "rejected")
					setError(copy("Эта копия не содержит всех нужных точных моделей или не прошла проверку.", "This backup is missing exact models or could not be verified."));
				else if (result.kind === "persist-failed")
					setError(copy("Не удалось сохранить восстановленные модели. Повторите попытку.", "The recovered models could not be saved. Try again."));
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
			const result = destination === "registered-import"
				? await controller.importRegisteredPortableBackup(bytes, { onStatus: importOptions.onPortableStatus, signal: abortController.signal })
				: await controller.importProjectTransfer(bytes, importOptions);
			if (result.kind === "rejected") {
				setProjectTransferError(
					projectTransferImportFeedback(result.reasonCode),
				);
				if (!abortController.signal.aborted) reportImportRejection(result.reasonCode);
				return;
			}
			if (result.kind !== "durable") {
				setProjectTransferError(
					result.kind === "verification-unavailable"
						? projectTransferImportFeedback(result.kind)
						: copy("Не удалось импортировать проект. Существующие проекты не изменены.", "The project could not be imported. Existing projects are intact."),
				);
				if (!abortController.signal.aborted && (result.kind === "persist-failed" || result.kind === "verification-unavailable"))
					reportProductMetric("backup_import_failed");
			}
		} catch {
			if (abortController.signal.aborted) return;
			setError(readError);
			if (!repairing) reportProductMetric("backup_import_failed");
		} finally {
			if (projectTransferAbortRef.current === abortController) {
				projectTransferAbortRef.current = undefined;
			}
			setProjectTransferImport({ kind: "idle" });
			if (repairing) setIsRepairingCustomGlb(false);
			if (projectTransferInputRef.current) {
				projectTransferInputRef.current.value = "";
			}
			if (registeredTransferInputRef.current) registeredTransferInputRef.current.value = "";
		}
	};
	const repairFromPortableBackup = (file: File | undefined) => void readProjectTransferFile(file, "repair");
	const repairPasswordPrompt = encryptedProjectTransfer?.destination === "repair";
	const localFilePanel = <>
		{localFileSession ? <LocalFileTransferPanel session={localFileSession} state={localFileState} telegram={hostNavigation !== undefined} /> : null}
		{encryptedProjectTransfer ? <EncryptedImportPasswordDialog
			filename={encryptedProjectTransfer.file.name}
			busy={projectTransferImport.kind !== "idle"}
			error={encryptedProjectTransfer.error ?? (repairPasswordPrompt ? customGlbRepairError : projectTransferError)}
			submitLabel={repairPasswordPrompt ? copy("Восстановить", "Recover") : undefined}
			onCancel={() => {
				setEncryptedProjectTransfer(undefined);
				if (repairPasswordPrompt) setCustomGlbRepairError(undefined);
				else setProjectTransferError(undefined);
			}}
			onUnlock={(password) => void readProjectTransferFile(encryptedProjectTransfer.file, encryptedProjectTransfer.destination, password)}
		/> : null}
	</>;

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
					copy("Не удалось подготовить несохранённую правку. Повторите попытку.", "The unsaved edit could not be prepared. Try again."),
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
			setProjectTransferError(copy("Не удалось скачать несохранённую правку.", "The unsaved edit could not be downloaded."));
		}
	};
	const restoreRecoveryDraftFile = async (file: File | undefined) => {
		if (!file) return;
		setProjectTransferError(undefined);
		if (file.size > 280 * 1024 * 1024) {
			setProjectTransferError(copy("Файл восстановления слишком велик.", "The recovery file is too large."));
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
						? copy("В файле не хватает точных моделей. Сохраните исходный файл и восстановите модели из оригиналов.", "The file does not contain all exact models. Keep the source file and recover models from their originals.")
						: copy("Не удалось восстановить правку. Исходные проекты остались без изменений.", "The edit could not be recovered. Existing projects are intact."),
				);
		} catch {
			setProjectTransferError(copy("Не удалось прочитать файл восстановления.", "The recovery file could not be read."));
		} finally {
			if (projectTransferAbortRef.current === abortController)
				projectTransferAbortRef.current = undefined;
			setProjectTransferImport({ kind: "idle" });
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
				setCustomGlbRepairError(copy("Выбранный набор GLB превышает допустимые ограничения. Проект не изменён.", "The selected GLB files exceed the limits. The project is intact."));
				return;
			}
			const result = await controller.repairCustomGlbResources(bounded?.bytes ?? await Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer()))));
			if (result.kind === "rejected") {
				setCustomGlbRepairError(
					copy("Нужен точный набор исходных GLB для восстановления: по одному файлу для каждой недоступной модели.", "Choose the exact original GLB files, one for each unavailable model."),
				);
				return;
			}
			if (result.kind === "repaired") {
				setCustomGlbRepairError(
					copy("Набор записан, но проверка проекта всё ещё требует точные исходные GLB. Повторите выбор полного набора.", "The files were saved. Verification still needs the exact original GLBs. Select the complete set again."),
				);
				return;
			}
			if (result.kind !== "recovered") {
				setCustomGlbRepairError(
					copy("Не удалось записать проверенный GLB. Проект не изменён — повторите попытку.", "The verified GLB could not be saved. The project is intact. Try again."),
				);
			}
		} catch {
			setCustomGlbRepairError(
				copy("Не удалось прочитать файлы. Проект не изменён — выберите исходные GLB для восстановления повторно.", "The files could not be read. The project is intact. Select the original GLB files again."),
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
					? copy("Состав недоступных моделей изменился. Проверьте обновлённый список и подтвердите действие снова.", "The unavailable models have changed. Review the updated list and confirm again.")
					: result.kind === "writer-lease-lost"
						? copy("Другое окно получило право записи. Перехватите редактирование или вернитесь к исходным GLB.", "Another window now has write access. Take over editing or return to the original GLBs.")
						: result.kind === "reopen-failed"
							? copy("Новая версия сохранена, но повторная проверка не завершилась. Проект остаётся в режиме восстановления.", "The new version is saved. Verification is incomplete and the project remains in recovery mode.")
							: copy("Не удалось удалить недоступные модели. Проект и исходная версия не изменены.", "The unavailable models could not be removed. The project and its original version are intact."),
			);
		} catch {
			setRecoveryRemovalError(
				copy("Не удалось удалить недоступные модели. Проект и исходная версия не изменены.", "The unavailable models could not be removed. The project and its original version are intact."),
			);
		} finally {
			setIsRemovingUnresolvedCustomGlb(false);
		}
	};

	// iOS Files can classify a valid .interiors archive as an unknown type. Validate its bytes after selection.
	const registeredTransferFileInput = registeredTransferImport ? <input type="file" accept={hostNavigation ? undefined : "application/zip,.interiors"} aria-label={copy("Импорт файла для переноса", "Import a transfer file")} hidden ref={registeredTransferInputRef} disabled={projectTransferImport.kind !== "idle"} onChange={(event) => void readProjectTransferFile(event.currentTarget.files?.[0], "registered-import")} /> : null;

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
			}, "portable-backup");
			return;
		}
		try {
			const result = await prepare();
			if (result.kind !== "ready") {
				setProjectTransferError(
					result.kind === "rejected" &&
						result.reasonCode === "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE"
						? copy("Точные байты одной из моделей недоступны, поэтому файл проекта не создан. Сначала восстановите исходную модель.", "One model's exact file is unavailable. Recover the original model before exporting the project.")
						: copy("Не удалось подготовить файл проекта. Проект не изменён. Повторите попытку.", "The project file could not be prepared. The project is intact. Try again."),
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
				copy("Не удалось подготовить файл проекта. Повторите попытку.", "The project file could not be prepared. Try again."),
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
		setDirectoryRenameTarget(undefined);
		setDirectoryRenameWrite("idle");
	};

	const renameProjectFromDirectory = (summary: ProjectSummary, trigger: HTMLButtonElement) => {
		if (hostNavigation) {
			const menu = trigger.closest("details");
			directoryRenameTriggerRef.current = menu?.querySelector("summary") ?? trigger;
			if (menu) menu.open = false;
			directoryRenameTriggerRef.current?.focus({ preventScroll: true });
			setDirectoryRenameTarget(summary);
			setRenameProjectName(summary.name);
			setRenameProjectError(undefined);
			setIsRenameProjectOpen(true);
			return;
		}
		const { projectId, storageNamespace } = summary;
		setRenameTargetProjectId(projectId);
		if (storageNamespace === undefined) void controller.openProject(projectId);
		else void controller.openProject(projectId, { storageNamespace, initialAction: "rename" });
	};

	const saveDirectoryRename = async (retry = false) => {
		if (!directoryRenameTarget || directoryRenameInFlight.current) return;
		directoryRenameInFlight.current = true;
		setDirectoryRenameWrite("saving");
		setRenameProjectError(undefined);
		try {
			const result = retry
				? await controller.retryDirectoryProjectRename()
				: await controller.renameProjectFromDirectory(
					directoryRenameTarget.projectId,
					directoryRenameTarget.revisionId,
					renameProjectName,
				);
			setDirectoryRenameWrite(result.kind === "persist-failed" && result.retryAvailable ? "retained" : "idle");
			switch (result.kind) {
				case "durable":
					cancelRenameProject();
					break;
				case "rejected":
					setRenameProjectError(projectNameErrorCopy(result.reasonCode));
					break;
				case "stale-base":
					setRenameProjectError(copy("Проект изменился в другом окне. Закройте форму и откройте её снова.", "The project changed in another window. Close this form and open it again."));
					break;
				case "read-only":
				case "writer-lease-lost":
					setRenameProjectError(copy("Проект открыт для редактирования в другом окне.", "This project is being edited in another window."));
					break;
				case "resources-unavailable":
					setRenameProjectError(copy("Некоторые модели недоступны. Откройте проект и восстановите модели, затем повторите переименование.", "Some models are unavailable. Open the project and recover them before renaming it."));
					break;
				case "persist-failed":
					setRenameProjectError(result.retryAvailable
						? result.reasonCode === "PERSISTENCE_QUOTA_EXCEEDED"
							? copy("В хранилище недостаточно места. Освободите место на устройстве и нажмите «Повторить сохранение».", "Storage is full. Free up space on this device and select Retry save.")
							: copy("Сохранение имени не подтверждено. Нажмите «Повторить сохранение», чтобы проверить ту же правку.", "The name could not be confirmed. Select Retry save to check the same edit.")
						: renamePersistenceFailureCopy(result.reasonCode));
					reportProductMetric(result.reasonCode === "PERSISTENCE_QUOTA_EXCEEDED" ? "save_quota" : "save_failed");
					break;
				default:
					setRenameProjectError(copy("Не удалось открыть сохранённую версию проекта. Повторите попытку.", "The saved version could not be opened. Try again."));
			}
		} catch {
			setDirectoryRenameWrite(retry ? "retained" : "idle");
			setRenameProjectError(renamePersistenceFailureCopy("PERSISTENCE_WRITE_FAILED"));
		} finally {
			directoryRenameInFlight.current = false;
		}
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
				copy("Проект изменился в другом окне. Вернитесь к проектам и откройте актуальную версию.", "The project changed in another window. Return to Projects and open the current version."),
			);
			return;
		}
		if (result.kind === "persist-failed") {
			setRenameProjectError(renamePersistenceFailureCopy(result.reasonCode));
			return;
		}
		setRenameProjectError(copy("Проект ещё открывается. Повторите попытку.", "The project is still opening. Try again shortly."));
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
			showEditRejection(result.reasonCode);
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
			setRoomPropertyConfirmation(copy("Помещение сохранено локально.", "Room saved locally."));
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
				? copy("Дождитесь завершения текущего сохранения и повторите попытку.", "Wait for the current save to finish and try again.")
				: copy("Проект ещё открывается. Повторите попытку.", "The project is still opening. Try again shortly."),
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
			setRoomPropertyConfirmation(copy("Помещение и проёмы сохранены локально.", "Room and openings saved locally."));
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
					? copy("Дождитесь завершения текущего сохранения и повторите попытку.", "Wait for the current save to finish and try again.")
					: copy("Проект ещё открывается. Повторите попытку.", "The project is still opening. Try again shortly."),
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
			reportEditRejection(result.reasonCode);
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
				showEditRejection(result.reasonCode);
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
	const showItemCollisionRejection = (edit?: FloorItemEdit) => {
		setItemPlacementConfirmation(undefined);
		setDimensionError(edit
			? errorCopy("ITEM_COLLISION", edit)
			: itemPlacementPreviewFeedback({ isValid: false, reasonCode: "ITEM_COLLISION" }), "item-collision");
		reportProductMetric("item_collision");
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
		const result = await controller.rotateParametricFloorItem({ ...input, exact: exactFloorYaw });
		if (result.kind === "rejected") {
			if (hostNavigation && result.reasonCode === "ITEM_COLLISION") {
				showItemCollisionRejection("rotation");
				if (selectedItem?.assetInstanceId === input.assetInstanceId) {
					setSelectedItemAngleRaw(degreesForYawRadians(yawRadiansForEditorFloorAsset(selectedItem)));
				}
			} else showEditRejection(result.reasonCode);
			return false;
		}
		if (result.kind === "durable" && "warnings" in result && result.warnings) {
			setDimensionError(
				copy(`Предупреждение: ${itemPlacementWarningSummary(result.warnings)}.`, `Warning: ${itemPlacementWarningSummary(result.warnings)}.`),
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
		const exact = exactFloorYaw || "yawMilliDeg" in selectedItem;
		const yawRadians = exact ? preciseYawRadiansFromDegrees(selectedItemAngleRaw) : yawRadiansFromDegrees(selectedItemAngleRaw);
		if (yawRadians === undefined) {
			setDimensionError(exact ? copy("Укажите угол в градусах с точностью до трёх знаков после запятой.", "Enter an angle in degrees with up to three decimal places.") : copy("Укажите конечный угол поворота в градусах.", "Enter a final rotation angle in degrees."));
			return;
		}
		const canonicalAngle = yawRadiansFor(floorYawFieldsForRadians(yawRadians, exact));
		setDimensionError(undefined);
		if (exact && canonicalAngle === yawRadiansForEditorFloorAsset(selectedItem)) {
			setSelectedItemAngleRaw(degreesForYawRadians(canonicalAngle));
			return;
		}
		const accepted = await rotateItem({
			assetInstanceId: selectedItem.assetInstanceId,
			yawRadians,
		});
		if (accepted) {
			setSelectedItemAngleRaw(
				degreesForYawRadians(
					canonicalAngle,
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
			setDimensionError(copy("Выберите стену, на которой можно создать проём.", "Select a wall that can host an opening."));
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

	const closeOpeningEntry = () => {
		setOpeningEntry(undefined);
		setShowOpeningWallList(false);
		setDimensionError(undefined);
		requestAnimationFrame(() => addDockTriggerRef.current?.focus());
	};

	const goBackFromOpeningEntry = () => {
		if (!openingEntry || openingEntry === "add") {
			closeOpeningEntry();
			return;
		}
		setDimensionError(undefined);
		setShowOpeningWallList(false);
		setOpeningEntry("add");
		const choice = openingEntry === "Door" ? doorChoiceRef : windowChoiceRef;
		requestAnimationFrame(() => choice.current?.focus());
	};

	const placeNewOpening = (kind: OpeningCreationKind, wallSegmentId: string, offsetMm?: number) => {
		const latest = controller.snapshot();
		if (latest.kind !== "saved" || latest.project.schemaVersion !== 1 || latest.project !== project || isEditorReadOnly || isMutationBlocked) return;
		const initial = openingCreationDraftFor(latest.project, wallSegmentId, kind);
		if (!initial) return;
		const validation = offsetMm === undefined ? validateOpeningCreationDraft(latest.project, initial, windowSillPolicy) : undefined;
		const draft = openingCreationDraftFor(latest.project, wallSegmentId, kind, {
			baseRevisionId: latest.revisionId,
			offsetMm: offsetMm ?? (validation?.kind === "valid" ? validation.input.offsetMm : Number(initial.offsetMm)),
		});
		if (!draft) return;
		setOpeningEntry(undefined);
		setShowOpeningWallList(false);
		setShowOpeningCreationDetails(false);
		setDimensionError(undefined);
		setOpeningCreationDraft(draft);
	};

	const chooseOpeningType = (kind: OpeningCreationKind) => {
		const closeOrSelect = () => {
			setActiveTool("select");
			setSelectedItemId(undefined);
			setSelectedOpeningId(undefined);
			setWallDeletionConflict(undefined);
			openingCreationRestoreFocusRef.current = addDockTriggerRef.current ?? undefined;
			if (project?.schemaVersion === 1 && selectedWallOpeningHost && openingCreationHostsFor(project, kind).some(host => host.wallSegmentId === selectedWallOpeningHost.wallSegmentId)) {
				placeNewOpening(kind, selectedWallOpeningHost.wallSegmentId);
				return;
			}
			setSelectedWallId(undefined);
			setOpeningEntry(kind);
			requestAnimationFrame(() => openingWallListRef.current?.focus());
		};
		if (hasRawEditorDraft || hasUndurableEditorDraft) requestEditorBack(false, closeOrSelect);
		else closeOrSelect();
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
		if (localGreyboxCatalog) return;
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
	}, [catalogGateway, localGreyboxCatalog]);

	const openBuiltInCatalog = (trigger: HTMLElement | null) => {
		if (isEditorReadOnly) {
			return;
		}
		restoreFocusRef.current = trigger ?? undefined;
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
		setIsModelLibrarySelected(false);
		if (localGreyboxCatalog) setCatalogQuery("");
		else void loadCatalogPublication();
	};

	const beginLocalGreyboxPlacement = (preset: TelegramGreyboxPreset): boolean => {
		if (preset.anchorClass !== "floor" || project?.schemaVersion !== 1 || isEditorReadOnly || isMutationBlocked) return false;
		setWallItemDraft(undefined);
		setWallItemDraftFields(undefined);
		setCatalogWallModelDraft(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
		setItemFields({
			color: preset.color,
			depthMm: String(preset.depthMm),
			heightMm: String(preset.heightMm),
			label: preset.label,
			widthMm: String(preset.widthMm),
		});
		setItemPlacementYawRadians(0);
		setActiveTool("item");
		setDimensionError(undefined);
		setCustomGlbPlacementDraft(undefined);
		setReusedItemDefinitionId(undefined);
		closeOverlay();
		return true;
	};

	const beginPlaceholderPlacement = () => {
		const widthMm = positiveInteger(placeholderFields.widthMm);
		const depthMm = positiveInteger(placeholderFields.depthMm);
		const heightMm = positiveInteger(placeholderFields.heightMm);
		const label = placeholderFields.label.trim();
		if (!widthMm || !depthMm || !heightMm || label.length === 0) {
			setPlaceholderComposerError(
				copy("Укажите название и целые положительные ширину, глубину и высоту.", "Enter a name and positive whole width, depth and height."),
			);
			return;
		}
		if (
			!alphaParametricItemColors.includes(
				placeholderFields.color as (typeof alphaParametricItemColors)[number],
			)
		) {
			setPlaceholderComposerError(copy("Выберите один из доступных цветов макета.", "Choose an available color."));
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

	const openOwnModelLibrary = () => {
		setIsModelLibrarySelected(true);
		setCatalogCategory("custom");
	};

	const returnToLocalGreyboxCatalog = () => {
		discardCustomGlbImport();
		setSelectedCustomCatalogAssetId(undefined);
		setIsModelLibrarySelected(false);
	};

	const startPreloadedCatalogPlacement = (
		asset: PreloadedGlbCatalogAsset,
		resource: CustomGlbResource,
	) => {
		if (localGreyboxCatalog) return;
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
				setDimensionError(copy("Нет стены, на которой помещается этот предмет.", "There is no wall that can fit this item."));
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
				copy("Модель недоступна локально. Импортируйте исходный GLB заново.", "The model is unavailable locally. Import the original GLB again."),
			);
			return;
		}
		if (!selectedCustomCatalogAsset?.resource) {
			setDimensionError(
				copy("Байты модели ещё загружаются из локального хранилища. Подождите и повторите.", "The model is still loading from local storage. Wait and try again."),
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
		if (localGreyboxCatalog) setSelectedCustomCatalogAssetId(undefined);
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
				setCustomLibraryError(copy("Не удалось убрать карточку. Повторите попытку.", "The card could not be removed. Try again."));
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
			setCustomLibraryError(copy("Не удалось убрать карточку. Повторите попытку.", "The card could not be removed. Try again."));
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
				copy("Укажите название и целые положительные габариты модели.", "Enter a name and positive whole dimensions for the model."),
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
					if (localGreyboxCatalog) discardCustomGlbImport();
					closeOverlay();
					return;
				}
				setDimensionError(
					result.kind === "rejected"
						? errorCopy(result.reasonCode)
						: localGreyboxCatalog
							? copy("Не удалось добавить свою модель. Повторите импорт.", "The custom model could not be added. Try the import again.")
							: copy("Не удалось добавить модель в «Кастомное». Повторите импорт.", "The model could not be added to Custom. Try the import again."),
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
			filename: selectedFiles[0]?.name ?? copy("выбранный файл", "selected file"),
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
		setIsModelLibrarySelected(false);
		const restoreTarget = restoreFocusRef.current;
		restoreFocusRef.current = undefined;
		queueMicrotask(() => {
			const target = restoreTarget?.isConnected && restoreTarget.getClientRects().length
				? restoreTarget
				: editorHeaderMenuRef.current;
			target?.focus({ preventScroll: true });
		});
	};

	const trapOverlayFocus = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			if (isNavigationProtected) requestEditorBack(false, closeOverlay); else closeOverlay();
			return;
		}
		if (!localGreyboxCatalog || event.key !== "Tab") return;
		const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
			"button, input, select, textarea, summary, a[href], [tabindex]",
		)).filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
		const first = controls[0], last = controls.at(-1);
		if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
			event.preventDefault();
			last?.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first?.focus();
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
				copy("Укажите название и целые положительные размеры предмета.", "Enter a name and positive whole dimensions for the item."),
			);
			return;
		}
		const roomId = findRoomForFloorItem(project, {
			depthMm: draft.depthMm,
			yawStep: draft.yawStep,
						yawMilliDeg: draft.yawMilliDeg,
			widthMm: draft.widthMm,
			xMm: point.xMm,
			zMm: point.zMm,
		});
		if (!roomId) {
			setDimensionError(
				copy("Предмет должен целиком находиться внутри ячейки сетки.", "The item must fit entirely inside the grid cell."),
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
						yawMilliDeg: draft.yawMilliDeg,
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
						yawMilliDeg: draft.yawMilliDeg,
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
					colorVariantId: draft.colorVariantId,
					depthMm: draft.depthMm,
					yawStep: draft.yawStep,
						yawMilliDeg: draft.yawMilliDeg,
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
			if (hostNavigation && result.kind === "rejected" && result.reasonCode === "ITEM_COLLISION") {
				showItemCollisionRejection();
			} else {
				setDimensionError(feedback);
				if (result.kind === "rejected") reportEditRejection(result.reasonCode);
			}
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
				? copy(`${feedback} Предупреждение сохранено: ${warningSummary}.`, `${feedback} Saved with a warning: ${warningSummary}.`)
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
			if (hostNavigation && result.reasonCode === "ITEM_COLLISION") showItemCollisionRejection("move");
			else showEditRejection(result.reasonCode);
			return false;
		}
		if (result.kind === "durable" && "warnings" in result && result.warnings) {
			setDimensionError(
				copy(`Предупреждение: ${itemPlacementWarningSummary(result.warnings)}.`, `Warning: ${itemPlacementWarningSummary(result.warnings)}.`),
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
		setFloorItemTab("sizes");
		setItemWallDrafts({});
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
		setFloorItemTab("sizes");
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
				copy(`Предмет «${selectedItem.label}» перемещён на 100 мм.`, `Moved “${selectedItem.label}” by 100 mm.`),
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
		reportEditRejection(result.reasonCode);
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
			localGreyboxCatalog ||
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
				copy("На этой стене нет места для безопасной копии предмета.", "There is no space to place a copy of the item on this wall."),
			);
			return;
		}
		setDimensionError(undefined);
		setWallItemDraft(draft);
		setWallItemDraftFields(wallItemDraftFieldsFor(draft));
	};

	const confirmWallItemPlacement = async () => {
		if (localGreyboxCatalog || !wallItemDraft || isEditorReadOnly || isMutationBlocked) return;
		const draft = wallItemDraftFromFields(wallItemDraft, wallItemDraftFields);
		if (!draft) {
			setDimensionError(
				copy("Укажите название, целые положительные размеры и целые миллиметры от нуля для положения настенного предмета.", "Enter a name, positive whole dimensions and a nonnegative position in millimetres for the wall-mounted item."),
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
			showEditRejection(result.reasonCode);
			return;
		}
		if (result.kind === "durable") {
			if (
				"warnings" in result &&
				Array.isArray(result.warnings) &&
				result.warnings.length
			) {
				setDimensionError(
					copy("Предупреждение сохранено: настенные предметы пересекаются. Измените смещение или сторону, если это не запланированное наложение.", "Saved with a warning. Wall-mounted items overlap. Change their offset or side to resolve the overlap."),
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
			showEditRejection(result.reasonCode);
	};

	const setWallItemLock = async (assetInstanceId: string, locked: boolean) => {
		if (isEditorReadOnly || isMutationBlocked) return;
		setDimensionError(undefined);
		const result = await controller.setParametricWallItemLock({
			assetInstanceId,
			locked,
		});
		if (result.kind === "rejected")
			showEditRejection(result.reasonCode);
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
				copy("Укажите целые миллиметры от нуля для смещения и высоты предмета.", "Enter nonnegative whole millimetres for the offset and height."),
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
			showEditRejection(result.reasonCode);
			return;
		}
		if (result.kind === "durable" && result.warnings?.length) {
			setDimensionError(
				copy("Предупреждение сохранено: настенные предметы пересекаются. Измените смещение или сторону, если это не запланированное наложение.", "Saved with a warning. Wall-mounted items overlap. Change their offset or side to resolve the overlap."),
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
			showEditRejection(result.reasonCode);
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
				copy("Модель выбранного предмета больше не прикреплена к проекту. Восстановите её перед созданием копии.", "The selected model is no longer attached to the project. Recover it before duplicating the item."),
			);
			return;
		}
		setDimensionError(undefined);
		setItemPlacementConfirmation(undefined);
		setCustomGlbPlacementDraft(undefined);
		setReusedItemDefinitionId(assetDefinitionId);
		setItemFields({
			color: selectedItem.color,
			...(hostNavigation && "colorVariantId" in selectedItem && selectedItem.colorVariantId
				? { colorVariantId: selectedItem.colorVariantId }
				: {}),
			depthMm: String(selectedItem.depthMm),
			heightMm: String(selectedItem.heightMm),
			label: selectedItem.label,
			widthMm: String(selectedItem.widthMm),
		});
		setSelectedItemId(undefined);
		setSelectedWallId(undefined);
		setSelectedOpeningId(undefined);
		if (!hostNavigation) setViewMode("plan");
		retainedPlacementPoint.current = undefined;
		setIsSelectionInspectorExpanded(false);
		setItemPlacementYawRadians(hostNavigation ? yawRadiansForEditorFloorAsset(selectedItem) : 0);
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
						wallRunSegmentIds,
					})
				: undefined;
		if (conflictPreview?.kind === "conflict") {
			setWallDeletionConflict({
				...conflictPreview,
				wallRunSegmentIds,
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
			wallRunSegmentIds,
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
				copy("Выберите помещение, чьи параметры останутся после объединения.", "Choose which room's settings to keep when merging."),
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
					wallRunSegmentIds: wallDeletionConflict.wallRunSegmentIds,
				})
			: await controller.deleteGeneralWall({
					previewRevisionId: wallDeletionConflict.previewRevisionId,
					wallSegmentId: wallDeletionConflict.wallSegmentId,
					wallRunSegmentIds: wallDeletionConflict.wallRunSegmentIds,
				});
		if (result.kind === "rejected") {
			showEditRejection(result.reasonCode);
			return;
		}
		if (result.kind === "stale-base") {
			showEditRejection(result.reasonCode);
			setWallDeletionConflict(undefined);
			return;
		}
		if (result.kind === "writer-lease-lost") {
			showEditRejection(result.reasonCode);
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
			showEditRejection(result.reasonCode);
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
			showEditRejection(result.reasonCode);
			return "rejected";
		}
		if (result.kind === "stale-base") {
			showEditRejection(result.reasonCode);
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
			showEditRejection(result.reasonCode);
			return;
		}
		if (result.kind === "stale-base") {
			showEditRejection(result.reasonCode);
			setVertexDeletionCandidate(undefined);
			return;
		}
		if (result.kind === "writer-lease-lost") {
			showEditRejection(result.reasonCode);
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
		setShowOpeningCreationDetails(false);
		setActiveTool("select");
		const restoreTarget = openingCreationRestoreFocusRef.current;
		const fromAddChooser = openingCreationDraft?.baseRevisionId !== undefined;
		openingCreationRestoreFocusRef.current = undefined;
		requestAnimationFrame(() => {
			if (restoreTarget?.isConnected) {
				restoreTarget.focus();
				return;
			}
			const currentTrigger = fromAddChooser ? addDockTriggerRef.current : openingCreationActionRef.current;
			(currentTrigger ?? addDockTriggerRef.current)?.focus();
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
		readonly swingSide?: "left" | "right";
		readonly hingeEnd?: "end";
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
			showEditRejection(result.reasonCode);
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
			setDimensionError(copy("Укажите положительные целые ширину и высоту.", "Enter a positive whole width and height."));
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
			showEditRejection(result.reasonCode);
			return;
		}
		if (accepted) {
			setSelectedWallId(input.wallSegmentId);
			closeOpeningCreationDraft();
		}
	};

	const moveOpeningCreationDraft = (offsetMm: number) => {
		if (project?.schemaVersion !== 1 || !openingCreationDraft) return;
		const latest = controller.snapshot();
		if (latest.kind !== "saved" || latest.revisionId !== openingCreationDraft.baseRevisionId) return;
		const candidate = { ...openingCreationDraft, offsetMm: String(offsetMm) };
		const validation = validateOpeningCreationDraft(project, candidate, windowSillPolicy);
		setDimensionError(validation.kind === "invalid" ? validation.message : undefined);
		if (validation.kind === "valid") setOpeningCreationDraft(candidate);
	};

	const confirmOpeningCreationDraft = async () => {
		if (project?.schemaVersion !== 1 || !openingCreationDraft) return;
		const latest = controller.snapshot();
		if (openingCreationDraft.baseRevisionId !== undefined && (latest.kind !== "saved" || latest.revisionId !== openingCreationDraft.baseRevisionId)) {
			setDimensionError(copy("План изменился. Выберите место проёма заново.", "The plan changed. Choose a new position for the opening."));
			return;
		}
		const validation = validateOpeningCreationDraft(
			project,
			openingCreationDraft,
			windowSillPolicy,
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
			showEditRejection(result.reasonCode);
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
		if (hostNavigation) {
			setDimensionError(undefined);
			const result = await controller.moveDoorOpening(input);
			if (result.kind === "rejected") showEditRejection(result.reasonCode);
			return result.kind === "durable";
		}
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
			...(opening.kind === "Door" && opening.swingSide ? { swingSide: opening.swingSide } : {}),
			...(opening.kind === "Door" && opening.hingeEnd ? { hingeEnd: opening.hingeEnd } : {}),
			heightMm: String(opening.heightMm),
			kind: opening.kind,
			offsetMm: String(input.offsetMm),
			openingId: opening.openingId,
			widthMm: String(opening.widthMm),
		});
		return true;
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
			...(opening.kind === "Door" && opening.swingSide ? { swingSide: opening.swingSide } : {}),
			...(opening.kind === "Door" && opening.hingeEnd ? { hingeEnd: opening.hingeEnd } : {}),
			heightMm: String(opening.heightMm),
			kind: opening.kind,
			offsetMm: String(opening.offsetMm),
			openingId: opening.openingId,
			widthMm: String(opening.widthMm),
		});
	};

	const confirmOpeningDraft = async (action: "edit" | "align" = "edit") => {
		if (!openingDraft || isEditorReadOnly || isMutationBlocked) return;
		const latest = controller.snapshot();
		if (
			latest.kind !== "saved" ||
			latest.revisionId !== openingDraft.baseRevisionId
		) {
			setOpeningDraft(undefined);
			setDimensionError(copy("План изменился. Выберите проём заново.", "The plan changed. Select the opening again."));
			return;
		}
		const currentOpening = latest.project.level.openings.find(
			(opening) => opening.openingId === openingDraft.openingId,
		);
		const input = openingEditInputFor(openingDraft, currentOpening, hostNavigation !== undefined);
		if (!input) {
			setDimensionError(copy("Укажите положительные целые ширину и высоту.", "Enter a positive whole width and height."));
			return;
		}
		if (action === "align" && (!windowAlignmentAvailable || windowAlignmentDirty)) return;
		setDimensionError(undefined);
		const result = await controller.updateDoorOpening(action === "align"
			? { kind: "align-matching-windows", openingId: input.openingId }
			: input);
		if (result.kind === "rejected") {
			showEditRejection(result.reasonCode);
			return;
		}
		const settled = controller.snapshot();
		if (
			result.kind === "durable" ||
			(result.kind === "persist-failed" && settled.kind === "persist-failed" && "candidate" in settled)
		) {
			// The confirmed candidate now belongs to save/recovery.
			setOpeningDraft(undefined);
		}
	};

	const cancelOpeningDraft = () => {
		setDimensionError(undefined);
		setOpeningDraft(undefined);
	};

	const setFloorDimensionError = (field: keyof DimensionFields, message: string | undefined) => {
		setFloorDimensionErrors((current) => ({ ...current, [field]: message }));
	};
	const commitSelectedItem = async (edit?: { field: keyof DimensionFields; raw: string }) => {
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
		const report = (error: string | undefined) => {
			if (edit) setFloorDimensionError(edit.field, error);
			else setDimensionError(error);
		};
		const editedValue = edit ? positiveInteger(edit.raw.trim()) : undefined;
		const widthMm = edit ? (edit.field === "widthMm" ? editedValue : selectedItem.widthMm)
			: positiveInteger(selectedItemFields.widthMm);
		const depthMm = edit ? (edit.field === "depthMm" ? editedValue : selectedItem.depthMm)
			: positiveInteger(selectedItemFields.depthMm);
		const heightMm = edit ? (edit.field === "heightMm" ? editedValue : selectedItem.heightMm)
			: positiveInteger(selectedItemFields.heightMm);
		report(undefined);
		if (!widthMm || !depthMm || !heightMm) {
			report(edit ? copy("Укажите целый положительный размер в мм.", "Enter a positive whole number of millimetres.") : copy("Укажите целые положительные размеры предмета.", "Enter positive whole dimensions for the item."));
			return;
		}
		if (widthMm === selectedItem.widthMm && depthMm === selectedItem.depthMm &&
			heightMm === selectedItem.heightMm) {
			if (edit && edit.raw !== String(editedValue)) {
				setSelectedItemFields((current) => current ? { ...current, [edit.field]: String(editedValue) } : current);
			}
			return;
		}
		if (edit && dimensionNotice?.kind === "item-collision") setDimensionError(undefined);
		const result = await controller.resizeParametricFloorItem({
			assetInstanceId: selectedItem.assetInstanceId,
			depthMm,
			heightMm,
			widthMm,
		});
		if (result.kind === "rejected") {
			if (hostNavigation && result.reasonCode === "ITEM_COLLISION") {
				if (edit) report(errorCopy(result.reasonCode, "size"));
				showItemCollisionRejection("size");
				return;
			}
			report(errorCopy(result.reasonCode));
			reportEditRejection(result.reasonCode);
			return;
		}
		if (edit && (result.kind === "in-progress" || result.kind === "not-ready")) {
			report(copy("Дождитесь сохранения предыдущей правки и повторите ввод.", "Wait for the previous edit to save before entering the value again."));
		}
		if (result.kind === "durable" && "warnings" in result && result.warnings) {
			setDimensionError(
				copy(`Предупреждение: ${itemPlacementWarningSummary(result.warnings)}.`, `Warning: ${itemPlacementWarningSummary(result.warnings)}.`),
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
			setDimensionError(copy("Предмет больше недоступен. Выберите его заново.", "The item is unavailable. Select it again."));
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
			showEditRejection(result.reasonCode);
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
			showEditRejection(result.reasonCode);
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
		setItemWallDrafts({});
		setFloorDimensionErrors({});
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
				copy("Не удалось перехватить редактирование. Проект остался только для просмотра — попробуйте ещё раз.", "Takeover failed. The project is still read-only. Try again."),
			);
		} catch {
			setWriterTakeoverError(
				copy("Не удалось перехватить редактирование. Проект остался только для просмотра — попробуйте ещё раз.", "Takeover failed. The project is still read-only. Try again."),
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
					copy("Не удалось сохранить новый пустой план. Исходный чертёж не изменён.", "The new blank plan could not be saved. The original plan is intact."),
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
            if (!(await navigationProtection.discardWriterRecoveryAndShowProjects(confirmedCopy))) setHostBackNotice(copy("Несохранённая копия изменилась. Повторите выход после проверки данных.", "The unsaved copy changed. Check it before leaving."));
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
					? copy("Проект открыт для редактирования в другом окне. Удаление не выполнено.", "This project is open for editing in another window and could not be deleted.")
					: copy("Не удалось удалить проект. Исходные данные не изменены.", "The project could not be deleted. The original data are intact."),
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
						? copy("Проект открыт для редактирования в другом окне. Удаление не выполнено.", "This project is open for editing in another window and could not be deleted.")
						: copy("Не удалось удалить проект. Исходные данные не изменены.", "The project could not be deleted. The original data are intact."),
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
	const hasTelegramEditorSheet = hostNavigation !== undefined;
	const canOpenTelegramEditorSheet = hasTelegramEditorSheet && !isExternalSaveFailure;
	const selectionBehindSheet = isEditorActionMenuOpen || isOpeningDialogOpen
		|| isDimensionFilterOpen || isPlanInspectorOpen || isRoomDirectoryOpen || isBuiltInCatalogOpen;
	const closeFloorItemProperties = () => {
		setIsSelectionInspectorExpanded(false);
		requestAnimationFrame(() => floorPropertiesTriggerRef.current?.focus({ preventScroll: true }));
	};
	const closeWallProperties = () => {
		setIsSelectionInspectorExpanded(false);
		setWallItemDraft(undefined);
		setWallItemDraftFields(undefined);
		requestAnimationFrame(() => selectionPropertiesTriggerRef.current?.focus({ preventScroll: true }));
	};
	const requestEditorBack = (explicitProjects = false, onCleanPanelClose?: () => void) => {
		if (!isNavigationProtected) { void returnToProjects(); return; }
		if (leaveFocus) { continueEditorDraft(); return; }
		suspendForBack();
		const nativePanel = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].at(-1);
		if (!explicitProjects && nativePanel?.hasAttribute("data-scene-color-palette")) {
			nativePanel.close();
			resumeTransientViews();
			return;
		}
		const footerToggle = state.kind === "projects"
			? projectsHeadingRef.current?.closest("section")?.querySelector<HTMLButtonElement>('[data-projects-footer-toggle][aria-expanded="true"]')
			: undefined;
		const panel = !explicitProjects && (!!onCleanPanelClose || !!footerToggle || (fullTransientNavigationProtection && (!!nativePanel || isRenameProjectOpen || isEditorActionMenuOpen || (hasTelegramEditorSheet && isOpeningDialogOpen) || isPlanInspectorOpen || isRoomDirectoryOpen || isBuiltInCatalogOpen || (viewMode === "plan" && isSelectionInspectorExpanded) || localFileState.kind !== "idle")));
		const recoveryExit = !panel ? controller.writerRecoveryCopy?.() : undefined;
		const decision = editorBackDecision({
			pending: hasPendingEditorCommand(),
			persistFailed: controller.snapshot().kind === "persist-failed" || hasRetainedHistoryTarget || directoryRenameWrite === "retained",
			draft: recoveryExit !== undefined || (fullTransientNavigationProtection && (hasRawEditorDraft || hasUndurableEditorDraft || [...transientBoundaries.current].some((boundary) => boundary.inspect().hasDraft))),
			panel,
			project: !!project || state.kind === "first-run" || state.kind === "recovery-needed",
		});
		if (decision === "confirm-discard") { confirmedWriterExit.current = recoveryExit; leaveFocusActive.current = true; setLeaveFocus(captureEditorFocus()); return; }
		resumeTransientViews();
		if (decision === "saving") { setHostBackNotice(copy("Дождитесь завершения текущего действия. Сохраняемая правка не отменена.", "Wait for the current action to finish saving.")); return; }
		if (decision === "persist-failed") {
			if (directoryRenameWrite !== "retained") setHostBackNotice(copy("Правка не сохранена. Повторите сохранение или экспортируйте данные для восстановления.", "The edit is unsaved. Retry saving or export it for recovery."));
			return;
		}
		setHostBackNotice(undefined);
		if (decision === "close-panel") {
			if (onCleanPanelClose) onCleanPanelClose();
			else if (nativePanel && nativePanel === editorActionMenuRef.current) setIsEditorActionMenuOpen(false);
			else if (hasTelegramEditorSheet && nativePanel?.dataset.telegramSheet === "dimensions") setIsDimensionFilterOpen(false);
			else if (nativePanel) nativePanel.dispatchEvent(new Event("cancel", { cancelable: true }));
			else if (isRenameProjectOpen) cancelRenameProject();
			else if (localFileState.kind !== "idle") localFileSession?.close();
			else if (isEditorActionMenuOpen) setIsEditorActionMenuOpen(false);
			else if (openingEntry) goBackFromOpeningEntry();
			else if (hasTelegramEditorSheet && isOpeningDialogOpen && openingCreationDraft) closeOpeningCreationDraft();
			else if (hasTelegramEditorSheet && isOpeningDialogOpen && openingDraft) cancelOpeningDraft();
			else if (isRoomDirectoryOpen) closeRoomDirectory();
			else if (isBuiltInCatalogOpen) closeOverlay();
			else if (isPlanInspectorOpen) closePlanInspector();
			else if (isSelectionInspectorExpanded) {
				if (hasTelegramEditorSheet && selectedItem) closeFloorItemProperties();
				else setIsSelectionInspectorExpanded(false);
			}
			else if (footerToggle) {
				footerToggle.click();
				footerToggle.focus();
			} else closeOverlay();
		} else if (decision === "projects") { void returnToProjects(); }
		else { try { hostNavigation?.close(); } catch { setHostBackNotice(copy("Не удалось закрыть приложение. Попробуйте ещё раз.", "The app could not close. Try again.")); } }
	};
	const closeEditorActionMenu = () => {
		const close = () => setIsEditorActionMenuOpen(false);
		if (hasTelegramEditorSheet) requestEditorBack(false, close);
		else close();
	};
	const closeDimensionFilter = () => {
		const close = () => setIsDimensionFilterOpen(false);
		if (hasTelegramEditorSheet) requestEditorBack(false, close);
		else close();
	};
	hostBackHandler.current = () => {
		if (hostNavigation && !isWorking) {
			if (wallDeletionConflict) return cancelWallDeletionConflict();
			if (wallAddHostConflict) return cancelWallAddHostConflict();
			if (vertexDeletionCandidate && !isDeletingVertex) {
				setDimensionError(undefined);
				setVertexDeletionCandidate(undefined);
				return;
			}
		}
		requestEditorBack();
	};
	const hostBackGuard = leaveFocus ? <EditorLeaveGuard telegram={hasTelegramEditorSheet} focus={leaveFocus} fallback={editorHeaderMenuRef.current} onContinue={continueEditorDraft} onDiscard={() => {
		if (hasPendingEditorCommand() || controller.snapshot().kind === "persist-failed") return;
		const exitCopy = confirmedWriterExit.current;
		if (exitCopy && controller.writerRecoveryCopy?.() !== exitCopy) {
			continueEditorDraft(); setHostBackNotice(copy("Несохранённая правка изменилась. Повторите выход, чтобы проверить её снова.", "The unsaved edit changed. Review it before leaving.")); return;
		}
		for (const boundary of transientBoundaries.current) if (boundary.inspect().hasDraft) boundary.cancelDraft();
		if (isRenameProjectOpen) cancelRenameProject();
		if (hasRawProjectNameDraft) { setName(""); setNameError(undefined); }
		if (hasRawDimensionDraft) { setDimensions(baselineDimensions); setDimensionError(undefined); }
		if (hasRawSelectedItemDraft || Object.keys(itemWallDrafts).length > 0) cancelSelectedItemNumericDraft();
		if (hasRawRoomPropertyDraft || roomHeightOpeningConflict) cancelRoomHeightOpeningConflict();
		if (hasRawPlaceholderDraft) { setPlaceholderFields(itemFields); setPlaceholderComposerError(undefined); }
		if (hasRawWallPositionDraft) for (const item of project?.assetInstances ?? []) if (item.anchorClass === "wall") cancelWallItemPositionDraft(item);
		if (hasRawCustomImportDraft) { cancelFbxConversion(); ++customGlbImportRequestRef.current; setCustomGlbImport({ kind: "idle" }); }
		setItemColorVariantDraft(undefined);
		if (openingCreationDraft) closeOpeningCreationDraft();
		if (openingEntry) closeOpeningEntry();
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
			<main data-editor-host={hostNavigation ? "telegram" : undefined} className={projectsSupplement && !state.recoveryNeeded ? `${styles.startShell} ${styles.projectsWithFooter}` : styles.startShell}>
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
							{hostNavigation && <img src="/interiors-lamp-v1.png" alt="" width={40} height={40} className={styles.projectHubLogo} />}
							{copy("Проекты", "Projects")}
						</h1>
						<p>{copy("Планы на этом устройстве", "Plans on this device")}</p>
						{onOpenSettings && <button className={styles.documentsSettings} type="button" onClick={(event) => onOpenSettings(event.currentTarget)}>{copy("Настройки", "Settings")}</button>}
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
							{copy("Новый проект", "New project")}
						</button>
						<input
							accept={hostNavigation ? undefined : "application/json,.json,application/zip,.interiors"}
							aria-label={copy("Импортировать проект", "Import project")}
							className={styles.visuallyHidden}
							disabled={projectTransferImport.kind !== "idle"}
							id="import-project-transfer"
							onChange={(event) =>
								void readProjectTransferFile(event.currentTarget.files?.[0])
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
							{copy("Импортировать проект", "Import project")}
						</button>
						{registeredTransferImport ? <>
							<button className={styles.secondaryAction} type="button" disabled={projectTransferImport.kind !== "idle"} onClick={() => registeredTransferInputRef.current?.click()}>{copy("Импорт файла для переноса", "Import a transfer file")}</button>
						</> : null}
					</div>
					{!hostNavigation ? <><input
						hidden
						ref={recoveryDraftInputRef}
						type="file"
						accept=".json,application/json"
						aria-label={copy("Выбрать файл несохранённой правки", "Choose an unsaved edit file")}
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
						{copy("Восстановить несохранённую правку", "Recover unsaved edit")}
					</button></> : null}
					{projectTransferImport.kind !== "idle" ? (
						<div
							className={styles.projectTransferStatus}
							data-testid="project-transfer-import-status"
							role="status"
						>
							<span>{projectTransferProgressCopy(projectTransferImport)}</span>
							<progress
								aria-label={copy("Прогресс импорта проекта", "Project import progress")}
								max={4}
								value={projectTransferProgress(projectTransferImport)}
							/>
							{projectTransferImport.kind !== "saving" &&
							projectTransferImport.kind !== "cancelling" ? (
								<button onClick={cancelProjectTransferImport} type="button">
									{copy("Отменить импорт", "Cancel import")}
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
                                ? copy("Один из локальных проектов требует восстановления. Остальные доступны.", "One local project needs recovery. Your other projects are available.")
                                : copy("Локальные записи требуют проверки и восстановления.", "Local records need to be checked and recovered.")}
						</p>
					) : null}
                    {state.recoveryNeeded && state.projects.length === 0 ? (
                        <section className={safetyStyles.card} data-testid="project-recovery-screen" aria-labelledby="directory-recovery-heading">
                            <h2 id="directory-recovery-heading">{copy("Проект требует восстановления", "Project needs recovery")}</h2>
                            <p role="status">{copy("Нужно восстановление", "Recovery needed")}</p>
                            <p>{copy("Не удалось проверить сохранённую версию. Исходные записи не изменены. Доступные исходники можно подготовить отдельно.", "The saved version could not be verified. The original records are intact. Available source files can be prepared separately.")}</p>
                            <button className={safetyStyles.primary} type="button" onClick={() => void controller.showProjects()}>{copy("Повторить проверку", "Retry verification")}</button>
                        </section>
                    ) : null}
					{!legacyCreationAllowed ? <p role="status">{copy("Создание и редактирование проектов Web/PWA сейчас недоступны.", "Creating and editing web projects is unavailable right now.")}</p> : null}
                    {state.storageSources ? <ProjectStorageStatus sources={state.storageSources.filter(source=>!readonlyStorageSources?.includes(source.storageNamespace))} onRetry={() => void controller.showProjects()} /> : null}
					{state.projects.length === 0 ? (projectDirectoryEmptyLabel(state.storageSources, state.recoveryNeeded === true) ? (
						<section
							aria-label={copy("Пустой список проектов", "Empty project list")}
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
							ref={projectDirectoryRef}
						>
							{projectDirectoryCards(state.projects, state.storageSources !== undefined).map(({ summary, key, storageLabel, copyLabel, spokenName, ownerConfirmed }) => (
								<li
									className={styles.projectDirectoryCard}
									key={key}
									data-project-storage={summary.storageNamespace}
								>
									<button
										aria-label={copy(`Открыть ${spokenName}`, `Open ${spokenName}`)}
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
										aria-label={copy(`Удалить проект ${spokenName}`, `Delete project ${spokenName}`)}
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
									<details className={styles.projectDirectoryActions} onToggle={(event) => {
										if (!event.currentTarget.open) return;
										for (const menu of projectDirectoryRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]") ?? []) {
											if (menu !== event.currentTarget) menu.open = false;
										}
									}}>
										<summary aria-label={copy(`Действия для ${spokenName}`, `Actions for ${spokenName}`)}>
											<span aria-hidden="true">•••</span>
										</summary>
										<div>
											<button
												aria-label={copy(`Переименовать ${spokenName}`, `Rename ${spokenName}`)}
												disabled={!ownerConfirmed || isLegacyOwnerReadOnly(summary.storageNamespace)}
												onClick={(event) =>
													renameProjectFromDirectory(summary, event.currentTarget)
												}
												type="button"
											>
												{copy("Переименовать", "Rename")}
											</button>
											<button
												aria-label={copy(`Экспортировать проект ${spokenName}`, `Export project ${spokenName}`)}
												disabled={!ownerConfirmed}
												onClick={() =>
													void exportProjectTransfer(summary.projectId, false, summary.storageNamespace)
												}
												type="button"
											>
												{copy("Экспортировать проект", "Export project")}
											</button>
											{registeredTransferExport ? <button type="button" aria-label={copy(`Экспорт файла для переноса: ${spokenName}`, `Export transfer file for ${spokenName}`)} disabled={!ownerConfirmed} onClick={() => void exportProjectTransfer(summary.projectId, true, summary.storageNamespace)}>{copy("Экспорт файла для переноса", "Export transfer file")}</button> : null}
										</div>
									</details>
								</li>
							))}
						</ul>
					)}
					{!state.recoveryNeeded ? projectsSupplement : null}
				</section>
				{isRenameProjectOpen && directoryRenameTarget ? (
					<RenameProjectDialog
						telegram
						name={renameProjectName}
						error={renameProjectError}
						busy={directoryRenameWrite === "saving"}
						blocked={directoryRenameWrite !== "idle"}
						canRetry={directoryRenameWrite === "retained"}
						cancelDisabled={directoryRenameWrite === "retained"}
						onChange={setRenameProjectName}
						onSubmit={(event) => {
							event.preventDefault();
							if (directoryRenameWrite === "idle") void saveDirectoryRename();
						}}
						onRetry={() => void saveDirectoryRename(true)}
						onCancel={cancelRenameProject}
						onBackdropClose={() => requestEditorBack(false, cancelRenameProject)}
						returnFocusRef={directoryRenameTriggerRef}
					/>
				) : null}
				{directoryDeletionTarget ? (
					<ProjectConfirmationDialog
						plainLabels={hostNavigation !== undefined}
						label={copy("Удалить проект", "Delete project")}
						title={copy("Удалить проект навсегда?", "Delete this project permanently?")}
						cancelLabel={copy("Оставить проект", "Keep project")}
						confirmLabel={copy("Удалить навсегда", "Delete permanently")}
						busyLabel={copy("Удаляем…", "Deleting…")}
						busy={isDeletingProject}
						error={projectDeletionError}
						onCancel={() => setDirectoryDeletionTarget(undefined)}
						onConfirm={() => void permanentlyDeleteDirectoryProject()}
						returnFocusRef={directoryDeletionTriggerRef}
						fallbackFocusRef={projectsHeadingRef}
					>
						<p>{projectDeletionTargetText(directoryDeletionTarget.name)}</p>
						<p>
							{copy("Проект и его локальные версии будут удалены без возможности восстановления. Это действие нельзя отменить.", "The project and its local versions will be permanently deleted.")}
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
 {hostNavigation ? null : diagnosticDetails}
			</main>
		);
	}

	if (!project) {
		return (
			<main
				data-editor-host={hostNavigation ? "telegram" : undefined}
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
							aria-label={copy("Вернуться к проектам", "Back to projects")}
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
							{copy("‹ Назад", "‹ Back")}
						</button>
					) : null}
					<h1 id="create-heading">
						{state.kind === "recovery-needed"
							? copy("Проект требует восстановления", "Project needs recovery")
							: copy("Новый проект", "New project")}
					</h1>
					{state.kind !== "recovery-needed" ? (
						<form
							className={styles.createForm}
							noValidate
							onSubmit={submitProject}
						>
							<label htmlFor="project-name">{copy("Название проекта", "Project name")}</label>
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
								{state.kind === "saving" ? copy("Сохранение…", "Saving…") : copy("Создать проект", "Create project")}
							</button>
						</form>
					) : null}
					{state.kind !== "first-run" ? (
						<span className={styles.startStatus} role="status">
							{isWriterLeaseReadOnly ? copy("Только просмотр", "View only") : statusCopy(state)}
						</span>
					) : null}
					{state.kind === "recovery-needed" ? (
						<p data-testid="resource-recovery-diagnostic">
							{recoveryRemovalSummary
								? copy("Некоторые модели отсутствуют или повреждены. Редактирование остановлено. Восстановите точные исходные файлы или выберите удаление недоступных моделей.", "Some models are missing or damaged. Editing is paused. Recover the exact original files or remove the unavailable models.")
								: copy("Не удалось проверить сохранённую версию. Локальные данные оставлены на устройстве. Повторите проверку или вернитесь к списку проектов.", "The saved version could not be verified. Local data are still on this device. Retry verification or return to Projects.")}
						</p>
					) : null}
					{state.kind === "persist-failed" ? (
						<section
							className={safetyStyles.card}
							data-testid="project-creation-failure"
						>
							<div className={safetyStyles.message} role="alert">
								<h2>{copy("Не удалось создать проект", "Could not create project")}</h2>
								<p>
									{state.reasonCode === "PERSISTENCE_QUOTA_EXCEEDED"
										? copy("В локальном хранилище недостаточно места. Освободите место и повторите сохранение.", "Local storage is full. Free up space and retry saving.")
										: copy("Проект ещё не сохранён на устройстве. Повторите сохранение.", "The project has not been saved to this device yet. Retry saving.")}
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
									telegram={hasTelegramEditorSheet}
									busy={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
									error={customGlbRepairError}
									onGlbFiles={(files) =>
										void repairCustomGlbResourceFiles(files)
									}
									onBackupFile={repairFromPortableBackup}
								/>
							) : null}
							{recoveryRemovalSummary ? (
								<div>
									<p>
										{copy("Размещённых предметов:", "Placed items:")}{" "}
										{recoveryRemovalSummary.affectedAssetInstanceCount}{copy(". Недоступных описаний моделей:", ". Unavailable model definitions:")}{" "}
										{recoveryRemovalSummary.affectedAssetDefinitionCount}.
									</p>
									<p>{copy("Это действие нельзя отменить через историю.", "This action cannot be undone.")}</p>
									{isRecoveryRemovalConfirmationOpen ? (
										<div aria-live="assertive" role="alert">
											<p>
												{copy("Будет создана новая версия без всех недоступных моделей.", "A new version will be saved with all unavailable models removed.")}
											</p>
											<button data-editor-action="confirm"
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
													? copy("Удаляем недоступные модели…", "Removing unavailable models…")
													: hostNavigation ? copy("Подтвердить", "Confirm") : copy("Подтвердить удаление всех недоступных моделей", "Confirm removal of all unavailable models")}
											</button>
											<button data-editor-action="cancel"
												className={styles.textAction}
												disabled={
													isRepairingCustomGlb || isRemovingUnresolvedCustomGlb
												}
												onClick={() =>
													setIsRecoveryRemovalConfirmationOpen(false)
												}
												type="button"
											>
												{hostNavigation ? copy("Отменить", "Cancel") : copy("Отмена", "Cancel")}
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
											{copy("Удалить все недоступные модели", "Remove all unavailable models")}
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
						plainLabels={hostNavigation !== undefined}
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
								{copy("Повторить проверку", "Retry verification")}
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
 {hostNavigation && state.kind !== "recovery-needed" ? null : diagnosticDetails}
			</main>
		);
	}

	const itemPlacementColor = localGreyboxCatalog && viewMode === "three-dimensional" && isItemPlacementActive &&
		!customGlbPlacementDraft && reusedItemDefinitionId === undefined ? (
			<TelegramItemColor
				color={itemFields.color}
				context="placement"
				sceneTriggerRef={viewMode === "three-dimensional" ? sceneColorTriggerRef : undefined}
				disabled={isEditorReadOnly || isMutationBlocked}
				onSelect={({ color, variantId }) => setItemFields((current) => ({ ...current, color, colorVariantId: variantId }))}
			/>
		) : undefined;
	const sceneAsset = project.schemaVersion === 1 && viewMode === "three-dimensional"
		? project.assetInstances.find((item) => item.assetInstanceId === selectedItemId)
		: undefined;
	const selectedItemColor = localGreyboxCatalog && sceneAsset && sceneAsset.assetDefinitionId === undefined ? (
		<TelegramItemColor
			key={sceneAsset.assetInstanceId}
			color={sceneAsset.color}
			context="selected-item"
			sceneTriggerRef={sceneColorTriggerRef}
			disabled={isEditorReadOnly || isMutationBlocked || sceneAsset.locked === true}
			onSelect={({ variantId }) => {
				setDimensionError(undefined);
				setItemColorVariantDraft({
					anchorClass: sceneAsset.anchorClass,
					assetInstanceId: sceneAsset.assetInstanceId,
					variantId,
				});
			}}
		/>
	) : undefined;
	const floorItemDimensionFields =
		selectedItem && selectedItemFields ? (
			<div className={styles.itemDimensions}>
				{([
					["widthMm", copy("Ширина", "Width")],
					["depthMm", copy("Глубина", "Depth")],
					["heightMm", copy("Высота", "Height")],
				] as const).map(([field, label]) => {
					const error = hostNavigation ? floorDimensionErrors[field] : undefined;
					const errorId = error ? `floor-dimension-error-${field}` : undefined;
					return (
						<Fragment key={field}>
							<label>
								<span>{label}</span>
								<input
									aria-label={copy(`${label} выбранного предмета, мм`, `Selected item ${label.toLowerCase()}, mm`)}
									aria-describedby={errorId ?? (!hostNavigation && field === "widthMm" && dimensionError ? "dimension-error" : undefined)}
									aria-invalid={error || (!hostNavigation && field === "widthMm" && dimensionError) ? true : undefined}
									autoComplete="off"
									disabled={
										isEditorReadOnly ||
										selectedItemLocked ||
										(!hostNavigation && selectedItemHasFixedDimensions) ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									readOnly={(hostNavigation && selectedItemHasFixedDimensions) || undefined}
									inputMode="numeric"
									data-editor-blur-commit=""
									onBlur={(event) => {
										if (consumeSkippedNumericBlurCommit(event.currentTarget)) return;
										void commitSelectedItem(hostNavigation ? { field, raw: event.currentTarget.value } : undefined);
									}}
									onChange={(event) => {
										const raw = event.currentTarget.value;
										if (error) setFloorDimensionError(field, undefined);
										setSelectedItemFields((current) => current ? { ...current, [field]: raw } : current);
									}}
									onKeyDown={(event) => {
										if (!cancelNumericDraftOnEscape(event, cancelSelectedItemNumericDraft)) {
											commitOnEnter(event);
										}
									}}
									value={selectedItemFields[field]}
								/>
							</label>
							{error ? (
								<p className={styles.fieldError} id={errorId} role="alert">
									{label}. {error}
								</p>
							) : null}
						</Fragment>
					);
				})}
				{!onRotationStepModeChange ? (
					<div>
						<label data-angle-unit>
							<span>{copy("Поворот", "Rotation")}</span>
							<input
								aria-label={copy("Угол поворота выбранного предмета, градусы", "Selected item rotation angle, degrees")}
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
								onChange={(event) => setSelectedItemAngleRaw(event.target.value)}
								onKeyDown={(event) => {
									if (
										!cancelNumericDraftOnEscape(
											event,
											cancelSelectedItemNumericDraft,
										)
									) {
										if (hostNavigation && event.key === "Enter") {
											event.preventDefault();
											void commitSelectedItem();
										} else commitOnEnter(event);
									}
								}}
								value={selectedItemAngleRaw}
							/>
						</label>
					</div>
				) : null}
			</div>
		) : null;
	const floorItemWallFields =
		selectedItem && project.schemaVersion === 1 ? (
			<ItemWallDistanceFields
				key={selectedItem.assetInstanceId}
				drafts={itemWallDrafts}
				onDraftChange={updateItemWallDraft}
				onFocusSide={setFocusedWallDistance}
				skipBlurCommit={consumeSkippedNumericBlurCommit}
				disabled={isEditorReadOnly || isMutationBlocked || selectedItemLocked}
				distances={itemWallDistancesFor(
					derivedRooms.filter(({ roomId }) => roomId === selectedItem.roomId),
					selectedItem,
				)}
				onApply={(side, valueMm) => {
					if (isEditorReadOnly || isMutationBlocked || selectedItemLocked)
						return false;
					const point = itemWallDistancePositionFor(
						derivedRooms.filter(({ roomId }) => roomId === selectedItem.roomId),
						selectedItem,
						side,
						valueMm,
					);
					if (!point || point.roomId !== selectedItem.roomId) return false;
					if (point.xMm === selectedItem.xMm && point.zMm === selectedItem.zMm)
						return true;
					return moveItem({
						assetInstanceId: selectedItem.assetInstanceId,
						...point,
					});
				}}
			/>
		) : null;
	const floorItemActions = selectedItem ? (
		<ItemInspectorActions telegram={hostNavigation !== undefined}>
			<button
				disabled={
					isEditorReadOnly ||
					isWorking ||
					state.kind === "persist-failed" ||
					state.kind === "recovery-needed"
				}
				aria-label={copy("Дублировать предмет", "Duplicate item")}
				onClick={duplicateSelectedItem}
				type="button"
			>
				{hostNavigation ? copy("Дублировать", "Duplicate") : copy("Дублировать предмет", "Duplicate item")}
			</button>
			<button
				aria-label={
					selectedItemLocked ? copy("Разблокировать предмет", "Unlock item") : copy("Заблокировать предмет", "Lock item")
				}
				aria-pressed={selectedItemLocked === true}
				disabled={isEditorReadOnly || isMutationBlocked}
				onClick={() =>
					void setFloorItemLock(selectedItem.assetInstanceId, !selectedItemLocked)
				}
				type="button"
			>
				{selectedItemLocked
					? hostNavigation
						? copy("Разблокировать", "Unlock")
						: copy("Разблокировать предмет", "Unlock item")
					: hostNavigation
						? copy("Заблокировать", "Lock")
						: copy("Заблокировать предмет", "Lock item")}
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
				ref={itemDeleteTriggerRef}
				onClick={() =>
					hostNavigation
						? setItemDeleteConfirmation(true)
						: void deleteSelectedItem()
				}
				type="button"
			>
				{copy("Удалить предмет", "Delete item")}
			</button>
		</ItemInspectorActions>
	) : null;
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
						? copy("Риск заполнения хранилища", "Storage is running low")
						: copy("Хранилище почти заполнено", "Storage is nearly full")}
				</strong>
				<p>{storagePressureCopy(storagePressure)}</p>
				<button
					disabled={isRequestingPersistentStorage}
					onClick={() => void requestPersistentStorage()}
					type="button"
				>
					{isRequestingPersistentStorage
						? copy("Запрашиваем защиту…", "Requesting protection…")
						: copy("Запросить защиту хранилища", "Request storage protection")}
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
								? copy("Очищаем кэш…", "Clearing cache…")
								: copy("Освободить место в кэше", "Free up cache space")}
						</button>
						{browseCacheCleanup ? (
							<p data-testid="browse-cache-cleanup-status">
								{browseCacheCleanup.kind === "cleared"
									? copy("Кэш повторно загружаемых данных очищен. Сохранённые проекты и модели не затронуты.", "Downloaded data were cleared from the cache. Saved projects and models are intact.")
									: copy("Не удалось очистить кэш каталога. Экспортируйте проект перед следующей правкой.", "The catalog cache could not be cleared. Export the project before your next edit.")}
							</p>
						) : null}
					</>
				) : null}
				<button data-editor-host-back={fullTransientNavigationProtection ? "projects" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(true) : void returnToProjects()} type="button">
					{copy("К проектам и экспорту", "Projects and exports")}
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
				<strong>{copy("Не удалось оценить свободное место", "Storage availability could not be estimated")}</strong>
				<p>
					{copy("Точный 2D-план и локальное сохранение остаются доступны, но браузер не сообщает остаток хранилища. Перед важной работой создайте резервную копию проекта.", "The 2D plan and local saving are available. The browser cannot report remaining storage. Back up the project before making important changes.")}
				</p>
				<button data-editor-host-back={fullTransientNavigationProtection ? "projects" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(true) : void returnToProjects()} type="button">
					{copy("К проектам и экспорту", "Projects and exports")}
				</button>
			</aside>
		) : null;

	const selectToolButton = (
		<button
			aria-label={hostNavigation ? copy("Выбор и перемещение", "Select and move") : copy("Рука и выбор", "Pan and select")}
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
			<span>{hostNavigation ? copy("Выбор", "Select") : copy("Рука и выбор", "Pan and select")}</span>
		</button>
	);

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
                <strong>{copy("Есть несохранённая правка", "Unsaved edit")}</strong>
                <p>{copy("На экране — последняя сохранённая версия. Сначала сохраните отдельную копию правки.", "You are viewing the last saved version. Save a separate copy of the edit first.")}</p>
                <button type="button" onClick={() => void downloadRecoveryDraft()}>{copy("Скачать копию для восстановления", "Download recovery copy")}</button>
                {projectTransferError ? <p role="alert">{projectTransferError}</p> : null}
            </aside> : null}
			{state.kind === "persist-failed" && !isRenameProjectOpen ? (
				<SaveFailureNotice
					actionLabel={persistenceFailureActionCopy(state.reasonCode, retryPolicy)}
					description={retryPolicy === "registered-transfer-reselection-required" ? copy("Несохранённая правка доступна для экспорта восстановления. Чтобы повторить импорт, выберите исходный файл снова. Существующие проекты не изменены.", "You can export the unsaved edit for recovery. Choose the original file again to retry the import. Existing projects are intact.") : persistenceFailureCopy(state.reasonCode)}
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
						<h2>{copy("Проект требует восстановления", "Project needs recovery")}</h2>
						<p data-testid="resource-recovery-diagnostic">
							{copy("Редактирование остановлено. Показана проверенная геометрия только для просмотра. Недоступные модели временно скрыты; сохранённый проект не изменён.", "Editing is paused. Verified geometry is available to view. Unavailable models are temporarily hidden. The saved project is intact.")}
						</p>
						{recoveryRemovalSummary ? (
							<p>
								{copy("Размещённых предметов:", "Placed items:")}{" "}
								{recoveryRemovalSummary.affectedAssetInstanceCount}{copy(". Недоступных описаний моделей:", ". Unavailable model definitions:")}{" "}
								{recoveryRemovalSummary.affectedAssetDefinitionCount}.
							</p>
						) : null}
						<ResourceRepairControls
							telegram={hasTelegramEditorSheet}
							busy={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
							error={customGlbRepairError}
							onGlbFiles={(files) => void repairCustomGlbResourceFiles(files)}
							onBackupFile={repairFromPortableBackup}
						/>
						{recoveryRemovalSummary ? (
							<button
								className={safetyStyles.danger}
								disabled={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
								onClick={() => setIsRecoveryRemovalConfirmationOpen(true)}
								type="button"
							>
								{copy("Удалить все недоступные модели", "Remove all unavailable models")}
							</button>
						) : null}
						<button
							disabled={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
							onClick={() => void controller.recover()}
							type="button"
						>
							{copy("Повторить проверку", "Retry verification")}
						</button>
						<button
							disabled={isRepairingCustomGlb || isRemovingUnresolvedCustomGlb}
							data-editor-host-back={fullTransientNavigationProtection ? "projects" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(true) : void returnToProjects()}
							type="button"
						>
							{copy("Вернуться к проектам", "Back to projects")}
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
						? copy("Recovery-копия — только просмотр", "Recovery copy · view only")
						: isWriterLeaseReadOnly
							? copy("Только просмотр", "View only")
							: statusCopy(state)}
				</span>
				{isHistoryResourceRecovery && !isHistoryDiscardConfirmationOpen ? (
					<aside
						aria-live="assertive"
						className={`${safetyStyles.card} ${safetyStyles.floating}`}
						data-testid="history-resource-recovery-notice"
						role="alert"
					>
						<h2>{copy("Недоступная модель находится только в истории", "An unavailable model is used only in the history")}</h2>
						<ResourceRepairControls
							telegram={hasTelegramEditorSheet}
							busy={isRepairingCustomGlb}
							error={customGlbRepairError}
							onGlbFiles={(files) => void repairCustomGlbResourceFiles(files)}
							onBackupFile={repairFromPortableBackup}
						/>
						<p>
							{copy("Текущий план сохранён и доступен для экспорта, но редактирование, «Отменить» и «Повторить» остановлены до восстановления модели или явной очистки истории.", "The current plan is saved and can be exported. Restore the model or clear the history to resume editing, undo and redo.")}
						</p>
						<button
							className={safetyStyles.primary}
							onClick={() => void controller.refreshSessionHistoryIntegrity()}
							type="button"
						>
							{copy("Проверить историю снова", "Check history again")}
						</button>
						<button
							ref={historyDiscardTriggerRef}
							onClick={() => {
								setHistoryDiscardError(undefined);
								setIsHistoryDiscardConfirmationOpen(true);
							}}
							type="button"
						>
							{copy("Очистить историю", "Clear history")}
						</button>
					</aside>
				) : null}
				{!isStarterContourVisible ? storagePressureNotice : null}

				{hostNavigation && selectedItem && viewMode === "three-dimensional" && !isItemPlacementActive && !selectionBehindSheet ? (
					<button
						className={`${styles.tmaDuplicateAction} ${styles.tmaSceneDuplicateAction}`}
						disabled={isEditorReadOnly || isMutationBlocked}
						onClick={duplicateSelectedItem}
						type="button"
					>{copy("Дублировать", "Duplicate")}</button>
				) : null}
				{viewMode === "three-dimensional" && threeDimensionalScene ? (
					<RoomScene3d
						onProductMetric={reportProductMetric}
						roomTheme={roomTheme}
						plainLabels={hostNavigation !== undefined}
						resizeDrawingBufferOnChangeOnly={hostNavigation !== undefined}
						onCloseItemPlacement={localGreyboxCatalog ? () => requestEditorBack(false, cancelItemPlacement) : undefined}
						skipBlurCommit={consumeSkippedNumericBlurCommit}
						exactFloorYaw={exactFloorYaw || (selectedItem !== undefined && "yawMilliDeg" in selectedItem)}
						rotationStepMode={rotationStepMode}
						onRotationStepModeChange={onRotationStepModeChange}
						registerTransientBoundary={fullTransientNavigationProtection ? registerTransientBoundary : undefined}
						assessItemPlacement={(point) => {
							if (
								project?.schemaVersion !== 1 ||
								!threeDimensionalOrigin ||
								!itemPlacementDraft
							) {
								return { kind: "invalid", reasonCode: "OUTSIDE_ROOM_HOST" };
							}
							const xMm = Math.round(
								point.xM * 1000 + threeDimensionalOrigin.xMm,
							);
							const zMm = Math.round(
								point.zM * 1000 + threeDimensionalOrigin.zMm,
							);
							const { yawRadians: _displayYaw, ...placement } = itemPlacementDraft;
							const roomId = findRoomForFloorItem(project, {
								depthMm: placement.depthMm,
								yawStep: itemPlacementDraft.yawStep,
								yawMilliDeg: itemPlacementDraft.yawMilliDeg,
								widthMm: itemPlacementDraft.widthMm,
								xMm,
								zMm,
							});
							if (!roomId) return { kind: "invalid", reasonCode: "OUTSIDE_ROOM_HOST" };
							return assessParametricFloorItemPlacement(project, {
								...placement,
								roomId,
								xMm,
								zMm,
							}, undefined, hostNavigation ? "reject" : "warn");
						}}
						customGlbResourceStates={customGlbResourceStates}
						canTransformSelectedItem={!selectedItemLocked}
						customGlbResources={customGlbResources}
						itemPlacementDraft={
							activeTool === "item" ? itemPlacementDraft : undefined
						}
						itemPlacementControls={itemPlacementColor}
						selectedItemControls={selectedItemColor}
						initialItemPlacementPoint={localGreyboxCatalog && threeDimensionalOrigin && retainedPlacementPoint.current ? {
							xM: (retainedPlacementPoint.current.xMm - threeDimensionalOrigin.xMm) / 1000,
							zM: (retainedPlacementPoint.current.zMm - threeDimensionalOrigin.zMm) / 1000,
						} : undefined}
						onItemPlacementPointChange={localGreyboxCatalog && threeDimensionalOrigin ? ({ xM, zM }) => {
							retainedPlacementPoint.current = {
								xMm: Math.round(xM * 1000 + threeDimensionalOrigin.xMm),
								zMm: Math.round(zM * 1000 + threeDimensionalOrigin.zMm),
							};
						} : undefined}
						snapFloorItemPoint={floorItemWallSnap ? (point, assetInstanceId) => {
							if (!threeDimensionalOrigin || project.schemaVersion !== 1) return point;
							const selected = assetInstanceId === undefined ? undefined :
								project.assetInstances.find((item) => item.assetInstanceId === assetInstanceId);
							const footprint = assetInstanceId === undefined ? itemPlacementDraft :
								selected?.anchorClass === "floor" ? selected : undefined;
							if (!footprint) return point;
							const snapped = floorItemWallSnap({
								assetInstanceId,
								footprint: assetInstanceId === undefined ? {
									depthMm: footprint.depthMm,
									widthMm: footprint.widthMm,
									...floorYawFieldsForRadians(itemPlacementYawRadians, exactFloorYaw),
								} : footprint,
								target: {
									xMm: point.xM * 1000 + threeDimensionalOrigin.xMm,
									zMm: point.zM * 1000 + threeDimensionalOrigin.zMm,
								},
							});
							return {
								xM: (snapped.xMm - threeDimensionalOrigin.xMm) / 1000,
								zM: (snapped.zMm - threeDimensionalOrigin.zMm) / 1000,
							};
						} : undefined}
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
						plainLabels={hostNavigation !== undefined}
						reversedItemFrontIds={reversedPlanItemFrontIds}
						rotationInspectorState={hostNavigation && selectedItem && !isEditorActionMenuOpen && !isOpeningDialogOpen && !selectedOpening
							? selectedItemFields ? "present" : "pending"
							: undefined}
						showItemWallDistances={hostNavigation !== undefined}
						focusedWallDistance={isSelectionInspectorExpanded && floorItemTab === "walls" ? focusedWallDistance : undefined}
						onCloseItemPlacement={localGreyboxCatalog ? () => requestEditorBack(false, cancelItemPlacement) : undefined}
						skipBlurCommit={consumeSkippedNumericBlurCommit}
						exactFloorYaw={exactFloorYaw}
						rotationStepMode={rotationStepMode}
						onRotationStepModeChange={onRotationStepModeChange}
						initialItemPlacementPoint={localGreyboxCatalog ? retainedPlacementPoint.current : undefined}
						onItemPlacementPointChange={localGreyboxCatalog ? (point: { xMm: number; zMm: number } | undefined) => {
							retainedPlacementPoint.current = point;
						} : undefined}
						registerTransientBoundary={fullTransientNavigationProtection ? registerTransientBoundary : undefined}
						dimensionVisibility={dimensionVisibility}
						openingMoveErrorCopy={errorCopy}
						activeTool={activeTool}
						isInteractionLocked={isOpeningDialogOpen && (!openingEntry || openingEntry === "add")}
						isWallMoveMode={isWallMoveMode}
						isWallSplitMode={isWallSplitMode}
						isWallVertexMoveMode={isWallVertexMoveMode}
						movableWallVertexIds={movableSelectedWallVertexIds}
						openingCreationPreview={openingCreationPreview}
						onMoveOpeningCreationDraft={compactOpeningCreation && !isEditorReadOnly && !isMutationBlocked && !wallAddHostConflict ? moveOpeningCreationDraft : undefined}
						openingHostIds={openingEntry && openingEntry !== "add" ? openingHostIds : undefined}
						onChooseOpeningHost={openingEntry && openingEntry !== "add" ? (wallSegmentId, offsetMm) => {
							if (openingHostIds.has(wallSegmentId)) placeNewOpening(openingEntry, wallSegmentId, offsetMm);
							else setDimensionError(copy("Этот проём не помещается на выбранной стене.", "This opening does not fit on the selected wall."));
						} : undefined}
						keyboardItemMovement={hostNavigation !== undefined}
						showOpeningTemplates={hostNavigation !== undefined}
						selectedOpeningId={selectedOpeningId}
						openingMovePreview={
							openingDraft && openingDraftPreviewOffset !== undefined &&
							(openingDraft.isMove || openingDraft.swingSide || openingDraft.hingeEnd !== undefined ||
								(hostNavigation && openingDraftPreviewOffset !== selectedOpening?.offsetMm))
								? {
										openingId: openingDraft.openingId,
										swingSide: openingDraft.swingSide,
										hingeEnd: openingDraft.hingeEnd,
										offsetMm: openingDraftPreviewOffset,
									}
								: undefined
						}
						itemDraft={fullTransientNavigationProtection && !isItemPlacementActive ? undefined : itemPlacementDraft}
						floorItemWallSnap={floorItemWallSnap}
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
						onOpeningMoveStart={hostNavigation ? () => setDimensionError(undefined) : undefined}
						onWallMoveModeChange={setIsWallMoveMode}
						onWallSplitModeChange={setIsWallSplitMode}
						onWallVertexMoveModeChange={setIsWallVertexMoveMode}
						project={project}
						selectedItemId={selectedItemId}
						selectedWallId={selectedWallId}
						selectedWallRun={wallRunSegmentIds ? selectedWallRun : undefined}
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
						aria-label={hostNavigation ? copy("Назад", "Back") : copy("Вернуться к проектам", "Back to projects")}
						data-editor-host-back={fullTransientNavigationProtection ? "back" : undefined}
						className={styles.editorBackAction}
						disabled={
							isWorking || isRepairingCustomGlb || isRemovingUnresolvedCustomGlb
						}
						onClick={() => isNavigationProtected ? requestEditorBack() : void returnToProjects()}
						type="button"
					>
						{copy("Назад", "Back")}
					</button>
					<button
						aria-label={copy(`Переименовать проект ${project.name}`, `Rename project ${project.name}`)}
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
						data-editor-preview={isEditorPreview || undefined}
						role="status"
					>
						{editorSaveState}
					</span>
					{!isItemPlacementSurfaceActive && !openingCreationDraft ? (
						<button
							aria-controls="editor-secondary-actions"
							aria-expanded={isEditorActionMenuOpen}
							aria-haspopup="dialog"
							aria-label={copy("Открыть остальные действия", "Open more actions")}
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
							aria-label={copy("Переключить вид редактора", "Switch editor view")}
							className={styles.editorViewSwitch}
							data-testid="editor-view-switch"
						>
							<legend className={styles.visuallyHidden}>
								{copy("Переключить вид редактора", "Switch editor view")}
							</legend>
							<button
								aria-label={copy("План 2D", "2D plan")}
								aria-pressed={viewMode === "plan"}
								disabled={openingCreationDraft !== undefined}
								onClick={() => setViewMode("plan")}
								type="button"
							>
								{copy("План", "Plan")}
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
								aria-label={copy("Настроить размеры", "Configure dimensions")}
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
								<span>{copy("Размеры", "Dimensions")}</span>
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
						{copy("Офлайн — работаем на устройстве", "Offline · working on this device")}
					</p>
				) : null}

				{isRenameProjectOpen ? (
					<RenameProjectDialog
						telegram={hostNavigation !== undefined}
						name={renameProjectName}
						error={renameProjectError}
						busy={isWorking}
						blocked={isMutationBlocked}
						canRetry={isPersistenceFailure}
						onChange={setRenameProjectName}
						onSubmit={(event) => void submitRenameProject(event)}
						onRetry={() => void retryRenameProjectPublication()}
						onCancel={cancelRenameProject}
						onBackdropClose={() => requestEditorBack(false, cancelRenameProject)}
						returnFocusRef={renameProjectTriggerRef}
					/>
				) : null}

				{!isItemPlacementSurfaceActive && !openingCreationDraft && (!openingEntry || openingEntry === "add") ? (
					<>
						<nav aria-label={copy("Инструменты редактора", "Editor tools")} className={styles.toolRail}>
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
								{isWallOpeningDockContext && !hostNavigation ? (
									<button
										aria-label={copy("Добавить проём", "Add opening")}
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
										<span>{copy("Добавить проём", "Add opening")}</span>
									</button>
								) : (
									<button
										aria-label={copy("Комната", "Room")}
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
										<span>{copy("Комната", "Room")}</span>
									</button>
								)}
								{!hostNavigation && selectToolButton}
								{isWallOpeningDockContext ? (
									<button
										aria-label={copy("Свойства", "Properties")}
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
										<span>{copy("Свойства", "Properties")}</span>
									</button>
								) : (
									<button
										aria-label={copy("Стена", "Wall")}
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
										<span>{copy("Стена", "Wall")}</span>
									</button>
								)}

								{hostNavigation ? (
									<button
										aria-expanded={openingEntry === "add"}
										aria-haspopup="dialog"
										className={`${styles.dockAction} ${styles.itemDockAction}`}
										disabled={isEditorReadOnly || isMutationBlocked}
										onClick={() => setOpeningEntry("add")}
										ref={addDockTriggerRef}
										type="button"
									>
										<svg aria-hidden="true" data-testid="add-tool-icon" fill="none" height="24" viewBox="0 0 24 24" width="24">
											<path d="M12 4.5v15M4.5 12h15" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
										</svg>
										<span>{copy("Добавить", "Add")}</span>
									</button>
								) : (
								<button
									aria-label={copy("Предметы интерьера", "Furniture and fixtures")}
									aria-pressed={activeTool === "item"}
									className={`${styles.dockAction} ${styles.itemDockAction}`}
									disabled={
										isEditorReadOnly ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									onClick={(event) => openBuiltInCatalog(event.currentTarget)}
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
									<span>{copy("Предмет", "Item")}</span>
								</button>
								)}
								{hostNavigation && selectToolButton}
							</div>
						</nav>
						<TelegramSheetFrame
							as="dialog"
							telegram={hasTelegramEditorSheet}
							aria-label={copy("Остальные действия редактора", "More editor actions")}
							data-telegram-sheet={hasTelegramEditorSheet ? "menu" : undefined}
							className={styles.editorActionMenu}
							hidden={!isEditorActionMenuOpen}
							id="editor-secondary-actions"
							ref={editorActionMenuRef}
							onCancel={(event) => {
								event.preventDefault();
								closeEditorActionMenu();
							}}
							onClick={hasTelegramEditorSheet ? undefined : (event) => {
								if (event.target !== event.currentTarget) return;
								const bounds = event.currentTarget.getBoundingClientRect();
								if (
									event.clientX < bounds.left ||
									event.clientX > bounds.right ||
									event.clientY < bounds.top ||
									event.clientY > bounds.bottom
								) {
									closeEditorActionMenu();
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
							<SheetHeader
								title={copy("Ещё", "More")}
								closeLabel={copy("Закрыть остальные действия", "Close more actions")}
								protectEditorDraft={hasTelegramEditorSheet}
								onClose={closeEditorActionMenu}
							/>
							{onOpenSettings && <button type="button" onClick={() => {
								setIsEditorActionMenuOpen(false);
								requestAnimationFrame(() => onOpenSettings(editorHeaderMenuRef.current ?? undefined));
							}}>{copy("Настройки", "Settings")}</button>}
							{isWallOpeningDockContext ? (
								<button
									aria-label={copy("Предметы интерьера", "Furniture and fixtures")}
									disabled={
										isEditorReadOnly ||
										isWorking ||
										state.kind === "persist-failed" ||
										state.kind === "recovery-needed"
									}
									onClick={() => {
										setIsEditorActionMenuOpen(false);
										openBuiltInCatalog(editorHeaderMenuRef.current);
									}}
									type="button"
								>
									{copy("Каталог", "Catalog")}
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
									{copy("Параметры выбранного предмета", "Selected item settings")}
								</button>
							) : null}
							{viewMode === "plan" &&
							activeTool === "select" &&
							!selectedItem &&
							!selectedWall &&
							metrics ? (
								<button onClick={openPlanInspector} type="button">
									{copy("Размеры плана", "Plan dimensions")}
								</button>
							) : null}
							<button
								disabled={isWorking}
								data-editor-host-back={fullTransientNavigationProtection ? "projects" : undefined}
							onClick={() => isNavigationProtected ? requestEditorBack(true) : void returnToProjects()}
								type="button"
							>
								{copy("Проекты", "Projects")}
							</button>
							<button
								disabled={isWorking}
								onClick={() => void exportProjectTransfer()}
								type="button"
							>
								{copy("Экспортировать проект", "Export project")}
							</button>
							{registeredTransferExport ? <button type="button" disabled={isWorking} onClick={() => void exportProjectTransfer(undefined, true)}>{copy("Экспорт файла для переноса", "Export transfer file")}</button> : null}
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
								{copy("Начать заново", "Start over")}
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
								{copy("Удалить проект", "Delete project")}
							</button>
						</TelegramSheetFrame>
					</>
				) : null}

				<fieldset
					aria-label={copy("История изменений", "Edit history")}
					className={styles.canvasHistory}
					data-plan-rotation-obstacle={viewMode === "plan" || undefined}
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
						aria-label={copy("Помещения", "Rooms")}
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
						aria-label={copy("Вернуться к чертежу", "Back to plan")}
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

				{viewMode === "plan" && selectedOpening && !isOpeningDialogOpen && (!hostNavigation || !hasTransientPlanEdit) ? (
					<TelegramSheetFrame telegram={hostNavigation !== undefined} canvasAnchored
						className={styles.openingContext}
						aria-label={
							selectedOpening.kind === "Window"
								? copy("Выбранное окно", "Selected window")
								: copy("Выбранный проём", "Selected opening")
						}
					>
						<strong>
							{selectedOpening.kind === "Window" ? copy("Окно", "Window") : copy("Дверной проём", "Door opening")}
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
							{copy("Параметры", "Settings")}
						</button>
						<button
							type="button"
							disabled={isEditorReadOnly || isMutationBlocked}
							onClick={() =>
								void deleteSelectedDoorOpening(selectedOpening.openingId)
							}
						>
							{copy("Удалить", "Delete")}
						</button>
					</TelegramSheetFrame>
				) : null}

				{viewMode === "plan" && openingEntry === "add" ? (
					<EditorModalSheet
						telegramModal={canOpenTelegramEditorSheet}
						aria-label={copy("Добавить", "Add")}
						className={styles.openingEntrySheet}
						onRequestClose={() => requestEditorBack(false, closeOpeningEntry)}
						restoreFocus={() => addDockTriggerRef.current}
						role="dialog"
						tabIndex={-1}
					>
						<SheetHeader title={copy("Добавить", "Add")} closeLabel={copy("Закрыть добавление", "Close add menu")} onClose={() => requestEditorBack(false, closeOpeningEntry)} />
						<div className={sheetStyles.body}>
							<div className={styles.openingAddChoices} data-opening-type-choices>
								<button type="button" ref={doorChoiceRef} onClick={() => chooseOpeningType("Door")}>
									<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
										<path d="M3 20h4V5" /><path d="M7 5a15 15 0 0 1 15 15" strokeDasharray="2 2" />
									</svg>
									{copy("Дверь", "Door")}
								</button>
								<button type="button" ref={windowChoiceRef} onClick={() => chooseOpeningType("Window")}>
									<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 10h20M2 14h20" /></svg>
									{copy("Окно", "Window")}
								</button>
								<button type="button" onClick={() => {
									setOpeningEntry(undefined);
									openBuiltInCatalog(addDockTriggerRef.current);
								}}>
									<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d="M7 11V6.5A2.5 2.5 0 0 1 9.5 4h5A2.5 2.5 0 0 1 17 6.5V11M5 11h14v6H5zM8 17v3M16 17v3" /></svg>
									{copy("Предмет", "Item")}
								</button>
							</div>
						</div>
					</EditorModalSheet>
				) : null}

				{viewMode === "plan" && openingEntry && openingEntry !== "add" ? (
					<EditorModalSheet
						telegramModal={false}
						telegramSheet
						aria-label={openingEntry === "Door" ? copy("Поставить дверь", "Place door") : copy("Поставить окно", "Place window")}
						className={styles.openingEntrySheet}
						data-testid="opening-host-picker"
						onRequestClose={() => requestEditorBack(false, goBackFromOpeningEntry)}
						role="region"
						tabIndex={-1}
					>
						<SheetHeader title={openingEntry === "Door" ? copy("Поставить дверь", "Place door") : copy("Поставить окно", "Place window")} closeLabel={copy("Отменить выбор места", "Cancel position selection")} onClose={() => requestEditorBack(false, closeOpeningEntry)} />
						<div className={sheetStyles.body}>
							<p>{openingHostChoices.length ? copy("Укажите место на подсвеченной стене.", "Choose a position on a highlighted wall.") : copy("На плане нет подходящих стен.", "There are no suitable walls on the plan.")}</p>
							{dimensionError && <p role="alert">{dimensionError}</p>}
							{openingHostChoices.length > 0 ? (
								<button type="button" ref={openingWallListRef} aria-expanded={showOpeningWallList} onClick={() => setShowOpeningWallList(value => !value)}>
									{copy("Выбрать стену", "Choose wall")}
								</button>
							) : (
								<button type="button" ref={openingWallListRef} onClick={() => {
									setOpeningEntry(undefined);
									void activateWallTool();
								}}>{copy("Нарисовать стену", "Draw wall")}</button>
							)}
							{showOpeningWallList && (
								<div className={styles.openingAddChoices}>
									{openingHostChoices.map(host => (
										<button key={host.wallSegmentId} type="button" onClick={() => placeNewOpening(openingEntry, host.wallSegmentId)}>
											{copy("Стена", "Wall")} {host.ordinal} · {formatLengthMm(host.lengthMm)}
										</button>
									))}
								</div>
							)}
						</div>
					</EditorModalSheet>
				) : null}

				{viewMode === "plan" && openingCreationDraft && compactOpeningCreation ? (
					<EditorModalSheet
						telegramModal={false}
						telegramSheet
						aria-label={openingCreationDraft.kind === "Door" ? copy("Новая дверь", "New door") : copy("Новое окно", "New window")}
						busy={isWorking}
						className={styles.openingEntrySheet}
						data-testid="opening-creation-draft"
						onRequestClose={() => requestEditorBack(false, closeOpeningCreationDraft)}
						role="region"
						tabIndex={-1}
					>
						<SheetHeader title={openingCreationDraft.kind === "Door" ? copy("Новая дверь", "New door") : copy("Новое окно", "New window")} closeLabel={copy("Закрыть создание проёма", "Close opening creation")} closeDisabled={isWorking} onClose={() => requestEditorBack(false, closeOpeningCreationDraft)} />
						<div className={sheetStyles.body}>
							{openingCreationDraftError && <p role="alert">{openingCreationDraftError}</p>}
							<div className={styles.openingCompactActions}>
								{openingCreationDraftValidation?.kind === "invalid" && <button type="button" onClick={() => {
									setOpeningEntry(openingCreationDraft.kind);
									setOpeningCreationDraft(undefined);
									setDimensionError(undefined);
									requestAnimationFrame(() => openingWallListRef.current?.focus());
								}}>{copy("Выбрать другое место", "Choose another position")}</button>}
								<button type="button" disabled={isWorking} onClick={() => setShowOpeningCreationDetails(true)}>{copy("Параметры", "Settings")}</button>
								<button type="button" disabled={isWorking} onClick={closeOpeningCreationDraft}>{copy("Отменить", "Cancel")}</button>
								<button type="button" disabled={isMutationBlocked || !canConfirmOpeningCreationDraft} onClick={() => void confirmOpeningCreationDraft()}>{copy("Подтвердить", "Confirm")}</button>
							</div>
						</div>
					</EditorModalSheet>
				) : null}

				{viewMode === "plan" && openingCreationDraft && !compactOpeningCreation ? (
					<EditorModalSheet
						telegramModal={canOpenTelegramEditorSheet}
						busy={isWorking}
						onRequestClose={() => requestEditorBack(false, closeOpeningCreationDraft)}
						restoreFocus={() => editorHeaderMenuRef.current}
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
							<SheetHeader
								titleId="opening-creation-title"
								title={openingCreationDraft.kind === "Window" ? copy("Новое окно", "New window") : copy("Новый проём", "New opening")}
								closeLabel={copy("Закрыть создание проёма", "Close opening creation")}
								closeDisabled={isWorking}
								onClose={() => isNavigationProtected ? requestEditorBack(false, closeOpeningCreationDraft) : closeOpeningCreationDraft()}
							/>
							{openingCreationHost ? (
								<p className={styles.openingCreationHost}>
									{copy("Стена", "Wall")} {openingCreationHost.ordinal} ·{" "}
									{formatLengthMm(openingCreationHost.lengthMm)}
								</p>
							) : null}
							{openingCreationDraft.baseRevisionId === undefined && <fieldset className={styles.openingCreationKindPicker}>
								<legend className={styles.visuallyHidden}>{copy("Тип проёма", "Opening type")}</legend>
								<button
									aria-pressed={openingCreationDraft.kind === "Door"}
									disabled={isWorking || isEditorReadOnly}
									onClick={() => selectOpeningCreationKind("Door")}
									type="button"
								>
									{copy("Дверь", "Door")}
								</button>
								<button
									aria-pressed={openingCreationDraft.kind === "Window"}
									disabled={isWorking || isEditorReadOnly}
									onClick={() => selectOpeningCreationKind("Window")}
									type="button"
								>
									{copy("Окно", "Window")}
								</button>
							</fieldset>}
							<div className={styles.openingCreationFields}>
								{openingCreationDraft.baseRevisionId !== undefined && (
									<label>
										<span>{copy("Смещение вдоль стены", "Offset along the wall")}</span>
										<input aria-label={copy("Смещение вдоль стены, мм", "Offset along the wall, mm")} inputMode="numeric"
											aria-describedby={openingCreationDraftError ? "opening-creation-error" : undefined}
											aria-invalid={!!openingCreationDraftError}
											disabled={isWorking || isEditorReadOnly}
											value={openingCreationDraft.offsetMm}
											onChange={(event) => {
												const offsetMm = event.target.value;
												setDimensionError(undefined);
												setOpeningCreationDraft(current => current ? { ...current, offsetMm } : current);
											}} />
									</label>
								)}
								<label>
									<span>{copy("Ширина", "Width")}</span>
									<input
										aria-describedby={
											openingCreationDraftError
												? "opening-creation-error"
												: undefined
										}
										aria-invalid={openingCreationDraftError ? true : undefined}
										aria-label={copy("Ширина, мм", "Width, mm")}
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
									<span>{copy("Высота", "Height")}</span>
									<input
										aria-describedby={
											openingCreationDraftError
												? "opening-creation-error"
												: undefined
										}
										aria-invalid={openingCreationDraftError ? true : undefined}
										aria-label={copy("Высота, мм", "Height, mm")}
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
							{hostNavigation && openingCreationDraft.kind === "Door" && (
								<DoorSwingPicker value={openingCreationDraft.swingSide} hingeEnd={openingCreationDraft.hingeEnd} showHingeOptions={doorHingeAuthoring} insideSide={doorInsideSide} disabled={isWorking || isEditorReadOnly}
									onChange={(swingSide, hingeEnd) => {
										setDimensionError(undefined);
										setOpeningCreationDraft({ ...openingCreationDraft, swingSide, hingeEnd: hingeEnd ?? undefined });
									}} />
							)}
							{openingCreationDraftError ? (
								<p id="opening-creation-error" role="alert">
									{openingCreationDraftError}
								</p>
							) : null}
							<div className={styles.openingCreationActions}>
								<button data-editor-action="cancel"
									disabled={isWorking}
									onClick={closeOpeningCreationDraft}
									type="button"
								>
									{hostNavigation ? copy("Отменить", "Cancel") : copy("Отмена", "Cancel")}
								</button>
								<button
									disabled={
										isWorking ||
										isEditorReadOnly ||
										!canConfirmOpeningCreationDraft
									}
									type="submit"
								>
									{openingCreationDraft.baseRevisionId === undefined ? copy("Добавить", "Add") : copy("Подтвердить", "Confirm")}
								</button>
							</div>
						</form>
					</EditorModalSheet>
				) : null}

				{viewMode === "plan" && openingDraft?.isMove && !hostNavigation ? (
					<ProjectConfirmationDialog
						plainLabels={hostNavigation !== undefined}
						label={
							openingDraft.kind === "Window"
								? copy("Подтвердить перемещение окна", "Confirm window move")
								: copy("Подтвердить перемещение проёма", "Confirm opening move")
						}
						title={
							openingDraft.kind === "Window"
								? copy("Переместить окно?", "Move this window?")
								: copy("Переместить проём?", "Move this opening?")
						}
						cancelLabel={copy("Отмена", "Cancel")}
						confirmLabel={copy("Подтвердить", "Confirm")}
						confirmTone="primary"
						busyLabel={copy("Сохраняем…", "Saving…")}
						busy={isWorking}
						error={dimensionError}
						onCancel={cancelOpeningDraft}
						onConfirm={() => void confirmOpeningDraft()}
						returnFocusRef={selectionPropertiesTriggerRef}
						fallbackFocusRef={editorHeaderMenuRef}
						testId="opening-move-confirmation"
					>
						<p>
							{openingDraft.kind === "Window" ? copy("Окно переместится в выбранное место.", "The window will move to the selected position.") : copy("Дверь переместится в выбранное место.", "The door will move to the selected position.")}
						</p>
					</ProjectConfirmationDialog>
				) : null}

				{viewMode === "plan" && openingDraft && !openingDraft.isMove ? (
					<EditorModalSheet
						telegramModal={canOpenTelegramEditorSheet}
						busy={isWorking}
						onRequestClose={() => requestEditorBack(false, cancelOpeningDraft)}
						restoreFocus={() => editorHeaderMenuRef.current}
						aria-label={
							openingDraft.kind === "Door"
								? copy("Параметры дверного проёма", "Door opening settings")
								: copy("Параметры окна", "Window settings")
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
							<SheetHeader
								title={openingDraft.kind === "Door" ? copy("Изменить проём", "Edit opening") : copy("Изменить окно", "Edit window")}
								closeLabel={copy("Закрыть параметры проёма", "Close opening settings")}
								closeDisabled={isWorking}
								onClose={() => isNavigationProtected ? requestEditorBack(false, cancelOpeningDraft) : cancelOpeningDraft()}
							/>

							<div className={styles.openingCreationFields}>
								{canEditOpeningOffset(openingDraft, hostNavigation !== undefined) && <label>
									<span>{copy("Смещение вдоль стены", "Offset along the wall")}</span>
									<input aria-label={copy("Смещение вдоль стены, мм", "Offset along the wall, mm")} inputMode="numeric"
										value={openingDraft.offsetMm}
										disabled={isWorking || isEditorReadOnly}
										onChange={(event) => {
											const offsetMm = event.target.value;
											setDimensionError(undefined);
											setOpeningDraft(current => current ? { ...current, offsetMm } : current);
										}} />
								</label>}
								<label>
									<span>{copy("Ширина", "Width")}</span>
									<input
										aria-label={
											openingDraft.kind === "Door"
												? copy("Ширина дверного проёма, мм", "Door opening width, mm")
												: copy("Ширина окна, мм", "Window width, mm")
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
									<span>{copy("Высота", "Height")}</span>
									<input
										aria-label={
											openingDraft.kind === "Door"
												? copy("Высота дверного проёма, мм", "Door opening height, mm")
												: copy("Высота окна, мм", "Window height, mm")
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
							{hostNavigation && openingDraft.kind === "Door" && (
								<DoorSwingPicker value={openingDraft.swingSide} hingeEnd={openingDraft.hingeEnd} showHingeOptions={doorHingeAuthoring} insideSide={doorInsideSide} disabled={isWorking || isEditorReadOnly}
									onChange={(swingSide, hingeEnd) => {
										setDimensionError(undefined);
										setOpeningDraft({ ...openingDraft, swingSide, hingeEnd });
									}} />
							)}
							{windowAlignmentAvailable ? (
								<div className={styles.windowAlignment}>
									<p id="window-alignment-help">{copy("Одинаковые окна на этой стене стоят на разных отметках.", "Matching windows on this wall are at different heights.")}</p>
									<button
										aria-describedby="window-alignment-help"
										disabled={isEditorReadOnly || isMutationBlocked || windowAlignmentDirty}
										onClick={() => void confirmOpeningDraft("align")}
										type="button"
									>
										{copy("Выровнять окна", "Align windows")}
									</button>
								</div>
							) : null}
							{dimensionError ? (
								<p id="opening-draft-error" role="alert">
									{dimensionError}
								</p>
							) : null}
							<div className={styles.openingCreationActions}>
								<button disabled={isWorking || isEditorReadOnly} type="submit">
									{openingDraft.isMove
										? copy("Применить", "Apply")
										: openingDraft.kind === "Door"
											? copy("Сохранить проём", "Save opening")
											: copy("Сохранить окно", "Save window")}
								</button>
								<button data-editor-action="cancel"
									disabled={isWorking}
									onClick={cancelOpeningDraft}
									type="button"
								>
									{hostNavigation ? copy("Отменить", "Cancel") : copy("Отмена", "Cancel")}
								</button>
							</div>
						</form>
					</EditorModalSheet>
				) : null}

				{viewMode === "plan" && vertexDeletionCandidate && hostNavigation ? (
					<EditorConsequenceSheet
						title={copy("Удалить вершину", "Delete vertex")}
						closeLabel={copy("Закрыть удаление вершины", "Close vertex deletion")}
						confirmLabel={copy("Удалить вершину", "Delete vertex")}
						testId="vertex-deletion-draft"
						busy={isDeletingVertex || isWorking}
						blocked={isMutationBlocked || isEditorReadOnly || state.kind === "recovery-needed"}
						error={dimensionError}
						onCancel={() => { setDimensionError(undefined); setVertexDeletionCandidate(undefined); }}
						onConfirm={() => void confirmVertexDeletion()}
						restoreFocus={() => selectionPropertiesTriggerRef.current}
					>
						<p>{copy("Две прямые части стены станут одним участком.", "The two straight wall sections will become one segment.")}</p>
						{vertexDeletionAffectedWallItemIds.length > 0 ? <p>{copy("Настенные предметы останутся на своих местах.", "Wall-mounted items will stay in place.")}</p> : null}
					</EditorConsequenceSheet>
				) : viewMode === "plan" && vertexDeletionCandidate ? (
					<aside
						aria-label={copy("Последствия удаления вершины", "Effects of deleting the vertex")}
						aria-live="assertive"
						className={styles.windowDraftPanel}
						data-testid="vertex-deletion-draft"
						ref={vertexDeletionPanelRef}
						role="alert"
						tabIndex={-1}
					>
						<div>
							<strong>{copy("Черновик удаления вершины", "Vertex deletion preview")}</strong>
							<span>
								{copy("Будут объединены только две прямые части стены без проёмов.", "Two straight wall sections without openings will be joined.")}
							</span>
							{vertexDeletionAffectedWallItemIds.length > 0 ? (
								<>
									<span>
										{copy("Адреса настенных предметов будут проверены и при необходимости перенесены на объединённую стену.", "The editor will check wall-mounted items and move their attachments to the joined wall if needed.")}
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
								{copy("Отмена не меняет план, историю или локальное сохранение.", "Cancel to keep the plan and history as they are.")}
							</span>
							{dimensionError ? <p role="alert">{dimensionError}</p> : null}
							<div>
								<button data-editor-action="confirm"
									disabled={
										isDeletingVertex ||
										isEditorReadOnly ||
										isMutationBlocked ||
										state.kind === "recovery-needed"
									}
									onClick={() => void confirmVertexDeletion()}
									type="button"
								>
									{hostNavigation ? copy("Подтвердить", "Confirm") : copy("Подтвердить удаление", "Confirm deletion")}
								</button>
								<button data-editor-action="cancel"
									disabled={isDeletingVertex}
									onClick={() => {
										setDimensionError(undefined);
										setVertexDeletionCandidate(undefined);
									}}
									type="button"
								>
									{hostNavigation ? copy("Отменить", "Cancel") : copy("Отменить удаление", "Cancel deletion")}
								</button>
							</div>
						</div>
					</aside>
				) : null}

				{viewMode === "plan" && wallAddHostConflict && hostNavigation ? (
					<EditorConsequenceSheet
						title={copy("Добавить стену", "Add wall")}
						closeLabel={copy("Закрыть добавление стены", "Close wall creation")}
						confirmLabel={copy("Добавить и удалить", "Add and remove")}
						testId="wall-add-host-conflict-preview"
						busy={isResolvingWallAddHostConflict || isWorking}
						blocked={isEditorReadOnly}
						error={dimensionError}
						onCancel={cancelWallAddHostConflict}
						onConfirm={() => void resolveWallAddHostConflict()}
					>
						<p>{copy("Новая стена пересекает существующую. Следующие объекты на месте стыка будут удалены.", "The new wall intersects an existing wall. The following objects at the join will be removed.")}</p>
						<ul>
							{wallAddHostConflict.openingIds.map(openingId => (
								<li key={openingId}>{project?.level.openings.find(opening => opening.openingId === openingId)?.kind === "Window" ? copy("Окно", "Window") : copy("Дверной проём", "Door opening")}</li>
							))}
							{wallAddHostConflict.itemIds.map(itemId => (
								<li key={itemId}>{project?.assetInstances.find(item => item.assetInstanceId === itemId)?.label ?? copy("Настенный предмет", "Wall-mounted item")}</li>
							))}
						</ul>
					</EditorConsequenceSheet>
				) : viewMode === "plan" && wallAddHostConflict ? (
					<aside
						aria-label={copy("Последствия добавления стены", "Effects of adding the wall")}
						aria-live="assertive"
						className={styles.windowDraftPanel}
						data-testid="wall-add-host-conflict-preview"
						ref={wallAddHostConflictPanelRef}
						role="alert"
						tabIndex={-1}
					>
						<div>
							<strong>{copy("Последствия добавления стены", "Effects of adding the wall")}</strong>
							<span>
								{copy("Новый T- или X-образный стык разделит существующую стену в точке размещённого объекта.", "A T or X junction will split the existing wall where an object is attached.")}
							</span>
							{wallAddHostConflict.openingIds.length > 0 ? (
								<>
									<span>
										{wallAddHostConflict.openingIds.length === 1
											? copy("1 проём потеряет допустимый адрес. Его можно удалить только вместе с добавлением стены.", "One opening will lose its wall attachment. Remove it when you add the wall.")
											: copy(`${wallAddHostConflict.openingIds.length} проёма потеряют допустимый адрес. Их можно удалить только вместе с добавлением стены.`, `${wallAddHostConflict.openingIds.length} openings will lose their wall attachments. Remove them when you add the wall.`)}
									</span>
									<ul data-testid="wall-add-conflicting-openings">
										{wallAddHostConflict.openingIds.map((openingId) => {
											const opening = project?.level.openings.find(
												(candidate) => candidate.openingId === openingId,
											);
											return (
												<li key={openingId}>
													{opening?.kind === "Window"
														? copy("Окно", "Window")
														: copy("Дверной проём", "Door opening")}{" "}
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
											? copy("1 настенный предмет потеряет допустимый адрес. Его можно удалить только вместе с добавлением стены.", "One wall-mounted item will lose its attachment. Remove it when you add the wall.")
											: copy(`${wallAddHostConflict.itemIds.length} настенных предмета потеряют допустимый адрес. Их можно удалить только вместе с добавлением стены.`, `${wallAddHostConflict.itemIds.length} wall-mounted items will lose their attachments. Remove them when you add the wall.`)}
									</span>
									<ul data-testid="wall-add-conflicting-items">
										{wallAddHostConflict.itemIds.map((assetInstanceId) => {
											const item = project?.assetInstances.find(
												(candidate) =>
													candidate.assetInstanceId === assetInstanceId,
											);
											return (
												<li key={assetInstanceId}>
													{item?.label ?? copy("Настенный предмет", "Wall-mounted item")}{" "}
													<code>{assetInstanceId}</code>
												</li>
											);
										})}
									</ul>
								</>
							) : null}
							<span>
								{copy("Отмена не меняет план, историю или локальное сохранение.", "Cancel to keep the plan and history as they are.")}
							</span>
							{dimensionError ? <p role="alert">{dimensionError}</p> : null}
							<div>
								<button data-editor-action="confirm"
									disabled={
										isResolvingWallAddHostConflict ||
										isWorking ||
										isEditorReadOnly
									}
									onClick={() => void resolveWallAddHostConflict()}
									type="button"
								>
									{hostNavigation ? copy("Подтвердить", "Confirm") : copy(`Добавить стену${
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
									}`, `Add wall${wallAddHostConflict.openingIds.length === 0 ? "" : ` and remove ${wallAddHostConflict.openingIds.length} ${wallAddHostConflict.openingIds.length === 1 ? "opening" : "openings"}`}${wallAddHostConflict.itemIds.length === 0 ? "" : ` and remove ${wallAddHostConflict.itemIds.length} wall-mounted ${wallAddHostConflict.itemIds.length === 1 ? "item" : "items"}`}`)}
								</button>
								<button data-editor-action="cancel"
									disabled={isResolvingWallAddHostConflict || isWorking}
									onClick={cancelWallAddHostConflict}
									type="button"
								>
									{hostNavigation ? copy("Отменить", "Cancel") : copy("Отмена", "Cancel")}
								</button>
							</div>
						</div>
					</aside>
				) : null}

				{viewMode === "plan" && wallDeletionConflict && hostNavigation ? (
					<EditorConsequenceSheet
						title={copy("Удалить стену", "Delete wall")}
						closeLabel={copy("Закрыть удаление стены", "Close wall deletion")}
						confirmLabel={wallDeletionConflict.roomMetadataConflicts.length ? copy("Объединить помещения", "Merge rooms") : copy("Удалить стену", "Delete wall")}
						testId="opening-conflict-preview"
						busy={isWorking}
						blocked={isEditorReadOnly || wallDeletionConflict.roomMetadataConflicts.some(conflict =>
							!wallDeletionConflict.retainedRoomIdByTargetFaceKey[conflict.targetFaceKey])}
						error={dimensionError}
						onCancel={cancelWallDeletionConflict}
						onConfirm={() => void confirmWallDeletionConflict()}
						restoreFocus={() => selectionPropertiesTriggerRef.current}
					>
						{!wallDeletionConflict.requiresResolution ? <p>{copy("Выбранная стена будет удалена.", "The selected wall will be deleted.")}</p> : null}
						{wallDeletionConflict.roomMetadataConflicts.map(conflict => {
							const choices = conflict.retainedRoomIds.map(roomId => {
								const room = project?.schemaVersion === 1 ? project.level.rooms.find(candidate => candidate.roomId === roomId) : undefined;
								return { roomId, room, label: roomTypeLabels[room?.type ?? "other"] };
							});
							return (
								<Fragment key={conflict.targetFaceKey}>
									<p>{copy("Объединятся помещения", "Rooms will merge")} {choices.map(choice => `«${choice.label}»`).join(copy(" и ", " and "))}.</p>
									<fieldset className={sheetStyles.consequenceChoices}>
										<legend>{copy("Какие тип и высоту сохранить?", "Which room type and height should be kept?")}</legend>
										{choices.map(({ roomId, room, label }, index) => (
											<button
												type="button"
												aria-pressed={wallDeletionConflict.retainedRoomIdByTargetFaceKey[conflict.targetFaceKey] === roomId}
												data-testid={`wall-deletion-metadata-${index}`}
												disabled={isWorking || isEditorReadOnly}
												key={roomId}
												onClick={() => chooseWallDeletionRoomMetadata(conflict.targetFaceKey, roomId)}
											>
												{label}{choices.filter(choice => choice.label === label).length > 1 ? copy(` · вариант ${index + 1}`, ` · option ${index + 1}`) : ""}
												{room ? <small>{formatLengthMm(room.heightMm)}</small> : null}
											</button>
										))}
									</fieldset>
								</Fragment>
							);
						})}
						{wallDeletionConflict.roomIds.length > 0 && wallDeletionConflict.roomMetadataConflicts.length === 0 ? (
							<p>{copy("Будут изменены контуры помещений", "Room outlines will change")} {wallDeletionConflict.roomIds.map(roomId => {
								const room = project?.schemaVersion === 1 ? project.level.rooms.find(candidate => candidate.roomId === roomId) : undefined;
								return `«${roomTypeLabels[room?.type ?? "other"]}»`;
							}).join(", ")}.</p>
						) : null}
						{wallDeletionConflict.openingIds.length + wallDeletionConflict.itemIds.length > 0 ? (
							<>
								<p>{copy("Вместе со стеной будут удалены следующие объекты.", "The following objects will be deleted with the wall.")}</p>
								<ul>
									{wallDeletionConflict.openingIds.map(openingId => (
										<li key={openingId}>{project?.level.openings.find(opening => opening.openingId === openingId)?.kind === "Window" ? copy("Окно", "Window") : copy("Дверной проём", "Door opening")}</li>
									))}
									{wallDeletionConflict.itemIds.map(itemId => (
										<li key={itemId}>{project?.assetInstances.find(item => item.assetInstanceId === itemId)?.label ?? copy("Предмет", "Item")}</li>
									))}
								</ul>
							</>
						) : null}
					</EditorConsequenceSheet>
				) : viewMode === "plan" && wallDeletionConflict ? (
					<aside
						aria-label={copy("Последствия удаления стены", "Effects of deleting the wall")}
						aria-live="assertive"
						className={styles.windowDraftPanel}
						data-testid="opening-conflict-preview"
						ref={wallDeletionConflictPanelRef}
						role="alert"
						tabIndex={-1}
					>
						<div>
							<strong>{copy("Последствия удаления", "Effects of deletion")}</strong>
							{!wallDeletionConflict.requiresResolution ? (
								<span>
									{copy("Будет удалена выбранная стена. Помещения, проёмы и предметы не затрагиваются.", "The selected wall will be deleted. Rooms, openings and items will stay in place.")}
								</span>
							) : null}
							{wallDeletionConflict.openingIds.length > 0 ? (
								<>
									<span>
										{wallDeletionConflict.openingIds.length === 1
											? copy("На этой стене 1 проём. Его можно удалить только вместе со стеной.", "This wall has one opening. It will be deleted with the wall.")
											: copy(`На этой стене ${wallDeletionConflict.openingIds.length} проёма. Их можно удалить только вместе со стеной.`, `This wall has ${wallDeletionConflict.openingIds.length} openings. They will be deleted with the wall.`)}
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
											? copy("1 предмет потеряет допустимый адрес. Его можно удалить только вместе со стеной.", "One item will lose its attachment. It will be deleted with the wall.")
											: copy(`${wallDeletionConflict.itemIds.length} предмета потеряют допустимый адрес. Их можно удалить только вместе со стеной.`, `${wallDeletionConflict.itemIds.length} items will lose their attachments. They will be deleted with the wall.`)}
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
											? copy("Будет изменено 1 помещение.", "One room will change.")
											: copy(`Будут изменены ${wallDeletionConflict.roomIds.length} помещения.`, `${wallDeletionConflict.roomIds.length} rooms will change.`)}
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
										{copy("После объединения выберите помещение, чьи тип, высота и история останутся.", "Choose which room's type, height and history to keep after merging.")}
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
															? copy(`Сохранить параметры «${roomTypeLabels[room.type ?? "other"]}»`, `Keep settings for “${roomTypeLabels[room.type ?? "other"]}”`)
															: copy(`Сохранить параметры помещения ${index + 1}`, `Keep settings for room ${index + 1}`)}
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
								{copy("Отмена не меняет план, историю или локальное сохранение.", "Cancel to keep the plan and history as they are.")}
							</span>
							{dimensionError ? <p role="alert">{dimensionError}</p> : null}
							<div>
								<button data-editor-action="confirm"
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
									{hostNavigation ? copy("Подтвердить", "Confirm") : copy(`Удалить стену${
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
									}`, `Delete wall${wallDeletionConflict.openingIds.length === 0 ? "" : ` and ${wallDeletionConflict.openingIds.length} ${wallDeletionConflict.openingIds.length === 1 ? "opening" : "openings"}`}${wallDeletionConflict.itemIds.length === 0 ? "" : ` and ${wallDeletionConflict.itemIds.length} ${wallDeletionConflict.itemIds.length === 1 ? "item" : "items"}`}${wallDeletionConflict.roomIds.length === 0 ? "" : ` and change ${wallDeletionConflict.roomIds.length} ${wallDeletionConflict.roomIds.length === 1 ? "room" : "rooms"}`}`)}
								</button>
								<button data-editor-action="cancel"
									disabled={isWorking}
									onClick={cancelWallDeletionConflict}
									type="button"
								>
									{hostNavigation ? copy("Отменить", "Cancel") : copy("Отмена", "Cancel")}
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
						{copy("Этот архивный формат доступен только для просмотра. Новое редактирование будет доступно после безопасного переноса в канонический план.", "This archived format is view only. Editing is available after transferring it to the current plan format.")}
					</p>
				) : null}

				{activeTool === "select" &&
				selectedItem &&
				selectedItemFields &&
				viewMode === "plan" ? (
					<EditorModalSheet
						telegramModal={canOpenTelegramEditorSheet && isSelectionInspectorExpanded && !selectionBehindSheet && selectedOpening === undefined}
						busy={isWorking}
						onRequestClose={() => requestEditorBack(false, closeFloorItemProperties)}
						restoreFocus={() => floorPropertiesTriggerRef.current ?? selectionPropertiesTriggerRef.current}
						aria-label={copy("Свойства выбранного предмета", "Selected item properties")}
						className={`${styles.selectionPanel} ${styles.selectionInspectorPanel}`}
						data-item-locked={selectedItemLocked}
						data-inspector-expanded={isSelectionInspectorExpanded}
						data-inspector-compact={localGreyboxCatalog || undefined}
						data-testid="selected-item-inspector"
						id="selected-item-inspector"
						hidden={
							isEditorActionMenuOpen ||
							isOpeningDialogOpen ||
							selectedOpening !== undefined
						}
					>
						{localGreyboxCatalog && isSelectionInspectorExpanded ? (
							<SheetHeader
								title={selectedItem.label}
								closeLabel={copy("Скрыть панель предмета", "Hide item panel")}
								protectEditorDraft={fullTransientNavigationProtection}
								onClose={() => requestEditorBack(false, closeFloorItemProperties)}
							/>
						) : (
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
									? copy("ВЫБРАННЫЙ ПРЕДМЕТ", "SELECTED ITEM")
									: copy("МАКЕТНЫЙ ПРЕДМЕТ", "PLACEHOLDER ITEM")}
							</span>
							<strong>{selectedItem.label}</strong>
							<button
								aria-expanded={isSelectionInspectorExpanded}
								aria-label={
									isSelectionInspectorExpanded
										? copy("Скрыть панель предмета", "Hide item panel")
										: copy("Развернуть панель предмета", "Expand item panel")
								}
								className={styles.selectionInspectorToggle}
								ref={floorPropertiesTriggerRef}
								data-editor-host-back={fullTransientNavigationProtection && isSelectionInspectorExpanded ? "panel" : undefined}
								onClick={() => {
									if (isNavigationProtected && isSelectionInspectorExpanded) requestEditorBack(false, closeFloorItemProperties);
									else openSelectionProperties();
								}}
								type="button"
							>
								{isSelectionInspectorExpanded
									? copy("Скрыть параметры", "Hide settings")
									: copy("Параметры ↓", "Settings ↓")}
							</button>
						</div>
						)}


						{selectedItemPlacementWarnings.length > 0 ? (
							<p data-testid="selected-item-placement-warning" role="status">
								{copy("Предупреждение для этого предмета:", "Warning for this item")}{" "}
								{itemPlacementWarningSummary(selectedItemPlacementWarnings)}.
							</p>
						) : null}
						{hostNavigation ? null : floorItemDimensionFields}
						{hostNavigation || localGreyboxCatalog || selectedItemHasNoDeclaredColorVariant ? null : (
							<fieldset className={styles.quickPalette}>
								<legend>{copy("Цвет предмета", "Item color")}</legend>
								<div>
									{alphaParametricItemColorVariants.map((variant) => (
										<button
											aria-label={copy(`Выбрать вариант цвета предмета ${variant.label}`, `Choose item color ${variant.label}`)}
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
						{!hostNavigation ? (
							<>
								<dl className={styles.inlineMetrics}>
									<div>
										<dt>{copy("ПОЗИЦИЯ X", "POSITION X")}</dt>
										<dd>{formatLengthMm(selectedItem.xMm)}</dd>
									</div>
									<div>
										<dt>{copy("ПОЗИЦИЯ Z", "POSITION Z")}</dt>
										<dd>{formatLengthMm(selectedItem.zMm)}</dd>
									</div>
								</dl>
								<fieldset className={styles.itemNudgeControls}>
									<legend>{copy("Переместить предмет на 100 мм", "Move item 100 mm")}</legend>
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
											{copy("Сместить предмет на 100 мм влево", "Move item 100 mm left")}
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
											{copy("Сместить предмет на 100 мм вправо", "Move item 100 mm right")}
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
											{copy("Сместить предмет на 100 мм вверх", "Move item 100 mm up")}
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
											{copy("Сместить предмет на 100 мм вниз", "Move item 100 mm down")}
										</button>
									</div>
								</fieldset>
							</>
						) : null}
						{hostNavigation ? (isSelectionInspectorExpanded ? (
							<TmaFloorItemTabs
								active={floorItemTab}
								onChange={setFloorItemTab}
								sizes={floorItemDimensionFields}
								walls={floorItemWallFields}
								settings={floorItemActions}
							/>
						) : (
							<button className={styles.tmaDuplicateAction} disabled={isEditorReadOnly || isMutationBlocked} onClick={duplicateSelectedItem} type="button">{copy("Дублировать", "Duplicate")}</button>
						)) : floorItemActions}
					</EditorModalSheet>
				) : activeTool === "select" &&
					selectedWall &&
					(isSelectionInspectorExpanded ||
						selectedWallItemDraft !== undefined) &&
					!isWallMoveMode &&
					!isWallSplitMode &&
					!isWallVertexMoveMode &&
					!vertexDeletionCandidate &&
					!wallDeletionConflict &&
					!wallAddHostConflict &&
					viewMode === "plan" ? (
					<EditorModalSheet
						telegramModal={canOpenTelegramEditorSheet && !selectedWallItemDraft && !selectionBehindSheet && selectedOpening === undefined}
						busy={isWorking}
						onRequestClose={() => requestEditorBack(false, closeWallProperties)}
						restoreFocus={() => selectionPropertiesTriggerRef.current}
						aria-label={copy("Свойства выбранной стены", "Selected wall properties")}
						className={`${styles.selectionPanel} ${styles.selectionInspectorPanel}${hasTelegramEditorSheet ? ` ${styles.wallPropertiesSheet}` : ""}`}
						data-inspector-expanded={true}
						data-testid="selected-wall-inspector"
						hidden={
							isEditorActionMenuOpen ||
							isOpeningDialogOpen ||
							selectedOpening !== undefined
						}
					>
						{localGreyboxCatalog ? (
						<SheetHeader
							title={copy("Свойства стены", "Wall properties")}
							closeLabel={copy("Закрыть свойства стены", "Close wall properties")}
							protectEditorDraft={fullTransientNavigationProtection}
							onClose={() => {
								if (isNavigationProtected) requestEditorBack(false, closeWallProperties);
								else closeWallProperties();
							}}
						/>
						) : (
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
							<strong>{copy("Свойства стены", "Wall properties")}</strong>
							<button
								aria-label={copy("Закрыть свойства стены", "Close wall properties")}
								className={styles.selectionInspectorToggle}
								onClick={() => {
									setIsSelectionInspectorExpanded(false);
									setWallItemDraft(undefined);
									setWallItemDraftFields(undefined);
									selectionPropertiesTriggerRef.current?.focus();
								}}
								type="button"
							>
								{copy("Закрыть", "Close")}
							</button>
						</div>
						)}

						{selectedWallItemDraft ? (
							<div className={styles.openingRow} role="status">
								<strong>{copy("Размещение настенного предмета", "Wall-mounted item placement")}</strong>
								<span>
									{copy("Смещение от начала стены:", "Offset from the start of the wall")}{" "}
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
										{copy("Конфликтующий предмет: «", "Overlapping item: “")}{selectedWallItemDraftAffectedLabel}
										{copy("». Измените смещение или сторону.", "”. Change the offset or side.")}
									</p>
								) : null}
								{selectedWallItemDraftWarning ? (
									<p
										className={styles.fieldWarning}
										data-testid="wall-item-placement-warning"
										role="status"
									>
										{copy("Предупреждение: предметы пересекаются.", "Warning: items overlap.")}
									</p>
								) : null}
								<fieldset className={styles.sidePicker}>
									<legend className={styles.visuallyHidden}>
										{copy("Сторона размещения предмета", "Mounting side")}
									</legend>
									<button
										aria-label={copy("Разместить на левой стороне стены", "Place on left side of wall")}
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
										{copy("Слева", "Left")}
									</button>
									<button
										aria-label={copy("Разместить на правой стороне стены", "Place on right side of wall")}
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
										{copy("Справа", "Right")}
									</button>
								</fieldset>
								<button data-editor-action="confirm"
									disabled={
										isEditorReadOnly ||
										isMutationBlocked ||
										!canConfirmWallItemDraft
									}
									onClick={() => void confirmWallItemPlacement()}
									type="button"
								>
									{hostNavigation ? copy("Подтвердить", "Confirm") : copy("Подтвердить размещение", "Confirm placement")}
								</button>
								<button
									disabled={isWorking}
									onClick={() => {
										setWallItemDraft(undefined);
										setWallItemDraftFields(undefined);
									}}
									type="button"
								>
									{copy("Отменить", "Cancel")}
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
											{copy("Предупреждение: «", "Warning: “")}{item.label}{copy("» пересекается с «", "” overlaps “")}
											{affectedLabels.join("», «")}{copy("». Измените смещение или сторону.", "”. Change the offset or side.")}
										</p>
									) : null}
									<label>
										<span>{localGreyboxCatalog ? copy("Смещение вдоль стены, мм", "Offset along the wall, mm") : copy(`Смещение настенного предмета «${item.label}», мм`, `Offset for wall-mounted item “${item.label}”, mm`)}</span>
										<input
											aria-label={copy(`Смещение настенного предмета «${item.label}», мм`, `Offset for wall-mounted item “${item.label}”, mm`)}
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
											{localGreyboxCatalog ? copy("Высота центра, мм", "Center height, mm") : copy(`Высота центра настенного предмета «${item.label}», мм`, `Center height for wall-mounted item “${item.label}”, mm`)}
										</span>
										<input
											aria-label={copy(`Высота центра настенного предмета «${item.label}», мм`, `Center height for wall-mounted item “${item.label}”, mm`)}
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
									) || hostNavigation || localGreyboxCatalog ? null : (
										<fieldset className={styles.quickPalette}>
											<legend>{copy("Цвет настенного предмета «", "Color of wall-mounted item “")}{item.label}»</legend>
											<div>
												{alphaParametricItemColorVariants.map((variant) => (
													<button
														aria-label={copy(`Выбрать вариант цвета настенного предмета ${variant.label}`, `Choose wall-mounted item color ${variant.label}`)}
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
									<ItemInspectorActions telegram={hostNavigation !== undefined}>
										{!localGreyboxCatalog && item.assetDefinitionId !== undefined ? (
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
												{copy("Дублировать настенный предмет", "Duplicate wall-mounted item")}
											</button>
										) : null}
										<button
											aria-label={item.locked ? copy("Разблокировать настенный предмет", "Unlock wall-mounted item") : copy("Заблокировать настенный предмет", "Lock wall-mounted item")}
											aria-pressed={item.locked === true}
											disabled={isEditorReadOnly || isMutationBlocked}
											onClick={() =>
												void setWallItemLock(item.assetInstanceId, !item.locked)
											}
											type="button"
										>
											{item.locked
												? (hostNavigation ? copy("Разблокировать", "Unlock") : copy("Разблокировать настенный предмет", "Unlock wall-mounted item"))
												: (hostNavigation ? copy("Заблокировать", "Lock") : copy("Заблокировать настенный предмет", "Lock wall-mounted item"))}
										</button>

										<button
											disabled={
												isEditorReadOnly || isMutationBlocked || item.locked
											}
											aria-label={copy("Удалить настенный предмет", "Delete wall-mounted item")}
											className={hostNavigation ? styles.deleteAction : undefined}
											onClick={() => void deleteWallItem(item.assetInstanceId)}
											type="button"
										>
											{hostNavigation ? copy("Удалить предмет", "Delete item") : copy("Удалить настенный предмет", "Delete wall-mounted item")}
										</button>
									</ItemInspectorActions>
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
									? copy("Отменить перенос стены", "Cancel wall move")
									: copy("Переместить стену жестом", "Drag to move wall")}
							</button>
						) : null}
						{removableSelectedWallVertexIds.map((vertexId) => (
							<button
								aria-label={
									removableSelectedWallVertexIds.length === 1
										? copy("Удалить вершину", "Delete vertex")
										: vertexId === selectedWall.startVertexId
											? copy(`Удалить начальную вершину ${vertexId}`, `Delete start vertex ${vertexId}`)
											: copy(`Удалить конечную вершину ${vertexId}`, `Delete end vertex ${vertexId}`)
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
									? copy("Удалить вершину", "Delete vertex")
									: vertexId === selectedWall.startVertexId
										? copy("Удалить начальную вершину", "Delete start vertex")
										: copy("Удалить конечную вершину", "Delete end vertex")}
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
									? copy("Отменить перенос вершины", "Cancel vertex move")
									: copy("Переместить вершину жестом", "Drag to move vertex")}
							</button>
						) : null}
						{selectedWallOpenings.map((opening) => (
							<div className={styles.openingRow} key={opening.openingId}>
								{hasTelegramEditorSheet ? (
									<dl className={styles.wallOpeningWidth} data-testid="wall-opening-width">
										<dt>{opening.kind === "Door" ? copy("Ширина дверного проёма", "Door opening width") : copy("Ширина окна", "Window width")}</dt>
										<dd>{formatLengthMm(opening.widthMm)}</dd>
									</dl>
								) : <div>
									<span>
										{opening.kind === "Door"
											? copy("Ширина дверного проёма, мм", "Door opening width, mm")
											: copy("Ширина окна, мм", "Window width, mm")}
									</span>

									<output>{formatLengthMm(opening.widthMm)}</output>
								</div>}
								<button
									disabled={
										isEditorReadOnly ||
										isMutationBlocked ||
										state.kind === "recovery-needed"
									}
									onClick={() => openOpeningDraft(opening)}
									type="button"
								>
									{opening.kind === "Door" ? copy("Изменить проём", "Edit opening") : copy("Изменить окно", "Edit window")}
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
									{opening.kind === "Door" ? copy("Удалить проём", "Delete opening") : copy("Удалить окно", "Delete window")}
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
							{copy("Удалить стену", "Delete wall")}
						</button>
					</EditorModalSheet>
				) : activeTool === "select" && metrics && viewMode === "plan" ? (
					<EditorModalSheet
						telegramModal={canOpenTelegramEditorSheet && isPlanInspectorOpen}
						onRequestClose={() => requestEditorBack(false, closePlanInspector)}
						restoreFocus={() => editorHeaderMenuRef.current}
						aria-label={copy("Точные размеры плана", "Exact plan dimensions")}
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
						<SheetHeader
							title={copy("Размеры плана", "Plan dimensions")}
							closeLabel={copy("Скрыть размеры плана", "Hide plan dimensions")}
							protectEditorDraft={fullTransientNavigationProtection}
							onClose={() => isNavigationProtected ? requestEditorBack(false, closePlanInspector) : closePlanInspector()}
						/>
						<form
							className={inspectorStyles.form}
							onSubmit={applyPlanDimensions}
						>
							<div className={inspectorStyles.fields}>
								<label>
									<span>{copy("Ширина, мм", "Width, mm")}</span>
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
									<span>{copy("Глубина, мм", "Depth, mm")}</span>
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
									<span>{copy("Высота, мм", "Height, mm")}</span>
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
								{copy("Применить размеры", "Apply dimensions")}
							</button>
						</form>
						<dl className={inspectorStyles.metrics}>
							<div>
								<dt>{copy("Площадь", "Area")}</dt>
								<dd data-testid="plan-area">
									{formatAreaMm2(metrics.areaMm2)}
								</dd>
							</div>
							<div>
								<dt>{copy("Высота", "Height")}</dt>
								<dd data-testid="plan-height">
									{formatLengthMm(metrics.heightMm)}
								</dd>
							</div>
							<div>
								<dt>{copy("Периметр", "Perimeter")}</dt>
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
					</EditorModalSheet>
				) : null}

				{activeTool === "select" &&
				!selectedItem &&
				!selectedWall &&
				metrics &&
				viewMode === "plan" ? (
					<button
						aria-label={copy("Размеры плана", "Plan dimensions")}
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
						aria-label={copy("Характеристики 3D макета", "3D model details")}
						className={`${styles.selectionPanel} ${styles.threeDimensionalMetrics}`}
						data-testid="three-dimensional-metrics"
					>
						<div className={styles.panelHeading}>
							<span>{copy("3D МАКЕТ", "3D MODEL")}</span>
							<strong>
								{metrics
									? formatAreaMm2(metrics.areaMm2)
									: roomCountCopy(derivedRooms.length)}
							</strong>
						</div>
						<dl className={styles.inlineMetrics}>
							<div>
								<dt>{copy("ШИРИНА", "WIDTH")}</dt>
								<dd>{formatLengthMm(threeDimensionalMeasurements.widthMm)}</dd>
							</div>
							<div>
								<dt>{copy("ГЛУБИНА", "DEPTH")}</dt>
								<dd>{formatLengthMm(threeDimensionalMeasurements.depthMm)}</dd>
							</div>
							<div>
								<dt>{copy("ВЫСОТА", "HEIGHT")}</dt>
								<dd>{formatLengthMm(threeDimensionalMeasurements.heightMm)}</dd>
							</div>
							<div>
								<dt>{copy("СТЕНЫ", "WALLS")}</dt>
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
							aria-label={copy("Размеры стартового контура", "Starter outline dimensions")}
							className={styles.contourPanel}
							noValidate
							onSubmit={createContour}
						>
							<span>{copy("СТАРТОВЫЙ КОНТУР", "STARTER OUTLINE")}</span>
							<div className={styles.contourFields}>
								<label>
									{copy("Ширина, мм", "Width, mm")}
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
									{copy("Глубина, мм", "Depth, mm")}
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
									{copy("Высота, мм", "Height, mm")}
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
								{copy("Создать контур", "Create outline")}
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
							aria-label={copy("Закрыть уведомление", "Dismiss notification")}
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
									? copy(`Открыть ${wallMutationCorrectionState.opening.kind === "Door" ? "дверной проём" : "окно"} для исправления`, `Open ${wallMutationCorrectionState.opening.kind === "Door" ? "the door opening" : "the window"} to adjust it`)
									: copy("Открыть предмет для исправления", "Open item to adjust it")}
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
						telegram={hasTelegramEditorSheet}
						visibility={dimensionVisibility}
						onChange={changeDimensionVisibility}
						onClose={closeDimensionFilter}
						returnFocusRef={dimensionFilterTriggerRef}
					/>
				) : null}

				{state.kind === "recovery-needed" ? (
					<button
						className={styles.retryButton}
						onClick={() => void controller.recover()}
						type="button"
					>
						{copy("Восстановить проверку", "Retry verification")}
					</button>
				) : null}
				<PwaUpdateNotice
					canActivate={canActivatePwaUpdate}
					hasUndurableDraft={hasUndurableEditorDraft}
					pwaUpdate={pwaUpdate}
				/>
				{isWriterLeaseReadOnly ? (
					<WriterLeaseNotice
						plainLabels={hostNavigation !== undefined}
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

			{itemDeleteConfirmation && selectedItem ? (
				<ProjectConfirmationDialog
					plainLabels
					label={copy("Удалить предмет?", "Delete item?")}
					title={copy("Удалить предмет?", "Delete item?")}
					cancelLabel={copy("Отменить", "Cancel")}
					confirmLabel={copy("Удалить предмет", "Delete item")}
					busyLabel={copy("Сохраняем…", "Saving…")}
					busy={isWorking}
					error={dimensionError}
					onCancel={() => setItemDeleteConfirmation(false)}
					onConfirm={async () => {
						await deleteSelectedItem();
						if (controller.snapshot().kind !== "saving") setItemDeleteConfirmation(false);
					}}
					returnFocusRef={itemDeleteTriggerRef}
					fallbackFocusRef={selectionPropertiesTriggerRef}
				>{selectedItem.label}</ProjectConfirmationDialog>
			) : null}
			{isRoomDirectoryOpen ? (
				<EditorModalSheet
					telegramModal={canOpenTelegramEditorSheet}
					onRequestClose={() => requestEditorBack(false, closeRoomDirectory)}
					restoreFocus={() => roomDockActionRef.current ?? editorHeaderMenuRef.current}
					aria-label={copy("Помещения", "Rooms")}
					aria-modal={isExternalSaveFailure ? undefined : true}
					className={canOpenTelegramEditorSheet ? undefined : inspectorStyles.roomBackdrop}
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
						<SheetHeader
							title={copy("Помещения", "Rooms")}
							closeLabel={copy("Закрыть помещения", "Close rooms")}
							closeDisabled={isWorking}
							protectEditorDraft={fullTransientNavigationProtection}
							onClose={() => isNavigationProtected ? requestEditorBack(false, closeRoomDirectory) : closeRoomDirectory()}
						/>

						<div className={inspectorStyles.content}>
							<nav
								aria-label={copy("Список помещений", "Room list")}
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
										<span>{copy("Тип", "Type")}</span>
										<select
											aria-label={copy("Тип помещения", "Room type")}
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
										<span>{copy("Высота, мм", "Height, mm")}</span>
										<input
											aria-label={copy("Высота помещения, мм", "Room height, mm")}
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
											aria-label={copy("Конфликт высоты помещения и проёмов", "Room height and opening conflict")}
											className={inspectorStyles.conflict}
											data-testid="room-height-opening-conflict-preview"
										>
											<strong>{copy("Высота затрагивает проёмы", "Height affects openings")}</strong>
											<p>
												{roomHeightOpeningConflict.openingIds.length === 1
													? copy("1 проём больше не помещается в стене. Выберите, что с ним сделать.", "One opening no longer fits in the wall. Choose how to resolve it.")
													: copy(`${roomHeightOpeningConflict.openingIds.length} проёма больше не помещаются в стене. Выберите, что сделать с каждым.`, `${roomHeightOpeningConflict.openingIds.length} openings no longer fit in the wall. Choose how to resolve each one.`)}
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
																	? copy("Окно", "Window")
																	: copy("Дверной проём", "Door opening")}
																{actionSuffix}
															</span>
															{resizeHeightMm > 0 ? (
																<button
																	aria-label={copy(`Уменьшить проём${actionSuffix} до ${resizeHeightMm} мм`, `Resize opening${actionSuffix} to ${resizeHeightMm} mm`)}
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
																	{copy("Уменьшить до", "Resize to")} {resizeHeightMm} {copy("мм", "mm")}
																</button>
															) : null}
															<button
																aria-label={copy(`Удалить проём${actionSuffix}`, `Delete opening${actionSuffix}`)}
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
																{copy("Удалить проём", "Delete opening")}
															</button>
														</div>
													);
												},
											)}
											<div className={inspectorStyles.conflictActions}>
												<button data-editor-action="cancel"
													disabled={isWorking}
													onClick={cancelRoomHeightOpeningConflict}
													type="button"
												>
													{hostNavigation ? copy("Отменить", "Cancel") : copy("Отмена", "Cancel")}
												</button>
												<button data-editor-action="confirm"
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
													{hostNavigation ? copy("Подтвердить", "Confirm") : copy(`Сохранить помещение и изменить ${roomHeightOpeningConflict.openingIds.length} проём`, `Save room and update ${roomHeightOpeningConflict.openingIds.length} ${roomHeightOpeningConflict.openingIds.length === 1 ? "opening" : "openings"}`)}
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
											{isWorking ? copy("Сохраняем…", "Saving…") : copy("Сохранить помещение", "Save room")}
										</button>
									) : null}
								</form>
							) : null}
						</div>
					</section>
				</EditorModalSheet>
			) : null}

			{isBuiltInCatalogOpen ? (
				<EditorModalSheet
					telegramModal={canOpenTelegramEditorSheet}
					onRequestClose={() => requestEditorBack(false, closeOverlay)}
					restoreFocus={() => editorHeaderMenuRef.current}
					aria-label={copy("Предметы интерьера", "Furniture and fixtures")}
					aria-modal={localGreyboxCatalog && !isExternalSaveFailure ? true : undefined}
					className={`${styles.catalogDialog}${localGreyboxCatalog ? ` ${styles.tmaGreyboxDialog}` : ""}`}
					data-focused-preloaded-selection={
						selectedPreloadedCatalogAsset ? "true" : undefined
					}
					data-preloaded-resource-state={focusedPreloadedCatalogResourceState}
					onKeyDown={isExternalSaveFailure ? undefined : trapOverlayFocus}
					ref={catalogDialogRef}
					role="dialog"
					tabIndex={-1}
				>
					<SheetHeader
						title={<span data-testid="catalog-title">{copy("Каталог", "Catalog")}</span>}
						closeLabel={copy("Закрыть предметы интерьера", "Close furniture and fixtures")}
						protectEditorDraft={fullTransientNavigationProtection}
						onClose={() => isNavigationProtected ? requestEditorBack(false, closeOverlay) : closeOverlay()}
					/>
					{(!localGreyboxCatalog || isModelLibrarySelected) && (
						<input
							accept=".glb,model/gltf-binary,application/octet-stream"
							aria-label={copy("Выбрать GLB-модель для размещения", "Choose GLB model to place")}
							className={styles.visuallyHidden}
							data-testid="custom-glb-import-input"
							disabled={customGlbImport.kind === "checking"}
							onChange={(event) => void importCustomGlbFile(event.currentTarget.files?.[0])}
							ref={customGlbImportInputRef}
							tabIndex={localGreyboxCatalog ? -1 : undefined}
							type="file"
						/>
					)}

					{localGreyboxCatalog ? (
						<TelegramGreyboxCatalog
							onSelect={beginLocalGreyboxPlacement}
							ownModels={isModelLibrarySelected}
							query={catalogQuery}
							onQueryChange={setCatalogQuery}
							onSectionChange={(own) => own ? openOwnModelLibrary() : returnToLocalGreyboxCatalog()}
							importBusy={customGlbImport.kind === "checking"}
							composerOpen={isPlaceholderComposerOpen}
							onToggleComposer={() => {
								setPlaceholderComposerError(undefined);
								setIsPlaceholderComposerOpen((open) => !open);
							}}
							onImportModel={() => customGlbImportInputRef.current?.click()}
						/>
					) : null}
					{!localGreyboxCatalog || isModelLibrarySelected ? <>
					<div className={styles.catalogContent}
						{...(localGreyboxCatalog ? {
							role: "tabpanel",
							id: "catalog-panel-models",
							"aria-labelledby": "catalog-tab-models",
						} : {})}
					>
						{isCatalogPublicationOutage ? (
							<div
								className={styles.catalogInlineError}
								role="alert"
								data-testid="catalog-publication-error"
							>
								<strong>{copy("Каталог временно недоступен", "The catalog is temporarily unavailable")}</strong>
								<button
									onClick={() => void loadCatalogPublication()}
									type="button"
								>
									{copy("Повторить", "Retry")}
								</button>
							</div>
						) : null}
						{catalogPublicationState.kind === "loading" ? (
							<div
								className={styles.catalogImportStatus}
								data-testid="catalog-publication-status"
								role="status"
							>
								{copy("Загружаем актуальную версию каталога…", "Loading the latest catalog…")}
							</div>
						) : null}
						{catalogPublicationState.kind === "ready" ? (
							<div
								className={styles.catalogImportStatus}
								data-testid="catalog-publication-status"
								role="status"
							>
								<span className={styles.catalogPublicationSummary}>
									{copy("Каталог обновлён", "Catalog updated")}
								</span>
								<span className={styles.catalogPublicationDetails}>
									{copy("Версия", "Version")} {catalogPublicationState.publication.catalogVersion} ·{" "}
									{catalogPublicationState.publication.assets.length} {copy("предметов · envelope SHA-256", "items · envelope SHA-256")}{" "}
									{catalogPublicationState.publication.envelopeHash}
								</span>
							</div>
						) : null}
						{!localGreyboxCatalog || customGlbImport.kind !== "idle" || isPlaceholderComposerOpen ? (
						<CatalogAuthoring className={styles.catalogAuthoring} data-testid="catalog-authoring">
							{!localGreyboxCatalog ? <summary>
								<span
									aria-hidden="true"
									className={styles.catalogAuthoringIcon}
								>
									✦
								</span>
								<span className={styles.catalogAuthoringCopy}>
									<strong>{copy("Импорт модели", "Import model")}</strong>
								</span>
								<span
									aria-hidden="true"
									className={styles.catalogAuthoringChevron}
								>
									⌄
								</span>
							</summary> : null}
							<div className={styles.catalogAuthoringContent}>
								{!localGreyboxCatalog || isPlaceholderComposerOpen ? <section
									aria-label={copy("Создать макетный предмет", "Create placeholder item")}
									className={styles.catalogImport}
								>
									{!localGreyboxCatalog ? <><div>
										<strong>{copy("Свой макетный предмет", "Custom placeholder item")}</strong>
									</div>
									<button
										onClick={() => {
											setPlaceholderComposerError(undefined);
											setIsPlaceholderComposerOpen((isOpen) => !isOpen);
										}}
										type="button"
									>
										{isPlaceholderComposerOpen
											? copy("Скрыть параметры", "Hide settings")
											: copy("Создать макетный предмет", "Create placeholder item")}
									</button></> : null}
									{isPlaceholderComposerOpen ? (
										<form
											aria-label={copy("Создать макетный предмет", "Create placeholder item")}
											className={styles.placeholderComposer}
											onSubmit={(event) => {
												event.preventDefault();
												beginPlaceholderPlacement();
											}}
										>
											<label>
												<span>{copy("Название макетного предмета", "Placeholder item name")}</span>
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
													<span>{copy("Ширина макетного предмета, мм", "Placeholder item width, mm")}</span>
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
													<span>{copy("Глубина макетного предмета, мм", "Placeholder item depth, mm")}</span>
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
													<span>{copy("Высота макетного предмета, мм", "Placeholder item height, mm")}</span>
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
												<legend>{copy("Цвет макетного предмета", "Placeholder item color")}</legend>
												<div>
													{alphaParametricItemColors.map((color) => (
														<button
															aria-label={copy(`Выбрать цвет макетного предмета ${color}`, `Choose placeholder color ${color}`)}
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
												{copy("Начать размещение", "Start placement")}
											</button>
										</form>
									) : null}
								</section> : null}
								<section
									aria-label={copy("Локальное преобразование FBX", "Local FBX conversion")}
									hidden={isEmbeddedHost}
									style={isEmbeddedHost ? { display: "none" } : undefined}
									className={styles.catalogImport}
								>
									<div>
										<strong>{copy("Импортировать FBX", "Import FBX")}</strong>
									</div>
									<input
										accept=".fbx,.zip,.jpg,.jpeg,.png,.webp,application/octet-stream,application/zip,application/x-zip-compressed,image/jpeg,image/png,image/webp"
										aria-label={copy("Выбрать FBX и текстуры для локального преобразования", "Choose FBX and textures for local conversion")}
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
											{copy("Выбрать FBX или ZIP", "Choose FBX or ZIP")}
										</button>
									) : null}
									{fbxConversion.kind === "converting" ? (
										<div className={styles.catalogImportStatus} role="status">
											<span>
												{copy("Преобразуем", "Converting")} {fbxConversion.filename} {copy("локально…", "on this device…")}
											</span>
											<button onClick={cancelFbxConversion} type="button">
												{copy("Отменить", "Cancel")}
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
												{copy("Понятно", "Got it")}
											</button>
										</div>
									) : null}
								</section>
								{!localGreyboxCatalog || customGlbImport.kind !== "idle" ? <section
									aria-label={copy("Импорт своей GLB-модели", "Import your GLB model")}
									className={styles.catalogImport}
								>
									{!localGreyboxCatalog ? <div>
										<strong>{copy("Уже есть GLB?", "Already have a GLB?")}</strong>
									</div> : null}
									{customGlbImport.kind === "idle" ? (
										<button
											onClick={() => customGlbImportInputRef.current?.click()}
											type="button"
										>
											{copy("Выбрать GLB", "Choose GLB")}
										</button>
									) : null}
									{customGlbImport.kind === "checking" ? (
										<div className={styles.catalogImportStatus} role="status">
											<span>
												{copy("Проверяем", "Checking")} {customGlbImport.filename} {copy("локально…", "on this device…")}
											</span>
										</div>
									) : null}
									{customGlbImport.kind === "rejected" ? (
										<div className={styles.catalogImportStatus} role="status">
											<span>
												{customGlbImportFeedback(customGlbImport.reasonCode)}
											</span>
											<button onClick={discardCustomGlbImport} type="button">
												{copy("Выбрать другой файл", "Choose another file")}
											</button>
										</div>
									) : null}
									{customGlbImport.kind === "ready" ? (
										<div className={styles.customGlbReview}>
											<p className={styles.catalogNote}>
												{customGlbImport.source === "fbx"
													? copy(`Конвертировано из FBX: ${customGlbImport.filename} · ${customGlbImport.textureCount} ${customGlbImport.textureCount === 1 ? "текстура встроена" : "текстуры встроены"} в GLB`, `Converted from FBX: ${customGlbImport.filename} · ${customGlbImport.textureCount} ${customGlbImport.textureCount === 1 ? "texture" : "textures"} embedded in the GLB`)
													: copy(`Выбран GLB: ${customGlbImport.filename}`, `Selected GLB: ${customGlbImport.filename}`)}
											</p>
											<CustomGlbPreview
												bytes={customGlbImport.bytes}
												label={customGlbImport.displayName}
												onMeasuredDimensions={applyMeasuredCustomGlbDimensions}
											/>
											<div className={styles.customGlbFields}>
												<label>
													<span>{copy("Название модели", "Model name")}</span>
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
													<span>{copy("Ширина, мм", "Width, mm")}</span>
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
													<span>{copy("Глубина, мм", "Depth, mm")}</span>
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
													<span>{copy("Высота, мм", "Height, mm")}</span>
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
													{copy("Другой файл", "Another file")}
												</button>
											</div>
										</div>
									) : null}
								</section> : null}
							</div>
						</CatalogAuthoring>) : null}
						{!localGreyboxCatalog ? <div className={styles.catalogFilters}>
							<label>
								<span>{copy("Поиск по названию, категории, креплению или размеру", "Search by name, category, mounting or size")}</span>
								<input
									autoComplete="off"
									onChange={(event) => setCatalogQuery(event.target.value)}
									placeholder={copy("Найти предмет", "Find an item")}
									ref={catalogSearchInputRef}
									value={catalogQuery}
								/>
							</label>
							<output aria-live="polite" data-testid="catalog-result-count">
								{itemCountCopy(catalogResultCount)}
							</output>
						</div> : null}
						{!localGreyboxCatalog ? <nav
							aria-label={copy("Категории каталога", "Catalog categories")}
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
								<span className={styles.catalogCategoryLabel}>{copy("Все", "All")}</span>
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
								<span className={styles.catalogCategoryLabel}>{copy("Кастомное", "Custom")}</span>
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
						</nav> : null}
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
										aria-label={copy(`${asset.definition.displayName} — ${asset.definition.widthMm} × ${asset.definition.depthMm} × ${asset.definition.heightMm} мм, ${localGreyboxCatalog ? "Мои модели" : "Кастомное"}${asset.resourceState === "unavailable" ? ", модель недоступна локально" : ""}`, `${asset.definition.displayName} · ${asset.definition.widthMm} × ${asset.definition.depthMm} × ${asset.definition.heightMm} mm, ${localGreyboxCatalog ? "My models" : "Custom"}${asset.resourceState === "unavailable" ? ", model unavailable locally" : ""}`)}
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
													? copy("Модель недоступна локально. Импортируйте исходный GLB заново.", "The model is unavailable locally. Import the original GLB again.")
													: copy("Загружаем локальную модель…", "Loading local model…")}
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
												× {asset.definition.heightMm} {copy("мм", "mm")}
											</small>
											<span className={styles.catalogCardMeta}>
												<span
													className={styles.catalogCardCategory}
													data-testid="catalog-card-category"
												>
															{localGreyboxCatalog ? copy("Мои модели", "My models") : copy("Кастомное", "Custom")}
												</span>
												<span
													className={styles.catalogCardReadiness}
													data-testid="catalog-card-readiness"
												>
													{asset.resourceState === "unavailable"
														? copy("Нужен импорт", "Import needed")
														: copy("Локально", "Local")}
												</span>
											</span>
										</div>
									</button>
									<button
										className={styles.customCatalogRemove}
										type="button"
										aria-label={copy(`Убрать ${asset.definition.displayName} из каталога`, `Remove ${asset.definition.displayName} from catalog`)}
										disabled={removingCustomAssetId !== undefined}
										onClick={() =>
											void removeCustomCatalogAsset(asset.definition)
										}
									>
										{removingCustomAssetId ===
										asset.definition.assetDefinitionId
											? copy("Убираем…", "Removing…")
											: copy("Убрать из каталога", "Remove from catalog")}
									</button>
									<small>
										{copy("Предметы в проектах останутся. Карточку можно вернуть повторным импортом GLB.", "Placed items will stay in your projects. Import the GLB again to restore its card.")}
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
										aria-label={copy(`${asset.label} — ${asset.widthMm} × ${asset.depthMm} × ${asset.heightMm} мм, Встроенный каталог`, `${preloadedGlbCatalogLabelForDisplay(asset)} · ${asset.widthMm} × ${asset.depthMm} × ${asset.heightMm} mm, Built-in catalog`)}
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
												{copy("Превью недоступно", "Preview unavailable")}
											</span>
										) : (
											<img
												alt={copy(`Превью предмета: ${asset.label}`, `Item preview: ${preloadedGlbCatalogLabelForDisplay(asset)}`)}
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
									<strong>{preloadedGlbCatalogLabelForDisplay(asset)}</strong>
											<small>
												{asset.widthMm} × {asset.depthMm} × {asset.heightMm} {copy("мм", "mm")}
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
														? copy("На стене", "Wall-mounted")
														: copy("На полу", "Floor-standing")}
												</span>
												{(asset.variantCount ?? 0) > 0 ? (
													<span
														className={styles.catalogCardVariantCount}
														data-testid="catalog-card-variant-count"
													>
														{copy("Варианты:", "Variants:")} {asset.variantCount}
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
									<strong>{copy("Нет своих моделей", "No custom models yet")}</strong>
								) : catalogQuery.trim() === "" && catalogCategory !== "all" ? (
									copy(`В локальном каталоге пока нет предметов в категории «${
										catalogSections.find(
											(section) => section.id === catalogCategory,
										)?.label ?? catalogCategory
									}».`, `There are no items in the local “${catalogSections.find((section) => section.id === catalogCategory)?.label ?? catalogCategory}” category yet.`)
								) : (
									copy("В локальном каталоге нет предметов с такими параметрами.", "No local items match these filters.")
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
											copy("Выберите предмет", "Choose an item"))}
								</strong>
								<small>
									{customGlbImport.kind === "ready" &&
									!selectedPreloadedCatalogAsset &&
									!selectedCustomCatalogAsset
										? `${customGlbImport.filename} · ${(customGlbImport.bytes.byteLength / 1024 / 1024).toFixed(1)} MiB`
										: selectedPreloadedCatalogAsset
											? copy(`${selectedPreloadedCatalogAsset.widthMm} × ${selectedPreloadedCatalogAsset.depthMm} × ${selectedPreloadedCatalogAsset.heightMm} мм`, `${selectedPreloadedCatalogAsset.widthMm} × ${selectedPreloadedCatalogAsset.depthMm} × ${selectedPreloadedCatalogAsset.heightMm} mm`)
											: selectedCustomCatalogAsset
												? copy(`${selectedCustomCatalogAsset.definition.widthMm} × ${selectedCustomCatalogAsset.definition.depthMm} × ${selectedCustomCatalogAsset.definition.heightMm} мм`, `${selectedCustomCatalogAsset.definition.widthMm} × ${selectedCustomCatalogAsset.definition.depthMm} × ${selectedCustomCatalogAsset.definition.heightMm} mm`)
												: ""}
								</small>
								{selectedPreloadedCatalogAsset?.resource ? (
									<small data-testid="catalog-selected-resource-metadata">
										{copy("Ресурс:", "Resource:")} {selectedPreloadedCatalogAsset.resource.byteLength}{" "}
										{copy("байт · SHA-256", "bytes · SHA-256")}{" "}
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
												: copy("Готовим для офлайн…", "Preparing for offline use…")}
										</span>
										{selectedPreloadedCatalogResourceState?.kind ===
											"loading" &&
										selectedPreloadedCatalogResourceState.totalBytes ? (
											<progress
												aria-label={copy("Прогресс загрузки модели", "Model download progress")}
												max={selectedPreloadedCatalogResourceState.totalBytes}
												value={Math.min(
													selectedPreloadedCatalogResourceState.loadedBytes,
													selectedPreloadedCatalogResourceState.totalBytes,
												)}
											/>
										) : (
											<progress aria-label={copy("Прогресс загрузки модели", "Model download progress")} />
										)}
									</small>
								) : null}
								{selectedPreloadedCatalogAsset &&
								selectedPreloadedCatalogResourceState?.kind === "ready" ? (
									<small
										data-testid="preloaded-catalog-ready-status"
										role="status"
									>
										{copy("Готово для размещения", "Ready to place")}
									</small>
								) : null}
								{selectedPreloadedCatalogAsset &&
								selectedPreloadedCatalogResourceState?.kind ===
									"unavailable" ? (
									<small
										data-testid="preloaded-catalog-resource-status"
										role="status"
									>
										{copy("Не удалось подготовить предмет для офлайн. Проект не изменён.", "The item could not be prepared for offline use. The project is intact.")}
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
								? localGreyboxCatalog
									? copy("Добавить в «Мои модели» и разместить", "Add to My models and place")
									: copy("Добавить в «Кастомное» и разместить", "Add to Custom and place")
								: selectedPreloadedCatalogAsset &&
										isPreloadedCatalogResourcePreparing
									? copy("Отмена", "Cancel")
									: selectedPreloadedCatalogResourceState?.kind ===
											"unavailable"
										? copy("Повторить", "Retry")
										: selectedCustomCatalogAsset?.resourceState ===
												"unavailable"
											? copy("Импортируйте GLB заново", "Import the GLB again")
											: selectedPreloadedCatalogAsset
												? copy("Показать на плане", "Show on plan")
												: copy("Разместить на плане", "Place on plan")}
						</button>
						{selectedPreloadedCatalogResourceState?.kind === "unavailable" ? (
							<button data-editor-action="cancel" onClick={cancelPreloadedCatalogSelection} type="button">
								{hostNavigation ? copy("Отменить", "Cancel") : copy("Отмена", "Cancel")}
							</button>
						) : null}
					</div>
					</> : <div hidden id="catalog-panel-models" role="tabpanel" aria-labelledby="catalog-tab-models" />}
				</EditorModalSheet>
			) : null}
			{isProjectDeletionConfirmationOpen &&
			state.kind === "saved" &&
			!isWriterLeaseReadOnly ? (
				<ProjectConfirmationDialog
						plainLabels={hostNavigation !== undefined}
					label={copy("Удалить проект", "Delete project")}
					title={copy("Удалить проект навсегда?", "Delete this project permanently?")}
					cancelLabel={copy("Оставить проект", "Keep project")}
					confirmLabel={copy("Удалить навсегда", "Delete permanently")}
					busyLabel={copy("Удаляем…", "Deleting…")}
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
						{copy("Проект и его локальные версии будут удалены без возможности восстановления. Это действие нельзя отменить.", "The project and its local versions will be permanently deleted.")}
					</p>
				</ProjectConfirmationDialog>
			) : null}
			{isHistoryDiscardConfirmationOpen &&
			isHistoryResourceRecovery &&
			!isWriterLeaseReadOnly ? (
				<ProjectConfirmationDialog
						plainLabels={hostNavigation !== undefined}
					label={copy("Очистить историю изменений", "Clear edit history")}
					title={copy("Очистить историю изменений?", "Clear edit history?")}
					cancelLabel={copy("Оставить историю", "Keep history")}
					confirmLabel={copy("Очистить историю", "Clear history")}
					busyLabel={copy("Проверяем текущий план…", "Checking the current plan…")}
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
							? copy("Одна сохранённая правка ссылается на отсутствующую или повреждённую модель.", "One saved edit refers to a missing or damaged model.")
							: copy("Сохранённые правки ссылаются на отсутствующие или повреждённые модели.", "Saved edits refer to missing or damaged models.")}
					</p>
					<p>
						{copy("Текущий сохранённый план останется без изменений. Если очистить историю, действия «Отменить» и «Повторить» будут потеряны и их нельзя будет восстановить.", "Your saved plan will stay as it is. Clearing history permanently removes the edits you can undo or redo.")}
					</p>
				</ProjectConfirmationDialog>
			) : null}
			{state.kind === "recovery-needed" && isRecoveryRemovalConfirmationOpen ? (
				<ProjectConfirmationDialog
						plainLabels={hostNavigation !== undefined}
					label={copy("Удалить недоступные модели", "Remove unavailable models")}
					title={copy("Удалить все недоступные модели?", "Remove all unavailable models?")}
					cancelLabel={copy("Отмена", "Cancel")}
					confirmLabel={copy("Подтвердить удаление всех недоступных моделей", "Confirm removal of all unavailable models")}
					busyLabel={copy("Удаляем недоступные модели…", "Removing unavailable models…")}
					busy={isRemovingUnresolvedCustomGlb}
					error={recoveryRemovalError}
					onCancel={() => setIsRecoveryRemovalConfirmationOpen(false)}
					onConfirm={() => void removeUnresolvedCustomGlbReferences()}
					returnFocusRef={editorHeaderMenuRef}
					fallbackFocusRef={editorHeaderMenuRef}
				>
					<p>
						{copy("Будет сохранена одна новая версия без всех недоступных моделей. Это действие нельзя отменить через историю.", "A new version will be saved with all unavailable models removed. This action cannot be undone.")}
					</p>
				</ProjectConfirmationDialog>
			) : null}
			{itemColorVariantDraft && pendingItemColorVariant ? (
				<ProjectConfirmationDialog
						plainLabels={hostNavigation !== undefined}
					label={copy("Подтвердить вариант цвета", "Confirm color variant")}
					confirmTone="primary"
					title={copy(`Применить ${localGreyboxCatalog ? "цвет" : "вариант"} «${pendingItemColorVariant.label}»?`, `Apply ${localGreyboxCatalog ? "color" : "variant"} “${pendingItemColorVariant.label}”?`)}
					cancelLabel={copy("Отменить вариант", "Cancel variant")}
					confirmLabel={
						isPersistenceFailure ? copy("Повторить сохранение", "Retry save") : copy("Применить вариант", "Apply variant")
					}
					busyLabel={copy("Сохраняем…", "Saving…")}
					busy={isWorking}
					error={dimensionError}
					onCancel={() => setItemColorVariantDraft(undefined)}
					onConfirm={() => void confirmItemColorVariant()}
					returnFocusRef={viewMode === "three-dimensional" ? sceneColorTriggerRef : editorHeaderMenuRef}
					fallbackFocusRef={editorHeaderMenuRef}
				>
					{localGreyboxCatalog ? null : <p>
						{copy("Изменится только объявленный слот «Корпус». Габариты, положение и привязка предмета останутся прежними.", "Only the Body material will change. The item will keep its dimensions, position and attachment.")}
					</p>}
				</ProjectConfirmationDialog>
			) : null}
			{isRestartConfirmationOpen ? (
				<ProjectConfirmationDialog
						plainLabels={hostNavigation !== undefined}
					label={copy("Начать проект заново", "Restart project")}
					title={copy("Начать проект заново?", "Restart this project?")}
					cancelLabel={copy("Оставить чертёж", "Keep current plan")}
					confirmLabel={
						isPersistenceFailure
							? copy("Повторить сохранение", "Retry save")
							: copy("Создать пустой план", "Create blank plan")
					}
					busyLabel={copy("Создаём…", "Creating…")}
					busy={isRestartingProject || isWorking}
					error={dimensionError}
					onCancel={() => setIsRestartConfirmationOpen(false)}
					onConfirm={() => void restartCurrentProject()}
					returnFocusRef={editorHeaderMenuRef}
					fallbackFocusRef={editorHeaderMenuRef}
					testId="restart-project-sheet"
				>
					<p>
						{copy("Будет создана новая пустая версия плана. Предыдущую версию можно сразу вернуть кнопкой «Отменить».", "A new blank version will be saved. Select Undo to restore the previous version.")}
					</p>
				</ProjectConfirmationDialog>
			) : null}
		</main>
	);
}
