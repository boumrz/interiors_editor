import { copy } from "./editor-language";
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
				title={copy("Статистика", "Analytics")}
				titleId={id}
				titleRef={heading}
				titleTabIndex={-1}
				closeLabel={copy("Закрыть статистику", "Close analytics")}
				onClose={metrics.closeSettings}
			/>
			<div className={`${sheetStyles.body} ${styles.content}`}>
				<p>
					{copy(
						"Статистика помогает улучшать сервис.",
						"Analytics help improve the service.",
					)}
				</p>
				<StatisticsSwitch
					label={copy("Делиться статистикой", "Share analytics")}
					checked={state.aggregateEnabled}
					disabled={state.busy}
					onChange={(checked) => void metrics.setAggregate(checked)}
				/>
				{state.aggregateEnabled ? (
					<section
						className={styles.additional}
						aria-labelledby={`${id}-additional`}
					>
						<h3 id={`${id}-additional`}>
							{copy("Дополнительная статистика", "Additional analytics")}
						</h3>
						<LegalDocumentLink telegram documentName="analytics-consent">
							{copy(
								"Согласие на дополнительную статистику",
								"Consent for additional analytics",
							)}
						</LegalDocumentLink>
						{state.studyOpen ? (
							<>
								<StatisticsSwitch
									label={copy("Разрешить", "Allow")}
									accessibleName={copy(
										"Разрешить дополнительную статистику",
										"Allow additional analytics",
									)}
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
										{copy("Отказаться", "Decline")}
									</button>
								)}
							</>
						) : (
							<p>
								{copy(
									"Дополнительная статистика выключена.",
									"Additional analytics are off.",
								)}
							</p>
						)}
					</section>
				) : (
					<p>{copy("Статистика выключена.", "Analytics are off.")}</p>
				)}
				{state.aggregateEnabled && state.productAvailable && (
					<section className={styles.additional} aria-labelledby={`${id}-product`}>
						<h3 id={`${id}-product`}>
							{copy("Использование и ошибки редактора", "Editor usage and errors")}
						</h3>
						<p>{copy(
							"По вашему разрешению мы считаем запуски с действиями и ошибками редактора. Яндекс Метрика получает общие суммы по кодам за каждый двухчасовой интервал. Вы можете отключить этот учёт здесь.",
							"With your permission, we count launches where editor actions and errors occur. Yandex Metrica receives totals for each two-hour interval, grouped by code. You can turn off this counting here.",
						)}</p>
						<LegalDocumentLink telegram documentName="product-analytics-consent">
							{copy("Согласие на статистику использования и ошибок", "Consent for usage and error analytics")}
						</LegalDocumentLink>
						<StatisticsSwitch
							label={copy("Разрешить", "Allow")}
							accessibleName={copy("Разрешить статистику использования и ошибок", "Allow usage and error analytics")}
							checked={state.productGranted}
							disabled={state.busy}
							onChange={(checked) => void metrics.chooseProduct(checked)}
						/>
					</section>
				)}
				{state.error && (
					<p role="alert">
						{copy(
							"Не удалось проверить или сохранить настройки. Отправка статистики приостановлена. Повторите действие перед выходом.",
							"Could not verify or save your settings. Analytics are paused. Try again before leaving.",
						)}
					</p>
				)}
			</div>
		</TelegramSheetFrame>
	);
}
