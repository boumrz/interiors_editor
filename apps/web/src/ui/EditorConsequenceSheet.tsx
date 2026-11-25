import { copy } from "./editor-language";
import { type ReactNode, useId } from "react";
import { EditorModalSheet } from "./EditorModalSheet";
import { SheetHeader } from "./SheetHeader";
import styles from "./SheetHeader.module.css";

export function EditorConsequenceSheet({
	title,
	closeLabel,
	confirmLabel,
	busy,
	blocked,
	error,
	testId,
	onCancel,
	onConfirm,
	restoreFocus,
	children,
}: {
	readonly title: string;
	readonly closeLabel: string;
	readonly confirmLabel: string;
	readonly busy: boolean;
	readonly blocked: boolean;
	readonly error?: string;
	readonly testId: string;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
	readonly restoreFocus?: () => HTMLElement | null;
	readonly children: ReactNode;
}) {
	const titleId = useId();
	const cancel = () => { if (!busy) onCancel(); };
	return (
		<EditorModalSheet
			telegramModal
			aria-labelledby={titleId}
			busy={busy}
			className={styles.consequenceSheet}
			data-testid={testId}
			onRequestClose={cancel}
			restoreFocus={restoreFocus}
		>
			<SheetHeader title={title} titleId={titleId} closeLabel={closeLabel} closeDisabled={busy} onClose={cancel} />
			<div className={styles.consequenceBody}>
				{children}
				{error ? <p role="alert">{error}</p> : null}
			</div>
			<footer className={`${styles.footer} ${styles.consequenceActions}`}>
				<button
					type="button"
					data-editor-action="cancel"
					data-sheet-initial-focus=""
					disabled={busy}
					onClick={cancel}
				>
					{copy("Отменить", "Cancel")}
				</button>
				<button
					type="button"
					data-editor-action="confirm"
					disabled={busy || blocked}
					onClick={onConfirm}
				>
					{confirmLabel}
				</button>
			</footer>
		</EditorModalSheet>
	);
}
