import { copy } from "./editor-language";
import type { DoorWallOpening } from "../domain/project";
import styles from "./AppShell.module.css";
import choices from "./DoorSwingPicker.module.css";

type SwingSide = NonNullable<DoorWallOpening["swingSide"]>;
type HingeChoice = NonNullable<DoorWallOpening["hingeEnd"]> | null;

export function DoorMotionChoices<Value extends string | null>({
	title, options, current, disabled, onChange,
}: {
	readonly title: string;
	readonly options: readonly {
		readonly value: Value;
		readonly label: string;
		readonly action?: string;
	}[];
	readonly current: Value | undefined;
	readonly disabled: boolean;
	readonly onChange: (value: Value) => void;
}) {
	return (
		<fieldset className={choices.options}>
			<legend className={styles.openingSwingLegend}>{title}</legend>
			{options.map(({ value, label, action }) => (
				<button aria-label={action} aria-pressed={current === value} disabled={disabled}
					key={value ?? "default"} onClick={() => onChange(value)} title={label} type="button">
					{label}
				</button>
			))}
		</fieldset>
	);
}

export function DoorSwingPicker({
	value = "right",
	hingeEnd,
	insideSide,
	showHingeOptions = false,
	disabled,
	onChange,
}: {
	readonly value?: DoorWallOpening["swingSide"];
	readonly hingeEnd?: HingeChoice;
	readonly insideSide?: SwingSide;
	readonly showHingeOptions?: boolean;
	readonly disabled: boolean;
	readonly onChange: (value: SwingSide, hingeEnd?: HingeChoice) => void;
}) {
	if (showHingeOptions) {
		const firstSide = insideSide ?? "left";
		const directions = [
			{
				value: firstSide,
				label: insideSide
					? copy("Внутрь", "Inward")
					: copy("На себя", "Toward you"),
			},
			{
				value: firstSide === "left" ? "right" : "left",
				label: insideSide
					? copy("Наружу", "Outward")
					: copy("От себя", "Away from you"),
			},
		] as const;
		return (
			<div className={choices.rows}>
				<DoorMotionChoices title={copy("Петли", "Hinges")} current={hingeEnd ?? null} disabled={disabled}
					options={[
						{ value: null, label: copy("Слева", "Left") },
						{ value: "end", label: copy("Справа", "Right") },
					]} onChange={hinge => onChange(value, hinge)} />
				<DoorMotionChoices title={copy("Открывание", "Swing")} current={value} disabled={disabled}
					options={directions} onChange={side => onChange(side, hingeEnd)} />
			</div>
		);
	}

	return (
		<fieldset className={styles.openingCreationKindPicker}>
			<legend className={styles.openingSwingLegend}>
				{copy("Направление открывания", "Swing direction")}
			</legend>
			{(["left", "right"] as const).map((side) => (
				<button
					aria-pressed={side === value}
					disabled={disabled}
					key={side}
					onClick={() => onChange(side)}
					type="button"
				>
					{side === "left" ? copy("Влево", "Left") : copy("Вправо", "Right")}
				</button>
			))}
		</fieldset>
	);
}
