import { describe, expect, it } from "@rstest/core";
import { fetchPreloadedGlbBytes } from "./preloaded-glb-resource";

describe("preloaded GLB resource", () => {
	it("negotiates the catalog GLB media type for every bounded request", async () => {
		const bytes = new Uint8Array([11, 22, 33, 44, 55]);
		const ranges: string[] = [];
		const fetcher: typeof fetch = async (_input, init) => {
			const headers = new Headers(init?.headers);
			if (headers.get("accept") !== "model/gltf-binary") {
				return new Response(null, { status: 406 });
			}
			const range = headers.get("range") ?? "";
			ranges.push(range);
			const [start, end] = (range.match(/\d+/g) ?? []).map(Number);
			const slice = bytes.slice(start, (end ?? start) + 1);
			return new Response(slice, {
				headers: {
					"content-range": `bytes ${start}-${start + slice.length - 1}/${bytes.length}`,
				},
				status: 206,
			});
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog-api/v1/resources/sha256/model", fetcher, 2),
		).resolves.toEqual(bytes);
		expect(ranges).toEqual(["bytes=0-1", "bytes=2-3", "bytes=4-4"]);
	});

	it("assembles a binary resource through byte ranges when a tunnel rejects one large response", async () => {
		const bytes = new Uint8Array([11, 22, 33, 44, 55]);
		const fetcher: typeof fetch = async (_input, init) => {
			const range = new Headers(init?.headers).get("range");
			const [start, end] = (range?.match(/\d+/g) ?? []).map(Number);
			const slice = bytes.slice(start, (end ?? start) + 1);
			return new Response(slice, {
				headers: {
					"content-range": `bytes ${start}-${start + slice.length - 1}/${bytes.length}`,
				},
				status: 206,
			});
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2),
		).resolves.toEqual(bytes);
	});

	it("accepts an uncached complete response when a static host does not support byte ranges", async () => {
		const bytes = new Uint8Array([11, 22, 33, 44, 55]);
		const fetcher: typeof fetch = async () => new Response(bytes);

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2),
		).resolves.toEqual(bytes);
	});

	it("reports an exact completed progress for a static model even when its Content-Length is stale", async () => {
		const bytes = new Uint8Array([11, 22, 33, 44, 55]);
		const progress: { loadedBytes: number; totalBytes?: number }[] = [];

		await expect(
			fetchPreloadedGlbBytes(
				"/catalog/model.glb",
				async () =>
					new Response(bytes, { headers: { "content-length": "6" } }),
				2,
				undefined,
				(update) => progress.push(update),
			),
		).resolves.toEqual(bytes);

		expect(progress).toEqual([{ loadedBytes: 5, totalBytes: 5 }]);
	});

	it("reports the total and every completed byte range while a model downloads", async () => {
		const bytes = new Uint8Array([11, 22, 33, 44, 55]);
		const progress: { loadedBytes: number; totalBytes?: number }[] = [];
		const fetcher: typeof fetch = async (_input, init) => {
			const range = new Headers(init?.headers).get("range");
			const [start, end] = (range?.match(/\d+/g) ?? []).map(Number);
			const slice = bytes.slice(start, (end ?? start) + 1);
			return new Response(slice, {
				headers: {
					"content-range": `bytes ${start}-${start + slice.length - 1}/${bytes.length}`,
				},
				status: 206,
			});
		};

		await expect(
			fetchPreloadedGlbBytes(
				"/catalog/model.glb",
				fetcher,
				2,
				undefined,
				(update) => progress.push(update),
			),
		).resolves.toEqual(bytes);

		expect(progress).toEqual([
			{ loadedBytes: 0, totalBytes: 5 },
			{ loadedBytes: 2, totalBytes: 5 },
			{ loadedBytes: 4, totalBytes: 5 },
			{ loadedBytes: 5, totalBytes: 5 },
		]);
	});

	it("turns a hung model request into retryable unavailability instead of loading forever", async () => {
		const originalSetTimeout = globalThis.setTimeout;
		Object.defineProperty(globalThis, "setTimeout", {
			configurable: true,
			value: (callback: () => void) => {
				queueMicrotask(callback);
				return 0;
			},
		});
		const fetcher: typeof fetch = async (_input, init) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener(
					"abort",
					() => reject(new Error("request aborted")),
					{ once: true },
				);
			});

		try {
			const result = await Promise.race([
				fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2).then(
					() => "completed",
					(error: Error) => error.message,
				),
				new Promise<string>((resolve) =>
					originalSetTimeout(() => resolve("still-pending"), 20),
				),
			]);

			expect(result).toBe("PRELOADED_GLB_RANGE_UNAVAILABLE");
		} finally {
			Object.defineProperty(globalThis, "setTimeout", {
				configurable: true,
				value: originalSetTimeout,
			});
		}
	});

	it("keeps the deadline active while a range response body is stalled", async () => {
		const originalSetTimeout = globalThis.setTimeout;
		const originalClearTimeout = globalThis.clearTimeout;
		globalThis.setTimeout = ((callback: () => void) => {
			queueMicrotask(callback);
			return 0 as unknown as ReturnType<typeof setTimeout>;
		}) as typeof setTimeout;
		globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
		const fetcher: typeof fetch = async (_url, init) =>
			new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						init?.signal?.addEventListener(
							"abort",
							() => controller.error(new DOMException("Aborted", "AbortError")),
							{ once: true },
						);
					},
				}),
				{
					headers: { "content-range": "bytes 0-1/2" },
					status: 206,
				},
			);

		try {
			await expect(
				fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2),
			).rejects.toThrow("PRELOADED_GLB_RANGE_UNAVAILABLE");
		} finally {
			globalThis.setTimeout = originalSetTimeout;
			globalThis.clearTimeout = originalClearTimeout;
		}
	});

	it("lets a caller cancel a bounded local range request", async () => {
		const cancel = new AbortController();
		let resolveStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			resolveStarted = resolve;
		});
		const fetcher: typeof fetch = async (_url, init) =>
			new Promise<Response>((_resolve, reject) => {
				resolveStarted?.();
				init?.signal?.addEventListener(
					"abort",
					() => reject(new DOMException("Aborted", "AbortError")),
					{ once: true },
				);
			});
		const request = fetchPreloadedGlbBytes(
			"/catalog/model.glb",
			fetcher,
			2,
			cancel.signal,
		);
		await started;
		cancel.abort();

		await expect(request).rejects.toThrow("PRELOADED_GLB_RANGE_UNAVAILABLE");
	});

	it("does not start a local range response after the caller already cancelled", async () => {
		const cancel = new AbortController();
		cancel.abort();
		const fetcher: typeof fetch = async (_url, init) => {
			if (init?.signal?.aborted) {
				throw new DOMException("Aborted", "AbortError");
			}
			return new Response(new Uint8Array([11]));
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2, cancel.signal),
		).rejects.toThrow("PRELOADED_GLB_RANGE_UNAVAILABLE");
	});

	it("detaches a completed local range request from later caller cancellation", async () => {
		const cancel = new AbortController();
		let requestSignal: AbortSignal | undefined;
		const fetcher: typeof fetch = async (_url, init) => {
			requestSignal = init?.signal ?? undefined;
			return new Response(new Uint8Array([11]));
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2, cancel.signal),
		).resolves.toEqual(new Uint8Array([11]));
		cancel.abort();

		expect(requestSignal?.aborted).toBe(false);
	});

	it("clears the request timeout once a model response arrives", async () => {
		const originalSetTimeout = globalThis.setTimeout;
		const originalClearTimeout = globalThis.clearTimeout;
		const clearedTimeouts: unknown[] = [];
		const timeoutHandle = 718;
		Object.defineProperty(globalThis, "setTimeout", {
			configurable: true,
			value: () => timeoutHandle,
		});
		Object.defineProperty(globalThis, "clearTimeout", {
			configurable: true,
			value: (handle: unknown) => clearedTimeouts.push(handle),
		});

		try {
			await expect(
				fetchPreloadedGlbBytes(
					"/catalog/model.glb",
					async () => new Response(new Uint8Array([11])),
					2,
				),
			).resolves.toEqual(new Uint8Array([11]));
			expect(clearedTimeouts).toEqual([timeoutHandle]);
		} finally {
			Object.defineProperty(globalThis, "setTimeout", {
				configurable: true,
				value: originalSetTimeout,
			});
			Object.defineProperty(globalThis, "clearTimeout", {
				configurable: true,
				value: originalClearTimeout,
			});
		}
	});

	it("uses a bounded no-store first request when the caller keeps the default", async () => {
		const receivedRanges: string[] = [];
		const receivedCacheModes: RequestCache[] = [];
		const fetcher: typeof fetch = async (_input, init) => {
			receivedRanges.push(new Headers(init?.headers).get("range") ?? "");
			receivedCacheModes.push(init?.cache ?? "default");
			return new Response(new Uint8Array([11]), {
				headers: { "content-range": "bytes 0-0/1" },
				status: 206,
			});
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher),
		).resolves.toEqual(new Uint8Array([11]));
		expect(receivedRanges).toEqual(["bytes=0-1048575"]);
		expect(receivedCacheModes).toEqual(["no-store"]);
	});

	it("continues at the actual response boundary when a proxy sends smaller valid chunks", async () => {
		const bytes = new Uint8Array([
			11, 22, 33, 44, 55, 66, 77, 88, 99, 110, 121, 132,
		]);
		const receivedRanges: string[] = [];
		const fetcher: typeof fetch = async (_input, init) => {
			const range = new Headers(init?.headers).get("range") ?? "";
			receivedRanges.push(range);
			const start = Number(range.match(/\d+/)?.[0]);
			return new Response(bytes.slice(start, start + 1), {
				headers: { "content-range": `bytes ${start}-${start}/${bytes.length}` },
				status: 206,
			});
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 4),
		).resolves.toEqual(bytes);
		expect(receivedRanges).toEqual([
			"bytes=0-3",
			"bytes=1-4",
			"bytes=2-5",
			"bytes=3-6",
			"bytes=4-7",
			"bytes=5-8",
			"bytes=6-9",
			"bytes=7-10",
			"bytes=8-11",
			"bytes=9-11",
			"bytes=10-11",
			"bytes=11-11",
		]);
	});

	it("accepts multi-digit content-range values without weakening their boundary checks", async () => {
		const bytes = new Uint8Array(11).map((_, index) => index + 1);
		const fetcher: typeof fetch = async (_input, init) => {
			const range = new Headers(init?.headers).get("range") ?? "";
			const [start, end] = (range.match(/\d+/g) ?? []).map(Number);
			const slice = bytes.slice(start, (end ?? start) + 1);
			return new Response(slice, {
				headers: {
					"content-range": `bytes ${start}-${start + slice.length - 1}/${bytes.length}`,
				},
				status: 206,
			});
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 10),
		).resolves.toEqual(bytes);
	});

	it("rejects a proxy response whose content range does not start at the requested byte", async () => {
		const responses = [
			new Response(new Uint8Array([11, 22]), {
				headers: { "content-range": "bytes 0-1/5" },
				status: 206,
			}),
			new Response(new Uint8Array([11, 22]), {
				headers: { "content-range": "bytes 0-1/5" },
				status: 206,
			}),
			new Response(new Uint8Array([55]), {
				headers: { "content-range": "bytes 4-4/5" },
				status: 206,
			}),
		];
		const fetcher: typeof fetch = async () => {
			const response = responses.shift();
			if (!response) throw new Error("unexpected fetch");
			return response;
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2),
		).rejects.toThrow("PRELOADED_GLB_RANGE_INVALID");
	});

	it("fails closed when the first response is not a valid byte-range response", async () => {
		for (const response of [
			new Response(new Uint8Array([11]), { status: 206 }),
			new Response(new Uint8Array([11]), {
				headers: { "content-range": "bytes 0-0/1" },
				status: 200,
			}),
			new Response(new Uint8Array([11]), {
				headers: { "content-range": "bytes 0-0/1 trailing" },
				status: 206,
			}),
			new Response(new Uint8Array([11]), {
				headers: { "content-range": "proxy bytes 0-0/1" },
				status: 206,
			}),
			new Response(new Uint8Array([11]), {
				headers: { "content-range": "bytes 1-0/1" },
				status: 206,
			}),
			new Response(new Uint8Array([11]), {
				headers: { "content-range": "bytes 0-1/1" },
				status: 206,
			}),
		]) {
			const fetcher: typeof fetch = async () => response.clone();
			await expect(
				fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2),
			).rejects.toThrow("PRELOADED_GLB_RANGE_UNAVAILABLE");
		}
	});

	it("rejects a non-range HTTP status even if the proxy supplies a plausible range and complete body", async () => {
		for (const status of [201, 404, 500]) {
			const fetcher: typeof fetch = async () =>
				new Response(new Uint8Array([11, 22]), {
					headers: { "content-range": "bytes 0-1/2" },
					status,
				});
			await expect(
				fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 2),
			).rejects.toThrow("PRELOADED_GLB_RANGE_UNAVAILABLE");
		}
	});

	it("rejects a mismatched byte count or total from a range proxy", async () => {
		const shortBodyResponses = [
			new Response(new Uint8Array([11]), {
				headers: { "content-range": "bytes 0-1/2" },
				status: 206,
			}),
			new Response(new Uint8Array([22]), {
				headers: { "content-range": "bytes 1-1/2" },
				status: 206,
			}),
		];
		const shortBodyFetcher: typeof fetch = async () => {
			const response = shortBodyResponses.shift();
			if (!response) throw new Error("unexpected fetch");
			return response;
		};
		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", shortBodyFetcher, 2),
		).rejects.toThrow("PRELOADED_GLB_RANGE_INVALID");

		const inconsistentTotalResponses = [
			new Response(new Uint8Array([11]), {
				headers: { "content-range": "bytes 0-0/2" },
				status: 206,
			}),
			new Response(new Uint8Array([22]), {
				headers: { "content-range": "bytes 1-1/3" },
				status: 206,
			}),
		];
		const inconsistentTotalFetcher: typeof fetch = async () => {
			const response = inconsistentTotalResponses.shift();
			if (!response) throw new Error("unexpected fetch");
			return response;
		};
		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", inconsistentTotalFetcher, 1),
		).rejects.toThrow("PRELOADED_GLB_RANGE_INVALID");
	});

	it("rejects a later response that loses byte-range support", async () => {
		const responses = [
			new Response(new Uint8Array([11]), {
				headers: { "content-range": "bytes 0-0/2" },
				status: 206,
			}),
			new Response(new Uint8Array([22]), { status: 200 }),
		];
		const fetcher: typeof fetch = async () => {
			const response = responses.shift();
			if (!response) throw new Error("unexpected fetch");
			return response;
		};

		await expect(
			fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 1),
		).rejects.toThrow("PRELOADED_GLB_RANGE_UNAVAILABLE");
	});

	it("keeps a malformed later range distinct from transport unavailability", async () => {
		for (const contentRange of [undefined, "proxy bytes 1-1/2"]) {
			const responses = [
				new Response(new Uint8Array([11]), {
					headers: { "content-range": "bytes 0-0/2" },
					status: 206,
				}),
				new Response(new Uint8Array([22]), {
					headers: contentRange ? { "content-range": contentRange } : {},
					status: 206,
				}),
			];
			const fetcher: typeof fetch = async () => {
				const response = responses.shift();
				if (!response) throw new Error("Unexpected extra range request");
				return response;
			};
			await expect(
				fetchPreloadedGlbBytes("/catalog/model.glb", fetcher, 1),
			).rejects.toThrow("PRELOADED_GLB_RANGE_INVALID");
		}
	});
});
