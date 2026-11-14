import { expect, it, rs } from "@rstest/core";
import {
	createDevelopmentStartupGate,
	type DevelopmentStartupDependencies,
} from "./development-startup";

const schedule = globalThis.setTimeout,
	cancel = globalThis.clearTimeout;
function complete<T>(promise: Promise<T>): Promise<T> {
	const observed = (async () => {
		let timer: ReturnType<typeof schedule> | undefined;
		try {
			const result = await Promise.race([
				promise.then(
					(value) => ({ kind: "fulfilled" as const, value }),
					(reason) => ({ kind: "rejected" as const, reason }),
				),
				new Promise<{ kind: "pending" }>((resolve) => {
					timer = schedule(() => resolve({ kind: "pending" }), 500);
				}),
			]);
			if (result.kind === "rejected") throw result.reason;
			expect(result.kind).toBe("fulfilled");
			if (result.kind !== "fulfilled")
				throw new Error("Public development startup did not settle");
			return result.value;
		} finally {
			cancel(timer);
		}
	})();
	void observed.catch(() => undefined);
	return observed;
}

function held<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((finish) => {
		resolve = finish;
	});
	return { promise, resolve };
}
function fixture() {
	const calls: string[] = [],
		values = new Set([
			"interiors-editor-shell-old",
			"interiors-editor-browse-old",
			"unrelated-app",
		]);
	let controlled = false,
		marker: string | null = null;
	const unregister = rs.fn(async () => {
		calls.push("unregister");
		return true;
	});
	const registration = {
		scope: "https://editor.test/",
		scriptURLs: ["https://editor.test/sw.js"],
		unregister,
	};
	const dependencies: DevelopmentStartupDependencies & {
		readonly serviceWorker: NonNullable<
			DevelopmentStartupDependencies["serviceWorker"]
		>;
		readonly caches: NonNullable<DevelopmentStartupDependencies["caches"]>;
		readonly reloadState: NonNullable<
			DevelopmentStartupDependencies["reloadState"]
		>;
	} = {
		origin: "https://editor.test",
		serviceWorker: {
			registrations: async () => {
				calls.push("registrations");
				return [registration];
			},
			controllerPresent: () => controlled,
		},
		caches: {
			keys: async () => {
				calls.push("keys");
				return [...values];
			},
			delete: async (name) => {
				calls.push(`delete:${name}`);
				return values.delete(name);
			},
		},
		reloadState: {
			read: () => marker,
			write: () => {
				calls.push("write-marker");
				marker = "requested";
			},
			clear: () => {
				calls.push("clear-marker");
				marker = null;
			},
		},
		reload: () => {
			calls.push("reload");
		},
	};
	return {
		dependencies,
		calls,
		values,
		registration,
		unregister,
		control: (value: boolean) => {
			controlled = value;
		},
		marker: (value: string | null) => {
			marker = value;
		},
		readMarker: () => marker,
	};
}
it("keeps editor startup behind every outstanding unregister and then removes only this app's shell/browse caches", async () => {
	const f = fixture(),
		pending = held<boolean>();
	f.unregister.mockImplementation(async () => {
		f.calls.push("unregister");
		return pending.promise;
	});
	const gate = createDevelopmentStartupGate(f.dependencies);
	let mounted = false;
	const result = gate.start().then((outcome) => {
		if (outcome.kind === "ready") mounted = true;
		return outcome;
	});
	void result.catch(() => undefined);
	try {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(mounted).toBe(false);
		expect(f.calls).not.toContain("keys");
		pending.resolve(true);
		expect(await complete(result)).toEqual({ kind: "ready" });
		expect(f.calls.indexOf("unregister")).toBeLessThan(f.calls.indexOf("keys"));
		expect([...f.values]).toEqual(["unrelated-app"]);
		expect(mounted).toBe(true);
	} finally {
		pending.resolve(true);
	}
});
it("does not mount or delete caches while an unregistered worker still controls this document", async () => {
	const f = fixture();
	f.control(true);
	expect(
		await complete(createDevelopmentStartupGate(f.dependencies).start()),
	).toEqual({
		kind: "reload-requested",
	});
	expect(f.calls).toEqual([
		"registrations",
		"unregister",
		"write-marker",
		"reload",
	]);
	expect(f.readMarker()).toBe("requested");
	expect(f.values.size).toBe(3);
});
it("publishes a stable one-flight promise before reentrant native callbacks and invokes reload at most once", async () => {
	const f = fixture();
	f.control(true);
	let gate: ReturnType<typeof createDevelopmentStartupGate>;
	const seen: Promise<unknown>[] = [];
	f.dependencies.serviceWorker.registrations = async () => {
		seen.push(gate.start());
		return [f.registration];
	};
	gate = createDevelopmentStartupGate(f.dependencies);
	const result = gate.start();
	expect(gate.start()).toBe(result);
	expect(await complete(result)).toEqual({ kind: "reload-requested" });
	expect(seen).toEqual([result]);
	expect(f.calls.filter((call) => call === "reload")).toHaveLength(1);
});
it("blocks a still-controlled next document instead of repeating reload", async () => {
	const f = fixture();
	f.control(true);
	f.marker("requested");
	expect(
		await complete(createDevelopmentStartupGate(f.dependencies).start()),
	).toEqual({
		kind: "blocked",
		reason: "reload-already-requested",
	});
	expect(f.calls).not.toContain("reload");
	expect(f.calls).not.toContain("keys");
});
it("clears the reload marker only after the next uncontrolled document finishes owned cache deletion", async () => {
	const f = fixture();
	f.marker("requested");
	expect(
		await complete(createDevelopmentStartupGate(f.dependencies).start()),
	).toEqual({
		kind: "ready",
	});
	expect(f.readMarker()).toBeNull();
	expect(f.calls.at(-1)).toBe("clear-marker");
	expect(f.calls).not.toContain("reload");
});
it("preserves unrelated workers, cache names and near-prefix names", async () => {
	const f = fixture();
	f.registration.scriptURLs = ["https://editor.test/other-sw.js"];
	f.values.add("interiors-editor-shell");
	f.values.add("interiors-editor-browse");
	expect(
		await complete(createDevelopmentStartupGate(f.dependencies).start()),
	).toEqual({
		kind: "ready",
	});
	expect(f.unregister).not.toHaveBeenCalled();
	expect([...f.values]).toEqual([
		"unrelated-app",
		"interiors-editor-shell",
		"interiors-editor-browse",
	]);
});
it("contains either Error or undefined unregister refusals without starting the editor or deleting any cache", async () => {
	for (const reason of [undefined, new Error("controlled native refusal")]) {
		const f = fixture();
		f.unregister.mockImplementation(async () => {
			throw reason;
		});
		expect(
			await complete(createDevelopmentStartupGate(f.dependencies).start()),
		).toEqual({
			kind: "blocked",
			reason: "cleanup-unavailable",
		});
		expect(f.calls).not.toContain("keys");
		expect(f.calls).not.toContain("reload");
	}
});
it("starts normally when the browser has no worker or Cache API", async () => {
	const f = fixture();
	const gate = createDevelopmentStartupGate({
		origin: f.dependencies.origin,
		reload: f.dependencies.reload,
	});
	expect(await complete(gate.start())).toEqual({ kind: "ready" });
	expect(f.calls).toEqual([]);
});

it("drains every started unregister even when another rejects before refusing startup", async () => {
	const f = fixture(),
		pending = held<boolean>();
	const second = { ...f.registration, unregister: async () => pending.promise };
	f.unregister.mockImplementation(async () => {
		throw undefined;
	});
	f.dependencies.serviceWorker.registrations = async () => [
		f.registration,
		second,
	];
	let done = false;
	const start = createDevelopmentStartupGate(f.dependencies).start();
	void start
		.then(() => {
			done = true;
		})
		.catch(() => undefined);
	try {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(done).toBe(false);
		pending.resolve(true);
		expect(await complete(start)).toEqual({
			kind: "blocked",
			reason: "cleanup-unavailable",
		});
		expect(f.calls).not.toContain("keys");
	} finally {
		pending.resolve(true);
	}
});
it("waits for all owned cache removals before mounting or clearing the reload marker", async () => {
	const f = fixture(),
		pending = held<boolean>();
	f.marker("requested");
	f.dependencies.caches.delete = async (name) =>
		name.includes("shell-") ? pending.promise : f.values.delete(name);
	let mounted = false;
	const start = createDevelopmentStartupGate(f.dependencies).start();
	void start
		.then((outcome) => {
			mounted = outcome.kind === "ready";
		})
		.catch(() => undefined);
	try {
		for (let step = 0; step < 12; step++) await Promise.resolve();
		expect(mounted).toBe(false);
		expect(f.readMarker()).toBe("requested");
		pending.resolve(true);
		expect(await complete(start)).toEqual({ kind: "ready" });
		expect(mounted).toBe(true);
		expect(f.readMarker()).toBeNull();
	} finally {
		pending.resolve(true);
	}
});
it("rechecks live controller state after asynchronous cache deletion rather than mounting a controlled document", async () => {
	const f = fixture();
	f.dependencies.caches.keys = async () => {
		f.control(true);
		return [];
	};
	expect(
		await complete(createDevelopmentStartupGate(f.dependencies).start()),
	).toEqual({ kind: "reload-requested" });
	expect(f.calls).toContain("reload");
});
for (const marker of ["", "foreign-value"]) {
	it(`never loops on a pre-existing reload marker ${JSON.stringify(marker)}`, async () => {
		const f = fixture();
		f.control(true);
		f.marker(marker);
		expect(
			await complete(createDevelopmentStartupGate(f.dependencies).start()),
		).toEqual({ kind: "blocked", reason: "reload-already-requested" });
		expect(f.calls).not.toContain("reload");
	});
}
it("refuses automatic reload if a durable per-tab retry guard is unavailable", async () => {
	const f = fixture();
	f.control(true);
	expect(
		await complete(
			createDevelopmentStartupGate({
				...f.dependencies,
				reloadState: undefined,
			}).start(),
		),
	).toEqual({ kind: "blocked", reason: "cleanup-unavailable" });
	expect(f.calls).not.toContain("reload");
});
for (const fault of [
	"registration-list",
	"cache-list",
	"cache-delete",
	"controller",
	"marker-read",
	"marker-write",
	"marker-clear",
	"reload",
] as const) {
	it(`contains a ${fault} refusal without mounting a stale editor`, async () => {
		const f = fixture();
		const refusal = () => {
			throw undefined;
		};
		if (fault === "registration-list")
			f.dependencies.serviceWorker.registrations = async () => refusal();
		if (fault === "cache-list")
			f.dependencies.caches.keys = async () => refusal();
		if (fault === "cache-delete")
			f.dependencies.caches.delete = async () => refusal();
		if (fault === "controller")
			f.dependencies.serviceWorker.controllerPresent = refusal;
		if (fault === "marker-read") {
			f.control(true);
			f.dependencies.reloadState.read = refusal;
		}
		if (fault === "marker-write") {
			f.control(true);
			f.dependencies.reloadState.write = refusal;
		}
		if (fault === "marker-clear") f.dependencies.reloadState.clear = refusal;
		if (fault === "reload") {
			f.control(true);
			Reflect.set(f.dependencies, "reload", refusal);
		}
		expect(
			await complete(createDevelopmentStartupGate(f.dependencies).start()),
		).toEqual({ kind: "blocked", reason: "cleanup-unavailable" });
	});
}
for (const [scope, scriptURL] of [
	["https://other.test/", "https://other.test/sw.js"],
	["https://editor.test/another/", "https://editor.test/sw.js"],
	["https://editor.test/", "https://editor.test/not-sw.js"],
]) {
	it(`does not unregister a foreign worker at ${scope} using ${scriptURL}`, async () => {
		const f = fixture();
		f.registration.scope = scope;
		f.registration.scriptURLs = [scriptURL];
		expect(
			await complete(createDevelopmentStartupGate(f.dependencies).start()),
		).toEqual({ kind: "ready" });
		expect(f.unregister).not.toHaveBeenCalled();
	});
}
it("can remove an owned installing or waiting registration without an active worker", async () => {
	const f = fixture();
	f.registration.scriptURLs = [
		"https://editor.test/obsolete.js",
		"https://editor.test/sw.js",
	];
	expect(
		await complete(createDevelopmentStartupGate(f.dependencies).start()),
	).toEqual({ kind: "ready" });
	expect(f.unregister).toHaveBeenCalledTimes(1);
});
it("leaves the host untouched until explicit start and preserves one-flight identity after settlement", async () => {
	const f = fixture(),
		gate = createDevelopmentStartupGate(f.dependencies);
	expect(f.calls).toEqual([]);
	const promise = gate.start();
	expect(await complete(promise)).toEqual({ kind: "ready" });
	expect(gate.start()).toBe(promise);
	expect(f.unregister).toHaveBeenCalledTimes(1);
});
