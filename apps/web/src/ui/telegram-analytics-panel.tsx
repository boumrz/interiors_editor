import {
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { TelegramAnalytics } from "../app/telegram-analytics";
import styles from "./telegram-analytics-panel.module.css";

const ratingLabels = [
	"1 — Очень неудобно",
	"2 — Неудобно",
	"3 — Нейтрально",
	"4 — Удобно",
	"5 — Очень удобно",
];

export function TelegramAnalyticsPanel({
	analytics,
}: {
	readonly analytics: TelegramAnalytics;
}) {
	const title = analytics.canRate
		? "Статистика и оценка"
		: "Настройки статистики";
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
						Статистика использования
						<span className={styles.track} aria-hidden="true" />
					</button>
					<p id={id + "-purpose"} className={styles.caption}>
						{analytics.canRate
							? "Статистика и добровольные оценки помогают нам улучшать редактор."
							: "Яндекс Метрика считает открытия редактора. При включении Яндекс видит ваш IP и сведения об устройстве."}
					</p>
					{!analytics.canRate && (
						<details className={styles.details}>
							<summary>Какие данные передаются</summary>
							<p>
								Яндекс получает IP-адрес, сведения о браузере и устройстве, а
								также идентификаторы посещения. Полный IP в счётчике не
								сохраняется.
							</p>
							<p>
								Мы не отправляем Telegram ID и содержимое проектов. Статистика
								хранится, пока действует счётчик. По завершении измерений мы
								запросим её удаление. Выключить сбор можно здесь в любой момент.
							</p>
						</details>
					)}
					{status === "connecting" && (
						<p role="status">Подключаем статистику…</p>
					)}
					{withdrawalFailed && (
						<>
							<p role="status">
								Сбор остановлен. Не удалось сохранить выбор для следующих
								запусков.
							</p>
							<button
								className={styles.retry}
								type="button"
								onClick={analytics.withdraw}
							>
								Повторить отзыв разрешения
							</button>
						</>
					)}
					{status === "unavailable" && (
						<p role="status">Статистика недоступна. Редактор работает.</p>
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
	if (delivery === "sent") return <p role="status">Спасибо за оценку.</p>;
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
				<legend>Удалось собрать планировку?</legend>
				<label>
					<input
						type="radio"
						name={`${group}-completed`}
						checked={completed === true}
						onChange={() => setCompleted(true)}
					/>{" "}
					Да
				</label>
				<label>
					<input
						type="radio"
						name={`${group}-completed`}
						checked={completed === false}
						onChange={() => setCompleted(false)}
					/>{" "}
					Нет
				</label>
			</fieldset>
			<fieldset disabled={delivery === "pending"}>
				<legend>Насколько удобно было пользоваться редактором?</legend>
				{ratingLabels.map((label, index) => (
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
				<p role="status">Не удалось отправить оценку.</p>
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
					{delivery === "failed" ? "Повторить" : "Отправить"}
				</button>
				<button type="button" onClick={onSkip}>
					Пропустить
				</button>
			</div>
		</form>
	);
}
