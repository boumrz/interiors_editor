import { useId, useState } from "react";
import { formatLengthMm } from "../domain/measurement-format";
import styles from "./AppShell.module.css";
import type { ScreenPoint, ScreenRect } from "./drawing-dimension-layout";
import type { ItemWallDistance } from "./item-wall-distances";

const sideLabels = {
	left: "Слева",
	right: "Справа",
	top: "Сверху",
	bottom: "Снизу",
} as const;

function measurementLabel(distanceMm: number): string {
	return distanceMm < -1e-7
		? "Пересечение стены"
		: formatLengthMm(Math.max(0, distanceMm));
}

export function ItemWallDistanceLines({
	distances,
	projectPoint,
	bounds,
	obstacles,
}: {
	readonly distances: readonly ItemWallDistance[];
	readonly projectPoint: (point: ItemWallDistance["start"]) => ScreenPoint;
	readonly bounds: ScreenRect;
	readonly obstacles: readonly ScreenRect[];
}) {
	const occupied = [...obstacles];
	const canPlace = (rect: ScreenRect) =>
		rect.x >= bounds.x &&
		rect.y >= bounds.y &&
		rect.x + rect.width <= bounds.x + bounds.width &&
		rect.y + rect.height <= bounds.y + bounds.height &&
		!occupied.some(
			(obstacle) =>
				rect.x < obstacle.x + obstacle.width &&
				rect.x + rect.width > obstacle.x &&
				rect.y < obstacle.y + obstacle.height &&
				rect.y + rect.height > obstacle.y,
		);
	return (
		<g className={styles.itemWallDistanceLines} pointerEvents="none">
			{distances.map(({ side, start, end, distanceMm }) => {
				const from = projectPoint(start);
				const to = projectPoint(end);
				const label = measurementLabel(distanceMm);
				const horizontal = side === "left" || side === "right";
				const width = label.length * 8 + 8;
				const anchor =
					distanceMm >= 0 && Math.hypot(to.x - from.x, to.y - from.y) > 34
						? [0.5, 0.28, 0.72]
								.flatMap((position) =>
									[-1, 1].map((sign) => {
										const x =
											from.x +
											(to.x - from.x) * position +
											(horizontal ? 0 : -sign * (width / 2 + 5));
										const y =
											from.y +
											(to.y - from.y) * position +
											(horizontal ? sign * 12 : 0);
										return { x: x - width / 2, y: y - 10, width, height: 20 };
									}),
								)
								.find(canPlace)
						: undefined;
				if (anchor) occupied.push(anchor);
				const tickX = horizontal ? 0 : 4;
				const tickY = horizontal ? 4 : 0;
				return (
					<g
						data-testid="item-wall-distances"
						data-side={side}
						data-conflict={distanceMm < -1e-7 || undefined}
						key={side}
					>
						<line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
						<line
							x1={to.x - tickX}
							y1={to.y - tickY}
							x2={to.x + tickX}
							y2={to.y + tickY}
						/>
						{anchor ? (
							<text
								x={anchor.x + anchor.width / 2}
								y={anchor.y + anchor.height / 2}
								textAnchor="middle"
								dominantBaseline="central"
							>
								{label}
							</text>
						) : null}
					</g>
				);
			})}
		</g>
	);
}

export function ItemWallDistanceValues({
	distances,
}: {
	readonly distances: readonly ItemWallDistance[];
}) {
	return (
		<ul
			aria-label="Расстояния до стен"
			className={styles.itemWallDistanceValues}
		>
			{distances.map(({ side, distanceMm }) => (
				<li key={side}>
					{sideLabels[side]} <strong>{measurementLabel(distanceMm)}</strong>
				</li>
			))}
		</ul>
	);
}

export function ItemWallDistanceFields({
	distances,
	disabled,
	onApply,
	skipBlurCommit,
}: {
	readonly distances: readonly ItemWallDistance[];
	readonly disabled?: boolean;
	readonly skipBlurCommit?: (target: HTMLInputElement) => boolean;
	readonly onApply: (side: ItemWallDistance["side"], valueMm: number) => boolean | Promise<boolean>;
}) {
	const errorId = useId();
	const [errorSide, setErrorSide] = useState<ItemWallDistance["side"]>();
	const [pending, setPending] = useState(false);
	return (
		<fieldset className={styles.itemWallDistanceFields}>
			<legend className={styles.visuallyHidden}>Расстояния до стен, мм</legend>
			<div className={styles.itemWallDistanceGrid}>
				{(Object.keys(sideLabels) as ItemWallDistance["side"][]).map((side) => {
					const distance = distances.find((entry) => entry.side === side);
					const value = distance && distance.distanceMm >= -1e-7
						? String(Math.round(Math.max(0, distance.distanceMm)))
						: "";
					return (
						<div className={styles.itemWallDistanceCell} key={side}>
							<label htmlFor={`${errorId}-${side}`}>{sideLabels[side]}</label>
							<WallDistanceInput
								id={`${errorId}-${side}`}
								disabled={disabled || pending || distance === undefined}
								errorId={errorSide === side ? errorId : undefined}
								label={sideLabels[side]}
								value={value}
								skipBlurCommit={skipBlurCommit}
								onEdit={() => setErrorSide(undefined)}
								onApply={async (next) => {
									const parsed = /^[0-9]+$/.test(next) ? Number(next) : NaN;
									if (!Number.isSafeInteger(parsed)) {
										setErrorSide(side);
										return;
									}
									setPending(true);
									try {
										setErrorSide(await onApply(side, parsed) ? undefined : side);
									} finally {
										setPending(false);
									}
								}}
							/>
						</div>
					);
				})}
			</div>
			{errorSide ? (
				<p id={errorId} className={styles.fieldError} role="alert">
					Укажите доступное расстояние целым числом в мм.
				</p>
			) : null}
		</fieldset>
	);
}

function WallDistanceInput({
	id,
	disabled,
	errorId,
	label,
	value,
	skipBlurCommit,
	onEdit,
	onApply,
}: {
	readonly id: string;
	readonly disabled: boolean;
	readonly errorId?: string;
	readonly label: string;
	readonly value: string;
	readonly skipBlurCommit?: (target: HTMLInputElement) => boolean;
	readonly onEdit: () => void;
	readonly onApply: (next: string) => Promise<void>;
}) {
	const [raw, setRaw] = useState<string>();
	return (
		<input
			id={id}
			aria-describedby={errorId}
			aria-invalid={errorId ? true : undefined}
			aria-label={`${label}, мм`}
			data-editor-blur-commit=""
			disabled={disabled}
			inputMode="numeric"
			placeholder="—"
			value={raw ?? value}
			onChange={(event) => {
				onEdit();
				setRaw(event.currentTarget.value);
			}}
			onBlur={(event) => {
				if (skipBlurCommit?.(event.currentTarget)) return;
				setRaw(undefined);
				if (raw !== undefined && raw !== value) void onApply(raw.trim());
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					event.currentTarget.blur();
				}
				if (event.key === "Escape" && raw !== undefined) {
					event.preventDefault();
					event.stopPropagation();
					setRaw(undefined);
					onEdit();
				}
			}}
		/>
	);
}
