import { degreesForYawRadians } from "./rotation-angle";
import styles from "./AppShell.module.css";

/** The canvas arbitrates pointer gestures. The SVG exposes the track and keyboard control. */
export function PlacementRotationControl({
	x,
	y,
	zoom,
	yawRadians,
	disabled,
	exact,
	showHandle,
	onChange,
}: {
	readonly x: number;
	readonly y: number;
	readonly zoom: number;
	readonly yawRadians: number;
	readonly disabled: boolean;
	readonly exact: boolean;
	readonly showHandle: boolean;
	readonly onChange: (yaw: number) => void;
}) {
	const radius = 60 / zoom;
	const handleX = x + Math.sin(yawRadians) * radius;
	const handleY = y + Math.cos(yawRadians) * radius;
	const angle = degreesForYawRadians(yawRadians);
	return (
		<g
			className={styles.placementRotationControl}
			data-testid="item-placement-rotation-control"
		>
			<circle
				cx={x}
				cy={y}
				r={radius}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5 / zoom}
				strokeDasharray={`${4 / zoom} ${4 / zoom}`}
				pointerEvents="none"
			/>
			<line
				x1={x}
				y1={y}
				x2={handleX}
				y2={handleY}
				stroke="currentColor"
				strokeWidth={2 / zoom}
				pointerEvents="none"
			/>
			{showHandle ? (
				<circle
					cx={handleX}
					cy={handleY}
					r={6 / zoom}
					fill="var(--surface)"
					stroke="currentColor"
					strokeWidth={2 / zoom}
					pointerEvents="none"
				/>
			) : null}
			<circle
				aria-label="Повернуть размещаемый предмет"
				aria-disabled={disabled}
				aria-valuemin={0}
				aria-valuemax={exact ? 359.999 : 315}
				aria-valuenow={Number(angle)}
				aria-valuetext={`${angle}°`}
				cx={x}
				cy={y}
				r={radius}
				fill="none"
				stroke="black"
				strokeOpacity={0.001}
				strokeWidth={44 / zoom}
				pointerEvents={disabled ? "none" : "stroke"}
				role="slider"
				tabIndex={disabled ? -1 : 0}
				data-placement-rotation-handle=""
				data-testid="item-placement-rotation-handle"
				onKeyDown={(event) => {
					if (disabled) return;
					if (
						[
							"ArrowRight",
							"ArrowUp",
							"ArrowLeft",
							"ArrowDown",
							"Home",
						].includes(event.key)
					) {
						event.preventDefault();
						event.stopPropagation();
						onChange(
							event.key === "Home"
								? 0
								: yawRadians +
										((["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1) *
											Math.PI) /
											(exact ? 180 : 4),
						);
					}
				}}
			/>
		</g>
	);
}
