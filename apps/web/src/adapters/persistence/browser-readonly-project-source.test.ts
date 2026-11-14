import { expect, it } from "@rstest/core";
import {
	boundedSettlement,
	readonlyCloseLifecycleDouble,
} from "./browser-readonly-lifecycle.test-support";
import {
	type BrowserReadonlyProjectSource,
	createBrowserReadonlyProjectSource,
} from "./browser-readonly-project-source";

function fixture(
	namespace: "legacy" | "browser-registered",
	admitted = () => true,
	previousSource?: BrowserReadonlyProjectSource,
) {
	let opens = 0;
	const source = createBrowserReadonlyProjectSource({
		storageNamespace: namespace,
		previousSource,
		admitted,
		technical: {
			secureContext: true,
			indexedDb: {
				open: () => {
					opens++;
					throw new Error("Absent DB must not open");
				},
				databases: async () => [],
			},
		},
		checksum: { sha256: async () => "checksum" },
		binaryChecksum: { sha256Bytes: async () => "checksum" },
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
	return { source, opens: () => opens };
}
it("constructs without DB access and distinguishes an absent private area from a proven available empty legacy directory", async () => {
	for (const namespace of ["legacy", "browser-registered"] as const) {
		const f = fixture(namespace);
		expect(f.opens()).toBe(0);
		expect(await f.source.readDirectory()).toEqual({
			projects: [],
			status:
				namespace === "legacy"
					? { storageNamespace: namespace, kind: "available" }
					: {
							storageNamespace: namespace,
							kind: "not-provisioned",
							history: "unknown",
						},
		});
		expect(f.opens()).toBe(0);
		await f.source.dispose();
	}
});
it("refuses reads before admission and synchronously revokes every source capability on disposal", async () => {
	const f = fixture("legacy", () => false);
	expect(await f.source.readDirectory()).toEqual({
		projects: [],
		status: { storageNamespace: "legacy", kind: "unavailable" },
	});
	expect(f.opens()).toBe(0);
	const first = f.source.dispose();
	expect(f.source.signal.aborted).toBe(true);
	expect(f.source.dispose()).toBe(first);
	await first;
	await expect(f.source.sourceRecovery.listRecoverySources()).rejects.toThrow();
});

for (const failure of [undefined, new Error("owned close refused")]) {
	it(`settles exact disposal failure after the owned terminal drain (${failure === undefined ? "undefined" : "Error"})`, async () => {
		const technical = readonlyCloseLifecycleDouble(failure),
			source = createBrowserReadonlyProjectSource({
				storageNamespace: "legacy",
				admitted: () => true,
				technical: { indexedDb: technical.factory, secureContext: true },
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
		expect((await source.readDirectory()).status.kind).toBe("available");
		const terminal = technical.holdNextTerminal(),
			operation = source.sourceRecovery.listRecoverySources().then(
				() => "unexpected value",
				() => "rejected",
			);
		await terminal.entered;
		const disposal = source.dispose();
		expect(source.dispose()).toBe(disposal);
		expect(source.signal.aborted).toBe(true);
		expect(technical.closes()).toBe(0);
		terminal.release();
		expect(await operation).toBe("rejected");
		const outcome = await boundedSettlement(disposal);
		expect(outcome.kind).toBe("rejected");
		if (outcome.kind === "rejected") expect(outcome.reason).toBe(failure);
		expect(technical.closes()).toBe(1);
	});
}

it("cannot inherit observation authority from a copied reader-shaped object", async () => {
	const first = fixture("legacy");
	expect(() => fixture("legacy", () => true, { ...first.source })).toThrow();
	expect(first.opens()).toBe(0);
	await first.source.dispose();
});
it("cannot borrow a real prior reader across namespace or native factory ownership", async () => {
	const first = fixture("legacy");
	expect(() =>
		fixture("browser-registered", () => true, first.source),
	).toThrow();
	expect(() => fixture("legacy", () => true, first.source)).toThrow();
	expect(first.opens()).toBe(0);
	await first.source.dispose();
});
