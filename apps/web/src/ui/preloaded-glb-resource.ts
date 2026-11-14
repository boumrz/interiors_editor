const DEFAULT_RANGE_BYTES = 1024 * 1024;
// A full catalog GLB can be 25 MiB. The request is still cancellable and
// individually bounded by ranges, but temporary tunnels need more than 15 s
// to return all chunks on a slow mobile connection.
const PRELOADED_GLB_REQUEST_TIMEOUT_MILLISECONDS = 90_000;

export type PreloadedGlbDownloadProgress = {
	readonly loadedBytes: number;
	readonly totalBytes?: number;
};

async function fetchPreloadedGlbRange(
	url: string,
	range: string,
	fetcher: typeof fetch,
	signal: AbortSignal,
): Promise<Response> {
	try {
		return await fetcher(url, {
			cache: "no-store",
			headers: { Accept: "model/gltf-binary", Range: range },
			signal,
		});
	} catch {
		throw new Error("PRELOADED_GLB_RANGE_UNAVAILABLE");
	}
}

function isPreloadedGlbRangeFailure(failure: unknown): failure is Error {
	return (
		failure instanceof Error &&
		(failure.message === "PRELOADED_GLB_RANGE_UNAVAILABLE" ||
			failure.message === "PRELOADED_GLB_RANGE_INVALID")
	);
}

type ByteRange = {
	readonly start: number;
	readonly end: number;
	readonly total: number;
};

function byteRangeFrom(response: Response): ByteRange | undefined {
	const match = response.headers
		.get("content-range")
		?.match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
	const [start, end, total] = (match?.slice(1) ?? []).map(Number);
	if (
		!Number.isSafeInteger(start) ||
		!Number.isSafeInteger(end) ||
		!Number.isSafeInteger(total) ||
		start < 0 ||
		end < start ||
		total <= end
	) {
		return undefined;
	}
	return { start, end, total };
}

/**
 * Some development tunnels reject a whole multi-megabyte GLB response but
 * correctly proxy byte ranges. Load the exact same resource in bounded ranges
 * without reusing a cached first range, so the subsequent preflight and
 * pinning still see complete original bytes.
 */
export async function fetchPreloadedGlbBytes(
	url: string,
	fetcher: typeof fetch = fetch,
	rangeBytes = DEFAULT_RANGE_BYTES,
	signal?: AbortSignal,
	onProgress?: (progress: PreloadedGlbDownloadProgress) => void,
): Promise<Uint8Array> {
	const request = new AbortController();
	const abortRequest = () => request.abort();
	if (signal?.aborted) abortRequest();
	signal?.addEventListener("abort", abortRequest, { once: true });
	const timeout = globalThis.setTimeout(
		abortRequest,
		PRELOADED_GLB_REQUEST_TIMEOUT_MILLISECONDS,
	);

	try {
		const first = await fetchPreloadedGlbRange(
			url,
			`bytes=0-${rangeBytes - 1}`,
			fetcher,
			request.signal,
		);
		if (first.status === 200) {
			if (first.headers.has("content-range")) {
				throw new Error("PRELOADED_GLB_RANGE_UNAVAILABLE");
			}
			const bytes = new Uint8Array(await first.arrayBuffer());
			const totalBytes = Number(first.headers.get("content-length"));
			onProgress?.({
				loadedBytes: bytes.byteLength,
				totalBytes:
					Number.isSafeInteger(totalBytes) && totalBytes === bytes.byteLength
						? totalBytes
						: bytes.byteLength,
			});
			return bytes;
		}
		if (first.status !== 206) {
			throw new Error("PRELOADED_GLB_RANGE_UNAVAILABLE");
		}
		const firstRange = byteRangeFrom(first);
		if (!firstRange) throw new Error("PRELOADED_GLB_RANGE_UNAVAILABLE");
		const totalBytes = firstRange.total;
		const output = new Uint8Array(totalBytes);
		let offset = 0;
		let response = first;
		onProgress?.({ loadedBytes: offset, totalBytes });
		while (offset < totalBytes) {
			const byteRange = byteRangeFrom(response);
			if (
				!byteRange ||
				byteRange.start !== offset ||
				byteRange.total !== totalBytes
			) {
				throw new Error("PRELOADED_GLB_RANGE_INVALID");
			}
			const chunk = new Uint8Array(await response.arrayBuffer());
			if (
				chunk.length === 0 ||
				chunk.length !== byteRange.end - byteRange.start + 1 ||
				offset + chunk.length > totalBytes
			) {
				throw new Error("PRELOADED_GLB_RANGE_INVALID");
			}
			output.set(chunk, offset);
			offset += chunk.length;
			onProgress?.({ loadedBytes: offset, totalBytes });
			if (offset === totalBytes) break;
			response = await fetchPreloadedGlbRange(
				url,
				`bytes=${offset}-${Math.min(totalBytes - 1, offset + rangeBytes - 1)}`,
				fetcher,
				request.signal,
			);
			if (response.status !== 206) {
				throw new Error("PRELOADED_GLB_RANGE_UNAVAILABLE");
			}
		}
		return output;
	} catch (failure) {
		if (isPreloadedGlbRangeFailure(failure)) throw failure;
		throw new Error("PRELOADED_GLB_RANGE_UNAVAILABLE");
	} finally {
		globalThis.clearTimeout(timeout);
		signal?.removeEventListener("abort", abortRequest);
	}
}
