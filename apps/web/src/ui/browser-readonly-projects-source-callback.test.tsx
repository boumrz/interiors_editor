import { expect, test } from "@rstest/core";
import { BrowserReadonlyProjectsSession } from "./browser-readonly-projects";

// Observe errors at this supplied signal boundary without changing native dispatch.
// This keeps an asynchronous listener error inside its actual test's assertion.
test("ordinary source revocation completes its native callbacks without a detached listener exception", async () => {
	const lifetime = new AbortController(), source = new AbortController(), signal = source.signal;
 const model = new BrowserReadonlyProjectsSession({ signal: lifetime.signal, getSourceSignal: (namespace) => namespace === "legacy" ? signal : undefined, getSourceRecovery: () => undefined, readDirectory: async () => ({ kind: "projects", projects: [{ storageNamespace: "legacy", projectId: "owned", revisionId: "revision", name: "Owned", updatedAt: "2026-11-05" }], storageSources: [{ storageNamespace: "legacy", kind: "available" }] }), exportBackup: async () => ({ kind: "verification-unavailable" }) });
	if (!signal) throw new Error("Missing owned native signal");
	const errors: unknown[] = [];
	const nativeAdd = signal.addEventListener.bind(signal), nativeRemove = signal.removeEventListener.bind(signal);
	const wrappers = new Map<EventListenerOrEventListenerObject, EventListener>();
	Object.defineProperty(signal, "addEventListener", { configurable: true, value(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
		if (!listener) return;
		const wrapped: EventListener = (event) => { try { if (typeof listener === "function") listener.call(signal, event); else listener.handleEvent(event); } catch (error) { errors.push(error); } };
		wrappers.set(listener, wrapped); nativeAdd(type, wrapped, options);
	} });
	Object.defineProperty(signal, "removeEventListener", { configurable: true, value(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
		if (listener) nativeRemove(type, wrappers.get(listener) ?? listener, options);
	} });
	try {
		await model.start();
		source.abort();
		expect(errors).toEqual([]);
		expect(model.snapshot().directory?.projects).toEqual([]);
	} finally {
		model.dispose();
		for (const wrapped of wrappers.values()) nativeRemove("abort", wrapped);
		Reflect.deleteProperty(signal, "addEventListener"); Reflect.deleteProperty(signal, "removeEventListener");
	}
});

