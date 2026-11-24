import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import type { UsageMetrics } from "../app/telegram-usage-metrics";
import { LegalDocumentLink } from "./LegalDocumentLink";
import { SheetHeader } from "./SheetHeader";
import sheetStyles from "./SheetHeader.module.css";
import { TelegramSheetFrame } from "./TelegramSheetFrame";
import styles from "./telegram-usage-dialog.module.css";

function StatisticsSwitch({
	label,
	accessibleName,
	checked,
	disabled,
	onChange,
}: {
	readonly label: string;
	readonly accessibleName?: string;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly onChange: (checked: boolean) => void;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={accessibleName}
			className={styles.toggle}
			disabled={disabled}
			onClick={() => onChange(!checked)}
		>
			{label}
			<span className={styles.track} aria-hidden="true" />
		</button>
	);
}

export function TelegramUsageDialog({
	metrics,
}: {
	readonly metrics: UsageMetrics;
}) {
	const state = useSyncExternalStore(
		metrics.subscribe,
		metrics.snapshot,
		metrics.snapshot,
	);
	const ref = useRef<HTMLDialogElement>(null);
	const heading = useRef<HTMLHeadingElement>(null);
	const id = useId();
	const visible = state.view !== "closed";
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog || !visible) return;
		const trigger = document.activeElement;
		dialog.showModal();
		heading.current?.focus({ preventScroll: true });
		return () => {
			dialog.close();
			if (trigger instanceof HTMLElement && trigger.isConnected)
				trigger.focus({ preventScroll: true });
		};
	}, [visible]);
	if (!visible) return null;
	return (
		<TelegramSheetFrame
			as="dialog"
			telegram
			busy={state.busy}
			ref={ref}
			aria-labelledby={id}
			aria-busy={state.busy}
			onCancel={(event) => {
				event.preventDefault();
				metrics.closeSettings();
			}}
		>
			<SheetHeader
				title="Статистика"
				titleId={id}
				titleRef={heading}
				titleTabIndex={-1}
				closeLabel="Закрыть статистику"
				onClose={metrics.closeSettings}
			/>
			<div className={`${sheetStyles.body} ${styles.content}`}>
				<p>Статистика помогает улучшать сервис.</p>
				<StatisticsSwitch
					label="Делиться статистикой"
					checked={state.aggregateEnabled}
					disabled={state.busy}
					onChange={(checked) => void metrics.setAggregate(checked)}
				/>
				{state.aggregateEnabled ? (
					<section className={styles.additional} aria-labelledby={`${id}-additional`}>
						<h3 id={`${id}-additional`}>Дополнительная статистика</h3>
						<LegalDocumentLink telegram documentName="analytics-consent">
							Согласие на дополнительную статистику
						</LegalDocumentLink>
						{state.studyOpen ? (
							<>
								<StatisticsSwitch
									label="Разрешить"
									accessibleName="Разрешить дополнительную статистику"
									checked={state.permission === "granted"}
									disabled={state.busy}
									onChange={(checked) => void metrics.choose(checked)}
								/>
								{state.permission === "unknown" && (
									<button
										type="button"
										className={styles.decline}
										onClick={() => void metrics.choose(false)}
										disabled={state.busy}
									>
										Отказаться
									</button>
								)}
							</>
						) : (
							<p>Дополнительная статистика выключена.</p>
						)}
					</section>
				) : (
					<p>Статистика выключена.</p>
				)}
				{state.error && (
					<p role="alert">
						Не удалось проверить или сохранить настройки. Отправка статистики
						приостановлена. Повторите действие перед выходом.
					</p>
				)}
			</div>
		</TelegramSheetFrame>
	);
}
