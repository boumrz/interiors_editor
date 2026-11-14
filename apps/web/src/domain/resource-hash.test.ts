import { describe, expect, it } from "@rstest/core";
import {
	isSha256ResourceHash,
	sameSha256ResourceHashBits,
} from "./resource-hash";

describe("SHA-256 resource digest bits", () => {
	it("recognizes exactly 64 ASCII hex characters and treats case as the same 256 bits", () => {
		const lower = "0123456789abcdef".repeat(4);
		const upper = lower.toUpperCase();
		const mixed = "0123456789AbCdEf".repeat(4);
		for (const value of [lower, upper, mixed, "0".repeat(64), "f".repeat(64)]) {
			expect(isSha256ResourceHash(value)).toBe(true);
			expect(sameSha256ResourceHashBits(value, value)).toBe(true);
		}
		expect(sameSha256ResourceHashBits(lower, upper)).toBe(true);
		expect(sameSha256ResourceHashBits(upper, mixed)).toBe(true);
		expect(sameSha256ResourceHashBits(mixed, lower)).toBe(true);
	});

	it("rejects malformed names on either side even when their first 256 bits or raw strings match", () => {
		const valid = "a".repeat(64);
		for (const value of [
			"",
			valid.slice(1),
			`${valid}0`,
			`0${valid}`,
			`${valid}\n`,
			`${valid}\r`,
			` ${valid}`,
			`${valid} `,
			`g${valid.slice(1)}`,
			`${valid.slice(0, -1)}g`,
			"ａ".repeat(64),
			`${valid.slice(0, -1)}\u0000`,
		]) {
			expect(isSha256ResourceHash(value)).toBe(false);
			expect(sameSha256ResourceHashBits(value, valid)).toBe(false);
			expect(sameSha256ResourceHashBits(valid, value)).toBe(false);
			expect(sameSha256ResourceHashBits(value, value)).toBe(false);
		}
	});

	it("distinguishes every one of the 256 digest bits", () => {
		const original = new Uint8Array(32);
		const hash = "0".repeat(64);
		for (let bit = 0; bit < 256; bit++) {
			const changed = original.slice();
			changed[Math.floor(bit / 8)] = 1 << (bit % 8);
			const digest = [...changed]
				.map((value) => value.toString(16).padStart(2, "0"))
				.join("");
			expect(sameSha256ResourceHashBits(hash, digest)).toBe(false);
			expect(sameSha256ResourceHashBits(digest, hash)).toBe(false);
		}
	});
});
