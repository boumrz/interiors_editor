import { useEffect, useRef } from "react";
import styles from "./ProjectSafety.module.css";

/** The download deliberately uses the last durable revision; retry retains
 * ownership of the unpublished change in the existing controller. */
export function SaveFailureNotice({
	actionLabel,
	description,
	exportError,
	onExport,
	onRecoveryExport,
	onRetry,
}: {
	readonly actionLabel: string;
	readonly description: string;
	readonly exportError?: string;
	readonly onExport: () => void;
	readonly onRecoveryExport?: () => void;
	readonly onRetry: () => void;
}) {
	const retryRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		const previous = document.activeElement;
		retryRef.current?.focus({ preventScroll: true });
		return () => {
			requestAnimationFrame(() => {
				// StrictMode can repeat setup before this callback runs. Also leave
				// focus alone if another surface or the person has already moved it.
				if (retryRef.current?.isConnected ||
					(document.activeElement !== document.body && document.activeElement !== previous)) return;
				if (
					previous instanceof HTMLElement &&
					previous.isConnected &&
					previous.getClientRects().length > 0 &&
					!previous.matches(":disabled")
				) {
					previous.focus({ preventScroll: true });
				}
			});
		};
	}, []);
	return (
		<aside
			aria-label="Ошибка сохранения"
			className={`${styles.card} ${styles.floating} ${styles.saveFailure}`}
			data-testid="persistence-failure-notice"
		>
			<div className={styles.message} role="alert">
				<h2>Не удалось сохранить</h2>
				<p>{description}</p>
			</div>
			<p className={styles.context}>
                Открыта последняя сохранённая версия. Несохранённую правку можно скачать отдельным файлом для восстановления.
			</p>
			<div className={styles.actions}>
				<button
					className={styles.primary}
					onClick={onRetry}
					ref={retryRef}
					type="button"
				>
					{actionLabel}
				</button>
                {onRecoveryExport ? <button onClick={onRecoveryExport} type="button">Скачать несохранённую правку</button> : null}
				<button onClick={onExport} type="button">
					Скачать сохранённую версию
				</button>
			</div>
			{exportError ? (
				<p className={styles.error} role="alert">
					{exportError}
				</p>
			) : null}
		</aside>
	);
}
