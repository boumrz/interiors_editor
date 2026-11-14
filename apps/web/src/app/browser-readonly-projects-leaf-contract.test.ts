import { afterEach, expect, it, rs } from "@rstest/core";
import type {
	BrowserReadonlyProjectSource,
	BrowserReadonlySourceDirectory,
} from "../adapters/persistence/browser-readonly-project-source";
import type { ExportPortableBackupResult } from "../application/export-portable-backup";
import type { ProjectStorageNamespace } from "../application/ports";
import type { ReleaseManifest, ReleaseStartupInput } from "./release-startup";

// Composition-only reader-port double. Its ready bytes are not an archive or a persistence proof.
// The provider remains actual production code; real reader acceptance is checked by native cases.
let cleanup = () => {};
const fixtureGates = new Set<() => void>();
const fixtureDenials = new Set<() => void>();
const scheduleUnit = globalThis.setTimeout,
	cancelUnit = globalThis.clearTimeout;
function unitCompleting<T>(operation: T | PromiseLike<T>): Promise<T> {
	const observed = (async () => {
		let timer: ReturnType<typeof scheduleUnit> | undefined;
		try {
			const done = await Promise.race([
				Promise.resolve(operation).then(
					(value) => ({ kind: "fulfilled" as const, value }),
					(reason) => ({ kind: "rejected" as const, reason }),
				),
				new Promise<{ kind: "pending" }>((resolve) => {
					timer = scheduleUnit(() => resolve({ kind: "pending" }), 250);
				}),
			]);
			if (done.kind === "rejected") throw done.reason;
			expect(done.kind).toBe("fulfilled");
			if (done.kind !== "fulfilled")
				throw new Error("Public test operation did not fulfill");
			return done.value;
		} finally {
			cancelUnit(timer);
		}
	})();
	void observed.catch(() => undefined);
	return observed;
}

function release(): ReleaseStartupInput & { shellManifest: ReleaseManifest } {
	return {
		capabilities: { indexeddb: true, webgl2: false },
		hasControllingWorker: false,
		workerManifest: undefined,
		shellManifest: {
			version: 1,
			workerProtocolVersion: 1,
			appBuildId: "reader-port-contract",
			projectSchemas: { readable: [1, 2], writable: [2] },
			assetSchemas: { readable: [1], writable: [1] },
			catalogSchemas: { readable: [1], writable: [1] },
			minimumCapabilities: ["indexeddb", "webgl2"],
		},
	};
}
interface Leaf {
	readonly source: BrowserReadonlyProjectSource;
	readonly abort: AbortController;
	readonly exports: ReturnType<typeof rs.fn>;
	directory: () => Promise<BrowserReadonlySourceDirectory>;
	file: () => Promise<
		ExportPortableBackupResult | { kind: "verification-unavailable" }
	>;
	failure: "recovery-required" | undefined;
}
async function fixture(directoryTimeoutMs?: number) {
	rs.resetModules();
	rs.doMock("../adapters/persistence/browser-readonly-project-source", {
		spy: true,
	});
	const { createBrowserReadonlyProjectSource } = await unitCompleting(
		import("../adapters/persistence/browser-readonly-project-source"),
	);
	cleanup = () => {
		rs.doUnmock("../adapters/persistence/browser-readonly-project-source");
		rs.resetModules();
	};
	const leaves = new Map<ProjectStorageNamespace, Leaf>();
	rs.mocked(createBrowserReadonlyProjectSource).mockImplementation(
		(dependencies) => {
			const namespace = dependencies.storageNamespace,
				abort = new AbortController(),
				exports = rs.fn();
			let leaf: Leaf;
			const source: BrowserReadonlyProjectSource = {
				storageNamespace: namespace,
				signal: abort.signal,
				getKnownFailure: () => leaf.failure,
				readDirectory: () => leaf.directory(),
				sourceRecovery: {
					listRecoverySources: async () => [],
					readRecoverySource: async () => undefined,
				},
				exportBackup: async (...args) => {
					exports(...args);
					return leaf.file();
				},
				dispose: async () => {
					abort.abort();
				},
			};
			leaf = {
				source,
				abort,
				exports,
				failure: undefined,
				directory: async () => ({
					projects: [
						{
							projectId: "same",
							revisionId: "revision",
							name: "reader-owned",
							updatedAt: "2026-11-05T00:00:00.000Z",
							storageNamespace:
								namespace === "legacy" ? "browser-registered" : "legacy",
						},
					],
					status: { storageNamespace: namespace, kind: "available" },
				}),
				file: async () => ({
					kind: "ready",
					bytes: new Uint8Array([1, 2, 3]),
					filename: "unit-port-only",
					mimeType: "application/zip",
				}),
			};
			leaves.set(namespace, leaf);
			return source;
		},
	);
	const noNative = () => {
		throw new Error("Composition double must not use native storage");
	};
	let actual = release(),
		reads = 0;
	const { createBrowserReadonlyProjects } = await unitCompleting(
		import("./browser-readonly-projects"),
	);
	expect(rs.isMockFunction(createBrowserReadonlyProjects)).toBe(false);
	fixtureDenials.add(() => {
		actual = { ...actual, capabilities: { indexeddb: false, webgl2: false } };
		for (const leaf of leaves.values()) {
			leaf.directory = async () => {
				throw new Error("Fixture source denied during cleanup");
			};
			leaf.file = async () => ({ kind: "verification-unavailable" });
		}
	});
	const runtime = createBrowserReadonlyProjects({
		directoryTimeoutMs,
		readReleaseStartupInput: async () => {
			reads++;
			return actual;
		},
		technical: { secureContext: true, indexedDb: { open: noNative } },
		checksum: {
			sha256: async () => {
				throw new Error("No domain proof in port double");
			},
		},
		binaryChecksum: {
			sha256Bytes: async () => {
				throw new Error("No resource proof in port double");
			},
		},
		portable: {
			legacyEncoder: { encode: noNative },
			legacySmoke: { verify: async () => false },
			registeredWriter: {
				encode: async () => {
					throw new Error("No archive encoding in port double");
				},
			},
			registeredSmoke: { verify: async () => false },
		},
	});
	return {
		runtime,
		leaves,
		reads: () => reads,
		actual: (value: typeof actual) => {
			actual = value;
		},
	};
}
async function proofCleanup(work: () => unknown, inject = false) {
	let timer: ReturnType<typeof scheduleUnit> | undefined;
	try {
		const result = await Promise.race([
			Promise.resolve()
				.then(() => {
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
				})
				.then(
					(value) => ({ kind: "resolved" as const, value }),
					(reason) => ({ kind: "rejected" as const, reason }),
				),
			new Promise<{ kind: "pending" }>((resolve) => {
				timer = scheduleUnit(() => resolve({ kind: "pending" }), 250);
			}),
		]);
		if (result.kind !== "resolved") {
			console.log("BROWSER_READONLY_UNIT_PROOF_INVALID_CLEANUP");
			if (result.kind === "rejected") throw result.reason;
			throw new Error("Owned verification cleanup did not finish");
		}
	} finally {
		cancelUnit(timer);
	}
}
afterEach(async () => {
	await proofCleanup(() => {
		for (const deny of fixtureDenials) deny();
		fixtureDenials.clear();
		for (const release of fixtureGates) release();
		fixtureGates.clear();
		cleanup();
	}, true);
});
it("actual provider qualifies reader-owned rows and forwards one exact selected export to the correct internal source", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const directory = await unitCompleting(f.runtime.readDirectory());
	expect(directory.projects.map((row) => row.storageNamespace)).toEqual([
		"legacy",
		"browser-registered",
	]);
	const leaf = f.leaves.get("browser-registered");
	if (!leaf) throw new Error("missing typed leaf double");
	const expected: ExportPortableBackupResult = {
		kind: "ready",
		bytes: new Uint8Array([4, 5]),
		filename: "unit-port-result",
		mimeType: "application/zip",
	};
	leaf.file = async () => expected;
	expect(
		await unitCompleting(
			f.runtime.exportBackup(
				{
					storageNamespace: "browser-registered",
					projectId: "same",
					revisionId: "revision",
				},
				"registered",
			),
		),
	).toBe(expected);
	expect(leaf.exports).toHaveBeenCalledExactlyOnceWith(
		"same",
		"revision",
		"registered",
		undefined,
	);
	expect(f.leaves.get("legacy")?.exports).not.toHaveBeenCalled();
	expect(f.reads()).toBeGreaterThan(2);
	await unitCompleting(f.runtime.dispose());
});

function gate<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes, reject) => {
		resolve = yes;
		fixtureGates.add(() =>
			reject(new Error("Owned fixture gate released during cleanup")),
		);
	});
	void promise.catch(() => undefined);
	return { promise, resolve };
}
function selected() {
	return {
		storageNamespace: "legacy" as ProjectStorageNamespace,
		projectId: "same",
		revisionId: "revision",
	};
}
function leafAt(
	f: Awaited<ReturnType<typeof fixture>>,
	namespace: ProjectStorageNamespace = "legacy",
) {
	const leaf = f.leaves.get(namespace);
	if (!leaf) throw new Error("missing typed port double");
	return leaf;
}
it("leaf-port composition preserves a typed source refusal exactly without falling back to its neighbor", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const leaf = leafAt(f),
		expected: ExportPortableBackupResult = {
			kind: "rejected",
			reasonCode: "BACKUP_RESOURCE_MISSING",
		};
	leaf.file = async () => expected;
	expect(
		await unitCompleting(f.runtime.exportBackup(selected(), "legacy")),
	).toBe(expected);
	expect(leafAt(f, "browser-registered").exports).not.toHaveBeenCalled();
	await unitCompleting(f.runtime.dispose());
});
for (const reason of [undefined, new Error("leaf port unavailable")])
	it(`leaf-port composition maps an operational source throw to unavailable (${reason === undefined ? "undefined" : "Error"}) and drains cleanly`, async () => {
		const f = await unitCompleting(fixture());
		await unitCompleting(f.runtime.admit(release()));
		leafAt(f).file = async () => {
			throw reason;
		};
		expect(
			await unitCompleting(f.runtime.exportBackup(selected(), "registered")),
		).toEqual({
			kind: "verification-unavailable",
		});
		expect(leafAt(f, "browser-registered").abort.signal.aborted).toBe(false);
		await unitCompleting(expect(f.runtime.dispose()).resolves.toBeUndefined());
	});
it("leaf-port composition keeps cancellation monotonic across a held source result", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const leaf = leafAt(f),
		entered = gate<void>(),
		held = gate<ExportPortableBackupResult>(),
		signal = { aborted: false };
	leaf.file = () => {
		entered.resolve();
		return held.promise;
	};
	const pending = f.runtime.exportBackup(selected(), "registered", signal);
	await unitCompleting(entered.promise);
	signal.aborted = true;
	held.resolve({
		kind: "ready",
		bytes: new Uint8Array([1]),
		filename: "unit-only",
		mimeType: "application/zip",
	});
	expect(await unitCompleting(pending)).toEqual({
		kind: "rejected",
		reasonCode: "BACKUP_CANCELLED",
	});
	expect(leaf.exports).toHaveBeenCalledExactlyOnceWith(
		"same",
		"revision",
		"registered",
		signal,
	);
	await unitCompleting(f.runtime.dispose());
});
it("leaf-port composition captures caller address scalars before any await", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const address = selected(),
		pending = f.runtime.exportBackup(address, "legacy");
	address.projectId = "foreign";
	address.revisionId = "foreign";
	address.storageNamespace = "browser-registered";
	expect((await unitCompleting(pending)).kind).toBe("ready");
	expect(leafAt(f).exports).toHaveBeenCalledExactlyOnceWith(
		"same",
		"revision",
		"legacy",
		undefined,
	);
	expect(leafAt(f, "browser-registered").exports).not.toHaveBeenCalled();
	await unitCompleting(f.runtime.dispose());
});
it("leaf-port composition rejects a held ready result when actual release authority changes before delivery", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const entered = gate<void>(),
		held = gate<ExportPortableBackupResult>();
	leafAt(f).file = () => {
		entered.resolve();
		return held.promise;
	};
	const pending = f.runtime.exportBackup(selected(), "registered");
	await unitCompleting(entered.promise);
	f.actual({
		...release(),
		shellManifest: {
			...release().shellManifest,
			appBuildId: "new-actual-worker",
		},
	});
	held.resolve({
		kind: "ready",
		bytes: new Uint8Array([1]),
		filename: "unit-only",
		mimeType: "application/zip",
	});
	expect(await unitCompleting(pending)).toEqual({
		kind: "verification-unavailable",
	});
	expect(leafAt(f).abort.signal.aborted).toBe(true);
	expect(leafAt(f, "browser-registered").abort.signal.aborted).toBe(true);
	await unitCompleting(f.runtime.dispose());
});
it("leaf-port composition never returns the old generation's ready bytes after re-admission", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const old = leafAt(f),
		entered = gate<void>(),
		held = gate<ExportPortableBackupResult>();
	old.file = () => {
		entered.resolve();
		return held.promise;
	};
	const pending = f.runtime.exportBackup(selected(), "registered");
	await unitCompleting(entered.promise);
	await unitCompleting(f.runtime.admit(release()));
	const current = leafAt(f);
	expect(current.source).not.toBe(old.source);
	held.resolve({
		kind: "ready",
		bytes: new Uint8Array([9]),
		filename: "old-unit-only",
		mimeType: "application/zip",
	});
	expect(await unitCompleting(pending)).toEqual({
		kind: "verification-unavailable",
	});
	expect(old.abort.signal.aborted).toBe(true);
	expect(current.abort.signal.aborted).toBe(false);
	expect(
		(await unitCompleting(f.runtime.exportBackup(selected(), "registered")))
			.kind,
	).toBe("ready");
	await unitCompleting(f.runtime.dispose());
});
it("leaf-port composition preserves sticky recovery classification without hiding the healthy neighboring rows", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const leaf = leafAt(f);
	leaf.directory = async () => {
		leaf.failure = "recovery-required";
		leaf.abort.abort();
		return {
			projects: [],
			status: { storageNamespace: "legacy", kind: "recovery-required" },
		};
	};
	const result = await unitCompleting(f.runtime.readDirectory());
	expect(result.storageSources).toEqual([
		{ storageNamespace: "legacy", kind: "recovery-required" },
		{ storageNamespace: "browser-registered", kind: "available" },
	]);
	expect(result.projects.map((x) => x.storageNamespace)).toEqual([
		"browser-registered",
	]);
	expect(f.runtime.getSourceRecovery("legacy")).toBeUndefined();
	expect(
		(
			await unitCompleting(
				f.runtime.exportBackup(
					{ ...selected(), storageNamespace: "browser-registered" },
					"registered",
				),
			)
		).kind,
	).toBe("ready");
	await unitCompleting(f.runtime.dispose());
});
it("leaf-port composition keeps transient reader refusal local and preserves explicit later retry", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const leaf = leafAt(f),
		healthy = leaf.directory;
	leaf.directory = async () => {
		throw new Error("temporarily busy");
	};
	const result = await unitCompleting(f.runtime.readDirectory());
	expect(result.storageSources[0]).toEqual({
		storageNamespace: "legacy",
		kind: "unavailable",
	});
	expect(result.projects.map((x) => x.storageNamespace)).toEqual([
		"browser-registered",
	]);
	expect(leaf.abort.signal.aborted).toBe(false);
	leaf.directory = healthy;
	expect(
		(await unitCompleting(f.runtime.readDirectory())).projects,
	).toHaveLength(2);
	await unitCompleting(f.runtime.dispose());
});
it("leaf-port composition raw access keeps the exact string and refuses a retained old wrapper after source replacement", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const raw = {
			kind: "unverified-source" as const,
			projectId: "same",
			revisionId: "revision",
			serializedProject: " \u0000broken\ud800\n",
		},
		read = rs.fn(async () => raw),
		leaf = leafAt(f);
	leaf.source.sourceRecovery.readRecoverySource = read;
	leaf.source.sourceRecovery.listRecoverySources = async () => [
		{ kind: "unverified-source", projectId: "same", revisionId: "revision" },
	];
	const recovery = f.runtime.getSourceRecovery("legacy");
	expect(
		await unitCompleting(recovery?.readRecoverySource("same", "revision")),
	).toBe(raw);
	expect(read).toHaveBeenCalledExactlyOnceWith("same", "revision");
	expect(await unitCompleting(recovery?.listRecoverySources())).toHaveLength(1);
	await unitCompleting(f.runtime.admit(release()));
	await unitCompleting(
		expect(
			recovery?.readRecoverySource("same", "revision"),
		).rejects.toBeDefined(),
	);
	expect(read).toHaveBeenCalledTimes(1);
	await unitCompleting(f.runtime.dispose());
});
it("leaf-port composition publishes synchronous revoke and drains its started export before settling one disposal", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const leaf = leafAt(f),
		entered = gate<void>(),
		held = gate<ExportPortableBackupResult>();
	leaf.file = () => {
		entered.resolve();
		return held.promise;
	};
	const pending = f.runtime.exportBackup(selected(), "registered");
	await unitCompleting(entered.promise);
	const closing = f.runtime.dispose();
	expect(f.runtime.dispose()).toBe(closing);
	expect(f.runtime.signal.aborted).toBe(true);
	expect(leaf.abort.signal.aborted).toBe(true);
	let finished = false;
	void closing.then(() => {
		finished = true;
	});
	for (let i = 0; i < 5; i++) await unitCompleting(Promise.resolve());
	expect(finished).toBe(false);
	held.resolve({
		kind: "ready",
		bytes: new Uint8Array([1]),
		filename: "unit-only",
		mimeType: "application/zip",
	});
	expect(await unitCompleting(pending)).toEqual({
		kind: "verification-unavailable",
	});
	await unitCompleting(expect(closing).resolves.toBeUndefined());
});
it("real-reader restoration after a leaf-port double loads the actual native-source implementation", async () => {
	const module = await unitCompleting(
		import("../adapters/persistence/browser-readonly-project-source"),
	);
	expect(rs.isMockFunction(module.createBrowserReadonlyProjectSource)).toBe(
		false,
	);
	const open = rs.fn(() => {
			throw new Error("absent reader must not open");
		}),
		source = module.createBrowserReadonlyProjectSource({
			storageNamespace: "legacy",
			admitted: () => true,
			technical: {
				secureContext: true,
				indexedDb: { open, databases: async () => [] },
			},
			checksum: { sha256: async () => "unused" },
			binaryChecksum: { sha256Bytes: async () => "unused" },
			portable: {
				legacyEncoder: {
					encode() {
						throw new Error("no fabricated file");
					},
				},
				legacySmoke: { verify: async () => false },
				registeredWriter: {
					async encode() {
						throw new Error("no fabricated file");
					},
				},
				registeredSmoke: { verify: async () => false },
			},
		});
	expect(await unitCompleting(source.readDirectory())).toEqual({
		projects: [],
		status: { storageNamespace: "legacy", kind: "available" },
	});
	expect(open).not.toHaveBeenCalled();
	await unitCompleting(expect(source.dispose()).resolves.toBeUndefined());
});
it("leaf-port composition keeps a partial recovery warning from only one source while preserving healthy qualified rows", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const legacy = leafAt(f),
		original = await unitCompleting(legacy.directory());
	legacy.directory = async () => ({ ...original, recoveryNeeded: true });
	const result = await unitCompleting(f.runtime.readDirectory());
	expect(result.recoveryNeeded).toBe(true);
	expect(result.projects.map((row) => row.storageNamespace)).toEqual([
		"legacy",
		"browser-registered",
	]);
	expect(result.storageSources).toEqual([
		{ storageNamespace: "legacy", kind: "available" },
		{ storageNamespace: "browser-registered", kind: "available" },
	]);
	legacy.directory = async () => original;
	const healthy = await unitCompleting(f.runtime.readDirectory());
	expect(Object.hasOwn(healthy, "recoveryNeeded")).toBe(false);
	await unitCompleting(f.runtime.dispose());
});
it("leaf-port composition honors already cancelled file intent before routing even an unknown address", async () => {
	const f = await unitCompleting(fixture());
	await unitCompleting(f.runtime.admit(release()));
	const calls = f.reads();
	expect(
		await unitCompleting(
			f.runtime.exportBackup(selected(), "registered", { aborted: true }),
		),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	expect(
		await unitCompleting(
			Reflect.apply(f.runtime.exportBackup, f.runtime, [
				{ storageNamespace: "foreign" },
				"registered",
				{ aborted: true },
			]),
		),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	expect(leafAt(f).exports).not.toHaveBeenCalled();
	expect(leafAt(f, "browser-registered").exports).not.toHaveBeenCalled();
	expect(f.reads()).toBe(calls);
	await unitCompleting(f.runtime.dispose());
});

it("leaf-port composition bounds an unresolved directory through its configured deadline without losing the healthy neighbor or turning pending into a refusal", async () => {
	const f = await unitCompleting(fixture(7));
	const pendingDirectory = gate<BrowserReadonlySourceDirectory>(),
		entered = gate<void>();
	rs.useFakeTimers();
	try {
		await unitCompleting(f.runtime.admit(release()));
		const leaf = leafAt(f),
			healthy = leaf.directory;
		leaf.directory = () => {
			entered.resolve();
			return pendingDirectory.promise;
		};
		const query = f.runtime.readDirectory();
		void query.catch(() => undefined);
		await unitCompleting(entered.promise);
		await rs.advanceTimersByTimeAsync(7);
		const result = await unitCompleting(query);
		expect(result.storageSources).toEqual([
			{ storageNamespace: "legacy", kind: "unavailable" },
			{ storageNamespace: "browser-registered", kind: "available" },
		]);
		expect(result.projects.map((x) => x.storageNamespace)).toEqual([
			"browser-registered",
		]);
		expect(leaf.abort.signal.aborted).toBe(false);
		pendingDirectory.resolve(await unitCompleting(healthy()));
		await rs.advanceTimersByTimeAsync(0);
		expect(
			(await unitCompleting(f.runtime.readDirectory())).projects,
		).toHaveLength(2);
		await unitCompleting(f.runtime.dispose());
	} finally {
		await proofCleanup(() => {
			pendingDirectory.resolve({
				projects: [],
				status: { storageNamespace: "legacy", kind: "available" },
			});
			rs.clearAllTimers();
			rs.useRealTimers();
		});
	}
});
