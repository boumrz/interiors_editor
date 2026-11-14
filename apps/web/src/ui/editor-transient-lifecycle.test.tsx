import { describe, expect, it } from "@rstest/core";
import { createEditorInteractionGate } from "./editor-host-boundary";

function deferred<T>() {
	const controls: {
		resolve?: (value: T) => void;
		reject?: (reason: unknown) => void;
	} = {};
	const promise = new Promise<T>((resolve, reject) => {
		controls.resolve = resolve;
		controls.reject = reject;
	});
	return {
		promise,
		resolve(value: T) {
			controls.resolve?.(value);
		},
		reject(reason: unknown) {
			controls.reject?.(reason);
		},
	};
}

describe("editor transient interaction lifecycle", () => {
	it("keeps a revoked contact invalid when editing resumes and admits only a fresh contact", () => {
		const gate = createEditorInteractionGate();
		const previous = gate.capture();
		expect(gate.isCurrent(previous)).toBe(true);
		gate.suspend();
		expect(gate.canBegin()).toBe(false);
		expect(gate.isCurrent(previous)).toBe(false);
		gate.resume();
		expect(gate.canBegin()).toBe(true);
		expect(gate.isCurrent(previous)).toBe(false);
		expect(gate.isCurrent(gate.capture())).toBe(true);
	});
	it("invalidates layout contacts without a permanent lock and never revives a disposed owner", () => {
		const gate = createEditorInteractionGate();
		const previous = gate.capture();
		gate.invalidateContacts();
		expect(gate.isCurrent(previous)).toBe(false);
		expect(gate.canBegin()).toBe(true);
		const current = gate.capture();
		gate.dispose();
		gate.resume();
		gate.invalidateContacts();
		expect(gate.canBegin()).toBe(false);
		expect(gate.isCurrent(current)).toBe(false);
		expect(gate.isCurrent(gate.capture())).toBe(false);
	});
	it("exposes pending before callback invocation and drains the admitted outcome through suspension", async () => {
		const gate = createEditorInteractionGate();
		const completion = deferred<string>();
		const observed: boolean[] = [];
		const admitted = gate.run(() => {
			observed.push(gate.hasPending());
			return completion.promise;
		});
		expect(observed).toEqual([true]);
		expect(gate.hasPending()).toBe(true);
		expect(gate.canBegin()).toBe(false);
		await expect(
			gate.run(() => {
				observed.push(false);
				return "duplicate";
			}),
		).rejects.toThrow();
		gate.suspend();
		gate.resume();
		expect(gate.hasPending()).toBe(true);
		expect(gate.canBegin()).toBe(false);
		completion.resolve("Durable outcome");
		expect(await admitted).toBe("Durable outcome");
		expect(gate.hasPending()).toBe(false);
		expect(gate.canBegin()).toBe(true);
		expect(observed).toEqual([true]);
	});
	it("preserves the exact error and pending lifetime when an admitted operation settles after disposal", async () => {
		const gate = createEditorInteractionGate();
		const completion = deferred<string>();
		const failure = new Error("native publication failure");
		const admitted = gate.run(() => completion.promise);
		gate.dispose();
		expect(gate.hasPending()).toBe(true);
		completion.reject(failure);
		await expect(admitted).rejects.toBe(failure);
		expect(gate.hasPending()).toBe(false);
		await expect(gate.run(() => "closed write")).rejects.toThrow();
		expect(gate.canBegin()).toBe(false);
	});
});
