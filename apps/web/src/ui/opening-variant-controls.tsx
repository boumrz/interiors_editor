import { findRoomForFloorItem } from "../domain/parametric-item";
import type { Project, WallSide } from "../domain/project";
import { copy } from "./editor-language";
import type { OpeningVariantFields } from "./opening-creation-draft";
import { DoorMotionChoices, DoorSwingPicker } from "./door-swing-picker";
import styles from "./AppShell.module.css";
import choices from "./DoorSwingPicker.module.css";

type OpeningOptions = OpeningVariantFields & {
	readonly kind: "Door" | "Window";
	readonly swingSide?: WallSide;
	readonly hingeEnd?: "end" | null;
};

export function OpeningVariantControls<Draft extends OpeningOptions>({
	draft, disabled, insideSide, sideLabel, toSliding, onChange,
}: {
	readonly draft: Draft;
	readonly disabled: boolean;
	readonly insideSide?: WallSide | undefined;
	readonly sideLabel: (side: WallSide) => string;
	readonly toSliding: (draft: Draft) => Draft;
	readonly onChange: (draft: Draft) => void;
}) {
	if (draft.kind === "Window") {
		return (
			<fieldset className={choices.options}>
				<legend className={styles.windowSectionLegend}>{copy("Вариант", "Variant")}</legend>
				{draft.sections === undefined ? <span className={styles.windowSectionDefault}>{copy("Автоделение по ширине", "Sections by width")}</span> : null}
				{([1, 2] as const).map(sections => (
					<button type="button" disabled={disabled} key={sections} aria-pressed={draft.sections === sections}
						onClick={() => onChange({ ...draft, sections })}>
						{sections === 1 ? copy("Одна секция", "One section") : copy("Две секции", "Two sections")}
					</button>
				))}
			</fieldset>
		);
	}

	const firstSide = insideSide ?? "left";
	const secondSide: WallSide = firstSide === "left" ? "right" : "left";
	// The arrows are read while facing the opening from the selected side.
	const leftDirection = draft.slideSide === "right" ? "toward-end" : "toward-start";
	const rightDirection = leftDirection === "toward-start" ? "toward-end" : "toward-start";
	return (
		<div className={choices.rows}>
			<label className={choices.doorType}>
				<span>{copy("Тип двери", "Door type")}</span>
				<select value={draft.variant ?? "solid-swing"} disabled={disabled} onChange={event => {
					const type = event.currentTarget.value;
					if (type === "sliding") {
						onChange(toSliding(draft));
					} else if (type === "solid-swing" || type === "glazed-swing") {
						const swingSide = draft.swingSide ?? draft.slideSide;
						onChange({ ...draft, variant: type === "solid-swing" ? null : type, ...(swingSide ? { swingSide } : {}) });
					}
				}}>
					<option value="solid-swing">{copy("Глухая распашная", "Solid swing door")}</option>
					<option value="glazed-swing">{copy("Остеклённая распашная", "Glazed swing door")}</option>
					<option value="sliding">{copy("Раздвижная", "Sliding door")}</option>
				</select>
			</label>
			<div className={choices.doorMotion}>
				{draft.variant === "sliding" ? (
					<div className={choices.rows}>
						<DoorMotionChoices title={copy("Сторона полотна", "Panel side")} current={draft.slideSide} disabled={disabled}
							options={[firstSide, secondSide].map(value => ({ value, label: sideLabel(value) }))}
							onChange={slideSide => onChange({ ...draft, slideSide })} />
						<DoorMotionChoices title={copy("Куда уходит полотно", "Panel slides")} current={draft.slideDirection} disabled={disabled}
							options={[
								{ value: leftDirection, label: copy("← Влево", "← Left"), action: copy("Сдвиг влево", "Slide left") },
								{ value: rightDirection, label: copy("Вправо →", "Right →"), action: copy("Сдвиг вправо", "Slide right") },
							]} onChange={slideDirection => onChange({ ...draft, slideDirection })} />
					</div>
				) : (
					<DoorSwingPicker value={draft.swingSide} hingeEnd={draft.hingeEnd} insideSide={insideSide}
						showHingeOptions disabled={disabled} onChange={(swingSide, hingeEnd) => {
							onChange({ ...draft, swingSide, ...(hingeEnd !== undefined ? { hingeEnd } : {}) });
						}} />
				)}
			</div>
		</div>
	);
}

export function doorFaceLabel(
	project: Project | undefined,
	wallSegmentId: string | undefined,
	insideSide: WallSide | undefined,
	side: WallSide,
): string {
	if (insideSide) return side === insideSide ? copy("Внутри", "Inside") : copy("Снаружи", "Outside");
	const label = side === "left" ? copy("Сторона А", "Side A") : copy("Сторона Б", "Side B");
	if (!project) return label;
	const wall = project.level.wallSegments.find(candidate => candidate.wallSegmentId === wallSegmentId);
	if (!wall) return label;
	const start = project.level.vertices.find(vertex => vertex.vertexId === wall.startVertexId);
	const end = project.level.vertices.find(vertex => vertex.vertexId === wall.endVertexId);
	if (!start || !end) return label;
	const dx = end.xMm - start.xMm;
	const dz = end.zMm - start.zMm;
	const length = Math.hypot(dx, dz);
	if (!length) return label;
	const offset = (wall.thicknessMm / 2 + 3) * (side === "left" ? 1 : -1);
	const roomId = findRoomForFloorItem(project, {
		xMm: Math.round((start.xMm + end.xMm) / 2 - offset * dz / length),
		zMm: Math.round((start.zMm + end.zMm) / 2 + offset * dx / length),
		widthMm: 1, depthMm: 1,
	});
	const roomIndex = project.level.rooms.findIndex(candidate => candidate.roomId === roomId);
	const room = project.level.rooms[roomIndex];
	if (!room) return label;
	return room.name?.trim() || copy(`Комната ${roomIndex + 1}`, `Room ${roomIndex + 1}`);
}
