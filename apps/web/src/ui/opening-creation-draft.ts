import { copy } from "./editor-language";
import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
	type DoorOpeningProjectMutationResult,
	wallOpeningHostsForProject,
} from "../domain/door-opening-project";
import { isWallSchematicAssetInstance, type Project } from "../domain/project";
import { PREFERRED_WINDOW_SILL_MM } from "../domain/wall-opening";

export type OpeningCreationKind = "Door" | "Window";

export interface OpeningCreationDraft {
	readonly baseRevisionId?: string;
	readonly heightMm: string;
	readonly kind: OpeningCreationKind;
	readonly swingSide?: "left" | "right";
	readonly hingeEnd?: "end" | null;
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
				readonly swingSide?: "left" | "right";
				readonly hingeEnd?: "end";
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
	sillMm: PREFERRED_WINDOW_SILL_MM,
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
	placement?: { readonly baseRevisionId: string; readonly offsetMm: number },
): OpeningCreationDraft | undefined {
	const host = openingCreationHostFor(project, wallSegmentId);
	if (!host) return undefined;
	const defaults = kind === "Door" ? DEFAULT_DOOR : DEFAULT_WINDOW;
	return {
		...(placement ? { baseRevisionId: placement.baseRevisionId } : {}),
		heightMm: String(defaults.heightMm),
		kind,
		offsetMm: String(placement?.offsetMm ?? defaultOffsetMm(host.usableLengthMm, defaults.widthMm)),
		sillMm: String(defaults.sillMm),
		wallSegmentId,
		widthMm: String(defaults.widthMm),
	};
}

export function openingCreationHostsFor(project: Project, kind: OpeningCreationKind): readonly OpeningCreationHost[] {
	const defaults = kind === "Door" ? DEFAULT_DOOR : DEFAULT_WINDOW;
	const hosts = new Map(wallOpeningHostsForProject(project)?.map(host => [host.wallSegmentId, host]));
	const vertices = new Map(project.level.vertices.map(vertex => [vertex.vertexId, vertex]));
	return project.level.wallSegments.flatMap((wall, index) => {
		const host = hosts.get(wall.wallSegmentId);
		const start = vertices.get(wall.startVertexId);
		const end = vertices.get(wall.endVertexId);
		if (!host || !start || !end || host.usableLengthMm < defaults.widthMm || host.heightMm < defaults.heightMm + defaults.sillMm) return [];
		return [{ ...host, ordinal: index + 1, lengthMm: Math.round(Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm)) }];
	});
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
	windowSillPolicy: "draft" | "preset" = "draft",
): OpeningCreationDraftValidation {
	const host = openingCreationHostFor(project, draft.wallSegmentId);
	if (!host) {
		return {
			kind: "invalid",
			message: copy(
				"Выберите стену, на которой можно создать проём.",
				"Choose a wall that can host the opening.",
			),
		};
	}
	const widthMm = positiveInteger(draft.widthMm);
	const heightMm = positiveInteger(draft.heightMm);
	const sillMm = draft.kind === "Door"
		? DEFAULT_DOOR.sillMm
		: windowSillPolicy === "preset" ? DEFAULT_WINDOW.sillMm : nonNegativeInteger(draft.sillMm);
	if (widthMm === undefined || heightMm === undefined || sillMm === undefined) {
		return {
			kind: "invalid",
			message: copy(
				"Укажите целые положительные ширину и высоту.",
				"Enter positive whole numbers for width and height.",
			),
		};
	}
	const dimensions = {
		heightMm,
		kind: draft.kind,
		...(draft.kind === "Door" && draft.swingSide ? { swingSide: draft.swingSide } : {}),
		...(draft.kind === "Door" && draft.hingeEnd ? { hingeEnd: draft.hingeEnd } : {}),
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
	if (draft.baseRevisionId !== undefined) {
		const offsetMm = nonNegativeInteger(draft.offsetMm);
		if (offsetMm === undefined)
			return {
				kind: "invalid",
				message: copy(
					"Укажите целое смещение в миллиметрах.",
					"Enter the offset in whole millimetres.",
				),
			};
		const result = validate(offsetMm);
		return result.kind === "accepted"
			? { host, input: { ...dimensions, offsetMm }, kind: "valid" }
			: { kind: "invalid", message: creationRejectionMessage(result) };
	}
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
				? copy(
						"На этой стене нет свободного места для такого проёма.",
						"This wall has no space for an opening of this size.",
					)
				: copy(
						"Не удалось подобрать свободное место. Уменьшите ширину или выберите другую стену.",
						"No free space was found. Reduce the width or choose another wall.",
					),
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
			return copy(
				"Ширина больше свободного участка стены.",
				"The opening is wider than the available wall space.",
			);
		case "OPENING_OVERLAP":
			return copy(
				"Проём пересекается с другим проёмом.",
				"The opening overlaps another opening.",
			);
		case "OPENING_OUT_OF_BOUNDS":
			return copy(
				"Проём не помещается по высоте стены.",
				"The opening is too tall for the wall.",
			);
		case "OPENING_OUTSIDE_WALL_INTERVAL":
			return copy(
				"Проём не помещается в свободный участок стены.",
				"The opening does not fit in the available wall space.",
			);
		case "DOOR_WIDTH_BELOW_MINIMUM":
			return copy(
				"Ширина дверного проёма должна быть не менее 800 мм.",
				"The doorway must be at least 800 mm wide.",
			);
		case "INVALID_DIMENSION":
			return copy(
				"Укажите точные целые миллиметры для этого проёма.",
				"Enter the opening dimensions in whole millimetres.",
			);
		case "INVALID_WALL_HOST":
		case "WALL_NOT_FOUND":
			return copy(
				"Выберите стену, на которой можно создать проём.",
				"Choose a wall that can host the opening.",
			);
		case "DOOR_CLEARANCE_COLLISION":
			return copy(
				"Проём пересекает зону предмета. Уменьшите ширину или переместите предмет.",
				"The opening overlaps an item. Reduce the width or move the item.",
			);
		case "WALL_OPENING_COLLISION":
			return copy(
				"Проём пересекается с настенным предметом.",
				"The opening overlaps a wall-mounted item.",
			);
	}
	return copy(
		"Этот проём нельзя добавить на выбранную стену.",
		"This opening cannot be added to the selected wall.",
	);
}
