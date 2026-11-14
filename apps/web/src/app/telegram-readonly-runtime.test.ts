import { describe, expect, it } from "@rstest/core";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import { approveReadableTelegramRelease } from "./telegram-readable-release";
import { createTelegramReadonlyRuntime } from "./telegram-readonly-runtime";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
function fixture() {
	const scope = `tma-v1-${"a".repeat(64)}` as VerifiedTelegramScope;
	const manifest = {
		appBuildId: "actual-shell",
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		projectSchemas: { readable: [1, 2], writable: [2] },
		minimumCapabilities: ["indexeddb" as const],
		version: 1 as const,
		workerProtocolVersion: 1 as const,
	};
	const approved = approveReadableTelegramRelease({
		capsule: {
			deliveryTarget: "telegram",
			entryPath: "/main.12345678.js",
			manifest,
		},
		loadedEntryPath: "/main.12345678.js",
		capabilities: { indexeddb: true, webgl2: false },
		secureContext: true,
		hasControllingWorker: false,
		workerManifest: undefined,
	});
	if (approved.kind !== "approved")
		throw new Error("Actual permit fixture must be valid");
	const sourceController = new AbortController();
	const calls: unknown[][] = [];
	const ready = {
		kind: "ready" as const,
		bytes: new Uint8Array([1, 2, 3]),
		filename: "actual.interiors",
		mimeType: "application/zip" as const,
	};
	const source = {
		scope,
		signal: sourceController.signal,
		sourceRecovery: {
			async listRecoverySources() {
				calls.push(["listRaw"]);
				return [
					{
						kind: "unverified-source" as const,
						projectId: "p",
						revisionId: "r",
					},
				];
			},
			async readRecoverySource(projectId: string, revisionId: string) {
				calls.push(["readRaw", projectId, revisionId]);
				return {
					kind: "unverified-source" as const,
					projectId,
					revisionId,
					serializedProject: "original",
				};
			},
		},
		async listProjects() {
			calls.push(["list"]);
			return { kind: "empty" as const };
		},
		async exportPortableBackup(
			projectId: string,
			revisionId: string,
			signal?: { readonly aborted: boolean },
		) {
			calls.push(["export", projectId, revisionId, signal]);
			return ready;
		},
		async dispose() {
			calls.push(["dispose"]);
			sourceController.abort();
		},
	};
	const state = {
		capabilities: { indexeddb: true, webgl2: false },
		worker: {
			hasControllingWorker: false,
			workerManifest: undefined as unknown,
		},
		readWorker: undefined as
			| undefined
			| ((signal: AbortSignal) => Promise<{
					hasControllingWorker: boolean;
					workerManifest: unknown;
			  }>),
		readCapabilities: undefined as
			| undefined
			| (() => { indexeddb: boolean; webgl2: boolean }),
	};
	const dependencies = {
		approval: approved.approval,
		scope,
		source,
		context: {
			secureContext: true,
			readCapabilities: () =>
				state.readCapabilities ? state.readCapabilities() : state.capabilities,
			readWorker: async (signal: AbortSignal) =>
				state.readWorker ? state.readWorker(signal) : state.worker,
		},
	};
	return { dependencies, source, calls, state, ready, sourceController };
}

describe("Telegram existing-only readonly runtime admission", () => {
	it("keeps every source path closed before start, then forwards exact readonly identities and cancellation", async () => {
		const f = fixture();
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(f.calls).toEqual([]);
		await expectRefusal(runtime.listProjects());
		await expectRefusal(runtime.sourceRecovery.listRecoverySources());
		await expectRefusal(runtime.sourceRecovery.readRecoverySource("p", "r"));
		await expectRefusal(runtime.exportProjectTransfer("p", "r"));
		expect(f.calls).toEqual([]);
		expect(await expectCompleted(runtime.start())).toBe(true);
		expect(await expectCompleted(runtime.listProjects())).toEqual({
			kind: "empty",
		});
		expect(
			await expectCompleted(runtime.sourceRecovery.listRecoverySources()),
		).toEqual([{ kind: "unverified-source", projectId: "p", revisionId: "r" }]);
		expect(
			await expectCompleted(
				runtime.sourceRecovery.readRecoverySource("p", "r"),
			),
		).toEqual({
			kind: "unverified-source",
			projectId: "p",
			revisionId: "r",
			serializedProject: "original",
		});
		const signal = new AbortController().signal;
		expect(
			await expectCompleted(
				runtime.exportProjectTransfer("p", "r", { signal }),
			),
		).toBe(f.ready);
		expect(f.calls).toEqual([
			["list"],
			["listRaw"],
			["readRaw", "p", "r"],
			["export", "p", "r", signal],
		]);
		await expectCompleted(runtime.dispose());
	});
	it("revokes synchronously and drains a held startup without admitting a late worker result", async () => {
		const f = fixture();
		const held = deferred<{
			hasControllingWorker: boolean;
			workerManifest: unknown;
		}>();
		let entered = false;
		f.state.readWorker = async () => {
			entered = true;
			return held.promise;
		};
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		const start = runtime.start();
		expect(entered).toBe(true);
		let reentrant: Promise<void> | undefined;
		runtime.signal.addEventListener("abort", () => {
			reentrant = runtime.dispose();
		});
		const drain = runtime.dispose();
		expect(runtime.signal.aborted).toBe(true);
		expect(f.source.signal.aborted).toBe(true);
		expect(reentrant).toBe(drain);
		expect(runtime.dispose()).toBe(drain);
		let drained = false;
		void drain.then(() => {
			drained = true;
		});
		await Promise.resolve();
		expect(drained).toBe(false);
		held.resolve({ hasControllingWorker: false, workerManifest: undefined });
		expect(await expectCompleted(start)).toBe(false);
		await expectCompleted(drain);
		expect(await expectCompleted(runtime.start())).toBe(false);
		expect(f.calls).toEqual([["dispose"]]);
	});
	it("detects a changed actual context before source access and permanently closes that generation", async () => {
		const f = fixture();
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		f.state.capabilities.indexeddb = false;
		await expectRefusal(runtime.listProjects());
		expect(runtime.signal.aborted).toBe(true);
		expect(f.calls).toEqual([["dispose"]]);
		f.state.capabilities.indexeddb = true;
		expect(await expectCompleted(runtime.start())).toBe(false);
		await expectCompleted(runtime.dispose());
	});
	it("discards a held export if the actual controlling worker changes before delivery", async () => {
		const f = fixture();
		const held = deferred<typeof f.ready>();
		let entered = false;
		f.source.exportPortableBackup = async () => {
			entered = true;
			return held.promise;
		};
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		const exporting = runtime.exportProjectTransfer("p", "r");
		for (let i = 0; i < 8 && !entered; i++) await Promise.resolve();
		expect(entered).toBe(true);
		f.state.worker = {
			hasControllingWorker: true,
			workerManifest: {
				...f.dependencies.approval.manifest,
				appBuildId: "new-worker",
			},
		};
		held.resolve(f.ready);
		await expectRefusal(exporting);
		expect(runtime.signal.aborted).toBe(true);
		await expectCompleted(runtime.dispose());
	});
	it("relays source revocation synchronously and never starts later source work", async () => {
		const f = fixture();
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		f.sourceController.abort();
		expect(runtime.signal.aborted).toBe(true);
		await expectRefusal(runtime.sourceRecovery.readRecoverySource("p", "r"));
		await expectCompleted(runtime.dispose());
		expect(f.calls).toEqual([["dispose"]]);
	});
	it("fails startup closed on actual worker or capability inspection failure", async () => {
		for (const fault of ["worker", "capabilities"] as const) {
			const f = fixture();
			if (fault === "worker")
				f.state.readWorker = async () => {
					throw new Error("worker unavailable");
				};
			else
				f.state.readCapabilities = () => {
					throw new Error("capabilities unavailable");
				};
			const runtime = createTelegramReadonlyRuntime(f.dependencies);
			expect(await expectCompleted(runtime.start())).toBe(false);
			expect(runtime.signal.aborted).toBe(true);
			await expectCompleted(runtime.dispose());
			expect(f.calls).toEqual([["dispose"]]);
		}
	});
	it("rejects copied approval and foreign source scope before touching source data", () => {
		const f = fixture();
		expect(() =>
			createTelegramReadonlyRuntime({
				...f.dependencies,
				approval: { ...f.dependencies.approval },
			}),
		).toThrow();
		expect(() =>
			createTelegramReadonlyRuntime({
				...f.dependencies,
				source: {
					...f.source,
					scope: `tma-v1-${"b".repeat(64)}` as VerifiedTelegramScope,
				},
			}),
		).toThrow();
		expect(f.calls).toEqual([]);
	});
	it("reads capabilities after awaited worker inspection and refuses reentrant revocation during metadata checks", async () => {
		const f = fixture();
		const held = deferred<{
			hasControllingWorker: boolean;
			workerManifest: unknown;
		}>();
		f.state.readWorker = async () => held.promise;
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		const starting = runtime.start();
		f.state.capabilities.indexeddb = false;
		held.resolve({ hasControllingWorker: false, workerManifest: undefined });
		expect(await expectCompleted(starting)).toBe(false);
		expect(runtime.signal.aborted).toBe(true);
		await expectCompleted(runtime.dispose());
		const g = fixture();
		const next = createTelegramReadonlyRuntime(g.dependencies);
		g.state.readWorker = async () => ({
			get hasControllingWorker() {
				void next.dispose();
				return false;
			},
			workerManifest: undefined,
		});
		expect(await expectCompleted(next.start())).toBe(false);
		expect(next.signal.aborted).toBe(true);
		await expectCompleted(next.dispose());
	});
	it("does not enter source after revocation queued between admission and its continuation", async () => {
		const f = fixture();
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		f.state.readCapabilities = () => {
			queueMicrotask(() => f.sourceController.abort());
			return { indexeddb: true, webgl2: false };
		};
		await expectRefusal(runtime.listProjects());
		await expectCompleted(runtime.dispose());
		expect(f.calls).toEqual([["dispose"]]);
	});
	it("publishes the one-flight start promise before a worker port can reenter start", async () => {
		const f = fixture();
		let reads = 0;
		let reentrant: Promise<boolean> | undefined;
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		f.state.readWorker = async () => {
			if (++reads === 1) reentrant = runtime.start();
			return f.state.worker;
		};
		const starting = runtime.start();
		expect(reentrant).toBe(starting);
		expect(await expectCompleted(starting)).toBe(true);
		expect(reads).toBe(1);
		await expectCompleted(runtime.dispose());
	});
	it("drains a held operation before propagating exact source disposal throws or rejections", async () => {
		const successfulClose = fixture();
		const heldClose = deferred<void>();
		successfulClose.source.dispose = async () => {
			successfulClose.sourceController.abort();
			return heldClose.promise;
		};
		const successfulRuntime = createTelegramReadonlyRuntime(
			successfulClose.dependencies,
		);
		expect(await expectCompleted(successfulRuntime.start())).toBe(true);
		const successfulDrain = successfulRuntime.dispose();
		try {
			expect((await observe(successfulDrain)).kind).toBe("pending");
		} finally {
			heldClose.resolve();
		}
		await expectCompleted(successfulDrain);
		for (const failure of ["throw-undefined", "reject-object"] as const) {
			const f = fixture(),
				held = deferred<{ kind: "empty" }>(),
				entered = deferred<void>();
			f.source.listProjects = async () => {
				entered.resolve();
				return held.promise;
			};
			const reason =
				failure === "throw-undefined" ? undefined : { nativeClose: "failed" };
			f.source.dispose = () => {
				f.sourceController.abort();
				if (failure === "throw-undefined") throw reason;
				return Promise.reject(reason);
			};
			const runtime = createTelegramReadonlyRuntime(f.dependencies);
			expect(await expectCompleted(runtime.start())).toBe(true);
			const reading = runtime.listProjects();
			const rejectedReading = expectRefusal(reading);
			await requireEntered(entered.promise, reading);
			const drain = runtime.dispose();
			let settled = false;
			const observed = drain.then(
				() => {
					settled = true;
					return { kind: "resolved" as const };
				},
				(error) => {
					settled = true;
					return { kind: "rejected" as const, error };
				},
			);
			expect(runtime.signal.aborted).toBe(true);
			expect(runtime.dispose()).toBe(drain);
			await Promise.resolve();
			expect(settled).toBe(false);
			held.resolve({ kind: "empty" });
			await expectCompleted(rejectedReading);
			const outcome = await expectCompleted(observed);
			expect(outcome.kind).toBe("rejected");
			if (outcome.kind === "rejected") expect(outcome.error).toBe(reason);
		}
	});
	it("returns exact cancellation without source export for a pre-aborted file operation and keeps reads admitted", async () => {
		const f = fixture();
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		const signal = new AbortController();
		signal.abort();
		expect(
			await expectCompleted(
				runtime.exportProjectTransfer("p", "r", { signal: signal.signal }),
			),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
		expect(f.calls).toEqual([]);
		expect(runtime.signal.aborted).toBe(false);
		expect(await expectCompleted(runtime.listProjects())).toEqual({
			kind: "empty",
		});
		await expectCompleted(runtime.dispose());
	});
	it("discards late prepared bytes after per-file cancellation without revoking the readonly runtime", async () => {
		const f = fixture(),
			held = deferred<typeof f.ready>(),
			entered = deferred<void>(),
			signal = new AbortController();
		f.source.exportPortableBackup = async (_p, _r, actualSignal) => {
			expect(actualSignal).toBe(signal.signal);
			entered.resolve();
			return held.promise;
		};
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		const exporting = runtime.exportProjectTransfer("p", "r", {
			signal: signal.signal,
		});
		await requireEntered(entered.promise, exporting);
		signal.abort();
		held.resolve(f.ready);
		expect(await expectCompleted(exporting)).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_CANCELLED",
		});
		expect(runtime.signal.aborted).toBe(false);
		expect(await expectCompleted(runtime.listProjects())).toEqual({
			kind: "empty",
		});
		await expectCompleted(runtime.dispose());
	});
	it("accepts explicitly empty export options and forwards the expected Revision without inventing a cancellation signal", async () => {
		const f = fixture();
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		expect(
			await expectCompleted(
				runtime.exportProjectTransfer("exact-project", "exact-revision", {}),
			),
		).toBe(f.ready);
		expect(f.calls).toEqual([
			["export", "exact-project", "exact-revision", undefined],
		]);
		await expectCompleted(runtime.dispose());
	});
	it("rejects malformed but equally supplied source and runtime scopes before any source operation", () => {
		for (const scope of [
			"not-a-telegram-scope",
			`prefix-tma-v1-${"a".repeat(64)}`,
			`tma-v1-${"a".repeat(64)}-suffix`,
			`tma-v1-${"A".repeat(64)}`,
			[`tma-v1-${"a".repeat(64)}`],
			null,
		]) {
			const f = fixture();
			Reflect.set(f.dependencies, "scope", scope);
			Reflect.set(f.source, "scope", scope);
			expect(() => createTelegramReadonlyRuntime(f.dependencies)).toThrow();
			expect(f.calls).toEqual([]);
		}
	});
	it("owns synchronous revocation even when its source was already revoked at construction", async () => {
		const f = fixture();
		f.sourceController.abort();
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(runtime.signal.aborted).toBe(true);
		expect(await expectCompleted(runtime.start())).toBe(false);
		await expectCompleted(runtime.dispose());
		expect(f.calls).toEqual([["dispose"]]);
	});
	it("refuses a late source entry after own revocation even if source close fails before aborting its signal", async () => {
		const f = fixture();
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		const worker = deferred<{
				hasControllingWorker: boolean;
				workerManifest: unknown;
			}>(),
			entered = deferred<void>();
		f.state.readWorker = async () => {
			entered.resolve();
			return worker.promise;
		};
		const reading = runtime.listProjects();
		const denied = expectRefusal(reading);
		await requireEntered(entered.promise, reading);
		const closeError = { close: "failed-before-signal" };
		f.source.dispose = () => {
			throw closeError;
		};
		const disposing = runtime.dispose();
		const close = expectExactRejection(disposing, closeError);
		expect(runtime.signal.aborted).toBe(true);
		expect(f.source.signal.aborted).toBe(false);
		worker.resolve(f.state.worker);
		await expectCompleted(denied);
		await expectCompleted(close);
		expect(f.calls).toEqual([]);
	});
	it("checks own revocation at both continuation boundaries when native source close itself fails", async () => {
		for (const stage of ["before-source", "after-source"] as const) {
			const f = fixture(),
				closeError = { close: stage };
			f.source.dispose = () => {
				throw closeError;
			};
			const runtime = createTelegramReadonlyRuntime(f.dependencies);
			expect(await expectCompleted(runtime.start())).toBe(true);
			let reads = 0;
			f.state.readCapabilities = () => {
				if (++reads === (stage === "before-source" ? 1 : 2))
					queueMicrotask(() => {
						void runtime.dispose().catch(() => undefined);
					});
				return { indexeddb: true, webgl2: false };
			};
			await expectRefusal(runtime.listProjects());
			expect(runtime.signal.aborted).toBe(true);
			expect(f.source.signal.aborted).toBe(false);
			expect(f.calls).toEqual(stage === "before-source" ? [] : [["list"]]);
			await expectExactRejection(runtime.dispose(), closeError);
		}
	});
	it("never reports admitted start after a reentrant own close whose source did not abort", async () => {
		const f = fixture(),
			closeError = { close: "during-start" };
		f.source.dispose = () => {
			throw closeError;
		};
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		f.state.readWorker = async () => ({
			get hasControllingWorker() {
				void runtime.dispose().catch(() => undefined);
				return false;
			},
			workerManifest: undefined,
		});
		expect(await expectCompleted(runtime.start())).toBe(false);
		expect(runtime.signal.aborted).toBe(true);
		expect(f.source.signal.aborted).toBe(false);
		await expectExactRejection(runtime.dispose(), closeError);
		expect(f.calls).toEqual([]);
	});
	it("does not start another worker inspection after an already running source operation drains under failed close", async () => {
		const f = fixture(),
			closeError = { close: "before-child-abort" },
			held = deferred<{ kind: "empty" }>(),
			entered = deferred<void>();
		let inspections = 0;
		f.source.listProjects = async () => {
			entered.resolve();
			return held.promise;
		};
		f.source.dispose = () => {
			throw closeError;
		};
		f.state.readWorker = async () => {
			inspections++;
			return f.state.worker;
		};
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		expect(await expectCompleted(runtime.start())).toBe(true);
		const reading = runtime.listProjects();
		const denied = expectRefusal(reading);
		await requireEntered(entered.promise, reading);
		const disposal = runtime.dispose(),
			failed = expectExactRejection(disposal, closeError);
		held.resolve({ kind: "empty" });
		await expectCompleted(denied);
		await expectCompleted(failed);
		expect(inspections).toBe(2);
		expect(f.calls).toEqual([]);
	});
	it("does not publish start admission after a queued own revocation between its final readability result and continuation", async () => {
		const f = fixture(),
			closeError = { close: "start-continuation" };
		f.source.dispose = () => {
			throw closeError;
		};
		const runtime = createTelegramReadonlyRuntime(f.dependencies);
		f.state.readCapabilities = () => {
			queueMicrotask(() => {
				void runtime.dispose().catch(() => undefined);
			});
			return { indexeddb: true, webgl2: false };
		};
		expect(await expectCompleted(runtime.start())).toBe(false);
		expect(runtime.signal.aborted).toBe(true);
		expect(f.source.signal.aborted).toBe(false);
		await expectExactRejection(runtime.dispose(), closeError);
		expect(f.calls).toEqual([]);
	});
});

// Real verification timers remain independent from any application timer doubles.
const observationTimer = globalThis.setTimeout;
const cancelObservationTimer = globalThis.clearTimeout;
type Completion<T> =
	| { readonly kind: "fulfilled"; readonly value: T }
	| { readonly kind: "rejected"; readonly reason: unknown }
	| { readonly kind: "pending" };
function observe<T>(operation: Promise<T>): Promise<Completion<T>> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const settled: Promise<Completion<T>> = operation.then(
		(value) => ({ kind: "fulfilled", value }),
		(reason) => ({ kind: "rejected", reason }),
	);
	const pending = new Promise<Completion<T>>((resolve) => {
		timer = observationTimer(() => resolve({ kind: "pending" }), 750);
	});
	return Promise.race([settled, pending]).finally(() => {
		if (timer !== undefined) cancelObservationTimer(timer);
	});
}
async function expectCompleted<T>(operation: Promise<T>): Promise<T> {
	const result = await observe(operation);
	expect(result.kind).toBe("fulfilled");
	if (result.kind !== "fulfilled")
		throw new Error("Public operation did not fulfill");
	return result.value;
}
function ownedAssertion(operation: () => Promise<void>): Promise<void> {
	const result = operation();
	// A deliberately held read may settle before its later await. Keep the same
	// assertion Promise while observing rejection immediately to avoid detachment.
	void result.catch(() => undefined);
	return result;
}
function expectRefusal(operation: Promise<unknown>): Promise<void> {
	return ownedAssertion(async () => {
		const result = await observe(operation);
		expect(result.kind).toBe("rejected");
		if (result.kind !== "rejected")
			throw new Error("Public operation did not reject");
		expect(result.reason).toBeInstanceOf(Error);
	});
}
function expectExactRejection(
	operation: Promise<unknown>,
	expected: unknown,
): Promise<void> {
	return ownedAssertion(async () => {
		const result = await observe(operation);
		expect(result.kind).toBe("rejected");
		if (result.kind !== "rejected")
			throw new Error("Public operation did not reject");
		expect(result.reason).toBe(expected);
	});
}
async function requireEntered(
	entered: Promise<void>,
	operation: Promise<unknown>,
): Promise<void> {
	const phase = await expectCompleted(
		Promise.race([
			entered.then(() => "entered" as const),
			operation.then(
				() => "completed" as const,
				() => "completed" as const,
			),
		]),
	);
	expect(phase).toBe("entered");
}
