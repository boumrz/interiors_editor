import { describe, expect, it } from "@rstest/core";
import { observePlanChrome, placePlanRotationEditor } from "./plan-rotation-layout";

const panel = { width: 250, height: 62 };
const space = { width: 390, top: 105, bottom: 555, ready: true };

describe("selected item rotation toolbar clearance", () => {
	it("moves above the ring when the compact inspector occupies its lower edge", () => {
		const placed = placePlanRotationEditor({
			center: { x: 136, y: 483 }, ringRadius: 45, panel, space,
		});
		expect(placed).toEqual({ left: 12, top: 364, maxHeight: 179 });
		expect((placed?.top ?? 555) + panel.height).toBeLessThanOrEqual(space.bottom - 12);
	});

	it("keeps controls out of the first paint until the new selection surface is measured", () => {
		const input = { center: { x: 136, y: 483 }, ringRadius: 45, panel, space };
		expect(placePlanRotationEditor({ ...input, space: { ...space, ready: false } })).toBeUndefined();
		expect(placePlanRotationEditor({ ...input, panel: { width: 250, height: 0 } })).toBeUndefined();
		expect(placePlanRotationEditor({ ...input, panel: { width: 0, height: 62 } })).toBeUndefined();
		expect(placePlanRotationEditor(input)).toBeDefined();
	});

	it("fits precisely between the horizontal margins and remains hidden until enough width returns", () => {
		const input = { center: { x: 137, y: 200 }, ringRadius: 45, panel, space };
		expect(placePlanRotationEditor({ ...input, space: { ...space, width: 273 } }))
			.toBeUndefined();
		expect(placePlanRotationEditor({ ...input, space: { ...space, width: 274 } })?.left)
			.toBe(12);
	});

	it("keeps the panel below the ring when it fits exactly and chooses above when that is the only safe ring clearance", () => {
		expect(placePlanRotationEditor({
			center: { x: 260, y: 424 }, ringRadius: 45, panel, space,
		})).toEqual({ left: 128, top: 481, maxHeight: 62 });
		expect(placePlanRotationEditor({
			center: { x: 260, y: 236 }, ringRadius: 45, panel, space: { ...space, bottom: 312 },
		})).toEqual({ left: 128, top: 117, maxHeight: 183 });
		expect(placePlanRotationEditor({
			center: { x: 260, y: 180 }, ringRadius: 26,
			panel: { ...panel, height: 180 }, space: { ...space, bottom: 355 },
		})).toEqual({ left: 128, top: 163, maxHeight: 180 });
	});

	it("reserves the whole inspector when the usable area cannot hold a complete row", () => {
		const input = {
			center: { x: 136, y: 140 }, ringRadius: 45, panel,
			space: { ...space, top: 109, bottom: 194 },
		};
		expect(placePlanRotationEditor(input)).toBeUndefined();
		expect(placePlanRotationEditor({ ...input, space: { ...input.space, bottom: 195 } }))
			.toEqual({ left: 12, top: 121, maxHeight: 62 });
	});

	it("keeps the toolbar available after visual viewport shrink, pan, or zoom when the row still fits", () => {
		const keyboard = { ...space, top: 122, bottom: 315 };
		expect(placePlanRotationEditor({
			center: { x: 580, y: 750 }, ringRadius: 190, panel, space: keyboard,
		})).toEqual({ left: 128, top: 241, maxHeight: 62 });
		expect(placePlanRotationEditor({
			center: { x: -300, y: 100 }, ringRadius: 43, panel, space: keyboard,
		})).toEqual({ left: 12, top: 155, maxHeight: 148 });
	});
});

it("observes the compact inspector when it mounts after selection and releases a replaced node", () => {
	const shell = {} as Element;
	const canvas = {} as Element;
	const firstInspector = {} as Element;
	const replacementInspector = {} as Element;
	let targets = [shell, canvas];
	const observed = new Set<Element>();
	const observeCount = new Map<Element, number>();
	const measured: Element[][] = [];
	let mutationOptions: MutationObserverInit = {};
	let changed = () => {};
	let resized = () => {};
	let stopped = 0;
	const stop = observePlanChrome(shell, () => targets, () => measured.push([...observed]), {
		resize(update) {
			resized = update;
			return {
				observe: target => {
					observed.add(target);
					observeCount.set(target, (observeCount.get(target) ?? 0) + 1);
				},
				unobserve: target => { observed.delete(target); },
				disconnect: () => { observed.clear(); stopped++; },
			};
		},
		mutation(update) {
			changed = update;
			return {
				observe: (root, options) => { if (root === shell) mutationOptions = options ?? {}; },
				disconnect: () => { stopped++; },
			};
		},
	});
	expect(measured.at(-1)).toEqual([shell, canvas]);
	const mountChild = () => {
		if (mutationOptions.subtree && mutationOptions.childList) changed();
	};
	const changeAttribute = (attribute: string) => {
		if (mutationOptions.attributes && mutationOptions.attributeFilter?.includes(attribute)) changed();
	};

	targets = [shell, canvas, firstInspector];
	mountChild();
	expect(measured.at(-1)).toEqual([shell, canvas, firstInspector]);
	const afterMount = measured.length;
	resized();
	expect(measured).toHaveLength(afterMount + 1);
	for (const attribute of ["hidden", "data-inspector-expanded", "data-plan-rotation-obstacle"])
		changeAttribute(attribute);
	expect(measured).toHaveLength(afterMount + 4);

	targets = [shell, canvas, replacementInspector];
	mountChild();
	expect(measured.at(-1)).toEqual([shell, canvas, replacementInspector]);
	expect(observeCount.get(canvas)).toBe(1);
	stop();
	expect(observed.size).toBe(0);
	expect(stopped).toBe(2);
	const afterStop = measured.length;
	changed();
	resized();
	expect(measured).toHaveLength(afterStop);
});
