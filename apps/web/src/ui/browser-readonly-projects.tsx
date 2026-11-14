import {
	type ReactNode,
	useEffect,
	useState,
	useSyncExternalStore,
} from "react";
import type {
	BrowserReadonlyProjectAddress,
	BrowserReadonlyProjectsDirectory,
	BrowserReadonlyProjectsPort,
} from "../app/browser-readonly-projects-port";
import type {
	ProjectSourceRecoveryPort,
	ProjectStorageNamespace,
	UnverifiedProjectSource,
} from "../application/ports";
import styles from "./browser-readonly-projects.module.css";
import {
	canShowProjectDirectoryEmpty,
	ProjectStorageStatus,
	projectDirectoryCards,
	projectStorageLabel,
} from "./project-storage-presentation";
import {
	prepareUnverifiedSourceFile,
	StoredSourceRecovery,
} from "./stored-source-recovery";

type Format = "legacy" | "registered";
export interface BrowserReadonlyProjectsSnapshot {
	readonly status: "loading" | "ready" | "unavailable" | "closed";
	readonly directory?: BrowserReadonlyProjectsDirectory;
	readonly preparation: "idle" | "preparing" | "ready" | "failed";
	readonly filename?: string;
	readonly fileNamespace?: ProjectStorageNamespace;
	readonly fileKind?: "portable-backup" | "unverified-source";
}
interface Prepared {
	readonly address: BrowserReadonlyProjectAddress;
	readonly source: AbortSignal;
	readonly bytes: Uint8Array;
	readonly filename: string;
	readonly fileKind: "portable-backup" | "unverified-source";
	readonly mimeType: string;
}
const namespaces = ["legacy", "browser-registered"] as const;
const sameAddress = (
	a: BrowserReadonlyProjectAddress,
	b: BrowserReadonlyProjectAddress,
) =>
	a.storageNamespace === b.storageNamespace &&
	a.projectId === b.projectId &&
	a.revisionId === b.revisionId;

/** UI lifetime only. The real provider owns storage admission, readonly transactions and drain. */
export class BrowserReadonlyProjectsSession {
	private state: BrowserReadonlyProjectsSnapshot = Object.freeze({
		status: "loading",
		preparation: "idle",
	});
	private readonly listeners = new Set<() => void>();
	private readonly sources = new Map<
		ProjectStorageNamespace,
		{ signal: AbortSignal; stop: () => void }
	>();
	private readonly list: BrowserReadonlyProjectsPort["readDirectory"];
	private readonly export: BrowserReadonlyProjectsPort["exportBackup"];
	private started = false;
	private closed = false;
	private starting: Promise<void> | undefined;
	private query = 0n;
	private intent = 0n;
	private preparing:
		| { address: BrowserReadonlyProjectAddress; controller: AbortController }
		| undefined;
	private prepared: Prepared | undefined;
	private rawTicket:
		| {
				namespace: ProjectStorageNamespace;
				source: AbortSignal;
				intent: bigint;
				record: UnverifiedProjectSource;
		  }
		| undefined;
	private readonly rawPorts = new Map<
		ProjectStorageNamespace,
		{ signal: AbortSignal; port: ProjectSourceRecoveryPort }
	>();
	private readonly onAbort = () => this.close(true);
	constructor(private readonly port: BrowserReadonlyProjectsPort) {
		this.list = port.readDirectory.bind(port);
		this.export = port.exportBackup.bind(port);
	}
	private live() {
		return this.started && !this.closed && !this.port.signal.aborted;
	}
	private update(value: BrowserReadonlyProjectsSnapshot) {
		this.state = Object.freeze(value);
		for (const listener of [...this.listeners]) {
			if (!this.listeners.has(listener)) continue;
			try {
				listener();
			} catch {
				/* Observers cannot grant a read or delivery capability. */
			}
		}
	}
	snapshot() {
		return this.state;
	}
	subscribe(listener: () => void) {
		if (this.closed) return () => undefined;
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	start(): Promise<void> {
		if (this.starting) return this.starting;
		if (this.closed) return Promise.resolve();
		this.started = true;
		this.starting = Promise.resolve().then(() => this.refresh());
		this.port.signal.addEventListener("abort", this.onAbort, { once: true });
		if (this.port.signal.aborted) this.onAbort();
		return this.starting;
	}
	private sourceSignal(
		namespace: ProjectStorageNamespace,
	): AbortSignal | undefined {
		try {
			return this.port.getSourceSignal(namespace);
		} catch {
			return undefined;
		}
	}
	private syncSources() {
		for (const namespace of namespaces) {
			let signal: AbortSignal | undefined;
			try {
				signal = this.port.getSourceSignal(namespace);
			} catch {
				/* An unavailable source is never empty proof. */
			}
			const prior = this.sources.get(namespace);
			if (prior?.signal === signal) continue;
			prior?.stop();
			this.sources.delete(namespace);
			if (signal) {
				const current = signal;
				const abort = () => this.sourceAborted(namespace, current);
				signal.addEventListener("abort", abort, { once: true });
				this.sources.set(namespace, {
					signal,
					stop: () => current.removeEventListener("abort", abort),
				});
				if (signal.aborted) abort();
			}
		}
	}
	private sourceAborted(
		namespace: ProjectStorageNamespace,
		signal: AbortSignal,
	) {
		if (!this.live() || this.sources.get(namespace)?.signal !== signal) return;
		if (this.rawTicket?.namespace === namespace) this.rawTicket = undefined;
		let preparation = this.state.preparation,
			filename = this.state.filename;
		const previous =
			this.preparing?.address.storageNamespace === namespace
				? this.preparing
				: undefined;
		if (this.preparing?.address.storageNamespace === namespace) {
			this.preparing = undefined;
			this.intent++;
			preparation = "idle";
			filename = undefined;
		}
		if (this.prepared?.address.storageNamespace === namespace) {
			this.prepared = undefined;
			preparation = "idle";
			filename = undefined;
		}
		const directory = this.state.directory;
		this.update({
			...this.state,
			preparation,
			filename,
			...(directory
				? {
						directory: {
							...directory,
							projects: directory.projects.filter(
								(row) => row.storageNamespace !== namespace,
							),
							storageSources: directory.storageSources.map((source) =>
								source.storageNamespace === namespace
									? {
											storageNamespace: namespace,
											kind:
												source.kind === "recovery-required"
													? ("recovery-required" as const)
													: ("unavailable" as const),
										}
									: source,
							),
						},
					}
				: {}),
		});
		// Reentrant callbacks see the revoked source and cannot cancel a new neighbour operation.
		previous?.controller.abort();
	}
	async refresh(): Promise<void> {
		if (!this.live()) return;
		const ticket = ++this.query;
		this.syncSources();
		if (!this.live()) return;
		this.update({ ...this.state, status: "loading" });
		if (!this.live() || ticket !== this.query) return;
		try {
			const directory = await this.list();
			if (!this.live() || ticket !== this.query) return;
			this.syncSources();
			if (!this.live() || ticket !== this.query) return;
			const revoked = (namespace: ProjectStorageNamespace) =>
				this.sources.get(namespace)?.signal.aborted === true;
			const owned: BrowserReadonlyProjectsDirectory = Object.freeze({
				kind: "projects",
				projects: Object.freeze(
					directory.projects
						.filter((row) => !revoked(row.storageNamespace))
						.map((row) =>
							Object.freeze({
								storageNamespace: row.storageNamespace,
								projectId: row.projectId,
								revisionId: row.revisionId,
								name: row.name,
								updatedAt: row.updatedAt,
							}),
						),
				),
				storageSources: Object.freeze(
					directory.storageSources.map((source) =>
						Object.freeze(
							revoked(source.storageNamespace)
								? {
										storageNamespace: source.storageNamespace,
										kind:
											source.kind === "recovery-required"
												? ("recovery-required" as const)
												: ("unavailable" as const),
									}
								: { ...source },
						),
					),
				),
				...(directory.recoveryNeeded ? { recoveryNeeded: true as const } : {}),
			});
			this.update({ ...this.state, status: "ready", directory: owned });
		} catch {
			if (this.live() && ticket === this.query)
				this.update({
					...this.state,
					status: "unavailable",
					directory: undefined,
				});
		}
	}
	async prepare(
		address: BrowserReadonlyProjectAddress,
		format: Format,
	): Promise<boolean> {
		if (
			!this.live() ||
			this.state.status !== "ready" ||
			!this.state.directory?.projects.some((row) =>
				sameAddress(row, address),
			) ||
			!this.state.directory.storageSources.some(
				(source) =>
					source.storageNamespace === address.storageNamespace &&
					source.kind === "available",
			)
		)
			return false;
		const source = this.sourceSignal(address.storageNamespace);
		if (!source || source.aborted) return false;
		const owned = Object.freeze({
			storageNamespace: address.storageNamespace,
			projectId: address.projectId,
			revisionId: address.revisionId,
		});
		const previous = this.preparing;
		const controller = new AbortController(),
			intent = ++this.intent;
		this.prepared = undefined;
		this.rawTicket = undefined;
		this.preparing = { address: owned, controller };
		const current = () =>
			this.live() &&
			this.intent === intent &&
			!controller.signal.aborted &&
			!source.aborted &&
			this.sourceSignal(owned.storageNamespace) === source;
		previous?.controller.abort();
		if (!current()) return false;
		this.update({
			...this.state,
			preparation: "preparing",
			filename: undefined,
		});
		if (!current()) return false;
		try {
			const result = await this.export(owned, format, controller.signal);
			if (!current()) return false;
			this.preparing = undefined;
			if (result.kind === "ready") {
				this.prepared = {
					address: owned,
					source,
					bytes: result.bytes.slice(),
					filename: result.filename,
					mimeType: result.mimeType,
					fileKind: "portable-backup",
				};
				this.update({
					...this.state,
					preparation: "ready",
					filename: result.filename,
					fileNamespace: owned.storageNamespace,
					fileKind: "portable-backup",
				});
				return current();
			}
		} catch {
			/* Private source/verifier errors never enter presentation. */
		}
		if (current()) {
			this.preparing = undefined;
			this.update({
				...this.state,
				preparation: "failed",
				filename: undefined,
			});
		}
		return false;
	}
	sourceRecoveryFor(
		namespace: ProjectStorageNamespace,
	): ProjectSourceRecoveryPort | undefined {
		if (!this.live()) return undefined;
		const signal = this.sourceSignal(namespace);
		if (!signal || signal.aborted) return undefined;
		const prior = this.rawPorts.get(namespace);
		if (prior?.signal === signal) return prior.port;
		let raw: ProjectSourceRecoveryPort | undefined;
		try {
			raw = this.port.getSourceRecovery(namespace);
		} catch {
			return undefined;
		}
		if (!raw) return undefined;
		const current = () =>
			this.live() && !signal.aborted && this.sourceSignal(namespace) === signal;
		const port: ProjectSourceRecoveryPort = {
			listRecoverySources: async () => {
				if (!current()) return [];
				const result = await raw.listRecoverySources();
				return current()
					? result.map((row) =>
							Object.freeze({
								kind: "unverified-source" as const,
								projectId: row.projectId,
								revisionId: row.revisionId,
							}),
						)
					: [];
			},
			readRecoverySource: async (projectId, revisionId) => {
				if (!current()) return undefined;
				const previous = this.preparing,
					intent = ++this.intent;
				this.preparing = undefined;
				this.prepared = undefined;
				this.rawTicket = undefined;
				previous?.controller.abort();
				if (!current() || this.intent !== intent) return undefined;
				this.update({
					...this.state,
					preparation: "idle",
					filename: undefined,
					fileKind: undefined,
				});
				if (!current() || this.intent !== intent) return undefined;
				const value = await raw.readRecoverySource(projectId, revisionId);
				if (
					!current() ||
					this.intent !== intent ||
					!value ||
					value.kind !== "unverified-source" ||
					value.projectId !== projectId ||
					value.revisionId !== revisionId
				)
					return undefined;
				const record = Object.freeze({
					kind: "unverified-source" as const,
					projectId: value.projectId,
					revisionId: value.revisionId,
					serializedProject: value.serializedProject,
				});
				this.rawTicket = { namespace, source: signal, intent, record };
				return record;
			},
		};
		this.rawPorts.set(namespace, { signal, port });
		return port;
	}
	async prepareSource(
		namespace: ProjectStorageNamespace,
		record: UnverifiedProjectSource,
	): Promise<void> {
		const ticket = this.rawTicket;
		const current = () =>
			!!ticket &&
			this.rawTicket === ticket &&
			this.live() &&
			ticket.namespace === namespace &&
			ticket.intent === this.intent &&
			!ticket.source.aborted &&
			this.sourceSignal(namespace) === ticket.source;
		if (
			!current() ||
			!ticket ||
			record.kind !== "unverified-source" ||
			record.projectId !== ticket.record.projectId ||
			record.revisionId !== ticket.record.revisionId ||
			record.serializedProject !== ticket.record.serializedProject
		)
			throw new Error("Source unavailable");
		let raw: ProjectSourceRecoveryPort | undefined;
		try {
			raw = this.port.getSourceRecovery(namespace);
		} catch {
			/* Refuse unavailable source. */
		}
		if (!raw) throw new Error("Source unavailable");
		const fresh = await raw.readRecoverySource(
			record.projectId,
			record.revisionId,
		);
		if (
			!current() ||
			!fresh ||
			fresh.kind !== "unverified-source" ||
			fresh.projectId !== record.projectId ||
			fresh.revisionId !== record.revisionId ||
			fresh.serializedProject !== record.serializedProject
		)
			throw new Error("Source unavailable");
		const result = prepareUnverifiedSourceFile(ticket.record);
		if (!current() || result.kind !== "prepared-source")
			throw new Error("Source unavailable");
		this.rawTicket = undefined;
		this.prepared = {
			address: {
				storageNamespace: namespace,
				projectId: record.projectId,
				revisionId: record.revisionId,
			},
			source: ticket.source,
			bytes: result.bytes.slice(),
			filename: result.filename,
			mimeType: result.mimeType,
			fileKind: "unverified-source",
		};
		this.update({
			...this.state,
			preparation: "ready",
			filename: result.filename,
			fileNamespace: namespace,
			fileKind: "unverified-source",
		});
	}
	takeFile():
		| {
				readonly bytes: Uint8Array;
				readonly filename: string;
				readonly mimeType: string;
				readonly fileKind: "portable-backup" | "unverified-source";
				readonly storageNamespace: ProjectStorageNamespace;
		  }
		| undefined {
		const file = this.prepared;
		if (
			!file ||
			!this.live() ||
			file.source.aborted ||
			this.sourceSignal(file.address.storageNamespace) !== file.source
		)
			return undefined;
		return {
			bytes: file.bytes.slice(),
			filename: file.filename,
			mimeType: file.mimeType,
			fileKind: file.fileKind,
			storageNamespace: file.address.storageNamespace,
		};
	}
	private close(notify: boolean) {
		if (this.closed) return;
		this.closed = true;
		this.query++;
		this.intent++;
		this.preparing?.controller.abort();
		this.preparing = undefined;
		this.prepared = undefined;
		this.rawTicket = undefined;
		this.rawPorts.clear();
		this.port.signal.removeEventListener("abort", this.onAbort);
		for (const value of this.sources.values()) value.stop();
		this.sources.clear();
		const next: BrowserReadonlyProjectsSnapshot = {
			status: "closed",
			preparation: "idle",
		};
		if (notify) this.update(next);
		else this.state = Object.freeze(next);
	}
	dispose() {
		this.close(false);
		this.listeners.clear();
	}
}

export function BrowserReadonlyProjectsContent({
	state,
	onRefresh,
	onPrepare,
	onDownload,
	sourceRecovery,
	diagnostics,
	deliveryProblem,
	sourceNamespaces = namespaces,
	supplemental = false,
	rawOnly = false,
}: {
	readonly state: BrowserReadonlyProjectsSnapshot;
	readonly onRefresh: () => void;
	readonly onPrepare: (
		address: BrowserReadonlyProjectAddress,
		format: Format,
	) => void;
	readonly onDownload: () => void;
	readonly sourceRecovery?: ReactNode;
	readonly diagnostics?: ReactNode;
	readonly deliveryProblem?: boolean;
	readonly sourceNamespaces?: readonly ProjectStorageNamespace[];
	readonly supplemental?: boolean;
	readonly rawOnly?: boolean;
}) {
	const directory = state.directory
		? {
				...state.directory,
				projects: state.directory.projects.filter((row) =>
					sourceNamespaces.includes(row.storageNamespace),
				),
				storageSources: state.directory.storageSources.filter((row) =>
					sourceNamespaces.includes(row.storageNamespace),
				),
			}
		: undefined;
	const Surface = supplemental || rawOnly ? "section" : "main",
		Heading = supplemental || rawOnly ? "h2" : "h1";
	const headingId = rawOnly
		? "browser-raw-sources-heading"
		: "browser-readonly-heading";
	const showFile =
		state.preparation === "ready" &&
		(!rawOnly || state.fileKind === "unverified-source") &&
		(!state.fileNamespace || sourceNamespaces.includes(state.fileNamespace));
	return (
		<Surface
			className={`${styles.shell}${supplemental ? ` ${styles.supplemental}` : ""}`}
			aria-labelledby={headingId}
			aria-busy={state.status === "loading"}
		>
			<div className={styles.content}>
				<header>
					<p className={styles.eyebrow}>Локальные данные</p>
					<Heading id={headingId}>
						{rawOnly
							? "Исходные записи для восстановления"
							: supplemental
								? "Проекты только для выгрузки"
								: "Просмотр проектов"}
					</Heading>
					<p>
						{rawOnly
							? "Непроверенные записи можно выгрузить отдельно. Доступные проекты остаются в обычном списке; исходник не является полным архивом."
							: supplemental
								? "Эти записи доступны только для выгрузки. Проекты из других доступных хранилищ можно продолжать редактировать."
								: "Редактирование пока недоступно. Проверенные проекты можно выгрузить полным архивом или подготовить для переноса. Непроверенные исходные записи доступны отдельно."}
					</p>
				</header>
				<button type="button" onClick={onRefresh}>
					Обновить список
				</button>
				{state.status === "loading" ? (
					<p role="status">Проверяем локальные записи…</p>
				) : state.status === "unavailable" ? (
					<p role="status">
						Не удалось проверить список проектов. Повторите попытку. Данные не
						изменены.
					</p>
				) : state.status === "closed" ? (
					<p role="status">Просмотр завершён. Повторите запуск приложения.</p>
				) : null}
				{directory ? (
					<ProjectStorageStatus
						sources={directory.storageSources}
						onRetry={onRefresh}
					/>
				) : null}
				{directory?.recoveryNeeded ? (
					<p role="status">
						Часть записей не прошла проверку. Их исходные данные можно
						подготовить отдельно.
					</p>
				) : null}
				{!rawOnly &&
				directory &&
				directory.projects.length === 0 &&
				canShowProjectDirectoryEmpty(directory.storageSources) ? (
					<p role="status">В обоих хранилищах пока нет проверенных проектов.</p>
				) : null}
				{!rawOnly && directory && directory.projects.length > 0 ? (
					<section aria-label="Проверенные записи">
						<ul className={styles.projects}>
							{projectDirectoryCards(directory.projects, true).map((card) => (
								<li key={card.key} className={styles.card}>
									<p className={styles.eyebrow}>
										{card.storageLabel}
										{card.copyLabel ? ` · ${card.copyLabel}` : ""}
									</p>
									<h2>
										<bdi>{card.summary.name}</bdi>
									</h2>
									<div className={styles.actions}>
										<button
											type="button"
											aria-label={`Подготовить полный архив: ${card.spokenName}`}
											disabled={state.preparation === "preparing"}
											onClick={() =>
												onPrepare(
													card.summary as BrowserReadonlyProjectAddress,
													"legacy",
												)
											}
										>
											Подготовить полный архив
										</button>
										<button
											type="button"
											aria-label={`Подготовить файл для переноса: ${card.spokenName}`}
											disabled={state.preparation === "preparing"}
											onClick={() =>
												onPrepare(
													card.summary as BrowserReadonlyProjectAddress,
													"registered",
												)
											}
										>
											Подготовить файл для переноса
										</button>
									</div>
								</li>
							))}
						</ul>
					</section>
				) : null}
				{state.preparation === "preparing" ? (
					<p role="status">Готовим проверенный архив…</p>
				) : state.preparation === "failed" ? (
					<p role="status">
						Не удалось подготовить полный архив. Обновите список и повторите
						попытку.
					</p>
				) : showFile ? (
					<section className={styles.file} aria-label="Подготовленный файл">
						<h2>
							{state.fileKind === "unverified-source"
								? "Непроверенный исходник"
								: "Полный архив подготовлен"}
						</h2>
						{state.fileKind === "unverified-source" ? (
							<p>
								Этот файл сохраняет исходную запись. Полнота проекта и
								возможность импорта не подтверждены.
							</p>
						) : (
							<p>Сохраните файл и отдельно проверьте его вне приложения.</p>
						)}
						{state.fileNamespace ? (
							<p className={styles.eyebrow}>
								{projectStorageLabel(state.fileNamespace)}
							</p>
						) : null}
						<p>
							<bdi>{state.filename}</bdi>
						</p>
						<button type="button" onClick={onDownload}>
							Скачать файл
						</button>
					</section>
				) : null}
				{deliveryProblem ? (
					<p role="status">
						Не удалось передать файл браузеру. Повторите подготовку и
						скачивание.
					</p>
				) : null}
				{sourceRecovery}
				{diagnostics}
			</div>
		</Surface>
	);
}

function BrowserReadonlyProjectsPanel({
	model,
	diagnostics,
	sourceNamespaces = namespaces,
	supplemental = false,
	rawOnly = false,
}: {
	readonly model: BrowserReadonlyProjectsSession;
	readonly sourceNamespaces?: readonly ProjectStorageNamespace[];
	readonly supplemental?: boolean;
	readonly rawOnly?: boolean;
	readonly diagnostics?: ReactNode;
}) {
	const state = useSyncExternalStore(
		(listener) => model.subscribe(listener),
		() => model.snapshot(),
		() => model.snapshot(),
	);
	const [deliveryProblem, setDeliveryProblem] = useState(false);
	function download() {
		setDeliveryProblem(false);
		const file = model.takeFile();
		if (
			!file ||
			(rawOnly && file.fileKind !== "unverified-source") ||
			!sourceNamespaces.includes(file.storageNamespace)
		) {
			setDeliveryProblem(true);
			return;
		}
		let url: string | undefined;
		try {
			const blob = new Blob([file.bytes.slice().buffer], {
				type: file.mimeType,
			});
			url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.download = file.filename;
			link.href = url;
			link.click();
		} catch {
			setDeliveryProblem(true);
		} finally {
			if (url) {
				const owned = url;
				setTimeout(() => URL.revokeObjectURL(owned), 1000);
			}
		}
	}
	return (
		<BrowserReadonlyProjectsContent
			state={state}
			sourceNamespaces={sourceNamespaces}
			supplemental={supplemental}
			rawOnly={rawOnly}
			diagnostics={diagnostics}
			deliveryProblem={deliveryProblem}
			onRefresh={() => {
				void model.refresh();
			}}
			onPrepare={(address, format) => {
				setDeliveryProblem(false);
				if (sourceNamespaces.includes(address.storageNamespace))
					void model.prepare(address, format);
			}}
			onDownload={download}
			sourceRecovery={sourceNamespaces.map((namespace) => {
				const port = model.sourceRecoveryFor(namespace);
				return port ? (
					<section
						key={namespace}
						aria-label={`Непроверенные исходники: ${projectStorageLabel(namespace)}`}
					>
						<p>{projectStorageLabel(namespace)}</p>
						<StoredSourceRecovery
							port={port}
							onExport={(source) => model.prepareSource(namespace, source)}
						/>
					</section>
				) : null;
			})}
		/>
	);
}

/** The source provider, rather than this view, owns admission and the database lifetime. */
export function BrowserReadonlyProjects({
	port,
	sourceRevision,
	diagnostics,
	sourceNamespaces,
	supplemental = false,
	rawOnly = false,
}: {
	readonly port: BrowserReadonlyProjectsPort;
	readonly sourceRevision: number;
	readonly sourceNamespaces?: readonly ProjectStorageNamespace[];
	readonly supplemental?: boolean;
	readonly rawOnly?: boolean;
	readonly diagnostics?: ReactNode;
}) {
	const [owned, setOwned] = useState<{
		port: BrowserReadonlyProjectsPort;
		model: BrowserReadonlyProjectsSession;
	}>();
	useEffect(() => {
		const model = new BrowserReadonlyProjectsSession(port);
		setOwned({ port, model });
		void model.start();
		return () => model.dispose();
	}, [port]);
	useEffect(() => {
		// Admission notifications invalidate this same mounted view.
		void sourceRevision;
		if (owned?.port === port) void owned.model.refresh();
	}, [owned, port, sourceRevision]);
	return owned?.port === port ? (
		<BrowserReadonlyProjectsPanel
			model={owned.model}
			sourceNamespaces={sourceNamespaces}
			supplemental={supplemental}
			rawOnly={rawOnly}
			diagnostics={diagnostics}
		/>
	) : supplemental || rawOnly ? (
		<section aria-busy="true" aria-label="Проверка локальных проектов" />
	) : (
		<main aria-busy="true" aria-label="Проверка локальных проектов" />
	);
}
