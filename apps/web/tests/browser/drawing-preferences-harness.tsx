import { createRoot, type Root } from "react-dom/client";
import { EditorApp } from "../../src/app/editor-app";
import { createProductionRuntime } from "../../src/app/production-app";
import type { CatalogGatewayPort } from "../../src/application/ports";
import {
	DRAWING_DIMENSION_PREFERENCES_KEY,
	type DrawingDimensionPreferencesPort,
} from "../../src/ui/drawing-dimension-visibility";
import "../../src/ui/global.css";

type Scope = "a" | "b" | "browser";
interface Faults { readonly read?: boolean; readonly write?: boolean }
const stored = new Map<string, string>();
const reads: string[] = [];
const writes: { scope: string; raw: string }[] = [];
let browserReads = 0, browserWrites = 0;
const originalGet = Storage.prototype.getItem;
const originalSet = Storage.prototype.setItem;
Storage.prototype.getItem = function (key) {
	if (key === DRAWING_DIMENSION_PREFERENCES_KEY) browserReads++;
	return originalGet.call(this, key);
};
Storage.prototype.setItem = function (key, value) {
	if (key === DRAWING_DIMENSION_PREFERENCES_KEY) browserWrites++;
	return originalSet.call(this, key, value);
};

class OpaquePreferences implements DrawingDimensionPreferencesPort {
	public constructor(private readonly scope: string, private readonly faults: Faults) {}
	public read(): string | null {
		reads.push(this.scope);
		if (this.faults.read) throw new Error("Preference read unavailable");
		return stored.get(this.scope) ?? null;
	}
	public write(raw: string): void {
		writes.push({ scope: this.scope, raw });
		if (this.faults.write) throw new Error("Preference write unavailable");
		stored.set(this.scope, raw);
	}
}

// Browser persistence is real and is confined to Playwright's fresh profile.
// A/B below are opaque preference ports, not Telegram account/storage evidence.
const actual = createProductionRuntime();
const runtime = {
	...actual,
	releaseStartup: { handshake: async () => ({ kind: "writable" as const }) },
};
const catalogGateway: CatalogGatewayPort = {
	currentPublication: async () => ({ kind: "unavailable" }),
	resource: async () => ({ kind: "unavailable" }),
};
const readReleaseStartupInput = async () => ({
	capabilities: { indexeddb: true, webgl2: false },
	shellManifest: undefined,
	workerManifest: undefined,
});
let root: Root | undefined;
let currentScope: Scope | undefined;
let currentFaults: Faults = {};
const renderCurrent = () => {
	if (!root || currentScope === undefined) throw new Error("No mounted preference fixture");
	root.render(<EditorApp runtime={runtime} catalogGateway={catalogGateway}
		readReleaseStartupInput={readReleaseStartupInput}
		drawingDimensionPreferences={currentScope === "browser" ? undefined : new OpaquePreferences(currentScope, currentFaults)} />);
};

async function durableSnapshot() {
	const database = await new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open("interiors-editor-projects");
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	try {
		const transaction = database.transaction(["projects", "revisions"], "readonly");
		const read = (name: string) => new Promise<unknown[]>((resolve, reject) => {
			const request = transaction.objectStore(name).getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const [projects, revisions] = await Promise.all([read("projects"), read("revisions")]);
		return { projects, revisions };
	} finally { database.close(); }
}

const fixture = {
	mount(scope: Scope, faults: Faults = {}) {
		root?.unmount();
		const container = document.getElementById("root");
		if (!container) throw new Error("Missing fixture root");
		root = createRoot(container);
		currentScope = scope;
		currentFaults = faults;
		renderCurrent();
	},
	// Provider replacement keeps the same identity/controller/UI. Account-like
	// A/B transitions above always unmount; this is not a scope-switch shortcut.
	replaceSameScopePort(faults: Faults = {}) { currentFaults = faults; renderCurrent(); },
	setRaw(scope: "a" | "b", raw: string) { stored.set(scope, raw); },
	setBrowserRaw(raw: string) { originalSet.call(localStorage, DRAWING_DIMENSION_PREFERENCES_KEY, raw); },
	inspect() {
		return {
			reads: reads.slice(), writes: writes.map(value => ({ ...value })),
			stored: Object.fromEntries(stored), browserReads, browserWrites,
			browserRaw: originalGet.call(localStorage, DRAWING_DIMENSION_PREFERENCES_KEY),
		};
	},
	durableSnapshot,
};
declare global { interface Window { readonly __drawingPreferencesFixture: typeof fixture } }
Object.defineProperty(window, "__drawingPreferencesFixture", { value: fixture });
