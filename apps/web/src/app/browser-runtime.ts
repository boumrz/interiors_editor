import type { ProjectStorageNamespace } from "../application/ports";
import type { EditorNavigationProtection } from "../ui/editor-host-boundary";
import type { BrowserEditorInstanceSnapshot } from "./browser-editor-instance";
import {
	type BrowserRegisteredControllerSlot,
	createBrowserProjectControllerFacade,
} from "./browser-project-controller-facade";
import type { BrowserReadonlyProjectsRuntime } from "./browser-readonly-projects";
import type { BrowserReadonlyProjectsPort } from "./browser-readonly-projects-port";
import type { BrowserRegisteredRuntime } from "./browser-registered-runtime";
import type { ProductionAppRuntime } from "./production-app";
import {
	guardRegisteredProjectController,
	type TrackOperation,
} from "./registered-project-controller";
import {
	isReleaseManifest,
	type ReleaseRecoveryRecord,
	type ReleaseStartupInput,
	type ReleaseStartupOutcome,
} from "./release-startup";

const noReadonlySources: readonly ProjectStorageNamespace[] = Object.freeze([]);
const legacyReadonlySource: readonly ProjectStorageNamespace[] = Object.freeze([
	"legacy",
]);
const registeredReadonlySource: readonly ProjectStorageNamespace[] =
	Object.freeze(["browser-registered"]);
const bothReadonlySources: readonly ProjectStorageNamespace[] = Object.freeze([
	"legacy",
	"browser-registered",
]);

export interface BrowserRuntime extends ProductionAppRuntime {
	readonly readonlyProjects?: BrowserReadonlyProjectsPort;
	getReadonlyProjectSources(): readonly ProjectStorageNamespace[];
	hasWritableSourceAdmission(): boolean;
	readonly getEditorInstanceSnapshot: () => BrowserEditorInstanceSnapshot;
	readonly subscribeEditorInstance: (listener: () => void) => () => void;
	readonly navigationProtection: EditorNavigationProtection;
	getLegacyStartupRecovery(): ReleaseRecoveryRecord | undefined;
	canCreateLegacyProject(): boolean;
	getStartupSourcesRevision(): number;
	subscribeStartupSources(listener: () => void): () => void;
	dispose(): Promise<void>;
}

/** Trusted composition. It neither constructs/migrates the old runtime nor infers an owner from file data. */
export function createBrowserRuntime(dependencies: {
	readonly legacy: ProductionAppRuntime;
	readonly readonlyProjects?: BrowserReadonlyProjectsRuntime;
	readonly registered?: BrowserRegisteredRuntime;
	readonly readReleaseStartupInput: () => Promise<ReleaseStartupInput>;
	readonly startupTimeoutMs?: number;
}): BrowserRuntime {
	const { legacy, registered, readReleaseStartupInput, readonlyProjects } =
		dependencies;
	const startupTimeout = dependencies.startupTimeoutMs ?? 1500;
	if (
		!Number.isSafeInteger(startupTimeout) ||
		startupTimeout < 1 ||
		startupTimeout > 60000
	)
		throw new Error("Invalid browser startup deadline");
	let disposed = false,
		legacyWritable = false,
		registeredWritable = false,
		startupGeneration = 0;
	let disposal: Promise<void> | undefined;
	let startupSourcesRevision = 0;
	const startupSourceListeners = new Set<() => void>();
	let legacyAdmission: Promise<ReleaseStartupOutcome> | undefined;
	let legacyRecovery:
		| { readonly generation: number; readonly record: ReleaseRecoveryRecord }
		| undefined;
	const cancellation = new AbortController(),
		subscriptions = new Set<() => void>(),
		pending = new Set<Promise<unknown>>();
	const notifyStartupSources = (generation: number) => {
		if (generation !== startupGeneration) return;
		startupSourcesRevision++;
		for (const listener of [...startupSourceListeners]) {
			if (generation !== startupGeneration) break;
			if (!startupSourceListeners.has(listener)) continue;
			try {
				listener();
			} catch {
				/* An observer cannot change source admission or block other observers. */
			}
		}
	};
	const owned: TrackOperation = <T>(
		operation: () => T | Promise<T>,
	): Promise<T> => {
		if (disposed) return Promise.reject(new Error("Browser runtime is closed"));
		let complete: (value: T | PromiseLike<T>) => void = () => {},
			fail: (reason: unknown) => void = () => {};
		const result = new Promise<T>((resolve, reject) => {
			complete = resolve;
			fail = reject;
		});
		pending.add(result);
		void result.then(
			() => pending.delete(result),
			() => pending.delete(result),
		);
		try {
			void Promise.resolve(operation()).then(complete, fail);
		} catch (error) {
			fail(error);
		}
		return result;
	};
	const trackWritable: TrackOperation = (operation) =>
		legacyWritable && !disposed
			? owned(operation)
			: Promise.reject(
					new Error("Legacy browser startup has not admitted writes"),
				);
	const guarded = guardRegisteredProjectController(
		legacy.controller,
		() => legacyWritable && !disposed,
		cancellation.signal,
		subscriptions,
		trackWritable,
		"Legacy browser startup has not admitted writes",
	);
	// All old Core commands, including reads, share the same writable admission.
	// Readonly source access belongs exclusively to the separate existing-only reader.
	// Preserve only the old browser JSON/ZIP transfer dispatcher; the neutral guard
	// intentionally provides a stricter transfer alias for Telegram/private scopes.
	let browserTransfer: ((...args: unknown[]) => Promise<unknown>) | undefined;
	const directoryMethods = new Map<
		PropertyKey,
		(...args: unknown[]) => Promise<unknown>
	>();
	async function awaitLegacyDirectoryAdmission() {
		if (legacyWritable || !legacyAdmission) return;
		const admission = legacyAdmission,
			generation = startupGeneration;
		await new Promise<void>((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				cancellation.signal.removeEventListener("abort", finish);
				resolve();
			};
			const timer = setTimeout(finish, startupTimeout);
			cancellation.signal.addEventListener("abort", finish, { once: true });
			void admission.then(finish, finish);
			if (cancellation.signal.aborted) finish();
		});
		if (disposed || generation !== startupGeneration || !legacyWritable)
			throw new Error("Legacy browser startup has not admitted writes");
	}
	const guardedLegacy = new Proxy(guarded, {
		get(target, property) {
			if (property === "open" || property === "showProjects") {
				const existing = directoryMethods.get(property);
				if (existing) return existing;
				const method: unknown = Reflect.get(target, property, target);
				if (typeof method !== "function") return method;
				const waiting = async (...args: unknown[]) => {
					await awaitLegacyDirectoryAdmission();
					return Reflect.apply(method, target, args);
				};
				directoryMethods.set(property, waiting);
				return waiting;
			}
			if (property !== "importProjectTransfer")
				return Reflect.get(target, property, target);
			if (browserTransfer) return browserTransfer;
			const method: unknown = Reflect.get(
				legacy.controller,
				property,
				legacy.controller,
			);
			if (typeof method !== "function") return method;
			browserTransfer = (...args: unknown[]) =>
				trackWritable(() => Reflect.apply(method, legacy.controller, args));
			return browserTransfer;
		},
	});
	const absent: BrowserRegisteredControllerSlot = {
		readDirectory: async () => ({ kind: "unavailable" }),
		dispose: async () => undefined,
	};
	const facade = createBrowserProjectControllerFacade({
		legacy: guardedLegacy,
		registered: registered ?? absent,
	});
	async function admitLegacy(
		requested: ReleaseStartupInput,
		generation: number,
	): Promise<ReleaseStartupOutcome> {
		try {
			const actual = snapshot(await readReleaseStartupInput());
			if (
				disposed ||
				generation !== startupGeneration ||
				!readCompatible(actual) ||
				!readCompatible(requested) ||
				JSON.stringify(actual.shellManifest) !==
					JSON.stringify(requested.shellManifest)
			)
				return readonly();
			notifyStartupSources(generation);
			if (disposed || generation !== startupGeneration) return readonly();
			const manifest = actual.shellManifest;
			if (
				!isReleaseManifest(manifest) ||
				![
					manifest.projectSchemas,
					manifest.assetSchemas,
					manifest.catalogSchemas,
				].every((range) => range.writable.includes(1))
			)
				return readonly();
			// Invoke only after current shell/worker/capability checks. The original
			// coordinator remains the owner of old storage recovery and migration.
			const outcome = await legacy.releaseStartup.handshake(actual);
			if (disposed || generation !== startupGeneration) return readonly();
			legacyWritable = outcome.kind === "writable";
			if (outcome.kind === "read-only/exportable")
				legacyRecovery = { generation, record: copyRecovery(outcome.recovery) };
			else if (outcome.kind === "writable") legacyRecovery = undefined;
			notifyStartupSources(generation);
			return outcome;
		} catch {
			return readonly();
		}
	}
	return {
		...(readonlyProjects ? { readonlyProjects } : {}),
		getReadonlyProjectSources: () =>
			disposed
				? noReadonlySources
				: legacyWritable
					? registeredWritable
						? noReadonlySources
						: registeredReadonlySource
					: registeredWritable
						? legacyReadonlySource
						: bothReadonlySources,
		controller: facade.controller,
		canCreateLegacyProject: () => legacyWritable && !disposed,
		hasWritableSourceAdmission: () => !disposed && (legacyWritable || registeredWritable),
		getStartupSourcesRevision: () => startupSourcesRevision,
		subscribeStartupSources(listener) {
			if (disposed) return () => undefined;
			startupSourceListeners.add(listener);
			return () => {
				startupSourceListeners.delete(listener);
			};
		},
		getLegacyStartupRecovery: () =>
			disposed || legacyRecovery?.generation !== startupGeneration
				? undefined
				: copyRecovery(legacyRecovery.record),
		getEditorInstanceSnapshot: facade.getEditorInstanceSnapshot,
		subscribeEditorInstance: facade.subscribeEditorInstance,
		navigationProtection: {
			discardWriterRecoveryAndShowProjects:
				facade.discardWriterRecoveryAndShowProjects,
		},
		releaseStartup: {
			handshake(input) {
				return owned(async () => {
					const generation = ++startupGeneration;
					legacyWritable = registeredWritable = false;
					legacyAdmission = undefined;
					notifyStartupSources(generation);
					if (disposed || generation !== startupGeneration) return readonly();
					let requested: ReleaseStartupInput;
					try {
						requested = snapshot(input);
					} catch {
						return readonly();
					}
					if (readonlyProjects) {
						const readAdmission = owned(() =>
							readonlyProjects.admit(requested),
						);
						void readAdmission.then(
							() => notifyStartupSources(generation),
							() => notifyStartupSources(generation),
						);
					}
					legacyAdmission = owned(() => admitLegacy(requested, generation));
					const stages = [
						legacyAdmission,
						owned(
							() =>
								registered?.releaseStartup.handshake(requested) ?? readonly(),
						),
					];
					return new Promise<ReleaseStartupOutcome>((resolve) => {
						let settled = false,
							remaining = stages.length;
						let old: ReleaseStartupOutcome = readonly();
						const knownReadonly = (): ReleaseStartupOutcome =>
							old.kind === "read-only/exportable" ||
							old.kind === "migration-in-progress"
								? old
								: readonly();
						const finish = (outcome: ReleaseStartupOutcome) => {
							if (settled) return;
							settled = true;
							clearTimeout(timer);
							if (disposed || generation !== startupGeneration) {
								resolve(readonly());
								return;
							}
							try {
								input.onModeChange?.(outcome.kind);
							} catch {
								/* Observers cannot grant source capability. */
							}
							resolve(
								disposed || generation !== startupGeneration
									? readonly()
									: outcome,
							);
						};
						const timer = setTimeout(
							() => finish(knownReadonly()),
							startupTimeout,
						);
						for (const [index, stage] of stages.entries()) {
							void stage.then(
								(outcome) => {
									if (index === 0) old = outcome;
									remaining--;
									if (disposed || generation !== startupGeneration)
										finish(readonly());
									else {
										if (index === 1)
											registeredWritable = outcome.kind === "writable";
										notifyStartupSources(generation);
										if (disposed || generation !== startupGeneration)
											finish(readonly());
										else if (outcome.kind === "writable")
											finish({ kind: "writable" });
										else if (remaining === 0) finish(knownReadonly());
									}
								},
								() => {
									remaining--;
									if (!disposed && generation === startupGeneration)
										notifyStartupSources(generation);
									if (remaining === 0) finish(knownReadonly());
								},
							);
						}
					});
				});
			},
		},
		dispose() {
			if (disposal) return disposal;
			let complete: () => void = () => {},
				fail: (reason: unknown) => void = () => {};
			disposal = new Promise<void>((resolve, reject) => {
				complete = resolve;
				fail = reject;
			});
			disposed = true;
			legacyWritable = registeredWritable = false;
			startupGeneration++;
			cancellation.abort();
			for (const unsubscribe of [...subscriptions]) {
				try {
					unsubscribe();
				} catch {
					/* Revoke all remaining observers and drain work. */
				}
			}
			let readonlyDrain: Promise<void> | undefined;
			if (readonlyProjects) {
				try {
					readonlyDrain = readonlyProjects.dispose();
				} catch (error) {
					readonlyDrain = Promise.reject(error);
				}
			}
			let facadeDrain: Promise<void>;
			try {
				facadeDrain = facade.dispose();
			} catch (error) {
				facadeDrain = Promise.reject(error);
			}
			notifyStartupSources(startupGeneration);
			startupSourceListeners.clear();
			const drains = readonlyDrain
				? [facadeDrain, readonlyDrain]
				: [facadeDrain];
			void Promise.allSettled([...drains, ...pending]).then((outcomes) => {
				const rejected = outcomes
					.slice(0, drains.length)
					.find(
						(result): result is PromiseRejectedResult =>
							result.status === "rejected",
					);
				if (rejected) fail(rejected.reason);
				else complete();
			});
			// The old runtime exposes no close port. Only its admitted wrappers and
			// already-started application work are revoked/drained here.
			return disposal;
		},
	};
}
function readonly(): ReleaseStartupOutcome {
	return { kind: "read-only/exportable", recovery: {} };
}
function snapshot(input: ReleaseStartupInput): ReleaseStartupInput {
	return {
		capabilities: { ...input.capabilities },
		shellManifest: structuredClone(input.shellManifest),
		workerManifest: structuredClone(input.workerManifest),
		hasControllingWorker: input.hasControllingWorker,
	};
}
function readCompatible(input: ReleaseStartupInput): boolean {
	const manifest = input.shellManifest;
	return (
		isReleaseManifest(manifest) &&
		[
			manifest.projectSchemas,
			manifest.assetSchemas,
			manifest.catalogSchemas,
		].every((range) => range.readable.includes(1)) &&
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

function copyRecovery(record: ReleaseRecoveryRecord): ReleaseRecoveryRecord {
	return {
		...(record.projectId === undefined ? {} : { projectId: record.projectId }),
		...(record.serializedProject === undefined
			? {}
			: { serializedProject: record.serializedProject }),
	};
}
