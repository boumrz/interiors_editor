import { afterEach, expect, it, rs } from "@rstest/core";
import { readonlyCloseLifecycleDouble } from "./browser-readonly-lifecycle.test-support";
import {
	type BrowserReadonlyProjectSourceDependencies,
	createBrowserReadonlyProjectSource,
} from "./browser-readonly-project-source";

// Constructor/admission, bounded inventory and lifecycle event doubles only; no native transaction/data acceptance claim.
const realTimer = globalThis.setTimeout,
	clearRealTimer = globalThis.clearTimeout;
function held<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((finish) => {
		resolve = finish;
	});
	return { promise, resolve };
}
async function checkpoint<T>(promise: Promise<T>) {
	let timer: ReturnType<typeof realTimer> | undefined;
	try {
		return await Promise.race([
			promise.then(
				(value) => ({ kind: "resolved" as const, value }),
				(reason) => ({ kind: "rejected" as const, reason }),
			),
			new Promise<{ kind: "pending" }>((resolve) => {
				timer = realTimer(() => resolve({ kind: "pending" }), 250);
			}),
		]);
	} finally {
		clearRealTimer(timer);
	}
}
const technicalCleanups = new Set<() => void>();
async function proofCleanup(work: () => unknown, inject = false) {
	const observed = await checkpoint(
		Promise.resolve().then(() => {
			const value = work();
			if (inject) {
				const mode = Reflect.get(globalThis, "process").env
					.BR_UNIT_TECH_CLEANUP;
				if (mode === "throw")
					throw new Error("Controlled technical cleanup throw");
				if (mode === "assert")
					expect("controlled cleanup failure").toBe("healthy cleanup");
				if (mode === "pending") return new Promise(() => {});
			}
			return value;
		}),
	);
	if (observed.kind !== "resolved") {
		console.log("BROWSER_READONLY_UNIT_PROOF_INVALID_CLEANUP");
		if (observed.kind === "rejected") throw observed.reason;
		throw new Error("Owned verification cleanup did not finish");
	}
}
afterEach(async () => {
	await proofCleanup(() => {
		for (const cleanup of technicalCleanups) cleanup();
		technicalCleanups.clear();
	}, true);
});
function fixture() {
	let admitted = true;
	const deny = () => {
		admitted = false;
	};
	technicalCleanups.add(deny);
	const calls = { open: 0, inventory: 0, backup: 0, admission: 0 };
	const unused = (): never => {
		calls.backup++;
		throw new Error(
			"Unexpected backup operation in a constructor/admission test",
		);
	};
	const dependencies: BrowserReadonlyProjectSourceDependencies = {
		storageNamespace: "legacy",
		admitted: () => {
			calls.admission++;
			return admitted;
		},
		technical: {
			secureContext: true,
			indexedDb: {
				open: () => {
					calls.open++;
					throw new Error("Unexpected native open");
				},
				databases: async () => {
					calls.inventory++;
					return [];
				},
			},
		},
		checksum: { sha256: unused },
		binaryChecksum: { sha256Bytes: unused },
		portable: {
			legacyEncoder: { encode: unused },
			legacySmoke: { verify: unused },
			registeredWriter: { encode: unused },
			registeredSmoke: { verify: unused },
		},
	};
	return { dependencies, calls, deny };
}
const missingPorts = [
	{
		name: "native open",
		change: (d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d.technical.indexedDb, "open", undefined),
	},
	{
		name: "admission callback",
		change: (d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d, "admitted", undefined),
	},
	{
		name: "project checksum",
		change: (d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d.checksum, "sha256", undefined),
	},
	{
		name: "binary checksum",
		change: (d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d.binaryChecksum, "sha256Bytes", undefined),
	},
	{
		name: "legacy encoder",
		change: (d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d.portable.legacyEncoder, "encode", undefined),
	},
	{
		name: "legacy smoke",
		change: (d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d.portable.legacySmoke, "verify", undefined),
	},
	{
		name: "registered writer",
		change: (d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d.portable.registeredWriter, "encode", undefined),
	},
	{
		name: "registered smoke",
		change: (d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d.portable.registeredSmoke, "verify", undefined),
	},
];
for (const port of missingPorts) {
	it(`readonly source refuses a missing ${port.name} before any native/admission/backup call`, () => {
		const f = fixture();
		port.change(f.dependencies);
		expect(() => createBrowserReadonlyProjectSource(f.dependencies)).toThrow();
		expect(f.calls).toEqual({ open: 0, inventory: 0, backup: 0, admission: 0 });
	});
}
for (const value of [
	0,
	-1,
	0.5,
	Number.NaN,
	Number.POSITIVE_INFINITY,
	60001,
	"5000",
]) {
	it(`readonly source refuses an unbounded/noninteger open deadline ${String(value)} without IO`, () => {
		const f = fixture();
		Reflect.set(f.dependencies.technical, "openTimeoutMs", value);
		expect(() => createBrowserReadonlyProjectSource(f.dependencies)).toThrow();
		expect(f.calls).toEqual({ open: 0, inventory: 0, backup: 0, admission: 0 });
	});
}
for (const timeout of [1, 60000]) {
	it(`readonly source accepts the public bounded deadline endpoint ${timeout} with an inert constructor`, async () => {
		const f = fixture();
		Reflect.set(f.dependencies.technical, "openTimeoutMs", timeout);
		const source = createBrowserReadonlyProjectSource(f.dependencies);
		expect(f.calls).toEqual({ open: 0, inventory: 0, backup: 0, admission: 0 });
		expect(source.signal.aborted).toBe(false);
		const closing = source.dispose();
		expect(source.signal.aborted).toBe(true);
		expect(source.dispose()).toBe(closing);
		expect(await checkpoint(closing)).toEqual({
			kind: "resolved",
			value: undefined,
		});
	});
}
it("readonly construction requires explicit supported browser ownership and secure context", () => {
	for (const change of [
		(d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d, "storageNamespace", "telegram"),
		(d: BrowserReadonlyProjectSourceDependencies) =>
			Reflect.set(d.technical, "secureContext", false),
	]) {
		const f = fixture();
		change(f.dependencies);
		expect(() => createBrowserReadonlyProjectSource(f.dependencies)).toThrow();
		expect(f.calls).toEqual({ open: 0, inventory: 0, backup: 0, admission: 0 });
	}
});
it("a real prior reader may transfer its observation ownership only to the same namespace/factory while the new generation has a fresh cancellation signal", async () => {
	const f = fixture(),
		first = createBrowserReadonlyProjectSource(f.dependencies);
	expect(await checkpoint(first.dispose())).toEqual({
		kind: "resolved",
		value: undefined,
	});
	const next = createBrowserReadonlyProjectSource({
		...f.dependencies,
		previousSource: first,
	});
	expect(next.signal).not.toBe(first.signal);
	expect(next.signal.aborted).toBe(false);
	expect(next.getKnownFailure()).toBeUndefined();
	expect(f.calls.open).toBe(0);
	expect(await checkpoint(next.readDirectory())).toEqual({
		kind: "resolved",
		value: {
			projects: [],
			status: { storageNamespace: "legacy", kind: "available" },
		},
	});
	expect(f.calls.inventory).toBe(1);
	expect(f.calls.open).toBe(0);
	expect(f.calls.backup).toBe(0);
	expect(await checkpoint(next.dispose())).toEqual({
		kind: "resolved",
		value: undefined,
	});
});
it("closed live admission stops directory, raw-source and both archive formats before native inventory/open or backup IO", async () => {
	const f = fixture();
	let admitted = true;
	Reflect.set(f.dependencies, "admitted", () => admitted);
	const source = createBrowserReadonlyProjectSource(f.dependencies);
	admitted = false;
	expect(await source.readDirectory()).toEqual({
		projects: [],
		status: { storageNamespace: "legacy", kind: "unavailable" },
	});
	await expect(source.sourceRecovery.listRecoverySources()).rejects.toThrow();
	await expect(
		source.sourceRecovery.readRecoverySource("project", "revision"),
	).rejects.toThrow();
	for (const format of ["legacy", "registered"] as const)
		expect(await source.exportBackup("project", "revision", format)).toEqual({
			kind: "verification-unavailable",
		});
	expect(f.calls.open).toBe(0);
	expect(f.calls.inventory).toBe(0);
	expect(f.calls.backup).toBe(0);
	expect(await checkpoint(source.dispose())).toEqual({
		kind: "resolved",
		value: undefined,
	});
});
it("an absent source lists no raw recovery member, returns no requested member and cannot fabricate either complete archive format", async () => {
	const f = fixture(),
		source = createBrowserReadonlyProjectSource(f.dependencies);
	try {
		expect(
			await checkpoint(source.sourceRecovery.listRecoverySources()),
		).toEqual({ kind: "resolved", value: [] });
		expect(
			await checkpoint(
				source.sourceRecovery.readRecoverySource("project", "revision"),
			),
		).toEqual({ kind: "resolved", value: undefined });
		for (const format of ["legacy", "registered"] as const)
			expect(
				await checkpoint(source.exportBackup("project", "revision", format)),
			).toEqual({
				kind: "resolved",
				value: { kind: "verification-unavailable" },
			});
		expect(f.calls.open).toBe(0);
		expect(f.calls.backup).toBe(0);
		expect(await checkpoint(source.dispose())).toEqual({
			kind: "resolved",
			value: undefined,
		});
	} finally {
		await proofCleanup(f.deny);
	}
});
for (const reason of [undefined, new Error("native open refused")]) {
	it(`a native factory open refusal (${reason === undefined ? "undefined" : "Error"}) settles unavailable without starting any transaction or inventing known storage loss`, async () => {
		const f = fixture();
		Reflect.set(f.dependencies.technical.indexedDb, "databases", async () => {
			f.calls.inventory++;
			return [{ name: "interiors-editor-projects", version: 3 }];
		});
		Reflect.set(f.dependencies.technical.indexedDb, "open", () => {
			f.calls.open++;
			throw reason;
		});
		const source = createBrowserReadonlyProjectSource(f.dependencies);
		try {
			expect(await checkpoint(source.readDirectory())).toEqual({
				kind: "resolved",
				value: {
					projects: [],
					status: { storageNamespace: "legacy", kind: "unavailable" },
				},
			});
			expect(f.calls.open).toBe(1);
			expect(f.calls.inventory).toBe(1);
			expect(f.calls.backup).toBe(0);
			expect(source.signal.aborted).toBe(false);
			expect(source.getKnownFailure()).toBeUndefined();
			expect(await checkpoint(source.dispose())).toEqual({
				kind: "resolved",
				value: undefined,
			});
		} finally {
			await proofCleanup(f.deny);
		}
	});
}
it("a held inventory query is logically cancelled on disposal, cannot open after its late fulfillment and has no started native transaction", async () => {
	const f = fixture();
	let release: (rows: IDBDatabaseInfo[]) => void = () => undefined;
	const entered = held<void>(),
		inventory = new Promise<IDBDatabaseInfo[]>((resolve) => {
			release = resolve;
		});
	Reflect.set(f.dependencies.technical.indexedDb, "databases", () => {
		f.calls.inventory++;
		entered.resolve(undefined);
		return inventory;
	});
	const source = createBrowserReadonlyProjectSource(f.dependencies),
		reading = source.readDirectory();
	void reading.catch(() => undefined);
	try {
		expect(
			await checkpoint(
				Promise.race([
					entered.promise.then(() => true),
					reading.then(
						() => false,
						() => false,
					),
				]),
			),
		).toEqual({ kind: "resolved", value: true });
		const closing = source.dispose();
		expect(source.signal.aborted).toBe(true);
		expect(await checkpoint(closing)).toEqual({
			kind: "resolved",
			value: undefined,
		});
		expect(await checkpoint(reading)).toEqual({
			kind: "resolved",
			value: {
				projects: [],
				status: { storageNamespace: "legacy", kind: "unavailable" },
			},
		});
		release([{ name: "interiors-editor-projects", version: 3 }]);
		for (let i = 0; i < 5; i++) await Promise.resolve();
		expect(f.calls.open).toBe(0);
		expect(f.calls.backup).toBe(0);
	} finally {
		await proofCleanup(() => {
			f.deny();
			release([]);
		});
	}
});
it("an inventory deadline is an unavailable query and cannot provision a database after a late inventory result", async () => {
	rs.useFakeTimers();
	const f = fixture();
	let release: (rows: IDBDatabaseInfo[]) => void = () => undefined;
	const entered = held<void>(),
		inventory = new Promise<IDBDatabaseInfo[]>((resolve) => {
			release = resolve;
		});
	Reflect.set(f.dependencies.technical, "openTimeoutMs", 7);
	Reflect.set(f.dependencies.technical.indexedDb, "databases", () => {
		f.calls.inventory++;
		entered.resolve(undefined);
		return inventory;
	});
	const source = createBrowserReadonlyProjectSource(f.dependencies),
		reading = source.readDirectory();
	void reading.catch(() => undefined);
	try {
		expect(
			await checkpoint(
				Promise.race([
					entered.promise.then(() => true),
					reading.then(
						() => false,
						() => false,
					),
				]),
			),
		).toEqual({ kind: "resolved", value: true });
		await rs.advanceTimersByTimeAsync(7);
		expect(await checkpoint(reading)).toEqual({
			kind: "resolved",
			value: {
				projects: [],
				status: { storageNamespace: "legacy", kind: "unavailable" },
			},
		});
		release([{ name: "interiors-editor-projects", version: 3 }]);
		await rs.advanceTimersByTimeAsync(0);
		expect(f.calls.open).toBe(0);
		expect(f.calls.backup).toBe(0);
		expect(await checkpoint(source.dispose())).toEqual({
			kind: "resolved",
			value: undefined,
		});
	} finally {
		await proofCleanup(() => {
			f.deny();
			release([]);
			rs.clearAllTimers();
			rs.useRealTimers();
		});
	}
});

for (const failure of [undefined, new Error("Owned technical close refused")]) {
	it(`readonly public recovery work enters its owned terminal drain before disposal settles with the exact close refusal (${failure === undefined ? "undefined" : "Error"})`, async () => {
		const f = fixture(),
			technical = readonlyCloseLifecycleDouble(failure);
		let closeArmed = false,
			prematureCloses = 0;
		// This partial event double throws only at the owned-disposal boundary under study.
		// An unexpected setup close is observed instead of crashing the reporter with undefined.
		const factory: Pick<IDBFactory, "open" | "databases"> = {
			databases: technical.factory.databases,
			open(...args) {
				const request = technical.factory.open(...args),
					database = request.result;
				const close = database.close.bind(database);
				database.close = () => {
					if (closeArmed) return close();
					prematureCloses++;
				};
				return request;
			},
		};
		Reflect.set(f.dependencies.technical, "indexedDb", factory);
		const source = createBrowserReadonlyProjectSource(f.dependencies);
		let terminal: ReturnType<typeof technical.holdNextTerminal> | undefined;
		try {
			expect(await checkpoint(source.readDirectory())).toEqual({
				kind: "resolved",
				value: {
					projects: [],
					status: { storageNamespace: "legacy", kind: "available" },
				},
			});
			expect(prematureCloses).toBe(0);
			closeArmed = true;
			terminal = technical.holdNextTerminal();
			const operation = checkpoint(source.sourceRecovery.listRecoverySources());
			expect(await checkpoint(terminal.entered)).toEqual({
				kind: "resolved",
				value: undefined,
			});
			const disposal = source.dispose(),
				settled = checkpoint(disposal);
			expect(source.dispose()).toBe(disposal);
			expect(source.signal.aborted).toBe(true);
			expect(technical.closes()).toBe(0);
			terminal.release();
			expect((await operation).kind).toBe("rejected");
			const result = await settled;
			expect(result.kind).toBe("rejected");
			if (result.kind === "rejected") expect(result.reason).toBe(failure);
			expect(technical.closes()).toBe(1);
		} finally {
			await proofCleanup(() => {
				f.deny();
				closeArmed = false;
				terminal?.release();
			});
		}
	});
}
