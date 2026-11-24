import { expect, it } from "@rstest/core";
import type { MouseEvent, PointerEvent } from "react";
import { backdropDismissHandlers, cancelNativeDialog, isDialogBackdrop, isOverlayBackdrop } from "./backdrop-dismiss";

function setup() {
	const close = { count: 0 };
	const panel = {} as HTMLElement;
	const backdrop = {} as HTMLElement;
	const contact = { current: undefined };
	const controls = (busy = false) => backdropDismissHandlers(
		contact,
		event => event.target === backdrop,
		busy ? undefined : () => { close.count += 1; },
	);
	const pointer = ({
		target = backdrop, pointerId = 1, clientX = 20, clientY = 60, button = 0, isPrimary = true, detail = 1,
	} = {}) => {
		const observed = { prevented: false, stopped: false };
		const event = {
			target, pointerId, clientX, clientY, button, isPrimary, detail,
			preventDefault() { observed.prevented = true; },
			stopPropagation() { observed.stopped = true; },
		} as unknown as PointerEvent<HTMLElement>;
		return { event, observed };
	};
	return { close, controls, panel, pointer };
}

it("retains focus until a complete backdrop tap runs the close action once", () => {
	const { close, controls, pointer } = setup();
	const { event, observed } = pointer();
	const handlers = controls();
	handlers.onPointerDown(event);
	expect(observed).toEqual({ prevented: true, stopped: true });
	expect(close.count).toBe(0);
	handlers.onPointerUp(event);
	expect(close.count).toBe(0);
	handlers.onClick(event);
	handlers.onClick(event);
	expect(close.count).toBe(1);
});

it("does not allow a backdrop tap during a pending action", () => {
	const { close, controls, pointer } = setup();
	const { event } = pointer();
	controls().onPointerDown(event);
	controls().onPointerUp(event);
	controls(true).onClick(event);
	controls(true).onPointerDown(event);
	controls().onPointerUp(event);
	controls().onClick(event);
	expect(close.count).toBe(0);
});

it("accepts small movement and ignores hover or a different pointer's movement and cancellation", () => {
	const { close, controls, pointer } = setup();
	const { event: outside } = pointer();
	const { event: moved } = pointer({ clientX: 28 });
	const { event: other } = pointer({ clientX: 300, pointerId: 2 });
	const h = controls();
	h.onPointerCancel(outside);
	h.onPointerMove(outside);
	h.onPointerDown(outside);
	h.onPointerMove(moved);
	h.onPointerMove(other);
	h.onPointerCancel(other);
	h.onPointerUp(moved);
	h.onClick(moved);
	expect(close.count).toBe(1);
});

it("ignores clicks before release, keyboard clicks and a click retargeted inside", () => {
	const { close, controls, pointer, panel } = setup();
	const { event: outside } = pointer();
	const { event: keyboard } = pointer({ detail: 0 });
	const { event: inside, observed } = pointer({ target: panel });
	const h = controls();
	h.onPointerDown(outside);
	h.onClick(outside);
	h.onPointerDown(outside);
	h.onPointerUp(outside);
	h.onClick(keyboard);
	h.onPointerDown(outside);
	h.onPointerUp(outside);
	h.onClick(inside);
	expect(close.count).toBe(0);
	expect(observed.stopped).toBe(false);
});

it("prevents a compatibility mouse event from blurring a field on the backdrop only", () => {
	const { close, controls, pointer, panel } = setup();
	const outside = pointer();
	const inside = pointer({ target: panel });
	controls().onMouseDown(outside.event);
	controls().onMouseDown(inside.event);
	expect(outside.observed).toEqual({ prevented: true, stopped: true });
	expect(inside.observed).toEqual({ prevented: false, stopped: false });
	expect(close.count).toBe(0);
});

it("leaves the modal open after a drag, cancellation, secondary contact or tap across an edge", () => {
	const { close, controls, pointer, panel } = setup();
	const { event: outside } = pointer();
	const { event: inside, observed } = pointer({ target: panel });
	const { event: farOutside } = pointer({ clientX: 55 });
	const { event: otherContact } = pointer({ pointerId: 2, isPrimary: false });
	const { event: secondaryButton } = pointer({ button: 2 });
	const h = controls();
	h.onPointerDown(inside);
	expect(observed).toEqual({ prevented: false, stopped: false });
	h.onPointerUp(outside);
	h.onClick(outside);
	h.onPointerDown(outside);
	h.onPointerUp(inside);
	h.onClick(outside);
	h.onPointerDown(outside);
	h.onPointerMove(farOutside);
	h.onPointerUp(outside);
	h.onClick(outside);
	h.onPointerDown(outside);
	h.onPointerUp(farOutside);
	h.onClick(outside);
	h.onPointerDown(outside);
	h.onPointerCancel(outside);
	h.onPointerUp(outside);
	h.onClick(outside);
	h.onPointerDown(outside);
	h.onPointerDown(otherContact);
	h.onPointerUp(outside);
	h.onClick(outside);
	h.onPointerDown(secondaryButton);
	h.onPointerUp(secondaryButton);
	h.onClick(secondaryButton);
	expect(close.count).toBe(0);
});

it("identifies the backdrop retargeted to an open dialog, excluding padding and child controls", () => {
	const dialog = {
		open: true,
		getBoundingClientRect: () => ({ left: 20, right: 440, top: 330, bottom: 810 }),
	};
	const test = (clientX: number, clientY: number, target = dialog) =>
		isDialogBackdrop({ target, currentTarget: dialog, clientX, clientY } as unknown as MouseEvent<HTMLDialogElement>);
	expect(test(14, 600)).toBe(true);
	expect(test(450, 600)).toBe(true);
	expect(test(60, 240)).toBe(true);
	expect(test(60, 817)).toBe(true);
	expect(test(20, 330)).toBe(false);
	expect(test(440, 810)).toBe(false);
	expect(test(240, 540)).toBe(false);
	expect(test(14, 600, { ...dialog })).toBe(false);
	dialog.open = false;
	expect(test(14, 600)).toBe(false);
});

it("ignores an overlay pointer captured over a panel", () => {
	const panel = {};
	const layer = { ownerDocument: { elementFromPoint: (x: number) => x < 15 ? layer : panel } };
	const hit = (clientX: number, target = layer) =>
		isOverlayBackdrop({ target, currentTarget: layer, clientX, clientY: 10 } as unknown as MouseEvent<HTMLDivElement>);
	expect(hit(10)).toBe(true);
	expect(hit(20)).toBe(false);
	expect(hit(10, { ...layer })).toBe(false);
});

it("gives the native dialog's normal cancel action precedence over closing the element", () => {
	const canceled = new EventTarget();
	canceled.addEventListener("cancel", event => event.preventDefault());
	const defaultAction = new EventTarget();
	const seen = { closes: 0 };
	const request = (target: EventTarget) => cancelNativeDialog({
		dispatchEvent: event => target.dispatchEvent(event),
		close: () => { seen.closes += 1; },
	} as HTMLDialogElement);
	request(canceled);
	expect(seen.closes).toBe(0);
	request(defaultAction);
	expect(seen.closes).toBe(1);
});
