import { useId, useState } from "react";
import styles from "./AppShell.module.css";
import { degreesForYawRadians, preciseYawRadiansFromDegrees } from "./rotation-angle";

export function FloorRotationAngleField({
	yawRadians,
	ariaLabel,
	disabled,
	onApply,
	skipBlurCommit,
	className,
}: {
	readonly yawRadians: number;
	readonly ariaLabel: string;
	readonly disabled?: boolean;
	readonly onApply: (yawRadians: number) => void;
	readonly skipBlurCommit?: (target: HTMLInputElement) => boolean;
	readonly className?: string;
}) {
	const errorId = useId();
	const [raw, setRaw] = useState<string>();
	const [invalid, setInvalid] = useState(false);
	const angle = degreesForYawRadians(yawRadians);
	return (
		<div className={className ? `${styles.floorRotationAngleField} ${className}` : styles.floorRotationAngleField}>
			<label>
				<input
					aria-label={ariaLabel}
					aria-invalid={invalid || undefined}
					aria-describedby={invalid ? errorId : undefined}
					autoComplete="off"
					data-editor-blur-commit=""
					disabled={disabled}
					inputMode="decimal"
					value={raw ?? angle}
					onChange={(event) => {
						setRaw(event.currentTarget.value);
						setInvalid(false);
					}}
					onBlur={(event) => {
						setRaw(undefined);
						if (skipBlurCommit?.(event.currentTarget) || disabled || raw === undefined || raw === angle) return;
						const next = preciseYawRadiansFromDegrees(raw);
						setInvalid(next === undefined);
						if (next !== undefined && degreesForYawRadians(next) !== angle) onApply(next);
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							event.currentTarget.blur();
						}
						if (event.key === "Escape" && raw !== undefined) {
							event.preventDefault();
							event.stopPropagation();
							setRaw(undefined);
							setInvalid(false);
						}
					}}
				/>
				<span aria-hidden="true">°</span>
			</label>
			{invalid ? <p id={errorId} className={styles.fieldError} role="alert">Укажите угол с точностью до трёх знаков.</p> : null}
		</div>
	);
}
