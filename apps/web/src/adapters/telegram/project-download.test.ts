import { expect, it, rs } from "@rstest/core";
import { createTelegramProjectDownload } from "./project-download";

const origin = "https://domiknote.ru";
const path = "/project-transfer/v1/files/" + "A".repeat(43);
const response = (downloadPath = path) => Response.json({ downloadPath }, { status: 201 });
const envelope = () => {
	const bytes = new Uint8Array(53);
	bytes.set(new TextEncoder().encode("INTENC1\n"));
	return bytes;
};

it("stages bytes separately and hands the exact same-origin address to native Telegram on demand", async () => {
	const fetch = rs.fn(async () => response());
	const downloadFile = rs.fn((_request: unknown, done: (accepted: boolean) => void) => done(true));
	const relay = createTelegramProjectDownload({
		origin, fetch,
		readSdk: () => ({ platform: "android", isVersionAtLeast: () => true, downloadFile }),
	});
	expect(relay.available()).toBe(true);
	const ciphertext = envelope();
	const signal = new AbortController().signal;
	expect(await relay.stage(ciphertext, signal)).toEqual(path);
	expect(fetch).toHaveBeenCalledWith("/project-transfer/v1/files", {
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
	expect(downloadFile).not.toHaveBeenCalled();
	const result = relay.download(path, signal);
	expect(downloadFile).toHaveBeenCalledWith({ url: origin + path, file_name: "project.interiors" }, expect.any(Function));
	expect(await result).toBe("requested");
});

it("refuses foreign and malformed handles and an unavailable or cancelled SDK", async () => {
	let platform = "android";
	const downloadFile = rs.fn((_request: unknown, done: (accepted: boolean) => void) => done(false));
	const relay = createTelegramProjectDownload({
		origin,
		fetch: async () => response("https://other.example" + path),
		readSdk: () => ({ platform, isVersionAtLeast: () => true, downloadFile }),
	});
	const signal = new AbortController().signal;
	await expect(relay.stage(envelope(), signal)).rejects.toThrow("Invalid download address");
	await expect(relay.stage(new Uint8Array(64), signal)).rejects.toThrow("Encrypted download is unavailable");
	expect(await relay.download(path + "?abc", signal)).toBe("unavailable");
	expect(downloadFile).not.toHaveBeenCalled();
	expect(await relay.download(path, signal)).toBe("cancelled");
	platform = "ios";
	expect(relay.available()).toBe(false);
	expect(await relay.download(path, signal)).toBe("unavailable");
	expect(downloadFile).toHaveBeenCalledTimes(1);
});
