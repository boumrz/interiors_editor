import { expect, test } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import type { BrowserReadonlyProjectsDirectory, BrowserReadonlyProjectsPort } from "../app/browser-readonly-projects-port";
import type { ProjectSourceRecoveryPort, ProjectStorageSourceStatus, UnverifiedProjectSource } from "../application/ports";
import { BrowserReadonlyProjectsContent, BrowserReadonlyProjectsSession, type BrowserReadonlyProjectsSnapshot } from "./browser-readonly-projects";

function held<T>() {
	let resolve!: (value: T) => void, reject!: (error: unknown) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}
function fixture() {
	const lifetime = new AbortController(), legacy = new AbortController(), registered = new AbortController();
	const row = { storageNamespace: "legacy" as const, projectId: "project", revisionId: "revision", name: "Owned", updatedAt: "2026-11-05" };
	const directory: BrowserReadonlyProjectsDirectory = { kind: "projects", projects: [row], storageSources: [{ storageNamespace: "legacy", kind: "available" }, { storageNamespace: "browser-registered", kind: "available" }] };
	const io = {
		legacySignal: legacy.signal,
		read: async (): Promise<BrowserReadonlyProjectsDirectory> => directory,
		export: async (): ReturnType<BrowserReadonlyProjectsPort["exportBackup"]> => ({ kind: "ready", bytes: new Uint8Array([10, 20]), filename: "owned.interiors", mimeType: "application/zip" }),
		raw: undefined as ProjectSourceRecoveryPort | undefined,
	};
	const exports: unknown[] = [];
	const port: BrowserReadonlyProjectsPort = { signal: lifetime.signal, getSourceSignal: namespace => namespace === "legacy" ? io.legacySignal : registered.signal, getSourceRecovery: () => io.raw, readDirectory: () => io.read(), exportBackup: (address, format) => { exports.push([address, format]); return io.export(); } };
	const model = new BrowserReadonlyProjectsSession(port);
	return { model, io, row, directory, legacy, registered, lifetime, exports };
}
function html(state: BrowserReadonlyProjectsSnapshot, props: Partial<Parameters<typeof BrowserReadonlyProjectsContent>[0]> = {}) {
	return renderToStaticMarkup(<BrowserReadonlyProjectsContent state={state} onRefresh={() => undefined} onPrepare={() => undefined} onDownload={() => undefined} {...props} />);
}

test("loading, unavailable and closed views expose only their current status and busy state", () => {
	const cues = { loading: "Проверяем локальные записи", unavailable: "Не удалось проверить список проектов", closed: "Просмотр завершён" };
	for (const status of ["loading", "unavailable", "closed", "ready"] as const) {
		const rendered = html({ status, preparation: "idle" });
		expect(rendered).toContain(`aria-busy="${status === "loading"}"`);
		for (const [kind, cue] of Object.entries(cues)) {
			if (status === kind) expect(rendered).toContain(cue);
			else expect(rendered).not.toContain(cue);
		}
		expect(rendered).not.toContain("В обоих хранилищах пока нет");
		expect(rendered).not.toContain("Скачать файл");
	}
});

test("only a known healthy empty full directory says it is empty, and raw-only never duplicates that directory", () => {
	const f = fixture(), empty = { ...f.directory, projects: [] };
	const state = { status: "ready" as const, preparation: "idle" as const, directory: empty };
	const rendered = html(state);
	expect(rendered).toContain("В обоих хранилищах пока нет проверенных проектов");
	expect(rendered).not.toContain('aria-label="Проверенные записи"');
	const populated = html({ ...state, directory: f.directory });
	expect(populated).not.toContain("В обоих хранилищах пока нет");
	expect(populated).toContain('aria-label="Проверенные записи"');
	for (const directory of [empty, f.directory]) {
		const raw = html({ ...state, directory }, { rawOnly: true, supplemental: true });
		expect(raw).not.toContain("В обоих хранилищах пока нет");
		expect(raw).not.toContain('aria-label="Проверенные записи"');
		expect(raw).not.toContain("Подготовить полный архив");
	}
	f.model.dispose();
});

test("an actual ready complete file preserves its discriminator, owner, MIME and bytes in both public outputs", async () => {
	const f = fixture(); await f.model.start();
	expect(await f.model.prepare(f.row, "legacy")).toBe(true);
	expect(f.model.snapshot()).toMatchObject({ status: "ready", preparation: "ready", filename: "owned.interiors", fileNamespace: "legacy", fileKind: "portable-backup" });
	expect(f.model.takeFile()).toEqual({ bytes: new Uint8Array([10, 20]), filename: "owned.interiors", mimeType: "application/zip", fileKind: "portable-backup", storageNamespace: "legacy" });
	const rendered = html(f.model.snapshot());
	expect(rendered).toContain("Полный архив подготовлен"); expect(rendered).toContain("Сохраните файл и отдельно проверьте его вне приложения");
	expect(rendered).not.toContain("Непроверенный исходник");
	f.model.dispose();
});

test("raw recovery panels hide prepared complete archives and explain a genuinely selected source file", async () => {
	const f = fixture(); await f.model.start(); await f.model.prepare(f.row, "legacy");
	const hidden = html(f.model.snapshot(), { rawOnly: true });
	expect(hidden).not.toContain('aria-label="Подготовленный файл"'); expect(hidden).not.toContain("Скачать файл");
	const original: UnverifiedProjectSource = { kind: "unverified-source", projectId: "broken", revisionId: "broken-revision", serializedProject: " \ud800\u0000raw " };
	f.io.raw = { listRecoverySources: async () => [original], readRecoverySource: async () => original };
	const port = f.model.sourceRecoveryFor("legacy"), selected = await port?.readRecoverySource(original.projectId, original.revisionId);
	if (!selected) throw new Error("Missing explicit raw selection");
	await f.model.prepareSource("legacy", selected);
	expect(f.model.takeFile()).toMatchObject({ fileKind: "unverified-source", mimeType: "application/json", storageNamespace: "legacy" });
	const shown = html(f.model.snapshot(), { rawOnly: true });
	expect(shown).toContain('aria-label="Подготовленный файл"'); expect(shown).toContain("Непроверенный исходник");
	expect(shown).toContain("Полнота проекта и"); expect(shown).toContain("возможность импорта не подтверждены");
	expect(shown).not.toContain("Полный архив подготовлен"); expect(shown).toContain("Скачать файл");
	f.model.dispose();
});

test("a selected source section does not inherit an unavailable neighbor's warning or retry", () => {
	const f = fixture(), directory: BrowserReadonlyProjectsDirectory = { ...f.directory, storageSources: [{ storageNamespace: "legacy", kind: "available" }, { storageNamespace: "browser-registered", kind: "unavailable" }] };
	const rendered = html({ status: "ready", preparation: "idle", directory }, { sourceNamespaces: ["legacy"], supplemental: true });
	expect(rendered).toContain("обычное хранилище"); expect(rendered).not.toContain("хранилище для переноса");
	expect(rendered).not.toContain("Часть проектов сейчас недоступна"); expect(rendered).not.toContain("Повторить проверку");
	f.model.dispose();
});

test("preparing and failed files show their own outcome without presenting a ready download", () => {
	const f = fixture();
	for (const preparation of ["idle", "preparing", "failed", "ready"] as const) {
		const state: BrowserReadonlyProjectsSnapshot = { status: "ready", directory: f.directory, preparation, ...(preparation === "ready" ? { filename: "owned.interiors", fileNamespace: "legacy", fileKind: "portable-backup" } : {}) };
		const rendered = html(state);
		if (preparation === "preparing") expect(rendered).toContain("Готовим проверенный архив");
		else expect(rendered).not.toContain("Готовим проверенный архив");
		if (preparation === "failed") expect(rendered).toContain("Не удалось подготовить полный архив");
		else expect(rendered).not.toContain("Не удалось подготовить полный архив");
		if (preparation === "ready") expect(rendered).toContain("Скачать файл");
		else expect(rendered).not.toContain("Скачать файл");
	}
	f.model.dispose();
});

test("a mixed directory explains unverified records while keeping its healthy export cards", () => {
	const f = fixture(), state = { status: "ready" as const, preparation: "idle" as const, directory: { ...f.directory, recoveryNeeded: true as const } };
	const rendered = html(state);
	expect(rendered).toContain("Часть записей не прошла проверку"); expect(rendered).toContain("Их исходные данные можно");
	expect(rendered).toContain("Подготовить полный архив"); expect(rendered).toContain("Owned");
	expect(html({ ...state, directory: f.directory })).not.toContain("Часть записей не прошла проверку");
	f.model.dispose();
});

test("old visible cards cannot start an export during a pending refresh", async () => {
	const f = fixture(), gate = held<BrowserReadonlyProjectsDirectory>(); await f.model.start(); f.io.read = () => gate.promise;
	const refreshing = f.model.refresh();
	expect(f.model.snapshot().status).toBe("loading"); expect(f.model.snapshot().directory?.projects).toEqual([f.row]);
	expect(await f.model.prepare(f.row, "legacy")).toBe(false); expect(f.exports).toEqual([]);
	gate.resolve(f.directory); await refreshing; f.model.dispose();
});

test("an old rejected query cannot replace a newer ready directory or notify its observers", async () => {
	const f = fixture(), gate = held<BrowserReadonlyProjectsDirectory>(); await f.model.start(); f.io.read = () => gate.promise;
	const old = f.model.refresh(); const current = { ...f.directory, projects: [{ ...f.row, name: "Newer owned view" }] };
	f.io.read = async () => current; await f.model.refresh(); const snapshot = f.model.snapshot();
	let updates = 0; const stop = f.model.subscribe(() => { updates++; });
	gate.reject(new Error("private old query failure")); await old;
	expect(f.model.snapshot()).toBe(snapshot); expect(f.model.snapshot().status).toBe("ready"); expect(f.model.snapshot().directory?.projects).toEqual(current.projects); expect(updates).toBe(0);
	stop(); f.model.dispose();
});

test("source abort publishes its exact recovery status immediately and leaves its neighbor unchanged", async () => {
	for (const kind of ["available", "recovery-required"] as const) {
		const f = fixture(); const statuses: readonly ProjectStorageSourceStatus[] = [{ storageNamespace: "legacy", kind }, { storageNamespace: "browser-registered", kind: "available" }];
		f.io.read = async () => ({ ...f.directory, storageSources: statuses }); await f.model.start(); f.legacy.abort();
		expect(f.model.snapshot().directory?.storageSources).toEqual([{ storageNamespace: "legacy", kind: kind === "recovery-required" ? "recovery-required" : "unavailable" }, { storageNamespace: "browser-registered", kind: "available" }]);
		expect(f.model.snapshot().directory?.projects).toEqual([]); f.model.dispose();
	}
});

test("revoking an affected pending or prepared file immediately clears its ready filename and preparation state", async () => {
	for (const mode of ["pending", "prepared"] as const) {
		const f = fixture(), gate = held<Awaited<ReturnType<BrowserReadonlyProjectsPort["exportBackup"]>>>(); await f.model.start();
		if (mode === "pending") f.io.export = () => gate.promise;
		const preparing = f.model.prepare(f.row, "legacy"); if (mode === "prepared") await preparing;
		f.legacy.abort(); expect(f.model.snapshot().preparation).toBe("idle"); expect(f.model.snapshot().filename).toBeUndefined(); expect(f.model.takeFile()).toBeUndefined();
		gate.resolve({ kind: "ready", bytes: new Uint8Array([99]), filename: "late.interiors", mimeType: "application/zip" }); await preparing; f.model.dispose();
	}
});

test("a live but unlisted namespace cannot borrow another source's equal raw Project and Revision IDs", async () => {
	const f = fixture(); await f.model.start();
	expect(await f.model.prepare({ ...f.row, storageNamespace: "browser-registered" }, "registered")).toBe(false);
	expect(f.exports).toEqual([]); f.model.dispose();
});

test("a changed raw callback cannot replace the record the user selected even when it matches the fresh provider", async () => {
	for (const field of ["projectId", "revisionId", "serializedProject"] as const) {
		const f = fixture(), original: UnverifiedProjectSource = { kind: "unverified-source", projectId: "raw", revisionId: "raw-revision", serializedProject: "selected original" };
		let current = original; f.io.raw = { listRecoverySources: async () => [current], readRecoverySource: async () => current }; await f.model.start();
		const port = f.model.sourceRecoveryFor("legacy"), selected = await port?.readRecoverySource(original.projectId, original.revisionId);
		if (!selected) throw new Error("Missing explicitly selected original");
		current = { ...original, [field]: "changed" };
		await expect(f.model.prepareSource("legacy", current)).rejects.toBeDefined(); expect(f.model.takeFile()).toBeUndefined(); f.model.dispose();
	}
});

test("a delayed raw read cannot reclaim ownership after archive and raw requests complete in between", async () => {
	const f = fixture(), gate = held<UnverifiedProjectSource | undefined>();
	const a: UnverifiedProjectSource = { kind: "unverified-source", projectId: "raw-A", revisionId: "revision-A", serializedProject: "old A" }, c: UnverifiedProjectSource = { kind: "unverified-source", projectId: "raw-C", revisionId: "revision-C", serializedProject: "current C" };
	const registeredRow = { ...f.row, storageNamespace: "browser-registered" as const };
	f.io.read = async () => ({ ...f.directory, projects: [f.row, registeredRow] });
	f.io.raw = { listRecoverySources: async () => [a, c], readRecoverySource: projectId => projectId === a.projectId ? gate.promise : Promise.resolve(c) };
	await f.model.start();
	const legacy = f.model.sourceRecoveryFor("legacy"), registered = f.model.sourceRecoveryFor("browser-registered");
	if (!legacy || !registered) throw new Error("Missing raw capabilities");
	const old = legacy.readRecoverySource(a.projectId, a.revisionId);
	expect(await f.model.prepare(registeredRow, "registered")).toBe(true);
	const current = await registered.readRecoverySource(c.projectId, c.revisionId); if (!current) throw new Error("Missing new selected source");
	await f.model.prepareSource("browser-registered", current);
	gate.resolve(a); expect(await old).toBeUndefined();
	await expect(f.model.prepareSource("legacy", a)).rejects.toBeDefined();
	const file = f.model.takeFile(); expect(file?.storageNamespace).toBe("browser-registered");
	expect(JSON.parse(new TextDecoder().decode(file?.bytes)).serializedProject).toBe(c.serializedProject);
	f.model.dispose();
});

test("concurrent preparation of one selected raw ticket grants only its first completed request", async () => {
	const f = fixture(), first = held<UnverifiedProjectSource | undefined>(), second = held<UnverifiedProjectSource | undefined>();
	const original: UnverifiedProjectSource = { kind: "unverified-source", projectId: "raw", revisionId: "revision", serializedProject: "selected" };
	let reads = 0;
	f.io.raw = { listRecoverySources: async () => [original], readRecoverySource: async () => { reads++; return reads === 1 ? original : reads === 2 ? first.promise : second.promise; } };
	await f.model.start(); const port = f.model.sourceRecoveryFor("legacy"), selected = await port?.readRecoverySource(original.projectId, original.revisionId);
	if (!selected) throw new Error("Missing selected ticket");
	const a = f.model.prepareSource("legacy", selected), b = f.model.prepareSource("legacy", selected); const completed = Promise.allSettled([a, b]);
	first.resolve(original); await a; const owned = f.model.takeFile(); second.resolve(original);
	expect((await completed).map(value => value.status)).toEqual(["fulfilled", "rejected"]); expect(f.model.takeFile()).toEqual(owned);
	f.model.dispose();
});

test("replacing a source signal during the final raw recheck refuses its old file without requiring an abort", async () => {
	const f = fixture(), gate = held<UnverifiedProjectSource | undefined>(), original: UnverifiedProjectSource = { kind: "unverified-source", projectId: "raw", revisionId: "revision", serializedProject: "old owner" };
	let reads = 0; f.io.raw = { listRecoverySources: async () => [original], readRecoverySource: async () => ++reads === 1 ? original : gate.promise };
	await f.model.start(); const port = f.model.sourceRecoveryFor("legacy"), selected = await port?.readRecoverySource(original.projectId, original.revisionId); if (!selected) throw new Error("Missing selected source");
	const preparing = f.model.prepareSource("legacy", selected); const checked = expect(preparing).rejects.toBeDefined();
	f.io.legacySignal = new AbortController().signal; expect(f.legacy.signal.aborted).toBe(false); gate.resolve(original); await checked;
	expect(f.model.takeFile()).toBeUndefined(); f.model.dispose();
});
