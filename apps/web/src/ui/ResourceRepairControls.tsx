import { copy } from "./editor-language";
import { useRef } from "react";
import styles from "./ProjectSafety.module.css";

/** Exact resource repair is available for the current Project and either history branch. */
export function ResourceRepairControls({ busy, error, onGlbFiles, onBackupFile, telegram }: {
	readonly busy: boolean;
	readonly error?: string;
	readonly onGlbFiles: (files: FileList | null) => void;
	readonly onBackupFile: (file: File | undefined) => void;
	readonly telegram: boolean;
}) {
	const models = useRef<HTMLInputElement>(null);
	const backup = useRef<HTMLInputElement>(null);
	return (
		<div className={styles.actions}>
			<input
				hidden
				ref={models}
				type="file"
				accept=".glb,model/gltf-binary"
				multiple
				aria-label={copy(
					"Выбрать исходные GLB-модели для восстановления",
					"Choose original GLB files for recovery",
				)}
				disabled={busy}
				onChange={(event) => {
					onGlbFiles(event.currentTarget.files);
					event.currentTarget.value = "";
				}}
			/>
			<input
				hidden
				ref={backup}
				type="file"
				accept={
					telegram
						? undefined
						: ".interiors,application/zip,application/octet-stream"
				}
				aria-label={copy(
					"Выбрать резервную копию для восстановления моделей",
					"Choose a backup to recover models",
				)}
				disabled={busy}
				onChange={(event) => {
					onBackupFile(event.currentTarget.files?.[0]);
					event.currentTarget.value = "";
				}}
			/>
			<button
				className={styles.primary}
				disabled={busy}
				onClick={() => models.current?.click()}
				type="button"
			>
				{busy
					? copy("Проверяем модели…", "Checking models…")
					: copy("Восстановить исходные GLB", "Recover original GLB files")}
			</button>
			<button
				disabled={busy}
				onClick={() => backup.current?.click()}
				type="button"
			>
				{copy(
					"Восстановить модели из резервной копии",
					"Recover models from a backup",
				)}
			</button>
			{error ? (
				<p className={styles.error} role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
