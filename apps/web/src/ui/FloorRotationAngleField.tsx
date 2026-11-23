import { useId, useLayoutEffect, useRef, useState } from "react";
import styles from "./AppShell.module.css";
import rotationStyles from "./FloorRotationControls.module.css";
import { degreesForYawRadians, preciseYawRadiansFromDegrees } from "./rotation-angle";

export function RotationAngleActions({ disabled, onApply, onCancel }: {
	readonly disabled?: boolean;
	readonly onApply: () => void;
	readonly onCancel: () => void;
}) {
	return (
		<div className={rotationStyles.angleActions}>
			<button type="button" aria-label="Отменить ввод угла" disabled={disabled} onClick={onCancel}>×</button>
			<button type="button" aria-label="Применить угол" disabled={disabled} onClick={onApply}>✓</button>
		</div>
	);
}

export function RotationModeToggle({ checked, disabled, onChange }: {
	readonly checked: boolean;
	readonly disabled?: boolean;
	readonly onChange: (checked: boolean) => void;
}) {
	return (
		<label className={rotationStyles.modeToggle}>
			<input type="checkbox" aria-label="Шаг 45°" checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} />
			<span aria-hidden="true">45°</span>
		</label>
	);
}

export function FloorRotationAngleField({
	yawRadians,
	ariaLabel,
	disabled,
	onApply,
	skipBlurCommit,
	className,
	explicit = false,
	onDraftChange,
}: {
	readonly yawRadians: number;
	readonly ariaLabel: string;
	readonly disabled?: boolean;
	readonly onApply: (yawRadians: number) => void;
	readonly skipBlurCommit?: (target: HTMLInputElement) => boolean;
	readonly className?: string;
	readonly explicit?: boolean;
	readonly onDraftChange?: (hasDraft: boolean) => void;
}) {
	const errorId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const fieldRef = useRef<HTMLDivElement>(null);
	const [raw, setRaw] = useState<string>();
	const [invalid, setInvalid] = useState(false);
	const angle = degreesForYawRadians(yawRadians);
	const editing = explicit && raw !== undefined;

	useLayoutEffect(() => {
		onDraftChange?.(editing);
		return () => onDraftChange?.(false);
	}, [editing, onDraftChange]);
	useLayoutEffect(() => {
		const field = fieldRef.current;
		const container = field?.closest("aside");
		if (!editing || !field || !container) return;
		const keepVisible = () => {
			if (document.activeElement !== inputRef.current) return;
			const fieldBox = field.getBoundingClientRect();
			const containerBox = container.getBoundingClientRect();
			if (fieldBox.bottom > containerBox.bottom - 8) {
				container.scrollTop += fieldBox.bottom - containerBox.bottom + 8;
			} else if (fieldBox.top < containerBox.top + 8) {
				container.scrollTop -= containerBox.top - fieldBox.top + 8;
			}
		};
		keepVisible();
		const observer = new ResizeObserver(keepVisible);
		observer.observe(container);
		return () => observer.disconnect();
	}, [editing]);
	const finish = (apply: boolean) => {
		if (apply && raw !== undefined && raw !== angle) {
			const next = preciseYawRadiansFromDegrees(raw);
			if (next === undefined) {
				setInvalid(true);
				return;
			}
			if (degreesForYawRadians(next) !== angle) onApply(next);
		}
		setRaw(undefined);
		setInvalid(false);
		inputRef.current?.blur();
	};
	return (
		<div className={className ? `${styles.floorRotationAngleField} ${className}` : styles.floorRotationAngleField}
			data-angle-draft={editing || undefined} ref={fieldRef}>
			<label>
				<input
					aria-label={ariaLabel}
					aria-invalid={invalid || undefined}
					aria-describedby={invalid ? errorId : undefined}
					autoComplete="off"
					data-editor-blur-commit={explicit ? undefined : ""}
					disabled={disabled}
					inputMode="decimal"
					ref={inputRef}
					value={raw ?? angle}
					onChange={(event) => {
						setRaw(event.currentTarget.value);
						setInvalid(false);
					}}
					onBlur={(event) => {
						if (explicit) return;
						setRaw(undefined);
						if (skipBlurCommit?.(event.currentTarget) || disabled || raw === undefined || raw === angle) return;
						const next = preciseYawRadiansFromDegrees(raw);
						setInvalid(next === undefined);
						if (next !== undefined && degreesForYawRadians(next) !== angle) onApply(next);
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							if (explicit) finish(true);
							else event.currentTarget.blur();
						}
						if (event.key === "Escape" && raw !== undefined) {
							event.preventDefault();
							event.stopPropagation();
							if (explicit) finish(false);
							else {
								setRaw(undefined);
								setInvalid(false);
							}
						}
					}}
				/>
				<span aria-hidden="true">°</span>
			</label>
			{invalid ? <p id={errorId} className={styles.fieldError} role="alert">Укажите угол с точностью до трёх знаков.</p> : null}
			{editing ? (
				<RotationAngleActions disabled={disabled} onCancel={() => finish(false)} onApply={() => finish(true)} />
			) : null}
		</div>
	);
}
