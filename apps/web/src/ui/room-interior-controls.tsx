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
import sceneStyles from "./RoomScene3d.module.css";
import doorOptions from "./DoorSwingPicker.module.css";

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
	{ id: "muted-green-paint", ru: "Приглушённый зелёный", en: "Muted green", color: wallFinishColors["muted-green-paint"] },
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

export function WallColorControls({ draft, disabled, onChange }: {
	readonly draft: Extract<FinishDraft, { kind: "wall" }>;
	readonly disabled: boolean;
	readonly onChange: (draft: FinishDraft) => void;
}) {
	return (
		<fieldset aria-label={copy("Палитра стены", "Wall color palette")} className={styles.wallColorPalette} disabled={disabled}>
			<div className={sceneStyles.colorOptions}>
				{wallColors.map(({ id, ru, en, color }) => (
					<button key={en} type="button" aria-pressed={draft.finish?.presetId === id}
						onClick={() => onChange({ ...draft, finish: id ? { presetId: id, version: 1 } : undefined })}>
						<span aria-hidden="true" className={styles.itemColorSwatch} style={{ backgroundColor: color }}>
							{draft.finish?.presetId === id ? "✓" : ""}
						</span>
						<span>{copy(ru, en)}</span>
					</button>
				))}
			</div>
		</fieldset>
	);
}

export function finishLabel(finish?: SurfaceFinish) {
	const option = floorFinishes.find(candidate => candidate.id === finish?.presetId);
	return option ? copy(option.ru, option.en) : copy("По умолчанию", "Default");
}

/** Scene preview keeps its source separate from the Project used for writes. */
export function projectWithFinishPreview(project: Project, draft: FinishDraft): Project {
	if (draft.kind === "floor") {
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
	return {
		...project,
		interiorSchemaVersion: 1,
		level: {
			...project.level,
			wallSegments: project.level.wallSegments.map(wall => {
				if (wall.wallSegmentId !== draft.wallSegmentId) return wall;
				const { sideFinishes, ...rest } = wall;
				const finishes = { ...sideFinishes };
				if (draft.finish) finishes[draft.side] = draft.finish;
				else delete finishes[draft.side];
				return finishes.left || finishes.right ? { ...rest, sideFinishes: finishes } : rest;
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

type OpeningControlsDraft = import("./opening-creation-draft").OpeningVariantFields & {
	readonly kind: "Door" | "Window";
	readonly swingSide?: WallSide;
	readonly hingeEnd?: "end" | null;
};

const slidingDirections = [
	{ id: "toward-start", ru: "К началу стены", en: "Toward wall start" },
	{ id: "toward-end", ru: "К концу стены", en: "Toward wall end" },
] as const;

export function OpeningVariantControls<Draft extends OpeningControlsDraft>({
	draft, disabled, insideSide, sideLabel, onChange,
}: {
	readonly draft: Draft;
	readonly disabled: boolean;
	readonly insideSide?: WallSide | undefined;
	readonly sideLabel: (side: WallSide) => string;
	readonly onChange: (draft: Draft) => void;
}) {
	const variants = [
		{ id: null, ru: "Глухая распашная", en: "Solid swing door" },
		{ id: "glazed-swing", ru: "Остеклённая распашная", en: "Glazed swing door" },
		{ id: "sliding", ru: "Раздвижная", en: "Sliding door" },
	] as const;
	return (
		<>
			<fieldset className={draft.kind === "Window" ? doorOptions.options : styles.interiorChoices}>
				<legend className={draft.kind === "Window" ? styles.windowSectionLegend : undefined}>{copy("Вариант", "Variant")}</legend>
				{draft.kind === "Window" ? (
					<>
						{draft.sections === undefined ? <span className={styles.windowSectionDefault}>{copy("Автоделение по ширине", "Sections by width")}</span> : null}
						{([1, 2] as const).map(sections => (
							<button type="button" disabled={disabled} key={sections} aria-pressed={draft.sections === sections}
								onClick={() => onChange({ ...draft, sections })}>
								{sections === 1 ? copy("Одна секция", "One section") : copy("Две секции", "Two sections")}
							</button>
						))}
					</>
				) : variants.map(({ id, ru, en }) => (
					<button type="button" disabled={disabled} key={en} aria-pressed={(draft.variant ?? null) === id}
						onClick={() => {
							if (id === draft.variant || id === null && draft.variant === undefined) return;
							if (id === "sliding") {
								onChange({ ...draft, variant: id, slideSide: draft.swingSide ?? insideSide ?? "left" });
								return;
							}
							const { slideSide } = draft;
							onChange({
								...draft, variant: id, slideSide: undefined, slideDirection: undefined,
								...(draft.variant === "sliding" ? { swingSide: slideSide ?? insideSide ?? "left", hingeEnd: null } : {}),
							});
						}}>{copy(ru, en)}</button>
				))}
			</fieldset>
			{draft.variant === "sliding" ? (
				<>
					<fieldset className={styles.interiorChoices}>
						<legend>{copy("Сторона стены", "Wall side")}</legend>
						{(["left", "right"] as const).map(side => (
							<button type="button" disabled={disabled} key={side} aria-pressed={draft.slideSide === side}
								onClick={() => onChange({ ...draft, slideSide: side })}>{sideLabel(side)}</button>
						))}
					</fieldset>
					<fieldset className={styles.interiorChoices}>
						<legend>{copy("Направление сдвига", "Sliding direction")}</legend>
						{slidingDirections.map(({ id, ru, en }) => (
							<button type="button" disabled={disabled} key={id} aria-pressed={draft.slideDirection === id}
								onClick={() => onChange({ ...draft, slideDirection: id })}>{copy(ru, en)}</button>
						))}
					</fieldset>
				</>
			) : null}
		</>
	);
}
