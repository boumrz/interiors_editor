import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorModalSheet } from "./EditorModalSheet";
import { ProjectConfirmationDialog } from "./ProjectConfirmationDialog";

const close = () => undefined;

it("shows Telegram modal contents in a fixed bottom sheet without a height action", () => {
	const markup = renderToStaticMarkup(
		<EditorModalSheet telegramModal onRequestClose={close}>
			<button type="button">Дверь</button>
		</EditorModalSheet>,
	);
	expect(markup).not.toContain('aria-label="Развернуть"');
	expect(markup).not.toContain("data-telegram-sheet-expanded");
	expect(markup).toContain('data-telegram-bottom-sheet="full"');
	expect(markup).toContain("Дверь");
	expect(markup).toContain('aria-modal="true"');
});

it("uses the Telegram sheet shell for a compact action without making the plan inert", () => {
	const compact = { telegramSheet: true };
	const markup = renderToStaticMarkup(
		<EditorModalSheet telegramModal={false} {...compact} onRequestClose={close}>
			<button type="button">Подтвердить</button>
		</EditorModalSheet>,
	);
	expect(markup).toContain('data-telegram-bottom-sheet="compact"');
	expect(markup).not.toContain("aria-modal");
	expect(markup).not.toContain('aria-label="Развернуть"');
});

it("puts Telegram confirmations on the common shell while preserving the standard browser dialog", () => {
	const confirmation = {
		label: "Удалить предмет",
		title: "Удалить предмет?",
		cancelLabel: "Оставить предмет",
		confirmLabel: "Удалить предмет",
		busyLabel: "Удаляем…",
		busy: false,
		onCancel: close,
		onConfirm: close,
		returnFocusRef: { current: null },
		fallbackFocusRef: { current: null },
	};
	const telegram = renderToStaticMarkup(<ProjectConfirmationDialog {...confirmation} plainLabels><p>Шкаф</p></ProjectConfirmationDialog>);
	const browser = renderToStaticMarkup(<ProjectConfirmationDialog {...confirmation}><p>Шкаф</p></ProjectConfirmationDialog>);
	expect(telegram).toContain('data-telegram-bottom-sheet="compact"');
	expect(telegram).not.toContain('aria-label="Развернуть"');
	expect(browser).not.toContain("data-telegram-bottom-sheet");
});
