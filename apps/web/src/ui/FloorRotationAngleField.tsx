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
			<button type="button" aria-label="Отменить ввод угла" disabled={disabled} onClick={onCancel}>
				<svg aria-hidden="true" focusable="false" height="22" viewBox="0 0 24 24" width="22">
					<path d="m6.5 6.5 11 11m0-11-11 11" />
				</svg>
			</button>
			<button type="button" aria-label="Применить угол" disabled={disabled} onClick={onApply}>
				<svg aria-hidden="true" focusable="false" height="22" viewBox="0 0 24 24" width="22">
					<path d="m5.5 12.5 4.25 4.25 8.75-9.25" />
				</svg>
			</button>
		</div>
	);
}

export function RotationModeToggle({ checked, disabled, onChange }: {
	readonly checked: boolean;
	readonly disabled?: boolean;
	readonly onChange: (checked: boolean) => void;
}) {
	return (
		<button
			aria-label="Шаг 45°"
			aria-pressed={checked}
			className={rotationStyles.modeToggle}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			title="Шаг поворота 45°"
			type="button"
		>
			<svg aria-hidden="true" focusable="false" height="30" viewBox="0 0 32 32" width="30">
				<path
					d="M16 28a12 12 0 1 0-10.4-6M1.7 19.6l3.9 2.4 1.2-4.5"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
				/>
				<text
					fill="currentColor"
					fontFamily="system-ui, sans-serif"
					fontSize="10.5"
					fontWeight="700"
					lengthAdjust="spacingAndGlyphs"
					textAnchor="middle"
					textLength="17"
					x="16.5"
					y="19.5"
				>45°</text>
			</svg>
		</button>
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
	const [raw, setRaw] = useState<string>();
	const [invalid, setInvalid] = useState(false);
	const angle = degreesForYawRadians(yawRadians);
	const editing = explicit && raw !== undefined;

	useLayoutEffect(() => {
		onDraftChange?.(editing);
		return () => onDraftChange?.(false);
	}, [editing, onDraftChange]);
	useLayoutEffect(() => {
		const field = inputRef.current?.closest("label");
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
			data-angle-draft={editing || undefined}>
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
