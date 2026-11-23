import type { DoorWallOpening } from "../domain/project";
import styles from "./AppShell.module.css";

type SwingSide = NonNullable<DoorWallOpening["swingSide"]>;

export function DoorSwingPicker({
	value = "right",
	disabled,
	onChange,
}: {
	readonly value?: DoorWallOpening["swingSide"];
	readonly disabled: boolean;
	readonly onChange: (value: SwingSide) => void;
}) {
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
