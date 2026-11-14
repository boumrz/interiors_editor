import type { ProjectStorageNamespace } from "../../application/ports";

export type BrowserProjectKeyResult = {
	readonly kind: "free" | "occupied" | "unavailable";
};
const sources = {
	legacy: { name: "interiors-editor-projects", version: 3 },
	"browser-registered": {
		name: "interiors-editor-browser-registered",
		version: 1,
	},
} as const;

/** Current raw key proof only. It never creates/upgrades storage or grants publication authority. */
export class BrowserProjectKeyLookup {
	private readonly source: (typeof sources)[ProjectStorageNamespace];
	private readonly timeoutMs: number;
	public constructor(
		private readonly dependencies: {
			readonly indexedDb: Pick<IDBFactory, "open">;
			readonly namespace: ProjectStorageNamespace;
			readonly timeoutMs?: number;
		},
	) {
		this.dependencies = { ...dependencies };
		if (!Object.hasOwn(sources, dependencies.namespace))
			throw new Error("Unknown browser storage owner");
		this.source = sources[dependencies.namespace];
		this.timeoutMs = dependencies.timeoutMs ?? 1500;
		if (
			!Number.isSafeInteger(this.timeoutMs) ||
			this.timeoutMs < 1 ||
			this.timeoutMs > 60000
		)
			throw new Error("Invalid key lookup deadline");
	}
	public read(
		projectId: string,
		signal?: AbortSignal,
	): Promise<BrowserProjectKeyResult> {
		if (
			typeof projectId !== "string" ||
			projectId.length === 0 ||
			projectId.length > 256 ||
			signal?.aborted
		)
			return Promise.resolve({ kind: "unavailable" });
		return new Promise((resolve) => {
			let database: IDBDatabase | undefined,
				transaction: IDBTransaction | undefined;
			let finished = false,
				abandoned = false,
				absent = false,
				result: BrowserProjectKeyResult = { kind: "unavailable" };
			let timeout: ReturnType<typeof setTimeout> | undefined;
			let opening: IDBOpenDBRequest;
			const finish = (value: BrowserProjectKeyResult) => {
				if (finished) return;
				finished = true;
				if (timeout !== undefined) clearTimeout(timeout);
				signal?.removeEventListener("abort", abandon);
				database?.close();
				resolve(abandoned ? { kind: "unavailable" } : value);
			};
			const abandon = () => {
				abandoned = true;
				if (transaction) {
					abort(transaction);
					return;
				}
				if (opening?.transaction) {
					abort(opening.transaction);
					return;
				}
				finish({ kind: "unavailable" });
			};
			try {
				opening = this.dependencies.indexedDb.open(this.source.name);
			} catch {
				finish({ kind: "unavailable" });
				return;
			}
			signal?.addEventListener("abort", abandon, { once: true });
			timeout = setTimeout(abandon, this.timeoutMs);
			opening.onupgradeneeded = (event) => {
				absent = event.oldVersion === 0;
				abort(opening.transaction);
			};
			opening.onerror = () =>
				finish(absent ? { kind: "free" } : { kind: "unavailable" });
			opening.onblocked = abandon;
			opening.onsuccess = () => {
				const opened = opening.result;
				if (finished || abandoned || signal?.aborted) {
					opened.close();
					finish({ kind: "unavailable" });
					return;
				}
				database = opened;
				if (
					database.name !== this.source.name ||
					database.version !== this.source.version ||
					!database.objectStoreNames.contains("projects") ||
					(this.dependencies.namespace === "browser-registered" &&
						!database.objectStoreNames.contains("writer-fences"))
				) {
					finish({ kind: "unavailable" });
					return;
				}
				database.onversionchange = () => {
					abandon();
					database?.close();
				};
				database.onclose = abandon;
				try {
					const names =
						this.dependencies.namespace === "browser-registered"
							? ["projects", "writer-fences"]
							: ["projects"];
					transaction = database.transaction(names, "readonly");
					transaction.oncomplete = () => finish(result);
					transaction.onabort = () => finish({ kind: "unavailable" });
					transaction.addEventListener("error", () => abort(transaction));
					const projects = transaction.objectStore("projects");
					if (
						projects.keyPath !== "projectId" ||
						projects.autoIncrement ||
						projects.indexNames.length !== 0
					) {
						abandon();
						return;
					}
					result = { kind: "free" };
					for (const name of names) {
						const store = transaction.objectStore(name);
						if (
							store.keyPath !== "projectId" ||
							store.autoIncrement ||
							store.indexNames.length !== 0
						) {
							abandon();
							return;
						}
						const request = store.getKey(projectId);
						request.onsuccess = () => {
							if (request.result !== undefined) result = { kind: "occupied" };
						};
						request.onerror = abandon;
					}
				} catch {
					abandon();
				}
			};
			if (signal?.aborted) abandon();
		});
	}
}
function abort(transaction: IDBTransaction | null | undefined): void {
	try {
		transaction?.abort();
	} catch {
		/* Wait for the existing native terminal event. */
	}
}
