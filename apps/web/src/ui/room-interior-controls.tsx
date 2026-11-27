import type {
	FloorFinishId,
	Project,
	SurfaceFinish,
	WallFinish,
	WallSide,
} from "../domain/project";
import { type RefObject, useState } from "react";
import { floorFinishColors, parseCustomWallFinish, wallFinishColor } from "../domain/interior-materials";
import { resolveOrthogonalPlanFaces } from "../domain/derived-orthogonal-plan-faces";
import { copy } from "./editor-language";
import styles from "./AppShell.module.css";
import { TelegramColorPaletteDialog } from "./telegram-item-color";

export type FinishDraft =
	| { readonly kind: "floor"; readonly roomId: string; readonly finish: SurfaceFinish<FloorFinishId> | undefined }
	| { readonly kind: "wall"; readonly wallSegmentId: string; readonly side: WallSide; readonly finish: WallFinish | undefined };

type FinishOption<Id extends string> = {
	readonly id: Id;
	readonly ru: string;
	readonly en: string;
	readonly color: string;
};

const floorFinishes: readonly FinishOption<FloorFinishId>[] = [
	{ id: "light-oak", ru: "Светлый дуб", en: "Light oak", color: floorFinishColors["light-oak"] },
	{ id: "matte-floor-tile", ru: "Матовая плитка", en: "Matte tile", color: floorFinishColors["matte-floor-tile"] },
	{ id: "plain-floor", ru: "Однотонное покрытие", en: "Solid finish", color: floorFinishColors["plain-floor"] },
];

const defaultSwatch = "var(--editor-host-line, var(--line))";
const wallSwatches: readonly {
	readonly ru: string;
	readonly en: string;
	readonly finish?: WallFinish;
}[] = [
	{ ru: "По умолчанию", en: "Default" },
	{ ru: "Тёплый белый", en: "Warm white", finish: { presetId: "warm-white-paint", version: 1 } },
	{ ru: "Песочный", en: "Sand", finish: { presetId: "sand-paint", version: 1 } },
	{ ru: "Зелёный", en: "Green", finish: { presetId: "muted-green-paint", version: 1 } },
	{ ru: "Серо-голубой", en: "Blue gray", finish: { color: "#859eaf", version: 2 } },
	{ ru: "Сиреневый", en: "Lilac", finish: { color: "#aa9cb8", version: 2 } },
	{ ru: "Терракотовый", en: "Terracotta", finish: { color: "#b77361", version: 2 } },
	{ ru: "Графитовый", en: "Graphite", finish: { color: "#525b62", version: 2 } },
];

type WallPoint = { readonly xMm: number; readonly zMm: number };

export function WallColorButton({ finish, disabled, triggerRef, onClick }: {
	readonly finish: WallFinish | undefined;
	readonly disabled: boolean;
	readonly triggerRef: RefObject<HTMLButtonElement | null>;
	readonly onClick: () => void;
}) {
	return (
		<button type="button" ref={triggerRef} aria-haspopup="dialog" className={styles.wallColorButton}
			disabled={disabled} onClick={onClick}>
			<span aria-hidden="true" className={styles.itemColorSwatch}
				style={{ backgroundColor: finish ? wallFinishColor(finish) : defaultSwatch }} />
			{copy("Цвет стены", "Wall color")}
		</button>
	);
}

export function interiorWallSide(project: Project, wallId: string, target?: WallSide | WallPoint): WallSide | undefined {
	const wall = project.level.wallSegments.find(candidate => candidate.wallSegmentId === wallId);
	const start = project.level.vertices.find(vertex => vertex.vertexId === wall?.startVertexId);
	const end = project.level.vertices.find(vertex => vertex.vertexId === wall?.endVertexId);
	if (!start || !end) return undefined;
	const dx = end.xMm - start.xMm;
	const dz = end.zMm - start.zMm;
	const projection = resolveOrthogonalPlanFaces(project);
	const outward = projection.kind === "accepted"
		? projection.plan.walls.find(candidate => candidate.wallSegmentId === wallId)?.exteriorNormal
		: undefined;
	if (outward) return dx * outward.z - dz * outward.x > 0 ? "right" : "left";
	if (target === undefined || typeof target === "string") return target;
	return dx * (target.zMm - start.zMm) - dz * (target.xMm - start.xMm) < 0 ? "right" : "left";
}

export function WallColorPalette({ draft, disabled, busy, error, onClose, onSelect }: {
	readonly draft: Extract<FinishDraft, { kind: "wall" }>;
	readonly disabled: boolean;
	readonly busy: boolean;
	readonly error: string | undefined;
	readonly onClose: () => void;
	readonly onSelect: (finish: WallFinish | undefined) => void;
}) {
	const currentColor = draft.finish ? wallFinishColor(draft.finish) : undefined;
	const [hex, setHex] = useState(currentColor ?? "#eae2d5");
	const custom = parseCustomWallFinish(hex);
	const canApply = custom !== undefined && custom.color !== currentColor && !disabled;
	return (
		<TelegramColorPaletteDialog title={copy("Цвет стены", "Wall color")}
			busy={busy} error={error} onClose={onClose}
			customControl={(
				<form className={styles.wallCustomColor} onSubmit={event => {
					event.preventDefault();
					if (canApply) onSelect(custom);
				}}>
					<h3>{copy("Свой цвет", "Custom color")}</h3>
					<input className={styles.wallCustomColorPicker} type="color" value={custom?.color ?? currentColor ?? "#eae2d5"}
						aria-label={copy("Выбрать свой цвет", "Choose custom color")}
						disabled={disabled} onChange={event => setHex(event.currentTarget.value)} />
					<input className={styles.wallCustomColorHex} type="text" value={hex} maxLength={7} spellCheck={false} autoCapitalize="off"
						aria-label={copy("Код цвета HEX", "HEX color code")}
						disabled={disabled} onChange={event => setHex(event.currentTarget.value)} />
					<button type="submit" aria-label={copy("Применить свой цвет", "Apply custom color")}
						disabled={!canApply}>
						{copy("Применить", "Apply")}
					</button>
				</form>
			)}>
			{wallSwatches.map(({ finish, ru, en }) => {
				const swatch = finish ? wallFinishColor(finish) : undefined;
				const active = draft.finish?.version === finish?.version && currentColor === swatch;
				return (
					<button key={en} type="button" aria-label={copy(ru, en)}
						aria-pressed={active} disabled={disabled} onClick={() => onSelect(finish)}>
						<span aria-hidden="true" className={styles.itemColorSwatch} style={{ backgroundColor: swatch ?? defaultSwatch }}>
							{active ? "✓" : ""}
						</span>
					</button>
				);
			})}
		</TelegramColorPaletteDialog>
	);
}

export function finishLabel(finish?: SurfaceFinish) {
	const option = floorFinishes.find(candidate => candidate.id === finish?.presetId);
	return option ? copy(option.ru, option.en) : copy("По умолчанию", "Default");
}

export function FloorFinishPalette({ draft, disabled, busy, error, onClose, onSelect }: {
	readonly draft: Extract<FinishDraft, { kind: "floor" }>;
	readonly disabled: boolean;
	readonly busy: boolean;
	readonly error?: string | undefined;
	readonly onClose: () => void;
	readonly onSelect: (finish: SurfaceFinish<FloorFinishId> | undefined) => void;
}) {
	return (
		<TelegramColorPaletteDialog title={copy("Материал пола", "Floor material")} labeledSwatches
			busy={busy} error={error} onClose={onClose}>
			<button type="button" aria-pressed={!draft.finish} disabled={disabled} onClick={() => onSelect(undefined)}>
				<span aria-hidden="true" className={styles.itemColorSwatch} style={{ backgroundColor: defaultSwatch }}>
					{!draft.finish ? "✓" : ""}
				</span>
				{finishLabel()}
			</button>
			{floorFinishes.map(({ id, ru, en, color }) => {
				const active = draft.finish?.presetId === id;
				return (
					<button key={id} type="button" aria-pressed={active} disabled={disabled}
						onClick={() => onSelect({ presetId: id, version: 1 })}>
						<span aria-hidden="true" className={styles.itemColorSwatch} style={{ backgroundColor: color }}>
							{active ? "✓" : ""}
						</span>
						{copy(ru, en)}
					</button>
				);
			})}
		</TelegramColorPaletteDialog>
	);
}
