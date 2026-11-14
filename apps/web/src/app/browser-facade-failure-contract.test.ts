import { expect, it } from "@rstest/core";
import { completedFacadeOperation, core, fixture, projects, summary } from "./browser-facade-test-support";
import { createBrowserProjectControllerFacade } from "./browser-project-controller-facade";
import type { PublicationCandidate } from "../application/ports";
import type { ProjectController, ProjectScreenState } from "./project-controller";
import { createInitialProject } from "../domain/initial-project";

const bytes = Uint8Array.of(80, 75);
const ownerOptions = { storageNamespace: "browser-registered" } as const;
function saved(name = "Imported", projectId = "imported", revisionId = "revision"): Extract<ProjectScreenState, {kind: "saved"}> {
 const project = createInitialProject({ name, projectId, levelId: "level", createdAt: "2026-11-05T00:00:00.000Z" });
 return { kind: "saved", project, projectName: name, revisionId };
}
function view(f: ReturnType<typeof fixture>) {
 const result = f.facade.getEditorInstanceSnapshot().controller;
 if (!result) throw new Error("Missing selected instance");
 return result;
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function latch() {
 let release = () => {};
 const waiting = new Promise<void>((resolve) => { release = resolve; });
 return { waiting, release };
}
function recoveryCandidate(projectId = "same-id"): PublicationCandidate {
 const project = createInitialProject({ name: "Recovery", projectId, levelId: "level", createdAt: "2026-11-05T00:00:00.000Z" });
 return { project, revision: { projectId, revisionId: "recovery-revision", schemaVersion: 1, checksum: "a".repeat(64), serializedProject: JSON.stringify(project), createdAt: project.createdAt } };
}

for (const owner of ["legacy", "registered"] as const) for (const kind of ["saving", "persist-failed"] as const) {
 it(`preserves every source when ${owner} reports ${kind} before its public busy flag`, async () => {
  const f = fixture(); await completedFacadeOperation(f.facade.controller.open());
  const before = f.facade.controller.snapshot(), instance = f.facade.getEditorInstanceSnapshot();
  const candidate = saved("Retained", "same-id");
  f[owner].setState(kind === "saving" ? { ...candidate, kind: "saving" } : { ...candidate, kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
  expect(f[owner].controller.hasPendingPublication()).toBe(false);
  const calls = [f.legacy.calls.length, f.registered.calls.length, f.legacy.invocations.length, f.registered.invocations.length, f.reads()];
  await completedFacadeOperation(f.facade.controller.showProjects()); f.facade.controller.startNewProject();
  await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
  expect(await completedFacadeOperation(f.facade.controller.permanentlyDeleteProjectFromDirectory("same-id", ownerOptions))).toEqual({ kind: "not-ready" });
  expect(f.facade.controller.snapshot()).toBe(before); expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
  expect([f.legacy.calls.length, f.registered.calls.length, f.legacy.invocations.length, f.registered.invocations.length, f.reads()]).toEqual(calls);
  await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
 });
}

for (const throwing of ["sync", "async"] as const) {
 it(`makes a ${throwing} selected command refusal safe and releases its navigation guard`, async () => {
  const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
  const instance = f.facade.getEditorInstanceSnapshot();
  f.registered.controller.renameProject = throwing === "sync" ? () => { throw new Error("Denied"); } : async () => { throw new Error("Denied"); };
  expect(await completedFacadeOperation(view(f).renameProject("Denied name"))).toEqual({ kind: "not-ready" });
  expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
  expect(f.facade.controller.hasPendingPublication()).toBe(false);
  await completedFacadeOperation(f.facade.controller.showProjects()); expect(projects(f.facade.controller).projects).toHaveLength(2);
  await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
 });
}

for (const property of ["exportProjectTransfer", "exportRegisteredProjectTransfer"] as const) {
 it(`returns a safe refusal for an actual ${property} failure and keeps the selected editor usable`, async () => {
  const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
  const instance = f.facade.getEditorInstanceSnapshot();
  f.registered.controller[property] = async () => { throw new Error("Resource unavailable"); };
  expect(await view(f)[property]()).toEqual({ kind: "not-ready" });
  expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
  expect(await completedFacadeOperation(view(f).renameProject("Still selected"))).toEqual({ kind: "not-ready" });
  expect(f.registered.invocations.at(-1)).toEqual({ method: "renameProject", args: ["Still selected"] });
  await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
 });
 it(`refuses a contradictory selected-owner option on ${property} without reading either source`, async () => {
  const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
  const before = [f.legacy.invocations.length, f.registered.invocations.length];
  expect(await view(f)[property](undefined, { storageNamespace: "legacy" })).toEqual({ kind: "not-ready" });
  expect([f.legacy.invocations.length, f.registered.invocations.length]).toEqual(before);
  await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
 });
 it(`passes the exact cancellation signal through ${property} while owner metadata stays in the trusted facade`, async () => {
  const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
  const signal = new AbortController().signal;
  expect((await view(f)[property](undefined, { ...ownerOptions, signal })).kind).toBe("ready");
  expect(f.registered.invocations.at(-1)).toEqual({ method: property, args: [undefined, { signal }] });
  await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
 });
}

for (const failure of ["open", "delete", "import"] as const) {
 it(`contains an actual source ${failure} rejection without a false successful result`, async () => {
  const f = fixture(); await completedFacadeOperation(f.facade.controller.open());
  if (failure === "open") {
   f.registered.controller.openProject = async () => { throw new Error("Corrupt revision"); };
   await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
   expect(f.facade.controller.snapshot()).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
  } else if (failure === "delete") {
   f.registered.controller.permanentlyDeleteProjectFromDirectory = async () => { throw new Error("Transaction refused"); };
   expect(await completedFacadeOperation(f.facade.controller.permanentlyDeleteProjectFromDirectory("same-id", ownerOptions))).toEqual({ kind: "not-ready" });
   expect(f.reads()).toBe(1);
  } else {
   f.registered.controller.importRegisteredPortableBackup = async () => { throw new Error("Verification failed"); };
   expect(await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(bytes))).toEqual({ kind: "verification-unavailable" });
   expect(f.facade.getEditorInstanceSnapshot().storageNamespace).toBeUndefined();
  }
  expect(f.facade.controller.hasPendingPublication()).toBe(false);
  await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
 });
}

for (const mismatch of ["project", "revision", "missing-project", "missing-revision", "unsaved-screen"] as const) {
 it(`refuses a claimed Durable import whose ${mismatch} does not establish the actual selected Revision`, async () => {
  const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", { storageNamespace: "legacy" }));
  const before = f.facade.controller.snapshot(), instance = f.facade.getEditorInstanceSnapshot();
  f.registered.controller.importRegisteredPortableBackup = (async () => {
   f.registered.setState(mismatch === "unsaved-screen" ? { kind: "first-run" } : saved());
   return { kind: "durable", ...(mismatch === "missing-project" ? {} : { projectId: mismatch === "project" ? "foreign" : "imported" }), ...(mismatch === "missing-revision" ? {} : { revisionId: mismatch === "revision" ? "foreign-revision" : "revision" }) };
  }) as ProjectController["importRegisteredPortableBackup"];
  expect(await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(bytes))).toEqual({ kind: "verification-unavailable" });
  expect(f.facade.controller.snapshot()).toBe(before); expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
  await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
 });
}

it("tracks a successful create's actual address and passes its exact name to legacy", async () => {
 const f = fixture(); f.facade.controller.startNewProject();
 const bound = view(f); expect((await bound.create("Exact new name")).kind).toBe("durable");
 expect(f.legacy.invocations.at(-1)).toEqual({ method: "create", args: ["Exact new name"] });
 expect(bound.snapshot()).toMatchObject({ kind: "saved", project: { projectId: "created", name: "Exact new name" } });
 f.legacy.setState(saved("Different", "foreign"));
 expect(f.facade.controller.snapshot()).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
 const count = f.legacy.invocations.length; expect(await bound.renameProject("Must refuse")).toEqual({ kind: "not-ready" });
 expect(f.legacy.invocations).toHaveLength(count);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

it("keeps the current view snapshot live after a command and refuses an unexpected first-run source reset", async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 const bound = view(f);
 f.registered.controller.renameProject = async () => { f.registered.setState(saved("Renamed", "same-id")); return { kind: "durable", projectId: "same-id", revisionId: "revision" }; };
 expect((await bound.renameProject("Renamed")).kind).toBe("durable");
 expect(bound.snapshot()).toMatchObject({ kind: "saved", project: { name: "Renamed" } });
 f.registered.setState({ kind: "first-run" });
 expect(bound.snapshot()).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
 const count = f.registered.invocations.length; expect(await bound.renameProject("Must refuse")).toEqual({ kind: "not-ready" });
 expect(f.registered.invocations).toHaveLength(count);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

it("refreshes both qualified directory parts when a selected command intentionally returns to projects", async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 const instance = f.facade.getEditorInstanceSnapshot();
 f.registered.controller.restartProject = async () => { f.registered.setState({ kind: "projects", projects: [] }); return { kind: "not-ready" }; };
 expect(await completedFacadeOperation(view(f).restartProject())).toEqual({ kind: "not-ready" });
 expect(projects(f.facade.controller).projects).toHaveLength(2);
 expect(f.facade.getEditorInstanceSnapshot()).not.toBe(instance);
 expect(f.facade.getEditorInstanceSnapshot().storageNamespace).toBeUndefined();
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});


it("starts with an honest loading state and a nonempty stable opaque view identity before any storage access", async () => {
 const f = fixture(); const instance = f.facade.getEditorInstanceSnapshot();
 expect(f.facade.controller.snapshot()).toEqual({ kind: "loading" });
 expect(typeof instance.key).toBe("string"); expect(instance.key.length).toBeGreaterThan(0);
 expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
 expect(instance.controller?.snapshot()).toEqual({ kind: "loading" });
 expect(f.legacy.calls).toEqual([]); expect(f.registered.calls).toEqual([]); expect(f.reads()).toBe(0);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});


it("revokes the previous editor at the intermediate hub and remounts exactly once before the second source settles", async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 const old = view(f), oldState = old.snapshot(), instance = f.facade.getEditorInstanceSnapshot();
 const gate = latch(); f.wait(gate.waiting); let notifications = 0;
 f.facade.subscribeEditorInstance(() => { notifications++; });
 const opening = f.facade.controller.showProjects(); await flush();
 try {
  const hub = projects(f.facade.controller), next = f.facade.getEditorInstanceSnapshot();
  expect(next).not.toBe(instance); expect(next.key).not.toBe(instance.key); expect(next.storageNamespace).toBeUndefined();
  expect(next.controller?.snapshot()).toBe(hub); expect(notifications).toBe(1);
  const calls = [...f.legacy.calls]; old.startNewProject(); expect(f.legacy.calls).toEqual(calls);
  expect(old.snapshot()).toBe(oldState); expect(f.facade.controller.snapshot()).toBe(hub);
 } finally { gate.release(); await completedFacadeOperation(opening); }
 expect(notifications).toBe(1); expect(view(f).snapshot()).toBe(f.facade.controller.snapshot());
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

for (const held of ["legacy", "registered"] as const) it(`reports exact healthy partial rows while the initial ${held} query is still unsettled`, async () => {
 const f = fixture(), gate = latch();
 if (held === "legacy") f.legacy.controller.open = async () => { await gate.waiting; };
 else f.wait(gate.waiting);
 const opening = f.facade.controller.open(); await flush();
 try {
  const state = projects(f.facade.controller);
  expect(state.projects.map((p) => [p.name, p.storageNamespace])).toEqual(held === "legacy" ? [["Перенесённая копия", "browser-registered"]] : [["Обычная копия", "legacy"]]);
  expect(state.storageSources).toEqual([{ storageNamespace: "legacy", kind: held === "legacy" ? "unavailable" : "available" }, { storageNamespace: "browser-registered", kind: held === "registered" ? "unavailable" : "available" }]);
  expect(state.recoveryNeeded).toBeUndefined();
 } finally { gate.release(); await completedFacadeOperation(opening); }
 expect(projects(f.facade.controller).projects).toHaveLength(2); expect(projects(f.facade.controller).recoveryNeeded).toBeUndefined();
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

it("keeps the legacy readable neighbors and their partial recovery flag when the private directory is healthy and empty", async () => {
 const f = fixture(); f.legacy.setState({ kind: "projects", projects: [summary("Readable legacy neighbor")], recoveryNeeded: true });
 f.read({ kind: "available", directory: { kind: "empty" } });
 await completedFacadeOperation(f.facade.controller.open()); const state = projects(f.facade.controller);
 expect(state.projects).toEqual([{ ...summary("Readable legacy neighbor"), storageNamespace: "legacy" }]);
 expect(state.recoveryNeeded).toBe(true); expect(state.storageSources).toEqual([{ storageNamespace: "legacy", kind: "available" }, { storageNamespace: "browser-registered", kind: "available" }]);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

for (const admission of ["opening", "importing"] as const) it(`refuses both owner importers during ${admission} before either Core busy flag is set`, async () => {
 const f = fixture(), gate = latch(); await completedFacadeOperation(f.facade.controller.open());
 let first: Promise<unknown>;
 if (admission === "opening") { f.registered.holdOpen(gate.waiting); first = f.facade.controller.openProject("same-id", ownerOptions); }
 else { f.registered.holdImport(gate.waiting); first = f.facade.controller.importRegisteredPortableBackup(bytes); }
 await flush(); expect(f.legacy.controller.hasPendingPublication()).toBe(false); expect(f.registered.controller.hasPendingPublication()).toBe(false);
 const before = [f.legacy.invocations.length, f.registered.invocations.length], instance = f.facade.getEditorInstanceSnapshot();
 try {
  expect(await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(bytes))).toEqual({ kind: "in-progress" });
  expect(await completedFacadeOperation(f.facade.controller.importProjectTransfer(bytes))).toEqual({ kind: "in-progress" });
  expect([f.legacy.invocations.length, f.registered.invocations.length]).toEqual(before); expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
 } finally { gate.release(); await completedFacadeOperation(first); }
 expect(f.facade.controller.hasPendingPublication()).toBe(false);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

it("refuses undefined discard approval without consulting or clearing a source", async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 const before = [f.legacy.calls.length, f.registered.calls.length], instance = f.facade.getEditorInstanceSnapshot();
 expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(undefined))).toBe(false);
 expect([f.legacy.calls.length, f.registered.calls.length]).toEqual(before); expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

it("refuses discard while an allowed writer refresh is held before the Core busy flag, then accepts the same exact copy after refresh", async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 const copy = recoveryCandidate(), gate = latch(); f.registered.setCopy(copy);
 f.legacy.controller.refreshWriterLeaseAccess = async () => ({ kind: "not-ready" });
 f.registered.controller.refreshWriterLeaseAccess = async () => { await gate.waiting; return { kind: "not-ready" }; };
 const refreshing = view(f).refreshWriterLeaseAccess(); await flush();
 const before = [...f.registered.calls];
 try { expect(f.registered.controller.hasPendingPublication()).toBe(false); expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(copy))).toBe(false); expect(f.registered.calls).toEqual(before); expect(f.registered.controller.writerRecoveryCopy()).toBe(copy); }
 finally { gate.release(); await completedFacadeOperation(refreshing); }
 expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(copy))).toBe(true); expect(f.registered.controller.writerRecoveryCopy()).toBeUndefined();
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

for (const otherState of ["copy", "failed-screen"] as const) it(`preserves both sources when the other owner retains ${otherState} during an exact active-copy confirmation`, async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 const copy = recoveryCandidate(), other = recoveryCandidate("other-project"); f.registered.setCopy(copy);
 if (otherState === "copy") f.legacy.setCopy(other);
 else f.legacy.setState({ ...saved("Other retained", "other-project"), kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });
 const before = [f.legacy.calls.length, f.registered.calls.length];
 expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(copy))).toBe(false); expect(f.registered.controller.writerRecoveryCopy()).toBe(copy);
 expect(f.legacy.controller.writerRecoveryCopy()).toBe(otherState === "copy" ? other : undefined);
 expect([f.legacy.calls.length, f.registered.calls.length]).toEqual(before);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

it("allows an exact legacy copy confirmation when the private capability is absent", async () => {
 const legacy = core([summary("Only legacy")]);
 const facade = createBrowserProjectControllerFacade({ legacy: legacy.controller, registered: { readDirectory: async () => ({ kind: "unavailable" }), dispose: async () => {} } });
 await completedFacadeOperation(facade.controller.openProject("same-id", { storageNamespace: "legacy" })); const copy = recoveryCandidate(); legacy.setCopy(copy);
 expect(await completedFacadeOperation(facade.discardWriterRecoveryAndShowProjects(copy))).toBe(true); expect(legacy.controller.writerRecoveryCopy()).toBeUndefined();
 expect(projects(facade.controller).projects).toEqual([{ ...summary("Only legacy"), storageNamespace: "legacy" }]);
 expect(projects(facade.controller).storageSources).toEqual([{ storageNamespace: "legacy", kind: "available" }, { storageNamespace: "browser-registered", kind: "unavailable" }]);
 await expect(completedFacadeOperation(facade.dispose())).resolves.toBeUndefined();
});

it("restores a fresh usable selected view when confirmed discard fails before its exact copy is cleared", async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 const old = view(f), oldState = old.snapshot(), instance = f.facade.getEditorInstanceSnapshot(), copy = recoveryCandidate(); f.registered.setCopy(copy);
 f.registered.controller.showProjects = async () => { throw new Error("Read failure before discard"); };
 expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(copy))).toBe(false); const replacement = f.facade.getEditorInstanceSnapshot();
 expect(replacement).not.toBe(instance); expect(replacement.storageNamespace).toBe("browser-registered"); expect(replacement.controller?.snapshot()).toBe(oldState);
 expect(replacement.controller?.writerRecoveryCopy()).toBe(copy); expect(f.registered.controller.writerRecoveryCopy()).toBe(copy);
 const before = [...f.legacy.calls]; old.startNewProject(); expect(f.legacy.calls).toEqual(before); expect(old.snapshot()).toBe(oldState);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

it("refuses direct copy approval when only its Revision belongs to the active Project", async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 const valid = recoveryCandidate(), corrupt = { ...valid, project: { ...valid.project, projectId: "foreign-project" } }; f.registered.setCopy(corrupt);
 const before = [...f.registered.calls]; expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(corrupt))).toBe(false);
 expect(f.registered.calls).toEqual(before); expect(f.registered.controller.writerRecoveryCopy()).toBe(corrupt);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
});

it("does not let an old partial directory generation overwrite a fresh hub after an intervening editor visit", async () => {
 const f = fixture(), gate = latch(); let opens = 0;
 f.legacy.controller.open = async () => { if (++opens === 1) await gate.waiting; };
 const oldDirectory = f.facade.controller.open(); await flush();
 expect(projects(f.facade.controller).projects.map((p) => p.name)).toEqual(["Перенесённая копия"]);
 try {
 await completedFacadeOperation(f.facade.controller.openProject("same-id", ownerOptions));
 f.read({ kind: "available", directory: { kind: "populated", projects: [summary("Fresh private"), { ...summary("Fresh extra"), projectId: "new-project" }] } });
 await completedFacadeOperation(f.facade.controller.showProjects()); const current = f.facade.controller.snapshot(), instance = f.facade.getEditorInstanceSnapshot();
 expect(projects(f.facade.controller).projects.map((p) => p.name)).toEqual(["Обычная копия", "Fresh private", "Fresh extra"]);
 gate.release(); await completedFacadeOperation(oldDirectory);
 expect(f.facade.controller.snapshot()).toBe(current); expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
 await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
 } finally { gate.release(); }
});
