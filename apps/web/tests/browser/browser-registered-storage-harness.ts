import { BrowserRegisteredStorageSession } from "../../src/app/browser-registered-storage-session";
import type { ScopedProjectAccess } from "../../src/adapters/persistence/scoped-project-protocol";
import { BrowserRegisteredScopeStore } from "../../src/adapters/persistence/browser-registered-scope-store";

const databaseName = "interiors-editor-browser-registered";
const entries = new Map<
	string,
	{
		session: BrowserRegisteredStorageSession;
		store: BrowserRegisteredScopeStore;
	}
>();
const openedHandles = new Set<IDBDatabase>();
const opensSettled: Promise<void>[] = [];
const escaped = new Map<string, ScopedProjectAccess>();
const cancellation = new Map<string, AbortController>();
let releaseLock: (() => void) | undefined;
let heldLock: Promise<unknown> | undefined;
const harness = {
	create(
		name: string,
		options?: {
			readonly blocked?: boolean;
			readonly delaySuccessMs?: number;
			readonly openTimeoutMs?: number;
			readonly noLocks?: boolean;
			readonly insecure?: boolean;
		},
	) {
		const session = new BrowserRegisteredStorageSession();
		const indexedDb: Pick<IDBFactory, "open"> = {
			open: (name, version) => {
				const operation =
					version === undefined
						? indexedDB.open(name)
						: indexedDB.open(name, version);
				opensSettled.push(
					new Promise<void>((resolve) => {
						operation.addEventListener("error", () => resolve(), {
							once: true,
						});
						operation.addEventListener(
							"success",
							() => {
								const database = operation.result,
									close = database.close.bind(database);
								openedHandles.add(database);
								database.close = () => {
									openedHandles.delete(database);
									close();
								};
								resolve();
							},
							{ once: true },
						);
					}),
				);
				if (options?.blocked)
					queueMicrotask(() =>
						operation.dispatchEvent(
							new IDBVersionChangeEvent("blocked", {
								oldVersion: 0,
								newVersion: 1,
							}),
						),
					);
				if (!options?.delaySuccessMs) return operation;
				// Only event delivery is delayed; request/handle/transactions are native.
				return new Proxy(operation, {
					get(target, key) {
						const value = Reflect.get(target, key, target);
						return typeof value === "function" ? value.bind(target) : value;
					},
					set(target, key, value) {
						if (key === "onsuccess" && typeof value === "function") {
							target.onsuccess = (event) => {
								setTimeout(
									() => value.call(target, event),
									options.delaySuccessMs,
								);
							};
							return true;
						}
						return Reflect.set(target, key, value, target);
					},
				});
			},
		};
		const store = new BrowserRegisteredScopeStore(session, {
			indexedDb,
			...(options?.noLocks ? {} : { locks: navigator.locks }),
			secureContext: options?.insecure ? false : isSecureContext,
			...(options?.openTimeoutMs === undefined
				? {}
				: { openTimeoutMs: options.openTimeoutMs }),
		});
		entries.set(name, { session, store });
	},
	openCount() {
		return opensSettled.length;
	},
	async settled() {
		await Promise.all(opensSettled);
	},
	handles() {
		return openedHandles.size;
	},

	async sessionQueue() {
		const session = new BrowserRegisteredStorageSession(),
			events: string[] = [];
		let release = () => {},
			started = () => {};
		const gate = new Promise<void>((resolve) => {
				release = resolve;
			}),
			began = new Promise<void>((resolve) => {
				started = resolve;
			});
		const first = session.run(async () => {
			events.push("first-started");
			started();
			await gate;
			events.push("first-completed");
			return "first";
		});
		await began;
		const queued = session.run(async () => {
			events.push("queued-started");
			return "queued";
		});
		void queued.catch(() => undefined);
		let drained = false;
		const closing = session.revoke().then(() => {
			drained = true;
		});
		const before = {
			aborted: session.signal.aborted,
			drained,
			events: [...events],
		};
		release();
		const results = await Promise.allSettled([first, queued]);
		await closing;
		const after = await session
			.run(async () => "late")
			.then(
				() => "accepted",
				() => "refused",
			);
		return {
			before,
			events,
			outcomes: results.map((result) => result.status),
			drained,
			after,
		};
	},
	inspectAccess(name: string) {
		return entry(name).store.run(async (access) => ({
			scope: access.scope,
			aborted: access.signal.aborted,
			sameSignal: access.signal === entry(name).session.signal,
		}));
	},
	probe: (name: string) => entry(name).store.probe(),
	async provision(name: string) {
		try {
			await entry(name).store.provisionForRegisteredImport();
			return { kind: "available" };
		} catch (error) {
			return failure(error);
		}
	},
	async reserve(name: string, kind: "attempt" | "lease" = "attempt") {
		try {
			return { kind: "reserved", id: await entry(name).store.reserveId(kind) };
		} catch (error) {
			return failure(error);
		}
	},
	async provisionPrecancelled(name: string) {
		const controller = new AbortController();
		controller.abort();
		try {
			await entry(name).store.provisionForRegisteredImport(controller.signal);
			return { kind: "unexpected-success" };
		} catch (error) {
			return failure(error);
		}
	},
	async preventedRequestError(name: string) {
		const nativePut = IDBObjectStore.prototype.put,
			nativeAdd = IDBObjectStore.prototype.add;
		let prevented = false;
		IDBObjectStore.prototype.put = function (value, key) {
			if (this.name !== "scope-metadata" || value?.key !== "counter")
				return key === undefined
					? nativePut.call(this, value)
					: nativePut.call(this, value, key);
			const operation = nativeAdd.call(this, value);
			operation.addEventListener("error", (event) => {
				event.preventDefault();
				prevented = true;
			});
			return operation;
		};
		try {
			const result = await harness.reserve(name);
			return { result, prevented };
		} finally {
			IDBObjectStore.prototype.put = nativePut;
		}
	},
	async createMalformedDatabase(
		fault:
			| "missing-store"
			| "extra-store"
			| "key-path"
			| "auto-increment"
			| "index",
	) {
		const schema = {
			"scope-metadata": "key",
			projects: "projectId",
			revisions: "revisionId",
			staging: "attemptId",
			"writer-fences": "projectId",
			"publication-attempts": "attemptId",
			"pin-staging-leases": "leaseId",
			resources: "resourceHash",
			library: "resourceHash",
		};
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open(databaseName, 1);
			opening.onupgradeneeded = () => {
				for (const [name, keyPath] of Object.entries(schema)) {
					if (fault === "missing-store" && name === "library") continue;
					const store = opening.result.createObjectStore(name, {
						keyPath:
							fault === "key-path" && name === "resources"
								? "wrongKey"
								: keyPath,
						autoIncrement: fault === "auto-increment" && name === "resources",
					});
					if (fault === "index" && name === "resources")
						store.createIndex("foreign-index", "resourceHash");
				}
				if (fault === "extra-store")
					opening.result.createObjectStore("foreign-store");
				const metadata = opening.transaction?.objectStore("scope-metadata");
				metadata?.add({
					key: "identity",
					protocolVersion: 1,
					namespace: "browser-registered-v1",
				});
				metadata?.add({ key: "counter", lastReserved: "7" });
			};
			opening.onsuccess = () => {
				opening.result.close();
				resolve();
			};
			opening.onerror = () => reject(opening.error);
		});
	},
	async provisionCancelable(name: string) {
		const controller = new AbortController();
		cancellation.set(name, controller);
		try {
			await entry(name).store.provisionForRegisteredImport(controller.signal);
			return { kind: "available" };
		} catch (error) {
			return failure(error);
		} finally {
			cancellation.delete(name);
		}
	},
	cancelProvision(name: string) {
		cancellation.get(name)?.abort();
	},
	async strictFallback(name: string) {
		const native = IDBDatabase.prototype.transaction;
		IDBDatabase.prototype.transaction = function (names, mode, options) {
			return native.call(
				this,
				names,
				mode,
				mode === "readwrite" ? { durability: "relaxed" } : options,
			);
		};
		try {
			return await harness.provision(name);
		} finally {
			IDBDatabase.prototype.transaction = native;
		}
	},
	async abortCallback(name: string, unawaited = false) {
		try {
			await entry(name).store.run(async (access) => {
				const work = access.transact(
					["library"],
					"readwrite",
					async (transaction) => {
						await request(
							transaction
								.objectStore("library")
								.put({ resourceHash: "test-only-aborted" }),
						);
						throw new Error(
							"Controlled callback failure after native put success",
						);
					},
				);
				if (unawaited) {
					void work.catch(() => undefined);
					return;
				}
				await work;
			});
			return { kind: "unexpected-success" };
		} catch {
			return { kind: "rejected" };
		}
	},
	captureAccess(name: string) {
		return entry(name).store.run(async (access) => {
			escaped.set(name, access);
		});
	},
	async escapedReserve(name: string) {
		try {
			const access = escaped.get(name);
			if (!access) throw new Error("Missing escaped fixture");
			await access.reserveId("lease");
			return { kind: "unexpected-success" };
		} catch (error) {
			return failure(error);
		}
	},
	async revokeAfterNativeCounterPut(name: string) {
		const nativePut = IDBObjectStore.prototype.put,
			nativeTransaction = IDBDatabase.prototype.transaction;
		let outcome = false;
		// Register this observer at native transaction creation, before the adapter's
		// completion promise: microtasks may run between native event callbacks.
		IDBDatabase.prototype.transaction = function (names, mode, options) {
			const transaction = nativeTransaction.call(this, names, mode, options);
			if (mode === "readwrite") {
				transaction.addEventListener("complete", () => {
					outcome = true;
				});
				transaction.addEventListener("abort", () => {
					outcome = true;
				});
			}
			return transaction;
		};
		IDBObjectStore.prototype.put = function (value, key) {
			const operation =
				key === undefined
					? nativePut.call(this, value)
					: nativePut.call(this, value, key);
			if (this.name === "scope-metadata" && value?.key === "counter")
				operation.addEventListener("success", () => {
					void entry(name).session.revoke();
				});
			return operation;
		};
		try {
			const result = await harness.reserve(name);
			return { result, outcome };
		} finally {
			IDBObjectStore.prototype.put = nativePut;
			IDBDatabase.prototype.transaction = nativeTransaction;
		}
	},

	async abortInitialization(name: string) {
		const native = IDBObjectStore.prototype.add;
		IDBObjectStore.prototype.add = function (value, key) {
			const operation =
				key === undefined
					? native.call(this, value)
					: native.call(this, value, key);
			if (this.name === "scope-metadata" && value?.key === "identity")
				operation.addEventListener("success", () => this.transaction.abort());
			return operation;
		};
		try {
			return await harness.provision(name);
		} finally {
			IDBObjectStore.prototype.add = native;
		}
	},
	async probeWhileSchemaCompletionRevokes(name: string) {
		const native = IDBDatabase.prototype.transaction,
			state = { metadataStarted: false, metadataOutcome: false };
		let triggered = false;
		IDBDatabase.prototype.transaction = function (names, mode, options) {
			const transaction = native.call(this, names, mode, options);
			const list = typeof names === "string" ? [names] : Array.from(names);
			if (!triggered && list.length === 9 && mode === "readonly") {
				triggered = true;
				transaction.addEventListener("complete", () => {
					void entry(name).session.revoke();
				});
			} else if (
				list.length === 1 &&
				list[0] === "scope-metadata" &&
				mode === "readonly"
			) {
				state.metadataStarted = true;
				transaction.addEventListener("complete", () => {
					state.metadataOutcome = true;
				});
				transaction.addEventListener("abort", () => {
					state.metadataOutcome = true;
				});
				const keepAlive = () => {
					if (entry(name).session.signal.aborted) return;
					const count = transaction.objectStore("scope-metadata").count();
					count.onsuccess = keepAlive;
					count.onerror = (event) => event.preventDefault();
				};
				keepAlive();
			}
			return transaction;
		};
		try {
			const status = await entry(name).store.probe();
			return { status, ...state };
		} finally {
			IDBDatabase.prototype.transaction = native;
		}
	},
	async deleteDatabase() {
		await request(indexedDB.deleteDatabase(databaseName));
	},
	async createFutureDatabase() {
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open(databaseName, 2);
			opening.onupgradeneeded = () =>
				opening.result.createObjectStore("foreign");
			opening.onsuccess = () => {
				opening.result.close();
				resolve();
			};
			opening.onerror = () => reject(opening.error);
		});
	},
	close: (name: string) => entry(name).store.close(),
	async names() {
		return (await indexedDB.databases())
			.map((database) => database.name)
			.sort();
	},
	async snapshot() {
		const database = await existingDatabase();
		try {
			const names = [...database.objectStoreNames];
			const transaction = database.transaction(names, "readonly");
			const rows = await Promise.all(
				names.map(async (name) => ({
					name,
					keyPath: transaction.objectStore(name).keyPath,
					indexes: [...transaction.objectStore(name).indexNames],
					rows: await request(transaction.objectStore(name).getAll()),
				})),
			);
			return { version: database.version, stores: rows };
		} finally {
			database.close();
		}
	},
	async editMetadata(key: string, value: unknown, remove = false) {
		const database = await existingDatabase();
		try {
			const transaction = database.transaction("scope-metadata", "readwrite", {
				durability: "strict",
			});
			const done = completion(transaction);
			const store = transaction.objectStore("scope-metadata");
			if (remove) store.delete(key);
			else store.put(value);
			await done;
		} finally {
			database.close();
		}
	},
	async holdLock() {
		let granted = () => {};
		const started = new Promise<void>((resolve) => {
			granted = resolve;
		});
		heldLock = navigator.locks.request(
			"interiors-browser-registered-v1",
			async () => {
				await new Promise<void>((resolve) => {
					releaseLock = resolve;
					granted();
				});
			},
		);
		await started;
	},
	async releaseLock() {
		releaseLock?.();
		await heldLock;
		releaseLock = undefined;
		heldLock = undefined;
	},
};
function entry(name: string) {
	const found = entries.get(name);
	if (!found) throw new Error("Unknown fixture context");
	return found;
}
function failure(error: unknown) {
	return {
		kind:
			error instanceof Error && "kind" in error
				? String(error.kind)
				: "unexpected-error",
	};
}
function request<T>(operation: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		operation.onsuccess = () => resolve(operation.result);
		operation.onerror = () => reject(operation.error);
	});
}
function completion(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("Fixture transaction aborted"));
	});
}
function existingDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const opening = indexedDB.open(databaseName);
		opening.onupgradeneeded = () => opening.transaction?.abort();
		opening.onsuccess = () => resolve(opening.result);
		opening.onerror = () => reject(opening.error);
	});
}
declare global {
	interface Window {
		__browserRegisteredStorageHarness: typeof harness;
	}
}
window.__browserRegisteredStorageHarness = harness;
