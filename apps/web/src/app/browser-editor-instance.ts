import type { ProjectStorageNamespace } from "../application/ports";
import type { ProjectController } from "./project-controller";
/** Ephemeral trusted UI intent, bound to one facade generation; never persisted. */
export interface BrowserEditorInstanceSnapshot {
	readonly key: string;
	/** Captured UI capability; stale view callbacks cannot address the next owner. */
	readonly controller?: ProjectController;
	readonly storageNamespace?: ProjectStorageNamespace;
	readonly requestedRenameProjectId?: string;
}
