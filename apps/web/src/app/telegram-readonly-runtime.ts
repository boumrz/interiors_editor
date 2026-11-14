import type { TelegramReadonlyProjectSource } from "../adapters/persistence/telegram-readonly-project-source";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import type { ExportPortableBackupResult } from "../application/export-portable-backup";
import type {
	ProjectDirectoryResult,
	ProjectSourceRecoveryPort,
} from "../application/ports";
import type { ReleaseRuntimeCapabilities } from "./release-startup";
import {
	approveReadableTelegramRelease,
	isApprovedReadableTelegramRelease,
	type ApprovedReadableTelegramRelease,
} from "./telegram-readable-release";

export interface TelegramReadonlyRuntimeDependencies {
	readonly approval: ApprovedReadableTelegramRelease;
	readonly scope: VerifiedTelegramScope;
	readonly source: TelegramReadonlyProjectSource;
	readonly context: {
		readonly secureContext: boolean;
		readonly readCapabilities: () => ReleaseRuntimeCapabilities;
		readonly readWorker: (signal: AbortSignal) => Promise<{
			readonly hasControllingWorker: boolean;
			readonly workerManifest: unknown;
		}>;
	};
}
export interface TelegramReadonlyRuntime {
	readonly scope: VerifiedTelegramScope;
	readonly signal: AbortSignal;
	readonly sourceRecovery: ProjectSourceRecoveryPort;
	start(): Promise<boolean>;
	listProjects(): Promise<ProjectDirectoryResult>;
	exportProjectTransfer(
		projectId: string,
		expectedRevisionId: string,
		options?: { readonly signal?: AbortSignal },
	): Promise<ExportPortableBackupResult>;
	dispose(): Promise<void>;
}

/** Admission/lifetime only. The injected existing-only source owns data proofs. */
export function createTelegramReadonlyRuntime(
	dependencies: TelegramReadonlyRuntimeDependencies,
): TelegramReadonlyRuntime {
	const { approval, scope, source } = dependencies;
	if (!isApprovedReadableTelegramRelease(approval))
		throw new Error("Approved readable Telegram release is required");
	if (
		typeof scope !== "string" ||
		!/^tma-v1-[a-f0-9]{64}$/.test(scope) ||
		source.scope !== scope
	)
		throw new Error("Exact verified Telegram source scope is required");
	const context = { ...dependencies.context };
	const controller = new AbortController();
	const pending = new Set<Promise<unknown>>();
	const list = source.listProjects.bind(source);
	const listRaw = source.sourceRecovery.listRecoverySources.bind(
		source.sourceRecovery,
	);
	const readRaw = source.sourceRecovery.readRecoverySource.bind(
		source.sourceRecovery,
	);
	const exportBackup = source.exportPortableBackup.bind(source);
	let admitted = false;
	let starting: Promise<boolean> | undefined;
	let disposal: Promise<void> | undefined;
	function track<T>(operation: () => T | Promise<T>): Promise<T> {
		let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (reason: unknown) => void;
		const promise = new Promise<T>((done, fail) => {
			resolve = done;
			reject = fail;
		});
		pending.add(promise);
		void promise.then(
			() => pending.delete(promise),
			() => pending.delete(promise),
		);
		try {
			Promise.resolve(operation()).then(resolve, reject);
		} catch (error) {
			reject(error);
		}
		return promise;
	}
	function dispose(): Promise<void> {
		if (disposal) return disposal;
		let finish!: () => void;
		let fail!: (reason: unknown) => void;
		disposal = new Promise<void>((resolve, reject) => {
			finish = resolve;
			fail = reject;
		});
		admitted = false;
		source.signal.removeEventListener("abort", sourceRevoked);
		controller.abort();
		let sourceDrain: Promise<void>;
		try {
			sourceDrain = source.dispose();
		} catch (error) {
			sourceDrain = Promise.reject(error);
		}
		void Promise.allSettled([...pending, sourceDrain]).then((outcomes) => {
			const sourceOutcome = outcomes[outcomes.length - 1];
			if (sourceOutcome?.status === "rejected") fail(sourceOutcome.reason);
			else finish();
		});
		return disposal;
	}
	function sourceRevoked(): void {
		void dispose().catch(() => undefined);
	}
	async function readable(): Promise<boolean> {
		if (controller.signal.aborted || source.signal.aborted) return false;
		try {
			const worker = await context.readWorker(controller.signal);
			const capabilities = { ...context.readCapabilities() };
			if (controller.signal.aborted || source.signal.aborted) return false;
			const result = approveReadableTelegramRelease({
				capsule: {
					deliveryTarget: "telegram",
					entryPath: approval.entryPath,
					manifest: approval.manifest,
				},
				loadedEntryPath: approval.entryPath,
				capabilities,
				secureContext: context.secureContext,
				hasControllingWorker: worker.hasControllingWorker,
				workerManifest: worker.workerManifest,
			});
			if (
				result.kind === "approved" &&
				!controller.signal.aborted &&
				!source.signal.aborted
			)
				return true;
		} catch {
			/* No inspection failure grants a read capability. */
		}
		void dispose().catch(() => undefined);
		return false;
	}
	function guard<T>(operation: () => T | Promise<T>): Promise<T> {
		if (!admitted || controller.signal.aborted)
			return Promise.reject(
				new Error("Telegram readonly runtime is not admitted"),
			);
		return track(async () => {
			if (
				!(await readable()) ||
				controller.signal.aborted ||
				source.signal.aborted
			)
				throw new Error("Telegram readonly context is unavailable");
			const result = await operation();
			if (
				!(await readable()) ||
				controller.signal.aborted ||
				source.signal.aborted
			)
				throw new Error("Telegram readonly context changed");
			return result;
		});
	}
	source.signal.addEventListener("abort", sourceRevoked, { once: true });
	if (source.signal.aborted) void dispose().catch(() => undefined);
	return {
		scope,
		signal: controller.signal,
		sourceRecovery: {
			listRecoverySources: () => guard(listRaw),
			readRecoverySource: (projectId, revisionId) =>
				guard(() => readRaw(projectId, revisionId)),
		},
		start() {
			if (controller.signal.aborted) return Promise.resolve(false);
			if (!starting) {
				let finish!: (admitted: boolean) => void;
				let fail!: (reason: unknown) => void;
				starting = new Promise<boolean>((resolve, reject) => {
					finish = resolve;
					fail = reject;
				});
				void track(async () => {
					admitted =
						(await readable()) &&
						!controller.signal.aborted &&
						!source.signal.aborted;
					return admitted;
				}).then(finish, fail);
			}
			return starting;
		},
		listProjects: () => guard(list),
		exportProjectTransfer: (projectId, revisionId, options) =>
			guard(async () => {
				if (options?.signal?.aborted)
					return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
				const result = await exportBackup(
					projectId,
					revisionId,
					options?.signal,
				);
				return options?.signal?.aborted
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: result;
			}),
		dispose,
	};
}
