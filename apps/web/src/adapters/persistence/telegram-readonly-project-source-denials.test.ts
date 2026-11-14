import { describe, expect, it, rs } from "@rstest/core";
import { verifiedReadonlyTestScope } from "../../../tests/fixtures/telegram-readonly-signed-launch";
import {
	completeReadonlyUnitOperation,
	refuseReadonlyUnitOperation,
} from "../../../tests/verification/readonly-public-unit-completion";
import { approveReadableTelegramRelease } from "../../app/telegram-readable-release";
import { createRegisteredRuntimePortablePorts } from "../portable-backup/registered-runtime-portable";
import { createTelegramReadonlyProjectSource } from "./telegram-readonly-project-source";

const binaryChecksum = {
	async sha256Bytes(bytes: Uint8Array) {
		const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
		return Array.from(new Uint8Array(digest), (value) =>
			value.toString(16).padStart(2, "0"),
		).join("");
	},
};
const checksum = {
	sha256: (value: string) =>
		binaryChecksum.sha256Bytes(new TextEncoder().encode(value)),
};
function release() {
	const manifest = {
		appBuildId: "0123456789abcdef",
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		projectSchemas: { readable: [1], writable: [1] },
		minimumCapabilities: ["indexeddb"],
		version: 1,
		workerProtocolVersion: 1,
	};
	const result = approveReadableTelegramRelease({
		capsule: {
			deliveryTarget: "telegram",
			entryPath: "/telegram.12345678.js",
			manifest,
		},
		loadedEntryPath: "/telegram.12345678.js",
		capabilities: { indexeddb: true, webgl2: false },
		secureContext: true,
		hasControllingWorker: false,
		workerManifest: undefined,
	});
	if (result.kind !== "approved")
		throw new Error("Actual opaque readable release permit was not approved");
	return result.approval;
}
function immediateLocks(): Pick<LockManager, "request"> {
	return {
		async request<T>(
			name: string,
			optionsOrCallback: LockOptions | LockGrantedCallback<T>,
			supplied?: LockGrantedCallback<T>,
		): Promise<T> {
			const callback =
				typeof optionsOrCallback === "function" ? optionsOrCallback : supplied;
			if (!callback) throw new Error("Missing actual lock callback");
			return callback({ name, mode: "exclusive" });
		},
	};
}
async function dependencies() {
	let reads = 0;
	const value: Parameters<typeof createTelegramReadonlyProjectSource>[0] = {
		scope: await verifiedReadonlyTestScope(),
		release: release(),
		checksum,
		binaryChecksum,
		portable: createRegisteredRuntimePortablePorts({ binaryChecksum }),
		technical: {
			secureContext: true,
			locks: immediateLocks(),
			indexedDb: {
				async databases() {
					reads++;
					return [];
				},
				open() {
					reads++;
					throw new Error("Constructor must remain inert");
				},
			},
		},
	};
	return { value, reads: () => reads };
}
function constructUnknown(value: unknown): unknown {
	return Reflect.apply(createTelegramReadonlyProjectSource, undefined, [value]);
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}

// Native-request denial callbacks only. No double ever supplies a database, transaction,
// successful schema, resource row or Project acceptance result.
function denialRequest(error: DOMException | null) {
	const callbacks: {
		error: DOMException | null;
		onerror: ((event: Event) => unknown) | null;
		onsuccess: ((event: Event) => unknown) | null;
		onblocked: ((event: Event) => unknown) | null;
		onupgradeneeded: ((event: Event) => unknown) | null;
	} = {
		error,
		onerror: null,
		onsuccess: null,
		onblocked: null,
		onupgradeneeded: null,
	};
	return { callbacks, request: callbacks as unknown as IDBOpenDBRequest };
}
function technicalCleanup(work: () => void) {
	try {
		work();
	} catch (error) {
		throw new Error("READONLY_PROOF_INVALID: denial fixture cleanup", {
			cause: error,
		});
	}
}
function detach(callbacks: ReturnType<typeof denialRequest>["callbacks"]) {
	try {
		callbacks.onerror =
			callbacks.onsuccess =
			callbacks.onblocked =
			callbacks.onupgradeneeded =
				null;
	} catch (error) {
		throw new Error("READONLY_PROOF_INVALID: denial callback cleanup", {
			cause: error,
		});
	}
}

async function beforeOpened(event: Promise<void>, operation: Promise<unknown>) {
	expect(
		await completeReadonlyUnitOperation(
			Promise.race([
				event.then(() => "opened"),
				operation.then(
					() => "completed",
					() => "completed",
				),
			]),
		),
	).toBe("opened");
}
function lateHandle() {
	let closes = 0,
		schemaReads = 0;
	const handle = {
		close() {
			closes++;
		},
		get version() {
			schemaReads++;
			throw new Error("Abandoned native handle schema was observed");
		},
		get objectStoreNames() {
			schemaReads++;
			throw new Error("Abandoned native handle inventory was observed");
		},
	};
	return {
		handle: handle as unknown as IDBDatabase,
		evidence: () => ({ closes, schemaReads }),
	};
}
function deliverLate(
	request: ReturnType<typeof denialRequest>,
	late: ReturnType<typeof lateHandle>,
) {
	Object.assign(request.callbacks, { result: late.handle });
	expect(request.callbacks.onsuccess).toBeTypeOf("function");
	expect(() =>
		request.callbacks.onsuccess?.(new Event("success")),
	).not.toThrow();
	expect(late.evidence()).toEqual({ closes: 1, schemaReads: 0 });
}

describe("readonly source public denial boundaries", () => {
	for (const mode of [
		"insecure",
		"missing-open",
		"invalid-open",
		"noncallable-open-with-bind",
		"missing-locks",
		"missing-request",
		"invalid-request",
		"noncallable-request-with-bind",
	] as const) {
		it(`refuses ${mode} capabilities without touching an inventory, native request or lock`, async () => {
			const f = await dependencies();
			const technical =
				mode === "insecure"
					? { ...f.value.technical, secureContext: false }
					: mode === "missing-open"
						? {
								...f.value.technical,
								indexedDb: { ...f.value.technical.indexedDb, open: undefined },
							}
						: mode === "invalid-open"
							? {
									...f.value.technical,
									indexedDb: { ...f.value.technical.indexedDb, open: 7 },
								}
							: mode === "noncallable-open-with-bind"
								? {
										...f.value.technical,
										indexedDb: {
											...f.value.technical.indexedDb,
											open: {
												bind() {
													return () => {
														throw new Error("Noncallable open was invoked");
													};
												},
											},
										},
									}
								: mode === "missing-locks"
									? { ...f.value.technical, locks: undefined }
									: mode === "missing-request"
										? { ...f.value.technical, locks: { request: undefined } }
										: mode === "invalid-request"
											? { ...f.value.technical, locks: { request: 7 } }
											: {
													...f.value.technical,
													locks: {
														request: {
															bind() {
																return () => {
																	throw new Error(
																		"Noncallable request was invoked",
																	);
																};
															},
														},
													},
												};
			expect(() => constructUnknown({ ...f.value, technical })).toThrow();
			expect(f.reads()).toBe(0);
		});
	}
	it("an explicit native-readonly profile remains usable with no lock capability and never opens an absent database", async () => {
		const f = await dependencies();
		const source = createTelegramReadonlyProjectSource({
			...f.value,
			coordination: "native-readonly-snapshot",
			technical: { ...f.value.technical, locks: undefined },
		});
		expect(await completeReadonlyUnitOperation(source.listProjects())).toEqual({
			kind: "empty",
		});
		expect(f.reads()).toBe(1);
		expect(
			await completeReadonlyUnitOperation(source.dispose()),
		).toBeUndefined();
	});
	for (const mode of ["absent", "foreign"] as const) {
		it(`${mode} inventory does not issue a native open or borrow another database`, async () => {
			const f = await dependencies();
			let inventories = 0,
				opens = 0;
			const source = createTelegramReadonlyProjectSource({
				...f.value,
				technical: {
					...f.value.technical,
					indexedDb: {
						async databases() {
							inventories++;
							return mode === "absent"
								? []
								: [
										{
											name: `interiors-editor-projects:${f.value.scope.slice(0, -1)}${f.value.scope.endsWith("0") ? "1" : "0"}`,
											version: 2,
										},
									];
						},
						open() {
							opens++;
							throw new Error("Inventory did not contain this exact scope");
						},
					},
				},
			});
			expect(
				await completeReadonlyUnitOperation(source.listProjects()),
			).toEqual({ kind: "empty" });
			expect(
				await completeReadonlyUnitOperation(
					source.sourceRecovery.listRecoverySources(),
				),
			).toEqual([]);
			expect(inventories).toBeGreaterThan(0);
			expect(opens).toBe(0);
			expect(
				await completeReadonlyUnitOperation(source.dispose()),
			).toBeUndefined();
		});
	}
	it("the exact owned database name in inventory reaches one existing-only open and preserves its synchronous rejection", async () => {
		const f = await dependencies(),
			refused = new Error("Controlled native opening refusal");
		const calls: { name: string; version: number | undefined }[] = [];
		const name = `interiors-editor-projects:${f.value.scope}`;
		const source = createTelegramReadonlyProjectSource({
			...f.value,
			technical: {
				...f.value.technical,
				indexedDb: {
					async databases() {
						return [{ name, version: 2 }];
					},
					open(name: string, version?: number) {
						calls.push({ name, version });
						throw refused;
					},
				},
			},
		});
		expect(await refuseReadonlyUnitOperation(source.listProjects())).toBe(
			refused,
		);
		expect(calls).toEqual([{ name, version: undefined }]);
		expect(
			await completeReadonlyUnitOperation(source.dispose()),
		).toBeUndefined();
	});
	it("an ordinary native request error rejects with its original reason instead of becoming empty storage", async () => {
		const f = await dependencies(),
			error = new DOMException("Controlled request denial", "UnknownError"),
			opened = deferred<void>(),
			denied = denialRequest(error);
		let opens = 0;
		const source = createTelegramReadonlyProjectSource({
			...f.value,
			technical: {
				...f.value.technical,
				indexedDb: {
					open() {
						opens++;
						opened.resolve();
						return denied.request;
					},
				},
			},
		});
		try {
			const operation = source.listProjects();
			const reached = Promise.race([
				opened.promise.then(() => "opened"),
				operation.then(
					() => "completed",
					() => "completed",
				),
			]);
			expect(await completeReadonlyUnitOperation(reached)).toBe("opened");
			expect(denied.callbacks.onerror).toBeTypeOf("function");
			denied.callbacks.onerror?.(new Event("error"));
			expect(await refuseReadonlyUnitOperation(operation)).toBe(error);
			expect(opens).toBe(1);
			expect(
				await completeReadonlyUnitOperation(source.dispose()),
			).toBeUndefined();
		} finally {
			detach(denied.callbacks);
		}
	});
});

describe("readonly source denied request lifetime", () => {
	it("a blocked request refuses its public operation and closes only its late handle without reading schema", async () => {
		const f = await dependencies(),
			opened = deferred<void>(),
			denied = denialRequest(null),
			late = lateHandle();
		const source = createTelegramReadonlyProjectSource({
			...f.value,
			technical: {
				...f.value.technical,
				indexedDb: {
					open() {
						opened.resolve();
						return denied.request;
					},
				},
			},
		});
		try {
			const operation = source.listProjects();
			await beforeOpened(opened.promise, operation);
			expect(denied.callbacks.onblocked).toBeTypeOf("function");
			denied.callbacks.onblocked?.(new Event("blocked"));
			expect(await refuseReadonlyUnitOperation(operation)).toBeInstanceOf(
				Error,
			);
			deliverLate(denied, late);
			expect(
				await completeReadonlyUnitOperation(source.dispose()),
			).toBeUndefined();
		} finally {
			detach(denied.callbacks);
		}
	});
	it("the configured open deadline rejects and its later successful native request is closed without schema access", async () => {
		const f = await dependencies(),
			opened = deferred<void>(),
			denied = denialRequest(null),
			late = lateHandle();
		rs.useFakeTimers();
		try {
			const source = createTelegramReadonlyProjectSource({
				...f.value,
				technical: {
					...f.value.technical,
					openTimeoutMs: 7,
					indexedDb: {
						open() {
							opened.resolve();
							return denied.request;
						},
					},
				},
			});
			const operation = source.listProjects();
			await beforeOpened(opened.promise, operation);
			await rs.advanceTimersByTimeAsync(7);
			expect(await refuseReadonlyUnitOperation(operation)).toBeInstanceOf(
				Error,
			);
			deliverLate(denied, late);
			expect(
				await completeReadonlyUnitOperation(source.dispose()),
			).toBeUndefined();
		} finally {
			technicalCleanup(() => {
				detach(denied.callbacks);
				rs.useRealTimers();
			});
		}
	});
	it("disposing a pending open rejects and drains the public operation before safely closing a late handle", async () => {
		const f = await dependencies(),
			opened = deferred<void>(),
			denied = denialRequest(null),
			late = lateHandle();
		const source = createTelegramReadonlyProjectSource({
			...f.value,
			technical: {
				...f.value.technical,
				indexedDb: {
					open() {
						opened.resolve();
						return denied.request;
					},
				},
			},
		});
		try {
			const operation = source.listProjects();
			await beforeOpened(opened.promise, operation);
			const disposal = source.dispose();
			expect(source.signal.aborted).toBe(true);
			expect(await refuseReadonlyUnitOperation(operation)).toBeDefined();
			expect(await completeReadonlyUnitOperation(disposal)).toBeUndefined();
			deliverLate(denied, late);
		} finally {
			detach(denied.callbacks);
		}
	});
	it("an ordinary failed opening is cleared so a later public attempt makes a fresh native request", async () => {
		const f = await dependencies(),
			events = [deferred<void>(), deferred<void>()],
			requests = [
				denialRequest(new DOMException("First refusal", "UnknownError")),
				denialRequest(new DOMException("Second refusal", "UnknownError")),
			];
		let calls = 0;
		const source = createTelegramReadonlyProjectSource({
			...f.value,
			technical: {
				...f.value.technical,
				indexedDb: {
					open() {
						const index = calls++;
						events[index]?.resolve();
						if (!requests[index]) throw new Error("Unexpected extra request");
						return requests[index].request;
					},
				},
			},
		});
		try {
			for (const index of [0, 1]) {
				const operation = source.listProjects();
				await beforeOpened(events[index].promise, operation);
				expect(requests[index].callbacks.onerror).toBeTypeOf("function");
				requests[index].callbacks.onerror?.(new Event("error"));
				expect(await refuseReadonlyUnitOperation(operation)).toBe(
					requests[index].callbacks.error,
				);
			}
			expect(calls).toBe(2);
			expect(
				await completeReadonlyUnitOperation(source.dispose()),
			).toBeUndefined();
		} finally {
			technicalCleanup(() =>
				requests.forEach((value) => {
					detach(value.callbacks);
				}),
			);
		}
	});
	it("a request error without a reason still rejects instead of claiming an empty database", async () => {
		const f = await dependencies(),
			opened = deferred<void>(),
			denied = denialRequest(null);
		const source = createTelegramReadonlyProjectSource({
			...f.value,
			technical: {
				...f.value.technical,
				indexedDb: {
					open() {
						opened.resolve();
						return denied.request;
					},
				},
			},
		});
		try {
			const operation = source.listProjects();
			await beforeOpened(opened.promise, operation);
			expect(denied.callbacks.onerror).toBeTypeOf("function");
			denied.callbacks.onerror?.(new Event("error"));
			expect(await refuseReadonlyUnitOperation(operation)).toBeInstanceOf(
				Error,
			);
			expect(
				await completeReadonlyUnitOperation(source.dispose()),
			).toBeUndefined();
		} finally {
			detach(denied.callbacks);
		}
	});
	it("revocation while inventory is pending drains the read and a late inventory cannot open storage", async () => {
		const f = await dependencies(),
			entered = deferred<void>(),
			inventory = deferred<IDBDatabaseInfo[]>();
		let opens = 0;
		const source = createTelegramReadonlyProjectSource({
			...f.value,
			technical: {
				...f.value.technical,
				indexedDb: {
					databases() {
						entered.resolve();
						return inventory.promise;
					},
					open() {
						opens++;
						throw new Error("Revoked inventory must not open storage");
					},
				},
			},
		});
		const operation = source.listProjects();
		await beforeOpened(entered.promise, operation);
		const disposal = source.dispose();
		expect(source.signal.aborted).toBe(true);
		expect(await refuseReadonlyUnitOperation(operation)).toBeDefined();
		expect(await completeReadonlyUnitOperation(disposal)).toBeUndefined();
		inventory.resolve([
			{ name: `interiors-editor-projects:${f.value.scope}`, version: 2 },
		]);
		await inventory.promise;
		expect(
			await refuseReadonlyUnitOperation(source.listProjects()),
		).toBeDefined();
		expect(opens).toBe(0);
	});
	it("a pending inventory obeys its configured deadline and the live source can retry without provisioning", async () => {
		const f = await dependencies(),
			entered = deferred<void>(),
			inventory = deferred<IDBDatabaseInfo[]>();
		let inventories = 0,
			opens = 0;
		rs.useFakeTimers();
		try {
			const source = createTelegramReadonlyProjectSource({
				...f.value,
				technical: {
					...f.value.technical,
					openTimeoutMs: 7,
					indexedDb: {
						databases() {
							inventories++;
							entered.resolve();
							return inventories === 1
								? inventory.promise
								: Promise.resolve([]);
						},
						open() {
							opens++;
							throw new Error("Absent inventory must not open storage");
						},
					},
				},
			});
			const operation = source.listProjects();
			await beforeOpened(entered.promise, operation);
			await rs.advanceTimersByTimeAsync(7);
			expect(await refuseReadonlyUnitOperation(operation)).toBeInstanceOf(
				Error,
			);
			expect(source.signal.aborted).toBe(false);
			inventory.resolve([]);
			await inventory.promise;
			expect(
				await completeReadonlyUnitOperation(source.listProjects()),
			).toEqual({ kind: "empty" });
			expect(inventories).toBe(2);
			expect(opens).toBe(0);
			expect(
				await completeReadonlyUnitOperation(source.dispose()),
			).toBeUndefined();
		} finally {
			technicalCleanup(() => {
				inventory.resolve([]);
				rs.useRealTimers();
			});
		}
	});
});
