import { useSyncExternalStore } from "react";
import type { ProjectStorageNamespace } from "../application/ports";
import { BrowserReadonlyProjects } from "../ui/browser-readonly-projects";
import type { EditorNavigationProtection } from "../ui/editor-host-boundary";
import type { BrowserEditorInstanceSnapshot } from "./browser-editor-instance";
import type { BrowserReadonlyProjectsPort } from "./browser-readonly-projects-port";
import {
	EditorApp,
	type EditorAppProps,
	ReleaseRecoveryScreen,
} from "./editor-app";
import type { ProductionAppRuntime } from "./production-app";

export type BrowserRuntimeEditorRuntime = ProductionAppRuntime & {
	readonly navigationProtection?: EditorNavigationProtection;
	readonly readonlyProjects?: BrowserReadonlyProjectsPort;
	readonly getReadonlyProjectSources?: () => readonly ProjectStorageNamespace[];
	readonly hasWritableSourceAdmission?: () => boolean;
	readonly getEditorInstanceSnapshot: () => BrowserEditorInstanceSnapshot;
	readonly subscribeEditorInstance: (listener: () => void) => () => void;
	readonly getStartupSourcesRevision: () => number;
	readonly subscribeStartupSources: (listener: () => void) => () => void;
};

/** Source availability rerenders the same editor; only an owned instance key remounts it. */
export function BrowserRuntimeEditor(
	props: Omit<EditorAppProps, "runtime"> & {
		readonly runtime: BrowserRuntimeEditorRuntime;
	},
) {
	const { runtime } = props;
	const instance = useSyncExternalStore(
		runtime.subscribeEditorInstance,
		runtime.getEditorInstanceSnapshot,
		runtime.getEditorInstanceSnapshot,
	);
	const sourceRevision = useSyncExternalStore(
		runtime.subscribeStartupSources,
		runtime.getStartupSourcesRevision,
		runtime.getStartupSourcesRevision,
	);
	const readonlySources = runtime.getReadonlyProjectSources?.() ?? [];
	const legacyRecovery = runtime.getLegacyStartupRecovery?.();
	const writableSources = (["legacy", "browser-registered"] as const).filter(
		(namespace) => !readonlySources.includes(namespace),
	);
	return (
		<EditorApp
			{...props}
			writableSourceAdmitted={runtime.hasWritableSourceAdmission?.()}
			navigationProtection={
				props.navigationProtection ?? runtime.navigationProtection
			}
			readonlyStorageSources={
				runtime.readonlyProjects ? readonlySources : undefined
			}
			readonlyContent={
				runtime.readonlyProjects ? (
					<>
						{typeof legacyRecovery?.serializedProject === "string" ? (
							<ReleaseRecoveryScreen recovery={legacyRecovery} embedded />
						) : null}
						<BrowserReadonlyProjects
							port={runtime.readonlyProjects}
							sourceRevision={sourceRevision}
							diagnostics={props.diagnosticDetails}
						/>
					</>
				) : typeof legacyRecovery?.serializedProject === "string" ? (
					<ReleaseRecoveryScreen recovery={legacyRecovery} />
				) : undefined
			}
			readonlyRecoveryDetails={
				runtime.readonlyProjects && writableSources.length > 0 ? (
					<BrowserReadonlyProjects
						port={runtime.readonlyProjects}
						sourceRevision={sourceRevision}
						sourceNamespaces={writableSources}
						supplemental
						rawOnly
					/>
				) : undefined
			}
			readonlyDetails={
				typeof legacyRecovery?.serializedProject === "string" ||
				(runtime.readonlyProjects && readonlySources.length > 0) ? (
					<>
						{typeof legacyRecovery?.serializedProject === "string" ? (
							<ReleaseRecoveryScreen recovery={legacyRecovery} embedded />
						) : null}
						{runtime.readonlyProjects && readonlySources.length > 0 ? (
							<BrowserReadonlyProjects
								port={runtime.readonlyProjects}
								sourceRevision={sourceRevision}
								sourceNamespaces={readonlySources}
								supplemental
							/>
						) : null}
					</>
				) : undefined
			}
			editorController={instance.controller}
			editorStorageNamespace={instance.storageNamespace}
			editorInstanceKey={instance.key}
			requestedRenameProjectId={instance.requestedRenameProjectId}
		/>
	);
}
