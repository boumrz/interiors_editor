import { type ReactNode, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { TelegramHostEnvironment } from "../adapters/telegram/host-environment";
import { licenseEditionLabel, licenseRevision } from "../app/license-receipt";
import type { TelegramEntryState } from "../app/telegram-editor-app";
import { TelegramUsageDialog } from "./telegram-usage-dialog";
import type { UsageMetrics } from "../app/telegram-usage-metrics";
import {
	closeActiveLegalDocument,
	LegalDocumentLink,
} from "./LegalDocumentLink";
import type { HostNavigationPort } from "./editor-host-boundary";
import { copy } from "./editor-language";
import { SheetHeader } from "./SheetHeader";
import sheetStyles from "./SheetHeader.module.css";
import { TelegramSheetFrame } from "./TelegramSheetFrame";
import styles from "./browser-legal-access.module.css";
import entryStyles from "./telegram-legal-entry.module.css";

const unsubscribe = () => undefined;
const subscribeWithoutTheme = () => unsubscribe;
const noTheme = () => undefined;

function LegalStatus() {
	return (
		<p>
			{copy(licenseEditionLabel, `License edition ${licenseRevision}`)}. {copy("Соглашение действует для вас с момента принятия.", "The agreement takes effect when you accept it.")}
		</p>
	);
}

export function TelegramLegalDocuments() {
	return (
		<nav className={styles.links} aria-label={copy("Документы приложения", "App documents")}>
			<LegalDocumentLink telegram documentName="privacy-policy">
				{copy("Политика конфиденциальности", "Privacy policy")}
			</LegalDocumentLink>
			<LegalDocumentLink telegram documentName="license-agreement">
				{copy("Лицензионное соглашение", "License agreement")}
			</LegalDocumentLink>
			<LegalDocumentLink telegram documentName="analytics-consent">
				{copy("Согласие на дополнительную статистику", "Optional analytics consent")}
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
	const theme = host?.theme;
	const themeSnapshot = useSyncExternalStore(
		theme?.subscribe ?? subscribeWithoutTheme,
		theme?.snapshot ?? noTheme,
		theme?.snapshot ?? noTheme,
	);
	const nightMode = themeSnapshot?.colorScheme === "dark";
	const useTelegramTheme = themeSnapshot?.preference === "auto";
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
				<TelegramSheetFrame
					as="dialog"
					telegram
					ref={dialog}
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
						title={copy("Настройки", "Settings")}
						titleId="telegram-settings-heading"
						titleRef={heading}
						titleTabIndex={-1}
						closeLabel={copy("Закрыть настройки", "Close settings")}
						onClose={() => dialog.current?.close()}
					/>
					<div className={`${sheetStyles.body} ${entryStyles.settingsContent}`}>
						{theme && themeSnapshot && (
								<div className={entryStyles.themeSetting}>
									<button
										className={entryStyles.themeSwitch}
										type="button"
										role="switch"
										aria-label={copy("Ночная тема", "Night mode")}
										aria-checked={nightMode}
										onClick={() => theme.setPreference(nightMode ? "light" : "dark")}
								>
										<span aria-hidden="true">
											<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" focusable="false">
												<circle cx="12" cy="12" r="4" />
												<path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
											</svg>
											{copy("День", "Day")}
										</span>
										<span aria-hidden="true">
											<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" focusable="false">
												<path d="M21 13.3A9 9 0 0 1 10.7 3 9 9 0 1 0 21 13.3Z" />
											</svg>
											{copy("Ночь", "Night")}
										</span>
									</button>
									<button
										className={entryStyles.themeReset}
										type="button"
										aria-disabled={useTelegramTheme}
										onClick={() => {
											if (!useTelegramTheme) theme.setPreference("auto");
										}}
									>
										{copy("Как в Telegram", "Use Telegram theme")}
									</button>
								</div>
						)}
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
								{copy("Настройки статистики", "Analytics settings")}
							</button>
						</footer>
					)}
				</TelegramSheetFrame>
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
						<h1 id="telegram-legal-heading">{copy("Перед началом работы", "Before you start")}</h1>
						<LegalStatus />
						<p>
							{copy("Для создания и изменения проектов примите лицензионное соглашение.", "Accept the license agreement to create and edit projects.")}
						</p>
						<TelegramLegalDocuments />
						{analytics && (
							<div className={entryStyles.preferences}>
								<p>{copy("Статистика помогает улучшать сервис.", "Analytics help improve the app.")}</p>
								<button
									type="button"
									className={entryStyles.preferenceButton}
									onClick={(event) => open(event.currentTarget)}
								>
									{copy("Настройки статистики", "Analytics settings")}
								</button>
							</div>
						)}
						{state.error && (
							<p role="alert">
								{state.error === "text"
									? copy("Текст действующей редакции недоступен. Сохранённые проекты можно посмотреть и скачать.", "The current agreement is unavailable. You can still view and download your saved projects.")
									: copy("Не удалось сохранить принятие соглашения. Попробуйте ещё раз или скачайте копии своих проектов.", "The app couldn’t save your acceptance. Try again or download copies of your projects.")}
							</p>
						)}
						<button
							className={styles.accept}
							type="button"
							disabled={state.error === "text"}
							onClick={() => void state.proceed()}
						>
							{copy("Принять лицензионное соглашение", "Accept the license agreement")}
						</button>
						<details className={entryStyles.savedProjects}>
							<summary>{copy("Уже есть сохранённые проекты?", "Already have saved projects?")}</summary>
							<p>{copy("Без принятия соглашения можно посмотреть свои проекты и скачать их копии.", "You can view your saved projects and download copies before accepting the agreement.")}</p>
							<button type="button" onClick={() => void state.readOnly()}>
								{copy("Посмотреть сохранённые проекты", "View saved projects")}
							</button>
						</details>
						<button type="button" onClick={onExit}>
							{copy("Выйти", "Exit")}
						</button>
					</section>
				</main>
			)}
		</TelegramSettings>
	);
}
