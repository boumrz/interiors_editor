import { describe, expect, it } from "@rstest/core";
import {
	approveReadableTelegramRelease,
	isApprovedReadableTelegramRelease,
} from "./telegram-readable-release";
import {
	approveTelegramRelease,
	isApprovedTelegramRelease,
} from "./telegram-release-preflight";
import type { ReleaseManifest } from "./release-startup";

function input() {
	const manifest: ReleaseManifest = {
		appBuildId: "readonly-actual-shell",
		assetSchemas: { readable: [1, 2], writable: [2] },
		catalogSchemas: { readable: [1, 2], writable: [2] },
		projectSchemas: { readable: [1, 2], writable: [2] },
		minimumCapabilities: ["indexeddb", "webgl2"],
		version: 1,
		workerProtocolVersion: 1,
	};
	return {
		capsule: {
			deliveryTarget: "telegram",
			entryPath: "/main.12345678.js",
			manifest,
		},
		loadedEntryPath: "/main.12345678.js",
		capabilities: { indexeddb: true, webgl2: false },
		secureContext: true,
		webLocks: false,
		hasControllingWorker: false,
		workerManifest: undefined as unknown,
	};
}
function approved(value = input()) {
	const result = approveReadableTelegramRelease(value);
	expect(result.kind).toBe("approved");
	if (result.kind !== "approved") throw new Error("Expected readable approval");
	return result.approval;
}

describe("loaded Telegram read-only release permit", () => {
	it("admits readable V1 export without granting writer or renderer capabilities", () => {
		const value = input();
		const result = approved(value);
		expect(isApprovedReadableTelegramRelease(result)).toBe(true);
		expect(isApprovedTelegramRelease(result)).toBe(false);
		expect(approveTelegramRelease(value).kind).toBe("rejected");
		expect(result.entryPath).toBe(value.loadedEntryPath);
		expect(result.manifest).toEqual(value.capsule.manifest);
	});
	it("requires secure IndexedDB but does not require writer locks or WebGL", () => {
		for (const patch of [
			{ secureContext: false },
			{ capabilities: { indexeddb: false, webgl2: true } },
		])
			expect(approveReadableTelegramRelease({ ...input(), ...patch })).toEqual({
				kind: "rejected",
				reason: "storage-unavailable",
			});
		expect(
			approveReadableTelegramRelease({ ...input(), webLocks: undefined }).kind,
		).toBe("approved");
	});
	it("binds the exact actual Telegram entry and capsule shape", () => {
		for (const capsule of [
			undefined,
			null,
			[],
			Object.assign([], input().capsule),
			Object.assign(() => undefined, input().capsule),
			{ ...input().capsule, extra: 1 },
			{ ...input().capsule, deliveryTarget: "web" },
			{ ...input().capsule, manifest: {} },
		])
			expect(approveReadableTelegramRelease({ ...input(), capsule })).toEqual({
				kind: "rejected",
				reason: "release-incompatible",
			});
		expect(
			approveReadableTelegramRelease({
				...input(),
				loadedEntryPath: "/main.old.js",
			}).kind,
		).toBe("rejected");
		for (const entryPath of [
			"main.12345678.js",
			"/../main.12345678.js",
			"/main.12345678.js/trailing",
			"/main.js",
			"/main..js",
			"/main.12345678.js\n",
		])
			expect(
				approveReadableTelegramRelease({
					...input(),
					loadedEntryPath: entryPath,
					capsule: { ...input().capsule, entryPath },
				}).kind,
			).toBe("rejected");
	});
	it("requires actual V1 readability in every schema family and validates existing release grammar", () => {
		for (const key of [
			"projectSchemas",
			"assetSchemas",
			"catalogSchemas",
		] as const) {
			const value = input();
			const manifest = {
				...value.capsule.manifest,
				[key]: { readable: [2], writable: [2] },
			};
			expect(
				approveReadableTelegramRelease({
					...value,
					capsule: { ...value.capsule, manifest },
				}).kind,
			).toBe("rejected");
		}
		for (const patch of [
			{ version: 2 },
			{ workerProtocolVersion: 2 },
			{ appBuildId: "" },
			{ minimumCapabilities: ["unknown"] },
			{ minimumCapabilities: ["indexeddb", "indexeddb"] },
			{ projectSchemas: { readable: [1], writable: [] } },
		])
			expect(
				approveReadableTelegramRelease({
					...input(),
					capsule: {
						...input().capsule,
						manifest: { ...input().capsule.manifest, ...patch },
					},
				}).kind,
			).toBe("rejected");
	});
	it("requires exact controlling worker coherence and never treats missing metadata as a worker-free shell", () => {
		const value = input();
		expect(
			approveReadableTelegramRelease({
				...value,
				hasControllingWorker: true,
				workerManifest: structuredClone(value.capsule.manifest),
			}).kind,
		).toBe("approved");
		for (const workerManifest of [
			undefined,
			{},
			{ ...value.capsule.manifest, appBuildId: "other" },
		])
			expect(
				approveReadableTelegramRelease({
					...value,
					hasControllingWorker: true,
					workerManifest,
				}).kind,
			).toBe("rejected");
		expect(
			approveReadableTelegramRelease({
				...value,
				workerManifest: value.capsule.manifest,
			}).kind,
		).toBe("rejected");
	});
	it("owns a deeply frozen metadata snapshot and rejects copied, null or primitive permits", () => {
		const value = input();
		const result = approved(value);
		Reflect.set(value.capsule.manifest, "appBuildId", "mutated");
		Reflect.set(value.capsule.manifest.projectSchemas, "readable", [2]);
		expect(result.manifest.appBuildId).toBe("readonly-actual-shell");
		expect(result.manifest.projectSchemas.readable).toEqual([1, 2]);
		for (const item of [
			result,
			result.manifest,
			result.manifest.minimumCapabilities,
			result.manifest.projectSchemas,
			result.manifest.projectSchemas.readable,
			result.manifest.projectSchemas.writable,
			result.manifest.assetSchemas,
			result.manifest.assetSchemas.readable,
			result.manifest.assetSchemas.writable,
			result.manifest.catalogSchemas,
			result.manifest.catalogSchemas.readable,
			result.manifest.catalogSchemas.writable,
		])
			expect(Object.isFrozen(item)).toBe(true);
		for (const item of [
			undefined,
			null,
			false,
			"permit",
			1,
			[],
			{},
			{ ...result },
			structuredClone(result),
		])
			expect(isApprovedReadableTelegramRelease(item)).toBe(false);
	});
	it("keeps stable incompatibility reasons for unreadable V1 and a changed controlling worker", () => {
		const value = input();
		expect(
			approveReadableTelegramRelease({
				...value,
				capsule: {
					...value.capsule,
					manifest: {
						...value.capsule.manifest,
						projectSchemas: { readable: [2], writable: [2] },
					},
				},
			}),
		).toEqual({ kind: "rejected", reason: "release-incompatible" });
		expect(
			approveReadableTelegramRelease({
				...value,
				hasControllingWorker: true,
				workerManifest: { ...value.capsule.manifest, appBuildId: "other" },
			}),
		).toEqual({ kind: "rejected", reason: "release-incompatible" });
	});
});
