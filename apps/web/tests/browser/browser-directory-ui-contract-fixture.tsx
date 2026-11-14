import type { ReleaseRecoveryRecord } from "../../src/app/release-startup";
import { BrowserRuntimeEditor } from "../../src/app/browser-runtime-editor";
import type { BrowserEditorInstanceSnapshot } from "../../src/app/browser-editor-instance";
import type { ProjectController, ProjectScreenState } from "../../src/app/project-controller";
import type { DurablePublicationCandidate, ProjectOpenOptions, ProjectStorageNamespace } from "../../src/application/ports";
import { createInitialProject } from "../../src/domain/initial-project";

/** UI-only contract double: no database, publication, signed host or file proof. */
export function createBrowserDirectoryUiContract(changeBeforeSubscribe = false, protectedNavigation: boolean | "runtime" = false, canCreateLegacyProject = true, readonlyMode: boolean | "partial" | "writable" | "corrupt" | "partial-corrupt" = false) {
 const allReadonly=readonlyMode===true,partialReadonly=readonlyMode==="partial"||readonlyMode==="partial-corrupt",corruptReadonly=readonlyMode==="corrupt"||readonlyMode==="partial-corrupt";
	let state: ProjectScreenState;
	let instance: BrowserEditorInstanceSnapshot = { key: "directory-contract:0" };
	let generation = 0;
 let sourceRevision = 0;
 const sourceListeners = new Set<() => void>();
 let legacyRecovery: ReleaseRecoveryRecord | undefined;
 let writerCopy: DurablePublicationCandidate | undefined;
 const readonlyLifetime=new AbortController(),readonlyLegacy=new AbortController(),readonlyRegistered=new AbortController();
 let readonlyExportGate: Promise<void> | undefined, resumeReadonlyExport: (() => void) | undefined;
 const readonlyProjects={signal:readonlyLifetime.signal,getSourceSignal:(namespace:ProjectStorageNamespace)=>namespace==="legacy"?readonlyLegacy.signal:readonlyRegistered.signal,
 getSourceRecovery:(namespace:ProjectStorageNamespace)=>namespace==="browser-registered"&&corruptReadonly?{listRecoverySources:async()=>[{kind:"unverified-source" as const,projectId:"broken-private",revisionId:"broken-rev"}],readRecoverySource:async(projectId:string,revisionId:string)=>projectId==="broken-private"&&revisionId==="broken-rev"?{kind:"unverified-source" as const,projectId,revisionId,serializedProject:"bad-private-raw"}:undefined}:namespace==="legacy"?{listRecoverySources:async()=>[{kind:"unverified-source" as const,projectId:"raw-old",revisionId:"raw-revision"}],readRecoverySource:async(projectId:string,revisionId:string)=>projectId==="raw-old"&&revisionId==="raw-revision"?{kind:"unverified-source" as const,projectId,revisionId,serializedProject:"  \ud800\u0000original\n "}:undefined}:undefined,
 readDirectory:async()=>{capture("readonly-list",[]);return {kind:"projects" as const,projects:[{storageNamespace:"legacy" as const,name:"Одинаковый план",projectId:"same-id",revisionId:"same-revision",updatedAt:"2026-11-05"},{storageNamespace:"browser-registered" as const,name:"Одинаковый план",projectId:"same-id",revisionId:"same-revision",updatedAt:"2026-11-05"}],storageSources:[{storageNamespace:"legacy" as const,kind:"available" as const},{storageNamespace:"browser-registered" as const,kind:"available" as const}]};},
 exportBackup:async(address:unknown,format:string)=>{capture("readonly-export",[address,format]);if(readonlyExportGate)await readonlyExportGate;return {kind:"ready" as const,bytes:new Uint8Array([1,2,3]),filename:"ui-only.interiors",mimeType:"application/zip" as const};}};
 let pendingIdentity: ReturnType<ProjectController["pendingPublicationIdentity"]>;
	const stateListeners = new Set<(state: ProjectScreenState) => void>(), instanceListeners = new Set<() => void>();
	const calls: { method: string; arguments: unknown[] }[] = [];
	const capture = (method: string, args: unknown[]) => { calls.push({ method, arguments: args }); };
	function directory(qualified = true) {
		const summary = { name: "Одинаковый план", projectId: "same-id", revisionId: "same-revision", updatedAt: "2026-11-04T12:00:00.000Z" };
		state = { kind: "projects", ...(corruptReadonly?{recoveryNeeded:true as const}:{}), projects: qualified ? (partialReadonly ? [{...summary,storageNamespace:"browser-registered"}] : [{ ...summary, storageNamespace: "legacy" }, { ...summary, storageNamespace: "browser-registered" }]) : [summary], ...(qualified ? { storageSources: [{ storageNamespace: "legacy" as const, kind: partialReadonly ? "unavailable" as const : "available" as const }, { storageNamespace: "browser-registered" as const, kind: "available" as const }] } : {}) };
		for (const listener of stateListeners) listener(state);
	}
	function selected(name: string, rename: boolean, storageNamespace: ProjectStorageNamespace = "browser-registered") {
		const project = createInitialProject({ name, projectId: "same-id", levelId: "same-level", createdAt: "2026-11-04T12:00:00.000Z" });
		state = { kind: "saved", project, projectName: name, revisionId: "same-revision" };
		instance = { key: `directory-contract:${++generation}`, storageNamespace, ...(rename ? { requestedRenameProjectId: project.projectId } : {}) };
		for (const listener of instanceListeners) listener();
		for (const listener of stateListeners) listener(state);
	}
	directory();
	const controller = {
		snapshot: () => state,
		subscribe(listener: (state: ProjectScreenState) => void) { if (changeBeforeSubscribe) { changeBeforeSubscribe = false; state = { kind: "projects", projects: [], storageSources: [{ storageNamespace: "browser-registered", kind: "unavailable" }] }; } stateListeners.add(listener); return () => { stateListeners.delete(listener); }; },
		open: async () => undefined,
		showProjects: async () => { capture("showProjects", []); directory(); },
		openProject: async (...args: [string, ProjectOpenOptions?]) => { capture("openProject", args); if (args[1]?.initialAction === "rename") selected(args[1].storageNamespace === "browser-registered" ? "Перенесённый план" : "Обычный план", true); },
		permanentlyDeleteProjectFromDirectory: async (...args: unknown[]) => { capture("delete", args); return { kind: "permanently-deleted" }; },
		exportRecoveryDraft: async () => { capture("recovery-export", []); return { kind: "rejected", reasonCode: "RECOVERY_DRAFT_UNSUPPORTED" }; },
        exportProjectTransfer: async (...args: unknown[]) => { capture("export", args); return { kind: "not-ready" }; },
		exportRegisteredProjectTransfer: async (...args: unknown[]) => { capture("registered-export", args); return { kind: "not-ready" }; },
		renameProject: async (...args: unknown[]) => { capture("rename", args); return { kind: "durable" }; },
		sessionHistory: () => ({ canUndo: false, canRedo: false }),
		sessionHistoryCommandLabels: () => undefined,
		writerAccess: () => writerCopy ? ({ kind: "read-only", reasonCode: "WRITER_LEASE_HELD" }) : ({ kind: "not-ready" }),
		writerRecoveryCopy: () => writerCopy,
 pendingPublicationIdentity: () => pendingIdentity,
		refreshWriterLeaseAccess: async () => undefined,
		refreshSessionHistoryIntegrity: async () => undefined,
		listCustomGlbLibraryAssets: async () => [],
		storagePressure: async () => ({ kind: "unavailable" }),
		persistenceRetryPolicy: () => "allowed",
		hasPendingPublication: () => false,
	} as unknown as ProjectController;
 const protection={discardWriterRecoveryAndShowProjects:async(expected:DurablePublicationCandidate)=>{capture("confirmedDiscard",[expected.project.name]);if(writerCopy!==expected)return false;writerCopy=undefined;directory();return true;}};
	const runtime = { ...(protectedNavigation==="runtime"?{navigationProtection:protection}:{}), ...(readonlyMode!==false?{readonlyProjects}:{}), ...(partialReadonly?{getReadonlyProjectSources:()=>["legacy"] as const}:{}), controller, getEditorInstanceSnapshot: () => instance, subscribeEditorInstance: (listener: () => void) => subscribe(listener), getStartupSourcesRevision: () => sourceRevision, subscribeStartupSources: (listener: () => void) => { sourceListeners.add(listener); return () => { sourceListeners.delete(listener); }; }, getLegacyStartupRecovery: () => legacyRecovery, canCreateLegacyProject: () => canCreateLegacyProject, releaseStartup: { handshake: async () => allReadonly ? ({kind:"read-only/exportable" as const,recovery:{}}) : ({ kind: "writable" as const }) } };
	const gateway = { currentPublication: async () => ({ kind: "unavailable" as const }), resource: async () => ({ kind: "unavailable" as const }) };
	const startup = async () => ({ capabilities: { indexeddb: true, webgl2: true }, shellManifest: undefined, workerManifest: undefined });
	const subscribe = (listener: () => void) => { instanceListeners.add(listener); return () => { instanceListeners.delete(listener); }; };
	function Surface() {
		return <BrowserRuntimeEditor runtime={runtime} catalogGateway={gateway} readReleaseStartupInput={startup} registeredTransferExport {...(protectedNavigation===true ? { navigationProtection: protection } : {})} />;
	}
	return { element: <Surface />, pauseReadonlyExport() { if (readonlyExportGate) throw new Error("Already held"); readonlyExportGate = new Promise<void>(resolve => { resumeReadonlyExport = () => { readonlyExportGate = undefined; resumeReadonlyExport = undefined; resolve(); }; }); }, releaseReadonlyExport() { resumeReadonlyExport?.(); }, abortReadonlySource(namespace:ProjectStorageNamespace){(namespace==="legacy"?readonlyLegacy:readonlyRegistered).abort();}, sourceAdmission(allowed: boolean, recovery: ReleaseRecoveryRecord | undefined) { canCreateLegacyProject = allowed; legacyRecovery = recovery; sourceRevision++; for (const listener of sourceListeners) listener(); }, setLegacyRecovery(recovery: ReleaseRecoveryRecord | undefined, notify = true) { legacyRecovery = recovery; if (notify) { state = { ...state }; for (const listener of stateListeners) listener(state); } }, pendingHistoryExit() { selected("План с ожидающей историей", false); pendingIdentity = { projectId: "same-id", revisionId: "history-target", checksum: "b".repeat(64) }; for (const listener of stateListeners) listener(state); }, recoverableExit() { selected("Сохранённый план", false); const project = createInitialProject({ name: "Несохранённая копия", projectId: "different-import-id", levelId: "level", createdAt: "2026-11-05T00:00:00.000Z" }); writerCopy = { project, revision: { projectId: project.projectId, revisionId: "pending-revision", schemaVersion: 1, serializedProject: JSON.stringify(project), checksum: "a".repeat(64), createdAt: project.createdAt } }; for (const listener of stateListeners) listener(state); }, calls: () => calls, directory, select(name: string, rename = true, namespace?: ProjectStorageNamespace) { selected(name, rename, namespace); }, partial(namespace: ProjectStorageNamespace) { state = { kind: "projects", projects: [], storageSources: [{ storageNamespace: namespace, kind: "unavailable" }] }; for (const listener of stateListeners) listener(state); } };
}
