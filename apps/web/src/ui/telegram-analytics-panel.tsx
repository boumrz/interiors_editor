import { copy } from "./editor-language";
import {
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { TelegramAnalytics } from "../app/telegram-analytics";
import styles from "./telegram-analytics-panel.module.css";

const ratingLabels = () => [
	copy("1 — Очень неудобно", "1 — Very difficult"),
	copy("2 — Неудобно", "2 — Difficult"),
	copy("3 — Нейтрально", "3 — Neutral"),
	copy("4 — Удобно", "4 — Easy"),
	copy("5 — Очень удобно", "5 — Very easy"),
];

export function TelegramAnalyticsPanel({
	analytics,
}: {
	readonly analytics: TelegramAnalytics;
}) {
	const title = analytics.canRate
		? copy("Статистика и оценка", "Analytics and feedback")
		: copy("Настройки статистики", "Analytics settings");
	const status = useSyncExternalStore(analytics.subscribe, analytics.snapshot);
	const [open, setOpen] = useState(false);
	const toggle = useRef<HTMLButtonElement>(null);
	const panel = useRef<HTMLElement>(null);
	const id = useId();
	const withdrawalFailed = status === "withdrawal-failed";
	const enabled =
		!withdrawalFailed &&
		(status === "on" || status === "connecting" || analytics.hasConsent());
	useEffect(() => {
		if (open) panel.current?.scrollIntoView({ block: "nearest" });
	}, [open]);
	const close = () => {
		setOpen(false);
		toggle.current?.focus();
	};
	return (
		<footer className={styles.root}>
			<button
				className={styles.disclosure}
				data-projects-footer-toggle=""
				type="button"
				aria-expanded={open}
				aria-controls={open ? id : undefined}
				ref={toggle}
				onClick={() => setOpen(!open)}
			>
				{title}
				<span className={styles.chevron} aria-hidden="true" />
			</button>
			{open && (
				<section
					ref={panel}
					id={id}
					className={styles.panel}
					aria-label={title}
				>
					<button
						className={styles.preference}
						type="button"
						role="switch"
						aria-checked={enabled}
						aria-describedby={id + "-purpose"}
						disabled={withdrawalFailed}
						onClick={() => {
							if (enabled) analytics.withdraw();
							else void analytics.enable();
						}}
					>
						{copy("Статистика использования", "Usage analytics")}
						<span className={styles.track} aria-hidden="true" />
					</button>
					<p id={id + "-purpose"} className={styles.caption}>
						{analytics.canRate
							? copy(
									"Статистика и добровольные оценки помогают нам улучшать редактор.",
									"Usage analytics and optional feedback help us improve the editor.",
								)
							: copy(
									"Яндекс Метрика считает открытия редактора. При включении Яндекс видит ваш IP и сведения об устройстве.",
									"Yandex Metrica counts editor launches. When enabled, Yandex can see your IP address and device details.",
								)}
					</p>
					{!analytics.canRate && (
						<details className={styles.details}>
							<summary>
								{copy("Какие данные передаются", "What data is shared")}
							</summary>
							<p>
								{copy(
									"Яндекс получает IP-адрес, сведения о браузере и устройстве, а также идентификаторы посещения. Полный IP в счётчике не сохраняется.",
									"Yandex receives an IP address, browser and device details, and visit identifiers. The analytics counter does not store the full IP address.",
								)}
							</p>
							<p>
								{copy(
									"Мы не отправляем Telegram ID и содержимое проектов. Статистика хранится, пока действует счётчик. По завершении измерений мы запросим её удаление. Выключить сбор можно здесь в любой момент.",
									"We do not send your Telegram ID or project contents. Analytics are stored while the counter is active. We will request deletion when measurement ends. You can turn off collection here at any time.",
								)}
							</p>
						</details>
					)}
					{status === "connecting" && (
						<p role="status">
							{copy("Подключаем статистику…", "Connecting analytics…")}
						</p>
					)}
					{withdrawalFailed && (
						<>
							<p role="status">
								{copy(
									"Сбор остановлен. Не удалось сохранить выбор для следующих запусков.",
									"Collection has stopped. Your preference could not be saved for future launches.",
								)}
							</p>
							<button
								className={styles.retry}
								type="button"
								onClick={analytics.withdraw}
							>
								{copy(
									"Повторить отзыв разрешения",
									"Retry withdrawing consent",
								)}
							</button>
						</>
					)}
					{status === "unavailable" && (
						<p role="status">
							{copy(
								"Статистика недоступна. Редактор работает.",
								"Analytics are unavailable. You can keep using the editor.",
							)}
						</p>
					)}
					{status === "on" && analytics.canRate && (
						<FeedbackForm analytics={analytics} onSkip={close} />
					)}
				</section>
			)}
		</footer>
	);
}

function FeedbackForm({
	analytics,
	onSkip,
}: {
	readonly analytics: TelegramAnalytics;
	readonly onSkip: () => void;
}) {
	const [completed, setCompleted] = useState<boolean>();
	const [rating, setRating] = useState<number>();
	const [delivery, setDelivery] = useState<
		"ready" | "pending" | "sent" | "failed"
	>("ready");
	const group = useId();
	if (delivery === "sent")
		return (
			<p role="status">
				{copy("Спасибо за оценку.", "Thanks for your feedback.")}
			</p>
		);
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				if (
					completed === undefined ||
					rating === undefined ||
					delivery === "pending"
				)
					return;
				setDelivery("pending");
				void analytics
					.submitRating(completed, rating)
					.then((sent) => setDelivery(sent ? "sent" : "failed"));
			}}
		>
			<fieldset disabled={delivery === "pending"}>
				<legend>
					{copy(
						"Удалось собрать планировку?",
						"Were you able to create your floor plan?",
					)}
				</legend>
				<label>
					<input
						type="radio"
						name={`${group}-completed`}
						checked={completed === true}
						onChange={() => setCompleted(true)}
					/>{" "}
					{copy("Да", "Yes")}
				</label>
				<label>
					<input
						type="radio"
						name={`${group}-completed`}
						checked={completed === false}
						onChange={() => setCompleted(false)}
					/>{" "}
					{copy("Нет", "No")}
				</label>
			</fieldset>
			<fieldset disabled={delivery === "pending"}>
				<legend>
					{copy(
						"Насколько удобно было пользоваться редактором?",
						"How easy was the editor to use?",
					)}
				</legend>
				{ratingLabels().map((label, index) => (
					<label key={label}>
						<input
							type="radio"
							name={`${group}-rating`}
							checked={rating === index + 1}
							onChange={() => setRating(index + 1)}
						/>
						{label}
					</label>
				))}
			</fieldset>
			{delivery === "failed" ? (
				<p role="status">
					{copy("Не удалось отправить оценку.", "Could not send feedback.")}
				</p>
			) : null}
			<div className={styles.actions}>
				<button
					type="submit"
					disabled={
						completed === undefined ||
						rating === undefined ||
						delivery === "pending"
					}
				>
					{delivery === "failed"
						? copy("Повторить", "Retry")
						: copy("Отправить", "Send")}
				</button>
				<button type="button" onClick={onSkip}>
					{copy("Пропустить", "Skip")}
				</button>
			</div>
		</form>
	);
}
