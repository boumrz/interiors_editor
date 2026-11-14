import { BrowserRegisteredProjectRepository } from "../adapters/persistence/browser-registered-project-repository";
import { BrowserRegisteredScopeStore } from "../adapters/persistence/browser-registered-scope-store";
import type { ScopedProjectAccess } from "../adapters/persistence/scoped-project-protocol";
import { BrowserProjectKeyLookup } from "../adapters/persistence/browser-project-key-lookup";
import { BrowserRegisteredImportAdmission } from "../adapters/portable-backup/browser-registered-import-admission";
import { FflatePortableBackupDecoder } from "../adapters/portable-backup/fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../adapters/portable-backup/portable-backup-read-render-smoke";
import { createRegisteredRuntimePortablePorts } from "../adapters/portable-backup/registered-runtime-portable";
import { withNativeCancellation } from "../adapters/portable-backup/native-cancellation";
import { createBrowserRegisteredBackupFeasibility } from "../application/browser-registered-backup-feasibility";
import { ExportRuntimePortableBackupUseCase } from "../application/export-runtime-portable-backup";
import type {
	CancellationSignalPort,
	WriterTakeoverRequirementStorePort,
} from "../application/ports";
import { browserRandomUuid, browserWriterOwnerId } from "./browser-ports";
import type {
	BrowserRegisteredControllerSlot,
	BrowserRegisteredDirectoryRead,
} from "./browser-project-controller-facade";
import type { ProjectController } from "./project-controller";
import {
	guardRegisteredProjectController,
	type TrackOperation,
} from "./registered-project-controller";
import {
	isReleaseManifest,
	type ReleaseStartupInput,
	type ReleaseStartupOutcome,
} from "./release-startup";
import {
	createSharedProjectController,
	type SharedProjectControllerDependencies,
} from "./shared-project-controller";
import { BrowserRegisteredStorageSession } from "./browser-registered-storage-session";

type ContextStorage = Pick<Storage, "getItem" | "setItem">;
export interface BrowserRegisteredRuntimeDependencies {
	readonly context: {
		readonly indexedDb: Pick<IDBFactory, "open">;
		readonly locks?: Pick<LockManager, "request">;
		readonly secureContext: boolean;
		readonly crypto: Pick<Crypto, "getRandomValues"> &
			Partial<Pick<Crypto, "randomUUID">>;
		readonly sessionStorage: ContextStorage;
		readonly navigationType?: PerformanceNavigationTiming["type"];
		readonly readReleaseStartupInput: () => Promise<ReleaseStartupInput>;
		readonly directoryTimeoutMs?: number;
	};
	readonly ports: Pick<
		SharedProjectControllerDependencies,
		"checksum" | "binaryChecksum" | "clock" | "ids" | "storageEstimate"
	>;
}
export interface BrowserRegisteredRuntime
	extends BrowserRegisteredControllerSlot {
	readonly controller: ProjectController;
	readonly releaseStartup: {
		handshake(input: ReleaseStartupInput): Promise<ReleaseStartupOutcome>;
	};
	readReleaseStartupInput(): Promise<ReleaseStartupInput>;
}

/** Reuses the complete native scope operation; admission is checked inside its actual barrier too. */
class AdmittedBrowserStore extends BrowserRegisteredScopeStore {
	public constructor(
		session: BrowserRegisteredStorageSession,
		context: ConstructorParameters<typeof BrowserRegisteredScopeStore>[1],
		private readonly allowed: () => boolean,
	) {
		super(session, context);
	}
	public override run<T>(
		operation: (access: ScopedProjectAccess) => Promise<T>,
	): Promise<T> {
		const check = () => {
			if (!this.allowed())
				throw new Error("Browser registered startup is not admitted");
		};
		try {
			check();
		} catch (error) {
			return Promise.reject(error);
		}
		return super.run(async (access) => {
			check();
			return operation({
				scope: access.scope,
				signal: access.signal,
				reserveId: (kind) => {
					check();
					return access.reserveId(kind);
				},
				transact: (names, mode, work) => {
					check();
					return access.transact(names, mode, async (transaction) => {
						check();
						return work(transaction);
					});
				},
			});
		});
	}
}

/** Opt-in anonymous browser storage only. Construction and ordinary probes never create its DB. */
export function createBrowserRegisteredRuntime(
	dependencies: BrowserRegisteredRuntimeDependencies,
): BrowserRegisteredRuntime {
	const context = { ...dependencies.context },
		ports = { ...dependencies.ports };
	const timeout = context.directoryTimeoutMs ?? 1500;
	if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000)
		throw new Error("Invalid browser directory deadline");
	const session = new BrowserRegisteredStorageSession();
	let shellAdmitted = false,
		ready = false;
	let disposal: Promise<void> | undefined;
	const active = () => ready && shellAdmitted && !session.signal.aborted;
	const subscriptions = new Set<() => void>(),
		pending = new Set<Promise<unknown>>();
	const owned: TrackOperation = <T>(
		operation: () => T | Promise<T>,
	): Promise<T> => {
		if (session.signal.aborted)
			return Promise.reject(new Error("Browser registered runtime is closed"));
		let resolve: (value: T | PromiseLike<T>) => void = () => {},
			reject: (reason: unknown) => void = () => {};
		const result = new Promise<T>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		pending.add(result);
		void result.then(
			() => pending.delete(result),
			() => pending.delete(result),
		);
		try {
			void Promise.resolve(operation()).then(resolve, reject);
		} catch (error) {
			reject(error);
		}
		return result;
	};
	const track: TrackOperation = (operation) =>
		active()
			? owned(operation)
			: Promise.reject(new Error("Browser registered runtime is not admitted"));
	const storage = new AdmittedBrowserStore(
		session,
		context,
		() => shellAdmitted && !session.signal.aborted,
	);
	const writer = browserContextWriter(context);
	let controller: ProjectController | undefined;
	const repository = new BrowserRegisteredProjectRepository(storage, {
		ownerId: writer.ownerId,
		takeoverRequirements: writer.takeover,
		nowEpochMs: () => Date.parse(ports.clock.now()),
		checksum: ports.checksum,
		binaryChecksum: ports.binaryChecksum,
		sessionRoots: () =>
			controller?.sessionRetentionRoots() ?? {
				current: undefined,
				undo: [],
				redo: [],
			},
	});
	const registered = createRegisteredRuntimePortablePorts({
		binaryChecksum: ports.binaryChecksum,
	});
	const legacyLookup = new BrowserProjectKeyLookup({
		indexedDb: context.indexedDb,
		namespace: "legacy",
	});
	const privateLookup = new BrowserProjectKeyLookup({
		indexedDb: context.indexedDb,
		namespace: "browser-registered",
	});
	const nativeOperation = async <T>(
		source: CancellationSignalPort | undefined,
		operation: (signal: AbortSignal) => Promise<T>,
	) =>
		withNativeCancellation(source, async (fileSignal) => {
			const cancellation = new AbortController(),
				abort = () => cancellation.abort();
			session.signal.addEventListener("abort", abort, { once: true });
			fileSignal?.addEventListener("abort", abort, { once: true });
			if (session.signal.aborted || fileSignal?.aborted) cancellation.abort();
			try {
				return await operation(cancellation.signal);
			} finally {
				session.signal.removeEventListener("abort", abort);
				fileSignal?.removeEventListener("abort", abort);
			}
		});
	const admission = new BrowserRegisteredImportAdmission({
		decoder: registered.decoder,
		binaryChecksum: ports.binaryChecksum,
		ids: ports.ids,
		resources: repository.resources,
		live: active,
		initialize: async (signal) => {
			try {
				const result = await nativeOperation(signal, (native) =>
					storage.provisionForRegisteredImport(native),
				);
				if (result.kind !== "completed" || !active()) return false;
				await repository.recover();
				return active();
			} catch {
				return false;
			}
		},
		lookupProjectId: async (id, signal) => {
			const result = await nativeOperation(signal, async (native) =>
				Promise.all([
					legacyLookup.read(id, native),
					privateLookup.read(id, native),
				]),
			);
			return result.kind === "cancelled" ||
				!active() ||
				result.value.some((value) => value.kind === "unavailable")
				? { kind: "unavailable" }
				: result.value.some((value) => value.kind === "occupied")
					? { kind: "occupied" }
					: { kind: "free" };
		},
	});
	const shared = createSharedProjectController({
		...ports,
		repository,
		resources: repository.resources,
		library: repository.library,
		pinStaging: repository.pinStaging,
		portable: {
			feasibility: createBrowserRegisteredBackupFeasibility(
				ports.binaryChecksum,
			),
			encoder: new FflatePortableBackupEncoder(),
			decoder: new FflatePortableBackupDecoder(ports.binaryChecksum),
			smoke: new PortableBackupReadRenderSmokeCheck({
				checksum: ports.binaryChecksum,
			}),
			recoveryWriter: registered.writer,
			registeredTransfer: {
				decoder: admission,
				smoke: registered.smoke,
				admission,
				exporter: new ExportRuntimePortableBackupUseCase({
					checksum: ports.checksum,
					resources: repository.resources,
					smoke: registered.smoke,
					writer: registered.writer,
				}),
			},
		},
	});
	const guarded = guardRegisteredProjectController(
		shared.controller,
		active,
		session.signal,
		subscriptions,
		track,
		"Browser registered runtime is not admitted",
	);
	const forbidden = new Set<PropertyKey>([
			"create",
			"importProjectTransfer",
			"importProjectJson",
			"importPortableBackup",
			"importRecoveryDraft",
		]),
		refusals = new Map<PropertyKey, unknown>();
	controller = new Proxy(guarded, {
		get(target, property) {
			if (property === "startNewProject") {
				if (!refusals.has(property))
					refusals.set(property, () => {
						throw new Error(
							"Only explicit registered import can create a private browser Project",
						);
					});
				return refusals.get(property);
			}
			if (forbidden.has(property)) {
				if (!refusals.has(property))
					refusals.set(property, () => Promise.resolve({ kind: "not-ready" }));
				return refusals.get(property);
			}
			return Reflect.get(target, property, target);
		},
	});
	let directoryFlight: Promise<BrowserRegisteredDirectoryRead> | undefined;
	const inspect = async (): Promise<BrowserRegisteredDirectoryRead> => {
		if (!shellAdmitted || session.signal.aborted)
			return { kind: "unavailable" };
		const status = await storage.probe();
		if (status.kind !== "available") {
			if (status.kind === "not-provisioned") ready = true;
			return status;
		}
		await repository.recover();
		if (session.signal.aborted || !shellAdmitted)
			return { kind: "unavailable" };
		const directory = await repository.listProjects();
		if (session.signal.aborted || !shellAdmitted)
			return { kind: "unavailable" };
		ready = true;
		return { kind: "available", directory };
	};
	const readDirectory = (): Promise<BrowserRegisteredDirectoryRead> => {
		if (!shellAdmitted) return Promise.resolve({ kind: "unavailable" });
		if (session.signal.aborted)
			return storage
				.probe()
				.then((status) => ({
					kind:
						status.kind === "recovery-required"
							? "recovery-required"
							: "unavailable",
				}));
		if (!directoryFlight) {
			const result = owned(inspect).catch(
				(): BrowserRegisteredDirectoryRead => ({
					kind: session.signal.aborted ? "recovery-required" : "unavailable",
				}),
			);
			directoryFlight = result;
			void result.then(() => {
				if (directoryFlight === result) directoryFlight = undefined;
			});
		}
		return bounded(directoryFlight, timeout);
	};
	const readActualStartupInput = async () =>
		structuredClone(await context.readReleaseStartupInput());
	return {
		controller,
		readDirectory,
		readReleaseStartupInput: () => owned(readActualStartupInput),
		releaseStartup: {
			handshake(input) {
				return owned(async (): Promise<ReleaseStartupOutcome> => {
					if (session.signal.aborted)
						return { kind: "read-only/exportable", recovery: {} };
					try {
						const actual = await readActualStartupInput();
						if (
							!compatible(input, context) ||
							!compatible(actual, context) ||
							JSON.stringify(input.shellManifest) !==
								JSON.stringify(actual.shellManifest)
						) {
							ready = shellAdmitted = false;
							void session.revoke();
							input.onModeChange?.("read-only/exportable");
							return { kind: "read-only/exportable", recovery: {} };
						}
						shellAdmitted = true;
						const directory = await readDirectory();
						const kind =
							directory.kind === "available" ||
							directory.kind === "not-provisioned"
								? "writable"
								: "read-only/exportable";
						input.onModeChange?.(kind);
						return kind === "writable" && active()
							? { kind }
							: { kind: "read-only/exportable", recovery: {} };
					} catch {
						ready = shellAdmitted = false;
						void session.revoke();
						return { kind: "read-only/exportable", recovery: {} };
					}
				});
			},
		},
		dispose() {
			if (disposal) return disposal;
			let resolve: () => void = () => {},
				reject: (reason: unknown) => void = () => {};
			disposal = new Promise<void>((yes, no) => {
				resolve = yes;
				reject = no;
			});
			ready = shellAdmitted = false;
			for (const unsubscribe of [...subscriptions]) {
				try {
					unsubscribe();
				} catch {
					/* Other owned subscriptions and native drain must still finish. */
				}
			}
			const drain = session.revoke();
			void Promise.allSettled([...pending, drain])
				.then(() => storage.close())
				.then(resolve, reject);
			return disposal;
		},
	};
}
function compatible(
	input: ReleaseStartupInput,
	context: BrowserRegisteredRuntimeDependencies["context"],
): boolean {
	const manifest = input.shellManifest;
	return (
		context.secureContext &&
		typeof context.locks?.request === "function" &&
		typeof context.indexedDb?.open === "function" &&
		isReleaseManifest(manifest) &&
		[
			manifest.projectSchemas,
			manifest.assetSchemas,
			manifest.catalogSchemas,
		].every(
			(range) =>
				range.readable.length === 1 &&
				range.readable[0] === 1 &&
				range.writable.length === 1 &&
				range.writable[0] === 1,
		) &&
		manifest.minimumCapabilities.every(
			(capability) => input.capabilities[capability],
		) &&
		input.capabilities.indexeddb &&
		(input.hasControllingWorker === true
			? isReleaseManifest(input.workerManifest) &&
				JSON.stringify(input.workerManifest) === JSON.stringify(manifest)
			: input.workerManifest === undefined)
	);
}
function bounded(
	flight: Promise<BrowserRegisteredDirectoryRead>,
	milliseconds: number,
): Promise<BrowserRegisteredDirectoryRead> {
	return new Promise((resolve) => {
		const timer = setTimeout(
			() => resolve({ kind: "unavailable" }),
			milliseconds,
		);
		void flight.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve({ kind: "unavailable" });
			},
		);
	});
}
function browserContextWriter(
	context: BrowserRegisteredRuntimeDependencies["context"],
): {
	readonly ownerId: string;
	readonly takeover: WriterTakeoverRequirementStorePort;
} {
	const prefix = "interiors-editor-browser-registered-context-v1:";
	const storage: ContextStorage = {
		getItem: (key) => context.sessionStorage.getItem(`${prefix}${key}`),
		setItem: (key, value) =>
			context.sessionStorage.setItem(`${prefix}${key}`, value),
	};
	const ownerId = browserWriterOwnerId({
		sessionStorage: storage,
		navigationType: context.navigationType ?? "navigate",
		crypto: {
			randomUUID: context.crypto.randomUUID
				? () =>
						context.crypto.randomUUID?.() ??
						browserRandomUuid({
							getRandomValues: (bytes) => {
								bytes.set(
									context.crypto.getRandomValues(
										new Uint8Array(bytes.byteLength),
									),
								);
								return bytes;
							},
						})
				: undefined,
			getRandomValues: (bytes) => {
				bytes.set(
					context.crypto.getRandomValues(new Uint8Array(bytes.byteLength)),
				);
				return bytes;
			},
		},
	});
	if (!/^[0-9a-f-]{36}$/i.test(ownerId))
		throw new Error("Browser writer owner is unreadable");
	const key = (id: string) => {
		if (!id || id.length > 256) throw new Error("Invalid browser Project ID");
		let encoded = "";
		for (let index = 0; index < id.length; index++)
			encoded += id.charCodeAt(index).toString(16).padStart(4, "0");
		return `${prefix}takeover:${encoded}`;
	};
	return {
		ownerId,
		takeover: {
			requiresExplicitTakeover(id) {
				const value = context.sessionStorage.getItem(key(id));
				if (value === null || value === "cleared") return false;
				if (value === "required") return true;
				throw new Error("Browser writer acknowledgement is unreadable");
			},
			requireExplicitTakeover: (id) =>
				context.sessionStorage.setItem(key(id), "required"),
			clearExplicitTakeoverRequirement: (id) =>
				context.sessionStorage.setItem(key(id), "cleared"),
		},
	};
}
