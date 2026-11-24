import { isEncryptedProjectTransfer, MAX_ENCRYPTED_PROJECT_TRANSFER_BYTES } from "./encrypted-project-transfer";

const uploadPath = "/project-transfer/v1/files";
const downloadPathPattern = /^\/project-transfer\/v1\/files\/[A-Za-z0-9_-]{43}$/;
export const telegramProjectDownloadFilename = "project.interiors";
export const projectDownloadLifetimeMs = 15 * 60 * 1000;
type DownloadOutcome = "requested" | "cancelled" | "unavailable";
type TelegramDownload = (request: { url: string; file_name: string }, done: (accepted: boolean) => void) => void;

export function createTelegramProjectDownload(dependencies: {
	readonly origin: string;
	readonly fetch: typeof globalThis.fetch;
	readonly readSdk: () => unknown;
}) {
	const currentDownload = (): TelegramDownload | undefined => {
		try {
			const sdk = dependencies.readSdk();
			if (!dependencies.origin.startsWith("https://") || !sdk || typeof sdk !== "object" ||
				!("platform" in sdk) || sdk.platform !== "android" ||
				!("isVersionAtLeast" in sdk) || typeof sdk.isVersionAtLeast !== "function" ||
				!sdk.isVersionAtLeast("8.0") || !("downloadFile" in sdk) || typeof sdk.downloadFile !== "function")
				return undefined;
			return sdk.downloadFile.bind(sdk);
		} catch {
			return undefined;
		}
	};
	return {
		available: () => currentDownload() !== undefined,
		async stage(ciphertext: Uint8Array<ArrayBuffer>, signal: AbortSignal): Promise<string> {
			signal.throwIfAborted();
			if (!currentDownload() || !isEncryptedProjectTransfer(ciphertext) ||
				ciphertext.byteLength <= 52 || ciphertext.byteLength > MAX_ENCRYPTED_PROJECT_TRANSFER_BYTES)
				throw new Error("Encrypted download is unavailable");
			const response = await dependencies.fetch(uploadPath, {
				method: "POST",
				headers: { "Content-Type": "application/octet-stream" },
				body: ciphertext,
				signal,
				credentials: "omit",
				cache: "no-store",
				mode: "same-origin",
				redirect: "error",
				referrerPolicy: "no-referrer",
			});
			if (response.status !== 201) throw new Error("Encrypted copy was not staged");
			const result: unknown = await response.json();
			signal.throwIfAborted();
			if (!result || typeof result !== "object" || !("downloadPath" in result) ||
				typeof result.downloadPath !== "string" || !downloadPathPattern.test(result.downloadPath))
				throw new Error("Invalid download address");
			return result.downloadPath;
		},
		download(path: string, signal: AbortSignal): Promise<DownloadOutcome> {
			if (signal.aborted) return Promise.resolve("cancelled");
			const request = currentDownload();
			if (!request || !downloadPathPattern.test(path)) return Promise.resolve("unavailable");
			return new Promise((resolve) => {
				const abort = () => finish("cancelled");
				const timeout = setTimeout(() => finish("unavailable"), 60_000);
				function finish(result: DownloadOutcome) {
					clearTimeout(timeout);
					signal.removeEventListener("abort", abort);
					resolve(result);
				}
				signal.addEventListener("abort", abort, { once: true });
				try {
					request({ url: dependencies.origin + path, file_name: telegramProjectDownloadFilename }, (accepted) =>
						finish(accepted === true ? "requested" : "cancelled"));
				} catch {
					finish("unavailable");
				}
			});
		},
	};
}

export type TelegramProjectDownload = ReturnType<typeof createTelegramProjectDownload>;
