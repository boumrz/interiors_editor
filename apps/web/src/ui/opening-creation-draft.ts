import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
	type DoorOpeningProjectMutationResult,
	wallOpeningHostsForProject,
} from "../domain/door-opening-project";
import { isWallSchematicAssetInstance, type Project } from "../domain/project";

export type OpeningCreationKind = "Door" | "Window";

export interface OpeningCreationDraft {
	readonly heightMm: string;
	readonly kind: OpeningCreationKind;
	readonly offsetMm: string;
	readonly sillMm: string;
	readonly wallSegmentId: string;
	readonly widthMm: string;
}

export interface OpeningCreationHost {
	readonly heightMm: number;
	readonly lengthMm: number;
	readonly ordinal: number;
	readonly usableLengthMm: number;
	readonly wallSegmentId: string;
}

export type OpeningCreationDraftValidation =
	| {
			readonly host: OpeningCreationHost;
			readonly input: {
				readonly heightMm: number;
				readonly kind: OpeningCreationKind;
				readonly offsetMm: number;
				readonly sillMm: number;
				readonly wallSegmentId: string;
				readonly widthMm: number;
			};
			readonly kind: "valid";
	  }
	| {
			readonly kind: "invalid";
			readonly message: string;
	  };

const DEFAULT_DOOR = {
	heightMm: 2100,
	sillMm: 0,
	widthMm: 900,
} as const;

const DEFAULT_WINDOW = {
	heightMm: 1200,
	sillMm: 900,
	widthMm: 1200,
} as const;

const AUTO_PLACEMENT_STEP_MM = 100;
const MAX_AUTO_PLACEMENT_CANDIDATES = 8192;

/**
 * Width/height remain exact numeric inputs; sill is internal geometry. offsetMm is
 * retained for callers using the old draft shape; validation derives it again
 * from the current Project and never trusts that hidden field.
 */
export function openingCreationDraftFor(
	project: Project,
	wallSegmentId: string,
	kind: OpeningCreationKind = "Door",
): OpeningCreationDraft | undefined {
	const host = openingCreationHostFor(project, wallSegmentId);
	if (!host) return undefined;
	const defaults = kind === "Door" ? DEFAULT_DOOR : DEFAULT_WINDOW;
	return {
		heightMm: String(defaults.heightMm),
		kind,
		offsetMm: String(defaultOffsetMm(host.usableLengthMm, defaults.widthMm)),
		sillMm: String(defaults.sillMm),
		wallSegmentId,
		widthMm: String(defaults.widthMm),
	};
}

export function openingCreationHostFor(
	project: Project,
	wallSegmentId: string,
): OpeningCreationHost | undefined {
	const wall = project.level.wallSegments.find(
		(candidate) => candidate.wallSegmentId === wallSegmentId,
	);
	const host = wallOpeningHostsForProject(project)?.find(
		(candidate) => candidate.wallSegmentId === wallSegmentId,
	);
	if (!wall || !host) return undefined;
	const verticesById = new Map(
		project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	const start = verticesById.get(wall.startVertexId);
	const end = verticesById.get(wall.endVertexId);
	if (!start || !end) return undefined;
	return {
		heightMm: host.heightMm,
		lengthMm: Math.round(Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm)),
		ordinal:
			project.level.wallSegments.findIndex(
				(candidate) => candidate.wallSegmentId === wallSegmentId,
			) + 1,
		usableLengthMm: host.usableLengthMm,
		wallSegmentId,
	};
}

/**
 * The exact domain validator is also the live form validator. The controller
 * remains the authoritative revalidation/publish boundary when `Добавить` is
 * pressed, but the sheet can explain a rejected candidate before that point.
 */
export function validateOpeningCreationDraft(
	project: Project,
	draft: OpeningCreationDraft,
): OpeningCreationDraftValidation {
	const host = openingCreationHostFor(project, draft.wallSegmentId);
	if (!host) {
		return {
			kind: "invalid",
			message: "Выберите стену, на которой можно создать проём.",
		};
	}
	const widthMm = positiveInteger(draft.widthMm);
	const heightMm = positiveInteger(draft.heightMm);
	const sillMm = draft.kind === "Door" ? 0 : nonNegativeInteger(draft.sillMm);
	if (widthMm === undefined || heightMm === undefined || sillMm === undefined) {
		return {
			kind: "invalid",
			message:
				"Укажите целые положительные ширину и высоту.",
		};
	}
	const dimensions = {
		heightMm,
		kind: draft.kind,
		sillMm,
		wallSegmentId: draft.wallSegmentId,
		widthMm,
	} as const;
	const validate = (offsetMm: number) =>
		dimensions.kind === "Door"
			? addDoorOpeningToProject(
					project,
					{ ...dimensions, offsetMm },
					{ next: () => "opening-draft-preview" },
					project.updatedAt,
				)
			: addWindowOpeningToProject(
					project,
					{ ...dimensions, offsetMm },
					{ next: () => "opening-draft-preview" },
					project.updatedAt,
				);
	const probe = validate(Math.ceil(widthMm / 2));
	if (
		probe.kind === "rejected" &&
		probe.reasonCode !== "OPENING_OVERLAP" &&
		probe.reasonCode !== "DOOR_CLEARANCE_COLLISION" &&
		probe.reasonCode !== "WALL_OPENING_COLLISION"
	) {
		return { kind: "invalid", message: creationRejectionMessage(probe) };
	}
	const intervals = freeCentreIntervals(project, host, dimensions);
	const preferred = host.usableLengthMm / 2;
	const primary: number[] = [];
	const edges: number[] = [];
	const seen = new Set<number>();
	const add = (list: number[], offset: number) => {
		if (!seen.has(offset) && seen.size < MAX_AUTO_PLACEMENT_CANDIDATES) {
			seen.add(offset);
			list.push(offset);
		}
	};
	for (const interval of intervals) {
		const firstGrid =
			Math.ceil(interval.start / AUTO_PLACEMENT_STEP_MM) *
			AUTO_PLACEMENT_STEP_MM;
		const lastGrid =
			Math.floor(interval.end / AUTO_PLACEMENT_STEP_MM) *
			AUTO_PLACEMENT_STEP_MM;
		if (firstGrid > lastGrid) {
			add(
				primary,
				Math.max(
					interval.start,
					Math.min(interval.end, Math.ceil(preferred - 0.5)),
				),
			);
		} else {
			for (
				let offset = firstGrid;
				offset <= lastGrid && seen.size < MAX_AUTO_PLACEMENT_CANDIDATES;
				offset += AUTO_PLACEMENT_STEP_MM
			)
				add(primary, offset);
		}
	}
	// Exact interval edges are a bounded fallback when every preferred grid
	// candidate fails canonical floor clearance. This is not an exhaustive search
	// of all integer millimetres around arbitrary curved collision boundaries.
	for (const interval of intervals) {
		add(edges, interval.start);
		add(edges, interval.end);
	}
	const compare = (a: number, b: number) =>
		Math.abs(a - preferred) - Math.abs(b - preferred) || a - b;
	for (const offsetMm of [...primary.sort(compare), ...edges.sort(compare)]) {
		if (validate(offsetMm).kind === "accepted")
			return { host, input: { ...dimensions, offsetMm }, kind: "valid" };
	}
	return {
		kind: "invalid",
		message:
			intervals.length === 0
				? "На этой стене нет свободного места для такого проёма."
				: "Не удалось подобрать свободное место. Уменьшите ширину или выберите другую стену.",
	};
}

function defaultOffsetMm(usableLengthMm: number, widthMm: number): number {
	const halfWidthMm = Math.ceil(widthMm / 2);
	return Math.max(
		halfWidthMm,
		Math.min(
			usableLengthMm - halfWidthMm,
			Math.ceil(usableLengthMm / (2 * AUTO_PLACEMENT_STEP_MM) - 0.5) *
				AUTO_PLACEMENT_STEP_MM,
		),
	);
}

function freeCentreIntervals(
	project: Project,
	host: OpeningCreationHost,
	input: {
		readonly widthMm: number;
		readonly heightMm: number;
		readonly sillMm: number;
	},
): readonly { readonly start: number; readonly end: number }[] {
	const minimum = Math.ceil(input.widthMm / 2);
	const maximum = Math.floor(host.usableLengthMm - input.widthMm / 2);
	const occupied = [
		...project.level.openings.filter(
			(opening) => opening.wallSegmentId === host.wallSegmentId,
		),
		...project.assetInstances
			.filter(isWallSchematicAssetInstance)
			.filter(
				(item) =>
					item.wallSegmentId === host.wallSegmentId &&
					item.elevationMm - item.heightMm / 2 <
						input.sillMm + input.heightMm &&
					item.elevationMm + item.heightMm / 2 > input.sillMm,
			),
	]
		.map((obstacle) => ({
			start:
				Math.floor(obstacle.offsetMm - (obstacle.widthMm + input.widthMm) / 2) +
				1,
			end:
				Math.ceil(obstacle.offsetMm + (obstacle.widthMm + input.widthMm) / 2) -
				1,
		}))
		.sort((a, b) => a.start - b.start || a.end - b.end);
	const free: { start: number; end: number }[] = [];
	let cursor = minimum;
	for (const obstacle of occupied) {
		if (obstacle.end < cursor) continue;
		if (obstacle.start > maximum) break;
		if (obstacle.start > cursor)
			free.push({ start: cursor, end: Math.min(maximum, obstacle.start - 1) });
		cursor = Math.max(cursor, obstacle.end + 1);
		if (cursor > maximum) break;
	}
	if (cursor <= maximum) free.push({ start: cursor, end: maximum });
	return free;
}

function positiveInteger(raw: string): number | undefined {
	if (!/^(?:[1-9][0-9]*)$/.test(raw)) return undefined;
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : undefined;
}

function nonNegativeInteger(raw: string): number | undefined {
	if (!/^(?:0|[1-9][0-9]*)$/.test(raw)) return undefined;
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : undefined;
}

function creationRejectionMessage(
	rejection: Extract<
		DoorOpeningProjectMutationResult,
		{ readonly kind: "rejected" }
	>,
): string {
	switch (rejection.reasonCode) {
		case "DOOR_WIDTH_EXCEEDS_WALL_LENGTH":
		case "WINDOW_WIDTH_EXCEEDS_WALL_LENGTH":
			return "Ширина больше свободного участка стены.";
		case "OPENING_OVERLAP":
			return "Проём пересекается с другим проёмом.";
		case "OPENING_OUT_OF_BOUNDS":
			return "Проём не помещается по высоте стены.";
		case "OPENING_OUTSIDE_WALL_INTERVAL":
			return "Проём не помещается в свободный участок стены.";
		case "DOOR_WIDTH_BELOW_MINIMUM":
			return "Ширина дверного проёма должна быть не менее 800 мм.";
		case "INVALID_DIMENSION":
			return "Укажите точные целые миллиметры для этого проёма.";
		case "INVALID_WALL_HOST":
		case "WALL_NOT_FOUND":
			return "Выберите стену, на которой можно создать проём.";
		case "DOOR_CLEARANCE_COLLISION":
			return "Проём пересекает зону предмета. Уменьшите ширину или переместите предмет.";
		case "WALL_OPENING_COLLISION":
			return "Проём пересекается с настенным предметом.";
	}
	return "Этот проём нельзя добавить на выбранную стену.";
}
