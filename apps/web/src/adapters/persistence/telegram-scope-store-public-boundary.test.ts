import { describe, expect, it, rs } from "@rstest/core";
import { verifiedReadonlyTestScope } from "../../../tests/fixtures/telegram-readonly-signed-launch";
import { TelegramRuntimeSession } from "../../app/telegram-runtime-session";
import { TelegramScopeStore } from "./telegram-scope-store";

const scope = verifiedReadonlyTestScope();
const schedule = globalThis.setTimeout,
	unschedule = globalThis.clearTimeout;
function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}
const observedOperations = new Map<
	Promise<unknown>,
	{
		title: string;
		label: string;
		state: "pending" | "fulfilled" | "rejected";
		logicallyAbandoned: boolean;
	}
>();
function track<T>(operation: Promise<T>, label: string): Promise<T> {
	if (!operation || typeof operation.then !== "function")
		throw new TypeError("Public operation did not return a promise");
	if (!observedOperations.has(operation)) {
		const record = {
			title: expect.getState().currentTestName ?? "",
			label,
			state: "pending" as "pending" | "fulfilled" | "rejected",
			logicallyAbandoned: false,
		};
		observedOperations.set(operation, record);
		void operation.then(
			() => {
				record.state = "fulfilled";
			},
			() => {
				record.state = "rejected";
			},
		);
	}
	return operation;
}
type Completion<T> =
	| { kind: "fulfilled"; value: T }
	| { kind: "rejected"; reason: unknown }
	| { kind: "pending" };
async function observe<T>(operation: Promise<T>): Promise<Completion<T>> {
	track(operation, "observed-public-operation");
	let timer: ReturnType<typeof setTimeout> | undefined;
	const settled: Promise<Completion<T>> = operation.then(
		(value) => ({ kind: "fulfilled", value }),
		(reason) => ({ kind: "rejected", reason }),
	);
	return Promise.race([
		settled,
		new Promise<Completion<T>>((yes) => {
			timer = schedule(() => yes({ kind: "pending" }), 2000);
		}),
	]).finally(() => {
		if (timer !== undefined) unschedule(timer);
	});
}
async function complete<T>(operation: Promise<T>): Promise<T> {
	const result = await observe(operation);
	expect(result.kind).toBe("fulfilled");
	if (result.kind !== "fulfilled")
		throw new Error("Public operation did not fulfill");
	return result.value;
}
async function refused(operation: Promise<unknown>): Promise<unknown> {
	const result = await observe(operation);
	expect(result.kind).toBe("rejected");
	if (result.kind !== "rejected")
		throw new Error("Public operation did not reject");
	return result.reason;
}
async function beforeComplete(
	event: Promise<void>,
	operation: Promise<unknown>,
) {
	expect(
		await complete(
			Promise.race([
				event.then(() => "entered"),
				operation.then(
					() => "completed",
					() => "completed",
				),
			]),
		),
	).toBe("entered");
}
function requestCallbacks() {
	const callbacks: {
		onsuccess: ((event: Event) => unknown) | null;
		onerror: ((event: Event) => unknown) | null;
		onblocked: ((event: Event) => unknown) | null;
		result?: IDBDatabase;
		error: DOMException | null;
	} = { onsuccess: null, onerror: null, onblocked: null, error: null };
	// Refusal/late-close callback double only; it never supplies a successful schema, transaction or ScopeAccess.
	return { callbacks, request: callbacks as unknown as IDBOpenDBRequest };
}
async function fixture(
	options: {
		secure?: boolean;
		noLocks?: boolean;
		malformedLock?: boolean;
		denyLock?: boolean;
		thrownOpen?: unknown;
		interiorMode?: "compatible" | "authoring";
		exactYaw?: boolean;
		doorHinge?: boolean;
	} = {},
) {
	const session = new TelegramRuntimeSession(await scope),
		opened = Array.from({ length: 6 }, () => deferred<void>()),
		requests: ReturnType<typeof requestCallbacks>[] = [],
		calls: { name: string; version?: number }[] = [],
		locks: { name: string; options: LockOptions }[] = [];
	const indexedDb = {
		open(name: string, version?: number) {
			calls.push({ name, version });
			opened[calls.length - 1]?.resolve();
			if (Object.hasOwn(options, "thrownOpen")) throw options.thrownOpen;
			const request = requestCallbacks();
			requests.push(request);
			return request.request;
		},
	};
	const request = async (
		name: string,
		configuration: LockOptions,
		callback: LockGrantedCallback<unknown>,
	) => {
		locks.push({ name, options: configuration });
		return callback(options.denyLock ? null : { name, mode: "exclusive" });
	};
	const lockPort = options.malformedLock
		? ({ request: 7 } as unknown as Pick<LockManager, "request">)
		: { request: request as LockManager["request"] };
	const store = new TelegramScopeStore(session, {
		indexedDb,
		secureContext: options.secure ?? true,
		...(options.interiorMode === "compatible" ? { roomInteriorCompatible: true } : {}),
		...(options.interiorMode === "authoring" ? { roomInteriorEnabled: true } : {}),
		...(options.exactYaw ? { databaseMode: "exact" } : {}),
		...(options.doorHinge ? { doorHingeMode: "authoring" } : {}),
		...(options.noLocks ? {} : { locks: lockPort }),
	});
	const command = rs.fn(
		async () => "must never receive an accepted database in this prefix",
	);
	const run = () => {
		const pending = track(store.run(command), "store.run");
		void pending.catch(() => undefined);
		return pending;
	};
	const fail = (
		index = 0,
		error: DOMException | null = new DOMException(
			"Controlled refusal",
			"UnknownError",
		),
	) => {
		const value = requests[index];
		if (!value) return;
		value.callbacks.error = error;
		value.callbacks.onerror?.(new Event("error"));
	};
	async function cleanup() {
		try {
			// Denial-only doubles never admitted a database/transaction/OS lock. Cleanup
			// must not depend on the selected subject's close or its broken logical tail.
			void session.revoke();
			if (
				Reflect.get(globalThis, "process").env
					.TMA_META_PREFIX_CLEANUP_CONTROL === "1" &&
				requests[0]
			) {
				const controlledCleanupCallback = () => {
					throw new Error("CONTROL_CALLBACK_CLEANUP_THROW");
				};
				controlledCleanupCallback();
			}
			for (const request of requests) {
				request.callbacks.onerror = null;
				request.callbacks.onsuccess = null;
				request.callbacks.onblocked = null;
				Reflect.set(request.callbacks, "onupgradeneeded", null);
			}
			opened.forEach((gate) => {
				gate.resolve();
			});
			const title = expect.getState().currentTestName ?? "";
			const abandoned = [...observedOperations.values()].filter(
				(record) => record.title === title && record.state === "pending",
			);
			abandoned.forEach((record) => {
				record.logicallyAbandoned = true;
			});
			const root = Reflect.get(globalThis, "process").env
				.TMA_META_PREFIX_INVOCATION;
			if (root) {
				const name = "node:fs";
				const files = await import(name);
				files.appendFileSync(
					`${root}/logical-cleanup.jsonl`,
					`${JSON.stringify({ title, denialOnly: true, nativeHandles: 0, signalRevoked: session.signal.aborted, logicallyAbandoned: abandoned.map((record) => ({ label: record.label, stateAtCleanup: record.state, handled: true })) })}\n`,
				);
			}
		} catch (cause) {
			throw new Error(
				"TMA_METADATA_PREFIX_INVALID: owned fixture cleanup failed",
				{ cause },
			);
		}
	}

	return {
		session,
		store,
		opened,
		requests,
		calls,
		locks,
		command,
		run,
		fail,
		cleanup,
	};
}
function lateHandle() {
	const close = rs.fn(),
		inspect = rs.fn();
	const value = {
		close,
		get version() {
			inspect();
			return 2;
		},
		get objectStoreNames() {
			inspect();
			return [];
		},
	};
	return { value: value as unknown as IDBDatabase, close, inspect };
}

describe("Telegram metadata public boundary; denial-only callbacks, no native durability claim", () => {
	it("uses only the guarded compatible fallback chain for IndexedDB version refusals", async () => {
		const x = await fixture({ interiorMode: "compatible" });
		try {
			const pending = x.run();
			for (const [index, version] of [2, 3, 4, 5, 6, 7].entries()) {
				await beforeComplete(x.opened[index].promise, pending);
				expect(x.calls[index]?.version).toBe(version);
				x.fail(index, new DOMException("Existing version is newer", "VersionError"));
			}
			expect(await refused(pending)).toMatchObject({ name: "VersionError" });
			expect(x.calls).toHaveLength(6);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("requests v7 for authoring and keeps other failures distinct from a compatible rollback", async () => {
		for (const [mode, expectedVersion] of [["compatible", 2], ["authoring", 7]] as const) {
			const x = await fixture({ interiorMode: mode });
			try {
				const pending = x.run();
				await beforeComplete(x.opened[0].promise, pending);
				expect(x.calls[0]?.version).toBe(expectedVersion);
				x.fail(0, new DOMException("Storage denied", "SecurityError"));
				expect(await refused(pending)).toMatchObject({ name: "SecurityError" });
				expect(x.calls).toHaveLength(1);
				expect(x.command).not.toHaveBeenCalled();
			} finally {
				await x.cleanup();
			}
		}
	});
	it("keeps the v3 and v4 routes when the interior channel is disabled", async () => {
		for (const [options, version] of [[{ exactYaw: true }, 3], [{ exactYaw: true, doorHinge: true }, 4]] as const) {
			const x = await fixture(options);
			try {
				const pending = x.run();
				await beforeComplete(x.opened[0].promise, pending);
				expect(x.calls[0]?.version).toBe(version);
				x.fail(0, new DOMException("Existing version is newer", "VersionError"));
				expect(await refused(pending)).toMatchObject({ name: "VersionError" });
				expect(x.calls).toHaveLength(1);
			} finally {
				await x.cleanup();
			}
		}
	});
	it("constructor remains inert before any public work", async () => {
		const x = await fixture();
		try {
			expect(x.calls).toEqual([]);
			expect(x.locks).toEqual([]);
			expect(x.command).not.toHaveBeenCalled();
			expect(x.session.signal.aborted).toBe(false);
		} finally {
			await x.cleanup();
		}
	});
	it("unknown operation IDs reject before a lock, database request or callback", async () => {
		const x = await fixture();
		try {
			for (const kind of ["other", "", undefined, 0, {}])
				expect(
					await refused(Reflect.apply(x.store.reserveId, x.store, [kind])),
				).toBeInstanceOf(Error);
			expect(x.calls).toEqual([]);
			expect(x.locks).toEqual([]);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	for (const [name, options] of [
		["insecure", { secure: false }],
		["missing-lock", { noLocks: true }],
		["malformed-lock", { malformedLock: true }],
	] as const)
		it(`refuses ${name} capability before native storage`, async () => {
			const x = await fixture(options);
			try {
				expect(await refused(x.run())).toBeInstanceOf(Error);
				expect(await refused(x.store.reserveId("lease"))).toBeInstanceOf(Error);
				expect(x.calls).toEqual([]);
				expect(x.locks).toEqual([]);
				expect(x.command).not.toHaveBeenCalled();
				expect(x.session.signal.aborted).toBe(false);
			} finally {
				await x.cleanup();
			}
		});
	it("a denied exclusive lock never opens native storage", async () => {
		const x = await fixture({ denyLock: true });
		try {
			expect(await refused(x.run())).toBeInstanceOf(Error);
			expect(x.locks).toHaveLength(1);
			expect(x.calls).toEqual([]);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("valid admission requests the exact scope lock and version2 database before refusing a native open", async () => {
		const x = await fixture(),
			pending = x.run();
		try {
			await beforeComplete(x.opened[0].promise, pending);
			expect(x.calls).toEqual([
				{ name: `interiors-editor-projects:${x.session.scope}`, version: 2 },
			]);
			expect(x.locks).toHaveLength(1);
			expect(x.locks[0]).toMatchObject({
				name: `interiors-tma-storage-v1:${x.session.scope}`,
				options: { mode: "exclusive", signal: x.session.signal },
			});
			expect(x.session.signal.aborted).toBe(false);
			x.fail();
			expect(await refused(pending)).toBeInstanceOf(Error);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("a synchronous open refusal preserves its exact reason and never enters the application callback", async () => {
		const reason = new Error("owned port refusal"),
			x = await fixture({ thrownOpen: reason });
		try {
			expect(await refused(x.run())).toBe(reason);
			expect(x.calls).toHaveLength(1);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("a refused open is not cached as a poisoned success and a later operation issues its own request", async () => {
		const x = await fixture();
		try {
			const first = x.run();
			await beforeComplete(x.opened[0].promise, first);
			x.fail();
			await refused(first);
			const second = x.run();
			await beforeComplete(x.opened[1].promise, second);
			expect(x.calls).toHaveLength(2);
			x.fail(1);
			await refused(second);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("blocked open closes a late handle without inspecting or admitting its schema", async () => {
		const x = await fixture(),
			pending = x.run();
		try {
			await beforeComplete(x.opened[0].promise, pending);
			x.requests[0].callbacks.onblocked?.(new Event("blocked"));
			await refused(pending);
			const late = lateHandle();
			x.requests[0].callbacks.result = late.value;
			x.requests[0].callbacks.onsuccess?.(new Event("success"));
			expect(late.close).toHaveBeenCalledTimes(1);
			expect(late.inspect).not.toHaveBeenCalled();
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("explicit close cancels an unadmitted open and closes its later handle before inspecting schema", async () => {
		const x = await fixture(),
			pending = x.run();
		try {
			await beforeComplete(x.opened[0].promise, pending);
			const closing = x.store.close();
			expect(x.session.signal.aborted).toBe(true);
			await refused(pending);
			await complete(closing);
			const late = lateHandle();
			x.requests[0].callbacks.result = late.value;
			x.requests[0].callbacks.onsuccess?.(new Event("success"));
			expect(late.close).toHaveBeenCalledTimes(1);
			expect(late.inspect).not.toHaveBeenCalled();
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("close before work rejects every future operation without requesting a lock or database", async () => {
		const x = await fixture();
		try {
			const closing = x.store.close();
			expect(x.session.signal.aborted).toBe(true);
			await complete(closing);
			await refused(x.run());
			await refused(x.store.reserveId("attempt"));
			expect(x.calls).toEqual([]);
			expect(x.locks).toEqual([]);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("revoking a pending open drains it and refuses queued work before any second lock request", async () => {
		const x = await fixture(),
			first = x.run();
		try {
			await beforeComplete(x.opened[0].promise, first);
			const queued = x.run(),
				closing = x.store.close();
			expect(x.session.signal.aborted).toBe(true);
			await refused(first);
			await refused(queued);
			await complete(closing);
			expect(x.calls).toHaveLength(1);
			expect(x.locks).toHaveLength(1);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("a missing native error object still produces an actual refusal rather than an accepted capability", async () => {
		const x = await fixture(),
			pending = x.run();
		try {
			await beforeComplete(x.opened[0].promise, pending);
			x.fail(0, null);
			expect(await refused(pending)).toBeInstanceOf(Error);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
		}
	});
	it("a failed session command preserves the exact reason while its next queued command still executes", async () => {
		const session = new TelegramRuntimeSession(await scope),
			reason = {};
		try {
			expect(
				await refused(
					session.run(async () => {
						throw reason;
					}),
				),
			).toBe(reason);
			expect(await complete(session.run(async () => 9))).toBe(9);
		} finally {
			void session.revoke();
		}
	});
	it("session revocation is synchronous, drains current work and never invokes queued or future callbacks", async () => {
		const session = new TelegramRuntimeSession(await scope),
			entered = deferred<void>(),
			held = deferred<number>(),
			later = rs.fn(async () => 2);
		const current = session.run(async () => {
			entered.resolve();
			return held.promise;
		});
		try {
			await beforeComplete(entered.promise, current);
			const queued = session.run(later);
			void queued.catch(() => undefined);
			const drain = session.revoke();
			expect(session.signal.aborted).toBe(true);
			let drained = false;
			void drain.then(() => {
				drained = true;
			});
			await Promise.resolve();
			expect(drained).toBe(false);
			held.resolve(7);
			expect(await complete(current)).toBe(7);
			await refused(queued);
			await complete(drain);
			await refused(session.run(later));
			expect(later).not.toHaveBeenCalled();
		} finally {
			held.resolve(7);
			void session.revoke();
		}
	});
	it("a refused open removes its owned cancellation listener instead of retaining it against later work", async () => {
		const x = await fixture(),
			add = rs.spyOn(x.session.signal, "addEventListener"),
			remove = rs.spyOn(x.session.signal, "removeEventListener"),
			pending = x.run();
		try {
			await beforeComplete(x.opened[0].promise, pending);
			expect(add).toHaveBeenCalledTimes(1);
			const listener = add.mock.calls[0]?.[1];
			x.fail();
			await refused(pending);
			expect(remove).toHaveBeenCalledWith("abort", listener);
			expect(x.command).not.toHaveBeenCalled();
		} finally {
			await x.cleanup();
			add.mockRestore();
			remove.mockRestore();
		}
	});
});
