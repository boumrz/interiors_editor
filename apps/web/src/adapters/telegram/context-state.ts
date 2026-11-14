import type { WriterTakeoverRequirementStorePort } from "../../application/ports";
import type { VerifiedTelegramScope } from "./signed-launch";

export interface DrawingDimensionPreferenceStore {
	read(): string | null;
	write(raw: string): void;
}

type ContextStorage = Pick<Storage, "getItem" | "setItem">;

/** Technical state is scope-specific; construction neither reads nor writes storage. */
export function createTelegramContextState(scope: VerifiedTelegramScope, stores: {
	readonly sessionStorage: ContextStorage;
	readonly localStorage: ContextStorage;
}): { readonly writerTakeover: WriterTakeoverRequirementStorePort; readonly drawingDimensions: DrawingDimensionPreferenceStore } {
	if (!/^tma-v1-[a-f0-9]{64}$/.test(scope)) throw new Error("Verified Telegram scope is required");
	const prefix = `interiors-tma-context-v1:${scope}:`;
	const session = stores.sessionStorage;
	const local = stores.localStorage;
	const key = (projectId: string) => `${prefix}writer-takeover:${utf16Key(projectId)}`;
	return {
		writerTakeover: {
			requiresExplicitTakeover(projectId) {
				const value = session.getItem(key(projectId));
				if (value === null || value === "cleared") return false;
				if (value === "required") return true;
				throw new Error("Telegram writer acknowledgement is unreadable");
			},
			requireExplicitTakeover: (projectId) => session.setItem(key(projectId), "required"),
			clearExplicitTakeoverRequirement: (projectId) => session.setItem(key(projectId), "cleared"),
		},
		drawingDimensions: {
			read: () => local.getItem(`${prefix}drawing-dimensions`),
			write: (raw) => local.setItem(`${prefix}drawing-dimensions`, raw),
		},
	};
}

function utf16Key(value: string): string {
	if (!value || value.length > 256) throw new Error("Invalid Telegram Project ID");
	let encoded = "";
	for (let index = 0; index < value.length; index++) encoded += value.charCodeAt(index).toString(16).padStart(4, "0");
	return encoded;
}
