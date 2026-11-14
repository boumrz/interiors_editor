import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { createHostFileBridge } from "../adapters/telegram/host-file-bridge";
import type { ExportPortableBackupResult } from "../application/export-portable-backup";
import type { ProjectSummary, UnverifiedProjectSource } from "../application/ports";
import {
	TelegramReadonlyProjectsContent,
	TelegramReadonlyProjectsSession,
	type TelegramReadonlyRuntimePort,
} from "./telegram-readonly-projects";

// UI-port contracts and actual local Files only; no repository/archive or physical save claim.
const project: ProjectSummary = {
	projectId: "healthy",
	revisionId: "durable",
	name: "Healthy room",
	updatedAt: "2026-11-05",
};
const originalSource: UnverifiedProjectSource = {
	kind: "unverified-source",
	projectId: "raw-a",
	revisionId: "raw-revision-a",
	serializedProject: " exact original \ud800 source ",
};
const latestSource: UnverifiedProjectSource = {
	kind: "unverified-source",
	projectId: "raw-c",
	revisionId: "raw-revision-c",
	serializedProject: " latest selected \u0000 source ",
};
function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((finish) => { resolve = finish; });
	return { promise, resolve };
}
function fixture(isCurrent: () => boolean = () => true, configure?: (runtime: TelegramReadonlyRuntimePort) => void) {
	const abort = new AbortController();
	const shares: File[] = [];
	const problems: string[] = [];
	const runtime: TelegramReadonlyRuntimePort = {
		signal: abort.signal,
		async listProjects() { return { kind: "populated", projects: [project] }; },
		async exportProjectTransfer(): Promise<ExportPortableBackupResult> {
			return { kind: "ready", filename: "healthy.interiors", mimeType: "application/zip", bytes: new Uint8Array([1, 2, 3]) };
		},
		sourceRecovery: {
			async listRecoverySources() {
				return [originalSource, latestSource].map(({ serializedProject: _bytes, ...address }) => address);
			},
			async readRecoverySource(projectId, revisionId) {
				return [originalSource, latestSource].find((source) => source.projectId === projectId && source.revisionId === revisionId);
			},
		},
	};
	const bridge = createHostFileBridge({
		maximumBytes: 1024 * 1024,
		system: {
			canShare: () => true,
			async share(data) { if (data.files?.[0]) shares.push(data.files[0]); },
		},
	});
	configure?.(runtime);
	const model = new TelegramReadonlyProjectsSession(runtime, bridge, {
		isCurrent,
		onProblem: (problem) => { problems.push(problem); },
	});
	return { abort, runtime, shares, problems, bridge, model };
}

describe("readonly leaf public operation timelines", () => {
	it("keeps the newest raw selection after an older read crosses a completed Project preparation", async () => {
		const oldGate = deferred<UnverifiedProjectSource | undefined>();
		const f = fixture(() => true, (runtime) => {
			runtime.sourceRecovery.readRecoverySource = async (projectId) => projectId === originalSource.projectId ? oldGate.promise : latestSource;
		});
		try {
			await f.model.start();
			const oldRead = f.model.sourceRecovery.readRecoverySource(originalSource.projectId, originalSource.revisionId);
			expect(await f.model.prepareProject(project)).toBe(true);
			const latest = await f.model.sourceRecovery.readRecoverySource(latestSource.projectId, latestSource.revisionId);
			oldGate.resolve(originalSource);
			expect(await oldRead).toBeUndefined();
			if (!latest) throw new Error("The latest explicit source selection is missing");
			await f.model.prepareSource(latest);
			const state = f.model.fileSession?.snapshot();
			if (state?.kind !== "prepared" || !state.prepared) throw new Error("The latest source File is missing");
			expect(state.prepared.fileKind).toBe("unverified-source");
			expect(JSON.parse(await state.prepared.file.text()).serializedProject).toBe(latestSource.serializedProject);
			expect(f.shares).toEqual([]);
		} finally {
			oldGate.resolve(originalSource);
			f.model.dispose();
		}
	});

	it("rejects raw-file encoding allocation failure instead of fulfilling preparation without a File", async () => {
		const f = fixture();
		await f.model.start();
		const source = await f.model.sourceRecovery.readRecoverySource(originalSource.projectId, originalSource.revisionId);
		if (!source) throw new Error("The explicit source selection is missing");
		const originalEncode = TextEncoder.prototype.encode;
		let outcome: "fulfilled" | "rejected" | undefined;
		try {
			TextEncoder.prototype.encode = () => { throw new RangeError("Encoding allocation refused"); };
			outcome = await f.model.prepareSource(source).then(() => "fulfilled" as const, () => "rejected" as const);
		} finally {
			TextEncoder.prototype.encode = originalEncode;
		}
		try {
			expect(outcome).toBe("rejected");
			expect(f.model.fileSession?.snapshot().kind).toBe("failed");
			expect(f.problems).toEqual(["file-unavailable"]);
			expect(f.shares).toEqual([]);
			const retry = await f.model.sourceRecovery.readRecoverySource(originalSource.projectId, originalSource.revisionId);
			if (!retry) throw new Error("The source retry is missing");
			await f.model.prepareSource(retry);
			expect(f.model.fileSession?.snapshot().kind).toBe("prepared");
		} finally { f.model.dispose(); }
	});

	it("keeps a mixed healthy directory actionable while visibly warning about separate unverified data", () => {
		const html = renderToStaticMarkup(<TelegramReadonlyProjectsContent
			state={{ kind: "directory", directory: { kind: "populated", projects: [project], recoveryNeeded: true } }}
			fileAvailable onPrepareProject={() => undefined} onRetry={() => undefined} onExit={() => undefined}
		/>);
		expect(html).toContain(project.name);
		expect(html).toContain("Подготовить файл проекта");
		expect(html).toContain("Часть локальных данных не удалось проверить");
	});

	it("never labels a healthy populated or empty directory as a closed view", () => {
		for (const directory of [{ kind: "populated" as const, projects: [project] }, { kind: "empty" as const }]) {
			const html = renderToStaticMarkup(<TelegramReadonlyProjectsContent
				state={{ kind: "directory", directory }} fileAvailable
				onPrepareProject={() => undefined} onRetry={() => undefined} onExit={() => undefined}
			/>);
			expect(html).not.toContain("Просмотр данных завершён");
		}
	});

	it("refuses delivery from an old prepared capability when only current-owner permission changes", async () => {
		let current = true;
		const f = fixture(() => current);
		try {
			await f.model.start();
			expect(await f.model.prepareProject(project)).toBe(true);
			current = false;
			expect(f.abort.signal.aborted).toBe(false);
			await f.model.fileSession?.handoff();
			expect(f.shares).toEqual([]);
			expect(f.model.fileSession?.snapshot().kind).toBe("cancelled");
		} finally { f.model.dispose(); }
	});
});
