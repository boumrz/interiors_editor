import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./EditorLeaveGuard.module.css";

export interface EditorFocusSnapshot {
	readonly element: HTMLElement | null;
	readonly selection?: readonly [number | null, number | null, "forward" | "backward" | "none" | null];
}

export function captureEditorFocus(): EditorFocusSnapshot {
	const element = document.activeElement;
	return {
		element: element instanceof HTMLElement ? element : null,
		...(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? {
			selection: [element.selectionStart, element.selectionEnd, element.selectionDirection] as const,
		} : {}),
	};
}

/** Keeps an existing native dialog and its controlled raw fields mounted. */
export function EditorLeaveGuard({ focus, fallback, onContinue, onDiscard }: {
	readonly focus: EditorFocusSnapshot;
	readonly fallback: HTMLElement | null;
	readonly onContinue: () => void;
	readonly onDiscard: () => void;
}) {
	const [parent] = useState(() => [...document.querySelectorAll("dialog[open]")].at(-1) ?? document.body);
	const overlay = useRef<HTMLDivElement>(null);
	const continueButton = useRef<HTMLButtonElement>(null);
	const discardButton = useRef<HTMLButtonElement>(null);
	useLayoutEffect(() => {
		const backgrounds = parent === document.body ? [document.getElementById("root")] : [...parent.children];
		const prior = backgrounds.flatMap((element) => element instanceof HTMLElement && element !== overlay.current ? [{ element, inert: element.inert }] : []);
		for (const entry of prior) entry.element.inert = true;
		continueButton.current?.focus({ preventScroll: true });
		return () => {
			for (const entry of prior) entry.element.inert = entry.inert;
			requestAnimationFrame(() => {
				const target = focus.element?.isConnected ? focus.element : fallback;
				if (!target?.isConnected) return;
				target.focus({ preventScroll: true });
				if (focus.selection && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
					const [start, end, direction] = focus.selection;
					if (start !== null && end !== null) {
						try { target.setSelectionRange(start, end, direction ?? undefined); } catch { /* Numeric controls expose no text selection. */ }
					}
				}
			});
		};
	}, [parent, focus, fallback]);
	return createPortal(<div ref={overlay} className={styles.overlay}>
		<section className={styles.card} role="alertdialog" aria-modal="true" aria-label="Несохранённая правка" aria-describedby="editor-leave-description" tabIndex={-1} onKeyDown={(event) => {
		if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onContinue(); }
		else if (event.key === "Tab") {
			event.preventDefault(); event.stopPropagation();
			(document.activeElement === continueButton.current ? discardButton.current : continueButton.current)?.focus();
		}
	}}>
			<h2>Продолжить правку?</h2>
			<p id="editor-leave-description">Правка ещё не сохранена. Продолжите работу или явно отмените её.</p>
			<div>
				<button ref={continueButton} type="button" onClick={onContinue}>Продолжить</button>
				<button ref={discardButton} type="button" onClick={onDiscard}>Отменить правку</button>
			</div>
		</section>
	</div>, parent);
}
