import { expect, test } from "@rstest/core";
import type { BrowserReadonlyProjectsPort } from "../app/browser-readonly-projects-port";
import type { ProjectSourceRecoveryPort, ProjectStorageNamespace, UnverifiedProjectSource } from "../application/ports";
import { BrowserReadonlyProjectsSession } from "./browser-readonly-projects";

function setup(raw?: (namespace: ProjectStorageNamespace) => ProjectSourceRecoveryPort | undefined) {
	const lifetime = new AbortController();
	const sources: Record<ProjectStorageNamespace, AbortController | undefined> = {
		legacy: new AbortController(),
		"browser-registered": new AbortController(),
	};
	const row = {
		storageNamespace: "legacy" as const,
		projectId: "owned-project",
		revisionId: "owned-revision",
		name: "Owned project",
		updatedAt: "2026-11-05",
	};
	const calls: string[] = [];
	const io = {
		export: async (): ReturnType<BrowserReadonlyProjectsPort["exportBackup"]> => ({
			kind: "ready",
			bytes: new Uint8Array([10, 20]),
			filename: "owned.interiors",
			mimeType: "application/zip",
		}),
	};
	const directory = {
		kind: "projects" as const,
		projects: [row],
		storageSources: [
			{ storageNamespace: "legacy" as const, kind: "available" as const },
			{ storageNamespace: "browser-registered" as const, kind: "available" as const },
		],
	};
	const model = new BrowserReadonlyProjectsSession({
		signal: lifetime.signal,
		getSourceSignal: (namespace) => sources[namespace]?.signal,
		getSourceRecovery: (namespace) => raw?.(namespace),
		readDirectory: async () => {
			calls.push("list");
			return directory;
		},
		exportBackup: async () => {
			calls.push("export");
			return io.export();
		},
	});
	return { model, lifetime, sources, row, directory, calls, io };
}

test("an unopened readonly view exposes its exact loading snapshot and performs no early query or export", async () => {
	const f = setup();
	expect(f.model.snapshot()).toEqual({ status: "loading", preparation: "idle" });
	expect(Object.isFrozen(f.model.snapshot())).toBe(true);
	await f.model.refresh();
	expect(await f.model.prepare(f.row, "legacy")).toBe(false);
	expect(f.calls).toEqual([]);
	f.model.dispose();
});

test("concurrent start requests share one result and a disposed view can never restart or query", async () => {
	const f = setup();
	const first = f.model.start();
	expect(f.model.start()).toBe(first);
	await first;
	expect(f.calls).toEqual(["list"]);
	f.model.dispose();
	await f.model.start();
	await f.model.refresh();
	expect(await f.model.prepare(f.row, "legacy")).toBe(false);
	expect(f.model.snapshot()).toEqual({ status: "closed", preparation: "idle" });
	expect(f.calls).toEqual(["list"]);
});

test("disposal before first start permanently closes an inert view", async () => {
	const f = setup();
	f.model.dispose();
	await f.model.start();
	await f.model.refresh();
	expect(f.calls).toEqual([]);
	expect(f.model.snapshot()).toEqual({ status: "closed", preparation: "idle" });
});

test("an already revoked lifetime cannot start reading and later lifetime revocation clears a prepared file", async () => {
	const unopened = setup();
	unopened.lifetime.abort();
	await unopened.model.start();
	expect(unopened.calls).toEqual([]);
	expect(unopened.model.snapshot().status).toBe("closed");
	const f = setup();
	await f.model.start();
	expect(await f.model.prepare(f.row, "legacy")).toBe(true);
	f.lifetime.abort();
	expect(f.model.snapshot()).toEqual({ status: "closed", preparation: "idle" });
	expect(f.model.takeFile()).toBeUndefined();
	await f.model.refresh();
	expect(f.calls).toEqual(["list", "export"]);
});

test("removing an observer during delivery skips it and throwing observers cannot suppress later observers", async () => {
	const f = setup();
	const notifications: string[] = [];
	let remove = () => {};
	f.model.subscribe(() => { remove(); throw new Error("private observer failure"); });
	remove = f.model.subscribe(() => { notifications.push("removed"); });
	const stop = f.model.subscribe(() => { notifications.push(f.model.snapshot().status); });
	await f.model.start();
	expect(notifications).toEqual(["loading", "ready"]);
	stop();
	await f.model.refresh();
	expect(notifications).toEqual(["loading", "ready"]);
	f.model.dispose();
});

test("another project with the same revision and source cannot select an owned export", async () => {
	const f = setup();
	await f.model.start();
	expect(await f.model.prepare({ ...f.row, projectId: "different-project" }, "legacy")).toBe(false);
	expect(f.calls).toEqual(["list"]);
	f.model.dispose();
});

test("the public directory is an immutable owned snapshot of borrowed rows and source status", async () => {
	const f = setup();
	await f.model.start();
	const owned = f.model.snapshot().directory;
	expect(Object.isFrozen(owned)).toBe(true);
	expect(Object.isFrozen(owned?.projects)).toBe(true);
	expect(Object.isFrozen(owned?.projects[0])).toBe(true);
	expect(Object.isFrozen(owned?.storageSources)).toBe(true);
	expect(Object.isFrozen(owned?.storageSources[0])).toBe(true);
	f.directory.projects[0].name = "Borrowed mutation";
	f.directory.projects.length = 0;
	f.directory.storageSources.length = 0;
	expect(owned?.projects).toEqual([{ ...f.row, name: "Owned project" }]);
	expect(owned?.storageSources).toHaveLength(2);
	f.model.dispose();
});

test("an obsolete source signal cannot revoke the replacement source and its newly prepared file", async () => {
	const f = setup();
	await f.model.start();
	const prior = f.sources.legacy;
	f.sources.legacy = new AbortController();
	await f.model.refresh();
	expect(await f.model.prepare(f.row, "legacy")).toBe(true);
	prior?.abort();
	expect(f.model.takeFile()?.filename).toBe("owned.interiors");
	expect(f.model.snapshot().directory?.projects).toHaveLength(1);
	f.sources.legacy.abort();
	expect(f.model.takeFile()).toBeUndefined();
	expect(f.model.snapshot().directory?.projects).toEqual([]);
	f.model.dispose();
});

test("a missing current source refuses file delivery even while its last directory address remains visible", async () => {
	const f = setup();
	await f.model.start();
	await f.model.prepare(f.row, "legacy");
	f.sources.legacy = undefined;
	expect(f.model.takeFile()).toBeUndefined();
	expect(await f.model.prepare(f.row, "legacy")).toBe(false);
	expect(f.calls).toEqual(["list", "export"]);
	f.model.dispose();
});

test("a verifier refusal or exception clears a previous download without exposing its private reason", async () => {
	for (const failure of ["refusal", "throw"] as const) {
		const f = setup();
		await f.model.start();
		await f.model.prepare(f.row, "legacy");
		f.io.export = async () => {
			if (failure === "throw") throw new Error("PRIVATE_RESOURCE_PATH");
			return { kind: "verification-unavailable" };
		};
		expect(await f.model.prepare(f.row, "legacy")).toBe(false);
		expect(f.model.takeFile()).toBeUndefined();
		expect(f.model.snapshot().preparation).toBe("failed");
		expect(f.model.snapshot().filename).toBeUndefined();
		expect(JSON.stringify(f.model.snapshot())).not.toContain("PRIVATE_RESOURCE_PATH");
		f.model.dispose();
	}
});

function rawSetup() {
	const original: UnverifiedProjectSource = {
		kind: "unverified-source", projectId: "raw-project", revisionId: "raw-revision", serializedProject: " \ud800\u0000raw\n ",
	};
	const source = { current: original as UnverifiedProjectSource | undefined };
	const f = setup(() => ({
		listRecoverySources: async () => [{ kind: "unverified-source", projectId: original.projectId, revisionId: original.revisionId }],
		readRecoverySource: async () => source.current,
	}));
	return { ...f, source, original };
}

test("raw selection refuses missing, foreign-kind or differently addressed source records", async () => {
	for (const field of ["missing", "kind", "projectId", "revisionId"] as const) {
		const f = rawSetup();
		await f.model.start();
		if (field === "missing") f.source.current = undefined;
		else { f.source.current = { ...f.original }; Reflect.set(f.source.current, field, "different"); }
		const raw = f.model.sourceRecoveryFor("legacy");
		if (!raw) throw new Error("Missing admitted raw reader");
		expect(await raw.readRecoverySource(f.original.projectId, f.original.revisionId)).toBeUndefined();
		expect(f.model.takeFile()).toBeUndefined();
		f.model.dispose();
	}
});

test("raw preparation rechecks every exact source field after selection and refuses a missing replacement", async () => {
	for (const field of ["missing", "kind", "projectId", "revisionId", "serializedProject"] as const) {
		const f = rawSetup();
		await f.model.start();
		const raw = f.model.sourceRecoveryFor("legacy");
		if (!raw) throw new Error("Missing admitted raw reader");
		const selected = await raw.readRecoverySource(f.original.projectId, f.original.revisionId);
		if (!selected) throw new Error("Missing selected original");
		if (field === "missing") f.source.current = undefined;
		else { f.source.current = { ...f.original }; Reflect.set(f.source.current, field, "different"); }
		await expect(f.model.prepareSource("legacy", selected)).rejects.toBeDefined();
		expect(f.model.takeFile()).toBeUndefined();
		f.model.dispose();
	}
});

test("a raw callback requires its selected exact kind and address, and one selection prepares only once", async () => {
	const f = rawSetup();
	await f.model.start();
	const raw = f.model.sourceRecoveryFor("legacy");
	if (!raw) throw new Error("Missing admitted raw reader");
	const selected = await raw.readRecoverySource(f.original.projectId, f.original.revisionId);
	if (!selected) throw new Error("Missing selected original");
	for (const field of ["kind", "projectId", "revisionId"] as const) {
		const foreign = { ...selected }; Reflect.set(foreign, field, "different");
		await expect(f.model.prepareSource("legacy", foreign)).rejects.toBeDefined();
	}
	await expect(f.model.prepareSource("legacy", selected)).resolves.toBeUndefined();
	expect(f.model.takeFile()?.fileKind).toBe("unverified-source");
	await expect(f.model.prepareSource("legacy", selected)).rejects.toBeDefined();
	f.model.dispose();
});

test("a raw reader remains stable for one admission, while replacement invalidates its old methods and ticket", async () => {
	const f = rawSetup();
	await f.model.start();
	const raw = f.model.sourceRecoveryFor("legacy");
	if (!raw) throw new Error("Missing admitted raw reader");
	expect(f.model.sourceRecoveryFor("legacy")).toBe(raw);
	const selected = await raw.readRecoverySource(f.original.projectId, f.original.revisionId);
	if (!selected) throw new Error("Missing selected original");
	f.sources.legacy = new AbortController();
	await f.model.refresh();
	expect(await raw.listRecoverySources()).toEqual([]);
	expect(await raw.readRecoverySource(f.original.projectId, f.original.revisionId)).toBeUndefined();
	await expect(f.model.prepareSource("legacy", selected)).rejects.toBeDefined();
	const replacement = f.model.sourceRecoveryFor("legacy");
	expect(replacement).not.toBe(raw);
	expect(await replacement?.listRecoverySources()).toEqual([{ kind: "unverified-source", projectId: f.original.projectId, revisionId: f.original.revisionId }]);
	f.model.dispose();
});

test("revoking another source preserves a healthy raw selection and its exact prepared contents", async () => {
	const f = rawSetup();
	await f.model.start();
	const raw = f.model.sourceRecoveryFor("browser-registered");
	if (!raw) throw new Error("Missing admitted raw reader");
	const selected = await raw.readRecoverySource(f.original.projectId, f.original.revisionId);
	if (!selected) throw new Error("Missing selected original");
	f.sources.legacy?.abort();
	await expect(f.model.prepareSource("browser-registered", selected)).resolves.toBeUndefined();
	const file = f.model.takeFile();
	expect(file?.storageNamespace).toBe("browser-registered");
	expect(JSON.parse(new TextDecoder().decode(file?.bytes)).serializedProject).toBe(f.original.serializedProject);
	f.model.dispose();
});

test("revoking an unrelated source does not cancel or hide an already pending healthy archive", async () => {
	const f = setup();
	let finish!: (value: Awaited<ReturnType<BrowserReadonlyProjectsPort["exportBackup"]>>) => void;
	const gate = new Promise<Awaited<ReturnType<BrowserReadonlyProjectsPort["exportBackup"]>>>((resolve) => { finish = resolve; });
	await f.model.start();
	f.io.export = () => gate;
	const pending = f.model.prepare(f.row, "legacy");
	f.sources["browser-registered"]?.abort();
	expect(f.model.snapshot().preparation).toBe("preparing");
	finish({ kind: "ready", bytes: new Uint8Array([42]), filename: "healthy.interiors", mimeType: "application/zip" });
	expect(await pending).toBe(true);
	expect(f.model.takeFile()?.bytes).toEqual(new Uint8Array([42]));
	f.model.dispose();
});
