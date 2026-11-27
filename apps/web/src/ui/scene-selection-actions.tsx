import type { RefObject } from "react";
import styles from "./AppShell.module.css";
import { copy } from "./editor-language";

export type SceneSelectionAction =
	| { readonly kind: "item"; readonly duplicate: () => void; readonly readOnly: boolean }
	| { readonly kind: "wall"; readonly wallItem: boolean }
	| { readonly kind: "room" };

export function SceneSelectionActions({ action, triggerRef, open }: {
	readonly action: SceneSelectionAction;
	readonly triggerRef: RefObject<HTMLButtonElement | null>;
	readonly open: () => void;
}) {
	const label = action.kind === "room" ? copy("Помещение", "Room")
		: action.kind === "wall" && !action.wallItem ? copy("Свойства стены", "Wall properties")
		: copy("Параметры", "Settings");
	return (
		<div className={styles.tmaSceneSelectionActions} data-scene-selection-actions="">
			<button ref={triggerRef} className={styles.tmaDuplicateAction} type="button" onClick={open}>{label}</button>
			{action.kind === "item" ? (
				<button className={styles.tmaDuplicateAction} type="button" disabled={action.readOnly} onClick={action.duplicate}>
					{copy("Дублировать", "Duplicate")}
				</button>
			) : null}
		</div>
	);
}
