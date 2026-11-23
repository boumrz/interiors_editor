import type { DoorWallOpening } from "../domain/project";
import { doorOpeningOrientation } from "../domain/door-opening-orientation";
import styles from "./AppShell.module.css";

interface PlanPoint {
	readonly x: number;
	readonly y: number;
}

export function OpeningPlanSymbol({
	kind,
	swingSide,
	hingeEnd,
	start,
	end,
	thickness,
	divided = true,
}: {
	readonly kind: "Door" | "Window";
	readonly swingSide?: DoorWallOpening["swingSide"];
	readonly hingeEnd?: DoorWallOpening["hingeEnd"] | null;
	readonly start: PlanPoint;
	readonly end: PlanPoint;
	readonly thickness: number;
	readonly divided?: boolean;
}) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const width = Math.hypot(dx, dy);
	const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
	const { hingeAtEnd, swingSign } = doorOpeningOrientation({ swingSide, hingeEnd });
	const pivot = hingeAtEnd ? width : 0;
	const freeEnd = width - pivot;
	const leafTip = swingSign * width;
	const arcSweep = hingeAtEnd === (swingSign === -1) ? 1 : 0;
	const paneOffset = thickness * 0.19;
	return (
		<g transform={`translate(${start.x} ${start.y}) rotate(${angle})`}>
			<line
				x1={0}
				x2={width}
				y1={0}
				y2={0}
				className={styles.openingSymbolCutout}
				strokeWidth={thickness + 2}
			/>
			{kind === "Door" ? (
				<>
					<line
						data-testid="door-leaf"
						x1={pivot}
						x2={pivot}
						y1={0}
						y2={leafTip}
						strokeWidth={1.8}
						vectorEffect="non-scaling-stroke"
					/>
					<path
						data-testid="door-swing"
						d={`M${freeEnd} 0 A${width} ${width} 0 0 ${arcSweep} ${pivot} ${leafTip}`}
						fill="none"
						strokeWidth={1}
						strokeDasharray="3 3"
						vectorEffect="non-scaling-stroke"
					/>
				</>
			) : (
				<>
					<rect
						data-testid="window-frame"
						x={0}
						y={-thickness / 2}
						width={width}
						height={thickness}
						fill="none"
						strokeWidth={1.3}
						vectorEffect="non-scaling-stroke"
					/>
					{[-1, 1].map((direction) => (
						<line
							data-testid="window-opening-pane"
							key={direction}
							x1={0}
							x2={width}
							y1={direction * paneOffset}
							y2={direction * paneOffset}
							strokeWidth={0.8}
							vectorEffect="non-scaling-stroke"
						/>
					))}
					{divided && (
						<line
							x1={width / 2}
							x2={width / 2}
							y1={-thickness / 2}
							y2={thickness / 2}
							strokeWidth={1.8}
							vectorEffect="non-scaling-stroke"
						/>
					)}
				</>
			)}
		</g>
	);
}
