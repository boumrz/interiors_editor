import type { ReactNode, Ref } from "react";
import styles from "./SheetHeader.module.css";
import { useTelegramSheetClose } from "./TelegramSheetFrame";

export function SheetHeader({
	title,
	titleId,
	titleRef,
	titleTabIndex,
	subtitle,
	closeLabel,
	closeDisabled,
	onClose,
	protectEditorDraft,
	className,
}: {
	readonly title: ReactNode;
	readonly titleId?: string;
	readonly titleRef?: Ref<HTMLHeadingElement>;
	readonly titleTabIndex?: -1;
	readonly subtitle?: ReactNode;
	readonly closeLabel: string;
	readonly closeDisabled?: boolean;
	readonly onClose: () => void;
	readonly protectEditorDraft?: boolean;
	readonly className?: string;
}) {
	const closeSheet = useTelegramSheetClose();
	return (
		<header className={className ? `${styles.header} ${className}` : styles.header}>
			<div className={styles.title}>
				<h2 id={titleId} ref={titleRef} tabIndex={titleTabIndex}>
					{title}
				</h2>
				{subtitle != null && <p>{subtitle}</p>}
			</div>
			<button
				aria-label={closeLabel}
				className={styles.close}
				data-sheet-close=""
				data-editor-host-back={protectEditorDraft ? "panel" : undefined}
				disabled={closeDisabled}
				onClick={closeSheet ? () => closeSheet(onClose) : onClose}
				type="button"
			>
				<span aria-hidden="true">×</span>
			</button>
		</header>
	);
}
