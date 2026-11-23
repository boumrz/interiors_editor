import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectConfirmationDialog } from "./ProjectConfirmationDialog";

it.each([
	[undefined, false, "Удалить навсегда", "Оставить проект"],
	[true, false, "Подтвердить", "Отменить"],
	[false, false, "Удалить навсегда", "Оставить проект"],
	[true, true, "Удаляем…", "Отменить"],
	[false, true, "Удаляем…", "Оставить проект"],
] as const)("keeps the action and busy wording for plain=%s busy=%s", (plainLabels, busy, confirmation, cancellation) => {
	const markup = renderToStaticMarkup(<ProjectConfirmationDialog
		label="Удалить проект" title="Удалить проект навсегда?"
		plainLabels={plainLabels} busy={busy} busyLabel="Удаляем…"
		confirmLabel="Удалить навсегда" cancelLabel="Оставить проект"
		onCancel={() => undefined} onConfirm={() => undefined}
		returnFocusRef={{ current: null }} fallbackFocusRef={{ current: null }}
	><p>Проект «Кухня». Это действие нельзя отменить.</p></ProjectConfirmationDialog>);
	expect(markup).toContain(`>${confirmation}</button>`);
	expect(markup).toContain(`>${cancellation}</button>`);
	expect(markup).toContain("Проект «Кухня». Это действие нельзя отменить.");
	if (plainLabels) expect(markup).not.toContain("Оставить проект");
});
