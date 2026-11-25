import { copy } from "./editor-language";
import { useSyncExternalStore } from "react";
import type { createTelegramDiagnostics } from "../app/telegram-diagnostics";
import styles from "./telegram-diagnostic-details.module.css";

export type TelegramDiagnosticPort = Pick<
	ReturnType<typeof createTelegramDiagnostics>,
	"snapshot" | "subscribe"
>;
const subscribeToNothing = () => () => undefined;
const noRecord = () => undefined;

export function TelegramDiagnosticDetails({
	diagnostics,
}: {
	readonly diagnostics?: TelegramDiagnosticPort;
}) {
	const snapshot = diagnostics?.snapshot ?? noRecord;
	const record = useSyncExternalStore(
		diagnostics?.subscribe ?? subscribeToNothing,
		snapshot,
		snapshot,
	);
	if (!record) return null;
	return (
		<details className={styles.panel}>
			<summary>{copy("Данные для проверки", "Diagnostics")}</summary>
			<p>
				{copy(
					"Версии приложения и результат проверок. Эти данные не отправляются автоматически.",
					"App versions and check results. This information is not sent automatically.",
				)}
			</p>
			<textarea
				aria-label={copy(
					"Технические данные для проверки",
					"Technical diagnostics",
				)}
				readOnly
				rows={10}
				value={JSON.stringify(record, null, 2)}
			/>
		</details>
	);
}
