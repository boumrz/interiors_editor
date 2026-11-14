import { describe, expect, it } from "@rstest/core";
import { decideBrowserRegisteredWriterLease } from "./browser-registered-writer-lease";

const request = {
	scope: "browser-registered-v1",
	projectId: "project-a",
	ownerId: "owner-a",
	nowEpochMs: 1000,
	durationMs: 3000,
	explicitTakeover: false,
};
const stored = {
	scope: request.scope,
	projectId: request.projectId,
	ownerId: "owner-a",
	fencingToken: 7,
	expiresAtEpochMs: 5000,
	deleted: false,
};

describe("anonymous browser registered writer profile", () => {
	it("acquires the exact browser identity with a positive first generation", () => {
		expect(decideBrowserRegisteredWriterLease(request, undefined)).toEqual({
			kind: "acquired",
			writer: { ...stored, fencingToken: 1, expiresAtEpochMs: 4000 },
		});
	});
	for (const scope of [
		"",
		"legacy",
		"browser-registered-v1 ",
		"browser-registered-v10",
		`tma-v1-${"a".repeat(64)}`,
	]) {
		it(`refuses a foreign scope ${scope} without fabricating a Telegram identity`, () => {
			expect(() =>
				decideBrowserRegisteredWriterLease({ ...request, scope }, undefined),
			).toThrow("Invalid Browser registered writer request");
		});
	}
	it("renews the exact owner's lease without decreasing expiry or mutating metadata", () => {
		const input = structuredClone(stored);
		const actual = decideBrowserRegisteredWriterLease(request, input);
		expect(actual).toEqual({ kind: "acquired", writer: stored });
		if (actual.kind === "acquired") expect(actual.writer).not.toBe(input);
		expect(input).toEqual(stored);
	});
	it("keeps another active context read-only until explicit takeover", () => {
		expect(
			decideBrowserRegisteredWriterLease(
				{ ...request, ownerId: "owner-b" },
				stored,
			),
		).toEqual({ kind: "held-by-another-writer" });
		expect(
			decideBrowserRegisteredWriterLease(
				{ ...request, ownerId: "owner-b", explicitTakeover: true },
				stored,
			),
		).toEqual({
			kind: "acquired",
			writer: {
				...stored,
				ownerId: "owner-b",
				fencingToken: 8,
				expiresAtEpochMs: 4000,
			},
		});
	});
	it("acquires an expired generation with a strictly greater fence", () => {
		expect(
			decideBrowserRegisteredWriterLease(
				{ ...request, nowEpochMs: 5000, ownerId: "owner-b" },
				stored,
			),
		).toEqual({
			kind: "acquired",
			writer: {
				...stored,
				ownerId: "owner-b",
				fencingToken: 8,
				expiresAtEpochMs: 8000,
			},
		});
	});
	for (const value of [
		{ ...stored, scope: "legacy" },
		{ ...stored, projectId: "project-b" },
		{ ...stored, fencingToken: 0 },
		{ ...stored, extra: true },
		[stored],
	]) {
		it("refuses corrupt or foreign persisted ownership without normalization", () => {
			expect(() => decideBrowserRegisteredWriterLease(request, value)).toThrow(
				"Browser registered writer metadata is corrupt",
			);
		});
	}
	it("preserves the deleted Project tombstone and never returns generation zero", () => {
		expect(() =>
			decideBrowserRegisteredWriterLease(request, { ...stored, deleted: true }),
		).toThrow("Browser registered Project was permanently deleted");
	});
	it("fails closed at fence or clock exhaustion", () => {
		expect(() =>
			decideBrowserRegisteredWriterLease(
				{ ...request, explicitTakeover: true },
				{ ...stored, fencingToken: Number.MAX_SAFE_INTEGER },
			),
		).toThrow("Browser registered writer generations are exhausted");
		expect(() =>
			decideBrowserRegisteredWriterLease(
				{ ...request, nowEpochMs: Number.MAX_SAFE_INTEGER },
				undefined,
			),
		).toThrow("Invalid Browser registered writer request");
	});
});
