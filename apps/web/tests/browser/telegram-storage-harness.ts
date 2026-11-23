import type { VerifiedTelegramScope } from "../../src/adapters/telegram/signed-launch";
import { TelegramScopeStore } from "../../src/adapters/persistence/telegram-scope-store";
import { TelegramRuntimeSession } from "../../src/app/telegram-runtime-session";
import { TelegramProjectRepository } from "../../src/adapters/persistence/telegram-project-repository";
import {
	CreateProjectUseCase,
	canonicalProjectSerializer,
} from "../../src/application/create-project";
import { ConfigureRectangularRoomUseCase } from "../../src/application/configure-rectangular-room";
import {
	browserChecksum,
	browserBinaryChecksum,
	browserClock,
	browserIds,
} from "../../src/app/browser-ports";
import { createInitialProject } from "../../src/domain/initial-project";
import type {
	PinStagingLease,
	PublicationCandidate,
} from "../../src/application/ports";
import type { SessionHistoryRootSnapshot } from "../../src/application/session-retention-project-repository";
import { createTelegramContextState } from "../../src/adapters/telegram/context-state";
import { validateRuntimeV1Project } from "../../src/application/runtime-v1-project-validation";
import { approveReadableTelegramRelease } from "../../src/app/telegram-readable-release";
import { createRegisteredRuntimePortablePorts } from "../../src/adapters/portable-backup/registered-runtime-portable";
import { createTelegramReadonlyProjectSource } from "../../src/adapters/persistence/telegram-readonly-project-source";

// Explicit test-only entry. No product build imports this module or these fake scopes.
const scopes = {
	a: `tma-v1-${"a".repeat(64)}` as VerifiedTelegramScope,
	b: `tma-v1-${"b".repeat(64)}` as VerifiedTelegramScope,
};
const stores = new Map<string, TelegramScopeStore>();
const blockingConnections = new Map<keyof typeof scopes, IDBDatabase>();
const repositories = new Map<string, TelegramProjectRepository>();
const compositionOwners = new Map<string, { ownerId: string }>();
const sessionRoots = new Map<string, SessionHistoryRootSnapshot>();
const testClocks = new Map<string, number>();
const checksumHooks = new Map<string, () => Promise<void>>();
type VerificationFaultMode = "expiry-exact" | "expiry-after" | "resource-version";
const binaryVerificationHooks = new Map<string, (digest: string) => Promise<void>>();
type ResourceRaceField = "version" | "creationLeaseId" | "roots" | "durable";
const resourceRaceProofs = new Map<string, { field:ResourceRaceField; digestCalls:number; digestMatches:boolean; before:unknown; after:unknown; afterFaultSnapshot:unknown }>();
const verificationBoundaryProofs = new Map<string, {
	mode: VerificationFaultMode;
	digestMatches: boolean;
	beforeVersion: unknown;
	afterVersion: unknown;
	writerExpiry: number;
	verificationNow: number;
	afterFaultSnapshot: unknown;
}>();
type ProtocolMatrixStore = "publication-attempts" | "staging" | "pin-staging-leases";
type ProtocolMatrixFault =
	| "current-receipt-checksum"
	| "current-receipt-revision"
	| "current-receipt-manifest"
	| "current-receipt-extra"
	| "current-journal-version"
	| "current-journal-owner-number"
	| "current-journal-fence-zero"
	| "current-journal-base-number"
	| "current-journal-extra"
	| "pending-owner-binding"
	| "pending-fence-binding"
	| "pending-stage-scope"
	| "pending-stage-base"
	| "pending-stage-owner"
	| "pending-stage-checksum"
	| "pending-journal-no-publish"
	| "pending-pin-project"
	| "pending-pin-empty-hashes"
	| "pending-pin-marked-number";
const protocolMatrixBaselines = new Map<string, {
	scope: keyof typeof scopes;
	rows: Record<ProtocolMatrixStore, readonly unknown[]>;
}>();
const checksumFaultSnapshots = new Map<string, unknown>();
const preparedFixtures = new Map<
	string,
	{
		candidate: PublicationCandidate;
		lease: PinStagingLease;
		bytes: Uint8Array;
		base?: string;
	}
>();
let openCalls = 0;
let unlock: (() => void) | undefined;
let heldLock: Promise<void> | undefined;
const opensSettled: Promise<void>[] = [];
const activeHandles = new Set<IDBDatabase>();
const closing = new Map<string, Promise<void>>();
const lifecycle: string[] = [];
const activeAbortListeners = new Map<
	AbortSignal,
	Set<EventListenerOrEventListenerObject>
>();
const nativeAddListener = AbortSignal.prototype.addEventListener;
const nativeRemoveListener = AbortSignal.prototype.removeEventListener;
AbortSignal.prototype.addEventListener = function (
	this: AbortSignal,
	type: string,
	listener: EventListenerOrEventListenerObject | null,
	options?: boolean | AddEventListenerOptions,
) {
	if (type === "abort" && listener) {
		const listeners =
			activeAbortListeners.get(this) ??
			new Set<EventListenerOrEventListenerObject>();
		listeners.add(listener);
		activeAbortListeners.set(this, listeners);
	}
	if (listener) nativeAddListener.call(this, type, listener, options);
};
AbortSignal.prototype.removeEventListener = function (
	this: AbortSignal,
	type: string,
	listener: EventListenerOrEventListenerObject | null,
	options?: boolean | EventListenerOptions,
) {
	if (type === "abort" && listener)
		activeAbortListeners.get(this)?.delete(listener);
	if (listener) nativeRemoveListener.call(this, type, listener, options);
};
const trackedCompletions = new WeakSet<IDBTransaction>();
function beginClose(name: string) {
	const store = stores.get(name);
	if (!store) throw new Error("Unknown closing test store");
	closing.set(
		name,
		store.close().then(() => {
			lifecycle.push("closed");
		}),
	);
}
let failNextRead = false;
const nativeGet = IDBObjectStore.prototype.get;
IDBObjectStore.prototype.get = function (key) {
	const request = nativeGet.call(this, key);
	if (failNextRead && this.name === "scope-metadata") {
		failNextRead = false;
		Object.defineProperty(request, "error", {
			value: new DOMException(
				"Controlled storage read failure",
				"UnknownError",
			),
		});
		queueMicrotask(() => request.dispatchEvent(new Event("error")));
	}
	return request;
};
const durabilityModes: IDBTransactionDurability[] = [];
let relaxNextTransaction = false;
const nativeTransaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (names, mode, options) {
	const relax = relaxNextTransaction && mode === "readwrite";
	if (relax) relaxNextTransaction = false;
	const transaction = nativeTransaction.call(
		this,
		names,
		mode,
		relax ? { durability: "relaxed" } : options,
	);
	// Observe the real commit event before consumer promise callbacks can run.
	transaction.addEventListener(
		"complete",
		() => {
			if (trackedCompletions.has(transaction)) lifecycle.push("tx-complete");
		},
		{ once: true },
	);
	if (
		mode === "readwrite" &&
		this.name.startsWith("interiors-editor-projects:tma-v1-")
	) {
		durabilityModes.push(transaction.durability);
	}
	return transaction;
};

async function database(scope: keyof typeof scopes): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(
			`interiors-editor-projects:${scopes[scope]}`,
		);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

const harness = {
	async storageVersion(name: string) {
		const store = stores.get(name);
		if (!store) throw new Error("Unknown test store");
		return store.run(async access => access.databaseVersion);
	},
	async holdNativeConnection(scope: keyof typeof scopes) {
		if (blockingConnections.has(scope)) throw new Error("Connection already held");
		blockingConnections.set(scope, await database(scope));
	},
	releaseNativeConnection(scope: keyof typeof scopes) {
		blockingConnections.get(scope)?.close();
		blockingConnections.delete(scope);
	},
	async readDirectory(scope: keyof typeof scopes, acceptExactFloorYawStorage: boolean) {
		const permit = approveReadableTelegramRelease({
			capsule: {
				deliveryTarget: "telegram",
				entryPath: "/telegram.12345678.js",
				manifest: {
					appBuildId: "0123456789abcdef",
					assetSchemas: { readable: [1], writable: [1] },
					catalogSchemas: { readable: [1], writable: [1] },
					projectSchemas: { readable: [1], writable: [1] },
					minimumCapabilities: ["indexeddb"],
					version: 1,
					workerProtocolVersion: 1,
				},
			},
			loadedEntryPath: "/telegram.12345678.js",
			capabilities: { indexeddb: true, webgl2: false },
			secureContext: isSecureContext,
			hasControllingWorker: false,
			workerManifest: undefined,
		});
		if (permit.kind !== "approved") throw new Error("Missing readable test permit");
		const source = createTelegramReadonlyProjectSource({
			scope: scopes[scope],
			release: permit.approval,
			checksum: browserChecksum,
			binaryChecksum: browserBinaryChecksum,
			portable: createRegisteredRuntimePortablePorts({ binaryChecksum: browserBinaryChecksum }),
			technical: { indexedDb: indexedDB, locks: navigator.locks, secureContext: isSecureContext, acceptExactFloorYawStorage },
		});
		try {
			return { kind: "read" as const, directory: await source.listProjects() };
		} catch {
			return { kind: "denied" as const, revoked: source.signal.aborted };
		} finally {
			await source.dispose();
		}
	},
	async genericMarker(
		name: string,
		mode: "readonly" | "readwrite",
		value = "marker",
		failAfterPut = false,
	) {
		const store = stores.get(name);
		if (!store) throw new Error("Unknown test store");
		try {
			const result = await store.run((access) =>
				access.transact(["library"], mode, async (transaction) => {
					const library = transaction.objectStore("library");
					const request =
						mode === "readwrite"
							? library.put({ resourceHash: "test-marker", value })
							: library.get("test-marker");
					const row = await new Promise<unknown>((resolve, reject) => {
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					});
					if (failAfterPut)
						throw new Error(
							"Controlled callback failure after native put success",
						);
					return { scope: access.scope, row };
				}),
			);
			return { kind: "completed" as const, result };
		} catch {
			return { kind: "failed" as const };
		}
	},
	async callbackThrowAndLateReserve(name: string) {
		const store = stores.get(name);
		if (!store) throw new Error("Unknown test store");
		let escaped: (() => Promise<unknown>) | undefined;
		try {
			await store.run(async (access) => {
				escaped = () => access.reserveId("attempt");
				throw new Error("Controlled callback failure");
			});
		} catch {
			/* Expected. */
		}
		try {
			await escaped?.();
			return "admitted";
		} catch {
			return "denied";
		}
	},
	async lateAccessDuringDrain(name: string) {
		const store = stores.get(name);
		if (!store) throw new Error("Unknown test store");
		let late = "not-called";
		await store.run(async (access) => {
			void access.transact(["library"], "readwrite", async (transaction) => {
				await new Promise<void>((resolve, reject) => {
					const request = transaction
						.objectStore("library")
						.put({ resourceHash: "test-marker", value: "drained" });
					request.onerror = () => reject(request.error);
					request.onsuccess = async () => {
						try {
							await access.reserveId("attempt");
							late = "admitted";
						} catch {
							late = "denied";
						}
						resolve();
					};
				});
			});
		});
		return late;
	},
	async wrongInnerKind(name: string) {
		const store = stores.get(name);
		if (!store) throw new Error("Unknown test store");
		try {
			await store.run((access) => access.reserveId("wrong" as "attempt"));
			return "admitted";
		} catch {
			return "denied";
		}
	},
	async replaceMetadata(
		scope: keyof typeof scopes,
		records: readonly unknown[],
	) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction("scope-metadata", "readwrite");
				const store = transaction.objectStore("scope-metadata");
				store.clear();
				for (const row of records) store.put(row);
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	},
	rows: storedRows,
	async compositeReservations(name: string) {
		const store = stores.get(name);
		if (!store) throw new Error("Unknown test store");
		return store.run(async (access) => [
			await access.reserveId("attempt"),
			await access.reserveId("lease"),
		]);
	},
	async failingUnawaitedTransaction(name: string) {
		const store = stores.get(name);
		if (!store) throw new Error("Unknown test store");
		try {
			await store.run(async (access) => {
				void access.transact(
					["scope-metadata"],
					"readwrite",
					async (transaction) => {
						await new Promise<void>((resolve, reject) => {
							const request = transaction
								.objectStore("scope-metadata")
								.add({ key: "counter", lastReserved: "999" });
							request.onsuccess = () => resolve();
							request.onerror = () => reject(request.error);
						});
					},
				);
				return "must-not-be-durable";
			});
			return "succeeded";
		} catch {
			return "failed";
		}
	},
	async escapedTransaction(name: string) {
		const store = stores.get(name);
		if (!store) throw new Error("Unknown test store");
		let escaped: (() => Promise<unknown>) | undefined;
		await store.run(async (access) => {
			escaped = () =>
				access.transact(
					["scope-metadata"],
					"readwrite",
					async (transaction) => {
						transaction
							.objectStore("scope-metadata")
							.put({ key: "counter", lastReserved: "999" });
					},
				);
		});
		try {
			await escaped?.();
			return "succeeded";
		} catch {
			return "failed";
		}
	},
	async seedMetadataV1(
		scope: keyof typeof scopes,
		records?: readonly unknown[],
		unknownStore = false,
		shape: "normal" | "out-of-line" | "auto-increment" | "index" = "normal",
	) {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(
				`interiors-editor-projects:${scopes[scope]}`,
				1,
			);
			request.onupgradeneeded = () => {
				const store = request.result.createObjectStore("scope-metadata", {
					keyPath: shape === "out-of-line" ? null : "key",
					autoIncrement: shape === "auto-increment",
				});
				for (const record of records ?? [
					{ key: "identity", protocolVersion: 1, scope: scopes[scope] },
					{ key: "counter", lastReserved: "9007199254740993" },
				]) {
					if (shape === "out-of-line")
						store.add(record, String(Reflect.get(record as object, "key")));
					else store.add(record);
				}
				if (shape === "index")
					store.createIndex("unknown-index", "protocolVersion");
				if (unknownStore) request.result.createObjectStore("unknown-data");
			};
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				request.result.close();
				resolve();
			};
		});
	},
	async schema(scope: keyof typeof scopes) {
		const db = await database(scope);
		try {
			return { version: db.version, stores: Array.from(db.objectStoreNames) };
		} finally {
			db.close();
		}
	},
	async seedBadVersion2(scope: keyof typeof scopes) {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(
				`interiors-editor-projects:${scopes[scope]}`,
				2,
			);
			request.onupgradeneeded = () => {
				const metadata = request.result.createObjectStore("scope-metadata", {
					keyPath: "key",
				});
				metadata.add({
					key: "identity",
					protocolVersion: 1,
					scope: scopes[scope],
				});
				metadata.add({ key: "counter", lastReserved: "42" });
				for (const name of [
					"library",
					"pin-staging-leases",
					"projects",
					"publication-attempts",
					"resources",
					"revisions",
					"staging",
					"writer-fences",
				])
					request.result.createObjectStore(name, { keyPath: "wrongKey" });
			};
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				request.result.close();
				resolve();
			};
		});
	},
	async seedUnknownVersion2(
		scope: keyof typeof scopes,
		shape: "store" | "index",
	) {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(
				`interiors-editor-projects:${scopes[scope]}`,
				2,
			);
			request.onupgradeneeded = () => {
				for (const [name, keyPath] of Object.entries({
					"scope-metadata": "key",
					projects: "projectId",
					revisions: "revisionId",
					staging: "attemptId",
					"writer-fences": "projectId",
					"publication-attempts": "attemptId",
					"pin-staging-leases": "leaseId",
					resources: "resourceHash",
					library: "resourceHash",
				})) {
					const store = request.result.createObjectStore(name, { keyPath });
					if (name === "resources" && shape === "index")
						store.createIndex("unknown-index", "byteLength");
					if (name === "scope-metadata") {
						store.add({
							key: "identity",
							protocolVersion: 1,
							scope: scopes[scope],
						});
						store.add({ key: "counter", lastReserved: "42" });
					}
				}
				if (shape === "store") request.result.createObjectStore("unknown-data");
			};
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				request.result.close();
				resolve();
			};
		});
	},
	create(
		name: string,
		scope: keyof typeof scopes,
		capability:
			| "supported"
			| "no-locks"
			| "insecure"
			| "lock-fails"
			| "blocked-open"
			| "delete-before-rollback-open"
			| "close-on-open"
			| "close-after-lock" = "supported",
		databaseMode?: "compatible" | "exact",
		doorHingeMode?: "compatible" | "authoring",
	) {
		if (stores.has(name)) throw new Error("Duplicate test store");
		let blockNextOpen = capability === "blocked-open";
		const instanceName = name;
		stores.set(
			name,
			new TelegramScopeStore(new TelegramRuntimeSession(scopes[scope]), {
				indexedDb: {
					open: (name, version) => {
						openCalls += 1;
						const request = indexedDB.open(name, version);
						if (capability === "delete-before-rollback-open" && version === 2) {
							request.addEventListener("error", () => {
								if (request.error?.name === "VersionError") indexedDB.deleteDatabase(name);
							}, { once: true });
						}
						opensSettled.push(
							new Promise<void>((resolve) => {
								request.addEventListener(
									"success",
									() => {
										const database = request.result;
										activeHandles.add(database);
										const close = database.close.bind(database);
										database.close = () => {
											activeHandles.delete(database);
											close();
										};
										// Wait until every native event callback, including the subject,
										// has run; Promise microtasks can run between DOM listeners.
										setTimeout(resolve, 0);
									},
									{
										once: true,
									},
								);
								request.addEventListener(
									"error",
									() => setTimeout(resolve, 0),
									{
										once: true,
									},
								);
							}),
						);
						if (blockNextOpen) {
							blockNextOpen = false;
							queueMicrotask(() => request.dispatchEvent(new Event("blocked")));
						}
						if (capability === "close-on-open")
							queueMicrotask(() => beginClose(instanceName));
						return request;
					},
				},
				locks:
					capability === "no-locks"
						? undefined
						: capability === "lock-fails"
							? {
									request: async () => {
										throw new Error("Lock request rejected");
									},
								}
							: capability === "close-after-lock"
								? {
										// Forward the exact 3-argument overload used by the subject.
										request: ((
											lockName: string,
											options: LockOptions,
											callback: LockGrantedCallback<unknown>,
										) =>
											navigator.locks.request(lockName, options, (lock) => {
												beginClose(instanceName);
												return callback(lock);
											})) as LockManager["request"],
									}
								: navigator.locks,
				secureContext: capability !== "insecure" && isSecureContext,
				...(databaseMode ? { databaseMode } : {}),
				...(doorHingeMode ? { doorHingeMode } : {}),
			}),
		);
	},
	async reserve(name: string, kind: "attempt" | "lease") {
		try {
			const store = stores.get(name);
			if (!store) throw new Error("Unknown test store");
			return { kind: "reserved" as const, id: await store.reserveId(kind) };
		} catch (error) {
			return {
				kind: "failed" as const,
				message: error instanceof Error ? error.message : "failure",
			};
		}
	},
	async close(name: string) {
		await stores.get(name)?.close();
		stores.delete(name);
	},
	get openCalls() {
		return openCalls;
	},
	get activeHandles() {
		return activeHandles.size;
	},
	get retainedAbortCallbacks() {
		return [...activeAbortListeners.values()].reduce(
			(total, listeners) => total + listeners.size,
			0,
		);
	},
	get lifecycle() {
		return [...lifecycle];
	},
	async awaitClose(name: string) {
		await closing.get(name);
	},
	failNextRead() {
		failNextRead = true;
	},
	preventDefaultWriteFailure() {
		const put = IDBObjectStore.prototype.put;
		const add = IDBObjectStore.prototype.add;
		IDBObjectStore.prototype.put = function (
			value: unknown,
			key?: IDBValidKey,
		) {
			if (
				this.name === "scope-metadata" &&
				value &&
				typeof value === "object" &&
				Reflect.get(value, "key") === "counter"
			) {
				IDBObjectStore.prototype.put = put;
				// Counter already exists: real native ConstraintError, with default
				// abort cancelled. The subject must still reject and abort safely.
				const request = add.call(this, value, key);
				request.addEventListener("error", (event) => event.preventDefault(), {
					once: true,
				});
				return request;
			}
			return put.call(this, value, key);
		};
	},
	closeOnCounterRequest(name: string, initialization = false) {
		const method = initialization ? "add" : "put";
		const original = IDBObjectStore.prototype[method];
		IDBObjectStore.prototype[method] = function (
			value: unknown,
			key?: IDBValidKey,
		) {
			const request = original.call(this, value, key);
			if (
				this.name === "scope-metadata" &&
				value &&
				typeof value === "object" &&
				Reflect.get(value, "key") === "counter"
			) {
				IDBObjectStore.prototype[method] = original;
				if (initialization)
					this.transaction.addEventListener(
						"complete",
						() => {
							lifecycle.push("tx-complete");
						},
						{ once: true },
					);
				else trackedCompletions.add(this.transaction);
				request.addEventListener(
					"success",
					() => {
						lifecycle.push("request-success");
						beginClose(name);
					},
					{ once: true },
				);
			}
			return request;
		};
	},
	get durabilityModes() {
		return [...durabilityModes];
	},
	relaxNextTransaction() {
		relaxNextTransaction = true;
	},
	async settleOpens() {
		await Promise.all(opensSettled);
	},
	async upgrade(scope: keyof typeof scopes, version = 3) {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(
				`interiors-editor-projects:${scopes[scope]}`,
				version,
			);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				request.result.close();
				resolve();
			};
		});
	},
	async records(scope: keyof typeof scopes) {
		const db = await database(scope);
		try {
			return await new Promise<unknown[]>((resolve, reject) => {
				const transaction = db.transaction("scope-metadata", "readonly");
				const request = transaction.objectStore("scope-metadata").getAll();
				transaction.oncomplete = () => resolve(request.result);
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	},
	async edit(scope: keyof typeof scopes, record: unknown, deleteKey?: string) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction("scope-metadata", "readwrite");
				const target = transaction.objectStore("scope-metadata");
				if (deleteKey) target.delete(deleteKey);
				else target.put(record);
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	},
	async hold(scope: keyof typeof scopes) {
		if (heldLock) throw new Error("Test lock already held");
		let entered: () => void = () => undefined;
		const admitted = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const released = new Promise<void>((resolve) => {
			unlock = resolve;
		});
		heldLock = navigator.locks.request(
			`interiors-tma-storage-v1:${scopes[scope]}`,
			async () => {
				entered();
				await released;
			},
		);
		await admitted;
	},
	async release() {
		unlock?.();
		await heldLock;
		heldLock = undefined;
		unlock = undefined;
	},
	/** Real native transaction abort, after the put request succeeds but before commit. */
	abortNextCounterWrite() {
		const original = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (
			value: unknown,
			key?: IDBValidKey,
		) {
			const request = original.call(this, value, key);
			if (
				this.name === "scope-metadata" &&
				value &&
				typeof value === "object" &&
				Reflect.get(value, "key") === "counter"
			) {
				IDBObjectStore.prototype.put = original;
				request.addEventListener("success", () => this.transaction.abort(), {
					once: true,
				});
			}
			return request;
		};
	},
	abortInitialization() {
		const original = IDBObjectStore.prototype.add;
		IDBObjectStore.prototype.add = function (
			value: unknown,
			key?: IDBValidKey,
		) {
			const request = original.call(this, value, key);
			if (
				this.name === "scope-metadata" &&
				value &&
				typeof value === "object" &&
				Reflect.get(value, "key") === "counter"
			) {
				IDBObjectStore.prototype.add = original;
				request.addEventListener("success", () => this.transaction.abort(), {
					once: true,
				});
			}
			return request;
		};
	},
};

function repository(name: string) {
	const value = repositories.get(name);
	if (!value) throw new Error("Unknown project test runtime");
	return value;
}

async function storedRows(
	scope: keyof typeof scopes,
	name: string,
): Promise<unknown[]> {
	const db = await database(scope);
	try {
		return await new Promise((resolve, reject) => {
			const transaction = db.transaction(name, "readonly");
			const request = transaction.objectStore(name).getAll();
			transaction.oncomplete = () => resolve(request.result);
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		db.close();
	}
}

const projectHarness = {
 async registerInvalidPreparedLibrary(name:string,key:string,mode:"asset-id"|"asset-name"|"asset-width"|"asset-format"|"asset-hash"|"declared-size"|"wrong-exact-bytes"){
  const {candidate,bytes,lease}=preparedFixture(key),asset=structuredClone(candidate.project.assetDefinitionRefs[0]);
  const resource={resourceHash:lease.resourceHashes[0],bytes:bytes.slice()};
  if(mode==="asset-id")Reflect.set(asset,"assetDefinitionId",17);
  else if(mode==="asset-name")Reflect.set(asset,"displayName","");
  else if(mode==="asset-width")Reflect.set(asset,"widthMm",0.5);
  else if(mode==="asset-format")Reflect.set(asset,"format","fbx");
  else if(mode==="asset-hash")Reflect.set(asset,"resourceHash","f".repeat(64));
  else if(mode==="declared-size")Reflect.set(asset,"byteLength",bytes.byteLength+1);
  else resource.bytes=Uint8Array.from(resource.bytes,value=>value^0x55);
  return repository(name).library.register(asset,resource,{restoreRemoved:false});
 },
 async libraryFault(scope:keyof typeof scopes,field:"scope"|"asset-hash"|"asset-id"|"asset-width"|"asset-size"|"asset-format"|"removed"|"extra"){
  const rows=await storedRows(scope,"library");if(rows.length!==1)throw new Error("Library matrix requires exactly one genuine row");
  const row=rows[0];if(!row||typeof row!=="object")throw new Error("Missing library row");const asset=Reflect.get(row,"asset");if(!asset||typeof asset!=="object")throw new Error("Missing library asset");
  const changed=field==="scope"?{...row,scope:scopes.b}:field==="removed"?{...row,removed:"not-boolean"}:field==="extra"?{...row,unregistered:true}:{...row,asset:{...asset,...(field==="asset-hash"?{resourceHash:"f".repeat(64)}:field==="asset-id"?{assetDefinitionId:17}:field==="asset-width"?{widthMm:0.5}:field==="asset-size"?{byteLength:0}:{format:"fbx"})}};
  const db=await database(scope);try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("library","readwrite",{durability:"strict"});tx.objectStore("library").put(changed);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}
  return row;
 },
 async restoreLibraryRow(scope:keyof typeof scopes,row:unknown){const db=await database(scope);try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("library","readwrite",{durability:"strict"});tx.objectStore("library").put(row);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}},

 corruptRepairInput(key:string){const fixture=preparedFixture(key);fixture.bytes=Uint8Array.from(fixture.bytes,value=>value^0x55);},

 async armResourceCAS(name:string,scope:keyof typeof scopes,key:string,field:ResourceRaceField){
  const fixture=preparedFixture(key),hash=fixture.lease.resourceHashes[0],store=stores.get(name);
  if(!store)throw new Error("Missing native CAS store");
  const fresh=await store.reserveId("lease");let digestCalls=0;
  const hook=async(digest:string)=>{
   digestCalls++;if(digest!==hash)throw new Error("CAS hook did not observe exact native SHA");
   if(digestCalls===1){binaryVerificationHooks.set(name,hook);return;}
   if(digestCalls!==2)throw new Error("CAS hook did not target existing Blob verification");
   const row=matrixRecord(await storedRows(scope,"resources"),"resourceHash",hash);
   if(!Array.isArray(row.roots)||!row.roots.length||row.durable!==true)throw new Error("CAS requires a genuine published still-pinned resource");
   const replacement=field==="roots"?[...row.roots,fresh]:field==="durable"?false:fresh;
   const db=await database(scope);
   try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("resources","readwrite",{durability:"strict"});tx.objectStore("resources").put({...row,[field]:replacement});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}
   resourceRaceProofs.set(key,{field,digestCalls,digestMatches:true,before:row[field],after:replacement,afterFaultSnapshot:await projectHarness.protocolSnapshot(scope)});
  };
  binaryVerificationHooks.set(name,hook);
 },
 resourceCASProof(key:string){return resourceRaceProofs.get(key);},

 async sparsePublishedPin(name: string, scope: keyof typeof scopes, projectId: string, revisionId: string) {
  const creation=matrixRecord(await storedRows(scope,"publication-attempts"),"revisionId",revisionId),store=stores.get(name);
  if(!store||creation.state!=="published"||typeof creation.attemptId!=="string"||typeof creation.serializedProject!=="string")throw new Error("Missing genuine published pin fixture");
  const leaseId=await store.reserveId("lease"),resourceHashes=new Array<unknown>(1),db=await database(scope);
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(["publication-attempts","pin-staging-leases"],"readwrite",{durability:"strict"});tx.objectStore("publication-attempts").put({...creation,leaseId});tx.objectStore("pin-staging-leases").add({scope:scopes[scope],leaseId,attemptId:creation.attemptId,projectId,revisionId,marked:true,resourceHashes});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}
  const pin=matrixRecord(await storedRows(scope,"pin-staging-leases"),"leaseId",leaseId);
  if(!Array.isArray(pin.resourceHashes))throw new Error("Missing native sparse pin hashes");
  return{nativeLength:pin.resourceHashes.length,nativeOwnKeys:Object.keys(pin.resourceHashes),originalSource:creation.serializedProject};
 },
	/** Corrupt only native resource root metadata, keeping actual bytes/version/proofs intact. */
 async sparseResourceRoots(scope: keyof typeof scopes, key: string) {
  const hash=preparedFixture(key).lease.resourceHashes[0];
  const row=matrixRecord(await storedRows(scope,"resources"),"resourceHash",hash);
  const roots=new Array<unknown>(1),db=await database(scope);
  try {await new Promise<void>((resolve,reject)=>{const tx=db.transaction("resources","readwrite",{durability:"strict"});tx.objectStore("resources").put({...row,roots});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}
  const current=matrixRecord(await storedRows(scope,"resources"),"resourceHash",hash);
  if(!Array.isArray(current.roots))throw new Error("Missing native sparse resource roots");
  return {nativeLength:current.roots.length,nativeOwnKeys:Object.keys(current.roots),durableBefore:row.durable,durableAfter:current.durable};
 },
	/** Persist one sparse manifest value in all redundant metadata copies, preserving source bytes. */
	async sparseCurrentManifest(scope: keyof typeof scopes, revisionId: string) {
		const revisions = await storedRows(scope, "revisions");
		const revision = matrixRecord(revisions, "revisionId", revisionId);
		if (typeof revision.creationAttemptId !== "string") throw new Error("Missing genuine creation ID");
		const attempts = await storedRows(scope, "publication-attempts");
		const creation = matrixRecord(attempts, "attemptId", revision.creationAttemptId);
		const receipt = creation.receipt;
		if (creation.state !== "published" || typeof creation.serializedProject !== "string" || !receipt || typeof receipt !== "object") throw new Error("Missing genuine published receipt");
		const sparse = new Array<unknown>(1);
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(["revisions", "publication-attempts"], "readwrite", { durability: "strict" });
				tx.objectStore("revisions").put({ ...revision, resourceManifest: sparse });
				tx.objectStore("publication-attempts").put({ ...creation, resourceManifest: sparse, receipt: { ...receipt, resourceManifest: sparse } });
				tx.oncomplete = () => resolve();
				tx.onabort = () => reject(tx.error);
			});
		} finally { db.close(); }
		const stored = matrixRecord(await storedRows(scope, "revisions"), "revisionId", revisionId);
		const manifest = stored.resourceManifest;
		if (!Array.isArray(manifest)) throw new Error("Native sparse fixture was not an Array");
		return { nativeLength: manifest.length, nativeOwnKeys: Object.keys(manifest), originalSource: creation.serializedProject };
	},
	async captureProtocolMatrix(key: string, scope: keyof typeof scopes) {
		const rows = {
			"publication-attempts": await storedRows(scope, "publication-attempts"),
			staging: await storedRows(scope, "staging"),
			"pin-staging-leases": await storedRows(scope, "pin-staging-leases"),
		};
		const creation = matrixRecord(rows["publication-attempts"], "revisionId", "matrix-r1");
		const prepared = matrixRecord(rows["publication-attempts"], "revisionId", "matrix-r2");
		if (creation.state !== "published" || prepared.state !== "prepared" || typeof creation.serializedProject !== "string") throw new Error("Matrix must come from actual publication and native pointer abort");
		protocolMatrixBaselines.set(key, { scope, rows });
		return { currentSource: creation.serializedProject, publishedAttemptId: creation.attemptId, preparedAttemptId: prepared.attemptId };
	},
	async restoreProtocolMatrix(key: string) {
		const baseline = protocolMatrixBaselines.get(key);
		if (!baseline) throw new Error("Unknown matrix baseline");
		await replaceMatrixStores(baseline.scope, baseline.rows);
	},
	async applyProtocolMatrixFault(key: string, fault: ProtocolMatrixFault) {
		const baseline = protocolMatrixBaselines.get(key);
		if (!baseline) throw new Error("Unknown matrix baseline");
		const { rows, scope } = baseline;
		const current = matrixRecord(rows["publication-attempts"], "revisionId", "matrix-r1");
		const prepared = matrixRecord(rows["publication-attempts"], "revisionId", "matrix-r2");
		const stage = matrixRecord(rows.staging, "revisionId", "matrix-r2");
		const pin = matrixRecord(rows["pin-staging-leases"], "revisionId", "matrix-r2");
		const changes: Partial<Record<ProtocolMatrixStore, readonly unknown[]>> = {};
		const change = (store: ProtocolMatrixStore, original: unknown, value: Record<string, unknown>) => {
			changes[store] = rows[store].map(row => row === original ? value : row);
		};
		if (fault.startsWith("current-receipt-")) {
			const receipt: unknown = current.receipt;
			if (!receipt || typeof receipt !== "object") throw new Error("Missing genuine current receipt");
			const patch = fault === "current-receipt-checksum" ? { checksum: "0".repeat(64) }
				: fault === "current-receipt-revision" ? { revisionId: "other-revision" }
					: fault === "current-receipt-manifest" ? { resourceManifest: [{ resourceHash: "f".repeat(64), byteLength: 1 }] }
						: { unknownReceiptMeaning: true };
			change("publication-attempts", current, { ...current, receipt: { ...receipt, ...patch } });
		} else {
			switch (fault) {
				case "current-journal-version": change("publication-attempts", current, { ...current, protocolVersion: 2 }); break;
				case "current-journal-owner-number": change("publication-attempts", current, { ...current, ownerId: 7 }); break;
				case "current-journal-fence-zero": change("publication-attempts", current, { ...current, fencingToken: 0 }); break;
				case "current-journal-base-number": change("publication-attempts", current, { ...current, expectedBaseRevisionId: 7 }); break;
				case "current-journal-extra": change("publication-attempts", current, { ...current, unknownJournalMeaning: true }); break;
				case "pending-owner-binding":
					change("publication-attempts", prepared, { ...prepared, ownerId: "other-runtime-owner" });
					change("staging", stage, { ...stage, ownerId: "other-runtime-owner" });
					break;
				case "pending-fence-binding":
					change("publication-attempts", prepared, { ...prepared, fencingToken: 2 });
					change("staging", stage, { ...stage, fencingToken: 2 });
					break;
				case "pending-stage-scope": change("staging", stage, { ...stage, scope: scopes.b }); break;
				case "pending-stage-base": change("staging", stage, { ...stage, expectedBaseRevisionId: "other-base" }); break;
				case "pending-stage-owner": change("staging", stage, { ...stage, ownerId: "other-runtime-owner" }); break;
				case "pending-stage-checksum": change("staging", stage, { ...stage, checksum: "0".repeat(64) }); break;
				case "pending-journal-no-publish": change("publication-attempts", prepared, { ...prepared, state: "no-publish" }); break;
				case "pending-pin-project": change("pin-staging-leases", pin, { ...pin, projectId: "other-project" }); break;
				case "pending-pin-empty-hashes": change("pin-staging-leases", pin, { ...pin, resourceHashes: [] }); break;
				case "pending-pin-marked-number": change("pin-staging-leases", pin, { ...pin, marked: 7 }); break;
				default: throw new Error("Unknown protocol matrix fault");
			}
		}
		await replaceMatrixStores(scope, changes);
		return { replicatedOneLogicalField: fault === "pending-owner-binding" || fault === "pending-fence-binding", changedStores: Object.keys(changes) };
	},
	/** Change only the operation's embedded scope and matching inline key/reference. */
	async foreignCreationOperation(scope: keyof typeof scopes, projectId: string, revisionId: string) {
		const revisions = await storedRows(scope, "revisions");
		const revision = revisions.find(row => row !== null && typeof row === "object" && Reflect.get(row, "revisionId") === revisionId);
		if (!revision || typeof revision !== "object") throw new Error("Missing genuine current Revision");
		const originalAttemptId: unknown = Reflect.get(revision, "creationAttemptId");
		if (typeof originalAttemptId !== "string") throw new Error("Missing genuine creation ID");
		const attempts = await storedRows(scope, "publication-attempts");
		const attempt = attempts.find(row => row !== null && typeof row === "object" && Reflect.get(row, "attemptId") === originalAttemptId);
		if (!attempt || typeof attempt !== "object" || Reflect.get(attempt, "projectId") !== projectId || Reflect.get(attempt, "state") !== "published") throw new Error("Missing genuine published creation receipt");
		const serializedProject: unknown = Reflect.get(attempt, "serializedProject");
		if (typeof serializedProject !== "string") throw new Error("Missing original source");
		const foreignScope = scope === "a" ? scopes.b : scopes.a;
		const foreignAttemptId = `tma-v1:${foreignScope}:attempt:1`;
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(["revisions", "publication-attempts"], "readwrite", { durability: "strict" });
				tx.objectStore("revisions").put({ ...revision, creationAttemptId: foreignAttemptId });
				const journals = tx.objectStore("publication-attempts");
				journals.put({ ...attempt, attemptId: foreignAttemptId });
				journals.delete(originalAttemptId);
				tx.oncomplete = () => resolve();
				tx.onabort = () => reject(tx.error);
			});
		} finally { db.close(); }
		return { originalAttemptId, foreignAttemptId, originalRowScope: Reflect.get(attempt, "scope"), originalSerializedProject: serializedProject };
	},

	/** Controlled native corruption of a genuine row; inline IDB keys are never faked. */
	async changeStoredRow(
		scope: keyof typeof scopes,
		storeName:
			| "projects"
			| "revisions"
			| "staging"
			| "publication-attempts"
			| "pin-staging-leases"
			| "writer-fences",
		key: IDBValidKey,
		patch: Record<string, unknown> | null,
		remove: readonly string[] = [],
	) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction(storeName, "readwrite");
				const store = transaction.objectStore(storeName);
				const request = store.get(key);
				request.onsuccess = () => {
					if (patch === null) store.delete(key);
					else {
						if (!request.result || typeof request.result !== "object") {
							transaction.abort();
							return;
						}
						const changed = { ...request.result, ...patch };
						for (const field of remove) delete changed[field];
						store.put(changed);
					}
				};
				transaction.oncomplete = () => resolve();
				transaction.onabort = () =>
					reject(transaction.error ?? new Error("Missing native fixture row"));
			});
		} finally {
			db.close();
		}
	},
	async protocolSnapshot(scope: keyof typeof scopes) {
		const names = [
			"projects",
			"revisions",
			"staging",
			"publication-attempts",
			"pin-staging-leases",
			"writer-fences",
			"scope-metadata",
			"resources",
			"library",
		];
		return Promise.all(
			names.map(async (name) => ({
				name,
				rows: await Promise.all(
					(await storedRows(scope, name)).map(async (row) => {
						if (!row || typeof row !== "object") return row;
						const blob: unknown = Reflect.get(row, "blob");
						return blob instanceof Blob
							? { ...row, blob: [...new Uint8Array(await blob.arrayBuffer())] }
							: row;
					}),
				),
			})),
		);
	},
	armCurrentProofRace(name: string, scope: keyof typeof scopes): void {
		checksumHooks.set(name, async () => {
			await projectHarness.corruptCurrentProof(scope, "wrong-digest");
			checksumFaultSnapshots.set(
				name,
				await projectHarness.protocolSnapshot(scope),
			);
		});
	},
	checksumRaceSnapshot(name: string): unknown {
		return checksumFaultSnapshots.get(name);
	},
	recoverySources(name: string) {
		return repository(name).listRecoverySources();
	},
	readRecoverySource(name: string, projectId: string, revisionId: string) {
		return repository(name).readRecoverySource(projectId, revisionId);
	},
	async futureRevision(scope: keyof typeof scopes, revisionId: string) {
		const db = await database(scope);
		try {
			const row: unknown = await new Promise<unknown>((resolve, reject) => {
				const tx = db.transaction("revisions", "readonly");
				const request = tx.objectStore("revisions").get(revisionId);
				tx.oncomplete = () => resolve(request.result);
				tx.onabort = () => reject(tx.error);
			});
			if (!row || typeof row !== "object")
				throw new Error("Missing stored fixture");
			const candidate: unknown = Reflect.get(row, "candidate");
			if (!candidate || typeof candidate !== "object")
				throw new Error("Missing fixture candidate");
			const originalProject: unknown = Reflect.get(candidate, "project");
			const originalRevision: unknown = Reflect.get(candidate, "revision");
			if (
				!originalProject ||
				typeof originalProject !== "object" ||
				!originalRevision ||
				typeof originalRevision !== "object"
			)
				throw new Error("Missing fixture source");
			const project = { ...originalProject, schemaVersion: 99 };
			const serializedProject = JSON.stringify(project);
			const checksum = await browserChecksum.sha256(serializedProject);
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction("revisions", "readwrite");
				tx.objectStore("revisions").put({
					...row,
					candidate: {
						project,
						revision: {
							...originalRevision,
							schemaVersion: 99,
							serializedProject,
							checksum,
						},
					},
				});
				tx.oncomplete = () => resolve();
				tx.onabort = () => reject(tx.error);
			});
			return serializedProject;
		} finally {
			db.close();
		}
	},
	setNow(name: string, now: number) {
		testClocks.set(name, now);
	},
	async unknownJournalField(scope: keyof typeof scopes, revisionId: string) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction("publication-attempts", "readwrite");
				const store = tx.objectStore("publication-attempts");
				const request = store.openCursor();
				request.onsuccess = () => {
					const cursor = request.result;
					if (!cursor) return;
					if (cursor.value.revisionId === revisionId)
						cursor.update({
							...cursor.value,
							unregisteredRecoveryMeaning: true,
						});
					else cursor.continue();
				};
				tx.oncomplete = () => resolve();
				tx.onabort = () => reject(tx.error);
			});
		} finally {
			db.close();
		}
	},
	abortNextMutation(storeName: string, operation: "put" | "delete") {
		if (operation === "delete") {
			const original = IDBObjectStore.prototype.delete;
			IDBObjectStore.prototype.delete = function (query) {
				const request = original.call(this, query);
				if (this.name === storeName) {
					IDBObjectStore.prototype.delete = original;
					request.addEventListener("success", () => this.transaction.abort(), {
						once: true,
					});
				}
				return request;
			};
		} else {
			const original = IDBObjectStore.prototype.put;
			IDBObjectStore.prototype.put = function (
				value: unknown,
				key?: IDBValidKey,
			) {
				const request = original.call(this, value, key);
				if (this.name === storeName) {
					IDBObjectStore.prototype.put = original;
					request.addEventListener("success", () => this.transaction.abort(), {
						once: true,
					});
				}
				return request;
			};
		}
	},
	async registerPreparedLibrary(
		name: string,
		key: string,
		restoreRemoved = false,
	) {
		const { candidate, bytes, lease } = preparedFixture(key);
		return repository(name).library.register(
			candidate.project.assetDefinitionRefs[0],
			{ bytes, resourceHash: lease.resourceHashes[0] },
			{ restoreRemoved },
		);
	},
	library(name: string) {
		return repository(name).library.list();
	},
	removeLibrary(name: string, assetId: string) {
		return repository(name).library.remove?.(assetId);
	},
	async repairRoots(
		name: string,
		scope: keyof typeof scopes,
		currentRevisionId: string,
		undoIds: readonly string[],
	) {
		const rows = await storedRows(scope, "revisions");
		const candidate = (id: string): PublicationCandidate => {
			const row = rows.find(
				(row) =>
					row &&
					typeof row === "object" &&
					Reflect.get(row, "revisionId") === id,
			);
			if (!row || typeof row !== "object")
				throw new Error("Missing repair root");
			return Reflect.get(row, "candidate");
		};
		sessionRoots.set(name, {
			current: candidate(currentRevisionId),
			undo: undoIds.map(candidate),
			redo: [],
		});
	},
	async repairPrepared(name: string, keys: readonly string[]) {
		const write = repository(name).resources.writeReplacingBatch;
		if (!write) throw new Error("Missing exact repair capability");
		await write(
			keys.map((key) => {
				const fixture = preparedFixture(key);
				return {
					resourceHash: fixture.lease.resourceHashes[0],
					bytes: fixture.bytes,
				};
			}),
		);
	},
	async corruptPreparedResource(scope: keyof typeof scopes, key: string) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction("resources", "readwrite");
				const store = tx.objectStore("resources");
				const request = store.get(preparedFixture(key).lease.resourceHashes[0]);
				request.onsuccess = () => {
					const row = request.result;
					store.put({
						...row,
						blob: new Blob([new Uint8Array(row.byteLength).fill(99)]),
					});
				};
				tx.oncomplete = () => resolve();
				tx.onabort = () => reject(tx.error);
			});
		} finally {
			db.close();
		}
	},
	async prepareResource(
		name: string,
		key: string,
		projectId: string,
		revisionId: string,
		data: readonly number[],
		base?: string,
	) {
		const bytes = Uint8Array.from(data);
		const hash = await browserBinaryChecksum.sha256Bytes(bytes);
		const project = {
			...createInitialProject({
				createdAt: "2026-11-04T12:00:00.000Z",
				projectId,
				levelId: `${projectId}-level`,
				name: `${projectId}:${revisionId}`,
			}),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "custom",
					byteLength: bytes.byteLength,
					depthMm: 100,
					displayName: "Локальная модель",
					format: "glb" as const,
					heightMm: 100,
					resourceHash: hash,
					widthMm: 100,
				},
			],
		};
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const candidate: PublicationCandidate = {
			project,
			revision: {
				projectId,
				revisionId,
				schemaVersion: 1,
				createdAt: project.createdAt,
				serializedProject,
				checksum: await browserChecksum.sha256(serializedProject),
			},
		};
		const lease = await repository(name).pinStaging.begin([hash], {
			candidate,
			expectedBaseRevisionId: base,
		});
		preparedFixtures.set(key, { candidate, lease, bytes, base });
		return lease;
	},
	async prepareTwoResources(name: string) {
		const payloads = [Uint8Array.of(11, 12), Uint8Array.of(21, 22, 23)];
		const hashes = await Promise.all(
			payloads.map((bytes) => browserBinaryChecksum.sha256Bytes(bytes)),
		);
		const project = {
			...createInitialProject({
				createdAt: "2026-11-04T12:00:00.000Z",
				projectId: "p1",
				levelId: "pair-level",
				name: "Pair",
			}),
			assetDefinitionRefs: hashes.map((resourceHash, index) => ({
				assetDefinitionId: `custom-${index}`,
				byteLength: payloads[index].byteLength,
				depthMm: 100,
				displayName: "Локальная модель",
				format: "glb" as const,
				heightMm: 100,
				resourceHash,
				widthMm: 100,
			})),
		};
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const candidate: PublicationCandidate = {
			project,
			revision: {
				projectId: "p1",
				revisionId: "r1",
				schemaVersion: 1,
				createdAt: project.createdAt,
				serializedProject,
				checksum: await browserChecksum.sha256(serializedProject),
			},
		};
		const lease = await repository(name).pinStaging.begin(hashes, {
			candidate,
		});
		preparedFixtures.set("pair", { candidate, lease, bytes: payloads[0] });
		for (const [index, bytes] of payloads.entries())
			await repository(name).resources.writeIfAbsentPinned?.(
				{ resourceHash: hashes[index], bytes },
				lease.leaseId,
			);
		return lease;
	},
	async writePrepared(name: string, key: string) {
		const fixture = preparedFixture(key);
		return repository(name).resources.writeIfAbsentPinned?.(
			{ resourceHash: fixture.lease.resourceHashes[0], bytes: fixture.bytes },
			fixture.lease.leaseId,
		);
	},
	async publishPrepared(name: string, key: string) {
		const { candidate, lease, base } = preparedFixture(key);
		await repository(name).pinStaging.markForPublication(lease, {
			projectId: candidate.project.projectId,
			revisionId: candidate.revision.revisionId,
		});
		return repository(name).publish(candidate, base);
	},
	/** Execute one fault only after the real binary digest of the captured resource. */
	async armVerificationBoundary(
		name: string,
		scope: keyof typeof scopes,
		key: string,
		mode: VerificationFaultMode,
	) {
		const fixture = preparedFixture(key);
		const hash = fixture.lease.resourceHashes[0];
		const resource = (await storedRows(scope, "resources")).find(row =>
			row !== null && typeof row === "object" && Reflect.get(row, "resourceHash") === hash,
		);
		const writer = (await storedRows(scope, "writer-fences")).find(row =>
			row !== null && typeof row === "object" && Reflect.get(row, "projectId") === fixture.candidate.project.projectId,
		);
		if (!resource || typeof resource !== "object" || !writer || typeof writer !== "object") throw new Error("Missing native boundary fixture");
		const writerExpiry: unknown = Reflect.get(writer, "expiresAtEpochMs");
		if (typeof writerExpiry !== "number") throw new Error("Missing actual lease expiry");
		const beforeVersion: unknown = Reflect.get(resource, "version");
		const store = stores.get(name);
		if (!store) throw new Error("Missing boundary scope store");
		// A real, durably reserved fresh version satisfies the normal row grammar.
		const replacement = mode === "resource-version" ? await store.reserveId("lease") : undefined;
		binaryVerificationHooks.set(name, async digest => {
			if (digest !== hash) throw new Error("Boundary hook did not observe the actual resource digest");
			if (mode === "resource-version") {
				const db = await database(scope);
				try {
					await new Promise<void>((resolve, reject) => {
						const tx = db.transaction("resources", "readwrite", { durability: "strict" });
						const records = tx.objectStore("resources"), request = records.get(hash);
						request.onsuccess = () => records.put({ ...request.result, version: replacement });
						tx.oncomplete = () => resolve();
						tx.onabort = () => reject(tx.error);
					});
				} finally { db.close(); }
			} else {
				testClocks.set(name, writerExpiry + (mode === "expiry-after" ? 1 : 0));
			}
			verificationBoundaryProofs.set(key, {
				mode, digestMatches: true, beforeVersion,
				afterVersion: replacement ?? beforeVersion,
				writerExpiry, verificationNow: testClocks.get(name) ?? Date.now(),
				afterFaultSnapshot: await projectHarness.protocolSnapshot(scope),
			});
		});
	},
	verificationBoundaryProof(key: string) { return verificationBoundaryProofs.get(key); },
	completePrepared(name: string, key: string) {
		return repository(name).pinStaging.complete(preparedFixture(key).lease);
	},
	discardPrepared(name: string, key: string) {
		return repository(name).pinStaging.discard(preparedFixture(key).lease);
	},
	async resourceBytes(name: string, key: string) {
		const bytes = await repository(name).resources.read(
			preparedFixture(key).lease.resourceHashes[0],
		);
		return bytes && [...bytes];
	},
	recover(name: string) {
		return repository(name).recover();
	},
	deleteProject(name: string, projectId: string) {
		return repository(name).permanentlyDeleteProject(projectId);
	},
	async unknownStage(scope: keyof typeof scopes, projectId: string) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction("staging", "readwrite");
				tx.objectStore("staging").add({
					attemptId: "legacy-unknown",
					projectId,
					source: "unrecognized-old-record",
					retainedBytes: [91, 92],
				});
				tx.oncomplete = () => resolve();
				tx.onabort = () => reject(tx.error);
			});
		} finally {
			db.close();
		}
	},
	create(name: string, scope: keyof typeof scopes, ownerId: string) {
		harness.create(name, scope);
		const store = stores.get(name);
		if (!store) throw new Error("Missing test scope store");
		const dependencies = {
			ownerId,
			nowEpochMs: () => testClocks.get(name) ?? Date.now(),
			takeoverRequirements: createTelegramContextState(scopes[scope], {
				sessionStorage: window.sessionStorage,
				localStorage: window.localStorage,
			}).writerTakeover,
			checksum: {
				async sha256(value: string) {
					const digest = await browserChecksum.sha256(value);
					const hook = checksumHooks.get(name);
					checksumHooks.delete(name);
					await hook?.();
					return digest;
				},
			},
			binaryChecksum: {async sha256Bytes(bytes:Uint8Array){const digest=await browserBinaryChecksum.sha256Bytes(bytes);const hook=binaryVerificationHooks.get(name);binaryVerificationHooks.delete(name);await hook?.(digest);return digest;}},
			sessionRoots: () =>
				sessionRoots.get(name) ?? { current: undefined, undo: [], redo: [] },
		};
		compositionOwners.set(name, dependencies);
		repositories.set(name, new TelegramProjectRepository(store, dependencies));
	},
	changeCompositionOwner(name: string, ownerId: string) {
		const options = compositionOwners.get(name);
		if (!options) throw new Error("Missing mutable composition test options");
		options.ownerId = ownerId;
	},
	async createProject(name: string, title: string) {
		return new CreateProjectUseCase({
			checksum: browserChecksum,
			clock: browserClock,
			ids: browserIds,
			repository: repository(name),
			serializer: canonicalProjectSerializer,
		}).execute(title, () => undefined);
	},
	async configure(name: string, projectId: string, widthMm: string) {
		const loaded = await repository(name).loadProject(projectId);
		if (
			loaded.kind !== "durable" ||
			loaded.candidate.project.schemaVersion !== 1 ||
			loaded.candidate.revision.schemaVersion !== 1
		)
			throw new Error("Missing V1 test Project");
		return new ConfigureRectangularRoomUseCase({
			checksum: browserChecksum,
			clock: browserClock,
			ids: browserIds,
			repository: repository(name),
			serializer: canonicalProjectSerializer,
		}).execute(
			{
				project: loaded.candidate.project,
				revision: loaded.candidate.revision,
			},
			{ widthMm, depthMm: "3000", heightMm: "2600" },
			() => undefined,
		);
	},
	load(name: string, projectId: string) {
		return repository(name).loadProject(projectId);
	},
	list(name: string) {
		return repository(name).listProjects();
	},
	access(name: string, projectId: string) {
		return repository(name).inspectWriterAccess(projectId);
	},
	takeover(name: string, projectId: string) {
		return repository(name).takeOverWriterLease(projectId);
	},
	lost(name: string) {
		return repository(name).consumeLostWriterLease();
	},
	async close(name: string) {
		repositories.delete(name);
		await harness.close(name);
	},
	rows: storedRows,
	async publishFixture(
		name: string,
		projectId: string,
		revisionId: string,
		expectedBaseRevisionId?: string,
	) {
		const project = createInitialProject({
			createdAt: "2026-11-04T12:00:00.000Z",
			projectId,
			levelId: `${projectId}-level`,
			name: `${projectId}:${revisionId}`,
		});
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const candidate = {
			project,
			revision: {
				projectId,
				revisionId,
				schemaVersion: 1 as const,
				createdAt: project.createdAt,
				serializedProject,
				checksum: await browserChecksum.sha256(serializedProject),
			},
		};
		return repository(name).publish(candidate, expectedBaseRevisionId);
	},
	/** Untrusted incoming values exercise the public repository, not stored-row corruption. */
	async publishInvalidIncoming(name: string, mode: "checksum" | "domain") {
		const initial = createInitialProject({
			createdAt: "2026-11-04T12:00:00.000Z",
			projectId: `invalid-${mode}`,
			levelId: `invalid-${mode}-level`,
			name: `Invalid ${mode}`,
		});
		const project = mode === "domain" ? {
			...initial,
			level: { ...initial.level, wallSegments: [{
				wallSegmentId: "dangling-wall",
				startVertexId: "missing-start",
				endVertexId: "missing-end",
				thicknessMm: 100,
			}] },
		} : initial;
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const actualChecksum = await browserChecksum.sha256(serializedProject);
		const candidate = {
			project,
			revision: {
				projectId: project.projectId,
				revisionId: `invalid-${mode}-revision`,
				schemaVersion: 1 as const,
				createdAt: project.createdAt,
				serializedProject,
				checksum: mode === "checksum" ? "0".repeat(64) : actualChecksum,
			},
		};
		const sourceBefore = structuredClone(candidate);
		const validation = validateRuntimeV1Project(project);
		return {
			publication: await repository(name).publish(candidate),
			validation,
			checksumMatches: candidate.revision.checksum === actualChecksum,
			sourceBefore,
			sourceAfter: candidate,
		};
	},
	async existingRevision(
		name: string,
		scope: keyof typeof scopes,
		revisionId: string,
		base: string,
		intent?: "history",
	) {
		const records = await storedRows(scope, "revisions");
		const record = records.find(
			(record) =>
				record &&
				typeof record === "object" &&
				Reflect.get(record, "revisionId") === revisionId,
		);
		if (!record || typeof record !== "object")
			throw new Error("Missing test Revision");
		return repository(name).publishNextRevision(
			Reflect.get(record, "candidate"),
			base,
			intent,
		);
	},
	async borrowRevisionCandidate(
		scope: keyof typeof scopes,
		fromRevisionId: string,
		targetRevisionId: string,
	) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction("revisions", "readwrite");
				const store = transaction.objectStore("revisions");
				const source = store.get(fromRevisionId);
				source.onsuccess = () => {
					const target = store.get(targetRevisionId);
					target.onsuccess = () =>
						store.put({ ...target.result, candidate: source.result.candidate });
				};
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	},
	async deleteWriterRow(scope: keyof typeof scopes, projectId: string) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction("writer-fences", "readwrite");
				transaction.objectStore("writer-fences").delete(projectId);
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	},
	async leaveOnlyPreparedPinRoots(scope: keyof typeof scopes) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const names = [
					"writer-fences",
					"revisions",
					"staging",
					"publication-attempts",
				];
				const transaction = db.transaction(names, "readwrite");
				for (const name of names) transaction.objectStore(name).clear();
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	},
	async corruptCurrentProof(
		scope: keyof typeof scopes,
		mode:
			| "missing-revision"
			| "missing-receipt"
			| "changed-revision"
			| "changed-creation-id"
			| "wrong-digest"
			| "non-index-array-property",
	) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction(
					["revisions", "publication-attempts"],
					"readwrite",
				);
				const revisions = transaction.objectStore("revisions");
				const request = revisions.get("r1");
				request.onsuccess = () => {
					const row = request.result;
					if (mode === "missing-revision") revisions.delete("r1");
					else if (mode === "missing-receipt")
						transaction
							.objectStore("publication-attempts")
							.delete(row.creationAttemptId);
					else if (mode === "changed-creation-id")
						revisions.put({ ...row, creationAttemptId: "unowned-creation" });
					else if (mode === "non-index-array-property") {
						Object.defineProperty(row.candidate.project.level.vertices, "historical", { value: "source-only", enumerable: true });
						revisions.put(row);
					}
					else if (mode === "wrong-digest") {
						const checksum = "consistently-wrong-digest";
						revisions.put({
							...row,
							candidate: {
								...row.candidate,
								revision: { ...row.candidate.revision, checksum },
							},
						});
						const journal = transaction.objectStore("publication-attempts");
						const creation = journal.get(row.creationAttemptId);
						creation.onsuccess = () =>
							journal.put({
								...creation.result,
								checksum,
								receipt: { ...creation.result.receipt, checksum },
							});
					} else
						revisions.put({
							...row,
							candidate: {
								...row.candidate,
								project: {
									...row.candidate.project,
									name: "Unverified replacement",
								},
							},
						});
				};
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	},
	async leavePinRootsWithFence(scope: keyof typeof scopes) {
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const names = ["revisions", "staging", "publication-attempts"];
				const transaction = db.transaction(names, "readwrite");
				for (const name of names) transaction.objectStore(name).clear();
				transaction.oncomplete = () => resolve();
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	},
	async corruptCurrentDomain(scope: keyof typeof scopes) {
		const rows = await storedRows(scope, "revisions");
		const row = rows.find((value) => value && typeof value === "object" && Reflect.get(value, "revisionId") === "r1");
		if (!row || typeof row !== "object") throw new Error("Missing fixture Revision");
		const candidate: PublicationCandidate = Reflect.get(row, "candidate");
		const project = { ...candidate.project, level: { ...candidate.project.level, vertices: [{ vertexId: "bad-1", xMm: 0, zMm: 0 }, { vertexId: "bad-2", xMm: 300, zMm: 100 }], wallSegments: [{ wallSegmentId: "bad-wall", startVertexId: "bad-1", endVertexId: "bad-2", thicknessMm: 100 }] } };
		const serializedProject = canonicalProjectSerializer.serialize(project);
		const checksum = await browserChecksum.sha256(serializedProject);
		const creationAttemptId = Reflect.get(row, "creationAttemptId");
		const journals = await storedRows(scope, "publication-attempts");
		const creation = journals.find((value) => value && typeof value === "object" && Reflect.get(value, "attemptId") === creationAttemptId);
		if (!creation || typeof creation !== "object") throw new Error("Missing fixture receipt");
		const db = await database(scope);
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction(["revisions", "publication-attempts"], "readwrite");
				transaction.objectStore("revisions").put({ ...row, candidate: { project, revision: { ...candidate.revision, serializedProject, checksum } } });
				transaction.objectStore("publication-attempts").put({ ...creation, serializedProject, checksum, receipt: { ...Reflect.get(creation, "receipt"), checksum } });
				transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error);
			});
		} finally { db.close(); }
	},
	abortNextProjectPointer() {
		const put = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (
			value: unknown,
			key?: IDBValidKey,
		) {
			const request = put.call(this, value, key);
			if (this.name === "projects") {
				IDBObjectStore.prototype.put = put;
				request.addEventListener("success", () => this.transaction.abort(), {
					once: true,
				});
			}
			return request;
		};
	},
};

function preparedFixture(key: string) {
	const fixture = preparedFixtures.get(key);
	if (!fixture) throw new Error("Unknown prepared fixture");
	return fixture;
}

function matrixRecord(rows: readonly unknown[], field: string, value: string): Record<string, unknown> {
	const result = rows.find((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row) && Reflect.get(row, field) === value);
	if (!result) throw new Error(`Missing genuine matrix ${field}`);
	return result;
}

async function replaceMatrixStores(scope: keyof typeof scopes, changes: Partial<Record<ProtocolMatrixStore, readonly unknown[]>>) {
	const names = Object.keys(changes);
	if (!names.length) throw new Error("Empty matrix fault");
	const db = await database(scope);
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(names, "readwrite", { durability: "strict" });
			for (const [name, rows] of Object.entries(changes)) {
				const store = tx.objectStore(name);
				store.clear();
				for (const row of rows) store.add(row);
			}
			tx.oncomplete = () => resolve();
			tx.onabort = () => reject(tx.error);
		});
	} finally { db.close(); }
}

declare global {
	interface Window {
		__telegramScopeHarness: typeof harness;
		__telegramProjectHarness: typeof projectHarness;
	}
}
window.__telegramScopeHarness = harness;
window.__telegramProjectHarness = projectHarness;
document.title = "Telegram scoped storage test harness";
document.body.textContent = "Native storage test harness";
