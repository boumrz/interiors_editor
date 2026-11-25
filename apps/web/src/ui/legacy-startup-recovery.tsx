import { copy } from "./editor-language";
import { useState } from "react";
import type { ReleaseRecoveryRecord } from "../app/release-startup";
import { prepareUnverifiedSourceFile } from "./stored-source-recovery";
import styles from "./stored-source-recovery.module.css";
import layout from "./legacy-startup-recovery.module.css";

/** The old startup coordinator exposes source text, never a verified Revision address. */
export function prepareLegacyStartupRecoveryFile(
	recovery: ReleaseRecoveryRecord | undefined,
	maximumBytes?: number,
) {
	if (
		typeof recovery?.serializedProject !== "string" ||
		(recovery.projectId !== undefined && typeof recovery.projectId !== "string")
	)
		return { kind: "unavailable" } as const;
	try {
		return prepareUnverifiedSourceFile(
			{
				kind: "unverified-source",
				projectId: recovery.projectId ?? "",
				// Empty means unknown in this unverified wrapper. It is never used to address a Project.
				revisionId: "",
				serializedProject: recovery.serializedProject,
			},
			maximumBytes,
		);
	} catch {
		return { kind: "preparation-failed" } as const;
	}
}

export function LegacyStartupRecoveryNotice({
	getRecovery,
	presentation = "inline",
}: {
	readonly getRecovery?: () => ReleaseRecoveryRecord | undefined;
	readonly presentation?: "inline" | "floating";
}) {
	const recovery = getRecovery?.();
	const [error, setError] = useState<string>();
	if (recovery === undefined) return null;
	const readable = typeof recovery.serializedProject === "string";
	const download = () => {
		const current = getRecovery?.();
		if (
			current === undefined ||
			current.projectId !== recovery.projectId ||
			current.serializedProject !== recovery.serializedProject
		) {
			setError(
				copy(
					"Исходная запись изменилась. Проверьте её и повторите скачивание.",
					"The source record changed. Check it and try downloading again.",
				),
			);
			return;
		}
		const prepared = prepareLegacyStartupRecoveryFile(current);
		if (prepared.kind !== "prepared-source") {
			setError(
				prepared.kind === "too-large"
					? copy(
							"Исходная запись слишком велика для локального файла. Она остаётся в хранилище.",
							"The source record is too large to save as a local file. It remains in storage.",
						)
					: prepared.kind === "preparation-failed"
						? copy(
								"Не удалось скачать исходную запись. Повторите попытку.",
								"Could not download the source record. Try again.",
							)
						: copy(
								"Доступной исходной записи для скачивания нет.",
								"No source record is available to download.",
							),
			);
			return;
		}
		try {
			const url = URL.createObjectURL(
				new Blob([Uint8Array.from(prepared.bytes).buffer], {
					type: prepared.mimeType,
				}),
			);
			try {
				const link = document.createElement("a");
				link.href = url;
				link.download = prepared.filename;
				link.click();
				setError(undefined);
			} finally {
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			}
		} catch {
			setError(
				copy(
					"Не удалось скачать исходную запись. Повторите попытку.",
					"Could not download the source record. Try again.",
				),
			);
		}
	};
	const contents = (
		<>
			<p>
				{copy(
					"Часть данных Web/PWA требует восстановления. Доступные проекты из другого хранилища можно продолжать использовать.",
					"Some Web/PWA data requires recovery. Available projects in other storage can still be used.",
				)}
			</p>
			{readable ? (
				<>
					<p>
						{copy(
							"Файл содержит исходный текст записи без моделей и ресурсов проекта.",
							"This file contains the original record text without project models or resources.",
						)}
					</p>
					<button type="button" onClick={download}>
						{copy("Сохранить исходную запись", "Save source record")}
					</button>
				</>
			) : (
				<p>
					{copy(
						"Доступной исходной записи для скачивания нет.",
						"No source record is available to download.",
					)}
				</p>
			)}
			{error ? <p role="alert">{error}</p> : null}
		</>
	);
	return presentation === "floating" ? (
		<details
			className={`${styles.panel} ${layout.floating}`}
			data-testid="legacy-startup-recovery"
		>
			<summary>
				{copy("Исходная запись Web/PWA", "Web/PWA source record")}
			</summary>
			{contents}
		</details>
	) : (
		<aside className={styles.panel} data-testid="legacy-startup-recovery">
			<h2>{copy("Исходная запись Web/PWA", "Web/PWA source record")}</h2>
			{contents}
		</aside>
	);
}
