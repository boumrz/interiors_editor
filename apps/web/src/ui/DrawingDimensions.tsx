import { copy } from "./editor-language";
import type { DrawingDimensionLayout } from "./drawing-dimension-layout";
import styles from "./AppShell.module.css";

const referenceCopy = {
	get axis() {
		return copy("по осям", "centerline");
	},
	get clear() {
		return copy("в чистоте", "clear");
	},
	get outer() {
		return copy("наружный габарит", "outer");
	},
} as const;
const kindCopy = {
	get wall() {
		return copy("Стена", "Wall");
	},
	get opening() {
		return copy("Проём", "Opening");
	},
	get pier() {
		return copy("Простенок", "Wall pier");
	},
	get overall() {
		return copy("Общий размер", "Overall dimension");
	},
	get "room-clear"() {
		return copy("Помещение", "Room");
	},
} as const;

/** Screen-space annotations cannot capture a wall, opening or camera gesture. */
export function DrawingDimensions({
	layouts,
}: {
	readonly layouts: readonly DrawingDimensionLayout[];
}) {
	const drawnSegments = new Set<string>();
	return (
		<g
			className={styles.drawingDimensions}
			data-testid="drawing-dimensions"
			pointerEvents="none"
		>
			{layouts.map((layout) => {
				if (layout.kind !== "placed") return null;
				const { dimension } = layout;
				const segments = [
					...layout.extensionLines,
					...layout.ticks,
					...(layout.baseline ? [layout.baseline] : []),
					...(layout.leader ? [layout.leader] : []),
				];
				return (
					<g
						key={dimension.id}
						data-dimension-kind={dimension.kind}
						data-dimension-reference={dimension.reference}
						data-dimension-id={dimension.id}
						data-dimension-crowded={layout.crowded || undefined}
						data-dimension-clipped={layout.clipped || undefined}
						aria-label={copy(
							`${kindCopy[dimension.kind]} ${referenceCopy[dimension.reference]}: ${dimension.label} мм`,
							`${kindCopy[dimension.kind]} (${referenceCopy[dimension.reference]}): ${dimension.label} mm`,
						)}
					>
						{[
							...new Map(
								segments.flatMap((segment) => {
									const points = [segment.start, segment.end].sort(
										(a, b) => a.x - b.x || a.y - b.y,
									);
									const key = JSON.stringify(points);
									if (drawnSegments.has(key)) return [];
									drawnSegments.add(key);
									return [[key, segment] as const];
								}),
							).entries(),
						].map(([key, segment]) => (
							<line
								key={key}
								x1={segment.start.x}
								y1={segment.start.y}
								x2={segment.end.x}
								y2={segment.end.y}
							/>
						))}
						<text
							x={layout.textPoint.x}
							y={layout.textPoint.y}
							textAnchor="middle"
							dominantBaseline="central"
							transform={`rotate(${layout.textRotationDegrees} ${layout.textPoint.x} ${layout.textPoint.y})`}
						>
							{dimension.label}
						</text>
					</g>
				);
			})}
		</g>
	);
}
