import { expect, it } from "@rstest/core";
import type { ReactElement } from "react";
import validCatalogEnvelope from "../../../../contracts/catalog-control-plane/fixtures/catalog-envelope-v1.valid.json" with {
	type: "json",
};
import type { EditorAppProps } from "./editor-app";
import type { ReleaseStartupInput } from "./release-startup";

class ReplyPort {
	constructor(private readonly receive: (data: unknown) => void) {}
	reply(data: unknown) {
		this.receive(data);
	}
}

class TestMessageChannel {
	readonly port1: { onmessage: ((event: MessageEvent) => void) | null } = {
		onmessage: null,
	};
	readonly port2 = new ReplyPort((data) => {
		this.port1.onmessage?.(new MessageEvent("message", { data }));
	});
}

const shellManifest = { appBuildId: "shell-build" };
const workerManifest = { appBuildId: "worker-build" };

// The in-memory shell/worker fixture must settle without relying on the test
// runner's body timeout. A stalled public operation is an explicit assertion.
async function completedStartup(operation: Promise<ReleaseStartupInput>) {
	let deadline: ReturnType<typeof setTimeout> | undefined;
	try {
		const result = await Promise.race([
			operation.then((value) => ({ value })),
			new Promise<undefined>((resolve) => {
				deadline = setTimeout(() => resolve(undefined), 1_000);
			}),
		]);
		expect(
			result,
			"the in-memory public startup operation must complete",
		).toBeDefined();
		if (result === undefined)
			throw new Error("startup completion assertion did not fail");
		return result.value;
	} finally {
		if (deadline !== undefined) clearTimeout(deadline);
	}
}

async function browserHost(
	input: {
		readonly fetch?: (url: string) => Promise<Response>;
		readonly worker?: {
			postMessage: (data: unknown, ports: unknown[]) => void;
		};
		readonly channelAvailable?: boolean;
		readonly indexeddb?: boolean;
		readonly webgl2?: boolean;
		readonly serviceWorkerAvailable?: boolean;
	},
	assert: (host: {
		readonly first: ReactElement<EditorAppProps>;
		readonly second: ReactElement<EditorAppProps>;
		readonly writes: readonly string[];
		readonly requests: readonly string[];
		readonly contexts: readonly string[];
		readonly timers: ReadonlyArray<{
			readonly delay: number;
			fire: () => void;
		}>;
		readonly clearedTimers: readonly number[];
	}) => Promise<void>,
) {
	const values = new Map<string, string>();
	const writes: string[] = [];
	const requests: string[] = [];
	const contexts: string[] = [];
	const timers: Array<{ readonly delay: number; fire: () => void }> = [];
	const clearedTimers: number[] = [];
	const browserWindow = {
		...(input.indexeddb === false ? {} : { indexedDB: {} }),
		crypto: {
			randomUUID: () => "5371249e-807c-466e-8344-08cc3b7c4920",
			subtle: globalThis.crypto.subtle,
		},
		performance: { getEntriesByType: () => [{ type: "navigate" }] },
		sessionStorage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => {
				writes.push(key);
				values.set(key, value);
			},
		},
		setTimeout: (fire: () => void, delay: number) => {
			timers.push({ delay, fire });
			return timers.length;
		},
		clearTimeout: (id: number) => clearedTimers.push(id),
	};
	const globals = {
		window: browserWindow,
		navigator:
			input.serviceWorkerAvailable === false
				? {}
				: { serviceWorker: { controller: input.worker } },
		document: {
			createElement: (tag: string) => {
				expect(tag).toBe("canvas");
				return {
					getContext: (kind: string) => {
						contexts.push(kind);
						return input.webgl2 === false ? null : { getExtension: () => null };
					},
				};
			},
		},
		fetch: async (url: string) => {
			requests.push(url);
			return input.fetch
				? input.fetch(url)
				: new Response(JSON.stringify(shellManifest));
		},
		MessageChannel:
			input.channelAvailable === false ? undefined : TestMessageChannel,
	};
	const previous = Object.keys(globals).map((name) => ({
		name,
		descriptor: Object.getOwnPropertyDescriptor(globalThis, name),
	}));
	for (const [name, value] of Object.entries(globals)) {
		Object.defineProperty(globalThis, name, { configurable: true, value });
	}
	const cleanupErrors: unknown[] = [];
	let primaryFailure: { reason: unknown } | undefined;
	try {
		const { BrowserEditorApp } = await import("./browser-editor-app");
		const first: ReactElement<EditorAppProps> = BrowserEditorApp({});
		const second: ReactElement<EditorAppProps> = BrowserEditorApp({});
		await assert({
			first,
			second,
			writes,
			requests,
			contexts,
			timers,
			clearedTimers,
		});
	} catch (reason) {
		primaryFailure = { reason };
	} finally {
		for (const { name, descriptor } of previous) {
			try {
				if (descriptor) Object.defineProperty(globalThis, name, descriptor);
				else Reflect.deleteProperty(globalThis, name);
			} catch (error) {
				cleanupErrors.push(error);
			}
		}
		if (
			Reflect.get(globalThis, "process").env
				.BROWSER_DEFAULT39_HOST_CLEANUP_CONTROL === "1"
		)
			cleanupErrors.push(new Error("Controlled host cleanup failure"));
	}
	if (cleanupErrors.length)
		throw new Error("BROWSER_DEFAULT39_PROOF_INVALID host cleanup", {
			cause: cleanupErrors[0],
		});
	if (primaryFailure) throw primaryFailure.reason;
}

it("browser composition reuses one writer and runtime across repeated rendering", async () => {
	const body = JSON.stringify(validCatalogEnvelope);
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(body),
	);
	const envelopeHash = Array.from(new Uint8Array(digest), (value) =>
		value.toString(16).padStart(2, "0"),
	).join("");
	await browserHost(
		{
			fetch: async (url) =>
				url.startsWith("/catalog-api/")
					? new Response(body, {
							headers: {
								"content-type": "application/json",
								etag: `"${envelopeHash}"`,
							},
						})
					: new Response(JSON.stringify(shellManifest)),
		},
		async ({ first, second, writes }) => {
			expect(writes).toEqual(["interiors-editor-writer-owner"]);
			expect(first.props.runtime).toBe(second.props.runtime);
			expect(first.props.runtime.controller).toBe(
				second.props.runtime.controller,
			);
			expect(first.props.catalogGateway).toBe(second.props.catalogGateway);
			expect(first.props.readReleaseStartupInput).toBe(
				second.props.readReleaseStartupInput,
			);
			expect(
				await first.props.catalogGateway.currentPublication(),
			).toMatchObject({
				kind: "available",
				publication: {
					catalogVersion: validCatalogEnvelope.catalogVersion,
					envelopeHash,
				},
			});
		},
	);
});

it("a browser without the service-worker API still supplies an uncontrolled startup", async () => {
	await browserHost({ serviceWorkerAvailable: false }, async ({ first }) => {
		expect(
			await completedStartup(first.props.readReleaseStartupInput()),
		).toMatchObject({
			hasControllingWorker: false,
			workerManifest: undefined,
			shellManifest,
		});
	});
});

it("an uncontrolled browser passes its shell manifest and actual capabilities to the shared guard", async () => {
	await browserHost({}, async ({ first, requests, contexts }) => {
		expect(
			await completedStartup(first.props.readReleaseStartupInput()),
		).toEqual({
			capabilities: { indexeddb: true, webgl2: true },
			hasControllingWorker: false,
			shellManifest,
			workerManifest: undefined,
		});
		expect(requests).toEqual(["/release-manifest.json"]);
		expect(contexts).toEqual(["webgl2"]);
	});
});

it("unsupported storage and renderer capabilities are not reported as available", async () => {
	await browserHost({ indexeddb: false, webgl2: false }, async ({ first }) => {
		expect(
			(await completedStartup(first.props.readReleaseStartupInput()))
				.capabilities,
		).toEqual({
			indexeddb: false,
			webgl2: false,
		});
	});
});

for (const failure of ["http", "network", "json"]) {
	it(`a ${failure} manifest failure stays explicit instead of inventing a compatible manifest`, async () => {
		await browserHost(
			{
				fetch: async () => {
					if (failure === "network") throw new Error("offline");
					return new Response("not a manifest", {
						status: failure === "http" ? 404 : 200,
					});
				},
			},
			async ({ first }) => {
				expect(
					(await completedStartup(first.props.readReleaseStartupInput()))
						.shellManifest,
				).toBeUndefined();
			},
		);
	});
}

it("a controlling worker without MessageChannel remains controlling with an absent response", async () => {
	await browserHost(
		{
			channelAvailable: false,
			worker: {
				postMessage: () => {
					throw new Error("no channel should be used");
				},
			},
		},
		async ({ first }) => {
			expect(
				await completedStartup(first.props.readReleaseStartupInput()),
			).toMatchObject({
				hasControllingWorker: true,
				workerManifest: undefined,
			});
		},
	);
});

it("the exact worker response and shell response retain their separate provenance", async () => {
	const requests: unknown[] = [];
	await browserHost(
		{
			worker: {
				postMessage: (request, ports) => {
					requests.push(request);
					expect(ports).toHaveLength(1);
					const port = ports[0];
					if (!(port instanceof ReplyPort))
						throw new Error("missing reply port");
					port.reply({ manifest: workerManifest });
				},
			},
		},
		async ({ first, clearedTimers }) => {
			expect(
				await completedStartup(first.props.readReleaseStartupInput()),
			).toEqual({
				capabilities: { indexeddb: true, webgl2: true },
				hasControllingWorker: true,
				shellManifest,
				workerManifest,
			});
			expect(requests).toEqual([{ type: "INTERIORS_RELEASE_MANIFEST" }]);
			expect(clearedTimers).toEqual([1]);
		},
	);
});

for (const payload of [undefined, null, {}]) {
	it(`a worker reply without a manifest stays controlling and cannot invent compatibility (${JSON.stringify(payload)})`, async () => {
		await browserHost(
			{
				worker: {
					postMessage: (_request, ports) => {
						const port = ports[0];
						if (!(port instanceof ReplyPort))
							throw new Error("missing reply port");
						port.reply(payload);
					},
				},
			},
			async ({ first }) => {
				expect(
					await completedStartup(first.props.readReleaseStartupInput()),
				).toMatchObject({
					hasControllingWorker: true,
					workerManifest: undefined,
				});
			},
		);
	});
}

it("a silent controlling worker times out without being reclassified as uncontrolled", async () => {
	await browserHost(
		{ worker: { postMessage: () => {} } },
		async ({ first, timers }) => {
			const settled: unknown[] = [];
			const result = first.props.readReleaseStartupInput().then((value) => {
				settled.push(value);
				return value;
			});
			await Promise.resolve();
			await Promise.resolve();
			expect(settled).toEqual([]);
			expect(timers).toHaveLength(1);
			expect(timers[0].delay).toBe(1_000);
			timers[0].fire();
			expect(await completedStartup(result)).toMatchObject({
				hasControllingWorker: true,
				workerManifest: undefined,
			});
		},
	);
});

it("default browser exposes registered import through the shared browser runtime editor", async () => {
	await browserHost({}, async ({ first }) => {
		const { BrowserRuntimeEditor } = await import("./browser-runtime-editor");
		expect(first.type).toBe(BrowserRuntimeEditor);
		expect(first.props.registeredTransferImport).toBe(true);
		expect(first.props.registeredTransferExport).toBe(true);
		expect(first.props.runtime.getEditorInstanceSnapshot).toBeInstanceOf(
			Function,
		);
		expect(first.props.runtime.getStartupSourcesRevision).toBeInstanceOf(
			Function,
		);
	});
});
