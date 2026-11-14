import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { createHostFileBridge } from "../adapters/telegram/host-file-bridge";
import type {
	ProjectDirectoryResult,
	ProjectSummary,
	UnverifiedProjectSource,
} from "../application/ports";
import type { HostNavigationPort } from "./editor-host-boundary";
import {
	connectTelegramReadonlyNavigation,
	TelegramReadonlyProjects,
	TelegramReadonlyProjectsContent,
	TelegramReadonlyProjectsSession,
	type TelegramReadonlyRuntimePort,
} from "./telegram-readonly-projects";

// UI port doubles only: no controller, signed scope, stored Project, valid archive or physical handoff proof.
const project: ProjectSummary = {
	projectId: "private-project",
	revisionId: "private-revision",
	name: "Комната 😀",
	updatedAt: "2026-11-05T00:00:00.000Z",
};
const populated: ProjectDirectoryResult = {
	kind: "populated",
	projects: [project],
};
function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((accept) => {
		resolve = accept;
	});
	return { promise, resolve };
}
function fixture() {
	const abort = new AbortController(),
		calls: string[] = [],
		shares: File[] = [];
	const source: UnverifiedProjectSource = {
		kind: "unverified-source",
		projectId: "raw-project",
		revisionId: "raw-revision",
		serializedProject: " \u0000bad-json\ud800😀\n",
	};
	const runtime: TelegramReadonlyRuntimePort = {
		signal: abort.signal,
		async listProjects() {
			calls.push("list-projects");
			return populated;
		},
		sourceRecovery: {
			async listRecoverySources() {
				calls.push("list-sources");
				return [
					{
						kind: source.kind,
						projectId: source.projectId,
						revisionId: source.revisionId,
					},
				];
			},
			async readRecoverySource(pid, rid) {
				calls.push(`read-source:${pid}:${rid}`);
				return source;
			},
		},
		async exportProjectTransfer(pid, rid, options) {
			calls.push(`export:${pid}:${rid}:${options?.signal?.aborted}`);
			return {
				kind: "ready",
				mimeType: "application/zip",
				filename: "project.interiors",
				bytes: new Uint8Array([80, 75, 7]),
			};
		},
	};
	const fileTransfer = createHostFileBridge({
		maximumBytes: 1024 * 1024,
		system: {
			canShare: () => true,
			async share(data) {
				if (data.files?.[0]) shares.push(data.files[0]);
			},
		},
	});
	return { runtime, abort, calls, shares, source, fileTransfer };
}
const noop = () => undefined;

describe("readonly projects UI contract", () => {
	it("renders an inert loading leaf without reading a runtime or starting file delivery", () => {
		const f = fixture();
		const html = renderToStaticMarkup(
			<TelegramReadonlyProjects
				runtime={f.runtime}
				fileTransfer={f.fileTransfer}
				onRetry={noop}
				onExit={noop}
			/>,
		);
		expect(html).toContain("Просмотр проектов");
		expect(html).toContain("Читаем список проектов");
		expect(f.calls).toEqual([]);
		expect(f.shares).toEqual([]);
	});
	it("keeps unavailable, empty and quarantined data distinct without exposing technical addresses", () => {
		const common = {
			fileAvailable: true,
			onPrepareProject: noop,
			onRetry: noop,
			onExit: noop,
		};
		const empty = renderToStaticMarkup(
			<TelegramReadonlyProjectsContent
				{...common}
				state={{ kind: "directory", directory: { kind: "empty" } }}
			/>,
		);
		const unavailable = renderToStaticMarkup(
			<TelegramReadonlyProjectsContent
				{...common}
				state={{ kind: "unavailable" }}
			/>,
		);
		const corrupt = renderToStaticMarkup(
			<TelegramReadonlyProjectsContent
				{...common}
				state={{
					kind: "directory",
					directory: {
						kind: "recovery-needed",
						reasonCode: "PERSISTENCE_CORRUPT",
					},
				}}
			/>,
		);
		expect(empty).toContain("нет проверенных проектов");
		expect(unavailable).toContain("Не удалось получить список");
		expect(unavailable).not.toContain("нет проверенных проектов");
		expect(corrupt).toContain("не удалось проверить");
	});
	it("shows only validated names and preparation controls, with a neutral diagnostics slot", () => {
		const html = renderToStaticMarkup(
			<TelegramReadonlyProjectsContent
				state={{
					kind: "directory",
					directory: {
						kind: "populated",
						projects: [{ ...project, name: "<script>unsafe()</script>" }],
						recoveryNeeded: true,
					},
				}}
				fileAvailable={true}
				onPrepareProject={noop}
				onRetry={noop}
				onExit={noop}
				diagnostics={
					<details>
						<summary>Диагностика запуска</summary>
					</details>
				}
			/>,
		);
		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain("<script>");
		expect(html).not.toContain(project.projectId);
		expect(html).not.toContain(project.revisionId);
		expect(html).toContain("Подготовить файл проекта");
		expect(html).toContain("Диагностика запуска");
		for (const label of [
			"Создать проект",
			"Импортировать",
			"Удалить",
			"Перехватить",
			"Исправить",
			"Редактировать",
		])
			expect(html).not.toContain(label);
	});
	it("makes file unavailability explicit and keeps retry and exit on the closed view", () => {
		const common = { onPrepareProject: noop, onRetry: noop, onExit: noop };
		const html = renderToStaticMarkup(
			<TelegramReadonlyProjectsContent
				{...common}
				state={{ kind: "directory", directory: populated }}
				fileAvailable={false}
			/>,
		);
		expect(html).toContain("Передача файлов недоступна");
		expect(html).toMatch(/<button[^>]*disabled[^>]*>Подготовить файл проекта/);
		const closed = renderToStaticMarkup(
			<TelegramReadonlyProjectsContent
				{...common}
				state={{ kind: "closed" }}
				fileAvailable={false}
			/>,
		);
		expect(closed).toContain("Повторить запуск");
		expect(closed).toContain("Выйти");
		expect(closed).not.toContain("Подготовить файл проекта");
	});
});

describe("readonly projects session lifecycle with controlled ports", () => {
	it("is inert until start, reads once, and owns an immutable thin directory", async () => {
		const f = fixture(),
			model = new TelegramReadonlyProjectsSession(f.runtime, f.fileTransfer);
		expect(f.calls).toEqual([]);
		await model.start();
		await model.start();
		expect(f.calls).toEqual(["list-projects"]);
		expect(model.snapshot().directory).toEqual({
			kind: "directory",
			directory: populated,
		});
		expect(Object.isFrozen(model.snapshot())).toBe(true);
		model.dispose();
	});
	it("drops a late list and refuses new source work immediately after abort", async () => {
		const f = fixture(),
			waiting = deferred<ProjectDirectoryResult>();
		f.runtime.listProjects = async () => {
			f.calls.push("list-projects");
			return waiting.promise;
		};
		const model = new TelegramReadonlyProjectsSession(
			f.runtime,
			f.fileTransfer,
		);
		const started = model.start();
		await Promise.resolve();
		f.abort.abort();
		expect(model.snapshot().directory).toEqual({ kind: "closed" });
		await expect(model.sourceRecovery.listRecoverySources()).rejects.toThrow();
		waiting.resolve(populated);
		await started;
		expect(model.snapshot().directory).toEqual({ kind: "closed" });
		expect(f.calls).toEqual(["list-projects"]);
	});
	it("does not start a queued query when cleanup or abort wins the first microtask", async () => {
		for (const mode of ["dispose", "abort"] as const) {
			const f = fixture(),
				model = new TelegramReadonlyProjectsSession(f.runtime, f.fileTransfer);
			const work = model.start();
			if (mode === "dispose") model.dispose();
			else f.abort.abort();
			await work;
			await model.start();
			expect(f.calls).toEqual([]);
		}
	});
	it("uses the selected Revision CAS and requires a separate handoff action", async () => {
		const f = fixture(),
			model = new TelegramReadonlyProjectsSession(f.runtime, f.fileTransfer);
		await model.start();
		expect(
			await model.prepareProject({ ...project, revisionId: "stale" }),
		).toBe(false);
		expect(await model.prepareProject(project)).toBe(true);
		expect(f.calls).toEqual([
			"list-projects",
			`export:${project.projectId}:${project.revisionId}:false`,
		]);
		expect(f.shares).toEqual([]);
		expect(model.fileSession?.snapshot().kind).toBe("prepared");
		await model.fileSession?.handoff();
		expect(f.shares).toHaveLength(1);
		expect(f.shares[0].name).toBe("project.interiors");
		expect([...new Uint8Array(await f.shares[0].arrayBuffer())]).toEqual([
			80, 75, 7,
		]);
		expect(model.snapshot().transfer.kind).toBe("handoff-attempted");
		model.dispose();
	});
	it("cancels an in-flight export before late bytes can create a prepared File", async () => {
		const f = fixture(),
			gate =
				deferred<
					Awaited<
						ReturnType<TelegramReadonlyRuntimePort["exportProjectTransfer"]>
					>
				>();
		let signal: { readonly aborted: boolean } | undefined;
		f.runtime.exportProjectTransfer = async (_pid, _rid, options) => {
			signal = options?.signal;
			return gate.promise;
		};
		const model = new TelegramReadonlyProjectsSession(
			f.runtime,
			f.fileTransfer,
		);
		await model.start();
		const preparing = model.prepareProject(project);
		f.abort.abort();
		expect(signal?.aborted).toBe(true);
		expect(model.fileSession?.snapshot()).toEqual({ kind: "idle" });
		gate.resolve({
			kind: "ready",
			mimeType: "application/zip",
			filename: "late.interiors",
			bytes: new Uint8Array([1]),
		});
		await preparing;
		expect(model.snapshot().directory).toEqual({ kind: "closed" });
		expect(model.fileSession?.snapshot()).toEqual({ kind: "idle" });
		expect(f.shares).toEqual([]);
	});
	it("prepares only an explicitly read exact raw source as an unverified local file", async () => {
		const f = fixture(),
			model = new TelegramReadonlyProjectsSession(f.runtime, f.fileTransfer);
		await model.start();
		expect(f.calls).toEqual(["list-projects"]);
		await expect(model.prepareSource(f.source)).rejects.toThrow();
		const rows = await model.sourceRecovery.listRecoverySources();
		const source = await model.sourceRecovery.readRecoverySource(
			rows[0].projectId,
			rows[0].revisionId,
		);
		if (!source) throw new Error("Missing controlled source");
		await model.prepareSource({ ...source });
		const state = model.fileSession?.snapshot();
		if (state?.kind !== "prepared" || !state.prepared)
			throw new Error("Missing local source File");
		expect(state.prepared.fileKind).toBe("unverified-source");
		expect(JSON.parse(await state.prepared.file.text()).serializedProject).toBe(
			f.source.serializedProject,
		);
		expect(f.shares).toEqual([]);
		await expect(model.prepareSource(source)).rejects.toThrow();
		model.dispose();
	});
	it("does not let an older raw read replace a newer prepared Project file", async () => {
		const f = fixture(),
			gate = deferred<UnverifiedProjectSource | undefined>();
		f.runtime.sourceRecovery.readRecoverySource = async () => gate.promise;
		const model = new TelegramReadonlyProjectsSession(
			f.runtime,
			f.fileTransfer,
		);
		await model.start();
		const reading = model.sourceRecovery.readRecoverySource(
			f.source.projectId,
			f.source.revisionId,
		);
		expect(await model.prepareProject(project)).toBe(true);
		const prepared = model.fileSession?.snapshot();
		gate.resolve(f.source);
		expect(await reading).toBeUndefined();
		await expect(model.prepareSource(f.source)).rejects.toThrow();
		expect(model.fileSession?.snapshot()).toBe(prepared);
		model.dispose();
	});
	it("reports only fixed problem codes and abort can reenter the reporter safely", async () => {
		const f = fixture(),
			problems: string[] = [];
		f.runtime.listProjects = async () => {
			throw new Error("PRIVATE_DATABASE_CONTENT");
		};
		const model = new TelegramReadonlyProjectsSession(
			f.runtime,
			f.fileTransfer,
			{
				onProblem(code) {
					problems.push(code);
					f.abort.abort();
				},
			},
		);
		await model.start();
		expect(problems).toEqual(["source-unavailable"]);
		expect(model.snapshot().directory).toEqual({ kind: "closed" });
		expect(JSON.stringify(model.snapshot())).not.toContain(
			"PRIVATE_DATABASE_CONTENT",
		);
	});
	it("isolates observer failures and permanently revokes subscriptions on dispose", async () => {
		const f = fixture(),
			model = new TelegramReadonlyProjectsSession(f.runtime, f.fileTransfer),
			seen: string[] = [];
		model.subscribe(() => {
			throw new Error("observer");
		});
		const stop = model.subscribe(() => {
			seen.push(model.snapshot().directory.kind);
		});
		await model.start();
		expect(seen).toEqual(["directory"]);
		stop();
		model.dispose();
		f.abort.abort();
		model.subscribe(() => seen.push("late"));
		expect(seen).toEqual(["directory"]);
	});
});

describe("readonly host navigation contract", () => {
	function host(closingThrows = false) {
		const visible: boolean[] = [],
			closing: boolean[] = [],
			callbacks: (() => void)[] = [];
		let stops = 0;
		const port: HostNavigationPort = {
			subscribeBack(callback) {
				callbacks.push(callback);
				return () => {
					stops++;
					callback();
				};
			},
			setBackVisible(value) {
				visible.push(value);
			},
			setClosingConfirmation(value) {
				if (closingThrows) throw new Error("unsupported");
				closing.push(value);
			},
			close: noop,
		};
		return { port, visible, closing, callbacks, stops: () => stops };
	}
	it("offers Back without a draft warning and revokes before a reentrant unsubscribe", () => {
		const h = host();
		let exits = 0;
		const stop = connectTelegramReadonlyNavigation(h.port, () => {
			exits++;
		});
		expect(h.closing).toEqual([false]);
		expect(h.visible).toEqual([true]);
		h.callbacks[0]();
		expect(exits).toBe(1);
		stop();
		stop();
		h.callbacks[0]();
		expect(exits).toBe(1);
		expect(h.stops()).toBe(1);
		expect(h.visible).toEqual([true, false]);
	});
	it("does not let an optional closing feature failure disable Back and ignores retired owners", () => {
		const h = host(true);
		let current = true,
			exits = 0;
		const stop = connectTelegramReadonlyNavigation(
			h.port,
			() => {
				exits++;
			},
			() => current,
		);
		h.callbacks[0]();
		expect(exits).toBe(1);
		current = false;
		h.callbacks[0]();
		expect(exits).toBe(1);
		stop();
	});
});
