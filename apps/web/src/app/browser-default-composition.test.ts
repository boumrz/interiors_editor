import { afterEach, expect, it, rs } from "@rstest/core";
import type { ReactElement } from "react";
import type { BrowserRuntimeEditorRuntime } from "./browser-runtime-editor";
import type { EditorAppProps } from "./editor-app";

const release = {
	capabilities: { indexeddb: true, webgl2: false },
	hasControllingWorker: false,
	workerManifest: undefined,
	shellManifest: {
		version: 1,
		workerProtocolVersion: 1,
		appBuildId: "default-composition",
		projectSchemas: { readable: [1], writable: [1] },
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		minimumCapabilities: ["indexeddb"],
	},
} as const;
const restores: Array<() => void> = [];
afterEach(() => {
	const errors: unknown[] = [];
	for (const restore of restores.splice(0).reverse()) {
		try {
			restore();
		} catch (error) {
			errors.push(error);
		}
	}
	try {
		rs.doUnmock("./browser-registered-runtime");
		rs.doUnmock("./browser-readonly-projects");
		rs.resetModules();
	} catch (error) {
		errors.push(error);
	}
	if (
		Reflect.get(globalThis, "process").env.BROWSER_DEFAULT39_CLEANUP_CONTROL ===
		"1"
	)
		errors.push(new Error("Controlled cleanup IO failure"));
	if (errors.length)
		throw new Error("BROWSER_DEFAULT39_PROOF_INVALID composition cleanup", {
			cause: errors[0],
		});
});
function requiredReader(runtime: BrowserRuntimeEditorRuntime) {
	const reader = runtime.readonlyProjects;
	expect(reader).toBeDefined();
	if (!reader)
		throw new Error("Expected independently available existing-only reader");
	return reader;
}

async function composition(
	fault?: "writer" | "reader" | "private-owner",
	options: { secure?: boolean; locks?: boolean; enumerate?: boolean; probe?: () => unknown } = {},
) {
	rs.resetModules();
	const values = new Map<string, string>(),
		writes: string[] = [],
		opens: string[] = [],
		requests: string[] = [],
		enumerations: string[] = [],
		lockRequests: string[] = [],
		openRequests: Array<{ name: string; version?: number }> = [];
	const factory = {
		open(name: string, version?: number): IDBOpenDBRequest {
			opens.push(name);
			openRequests.push({ name, version });
			throw new Error("Denial-only native boundary");
		},
		...(options.enumerate === false
			? {}
			: {
					databases: async () => {
						enumerations.push("existing-only");
						return [];
					},
				}),
	};
	const browserWindow = {
		isSecureContext: options.secure ?? true,
		indexedDB: factory,
		crypto: {
			randomUUID: () => "5371249e-807c-466e-8344-08cc3b7c4920",
			getRandomValues: crypto.getRandomValues.bind(crypto),
			subtle: crypto.subtle,
		},
		performance: { getEntriesByType: () => [{ type: "reload" }] },
		sessionStorage: {
			getItem(key: string) {
				if (
					fault === "private-owner" &&
					key.startsWith("interiors-editor-browser-registered-context-v1:")
				)
					throw new Error("Private context unavailable");
				return values.get(key) ?? null;
			},
			setItem(key: string, value: string) {
				writes.push(key);
				values.set(key, value);
			},
		},
	};
	for (const [name, value] of Object.entries({
		window: browserWindow,
		navigator: options.locks
			? {
					locks: {
						request: async (
							name: string,
							_options: LockOptions,
							callback: LockGrantedCallback<unknown>,
						) => {
							lockRequests.push(name);
							return callback(null);
						},
					},
				}
			: {},
		document: { createElement: () => ({ getContext: options.probe ?? (() => null) }) },
		fetch: async (url: string) => {
			requests.push(url);
			return new Response(JSON.stringify(release.shellManifest));
		},
	})) {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
		Object.defineProperty(globalThis, name, { configurable: true, value });
		restores.push(() => {
			if (descriptor) Object.defineProperty(globalThis, name, descriptor);
			else Reflect.deleteProperty(globalThis, name);
		});
	}
	if (fault === "writer")
		rs.doMock("./browser-registered-runtime", () => ({
			createBrowserRegisteredRuntime() {
				throw new Error("Private constructor unavailable");
			},
		}));
	if (fault === "reader")
		rs.doMock("./browser-readonly-projects", () => ({
			createBrowserReadonlyProjects() {
				throw new Error("Reader constructor unavailable");
			},
		}));
	const { BrowserEditorApp } = await import("./browser-editor-app");
	const first: ReactElement<
		EditorAppProps & { runtime: BrowserRuntimeEditorRuntime }
	> = BrowserEditorApp({});
	const second = BrowserEditorApp({});
	return {
		first,
		second,
		writes,
		opens,
		requests,
		enumerations,
		lockRequests,
		openRequests,
	};
}
it("constructs one shared browser runtime without opening or provisioning either database", async () => {
	const f = await composition();
	expect(f.opens).toEqual([]);
	expect(f.requests).toEqual([]);
	expect(f.writes).toEqual([
		"interiors-editor-writer-owner",
		"interiors-editor-browser-registered-context-v1:interiors-editor-writer-owner",
	]);
	expect(f.first.props.runtime).toBe(f.second.props.runtime);
	expect(f.first.props.runtime.controller).toBe(
		f.second.props.runtime.controller,
	);
	expect(f.first.props.runtime.readonlyProjects).toBeDefined();
	expect(
		f.first.props.runtime.getEditorInstanceSnapshot().storageNamespace,
	).toBeUndefined();
	expect(f.first.props.runtime.getReadonlyProjectSources?.()).toEqual([
		"legacy",
		"browser-registered",
	]);
	expect(f.first.props.runtime.canCreateLegacyProject?.()).toBe(false);
	expect(f.first.props.registeredTransferImport).toBe(true);
});
for (const fault of ["writer", "private-owner"] as const) {
	it(`retains legacy composition and independent read recovery after ${fault} setup failure`, async () => {
		const f = await composition(fault);
		expect(f.opens).toEqual([]);
		expect(f.requests).toEqual([]);
		expect(f.first.props.runtime.readonlyProjects).toBeDefined();
		expect(
			f.first.props.runtime.getEditorInstanceSnapshot().storageNamespace,
		).toBeUndefined();
		expect(f.first.props.runtime).toBe(f.second.props.runtime);
		expect(f.first.props.runtime.canCreateLegacyProject?.()).toBe(false);
	});
}
it("retains both controller composition and startup when read-recovery construction fails", async () => {
	const f = await composition("reader");
	expect(f.opens).toEqual([]);
	expect(f.requests).toEqual([]);
	expect(f.first.props.runtime.readonlyProjects).toBeUndefined();
	expect(
		f.first.props.runtime.getEditorInstanceSnapshot().storageNamespace,
	).toBeUndefined();
	expect(f.first.props.runtime).toBe(f.second.props.runtime);
	expect(f.writes).toHaveLength(2);
});

async function finished<T>(operation: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const result = await Promise.race([
			operation.then((value) => ({ kind: "completed" as const, value })),
			new Promise<{ kind: "pending" }>((yes) => {
				timer = setTimeout(() => yes({ kind: "pending" }), 2000);
			}),
		]);
		expect(
			result.kind,
			"in-memory public composition operation completes",
		).toBe("completed");
		if (result.kind !== "completed")
			throw Error("Public completion assertion failed");
		return result.value;
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
it("keeps existing-only read access independent of missing writer locks and WebGL", async () => {
	const f = await composition();
	await finished(f.first.props.runtime.releaseStartup.handshake(release));
	const reader = f.first.props.runtime.readonlyProjects;
	expect(reader).toBeDefined();
	const directory = await finished(
		requiredReader(f.first.props.runtime).readDirectory(),
	);
	expect(directory.projects).toEqual([]);
	expect(directory.storageSources).toEqual([
		{ storageNamespace: "legacy", kind: "available" },
		{
			storageNamespace: "browser-registered",
			kind: "not-provisioned",
			history: "unknown",
		},
	]);
	expect(f.enumerations).toHaveLength(2);
	expect(f.opens).not.toContain("interiors-editor-browser-registered");
	expect(f.lockRequests).toEqual([]);
	expect(f.requests.length).toBeGreaterThan(1);
	expect(new Set(f.requests)).toEqual(new Set(["/release-manifest.json"]));
});
it("refuses insecure existing-only reads before enumerating or opening a source", async () => {
	const f = await composition(undefined, { secure: false });
	await finished(f.first.props.runtime.releaseStartup.handshake(release));
	const directory = await finished(
		requiredReader(f.first.props.runtime).readDirectory(),
	);
	expect(directory.storageSources.map((row) => row.kind)).toEqual([
		"unavailable",
		"unavailable",
	]);
	expect(f.enumerations).toEqual([]);
	expect(f.opens).not.toContain("interiors-editor-browser-registered");
});
it("uses the actual bound open fallback without supplying a creation version when enumeration is absent", async () => {
	const f = await composition(undefined, { enumerate: false });
	await finished(f.first.props.runtime.releaseStartup.handshake(release));
	const directory = await finished(
		requiredReader(f.first.props.runtime).readDirectory(),
	);
	expect(directory.storageSources.map((row) => row.kind)).toEqual([
		"unavailable",
		"unavailable",
	]);
	expect(f.openRequests).toContainEqual({
		name: "interiors-editor-browser-registered",
		version: undefined,
	});
	expect(f.openRequests).toContainEqual({
		name: "interiors-editor-projects",
		version: undefined,
	});
	expect(
		f.openRequests
			.filter((row) => row.name === "interiors-editor-browser-registered")
			.every((row) => row.version === undefined),
	).toBe(true);
});
for (const secure of [true, false])
	it(`the private writer requests its scoped lock only with secure admission (${secure})`, async () => {
		const f = await composition(undefined, { secure, locks: true });
		await finished(f.first.props.runtime.releaseStartup.handshake(release));
		expect(f.lockRequests.length).toBe(secure ? 1 : 0);
		if (secure) expect(f.lockRequests[0]).toContain("browser");
		expect(f.opens).not.toContain("interiors-editor-browser-registered");
	});

it("releases every disposable WebGL capability probe across repeated release checks", async () => {
 const loseContext=rs.fn();
 const getExtension=rs.fn((name:string)=>name==="WEBGL_lose_context"?{loseContext}:null);
 const f=await composition(undefined,{probe:()=>({getExtension})});
 for(let i=0;i<20;i++) {
  const current=await f.first.props.readReleaseStartupInput();
  expect(current.capabilities.webgl2).toBe(true);
 }
 expect(getExtension).toHaveBeenCalledTimes(20);
 expect(getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
 expect(loseContext).toHaveBeenCalledTimes(20);
});
