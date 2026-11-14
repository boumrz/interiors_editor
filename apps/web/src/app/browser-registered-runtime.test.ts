import { expect, it } from "@rstest/core";
import { createBrowserRegisteredRuntime } from "./browser-registered-runtime";
import type { ReleaseStartupInput } from "./release-startup";

const manifest = {
	version: 1,
	workerProtocolVersion: 1,
	appBuildId: "browser-test",
	minimumCapabilities: ["indexeddb", "webgl2"],
	projectSchemas: { readable: [1], writable: [1] },
	assetSchemas: { readable: [1], writable: [1] },
	catalogSchemas: { readable: [1], writable: [1] },
};
function input(): ReleaseStartupInput {
	return {
		shellManifest: structuredClone(manifest),
		workerManifest: undefined,
		hasControllingWorker: false,
		capabilities: { indexeddb: true, webgl2: true },
	};
}
function fixture(read = async () => input()) {
	const writes = new Map<string, string>();
	let opens = 0,
		ids = 0;
	const runtime = createBrowserRegisteredRuntime({
		context: {
			indexedDb: {
				open() {
					opens++;
					throw new Error(
						"No database in this constructor/handshake boundary fixture",
					);
				},
			},
			secureContext: true,
			locks: {
				request: async () => {
					throw new Error("Unavailable lock fixture");
				},
			},
			crypto,
			sessionStorage: {
				getItem: (key) => writes.get(key) ?? null,
				setItem: (key, value) => {
					writes.set(key, value);
				},
			},
			navigationType: "navigate",
			readReleaseStartupInput: read,
		},
		ports: {
			checksum: { sha256: async () => "unused" },
			binaryChecksum: { sha256Bytes: async () => "unused" },
			ids: {
				next: () => {
					ids++;
					return "must-not-allocate";
				},
			},
			clock: { now: () => "2026-11-05T00:00:00.000Z" },
			storageEstimate: { estimateStorage: async () => ({}) },
		},
	});
	return { runtime, writes, opens: () => opens, ids: () => ids };
}
it("constructs only browser-owned technical identity and refuses generic new-Project paths before any DB/ID allocation", async () => {
	const f = fixture();
	expect(f.opens()).toBe(0);
	expect(f.ids()).toBe(0);
	expect([...f.writes.keys()]).toEqual([
		"interiors-editor-browser-registered-context-v1:interiors-editor-writer-owner",
	]);
	expect(await f.runtime.controller.create("Forbidden")).toEqual({
		kind: "not-ready",
	});
	expect(
		await f.runtime.controller.importProjectTransfer(Uint8Array.of(1)),
	).toEqual({ kind: "not-ready" });
	expect(
		await f.runtime.controller.importProjectJson(Uint8Array.of(123, 125)),
	).toEqual({
		kind: "not-ready",
	});
	expect(
		await f.runtime.controller.importPortableBackup(Uint8Array.of(80, 75)),
	).toEqual({ kind: "not-ready" });
	expect(
		await f.runtime.controller.importRecoveryDraft(Uint8Array.of(1)),
	).toEqual({ kind: "not-ready" });
	expect(() => f.runtime.controller.startNewProject()).toThrow(
		"Only explicit registered import",
	);
	expect(await f.runtime.readDirectory()).toEqual({ kind: "unavailable" });
	expect(f.opens()).toBe(0);
	expect(f.ids()).toBe(0);
	await f.runtime.dispose();
});
it("checks actual loaded browser metadata rather than a caller's healthy manifest before any DB capability", async () => {
	const f = fixture(async () => ({
		...input(),
		shellManifest: { ...manifest, appBuildId: "different-loaded-build" },
	}));
	expect(await f.runtime.releaseStartup.handshake(input())).toEqual({
		kind: "read-only/exportable",
		recovery: {},
	});
	expect(f.opens()).toBe(0);
	await expect(
		f.runtime.controller.importRegisteredPortableBackup(Uint8Array.of(80, 75)),
	).rejects.toThrow("not admitted");
	expect(f.ids()).toBe(0);
	await f.runtime.dispose();
});
it("disposal is stable, revokes immediately and drains the whole held actual startup read/outcome without adopting a late capability", async () => {
	let release: (value: ReleaseStartupInput) => void = () => {};
	const held = new Promise<ReleaseStartupInput>((resolve) => {
		release = resolve;
	});
	const f = fixture(() => held);
	const starting = f.runtime.releaseStartup.handshake(input());
	let closed = false;
	const disposal = f.runtime.dispose();
	void disposal.then(() => {
		closed = true;
	});
	expect(f.runtime.dispose()).toBe(disposal);
	await Promise.resolve();
	expect(closed).toBe(false);
	release(input());
	expect(await starting).toEqual({
		kind: "read-only/exportable",
		recovery: {},
	});
	await disposal;
	expect(closed).toBe(true);
	expect(await f.runtime.readDirectory()).toEqual({ kind: "unavailable" });
	expect(f.opens()).toBe(0);
	expect(f.ids()).toBe(0);
});
