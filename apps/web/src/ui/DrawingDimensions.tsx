import type { DrawingDimensionLayout } from "./drawing-dimension-layout";
import styles from "./AppShell.module.css";

const referenceCopy = {
	axis: "по осям",
	clear: "в чистоте",
	outer: "наружный габарит",
} as const;
const kindCopy = {
	wall: "Стена",
	opening: "Проём",
	pier: "Простенок",
	overall: "Общий размер",
	"room-clear": "Помещение",
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
						aria-label={`${kindCopy[dimension.kind]} ${referenceCopy[dimension.reference]}: ${dimension.label} мм`}
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
