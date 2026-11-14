import { describe, expect, it } from "@rstest/core";
import type { DurablePublicationCandidate } from "../application/ports";
import { createInitialProject } from "../domain/initial-project";
import {
	completedFacadeOperation,
	core,
	fixture,
	projects,
	summary,
} from "./browser-facade-test-support";
import {
		createBrowserProjectControllerFacade,
} from "./browser-project-controller-facade";
import type {
	ProjectScreenState,
} from "./project-controller";

describe("browser controller facade directory", () => {
	it("keeps same-ID cards separate and assigns trusted owners without mutating query rows", async () => {
		const f = fixture();
		const privateRow = {
			...summary("Перенесённая копия"),
			storageNamespace: "legacy" as const,
		};
		f.read({
			kind: "available",
			directory: { kind: "populated", projects: [privateRow] },
		});
		await completedFacadeOperation(f.facade.controller.open());
		const state = projects(f.facade.controller);
		expect(
			state.projects.map((row) => [
				row.projectId,
				row.name,
				row.storageNamespace,
			]),
		).toEqual([
			["same-id", "Обычная копия", "legacy"],
			["same-id", "Перенесённая копия", "browser-registered"],
		]);
		expect(privateRow.storageNamespace).toBe("legacy");
		expect(state.storageSources).toEqual([
			{ storageNamespace: "legacy", kind: "available" },
			{ storageNamespace: "browser-registered", kind: "available" },
		]);
		expect(f.registered.calls).toEqual([]);
	});
	it("reports current absence with unknown history and does not invoke the private core", async () => {
		const f = fixture();
		f.read({ kind: "not-provisioned", history: "unknown" });
		await completedFacadeOperation(f.facade.controller.open());
		expect(projects(f.facade.controller).storageSources).toContainEqual({
			storageNamespace: "browser-registered",
			kind: "not-provisioned",
			history: "unknown",
		});
		expect(projects(f.facade.controller).projects).toHaveLength(1);
		expect(f.registered.calls).toEqual([]);
	});
	it("keeps healthy legacy cards when the other source is unavailable", async () => {
		const f = fixture();
		f.read({ kind: "unavailable" });
		await completedFacadeOperation(f.facade.controller.open());
		expect(
			projects(f.facade.controller).projects.map((row) => row.name),
		).toEqual(["Обычная копия"]);
		expect(projects(f.facade.controller).storageSources).toContainEqual({
			storageNamespace: "browser-registered",
			kind: "unavailable",
		});
	});
	it("keeps healthy registered cards when legacy opening fails", async () => {
		const f = fixture();
		f.legacy.fail();
		await completedFacadeOperation(f.facade.controller.open());
		expect(
			projects(f.facade.controller).projects.map((row) => row.name),
		).toEqual(["Перенесённая копия"]);
		expect(projects(f.facade.controller).storageSources).toContainEqual({
			storageNamespace: "legacy",
			kind: "unavailable",
		});
	});
	it("retains readable neighbors and exposes partial recovery", async () => {
		const f = fixture();
		f.read({
			kind: "available",
			directory: {
				kind: "populated",
				projects: [summary("Здоровый сосед")],
				recoveryNeeded: true,
			},
		});
		await completedFacadeOperation(f.facade.controller.open());
		expect(projects(f.facade.controller).recoveryNeeded).toBe(true);
		expect(projects(f.facade.controller).projects).toHaveLength(2);
		f.read({ kind: "recovery-required" });
		await completedFacadeOperation(f.facade.controller.showProjects());
		expect(projects(f.facade.controller).storageSources).toContainEqual({
			storageNamespace: "browser-registered",
			kind: "recovery-required",
		});
	});
	it("deduplicates a pending initial open and keeps its instance snapshot stable", async () => {
		const f = fixture();
		let release: () => void = () => undefined;
		f.wait(
			new Promise<void>((resolve) => {
				release = resolve;
			}),
		);
		const instance = f.facade.getEditorInstanceSnapshot();
		const a = f.facade.controller.open(),
			b = f.facade.controller.open();
		expect(a).toBe(b);
		release();
		await completedFacadeOperation(a);
		expect(f.reads()).toBe(1);
		expect(f.legacy.calls).toEqual(["open"]);
		expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
	});
	it("does not reset either core or read a directory while publication is pending in either source", async () => {
		for (const namespace of ["legacy", "registered"] as const) {
			const f = fixture();
			await completedFacadeOperation(f.facade.controller.open());
			f[namespace].setBusy(true);
			const before = f.facade.controller.snapshot();
			await completedFacadeOperation(f.facade.controller.showProjects());
			expect(f.facade.controller.snapshot()).toBe(before);
			expect(f.reads()).toBe(1);
			expect(f.legacy.calls).toEqual(["open"]);
		}
	});
});

describe("browser controller facade qualified navigation", () => {
	it("opens only the explicitly selected owner even when raw IDs collide", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		expect(f.registered.invocations).toEqual([
			{ method: "openProject", args: ["same-id"] },
		]);
		expect(f.legacy.invocations).toEqual([]);
		const state = f.facade.controller.snapshot();
		expect(state.kind).toBe("saved");
		if (state.kind !== "saved") throw new Error("Missing selected Project");
		expect(state.project.name).toBe("Перенесённая копия");
	});
	it("does not infer a missing or unknown owner from a name, raw ID or current selection", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		const before = f.facade.controller.snapshot();
		await completedFacadeOperation(f.facade.controller.openProject("same-id"));
		await completedFacadeOperation(f.facade.controller.openProject("browser-registered-v1:project:1", {
			storageNamespace: "unknown" as "legacy",
		}));
		expect(f.facade.controller.snapshot()).toBe(before);
		expect(f.legacy.invocations).toEqual([]);
		expect(f.registered.invocations).toEqual([]);
	});
	it("binds rename intent to a new stable opaque instance key and keeps the selected core on remount open", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		const before = f.facade.getEditorInstanceSnapshot();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
			initialAction: "rename",
		}));
		const after = f.facade.getEditorInstanceSnapshot();
		expect(after.key).not.toBe(before.key);
		expect(after.requestedRenameProjectId).toBe("same-id");
		expect(f.facade.getEditorInstanceSnapshot()).toBe(after);
		const selected = f.facade.controller.snapshot();
		await completedFacadeOperation(f.facade.controller.open());
		expect(f.facade.controller.snapshot()).toBe(selected);
		expect(f.legacy.calls).toEqual(["open"]);
	});
	it("gets a fresh instance for repeated same-owner same-ID rename selections", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
			initialAction: "rename",
		}));
		const first = f.facade.getEditorInstanceSnapshot();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
			initialAction: "rename",
		}));
		expect(f.facade.getEditorInstanceSnapshot().key).not.toBe(first.key);
	});
	it("notifies instance subscribers once for a selected editor instance and honors unsubscription", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		const instances: string[] = [];
		const stop = f.facade.subscribeEditorInstance(() => {
			instances.push(f.facade.getEditorInstanceSnapshot().key);
		});
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		expect(instances).toHaveLength(1);
		stop();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		expect(instances).toHaveLength(1);
	});
	it("does not start another owner selection while the current native open is pending", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		let release: () => void = () => undefined;
		f.registered.holdOpen(
			new Promise<void>((resolve) => {
				release = resolve;
			}),
		);
		const opening = f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		});
		expect(f.facade.controller.hasPendingPublication()).toBe(true);
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		expect(f.legacy.invocations).toEqual([]);
		release();
		await completedFacadeOperation(opening);
		expect(f.facade.controller.hasPendingPublication()).toBe(false);
	});
	it("routes current commands and synchronous queries to the selected core and refuses an explicit foreign rename owner", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		await completedFacadeOperation(f.facade.controller.renameProject("New name"));
		await completedFacadeOperation(f.facade.controller.undo());
		expect(f.facade.controller.sessionHistory()).toEqual({
			canUndo: true,
			canRedo: false,
		});
		await completedFacadeOperation(f.facade.controller.renameProject("Foreign", {
			storageNamespace: "legacy",
		}));
		expect(f.registered.invocations).toEqual([
			{ method: "openProject", args: ["same-id"] },
			{ method: "renameProject", args: ["New name"] },
			{ method: "undo", args: [] },
		]);
		expect(f.legacy.invocations).toEqual([]);
	});
});

describe("browser controller facade directory actions", () => {
	it("binds both export formats and confirmed deletion to the exact directory owner", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		const cancellation = new AbortController();
		expect(
			(
				await completedFacadeOperation(f.facade.controller.exportProjectTransfer("same-id", {
					storageNamespace: "browser-registered",
					signal: cancellation.signal,
				}))
			).kind,
		).toBe("ready");
		expect(
			(
				await completedFacadeOperation(f.facade.controller.exportRegisteredProjectTransfer("same-id", {
					storageNamespace: "browser-registered",
				}))
			).kind,
		).toBe("ready");
		expect(
			(
				await completedFacadeOperation(f.facade.controller.permanentlyDeleteProjectFromDirectory(
					"same-id",
					{ storageNamespace: "browser-registered" },
				))
			).kind,
		).toBe("permanently-deleted");
		expect(f.legacy.invocations).toEqual([]);
		expect(f.registered.invocations).toEqual([
			{
				method: "exportProjectTransfer",
				args: ["same-id", { signal: cancellation.signal }],
			},
			{
				method: "exportRegisteredProjectTransfer",
				args: ["same-id", { signal: undefined }],
			},
			{ method: "permanentlyDeleteProjectFromDirectory", args: ["same-id"] },
		]);
	});
	it("refuses unqualified directory actions and does not infer them from the selected raw ID", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		expect(
			(await completedFacadeOperation(f.facade.controller.exportProjectTransfer("same-id"))).kind,
		).toBe("not-ready");
		expect(
			(await completedFacadeOperation(f.facade.controller.exportRegisteredProjectTransfer("same-id")))
				.kind,
		).toBe("not-ready");
		expect(
			(
				await completedFacadeOperation(f.facade.controller.permanentlyDeleteProjectFromDirectory(
					"same-id",
				))
			).kind,
		).toBe("not-ready");
		expect(f.legacy.invocations).toEqual([]);
		expect(f.registered.invocations).toEqual([]);
	});
	it("discards a prepared export when the user has since selected a different instance", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		let release: () => void = () => undefined;
		f.registered.holdExport(
			new Promise<void>((resolve) => {
				release = resolve;
			}),
		);
		const exporting = f.facade.controller.exportRegisteredProjectTransfer(
			"same-id",
			{ storageNamespace: "browser-registered" },
		);
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		const selected = f.facade.controller.snapshot();
		release();
		expect((await completedFacadeOperation(exporting)).kind).toBe("not-ready");
		expect(f.facade.controller.snapshot()).toBe(selected);
		expect(f.legacy.invocations.map((call) => call.method)).toEqual([
			"openProject",
		]);
	});
	it("uses the current owner for an editor export without a directory ID and refuses a stale directory delete in the editor", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		expect((await completedFacadeOperation(f.facade.controller.exportProjectTransfer())).kind).toBe(
			"ready",
		);
		expect(
			(
				await completedFacadeOperation(f.facade.controller.permanentlyDeleteProjectFromDirectory(
					"same-id",
					{ storageNamespace: "legacy" },
				))
			).kind,
		).toBe("not-ready");
		expect(f.registered.invocations.map((call) => call.method)).toEqual([
			"openProject",
			"exportProjectTransfer",
		]);
		expect(f.legacy.invocations).toEqual([]);
	});
});

function importedState(
	name: string,
): Extract<ProjectScreenState, { kind: "saved" }> {
	const project = createInitialProject({
		name,
		projectId: "imported",
		levelId: "imported-level",
		createdAt: "2026-11-04T00:00:00.000Z",
	});
	return {
		kind: "saved",
		project,
		projectName: name,
		revisionId: "imported-r1",
	};
}

describe("browser controller facade sealed creation selection", () => {
	it("starts an ordinary new Project only in legacy and keeps preselection read queries well-formed", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		expect(await completedFacadeOperation(f.facade.controller.storagePressure())).toEqual({
			kind: "unavailable",
		});
		expect(await completedFacadeOperation(f.facade.controller.listCustomGlbLibraryAssets())).toEqual([]);
		f.facade.controller.startNewProject();
		expect(f.facade.controller.snapshot().kind).toBe("first-run");
		await completedFacadeOperation(f.facade.controller.create("Ordinary new"));
		expect(f.legacy.invocations.map((call) => call.method)).toEqual(["create"]);
		expect(f.registered.invocations).toEqual([]);
	});
	it("does not expose generic creation in a selected registered Project", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		const before = f.facade.controller.snapshot();
		expect((await completedFacadeOperation(f.facade.controller.create("Wrong route"))).kind).toBe(
			"not-ready",
		);
		expect(f.facade.controller.snapshot()).toBe(before);
		expect(f.registered.invocations.map((call) => call.method)).toEqual([
			"openProject",
		]);
	});
	it("retains the old selected instance after rejected or cancelled explicit registered import", async () => {
		for (const reasonCode of [
			"PORTABLE_BACKUP_INVALID",
			"PORTABLE_BACKUP_CANCELLED",
		] as const) {
			const f = fixture();
			await completedFacadeOperation(f.facade.controller.open());
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: "legacy",
			}));
			const before = f.facade.controller.snapshot(),
				instance = f.facade.getEditorInstanceSnapshot();
			f.registered.importOutcome({ kind: "rejected", reasonCode });
			expect(
				(
					await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(
						Uint8Array.of(1),
					))
				).kind,
			).toBe("rejected");
			expect(f.facade.controller.snapshot()).toBe(before);
			expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
			expect(f.registered.invocations.map((call) => call.method)).toEqual([
				"importRegisteredPortableBackup",
			]);
		}
	});
	it("guards Back, new selection and commands through pre-ID asynchronous validation even before the private core reports pending", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		const before = f.facade.controller.snapshot();
		let release: () => void = () => undefined;
		f.registered.holdImport(
			new Promise<void>((resolve) => {
				release = resolve;
			}),
		);
		const importing = f.facade.controller.importRegisteredPortableBackup(
			Uint8Array.of(1),
		);
		expect(f.facade.controller.hasPendingPublication()).toBe(true);
		expect(f.registered.controller.hasPendingPublication()).toBe(false);
		await completedFacadeOperation(f.facade.controller.showProjects());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		await completedFacadeOperation(f.facade.controller.renameProject("Blocked old edit"));
		expect(f.facade.controller.snapshot()).toBe(before);
		expect(f.legacy.invocations.map((call) => call.method)).toEqual([
			"openProject",
		]);
		release();
		await completedFacadeOperation(importing);
		expect(f.facade.controller.hasPendingPublication()).toBe(false);
	});
	it("adopts the exact registered current candidate only after a durable result and protects observer exceptions", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		const next = importedState("Registered import");
		f.registered.importOutcome(
			{ kind: "durable", projectId: "imported", revisionId: "imported-r1" },
			next,
		);
		const before = f.facade.getEditorInstanceSnapshot();
		const observed: string[] = [];
		const result = await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(
			Uint8Array.of(1),
			{
				onStatus(status) {
					observed.push(status.kind);
					throw new Error("Observer cannot alter import");
				},
			},
		));
		expect(result.kind).toBe("durable");
		expect(observed).toEqual(["validating", "saved"]);
		expect(f.facade.controller.snapshot()).toBe(next);
		expect(f.facade.getEditorInstanceSnapshot().key).not.toBe(before.key);
		await completedFacadeOperation(f.facade.controller.renameProject("Registered edit"));
		expect(f.legacy.invocations).toEqual([]);
		expect(f.registered.invocations.at(-1)?.method).toBe("renameProject");
	});
	it("adopts a real retained registered failure and keeps it selected on a rejected reselection", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		const saved = importedState("Unpublished registered candidate");
		const next: ProjectScreenState = {
			kind: "persist-failed",
			project: saved.project,
			revisionId: saved.revisionId,
			reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
		};
		f.registered.importOutcome(
			{ kind: "persist-failed", reasonCode: "PERSISTENCE_QUOTA_EXCEEDED" },
			next,
		);
		expect(
			(
				await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(
					Uint8Array.of(1),
				))
			).kind,
		).toBe("persist-failed");
		expect(f.facade.controller.snapshot()).toBe(next);
		const instance = f.facade.getEditorInstanceSnapshot();
		f.registered.importOutcome({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
		await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(Uint8Array.of(2)));
		expect(f.facade.controller.snapshot()).toBe(next);
		expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
	});
	it("keeps all ordinary transfer/recovery imports on legacy even when a registered Project is selected", async () => {
		for (const method of [
			"importProjectTransfer",
			"importPortableBackup",
			"importRecoveryDraft",
		] as const) {
			const f = fixture();
			await completedFacadeOperation(f.facade.controller.open());
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: "browser-registered",
			}));
			const next = importedState("Ordinary imported copy");
			f.legacy.importOutcome(
				{ kind: "durable", projectId: "imported", revisionId: "imported-r1" },
				next,
			);
			await f.facade.controller[method](Uint8Array.of(1));
			expect(f.facade.controller.snapshot()).toBe(next);
			expect(f.legacy.invocations.map((call) => call.method)).toEqual([method]);
			expect(f.registered.invocations.map((call) => call.method)).toEqual([
				"openProject",
			]);
		}
	});
});

it("opens healthy legacy cards while the private directory is still busy, then ignores its late result", async () => {
	const f = fixture();
	let release: () => void = () => undefined;
	f.wait(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	const opening = f.facade.controller.open();
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	expect(projects(f.facade.controller).projects.map((row) => row.name)).toEqual(
		["Обычная копия"],
	);
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	const selected = f.facade.controller.snapshot();
	expect(selected.kind).toBe("saved");
	expect(f.facade.controller.hasPendingPublication()).toBe(false);
	release();
	await completedFacadeOperation(opening);
	expect(f.facade.controller.snapshot()).toBe(selected);
	await completedFacadeOperation(f.facade.controller.open());
	expect(f.facade.controller.snapshot()).toBe(selected);
});

it("coalesces an outstanding private read across directory visits without blocking healthy-source commands", async () => {
	const f = fixture();
	let release: () => void = () => undefined;
	f.wait(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	const opening = f.facade.controller.open();
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	try {
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	await completedFacadeOperation(f.facade.controller.renameProject("Allowed healthy edit"));
	expect(f.legacy.invocations.at(-1)?.method).toBe("renameProject");
	const returning = f.facade.controller.showProjects();
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	expect(projects(f.facade.controller).projects).toHaveLength(1);
	expect(f.reads()).toBe(1);
	release();
	await completedFacadeOperation(Promise.all([opening, returning]));
	expect(projects(f.facade.controller).projects).toHaveLength(2);
	} finally { release(); }
});

it("revokes the old view's command capability before a same-ID owner switch", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	const oldView =
		f.facade.getEditorInstanceSnapshot().controller ?? f.facade.controller;
	let release: () => void = () => undefined;
	const delayed = (async () => {
		await new Promise<void>((resolve) => {
			release = resolve;
		});
		return oldView.renameProject("Late old-view name");
	})();
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	release();
	await delayed;
	expect(f.registered.invocations.map((call) => call.method)).toEqual([
		"openProject",
	]);
	expect(f.legacy.invocations.map((call) => call.method)).toEqual([
		"openProject",
	]);
	expect(f.facade.getEditorInstanceSnapshot().storageNamespace).toBe(
		"browser-registered",
	);
});

it("keeps a revoked view snapshot and subscription from observing a later owner", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	const oldView =
		f.facade.getEditorInstanceSnapshot().controller ?? f.facade.controller;
	const before = oldView.snapshot();
	const observed: ProjectScreenState[] = [];
	const stop = oldView.subscribe((value) => {
		observed.push(value);
	});
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	expect(oldView.snapshot()).toBe(before);
	expect(observed).toEqual([]);
	stop();
});

function recoveryCopy(name: string): DurablePublicationCandidate {
	const source = importedState(name);
	const saved = {
		...source,
		project: { ...source.project, projectId: "same-id" },
	};
	if (saved.project.schemaVersion !== 1)
		throw new Error("Expected V1 test source");
	return {
		project: saved.project,
		revision: {
			projectId: saved.project.projectId,
			revisionId: saved.revisionId,
			schemaVersion: 1,
			checksum: "a".repeat(64),
			serializedProject: JSON.stringify(saved.project),
			createdAt: saved.project.createdAt,
		},
	};
}

it("requires exact explicit confirmation before dropping a fence-loss copy", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	const copy = recoveryCopy("Retained unpublished copy");
	f.registered.setCopy(copy);
	const before = f.facade.controller.snapshot();
	await completedFacadeOperation(f.facade.controller.showProjects());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	expect(f.facade.controller.snapshot()).toBe(before);
	expect(
		await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(structuredClone(copy))),
	).toBe(false);
	expect(f.registered.controller.writerRecoveryCopy()).toBe(copy);
	expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(copy))).toBe(true);
	expect(f.registered.controller.writerRecoveryCopy()).toBeUndefined();
	expect(projects(f.facade.controller).projects).toHaveLength(2);
});

it("does not discard a replacement recovery copy that arrives while the confirmed exit drains", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	const copy = recoveryCopy("First"),
		replacement = recoveryCopy("Replacement");
	f.registered.setCopy(copy);
	let release: () => void = () => undefined;
	f.registered.holdShow(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	const exiting = f.facade.discardWriterRecoveryAndShowProjects(copy);
	f.registered.setCopy(replacement);
	release();
	expect(await completedFacadeOperation(exiting)).toBe(false);
	expect(f.registered.controller.writerRecoveryCopy()).toBe(replacement);
});

it("revokes immediately and drains an in-flight export before completing stable disposal", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	let release: () => void = () => undefined;
	f.registered.holdExport(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	const exporting = f.facade.controller.exportProjectTransfer("same-id", {
		storageNamespace: "browser-registered",
	});
	const closing = f.facade.dispose();
	expect(f.facade.dispose()).toBe(closing);
	expect(f.disposals()).toBe(1);
	let completed = false;
	const closingOutcome = closing.then(
		() => { completed = true; return { kind: "resolved" as const }; },
		(reason: unknown) => ({ kind: "rejected" as const, reason }),
	);
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	expect(completed).toBe(false);
	try {
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	expect(f.legacy.invocations).toEqual([]);
	release();
	expect((await completedFacadeOperation(exporting)).kind).toBe("not-ready");
	expect(await completedFacadeOperation(closingOutcome)).toEqual({ kind: "resolved" });
	expect(completed).toBe(true);
	} finally { release(); }
});

it("disposal aborts and drains an outstanding coalesced directory read without late publication", async () => {
	const f = fixture();
	let release: () => void = () => undefined;
	f.wait(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	f.onDispose(() => {
		release();
	});
	const opening = f.facade.controller.open();
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	const before = f.facade.controller.snapshot();
	const values: ProjectScreenState[] = [];
	f.facade.controller.subscribe((value) => {
		values.push(value);
	});
	try {
	await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
	await completedFacadeOperation(opening);
	expect(f.facade.controller.snapshot()).toBe(before);
	expect(values).toEqual([]);
	expect(f.disposals()).toBe(1);
	} finally { release(); }
});

it("a reentrant disposal observer stops later listeners and the not-yet-started Project open", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	let later = 0;
	f.facade.controller.subscribe(() => {
		void f.facade.dispose();
	});
	f.facade.controller.subscribe(() => {
		later++;
	});
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
	expect(later).toBe(0);
	expect(f.registered.invocations).toEqual([]);
});

it("does not let an unexpected different Project in the same core retarget the selected view", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	const view =
		f.facade.getEditorInstanceSnapshot().controller ?? f.facade.controller;
	f.legacy.setState(importedState("Unexpected different Project"));
	await view.renameProject("Must not rename the other Project");
	expect(f.legacy.invocations.map((call) => call.method)).toEqual([
		"openProject",
	]);
	expect(f.facade.controller.snapshot().kind).toBe("recovery-needed");
	expect((await completedFacadeOperation(f.facade.controller.exportProjectTransfer())).kind).toBe(
		"not-ready",
	);
});

it("returns a boolean refusal for a confirmed exit after disposal", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
	expect(
		await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(
			recoveryCopy("Old copy"),
		)),
	).toBe(false);
});

it("preserves restart as a same-Project command in the selected registered core", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	await completedFacadeOperation(f.facade.controller.restartProject());
	expect(f.registered.invocations.map((call) => call.method)).toEqual([
		"openProject",
		"restartProject",
	]);
	expect(f.legacy.invocations).toEqual([]);
});

it("does not confirm a recovery copy that belongs to a different Project in the same namespace", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	const foreign = recoveryCopy("Foreign copy");
	Reflect.set(foreign.project, "projectId", "different-project");
	Reflect.set(foreign.revision, "projectId", "different-project");
	f.registered.setCopy(foreign);
	expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(foreign))).toBe(
		false,
	);
	expect(f.registered.controller.writerRecoveryCopy()).toBe(foreign);
});

it("retains a pending history target even when the Core deliberately displays its Saved source", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	const source = f.facade.controller.snapshot(),
		instance = f.facade.getEditorInstanceSnapshot();
	f.registered.setPending({
		projectId: "same-id",
		revisionId: "retained-history-target",
		checksum: "b".repeat(64),
	});
	expect(f.registered.controller.hasPendingPublication()).toBe(false);
	expect(f.registered.controller.snapshot().kind).toBe("saved");
	await completedFacadeOperation(f.facade.controller.showProjects());
	expect(f.facade.controller.snapshot()).toBe(source);
	expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
	expect(f.registered.calls).not.toContain("showProjects");
	f.facade.controller.startNewProject();
	expect(f.legacy.calls).not.toContain("startNewProject");
	expect(
		(await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(Uint8Array.of(1))))
			.kind,
	).toBe("not-ready");
	expect(
		f.registered.invocations.filter(
			(call) => call.method === "importRegisteredPortableBackup",
		),
	).toHaveLength(0);
	expect(
		(await completedFacadeOperation(f.facade.controller.renameProject("Do not replace history"))).kind,
	).toBe("not-ready");
	expect(f.registered.controller.pendingPublicationIdentity()).toEqual({
		projectId: "same-id",
		revisionId: "retained-history-target",
		checksum: "b".repeat(64),
	});
});

it("does not discard a confirmed writer copy while either owner retains a pending history target behind its Saved screen", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	const copy = recoveryCopy("Keep this copy");
	f.registered.setCopy(copy);
	f.legacy.setPending({
		projectId: "legacy-history",
		revisionId: "legacy-target",
		checksum: "c".repeat(64),
	});
	expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(copy))).toBe(false);
	expect(f.registered.controller.writerRecoveryCopy()).toBe(copy);
	expect(f.registered.calls).not.toContain("showProjects");
});

for (const transition of [
	"directory",
	"start-new",
	"import",
	"discard",
	"dispose",
] as const) {
	it(`never revives an old owner capability through the ${transition} ABA sequence`, async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		const old = f.facade.getEditorInstanceSnapshot().controller;
		if (!old) throw new Error("Missing view");
		const before = old.snapshot();
		if (transition === "directory") {
			await completedFacadeOperation(f.facade.controller.showProjects());
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: "legacy",
			}));
		}
		if (transition === "start-new") {
			f.facade.controller.startNewProject();
			await completedFacadeOperation(f.facade.controller.showProjects());
		}
		if (transition === "import") {
			const next = importedState("New imported C");
			f.registered.importOutcome(
				{
					kind: "durable",
					projectId: next.project.projectId,
					revisionId: next.revisionId,
				},
				next,
			);
			await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(
				Uint8Array.of(1),
			));
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: "legacy",
			}));
		}
		if (transition === "discard") {
			const copy = recoveryCopy("Retained copy A");
			f.registered.setCopy(copy);
			expect(await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(copy))).toBe(
				true,
			);
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: "legacy",
			}));
		}
		if (transition === "dispose") {
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: "legacy",
			}));
			await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
		}
		expect(old.snapshot()).toBe(before);
		expect(old.hasPendingPublication()).toBe(true);
		const counts = [
			f.legacy.invocations.length,
			f.registered.invocations.length,
		];
		expect(await old.renameProject("Late old A must not mutate B")).toEqual({
			kind: "not-ready",
		});
		expect(
			(await old.importRegisteredPortableBackup(Uint8Array.of(2))).kind,
		).toBe("not-ready");
		expect([
			f.legacy.invocations.length,
			f.registered.invocations.length,
		]).toEqual(counts);
	});
}

for (const completion of ["resolve", "reject"] as const) {
	it(`blocks owner-changing admissions while an outer command is waiting before Core activity, then balances its ${completion}`, async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		let finish: () => void = () => undefined;
		f.registered.holdCommand(
			new Promise<void>((resolve, reject) => {
				finish =
					completion === "resolve"
						? resolve
						: () => reject(new Error("Controlled outer-slot failure"));
			}),
		);
		const view = f.facade.getEditorInstanceSnapshot(),
			before = f.facade.controller.snapshot();
		const command = view.controller?.renameProject("Held admission");
		expect(f.registered.controller.hasPendingPublication()).toBe(false);
		expect(f.registered.controller.snapshot().kind).toBe("saved");
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		await completedFacadeOperation(f.facade.controller.showProjects());
		f.facade.controller.startNewProject();
		expect(
			(
				await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(
					Uint8Array.of(1),
				))
			).kind,
		).toBe("in-progress");
		expect(f.facade.controller.snapshot()).toBe(before);
		expect(f.facade.getEditorInstanceSnapshot()).toBe(view);
		expect(f.legacy.invocations).toEqual([]);
		expect(f.legacy.calls).not.toContain("showProjects");
		expect(f.legacy.calls).not.toContain("startNewProject");
		expect(f.registered.invocations.map((call) => call.method)).toEqual([
			"openProject",
			"renameProject",
		]);
		finish();
		await completedFacadeOperation(Promise.resolve(command));
		await completedFacadeOperation(f.facade.controller.showProjects());
		expect(f.facade.controller.snapshot().kind).toBe("projects");
	});
}

const deferredReads = [
	{
		method: "storagePressure",
		args: [],
		stale: { kind: "unavailable" },
		value: { kind: "available", usageBytes: 1 },
	},
	{
		method: "requestPersistentStorage",
		args: [],
		stale: { kind: "unavailable" },
		value: { kind: "granted" },
	},
	{
		method: "readCustomGlbResource",
		args: ["a".repeat(64)],
		stale: undefined,
		value: Uint8Array.of(77),
	},
	{
		method: "listCustomGlbLibraryAssets",
		args: [],
		stale: [],
		value: [{ assetId: "source-A-private-asset" }],
	},
	{
		method: "listRemovedCustomGlbLibraryResourceHashes",
		args: [],
		stale: [],
		value: ["a".repeat(64)],
	},
	...["exportRecoveryDraft", "exportProjectJson", "exportPortableBackup"].map(
		(method) => ({
			method,
			args: [],
			stale: { kind: "not-ready" },
			value: {
				kind: "ready",
				bytes: Uint8Array.of(99),
				filename: "source-A.interiors",
				mimeType: "application/zip",
			},
		}),
	),
];
for (const read of deferredReads) {
	it(`drops a late ${read.method} from old A and never lets readonly completion cancel B's command guard`, async () => {
		const f = fixture();
		let releaseRead: () => void = () => undefined;
		const wait = new Promise<void>((resolve) => {
			releaseRead = resolve;
		});
		const received: unknown[][] = [];
		Reflect.set(f.legacy.controller, read.method, async () => {
			throw new Error("Wrong-owner read");
		});
		Reflect.set(
			f.registered.controller,
			read.method,
			async (...args: unknown[]) => {
				received.push(args);
				await wait;
				return read.value;
			},
		);
		await completedFacadeOperation(f.facade.controller.open());
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		const old = f.facade.getEditorInstanceSnapshot().controller;
		if (!old) throw new Error("Missing view");
		const operation = Reflect.apply(
			Reflect.get(old, read.method),
			old,
			read.args,
		) as Promise<unknown>;
		expect(received).toEqual([read.args]);
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		let releaseCommand: () => void = () => undefined;
		f.legacy.holdCommand(
			new Promise<void>((resolve) => {
				releaseCommand = resolve;
			}),
		);
		const command = f.facade.controller.renameProject("B held before entry");
		const selected = f.facade.getEditorInstanceSnapshot();
		releaseRead();
		expect(await operation).toEqual(read.stale);
		await completedFacadeOperation(f.facade.controller.showProjects());
		expect(f.facade.getEditorInstanceSnapshot()).toBe(selected);
		expect(f.facade.controller.snapshot().kind).toBe("saved");
		expect(f.legacy.calls).not.toContain("showProjects");
		releaseCommand();
		await completedFacadeOperation(command);
		await completedFacadeOperation(f.facade.controller.showProjects());
		expect(f.facade.controller.snapshot().kind).toBe("projects");
	});
}

it("drains both owned Core subscriptions even when the first stop throws", async () => {
	const legacy = core([]),
		registered = core([]),
		stopped: string[] = [];
	Reflect.set(legacy.controller, "subscribe", () => () => {
		stopped.push("legacy");
		throw new Error("Controlled subscription cleanup failure");
	});
	Reflect.set(registered.controller, "subscribe", () => () => {
		stopped.push("registered");
	});
	let native = 0;
	const facade = createBrowserProjectControllerFacade({
		legacy: legacy.controller,
		registered: {
			controller: registered.controller,
			readDirectory: async () => ({
				kind: "not-provisioned",
				history: "unknown",
			}),
			dispose: async () => {
				native++;
			},
		},
	});
	await expect(completedFacadeOperation(facade.dispose())).resolves.toBeUndefined();
	expect(stopped).toEqual(["legacy", "registered"]);
	expect(native).toBe(1);
	await expect(completedFacadeOperation(facade.dispose())).resolves.toBeUndefined();
	expect(stopped).toHaveLength(2);
	expect(native).toBe(1);
});

for (const mode of ["reject", "throw", "undefined-rejection"] as const) {
	it(`revokes immediately and drains existing work before propagating the exact native ${mode}`, async () => {
		const legacy = core([summary("Legacy")]),
			registered = core([summary("Registered")]);
		const reason =
			mode === "undefined-rejection"
				? undefined
				: new Error(`Controlled ${mode}`);
		let native = 0;
		const facade = createBrowserProjectControllerFacade({
			legacy: legacy.controller,
			registered: {
				controller: registered.controller,
				readDirectory: async () => ({
					kind: "available",
					directory: { kind: "populated", projects: [summary("Registered")] },
				}),
				dispose: () => {
					native++;
					if (mode === "throw") throw reason;
					return Promise.reject(reason);
				},
			},
		});
		await completedFacadeOperation(facade.controller.open());
		await completedFacadeOperation(facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		let release: () => void = () => undefined;
		registered.holdExport(
			new Promise<void>((resolve) => {
				release = resolve;
			}),
		);
		const export_ = facade.controller.exportRegisteredProjectTransfer();
		const closing = facade.dispose();
		expect(facade.dispose()).toBe(closing);
		let complete = false;
		const outcome = closing
			.then(
				() => ({ kind: "resolved" as const }),
				(error) => ({ kind: "rejected" as const, error }),
			)
			.then((value) => {
				complete = true;
				return value;
			});
		await Promise.resolve();
		expect(complete).toBe(false);
		expect(native).toBe(1);
		expect((await completedFacadeOperation(facade.controller.renameProject("After close"))).kind).toBe(
			"not-ready",
		);
		release();
		expect((await completedFacadeOperation(export_)).kind).toBe("not-ready");
		expect(await outcome).toEqual({ kind: "rejected", error: reason });
	});
}

it("suppresses observer callbacks and adoption after disposal during an already-started import", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	const before = f.facade.controller.snapshot();
	let release: () => void = () => undefined;
	f.registered.holdImport(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	const next = importedState("Must not be adopted after close");
	f.registered.importOutcome(
		{
			kind: "durable",
			projectId: next.project.projectId,
			revisionId: next.revisionId,
		},
		next,
	);
	const observed: string[] = [];
	const importing = f.facade.controller.importRegisteredPortableBackup(
		Uint8Array.of(1),
		{
			onStatus: (status) => {
				observed.push(status.kind);
			},
		},
	);
	expect(observed).toEqual(["validating"]);
	f.onDispose(release);
	try {
	await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
	expect((await completedFacadeOperation(importing)).kind).toBe("not-ready");
	expect(observed).toEqual(["validating"]);
	expect(f.facade.controller.snapshot()).toBe(before);
	} finally { release(); }
});

it("treats legacy first-run as available empty while keeping the private source's healthy cards", async () => {
	const f = fixture();
	f.legacy.setState({ kind: "first-run" });
	await completedFacadeOperation(f.facade.controller.open());
	expect(
		projects(f.facade.controller).projects.map((p) => p.storageNamespace),
	).toEqual(["browser-registered"]);
	expect(projects(f.facade.controller).storageSources).toContainEqual({
		storageNamespace: "legacy",
		kind: "available",
	});
});
it("keeps healthy private cards and reports legacy recovery instead of falsely declaring a complete empty directory", async () => {
	const f = fixture();
	f.legacy.setState({
		kind: "recovery-needed",
		reasonCode: "PERSISTENCE_CORRUPT",
	});
	await completedFacadeOperation(f.facade.controller.open());
	expect(
		projects(f.facade.controller).projects.map((p) => p.storageNamespace),
	).toEqual(["browser-registered"]);
	expect(projects(f.facade.controller).recoveryNeeded).toBe(true);
	expect(projects(f.facade.controller).storageSources).toContainEqual({
		storageNamespace: "legacy",
		kind: "recovery-required",
	});
});
it("maps a thrown private directory read to unavailable without losing healthy legacy cards", async () => {
	const f = fixture();
	f.wait(Promise.reject(new Error("Controlled unavailable private read")));
	await completedFacadeOperation(f.facade.controller.open());
	expect(
		projects(f.facade.controller).projects.map((p) => p.storageNamespace),
	).toEqual(["legacy"]);
	expect(projects(f.facade.controller).storageSources).toContainEqual({
		storageNamespace: "browser-registered",
		kind: "unavailable",
	});
});
it("distinguishes a private recovery directory from a healthy empty source", async () => {
	const f = fixture();
	f.read({
		kind: "available",
		directory: { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" },
	});
	await completedFacadeOperation(f.facade.controller.open());
	expect(
		projects(f.facade.controller).projects.map((p) => p.storageNamespace),
	).toEqual(["legacy"]);
	expect(projects(f.facade.controller).recoveryNeeded).toBe(true);
	expect(projects(f.facade.controller).storageSources).toContainEqual({
		storageNamespace: "browser-registered",
		kind: "recovery-required",
	});
});
it("reports only the selected private source unavailable if its Core cannot return to the directory", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	f.registered.fail();
	await completedFacadeOperation(f.facade.controller.showProjects());
	expect(
		projects(f.facade.controller).projects.map((p) => p.storageNamespace),
	).toEqual(["legacy"]);
	expect(projects(f.facade.controller).storageSources).toContainEqual({
		storageNamespace: "browser-registered",
		kind: "unavailable",
	});
	expect(f.reads()).toBe(1);
});
for (const outcome of ["permanently-deleted", "not-ready"] as const) {
	it(`refreshes directory cards only after ${outcome} from the exact deletion owner`, async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		const before = f.facade.controller.snapshot();
		Reflect.set(
			f.registered.controller,
			"permanentlyDeleteProjectFromDirectory",
			async () => {
				f.read({ kind: "available", directory: { kind: "empty" } });
				return { kind: outcome };
			},
		);
		expect(
			(
				await completedFacadeOperation(f.facade.controller.permanentlyDeleteProjectFromDirectory(
					"same-id",
					{ storageNamespace: "browser-registered" },
				))
			).kind,
		).toBe(outcome);
		if (outcome === "permanently-deleted") {
			expect(
				projects(f.facade.controller).projects.map((p) => p.storageNamespace),
			).toEqual(["legacy"]);
			expect(f.reads()).toBe(2);
		} else {
			expect(f.facade.controller.snapshot()).toBe(before);
			expect(f.reads()).toBe(1);
		}
	});
}
it("keeps owner-changing admission blocked while a confirmed deletion is waiting for its owned Core", async () => {
	const f = fixture();
	await completedFacadeOperation(f.facade.controller.open());
	let release: () => void = () => undefined;
	f.registered.holdShow(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	const deleting = f.facade.controller.permanentlyDeleteProjectFromDirectory(
		"same-id",
		{ storageNamespace: "browser-registered" },
	);
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	f.facade.controller.startNewProject();
	expect(
		(await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(Uint8Array.of(1))))
			.kind,
	).toBe("in-progress");
	expect(f.legacy.invocations).toEqual([]);
	expect(f.legacy.calls).not.toContain("startNewProject");
	release();
	expect((await completedFacadeOperation(deleting)).kind).toBe("permanently-deleted");
	await completedFacadeOperation(f.facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	expect(f.legacy.invocations.at(-1)?.method).toBe("openProject");
});

it("keeps the real legacy source usable when the private runtime could not produce a controller capability", async () => {
	const legacy = core([summary("Healthy legacy source")]);
	let closed = 0;
	const facade = createBrowserProjectControllerFacade({
		legacy: legacy.controller,
		registered: {
			readDirectory: async () => ({ kind: "unavailable" }),
			dispose: async () => {
				closed++;
			},
		},
	});
	await completedFacadeOperation(facade.controller.open());
	expect(
		projects(facade.controller).projects.map((row) => row.storageNamespace),
	).toEqual(["legacy"]);
	expect(projects(facade.controller).storageSources).toEqual([
		{ storageNamespace: "legacy", kind: "available" },
		{ storageNamespace: "browser-registered", kind: "unavailable" },
	]);
	await completedFacadeOperation(facade.controller.openProject("same-id", {
		storageNamespace: "legacy",
	}));
	await completedFacadeOperation(facade.controller.renameProject("Still allowed in legacy"));
	expect(legacy.invocations.at(-1)).toEqual({
		method: "renameProject",
		args: ["Still allowed in legacy"],
	});
	await expect(completedFacadeOperation(facade.dispose())).resolves.toBeUndefined();
	await expect(completedFacadeOperation(facade.dispose())).resolves.toBeUndefined();
	expect(closed).toBe(1);
});
it("refuses every private destination action without borrowing the legacy controller when private capability is absent", async () => {
	const legacy = core([summary("Legacy")]);
	const facade = createBrowserProjectControllerFacade({
		legacy: legacy.controller,
		registered: {
			readDirectory: async () => ({ kind: "unavailable" }),
			dispose: async () => undefined,
		},
	});
	await completedFacadeOperation(facade.controller.open());
	const before = facade.controller.snapshot(),
		instance = facade.getEditorInstanceSnapshot();
	expect(
		(await completedFacadeOperation(facade.controller.importRegisteredPortableBackup(Uint8Array.of(1))))
			.kind,
	).toBe("not-ready");
	await completedFacadeOperation(facade.controller.openProject("same-id", {
		storageNamespace: "browser-registered",
	}));
	expect(
		(
			await completedFacadeOperation(facade.controller.exportRegisteredProjectTransfer("same-id", {
				storageNamespace: "browser-registered",
			}))
		).kind,
	).toBe("not-ready");
	expect(
		(
			await completedFacadeOperation(facade.controller.exportProjectTransfer("same-id", {
				storageNamespace: "browser-registered",
			}))
		).kind,
	).toBe("not-ready");
	expect(
		(
			await completedFacadeOperation(facade.controller.permanentlyDeleteProjectFromDirectory("same-id", {
				storageNamespace: "browser-registered",
			}))
		).kind,
	).toBe("not-ready");
	expect(facade.controller.snapshot()).toBe(before);
	expect(facade.getEditorInstanceSnapshot()).toBe(instance);
	expect(legacy.invocations).toEqual([]);
	await expect(completedFacadeOperation(facade.dispose())).resolves.toBeUndefined();
});


for (const refusal of ["throw", "quiet"] as const) {
 it(`preserves the current healthy private view when the legacy new-project capability ${refusal}s`, async () => {
  const f = fixture(); await completedFacadeOperation(f.facade.controller.open()); await completedFacadeOperation(f.facade.controller.openProject("same-id", { storageNamespace: "browser-registered" }));
  const instance = f.facade.getEditorInstanceSnapshot(), before = f.facade.controller.snapshot(), observed: ProjectScreenState[] = [];
  f.facade.controller.subscribe(state => observed.push(state));
  Reflect.set(f.legacy.controller, "startNewProject", () => { if (refusal === "throw") throw new Error("Legacy startup is read-only"); });
  expect(() => f.facade.controller.startNewProject()).not.toThrow();
  expect(f.facade.getEditorInstanceSnapshot()).toBe(instance); expect(f.facade.controller.snapshot()).toBe(before); expect(observed).toEqual([]);
  expect(instance.controller?.hasPendingPublication()).toBe(false); await instance.controller?.renameProject("Still selected private owner");
  expect(f.registered.invocations.at(-1)).toEqual({ method: "renameProject", args: ["Still selected private owner"] });
 });
}
it("publishes a successful legacy new-project navigation once after first-run is confirmed, without a transient corruption notice", async () => {
 const f = fixture(); await completedFacadeOperation(f.facade.controller.open()); await completedFacadeOperation(f.facade.controller.openProject("same-id", { storageNamespace: "legacy" }));
 const observed: ProjectScreenState[] = []; f.facade.controller.subscribe(state => observed.push(state)); f.facade.controller.startNewProject();
 expect(observed).toEqual([{ kind: "first-run" }]); expect(f.facade.getEditorInstanceSnapshot().storageNamespace).toBe("legacy");
});


it("does not treat an already-existing legacy first-run snapshot as proof that a refused new-project command succeeded", async () => {
 const f = fixture(); f.legacy.setState({ kind: "first-run" }); await completedFacadeOperation(f.facade.controller.open()); await completedFacadeOperation(f.facade.controller.openProject("same-id", { storageNamespace: "browser-registered" }));
 const instance = f.facade.getEditorInstanceSnapshot(), before = f.facade.controller.snapshot(); Reflect.set(f.legacy.controller, "startNewProject", () => undefined);
 f.facade.controller.startNewProject(); expect(f.facade.getEditorInstanceSnapshot()).toBe(instance); expect(f.facade.controller.snapshot()).toBe(before);
 expect(instance.controller?.hasPendingPublication()).toBe(false);
});
