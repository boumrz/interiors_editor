import "./browser-registered-project-harness";
import { BrowserProjectKeyLookup } from "../../src/adapters/persistence/browser-project-key-lookup";
import type { ProjectStorageNamespace } from "../../src/application/ports";
import { runFactoryTechnicalCleanup } from "../verification/factory-technical-cleanup";

const names = {
	legacy: "interiors-editor-projects",
	"browser-registered": "interiors-editor-browser-registered",
} as const;
function deferred<T>() {
	let resolve: (value: T | PromiseLike<T>) => void = () => {};
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}
async function observe<T>(operation: Promise<T>, milliseconds: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation.then(
				(value) => ({ kind: "fulfilled" as const, value }),
				(reason) => ({ kind: "rejected" as const, reason: String(reason) }),
			),
			new Promise<{ kind: "pending" }>((resolve) => {
				timer = setTimeout(() => resolve({ kind: "pending" }), milliseconds);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
async function snapshots() {
	return (await window.__browserRegisteredProjectHarness.snapshotAll())
		.map((database) => ({
			...database,
			rows: [...database.rows].sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}
async function seed(namespace: ProjectStorageNamespace) {
	const h = window.__browserRegisteredProjectHarness;
	if (namespace === "legacy") {
		const created = await h.seedLegacy("Preserved actual legacy source");
		if (created.result.kind !== "durable")
			throw Error("SCOPED_PROOF_INVALID real legacy setup was not Durable");
		return created.result.projectId;
	}
	h.create("key-public", "key-public-owner");
	await h.provision("key-public");
	const created = await h.createProject(
		"key-public",
		"Preserved actual registered source",
	);
	if (created.kind !== "durable")
		throw Error("SCOPED_PROOF_INVALID real registered setup was not Durable");
	return created.projectId;
}
async function upgradeLegacyTo4() {
	await new Promise<void>((resolve, reject) => {
		const opening = indexedDB.open(names.legacy, 4);
		opening.onupgradeneeded = () => {
			/* Deliberately change only version, not schema or data. */
		};
		opening.onerror = () => reject(opening.error);
		opening.onsuccess = () => {
			opening.result.close();
			resolve();
		};
	});
}

/** Every request/transaction/result/event is native. This adapter changes only a
 * declared fault version or delivery time of a real consumer callback. */
function nativeObserver(options: {
	readonly namespace: ProjectStorageNamespace;
	readonly version?: number;
	readonly holdSuccess?: boolean;
	readonly holdComplete?: boolean;
	readonly abortDuringUpgrade?: AbortController;
}) {
	const success = deferred<{
		readonly name: string;
		readonly version: number;
	}>();
	const complete = deferred<void>();
	const upgrade = deferred<{
		readonly oldVersion: number;
		readonly newVersion: number | null;
	}>();
	const terminal = deferred<{
		readonly kind: "success" | "error";
		readonly errorName?: string;
	}>();
	const closed = deferred<void>();
	let releaseSuccess = () => {},
		releaseComplete = () => {},
		releaseUpgrade = () => {};
	let liveHandles = 0,
		closeCalls = 0,
		successEvents = 0,
		completeEvents = 0;
	const restorations: (() => void)[] = [];
	const indexedDb: Pick<IDBFactory, "open"> = {
		open(name: string): IDBOpenDBRequest {
			if (name !== names[options.namespace])
				throw Error("SCOPED_PROOF_INVALID wrong queried owner");
			const opening =
				options.version === undefined
					? indexedDB.open(name)
					: indexedDB.open(name, options.version);
			opening.addEventListener(
				"error",
				() =>
					terminal.resolve({ kind: "error", errorName: opening.error?.name }),
				{ once: true },
			);
			opening.addEventListener(
				"success",
				() => {
					successEvents++;
					liveHandles++;
					const database = opening.result;
					const oldCloseDescriptor = Object.getOwnPropertyDescriptor(
							database,
							"close",
						),
						nativeClose = database.close;
					let closedOnce = false;
					database.close = function () {
						const result = nativeClose.call(this);
						if (this === database) {
							closeCalls++;
							if (!closedOnce) {
								closedOnce = true;
								liveHandles--;
								closed.resolve();
							}
						}
						return result;
					};
					restorations.push(() => {
						if (oldCloseDescriptor)
							Object.defineProperty(database, "close", oldCloseDescriptor);
						else Reflect.deleteProperty(database, "close");
					});
					if (options.holdComplete) {
						const oldDescriptor = Object.getOwnPropertyDescriptor(
								database,
								"transaction",
							),
							nativeTransaction = database.transaction;
						database.transaction = function (stores, mode, transactionOptions) {
							const transaction = nativeTransaction.call(
								this,
								stores,
								mode,
								transactionOptions,
							);
							return new Proxy(transaction, {
								get(target, key) {
									const value = Reflect.get(target, key, target);
									return typeof value === "function"
										? value.bind(target)
										: value;
								},
								set(target, key, value) {
									if (key !== "oncomplete" || typeof value !== "function")
										return Reflect.set(target, key, value, target);
									target.oncomplete = (event) => {
										completeEvents++;
										let delivered = false;
										releaseComplete = () => {
											if (!delivered) {
												delivered = true;
												value.call(target, event);
											}
										};
										complete.resolve();
									};
									return true;
								},
							});
						};
						restorations.push(() => {
							if (oldDescriptor)
								Object.defineProperty(database, "transaction", oldDescriptor);
							else Reflect.deleteProperty(database, "transaction");
						});
					}
					terminal.resolve({ kind: "success" });
				},
				{ once: true },
			);
			return new Proxy(opening, {
				get(target, key) {
					const value = Reflect.get(target, key, target);
					return typeof value === "function" ? value.bind(target) : value;
				},
				set(target, key, value) {
					if (
						key === "onsuccess" &&
						typeof value === "function" &&
						options.holdSuccess
					) {
						target.onsuccess = (event) => {
							let delivered = false;
							releaseSuccess = () => {
								if (!delivered) {
									delivered = true;
									value.call(target, event);
								}
							};
							success.resolve({
								name: target.result.name,
								version: target.result.version,
							});
						};
						return true;
					}
					if (
						key === "onupgradeneeded" &&
						typeof value === "function" &&
						options.abortDuringUpgrade
					) {
						target.onupgradeneeded = (event) => {
							let delivered = false;
							releaseUpgrade = () => {
								if (!delivered) {
									delivered = true;
									value.call(target, event);
								}
							};
							upgrade.resolve({
								oldVersion: event.oldVersion,
								newVersion: event.newVersion,
							});
							options.abortDuringUpgrade?.abort();
						};
						return true;
					}
					return Reflect.set(target, key, value, target);
				},
			});
		},
	};
	return {
		indexedDb,
		success: success.promise,
		complete: complete.promise,
		upgrade: upgrade.promise,
		terminal: terminal.promise,
		closed: closed.promise,
		releaseAll() {
			releaseSuccess();
			releaseComplete();
			releaseUpgrade();
		},
		restore() {
			for (const restore of restorations.reverse()) restore();
		},
		state: () => ({ liveHandles, closeCalls, successEvents, completeEvents }),
	};
}

async function existingVersion4() {
	const projectId = await seed("legacy");
	await upgradeLegacyTo4();
	const before = await snapshots();
	const result = await new BrowserProjectKeyLookup({
		namespace: "legacy",
		indexedDb: indexedDB,
	}).read(projectId);
	return { result, before, after: await snapshots() };
}
async function asynchronousVersionError() {
	const projectId = await seed("legacy"),
		before = await snapshots();
	const observer = nativeObserver({ namespace: "legacy", version: 2 });
	try {
		const result = await new BrowserProjectKeyLookup({
			namespace: "legacy",
			indexedDb: observer.indexedDb,
		}).read(projectId);
		return {
			result,
			actualTerminal: await observer.terminal,
			before,
			after: await snapshots(),
			handles: observer.state(),
		};
	} finally {
		await runFactoryTechnicalCleanup(() => observer.restore());
	}
}
async function pendingSuccessCancellation(namespace: ProjectStorageNamespace) {
	const projectId = await seed(namespace),
		before = await snapshots(),
		cancellation = new AbortController();
	const observer = nativeObserver({ namespace, holdSuccess: true });
	const reading = new BrowserProjectKeyLookup({
		namespace,
		indexedDb: observer.indexedDb,
	}).read(projectId, cancellation.signal);
	void reading.catch(() => {});
	try {
		const reached = await Promise.race([
			observer.success.then((value) => ({ kind: "held" as const, value })),
			reading.then((value) => ({ kind: "ended-early" as const, value })),
		]);
		if (reached.kind !== "held")
			return { kind: "hold-not-reached" as const, outcome: reached };
		cancellation.abort();
		const beforeRelease = await observe(reading, 1000);
		observer.releaseAll();
		const result = await reading;
		await observer.closed;
		const handlesBeforeSnapshotOpen = observer.state();
		return {
			kind: "held" as const,
			beforeRelease,
			result,
			held: reached.value,
			handlesBeforeSnapshotOpen,
			before,
			after: await snapshots(),
		};
	} finally {
		await runFactoryTechnicalCleanup(async () => {
			observer.releaseAll();
			await Promise.allSettled([reading]);
			observer.restore();
		});
	}
}
async function cancellationAfterNativeCommit() {
	const projectId = await seed("legacy"),
		before = await snapshots(),
		cancellation = new AbortController();
	const observer = nativeObserver({ namespace: "legacy", holdComplete: true });
	const reading = new BrowserProjectKeyLookup({
		namespace: "legacy",
		indexedDb: observer.indexedDb,
	}).read(projectId, cancellation.signal);
	void reading.catch(() => {});
	try {
		const reached = await Promise.race([
			observer.complete.then(() => ({ kind: "committed-held" as const })),
			reading.then((value) => ({ kind: "ended-early" as const, value })),
		]);
		if (reached.kind !== "committed-held")
			return { kind: "hold-not-reached" as const, outcome: reached };
		cancellation.abort();
		// Preserve the existing contract: real commit has already happened, but its
		// consumer must be released before full drain/result can complete.
		observer.releaseAll();
		const result = await reading;
		await observer.closed;
		const handlesBeforeSnapshotOpen = observer.state();
		return {
			kind: "committed-held" as const,
			result,
			handlesBeforeSnapshotOpen,
			before,
			after: await snapshots(),
		};
	} finally {
		await runFactoryTechnicalCleanup(async () => {
			observer.releaseAll();
			await Promise.allSettled([reading]);
			observer.restore();
		});
	}
}
async function cancellationDuringActualUpgrade() {
	const projectId = await seed("legacy"),
		before = await snapshots(),
		cancellation = new AbortController();
	const observer = nativeObserver({
		namespace: "legacy",
		version: 4,
		abortDuringUpgrade: cancellation,
	});
	const reading = new BrowserProjectKeyLookup({
		namespace: "legacy",
		indexedDb: observer.indexedDb,
	}).read(projectId, cancellation.signal);
	void reading.catch(() => {});
	try {
		const reached = await Promise.race([
			observer.upgrade.then((value) => ({
				kind: "upgrade-held" as const,
				value,
			})),
			reading.then((value) => ({ kind: "ended-early" as const, value })),
		]);
		if (reached.kind !== "upgrade-held")
			return { kind: "hold-not-reached" as const, outcome: reached };
		const result = await reading,
			actualTerminal = await observer.terminal;
		observer.releaseAll();
		return {
			kind: "upgrade-held" as const,
			upgrade: reached.value,
			result,
			actualTerminal,
			before,
			after: await snapshots(),
			handles: observer.state(),
		};
	} finally {
		await runFactoryTechnicalCleanup(async () => {
			observer.releaseAll();
			await Promise.allSettled([reading]);
			observer.restore();
		});
	}
}
const api = {
	existingVersion4,
	asynchronousVersionError,
	pendingSuccessCancellation,
	cancellationAfterNativeCommit,
	cancellationDuringActualUpgrade,
};
declare global {
	interface Window {
		__browserKeyPublicBoundaries: typeof api;
	}
}
window.__browserKeyPublicBoundaries = api;
