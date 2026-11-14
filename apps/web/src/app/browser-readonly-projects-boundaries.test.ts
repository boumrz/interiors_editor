import { expect, it, rs } from "@rstest/core";
import { createBrowserReadonlyProjects } from "./browser-readonly-projects";
import type { BrowserReadonlyProjectAddress } from "./browser-readonly-projects-port";
import type { ReleaseManifest, ReleaseStartupInput } from "./release-startup";

function release(): ReleaseStartupInput & { shellManifest: ReleaseManifest } {
	return {
		capabilities: { indexeddb: true, webgl2: false },
		hasControllingWorker: false,
		workerManifest: undefined,
		shellManifest: {
			version: 1,
			workerProtocolVersion: 1,
			appBuildId: "readonly-boundary",
			projectSchemas: { readable: [1, 2], writable: [2] },
			assetSchemas: { readable: [1], writable: [1] },
			catalogSchemas: { readable: [1], writable: [1] },
			minimumCapabilities: ["indexeddb", "webgl2"],
		},
	};
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}
function fixture(
	options: {
		read?: () => Promise<ReleaseStartupInput>;
		databases?: () => Promise<IDBDatabaseInfo[]>;
		timeout?: number;
	} = {},
) {
	const open = rs.fn(() => {
		throw new Error("Readonly absence must never open storage");
	});
	const databases = rs.fn(options.databases ?? (async () => []));
	const runtime = createBrowserReadonlyProjects({
		readReleaseStartupInput: options.read ?? (async () => release()),
		directoryTimeoutMs: options.timeout ?? 20,
		technical: { secureContext: true, indexedDb: { open, databases } },
		checksum: {
			async sha256() {
				throw new Error("No fabricated Project checksum");
			},
		},
		binaryChecksum: {
			async sha256Bytes() {
				throw new Error("No fabricated resource bytes");
			},
		},
		portable: {
			legacyEncoder: {
				encode() {
					throw new Error("No fabricated file");
				},
			},
			legacySmoke: { verify: async () => false },
			registeredWriter: {
				async encode() {
					throw new Error("No fabricated file");
				},
			},
			registeredSmoke: { verify: async () => false },
		},
	});
	return { runtime, open, databases };
}
it("closed provider rejects every future operation and removes both reader-owned raw capabilities synchronously", async () => {
	const x = fixture();
	await x.runtime.admit(release());
	const legacy = x.runtime.getSourceSignal("legacy"),
		registered = x.runtime.getSourceSignal("browser-registered"),
		raw = x.runtime.getSourceRecovery("legacy");
	expect(raw).toBeDefined();
	const closing = x.runtime.dispose();
	expect(x.runtime.signal.aborted).toBe(true);
	expect(legacy?.aborted).toBe(true);
	expect(registered?.aborted).toBe(true);
	expect(x.runtime.getSourceRecovery("legacy")).toBeUndefined();
	await expect(raw?.listRecoverySources()).rejects.toBeDefined();
	await expect(x.runtime.readDirectory()).rejects.toBeDefined();
	await expect(x.runtime.admit(release())).rejects.toBeDefined();
	expect(
		await x.runtime.exportBackup(
			{ storageNamespace: "legacy", projectId: "p", revisionId: "r" },
			"registered",
		),
	).toEqual({ kind: "verification-unavailable" });
	await closing;
	expect(x.open).not.toHaveBeenCalled();
});
it("re-admission revokes the old source capability before awaiting actual source input and late generations cannot replace the newest reader", async () => {
	const first = deferred<ReleaseStartupInput>(),
		later = deferred<ReleaseStartupInput>();
	let calls = 0;
	const x = fixture({
		read: async () => {
			calls++;
			return calls === 2
				? first.promise
				: calls === 3
					? later.promise
					: release();
		},
	});
	await x.runtime.admit(release());
	const old = x.runtime.getSourceSignal("legacy"),
		raw = x.runtime.getSourceRecovery("legacy");
	const a = x.runtime.admit(release());
	expect(old?.aborted).toBe(true);
	expect(x.runtime.getSourceSignal("legacy")).toBeUndefined();
	for (let i = 0; i < 3; i++) await Promise.resolve();
	const b = x.runtime.admit(release());
	for (let i = 0; i < 3; i++) await Promise.resolve();
	later.resolve(release());
	await b;
	const newest = x.runtime.getSourceSignal("legacy");
	expect(newest?.aborted).toBe(false);
	first.resolve(release());
	await a;
	expect(x.runtime.getSourceSignal("legacy")).toBe(newest);
	await expect(raw?.listRecoverySources()).rejects.toBeDefined();
	await x.runtime.dispose();
	expect(x.open).not.toHaveBeenCalled();
});
it("refuses every unsupported actual read profile without inventing an empty confirmed source", async () => {
	const patches: Readonly<Record<string, unknown>>[] = [
		{ shellManifest: undefined },
		{ capabilities: { indexeddb: false, webgl2: true } },
		{ hasControllingWorker: true },
		{
			workerManifest: { ...release().shellManifest, appBuildId: "foreign" },
			hasControllingWorker: true,
		},
		{
			shellManifest: {
				...release().shellManifest,
				projectSchemas: { readable: [2], writable: [2] },
			},
		},
		{
			shellManifest: {
				...release().shellManifest,
				assetSchemas: { readable: [2], writable: [2] },
			},
		},
		{
			shellManifest: {
				...release().shellManifest,
				catalogSchemas: { readable: [2], writable: [2] },
			},
		},
	];
	for (const patch of patches) {
		const actual = { ...release(), ...patch };
		const x = fixture({ read: async () => actual });
		await x.runtime.admit(release());
		const result = await x.runtime.readDirectory();
		expect(result.projects).toEqual([]);
		expect(result.storageSources).toEqual([
			{ storageNamespace: "legacy", kind: "unavailable" },
			{ storageNamespace: "browser-registered", kind: "unavailable" },
		]);
		expect(x.runtime.getSourceSignal("legacy")).toBeUndefined();
		expect(x.runtime.getSourceRecovery("browser-registered")).toBeUndefined();
		expect(x.open).not.toHaveBeenCalled();
		expect(x.databases).not.toHaveBeenCalled();
		await x.runtime.dispose();
	}
});
it("a current source read failure revokes old raw handles and returns unavailable rather than using the last approved snapshot", async () => {
	let fail = false;
	const x = fixture({
		read: async () => {
			if (fail) throw new Error("actual worker read failed");
			return release();
		},
	});
	await x.runtime.admit(release());
	const old = x.runtime.getSourceSignal("legacy"),
		raw = x.runtime.getSourceRecovery("legacy");
	fail = true;
	expect(
		(await x.runtime.readDirectory()).storageSources.every(
			(x) => x.kind === "unavailable",
		),
	).toBe(true);
	expect(old?.aborted).toBe(true);
	await expect(raw?.listRecoverySources()).rejects.toBeDefined();
	expect(x.open).not.toHaveBeenCalled();
	await x.runtime.dispose();
});
it("coalesces pending readonly inventory, bounds the public query and preserves live readers for an explicit later retry", async () => {
	rs.useFakeTimers();
	const inventory = deferred<IDBDatabaseInfo[]>(),
		x = fixture({ databases: () => inventory.promise, timeout: 7 });
	try {
		await x.runtime.admit(release());
		const legacy = x.runtime.getSourceSignal("legacy"),
			registered = x.runtime.getSourceSignal("browser-registered"),
			a = x.runtime.readDirectory(),
			b = x.runtime.readDirectory();
		await rs.advanceTimersByTimeAsync(7);
		for (const result of await Promise.all([a, b]))
			expect(result.storageSources.every((x) => x.kind === "unavailable")).toBe(
				true,
			);
		expect(x.databases).toHaveBeenCalledTimes(2);
		expect(legacy?.aborted).toBe(false);
		expect(registered?.aborted).toBe(false);
		inventory.resolve([]);
		await rs.advanceTimersByTimeAsync(0);
		const retry = await x.runtime.readDirectory();
		expect(retry.storageSources).toEqual([
			{ storageNamespace: "legacy", kind: "available" },
			{
				storageNamespace: "browser-registered",
				kind: "not-provisioned",
				history: "unknown",
			},
		]);
		expect(x.open).not.toHaveBeenCalled();
	} finally {
		inventory.resolve([]);
		await x.runtime.dispose();
		rs.useRealTimers();
	}
});
it("known file cancellation wins before any address routing or native query while malformed owners never fall through to a neighbor", async () => {
	const x = fixture();
	await x.runtime.admit(release());
	const valid: BrowserReadonlyProjectAddress = {
		storageNamespace: "legacy",
		projectId: "p",
		revisionId: "r",
	};
	expect(
		await x.runtime.exportBackup(valid, "registered", { aborted: true }),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	for (const address of [
		null,
		{},
		{ ...valid, storageNamespace: "foreign" },
		{ ...valid, projectId: "" },
		{ ...valid, revisionId: "" },
		{ ...valid, projectId: 7 },
		{ ...valid, revisionId: 7 },
	])
		expect(
			await Reflect.apply(x.runtime.exportBackup, x.runtime, [
				address,
				"registered",
			]),
		).toEqual({ kind: "verification-unavailable" });
	expect(
		await Reflect.apply(x.runtime.exportBackup, x.runtime, [valid, "foreign"]),
	).toEqual({ kind: "verification-unavailable" });
	expect(
		Reflect.apply(x.runtime.getSourceRecovery, x.runtime, ["foreign"]),
	).toBeUndefined();
	expect(
		Reflect.apply(x.runtime.getSourceSignal, x.runtime, ["foreign"]),
	).toBeUndefined();
	expect(x.open).not.toHaveBeenCalled();
	expect(x.databases).not.toHaveBeenCalled();
	await x.runtime.dispose();
});
it("actual worker/shell read agreement admits native reads while renderer and writable V1 remain unavailable", async () => {
	const actual = {
			...release(),
			hasControllingWorker: true,
			workerManifest: release().shellManifest,
		},
		x = fixture({ read: async () => actual });
	await x.runtime.admit(actual);
	const result = await x.runtime.readDirectory();
	expect(result.storageSources[0]?.kind).toBe("available");
	expect(result.storageSources[1]).toEqual({
		storageNamespace: "browser-registered",
		kind: "not-provisioned",
		history: "unknown",
	});
	expect(x.open).not.toHaveBeenCalled();
	await x.runtime.dispose();
});
for (const timeout of [
	0,
	-1,
	0.5,
	60001,
	Number.NaN,
	Number.POSITIVE_INFINITY,
	Number.MAX_SAFE_INTEGER,
])
	it(`rejects a non-supported public directory deadline ${timeout} during inert construction`, () => {
		expect(() => fixture({ timeout })).toThrow(Error);
	});
for (const timeout of [1, 60000])
	it(`admits the supported directory deadline boundary ${timeout} without querying or provisioning storage`, async () => {
		const x = fixture({ timeout });
		expect(x.runtime.signal.aborted).toBe(false);
		expect(x.open).not.toHaveBeenCalled();
		expect(x.databases).not.toHaveBeenCalled();
		await x.runtime.dispose();
		expect(x.runtime.signal.aborted).toBe(true);
	});
it("matching selected and actual manifests still require every V1 read schema and an honest worker-presence pair", async () => {
	const inputs: ReleaseStartupInput[] = [];
	for (const key of [
		"projectSchemas",
		"assetSchemas",
		"catalogSchemas",
	] as const) {
		const actual = release();
		actual.shellManifest = {
			...actual.shellManifest,
			[key]: { readable: [2], writable: [2] },
		};
		inputs.push(actual);
	}
	inputs.push({
		...release(),
		workerManifest: release().shellManifest,
		hasControllingWorker: false,
	});
	for (const actual of inputs) {
		const x = fixture({ read: async () => actual });
		await x.runtime.admit(actual);
		expect(x.runtime.getSourceSignal("legacy")).toBeUndefined();
		expect(x.runtime.getSourceSignal("browser-registered")).toBeUndefined();
		expect((await x.runtime.readDirectory()).storageSources).toEqual([
			{ storageNamespace: "legacy", kind: "unavailable" },
			{ storageNamespace: "browser-registered", kind: "unavailable" },
		]);
		expect(x.open).not.toHaveBeenCalled();
		expect(x.databases).not.toHaveBeenCalled();
		await x.runtime.dispose();
	}
});
