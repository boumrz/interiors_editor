import { createBrowserReadonlyPublicOracles } from "./browser-readonly-public-oracles";
import type { ProjectController } from "../../src/app/project-controller";
import type { Project } from "../../src/domain/project";
const legacyName = "interiors-editor-projects", privateName = "interiors-editor-browser-registered";
function project(controller: ProjectController): Project {
	const state = controller.snapshot();
	if (
		!("project" in state) ||
		!state.project ||
		state.project.schemaVersion !== 1
	)
		throw new Error("Expected actual V1 Durable Project");
	return state.project;
}

async function normalized(value: unknown): Promise<unknown> {
	if (value === undefined) return { nativeType: "undefined" };
	if (Object.is(value, -0)) return { nativeType: "negative-zero" };
	if (value instanceof Blob)
		return {
			nativeType: "Blob",
			bytes: [...new Uint8Array(await value.arrayBuffer())],
		};
	if (value instanceof ArrayBuffer)
		return { nativeType: "ArrayBuffer", bytes: [...new Uint8Array(value)] };
	if (value === null || typeof value !== "object") return value;
	const entries = await Promise.all(
		Object.entries(value).map(async ([key, part]) => [
			key,
			await normalized(part),
		]),
	);
	return {
		nativeType: Array.isArray(value) ? "Array" : "Object",
		...(Array.isArray(value) ? { length: value.length } : {}),
		entries,
	};
}

async function snapshot() {
	const databases = (await indexedDB.databases())
		.filter(
			(row) =>
				row.name === legacyName ||
				row.name === privateName ||
				row.name === "interiors-editor-custom-assets",
		)
		.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
	const result = [];
	for (const info of databases) {
		const name = info.name;
		if (!name) throw new Error("Unnamed DB");
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(name);
			request.onupgradeneeded = () => request.transaction?.abort();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			const names = [...database.objectStoreNames],
				transaction = database.transaction(names, "readonly"),
				done = new Promise<void>((resolve, reject) => {
					transaction.oncomplete = () => resolve();
					transaction.onabort = () => reject(transaction.error);
				});
			const rows = await Promise.all(
				names.map(async (name) => ({
					name,
					rows: await new Promise<unknown[]>((resolve, reject) => {
						const request = transaction.objectStore(name).getAll();
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					}),
				})),
			);
			await done;
			result.push({
				name,
				version: database.version,
				rows: await normalized(rows),
			});
		} finally {
			database.close();
		}
	}
	return result;
}

function observe(allNative = false) {
	const nativeOpen = indexedDB.open.bind(indexedDB),
		handles = new WeakSet<IDBDatabase>(),
		opens: { name: string; version: number | undefined }[] = [],
		modes: IDBTransactionMode[] = [],
		upgrades: string[] = [];
	const nativeTransaction = IDBDatabase.prototype.transaction;
	IDBDatabase.prototype.transaction = function (
		this: IDBDatabase,
		...args: Parameters<IDBDatabase["transaction"]>
	) {
		if (allNative || handles.has(this)) modes.push(args[1] ?? "readonly");
		return Reflect.apply(nativeTransaction, this, args);
	};
	const descriptor = Object.getOwnPropertyDescriptor(indexedDB, "open");
	const trackedOpen = (name: string, version?: number) => {
		opens.push({ name, version });
		const request =
			version === undefined ? nativeOpen(name) : nativeOpen(name, version);
		request.addEventListener("upgradeneeded", () => upgrades.push(name));
		request.addEventListener("success", () => handles.add(request.result));
		return request;
	};
	if (allNative)
		Object.defineProperty(indexedDB, "open", {
			configurable: true,
			writable: true,
			value: trackedOpen,
		});
	return {
		technical: {
			secureContext: isSecureContext,
			indexedDb: {
				databases: indexedDB.databases.bind(indexedDB),
				open: trackedOpen,
			},
		},
		opens,
		modes,
		upgrades,
		restore() {
			IDBDatabase.prototype.transaction = nativeTransaction;
			if (allNative) {
				if (descriptor) Object.defineProperty(indexedDB, "open", descriptor);
				else Reflect.deleteProperty(indexedDB, "open");
			}
		},
	};
}

window.__browserReadonlyPublicOracles = createBrowserReadonlyPublicOracles({snapshot,observe,project});
