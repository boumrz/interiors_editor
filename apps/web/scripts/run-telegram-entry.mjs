import "./check-runtime.mjs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createTelegramPreviewServer } from "./telegram-preview-server.mjs";
const root = await mkdtemp(join(tmpdir(), "interiors-tma-entry-proof-")),
	base = join(root, "base", "dist-telegram"),
	next = join(root, "next", "dist-telegram"),
	empty = join(root, "empty", "dist-telegram");
const environment = {
	...process.env,
	INTERIORS_TELEGRAM_BOT_ID: "7342037359",
	INTERIORS_TELEGRAM_ENVIRONMENT: "production",
	INTERIORS_TELEGRAM_LINK: "https://t.me/example_test_bot",
	INTERIORS_WEB_URL: "https://example.invalid/editor",
	TMA_ENTRY_RESULT_DIR: join(root, "results"),
	TMA_ENTRY_REPORT: join(root, "report.json"),
};
async function run(args, extra = {}) {
	const child = spawn(process.execPath, args, {
		env: { ...environment, ...extra },
		stdio: "inherit",
	});
	const [code, signal] = await once(child, "exit");
	if (code !== 0)
		throw new Error(
			`Telegram entry proof failed (${code ?? signal}); artifacts ${root}`,
		);
}
const build = (output, extra = {}) =>
	run(
		[
			resolve("node_modules/@rspack/cli/bin/rspack.js"),
			"build",
			"--mode",
			"production",
			"--config",
			"rspack.telegram-entry-verification.config.mjs",
		],
		{ INTERIORS_TELEGRAM_OUTPUT: output, ...extra },
	);
await build(base);
await build(next, { TMA_ENTRY_NEXT_RELEASE: "true" });
await build(empty, {
	INTERIORS_TELEGRAM_BOT_ID: "",
	INTERIORS_TELEGRAM_ENVIRONMENT: "",
	INTERIORS_TELEGRAM_LINK: "",
});
const preview = await createTelegramPreviewServer({ directory: base }),
	emptyPreview = await createTelegramPreviewServer({ directory: empty });
const listen = async (server) => {
	await new Promise((done) => server.listen(0, "127.0.0.1", done));
	return `http://127.0.0.1:${server.address().port}`;
};
const emptyOrigin = await listen(emptyPreview.server);
async function applicationPath(directory) {
	const release = JSON.parse(
		await readFile(join(directory, "release-set.json"), "utf8"),
	);
	for (const asset of release.assets) {
		if (
			asset.path.endsWith(".js") &&
			(await readFile(join(directory, asset.path.slice(1)), "utf8")).includes(
				"Этот Telegram-редактор пока не настроен",
			)
		)
			return asset.path;
	}
	throw new Error("Actual application module not found");
}
const baseApplicationPath = await applicationPath(base),
	nextApplicationPath = await applicationPath(next),
	served = [];
const original = preview.server.listeners("request")[0];
preview.server.removeListener("request", original);
preview.server.on("request", (request, response) => {
	void (async () => {
		try {
			if (request.url === "/entry-proof-worker.js") {
				response
					.writeHead(200, {
						"Content-Type": "text/javascript",
						"Cache-Control": "no-store",
					})
					.end(
						await readFile("tests/browser/telegram-entry-worker-fixture.js"),
					);
				return;
			}
			if (request.url === "/__entry-proof/environment") {
				response
					.writeHead(200, { "Content-Type": "application/json" })
					.end(
						JSON.stringify({
							emptyOrigin,
							baseApplicationPath,
							nextApplicationPath,
							served,
						}),
					);
				return;
			}
			if (
				request.method === "POST" &&
				[
					"/__entry-proof/activate-base",
					"/__entry-proof/activate-next",
				].includes(request.url)
			) {
				await preview.activate(request.url.endsWith("next") ? next : base);
				response
					.writeHead(200, { "Content-Type": "application/json" })
					.end(JSON.stringify({ activeBuildId: preview.activeBuildId() }));
				return;
			}
			served.push({
				path: new URL(request.url, "http://127.0.0.1").pathname,
				activeBuildId: preview.activeBuildId(),
			});
			original(request, response);
		} catch {
			response.writeHead(500).end();
		}
	})();
});
const origin = await listen(preview.server);
await writeFile(
	join(root, "fixture.json"),
	JSON.stringify(
		{
			origin,
			emptyOrigin,
			base,
			next,
			empty,
			productionTarget: true,
			testSignedPublicVector: true,
			historicalTestClock: true,
			physicalTelegram: false,
		},
		null,
		2,
	),
);
try {
	await run(
		[
			resolve("node_modules/@playwright/test/cli.js"),
			"test",
			"--config",
			"playwright.telegram-entry.config.mjs",
			...process.argv.slice(2),
		],
		{ TMA_ENTRY_BASE_URL: origin },
	);
} finally {
	await preview.close();
	await emptyPreview.close();
	process.stdout.write(`Telegram entry proof artifacts: ${root}\n`);
}
