import type { TelegramRuntimeSession } from "../../app/telegram-runtime-session";

const metadataStore = "scope-metadata";
const maximumCounter = 18_446_744_073_709_551_615n;
const scopedStores = {
	"scope-metadata": "key",
	projects: "projectId",
	revisions: "revisionId",
	staging: "attemptId",
	"writer-fences": "projectId",
	"publication-attempts": "attemptId",
	"pin-staging-leases": "leaseId",
	resources: "resourceHash",
	library: "resourceHash",
} as const;

export interface TelegramScopeAccess {
	readonly scope: string;
	readonly signal: AbortSignal;
	reserveId(kind: "attempt" | "lease"): Promise<string>;
	transact<T>(
		names: readonly (keyof typeof scopedStores)[],
		mode: "readonly" | "readwrite",
		operation: (transaction: IDBTransaction) => Promise<T>,
	): Promise<T>;
}

type CounterRecord = { readonly key: "counter"; readonly lastReserved: string };
type IdentityRecord = {
	readonly key: "identity";
	readonly protocolVersion: 1;
	readonly scope: string;
};

/**
 * Telegram-only metadata substrate. Browser DB names/schema stay untouched.
 * Constructor is inert; a verified session, secure context and exclusive scope
 * lock are required even to initialize metadata. Project writes are not exposed.
 */
export class TelegramScopeStore {
	private readonly indexedDb: Pick<IDBFactory, "open">;
	private readonly locks: Pick<LockManager, "request"> | undefined;
	private readonly secureContext: boolean;
	private readonly databaseName: string;
	private database: Promise<IDBDatabase> | undefined;
	private disposed = false;

	public constructor(
		private readonly session: TelegramRuntimeSession,
		dependencies: {
			readonly indexedDb: Pick<IDBFactory, "open">;
			readonly locks?: Pick<LockManager, "request">;
			readonly secureContext: boolean;
		},
	) {
		this.indexedDb = dependencies.indexedDb;
		this.locks = dependencies.locks;
		this.secureContext = dependencies.secureContext;
		this.databaseName = `interiors-editor-projects:${session.scope}`;
	}

	public reserveId(kind: "attempt" | "lease"): Promise<string> {
		if (kind !== "attempt" && kind !== "lease") {
			return Promise.reject(new Error("Unknown Telegram operation ID kind"));
		}
		return this.run((access) => access.reserveId(kind));
	}

	/** Internal composite capability: never recursively enter run/reserveId. */
	public run<T>(
		operation: (access: TelegramScopeAccess) => Promise<T>,
	): Promise<T> {
		return this.exclusively(async () => {
			const database = await this.open();
			let active = true;
			const pending: Promise<unknown>[] = [];
			const assertActive = () => {
				if (!active || this.session.signal.aborted || this.disposed) {
					throw new Error("Telegram session is closed");
				}
			};
			const track = <R>(work: Promise<R>): Promise<R> => {
				pending.push(work);
				void work.catch(() => undefined);
				return work;
			};
			try {
				assertActive();
				const result = await operation({
					scope: this.session.scope,
					signal: this.session.signal,
					reserveId: (kind) => {
						assertActive();
						if (kind !== "attempt" && kind !== "lease")
							throw new Error("Unknown Telegram operation ID kind");
						return track(this.reserveUnderLock(kind));
					},
					transact: (names, mode, work) => {
						assertActive();
						return track(
							scopedTransaction(
								database,
								this.session.scope,
								names,
								mode,
								work,
							),
						);
					},
				});
				active = false;
				await Promise.all(pending);
				return result;
			} finally {
				active = false;
				await Promise.allSettled(pending);
			}
		});
	}

	public async close(): Promise<void> {
		await this.session.revoke();
		this.disposed = true;
		const opening = this.database;
		this.database = undefined;
		if (opening) {
			const database = await opening.catch(() => undefined);
			database?.close();
		}
	}

	private exclusively<T>(operation: () => Promise<T>): Promise<T> {
		const locks = this.locks;
		if (!this.secureContext || !locks || typeof locks.request !== "function") {
			return Promise.reject(
				new Error("Telegram storage requires secure Web Locks"),
			);
		}
		return this.session.run(() =>
			locks.request(
				`interiors-tma-storage-v1:${this.session.scope}`,
				{ mode: "exclusive", signal: this.session.signal },
				async (lock) => {
					if (!lock || this.disposed || this.session.signal.aborted) {
						throw new Error("Telegram session is closed");
					}
					// From here the complete operation drains before close/switch.
					return operation();
				},
			),
		);
	}

	/** Already inside the scope lock: never recursively request it. */
	private async reserveUnderLock(kind: "attempt" | "lease"): Promise<string> {
		const database = await this.open();
		const transaction = database.transaction(metadataStore, "readwrite", {
			durability: "strict",
		});
		const completion = transactionCompletion(transaction);
		void completion.catch(() => undefined);
		try {
			if (transaction.durability !== "strict") {
				throw new Error(
					"Telegram operation IDs require strict storage durability",
				);
			}
			const store = transaction.objectStore(metadataStore);
			const identity: unknown = await requestResult(store.get("identity"));
			const counter: unknown = await requestResult(store.get("counter"));
			const recordCount = await requestResult(store.count());
			if (
				recordCount !== 2 ||
				!isIdentity(identity, this.session.scope) ||
				!isCounter(counter)
			) {
				throw new Error("Telegram scope metadata is corrupt");
			}
			const previous = BigInt(counter.lastReserved);
			if (previous >= maximumCounter)
				throw new Error("Telegram operation IDs are exhausted");
			const next = (previous + 1n).toString();
			store.put({ key: "counter", lastReserved: next } satisfies CounterRecord);
			// Request success is insufficient: an abort must never return an ID.
			await completion;
			return `tma-v1:${this.session.scope}:${kind}:${next}`;
		} catch (error) {
			try {
				transaction.abort();
			} catch {
				/* A completed/aborted transaction cannot abort again. */
			}
			await completion.catch(() => undefined);
			throw error;
		}
	}

	private open(): Promise<IDBDatabase> {
		if (this.disposed)
			return Promise.reject(new Error("Telegram session is closed"));
		if (this.database) return this.database;
		let opening: Promise<IDBDatabase>;
		opening = new Promise<IDBDatabase>((resolve, reject) => {
			const request = this.indexedDb.open(this.databaseName, 2);
			let failed = false;
			let upgradeStarted = false;
			const removeCancellation = () =>
				this.session.signal.removeEventListener("abort", cancelPending);
			const fail = (error: unknown) => {
				failed = true;
				removeCancellation();
				reject(error);
			};
			const cancelPending = () => {
				// Before a transaction exists, cancel the open and reject late events.
				// An admitted upgrade transaction instead completes before the drain.
				if (!upgradeStarted) fail(new Error("Telegram session is closed"));
			};
			this.session.signal.addEventListener("abort", cancelPending, {
				once: true,
			});
			request.onupgradeneeded = (event) => {
				if (failed || this.disposed || event.oldVersion > 1) {
					request.transaction?.abort();
					return;
				}
				upgradeStarted = true;
				if (event.oldVersion === 1) {
					const transaction = request.transaction;
					if (
						!transaction ||
						Array.from(request.result.objectStoreNames).join() !== metadataStore
					) {
						transaction?.abort();
						return;
					}
					const metadata = transaction.objectStore(metadataStore);
					if (
						metadata.keyPath !== "key" ||
						metadata.autoIncrement ||
						metadata.indexNames.length !== 0
					) {
						transaction.abort();
						return;
					}
					const records = metadata.getAll();
					records.onsuccess = () => {
						if (!validMetadata(records.result, this.session.scope)) {
							transaction.abort();
							return;
						}
						createProjectStores(request.result);
					};
					return;
				}
				const store = request.result.createObjectStore(metadataStore, {
					keyPath: "key",
				});
				store.add({
					key: "identity",
					protocolVersion: 1,
					scope: this.session.scope,
				} satisfies IdentityRecord);
				store.add({
					key: "counter",
					lastReserved: "0",
				} satisfies CounterRecord);
				createProjectStores(request.result);
			};
			request.onblocked = () =>
				fail(new Error("Telegram storage upgrade is blocked"));
			request.onerror = () =>
				fail(request.error ?? new Error("Could not open Telegram storage"));
			request.onsuccess = () => {
				removeCancellation();
				const database = request.result;
				if (failed || this.disposed) {
					database.close();
					return;
				}
				if (!hasScopeSchema(database)) {
					database.close();
					fail(new Error("Telegram storage schema is unsupported"));
					return;
				}
				database.onversionchange = () => {
					void this.session.revoke();
					database.close();
					if (this.database === opening) this.database = undefined;
				};
				resolve(database);
			};
		});
		this.database = opening;
		void opening.catch(() => {
			if (this.database === opening) this.database = undefined;
		});
		return opening;
	}
}

async function scopedTransaction<T>(
	database: IDBDatabase,
	scope: string,
	names: readonly (keyof typeof scopedStores)[],
	mode: "readonly" | "readwrite",
	operation: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
	const transaction = database.transaction(
		[...new Set([metadataStore, ...names])],
		mode,
		mode === "readwrite" ? { durability: "strict" } : undefined,
	);
	const completion = transactionCompletion(transaction);
	void completion.catch(() => undefined);
	try {
		if (mode === "readwrite" && transaction.durability !== "strict")
			throw new Error("Telegram writes require strict storage durability");
		const records: readonly unknown[] = await requestResult(
			transaction.objectStore(metadataStore).getAll(),
		);
		if (!validMetadata(records, scope))
			throw new Error("Telegram scope metadata is corrupt");
		const result = await operation(transaction);
		await completion;
		return result;
	} catch (error) {
		try {
			transaction.abort();
		} catch {
			/* Already finished. */
		}
		await completion.catch(() => undefined);
		throw error;
	}
}

function createProjectStores(database: IDBDatabase): void {
	for (const [name, keyPath] of Object.entries(scopedStores)) {
		if (name !== metadataStore) database.createObjectStore(name, { keyPath });
	}
}

function hasScopeSchema(database: IDBDatabase): boolean {
	if (
		Array.from(database.objectStoreNames).sort().join() !==
		Object.keys(scopedStores).sort().join()
	)
		return false;
	const transaction = database.transaction(
		Object.keys(scopedStores),
		"readonly",
	);
	return Object.entries(scopedStores).every(([name, keyPath]) => {
		const store = transaction.objectStore(name);
		return (
			store.keyPath === keyPath &&
			!store.autoIncrement &&
			store.indexNames.length === 0
		);
	});
}

function validMetadata(records: readonly unknown[], scope: string): boolean {
	return (
		records.length === 2 &&
		records.some((record) => isIdentity(record, scope)) &&
		records.some(isCounter)
	);
}

function isIdentity(value: unknown, scope: string): value is IdentityRecord {
	return (
		exactKeys(value, ["key", "protocolVersion", "scope"]) &&
		value.key === "identity" &&
		value.protocolVersion === 1 &&
		value.scope === scope
	);
}

function isCounter(value: unknown): value is CounterRecord {
	return (
		exactKeys(value, ["key", "lastReserved"]) &&
		value.key === "counter" &&
		typeof value.lastReserved === "string" &&
		/^(0|[1-9][0-9]{0,19})$/.test(value.lastReserved) &&
		BigInt(value.lastReserved) <= maximumCounter
	);
}

function exactKeys(
	value: unknown,
	keys: readonly string[],
): value is Record<string, unknown> {
	return (
		!!value &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		Object.keys(value).length === keys.length &&
		keys.every((key) => Object.hasOwn(value, key))
	);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("Telegram storage request failed"));
	});
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(
				transaction.error ?? new Error("Telegram storage transaction aborted"),
			);
		transaction.onerror = () =>
			reject(
				transaction.error ?? new Error("Telegram storage transaction failed"),
			);
	});
}
