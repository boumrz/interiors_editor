import { expect, it } from "@rstest/core";

function browserContext() {
	const values = new Map<string, string>();
	const writes: Array<{ readonly key: string; readonly value: string }> = [];
	return {
		window: {
			crypto: {
				randomUUID: () => "8ded46c5-f267-40e0-997a-1d3fa20a33c4",
			},
			performance: { getEntriesByType: () => [{ type: "navigate" }] },
			sessionStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => {
					values.set(key, value);
					writes.push({ key, value });
				},
			},
		},
		writes,
	};
}

it("loading the shared editor does not select a browser writer or publish browser controls", async () => {
	const browser = browserContext();
	const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: browser.window,
	});
	try {
		const editor = await import("./editor-app");

		expect(typeof editor.EditorApp).toBe("function");
		expect(browser.writes).toEqual([]);
		expect(browser.window.sessionStorage.getItem("interiors-editor-writer-owner"))
			.toBeNull();
		expect(Reflect.get(browser.window, "__interiorsTestControl")).toBeUndefined();
	} finally {
		if (previous) Object.defineProperty(globalThis, "window", previous);
		else Reflect.deleteProperty(globalThis, "window");
	}
});
