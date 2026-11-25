import { copy } from "./editor-language";
import type { ProductMetric, ProductMetricSink } from "../application/editor-product-metrics";
import { type FormEvent, type MouseEvent, type PointerEvent, useId, useLayoutEffect, useRef, useState } from "react";
import {
	encryptProjectTransfer,
	isProjectTransferExportPasswordValid,
} from "../adapters/telegram/encrypted-project-transfer";
import {
	projectDownloadLifetimeMs,
	telegramProjectDownloadFilename,
	type TelegramProjectDownload,
} from "../adapters/telegram/project-download";
import { TelegramSheetFrame } from "./TelegramSheetFrame";
import type {
	createHostFileBridge,
	HostFileKind,
	PreparedHostFile,
} from "../adapters/telegram/host-file-bridge";
import styles from "./LocalFileTransfer.module.css";

export type LocalFileTransferPort = ReturnType<typeof createHostFileBridge> & {
	readonly encryptedDownload?: TelegramProjectDownload;
};
type EncryptedTransferKind = "encrypting" | "encrypted-downloading" | "encrypted-ready" | "encrypted-failed";
export type LocalFileTransferState =
	| { readonly kind: "idle" }
	| { readonly kind: "preparing" }
	| {
			readonly kind:
				| EncryptedTransferKind
				| "prepared"
				| "handing-off"
				| "handoff-attempted"
				| "unsupported"
				| "save-incomplete"
				| "failed"
				| "cancelled";
			readonly prepared?: PreparedHostFile;
			readonly notice?: string;
	  };
type Archive = {
	readonly bytes: Uint8Array;
	readonly filename: string;
	readonly fileKind: HostFileKind;
};
type PrepareArchive = (signal: AbortSignal) => Promise<Archive | undefined>;
// Android Telegram ignores download requests more than 10 seconds after the last tap.
const automaticDownloadWindowMs = 9_000;

function hasFreshDownloadTap(tappedAt: number | undefined): boolean {
	return tappedAt !== undefined && performance.now() - tappedAt < automaticDownloadWindowMs;
}

/** Prepares an archive and manages user-initiated system transfer and retries. */
export class LocalFileTransferSession {
	private state: LocalFileTransferState = { kind: "idle" };
	private operation = new AbortController();
	private prepareArchive: { readonly produce: PrepareArchive; readonly fileKind?: HostFileKind | undefined } | undefined;
	private encryptedHandle?: { readonly path: string; readonly expiresAt: number };
	public constructor(
		private readonly port: LocalFileTransferPort,
		private readonly changed: (state: LocalFileTransferState) => void,
		private readonly onProductMetric?: ProductMetricSink,
	) {}
	public snapshot(): LocalFileTransferState {
		return this.state;
	}
	private update(state: LocalFileTransferState) {
		this.state = state;
		this.changed(state);
	}
	private report(metric: ProductMetric, signal: AbortSignal): void {
		if (signal.aborted) return;
		try { this.onProductMetric?.(metric); } catch { /* File transfer remains independent. */ }
	}
	public close() {
		this.operation.abort();
		this.operation = new AbortController();
		this.prepareArchive = undefined;
		this.encryptedHandle = undefined;
		this.update({ kind: "idle" });
	}
	public async prepare(produce: PrepareArchive, fileKind?: HostFileKind): Promise<void> {
		this.close();
		this.prepareArchive = { produce, fileKind };
		const operation = this.operation;
		this.update({ kind: "preparing" });
		try {
			const archive = await produce(operation.signal);
			if (operation.signal.aborted) return;
			const result = archive
				? this.port.prepare(archive, operation.signal)
				: undefined;
			if (operation.signal.aborted) return;
			if (result?.kind === "prepared") {
				this.prepareArchive = undefined;
				this.update({ kind: "prepared", prepared: result });
				if (result.fileKind === "portable-backup") this.report("backup_prepared", operation.signal);
			} else {
				this.update({ kind: "failed" });
				if ((archive?.fileKind ?? fileKind) === "portable-backup") this.report("backup_export_failed", operation.signal);
			}
		} catch {
			if (!operation.signal.aborted) this.update({ kind: "failed" });
			if (fileKind === "portable-backup") this.report("backup_export_failed", operation.signal);
		}
	}
	public retry(): Promise<void> {
		return this.state.kind === "failed" && this.prepareArchive
			? this.prepare(this.prepareArchive.produce, this.prepareArchive.fileKind)
			: this.handoff();
	}
	public usesEncryptedDownload(prepared: PreparedHostFile): boolean {
		return prepared.fileKind === "portable-backup" && this.port.encryptedDownload?.available() === true;
	}
	public async startEncryptedDownload(password: string, tappedAt: number | undefined): Promise<void> {
		const state = this.state;
		const relay = this.port.encryptedDownload;
		if ((state.kind !== "prepared" && state.kind !== "encrypted-failed") ||
			!state.prepared || !this.usesEncryptedDownload(state.prepared) || !relay ||
			!isProjectTransferExportPasswordValid(password)) return;
		const { prepared } = state;
		const { signal } = this.operation;
		let path: string;
		this.update({ kind: "encrypting", prepared });
		try {
			const encrypted = await encryptProjectTransfer(new Uint8Array(await prepared.file.arrayBuffer()), password, signal);
			signal.throwIfAborted();
			if (encrypted.kind !== "encrypted") throw new Error("Backup encryption did not finish");
			const expiresAt = Date.now() + projectDownloadLifetimeMs;
			path = await relay.stage(encrypted.bytes, signal);
			signal.throwIfAborted();
			this.encryptedHandle = { path, expiresAt };
		} catch {
			if (!signal.aborted)
				this.update({
					kind: "encrypted-failed",
					prepared,
					notice: copy(
						"Не удалось подготовить копию. Проверьте подключение и введите пароль ещё раз.",
						"Could not prepare the backup. Check your connection and enter the password again.",
					),
				});
			this.report("backup_export_failed", signal);
			return;
		}
		if (!hasFreshDownloadTap(tappedAt)) {
			this.update({
				kind: "encrypted-ready",
				prepared,
				notice: copy(
					"Копия готова. Коснитесь кнопки «Скачать».",
					"The backup is ready. Tap Download.",
				),
			});
			return;
		}
		await this.requestEncryptedDownload(prepared, relay, path);
	}
	public async downloadEncrypted(): Promise<void> {
		const state = this.state;
		const relay = this.port.encryptedDownload;
		const handle = this.encryptedHandle;
		if (state.kind !== "encrypted-ready" || !state.prepared || !relay || !handle) return;
		const { prepared } = state;
		if (Date.now() >= handle.expiresAt) {
			const { signal } = this.operation;
			this.encryptedHandle = undefined;
			this.update({
				kind: "encrypted-failed",
				prepared,
				notice: copy(
					"Срок скачивания истёк. Введите пароль, чтобы скачать новую копию.",
					"The download expired. Enter the password to download a new copy.",
				),
			});
			this.report("backup_handoff_failed", signal);
			return;
		}
		await this.requestEncryptedDownload(prepared, relay, handle.path);
	}
	private async requestEncryptedDownload(prepared: PreparedHostFile, relay: TelegramProjectDownload, path: string): Promise<void> {
		const { signal } = this.operation;
		this.update({ kind: "encrypted-downloading", prepared });
		const result = await relay
			.download(path, signal)
			.catch(() => "unavailable");
		if (!signal.aborted)
			this.update({
				kind: "encrypted-ready",
				prepared,
				notice:
					result === "requested"
						? copy(
								`Telegram принял запрос. Проверьте файл ${telegramProjectDownloadFilename} в загрузках.`,
								`Telegram accepted the request. Check Downloads for ${telegramProjectDownloadFilename}.`,
							)
						: result === "cancelled"
							? copy(
									"Скачивание отменено. Коснитесь «Скачать», чтобы повторить.",
									"Download canceled. Tap Download to try again.",
								)
							: copy(
									"Telegram не открыл скачивание. Попробуйте ещё раз.",
									"Telegram did not open the download. Try again.",
								),
			});
		if (result === "requested") this.report("backup_handoff_requested", signal);
		else if (result === "unavailable") this.report("backup_handoff_failed", signal);
	}
	public async handoff(): Promise<void> {
		if (
			this.state.kind === "idle" ||
			this.state.kind === "preparing" ||
			this.state.kind === "handing-off" ||
			!this.state.prepared || this.usesEncryptedDownload(this.state.prepared)
		)
			return;
		const prepared = this.state.prepared;
		const operation = this.operation;
		this.update({ kind: "handing-off", prepared });
		try {
			const result = await this.port.handoff(prepared, operation.signal);
			if (operation.signal.aborted) return;
			this.update({
				kind: result.kind === "rejected" ? "failed" : result.kind,
				prepared,
			});
			if (prepared.fileKind === "portable-backup") {
				if (result.kind === "handoff-attempted") this.report("backup_handoff_requested", operation.signal);
				else if (result.kind !== "cancelled") this.report("backup_handoff_failed", operation.signal);
			}
		} catch {
			if (!operation.signal.aborted) this.update({ kind: "failed", prepared });
			if (prepared.fileKind === "portable-backup") this.report("backup_handoff_failed", operation.signal);
		}
	}
}

export function LocalFileTransferPanel({
	session,
	state,
	telegram,
}: {
	readonly session: LocalFileTransferSession;
	readonly telegram?: boolean;
	readonly state: LocalFileTransferState;
}) {
	if (state.kind === "idle") return null;
	const prepared = "prepared" in state ? state.prepared : undefined;
	if (state.kind !== "preparing" && prepared && (session.usesEncryptedDownload(prepared) ||
		state.kind === "encrypting" || state.kind === "encrypted-ready" ||
		state.kind === "encrypted-failed" || state.kind === "encrypted-downloading"))
		return <EncryptedDownloadPanel session={session} prepared={prepared} state={state} />;
	const busy = state.kind === "preparing" || state.kind === "handing-off";
	const statusMessage =
		state.kind === "handoff-attempted"
			? prepared?.fileKind === "unverified-source"
				? copy(
						"Проверьте файл вне приложения. Системное действие не подтверждает его сохранность. Содержимое записи не проверено; этот файл не восстанавливает проект автоматически.",
						"Check the file outside the app to confirm it saved. The source record is unverified and does not restore a project automatically.",
					)
				: copy(
						"Проверьте файл вне приложения. Системное действие не подтверждает сохранность backup; выберите полученный файл для проверки импорта.",
						"Check the file outside the app to confirm it saved. Select the file to verify that it can be imported.",
					)
			: state.kind === "unsupported"
				? copy(
						"Передача файла недоступна в этом клиенте. Попробуйте другой поддерживаемый клиент.",
						"File sharing is unavailable in this client. Try another supported client.",
					)
				: state.kind === "save-incomplete"
					? copy(
							"Система не завершила сохранение файла. В этой версии Telegram сохранение может быть недоступно.",
							"The system did not finish saving the file. This version of Telegram may not support saving files.",
						)
					: state.kind === "cancelled"
						? copy(
								"Передача отменена. Можно повторить попытку.",
								"Sharing canceled. You can try again.",
							)
						: state.kind === "failed"
							? prepared
								? copy(
										"Не удалось передать файл. Повторите попытку.",
										"Could not share the file. Try again.",
									)
								: copy(
										"Не удалось подготовить файл. Повторите попытку.",
										"Could not prepare the file. Try again.",
									)
							: state.kind === "handing-off"
								? copy("Передача файла…", "Sharing file…")
								: state.kind === "preparing"
									? copy("Подготовка файла…", "Preparing file…")
									: copy(
											"Файл готов к передаче. Выберите системное действие и проверьте полученный файл.",
											"The file is ready to share. Choose a system action and check the resulting file.",
										);
	return (
		<TelegramSheetFrame telegram={telegram} canvasAnchored
			className={styles.panel}
			aria-label={copy("Передача файла", "File sharing")}
			aria-busy={busy}
		>
			<h2>
				{prepared?.fileKind === "unverified-source"
					? copy("Непроверенная исходная запись", "Unverified source record")
					: prepared?.fileKind === "recovery-draft"
						? copy("Несохранённая правка", "Unsaved edit")
						: copy("Файл проекта", "Project file")}
			</h2>
			{prepared ? <p>{prepared.file.name}</p> : null}
			{prepared?.fileKind === "unverified-source" ? (
				<p>
					{copy(
						"Это не резервная копия проекта и не файл несохранённой правки. Содержимое записи не проверено; автоматическое восстановление не выполняется.",
						"This file contains an unverified source record. It cannot restore the project or an unsaved edit automatically.",
					)}
				</p>
			) : null}
			{prepared?.fileKind === "recovery-draft" ? (
				<p>
					{copy(
						"Это не полный backup. Восстановление создаёт отдельный проект после проверки.",
						"This recovery file contains an unsaved edit. The app verifies the file and then creates a separate project.",
					)}
				</p>
			) : null}
			<p role="status">{statusMessage}</p>
			<div>
				<button type="button" onClick={() => session.close()}>
					{busy ? copy("Отменить", "Cancel") : copy("Закрыть", "Close")}
				</button>
				{prepared || state.kind === "failed" ? (
					<button
						className={styles.handoff}
						type="button"
						disabled={busy}
						onClick={() => void session.retry()}
					>
						{state.kind === "prepared"
							? copy("Передать файл", "Share file")
							: state.kind === "handing-off"
								? copy("Передача файла…", "Sharing file…")
								: copy("Повторить", "Retry")}
					</button>
				) : null}
			</div>
		</TelegramSheetFrame>
	);
}

function EncryptedDownloadPanel({ session, prepared, state }: {
	readonly session: LocalFileTransferSession;
	readonly prepared: PreparedHostFile;
	readonly state: Extract<LocalFileTransferState, { readonly prepared?: PreparedHostFile }>;
}) {
	const [passwordValid, setPasswordValid] = useState<boolean>();
	const [infoOpen, setInfoOpen] = useState(false);
	const passwordHintId = useId();
	const infoId = useId();
	const downloadButton = useRef<HTMLButtonElement>(null);
	const downloadTap = useRef<number | undefined>(undefined);
	const encrypting = state.kind === "encrypting";
	const downloading = state.kind === "encrypted-downloading";
	const ready = state.kind === "encrypted-ready";
	useLayoutEffect(() => {
		if (ready) downloadButton.current?.focus({ preventScroll: true });
	}, [ready]);
	// Telegram Android measures its gesture window from the native touch down.
	const recordDownloadTap = (event: PointerEvent<HTMLButtonElement>) => {
		downloadTap.current = event.isTrusted && event.isPrimary && event.button === 0 ? event.timeStamp : undefined;
	};
	const clearDownloadTap = () => { downloadTap.current = undefined; };
	const rejectKeyboardClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (!event.isTrusted || event.detail === 0) clearDownloadTap();
	};
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const tappedAt = downloadTap.current;
		clearDownloadTap();
		const password = String(new FormData(event.currentTarget).get("password") ?? "");
		if (!isProjectTransferExportPasswordValid(password)) return;
		event.currentTarget.reset();
		setPasswordValid(undefined);
		setInfoOpen(false);
		void session.startEncryptedDownload(password, tappedAt);
	};
	return (
		<TelegramSheetFrame
			telegram
			canvasAnchored
			className={styles.panel}
			aria-label={copy("Передача файла", "File sharing")}
			aria-busy={encrypting || downloading}
		>
			<div className={styles.encryptedHeading}>
				<h2>{copy("Файл проекта", "Project file")}</h2>
				<button
					type="button"
					className={styles.encryptedInfo}
					aria-label={copy("Как работает скачивание", "How downloads work")}
					aria-expanded={infoOpen}
					aria-controls={infoId}
					aria-describedby={infoOpen ? infoId : undefined}
					onClick={() => setInfoOpen(!infoOpen)}
					onKeyDown={(event) => {
						if (event.key === "Escape" && infoOpen) {
							event.stopPropagation();
							setInfoOpen(false);
						}
					}}
				>
					<span aria-hidden="true">ⓘ</span>
				</button>
				<p
					id={infoId}
					role="tooltip"
					className={styles.encryptedInfoText}
					hidden={!infoOpen}
				>
					{copy(
						"Копия шифруется на телефоне. Подтвердите скачивание в Telegram. Сервер удалит копию через 15 минут. Пароль понадобится для импорта.",
						"The backup is encrypted on your phone. Confirm the download in Telegram. The server deletes its copy after 15 minutes. You will need the password to import it.",
					)}
				</p>
			</div>
			<p>
				{ready || downloading
					? telegramProjectDownloadFilename
					: prepared.file.name}
			</p>
			{ready || downloading ? (
				<>
					<p role="status">
						{downloading
							? copy("Открытие Telegram…", "Opening Telegram…")
							: state.notice}
					</p>
					<div>
						<button type="button" onClick={() => session.close()}>
							{downloading
								? copy("Отменить", "Cancel")
								: copy("Закрыть", "Close")}
						</button>
						<button
							ref={downloadButton}
							type="button"
							className={styles.handoff}
							disabled={downloading}
							onPointerDown={recordDownloadTap}
							onPointerCancel={clearDownloadTap}
							onClick={(event) => {
								rejectKeyboardClick(event);
								const tappedAt = downloadTap.current;
								clearDownloadTap();
								if (hasFreshDownloadTap(tappedAt))
									void session.downloadEncrypted();
							}}
						>
							{copy("Скачать", "Download")}
						</button>
					</div>
				</>
			) : (
				<form className={styles.passwordForm} onSubmit={submit}>
					<label>
						{copy("Пароль для копии", "Backup password")}
						<input
							name="password"
							type="password"
							autoComplete="new-password"
							required
							disabled={encrypting}
							aria-describedby={passwordHintId}
							aria-invalid={passwordValid === false || undefined}
							onChange={(event) => {
								const password = event.currentTarget.value;
								setPasswordValid(
									password
										? isProjectTransferExportPasswordValid(password)
										: undefined,
								);
							}}
						/>
					</label>
					<p id={passwordHintId} className={styles.passwordHint}>
						{copy(
							"Пароль должен состоять из 6 символов.",
							"The password must have 6 characters.",
						)}
					</p>
					{state.notice ? <p role="alert">{state.notice}</p> : null}
					{encrypting ? (
						<p role="status">
							{copy("Подготовка скачивания…", "Preparing download…")}
						</p>
					) : null}
					<div>
						<button type="button" onClick={() => session.close()}>
							{encrypting
								? copy("Отменить", "Cancel")
								: copy("Закрыть", "Close")}
						</button>
						<button
							type="submit"
							disabled={encrypting || passwordValid !== true}
							className={styles.handoff}
							onPointerDown={recordDownloadTap}
							onPointerCancel={clearDownloadTap}
							onClick={rejectKeyboardClick}
						>
							{copy("Скачать", "Download")}
						</button>
					</div>
				</form>
			)}
		</TelegramSheetFrame>
	);
}

export function EncryptedImportPasswordDialog({
	filename,
	busy,
	error,
	onCancel,
	onUnlock,
	submitLabel = copy("Импортировать", "Import"),
}: {
	readonly filename: string;
	readonly busy: boolean;
	readonly error?: string;
	readonly onCancel: () => void;
	readonly onUnlock: (password: string) => void;
	readonly submitLabel?: string;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const id = useId();
	useLayoutEffect(() => {
		const element = dialog.current;
		if (!element) return;
		element.showModal();
		return () => element.close();
	}, []);
	return (
		<TelegramSheetFrame
			as="dialog"
			telegram
			ref={dialog}
			busy={busy}
			className={`${styles.panel} ${styles.passwordDialog}`}
			aria-labelledby={id}
			onBackdropClose={onCancel}
			onCancel={(event) => {
				event.preventDefault();
				if (!busy) onCancel();
			}}
		>
			<h2 id={id}>{copy("Пароль файла проекта", "Project file password")}</h2>
			<p>{filename}</p>
			<form
				className={styles.passwordForm}
				onSubmit={(event) => {
					event.preventDefault();
					const form = new FormData(event.currentTarget);
					const password = String(form.get("password") ?? "");
					event.currentTarget.reset();
					onUnlock(password);
				}}
			>
				<label>
					{copy("Пароль, заданный при экспорте", "Password set during export")}
					<input
						name="password"
						type="password"
						autoComplete="off"
						required
						disabled={busy}
					/>
				</label>
				{error ? <p role="alert">{error}</p> : null}
				<div>
					<button type="button" onClick={onCancel} disabled={busy}>
						{copy("Отмена", "Cancel")}
					</button>
					<button type="submit" disabled={busy} className={styles.handoff}>
						{busy ? copy("Открываем…", "Opening…") : submitLabel}
					</button>
				</div>
			</form>
		</TelegramSheetFrame>
	);
}
