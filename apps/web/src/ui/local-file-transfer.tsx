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
	private prepareArchive: PrepareArchive | undefined;
	private encryptedHandle?: { readonly path: string; readonly expiresAt: number };
	public constructor(
		private readonly port: LocalFileTransferPort,
		private readonly changed: (state: LocalFileTransferState) => void,
	) {}
	public snapshot(): LocalFileTransferState {
		return this.state;
	}
	private update(state: LocalFileTransferState) {
		this.state = state;
		this.changed(state);
	}
	public close() {
		this.operation.abort();
		this.operation = new AbortController();
		this.prepareArchive = undefined;
		this.encryptedHandle = undefined;
		this.update({ kind: "idle" });
	}
	public async prepare(produce: PrepareArchive): Promise<void> {
		this.close();
		this.prepareArchive = produce;
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
			} else {
				this.update({ kind: "failed" });
			}
		} catch {
			if (!operation.signal.aborted) this.update({ kind: "failed" });
		}
	}
	public retry(): Promise<void> {
		return this.state.kind === "failed" && this.prepareArchive
			? this.prepare(this.prepareArchive)
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
			if (!signal.aborted) this.update({
				kind: "encrypted-failed", prepared,
				notice: "Не удалось подготовить копию. Проверьте подключение и введите пароль ещё раз.",
			});
			return;
		}
		if (!hasFreshDownloadTap(tappedAt)) {
			this.update({ kind: "encrypted-ready", prepared, notice: "Копия готова. Коснитесь кнопки «Скачать»." });
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
			this.encryptedHandle = undefined;
			this.update({
				kind: "encrypted-failed", prepared,
				notice: "Срок скачивания истёк. Введите пароль, чтобы скачать новую копию.",
			});
			return;
		}
		await this.requestEncryptedDownload(prepared, relay, handle.path);
	}
	private async requestEncryptedDownload(prepared: PreparedHostFile, relay: TelegramProjectDownload, path: string): Promise<void> {
		const { signal } = this.operation;
		this.update({ kind: "encrypted-downloading", prepared });
		const result = await relay.download(path, signal).catch(() => "unavailable");
		if (!signal.aborted) this.update({
			kind: "encrypted-ready", prepared,
			notice: result === "requested"
				? `Telegram принял запрос. Проверьте файл ${telegramProjectDownloadFilename} в загрузках.`
				: result === "cancelled"
					? "Скачивание отменено. Коснитесь «Скачать», чтобы повторить."
					: "Telegram не открыл скачивание. Попробуйте ещё раз.",
		});
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
		} catch {
			if (!operation.signal.aborted) this.update({ kind: "failed", prepared });
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
	const copy =
		state.kind === "handoff-attempted"
			? prepared?.fileKind === "unverified-source" ? "Проверьте файл вне приложения. Системное действие не подтверждает его сохранность. Содержимое записи не проверено; этот файл не восстанавливает проект автоматически." : "Проверьте файл вне приложения. Системное действие не подтверждает сохранность backup; выберите полученный файл для проверки импорта."
			: state.kind === "unsupported"
				? "Передача файла недоступна в этом клиенте. Попробуйте другой поддерживаемый клиент."
				: state.kind === "save-incomplete"
					? "Система не завершила сохранение файла. В этой версии Telegram сохранение может быть недоступно."
					: state.kind === "cancelled"
						? "Передача отменена. Можно повторить попытку."
						: state.kind === "failed"
							? prepared
								? "Не удалось передать файл. Повторите попытку."
								: "Не удалось подготовить файл. Повторите попытку."
							: state.kind === "handing-off"
								? "Передача файла…"
								: state.kind === "preparing"
									? "Подготовка файла…"
									: "Файл готов к передаче. Выберите системное действие и проверьте полученный файл.";
	return (
		<TelegramSheetFrame telegram={telegram} canvasAnchored
			className={styles.panel}
			aria-label="Передача файла"
			aria-busy={busy}
		>
			<h2>
				{prepared?.fileKind === "unverified-source" ? "Непроверенная исходная запись" : prepared?.fileKind === "recovery-draft"
					? "Несохранённая правка"
					: "Файл проекта"}
			</h2>
			{prepared ? <p>{prepared.file.name}</p> : null}
			{prepared?.fileKind === "unverified-source" ? <p>Это не резервная копия проекта и не файл несохранённой правки. Содержимое записи не проверено; автоматическое восстановление не выполняется.</p> : null}
			{prepared?.fileKind === "recovery-draft" ? (
				<p>
					Это не полный backup. Восстановление создаёт отдельный проект после
					проверки.
				</p>
			) : null}
			<p role="status">{copy}</p>
			<div>
				<button type="button" onClick={() => session.close()}>
					{busy ? "Отменить" : "Закрыть"}
				</button>
				{prepared || state.kind === "failed" ? (
					<button
						className={styles.handoff}
						type="button"
						disabled={busy}
						onClick={() => void session.retry()}
					>
						{state.kind === "prepared"
							? "Передать файл"
							: state.kind === "handing-off"
								? "Передача файла…"
								: "Повторить"}
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
	return <TelegramSheetFrame telegram canvasAnchored className={styles.panel}
		aria-label="Передача файла" aria-busy={encrypting || downloading}>
		<div className={styles.encryptedHeading}>
			<h2>Файл проекта</h2>
			<button type="button" className={styles.encryptedInfo} aria-label="Как работает скачивание"
				aria-expanded={infoOpen} aria-controls={infoId} aria-describedby={infoOpen ? infoId : undefined}
				onClick={() => setInfoOpen(!infoOpen)} onKeyDown={(event) => {
					if (event.key === "Escape" && infoOpen) {
						event.stopPropagation();
						setInfoOpen(false);
					}
				}}>
				<span aria-hidden="true">ⓘ</span>
			</button>
			<p id={infoId} role="tooltip" className={styles.encryptedInfoText} hidden={!infoOpen}>
				Копия шифруется на телефоне. Подтвердите скачивание в Telegram. Сервер удалит копию через 15 минут. Пароль понадобится для импорта.
			</p>
		</div>
		<p>{ready || downloading ? telegramProjectDownloadFilename : prepared.file.name}</p>
		{ready || downloading ? <>
			<p role="status">{downloading ? "Открытие Telegram…" : state.notice}</p>
			<div>
				<button type="button" onClick={() => session.close()}>{downloading ? "Отменить" : "Закрыть"}</button>
				<button ref={downloadButton} type="button" className={styles.handoff} disabled={downloading}
					onPointerDown={recordDownloadTap} onPointerCancel={clearDownloadTap} onClick={(event) => {
						rejectKeyboardClick(event);
						const tappedAt = downloadTap.current;
						clearDownloadTap();
						if (hasFreshDownloadTap(tappedAt)) void session.downloadEncrypted();
					}}>Скачать</button>
			</div>
		</> : <form className={styles.passwordForm} onSubmit={submit}>
			<label>Пароль для копии
				<input name="password" type="password" autoComplete="new-password" required disabled={encrypting}
					aria-describedby={passwordHintId} aria-invalid={passwordValid === false || undefined}
					onChange={(event) => {
						const password = event.currentTarget.value;
						setPasswordValid(password ? isProjectTransferExportPasswordValid(password) : undefined);
					}} />
			</label>
			<p id={passwordHintId} className={styles.passwordHint}>Пароль должен состоять из 6 символов.</p>
			{state.notice ? <p role="alert">{state.notice}</p> : null}
			{encrypting ? <p role="status">Подготовка скачивания…</p> : null}
			<div>
				<button type="button" onClick={() => session.close()}>{encrypting ? "Отменить" : "Закрыть"}</button>
				<button type="submit" disabled={encrypting || passwordValid !== true} className={styles.handoff}
					onPointerDown={recordDownloadTap} onPointerCancel={clearDownloadTap} onClick={rejectKeyboardClick}>Скачать</button>
			</div>
		</form>}
	</TelegramSheetFrame>;
}

export function EncryptedImportPasswordDialog({ filename, busy, error, onCancel, onUnlock, submitLabel = "Импортировать" }: {
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
	return <TelegramSheetFrame as="dialog" telegram ref={dialog} busy={busy} className={`${styles.panel} ${styles.passwordDialog}`}
		aria-labelledby={id} onBackdropClose={onCancel}
		onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
		<h2 id={id}>Пароль файла проекта</h2>
		<p>{filename}</p>
		<form className={styles.passwordForm} onSubmit={(event) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget);
			const password = String(form.get("password") ?? "");
			event.currentTarget.reset();
			onUnlock(password);
		}}>
			<label>Пароль, заданный при экспорте
				<input name="password" type="password" autoComplete="off" required disabled={busy} />
			</label>
			{error ? <p role="alert">{error}</p> : null}
			<div>
				<button type="button" onClick={onCancel} disabled={busy}>Отмена</button>
				<button type="submit" disabled={busy} className={styles.handoff}>
					{busy ? "Открываем…" : submitLabel}
				</button>
			</div>
		</form>
	</TelegramSheetFrame>;
}
