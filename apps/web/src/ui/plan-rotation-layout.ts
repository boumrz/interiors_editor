export type PlanRotationInspectorState = "pending" | "present";

export function planRotationChromeReady({
	inspectorState, inspectorMeasured, editingAngle, compactInspector,
}: {
	readonly inspectorState: PlanRotationInspectorState | undefined;
	readonly inspectorMeasured: boolean;
	readonly editingAngle: boolean;
	readonly compactInspector: boolean;
}): boolean {
	return inspectorState !== "pending" &&
		(inspectorState !== "present" || inspectorMeasured || (editingAngle && compactInspector));
}

interface PlanRotationSpace {
	readonly top: number;
	readonly bottom: number;
	readonly width: number;
	readonly ready: boolean;
}

const panelGap = 12;

export function placePlanRotationEditor({
	center, ringRadius, panel, space,
}: {
	readonly center: { readonly x: number; readonly y: number };
	readonly ringRadius: number;
	readonly panel: { readonly width: number; readonly height: number };
	readonly space: PlanRotationSpace;
}) {
	const top = space.top + panelGap;
	const bottom = space.bottom - panelGap;
	const maxHeight = bottom - top;
	if (
		!space.ready || panel.width <= 0 || panel.height <= 0 ||
		panel.width + 2 * panelGap > space.width || panel.height > maxHeight
	) return undefined;

	const below = center.y + ringRadius + panelGap;
	const above = center.y - ringRadius - panelGap - panel.height;
	const candidate = below + panel.height > bottom && above >= top ? above : below;
	const panelTop = Math.max(top, Math.min(candidate, bottom - panel.height));
	return {
		left: Math.max(panelGap, Math.min(center.x - panel.width / 2, space.width - panel.width - panelGap)),
		top: panelTop,
		maxHeight: bottom - panelTop,
	};
}

interface PlanChromeObservers {
	readonly resize: (update: () => void) => Pick<ResizeObserver, "observe" | "unobserve" | "disconnect">;
	readonly mutation: (update: () => void) => Pick<MutationObserver, "observe" | "disconnect">;
}

/**
 * Keep measuring the current DOM siblings. The inspector can mount in another
 * React commit or be replaced by a portal while the selected item stays the same.
 */
export function observePlanChrome(
	root: Element,
	readTargets: () => readonly Element[],
	update: () => void,
	observers: PlanChromeObservers = {
		resize: (callback) => new ResizeObserver(callback),
		mutation: (callback) => new MutationObserver(callback),
	},
): () => void {
	let active = true;
	let tracked = new Set<Element>();
	const resize = observers.resize(() => { if (active) update(); });
	const refresh = () => {
		if (!active) return;
		const current = new Set(readTargets());
		for (const old of tracked) {
			if (!current.has(old)) resize.unobserve(old);
		}
		for (const target of current) {
			if (!tracked.has(target)) resize.observe(target);
		}
		tracked = current;
		update();
	};
	const mutation = observers.mutation(refresh);
	mutation.observe(root, {
		subtree: true,
		childList: true,
		attributes: true,
		attributeFilter: ["hidden", "data-inspector-expanded", "data-plan-rotation-obstacle"],
	});
	refresh();
	return () => {
		active = false;
		mutation.disconnect();
		resize.disconnect();
	};
}
