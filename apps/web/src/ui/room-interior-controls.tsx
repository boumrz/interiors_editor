import type {
	FloorFinishId,
	Project,
	SurfaceFinish,
	WallFinishId,
	WallSide,
} from "../domain/project";
import { floorFinishColors, wallFinishColors } from "../domain/interior-materials";
import { resolveOrthogonalPlanFaces } from "../domain/derived-orthogonal-plan-faces";
import { copy } from "./editor-language";
import styles from "./AppShell.module.css";
import { TelegramColorPaletteDialog } from "./telegram-item-color";

export type FinishDraft =
	| { readonly kind: "floor"; readonly roomId: string; readonly finish: SurfaceFinish<FloorFinishId> | undefined }
	| { readonly kind: "wall"; readonly wallSegmentId: string; readonly side: WallSide; readonly finish: SurfaceFinish<WallFinishId> | undefined };

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

const wallColors = [
	{ id: undefined, ru: "По умолчанию", en: "Default", color: "var(--editor-host-line, var(--line))" },
	{ id: "warm-white-paint", ru: "Тёплый белый", en: "Warm white", color: wallFinishColors["warm-white-paint"] },
	{ id: "sand-paint", ru: "Песочный", en: "Sand", color: wallFinishColors["sand-paint"] },
	{ id: "muted-green-paint", ru: "Зелёный", en: "Green", color: wallFinishColors["muted-green-paint"] },
] as const;

type WallPoint = { readonly xMm: number; readonly zMm: number };

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
	readonly onSelect: (finish: SurfaceFinish<WallFinishId> | undefined) => void;
}) {
	const current = wallColors.find(color => color.id === draft.finish?.presetId);
	return (
		<TelegramColorPaletteDialog title={copy("Цвет стены", "Wall color")}
			currentLabel={current && copy(current.ru, current.en)} busy={busy} error={error} onClose={onClose}>
			{wallColors.map(({ id, ru, en, color }) => (
				<button key={en} type="button" aria-pressed={draft.finish?.presetId === id} disabled={disabled}
					onClick={() => onSelect(id ? { presetId: id, version: 1 } : undefined)}>
					<span aria-hidden="true" className={styles.itemColorSwatch} style={{ backgroundColor: color }}>
						{draft.finish?.presetId === id ? "✓" : ""}
					</span>
					<span>{copy(ru, en)}</span>
				</button>
			))}
		</TelegramColorPaletteDialog>
	);
}

export function finishLabel(finish?: SurfaceFinish) {
	const option = floorFinishes.find(candidate => candidate.id === finish?.presetId);
	return option ? copy(option.ru, option.en) : copy("По умолчанию", "Default");
}

/** Scene preview keeps its source separate from the Project used for writes. */
export function projectWithFinishPreview(project: Project, draft: Extract<FinishDraft, { kind: "floor" }>): Project {
	return {
		...project,
		interiorSchemaVersion: 1,
		level: {
			...project.level,
			rooms: project.level.rooms.map(room => {
				if (room.roomId !== draft.roomId) return room;
				const { floorFinish: _current, ...rest } = room;
				return draft.finish ? { ...rest, floorFinish: draft.finish } : rest;
			}),
		},
	};
}

type RoomFinishControlsProps = {
	readonly draft: Extract<FinishDraft, { kind: "floor" }>;
	readonly disabled: boolean;
	readonly onChange: (draft: FinishDraft) => void;
};

export function RoomFinishControls({ draft, disabled, onChange }: RoomFinishControlsProps) {
	const defaultButton = (
		<button aria-pressed={!draft.finish} disabled={disabled} type="button" onClick={() => onChange({ ...draft, finish: undefined })}>
			{copy("По умолчанию", "Default")}
		</button>
	);
	const renderOption = <Id extends string>(option: FinishOption<Id>, onSelect: () => void) => (
		<button aria-pressed={draft.finish?.presetId === option.id} disabled={disabled} key={option.id} onClick={onSelect} type="button">
			<span aria-hidden="true" style={{ background: option.color }} />
			{copy(option.ru, option.en)}
		</button>
	);
	return (
		<>
			{defaultButton}
			{floorFinishes.map(option => renderOption(option, () => onChange({ ...draft, finish: { presetId: option.id, version: 1 } })))}
		</>
	);
}
