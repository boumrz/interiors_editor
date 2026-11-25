import { copy } from "./editor-language";
import {
	type ReactNode,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { ExportPortableBackupResult } from "../application/export-portable-backup";
import type {
	CancellationSignalPort,
	ProjectDirectoryResult,
	ProjectSourceRecoveryPort,
	ProjectSummary,
	UnverifiedProjectSource,
} from "../application/ports";
import type { HostNavigationPort } from "./editor-host-boundary";
import {
	LocalFileTransferPanel,
	type LocalFileTransferPort,
	LocalFileTransferSession,
	type LocalFileTransferState,
} from "./local-file-transfer";
import {
	prepareUnverifiedSourceFile,
	StoredSourceRecovery,
} from "./stored-source-recovery";
import styles from "./telegram-readonly-projects.module.css";

export interface TelegramReadonlyRuntimePort {
	readonly signal: AbortSignal;
	readonly sourceRecovery: ProjectSourceRecoveryPort;
	listProjects(): Promise<ProjectDirectoryResult>;
	exportProjectTransfer(
		projectId: string,
		expectedRevisionId: string,
		options?: { readonly signal?: CancellationSignalPort },
	): Promise<ExportPortableBackupResult>;
}
export type TelegramReadonlyProblem =
	| "source-unavailable"
	| "backup-unavailable"
	| "file-unavailable";
export type TelegramReadonlyDirectoryState =
	| { readonly kind: "loading" | "unavailable" | "closed" }
	| { readonly kind: "directory"; readonly directory: ProjectDirectoryResult };
export interface TelegramReadonlyProjectsSnapshot {
	readonly directory: TelegramReadonlyDirectoryState;
	readonly transfer: LocalFileTransferState;
}
export interface TelegramReadonlyProjectsProps {
	readonly runtime: TelegramReadonlyRuntimePort;
	readonly fileTransfer?: LocalFileTransferPort;
	readonly diagnostics?: ReactNode;
	readonly onRetry: () => void;
	readonly onExit: () => void;
	readonly hostNavigation?: HostNavigationPort;
	readonly onProblem?: (problem: TelegramReadonlyProblem) => void;
}
export function connectTelegramReadonlyNavigation(
	host: HostNavigationPort,
	onExit: () => void,
	isCurrent: () => boolean = () => true,
): () => void {
	let live = true;
	let unsubscribe: () => void = () => undefined;
	try {
		host.setClosingConfirmation?.(false);
	} catch {
		/* This view has no drafts. Back is independent of the optional warning feature. */
	}
	try {
		host.setBackVisible(true);
	} catch {
		/* The visible Exit button remains available. */
	}
	try {
		unsubscribe = host.subscribeBack(() => {
			if (live && isCurrent()) onExit();
		});
	} catch {
		/* An unavailable SDK subscription does not hide Exit. */
	}
	return () => {
		if (!live) return;
		live = false;
		try {
			unsubscribe();
		} catch {
			/* Keep the retired callback revoked. */
		}
		try {
			host.setBackVisible(false);
		} catch {
			/* The owner also tears down the host environment. */
		}
	};
}
export class TelegramReadonlyProjectsSession {
	public readonly sourceRecovery: ProjectSourceRecoveryPort;
	public readonly fileSession: LocalFileTransferSession | undefined;
	private state: TelegramReadonlyProjectsSnapshot = Object.freeze({
		directory: { kind: "loading" as const },
		transfer: { kind: "idle" as const },
	});
	private readonly listeners = new Set<() => void>();
	private readonly list: TelegramReadonlyRuntimePort["listProjects"];
	private readonly export: TelegramReadonlyRuntimePort["exportProjectTransfer"];
	private readonly listSources: ProjectSourceRecoveryPort["listRecoverySources"];
	private readonly readSource: ProjectSourceRecoveryPort["readRecoverySource"];
	private started = false;
	private closed = false;
	private starting: Promise<void> | undefined;
	private intent = 0n;
	private sourceTicket:
		| { readonly intent: bigint; readonly source: UnverifiedProjectSource }
		| undefined;
	private preparationProblem: TelegramReadonlyProblem | undefined;
	private readonly onAbort = () => this.close(true);
	public constructor(
		private readonly runtime: TelegramReadonlyRuntimePort,
		fileTransfer?: LocalFileTransferPort,
		private readonly options: {
			readonly isCurrent?: () => boolean;
			readonly onProblem?: (problem: TelegramReadonlyProblem) => void;
		} = {},
	) {
		this.list = runtime.listProjects.bind(runtime);
		this.export = runtime.exportProjectTransfer.bind(runtime);
		const source = runtime.sourceRecovery;
		this.listSources = source.listRecoverySources.bind(source);
		this.readSource = source.readRecoverySource.bind(source);
		this.sourceRecovery = Object.freeze({
			listRecoverySources: async () => {
				this.requireLive();
				try {
					const result = await this.listSources();
					this.requireLive();
					return result;
				} catch {
					if (this.live()) this.problem("source-unavailable");
					throw new Error("Source list is unavailable");
				}
			},
			readRecoverySource: async (projectId: string, revisionId: string) => {
				this.requireLive();
				const intent = ++this.intent;
				this.sourceTicket = undefined;
				this.fileSession?.close();
				this.requireLive();
				try {
					const value = await this.readSource(projectId, revisionId);
					if (!this.live() || this.intent !== intent) return undefined;
					if (
						value?.kind === "unverified-source" &&
						value.projectId === projectId &&
						value.revisionId === revisionId
					) {
						const source = Object.freeze({ ...value });
						this.sourceTicket = { intent, source };
						return source;
					}
					return undefined;
				} catch {
					if (this.live() && this.intent === intent)
						this.problem("source-unavailable");
					throw new Error("Source is unavailable");
				}
			},
		});
		if (fileTransfer) {
			const prepare = fileTransfer.prepare.bind(fileTransfer),
				handoff = fileTransfer.handoff.bind(fileTransfer),
				read = fileTransfer.read.bind(fileTransfer);
			this.fileSession = new LocalFileTransferSession(
				{
					prepare: (input, signal) =>
						this.live() && !signal?.aborted
							? prepare(input, signal)
							: { kind: "cancelled" },
					handoff: async (file, signal) =>
						this.live() && !signal?.aborted
							? handoff(file, signal)
							: { kind: "cancelled" },
					read: async (file, signal) =>
						this.live() && !signal?.aborted
							? read(file, signal)
							: { kind: "cancelled" },
				},
				(transfer) => {
					if (!this.live()) return;
					this.update({ ...this.state, transfer });
					if (
						(transfer.kind === "failed" || transfer.kind === "unsupported") &&
						!this.preparationProblem
					)
						this.problem("file-unavailable");
				},
			);
		}
	}
	private live(): boolean {
		return (
			this.started &&
			!this.closed &&
			!this.runtime.signal.aborted &&
			(this.options.isCurrent?.() ?? true)
		);
	}
	private requireLive(): void {
		if (!this.live()) throw new Error("Readonly view is closed");
	}
	private problem(problem: TelegramReadonlyProblem): void {
		if (!this.live()) return;
		try {
			this.options.onProblem?.(problem);
		} catch {
			/* Diagnostics cannot reopen an old view. */
		}
	}
	private update(state: TelegramReadonlyProjectsSnapshot): void {
		this.state = Object.freeze(state);
		for (const listener of [...this.listeners]) {
			if (!this.listeners.has(listener)) continue;
			try {
				listener();
			} catch {
				/* An observer cannot suppress another view. */
			}
		}
	}
	public snapshot(): TelegramReadonlyProjectsSnapshot {
		return this.state;
	}
	public subscribe(listener: () => void): () => void {
		if (this.closed) return () => undefined;
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	public start(): Promise<void> {
		if (this.starting) return this.starting;
		if (this.closed) return Promise.resolve();
		this.started = true;
		this.runtime.signal.addEventListener("abort", this.onAbort, { once: true });
		if (this.runtime.signal.aborted) this.onAbort();
		this.starting = Promise.resolve().then(async () => {
			if (!this.live()) return;
			try {
				const directory = await this.list();
				if (!this.live()) return;
				const owned: ProjectDirectoryResult =
					directory.kind === "populated"
						? {
								kind: "populated",
								projects: Object.freeze(
									directory.projects.map((row) =>
										Object.freeze({
											projectId: row.projectId,
											revisionId: row.revisionId,
											name: row.name,
											updatedAt: row.updatedAt,
										}),
									),
								),
								...(directory.recoveryNeeded
									? { recoveryNeeded: true as const }
									: {}),
							}
						: Object.freeze({ ...directory });
				this.update({
					...this.state,
					directory: { kind: "directory", directory: owned },
				});
			} catch {
				if (!this.live()) return;
				this.problem("source-unavailable");
				if (this.live())
					this.update({ ...this.state, directory: { kind: "unavailable" } });
			}
		});
		return this.starting;
	}
	public async prepareProject(project: ProjectSummary): Promise<boolean> {
		if (!this.live()) return false;
		const directory = this.state.directory;
		if (
			directory.kind !== "directory" ||
			directory.directory.kind !== "populated" ||
			!directory.directory.projects.some(
				(row) =>
					row.projectId === project.projectId &&
					row.revisionId === project.revisionId,
			)
		)
			return false;
		const session = this.fileSession;
		if (!session) {
			this.problem("file-unavailable");
			return false;
		}
		const intent = ++this.intent;
		this.sourceTicket = undefined;
		this.preparationProblem = undefined;
		await session.prepare(async (signal) => {
			if (!this.live() || signal.aborted || this.intent !== intent)
				return undefined;
			try {
				const result = await this.export(
					project.projectId,
					project.revisionId,
					{ signal },
				);
				if (!this.live() || signal.aborted || this.intent !== intent)
					return undefined;
				if (result.kind === "ready")
					return {
						bytes: result.bytes,
						filename: result.filename,
						fileKind: "portable-backup",
					};
			} catch {
				/* A fixed availability result replaces private storage errors. */
			}
			if (this.live() && !signal.aborted && this.intent === intent) {
				this.preparationProblem = "backup-unavailable";
				this.problem("backup-unavailable");
			}
			return undefined;
		});
		return (
			this.live() &&
			this.intent === intent &&
			session.snapshot().kind === "prepared"
		);
	}
	public async prepareSource(source: UnverifiedProjectSource): Promise<void> {
		this.requireLive();
		const ticket = this.sourceTicket,
			session = this.fileSession;
		if (
			!ticket ||
			ticket.intent !== this.intent ||
			ticket.source.projectId !== source.projectId ||
			ticket.source.revisionId !== source.revisionId ||
			ticket.source.serializedProject !== source.serializedProject ||
			!session
		)
			throw new Error("Explicit source selection is required");
		this.sourceTicket = undefined;
		this.preparationProblem = undefined;
		await session.prepare(async (signal) => {
			if (!this.live() || signal.aborted || ticket.intent !== this.intent)
				return undefined;
			const prepared = prepareUnverifiedSourceFile(ticket.source);
			if (prepared.kind === "prepared-source")
				return {
					bytes: prepared.bytes,
					filename: prepared.filename,
					fileKind: "unverified-source",
				};
			this.preparationProblem = "file-unavailable";
			this.problem("file-unavailable");
			return undefined;
		});
		if (
			!this.live() ||
			ticket.intent !== this.intent ||
			session.snapshot().kind !== "prepared"
		)
			throw new Error("Source file is unavailable");
	}
	private close(notify: boolean): void {
		if (this.closed) return;
		this.closed = true;
		this.intent++;
		this.sourceTicket = undefined;
		this.runtime.signal.removeEventListener("abort", this.onAbort);
		this.fileSession?.close();
		const state: TelegramReadonlyProjectsSnapshot = {
			directory: { kind: "closed" },
			transfer: { kind: "idle" },
		};
		if (notify) this.update(state);
		else this.state = Object.freeze(state);
	}
	/** Revokes this UI generation only. The composition owns the actual runtime drain. */
	public dispose(): void {
		this.close(false);
		this.listeners.clear();
	}
}
export interface TelegramReadonlyProjectsContentProps {
	readonly state: TelegramReadonlyDirectoryState;
	readonly fileAvailable: boolean;
	readonly busy?: boolean;
	readonly onPrepareProject: (project: ProjectSummary) => void;
	readonly onRetry: () => void;
	readonly onExit: () => void;
	readonly diagnostics?: ReactNode;
	readonly sourceRecovery?: ReactNode;
	readonly fileSession?: LocalFileTransferSession;
	readonly transferState?: LocalFileTransferState;
}
/** Pure labels/layout contract; it never chooses a storage owner or admits a runtime. */
export function TelegramReadonlyProjectsContent({
	state,
	fileAvailable,
	busy = false,
	onPrepareProject,
	onRetry,
	onExit,
	diagnostics,
	sourceRecovery,
	fileSession,
	transferState,
}: TelegramReadonlyProjectsContentProps) {
	const directory = state.kind === "directory" ? state.directory : undefined;
	const recovery =
		directory?.kind === "recovery-needed" ||
		(directory?.kind === "populated" && directory.recoveryNeeded);
	return (
		<main
			className={styles.shell}
			data-editor-host="telegram"
			aria-labelledby="telegram-readonly-heading"
			aria-busy={state.kind === "loading"}
		>
			<div className={styles.content}>
				<header className={styles.header}>
					<p className={styles.eyebrow}>
						{copy("Локальные данные", "Local data")}
					</p>
					<h1 id="telegram-readonly-heading">
						{copy("Просмотр проектов", "View projects")}
					</h1>
					<p>
						{copy(
							"Редактирование пока недоступно. Здесь можно подготовить файл проекта или отдельно выгрузить непроверенную исходную запись.",
							"Editing is currently unavailable. You can prepare a project file or export an unverified source record separately.",
						)}
					</p>
				</header>
				<div className={styles.actions}>
					<button type="button" onClick={onRetry}>
						{copy("Повторить запуск", "Retry launch")}
					</button>
					<button type="button" onClick={onExit}>
						{copy("Выйти", "Exit")}
					</button>
				</div>
				{state.kind === "loading" ? (
					<p role="status">
						{copy("Читаем список проектов…", "Reading projects…")}
					</p>
				) : state.kind === "unavailable" ? (
					<p className={styles.notice} role="status">
						{copy(
							"Не удалось получить список проектов. Повторите запуск. Данные не изменены.",
							"Could not list your projects. Try launching again. Your data is intact.",
						)}
					</p>
				) : state.kind === "closed" ? (
					<p className={styles.notice} role="status">
						{copy(
							"Просмотр данных завершён. Можно повторить безопасный запуск.",
							"Data preview is closed. You can retry the safe launch.",
						)}
					</p>
				) : null}
				{directory?.kind === "empty" ? (
					<p className={styles.notice} role="status">
						{copy(
							"В этом локальном контексте пока нет проверенных проектов.",
							"There are no verified projects in this local storage yet.",
						)}
					</p>
				) : null}
				{recovery ? (
					<p className={styles.notice} role="status">
						{copy(
							"Часть локальных данных не удалось проверить. Непроверенные исходники можно подготовить отдельно.",
							"Some local data could not be verified. You can prepare unverified source records separately.",
						)}
					</p>
				) : null}
				{directory?.kind === "populated" ? (
					<section aria-label={copy("Проверенные записи", "Verified records")}>
						<ul className={styles.projects}>
							{directory.projects.map((row) => (
								<li
									key={`${row.projectId.length}:${row.projectId}:${row.revisionId}`}
									className={styles.card}
								>
									<div>
										<p className={styles.cardLabel}>
											{copy("Проверенная запись", "Verified record")}
										</p>
										<h2>
											<bdi>{row.name}</bdi>
										</h2>
									</div>
									<button
										className={styles.prepare}
										type="button"
										disabled={!fileAvailable || busy}
										onClick={() => onPrepareProject(row)}
									>
										{copy("Подготовить файл проекта", "Prepare project file")}
									</button>
								</li>
							))}
						</ul>
						<p className={styles.caption}>
							{copy(
								"Подготовка файла не означает его сохранение. Для передачи потребуется отдельное нажатие.",
								"When the file is ready, use the sharing button to save or transfer it.",
							)}
						</p>
					</section>
				) : null}
				{state.kind !== "closed" ? (
					<>
						{!fileAvailable ? (
							<p className={styles.notice} role="status">
								{copy(
									"Передача файлов недоступна в этом клиенте.",
									"File sharing is unavailable in this client.",
								)}
							</p>
						) : null}
						<fieldset
							className={styles.source}
							disabled={!fileAvailable || busy}
						>
							{sourceRecovery ?? (
								<>
									<h2>
										{copy(
											"Непроверенные исходники",
											"Unverified source records",
										)}
									</h2>
									<p>
										{copy(
											"Исходная запись не является полной резервной копией и не восстанавливает проект автоматически.",
											"A raw source record contains only part of the data and cannot restore a project automatically.",
										)}
									</p>
								</>
							)}
						</fieldset>
					</>
				) : null}
				{diagnostics}
			</div>
			{state.kind !== "closed" && fileSession && transferState ? (
				<LocalFileTransferPanel session={fileSession} state={transferState} />
			) : null}
		</main>
	);
}

export function TelegramReadonlyProjects({
	runtime,
	fileTransfer,
	diagnostics,
	onRetry,
	onExit,
	hostNavigation,
	onProblem,
}: TelegramReadonlyProjectsProps) {
	const owner = useMemo(
		() => ({ runtime, fileTransfer }),
		[runtime, fileTransfer],
	);
	const current = useRef(owner);
	current.current = owner;
	const problems = useRef(onProblem);
	problems.current = onProblem;
	const exit = useRef(onExit);
	exit.current = onExit;
	const [view, setView] = useState<{
		readonly owner: typeof owner;
		readonly model: TelegramReadonlyProjectsSession;
		readonly snapshot: TelegramReadonlyProjectsSnapshot;
	}>();
	useLayoutEffect(() => {
		const model = new TelegramReadonlyProjectsSession(runtime, fileTransfer, {
			isCurrent: () => current.current === owner,
			onProblem: (problem) => problems.current?.(problem),
		});
		const refresh = () => {
			if (current.current === owner)
				setView({ owner, model, snapshot: model.snapshot() });
		};
		const unsubscribe = model.subscribe(refresh);
		refresh();
		void model.start();
		return () => {
			unsubscribe();
			model.dispose();
		};
	}, [owner, runtime, fileTransfer]);
	useLayoutEffect(() => {
		if (!hostNavigation) return;
		return connectTelegramReadonlyNavigation(
			hostNavigation,
			() => exit.current(),
			() => current.current === owner,
		);
	}, [owner, hostNavigation]);
	const active = view?.owner === owner ? view : undefined;
	const snapshot = active?.snapshot ?? {
		directory: { kind: "loading" as const },
		transfer: { kind: "idle" as const },
	};
	const busy =
		snapshot.transfer.kind === "preparing" ||
		snapshot.transfer.kind === "handing-off";
	return (
		<TelegramReadonlyProjectsContent
			state={snapshot.directory}
			fileAvailable={!!fileTransfer}
			busy={busy}
			onRetry={onRetry}
			onExit={onExit}
			diagnostics={diagnostics}
			onPrepareProject={(project) => {
				if (active && current.current === owner)
					void active.model.prepareProject(project);
			}}
			sourceRecovery={
				active && snapshot.directory.kind !== "closed" ? (
					<StoredSourceRecovery
						port={active.model.sourceRecovery}
						onExport={(source) => active.model.prepareSource(source)}
					/>
				) : undefined
			}
			fileSession={active?.model.fileSession}
			transferState={snapshot.transfer}
		/>
	);
}
