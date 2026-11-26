import { copy } from "./editor-language";
import {
	type ReactNode,
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

export function TelegramColorPaletteDialog({
	dialogId, title, currentLabel, busy = false, error, children, onClose,
}: {
	readonly dialogId?: string;
	readonly title: string;
	readonly currentLabel?: string | undefined;
	readonly busy?: boolean;
	readonly error?: string | undefined;
	readonly children: ReactNode;
	readonly onClose: () => void;
}) {
	const titleId = useId();
	const dialogRef = useRef<HTMLDialogElement>(null);
	useLayoutEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		dialog.showModal();
		dialog.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
		return () => dialog.close();
	}, []);
	return (
		<TelegramSheetFrame
			as="dialog"
			telegram
			busy={busy}
			ref={dialogRef}
			id={dialogId}
			aria-labelledby={titleId}
			aria-busy={busy || undefined}
			className={sceneStyles.colorSheet}
			data-scene-color-palette=""
			onCancel={(event) => {
				event.preventDefault();
				if (!busy) event.currentTarget.close();
			}}
			onClose={(event) => {
				if (!event.currentTarget.open) onClose();
			}}
		>
			<SheetHeader title={title} titleId={titleId} subtitle={currentLabel}
				closeLabel={copy("Закрыть палитру", "Close color palette")}
				closeDisabled={busy} onClose={() => dialogRef.current?.close()} />
			<div className={sheetStyles.body}>
				<div className={sceneStyles.colorOptions}>{children}</div>
				<p className={sceneStyles.colorNote}>{copy("Цвет на экране приблизительный.", "Colors are approximate on screen.")}</p>
				{error ? <p className={styles.fieldError} role="alert">{error}</p> : null}
			</div>
		</TelegramSheetFrame>
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
	const dialogId = useId();
	const [open, setOpen] = useState(false);
	const current = alphaParametricItemColorVariants.find(
		(variant) => variant.color === color,
	);
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
				onClick={(event) => {
					event.currentTarget.focus({ preventScroll: true });
					setOpen(true);
				}}
			>
				<span
					aria-hidden="true"
					className={styles.itemColorSwatch}
					style={{ backgroundColor: color }}
				/>
				<span>{copy("Цвет", "Color")}</span>
			</button>
			{open && (
				<TelegramColorPaletteDialog
					dialogId={dialogId}
					title={copy("Цвет предмета", "Item color")}
					currentLabel={current ? telegramItemColorLabelForDisplay(current) : undefined}
					onClose={() => setOpen(false)}
				>
					{alphaParametricItemColorVariants.map((variant) => (
						<button
							key={variant.variantId}
							aria-label={telegramItemColorLabelForDisplay(variant)}
							aria-pressed={color === variant.color}
							disabled={disabled}
							type="button"
							onClick={(event) => {
								event.currentTarget.closest("dialog")?.close();
								if (context === "placement" || color !== variant.color) onSelect(variant);
							}}
						>
							<span aria-hidden="true" className={styles.itemColorSwatch} style={{ backgroundColor: variant.color }}>
								{color === variant.color ? "✓" : ""}
							</span>
							<span>{swatchNames[variant.variantId]}</span>
						</button>
					))}
				</TelegramColorPaletteDialog>
			)}
		</div>
	);
}
