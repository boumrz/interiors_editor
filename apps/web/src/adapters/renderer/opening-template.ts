import type { Vertex, WallOpening } from "../../domain/project";
import type { SceneBox } from "./rectangular-room-projection";

export const OPENING_FINISH = {
	frame: "#93958e",
	leaf: "#b99372",
	glass: "#8abac5",
	hardware: "#585759",
} as const;
export const GLASS_OPACITY = 0.32;
export const DIVIDED_WINDOW_MIN_WIDTH_MM = 900;

export interface OpeningPart {
	readonly box: SceneBox;
	readonly role: keyof typeof OPENING_FINISH;
	readonly wallSegmentId: string;
}

/** Frame and leaf share the opening's wall-local axes with its plan symbol. */
export function openingTemplateFor(
	opening: WallOpening,
	start: Vertex,
	end: Vertex,
	thicknessMm: number,
	minimumXmm: number,
	minimumZmm: number,
): OpeningPart[] {
	const angle = Math.atan2(end.zMm - start.zMm, end.xMm - start.xMm);
	const dx = Math.cos(angle);
	const dz = Math.sin(angle);
	const w = opening.widthMm;
	const h = opening.heightMm;
	const frame = Math.min(40, w / 8, h / 8);
	const depth = Math.min(thicknessMm, 110);
	const clear = w - frame * 2;
	const parts: OpeningPart[] = [];
	const add = (
		role: OpeningPart["role"],
		along: number,
		up: number,
		across: number,
		width: number,
		height: number,
		thickness: number,
	) => {
		const distance = opening.offsetMm - w / 2 + along;
		parts.push({
			role,
			wallSegmentId: opening.wallSegmentId,
			box: {
				centerXM: (start.xMm - minimumXmm + distance * dx - across * dz) / 1000,
				centerYM: (opening.sillMm + up) / 1000,
				centerZM: (start.zMm - minimumZmm + distance * dz + across * dx) / 1000,
				widthM: width / 1000,
				heightM: height / 1000,
				depthM: thickness / 1000,
				yawRadians: -angle,
			},
		});
	};
	add("frame", frame / 2, h / 2, 0, frame, h, depth);
	add("frame", w - frame / 2, h / 2, 0, frame, h, depth);
	add("frame", w / 2, h - frame / 2, 0, clear, frame, depth);
	if (opening.kind === "Door") {
		const leafDepth = Math.min(38, frame);
		const sign = opening.swingSide === "left" ? 1 : -1;
		add(
			"leaf",
			frame + leafDepth / 2,
			(h - frame) / 2,
			(sign * clear) / 2,
			leafDepth,
			h - frame,
			clear,
		);
		// A pair of levers joined through the leaf makes the latch edge visible
		// from either side. Very low legacy openings retain their plain leaf.
		if (h >= 300) {
			const pivot = frame + leafDepth / 2;
			const handleHeight = Math.min(1000, (h - frame) * 0.6);
			const stand = leafDepth / 2 + 37;
			const latch = clear - 67;
			add("hardware", pivot, handleHeight, sign * latch, 2 * stand, 20, 20);
			for (const face of [-1, 1]) {
				add(
					"hardware",
					pivot + face * stand,
					handleHeight,
					sign * (latch - 50),
					16,
					20,
					100,
				);
			}
		}
		return parts;
	}
	add("frame", w / 2, frame / 2, 0, clear, frame, depth);
	const glassHeight = h - frame * 2;
	const glassDepth = Math.min(8, depth / 4);
	if (w >= DIVIDED_WINDOW_MIN_WIDTH_MM) {
		const pane = (clear - frame) / 2;
		add("frame", w / 2, h / 2, 0, frame, glassHeight, depth);
		add("glass", frame + pane / 2, h / 2, 0, pane, glassHeight, glassDepth);
		add("glass", w - frame - pane / 2, h / 2, 0, pane, glassHeight, glassDepth);
	} else {
		add("glass", w / 2, h / 2, 0, clear, glassHeight, glassDepth);
	}
	return parts;
}
