import { describe, expect, it, rstest } from "@rstest/core";
import { approveTelegramRelease, isApprovedTelegramRelease, parseTelegramReleaseCapsule } from "./telegram-release-preflight";
import type { ReleaseManifest } from "./release-startup";

const manifest: ReleaseManifest = { appBuildId: "0123456789abcdef", assetSchemas: { readable: [1], writable: [1] }, catalogSchemas: { readable: [1], writable: [1] }, minimumCapabilities: ["indexeddb"], projectSchemas: { readable: [1], writable: [1] }, version: 1, workerProtocolVersion: 1 };
function input() { return { capsule: { deliveryTarget: "telegram", manifest: structuredClone(manifest), entryPath: "/main.12345678.js" }, loadedEntryPath: "/main.12345678.js", capabilities: { indexeddb: true, webgl2: true }, secureContext: true, webLocks: true, hasControllingWorker: false, workerManifest: undefined as unknown }; }

describe("Telegram loaded-shell release preflight", () => {
	it("approves a no-worker Telegram shell and returns an immutable runtime-local permit", () => {
		const value = input(); const result = approveTelegramRelease(value);
		expect(result.kind).toBe("approved"); if (result.kind !== "approved") throw new Error("Expected approval");
		expect(isApprovedTelegramRelease(result.approval)).toBe(true);
		expect(result.approval.manifest).toEqual(manifest);
		expect(isApprovedTelegramRelease(structuredClone({ manifest }))).toBe(false);
		Reflect.set(value.capsule.manifest.projectSchemas, "writable", [1, 2]);
		expect(result.approval.manifest.projectSchemas.writable).toEqual([1]);
		expect(Object.isFrozen(result.approval.manifest.projectSchemas.writable)).toBe(true);
	});
	it("refuses a manifest from another delivery target or an entry different from the script actually loaded", () => {
		for (const patch of [{ capsule: { ...input().capsule, deliveryTarget: "web" } }, { loadedEntryPath: "/main.previous.js" }, { capsule: { ...input().capsule, entryPath: "/../main.js" } }, { capsule: { ...input().capsule, extra: true } }, { capsule: undefined }]) expect(approveTelegramRelease({ ...input(), ...patch })).toMatchObject({ kind: "rejected" });
		for (const path of ["x/main.12345678.js", "/main.12345678.js/extra"]) expect(approveTelegramRelease({ ...input(), loadedEntryPath: path, capsule: { ...input().capsule, entryPath: path } })).toMatchObject({ kind: "rejected" });
	});
	it("does not grant admission to callable or array-shaped metadata with plausible named fields", () => {
		const callable = Object.assign(() => undefined, input().capsule);
		const array = Object.assign([], input().capsule);
		for (const capsule of [callable, array]) expect(approveTelegramRelease({ ...input(), capsule })).toMatchObject({ kind: "rejected" });
	});
	it("requires real secure-context locks and manifested capabilities before granting a permit", () => {
		for (const patch of [{ secureContext: false }, { webLocks: false }, { capabilities: { indexeddb: false, webgl2: true } }]) expect(approveTelegramRelease({ ...input(), ...patch })).toMatchObject({ kind: "rejected" });
		const value = input(); value.capsule.manifest = { ...value.capsule.manifest, minimumCapabilities: ["indexeddb", "webgl2"] }; value.capabilities.webgl2 = false;
		expect(approveTelegramRelease(value)).toMatchObject({ kind: "rejected" });
	});
	it("checks any controlling worker without registering, replacing or removing it", () => {
		expect(approveTelegramRelease({ ...input(), hasControllingWorker: true, workerManifest: structuredClone(manifest) }).kind).toBe("approved");
		for (const workerManifest of [undefined, {}, { ...manifest, appBuildId: "old-build" }]) expect(approveTelegramRelease({ ...input(), hasControllingWorker: true, workerManifest })).toMatchObject({ kind: "rejected" });
		expect(approveTelegramRelease({ ...input(), workerManifest: manifest })).toMatchObject({ kind: "rejected" });
	});
	it("does not accept unsupported schema declarations or malformed release ranges", () => {
		for (const patch of [{ projectSchemas: { readable: [1, 2], writable: [2] } }, { assetSchemas: { readable: [2], writable: [2] } }, { catalogSchemas: { readable: [1], writable: [1, 2] } }, { workerProtocolVersion: 2 }, { version: 2 }, { minimumCapabilities: ["indexeddb", "indexeddb"] }, { assetSchemas: { readable: [1], writable: [] } }]) expect(approveTelegramRelease({ ...input(), capsule: { ...input().capsule, manifest: { ...manifest, ...patch } } })).toMatchObject({ kind: "rejected" });
		for (const key of ["projectSchemas", "assetSchemas", "catalogSchemas"] as const) expect(approveTelegramRelease({ ...input(), capsule: { ...input().capsule, manifest: { ...manifest, [key]: { readable: [1, 2], writable: [1] } } } })).toMatchObject({ kind: "rejected" });
	});
	it("parses only a bounded duplicate-free embedded capsule rather than fetching the current release", () => {
		const raw = JSON.stringify(input().capsule);
		expect(parseTelegramReleaseCapsule(raw)).toEqual(input().capsule);
		for (const value of [undefined, "", "{", raw.replace('"deliveryTarget":"telegram"', '"deliveryTarget":"web","deliveryTarget":"telegram"'), " ".repeat(16 * 1024 + 1) + raw]) expect(parseTelegramReleaseCapsule(value)).toBeUndefined();
	});
	it("bounds UTF8 bytes independently and accepts an exact-size capsule before any Project or storage work", () => {
		const raw = JSON.stringify(input().capsule);
		const exact = raw + " ".repeat(16 * 1024 - raw.length);
		expect(parseTelegramReleaseCapsule(exact)).toEqual(input().capsule);
		const unicode = JSON.stringify(Array.from({ length: 5 }, () => "界".repeat(1200)));
		expect(unicode.length).toBeLessThan(16 * 1024);
		expect(parseTelegramReleaseCapsule(unicode)).toBeUndefined();
	});
	it("refuses excessive raw input before allocating an encoded copy", () => {
		const encode = rstest.spyOn(TextEncoder.prototype, "encode");
		try { expect(parseTelegramReleaseCapsule(" ".repeat(16 * 1024 + 1))).toBeUndefined(); expect(encode).not.toHaveBeenCalled(); }
		finally { encode.mockRestore(); }
	});
});
