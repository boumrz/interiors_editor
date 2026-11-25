import { type ReactNode, useEffect, useState } from "react";
import type { RoomRenderTheme } from "../adapters/renderer/three-dimensional-room-palette";
import type {
	CatalogGatewayPort,
	ProjectSourceRecoveryPort,
	ProjectStorageNamespace,
} from "../application/ports";
import type { PwaBrowseCache, PwaInstall, PwaUpdate } from "../ui/AppShell";
import { AppShell } from "../ui/AppShell";
import { copy } from "../ui/editor-language";
import type { DrawingDimensionPreferencesPort } from "../ui/drawing-dimension-visibility";
import type {
	EditorNavigationProtection,
	HostLifecyclePort,
	HostNavigationPort,
} from "../ui/editor-host-boundary";
import type { LocalFileTransferPort } from "../ui/local-file-transfer";
import type { ProductionAppRuntime } from "./production-app";
import type { ProjectController } from "./project-controller";
import type {
	ReleaseRecoveryRecord,
	ReleaseStartupInput,
	ReleaseStartupOutcome,
} from "./release-startup";

type StartupState = { readonly kind: "checking" } | ReleaseStartupOutcome;

export type EditorAppProps = {
	readonly onOpenSettings?: (restoreFocus?: HTMLElement) => void;
	readonly diagnosticDetails?: ReactNode;
	readonly projectsSupplement?: ReactNode;
	readonly localGreyboxCatalog?: boolean;
	readonly roomTheme?: RoomRenderTheme | undefined;
	readonly exactFloorYaw?: boolean;
	readonly doorHingeAuthoring?: boolean;
	readonly readonlyContent?: ReactNode;
	readonly readonlyDetails?: ReactNode;
	readonly readonlyRecoveryDetails?: ReactNode;
	readonly readonlyStorageSources?: readonly ProjectStorageNamespace[];
	/** Trusted live source admission; omitted preserves the startup outcome. */
	readonly writableSourceAdmitted?: boolean;
	readonly editorInstanceKey?: string;
	readonly editorController?: ProjectController;
	readonly editorStorageNamespace?: ProjectStorageNamespace;
	readonly requestedRenameProjectId?: string;
	readonly hostNavigation?: HostNavigationPort;
	readonly navigationProtection?: EditorNavigationProtection;
	readonly hostLifecycle?: HostLifecyclePort;
	readonly registeredTransferImport?: boolean;
	readonly registeredTransferExport?: boolean;
	readonly fileTransfer?: LocalFileTransferPort;
	readonly sourceRecovery?: ProjectSourceRecoveryPort;
	readonly runtime: ProductionAppRuntime;
	readonly catalogGateway: CatalogGatewayPort;
	readonly drawingDimensionPreferences?: DrawingDimensionPreferencesPort;
	readonly readReleaseStartupInput: () => Promise<ReleaseStartupInput>;
	readonly pwaBrowseCache?: PwaBrowseCache;
	readonly pwaInstall?: PwaInstall;
	readonly pwaUpdate?: PwaUpdate;
};

export function ReleaseRecoveryScreen({
	recovery,
	embedded = false,
}: {
	readonly recovery: ReleaseRecoveryRecord;
	readonly embedded?: boolean;
}) {
	const downloadRecoverySource = () => {
		if (typeof recovery.serializedProject !== "string") return;
		const link = document.createElement("a");
		const url = URL.createObjectURL(
			new Blob([recovery.serializedProject], { type: "application/json" }),
		);
		link.download = `${recovery.projectId ?? "interiors-recovery"}-recovery.json`;
		link.href = url;
		link.click();
		URL.revokeObjectURL(url);
	};

	const Container = embedded ? "section" : "main";
	return (
		<Container aria-labelledby="release-recovery-heading">
			<h1 id="release-recovery-heading">{copy("Безопасное восстановление проекта", "Project recovery")}</h1>
			<p>
				{copy("Обновлённая версия не смогла подтвердить совместимость локального проекта. Редактирование заблокировано: исходная ревизия не изменялась.", "The updated app could not verify this local project. The saved version is intact and editing is paused.")}
			</p>
			{typeof recovery.serializedProject === "string" ? (
				<button onClick={downloadRecoverySource} type="button">
					{copy("Скачать копию для восстановления", "Download recovery copy")}
				</button>
			) : (
				<p>{copy("Доступной для экспорта читаемой копии не найдено.", "There is no readable copy to export.")}</p>
			)}
		</Container>
	);
}

export function EditorApp({
	diagnosticDetails,
	projectsSupplement,
	onOpenSettings,
	localGreyboxCatalog,
	exactFloorYaw,
	doorHingeAuthoring,
	readonlyContent,
	readonlyDetails,
	readonlyRecoveryDetails,
	readonlyStorageSources,
	writableSourceAdmitted,
	editorInstanceKey,
	editorController,
	editorStorageNamespace,
	requestedRenameProjectId,
	hostNavigation,
	roomTheme,
	navigationProtection,
	hostLifecycle,
	registeredTransferImport,
	registeredTransferExport,
	fileTransfer,
	sourceRecovery,
	runtime,
	catalogGateway,
	drawingDimensionPreferences,
	readReleaseStartupInput,
	pwaBrowseCache,
	pwaInstall,
	pwaUpdate,
}: EditorAppProps) {
	const [startup, setStartup] = useState<StartupState>({ kind: "checking" });

	useEffect(() => {
		let cancelled = false;
		void readReleaseStartupInput()
			.then((input) => runtime.releaseStartup.handshake(input))
			.then((outcome) => {
				if (!cancelled) setStartup(outcome);
			})
			.catch(() => {
				if (!cancelled) {
					setStartup({ kind: "read-only/exportable", recovery: {} });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [runtime, readReleaseStartupInput]);

	if (startup.kind === "checking" || startup.kind === "migration-in-progress") {
		return (
			<main aria-busy="true" aria-label={copy("Проверка совместимости обновления", "Checking update compatibility")} />
		);
	}
	const readOnly =
		writableSourceAdmitted === undefined
			? startup.kind === "read-only/exportable"
			: !writableSourceAdmitted;
	if (readOnly) {
		return (<>
			{onOpenSettings && <button type="button" onClick={(event) => onOpenSettings(event.currentTarget)}>{copy("Настройки", "Settings")}</button>}
			{readonlyContent ?? (
				<ReleaseRecoveryScreen
					recovery={
						startup.kind === "read-only/exportable" ? startup.recovery : {}
					}
				/>
			)}
		</>);
	}
	return (
		<AppShell
			diagnosticDetails={diagnosticDetails}
			projectsSupplement={projectsSupplement}
			onOpenSettings={onOpenSettings}
			localGreyboxCatalog={localGreyboxCatalog}
			exactFloorYaw={exactFloorYaw}
			doorHingeAuthoring={doorHingeAuthoring}
			readonlyDetails={readonlyDetails}
			readonlyRecoveryDetails={readonlyRecoveryDetails}
			readonlyStorageSources={readonlyStorageSources}
			key={editorInstanceKey}
			requestedRenameProjectId={requestedRenameProjectId}
			editorStorageNamespace={editorStorageNamespace}
			canCreateLegacyProject={runtime.canCreateLegacyProject}
			getLegacyStartupRecovery={runtime.getLegacyStartupRecovery}
			hostNavigation={hostNavigation}
			roomTheme={roomTheme}
			navigationProtection={navigationProtection}
			hostLifecycle={hostLifecycle}
			registeredTransferImport={registeredTransferImport}
			registeredTransferExport={registeredTransferExport}
			fileTransfer={fileTransfer}
			sourceRecovery={sourceRecovery}
			catalogGateway={catalogGateway}
			controller={editorController ?? runtime.controller}
			drawingDimensionPreferences={drawingDimensionPreferences}
			pwaBrowseCache={pwaBrowseCache}
			pwaInstall={pwaInstall}
			pwaUpdate={pwaUpdate}
		/>
	);
}
