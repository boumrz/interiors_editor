import { expect, test } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import type {
	BrowserReadonlyProjectsDirectory,
	BrowserReadonlyProjectsPort,
} from "../app/browser-readonly-projects-port";
import {
	BrowserReadonlyProjectsContent,
	BrowserReadonlyProjectsSession,
} from "./browser-readonly-projects";

function held<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
function fixture() {
	const lifetime = new AbortController(),
		legacy = new AbortController(),
		registered = new AbortController();
	const rows = [
		{
			storageNamespace: "legacy" as const,
			projectId: "same",
			revisionId: "same-revision",
			name: "Shared",
			updatedAt: "2026-11-05",
		},
		{
			storageNamespace: "browser-registered" as const,
			projectId: "same",
			revisionId: "same-revision",
			name: "Shared",
			updatedAt: "2026-11-05",
		},
	];
	const calls: unknown[] = [];
	const state = {
		directory: async (): Promise<BrowserReadonlyProjectsDirectory> => ({
			kind: "projects",
			projects: rows,
			storageSources: [
				{ storageNamespace: "legacy", kind: "available" },
				{ storageNamespace: "browser-registered", kind: "available" },
			],
		}),
		export: async (): ReturnType<
			BrowserReadonlyProjectsPort["exportBackup"]
		> => ({
			kind: "ready",
			bytes: new Uint8Array([1, 2, 3]),
			filename: "owned.interiors",
			mimeType: "application/zip",
		}),
	};
	const port: BrowserReadonlyProjectsPort = {
		signal: lifetime.signal,
		getSourceRecovery: () => undefined,
		getSourceSignal: (namespace) =>
			namespace === "legacy" ? legacy.signal : registered.signal,
		readDirectory: () => {
			calls.push("directory");
			return state.directory();
		},
		exportBackup: (address, format, signal) => {
			calls.push({ address, format, signal });
			return state.export();
		},
	};
	return { lifetime, legacy, registered, rows, calls, state, port };
}
test("read-only browser view construction is inert and its two equal raw addresses remain separately owned", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	expect(f.calls).toEqual([]);
	await model.start();
	expect(model.snapshot().directory?.projects).toHaveLength(2);
	expect(await model.prepare(f.rows[1], "registered")).toBe(true);
	expect(f.calls[1]).toMatchObject({
		address: {
			storageNamespace: "browser-registered",
			projectId: "same",
			revisionId: "same-revision",
		},
		format: "registered",
	});
	expect(model.takeFile()?.bytes).toEqual(new Uint8Array([1, 2, 3]));
	model.dispose();
});
test("unknown or changed revision addresses cannot select storage or start an exporter", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	await model.start();
	expect(
		await model.prepare({ ...f.rows[0], revisionId: "other" }, "legacy"),
	).toBe(false);
	expect(
		await model.prepare(
			{ ...f.rows[0], storageNamespace: "foreign" } as never,
			"legacy",
		),
	).toBe(false);
	expect(f.calls).toEqual(["directory"]);
	model.dispose();
});
test("revoking one native source clears only its file and keeps a healthy neighbour usable", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	await model.start();
	await model.prepare(f.rows[1], "registered");
	f.legacy.abort();
	expect(model.takeFile()?.filename).toBe("owned.interiors");
	expect(await model.prepare(f.rows[0], "legacy")).toBe(false);
	f.registered.abort();
	expect(model.takeFile()).toBeUndefined();
	model.dispose();
});
test("an old source cannot return a late archive after revocation or view disposal", async () => {
	for (const stop of ["source", "view"] as const) {
		const f = fixture(),
			model = new BrowserReadonlyProjectsSession(f.port),
			gate =
				held<
					Awaited<ReturnType<BrowserReadonlyProjectsPort["exportBackup"]>>
				>();
		await model.start();
		f.state.export = () => gate.promise;
		const preparing = model.prepare(f.rows[0], "legacy");
		if (stop === "source") f.legacy.abort();
		else model.dispose();
		gate.resolve({
			kind: "ready",
			bytes: new Uint8Array([9]),
			filename: "late.interiors",
			mimeType: "application/zip",
		});
		expect(await preparing).toBe(false);
		expect(model.takeFile()).toBeUndefined();
		model.dispose();
	}
});
test("directory failure stays unavailable, and a late previous query cannot overwrite a newer valid result", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	f.state.directory = async () => {
		throw new Error("SECRET_SOURCE");
	};
	await model.start();
	expect(model.snapshot().status).toBe("unavailable");
	expect(JSON.stringify(model.snapshot())).not.toContain("SECRET_SOURCE");
	const old = held<BrowserReadonlyProjectsDirectory>();
	f.state.directory = () => old.promise;
	const stale = model.refresh();
	f.state.directory = async () => ({
		kind: "projects",
		projects: [f.rows[1]],
		storageSources: [
			{ storageNamespace: "browser-registered", kind: "available" },
			{ storageNamespace: "legacy", kind: "unavailable" },
		],
	});
	await model.refresh();
	old.resolve({ kind: "projects", projects: [], storageSources: [] });
	await stale;
	expect(model.snapshot().directory?.projects).toEqual([f.rows[1]]);
	model.dispose();
});
test("prepared bytes are owned and neither snapshots nor a caller's delivery copy can alter them", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port),
		bytes = new Uint8Array([1, 2, 3]);
	f.state.export = async () => ({
		kind: "ready",
		bytes,
		filename: "owned.interiors",
		mimeType: "application/zip",
	});
	await model.start();
	await model.prepare(f.rows[0], "legacy");
	bytes[0] = 9;
	const first = model.takeFile();
	expect(first?.bytes[0]).toBe(1);
	if (first) first.bytes[0] = 7;
	expect(model.takeFile()?.bytes[0]).toBe(1);
	expect(JSON.stringify(model.snapshot())).not.toContain('"bytes"');
	model.dispose();
});

test("a directory finishing after one source abort cannot resurrect that source's old cards", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	await model.start();
	const gate = held<BrowserReadonlyProjectsDirectory>();
	f.state.directory = () => gate.promise;
	const loading = model.refresh();
	f.legacy.abort();
	gate.resolve({
		kind: "projects",
		projects: f.rows,
		storageSources: [
			{ storageNamespace: "legacy", kind: "available" },
			{ storageNamespace: "browser-registered", kind: "available" },
		],
	});
	await loading;
	expect(model.snapshot().directory?.projects).toEqual([f.rows[1]]);
	expect(model.snapshot().directory?.storageSources).toContainEqual({
		storageNamespace: "legacy",
		kind: "unavailable",
	});
	model.dispose();
});

test("reentrant disposal during cancellation leaves the retired view permanently closed without starting the replacement export", async () => {
	const f = fixture(),
		gate =
			held<Awaited<ReturnType<BrowserReadonlyProjectsPort["exportBackup"]>>>();
	let model: BrowserReadonlyProjectsSession;
	model = new BrowserReadonlyProjectsSession({
		...f.port,
		exportBackup: (_address, _format, signal) => {
			if (signal instanceof AbortSignal)
				signal.addEventListener("abort", () => model.dispose(), { once: true });
			return gate.promise;
		},
	});
	await model.start();
	const pending = model.prepare(f.rows[0], "legacy");
	expect(await model.prepare(f.rows[1], "registered")).toBe(false);
	expect(model.snapshot()).toMatchObject({
		status: "closed",
		preparation: "idle",
	});
	gate.resolve({
		kind: "ready",
		bytes: new Uint8Array([1]),
		filename: "late.interiors",
		mimeType: "application/zip",
	});
	await pending;
	expect(model.takeFile()).toBeUndefined();
});

test("an explicitly selected raw source remains exact and is never labelled a complete backup", async () => {
	const f = fixture(),
		original = {
			kind: "unverified-source" as const,
			projectId: "same",
			revisionId: "same-revision",
			serializedProject: "  \ud800\u0000raw\n ",
		};
	const model = new BrowserReadonlyProjectsSession({
		...f.port,
		getSourceRecovery: (namespace) =>
			namespace === "legacy"
				? {
						listRecoverySources: async () => [
							{
								kind: "unverified-source",
								projectId: "same",
								revisionId: "same-revision",
							},
						],
						readRecoverySource: async () => original,
					}
				: undefined,
	});
	await model.start();
	const raw = model.sourceRecoveryFor("legacy");
	if (!raw) throw new Error("Missing explicit raw capability");
	const selected = await raw.readRecoverySource("same", "same-revision");
	if (!selected) throw new Error("Missing selected raw record");
	await model.prepareSource("legacy", selected);
	const file = model.takeFile();
	expect(file?.fileKind).toBe("unverified-source");
	expect(file?.filename.endsWith(".interiors-source.json")).toBe(true);
	expect(
		JSON.parse(new TextDecoder().decode(file?.bytes)).serializedProject,
	).toBe(original.serializedProject);
	expect(f.calls).toEqual(["directory"]);
	model.dispose();
});
test("a late raw read or its stale export callback cannot replace a newer file from another browser source", async () => {
	const f = fixture(),
		pending = held<
			import("../application/ports").UnverifiedProjectSource | undefined
		>(),
		source = {
			kind: "unverified-source" as const,
			projectId: "same",
			revisionId: "same-revision",
			serializedProject: "original",
		};
	const model = new BrowserReadonlyProjectsSession({
		...f.port,
		getSourceRecovery: () => ({
			listRecoverySources: async () => [],
			readRecoverySource: () => pending.promise,
		}),
	});
	await model.start();
	const raw = model.sourceRecoveryFor("legacy");
	if (!raw) throw new Error("Missing raw capability");
	const reading = raw.readRecoverySource("same", "same-revision");
	await model.prepare(f.rows[1], "registered");
	pending.resolve(source);
	expect(await reading).toBeUndefined();
	await expect(model.prepareSource("legacy", source)).rejects.toBeDefined();
	expect(model.takeFile()?.filename).toBe("owned.interiors");
	model.dispose();
});
test("raw file preparation requires the exact current source, address and selected original text", async () => {
	const f = fixture(),
		source = {
			kind: "unverified-source" as const,
			projectId: "same",
			revisionId: "same-revision",
			serializedProject: "original",
		};
	const model = new BrowserReadonlyProjectsSession({
		...f.port,
		getSourceRecovery: () => ({
			listRecoverySources: async () => [],
			readRecoverySource: async () => source,
		}),
	});
	await model.start();
	const raw = model.sourceRecoveryFor("legacy");
	if (!raw) throw new Error("Missing raw capability");
	const selected = await raw.readRecoverySource("same", "same-revision");
	if (!selected) throw new Error("Missing original");
	for (const [namespace, record] of [
		["browser-registered", selected],
		["legacy", { ...selected, serializedProject: "changed" }],
	] as const)
		await expect(model.prepareSource(namespace, record)).rejects.toBeDefined();
	f.legacy.abort();
	await expect(model.prepareSource("legacy", selected)).rejects.toBeDefined();
	expect(model.takeFile()).toBeUndefined();
	model.dispose();
});

test("read-only browser presentation names the two copies and offers only explicit local export actions", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	await model.start();
	const html = renderToStaticMarkup(
		<BrowserReadonlyProjectsContent
			state={model.snapshot()}
			onRefresh={() => undefined}
			onPrepare={() => undefined}
			onDownload={() => undefined}
		/>,
	);
	expect(html).toContain("Просмотр проектов");
	expect(html).toContain("обычное хранилище");
	expect(html).toContain("хранилище для переноса");
	expect(html).toContain("Копия 1");
	expect(html).toContain("Копия 2");
	expect(html).toContain("Подготовить полный архив");
	expect(html).toContain("Подготовить файл для переноса");
	for (const forbidden of [
		"Создать проект",
		"Удалить проект",
		"Импортировать файл",
		"Открыть проект",
	])
		expect(html).not.toContain(forbidden);
	model.dispose();
});
test("unavailable browser sources are never presented as an empty complete directory or a verified saved file", () => {
	const state = {
		status: "ready" as const,
		preparation: "ready" as const,
		fileKind: "unverified-source" as const,
		filename: "project.interiors-source.json",
		directory: {
			kind: "projects" as const,
			projects: [],
			storageSources: [
				{ storageNamespace: "legacy" as const, kind: "unavailable" as const },
				{
					storageNamespace: "browser-registered" as const,
					kind: "not-provisioned" as const,
					history: "unknown" as const,
				},
			],
		},
	};
	const html = renderToStaticMarkup(
		<BrowserReadonlyProjectsContent
			state={state}
			onRefresh={() => undefined}
			onPrepare={() => undefined}
			onDownload={() => undefined}
		/>,
	);
	expect(html).toContain("Часть проектов сейчас недоступна");
	expect(html).toContain("История прежних данных");
	expect(html).not.toContain("В обоих хранилищах пока нет");
	expect(html).toContain("Непроверенный исходник");
	expect(html).toContain("Скачать файл");
	expect(html).not.toContain("Файл сохранён");
});

test("supplemental readonly browser records filter to their source without creating a second main landmark", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	await model.start();
	const html = renderToStaticMarkup(
		<BrowserReadonlyProjectsContent
			state={model.snapshot()}
			sourceNamespaces={["legacy"]}
			supplemental
			onRefresh={() => undefined}
			onPrepare={() => undefined}
			onDownload={() => undefined}
		/>,
	);
	expect(html).toContain("Проекты только для выгрузки");
	expect(html).not.toContain("<main");
	expect(html).toContain("обычное хранилище");
	expect(html).not.toContain("хранилище для переноса");
	expect(html.match(/Подготовить полный архив<\/button>/g)).toHaveLength(1);
	model.dispose();
});

test("revoking one source publishes its cancellation before a callback starts a healthy neighbour export", async () => {
	const f = fixture(),
		old =
			held<Awaited<ReturnType<BrowserReadonlyProjectsPort["exportBackup"]>>>();
	let model: BrowserReadonlyProjectsSession,
		replacement: Promise<boolean> | undefined;
	model = new BrowserReadonlyProjectsSession({
		...f.port,
		exportBackup: (address, _format, signal) => {
			if (address.storageNamespace === "legacy") {
				if (signal instanceof AbortSignal)
					signal.addEventListener(
						"abort",
						() => {
							replacement = model.prepare(f.rows[1], "registered");
						},
						{ once: true },
					);
				return old.promise;
			}
			return f.state.export();
		},
	});
	await model.start();
	const preparing = model.prepare(f.rows[0], "legacy");
	f.legacy.abort();
	expect(await replacement).toBe(true);
	expect(model.takeFile()?.storageNamespace).toBe("browser-registered");
	old.resolve({
		kind: "ready",
		bytes: new Uint8Array([8]),
		filename: "old.interiors",
		mimeType: "application/zip",
	});
	expect(await preparing).toBe(false);
	expect(model.takeFile()?.filename).toBe("owned.interiors");
	model.dispose();
});

test("a prepared file from a different browser source cannot appear in the filtered supplemental section", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	await model.start();
	await model.prepare(f.rows[1], "registered");
	const hidden = renderToStaticMarkup(
		<BrowserReadonlyProjectsContent
			state={model.snapshot()}
			sourceNamespaces={["legacy"]}
			supplemental
			onRefresh={() => undefined}
			onPrepare={() => undefined}
			onDownload={() => undefined}
		/>,
	);
	expect(hidden).not.toContain("Подготовленный файл");
	expect(hidden).not.toContain("Скачать файл");
	const owned = renderToStaticMarkup(
		<BrowserReadonlyProjectsContent
			state={model.snapshot()}
			sourceNamespaces={["browser-registered"]}
			supplemental
			onRefresh={() => undefined}
			onPrepare={() => undefined}
			onDownload={() => undefined}
		/>,
	);
	expect(owned).toContain("Скачать файл");
	model.dispose();
});

test("a revoked source keeps an explicit recovery-required directory result without reviving its records", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	await model.start();
	f.legacy.abort();
	f.state.directory = async () => ({
		kind: "projects",
		projects: f.rows,
		storageSources: [
			{ storageNamespace: "legacy", kind: "recovery-required" },
			{ storageNamespace: "browser-registered", kind: "available" },
		],
		recoveryNeeded: true,
	});
	await model.refresh();
	expect(model.snapshot().directory?.storageSources).toContainEqual({
		storageNamespace: "legacy",
		kind: "recovery-required",
	});
	expect(model.snapshot().directory?.projects).toEqual([f.rows[1]]);
	expect(model.snapshot().directory?.recoveryNeeded).toBe(true);
	model.dispose();
});

test("raw recovery inside a writable hub does not duplicate healthy project cards or offer full-backup preparation", async () => {
	const f = fixture(),
		model = new BrowserReadonlyProjectsSession(f.port);
	await model.start();
	const html = renderToStaticMarkup(
		<BrowserReadonlyProjectsContent
			state={model.snapshot()}
			rawOnly
			supplemental
			onRefresh={() => undefined}
			onPrepare={() => undefined}
			onDownload={() => undefined}
		/>,
	);
	expect(html).toContain("Исходные записи для восстановления");
	expect(html).not.toContain("Подготовить полный архив");
	expect(html).not.toContain("Подготовить файл для переноса");
	expect(html).not.toContain("<main");
	expect(html).not.toContain("Одинаковый план");
	model.dispose();
});
