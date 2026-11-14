import {
	type BrowserReadonlyProjectSource,
	type BrowserReadonlyProjectSourceDependencies,
	type BrowserReadonlySourceDirectory,
	createBrowserReadonlyProjectSource,
} from "../adapters/persistence/browser-readonly-project-source";
import type { ExportPortableBackupResult } from "../application/export-portable-backup";
import type {
	CancellationSignalPort,
	ProjectSourceRecoveryPort,
	ProjectStorageNamespace,
} from "../application/ports";
import type {
	BrowserReadonlyProjectAddress,
	BrowserReadonlyProjectsDirectory,
	BrowserReadonlyProjectsPort,
} from "./browser-readonly-projects-port";
import { isReleaseManifest, type ReleaseStartupInput } from "./release-startup";

export interface BrowserReadonlyProjectsRuntime
	extends BrowserReadonlyProjectsPort {
	admit(input: ReleaseStartupInput): Promise<void>;
	dispose(): Promise<void>;
}
export interface BrowserReadonlyProjectsDependencies
	extends Omit<
		BrowserReadonlyProjectSourceDependencies,
		"storageNamespace" | "admitted" | "previousSource"
	> {
	readonly readReleaseStartupInput: () => Promise<ReleaseStartupInput>;
	readonly directoryTimeoutMs?: number;
}
const namespaces = ["legacy", "browser-registered"] as const;
interface OwnedSource {
	readonly generation: number;
	readonly source: BrowserReadonlyProjectSource;
	readonly recovery: ProjectSourceRecoveryPort;
}

/** Separate read admission and lifetime. No controller, writer, UUID or namespace inference is available here. */
export function createBrowserReadonlyProjects(
	dependencies: BrowserReadonlyProjectsDependencies,
): BrowserReadonlyProjectsRuntime {
	const timeout = dependencies.directoryTimeoutMs ?? 1500;
	if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 60000)
		throw new Error("Invalid readonly directory deadline");
	const cancellation = new AbortController();
	const sources = new Map<ProjectStorageNamespace, OwnedSource>(),
		priorSources = new Map<
			ProjectStorageNamespace,
			BrowserReadonlyProjectSource
		>(),
		pending = new Set<Promise<unknown>>(),
		flights = new Map<OwnedSource, Promise<BrowserReadonlySourceDirectory>>();
	let generation = 0,
		closed = false,
		requested: ReleaseStartupInput | undefined,
		disposal: Promise<void> | undefined;
	let priorDrainFailure: { readonly reason: unknown } | undefined;
	const own = <T>(operation: () => Promise<T>): Promise<T> => {
		if (closed) return Promise.reject(unavailableError());
		const result = Promise.resolve().then(operation);
		pending.add(result);
		void result.then(
			() => pending.delete(result),
			() => pending.delete(result),
		);
		return result;
	};
	const current = (owned: OwnedSource) =>
		!closed &&
		owned.generation === generation &&
		sources.get(owned.source.storageNamespace) === owned &&
		!owned.source.signal.aborted;
	const drainSource = (owned: OwnedSource): Promise<void> => {
		let drain: Promise<void>;
		try {
			drain = owned.source.dispose();
		} catch (reason) {
			drain = Promise.reject(reason);
		}
		pending.add(drain);
		void drain.then(
			() => pending.delete(drain),
			(reason) => {
				priorDrainFailure ??= { reason };
				pending.delete(drain);
			},
		);
		return drain;
	};
	const revokeSources = () => {
		for (const owned of sources.values()) drainSource(owned);
	};

	const check = async (owned: OwnedSource): Promise<void> => {
		if (!current(owned) || !requested) throw unavailableError();
		let actual: ReleaseStartupInput;
		try {
			actual = snapshot(await dependencies.readReleaseStartupInput());
		} catch (error) {
			if (current(owned)) revokeSources();
			throw error;
		}
		if (!current(owned) || !requested) throw unavailableError();
		if (
			!readable(actual) ||
			!readable(requested) ||
			!sameRelease(actual, requested)
		) {
			revokeSources();
			throw unavailableError();
		}
	};
	const query = <T>(
		owned: OwnedSource,
		operation: (source: BrowserReadonlyProjectSource) => Promise<T>,
	): Promise<T> =>
		own(async () => {
			await check(owned);
			const result = await operation(owned.source);
			await check(owned);
			return result;
		});
	const readOne = (
		namespace: ProjectStorageNamespace,
	): Promise<BrowserReadonlySourceDirectory> => {
		const owned = sources.get(namespace);
		if (!owned || !current(owned))
			return Promise.resolve({
				projects: [],
				status: {
					storageNamespace: namespace,
					kind: owned?.source.getKnownFailure() ?? "unavailable",
				},
			});
		let flight = flights.get(owned);
		if (!flight) {
			flight = query(owned, (source) => source.readDirectory());
			flights.set(owned, flight);
			const active = flight;
			void flight.then(
				() => {
					if (flights.get(owned) === active) flights.delete(owned);
				},
				() => {
					if (flights.get(owned) === active) flights.delete(owned);
				},
			);
		}
		return deadline(flight, timeout).catch(() => ({
			projects: [],
			status: {
				storageNamespace: namespace,
				kind: owned.source.getKnownFailure() ?? ("unavailable" as const),
			},
		}));
	};
	const runtime: BrowserReadonlyProjectsRuntime = {
		signal: cancellation.signal,
		getSourceSignal(namespace) {
			return isNamespace(namespace)
				? sources.get(namespace)?.source.signal
				: undefined;
		},
		getSourceRecovery(namespace) {
			const owned = isNamespace(namespace) ? sources.get(namespace) : undefined;
			return owned && current(owned) ? owned.recovery : undefined;
		},
		admit(input) {
			if (closed) return Promise.reject(unavailableError());
			const captured = ++generation;
			revokeSources();
			sources.clear();
			flights.clear();
			requested = undefined;
			let selected: ReleaseStartupInput;
			try {
				selected = snapshot(input);
			} catch {
				return Promise.resolve();
			}
			return own(async () => {
				let actual: ReleaseStartupInput;
				try {
					actual = snapshot(await dependencies.readReleaseStartupInput());
				} catch {
					return;
				}
				if (
					closed ||
					generation !== captured ||
					!readable(selected) ||
					!readable(actual) ||
					!sameRelease(actual, selected)
				)
					return;
				requested = selected;
				for (const storageNamespace of namespaces) {
					const source = createBrowserReadonlyProjectSource({
						...dependencies,
						storageNamespace,
						previousSource: priorSources.get(storageNamespace),
						admitted: () =>
							!closed && generation === captured && requested !== undefined,
					});
					let owned: OwnedSource;
					const recovery: ProjectSourceRecoveryPort = Object.freeze({
						listRecoverySources: () =>
							query(owned, (value) =>
								value.sourceRecovery.listRecoverySources(),
							),
						readRecoverySource: (projectId: string, revisionId: string) =>
							query(owned, (value) =>
								value.sourceRecovery.readRecoverySource(projectId, revisionId),
							),
					});
					owned = { generation: captured, source, recovery };
					sources.set(storageNamespace, owned);
					priorSources.set(storageNamespace, source);
				}
			});
		},
		readDirectory() {
			if (closed) return Promise.reject(unavailableError());
			const captured = generation;
			return own(async () => {
				const values = await Promise.all(namespaces.map(readOne));
				if (closed || captured !== generation) throw unavailableError();
				const directory: BrowserReadonlyProjectsDirectory = {
					kind: "projects",
					projects: values.flatMap((value) =>
						value.projects.map((project) => ({
							...project,
							storageNamespace: value.status.storageNamespace,
						})),
					),
					storageSources: values.map((value) => value.status),
					...(values.some((value) => value.recoveryNeeded)
						? { recoveryNeeded: true as const }
						: {}),
				};
				return directory;
			});
		},
		async exportBackup(
			address: BrowserReadonlyProjectAddress,
			format: "legacy" | "registered",
			signal?: CancellationSignalPort,
		): Promise<
			ExportPortableBackupResult | { readonly kind: "verification-unavailable" }
		> {
			if (signal?.aborted)
				return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
			if (
				closed ||
				!address ||
				!isNamespace(address.storageNamespace) ||
				typeof address.projectId !== "string" ||
				typeof address.revisionId !== "string" ||
				!address.projectId ||
				!address.revisionId ||
				(format !== "legacy" && format !== "registered")
			)
				return { kind: "verification-unavailable" };
			const owned = sources.get(address.storageNamespace);
			if (!owned || !current(owned))
				return { kind: "verification-unavailable" };
			const selected = {
				projectId: address.projectId,
				revisionId: address.revisionId,
			};
			try {
				const result = await query(owned, (source) =>
					source.exportBackup(
						selected.projectId,
						selected.revisionId,
						format,
						signal,
					),
				);
				return signal?.aborted
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: result;
			} catch {
				return signal?.aborted
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: { kind: "verification-unavailable" };
			}
		},
		dispose() {
			if (disposal) return disposal;
			let finish: () => void = () => undefined,
				fail: (error: unknown) => void = () => undefined;
			disposal = new Promise<void>((resolve, reject) => {
				finish = resolve;
				fail = reject;
			});
			closed = true;
			generation++;
			requested = undefined;
			cancellation.abort();
			const drains = [...sources.values()].map(drainSource);
			void Promise.allSettled([...drains, ...pending]).then(() => {
				sources.clear();
				priorSources.clear();
				flights.clear();
				if (priorDrainFailure) fail(priorDrainFailure.reason);
				else finish();
			});
			return disposal;
		},
	};
	return Object.freeze(runtime);
}
function snapshot(input: ReleaseStartupInput): ReleaseStartupInput {
	return {
		capabilities: { ...input.capabilities },
		shellManifest: structuredClone(input.shellManifest),
		hasControllingWorker: input.hasControllingWorker,
		workerManifest: structuredClone(input.workerManifest),
	};
}
function sameRelease(
	first: ReleaseStartupInput,
	second: ReleaseStartupInput,
): boolean {
	return (
		JSON.stringify(first.shellManifest) === JSON.stringify(second.shellManifest)
	);
}
function readable(input: ReleaseStartupInput): boolean {
	const manifest = input.shellManifest;
	return (
		input.capabilities.indexeddb &&
		isReleaseManifest(manifest) &&
		[
			manifest.projectSchemas,
			manifest.assetSchemas,
			manifest.catalogSchemas,
		].every((range) => range.readable.includes(1)) &&
		(input.hasControllingWorker === true
			? isReleaseManifest(input.workerManifest) &&
				JSON.stringify(input.workerManifest) === JSON.stringify(manifest)
			: input.workerManifest === undefined)
	);
}
function isNamespace(value: unknown): value is ProjectStorageNamespace {
	return value === "legacy" || value === "browser-registered";
}
function unavailableError(): Error {
	return new Error("Current browser readonly source is unavailable");
}
function deadline<T>(promise: Promise<T>, timeout: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(unavailableError()), timeout);
		void promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}
