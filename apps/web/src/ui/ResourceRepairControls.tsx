import { useRef } from "react";
import styles from "./ProjectSafety.module.css";

/** Exact resource repair is available for the current Project and either history branch. */
export function ResourceRepairControls({ busy, error, onGlbFiles, onBackupFile }: {
	readonly busy: boolean;
	readonly error?: string;
	readonly onGlbFiles: (files: FileList | null) => void;
	readonly onBackupFile: (file: File | undefined) => void;
}) {
	const models = useRef<HTMLInputElement>(null);
	const backup = useRef<HTMLInputElement>(null);
	return <div className={styles.actions}>
		<input hidden ref={models} type="file" accept=".glb,model/gltf-binary" multiple aria-label="Выбрать исходные GLB-модели для восстановления" disabled={busy}
			onChange={event => { onGlbFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
		<input hidden ref={backup} type="file" accept=".interiors,application/zip,application/octet-stream" aria-label="Выбрать резервную копию для восстановления моделей" disabled={busy}
			onChange={event => { onBackupFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
		<button className={styles.primary} disabled={busy} onClick={() => models.current?.click()} type="button">{busy ? "Проверяем модели…" : "Восстановить исходные GLB"}</button>
		<button disabled={busy} onClick={() => backup.current?.click()} type="button">Восстановить модели из резервной копии</button>
		{error ? <p className={styles.error} role="alert">{error}</p> : null}
	</div>;
}
