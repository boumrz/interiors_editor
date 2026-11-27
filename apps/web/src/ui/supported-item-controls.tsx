import { type SupportSurface, supportSurfacesFor } from "../domain/interior-support";
import type { SupportTarget } from "../domain/interior-project";
import type { FloorSchematicAssetInstance, Project } from "../domain/project";
import { copy } from "./editor-language";
import { telegramGreyboxLabelForDisplay } from "./telegram-greybox-catalog";
import styles from "./AppShell.module.css";
import type { ReactNode } from "react";
import { yawRadiansFor } from "../domain/parametric-item";

export type SupportedEditDraft = {
	readonly mode: "catalog" | "attach" | "move" | "copy" | "rehome";
	readonly sourceId?: string;
	readonly planHostId?: string;
	readonly dragPoint?: import("./supported-drag").SupportDragPoint;
	readonly target?: SupportTarget | undefined;
};

export type SupportOption = { readonly host: FloorSchematicAssetInstance; readonly surface: SupportSurface };

export function supportOptions(project: Project): readonly SupportOption[] {
	return project.assetInstances.flatMap(host =>
		host.anchorClass === "floor" ? supportSurfacesFor(host).map(surface => ({ host, surface })) : []);
}

export function supportSurfaceLabel(key: string): string {
	if (key === "top") return copy("Верх", "Top");
	const index = key.slice("shelf-".length);
	return copy(`Полка ${index} снизу`, `Shelf ${index} from bottom`);
}

export function supportOptionLabel(option: SupportOption): string {
	return `${telegramGreyboxLabelForDisplay(option.host.label)} · ${supportSurfaceLabel(option.surface.key)}`;
}

interface SupportedPlacementControlsProps {
	readonly draft: SupportedEditDraft;
	readonly label: string;
	readonly hasTargets: boolean;
	readonly view: "plan" | "three-dimensional";
	readonly levels: readonly SupportOption[];
	readonly selected: SupportOption | undefined;
	readonly target: SupportTarget | undefined;
	readonly colorControl?: ReactNode;
	readonly targetStatus?: string | undefined;
	readonly disabled: boolean;
	readonly canConfirm: boolean;
	readonly onChooseSupport: (option: SupportOption) => void;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
}

export function SupportedPlacementControls(props: SupportedPlacementControlsProps) {
	const { draft, target, targetStatus, hasTargets, view, levels, selected, label, disabled, canConfirm } = props;
	const onFloor = target && "roomId" in target;
	const host = levels[0]?.host;
	return (
		<section aria-label={copy("Размещение декора", "Decor placement")} className={styles.interiorSupportedPanel}
			data-testid="interior-supported-placement">
			<div className={styles.supportPlacementHeader}>
				<strong>{label}</strong>
				{props.colorControl}
			</div>
			{host && view === "plan" ? (
				<fieldset className={styles.interiorSupportList}>
					<legend>{telegramGreyboxLabelForDisplay(host.label)}</legend>
					{levels.map(option => (
						<button type="button" key={option.surface.key}
							aria-label={supportOptionLabel(option)}
							aria-pressed={selected?.surface.key === option.surface.key && selected.host.assetInstanceId === option.host.assetInstanceId} disabled={disabled} onClick={() => props.onChooseSupport(option)}>
							{supportSurfaceLabel(option.surface.key)}
						</button>
					))}
				</fieldset>
			) : null}
			<p role="status">{targetStatus ?? (selected
				? `${supportOptionLabel(selected)} · ${selected.surface.heightMm} ${copy("мм", "mm")}`
				: onFloor ? copy("Пол · Место выбрано", "Floor · Position selected")
					: host ? copy("Выберите уровень.", "Choose a level.")
						: hasTargets ? copy("Коснитесь пола или подсвеченной опоры.", "Tap the floor or a highlighted support.")
							: copy("Коснитесь свободного места на полу.", "Tap a clear spot on the floor."))}</p>
			<div className={styles.interiorChoices}>
				<button type="button" onClick={props.onCancel} disabled={disabled}>{copy("Отменить", "Cancel")}</button>
				<button type="button" disabled={disabled || !canConfirm} onClick={props.onConfirm}>
					{draft.mode === "rehome" ? copy("Выбрать место", "Choose position") : copy("Подтвердить", "Confirm")}
				</button>
			</div>
		</section>
	);
}

/** Named contact surfaces supplied by the domain, projected in the same yaw as their host. */
export function supportSurfacePlanVertices({ host, surface }: SupportOption) {
	const angle = yawRadiansFor(host);
	const cosine = Math.cos(angle);
	const sine = Math.sin(angle);
	const corners = [
		{ x: surface.minXMm, z: surface.minZMm, sx: 1, sz: 1, angle: Math.PI },
		{ x: surface.maxXMm, z: surface.minZMm, sx: -1, sz: 1, angle: Math.PI * 1.5 },
		{ x: surface.maxXMm, z: surface.maxZMm, sx: -1, sz: -1, angle: 0 },
		{ x: surface.minXMm, z: surface.maxZMm, sx: 1, sz: -1, angle: Math.PI / 2 },
	];
	const outline = surface.radiusXMm === 0 || surface.radiusZMm === 0 ? corners
		: corners.flatMap(corner => [0, 1, 2, 3].map(step => {
			const radians = corner.angle + Math.PI * step / 6;
			return {
				x: corner.x + surface.radiusXMm * (corner.sx + Math.cos(radians)),
				z: corner.z + surface.radiusZMm * (corner.sz + Math.sin(radians)),
			};
		}));
	return outline.map(({ x, z }) => ({
		xMm: host.xMm + cosine * x + sine * z,
		zMm: host.zMm - sine * x + cosine * z,
	}));
}
