import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { rspack } from "@rspack/core";

/** The build reads only these public values; no credentials become client metadata. */
export function telegramPublicConfiguration(environment) {
	return Object.freeze({
		botId: environment.INTERIORS_TELEGRAM_BOT_ID ?? "",
		environment: environment.INTERIORS_TELEGRAM_ENVIRONMENT ?? "",
		telegramURL: environment.INTERIORS_TELEGRAM_LINK ?? "",
		webURL: environment.INTERIORS_WEB_URL ?? "",
	});
}
export function assertTelegramOutputDirectory(value) {
	const output = resolve(value);
	if (basename(output) !== "dist-telegram")
		throw new Error(
			"Telegram output must be a separate dist-telegram directory",
		);
	return output;
}
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const scriptJson = (value) =>
	JSON.stringify(value).replace(
		/[<>&\u2028\u2029]/g,
		(character) =>
			`\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);
function fallbackLinks(configuration) {
	return [
		["telegramURL", "Открыть в Telegram"],
		["webURL", "Открыть веб-редактор"],
	]
		.flatMap(([key, label]) => {
			try {
				const url = new URL(configuration[key]);
				if (url.protocol !== "https:" || url.username || url.password)
					return [];
				const href = url.href.replace(
					/[&"<>]/g,
					(character) =>
						({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[
							character
						],
				);
				return [`<p><a href="${href}">${label}</a></p>`];
			} catch {
				return [];
			}
		})
		.join("");
}
export function sealTelegramRelease({
	html,
	entryPath,
	assets,
	configuration,
}) {
	if (
		!/^\/telegram\.[a-zA-Z0-9_-]+\.js$/.test(entryPath) ||
		!assets.has(entryPath)
	)
		throw new Error("Actual Telegram entry asset is missing");
	for (const marker of [
		"__TELEGRAM_RELEASE_CAPSULE__",
		"__TELEGRAM_DEPLOYMENT__",
		"__TELEGRAM_FALLBACK_LINKS__",
	])
		if (html.split(marker).length !== 2)
			throw new Error("Telegram HTML template is incompatible");
	const source = `src="${entryPath}"`;
	if (html.split(source).length !== 2)
		throw new Error("HTML does not load the exact Telegram entry");
	const fingerprint = createHash("sha256").update(
		JSON.stringify({
			html,
			configuration,
			assets: [...assets]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([path, bytes]) => ({
					path,
					byteLength: bytes.byteLength,
					sha256: digest(bytes),
				})),
		}),
	);
	const manifest = {
		appBuildId: fingerprint.digest("hex").slice(0, 16),
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		minimumCapabilities: ["indexeddb"],
		projectSchemas: { readable: [1], writable: [1] },
		version: 1,
		workerProtocolVersion: 1,
	};
	const capsule = { deliveryTarget: "telegram", entryPath, manifest };
	const sealedHtml = html
		.replace(source, `data-telegram-entry="true" ${source}`)
		.replace("__TELEGRAM_RELEASE_CAPSULE__", scriptJson(capsule))
		.replace("__TELEGRAM_DEPLOYMENT__", scriptJson(configuration))
		.replace("__TELEGRAM_FALLBACK_LINKS__", fallbackLinks(configuration));
	const files = new Map(assets);
	files.set("/index.html", Buffer.from(sealedHtml));
	files.set("/release-manifest.json", Buffer.from(JSON.stringify(manifest)));
	const releaseSet = {
		version: 1,
		deliveryTarget: "telegram",
		appBuildId: manifest.appBuildId,
		entryPath,
		assets: [...files]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([path, bytes]) => ({
				path,
				byteLength: bytes.byteLength,
				sha256: digest(bytes),
			})),
	};
	return { html: sealedHtml, manifest, releaseSet };
}
/** Runs after HTML/hash generation and emits metadata for this compilation only. */
export class TelegramReleasePlugin {
	constructor(configuration) {
		this.configuration = configuration;
	}
	apply(compiler) {
		compiler.hooks.thisCompilation.tap(
			"TelegramReleasePlugin",
			(compilation) => {
				compilation.hooks.processAssets.tap(
					{
						name: "TelegramReleasePlugin",
						stage: rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
					},
					() => {
						const entryFiles =
							compilation.entrypoints
								.get("telegram")
								?.getFiles()
								.filter((name) =>
									/^telegram\.[a-zA-Z0-9_-]+\.js$/.test(name),
								) ?? [];
						if (entryFiles.length !== 1)
							throw new Error("One immutable Telegram entry is required");
						const html = compilation.getAsset("index.html")?.source.source();
						if (typeof html !== "string" && !Buffer.isBuffer(html))
							throw new Error("Telegram HTML is missing");
						const assets = new Map(
							compilation
								.getAssets()
								.filter(({ name }) => name !== "index.html")
								.map(({ name, source }) => [
									`/${name}`,
									Buffer.from(source.buffer()),
								]),
						);
						const sealed = sealTelegramRelease({
							html: String(html),
							entryPath: `/${entryFiles[0]}`,
							assets,
							configuration: this.configuration,
						});
						compilation.updateAsset(
							"index.html",
							new rspack.sources.RawSource(sealed.html),
						);
						compilation.emitAsset(
							"release-manifest.json",
							new rspack.sources.RawSource(JSON.stringify(sealed.manifest)),
						);
						compilation.emitAsset(
							"release-set.json",
							new rspack.sources.RawSource(JSON.stringify(sealed.releaseSet)),
						);
					},
				);
			},
		);
	}
}
