import { createBrowserDirectoryUiContract } from "./browser-directory-ui-contract-fixture";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { zipSync } from "fflate";
import type { RoomRenderTheme } from "../../src/adapters/renderer/three-dimensional-room-palette";
import { captureTelegramHostSdk, createTelegramBrowserSignals } from "../../src/adapters/telegram/host-environment";
import { EditorApp } from "../../src/app/editor-app";
import {
	createTelegramRuntime,
	type TelegramRuntime,
} from "../../src/app/telegram-runtime";
import { approveTelegramRelease } from "../../src/app/telegram-release-preflight";
import {
	browserBinaryChecksum,
	browserChecksum,
	browserIds,
	browserStorageEstimate,
} from "../../src/app/browser-ports";
import { createRegisteredRuntimePortablePorts } from "../../src/adapters/portable-backup/registered-runtime-portable";
import { exportRecoveryDraft } from "../../src/app/project-recovery";
import { canonicalProjectSerializer } from "../../src/application/create-project";
import { encodeLocalProjectJson } from "../../src/domain/project-json-transfer";
import { createInitialProject } from "../../src/domain/initial-project";
import type { AddWallSegmentInput } from "../../src/domain/add-wall-segment";
import { createHostFileBridge } from "../../src/adapters/telegram/host-file-bridge";
import type { VerifiedTelegramScope } from "../../src/adapters/telegram/signed-launch";
import type { CatalogGatewayPort } from "../../src/application/ports";
import { DRAWING_DIMENSION_PREFERENCES_KEY } from "../../src/ui/drawing-dimension-visibility";
import { setEditorLanguage, type EditorLanguage } from "../../src/ui/editor-language";
import {
	BROWSER_DATABASE,
	rows,
	seedBrowserProject,
	triangleGlb,
} from "./telegram-runtime-ui-support";
import "../../src/ui/global.css";
import { buildRoomInteriorDemo, checkRoomInteriorDemoEdits } from "./room-interior-demo-fixture";

type Scope = "a" | "b";
const scope = (value: Scope) =>
	`tma-v1-${value.repeat(64)}` as VerifiedTelegramScope;
const databaseName = (value: Scope) =>
	`interiors-editor-projects:${scope(value)}`;
const originalGet = Storage.prototype.getItem,
	originalSet = Storage.prototype.setItem;
const originalOpen = IDBFactory.prototype.open;
let browserReads = 0,
	browserWrites = 0,
	browserOpens = 0,
	watchingBrowser = false;
Storage.prototype.getItem = function (key) {
	if (watchingBrowser && key === DRAWING_DIMENSION_PREFERENCES_KEY)
		browserReads++;
	return originalGet.call(this, key);
};
Storage.prototype.setItem = function (key, raw) {
	if (watchingBrowser && key === DRAWING_DIMENSION_PREFERENCES_KEY)
		browserWrites++;
	return originalSet.call(this, key, raw);
};
IDBFactory.prototype.open = function (name, version) {
	if (watchingBrowser && name === BROWSER_DATABASE) browserOpens++;
	return version === undefined
		? originalOpen.call(this, name)
		: originalOpen.call(this, name, version);
};
const clockKey = "fixture:tma-ui:epoch",
	initializedKey = "fixture:tma-ui:initialized",
	cacheName = "fixture-preserved-browser-cache";
let epoch =
	Number(originalGet.call(localStorage, clockKey)) ||
	Date.parse("2026-11-04T17:00:00.000Z");
function capabilities() {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("webgl2");
	const webgl2 = context !== null;
	context?.getExtension("WEBGL_lose_context")?.loseContext();
	return { indexeddb: typeof indexedDB.open === "function", webgl2 };
}
const capsule: unknown = JSON.parse(
	document.getElementById("loaded-release")?.textContent ?? "null",
);
const script = [...document.scripts].find(
	(entry) =>
		new URL(entry.src || location.href).pathname === "/runtime-ui.12345678.js",
);
if (!script) throw new Error("Actual loaded fixture entry is absent");
const checked = approveTelegramRelease({
	capsule,
	loadedEntryPath: new URL(script.src).pathname,
	capabilities: capabilities(),
	secureContext: isSecureContext,
	webLocks: typeof navigator.locks?.request === "function",
	hasControllingWorker: !!navigator.serviceWorker?.controller,
	workerManifest: undefined,
});
if (checked.kind !== "approved")
	throw new Error("Actual fixture HTML preflight rejected");
const approval = checked.approval;
const catalogGateway: CatalogGatewayPort = {
	currentPublication: async () => ({ kind: "unavailable" }),
	resource: async () => ({ kind: "unavailable" }),
};
const sharedFiles: File[] = [];
let androidDownloadEnabled = false;
let encryptedUploads = 0;
let encryptedDownloadRequests = 0;
let localModelFileReads = 0;
let scopeLockHold: { release: () => void; done: Promise<void> } | undefined;
const fileTransfer = {
	...createHostFileBridge({
		maximumBytes: 280 * 1024 * 1024,
		system: {
			canShare: (data) => data.files?.length === 1,
			async share(data) {
				const file = data.files?.[0];
				if (!(file instanceof File))
					throw new Error("Expected actual local File");
				sharedFiles.push(file);
			},
		},
	}),
	encryptedDownload: {
		available: () => androidDownloadEnabled,
		async stage() {
			encryptedUploads++;
			return "/fixture-download";
		},
		async download() {
			return ++encryptedDownloadRequests === 1 ? "cancelled" as const : "requested" as const;
		},
	},
};
let navigable = false;
let localGreyboxCatalog = false;
let browserProtected = false;
const hostBackListeners = new Set<() => void>();
let hostClosingConfirmation = false;
const hostNavigation = {
	subscribeBack(listener: () => void) { hostBackListeners.add(listener); return () => { hostBackListeners.delete(listener); }; },
	setBackVisible() {},
	close() {},
	setClosingConfirmation(enabled: boolean) { hostClosingConfirmation = enabled; },
	setVerticalSwipesEnabled() {},
};
const lifecycleListeners = new Set<() => void>();
let lifecycleSnapshot = { active: true, layoutVersion: 0 };
const hostLifecycle = {
	snapshot: () => lifecycleSnapshot,
	subscribe(listener: () => void) { lifecycleListeners.add(listener); return () => { lifecycleListeners.delete(listener); }; },
};
let runtime: TelegramRuntime | undefined,
	root: Root | undefined,
	activeScope: Scope | undefined;
let fixtureRoomTheme: RoomRenderTheme | undefined;
let disposeFixtureTheme: (() => void) | undefined;

const originalPut = IDBObjectStore.prototype.put;
let failNextProjectWrite = false;
let checksumHold: { readonly match: string; entered: boolean; release: () => void; readonly wait: Promise<void> } | undefined;
async function dispose() {
 browserProtected = false;
	localGreyboxCatalog = false;
	scopeLockHold?.release(); if (scopeLockHold) await scopeLockHold.done; scopeLockHold = undefined;
	IDBObjectStore.prototype.put = originalPut; failNextProjectWrite = false;
	lifecycleSnapshot = { active: true, layoutVersion: lifecycleSnapshot.layoutVersion + 1 };
	checksumHold?.release(); checksumHold = undefined;
	root?.unmount();
	root = undefined;
	const prior = runtime;
	runtime = undefined;
	activeScope = undefined;
	if (prior) await prior.dispose();
}
function fresh(
	value: Scope,
	advanceClock = true,
	databaseMode?: "compatible" | "exact",
	doorHingeMode?: "compatible" | "authoring",
	interiorMode?: "compatible" | "authoring",
) {
	if (advanceClock) epoch += 4_000;
	originalSet.call(localStorage, clockKey, String(epoch));
	const portable = createRegisteredRuntimePortablePorts({
		binaryChecksum: browserBinaryChecksum,
		...(interiorMode === undefined ? {} : { allowTelegramExtendedSchemas: true }),
	});
	return createTelegramRuntime({
		approval,
		scope: scope(value),
		context: {
			databaseMode,
			doorHingeMode,
			...(interiorMode === undefined ? {} : {
				roomInteriorCompatible: true,
				roomInteriorEnabled: interiorMode === "authoring",
			}),
			indexedDb: indexedDB,
			locks: navigator.locks,
			secureContext: isSecureContext,
			crypto,
			sessionStorage,
			localStorage,
			readCapabilities: capabilities,
			async readWorker(signal) {
				if (signal.aborted || navigator.serviceWorker?.controller)
					throw new Error("Unexpected fixture worker context");
				return { hasControllingWorker: false, workerManifest: undefined };
			},
		},
		ports: {
			checksum: { async sha256(text) {
				const hold = checksumHold;
				if (hold && !hold.entered && text.includes(JSON.stringify(hold.match))) { hold.entered = true; await hold.wait; }
				return browserChecksum.sha256(text);
			} },
			binaryChecksum: browserBinaryChecksum,
			ids: browserIds,
			clock: { now: () => new Date(epoch).toISOString() },
			storageEstimate: browserStorageEstimate,
			portable: {
				...portable,
				encoder: { encode: (entries) => zipSync(entries, { level: 0 }) },
			},
		},
	});
}
function render() {
	const current = runtime;
	if (!current) throw new Error("No actual scoped runtime");
	const element = document.getElementById("root");
	if (!element) throw new Error("Missing UI root");
	root = createRoot(element);
	const props = {
		runtime: current,
		catalogGateway,
		roomTheme: fixtureRoomTheme,
		localGreyboxCatalog,
		readReleaseStartupInput: current.readReleaseStartupInput,
		drawingDimensionPreferences: current.drawingDimensions,
		sourceRecovery: current.sourceRecovery,
		...(browserProtected ? { editorStorageNamespace: "browser-registered" as const, navigationProtection: { discardWriterRecoveryAndShowProjects: async () => false } } : { fileTransfer }),
		...(navigable ? { hostNavigation, hostLifecycle } : {}),
	};
	root.render(navigable ? <StrictMode><EditorApp {...props} /></StrictMode> : <EditorApp {...props} />);
}

let directoryContract: ReturnType<typeof createBrowserDirectoryUiContract> | undefined;
const fixture = {
	setAppearance(language: EditorLanguage, colorScheme: RoomRenderTheme["colorScheme"]) {
		disposeFixtureTheme?.();
		setEditorLanguage(language);
		document.documentElement.lang = language;
		const sdk = { colorScheme, initData: "", ready() {}, close() {} };
		const captured = captureTelegramHostSdk(sdk);
		if (!captured) throw new Error("Fixture appearance SDK could not be captured");
		const host = captured.connect({
			...createTelegramBrowserSignals({ window, document }),
			readCurrentSdk: () => sdk,
			onContextChanged: () => undefined,
		});
		fixtureRoomTheme = host.theme?.snapshot();
		disposeFixtureTheme = () => host.dispose();
	},
	async mountDirectoryContract(qualified = true, changeBeforeSubscribe = false, protectedNavigation: boolean | "runtime" = false, canCreateLegacyProject = true, allReadonly: boolean | "partial" | "writable" | "corrupt" | "partial-corrupt" = false) {
		await dispose(); directoryContract = createBrowserDirectoryUiContract(changeBeforeSubscribe, protectedNavigation, canCreateLegacyProject, allReadonly); directoryContract.directory(qualified); const element = document.getElementById("root"); if (!element) throw new Error("No fixture root"); root = createRoot(element); root.render(<StrictMode>{directoryContract.element}</StrictMode>);
	},
	pauseDirectoryReadonlyExport() { if (!directoryContract) throw new Error("No directory contract"); directoryContract.pauseReadonlyExport(); },
	releaseDirectoryReadonlyExport() { if (!directoryContract) throw new Error("No directory contract"); directoryContract.releaseReadonlyExport(); },
	abortReadonlyDirectorySource(namespace:"legacy"|"browser-registered") { if (!directoryContract) throw new Error("No directory contract"); directoryContract.abortReadonlySource(namespace); },
	updateDirectorySourceAdmission(allowed: boolean, recovery: import("../../src/app/release-startup").ReleaseRecoveryRecord | undefined) { if (!directoryContract) throw new Error("No directory contract"); directoryContract.sourceAdmission(allowed, recovery); },
	setLegacyDirectoryRecovery(recovery: import("../../src/app/release-startup").ReleaseRecoveryRecord | undefined, notify = true) { if (!directoryContract) throw new Error("No directory contract"); directoryContract.setLegacyRecovery(recovery, notify); },
	directoryPendingHistoryExit() { if (!directoryContract) throw new Error("No directory contract"); directoryContract.pendingHistoryExit(); },
	directoryRecoveryExit() { if (!directoryContract) throw new Error("No directory contract"); directoryContract.recoverableExit(); },
	directoryContractCalls: () => directoryContract?.calls() ?? [],
	selectDirectoryContract(name: string, rename = true, namespace?: "legacy" | "browser-registered") { if (!directoryContract) throw new Error("No directory contract"); directoryContract.select(name, rename, namespace); },
	partialDirectoryContract() { if (!directoryContract) throw new Error("No directory contract"); directoryContract.partial("browser-registered"); },
	async holdScopeLock(value: Scope) {
		if (scopeLockHold) throw new Error("Scope lock already held");
		let release: () => void = () => undefined, granted: () => void = () => undefined;
		const hold = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { granted = resolve; });
		const done = navigator.locks.request(`interiors-tma-storage-v1:${scope(value)}`, { mode: "exclusive" }, async () => { granted(); await hold; });
		scopeLockHold = { release, done }; await ready;
	},
	async releaseScopeLock() { const hold = scopeLockHold; if (!hold) return; hold.release(); await hold.done; if (scopeLockHold === hold) scopeLockHold = undefined; },

	async removeCurrentResource(value: Scope) {
		await dispose();
		const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = originalOpen.call(indexedDB, databaseName(value)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
		try { await new Promise<void>((resolve, reject) => { const transaction = database.transaction("resources", "readwrite"); transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error); const keys = transaction.objectStore("resources").getAllKeys(); keys.onsuccess = () => { if (keys.result.length !== 1) { transaction.abort(); return; } transaction.objectStore("resources").delete(keys.result[0]); }; }); } finally { database.close(); }
		navigable = true; runtime = fresh(value); activeScope = value; render();
	},
	async allScopedRows(value: Scope) {
		const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = originalOpen.call(indexedDB, databaseName(value)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
		try {
			const names = [...database.objectStoreNames], transaction = database.transaction(names, "readonly"), records: Record<string, unknown[]> = {};
			await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error); for (const name of names) { const request = transaction.objectStore(name).getAll(); request.onsuccess = () => { records[name] = request.result; }; } });
			async function own(value: unknown): Promise<unknown> { if (value instanceof Blob) return { blobBytes: [...new Uint8Array(await value.arrayBuffer())] }; if (Array.isArray(value)) return Promise.all(value.map(own)); if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await own(item)] as const))); return value; }
			return own(records);
		} finally { database.close(); }
	},
	async selectRepairFiles(sizes?: readonly number[]) {
		const input = document.querySelector<HTMLInputElement>('input[aria-label="Выбрать исходные GLB-модели для восстановления"]'); if (!input) throw new Error("No actual repair control");
		const transfer = new DataTransfer();
		for (const size of sizes ?? [-1]) { const data = size === -1 ? triangleGlb() : new Uint8Array(size), file = new File([data], "exact.glb"); const read = file.arrayBuffer.bind(file); file.arrayBuffer = async () => { localModelFileReads++; return read(); }; transfer.items.add(file); }
		input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true }));
	},
	async currentBackupBytes() {
		const result = await runtime?.controller.exportProjectTransfer();
		if (result?.kind !== "ready") throw new Error("Expected a complete backup of the current project");
		return [...result.bytes];
	},
	selectRepairBackup(bytes: readonly number[]) {
		const input = document.querySelector<HTMLInputElement>('input[aria-label="Выбрать резервную копию для восстановления моделей"]');
		if (!input) throw new Error("No backup repair control");
		const transfer = new DataTransfer();
		transfer.items.add(new File([Uint8Array.from(bytes)], "project.interiors", { type: "application/octet-stream" }));
		input.files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	},

	writerRecoveryName: () => runtime?.controller.writerRecoveryCopy()?.project.name,
	localModelFileReads: () => localModelFileReads,
	async selectModelFile(kind: "glb" | "fbx", size: number) {
		const file = new File([new Uint8Array(size)], kind === "glb" ? "bounded.glb" : "blocked.fbx");
		const original = file.arrayBuffer.bind(file);
		file.arrayBuffer = async () => { localModelFileReads++; return original(); };
		const input = document.querySelector<HTMLInputElement>(kind === "glb" ? '[data-testid="custom-glb-import-input"]' : '[data-testid="fbx-import-input"]');
		if (!input) return;
		const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
		await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	},

	hasActivePublication: () => runtime?.controller.hasPendingPublication() ?? false,
	setHostActivity(active: boolean) { lifecycleSnapshot = { ...lifecycleSnapshot, active }; for (const listener of [...lifecycleListeners]) listener(); },
	hostLifecycleListenerCount: () => lifecycleListeners.size,
	changeHostLayout() { lifecycleSnapshot = { ...lifecycleSnapshot, layoutVersion: lifecycleSnapshot.layoutVersion + 1 }; for (const listener of [...lifecycleListeners]) listener(); },
	failNextScopedProjectWrite() {
		failNextProjectWrite = true;
		IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
			if (failNextProjectWrite && this.name === "projects" && activeScope && this.transaction.db.name === databaseName(activeScope)) {
				failNextProjectWrite = false;
				throw new DOMException("Controlled native write boundary quota failure", "QuotaExceededError");
			}
			return originalPut.call(this, value, key);
		};
	},
	holdPublicationChecksum(match: string) {
		let release = () => undefined as void;
		const wait = new Promise<void>((resolve) => { release = resolve; });
		checksumHold = { match, entered: false, release, wait };
	},
	checksumIsHeld: () => checksumHold?.entered === true,
	releasePublicationChecksum() { checksumHold?.release(); checksumHold = undefined; },
	async mountConcurrentNavigable(value: Scope) {
		await dispose(); navigable = true; runtime = fresh(value, false); activeScope = value; render();
	},
	async mountNavigable(value: Scope, useLocalGreyboxCatalog = false, databaseMode?: "compatible" | "exact", doorHingeMode?: "compatible" | "authoring", interiorMode?: "compatible" | "authoring") {
		await dispose(); localGreyboxCatalog = useLocalGreyboxCatalog; navigable = true; runtime = fresh(value, true, databaseMode, doorHingeMode, interiorMode); activeScope = value; render();
	},
	async databaseVersion(value: Scope) {
		return (await indexedDB.databases()).find(entry => entry.name === databaseName(value))?.version;
	},
	async prepareVersionFive(value: Scope) {
		await dispose();
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(databaseName(value), 5);
			request.onupgradeneeded = (event) => {
				if (event.oldVersion !== 4) request.transaction?.abort();
			};
			request.onsuccess = () => {
				request.result.close();
				resolve();
			};
			request.onerror = () => reject(request.error);
		});
	},
	async authorInterior(command: import("../../src/domain/interior-project").InteriorCommand) {
		if (!runtime) throw new Error("No active runtime");
		const result = await runtime.controller.applyInteriorCommand(command);
		if (result.kind !== "durable" && result.kind !== "unchanged") {
			throw new Error(`Interior command rejected: ${JSON.stringify(result)}`);
		}
	},
	hostBack() { for (const listener of [...hostBackListeners]) listener(); },
	hostBackSubscribed: () => hostBackListeners.size > 0,
	hostBackListenerCount: () => hostBackListeners.size,
	hostClosingWarning: () => hostClosingConfirmation,

	async reselectUnregisteredProjectJson() {
		const project = createInitialProject({ projectId: "unregistered-json", levelId: "json-level", name: "Unregistered JSON", createdAt: "2026-11-04T17:00:00.000Z" });
		const input = document.querySelector<HTMLInputElement>('input[aria-label="Импортировать проект"]');
		if (!input) throw new Error("Missing actual import input");
		const transfer = new DataTransfer();
		transfer.items.add(new File([await encodeLocalProjectJson(project, (text) => browserChecksum.sha256(text))], "unregistered.interiors", { type: "application/json" }));
		input.files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	},
	async restoreEmptyRecoveryDraft() {
		if (!runtime) throw new Error("No actual scoped runtime");
		const project = createInitialProject({ projectId: "unpublished-original", levelId: "draft-level", name: "Recovered empty draft", createdAt: "2026-11-04T17:00:00.000Z" });
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const draft = await exportRecoveryDraft({ project, revision: { schemaVersion: 1, projectId: project.projectId, revisionId: "unpublished-revision", createdAt: project.updatedAt, serializedProject, checksum: await browserChecksum.sha256(serializedProject) } });
		if (draft.kind !== "ready") throw new Error("Expected complete recovery input");
		const original = draft.bytes.slice();
		const result = await runtime.controller.importRecoveryDraft(draft.bytes);
		return { result, sourceProject: project, sourceUnchanged: original.every((byte, index) => byte === draft.bytes[index]), state: runtime.controller.snapshot() };
	},
	async initialize() {
		if (!originalGet.call(localStorage, initializedKey)) {
			await seedBrowserProject();
			originalSet.call(
				localStorage,
				DRAWING_DIMENSION_PREFERENCES_KEY,
				JSON.stringify({
					version: 1,
					visible: {
						wall: false,
						opening: true,
						pier: false,
						overall: true,
						"room-clear": false,
					},
				}),
			);
			await (await caches.open(cacheName)).put(
				"/preserved-browser.txt",
				new Response("preserved browser cache"),
			);
			originalSet.call(localStorage, initializedKey, "true");
		}
		watchingBrowser = true;
	},
	async mount(value: Scope) {
		await dispose();
		navigable = false;
		runtime = fresh(value);
		activeScope = value;
		render();
	},
	dispose,
	async corruptCurrentSource(value: Scope, serializedProject: string) {
		if (activeScope !== value || !runtime) throw new Error("Expected active fixture scope");
		const state = runtime.controller.snapshot();
		if (!("project" in state) || !state.project || !("revisionId" in state)) throw new Error("Expected Durable source");
		const projectId = state.project.projectId;
		await dispose();
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = originalOpen.call(indexedDB, databaseName(value));
			request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
		});
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = database.transaction(["projects", "revisions"], "readwrite");
				transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error);
				const pointer = transaction.objectStore("projects").get(projectId);
				pointer.onsuccess = () => {
					const request = transaction.objectStore("revisions").get(pointer.result.currentRevisionId);
					request.onsuccess = () => {
						const row = request.result;
						row.candidate.revision.serializedProject = serializedProject;
						transaction.objectStore("revisions").put(row);
					};
				};
			});
		} finally { database.close(); }
		runtime = fresh(value); activeScope = value; render();
	},

	semanticRows: (value: Scope) => rows(databaseName(value)),
	async browserSnapshot() {
		const names = await caches.keys();
		const cached = names.includes(cacheName)
			? await (await caches.open(cacheName)).match("/preserved-browser.txt")
			: undefined;
		return {
			rows: await rows(BROWSER_DATABASE),
			preference: originalGet.call(
				localStorage,
				DRAWING_DIMENSION_PREFERENCES_KEY,
			),
			cacheNames: names,
			cached: await cached?.text(),
			browserReads,
			browserWrites,
			browserOpens,
		};
	},
	sharedFileCount: () => sharedFiles.length,
	enableEncryptedDownload() { androidDownloadEnabled = true; },
	encryptedTransferCounts: () => ({ uploads: encryptedUploads, requests: encryptedDownloadRequests }),
	reselectSharedFile(index: number) {
		const file = sharedFiles[index];
		if (!file) throw new Error("No handed off File");
		const input = document.querySelector<HTMLInputElement>(
			'input[type="file"][aria-label="Импортировать проект"]',
		);
		if (!input) throw new Error("Missing actual import input");
		const selected = new DataTransfer();
		selected.items.add(file);
		input.files = selected.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	},
	async sharedFile(index: number) {
		const file = sharedFiles[index];
		if (!file) throw new Error("No handed off File");
		return {
			name: file.name,
			mimeType: file.type,
			bytes: [...new Uint8Array(await file.arrayBuffer())],
		};
	},
	state() {
		if (!runtime) throw new Error("No active runtime");
		return runtime.controller.snapshot();
	},
	async createRoomInteriorDemo() {
		if (!runtime) throw new Error("No active runtime");
		return buildRoomInteriorDemo(runtime.controller);
	},
	async runRoomInteriorDemoEdits() {
		if (!runtime) throw new Error("No active runtime");
		return checkRoomInteriorDemoEdits(runtime.controller);
	},
	async addExistingWallLight(wallSegmentId: string) {
		if (!runtime) throw new Error("No active runtime");
		const result = await runtime.controller.createParametricWallItem({
			wallSegmentId, label: "Подсветка зеркала", offsetMm: 1000, elevationMm: 1500,
			widthMm: 450, depthMm: 120, heightMm: 80, side: "left", color: "#416b91",
		});
		if (result.kind !== "durable") throw new Error(`Wall light fixture failed: ${result.kind}`);
	},
	async addRotatedTable(roomId: string) {
		if (!runtime) throw new Error("No active runtime");
		const result = await runtime.controller.createParametricFloorItem({
			roomId, label: "Стол", xMm: 350, zMm: 1500,
			widthMm: 2400, depthMm: 400, heightMm: 750, yawStep: 2, color: "#8C7B6B",
		});
		if (result.kind !== "durable") throw new Error(`Rotated table fixture failed: ${result.kind}`);
	},
	async addWall(input: AddWallSegmentInput) {
		if (!runtime) throw new Error("No active runtime");
		const result = await runtime.controller.addGeneralWall(input);
		if (result.kind !== "durable") throw new Error(`Wall was not saved: ${result.kind}`);
	},
	async splitWall(wallSegmentId: string, pointMm: { xMm: number; zMm: number }) {
		if (!runtime) throw new Error("No active runtime");
		const result = await runtime.controller.splitGeneralWall({ wallSegmentId, pointMm });
		if (result.kind !== "durable") throw new Error(`Wall split was not saved: ${result.kind}`);
	},
	async scopedRaw(value: Scope) {
		return originalGet.call(
			localStorage,
			`interiors-tma-context-v1:${scope(value)}:drawing-dimensions`,
		);
	},
	async prepareUpperCustom(value: Scope, resourceAddress: "uppercase" | "lowercase" = "uppercase") {
		await dispose();
		runtime = fresh(value);
		activeScope = value;
		const actual = runtime;
		const admitted = await actual.releaseStartup.handshake(
			await actual.readReleaseStartupInput(),
		);
		if (admitted.kind !== "writable")
			throw new Error("Actual custom fixture admission failed");
		const created = await actual.controller.create("Uppercase local model");
		if (created.kind !== "durable")
			throw new Error("Actual Project create failed");
		const room = await actual.controller.configureRectangularRoom({
			widthMm: "4000",
			depthMm: "3000",
			heightMm: "2600",
		});
		if (room.kind !== "durable") throw new Error("Actual room save failed");
		const bytes = triangleGlb();
		const lower = await browserBinaryChecksum.sha256Bytes(bytes);
		const resourceHash = resourceAddress === "uppercase" ? lower.toUpperCase() : lower;
		if (resourceAddress === "uppercase" && resourceHash === lower)
			throw new Error("Expected actual hash-case distinction");
		const asset = {
			assetDefinitionId: "local-upper-triangle",
			displayName: "Local upper triangle",
			format: "glb" as const,
			resourceHash,
			byteLength: bytes.byteLength,
			widthMm: 700,
			depthMm: 600,
			heightMm: 800,
		};
		const library = await actual.controller.registerCustomGlbLibraryAsset({
			asset,
			glbBytes: bytes,
		});
		if (library.kind !== "registered")
			throw new Error(`Actual upper library admission failed: ${library.kind}`);
		const state = actual.controller.snapshot();
		if (
			!("project" in state) ||
			!state.project ||
			state.project.schemaVersion !== 1
		)
			throw new Error("Missing actual V1 Room");
		const placed = await actual.controller.createCustomGlbFloorItem({
			asset,
			glbBytes: bytes,
			roomId: state.project.level.rooms[0]?.roomId ?? "",
			xMm: 1500,
			zMm: 1500,
			color: "#716796",
		});
		if (placed.kind !== "durable")
			throw new Error(`Actual upper placement failed: ${placed.kind}`);
		const read = await actual.controller.readCustomGlbResource(resourceHash);
		if (!read) throw new Error("Actual pin resource missing");
		return {
			projectId: created.projectId,
			resourceHash,
			actualDigest: await browserBinaryChecksum.sha256Bytes(read),
			byteLength: read.length,
			sourceBytes: [...bytes],
			pinnedBytes: [...read],
			before: await rows(databaseName(value)),
		};
	},
	mountPreparedBrowserProtected(value: Scope) {
 if (!runtime || activeScope !== value || root) throw new Error("No prepared actual runtime");
 navigable = false; browserProtected = true; render();
 },
	mountPreparedNavigable(value: Scope, useLocalGreyboxCatalog = false) {
		if (!runtime || activeScope !== value || root) throw new Error("No prepared actual runtime");
		localGreyboxCatalog = useLocalGreyboxCatalog;
		navigable = true; render();
	},
	mountPrepared(value: Scope) {
		if (!runtime || activeScope !== value || root)
			throw new Error("No prepared actual runtime");
		render();
	},
};
declare global {
	interface Window {
		readonly __telegramRuntimeUi: typeof fixture;
	}
}
Object.defineProperty(window, "__telegramRuntimeUi", { value: fixture });
