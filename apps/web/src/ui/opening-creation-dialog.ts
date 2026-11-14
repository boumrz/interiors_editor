export type OpeningCreationDialogKeyAction =
	| "block"
	| "dismiss"
	| "focus-first"
	| "focus-last"
	| "none"
	| "retain-dialog";

export interface OpeningCreationDialogKeyInput {
	readonly activeIndex: number;
	readonly focusableCount: number;
	readonly isWorking: boolean;
	readonly key: string;
	readonly shiftKey: boolean;
}

/**
 * Keeps the modal keyboard contract independent from the DOM query. During a
 * durable publish every sheet control is disabled, so Tab must remain inside
 * the dialog instead of falling through to the editor underneath it.
 */
export function openingCreationDialogKeyAction({
	activeIndex,
	focusableCount,
	isWorking,
	key,
	shiftKey,
}: OpeningCreationDialogKeyInput): OpeningCreationDialogKeyAction {
	if (key === "Escape") return isWorking ? "block" : "dismiss";
	if (key !== "Tab") return "none";
	if (isWorking || focusableCount === 0) return "retain-dialog";
	if (shiftKey && activeIndex === 0) return "focus-last";
	if (!shiftKey && activeIndex === focusableCount - 1) return "focus-first";
	return "none";
}
