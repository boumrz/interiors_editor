import type { DoorWallOpening } from "./project";

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
	const swingSide = opening.swingSide === "left" ? "right" : "left";
	if (!preserveDoorHinges) return { ...opening, swingSide };
	const { hingeEnd, ...door } = opening;
	return {
		...door,
		swingSide,
		...(hingeEnd === "end" ? {} : { hingeEnd: "end" }),
	};
}
