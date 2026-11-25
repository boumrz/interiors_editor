import { copy } from "./editor-language";
import {
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	useId,
	useLayoutEffect,
	useRef,
} from "react";
import styles from "./ProjectSafety.module.css";
import { SheetHeader } from "./SheetHeader";
import sheetStyles from "./SheetHeader.module.css";
import { TelegramSheetFrame } from "./TelegramSheetFrame";

/** Keep the modal open while its action is pending. */
export function ProjectConfirmationDialog({
	label,
	title,
	children,
	cancelLabel,
	confirmLabel,
	busyLabel,
	busy,
	error,
	onCancel,
	onConfirm,
	returnFocusRef,
	fallbackFocusRef,
	testId,
	confirmTone = "danger",
	plainLabels = false,
}: {
	readonly label: string;
	readonly title: string;
	readonly children: ReactNode;
	readonly cancelLabel: string;
	readonly confirmLabel: string;
	readonly busyLabel: string;
	readonly busy: boolean;
	readonly error?: string;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
	readonly returnFocusRef: RefObject<HTMLElement | null>;
	readonly fallbackFocusRef: RefObject<HTMLElement | null>;
	readonly testId?: string;
	readonly confirmTone?: "danger" | "primary";
	readonly plainLabels?: boolean;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const descriptionId = useId();
	useLayoutEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		dialog.showModal();
		cancelRef.current?.focus({ preventScroll: true });
		return () => {
			dialog.close();
			requestAnimationFrame(() => {
				// StrictMode may already have opened this same node again. A new
				// screen may also have placed focus, for example on Projects.
				if (dialog.isConnected) return;
				const active = document.activeElement;
				if (
					active instanceof HTMLElement &&
					active !== document.body &&
					active.getClientRects().length &&
					!active.matches(":disabled")
				)
					return;
				for (const target of [
					returnFocusRef.current,
					fallbackFocusRef.current,
				]) {
					if (
						target?.isConnected &&
						target.getClientRects().length &&
						!target.matches(":disabled")
					) {
						target.focus({ preventScroll: true });
						break;
					}
				}
			});
		};
	}, [returnFocusRef, fallbackFocusRef]);
	useLayoutEffect(() => {
		if (busy) dialogRef.current?.focus({ preventScroll: true });
		else cancelRef.current?.focus({ preventScroll: true });
	}, [busy]);
	const trapTab = (event: KeyboardEvent<HTMLDialogElement>) => {
		if (event.key !== "Tab") return;
		event.preventDefault();
		if (busy) {
			dialogRef.current?.focus({ preventScroll: true });
			return;
		}
		const controls = Array.from(
			event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")
		);
		const current = controls.findIndex((control) => control === document.activeElement);
		const next = current < 0
			? event.shiftKey ? controls.at(-1) : controls[0]
			: controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length];
		next?.focus();
	};
	const content = (
		<>
			{children ? <div className={styles.message} id={descriptionId}>{children}</div> : null}
			{error ? <p className={styles.error} role="alert">{error}</p> : null}
		</>
	);
	return (
		<TelegramSheetFrame
			as="dialog"
			telegram={plainLabels}
			compact
			busy={busy}
			aria-busy={busy}
			aria-describedby={children ? descriptionId : undefined}
			aria-label={label}
			className={plainLabels ? styles.telegramConfirmation : `${styles.card} ${styles.dialog}`}
			data-testid={testId}
			data-confirm-tone={confirmTone}
			data-telegram-confirmation={plainLabels || undefined}
			onCancel={(event) => {
				event.preventDefault();
				if (!busy) onCancel();
			}}
			onKeyDown={trapTab}
			ref={dialogRef}
			tabIndex={-1}
		>
			{plainLabels ? (
				<SheetHeader
					title={title}
					closeLabel={copy("Закрыть подтверждение", "Close confirmation")}
					closeDisabled={busy}
					onClose={onCancel}
				/>
			) : <h2>{title}</h2>}
			{plainLabels ? <div className={sheetStyles.body}>{content}</div> : content}
			<div className={plainLabels ? `${sheetStyles.footer} ${styles.actions} ${styles.sheetActions}` : styles.actions}>
				<button
					className={
						plainLabels || confirmTone === "primary" ? styles.secondary : styles.primary
					}
					disabled={busy}
					onClick={onCancel}
					ref={cancelRef}
					type="button"
				>
					{plainLabels ? copy("Отменить", "Cancel") : cancelLabel}
				</button>
				<button
					className={plainLabels || confirmTone === "primary" ? styles.primary : styles.danger}
					disabled={busy}
					onClick={onConfirm}
					type="button"
				>
					{busy
						? busyLabel
						: plainLabels
							? copy("Подтвердить", "Confirm")
							: confirmLabel}
				</button>
			</div>
		</TelegramSheetFrame>
	);
}
