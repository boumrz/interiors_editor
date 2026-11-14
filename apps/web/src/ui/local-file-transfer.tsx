import type {
	createHostFileBridge,
	HostFileKind,
	PreparedHostFile,
} from "../adapters/telegram/host-file-bridge";
import styles from "./LocalFileTransfer.module.css";

export type LocalFileTransferPort = ReturnType<typeof createHostFileBridge>;
export type LocalFileTransferState =
	| { readonly kind: "idle" }
	| { readonly kind: "preparing" }
	| {
			readonly kind:
				| "prepared"
				| "handing-off"
				| "handoff-attempted"
				| "unsupported"
				| "failed"
				| "cancelled";
			readonly prepared?: PreparedHostFile;
	  };
type Archive = {
	readonly bytes: Uint8Array;
	readonly filename: string;
	readonly fileKind: HostFileKind;
};

/** A fresh button gesture starts the system operation after asynchronous preparation. */
export class LocalFileTransferSession {
	private state: LocalFileTransferState = { kind: "idle" };
	private operation = new AbortController();
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
		this.update({ kind: "idle" });
	}
	public async prepare(
		produce: (signal: AbortSignal) => Promise<Archive | undefined>,
	): Promise<void> {
		this.close();
		const operation = this.operation;
		this.update({ kind: "preparing" });
		try {
			const archive = await produce(operation.signal);
			if (operation.signal.aborted) return;
			const result = archive
				? this.port.prepare(archive, operation.signal)
				: undefined;
			if (operation.signal.aborted) return;
			this.update(
				result?.kind === "prepared"
					? { kind: "prepared", prepared: result }
					: { kind: "failed" },
			);
		} catch {
			if (!operation.signal.aborted) this.update({ kind: "failed" });
		}
	}
	public async handoff(): Promise<void> {
		if (
			this.state.kind === "idle" ||
			this.state.kind === "preparing" ||
			this.state.kind === "handing-off" ||
			!this.state.prepared
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
}: {
	readonly session: LocalFileTransferSession;
	readonly state: LocalFileTransferState;
}) {
	if (state.kind === "idle") return null;
	const prepared = "prepared" in state ? state.prepared : undefined;
	const busy = state.kind === "preparing" || state.kind === "handing-off";
	const copy =
		state.kind === "handoff-attempted"
			? prepared?.fileKind === "unverified-source" ? "Проверьте файл вне приложения. Системное действие не подтверждает его сохранность. Содержимое записи не проверено; этот файл не восстанавливает проект автоматически." : "Проверьте файл вне приложения. Системное действие не подтверждает сохранность backup; выберите полученный файл для проверки импорта."
			: state.kind === "unsupported"
				? "Передача файла недоступна в этом клиенте. Попробуйте другой поддерживаемый клиент."
				: state.kind === "cancelled"
					? "Передача отменена. Можно повторить попытку."
					: state.kind === "failed"
						? "Не удалось передать файл. Повторите попытку."
						: state.kind === "handing-off"
							? "Передача файла…"
							: state.kind === "preparing"
								? "Подготовка файла…"
								: "Файл готов к передаче. Выберите системное действие и проверьте полученный файл.";
	return (
		<aside
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
				{prepared ? (
					<button
						type="button"
						disabled={busy}
						onClick={() => void session.handoff()}
					>
						{state.kind === "prepared"
							? "Передать файл"
							: state.kind === "handing-off"
								? "Передача файла…"
								: "Повторить передачу"}
					</button>
				) : null}
			</div>
		</aside>
	);
}
