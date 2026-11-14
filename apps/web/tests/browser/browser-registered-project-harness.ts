import { BrowserProjectKeyLookup } from "../../src/adapters/persistence/browser-project-key-lookup";
import { BrowserRegisteredProjectRepository } from "../../src/adapters/persistence/browser-registered-project-repository";
import { BrowserRegisteredScopeStore } from "../../src/adapters/persistence/browser-registered-scope-store";
import { FflatePortableBackupDecoder } from "../../src/adapters/portable-backup/fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "../../src/adapters/portable-backup/fflate-portable-backup-encoder";
import { createRegisteredRuntimePortablePorts } from "../../src/adapters/portable-backup/registered-runtime-portable";
import {
	browserBinaryChecksum,
	browserChecksum,
	browserClock,
	browserIds,
} from "../../src/app/browser-ports";
import { createBrowserRegisteredRuntime } from "../../src/app/browser-registered-runtime";
import { BrowserRegisteredStorageSession } from "../../src/app/browser-registered-storage-session";
import { createBrowserRuntime } from "../../src/app/browser-runtime";
import { createProductionRuntime } from "../../src/app/production-app";
import { approveTelegramRelease } from "../../src/app/telegram-release-preflight";
import { createTelegramRuntime } from "../../src/app/telegram-runtime";
import {
	CreateProjectUseCase,
	canonicalProjectSerializer,
} from "../../src/application/create-project";
import type { PublicationCandidate } from "../../src/application/ports";
import { RenameProjectUseCase } from "../../src/application/rename-project";
import { createInitialProject } from "../../src/domain/initial-project";
import type { Project } from "../../src/domain/project";
import { verifiedReadonlyTestScope } from "../fixtures/telegram-readonly-signed-launch";
import { triangleGlb } from "./telegram-runtime-ui-support";

const name = "interiors-editor-browser-registered";
const entries = new Map<
	string,
	{
		store: BrowserRegisteredScopeStore;
		repository: BrowserRegisteredProjectRepository;
		candidates: Map<string, PublicationCandidate>;
	}
>();
const durability: IDBTransactionDurability[] = [];
const nativeTransaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (names, mode, options) {
	const transaction = nativeTransaction.call(this, names, mode, options);
	if (this.name === name && mode === "readwrite")
		durability.push(transaction.durability);
	return transaction;
};
const runtimeCounts = new Map<string, { opens: number; locks: number }>();
let scopeHeld = false,
	releaseScope = () => {},
	scopeDrain: Promise<unknown> = Promise.resolve();
const runtimes = new Map<
	string,
	ReturnType<typeof createBrowserRegisteredRuntime>
>();
const releaseInput = () => ({
	capabilities: { indexeddb: true, webgl2: true },
	shellManifest: {
		version: 1,
		workerProtocolVersion: 1,
		appBuildId: "native-browser-test",
		minimumCapabilities: ["indexeddb", "webgl2"],
		projectSchemas: { readable: [1], writable: [1] },
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
	},
	workerManifest: undefined,
	hasControllingWorker: false,
});
const harness = {
	// Verification of the retained old codec and real runtime composition only;
	// this is not evidence for a shipped old build or OS/file-picker delivery.
	async actualEmptyLegacyBridge() {
		const legacy = createProductionRuntime();
		const merged = createBrowserRuntime({
			legacy,
			readReleaseStartupInput: async () => releaseInput(),
		});
		let telegram: ReturnType<typeof createTelegramRuntime> | undefined;
		try {
			const startup = await merged.releaseStartup.handshake(releaseInput());
			await merged.controller.open();
			merged.controller.startNewProject();
			const original = await merged.controller.create(
				"TMA12 retained old empty source",
			);
			const originalState = merged.controller.snapshot();
			if (
				original.kind !== "durable" ||
				originalState.kind !== "saved" ||
				!originalState.project ||
				originalState.project.schemaVersion !== 1
			)
				throw new Error("Actual empty source was not Durable");
			const oldFile = await merged.controller.exportProjectTransfer(
				original.projectId,
				{ storageNamespace: "legacy" },
			);
			if (oldFile.kind !== "ready")
				throw new Error("Retained old export was unavailable");
			const oldDigest = await browserBinaryChecksum.sha256Bytes(oldFile.bytes);
			const oldDecoded = await new FflatePortableBackupDecoder(
				browserBinaryChecksum,
			).decode(oldFile.bytes);
			if (oldDecoded.kind !== "accepted")
				throw new Error("Retained old decoder did not accept its empty file");
			const beforeLegacyImport = await harness.snapshotAll();
			const bridged = await merged.controller.importProjectTransfer(
				oldFile.bytes,
			);
			const bridgedState = merged.controller.snapshot();
			if (
				bridged.kind !== "durable" ||
				bridgedState.kind !== "saved" ||
				!bridgedState.project ||
				bridgedState.project.schemaVersion !== 1
			)
				throw new Error(
					"Actual legacy import did not preserve the old-file bridge",
				);
			const afterLegacyImport = await harness.snapshotAll();
			await merged.controller.showProjects();
			const directory = merged.controller.snapshot();
			const beforeWireExport = await harness.snapshotAll();
			const wire = await merged.controller.exportRegisteredProjectTransfer(
				bridged.projectId,
				{ storageNamespace: "legacy" },
			);
			if (wire.kind !== "ready")
				throw new Error(
					"Qualified legacy directory transfer export was unavailable",
				);
			const afterWireExport = await harness.snapshotAll();
			const portable = createRegisteredRuntimePortablePorts({
				binaryChecksum: browserBinaryChecksum,
			});
			const wireDecoded = await portable.decoder.decode(wire.bytes);
			const scope = await verifiedReadonlyTestScope();
			const approval = approveTelegramRelease({
				capsule: {
					deliveryTarget: "telegram",
					entryPath: "/main.12345678.js",
					manifest: releaseInput().shellManifest,
				},
				loadedEntryPath: "/main.12345678.js",
				capabilities: releaseInput().capabilities,
				secureContext: isSecureContext,
				webLocks: typeof navigator.locks?.request === "function",
				hasControllingWorker: false,
				workerManifest: undefined,
			});
			if (approval.kind !== "approved")
				throw new Error(
					"Test-only loaded writable Telegram capsule was not approved",
				);
			telegram = createTelegramRuntime({
				approval: approval.approval,
				scope,
				context: {
					indexedDb: indexedDB,
					locks: navigator.locks,
					secureContext: isSecureContext,
					crypto,
					sessionStorage,
					localStorage,
					readCapabilities: () => releaseInput().capabilities,
					readWorker: async () => ({
						hasControllingWorker: false,
						workerManifest: undefined,
					}),
				},
				ports: {
					checksum: browserChecksum,
					binaryChecksum: browserBinaryChecksum,
					clock: browserClock,
					ids: browserIds,
					storageEstimate: { estimateStorage: async () => ({}) },
					portable: { ...portable, encoder: new FflatePortableBackupEncoder() },
				},
			});
			const telegramStartup = await telegram.releaseStartup.handshake(
				releaseInput(),
			);
			const beforeStrictOld = await harness.snapshotAll();
			const directOld = await telegram.controller.importProjectTransfer(
				oldFile.bytes,
			);
			const afterStrictOld = await harness.snapshotAll();
			const imported = await telegram.controller.importProjectTransfer(
				wire.bytes,
			);
			const importedState = telegram.controller.snapshot();
			if (
				imported.kind !== "durable" ||
				importedState.kind !== "saved" ||
				!importedState.project ||
				importedState.project.schemaVersion !== 1
			)
				throw new Error(
					"Actual strict Telegram default import rejected qualified wire export",
				);
			const allAfterTelegram = await harness.snapshotAll(),
				databaseName = `interiors-editor-projects:${scope}`;
			const semantic = (project: Project) => {
				const { projectId: _id, updatedAt: _updated, ...rest } = project;
				return rest;
			};
			return {
				startup,
				telegramStartup,
				original,
				bridged,
				imported,
				oldDecodedKind: oldDecoded.kind,
				oldDigest,
				oldDigestAfter: await browserBinaryChecksum.sha256Bytes(oldFile.bytes),
				beforeLegacyImport,
				afterLegacyImport,
				directory,
				beforeWireExport,
				afterWireExport,
				beforeStrictOld,
				afterStrictOld,
				directOld,
				wireDecoded,
				source: originalState.project,
				bridge: bridgedState.project,
				target: importedState.project,
				semantics: [
					semantic(originalState.project),
					semantic(bridgedState.project),
					semantic(importedState.project),
				],
				legacyAfterTelegram: allAfterTelegram.filter(
					(value) => value.name !== databaseName,
				),
				telegramDatabase: allAfterTelegram.find(
					(value) => value.name === databaseName,
				),
			};
		} finally {
			try {
				await telegram?.dispose();
			} finally {
				await merged.dispose();
			}
		}
	},
	async actualCoexistence() {
		harness.createRuntime("coexisting-private");
		const registered = runtime("coexisting-private"),
			legacy = createProductionRuntime();
		const merged = createBrowserRuntime({
			legacy,
			registered,
			readReleaseStartupInput: async () => releaseInput(),
		});
		try {
			const startup = await merged.releaseStartup.handshake(releaseInput());
			for (
				let attempt = 0;
				attempt < 300 && !merged.canCreateLegacyProject();
				attempt++
			)
				await new Promise((resolve) => setTimeout(resolve, 10));
			if (!merged.canCreateLegacyProject())
				throw new Error("Actual legacy write admission did not finish");
			const privateReady = await registered.readDirectory();
			await merged.controller.open();
			merged.controller.startNewProject();
			const first = await merged.controller.create("Actual legacy A");
			if (first.kind !== "durable") throw new Error("Missing actual legacy A");
			const legacyBefore = (await harness.snapshotAll()).filter(
				(database) => database.name !== name,
			);
			const portable = createRegisteredRuntimePortablePorts({
					binaryChecksum: browserBinaryChecksum,
				}),
				source = createInitialProject({
					projectId: "11111111-1111-4111-8111-111111111111",
					levelId: "source-level",
					name: "Actual private B",
					createdAt: "2026-11-05T00:00:00.000Z",
				});
			const wire = await portable.writer.encode({
				project: source,
				createdAt: source.createdAt,
				resources: [],
			});
			if (wire.kind !== "encoded") throw new Error("Missing actual wire file");
			const imported = await merged.controller.importRegisteredPortableBackup(
				wire.bytes,
			);
			if (imported.kind !== "durable")
				throw new Error(`Private import refused: ${imported.kind}`);
			const legacyAfter = (await harness.snapshotAll()).filter(
				(database) => database.name !== name,
			);
			const privateView = merged.getEditorInstanceSnapshot();
			if (!privateView.controller)
				throw new Error("Missing captured actual private UI capability");
			merged.controller.startNewProject();
			const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID"),
				nativeUuid = crypto.randomUUID.bind(crypto),
				proposals = [nativeUuid(), imported.projectId, imported.revisionId];
			let allocated = 0;
			Object.defineProperty(crypto, "randomUUID", {
				configurable: true,
				value: () => {
					allocated++;
					return proposals.shift() ?? nativeUuid();
				},
			});
			let colliding: Awaited<ReturnType<typeof merged.controller.create>>;
			try {
				colliding = await merged.controller.create(
					"Future legacy same raw IDs",
				);
			} finally {
				if (descriptor) Object.defineProperty(crypto, "randomUUID", descriptor);
				else Reflect.deleteProperty(crypto, "randomUUID");
			}
			if (colliding.kind !== "durable")
				throw new Error(
					`Actual future legacy collision failed: ${colliding.kind}`,
				);
			const legacyView = merged.getEditorInstanceSnapshot(),
				beforeStale = await harness.snapshotAll(),
				stale = await privateView.controller.renameProject(
					"Must not follow same raw IDs",
				),
				afterStale = await harness.snapshotAll();
			await merged.controller.showProjects();
			const directory = merged.controller.snapshot();
			await merged.controller.openProject(imported.projectId, {
				storageNamespace: "browser-registered",
			});
			const privateState = merged.controller.snapshot(),
				openedPrivate = merged.getEditorInstanceSnapshot();
			await merged.controller.openProject(imported.projectId, {
				storageNamespace: "legacy",
			});
			const legacyState = merged.controller.snapshot(),
				openedLegacy = merged.getEditorInstanceSnapshot();
			const exports = [];
			for (const owner of ["browser-registered", "legacy"] as const) {
				const file = await merged.controller.exportProjectTransfer(
					imported.projectId,
					{ storageNamespace: owner },
				);
				if (file.kind !== "ready")
					throw new Error("Missing actual owned backup");
				const decoded = await new FflatePortableBackupDecoder(
					browserBinaryChecksum,
				).decode(file.bytes);
				if (decoded.kind !== "accepted")
					throw new Error("Actual owned backup refused");
				const project: unknown = JSON.parse(
					new TextDecoder().decode(decoded.projectBytes),
				);
				exports.push({
					owner,
					name:
						project && typeof project === "object" && "name" in project
							? project.name
							: undefined,
				});
			}
			return {
				startup,
				privateReady,
				first,
				imported,
				colliding,
				allocated,
				legacyBefore,
				legacyAfter,
				privateKey: privateView.key,
				legacyKey: legacyView.key,
				stale,
				beforeStale,
				afterStale,
				directory,
				privateState,
				legacyState,
				openedPrivate: {
					key: openedPrivate.key,
					owner: openedPrivate.storageNamespace,
				},
				openedLegacy: {
					key: openedLegacy.key,
					owner: openedLegacy.storageNamespace,
				},
				exports,
			};
		} finally {
			await merged.dispose();
		}
	},
	async futurePrivateVersion() {
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open(name, 2);
			opening.onsuccess = () => {
				opening.result.close();
				resolve();
			};
			opening.onerror = () => reject(opening.error);
			opening.onblocked = () =>
				reject(new Error("Unexpected live private handle"));
		});
	},
	createRuntime(key: string, timeoutMs = 1500) {
		const counts = { opens: 0, locks: 0 };
		runtimeCounts.set(key, counts);
		const runtime = createBrowserRegisteredRuntime({
			context: {
				indexedDb: {
					open(name, version) {
						counts.opens++;
						return version === undefined
							? indexedDB.open(name)
							: indexedDB.open(name, version);
					},
				},
				locks: new Proxy(navigator.locks, {
					get(target, key) {
						const value = Reflect.get(target, key, target);
						return key === "request" && typeof value === "function"
							? (...args: unknown[]) => {
									counts.locks++;
									return Reflect.apply(value, target, args);
								}
							: typeof value === "function"
								? value.bind(target)
								: value;
					},
				}),
				secureContext: isSecureContext,
				crypto,
				sessionStorage,
				navigationType: "navigate",
				readReleaseStartupInput: async () => releaseInput(),
				directoryTimeoutMs: timeoutMs,
			},
			ports: {
				checksum: browserChecksum,
				binaryChecksum: browserBinaryChecksum,
				clock: browserClock,
				ids: browserIds,
				storageEstimate: { estimateStorage: async () => ({}) },
			},
		});
		runtimes.set(key, runtime);
	},
	runtimeCounts: (key: string) => ({ ...runtimeCounts.get(key) }),
	scopeHeld: () => scopeHeld,
	async holdScopeLock() {
		let enter: () => void = () => {},
			fail: (reason: unknown) => void = () => {};
		const entered = new Promise<void>((resolve, reject) => {
				enter = resolve;
				fail = reject;
			}),
			held = new Promise<void>((resolve) => {
				releaseScope = resolve;
			});
		scopeDrain = navigator.locks.request(
			"interiors-browser-registered-v1",
			{ mode: "exclusive" },
			async () => {
				scopeHeld = true;
				enter();
				try {
					await held;
				} finally {
					scopeHeld = false;
				}
			},
		);
		void scopeDrain.catch(fail);
		await entered;
	},
	releaseScopeLock() {
		releaseScope();
		return scopeDrain;
	},
	async startRuntime(key: string) {
		return runtime(key).releaseStartup.handshake(releaseInput());
	},
	runtimeDirectory: (key: string) => runtime(key).readDirectory(),
	runtimeState: (key: string) => runtime(key).controller.snapshot(),
	runtimeClose: (key: string) => runtime(key).dispose(),
	async runtimeImport(key: string, name: string) {
		const portable = createRegisteredRuntimePortablePorts({
			binaryChecksum: browserBinaryChecksum,
		});
		const project = createInitialProject({
			projectId: "11111111-1111-4111-8111-111111111111",
			levelId: "source-level",
			name,
			createdAt: "2026-11-05T00:00:00.000Z",
		});
		const file = await portable.writer.encode({
			project,
			createdAt: project.createdAt,
			resources: [],
		});
		if (file.kind !== "encoded") throw new Error("Invalid native file fixture");
		return runtime(key).controller.importRegisteredPortableBackup(file.bytes);
	},
	async runtimeConfigureAndPlace(key: string) {
		const controller = runtime(key).controller;
		const room = await controller.configureRectangularRoom({
			widthMm: "4000",
			depthMm: "3000",
			heightMm: "2600",
		});
		const current = controller.snapshot();
		if (
			!("project" in current) ||
			!current.project ||
			current.project.schemaVersion !== 1
		)
			throw new Error("Missing actual private Room");
		const bytes = triangleGlb(),
			resourceHash = await browserBinaryChecksum.sha256Bytes(bytes);
		const asset = {
			assetDefinitionId: "private-native-model",
			displayName: "Private native model",
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
		const placed = await controller.createCustomGlbFloorItem({
			asset,
			glbBytes: bytes,
			roomId: current.project.level.rooms[0]?.roomId ?? "",
			xMm: 1500,
			zMm: 1500,
			color: "#716796",
		});
		const read = await controller.readCustomGlbResource(resourceHash);
		return {
			room,
			library,
			placed,
			resourceHash,
			sourceBytes: [...bytes],
			readBytes: read ? [...read] : undefined,
			actualDigest: read
				? await browserBinaryChecksum.sha256Bytes(read)
				: undefined,
			state: controller.snapshot(),
		};
	},
	async runtimeReimportOwnWire(key: string) {
		const controller = runtime(key).controller;
		const file = await controller.exportRegisteredProjectTransfer();
		if (file.kind !== "ready") return { file };
		const imported = await controller.importRegisteredPortableBackup(
			file.bytes,
		);
		const state = controller.snapshot();
		const project = "project" in state ? state.project : undefined;
		const hash = project?.assetDefinitionRefs[0]?.resourceHash;
		const bytes = hash
			? await controller.readCustomGlbResource(hash)
			: undefined;
		return {
			file: { kind: file.kind, length: file.bytes.length },
			imported,
			state,
			resourceHash: hash,
			readBytes: bytes ? [...bytes] : undefined,
		};
	},
	async runtimeOrdinaryCreate(key: string) {
		return runtime(key).controller.create("Forbidden private create");
	},
	async runtimeRename(key: string, name: string) {
		return runtime(key).controller.renameProject(name);
	},
	async runtimeUndo(key: string) {
		return runtime(key).controller.undo();
	},
	async runtimeExport(key: string, registered: boolean) {
		const controller = runtime(key).controller;
		const result = registered
			? await controller.exportRegisteredProjectTransfer()
			: await controller.exportProjectTransfer();
		if (result.kind !== "ready") return result;
		const portable = createRegisteredRuntimePortablePorts({
			binaryChecksum: browserBinaryChecksum,
		});
		return {
			kind: result.kind,
			length: result.bytes.byteLength,
			decoded: await (registered
				? portable.decoder
				: new FflatePortableBackupDecoder(browserBinaryChecksum)
			).decode(result.bytes),
		};
	},
	create(key: string, ownerId: string) {
		const session = new BrowserRegisteredStorageSession();
		const store = new BrowserRegisteredScopeStore(session, {
			indexedDb: indexedDB,
			locks: navigator.locks,
			secureContext: isSecureContext,
		});
		// Test-only context acknowledgement port. Fences, rows, transactions and locks are native.
		const required = new Set<string>();
		const repository = new BrowserRegisteredProjectRepository(store, {
			ownerId,
			nowEpochMs: () => 1000,
			checksum: browserChecksum,
			binaryChecksum: browserBinaryChecksum,
			takeoverRequirements: {
				requiresExplicitTakeover: (id) => required.has(id),
				requireExplicitTakeover: (id) => {
					required.add(id);
				},
				clearExplicitTakeoverRequirement: (id) => {
					required.delete(id);
				},
			},
		});
		entries.set(key, { store, repository, candidates: new Map() });
	},
	probeKey(namespace: "legacy" | "browser-registered", projectId: string) {
		return new BrowserProjectKeyLookup({
			namespace,
			indexedDb: indexedDB,
		}).read(projectId);
	},
	async probeKeyFault(
		namespace: "legacy" | "browser-registered",
		projectId: string,
		fault: "upgrade" | "cancel" | "timeout",
	) {
		let handles = 0;
		const cancellation = new AbortController();
		let settle = () => {},
			deliver = () => {};
		const nativeDone = new Promise<void>((resolve) => {
				settle = resolve;
			}),
			delivered = new Promise<void>((resolve) => {
				deliver = resolve;
			});
		const indexedDb: Pick<IDBFactory, "open"> = {
			open(name) {
				const operation =
					fault === "upgrade" ? indexedDB.open(name, 4) : indexedDB.open(name);
				operation.addEventListener(
					"error",
					() => {
						settle();
						deliver();
					},
					{ once: true },
				);
				operation.addEventListener(
					"success",
					() => {
						handles++;
						const close = operation.result.close.bind(operation.result);
						operation.result.close = () => {
							handles--;
							close();
						};
						settle();
					},
					{ once: true },
				);
				if (fault === "upgrade") {
					operation.addEventListener("success", deliver, { once: true });
					return operation;
				}
				return new Proxy(operation, {
					get(target, key) {
						const value = Reflect.get(target, key, target);
						return typeof value === "function" ? value.bind(target) : value;
					},
					set(target, key, value) {
						if (key === "onsuccess" && typeof value === "function") {
							target.onsuccess = (event) => {
								setTimeout(() => {
									value.call(target, event);
									deliver();
								}, 120);
							};
							return true;
						}
						return Reflect.set(target, key, value, target);
					},
				});
			},
		};
		const reader = new BrowserProjectKeyLookup({
			namespace,
			indexedDb,
			timeoutMs: fault === "timeout" ? 20 : 1500,
		});
		const reading = reader.read(projectId, cancellation.signal);
		if (fault === "cancel") cancellation.abort();
		const result = await reading;
		await nativeDone;
		await delivered;
		return { result, handles };
	},
	async foreignPrivateDatabase() {
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open(name, 1);
			opening.onupgradeneeded = () =>
				opening.result.createObjectStore("foreign");
			opening.onsuccess = () => {
				opening.result.close();
				resolve();
			};
			opening.onerror = () => reject(opening.error);
		});
	},
	async corruptLegacyPointer(projectId: string) {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const opening = indexedDB.open("interiors-editor-projects");
			opening.onupgradeneeded = () => opening.transaction?.abort();
			opening.onsuccess = () => resolve(opening.result);
			opening.onerror = () => reject(opening.error);
		});
		try {
			const transaction = database.transaction("projects", "readwrite", {
				durability: "strict",
			});
			const done = new Promise<void>((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
			transaction.objectStore("projects").put({ projectId, garbage: true });
			await done;
		} finally {
			database.close();
		}
	},
	async cancelledKey(
		namespace: "legacy" | "browser-registered",
		projectId: string,
	) {
		let opens = 0;
		const controller = new AbortController();
		controller.abort();
		const result = await new BrowserProjectKeyLookup({
			namespace,
			indexedDb: {
				open(name, version) {
					opens++;
					return version === undefined
						? indexedDB.open(name)
						: indexedDB.open(name, version);
				},
			},
		}).read(projectId, controller.signal);
		return { result, opens };
	},
	async probe(key: string) {
		return entry(key).store.probe();
	},
	async provision(key: string) {
		await entry(key).store.provisionForRegisteredImport();
	},
	async list(key: string) {
		try {
			return await entry(key).repository.listProjects();
		} catch (error) {
			return {
				kind:
					error instanceof Error && "kind" in error
						? String(error.kind)
						: "unexpected-error",
			};
		}
	},
	async createProject(key: string, title: string, ids?: readonly string[]) {
		let index = 0;
		return new CreateProjectUseCase({
			checksum: browserChecksum,
			clock: browserClock,
			ids: ids
				? {
						next: () => {
							const id = ids[index++];
							if (!id) throw new Error("Exhausted fixture IDs");
							return id;
						},
					}
				: browserIds,
			serializer: canonicalProjectSerializer,
			repository: entry(key).repository,
		}).execute(title, (status) => {
			if ("candidate" in status)
				entry(key).candidates.set(
					status.candidate.revision.revisionId,
					status.candidate,
				);
		});
	},
	async rename(
		key: string,
		projectId: string,
		title: string,
		revisionId?: string,
	) {
		const loaded = await entry(key).repository.loadProject(projectId);
		if (
			loaded.kind !== "durable" ||
			loaded.candidate.project.schemaVersion !== 1 ||
			loaded.candidate.revision.schemaVersion !== 1
		)
			throw new Error("Missing fixture current");
		return new RenameProjectUseCase({
			checksum: browserChecksum,
			clock: browserClock,
			ids: revisionId ? { next: () => revisionId } : browserIds,
			serializer: canonicalProjectSerializer,
			repository: entry(key).repository,
		}).execute(
			{
				project: loaded.candidate.project,
				revision: loaded.candidate.revision,
			},
			title,
			(status) => {
				if ("candidate" in status)
					entry(key).candidates.set(
						status.candidate.revision.revisionId,
						status.candidate,
					);
			},
		);
	},
	async abortPointerRename(
		key: string,
		projectId: string,
		title: string,
		revisionId: string,
	) {
		const native = IDBObjectStore.prototype.put;
		let aborted = false;
		IDBObjectStore.prototype.put = function (value, id) {
			const request =
				id === undefined
					? native.call(this, value)
					: native.call(this, value, id);
			if (this.name === "projects")
				request.addEventListener(
					"success",
					() => {
						aborted = true;
						this.transaction.abort();
					},
					{ once: true },
				);
			return request;
		};
		try {
			return {
				result: await harness.rename(key, projectId, title, revisionId),
				aborted,
			};
		} finally {
			IDBObjectStore.prototype.put = native;
		}
	},
	async history(
		key: string,
		targetRevisionId: string,
		expectedBaseRevisionId: string,
	) {
		const target = entry(key).candidates.get(targetRevisionId);
		if (!target) throw new Error("Unknown actual historical candidate");
		return entry(key).repository.publishNextRevision(
			target,
			expectedBaseRevisionId,
			"history",
		);
	},
	load: (key: string, projectId: string) =>
		entry(key).repository.loadProject(projectId),
	access: (key: string, projectId: string) =>
		entry(key).repository.inspectWriterAccess(projectId),
	takeover: (key: string, projectId: string) =>
		entry(key).repository.takeOverWriterLease(projectId),
	recover: (key: string) => entry(key).repository.recover(),
	deleteProject: (key: string, projectId: string) =>
		entry(key).repository.permanentlyDeleteProject(projectId),
	close: (key: string) => entry(key).store.close(),
	durability: () => [...durability],
	async names() {
		return (await indexedDB.databases())
			.map((database) => database.name)
			.sort();
	},
	async seedLegacy(title: string) {
		const runtime = createProductionRuntime();
		await runtime.controller.open();
		const result = await runtime.controller.create(title);
		return { result, state: runtime.controller.snapshot() };
	},
	async snapshotAll() {
		const databases = await indexedDB.databases();
		return Promise.all(
			databases.map(async (info) => {
				if (!info.name) throw new Error("Unnamed fixture database");
				const database = await new Promise<IDBDatabase>((resolve, reject) => {
					const opening = indexedDB.open(info.name as string);
					opening.onupgradeneeded = () => opening.transaction?.abort();
					opening.onsuccess = () => resolve(opening.result);
					opening.onerror = () => reject(opening.error);
				});
				let terminal: ReturnType<typeof nativeSnapshotTerminal> | undefined;
				try {
					const names = [...database.objectStoreNames],
						transaction = database.transaction(names, "readonly");
					terminal = nativeSnapshotTerminal(transaction);
					const rows = await completeNativeSnapshot(Promise.all(
						names.map(async (name) => ({
							name,
							rows: await request(transaction.objectStore(name).getAll()),
						})),
					), terminal);
					return { name: database.name, version: database.version, rows };
				} finally {
					if (terminal) await terminal;
					database.close();
				}
			}),
		);
	},
};
function entry(key: string) {
	const found = entries.get(key);
	if (!found) throw new Error("Unknown fixture context");
	return found;
}
function request<T>(operation: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		operation.onsuccess = () => resolve(operation.result);
		operation.onerror = () => reject(operation.error);
	});
}
function nativeSnapshotTerminal(transaction: IDBTransaction): Promise<{ kind: "complete" } | { kind: "abort"; reason: unknown }> {
	return new Promise((resolve) => {
		transaction.addEventListener("complete", () => resolve({ kind: "complete" }), { once: true });
		transaction.addEventListener("abort", () => resolve({ kind: "abort", reason: transaction.error }), { once: true });
	});
}

async function completeNativeSnapshot<T>(requests: Promise<T>, terminal: ReturnType<typeof nativeSnapshotTerminal>): Promise<T> {
	const result = await requests;
	const ended = await terminal;
	if (ended.kind === "abort") throw ended.reason;
	return result;
}
declare global {
	interface Window {
		__browserRegisteredProjectHarness: typeof harness;
	}
}
window.__browserRegisteredProjectHarness = harness;

function runtime(key: string) {
	const found = runtimes.get(key);
	if (!found) throw new Error("Missing runtime");
	return found;
}
