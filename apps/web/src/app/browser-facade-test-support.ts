import { expect } from "@rstest/core";
import type {
	DurablePublicationCandidate,
	ProjectSummary,
} from "../application/ports";
import { createInitialProject } from "../domain/initial-project";
import {
	type BrowserRegisteredDirectoryRead,
	createBrowserProjectControllerFacade,
} from "./browser-project-controller-facade";
import type {
	ProjectController,
	ProjectScreenState,
} from "./project-controller";

// These in-memory collaborators have no I/O after their explicit gates open.
// Check public completion directly instead of depending on Rstest's body timer.
export async function completedFacadeOperation<T>(operation: Promise<T>): Promise<T> {
	let deadline: ReturnType<typeof setTimeout> | undefined;
	try {
		const result = await Promise.race([
			operation.then((value) => ({ value })),
			new Promise<undefined>((resolve) => {
				deadline = setTimeout(() => resolve(undefined), 1_000);
			}),
		]);
		expect(result, "the in-memory public facade operation must complete").toBeDefined();
		if (result === undefined) throw new Error("facade completion assertion did not fail");
		return result.value;
	} finally {
		if (deadline !== undefined) clearTimeout(deadline);
	}
}

export function summary(name: string): ProjectSummary {
	return {
		name,
		projectId: "same-id",
		revisionId: "same-revision",
		updatedAt: "2026-11-04T00:00:00.000Z",
	};
}
export function core(projects: readonly ProjectSummary[]) {
	let state: ProjectScreenState = { kind: "projects", projects },
		busy = false,
		failOpen = false;
	const invocations: { method: string; args: readonly unknown[] }[] = [];
	let openWait: Promise<void> | undefined;
	let commandWait: Promise<void> | undefined;
	let exportWait: Promise<void> | undefined;
	let importWait: Promise<void> | undefined;
	let writerCopy: DurablePublicationCandidate | undefined;
	let showWait: Promise<void> | undefined;
	let importResult: Awaited<
		ReturnType<ProjectController["importRegisteredPortableBackup"]>
	> = { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
	let importState: ProjectScreenState | undefined;
	let pendingIdentity: ReturnType<
		ProjectController["pendingPublicationIdentity"]
	>;
	async function runImport(
		method: string,
		args: Parameters<ProjectController["importRegisteredPortableBackup"]>,
	) {
		invocations.push({ method, args });
		args[1]?.onStatus?.({ kind: "validating" });
		await importWait;
		const next = importState;
		if (
			next &&
			(next.kind === "saved" || next.kind === "persist-failed") &&
			next.project?.schemaVersion === 1 &&
			next.revisionId
		) {
			const candidate = {
				project: next.project,
				revision: {
					projectId: next.project.projectId,
					revisionId: next.revisionId,
					schemaVersion: 1 as const,
					serializedProject: JSON.stringify(next.project),
					checksum: "a".repeat(64),
					createdAt: next.project.createdAt,
				},
			};
			if (next.kind === "persist-failed")
				pendingIdentity = {
					projectId: candidate.project.projectId,
					revisionId: candidate.revision.revisionId,
					checksum: candidate.revision.checksum,
				};
			args[1]?.onStatus?.(
				next.kind === "saved"
					? { kind: "saved", candidate }
					: { kind: "persist-failed", candidate, reasonCode: next.reasonCode },
			);
		}
		if (next) {
			state = next;
			for (const listener of listeners) listener(state);
		}
		return importResult;
	}
	const calls: string[] = [],
		listeners = new Set<(state: ProjectScreenState) => void>();
	const controller = {
		snapshot: () => state,
		subscribe(listener: (state: ProjectScreenState) => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async open() {
			calls.push("open");
			if (failOpen) throw new Error("Unavailable legacy source");
		},
		async showProjects() {
			calls.push("showProjects");
			writerCopy = undefined;
			await showWait;
			if (failOpen) throw new Error("Unavailable legacy source");
			state = { kind: "projects", projects };
			for (const listener of listeners) listener(state);
		},
		startNewProject() {
			calls.push("startNewProject");
			state = { kind: "first-run" };
			for (const listener of listeners) listener(state);
		},
		async create(name: string) {
			invocations.push({ method: "create", args: [name] });
			const project = createInitialProject({
				name,
				projectId: "created",
				levelId: "level",
				createdAt: "2026-11-04T00:00:00.000Z",
			});
			state = {
				kind: "saved",
				project,
				projectName: name,
				revisionId: "created-r1",
			};
			for (const listener of listeners) listener(state);
			return {
				kind: "durable",
				projectId: "created",
				revisionId: "created-r1",
			};
		},
		importRegisteredPortableBackup: (
			...args: Parameters<ProjectController["importRegisteredPortableBackup"]>
		) => runImport("importRegisteredPortableBackup", args),
		importPortableBackup: (
			...args: Parameters<ProjectController["importRegisteredPortableBackup"]>
		) => runImport("importPortableBackup", args),
		importRecoveryDraft: (
			...args: Parameters<ProjectController["importRegisteredPortableBackup"]>
		) => runImport("importRecoveryDraft", args),
		importProjectTransfer: (
			...args: Parameters<ProjectController["importRegisteredPortableBackup"]>
		) => runImport("importProjectTransfer", args),
		listCustomGlbLibraryAssets: async () => [],
		storagePressure: async () => ({ kind: "unavailable" }),
		async openProject(...args: [string]) {
			const [projectId] = args;
			invocations.push({ method: "openProject", args });
			state = { kind: "loading" };
			for (const listener of listeners) listener(state);
			await openWait;
			const project = createInitialProject({
				projectId,
				name: projects[0]?.name ?? "New",
				levelId: "level",
				createdAt: "2026-11-04T00:00:00.000Z",
			});
			state = {
				kind: "saved",
				project,
				projectName: project.name,
				revisionId: "same-revision",
			};
			for (const listener of listeners) listener(state);
		},
		async renameProject(...args: unknown[]) {
			invocations.push({ method: "renameProject", args });
			await commandWait;
			return { kind: "not-ready" };
		},
		async restartProject(...args: unknown[]) {
			invocations.push({ method: "restartProject", args });
			return { kind: "not-ready" };
		},
		async undo(...args: unknown[]) {
			invocations.push({ method: "undo", args });
			return { kind: "not-ready" };
		},
		async exportProjectTransfer(...args: unknown[]) {
			invocations.push({ method: "exportProjectTransfer", args });
			await exportWait;
			return {
				kind: "ready",
				bytes: Uint8Array.of(1),
				filename: "selected.interiors",
				mimeType: "application/zip",
			};
		},
		async exportRegisteredProjectTransfer(...args: unknown[]) {
			invocations.push({ method: "exportRegisteredProjectTransfer", args });
			await exportWait;
			return {
				kind: "ready",
				bytes: Uint8Array.of(2),
				filename: "registered.interiors",
				mimeType: "application/zip",
			};
		},
		async permanentlyDeleteProjectFromDirectory(...args: unknown[]) {
			invocations.push({
				method: "permanentlyDeleteProjectFromDirectory",
				args,
			});
			return { kind: "permanently-deleted" };
		},
		sessionHistory: () => ({
			canUndo: projects[0]?.name === "Перенесённая копия",
			canRedo: false,
		}),
		hasPendingPublication: () => busy,
		pendingPublicationIdentity: () => pendingIdentity,
		writerRecoveryCopy: () => writerCopy,
	} as unknown as ProjectController;
	return {
		controller,
		calls,
		invocations,
		setPending(identity: typeof pendingIdentity) {
			pendingIdentity = identity;
		},
		setCopy(copy: DurablePublicationCandidate | undefined) {
			writerCopy = copy;
		},
		holdCommand(value: Promise<void>) {
			commandWait = value;
		},
		holdShow(value: Promise<void>) {
			showWait = value;
		},
		holdOpen(value: Promise<void>) {
			openWait = value;
		},
		holdExport(value: Promise<void>) {
			exportWait = value;
		},
		holdImport(value: Promise<void>) {
			importWait = value;
		},
		importOutcome(result: typeof importResult, next?: ProjectScreenState) {
			importResult = result;
			importState = next;
		},
		setBusy(value: boolean) {
			busy = value;
		},
		fail() {
			failOpen = true;
		},
		setState(value: ProjectScreenState) {
			state = value;
			for (const listener of listeners) listener(state);
		},
	};
}
export function fixture() {
	const legacy = core([summary("Обычная копия")]),
		registered = core([summary("Перенесённая копия")]);
	let reads = 0,
		disposals = 0;
	let onDispose: (() => void) | undefined;
	let read: BrowserRegisteredDirectoryRead = {
		kind: "available",
		directory: { kind: "populated", projects: [summary("Перенесённая копия")] },
	};
	let wait: Promise<void> | undefined;
	const facade = createBrowserProjectControllerFacade({
		legacy: legacy.controller,
		registered: {
			controller: registered.controller,
			async readDirectory() {
				reads++;
				await wait;
				return read;
			},
			async dispose() {
				disposals++;
				onDispose?.();
			},
		},
	});
	return {
		facade,
		legacy,
		registered,
		disposals: () => disposals,
		onDispose(callback: () => void) {
			onDispose = callback;
		},
		reads: () => reads,
		read(value: BrowserRegisteredDirectoryRead) {
			read = value;
		},
		wait(value: Promise<void>) {
			wait = value;
		},
	};
}
export function projects(controller: ProjectController) {
	const state = controller.snapshot();
	if (state.kind !== "projects")
		throw new Error("Expected the merged directory");
	return state;
}
