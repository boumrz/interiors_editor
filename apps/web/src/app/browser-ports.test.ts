import { describe, expect, it } from "@rstest/core";
import {
	browserRandomUuid,
	browserWriterOwnerId,
	browserWriterTakeoverRequirements,
} from "./browser-ports";

function memorySessionStorage(initial?: string) {
	const values = new Map<string, string>();
	const writes: Array<{ readonly key: string; readonly value: string }> = [];
	if (initial) {
		values.set("interiors-editor-writer-owner", initial);
	}
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			writes.push({ key, value });
			values.set(key, value);
		},
		writes,
	};
}

const deterministicCrypto = {
	getRandomValues: (bytes: Uint8Array) => {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = index + 1;
		}
		return bytes;
	},
};

describe("browser identity ports", () => {
	it("creates UUID-shaped IDs when an insecure LAN origin lacks crypto.randomUUID", () => {
		const insecureOriginCrypto = {
			getRandomValues: (bytes: Uint8Array) => {
				for (let index = 0; index < bytes.length; index += 1) {
					bytes[index] = index + 1;
				}
				return bytes;
			},
		};

		expect(browserRandomUuid(insecureOriginCrypto)).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});

	it("rotates a copied session owner for a newly duplicated browser context", () => {
		const storage = memorySessionStorage("owner-copied-from-opener");

		const ownerId = browserWriterOwnerId({
			crypto: deterministicCrypto,
			navigationType: "navigate",
			sessionStorage: storage,
		});

		expect(ownerId).not.toBe("owner-copied-from-opener");
		expect(storage.getItem("interiors-editor-writer-owner")).toBe(ownerId);
	});

	it("retains the same writer owner across an ordinary reload", () => {
		const storage = memorySessionStorage("owner-before-reload");

		expect(
			browserWriterOwnerId({
				crypto: deterministicCrypto,
				navigationType: "reload",
				sessionStorage: storage,
			}),
		).toBe("owner-before-reload");
	});

	it("retains an observed foreign writer requirement across a reload until takeover", () => {
		const storage = memorySessionStorage("owner-before-reload");
		const beforeReload = browserWriterTakeoverRequirements({
			sessionStorage: storage,
		});

		beforeReload.requireExplicitTakeover("project-1");

	const afterReload = browserWriterTakeoverRequirements({
		sessionStorage: storage,
	});
	expect(afterReload.requiresExplicitTakeover("project-1")).toBe(true);
	expect(afterReload.requiresExplicitTakeover("project-2")).toBe(false);

	afterReload.clearExplicitTakeoverRequirement("project-1");
	expect(beforeReload.requiresExplicitTakeover("project-1")).toBe(false);
	expect(storage.writes.at(-1)).toEqual({
		key: "interiors-editor-writer-takeover-required:project-1",
		value: "cleared",
	});
});
});
