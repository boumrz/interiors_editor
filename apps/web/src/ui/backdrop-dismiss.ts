import { useRef, type MouseEvent, type PointerEvent } from "react";

const tapSlopPx = 8;

type BackdropContact = {
	readonly pointerId: number;
	readonly clientX: number;
	readonly clientY: number;
	readonly released: boolean;
};

function withinTapSlop(contact: BackdropContact, event: MouseEvent<HTMLElement>) {
	return Math.hypot(event.clientX - contact.clientX, event.clientY - contact.clientY) <= tapSlopPx;
}

export function backdropDismissHandlers<T extends HTMLElement>(
	contact: { current: BackdropContact | undefined },
	isBackdrop: (event: MouseEvent<T>) => boolean,
	dismiss: ((element: T) => void) | undefined,
) {
	return {
		onMouseDown(event: MouseEvent<T>) {
			if (!isBackdrop(event)) return;
			event.preventDefault();
			event.stopPropagation();
		},
		onPointerDown(event: PointerEvent<T>) {
			contact.current = undefined;
			if (!isBackdrop(event)) return;
			// A pending field must reach the same close guard as the × button.
			event.preventDefault();
			event.stopPropagation();
			if (dismiss && event.isPrimary && event.button === 0) {
				contact.current = {
					pointerId: event.pointerId,
					clientX: event.clientX,
					clientY: event.clientY,
					released: false,
				};
			}
		},
		onPointerMove(event: PointerEvent<T>) {
			const start = contact.current;
			if (start?.pointerId === event.pointerId && !withinTapSlop(start, event)) {
				contact.current = undefined;
			}
		},
		onPointerCancel(event: PointerEvent<T>) {
			if (contact.current?.pointerId === event.pointerId) contact.current = undefined;
		},
		onPointerUp(event: PointerEvent<T>) {
			const start = contact.current;
			contact.current = undefined;
			if (!isBackdrop(event)) return;
			event.stopPropagation();
			if (dismiss && start?.pointerId === event.pointerId && withinTapSlop(start, event)) {
				contact.current = { ...start, released: true };
			}
		},
		onClick(event: MouseEvent<T>) {
			const tap = contact.current;
			contact.current = undefined;
			if (!isBackdrop(event)) return;
			event.stopPropagation();
			if (tap?.released && event.detail > 0 && withinTapSlop(tap, event)) {
				dismiss?.(event.currentTarget);
			}
		},
	};
}

export function useBackdropDismiss<T extends HTMLElement>(
	isBackdrop: (event: MouseEvent<T>) => boolean,
	dismiss: ((element: T) => void) | undefined,
) {
	const contact = useRef<BackdropContact>(undefined);
	return backdropDismissHandlers(contact, isBackdrop, dismiss);
}

export function isOverlayBackdrop(event: MouseEvent<HTMLDivElement>): boolean {
	const layer = event.currentTarget;
	// Touch can capture a pointer that later ends over the sheet itself.
	return event.target === layer &&
		layer.ownerDocument.elementFromPoint(event.clientX, event.clientY) === layer;
}

export function isDialogBackdrop(event: MouseEvent<HTMLDialogElement>): boolean {
	const dialog = event.currentTarget;
	if (!dialog.open || event.target !== dialog) return false;
	const { left, right, top, bottom } = dialog.getBoundingClientRect();
	return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

export function cancelNativeDialog(dialog: HTMLDialogElement) {
	if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
}
