import { describe, expect, it } from "@rstest/core";
import type { VerifiedTelegramScope } from "./signed-launch";
import { createTelegramContextState } from "./context-state";

const a = `tma-v1-${"a".repeat(64)}` as VerifiedTelegramScope;
const b = `tma-v1-${"b".repeat(64)}` as VerifiedTelegramScope;
function memory() { const values = new Map<string, string>(); return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; }

describe("Telegram scoped context state", () => {
	it("isolates preferences and reload-stable takeover acknowledgements between accounts without using browser keys", () => {
		const session = memory(); const local = memory(); const stores = { sessionStorage: session, localStorage: local };
		const first = createTelegramContextState(a, stores); const second = createTelegramContextState(b, stores);
		expect(session.values.size + local.values.size).toBe(0);
		first.writerTakeover.requireExplicitTakeover("project"); first.drawingDimensions.write('{"walls":false}');
		expect(second.writerTakeover.requiresExplicitTakeover("project")).toBe(false); expect(second.drawingDimensions.read()).toBeNull();
		const reloaded = createTelegramContextState(a, stores);
		expect(reloaded.writerTakeover.requiresExplicitTakeover("project")).toBe(true); expect(reloaded.drawingDimensions.read()).toBe('{"walls":false}');
		reloaded.writerTakeover.clearExplicitTakeoverRequirement("project"); expect(first.writerTakeover.requiresExplicitTakeover("project")).toBe(false);
		expect([...session.values.keys(), ...local.values.keys()].every((key) => key.startsWith(`interiors-tma-context-v1:${a}:`))).toBe(true);
	});
	it("addresses exact UTF16 Project IDs including lone surrogates without URI encoding or normalization", () => {
		const session = memory(); const state = createTelegramContextState(a, { sessionStorage: session, localStorage: memory() });
		for (const projectId of ["p", "p\ud800", "p\udc00", "p\ud800\udc00", "p%", "p:"]) state.writerTakeover.requireExplicitTakeover(projectId);
		expect(session.values.size).toBe(6);
		for (const projectId of ["p", "p\ud800", "p\udc00", "p\ud800\udc00", "p%", "p:"]) expect(state.writerTakeover.requiresExplicitTakeover(projectId)).toBe(true);
		expect(session.values.get(`interiors-tma-context-v1:${a}:writer-takeover:0070`)).toBe("required");
		expect(session.values.get(`interiors-tma-context-v1:${a}:writer-takeover:0070d800`)).toBe("required");
		expect(session.values.get(`interiors-tma-context-v1:${a}:writer-takeover:0070d800dc00`)).toBe("required");
	});
	it("accepts the inclusive V1 ID bound and rejects invalid IDs before storing an acknowledgement", () => {
		const session = memory(); const state = createTelegramContextState(a, { sessionStorage: session, localStorage: memory() });
		state.writerTakeover.requireExplicitTakeover("p".repeat(256));
		expect(state.writerTakeover.requiresExplicitTakeover("p".repeat(256))).toBe(true);
		for (const value of ["", "p".repeat(257)]) expect(() => state.writerTakeover.requireExplicitTakeover(value)).toThrow();
		expect(session.values.size).toBe(1);
	});
	it("does not treat corrupt or inaccessible technical acknowledgements as permission to write", () => {
		const session = memory(); const stores = { sessionStorage: session, localStorage: memory() }; const state = createTelegramContextState(a, stores);
		state.writerTakeover.requireExplicitTakeover("p"); session.values.set([...session.values.keys()][0], "unknown");
		expect(() => state.writerTakeover.requiresExplicitTakeover("p")).toThrow();
		const failing = createTelegramContextState(a, { ...stores, sessionStorage: { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } } });
		expect(() => failing.writerTakeover.requiresExplicitTakeover("p")).toThrow("denied"); expect(() => failing.writerTakeover.requireExplicitTakeover("p")).toThrow("quota"); expect(() => failing.writerTakeover.clearExplicitTakeoverRequirement("p")).toThrow("quota");
	});
	it("refuses malformed scope before touching either storage", () => {
		const stores = { sessionStorage: memory(), localStorage: memory() };
		for (const value of ["browser", `x${a}`, `${a}x`]) expect(() => createTelegramContextState(value as VerifiedTelegramScope, stores)).toThrow();
		expect(stores.sessionStorage.values.size + stores.localStorage.values.size).toBe(0);
	});
});
