import { beforeEach, describe, expect, it } from "@rstest/core";
import {
	CreateProjectUseCase,
	canonicalProjectSerializer,
} from "../application/create-project";
import type { ProjectRepositoryPort } from "../application/ports";
import { ProjectController } from "./project-controller";
import {
	guardRegisteredProjectController,
	type TrackOperation,
} from "./registered-project-controller";

/** Keep a wrong asynchronous return observed while asserting the real public
 * synchronous contract. The original return is preserved, so a Promise still
 * fails the value/throw assertion rather than becoming a detached rejection. */
function observeUnexpectedAsync<T>(value: T): T {
 if (value && (typeof value === "object" || typeof value === "function") && typeof Reflect.get(value, "then") === "function") void Promise.resolve(value).catch(() => undefined);
 return value;
}

function fixture() {
	let active = true,
		tracked = 0,
		publications = 0;
	const cancellation = new AbortController(),
		subscriptions = new Set<() => void>();
	const repository: ProjectRepositoryPort = {
		publish: async () => {
			publications++;
			return { kind: "durable" };
		},
		loadCurrent: async () => ({ kind: "empty" }),
		recover: async () => ({ kind: "recovered" }),
	};
	let id = 0;
	const core = new ProjectController(
		new CreateProjectUseCase({
			repository,
			serializer: canonicalProjectSerializer,
			clock: { now: () => "2026-11-05T00:00:00.000Z" },
			ids: { next: () => `id-${++id}` },
			checksum: { sha256: async () => "checksum" },
		}),
		repository,
	);
	const track: TrackOperation = async (operation) => {
		if (!active) throw new Error("Host closed");
		tracked++;
		return operation();
	};
	const controller = guardRegisteredProjectController(
		core,
		() => active,
		cancellation.signal,
		subscriptions,
		track,
		"Registered browser is unavailable",
	);
	return {
		core,
		controller,
		subscriptions,
		cancellation,
		get tracked() {
			return tracked;
		},
		get publications() {
			return publications;
		},
		revoke() {
			active = false;
			cancellation.abort();
		},
	};
}

beforeEach(() => {
	const runtime: unknown = Reflect.get(globalThis, "process");
	const env: unknown =
		runtime && typeof runtime === "object"
			? Reflect.get(runtime, "env")
			: undefined;
	const expected: unknown =
		env && typeof env === "object"
			? Reflect.get(env, "__STRYKER_ACTIVE_MUTANT__")
			: undefined;
	if (expected === undefined) return;
	let failed = false,
		failure: unknown;
	try {
		fixture().controller.snapshot();
	} catch (error) {
		failed = true;
		failure = error;
	}
	{
		const namespace: unknown = Reflect.get(globalThis, "__stryker__");
		const actual: unknown =
			namespace && typeof namespace === "object"
				? Reflect.get(namespace, "activeMutant")
				: undefined;
		const audit: unknown =
			env && typeof env === "object"
				? Reflect.get(env, "INTERIORS_REGISTERED_CONTROLLER_MUTATION_AUDIT")
				: undefined;
		if (typeof audit === "string" && runtime && typeof runtime === "object") {
			const getBuiltin: unknown = Reflect.get(runtime, "getBuiltinModule");
			if (typeof getBuiltin !== "function")
				throw new Error("Pinned Node built-in module access unavailable");
			const fs: unknown = Reflect.apply(getBuiltin, runtime, ["node:fs"]);
			const append: unknown =
				fs && typeof fs === "object"
					? Reflect.get(fs, "appendFileSync")
					: undefined;
			if (typeof append !== "function")
				throw new Error("Native activation ledger unavailable");
			Reflect.apply(append, fs, [
				audit,
				`${JSON.stringify({ expected, actual })}\n`,
			]);
		}
		expect(actual).toBe(expected);
	}
	if (failed) throw failure;
});

describe("shared registered controller guard", () => {
	it("preserves the real core prototype and stable synchronous query methods without publishing", () => {
		const value = fixture();
		expect(value.controller).toBeInstanceOf(ProjectController);
		expect(value.controller.constructor).toBe(ProjectController);
		expect(Reflect.get(value.controller, "then")).toBeUndefined();
		expect(Reflect.get(value.controller, Symbol.toStringTag)).toBeUndefined();
		expect(value.controller.snapshot).toBe(value.controller.snapshot);
		expect(observeUnexpectedAsync(value.controller.snapshot())).toBe(value.core.snapshot());
		expect(observeUnexpectedAsync(value.controller.hasPendingPublication())).toBe(false);
		expect(observeUnexpectedAsync(value.controller.pendingPublicationIdentity())).toBeUndefined();
		expect(observeUnexpectedAsync(value.controller.sessionRetentionRoots())).toEqual(
			value.core.sessionRetentionRoots(),
		);
		expect(value.tracked + value.publications).toBe(0);
	});
	it("executes real shared commands through the supplied host lifetime tracker", async () => {
		const value = fixture();
		expect((await value.controller.create("Project")).kind).toBe("durable");
		expect(value.tracked).toBe(1);
		expect(value.publications).toBe(1);
		expect(observeUnexpectedAsync(value.controller.snapshot())).toBe(value.core.snapshot());
		value.revoke();
		await expect(value.controller.create("Late Project")).rejects.toThrow(
			"Host closed",
		);
		expect(value.publications).toBe(1);
	});
	it("detaches revoked observations and makes unsubscribe idempotent", async () => {
		const value = fixture();
		let notifications = 0;
		const listener = () => {
			notifications++;
		};
		const stop = observeUnexpectedAsync(value.controller.subscribe(listener));
		expect(value.subscriptions.size).toBe(1);
		await value.controller.create("First");
		expect(notifications).toBeGreaterThan(0);
		const count = notifications;
		value.revoke();
		value.core.startNewProject();
		expect(notifications).toBe(count);
		stop();
		stop();
		expect(value.subscriptions.size).toBe(0);
		observeUnexpectedAsync(value.controller.subscribe(listener))();
		expect(value.subscriptions.size).toBe(0);
	});
	it("keeps registered transfer on the portable dispatcher and forwards actual cancellation/status", async () => {
		const value = fixture(),
			bytes = new Uint8Array([0x7b]),
			signal = { aborted: false },
			status = () => undefined;
		const calls: Array<{
			bytes: Uint8Array;
			options: Parameters<ProjectController["importPortableBackup"]>[1];
		}> = [];
		let genericCalls = 0;
		value.core.importPortableBackup = async (bytes, options) => {
			calls.push({ bytes, options });
			return { kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" };
		};
		const generic = value.core.importProjectTransfer.bind(value.core);
		value.core.importProjectTransfer = (...args) => {
			genericCalls++;
			return generic(...args);
		};
		expect(
			await value.controller.importProjectTransfer(bytes, {
				signal,
				onPortableStatus: status,
			}),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
		expect(calls).toHaveLength(1);
		expect(calls[0].bytes).toBe(bytes);
		expect(calls[0].options?.signal).toBe(signal);
		expect(calls[0].options?.onStatus).toBe(status);
		expect(genericCalls).toBe(0);
		expect(value.tracked).toBe(1);
	});

	it("accepts the public one-argument transfer call without inventing options or falling back to JSON", async () => {
		const value = fixture(),
			bytes = new Uint8Array([0x7b]);
		let received: Parameters<ProjectController["importPortableBackup"]>[1];
		value.core.importPortableBackup = async (_bytes, options) => {
			received = options;
			return { kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" };
		};
		expect(await value.controller.importProjectTransfer(bytes)).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_SCHEMA_UNREADABLE",
		});
		expect(received).toEqual({ onStatus: undefined, signal: undefined });
		expect(value.tracked).toBe(1);
	});
	it("preserves synchronous new-project navigation and the exact host-owned refusal message", () => {
		const value = fixture();
		expect(observeUnexpectedAsync(value.controller.startNewProject())).toBeUndefined();
		expect(value.tracked).toBe(0);
		value.revoke();
		expect(() => observeUnexpectedAsync(value.controller.startNewProject())).toThrow(
			"Registered browser is unavailable",
		);
		expect(observeUnexpectedAsync(value.controller.snapshot())).toBe(value.core.snapshot());
	});
});
