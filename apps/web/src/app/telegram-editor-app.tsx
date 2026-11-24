import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { HttpCatalogGateway } from "../adapters/catalog/http-catalog-gateway";
import { createTelegramReadonlyProjectSource } from "../adapters/persistence/telegram-readonly-project-source";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { createRegisteredRuntimePortablePorts } from "../adapters/portable-backup/registered-runtime-portable";
import {
	createTelegramHostBootstrap,
	createTelegramSdkScriptSource,
	type TelegramHostBootstrap,
	type TelegramSdkSource,
} from "../adapters/telegram/host-bootstrap";
import {
	captureTelegramHostSdk,
	createTelegramBrowserSignals,
	type TelegramHostCapture,
	type TelegramHostEnvironment,
} from "../adapters/telegram/host-environment";
import { createTelegramHostFileBridge } from "../adapters/telegram/host-file-bridge";
import { createTelegramProjectDownload } from "../adapters/telegram/project-download";
import type {
	TelegramLaunchConfiguration,
	VerifiedTelegramScope,
} from "../adapters/telegram/signed-launch";
import type {
	CatalogGatewayPort,
	CatalogPublicationResult,
} from "../application/ports";
import type { LocalFileTransferPort } from "../ui/local-file-transfer";
import { TelegramLegalDocuments, TelegramLegalEntry, TelegramSettings } from "../ui/telegram-legal-access";
import { bundledLegalDocument, currentLicenseReadable } from "./legal-release";
import { licenseReceipts } from "./license-receipt";
import { TelegramDiagnosticDetails } from "../ui/telegram-diagnostic-details";
import {
	type TelegramReadonlyProblem,
	TelegramReadonlyProjects,
} from "../ui/telegram-readonly-projects";
import {
	type ApprovedReadableTelegramRelease,
	approveReadableTelegramRelease,
} from "./telegram-readable-release";
import { createUsageMetrics, deviceStatisticsStore, type UsageMetrics } from "./telegram-usage-metrics";
import {
	createTelegramReadonlyRuntime,
	type TelegramReadonlyRuntime,
} from "./telegram-readonly-runtime";
import "../ui/global.css";
import {
	browserBinaryChecksum,
	browserChecksum,
	browserClock,
	browserIds,
	browserStorageEstimate,
} from "./browser-ports";
import { EditorApp } from "./editor-app";
import type {
	ReleaseRuntimeCapabilities,
	ReleaseStartupOutcome,
} from "./release-startup";
import {
	createTelegramDiagnostics,
	type TelegramDiagnosticPhase,
} from "./telegram-diagnostics";
import {
	type ApprovedTelegramRelease,
	approveTelegramRelease,
	parseTelegramReleaseCapsule,
} from "./telegram-release-preflight";
import {
	createTelegramRuntime,
	type TelegramRuntime,
} from "./telegram-runtime";



declare const __INTERIORS_EXACT_FLOOR_YAW__: boolean;
declare const __INTERIORS_DOOR_HINGE_AUTHORING__: boolean;
declare const __INTERIORS_RETURN_STUDY__: {
	readonly digest: string;
	readonly active: boolean;
};

type AnalyticsForRuntime = (
	scope: VerifiedTelegramScope,
	runtime?: TelegramRuntime | TelegramReadonlyRuntime,
) => UsageMetrics | undefined;
type AdmittedRuntime = TelegramRuntime | TelegramReadonlyRuntime;

type Links = { readonly telegramURL?: string; readonly webURL?: string };
export type TelegramDeploymentConfiguration = TelegramLaunchConfiguration & {
	readonly usageMetrics?: never;
	readonly telegramURL: string;
	readonly webURL?: string;
};
export function parseTelegramDeploymentConfiguration(value: unknown, _editorOrigin?: string):
	| {
			readonly kind: "configured";
			readonly configuration: TelegramDeploymentConfiguration;
	  }
	| { readonly kind: "unavailable"; readonly links: Links } {
	let links: Links = {};
	try {
		if (!value || typeof value !== "object" || Array.isArray(value))
			return { kind: "unavailable", links };
		const record = value as Record<string, unknown>;
		const telegramURL = httpsLink(record.telegramURL),
			webURL = httpsLink(record.webURL);
		links = Object.freeze({
			...(telegramURL ? { telegramURL } : {}),
			...(webURL ? { webURL } : {}),
		});
		const { botId, environment } = record;
		if (
			Object.keys(record).some(
				(key) =>
					!["botId", "environment", "telegramURL", "webURL", "analytics", "usageMetrics"].includes(key),
			) ||
			typeof botId !== "string" ||
			!/^[1-9][0-9]*$/.test(botId) ||
			!Number.isSafeInteger(Number(botId)) ||
			(environment !== "production" && environment !== "test") ||
			!telegramURL ||
			(record.webURL !== undefined && record.webURL !== "" && !webURL)
		)
			return { kind: "unavailable", links };
		return {
			kind: "configured",
			configuration: Object.freeze({ botId, environment, telegramURL, ...(webURL ? { webURL } : {}) }),
		};
	} catch {
		return { kind: "unavailable", links };
	}
}
function httpsLink(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length > 2048) return undefined;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password
			? url.href
			: undefined;
	} catch {
		return undefined;
	}
}

interface TelegramLicenseAccess {
	readonly readable: () => boolean;
	readonly receipts: ReturnType<typeof licenseReceipts>;
}

type WorkerState = {
	readonly hasControllingWorker: boolean;
	readonly workerManifest: unknown;
};
export type TelegramEntryState =
	| { readonly kind: "checking" }
	| {
			readonly kind: "legal";
			readonly scope: VerifiedTelegramScope;
			readonly error?: "storage" | "text";
			readonly proceed: () => Promise<void>;
			readonly readOnly: () => Promise<void>;
			readonly hostEnvironment?: TelegramHostEnvironment;
	  }
	| {
			readonly kind: "unavailable";
			readonly reason:
				| "configuration"
				| "release"
				| "launch"
				| "timeout"
				| "storage";
	  }
	| {
			readonly kind: "editor";
			readonly authenticatedAt: number;
			readonly runtime: TelegramRuntime;
			readonly mountKey: string;
			readonly hostEnvironment?: TelegramHostEnvironment;
	  }
	| {
			readonly kind: "readonly";
			readonly runtime: TelegramReadonlyRuntime;
			readonly mountKey: string;
			readonly hostEnvironment?: TelegramHostEnvironment;
	  }
	| { readonly kind: "closed" };
export interface TelegramEntrySession {
	readonly links: Links;
	readonly diagnostics?: Pick<
		ReturnType<typeof createTelegramDiagnostics>,
		"snapshot" | "subscribe"
	>;
	observeCatalogPublication?(
		runtime: object,
		result: CatalogPublicationResult,
	): void;
	observeReadonlyProblem?(
		runtime: object,
		problem: TelegramReadonlyProblem,
	): void;
	snapshot(): TelegramEntryState;
	subscribe(listener: () => void): () => void;
	start(): Promise<void>;
	/** The rendered recovery snapshot must still belong to this session. */
	shellReady(snapshot: TelegramEntryState): boolean;
	ready(runtime: AdmittedRuntime): boolean;
	ownsRuntime(runtime: object): boolean;
	exit(): Promise<void>;
	dispose(): Promise<void>;
}
/** No host loading, storage access or runtime construction occurs until start(). */
export function createTelegramEntrySession(dependencies: {
	readonly configuration: unknown;
	readonly legal: TelegramLicenseAccess;
	readonly editorOrigin?: string;
	readonly rawCapsule: string | undefined;
	readonly loadedEntryPath: string | undefined;
	readonly secureContext: boolean;
	readonly webLocks: boolean;
	readonly readCapabilities: () => ReleaseRuntimeCapabilities;
	readonly readWorker: (signal: AbortSignal) => Promise<WorkerState>;
	readonly source: TelegramSdkSource;
	readonly createRuntime: (
		approval: ApprovedTelegramRelease,
		scope: VerifiedTelegramScope,
	) => TelegramRuntime;
	readonly createReadonlyRuntime?: (
		approval: ApprovedReadableTelegramRelease,
		scope: VerifiedTelegramScope,
	) => TelegramReadonlyRuntime;
	readonly connectHost?: (
		capture: TelegramHostCapture,
		onContextChanged: () => void,
	) => TelegramHostEnvironment;
	readonly nowEpochMs: () => number;
	readonly onExit: () => void;
}): TelegramEntrySession {
	const configuration = parseTelegramDeploymentConfiguration(
		dependencies.configuration, dependencies.editorOrigin,
	);
	const capsule = parseTelegramReleaseCapsule(dependencies.rawCapsule);
	const diagnostics = createTelegramDiagnostics({
		manifest:
			capsule && typeof capsule === "object" && "manifest" in capsule
				? capsule.manifest
				: undefined,
		secureContext: dependencies.secureContext,
		webLocks: dependencies.webLocks,
	});
	const listeners = new Set<() => void>(),
		pending = new Set<Promise<void>>();
	let state: TelegramEntryState = Object.freeze({ kind: "checking" });
	let generation = 0n,
		disposed = false;
	let host: TelegramHostBootstrap | undefined,
		revealedHost: TelegramHostBootstrap | undefined,
		runtime: AdmittedRuntime | undefined,
		environment: TelegramHostEnvironment | undefined,
		readyRuntime: AdmittedRuntime | undefined;
	let operation = new AbortController(),
		draining: Promise<void> = Promise.resolve(),
		disposal: Promise<void> | undefined;
	const update = (next: TelegramEntryState) => {
		state = Object.freeze(next);
		for (const listener of [...listeners]) {
			try {
				listener();
			} catch {
				/* An observer cannot admit storage. */
			}
		}
	};
	const isCurrent = (expected: bigint) =>
		!disposed && generation === expected && !operation.signal.aborted;
	const diagnose = (
		expected: bigint,
		phase: TelegramDiagnosticPhase,
		reason: string,
		capabilities?: ReleaseRuntimeCapabilities,
	) => {
		if (!isCurrent(expected)) return false;
		diagnostics.update({ phase, reason, capabilities });
		return isCurrent(expected);
	};
	const revealHost = () => {
		const current = host;
		if (!current) return false;
		if (revealedHost === current) return true;
		if (!current.ready() || host !== current) return false;
		revealedHost = current;
		return true;
	};
	const stopRuntime = () => {
		const priorDrain = draining,
			previous = runtime;
		let finish: () => void = () => undefined,
			fail: (reason: unknown) => void = () => undefined;
		// Publish the drain before abort can synchronously reenter dispose/start.
		const next = new Promise<void>((resolve, reject) => {
			finish = resolve;
			fail = reject;
		});
		draining = next;
		runtime = undefined;
		readyRuntime = undefined;
		try {
			operation.abort();
			operation = new AbortController();
			environment?.dispose();
			environment = undefined;
			host?.dispose();
			host = undefined;
			revealedHost = undefined;
			const previousDrain = previous?.dispose();
			void Promise.all([priorDrain, previousDrain]).then(() => finish(), fail);
		} catch (error) {
			fail(error);
		}
		return next;
	};
	// Retire a failed writable handshake without replacing its verified host.
	const drainAdmittedRuntime = (): Promise<void> => {
		const previous = runtime,
			prior = draining;
		let finish!: () => void, fail!: (reason: unknown) => void;
		const next = new Promise<void>((resolve, reject) => {
			finish = resolve;
			fail = reject;
		});
		draining = next;
		runtime = undefined;
		readyRuntime = undefined;
		let previousDrain: Promise<void>;
		try {
			previousDrain = previous?.dispose() ?? Promise.resolve();
		} catch (error) {
			previousDrain = Promise.reject(error);
		}
		void Promise.allSettled([prior, previousDrain]).then((results) => {
			const failure = results.find((result) => result.status === "rejected");
			if (failure?.status === "rejected") fail(failure.reason);
			else finish();
		});
		return next;
	};
	const start = (): Promise<void> => {
		if (disposed) return Promise.resolve();
		const expected = ++generation;
		let resolveWork: () => void = () => undefined,
			rejectWork: (reason: unknown) => void = () => undefined;
		const work = new Promise<void>((resolve, reject) => {
			resolveWork = resolve;
			rejectWork = reject;
		});
		// start()/each user action completes when the next screen is available.
		// The full admission stays tracked until it ends or the host is retired.
		let presentStep: (() => void) | undefined;
		const nextStep = () => Promise.race([
			work, new Promise<void>((resolve) => { presentStep = resolve; }),
		]);
		const firstStep = nextStep();
		pending.add(work);
		void work.then(
			() => pending.delete(work),
			() => pending.delete(work),
		);
		const drain = stopRuntime();
		if (!disposed && generation === expected) {
			diagnostics.reset();
			if (isCurrent(expected)) update({ kind: "checking" });
		}
		void (async () => {
			try {
				await drain;
				if (!isCurrent(expected)) return;
				if (configuration.kind !== "configured") {
					if (!diagnose(expected, "configuration", "configuration-invalid"))
						return;
					update({ kind: "unavailable", reason: "configuration" });
					return;
				}
				const worker = await dependencies.readWorker(operation.signal);
				if (!isCurrent(expected)) return;
				const capabilities = { ...dependencies.readCapabilities() };
				if (!diagnose(expected, "release", "checking", capabilities)) return;
				const release = approveTelegramRelease({
					capsule,
					loadedEntryPath: dependencies.loadedEntryPath ?? "",
					capabilities,
					secureContext: dependencies.secureContext,
					webLocks: dependencies.webLocks,
					...worker,
				});
				const readable = dependencies.createReadonlyRuntime
					? approveReadableTelegramRelease({
							capsule,
							loadedEntryPath: dependencies.loadedEntryPath ?? "",
							capabilities,
							secureContext: dependencies.secureContext,
							...worker,
						})
					: undefined;
				if (release.kind !== "approved" && readable?.kind !== "approved") {
					if (!diagnose(expected, "release", release.reason, capabilities))
						return;
					update({
						kind: "unavailable",
						reason:
							release.reason === "storage-unavailable" ? "storage" : "release",
					});
					return;
				}
				if (!diagnose(expected, "sdk", "checking", capabilities)) return;
				let captured: TelegramHostCapture | undefined;
				const bootstrap = createTelegramHostBootstrap({
					configuration: configuration.configuration,
					source: {
						read() {
							const raw = dependencies.source.read();
							captured = captureTelegramHostSdk(raw);
							return captured?.bootstrapValue ?? raw;
						},
						start: (loaded, failed) =>
							dependencies.source.start(loaded, failed),
					},
					timeoutMs: 10_000,
					nowEpochMs: dependencies.nowEpochMs,
					onExit: dependencies.onExit,
				});
				host = bootstrap;
				const launch = await bootstrap.start();
				if (!isCurrent(expected)) return;
				if (launch.kind !== "verified") {
					if (
						!diagnose(
							expected,
							launch.reason === "invalid-launch" ? "verification" : "sdk",
							launch.reason === "invalid-launch"
								? launch.launchReason
								: launch.reason,
							capabilities,
						)
					)
						return;
					update({
						kind: "unavailable",
						reason: launch.reason === "timeout" ? "timeout" : "launch",
					});
					return;
				}
				if (dependencies.connectHost) {
					if (!captured) throw new Error("Telegram host capture unavailable");
					const connected = dependencies.connectHost(captured, () => {
						void start();
					});
					if (!isCurrent(expected)) {
						connected.dispose();
						return;
					}
					environment = connected;
				}
				if (!diagnose(expected, "storage", "checking", capabilities)) return;
				const admitReadonly = async (
					approval: ApprovedReadableTelegramRelease,
					measured = capabilities,
				) => {
					const createReadonly = dependencies.createReadonlyRuntime;
					if (!createReadonly)
						throw new Error("Readonly composition is unavailable");
					const created = createReadonly(approval, launch.scope);
					if (!isCurrent(expected)) {
						await created.dispose();
						return;
					}
					runtime = created;
					const admitted = await created.start();
					if (!isCurrent(expected)) return;
					if (!admitted) {
						await stopRuntime();
						if (
							diagnose(
								expected,
								"release",
								"release-incompatible",
								capabilities,
							)
						)
							update({ kind: "unavailable", reason: "release" });
						return;
					}
					if (!diagnose(expected, "readonly", "read-only", measured)) return;
					update({
						kind: "readonly",
						runtime: created,
						mountKey: expected.toString(),
						...(environment ? { hostEnvironment: environment } : {}),
					});
				};
				const tryReadonlyFallback = async (): Promise<boolean> => {
					if (!dependencies.createReadonlyRuntime) return false;
					await drainAdmittedRuntime();
					if (!isCurrent(expected)) return true;
					const currentWorker = await dependencies.readWorker(operation.signal);
					if (!isCurrent(expected)) return true;
					const currentCapabilities = { ...dependencies.readCapabilities() };
					const currentReadable = approveReadableTelegramRelease({
						capsule,
						loadedEntryPath: dependencies.loadedEntryPath ?? "",
						capabilities: currentCapabilities,
						secureContext: dependencies.secureContext,
						...currentWorker,
					});
					if (currentReadable.kind === "approved") {
						await admitReadonly(currentReadable.approval, currentCapabilities);
						return true;
					}
					return false;
				};
				if (release.kind !== "approved") {
					if (
						readable?.kind !== "approved" ||
						!dependencies.createReadonlyRuntime
					)
						throw new Error("Readable release unavailable");
					await admitReadonly(readable.approval);
					return;
				}
				const legal = dependencies.legal;
				let action: "proceed" | "readonly" | "cancel" | undefined;
				while (isCurrent(expected)) {
					if (action === "readonly") {
						if (readable?.kind === "approved") await admitReadonly(readable.approval);
						else update({ kind: "unavailable", reason: "release" });
						return;
					}
					let access: "allowed" | "required" | "storage" | "text";
					if (!legal.readable()) access = "text";
					else if (action === "proceed")
						access = legal.receipts.accept(launch.scope) ? "allowed" : "storage";
					else access = legal.receipts.has(launch.scope) ? "allowed" : "required";
					if (access === "allowed") break;
					action = await new Promise<"proceed" | "readonly" | "cancel">((resolve) => {
						const signal = operation.signal;
						const cancel = () => resolve("cancel");
						const present = presentStep;
						const choose = (value: "proceed" | "readonly") => {
							if (!isCurrent(expected) || state !== offer) return Promise.resolve();
							const sameHost = captured?.matchesCurrent(() => dependencies.source.read());
							if (!isCurrent(expected) || state !== offer) return Promise.resolve();
							if (!sameHost) return start();
							const next = nextStep();
							signal.removeEventListener("abort", cancel);
							update({ kind: "checking" });
							resolve(value);
							return next;
						};
						const offer: TelegramEntryState = {
							kind: "legal", scope: launch.scope,
							error: access === "required" ? undefined : access,
							proceed: () => choose("proceed"),
							readOnly: () => choose("readonly"),
							...(environment ? { hostEnvironment: environment } : {}),
						};
						signal.addEventListener("abort", cancel, { once: true });
						update(offer);
						present?.();
					});
					if (action === "cancel") return;
				}
				if (!isCurrent(expected)) return;
				let created: TelegramRuntime;
				let startup: ReleaseStartupOutcome;
				try {
					created = dependencies.createRuntime(release.approval, launch.scope);
					if (!isCurrent(expected)) {
						await created.dispose();
						return;
					}
					runtime = created;
					startup = await created.releaseStartup.handshake(
						await created.readReleaseStartupInput(),
					);
				} catch (error) {
					if (await tryReadonlyFallback()) return;
					throw error;
				}
				if (!isCurrent(expected)) return;
				if (startup.kind !== "writable") {
					if (
						startup.kind === "read-only/exportable" &&
						dependencies.createReadonlyRuntime
					) {
						if (await tryReadonlyFallback()) return;
					}
					await stopRuntime();
					if (
						!diagnose(expected, "release", "release-incompatible", capabilities)
					)
						return;
					if (!disposed && generation === expected)
						update({ kind: "unavailable", reason: "release" });
					return;
				}
				if (!diagnose(expected, "editor", "ready", capabilities)) return;
				update({
					kind: "editor",
					authenticatedAt: launch.authenticatedAt,
					runtime: created,
					mountKey: expected.toString(),
					...(environment ? { hostEnvironment: environment } : {}),
				});
			} catch {
				if (isCurrent(expected)) {
					await stopRuntime().catch(() => undefined);
					if (!diagnose(expected, "storage", "storage-failed")) return;
					if (!disposed && generation === expected)
						update({ kind: "unavailable", reason: "storage" });
				}
			}
		})().then(resolveWork, rejectWork);
		return firstStep;
	};
	const dispose = (): Promise<void> => {
		if (disposal) return disposal;
		let finish: () => void = () => undefined,
			fail: (reason: unknown) => void = () => undefined;
		disposal = new Promise<void>((resolve, reject) => {
			finish = resolve;
			fail = reject;
		});
		disposed = true;
		generation++;
		listeners.clear();
		state = Object.freeze({ kind: "closed" });
		let drain: Promise<void>;
		try {
			drain = stopRuntime();
		} catch (error) {
			fail(error);
			return disposal;
		}
		operation.abort();
		diagnostics.close();
		void Promise.allSettled([...pending, drain]).then((results) => {
			const failure = results.find((result) => result.status === "rejected");
			if (failure?.status === "rejected") fail(failure.reason);
			else finish();
		});
		return disposal;
	};
	return {
		diagnostics: Object.freeze({
			snapshot: diagnostics.snapshot,
			subscribe: diagnostics.subscribe,
		}),
		observeCatalogPublication(current, result) {
			if (disposed || runtime !== current || state.kind !== "editor") return;
			if (result.kind === "available")
				diagnostics.update({
					phase: "editor",
					reason: "ready",
					catalogVersion: result.publication.catalogVersion,
				});
			else if (result.kind !== "cancelled")
				diagnostics.update({
					phase: "editor",
					reason:
						result.kind === "invalid-envelope"
							? "catalog-envelope-invalid"
							: "catalog-unavailable",
				});
		},
		observeReadonlyProblem(current, problem) {
			if (
				disposed ||
				runtime !== current ||
				state.kind !== "readonly" ||
				state.runtime !== current
			)
				return;
			diagnostics.update({ phase: "readonly", reason: problem });
		},
		links:
			configuration.kind === "configured"
				? configuration.configuration
				: configuration.links,
		snapshot: () => state,
		subscribe(listener) {
			if (disposed) return () => undefined;
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		start,
		shellReady(rendered) {
			if (!disposed && state === rendered && state.kind === "legal") {
				if (revealHost()) return true;
				if (state !== rendered || disposed) return false;
				const expected = ++generation;
				const drain = stopRuntime();
				if (diagnose(expected, "sdk", "sdk-ready-failed"))
					update({ kind: "unavailable", reason: "launch" });
				void drain.catch(() => undefined);
				return false;
			}
			if (disposed || state !== rendered || state.kind !== "unavailable")
				return false;
			return host?.shellReady() ?? false;
		},
		ownsRuntime(current) {
			return (
				!disposed &&
				runtime === current &&
				(state.kind === "editor" || state.kind === "readonly") &&
				state.runtime === current
			);
		},
		ready(current) {
			if (
				disposed ||
				runtime !== current ||
				(state.kind !== "editor" && state.kind !== "readonly") ||
				readyRuntime === current
			)
				return false;
			readyRuntime = current;
			if (revealHost()) return true;
			if (runtime !== current || disposed) return false;
			const expected = ++generation;
			const drain = stopRuntime();
			diagnose(expected, "sdk", "sdk-ready-failed");
			if (!disposed && generation === expected)
				update({ kind: "unavailable", reason: "launch" });
			void drain.catch(() => {
				if (!diagnose(expected, "storage", "storage-failed")) return;
				if (!disposed && generation === expected)
					update({ kind: "unavailable", reason: "storage" });
			});
			return false;
		},
		async exit() {
			await dispose();
			dependencies.onExit();
		},
		dispose,
	};
}

export function TelegramEditorApp({
	session,
	catalogGateway,
	fileTransfer,
	analyticsFor,
}: {
	readonly session: TelegramEntrySession;
	readonly catalogGateway: CatalogGatewayPort;
	readonly fileTransfer?: LocalFileTransferPort;
	readonly analyticsFor?: AnalyticsForRuntime;
}) {
	const state = useSyncExternalStore(
		session.subscribe,
		session.snapshot,
		session.snapshot,
	);
	useEffect(() => {
		void session.start();
		return () => {
			void session.dispose();
		};
	}, [session]);
	useEffect(() => {
		if (state.kind === "unavailable" || state.kind === "legal") session.shellReady(state);
	}, [session, state]);
	if (state.kind === "legal")
		return <TelegramLegalEntry state={state} analytics={analyticsFor?.(state.scope)} onExit={() => void session.exit()} />;
	if (state.kind === "editor")
		return (
			<AdmittedEditor
				key={state.mountKey}
				runtime={state.runtime}
				hostEnvironment={state.hostEnvironment}
				session={session}
				catalogGateway={catalogGateway}
				fileTransfer={fileTransfer}
				analyticsFor={analyticsFor}
			/>
		);
	if (state.kind === "readonly")
		return (
			<AdmittedReadonlyProjects
				key={state.mountKey}
				runtime={state.runtime}
				session={session}
				hostEnvironment={state.hostEnvironment}
				fileTransfer={fileTransfer}
			analytics={analyticsFor?.(state.runtime.scope, state.runtime)}
			/>
		);
	const checking = state.kind === "checking";
	return (
		<main aria-busy={checking} aria-labelledby="telegram-entry-heading">
			<h1 id="telegram-entry-heading">
				{checking ? "Открытие редактора" : "Не удалось открыть редактор"}
			</h1>
			<p role="status">
				{checking
					? "Проверяем запуск и локальное хранилище…"
					: state.kind === "unavailable" && state.reason === "configuration"
						? session.links.webURL
							? "Этот Telegram-редактор пока не настроен. Можно открыть веб-редактор."
							: "Этот Telegram-редактор пока не настроен. Повторите запуск позже."
						: state.kind === "unavailable" && state.reason === "timeout"
							? "Telegram не ответил вовремя. Повторите запуск."
							: "Безопасный запуск не подтверждён. Повторите запуск из Telegram."}
			</p>
			<TelegramLegalDocuments />
			{!checking ? (
				<>
					<button type="button" onClick={() => void session.start()}>
						Повторить запуск
					</button>
					<button type="button" onClick={() => void session.exit()}>
						Выйти
					</button>
				</>
			) : null}
			<TelegramDiagnosticDetails diagnostics={session.diagnostics} />
			{session.links.telegramURL ? (
				<p>
					<a href={session.links.telegramURL}>Открыть в Telegram</a>
				</p>
			) : null}
			{session.links.webURL ? (
				<p>
					<a href={session.links.webURL}>Открыть веб-редактор</a>
				</p>
			) : null}
		</main>
	);
}
function AdmittedReadonlyProjects({
	runtime,
	session,
	hostEnvironment,
	fileTransfer,
	analytics,
}: {
	readonly runtime: TelegramReadonlyRuntime;
	readonly analytics?:UsageMetrics;
	readonly session: TelegramEntrySession;
	readonly hostEnvironment?: TelegramHostEnvironment;
	readonly fileTransfer?: LocalFileTransferPort;
}) {
	useEffect(() => {
		session.ready(runtime);
	}, [runtime, session]);
	return (
		<TelegramSettings host={hostEnvironment} analytics={analytics}>
		{(openSettings, navigation) => <>
		<button type="button" onClick={(event) => openSettings(event.currentTarget)}>Настройки</button>
		<TelegramReadonlyProjects
			runtime={runtime}
			fileTransfer={fileTransfer}
			diagnostics={
				<TelegramDiagnosticDetails diagnostics={session.diagnostics} />
			}
			hostNavigation={navigation}
			onRetry={() => {
				if (session.ownsRuntime(runtime)) void session.start();
			}}
			onExit={() => {
				if (session.ownsRuntime(runtime)) void session.exit();
			}}
			onProblem={(problem) =>
				session.observeReadonlyProblem?.(runtime, problem)
			}
		/>
		</>}
		</TelegramSettings>
	);
}
function AdmittedEditor({
	runtime,
	hostEnvironment,
	session,
	catalogGateway,
	fileTransfer,
	analyticsFor,
}: {
	readonly runtime: TelegramRuntime;
	readonly hostEnvironment?: TelegramHostEnvironment;
	readonly session: TelegramEntrySession;
	readonly catalogGateway: CatalogGatewayPort;
	readonly fileTransfer?: LocalFileTransferPort;
	readonly analyticsFor?: AnalyticsForRuntime;
}) {
	useEffect(() => {
		session.ready(runtime);
	}, [runtime, session]);
	const analytics = useMemo(
		() => analyticsFor?.(runtime.scope, runtime),
		[analyticsFor, runtime],
	);
	useEffect(() => { void analytics?.start(); }, [analytics]);
	const observedGateway = useMemo<CatalogGatewayPort>(
		() => ({
			currentPublication: async (...args) => {
				const result = await catalogGateway.currentPublication(...args);
				session.observeCatalogPublication?.(runtime, result);
				return result;
			},
			resource: (...args) => catalogGateway.resource(...args),
		}),
		[catalogGateway, runtime, session],
	);
	return (
<TelegramSettings host={hostEnvironment} analytics={analytics}>
		{(openSettings, navigation) => <>
		<EditorApp
			localGreyboxCatalog
			exactFloorYaw={runtime.exactFloorYaw}
			doorHingeAuthoring={runtime.doorHingeAuthoring}
			onOpenSettings={openSettings}
			hostNavigation={navigation}
			hostLifecycle={hostEnvironment?.lifecycle}
			runtime={runtime}
			catalogGateway={observedGateway}
			diagnosticDetails={
				<TelegramDiagnosticDetails diagnostics={session.diagnostics} />
			}
			drawingDimensionPreferences={runtime.drawingDimensions}
			sourceRecovery={runtime.sourceRecovery}
			fileTransfer={fileTransfer}
			readReleaseStartupInput={runtime.readReleaseStartupInput}
		/>
		</>}
		</TelegramSettings>
	);
}

/** Queries only the already-controlling worker; no registration, reload or cleanup. */
export function readTelegramWorkerState(
	signal: AbortSignal,
): Promise<WorkerState> {
	const worker = navigator.serviceWorker?.controller;
	if (!worker || signal.aborted || typeof MessageChannel === "undefined")
		return Promise.resolve({
			hasControllingWorker: !!worker,
			workerManifest: undefined,
		});
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		let settled = false;
		const finish = (workerManifest: unknown) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			signal.removeEventListener("abort", cancel);
			channel.port1.onmessage = null;
			channel.port1.close();
			channel.port2.close();
			resolve({
				hasControllingWorker: !!navigator.serviceWorker?.controller,
				workerManifest:
					navigator.serviceWorker?.controller === worker
						? workerManifest
						: undefined,
			});
		};
		const cancel = () => finish(undefined),
			timeout = setTimeout(cancel, 1_000);
		channel.port1.onmessage = (event: MessageEvent<unknown>) => {
			const data = event.data;
			finish(
				data &&
					typeof data === "object" &&
					"kind" in data &&
					data.kind === "release-manifest" &&
					"manifest" in data
					? data.manifest
					: undefined,
			);
		};
		signal.addEventListener("abort", cancel, { once: true });
		try {
			worker.postMessage({ type: "INTERIORS_RELEASE_MANIFEST" }, [
				channel.port2,
			]);
		} catch {
			finish(undefined);
		}
	});
}
export function readTelegramCapabilities(): ReleaseRuntimeCapabilities {
	let webgl2 = false;
	try {
		const context = document.createElement("canvas").getContext("webgl2");
		webgl2 = context !== null;
		context?.getExtension("WEBGL_lose_context")?.loseContext();
	} catch {
		/* Safe2D capability remains explicit. */
	}
	let available = false;
	try {
		available = typeof indexedDB?.open === "function";
	} catch {
		/* Storage may be denied by the host. */
	}
	return { indexeddb: available, webgl2 };
}
function readWebApp(): unknown {
	const telegram: unknown = Reflect.get(window, "Telegram");
	return telegram && typeof telegram === "object"
		? Reflect.get(telegram, "WebApp")
		: undefined;
}
function requestExit() {
	try {
		const sdk = readWebApp();
		if (
			sdk &&
			typeof sdk === "object" &&
			"close" in sdk &&
			typeof sdk.close === "function"
		) {
			sdk.close.call(sdk);
			return;
		}
	} catch {
		/* A public Web link remains available. */
	}
	window.close();
}

/** Explicit Telegram entry only: imports never construct a browser singleton. */
export function mountTelegramBrowserEditor(
	element: HTMLElement,
	readLaunchTime: () => number = () => Date.now(),
): () => Promise<void> {
	const loaded = document.querySelector<HTMLScriptElement>(
		"script[data-telegram-entry]",
	);
	const rawCapsule =
		document.getElementById("telegram-loaded-release")?.textContent ??
		undefined;
	const configuration = parseTelegramReleaseCapsule(
		document.getElementById("telegram-deployment")?.textContent ?? undefined,
	);
	const source = createTelegramSdkScriptSource({ document, readWebApp });
	const session = createTelegramEntrySession({
		legal: {
			readable: currentLicenseReadable,
			receipts: licenseReceipts(() => window.localStorage),
		},
		configuration,
		editorOrigin: window.location.origin,
		rawCapsule,
		loadedEntryPath: loaded?.src ? new URL(loaded.src).pathname : undefined,
		secureContext: isSecureContext,
		webLocks: typeof navigator.locks?.request === "function",
		readCapabilities: readTelegramCapabilities,
		readWorker: readTelegramWorkerState,
		source,
		connectHost: (capture, onContextChanged) =>
			capture.connect({
				...createTelegramBrowserSignals({ window, document }),
				readCurrentSdk: readWebApp,
				onContextChanged,
			}),
		nowEpochMs: readLaunchTime,
		onExit: requestExit,
		createReadonlyRuntime(approval, scope) {
			const portable = createRegisteredRuntimePortablePorts({
				binaryChecksum: browserBinaryChecksum,
			});
			const source = createTelegramReadonlyProjectSource({
				coordination:
					typeof navigator.locks?.request === "function"
						? "scoped-lock"
						: "native-readonly-snapshot",
				scope,
				release: approval,
				technical: {
					indexedDb: indexedDB,
					locks: navigator.locks,
					secureContext: isSecureContext,
					acceptExactFloorYawStorage: true,
					acceptDoorHingeStorage: true,
				},
				checksum: browserChecksum,
				binaryChecksum: browserBinaryChecksum,
				portable: { writer: portable.writer, smoke: portable.smoke },
			});
			return createTelegramReadonlyRuntime({
				approval,
				scope,
				source,
				context: {
					secureContext: isSecureContext,
					readCapabilities: readTelegramCapabilities,
					readWorker: readTelegramWorkerState,
				},
			});
		},
		createRuntime(approval, scope) {
			const portable = createRegisteredRuntimePortablePorts({
				binaryChecksum: browserBinaryChecksum,
			});
			return createTelegramRuntime({
				approval,
				scope,
				context: {
					databaseMode: typeof __INTERIORS_EXACT_FLOOR_YAW__ !== "undefined" && __INTERIORS_EXACT_FLOOR_YAW__
						? "exact"
						: "compatible",
					doorHingeMode: typeof __INTERIORS_DOOR_HINGE_AUTHORING__ !== "undefined" && __INTERIORS_DOOR_HINGE_AUTHORING__
						? "authoring"
						: "compatible",
					indexedDb: indexedDB,
					locks: navigator.locks,
					secureContext: isSecureContext,
					crypto,
					sessionStorage,
					localStorage,
					readCapabilities: readTelegramCapabilities,
					readWorker: readTelegramWorkerState,
				},
				ports: {
					checksum: browserChecksum,
					binaryChecksum: browserBinaryChecksum,
					ids: browserIds,
					clock: browserClock,
					storageEstimate: browserStorageEstimate,
					portable: { ...portable, encoder: new FflatePortableBackupEncoder() },
				},
			});
		},
	});
	const catalogGateway = new HttpCatalogGateway({
		checksum: browserBinaryChecksum,
	});
	const fileTransfer: LocalFileTransferPort = {
		...createTelegramHostFileBridge({ maximumBytes: 280 * 1024 * 1024 }),
		encryptedDownload: createTelegramProjectDownload({
			origin: window.location.origin,
			fetch: window.fetch.bind(window),
			readSdk: readWebApp,
		}),
	};
	const models = new WeakMap<object, UsageMetrics>();
	const stores = new Map<
		VerifiedTelegramScope,
		ReturnType<typeof deviceStatisticsStore>
	>();
	const analyticsFor: AnalyticsForRuntime = (scope, runtime) => {
		const entry = session.snapshot();
		if (
			entry.kind === "legal"
				? entry.scope !== scope || runtime !== undefined
				: (entry.kind !== "editor" && entry.kind !== "readonly") ||
					entry.runtime !== runtime
		)
			return;
		const previous = models.get(entry);
		if (previous) return previous;
		const store =
			stores.get(scope) ??
			deviceStatisticsStore(
				scope,
				() => window.localStorage,
				() => window.sessionStorage,
			);
		stores.set(scope, store);
		const life = new AbortController();
		const stop = session.subscribe(() => {
			if (session.snapshot() !== entry) {
				life.abort();
				stop();
			}
		});
		const study =
			typeof __INTERIORS_RETURN_STUDY__ === "undefined"
				? undefined
				: __INTERIORS_RETURN_STUDY__;
		const model = createUsageMetrics({
			store,
			launch: entry.kind === "editor" ? entry.authenticatedAt : undefined,
			signal: life.signal,
			clock: Date.now,
			studyActive: () => study?.active === true,
			formDigest: study?.digest ?? "",
			async readable() {
				const form = bundledLegalDocument("analytics-consent");
				if (!form || !study) return false;
				const bytes = await window.crypto.subtle.digest(
					"SHA-256",
					new TextEncoder().encode(form),
				);
				return (
					Array.from(new Uint8Array(bytes), (n) =>
						n.toString(16).padStart(2, "0"),
					).join("") === study.digest
				);
			},
			async lock(work) {
				await window.navigator.locks.request(
					store.key,
					{ signal: life.signal },
					work,
				);
			},
			send(path) {
				if (
					life.signal.aborted ||
					entry.kind !== "editor" ||
					session.snapshot() !== entry
				)
					return;
				void window
					.fetch(path, {
						method: "POST",
						credentials: "omit",
						mode: "same-origin",
						cache: "no-store",
						redirect: "error",
						referrerPolicy: "no-referrer",
						headers: { "X-Interiors-Stats": "1" },
						signal: life.signal,
					})
					.catch(() => {});
			},
		});
		models.set(entry, model);
		return model;
	};
	const root = createRoot(element);
	root.render(
		<TelegramEditorApp
			session={session}
			catalogGateway={catalogGateway}
			fileTransfer={fileTransfer}
			analyticsFor={analyticsFor}
		/>,
	);
	return () => {
		const drained = session.dispose();
		root.unmount();
		return drained;
	};
}
