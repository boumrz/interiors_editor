import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import {
	encryptProjectTransfer,
	isProjectTransferPasswordValid,
} from "../adapters/telegram/encrypted-project-transfer";
import { projectDownloadLifetimeMs, type TelegramProjectDownload } from "../adapters/telegram/project-download";
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

/** A fresh button gesture starts the system operation after asynchronous preparation. */
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
	public async stageEncrypted(password: string): Promise<void> {
		const state = this.state;
		const relay = this.port.encryptedDownload;
		if ((state.kind !== "prepared" && state.kind !== "encrypted-failed") ||
			!state.prepared || !this.usesEncryptedDownload(state.prepared) || !relay ||
			!isProjectTransferPasswordValid(password)) return;
		const { prepared } = state;
		const { signal } = this.operation;
		this.update({ kind: "encrypting", prepared });
		try {
			const encrypted = await encryptProjectTransfer(new Uint8Array(await prepared.file.arrayBuffer()), password, signal);
			signal.throwIfAborted();
			if (encrypted.kind !== "encrypted") throw new Error("Backup encryption did not finish");
			const expiresAt = Date.now() + projectDownloadLifetimeMs;
			const path = await relay.stage(encrypted.bytes, signal);
			signal.throwIfAborted();
			this.encryptedHandle = { path, expiresAt };
			this.update({ kind: "encrypted-ready", prepared });
		} catch {
			if (!signal.aborted) this.update({
				kind: "encrypted-failed", prepared,
				notice: "Не удалось подготовить скачивание. Проверьте подключение и повторите.",
			});
		}
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
				notice: "Срок скачивания истёк. Подготовьте копию заново.",
			});
			return;
		}
		const { signal } = this.operation;
		this.update({ kind: "encrypted-downloading", prepared });
		const result = await relay.download(handle.path, signal).catch(() => "unavailable");
		if (!signal.aborted) this.update({
			kind: "encrypted-ready", prepared,
			notice: result === "requested"
				? "Telegram принял запрос. Проверьте файл project.interiors в загрузках."
				: "Telegram не подтвердил скачивание. Попробуйте ещё раз.",
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
	const [passwordError, setPasswordError] = useState<string>();
	const encrypting = state.kind === "encrypting";
	const downloading = state.kind === "encrypted-downloading";
	const ready = state.kind === "encrypted-ready" || downloading;
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const password = String(form.get("password") ?? "");
		if (!isProjectTransferPasswordValid(password)) {
			setPasswordError("Введите пароль от 12 до 256 символов.");
			return;
		}
		if (password !== form.get("confirmation")) {
			setPasswordError("Пароли не совпадают.");
			return;
		}
		event.currentTarget.reset();
		setPasswordError(undefined);
		void session.stageEncrypted(password);
	};
	return <TelegramSheetFrame telegram canvasAnchored className={styles.panel}
		aria-label="Передача файла" aria-busy={encrypting || downloading}>
		<h2>Файл проекта</h2>
		<p>{prepared.file.name}</p>
		{ready ? <>
			<p role="status">{state.notice ?? "Зашифрованная копия готова. Пароль понадобится для импорта."}</p>
			<div>
				<button type="button" onClick={() => session.close()}>Закрыть</button>
				<button type="button" className={styles.handoff} disabled={downloading}
					onClick={() => void session.downloadEncrypted()}>
					{downloading ? "Открытие Telegram…" : state.notice ? "Повторить" : "Скачать файл"}
				</button>
			</div>
		</> : <form className={styles.passwordForm} onSubmit={submit}>
			<p>Копия шифруется на телефоне. Telegram скачает её по временной ссылке. Сервер удалит копию через 15 минут. Сохраните пароль для импорта.</p>
			<label>Пароль для копии
				<input name="password" type="password" autoComplete="new-password" required disabled={encrypting} />
			</label>
			<label>Повторите пароль
				<input name="confirmation" type="password" autoComplete="new-password" required disabled={encrypting} />
			</label>
			{passwordError || state.notice ? <p role="alert">{passwordError ?? state.notice}</p> : null}
			<div>
				<button type="button" onClick={() => session.close()}>{encrypting ? "Отменить" : "Закрыть"}</button>
				<button type="submit" disabled={encrypting} className={styles.handoff}>
					{encrypting ? "Подготовка…" : "Подготовить скачивание"}
				</button>
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
