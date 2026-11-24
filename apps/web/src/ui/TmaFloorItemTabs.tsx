import { type KeyboardEvent, type ReactNode, useId } from "react";
import styles from "./TmaFloorItemTabs.module.css";

const tabs = [
	{ id: "sizes", label: "Размеры" },
	{ id: "walls", label: "До стен" },
	{ id: "settings", label: "Настройки" },
] as const;

export type FloorItemTab = (typeof tabs)[number]["id"];

type Props = Record<FloorItemTab, ReactNode> & {
	readonly active: FloorItemTab;
	readonly onChange: (tab: FloorItemTab) => void;
};

export function TmaFloorItemTabs({ active, onChange, ...content }: Props) {
	const id = useId();

	function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
		let destination: number;
		switch (event.key) {
			case "ArrowRight": destination = (index + 1) % tabs.length; break;
			case "ArrowLeft": destination = (index - 1 + tabs.length) % tabs.length; break;
			case "Home": destination = 0; break;
			case "End": destination = tabs.length - 1; break;
			default: return;
		}
		event.preventDefault();
		const tab = tabs[destination];
		if (!tab) return;
		onChange(tab.id);
		document.getElementById(`${id}-tab-${tab.id}`)?.focus();
	}

	return (
		<>
			<div className={styles.tabs} role="tablist" aria-label="Параметры предмета">
				{tabs.map((tab, index) => (
					<button
						aria-controls={`${id}-panel-${tab.id}`}
						aria-selected={active === tab.id}
						id={`${id}-tab-${tab.id}`}
						key={tab.id}
						onClick={() => onChange(tab.id)}
						onKeyDown={(event) => navigate(event, index)}
						role="tab"
						tabIndex={active === tab.id ? 0 : -1}
						type="button"
					>
						{tab.label}
					</button>
				))}
			</div>
			{tabs.map((tab) => (
				<section
					aria-labelledby={`${id}-tab-${tab.id}`}
					className={styles.panel}
					hidden={active !== tab.id}
					id={`${id}-panel-${tab.id}`}
					key={tab.id}
					role="tabpanel"
				>
					{content[tab.id]}
				</section>
			))}
		</>
	);
}
