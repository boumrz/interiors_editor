import type { DoorWallOpening } from "../domain/project";
import styles from "./AppShell.module.css";
import choices from "./DoorSwingPicker.module.css";

type SwingSide = NonNullable<DoorWallOpening["swingSide"]>;
type HingeChoice = NonNullable<DoorWallOpening["hingeEnd"]> | null;

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
			{ side: firstSide, label: insideSide ? "Внутрь" : "На себя" },
			{ side: firstSide === "left" ? "right" : "left", label: insideSide ? "Наружу" : "От себя" },
		] as const;
		return (
			<div className={choices.rows}>
				<fieldset className={choices.options}>
					<legend className={styles.openingSwingLegend}>Петли</legend>
					{([null, "end"] as const).map((selectedHinge) => (
						<button
							aria-pressed={selectedHinge === (hingeEnd ?? null)}
							disabled={disabled}
							key={selectedHinge ?? "start"}
							onClick={() => onChange(value, selectedHinge)}
							type="button"
						>
							{selectedHinge ? "Справа" : "Слева"}
						</button>
					))}
				</fieldset>
				<fieldset className={choices.options}>
					<legend className={styles.openingSwingLegend}>Открывание</legend>
					{directions.map(({ side, label }) => (
						<button
							aria-pressed={side === value}
							disabled={disabled}
							key={side}
							onClick={() => onChange(side, hingeEnd)}
							type="button"
						>
							{label}
						</button>
					))}
				</fieldset>
			</div>
		);
	}

	return (
		<fieldset className={styles.openingCreationKindPicker}>
			<legend className={styles.openingSwingLegend}>
				Направление открывания
			</legend>
			{(["left", "right"] as const).map((side) => (
				<button
					aria-pressed={side === value}
					disabled={disabled}
					key={side}
					onClick={() => onChange(side)}
					type="button"
				>
					{side === "left" ? "Влево" : "Вправо"}
				</button>
			))}
		</fieldset>
	);
}
