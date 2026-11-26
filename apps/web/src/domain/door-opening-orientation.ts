import type { DoorWallOpening, OpeningSlideDirection, WallSide } from "./project";

export function doorOpeningOrientation({
	swingSide,
	hingeEnd,
}: {
	readonly swingSide?: DoorWallOpening["swingSide"];
	readonly hingeEnd?: DoorWallOpening["hingeEnd"] | null;
}): { readonly hingeAtEnd: boolean; readonly swingSign: 1 | -1 } {
	return {
		hingeAtEnd: hingeEnd === "end",
		swingSign: swingSide === "left" ? 1 : -1,
	};
}

/** Re-expresses a door on an oppositely directed wall. */
export function reverseDoorOpeningOrientation(
	opening: DoorWallOpening,
	preserveDoorHinges: boolean,
): DoorWallOpening {
	if (opening.variant === "sliding") {
		const slideSide: WallSide = opening.slideSide === "left" ? "right" : "left";
		const slideDirection: OpeningSlideDirection = opening.slideDirection === "toward-start" ? "toward-end" : "toward-start";
		return {
			...opening,
			variant: "sliding",
			slideSide,
			slideDirection,
		};
	}
	const swingSide = opening.swingSide === "left" ? "right" : "left";
	if (!preserveDoorHinges) return { ...opening, swingSide };
	const { hingeEnd, ...door } = opening;
	return {
		...door,
		swingSide,
		...(hingeEnd === "end" ? {} : { hingeEnd: "end" }),
	};
}
