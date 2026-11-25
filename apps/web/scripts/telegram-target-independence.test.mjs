import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("Telegram config loads in a checkout without the Web/PWA build or entry", async () => {
	const original = fileURLToPath(new URL("../", import.meta.url));
	const root = await mkdtemp(join(tmpdir(), "interiors-tma-config-no-pwa-"));
	const app = join(root, "apps", "web");
	try {
		const configurations = (await readdir(original)).filter((name) =>
			/^rspack\.(shared|telegram)\.config\.mjs$/.test(name),
		);
		await Promise.all(
			[
				"package.json",
				...configurations,
				"scripts/check-runtime.mjs",
				"scripts/legal-documents-build.mjs",
				"scripts/telegram-analytics-configuration.mjs",
				"scripts/telegram-release-build.mjs",
				"scripts/telegram-sdk-asset.mjs",
				"src/app/license-receipt.ts",
				"src/app/privacy-revision.ts",
				"src/app/product-statistics-revision.ts",
				"../../docs/legal/analytics-consent.html",
				"../../docs/legal/en/analytics-consent.html",
			].map(async (name) => {
				const destination = join(app, name);
				await mkdir(dirname(destination), { recursive: true });
				await copyFile(join(original, name), destination);
			}),
		);
		await symlink(join(original, "node_modules"), join(app, "node_modules"), "dir");
		const child = spawnSync(
			process.execPath,
			[
				"--input-type=module",
				"-e",
				`import assert from "node:assert/strict";
				import configure from "./rspack.telegram.config.mjs";
				const target = configure({}, { mode: "production" });
				assert.deepEqual(target.entry, { telegram: "./src/telegram-main.tsx" });
				assert.equal(target.output.clean, false);
				assert.equal(target.devServer, undefined);
				const plugins = target.plugins.map(plugin => plugin.constructor.name);
				assert.ok(plugins.includes("TelegramReleasePlugin"));
				assert.ok(!plugins.includes("InteriorsServiceWorkerPlugin"));`,
			],
			{
				cwd: app,
				encoding: "utf8",
				timeout: 30_000,
				env: { ...process.env, INTERIORS_TELEGRAM_OUTPUT: join(app, "dist-telegram") },
			},
		);
		assert.equal(child.signal, null, child.stderr);
		assert.equal(child.status, 0, child.stderr || child.stdout);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
