import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import type { TelegramHostEnvironment } from "../adapters/telegram/host-environment";
import { licenseEditionLabel } from "../app/license-receipt";
import type { TelegramEntryState } from "../app/telegram-editor-app";
import { TelegramUsageDialog } from "./telegram-usage-dialog";
import type { UsageMetrics } from "../app/telegram-usage-metrics";
import {
	closeActiveLegalDocument,
	LegalDocumentLink,
} from "./LegalDocumentLink";
import type { HostNavigationPort } from "./editor-host-boundary";
import { SheetHeader } from "./SheetHeader";
import sheetStyles from "./SheetHeader.module.css";
import styles from "./browser-legal-access.module.css";
import entryStyles from "./telegram-legal-entry.module.css";

function LegalStatus() {
	return (
		<p>
			{licenseEditionLabel}. Соглашение действует для вас с момента
			принятия.
		</p>
	);
}

export function TelegramLegalDocuments() {
	return (
		<nav className={styles.links} aria-label="Документы приложения">
			<LegalDocumentLink documentName="privacy-policy">
				Политика конфиденциальности
			</LegalDocumentLink>
			<LegalDocumentLink documentName="license-agreement">
				Лицензионное соглашение
			</LegalDocumentLink>
			<LegalDocumentLink documentName="analytics-consent">
				Согласие на дополнительную статистику
			</LegalDocumentLink>
		</nav>
	);
}

export function TelegramSettings({
	host,
	analytics,
	children,
	onExitBeforeEntry,
}: {
	readonly host?: TelegramHostEnvironment;
	readonly analytics?: UsageMetrics;
	readonly onExitBeforeEntry?: () => void;
	readonly children: (
		openSettings: (restoreFocus?: HTMLElement) => void,
		navigation?: HostNavigationPort,
	) => ReactNode;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const heading = useRef<HTMLHeadingElement>(null);
	const trigger = useRef<HTMLElement | null>(null);
	const wantedBack = useRef(false);
	const underlyingBack = useRef(new Set<() => void>());
	const open = useCallback((restoreFocus?: HTMLElement) => {
		if (onExitBeforeEntry) {
			restoreFocus?.focus({ preventScroll: true });
			void analytics?.openSettings();
			return;
		}
		const panel = dialog.current;
		if (!panel || panel.open) return;
		restoreFocus?.focus({ preventScroll: true });
		trigger.current = restoreFocus ?? (
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null);
		panel.showModal();
		heading.current?.focus({ preventScroll: true });
		host?.navigation.setBackVisible(true);
	}, [analytics, host, onExitBeforeEntry]);
	const navigation = useMemo<HostNavigationPort | undefined>(
		() =>
			host && {
				...host.navigation,
				setBackVisible(visible) {
					wantedBack.current = visible;
					host.navigation.setBackVisible(
						visible || Boolean(dialog.current?.open),
					);
				},
				subscribeBack(listener) {
					const callbacks = underlyingBack.current;
					callbacks.add(listener);
					return () => {
						callbacks.delete(listener);
					};
				},
			},
		[host],
	);
	useEffect(() => {
		if (!host) return;
		let unsubscribeSettings: (() => void) | undefined;
		try {
			unsubscribeSettings = host.showSettings?.(() => open());
		} catch {
			/* Visible Settings also works without the host menu. */
		}
		const unsubscribe = host.navigation.subscribeBack(() => {
			if (closeActiveLegalDocument()) return;
			const metrics = analytics?.snapshot();
			if (analytics && metrics && metrics.view !== "closed") {
				analytics.closeSettings();
				return;
			}
			if (dialog.current?.open) {
				dialog.current.close();
				return;
			}
			if (onExitBeforeEntry) onExitBeforeEntry();
			else for (const callback of [...underlyingBack.current]) callback();
		});
		if (onExitBeforeEntry) host.navigation.setBackVisible(true);
		return () => {
			unsubscribe();
			unsubscribeSettings?.();
			if (onExitBeforeEntry) host.navigation.setBackVisible(false);
		};
	}, [analytics, host, onExitBeforeEntry, open]);
	useEffect(() => {
		if (!host || !analytics) return;
		const visibility = () =>
			host.navigation.setBackVisible(
				Boolean(onExitBeforeEntry) ||
					Boolean(dialog.current?.open) ||
					analytics.snapshot().view !== "closed" ||
					wantedBack.current,
			);
		visibility();
		return analytics.subscribe(visibility);
	}, [analytics, host, onExitBeforeEntry]);
	return (
		<>
			{children(open, navigation)}
			{!onExitBeforeEntry && (
				<dialog
					ref={dialog}
					className={`${sheetStyles.dialog} ${sheetStyles.telegramDialog}`}
					aria-labelledby="telegram-settings-heading"
					onClose={() => {
						host?.navigation.setBackVisible(
							wantedBack.current ||
								Boolean(analytics && analytics.snapshot().view !== "closed"),
						);
						const restoreFocus = trigger.current;
						trigger.current = null;
						if (restoreFocus?.isConnected && restoreFocus.getClientRects().length)
							restoreFocus.focus({ preventScroll: true });
					}}
				>
					<SheetHeader
						title="Настройки"
						titleId="telegram-settings-heading"
						titleRef={heading}
						titleTabIndex={-1}
						closeLabel="Закрыть настройки"
						onClose={() => dialog.current?.close()}
					/>
					<div className={`${sheetStyles.body} ${entryStyles.settingsContent}`}>
						<LegalStatus />
						<TelegramLegalDocuments />
					</div>
					{analytics && (
						<footer className={sheetStyles.footer}>
							<button
								className={entryStyles.settingsAction}
								type="button"
								onClick={(event) => {
									event.currentTarget.focus({ preventScroll: true });
									void analytics.openSettings();
								}}
							>
								Настройки статистики
							</button>
						</footer>
					)}
				</dialog>
			)}
			{analytics && <TelegramUsageDialog metrics={analytics} />}
		</>
	);
}

export function TelegramLegalEntry({
	state,
	analytics,
	onExit,
}: {
	readonly state: Extract<TelegramEntryState, { kind: "legal" }>;
	readonly analytics?: UsageMetrics;
	readonly onExit: () => void;
}) {
	return (
		<TelegramSettings
			host={state.hostEnvironment}
			onExitBeforeEntry={onExit}
			analytics={analytics}
		>
			{(open) => (
				<main className={styles.entry}>
					<section aria-labelledby="telegram-legal-heading">
						<h1 id="telegram-legal-heading">Перед началом работы</h1>
						<LegalStatus />
						<p>
							Для создания и изменения проектов примите лицензионное соглашение.
						</p>
						<TelegramLegalDocuments />
						{analytics && (
							<div className={entryStyles.preferences}>
								<p>Статистика помогает улучшать сервис.</p>
								<button
									type="button"
									className={entryStyles.preferenceButton}
									onClick={(event) => open(event.currentTarget)}
								>
									Настройки статистики
								</button>
							</div>
						)}
						{state.error && (
							<p role="alert">
								{state.error === "text"
									? "Текст действующей редакции недоступен. Сохранённые проекты можно посмотреть и скачать."
									: "Не удалось сохранить принятие соглашения. Попробуйте ещё раз или скачайте копии своих проектов."}
							</p>
						)}
						<button
							className={styles.accept}
							type="button"
							disabled={state.error === "text"}
							onClick={() => void state.proceed()}
						>
							Принять лицензионное соглашение
						</button>
						<details className={entryStyles.savedProjects}>
							<summary>Уже есть сохранённые проекты?</summary>
							<p>Без принятия соглашения можно посмотреть свои проекты и скачать их копии.</p>
							<button type="button" onClick={() => void state.readOnly()}>
								Посмотреть сохранённые проекты
							</button>
						</details>
						<button type="button" onClick={onExit}>
							Выйти
						</button>
					</section>
				</main>
			)}
		</TelegramSettings>
	);
}
