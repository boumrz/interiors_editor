import {
	type KeyboardEvent,
	type RefObject,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { DrawingDimensionVisibility } from "./drawing-dimension-visibility";
import styles from "./DimensionFilter.module.css";
import { SheetHeader } from "./SheetHeader";
import { TelegramSheetFrame } from "./TelegramSheetFrame";

const tabs = [
	{
		id: "rooms",
		label: "Помещения",
		options: [
			["room-clear", "Внутренние размеры"],
			["overall", "Внешние габариты"],
		],
	},
	{ id: "openings", label: "Проёмы", options: [["opening", "Ширина проёмов"]] },
] as const;

export function DimensionFilter({
	telegram = false,
	visibility,
	onChange,
	onClose,
	returnFocusRef,
}: {
	readonly telegram?: boolean;
	readonly visibility: DrawingDimensionVisibility;
	readonly onChange: (value: DrawingDimensionVisibility) => void;
	readonly onClose: () => void;
	readonly returnFocusRef: RefObject<HTMLElement | null>;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const heading = useRef<HTMLHeadingElement>(null);
	const id = useId();
	const [activeTab, setActiveTab] = useState(0);
	const tabControls = useRef<(HTMLButtonElement | null)[]>([]);
	useLayoutEffect(() => {
		const element = dialog.current;
		if (!element) return;
		element.showModal();
		heading.current?.focus({ preventScroll: true });

		return () => {
			element.close();
			requestAnimationFrame(() => {
				if (!element.isConnected)
					returnFocusRef.current?.focus({ preventScroll: true });
			});
		};
	}, [returnFocusRef]);
	const trapTab = (event: KeyboardEvent<HTMLDialogElement>) => {
		if (event.key !== "Tab") return;
		const controls = [
			...(dialog.current?.querySelectorAll<HTMLElement>(
				"input:not(:disabled),button:not(:disabled):not([tabindex='-1'])",
			) ?? []),
		];
		const index = controls.indexOf(document.activeElement as HTMLElement);
		event.preventDefault();
		const next =
			index < 0
				? event.shiftKey
					? controls.length - 1
					: 0
				: (index + (event.shiftKey ? -1 : 1) + controls.length) %
					controls.length;
		controls[next]?.focus();
	};
	const setAll = (visible: boolean) =>
		onChange({
			wall: false,
			opening: visible,
			pier: false,
			overall: visible,
			"room-clear": visible,
		});
	const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>) => {
		const next =
			event.key === "ArrowRight"
				? (activeTab + 1) % tabs.length
				: event.key === "ArrowLeft"
					? (activeTab - 1 + tabs.length) % tabs.length
					: event.key === "Home"
						? 0
						: event.key === "End"
							? tabs.length - 1
							: undefined;
		if (next === undefined) return;
		event.preventDefault();
		setActiveTab(next);
		tabControls.current[next]?.focus();
	};
	return (
		<TelegramSheetFrame
			as="dialog"
			telegram={telegram}
			aria-labelledby={`${id}-heading`}
			className={styles.dialog}
			data-telegram-sheet={telegram ? "dimensions" : undefined}
			data-testid="dimension-filter"
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			onClick={telegram ? undefined : (event) => {
				if (event.target !== event.currentTarget) return;
				const bounds = event.currentTarget.getBoundingClientRect();
				if (
					event.clientX < bounds.left ||
					event.clientX > bounds.right ||
					event.clientY < bounds.top ||
					event.clientY > bounds.bottom
				)
					onClose();
			}}
			onKeyDown={trapTab}
			ref={dialog}
		>
			<SheetHeader
				title={<>Размеры <span aria-hidden="true" className={styles.unit}>мм</span></>}
				titleId={`${id}-heading`}
				titleRef={heading}
				titleTabIndex={-1}
				closeLabel="Закрыть настройки размеров"
				className={styles.dialogHeader}
				onClose={onClose}
			/>
			<div aria-label="Группы размеров" className={styles.tabs} role="tablist">
				{tabs.map((tab, index) => (
					<button
						aria-controls={`${id}-${tab.id}-panel`}
						aria-selected={activeTab === index}
						id={`${id}-${tab.id}-tab`}
						key={tab.id}
						onClick={() => setActiveTab(index)}
						onKeyDown={navigateTabs}
						ref={(element) => {
							tabControls.current[index] = element;
						}}
						role="tab"
						tabIndex={activeTab === index ? 0 : -1}
						type="button"
					>
						{tab.label}
					</button>
				))}
			</div>
			<div className={styles.body}>
				{tabs.map((tab, index) => (
					<div
						aria-labelledby={`${id}-${tab.id}-tab`}
						hidden={activeTab !== index}
						id={`${id}-${tab.id}-panel`}
						key={tab.id}
						role="tabpanel"
					>
						<fieldset
							className={styles.options}
							aria-label={tab.label}
							disabled={activeTab !== index}
						>
							{tab.options.map(([kind, label]) => (
								<label key={kind}>
									<input
										checked={visibility[kind]}
										onChange={(event) =>
											onChange({
												...visibility,
												wall: false,
												pier: false,
												[kind]: event.currentTarget.checked,
											})
										}
										type="checkbox"
									/>
									<span>{label}</span>
								</label>
							))}
						</fieldset>
					</div>
				))}
			</div>
			<div className={styles.quickActions}>
				<button onClick={() => setAll(true)} type="button">
					Показать всё
				</button>
				<button onClick={() => setAll(false)} type="button">
					Скрыть всё
				</button>
			</div>
			<footer className={styles.footer}>
				<button onClick={onClose} type="button">
					Готово
				</button>
			</footer>
		</TelegramSheetFrame>
	);
}
