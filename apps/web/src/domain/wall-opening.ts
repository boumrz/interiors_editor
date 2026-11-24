import type { WallOpening } from "./project";

/**
 * СП 59.13330.2020, clause 7.1.6 sets an 0.80 m clear opening minimum for
 * inter-room and sanitary residential doors. The alpha door tool models that
 * residential route, so a narrower value must never become durable geometry.
 */
export const MINIMUM_RESIDENTIAL_DOORWAY_WIDTH_MM = 800;
export const PREFERRED_WINDOW_SILL_MM = 900;

/**
 * A wall host exposes the already-derived usable interval and permitted
 * opening height for one canonical WallSegment. For a shared wall, the caller
 * supplies the lower adjacent-room height. Keeping this input separate from
 * Project lets the topology/room resolver remain the owner of derived wall
 * geometry.
 */
export interface WallOpeningHost {
	readonly wallSegmentId: string;
	readonly usableLengthMm: number;
	readonly heightMm: number;
}

export type { WallOpening } from "./project";

export type DoorOpening = Extract<WallOpening, { readonly kind: "Door" }>;
export type WindowOpening = Extract<WallOpening, { readonly kind: "Window" }>;

export interface AddDoorOpeningInput {
	readonly wallSegmentId: string;
	readonly offsetMm: number;
	readonly widthMm: number;
	readonly heightMm: number;
	readonly sillMm: number;
	readonly swingSide?: "left" | "right";
	readonly hingeEnd?: "end";
}

/** Windows share the canonical host/interval contract, but have no hinge state. */
export interface AddWindowOpeningInput {
	readonly wallSegmentId: string;
	readonly offsetMm: number;
	readonly widthMm: number;
	readonly heightMm: number;
	readonly sillMm: number;
}

/** A single atomic edit preserves the durable Opening identity and host. */
export interface UpdateWallOpeningInput {
	readonly heightMm?: number;
	readonly openingId: string;
	readonly offsetMm?: number;
	readonly sillMm?: number;
	readonly swingSide?: "left" | "right";
	readonly hingeEnd?: "end" | null;
	readonly widthMm?: number;
}

export interface WallOpeningState {
	readonly wallHosts: readonly WallOpeningHost[];
	readonly openings: readonly WallOpening[];
}

export interface WallOpeningIntervalMm {
	readonly startMm: number;
	readonly endMm: number;
}

interface IdSource {
	next(): string;
}

export type WallOpeningRejection = {
	readonly kind: "rejected";
	readonly reasonCode:
		| "INVALID_DIMENSION"
		| "INVALID_WALL_HOST"
		| "DOOR_WIDTH_BELOW_MINIMUM"
		| "DOOR_WIDTH_EXCEEDS_WALL_LENGTH"
		| "WINDOW_WIDTH_EXCEEDS_WALL_LENGTH"
		| "OPENING_OUT_OF_BOUNDS"
		| "OPENING_OUTSIDE_WALL_INTERVAL"
		| "OPENING_OVERLAP"
		| "WALL_NOT_FOUND";
};

export type AddDoorOpeningResult =
	| { readonly kind: "accepted"; readonly openings: readonly WallOpening[] }
	| WallOpeningRejection;

export type AddWindowOpeningResult =
	| { readonly kind: "accepted"; readonly openings: readonly WallOpening[] }
	| WallOpeningRejection;

export type DeleteWallOpeningResult =
	| { readonly kind: "accepted"; readonly openings: readonly WallOpening[] }
	| { readonly kind: "rejected"; readonly reasonCode: "OPENING_NOT_FOUND" };

export type MoveWallOpeningResult =
	| { readonly kind: "accepted"; readonly openings: readonly WallOpening[] }
	| Extract<AddDoorOpeningResult, { readonly kind: "rejected" }>
	| { readonly kind: "rejected"; readonly reasonCode: "OPENING_NOT_FOUND" };

export type UpdateWallOpeningResult = MoveWallOpeningResult;

export type WallOpeningPlacementAssessment =
	| { readonly kind: "accepted" }
	| WallOpeningRejection;

/** Validates a detached door address without allocating identity or changing state. */
export function assessDoorOpeningPlacement(
	state: WallOpeningState,
	input: AddDoorOpeningInput,
): WallOpeningPlacementAssessment {
	if (!hasValidDimensions(input) || !hasValidSwingSide(input.swingSide) ||
		(input.hingeEnd !== undefined && input.hingeEnd !== "end")) {
		return rejectAdd("INVALID_DIMENSION");
	}

	const hosts = state.wallHosts.filter(
		(host) => host.wallSegmentId === input.wallSegmentId,
	);
	const host = hosts[0];
	if (!host) {
		return rejectAdd("WALL_NOT_FOUND");
	}
	if (hosts.length !== 1 || !hasValidHost(host)) {
		return rejectAdd("INVALID_WALL_HOST");
	}
	if (input.widthMm < MINIMUM_RESIDENTIAL_DOORWAY_WIDTH_MM) {
		return rejectAdd("DOOR_WIDTH_BELOW_MINIMUM");
	}
	if (input.widthMm > host.usableLengthMm) {
		return rejectAdd("DOOR_WIDTH_EXCEEDS_WALL_LENGTH");
	}
	if (!fitsWithinInterval(input, host.usableLengthMm)) {
		return rejectAdd("OPENING_OUTSIDE_WALL_INTERVAL");
	}
	if (!fitsWithinHeight(input, host.heightMm)) {
		return rejectAdd("OPENING_OUT_OF_BOUNDS");
	}
	if (
		state.openings.some(
			(opening) =>
				opening.wallSegmentId === input.wallSegmentId &&
				intervalsPositivelyOverlap(opening, input),
		)
	) {
		return rejectAdd("OPENING_OVERLAP");
	}

	return { kind: "accepted" };
}

/** Validates a detached window address without allocating identity or changing state. */
export function assessWindowOpeningPlacement(
	state: WallOpeningState,
	input: AddWindowOpeningInput,
): WallOpeningPlacementAssessment {
	if (!hasValidDimensions(input) || Object.hasOwn(input, "hingeEnd")) {
		return rejectAdd("INVALID_DIMENSION");
	}

	const hosts = state.wallHosts.filter(
		(host) => host.wallSegmentId === input.wallSegmentId,
	);
	const host = hosts[0];
	if (!host) {
		return rejectAdd("WALL_NOT_FOUND");
	}
	if (hosts.length !== 1 || !hasValidHost(host)) {
		return rejectAdd("INVALID_WALL_HOST");
	}
	if (input.widthMm > host.usableLengthMm) {
		return rejectAdd("WINDOW_WIDTH_EXCEEDS_WALL_LENGTH");
	}
	if (!fitsWithinInterval(input, host.usableLengthMm)) {
		return rejectAdd("OPENING_OUTSIDE_WALL_INTERVAL");
	}
	if (!fitsWithinHeight(input, host.heightMm)) {
		return rejectAdd("OPENING_OUT_OF_BOUNDS");
	}
	if (
		state.openings.some(
			(opening) =>
				opening.wallSegmentId === input.wallSegmentId &&
				intervalsPositivelyOverlap(opening, input),
		)
	) {
		return rejectAdd("OPENING_OVERLAP");
	}

	return { kind: "accepted" };
}

/**
 * Adds a Door to one selected canonical WallSegment. Its offset
 * is the centre of its width, so an interval can be checked exactly without a
 * UI or renderer deciding where a wall begins.
 */
export function addDoorOpening(
	state: WallOpeningState,
	input: AddDoorOpeningInput,
	ids: IdSource,
): AddDoorOpeningResult {
	const assessment = assessDoorOpeningPlacement(state, input);
	if (assessment.kind === "rejected") return assessment;

	const { hingeEnd, ...dimensions } = input;
	const opening: DoorOpening = {
		...dimensions,
		kind: "Door",
		openingId: ids.next(),
		swingSide: input.swingSide ?? "right",
		...(hingeEnd === "end" ? { hingeEnd } : {}),
	};
	return { kind: "accepted", openings: [...state.openings, opening] };
}

/**
 * Adds a Window to one selected canonical WallSegment. A window is an exact
 * wall-hosted opening like a door, except it has no residential doorway
 * minimum or swing side.
 */
export function addWindowOpening(
	state: WallOpeningState,
	input: AddWindowOpeningInput,
	ids: IdSource,
): AddWindowOpeningResult {
	const assessment = assessWindowOpeningPlacement(state, input);
	if (assessment.kind === "rejected") return assessment;

	const opening: WindowOpening = {
		...input,
		kind: "Window",
		openingId: ids.next(),
	};
	return { kind: "accepted", openings: [...state.openings, opening] };
}

/** Removes exactly one stable opening identity; a wall is never inferred or changed here. */
export function deleteWallOpening(
	openings: readonly WallOpening[],
	openingId: string,
): DeleteWallOpeningResult {
	if (!openings.some((opening) => opening.openingId === openingId)) {
		return { kind: "rejected", reasonCode: "OPENING_NOT_FOUND" };
	}
	return {
		kind: "accepted",
		openings: openings.filter((opening) => opening.openingId !== openingId),
	};
}

/**
 * Repositions one existing Opening on its unchanged wall host. Validation is
 * deliberately the same as creation, except the selected opening is omitted
 * from the overlap check so its durable identity never changes.
 */
export function moveWallOpening(
	state: WallOpeningState,
	input: { readonly openingId: string; readonly offsetMm: number },
): MoveWallOpeningResult {
	return updateWallOpening(state, input);
}

/**
 * Changes only supplied editable Opening fields. Geometry and overlap
 * validation is shared with creation, so a direct 2D drag and a numeric edit
 * have exactly the same safe durable result.
 */
export function updateWallOpening(
	state: WallOpeningState,
	input: UpdateWallOpeningInput,
): UpdateWallOpeningResult {
	const opening = state.openings.find(
		(candidate) => candidate.openingId === input.openingId,
	);
	if (!opening) {
		return { kind: "rejected", reasonCode: "OPENING_NOT_FOUND" };
	}
	if (
		(opening.kind === "Window" && (input.swingSide !== undefined || input.hingeEnd !== undefined)) ||
		(input.hingeEnd !== undefined && input.hingeEnd !== null && input.hingeEnd !== "end")
	) {
		return rejectAdd("INVALID_DIMENSION");
	}
	const dimensions = {
		...(input.offsetMm === undefined ? {} : { offsetMm: input.offsetMm }),
		...(input.widthMm === undefined ? {} : { widthMm: input.widthMm }),
		...(input.heightMm === undefined ? {} : { heightMm: input.heightMm }),
		...(input.sillMm === undefined ? {} : { sillMm: input.sillMm }),
	};
	let moved: WallOpening = { ...opening, ...dimensions };
	if (opening.kind === "Door") {
		const { hingeEnd, ...door } = opening;
		const nextHinge = input.hingeEnd === undefined ? hingeEnd : input.hingeEnd;
		moved = {
			...door,
			...dimensions,
			...(input.swingSide === undefined ? {} : { swingSide: input.swingSide }),
			...(nextHinge === "end" ? { hingeEnd: nextHinge } : {}),
		};
	}
	if (!hasValidDimensions(moved) || !hasValidSwingSide(moved.swingSide)) {
		return rejectAdd("INVALID_DIMENSION");
	}
	const hosts = state.wallHosts.filter(
		(host) => host.wallSegmentId === moved.wallSegmentId,
	);
	const host = hosts[0];
	if (!host) {
		return rejectAdd("WALL_NOT_FOUND");
	}
	if (hosts.length !== 1 || !hasValidHost(host)) {
		return rejectAdd("INVALID_WALL_HOST");
	}
	if (
		moved.kind === "Door" &&
		moved.widthMm < MINIMUM_RESIDENTIAL_DOORWAY_WIDTH_MM
	) {
		return rejectAdd("DOOR_WIDTH_BELOW_MINIMUM");
	}
	if (moved.widthMm > host.usableLengthMm) {
		return rejectAdd(
			moved.kind === "Door"
				? "DOOR_WIDTH_EXCEEDS_WALL_LENGTH"
				: "WINDOW_WIDTH_EXCEEDS_WALL_LENGTH",
		);
	}
	if (!fitsWithinInterval(moved, host.usableLengthMm)) {
		return rejectAdd("OPENING_OUTSIDE_WALL_INTERVAL");
	}
	if (!fitsWithinHeight(moved, host.heightMm)) {
		return rejectAdd("OPENING_OUT_OF_BOUNDS");
	}
	if (
		state.openings.some(
			(candidate) =>
				candidate.openingId !== moved.openingId &&
				candidate.wallSegmentId === moved.wallSegmentId &&
				intervalsPositivelyOverlap(candidate, moved),
		)
	) {
		return rejectAdd("OPENING_OVERLAP");
	}
	return {
		kind: "accepted",
		openings: state.openings.map((candidate) =>
			candidate.openingId === moved.openingId ? moved : candidate,
		),
	};
}

/** A projection helper for the same centre-offset contract used by validation. */
export function wallOpeningIntervalMm(
	opening: Pick<WallOpening, "offsetMm" | "widthMm">,
): WallOpeningIntervalMm {
	return {
		endMm: opening.offsetMm + opening.widthMm / 2,
		startMm: opening.offsetMm - opening.widthMm / 2,
	};
}

function hasValidDimensions(
	input: Pick<WallOpening, "offsetMm" | "widthMm" | "heightMm" | "sillMm">,
): boolean {
	return (
		[input.offsetMm, input.widthMm, input.heightMm, input.sillMm].every(
			Number.isSafeInteger,
		) &&
		input.offsetMm >= 0 &&
		input.widthMm > 0 &&
		input.heightMm > 0 &&
		input.sillMm >= 0
	);
}

function hasValidSwingSide(
	value: unknown,
): value is "left" | "right" | undefined {
	return value === undefined || value === "left" || value === "right";
}

function hasValidHost(host: WallOpeningHost): boolean {
	return (
		Boolean(host.wallSegmentId) &&
		Number.isSafeInteger(host.usableLengthMm) &&
		Number.isSafeInteger(host.heightMm) &&
		host.usableLengthMm > 0 &&
		host.heightMm > 0
	);
}

function fitsWithinInterval(
	input: Pick<WallOpening, "offsetMm" | "widthMm">,
	usableLengthMm: number,
): boolean {
	const interval = doubledInterval(input);
	return interval.start >= 0n && interval.end <= BigInt(usableLengthMm) * 2n;
}

function fitsWithinHeight(
	input: Pick<WallOpening, "heightMm" | "sillMm">,
	wallHeightMm: number,
): boolean {
	return BigInt(input.sillMm) + BigInt(input.heightMm) <= BigInt(wallHeightMm);
}

function intervalsPositivelyOverlap(
	first: Pick<WallOpening, "offsetMm" | "widthMm">,
	second: Pick<WallOpening, "offsetMm" | "widthMm">,
): boolean {
	const firstInterval = doubledInterval(first);
	const secondInterval = doubledInterval(second);
	return (
		firstInterval.start < secondInterval.end &&
		firstInterval.end > secondInterval.start
	);
}

function doubledInterval(opening: Pick<WallOpening, "offsetMm" | "widthMm">): {
	readonly start: bigint;
	readonly end: bigint;
} {
	const centre = BigInt(opening.offsetMm) * 2n;
	const width = BigInt(opening.widthMm);
	return { end: centre + width, start: centre - width };
}

function rejectAdd(
	reasonCode: WallOpeningRejection["reasonCode"],
): WallOpeningRejection {
	return { kind: "rejected", reasonCode };
}
