import {
	type RefObject,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import sceneStyles from "./RoomScene3d.module.css";
import {
	type AlphaParametricItemColorVariant,
	alphaParametricItemColorVariants,
} from "../domain/item-color-variant";
import styles from "./AppShell.module.css";
import { SheetHeader } from "./SheetHeader";
import sheetStyles from "./SheetHeader.module.css";

const swatchNames: Record<
	AlphaParametricItemColorVariant["variantId"],
	string
> = {
	"alpha-warm-wood": "Дерево",
	"alpha-blue": "Синий",
	"alpha-violet": "Фиолетовый",
	"alpha-walnut": "Орех",
	"alpha-terracotta": "Терракота",
	"alpha-forest": "Зелёный",
	"alpha-berry": "Ягодный",
};

type TelegramItemColorProps = {
	readonly color: string;
	readonly context: "placement" | "selected-item" | "wall-item";
	readonly disabled: boolean;
	readonly sceneTriggerRef?: RefObject<HTMLButtonElement | null>;
	readonly onSelect: (variant: AlphaParametricItemColorVariant) => void;
};

export function TelegramItemColor({
	color,
	context,
	disabled,
	sceneTriggerRef,
	onSelect,
}: TelegramItemColorProps) {
	if (sceneTriggerRef) {
		return (
			<SceneColorPicker
				color={color}
				context={context}
				disabled={disabled}
				sceneTriggerRef={sceneTriggerRef}
				onSelect={onSelect}
			/>
		);
	}
	const current = alphaParametricItemColorVariants.find(
		(variant) => variant.color === color,
	);
	return (
		<details
			className={styles.tmaItemColor}
			data-testid={`tma-${context}-color`}
		>
			<summary className={styles.tmaItemColorTrigger}>
				<span
					aria-hidden="true"
					className={styles.itemColorSwatch}
					style={{ backgroundColor: color }}
				/>
				<span>Цвет{current ? ` · ${current.label}` : ""}</span>
			</summary>
			<fieldset className={styles.quickPalette} disabled={disabled}>
				<legend>Цвет предмета</legend>
				<p className={styles.catalogNote}>Цвет на экране приблизительный.</p>
				<div>
					{alphaParametricItemColorVariants.map((variant) => (
						<button
							aria-label={`Выбрать вариант цвета ${context === "wall-item" ? "настенного предмета" : "предмета"} ${variant.label}`}
							aria-pressed={color === variant.color}
							disabled={color === variant.color}
							key={variant.variantId}
							onClick={() => onSelect(variant)}
							type="button"
						>
							<span
								aria-hidden="true"
								className={styles.itemColorSwatch}
								style={{ backgroundColor: variant.color }}
							/>
							<small>{swatchNames[variant.variantId]}</small>
						</button>
					))}
				</div>
			</fieldset>
		</details>
	);
}

function SceneColorPicker({
	color,
	context,
	disabled,
	onSelect,
	sceneTriggerRef,
}: TelegramItemColorProps & {
	readonly sceneTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const dialogId = useId();
	const [open, setOpen] = useState(false);
	const current = alphaParametricItemColorVariants.find(
		(variant) => variant.color === color,
	);
	useLayoutEffect(() => {
		const dialog = dialogRef.current;
		const trigger = sceneTriggerRef.current;
		if (!open || !dialog || !trigger) return;
		trigger.focus({ preventScroll: true });
		dialog.showModal();
		dialog
			.querySelector<HTMLElement>('[aria-pressed="true"]')
			?.focus({ preventScroll: true });
		return () => dialog.close();
	}, [open, sceneTriggerRef]);
	return (
		<div
			data-testid={`tma-${context}-color`}
			className={sceneStyles.colorAction}
		>
			<button
				ref={sceneTriggerRef}
				className={sceneStyles.colorTrigger}
				aria-haspopup="dialog"
				aria-controls={dialogId}
				aria-expanded={open}
				aria-label={current ? `Цвет · ${current.label}` : "Цвет"}
				type="button"
				disabled={disabled}
				onClick={() => setOpen(true)}
			>
				<span
					aria-hidden="true"
					className={styles.itemColorSwatch}
					style={{ backgroundColor: color }}
				/>
				<span>Цвет</span>
			</button>
			{open && (
				<dialog
					ref={dialogRef}
					id={dialogId}
					aria-labelledby={titleId}
					className={`${sheetStyles.dialog} ${sheetStyles.telegramDialog} ${sceneStyles.colorSheet}`}
					data-scene-color-palette=""
					onCancel={(event) => {
						event.preventDefault();
						event.currentTarget.close();
					}}
					onClose={(event) => {
						if (!event.currentTarget.open) setOpen(false);
					}}
					onPointerUp={(event) => {
						if (event.target !== event.currentTarget) return;
						const rect = event.currentTarget.getBoundingClientRect();
						if (
							event.clientX < rect.left ||
							event.clientX > rect.right ||
							event.clientY < rect.top ||
							event.clientY > rect.bottom
						)
							event.currentTarget.close();
					}}
				>
					<SheetHeader
						title="Цвет предмета"
						titleId={titleId}
						subtitle={current?.label}
						closeLabel="Закрыть палитру"
						onClose={() => dialogRef.current?.close()}
					/>
					<div className={sheetStyles.body}>
						<div className={sceneStyles.colorOptions}>
							{alphaParametricItemColorVariants.map((variant) => (
								<button
									key={variant.variantId}
									aria-label={variant.label}
									aria-pressed={color === variant.color}
									disabled={disabled}
									type="button"
									onClick={() => {
										dialogRef.current?.close();
										if (color !== variant.color) onSelect(variant);
									}}
								>
									<span
										aria-hidden="true"
										className={styles.itemColorSwatch}
										style={{ backgroundColor: variant.color }}
									>
										{color === variant.color ? "✓" : ""}
									</span>
									<span>{swatchNames[variant.variantId]}</span>
								</button>
							))}
						</div>
						<p className={sceneStyles.colorNote}>
							Цвет на экране приблизительный.
						</p>
					</div>
				</dialog>
			)}
		</div>
	);
}
