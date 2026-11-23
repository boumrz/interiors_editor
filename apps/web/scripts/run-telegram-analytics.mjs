import "./check-runtime.mjs";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { chromium, webkit } from "@playwright/test";
import { verifyAnalytics } from "../tests/browser/telegram-analytics-e2e.mjs";
import { createTelegramPreviewServer } from "./telegram-preview-server.mjs";

const work = await mkdtemp(join(tmpdir(), "interiors-statistics-"));
let server;
try {
	const directory = join(work, "dist-telegram");
	await promisify(execFile)(
		process.execPath,
		[
			resolve("node_modules/@rspack/cli/bin/rspack.js"),
			"build",
			"--mode",
			"production",
			"--config",
			"rspack.telegram.config.mjs",
		],
		{
			env: {
				...process.env,
				INTERIORS_TELEGRAM_BOT_ID: "7342037359",
				INTERIORS_TELEGRAM_ENVIRONMENT: "production",
				INTERIORS_TELEGRAM_LINK: "https://t.me/example_test_bot",
				INTERIORS_WEB_URL: "https://example.invalid/editor",
				INTERIORS_TELEGRAM_OUTPUT: directory,
			},
		},
	);
	const preview = await createTelegramPreviewServer({ directory });
	server = preview.server;
	await new Promise((done) => server.listen(0, "127.0.0.1", done));
	const editorOrigin = "http://127.0.0.1:" + server.address().port;
	for (const browserType of [chromium, webkit])
		await verifyAnalytics({ editorOrigin, browserType });
} finally {
	if (server) await new Promise((done) => server.close(done));
	await rm(work, { recursive: true, force: true });
}
