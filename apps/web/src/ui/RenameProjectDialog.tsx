import { type FormEvent, type KeyboardEvent, type RefObject, useId, useLayoutEffect, useRef } from "react";
import safety from "./ProjectSafety.module.css";
import styles from "./RenameProjectDialog.module.css";
import { SheetHeader } from "./SheetHeader";
import sheetStyles from "./SheetHeader.module.css";
import { TelegramSheetFrame } from "./TelegramSheetFrame";

export function RenameProjectDialog({ name, error, busy, blocked, canRetry, onChange, onSubmit, onRetry, onCancel, onBackdropClose, returnFocusRef, telegram }: {
	readonly name: string;
	readonly error?: string;
	readonly busy: boolean;
	readonly blocked: boolean;
	readonly canRetry: boolean;
	readonly onChange: (value: string) => void;
	readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	readonly onRetry: () => void;
	readonly onCancel: () => void;
	readonly onBackdropClose?: () => void;
	readonly returnFocusRef: RefObject<HTMLElement | null>;
	readonly telegram?: boolean;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const input = useRef<HTMLInputElement>(null);
	const errorRef = useRef<HTMLParagraphElement>(null);
	const id = useId();
	useLayoutEffect(() => {
		const element = dialog.current;
		if (!element) return;
		element.showModal();
		input.current?.focus({ preventScroll: true });
		return () => {
			element.close();
			requestAnimationFrame(() => {
				if (element.isConnected) return;
				const active = document.activeElement;
				if (active instanceof HTMLElement && active !== document.body && active.getClientRects().length && !active.matches(":disabled")) return;
				returnFocusRef.current?.focus({ preventScroll: true });
			});
		};
	}, [returnFocusRef]);
	useLayoutEffect(() => {
		if (busy) dialog.current?.focus({ preventScroll: true });
		else if (error) errorRef.current?.focus({ preventScroll: true });
		else input.current?.focus({ preventScroll: true });
	}, [busy, error]);
	const trapTab = (event: KeyboardEvent<HTMLDialogElement>) => {
		if (event.key !== "Tab") return;
		const controls = [...(dialog.current?.querySelectorAll<HTMLElement>("input:not(:disabled),button:not(:disabled)") ?? [])];
		const current = controls.indexOf(document.activeElement as HTMLElement);
		event.preventDefault();
		if (!controls.length) { dialog.current?.focus(); return; }
		controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
	};
	const fields = <>
		<label htmlFor={`${id}-name`}>Новое название проекта</label>
		<input ref={input} id={`${id}-name`} value={name} autoComplete="off" disabled={blocked} aria-invalid={error ? "true" : undefined} aria-describedby={error ? "rename-project-error" : undefined} onChange={event => onChange(event.target.value)} />
		{error ? <p ref={errorRef} className={safety.error} id="rename-project-error" role="alert" tabIndex={-1}>{error}</p> : null}
	</>;
	const shell = telegram
		? styles.telegram
		: `${safety.card} ${safety.dialog}`;
	return <TelegramSheetFrame as="dialog" telegram={telegram} busy={busy} onBackdropClose={onBackdropClose} ref={dialog} aria-labelledby={`${id}-heading`} aria-busy={busy} className={`${shell} ${styles.dialog}`} data-testid="rename-project-sheet" tabIndex={-1}
		onKeyDown={trapTab} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
		{telegram ? <SheetHeader
			title="Переименовать проект"
			titleId={`${id}-heading`}
			closeLabel="Закрыть переименование"
			closeDisabled={busy}
			onClose={onCancel}
		/> : <h2 id={`${id}-heading`}>Переименовать проект</h2>}
		<form noValidate onSubmit={onSubmit}>
			{telegram ? <div className={`${sheetStyles.body} ${styles.fields}`}>{fields}</div> : fields}
			<div className={telegram ? `${styles.actions} ${safety.actions} ${sheetStyles.footer} ${safety.sheetActions}` : `${styles.actions} ${safety.actions}`}>
				<button className={safety.primary} disabled={blocked} type="submit">{busy ? "Сохраняем…" : "Сохранить название"}</button>
				{canRetry ? <button disabled={busy} onClick={onRetry} type="button">Повторить сохранение</button> : null}
				<button disabled={busy} onClick={onCancel} type="button">Отмена</button>
			</div>
		</form>
	</TelegramSheetFrame>;
}
