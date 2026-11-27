import type { RefObject } from "react";
import styles from "./AppShell.module.css";
import { copy } from "./editor-language";

export type SceneSelectionAction =
	| { readonly kind: "item"; readonly duplicate: () => void; readonly readOnly: boolean }
	| { readonly kind: "wall"; readonly wallItem: boolean }
	| { readonly kind: "floor" | "rooms"; readonly disabled: boolean };

export function SceneSelectionActions({ action, triggerRef, open }: {
	readonly action: SceneSelectionAction;
	readonly triggerRef: RefObject<HTMLButtonElement | null>;
	readonly open: () => void;
}) {
	const label = action.kind === "floor" ? copy("Материал пола", "Floor material")
		: action.kind === "rooms" ? copy("Помещения", "Rooms")
		: action.kind === "wall" && !action.wallItem ? copy("Свойства стены", "Wall properties")
		: copy("Параметры", "Settings");
	return (
		<div className={styles.tmaSceneSelectionActions} data-scene-selection-actions="">
			<button ref={triggerRef} className={styles.tmaDuplicateAction} disabled={"disabled" in action && action.disabled} type="button" onClick={open}>{label}</button>
			{action.kind === "item" ? (
				<button className={styles.tmaDuplicateAction} type="button" disabled={action.readOnly} onClick={action.duplicate}>
					{copy("Дублировать", "Duplicate")}
				</button>
			) : null}
		</div>
	);
}
