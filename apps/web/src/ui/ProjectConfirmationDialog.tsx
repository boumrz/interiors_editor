import {
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	useId,
	useLayoutEffect,
	useRef,
} from "react";
import styles from "./ProjectSafety.module.css";

/** A destructive choice blocks the editor until it is cancelled or settled. */
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
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const confirmRef = useRef<HTMLButtonElement>(null);
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
		const active = document.activeElement;
		const next =
			active === cancelRef.current
				? confirmRef.current
				: active === confirmRef.current || !event.shiftKey
					? cancelRef.current
					: confirmRef.current;
		next?.focus();
	};
	return (
		<dialog
			aria-busy={busy}
			aria-describedby={descriptionId}
			aria-label={label}
			className={`${styles.card} ${styles.dialog}`}
			data-testid={testId}
			data-confirm-tone={confirmTone}
			onCancel={(event) => {
				event.preventDefault();
				if (!busy) onCancel();
			}}
			onKeyDown={trapTab}
			ref={dialogRef}
			tabIndex={-1}
		>
			<h2>{title}</h2>
			<div className={styles.message} id={descriptionId}>
				{children}
			</div>
			{error ? (
				<p className={styles.error} role="alert">
					{error}
				</p>
			) : null}
			<div className={styles.actions}>
				<button
					className={
						confirmTone === "primary" ? styles.secondary : styles.primary
					}
					disabled={busy}
					onClick={onCancel}
					ref={cancelRef}
					type="button"
				>
					{cancelLabel}
				</button>
				<button
					className={confirmTone === "primary" ? styles.primary : styles.danger}
					disabled={busy}
					onClick={onConfirm}
					ref={confirmRef}
					type="button"
				>
					{busy ? busyLabel : confirmLabel}
				</button>
			</div>
		</dialog>
	);
}
