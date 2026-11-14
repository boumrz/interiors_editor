import type { DurablePublicationCandidate } from "../application/ports";

/** Host capabilities are injected; the common UI never reads SDK globals. */
export interface HostNavigationPort {
	readonly subscribeBack: (listener: () => void) => () => void;
	readonly setBackVisible: (visible: boolean) => void;
	/** Requests host closure; a callback is not proof that the host closed. */
	readonly close: () => void;
	readonly setClosingConfirmation?: (enabled: boolean) => void;
	readonly setVerticalSwipesEnabled?: (enabled: boolean) => void;
}

/** Optional browser composition protection; it does not grant embedded host capabilities. */
export interface EditorNavigationProtection {
	readonly discardWriterRecoveryAndShowProjects: (
		expected: DurablePublicationCandidate,
	) => Promise<boolean>;
}

export interface HostLifecyclePort {
	readonly snapshot: () => {
		readonly active: boolean;
		readonly layoutVersion: number;
	};
	readonly subscribe: (listener: () => void) => () => void;
}

export interface EditorTransientInteractionSnapshot {
	readonly hasDraft: boolean;
	readonly hasPendingCommand: boolean;
}

export interface EditorTransientBoundary {
	readonly inspect: () => EditorTransientInteractionSnapshot;
	readonly suspend: () => void;
	readonly resume: () => void;
	readonly invalidateContacts: () => void;
	readonly cancelDraft: () => void;
}

export type RegisterEditorTransientBoundary = (
	boundary: EditorTransientBoundary,
) => () => void;

/** Disposable object identity prevents a resumed view from reviving old contacts. */
export type EditorContactEpoch = object;

export interface EditorInteractionGate {
	readonly capture: () => EditorContactEpoch;
	readonly isCurrent: (epoch: EditorContactEpoch) => boolean;
	readonly canBegin: () => boolean;
	readonly hasPending: () => boolean;
	readonly suspend: () => void;
	readonly resume: () => void;
	readonly invalidateContacts: () => void;
	readonly dispose: () => void;
	readonly run: <T>(operation: () => T | Promise<T>) => Promise<T>;
}

export function createEditorInteractionGate(): EditorInteractionGate {
	let epoch: EditorContactEpoch = {};
	let suspended = false;
	let disposed = false;
	let activeOperation: object | undefined;
	const canBegin = () =>
		!suspended && !disposed && activeOperation === undefined;
	const invalidateContacts = () => {
		epoch = {};
	};
	return {
		capture: () => epoch,
		isCurrent: (contact) => canBegin() && contact === epoch,
		canBegin,
		hasPending: () => activeOperation !== undefined,
		suspend() {
			suspended = true;
			invalidateContacts();
		},
		resume() {
			if (disposed) return;
			suspended = false;
			invalidateContacts();
		},
		invalidateContacts,
		dispose() {
			disposed = true;
			suspended = true;
			invalidateContacts();
		},
		async run(operation) {
			if (!canBegin()) throw new Error("Editor interaction is unavailable");
			const admitted = {};
			activeOperation = admitted;
			try {
				return await operation();
			} finally {
				if (activeOperation === admitted) activeOperation = undefined;
			}
		},
	};
}
