import { TelegramProjectRepository } from "../adapters/persistence/telegram-project-repository";
import {
	TelegramScopeStore,
	type TelegramScopeAccess,
} from "../adapters/persistence/telegram-scope-store";
import {
	createTelegramContextState,
	type DrawingDimensionPreferenceStore,
} from "../adapters/telegram/context-state";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import type { BackupFeasibilityPolicyPort } from "../application/backup-feasibility-policy";
import { ExportRuntimePortableBackupUseCase } from "../application/export-runtime-portable-backup";
import type {
	PortableBackupArchiveWriterPort,
	ProjectSourceRecoveryPort,
} from "../application/ports";
import { browserRandomUuid } from "./browser-ports";
import type { ProjectController } from "./project-controller";
import type {
	ReleaseRuntimeCapabilities,
	ReleaseStartupInput,
	ReleaseStartupOutcome,
} from "./release-startup";
import {
	createSharedProjectController,
	type SharedProjectControllerDependencies,
} from "./shared-project-controller";
import {
	approveTelegramRelease,
	isApprovedTelegramRelease,
	type ApprovedTelegramRelease,
} from "./telegram-release-preflight";
import { TelegramRuntimeSession } from "./telegram-runtime-session";
import { guardRegisteredProjectController } from "./registered-project-controller";

type ContextStorage = Pick<Storage, "getItem" | "setItem">;

export interface TelegramRuntimeDependencies {
	readonly approval: ApprovedTelegramRelease;
	readonly scope: VerifiedTelegramScope;
	readonly context: {
		readonly indexedDb: Pick<IDBFactory, "open">;
		readonly databaseMode?: "compatible" | "exact";
		readonly locks: Pick<LockManager, "request">;
		readonly secureContext: boolean;
		readonly crypto: Pick<Crypto, "getRandomValues"> &
			Partial<Pick<Crypto, "randomUUID">>;
		readonly sessionStorage: ContextStorage;
		readonly localStorage: ContextStorage;
		readonly readCapabilities: () => ReleaseRuntimeCapabilities;
		readonly readWorker: (signal: AbortSignal) => Promise<{
			readonly hasControllingWorker: boolean;
			readonly workerManifest: unknown;
		}>;
	};
	readonly ports: Pick<
		SharedProjectControllerDependencies,
		"checksum" | "binaryChecksum" | "clock" | "ids" | "storageEstimate"
	> & {
		readonly portable: SharedProjectControllerDependencies["portable"] & {
			readonly writer: PortableBackupArchiveWriterPort;
			readonly feasibility: BackupFeasibilityPolicyPort;
		};
	};
}

export interface TelegramRuntime {
	readonly scope: VerifiedTelegramScope;
	readonly session: TelegramRuntimeSession;
	readonly controller: ProjectController;
	readonly drawingDimensions: DrawingDimensionPreferenceStore;
	readonly exactFloorYaw?: boolean;
	readonly sourceRecovery: ProjectSourceRecoveryPort;
	readonly releaseStartup: {
		handshake(input: ReleaseStartupInput): Promise<ReleaseStartupOutcome>;
	};
	readReleaseStartupInput(): Promise<ReleaseStartupInput>;
	/** Revocation is synchronous; the returned stable promise drains work and closes DB. */
	dispose(): Promise<void>;
}

/** The shared controller cannot touch storage before its current startup admission. */
class AdmittedScopeStore extends TelegramScopeStore {
	public constructor(
		session: TelegramRuntimeSession,
		context: ConstructorParameters<typeof TelegramScopeStore>[1],
		private readonly admitted: () => boolean,
	) {
		super(session, context);
	}

	public override run<T>(
		operation: (access: TelegramScopeAccess) => Promise<T>,
	): Promise<T> {
		return this.admitted()
			? super.run(operation)
			: Promise.reject(new Error("Telegram startup has not admitted storage"));
	}
}

/**
 * Isolated composition only. No entry, worker, migration/recovery sweep or codec
 * fallback is installed. Verified scope is supplied by signed-launch bootstrap;
 * the private preflight permit binds it to the actual loaded shell.
 */
export function createTelegramRuntime(
	dependencies: TelegramRuntimeDependencies,
): TelegramRuntime {
	if (!isApprovedTelegramRelease(dependencies.approval))
		throw new Error("Approved loaded Telegram release is required");
	const { approval, scope } = dependencies;
	if (typeof scope !== "string" || !/^tma-v1-[a-f0-9]{64}$/.test(scope))
		throw new Error("Verified Telegram scope is required");
	const context = { ...dependencies.context };
	const ports = { ...dependencies.ports };
	const decoder = ports.portable?.decoder;
	if (
		!context.secureContext ||
		typeof context.indexedDb?.open !== "function" ||
		typeof context.locks?.request !== "function" ||
		typeof context.crypto?.getRandomValues !== "function"
	)
		throw new Error("Secure Telegram storage capabilities are required");
	if (
		typeof context.sessionStorage?.getItem !== "function" ||
		typeof context.sessionStorage.setItem !== "function" ||
		typeof context.localStorage?.getItem !== "function" ||
		typeof context.localStorage.setItem !== "function"
	)
		throw new Error("Scoped Telegram technical storage is required");
	if (
		typeof ports.portable?.writer?.encode !== "function" ||
		typeof ports.portable.feasibility?.assess !== "function" ||
		typeof ports.portable.encoder?.encode !== "function" ||
		typeof decoder?.decode !== "function" ||
		typeof ports.portable.smoke?.verify !== "function"
	)
		throw new Error(
			"Registered portable writer, feasibility, codec and smoke ports are required",
		);

	const randomUUID = context.crypto.randomUUID;
	const ownerId = browserRandomUuid({
		...(randomUUID
			? { randomUUID: () => randomUUID.call(context.crypto) }
			: {}),
		getRandomValues(bytes) {
			// The shared helper accepts ArrayBufferLike views; native Web Crypto
			// accepts ordinary ArrayBuffer views. UUID allocation needs only16 bytes.
			bytes.set(
				context.crypto.getRandomValues(new Uint8Array(bytes.byteLength)),
			);
			return bytes;
		},
	});
	const session = new TelegramRuntimeSession(scope);
	const state = createTelegramContextState(scope, context);
	let admitted = false;
	let disposal: Promise<void> | undefined;
	const active = () => admitted && !session.signal.aborted;
	const pendingOperations = new Set<Promise<unknown>>();
	const subscriptions = new Set<() => void>();
	const track = <T>(operation: () => T | Promise<T>): Promise<T> => {
		if (!active())
			return Promise.reject(new Error("Telegram runtime is not admitted"));
		let resolveOperation: (value: T | PromiseLike<T>) => void = () => undefined;
		let rejectOperation: (reason: unknown) => void = () => undefined;
		// Register before invoking core: a synchronous port/listener can dispose
		// reentrantly before an async method has returned its promise.
		const pending = new Promise<T>((resolve, reject) => {
			resolveOperation = resolve;
			rejectOperation = reject;
		});
		pendingOperations.add(pending);
		void pending.then(
			() => pendingOperations.delete(pending),
			() => pendingOperations.delete(pending),
		);
		try {
			void Promise.resolve(operation()).then(resolveOperation, rejectOperation);
		} catch (error) {
			rejectOperation(error);
		}
		return pending;
	};
	const storage = new AdmittedScopeStore(session, context, active);
	let controller: ProjectController | undefined;
	const repository = new TelegramProjectRepository(storage, {
		ownerId,
		takeoverRequirements: state.writerTakeover,
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
	const shared = createSharedProjectController({
		...ports,
		portable: {
			...ports.portable,
			decoder: {
				async decode(archive, signal) {
					const result = await decoder.decode(archive, signal);
					if (result.kind !== "accepted" || result.projectMember?.format !== "runtime-v1-floor-yaw") return result;
					try {
						const permitted = await storage.run(async (access) => access.databaseVersion === 3);
						if (signal?.aborted) return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
						return permitted ? result : { kind: "rejected", reasonCode: "PORTABLE_BACKUP_FUTURE_SCHEMA" };
					} catch {
						return signal?.aborted ? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" } : { kind: "verification-unavailable" };
					}
				},
			},
			recoveryWriter: ports.portable.writer,
			// Construct only after the scoped repository exists. Neither a caller's
			// exporter nor a browser formatter can replace this actual resource port.
			exporter: new ExportRuntimePortableBackupUseCase({
				checksum: ports.checksum,
				resources: repository.resources,
				smoke: ports.portable.smoke,
				writer: ports.portable.writer,
			}),
		},
		repository,
		resources: repository.resources,
		library: repository.library,
		pinStaging: repository.pinStaging,
		probePinnedResourceByteLength: (hash) => repository.probePinnedResourceByteLength(hash),
	});
	controller = guardRegisteredProjectController(
		shared.controller,
		active,
		session.signal,
		subscriptions,
		track,
		"Telegram runtime is not admitted",
	);

	const readReleaseStartupInput = (): Promise<ReleaseStartupInput> =>
		session.run(async () => {
			try {
				const worker = await context.readWorker(session.signal);
				if (session.signal.aborted)
					throw new Error("Telegram runtime is closed");
				return {
					capabilities: { ...context.readCapabilities() },
					shellManifest: approval.manifest,
					hasControllingWorker: worker.hasControllingWorker,
					workerManifest: structuredClone(worker.workerManifest),
				};
			} catch {
				admitted = false;
				void session.revoke();
				throw new Error("Telegram startup context is unavailable");
			}
		});
	const compatible = (input: ReleaseStartupInput): boolean => {
		const checked = approveTelegramRelease({
			capsule: {
				deliveryTarget: "telegram",
				entryPath: approval.entryPath,
				manifest: input.shellManifest,
			},
			loadedEntryPath: approval.entryPath,
			capabilities: input.capabilities,
			secureContext: context.secureContext,
			webLocks: typeof context.locks.request === "function",
			hasControllingWorker: input.hasControllingWorker === true,
			workerManifest: input.workerManifest,
		});
		return (
			checked.kind === "approved" &&
			JSON.stringify(checked.approval.manifest) ===
				JSON.stringify(approval.manifest)
		);
	};
	const readonly = (input: ReleaseStartupInput): ReleaseStartupOutcome => {
		admitted = false;
		void session.revoke();
		try {
			input.onModeChange?.("read-only/exportable");
		} catch {
			/* Failure cannot grant storage admission. */
		}
		// An incompatible shell cannot open storage through this generation.
		// A valid admitted generation exposes unverified original source separately.
		return { kind: "read-only/exportable", recovery: {} };
	};

	return {
		scope,
		session,
		controller,
		exactFloorYaw: context.databaseMode === "exact",
		drawingDimensions: {
			read() {
				if (!active()) throw new Error("Telegram runtime is not admitted");
				return state.drawingDimensions.read();
			},
			write(raw) {
				if (!active()) throw new Error("Telegram runtime is not admitted");
				state.drawingDimensions.write(raw);
			},
		},
		sourceRecovery: {
			listRecoverySources: () => track(() => repository.listRecoverySources()),
			readRecoverySource: (projectId, revisionId) =>
				track(() => repository.readRecoverySource(projectId, revisionId)),
		},
		readReleaseStartupInput,
		releaseStartup: {
			async handshake(input) {
				admitted = false;
				try {
					if (
						session.signal.aborted ||
						!isApprovedTelegramRelease(approval) ||
						!compatible(input)
					)
						return readonly(input);
					const actual = await readReleaseStartupInput();
					if (
						session.signal.aborted ||
						!compatible(actual) ||
						!compatible(input)
					)
						return readonly(input);
					admitted = true;
					input.onModeChange?.("writable");
					return session.signal.aborted
						? readonly(input)
						: { kind: "writable" };
				} catch {
					return readonly(input);
				}
			},
		},
		dispose() {
			if (disposal) return disposal;
			let finish: () => void = () => undefined;
			let fail: (reason: unknown) => void = () => undefined;
			// Publish the promise before abort dispatch can reenter dispose.
			disposal = new Promise<void>((resolve, reject) => {
				finish = resolve;
				fail = reject;
			});
			admitted = false;
			for (const unsubscribe of [...subscriptions]) unsubscribe();
			const drain = session.revoke();
			void Promise.allSettled([...pendingOperations, drain])
				.then(() => storage.close())
				.then(finish, fail);
			return disposal;
		},
	};
}

