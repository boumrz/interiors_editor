import {
	type ComponentPropsWithRef,
	type KeyboardEvent,
	useLayoutEffect,
	useRef,
} from "react";
import styles from "./SheetHeader.module.css";

type EditorModalSheetProps = ComponentPropsWithRef<"aside"> & {
	readonly telegramModal: boolean;
	readonly busy?: boolean;
	readonly onRequestClose: () => void;
	readonly restoreFocus?: () => HTMLElement | null;
};

function focusableControls(sheet: HTMLElement) {
	return Array.from(
		sheet.querySelectorAll<HTMLElement>(
			'button, input, select, textarea, a[href], [tabindex], summary, [contenteditable="true"]',
		),
	).filter(
		(control) =>
			control.tabIndex >= 0 &&
			!control.matches(":disabled") &&
			!control.closest("[inert]") &&
			control.getClientRects().length > 0,
	);
}

export function EditorModalSheet({
	telegramModal,
	busy = false,
	onRequestClose,
	restoreFocus,
	children,
	className,
	onKeyDown,
	ref,
	...props
}: EditorModalSheetProps) {
	const sheetRef = useRef<HTMLElement | null>(null);
	const backdropRef = useRef<HTMLDivElement | null>(null);
	const focusFallback = useRef(restoreFocus);

	useLayoutEffect(() => {
		focusFallback.current = restoreFocus;
	}, [restoreFocus]);

	useLayoutEffect(() => {
		const sheet = sheetRef.current;
		if (!telegramModal || !sheet) return;
		const active = document.activeElement;
		const blocked: Element[] = [];
		// Isolation ends at the editor. Recovery and draft confirmations can
		// still use their body portal, and native dialogs use the top layer.
		const editor = sheet.closest('main[data-editor-host="telegram"]');
		for (
			let branch: Element = sheet;
			editor?.contains(branch) && branch !== editor && branch.parentElement;
			branch = branch.parentElement
		) {
			for (const sibling of branch.parentElement.children) {
				if (
					sibling === branch ||
					sibling === backdropRef.current ||
					sibling.hasAttribute("inert")
				)
					continue;
				sibling.setAttribute("inert", "");
				blocked.push(sibling);
			}
		}
		if (!sheet.contains(document.activeElement)) {
			(focusableControls(sheet)[0] ?? sheet).focus({ preventScroll: true });
		}
		return () => {
			for (const sibling of blocked) sibling.removeAttribute("inert");
			queueMicrotask(() => {
				if (
					document.activeElement !== document.body &&
					!sheet.contains(document.activeElement)
				)
					return;
				const target =
					active instanceof HTMLElement &&
					active !== document.body &&
					!sheet.contains(active) &&
					active.isConnected &&
					active.getClientRects().length > 0
						? active
						: focusFallback.current?.();
				target?.focus({ preventScroll: true });
			});
		};
	}, [telegramModal]);

	useLayoutEffect(() => {
		const sheet = sheetRef.current;
		const active = document.activeElement;
		if (
			telegramModal &&
			busy &&
			sheet &&
			(active === document.body ||
				(sheet.contains(active) && active?.matches(":disabled")))
		) {
			sheet.focus({ preventScroll: true });
		}
	}, [busy, telegramModal]);

	function onSheetKeyDown(event: KeyboardEvent<HTMLElement>) {
		if (!telegramModal) {
			onKeyDown?.(event);
			return;
		}
		if (
			event.defaultPrevented ||
			(event.key !== "Tab" && event.key !== "Escape")
		)
			return;
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			onRequestClose();
			return;
		}
		const controls = focusableControls(event.currentTarget);
		const first = controls[0];
		const last = controls.at(-1);
		if (!first) {
			event.preventDefault();
			return;
		}
		if (
			event.shiftKey &&
			(document.activeElement === first ||
				document.activeElement === event.currentTarget)
		) {
			event.preventDefault();
			last?.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	return (
		<>
			{telegramModal ? (
				<div
					aria-hidden="true"
					className={styles.editorBackdrop}
					ref={backdropRef}
				/>
			) : null}
			<aside
				{...props}
				{...(telegramModal ? { role: "dialog", "aria-modal": true } : {})}
				className={
					telegramModal
						? `${className ?? ""} ${styles.dialog} ${styles.telegramDialog} ${styles.editorDialog}`
						: className
				}
				data-telegram-modal-sheet={telegramModal || undefined}
				onKeyDown={onSheetKeyDown}
				ref={(element) => {
					sheetRef.current = element;
					if (typeof ref === "function") return ref(element);
					if (ref) ref.current = element;
				}}
				tabIndex={telegramModal ? -1 : props.tabIndex}
			>
				{children}
			</aside>
		</>
	);
}
