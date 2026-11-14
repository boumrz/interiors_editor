import { describe, expect, it } from "@rstest/core";
import { decideTelegramWriterLease } from "./telegram-writer-lease";

const scope = `tma-v1-${"a".repeat(64)}`;
const request = {
	scope,
	projectId: "project-a",
	ownerId: "context-a",
	nowEpochMs: 10_000,
	durationMs: 3_000,
	explicitTakeover: false,
} as const;
const writer = {
	scope,
	projectId: "project-a",
	ownerId: "context-a",
	fencingToken: 7,
	expiresAtEpochMs: 11_000,
	deleted: false,
} as const;

describe("Telegram durable writer generations", () => {
	it("starts a new Project at token one and preserves the complete identity", () => {
		expect(decideTelegramWriterLease(request, undefined)).toEqual({
			kind: "acquired",
			writer: { ...writer, fencingToken: 1, expiresAtEpochMs: 13_000 },
		});
	});

	it("renews only the same active owner without changing its generation", () => {
		expect(decideTelegramWriterLease(request, writer)).toEqual({
			kind: "acquired",
			writer: { ...writer, expiresAtEpochMs: 13_000 },
		});
		expect(
			decideTelegramWriterLease({ ...request, nowEpochMs: 1_000 }, writer),
		).toEqual({ kind: "acquired", writer });
	});

	it("does not acquire another active writer implicitly", () => {
		expect(
			decideTelegramWriterLease({ ...request, ownerId: "context-b" }, writer),
		).toEqual({ kind: "held-by-another-writer" });
	});

	it("increments the persisted generation on explicit takeover and exact expiry", () => {
		for (const ownerId of ["context-a", "context-b"]) {
			expect(
				decideTelegramWriterLease(
					{ ...request, ownerId, explicitTakeover: true },
					writer,
				),
			).toEqual({
				kind: "acquired",
				writer: {
					...writer,
					ownerId,
					fencingToken: 8,
					expiresAtEpochMs: 13_000,
				},
			});
			expect(
				decideTelegramWriterLease(
					{ ...request, ownerId, nowEpochMs: 11_000 },
					writer,
				),
			).toEqual({
				kind: "acquired",
				writer: {
					...writer,
					ownerId,
					fencingToken: 8,
					expiresAtEpochMs: 14_000,
				},
			});
		}
	});

	it("never resurrects a permanently deleted Project even through takeover", () => {
		for (const explicitTakeover of [false, true]) {
			expect(() =>
				decideTelegramWriterLease(
					{ ...request, explicitTakeover },
					{ ...writer, deleted: true },
				),
			).toThrow();
		}
	});

	it("fails closed on corrupted or foreign persisted generations", () => {
		for (const current of [
			null,
			[],
			Object.assign([], writer),
			{ ...writer, extra: true },
			{ ...writer, scope: `tma-v1-${"b".repeat(64)}` },
			{ ...writer, projectId: "project-b" },
			{ ...writer, ownerId: "" },
			{ ...writer, ownerId: ["context-a"] },
			{ ...writer, ownerId: { length: 1 } },
			{ ...writer, deleted: undefined },
			{ ...writer, fencingToken: 0 },
			{ ...writer, fencingToken: 1.5 },
			{ ...writer, fencingToken: Number.MAX_SAFE_INTEGER + 1 },
			{ ...writer, expiresAtEpochMs: Number.NaN },
			{ ...writer, expiresAtEpochMs: -1 },
		]) {
			expect(() => decideTelegramWriterLease(request, current)).toThrow();
		}
	});

	it("does not wrap an exhausted fence, while allowing renewal of its active owner", () => {
		const lastWriter = { ...writer, fencingToken: Number.MAX_SAFE_INTEGER };
		expect(decideTelegramWriterLease(request, lastWriter)).toEqual({
			kind: "acquired",
			writer: { ...lastWriter, expiresAtEpochMs: 13_000 },
		});
		expect(() =>
			decideTelegramWriterLease(
				{ ...request, explicitTakeover: true },
				lastWriter,
			),
		).toThrow();
		expect(() =>
			decideTelegramWriterLease({ ...request, nowEpochMs: 11_000 }, lastWriter),
		).toThrow();
	});

	it("rejects invalid time, overflow and identity without issuing a writer", () => {
		for (const invalid of [
			{ nowEpochMs: Number.NaN },
			{ nowEpochMs: -1 },
			{ nowEpochMs: 0.5 },
			{ nowEpochMs: Number.MAX_SAFE_INTEGER - 2 },
			{ durationMs: 0 },
			{ durationMs: -1 },
			{ durationMs: 0.5 },
			{ ownerId: "" },
			{ projectId: "" },
			{ scope: "unverified" },
			{ scope: `prefix-${scope}` },
			{ scope: `${scope}-suffix` },
		]) {
			expect(() =>
				decideTelegramWriterLease({ ...request, ...invalid }, undefined),
			).toThrow();
		}
	});

	it("accepts epoch-zero boundaries without resetting an expired generation", () => {
		expect(decideTelegramWriterLease({ ...request, nowEpochMs: 0 }, undefined)).toEqual({ kind: "acquired", writer: { ...writer, fencingToken: 1, expiresAtEpochMs: 3_000 } });
		expect(decideTelegramWriterLease(request, { ...writer, expiresAtEpochMs: 0 })).toEqual({ kind: "acquired", writer: { ...writer, fencingToken: 8, expiresAtEpochMs: 13_000 } });
	});
});
