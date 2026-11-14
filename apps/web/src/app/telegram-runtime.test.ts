import { describe, expect, it } from "@rstest/core";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import { ProjectController } from "./project-controller";
import type { ReleaseManifest } from "./release-startup";
import {
	approveTelegramRelease,
	type ApprovedTelegramRelease,
} from "./telegram-release-preflight";
import {
	createTelegramRuntime,
	type TelegramRuntimeDependencies,
} from "./telegram-runtime";

const scope = `tma-v1-${"a".repeat(64)}` as VerifiedTelegramScope;
const manifest: ReleaseManifest = {
	appBuildId: "0123456789abcdef",
	assetSchemas: { readable: [1], writable: [1] },
	catalogSchemas: { readable: [1], writable: [1] },
	minimumCapabilities: ["indexeddb", "webgl2"],
	projectSchemas: { readable: [1], writable: [1] },
	version: 1,
	workerProtocolVersion: 1,
};

function approval() {
	const result = approveTelegramRelease({
		capsule: {
			deliveryTarget: "telegram",
			entryPath: "/main.12345678.js",
			manifest,
		},
		loadedEntryPath: "/main.12345678.js",
		capabilities: { indexeddb: true, webgl2: true },
		secureContext: true,
		webLocks: true,
		hasControllingWorker: false,
		workerManifest: undefined,
	});
	if (result.kind !== "approved")
		throw new Error("Expected actual preflight permit");
	return result.approval;
}

function memory() {
	const values = new Map<string, string>();
	let reads = 0;
	let writes = 0;
	return {
		values,
		get reads() {
			return reads;
		},
		get writes() {
			return writes;
		},
		getItem(key: string) {
			reads++;
			return values.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			writes++;
			values.set(key, value);
		},
	};
}

/** Keep a wrong asynchronous return observed while asserting the real public
 * synchronous contract. The original return is preserved, so a Promise still
 * fails the value/throw assertion rather than becoming a detached rejection. */
function observeUnexpectedAsync<T>(value: T): T {
 if (value && (typeof value === "object" || typeof value === "function") && typeof Reflect.get(value, "then") === "function") void Promise.resolve(value).catch(() => undefined);
 return value;
}

function fixture() {
	const local = memory();
	const session = memory();
	const effects = {
		opens: 0,
		locks: 0,
		uuid: 0,
		codec: 0,
		capabilities: 0,
		worker: 0,
	};
	let id = 0;
	const dependencies: TelegramRuntimeDependencies = {
		approval: approval(),
		scope,
		context: {
			indexedDb: {
				open() {
					effects.opens++;
					throw new Error("No native IDB in this unit fixture");
				},
			},
			locks: {
				request() {
					effects.locks++;
					throw new Error("No native lock in this unit fixture");
				},
			},
			secureContext: true,
			crypto: {
				randomUUID() {
					effects.uuid++;
					return crypto.randomUUID();
				},
				getRandomValues: (bytes) => crypto.getRandomValues(bytes),
			},
			sessionStorage: session,
			localStorage: local,
			readCapabilities() {
				effects.capabilities++;
				return { indexeddb: true, webgl2: true };
			},
			async readWorker() {
				effects.worker++;
				return { hasControllingWorker: false, workerManifest: undefined };
			},
		},
		ports: {
			clock: { now: () => "2026-11-04T17:00:00.000Z" },
			ids: { next: () => `id-${++id}` },
			checksum: {
				async sha256(value) {
					return hex(
						await crypto.subtle.digest(
							"SHA-256",
							new TextEncoder().encode(value),
						),
					);
				},
			},
			binaryChecksum: {
				async sha256Bytes(value) {
					return hex(
						await crypto.subtle.digest("SHA-256", new Uint8Array(value).buffer),
					);
				},
			},
			storageEstimate: { estimateStorage: async () => ({}) },
			portable: {
				writer: {
					async encode() {
						effects.codec++;
						throw new Error("Explicit registered writer fixture");
					},
				},
				feasibility: {
					async assess() {
						return { kind: "accepted" };
					},
				},
				exporter: {
					async execute() {
						effects.codec++;
						throw new Error("Portable exporter route must be explicit");
					},
				},
				encoder: {
					encode() {
						effects.codec++;
						throw new Error("Portable encoder route must be explicit");
					},
				},
				decoder: {
					async decode() {
						effects.codec++;
						return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
					},
				},
				smoke: {
					async verify() {
						effects.codec++;
						return false;
					},
				},
			},
		},
	};
	return { dependencies, effects, local, session };
}

describe("Telegram runtime composition admission", () => {
	it("rejects copied/forged permits and malformed scopes before context, IDs, storage or controller construction", () => {
		for (const invalid of [
			undefined,
			{},
			structuredClone(approval()),
			{ manifest, entryPath: "/main.12345678.js" },
		]) {
			const value = fixture();
			expect(() =>
				createTelegramRuntime({
					...value.dependencies,
					approval: invalid as ApprovedTelegramRelease,
				}),
			).toThrow();
			expect(value.effects).toEqual({
				opens: 0,
				locks: 0,
				uuid: 0,
				codec: 0,
				capabilities: 0,
				worker: 0,
			});
			expect(
				value.local.reads +
					value.local.writes +
					value.session.reads +
					value.session.writes,
			).toBe(0);
		}
		for (const invalid of ["browser", `prefix-${scope}`, `${scope}-suffix`]) {
			const value = fixture();
			expect(() =>
				createTelegramRuntime({
					...value.dependencies,
					scope: invalid as VerifiedTelegramScope,
				}),
			).toThrow();
			expect(value.effects.uuid).toBe(0);
		}
	});

	it("is inert after permitted construction and blocks controller/prefs until startup without touching native storage", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		expect(runtime.controller).toBeInstanceOf(ProjectController);
		expect(runtime.controller.constructor).toBe(ProjectController);
		expect(value.effects).toEqual({
			opens: 0,
			locks: 0,
			uuid: 1,
			codec: 0,
			capabilities: 0,
			worker: 0,
		});
		expect(
			value.local.reads +
				value.local.writes +
				value.session.reads +
				value.session.writes,
		).toBe(0);
		await expect(runtime.controller.create("План")).rejects.toThrow();
		expect(() => runtime.drawingDimensions.read()).toThrow();
		expect(() => runtime.drawingDimensions.write("draft")).toThrow();
		expect(
			value.effects.opens + value.effects.locks + value.effects.codec,
		).toBe(0);
		await expect(
			runtime.sourceRecovery.listRecoverySources(),
		).rejects.toThrow();
		await expect(
			runtime.sourceRecovery.readRecoverySource("p", "r"),
		).rejects.toThrow();
		expect(value.effects.opens + value.effects.locks).toBe(0);
		await runtime.dispose();
	});

	it("accepts a no-worker shell before routing the actual shared controller and scoped preferences", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		const input = await runtime.readReleaseStartupInput();
		expect(input.shellManifest).toBe(value.dependencies.approval.manifest);
		expect(input.hasControllingWorker).toBe(false);
		expect(await runtime.releaseStartup.handshake(input)).toEqual({
			kind: "writable",
		});
		expect(value.effects.opens + value.effects.locks).toBe(0);
		runtime.drawingDimensions.write('{"walls":false}');
		expect(runtime.drawingDimensions.read()).toBe('{"walls":false}');
		expect([...value.local.values.keys()]).toEqual([
			`interiors-tma-context-v1:${scope}:drawing-dimensions`,
		]);
		expect(await runtime.controller.create("План")).toMatchObject({
			kind: "persist-failed",
		});
		expect(value.effects.locks).toBe(1);
		expect(value.effects.opens + value.effects.codec).toBe(0);
		await runtime.dispose();
	});

	it("requires explicit portable writer, feasibility, encoder, decoder and smoke before allocating identity", () => {
		for (const key of [
			"writer",
			"feasibility",
			"encoder",
			"decoder",
			"smoke",
		] as const) {
			const value = fixture();
			const portable = {
				...value.dependencies.ports.portable,
				[key]: undefined,
			};
			expect(() =>
				createTelegramRuntime({
					...value.dependencies,
					ports: {
						...value.dependencies.ports,
						portable:
							portable as TelegramRuntimeDependencies["ports"]["portable"],
					},
				}),
			).toThrow();
			expect(
				value.effects.uuid + value.effects.opens + value.effects.locks,
			).toBe(0);
		}
		for (const [key, invalid] of [
			["writer", {}],
			["writer", { encode: undefined }],
			["writer", { encode: "unsupported" }],
			["feasibility", {}],
			["feasibility", { assess: undefined }],
			["feasibility", { assess: "unsupported" }],
		] as const) {
			const value = fixture();
			const portable = { ...value.dependencies.ports.portable };
			Reflect.set(portable, key, invalid);
			expect(() =>
				createTelegramRuntime({
					...value.dependencies,
					ports: {
						...value.dependencies.ports,
						portable,
					},
				}),
			).toThrow();
			expect(
				value.effects.uuid +
					value.effects.opens +
					value.effects.locks +
					value.effects.codec,
			).toBe(0);
		}
	});

	it("constructs its own scoped exporter and ignores any external optional exporter", async () => {
		for (const external of [undefined, {}, { execute: "unsupported" }]) {
			const value = fixture();
			const portable = { ...value.dependencies.ports.portable };
			Reflect.set(portable, "exporter", external);
			const runtime = createTelegramRuntime({
				...value.dependencies,
				ports: { ...value.dependencies.ports, portable },
			});
			expect(value.effects.uuid).toBe(1);
			expect(
				value.effects.opens + value.effects.locks + value.effects.codec,
			).toBe(0);
			await runtime.dispose();
		}
	});

	it("rejects shell/capability/worker mismatches without DB/recovery and permanently revokes that generation", async () => {
		for (const patch of [
			{ shellManifest: undefined },
			{ shellManifest: { ...manifest, appBuildId: "another-shell" } },
			{ capabilities: { indexeddb: false, webgl2: true } },
			{ capabilities: { indexeddb: true, webgl2: false } },
			{ hasControllingWorker: true, workerManifest: undefined },
			{ hasControllingWorker: false, workerManifest: manifest },
		]) {
			const value = fixture();
			const runtime = createTelegramRuntime(value.dependencies);
			const input = await runtime.readReleaseStartupInput();
			expect(
				await runtime.releaseStartup.handshake({ ...input, ...patch }),
			).toEqual({ kind: "read-only/exportable", recovery: {} });
			expect(runtime.session.signal.aborted).toBe(true);
			expect(await runtime.releaseStartup.handshake(input)).toEqual({
				kind: "read-only/exportable",
				recovery: {},
			});
			await expect(runtime.controller.create("Поздний план")).rejects.toThrow();
			expect(value.effects.opens + value.effects.locks).toBe(0);
			await runtime.dispose();
		}
	});

	it("revokes synchronously and returns one disposal promise that drains admitted work", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		await runtime.releaseStartup.handshake(
			await runtime.readReleaseStartupInput(),
		);
		let entered: (() => void) | undefined;
		let release: (() => void) | undefined;
		const admitted = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		const work = runtime.session.run(async () => {
			entered?.();
			await hold;
		});
		await admitted;
		const first = runtime.dispose();
		expect(runtime.session.signal.aborted).toBe(true);
		expect(runtime.dispose()).toBe(first);
		await expect(runtime.session.run(async () => undefined)).rejects.toThrow();
		expect(() => runtime.drawingDimensions.write("late")).toThrow();
		let finished = false;
		void first.then(() => {
			finished = true;
		});
		await Promise.resolve();
		expect(finished).toBe(false);
		release?.();
		await work;
		await first;
		expect(finished).toBe(true);
		expect(value.effects.opens + value.effects.locks).toBe(0);
	});

	it("does not coerce an object into a verified scope or instantiate a runtime from it", () => {
		const value = fixture();
		const fakeScope = {
			toString: () => scope,
		} as unknown as VerifiedTelegramScope;
		expect(() =>
			createTelegramRuntime({ ...value.dependencies, scope: fakeScope }),
		).toThrow();
		expect(value.effects.uuid + value.effects.opens + value.effects.locks).toBe(
			0,
		);
	});

	it("revokes admission when a later actual startup-context read fails", async () => {
		const value = fixture();
		let fail = false;
		const runtime = createTelegramRuntime({
			...value.dependencies,
			context: {
				...value.dependencies.context,
				async readWorker() {
					if (fail) throw new Error("Private host context");
					return { hasControllingWorker: false, workerManifest: undefined };
				},
			},
		});
		await runtime.releaseStartup.handshake(
			await runtime.readReleaseStartupInput(),
		);
		fail = true;
		await expect(runtime.readReleaseStartupInput()).rejects.toThrow();
		expect(runtime.session.signal.aborted).toBe(true);
		expect(() => runtime.drawingDimensions.write("late")).toThrow();
		await expect(runtime.controller.create("Поздний план")).rejects.toThrow();
		expect(value.effects.opens + value.effects.locks).toBe(0);
		await runtime.dispose();
	});

	it("includes an already admitted host-context read in the dispose barrier and cancels late results", async () => {
		const value = fixture();
		let signal: AbortSignal | undefined;
		let enter: (() => void) | undefined;
		let release: (() => void) | undefined;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		const runtime = createTelegramRuntime({
			...value.dependencies,
			context: {
				...value.dependencies.context,
				async readWorker(received?: AbortSignal) {
					signal = received;
					enter?.();
					await hold;
					return { hasControllingWorker: false, workerManifest: undefined };
				},
			},
		});
		const reading = runtime.readReleaseStartupInput();
		await entered;
		const disposing = runtime.dispose();
		expect(signal).toBe(runtime.session.signal);
		expect(signal?.aborted).toBe(true);
		let finished = false;
		void disposing.then(() => {
			finished = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(finished).toBe(false);
		release?.();
		await expect(reading).rejects.toThrow();
		await disposing;
		expect(finished).toBe(true);
		expect(
			value.effects.capabilities + value.effects.opens + value.effects.locks,
		).toBe(0);
	});

	it("drains a whole shared command waiting outside the storage queue and detaches its state observers synchronously", async () => {
		const value = fixture();
		let enter: (() => void) | undefined;
		let release: (() => void) | undefined;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		let hashes = 0;
		const runtime = createTelegramRuntime({
			...value.dependencies,
			ports: {
				...value.dependencies.ports,
				checksum: {
					async sha256(bytes) {
						hashes++;
						enter?.();
						await hold;
						return value.dependencies.ports.checksum.sha256(bytes);
					},
				},
			},
		});
		await runtime.releaseStartup.handshake(
			await runtime.readReleaseStartupInput(),
		);
		let states = 0;
		const unsubscribe = observeUnexpectedAsync(runtime.controller.subscribe(() => {
			states++;
		}));
		const creating = runtime.controller.create("Задержанный план");
		// A wrong public route may settle before reaching the controlled checksum.
		// Observe that returned value/rejection instead of awaiting an unreachable
		// test barrier until the runner's body deadline.
		const completion = Promise.resolve(creating).then(
			() => "completed" as const,
			() => "rejected" as const,
		);
		const stage = await Promise.race([
			entered.then(() => "checksum-entered" as const),
			completion,
		]);
		if (stage !== "checksum-entered") {
			release?.();
			if (typeof unsubscribe === "function") unsubscribe();
			await runtime.dispose();
		}
		expect(stage).toBe("checksum-entered");
		const disposing = runtime.dispose();
		const statesAtRevocation = states;
		let finished = false;
		void disposing.then(() => {
			finished = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(finished).toBe(false);
		expect(runtime.session.signal.aborted).toBe(true);
		release?.();
		expect(await creating).toMatchObject({ kind: "persist-failed" });
		await disposing;
		expect(states).toBe(statesAtRevocation);
		const hashesAtDrain = hashes;
		await expect(runtime.controller.create("Поздний план")).rejects.toThrow();
		expect(hashes).toBe(hashesAtDrain);
		expect(() => observeUnexpectedAsync(runtime.controller.startNewProject())).toThrow();
		expect(observeUnexpectedAsync(runtime.controller.snapshot())).toBeDefined();
		unsubscribe();
		unsubscribe();
		expect(value.effects.opens + value.effects.locks).toBe(0);
	});

	it("registers command work before calling a port that reenters dispose", async () => {
		const value = fixture();
		let release: (() => void) | undefined;
		const hold = new Promise<Record<string, never>>((resolve) => {
			release = () => resolve({});
		});
		let runtime: ReturnType<typeof createTelegramRuntime>;
		let disposing: Promise<void> | undefined;
		runtime = createTelegramRuntime({
			...value.dependencies,
			ports: {
				...value.dependencies.ports,
				storageEstimate: {
					estimateStorage() {
						disposing = runtime.dispose();
						return hold;
					},
				},
			},
		});
		await runtime.releaseStartup.handshake(
			await runtime.readReleaseStartupInput(),
		);
		const estimating = runtime.controller.storagePressure();
		expect(disposing).toBeDefined();
		let finished = false;
		void disposing?.then(() => {
			finished = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(finished).toBe(false);
		release?.();
		await estimating;
		await disposing;
		expect(finished).toBe(true);
	});

	it("returns the same dispose promise even when an abort subscriber disposes reentrantly", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		let reentered: Promise<void> | undefined;
		runtime.session.signal.addEventListener(
			"abort",
			() => {
				reentered = runtime.dispose();
			},
			{ once: true },
		);
		const disposing = runtime.dispose();
		expect(reentered).toBe(disposing);
		await disposing;
		expect(runtime.dispose()).toBe(disposing);
	});

	it("keeps public snapshot/history/recovery queries synchronous before admission and after disposal", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		const assertEmpty = () => {
			expect(observeUnexpectedAsync(runtime.controller.snapshot())).toEqual({ kind: "loading" });
			expect(observeUnexpectedAsync(runtime.controller.hasPendingPublication())).toBe(false);
			expect(observeUnexpectedAsync(runtime.controller.persistenceRetryPolicy())).toBe("allowed");
			expect(observeUnexpectedAsync(runtime.controller.sessionHistory())).toEqual({
				canUndo: false,
				canRedo: false,
			});
			expect(observeUnexpectedAsync(runtime.controller.sessionHistoryCommandLabels())).toEqual({
				undoActionLabel: undefined,
				redoActionLabel: undefined,
			});
			expect(observeUnexpectedAsync(runtime.controller.currentRevisionIdentity())).toBeUndefined();
			expect(observeUnexpectedAsync(runtime.controller.sessionRetentionRoots())).toEqual({
				current: undefined,
				undo: [],
				redo: [],
			});
			expect(observeUnexpectedAsync(runtime.controller.writerAccess())).toEqual({ kind: "not-ready" });
			expect(observeUnexpectedAsync(runtime.controller.writerRecoveryCopy())).toBeUndefined();
			expect(observeUnexpectedAsync(runtime.controller.recoveryReadOnlyProject())).toBeUndefined();
			expect(
				observeUnexpectedAsync(runtime.controller.recoveryCustomGlbRemovalSummary()),
			).toBeUndefined();
		};
		assertEmpty();
		await runtime.dispose();
		assertEmpty();
	});

	it("rechecks the actual current worker instead of trusting an earlier caller input", async () => {
		const value = fixture();
		let changed = false;
		const runtime = createTelegramRuntime({
			...value.dependencies,
			context: {
				...value.dependencies.context,
				async readWorker() {
					return changed
						? {
								hasControllingWorker: true,
								workerManifest: {
									...manifest,
									appBuildId: "unexpected-worker",
								},
							}
						: { hasControllingWorker: false, workerManifest: undefined };
				},
			},
		});
		const earlier = await runtime.readReleaseStartupInput();
		changed = true;
		expect(await runtime.releaseStartup.handshake(earlier)).toEqual({
			kind: "read-only/exportable",
			recovery: {},
		});
		expect(runtime.session.signal.aborted).toBe(true);
		expect(value.effects.opens + value.effects.locks).toBe(0);
		await runtime.dispose();
	});

	it("does not keep admission open when the startup observer throws or disposes reentrantly", async () => {
		for (const action of ["throw", "dispose"] as const) {
			const value = fixture();
			const runtime = createTelegramRuntime(value.dependencies);
			const input = await runtime.readReleaseStartupInput();
			const outcome = await runtime.releaseStartup.handshake({
				...input,
				onModeChange(mode) {
					if (mode !== "writable") return;
					if (action === "throw") throw new Error("Observer failed");
					void runtime.dispose();
				},
			});
			expect(outcome).toEqual({ kind: "read-only/exportable", recovery: {} });
			expect(runtime.session.signal.aborted).toBe(true);
			await expect(runtime.controller.create("Поздний план")).rejects.toThrow();
			expect(value.effects.opens + value.effects.locks).toBe(0);
			await runtime.dispose();
		}
	});

	it("does not weaken actual secure/native context requirements because a prior permit exists", () => {
		for (const patch of [
			{ secureContext: false },
			{ locks: undefined },
			{ indexedDb: undefined },
			{ crypto: undefined },
			{ sessionStorage: undefined },
			{ localStorage: undefined },
			{ crypto: { randomUUID: () => crypto.randomUUID() } },
			{ sessionStorage: { getItem: () => null } },
			{ sessionStorage: { setItem: () => undefined } },
			{ localStorage: { getItem: () => null } },
			{ localStorage: { setItem: () => undefined } },
		]) {
			const value = fixture();
			expect(() =>
				createTelegramRuntime({
					...value.dependencies,
					context: {
						...value.dependencies.context,
						...patch,
					} as TelegramRuntimeDependencies["context"],
				}),
			).toThrow();
			expect(
				value.effects.uuid + value.effects.opens + value.effects.locks,
			).toBe(0);
		}
	});

	it("keeps all routes closed while the actual startup handshake is still pending", async () => {
		const value = fixture();
		let finishWorker: () => void = () => undefined;
		const waiting = new Promise<void>((resolve) => {
			finishWorker = resolve;
		});
		const runtime = createTelegramRuntime({
			...value.dependencies,
			context: {
				...value.dependencies.context,
				async readWorker() {
					await waiting;
					return { hasControllingWorker: false, workerManifest: undefined };
				},
			},
		});
		const handshake = runtime.releaseStartup.handshake({
			capabilities: { indexeddb: true, webgl2: true },
			shellManifest: manifest,
			hasControllingWorker: false,
			workerManifest: undefined,
		});
		expect(() => runtime.drawingDimensions.read()).toThrow();
		await expect(
			runtime.controller.create("До завершения проверки"),
		).rejects.toThrow();
		expect(value.effects.opens + value.effects.locks + value.local.reads).toBe(
			0,
		);
		finishWorker();
		expect(await handshake).toEqual({ kind: "writable" });
		await runtime.dispose();
	});

	it("delivers active shared-core events, stops individual subscriptions and refuses synchronous mutations after close", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		expect(
			await runtime.releaseStartup.handshake(
				await runtime.readReleaseStartupInput(),
			),
		).toEqual({ kind: "writable" });
		const observed: string[] = [];
		const stop = observeUnexpectedAsync(runtime.controller.subscribe((state) => {
			observed.push(state.kind);
		}));
		observeUnexpectedAsync(runtime.controller.startNewProject());
		expect(observed).toEqual(["first-run"]);
		stop();
		stop();
		observeUnexpectedAsync(runtime.controller.startNewProject());
		expect(observed).toEqual(["first-run"]);
		await runtime.dispose();
		expect(() => observeUnexpectedAsync(runtime.controller.startNewProject())).toThrow();
		expect(observeUnexpectedAsync(runtime.controller.snapshot()).kind).toBe("first-run");
		expect(value.effects.opens + value.effects.locks).toBe(0);
	});

	it("announces read-only mode and cannot trust a native lock method lost after construction", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		const input = await runtime.readReleaseStartupInput();
		value.dependencies.context.locks.request =
			undefined as unknown as LockManager["request"];
		const modes: string[] = [];
		expect(
			await runtime.releaseStartup.handshake({
				...input,
				onModeChange: (mode) => {
					modes.push(mode);
				},
			}),
		).toEqual({ kind: "read-only/exportable", recovery: {} });
		expect(modes).toEqual(["read-only/exportable"]);
		expect(runtime.session.signal.aborted).toBe(true);
		await expect(runtime.controller.create("Закрытый план")).rejects.toThrow();
		expect(value.effects.opens + value.effects.locks).toBe(0);
		await runtime.dispose();
	});

	it("owns physical subscription teardown before abort and ignores already captured late notifications", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		await runtime.releaseStartup.handshake(
			await runtime.readReleaseStartupInput(),
		);
		let registered = 0;
		let stopped = 0;
		let tearingDown = false;
		let teardownAdmission = "not-observed";
		const captured: Parameters<typeof runtime.controller.subscribe>[0][] = [];
		// Observe the actual public controller subscription boundary, independently
		// of whether core stores callbacks in a Set or schedules a notification.
		runtime.controller.subscribe = (observer) => {
			registered++;
			captured.push(observer);
			return () => {
				stopped++;
				if (tearingDown) {
					try {
						runtime.drawingDimensions.read();
						teardownAdmission = "accepted";
					} catch {
						teardownAdmission = "rejected";
					}
				}
			};
		};
		let notifications = 0;
		const stop = observeUnexpectedAsync(runtime.controller.subscribe(() => {
			notifications++;
		}));
		const state = observeUnexpectedAsync(runtime.controller.snapshot());
		captured[0]?.(state);
		expect(notifications).toBe(1);
		stop();
		stop();
		expect(stopped).toBe(1);
		captured[0]?.(state);
		expect(notifications).toBe(1);
		observeUnexpectedAsync(runtime.controller.subscribe(() => {
			notifications++;
		}));
		let stoppedWhenAborted = 0;
		runtime.session.signal.addEventListener("abort", () => {
			stoppedWhenAborted = stopped;
		});
		tearingDown = true;
		const disposed = runtime.dispose();
		expect(stopped).toBe(2);
		expect(stoppedWhenAborted).toBe(2);
		expect(teardownAdmission).toBe("rejected");
		captured[1]?.(state);
		expect(notifications).toBe(1);
		observeUnexpectedAsync(runtime.controller.subscribe(() => {
			notifications++;
		}))();
		expect(registered).toBe(2);
		await disposed;
	});

	it("settles and drains a public core route that throws before returning its Promise", async () => {
		const value = fixture();
		const runtime = createTelegramRuntime(value.dependencies);
		await runtime.releaseStartup.handshake(
			await runtime.readReleaseStartupInput(),
		);
		runtime.controller.readCustomGlbResource = () => {
			throw new Error("Controlled synchronous core failure");
		};
		await expect(
			runtime.controller.readCustomGlbResource("fixture-hash"),
		).rejects.toThrow("Controlled synchronous core failure");
		await runtime.dispose();
		expect(runtime.session.signal.aborted).toBe(true);
	});

	it("uses fresh native secure random bytes when randomUUID is unavailable without reusing stored owner IDs", async () => {
		const value = fixture();
		let draws = 0;
		const dependencies: TelegramRuntimeDependencies = {
			...value.dependencies,
			context: {
				...value.dependencies.context,
				crypto: {
					getRandomValues(array) {
						draws++;
						expect(array.byteLength).toBe(16);
						return crypto.getRandomValues(array);
					},
				},
			},
		};
		const first = createTelegramRuntime(dependencies);
		await first.dispose();
		const second = createTelegramRuntime(dependencies);
		expect(second.session).not.toBe(first.session);
		expect(first.session.signal.aborted).toBe(true);
		expect(second.session.signal.aborted).toBe(false);
		expect(draws).toBe(2);
		expect(
			value.session.reads +
				value.session.writes +
				value.effects.opens +
				value.effects.locks,
		).toBe(0);
		await second.dispose();
	});
});

function hex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}
