import type { BrowserRegisteredStorageSession } from "../../app/browser-registered-storage-session";
import type {
	ScopedProjectAccess,
	ScopedProjectStore,
	ScopedProjectStoreName,
} from "./scoped-project-protocol";

const databaseName = "interiors-editor-browser-registered";
const lockName = "interiors-browser-registered-v1";
const maximumCounter = 18_446_744_073_709_551_615n;
const stores = {
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
type FailureKind = "not-provisioned" | "unavailable" | "recovery-required";
export type BrowserRegisteredStorageStatus =
	| { readonly kind: "available" }
	| { readonly kind: "not-provisioned"; readonly history: "unknown" }
	| { readonly kind: "unavailable" | "recovery-required" };
export class BrowserRegisteredStorageError extends Error {
	public constructor(
		public readonly kind: FailureKind,
		message: string,
	) {
		super(message);
	}
}

/** Existing-only by default. Explicit validated-import composition owns the sole creation method. */
export class BrowserRegisteredScopeStore implements ScopedProjectStore {
	private database: Promise<IDBDatabase> | undefined;
	private knownExisting = false;
	private observedCounter = 0n;
	private disposed = false;
	private lockHeld = false;
	private readonly openTimeoutMs: number;
	private revokedKind: "unavailable" | "recovery-required" = "unavailable";
	private readonly transactions = new Set<IDBTransaction>();
	private readonly onRevoked = () => {
		for (const transaction of this.transactions) abort(transaction);
	};
	public constructor(
		private readonly session: BrowserRegisteredStorageSession,
		private readonly dependencies: {
			readonly indexedDb: Pick<IDBFactory, "open">;
			readonly locks?: Pick<LockManager, "request">;
			readonly secureContext: boolean;
			readonly openTimeoutMs?: number;
		},
	) {
		this.dependencies = { ...dependencies };
		this.openTimeoutMs = dependencies.openTimeoutMs ?? 5000;
		if (
			!Number.isSafeInteger(this.openTimeoutMs) ||
			this.openTimeoutMs <= 0 ||
			this.openTimeoutMs > 60000
		)
			throw unavailable("Invalid browser open deadline");
		this.session.signal.addEventListener("abort", this.onRevoked);
	}
	public async probe(): Promise<BrowserRegisteredStorageStatus> {
		try {
			await this.exclusively(async () => {
				const database = await this.open(false);
				await this.transact(
					database,
					["scope-metadata"],
					"readonly",
					async () => undefined,
				);
			});
			return { kind: "available" };
		} catch (error) {
			const kind = this.failureKind(error);
			return kind === "not-provisioned"
				? { kind, history: "unknown" }
				: { kind };
		}
	}
	/** Never call from ordinary directory, capability probes or rejected-file paths. */
	public provisionForRegisteredImport(signal?: AbortSignal): Promise<void> {
		return this.exclusively(async (activeSignal) => {
			if (activeSignal.aborted)
				throw unavailable("Selected import was cancelled");
			const database = await this.open(true, activeSignal);
			if (activeSignal.aborted)
				throw unavailable("Selected import was cancelled");
			// Native versionchange atomicity is separate; subsequent writable capability must be strict.
			await this.transact(
				database,
				["scope-metadata"],
				"readwrite",
				async () => undefined,
			);
			if (activeSignal.aborted)
				throw unavailable("Selected import was cancelled");
		}, signal);
	}
	public reserveId(kind: "attempt" | "lease"): Promise<string> {
		if (kind !== "attempt" && kind !== "lease")
			return Promise.reject(unavailable("Unknown browser operation kind"));
		return this.run((access) => access.reserveId(kind));
	}
	/** Composite capability. Inner adapters must not recursively enter this queue/lock. */
	public run<T>(
		operation: (access: ScopedProjectAccess) => Promise<T>,
	): Promise<T> {
		return this.exclusively(async () => {
			const database = await this.open(false),
				pending: Promise<unknown>[] = [];
			let active = true;
			const check = () => {
				this.assertLive();
				if (!active)
					throw unavailable("Browser scope access escaped its operation");
			};
			const track = <R>(work: Promise<R>): Promise<R> => {
				pending.push(work);
				void work.catch(() => undefined);
				return work;
			};
			try {
				check();
				const result = await operation({
					scope: this.session.scope,
					signal: this.session.signal,
					reserveId: (kind) => {
						check();
						if (kind !== "attempt" && kind !== "lease")
							throw unavailable("Unknown browser operation kind");
						return track(this.reserveUnderLock(database, kind));
					},
					transact: (names, mode, work) => {
						check();
						return track(this.transact(database, names, mode, work));
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
		this.disposed = true;
		await this.session.revoke();
		const database = await this.database?.catch(() => undefined);
		this.database = undefined;
		database?.close();
		this.session.signal.removeEventListener("abort", this.onRevoked);
	}
	private assertLive(): void {
		if (this.disposed || this.session.signal.aborted)
			throw new BrowserRegisteredStorageError(
				this.revokedKind,
				"Browser storage generation is closed",
			);
	}
	private failureKind(error: unknown): FailureKind {
		return this.session.signal.aborted
			? this.revokedKind
			: error instanceof BrowserRegisteredStorageError
				? error.kind
				: "unavailable";
	}
	private revokeForLoss(): void {
		this.revokedKind = "recovery-required";
		void this.session.revoke();
	}
	private exclusively<T>(
		operation: (signal: AbortSignal) => Promise<T>,
		cancellation?: AbortSignal,
	): Promise<T> {
		const locks = this.dependencies.locks;
		if (
			!this.dependencies.secureContext ||
			!locks ||
			typeof locks.request !== "function"
		)
			return Promise.reject(
				unavailable("Browser registered storage requires secure Web Locks"),
			);
		return this.session
			.run(async () => {
				const linked = linkCancellation(this.session.signal, cancellation);
				try {
					return await locks.request(
						lockName,
						{ mode: "exclusive", signal: linked.signal },
						async (lock) => {
							this.assertLive();
							if (!lock || linked.signal.aborted)
								throw unavailable("Browser storage lock was not granted");
							this.lockHeld = true;
							try {
								return await operation(linked.signal);
							} finally {
								this.lockHeld = false;
							}
						},
					);
				} finally {
					linked.dispose();
				}
			})
			.catch((error: unknown) => {
				if (this.session.signal.aborted)
					throw new BrowserRegisteredStorageError(
						this.revokedKind,
						"Browser storage generation was revoked",
					);
				if (cancellation?.aborted)
					throw unavailable("Selected import was cancelled");
				throw error;
			});
	}

	private async reserveUnderLock(
		database: IDBDatabase,
		kind: "attempt" | "lease",
	): Promise<string> {
		return this.transact(
			database,
			["scope-metadata"],
			"readwrite",
			async (transaction) => {
				const store = transaction.objectStore("scope-metadata"),
					counter: unknown = await request(store.get("counter"));
				if (!isCounter(counter)) throw recovery("Browser counter is corrupt");
				const previous = BigInt(counter.lastReserved);
				if (previous >= maximumCounter)
					throw unavailable("Browser operation IDs are exhausted");
				const next = (previous + 1n).toString();
				await request(store.put({ key: "counter", lastReserved: next }));
				return `browser-registered-v1:${kind}:${next}`;
			},
		);
	}
	private async transact<T>(
		database: IDBDatabase,
		names: readonly ScopedProjectStoreName[],
		mode: "readonly" | "readwrite",
		operation: (transaction: IDBTransaction) => Promise<T>,
	): Promise<T> {
		this.assertLive();
		if (
			!this.lockHeld ||
			!Array.isArray(names) ||
			names.length === 0 ||
			names.length > 9 ||
			names.some((name) => !Object.hasOwn(stores, name)) ||
			(mode !== "readonly" && mode !== "readwrite")
		)
			throw unavailable("Invalid browser scope transaction");
		const transaction = database.transaction(
			[...new Set(["scope-metadata", ...names])],
			mode,
			mode === "readwrite" ? { durability: "strict" } : undefined,
		);
		this.transactions.add(transaction);
		const completion = transactionCompletion(transaction);
		void completion.catch(() => undefined);
		try {
			this.assertLive();
			if (mode === "readwrite" && transaction.durability !== "strict")
				throw unavailable("Strict browser storage durability is unavailable");
			const before = await this.metadata(transaction);
			const result = await operation(transaction);
			const after = await this.metadata(transaction);
			if (after < before) {
				this.revokeForLoss();
				throw recovery("Browser counter moved backwards");
			}
			await completion;
			if (after > this.observedCounter) this.observedCounter = after;
			return result;
		} catch (error) {
			abort(transaction);
			await completion.catch(() => undefined);
			throw error;
		} finally {
			this.transactions.delete(transaction);
		}
	}
	private async metadata(transaction: IDBTransaction): Promise<bigint> {
		const store = transaction.objectStore("scope-metadata");
		const [identity, counter, count]: [unknown, unknown, number] =
			await Promise.all([
				request(store.get("identity")),
				request(store.get("counter")),
				request(store.count()),
			]);
		if (count !== 2 || !isIdentity(identity) || !isCounter(counter)) {
			this.revokeForLoss();
			throw recovery("Browser storage metadata is corrupt");
		}
		const value = BigInt(counter.lastReserved);
		if (value < this.observedCounter) {
			this.revokeForLoss();
			throw recovery("Browser storage rollback was observed");
		}
		return value;
	}
	private async hasSchema(database: IDBDatabase): Promise<boolean> {
		if (
			database.version !== 1 ||
			[...database.objectStoreNames].join() !==
				Object.keys(stores).sort().join()
		)
			return false;
		this.assertLive();
		const transaction = database.transaction(Object.keys(stores), "readonly");
		this.transactions.add(transaction);
		const completion = transactionCompletion(transaction);
		void completion.catch(() => undefined);
		try {
			this.assertLive();
			const valid = Object.entries(stores).every(([name, keyPath]) => {
				const store = transaction.objectStore(name);
				return (
					store.keyPath === keyPath &&
					!store.autoIncrement &&
					store.indexNames.length === 0
				);
			});
			await completion;
			return valid;
		} catch (error) {
			abort(transaction);
			await completion.catch(() => undefined);
			throw error;
		} finally {
			this.transactions.delete(transaction);
		}
	}
	private open(
		allowCreate: boolean,
		cancellation: AbortSignal = this.session.signal,
	): Promise<IDBDatabase> {
		this.assertLive();
		if (this.database) return this.database;
		let opening: Promise<IDBDatabase>;
		opening = new Promise((resolve, reject) => {
			const request = allowCreate
				? this.dependencies.indexedDb.open(databaseName, 1)
				: this.dependencies.indexedDb.open(databaseName);
			let abandoned = false,
				upgradeStarted = false,
				validationStarted = false,
				pendingFailure: unknown;
			let timeout: ReturnType<typeof setTimeout> | undefined;
			const removeCancellation = () => {
				cancellation.removeEventListener("abort", cancel);
				if (timeout !== undefined) clearTimeout(timeout);
			};
			const fail = (error: unknown) => {
				abandoned = true;
				removeCancellation();
				reject(error);
			};
			const cancel = () => {
				pendingFailure ??= new BrowserRegisteredStorageError(
					this.revokedKind,
					"Browser storage open was revoked",
				);
				abandoned = true;
				if (upgradeStarted || validationStarted) {
					abort(request.transaction);
					if (validationStarted) this.onRevoked();
				} else fail(pendingFailure);
			};
			cancellation.addEventListener("abort", cancel, { once: true });
			request.onupgradeneeded = (event) => {
				upgradeStarted = true;
				if (
					abandoned ||
					this.disposed ||
					this.session.signal.aborted ||
					cancellation.aborted ||
					!this.lockHeld
				) {
					abort(request.transaction);
					return;
				}
				if (event.oldVersion !== 0) {
					this.knownExisting = true;
					pendingFailure = recovery("Unknown browser schema upgrade");
					this.revokeForLoss();
					abort(request.transaction);
					return;
				}
				if (this.knownExisting) {
					pendingFailure = recovery(
						"Previously observed browser storage disappeared",
					);
					this.revokeForLoss();
					abort(request.transaction);
					return;
				}
				if (!allowCreate) {
					pendingFailure = new BrowserRegisteredStorageError(
						"not-provisioned",
						"Current browser storage is absent; history is unknown",
					);
					abort(request.transaction);
					return;
				}
				try {
					for (const [name, keyPath] of Object.entries(stores))
						request.result.createObjectStore(name, { keyPath });
					const metadata = request.transaction?.objectStore("scope-metadata");
					if (!metadata) throw recovery("Missing native schema transaction");
					metadata.add({
						key: "identity",
						protocolVersion: 1,
						namespace: "browser-registered-v1",
					});
					metadata.add({ key: "counter", lastReserved: "0" });
				} catch (error) {
					pendingFailure = error;
					abort(request.transaction);
				}
			};
			request.onblocked = () => {
				pendingFailure ??= unavailable("Browser storage open is blocked");
				fail(pendingFailure);
			};
			request.onerror = () => {
				if (request.error?.name === "VersionError") {
					this.knownExisting = true;
					pendingFailure ??= recovery(
						"A newer browser storage schema already exists",
					);
					this.revokeForLoss();
				}
				fail(
					pendingFailure ??
						unavailable("Could not open browser registered storage"),
				);
			};
			request.onsuccess = () => {
				const database = request.result;
				if (
					abandoned ||
					this.disposed ||
					this.session.signal.aborted ||
					cancellation.aborted ||
					!this.lockHeld
				) {
					database.close();
					fail(pendingFailure ?? unavailable("Late browser storage open"));
					return;
				}
				this.knownExisting = true;
				database.onversionchange = () => {
					this.revokeForLoss();
					database.close();
					if (this.database === opening) this.database = undefined;
				};
				database.onclose = () => {
					this.revokeForLoss();
					if (this.database === opening) this.database = undefined;
				};
				validationStarted = true;
				void this.hasSchema(database)
					.then(async (valid) => {
						if (!valid) {
							this.revokeForLoss();
							throw recovery("Unknown browser storage schema");
						}
						await this.transact(
							database,
							["scope-metadata"],
							"readonly",
							async () => undefined,
						);
					})
					.then(
						() => {
							validationStarted = false;
							removeCancellation();
							if (
								abandoned ||
								this.disposed ||
								this.session.signal.aborted ||
								cancellation.aborted
							) {
								database.close();
								fail(pendingFailure ?? unavailable("Browser open was revoked"));
							} else resolve(database);
						},
						(error) => {
							validationStarted = false;
							database.close();
							fail(error);
						},
					);
			};
			timeout = setTimeout(() => {
				pendingFailure ??= unavailable("Browser storage open deadline expired");
				cancel();
			}, this.openTimeoutMs);
		});
		this.database = opening;
		void opening.catch(() => {
			if (this.database === opening) this.database = undefined;
		});
		return opening;
	}
}
function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isIdentity(value: unknown): boolean {
	return (
		isRecord(value) &&
		Object.keys(value).length === 3 &&
		value.key === "identity" &&
		value.protocolVersion === 1 &&
		value.namespace === "browser-registered-v1"
	);
}
function isCounter(
	value: unknown,
): value is { readonly key: "counter"; readonly lastReserved: string } {
	return (
		isRecord(value) &&
		Object.keys(value).length === 2 &&
		value.key === "counter" &&
		typeof value.lastReserved === "string" &&
		/^(0|[1-9][0-9]{0,19})$/.test(value.lastReserved) &&
		BigInt(value.lastReserved) <= maximumCounter
	);
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		operation.onsuccess = () => resolve(operation.result);
		operation.onerror = () =>
			reject(operation.error ?? unavailable("Browser native request failed"));
	});
}
function transactionCompletion(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(
				transaction.error ?? unavailable("Browser native transaction aborted"),
			);
		transaction.addEventListener("error", () => abort(transaction));
	});
}
function abort(transaction: IDBTransaction | null): void {
	try {
		transaction?.abort();
	} catch {
		/* Native commit/abort may already have completed. */
	}
}
function recovery(message: string): BrowserRegisteredStorageError {
	return new BrowserRegisteredStorageError("recovery-required", message);
}
function unavailable(message: string): BrowserRegisteredStorageError {
	return new BrowserRegisteredStorageError("unavailable", message);
}

function linkCancellation(
	first: AbortSignal,
	second?: AbortSignal,
): { readonly signal: AbortSignal; dispose(): void } {
	if (!second || first === second)
		return { signal: first, dispose: () => undefined };
	const controller = new AbortController(),
		onAbort = () => controller.abort();
	first.addEventListener("abort", onAbort, { once: true });
	second.addEventListener("abort", onAbort, { once: true });
	if (first.aborted || second.aborted) controller.abort();
	return {
		signal: controller.signal,
		dispose: () => {
			first.removeEventListener("abort", onAbort);
			second.removeEventListener("abort", onAbort);
		},
	};
}
