import { useEffect, useState } from "react";
import { HttpCatalogGateway } from "../adapters/catalog/http-catalog-gateway";
import { BrowserReadonlyProjects } from "../ui/browser-readonly-projects";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../adapters/portable-backup/portable-backup-read-render-smoke";
import { createRegisteredRuntimePortablePorts } from "../adapters/portable-backup/registered-runtime-portable";
import {
	browserBinaryChecksum,
	browserChecksum,
	browserClock,
	browserIds,
	browserStorageEstimate,
} from "./browser-ports";
import {
	type BrowserReadonlyProjectsRuntime,
	createBrowserReadonlyProjects,
} from "./browser-readonly-projects";
import {
	type BrowserRegisteredRuntime,
	createBrowserRegisteredRuntime,
} from "./browser-registered-runtime";
import { createBrowserRuntime } from "./browser-runtime";
import { BrowserRuntimeEditor } from "./browser-runtime-editor";
import type { EditorAppProps } from "./editor-app";
import { createProductionRuntime } from "./production-app";
import type {
	ReleaseRuntimeCapabilities,
	ReleaseStartupInput,
} from "./release-startup";

// A browser context owns one runtime, including under React StrictMode.
// The shared editor never chooses a browser writer or storage context on import.
const legacy = createProductionRuntime();
const indexedDb = existingBrowserStorage();
function makeReadonlyProjects(): BrowserReadonlyProjectsRuntime | undefined {
	try {
		const portable = createRegisteredRuntimePortablePorts({
			binaryChecksum: browserBinaryChecksum,
		});
		return createBrowserReadonlyProjects({
			technical: {
				indexedDb: indexedDb ?? {
					open: () => {
						throw new Error("Browser storage is unavailable");
					},
				},
				secureContext: window.isSecureContext === true,
			},
			readReleaseStartupInput,
			checksum: browserChecksum,
			binaryChecksum: browserBinaryChecksum,
			portable: {
				legacyEncoder: new FflatePortableBackupEncoder(),
				legacySmoke: new PortableBackupReadRenderSmokeCheck({
					checksum: browserBinaryChecksum,
				}),
				registeredWriter: portable.writer,
				registeredSmoke: portable.smoke,
			},
		});
	} catch {
		// Read admission is independent of each writer and never changes legacy startup.
	}
}
const readonlyProjects = makeReadonlyProjects();
let registered: BrowserRegisteredRuntime | undefined;
try {
	if (indexedDb) {
		registered = createBrowserRegisteredRuntime({
			context: {
				indexedDb,
				locks: navigator.locks,
				secureContext: window.isSecureContext === true,
				crypto: window.crypto,
				sessionStorage: window.sessionStorage,
				navigationType: (
					window.performance.getEntriesByType("navigation")[0] as
						| PerformanceNavigationTiming
						| undefined
				)?.type,
				readReleaseStartupInput,
			},
			ports: {
				checksum: browserChecksum,
				binaryChecksum: browserBinaryChecksum,
				clock: browserClock,
				ids: browserIds,
				storageEstimate: browserStorageEstimate,
			},
		});
	}
} catch {
	// Private-context setup failure leaves legacy startup and existing-only recovery available.
}
const runtime = createBrowserRuntime({
	legacy,
	registered,
	readonlyProjects,
	readReleaseStartupInput,
});
const catalogGateway = new HttpCatalogGateway({
	checksum: browserBinaryChecksum,
});

function existingBrowserStorage():
	| (Pick<IDBFactory, "open"> & Partial<Pick<IDBFactory, "databases">>)
	| undefined {
	try {
		const factory = window.indexedDB;
		if (typeof factory?.open !== "function") return undefined;
		return {
			open: factory.open.bind(factory),
			...(typeof factory.databases === "function"
				? { databases: factory.databases.bind(factory) }
				: {}),
		};
	} catch {
		return undefined;
	}
}

function currentCapabilities(): ReleaseRuntimeCapabilities {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("webgl2");
	try {
		return {
			indexeddb: "indexedDB" in window,
			webgl2: context !== null,
		};
	} finally {
		context?.getExtension("WEBGL_lose_context")?.loseContext();
	}
}

async function fetchShellManifest(): Promise<unknown> {
	try {
		const response = await fetch("/release-manifest.json");
		return response.ok ? await response.json() : undefined;
	} catch {
		return undefined;
	}
}

async function requestWorkerManifest(): Promise<{
	readonly hasControllingWorker: boolean;
	readonly workerManifest: unknown | undefined;
}> {
	const worker = navigator.serviceWorker?.controller;
	if (!worker) {
		return { hasControllingWorker: false, workerManifest: undefined };
	}
	if (typeof MessageChannel === "undefined") {
		return { hasControllingWorker: true, workerManifest: undefined };
	}
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		const timeout = window.setTimeout(
			() => resolve({ hasControllingWorker: true, workerManifest: undefined }),
			1_000,
		);
		channel.port1.onmessage = (event) => {
			window.clearTimeout(timeout);
			resolve({
				hasControllingWorker: true,
				workerManifest: event.data?.manifest,
			});
		};
		worker.postMessage({ type: "INTERIORS_RELEASE_MANIFEST" }, [channel.port2]);
	});
}

async function readReleaseStartupInput(): Promise<ReleaseStartupInput> {
	const [shellManifest, worker] = await Promise.all([
		fetchShellManifest(),
		requestWorkerManifest(),
	]);
	return {
		capabilities: currentCapabilities(),
		hasControllingWorker: worker.hasControllingWorker,
		shellManifest,
		workerManifest: worker.workerManifest,
	};
}

export function BrowserEditorApp({
	pwaBrowseCache,
	pwaInstall,
	pwaUpdate,
	onOpenSettings,
}: Pick<EditorAppProps, "pwaBrowseCache" | "pwaInstall" | "pwaUpdate" | "onOpenSettings">) {
	const props: EditorAppProps = {
		registeredTransferImport: true,
		registeredTransferExport: true,
		catalogGateway,
		readReleaseStartupInput,
		runtime,
		pwaBrowseCache,
		pwaInstall,
		pwaUpdate,
		onOpenSettings,
	};
	return <BrowserRuntimeEditor {...props} runtime={runtime} />;
}

export function BrowserProjectBackups() {
	const [source, setSource] = useState<BrowserReadonlyProjectsRuntime | null>();
	useEffect(() => {
		let active = true;
		const reader = makeReadonlyProjects();
		async function open() {
			try {
				const input = await readReleaseStartupInput();
				if (!active) return;
				await reader?.admit(input);
				if (active) setSource(reader ?? null);
			} catch {
				if (active) setSource(null);
			}
		}
		void open();
		return () => {
			active = false;
			void reader?.dispose();
		};
	}, []);
	if (source) return <BrowserReadonlyProjects port={source} sourceRevision={0} />;
	return <p role="status">{source === null ? "Не удалось открыть локальное хранилище." : "Проверяем локальные проекты…"}</p>;
}
