import { expect, test } from "@rstest/core";
import { licenseReceipts } from "./license-receipt";

const when = Date.parse("2026-11-22T15:30:00Z");
test("only an explicitly accepted current edition in the same scope survives reopening", () => {
	const items = new Map<string, string>();
	const storage = () => ({
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => {
			items.set(key, value);
		},
	});
	const reader = licenseReceipts(storage, () => when);
	items.set("interiors:web:license:2026-11-22", new Date(when).toISOString());
	expect(reader.has("web")).toBe(false);
	expect(reader.accept("web")).toBe(true);
	expect(items.get("interiors:web:license:2026-11-22.2")).toBe(
		"2026-11-22T15:30:00.000Z",
	);
	expect(licenseReceipts(storage, () => when).has("web")).toBe(true);
	expect(licenseReceipts(storage, () => when - 1).has("web")).toBe(false);
	expect(reader.has("other")).toBe(false);
});

test("unavailable, unconfirmed or corrupt receipts cannot unlock editing", () => {
	const denied = licenseReceipts(() => {
		throw new Error("Unavailable");
	});
	expect(denied.has("web")).toBe(false);
	expect(denied.accept("web")).toBe(false);
	for (const corrupt of [
		"2026-11-22",
		"2020-01-01T00:00:00.000Z",
		"invalid",
		"",
	]) {
		const receipts = licenseReceipts(
			() => ({ getItem: () => corrupt, setItem() {} }),
			() => when,
		);
		expect(receipts.has("web")).toBe(false);
		expect(receipts.accept("web")).toBe(false);
	}
});

test("the start of the edition is inclusive on the Moscow calendar", () => {
	const start = Date.parse("2026-11-21T21:00:00Z");
	let stored: string | null = null;
	const storage = () => ({
		getItem: () => stored,
		setItem: (_key: string, value: string) => {
			stored = value;
		},
	});
	const before = licenseReceipts(storage, () => start - 1);
	expect(before.accept("web")).toBe(false);
	expect(stored).toBeNull();
	const atStart = licenseReceipts(storage, () => start);
	expect(atStart.accept("web")).toBe(true);
	expect(atStart.has("web")).toBe(true);
});
