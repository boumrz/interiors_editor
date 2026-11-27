import type { KeyboardEvent } from "react";
import type { RectangularRoomInput } from "../domain/rectangular-room";
import { copy } from "./editor-language";
import styles from "./InspectorPanels.module.css";

type Dimension = keyof RectangularRoomInput;
type DimensionError = { readonly message: string; readonly field?: Dimension };

export function PlanDimensionFields({
	dimensions, error, disabled, saveOnBlur, onChange, onBlur, onKeyDown, onApply,
}: {
	readonly dimensions: RectangularRoomInput;
	readonly error: DimensionError | undefined;
	readonly disabled: boolean;
	readonly saveOnBlur: boolean;
	readonly onChange: (field: Dimension, raw: string) => void;
	readonly onBlur: (field: Dimension, input: HTMLInputElement) => void;
	readonly onKeyDown: (field: Dimension, event: KeyboardEvent<HTMLInputElement>) => void;
	readonly onApply: () => void;
}) {
	return (
		<form className={styles.form} onSubmit={(event) => {
			event.preventDefault();
			if (!saveOnBlur) onApply();
		}}>
			<div className={styles.fields}>
				{([
					["widthMm", copy("Ширина, мм", "Width, mm")],
					["depthMm", copy("Глубина, мм", "Depth, mm")],
					["heightMm", copy("Высота, мм", "Height, mm")],
				] as const).map(([field, label]) => {
					const invalid = error !== undefined && (error.field === undefined || error.field === field);
					return (
						<label key={field}>
							<span>{label}</span>
							<input
								aria-describedby={invalid ? "plan-dimension-error" : undefined}
								aria-invalid={invalid || undefined}
								autoComplete="off"
								disabled={disabled}
								inputMode="numeric"
								data-editor-blur-commit={saveOnBlur ? "" : undefined}
								onChange={event => onChange(field, event.currentTarget.value)}
								onBlur={saveOnBlur ? event => onBlur(field, event.currentTarget) : undefined}
								onKeyDown={saveOnBlur ? event => onKeyDown(field, event) : undefined}
								value={dimensions[field]}
							/>
						</label>
					);
				})}
			</div>
			{error ? <p className={styles.error} id="plan-dimension-error" role="alert">{error.message}</p> : null}
			{!saveOnBlur ? (
				<button className={styles.primary} disabled={disabled} type="submit">
					{copy("Применить размеры", "Apply dimensions")}
				</button>
			) : null}
		</form>
	);
}
