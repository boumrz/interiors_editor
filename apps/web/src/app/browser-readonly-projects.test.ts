import { expect, it } from "@rstest/core";
import {
	boundedSettlement,
	readonlyCloseLifecycleDouble,
} from "../adapters/persistence/browser-readonly-lifecycle.test-support";
import { createBrowserReadonlyProjects } from "./browser-readonly-projects";
import {
	isReleaseManifest,
	type ReleaseManifest,
	type ReleaseStartupInput,
} from "./release-startup";

const release = (): ReleaseStartupInput & {
	shellManifest: ReleaseManifest;
} => ({
	capabilities: { indexeddb: true, webgl2: false },
	hasControllingWorker: false,
	workerManifest: undefined,
	shellManifest: {
		version: 1,
		workerProtocolVersion: 1,
		appBuildId: "readonly-local",
		projectSchemas: { readable: [1, 2], writable: [2] },
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		minimumCapabilities: ["indexeddb", "webgl2"],
	},
});
function fixture(
	readReleaseStartupInput: () => Promise<ReleaseStartupInput> = async () =>
		release(),
	directoryTimeoutMs = 20,
	indexedDb?: Pick<IDBFactory, "open"> & Partial<Pick<IDBFactory, "databases">>,
) {
	let opens = 0;
	const runtime = createBrowserReadonlyProjects({
		readReleaseStartupInput,
		directoryTimeoutMs,
		technical: {
			secureContext: true,
			indexedDb: indexedDb ?? {
				open: () => {
					opens++;
					throw new Error("No creation allowed");
				},
				databases: async () => [],
			},
		},
		checksum: { sha256: async () => "unused" },
		binaryChecksum: { sha256Bytes: async () => "unused" },
		portable: {
			legacyEncoder: {
				encode: () => {
					throw new Error("Unused");
				},
			},
			legacySmoke: { verify: async () => false },
			registeredWriter: {
				encode: async () => {
					throw new Error("Unused");
				},
			},
			registeredSmoke: { verify: async () => false },
		},
	});
	return { runtime, opens: () => opens };
}
it("admits only native read access for a readable release without rendering or writable V1 and never provisions an absent area", async () => {
	expect(isReleaseManifest(release().shellManifest)).toBe(true);
	const f = fixture();
	expect(f.opens()).toBe(0);
	expect(
		(await f.runtime.readDirectory()).storageSources.every(
			(source) => source.kind === "unavailable",
		),
	).toBe(true);
	await f.runtime.admit(release());
	const result = await f.runtime.readDirectory();
	expect(result).toEqual({
		kind: "projects",
		projects: [],
		storageSources: [
			{ storageNamespace: "legacy", kind: "available" },
			{
				storageNamespace: "browser-registered",
				kind: "not-provisioned",
				history: "unknown",
			},
		],
	});
	expect(f.opens()).toBe(0);
	expect(f.runtime.getSourceSignal("legacy")?.aborted).toBe(false);
	expect(f.runtime.getSourceRecovery("legacy")).toBeDefined();
	expect(
		await f.runtime.getSourceRecovery("legacy")?.listRecoverySources(),
	).toEqual([]);
	await f.runtime.dispose();
});
it("rechecks actual current read compatibility, revokes stale source signals and cannot guess an unknown owner", async () => {
	let actual = release();
	const f = fixture(async () => actual);
	await f.runtime.admit(release());
	const before = f.runtime.getSourceSignal("legacy");
	actual = {
		...actual,
		shellManifest: {
			...actual.shellManifest,
			projectSchemas: { readable: [2], writable: [2] },
		},
	};
	expect(
		(await f.runtime.readDirectory()).storageSources.every(
			(source) => source.kind === "unavailable",
		),
	).toBe(true);
	expect(before?.aborted).toBe(true);
	expect(
		await Reflect.apply(f.runtime.exportBackup, f.runtime, [
			{ storageNamespace: "foreign", projectId: "id", revisionId: "r" },
			"registered",
		]),
	).toEqual({ kind: "verification-unavailable" });
	expect(f.opens()).toBe(0);
	await f.runtime.dispose();
});
it("publishes one stable disposal before synchronous revoke and drains an already started actual startup read", async () => {
	let releaseRead: (input: ReleaseStartupInput) => void = () => undefined;
	const held = new Promise<ReleaseStartupInput>((resolve) => {
		releaseRead = resolve;
	});
	const f = fixture(() => held);
	const start = f.runtime.admit(release());
	await Promise.resolve();
	let done = false;
	const dispose = f.runtime.dispose();
	void dispose.then(() => {
		done = true;
	});
	expect(f.runtime.signal.aborted).toBe(true);
	expect(f.runtime.dispose()).toBe(dispose);
	await Promise.resolve();
	expect(done).toBe(false);
	releaseRead(release());
	await Promise.all([start, dispose]);
	expect(done).toBe(true);
	expect(f.opens()).toBe(0);
	expect(f.runtime.getSourceRecovery("legacy")).toBeUndefined();
});

for (const failure of [undefined, new Error("old generation close refused")]) {
	it(`retains an earlier owned generation drain failure until public dispose (${failure === undefined ? "undefined" : "Error"})`, async () => {
		const technical = readonlyCloseLifecycleDouble(failure),
			f = fixture(undefined, 20, technical.factory);
		await f.runtime.admit(release());
		const before = f.runtime.getSourceSignal("legacy");
		expect((await f.runtime.readDirectory()).storageSources[0]?.kind).toBe(
			"available",
		);
		await f.runtime.admit(release());
		for (let n = 0; n < 6; n++) await Promise.resolve();
		expect(before?.aborted).toBe(true);
		expect(technical.closes()).toBe(1);
		expect(f.runtime.getSourceSignal("legacy")).not.toBe(before);
		const disposal = f.runtime.dispose();
		expect(f.runtime.dispose()).toBe(disposal);
		expect(f.runtime.signal.aborted).toBe(true);
		const outcome = await boundedSettlement(disposal);
		expect(outcome.kind).toBe("rejected");
		if (outcome.kind === "rejected") expect(outcome.reason).toBe(failure);
	});
}
