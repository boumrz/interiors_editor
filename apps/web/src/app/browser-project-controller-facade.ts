import type { ImportPortableBackupStatus } from "../application/import-portable-backup";
import type {
	ProjectDirectoryResult,
	ProjectOpenOptions,
	ProjectStorageNamespace,
	ProjectStorageOwnerOptions,
	ProjectStorageSourceStatus,
	ProjectSummary,
	ProjectTransferExportOptions,
} from "../application/ports";
import type { BrowserEditorInstanceSnapshot } from "./browser-editor-instance";
import type {
	ProjectController,
	ProjectScreenState,
} from "./project-controller";

export type BrowserRegisteredDirectoryRead =
	| { readonly kind: "available"; readonly directory: ProjectDirectoryResult }
	| { readonly kind: "not-provisioned"; readonly history: "unknown" }
	| { readonly kind: "unavailable" | "recovery-required" };

export interface BrowserRegisteredControllerSlot {
	readonly controller?: ProjectController;
	/** Existing-only probe/recover/list. This query never initializes a database. */
	readDirectory(): Promise<BrowserRegisteredDirectoryRead>;
	dispose(): Promise<void>;
}

let nextFacadeIdentity = 0n;

type RetainedIdentity = NonNullable<
	ReturnType<ProjectController["pendingPublicationIdentity"]>
>;

function sameIdentity(
	a: RetainedIdentity | undefined,
	b: RetainedIdentity | undefined,
): boolean {
	return (
		a !== undefined &&
		b !== undefined &&
		a.projectId === b.projectId &&
		a.revisionId === b.revisionId &&
		a.checksum === b.checksum
	);
}
function writerCopyIdentity(
	core: ProjectController,
): RetainedIdentity | undefined {
	const copy = core.writerRecoveryCopy();
	return copy && copy.project.projectId === copy.revision.projectId
		? {
				projectId: copy.project.projectId,
				revisionId: copy.revision.revisionId,
				checksum: copy.revision.checksum,
			}
		: undefined;
}

type DirectoryPart = {
	readonly projects: readonly ProjectSummary[];
	readonly status: ProjectStorageSourceStatus;
	readonly recoveryNeeded?: true;
};

/** Trusted browser composition only. No Project/file/raw ID can choose a storage owner. */
export function createBrowserProjectControllerFacade(dependencies: {
	readonly legacy: ProjectController;
	readonly registered: BrowserRegisteredControllerSlot;
}) {
	const { legacy, registered } = dependencies;
	const registeredController = registered.controller;
	const cores = [legacy, registeredController].filter(
		(core): core is ProjectController => core !== undefined,
	);
	let disposed = false;
	let disposal: Promise<void> | undefined;
	const operations = new Set<Promise<void>>();
	let state: ProjectScreenState = { kind: "loading" };
	let opened = false;
	let directoryFlight: Promise<void> | undefined;
	let directoryGeneration = 0,
		directoryFlightGeneration = -1;
	let registeredReadFlight: Promise<DirectoryPart> | undefined;
	const identity = (++nextFacadeIdentity).toString();
	let instanceGeneration = 0n;
	let instance: BrowserEditorInstanceSnapshot = Object.freeze({
		key: `browser-facade:${identity}:0`,
	});
	let activeNamespace: ProjectStorageNamespace | undefined;
	let activeProjectId: string | undefined;
	let viewEpoch = 0n;
	let retainedImport:
		| {
				readonly namespace: ProjectStorageNamespace;
				readonly identity: RetainedIdentity;
		  }
		| undefined;
	let retryResolution: RetainedIdentity | undefined;
	let navigationPending = 0,
		commandsPending = 0,
		importsPending = 0;
	let importCore: ProjectController | undefined;
 let startingLegacyProject = false;
	const listeners = new Set<(state: ProjectScreenState) => void>();
	const instanceListeners = new Set<() => void>();
	const pending = () =>
		legacy.hasPendingPublication() ||
		(registeredController?.hasPendingPublication() ?? false);
	const retainedPublication = () =>
		legacy.pendingPublicationIdentity() !== undefined ||
		registeredController?.pendingPublicationIdentity() !== undefined;
	const coreFor = (namespace: ProjectStorageNamespace) =>
		namespace === "legacy" ? legacy : registeredController;
	const selected = () => coreFor(activeNamespace ?? "legacy");
	const isNamespace = (value: unknown): value is ProjectStorageNamespace =>
		value === "legacy" || value === "browser-registered";
	const blockedNavigation = () =>
		disposed ||
		navigationPending > 0 ||
		commandsPending > 0 ||
		importsPending > 0 ||
		pending() ||
		retainedPublication() ||
		cores.some(
			(core) =>
				core.snapshot().kind === "persist-failed" ||
				core.snapshot().kind === "saving" ||
				core.writerRecoveryCopy() !== undefined,
		);
	const emit = (snapshot: ProjectScreenState) => {
		if (disposed) return;
		state = snapshot;
		for (const listener of [...listeners]) {
			if (disposed) break;
			try {
				listener(state);
			} catch {
				/* Observers cannot change the selected operation. */
			}
		}
	};
	const changeInstance = (requestedRenameProjectId?: string) => {
		if (disposed) return;
		instance = Object.freeze({
			key: `browser-facade:${identity}:${++instanceGeneration}`,
			controller: createViewController(viewEpoch),
			...(activeNamespace === undefined
				? {}
				: { storageNamespace: activeNamespace }),
			...(requestedRenameProjectId === undefined
				? {}
				: { requestedRenameProjectId }),
		});
		for (const listener of [...instanceListeners]) {
			if (disposed) break;
			try {
				listener();
			} catch {
				/* Other views must still receive this generation. */
			}
		}
	};
	function projectIdOf(snapshot: ProjectScreenState): string | undefined {
		return "project" in snapshot ? snapshot.project?.projectId : undefined;
	}
	function matchesSelectedAddress(
		core: ProjectController | undefined,
	): core is ProjectController {
		if (!core) return false;
		if (activeNamespace === undefined || activeProjectId === undefined)
			return true;
		const snapshot = core.snapshot(),
			id = projectIdOf(snapshot);
		return (
			snapshot.kind !== "first-run" &&
			(id === undefined || id === activeProjectId)
		);
	}
	function acceptSelectedSnapshot(snapshot: ProjectScreenState): void {
		if (
			retryResolution &&
			snapshot.kind === "saved" &&
			activeNamespace !== undefined &&
			snapshot.project.projectId === retryResolution.projectId &&
			snapshot.revisionId === retryResolution.revisionId &&
			sameIdentity(
				coreFor(activeNamespace)?.currentRevisionIdentity(),
				retryResolution,
			)
		) {
			activeProjectId = snapshot.project.projectId;
			retainedImport = undefined;
			retryResolution = undefined;
			viewEpoch++;
			emit(snapshot);
			changeInstance();
			return;
		}
		const id = projectIdOf(snapshot);
		if (
			activeProjectId !== undefined &&
			((id !== undefined && id !== activeProjectId) ||
				snapshot.kind === "first-run")
		) {
			emit({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
			return;
		}
		if (
			activeProjectId === undefined &&
			id !== undefined &&
			commandsPending > 0
		)
			activeProjectId = id;
		emit(snapshot);
	}
	const subscriptions = (["legacy", "browser-registered"] as const).map(
		(namespace) =>
			coreFor(namespace)?.subscribe((snapshot) => {
				if (
					!disposed &&
					activeNamespace === namespace &&
                    !(startingLegacyProject && namespace === "legacy") &&
					snapshot.kind !== "projects" &&
					!(importsPending > 0 && importCore === coreFor(namespace))
				)
					acceptSelectedSnapshot(snapshot);
			}),
	);

	async function readLegacy(initial: boolean): Promise<DirectoryPart> {
		try {
			await (initial ? legacy.open() : legacy.showProjects());
			const snapshot = legacy.snapshot();
			if (snapshot.kind === "projects")
				return {
					projects: snapshot.projects.map((row) => ({
						...row,
						storageNamespace: "legacy",
					})),
					status: { storageNamespace: "legacy", kind: "available" },
					...(snapshot.recoveryNeeded ? { recoveryNeeded: true } : {}),
				};
			if (snapshot.kind === "first-run")
				return {
					projects: [],
					status: { storageNamespace: "legacy", kind: "available" },
				};
			return {
				projects: [],
				status: { storageNamespace: "legacy", kind: "recovery-required" },
				recoveryNeeded: true,
			};
		} catch {
			return {
				projects: [],
				status: { storageNamespace: "legacy", kind: "unavailable" },
			};
		}
	}
	async function readRegisteredOnce(): Promise<DirectoryPart> {
		if (!registeredController)
			return {
				projects: [],
				status: { storageNamespace: "browser-registered", kind: "unavailable" },
			};
		try {
			const result = await registered.readDirectory();
			if (result.kind === "not-provisioned")
				return {
					projects: [],
					status: {
						storageNamespace: "browser-registered",
						kind: "not-provisioned",
						history: "unknown",
					},
				};
			if (result.kind !== "available")
				return {
					projects: [],
					status: { storageNamespace: "browser-registered", kind: result.kind },
				};
			if (result.directory.kind === "recovery-needed")
				return {
					projects: [],
					status: {
						storageNamespace: "browser-registered",
						kind: "recovery-required",
					},
					recoveryNeeded: true,
				};
			return {
				projects:
					result.directory.kind === "populated"
						? result.directory.projects.map((row) => ({
								...row,
								storageNamespace: "browser-registered",
							}))
						: [],
				status: { storageNamespace: "browser-registered", kind: "available" },
				...(result.directory.kind === "populated" &&
				result.directory.recoveryNeeded
					? { recoveryNeeded: true }
					: {}),
			};
		} catch {
			return {
				projects: [],
				status: { storageNamespace: "browser-registered", kind: "unavailable" },
			};
		}
	}
	function readRegistered(): Promise<DirectoryPart> {
		if (registeredReadFlight) return registeredReadFlight;
		const reading = readRegisteredOnce();
		registeredReadFlight = reading;
		void reading.finally(() => {
			if (registeredReadFlight === reading) registeredReadFlight = undefined;
		});
		return reading;
	}
	function directory(initial: boolean): Promise<void> {
		if (
			directoryFlight &&
			directoryFlightGeneration === directoryGeneration &&
			activeNamespace === undefined
		)
			return directoryFlight;
		if (blockedNavigation()) return Promise.resolve();
		const previousNamespace = activeNamespace,
			generation = ++directoryGeneration;
		if (previousNamespace !== undefined) viewEpoch++;
		directoryFlightGeneration = generation;
		activeNamespace = undefined;
		activeProjectId = undefined;
		retainedImport = undefined;
		let a: DirectoryPart = {
			projects: [],
			status: { storageNamespace: "legacy", kind: "unavailable" },
		};
		let b: DirectoryPart = {
			projects: [],
			status: { storageNamespace: "browser-registered", kind: "unavailable" },
		};
		let changedInstance = false;
		const publish = () => {
			if (
				disposed ||
				generation !== directoryGeneration ||
				activeNamespace !== undefined
			)
				return;
			emit({
				kind: "projects",
				projects: [...a.projects, ...b.projects],
				storageSources: [a.status, b.status],
				...(a.recoveryNeeded || b.recoveryNeeded
					? { recoveryNeeded: true }
					: {}),
			});
			if (previousNamespace !== undefined && !changedInstance) {
				changedInstance = true;
				changeInstance();
			}
		};
		const legacyRead = readLegacy(initial).then((part) => {
			a = part;
			publish();
		});
		const privateRead = (async (): Promise<DirectoryPart> => {
			if (previousNamespace === "browser-registered" && registeredController) {
				try {
					await registeredController.showProjects();
				} catch {
					return {
						projects: [],
						status: {
							storageNamespace: "browser-registered",
							kind: "unavailable",
						},
					};
				}
			}
			return readRegistered();
		})().then((part) => {
			b = part;
			publish();
		});
		const reading = Promise.all([legacyRead, privateRead]).then(
			() => undefined,
		);
		directoryFlight = reading;
		void reading.finally(() => {
			if (directoryFlight === reading) directoryFlight = undefined;
		});
		return reading;
	}
	async function openProject(
		projectId: string,
		options?: ProjectOpenOptions,
	): Promise<void> {
		if (!isNamespace(options?.storageNamespace) || blockedNavigation()) return;
		const namespace = options.storageNamespace,
			core = coreFor(namespace);
		if (!core) return;
		opened = true;
		directoryGeneration++;
		navigationPending++;
		viewEpoch++;
		activeNamespace = namespace;
		activeProjectId = projectId;
		retainedImport = undefined;
		emit({ kind: "loading" });
		try {
			if (disposed) return;
			const opening = core.openProject(projectId);
			changeInstance(
				options.initialAction === "rename" ? projectId : undefined,
			);
			await opening;
			acceptSelectedSnapshot(core.snapshot());
		} catch {
			emit({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
		} finally {
			navigationPending--;
		}
	}
	const nonblockingReads = new Set<PropertyKey>([
		"storagePressure",
		"requestPersistentStorage",
		"readCustomGlbResource",
		"listCustomGlbLibraryAssets",
		"listRemovedCustomGlbLibraryResourceHashes",
		"exportRecoveryDraft",
		"exportProjectJson",
		"exportPortableBackup",
	]);
	const synchronousQueries = new Set<PropertyKey>([
		"sessionHistory",
		"sessionHistoryCommandLabels",
		"currentRevisionIdentity",
		"pendingPublicationIdentity",
		"sessionRetentionRoots",
		"writerAccess",
		"writerRecoveryCopy",
		"recoveryReadOnlyProject",
		"recoveryCustomGlbRemovalSummary",
		"persistenceRetryPolicy",
	]);
	async function invokeCurrent(
		property: PropertyKey,
		args: unknown[],
	): Promise<unknown> {
		if (disposed) return staleValue(property);
		if (
			activeNamespace === undefined &&
			![
				"storagePressure",
				"requestPersistentStorage",
				"listCustomGlbLibraryAssets",
				"listRemovedCustomGlbLibraryResourceHashes",
			].includes(String(property))
		)
			return { kind: "not-ready" };
		if (
			!nonblockingReads.has(property) &&
			(navigationPending > 0 || importsPending > 0)
		)
			return { kind: "not-ready" };
		const namespace = activeNamespace ?? "legacy",
			core = coreFor(namespace),
			generation = instance;
		if (!matchesSelectedAddress(core)) {
			emit({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
			return staleValue(property);
		}
		const blocking = !nonblockingReads.has(property);
		const retained = core.pendingPublicationIdentity();
		if (
			blocking &&
			(retained !== undefined ||
				core.writerRecoveryCopy() !== undefined ||
				core.snapshot().kind === "persist-failed") &&
			![
				"retry",
				"refreshWriterLeaseAccess",
				"refreshSessionHistoryIntegrity",
			].includes(String(property))
		)
			return staleValue(property);
		if (
			property === "retry" &&
			retainedImport?.namespace === namespace &&
			sameIdentity(retainedImport.identity, retained)
		)
			retryResolution = retainedImport.identity;
		if (blocking) commandsPending++;
		try {
			const value: unknown = Reflect.get(core, property, core);
			if (typeof value !== "function") return { kind: "not-ready" };
			const result: unknown = await Reflect.apply(value, core, args);
			return disposed ? staleValue(property) : result;
		} catch {
			return staleValue(property);
		} finally {
			if (blocking) commandsPending--;
			if (property === "retry") retryResolution = undefined;
			if (
				!disposed &&
				activeNamespace === namespace &&
				instance === generation
			) {
				if (core.snapshot().kind === "projects") await directory(false);
				else acceptSelectedSnapshot(core.snapshot());
			}
		}
	}
	async function exportTransfer(
		property: "exportProjectTransfer" | "exportRegisteredProjectTransfer",
		projectId?: string,
		options?: ProjectTransferExportOptions,
	) {
		if (disposed) return { kind: "not-ready" as const };
		const namespace =
			projectId === undefined ? activeNamespace : options?.storageNamespace;
		if (
			!isNamespace(namespace) ||
			(projectId === undefined &&
				options?.storageNamespace !== undefined &&
				options.storageNamespace !== namespace)
		)
			return { kind: "not-ready" as const };
		const core = coreFor(namespace),
			generation = instance;
		if (!core) return { kind: "not-ready" as const };
		if (projectId === undefined && !matchesSelectedAddress(core))
			return { kind: "not-ready" as const };
		try {
			const result = await core[property](projectId, {
				signal: options?.signal,
			});
			return !disposed && instance === generation
				? result
				: { kind: "not-ready" as const };
		} catch {
			return { kind: "not-ready" as const };
		}
	}
	async function deleteDirectoryProject(
		projectId: string,
		options?: ProjectStorageOwnerOptions,
	) {
		if (
			state.kind !== "projects" ||
			!isNamespace(options?.storageNamespace) ||
			blockedNavigation()
		)
			return { kind: "not-ready" as const };
		const core = coreFor(options.storageNamespace);
		if (!core) return { kind: "not-ready" as const };
		commandsPending++;
		let result: Awaited<
			ReturnType<ProjectController["permanentlyDeleteProjectFromDirectory"]>
		>;
		try {
			await core.showProjects();
			if (disposed) return { kind: "not-ready" as const };
			result = await core.permanentlyDeleteProjectFromDirectory(projectId);
		} catch {
			return { kind: "not-ready" as const };
		} finally {
			commandsPending--;
		}
		if (result.kind === "permanently-deleted") await directory(false);
		return result;
	}
	function startNewProject(): void {
        if (blockedNavigation()) return;
        navigationPending++;
        startingLegacyProject = true;
        try {
            const previous = legacy.snapshot();
            legacy.startNewProject();
            const snapshot = legacy.snapshot();
            if (disposed || snapshot === previous || snapshot.kind !== "first-run") return;
            opened = true;
            directoryGeneration++;
            viewEpoch++;
            activeNamespace = "legacy";
            activeProjectId = undefined;
            retainedImport = undefined;
            emit(snapshot);
            changeInstance();
        } catch {
            // A source admission refusal must leave the other view's capability intact.
        } finally {
            startingLegacyProject = false;
            navigationPending--;
        }
    }

	function statusIdentity(
		status: ImportPortableBackupStatus,
	): RetainedIdentity | undefined {
		return status.kind === "saved" || status.kind === "persist-failed"
			? {
					projectId: status.candidate.project.projectId,
					revisionId: status.candidate.revision.revisionId,
					checksum: status.candidate.revision.checksum,
				}
			: undefined;
	}
	async function importInto(
		namespace: ProjectStorageNamespace,
		property: PropertyKey,
		args: unknown[],
	): Promise<unknown> {
		if (disposed) return { kind: "not-ready" };
		if (
			navigationPending > 0 ||
			commandsPending > 0 ||
			importsPending > 0 ||
			pending()
		)
			return { kind: "in-progress" };
		const core = coreFor(namespace);
		if (!core) return { kind: "not-ready" };
		const before = core.snapshot();
		const reselection =
			namespace === "browser-registered" &&
			activeNamespace === namespace &&
			before.kind === "persist-failed";
		if (
			cores.some(
				(item) =>
					item.writerRecoveryCopy() !== undefined ||
					((item.snapshot().kind === "persist-failed" ||
						item.pendingPublicationIdentity() !== undefined) &&
						!(reselection && item === core)),
			)
		)
			return { kind: "not-ready" };
		importsPending++;
		importCore = core;
		let retainedIdentity: ReturnType<typeof statusIdentity>;
		const callArgs = [...args];
		if (property !== "importProjectJson") {
			const callbackName =
				property === "importProjectTransfer" ? "onPortableStatus" : "onStatus";
			const options =
				args[1] !== null && typeof args[1] === "object" ? args[1] : {};
			const observer: unknown = Reflect.get(options, callbackName);
			callArgs[1] = {
				...options,
				[callbackName]: (status: ImportPortableBackupStatus) => {
					if (disposed) return;
					const identity = statusIdentity(status);
					if (identity) retainedIdentity = identity;
					try {
						if (typeof observer === "function") observer(status);
					} catch {
						/* Observer failure cannot select or cancel a different Project. */
					}
				},
			};
		}
		try {
			const method: unknown = Reflect.get(core, property, core);
			if (typeof method !== "function") return { kind: "not-ready" };
			const result: unknown = await Reflect.apply(method, core, callArgs);
			if (disposed) return { kind: "not-ready" };
			const snapshot = core.snapshot();
			if (result !== null && typeof result === "object" && "kind" in result) {
				const durable =
					result.kind === "durable" &&
					"projectId" in result &&
					"revisionId" in result &&
					snapshot.kind === "saved" &&
					snapshot.project.projectId === result.projectId &&
					snapshot.revisionId === result.revisionId;
				const pendingIdentity = core.pendingPublicationIdentity();
				const copyIdentity = writerCopyIdentity(core);
				const proof =
					retainedIdentity ??
					(namespace === "legacy" && snapshot !== before
						? (pendingIdentity ?? copyIdentity)
						: undefined);
				const failed =
					result.kind === "persist-failed" &&
					proof !== undefined &&
					(sameIdentity(proof, pendingIdentity) ||
						sameIdentity(proof, copyIdentity));
				if (durable || failed) {
					opened = true;
					directoryGeneration++;
					viewEpoch++;
					activeNamespace = namespace;
					activeProjectId = projectIdOf(snapshot);
					retainedImport =
						failed && proof ? { namespace, identity: proof } : undefined;
					emit(snapshot);
					changeInstance();
				} else if (result.kind === "durable")
					return { kind: "verification-unavailable" };
			}
			return result;
		} catch {
			return { kind: "verification-unavailable" };
		} finally {
			importsPending--;
			importCore = undefined;
		}
	}
	const methods: Partial<Record<keyof ProjectController, unknown>> = {
		openProject,
		startNewProject,
		create: (name: string) =>
			activeNamespace !== "legacy"
				? Promise.resolve({ kind: "not-ready" })
				: invokeCurrent("create", [name]),
		importRegisteredPortableBackup: (...args: unknown[]) =>
			importInto("browser-registered", "importRegisteredPortableBackup", args),
		importProjectTransfer: (...args: unknown[]) =>
			importInto("legacy", "importProjectTransfer", args),
		importProjectJson: (...args: unknown[]) =>
			importInto("legacy", "importProjectJson", args),
		importPortableBackup: (...args: unknown[]) =>
			importInto("legacy", "importPortableBackup", args),
		importRecoveryDraft: (...args: unknown[]) =>
			importInto("legacy", "importRecoveryDraft", args),
		exportProjectTransfer: (
			projectId?: string,
			options?: ProjectTransferExportOptions,
		) => exportTransfer("exportProjectTransfer", projectId, options),
		exportRegisteredProjectTransfer: (
			projectId?: string,
			options?: ProjectTransferExportOptions,
		) => exportTransfer("exportRegisteredProjectTransfer", projectId, options),
		permanentlyDeleteProjectFromDirectory: deleteDirectoryProject,
		renameProject: (
			name: string,
			options?: { readonly storageNamespace?: ProjectStorageNamespace },
		) =>
			options?.storageNamespace !== undefined &&
			options.storageNamespace !== activeNamespace
				? Promise.resolve({ kind: "not-ready" })
				: invokeCurrent("renameProject", [name]),
		snapshot: () => state,
		subscribe: (listener: (state: ProjectScreenState) => void) => {
			if (disposed) return () => undefined;
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		hasPendingPublication: () =>
			navigationPending > 0 ||
			commandsPending > 0 ||
			importsPending > 0 ||
			pending(),
		open: () => {
			if (disposed) return Promise.resolve();
			if (activeNamespace !== undefined) return Promise.resolve();
			if (directoryFlight && directoryFlightGeneration === directoryGeneration)
				return directoryFlight;
			if (opened) return Promise.resolve();
			if (pending()) return Promise.resolve();
			opened = true;
			return directory(true);
		},
		showProjects: () => directory(!opened),
	};
	function trackOperation(
		property: PropertyKey,
		operation: () => unknown,
	): Promise<unknown> {
		if (disposed) return Promise.resolve(staleValue(property));
		let finish: () => void = () => undefined;
		const drain = new Promise<void>((resolve) => {
			finish = resolve;
		});
		operations.add(drain);
		let result: Promise<unknown>;
		try {
			result = Promise.resolve(operation());
		} catch (error) {
			result = Promise.reject(error);
		}
		const complete = () => {
			operations.delete(drain);
			finish();
		};
		void result.then(complete, complete);
		return result;
	}
	const bound = new Map<PropertyKey, unknown>();
	const controller = new Proxy(legacy, {
		get(target, property) {
			if (Object.hasOwn(methods, property)) {
				const method: unknown = Reflect.get(methods, property);
				if (
					typeof method !== "function" ||
					[
						"snapshot",
						"subscribe",
						"hasPendingPublication",
						"startNewProject",
					].includes(String(property))
				)
					return method;
				if (!bound.has(property))
					bound.set(property, (...args: unknown[]) =>
						trackOperation(property, () =>
							Reflect.apply(method, methods, args),
						),
					);
				return bound.get(property);
			}
			const value: unknown = Reflect.get(target, property, target);
			if (typeof value !== "function" || property === "constructor")
				return value;
			if (bound.has(property)) return bound.get(property);
			const wrapped = synchronousQueries.has(property)
				? (...args: unknown[]) => {
						if (disposed) return staleValue(property);
						const core = selected();
						if (!matchesSelectedAddress(core)) return staleValue(property);
						const method: unknown = Reflect.get(core, property, core);
						return typeof method === "function"
							? Reflect.apply(method, core, args)
							: undefined;
					}
				: (...args: unknown[]) =>
						trackOperation(property, () => invokeCurrent(property, args));
			bound.set(property, wrapped);
			return wrapped;
		},
	});
	function staleValue(property: PropertyKey): unknown {
		if (property === "hasPendingPublication") return true;
		if (property === "sessionHistory")
			return { canUndo: false, canRedo: false };
		if (property === "sessionHistoryCommandLabels")
			return { undoActionLabel: undefined, redoActionLabel: undefined };
		if (property === "writerAccess") return { kind: "not-ready" };
		if (property === "persistenceRetryPolicy") return "allowed";
		if (synchronousQueries.has(property)) return undefined;
		if (
			[
				"listCustomGlbLibraryAssets",
				"listRemovedCustomGlbLibraryResourceHashes",
			].includes(String(property))
		)
			return [];
		if (
			property === "storagePressure" ||
			property === "requestPersistentStorage"
		)
			return { kind: "unavailable" };
		if (
			[
				"readCustomGlbResource",
				"open",
				"openProject",
				"showProjects",
				"retry",
				"recover",
				"startNewProject",
			].includes(String(property))
		)
			return undefined;
		return { kind: "not-ready" };
	}
	function createViewController(epoch: bigint): ProjectController {
		let lastSnapshot = state;
		const cache = new Map<PropertyKey, unknown>();
		return new Proxy(controller, {
			get(target, property) {
				if (cache.has(property)) return cache.get(property);
				let wrapped: unknown;
				if (property === "snapshot")
					wrapped = () => {
						if (viewEpoch === epoch) lastSnapshot = state;
						return lastSnapshot;
					};
				else if (property === "subscribe")
					wrapped = (listener: (snapshot: ProjectScreenState) => void) => {
						if (viewEpoch !== epoch) return () => undefined;
						return target.subscribe((snapshot) => {
							if (viewEpoch === epoch) {
								lastSnapshot = snapshot;
								listener(snapshot);
							}
						});
					};
				else {
					const method: unknown = Reflect.get(target, property, target);
					if (typeof method !== "function" || property === "constructor")
						return method;
					wrapped = (...args: unknown[]) => {
						if (viewEpoch !== epoch)
							return synchronousQueries.has(property) ||
								property === "hasPendingPublication" ||
								property === "startNewProject"
								? staleValue(property)
								: Promise.resolve(staleValue(property));
						const result: unknown = Reflect.apply(method, target, args);
						return nonblockingReads.has(property)
							? Promise.resolve(result).then((value) =>
									viewEpoch === epoch ? value : staleValue(property),
								)
							: result;
					};
				}
				cache.set(property, wrapped);
				return wrapped;
			},
		});
	}
	async function discardWriterRecoveryAndShowProjects(
		expected: ReturnType<ProjectController["writerRecoveryCopy"]>,
	): Promise<boolean> {
		const namespace = activeNamespace;
		if (
			disposed ||
			namespace === undefined ||
			expected === undefined ||
			navigationPending > 0 ||
			commandsPending > 0 ||
			importsPending > 0 ||
			pending() ||
			retainedPublication()
		)
			return false;
		const core = coreFor(namespace),
			other = coreFor(namespace === "legacy" ? "browser-registered" : "legacy");
		if (!core) return false;
		if (
			core.writerRecoveryCopy() !== expected ||
			!(
				(activeProjectId !== undefined &&
					expected.project.projectId === activeProjectId &&
					expected.revision.projectId === activeProjectId) ||
				(retainedImport?.namespace === namespace &&
					sameIdentity(retainedImport.identity, writerCopyIdentity(core)))
			) ||
			other?.writerRecoveryCopy() !== undefined ||
			other?.snapshot().kind === "persist-failed"
		)
			return false;
		const before = state;
		navigationPending++;
		viewEpoch++;
		activeNamespace = undefined;
		try {
			await core.showProjects();
			if (disposed) return false;
			if (core.writerRecoveryCopy() !== undefined) {
				activeNamespace = namespace;
				emit(before);
				changeInstance();
				return false;
			}
		} catch {
			activeNamespace = namespace;
			emit(before);
			changeInstance();
			return false;
		} finally {
			navigationPending--;
		}
		await directory(false);
		changeInstance();
		return !disposed;
	}
	function dispose(): Promise<void> {
		if (disposal) return disposal;
		let complete: () => void = () => undefined,
			fail: (error: unknown) => void = () => undefined;
		disposal = new Promise<void>((resolve, reject) => {
			complete = resolve;
			fail = reject;
		});
		disposed = true;
		viewEpoch++;
		directoryGeneration++;
		for (const unsubscribe of subscriptions) {
			try {
				unsubscribe?.();
			} catch {
				/* Continue revocation and native draining. */
			}
		}
		listeners.clear();
		instanceListeners.clear();
		let nativeDrain: Promise<void>;
		try {
			nativeDrain = registered.dispose();
		} catch (error) {
			nativeDrain = Promise.reject(error);
		}
		void Promise.allSettled([nativeDrain, ...operations]).then((outcomes) => {
			const native = outcomes[0];
			if (native.status === "rejected") fail(native.reason);
			else complete();
		});
		return disposal;
	}
	instance = Object.freeze({
		...instance,
		controller: createViewController(viewEpoch),
	});
	return {
		controller,
		dispose,
		discardWriterRecoveryAndShowProjects: (
			expected: ReturnType<ProjectController["writerRecoveryCopy"]>,
		) =>
			disposed
				? Promise.resolve(false)
				: (trackOperation("showProjects", () =>
						discardWriterRecoveryAndShowProjects(expected),
					) as Promise<boolean>),
		getEditorInstanceSnapshot: () => instance,
		subscribeEditorInstance(listener: () => void) {
			if (disposed) return () => undefined;
			instanceListeners.add(listener);
			return () => {
				instanceListeners.delete(listener);
			};
		},
	};
}
