import assert from "node:assert/strict";
import { test } from "node:test";
import {
	sealTelegramRelease,
	telegramPublicConfiguration,
	assertTelegramOutputDirectory,
} from "./telegram-release-build.mjs";
const template =
	'<html><head><script defer src="/telegram.1234abcd.js"></script></head><body><script id="telegram-loaded-release" type="application/json">__TELEGRAM_RELEASE_CAPSULE__</script><script id="telegram-deployment" type="application/json">__TELEGRAM_DEPLOYMENT__</script>__TELEGRAM_FALLBACK_LINKS__</body></html>';
const assets = new Map([
	["/telegram.1234abcd.js", new TextEncoder().encode("actual entry")],
	["/lazy.aaaaaaaa.js", new TextEncoder().encode("actual lazy mode")],
]);
const seal = (extra = {}) =>
	sealTelegramRelease({
		html: template,
		entryPath: "/telegram.1234abcd.js",
		assets,
		configuration: telegramPublicConfiguration({}),
		...extra,
	});
const embedded = (html, id) =>
	JSON.parse(
		new RegExp(
			`<script id="${id}" type="application/json">([^<]*)</script>`,
		).exec(html)?.[1] ?? "null",
	);
test("capsule binds the actual immutable entry and generated manifest, without generating a PWA worker", () => {
	const sealed = seal();
	const capsule = embedded(sealed.html, "telegram-loaded-release");
	assert.deepEqual(capsule, {
		deliveryTarget: "telegram",
		entryPath: "/telegram.1234abcd.js",
		manifest: sealed.manifest,
	});
	assert.match(
		sealed.html,
		/<script[^>]*data-telegram-entry[^>]*src="\/telegram\.1234abcd\.js"/,
	);
	assert.deepEqual(
		sealed.releaseSet.assets.map(({ path }) => path),
		[
			"/index.html",
			"/lazy.aaaaaaaa.js",
			"/release-manifest.json",
			"/telegram.1234abcd.js",
		],
	);
	assert.equal(seal().manifest.appBuildId, sealed.manifest.appBuildId);
	assert.notEqual(
		seal({
			assets: new Map([...assets, ["/new.bbbbbbbb.js", new Uint8Array([1])]]),
		}).manifest.appBuildId,
		sealed.manifest.appBuildId,
	);
	assert.deepEqual(sealed.manifest.projectSchemas, {
		readable: [1],
		writable: [1],
	});
});
test("missing/foreign entries and malformed templates cannot produce a release set", () => {
	for (const extra of [
		{ entryPath: "/missing.1234abcd.js" },
		{ entryPath: "/telegram.js" },
		{ html: template.replace("__TELEGRAM_RELEASE_CAPSULE__", "") },
		{ html: template.replace("/telegram.1234abcd.js", "/other.1234abcd.js") },
	])
		assert.throws(() => seal(extra));
});
test("public deployment metadata has only four named public fields and safely preserves script text", () => {
	const configuration = telegramPublicConfiguration({
		INTERIORS_TELEGRAM_BOT_ID: "123",
		INTERIORS_TELEGRAM_ENVIRONMENT: "production",
		INTERIORS_TELEGRAM_LINK: "https://t.me/test",
		INTERIORS_WEB_URL: "https://example.invalid/</script><script>no</script>",
		BOT_TOKEN: "private-must-not-appear",
	});
	assert.deepEqual(configuration, {
		botId: "123",
		environment: "production",
		telegramURL: "https://t.me/test",
		webURL: "https://example.invalid/</script><script>no</script>",
	});
	const sealed = seal({ configuration });
	assert.deepEqual(Object.keys(configuration).sort(), [
		"botId",
		"environment",
		"telegramURL",
		"webURL",
	]);
	assert.deepEqual(embedded(sealed.html, "telegram-deployment"), configuration);
	assert.doesNotMatch(sealed.html, /private-must-not-appear|<script>no/);
	assert.deepEqual(telegramPublicConfiguration({}), {
		botId: "",
		environment: "",
		telegramURL: "",
		webURL: "",
	});
});
test("the target cannot choose a browser dist or source directory as output", () => {
	assert.equal(
		assertTelegramOutputDirectory("/tmp/owned/dist-telegram"),
		"/tmp/owned/dist-telegram",
	);
	for (const value of [
		"/tmp/owned/dist",
		"/tmp/owned",
		"/tmp/owned/src",
		"/tmp/owned/dist-telegram/..",
	])
		assert.throws(() => assertTelegramOutputDirectory(value));
});
test("actual plugin emits only this compilation capsule/manifest and requires exactly one loaded target entry", () => {
	const configuration = telegramPublicConfiguration({}),
		emitted = new Map(
			[...assets].map(([path, bytes]) => [
				path.slice(1),
				{
					source: () => Buffer.from(bytes).toString(),
					buffer: () => Buffer.from(bytes),
				},
			]),
		);
	emitted.set("index.html", {
		source: () => template,
		buffer: () => Buffer.from(template),
	});
	let plugin;
	return import("./telegram-release-build.mjs").then(
		({ TelegramReleasePlugin }) => {
			const compilation = {
				entrypoints: new Map([
					[
						"telegram",
						{ getFiles: () => ["telegram.1234abcd.js", "lazy.aaaaaaaa.js"] },
					],
				]),
				hooks: {
					processAssets: {
						tap(options, callback) {
							assert.equal(options.name, "TelegramReleasePlugin");
							callback();
						},
					},
				},
				getAsset: (name) =>
					emitted.has(name) ? { source: emitted.get(name) } : undefined,
				getAssets: () =>
					[...emitted].map(([name, source]) => ({ name, source })),
				updateAsset(name, source) {
					assert.equal(name, "index.html");
					emitted.set(name, source);
				},
				emitAsset(name, source) {
					assert.equal(emitted.has(name), false);
					emitted.set(name, source);
				},
			};
			plugin = new TelegramReleasePlugin(configuration);
			plugin.apply({
				hooks: {
					thisCompilation: {
						tap(name, callback) {
							assert.equal(name, "TelegramReleasePlugin");
							callback(compilation);
						},
					},
				},
			});
			assert.equal(emitted.has("release-manifest.json"), true);
			assert.equal(emitted.has("release-set.json"), true);
			assert.equal(emitted.has("sw.js"), false);
			assert.match(emitted.get("index.html").source(), /data-telegram-entry/);
		},
	);
});

test("release identity is reproducible across inventory order and changes with public deployment or shell", () => {
	const original = seal();
	assert.equal(
		seal({ assets: new Map([...assets].reverse()) }).manifest.appBuildId,
		original.manifest.appBuildId,
	);
	assert.notEqual(
		seal({
			configuration: telegramPublicConfiguration({
				INTERIORS_TELEGRAM_BOT_ID: "123",
			}),
		}).manifest.appBuildId,
		original.manifest.appBuildId,
	);
	assert.notEqual(
		seal({ html: template.replace("<html>", '<html lang="ru">') }).manifest
			.appBuildId,
		original.manifest.appBuildId,
	);
});
test("the standalone target config refuses an unpinned package manager before any compiler work", async () => {
	const { spawnSync } = await import("node:child_process");
	const child = spawnSync(
		process.execPath,
		[
			"--input-type=module",
			"--eval",
			'await import("./rspack.telegram.config.mjs")',
		],
		{
			cwd: process.cwd(),
			env: { ...process.env, npm_config_user_agent: "pnpm/0.0.0" },
			encoding: "utf8",
		},
	);
	assert.notEqual(child.status, 0);
});
test("release identity frames binary inventory boundaries unambiguously", () => {
	const first = new Map([...assets, ["/a.bin", Buffer.from("a\0/b.bin\0b")]]);
	const second = new Map([
		...assets,
		["/a.bin", Buffer.from("a")],
		["/b.bin", Buffer.from("b")],
	]);
	assert.notEqual(
		seal({ assets: first }).manifest.appBuildId,
		seal({ assets: second }).manifest.appBuildId,
	);
});
test("static pre-editor fallback links preserve both safe URLs and exclude unsafe or credentialed URLs", () => {
	const safe = seal({
		configuration: telegramPublicConfiguration({
			INTERIORS_TELEGRAM_LINK: "https://t.me/test?a=1&b=2",
			INTERIORS_WEB_URL: "https://example.invalid/editor",
		}),
	});
	const links = [...safe.html.matchAll(/<a href="([^"]*)">/g)].map(
		(match) => match[1],
	);
	assert.deepEqual(links, [
		"https://t.me/test?a=1&amp;b=2",
		"https://example.invalid/editor",
	]);
	for (const telegramURL of [
		"javascript:alert(1)",
		"https://user@example.invalid/",
		"https://:password@example.invalid/",
		"bad-link",
	]) {
		const html = seal({
			configuration: { botId: "", environment: "", telegramURL, webURL: "" },
		}).html;
		assert.equal([...html.matchAll(/<a href="([^"]*)">/g)].length, 0);
	}
});
