export type EditorBackDecision = "saving" | "persist-failed" | "confirm-discard" | "close-panel" | "projects" | "close-host";

/** Safety order is shared by Telegram Back and the Telegram shell's own controls. */
export function editorBackDecision(input: {
	readonly pending: boolean;
	readonly persistFailed: boolean;
	readonly draft: boolean;
	readonly panel: boolean;
	readonly project: boolean;
}): EditorBackDecision {
	if (input.pending) return "saving";
	if (input.persistFailed) return "persist-failed";
	if (input.draft) return "confirm-discard";
	if (input.panel) return "close-panel";
	return input.project ? "projects" : "close-host";
}
