import { type ReactNode, useRef, useState } from "react";
import { currentLicenseReadable } from "../app/legal-release";
import { licenseEditionLabel, licenseReceipts } from "../app/license-receipt";
import { LegalDocumentLink } from "./LegalDocumentLink";
import { SheetHeader } from "./SheetHeader";
import sheetStyles from "./SheetHeader.module.css";
import styles from "./browser-legal-access.module.css";

const receipts = licenseReceipts(() => window.localStorage);
function alreadyStarted() {
	return currentLicenseReadable() && receipts.has("web");
}

function DocumentLinks() {
	return (
		<nav className={styles.links} aria-label="Документы приложения">
			<LegalDocumentLink documentName="privacy-policy">
				Политика конфиденциальности
			</LegalDocumentLink>
			<LegalDocumentLink documentName="license-agreement">
				Лицензионное соглашение
			</LegalDocumentLink>
		</nav>
	);
}

function EditionStatus() {
	return <p>{licenseEditionLabel}. Соглашение действует для вас с момента принятия.</p>;
}

export function BrowserLegalAccess({
	editor,
	backups,
}: {
	readonly editor: (openSettings: (restoreFocus?: HTMLElement) => void) => ReactNode;
	readonly backups: ReactNode;
}) {
	const [entered, setEntered] = useState(alreadyStarted);
	const [problem, setProblem] = useState("");
	const [showBackups, setShowBackups] = useState(false);
	const dialog = useRef<HTMLDialogElement>(null);
	const settingsTrigger = useRef<HTMLElement | undefined>(undefined);
	const enter = () => {
		if (!currentLicenseReadable()) {
			setProblem("Не удалось открыть текст этой редакции. Обновите страницу или выгрузите свои проекты.");
			return;
		}
		if (!receipts.accept("web")) {
			setProblem("Не удалось сохранить выбор на устройстве. Разрешите локальное хранение или выгрузите свои проекты.");
			return;
		}
		setEntered(true);
	};
	if (entered)
		return (
			<>
				{editor((restoreFocus) => {
					settingsTrigger.current = restoreFocus;
					restoreFocus?.focus({ preventScroll: true });
					dialog.current?.showModal();
				})}
				<dialog
					ref={dialog}
					className={sheetStyles.dialog}
					aria-labelledby="browser-settings-heading"
					onClose={() => {
						const restoreFocus = settingsTrigger.current;
						settingsTrigger.current = undefined;
						if (restoreFocus?.isConnected && restoreFocus.getClientRects().length)
							restoreFocus.focus({ preventScroll: true });
					}}
				>
					<SheetHeader
						title="Настройки"
						titleId="browser-settings-heading"
						closeLabel="Закрыть настройки"
						onClose={() => dialog.current?.close()}
					/>
					<div className={`${sheetStyles.body} ${styles.settingsContent}`}>
						<EditionStatus />
						<DocumentLinks />
					</div>
				</dialog>
			</>
		);
	if (showBackups)
		return (
			<>
				<div className={styles.back}>
					<button type="button" onClick={() => setShowBackups(false)}>
						Назад к документам
					</button>
				</div>
				{backups}
			</>
		);
	return (
		<main className={styles.entry}>
			<section aria-labelledby="browser-entry-heading">
				<h1 id="browser-entry-heading">InteriorsEditor</h1>
				<EditionStatus />
				<DocumentLinks />
				{problem && <p role="alert">{problem}</p>}
				<button className={styles.accept} type="button" onClick={enter}>
					Принять лицензионное соглашение
				</button>
				<button type="button" onClick={() => setShowBackups(true)}>
					Выгрузить сохранённые проекты
				</button>
			</section>
		</main>
	);
}
