import { copy } from "./editor-language";
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
import { TelegramSheetFrame } from "./TelegramSheetFrame";

const swatchNames: Record<
	AlphaParametricItemColorVariant["variantId"],
	string
> = {
	get "alpha-warm-wood"() {
		return copy("Дерево", "Wood");
	},
	get "alpha-blue"() {
		return copy("Синий", "Blue");
	},
	get "alpha-violet"() {
		return copy("Фиолетовый", "Violet");
	},
	get "alpha-walnut"() {
		return copy("Орех", "Walnut");
	},
	get "alpha-terracotta"() {
		return copy("Терракота", "Terracotta");
	},
	get "alpha-forest"() {
		return copy("Зелёный", "Green");
	},
	get "alpha-berry"() {
		return copy("Ягодный", "Berry");
	},
};

export function telegramItemColorLabelForDisplay(
	variant: AlphaParametricItemColorVariant,
): string {
	return copy(variant.label, swatchNames[variant.variantId]);
}

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
				<span>
					{copy("Цвет", "Color")}
					{current
						? ` · ${telegramItemColorLabelForDisplay(current)}`
						: ""}
				</span>
			</summary>
			<fieldset className={styles.quickPalette} disabled={disabled}>
				<legend>{copy("Цвет предмета", "Item color")}</legend>
				<p className={styles.catalogNote}>
					{copy(
						"Цвет на экране приблизительный.",
						"Colors are approximate on screen.",
					)}
				</p>
				<div>
					{alphaParametricItemColorVariants.map((variant) => (
						<button
							aria-label={copy(
								`Выбрать вариант цвета ${context === "wall-item" ? "настенного предмета" : "предмета"} ${variant.label}`,
								`Select ${swatchNames[variant.variantId]} for this ${context === "wall-item" ? "wall-mounted item" : "item"}`,
							)}
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
				aria-label={
					current
						? copy(
								`Цвет · ${current.label}`,
								`Color · ${swatchNames[current.variantId]}`,
							)
						: copy("Цвет", "Color")
				}
				type="button"
				disabled={disabled}
				onClick={() => setOpen(true)}
			>
				<span
					aria-hidden="true"
					className={styles.itemColorSwatch}
					style={{ backgroundColor: color }}
				/>
				<span>{copy("Цвет", "Color")}</span>
			</button>
			{open && (
				<TelegramSheetFrame
					as="dialog"
					telegram
					ref={dialogRef}
					id={dialogId}
					aria-labelledby={titleId}
					className={sceneStyles.colorSheet}
					data-scene-color-palette=""
					onCancel={(event) => {
						event.preventDefault();
						event.currentTarget.close();
					}}
					onClose={(event) => {
						if (!event.currentTarget.open) setOpen(false);
					}}
				>
					<SheetHeader
						title={copy("Цвет предмета", "Item color")}
						titleId={titleId}
						subtitle={
							current
								? telegramItemColorLabelForDisplay(current)
								: undefined
						}
						closeLabel={copy("Закрыть палитру", "Close color palette")}
						onClose={() => dialogRef.current?.close()}
					/>
					<div className={sheetStyles.body}>
						<div className={sceneStyles.colorOptions}>
							{alphaParametricItemColorVariants.map((variant) => (
								<button
									key={variant.variantId}
									aria-label={telegramItemColorLabelForDisplay(variant)}
									aria-pressed={color === variant.color}
									disabled={disabled}
									type="button"
									onClick={() => {
										dialogRef.current?.close();
										if (context === "placement" || color !== variant.color)
											onSelect(variant);
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
							{copy(
								"Цвет на экране приблизительный.",
								"Colors are approximate on screen.",
							)}
						</p>
					</div>
				</TelegramSheetFrame>
			)}
		</div>
	);
}
