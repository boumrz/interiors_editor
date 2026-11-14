import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { createHostFileBridge } from "../adapters/telegram/host-file-bridge";
import type { ExportPortableBackupResult } from "../application/export-portable-backup";
import type {
	ProjectDirectoryResult,
	ProjectSummary,
	UnverifiedProjectSource,
} from "../application/ports";
import {
	TelegramReadonlyProjectsContent,
	TelegramReadonlyProjectsSession,
	type TelegramReadonlyRuntimePort,
} from "./telegram-readonly-projects";

const row: ProjectSummary = {
	projectId: "p",
	revisionId: "r",
	name: "Room",
	updatedAt: "2026-11-05",
};
const source: UnverifiedProjectSource = {
	kind: "unverified-source",
	projectId: "raw",
	revisionId: "rr",
	serializedProject: " exact raw source \ud800",
};
const ready = (): ExportPortableBackupResult => ({
	kind: "ready",
	mimeType: "application/zip",
	filename: "project.interiors",
	bytes: new Uint8Array([1, 2, 3]),
});
function deferred<T>() {
	let resolve: (value: T) => void = () => undefined,
		reject: (reason: unknown) => void = () => undefined;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}
function fixture() {
	const abort = new AbortController(),
		calls: string[] = [],
		problems: string[] = [],
		shares: File[] = [];
	const runtime: TelegramReadonlyRuntimePort = {
		signal: abort.signal,
		async listProjects() {
			calls.push("list");
			return { kind: "populated", projects: [row] };
		},
		async exportProjectTransfer(pid, rid) {
			calls.push(`export:${pid}:${rid}`);
			return ready();
		},
		sourceRecovery: {
			async listRecoverySources() {
				calls.push("sources");
				const { serializedProject: _, ...address } = source;
				return [address];
			},
			async readRecoverySource() {
				calls.push("source");
				return source;
			},
		},
	};
	const bridge = createHostFileBridge({
		maximumBytes: 1024 * 1024,
		system: {
			canShare: () => true,
			async share(data) {
				if (data.files?.[0]) shares.push(data.files[0]);
			},
		},
	});
	return {
		abort,
		runtime,
		calls,
		problems,
		shares,
		bridge,
		model(file = true) {
			return new TelegramReadonlyProjectsSession(
				runtime,
				file ? bridge : undefined,
				{ onProblem: (problem) => problems.push(problem) },
			);
		},
	};
}
describe("readonly leaf public boundary vectors — UI port doubles", () => {
	it("exposes inert loading/idle snapshots and refuses source/export work before start", async () => {
		const f = fixture(),
			m = f.model();
		expect(m.snapshot()).toEqual({
			directory: { kind: "loading" },
			transfer: { kind: "idle" },
		});
		expect(await m.prepareProject(row)).toBe(false);
		await expect(m.sourceRecovery.listRecoverySources()).rejects.toThrow();
		await expect(
			m.sourceRecovery.readRecoverySource("raw", "rr"),
		).rejects.toThrow();
		expect(f.calls).toEqual([]);
		m.dispose();
	});
	it("keeps ordinary list failure unavailable and reports a fixed source code without reentrant abort", async () => {
		const f = fixture();
		f.runtime.listProjects = async () => {
			throw new Error("PRIVATE");
		};
		const m = f.model();
		await m.start();
		expect(m.snapshot().directory).toEqual({ kind: "unavailable" });
		expect(m.snapshot().transfer).toEqual({ kind: "idle" });
		expect(f.problems).toEqual(["source-unavailable"]);
		expect(await m.prepareProject(row)).toBe(false);
		expect(f.calls).toEqual([]);
		m.dispose();
	});
	it("copies populated rows and recovery flag, and retains empty/recovery outcomes without aliasing", async () => {
		for (const kind of ["populated", "empty", "recovery"] as const) {
			const f = fixture(),
				mutable = { ...row },
				input: ProjectDirectoryResult =
					kind === "populated"
						? { kind: "populated", projects: [mutable], recoveryNeeded: true }
						: kind === "empty"
							? { kind: "empty" }
							: { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
			f.runtime.listProjects = async () => input;
			const m = f.model();
			await m.start();
			mutable.name = "Changed";
			const out = m.snapshot().directory;
			expect(out).toEqual({
				kind: "directory",
				directory:
					kind === "populated"
						? { kind: "populated", projects: [row], recoveryNeeded: true }
						: input,
			});
			if (out.kind === "directory" && out.directory.kind === "populated") {
				expect(Object.isFrozen(out.directory.projects)).toBe(true);
				expect(Object.isFrozen(out.directory.projects[0])).toBe(true);
			}
			expect(await m.prepareProject({ ...row, projectId: "another" })).toBe(
				false,
			);
			m.dispose();
		}
	});
	it("requires a matching Project among several listed rows and requires actual file delivery", async () => {
		const f = fixture();
		f.runtime.listProjects = async () => ({
			kind: "populated",
			projects: [{ ...row, projectId: "other" }, row],
		});
		const m = f.model();
		await m.start();
		expect(await m.prepareProject(row)).toBe(true);
		const state = m.fileSession?.snapshot();
		expect(state?.kind).toBe("prepared");
		if (state?.kind !== "prepared") throw new Error("Missing prepared File");
		expect(state.prepared?.fileKind).toBe("portable-backup");
		m.dispose();
		const missing = f.model(false);
		await missing.start();
		expect(await missing.prepareProject(row)).toBe(false);
		expect(f.problems).toEqual(["file-unavailable"]);
		missing.dispose();
	});
	it("rejects every mismatched raw source address and undefined source before creating a ticket", async () => {
		for (const value of [
			undefined,
			{ ...source, projectId: "other" },
			{ ...source, revisionId: "other" },
		]) {
			const f = fixture();
			f.runtime.sourceRecovery.readRecoverySource = async () => value;
			const m = f.model();
			await m.start();
			expect(
				await m.sourceRecovery.readRecoverySource("raw", "rr"),
			).toBeUndefined();
			await expect(m.prepareSource(source)).rejects.toThrow();
			expect(m.fileSession?.snapshot()).toEqual({ kind: "idle" });
			m.dispose();
		}
	});
	it("binds a selected raw ticket to Project, Revision and exact content independently", async () => {
		for (const change of [
			{ projectId: "other" },
			{ revisionId: "other" },
			{ serializedProject: "changed" },
		]) {
			const f = fixture(),
				m = f.model();
			await m.start();
			const selected = await m.sourceRecovery.readRecoverySource("raw", "rr");
			if (!selected) throw new Error("Missing selected source");
			await expect(
				m.prepareSource({ ...selected, ...change }),
			).rejects.toThrow();
			expect(m.fileSession?.snapshot()).toEqual({ kind: "idle" });
			await m.prepareSource(selected);
			expect(m.fileSession?.snapshot().kind).toBe("prepared");
			m.dispose();
		}
	});
	it("sanitizes active raw list/read failures into fixed source diagnostics", async () => {
		for (const operation of ["list", "read"] as const) {
			const f = fixture();
			f.runtime.sourceRecovery.listRecoverySources = async () => {
				throw new Error("PRIVATE_LIST");
			};
			f.runtime.sourceRecovery.readRecoverySource = async () => {
				throw new Error("PRIVATE_SOURCE");
			};
			const m = f.model();
			await m.start();
			const work =
				operation === "list"
					? m.sourceRecovery.listRecoverySources()
					: m.sourceRecovery.readRecoverySource("raw", "rr");
			await expect(work).rejects.toThrow();
			expect(f.problems).toEqual(["source-unavailable"]);
			expect(JSON.stringify(m.snapshot())).not.toContain("PRIVATE");
			m.dispose();
		}
	});
	it("does not report an old rejected raw read after a newer Project file intent wins", async () => {
		const f = fixture(),
			gate = deferred<UnverifiedProjectSource | undefined>();
		f.runtime.sourceRecovery.readRecoverySource = async () => gate.promise;
		const m = f.model();
		await m.start();
		const reading = m.sourceRecovery.readRecoverySource("raw", "rr");
		const caught = reading.catch(() => undefined);
		expect(await m.prepareProject(row)).toBe(true);
		gate.reject(new Error("PRIVATE_LATE"));
		await caught;
		expect(f.problems).toEqual([]);
		expect(m.fileSession?.snapshot().kind).toBe("prepared");
		m.dispose();
	});
	it("does not let a later raw ticket be overwritten by an earlier successful read", async () => {
		const f = fixture(),
			gate = deferred<UnverifiedProjectSource | undefined>();
		let reads = 0;
		f.runtime.sourceRecovery.readRecoverySource = async () =>
			++reads === 1 ? gate.promise : source;
		const m = f.model();
		await m.start();
		const old = m.sourceRecovery.readRecoverySource("raw", "rr"),
			current = await m.sourceRecovery.readRecoverySource("raw", "rr");
		gate.resolve(source);
		expect(await old).toBeUndefined();
		if (!current) throw new Error("No current source");
		await m.prepareSource(current);
		expect(m.fileSession?.snapshot().kind).toBe("prepared");
		m.dispose();
	});
	it("reports one backup availability result for rejected and throwing exports without duplicate file failures", async () => {
		for (const failure of ["reject", "throw"] as const) {
			const f = fixture();
			f.runtime.exportProjectTransfer = async () => {
				if (failure === "throw") throw new Error("PRIVATE_EXPORT");
				return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" };
			};
			const m = f.model();
			await m.start();
			expect(await m.prepareProject(row)).toBe(false);
			expect(f.problems).toEqual(["backup-unavailable"]);
			expect(m.fileSession?.snapshot().kind).toBe("failed");
			m.dispose();
		}
	});
	it("reports local file preparation failure separately from backup admission", async () => {
		const f = fixture(),
			bridge = createHostFileBridge({ maximumBytes: 1, system: {} }),
			m = new TelegramReadonlyProjectsSession(f.runtime, bridge, {
				onProblem: (p) => f.problems.push(p),
			});
		await m.start();
		expect(await m.prepareProject(row)).toBe(false);
		expect(f.problems).toEqual(["file-unavailable"]);
		expect(m.fileSession?.snapshot().kind).toBe("failed");
		m.dispose();
	});
	it("reports unsupported and failed actual local handoff independently from preparation", async () => {
		for (const failed of [false, true]) {
			const f = fixture(),
				bridge = createHostFileBridge({
					maximumBytes: 1024,
					system: failed
						? {
								canShare: () => true,
								async share() {
									throw new Error("PRIVATE_SHARE");
								},
							}
						: {},
				}),
				m = new TelegramReadonlyProjectsSession(f.runtime, bridge, {
					onProblem: (p) => f.problems.push(p),
				});
			await m.start();
			expect(await m.prepareProject(row)).toBe(true);
			expect(f.problems).toEqual([]);
			await m.fileSession?.handoff();
			expect(m.fileSession?.snapshot().kind).toBe(
				failed ? "failed" : "unsupported",
			);
			expect(f.problems).toEqual(["file-unavailable"]);
			m.dispose();
		}
	});
	it("revokes a pending source query and reports no stale problem after abort", async () => {
		for (const operation of ["list", "read"] as const) {
			const f = fixture(),
				gate = deferred<never>();
			f.runtime.sourceRecovery.listRecoverySources = async () => gate.promise;
			f.runtime.sourceRecovery.readRecoverySource = async () => gate.promise;
			const m = f.model();
			await m.start();
			const work =
					operation === "list"
						? m.sourceRecovery.listRecoverySources()
						: m.sourceRecovery.readRecoverySource("raw", "rr"),
				caught = work.catch(() => undefined);
			f.abort.abort();
			gate.reject(new Error("PRIVATE_LATE"));
			await caught;
			expect(f.problems).toEqual([]);
			expect(m.snapshot()).toEqual({
				directory: { kind: "closed" },
				transfer: { kind: "idle" },
			});
			m.dispose();
		}
	});
	it("stops current observer iteration after one subscriber removes another and unsubscribe prevents abort notifications", async () => {
		const f = fixture(),
			m = f.model(),
			seen: string[] = [];
		let remove: () => void = () => undefined;
		m.subscribe(() => {
			seen.push("first");
			remove();
		});
		remove = m.subscribe(() => seen.push("removed"));
		const stop = m.subscribe(() => seen.push("last"));
		await m.start();
		expect(seen).toEqual(["first", "last"]);
		stop();
		f.abort.abort();
		expect(seen).toEqual(["first", "last", "first"]);
		m.dispose();
	});
	it("does not notify observers during dispose and refuses subscriptions on a closed generation", async () => {
		const f = fixture(),
			m = f.model(),
			seen: string[] = [];
		await m.start();
		m.subscribe(() => seen.push("unexpected"));
		m.dispose();
		m.subscribe(() => seen.push("late"));
		f.abort.abort();
		expect(seen).toEqual([]);
		expect(m.snapshot()).toEqual({
			directory: { kind: "closed" },
			transfer: { kind: "idle" },
		});
		expect(await m.prepareProject(row)).toBe(false);
	});
	it("presents loading/closed/recovery and enabled/busy file controls as distinct semantic states", () => {
		const common = {
			fileAvailable: true,
			onPrepareProject: () => undefined,
			onRetry: () => undefined,
			onExit: () => undefined,
		};
		const loading = renderToStaticMarkup(
				<TelegramReadonlyProjectsContent
					{...common}
					state={{ kind: "loading" }}
				/>,
			),
			empty = renderToStaticMarkup(
				<TelegramReadonlyProjectsContent
					{...common}
					state={{ kind: "directory", directory: { kind: "empty" } }}
				/>,
			),
			closed = renderToStaticMarkup(
				<TelegramReadonlyProjectsContent
					{...common}
					state={{ kind: "closed" }}
				/>,
			);
		expect(loading).toContain('aria-busy="true"');
		expect(empty).toContain('aria-busy="false"');
		expect(empty).not.toContain("Часть локальных данных");
		expect(closed).toContain("Просмотр данных завершён");
		expect(closed).not.toContain("Непроверенные исходники");
		for (const busy of [false, true]) {
			const html = renderToStaticMarkup(
				<TelegramReadonlyProjectsContent
					{...common}
					busy={busy}
					state={{
						kind: "directory",
						directory: { kind: "populated", projects: [row] },
					}}
					sourceRecovery={<aside>Controlled raw region</aside>}
				/>,
			);
			expect(html).toContain("Controlled raw region");
			expect(/<fieldset[^>]*disabled/.test(html)).toBe(busy);
			expect(
				/<button[^>]*disabled[^>]*>Подготовить файл проекта/.test(html),
			).toBe(busy);
			expect(html).not.toContain("Часть локальных данных");
		}
	});
});
