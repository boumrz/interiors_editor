import "../../src/ui/global.css";
import { createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HttpCatalogGateway } from "../../src/adapters/catalog/http-catalog-gateway";
import { BrowserRuntimeEditor } from "../../src/app/browser-runtime-editor";
import { FflatePortableBackupDecoder } from "../../src/adapters/portable-backup/fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "../../src/adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../../src/adapters/portable-backup/portable-backup-read-render-smoke";
import { createRegisteredRuntimePortablePorts } from "../../src/adapters/portable-backup/registered-runtime-portable";
import {
	browserBinaryChecksum,
	browserChecksum,
	browserClock,
	browserIds,
} from "../../src/app/browser-ports";
import { createBrowserReadonlyProjects } from "../../src/app/browser-readonly-projects";
import { createBrowserRegisteredRuntime } from "../../src/app/browser-registered-runtime";
import { createBrowserRuntime } from "../../src/app/browser-runtime";
import { createProductionRuntime } from "../../src/app/production-app";
import type { ProjectController } from "../../src/app/project-controller";
import type { ReleaseStartupInput } from "../../src/app/release-startup";
import { sameBrowserBackupValue } from "../../src/application/browser-backup-representability";
import { canonicalProjectSerializer } from "../../src/application/create-project";
import { createInitialProject } from "../../src/domain/initial-project";
import type { Project } from "../../src/domain/project";
import { triangleGlb } from "./telegram-runtime-ui-support";

const legacyName = "interiors-editor-projects",
	privateName = "interiors-editor-browser-registered";
const input = (readonly = false): ReleaseStartupInput => ({
	capabilities: { indexeddb: true, webgl2: !readonly },
	hasControllingWorker: false,
	workerManifest: undefined,
	shellManifest: {
		version: 1,
		workerProtocolVersion: 1,
		appBuildId: "owned-browser-readonly-native",
		projectSchemas: {
			readable: readonly ? [1, 2] : [1],
			writable: readonly ? [2] : [1],
		},
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		minimumCapabilities: ["indexeddb", "webgl2"],
	},
});
const portable = () =>
	createRegisteredRuntimePortablePorts({
		binaryChecksum: browserBinaryChecksum,
	});
function project(controller: ProjectController): Project {
	const state = controller.snapshot();
	if (
		!("project" in state) ||
		!state.project ||
		state.project.schemaVersion !== 1
	)
		throw new Error("Expected actual V1 Durable Project");
	return state.project;
}
function privateRuntime(read: () => Promise<ReleaseStartupInput>) {
	return createBrowserRegisteredRuntime({
		context: {
			indexedDb: indexedDB,
			locks: navigator.locks,
			secureContext: isSecureContext,
			crypto,
			sessionStorage,
			navigationType: "navigate",
			readReleaseStartupInput: read,
		},
		ports: {
			checksum: browserChecksum,
			binaryChecksum: browserBinaryChecksum,
			clock: browserClock,
			ids: browserIds,
			storageEstimate: { estimateStorage: async () => ({}) },
		},
	});
}
async function seedPrivate(runtime: ReturnType<typeof privateRuntime>) {
	const source = createInitialProject({
		projectId: "11111111-1111-4111-8111-111111111111",
		levelId: "source-level",
		name: "Private readonly source",
		createdAt: "2026-11-05T00:00:00.000Z",
	});
	const file = await portable().writer.encode({
		project: source,
		createdAt: source.createdAt,
		resources: [],
	});
	if (file.kind !== "encoded") throw new Error("Bad source archive");
	const imported = await runtime.controller.importRegisteredPortableBackup(
		file.bytes,
	);
	if (imported.kind !== "durable")
		throw new Error(`Actual private import refused: ${imported.kind}`);
	return imported;
}
async function place(controller: ProjectController) {
	const room = await controller.configureRectangularRoom({
		widthMm: "4000",
		depthMm: "3000",
		heightMm: "2600",
	});
	if (room.kind !== "durable") throw new Error("Actual room refused");
	const bytes = triangleGlb(),
		resourceHash = await browserBinaryChecksum.sha256Bytes(bytes),
		asset = {
			assetDefinitionId: "readonly-model",
			displayName: "Readonly exact model",
			format: "glb" as const,
			resourceHash,
			byteLength: bytes.length,
			widthMm: 700,
			depthMm: 600,
			heightMm: 800,
		};
	const library = await controller.registerCustomGlbLibraryAsset({
		asset,
		glbBytes: bytes,
	});
	if (library.kind !== "registered" && library.kind !== "already-present")
		throw new Error("Actual library refused");
	const placed = await controller.createCustomGlbFloorItem({
		asset,
		glbBytes: bytes,
		roomId: project(controller).level.rooms[0]?.roomId ?? "",
		xMm: 1500,
		zMm: 1500,
		color: "#716796",
	});
	if (placed.kind !== "durable")
		throw new Error(`Actual model mutation refused: ${placed.kind}`);
	return { resourceHash, bytes: [...bytes] };
}
async function normalized(value: unknown): Promise<unknown> {
	if (value === undefined) return { nativeType: "undefined" };
	if (Object.is(value, -0)) return { nativeType: "negative-zero" };
	if (value instanceof Blob)
		return {
			nativeType: "Blob",
			bytes: [...new Uint8Array(await value.arrayBuffer())],
		};
	if (value instanceof ArrayBuffer)
		return { nativeType: "ArrayBuffer", bytes: [...new Uint8Array(value)] };
	if (value === null || typeof value !== "object") return value;
	const entries = await Promise.all(
		Object.entries(value).map(async ([key, part]) => [
			key,
			await normalized(part),
		]),
	);
	return {
		nativeType: Array.isArray(value) ? "Array" : "Object",
		...(Array.isArray(value) ? { length: value.length } : {}),
		entries,
	};
}
async function snapshot() {
	const databases = (await indexedDB.databases())
		.filter(
			(row) =>
				row.name === legacyName ||
				row.name === privateName ||
				row.name === "interiors-editor-custom-assets",
		)
		.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
	const result = [];
	for (const info of databases) {
		const name = info.name;
		if (!name) throw new Error("Unnamed DB");
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(name);
			request.onupgradeneeded = () => request.transaction?.abort();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			const names = [...database.objectStoreNames],
				transaction = database.transaction(names, "readonly"),
				done = new Promise<void>((resolve, reject) => {
					transaction.oncomplete = () => resolve();
					transaction.onabort = () => reject(transaction.error);
				});
			const rows = await Promise.all(
				names.map(async (name) => ({
					name,
					rows: await new Promise<unknown[]>((resolve, reject) => {
						const request = transaction.objectStore(name).getAll();
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					}),
				})),
			);
			await done;
			result.push({
				name,
				version: database.version,
				rows: await normalized(rows),
			});
		} finally {
			database.close();
		}
	}
	return result;
}
function observe(allNative = false) {
	const nativeOpen = indexedDB.open.bind(indexedDB),
		handles = new WeakSet<IDBDatabase>(),
		opens: { name: string; version: number | undefined }[] = [],
		modes: IDBTransactionMode[] = [],
		upgrades: string[] = [];
	const nativeTransaction = IDBDatabase.prototype.transaction;
	IDBDatabase.prototype.transaction = function (
		this: IDBDatabase,
		...args: Parameters<IDBDatabase["transaction"]>
	) {
		if (allNative || handles.has(this)) modes.push(args[1] ?? "readonly");
		return Reflect.apply(nativeTransaction, this, args);
	};
	const descriptor = Object.getOwnPropertyDescriptor(indexedDB, "open");
	const trackedOpen = (name: string, version?: number) => {
		opens.push({ name, version });
		const request =
			version === undefined ? nativeOpen(name) : nativeOpen(name, version);
		request.addEventListener("upgradeneeded", () => upgrades.push(name));
		request.addEventListener("success", () => handles.add(request.result));
		return request;
	};
	if (allNative)
		Object.defineProperty(indexedDB, "open", {
			configurable: true,
			writable: true,
			value: trackedOpen,
		});
	return {
		technical: {
			secureContext: isSecureContext,
			indexedDb: {
				databases: indexedDB.databases.bind(indexedDB),
				open: trackedOpen,
			},
		},
		opens,
		modes,
		upgrades,
		restore() {
			IDBDatabase.prototype.transaction = nativeTransaction;
			if (allNative) {
				if (descriptor) Object.defineProperty(indexedDB, "open", descriptor);
				else Reflect.deleteProperty(indexedDB, "open");
			}
		},
	};
}

function provider(
	read: () => Promise<ReleaseStartupInput>,
	observer: ReturnType<typeof observe>,
) {
	const ports = portable();
	return createBrowserReadonlyProjects({
		technical: observer.technical,
		readReleaseStartupInput: read,
		checksum: browserChecksum,
		binaryChecksum: browserBinaryChecksum,
		portable: {
			legacyEncoder: new FflatePortableBackupEncoder(),
			legacySmoke: new PortableBackupReadRenderSmokeCheck({
				checksum: browserBinaryChecksum,
			}),
			registeredWriter: ports.writer,
			registeredSmoke: ports.smoke,
		},
	});
}
async function decoded(
	bytes: Uint8Array,
	format: "legacy" | "registered",
	expected: Project,
) {
	const value =
		format === "legacy"
			? await new FflatePortableBackupDecoder(browserBinaryChecksum).decode(
					bytes,
				)
			: await portable().decoder.decode(bytes);
	if (value.kind !== "accepted") return { kind: value.kind };
	const candidate: unknown =
		value.projectMember?.project ??
		JSON.parse(new TextDecoder().decode(value.projectBytes));
	return {
		kind: value.kind,
		exactProject: sameBrowserBackupValue(candidate, expected),
		resources: await Promise.all(
			(value.resources ?? []).map(async (resource) => ({
				key: resource.resourceHash,
				bytes: [...resource.bytes],
				sha256: await browserBinaryChecksum.sha256Bytes(resource.bytes),
			})),
		),
	};
}
async function metadataRows(): Promise<unknown[]> {
	const database = await new Promise<IDBDatabase>((resolve, reject) => {
		const opening = indexedDB.open(privateName);
		opening.onupgradeneeded = () => opening.transaction?.abort();
		opening.onsuccess = () => resolve(opening.result);
		opening.onerror = () => reject(opening.error);
	});
	try {
		const transaction = database.transaction("scope-metadata", "readonly"),
			done = new Promise<void>((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		const rows = await new Promise<unknown[]>((resolve, reject) => {
			const request = transaction.objectStore("scope-metadata").getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		await done;
		return rows;
	} finally {
		database.close();
	}
}
async function editMetadata(
	mode: "identity" | "counter" | "restore",
	saved: readonly unknown[],
): Promise<void> {
	const database = await new Promise<IDBDatabase>((resolve, reject) => {
		const opening = indexedDB.open(privateName);
		opening.onupgradeneeded = () => opening.transaction?.abort();
		opening.onsuccess = () => resolve(opening.result);
		opening.onerror = () => reject(opening.error);
	});
	try {
		const transaction = database.transaction("scope-metadata", "readwrite", {
				durability: "strict",
			}),
			done = new Promise<void>((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		const store = transaction.objectStore("scope-metadata");
		if (mode === "identity") store.delete("identity");
		else if (mode === "counter")
			store.put({ key: "counter", lastReserved: "0" });
		else for (const row of saved) store.put(row);
		await done;
	} finally {
		database.close();
	}
}
interface MountedReadonly {
	readonly root: Root;
	readonly runtime: ReturnType<typeof createBrowserRuntime>;
	readonly observer: ReturnType<typeof observe>;
	readonly originals: Record<"legacy" | "browser-registered", Project>;
	readonly models: readonly { resourceHash: string; bytes: number[] }[];
	readonly before: unknown;
	readonly sessionBefore: Record<string, string>;
	readonly constructorSessionBefore: Record<string, string>;
	readonly constructorSessionAfter: Record<string, string>;
	readonly localBefore: Record<string, string>;
	readonly constructionOpens: number;
	readonly input: HTMLInputElement;
	proof: unknown;
}
let mounted: MountedReadonly | undefined;
const harness = {
	async mountReadonly(resourceful = true) {
		if (mounted) throw new Error("Readonly view already mounted");
		const writable = input(),
			legacy = createProductionRuntime(),
			producer = privateRuntime(async () => writable);
		if (
			(await legacy.releaseStartup.handshake(writable)).kind !== "writable" ||
			(await producer.releaseStartup.handshake(writable)).kind !== "writable"
		)
			throw new Error("Actual producer startup refused");
		await legacy.controller.open();
		legacy.controller.startNewProject();
		if (
			(await legacy.controller.create("Legacy readonly source")).kind !==
			"durable"
		)
			throw new Error("Actual legacy producer refused");
		await seedPrivate(producer);
		const models = resourceful
			? [await place(legacy.controller), await place(producer.controller)]
			: [];
		const originals = {
			legacy: project(legacy.controller),
			"browser-registered": project(producer.controller),
		};
		await producer.dispose();
		const before = await snapshot(),
			constructorSessionBefore = { ...sessionStorage },
			localBefore = { ...localStorage },
			observer = observe(true),
			actual = input(true),
			read = async () => actual,
			registered = privateRuntime(read),
			constructorSessionAfter = { ...sessionStorage },
			sessionBefore = { ...sessionStorage },
			readonlyProjects = provider(read, observer),
			runtime = createBrowserRuntime({
				legacy,
				registered,
				readonlyProjects,
				readReleaseStartupInput: read,
			}),
			constructionOpens = observer.opens.length,
			node = document.createElement("div"),
			fileInput = document.createElement("input");
		node.id = "actual-readonly-root";
		document.body.append(node);
		fileInput.type = "file";
		fileInput.id = "readonly-download-proof";
		fileInput.hidden = true;
		document.body.append(fileInput);
		const root = createRoot(node);
		mounted = {
			root,
			runtime,
			observer,
			originals,
			models,
			before,
			sessionBefore,
			constructorSessionBefore,
			constructorSessionAfter,
			localBefore,
			constructionOpens,
			input: fileInput,
			proof: undefined,
		};
		root.render(
			createElement(
				StrictMode,
				null,
				createElement(BrowserRuntimeEditor, {
					runtime,
					catalogGateway: new HttpCatalogGateway({
						checksum: browserBinaryChecksum,
					}),
					readReleaseStartupInput: read,
				}),
			),
		);
		return {
			names: {
				legacy: originals.legacy.name,
				"browser-registered": originals["browser-registered"].name,
			},
			models,
			constructionOpens,
		};
	},
	receiveDownloadedFile(owner: "legacy" | "browser-registered") {
		const owned = mounted;
		if (!owned) throw new Error("No actual readonly view");
		owned.proof = { kind: "waiting", owner };
		owned.input.value = "";
		owned.input.onchange = () => {
			const file = owned.input.files?.[0];
			if (!file) {
				owned.proof = { kind: "missing", owner };
				return;
			}
			void (async () => {
				const bytes = new Uint8Array(await file.arrayBuffer());
				const result = await decoded(
					bytes,
					"registered",
					owned.originals[owner],
				);
				if (mounted === owned)
					owned.proof = {
						kind: "decoded-file",
						owner,
						byteLength: bytes.length,
						filename: file.name,
						result,
					};
			})().catch((error) => {
				if (mounted === owned)
					owned.proof = { kind: "failed", owner, error: String(error) };
			});
		};
	},
	downloadedFileProof() {
		return mounted?.proof;
	},
	async finishMountedReadonly() {
		const owned = mounted;
		if (!owned) throw new Error("No actual readonly view");
		mounted = undefined;
		owned.root.unmount();
		owned.input.remove();
		try {
			await owned.runtime.dispose();
			return {
				before: owned.before,
				after: await snapshot(),
				sessionBefore: owned.sessionBefore,
				constructorSessionBefore: owned.constructorSessionBefore,
				constructorSessionAfter: owned.constructorSessionAfter,
				sessionAfter: { ...sessionStorage },
				localBefore: owned.localBefore,
				localAfter: { ...localStorage },
				modes: owned.observer.modes,
				opens: owned.observer.opens,
				upgrades: owned.observer.upgrades,
				constructionOpens: owned.constructionOpens,
			};
		} finally {
			owned.observer.restore();
			document.getElementById("actual-readonly-root")?.remove();
		}
	},

	async both(resourceful = false) {
		let actual = input();
		const legacy = createProductionRuntime(),
			registered = privateRuntime(async () => actual);
		if (
			(await legacy.releaseStartup.handshake(actual)).kind !== "writable" ||
			(await registered.releaseStartup.handshake(actual)).kind !== "writable"
		)
			throw new Error("Producer startup refused");
		await legacy.controller.open();
		legacy.controller.startNewProject();
		const created = await legacy.controller.create("Legacy readonly source");
		if (created.kind !== "durable")
			throw new Error("Actual legacy producer refused");
		await seedPrivate(registered);
		const models = resourceful
			? [await place(legacy.controller), await place(registered.controller)]
			: [];
		const originals = {
			legacy: project(legacy.controller),
			"browser-registered": project(registered.controller),
		};
		actual = input(true);
		const observer = observe(),
			readonlyProjects = provider(async () => actual, observer),
			runtime = createBrowserRuntime({
				legacy,
				registered,
				readonlyProjects,
				readReleaseStartupInput: async () => actual,
			});
		try {
			const constructionOpens = observer.opens.length;
			const startup = await runtime.releaseStartup.handshake(actual);
			for (
				let n = 0;
				n < 50 && !readonlyProjects.getSourceSignal("legacy");
				n++
			)
				await Promise.resolve();
			const before = await snapshot(),
				sessionBefore = { ...sessionStorage },
				localBefore = { ...localStorage };
			const directory = await readonlyProjects.readDirectory();
			const files = [];
			for (const row of directory.projects) {
				for (const format of ["legacy", "registered"] as const) {
					const file = await readonlyProjects.exportBackup(row, format);
					files.push({
						owner: row.storageNamespace,
						format,
						kind: file.kind,
						...(file.kind === "ready"
							? {
									decoded: await decoded(
										file.bytes,
										format,
										originals[row.storageNamespace],
									),
								}
							: {}),
					});
				}
			}
			const raw = [];
			for (const owner of ["legacy", "browser-registered"] as const) {
				const recovery = readonlyProjects.getSourceRecovery(owner);
				if (!recovery) throw new Error("Missing actual raw source capability");
				const rows = await recovery.listRecoverySources();
				const row = rows[0];
				if (!row) throw new Error("Missing actual raw row");
				const value = await recovery.readRecoverySource(
						row.projectId,
						row.revisionId,
					),
					stale = await recovery.readRecoverySource(
						row.projectId,
						"foreign-revision",
					);
				raw.push({
					owner,
					exact:
						value?.serializedProject ===
						canonicalProjectSerializer.serialize(originals[owner]),
					available: value?.kind,
					staleAbsent: stale === undefined,
				});
			}
			const after = await snapshot();
			return {
				startup,
				constructionOpens,
				directory,
				files,
				raw,
				models,
				before,
				after,
				sessionBefore,
				sessionAfter: { ...sessionStorage },
				localBefore,
				localAfter: { ...localStorage },
				opens: observer.opens,
				modes: observer.modes,
				upgrades: observer.upgrades,
				readonlySources: runtime.getReadonlyProjectSources(),
			};
		} finally {
			await runtime.dispose();
			observer.restore();
		}
	},
	async resourceNeighbor() {
		let actual = input();
		const nativeOpen = indexedDB.open.bind(indexedDB),
			descriptor = Object.getOwnPropertyDescriptor(indexedDB, "open"),
			producerHandles = new Set<IDBDatabase>();
		Object.defineProperty(indexedDB, "open", {
			configurable: true,
			value: (name: string, version?: number) => {
				const request = nativeOpen(name, version);
				if (name === "interiors-editor-custom-assets")
					request.addEventListener("success", () =>
						producerHandles.add(request.result),
					);
				return request;
			},
		});
		const legacy = createProductionRuntime();
		let rich: Project, empty: Project;
		try {
			if ((await legacy.releaseStartup.handshake(actual)).kind !== "writable")
				throw new Error("Actual legacy producer unavailable");
			await legacy.controller.open();
			legacy.controller.startNewProject();
			if (
				(await legacy.controller.create("Resourceful legacy A")).kind !==
				"durable"
			)
				throw new Error("A producer failed");
			await place(legacy.controller);
			rich = project(legacy.controller);
			legacy.controller.startNewProject();
			if (
				(await legacy.controller.create("Healthy empty legacy C")).kind !==
				"durable"
			)
				throw new Error("C producer failed");
			empty = project(legacy.controller);
		} finally {
			if (descriptor) Object.defineProperty(indexedDB, "open", descriptor);
			else Reflect.deleteProperty(indexedDB, "open");
		}
		// Only fixture-owned producer connections close here; production runtime exposes no close port.
		for (const handle of producerHandles) handle.close();
		actual = input(true);
		const observer = observe(),
			readonlyProjects = provider(async () => actual, observer),
			runtime = createBrowserRuntime({
				legacy,
				readonlyProjects,
				readReleaseStartupInput: async () => actual,
			});
		try {
			await runtime.releaseStartup.handshake(actual);
			for (
				let n = 0;
				n < 50 && !readonlyProjects.getSourceSignal("legacy");
				n++
			)
				await Promise.resolve();
			const initial = await readonlyProjects.readDirectory(),
				a = initial.projects.find((row) => row.projectId === rich.projectId),
				c = initial.projects.find((row) => row.projectId === empty.projectId);
			if (!a || !c) throw new Error("Both actual legacy Projects required");
			const control = await readonlyProjects.exportBackup(a, "registered");
			if (control.kind !== "ready")
				throw new Error("Actual GLB backup control failed");
			await new Promise<void>((resolve, reject) => {
				const deleting = indexedDB.deleteDatabase(
					"interiors-editor-custom-assets",
				);
				deleting.onsuccess = () => resolve();
				deleting.onerror = () => reject(deleting.error);
				deleting.onblocked = () =>
					reject(new Error("Fixture-owned resource handles failed to close"));
			});
			const before = await snapshot(),
				cBefore = await readonlyProjects.exportBackup(c, "registered"),
				aMissing = await readonlyProjects.exportBackup(a, "registered"),
				cAfter = await readonlyProjects.exportBackup(c, "legacy"),
				recovery = readonlyProjects.getSourceRecovery("legacy"),
				raw = await recovery?.readRecoverySource(c.projectId, c.revisionId),
				directory = await readonlyProjects.readDirectory(),
				after = await snapshot();
			return {
				initial,
				directory,
				control: await decoded(control.bytes, "registered", rich),
				cBefore:
					cBefore.kind === "ready"
						? await decoded(cBefore.bytes, "registered", empty)
						: { kind: cBefore.kind },
				aMissing: aMissing.kind,
				cAfter:
					cAfter.kind === "ready"
						? await decoded(cAfter.bytes, "legacy", empty)
						: { kind: cAfter.kind },
				rawExact:
					raw?.serializedProject ===
					canonicalProjectSerializer.serialize(empty),
				before,
				after,
				resourceDatabaseAbsent: !(await indexedDB.databases()).some(
					(row) => row.name === "interiors-editor-custom-assets",
				),
				modes: observer.modes,
				upgrades: observer.upgrades,
			};
		} finally {
			await runtime.dispose();
			observer.restore();
		}
	},
	async sticky(mode: "identity" | "counter") {
		let actual = input();
		const legacy = createProductionRuntime(),
			registered = privateRuntime(async () => actual);
		if (
			(await legacy.releaseStartup.handshake(actual)).kind !== "writable" ||
			(await registered.releaseStartup.handshake(actual)).kind !== "writable"
		)
			throw new Error("Actual producers unavailable");
		await legacy.controller.open();
		legacy.controller.startNewProject();
		const created = await legacy.controller.create("Healthy readonly neighbor");
		if (created.kind !== "durable") throw new Error("Healthy neighbor failed");
		await seedPrivate(registered);
		const neighbor = project(legacy.controller);
		actual = input(true);
		const observer = observe(),
			readonlyProjects = provider(async () => actual, observer),
			runtime = createBrowserRuntime({
				legacy,
				registered,
				readonlyProjects,
				readReleaseStartupInput: async () => actual,
			});
		try {
			await runtime.releaseStartup.handshake(actual);
			for (
				let n = 0;
				n < 50 && !readonlyProjects.getSourceSignal("legacy");
				n++
			)
				await Promise.resolve();
			const initial = await readonlyProjects.readDirectory(),
				saved = await metadataRows(),
				previous = readonlyProjects.getSourceSignal("browser-registered");
			if (initial.projects.length !== 2)
				throw new Error("Both real sources required before fault");
			await editMetadata(mode, saved);
			const faultBefore = await snapshot();
			if (mode === "counter") await readonlyProjects.admit(actual);
			const first = await readonlyProjects.readDirectory(),
				faultAfter = await snapshot(),
				firstAborted =
					readonlyProjects.getSourceSignal("browser-registered")?.aborted;
			await editMetadata("restore", saved);
			const restoredBefore = await snapshot();
			await readonlyProjects.admit(actual);
			const after = await readonlyProjects.readDirectory(),
				restoredAfter = await snapshot(),
				legacyRow = after.projects.find(
					(row) => row.storageNamespace === "legacy",
				);
			if (!legacyRow)
				throw new Error("Healthy neighbor hidden by private failure");
			const file = await readonlyProjects.exportBackup(legacyRow, "registered");
			return {
				initial,
				first,
				after,
				firstAborted,
				previousAborted: previous?.aborted,
				currentAborted:
					readonlyProjects.getSourceSignal("browser-registered")?.aborted,
				privateRawUnavailable:
					readonlyProjects.getSourceRecovery("browser-registered") ===
					undefined,
				neighborFile:
					file.kind === "ready"
						? await decoded(file.bytes, "registered", neighbor)
						: { kind: file.kind },
				faultBefore,
				faultAfter,
				restoredBefore,
				restoredAfter,
				modes: observer.modes,
				upgrades: observer.upgrades,
			};
		} finally {
			await runtime.dispose();
			observer.restore();
		}
	},
	async absentLegacy() {
		const registered = privateRuntime(async () => input());
		if (
			(await registered.releaseStartup.handshake(input())).kind !== "writable"
		)
			throw new Error("Private producer unavailable");
		await seedPrivate(registered);
		const legacy = createProductionRuntime(),
			observer = observe(),
			readonlyProjects = provider(async () => input(), observer);
		let settle: () => void = () => undefined;
		const settled = new Promise<void>((resolve) => {
			settle = resolve;
		});
		const delegate = legacy.releaseStartup.handshake.bind(
			legacy.releaseStartup,
		);
		const observedLegacy = {
			...legacy,
			releaseStartup: {
				handshake: async (value: ReleaseStartupInput) => {
					try {
						return await delegate(value);
					} finally {
						settle();
					}
				},
			},
		};
		const nativeOpen = indexedDB.open.bind(indexedDB),
			descriptor = Object.getOwnPropertyDescriptor(indexedDB, "open");
		let aborted = 0;
		Object.defineProperty(indexedDB, "open", {
			configurable: true,
			value: (name: string, version?: number) => {
				const request = nativeOpen(name, version);
				if (name === legacyName)
					request.addEventListener("upgradeneeded", () => {
						aborted++;
						request.transaction?.abort();
					});
				return request;
			},
		});
		const runtime = createBrowserRuntime({
			legacy: observedLegacy,
			registered,
			readonlyProjects,
			readReleaseStartupInput: async () => input(),
		});
		try {
			const startup = await runtime.releaseStartup.handshake(input());
			await settled;
			if (descriptor) Object.defineProperty(indexedDB, "open", descriptor);
			else Reflect.deleteProperty(indexedDB, "open");
			const absentBefore = !(await indexedDB.databases()).some(
				(row) => row.name === legacyName,
			);
			await runtime.controller.open();
			const hub = runtime.controller.snapshot();
			const before = await snapshot(),
				directory = await readonlyProjects.readDirectory(),
				after = await snapshot();
			const row = directory.projects.find(
				(value) => value.storageNamespace === "browser-registered",
			);
			if (!row) throw new Error("Healthy private source hidden");
			await runtime.controller.openProject(row.projectId, {
				storageNamespace: "browser-registered",
			});
			const renamed = await runtime.controller.renameProject(
				"Private survives readonly neighbor",
			);
			return {
				startup,
				aborted,
				absentBefore,
				hub,
				directory,
				before,
				after,
				renamed,
				absentAfter: !(await indexedDB.databases()).some(
					(value) => value.name === legacyName,
				),
				readonlySources: runtime.getReadonlyProjectSources(),
				modes: observer.modes,
				opens: observer.opens,
				upgrades: observer.upgrades,
			};
		} finally {
			if (descriptor) Object.defineProperty(indexedDB, "open", descriptor);
			else Reflect.deleteProperty(indexedDB, "open");
			await runtime.dispose();
			observer.restore();
		}
	},
};
declare global {
	interface Window {
		__browserReadonlyProjectHarness: typeof harness;
	}
}
window.__browserReadonlyProjectHarness = harness;
