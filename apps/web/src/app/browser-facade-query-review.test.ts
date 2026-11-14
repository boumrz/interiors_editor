import { completedFacadeOperation } from "./browser-facade-test-support";
import { describe, expect, it } from "@rstest/core";
import type { PublicationCandidate } from "../application/ports";
import { createInitialProject } from "../domain/initial-project";
import { fixture } from "./browser-facade-test-support";
import type {
	ProjectController,
	ProjectScreenState,
} from "./project-controller";

const instant = "2026-11-04T00:00:00.000Z";
const queryNames = [
	"sessionHistory",
	"sessionHistoryCommandLabels",
	"currentRevisionIdentity",
	"pendingPublicationIdentity",
	"sessionRetentionRoots",
	"writerAccess",
	"writerRecoveryCopy",
	"recoveryReadOnlyProject",
	"recoveryCustomGlbRemovalSummary",
	"persistenceRetryPolicy",
] as const;
type QueryName = (typeof queryNames)[number];
type QueryValues = { [Name in QueryName]: ReturnType<ProjectController[Name]> };

function candidate(name: string, projectId = "same-id"): PublicationCandidate {
	const project = createInitialProject({
		name,
		projectId,
		levelId: `${name}-level`,
		createdAt: instant,
	});
	return {
		project,
		revision: {
			projectId,
			revisionId: `${name}-revision`,
			schemaVersion: 1,
			checksum: (name === "legacy" ? "a" : "b").repeat(64),
			createdAt: instant,
			serializedProject: JSON.stringify(project),
		},
	};
}
function identity(value: PublicationCandidate) {
	return {
		projectId: value.project.projectId,
		revisionId: value.revision.revisionId,
		checksum: value.revision.checksum,
	};
}
function saved(value: PublicationCandidate): ProjectScreenState {
	return {
		kind: "saved",
		project: value.project,
		projectName: value.project.name,
		revisionId: value.revision.revisionId,
	};
}
function installQueries(
	controller: ProjectController,
	owner: "legacy" | "registered",
	retained = true,
) {
	const value = candidate(owner);
	const values: QueryValues = {
		sessionHistory: {
			canUndo: owner === "legacy",
			canRedo: owner === "registered",
		},
		sessionHistoryCommandLabels: {
			undoActionLabel: `${owner}-undo`,
			redoActionLabel: `${owner}-redo`,
		},
		currentRevisionIdentity: identity(value),
		pendingPublicationIdentity: retained ? identity(value) : undefined,
		sessionRetentionRoots: { current: value, undo: [value], redo: [] },
		writerAccess: {
			kind: "writable",
			fencingToken: owner === "legacy" ? 3 : 7,
		},
		writerRecoveryCopy: retained ? value : undefined,
		recoveryReadOnlyProject: value.project,
		recoveryCustomGlbRemovalSummary: {
			affectedAssetDefinitionCount: owner === "legacy" ? 1 : 2,
			affectedAssetInstanceCount: owner === "legacy" ? 3 : 4,
		},
		persistenceRetryPolicy:
			owner === "legacy"
				? "allowed"
				: "registered-transfer-reselection-required",
	};
	const calls: QueryName[] = [];
	for (const name of queryNames) {
		Object.defineProperty(controller, name, {
			configurable: true,
			value: () => {
				calls.push(name);
				return values[name];
			},
		});
	}
	return { values, calls };
}
function currentView(f: ReturnType<typeof fixture>) {
	const controller = f.facade.getEditorInstanceSnapshot().controller;
	if (!controller) throw new Error("No owned view controller");
	return controller;
}
const staleValues: Record<QueryName, unknown> = {
	sessionHistory: { canUndo: false, canRedo: false },
	sessionHistoryCommandLabels: {
		undoActionLabel: undefined,
		redoActionLabel: undefined,
	},
	currentRevisionIdentity: undefined,
	pendingPublicationIdentity: undefined,
	sessionRetentionRoots: undefined,
	writerAccess: { kind: "not-ready" },
	writerRecoveryCopy: undefined,
	recoveryReadOnlyProject: undefined,
	recoveryCustomGlbRemovalSummary: undefined,
	persistenceRetryPolicy: "allowed",
};

describe("browser facade synchronous query ownership", () => {
	for (const owner of ["legacy", "browser-registered"] as const) {
		it(`keeps every ${owner} view query synchronous and on its selected owner`, async () => {
			const f = fixture();
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: owner,
			}));
			const legacy = installQueries(f.legacy.controller, "legacy");
			const registered = installQueries(f.registered.controller, "registered");
			const selected = owner === "legacy" ? legacy : registered;
			const other = owner === "legacy" ? registered : legacy;
			const view = currentView(f);
			for (const name of queryNames) {
				const result = view[name]();
				expect(result).not.toBeInstanceOf(Promise);
				expect(result).toStrictEqual(selected.values[name]);
			}
			expect(selected.calls).toEqual(queryNames);
			expect(other.calls).toEqual([]);
			await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
		});
	}

	it("uses only legacy for synchronous queries before any owner is selected", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.open());
		const legacy = installQueries(f.legacy.controller, "legacy");
		const registered = installQueries(f.registered.controller, "registered");
		for (const name of queryNames) {
			const result = currentView(f)[name]();
			expect(result).not.toBeInstanceOf(Promise);
			expect(result).toStrictEqual(legacy.values[name]);
		}
		expect(legacy.calls).toEqual(queryNames);
		expect(registered.calls).toEqual([]);
		await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
	});

	it("revokes cached queries with typed synchronous safe results after a same-ID owner switch and disposal", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		const legacy = installQueries(f.legacy.controller, "legacy", false);
		const registered = installQueries(
			f.registered.controller,
			"registered",
			false,
		);
		const oldView = currentView(f);
		for (const name of queryNames) oldView[name]();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		const before = [legacy.calls.length, registered.calls.length];
		for (const name of queryNames) {
			const result = oldView[name]();
			expect(result).not.toBeInstanceOf(Promise);
			expect(result).toStrictEqual(staleValues[name]);
		}
		expect(oldView.hasPendingPublication()).toBe(true);
		expect([legacy.calls.length, registered.calls.length]).toEqual(before);
		const selectedView = currentView(f);
		await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
		for (const view of [oldView, selectedView]) {
			for (const name of queryNames) {
				const result = view[name]();
				expect(result).not.toBeInstanceOf(Promise);
				expect(result).toStrictEqual(staleValues[name]);
			}
			expect(view.hasPendingPublication()).toBe(true);
		}
		expect([legacy.calls.length, registered.calls.length]).toEqual(before);
	});
});

describe("browser facade exact retained proof", () => {
	for (const mismatch of [
		"snapshot-project",
		"snapshot-revision",
		"current-project",
		"current-revision",
		"current-checksum",
	] as const) {
		it(`does not retarget the old displayed Project when retry has a mismatching ${mismatch}`, async () => {
			const f = fixture();
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: "browser-registered",
			}));
			const displayed = f.registered.controller.snapshot();
			if (displayed.kind !== "saved")
				throw new Error("No displayed prior Project");
			const retained = candidate("pending", "pending-b");
			f.registered.controller.importRegisteredPortableBackup = async (
				_bytes,
				options,
			) => {
				f.registered.setPending(identity(retained));
				options?.onStatus?.({
					kind: "persist-failed",
					candidate: retained,
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				});
				f.registered.setState({
					kind: "persist-failed",
					project: displayed.project,
					revisionId: displayed.revisionId,
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				});
				return {
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				};
			};
			expect(
				(
					await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(
						Uint8Array.of(1),
					))
				).kind,
			).toBe("persist-failed");
			const failedInstance = f.facade.getEditorInstanceSnapshot();
			// The shared helper is a partial contract double; both real cores own retry.
			f.legacy.controller.retry = async () => undefined;
			f.registered.controller.currentRevisionIdentity = () => ({
				...identity(retained),
				...(mismatch === "current-project"
					? { projectId: "other-project" }
					: {}),
				...(mismatch === "current-revision"
					? { revisionId: "other-revision" }
					: {}),
				...(mismatch === "current-checksum"
					? { checksum: "c".repeat(64) }
					: {}),
			});
			f.registered.controller.retry = async () => {
				f.registered.setPending(undefined);
				const projected =
					mismatch === "snapshot-project"
						? {
								...retained,
								project: { ...retained.project, projectId: "other-project" },
								revision: { ...retained.revision, projectId: "other-project" },
							}
						: retained;
				const state = saved(projected);
				if (state.kind !== "saved") throw new Error("No saved projection");
				f.registered.setState(
					mismatch === "snapshot-revision"
						? { ...state, revisionId: "other-revision" }
						: state,
				);
			};
			await completedFacadeOperation(f.facade.controller.retry());
			expect(f.facade.getEditorInstanceSnapshot()).toBe(failedInstance);
			expect(f.facade.controller.snapshot()).toEqual({
				kind: "recovery-needed",
				reasonCode: "PERSISTENCE_CORRUPT",
			});
			const before = [...f.registered.invocations];
			expect(
				await completedFacadeOperation(currentView(f).renameProject(
					"Must not reach a different Project",
				)),
			).toEqual({ kind: "not-ready" });
			expect(f.registered.invocations).toEqual(before);
			await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
		});
	}

	for (const mismatch of ["project", "revision", "checksum"] as const) {
		it(`refuses an import callback with a different ${mismatch} from the actual retained candidate`, async () => {
			const f = fixture();
			await completedFacadeOperation(f.facade.controller.openProject("same-id", {
				storageNamespace: "legacy",
			}));
			const before = f.facade.controller.snapshot();
			const instance = f.facade.getEditorInstanceSnapshot();
			const retained = candidate("pending", "pending-b");
			const proof: PublicationCandidate =
				mismatch === "project"
					? {
							project: { ...retained.project, projectId: "other-project" },
							revision: { ...retained.revision, projectId: "other-project" },
						}
					: {
							...retained,
							revision: {
								...retained.revision,
								...(mismatch === "revision"
									? { revisionId: "different-revision" }
									: { checksum: "c".repeat(64) }),
							},
						};
			f.registered.controller.importRegisteredPortableBackup = async (
				_bytes,
				options,
			) => {
				f.registered.setPending(identity(retained));
				options?.onStatus?.({
					kind: "persist-failed",
					candidate: proof,
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				});
				f.registered.setState({
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				});
				return {
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
				};
			};
			expect(
				await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(
					Uint8Array.of(1),
				)),
			).toEqual({
				kind: "persist-failed",
				reasonCode: "PERSISTENCE_QUOTA_EXCEEDED",
			});
			expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
			expect(f.facade.controller.snapshot()).toBe(before);
			expect(f.registered.controller.pendingPublicationIdentity()).toEqual(
				identity(retained),
			);
			await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
		});
	}

	it("does not adopt a recovery copy whose Project and Revision owners disagree", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		const before = f.facade.controller.snapshot();
		const instance = f.facade.getEditorInstanceSnapshot();
		const proof = candidate("copy", "pending-b");
		const corruptCopy: PublicationCandidate = {
			...proof,
			revision: { ...proof.revision, projectId: "foreign-project" },
		};
		f.registered.controller.importRegisteredPortableBackup = async (
			_bytes,
			options,
		) => {
			f.registered.setCopy(corruptCopy);
			options?.onStatus?.({
				kind: "persist-failed",
				candidate: proof,
				reasonCode: "PERSISTENCE_WRITE_FAILED",
			});
			f.registered.setState(saved(candidate("registered")));
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		};
		expect(
			(
				await completedFacadeOperation(f.facade.controller.importRegisteredPortableBackup(
					Uint8Array.of(1),
				))
			).kind,
		).toBe("persist-failed");
		expect(f.facade.getEditorInstanceSnapshot()).toBe(instance);
		expect(f.facade.controller.snapshot()).toBe(before);
		expect(f.registered.controller.writerRecoveryCopy()).toBe(corruptCopy);
		await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
	});

	it("does not discard the exact copy object when only its Revision belongs to another Project", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		const copy = candidate("copy");
		const corruptCopy: PublicationCandidate = {
			...copy,
			revision: { ...copy.revision, projectId: "foreign-project" },
		};
		f.registered.setCopy(corruptCopy);
		const before = [...f.registered.calls];
		expect(
			await completedFacadeOperation(f.facade.discardWriterRecoveryAndShowProjects(corruptCopy)),
		).toBe(false);
		expect(f.registered.controller.writerRecoveryCopy()).toBe(corruptCopy);
		expect(f.registered.calls).toEqual(before);
		await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
	});
});

describe("browser facade active view subscriptions", () => {
	it("keeps delivering the current view after a different subscriber throws", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		const view = currentView(f);
		let throwingCalls = 0;
		const stopThrowing = view.subscribe(() => {
			throwingCalls++;
			throw new Error("Subscriber failure");
		});
		const seen: ProjectScreenState[] = [];
		const stopObserving = view.subscribe((state) => seen.push(state));
		const next = saved(candidate("legacy"));
		expect(() => f.legacy.setState(next)).not.toThrow();
		expect(throwingCalls).toBe(1);
		expect(seen).toEqual([next]);
		stopThrowing();
		stopObserving();
		f.legacy.setState({ ...next });
		expect(throwingCalls).toBe(1);
		expect(seen).toEqual([next]);
		await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
	});

	it("delivers active Saving and Saved updates, honors unsubscribe, and isolates a later same-ID owner", async () => {
		const f = fixture();
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "legacy",
		}));
		const viewA = currentView(f);
		const seenA: ProjectScreenState[] = [];
		const stopA = viewA.subscribe((state) => seenA.push(state));
		const a = candidate("legacy");
		const savingA: ProjectScreenState = {
			kind: "saving",
			project: a.project,
			revisionId: a.revision.revisionId,
		};
		const savedA = saved(a);
		f.legacy.setState(savingA);
		f.legacy.setState(savedA);
		expect(seenA).toEqual([savingA, savedA]);
		expect(viewA.snapshot()).toBe(savedA);
		stopA();
		stopA();
		f.legacy.setState({ ...savedA });
		expect(seenA).toEqual([savingA, savedA]);
		const retainedA: ProjectScreenState[] = [];
		viewA.subscribe((state) => retainedA.push(state));
		await completedFacadeOperation(f.facade.controller.openProject("same-id", {
			storageNamespace: "browser-registered",
		}));
		const viewB = currentView(f);
		const seenB: ProjectScreenState[] = [];
		const stopB = viewB.subscribe((state) => seenB.push(state));
		const b = candidate("registered");
		const savingB: ProjectScreenState = {
			kind: "saving",
			project: b.project,
			revisionId: b.revision.revisionId,
		};
		const savedB = saved(b);
		f.legacy.setState(saved(a));
		f.registered.setState(savingB);
		f.registered.setState(savedB);
		expect(retainedA).toEqual([]);
		expect(seenB).toEqual([savingB, savedB]);
		expect(viewA.snapshot()).toBe(savedA);
		expect(viewB.snapshot()).toBe(savedB);
		stopB();
		stopB();
		f.registered.setState({ ...savedB });
		expect(seenB).toEqual([savingB, savedB]);
		await expect(completedFacadeOperation(f.facade.dispose())).resolves.toBeUndefined();
		f.registered.setState(savingB);
		expect(seenB).toEqual([savingB, savedB]);
	});
});
