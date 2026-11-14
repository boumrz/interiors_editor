import { useCallback, useEffect, useRef } from "react";
import {
	beginRotationDomeGesture,
	moveRotationDomeGesture,
	type RotationDomeGesture,
} from "./three-dimensional-rotation-gesture";
import { degreesForYawRadians } from "./rotation-angle";
import styles from "./AppShell.module.css";

/** Transient pose only: this control never publishes a Project command. */
export function PlacementRotationControl({
	x,
	y,
	zoom,
	yawRadians,
	disabled,
	onChange,
	onContactChange,
}: {
	readonly x: number;
	readonly y: number;
	readonly zoom: number;
	readonly yawRadians: number;
	readonly disabled: boolean;
	readonly onChange: (yaw: number) => void;
	readonly onContactChange: (pointerId: number, isActive: boolean) => void;
}) {
	const gesture = useRef<RotationDomeGesture | undefined>(undefined);
	const contactId = useRef<number | undefined>(undefined);
	const onChangeRef = useRef(onChange);
	const onContactChangeRef = useRef(onContactChange);
	onChangeRef.current = onChange;
	onContactChangeRef.current = onContactChange;
	const releaseContact = useCallback(() => {
		const pointerId = contactId.current;
		if (pointerId === undefined) return;
		contactId.current = undefined;
		onContactChangeRef.current(pointerId, false);
	}, []);
	const cancel = useCallback(() => {
		const active = gesture.current;
		gesture.current = undefined;
		if (active) onChangeRef.current(active.initialYawRadians);
	}, []);
	useEffect(() => {
		const outsidePointer = (event: PointerEvent) => {
			if (gesture.current && gesture.current.pointerId !== event.pointerId)
				cancel();
		};
		const key = (event: KeyboardEvent) => {
			if (event.key === "Escape") cancel();
		};
		const visibility = () => {
			if (document.hidden) cancel();
		};
		window.addEventListener("pointerdown", outsidePointer, true);
		window.addEventListener("keydown", key);
		window.addEventListener("blur", cancel);
		document.addEventListener("visibilitychange", visibility);
		return () => {
			window.removeEventListener("pointerdown", outsidePointer, true);
			window.removeEventListener("keydown", key);
			window.removeEventListener("blur", cancel);
			document.removeEventListener("visibilitychange", visibility);
			cancel();
			releaseContact();
		};
	}, [cancel, releaseContact]);
	useEffect(() => {
		if (disabled) cancel();
	}, [disabled, cancel]);
	const centre = (element: SVGCircleElement) => {
		const matrix = element.getScreenCTM();
		if (!matrix) return undefined;
		return new DOMPoint(x, y).matrixTransform(matrix);
	};
	const radius = 60 / zoom;
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
				x2={x + Math.sin(yawRadians) * radius}
				y2={y + Math.cos(yawRadians) * radius}
				stroke="currentColor"
				strokeWidth={2 / zoom}
				pointerEvents="none"
			/>
			<circle
				aria-label="Повернуть размещаемый предмет"
				aria-disabled={disabled}
				aria-valuemin={0}
				aria-valuemax={315}
				aria-valuenow={Number(degreesForYawRadians(yawRadians))}
				aria-valuetext={`${degreesForYawRadians(yawRadians)}°`}
				cx={x}
				cy={y}
				r={radius}
				fill="none"
				stroke="transparent"
				strokeWidth={44 / zoom}
				pointerEvents={disabled ? "none" : "stroke"}
				role="slider"
				tabIndex={disabled ? -1 : 0}
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
											4,
						);
					}
				}}
				onPointerDown={(event) => {
					if (!event.isPrimary) {
						cancel();
						return;
					}
					event.preventDefault();
					event.stopPropagation();
					if (disabled) {
						cancel();
						return;
					}
					const center = centre(event.currentTarget);
					if (!center) return;
					contactId.current = event.pointerId;
					onContactChangeRef.current(event.pointerId, true);
					gesture.current = beginRotationDomeGesture({
						assetInstanceId: "placement",
						pointerId: event.pointerId,
						yawRadians,
						point: { x: event.clientX, y: event.clientY },
						centre: center,
					});
					event.currentTarget.setPointerCapture(event.pointerId);
				}}
				onPointerMove={(event) => {
					if (contactId.current !== event.pointerId) return;
					event.preventDefault();
					event.stopPropagation();
					if (!gesture.current) return;
					const center = centre(event.currentTarget);
					if (!center) {
						cancel();
						return;
					}
					gesture.current = moveRotationDomeGesture(
						gesture.current,
						{ x: event.clientX, y: event.clientY },
						center,
					);
					onChange(gesture.current.yawRadians);
				}}
				onPointerUp={(event) => {
					if (contactId.current !== event.pointerId) return;
					event.preventDefault();
					event.stopPropagation();
					gesture.current = undefined;
					releaseContact();
					if (event.currentTarget.hasPointerCapture(event.pointerId))
						event.currentTarget.releasePointerCapture(event.pointerId);
				}}
				onPointerCancel={(event) => {
					if (contactId.current !== event.pointerId) return;
					event.stopPropagation();
					cancel();
					releaseContact();
				}}
				onLostPointerCapture={(event) => {
					if (contactId.current !== event.pointerId) return;
					event.stopPropagation();
					cancel();
					releaseContact();
				}}
			/>
		</g>
	);
}
